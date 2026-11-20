// Smoke test: builds are checked in a real (headless) browser.
//   one-time setup:  npm install   then   npx playwright install chromium
//   run:             npm test
// Starts a standard game and an Infinite Map game, runs the simulation, exercises orders, save/load and
// fails on any JavaScript error.
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2] || path.join(root, 'dist', 'index.html');
const url = target.startsWith('http') ? target : pathToFileURL(target).href;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? '  PASS' : '  FAIL'}  ${msg}`); if (!ok) failed++; };

async function run(name, settings, body) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('net::')) errors.push(m.text()); });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.game);
    console.log(`\n${name}`);
    const r = await page.evaluate(`(() => { localStorage.clear(); const g = window.game;
        g.settings = Object.assign({}, DEFAULT_SETTINGS, ${JSON.stringify(settings)});
        document.getElementById('btn-deploy').click(); g.paused = true;
        const step = (s) => { for (let i = 0; i < s * 20; i++) g.updateSimulation(0.05); };
        ${body} })()`);
    for (const [k, v] of Object.entries(r)) check(v === true, k);
    check(errors.length === 0, 'no JavaScript errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await page.close();
}

await run('Standard campaign', {}, `
    const o = {};
    o['game started with HQ'] = !!g.getHqEntity();
    step(30);
    const hq = g.getHqEntity();
    g.selectedIds.clear(); g.entities.filter(e => e.faction === 'player' && e.category === 'unit').forEach(e => g.selectedIds.add(e.id));
    g.issueRightClickOrder(hq.x + 400, hq.y - 300); step(10);
    o['units move on orders'] = g.entities.some(e => e.faction === 'player' && e.category === 'unit' && Math.hypot(e.x - hq.x, e.y - hq.y) > 250);
    g.surgeWave = 3; g.triggerZombieSurge(); step(20);
    o['zombie wave spawned'] = g.waveGroups.length > 0;
    g.openHome('saves'); o['save works'] = g.saveToSlot('slot1', false);
    const n = g.entities.length; o['load works'] = g.loadFromSlot('slot1') && Math.abs(g.entities.length - n) < 5;
    step(10); o['still running after load'] = g.running && !g.gameOver;
    return o;`);

await run('Infinite Map Mode', { worldMode: 'infinite' }, `
    const o = {};
    o['infinite world started'] = g.infinite && g.chunkRT.size > 0;
    const hq = g.getHqEntity(); const v = g.createVehicle('blackhawk', hq.x + 100, hq.y);
    v.fuel = v.fuelMax = 1e9; v.state = 'move'; v.targetPos = { x: hq.x + 12000, y: hq.y };
    const before = g.chunks.size; step(70);
    o['new chunks stream in as units explore'] = g.chunks.size > before;
    o['far chunks unload'] = g.chunkRT.size < g.chunks.size;
    g.openHome('saves'); o['save works'] = g.saveToSlot('slot2', false);
    o['load works'] = g.loadFromSlot('slot2') && g.infinite;
    return o;`);

await browser.close();
console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll smoke checks passed');
process.exit(failed ? 1 : 0);
