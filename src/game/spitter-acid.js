'use strict';
// Spitter acid globs (arc, accuracy, direct hits) and poison puddles
defineGameMethods({
    // ========================================================================
    // UPDATE 6: SPITTER ACID GLOBS & POISON PUDDLES
    // ========================================================================
    isEntityMoving(t) {
        if (!t) return false;
        if (t.state === 'move' && t.targetPos) return true;
        if (t._movedAt !== undefined && this.elapsedTime - t._movedAt < 0.25) return true;
        return false;
    },

    fireAcidGlob(z, target) {
        const A = SPITTER_ACID;
        const d = Math.hypot(target.x - z.x, target.y - z.y);
        // aimed at where the target is NOW — the glob never steers after it leaves the spitter
        let hitChance = target.isAir ? A.airHit : A.baseHit - A.rangePenalty * Math.min(1, d / Math.max(1, z.range + (target.radius || 0)));
        if (this.isEntityMoving(target)) hitChance -= A.movingPenalty;
        let ex = target.x, ey = target.y;
        if (Math.random() > hitChance) {
            const ang = Math.random() * Math.PI * 2;
            const off = A.missMin + Math.random() * (A.missMax - A.missMin) + (target.radius || 0);
            ex += Math.cos(ang) * off;
            ey += Math.sin(ang) * off;
        }
        const flight = Math.max(A.minFlight, Math.min(A.maxFlight, Math.hypot(ex - z.x, ey - z.y) / A.speed));
        this.projectiles.push({
            acid: true,
            x: z.x, y: z.y, sx: z.x, sy: z.y, ex, ey,
            t: 0, T: flight,
            arcH: 16 + Math.min(70, d * 0.28),
            vx: (ex - z.x) / flight, vy: (ey - z.y) / flight,
            traveled: 0, maxDist: Infinity,
            faction: z.faction,
            damage: A.directDamage,
            splash: 0,
            weapon: 'acid',
            targetId: target.id,
            airTarget: !!target.isAir
        });
    },

    updateAcidGlob(p, dt) {
        p.t += dt;
        const k = Math.min(1, p.t / p.T);
        p.x = p.sx + (p.ex - p.sx) * k;
        p.y = p.sy + (p.ey - p.sy) * k;
        return k >= 1;
    },

    impactAcidGlob(p) {
        let hit = null;
        if (p.airTarget) {
            const t = this.getEntityById(p.targetId);
            if (t && t.isAir && Math.hypot(t.x - p.x, t.y - p.y) <= (t.radius || 20) + 6) hit = t;
        }
        if (!hit) {
            let hitD = Infinity;
            this.forEachInRadius(p.x, p.y, 8 + MAX_ENTITY_RADIUS, (ent) => {
                if (ent.isAir || !this.areHostile(p.faction, ent.faction)) return;
                const dd = Math.hypot(ent.x - p.x, ent.y - p.y);
                if (dd <= (ent.radius || 10) + 5 && dd < hitD) { hitD = dd; hit = ent; }
            });
        }
        if (hit) {
            // DIRECT HIT: heavy damage to that one target, no puddle
            this.damageEntity(hit, p.damage, p.faction);
            this.spawnImpactParticles(p.x, p.y, '#7ee787', 14);
            this.particles.push({ x: p.x, y: p.y, radius: 6, expandRate: 70, color: '#a6e22e', life: 0.3, maxLife: 0.3 });
            return;
        }
        // MISS: splash on the ground and leave a temporary poison puddle (not on rooftops / water)
        this.spawnImpactParticles(p.x, p.y, '#7ee787', 7);
        const tc = Math.floor(p.x / TILE_SIZE), tr = Math.floor(p.y / TILE_SIZE);
        if (!this.isTileOpen(tc, tr)) return;
        this.addAcidPuddle(p.x, p.y);
    },

    addAcidPuddle(x, y) {
        if (!this.acidPuddles) this.acidPuddles = [];
        const P = ACID_PUDDLE;
        // a glob landing in an existing puddle refreshes / widens it instead of stacking a new one
        for (const pd of this.acidPuddles) {
            if (Math.hypot(pd.x - x, pd.y - y) < pd.r * 0.8) {
                pd.life = P.life;
                pd.r = Math.min(P.maxRadius, pd.r + 3);
                return pd;
            }
        }
        if (this.acidPuddles.length >= P.maxCount) this.acidPuddles.shift();
        const pd = { x, y, r: P.radius, life: P.life, tick: P.tick * Math.random(), seed: Math.random() * 6.28 };
        this.acidPuddles.push(pd);
        return pd;
    },

    updateAcidPuddles(dt) {
        if (!this.acidPuddles || this.acidPuddles.length === 0) return;
        const P = ACID_PUDDLE;
        for (let i = this.acidPuddles.length - 1; i >= 0; i--) {
            const pd = this.acidPuddles[i];
            pd.life -= dt;
            if (pd.life <= 0) { this.acidPuddles.splice(i, 1); continue; }
            pd.tick -= dt;
            if (pd.tick > 0) continue;
            pd.tick += P.tick;
            const victims = [];
            this.forEachInRadius(pd.x, pd.y, pd.r + MAX_ENTITY_RADIUS, (e) => {
                if (e.isAir || e.hoistTimer > 0 || !this.areHostile('zombie', e.faction)) return;
                if (e.category !== 'unit' && e.category !== 'vehicle' && e.category !== 'merc' && e.category !== 'survivor') return;
                if (Math.hypot(e.x - pd.x, e.y - pd.y) > pd.r + (e.radius || 8) * 0.5) return;
                victims.push(e);
            });
            for (const e of victims) {
                this.damageEntity(e, e.category === 'vehicle' ? P.vehicleDmg : P.dmg, 'zombie');
                if (Math.random() < 0.35) this.particles.push({ x: e.x + (Math.random() - 0.5) * 8, y: e.y - 4, vy: -14, radius: 1.5, expandRate: 3, color: '#a6e22e', life: 0.4, maxLife: 0.4 });
            }
        }
    },

    renderAcidPuddles(ctx) {
        if (!this.acidPuddles) return;
        const now = performance.now() * 0.003;
        for (const pd of this.acidPuddles) {
            if (!this.isWorldPointVisible(pd.x, pd.y)) continue;
            const fade = Math.min(1, pd.life / 1.5);
            ctx.fillStyle = `rgba(66, 110, 30, ${0.38 * fade})`;
            ctx.beginPath();
            ctx.ellipse(pd.x, pd.y, pd.r, pd.r * 0.72, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `rgba(126, 231, 135, ${0.30 * fade})`;
            ctx.beginPath();
            ctx.ellipse(pd.x, pd.y, pd.r * 0.62, pd.r * 0.42, 0, 0, Math.PI * 2);
            ctx.fill();
            // bubbling pixels
            ctx.fillStyle = `rgba(195, 224, 74, ${0.75 * fade})`;
            for (let b = 0; b < 3; b++) {
                const a = pd.seed + b * 2.1 + now * (0.6 + b * 0.2);
                const rr = pd.r * 0.45 * ((Math.sin(now + b * 1.7 + pd.seed) + 1) / 2);
                ctx.fillRect(Math.round(pd.x + Math.cos(a) * rr) - 1, Math.round(pd.y + Math.sin(a) * rr * 0.7) - 1, 2, 2);
            }
        }
    }
});
