'use strict';
// Player orders: selection, control groups, formations, right-click orders, targeting modes, unload / stop / hold
defineGameMethods({
    getSelectedMobileForces() {
        return this.entities.filter(e =>
            this.selectedIds.has(e.id) &&
            e.faction === 'player' &&
            (e.category === 'unit' || e.category === 'vehicle')
        );
    },

    assignControlGroup(slot, announce = true) {
        const mobile = this.getSelectedMobileForces();
        if (mobile.length === 0) return;
        this.controlGroups[slot] = mobile.map(m => m.id);
        this.renderControlGroupsBar();
        if (announce) {
            sfx.playRadioAck('confirm');
            this.showRadio(`SQUAD GROUP [${slot}] ASSIGNED (${mobile.length} UNITS).`);
        }
    },

    selectControlGroup(slot) {
        const aliveIds = this.controlGroups[slot].filter(id => this.entities.some(e => e.id === id));
        this.controlGroups[slot] = aliveIds;
        this.renderControlGroupsBar();
        if (aliveIds.length === 0) return;

        const alreadySelected = aliveIds.length === this.selectedIds.size && aliveIds.every(id => this.selectedIds.has(id));
        this.selectedIds.clear();
        aliveIds.forEach(id => this.selectedIds.add(id));
        this.updateSelectionUI();
        sfx.playRadioAck('select');

        if (alreadySelected) {
            const members = this.entities.filter(e => aliveIds.includes(e.id));
            if (members.length > 0) {
                const avgX = members.reduce((s, m) => s + m.x, 0) / members.length;
                const avgY = members.reduce((s, m) => s + m.y, 0) / members.length;
                this.panCameraToWorld(avgX, avgY);
            }
        }
    },

    clearControlGroup(slot) {
        this.controlGroups[slot] = [];
        this.renderControlGroupsBar();
    },

    renderControlGroupsBar() {
        const container = document.getElementById('group-chips-container');
        if (!container) return;
        container.innerHTML = '';

        for (let g = 1; g <= 6; g++) {
            const validIds = this.controlGroups[g].filter(id => this.entities.some(e => e.id === id));
            this.controlGroups[g] = validIds;
            const chip = document.createElement('div');
            const hasUnits = validIds.length > 0;
            const isActive = hasUnits && validIds.some(id => this.selectedIds.has(id));
            chip.className = 'grp-chip' + (hasUnits ? ' has-units' : '') + (isActive ? ' active-grp' : '');
            chip.title = hasUnits
                ? `Click to select Squad [${g}] (${validIds.length} units) | Click again to center camera | Ctrl+${g} to overwrite`
                : `Empty Squad Slot [${g}] — Select units and press Ctrl+${g} or '+ CREATE GROUP'`;

            chip.innerHTML = `<span>[${g}] ${hasUnits ? `GRP ${g} (${validIds.length})` : 'EMPTY'}</span>` +
                (hasUnits ? `<span class="grp-clear" title="Clear Group ${g}">×</span>` : '');

            chip.addEventListener('click', (e) => {
                if (e.target.classList.contains('grp-clear')) {
                    e.stopPropagation();
                    this.clearControlGroup(g);
                    return;
                }
                if (hasUnits) {
                    this.selectControlGroup(g);
                } else {
                    this.assignControlGroup(g, true);
                }
            });
            container.appendChild(chip);
        }
    },

    setFormation(formName) {
        this.activeFormation = formName;
        document.querySelectorAll('.form-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.formation === formName);
        });
        sfx.playRadioAck('select');
        this.showRadio(`FORMATION SET: ${formName.toUpperCase()}`);
    },

    computeFormationPositions(units, destX, destY) {
        const n = units.length;
        if (n <= 1) return [{ x: destX, y: destY }];

        const sorted = [...units].sort((a, b) => {
            const score = (u) => {
                if (u.category === 'vehicle') return 0;
                if (u.type === 'heavy' || u.type === 'shotgunner') return 1;
                if (u.type === 'rifleman') return 2;
                return 3;
            };
            return score(a) - score(b);
        });

        const avgX = sorted.reduce((s, u) => s + u.x, 0) / n;
        const avgY = sorted.reduce((s, u) => s + u.y, 0) / n;
        const heading = Math.atan2(destY - avgY, destX - avgX);
        const fwdX = Math.cos(heading);
        const fwdY = Math.sin(heading);
        const rightX = -fwdY;
        const rightY = fwdX;

        const spacing = 28;
        const posMap = new Map();

        if (this.activeFormation === 'line') {
            const cols = Math.min(n, Math.max(3, Math.ceil(Math.sqrt(n * 2.2))));
            sorted.forEach((u, i) => {
                const row = Math.floor(i / cols);
                const col = i % cols;
                const rowCount = Math.min(cols, n - row * cols);
                const lateral = (col - (rowCount - 1) / 2) * spacing;
                const depth = -row * spacing;
                posMap.set(u.id, {
                    x: destX + rightX * lateral + fwdX * depth,
                    y: destY + rightY * lateral + fwdY * depth
                });
            });
        } else if (this.activeFormation === 'wedge') {
            sorted.forEach((u, i) => {
                if (i === 0) {
                    posMap.set(u.id, { x: destX, y: destY });
                } else {
                    const rank = Math.ceil(i / 2);
                    const side = (i % 2 === 1) ? -1 : 1;
                    const lateral = side * rank * (spacing * 0.85);
                    const depth = -rank * (spacing * 0.85);
                    posMap.set(u.id, {
                        x: destX + rightX * lateral + fwdX * depth,
                        y: destY + rightY * lateral + fwdY * depth
                    });
                }
            });
        } else if (this.activeFormation === 'column') {
            const cols = n > 6 ? 2 : 1;
            sorted.forEach((u, i) => {
                const row = Math.floor(i / cols);
                const col = i % cols;
                const lateral = cols === 2 ? (col === 0 ? -15 : 15) : 0;
                const depth = -row * spacing;
                posMap.set(u.id, {
                    x: destX + rightX * lateral + fwdX * depth,
                    y: destY + rightY * lateral + fwdY * depth
                });
            });
        } else {
            const innerCount = Math.max(1, Math.floor(n / 4));
            const outerCount = n - innerCount;
            const outerRadius = Math.max(36, (outerCount * spacing) / (2 * Math.PI));

            sorted.forEach((u, i) => {
                if (i < outerCount) {
                    const ang = heading + (i / outerCount) * Math.PI * 2;
                    posMap.set(u.id, {
                        x: destX + Math.cos(ang) * outerRadius,
                        y: destY + Math.sin(ang) * outerRadius
                    });
                } else {
                    const innerIdx = i - outerCount;
                    const ang = (innerIdx / innerCount) * Math.PI * 2;
                    const r = innerCount === 1 ? 0 : 18;
                    posMap.set(u.id, {
                        x: destX + Math.cos(ang) * r,
                        y: destY + Math.sin(ang) * r
                    });
                }
            });
        }

        // Update 6: every unit gets its own reachable spot — slots that land inside a building, wall, rubble or
        // water are moved to the nearest open ground, and no two units are sent to the same point
        const used = [];
        return units.map(u => {
            const pt = posMap.get(u.id) || { x: destX, y: destY };
            let x = Math.max(136, Math.min(MAP_WIDTH - 136, pt.x));
            let y = Math.max(72, Math.min(MAP_HEIGHT - 136, pt.y));
            if ((this.navBlocked || this.infinite) && !u.isAir) {
                const big = this.navIsBig(u);
                const c = Math.floor(x / TILE_SIZE), r = Math.floor(y / TILE_SIZE);
                if (!this.navPassable(r * MAP_COLS + c, u, big)) {
                    const i = this.navNearestPassable(c, r, u, big, 6);
                    if (i >= 0) { x = (i % MAP_COLS) * TILE_SIZE + 16; y = Math.floor(i / MAP_COLS) * TILE_SIZE + 16; }
                }
                const minGap = (u.radius || 9) + 8;
                for (let k = 0; k < 10 && used.some(q => Math.hypot(q.x - x, q.y - y) < Math.max(minGap, q.gap)); k++) {
                    const a = k * 2.39996, rr = 12 + 6 * k;
                    const nx = x + Math.cos(a) * rr, ny = y + Math.sin(a) * rr;
                    if (this.navPassable(Math.floor(ny / TILE_SIZE) * MAP_COLS + Math.floor(nx / TILE_SIZE), u, big)) { x = nx; y = ny; }
                }
                used.push({ x, y, gap: minGap });
            }
            return { x, y };
        });
    },

    // ========================================================================
    // 7. SELECTION, RIGHT-CLICK ORDERS & EMBARK / DISEMBARK
    // ========================================================================
    finishBoxSelection(additive) {
        const p1 = this.screenToWorld(Math.min(this.dragStart.x, this.dragEnd.x), Math.min(this.dragStart.y, this.dragEnd.y));
        const p2 = this.screenToWorld(Math.max(this.dragStart.x, this.dragEnd.x), Math.max(this.dragStart.y, this.dragEnd.y));
        const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;

        const isClick = (Math.abs(this.dragEnd.x - this.dragStart.x) < 6 && Math.abs(this.dragEnd.y - this.dragStart.y) < 6);
        if (!additive) this.selectedIds.clear();

        if (isClick) {
            let clicked = null;
            for (const ent of this.entities) {
                // Update 3 fog fix: only things the player can currently see are clickable
                if (ent.faction !== 'player' && ent.category !== 'depot' && !this.isEntityVisible(ent)) continue;
                if (Math.hypot(ent.x - x1, ent.y - y1) <= ent.radius + 8) {
                    if (ent.faction === 'player' && (ent.category === 'unit' || ent.category === 'vehicle')) {
                        clicked = ent;
                        break;
                    }
                    if (!clicked || (ent.faction === 'player' && clicked.faction !== 'player')) {
                        clicked = ent;
                    }
                }
            }
            if (clicked) {
                const now = performance.now();
                const isDoubleClick = (now - this.lastClickTime < 340) && this.lastClickedEntType === `${clicked.category}_${clicked.type}`;
                this.lastClickTime = now;
                this.lastClickedEntType = `${clicked.category}_${clicked.type}`;

                const tc = Math.floor(clicked.x / TILE_SIZE);
                const tr = Math.floor(clicked.y / TILE_SIZE);
                if (clicked.faction === 'player' || (this.fog[tr] && this.fog[tr][tc] > 0)) {
                    if (isDoubleClick && clicked.faction === 'player') {
                        const z = this.cam.zoom || 1.0;
                        const viewW = this.canvas.width / z;
                        const viewH = this.canvas.height / z;
                        for (const ent of this.entities) {
                            if (ent.faction === 'player' && ent.category === clicked.category && ent.type === clicked.type) {
                                if (ent.x >= this.cam.x && ent.x <= this.cam.x + viewW && ent.y >= this.cam.y && ent.y <= this.cam.y + viewH) {
                                    this.selectedIds.add(ent.id);
                                }
                            }
                        }
                    } else if (additive && this.selectedIds.has(clicked.id)) {
                        this.selectedIds.delete(clicked.id);
                    } else {
                        this.selectedIds.add(clicked.id);
                    }
                    if (clicked.faction === 'player') sfx.playRadioAck('select');
                }
            }
        } else {
            let foundUnit = false;
            for (const ent of this.entities) {
                if (ent.faction === 'player' && (ent.category === 'unit' || ent.category === 'vehicle')) {
                    if (ent.x >= x1 && ent.x <= x2 && ent.y >= y1 && ent.y <= y2) {
                        this.selectedIds.add(ent.id);
                        foundUnit = true;
                    }
                }
            }
            if (!foundUnit) {
                for (const ent of this.entities) {
                    if (ent.faction === 'player' && ent.category === 'building') {
                        if (ent.x >= x1 && ent.x <= x2 && ent.y >= y1 && ent.y <= y2) {
                            this.selectedIds.add(ent.id);
                            foundUnit = true;
                        }
                    }
                }
            }
            if (foundUnit) sfx.playRadioAck('select');
        }

        this.updateSelectionUI();
    },

    issueRightClickOrder(wx, wy) {
        const selectedProdBlds = this.entities.filter(e =>
            this.selectedIds.has(e.id) &&
            e.faction === 'player' &&
            e.category === 'building' &&
            ['hq', 'barracks', 'battalionhq', 'motorpool'].includes(e.type)
        );
        if (selectedProdBlds.length > 0 && this.getSelectedMobileForces().length === 0) {
            selectedProdBlds.forEach(b => {
                b.rallyPoint = {
                    x: Math.max(136, Math.min(MAP_WIDTH - 136, wx)),
                    y: Math.max(72, Math.min(MAP_HEIGHT - 136, wy))
                };
            });
            this.pings.push({ x: wx, y: wy, color: '#3fb950', life: 0.6 });
            sfx.playRadioAck('confirm');
            this.showRadio(`RALLY POINT SET FOR ${selectedProdBlds.length} BUILDING(S).`);
            return;
        }

        const selectedArty = this.entities.filter(e =>
            this.selectedIds.has(e.id) && e.faction === 'player' && e.type === 'artillery'
        );
        if (selectedArty.length > 0 && this.getSelectedMobileForces().length === 0) {
            selectedArty.forEach(a => {
                a.bombardTarget = { x: wx, y: wy };
                a.bombardLoop = true;
            });
            this.pings.push({ x: wx, y: wy, color: '#ffa657', life: 0.7 });
            sfx.playRadioAck('confirm');
            this.showRadio('HOWITZER BATTERY LOCKED ON CONTINUOUS BARRAGE LOOP!');
            this.updateSelectionUI();
            return;
        }

        const mobile = this.getSelectedMobileForces();
        if (mobile.length === 0) return;

        let targetEnt = null;
        for (const ent of this.entities) {
            // Update 3 fog fix: unseen units can't be targeted; remembered (last-known) structures still can
            if (ent.faction !== 'player' && ent.category !== 'depot' && !this.isEntityVisible(ent) &&
                !(this.isMemoryEntity(ent) && this.knownStructures.has(ent.id))) continue;
            if (Math.hypot(ent.x - wx, ent.y - wy) <= ent.radius + 10) {
                targetEnt = ent;
                break;
            }
        }

        // 0. Update 5: aircraft selected + right-click a finished Airbase -> fly there, land and store
        if (targetEnt && targetEnt.faction === 'player' && targetEnt.type === 'airbase' && !targetEnt.underConstruction) {
            const aircraft = mobile.filter(u => u.canFly);
            if (aircraft.length > 0) {
                this.orderStoreAircraft(aircraft, targetEnt);
                return;
            }
        }

        // 0. Update 6: airborne transport helicopter(s) + right-click a friendly soldier -> fly over & winch them aboard
        if (targetEnt && targetEnt.faction === 'player' && targetEnt.category === 'unit' && !mobile.includes(targetEnt)) {
            const helis = mobile.filter(u => u.canFly && !u.supply && u.capacity > 0 && !PLANE_TYPES.has(u.type));
            if (helis.length > 0 && helis.length === mobile.length) {
                this.queueHoistPickup(helis, targetEnt);
                return;
            }
        }

        // 0a. Update 5: only supply vehicles selected + right-click a friendly -> resupply it (or transfer to a supply vehicle)
        if (targetEnt && mobile.length > 0 && mobile.every(u => u.supply) && targetEnt.faction === 'player' &&
            (targetEnt.category === 'unit' || targetEnt.category === 'vehicle') && !mobile.includes(targetEnt)) {
            const sv = mobile[0];
            if (targetEnt.supply) {
                this.startTransferTo(sv, targetEnt);
            } else {
                mobile.forEach(v => { v.state = 'resupply'; v.targetId = targetEnt.id; v.targetPos = null; v.holdPosition = false; });
                this.pings.push({ x: targetEnt.x, y: targetEnt.y, color: '#f2cc60', life: 0.6 });
                sfx.playRadioAck('confirm');
                this.showRadio(`📦 SUPPLY RUN TO ${targetEnt.name.toUpperCase()}.`);
            }
            return;
        }

        // 0b. Update 3: Medic selected + right-click an infected friendly -> cure them
        if (targetEnt && targetEnt.infected && this.isFriendlyHuman(targetEnt)) {
            const medics = mobile.filter(u => u.type === 'medic');
            if (medics.length > 0) {
                const m = this.assignTreatment(medics, targetEnt);
                if (m) {
                    sfx.playRadioAck('confirm');
                    this.showRadio(`✚ MEDIC MOVING TO TREAT ${targetEnt.name.toUpperCase()}.`);
                } else {
                    sfx.playRadioAck('alert');
                    this.showRadio('✚ SELECTED MEDICS HAVE NO TREATMENTS LEFT — WAIT FOR RECHARGE.');
                }
                return;
            }
        }

        // 1. Right-click friendly Vehicle -> Embark Infantry up to Capacity
        // (Update 4: abandoned civilian vehicles can be boarded too — the first soldier in becomes the driver)
        if (targetEnt && (targetEnt.faction === 'player' || targetEnt.abandoned) && targetEnt.category === 'vehicle') {
            const infantry = mobile.filter(u => u.category === 'unit' && u.id !== targetEnt.id);
            if (infantry.length > 0 && targetEnt.canFly && !targetEnt.landed && targetEnt.faction === 'player') {
                // Update 6: an airborne helicopter winches troops up by rope, one at a time
                this.orderHoistToHeli(infantry, targetEnt);
                return;
            }
            if (infantry.length > 0) {
                if (targetEnt.capacity === 0) {
                    this.showRadio(`${targetEnt.name.toUpperCase()} CARRIES 0 PASSENGERS (CREW ONLY).`);
                    sfx.playRadioAck('alert');
                    return;
                }
                const alreadyHeading = this.entities.filter(e =>
                    e.category === 'unit' && e.state === 'board' && e.targetId === targetEnt.id && !infantry.includes(e)
                ).length;
                const openSeats = Math.max(0, targetEnt.capacity - targetEnt.passengers.length - alreadyHeading);

                if (openSeats <= 0) {
                    this.showRadio(`${targetEnt.name.toUpperCase()} IS AT FULL CAPACITY (${targetEnt.passengers.length}/${targetEnt.capacity}).`);
                    sfx.playRadioAck('alert');
                    return;
                }

                const boardingTroops = infantry.slice(0, openSeats);
                boardingTroops.forEach(u => {
                    u.state = 'board';
                    u.holdPosition = false;
                    u.targetId = targetEnt.id;
                    u.targetPos = null;
                });

                this.pings.push({ x: targetEnt.x, y: targetEnt.y, color: '#58a6ff', life: 0.6 });
                sfx.playRadioAck('confirm');
                if (infantry.length > openSeats) {
                    this.showRadio(`${boardingTroops.length} TROOPS BOARDING ${targetEnt.name.toUpperCase()} (${infantry.length - openSeats} LEFT OUTSIDE — VEHICLE FULL).`);
                } else {
                    this.showRadio(`${boardingTroops.length} TROOPS MOVING TO BOARD ${targetEnt.name.toUpperCase()}.`);
                }
                return;
            }
        }

        // 1b. Right-click Locked Survivor Shelter -> Move to door & unlock it
        if (targetEnt && targetEnt.category === 'shelter') {
            if (targetEnt.opened) {
                this.showRadio('THIS SHELTER HAS ALREADY BEEN CLEARED.');
            } else {
                const ground = mobile.filter(u => !u.isAir);
                if (ground.length === 0) {
                    this.showRadio('AIRCRAFT CANNOT REACH THE SHELTER DOOR — SEND A GROUND UNIT.');
                    sfx.playRadioAck('alert');
                    return;
                }
                ground.sort((a, b) => Math.hypot(a.x - targetEnt.x, a.y - targetEnt.y) - Math.hypot(b.x - targetEnt.x, b.y - targetEnt.y));
                const breacher = ground[0];
                breacher.state = 'unlock';
                breacher.holdPosition = false;
                breacher.targetId = targetEnt.id;
                breacher.targetPos = null;
                const others = mobile.filter(u => u !== breacher);
                if (others.length > 0) {
                    const slots = this.computeFormationPositions(others, targetEnt.x, targetEnt.y + 40);
                    others.forEach((u, idx) => {
                        u.state = 'move';
                        u.holdPosition = false;
                        u.targetId = null;
                        u.targetPos = slots[idx];
                    });
                }
                this.pings.push({ x: targetEnt.x, y: targetEnt.y, color: '#56d4dd', life: 0.7 });
                sfx.playRadioAck('confirm');
                this.showRadio(`${breacher.name.toUpperCase()} MOVING TO BREACH THE LOCKED SHELTER DOOR.`);
                return;
            }
        }

        // 2. Right-click Hostile (Zombie, Hive, Mercenary or Bandit Structure) -> Attack Target
        if (targetEnt && this.areHostile('player', targetEnt.faction)) {
            mobile.forEach(u => {
                u.state = 'attack';
                u.holdPosition = false;
                u.targetId = targetEnt.id;
                u.targetPos = null;
            });
            this.pings.push({ x: targetEnt.x, y: targetEnt.y, color: '#f85149', life: 0.6 });
            sfx.playRadioAck('confirm');
            return;
        }

        // 3. Right-click Supply Crate -> Scavenge
        if (targetEnt && targetEnt.category === 'crate') {
            mobile.forEach(u => {
                u.state = 'scavenge';
                u.holdPosition = false;
                u.targetId = targetEnt.id;
                u.targetPos = null;
            });
            this.pings.push({ x: targetEnt.x, y: targetEnt.y, color: '#f2cc60', life: 0.6 });
            sfx.playRadioAck('confirm');
            return;
        }

        // 4. Right-click Unclaimed Supply Depot with Engineer -> Auto-Claim Collector
        if (targetEnt && targetEnt.category === 'depot' && !targetEnt.claimedBy) {
            const eng = mobile.find(u => u.type === 'engineer');
            if (eng) {
                const def = BUILDING_DEFS.collector;
                if (this.scrap >= def.scrap) {
                    this.scrap -= def.scrap;
                    const col = this.createBuilding('collector', targetEnt.x, targetEnt.y, true);
                    this.startConstruction(col);
                    col.depotId = targetEnt.id;
                    col.scrapRate = targetEnt.scrapRate;
                    col.fuelRate = targetEnt.fuelRate;
                    targetEnt.claimedBy = col.id;
                    sfx.playRadioAck('build');
                    this.showRadio(`DEPOT CLAIMED — RESOURCE COLLECTOR UNDER CONSTRUCTION (${def.buildTime}s): +${col.scrapRate} SCRAP, +${col.fuelRate} FUEL.`);
                    this.updateSelectionUI();
                    return;
                } else {
                    this.showRadio(`NEED ${def.scrap} SCRAP TO BUILD RESOURCE COLLECTOR.`);
                    sfx.playRadioAck('alert');
                }
            }
        }

        // 5. Right-click Damaged Friendly Building or Vehicle with Engineer -> Repair
        if (targetEnt && targetEnt.faction === 'player' && (targetEnt.category === 'building' || targetEnt.category === 'vehicle') &&
            targetEnt.hp < targetEnt.maxHp && !targetEnt.underConstruction) {
            const engineers = mobile.filter(u => u.type === 'engineer' || u.type === 'mechanic');
            if (engineers.length > 0) {
                engineers.forEach(e => {
                    e.state = 'repair';
                    e.holdPosition = false;
                    e.targetId = targetEnt.id;
                    e.targetPos = null;
                });
                this.pings.push({ x: targetEnt.x, y: targetEnt.y, color: '#3fb950', life: 0.6 });
                sfx.playRadioAck('confirm');
                this.showRadio(`${engineers.some(e => e.type === 'mechanic') ? 'MECHANIC' : 'ENGINEER'} REPAIRING ${targetEnt.name.toUpperCase()}.`);
                return;
            }
        }

        // Update 5: landed helicopters must take off before they can move
        const landedHelis = mobile.filter(u => u.landed);
        if (landedHelis.length > 0) {
            this.showRadio(`${landedHelis.length} HELICOPTER(S) ON THE GROUND — TAKE OFF [O] TO MOVE.`);
            sfx.playRadioAck('alert');
        }

        // 6. Standard Tactical Formation Move Order
        const slots = this.computeFormationPositions(mobile, wx, wy);
        mobile.forEach((u, idx) => {
            u.state = 'move';
            u.holdPosition = false;
            u.targetId = null;
            u.targetPos = slots[idx];
        });
        this.pings.push({ x: wx, y: wy, color: '#3fb950', life: 0.55 });
        if (mobile.some(u => u.category === 'vehicle' && !u.canFly)) sfx.playEngine();
        sfx.playRadioAck('confirm');
    },

    unloadVehiclePassengers(veh) {
        if (!veh.passengers || veh.passengers.length === 0) return;
        // Update 5: airborne helicopters fast-rope troops down one at a time
        if (veh.canFly && !veh.landed) {
            veh.rappelAll = true;
            veh.rappelCooldown = 0;
            this.showRadio(`🪢 ${veh.name.toUpperCase()} FAST-ROPING ${veh.passengers.length} TROOPS — ONE AT A TIME.`);
            return;
        }
        const count = veh.passengers.length;
        veh.passengers.forEach((p, idx) => {
            const ang = (idx / count) * Math.PI * 2;
            p.x = Math.max(136, Math.min(MAP_WIDTH - 136, veh.x + Math.cos(ang) * (veh.radius + 18)));
            p.y = Math.max(72, Math.min(MAP_HEIGHT - 136, veh.y + Math.sin(ang) * (veh.radius + 18)));
            p.state = 'idle';
            p.targetId = null;
            p.targetPos = null;
            p._removed = false;
            this.entities.push(p);
        });
        veh.passengers = [];
        sfx.playRadioAck('confirm');
        this.showRadio(`${veh.name.toUpperCase()} DISEMBARKED ${count} TROOPS.`);
        this.checkAbandonVehicle(veh);
        this.recalcPopulation();
        this.updateSelectionUI();
    },

    // Update 4: a civilian vehicle left with nobody inside is abandoned again (neutral, can't be driven)
    checkAbandonVehicle(veh) {
        if (!veh || !veh.civilian || veh.passengers.length > 0 || veh.abandoned) return;
        veh.abandoned = true;
        veh.faction = 'neutral';
        veh.state = 'idle';
        veh.targetPos = null;
        veh.targetId = null;
        veh.name = veh.name.replace('Commandeered ', 'Abandoned ');
        this.selectedIds.delete(veh.id);
    },

    unloadSinglePassenger(veh, paxIndex) {
        if (!veh.passengers || paxIndex < 0 || paxIndex >= veh.passengers.length) return;
        if (veh.canFly && !veh.landed) { this.rappelPassenger(veh, paxIndex); return; }
        const [p] = veh.passengers.splice(paxIndex, 1);
        const ang = Math.random() * Math.PI * 2;
        p.x = Math.max(136, Math.min(MAP_WIDTH - 136, veh.x + Math.cos(ang) * (veh.radius + 18)));
        p.y = Math.max(72, Math.min(MAP_HEIGHT - 136, veh.y + Math.sin(ang) * (veh.radius + 18)));
        p.state = 'idle';
        p.targetId = null;
        p.targetPos = null;
        p._removed = false;
        this.entities.push(p);
        sfx.playRadioAck('confirm');
        this.checkAbandonVehicle(veh);
        this.recalcPopulation();
        this.updateSelectionUI();
    },

    commandStop() {
        const mobile = this.getSelectedMobileForces();
        mobile.forEach(u => {
            if (u.pickupQueue) u.pickupQueue = [];
            u.state = 'idle';
            u.holdPosition = false;
            u.targetPos = null;
            u.targetId = null;
        });
        sfx.playRadioAck('select');
    },

    commandHold() {
        const mobile = this.getSelectedMobileForces();
        mobile.forEach(u => {
            u.state = 'idle';
            u.holdPosition = true;
            u.targetPos = null;
            u.targetId = null;
        });
        sfx.playRadioAck('select');
        this.showRadio('SQUAD HOLDING STREET POSITION.');
    },

    executeTargetingClick(wx, wy) {
        if (this.targetingMode === 'pickup') {
            let unit = null, best = Infinity;
            for (const e of this.entities) {
                if (e.faction !== 'player' || e.category !== 'unit') continue;
                const d = Math.hypot(e.x - wx, e.y - wy);
                if (d <= e.radius + 14 && d < best) { best = d; unit = e; }
            }
            const helis = this.getSelectedMobileForces().filter(u => u.canFly && u.capacity > 0 && !PLANE_TYPES.has(u.type));
            if (!unit) {
                sfx.playRadioAck('alert');
                this.showRadio('🪢 CLICK A FRIENDLY SOLDIER FOR THE HELICOPTER TO WINCH UP.');
                return;
            }
            if (helis.length) this.queueHoistPickup(helis, unit);
            this.targetingMode = null;
            this.updateCommandGrid();
            return;
        }
        if (this.targetingMode === 'missile') {
            const readySilo = this.entities.find(e => e.category === 'building' && e.type === 'silo' && !e.underConstruction && e.missileCooldown <= 0);
            if (!readySilo) {
                this.showRadio('NO MISSILE SILO READY.');
                this.targetingMode = null;
                this.updateCommandGrid();
                return;
            }
            if (this.fuel < MISSILE_LAUNCH_FUEL) {
                sfx.playRadioAck('alert');
                this.showRadio(`INSUFFICIENT FUEL — EACH CRUISE MISSILE LAUNCH NEEDS ${MISSILE_LAUNCH_FUEL} FUEL.`);
                this.targetingMode = null;
                this.updateCommandGrid();
                return;
            }
            this.fuel -= MISSILE_LAUNCH_FUEL;
            readySilo.missileCooldown = readySilo.missileMaxCooldown;
            this.missiles.push({
                startX: readySilo.x,
                startY: readySilo.y,
                targetX: wx,
                targetY: wy,
                progress: 0,
                duration: 2.3
            });
            // BUGFIX (Update 2): this ping lives 2.3s (longer than the 1s the ping ring formula assumed).
            // maxLife lets the renderer normalize its expansion so the ring radius never goes negative.
            this.pings.push({ x: wx, y: wy, color: '#f85149', life: 2.3, maxLife: 2.3 });
            sfx.playMissileLaunch();
            this.showRadio('TACTICAL CRUISE MISSILE LAUNCHED — IMPACT IN 2.3 SECONDS!');
            this.targetingMode = null;
            this.updateSelectionUI();
        } else if (this.targetingMode === 'transfer') {
            const from = this.entities.find(e => this.selectedIds.has(e.id) && e.faction === 'player' && e.supply);
            let to = null;
            for (const e of this.entities) {
                if (e !== from && e.faction === 'player' && e.supply && Math.hypot(e.x - wx, e.y - wy) <= e.radius + 14) { to = e; break; }
            }
            this.targetingMode = null;
            this.updateCommandGrid();
            if (!from || !to) {
                sfx.playRadioAck('alert');
                this.showRadio('🔁 NO OTHER FRIENDLY SUPPLY VEHICLE THERE.');
                return;
            }
            this.startTransferTo(from, to);
        } else if (this.targetingMode === 'repair') {
            const mechanics = this.entities.filter(e => this.selectedIds.has(e.id) && e.faction === 'player' && e.type === 'mechanic');
            let target = null;
            for (const e of this.entities) {
                if (this.isRepairable(e) && Math.hypot(e.x - wx, e.y - wy) <= e.radius + 14) { target = e; break; }
            }
            if (!target) {
                sfx.playRadioAck('alert');
                this.showRadio('🔧 NO DAMAGED FRIENDLY BUILDING OR VEHICLE THERE (RIGHT-CLICK TO CANCEL).');
                return;
            }
            const m = this.assignRepair(mechanics, target);
            if (m) {
                sfx.playRadioAck('confirm');
                this.showRadio(`🔧 MECHANIC MOVING TO REPAIR ${target.name.toUpperCase()}.`);
            }
            this.targetingMode = null;
            this.updateSelectionUI();
        } else if (this.targetingMode === 'treat') {
            const medics = this.entities.filter(e => this.selectedIds.has(e.id) && e.faction === 'player' && e.type === 'medic');
            let patient = null;
            for (const e of this.entities) {
                if (this.isFriendlyHuman(e) && e.infected && Math.hypot(e.x - wx, e.y - wy) <= e.radius + 16) { patient = e; break; }
            }
            if (!patient) {
                sfx.playRadioAck('alert');
                this.showRadio('✚ NO INFECTED FRIENDLY THERE — CLICK A UNIT MARKED ☣ (RIGHT-CLICK TO CANCEL).');
                return;
            }
            const m = this.assignTreatment(medics, patient);
            if (m) {
                sfx.playRadioAck('confirm');
                this.showRadio(`✚ MEDIC MOVING TO TREAT ${patient.name.toUpperCase()}.`);
            } else {
                sfx.playRadioAck('alert');
                this.showRadio('✚ SELECTED MEDICS HAVE NO TREATMENTS LEFT — WAIT FOR RECHARGE.');
            }
            this.targetingMode = null;
            this.updateSelectionUI();
        } else if (this.targetingMode === 'artillery_loop' || this.targetingMode === 'artillery_once') {
            const loop = this.targetingMode === 'artillery_loop';
            const arties = this.entities.filter(e => this.selectedIds.has(e.id) && e.type === 'artillery');
            arties.forEach(a => {
                a.bombardTarget = { x: wx, y: wy };
                a.bombardLoop = loop;
            });
            this.pings.push({ x: wx, y: wy, color: '#ffa657', life: 0.9 });
            sfx.playRadioAck('confirm');
            this.showRadio(loop ? 'HOWITZER CONTINUOUS LOOP BARRAGE ENGAGED!' : 'HOWITZER SINGLE SALVO ORDERED!');
            this.targetingMode = null;
            this.updateSelectionUI();
        }
    },

    callMechanicsForSelected() {
        const targets = this.entities.filter(e => this.selectedIds.has(e.id) && this.isRepairable(e));
        const mechanics = this.entities.filter(e => e.faction === 'player' && e.type === 'mechanic');
        let sent = 0;
        targets.forEach(t => {
            if (mechanics.some(m => m.state === 'repair' && m.targetId === t.id)) { sent++; return; }
            if (this.assignRepair(mechanics, t)) sent++;
        });
        if (sent > 0) {
            sfx.playRadioAck('confirm');
            this.showRadio(`🔧 ${sent} REPAIR JOB(S) ASSIGNED TO COMBAT MECHANICS.`);
        } else {
            sfx.playRadioAck('alert');
            this.showRadio('NO COMBAT MECHANIC AVAILABLE — TRAIN ONE AT THE BARRACKS [R].');
        }
    },

    callMedicsForSelected() {
        const patients = this.entities.filter(e => this.selectedIds.has(e.id) && this.isFriendlyHuman(e) && e.infected);
        const medics = this.entities.filter(e => e.faction === 'player' && e.type === 'medic');
        let sent = 0;
        patients.forEach(pt => {
            if (medics.some(m => m.state === 'treat' && m.targetId === pt.id)) { sent++; return; }
            if (this.assignTreatment(medics, pt)) sent++;
        });
        if (sent > 0) {
            sfx.playRadioAck('confirm');
            this.showRadio(`✚ ${sent} MEDIC TREATMENT(S) DISPATCHED TO INFECTED PERSONNEL.`);
        } else {
            sfx.playRadioAck('alert');
            this.showRadio('NO COMBAT MEDIC WITH TREATMENTS AVAILABLE — TRAIN ONE AT THE BARRACKS [M].');
        }
        this.updateSelectionUI();
    },

    commandReturnToHQ(units) {
        const hq = this.entities.find(e => e.faction === 'player' && e.type === 'hq');
        if (!hq || units.length === 0) return;
        units.forEach((u, i) => {
            u.state = 'returnhq';
            u.holdPosition = false;
            u.targetId = hq.id;
            const ang = (i / Math.max(1, units.length)) * Math.PI * 2;
            u.targetPos = { x: hq.x + Math.cos(ang) * 20, y: hq.y + hq.radius + 10 + Math.sin(ang) * 10 };
        });
        this.pings.push({ x: hq.x, y: hq.y, color: '#56d4dd', life: 0.7 });
        sfx.playRadioAck('confirm');
        this.showRadio(`🏠 ${units.length} SURVIVOR(S) HEADING INTO HQ.`);
    }
});
