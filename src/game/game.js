// ============================================================================
// 4. MAIN TACTICAL RTS GAME ENGINE (NYC RECLAMATION)
// ============================================================================
class DeadzoneRTSGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.minimap = document.getElementById('minimap-canvas');
        this.mctx = this.minimap.getContext('2d');

        this.running = false;
        this.paused = false;
        this.gameOver = false;
        this.lastFrameTime = 0;

        this.terrain = [];
        this.blockedGrid = [];
        this.fog = [];
        this.cityStructures = [];
        this.cityProps = [];
        this.districts = [];

        this.entities = [];
        this.projectiles = [];
        this.particles = [];
        this.decals = [];
        this.pings = [];
        this.missiles = [];

        this.selectedIds = new Set();
        this.controlGroups = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
        this.activeFormation = 'line';

        this.cam = { x: 0, y: 0, zoom: 1.0 };
        this.keys = {};
        this.mouseScreen = { x: -1, y: -1 };
        this.mouseWorld = { x: 0, y: 0 };

        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.dragEnd = { x: 0, y: 0 };
        this.isPanningMiddle = false;
        this.lastPanMouse = { x: 0, y: 0 };

        this.buildPlacementType = null;
        this.placementRotation = 0;
        this.isDragBuilding = false;
        this.dragBuildStart = null;
        this.dragBuildTiles = [];
        this.targetingMode = null;

        this.lastClickTime = 0;
        this.lastClickedEntType = null;
        this.nextEntityId = 1;
        this.radioTimer = 0;
        this.districtCheckTimer = 0;

        // Economy & Progression
        this.scrap = 550;
        this.fuel = 200;
        this.popUsed = 0;
        this.popMax = 16;
        this.upgrades = { ballistics: false, armor: false };
        this.infiniteResources = false; // Update 4 (persists across redeployments)
        // Update 5: game settings / modes (persisted)
        this.settings = this.loadSettings();
        this.mapId = MAP_DEFS[this.settings.mapId] ? this.settings.mapId : 'manhattan';
        this.mapDef = MAP_DEFS[this.mapId];
        this.homeOpen = true;
        this.autosaveTimer = 0;

        this.surgeTimer = 90;
        this.surgeWave = 1;
        this.kills = 0;
        this.elapsedTime = 0;

        // Update 2: Survivors, Mercenaries & Intel
        this.resetFactionState();

        initSprites();
        this.bindEvents();
        this.resizeCanvas();
        this.renderControlGroupsBar();
        this.updateCommandGrid();

        if (window.ResizeObserver) {
            const ro = new ResizeObserver(() => this.resizeCanvas());
            ro.observe(document.getElementById('game-wrapper'));
        }
        window.addEventListener('resize', () => this.resizeCanvas());

        requestAnimationFrame((t) => this.loop(t));
    }

    resizeCanvas() {
        const wrapper = document.getElementById('game-wrapper');
        if (!wrapper) return;
        const rect = wrapper.getBoundingClientRect();
        const w = Math.floor(rect.width || wrapper.clientWidth || window.innerWidth);
        const h = Math.floor(rect.height || wrapper.clientHeight || (window.innerHeight - 246));

        if (w > 0 && h > 0 && (this.canvas.width !== w || this.canvas.height !== h)) {
            this.canvas.width = w;
            this.canvas.height = h;
            this.ctx.imageSmoothingEnabled = false;
        }
        if (this.minimap && (this.minimap.width !== 156 || this.minimap.height !== 156)) {
            this.minimap.width = 156;
            this.minimap.height = 156;
            this.mctx.imageSmoothingEnabled = false;
        }
    }

    screenToWorld(sx, sy) {
        const z = this.cam.zoom || 1.0;
        return {
            x: sx / z + this.cam.x,
            y: sy / z + this.cam.y
        };
    }

    setZoom(newZoom, anchorScreenX = null, anchorScreenY = null) {
        const oldZoom = this.cam.zoom || 1.0;
        const clamped = Math.max(0.5, Math.min(1.8, Math.round(newZoom * 10) / 10));
        if (clamped === oldZoom) return;

        const ax = anchorScreenX !== null ? anchorScreenX : this.canvas.width / 2;
        const ay = anchorScreenY !== null ? anchorScreenY : this.canvas.height / 2;
        const worldFocusX = ax / oldZoom + this.cam.x;
        const worldFocusY = ay / oldZoom + this.cam.y;

        this.cam.zoom = clamped;
        const viewW = this.canvas.width / clamped;
        const viewH = this.canvas.height / clamped;
        this.cam.x = Math.max(0, Math.min(Math.max(0, MAP_WIDTH - viewW), worldFocusX - ax / clamped));
        this.cam.y = Math.max(0, Math.min(Math.max(0, MAP_HEIGHT - viewH), worldFocusY - ay / clamped));

        const readout = document.getElementById('zoom-readout');
        if (readout) readout.textContent = `${clamped.toFixed(1)}x`;
    }

    rotatePlacement() {
        this.placementRotation = (this.placementRotation + 1) % 4;
        sfx.playRadioAck('select');
        this.updateRotateButtonUI();
    }

    updateRotateButtonUI() {
        const rotBtn = document.getElementById('btn-rotate');
        if (rotBtn) {
            rotBtn.style.display = this.buildPlacementType ? 'inline-block' : 'none';
            rotBtn.textContent = `ROTATE [R] (${this.placementRotation * 90}°)`;
        }
    }

    // Update 5: apply the chosen game settings / mode to a fresh deployment
    applyGameSettings() {
        // Update 7: standard campaign vs Infinite Map Mode (world size, spatial hash & alert grid follow the mode)
        this.infinite = this.settings.worldMode === 'infinite';
        setWorldDimensions(this.infinite);
        this.gridCells = null; this.gridBuilt = false;
        this.alertStr = null;
        this.navBlocked = null; this.navClear = null; this._navKey = null;
        const dens = [1, 5, 10].includes(+this.settings.density) ? +this.settings.density : 10;
        ZOMBIE_POP_MULT = dens;
        HIVE_POP_CAP = 130 * dens;
        this.mapId = MAP_DEFS[this.settings.mapId] ? this.settings.mapId : 'manhattan';
        this.mapDef = MAP_DEFS[this.mapId];
    }

    startNewGame() {
        sfx.init();
        this.applyGameSettings();
        this.autosaveTimer = 0;
        this.entities = [];
        this.projectiles = [];
        this.particles = [];
        this.decals = [];
        this.pings = [];
        this.missiles = [];
        this.selectedIds.clear();
        this.controlGroups = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

        this.scrap = Math.round(550 * this.diffMult('startRes'));
        this.fuel = Math.round(200 * this.diffMult('startRes'));
        this.savedScrap = this.scrap;
        this.savedFuel = this.fuel;
        if (this.settings.infiniteStart && !this.infiniteResources) {
            this.infiniteResources = true;
        }
        this.syncInfiniteUI();
        this.applyInfiniteResources();
        this.upgrades = { ballistics: false, armor: false };
        this.surgeTimer = 90;
        this.surgeWave = 1;
        this.kills = 0;
        this.elapsedTime = 0;
        this.resetFactionState();
        this.paused = false;
        this.gameOver = false;
        this.buildPlacementType = null;
        this.targetingMode = null;

        document.getElementById('btn-pause').classList.remove('active-pause');
        document.getElementById('pause-banner').style.display = 'none';
        this.updateRotateButtonUI();

        // Update 7: Infinite Map Mode builds its world chunk by chunk around the player instead
        if (this.infinite) { this.startInfiniteGame(); return; }

        this.generateNYCMap();

        // 1. Player Starting Base in Battery Park LZ (SW Manhattan)
        const hqX = 14 * TILE_SIZE;
        const hqY = 84 * TILE_SIZE;
        this.createBuilding('hq', hqX, hqY, true);

        // Pre-claimed Battery Pier Supply Depot for immediate passive income
        const alphaDepot = this.createSupplyDepot(21 * TILE_SIZE, 87 * TILE_SIZE, 16, 6);
        const alphaCol = this.createBuilding('collector', alphaDepot.x, alphaDepot.y, true);
        alphaCol.depotId = alphaDepot.id;
        alphaCol.scrapRate = alphaDepot.scrapRate;
        alphaCol.fuelRate = alphaDepot.fuelRate;
        alphaDepot.claimedBy = alphaCol.id;

        // Strategic Urban Supply Depots across NYC Districts
        this.createSupplyDepot(13 * TILE_SIZE, 67 * TILE_SIZE, 18, 7);   // SoHo ConEd Substation
        this.createSupplyDepot(38 * TILE_SIZE, 83 * TILE_SIZE, 20, 8);   // Wall St Plaza Depot
        this.createSupplyDepot(74 * TILE_SIZE, 82 * TILE_SIZE, 22, 9);   // South St Seaport Depot
        this.createSupplyDepot(62 * TILE_SIZE, 66 * TILE_SIZE, 22, 9);   // Lower East Side Depot
        this.createSupplyDepot(37 * TILE_SIZE, 48 * TILE_SIZE, 24, 10);  // Penn Station Fuel Cache
        this.createSupplyDepot(57 * TILE_SIZE, 30 * TILE_SIZE, 26, 12);  // Grand Central Depot
        this.createSupplyDepot(21 * TILE_SIZE, 14 * TILE_SIZE, 26, 12);  // Columbus Circle Depot
        this.createSupplyDepot(76 * TILE_SIZE, 14 * TILE_SIZE, 28, 14);  // Upper East Side Depot

        // Starting Tactical Strike Squad at Battery Park LZ
        const startUnits = [
            this.createUnit('engineer', hqX + 66, hqY + 18),
            this.createUnit('rifleman', hqX + 46, hqY - 46),
            this.createUnit('rifleman', hqX + 76, hqY - 40),
            this.createUnit('shotgunner', hqX + 94, hqY - 12),
            this.createVehicle('humvee', hqX + 114, hqY + 34),
            // Update 5: a starting supply truck so the logistics chain exists from minute one
            this.createVehicle('supplytruck', hqX + 70, hqY + 96)
        ];
        startUnits.forEach(u => this.selectedIds.add(u.id));
        this.assignControlGroup(1, false);

        // Abandoned Military Supply Crates in NYC Checkpoints & Triage Zones
        const crateCoords = [
            [23, 79], [31, 86], [54, 84], [81, 86],
            [17, 63], [36, 66], [56, 68], [78, 64],
            [18, 46], [37, 32], [56, 48], [77, 46],
            [35, 13], [56, 12], [80, 28]
        ];
        crateCoords.forEach(([c, r]) => {
            this.entities.push({
                id: this.nextEntityId++,
                category: 'crate',
                faction: 'neutral',
                type: 'crate',
                name: 'CEDA Emergency Supply Crate',
                x: c * TILE_SIZE,
                y: r * TILE_SIZE,
                radius: 12,
                scrapValue: 135,
                fuelValue: 45
            });
        });

        // 7 Mutated Hives (4 Distinct Archetypes integrated across NYC Districts)
        const hivePlacements = [
            { type: 'hive_subway',  c: 44, r: 83, label: 'Wall St Subway Breach Hive' },
            { type: 'hive_spore',   c: 81, r: 81, label: 'Liberty Spire Spore Hive' },
            { type: 'hive_subway',  c: 32, r: 65, label: 'Canal-Broadway Subway Hive' },
            { type: 'hive_foundry', c: 76, r: 65, label: 'Williamsburg Bridge Foundry Hive' },
            { type: 'hive_spore',   c: 36, r: 30, label: 'Times Square Spore Spire Hive' },
            { type: 'hive_foundry', c: 75, r: 32, label: 'Midtown East Foundry Hive' },
            { type: 'hive_apex',    c: 52, r: 12, label: 'Central Park Apex Overmind Hive' }
        ];
        hivePlacements.forEach((hp, i) => {
            const lbl = (this.mapDef && this.mapDef.hiveLabels && this.mapDef.hiveLabels[i]) || hp.label;
            this.createHive(hp.c * TILE_SIZE, hp.r * TILE_SIZE, hp.type, lbl);
        });

        // Heavy Urban Zombie Infestation occupying streets, intersections & buildings
        this.populateCityInfestation();

        // Update 2: Scarce survivor pockets & fortified mercenary territories
        this.populateSurvivorsAndMercs();

        // Update 4: a handful of abandoned civilian vehicles left on the streets
        this.placeAbandonedVehicles();

        // Update 4: 10x infestation fill (after camps/outposts exist so they aren't overrun at deployment)
        this.populateDenseInfestation();
        this.gridBuilt = false;
        this.buildSpatialGrid();
        this._navKey = null;
        this.buildNavGrid(true);

        this.running = true;
        this.resizeCanvas();
        this.centerOnHQ();
        this.updateFogOfWar();
        this.updateDistrictStates(true);
        this.recalcPopulation();
        this.updateSelectionUI();
        this.renderControlGroupsBar();
        this.showRadio(`OPERATION LIBERTY ONLINE — RETAKE ALL 6 ${this.mapDef.city} DISTRICTS & DESTROY 7 HIVES!`);
        this.refreshCityText();
        this.introRadioTimer = 4.5;
    }

    resetFactionState() {
        this.acidPuddles = [];
        this.mercCamps = [];
        this.outposts = [];
        this.survivorIntel = [];
        this.showIntel = true;
        this.rescued = { civilian: 0, medic: 0, mechanic: 0, militia: 0, enlisted: 0 };
        this.survivorsRescued = 0;
        this.survivorsLost = 0;
        this.mercKills = 0;
        this.intelTimer = 0;
        this.triageTimer = 1;
        this.lastSurvivorLossRadio = -99;
        this.introRadioTimer = 0;
        this._baseBlds = [];
        // Update 3: wave director, infection & fog-of-war memory
        this.waveGroups = [];
        this.nextWaveGroupId = 1;
        this.resetAlertGrid && this.alertCols !== undefined ? this.resetAlertGrid() : (this.alertStr = null);
        this.lastWaveTheme = null;
        this.lastInfectRadio = -99;
        this.knownStructures = new Map();
    }

    // Round floats so saves stay compact (positions to 0.1px, timers to 0.01s)
    static roundForSave(v) {
        if (typeof v === 'number') return Number.isInteger(v) ? v : (Number.isFinite(v) ? Math.round(v * 100) / 100 : 0);
        if (Array.isArray(v)) return v.map(DeadzoneRTSGame.roundForSave);
        if (v && typeof v === 'object') { const o = {}; for (const k in v) { if (k === 'nav' || k === 'path' && Array.isArray(v[k]) && v.pathI !== undefined) continue; if (v[k] !== undefined && typeof v[k] !== 'function') o[k] = DeadzoneRTSGame.roundForSave(v[k]); } return o; }
        return v;
    }

    centerOnHQ() {
        this.resizeCanvas();
        const hq = this.entities.find(e => e.category === 'building' && e.type === 'hq');
        if (hq) {
            this.panCameraToWorld(hq.x, hq.y);
        }
    }

    // ========================================================================
    // 9. SIMULATION UPDATE LOOP & DISTRICT RECLAMATION TRACKING
    // ========================================================================
    loop(timestamp) {
        // Schedule the next frame first so a single faulty frame can never permanently stop the game loop.
        requestAnimationFrame((t) => this.loop(t));
        const dt = Math.min(0.05, (timestamp - this.lastFrameTime) / 1000 || 0.016);
        this.lastFrameTime = timestamp;

        try {
            this.applyInfiniteResources();
            if (this.running) {
                this.updateCamera(dt);
                if (!this.paused && !this.gameOver && !this.homeOpen) {
                    this.updateSimulation(dt);
                }
            }
            // Update 5: audio listener follows the camera (distant fights are quieter)
            const lz = this.cam.zoom || 1;
            sfx.listener = { x: this.cam.x + this.canvas.width / (2 * lz), y: this.cam.y + this.canvas.height / (2 * lz), range: 1300 / Math.min(1, lz) };
            this.render();
            this.renderMinimap();
        } catch (err) {
            // Safety net only — errors are still reported to the console instead of silently freezing the game.
            console.error('[DEADZONE] Frame error:', err);
        }
    }

    updateCamera(dt) {
        const z = this.cam.zoom || 1.0;
        const camSpeed = (580 / z) * dt;
        // Update 6: WASD moves the camera exactly like the arrow keys (and does nothing else)
        if (this.keys['ArrowUp'] || this.keys['KeyW'] || (this.mouseScreen.y >= 0 && this.mouseScreen.y < 12)) this.cam.y -= camSpeed;
        if (this.keys['ArrowDown'] || this.keys['KeyS'] || (this.mouseScreen.y <= this.canvas.height && this.mouseScreen.y > this.canvas.height - 12)) this.cam.y += camSpeed;
        if (this.keys['ArrowLeft'] || this.keys['KeyA'] || (this.mouseScreen.x >= 0 && this.mouseScreen.x < 12)) this.cam.x -= camSpeed;
        if (this.keys['ArrowRight'] || this.keys['KeyD'] || (this.mouseScreen.x <= this.canvas.width && this.mouseScreen.x > this.canvas.width - 12)) this.cam.x += camSpeed;

        const viewW = this.canvas.width / z;
        const viewH = this.canvas.height / z;
        this.cam.x = Math.max(0, Math.min(Math.max(0, MAP_WIDTH - viewW), this.cam.x));
        this.cam.y = Math.max(0, Math.min(Math.max(0, MAP_HEIGHT - viewH), this.cam.y));
    }

    updateSimulation(dt) {
        this.elapsedTime += dt;

        // Update 5: periodic autosave (never touches the manual slots)
        if (this.settings.autosave && !this.gameOver) {
            this.autosaveTimer = (this.autosaveTimer || 0) + dt;
            if (this.autosaveTimer >= AUTOSAVE_INTERVAL) {
                this.autosaveTimer = 0;
                this.saveToSlot('auto', true);
            }
        }

        if (this.radioTimer > 0) {
            this.radioTimer -= dt;
            if (this.radioTimer <= 0) {
                document.getElementById('radio-banner').classList.remove('visible');
            }
        }

        // Update 4: spatial grid + id map for fast neighbour queries this frame
        this.buildSpatialGrid();
        // Update 6: path budget per frame & nav grid refresh when structures change
        this._navBudget = { player: 10, zombie: 4, other: 4 };
        this._navCheckT = (this._navCheckT || 0) - dt;
        if (this._navCheckT <= 0 || (!this.navBlocked && !this.infinite)) { this._navCheckT = 0.5; this.buildNavGrid(); }
        this.decayAlerts(dt);

        // City-Wide Zombie Surge Countdown
        this.surgeTimer -= dt;
        if (this.surgeTimer <= 0) {
            this.triggerZombieSurge();
            this.surgeWave++;
            this.surgeTimer = Math.max(50, 92 - this.surgeWave * 4);
        }

        // Survivor logistics (vehicle drop-offs at base, HQ triage)
        this.updateSurvivorLogistics(dt);

        // Update 7: Infinite Map chunk streaming / level-of-detail
        if (this.infinite) this.infiniteTick(dt);
        const dtFrame = dt;

        // Update Entities
        for (let i = this.entities.length - 1; i >= 0; i--) {
            const ent = this.entities[i];
            if (!ent) continue;
            // Update 7: outside the active bubble, enemies run a cheaper low-frequency update (or wait)
            let lodStep = false;
            if (this.infinite) { lodStep = this.infLodSkip(ent, dtFrame); if (lodStep === true) continue; }
            const dt = lodStep === 'step' ? ent._lodDt : dtFrame;

            if (ent.muzzleFlash > 0) ent.muzzleFlash = Math.max(0, ent.muzzleFlash - dt);
            if (ent.cooldown > 0) ent.cooldown = Math.max(0, ent.cooldown - dt);

            // Update 3: infection countdown — infected humans turn when it runs out
            if (ent.infected) {
                ent.infectionTimer -= dt;
                if (ent.infectionTimer <= 0) {
                    this.transformInfected(ent);
                    continue;
                }
            }

            // Update 5: hunger for player troops, fuel for player vehicles
            if (ent.faction === 'player') {
                if (ent.category === 'unit' && this.updateHunger(ent, dt)) {
                    this.killEntity(ent, 'starve');
                    this.recalcPopulation();
                    continue;
                }
                if (ent.category === 'vehicle') {
                    this.updateVehicleFuel(ent, dt);
                    if (ent._removed) continue;
                }
            }

            if (ent.category === 'building') {
                this.updateBuilding(ent, dt);
            } else if (ent.category === 'unit' || ent.category === 'vehicle') {
                this.updateFriendlyMobile(ent, dt);
            } else if (ent.category === 'zombie') {
                this.updateZombie(ent, dt);
            } else if (ent.category === 'hive') {
                this.updateHive(ent, dt);
            } else if (ent.category === 'merc') {
                this.updateMerc(ent, dt);
            } else if (ent.category === 'mercstruct') {
                this.updateMercStructure(ent, dt);
            } else if (ent.category === 'survivor') {
                this.updateSurvivor(ent, dt);
            }
        }

        // Update 7: anything that wasn't driven this frame but still has momentum brakes to a halt
        for (const e of this.entities) {
            if ((e.vx || e.vy) && e._physFrame !== this.frameStamp) this.coastEntity(e, dt);
        }

        // Update 3: organized zombie wave groups (muster -> march -> assault)
        this.updateWaveGroups(dt);

        // Mercenary camps (reinforcements, alert state, discovery) & survivor intel
        this.updateMercCamps(dt);
        this.intelTimer -= dt;
        if (this.intelTimer <= 0) {
            this.intelTimer = 0.5;
            this.updateSurvivorIntel();
        }
        if (this.introRadioTimer > 0) {
            this.introRadioTimer -= dt;
            if (this.introRadioTimer <= 0) {
                this.showRadio(`📡 INTEL: ${this.survivorIntel.length} POSSIBLE SURVIVOR SIGNALS (CYAN, ESTIMATED) — BANDIT GANGS ALSO REPORTED IN THE CITY.`);
            }
        }

        // Update Projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            // Update 6: lobbed acid globs fly a fixed arc to a fixed point (no homing)
            if (p.acid) {
                if (this.updateAcidGlob(p, dt)) {
                    this.impactAcidGlob(p);
                    this.projectiles.splice(i, 1);
                }
                continue;
            }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.traveled += Math.hypot(p.vx * dt, p.vy * dt);

            if (p.traveled >= p.maxDist) {
                this.applyProjectileImpact(p);
                this.projectiles.splice(i, 1);
            }
        }

        // Update 6: poison puddles tick & expire
        this.updateAcidPuddles(dt);

        // Update Incoming Tactical Cruise Missiles
        for (let i = this.missiles.length - 1; i >= 0; i--) {
            const m = this.missiles[i];
            m.progress += dt / m.duration;
            if (m.progress >= 1.0) {
                this.detonateCruiseMissile(m.targetX, m.targetY);
                this.missiles.splice(i, 1);
            }
        }

        // Update Particles & Pings
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const pt = this.particles[i];
            pt.x += (pt.vx || 0) * dt;
            pt.y += (pt.vy || 0) * dt;
            if (pt.expandRate) pt.radius += pt.expandRate * dt;
            pt.life -= dt;
            if (pt.life <= 0) this.particles.splice(i, 1);
        }

        for (let i = this.pings.length - 1; i >= 0; i--) {
            this.pings[i].life -= dt;
            if (this.pings[i].life <= 0) this.pings.splice(i, 1);
        }

        this.districtCheckTimer -= dt;
        if (this.districtCheckTimer <= 0) {
            this.districtCheckTimer = 0.5;
            this.updateDistrictStates(false);
        }

        this.updateFogOfWar();
        this.recalcPopulation();
        this.updateHUDReadouts();
        this.checkWinLossConditions();
    }
}

// Methods for the game live in src/game/*.js; each file attaches them to the class with defineGameMethods().
// They are installed exactly like class methods (non-enumerable, strict mode), so behaviour is identical to the
// original single-file build.
function defineGameMethods(methods) {
    const descs = Object.getOwnPropertyDescriptors(methods);
    for (const key of Object.keys(descs)) {
        if (Object.prototype.hasOwnProperty.call(DeadzoneRTSGame.prototype, key)) throw new Error('Duplicate game method: ' + key);
        descs[key].enumerable = false;
    }
    Object.defineProperties(DeadzoneRTSGame.prototype, descs);
}
