'use strict';
// Hive-mind alert grid (noise / sightings -> coordinated convergence)
defineGameMethods({
    // ========================================================================
    // UPDATE 5: HIVE-MIND ALERT GRID (shared target information for the whole infestation)
    // ========================================================================
    resetAlertGrid() {
        this.alertCols = this.infinite ? INF_ALERT_WRAP : Math.ceil(MAP_WIDTH / ALERT_CELL);
        this.alertRows = this.infinite ? INF_ALERT_WRAP : Math.ceil(MAP_HEIGHT / ALERT_CELL);
        const n = this.alertCols * this.alertRows;
        this.alertStr = new Float32Array(n);
        this.alertX = new Float32Array(n);
        this.alertY = new Float32Array(n);
        this.alertRecruits = new Uint16Array(n);
    },

    alertIndex(c, r) {
        if (this.infinite) {
            const W = this.alertCols;
            return (((r % W) + W) % W) * W + (((c % W) + W) % W);
        }
        c = Math.max(0, Math.min(this.alertCols - 1, c));
        r = Math.max(0, Math.min(this.alertRows - 1, r));
        return r * this.alertCols + c;
    },

    raiseAlert(x, y, amount) {
        if (!this.alertStr) this.resetAlertGrid();
        const i = this.alertIndex(Math.floor(x / ALERT_CELL), Math.floor(y / ALERT_CELL));
        const old = this.alertStr[i];
        this.alertStr[i] = Math.min(10, old + amount);
        const w = amount / (old + amount);
        this.alertX[i] = old > 0.05 ? this.alertX[i] + (x - this.alertX[i]) * w : x;
        this.alertY[i] = old > 0.05 ? this.alertY[i] + (y - this.alertY[i]) * w : y;
    },

    decayAlerts(dt) {
        if (!this.alertStr) this.resetAlertGrid();
        const hq = this.getHqEntity ? this.getHqEntity() : null;
        if (hq) { this._hqCellX = hq.x; this._hqCellY = hq.y; } else { this._hqCellX = undefined; }
        if (this.hqRecruits > 0) this.hqRecruits = Math.max(0, this.hqRecruits - dt / 6);
        const k = Math.exp(-dt / 6);
        for (let i = 0; i < this.alertStr.length; i++) {
            if (this.alertStr[i] > 0.01) this.alertStr[i] *= k; else this.alertStr[i] = 0;
            // once a disturbance dies down, its recruitment quota resets
            if (this.alertStr[i] < 0.3) this.alertRecruits[i] = 0;
        }
    },

    // Strongest audible alert near (x, y). Hearing range grows with alert strength but is always bounded,
    // so the infestation never 'knows' about forces it hasn't detected or heard.
    // Each alert cell only pulls a bounded number of zombies (quota grows with strength), so a firefight draws
    // a dangerous, coordinated pack - not the whole city.
    // The hive mind grows bolder as the outbreak escalates (small early, full strength by ~wave 10), and it is more
    // cautious about piling into the fortified LZ around the player's HQ.
    alertQuota(st, cell) {
        let q = (30 + 9 * st) * Math.min(1.5, Math.max(0.4, ZOMBIE_POP_MULT / 10 * 1.5));
        q *= Math.min(1, 0.25 + 0.075 * Math.max(0, (this.surgeWave || 1) - 1));
        return Math.max(4, Math.round(q * this.diffMult('wave')));
    },

    // Alerts inside the LZ (near the HQ) all draw from ONE shared, slowly refilling recruitment pool, so a firefight
    // at the base pulls a few extra packs — not every dormant zombie in hearing range.
    nearPlayerHq(x, y) { return this._hqCellX !== undefined && Math.hypot(x - this._hqCellX, y - this._hqCellY) < 900; },

    hqRecruitQuota() { return Math.max(3, Math.round((4 + 2.5 * ((this.surgeWave || 1) - 1)) * this.diffMult('wave'))); },

    findHiveAlert(x, y, maxHear = 750, minStr = 0.6, claim = true) {
        if (!this.alertStr) return null;
        const c0 = Math.floor(x / ALERT_CELL), r0 = Math.floor(y / ALERT_CELL);
        const span = Math.ceil(maxHear / ALERT_CELL);
        let best = null, bestScore = 0;
        const rLo = this.infinite ? r0 - span : Math.max(0, r0 - span), rHi = this.infinite ? r0 + span : Math.min(this.alertRows - 1, r0 + span);
        const cLo = this.infinite ? c0 - span : Math.max(0, c0 - span), cHi = this.infinite ? c0 + span : Math.min(this.alertCols - 1, c0 + span);
        for (let r = rLo; r <= rHi; r++) {
            for (let c = cLo; c <= cHi; c++) {
                const i = this.alertIndex(c, r);
                const st = this.alertStr[i];
                if (st < minStr) continue;
                const d = Math.hypot(this.alertX[i] - x, this.alertY[i] - y);
                const hear = Math.min(maxHear, 320 + 45 * st);
                if (d > hear) continue;
                if (claim && this.alertRecruits[i] >= this.alertQuota(st)) continue;
                if (claim && (this.hqRecruits || 0) >= this.hqRecruitQuota() && this.nearPlayerHq(this.alertX[i], this.alertY[i])) continue;
                const score = st / (1 + d / 400);
                if (score > bestScore) { bestScore = score; best = { x: this.alertX[i] + (Math.random() - 0.5) * 90, y: this.alertY[i] + (Math.random() - 0.5) * 90, cell: i }; }
            }
        }
        if (best && claim) {
            this.alertRecruits[best.cell]++;
            if (this.nearPlayerHq(best.x, best.y)) this.hqRecruits = (this.hqRecruits || 0) + 1;
        }
        return best;
    }
});
