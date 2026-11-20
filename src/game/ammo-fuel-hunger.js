'use strict';
// Ammunition, fuel and hunger
defineGameMethods({
    // ========================================================================
    // UPDATE 5: AMMUNITION, FUEL & HUNGER
    // ========================================================================
    initLogistics(ent) {
        const lo = LOADOUTS[ent.type];
        const ammoMult = this.diffMult ? this.diffMult('ammo') : 1;
        ent.ammo = {};
        ent.ammoMax = {};
        if (lo && ent.faction === 'player') {
            ent.ammoType = lo.primary;
            for (const [t, q] of Object.entries(lo.ammo)) {
                ent.ammoMax[t] = Math.round(q * ammoMult);
                ent.ammo[t] = ent.ammoMax[t];
            }
            if (lo.secondary) {
                ent.secondary = Object.assign({}, lo.secondary);
                ent.secCooldown = 0;
            }
        } else {
            ent.ammoType = null; // unlimited (mercs, civilian vehicles, supply vehicles)
        }
        if (ent.category === 'vehicle') {
            const vdef = VEHICLE_DEFS[ent.type];
            const fs = FUEL_SPECS[ent.type];
            if (fs) {
                ent.fuelMax = fs.max;
                ent.fuel = fs.max;
            }
            if (vdef.supply) {
                ent.supply = true;
                ent.cargoCapacity = vdef.cargoCapacity;
                ent.inventory = {};
                AMMO_ORDER.forEach(t => { ent.inventory[t] = 0; });
                this.fillSupplyPlan(ent);
                ent.supplyPulseTimer = Math.random() * 2;
            }
            ent.tracked = !!vdef.tracked;
            ent.twinRotor = !!vdef.twinRotor;
            ent.canFly = !!vdef.isAir;
            ent.landed = false;
            ent.flightTransition = 0;
            ent.altitude = vdef.isAir ? 1 : 0;
        }
        // Hunger: player-controlled humans
        if (ent.category === 'unit') {
            ent.food = 100;
            ent.starveTimer = 0;
        }
    },

    hasAmmo(ent) {
        if (!ent || !ent.ammoType || !this.settings.ammo) return true;
        return (ent.ammo[ent.ammoType] || 0) > 0;
    },

    useAmmo(ent, type) {
        if (!ent || !type || !this.settings.ammo || !ent.ammo || ent.ammo[type] === undefined) return;
        ent.ammo[type] = Math.max(0, ent.ammo[type] - 1);
    },

    onOutOfAmmo(ent) {
        if (ent.faction !== 'player') return;
        if (this.isWorldPointVisible(ent.x, ent.y)) sfx.playDryFire();
        if (!ent._ammoWarned) {
            ent._ammoWarned = true;
            if (this.elapsedTime - (this.lastAmmoRadio || -99) > 5) {
                this.lastAmmoRadio = this.elapsedTime;
                this.showRadio(`⚠ ${ent.name.toUpperCase()} IS OUT OF ${AMMO_DEFS[ent.ammoType].name.toUpperCase()} — SEND A SUPPLY VEHICLE!`);
            }
        }
    },

    ammoFraction(ent) {
        if (!ent.ammoMax) return 1;
        const types = Object.keys(ent.ammoMax);
        if (types.length === 0) return 1;
        return Math.min(...types.map(t => ent.ammo[t] / ent.ammoMax[t]));
    },

    // Secondary weapons (e.g. Abrams coax MG, Apache chain gun) fire independently on their own ammo
    updateSecondaryWeapon(ent, dt) {
        const sec = ent.secondary;
        if (!sec) return;
        ent.secCooldown = Math.max(0, (ent.secCooldown || 0) - dt);
        if (ent.secCooldown > 0) return;
        if (this.settings.ammo && !(ent.ammo[sec.ammoType] > 0)) return;
        const tgt = this.findNearestEnemy(ent.x, ent.y, sec.range);
        if (!tgt) return;
        ent.secCooldown = sec.fireRate;
        this.useAmmo(ent, sec.ammoType);
        const dmgMult = this.upgrades.ballistics ? 1.25 : 1.0;
        this.fireProjectile({ x: ent.x, y: ent.y, faction: 'player', damage: Math.round(sec.damage * dmgMult), splash: sec.splash || 0 },
            tgt.x, tgt.y, sec.weapon);
    },

    burnDriveFuel(ent, moved) {
        if (!ent.fuelMax || ent.isAir || !this.settings.fuel || moved <= 0) return;
        const fs = FUEL_SPECS[ent.type];
        ent.fuel = Math.max(0, ent.fuel - fs.burn * this.diffMult('fuel') * moved / 100);
        if (ent.fuel <= 0) this.onFuelEmpty(ent);
    },

    updateVehicleFuel(ent, dt) {
        if (!ent.fuelMax || !this.settings.fuel) return;
        const fs = FUEL_SPECS[ent.type];
        if (ent.isAir && !ent.landed) {
            ent.fuel = Math.max(0, ent.fuel - fs.burn * this.diffMult('fuel') * dt);
        } else if (!ent.isAir && !ent.landed) {
            ent.fuel = Math.max(0, ent.fuel - GROUND_IDLE_BURN * dt);
        }
        const frac = ent.fuel / ent.fuelMax;
        if (frac < 0.2 && !ent._lowFuelWarned) {
            ent._lowFuelWarned = true;
            sfx.playRadioAck('alert');
            this.showRadio(`⛽ ${ent.name.toUpperCase()} LOW ON FUEL (${Math.round(frac * 100)}%)` + (ent.isAir ? ' — LAND IT OR STORE AT AN AIRBASE!' : '.'));
        }
        if (frac >= 0.25) ent._lowFuelWarned = false;
        if (ent.fuel <= 0) this.onFuelEmpty(ent);
    },

    onFuelEmpty(ent) {
        if (ent.isAir && !ent.landed) {
            // Aircraft out of fuel fall out of the sky
            sfx.playCrash();
            this.particles.push({ x: ent.x, y: ent.y, radius: 14, expandRate: 260, color: '#ffa657', life: 0.6, maxLife: 0.6, global: true });
            this.spawnSmoke(ent.x, ent.y, 6, 1.4);
            this.showRadio(`💥 ${ent.name.toUpperCase()} RAN OUT OF FUEL AND CRASHED!`);
            if (ent.passengers) ent.passengers.forEach(p => { p.hp = Math.max(1, Math.round(p.hp * 0.6)); });
            this.killEntity(ent, 'zombie');
            return;
        }
        if (!ent._emptyWarned) {
            ent._emptyWarned = true;
            sfx.playRadioAck('alert');
            this.showRadio(`⛽ ${ent.name.toUpperCase()} IS OUT OF FUEL — IMMOBILIZED (STILL ABLE TO FIRE). SEND A SUPPLY VEHICLE.`);
        }
    },

    // Returns true if the unit starved to death
    updateHunger(u, dt) {
        if (u.food === undefined || !this.settings.hunger) return false;
        if (u.food > 0) {
            u.food = Math.max(0, u.food - HUNGER_DRAIN * this.diffMult('hunger') * dt);
            u.starveTimer = 0;
            if (u.food < 25 && !u._hungryWarned && u.faction === 'player' && this.elapsedTime - (this.lastHungerRadio || -99) > 6) {
                u._hungryWarned = true;
                this.lastHungerRadio = this.elapsedTime;
                this.showRadio(`🍖 ${u.name.toUpperCase()} IS HUNGRY — RESUPPLY RATIONS SOON.`);
            }
            if (u.food <= 0 && u.faction === 'player') {
                sfx.playRadioAck('alert');
                this.showRadio(`🍖 ${u.name.toUpperCase()} IS STARVING — SLOWED & INACCURATE. DIES IN ${STARVE_DEATH_TIME}s WITHOUT RATIONS!`);
            }
            return false;
        }
        u.starveTimer += dt;
        if (u.starveTimer >= STARVE_DEATH_TIME) {
            this.showRadio(`✝ ${u.name.toUpperCase()} STARVED TO DEATH.`);
            return true;
        }
        return false;
    }
});
