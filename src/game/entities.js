'use strict';
// Entity factories (units, vehicles, buildings, hives, zombies, abandoned cars) and quiet removal
defineGameMethods({
    createUnit(type, x, y) {
        const def = UNIT_DEFS[type];
        const hpMult = this.upgrades.armor ? 1.25 : 1.0;
        const dmgMult = this.upgrades.ballistics ? 1.25 : 1.0;
        const u = {
            id: this.nextEntityId++,
            category: 'unit',
            faction: 'player',
            type,
            name: def.name,
            x, y,
            radius: 10,
            hp: Math.round(def.hp * hpMult),
            maxHp: Math.round(def.hp * hpMult),
            speed: def.speed,
            range: def.range,
            damage: Math.round(def.damage * dmgMult),
            fireRate: def.fireRate,
            splash: def.splash || 0,
            vision: def.vision,
            weapon: def.weapon,
            angle: -Math.PI / 4,
            cooldown: 0,
            state: 'idle',
            holdPosition: false,
            targetPos: null,
            targetId: null,
            muzzleFlash: 0
        };
        if (def.treatCharges) {
            u.treatCharges = def.treatCharges;
            u.treatMax = def.treatCharges;
            u.treatCooldown = 0;
        }
        if (def.isSurvivorUnit) {
            u.isSurvivor = true;
            u.armed = !!def.armed;
            u.unarmed = !!def.unarmed;
            u.variant = Math.floor(Math.random() * 3);
            u.abilityTimer = Math.random() * 0.5;
        }
        this.initLogistics(u);
        this.entities.push(u);
        return u;
    },

    createVehicle(type, x, y) {
        const def = VEHICLE_DEFS[type];
        const hpMult = this.upgrades.armor ? 1.25 : 1.0;
        const dmgMult = this.upgrades.ballistics ? 1.25 : 1.0;
        const v = {
            id: this.nextEntityId++,
            category: 'vehicle',
            faction: 'player',
            type,
            name: def.name,
            x, y,
            radius: def.radius,
            hp: Math.round(def.hp * hpMult),
            maxHp: Math.round(def.hp * hpMult),
            speed: def.speed,
            range: def.range,
            damage: Math.round(def.damage * dmgMult),
            fireRate: def.fireRate,
            splash: def.splash || 0,
            vision: def.vision,
            weapon: def.weapon,
            capacity: def.capacity,
            passengers: [],
            firingPorts: !!def.firingPorts,
            isAir: !!def.isAir,
            crushesZombies: !!def.crushesZombies,
            hasRotor: !!def.hasRotor,
            civilian: !!def.civilian,
            unarmed: !!def.civilian || !!def.supply,
            agroRange: def.agroRange || 0,
            burstLeft: 0,
            burstTimer: 0,
            burstTarget: null,
            angle: -Math.PI / 4,
            cooldown: 0,
            portCooldown: 0,
            rotorAngle: 0,
            state: 'idle',
            holdPosition: false,
            targetPos: null,
            targetId: null,
            muzzleFlash: 0
        };
        this.initLogistics(v);
        this.entities.push(v);
        return v;
    },

    createBuilding(type, x, y, instant = true, rotation = 0) {
        const def = BUILDING_DEFS[type];
        const hpMult = this.upgrades.armor ? 1.25 : 1.0;
        const dmgMult = this.upgrades.ballistics ? 1.25 : 1.0;
        const bld = {
            id: this.nextEntityId++,
            category: 'building',
            faction: 'player',
            type,
            name: def.name,
            x, y,
            size: def.size,
            rotation: rotation % 4,
            radius: (def.size * TILE_SIZE) * 0.45,
            hp: Math.round((instant ? def.hp : def.hp * 0.4) * hpMult),
            maxHp: Math.round(def.hp * hpMult),
            vision: def.vision,
            range: def.range || 0,
            damage: Math.round((def.damage || 0) * dmgMult),
            fireRate: def.fireRate || 0,
            splash: def.splash || 0,
            cooldown: 0,
            angle: (rotation % 4) * (Math.PI / 2) - Math.PI / 4,
            queue: [],
            rallyPoint: null,
            isOpen: false,
            manualGateState: null,
            level: 1,
            depotId: null,
            scrapRate: 0,
            fuelRate: 0,
            harvestTimer: 0,
            bombardTarget: null,
            bombardLoop: false,
            missileCooldown: 0,
            missileMaxCooldown: 45,
            muzzleFlash: 0
        };
        if (type === 'airbase') { bld.storedHelis = []; bld.storedPlanes = []; }
        if (type === 'medictent') { bld.healRadius = def.healRadius; bld.healRate = def.healRate; bld.healTargetId = null; }
        this.entities.push(bld);
        return bld;
    },

    createHive(x, y, hiveType = 'hive_subway', customName = null) {
        const arch = HIVE_ARCHETYPES[hiveType] || HIVE_ARCHETYPES.hive_subway;
        const hive = {
            id: this.nextEntityId++,
            category: 'hive',
            faction: 'zombie',
            type: hiveType,
            name: customName || arch.name,
            desc: arch.desc,
            x, y,
            radius: arch.radius,
            hp: arch.hp,
            maxHp: arch.hp,
            spawnInterval: arch.spawnInterval,
            spawnPool: arch.spawnPool,
            spawnTimer: 8 + Math.random() * 6
        };
        this.entities.push(hive);

        // Guard zombies clustered around the hive (Update 4: 25 guards in rings, was 5)
        for (let i = 0; i < 5 * ZOMBIE_POP_MULT / 2; i++) {
            const ring = Math.floor(i / 8);
            const ang = (i / 8) * Math.PI * 2 + ring * 0.4;
            const gx = x + Math.cos(ang) * (arch.radius + 22 + ring * 24);
            const gy = y + Math.sin(ang) * (arch.radius + 22 + ring * 24);
            const tc = Math.floor(gx / TILE_SIZE);
            const tr = Math.floor(gy / TILE_SIZE);
            if (this.blockedGrid[tr] && !this.blockedGrid[tr][tc]) {
                const zType = arch.spawnPool[i % arch.spawnPool.length];
                this.createZombie(zType, gx, gy, false);
            }
        }
        return hive;
    },

    createZombie(type, x, y, targetHq = false) {
        const def = ZOMBIE_DEFS[type];
        const z = {
            id: this.nextEntityId++,
            category: 'zombie',
            faction: 'zombie',
            type,
            name: def.name,
            x, y,
            radius: def.radius,
            hp: def.hp,
            maxHp: def.hp,
            speed: def.speed,
            damage: def.damage,
            range: def.range,
            fireRate: def.fireRate,
            splash: def.splash || 0,
            scrapReward: def.scrapReward,
            angle: Math.random() * Math.PI * 2,
            cooldown: 0,
            attackHq: targetHq
        };
        this.entities.push(z);
        return z;
    },

    createAbandonedVehicle(type, x, y, angle) {
        const v = this.createVehicle(type, x, y);
        v.faction = 'neutral';
        v.abandoned = true;
        v.angle = angle;
        // Weathered, not pristine
        v.hp = Math.round(v.maxHp * (0.55 + Math.random() * 0.35));
        return v;
    },

    placeAbandonedVehicles() {
        const T = TILE_SIZE;
        const spots = [
            [27, 68, 'civ_sedan'], [47, 62, 'civ_pickup'], [67, 70, 'civ_van'], [36, 57, 'civ_sedan'],
            [58, 39, 'civ_pickup'], [27, 44, 'civ_van'], [87, 35, 'civ_sedan'], [47, 24, 'civ_pickup'],
            [20, 21, 'civ_sedan'], [76, 7, 'civ_van']
        ];
        spots.forEach(([c, r, type]) => {
            const t = this.findOpenTileNear(c, r, 2);
            if (!t) return;
            const x = t.c * T + T / 2 + (Math.random() - 0.5) * 10;
            const y = t.r * T + T / 2 + (Math.random() - 0.5) * 10;
            if (!this.isSpotClearOfEntities(x, y, 24)) return;
            // Parked askew across lanes, as if left in a hurry
            const onAvenue = [26, 27, 28, 46, 47, 48, 66, 67, 68, 86, 87, 88].includes(t.c);
            const angle = (onAvenue ? Math.PI / 2 : 0) + (Math.random() - 0.5) * 0.9 + (Math.random() < 0.5 ? Math.PI : 0);
            this.createAbandonedVehicle(type, x, y, angle);
        });
    },

    removeEntityQuiet(ent) {
        const idx = this.entities.indexOf(ent);
        if (idx !== -1) this.entities.splice(idx, 1);
        ent._removed = true;
        this.selectedIds.delete(ent.id);
    }
});
