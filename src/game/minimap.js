'use strict';
// Minimap / radar
defineGameMethods({
    renderMinimap() {
        const mctx = this.mctx;
        const mw = this.minimap.width;
        const mh = this.minimap.height;
        mctx.fillStyle = '#06090d';
        mctx.fillRect(0, 0, mw, mh);

        if (!this.terrain || this.terrain.length === 0) return;

        // Update 7: in Infinite Map Mode the radar shows a 128-tile window around the camera
        const M = this.minimapFrame();
        const sx = mw / M.cols;
        const sy = mh / M.rows;

        for (let r = M.r0; r < M.r0 + M.rows; r++) {
            const tRow = this.terrain[r], fRow = this.fog[r];
            if (!tRow || !fRow) continue;
            for (let c = M.c0; c < M.c0 + M.cols; c++) {
                const t = tRow[c];
                if (t === undefined) continue;
                if (t === 'water') {
                    mctx.fillStyle = '#0e1d2b';
                    mctx.fillRect((c - M.c0) * sx, (r - M.r0) * sy, sx + 0.5, sy + 0.5);
                    continue;
                }
                if (!fRow[c]) continue;
                mctx.fillStyle = t === 'road' ? '#363d47' :
                                 (t === 'park' ? '#243622' :
                                 (t === 'rubble' ? '#4f433c' : '#262c34'));
                mctx.fillRect((c - M.c0) * sx, (r - M.r0) * sy, sx + 0.5, sy + 0.5);
            }
        }

        // City skyscrapers & buildings on radar
        for (const b of this.cityStructures) {
            mctx.fillStyle = '#57606a';
            mctx.fillRect((b.c - M.c0) * sx, (b.r - M.r0) * sy, b.w * sx, b.h * sy);
        }

        // Subtle District Borders on Minimap
        for (const d of this.districts) {
            mctx.strokeStyle = d.status === 'reclaimed' ? 'rgba(63, 185, 80, 0.5)' : 'rgba(248, 81, 73, 0.35)';
            mctx.lineWidth = 1;
            mctx.strokeRect((d.c1 - M.c0) * sx, (d.r1 - M.r0) * sy, (d.c2 - d.c1 + 1) * sx, (d.r2 - d.r1 + 1) * sy);
        }

        for (const ent of this.entities) {
            const mx = ((ent.x - M.ox) / M.W) * mw;
            const my = ((ent.y - M.oy) / M.H) * mh;

            if (ent.category === 'depot') {
                mctx.fillStyle = '#f2cc60';
                mctx.fillRect(mx - 2, my - 2, 4, 4);
            } else if (this.isMemoryEntity(ent)) {
                continue; // drawn from last-known memory below (Update 3 fog fix)
            } else if (ent.faction === 'player') {
                mctx.fillStyle = ent.category === 'building' ? '#58a6ff' : (ent.infected ? '#a6e22e' : '#3fb950');
                const sz = ent.category === 'building' ? 3 : 2;
                mctx.fillRect(mx - sz / 2, my - sz / 2, sz, sz);
            } else if (ent.faction === 'zombie') {
                const tc = Math.floor(ent.x / TILE_SIZE);
                const tr = Math.floor(ent.y / TILE_SIZE);
                if (this.fog[tr] && this.fog[tr][tc] === 2) {
                    mctx.fillStyle = '#f85149';
                    mctx.fillRect(mx - 1, my - 1, 2, 2);
                }
            } else if (ent.faction === 'merc' || ent.faction === 'survivor' || ent.category === 'shelter') {
                const tc = Math.floor(ent.x / TILE_SIZE);
                const tr = Math.floor(ent.y / TILE_SIZE);
                const f = this.fog[tr] ? this.fog[tr][tc] : 0;
                if (ent.category === 'merc' && f === 2) {
                    mctx.fillStyle = '#ffa657';
                    mctx.fillRect(mx - 1, my - 1, 2, 2);
                } else if (ent.category === 'survivor' && f === 2) {
                    mctx.fillStyle = '#56d4dd';
                    mctx.fillRect(mx - 1, my - 1, 2, 2);
                }
            }
        }

        // Update 3 FOG FIX: hives, bandit structures & shelters at their LAST KNOWN positions only
        for (const snap of this.knownStructures.values()) {
            const mx = ((snap.x - M.ox) / M.W) * mw;
            const my = ((snap.y - M.oy) / M.H) * mh;
            if (snap.category === 'hive') {
                mctx.fillStyle = '#ff7b72';
                mctx.beginPath();
                mctx.arc(mx, my, 3.6, 0, Math.PI * 2);
                mctx.fill();
            } else if (snap.category === 'mercstruct') {
                mctx.fillStyle = '#ffa657';
                mctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
            } else if (snap.category === 'shelter' && !snap.opened) {
                mctx.fillStyle = '#56d4dd';
                mctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
            } else if (snap.abandoned) {
                mctx.fillStyle = '#8b949e';
                mctx.fillRect(mx - 1, my - 1, 2, 2);
            }
        }

        // Survivor intel zones on radar (estimates; confirmed signals pinpointed)
        if (this.showIntel) {
            for (const sig of this.survivorIntel) {
                if (sig.status === 'unknown') {
                    mctx.strokeStyle = 'rgba(86, 212, 221, 0.8)';
                    mctx.lineWidth = 1;
                    mctx.setLineDash([2, 2]);
                    mctx.beginPath();
                    mctx.arc(((sig.x - M.ox) / M.W) * mw, ((sig.y - M.oy) / M.H) * mh, Math.max(3, (sig.radius / M.W) * mw), 0, Math.PI * 2);
                    mctx.stroke();
                    mctx.setLineDash([]);
                } else if (sig.status === 'confirmed') {
                    mctx.fillStyle = '#56d4dd';
                    mctx.beginPath();
                    mctx.arc(((sig.trueX - M.ox) / M.W) * mw, ((sig.trueY - M.oy) / M.H) * mh, 2.6, 0, Math.PI * 2);
                    mctx.fill();
                }
            }
        }

        // Viewport Frame
        const z = this.cam.zoom || 1.0;
        const vx = ((this.cam.x - M.ox) / M.W) * mw;
        const vy = ((this.cam.y - M.oy) / M.H) * mh;
        const vw = ((this.canvas.width / z) / M.W) * mw;
        const vh = ((this.canvas.height / z) / M.H) * mh;
        mctx.strokeStyle = '#ffffff';
        mctx.lineWidth = 1.2;
        mctx.strokeRect(vx, vy, vw, vh);
    }
});
