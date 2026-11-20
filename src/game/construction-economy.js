'use strict';
// Building placement, construction timers, production queues, upgrades, building updates, population & resources
defineGameMethods({
    // Update 4: Infinite resources — the real stockpile is saved and restored when switched off
    toggleInfiniteResources() {
        this.infiniteResources = !this.infiniteResources;
        if (this.infiniteResources) {
            this.savedScrap = this.scrap;
            this.savedFuel = this.fuel;
            this.applyInfiniteResources();
        } else {
            this.scrap = this.savedScrap !== undefined ? this.savedScrap : this.scrap;
            this.fuel = this.savedFuel !== undefined ? this.savedFuel : this.fuel;
        }
        const btn = document.getElementById('btn-infinite');
        btn.textContent = this.infiniteResources ? '∞ RESOURCES: ON' : '∞ RESOURCES: OFF';
        btn.classList.toggle('infinite-on', this.infiniteResources);
        document.querySelector('.res-scrap').classList.toggle('infinite', this.infiniteResources);
        document.querySelector('.res-fuel').classList.toggle('infinite', this.infiniteResources);
        sfx.playRadioAck('select');
        this.showRadio(this.infiniteResources ? '∞ INFINITE RESOURCES ENABLED — SCRAP & FUEL UNLIMITED.' : '∞ INFINITE RESOURCES DISABLED — NORMAL ECONOMY RESTORED.');
        this.updateHUDReadouts();
        this.updateSelectionUI();
    },

    applyInfiniteResources() {
        if (!this.infiniteResources) return;
        this.scrap = 999999;
        this.fuel = 999999;
    },

    // ========================================================================
    // 8. BASE BUILDING, DRAGGABLE WALLS, UPGRADES, ARTILLERY & MISSILES
    // ========================================================================
    findNearestFreeDepot(wx, wy, maxDist = 56) {
        let best = null;
        let bestDist = maxDist;
        for (const ent of this.entities) {
            if (ent.category === 'depot' && !ent.claimedBy) {
                const d = Math.hypot(ent.x - wx, ent.y - wy);
                if (d < bestDist) {
                    bestDist = d;
                    best = ent;
                }
            }
        }
        return best;
    },

    canPlaceBuildingAt(type, sx, sy) {
        const def = BUILDING_DEFS[type];
        const half = (def.size * TILE_SIZE) / 2;
        if (sx - half < 128 || sx + half > MAP_WIDTH - 128 || sy - half < 64 || sy + half > MAP_HEIGHT - 128) {
            return false;
        }

        if (def.requiresDepot) {
            const dep = this.findNearestFreeDepot(sx, sy, 20);
            return !!dep;
        }

        const cMin = Math.floor((sx - half + 4) / TILE_SIZE);
        const cMax = Math.floor((sx + half - 4) / TILE_SIZE);
        const rMin = Math.floor((sy - half + 4) / TILE_SIZE);
        const rMax = Math.floor((sy + half - 4) / TILE_SIZE);

        for (let r = rMin; r <= rMax; r++) {
            for (let c = cMin; c <= cMax; c++) {
                if (!this.fog[r] || this.fog[r][c] === 0) return false;
                if (this.blockedGrid[r] && this.blockedGrid[r][c]) return false;
            }
        }

        for (const ent of this.entities) {
            if (ent.category === 'building' || ent.category === 'hive' || ent.category === 'depot' ||
                ent.category === 'mercstruct' || ent.category === 'fort' || ent.category === 'shelter') {
                const minDist = half + ent.radius - 4;
                if (Math.hypot(ent.x - sx, ent.y - sy) < minDist) return false;
            }
        }
        return true;
    },

    tryPlaceBuilding(wx, wy) {
        const type = this.buildPlacementType;
        if (!type) return;
        const def = BUILDING_DEFS[type];

        if (this.scrap < def.scrap || this.fuel < def.fuel) {
            this.showRadio('INSUFFICIENT SCRAP OR FUEL FOR CONSTRUCTION.');
            sfx.playRadioAck('alert');
            return;
        }

        let sx = (type === 'wall' || type === 'gate')
            ? Math.floor(wx / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2
            : Math.round(wx / 16) * 16;
        let sy = (type === 'wall' || type === 'gate')
            ? Math.floor(wy / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2
            : Math.round(wy / 16) * 16;

        let targetDepot = null;
        if (def.requiresDepot) {
            targetDepot = this.findNearestFreeDepot(wx, wy, 56);
            if (!targetDepot) {
                this.showRadio('RESOURCE COLLECTORS MUST BE PLACED ON AN UNCLAIMED SUPPLY DEPOT.');
                sfx.playRadioAck('alert');
                return;
            }
            sx = targetDepot.x;
            sy = targetDepot.y;
        }

        if (!this.canPlaceBuildingAt(type, sx, sy)) {
            this.showRadio('INVALID BUILD LOCATION — OBSTRUCTED BY CITY STRUCTURE OR UNEXPLORED.');
            sfx.playRadioAck('alert');
            return;
        }

        this.scrap -= def.scrap;
        this.fuel -= def.fuel;
        const bld = this.createBuilding(type, sx, sy, true, this.placementRotation);
        this.startConstruction(bld);

        if (targetDepot) {
            bld.depotId = targetDepot.id;
            bld.scrapRate = targetDepot.scrapRate;
            bld.fuelRate = targetDepot.fuelRate;
            targetDepot.claimedBy = bld.id;
        }

        this.spawnImpactParticles(sx, sy, '#8b949e', 14);
        sfx.playRadioAck('build');
        this.showRadio(`CONSTRUCTION STARTED: ${def.name.toUpperCase()} (${def.buildTime || 0}s)`);
        sfx.playConstruction();

        if (type !== 'wall' && type !== 'gate') {
            this.buildPlacementType = null;
            this.updateRotateButtonUI();
        }
        this.recalcPopulation();
        this.updateSelectionUI();
    },

    updateDragBuildLine(wx, wy) {
        if (!this.dragBuildStart) return;
        const endX = Math.floor(wx / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
        const endY = Math.floor(wy / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;

        const dx = endX - this.dragBuildStart.x;
        const dy = endY - this.dragBuildStart.y;
        const tiles = [];

        if (Math.abs(dx) >= Math.abs(dy)) {
            const step = dx >= 0 ? TILE_SIZE : -TILE_SIZE;
            const count = Math.min(24, Math.floor(Math.abs(dx) / TILE_SIZE));
            for (let i = 0; i <= count; i++) {
                tiles.push({ x: this.dragBuildStart.x + i * step, y: this.dragBuildStart.y });
            }
        } else {
            const step = dy >= 0 ? TILE_SIZE : -TILE_SIZE;
            const count = Math.min(24, Math.floor(Math.abs(dy) / TILE_SIZE));
            for (let i = 0; i <= count; i++) {
                tiles.push({ x: this.dragBuildStart.x, y: this.dragBuildStart.y + i * step });
            }
        }
        this.dragBuildTiles = tiles;
    },

    commitDragBuildLine() {
        const type = this.buildPlacementType;
        if (!type || this.dragBuildTiles.length === 0) return;
        const def = BUILDING_DEFS[type];
        let builtCount = 0;

        for (const tile of this.dragBuildTiles) {
            if (this.scrap < def.scrap || this.fuel < def.fuel) break;
            if (this.canPlaceBuildingAt(type, tile.x, tile.y)) {
                this.scrap -= def.scrap;
                this.fuel -= def.fuel;
                this.startConstruction(this.createBuilding(type, tile.x, tile.y, true, this.placementRotation));
                builtCount++;
            }
        }

        if (builtCount > 0) {
            sfx.playRadioAck('build');
            this.showRadio(`CONSTRUCTING ${builtCount}x ${def.name.toUpperCase()} SEGMENTS (${def.buildTime || 0}s EACH).`);
            this.updateSelectionUI();
        }
    },

    dismantleSelectedBuildings() {
        const selectedBlds = this.entities.filter(e =>
            this.selectedIds.has(e.id) &&
            e.faction === 'player' &&
            e.category === 'building' &&
            e.type !== 'hq'
        );
        if (selectedBlds.length === 0) return;

        let refundScrap = 0;
        let refundFuel = 0;
        selectedBlds.forEach(bld => {
            const def = BUILDING_DEFS[bld.type];
            refundScrap += Math.floor((def.scrap || 0) * 0.6);
            refundFuel += Math.floor((def.fuel || 0) * 0.6);
            if (bld.type === 'collector' && bld.depotId) {
                const dep = this.entities.find(d => d.id === bld.depotId);
                if (dep) dep.claimedBy = null;
            }
            this.spawnImpactParticles(bld.x, bld.y, '#d29922', 12);
            const idx = this.entities.indexOf(bld);
            if (idx !== -1) this.entities.splice(idx, 1);
            bld._removed = true;
            this.selectedIds.delete(bld.id);
        });

        this.scrap += refundScrap;
        this.fuel += refundFuel;
        sfx.playDismantle();
        this.showRadio(`DISMANTLED ${selectedBlds.length} STRUCTURE(S) — SALVAGED +${refundScrap} SCRAP, +${refundFuel} FUEL.`);
        this.recalcPopulation();
        this.updateSelectionUI();
    },

    upgradeCollector(col) {
        if (col.level >= 3) return;
        const upgScrap = col.level === 1 ? 240 : 380;
        const upgFuel = col.level === 1 ? 70 : 140;
        if (this.scrap < upgScrap || this.fuel < upgFuel) {
            this.showRadio('INSUFFICIENT RESOURCES FOR COLLECTOR UPGRADE.');
            sfx.playRadioAck('alert');
            return;
        }
        this.scrap -= upgScrap;
        this.fuel -= upgFuel;
        col.level++;
        col.scrapRate = Math.round(col.scrapRate * 1.45);
        col.fuelRate = Math.round(col.fuelRate * 1.45);
        col.maxHp += 220;
        col.hp = col.maxHp;
        this.spawnImpactParticles(col.x, col.y, '#f2cc60', 16);
        sfx.playRadioAck('build');
        this.showRadio(`RESOURCE COLLECTOR UPGRADED TO LEVEL ${col.level}!`);
        this.updateSelectionUI();
    },

    purchaseUpgrade(uKey) {
        if (this.upgrades[uKey]) return;
        const def = UPGRADE_DEFS[uKey];
        if (this.scrap < def.scrap || this.fuel < def.fuel) {
            this.showRadio('INSUFFICIENT SCRAP OR FUEL FOR RESEARCH.');
            sfx.playRadioAck('alert');
            return;
        }
        this.scrap -= def.scrap;
        this.fuel -= def.fuel;
        this.upgrades[uKey] = true;

        this.entities.forEach(e => {
            if (e.faction !== 'player') return;
            if (uKey === 'ballistics' && e.damage) {
                e.damage = Math.round(e.damage * 1.25);
            } else if (uKey === 'armor') {
                e.maxHp = Math.round(e.maxHp * 1.25);
                e.hp = Math.min(e.maxHp, Math.round(e.hp * 1.25));
            }
        });

        sfx.playRadioAck('build');
        this.showRadio(`TECH RESEARCHED: ${def.name.toUpperCase()}!`);
        this.updateSelectionUI();
    },

    queueUnitProduction(bld, unitType, mode = 'unit') {
        const isVehicle = mode === 'vehicle';
        const isBattalion = mode === 'battalion';
        const def = isBattalion ? BATTALION_DEFS[unitType] : (isVehicle ? VEHICLE_DEFS[unitType] : UNIT_DEFS[unitType]);

        if (bld.queue.length >= 5) return false;
        if (this.scrap < def.scrap || this.fuel < def.fuel) {
            this.showRadio('INSUFFICIENT SCRAP OR FUEL.');
            sfx.playRadioAck('alert');
            return false;
        }
        if (this.popUsed + def.pop > this.popMax) {
            this.showRadio('COMMAND LIMIT REACHED. BUILD BARRACKS, BATTALION HQ, OR MOTOR POOL.');
            sfx.playRadioAck('alert');
            return false;
        }
        if (def.requiresArmory && !this.hasCompletedBuilding('armory')) {
            this.showRadio('REQUIRES ARMORY & TECH LAB.');
            sfx.playRadioAck('alert');
            return false;
        }

        this.scrap -= def.scrap;
        this.fuel -= def.fuel;
        bld.queue.push({ unitType, isVehicle, isBattalion, progress: 0, totalTime: def.buildTime });
        return true;
    },

    queueAcrossSelectedBuildings(blds, unitType, mode = 'unit') {
        let queuedCount = 0;
        const sorted = [...blds].sort((a, b) => a.queue.length - b.queue.length);
        for (const b of sorted) {
            if (this.queueUnitProduction(b, unitType, mode)) {
                queuedCount++;
            } else {
                break;
            }
        }
        if (queuedCount > 0) {
            sfx.playRadioAck('confirm');
            if (queuedCount > 1) {
                this.showRadio(`QUEUED PRODUCTION ACROSS ${queuedCount} BUILDINGS SIMULTANEOUSLY.`);
            }
            this.updateSelectionUI();
        }
    },

    // ========================================================================
    // UPDATE 4: CONSTRUCTION TIMERS
    // ========================================================================
    startConstruction(bld) {
        const def = BUILDING_DEFS[bld.type];
        if (!def || !def.buildTime) return bld;
        bld.underConstruction = true;
        bld.buildTime = def.buildTime;
        bld.buildProgress = 0;
        bld.hp = Math.max(1, Math.round(bld.maxHp * 0.1));
        return bld;
    },

    hasCompletedBuilding(type) {
        return this.entities.some(e => e.category === 'building' && e.faction === 'player' && e.type === type && !e.underConstruction);
    },

    updateConstruction(bld, dt) {
        // Engineers standing nearby speed construction up by 50%
        const assisted = this.entities.some(e => e.faction === 'player' && e.type === 'engineer' && Math.hypot(e.x - bld.x, e.y - bld.y) < bld.radius + 110);
        const step = dt * (assisted ? 1.5 : 1.0);
        bld.buildAssisted = assisted;
        bld.buildProgress = Math.min(bld.buildTime, bld.buildProgress + step);
        bld.hp = Math.min(bld.maxHp, bld.hp + (bld.maxHp * 0.9) * (step / bld.buildTime));
        if (bld.buildProgress >= bld.buildTime) {
            bld.underConstruction = false;
            this.spawnImpactParticles(bld.x, bld.y, '#3fb950', 12);
            if (bld.type !== 'wall' && bld.type !== 'gate') {
                sfx.playRadioAck('build');
                this.showRadio(`CONSTRUCTION COMPLETE: ${BUILDING_DEFS[bld.type].name.toUpperCase()}`);
            }
            this.recalcPopulation();
            this.updateSelectionUI();
        }
    },

    updateBuilding(bld, dt) {
        // Structures do nothing (no production, harvesting, firing or gate operation) until built
        if (bld.underConstruction) {
            this.updateConstruction(bld, dt);
            return;
        }
        // Update 6: Medic Tent treats one wounded friendly soldier at a time
        if (bld.type === 'medictent') this.updateMedicTent(bld, dt);
        // Update 5: stored aircraft refuel gradually at the Airbase
        if (bld.type === 'airbase') {
            for (const a of bld.storedHelis.concat(bld.storedPlanes)) {
                if (a.fuelMax) { a.fuel = Math.min(a.fuelMax, a.fuel + AIRBASE_REFUEL_RATE * dt); a._lowFuelWarned = false; }
            }
        }
        if (bld.type === 'collector') {
            bld.harvestTimer += dt;
            if (bld.harvestTimer >= 5.0) {
                bld.harvestTimer = 0;
                // Rescued mechanics boost collector output
                const yieldMult = this.getCollectorYieldMult();
                const gainS = Math.round(bld.scrapRate * yieldMult);
                const gainF = Math.round(bld.fuelRate * yieldMult);
                this.scrap += gainS;
                this.fuel += gainF;
                this.particles.push({
                    x: bld.x,
                    y: bld.y - 24,
                    vy: -18,
                    text: `+${gainS}S +${gainF}F`,
                    color: '#f2cc60',
                    life: 1.3,
                    maxLife: 1.3
                });
            }
            return;
        }

        if (bld.type === 'silo' && bld.missileCooldown > 0) {
            bld.missileCooldown = Math.max(0, bld.missileCooldown - dt);
        }

        if (bld.type === 'gate') {
            if (bld.manualGateState === 'open') {
                bld.isOpen = true;
            } else if (bld.manualGateState === 'closed') {
                bld.isOpen = false;
            } else {
                const friendlyNear = this.entities.some(e =>
                    e.faction === 'player' &&
                    (e.category === 'unit' || e.category === 'vehicle') &&
                    !e.isAir &&
                    Math.hypot(e.x - bld.x, e.y - bld.y) < 56
                );
                if (friendlyNear !== bld.isOpen) {
                    bld.isOpen = friendlyNear;
                    sfx.playGateToggle(bld.isOpen);
                }
            }
            return;
        }

        if (bld.type === 'turret') {
            const target = this.findNearestEnemy(bld.x, bld.y, bld.range);
            if (target) {
                bld.angle = Math.atan2(target.y - bld.y, target.x - bld.x);
                if (bld.cooldown <= 0) {
                    bld.cooldown = bld.fireRate;
                    bld.muzzleFlash = 0.06;
                    this.fireProjectile(bld, target.x, target.y, 'rifle');
                }
            }
            return;
        }

        if (bld.type === 'artillery') {
            if (bld.bombardTarget) {
                const spreadX = bld.bombardTarget.x + (Math.random() - 0.5) * 58;
                const spreadY = bld.bombardTarget.y + (Math.random() - 0.5) * 58;
                bld.angle = Math.atan2(spreadY - bld.y, spreadX - bld.x);
                if (bld.cooldown <= 0) {
                    bld.cooldown = bld.fireRate;
                    bld.muzzleFlash = 0.14;
                    this.fireProjectile(bld, spreadX, spreadY, 'artillery');
                    if (!bld.bombardLoop) {
                        bld.bombardTarget = null;
                        this.updateSelectionUI();
                    }
                }
            } else {
                const target = this.findNearestEnemy(bld.x, bld.y, bld.range, true);
                if (target) {
                    bld.angle = Math.atan2(target.y - bld.y, target.x - bld.x);
                    if (bld.cooldown <= 0) {
                        bld.cooldown = bld.fireRate;
                        bld.muzzleFlash = 0.14;
                        this.fireProjectile(bld, target.x, target.y, 'artillery');
                    }
                }
            }
            return;
        }

        if (bld.queue.length > 0) {
            const item = bld.queue[0];
            item.progress += dt;
            if (item.progress >= item.totalTime) {
                bld.queue.shift();
                const spawnX = bld.x + (Math.random() - 0.5) * 26;
                const spawnY = bld.y + bld.radius + 22;

                if (item.isBattalion) {
                    const batDef = BATTALION_DEFS[item.unitType];
                    const spawnedTroops = [];
                    let idx = 0;
                    batDef.composition.forEach(group => {
                        for (let k = 0; k < group.count; k++) {
                            const ang = (idx / batDef.pop) * Math.PI * 2;
                            const rad = 22 + Math.floor(idx / 6) * 18;
                            const u = this.createUnit(group.type, bld.x + Math.cos(ang) * rad, bld.y + bld.radius + 24 + Math.sin(ang) * rad);
                            spawnedTroops.push(u);
                            idx++;
                        }
                    });
                    if (bld.rallyPoint && spawnedTroops.length > 0) {
                        const slots = this.computeFormationPositions(spawnedTroops, bld.rallyPoint.x, bld.rallyPoint.y);
                        spawnedTroops.forEach((u, i) => {
                            u.state = 'move';
                            u.targetPos = slots[i];
                        });
                    }
                    this.showRadio(`BATTALION DEPLOYED: ${batDef.name.toUpperCase()} (${spawnedTroops.length} TROOPS)!`);
                } else if (item.isVehicle) {
                    const v = this.createVehicle(item.unitType, spawnX, spawnY);
                    if (bld.rallyPoint) {
                        v.state = 'move';
                        v.targetPos = { x: bld.rallyPoint.x, y: bld.rallyPoint.y };
                    }
                    this.showRadio(`VEHICLE DEPLOYED: ${VEHICLE_DEFS[item.unitType].name.toUpperCase()}`);
                } else {
                    const u = this.createUnit(item.unitType, spawnX, spawnY);
                    if (bld.rallyPoint) {
                        u.state = 'move';
                        u.targetPos = { x: bld.rallyPoint.x, y: bld.rallyPoint.y };
                    }
                    this.showRadio(`UNIT READY: ${UNIT_DEFS[item.unitType].name.toUpperCase()}`);
                }
                sfx.playRadioAck('confirm');
                this.recalcPopulation();
                this.updateSelectionUI();
            }
        }
    },

    getCollectorYieldMult() {
        return 1 + Math.min(0.5, this.rescued.mechanic * 0.10);
    },

    recalcPopulation() {
        let used = 0;
        let max = 10;
        for (const ent of this.entities) {
            if (ent.faction !== 'player') continue;
            if (ent.category === 'unit') {
                used += UNIT_DEFS[ent.type].pop;
            } else if (ent.category === 'vehicle') {
                used += VEHICLE_DEFS[ent.type].pop;
                if (ent.passengers) {
                    // Rescued survivors riding along don't consume command population
                    ent.passengers.forEach(p => { if (!p.isSurvivor && UNIT_DEFS[p.type]) used += UNIT_DEFS[p.type].pop; });
                }
            } else if (ent.category === 'building') {
                const def = BUILDING_DEFS[ent.type];
                if (def.popBonus && ent.type !== 'hq' && !ent.underConstruction) max += def.popBonus;
                // Stored aircraft still count against the command limit
                if (ent.type === 'airbase') ent.storedHelis.concat(ent.storedPlanes).forEach(a => { used += VEHICLE_DEFS[a.type].pop; });
                if (ent.queue) {
                    ent.queue.forEach(q => {
                        const qDef = q.isBattalion ? BATTALION_DEFS[q.unitType] : (q.isVehicle ? VEHICLE_DEFS[q.unitType] : UNIT_DEFS[q.unitType]);
                        used += qDef.pop;
                    });
                }
            }
        }
        // Rescued survivors working as base support staff
        max += this.getSurvivorPopBonus();
        this.popUsed = used;
        this.popMax = max;
    }
});
