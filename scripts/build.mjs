// Builds dist/index.html: one self-contained file (CSS + every script inlined, in the order index.html lists them).
// No dependencies — just Node.js.   Usage: npm run build
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// stylesheet -> inline <style>
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) =>
    `<style>\n${fs.readFileSync(path.join(root, href), 'utf8')}</style>`);

// every local <script src> -> one inline <script>, same order
const srcs = [];
html = html.replace(/<!-- GAME SCRIPTS[^\n]*-->\n/, '');
html = html.replace(/[ \t]*<script src="([^"]+)"><\/script>\n?/g, (_, src) => { srcs.push(src); return '%%SCRIPT%%'; });
if (srcs.length === 0) throw new Error('No <script src> tags found in index.html');
const bundle = srcs.map(src => `// ===== ${src} =====\n` + fs.readFileSync(path.join(root, src), 'utf8')).join('\n');
// keep only the first placeholder; it becomes the single inline script
let first = true;
html = html.replace(/%%SCRIPT%%/g, () => {
    if (!first) return '';
    first = false;
    return `<script>\n${bundle.replace(/<\/script/gi, '<\\/script')}</script>\n`;
});

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'index.html'), html);
// GitHub Pages: don't run Jekyll on the output
fs.writeFileSync(path.join(root, 'dist', '.nojekyll'), '');
const kb = Math.round(Buffer.byteLength(html) / 1024);
console.log(`Built dist/index.html (${kb} KB, ${srcs.length} scripts inlined)`);
