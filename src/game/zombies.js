'use strict';
// Zombie AI, screamers, mutations and hive behaviour
defineGameMethods({
    updateZombie(z, dt) {
        // Update 3: temporary speed modifiers (Screamer frenzy, Stalker lunge, wave marching pace)
        const baseSpeed = z.speed;
        if (z.frenzyTimer > 0) {
            z.frenzyTimer -= dt;
            z.speed = baseSpeed * 1.3;
        }
        if (z.lungeTimer > 0) {
            z.lungeTimer -= dt;
            z.speed = baseSpeed * 2.6;
        }
        try {
            this.updateZombieCore(z, dt);
        } finally {
            z.speed = baseSpeed;
        }
    },

    updateZombieCore(z, dt) {
        if (z.lungeCooldown > 0) z.lungeCooldown -= dt;

        // Zombies hunt every living faction: player forces, mercenaries and survivors alike.
        // Update 4 (performance): instead of a full search every frame, each zombie keeps its current
        // target and re-scans on a staggered timer (fast when engaged, slower when idle).
        const zdefAA = ZOMBIE_DEFS[z.type];
        const canHitAir = !!(zdefAA && zdefAA.antiAir);
        let target = z.targetId ? this.getEntityById(z.targetId) : null;
        if (target && (target.hp <= 0 || (target.isAir && !canHitAir) ||
            (target.category === 'building' && target.type === 'gate' && target.isOpen) ||
            Math.hypot(target.x - z.x, target.y - z.y) > 300)) {
            target = null;
        }
        z.scanTimer = (z.scanTimer === undefined ? Math.random() * 0.5 : z.scanTimer) - dt;
        if (z.scanTimer <= 0 || (z.targetId && !target)) {
            z.scanTimer = target ? 0.25 : 0.4 + Math.random() * 0.3;
            target = this.findNearestHostile(z, 250, canHitAir);
        }
        // Update 4: marching wave hordes stay focused on their objective — they only peel off for
        // bandits/survivors that come close, so they don't trample every camp along the route
        if (target && z.waveGroupId && target.faction !== 'player' && Math.hypot(target.x - z.x, target.y - z.y) > 140) {
            const wg = this.waveGroups.find(gq => gq.id === z.waveGroupId);
            if (wg && wg.phase !== 'assault') target = null;
        }
        z.targetId = target ? target.id : null;

        // Update 5 HIVE-MIND: a zombie that has spotted the player's forces broadcasts their position (throttled)
        if (target) {
            z.hiveGoal = null;
            if (target.faction === 'player') {
                z.alertCd = (z.alertCd || 0) - dt;
                if (z.alertCd <= 0) {
                    z.alertCd = 1.5;
                    this.raiseAlert(target.x, target.y, 0.3);
                }
            }
        }

        // Dormant zombies (nothing in sight, no wave orders) listen for the hive's alerts and converge on them
        if (!target && !z.waveGroupId && !z.attackHq) {
            z.hiveScan = (z.hiveScan === undefined ? Math.random() * 2 : z.hiveScan) - dt;
            if (!z.hiveGoal && z.hiveScan <= 0) {
                z.hiveScan = 1.2 + Math.random();
                const goal = this.findHiveAlert(z.x, z.y);
                if (goal) { z.hiveGoal = goal; z.hiveGoalTime = 25; }
            }
            if (z.hiveGoal) {
                z.hiveGoalTime -= dt;
                if (z.hiveGoalTime <= 0 || Math.hypot(z.hiveGoal.x - z.x, z.hiveGoal.y - z.y) < 50) {
                    z.hiveGoal = null;
                } else {
                    this.moveEntityToward(z, z.hiveGoal.x, z.hiveGoal.y, dt);
                }
            }
            return;
        }

        // Screamers periodically howl, sending nearby infected into a frenzy
        if (z.type === 'screamer') {
            z.screamTimer = (z.screamTimer || 0) - dt;
            if (z.screamTimer <= 0 && target && Math.hypot(target.x - z.x, target.y - z.y) < 320) {
                z.screamTimer = 7;
                this.triggerScreamerHowl(z);
            }
        }

        // Update 3: organized wave members hold formation while mustering & marching
        if (!target && z.waveGroupId) {
            const grp = this.waveGroups.find(g => g.id === z.waveGroupId);
            if (grp && grp.phase !== 'assault') {
                const slot = this.getWaveSlotPosition(grp, z);
                const d = Math.hypot(slot.x - z.x, slot.y - z.y);
                if (d > 10) {
                    if (d < 70) z.speed = Math.min(z.speed, grp.speed * 1.15);
                    this.moveEntityToward(z, slot.x, slot.y, dt);
                } else {
                    z.angle = grp.heading;
                }
                return;
            }
            if (grp && grp.targetId) {
                target = this.getEntityById(grp.targetId);
            }
        }

        if (!target && z.attackHq) {
            // Update 4: HQ / fallback target cached once per frame instead of searched per zombie
            target = this.getHqOrAnyPlayer();
        }

        if (target) {
            const dist = Math.hypot(target.x - z.x, target.y - z.y);
            const effRange = z.range + target.radius;
            z.angle = Math.atan2(target.y - z.y, target.x - z.x);

            // Stalkers lunge across the last stretch
            if (z.type === 'stalker' && dist > effRange && dist < 150 && !(z.lungeCooldown > 0)) {
                z.lungeTimer = 0.35;
                z.lungeCooldown = 4;
            }

            if (dist <= effRange) {
                if (z.cooldown <= 0) {
                    z.cooldown = z.fireRate;
                    if (z.type === 'spitter') {
                        this.fireAcidGlob(z, target);
                    } else {
                        this.damageEntity(target, z.damage, 'zombie');
                        this.spawnImpactParticles(target.x, target.y, '#f85149', 4);
                        const zdef = ZOMBIE_DEFS[z.type];
                        // Abominations smash everything around their target
                        if (zdef && zdef.splash) {
                            const smashed = [];
                            this.forEachInRadius(target.x, target.y, zdef.splash + MAX_ENTITY_RADIUS, (o) => {
                                if (o === target || o.isAir || !this.areHostile('zombie', o.faction)) return;
                                if (Math.hypot(o.x - target.x, o.y - target.y) <= zdef.splash + (o.radius || 0)) smashed.push(o);
                            });
                            smashed.forEach(o => this.damageEntity(o, Math.round(z.damage * 0.5), 'zombie'));
                            this.particles.push({ x: target.x, y: target.y, radius: 8, expandRate: zdef.splash * 3, color: '#8a3b5e', life: 0.3, maxLife: 0.3 });
                        }
                        // Update 3: scratches may infect humans
                        if (target.hp > 0) {
                            const chance = INFECTION_CHANCE[z.type] !== undefined ? INFECTION_CHANCE[z.type] : 0.07;
                            this.tryInfect(target, chance);
                        }
                    }
                }
            } else {
                this.moveEntityToward(z, target.x, target.y, dt);
            }
        }
    },

    triggerScreamerHowl(z) {
        for (const o of this.entities) {
            if (o.category !== 'zombie' || o === z) continue;
            if (Math.hypot(o.x - z.x, o.y - z.y) <= 280) o.frenzyTimer = 5;
        }
        this.particles.push({ x: z.x, y: z.y, radius: 10, expandRate: 520, color: '#f85149', life: 0.5, maxLife: 0.5 });
        if (this.isWorldPointVisible(z.x, z.y)) sfx.playZombieGroan();
    },

    getUnlockedMutants(waveNum) {
        return Object.keys(ZOMBIE_DEFS).filter(t => ZOMBIE_DEFS[t].unlockWave && ZOMBIE_DEFS[t].unlockWave <= waveNum);
    },

    updateHive(hive, dt) {
        // Update 5 HIVE-MIND: hives answer strong nearby alerts by rousing their guards and birthing reinforcements
        hive.mindTimer = (hive.mindTimer === undefined ? Math.random() * 5 : hive.mindTimer) - dt;
        if (hive.mindTimer <= 0) {
            hive.mindTimer = 5;
            const goal = this.findHiveAlert(hive.x, hive.y, 1000, 2.0, false);
            // the hive's answer shares the alert's recruitment quota (and the LZ pool near the player's HQ)
            let budget = 0;
            if (goal) {
                budget = Math.max(0, this.alertQuota(this.alertStr[goal.cell]) - this.alertRecruits[goal.cell]);
                if (this.nearPlayerHq(goal.x, goal.y)) budget = Math.min(budget, Math.max(0, this.hqRecruitQuota() - (this.hqRecruits || 0)));
                budget = Math.min(10, Math.floor(budget));
            }
            if (goal && budget > 0) {
                let roused = 0;
                const claimOne = () => {
                    this.alertRecruits[goal.cell]++;
                    if (this.nearPlayerHq(goal.x, goal.y)) this.hqRecruits = (this.hqRecruits || 0) + 1;
                };
                this.forEachInRadius(hive.x, hive.y, 600, (z) => {
                    if (roused >= budget - 2) return;
                    if (z.category !== 'zombie' || z.targetId || z.waveGroupId || z.attackHq || z.hiveGoal) return;
                    z.hiveGoal = { x: goal.x + (Math.random() - 0.5) * 120, y: goal.y + (Math.random() - 0.5) * 120 };
                    z.hiveGoalTime = 30;
                    roused++;
                    claimOne();
                });
                const room = Math.max(0, HIVE_POP_CAP + 200 - (this.zombieCount || 0));
                for (let i = 0; i < Math.min(budget - roused, 4, room); i++) {
                    const ang = Math.random() * Math.PI * 2;
                    const sx = hive.x + Math.cos(ang) * (hive.radius + 16), sy = hive.y + Math.sin(ang) * (hive.radius + 16);
                    if (!this.isTileOpen(Math.floor(sx / TILE_SIZE), Math.floor(sy / TILE_SIZE))) continue;
                    const pool = hive.spawnPool || ['walker', 'runner'];
                    const nz = this.createZombie(pool[Math.floor(Math.random() * pool.length)], sx, sy, false);
                    nz.hiveGoal = { x: goal.x, y: goal.y };
                    nz.hiveGoalTime = 30;
                    claimOne();
                    if (this.zombieCount !== undefined) this.zombieCount++;
                }
                if (this.isEntityVisible(hive)) {
                    this.particles.push({ x: hive.x, y: hive.y, radius: hive.radius, expandRate: 260, color: '#f85149', life: 0.8, maxLife: 0.8 });
                    sfx.playZombieGroan();
                }
            }
        }
        hive.spawnTimer -= dt;
        if (hive.spawnTimer <= 0) {
            hive.spawnTimer = Math.max(9.5, hive.spawnInterval - this.surgeWave * 0.6);
            const activeZombies = this.zombieCount !== undefined ? this.zombieCount : this.entities.filter(e => e.category === 'zombie').length;
            // Update 4: hives birth a burst of up to 10 infected per cycle (10x), refilling the city up to a 10x cap
            const burst = Math.max(0, Math.min(ZOMBIE_POP_MULT, HIVE_POP_CAP - activeZombies));
            const sleepRec = (this.infinite && !this.isActivePos(hive.x, hive.y)) ? this.chunks.get(this.chunkKeyAt(hive.x, hive.y)) : null;
            for (let bi = 0; bi < burst; bi++) {
                const ang = Math.random() * Math.PI * 2;
                const sx = hive.x + Math.cos(ang) * (hive.radius + 16);
                const sy = hive.y + Math.sin(ang) * (hive.radius + 16);
                if (sleepRec) {
                    const pool0 = hive.spawnPool || ['walker', 'runner'];
                    if (sleepRec.frozen.length < Math.round(320 * Math.max(0.2, ZOMBIE_POP_MULT / 10))) sleepRec.frozen.push([pool0[Math.floor(Math.random() * pool0.length)], Math.round(sx), Math.round(sy), 0]);
                    continue;
                }
                const tc = Math.floor(sx / TILE_SIZE);
                const tr = Math.floor(sy / TILE_SIZE);
                if (this.blockedGrid[tr] && !this.blockedGrid[tr][tc]) {
                    const pool = hive.spawnPool || ['walker', 'runner'];
                    let zType = pool[Math.floor(Math.random() * pool.length)];
                    // Update 3: as the infestation develops, hives increasingly birth mutated strains
                    const wavesDone = this.surgeWave - 1;
                    const mutants = this.getUnlockedMutants(wavesDone).filter(t => t !== 'abomination');
                    if (mutants.length > 0 && Math.random() < Math.min(0.3, 0.05 * (wavesDone - 2))) {
                        zType = mutants[Math.floor(Math.random() * mutants.length)];
                    }
                    const nz = this.createZombie(zType, sx + (Math.random() - 0.5) * 20, sy + (Math.random() - 0.5) * 20, false);
                    if (this.zombieCount !== undefined) this.zombieCount++;
                }
            }
        }
    }
});
