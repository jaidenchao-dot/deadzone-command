'use strict';
// Zombie surge waves and horde formation
defineGameMethods({
    // ========================================================================
    // UPDATE 3: ORGANIZED ZOMBIE WAVE DIRECTOR
    // ========================================================================
    triggerZombieSurge() {
        const hives = this.entities.filter(e => e.category === 'hive');
        if (hives.length === 0 && !this.infinite) return;

        const w = this.surgeWave;
        // Pick a wave theme — first two waves are fixed introductions, later waves rotate without repeats
        let theme;
        if (w === 1) theme = WAVE_TYPES[0];
        else if (w === 2) theme = WAVE_TYPES[1];
        else {
            const eligible = WAVE_TYPES.filter(t => t.minWave <= w && t.key !== this.lastWaveTheme);
            // Late game favours the nastiest themes
            const pool = eligible.concat(eligible.filter(t => t.minWave >= 5 && w >= 8));
            theme = pool[Math.floor(Math.random() * pool.length)];
        }
        this.lastWaveTheme = theme.key;

        // Sources: hives (and subway tunnels for Tunnel Breach)
        let sources = hives.map(h => ({ x: h.x, y: h.y, r: h.radius, hiveId: h.id, label: h.name }));
        if (theme.subways) {
            const subs = this.cityProps.filter(pr => pr.type === 'subway').map(pr => ({ x: pr.x, y: pr.y, r: 24, hiveId: null, label: 'SUBWAY TUNNEL' }));
            if (subs.length > 0) sources = subs;
        }
        if (this.infinite) {
            // Update 7: hordes come from the hives nearest the player's base — or, if none are close, out of the
            // unexplored sprawl beyond the loaded area — and march in; they never pop up next to your troops
            const hqP = this.getHqOrAnyPlayer();
            if (hqP) {
                sources.sort((a, b) => Math.hypot(a.x - hqP.x, a.y - hqP.y) - Math.hypot(b.x - hqP.x, b.y - hqP.y));
                sources = sources.filter(sr => Math.hypot(sr.x - hqP.x, sr.y - hqP.y) < 9000).slice(0, 6);
                if (sources.length === 0) {
                    const R = (this.infRadius('load') + 0.3) * INF_CHUNK * TILE_SIZE;
                    for (let k = 0; k < 3; k++) {
                        const ang = Math.random() * Math.PI * 2;
                        sources.push({ x: hqP.x + Math.cos(ang) * R, y: hqP.y + Math.sin(ang) * R, r: 24, hiveId: null, label: 'THE OUTSKIRTS' });
                    }
                }
            }
        }
        for (let i = sources.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [sources[i], sources[j]] = [sources[j], sources[i]];
        }

        // Escalating budget, softened if the city is already crawling with infected
        const active = this.zombieCount !== undefined ? this.zombieCount : this.entities.filter(e => e.category === 'zombie').length;
        // Update 4: hordes scale with the 10x infestation — ramping from ~1.75x at wave 1 to 4x by wave 10
        const waveMult = Math.min(4, 1.5 + 0.25 * w);
        let budget = Math.min(380, Math.round((14 + (w - 1) * 5 + Math.floor(w * w * 0.15)) * waveMult));
        if (active > HIVE_POP_CAP * 2) budget = Math.round(budget * 0.5);
        budget = Math.max(4, Math.round(budget * this.diffMult('wave')));
        const groupsN = Math.max(1, Math.min(4, sources.length, 1 + Math.floor((w - 1) / 3)));

        const hq = this.entities.find(e => e.faction === 'player' && e.type === 'hq');
        let total = 0;
        for (let gi = 0; gi < groupsN; gi++) {
            const src = sources[gi];
            const types = this.composeWave(theme, budget / groupsN, w);
            if (types.length === 0) continue;
            // Targets: mostly the HQ; some groups flank the nearest player structure to their source
            let target = hq;
            if (gi > 0 || Math.random() < 0.35) {
                let best = null, bestD = Infinity;
                for (const e of this.entities) {
                    if (e.faction !== 'player' || e.category !== 'building' || e.type === 'wall' || e.type === 'gate') continue;
                    const d = Math.hypot(e.x - src.x, e.y - src.y);
                    if (d < bestD) { bestD = d; best = e; }
                }
                if (best) target = best;
            }
            if (!target) target = this.entities.find(e => e.faction === 'player');
            if (!target) return;
            this.createWaveGroup(theme, src, types, target, w);
            total += types.length;
        }

        sfx.playZombieGroan();
        this.showRadio(`⚠️ WAVE #${w}: ${theme.name} — ${groupsN} ASSAULT GROUP(S), ~${total} INFECTED MUSTERING!`);
    },

    composeWave(theme, budget, w) {
        const entries = Object.entries(theme.mix).filter(([t]) => !ZOMBIE_DEFS[t].unlockWave || ZOMBIE_DEFS[t].unlockWave <= w)
            .map(([t, wt]) => {
                // Mutated strains grow more common the further the infestation progresses
                const unlock = ZOMBIE_DEFS[t].unlockWave || 0;
                const mutBoost = unlock ? 1 + Math.max(0, w - unlock) * 0.25 : 1;
                return [t, wt * mutBoost];
            });
        if (entries.length === 0) return [];
        const totalW = entries.reduce((s, e) => s + e[1], 0);
        const maxAbom = w >= 7 ? 1 + Math.floor((w - 7) / 4) : 0;
        const types = [];
        let spent = 0, aboms = 0, guard = 0;
        while (spent < budget && guard++ < 300) {
            let roll = Math.random() * totalW;
            let pick = entries[0][0];
            for (const [t, wt] of entries) {
                roll -= wt;
                if (roll <= 0) { pick = t; break; }
            }
            if (pick === 'abomination') {
                if (aboms >= maxAbom) continue;
                aboms++;
            }
            const cost = WAVE_COST[pick] || 1;
            if (spent + cost > budget + 1 && types.length > 0) {
                if (budget - spent >= 1) { types.push('walker'); spent += 1; continue; }
                break;
            }
            types.push(pick);
            spent += cost;
        }
        // Heavy/slow types lead the column so the pack moves as one
        return types;
    },

    createWaveGroup(theme, src, types, target, waveNum) {
        const heading = Math.atan2(target.y - src.y, target.x - src.x);
        const rallyX = src.x + Math.cos(heading) * (src.r + 70);
        const rallyY = src.y + Math.sin(heading) * (src.r + 70);
        const speeds = types.map(t => ZOMBIE_DEFS[t].speed).sort((a, b) => a - b);
        const speed = theme.fast ? Math.max(70, speeds[Math.floor(speeds.length / 2)] * 0.8) : Math.max(38, speeds[0] * 0.95);
        const grp = {
            id: this.nextWaveGroupId++,
            waveNum,
            theme: theme.key,
            name: theme.name,
            formation: theme.formation,
            sourceX: src.x, sourceY: src.y, sourceR: src.r, sourceHiveId: src.hiveId,
            anchorX: rallyX, anchorY: rallyY,
            heading,
            speed,
            targetId: target.id,
            queue: types.slice(),
            spawned: 0,
            spawnTimer: 0,
            musterTimer: 0,
            phase: 'muster',
            members: 0
        };
        this.waveGroups.push(grp);
        return grp;
    },

    // Update 6: every wave marches as one dense HORDE — no military wedges, lines or columns. Slots are a packed
    // sunflower cluster (slightly longer front-to-back), close enough to look like a single mass but spaced so
    // individual zombies don't stack on one spot.
    getWaveSlotOffset(formation, i) {
        const r = HORDE_SPACING * Math.sqrt(i + 0.35);
        const a = i * 2.39996 + 0.6;
        return { f: Math.cos(a) * r * 1.18, l: Math.sin(a) * r * 0.88 };
    },

    // Re-deal the slots when a horde sets off: heavy bruisers take the leading edge, ranged spitters & screamers
    // shelter in the core / rear, the common infected fill the rest.
    organizeHorde(g, members) {
        if (!members || members.length === 0) return;
        const offs = [];
        for (let i = 0; i < members.length; i++) offs.push(this.getWaveSlotOffset('horde', i));
        offs.sort((a, b) => b.f - a.f);
        const rank = { abomination: 0, brute: 1, bloater: 2, runner: 3, stalker: 3, walker: 4, screamer: 6, spitter: 7 };
        const sorted = members.slice().sort((a, b) => (rank[a.type] ?? 4) - (rank[b.type] ?? 4));
        sorted.forEach((z, i) => { z.slotF = offs[i].f; z.slotL = offs[i].l; });
    },

    getWaveSlotPosition(grp, z) {
        const cosH = Math.cos(grp.heading), sinH = Math.sin(grp.heading);
        const f = z.slotF || 0, l = z.slotL || 0;
        let x = grp.anchorX + cosH * f - sinH * l;
        let y = grp.anchorY + sinH * f + cosH * l;
        // Update 6: slots that fall on a building / wall / water squeeze back toward the horde's centre, so the mass
        // flows around obstacles instead of zombies piling against walls
        if (!this.navOpenAt(x, y)) {
            for (let k = 1; k <= 4; k++) {
                const t = k / 4;
                const nx = x + (grp.anchorX - x) * t, ny = y + (grp.anchorY - y) * t;
                if (this.navOpenAt(nx, ny)) { x = nx; y = ny; break; }
                if (k === 4) { x = grp.anchorX; y = grp.anchorY; }
            }
        }
        return { x, y };
    },

    updateWaveGroups(dt) {
        if (this.waveGroups.length === 0) return;
        // Update 4: one pass over the entity list builds every group's member list
        const membersByGroup = new Map();
        for (const e of this.entities) {
            if (e.category !== 'zombie' || !e.waveGroupId) continue;
            let arr = membersByGroup.get(e.waveGroupId);
            if (!arr) { arr = []; membersByGroup.set(e.waveGroupId, arr); }
            arr.push(e);
        }
        const counts = { get: (id) => (membersByGroup.get(id) || []).length };

        for (let i = this.waveGroups.length - 1; i >= 0; i--) {
            const g = this.waveGroups[i];
            g.members = counts.get(g.id) || 0;

            // Source hive destroyed mid-muster: the remaining spawns are cancelled
            if (g.sourceHiveId && g.queue.length > 0 && !this.entities.some(e => e.id === g.sourceHiveId)) {
                g.queue = [];
            }

            if (g.phase === 'muster') {
                g.spawnTimer -= dt;
                if (g.queue.length > 0 && g.spawnTimer <= 0) {
                    // Update 4: large hordes muster in ~6s instead of trickling out one at a time
                    g.spawnTimer = Math.min(0.22, 6 / Math.max(1, g.queue.length + g.spawned));
                    const type = g.queue.shift();
                    for (let tries = 0; tries < 6; tries++) {
                        const ang = Math.random() * Math.PI * 2;
                        const sx = g.sourceX + Math.cos(ang) * (g.sourceR + 16);
                        const sy = g.sourceY + Math.sin(ang) * (g.sourceR + 16);
                        if (!this.isSpawnableTile(Math.floor(sx / TILE_SIZE), Math.floor(sy / TILE_SIZE))) continue;
                        const z = this.createZombie(type, sx, sy, true);
                        const off = this.getWaveSlotOffset(g.formation, g.spawned);
                        z.waveGroupId = g.id;
                        z.slotF = off.f;
                        z.slotL = off.l;
                        g.spawned++;
                        g.members++;
                        break;
                    }
                } else if (g.queue.length === 0) {
                    g.musterTimer += dt;
                    if (g.musterTimer >= 3) {
                        g.phase = 'march';
                        this.organizeHorde(g, membersByGroup.get(g.id) || []);
                    }
                }
                if (g.queue.length === 0 && g.members === 0 && g.musterTimer > 0.5) this.waveGroups.splice(i, 1);
                continue;
            }

            if (g.members === 0) {
                this.waveGroups.splice(i, 1);
                continue;
            }

            // Target lost? Fall back to the HQ (or any player asset)
            let tgt = this.getEntityById(g.targetId);
            if (!tgt) {
                tgt = this.entities.find(e => e.faction === 'player' && e.type === 'hq') || this.entities.find(e => e.faction === 'player');
                g.targetId = tgt ? tgt.id : null;
                if (!tgt) continue;
            }

            if (g.phase === 'march') {
                // Measure how far the pack has strung out; the anchor waits for stragglers
                let lagSum = 0, n = 0;
                for (const e of (membersByGroup.get(g.id) || [])) {
                    const slot = this.getWaveSlotPosition(g, e);
                    lagSum += Math.hypot(slot.x - e.x, slot.y - e.y);
                    n++;
                }
                const avgLag = n ? lagSum / n : 0;
                const dx = tgt.x - g.anchorX, dy = tgt.y - g.anchorY;
                const dist = Math.hypot(dx, dy);
                if (dist < 240) {
                    g.phase = 'assault';
                    continue;
                }
                // Update 6: the horde's centre follows a street route (A*) instead of a straight line through blocks;
                // re-planned only every few seconds or when the target moves away
                g.pathT = (g.pathT || 0) - dt;
                if (!g.path || g.pathT <= 0 || Math.hypot((g.pathGX || 0) - tgt.x, (g.pathGY || 0) - tgt.y) > 160) {
                    g.pathT = 6;
                    g.pathGX = tgt.x; g.pathGY = tgt.y;
                    const pth = this.navFindPath({ radius: 10, category: 'zombie', faction: 'zombie' }, g.anchorX, g.anchorY, tgt.x, tgt.y, 5000);
                    g.path = pth && pth.length ? pth : null;
                    g.pathI = 0;
                }
                let wx = tgt.x, wy = tgt.y;
                if (g.path) {
                    while (g.pathI < g.path.length && Math.hypot(g.path[g.pathI][0] - g.anchorX, g.path[g.pathI][1] - g.anchorY) < 20) g.pathI++;
                    if (g.pathI < g.path.length) { wx = g.path[g.pathI][0]; wy = g.path[g.pathI][1]; }
                    else g.path = null;
                }
                const sdx = wx - g.anchorX, sdy = wy - g.anchorY;
                const sd = Math.max(1, Math.hypot(sdx, sdy));
                // turn gradually so the mass wheels around corners instead of snapping
                const want = Math.atan2(sdy, sdx);
                let dh = want - g.heading;
                while (dh > Math.PI) dh -= Math.PI * 2;
                while (dh < -Math.PI) dh += Math.PI * 2;
                g.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, dh));
                if (avgLag < 120) {
                    const stepLen = Math.min(sd, g.speed * dt);
                    g.anchorX += (sdx / sd) * stepLen;
                    g.anchorY += (sdy / sd) * stepLen;
                }
            }
        }
    }
});
