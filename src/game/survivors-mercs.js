'use strict';
// Survivors (shelters, outposts, intel signals, escort & abilities) and the mercenary faction
defineGameMethods({
    populateSurvivorsAndMercs() {
        const T = TILE_SIZE;

        // ---- A. UNARMED SURVIVORS sealed inside locked rooms (door tile adjacent to a city building)
        const shelterSpots = [
            { c: 13, r: 64, label: 'West Village Brownstone Basement', occupants: ['civilian', 'civilian', 'medic'] },
            { c: 23, r: 33, label: 'Port Authority Ticket Office',     occupants: ['civilian', 'mechanic'] },
            { c: 69, r: 79, label: 'Fulton Block Pharmacy',            occupants: ['civilian', 'medic'] },
            { c: 72, r: 13, label: 'Met Museum Storage Vault',         occupants: ['civilian', 'civilian', 'mechanic'] }
        ];
        const shelters = [];
        shelterSpots.forEach(sp => {
            const t = this.findOpenTileNear(sp.c, sp.r, 2);
            if (!t) return;
            const sh = {
                id: this.nextEntityId++,
                category: 'shelter',
                faction: 'neutral',
                type: 'shelter',
                name: 'Locked Survivor Shelter',
                label: sp.label,
                x: t.c * T + T / 2,
                y: t.r * T + T / 2,
                radius: 16,
                occupants: sp.occupants.slice(),
                opened: false,
                unlockProgress: 0,
                unlockTime: 2.5,
                groupId: null
            };
            sh.groupId = 'shelter_' + sh.id;
            this.entities.push(sh);
            shelters.push(sh);
        });

        // ---- B. ARMED SURVIVORS holding fortified outposts
        const outpostSpots = [
            { c: 35, r: 53, name: 'Penn Station Holdouts', militia: 3, extras: ['civilian'] },
            { c: 55, r: 34, name: 'Grand Central Militia', militia: 3, extras: ['mechanic'] }
        ];
        outpostSpots.forEach(sp => {
            const op = {
                id: this.nextEntityId++,
                name: sp.name,
                x: sp.c * T + T / 2,
                y: sp.r * T + T / 2,
                radius: 84,
                contacted: false,
                discovered: false,
                groupId: null
            };
            op.groupId = 'outpost_' + op.id;
            this.outposts.push(op);

            // Barricade ring (Chebyshev radius 2) with four open entrances
            for (let dr = -2; dr <= 2; dr++) {
                for (let dc = -2; dc <= 2; dc++) {
                    if (Math.max(Math.abs(dc), Math.abs(dr)) !== 2) continue;
                    if (dc === 0 || dr === 0) continue;
                    const c = sp.c + dc, r = sp.r + dr;
                    if (!this.isTileOpen(c, r)) continue;
                    const bx = c * T + T / 2, by = r * T + T / 2;
                    if (!this.isSpotClearOfEntities(bx, by, 18)) continue;
                    this.entities.push({
                        id: this.nextEntityId++,
                        category: 'fort',
                        faction: 'survivor',
                        type: 'barricade',
                        name: 'Survivor Barricade',
                        x: bx, y: by,
                        radius: 14,
                        hp: 500, maxHp: 500,
                        outpostId: op.id
                    });
                }
            }
            // Armed defenders on the firing line, non-combatants in the middle
            for (let i = 0; i < sp.militia; i++) {
                const ang = (i / sp.militia) * Math.PI * 2 + 0.4;
                const m = this.createSurvivor('militia', op.x + Math.cos(ang) * 36, op.y + Math.sin(ang) * 36, op.groupId);
                m.state = 'guard';
                m.outpostId = op.id;
                m.postX = m.x;
                m.postY = m.y;
            }
            sp.extras.forEach((type, i) => {
                const s = this.createSurvivor(type, op.x + (i - 0.5) * 12, op.y, op.groupId);
                s.state = 'guard';
                s.outpostId = op.id;
                s.postX = s.x;
                s.postY = s.y;
            });
        });

        // ---- C. HOSTILE MERCENARY TERRITORIES (fortified bandit camps)
        const campSpots = [
            { c: 14, r: 50, name: 'Chelsea Scrapyard Gang',   raiders: 3, gunners: 1, marksmen: 1, towers: 1, maxMembers: 6, lootScrap: 320, lootFuel: 120 },
            { c: 58, r: 64, name: 'Delancey Toll Crew',       raiders: 4, gunners: 1, marksmen: 1, towers: 1, maxMembers: 7, lootScrap: 360, lootFuel: 140 },
            { c: 53, r: 50, name: 'Murray Hill Warlord Camp', raiders: 4, gunners: 2, marksmen: 2, towers: 2, maxMembers: 9, lootScrap: 480, lootFuel: 200 }
        ];
        campSpots.forEach(sp => this.createMercCamp(sp));

        // ---- D. ESTIMATED SURVIVOR INTEL (offset zones + false leads)
        this.generateSurvivorIntel(shelters);
    },

    createSurvivor(type, x, y, groupId = null) {
        const def = SURVIVOR_DEFS[type];
        const s = {
            id: this.nextEntityId++,
            category: 'survivor',
            faction: 'survivor',
            isSurvivor: true,
            type,
            variant: Math.floor(Math.random() * 3),
            name: def.name,
            x, y,
            radius: def.radius,
            hp: def.hp,
            maxHp: def.hp,
            speed: def.speed,
            armed: !!def.armed,
            range: def.range || 0,
            damage: def.damage || 0,
            fireRate: def.fireRate || 1,
            splash: 0,
            weapon: def.weapon || null,
            angle: Math.random() * Math.PI * 2,
            cooldown: 0,
            muzzleFlash: 0,
            state: 'wait',
            followId: null,
            followAngle: Math.random() * Math.PI * 2,
            groupId,
            outpostId: null,
            postX: x,
            postY: y,
            joinCooldown: 0,
            abilityTimer: Math.random() * 0.5
        };
        this.entities.push(s);
        return s;
    },

    createMercCamp(sp) {
        const T = TILE_SIZE;
        const camp = {
            id: this.nextEntityId++,
            name: sp.name,
            x: sp.c * T + T / 2,
            y: sp.r * T + T / 2,
            radius: 290,
            maxMembers: sp.maxMembers,
            reinforceInterval: 40,
            reinforceTimer: 40,
            alertTimer: 0,
            alive: true,
            discovered: false,
            bunkerId: null,
            lootScrap: sp.lootScrap,
            lootFuel: sp.lootFuel
        };
        this.mercCamps.push(camp);

        // Stronghold in the center
        const bunker = this.createMercStructure('bunker', camp.x, camp.y, camp.id);
        camp.bunkerId = bunker.id;

        // Scrap barricade ring (Chebyshev radius 3) with four entrances
        for (let dr = -3; dr <= 3; dr++) {
            for (let dc = -3; dc <= 3; dc++) {
                if (Math.max(Math.abs(dc), Math.abs(dr)) !== 3) continue;
                if (dc === 0 || dr === 0) continue;
                const c = sp.c + dc, r = sp.r + dr;
                if (!this.isTileOpen(c, r)) continue;
                const wx = c * T + T / 2, wy = r * T + T / 2;
                if (!this.isSpotClearOfEntities(wx, wy, 20)) continue;
                this.createMercStructure('wall', wx, wy, camp.id);
            }
        }

        // Watchtowers on the inner corners
        const towerOffsets = [[2, -2], [-2, 2], [-2, -2], [2, 2]];
        for (let i = 0; i < sp.towers && i < towerOffsets.length; i++) {
            const t = this.findOpenTileNear(sp.c + towerOffsets[i][0], sp.r + towerOffsets[i][1], 1);
            if (t) this.createMercStructure('tower', t.c * T + T / 2, t.r * T + T / 2, camp.id);
        }

        // Garrison
        const roster = [];
        for (let i = 0; i < sp.gunners; i++) roster.push('gunner');
        for (let i = 0; i < sp.marksmen; i++) roster.push('marksman');
        for (let i = 0; i < sp.raiders; i++) roster.push('raider');
        roster.forEach((type, i) => {
            const ang = (i / roster.length) * Math.PI * 2;
            const rad = type === 'raider' ? 70 + Math.random() * 40 : 58;
            const px = camp.x + Math.cos(ang) * rad;
            const py = camp.y + Math.sin(ang) * rad;
            const tile = this.findOpenTileNear(Math.floor(px / T), Math.floor(py / T), 2);
            if (!tile) return;
            this.createMerc(type, tile.c * T + T / 2, tile.r * T + T / 2, camp.id);
        });
        return camp;
    },

    createMerc(type, x, y, campId) {
        const def = MERC_DEFS[type];
        const m = {
            id: this.nextEntityId++,
            category: 'merc',
            faction: 'merc',
            type,
            name: def.name,
            x, y,
            radius: def.radius,
            hp: def.hp,
            maxHp: def.hp,
            speed: def.speed,
            range: def.range,
            damage: def.damage,
            fireRate: def.fireRate,
            splash: 0,
            vision: def.vision,
            aggro: def.aggro,
            weapon: def.weapon,
            angle: Math.random() * Math.PI * 2,
            cooldown: Math.random() * def.fireRate,
            muzzleFlash: 0,
            campId,
            postX: x,
            postY: y,
            thinkTimer: Math.random() * 0.4,
            targetId: null
        };
        this.entities.push(m);
        return m;
    },

    createMercStructure(type, x, y, campId) {
        const def = MERC_STRUCT_DEFS[type];
        const s = {
            id: this.nextEntityId++,
            category: 'mercstruct',
            faction: 'merc',
            type,
            name: def.name,
            x, y,
            radius: def.radius,
            size: def.size,
            hp: def.hp,
            maxHp: def.hp,
            range: def.range || 0,
            damage: def.damage || 0,
            fireRate: def.fireRate || 0,
            splash: 0,
            weapon: def.weapon || null,
            angle: Math.random() * Math.PI * 2,
            cooldown: 0,
            muzzleFlash: 0,
            campId
        };
        this.entities.push(s);
        return s;
    },

    generateSurvivorIntel(shelters) {
        const sigs = [];
        const flavors = ['DISTRESS BEACON', 'RADIO CHATTER', 'FLARE SIGHTING', 'DRONE THERMAL HIT', 'SOS GRAFFITI', 'GUNFIRE REPORT'];
        const addSignal = (tx, ty, refType, refId) => {
            const ang = Math.random() * Math.PI * 2;
            const off = 45 + Math.random() * 85;
            sigs.push({
                x: Math.max(160, Math.min(MAP_WIDTH - 160, tx + Math.cos(ang) * off)),
                y: Math.max(120, Math.min(MAP_HEIGHT - 160, ty + Math.sin(ang) * off)),
                radius: 170 + Math.random() * 30,
                trueX: tx, trueY: ty,
                refType, refId,
                status: 'unknown',
                flavor: flavors[Math.floor(Math.random() * flavors.length)],
                fade: 0
            });
        };
        shelters.forEach(sh => addSignal(sh.x, sh.y, 'shelter', sh.id));
        this.outposts.forEach(op => addSignal(op.x, op.y, 'outpost', op.id));
        // False leads — intel is an estimate, not a guarantee
        addSignal(41 * TILE_SIZE, 37 * TILE_SIZE, null, null);
        addSignal(81 * TILE_SIZE, 55 * TILE_SIZE, null, null);

        // Shuffle so signal order/label never reveals which leads are real
        for (let i = sigs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [sigs[i], sigs[j]] = [sigs[j], sigs[i]];
        }
        const callsigns = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT', 'GOLF', 'HOTEL'];
        sigs.forEach((s, i) => { s.id = i + 1; s.label = `SIGNAL ${callsigns[i] || i + 1}`; });
        this.survivorIntel = sigs;
    },

    getSurvivorPopBonus() {
        return this.rescued.civilian + this.rescued.medic + this.rescued.mechanic + this.rescued.militia;
    },

    // ========================================================================
    // UPDATE 2: HOSTILE MERCENARY AI
    // ========================================================================
    updateMerc(m, dt) {
        const camp = this.mercCamps.find(c => c.id === m.campId);
        const homeX = camp ? camp.x : m.postX;
        const homeY = camp ? camp.y : m.postY;
        const alerted = camp && camp.alertTimer > 0;
        // Update 4: with the 10x infestation, calm bandits hold their walls (still shooting anything in range);
        // they only push far out when the camp is under attack.
        const leash = camp ? camp.radius * (alerted ? 2.2 : 1.15) : 420;

        m.thinkTimer -= dt;
        if (m.thinkTimer <= 0) {
            m.thinkTimer = 0.3 + Math.random() * 0.2;
            const aggro = alerted ? Math.max(m.aggro, 400) : m.aggro;
            let t = this.findNearestHostile(m, aggro);
            // Bandits defend their turf — they won't chase targets far outside their territory
            if (t && Math.hypot(t.x - homeX, t.y - homeY) > leash) t = null;
            m.targetId = t ? t.id : null;

            // Raiders patrol inside the walls when nothing is around
            if (!t && m.type === 'raider' && camp && Math.random() < 0.06) {
                const ang = Math.random() * Math.PI * 2;
                const rad = 30 + Math.random() * camp.radius * 0.4;
                const tile = this.findOpenTileNear(
                    Math.floor((camp.x + Math.cos(ang) * rad) / TILE_SIZE),
                    Math.floor((camp.y + Math.sin(ang) * rad) / TILE_SIZE), 1);
                if (tile) {
                    m.postX = tile.c * TILE_SIZE + TILE_SIZE / 2;
                    m.postY = tile.r * TILE_SIZE + TILE_SIZE / 2;
                }
            }
        }

        const target = m.targetId ? this.getEntityById(m.targetId) : null;
        if (target) {
            const dist = Math.hypot(target.x - m.x, target.y - m.y);
            if (dist <= m.range + (target.radius || 0) * 0.5) {
                m.angle = Math.atan2(target.y - m.y, target.x - m.x);
                if (m.cooldown <= 0) {
                    m.cooldown = m.fireRate;
                    m.muzzleFlash = 0.06;
                    this.fireProjectile(m, target.x, target.y, m.weapon);
                }
            } else if (Math.hypot(m.x - homeX, m.y - homeY) < leash) {
                this.moveEntityToward(m, target.x, target.y, dt);
            } else {
                m.targetId = null;
            }
            return;
        }

        // Regroup at post / slow patrol
        if (m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + 1.0 * dt);
        if (Math.hypot(m.postX - m.x, m.postY - m.y) > 10) {
            this.moveEntityToward(m, m.postX, m.postY, m.type === 'raider' ? dt * 0.6 : dt);
        }
    },

    updateMercStructure(s, dt) {
        if (s.type !== 'tower') return;
        const target = this.findNearestHostile(s, s.range);
        if (target) {
            s.angle = Math.atan2(target.y - s.y, target.x - s.x);
            if (s.cooldown <= 0) {
                s.cooldown = s.fireRate;
                s.muzzleFlash = 0.06;
                this.fireProjectile(s, target.x, target.y, s.weapon);
            }
        }
    },

    updateMercCamps(dt) {
        for (const camp of this.mercCamps) {
            if (camp.alertTimer > 0) camp.alertTimer = Math.max(0, camp.alertTimer - dt);

            if (!camp.discovered) {
                const tc = Math.floor(camp.x / TILE_SIZE);
                const tr = Math.floor(camp.y / TILE_SIZE);
                if (this.fog[tr] && this.fog[tr][tc] > 0) {
                    camp.discovered = true;
                    sfx.playRadioAck('alert');
                    this.showRadio(`☠ HOSTILE MERCENARY TERRITORY SPOTTED: ${camp.name.toUpperCase()} — FORTIFIED & HEAVILY ARMED.`);
                }
            }

            if (!camp.alive) continue;
            camp.reinforceTimer -= dt;
            if (camp.reinforceTimer <= 0) {
                camp.reinforceTimer = camp.reinforceInterval;
                const bunker = this.entities.find(e => e.id === camp.bunkerId);
                if (!bunker) continue;
                const members = this.entities.filter(e => e.category === 'merc' && e.campId === camp.id).length;
                if (members < camp.maxMembers) {
                    const type = Math.random() < 0.25 ? 'gunner' : 'raider';
                    const ang = Math.random() * Math.PI * 2;
                    const tile = this.findOpenTileNear(
                        Math.floor((bunker.x + Math.cos(ang) * (bunker.radius + 20)) / TILE_SIZE),
                        Math.floor((bunker.y + Math.sin(ang) * (bunker.radius + 20)) / TILE_SIZE), 2);
                    if (tile) this.createMerc(type, tile.c * TILE_SIZE + TILE_SIZE / 2, tile.r * TILE_SIZE + TILE_SIZE / 2, camp.id);
                }
            }
        }
    },

    onMercStrongholdDestroyed(bunker, byPlayer) {
        const camp = this.mercCamps.find(c => c.id === bunker.campId);
        if (!camp) return;
        camp.alive = false;
        this.particles.push({ x: bunker.x, y: bunker.y, radius: 20, expandRate: 300, color: '#ffa657', life: 0.7, maxLife: 0.7 });
        this.decals.push({ x: bunker.x, y: bunker.y, radius: 40, color: 'rgba(10, 12, 15, 0.7)' });
        // The gang's stockpile spills out as a recoverable supply cache
        this.entities.push({
            id: this.nextEntityId++,
            category: 'crate',
            faction: 'neutral',
            type: 'crate',
            name: 'Bandit Stockpile Cache',
            x: bunker.x,
            y: bunker.y + 6,
            radius: 12,
            scrapValue: camp.lootScrap,
            fuelValue: camp.lootFuel
        });
        if (!byPlayer && !this.isEntityVisible(bunker)) return; // unseen — the player learns of it when they look
        sfx.playRadioAck('liberate');
        this.showRadio(byPlayer
            ? `☠ ${camp.name.toUpperCase()} STRONGHOLD DESTROYED — NO MORE REINFORCEMENTS. RECOVER THEIR STOCKPILE (+${camp.lootScrap} SCRAP, +${camp.lootFuel} FUEL)!`
            : `☠ ${camp.name.toUpperCase()} STRONGHOLD HAS FALLEN — ITS STOCKPILE IS UP FOR GRABS.`);
    },

    // ========================================================================
    // UPDATE 2: SURVIVOR AI, RESCUE, ESCORT, TRANSPORT & DELIVERY
    // ========================================================================
    openShelter(sh, rescuer) {
        sh.opened = true;
        sh.unlockProgress = sh.unlockTime;
        const n = sh.occupants.length;
        const baseAng = Math.atan2(rescuer.y - sh.y, rescuer.x - sh.x);
        sh.occupants.forEach((type, i) => {
            // Update 3: rescued survivors become independent player-owned units (they do NOT follow the rescuer)
            const ang = baseAng + (i - (n - 1) / 2) * 0.7;
            let sx = sh.x + Math.cos(ang) * 22;
            let sy = sh.y + Math.sin(ang) * 22;
            if (!this.isTileOpen(Math.floor(sx / TILE_SIZE), Math.floor(sy / TILE_SIZE))) { sx = sh.x; sy = sh.y; }
            const u = this.createUnit('surv_' + type, sx, sy);
            u.groupId = sh.groupId;
            u.angle = ang;
        });
        sh.occupants = [];
        sfx.playGateToggle(true);
        sfx.playRadioAck('liberate');
        this.spawnImpactParticles(sh.x, sh.y, '#56d4dd', 14);
        this.showRadio(`🚪 SHELTER BREACHED — ${n} SURVIVOR(S) FROM ${sh.label.toUpperCase()} JOIN YOUR COMMAND. SELECT THEM & USE RETURN TO HQ [R] NEAR BASE.`);
        this.recalcPopulation();
        if (this.selectedIds.has(sh.id)) this.updateSelectionUI();
    },

    // Update 3: armed outpost survivors join the player's command on first contact
    convertOutpostSurvivors(op) {
        const members = this.entities.filter(e => e.category === 'survivor' && e.groupId === op.groupId);
        members.forEach(m => {
            const u = this.createUnit('surv_' + m.type, m.x, m.y);
            u.groupId = op.groupId;
            u.angle = m.angle;
            u.hp = Math.max(1, Math.round(u.maxHp * (m.hp / m.maxHp)));
            if (m.infected) {
                u.infected = true;
                u.infectionTimer = m.infectionTimer;
            }
            // Militia keep defending their barricades until you give them orders
            if (u.armed) u.holdPosition = true;
            this.removeEntityQuiet(m);
        });
        this.recalcPopulation();
        return members.length;
    },

    deliverSurvivor(s, x, y) {
        this.survivorsRescued++;
        this.scrap += 25;
        let msg;
        const kind = String(s.type).replace('surv_', '');
        if (kind === 'militia') {
            if (this.popUsed + UNIT_DEFS.rifleman.pop <= this.popMax) {
                const u = this.createUnit('rifleman', x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 20);
                u.name = 'Enlisted Militia Rifleman';
                this.rescued.enlisted++;
                msg = 'ARMED MILITIA ENLISTED AS AN ASSAULT RIFLEMAN!';
            } else {
                this.rescued.militia++;
                msg = 'MILITIA VOLUNTEER JOINED BASE SUPPORT (+1 POP) — COMMAND LIMIT FULL FOR ENLISTMENT.';
            }
        } else {
            this.rescued[kind] = (this.rescued[kind] || 0) + 1;
            msg = kind === 'medic' ? 'FIELD MEDIC JOINED HQ TRIAGE (+1 POP, INFANTRY REGEN NEAR HQ).' :
                  (kind === 'mechanic' ? `MECHANIC JOINED THE MOTOR CREW (+1 POP, COLLECTORS +${Math.round((this.getCollectorYieldMult() - 1) * 100)}%).` :
                  'CIVILIAN JOINED BASE SUPPORT STAFF (+1 POP).');
        }
        this.particles.push({
            x, y: y - 14, vy: -20,
            text: '+SURVIVOR RESCUED', color: '#56d4dd', life: 1.5, maxLife: 1.5
        });
        sfx.playRadioAck('liberate');
        this.showRadio(`🏠 SURVIVOR DELIVERED (+25 SCRAP): ${msg}`);
        this.recalcPopulation();
        this.updateSurvivorPillTooltip();
    },

    updateSurvivorPillTooltip() {
        const pill = document.getElementById('pill-survivors');
        if (!pill) return;
        const r = this.rescued;
        pill.title = `Survivors rescued: ${this.survivorsRescued} | Lost: ${this.survivorsLost}\n` +
            `Support staff +${this.getSurvivorPopBonus()} Pop | Mechanics: Collectors +${Math.round((this.getCollectorYieldMult() - 1) * 100)}%\n` +
            `Medics: HQ triage ${Math.min(6, r.medic * 1.5).toFixed(1)} HP/s | Militia enlisted: ${r.enlisted}`;
    },

    updateSurvivorLogistics(dt) {
        this._baseBlds = this.entities.filter(e =>
            e.faction === 'player' && e.category === 'building' && (e.type === 'hq' || e.type === 'barracks' || e.type === 'battalionhq'));

        // Update 3: no automatic drop-offs — survivors are delivered only via the player's RETURN TO HQ order

        // HQ triage from rescued medics
        this.triageTimer -= dt;
        if (this.triageTimer <= 0) {
            this.triageTimer = 1.0;
            if (this.rescued.medic > 0) {
                const heal = Math.min(6, this.rescued.medic * 1.5);
                const hqs = this._baseBlds.filter(b => b.type === 'hq');
                for (const e of this.entities) {
                    if (e.faction !== 'player' || e.category !== 'unit' || e.hp >= e.maxHp) continue;
                    if (hqs.some(h => Math.hypot(h.x - e.x, h.y - e.y) <= 380)) {
                        e.hp = Math.min(e.maxHp, e.hp + heal);
                        if (Math.random() < 0.3) this.particles.push({ x: e.x, y: e.y - 12, vy: -14, text: '+', color: '#7ee787', life: 0.6, maxLife: 0.6 });
                    }
                }
            }
        }
    },

    runSurvivorAbilities(s, dt) {
        // Medics patch up nearby troops & survivors; mechanics patch nearby vehicles
        // (works for outpost survivors and for rescued survivor units: 'surv_medic' / 'surv_mechanic')
        const kind = String(s.type).replace('surv_', '');
        if (kind === 'medic' || kind === 'mechanic') {
            s.abilityTimer -= dt;
            if (s.abilityTimer <= 0) {
                s.abilityTimer = 0.5;
                for (const e of this.entities) {
                    if (e === s || typeof e.hp !== 'number' || e.hp >= e.maxHp) continue;
                    const ok = kind === 'medic'
                        ? ((e.faction === 'player' && e.category === 'unit') || e.category === 'survivor')
                        : (e.faction === 'player' && e.category === 'vehicle');
                    if (!ok || Math.hypot(e.x - s.x, e.y - s.y) > 80) continue;
                    e.hp = Math.min(e.maxHp, e.hp + (kind === 'medic' ? 4 : 6));
                    if (Math.random() < 0.35) {
                        this.particles.push({ x: e.x, y: e.y - 10, vy: -16, text: '+', color: s.type === 'medic' ? '#7ee787' : '#58a6ff', life: 0.6, maxLife: 0.6 });
                    }
                }
            }
        }
        // Armed survivors defend themselves against zombies and bandits
        if (s.armed) {
            const t = this.findNearestHostile(s, s.range);
            if (t) {
                s.angle = Math.atan2(t.y - s.y, t.x - s.x);
                if (s.cooldown <= 0) {
                    s.cooldown = s.fireRate;
                    s.muzzleFlash = 0.06;
                    this.fireProjectile(s, t.x, t.y, s.weapon);
                }
            }
        }
    },

    updateSurvivor(s, dt) {
        // Update 3: only un-contacted outpost defenders remain in the 'survivor' faction.
        // They hold their fortified post and defend themselves until your forces make contact.
        this.runSurvivorAbilities(s, dt);
        if (s.hp < s.maxHp) s.hp = Math.min(s.maxHp, s.hp + 1.2 * dt);
        if (Math.hypot(s.postX - s.x, s.postY - s.y) > 8) {
            this.moveEntityToward(s, s.postX, s.postY, dt);
        }
    },

    countGroupMembers(groupId) {
        let n = 0;
        for (const e of this.entities) {
            if (e.groupId === groupId && e.category !== 'zombie') n++;
            if (e.category === 'vehicle' && e.passengers) n += e.passengers.filter(p => p.groupId === groupId).length;
        }
        return n;
    },

    updateSurvivorIntel() {
        // Outpost first contact
        for (const op of this.outposts) {
            if (!op.discovered) {
                const tc = Math.floor(op.x / TILE_SIZE);
                const tr = Math.floor(op.y / TILE_SIZE);
                if (this.fog[tr] && this.fog[tr][tc] > 0) op.discovered = true;
            }
            if (!op.contacted && this.findNearestPlayerMobile(op.x, op.y, 210)) {
                op.contacted = true;
                const joined = this.convertOutpostSurvivors(op);
                if (joined > 0) {
                    sfx.playRadioAck('liberate');
                    this.showRadio(`📻 CONTACT: ${joined} ARMED SURVIVORS AT ${op.name.toUpperCase()} JOIN YOUR COMMAND — SELECT & CONTROL THEM; RETURN TO HQ [R] NEAR BASE.`);
                    this.updateSelectionUI();
                }
            }
        }

        for (let i = this.survivorIntel.length - 1; i >= 0; i--) {
            const sig = this.survivorIntel[i];
            if (sig.status === 'false') {
                sig.fade -= 0.5;
                if (sig.fade <= 0) this.survivorIntel.splice(i, 1);
                continue;
            }
            if (sig.status === 'unknown') {
                if (sig.refType) {
                    if (this.isWorldPointVisible(sig.trueX, sig.trueY)) {
                        sig.status = 'confirmed';
                        sfx.playRadioAck('confirm');
                        this.showRadio(`📡 ${sig.label} CONFIRMED — SURVIVORS SPOTTED!`);
                    }
                } else if (this.findNearestPlayerMobile(sig.x, sig.y, 95)) {
                    sig.status = 'false';
                    sig.fade = 4;
                    this.showRadio(`📡 ${sig.label}: NOTHING HERE — SIGNAL LOST (FALSE LEAD).`);
                }
                continue;
            }
            if (sig.status === 'confirmed') {
                if (sig.refType === 'shelter') {
                    const sh = this.entities.find(e => e.id === sig.refId);
                    // Update 3: signal resolved once the survivors are rescued into your command
                    if (!sh || sh.opened) this.survivorIntel.splice(i, 1);
                } else if (sig.refType === 'outpost') {
                    const op = this.outposts.find(o => o.id === sig.refId);
                    if (!op || op.contacted || this.countGroupMembers(op.groupId) === 0) this.survivorIntel.splice(i, 1);
                }
            }
        }
    }
});
