'use strict';
// Infinite Map Mode: chunk generation, streaming / level-of-detail, infinite nav & fog, sectors
defineGameMethods({
    // ========================================================================
    // UPDATE 7: INFINITE MAP MODE — PLAYER-CENTERED CHUNK STREAMING
    // ------------------------------------------------------------------------
    // The world is cut into 32x32-tile chunks generated deterministically from a seed. Around every group of player
    // forces three nested rings are maintained (all in chunks, Chebyshev distance):
    //   ACTIVE  (default 1): full AI for everything; idle zombies only exist as live entities here
    //   RENDER  (default 2): full-detail drawing; loaded chunks beyond it draw in low detail
    //   LOAD    (default 3): terrain, structures, navigation & collision exist; hordes travel through it
    // Beyond LOAD a chunk keeps only a tiny persistent record (generated flag, explored fog, frozen idle zombies).
    // Hives, wave hordes, zombies converging on an alert, bandits, survivors, crates etc. are never deleted:
    // outside the ACTIVE ring they run a cheap low-frequency update (or simply wait) and resume full AI when
    // player forces come near. Rings unload with one chunk of hysteresis so nothing flickers on chunk borders.
    // ========================================================================
    infRadius(kind) {
        const st = this.settings || {};
        if (kind === 'active') return Math.max(1, Math.min(2, +st.infActive || 1));
        if (kind === 'render') return Math.max(1, Math.min(4, +st.infRender || 2));
        return Math.max(2, Math.min(5, +st.infLoad || 3));
    },

    chunkKey(cx, cy) { return cx * 100000 + cy; },

    chunkCoordsOfKey(k) { const cy = ((k % 100000) + 100000) % 100000; return { cx: (k - cy) / 100000, cy }; },

    chunkKeyAt(x, y) { return this.chunkKey(Math.floor(x / (INF_CHUNK * TILE_SIZE)), Math.floor(y / (INF_CHUNK * TILE_SIZE))); },

    isActivePos(x, y) { return !this.infinite || (this.activeChunks && this.activeChunks.has(this.chunkKeyAt(x, y))); },

    infRng(cx, cy, salt) {
        let a = (this.infSeed ^ Math.imul(cx + 7919, 73856093) ^ Math.imul(cy + 104729, 19349663) ^ Math.imul(salt + 1, 83492791)) >>> 0;
        return () => {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    },

    infChunkDist(cx, cy) { return Math.max(Math.abs(cx - INF_ORIGIN_CHUNK), Math.abs(cy - INF_ORIGIN_CHUNK)); },

    chunkBiome(cx, cy) {
        if (this.infChunkDist(cx, cy) <= 1) return 'lz';
        const v = this.infRng(Math.floor(cx / 2), Math.floor(cy / 2), 7)();   // biomes come in 2x2-chunk patches
        return v < 0.32 ? 'downtown' : (v < 0.62 ? 'residential' : (v < 0.86 ? 'industrial' : 'park'));
    },

    initInfiniteWorld() {
        this.terrain = [];
        this.blockedGrid = [];
        this.fog = [];
        this.cityStructures = [];
        this.cityProps = [];
        this.districts = [];
        this.chunks = new Map();
        this.chunkRT = new Map();
        this.activeChunks = new Set();
        this.renderChunks = new Set();
        this._loadQueue = [];
        this._fogVis = [];
        this._infT = 0;
        this._navLastK = null; this._navLastRT = null;
        this._navKey = null;
        this.navBlocked = null; this.navClear = null;
        this._districtIndex = new Map();
        if (!this.infSeed) this.infSeed = (Math.random() * 2147483647) | 0;
    },

    // ---- deterministic terrain for one chunk: 0 plaza · 1 road · 2 sidewalk · 3 park · 4 rubble ----
    genChunkTerrain(cx, cy) {
        const N = INF_CHUNK;
        const rnd = this.infRng(cx, cy, 1);
        const biome = this.chunkBiome(cx, cy);
        const tile = new Uint8Array(N * N);
        const minorV = biome !== 'park' && biome !== 'lz' && rnd() < 0.72, minorH = biome !== 'park' && biome !== 'lz' && rnd() < 0.72;
        const isRoad = (lc, lr) => lc <= 2 || lr <= 2 || (minorV && (lc === 16 || lc === 17)) || (minorH && (lr === 16 || lr === 17));
        for (let lr = 0; lr < N; lr++) {
            for (let lc = 0; lc < N; lc++) {
                let t = 0;
                if (isRoad(lc, lr)) t = 1;
                else if (lc === 3 || lr === 3 || lc === N - 1 || lr === N - 1 ||
                         (minorV && (lc === 15 || lc === 18)) || (minorH && (lr === 15 || lr === 18))) t = 2;
                else if (biome === 'park' || biome === 'lz') t = (biome === 'lz' && lc > 8 && lc < 26 && lr > 8 && lr < 26) ? 0 : 3;
                tile[lr * N + lc] = t;
            }
        }
        // building blocks between the streets
        const spans = (minor) => minor ? [[4, 14], [19, 30]] : [[4, 30]];
        const xs = spans(minorV), ys = spans(minorH);
        const md = this.mapDef || MAP_DEFS.manhattan;
        const occ = new Uint8Array(N * N);
        const structs = [];
        const kinds = {
            downtown: ['skyscraper', 'skyscraper', 'office', 'office'],
            residential: ['brownstone', 'brownstone', 'office'],
            industrial: ['warehouse', 'warehouse', 'office'],
            park: ['brownstone'], lz: []
        }[biome];
        const palettes = {
            skyscraper: [['#24303e', '#344457'], ['#202b38', '#2f3f52'], ['#1e2938', '#2f4057'], ['#283545', '#3a4c63']],
            office: [['#373e47', '#48525e'], ['#3d3a36', '#524e48'], ['#2b3847', '#3b4c61'], ['#3b3934', '#4f4c45']],
            brownstone: [['#4d322c', '#634139'], ['#54362f', '#6b453c'], ['#473b35', '#5c4d45']],
            warehouse: [['#2f353d', '#3f4752'], ['#30363d', '#424a54'], ['#383430', '#4a4540']]
        };
        const generic = ['TOWER', 'PLAZA', 'ANNEX', 'LOFTS', 'EXCHANGE', 'DEPOT', 'HALL', 'COURT', 'TERMINAL', 'WORKS', 'HOUSE', 'CENTER'];
        const pre = ['NORTH', 'GRAND', 'UNION', 'HARBOR', 'LIBERTY', 'CENTRAL', 'EAST', 'WEST', 'METRO', 'RIVER', 'IRON', 'PARK'];
        const maxB = biome === 'park' ? 1 : (biome === 'lz' ? 0 : 3);
        for (const [x0, x1] of xs) {
            for (const [y0, y1] of ys) {
                let placed = 0;
                for (let tries = 0; tries < 14 && placed < maxB; tries++) {
                    const kind = kinds[Math.floor(rnd() * kinds.length)];
                    if (!kind) break;
                    const big = kind === 'skyscraper' || kind === 'warehouse';
                    const w = Math.min(x1 - x0 + 1, (big ? 4 : 3) + Math.floor(rnd() * (big ? 4 : 3)));
                    const h = Math.min(y1 - y0 + 1, (big ? 4 : 3) + Math.floor(rnd() * 3));
                    if (w < 3 || h < 3) continue;
                    const lc = x0 + Math.floor(rnd() * Math.max(1, (x1 - x0 + 2 - w)));
                    const lr = y0 + Math.floor(rnd() * Math.max(1, (y1 - y0 + 2 - h)));
                    if (lc + w - 1 > x1 || lr + h - 1 > y1) continue;
                    // keep 2-tile alleys between buildings so the block stays walkable
                    let ok = true;
                    for (let rr = lr - 2; rr < lr + h + 2 && ok; rr++)
                        for (let cc = lc - 2; cc < lc + w + 2; cc++)
                            if (rr >= 0 && cc >= 0 && rr < N && cc < N && occ[rr * N + cc]) { ok = false; break; }
                    if (!ok) continue;
                    for (let rr = lr; rr < lr + h; rr++) for (let cc = lc; cc < lc + w; cc++) occ[rr * N + cc] = 1;
                    const pal = palettes[kind][Math.floor(rnd() * palettes[kind].length)];
                    let wall = pal[0], roof = pal[1];
                    if (md.wallMix) { wall = mixHex(wall, md.wallMix[0], md.wallMix[1]); roof = mixHex(roof, md.wallMix[0], md.wallMix[1] * 0.8); }
                    const baseH = kind === 'skyscraper' ? 24 + rnd() * 12 : (kind === 'office' ? 12 + rnd() * 10 : (kind === 'warehouse' ? 10 + rnd() * 4 : 9 + rnd() * 4));
                    const lbl = (md.labels && rnd() < 0.35) ? md.labels[Math.floor(rnd() * md.labels.length)]
                        : `${pre[Math.floor(rnd() * pre.length)]} ${generic[Math.floor(rnd() * generic.length)]}`;
                    const c = cx * N + lc, r = cy * N + lr;
                    structs.push({ c, r, w, h, x: c * TILE_SIZE, y: r * TILE_SIZE, pxW: w * TILE_SIZE, pxH: h * TILE_SIZE,
                        kind, label: lbl, wallCol: wall, roofCol: roof, heightPx: Math.max(8, Math.round(baseH * (md.heightMult || 1))), _ck: this.chunkKey(cx, cy) });
                    placed++;
                }
            }
        }
        // debris: on the outer lanes of the big avenues (centre lane always stays open) and in plazas
        const rubble = biome === 'lz' ? 0 : Math.floor(rnd() * 4);
        for (let i = 0; i < rubble; i++) {
            const lane = rnd() < 0.5;
            let lc, lr;
            if (lane) { lc = rnd() < 0.5 ? 0 : 2; lr = 5 + Math.floor(rnd() * 24); if (rnd() < 0.5) { const t = lc; lc = lr; lr = t; } }
            else { lc = 5 + Math.floor(rnd() * 24); lr = 5 + Math.floor(rnd() * 24); }
            const ii = lr * N + lc;
            if (occ[ii] || (minorV && (lc === 16 || lc === 17)) || (minorH && (lr === 16 || lr === 17))) continue;
            tile[ii] = 4;
        }
        // street props
        const props = [];
        const nProps = biome === 'lz' ? 0 : Math.floor(rnd() * 4);
        const ptypes = ['taxi', 'taxi', 'nypd', 'bus'];
        for (let i = 0; i < nProps; i++) {
            const vert = rnd() < 0.5;
            const along = 5 + Math.floor(rnd() * 24);
            const lc = vert ? 1 : along, lr = vert ? along : 1;
            props.push({ type: ptypes[Math.floor(rnd() * ptypes.length)], x: (cx * N + lc) * TILE_SIZE + 16, y: (cy * N + lr) * TILE_SIZE + 10, rot: (vert ? 1.57 : 0) + (rnd() - 0.5) * 0.4, _ck: this.chunkKey(cx, cy) });
        }
        if (biome !== 'lz' && rnd() < 0.16) props.push({ type: 'subway', x: (cx * N + 3) * TILE_SIZE + 16, y: (cy * N + 9) * TILE_SIZE, rot: 0, _ck: this.chunkKey(cx, cy) });
        return { tile, occ, structs, props, biome };
    },

    loadChunk(cx, cy) {
        const k = this.chunkKey(cx, cy);
        if (this.chunkRT.has(k)) return;
        let rec = this.chunks.get(k);
        if (!rec) { rec = { cx, cy, gen: false, fog: null, frozen: [] }; this.chunks.set(k, rec); }
        const N = INF_CHUNK;
        const d = this.genChunkTerrain(cx, cy);
        const NAMES = ['plaza', 'road', 'sidewalk', 'park', 'rubble'];
        const nb = new Uint8Array(N * N), cl = new Uint8Array(N * N);
        for (let lr = 0; lr < N; lr++) {
            const r = cy * N + lr;
            const tRow = this.terrain[r] || (this.terrain[r] = []);
            const bRow = this.blockedGrid[r] || (this.blockedGrid[r] = []);
            const fRow = this.fog[r] || (this.fog[r] = []);
            for (let lc = 0; lc < N; lc++) {
                const c = cx * N + lc, i = lr * N + lc;
                const t = d.tile[i];
                tRow[c] = NAMES[t];
                const blocked = d.occ[i] === 1 || t === 4;
                bRow[c] = blocked;
                fRow[c] = rec.fog ? (+rec.fog[i] ? 1 : 0) : 0;
                nb[i] = d.occ[i] ? 1 : (t === 4 ? 2 : 0);
            }
        }
        const rt = { cx, cy, structs: d.structs, props: d.props, base: nb.slice(), nb, cl, biome: d.biome, dirty: true };
        this.chunkRT.set(k, rt);
        this._navLastK = null;
        for (const st of d.structs) this.cityStructures.push(st);
        for (const pr of d.props) this.cityProps.push(pr);
        this.ensureDistrictForChunk(cx, cy);
        if (!rec.gen) {
            rec.gen = true;
            this.genChunkEntities(rec, d);
        }
        // anything that drifted onto ground that is now solid (e.g. a horde crossing while this chunk was unloaded)
        this.forEachInRadius((cx + 0.5) * N * TILE_SIZE, (cy + 0.5) * N * TILE_SIZE, N * TILE_SIZE * 0.72, (e) => {
            if (e.isAir || e.faction === 'player' || NAV_STRUCTURE_CATS.has(e.category) || e.category === 'crate') return;
            if (this.chunkKeyAt(e.x, e.y) !== k) return;
            const tc = Math.floor(e.x / TILE_SIZE), tr = Math.floor(e.y / TILE_SIZE);
            if (this.isTileOpen(tc, tr)) return;
            const t = this.findOpenTileNear(tc, tr, 4);
            if (t) { e.x = t.c * TILE_SIZE + 16; e.y = t.r * TILE_SIZE + 16; }
        });
        this._navDirty = true;
    },

    unloadChunk(k) {
        const rt = this.chunkRT.get(k);
        if (!rt) return;
        const rec = this.chunks.get(k);
        const N = INF_CHUNK;
        let fog = '';
        for (let lr = 0; lr < N; lr++) {
            const r = rt.cy * N + lr;
            const tRow = this.terrain[r], bRow = this.blockedGrid[r], fRow = this.fog[r];
            for (let lc = 0; lc < N; lc++) {
                const c = rt.cx * N + lc;
                fog += (fRow && fRow[c] > 0) ? '1' : '0';
                if (tRow) delete tRow[c];
                if (bRow) delete bRow[c];
                if (fRow) delete fRow[c];
            }
        }
        if (rec) rec.fog = fog.indexOf('1') >= 0 ? fog : null;
        this.chunkRT.delete(k);
        this._navLastK = null;
        this.cityStructures = this.cityStructures.filter(b => b._ck !== k);
        this.cityProps = this.cityProps.filter(p => p._ck !== k);
        this._navDirty = true;
    },

    // ---- districts: every 2x2 chunks is a reclaimable sector ----
    ensureDistrictForChunk(cx, cy) {
        const sx = Math.floor(cx / 2), sy = Math.floor(cy / 2);
        const id = 's_' + sx + '_' + sy;
        if (this._districtIndex.has(id)) return this._districtIndex.get(id);
        let d = this.districts.find(q => q.id === id);
        if (!d) {
            const rnd = this.infRng(sx, sy, 11);
            const md = this.mapDef || MAP_DEFS.manhattan;
            const A = ['Ash', 'Iron', 'Cinder', 'Harbor', 'Echo', 'Granite', 'Rust', 'Signal', 'Union', 'Liberty', 'Copper', 'Hollow', 'Ember', 'Atlas', 'Delta', 'Summit'];
            const B = ['Heights', 'Yards', 'Row', 'Commons', 'Quarter', 'Flats', 'Crossing', 'Gardens', 'Terrace', 'Junction', 'Park', 'Square'];
            const nm = `${A[Math.floor(rnd() * A.length)]} ${B[Math.floor(rnd() * B.length)]}`;
            const dist = Math.max(Math.abs(sx * 2 - INF_ORIGIN_CHUNK), Math.abs(sy * 2 - INF_ORIGIN_CHUNK));
            const isLZ = sx === Math.floor(INF_ORIGIN_CHUNK / 2) && sy === Math.floor(INF_ORIGIN_CHUNK / 2);
            d = {
                id, sector: true, sx, sy,
                name: isLZ ? md.lz : nm, shortName: (isLZ ? md.lz : nm).toUpperCase().slice(0, 16),
                c1: sx * 2 * INF_CHUNK, r1: sy * 2 * INF_CHUNK, c2: sx * 2 * INF_CHUNK + 2 * INF_CHUNK - 1, r2: sy * 2 * INF_CHUNK + 2 * INF_CHUNK - 1,
                rewardScrap: 200 + dist * 25, rewardFuel: 70 + dist * 10,
                status: isLZ ? 'reclaimed' : 'infested', hivesAlive: 0, zombiesAlive: 0
            };
            this.districts.push(d);
        }
        this._districtIndex.set(id, d);
        return d;
    },

    spawnChunkZombie(rec, type, x, y) {
        if (this.activeChunks.has(this.chunkKey(rec.cx, rec.cy))) return this.createZombie(type, x, y, false);
        const cap = Math.round(320 * Math.max(0.2, ZOMBIE_POP_MULT / 10));
        if (rec.frozen.length < cap) rec.frozen.push([type, Math.round(x), Math.round(y), 0]);
        return null;
    },

    infOpenTile(rnd, cx, cy, margin = 4) {
        const N = INF_CHUNK;
        for (let t = 0; t < 30; t++) {
            const c = cx * N + margin + Math.floor(rnd() * (N - 2 * margin)), r = cy * N + margin + Math.floor(rnd() * (N - 2 * margin));
            if (this.isTileOpen(c, r) && this.terrain[r][c] !== 'road') return { c, r };
        }
        return null;
    },

    genChunkEntities(rec, d) {
        const { cx, cy } = rec;
        const T = TILE_SIZE, N = INF_CHUNK;
        const rnd = this.infRng(cx, cy, 2);
        const dist = this.infChunkDist(cx, cy);
        const district = this.ensureDistrictForChunk(cx, cy);
        // --- zombies: same density as the standard city (scaled by the density setting), none at the LZ
        if (dist >= 2) {
            const biomeMult = { downtown: 1.15, residential: 1, industrial: 0.9, park: 0.75 }[d.biome] || 1;
            const ramp = Math.min(1, 0.45 + 0.18 * (dist - 2));
            const target = Math.round(165 * (ZOMBIE_POP_MULT / 10) * biomeMult * ramp);
            const mix = dist < 4 ? { walker: 0.66, runner: 0.24, spitter: 0.08, brute: 0.02 }
                      : (dist < 8 ? { walker: 0.55, runner: 0.25, spitter: 0.13, brute: 0.07 }
                                  : { walker: 0.45, runner: 0.25, spitter: 0.15, brute: 0.15 });
            let made = 0, guard = 0;
            while (made < target && guard++ < 60) {
                const t = this.infOpenTile(rnd, cx, cy, 1);
                if (!t) continue;
                const px = t.c * T + 16, py = t.r * T + 16;
                const size = Math.min(target - made, 6 + Math.floor(rnd() * 7));
                for (let i = 0; i < size; i++) {
                    const zx = px + (rnd() - 0.5) * 120, zy = py + (rnd() - 0.5) * 120;
                    if (!this.isTileOpen(Math.floor(zx / T), Math.floor(zy / T))) continue;
                    let roll = rnd(), type = 'walker';
                    for (const [k2, w] of Object.entries(mix)) { roll -= w; if (roll <= 0) { type = k2; break; } }
                    this.spawnChunkZombie(rec, type, zx, zy);
                    made++;
                }
            }
        }
        // --- supply crate
        if (rnd() < 0.55) {
            const t = this.infOpenTile(rnd, cx, cy);
            if (t) this.entities.push({ id: this.nextEntityId++, category: 'crate', faction: 'neutral', type: 'crate', name: 'CEDA Emergency Supply Crate',
                x: t.c * T + 16, y: t.r * T + 16, radius: 12, scrapValue: 135, fuelValue: 45 });
        }
        // --- resource depot
        if (dist >= 1 && rnd() < 0.24) {
            const t = this.infOpenTile(rnd, cx, cy, 6);
            if (t) this.createSupplyDepot(t.c * T + 16, t.r * T + 16, 16 + Math.floor(rnd() * 10) + Math.min(8, dist), 6 + Math.floor(rnd() * 5) + Math.min(5, Math.floor(dist / 2)));
        }
        // --- abandoned civilian vehicle
        if (dist >= 1 && rnd() < 0.3) {
            const vert = rnd() < 0.5;
            const along = 6 + Math.floor(rnd() * 22);
            const c = cx * N + (vert ? 1 : along), r = cy * N + (vert ? along : 1);
            if (this.isTileOpen(c, r)) {
                const types = ['civ_sedan', 'civ_pickup', 'civ_van'];
                this.createAbandonedVehicle(types[Math.floor(rnd() * 3)], c * T + 16, r * T + 16, (vert ? Math.PI / 2 : 0) + (rnd() - 0.5) * 0.9);
            }
        }
        // --- mutated hive
        if (dist >= 3 && rnd() < 0.15) {
            const t = this.infOpenTile(rnd, cx, cy, 7);
            if (t) {
                const types = ['hive_subway', 'hive_spore', 'hive_foundry'];
                let ht = types[Math.floor(rnd() * types.length)];
                if (dist >= 7 && rnd() < 0.18) ht = 'hive_apex';
                const arch = HIVE_ARCHETYPES[ht];
                const hv = this.createHive(t.c * T + 16, t.r * T + 16, ht, `${district.name} ${arch.name}`);
                // its guards stay as live entities only while the chunk is active
                if (!this.activeChunks.has(this.chunkKey(cx, cy))) {
                    const guards = this.entities.filter(e => e.category === 'zombie' && !e.waveGroupId && Math.hypot(e.x - hv.x, e.y - hv.y) < 160);
                    guards.forEach(z => { rec.frozen.push([z.type, Math.round(z.x), Math.round(z.y), 0]); this.removeEntityQuiet(z); });
                }
            }
        }
        // --- locked survivor shelter (with an estimated intel signal)
        if (dist >= 1 && rnd() < 0.09) {
            const t = this.infOpenTile(rnd, cx, cy, 5);
            if (t) {
                const occs = [['civilian', 'medic'], ['civilian', 'mechanic'], ['civilian', 'civilian', 'medic'], ['civilian', 'civilian', 'mechanic']];
                const sh = { id: this.nextEntityId++, category: 'shelter', faction: 'neutral', type: 'shelter', name: 'Locked Survivor Shelter',
                    label: `${district.name} Basement`, x: t.c * T + 16, y: t.r * T + 16, radius: 16, occupants: occs[Math.floor(rnd() * occs.length)].slice(),
                    opened: false, unlockProgress: 0, unlockTime: 2.5, groupId: null };
                sh.groupId = 'shelter_' + sh.id;
                this.entities.push(sh);
                this.addIntelSignal(sh.x, sh.y, 'shelter', sh.id);
            }
        }
        // --- armed survivor outpost
        if (dist >= 2 && rnd() < 0.05) {
            const t = this.infOpenTile(rnd, cx, cy, 7);
            if (t) {
                const op = this.createOutpostAt({ c: t.c, r: t.r, name: `${district.name} Holdouts`, militia: 3, extras: [rnd() < 0.5 ? 'civilian' : 'mechanic'] });
                if (op) this.addIntelSignal(op.x, op.y, 'outpost', op.id);
            }
        }
        // --- bandit territory
        if (dist >= 3 && rnd() < 0.05) {
            const t = this.infOpenTile(rnd, cx, cy, 8);
            if (t) {
                const big = rnd() < 0.3;
                this.createMercCamp({ c: t.c, r: t.r, name: `${district.name} ${big ? 'Warlord Camp' : 'Scrap Gang'}`, raiders: big ? 4 : 3, gunners: big ? 2 : 1,
                    marksmen: big ? 2 : 1, towers: big ? 2 : 1, maxMembers: big ? 9 : 6, lootScrap: big ? 480 : 320, lootFuel: big ? 200 : 120 });
            }
        }
        // occasional false lead
        if (dist >= 2 && rnd() < 0.04) this.addIntelSignal((cx + 0.5) * N * T, (cy + 0.5) * N * T, null, null);
    },

    addIntelSignal(tx, ty, refType, refId) {
        const flavors = ['DISTRESS BEACON', 'RADIO CHATTER', 'FLARE SIGHTING', 'DRONE THERMAL HIT', 'SOS GRAFFITI', 'GUNFIRE REPORT'];
        const callsigns = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT', 'GOLF', 'HOTEL', 'INDIA', 'JULIET', 'KILO', 'LIMA', 'MIKE', 'NOVEMBER', 'OSCAR', 'PAPA'];
        const ang = Math.random() * Math.PI * 2;
        const off = 45 + Math.random() * 85;
        const n = this.survivorIntel.length;
        this.survivorIntel.push({
            id: n + 1, label: `SIGNAL ${callsigns[n % callsigns.length]}${n >= callsigns.length ? '-' + Math.floor(n / callsigns.length) : ''}`,
            x: tx + Math.cos(ang) * off, y: ty + Math.sin(ang) * off, radius: 170 + Math.random() * 30,
            trueX: tx, trueY: ty, refType, refId, status: 'unknown',
            flavor: flavors[Math.floor(Math.random() * flavors.length)], fade: 0
        });
    },

    // ---- per-frame streaming / level-of-detail manager ----
    infiniteTick(dt, sync = false) {
        if (!this.infinite) return;
        this._infT -= dt;
        if (!sync && this._infT > 0) { this.processChunkQueue(2); return; }
        this._infT = 0.4;
        const LOAD = this.infRadius('load'), ACT = this.infRadius('active'), REN = this.infRadius('render');
        // anchor chunks: every chunk holding player forces (separate groups get separate bubbles)
        const anchors = new Map();
        for (const e of this.entities) {
            if (e.faction !== 'player') continue;
            if (e.category !== 'unit' && e.category !== 'vehicle' && e.category !== 'building') continue;
            if (e.category === 'building' && (e.type === 'wall' || e.type === 'gate')) continue;
            const k = this.chunkKeyAt(e.x, e.y);
            if (!anchors.has(k)) anchors.set(k, this.chunkCoordsOfKey(k));
        }
        if (anchors.size === 0) return;
        const A = [...anchors.values()];
        const minD = (cx, cy) => { let m = Infinity; for (const a of A) { const d = Math.max(Math.abs(a.cx - cx), Math.abs(a.cy - cy)); if (d < m) m = d; } return m; };
        // load ring (queued, nearest first) & unload beyond ring+1 (hysteresis)
        const want = [];
        for (const a of A) {
            for (let dy = -LOAD; dy <= LOAD; dy++) for (let dx = -LOAD; dx <= LOAD; dx++) {
                const k = this.chunkKey(a.cx + dx, a.cy + dy);
                if (!this.chunkRT.has(k)) want.push([Math.max(Math.abs(dx), Math.abs(dy)), a.cx + dx, a.cy + dy, k]);
            }
        }
        want.sort((p, q) => p[0] - q[0]);
        const queued = new Set(this._loadQueue.map(q => q[3]));
        for (const w of want) if (!queued.has(w[3])) { this._loadQueue.push(w); queued.add(w[3]); }
        this._loadQueue.sort((p, q) => minD(p[1], p[2]) - minD(q[1], q[2]));
        this._loadQueue = this._loadQueue.filter(q => minD(q[1], q[2]) <= LOAD);
        for (const [k, rt] of [...this.chunkRT]) if (minD(rt.cx, rt.cy) > LOAD + 1) this.unloadChunk(k);
        this.processChunkQueue(sync ? 99999 : 4);
        // active ring (with hysteresis) and render ring
        const act = new Set(), ren = new Set();
        for (const [k, rt] of this.chunkRT) {
            const d = minD(rt.cx, rt.cy);
            if (d <= ACT || (d <= ACT + 1 && this.activeChunks.has(k))) act.add(k);
            if (d <= REN) ren.add(k);
        }
        this.activeChunks = act;
        this.renderChunks = ren;
        // thaw sleeping zombies in active chunks; freeze idle zombies that are outside every active chunk
        for (const k of act) {
            const rec = this.chunks.get(k);
            if (rec && rec.frozen.length) {
                for (const [type, x, y, dmg] of rec.frozen) {
                    if (!ZOMBIE_DEFS[type]) continue;
                    const z = this.createZombie(type, x, y, false);
                    if (dmg) z.hp = Math.max(1, z.maxHp - dmg);
                }
                rec.frozen = [];
            }
        }
        let frozeAny = false;
        for (const e of this.entities) {
            if (e.category !== 'zombie' || e.waveGroupId || e.hiveGoal || e.targetId || e.attackHq || e.frenzyTimer > 0) continue;
            const k = this.chunkKeyAt(e.x, e.y);
            if (act.has(k)) continue;
            let rec = this.chunks.get(k);
            if (!rec) { const cc = this.chunkCoordsOfKey(k); rec = { cx: cc.cx, cy: cc.cy, gen: false, fog: null, frozen: [] }; this.chunks.set(k, rec); }
            rec.frozen.push([e.type, Math.round(e.x), Math.round(e.y), Math.max(0, Math.round(e.maxHp - e.hp))]);
            e._removed = true;
            this.selectedIds.delete(e.id);
            frozeAny = true;
        }
        if (frozeAny) this.entities = this.entities.filter(e => !e._removed);
        if (this._navDirty) { this._navDirty = false; this.buildNavGridInfinite(false); }
    },

    processChunkQueue(budget) {
        let n = 0;
        while (this._loadQueue.length && n < budget) {
            const [, cx, cy] = this._loadQueue.shift();
            if (this.chunkRT.has(this.chunkKey(cx, cy))) continue;
            this.loadChunk(cx, cy);
            n++;
        }
        if (n > 0 && this._navDirty) { this._navDirty = false; this.buildNavGridInfinite(false); }
    },

    // nav data for loaded chunks: terrain base + every structure footprint + vehicle clearance
    buildNavGridInfinite(force) {
        if (!this.chunkRT) return;
        let sig = 0, cnt = 0;
        const structs = [];
        for (const e of this.entities) {
            if (!NAV_STRUCTURE_CATS.has(e.category)) continue;
            cnt++;
            sig = (sig * 31 + e.id * 7 + Math.round(e.x) + (e.type === 'gate' ? 3 : 0)) % 1000000007;
            structs.push(e);
        }
        const key = cnt + ':' + sig;
        const N = INF_CHUNK;
        // structures changed -> every loaded chunk is re-stamped; otherwise only freshly loaded chunks (+ neighbours'
        // clearance) are processed, so streaming new chunks stays cheap
        const full = force === 'full' || this._navKey !== key;
        this._navKey = key;
        const stampSet = [];
        for (const rt of this.chunkRT.values()) if (full || rt.dirty) stampSet.push(rt);
        if (stampSet.length === 0) return;
        const clrSet = new Set(stampSet);
        for (const rt of stampSet) {
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                const n = this.chunkRT.get(this.chunkKey(rt.cx + dx, rt.cy + dy));
                if (n) clrSet.add(n);
            }
        }
        const stampKeys = new Set(stampSet.map(rt => this.chunkKey(rt.cx, rt.cy)));
        for (const rt of stampSet) rt.nb.set(rt.base);
        for (const e of structs) {
            const R = (e.radius || 16) + 40;
            const c0 = Math.floor((e.x - R) / (N * TILE_SIZE)), c1 = Math.floor((e.x + R) / (N * TILE_SIZE));
            const r0 = Math.floor((e.y - R) / (N * TILE_SIZE)), r1 = Math.floor((e.y + R) / (N * TILE_SIZE));
            let touches = false;
            for (let cy = r0; cy <= r1 && !touches; cy++) for (let cx = c0; cx <= c1; cx++) if (stampKeys.has(this.chunkKey(cx, cy))) { touches = true; break; }
            if (!touches) continue;
            this.navStampStructure(e, (c, r, v) => {
                const k = this.chunkKey(Math.floor(c / N), Math.floor(r / N));
                if (!stampKeys.has(k)) return;
                const rt = this.chunkRT.get(k);
                const i = (r % N) * N + (c % N);
                if (rt.nb[i] !== 1) rt.nb[i] = v;
            });
        }
        for (const rt of stampSet) rt.dirty = false;
        this._navLastK = null;
        for (const rt of clrSet) {
            const nb = rt.nb;
            for (let lr = 0; lr < N; lr++) {
                for (let lc = 0; lc < N; lc++) {
                    let ok = true;
                    const edge = lr === 0 || lc === 0 || lr === N - 1 || lc === N - 1;
                    for (let dr = -1; dr <= 1 && ok; dr++) {
                        for (let dc = -1; dc <= 1; dc++) {
                            const v = edge ? this.navV(((rt.cy * N + lr + dr) * MAP_COLS) + rt.cx * N + lc + dc) : nb[(lr + dr) * N + lc + dc];
                            if (v === 1 || v === 3) { ok = false; break; }
                        }
                    }
                    rt.cl[lr * N + lc] = ok ? 1 : 0;
                }
            }
        }
        this.navVersion = (this.navVersion || 0) + 1;
    },

    // simplified AI outside the active bubble (returns true if the entity should skip its full update this frame)
    infLodSkip(ent, dt) {
        if (ent.faction === 'player' || ent.category === 'building') return false;
        if (this.isActivePos(ent.x, ent.y)) { ent._lodAcc = 0; return false; }
        if (ent.category === 'zombie' || ent.category === 'hive') {
            ent._lodAcc = (ent._lodAcc || 0) + dt;
            const step = ent.category === 'hive' ? 0.5 : 0.3;
            if (ent._lodAcc < step) return true;
            ent._lodDt = ent._lodAcc;
            ent._lodAcc = 0;
            return 'step';
        }
        return true; // bandits, survivors, barricades, crates... wait where they are until forces come near
    },

    updateFogOfWarInfinite() {
        for (const [r, c] of this._fogVis) { const row = this.fog[r]; if (row && row[c] === 2) row[c] = 1; }
        this._fogVis = [];
        for (const ent of this.entities) {
            if (ent.faction !== 'player' || !ent.vision) continue;
            const c0 = Math.floor(ent.x / TILE_SIZE), r0 = Math.floor(ent.y / TILE_SIZE);
            const tileRad = Math.ceil(ent.vision / TILE_SIZE);
            for (let r = r0 - tileRad; r <= r0 + tileRad; r++) {
                const row = this.fog[r];
                if (!row) continue;
                for (let c = c0 - tileRad; c <= c0 + tileRad; c++) {
                    if (row[c] === undefined || row[c] === 2) continue;
                    if (Math.hypot((c + 0.5) * TILE_SIZE - ent.x, (r + 0.5) * TILE_SIZE - ent.y) <= ent.vision) {
                        row[c] = 2;
                        this._fogVis.push([r, c]);
                    }
                }
            }
        }
        this.refreshEnemyIntel();
    },

    // reclamation in infinite mode: one pass buckets live entities by sector, frozen zombies counted from chunk records
    updateDistrictStatesInfinite(silent) {
        const S = 2 * INF_CHUNK * TILE_SIZE;
        const tally = new Map();
        const get = (id) => { let t = tally.get(id); if (!t) { t = { h: 0, z: 0, p: 0 }; tally.set(id, t); } return t; };
        for (const e of this.entities) {
            const id = 's_' + Math.floor(e.x / S) + '_' + Math.floor(e.y / S);
            if (!this._districtIndex.has(id)) continue;
            if (e.category === 'hive') get(id).h++;
            else if (e.category === 'zombie' && !e.attackHq && !e.waveGroupId) get(id).z++;
            else if (e.faction === 'player') get(id).p++;
        }
        for (const rec of this.chunks.values()) if (rec.frozen.length) get('s_' + Math.floor(rec.cx / 2) + '_' + Math.floor(rec.cy / 2)).z += rec.frozen.length;
        let changed = false;
        for (const d of this.districts) {
            const t = tally.get(d.id) || { h: 0, z: 0, p: 0 };
            d.hivesAlive = t.h; d.zombiesAlive = t.z;
            if (d.status === 'reclaimed') continue;
            // a sector only counts as cleared once all four of its chunks have been explored
            let allGen = true;
            for (let a = 0; a < 2 && allGen; a++) for (let b = 0; b < 2; b++) { const rec = this.chunks.get(this.chunkKey(d.sx * 2 + a, d.sy * 2 + b)); if (!rec || !rec.gen) { allGen = false; break; } }
            if (allGen && t.h === 0 && t.z === 0) {
                d.status = 'reclaimed'; changed = true;
                if (!silent) {
                    this.scrap += d.rewardScrap; this.fuel += d.rewardFuel;
                    sfx.playRadioAck('liberate');
                    this.showRadio(`🗽 SECTOR RECLAIMED: ${d.name.toUpperCase()} SECURED! (+${d.rewardScrap} SCRAP, +${d.rewardFuel} FUEL)`);
                }
            } else {
                const ns = (t.p > 0 || t.h === 0) ? 'contested' : 'infested';
                if (ns !== d.status) { d.status = ns; changed = true; }
            }
        }
        if (changed && this.selectedIds.size === 0) this.updateSelectionUI();
    },

    startInfiniteGame() {
        this.initInfiniteWorld();
        const T = TILE_SIZE, N = INF_CHUNK, O = INF_ORIGIN_CHUNK;
        const hqX = (O * N + 16) * T, hqY = (O * N + 17) * T;
        this.loadChunk(O, O);
        this.createBuilding('hq', hqX, hqY, true);
        const dep = this.createSupplyDepot(hqX + 6 * T, hqY + 4 * T, 16, 6);
        const col = this.createBuilding('collector', dep.x, dep.y, true);
        col.depotId = dep.id; col.scrapRate = dep.scrapRate; col.fuelRate = dep.fuelRate; dep.claimedBy = col.id;
        const startUnits = [
            this.createUnit('engineer', hqX + 66, hqY + 18),
            this.createUnit('rifleman', hqX + 46, hqY - 46),
            this.createUnit('rifleman', hqX + 76, hqY - 40),
            this.createUnit('shotgunner', hqX + 94, hqY - 12),
            this.createVehicle('humvee', hqX + 114, hqY + 34),
            this.createVehicle('supplytruck', hqX + 70, hqY + 96)
        ];
        startUnits.forEach(u => this.selectedIds.add(u.id));
        this.assignControlGroup(1, false);
        this.gridBuilt = false;
        this.buildSpatialGrid();
        this.infiniteTick(0, true);
        this.buildNavGridInfinite(true);
        this.running = true;
        this.resizeCanvas();
        this.centerOnHQ();
        this.updateFogOfWar();
        this.updateDistrictStates(true);
        this.recalcPopulation();
        this.updateSelectionUI();
        this.renderControlGroupsBar();
        this.showRadio(`∞ INFINITE MAP — THE ${this.mapDef.city} SPRAWL HAS NO EDGE. EXPLORE, RECLAIM SECTORS & DESTROY EVERY HIVE YOU FIND.`);
        this.refreshCityText();
    },

    // Survivor outpost at an arbitrary tile (same layout as the standard map's outposts)
    createOutpostAt(sp) {
        const T = TILE_SIZE;
        const op = { id: this.nextEntityId++, name: sp.name, x: sp.c * T + T / 2, y: sp.r * T + T / 2, radius: 84, contacted: false, discovered: false, groupId: null };
        op.groupId = 'outpost_' + op.id;
        this.outposts.push(op);
        for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
                if (Math.max(Math.abs(dc), Math.abs(dr)) !== 2 || dc === 0 || dr === 0) continue;
                const c = sp.c + dc, r = sp.r + dr;
                if (!this.isTileOpen(c, r)) continue;
                const bx = c * T + T / 2, by = r * T + T / 2;
                if (!this.isSpotClearOfEntities(bx, by, 18)) continue;
                this.entities.push({ id: this.nextEntityId++, category: 'fort', faction: 'survivor', type: 'barricade', name: 'Survivor Barricade',
                    x: bx, y: by, radius: 14, hp: 500, maxHp: 500, outpostId: op.id });
            }
        }
        for (let i = 0; i < sp.militia; i++) {
            const ang = (i / sp.militia) * Math.PI * 2 + 0.4;
            const m = this.createSurvivor('militia', op.x + Math.cos(ang) * 36, op.y + Math.sin(ang) * 36, op.groupId);
            m.state = 'guard'; m.outpostId = op.id; m.postX = m.x; m.postY = m.y;
        }
        sp.extras.forEach((type, i) => {
            const s2 = this.createSurvivor(type, op.x + (i - 0.5) * 12, op.y, op.groupId);
            s2.state = 'guard'; s2.outpostId = op.id; s2.postX = s2.x; s2.postY = s2.y;
        });
        return op;
    },

    // minimap frame: the whole map in the standard game; a 128-tile window around the camera in infinite mode
    minimapFrame() {
        if (!this.infinite) return { ox: 0, oy: 0, W: MAP_WIDTH, H: MAP_HEIGHT, c0: 0, r0: 0, cols: MAP_COLS, rows: MAP_ROWS };
        const z = this.cam.zoom || 1;
        const ccx = Math.floor((this.cam.x + this.canvas.width / (2 * z)) / TILE_SIZE), ccy = Math.floor((this.cam.y + this.canvas.height / (2 * z)) / TILE_SIZE);
        const S = 128;
        const c0 = ccx - S / 2, r0 = ccy - S / 2;
        return { ox: c0 * TILE_SIZE, oy: r0 * TILE_SIZE, W: S * TILE_SIZE, H: S * TILE_SIZE, c0, r0, cols: S, rows: S };
    }
});
