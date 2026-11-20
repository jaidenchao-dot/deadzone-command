'use strict';
// Mechanic repairs, Medic Tent, medic healing, infection & treatment, passenger ejection
defineGameMethods({
    // ========================================================================
    // UPDATE 4: MECHANIC REPAIRS & MEDIC PASSIVE HEALING
    // ========================================================================
    isRepairable(e) {
        return !!e && e.faction === 'player' && (e.category === 'building' || e.category === 'vehicle') &&
            !e.underConstruction && e.hp < e.maxHp;
    },

    findRepairJob(x, y, range) {
        let best = null, bestScore = Infinity;
        for (const e of this.entities) {
            if (!this.isRepairable(e)) continue;
            const d = Math.hypot(e.x - x, e.y - y);
            if (d > range) continue;
            const score = d + (e.hp / e.maxHp) * 150; // prefer badly damaged, nearby equipment
            if (score < bestScore) { bestScore = score; best = e; }
        }
        return best;
    },

    assignRepair(mechanics, target) {
        let best = null, bestD = Infinity;
        for (const m of mechanics) {
            if (m.type !== 'mechanic') continue;
            const busyElsewhere = m.state === 'repair' && m.targetId && m.targetId !== target.id;
            const d = Math.hypot(m.x - target.x, m.y - target.y) + (busyElsewhere ? 2000 : 0);
            if (d < bestD) { bestD = d; best = m; }
        }
        if (!best) return null;
        best.state = 'repair';
        best.targetId = target.id;
        best.targetPos = null;
        best.holdPosition = false;
        this.pings.push({ x: target.x, y: target.y, color: '#58a6ff', life: 0.7 });
        return best;
    },

    isHealable(medic, p) {
        return !!p && p !== medic && !p._removed && this.isFriendlyHuman(p) && (p.category === 'unit' || p.category === 'survivor') &&
            p.hp > 0 && p.hp < p.maxHp;
    },

    // Update 6: Medic Tent — most-injured friendly human in range is treated until full, then the next one
    updateMedicTent(tent, dt) {
        const R = tent.healRadius || BUILDING_DEFS.medictent.healRadius;
        let patient = tent.healTargetId ? this.getEntityById(tent.healTargetId) : null;
        if (patient && (!this.isHealable(tent, patient) || patient.hoistTimer > 0 || Math.hypot(patient.x - tent.x, patient.y - tent.y) > R + 10)) {
            patient = null;
            tent.healTargetId = null;
        }
        if (!patient) {
            tent.healScan = (tent.healScan || 0) - dt;
            if (tent.healScan > 0) return;
            tent.healScan = MEDIC_TENT_HEAL_SCAN;
            let best = null, bestRatio = 1;
            this.forEachInRadius(tent.x, tent.y, R, (e) => {
                if (!this.isHealable(tent, e)) return;
                if (Math.hypot(e.x - tent.x, e.y - tent.y) > R) return;
                const ratio = e.hp / e.maxHp;
                if (ratio < bestRatio) { bestRatio = ratio; best = e; }
            });
            if (!best) return;
            patient = best;
            tent.healTargetId = best.id;
        }
        patient.hp = Math.min(patient.maxHp, patient.hp + (tent.healRate || BUILDING_DEFS.medictent.healRate) * dt);
        tent.healFx = (tent.healFx || 0) + dt;
        if (tent.healFx >= 0.6) {
            tent.healFx = 0;
            this.particles.push({ x: patient.x + (Math.random() - 0.5) * 10, y: patient.y - 12, vy: -16, text: '+', color: '#ff7b72', life: 0.7, maxLife: 0.7 });
        }
        if (patient.hp >= patient.maxHp) tent.healTargetId = null;
    },

    updateMedicPassiveHeal(medic, dt) {
        let patient = medic.healTargetId ? this.getEntityById(medic.healTargetId) : null;
        // Stick with the current patient until healed or out of reach (prevents rapid switching)
        if (patient && (!this.isHealable(medic, patient) || Math.hypot(patient.x - medic.x, patient.y - medic.y) > MEDIC_HEAL_RANGE + 40)) {
            patient = null;
            medic.healTargetId = null;
        }
        if (!patient) {
            medic.healScan = (medic.healScan || 0) - dt;
            if (medic.healScan > 0) return;
            medic.healScan = 0.5;
            let best = null, bestRatio = 1;
            this.forEachInRadius(medic.x, medic.y, MEDIC_HEAL_RANGE, (e) => {
                if (!this.isHealable(medic, e)) return;
                if (Math.hypot(e.x - medic.x, e.y - medic.y) > MEDIC_HEAL_RANGE) return;
                const ratio = e.hp / e.maxHp;
                if (ratio < bestRatio) { bestRatio = ratio; best = e; }
            });
            if (!best) return;
            patient = best;
            medic.healTargetId = best.id;
        }
        patient.hp = Math.min(patient.maxHp, patient.hp + MEDIC_HEAL_RATE * dt);
        medic.healFx = (medic.healFx || 0) + dt;
        if (medic.healFx >= 0.7) {
            medic.healFx = 0;
            this.particles.push({ x: patient.x + (Math.random() - 0.5) * 10, y: patient.y - 12, vy: -16, text: '+', color: '#7ee787', life: 0.7, maxLife: 0.7 });
        }
        if (patient.hp >= patient.maxHp) medic.healTargetId = null;
    },

    // ========================================================================
    // UPDATE 3: VEHICLE PASSENGER EJECTION
    // ========================================================================
    isSpotWalkable(x, y, taken) {
        if (x < 24 || y < 24 || x > MAP_WIDTH - 24 || y > MAP_HEIGHT - 24) return false;
        if (!this.isTileOpen(Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE))) return false;
        for (const t of taken) {
            if (Math.hypot(t.x - x, t.y - y) < 20) return false;
        }
        for (const e of this.entities) {
            if (e.category !== 'building' && e.category !== 'mercstruct' && e.category !== 'hive' &&
                e.category !== 'fort' && e.category !== 'shelter') continue;
            if (e.category === 'building' && e.type === 'gate' && e.isOpen) continue;
            if (Math.hypot(e.x - x, e.y - y) < (e.radius || 14) + 10) return false;
        }
        return true;
    },

    // Find a free, reachable ground spot around a vehicle (works for helicopters over buildings/rubble too)
    findEjectSpot(veh, taken, index) {
        for (let ring = 0; ring < 12; ring++) {
            const rad = (veh.radius || 20) + 14 + ring * 18;
            const steps = 8 + ring * 4;
            for (let k = 0; k < steps; k++) {
                const ang = (k / steps) * Math.PI * 2 + index * 0.37 + ring * 0.21;
                const x = veh.x + Math.cos(ang) * rad;
                const y = veh.y + Math.sin(ang) * rad;
                if (this.isSpotWalkable(x, y, taken)) return { x, y };
            }
        }
        const t = this.findOpenTileNear(Math.floor(veh.x / TILE_SIZE), Math.floor(veh.y / TILE_SIZE), 10);
        if (t) return { x: t.c * TILE_SIZE + TILE_SIZE / 2 + (index % 3 - 1) * 8, y: t.r * TILE_SIZE + TILE_SIZE / 2 + (Math.floor(index / 3) % 3 - 1) * 8 };
        return { x: veh.x, y: veh.y };
    },

    ejectPassengers(veh) {
        const taken = [];
        const count = veh.passengers.length;
        veh.passengers.forEach((p, idx) => {
            const spot = this.findEjectSpot(veh, taken, idx);
            taken.push(spot);
            p.x = spot.x;
            p.y = spot.y;
            p.state = 'idle';
            p.targetId = null;
            p.targetPos = null;
            p.holdPosition = false;
            p._removed = false;
            this.entities.push(p);
        });
        veh.passengers = [];
        sfx.playRadioAck('alert');
        this.showRadio(`🚨 ${veh.name.toUpperCase()} DESTROYED — ${count} PASSENGER(S) BAILED OUT!`);
        this.recalcPopulation();
        this.updateSelectionUI();
    },

    // ========================================================================
    // UPDATE 3: HUMAN INFECTION & COMBAT MEDIC TREATMENT
    // ========================================================================
    isHumanEntity(ent) {
        return !!ent && (ent.category === 'unit' || ent.category === 'survivor' || ent.category === 'merc');
    },

    isFriendlyHuman(ent) {
        return !!ent && ((ent.faction === 'player' && ent.category === 'unit') || ent.category === 'survivor');
    },

    tryInfect(target, chance) {
        if (!this.isHumanEntity(target) || target.infected || !(chance > 0)) return false;
        if (Math.random() >= chance) return false;
        target.infected = true;
        target.infectionTimer = INFECTION_TIME;
        this.spawnImpactParticles(target.x, target.y, '#a6e22e', 6);
        if (target.faction === 'player' && this.elapsedTime - this.lastInfectRadio > 4) {
            this.lastInfectRadio = this.elapsedTime;
            sfx.playRadioAck('alert');
            this.showRadio(`☣ ${target.name.toUpperCase()} HAS BEEN INFECTED! A COMBAT MEDIC MUST TREAT THEM WITHIN ${INFECTION_TIME}s.`);
        }
        if (this.selectedIds.has(target.id)) this.updateSelectionUI();
        return true;
    },

    transformInfected(ent, alreadyRemoved = false) {
        if (!alreadyRemoved) this.removeEntityQuiet(ent);
        const heavy = ent.type === 'heavy' || ent.type === 'gunner';
        const zType = heavy && Math.random() < 0.4 ? 'brute' : (Math.random() < 0.25 ? 'runner' : 'walker');
        const z = this.createZombie(zType, ent.x, ent.y, false);
        z.angle = ent.angle || 0;
        this.decals.push({ x: ent.x, y: ent.y, radius: 9, color: 'rgba(92, 24, 34, 0.5)' });
        if (this.decals.length > 110) this.decals.shift();
        this.spawnImpactParticles(ent.x, ent.y, '#a6e22e', 12);
        if (ent.category === 'survivor' || ent.isSurvivor) this.survivorsLost++;
        if (ent.faction === 'player') {
            sfx.playRadioAck('alert');
            this.showRadio(`☣ ${ent.name.toUpperCase()} HAS TURNED — NOW HOSTILE INFECTED!`);
            this.recalcPopulation();
            this.updateSelectionUI();
        } else if (this.isWorldPointVisible(ent.x, ent.y)) {
            this.showRadio(`☣ AN INFECTED ${ent.category === 'merc' ? 'BANDIT' : 'SURVIVOR'} HAS TURNED.`);
        }
        return z;
    },

    cureInfection(medic, patient) {
        if (!patient.infected || !(medic.treatCharges > 0)) return false;
        patient.infected = false;
        patient.infectionTimer = 0;
        medic.treatCharges--;
        if (medic.treatCharges <= 0) {
            medic.treatCooldown = UNIT_DEFS.medic.treatCooldown;
        }
        this.particles.push({ x: patient.x, y: patient.y, radius: 6, expandRate: 90, color: '#7ee787', life: 0.45, maxLife: 0.45 });
        this.particles.push({ x: patient.x, y: patient.y - 14, vy: -18, text: '✚ CURED', color: '#7ee787', life: 1.2, maxLife: 1.2 });
        sfx.playRadioAck('build');
        this.showRadio(`✚ ${patient.name.toUpperCase()} CURED — MEDIC TREATMENTS LEFT: ${medic.treatCharges}/${medic.treatMax}` +
            (medic.treatCharges <= 0 ? ` (RECHARGING ${UNIT_DEFS.medic.treatCooldown}s)` : ''));
        this.updateSelectionUI();
        return true;
    },

    // Send the nearest medic (from `medics`) that has treatments left to cure `patient`
    assignTreatment(medics, patient) {
        if (!patient || !patient.infected) return null;
        let best = null, bestD = Infinity;
        for (const m of medics) {
            if (m.type !== 'medic' || !(m.treatCharges > 0)) continue;
            // Don't double-book a medic that is already treating someone else
            if (m.state === 'treat' && m.targetId && m.targetId !== patient.id) continue;
            const d = Math.hypot(m.x - patient.x, m.y - patient.y);
            if (d < bestD) { bestD = d; best = m; }
        }
        if (!best) return null;
        best.state = 'treat';
        best.targetId = patient.id;
        best.targetPos = null;
        best.holdPosition = false;
        this.pings.push({ x: patient.x, y: patient.y, color: '#7ee787', life: 0.7 });
        return best;
    }
});
