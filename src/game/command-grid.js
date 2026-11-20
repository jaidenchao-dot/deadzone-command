'use strict';
// The 12-button command grid for every selection type (hotkeys live here)
defineGameMethods({
    updateCommandGrid() {
        const grid = document.getElementById('command-grid');
        grid.innerHTML = '';
        const slots = new Array(12).fill(null);

        const selected = this.entities.filter(e => this.selectedIds.has(e.id));
        const hasMobile = selected.some(e => e.faction === 'player' && (e.category === 'unit' || e.category === 'vehicle'));
        const hasEngineer = selected.some(e => e.faction === 'player' && e.type === 'engineer');
        const loadedVehicles = selected.filter(e => e.faction === 'player' && e.category === 'vehicle' && e.passengers.length > 0);
        const selectedPlayerBlds = selected.filter(e => e.faction === 'player' && e.category === 'building');
        // Update 4: buildings still under construction offer no commands except cancelling (dismantle)
        const allSameBldType = selectedPlayerBlds.length > 0 && selectedPlayerBlds.every(b => b.type === selectedPlayerBlds[0].type && !b.underConstruction);
        const sharedBldType = allSameBldType ? selectedPlayerBlds[0].type : null;
        const singleBld = selectedPlayerBlds.length === 1 ? selectedPlayerBlds[0] : null;
        const hasArmory = this.hasCompletedBuilding('armory');
        const hasBarracks = this.hasCompletedBuilding('barracks');

        if (hasMobile) {
            slots[0] = { icon: '🛑', label: 'STOP', hotkey: 'X', title: 'Stop Order', cost: 'Hotkey: X', desc: 'Halt movement and cancel current target.', action: () => this.commandStop() };
            slots[1] = { icon: '🛡️', label: 'HOLD', hotkey: 'H', title: 'Hold Position', cost: 'Hotkey: H', desc: 'Hold street/block position and fire at enemies in range without chasing.', action: () => this.commandHold() };
        }

        if (loadedVehicles.length > 0) {
            const flyingLoaded = loadedVehicles.some(v => v.canFly && !v.landed);
            slots[2] = {
                icon: flyingLoaded ? '🪢' : '🚪', label: flyingLoaded ? 'RAPPEL ALL' : 'UNLOAD', hotkey: 'U',
                title: flyingLoaded ? 'Fast-Rope Troops (one at a time)' : 'Disembark All Passengers', cost: 'Hotkey: U',
                desc: flyingLoaded
                    ? 'Airborne helicopters stay in the air and drop troops one at a time by rope. Click a passenger chip to choose who goes next.'
                    : 'Unload all embarked infantry around the vehicle.',
                action: () => loadedVehicles.forEach(v => this.unloadVehiclePassengers(v))
            };
        }

        // Update 5: helicopter LAND / TAKE OFF
        const selHelis = selected.filter(e => e.faction === 'player' && e.canFly && HELI_TYPES.has(e.type));
        if (selHelis.length > 0) {
            const allLanded = selHelis.every(h => h.landed);
            slots[8] = {
                icon: allLanded ? '🛫' : '🛬', label: allLanded ? 'TAKE OFF' : 'LAND', hotkey: 'O',
                title: allLanded ? 'Take Off' : 'Land Helicopter',
                cost: allLanded ? 'Lift off (fuel use resumes)' : 'Needs clear open ground below',
                desc: allLanded
                    ? 'Spin up and climb back to flight altitude. Landed helicopters cannot move until they take off.'
                    : 'Set down on open ground. While landed: no fuel use, troops can board/exit, but it can be hit by melee zombies. Planes cannot land here — they must use an Airbase runway.',
                action: () => {
                    selHelis.forEach(h => allLanded ? this.startTakeoff(h) : this.startLanding(h));
                    this.updateCommandGrid();
                }
            };
        }

        // Update 3: Survivor, Medic & infection actions (build slots take priority when an engineer is selected)
        if (!hasEngineer) {
            const selSurvivors = selected.filter(e => e.faction === 'player' && e.category === 'unit' && e.isSurvivor);
            const selMedics = selected.filter(e => e.faction === 'player' && e.type === 'medic');
            const selInfected = selected.filter(e => this.isFriendlyHuman(e) && e.infected);

            if (selSurvivors.length > 0) {
                const hq = this.entities.find(e => e.faction === 'player' && e.type === 'hq');
                const inRange = hq ? selSurvivors.filter(u => Math.hypot(u.x - hq.x, u.y - hq.y) <= SURVIVOR_RETURN_RANGE) : [];
                const nearest = hq ? Math.min(...selSurvivors.map(u => Math.hypot(u.x - hq.x, u.y - hq.y))) : Infinity;
                slots[3] = {
                    icon: '🏠',
                    label: inRange.length > 0 ? 'RETURN TO HQ' : 'TOO FAR',
                    hotkey: 'R',
                    title: 'Return to HQ' + (inRange.length > 0 ? '' : ' [OUT OF RANGE]'),
                    cost: !hq ? 'HQ destroyed' : (inRange.length > 0
                        ? `${inRange.length}/${selSurvivors.length} survivor(s) within HQ range`
                        : `Too far from HQ — move ${Math.ceil((nearest - SURVIVOR_RETURN_RANGE) / TILE_SIZE)} more blocks closer`),
                    desc: `Send selected rescued survivors inside the HQ to join your base (they leave the field and grant their rescue bonus). Only available within ${Math.round(SURVIVOR_RETURN_RANGE / TILE_SIZE)} tiles of the HQ (cyan ring).`,
                    disabled: inRange.length === 0,
                    action: () => this.commandReturnToHQ(inRange)
                };
            }

            if (selMedics.length > 0) {
                const ready = selMedics.filter(m => m.treatCharges > 0);
                const charges = selMedics.reduce((sum, m) => sum + (m.treatCharges || 0), 0);
                const maxCharges = selMedics.reduce((sum, m) => sum + (m.treatMax || 0), 0);
                const minCd = Math.min(...selMedics.map(m => m.treatCharges > 0 ? Infinity : m.treatCooldown));
                slots[4] = {
                    icon: '✚',
                    label: ready.length > 0 ? `TREAT ${charges}/${maxCharges}` : `RECHARGE ${Math.ceil(minCd)}s`,
                    hotkey: 'T',
                    title: 'Anti-Viral Treatment',
                    cost: ready.length > 0 ? `${charges}/${maxCharges} treatments left` : `All treatments spent — recharging (${Math.ceil(minCd)}s)`,
                    desc: 'Click an infected (☣) friendly soldier or survivor to send the medic to cure them before they turn. Each medic carries 6 treatments, then needs 40s to recharge. (Or right-click the infected unit.)',
                    active: this.targetingMode === 'treat',
                    disabled: ready.length === 0,
                    action: () => {
                        this.targetingMode = (this.targetingMode === 'treat') ? null : 'treat';
                        if (this.targetingMode) this.showRadio('✚ CLICK AN INFECTED (☣) FRIENDLY UNIT TO TREAT.');
                        this.updateCommandGrid();
                    }
                };
            }

            if (selInfected.length > 0) {
                const anyMedic = this.entities.some(e => e.faction === 'player' && e.type === 'medic' && e.treatCharges > 0);
                slots[5] = {
                    icon: '☣',
                    label: 'CALL MEDIC',
                    hotkey: 'C',
                    title: 'Call Medic for Infected Units',
                    cost: anyMedic ? `${selInfected.length} infected selected` : 'No medic with treatments available',
                    desc: 'Dispatch the nearest Combat Medic with treatments left to cure each selected infected unit before it turns.',
                    disabled: !anyMedic,
                    action: () => this.callMedicsForSelected()
                };
            }

            // Update 4: Combat Mechanic repair order
            const selMechanics = selected.filter(e => e.faction === 'player' && e.type === 'mechanic');
            if (selMechanics.length > 0) {
                slots[6] = {
                    icon: '🔧', label: 'REPAIR', hotkey: 'Y',
                    title: 'Repair Building / Vehicle',
                    cost: `Buildings ${UNIT_DEFS.mechanic.repairBuilding} HP/s · Vehicles ${UNIT_DEFS.mechanic.repairVehicle} HP/s`,
                    desc: 'Click a damaged friendly building or vehicle — the mechanic moves to it and restores its health over time. (Or right-click the damaged target.)',
                    active: this.targetingMode === 'repair',
                    action: () => {
                        this.targetingMode = (this.targetingMode === 'repair') ? null : 'repair';
                        if (this.targetingMode) this.showRadio('🔧 CLICK A DAMAGED FRIENDLY BUILDING OR VEHICLE TO REPAIR.');
                        this.updateCommandGrid();
                    }
                };
            }

            // Update 5: supply vehicle commands
            const selSupply = selected.filter(e => e.faction === 'player' && e.supply);
            if (selSupply.length > 0) {
                const hq = this.getHqEntity();
                const atHq = hq ? selSupply.filter(v => Math.hypot(v.x - hq.x, v.y - hq.y) <= HQ_REFILL_RANGE) : [];
                slots[9] = {
                    icon: '📦', label: 'RESUPPLY', hotkey: 'E',
                    title: 'Resupply Nearby Units',
                    cost: `Radius ${Math.round(SUPPLY_ORDER_RADIUS / TILE_SIZE)} tiles · ammo, rations & fuel`,
                    desc: 'Immediately hand out ammunition (only types each unit uses), rations and vehicle fuel to every friendly unit & vehicle nearby. Supply vehicles also auto-resupply units right next to them. Right-click a friendly unit to drive over and resupply it.',
                    action: () => selSupply.forEach(v => this.supplyPulse(v, SUPPLY_ORDER_RADIUS, true))
                };
                slots[10] = {
                    icon: '🔁', label: 'TRANSFER', hotkey: 'F',
                    title: 'Transfer Supplies to Another Supply Vehicle',
                    cost: 'Choose types & quantities',
                    desc: 'Click another friendly supply vehicle (or right-click it). This vehicle drives over and opens the transfer screen where you pick which supplies and how many to move.',
                    active: this.targetingMode === 'transfer',
                    action: () => {
                        this.targetingMode = (this.targetingMode === 'transfer') ? null : 'transfer';
                        if (this.targetingMode) this.showRadio('🔁 CLICK THE SUPPLY VEHICLE THAT SHOULD RECEIVE SUPPLIES.');
                        this.updateCommandGrid();
                    }
                };
                slots[11] = {
                    icon: '🏭', label: atHq.length ? 'REFILL AT HQ' : 'REFILL (GO TO HQ)', hotkey: 'Q',
                    title: 'Refill at Command Center',
                    cost: atHq.length ? 'Costs Scrap & Fuel per item (missiles/rockets/bombs cost most)' : `Park within ${Math.round(HQ_REFILL_RANGE / TILE_SIZE)} tiles of the Command Center`,
                    desc: 'Restock this supply vehicle to its standard loadout at the Command Center, paying Scrap & Fuel for each item added. Rations & fuel first, heavy munitions last; refills partially if resources run short.',
                    disabled: atHq.length === 0,
                    action: () => atHq.forEach(v => this.refillSupplyVehicle(v))
                };
            }

            // Update 4: damaged vehicles selected -> call a mechanic to them
            const selDamagedVeh = selected.filter(e => this.isRepairable(e) && e.category === 'vehicle');
            if (selDamagedVeh.length > 0) {
                const anyMech = this.entities.some(e => e.faction === 'player' && e.type === 'mechanic');
                slots[7] = {
                    icon: '🛠️', label: 'CALL MECHANIC', hotkey: 'I',
                    title: 'Call Mechanic to Damaged Vehicles',
                    cost: anyMech ? `${selDamagedVeh.length} damaged vehicle(s) selected` : 'No Combat Mechanic available',
                    desc: 'Send the nearest Combat Mechanic to repair each selected damaged vehicle.',
                    disabled: !anyMech,
                    action: () => this.callMechanicsForSelected()
                };
            }
        }

        // Update 6: rope pickup by airborne helicopters (player picks the soldier)
        const pickupHelis = selected.filter(e => e.faction === 'player' && e.canFly && HELI_TYPES.has(e.type) && e.capacity > 0 && !e.landed);
        if (pickupHelis.length > 0 && pickupHelis.length === selected.length) {
            const freeSlot = [3, 4, 5, 6, 7, 9, 10, 11].find(i => !slots[i]);
            const seats = pickupHelis.reduce((a, h) => a + this.heliSeatsFree(h), 0);
            if (freeSlot !== undefined) slots[freeSlot] = {
                icon: '🪢', label: 'ROPE PICKUP', hotkey: 'K',
                title: 'Winch Up a Soldier (helicopter stays airborne)',
                cost: `${seats} free seat(s) · one soldier at a time`,
                desc: 'Click a friendly soldier: the helicopter flies over, hovers and winches them aboard by rope. Queue several clicks to pick up more, one at a time. You can also right-click a soldier with the helicopter selected, or right-click the hovering helicopter with troops selected.',
                active: this.targetingMode === 'pickup',
                disabled: seats <= 0,
                action: () => {
                    this.buildPlacementType = null;
                    this.targetingMode = (this.targetingMode === 'pickup') ? null : 'pickup';
                    if (this.targetingMode) this.showRadio('🪢 CLICK A FRIENDLY SOLDIER TO WINCH UP.');
                    this.updateCommandGrid();
                }
            };
        }

        if (hasEngineer) {
            const bldTypes = ['collector', 'barracks', 'battalionhq', 'motorpool', 'armory', 'artillery', 'silo', 'turret', 'wall', 'gate'];
            const slotOrder = [4, 5, 6, 7, 8, 9, 10, 11, 2, 3];
            bldTypes.forEach((bType, idx) => {
                const def = BUILDING_DEFS[bType];
                const locked = (def.requiresArmory && !hasArmory) || (def.requiresBarracks && !hasBarracks);
                const icons = {
                    collector: '⛽', barracks: '🏕️', battalionhq: '🎖️', motorpool: '🚜', armory: '🔬',
                    artillery: '💣', silo: '🚀', turret: '🔫', wall: '🧱', gate: '🚧'
                };
                const labels = {
                    collector: 'COLLECTOR', barracks: 'BARRACKS', battalionhq: 'BATTALION HQ', motorpool: 'MOTORPOOL', armory: 'ARMORY',
                    artillery: 'ARTILLERY', silo: 'MISSILE SILO', turret: 'TURRET', wall: 'WALL (DRAG)', gate: 'GATE [R]'
                };
                slots[slotOrder[idx]] = {
                    icon: icons[bType],
                    label: labels[bType],
                    hotkey: def.hotkey,
                    title: `Build ${def.name}` + (locked ? ' [LOCKED]' : ''),
                    cost: `${def.scrap} Scrap` + (def.fuel ? `, ${def.fuel} Fuel` : ''),
                    desc: locked ? (def.requiresBarracks ? 'Build Infantry Barracks [B] first.' : 'Build Armory & Tech Lab [Y] first.') : def.desc,
                    active: this.buildPlacementType === bType,
                    disabled: locked || this.scrap < def.scrap || this.fuel < def.fuel,
                    action: () => {
                        this.targetingMode = null;
                        this.buildPlacementType = (this.buildPlacementType === bType) ? null : bType;
                        this.updateRotateButtonUI();
                        this.updateCommandGrid();
                    }
                };
            });
        } else if (sharedBldType) {
            const countBadge = selectedPlayerBlds.length > 1 ? ` (x${selectedPlayerBlds.length})` : '';

            if (sharedBldType === 'hq') {
                // Update 5: Airbase construction & supply-vehicle refilling from the Command Center
                const abDef = BUILDING_DEFS.airbase;
                slots[1] = {
                    icon: '🛫', label: 'AIRBASE', hotkey: 'P',
                    title: `Build ${abDef.name}`,
                    cost: `${abDef.scrap} Scrap, ${abDef.fuel} Fuel · ${abDef.buildTime}s`,
                    desc: abDef.desc + ' Click a clear 4x4 area to place it.',
                    active: this.buildPlacementType === 'airbase',
                    disabled: this.scrap < abDef.scrap || this.fuel < abDef.fuel,
                    action: () => {
                        this.targetingMode = null;
                        this.buildPlacementType = (this.buildPlacementType === 'airbase') ? null : 'airbase';
                        this.updateRotateButtonUI();
                        this.updateCommandGrid();
                    }
                };
                const nearSup = this.entities.filter(e => e.faction === 'player' && e.supply && Math.hypot(e.x - selectedPlayerBlds[0].x, e.y - selectedPlayerBlds[0].y) <= HQ_REFILL_RANGE).length;
                slots[2] = {
                    icon: '🏭', label: 'REFILL SUPPLY', hotkey: 'Q',
                    title: 'Refill Supply Vehicles',
                    cost: nearSup ? `${nearSup} supply vehicle(s) parked here` : 'No supply vehicles parked at HQ',
                    desc: `Restock every supply vehicle within ${Math.round(HQ_REFILL_RANGE / TILE_SIZE)} tiles of the Command Center. Costs Scrap & Fuel per item: bullets are cheap, rockets/missiles/bombs are expensive.`,
                    disabled: nearSup === 0,
                    action: () => this.refillAllSupplyNearHQ()
                };
                // Update 6: Medic Tent placement (field hospital)
                const mtDef = BUILDING_DEFS.medictent;
                slots[4] = {
                    icon: '⛺', label: 'MEDIC TENT', hotkey: mtDef.hotkey,
                    title: `Build ${mtDef.name}`,
                    cost: `${mtDef.scrap} Scrap, ${mtDef.fuel} Fuel · ${mtDef.buildTime}s`,
                    desc: mtDef.desc + ' Click a clear 2x2 area to place it.',
                    active: this.buildPlacementType === 'medictent',
                    disabled: this.scrap < mtDef.scrap || this.fuel < mtDef.fuel,
                    action: () => {
                        this.targetingMode = null;
                        this.buildPlacementType = (this.buildPlacementType === 'medictent') ? null : 'medictent';
                        this.updateRotateButtonUI();
                        this.updateCommandGrid();
                    }
                };
                const def = UNIT_DEFS.engineer;
                slots[0] = {
                    icon: '👷', label: 'ENGINEER', hotkey: def.hotkey,
                    title: `Train ${def.name}${countBadge}`, cost: `${def.scrap} Scrap | ${def.pop} Pop`,
                    desc: def.desc,
                    disabled: this.scrap < def.scrap || this.popUsed + def.pop > this.popMax,
                    action: () => this.queueAcrossSelectedBuildings(selectedPlayerBlds, 'engineer', 'unit')
                };

                const silos = this.entities.filter(e => e.category === 'building' && e.type === 'silo' && !e.underConstruction);
                if (silos.length > 0) {
                    const readySilo = silos.find(s => s.missileCooldown <= 0);
                    slots[3] = {
                        icon: '🚀', label: readySilo ? 'MISSILE STRIKE' : 'SILO RELOAD', hotkey: 'L',
                        title: 'Launch Tactical Cruise Missile',
                        cost: readySilo ? `Warhead Armed — ${MISSILE_LAUNCH_FUEL} Fuel per launch` : `Reloading (${Math.ceil(silos[0].missileCooldown)}s)`,
                        desc: `Click target coordinates anywhere in ${(this.mapDef || MAP_DEFS.manhattan).cityLong} for a supersonic Tactical Cruise Missile strike.`,
                        active: this.targetingMode === 'missile',
                        disabled: !readySilo || this.fuel < MISSILE_LAUNCH_FUEL,
                        action: () => {
                            this.targetingMode = (this.targetingMode === 'missile') ? null : 'missile';
                            this.showRadio('CLICK ANY LOCATION ON MAP OR MINIMAP FOR CRUISE MISSILE STRIKE.');
                            this.updateCommandGrid();
                        }
                    };
                }
            } else if (sharedBldType === 'battalionhq') {
                const batKeys = ['platoon_rifle', 'platoon_breacher', 'platoon_recon', 'platoon_company'];
                const batIcons = { platoon_rifle: '🪖', platoon_breacher: '🛡️', platoon_recon: '🎯', platoon_company: '⭐' };
                batKeys.forEach((bKey, idx) => {
                    const def = BATTALION_DEFS[bKey];
                    const locked = def.requiresArmory && !hasArmory;
                    slots[idx] = {
                        icon: batIcons[bKey],
                        label: def.shortLabel,
                        hotkey: def.hotkey,
                        title: `Deploy ${def.name}${countBadge}` + (locked ? ' [LOCKED]' : ''),
                        cost: `${def.scrap} Scrap, ${def.fuel} Fuel | ${def.pop} Pop`,
                        desc: locked ? 'Requires Armory & Tech Lab [Y]. ' + def.desc : def.desc,
                        disabled: locked || this.scrap < def.scrap || this.fuel < def.fuel || this.popUsed + def.pop > this.popMax,
                        action: () => this.queueAcrossSelectedBuildings(selectedPlayerBlds, bKey, 'battalion')
                    };
                });
            } else if (sharedBldType === 'barracks') {
                const troops = ['rifleman', 'shotgunner', 'sniper', 'heavy', 'medic', 'mechanic'];
                troops.forEach((uType, idx) => {
                    const def = UNIT_DEFS[uType];
                    const locked = def.requiresArmory && !hasArmory;
                    slots[idx] = {
                        icon: uType === 'sniper' ? '🎯' : (uType === 'heavy' ? '🔥' : (uType === 'medic' ? '✚' : (uType === 'mechanic' ? '🔧' : '🪖'))),
                        label: uType.toUpperCase(),
                        hotkey: def.hotkey,
                        title: `Train ${def.name}${countBadge}` + (locked ? ' [LOCKED]' : ''),
                        cost: `${def.scrap} Scrap` + (def.fuel ? `, ${def.fuel} Fuel` : '') + ` | ${def.pop} Pop`,
                        desc: locked ? 'Requires Armory & Tech Lab [Y].' : def.desc,
                        disabled: locked || this.scrap < def.scrap || this.fuel < def.fuel || this.popUsed + def.pop > this.popMax,
                        action: () => this.queueAcrossSelectedBuildings(selectedPlayerBlds, uType, 'unit')
                    };
                });
            } else if (sharedBldType === 'motorpool') {
                // Update 5: aircraft are now built at the Airbase; supply trucks join the Motor Pool line-up
                const vehKeys = ['humvee', 'mrap', 'stryker', 'bradley', 'abrams', 'rockettruck', 'flameapc', 'supplytruck', 'heavysupply', 'trackedsupply'];
                const vehIcons = { humvee: '🚙', mrap: '🚐', stryker: '🚍', bradley: '🛡️', blackhawk: '🚁', abrams: '🚜',
                                   rockettruck: '🎆', flameapc: '🔥', apache: '🚁', bomber: '✈️',
                                   supplytruck: '📦', heavysupply: '🚛', trackedsupply: '🧰', chinook: '🚁' };
                vehKeys.forEach((vKey, idx) => {
                    const def = VEHICLE_DEFS[vKey];
                    const locked = def.requiresArmory && !hasArmory;
                    slots[idx] = {
                        icon: vehIcons[vKey],
                        label: `${def.shortLabel || vKey.toUpperCase()} [${def.capacity}]`,
                        hotkey: def.hotkey,
                        title: `Build ${def.name} (Cap: ${def.capacity})${countBadge}` + (locked ? ' [LOCKED]' : ''),
                        cost: `${def.scrap} Scrap, ${def.fuel} Fuel | ${def.pop} Pop`,
                        desc: locked ? 'Requires Armory & Tech Lab [Y].' : def.desc,
                        disabled: locked || this.scrap < def.scrap || this.fuel < def.fuel || this.popUsed + def.pop > this.popMax,
                        action: () => this.queueAcrossSelectedBuildings(selectedPlayerBlds, vKey, 'vehicle')
                    };
                });
            } else if (sharedBldType === 'airbase') {
                const ab = selectedPlayerBlds[0];
                ['blackhawk', 'apache', 'bomber', 'chinook'].forEach((vKey, idx) => {
                    const def = VEHICLE_DEFS[vKey];
                    const locked = def.requiresArmory && !hasArmory;
                    slots[idx] = {
                        icon: vKey === 'bomber' ? '✈️' : (vKey === 'chinook' ? '📦' : '🚁'),
                        label: `${def.shortLabel || vKey.toUpperCase()}`,
                        hotkey: def.hotkey,
                        title: `Build ${def.name}${countBadge}` + (locked ? ' [LOCKED]' : ''),
                        cost: `${def.scrap} Scrap, ${def.fuel} Fuel | ${def.pop} Pop · ${def.buildTime}s`,
                        desc: locked ? 'Requires Armory & Tech Lab [Y].' : def.desc,
                        disabled: locked || this.scrap < def.scrap || this.fuel < def.fuel || this.popUsed + def.pop > this.popMax,
                        action: () => this.queueAcrossSelectedBuildings(selectedPlayerBlds, vKey, 'vehicle')
                    };
                });
                for (let i = 0; i < 3; i++) {
                    const a = ab.storedHelis[i];
                    slots[4 + i] = a ? {
                        icon: '🚁', label: `DEPLOY ${VEHICLE_DEFS[a.type].shortLabel || a.type.toUpperCase()}`,
                        title: `Deploy ${a.name} from Helipad ${i + 1}`,
                        cost: `Fuel ${Math.floor(a.fuel)}/${a.fuelMax || '∞'} · HP ${Math.ceil(a.hp)}/${a.maxHp}`,
                        desc: 'Lift this stored helicopter off its pad and return it to active service.',
                        action: () => this.deployStoredAircraft(ab, false, i)
                    } : { icon: '⬚', label: `HELIPAD ${i + 1}`, title: `Helipad ${i + 1} (empty)`, cost: 'Empty', desc: 'Right-click this Airbase with a helicopter selected to land & store it here.', disabled: true };
                }
                for (let i = 0; i < 3; i++) {
                    const a = ab.storedPlanes[i];
                    slots[7 + i] = a ? {
                        icon: '✈️', label: `DEPLOY ${VEHICLE_DEFS[a.type].shortLabel || a.type.toUpperCase()}`,
                        title: `Launch ${a.name} from Runway bay ${i + 1}`,
                        cost: `Fuel ${Math.floor(a.fuel)}/${a.fuelMax || '∞'} · HP ${Math.ceil(a.hp)}/${a.maxHp}`,
                        desc: 'Launch this stored plane from the runway back into active service.',
                        action: () => this.deployStoredAircraft(ab, true, i)
                    } : { icon: '⬚', label: `RUNWAY ${i + 1}`, title: `Runway bay ${i + 1} (empty)`, cost: 'Empty', desc: 'Right-click this Airbase with a plane selected to land & park it here. Planes can only land at an Airbase runway.', disabled: true };
                }
            } else if (sharedBldType === 'artillery') {
                slots[0] = {
                    icon: '🔁', label: 'BARRAGE LOOP', hotkey: 'G',
                    title: `Continuous Area Bombardment Loop${countBadge}`, cost: 'Hotkey: G (or Right-Click Map)',
                    desc: 'Bombard a target zone repeatedly on an infinite loop until ordered to Cease Fire.',
                    active: this.targetingMode === 'artillery_loop',
                    action: () => {
                        this.targetingMode = (this.targetingMode === 'artillery_loop') ? null : 'artillery_loop';
                        this.showRadio('CLICK TARGET AREA FOR CONTINUOUS ARTILLERY BARRAGE LOOP.');
                        this.updateCommandGrid();
                    }
                };
                slots[1] = {
                    icon: '🎯', label: 'SINGLE SALVO', hotkey: 'F',
                    title: `Single Area Salvo${countBadge}`, cost: 'Hotkey: F',
                    desc: 'Fire a single 155mm shell at the designated coordinates.',
                    active: this.targetingMode === 'artillery_once',
                    action: () => {
                        this.targetingMode = (this.targetingMode === 'artillery_once') ? null : 'artillery_once';
                        this.showRadio('CLICK TARGET AREA FOR SINGLE ARTILLERY SALVO.');
                        this.updateCommandGrid();
                    }
                };
                slots[2] = {
                    icon: '🛑', label: 'CEASE FIRE', hotkey: 'C',
                    title: 'Stop Bombardment Loop', cost: 'Hotkey: C',
                    desc: 'Cancel active bombardment loop and return Howitzer to auto-defense.',
                    disabled: !selectedPlayerBlds.some(a => a.bombardTarget),
                    action: () => {
                        selectedPlayerBlds.forEach(a => { a.bombardTarget = null; a.bombardLoop = false; });
                        this.showRadio('HOWITZER BATTERY CEASED FIRE.');
                        this.updateSelectionUI();
                    }
                };
            } else if (sharedBldType === 'silo') {
                const readySilo = selectedPlayerBlds.find(s => s.missileCooldown <= 0);
                slots[0] = {
                    icon: '🚀', label: readySilo ? 'LAUNCH MISSILE' : `RELOAD ${Math.ceil(selectedPlayerBlds[0].missileCooldown)}s`, hotkey: 'L',
                    title: 'Launch Tactical Cruise Missile',
                    cost: readySilo ? `Warhead Armed — ${MISSILE_LAUNCH_FUEL} Fuel per launch` : `Cooldown: ${Math.ceil(selectedPlayerBlds[0].missileCooldown)}s`,
                    desc: 'Click target coordinates anywhere in the city to launch a high-explosive Tactical Cruise Missile.',
                    active: this.targetingMode === 'missile',
                    disabled: !readySilo || this.fuel < MISSILE_LAUNCH_FUEL,
                    action: () => {
                        this.targetingMode = (this.targetingMode === 'missile') ? null : 'missile';
                        this.showRadio('CLICK ANY LOCATION ON MAP OR MINIMAP FOR CRUISE MISSILE STRIKE.');
                        this.updateCommandGrid();
                    }
                };
            } else if (sharedBldType === 'gate') {
                slots[0] = {
                    icon: '🔓', label: 'TOGGLE GATE', hotkey: 'O',
                    title: `Toggle Blast Gate Lock${countBadge}`, cost: 'Hotkey: O',
                    desc: 'Cycle between Auto-Proximity Sensor, Locked Open, or Sealed Shut.',
                    action: () => {
                        selectedPlayerBlds.forEach(g => {
                            if (g.manualGateState === null) { g.manualGateState = 'open'; g.isOpen = true; }
                            else if (g.manualGateState === 'open') { g.manualGateState = 'closed'; g.isOpen = false; }
                            else { g.manualGateState = null; }
                        });
                        sfx.playGateToggle(true);
                        this.updateSelectionUI();
                    }
                };
            } else if (singleBld && singleBld.type === 'collector') {
                const maxed = singleBld.level >= 3;
                const upgScrap = singleBld.level === 1 ? 240 : 380;
                const upgFuel = singleBld.level === 1 ? 70 : 140;
                slots[0] = {
                    icon: maxed ? '⭐' : '⬆️',
                    label: maxed ? 'MAX LVL' : `LVL ${singleBld.level + 1}`,
                    hotkey: 'U',
                    title: maxed ? 'Collector Maxed (Level 3)' : `Upgrade Collector to Level ${singleBld.level + 1}`,
                    cost: maxed ? 'Max Output Reached' : `${upgScrap} Scrap, ${upgFuel} Fuel`,
                    desc: maxed ? 'Operating at maximum automated extraction efficiency.' : 'Increases Scrap & Fuel output by +45% and reinforces structure armor.',
                    disabled: maxed || this.scrap < upgScrap || this.fuel < upgFuel,
                    action: () => this.upgradeCollector(singleBld)
                };
            } else if (singleBld && singleBld.type === 'armory') {
                Object.keys(UPGRADE_DEFS).forEach((uKey, idx) => {
                    const def = UPGRADE_DEFS[uKey];
                    const done = this.upgrades[uKey];
                    slots[idx] = {
                        icon: done ? '✅' : '⚡',
                        label: done ? 'DONE' : uKey.toUpperCase(),
                        hotkey: def.hotkey,
                        title: def.name,
                        cost: done ? 'Researched' : `${def.scrap} Scrap, ${def.fuel} Fuel`,
                        desc: def.desc,
                        disabled: done || this.scrap < def.scrap || this.fuel < def.fuel,
                        action: () => this.purchaseUpgrade(uKey)
                    };
                });
            }
        }

        // Update 4: damaged finished buildings selected -> call a mechanic
        const damagedBlds = selectedPlayerBlds.filter(b => this.isRepairable(b));
        if (damagedBlds.length > 0 && !hasEngineer && !slots[10]) {
            const anyMech = this.entities.some(e => e.faction === 'player' && e.type === 'mechanic');
            slots[10] = {
                icon: '🛠️', label: 'CALL MECHANIC', hotkey: 'I',
                title: 'Call Mechanic to Repair',
                cost: anyMech ? `${damagedBlds.length} damaged structure(s)` : 'No Combat Mechanic available',
                desc: 'Send the nearest Combat Mechanic to repair the selected damaged building(s).',
                disabled: !anyMech,
                action: () => this.callMechanicsForSelected()
            };
        }

        const dismantlable = selectedPlayerBlds.filter(b => b.type !== 'hq');
        if (dismantlable.length > 0 && !hasEngineer && !hasMobile) {
            slots[11] = {
                icon: '💥',
                label: 'DISMANTLE',
                hotkey: 'X',
                title: `Dismantle Structure${dismantlable.length > 1 ? ` (x${dismantlable.length})` : ''}`,
                cost: 'Refunds 60% Scrap & Fuel',
                desc: 'Deconstruct selected structure(s) and salvage 60% of construction resources.',
                action: () => this.dismantleSelectedBuildings()
            };
        }

        const tooltip = document.getElementById('cmd-tooltip');
        for (let i = 0; i < 12; i++) {
            const slot = slots[i];
            const btn = document.createElement('button');
            if (!slot) {
                btn.className = 'cmd-btn empty';
                grid.appendChild(btn);
                continue;
            }
            btn.className = 'cmd-btn' + (slot.active ? ' active' : '') + (slot.disabled ? ' disabled' : '');
            if (slot.hotkey && !'WASD'.includes(slot.hotkey)) btn.dataset.hotkey = slot.hotkey;
            btn.innerHTML = `
                ${slot.hotkey ? `<span class="cmd-hotkey">${slot.hotkey}</span>` : ''}
                <span class="cmd-icon">${slot.icon}</span>
                <span class="cmd-label">${slot.label}</span>
            `;
            btn.addEventListener('click', () => {
                if (!slot.disabled && slot.action) slot.action();
            });
            btn.addEventListener('mouseenter', (e) => {
                document.getElementById('tt-title').textContent = slot.title;
                document.getElementById('tt-cost').textContent = slot.cost;
                document.getElementById('tt-desc').textContent = slot.desc;
                tooltip.style.display = 'block';
                tooltip.style.left = Math.min(window.innerWidth - 290, e.clientX - 120) + 'px';
                tooltip.style.top = Math.max(10, e.clientY - 105) + 'px';
            });
            btn.addEventListener('mouseleave', () => {
                tooltip.style.display = 'none';
            });
            grid.appendChild(btn);
        }
    }
});
