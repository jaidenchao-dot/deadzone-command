'use strict';
// Spatial grid queries and fog of war / enemy intel memory
defineGameMethods({
    isWorldPointVisible(x, y) {
        const tc = Math.floor(x / TILE_SIZE);
        const tr = Math.floor(y / TILE_SIZE);
        return !!(this.fog[tr] && this.fog[tr][tc] === 2);
    },

    // ========================================================================
    // UPDATE 4: SPATIAL GRID (performance for the 10x infestation)
    // ========================================================================
    buildSpatialGrid() {
        const cols = GRID_COLS, rows = GRID_ROWS;
        if (this.gridCells && this.gridCells.length !== cols * rows) { this.gridCells = null; this._usedCells = null; } // world size changed
        if (!this.gridCells) {
            this._usedCells = null;
            this.gridCells = [];
            for (let i = 0; i < cols * rows; i++) this.gridCells.push([]);
            this.entityById = new Map();
        }
        // Update 7: only clear the cells used last frame (the infinite map's hash has 65k cells)
        if (this._usedCells) { for (const ci of this._usedCells) this.gridCells[ci].length = 0; this._usedCells.length = 0; }
        else for (let i = 0; i < this.gridCells.length; i++) this.gridCells[i].length = 0;
        const used = this._usedCells || (this._usedCells = []);
        this.entityById.clear();
        let zc = 0;
        for (const e of this.entities) {
            this.entityById.set(e.id, e);
            if (e.category === 'zombie') zc++;
            let cx, cy;
            if (GRID_WRAP) {
                cx = ((Math.floor(e.x / GRID_CELL) % cols) + cols) % cols;
                cy = ((Math.floor(e.y / GRID_CELL) % rows) + rows) % rows;
            } else {
                cx = Math.max(0, Math.min(cols - 1, Math.floor(e.x / GRID_CELL)));
                cy = Math.max(0, Math.min(rows - 1, Math.floor(e.y / GRID_CELL)));
            }
            const cell = this.gridCells[cy * cols + cx];
            if (cell.length === 0) used.push(cy * cols + cx);
            cell.push(e);
        }
        this.zombieCount = zc;
        this.gridBuilt = true;
        this.frameStamp = (this.frameStamp || 0) + 1;
    },

    // Visit every live entity whose grid cell overlaps the circle (callers still do exact distance checks)
    forEachInRadius(x, y, r, fn) {
        if (!this.gridBuilt) {
            for (const e of this.entities) fn(e);
            return;
        }
        if (GRID_WRAP) {
            // Update 7 (infinite map): toroidal spatial hash — cells alias every 32k px, so filter by bounding box
            const c0 = Math.floor((x - r) / GRID_CELL), c1 = Math.floor((x + r) / GRID_CELL);
            const r0 = Math.floor((y - r) / GRID_CELL), r1 = Math.floor((y + r) / GRID_CELL);
            const lim = r + GRID_CELL;
            for (let cy = r0; cy <= r1; cy++) {
                const wy = ((cy % GRID_ROWS) + GRID_ROWS) % GRID_ROWS;
                for (let cx = c0; cx <= c1; cx++) {
                    const wx = ((cx % GRID_COLS) + GRID_COLS) % GRID_COLS;
                    const cell = this.gridCells[wy * GRID_COLS + wx];
                    for (let i = 0; i < cell.length; i++) {
                        const e = cell[i];
                        if (!e._removed && Math.abs(e.x - x) <= lim && Math.abs(e.y - y) <= lim) fn(e);
                    }
                }
            }
            return;
        }
        const c0 = Math.max(0, Math.floor((x - r) / GRID_CELL)), c1 = Math.min(GRID_COLS - 1, Math.floor((x + r) / GRID_CELL));
        const r0 = Math.max(0, Math.floor((y - r) / GRID_CELL)), r1 = Math.min(GRID_ROWS - 1, Math.floor((y + r) / GRID_CELL));
        for (let cy = r0; cy <= r1; cy++) {
            for (let cx = c0; cx <= c1; cx++) {
                const cell = this.gridCells[cy * GRID_COLS + cx];
                for (let i = 0; i < cell.length; i++) {
                    const e = cell[i];
                    if (!e._removed) fn(e);
                }
            }
        }
    },

    getHqOrAnyPlayer() {
        if (!this._hqCache || this._hqCache._removed || this._hqCacheFrame !== this.frameStamp) {
            this._hqCache = this.entities.find(e => e.faction === 'player' && e.type === 'hq') ||
                            this.entities.find(e => e.faction === 'player') || null;
            this._hqCacheFrame = this.frameStamp;
        }
        return this._hqCache;
    },

    getEntityById(id) {
        if (id === null || id === undefined) return null;
        const e = this.entityById ? this.entityById.get(id) : null;
        if (e) return e._removed ? null : e;
        // Created after this frame's grid rebuild (rare): fall back to a scan
        const f = this.entities.find(x => x.id === id);
        return f || null;
    },

    updateFogOfWar() {
        if (this.infinite) return this.updateFogOfWarInfinite();
        for (let r = 0; r < MAP_ROWS; r++) {
            for (let c = 0; c < MAP_COLS; c++) {
                if (this.fog[r][c] === 2) this.fog[r][c] = 1;
            }
        }

        for (const ent of this.entities) {
            if (ent.faction !== 'player' || !ent.vision) continue;
            const c0 = Math.floor(ent.x / TILE_SIZE);
            const r0 = Math.floor(ent.y / TILE_SIZE);
            const tileRad = Math.ceil(ent.vision / TILE_SIZE);

            for (let r = Math.max(0, r0 - tileRad); r <= Math.min(MAP_ROWS - 1, r0 + tileRad); r++) {
                for (let c = Math.max(0, c0 - tileRad); c <= Math.min(MAP_COLS - 1, c0 + tileRad); c++) {
                    const wx = (c + 0.5) * TILE_SIZE;
                    const wy = (r + 0.5) * TILE_SIZE;
                    if (Math.hypot(wx - ent.x, wy - ent.y) <= ent.vision) {
                        this.fog[r][c] = 2;
                    }
                }
            }
        }
        this.refreshEnemyIntel();
    },

    // ========================================================================
    // UPDATE 3: FOG-OF-WAR INFORMATION SYSTEM
    // ========================================================================
    // Static things remembered under grey fog: buildings, shelters, crates and parked abandoned vehicles
    isMemoryEntity(e) {
        return FOG_MEMORY_CATEGORIES.has(e.category) || (e.abandoned === true && e.faction === 'neutral');
    },

    isEntityVisible(ent) {
        if (!ent) return false;
        if (ent.faction === 'player') return true;
        if (this.isWorldPointVisible(ent.x, ent.y)) return true;
        const r = ent.radius || 0;
        if (r > 20) {
            const o = r * 0.6;
            return this.isWorldPointVisible(ent.x + o, ent.y) || this.isWorldPointVisible(ent.x - o, ent.y) ||
                   this.isWorldPointVisible(ent.x, ent.y + o) || this.isWorldPointVisible(ent.x, ent.y - o);
        }
        return false;
    },

    // Records what the player has actually SEEN. Structures keep their last-sighted state in grey fog;
    // memories of structures that no longer exist are cleared only when the spot is seen again.
    refreshEnemyIntel() {
        const liveIds = new Set();
        for (const e of this.entities) {
            if (!this.isMemoryEntity(e)) continue;
            liveIds.add(e.id);
            if (this.isEntityVisible(e)) {
                const snap = Object.assign({}, e);
                snap.isGhost = true;
                snap.muzzleFlash = 0;
                this.knownStructures.set(e.id, snap);
            }
        }
        for (const [id, snap] of this.knownStructures) {
            if (!liveIds.has(id) && this.isEntityVisible(snap)) this.knownStructures.delete(id);
        }
        // Commandeered vehicles are live player units now — drop their old memory
        for (const e of this.entities) {
            if (e.faction === 'player' && this.knownStructures.has(e.id)) this.knownStructures.delete(e.id);
        }
        // Bandit camp status is only updated when the stronghold's site is in view
        for (const camp of this.mercCamps) {
            if (camp.knownAlive === undefined) camp.knownAlive = true;
            if (this.isWorldPointVisible(camp.x, camp.y)) camp.knownAlive = camp.alive;
        }
        // Blood, craters and acid stains appear only once the spot is seen
        for (const d of this.decals) {
            if (!d.revealed && this.isWorldPointVisible(d.x, d.y)) d.revealed = true;
        }
        // Non-player selections are dropped as soon as they leave live vision
        let dropped = false;
        for (const id of [...this.selectedIds]) {
            const e = this.entities.find(x => x.id === id);
            if (e && e.faction !== 'player' && e.category !== 'depot' && !this.isEntityVisible(e)) {
                this.selectedIds.delete(id);
                dropped = true;
            }
        }
        if (dropped) this.updateSelectionUI();
    }
});
