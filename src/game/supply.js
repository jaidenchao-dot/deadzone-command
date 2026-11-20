'use strict';
// Supply vehicles: cargo, resupply, HQ refill, vehicle-to-vehicle transfer
defineGameMethods({
    // ========================================================================
    // UPDATE 5: SUPPLY VEHICLE LOGISTICS
    // ========================================================================
    cargoWeight(sv) {
        let w = 0;
        for (const t of AMMO_ORDER) w += (sv.inventory[t] || 0) * AMMO_DEFS[t].weight;
        return w;
    },

    planTarget(sv, t) {
        return Math.floor((sv.cargoCapacity * SUPPLY_PLAN[t]) / AMMO_DEFS[t].weight);
    },

    fillSupplyPlan(sv) {
        for (const t of AMMO_ORDER) sv.inventory[t] = this.planTarget(sv, t);
    },

    // Move ammo / rations / fuel from a supply vehicle into one friendly unit or vehicle (and its passengers).
    // Only ammunition types the receiver actually uses are transferred; nothing exceeds the receiver's capacity.
    // passive = automatic aura top-up: only refills what is meaningfully depleted (no ration/ammo trickle spam)
    resupplyEntity(sv, target, summary, passive = false) {
        const give = (t, n) => {
            if (n <= 0) return 0;
            const q = Math.min(n, Math.floor(sv.inventory[t] || 0));
            if (q <= 0) return 0;
            sv.inventory[t] -= q;
            summary[t] = (summary[t] || 0) + q;
            return q;
        };
        let total = 0;
        if (target.ammoMax) {
            for (const t of Object.keys(target.ammoMax)) {
                if (passive && target.ammo[t] > target.ammoMax[t] * 0.85) continue;
                const need = Math.floor(target.ammoMax[t] - target.ammo[t]);
                const q = give(t, need);
                if (q > 0) { target.ammo[t] += q; total += q; target._ammoWarned = false; }
            }
        }
        if (target.food !== undefined && target.food <= 100 - RATION_FOOD * (passive ? 1 : 0.5)) {
            const rations = Math.max(1, Math.round((100 - target.food) / RATION_FOOD));
            const q = give('food', rations);
            if (q > 0) {
                target.food = Math.min(100, target.food + q * RATION_FOOD);
                target.starveTimer = 0;
                target._hungryWarned = false;
                total += q;
            }
        }
        if (target.fuelMax && target.fuel < target.fuelMax * (passive ? 0.85 : 1)) {
            const q = give('fuel', Math.floor(target.fuelMax - target.fuel));
            if (q > 0) { target.fuel = Math.min(target.fuelMax, target.fuel + q); target._emptyWarned = false; total += q; }
        }
        if (target.passengers) target.passengers.forEach(p => { total += this.resupplyEntity(sv, p, summary, passive); });
        return total;
    },

    summarizeSupply(summary) {
        return Object.entries(summary).filter(([, q]) => q > 0).map(([t, q]) => `+${q} ${AMMO_DEFS[t].short}`).join(' ');
    },

    // Resupply every friendly unit / vehicle around a supply vehicle
    supplyPulse(sv, radius, announce) {
        const recipients = [];
        this.forEachInRadius(sv.x, sv.y, radius + MAX_ENTITY_RADIUS, (e) => {
            if (e === sv || e.faction !== 'player' || e.supply) return;
            if (e.category !== 'unit' && e.category !== 'vehicle') return;
            if (Math.hypot(e.x - sv.x, e.y - sv.y) > radius + (e.radius || 0)) return;
            recipients.push(e);
        });
        // Update 6: troops riding inside the supply vehicle itself are kept supplied too
        if (sv.passengers && sv.passengers.length) recipients.push({ _seatProxy: true, x: sv.x, y: sv.y, passengers: sv.passengers });
        let served = 0;
        const grand = {};
        for (const e of recipients) {
            const summary = {};
            if (this.resupplyEntity(sv, e, summary, !announce) > 0) {
                served++;
                Object.entries(summary).forEach(([t, q]) => { grand[t] = (grand[t] || 0) + q; });
                const txt = this.summarizeSupply(summary);
                this.particles.push({ x: e.x - 10, y: e.y - 16, vy: -16, text: txt.length > 26 ? txt.slice(0, 26) + '…' : txt, color: '#f2cc60', life: 1.4, maxLife: 1.4 });
                this.particles.push({ x: e.x, y: e.y, radius: 4, expandRate: 50, color: '#f2cc60', life: 0.35, maxLife: 0.35 });
            }
        }
        if (served > 0) {
            if (this.isWorldPointVisible(sv.x, sv.y)) sfx.playResupply();
            if (announce) this.showRadio(`📦 ${sv.name.toUpperCase()} RESUPPLIED ${served} UNIT(S): ${this.summarizeSupply(grand)}`);
            if (this.selectedIds.has(sv.id)) this.refreshLiveStatus();
        } else if (announce) {
            this.showRadio(`📦 NO FRIENDLY UNITS IN RANGE NEED SUPPLIES (OR ${sv.name.toUpperCase()} IS EMPTY OF WHAT THEY USE).`);
        }
        return served;
    },

    updateSupplyVehicle(sv, dt) {
        sv.supplyPulseTimer -= dt;
        if (sv.supplyPulseTimer <= 0) {
            sv.supplyPulseTimer = 2.0;
            this.supplyPulse(sv, SUPPLY_PULSE_RADIUS, false);
        }
        // Targeted resupply run
        if (sv.state === 'resupply' && sv.targetId) {
            const t = this.getEntityById(sv.targetId);
            if (!t || t.faction !== 'player') { sv.state = 'idle'; sv.targetId = null; return true; }
            if (Math.hypot(t.x - sv.x, t.y - sv.y) <= sv.radius + (t.radius || 10) + 50) {
                const summary = {};
                const n = this.resupplyEntity(sv, t, summary);
                if (this.isWorldPointVisible(sv.x, sv.y)) sfx.playResupply();
                this.particles.push({ x: t.x - 10, y: t.y - 16, vy: -16, text: n > 0 ? this.summarizeSupply(summary).slice(0, 30) : 'FULLY STOCKED', color: '#f2cc60', life: 1.5, maxLife: 1.5 });
                this.showRadio(n > 0 ? `📦 ${t.name.toUpperCase()} RESUPPLIED: ${this.summarizeSupply(summary)}` : `📦 ${t.name.toUpperCase()} NEEDS NOTHING ${sv.name.toUpperCase()} CARRIES.`);
                sv.state = 'idle'; sv.targetId = null;
                if (this.selectedIds.has(sv.id)) this.refreshLiveStatus();
                return true;
            }
            this.moveEntityToward(sv, t.x, t.y, dt);
            return true;
        }
        // Driving over to another supply vehicle to transfer
        if (sv.state === 'gotransfer' && sv.targetId) {
            const t = this.getEntityById(sv.targetId);
            if (!t || !t.supply) { sv.state = 'idle'; sv.targetId = null; return true; }
            if (Math.hypot(t.x - sv.x, t.y - sv.y) <= 200) {
                sv.state = 'idle'; sv.targetId = null;
                this.openTransferModal(sv, t);
                return true;
            }
            this.moveEntityToward(sv, t.x, t.y, dt);
            return true;
        }
        return false;
    },

    getHqEntity() {
        return this.entities.find(e => e.faction === 'player' && e.type === 'hq') || null;
    },

    // Refill a supply vehicle at the Command Center toward its standard loadout; cheapest essentials first,
    // partially if the player can't afford everything. Missiles/rockets/bombs cost far more than bullets.
    refillSupplyVehicle(sv, quiet = false) {
        const hq = this.getHqEntity();
        if (!hq || Math.hypot(hq.x - sv.x, hq.y - sv.y) > HQ_REFILL_RANGE) {
            if (!quiet) this.showRadio(`${sv.name.toUpperCase()} MUST BE NEXT TO THE COMMAND CENTER TO REFILL.`);
            return null;
        }
        const order = ['food', 'fuel', 'rifle', 'pistol', 'mg', 'shotgun', 'hmg', 'sniper', 'autocannon', 'flame', 'tankshell', 'rockets', 'missiles', 'bombs'];
        const added = {};
        let costS = 0, costF = 0, short = false;
        for (const t of order) {
            const def = AMMO_DEFS[t];
            const want = this.planTarget(sv, t) - Math.floor(sv.inventory[t]);
            if (want <= 0) continue;
            const room = Math.floor((sv.cargoCapacity - this.cargoWeight(sv)) / def.weight);
            let q = Math.min(want, room);
            if (def.scrap > 0) q = Math.min(q, Math.floor((this.scrap - costS) / def.scrap));
            if (def.fuel > 0) q = Math.min(q, Math.floor((this.fuel - costF) / def.fuel));
            if (q < want) short = true;
            if (q <= 0) continue;
            sv.inventory[t] += q;
            added[t] = q;
            costS += q * def.scrap;
            costF += q * def.fuel;
        }
        costS = Math.ceil(costS); costF = Math.ceil(costF);
        this.scrap = Math.max(0, this.scrap - costS);
        this.fuel = Math.max(0, this.fuel - costF);
        if (!quiet) {
            if (Object.keys(added).length === 0) {
                this.showRadio(short ? `INSUFFICIENT SCRAP/FUEL TO REFILL ${sv.name.toUpperCase()}.` : `${sv.name.toUpperCase()} IS ALREADY FULLY STOCKED.`);
            } else {
                sfx.playResupply();
                this.showRadio(`🏭 ${sv.name.toUpperCase()} REFILLED (−${costS} SCRAP, −${costF} FUEL)${short ? ' — PARTIAL, LOW RESOURCES' : ''}: ${this.summarizeSupply(added).slice(0, 90)}`);
            }
        }
        if (this.selectedIds.has(sv.id)) this.refreshLiveStatus();
        return { added, costS, costF, short };
    },

    refillAllSupplyNearHQ() {
        const hq = this.getHqEntity();
        if (!hq) return;
        const svs = this.entities.filter(e => e.faction === 'player' && e.supply && Math.hypot(e.x - hq.x, e.y - hq.y) <= HQ_REFILL_RANGE);
        if (svs.length === 0) {
            sfx.playRadioAck('alert');
            this.showRadio(`NO SUPPLY VEHICLES PARKED AT THE COMMAND CENTER (WITHIN ${Math.round(HQ_REFILL_RANGE / TILE_SIZE)} TILES).`);
            return;
        }
        let s2 = 0, f2 = 0, n = 0;
        svs.forEach(sv => { const r = this.refillSupplyVehicle(sv, true); if (r && Object.keys(r.added).length) { n++; s2 += r.costS; f2 += r.costF; } });
        if (n > 0) sfx.playResupply();
        this.showRadio(n > 0 ? `🏭 REFILLED ${n} SUPPLY VEHICLE(S) AT THE COMMAND CENTER (−${s2} SCRAP, −${f2} FUEL).` : 'SUPPLY VEHICLES ARE FULL — OR NOT ENOUGH SCRAP/FUEL.');
        this.updateSelectionUI();
    },

    // Transfer chosen quantities between two supply vehicles (receiver capacity enforced, sender must have them)
    transferSupplies(from, to, request) {
        const moved = {};
        for (const t of AMMO_ORDER) {
            let q = Math.floor(request[t] || 0);
            if (q <= 0) continue;
            q = Math.min(q, Math.floor(from.inventory[t]));
            const room = Math.floor((to.cargoCapacity - this.cargoWeight(to)) / AMMO_DEFS[t].weight);
            q = Math.min(q, room);
            if (q <= 0) continue;
            from.inventory[t] -= q;
            to.inventory[t] += q;
            moved[t] = q;
        }
        return moved;
    },

    startTransferTo(from, to) {
        if (Math.hypot(from.x - to.x, from.y - to.y) <= 200) {
            this.openTransferModal(from, to);
        } else {
            from.state = 'gotransfer';
            from.targetId = to.id;
            from.targetPos = null;
            sfx.playRadioAck('confirm');
            this.showRadio(`🔁 ${from.name.toUpperCase()} DRIVING TO ${to.name.toUpperCase()} FOR TRANSFER.`);
        }
    },

    openTransferModal(from, to) {
        const modal = document.getElementById('transfer-modal');
        if (!modal) return;
        this.transferPair = { fromId: from.id, toId: to.id };
        const rows = AMMO_ORDER.map(t => `
            <tr>
                <td style="text-align:left">${AMMO_DEFS[t].name}</td>
                <td>${Math.floor(from.inventory[t])}</td>
                <td>${Math.floor(to.inventory[t])}</td>
                <td><input type="number" min="0" max="${Math.floor(from.inventory[t])}" value="0" data-type="${t}" class="xfer-input"></td>
                <td><button class="form-btn xfer-max" data-type="${t}">MAX</button></td>
            </tr>`).join('');
        document.getElementById('xfer-title').textContent = `${from.name.toUpperCase()}  ➜  ${to.name.toUpperCase()}`;
        document.getElementById('xfer-cap').textContent =
            `Sender cargo ${Math.round(this.cargoWeight(from))}/${from.cargoCapacity} · Receiver cargo ${Math.round(this.cargoWeight(to))}/${to.cargoCapacity} (receiver capacity is enforced)`;
        document.getElementById('xfer-rows').innerHTML = rows;
        document.querySelectorAll('.xfer-max').forEach(b => b.addEventListener('click', () => {
            const t = b.dataset.type;
            const inp = document.querySelector(`.xfer-input[data-type="${t}"]`);
            const room = Math.floor((to.cargoCapacity - this.cargoWeight(to)) / AMMO_DEFS[t].weight);
            inp.value = Math.max(0, Math.min(Math.floor(from.inventory[t]), room));
        }));
        modal.style.display = 'flex';
        sfx.playRadioAck('select');
    },

    executeTransferFromModal() {
        const pair = this.transferPair;
        const modal = document.getElementById('transfer-modal');
        if (!pair) { modal.style.display = 'none'; return; }
        const from = this.getEntityById(pair.fromId) || this.entities.find(e => e.id === pair.fromId);
        const to = this.getEntityById(pair.toId) || this.entities.find(e => e.id === pair.toId);
        if (!from || !to) { modal.style.display = 'none'; this.showRadio('TRANSFER ABORTED — VEHICLE LOST.'); return; }
        if (Math.hypot(from.x - to.x, from.y - to.y) > 260) { modal.style.display = 'none'; this.showRadio('TRANSFER ABORTED — VEHICLES TOO FAR APART.'); return; }
        const req = {};
        document.querySelectorAll('.xfer-input').forEach(inp => { req[inp.dataset.type] = parseInt(inp.value, 10) || 0; });
        const moved = this.transferSupplies(from, to, req);
        modal.style.display = 'none';
        this.transferPair = null;
        if (Object.keys(moved).length > 0) {
            sfx.playResupply();
            this.showRadio(`🔁 TRANSFERRED ${this.summarizeSupply(moved).slice(0, 100)} TO ${to.name.toUpperCase()}.`);
        } else {
            this.showRadio('🔁 NOTHING TRANSFERRED (EMPTY SELECTION, SENDER OUT OF STOCK, OR RECEIVER FULL).');
        }
        this.updateSelectionUI();
    }
});
