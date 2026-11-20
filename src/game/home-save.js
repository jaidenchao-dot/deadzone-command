'use strict';
// Home screen (tabs, city maps, settings) and the save / load system
defineGameMethods({
    // ========================================================================
    // UPDATE 5: HOME SCREEN (CITY MAPS, SETTINGS, SAVED GAMES) & SAVE SYSTEM
    // ========================================================================
    openHome(tab) {
        this.homeOpen = true;
        this._pendingConfirm = null;
        document.getElementById('start-modal').style.display = 'flex';
        this.showHomeTab(tab || 'briefing');
        this.refreshHomeButtons();
        this.renderSaveSlots();
        this.setHomeNote('');
    },

    closeHome() {
        document.getElementById('start-modal').style.display = 'none';
        this.homeOpen = false;
        this._pendingConfirm = null;
    },

    showHomeTab(tab) {
        document.querySelectorAll('.home-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        document.querySelectorAll('.home-panel').forEach(p => { p.style.display = p.dataset.panel === tab ? '' : 'none'; });
        if (tab === 'saves') this.renderSaveSlots();
        if (tab === 'map') this.buildMapCards();
    },

    setHomeNote(t) { const n = document.getElementById('home-note'); if (n) n.textContent = t; },

    gameInProgress() { return this.running && !this.gameOver; },

    refreshHomeButtons() {
        const live = this.gameInProgress();
        document.getElementById('btn-resume').style.display = live ? '' : 'none';
        const md = MAP_DEFS[this.settings.mapId] || MAP_DEFS.manhattan;
        const infTag = this.settings.worldMode === 'infinite' ? '∞ ' : '';
        document.getElementById('btn-deploy').textContent = live ? `NEW GAME — ${infTag}${md.lz.toUpperCase()}` : `DEPLOY TO ${infTag}${md.lz.toUpperCase()}`;
    },

    onDeployClicked() {
        if (this.gameInProgress() && this._pendingConfirm !== 'newgame') {
            this._pendingConfirm = 'newgame';
            document.getElementById('btn-deploy').textContent = 'CONFIRM: ABANDON CURRENT GAME?';
            this.setHomeNote('Unsaved progress in the current game will be lost. Saved games are NOT affected. Click again to confirm.');
            return;
        }
        this._pendingConfirm = null;
        this.closeHome();
        this.startNewGame();
    },

    refreshCityText() {
        const md = this.running ? (this.mapDef || MAP_DEFS.manhattan) : (MAP_DEFS[this.settings.mapId] || MAP_DEFS.manhattan);
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.innerHTML = v; };
        set('brief-city', md.cityLong);
        set('brief-city-short', md.city);
        set('brief-hq', md.hqName);
        set('modal-sub', `OPERATION LIBERTY — ${md.cityLong.toUpperCase()} RECLAMATION RTS`);
        if (md.districts) {
            const names = ['battery', 'financial', 'soho', 'les', 'midtown', 'centralpark'].map(k => `<em>${md.districts[k][0].replace(/&/g, '&amp;')}</em>`);
            set('brief-districts', names.slice(0, 5).join(', ') + ', and ' + names[5]);
        } else {
            set('brief-districts', '<em>Battery Park LZ</em>, <em>Financial District</em>, <em>SoHo &amp; Village</em>, <em>Lower East Side</em>, <em>Midtown &amp; Times Sq</em>, and <em>Central Park North</em>');
        }
        const infMode = this.running ? !!this.infinite : this.settings.worldMode === 'infinite';
        document.title = `DEADZONE COMMAND — ${infMode ? '∞ Infinite ' : ''}${md.city === 'NYC' ? 'NYC' : md.cityLong} Reclamation Tactical RTS`;
        this.refreshHomeButtons();
    },

    // Small pixel preview of each city (drawn from the map's own palette & skyline mix)
    buildMapCards() {
        const wrap = document.getElementById('map-cards');
        if (!wrap) return;
        wrap.innerHTML = '';
        Object.values(MAP_DEFS).forEach(md => {
            const card = document.createElement('div');
            card.className = 'map-card' + (this.settings.mapId === md.id ? ' selected' : '');
            const cv = document.createElement('canvas');
            cv.width = 96; cv.height = 64;
            const cx = cv.getContext('2d');
            const ground = md.id === 'brooklyn' ? '#2a2420' : (md.id === 'chicago' ? '#1d232c' : '#1f2329');
            cx.fillStyle = ground; cx.fillRect(0, 0, 96, 64);
            cx.fillStyle = md.id === 'chicago' ? '#1d4f7a' : '#14385a';
            cx.fillRect(0, 0, 4, 64); cx.fillRect(92, 0, 4, 64); cx.fillRect(0, 61, 96, 3);
            cx.fillStyle = '#3a3f46';
            [8, 26, 46, 66, 86].forEach(c => cx.fillRect(c, 0, 2, 61));
            [5, 14, 25, 37, 50].forEach(r => cx.fillRect(4, r, 88, 2));
            cx.fillStyle = md.id === 'brooklyn' ? '#3e5a2c' : '#2f5a2a';
            cx.fillRect(29, 6, 16, 8); cx.fillRect(48, 6, 17, 8);
            let seed = md.id.length * 7919;
            const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
            for (let i = 0; i < 46; i++) {
                const x = 6 + Math.floor(rnd() * 84), y = 2 + Math.floor(rnd() * 56);
                const tall = md.heightMult * (0.5 + rnd());
                let col = tall > 1.1 ? '#2f4057' : (tall > 0.75 ? '#48525e' : '#634139');
                if (md.wallMix) col = mixHex(col, md.wallMix[0], md.wallMix[1]);
                cx.fillStyle = col;
                const w = 3 + Math.floor(rnd() * 3), h = 3 + Math.floor(rnd() * 2);
                cx.fillRect(x, y, w, h);
                if (tall > 1.1) { cx.fillStyle = 'rgba(0,0,0,0.45)'; cx.fillRect(x + w, y + 1, 1, h); }
            }
            cx.fillStyle = '#3fb950'; cx.fillRect(12, 52, 5, 4);
            card.appendChild(cv);
            const nm = document.createElement('div'); nm.className = 'mc-name'; nm.textContent = md.name + (md.id === 'manhattan' ? ' (Default)' : '');
            const sb = document.createElement('div'); sb.className = 'mc-sub'; sb.textContent = 'LZ: ' + md.lz;
            const ds = document.createElement('div'); ds.className = 'mc-desc'; ds.textContent = md.blurb;
            card.appendChild(nm); card.appendChild(sb); card.appendChild(ds);
            card.addEventListener('click', () => {
                this.settings.mapId = md.id;
                this.saveSettings();
                sfx.playRadioAck('select');
                this.buildMapCards();
                if (!this.running) this.refreshCityText(); else this.refreshHomeButtons();
                this.setHomeNote(this.gameInProgress() ? `${md.name.toUpperCase()} selected — it will be used for your next NEW GAME.` : `${md.name.toUpperCase()} selected.`);
            });
            wrap.appendChild(card);
        });
    },

    refreshModeUI() {
        const mode = this.settings.worldMode === 'infinite' ? 'infinite' : 'standard';
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
        const h = document.getElementById('mode-help');
        if (h) h.textContent = mode === 'infinite'
            ? '∞ Endless city generated around your forces as they explore. The chosen city sets the style. No final victory: expand, reclaim sectors and survive.'
            : 'The hand-built city: 6 districts, 7 hives. Reclaim them all to win.';
    },

    refreshSettingsUI() {
        const st = this.settings;
        const g = (id) => document.getElementById(id);
        if (!g('set-difficulty')) return;
        g('set-difficulty').value = DIFFICULTY_PRESETS[st.difficulty] ? st.difficulty : 'standard';
        g('set-density').value = String([1, 5, 10].includes(+st.density) ? +st.density : 10);
        g('set-ammo').checked = !!st.ammo;
        g('set-hunger').checked = !!st.hunger;
        g('set-fuel').checked = !!st.fuel;
        g('set-infinite').checked = !!st.infiniteStart;
        g('set-autosave').checked = !!st.autosave;
        if (g('set-inf-render')) g('set-inf-render').value = String(st.infRender || 2);
        if (g('set-inf-load')) g('set-inf-load').value = String(st.infLoad || 3);
        this.refreshModeUI();
        const help = { recruit: 'More starting resources, smaller waves, slower hunger & fuel use, fuller magazines.',
            standard: 'The intended balance. Recommended.', veteran: 'Fewer resources, bigger waves, faster hunger & fuel burn, smaller magazines.' };
        g('set-diff-help').textContent = help[g('set-difficulty').value];
    },

    // ---------- save system ----------
    saveKey(slot) { return 'deadzone_save_' + slot; },

    readSaveMeta(slot) {
        try {
            const raw = localStorage.getItem(this.saveKey(slot));
            if (!raw) return null;
            const obj = JSON.parse(raw);
            if (!obj || obj.v !== SAVE_VERSION || !obj.meta || !obj.data) return { corrupt: true };
            return obj.meta;
        } catch (e) { return { corrupt: true }; }
    },

    renderSaveSlots() {
        const wrap = document.getElementById('save-slots');
        if (!wrap) return;
        const live = this.gameInProgress();
        wrap.innerHTML = '';
        SAVE_SLOTS.forEach(slot => {
            const meta = this.readSaveMeta(slot);
            const row = document.createElement('div');
            row.className = 'save-slot';
            const nm = document.createElement('div'); nm.className = 'ss-name';
            nm.textContent = slot === 'auto' ? '⟳ AUTOSAVE' : 'SLOT ' + slot.slice(4);
            const mt = document.createElement('div');
            mt.className = 'ss-meta' + (meta && !meta.corrupt ? '' : ' empty');
            if (!meta) mt.textContent = '— empty —';
            else if (meta.corrupt) mt.textContent = '⚠ unreadable save (will be ignored)';
            else {
                const mins = Math.floor(meta.elapsed / 60), secs = Math.floor(meta.elapsed % 60);
                mt.textContent = `${meta.mapName} · Wave ${meta.wave} · ${meta.districts} districts · ${mins}:${String(secs).padStart(2, '0')} op time · ${meta.difficulty} — saved ${new Date(meta.savedAt).toLocaleString()}`;
            }
            row.appendChild(nm); row.appendChild(mt);
            const mk = (label, fn, dis, cls) => {
                const b = document.createElement('button'); b.textContent = label; b.disabled = !!dis; if (cls) b.className = cls;
                b.addEventListener('click', fn); row.appendChild(b); return b;
            };
            if (slot !== 'auto') {
                const confirmKey = 'save:' + slot;
                const pending = this._pendingConfirm === confirmKey;
                mk(pending ? 'OVERWRITE?' : 'SAVE', () => {
                    if (meta && !meta.corrupt && this._pendingConfirm !== confirmKey) {
                        this._pendingConfirm = confirmKey;
                        this.setHomeNote(`Slot ${slot.slice(4)} already holds a save — click OVERWRITE? to replace it.`);
                        this.renderSaveSlots();
                        return;
                    }
                    this._pendingConfirm = null;
                    this.saveToSlot(slot, false);
                }, !live, pending ? 'warn' : '');
            }
            mk('LOAD', () => {
                if (this.gameInProgress() && this._pendingConfirm !== 'load:' + slot) {
                    this._pendingConfirm = 'load:' + slot;
                    this.setHomeNote('Loading replaces the game in progress (unsaved progress is lost). Click LOAD? again to confirm.');
                    this.renderSaveSlots();
                    return;
                }
                this._pendingConfirm = null;
                this.loadFromSlot(slot);
            }, !meta || meta.corrupt, this._pendingConfirm === 'load:' + slot ? 'warn' : '').textContent = this._pendingConfirm === 'load:' + slot ? 'LOAD?' : 'LOAD';
            mk(this._pendingConfirm === 'del:' + slot ? 'DELETE?' : 'DELETE', () => {
                if (this._pendingConfirm !== 'del:' + slot) {
                    this._pendingConfirm = 'del:' + slot;
                    this.setHomeNote('Click DELETE? again to permanently erase this save.');
                    this.renderSaveSlots();
                    return;
                }
                this._pendingConfirm = null;
                try { localStorage.removeItem(this.saveKey(slot)); } catch (e) {}
                this.setHomeNote('Save deleted.');
                this.renderSaveSlots();
            }, !meta, this._pendingConfirm === 'del:' + slot ? 'warn' : '');
            wrap.appendChild(row);
        });
    },

    // Entities are grouped by kind; each group stores a template of the most common value for every field and
    // each entity stores only its differences. Lossless (after rounding), and ~5x smaller for the zombie horde.
    packEntities(list) {
        const groups = {};
        for (const e of list) {
            const k = e.category + '|' + e.type;
            (groups[k] = groups[k] || []).push(DeadzoneRTSGame.roundForSave(e));
        }
        const out = [];
        for (const [k, arr] of Object.entries(groups)) {
            const tpl = {};
            if (arr.length >= 4) {
                const keys = new Set();
                arr.forEach(o => Object.keys(o).forEach(x => keys.add(x)));
                for (const key of keys) {
                    const counts = new Map();
                    for (const o of arr) { if (!(key in o)) continue; const sv = JSON.stringify(o[key]); counts.set(sv, (counts.get(sv) || 0) + 1); }
                    let best = null, bc = 0;
                    counts.forEach((c, sv) => { if (c > bc) { bc = c; best = sv; } });
                    if (bc >= arr.length * 0.5) tpl[key] = JSON.parse(best);
                }
            }
            const tplS = {};
            for (const key in tpl) tplS[key] = JSON.stringify(tpl[key]);
            const items = arr.map(o => {
                const d = {};
                for (const key in o) if (!(key in tplS) || JSON.stringify(o[key]) !== tplS[key]) d[key] = o[key];
                for (const key in tpl) if (!(key in o)) (d.__del = d.__del || []).push(key);
                return d;
            });
            out.push({ k, tpl, items });
        }
        return out;
    },

    unpackEntities(packed) {
        const list = [];
        for (const grp of packed) {
            for (const d of grp.items) {
                const e = JSON.parse(JSON.stringify(grp.tpl));
                Object.assign(e, d);
                if (d.__del) { d.__del.forEach(key => delete e[key]); delete e.__del; }
                list.push(e);
            }
        }
        return list;
    },

    serializeGame() {
        // generic scalar/state capture (everything JSON-safe that isn't rebuilt from the map or transient)
        const skip = new Set(['canvas', 'ctx', 'minimap', 'mctx', 'terrain', 'blockedGrid', 'fog', 'cityStructures', 'cityProps',
            'navBlocked', 'navClear', '_navA', '_navBudget', '_navKey', 'navVersion', '_navCheckT',
            'chunks', 'chunkRT', 'activeChunks', 'renderChunks', '_loadQueue', '_fogVis', '_districtIndex', '_navLastRT', '_navLastK', '_infT', '_navDirty',
            'entities', 'projectiles', 'particles', 'pings', 'selectedIds', 'keys', 'mouseScreen', 'mouseWorld', 'isDragging', 'dragStart',
            'dragEnd', 'isPanningMiddle', 'lastPanMouse', 'buildPlacementType', 'placementRotation', 'isDragBuilding', 'dragBuildStart',
            'dragBuildTiles', 'targetingMode', 'lastClickTime', 'lastClickedEntType', 'gridBuilt', 'gridCells', 'entityById', 'lastGridSig',
            '_baseBlds', 'settings', 'running', 'paused', 'gameOver', 'lastFrameTime', 'knownStructures', 'alertStr', 'alertX', 'alertY',
            'alertRecruits', 'alertCols', 'alertRows', 'mapDef', 'homeOpen', '_pendingConfirm', 'frameStamp', 'radioTimer']);
        const state = {};
        for (const key of Object.keys(this)) {
            if (skip.has(key)) continue;
            const v = this[key];
            if (typeof v === 'function' || v === undefined) continue;
            if (v && typeof v === 'object' && (v instanceof Map || v instanceof Set || ArrayBuffer.isView(v) || v instanceof Node)) continue;
            state[key] = DeadzoneRTSGame.roundForSave(v);
        }
        const fogStr = this.infinite ? '' : this.fog.map(row => row.join('')).join('|');
        // Update 7: Infinite Map — explored chunks are saved as compact records (terrain itself is regenerated from the seed)
        let chunkRecs = null;
        if (this.infinite) {
            chunkRecs = [];
            for (const [k, rec] of this.chunks) {
                let fog = rec.fog;
                const rt = this.chunkRT.get(k);
                if (rt) {
                    let f = '';
                    for (let lr = 0; lr < INF_CHUNK; lr++) { const row = this.fog[rt.cy * INF_CHUNK + lr]; for (let lc = 0; lc < INF_CHUNK; lc++) f += (row && row[rt.cx * INF_CHUNK + lc] > 0) ? '1' : '0'; }
                    fog = f.indexOf('1') >= 0 ? f : null;
                }
                if (!rec.gen && !rec.frozen.length && !fog) continue;
                chunkRecs.push([rec.cx, rec.cy, rec.gen ? 1 : 0, fog, rec.frozen]);
            }
        }
        const alerts = [];
        if (this.alertStr) for (let i = 0; i < this.alertStr.length; i++) if (this.alertStr[i] > 0.05) alerts.push([i, Math.round(this.alertStr[i] * 100) / 100, Math.round(this.alertX[i]), Math.round(this.alertY[i]), this.alertRecruits[i]]);
        return {
            mapId: this.mapId,
            settings: Object.assign({}, this.settings),
            popMult: ZOMBIE_POP_MULT,
            state,
            entities: this.packEntities(this.entities),
            order: this.entities.map(e => e.id),
            known: [...this.knownStructures.entries()].map(([id, snap]) => [id, DeadzoneRTSGame.roundForSave(snap)]),
            fog: fogStr,
            infinite: !!this.infinite,
            infSeed: this.infSeed || 0,
            chunks: chunkRecs,
            alerts,
            selected: [...this.selectedIds]
        };
    },

    saveToSlot(slot, quiet) {
        if (!this.gameInProgress()) { if (!quiet) this.setHomeNote('No game in progress to save.'); return false; }
        let text;
        try {
            const data = this.serializeGame();
            const reclaimed = this.districts.filter(d => d.status === 'reclaimed').length;
            const meta = {
                savedAt: Date.now(), mapId: this.mapId, mapName: (this.infinite ? '∞ Infinite · ' : '') + (this.mapDef || MAP_DEFS.manhattan).name,
                wave: this.surgeWave, elapsed: Math.round(this.elapsedTime), districts: `${reclaimed}/${this.districts.length}`,
                difficulty: (this.settings.difficulty || 'standard').toUpperCase()
            };
            const body = JSON.stringify(data);
            text = JSON.stringify({ v: SAVE_VERSION, meta, len: body.length, data: body });
        } catch (err) {
            console.error('[DEADZONE] Save failed', err);
            if (!quiet) this.setHomeNote('⚠ SAVE FAILED — ' + err.message);
            return false;
        }
        try {
            // write, then read back & verify before reporting success (the previous save survives a failed write)
            localStorage.setItem(this.saveKey(slot), text);
            const back = localStorage.getItem(this.saveKey(slot));
            if (back !== text) throw new Error('verification mismatch');
        } catch (err) {
            console.error('[DEADZONE] Storage write failed', err);
            if (!quiet) this.setHomeNote('⚠ COULD NOT WRITE TO BROWSER STORAGE (' + (err.name || 'error') + '). Use EXPORT to save to a file instead.');
            else this.showRadio('⚠ AUTOSAVE FAILED — BROWSER STORAGE UNAVAILABLE. USE 💾 EXPORT.');
            return false;
        }
        if (quiet) this.showRadio('💾 AUTOSAVED.');
        else {
            sfx.playRadioAck('confirm');
            this.setHomeNote(`💾 GAME SAVED TO ${slot === 'auto' ? 'AUTOSAVE' : 'SLOT ' + slot.slice(4)} (${Math.round(text.length / 1024)} KB).`);
            this.showRadio(`💾 GAME SAVED — ${slot === 'auto' ? 'AUTOSAVE' : 'SLOT ' + slot.slice(4)}.`);
        }
        this.renderSaveSlots();
        return true;
    },

    parseSaveText(text) {
        const obj = JSON.parse(text);
        if (!obj || typeof obj !== 'object') throw new Error('not a save file');
        if (obj.v !== SAVE_VERSION) throw new Error('unsupported save version');
        if (typeof obj.data !== 'string' || obj.data.length !== obj.len) throw new Error('save data is incomplete or corrupted');
        const data = JSON.parse(obj.data);
        if (!data || !Array.isArray(data.entities) || !data.state || !MAP_DEFS[data.mapId]) throw new Error('save data is malformed');
        return { meta: obj.meta, data };
    },

    loadFromSlot(slot) {
        let raw = null;
        try { raw = localStorage.getItem(this.saveKey(slot)); } catch (e) { raw = null; }
        if (!raw) { this.setHomeNote('That slot is empty.'); return false; }
        return this.loadSaveText(raw, slot === 'auto' ? 'AUTOSAVE' : 'SLOT ' + slot.slice(4));
    },

    loadSaveText(text, label) {
        let parsed;
        try { parsed = this.parseSaveText(text); }
        catch (err) { this.setHomeNote('⚠ CANNOT LOAD: ' + err.message + '. Your current game was not changed.'); return false; }
        // keep a snapshot of the current game so a failure mid-restore can't leave a broken half-state
        const backup = this.gameInProgress() ? (() => { try { return JSON.parse(JSON.stringify(this.serializeGame())); } catch (e) { return null; } })() : null;
        try {
            this.restoreGame(parsed.data);
        } catch (err) {
            console.error('[DEADZONE] Load failed', err);
            if (backup) { try { this.restoreGame(backup); } catch (e2) { console.error(e2); } }
            this.setHomeNote('⚠ LOAD FAILED (' + err.message + '). ' + (backup ? 'Your previous game was restored.' : ''));
            return false;
        }
        this.closeHome();
        sfx.playRadioAck('confirm');
        this.showRadio(`💾 ${label} LOADED — ${this.mapDef.name.toUpperCase()}, WAVE ${this.surgeWave}. OPERATION RESUMED.`);
        return true;
    },

    restoreGame(data) {
        sfx.init();
        const entities = this.unpackEntities(data.entities);
        if (Array.isArray(data.order) && data.order.length === entities.length) {
            const rank = new Map(data.order.map((id, i) => [id, i]));
            entities.sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));
        }
        // settings travel with the save (map, density, logistics toggles, difficulty)
        this.settings = Object.assign({}, DEFAULT_SETTINGS, this.settings, data.settings || {});
        this.saveSettings();
        ZOMBIE_POP_MULT = data.popMult || (+this.settings.density) || 10;
        HIVE_POP_CAP = 130 * ZOMBIE_POP_MULT;
        this.mapId = data.mapId;
        this.mapDef = MAP_DEFS[this.mapId];
        // Update 7: rebuild the right kind of world (standard city or infinite chunk world)
        const inf = !!data.infinite;
        this.infinite = inf;
        setWorldDimensions(inf);
        this.gridCells = null; this.gridBuilt = false; this.alertStr = null;
        this.navBlocked = null; this.navClear = null; this._navKey = null;
        this.resetFactionState();
        if (inf) {
            this.infSeed = data.infSeed || 1;
            this.initInfiniteWorld();
            for (const [cx, cy, gen, fog, frozen] of (data.chunks || [])) this.chunks.set(this.chunkKey(cx, cy), { cx, cy, gen: !!gen, fog: fog || null, frozen: frozen || [] });
        } else {
            this.generateNYCMap();
        }
        // fog
        const rows = String(data.fog || '').split('|');
        if (!inf && rows.length === this.fog.length) {
            for (let r = 0; r < rows.length; r++) for (let c = 0; c < this.fog[r].length; c++) this.fog[r][c] = +(rows[r][c] || 0);
        }
        // scalar & array state
        for (const [key, v] of Object.entries(data.state)) this[key] = v;
        this.entities = entities;
        this.projectiles = [];
        this.particles = [];
        this.pings = [];
        this.decals = Array.isArray(this.decals) ? this.decals : [];
        this.missiles = Array.isArray(this.missiles) ? this.missiles : [];
        this.knownStructures = new Map((data.known || []).map(([id, snap]) => [id, snap]));
        this.resetAlertGrid();
        (data.alerts || []).forEach(([i, st, x, y, rc]) => { if (i < this.alertStr.length) { this.alertStr[i] = st; this.alertX[i] = x; this.alertY[i] = y; this.alertRecruits[i] = rc || 0; } });
        this._baseBlds = [];
        this.selectedIds.clear();
        (data.selected || []).forEach(id => { if (entities.some(e => e.id === id)) this.selectedIds.add(id); });
        this.buildPlacementType = null;
        this.targetingMode = null;
        this.paused = false;
        this.gameOver = false;
        this.running = true;
        document.getElementById('btn-pause').classList.remove('active-pause');
        document.getElementById('pause-banner').style.display = 'none';
        document.getElementById('end-modal').style.display = 'none';
        this.syncInfiniteUI();
        this.gridBuilt = false;
        this.buildSpatialGrid();
        if (inf) {
            this.infinite = true;
            this._districtIndex = new Map(this.districts.map(d => [d.id, d]));
            this.activeChunks = new Set(); this.renderChunks = new Set(); this._loadQueue = [];
            this.infiniteTick(0, true);
            this.buildSpatialGrid();
        }
        this._navKey = null;
        this.buildNavGrid(true);
        this.resizeCanvas();
        this.recalcPopulation();
        this.updateFogOfWar();
        this.updateDistrictStates(true);
        this.updateSelectionUI();
        this.renderControlGroupsBar();
        this.updateHUDReadouts();
        this.updateRotateButtonUI();
        this.refreshSettingsUI();
        this.refreshCityText();
        const ib = document.getElementById('btn-intel');
        if (ib) ib.textContent = this.showIntel ? '📡 INTEL [J]' : '📡 INTEL: OFF';
    },

    exportSaveFile() {
        if (!this.gameInProgress()) { this.setHomeNote('No game in progress to export.'); return; }
        try {
            const body = JSON.stringify(this.serializeGame());
            const reclaimed = this.districts.filter(d => d.status === 'reclaimed').length;
            const meta = { savedAt: Date.now(), mapId: this.mapId, mapName: (this.infinite ? '∞ Infinite · ' : '') + this.mapDef.name, wave: this.surgeWave, elapsed: Math.round(this.elapsedTime), districts: `${reclaimed}/${this.districts.length}`, difficulty: (this.settings.difficulty || 'standard').toUpperCase() };
            const text = JSON.stringify({ v: SAVE_VERSION, meta, len: body.length, data: body });
            const blob = new Blob([text], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `deadzone_${this.mapId}_wave${this.surgeWave}_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 2000);
            this.setHomeNote('⬇ SAVE FILE EXPORTED.');
        } catch (err) { this.setHomeNote('⚠ EXPORT FAILED — ' + err.message); }
    },

    importSaveText(text) { this.loadSaveText(text, 'IMPORTED SAVE'); },

    syncInfiniteUI() {
        const btn = document.getElementById('btn-infinite');
        if (!btn) return;
        btn.textContent = this.infiniteResources ? '∞ RESOURCES: ON' : '∞ RESOURCES: OFF';
        btn.classList.toggle('infinite-on', this.infiniteResources);
        const rs = document.querySelector('.res-scrap'), rf = document.querySelector('.res-fuel');
        if (rs) rs.classList.toggle('infinite', this.infiniteResources);
        if (rf) rf.classList.toggle('infinite', this.infiniteResources);
    },

    // Update 5: settings
    loadSettings() {
        let st = {};
        try { st = JSON.parse(localStorage.getItem('deadzone_settings') || '{}') || {}; } catch (e) { st = {}; }
        return Object.assign({}, DEFAULT_SETTINGS, st);
    },

    saveSettings() {
        try { localStorage.setItem('deadzone_settings', JSON.stringify(this.settings)); } catch (e) {}
    },

    diffMult(kind) {
        const preset = DIFFICULTY_PRESETS[(this.settings && this.settings.difficulty) || 'standard'] || DIFFICULTY_PRESETS.standard;
        return preset[kind] !== undefined ? preset[kind] : 1;
    }
});
