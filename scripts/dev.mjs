// Local play-test server with auto-reload. No dependencies — just Node.js.
// Usage: npm run dev   then open http://localhost:5173  (saving any file reloads the game)
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 5173;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const clients = new Set();
const RELOAD = `<script>(() => { const es = new EventSource('/__reload'); es.onmessage = () => location.reload(); })();</script>`;

http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/__reload') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
        res.write('retry: 1000\n\n');
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return;
    }
    const file = path.join(root, url === '/' ? 'index.html' : url);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('Not found'); return; }
    let body = fs.readFileSync(file);
    const ext = path.extname(file);
    if (ext === '.html') body = body.toString().replace('</body>', RELOAD + '\n</body>');
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
}).listen(PORT, () => console.log(`\n  DEADZONE COMMAND dev server:  http://localhost:${PORT}\n  (edits to index.html or src/ reload the game automatically — Ctrl+C to stop)\n`));

let timer = null;
const notify = () => { clearTimeout(timer); timer = setTimeout(() => clients.forEach(c => c.write('data: reload\n\n')), 120); };
fs.watch(path.join(root, 'src'), { recursive: true }, notify);
fs.watch(path.join(root, 'index.html'), notify);
