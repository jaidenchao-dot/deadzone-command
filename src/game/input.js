'use strict';
// Mouse & keyboard bindings, camera panning, pause
defineGameMethods({
    // ========================================================================
    // 5. INPUT HANDLING & CAMERA CONTROLS
    // ========================================================================
    bindEvents() {
        const c = this.canvas;

        document.getElementById('btn-deploy').addEventListener('click', () => this.onDeployClicked());
        document.getElementById('btn-resume').addEventListener('click', () => this.closeHome());
        document.getElementById('btn-saveload').addEventListener('click', () => this.openHome('saves'));
        document.querySelectorAll('.home-tab').forEach(t => t.addEventListener('click', () => this.showHomeTab(t.dataset.tab)));
        const bindSet = (id, key, isBool, parse) => {
            const el = document.getElementById(id);
            el.addEventListener('change', () => {
                this.settings[key] = isBool ? el.checked : (parse ? parse(el.value) : el.value);
                this.saveSettings();
                this.refreshSettingsUI();
                sfx.playRadioAck('select');
                if (this.running && (key === 'density')) this.setHomeNote('Zombie density applies to your next deployment.');
            });
        };
        bindSet('set-difficulty', 'difficulty', false);
        bindSet('set-density', 'density', false, v => +v);
        bindSet('set-ammo', 'ammo', true);
        bindSet('set-hunger', 'hunger', true);
        bindSet('set-fuel', 'fuel', true);
        bindSet('set-infinite', 'infiniteStart', true);
        bindSet('set-autosave', 'autosave', true);
        bindSet('set-inf-render', 'infRender', false, v => +v);
        bindSet('set-inf-load', 'infLoad', false, v => +v);
        document.querySelectorAll('.mode-btn').forEach(b => b.addEventListener('click', () => {
            this.settings.worldMode = b.dataset.mode;
            this.saveSettings();
            sfx.playRadioAck('select');
            this.refreshModeUI();
            this.refreshHomeButtons();
            this.setHomeNote(b.dataset.mode === 'infinite'
                ? '∞ INFINITE MAP selected — an endless procedurally generated sprawl in the chosen city style. Applies to your next NEW GAME.'
                : 'STANDARD CAMPAIGN selected. Applies to your next NEW GAME.');
        }));
        document.getElementById('btn-set-default').addEventListener('click', () => {
            const keepMap = this.settings.mapId;
            this.settings = Object.assign({}, DEFAULT_SETTINGS, { mapId: keepMap });
            this.saveSettings();
            this.refreshSettingsUI();
            this.setHomeNote('Settings restored to the default mode (Standard).');
        });
        document.getElementById('btn-export-save').addEventListener('click', () => this.exportSaveFile());
        document.getElementById('btn-import-save').addEventListener('click', () => document.getElementById('import-save-file').click());
        document.getElementById('import-save-file').addEventListener('change', (ev) => {
            const f = ev.target.files && ev.target.files[0];
            if (!f) return;
            const rd = new FileReader();
            rd.onload = () => { this.importSaveText(String(rd.result)); ev.target.value = ''; };
            rd.onerror = () => this.setHomeNote('⚠ COULD NOT READ THAT FILE.');
            rd.readAsText(f);
        });
        this.buildMapCards();
        this.refreshSettingsUI();
        this.renderSaveSlots();
        this.refreshCityText();

        document.getElementById('btn-restart').addEventListener('click', () => {
            document.getElementById('end-modal').style.display = 'none';
            this.startNewGame();
            this.homeOpen = false;
        });

        document.getElementById('btn-help').addEventListener('click', () => this.openHome('briefing'));

        document.getElementById('btn-mute').addEventListener('click', (e) => {
            sfx.muted = !sfx.muted;
            e.target.textContent = sfx.muted ? 'SFX: OFF' : 'SFX: ON';
        });

        document.getElementById('btn-zoom-in').addEventListener('click', () => this.setZoom(this.cam.zoom + 0.15));
        document.getElementById('btn-zoom-out').addEventListener('click', () => this.setZoom(this.cam.zoom - 0.15));
        document.getElementById('btn-rotate').addEventListener('click', () => this.rotatePlacement());
        document.getElementById('btn-pause').addEventListener('click', () => this.togglePause());
        document.getElementById('btn-center-hq').addEventListener('click', () => this.centerOnHQ());
        document.getElementById('btn-intel').addEventListener('click', () => this.toggleIntel());
        document.getElementById('btn-infinite').addEventListener('click', () => this.toggleInfiniteResources());
        document.getElementById('btn-xfer-go').addEventListener('click', () => this.executeTransferFromModal());
        document.getElementById('btn-xfer-cancel').addEventListener('click', () => {
            document.getElementById('transfer-modal').style.display = 'none';
            this.transferPair = null;
        });

        document.getElementById('btn-create-group').addEventListener('click', () => {
            const mobile = this.getSelectedMobileForces();
            if (mobile.length === 0) {
                this.showRadio('SELECT UNITS OR VEHICLES FIRST TO CREATE A SQUAD GROUP.');
                return;
            }
            for (let g = 1; g <= 6; g++) {
                if (this.controlGroups[g].length === 0) {
                    this.assignControlGroup(g, true);
                    return;
                }
            }
            this.assignControlGroup(1, true);
        });

        document.querySelectorAll('.form-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setFormation(btn.dataset.formation));
        });

        c.addEventListener('contextmenu', (e) => e.preventDefault());

        c.addEventListener('mousedown', (e) => {
            if (!this.running || this.gameOver) return;
            sfx.init();
            const rect = c.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            const wp = this.screenToWorld(sx, sy);

            if (e.button === 0) {
                if (this.targetingMode) {
                    this.executeTargetingClick(wp.x, wp.y);
                    return;
                }
                if (this.buildPlacementType) {
                    if (this.buildPlacementType === 'wall' || this.buildPlacementType === 'gate') {
                        this.isDragBuilding = true;
                        this.dragBuildStart = {
                            x: Math.floor(wp.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2,
                            y: Math.floor(wp.y / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2
                        };
                        this.updateDragBuildLine(wp.x, wp.y);
                    } else {
                        this.tryPlaceBuilding(wp.x, wp.y);
                    }
                    return;
                }
                this.isDragging = true;
                this.dragStart = { x: sx, y: sy };
                this.dragEnd = { x: sx, y: sy };
            } else if (e.button === 1) {
                e.preventDefault();
                this.isPanningMiddle = true;
                this.lastPanMouse = { x: e.clientX, y: e.clientY };
            } else if (e.button === 2) {
                if (this.targetingMode) {
                    this.targetingMode = null;
                    this.showRadio('TARGETING CANCELLED.');
                    this.updateCommandGrid();
                    return;
                }
                if (this.buildPlacementType || this.isDragBuilding) {
                    this.buildPlacementType = null;
                    this.isDragBuilding = false;
                    this.dragBuildTiles = [];
                    this.updateRotateButtonUI();
                    this.updateCommandGrid();
                    return;
                }
                this.issueRightClickOrder(wp.x, wp.y);
            }
        });

        c.addEventListener('wheel', (e) => {
            if (!this.running) return;
            e.preventDefault();
            const rect = c.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            const delta = e.deltaY < 0 ? 0.1 : -0.1;
            this.setZoom(this.cam.zoom + delta, sx, sy);
        }, { passive: false });

        window.addEventListener('mousemove', (e) => {
            const rect = c.getBoundingClientRect();
            this.mouseScreen.x = e.clientX - rect.left;
            this.mouseScreen.y = e.clientY - rect.top;
            const wp = this.screenToWorld(this.mouseScreen.x, this.mouseScreen.y);
            this.mouseWorld.x = wp.x;
            this.mouseWorld.y = wp.y;

            if (this.isPanningMiddle) {
                const z = this.cam.zoom || 1.0;
                const dx = (e.clientX - this.lastPanMouse.x) / z;
                const dy = (e.clientY - this.lastPanMouse.y) / z;
                this.lastPanMouse = { x: e.clientX, y: e.clientY };
                const viewW = this.canvas.width / z;
                const viewH = this.canvas.height / z;
                this.cam.x = Math.max(0, Math.min(Math.max(0, MAP_WIDTH - viewW), this.cam.x - dx));
                this.cam.y = Math.max(0, Math.min(Math.max(0, MAP_HEIGHT - viewH), this.cam.y - dy));
            }

            if (this.isDragBuilding) {
                this.updateDragBuildLine(this.mouseWorld.x, this.mouseWorld.y);
            }

            if (this.isDragging) {
                this.dragEnd.x = this.mouseScreen.x;
                this.dragEnd.y = this.mouseScreen.y;
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 1) this.isPanningMiddle = false;
            if (e.button === 0 && this.isDragBuilding) {
                this.commitDragBuildLine();
                this.isDragBuilding = false;
                this.dragBuildTiles = [];
            }
            if (e.button === 0 && this.isDragging) {
                this.isDragging = false;
                this.finishBoxSelection(e.shiftKey);
            }
        });

        // Interactive Radar Minimap Click & Drag
        let minimapDragging = false;
        const handleMinimapNav = (e, isRight = false) => {
            const rect = this.minimap.getBoundingClientRect();
            const mx = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
            const my = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
            const MF = this.minimapFrame();
            const wx = MF.ox + (mx / rect.width) * MF.W;
            const wy = MF.oy + (my / rect.height) * MF.H;

            if (isRight) {
                this.issueRightClickOrder(wx, wy);
                return;
            }
            if (this.targetingMode) {
                this.executeTargetingClick(wx, wy);
                return;
            }
            this.panCameraToWorld(wx, wy);
        };

        this.minimap.addEventListener('contextmenu', (e) => e.preventDefault());
        this.minimap.addEventListener('mousedown', (e) => {
            if (!this.running) return;
            if (e.button === 2) {
                handleMinimapNav(e, true);
            } else if (e.button === 0) {
                minimapDragging = true;
                handleMinimapNav(e, false);
            }
        });
        window.addEventListener('mousemove', (e) => {
            if (minimapDragging) handleMinimapNav(e, false);
        });
        window.addEventListener('mouseup', () => { minimapDragging = false; });

        // Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            // Update 5: typing in menus/forms (transfer amounts, save names) must not trigger game hotkeys
            const tag = e.target && e.target.tagName;
            if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
            // the home screen / save menu is open: Escape resumes, other game hotkeys are ignored
            if (this.homeOpen) {
                if (e.code === 'Escape' && this.gameInProgress()) this.closeHome();
                return;
            }
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
                e.preventDefault();
            }
            // Update 6: W/A/S/D are reserved exclusively for movement — they never reach any command, ability or UI hotkey
            if (WASD_CODES.has(e.code)) {
                if (!e.ctrlKey && !e.metaKey && !e.altKey) this.keys[e.code] = true;
                return;
            }
            this.keys[e.code] = true;
            if (!this.running || this.gameOver) return;

            if (e.code === 'Space') {
                this.togglePause();
                return;
            } else if (e.code === 'Equal' || e.code === 'NumpadAdd') {
                this.setZoom(this.cam.zoom + 0.1);
            } else if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
                this.setZoom(this.cam.zoom - 0.1);
            } else if (e.code === 'Home') {
                this.centerOnHQ();
            } else if (e.code === 'Escape') {
                this.buildPlacementType = null;
                this.isDragBuilding = false;
                this.dragBuildTiles = [];
                this.targetingMode = null;
                this.updateRotateButtonUI();
                this.updateCommandGrid();
            } else if (e.code === 'KeyJ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                this.toggleIntel();
            } else if (e.key.toUpperCase() === 'R' && this.buildPlacementType) {
                this.rotatePlacement();
                return;
            } else if (e.code === 'F1') {
                e.preventDefault();
                this.setFormation('line');
            } else if (e.code === 'F2') {
                e.preventDefault();
                this.setFormation('wedge');
            } else if (e.code === 'F3') {
                e.preventDefault();
                this.setFormation('column');
            } else if (e.code === 'F4') {
                e.preventDefault();
                this.setFormation('perimeter');
            } else if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].includes(e.code)) {
                const grp = parseInt(e.code.replace('Digit', ''), 10);
                if (e.ctrlKey || e.metaKey) {
                    this.assignControlGroup(grp, true);
                } else {
                    this.selectControlGroup(grp);
                }
            } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                const keyChar = e.key.toUpperCase();
                const btn = document.querySelector(`.cmd-btn[data-hotkey="${keyChar}"]:not(.disabled)`);
                if (btn) btn.click();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
        // releasing focus (alt-tab, clicking into a menu field) must never leave the camera scrolling
        window.addEventListener('blur', () => { WASD_CODES.forEach(k => { this.keys[k] = false; }); });
        document.addEventListener('focusin', (e) => {
            const t = e.target && e.target.tagName;
            if (t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA') WASD_CODES.forEach(k => { this.keys[k] = false; });
        });
    },

    panCameraToWorld(wx, wy) {
        const z = this.cam.zoom || 1.0;
        const viewW = (this.canvas.width || window.innerWidth) / z;
        const viewH = (this.canvas.height || (window.innerHeight - 246)) / z;
        this.cam.x = Math.max(0, Math.min(Math.max(0, MAP_WIDTH - viewW), wx - viewW / 2));
        this.cam.y = Math.max(0, Math.min(Math.max(0, MAP_HEIGHT - viewH), wy - viewH / 2));
    },

    // ========================================================================
    // 6. TACTICAL PAUSE, SQUAD GROUPS & SCALABLE FORMATIONS
    // ========================================================================
    togglePause() {
        if (!this.running || this.gameOver) return;
        this.paused = !this.paused;
        const btn = document.getElementById('btn-pause');
        const banner = document.getElementById('pause-banner');
        if (this.paused) {
            btn.classList.add('active-pause');
            btn.textContent = 'RESUME [SPACE]';
            banner.style.display = 'block';
            sfx.playRadioAck('select');
        } else {
            btn.classList.remove('active-pause');
            btn.textContent = 'PAUSE [SPACE]';
            banner.style.display = 'none';
            sfx.playRadioAck('confirm');
        }
    }
});
