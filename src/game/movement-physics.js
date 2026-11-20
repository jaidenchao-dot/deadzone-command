'use strict';
// Momentum physics (acceleration, braking, turning), tile collision, legacy zombie mover
defineGameMethods({
    // Update 7: movement profile for an entity (zombies keep their original shambling mover)
    getMoveProfile(ent) {
        if (ent.category === 'zombie' || !ent.speed) return null;
        const p = MOVE_PROFILES[ent.type];
        if (p) return p;
        if (ent.category === 'vehicle') return DEFAULT_VEHICLE_PROFILE;
        if (ent.category === 'unit' || ent.category === 'merc' || ent.category === 'survivor') return DEFAULT_INFANTRY_PROFILE;
        return null;
    },

    // Low-level steering. Soldiers & vehicles use momentum physics; zombies use the original mover.
    steerToward(ent, tx, ty, dt) {
        const prof = this.getMoveProfile(ent);
        if (!prof) return this.steerLegacy(ent, tx, ty, dt);
        return this.steerPhysics(ent, prof, tx, ty, dt);
    },

    steerPhysics(ent, prof, tx, ty, dt) {
        const dx = tx - ent.x, dy = ty - ent.y;
        const dist = Math.hypot(dx, dy);
        // velocity from an older, interrupted move (boarded, teleported, rappelled...) doesn't carry over
        if (this.elapsedTime - (ent._physT ?? -9) > 0.4) {
            ent.vx = 0; ent.vy = 0; ent._fs = 0;
            ent.moveHeading = ent.angle || 0;
        }
        ent._physT = this.elapsedTime;
        ent._physFrame = this.frameStamp;
        if (ent.landed || ent.flightTransition > 0) { ent.vx = 0; ent.vy = 0; ent._fs = 0; return; }
        if (ent.fuelMax && ent.fuel <= 0 && !ent.isAir && this.settings.fuel) {
            ent.angle = Math.atan2(dy, dx);
            this.coastEntity(ent, dt); // out of fuel: roll to a stop
            return;
        }
        if (dist < 1 && Math.hypot(ent.vx || 0, ent.vy || 0) < 2) return;

        const maxSpeed = ent.speed * ((ent.food !== undefined && ent.food <= 0) ? 0.55 : 1);
        const desiredAng = Math.atan2(dy, dx);
        // brake for the FINAL destination (not every path waypoint): v = sqrt(2·brake·d) means we stop on the spot
        const arriveDist = (ent._goalFrame === this.frameStamp && ent._goalDist !== undefined) ? ent._goalDist : dist;
        let targetSpeed = Math.min(maxSpeed, Math.sqrt(2 * prof.brake * STOP_BRAKE_BONUS * Math.max(0, arriveDist - 3)));
        let vx = ent.vx || 0, vy = ent.vy || 0;
        let spd = Math.hypot(vx, vy);
        ent._turning = false;

        if (prof.heading) {
            // ---- vehicles & planes: hull heading, forward speed only ----
            let h = ent.moveHeading ?? ent.angle ?? desiredAng;
            if (spd < 2) h = ent.angle ?? h; // at rest the hull is wherever it was last pointed
            let diff = desiredAng - h;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            const ad = Math.abs(diff);
            // wheeled vehicles need rolling speed to turn (35% turn authority when crawling); tracks pivot in place
            const authority = prof.tracked ? 1 : Math.max(0.35, Math.min(1, spd / Math.max(1, maxSpeed * 0.4)));
            const turnStep = prof.turn * authority * dt;
            h += Math.max(-turnStep, Math.min(turnStep, diff));
            // corners must be taken slowly; tracked vehicles stop and pivot for very sharp turns; no instant reverse
            let corner = 1;
            if (ad > 0.3) corner = prof.tracked ? Math.max(0, 1 - (ad - 0.3) / 0.9) : Math.max(0.22, 1 - (ad - 0.3) / 1.7);
            targetSpeed *= corner;
            // a sideways destination close by needs a turning circle that fits: crawl until the nose comes round
            if (!prof.tracked && ad > 0.25) targetSpeed = Math.min(targetSpeed, Math.max(8, prof.turn * 0.35 * Math.max(dist, 16) * 0.5));
            ent._turning = ad > 0.6;
            let s = ent._fs || 0;
            if (s < targetSpeed) s = Math.min(targetSpeed, s + prof.accel * dt);
            else s = Math.max(targetSpeed, s - prof.brake * (targetSpeed < 1 ? STOP_BRAKE_BONUS : 1) * dt);
            ent._fs = s;
            ent.moveHeading = h;
            ent.angle = h;
            vx = Math.cos(h) * s;
            vy = Math.sin(h) * s;
        } else {
            // ---- infantry & helicopters: momentum vector ----
            const dvx = Math.cos(desiredAng) * targetSpeed, dvy = Math.sin(desiredAng) * targetSpeed;
            // speeding up along the current heading uses acceleration; slowing down / changing direction uses the
            // (stronger) braking — so a U-turn means stopping, then running the other way
            const along = spd > 1 ? (vx * Math.cos(desiredAng) + vy * Math.sin(desiredAng)) / spd : 1;
            const speedingUp = targetSpeed > spd && along > 0.8;
            const rate = speedingUp ? prof.accel : prof.brake;
            let ddx = dvx - vx, ddy = dvy - vy;
            const dmag = Math.hypot(ddx, ddy);
            const maxD = rate * dt;
            if (dmag > maxD) { ddx = ddx / dmag * maxD; ddy = ddy / dmag * maxD; }
            vx += ddx; vy += ddy;
            ent._turning = along < 0.5 && spd > 10;
            const ns = Math.hypot(vx, vy);
            ent._fs = ns;
            if (ns > 6) ent.angle = Math.atan2(vy, vx);
            else if (dist > 1) ent.angle = desiredAng;
        }
        this.applyPhysicsStep(ent, vx, vy, dt, true);
    },

    // Moves the entity by its velocity (+ soft separation push), with tile collision. Velocity into a wall is lost.
    applyPhysicsStep(ent, vx, vy, dt, separate) {
        const startX = ent.x, startY = ent.y;
        let px = 0, py = 0;
        if (separate) {
            this.forEachInRadius(ent.x, ent.y, ent.radius + MAX_ENTITY_RADIUS, (other) => {
                if (other.id === ent.id) return;
                if (ent.isAir && !other.isAir) return;
                if (ent.faction === 'player' && other.category === 'building' && other.type === 'gate' && other.isOpen) return;
                const odx = ent.x - other.x, ody = ent.y - other.y;
                const odist = Math.hypot(odx, ody);
                const minSep = ent.radius + other.radius;
                if (odist > 0 && odist < minSep) {
                    const push = ((minSep - odist) / minSep) * 115;
                    px += (odx / odist) * push;
                    py += (ody / odist) * push;
                }
            });
        }
        const nextX = Math.max(20, Math.min(MAP_WIDTH - 20, ent.x + (vx + px) * dt));
        const nextY = Math.max(20, Math.min(MAP_HEIGHT - 20, ent.y + (vy + py) * dt));
        if (!ent.isAir) {
            const blocked = (wx, wy) => this.isWorldTileBlockedFor(ent, wx, wy);
            if (blocked(nextX, nextY)) {
                if (!blocked(nextX, ent.y)) { ent.x = nextX; vy = 0; }
                else if (!blocked(ent.x, nextY)) { ent.y = nextY; vx = 0; }
                else { vx = 0; vy = 0; }
                // hitting a wall scrubs off speed (no sliding along at full tilt)
                ent.vx = vx * 0.6; ent.vy = vy * 0.6;
                ent._fs = Math.hypot(ent.vx, ent.vy);
                this.burnDriveFuel(ent, Math.hypot(ent.x - startX, ent.y - startY));
                return;
            }
        }
        ent.x = nextX;
        ent.y = nextY;
        ent.vx = vx; ent.vy = vy;
        this.burnDriveFuel(ent, Math.hypot(ent.x - startX, ent.y - startY));
    },

    isWorldTileBlockedFor(ent, wx, wy) {
        const tc = Math.floor(wx / TILE_SIZE);
        const tr = Math.floor(wy / TILE_SIZE);
        const row = this.blockedGrid[tr];
        if (!row) return !this.infinite; // infinite mode: unloaded ground is simulated without collision
        const v = row[tc];
        if (v === undefined) return !this.infinite;
        if (ent.tracked && this.terrain[tr] && this.terrain[tr][tc] === 'rubble') return false;
        return v;
    },

    // No movement order this frame: momentum bleeds off with firm braking (stop orders, arrival, combat halts)
    coastEntity(ent, dt) {
        const prof = this.getMoveProfile(ent);
        const spd = Math.hypot(ent.vx || 0, ent.vy || 0);
        if (!prof || spd < 1.5) { ent.vx = 0; ent.vy = 0; ent._fs = 0; return; }
        const ns = Math.max(0, spd - prof.brake * STOP_BRAKE_BONUS * dt);
        const k = ns / spd;
        ent._physT = this.elapsedTime;
        ent._physFrame = this.frameStamp;
        ent._fs = ns;
        this.applyPhysicsStep(ent, ent.vx * k, ent.vy * k, dt, false);
    },

    // Original direct mover — still used by zombies
    steerLegacy(ent, tx, ty, dt) {
        const dx = tx - ent.x;
        const dy = ty - ent.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 1) return;

        // Update 5: ground vehicles with an empty tank can't move (they can still turn & fire)
        if (ent.fuelMax && ent.fuel <= 0 && !ent.isAir && this.settings.fuel) {
            ent.angle = Math.atan2(dy, dx);
            return;
        }
        if (ent.landed || ent.flightTransition > 0) return; // landed / transitioning helicopters stay put

        ent.angle = Math.atan2(dy, dx);
        // Update 5: starving troops move at reduced speed
        const moveSpeed = ent.speed * ((ent.food !== undefined && ent.food <= 0) ? 0.55 : 1);
        let vx = (dx / dist) * moveSpeed;
        let vy = (dy / dist) * moveSpeed;
        const startX = ent.x, startY = ent.y;

        // Soft separation & entity collision avoidance (Update 4: neighbours from the spatial grid)
        this.forEachInRadius(ent.x, ent.y, ent.radius + MAX_ENTITY_RADIUS, (other) => {
            if (other.id === ent.id) return;
            if (ent.isAir && !other.isAir) return;
            if (ent.faction === 'player' && other.category === 'building' && other.type === 'gate' && other.isOpen) return;

            const odx = ent.x - other.x;
            const ody = ent.y - other.y;
            const odist = Math.hypot(odx, ody);
            const minSep = ent.radius + other.radius;
            if (odist > 0 && odist < minSep) {
                const push = ((minSep - odist) / minSep) * 115;
                vx += (odx / odist) * push;
                vy += (ody / odist) * push;
            }
        });

        const nextX = Math.max(20, Math.min(MAP_WIDTH - 20, ent.x + vx * dt));
        const nextY = Math.max(20, Math.min(MAP_HEIGHT - 20, ent.y + vy * dt));

        // Ground units collide with NYC buildings, river water, and rubble (with smooth wall-sliding!)
        if (!ent.isAir) {
            const isTileBlocked = (wx, wy) => {
                const tc = Math.floor(wx / TILE_SIZE);
                const tr = Math.floor(wy / TILE_SIZE);
                if (!this.blockedGrid[tr]) return !this.infinite;
                if (this.infinite && this.blockedGrid[tr][tc] === undefined) return false;
                // Update 5: tracked supply carriers crawl over rubble
                if (ent.tracked && this.terrain[tr] && this.terrain[tr][tc] === 'rubble') return false;
                return this.blockedGrid[tr][tc];
            };

            if (isTileBlocked(nextX, nextY)) {
                if (!isTileBlocked(nextX, ent.y)) {
                    ent.x = nextX;
                } else if (!isTileBlocked(ent.x, nextY)) {
                    ent.y = nextY;
                }
                this.burnDriveFuel(ent, Math.hypot(ent.x - startX, ent.y - startY));
                return;
            }
        }

        ent.x = nextX;
        ent.y = nextY;
        this.burnDriveFuel(ent, Math.hypot(ent.x - startX, ent.y - startY));
    }
});
