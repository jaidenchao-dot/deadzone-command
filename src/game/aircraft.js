'use strict';
// Helicopter landing / takeoff, rope pickup & rappelling, airbase storage
defineGameMethods({
    // ========================================================================
    // UPDATE 5: HELICOPTER LANDING / TAKEOFF / RAPPEL & AIRBASE STORAGE
    // ========================================================================
    canLandAt(x, y) {
        return this.isSpotWalkable(x, y, []);
    },

    startLanding(h) {
        if (!h.canFly || !HELI_TYPES.has(h.type) || h.landed || h.flightTransition > 0) return false;
        if (!this.canLandAt(h.x, h.y)) {
            sfx.playRadioAck('alert');
            this.showRadio(`${h.name.toUpperCase()}: NO CLEAR LANDING ZONE (BUILDING/RUBBLE/WATER BELOW) — MOVE OVER OPEN GROUND.`);
            return false;
        }
        h.flightTransition = 1.2;
        h.flightDir = -1;
        h.state = 'idle';
        h.targetPos = null;
        h.targetId = null;
        h.rappelAll = false;
        if (this.isWorldPointVisible(h.x, h.y)) sfx.playRotorTransition(false);
        return true;
    },

    startTakeoff(h) {
        if (!h.canFly || !h.landed || h.flightTransition > 0) return false;
        h.landed = false;
        h.isAir = true;
        h.flightTransition = 1.2;
        h.flightDir = 1;
        if (this.isWorldPointVisible(h.x, h.y)) sfx.playRotorTransition(true);
        return true;
    },

    // ========================================================================
    // UPDATE 6: HELICOPTER ROPE PICKUP (one soldier at a time, helicopter stays airborne)
    // ========================================================================
    heliSeatsFree(h) {
        const pending = (h.hoisting ? 1 : 0);
        return Math.max(0, (h.capacity || 0) - h.passengers.length - pending);
    },

    orderHoistToHeli(infantry, h) {
        const heading = this.entities.filter(e => e.category === 'unit' && (e.state === 'hoist' || e.state === 'hoistwait') && e.targetId === h.id && !infantry.includes(e)).length;
        const open = Math.max(0, this.heliSeatsFree(h) - heading);
        if (open <= 0) {
            sfx.playRadioAck('alert');
            this.showRadio(`${h.name.toUpperCase()} IS AT FULL CAPACITY (${h.passengers.length}/${h.capacity}).`);
            return;
        }
        const go = infantry.slice(0, open);
        go.forEach(u => { u.state = 'hoist'; u.targetId = h.id; u.targetPos = null; u.holdPosition = false; });
        this.pings.push({ x: h.x, y: h.y, color: '#58a6ff', life: 0.6 });
        sfx.playRadioAck('confirm');
        this.showRadio(`🪢 ${go.length} TROOP(S) MOVING UNDER ${h.name.toUpperCase()} — WINCHING UP ONE AT A TIME` + (infantry.length > open ? ` (${infantry.length - open} LEFT BEHIND — NO SEATS).` : '.'));
    },

    // Queue a specific soldier for pickup; the helicopter with a free seat closest to them flies over
    queueHoistPickup(helis, unit) {
        if (helis.some(h => h.pickupQueue && h.pickupQueue.includes(unit.id))) return;
        const avail = helis.filter(h => !h.landed && this.heliSeatsFree(h) - ((h.pickupQueue || []).length) > 0);
        if (avail.length === 0) {
            sfx.playRadioAck('alert');
            const landed = helis.some(h => h.landed);
            this.showRadio(landed ? 'HELICOPTER IS LANDED — ORDER TROOPS TO BOARD IT, OR TAKE OFF [O] TO USE THE ROPE.' : 'NO FREE SEATS ON THE SELECTED HELICOPTER(S) — CAPACITY REACHED.');
            return;
        }
        avail.sort((a, b) => Math.hypot(a.x - unit.x, a.y - unit.y) - Math.hypot(b.x - unit.x, b.y - unit.y));
        const h = avail[0];
        h.pickupQueue = h.pickupQueue || [];
        h.pickupQueue.push(unit.id);
        if (h.state === 'move') { h.state = 'idle'; h.targetPos = null; }
        unit.state = 'hoistwait';
        unit.targetId = h.id;
        unit.targetPos = null;
        this.pings.push({ x: unit.x, y: unit.y, color: '#58a6ff', life: 0.6 });
        sfx.playRadioAck('confirm');
        this.showRadio(`🪢 ${h.name.toUpperCase()} INBOUND TO WINCH UP ${unit.name.toUpperCase()} (${h.pickupQueue.length} IN QUEUE, ${h.passengers.length}/${h.capacity} ABOARD).`);
    },

    // Soldier side: walk under the helicopter (hoist) or hold still for it (hoistwait). Returns true while busy.
    updateHoistTrooper(u, dt) {
        const h = this.getEntityById(u.targetId);
        if (!h || !h.canFly || h._removed) { u.state = 'idle'; u.targetId = null; return false; }
        if (h.landed) {
            // the helicopter set down: fall back to ordinary boarding
            u.state = 'board';
            return false;
        }
        if (u.state === 'hoistwait') {
            if (!h.pickupQueue || !h.pickupQueue.includes(u.id)) { u.state = 'idle'; u.targetId = null; return false; }
            return true; // hold position so the pilot can find us
        }
        if (this.heliSeatsFree(h) <= 0 && !(h.hoisting && h.hoisting.id === u.id)) { u.state = 'idle'; u.targetId = null; return false; }
        const d = Math.hypot(h.x - u.x, h.y - u.y);
        if (d > 16) this.moveEntityToward(u, h.x, h.y, dt);
        return true;
    },

    // Helicopter side. Returns true while busy hovering for / flying to a pickup.
    updateHoist(h, dt) {
        if (!h.capacity || PLANE_TYPES.has(h.type)) return false;
        if (h.hoisting) {
            const u = this.getEntityById(h.hoisting.id);
            const lost = !u || u._removed || h.landed || h.flightTransition > 0 || Math.hypot(u.x - h.x, u.y - h.y) > 80;
            if (lost) {
                if (u) { u.hoistTimer = 0; u.state = 'idle'; u.targetId = null; }
                h.hoisting = null;
                return false;
            }
            h.hoisting.t -= dt;
            u.hoistTimer = Math.max(0.0001, h.hoisting.t);
            u.hoistFromX = h.x;
            u.hoistFromY = h.y;
            if (h.hoisting.t <= 0) this.completeHoist(h, u);
            return true; // hover in place while the winch runs
        }
        if (h.landed || h.flightTransition > 0) return false;
        // a player move / store order cancels outstanding rope pickups
        if (h.pickupQueue && h.pickupQueue.length && (h.state === 'move' || h.state === 'tostore')) {
            h.pickupQueue.forEach(id => { const w = this.getEntityById(id); if (w && w.state === 'hoistwait') { w.state = 'idle'; w.targetId = null; } });
            h.pickupQueue = [];
        }
        if (this.heliSeatsFree(h) <= 0) {
            if (h.pickupQueue && h.pickupQueue.length) {
                h.pickupQueue.forEach(id => { const w = this.getEntityById(id); if (w && w.targetId === h.id) { w.state = 'idle'; w.targetId = null; } });
                h.pickupQueue = [];
                this.showRadio(`${h.name.toUpperCase()} FULL (${h.passengers.length}/${h.capacity}) — REMAINING PICKUPS CANCELLED.`);
            }
            return false;
        }
        // player-chosen pickups first (in order)
        while (h.pickupQueue && h.pickupQueue.length) {
            const u = this.getEntityById(h.pickupQueue[0]);
            if (!u || u._removed || u.faction !== 'player' || u.category !== 'unit') { h.pickupQueue.shift(); continue; }
            const d = Math.hypot(u.x - h.x, u.y - h.y);
            if (d <= 22) { h.pickupQueue.shift(); this.startHoist(h, u); return true; }
            this.moveEntityToward(h, u.x, u.y, dt);
            return true;
        }
        // soldiers who walked under the helicopter themselves
        let cand = null, cd = Infinity;
        this.forEachInRadius(h.x, h.y, h.radius + 22, (e) => {
            if (e.state !== 'hoist' || e.targetId !== h.id || e.hoistTimer > 0) return;
            const d = Math.hypot(e.x - h.x, e.y - h.y);
            if (d <= h.radius + 18 && d < cd) { cd = d; cand = e; }
        });
        if (cand) { this.startHoist(h, cand); return true; }
        return false;
    },

    startHoist(h, u) {
        h.hoisting = { id: u.id, t: HOIST_TIME };
        u.hoistTimer = HOIST_TIME;
        u.hoistFromX = h.x;
        u.hoistFromY = h.y;
        u.hoistStartX = u.x;
        u.hoistStartY = u.y;
        u.state = 'hoisting';
        u.targetId = h.id;
        if (this.isWorldPointVisible(h.x, h.y)) sfx.playRappel();
    },

    completeHoist(h, u) {
        h.hoisting = null;
        u.hoistTimer = 0;
        if (h.passengers.length >= h.capacity || h.passengers.includes(u)) { u.state = 'idle'; u.targetId = null; return; }
        const idx = this.entities.indexOf(u);
        if (idx !== -1) this.entities.splice(idx, 1);
        u._removed = true;
        u.state = 'idle';
        u.targetId = null;
        u.targetPos = null;
        this.selectedIds.delete(u.id);
        h.passengers.push(u);
        this.particles.push({ x: h.x - 10, y: h.y - 22, vy: -14, text: `🪢 ${h.passengers.length}/${h.capacity}`, color: '#a5d6ff', life: 1.1, maxLife: 1.1 });
        this.recalcPopulation();
        if (this.selectedIds.has(h.id)) this.updateSelectionUI();
        else this.updateSelectionUI();
    },

    // Returns true while the aircraft is busy landing/taking off
    updateFlight(h, dt) {
        if (h.flightTransition > 0) {
            h.flightTransition = Math.max(0, h.flightTransition - dt);
            const k = h.flightTransition / 1.2;
            h.altitude = h.flightDir < 0 ? k : 1 - k;
            if (h.flightTransition === 0) {
                if (h.flightDir < 0) {
                    h.landed = true;
                    h.isAir = false;
                    h.altitude = 0;
                    this.showRadio(`🛬 ${h.name.toUpperCase()} LANDED — TROOPS CAN BOARD/EXIT. ENGINES IDLE (NO FUEL USE).`);
                } else {
                    h.altitude = 1;
                    this.showRadio(`🛫 ${h.name.toUpperCase()} AIRBORNE.`);
                }
                if (this.selectedIds.has(h.id)) this.updateSelectionUI();
            }
            return true;
        }
        if (h.rappelAll) {
            if (h.landed || h.passengers.length === 0) { h.rappelAll = false; }
            else {
                h.rappelCooldown = (h.rappelCooldown || 0) - dt;
                if (h.rappelCooldown <= 0) {
                    h.rappelCooldown = 1.1;
                    this.rappelPassenger(h, 0);
                }
            }
        }
        // Update 6: rope pickups (never while fast-roping troops out)
        if (!h.rappelAll && this.updateHoist(h, dt)) return true;
        return false;
    },

    rappelPassenger(h, idx) {
        if (!h.passengers || idx < 0 || idx >= h.passengers.length) return;
        const [p] = h.passengers.splice(idx, 1);
        const taken = this.entities.filter(e => e.category === 'unit' && Math.hypot(e.x - h.x, e.y - h.y) < 140).map(e => ({ x: e.x, y: e.y }));
        const spot = this.findEjectSpot(h, taken, idx + taken.length);
        p.x = spot.x;
        p.y = spot.y;
        p.rappelTimer = 1.0;
        p.rappelFromX = h.x;
        p.rappelFromY = h.y;
        p.state = 'idle';
        p.targetId = null;
        p.targetPos = null;
        p._removed = false;
        this.entities.push(p);
        if (this.isWorldPointVisible(h.x, h.y)) sfx.playRappel();
        this.recalcPopulation();
        if (this.selectedIds.has(h.id)) this.updateSelectionUI();
    },

    airbaseSlotPos(ab, isPlane, i) {
        return isPlane ? { x: ab.x - 40 + 40 * i, y: ab.y + 34 } : { x: ab.x - 40 + 40 * i, y: ab.y - 30 };
    },

    airbaseReserved(ab, isPlane) {
        const stored = isPlane ? ab.storedPlanes.length : ab.storedHelis.length;
        const enRoute = this.entities.filter(e => e.state === 'tostore' && e.targetId === ab.id && PLANE_TYPES.has(e.type) === isPlane).length;
        return stored + enRoute;
    },

    orderStoreAircraft(aircraft, ab) {
        let sent = 0, refused = 0;
        aircraft.forEach(a => {
            const isPlane = PLANE_TYPES.has(a.type);
            if (a.state === 'tostore' && a.targetId === ab.id) { sent++; return; }
            if (this.airbaseReserved(ab, isPlane) >= 3) { refused++; return; }
            a.state = 'tostore';
            a.targetId = ab.id;
            a.targetPos = null;
            a.holdPosition = false;
            if (a.landed) this.startTakeoff(a);
            sent++;
        });
        this.pings.push({ x: ab.x, y: ab.y, color: '#a5d6ff', life: 0.7 });
        sfx.playRadioAck(sent ? 'confirm' : 'alert');
        this.showRadio(`🛬 ${sent} AIRCRAFT RETURNING TO AIRBASE FOR STORAGE` + (refused ? ` — ${refused} REFUSED: ${ab.storedHelis.length >= 3 || ab.storedPlanes.length >= 3 ? 'STORAGE FULL' : 'NO FREE SLOT'} (MAX 3 HELICOPTERS + 3 PLANES).` : '.'));
    },

    updateStoreRun(a, dt) {
        const ab = this.getEntityById(a.targetId);
        if (!ab || ab.type !== 'airbase' || ab.underConstruction) { a.state = 'idle'; a.targetId = null; return; }
        if (a.landed) { this.startTakeoff(a); return; }
        if (a.flightTransition > 0) return;
        const isPlane = PLANE_TYPES.has(a.type);
        const list = isPlane ? ab.storedPlanes : ab.storedHelis;
        if (list.length >= 3) {
            a.state = 'idle'; a.targetId = null;
            this.showRadio(`AIRBASE ${isPlane ? 'RUNWAY' : 'HELIPADS'} FULL (3/3) — ${a.name.toUpperCase()} CANNOT BE STORED.`);
            return;
        }
        const pos = this.airbaseSlotPos(ab, isPlane, list.length);
        if (Math.hypot(pos.x - a.x, pos.y - a.y) > 14) {
            this.moveEntityToward(a, pos.x, pos.y, dt);
            return;
        }
        // Touchdown: disembark any passengers beside the base, then park the aircraft
        if (a.passengers && a.passengers.length) {
            const taken = [];
            a.passengers.forEach((p, i) => {
                const spot = this.findEjectSpot(ab, taken, i);
                taken.push(spot);
                p.x = spot.x; p.y = spot.y; p.state = 'idle'; p.targetId = null; p.targetPos = null; p._removed = false;
                this.entities.push(p);
            });
            a.passengers = [];
        }
        this.removeEntityQuiet(a);
        a.state = 'stored';
        a.targetId = null;
        a.targetPos = null;
        a.landed = false;
        a.flightTransition = 0;
        a.burstLeft = 0;
        list.push(a);
        if (this.isWorldPointVisible(ab.x, ab.y)) sfx.playRotorTransition(false);
        this.showRadio(`🅿 ${a.name.toUpperCase()} STORED AT AIRBASE (${isPlane ? 'RUNWAY' : 'HELIPAD'} ${list.length}/3) — REFUELING.`);
        this.recalcPopulation();
        this.updateSelectionUI();
    },

    deployStoredAircraft(ab, isPlane, i) {
        const list = isPlane ? ab.storedPlanes : ab.storedHelis;
        const a = list[i];
        if (!a) return;
        list.splice(i, 1);
        const pos = this.airbaseSlotPos(ab, isPlane, i);
        a.x = pos.x;
        a.y = pos.y;
        a.state = 'move';
        a.targetPos = { x: pos.x + (isPlane ? 140 : 0), y: pos.y - 110 };
        a.targetId = null;
        a._removed = false;
        a.isAir = true;
        a.landed = false;
        if (HELI_TYPES.has(a.type)) { a.altitude = 0; a.flightTransition = 1.2; a.flightDir = 1; }
        else { a.altitude = 1; a.flightTransition = 0; }
        a._lowFuelWarned = false;
        this.entities.push(a);
        if (this.isWorldPointVisible(ab.x, ab.y)) sfx.playRotorTransition(true);
        this.showRadio(`🛫 ${a.name.toUpperCase()} DEPLOYED FROM AIRBASE (FUEL ${Math.round(a.fuel / a.fuelMax * 100)}%).`);
        this.recalcPopulation();
        this.updateSelectionUI();
    },

    renderAirbaseStorage(ctx, ab) {
        const draw = (a, pos, isPlane) => {
            const spr = SpriteBank['veh_' + a.type];
            if (!spr) return;
            ctx.save();
            ctx.translate(pos.x, pos.y);
            ctx.rotate(isPlane ? 0 : -Math.PI / 2);
            ctx.scale(0.62, 0.62);
            ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
            ctx.restore();
            const fp = a.fuelMax ? a.fuel / a.fuelMax : 1;
            ctx.fillStyle = '#0d1117';
            ctx.fillRect(pos.x - 14, pos.y + 13, 28, 4);
            ctx.fillStyle = fp < 0.999 ? '#58a6ff' : '#3fb950';
            ctx.fillRect(pos.x - 13, pos.y + 14, 26 * fp, 2);
        };
        ab.storedHelis.forEach((a, i) => draw(a, this.airbaseSlotPos(ab, false, i), false));
        ab.storedPlanes.forEach((a, i) => draw(a, this.airbaseSlotPos(ab, true, i), true));
        ctx.font = 'bold 13px VT323, monospace';
        ctx.fillStyle = '#a5d6ff';
        ctx.fillText(`H ${ab.storedHelis.length}/3 · P ${ab.storedPlanes.length}/3`, ab.x - 34, ab.y - 70);
    }
});
