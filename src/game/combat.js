'use strict';
// Projectiles, impacts, cruise missile, damage & death, hostility, target searches, impact effects
defineGameMethods({
    fireProjectile(shooter, tx, ty, weaponType) {
        const dx = tx - shooter.x;
        const dy = ty - shooter.y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const NEW_WEAPON_SPEED = { rockets: 430, bomb: 240, hellfire: 620, flame: 360 };
        const speed = NEW_WEAPON_SPEED[weaponType] || (weaponType === 'artillery' ? 460 : (weaponType === 'cannon' ? 580 : (weaponType === 'acid' ? 320 : 760)));
        const soundType = { rockets: 'cannon', bomb: 'artillery', hellfire: 'cannon', flame: 'shotgun' }[weaponType] || weaponType;

        // Update 5 HIVE-MIND: the infestation hears the player's gunfire (louder weapons carry further)
        if (shooter.faction === 'player') this.raiseAlert(shooter.x, shooter.y, HEAVY_EXPLOSIVE_WEAPONS.has(weaponType) ? 0.5 : 0.12);
        if (shooter.faction === 'player' || ((shooter.faction === 'merc' || shooter.faction === 'survivor') && this.isWorldPointVisible(shooter.x, shooter.y))) {
            // Update 5: weapon-specific launch sounds, quieter with distance from the camera
            if (weaponType === 'rockets' || weaponType === 'hellfire') sfx.at(shooter.x, shooter.y).playLaunchWhoosh(weaponType === 'rockets');
            else if (weaponType === 'bomb') sfx.at(shooter.x, shooter.y).playBombWhistle();
            else if (weaponType === 'flame') sfx.at(shooter.x, shooter.y).playFlame();
            if (weaponType !== 'flame' && weaponType !== 'bomb') sfx.at(shooter.x, shooter.y).playGunshot(soundType);
        }

        this.projectiles.push({
            x: shooter.x,
            y: shooter.y,
            vx: (dx / dist) * speed,
            vy: (dy / dist) * speed,
            traveled: 0,
            maxDist: dist,
            faction: shooter.faction,
            damage: shooter.damage,
            splash: shooter.splash || 0,
            weapon: weaponType
        });
    },

    applyProjectileImpact(p) {
        if (p.splash > 0) {
            if (HEAVY_EXPLOSIVE_WEAPONS.has(p.weapon)) {
                sfx.at(p.x, p.y).playExplosion(p.weapon === 'artillery' || p.weapon === 'bomb' ? 1.1 : 0.85);
                // Update 5: brighter flash core, lingering smoke and flying debris
                this.particles.push({ x: p.x, y: p.y, radius: p.splash * 0.55, flash: true, color: '#fff3c4', life: 0.12, maxLife: 0.12 });
                this.spawnSmoke(p.x, p.y, p.weapon === 'bomb' ? 5 : 3, p.weapon === 'bomb' ? 1.3 : 0.9);
                this.spawnDebris(p.x, p.y, p.weapon === 'bomb' ? 10 : 5);
                this.particles.push({
                    x: p.x, y: p.y, radius: 10, expandRate: p.splash * 3.2,
                    color: '#ffa657', life: 0.35, maxLife: 0.35
                });
                this.decals.push({ x: p.x, y: p.y, radius: p.splash * 0.45, color: 'rgba(15, 17, 20, 0.55)' });
                if (this.decals.length > 110) this.decals.shift();
            }
            this.spawnImpactParticles(p.x, p.y, p.weapon === 'acid' ? '#7ee787' : (p.weapon === 'flame' ? '#ff9b42' : '#ffa657'), p.weapon === 'flame' ? 7 : 12);
            const hits = [];
            this.forEachInRadius(p.x, p.y, p.splash + MAX_ENTITY_RADIUS, (ent) => {
                if (!this.areHostile(p.faction, ent.faction)) return;
                const d = Math.hypot(ent.x - p.x, ent.y - p.y);
                if (d <= p.splash + ent.radius) hits.push([ent, d]);
            });
            hits.forEach(([ent, d]) => {
                const falloff = Math.max(0.4, 1 - d / (p.splash + ent.radius + 10));
                this.damageEntity(ent, Math.round(p.damage * falloff), p.faction);
            });
        } else {
            const sparkCol = p.faction === 'player' ? '#f2cc60' : (p.faction === 'merc' ? '#ff8e5a' : (p.faction === 'survivor' ? '#a5d6ff' : '#7ee787'));
            this.spawnImpactParticles(p.x, p.y, sparkCol, 4);
            let hit = null, hitD = Infinity;
            this.forEachInRadius(p.x, p.y, 14 + MAX_ENTITY_RADIUS, (ent) => {
                if (!this.areHostile(p.faction, ent.faction)) return;
                const d = Math.hypot(ent.x - p.x, ent.y - p.y);
                if (d <= ent.radius + 14 && d < hitD) { hitD = d; hit = ent; }
            });
            if (hit) this.damageEntity(hit, p.damage, p.faction);
        }
    },

    detonateCruiseMissile(wx, wy) {
        sfx.playExplosion(1.65);
        const blastRadius = 155;
        this.particles.push({
            x: wx, y: wy, radius: 16, expandRate: 420,
            color: '#ff7b72', life: 0.55, maxLife: 0.55, global: true
        });
        this.particles.push({
            x: wx, y: wy, radius: 8, expandRate: 260,
            color: '#f2cc60', life: 0.45, maxLife: 0.45, global: true
        });
        this.decals.push({ x: wx, y: wy, radius: 52, color: 'rgba(10, 12, 15, 0.72)' });
        this.spawnSmoke(wx, wy, 8, 2.0);
        this.spawnDebris(wx, wy, 16);
        this.raiseAlert(wx, wy, 3);
        this.spawnImpactParticles(wx, wy, '#ffa657', 28);

        for (let i = this.entities.length - 1; i >= 0; i--) {
            const ent = this.entities[i];
            // Hits every faction hostile to the player (zombies, hives, mercenaries & bandit structures)
            if (ent && this.areHostile('player', ent.faction)) {
                const d = Math.hypot(ent.x - wx, ent.y - wy);
                if (d <= blastRadius + ent.radius) {
                    const dmg = (ent.category === 'hive' || ent.category === 'mercstruct') ? 920 : 780;
                    this.damageEntity(ent, dmg, 'player');
                }
            }
        }
        this.showRadio('💥 TACTICAL CRUISE MISSILE IMPACT CONFIRMED!');
    },

    damageEntity(ent, amount, srcFaction = null) {
        if (!ent || typeof ent.hp !== 'number' || ent.hp <= 0) return;
        ent.hp -= amount;
        // Any hit on a bandit puts its whole camp on alert (extended aggro & pursuit)
        if (ent.faction === 'merc' && ent.campId) {
            const camp = this.mercCamps.find(c => c.id === ent.campId);
            if (camp) camp.alertTimer = 6;
        }
        if (ent.hp <= 0) {
            this.killEntity(ent, srcFaction);
        }
    },

    killEntity(ent, srcFaction = null) {
        const idx = this.entities.indexOf(ent);
        if (idx === -1) return;
        this.entities.splice(idx, 1);
        ent._removed = true;
        this.selectedIds.delete(ent.id);
        const byPlayer = !srcFaction || srcFaction === 'player';

        if (ent.faction === 'zombie') {
            // Player gets kill credit & scrap bounty; zombies killed by bandits/militia don't pay out
            if (byPlayer) {
                this.kills++;
                if (ent.scrapReward) this.scrap += ent.scrapReward;
            }
            this.decals.push({ x: ent.x, y: ent.y, radius: ent.radius * 0.9, color: 'rgba(92, 24, 34, 0.52)' });
            if (this.decals.length > 110) this.decals.shift();
            this.spawnImpactParticles(ent.x, ent.y, '#b84242', ent.category === 'hive' ? 28 : 8);

            // Update 3: Bloaters rupture in a caustic burst that hurts every living faction nearby
            if (ent.type === 'bloater') {
                const bdef = ZOMBIE_DEFS.bloater;
                this.particles.push({ x: ent.x, y: ent.y, radius: 10, expandRate: bdef.burstRadius * 3.5, color: '#c3e04a', life: 0.35, maxLife: 0.35 });
                this.spawnImpactParticles(ent.x, ent.y, '#c3e04a', 16);
                this.decals.push({ x: ent.x, y: ent.y, radius: bdef.burstRadius * 0.5, color: 'rgba(110, 138, 44, 0.35)' });
                if (this.isWorldPointVisible(ent.x, ent.y)) sfx.playExplosion(0.6);
                const burstHits = [];
                this.forEachInRadius(ent.x, ent.y, bdef.burstRadius + MAX_ENTITY_RADIUS, (o) => {
                    if (o.isAir || !this.areHostile('zombie', o.faction)) return;
                    burstHits.push(o);
                });
                for (const o of burstHits) {
                    const d = Math.hypot(o.x - ent.x, o.y - ent.y);
                    if (d <= bdef.burstRadius + (o.radius || 0)) {
                        this.damageEntity(o, Math.round(bdef.burstDamage * Math.max(0.4, 1 - d / (bdef.burstRadius + 20))), 'zombie');
                    }
                }
            }

            if (ent.category === 'hive') {
                sfx.playExplosion(1.4);
                const remHives = this.entities.filter(e => e.category === 'hive').length;
                this.showRadio(`🔥 ${ent.name.toUpperCase()} ERADICATED! (${remHives} HIVES REMAINING)`);
                this.updateDistrictStates(false);
            }
        } else if (ent.faction === 'player') {
            if (ent.category === 'building' && ent.type === 'airbase') {
                const lost = ent.storedHelis.length + ent.storedPlanes.length;
                if (lost > 0) this.showRadio(`💥 AIRBASE DESTROYED — ${lost} STORED AIRCRAFT LOST!`);
            }
            if (ent.category === 'building' && ent.type === 'collector' && ent.depotId) {
                const dep = this.entities.find(d => d.id === ent.depotId);
                if (dep) dep.claimedBy = null;
            }
            if (ent.category === 'vehicle' || ent.category === 'building') {
                sfx.playExplosion(1.1);
            }
            this.spawnImpactParticles(ent.x, ent.y, '#ffa657', 14);
            // Update 3: crews & passengers bail out of a destroyed vehicle instead of dying with it
            if (ent.category === 'vehicle' && ent.passengers && ent.passengers.length > 0) {
                this.ejectPassengers(ent);
            }
        } else if (ent.faction === 'merc') {
            if (ent.category === 'merc') {
                if (byPlayer) {
                    this.mercKills++;
                    this.scrap += 10;
                }
                this.decals.push({ x: ent.x, y: ent.y, radius: ent.radius * 0.9, color: 'rgba(110, 30, 26, 0.5)' });
                if (this.decals.length > 110) this.decals.shift();
                this.spawnImpactParticles(ent.x, ent.y, '#ff7b72', 8);
            } else {
                if (ent.type !== 'wall' && (byPlayer || this.isEntityVisible(ent))) sfx.playExplosion(ent.type === 'bunker' ? 1.4 : 1.0);
                this.spawnImpactParticles(ent.x, ent.y, '#ffa657', ent.type === 'bunker' ? 30 : 12);
                if (ent.type === 'bunker') this.onMercStrongholdDestroyed(ent, byPlayer);
            }
        } else if (ent.faction === 'survivor') {
            this.spawnImpactParticles(ent.x, ent.y, ent.category === 'fort' ? '#b59b6d' : '#a5d6ff', 8);
            if (ent.category === 'survivor') {
                this.survivorsLost++;
                this.decals.push({ x: ent.x, y: ent.y, radius: ent.radius * 0.8, color: 'rgba(92, 24, 34, 0.45)' });
                if (this.decals.length > 110) this.decals.shift();
                if (this.elapsedTime - this.lastSurvivorLossRadio > 6) {
                    this.lastSurvivorLossRadio = this.elapsedTime;
                    sfx.playRadioAck('alert');
                    this.showRadio(`✝ SURVIVOR LOST: ${ent.name.toUpperCase()} WAS KILLED.`);
                }
            }
        }
    },

    // ========================================================================
    // UPDATE 2: FACTION RELATIONS & TARGETING
    // ========================================================================
    areHostile(a, b) {
        if (!a || !b || a === b) return false;
        if (a === 'neutral' || b === 'neutral') return false;
        // Player forces and civilian survivors are allies; every other pairing is hostile
        if ((a === 'player' && b === 'survivor') || (a === 'survivor' && b === 'player')) return false;
        return true;
    },

    // Update 4 FIX: `canHitAir` lets ranged zombie variants (Acid Spitters) detect & target aircraft.
    // Previously every zombie skipped flying units here, so spitters could never engage helicopters/planes.
    findNearestHostile(src, range, canHitAir = false) {
        let best = null;
        let bestDist = range;
        this.forEachInRadius(src.x, src.y, range, (ent) => {
            if (ent === src) return;
            if (!this.areHostile(src.faction, ent.faction)) return;
            if (typeof ent.hp !== 'number') return;
            if (src.faction === 'zombie' && ent.isAir && !canHitAir) return;
            if (ent.category === 'building' && ent.type === 'gate' && ent.isOpen) return;
            const d = Math.hypot(ent.x - src.x, ent.y - src.y);
            if (d <= bestDist) {
                bestDist = d;
                best = ent;
            }
        });
        return best;
    },

    findNearestPlayerMobile(x, y, range) {
        let best = null;
        let bestDist = range;
        for (const ent of this.entities) {
            if (ent.faction !== 'player' || (ent.category !== 'unit' && ent.category !== 'vehicle')) continue;
            const d = Math.hypot(ent.x - x, ent.y - y);
            if (d <= bestDist) {
                bestDist = d;
                best = ent;
            }
        }
        return best;
    },

    findNearestEnemy(x, y, range, ignoreFog = false) {
        let best = null;
        let bestDist = range;
        this.forEachInRadius(x, y, range, (ent) => {
            if (ent.faction !== 'zombie' && ent.faction !== 'merc') return;
            const d = Math.hypot(ent.x - x, ent.y - y);
            if (d <= bestDist) {
                if (!ignoreFog) {
                    const tc = Math.floor(ent.x / TILE_SIZE);
                    const tr = Math.floor(ent.y / TILE_SIZE);
                    if (!this.fog[tr] || this.fog[tr][tc] < 2) return;
                }
                bestDist = d;
                best = ent;
            }
        });
        return best;
    },

    findNearestPlayerTarget(x, y, range) {
        let best = null;
        let bestDist = range;
        for (const ent of this.entities) {
            if (ent.faction !== 'player') continue;
            if (ent.isAir) continue;
            if (ent.category === 'building' && ent.type === 'gate' && ent.isOpen) continue;
            const d = Math.hypot(ent.x - x, ent.y - y);
            if (d <= bestDist) {
                bestDist = d;
                best = ent;
            }
        }
        return best;
    },

    // Update 5: combat effects
    spawnSmoke(x, y, count = 3, scale = 1) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: x + (Math.random() - 0.5) * 24 * scale, y: y + (Math.random() - 0.5) * 24 * scale,
                vx: (Math.random() - 0.5) * 12, vy: -8 - Math.random() * 14,
                radius: (8 + Math.random() * 8) * scale, expandRate: 14 * scale, smoke: true,
                color: i % 2 ? '#3a3f47' : '#4b525c', life: 1.1 + Math.random() * 0.8, maxLife: 1.9
            });
        }
    },

    spawnDebris(x, y, count = 5) {
        for (let i = 0; i < count; i++) {
            const ang = Math.random() * Math.PI * 2, spd = 90 + Math.random() * 140;
            this.particles.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, size: 2 + Math.random() * 2,
                color: i % 3 ? '#8b949e' : '#ffa657', life: 0.35 + Math.random() * 0.3, maxLife: 0.65 });
        }
    },

    spawnImpactParticles(x, y, color, count = 6) {
        for (let i = 0; i < count; i++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = 25 + Math.random() * 85;
            this.particles.push({
                x, y,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd,
                size: 3,
                color,
                life: 0.25 + Math.random() * 0.25,
                maxLife: 0.5
            });
        }
    }
});
