'use strict';
// Pathfinding: nav grid, A*, line-of-sight, stuck recovery (moveEntityToward is the movement entry point)
defineGameMethods({
    // ========================================================================
    // UPDATE 6: PATHFINDING & STUCK RECOVERY
    // A tile navigation grid (terrain + every structure footprint) drives A* routing. Units walk straight when the
    // way is clear, request a route only when a building/obstacle is in the way, and re-route (avoiding the tile
    // that blocked them) when they stop making progress. Vehicles need a 1-tile clearance so they never try to
    // squeeze down a gap they can't fit through. Paths are cached; nothing is recomputed every frame.
    // ========================================================================
    buildNavGrid(force = false) {
        if (this.infinite) return this.buildNavGridInfinite(force);
        const cols = MAP_COLS, rows = MAP_ROWS, N = cols * rows;
        // structure signature: only rebuild when buildings / walls / hives etc. appear, finish or disappear
        let sig = 0, cnt = 0;
        for (const e of this.entities) {
            if (!NAV_STRUCTURE_CATS.has(e.category)) continue;
            cnt++;
            sig = (sig * 31 + e.id * 7 + Math.round(e.x) + (e.type === 'gate' ? 3 : 0)) % 1000000007;
        }
        const key = cnt + ':' + sig + ':' + (this.terrain ? this.terrain.length : 0);
        if (!force && this.navBlocked && this._navKey === key) return;
        this._navKey = key;
        if (!this.navBlocked || this.navBlocked.length !== N) { this.navBlocked = new Uint8Array(N); this.navClear = new Uint8Array(N); }
        const nb = this.navBlocked;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const i = r * cols + c;
                nb[i] = (this.blockedGrid[r] && this.blockedGrid[r][c]) ? ((this.terrain[r] && this.terrain[r][c] === 'rubble') ? 2 : 1) : 0;
            }
        }
        for (const e of this.entities) {
            if (!NAV_STRUCTURE_CATS.has(e.category)) continue;
            this.navStampStructure(e, (c, r, v) => {
                if (c < 0 || r < 0 || c >= cols || r >= rows) return;
                const i = r * cols + c;
                if (nb[i] !== 1) nb[i] = v;
            });
        }
        const cl = this.navClear;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const i = r * cols + c;
                let ok = nb[i] !== 1 && nb[i] !== 3;
                for (let dr = -1; dr <= 1 && ok; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        const rr = r + dr, cc = c + dc;
                        if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) { ok = false; break; }
                        const v = nb[rr * cols + cc];
                        if (v === 1 || v === 3) { ok = false; break; }
                    }
                }
                cl[i] = ok ? 1 : 0;
            }
        }
        this.navVersion = (this.navVersion || 0) + 1;
    },

    navStampStructure(e, put) {
        const R = Math.max(10, (e.radius || 16) - 6);
        const c0 = Math.floor((e.x - R) / TILE_SIZE), c1 = Math.floor((e.x + R) / TILE_SIZE);
        const r0 = Math.floor((e.y - R) / TILE_SIZE), r1 = Math.floor((e.y + R) / TILE_SIZE);
        const v = (e.type === 'gate' && e.faction === 'player') ? 4 : 3;
        for (let r = r0; r <= r1; r++) {
            for (let c = c0; c <= c1; c++) {
                const cx = c * TILE_SIZE + 16, cy = r * TILE_SIZE + 16;
                if (Math.hypot(cx - e.x, cy - e.y) > R + 4) continue;
                put(c, r, v);
            }
        }
    },

    // ---- tile accessors (flat array in the standard map; per-chunk arrays in Infinite Map Mode) ----
    navChunkRT(ccx, ccy) {
        const k = ccx * 100000 + ccy;
        if (this._navLastK === k) return this._navLastRT;
        const rt = this.chunkRT ? this.chunkRT.get(k) : null;
        this._navLastK = k; this._navLastRT = rt;
        return rt;
    },

    navV(i) {
        if (!this.infinite) return this.navBlocked[i];
        const c = i % MAP_COLS, r = (i - c) / MAP_COLS;
        const rt = this.navChunkRT(Math.floor(c / INF_CHUNK), Math.floor(r / INF_CHUNK));
        return (rt && rt.nb) ? rt.nb[(r % INF_CHUNK) * INF_CHUNK + (c % INF_CHUNK)] : 0; // unloaded ground: open
    },

    navC(i) {
        if (!this.infinite) return this.navClear[i];
        const c = i % MAP_COLS, r = (i - c) / MAP_COLS;
        const rt = this.navChunkRT(Math.floor(c / INF_CHUNK), Math.floor(r / INF_CHUNK));
        return (rt && rt.cl) ? rt.cl[(r % INF_CHUNK) * INF_CHUNK + (c % INF_CHUNK)] : 1;
    },

    navIsBig(ent) { return ent.category === 'vehicle' && (ent.radius || 0) >= 16; },

    navPassable(i, ent, big) {
        const v = this.navV(i);
        if (v === 1 || v === 3) return false;
        if (v === 2 && !ent.tracked) return false;
        if (v === 4 && ent.faction !== 'player') return false;
        if (big && !this.navC(i) && v !== 4) return false;
        return true;
    },

    navOpenAt(x, y) {
        if (!this.navBlocked && !this.infinite) return true;
        const c = Math.floor(x / TILE_SIZE), r = Math.floor(y / TILE_SIZE);
        if (c < 0 || r < 0 || c >= MAP_COLS || r >= MAP_ROWS) return false;
        const v = this.navV(r * MAP_COLS + c);
        return v === 0 || v === 4;
    },

    // Straight-line check along the unit's swept width (three parallel samples)
    navLineClear(ent, x0, y0, x1, y1) {
        if (!this.navBlocked && !this.infinite) return true;
        const big = this.navIsBig(ent);
        const dx = x1 - x0, dy = y1 - y0;
        const len = Math.hypot(dx, dy);
        if (len < 1) return true;
        const ux = dx / len, uy = dy / len;
        const w = Math.min(12, (ent.radius || 9) * 0.8);
        const offs = ent.category === 'zombie' ? [0] : [0, -w, w];
        const step = ent.category === 'zombie' ? 14 : 10;
        const sc = Math.floor(x0 / TILE_SIZE), sr = Math.floor(y0 / TILE_SIZE);
        for (const o of offs) {
            const ox = -uy * o, oy = ux * o;
            for (let d = step; d < len; d += step) {
                const c = Math.floor((x0 + ux * d + ox) / TILE_SIZE), r = Math.floor((y0 + uy * d + oy) / TILE_SIZE);
                if (c < 0 || r < 0 || c >= MAP_COLS || r >= MAP_ROWS) return false;
                if (c === sc && r === sr) continue; // never blocked by the tile we're standing on
                if (!this.navPassable(r * MAP_COLS + c, ent, big)) return false;
            }
        }
        return true;
    },

    navNearestPassable(c, r, ent, big, maxRing) {
        for (let ring = 0; ring <= maxRing; ring++) {
            let best = -1, bd = Infinity;
            for (let dr = -ring; dr <= ring; dr++) {
                for (let dc = -ring; dc <= ring; dc++) {
                    if (Math.max(Math.abs(dc), Math.abs(dr)) !== ring) continue;
                    const cc = c + dc, rr = r + dr;
                    if (cc < 0 || rr < 0 || cc >= MAP_COLS || rr >= MAP_ROWS) continue;
                    const i = rr * MAP_COLS + cc;
                    if (!this.navPassable(i, ent, big)) continue;
                    const d = dc * dc + dr * dr;
                    if (d < bd) { bd = d; best = i; }
                }
            }
            if (best >= 0) return best;
        }
        return -1;
    },

    // A* over the tile grid (8-way, no corner cutting) inside a search box (the whole map in the standard game; a
    // window around start & goal in Infinite Map Mode). Returns world waypoints (string-pulled), a partial route
    // toward the closest reachable tile if the goal is sealed off / outside the box, or null.
    navFindPath(ent, sx, sy, tx, ty, maxExpand = 9000) {
        if (!this.navBlocked && !this.infinite) this.buildNavGrid(true);
        const cols = MAP_COLS, rows = MAP_ROWS;
        const big = this.navIsBig(ent);
        const clampC = (v) => Math.max(0, Math.min(cols - 1, v)), clampR = (v) => Math.max(0, Math.min(rows - 1, v));
        const sc = clampC(Math.floor(sx / TILE_SIZE)), sr = clampR(Math.floor(sy / TILE_SIZE));
        const tc = clampC(Math.floor(tx / TILE_SIZE)), tr = clampR(Math.floor(ty / TILE_SIZE));
        // search box
        let bc0 = 0, br0 = 0, bw = cols, bh = rows;
        if (this.infinite) {
            const M = 20, CAP = 160;
            let c0 = Math.min(sc, tc) - M, c1 = Math.max(sc, tc) + M, r0 = Math.min(sr, tr) - M, r1 = Math.max(sr, tr) + M;
            if (c1 - c0 + 1 > CAP) { c0 = Math.round(sc - CAP / 2 + Math.sign(tc - sc) * (CAP / 2 - M)); c1 = c0 + CAP - 1; }
            if (r1 - r0 + 1 > CAP) { r0 = Math.round(sr - CAP / 2 + Math.sign(tr - sr) * (CAP / 2 - M)); r1 = r0 + CAP - 1; }
            bc0 = Math.max(0, c0); br0 = Math.max(0, r0);
            bw = Math.min(cols - 1, c1) - bc0 + 1; bh = Math.min(rows - 1, r1) - br0 + 1;
        }
        const BN = bw * bh;
        const L = (c, r) => (r - br0) * bw + (c - bc0);            // global tile -> local index
        const G = (li) => { const lc = li % bw; return (br0 + (li - lc) / bw) * cols + bc0 + lc; }; // local -> global index
        const inBox = (c, r) => c >= bc0 && r >= br0 && c < bc0 + bw && r < br0 + bh;
        const start = L(sc, sr);
        let goalG = tr * cols + tc;
        let goalExact = true;
        if (!this.navPassable(goalG, ent, big)) {
            goalG = this.navNearestPassable(tc, tr, ent, big, 6);
            goalExact = false;
            if (goalG < 0) return null;
        }
        const gC = goalG % cols, gR = (goalG - gC) / cols;
        const goal = inBox(gC, gR) ? L(gC, gR) : -1;   // goal outside the box: head for the closest point
        if (goal === start) return [[tx, ty]];
        if (!this._navA || this._navA.g.length < BN) {
            const n = Math.max(BN, this.infinite ? 160 * 160 : BN);
            this._navA = { g: new Float32Array(n), from: new Int32Array(n), seen: new Uint32Array(n), closed: new Uint32Array(n),
                heapI: new Int32Array(n * 8), heapF: new Float32Array(n * 8), stamp: 0 };
        }
        const A = this._navA;
        const st = ++A.stamp;
        const avoid = new Set();
        if (ent.nav && ent.nav.avoid) for (const [ti, until] of ent.nav.avoid) if (until > this.elapsedTime && ti !== goalG) avoid.add(ti);
        const H = (li) => { const lc = li % bw, lr = (li - lc) / bw; const dx = Math.abs(bc0 + lc - gC), dy = Math.abs(br0 + lr - gR); return (dx + dy) + (1.4142 - 2) * Math.min(dx, dy); };
        let hs = 0;
        const push = (i, f) => {
            if (hs >= A.heapI.length) return;
            let k = hs++;
            while (k > 0) { const pk = (k - 1) >> 1; if (A.heapF[pk] <= f) break; A.heapI[k] = A.heapI[pk]; A.heapF[k] = A.heapF[pk]; k = pk; }
            A.heapI[k] = i; A.heapF[k] = f;
        };
        const pop = () => {
            const top = A.heapI[0];
            const li = A.heapI[--hs], lf = A.heapF[hs];
            let k = 0;
            while (true) {
                let c = 2 * k + 1;
                if (c >= hs) break;
                if (c + 1 < hs && A.heapF[c + 1] < A.heapF[c]) c++;
                if (A.heapF[c] >= lf) break;
                A.heapI[k] = A.heapI[c]; A.heapF[k] = A.heapF[c]; k = c;
            }
            A.heapI[k] = li; A.heapF[k] = lf;
            return top;
        };
        A.g[start] = 0; A.seen[start] = st; A.from[start] = -1;
        push(start, H(start));
        let bestI = start, bestH = H(start), expanded = 0, found = false;
        const DC = [1, -1, 0, 0, 1, 1, -1, -1], DR = [0, 0, 1, -1, 1, -1, 1, -1];
        const pass = (c, r) => this.navPassable(r * cols + c, ent, big);
        while (hs > 0) {
            const cur = pop();
            if (A.closed[cur] === st) continue;
            A.closed[cur] = st;
            if (cur === goal) { found = true; break; }
            const hcur = H(cur);
            if (hcur < bestH) { bestH = hcur; bestI = cur; }
            if (++expanded > maxExpand) break;
            const lc = cur % bw, lr = (cur - lc) / bw;
            const cc = bc0 + lc, cr = br0 + lr;
            for (let k = 0; k < 8; k++) {
                const nc = cc + DC[k], nr = cr + DR[k];
                if (!inBox(nc, nr)) continue;
                const ni = L(nc, nr);
                if (A.closed[ni] === st) continue;
                const ng0 = nr * cols + nc;
                if (ni !== goal && (!pass(nc, nr) || avoid.has(ng0))) continue;
                if (k >= 4) {
                    // diagonal: both orthogonal neighbours must be open (no cutting building corners)
                    if (!pass(nc, cr) || !pass(cc, nr)) continue;
                }
                const ng = A.g[cur] + (k >= 4 ? 1.4142 : 1);
                if (A.seen[ni] === st && ng >= A.g[ni]) continue;
                A.seen[ni] = st; A.g[ni] = ng; A.from[ni] = cur;
                push(ni, ng + H(ni) * 1.05);
            }
        }
        const end = found ? goal : bestI;
        if (end === start) return null;
        const tiles = [];
        for (let i = end; i !== -1 && tiles.length < 4000; i = A.from[i]) tiles.push(G(i));
        tiles.reverse();
        const pts = tiles.map(i => [(i % cols) * TILE_SIZE + 16, Math.floor(i / cols) * TILE_SIZE + 16]);
        if (found && goalExact) pts[pts.length - 1] = [tx, ty];
        // string-pull: keep only the waypoints needed to stay on clear ground
        const out = [];
        let anchorX = sx, anchorY = sy, idx = 0;
        while (idx < pts.length) {
            let far = idx;
            for (let j = Math.min(pts.length - 1, idx + 14); j > idx; j--) {
                if (this.navLineClear(ent, anchorX, anchorY, pts[j][0], pts[j][1])) { far = j; break; }
            }
            out.push(pts[far]);
            anchorX = pts[far][0]; anchorY = pts[far][1];
            idx = far + 1;
        }
        return out;
    },

    navTakeBudget(ent) {
        if (!this._navBudget) return true;
        const k = ent.faction === 'player' ? 'player' : (ent.category === 'zombie' ? 'zombie' : 'other');
        if (this._navBudget[k] <= 0) return false;
        this._navBudget[k]--;
        return true;
    },

    // Movement entry point used by every system. Air units fly straight; ground units walk straight when the way is
    // clear and otherwise follow a cached A* route, with stuck detection & re-routing.
    moveEntityToward(ent, tx, ty, dt) {
        ent._movedAt = this.elapsedTime;
        ent._goalDist = Math.hypot(tx - ent.x, ty - ent.y);
        ent._goalFrame = this.frameStamp;
        if (ent.isAir || ent.landed || (!this.navBlocked && !this.infinite) || ent.category === 'building') return this.steerToward(ent, tx, ty, dt);
        const isZ = ent.category === 'zombie';
        const big = this.navIsBig(ent);
        let n = ent.nav;
        if (!n) n = ent.nav = { path: null, i: 0, gx: 0, gy: 0, losT: 0, los: true, retryT: 0, chkT: 0, lx: ent.x, ly: ent.y, stuck: 0, unstuck: 0, sideT: 0, side: 0, avoid: [], forcePath: false };
        const dist = Math.hypot(tx - ent.x, ty - ent.y);
        if (n.path && Math.hypot(n.gx - tx, n.gy - ty) > (isZ ? 96 : 40)) n.path = null;
        if (n.retryT > 0) n.retryT -= dt;
        if (!n.path) {
            n.losT -= dt;
            if (n.losT <= 0 || n.forcePath) {
                n.losT = isZ ? 0.8 + Math.random() * 0.5 : 0.3;
                n.los = !n.forcePath && (dist < 30 || this.navLineClear(ent, ent.x, ent.y, tx, ty));
            }
            if (!n.los && n.retryT <= 0 && this.navTakeBudget(ent)) {
                const path = this.navFindPath(ent, ent.x, ent.y, tx, ty, isZ ? 2500 : 9000);
                n.forcePath = false;
                if (path && path.length) { n.path = path; n.i = 0; n.gx = tx; n.gy = ty; }
                else { n.retryT = isZ ? 3 : 1.2; n.losT = 0; }
            }
        }
        let wx = tx, wy = ty;
        if (n.path) {
            const reach = big ? 22 : 14;
            while (n.i < n.path.length && Math.hypot(n.path[n.i][0] - ent.x, n.path[n.i][1] - ent.y) < reach) n.i++;
            if (n.i >= n.path.length) { n.path = null; n.losT = 0; }
            else { wx = n.path[n.i][0]; wy = n.path[n.i][1]; }
        }
        // stuck detection — only while genuinely trying to travel somewhere
        n.chkT += dt;
        // Update 7: compare against the distance the unit's physics actually tried to cover (accelerating or pivoting
        // vehicles are not "stuck")
        n.intent = (n.intent || 0) + (ent._fs !== undefined && this.getMoveProfile(ent) ? ent._fs : (ent.speed || 40)) * dt;
        if (n.chkT >= 0.6) {
            const moved = Math.hypot(ent.x - n.lx, ent.y - n.ly);
            const want = this.getMoveProfile(ent) ? n.intent : (ent.speed || 40) * n.chkT;
            n.intent = 0;
            const immobile = (ent.fuelMax && ent.fuel <= 0 && this.settings.fuel);
            const far = dist > (isZ ? 90 : 26);
            if (!immobile && far && !ent._turning && want > 1.5 && moved < want * 0.2) n.stuck++;
            else { n.stuck = 0; if (moved > want * 0.5) n.unstuck = 0; }
            n.lx = ent.x; n.ly = ent.y; n.chkT = 0;
            if (n.stuck >= 2) {
                n.stuck = 0;
                n.unstuck++;
                // remember what blocked us so the new route goes another way
                const ang = Math.atan2(wy - ent.y, wx - ent.x);
                const ac = Math.floor((ent.x + Math.cos(ang) * 26) / TILE_SIZE), ar = Math.floor((ent.y + Math.sin(ang) * 26) / TILE_SIZE);
                if (ac >= 0 && ar >= 0 && ac < MAP_COLS && ar < MAP_ROWS) {
                    n.avoid.push([ar * MAP_COLS + ac, this.elapsedTime + 10]);
                    if (n.avoid.length > 6) n.avoid.shift();
                }
                n.path = null; n.forcePath = true; n.retryT = 0; n.los = false;
                if (n.unstuck >= 2) {
                    // still wedged: back off sideways toward whichever side is open, then re-route
                    let side = ang + Math.PI / 2;
                    if (!this.navOpenAt(ent.x + Math.cos(side) * 30, ent.y + Math.sin(side) * 30)) side = ang - Math.PI / 2;
                    if (!this.navOpenAt(ent.x + Math.cos(side) * 30, ent.y + Math.sin(side) * 30)) side = ang + Math.PI;
                    n.side = side;
                    n.sideT = 0.6;
                }
                if (n.unstuck >= 6) n.unstuck = 0;
            }
        }
        if (n.sideT > 0) {
            n.sideT -= dt;
            wx = ent.x + Math.cos(n.side) * 40;
            wy = ent.y + Math.sin(n.side) * 40;
        }
        this.steerToward(ent, wx, wy, dt);
    }
});
