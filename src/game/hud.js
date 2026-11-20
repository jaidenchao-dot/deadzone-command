'use strict';
// HUD readouts, selection panel, live status, radio, intel toggle, win / loss
defineGameMethods({
    toggleIntel() {
        if (!this.running) return;
        this.showIntel = !this.showIntel;
        const btn = document.getElementById('btn-intel');
        if (btn) btn.textContent = this.showIntel ? '📡 INTEL [J]' : '📡 INTEL: OFF';
        sfx.playRadioAck('select');
        const open = this.survivorIntel.filter(s => s.status === 'unknown' || s.status === 'confirmed').length;
        this.showRadio(this.showIntel ? `📡 SURVIVOR INTEL OVERLAY ON — ${open} ACTIVE SIGNAL(S). ZONES ARE ESTIMATES.` : '📡 SURVIVOR INTEL OVERLAY HIDDEN.');
    },

    updateHUDReadouts() {
        document.getElementById('ui-scrap').textContent = this.infiniteResources ? '∞' : Math.floor(this.scrap);
        document.getElementById('ui-fuel').textContent = this.infiniteResources ? '∞' : Math.floor(this.fuel);
        document.getElementById('ui-pop').textContent = `${this.popUsed}/${this.popMax}`;
        document.getElementById('ui-survivors').textContent = this.survivorsRescued;

        const reclaimedCount = this.districts.filter(d => d.status === 'reclaimed').length;
        document.getElementById('ui-districts').textContent = `${reclaimedCount}/${this.districts.length}`;

        const hivesLeft = this.entities.filter(e => e.category === 'hive').length;
        document.getElementById('ui-hives').textContent = hivesLeft;

        const mins = Math.floor(this.surgeTimer / 60);
        const secs = Math.floor(this.surgeTimer % 60);
        document.getElementById('ui-surge').textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        if (this.selectedIds.size === 1) {
            const [id] = this.selectedIds;
            const ent = this.entities.find(e => e.id === id);
            if (ent && ent.maxHp) {
                document.getElementById('hp-bar-inner').style.width = `${Math.max(0, (ent.hp / ent.maxHp) * 100)}%`;
            }
            if (ent && ent.category === 'building' && ent.queue && ent.queue.length > 0) {
                const item = ent.queue[0];
                document.getElementById('queue-progress-fill').style.width = `${(item.progress / item.totalTime) * 100}%`;
            }
        }

        // Update 3: live infection / medic / survivor status without rebuilding the panel every frame
        this.refreshLiveStatus();
        const sig = this.computeCommandGridSignature();
        if (sig !== this.lastGridSig) {
            this.lastGridSig = sig;
            this.updateCommandGrid();
        }
    },

    refreshLiveStatus() {
        const live = document.getElementById('sel-live');
        if (!live || this.selectedIds.size !== 1) return;
        const [id] = this.selectedIds;
        const ent = this.entities.find(e => e.id === id);
        if (!ent) return;
        const parts = [];
        if (ent.underConstruction) {
            const pct = Math.floor((ent.buildProgress / ent.buildTime) * 100);
            const left = Math.ceil((ent.buildTime - ent.buildProgress) / (ent.buildAssisted ? 1.5 : 1));
            parts.push(`<span style="color:#f2cc60">🏗 CONSTRUCTION ${pct}% — ${left}s LEFT${ent.buildAssisted ? ' (ENGINEER ASSIST)' : ''}</span>`);
        }
        if (ent.infected) {
            parts.push(`<span style="color:#a6e22e">☣ INFECTED — TURNS IN ${Math.ceil(ent.infectionTimer)}s (MEDIC CAN CURE)</span>`);
        }
        // Update 5: ammunition per type, fuel, food
        if (ent.ammoMax && Object.keys(ent.ammoMax).length > 0) {
            const ammoTxt = Object.keys(ent.ammoMax).map(t => {
                const cur = Math.floor(ent.ammo[t]), mx = ent.ammoMax[t];
                const col = cur <= 0 ? '#f85149' : (cur / mx < 0.25 ? '#ffa657' : '#c9d1d9');
                return `<span style="color:${col}">${AMMO_DEFS[t].short}: ${cur}/${mx}</span>`;
            }).join(' ');
            parts.push(`<span>🔫 ${ammoTxt}</span>`);
        }
        if (ent.fuelMax) {
            const fp = ent.fuel / ent.fuelMax;
            parts.push(`<span style="color:${fp <= 0 ? '#f85149' : (fp < 0.25 ? '#ffa657' : '#79c0ff')}">⛽ FUEL: ${Math.ceil(ent.fuel)}/${ent.fuelMax}${ent.fuel <= 0 ? (ent.isAir ? '' : ' — IMMOBILIZED') : ''}</span>`);
        } else if (ent.supply) {
            parts.push('<span style="color:#8b949e">⛽ FUEL: EXEMPT (LOGISTICS)</span>');
        }
        if (ent.food !== undefined) {
            const f = Math.ceil(ent.food);
            parts.push(ent.food > 0
                ? `<span style="color:${f < 25 ? '#ffa657' : '#7ee787'}">🍖 FOOD: ${f}%</span>`
                : `<span style="color:#f85149">🍖 STARVING — DIES IN ${Math.ceil(STARVE_DEATH_TIME - ent.starveTimer)}s</span>`);
        }
        if (ent.canFly && HELI_TYPES.has(ent.type)) {
            parts.push(`<span style="color:#a5d6ff">✈ ${ent.landed ? 'LANDED' : (ent.flightTransition > 0 ? 'TRANSITIONING' : 'AIRBORNE')}</span>`);
        }
        if (ent.supply) {
            const used = this.cargoWeight(ent);
            parts.push(`<span style="color:#f2cc60">📦 CARGO ${Math.round(used)}/${ent.cargoCapacity}</span>`);
        }
        if (ent.type === 'mechanic') {
            const tg = ent.state === 'repair' ? this.getEntityById(ent.targetId) : null;
            parts.push(tg
                ? `<span style="color:#79c0ff">🔧 ${ent.repairing ? 'REPAIRING' : 'EN ROUTE TO'} ${tg.name.toUpperCase()}: ${Math.ceil(tg.hp)}/${tg.maxHp} HP</span>`
                : '<span style="color:#8b949e">🔧 IDLE — AUTO-REPAIRS NEARBY DAMAGED EQUIPMENT</span>');
        }
        if (ent.type === 'medic') {
            const pt = ent.healTargetId ? this.getEntityById(ent.healTargetId) : null;
            parts.push(pt
                ? `<span style="color:#7ee787">✚ HEALING ${pt.name.toUpperCase()}: ${Math.ceil(pt.hp)}/${pt.maxHp} HP</span>`
                : '<span style="color:#8b949e">✚ PASSIVE HEAL READY (NO INJURED NEARBY)</span>');
        }
        if (ent.treatMax) {
            parts.push(ent.treatCharges > 0
                ? `<span style="color:#7ee787">✚ TREATMENTS: ${ent.treatCharges}/${ent.treatMax}</span>`
                : `<span style="color:#d29922">✚ RECHARGING: ${Math.ceil(ent.treatCooldown)}s</span>`);
        }
        if (ent.isSurvivor && ent.faction === 'player') {
            const hq = this.entities.find(e => e.faction === 'player' && e.type === 'hq');
            const d = hq ? Math.hypot(hq.x - ent.x, hq.y - ent.y) : Infinity;
            parts.push(d <= SURVIVOR_RETURN_RANGE
                ? '<span style="color:#56d4dd">🏠 IN HQ RANGE — RETURN TO HQ [R] AVAILABLE</span>'
                : `<span style="color:#8b949e">🏠 TOO FAR FROM HQ (${Math.ceil((d - SURVIVOR_RETURN_RANGE) / TILE_SIZE)} BLOCKS OUT)</span>`);
        }
        const html = parts.join('&nbsp;&nbsp; ');
        if (live.innerHTML !== html) live.innerHTML = html;
        // Update 5: supply inventory list
        const inv = document.getElementById('supply-inv');
        if (inv) {
            if (ent.supply) {
                const ih = AMMO_ORDER.map(t => `<span class="inv-chip${ent.inventory[t] > 0 ? '' : ' empty'}" title="${AMMO_DEFS[t].name}">${AMMO_DEFS[t].short} ${Math.floor(ent.inventory[t])}</span>`).join('');
                if (inv.innerHTML !== ih) inv.innerHTML = ih;
                inv.style.display = 'flex';
            } else if (inv.style.display !== 'none') {
                inv.style.display = 'none';
            }
        }
    },

    // Rebuild the command grid only when something it displays actually changes
    computeCommandGridSignature() {
        if (this.selectedIds.size === 0) return '';
        const hq = this.entities.find(e => e.faction === 'player' && e.type === 'hq');
        let sig = '';
        for (const id of this.selectedIds) {
            const e = this.entities.find(x => x.id === id);
            if (!e) continue;
            if (e.isSurvivor && hq) sig += (Math.hypot(hq.x - e.x, hq.y - e.y) <= SURVIVOR_RETURN_RANGE ? 'R' : 'r') +
                (Math.hypot(hq.x - e.x, hq.y - e.y) > SURVIVOR_RETURN_RANGE ? Math.ceil((Math.hypot(hq.x - e.x, hq.y - e.y) - SURVIVOR_RETURN_RANGE) / TILE_SIZE) : '');
            if (e.treatMax) sig += 'm' + e.treatCharges + ':' + (e.treatCharges > 0 ? 0 : Math.ceil(e.treatCooldown));
            if (e.infected) sig += 'i';
            if (e.underConstruction) sig += 'u';
            if (e.category === 'vehicle' || e.category === 'building') sig += (e.hp < e.maxHp ? 'd' : '');
        }
        sig += '|' + this.entities.some(e => e.faction === 'player' && e.type === 'mechanic');
        sig += '|' + this.entities.some(e => e.faction === 'player' && e.type === 'medic' && e.treatCharges > 0);
        return sig;
    },

    checkWinLossConditions() {
        const hqAlive = this.entities.some(e => e.category === 'building' && e.type === 'hq');
        // Update 7: the infinite map has no final victory — survive, expand and reclaim as far as you can
        const allReclaimed = !this.infinite && this.districts.length > 0 && this.districts.every(d => d.status === 'reclaimed');

        if (!hqAlive) {
            this.gameOver = true;
            document.getElementById('end-title').textContent = 'BATTERY PARK HQ FALLEN';
            document.getElementById('end-title').style.color = '#ff7b72';
            document.getElementById('end-sub').textContent = 'NEW YORK CITY LOST TO THE INFECTED HORDE';
            const reclaimed = this.districts.filter(d => d.status === 'reclaimed').length;
            document.getElementById('end-stats').innerHTML =
                `• Districts Reclaimed: <strong>${reclaimed}/${this.districts.length}</strong><br>` +
                `• Survival Time: <strong>${Math.floor(this.elapsedTime)}s</strong><br>` +
                `• Infected Eliminated: <strong>${this.kills}</strong><br>` +
                `• Survivors Rescued: <strong>${this.survivorsRescued}</strong> &bull; Bandits Neutralized: <strong>${this.mercKills}</strong>`;
            document.getElementById('end-modal').style.display = 'flex';
        } else if (allReclaimed) {
            this.gameOver = true;
            document.getElementById('end-title').textContent = 'NEW YORK CITY RECLAIMED';
            document.getElementById('end-title').style.color = '#7ee787';
            document.getElementById('end-sub').textContent = 'ALL 6 CITY DISTRICTS & 7 HIVES LIBERATED';
            document.getElementById('end-stats').innerHTML =
                `• Operation Completion Time: <strong>${Math.floor(this.elapsedTime)}s</strong><br>` +
                `• Total Infected Eliminated: <strong>${this.kills}</strong><br>` +
                `• Survivors Rescued: <strong>${this.survivorsRescued}</strong> &bull; Bandits Neutralized: <strong>${this.mercKills}</strong><br>` +
                `• Remaining War Reserves: <strong>${Math.floor(this.scrap)} Scrap, ${Math.floor(this.fuel)} Fuel</strong>`;
            document.getElementById('end-modal').style.display = 'flex';
        }
    },

    showRadio(msg) {
        const banner = document.getElementById('radio-banner');
        banner.textContent = msg;
        banner.classList.add('visible');
        this.radioTimer = 4.0;
    },

    // ========================================================================
    // 10. SELECTION UI & 4x3 COMMAND GRID
    // ========================================================================
    updateSelectionUI() {
        this.renderControlGroupsBar();
        const selected = this.entities.filter(e => this.selectedIds.has(e.id));
        const portraitBox = document.getElementById('portrait-box');
        const detailsBox = document.getElementById('details-box');
        const multiGrid = document.getElementById('multi-grid');
        const paxBay = document.getElementById('passenger-bay');
        const distList = document.getElementById('district-overview-list');
        const qCont = document.getElementById('queue-container');

        paxBay.style.display = 'none';
        paxBay.innerHTML = '';
        distList.style.display = 'none';
        distList.innerHTML = '';
        qCont.style.display = 'none';
        const sInv = document.getElementById('supply-inv');
        if (sInv) { sInv.style.display = 'none'; sInv.innerHTML = ''; }

        if (selected.length === 0) {
            portraitBox.style.display = 'none';
            multiGrid.style.display = 'none';
            detailsBox.style.display = 'flex';
            const reclaimed = this.districts.filter(d => d.status === 'reclaimed').length;
            document.getElementById('sel-title').textContent = `${(this.mapDef || MAP_DEFS.manhattan).city} RECLAMATION STATUS — ${reclaimed}/${this.districts.length} DISTRICTS SECURED`;
            const activeSigs = this.survivorIntel.filter(s => s.status === 'unknown' || s.status === 'confirmed').length;
            document.getElementById('sel-stats').innerHTML = `<span>KILLS: ${this.kills}</span><span style="color:#56d4dd">RESCUED: ${this.survivorsRescued}</span><span style="color:#56d4dd">SIGNALS: ${activeSigs}</span><span>ZOOM: ${this.cam.zoom.toFixed(1)}x</span><span>CLICK ANY CHIP TO PAN CAMERA</span>`;
            document.getElementById('sel-desc').textContent = `Retake every ${(this.mapDef || MAP_DEFS.manhattan).city} district by destroying its mutated hives and eliminating occupying zombie packs.`;

            distList.style.display = 'flex';
            // Update 7: the infinite map lists the 12 sectors nearest the camera
            let shownDistricts = this.districts;
            if (this.infinite) {
                const zc = this.cam.zoom || 1;
                const ccx = this.cam.x + this.canvas.width / (2 * zc), ccy = this.cam.y + this.canvas.height / (2 * zc);
                const dd = (d) => Math.hypot(((d.c1 + d.c2 + 1) / 2) * TILE_SIZE - ccx, ((d.r1 + d.r2 + 1) / 2) * TILE_SIZE - ccy);
                shownDistricts = this.districts.slice().sort((p1, p2) => dd(p1) - dd(p2)).slice(0, 12);
            }
            shownDistricts.forEach(d => {
                const chip = document.createElement('span');
                chip.className = `dist-chip ${d.status}`;
                const tag = d.status === 'reclaimed' ? 'SECURED' : (d.hivesAlive > 0 ? `${d.hivesAlive} HIVE` : `${d.zombiesAlive} ZED`);
                chip.textContent = `${d.shortName} [${tag}]`;
                chip.title = `${d.name} — Status: ${d.status.toUpperCase()} | Liberation Bonus: +${d.rewardScrap} Scrap, +${d.rewardFuel} Fuel (Click to view sector)`;
                chip.addEventListener('click', () => {
                    const cx = ((d.c1 + d.c2 + 1) / 2) * TILE_SIZE;
                    const cy = ((d.r1 + d.r2 + 1) / 2) * TILE_SIZE;
                    this.panCameraToWorld(cx, cy);
                });
                distList.appendChild(chip);
            });

            // Survivor intel signals (estimated zones) — click to pan
            this.survivorIntel.forEach(sig => {
                if (sig.status === 'false') return;
                const chip = document.createElement('span');
                chip.className = 'dist-chip intel' + (sig.status === 'confirmed' ? ' confirmed' : '');
                chip.textContent = `📡 ${sig.label.replace('SIGNAL ', '')} ${sig.status === 'confirmed' ? '✓' : '?'}`;
                chip.title = sig.status === 'confirmed'
                    ? `${sig.label} — Survivors confirmed. Click to view.`
                    : `${sig.label} — ${sig.flavor}. Estimated zone only; survivors may be anywhere inside the circle — or nowhere. Click to view.`;
                chip.addEventListener('click', () => {
                    if (sig.status === 'confirmed') this.panCameraToWorld(sig.trueX, sig.trueY);
                    else this.panCameraToWorld(sig.x, sig.y);
                });
                distList.appendChild(chip);
            });

            // Discovered bandit territories
            this.mercCamps.forEach(camp => {
                if (!camp.discovered) return;
                const chip = document.createElement('span');
                chip.className = 'dist-chip bandit';
                chip.textContent = `☠ ${camp.name.split(' ')[0].toUpperCase()} ${camp.knownAlive !== false ? 'GANG' : '[BROKEN]'}`;
                chip.title = `${camp.name} — Mercenary territory. ${camp.knownAlive !== false ? 'Destroy the stronghold to stop reinforcements and seize the stockpile.' : 'Stronghold destroyed.'} Click to view.`;
                chip.addEventListener('click', () => this.panCameraToWorld(camp.x, camp.y));
                distList.appendChild(chip);
            });
        } else if (selected.length === 1) {
            const ent = selected[0];
            portraitBox.style.display = 'flex';
            multiGrid.style.display = 'none';
            detailsBox.style.display = 'flex';

            const pctx = document.getElementById('portrait-canvas').getContext('2d');
            pctx.imageSmoothingEnabled = false;
            pctx.clearRect(0, 0, 56, 56);
            const spKey = ent.category === 'unit' ? this.getUnitSpriteKey(ent) :
                          (ent.category === 'vehicle' ? 'veh_' + ent.type :
                          (ent.category === 'building' ? (ent.type === 'gate' ? 'bld_gate_closed' : 'bld_' + ent.type) :
                          (ent.category === 'zombie' ? 'zombie_' + ent.type :
                          (ent.category === 'depot' ? 'depot_node' :
                          (ent.category === 'crate' ? 'crate' :
                          (ent.category === 'merc' ? 'merc_' + ent.type :
                          (ent.category === 'mercstruct' ? 'mstruct_' + ent.type :
                          (ent.category === 'survivor' ? this.getSurvivorSpriteKey(ent) :
                          (ent.category === 'shelter' ? (ent.opened ? 'shelter_open' : 'shelter_locked') :
                          (ent.category === 'fort' ? 'fort_barricade' : ent.type))))))))));
            const spr = SpriteBank[spKey];
            if (spr) pctx.drawImage(spr, 6, 6, 44, 44);

            const hpPct = ent.maxHp ? Math.max(0, (ent.hp / ent.maxHp) * 100) : 100;
            document.getElementById('hp-bar-inner').style.width = `${hpPct}%`;
            document.getElementById('sel-title').textContent = ent.name.toUpperCase();

            if (ent.category === 'unit') {
                document.getElementById('sel-stats').innerHTML =
                    `<span>HP: ${Math.ceil(ent.hp)}/${ent.maxHp}</span>` +
                    (ent.unarmed ? '<span>UNARMED</span>' : `<span>DMG: ${ent.damage}</span><span>RNG: ${ent.range}</span>`) +
                    `<span id="sel-live"></span>`;
                document.getElementById('sel-desc').textContent = UNIT_DEFS[ent.type].desc;
                this.refreshLiveStatus();
            } else if (ent.category === 'vehicle') {
                const capText = ent.capacity > 0 ? `PASSENGERS: ${ent.passengers.length}/${ent.capacity}` : 'PASSENGERS: 0/0 (TANK CREW)';
                document.getElementById('sel-stats').innerHTML =
                    `<span>HP: ${Math.ceil(ent.hp)}/${ent.maxHp}</span>` +
                    (ent.unarmed || ent.supply ? '' : `<span>DMG: ${ent.damage}</span>`) +
                    (ent.capacity > 0 || !ent.supply ? `<span style="color:#f2cc60">${capText}</span>` : '') +
                    `<span id="sel-live"></span>`;
                document.getElementById('sel-desc').textContent = VEHICLE_DEFS[ent.type].desc + (ent.abandoned ? '' : '');
                this.refreshLiveStatus();

                if (ent.passengers && ent.passengers.length > 0) {
                    paxBay.style.display = 'flex';
                    ent.passengers.forEach((p, idx) => {
                        const chip = document.createElement('span');
                        chip.className = 'pax-chip';
                        chip.textContent = `${p.infected ? '☣' : ''}${(UNIT_DEFS[p.type] && UNIT_DEFS[p.type].shortLabel) || p.type.toUpperCase()} ×`;
                        chip.title = `Click to disembark ${p.name}`;
                        chip.addEventListener('click', () => this.unloadSinglePassenger(ent, idx));
                        paxBay.appendChild(chip);
                    });
                }
            } else if (ent.category === 'building' && ent.underConstruction) {
                document.getElementById('sel-stats').innerHTML =
                    `<span>HP: ${Math.ceil(ent.hp)}/${ent.maxHp}</span><span id="sel-live"></span>`;
                document.getElementById('sel-desc').textContent =
                    `Under construction — not operational until complete. Keep an Engineer nearby to build 50% faster. Dismantle [X] cancels and refunds 60%. ${BUILDING_DEFS[ent.type].desc}`;
                this.refreshLiveStatus();
            } else if (ent.category === 'building') {
                if (ent.type === 'collector') {
                    const ym = this.getCollectorYieldMult();
                    const bonusTxt = ym > 1 ? ` <span style="color:#56d4dd">(+${Math.round((ym - 1) * 100)}% MECHANICS)</span>` : '';
                    document.getElementById('sel-stats').innerHTML =
                        `<span>HP: ${Math.ceil(ent.hp)}/${ent.maxHp}</span>` +
                        `<span style="color:#f2cc60">TIER: LVL ${ent.level}/3</span>` +
                        `<span style="color:#7ee787">OUTPUT: +${Math.round(ent.scrapRate * ym)} SCRAP, +${Math.round(ent.fuelRate * ym)} FUEL / 5s${bonusTxt}</span>`;
                    document.getElementById('sel-desc').textContent = BUILDING_DEFS.collector.desc;
                } else if (ent.type === 'gate') {
                    const st = ent.manualGateState ? `MANUAL (${ent.manualGateState.toUpperCase()})` : (ent.isOpen ? 'AUTO-OPEN' : 'SEALED');
                    document.getElementById('sel-stats').innerHTML =
                        `<span>HP: ${Math.ceil(ent.hp)}/${ent.maxHp}</span>` +
                        `<span style="color:${ent.isOpen ? '#3fb950' : '#d29922'}">GATE: ${st}</span>`;
                    document.getElementById('sel-desc').textContent = BUILDING_DEFS.gate.desc;
                } else if (ent.type === 'airbase') {
                    document.getElementById('sel-stats').innerHTML =
                        `<span>HP: ${Math.ceil(ent.hp)}/${ent.maxHp}</span>` +
                        `<span style="color:#a5d6ff">🚁 HELIPADS: ${ent.storedHelis.length}/3</span>` +
                        `<span style="color:#a5d6ff">✈ RUNWAY: ${ent.storedPlanes.length}/3</span>`;
                    const list = ent.storedHelis.concat(ent.storedPlanes).map(a => `${VEHICLE_DEFS[a.type].shortLabel || a.type} ${Math.round(a.fuel / a.fuelMax * 100) || 100}%`).join(', ');
                    document.getElementById('sel-desc').textContent = (list ? `STORED (fuel): ${list}. ` : 'No aircraft stored. ') + BUILDING_DEFS.airbase.desc;
                } else if (ent.type === 'artillery') {
                    const mode = ent.bombardTarget ? (ent.bombardLoop ? 'LOOP BARRAGE ACTIVE' : 'SINGLE SALVO TARGETED') : 'AUTO-DEFENSE';
                    document.getElementById('sel-stats').innerHTML =
                        `<span>HP: ${Math.ceil(ent.hp)}/${ent.maxHp}</span>` +
                        `<span style="color:#ffa657">MODE: ${mode}</span>`;
                    document.getElementById('sel-desc').textContent = BUILDING_DEFS.artillery.desc;
                } else {
                    document.getElementById('sel-stats').innerHTML = `<span>HP: ${Math.ceil(ent.hp)}/${ent.maxHp}</span>`;
                    document.getElementById('sel-desc').textContent = BUILDING_DEFS[ent.type].desc;
                }

                if (ent.queue && ent.queue.length > 0) {
                    qCont.style.display = 'flex';
                    const item = ent.queue[0];
                    const itemName = item.isBattalion ? BATTALION_DEFS[item.unitType].name :
                                     (item.isVehicle ? VEHICLE_DEFS[item.unitType].name : UNIT_DEFS[item.unitType].name);
                    document.getElementById('queue-label').textContent = `BUILDING ${itemName.toUpperCase()}`;
                    document.getElementById('queue-progress-fill').style.width = `${(item.progress / item.totalTime) * 100}%`;
                    document.getElementById('queue-count').textContent = `x${ent.queue.length}`;
                } else if (ent.type === 'silo' && ent.missileCooldown > 0) {
                    qCont.style.display = 'flex';
                    document.getElementById('queue-label').textContent = `SILO RELOADING (${Math.ceil(ent.missileCooldown)}s)`;
                    document.getElementById('queue-progress-fill').style.width = `${((ent.missileMaxCooldown - ent.missileCooldown) / ent.missileMaxCooldown) * 100}%`;
                    document.getElementById('queue-count').textContent = 'ARMING';
                }
            } else if (ent.category === 'depot') {
                document.getElementById('sel-stats').innerHTML =
                    `<span style="color:#f2cc60">YIELD: +${ent.scrapRate} SCRAP, +${ent.fuelRate} FUEL / 5s</span>` +
                    `<span>STATUS: ${ent.claimedBy ? 'CLAIMED' : 'UNCLAIMED'}</span>`;
                document.getElementById('sel-desc').textContent = 'Select a Combat Engineer and build a Resource Collector [R] (or right-click this depot) to automate urban resource extraction.';
            } else if (ent.category === 'crate') {
                document.getElementById('sel-stats').innerHTML = `<span style="color:#f2cc60">+${ent.scrapValue} SCRAP, +${ent.fuelValue} FUEL</span>`;
                document.getElementById('sel-desc').textContent = 'Right-click with any unit to scavenge these emergency CEDA military supplies.';
            } else if (ent.category === 'hive') {
                const dist = this.getDistrictAtWorld(ent.x, ent.y);
                document.getElementById('sel-stats').innerHTML =
                    `<span style="color:#ff7b72">HIVE BIOMASS HP: ${Math.ceil(ent.hp)}/${ent.maxHp}</span>` +
                    `<span style="color:#ffa657">DISTRICT: ${dist ? dist.name.toUpperCase() : (this.mapDef || MAP_DEFS.manhattan).city}</span>`;
                document.getElementById('sel-desc').textContent = ent.desc || 'Mutated zombie hive nest. Destroy all hives and clear hostiles to reclaim this district.';
            } else if (ent.category === 'merc') {
                const camp = this.mercCamps.find(c => c.id === ent.campId);
                document.getElementById('sel-stats').innerHTML =
                    `<span style="color:#ff7b72">HOSTILE HP: ${Math.ceil(ent.hp)}/${ent.maxHp}</span>` +
                    `<span>DMG: ${ent.damage}</span><span>RNG: ${ent.range}</span>` +
                    `<span style="color:#ffa657">GANG: ${camp ? camp.name.toUpperCase() : 'UNKNOWN'}</span>`;
                document.getElementById('sel-desc').textContent = 'Hostile mercenary bandit. Defends its gang\'s territory and opens fire on your forces, the infected and civilian survivors alike.';
            } else if (ent.category === 'mercstruct') {
                const camp = this.mercCamps.find(c => c.id === ent.campId);
                const lootTxt = (ent.type === 'bunker' && camp) ? `<span style="color:#f2cc60">STOCKPILE: +${camp.lootScrap} SCRAP, +${camp.lootFuel} FUEL</span>` : '';
                document.getElementById('sel-stats').innerHTML =
                    `<span style="color:#ff7b72">STRUCTURE HP: ${Math.ceil(ent.hp)}/${ent.maxHp}</span>` +
                    `<span style="color:#ffa657">GANG: ${camp ? camp.name.toUpperCase() : 'UNKNOWN'}</span>` + lootTxt;
                document.getElementById('sel-desc').textContent = MERC_STRUCT_DEFS[ent.type].desc;
            } else if (ent.category === 'survivor') {
                const def = SURVIVOR_DEFS[ent.type];
                const status = 'HOLDING OUTPOST';
                document.getElementById('sel-stats').innerHTML =
                    `<span style="color:#56d4dd">HP: ${Math.ceil(ent.hp)}/${ent.maxHp}</span>` +
                    `<span style="color:#a5f3fc">STATUS: ${status}</span>` +
                    (ent.armed ? `<span>ARMED: DMG ${ent.damage}</span>` : '<span>UNARMED</span>');
                document.getElementById('sel-desc').textContent =
                    `Armed survivors holding out. Move any of your units close to this outpost to make contact — the whole group then joins your command as controllable units. Rescue bonus (via RETURN TO HQ): ${def.bonusDesc}`;
            } else if (ent.category === 'shelter') {
                document.getElementById('sel-stats').innerHTML = ent.opened
                    ? `<span style="color:#8b949e">STATUS: BREACHED & CLEARED</span>`
                    : `<span style="color:#56d4dd">STATUS: LOCKED — MUFFLED VOICES INSIDE</span>` +
                      `<span style="color:#f2cc60">BREACH: ${Math.floor((ent.unlockProgress / ent.unlockTime) * 100)}%</span>`;
                document.getElementById('sel-desc').textContent = ent.opened
                    ? `${ent.label}. Everyone inside has left the shelter.`
                    : `${ent.label}. Civilians are barricaded inside. Right-click this door with any ground unit — it will move next to the door and unlock it (${ent.unlockTime}s).`;
            } else if (ent.category === 'fort') {
                const op = this.outposts.find(o => o.id === ent.outpostId);
                document.getElementById('sel-stats').innerHTML =
                    `<span style="color:#56d4dd">HP: ${Math.ceil(ent.hp)}/${ent.maxHp}</span>` +
                    `<span>OUTPOST: ${op ? op.name.toUpperCase() : 'SURVIVOR OUTPOST'}</span>`;
                document.getElementById('sel-desc').textContent = 'Improvised barricade built by armed survivors. Shields the outpost from infected assaults.';
            } else {
                document.getElementById('sel-stats').innerHTML = `<span style="color:#ff7b72">HOSTILE HP: ${Math.ceil(ent.hp)}/${ent.maxHp}</span>`;
                document.getElementById('sel-desc').textContent = 'Infected urban hostile occupying New York City.';
            }
        } else {
            portraitBox.style.display = 'none';
            detailsBox.style.display = 'none';
            multiGrid.style.display = 'grid';
            multiGrid.innerHTML = '';

            selected.forEach(u => {
                const card = document.createElement('div');
                card.className = 'multi-unit-card';
                const hpPct = u.maxHp ? Math.max(0, (u.hp / u.maxHp) * 100) : 100;
                const badge = u.category === 'vehicle' && u.capacity > 0 ? ` ${u.passengers.length}/${u.capacity}` :
                              (u.category === 'building' && u.queue && u.queue.length > 0 ? ` Q:${u.queue.length}` : '');
                card.innerHTML = `
                    <span style="font-size:12px; color:${u.infected ? '#a6e22e' : '#fff'};">${u.infected ? '☣' : ''}${(UNIT_DEFS[u.type] && UNIT_DEFS[u.type].shortLabel) || u.type.slice(0, 4).toUpperCase()}${badge}${u.treatMax ? (u.treatCharges > 0 ? ` T${u.treatCharges}` : ' CD') : ''}${(u.ammoType && this.settings.ammo && !this.hasAmmo(u)) ? ' ⊘' : ''}${(u.food !== undefined && u.food <= 0) ? ' 🍖' : ''}${(u.fuelMax && u.fuel <= 0) ? ' ⛽' : ''}</span>
                    <div class="multi-unit-hp"><div class="multi-unit-hp-fill" style="width:${hpPct}%"></div></div>
                `;
                card.addEventListener('click', () => {
                    this.selectedIds.clear();
                    this.selectedIds.add(u.id);
                    this.updateSelectionUI();
                });
                multiGrid.appendChild(card);
            });
        }

        this.updateCommandGrid();
    }
});
