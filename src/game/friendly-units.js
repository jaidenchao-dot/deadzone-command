'use strict';
// Player unit & vehicle AI (the per-frame update for every friendly mobile) and weapon firing
defineGameMethods({
    // Update 4: weapons with salvo bursts (rocket artillery) fire the remaining rockets over a short interval
    fireWeapon(ent, tx, ty) {
        // Update 5: a weapon only fires while its own ammunition type lasts
        if (!this.hasAmmo(ent)) {
            ent.muzzleFlash = 0;
            this.onOutOfAmmo(ent);
            return false;
        }
        this.useAmmo(ent, ent.ammoType);
        // Update 5: starving soldiers can't aim straight
        if (ent.food !== undefined && ent.food <= 0) {
            tx += (Math.random() - 0.5) * 90;
            ty += (Math.random() - 0.5) * 90;
        }
        const def = ent.category === 'vehicle' ? VEHICLE_DEFS[ent.type] : null;
        if (def && def.burst) {
            ent.burstLeft = def.burst - 1;
            ent.burstTimer = def.burstInterval;
            ent.burstTarget = { x: tx, y: ty };
            const sp = def.burstSpread || 0;
            this.fireProjectile(ent, tx + (Math.random() - 0.5) * sp, ty + (Math.random() - 0.5) * sp, ent.weapon);
            return true;
        }
        this.fireProjectile(ent, tx, ty, ent.weapon);
        return true;
    },

    updateFriendlyMobile(ent, dt) {
        if (ent.isAir) {
            ent.rotorAngle += dt * 24;
        }

        // Update 4: remaining rockets of a salvo
        if (ent.burstLeft > 0 && ent.burstTarget) {
            ent.burstTimer -= dt;
            if (ent.burstTimer <= 0) {
                const def = VEHICLE_DEFS[ent.type];
                ent.burstTimer = def.burstInterval;
                ent.burstLeft--;
                if (this.hasAmmo(ent)) {
                    this.useAmmo(ent, ent.ammoType);
                    ent.muzzleFlash = 0.06;
                    const sp = def.burstSpread || 0;
                    this.fireProjectile(ent, ent.burstTarget.x + (Math.random() - 0.5) * sp, ent.burstTarget.y + (Math.random() - 0.5) * sp, ent.weapon);
                } else {
                    ent.burstLeft = 0; // salvo cut short: out of rockets
                }
            }
        }

        // Update 4: Medic passive healing (separate from the 6-charge infection treatment)
        if (ent.type === 'medic') this.updateMedicPassiveHeal(ent, dt);

        // Update 4: idle mechanics automatically fix nearby damaged friendly equipment
        if (ent.type === 'mechanic' && ent.state === 'idle' && !ent.holdPosition) {
            ent.autoRepairScan = (ent.autoRepairScan || 0) - dt;
            if (ent.autoRepairScan <= 0) {
                ent.autoRepairScan = 1.0;
                const job = this.findRepairJob(ent.x, ent.y, 260);
                if (job) {
                    ent.state = 'repair';
                    ent.targetId = job.id;
                    ent.targetPos = null;
                }
            }
        }

        // Update 4: unarmed civilian vehicles never fire
        if (ent.civilian && ent.state === 'attack') {
            ent.state = 'idle';
            ent.targetId = null;
        }

        // Update 3: rescued survivor units keep their support skills (medic heals, mechanic repairs)
        if (ent.isSurvivor && ent.category === 'unit' && ent.unarmed) {
            this.runSurvivorAbilities(ent, dt);
        }

        // Update 3: survivors ordered to RETURN TO HQ walk in and join the base
        if (ent.state === 'returnhq') {
            const hq = this.entities.find(e => e.faction === 'player' && e.type === 'hq');
            if (!hq) {
                ent.state = 'idle';
                ent.targetPos = null;
                return;
            }
            if (Math.hypot(hq.x - ent.x, hq.y - ent.y) <= hq.radius + 34) {
                this.removeEntityQuiet(ent);
                this.deliverSurvivor(ent, ent.x, ent.y);
                this.updateSelectionUI();
                return;
            }
            this.moveEntityToward(ent, hq.x, hq.y, dt);
            return;
        }

        if (ent.crushesZombies) {
            const crushed = [];
            this.forEachInRadius(ent.x, ent.y, ent.radius + MAX_ENTITY_RADIUS, (z) => {
                if (z.category === 'zombie' && !(ZOMBIE_DEFS[z.type] && ZOMBIE_DEFS[z.type].heavy) &&
                    Math.hypot(z.x - ent.x, z.y - ent.y) < ent.radius + z.radius) crushed.push(z);
            });
            crushed.forEach(z => this.killEntity(z));
        }

        // Only soldiers (and armed militia) shoot from firing ports — unarmed civilian passengers don't
        const portShooters = ent.firingPorts ? ent.passengers.filter(p => (!p.isSurvivor || p.armed) && this.hasAmmo(p)) : [];
        if (ent.firingPorts && portShooters.length > 0) {
            ent.portCooldown = Math.max(0, ent.portCooldown - dt);
            if (ent.portCooldown <= 0) {
                const portTarget = this.findNearestEnemy(ent.x, ent.y, 215);
                if (portTarget) {
                    ent.portCooldown = 0.35;
                    const shooter = portShooters[Math.floor(Math.random() * portShooters.length)];
                    this.useAmmo(shooter, shooter.ammoType); // firing-port shots use the passenger's own ammo
                    this.fireProjectile({
                        x: ent.x,
                        y: ent.y,
                        faction: 'player',
                        damage: shooter.damage,
                        splash: shooter.splash || 0
                    }, portTarget.x, portTarget.y, shooter.weapon);
                }
            }
        }

        if (ent.state === 'board' && ent.targetId) {
            const veh = this.entities.find(e => e.id === ent.targetId && e.category === 'vehicle');
            if (!veh || veh.passengers.length >= veh.capacity || (veh.canFly && !veh.landed)) {
                ent.state = 'idle';
                ent.targetId = null;
                return;
            }
            const dist = Math.hypot(veh.x - ent.x, veh.y - ent.y);
            if (dist <= veh.radius + ent.radius + 12) {
                veh.passengers.push(ent);
                this.selectedIds.delete(ent.id);
                const idx = this.entities.indexOf(ent);
                if (idx !== -1) this.entities.splice(idx, 1);
                ent._removed = true;
                // Update 4: commandeer an abandoned civilian vehicle
                if (veh.abandoned) {
                    veh.abandoned = false;
                    veh.faction = 'player';
                    veh.state = 'idle';
                    veh.targetPos = null;
                    this.knownStructures.delete(veh.id);
                    sfx.playRadioAck('build');
                    this.showRadio(`🔑 ${ent.name.toUpperCase()} HOTWIRED THE ${veh.name.replace('Abandoned ', '').toUpperCase()} — IT'S YOURS TO DRIVE.`);
                    veh.name = veh.name.replace('Abandoned ', 'Commandeered ');
                    this.recalcPopulation();
                }
                sfx.playRadioAck('confirm');
                this.updateSelectionUI();
                return;
            }
            this.moveEntityToward(ent, veh.x, veh.y, dt);
            return;
        }

        if (ent.state === 'scavenge' && ent.targetId) {
            const crate = this.entities.find(e => e.id === ent.targetId && e.category === 'crate');
            if (!crate) {
                ent.state = 'idle';
                ent.targetId = null;
                return;
            }
            if (Math.hypot(crate.x - ent.x, crate.y - ent.y) <= ent.radius + crate.radius + 10) {
                this.scrap += crate.scrapValue;
                this.fuel += crate.fuelValue;
                this.particles.push({
                    x: crate.x, y: crate.y - 12, vy: -22,
                    text: `+${crate.scrapValue} SCRAP +${crate.fuelValue} FUEL`,
                    color: '#7ee787', life: 1.4, maxLife: 1.4
                });
                const idx = this.entities.indexOf(crate);
                if (idx !== -1) this.entities.splice(idx, 1);
                crate._removed = true;
                ent.state = 'idle';
                ent.targetId = null;
                sfx.playRadioAck('build');
                this.showRadio(`SUPPLY CRATE RECOVERED: +${crate.scrapValue} SCRAP, +${crate.fuelValue} FUEL!`);
                return;
            }
            this.moveEntityToward(ent, crate.x, crate.y, dt);
            return;
        }

        if (ent.state === 'repair' && ent.targetId) {
            const target = this.getEntityById(ent.targetId);
            // Destroyed things can't be repaired; finished or unfinished-construction targets end the job
            if (!target || target.hp >= target.maxHp || target.underConstruction || target.faction !== 'player') {
                if (target && target.hp >= target.maxHp && ent.type === 'mechanic') {
                    this.particles.push({ x: target.x, y: target.y - 18, vy: -16, text: '🔧 REPAIRED', color: '#58a6ff', life: 1.1, maxLife: 1.1 });
                }
                ent.state = 'idle';
                ent.targetId = null;
                ent.repairing = false;
                return;
            }
            if (Math.hypot(target.x - ent.x, target.y - ent.y) <= ent.radius + target.radius + 18) {
                const udef = UNIT_DEFS[ent.type];
                // Update 4: mechanics are the specialists; engineers keep their original 38 HP/s
                const rate = ent.type === 'mechanic'
                    ? (target.category === 'vehicle' ? udef.repairVehicle : udef.repairBuilding)
                    : 38;
                const before = target.hp;
                target.hp = Math.min(target.maxHp, target.hp + rate * dt);
                ent.repairing = true;
                ent.angle = Math.atan2(target.y - ent.y, target.x - ent.x);
                ent.repairFx = (ent.repairFx || 0) + (target.hp - before);
                if (ent.repairFx >= 25) {
                    this.particles.push({ x: target.x + (Math.random() - 0.5) * 16, y: target.y - 14, vy: -18,
                        text: `+${Math.round(ent.repairFx)}`, color: '#58a6ff', life: 0.8, maxLife: 0.8 });
                    ent.repairFx = 0;
                }
                if (Math.random() < 0.25) this.spawnImpactParticles(target.x, target.y, '#58a6ff', 1);
                return;
            }
            ent.repairing = false;
            this.moveEntityToward(ent, target.x, target.y, dt);
            return;
        }

        // Update 3: Combat Medic recharge after all treatments are spent
        if (ent.treatMax && ent.treatCharges <= 0 && ent.treatCooldown > 0) {
            ent.treatCooldown = Math.max(0, ent.treatCooldown - dt);
            if (ent.treatCooldown <= 0) {
                ent.treatCharges = ent.treatMax;
                if (this.selectedIds.has(ent.id)) this.updateSelectionUI();
                this.showRadio('✚ COMBAT MEDIC RESUPPLIED — 6 ANTI-VIRAL TREATMENTS READY.');
            }
        }

        // Update 5: secondary weapon (own ammo, own cooldown)
        if (ent.secondary) this.updateSecondaryWeapon(ent, dt);

        // Update 5: supply vehicles (aura resupply, targeted resupply runs, transfers)
        if (ent.supply && this.updateSupplyVehicle(ent, dt)) return;

        // Update 5: rappelling troops are on the rope; aircraft landing/takeoff & airbase store runs
        if (ent.rappelTimer > 0) { ent.rappelTimer -= dt; return; }
        // Update 6: soldiers being winched up (the helicopter drives the timer) / walking under / waiting for a helicopter
        if (ent.hoistTimer > 0) return;
        if ((ent.state === 'hoist' || ent.state === 'hoistwait') && this.updateHoistTrooper(ent, dt)) return;
        if (ent.canFly && this.updateFlight(ent, dt)) return;
        if (ent.state === 'tostore') { this.updateStoreRun(ent, dt); return; }
        if (ent.landed && ent.state === 'move') { ent.state = 'idle'; ent.targetPos = null; }

        // Update 3: infected passengers keep turning inside vehicles
        if (ent.passengers && ent.passengers.length > 0) {
            // Update 5: passengers get hungry too
            for (let pi = ent.passengers.length - 1; pi >= 0; pi--) {
                const hp = ent.passengers[pi];
                if (this.updateHunger(hp, dt)) {
                    ent.passengers.splice(pi, 1);
                    this.recalcPopulation();
                    if (this.selectedIds.has(ent.id)) this.updateSelectionUI();
                }
            }
            for (let pi = ent.passengers.length - 1; pi >= 0; pi--) {
                const p = ent.passengers[pi];
                if (!p.infected) continue;
                p.infectionTimer -= dt;
                if (p.infectionTimer <= 0) {
                    ent.passengers.splice(pi, 1);
                    const spot = this.findEjectSpot(ent, [], 0);
                    p.x = spot.x;
                    p.y = spot.y;
                    this.transformInfected(p, true);
                    this.damageEntity(ent, 40, 'zombie');
                    this.checkAbandonVehicle(ent);
                    if (this.selectedIds.has(ent.id)) this.updateSelectionUI();
                    if (!this.entities.includes(ent)) return;
                }
            }
        }

        // Update 3: Medic moving to cure an infected friendly
        if (ent.state === 'treat' && ent.targetId) {
            const patient = this.entities.find(e => e.id === ent.targetId);
            if (!patient || !patient.infected || !(ent.treatCharges > 0)) {
                if (patient && !patient.infected) this.showRadio('✚ PATIENT NO LONGER INFECTED — TREATMENT CANCELLED.');
                ent.state = 'idle';
                ent.targetId = null;
                return;
            }
            if (Math.hypot(patient.x - ent.x, patient.y - ent.y) <= ent.radius + patient.radius + 22) {
                this.cureInfection(ent, patient);
                ent.state = 'idle';
                ent.targetId = null;
                return;
            }
            this.moveEntityToward(ent, patient.x, patient.y, dt);
            return;
        }

        if (ent.state === 'unlock' && ent.targetId) {
            const shelter = this.entities.find(e => e.id === ent.targetId && e.category === 'shelter');
            if (!shelter || shelter.opened) {
                ent.state = 'idle';
                ent.targetId = null;
                return;
            }
            if (Math.hypot(shelter.x - ent.x, shelter.y - ent.y) <= ent.radius + shelter.radius + 16) {
                ent.angle = Math.atan2(shelter.y - ent.y, shelter.x - ent.x);
                shelter.unlockProgress = Math.min(shelter.unlockTime, shelter.unlockProgress + dt);
                if (Math.random() < 0.12) this.spawnImpactParticles(shelter.x, shelter.y, '#f2cc60', 1);
                if (shelter.unlockProgress >= shelter.unlockTime) {
                    this.openShelter(shelter, ent);
                    ent.state = 'idle';
                    ent.targetId = null;
                }
                return;
            }
            this.moveEntityToward(ent, shelter.x, shelter.y, dt);
            return;
        }

        // Update 3: unarmed survivors never engage — attack orders become a halt
        if (ent.unarmed && ent.state === 'attack') {
            ent.state = 'idle';
            ent.targetId = null;
        }

        if (ent.state === 'attack' && ent.targetId) {
            const target = this.entities.find(e => e.id === ent.targetId && this.areHostile('player', e.faction));
            if (!target) {
                ent.state = 'idle';
                ent.targetId = null;
            } else {
                const dist = Math.hypot(target.x - ent.x, target.y - ent.y);
                if (dist <= ent.range) {
                    ent.angle = Math.atan2(target.y - ent.y, target.x - ent.x);
                    if (ent.cooldown <= 0) {
                        ent.cooldown = ent.fireRate;
                        ent.muzzleFlash = 0.06;
                        this.fireWeapon(ent, target.x, target.y);
                    }
                } else {
                    this.moveEntityToward(ent, target.x, target.y, dt);
                }
                return;
            }
        }

        if (ent.state === 'move' && ent.targetPos) {
            const dist = Math.hypot(ent.targetPos.x - ent.x, ent.targetPos.y - ent.y);
            // Update 7: big vehicles park within a few px of the mark rather than circling for pixel precision
            if (dist <= (ent.category === 'vehicle' ? Math.max(8, (ent.radius || 16) * 0.6) : 8)) {
                ent.state = 'idle';
                ent.targetPos = null;
            } else {
                this.moveEntityToward(ent, ent.targetPos.x, ent.targetPos.y, dt);
                const opp = this.findNearestEnemy(ent.x, ent.y, ent.range);
                if (opp && ent.cooldown <= 0 && !ent.unarmed) {
                    ent.cooldown = ent.fireRate;
                    ent.muzzleFlash = 0.06;
                    this.fireWeapon(ent, opp.x, opp.y);
                }
                return;
            }
        }

        if (ent.unarmed) return; // civilians don't fire or advance toward threats on their own
        const enemy = this.findNearestEnemy(ent.x, ent.y, ent.range);
        if (enemy) {
            ent.angle = Math.atan2(enemy.y - ent.y, enemy.x - ent.x);
            if (ent.cooldown <= 0) {
                ent.cooldown = ent.fireRate;
                ent.muzzleFlash = 0.06;
                this.fireWeapon(ent, enemy.x, enemy.y);
            }
        } else if (!ent.holdPosition) {
            // Update 5: troops with empty magazines don't advance on the enemy
            const agroTarget = this.hasAmmo(ent) ? this.findNearestEnemy(ent.x, ent.y, ent.agroRange || (ent.range + 65)) : null;
            if (agroTarget) {
                this.moveEntityToward(ent, agroTarget.x, agroTarget.y, dt);
            }
        }
    }
});
