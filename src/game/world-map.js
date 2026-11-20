'use strict';
// Standard city maps: tile queries, map generation, starting infestation, depots, districts & reclamation
defineGameMethods({
    // ========================================================================
    // UPDATE 2: SURVIVOR POCKETS, ARMED OUTPOSTS, MERC TERRITORIES & INTEL
    // ========================================================================
    // Update 7: spawn check that also accepts not-yet-loaded ground in Infinite Map Mode
    isSpawnableTile(c, r) {
        if (this.isTileOpen(c, r)) return true;
        return !!this.infinite && (!this.blockedGrid[r] || this.blockedGrid[r][c] === undefined);
    },

    isTileOpen(c, r) {
        return !!(this.blockedGrid[r] && this.blockedGrid[r][c] === false);
    },

    findOpenTileNear(c, r, maxRing = 3) {
        if (this.isTileOpen(c, r)) return { c, r };
        for (let ring = 1; ring <= maxRing; ring++) {
            for (let dr = -ring; dr <= ring; dr++) {
                for (let dc = -ring; dc <= ring; dc++) {
                    if (Math.max(Math.abs(dc), Math.abs(dr)) !== ring) continue;
                    if (this.isTileOpen(c + dc, r + dr)) return { c: c + dc, r: r + dr };
                }
            }
        }
        return null;
    },

    isSpotClearOfEntities(x, y, pad) {
        for (const e of this.entities) {
            if (e.category === 'zombie') continue;
            if (Math.hypot(e.x - x, e.y - y) < (e.radius || 10) + pad) return false;
        }
        return true;
    },

    // ========================================================================
    // NYC URBAN MAP GENERATION (AVENUES, BLOCKS, SKYSCRAPERS, INFRASTRUCTURE)
    // ========================================================================
    generateNYCMap() {
        this.terrain = [];
        this.blockedGrid = [];
        this.fog = [];
        this.cityStructures = [];
        this.cityProps = [];

        const avenues = [
            [8, 10],   // West Side Hwy
            [26, 28],  // 7th Ave / Broadway
            [46, 48],  // 5th Ave
            [66, 68],  // Park Ave
            [86, 88]   // FDR Drive
        ];
        const streets = [
            [6, 7],    // 72nd St
            [20, 22],  // 59th St (Central Park South)
            [38, 40],  // 34th St
            [56, 58],  // 14th / Houston St
            [74, 76]   // Canal St
        ];

        const isAv = (c) => avenues.some(([a, b]) => c >= a && c <= b);
        const isSt = (r) => streets.some(([a, b]) => r >= a && r <= b);
        const isSidewalk = (c, r) => {
            if (isAv(c) || isSt(r)) return false;
            return avenues.some(([a, b]) => c === a - 1 || c === b + 1) ||
                   streets.some(([a, b]) => r === a - 1 || r === b + 1);
        };

        for (let r = 0; r < MAP_ROWS; r++) {
            const tRow = [];
            const bRow = [];
            const fRow = [];
            for (let c = 0; c < MAP_COLS; c++) {
                let tile = 'plaza';
                let blocked = false;

                // Hudson River (West) & East River / Harbor (South & East edges)
                if (c <= 3 || c >= 92 || r >= 92 || r <= 1) {
                    tile = 'water';
                    blocked = true;
                } else if (isAv(c) || isSt(r)) {
                    tile = 'road';
                } else if (isSidewalk(c, r)) {
                    tile = 'sidewalk';
                } else if (r >= 8 && r <= 19 && c >= 29 && c <= 65) {
                    // Central Park
                    tile = 'park';
                } else if (r >= 77 && r <= 90 && c >= 5 && c <= 25) {
                    // Battery Park LZ Compound
                    tile = (c >= 8 && c <= 22 && r >= 79 && r <= 89) ? 'plaza' : 'park';
                }

                tRow.push(tile);
                bRow.push(blocked);
                fRow.push(0);
            }
            this.terrain.push(tRow);
            this.blockedGrid.push(bRow);
            this.fog.push(fRow);
        }

        // Define the 6 NYC Reclamation Districts
        this.districts = [
            {
                id: 'battery',
                name: 'Battery Park LZ',
                shortName: 'BATTERY PARK',
                c1: 4, r1: 76, c2: 27, r2: 91,
                rewardScrap: 150, rewardFuel: 50,
                status: 'reclaimed', hivesAlive: 0, zombiesAlive: 0
            },
            {
                id: 'financial',
                name: 'Financial District',
                shortName: 'FINANCIAL DIST',
                c1: 28, r1: 76, c2: 91, r2: 91,
                rewardScrap: 260, rewardFuel: 95,
                status: 'infested', hivesAlive: 0, zombiesAlive: 0
            },
            {
                id: 'soho',
                name: 'SoHo & Greenwich Village',
                shortName: 'SOHO & VILLAGE',
                c1: 4, r1: 58, c2: 46, r2: 75,
                rewardScrap: 240, rewardFuel: 85,
                status: 'infested', hivesAlive: 0, zombiesAlive: 0
            },
            {
                id: 'les',
                name: 'Lower East Side',
                shortName: 'LOWER EAST SIDE',
                c1: 47, r1: 58, c2: 91, r2: 75,
                rewardScrap: 260, rewardFuel: 95,
                status: 'infested', hivesAlive: 0, zombiesAlive: 0
            },
            {
                id: 'midtown',
                name: 'Midtown & Times Square',
                shortName: 'MIDTOWN',
                c1: 4, r1: 22, c2: 91, r2: 57,
                rewardScrap: 360, rewardFuel: 140,
                status: 'infested', hivesAlive: 0, zombiesAlive: 0
            },
            {
                id: 'centralpark',
                name: 'Central Park & Upper East',
                shortName: 'CENTRAL PARK N',
                c1: 4, r1: 2, c2: 91, r2: 21,
                rewardScrap: 420, rewardFuel: 165,
                status: 'infested', hivesAlive: 0, zombiesAlive: 0
            }
        ];

        // Update 5: map variant — district names
        const md = this.mapDef || MAP_DEFS.manhattan;
        if (md.districts) {
            this.districts.forEach(d => {
                const nm = md.districts[d.id];
                if (nm) { d.name = nm[0]; d.shortName = nm[1]; }
            });
        }

        // Populate City Blocks with Skyscrapers, Smaller Buildings, Abandoned Structures & Ruined Infrastructure
        const addBuildingBlock = (c, r, w, h, kind, label, wallCol, roofCol, heightPx) => {
            // Keep avenues, cross-streets, and Battery Park LZ HQ clear
            for (let rr = r; rr < r + h; rr++) {
                for (let cc = c; cc < c + w; cc++) {
                    if (rr < 2 || rr >= MAP_ROWS - 4 || cc < 4 || cc >= MAP_COLS - 4) return;
                    if (this.terrain[rr][cc] === 'road' || this.terrain[rr][cc] === 'water') return;
                    if (cc >= 8 && cc <= 23 && rr >= 79 && rr <= 89) return;
                }
            }
            for (let rr = r; rr < r + h; rr++) {
                for (let cc = c; cc < c + w; cc++) {
                    this.blockedGrid[rr][cc] = true;
                }
            }
            this.cityStructures.push({
                c, r, w, h,
                x: c * TILE_SIZE,
                y: r * TILE_SIZE,
                pxW: w * TILE_SIZE,
                pxH: h * TILE_SIZE,
                kind,
                label,
                wallCol,
                roofCol,
                heightPx
            });
        };

        // Structured Manhattan Blocks (leaving generous alleys & plazas inside blocks for tactical movement & base building)
        const blockCoords = [
            // Financial District (rows 78-89)
            { c: 30, r: 78, w: 5, h: 4, kind: 'skyscraper', label: 'ONE WALL TOWER', wall: '#24303e', roof: '#344457', hPx: 26 },
            { c: 30, r: 85, w: 4, h: 4, kind: 'office', label: 'EXCHANGE ANNEX', wall: '#373e47', roof: '#48525e', hPx: 14 },
            { c: 50, r: 78, w: 5, h: 5, kind: 'skyscraper', label: 'LIBERTY PLAZA', wall: '#202b38', roof: '#2f3f52', hPx: 30 },
            { c: 58, r: 84, w: 6, h: 4, kind: 'office', label: 'FEDERAL RESERVE', wall: '#3d3a36', roof: '#524e48', hPx: 16 },
            { c: 70, r: 78, w: 4, h: 4, kind: 'brownstone', label: 'FULTON BLOCK', wall: '#4d322c', roof: '#634139', hPx: 10 },
            { c: 70, r: 85, w: 5, h: 4, kind: 'warehouse', label: 'PIER 11 DEPOT', wall: '#2f353d', roof: '#3f4752', hPx: 12 },

            // SoHo & Greenwich Village (rows 60-72)
            { c: 12, r: 60, w: 4, h: 4, kind: 'brownstone', label: 'WEST VILLAGE', wall: '#54362f', roof: '#6b453c', hPx: 10 },
            { c: 19, r: 68, w: 5, h: 4, kind: 'office', label: 'HUDSON LOFTS', wall: '#373e47', roof: '#49525e', hPx: 14 },
            { c: 30, r: 60, w: 4, h: 3, kind: 'brownstone', label: 'SOHO CAST-IRON', wall: '#473b35', roof: '#5c4d45', hPx: 11 },
            { c: 37, r: 68, w: 5, h: 4, kind: 'office', label: 'NYU SCIENCE HALL', wall: '#2b3847', roof: '#3b4c61', hPx: 16 },

            // Lower East Side (rows 60-72)
            { c: 50, r: 60, w: 5, h: 4, kind: 'brownstone', label: 'BOWERY FLATS', wall: '#52342d', roof: '#69433a', hPx: 10 },
            { c: 50, r: 68, w: 4, h: 4, kind: 'office', label: 'DELANCEY PLAZA', wall: '#363d47', roof: '#48515e', hPx: 13 },
            { c: 70, r: 60, w: 4, h: 4, kind: 'warehouse', label: 'EAST RIVER YARD', wall: '#30363d', roof: '#424a54', hPx: 12 },
            { c: 79, r: 68, w: 5, h: 4, kind: 'office', label: 'BRIDGE TOWER', wall: '#253140', roof: '#354659', hPx: 18 },

            // Midtown South (rows 42-54)
            { c: 12, r: 42, w: 5, h: 4, kind: 'warehouse', label: 'CHELSEA PIERS', wall: '#2e353d', roof: '#3e4752', hPx: 12 },
            { c: 18, r: 49, w: 5, h: 5, kind: 'office', label: 'POSTAL SORTING', wall: '#3b3934', roof: '#4f4c45', hPx: 15 },
            { c: 30, r: 42, w: 5, h: 4, kind: 'skyscraper', label: 'HERALD TOWER', wall: '#222e3d', roof: '#324359', hPx: 26 },
            { c: 40, r: 50, w: 4, h: 4, kind: 'skyscraper', label: 'EMPIRE SPIRE', wall: '#1f2b3a', roof: '#304257', hPx: 34 },
            { c: 50, r: 42, w: 6, h: 4, kind: 'skyscraper', label: 'METLIFE RUIN', wall: '#253242', roof: '#364961', hPx: 28 },
            { c: 59, r: 50, w: 5, h: 4, kind: 'office', label: 'MURRAY HILL', wall: '#4d352e', roof: '#63443b', hPx: 12 },
            { c: 70, r: 42, w: 5, h: 4, kind: 'skyscraper', label: 'CHRYSLER ANNEX', wall: '#283545', roof: '#3a4c63', hPx: 28 },
            { c: 79, r: 50, w: 5, h: 4, kind: 'office', label: 'UN SECRETARIAT', wall: '#213342', roof: '#2f485e', hPx: 22 },

            // Midtown North / Times Square (rows 24-36)
            { c: 12, r: 24, w: 5, h: 4, kind: 'warehouse', label: 'HELLS KITCHEN', wall: '#383430', roof: '#4a4540', hPx: 12 },
            { c: 18, r: 31, w: 5, h: 5, kind: 'office', label: 'PORT AUTHORITY', wall: '#323942', roof: '#434d59', hPx: 16 },
            { c: 30, r: 24, w: 4, h: 4, kind: 'skyscraper', label: 'ONE TIMES SQ', wall: '#1e2938', roof: '#2f4057', hPx: 30 },
            { c: 40, r: 32, w: 4, h: 4, kind: 'skyscraper', label: 'ROCKEFELLER CTR', wall: '#263240', roof: '#38495e', hPx: 28 },
            { c: 50, r: 24, w: 5, h: 4, kind: 'skyscraper', label: 'ST. PATRICK BLK', wall: '#2a3440', roof: '#3b4859', hPx: 24 },
            { c: 60, r: 32, w: 4, h: 4, kind: 'office', label: 'LEXINGTON TOWER', wall: '#23303e', roof: '#334559', hPx: 22 },
            { c: 70, r: 24, w: 5, h: 4, kind: 'skyscraper', label: 'CITIGROUP SPIRE', wall: '#212d3b', roof: '#324459', hPx: 28 },
            { c: 80, r: 32, w: 4, h: 4, kind: 'brownstone', label: 'TURTLE BAY', wall: '#4f352e', roof: '#66453c', hPx: 11 },

            // Upper West & Upper East Side flanking Central Park (rows 9-18)
            { c: 12, r: 9, w: 5, h: 4, kind: 'brownstone', label: 'LINCOLN TOWERS', wall: '#4d352e', roof: '#63453c', hPx: 14 },
            { c: 18, r: 15, w: 5, h: 4, kind: 'office', label: 'DAKOTA ANNEX', wall: '#3b3632', roof: '#4f4843', hPx: 16 },
            { c: 70, r: 9, w: 5, h: 4, kind: 'office', label: 'MET MUSEUM', wall: '#3e3b36', roof: '#545049', hPx: 14 },
            { c: 79, r: 15, w: 5, h: 4, kind: 'skyscraper', label: '5TH AVE PENTHOUSE', wall: '#24303e', roof: '#35475c', hPx: 22 }
        ];

        // Update 5: map variant — skyline, building mix, palette and landmark names
        if (md.id !== 'manhattan') {
            blockCoords.forEach((b, i) => {
                if (md.kindMap && md.kindMap[b.kind] && i % 3 !== 2) b.kind = md.kindMap[b.kind];
                if (md.labels && md.labels[i]) b.label = md.labels[i];
                b.hPx = Math.max(8, Math.round(b.hPx * md.heightMult));
                if (md.wallMix) { b.wall = mixHex(b.wall, md.wallMix[0], md.wallMix[1]); b.roof = mixHex(b.roof, md.wallMix[0], md.wallMix[1] * 0.8); }
            });
        }

        blockCoords.forEach(b => addBuildingBlock(b.c, b.r, b.w, b.h, b.kind, b.label, b.wall, b.roof, b.hPx));

        // Destroyed Infrastructure & Rubble Choke Points (collapsed overpasses & cratered ruins)
        const rubbleClusters = [
            [27, 74], [28, 74], // Partially collapsed Canal St overpass (leaves lane open!)
            [47, 56], [48, 56], // 14th St & 5th Ave cratered barricade
            [67, 38], [67, 39], // 34th & Park Ave collapsed scaffolding
            [42, 16], [43, 16], [42, 17], // Central Park ruined stone arch
            [82, 58], [83, 58], // FDR Drive collapsed ramp
            [15, 36], [16, 36]  // West Side rubble pile
        ];
        rubbleClusters.forEach(([c, r]) => {
            if (this.terrain[r] && this.terrain[r][c] && this.terrain[r][c] !== 'water') {
                this.terrain[r][c] = 'rubble';
                this.blockedGrid[r][c] = true;
            }
        });

        // Urban Street Props (Abandoned Yellow Taxis, NYPD Cruisers, Burnt Buses, Subway Entrances)
        const propPlacements = [
            { type: 'taxi', x: 27 * 32 + 12, y: 71 * 32, rot: 1.57 },
            { type: 'nypd', x: 25 * 32 + 16, y: 75 * 32 + 10, rot: 0.2 },
            { type: 'bus',  x: 47 * 32 + 16, y: 70 * 32, rot: 1.45 },
            { type: 'taxi', x: 45 * 32 + 10, y: 57 * 32 + 14, rot: -0.15 },
            { type: 'nypd', x: 67 * 32 + 12, y: 54 * 32, rot: 1.65 },
            { type: 'taxi', x: 27 * 32 + 18, y: 36 * 32, rot: 1.3 },
            { type: 'bus',  x: 47 * 32 + 12, y: 34 * 32, rot: 1.72 },
            { type: 'nypd', x: 35 * 32, y: 21 * 32 + 14, rot: 0.1 },
            { type: 'taxi', x: 67 * 32 + 14, y: 18 * 32, rot: 1.57 },
            { type: 'subway', x: 25 * 32, y: 63 * 32, rot: 0 },
            { type: 'subway', x: 45 * 32, y: 45 * 32, rot: 0 },
            { type: 'subway', x: 65 * 32, y: 27 * 32, rot: 0 }
        ];
        propPlacements.forEach(p => this.cityProps.push(p));
    },

    populateCityInfestation() {
        // Place zombie packs occupying streets, intersections, alleys, and building courtyards
        const streetPacks = [
            // Financial District
            { c: 34, r: 75, count: 5, mix: ['walker', 'runner'] },
            { c: 48, r: 81, count: 6, mix: ['walker', 'walker', 'spitter'] },
            { c: 66, r: 86, count: 6, mix: ['walker', 'runner', 'brute'] },
            { c: 86, r: 76, count: 5, mix: ['walker', 'spitter'] },
            // SoHo & Greenwich Village
            { c: 22, r: 74, count: 5, mix: ['walker', 'runner'] },
            { c: 10, r: 62, count: 5, mix: ['walker', 'walker', 'spitter'] },
            { c: 27, r: 62, count: 6, mix: ['runner', 'walker'] },
            { c: 42, r: 63, count: 5, mix: ['walker', 'brute'] },
            // Lower East Side
            { c: 56, r: 74, count: 6, mix: ['walker', 'runner', 'spitter'] },
            { c: 67, r: 62, count: 6, mix: ['walker', 'walker', 'brute'] },
            { c: 86, r: 66, count: 5, mix: ['runner', 'spitter'] },
            // Midtown & Times Square
            { c: 27, r: 50, count: 7, mix: ['walker', 'runner', 'spitter'] },
            { c: 47, r: 46, count: 8, mix: ['walker', 'runner', 'brute'] },
            { c: 67, r: 48, count: 7, mix: ['walker', 'spitter', 'brute'] },
            { c: 27, r: 30, count: 8, mix: ['runner', 'runner', 'spitter'] },
            { c: 47, r: 28, count: 8, mix: ['walker', 'runner', 'brute'] },
            { c: 67, r: 28, count: 7, mix: ['walker', 'spitter', 'brute'] },
            // Central Park & Upper East Side
            { c: 34, r: 14, count: 7, mix: ['runner', 'spitter', 'brute'] },
            { c: 48, r: 16, count: 8, mix: ['walker', 'runner', 'brute'] },
            { c: 67, r: 12, count: 7, mix: ['spitter', 'brute', 'walker'] }
        ];

        streetPacks.forEach(pack => {
            // Update 4: packs are 4x larger (the rest of the 10x infestation is spread through the blocks)
            const total = Math.max(pack.count, Math.round(pack.count * 4 * Math.min(1, ZOMBIE_POP_MULT / 10)));
            for (let i = 0; i < total; i++) {
                const extra = i >= pack.count;
                const ang = (i / total) * Math.PI * 2 + Math.random() * 0.4;
                const dist = extra ? 30 + Math.random() * 100 : 16 + Math.random() * 44;
                const zx = pack.c * TILE_SIZE + Math.cos(ang) * dist;
                const zy = pack.r * TILE_SIZE + Math.sin(ang) * dist;
                const tc = Math.floor(zx / TILE_SIZE);
                const tr = Math.floor(zy / TILE_SIZE);
                if (extra && this.isInSpawnExclusion(zx, zy)) continue;
                if (this.blockedGrid[tr] && !this.blockedGrid[tr][tc]) {
                    const zType = pack.mix[i % pack.mix.length];
                    this.createZombie(zType, zx, zy, false);
                }
            }
        });
    },

    // Update 4: keep the extra infestation clear of the player's LZ and of bandit camps / survivor outposts
    isInSpawnExclusion(x, y) {
        const T = TILE_SIZE;
        if (Math.hypot(x - 14 * T, y - 84 * T) < 900) return true; // Battery Park LZ
        for (const [c, r] of [[14, 50], [58, 64], [53, 50], [35, 53], [55, 34]]) {
            if (Math.hypot(x - (c * T + 16), y - (r * T + 16)) < 650) return true;
        }
        for (const [c, r] of [[13, 64], [23, 33], [69, 79], [72, 13]]) {
            if (Math.hypot(x - (c * T + 16), y - (r * T + 16)) < 110) return true;
        }
        return false;
    },

    // Update 4: fill city blocks, plazas and parks with roaming infected clusters up to ~10x the original population
    populateDenseInfestation() {
        const T = TILE_SIZE;
        const target = 162 * ZOMBIE_POP_MULT;
        let count = this.entities.filter(e => e.category === 'zombie').length;
        let attempts = 0;
        while (count < target && attempts++ < 6000) {
            const c = 5 + Math.floor(Math.random() * 86);
            const r = 3 + Math.floor(Math.random() * 88);
            if (!this.isTileOpen(c, r)) continue;
            const cx = c * T + T / 2, cy = r * T + T / 2;
            if (this.isInSpawnExclusion(cx, cy)) continue;
            const dist = this.getDistrictAtWorld(cx, cy);
            if (!dist || dist.id === 'battery') continue;
            // Deeper (northern) districts hold nastier strains
            const mix = r < 22 ? { walker: 0.45, runner: 0.25, spitter: 0.15, brute: 0.15 }
                      : (r < 58 ? { walker: 0.55, runner: 0.25, spitter: 0.13, brute: 0.07 }
                                : { walker: 0.65, runner: 0.25, spitter: 0.08, brute: 0.02 });
            const size = Math.min(target - count, 6 + Math.floor(Math.random() * 7));
            for (let i = 0; i < size; i++) {
                const zx = cx + (Math.random() - 0.5) * 120;
                const zy = cy + (Math.random() - 0.5) * 120;
                if (!this.isTileOpen(Math.floor(zx / T), Math.floor(zy / T))) continue;
                let roll = Math.random(), type = 'walker';
                for (const [t, w] of Object.entries(mix)) { roll -= w; if (roll <= 0) { type = t; break; } }
                this.createZombie(type, zx, zy, false);
                count++;
            }
        }
    },

    createSupplyDepot(x, y, scrapRate, fuelRate) {
        const dep = {
            id: this.nextEntityId++,
            category: 'depot',
            faction: 'neutral',
            type: 'depot',
            name: 'Urban Supply Depot',
            x, y,
            radius: 28,
            scrapRate,
            fuelRate,
            claimedBy: null
        };
        this.entities.push(dep);
        return dep;
    },

    getDistrictAtWorld(wx, wy) {
        if (this.infinite) { const S = 2 * INF_CHUNK * TILE_SIZE; return (this._districtIndex && this._districtIndex.get('s_' + Math.floor(wx / S) + '_' + Math.floor(wy / S))) || null; }
        const c = Math.floor(wx / TILE_SIZE);
        const r = Math.floor(wy / TILE_SIZE);
        return this.districts.find(d => c >= d.c1 && c <= d.c2 && r >= d.r1 && r <= d.r2) || null;
    },

    updateDistrictStates(silent = false) {
        if (this.infinite) return this.updateDistrictStatesInfinite(silent);
        let changed = false;

        for (const d of this.districts) {
            const x1 = d.c1 * TILE_SIZE;
            const y1 = d.r1 * TILE_SIZE;
            const x2 = (d.c2 + 1) * TILE_SIZE;
            const y2 = (d.r2 + 1) * TILE_SIZE;

            let hivesAlive = 0;
            let zombiesAlive = 0;
            let playerUnitsInside = 0;
            let lastZombie = null;

            for (const ent of this.entities) {
                if (ent.x >= x1 && ent.x <= x2 && ent.y >= y1 && ent.y <= y2) {
                    if (ent.category === 'hive') hivesAlive++;
                    else if (ent.category === 'zombie' && !ent.attackHq) {
                        zombiesAlive++;
                        lastZombie = ent;
                    } else if (ent.faction === 'player') {
                        playerUnitsInside++;
                    }
                }
            }

            d.hivesAlive = hivesAlive;
            d.zombiesAlive = zombiesAlive;

            if (d.status !== 'reclaimed') {
                if (hivesAlive === 0 && zombiesAlive === 0) {
                    d.status = 'reclaimed';
                    changed = true;
                    if (!silent) {
                        this.scrap += d.rewardScrap;
                        this.fuel += d.rewardFuel;
                        const cx = (x1 + x2) / 2;
                        const cy = (y1 + y2) / 2;
                        this.particles.push({
                            x: cx, y: cy, radius: 24, expandRate: 340,
                            color: '#3fb950', life: 0.9, maxLife: 0.9, global: true
                        });
                        sfx.playRadioAck('liberate');
                        this.showRadio(`🗽 DISTRICT RECLAIMED: ${d.name.toUpperCase()} SECURED! (+${d.rewardScrap} SCRAP, +${d.rewardFuel} FUEL)`);
                    }
                } else {
                    const newStatus = (playerUnitsInside > 0 || hivesAlive === 0) ? 'contested' : 'infested';
                    if (d.status !== newStatus) {
                        d.status = newStatus;
                        changed = true;
                    }
                    // If all hives in district are dead and <= 2 zombies remain while player troops are inside, highlight stragglers
                    if (hivesAlive === 0 && zombiesAlive > 0 && zombiesAlive <= 2 && playerUnitsInside > 0 && lastZombie) {
                        const tc = Math.floor(lastZombie.x / TILE_SIZE);
                        const tr = Math.floor(lastZombie.y / TILE_SIZE);
                        if (this.fog[tr] && this.fog[tr][tc] !== undefined) this.fog[tr][tc] = 2;
                        if (Math.random() < 0.25) {
                            this.pings.push({ x: lastZombie.x, y: lastZombie.y, color: '#ffa657', life: 0.7 });
                        }
                    }
                }
            }
        }

        if (changed && this.selectedIds.size === 0) {
            this.updateSelectionUI();
        }
    }
});
