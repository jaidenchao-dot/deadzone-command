'use strict';
// Main world renderer (terrain, structures, effects, overlays)
defineGameMethods({
    // ========================================================================
    // 11. PIXEL-ART CANVAS & RADAR MINIMAP RENDERING (NYC URBAN ENVIRONMENT)
    // ========================================================================
    render() {
        const ctx = this.ctx;
        const cw = this.canvas.width;
        const ch = this.canvas.height;
        if (!cw || !ch) return;

        // Reset any context state left over from an interrupted frame (transform, alpha, dashes).
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1.0;
        ctx.setLineDash([]);

        ctx.fillStyle = '#090c10';
        ctx.fillRect(0, 0, cw, ch);

        if (!this.terrain || this.terrain.length === 0 || !this.fog || this.fog.length === 0) return;

        const z = this.cam.zoom || 1.0;
        const viewW = cw / z;
        const viewH = ch / z;

        const startCol = Math.max(0, Math.floor(this.cam.x / TILE_SIZE));
        const endCol = Math.min(MAP_COLS - 1, Math.ceil((this.cam.x + viewW) / TILE_SIZE));
        const startRow = Math.max(0, Math.floor(this.cam.y / TILE_SIZE));
        const endRow = Math.min(MAP_ROWS - 1, Math.ceil((this.cam.y + viewH) / TILE_SIZE));

        ctx.save();
        ctx.scale(z, z);
        ctx.translate(-Math.floor(this.cam.x), -Math.floor(this.cam.y));

        // 1. Urban Terrain Layer + NYC Road Markings & Crosswalks
        for (let r = startRow; r <= endRow; r++) {
            const fRow = this.fog[r];
            if (!fRow) continue;
            for (let c = startCol; c <= endCol; c++) {
                if (!fRow[c]) continue;
                const tile = this.terrain[r][c];
                const px = c * TILE_SIZE;
                const py = r * TILE_SIZE;
                // Update 7: loaded chunks outside the render ring draw as flat low-detail ground
                if (this.infinite && !this.renderChunks.has(this.chunkKey(Math.floor(c / INF_CHUNK), Math.floor(r / INF_CHUNK)))) {
                    ctx.fillStyle = INF_LOWDETAIL[tile] || '#20252c';
                    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    continue;
                }
                const spr = SpriteBank['tile_' + tile];
                if (spr) ctx.drawImage(spr, px, py);

                if (tile === 'road') {
                    // Avenue centerlines & intersection crosswalk stripes
                    const isAvCenter = this.infinite ? (c % INF_CHUNK === 1) : (c === 9 || c === 27 || c === 47 || c === 67 || c === 87);
                    const isStCenter = this.infinite ? (r % INF_CHUNK === 1) : (r === 6 || r === 21 || r === 39 || r === 57 || r === 75);
                    if (isAvCenter && !isStCenter && r % 2 === 0) {
                        ctx.fillStyle = 'rgba(210, 153, 34, 0.45)';
                        ctx.fillRect(px + 14, py + 4, 2, 10);
                        ctx.fillRect(px + 17, py + 4, 2, 10);
                    } else if (isStCenter && !isAvCenter && c % 2 === 0) {
                        ctx.fillStyle = 'rgba(210, 153, 34, 0.45)';
                        ctx.fillRect(px + 4, py + 14, 10, 2);
                        ctx.fillRect(px + 4, py + 17, 10, 2);
                    } else if (isAvCenter && isStCenter) {
                        // White crosswalk bars
                        ctx.fillStyle = 'rgba(230, 237, 243, 0.22)';
                        ctx.fillRect(px + 4, py + 2, 4, 28);
                        ctx.fillRect(px + 24, py + 2, 4, 28);
                    }
                }
            }
        }

        // Update 5: per-city ground palette (Manhattan unchanged)
        if (this.mapDef && this.mapDef.tint) {
            ctx.fillStyle = this.mapDef.tint;
            ctx.fillRect(startCol * TILE_SIZE, startRow * TILE_SIZE, (endCol - startCol + 1) * TILE_SIZE, (endRow - startRow + 1) * TILE_SIZE);
        }

        // 2. District Boundary Dashed Tactical Lines & Subtle Ground Labels
        ctx.save();
        for (const d of this.districts) {
            const x1 = d.c1 * TILE_SIZE;
            const y1 = d.r1 * TILE_SIZE;
            const x2 = (d.c2 + 1) * TILE_SIZE;
            const y2 = (d.r2 + 1) * TILE_SIZE;
            if (x2 < this.cam.x || x1 > this.cam.x + viewW || y2 < this.cam.y || y1 > this.cam.y + viewH) continue;

            ctx.strokeStyle = d.status === 'reclaimed' ? 'rgba(63, 185, 80, 0.35)' :
                              (d.status === 'contested' ? 'rgba(210, 153, 34, 0.35)' : 'rgba(248, 81, 73, 0.25)');
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 6]);
            ctx.strokeRect(x1 + 2, y1 + 2, x2 - x1 - 4, y2 - y1 - 4);
            ctx.setLineDash([]);

            const midC = Math.floor((d.c1 + d.c2) / 2);
            const midR = Math.floor((d.r1 + d.r2) / 2);
            if (this.fog[midR] && this.fog[midR][midC] > 0) {
                ctx.font = 'bold 18px VT323, monospace';
                ctx.fillStyle = d.status === 'reclaimed' ? 'rgba(126, 231, 135, 0.32)' : 'rgba(201, 209, 217, 0.22)';
                ctx.fillText(`${d.name.toUpperCase()} [${d.status.toUpperCase()}]`, x1 + 14, y1 + 22);
            }
        }
        ctx.restore();

        // 2b. Mercenary Territories & Survivor Outposts (marked once explored)
        ctx.save();
        for (const camp of this.mercCamps) {
            if (!camp.discovered) continue;
            if (camp.x + camp.radius < this.cam.x || camp.x - camp.radius > this.cam.x + viewW ||
                camp.y + camp.radius < this.cam.y || camp.y - camp.radius > this.cam.y + viewH) continue;
            const campAliveKnown = camp.knownAlive !== false;
            ctx.strokeStyle = campAliveKnown ? 'rgba(255, 123, 114, 0.34)' : 'rgba(139, 148, 158, 0.22)';
            ctx.lineWidth = 2;
            ctx.setLineDash([10, 7]);
            ctx.beginPath();
            ctx.arc(camp.x, camp.y, camp.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.font = 'bold 15px VT323, monospace';
            ctx.fillStyle = campAliveKnown ? 'rgba(255, 166, 87, 0.72)' : 'rgba(139, 148, 158, 0.5)';
            ctx.fillText(`BANDIT TERRITORY: ${camp.name.toUpperCase()}${campAliveKnown ? '' : ' [BROKEN]'}`, camp.x - 110, camp.y - camp.radius + 18);
        }
        for (const op of this.outposts) {
            if (!op.discovered) continue;
            if (op.x + 120 < this.cam.x || op.x - 120 > this.cam.x + viewW || op.y + 120 < this.cam.y || op.y - 120 > this.cam.y + viewH) continue;
            const remaining = op.contacted ? 0 : 1;
            ctx.strokeStyle = remaining > 0 ? 'rgba(86, 212, 221, 0.4)' : 'rgba(139, 148, 158, 0.2)';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 6]);
            ctx.beginPath();
            ctx.arc(op.x, op.y, op.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.font = 'bold 14px VT323, monospace';
            ctx.fillStyle = remaining > 0 ? 'rgba(165, 243, 252, 0.75)' : 'rgba(139, 148, 158, 0.5)';
            const opTag = op.contacted ? ' [JOINED YOUR COMMAND]' : '';
            ctx.fillText(`ARMED SURVIVOR OUTPOST: ${op.name.toUpperCase()}${opTag}`, op.x - 100, op.y - op.radius - 6);
        }
        ctx.restore();

        // 3. Ground Decals (Craters & Blood Splatters)
        for (const d of this.decals) {
            if (!d.revealed) continue;
            ctx.fillStyle = d.color;
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        // Update 6: spitter poison puddles
        this.renderAcidPuddles(ctx);

        // 4. Urban Street Props (Wrecked Yellow Taxis, NYPD Cars, Buses, Subway Entrances)
        for (const prop of this.cityProps) {
            const tc = Math.floor(prop.x / TILE_SIZE);
            const tr = Math.floor(prop.y / TILE_SIZE);
            if (!this.fog[tr] || !this.fog[tr][tc]) continue;
            if (this.infinite && !this.renderChunks.has(prop._ck)) continue;
            const spr = SpriteBank['prop_' + prop.type];
            if (!spr) continue;
            ctx.save();
            ctx.translate(prop.x, prop.y);
            ctx.rotate(prop.rot || 0);
            ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
            ctx.restore();
        }

        // 5. NYC Skyscrapers, Brownstones, Warehouses & Ruined Buildings (2.5D Pixel Art)
        for (const b of this.cityStructures) {
            if (b.x + b.pxW < this.cam.x || b.x > this.cam.x + viewW || b.y + b.pxH < this.cam.y || b.y > this.cam.y + viewH) continue;
            let anyExplored = false;
            for (let rr = b.r; rr < b.r + b.h && !anyExplored; rr++) {
                for (let cc = b.c; cc < b.c + b.w; cc++) {
                    if (this.fog[rr] && this.fog[rr][cc] > 0) { anyExplored = true; break; }
                }
            }
            if (!anyExplored) continue;
            if (this.infinite && !this.renderChunks.has(b._ck)) {
                // Update 7: low-detail building block beyond the render ring
                ctx.fillStyle = b.roofCol;
                ctx.fillRect(b.x, b.y, b.pxW, b.pxH);
                continue;
            }

            // Drop shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
            ctx.fillRect(b.x + 8, b.y + 8, b.pxW, b.pxH);

            // Base structure footprint
            ctx.fillStyle = b.wallCol;
            ctx.fillRect(b.x, b.y, b.pxW, b.pxH);

            // Extruded 2.5D rooftop offset
            const roofOff = Math.min(18, Math.floor(b.heightPx * 0.5));
            ctx.fillStyle = b.roofCol;
            ctx.fillRect(b.x - roofOff * 0.35, b.y - roofOff, b.pxW, b.pxH);

            // Rooftop parapet border & HVAC / Helipad / Damaged roof details
            ctx.strokeStyle = '#161b22';
            ctx.lineWidth = 2;
            ctx.strokeRect(b.x - roofOff * 0.35, b.y - roofOff, b.pxW, b.pxH);

            const rx = b.x - roofOff * 0.35;
            const ry = b.y - roofOff;

            if (b.kind === 'skyscraper') {
                // Steel curtain-wall grid & shattered skylight
                ctx.fillStyle = '#1c2530';
                ctx.fillRect(rx + 12, ry + 12, b.pxW - 24, b.pxH - 24);
                ctx.strokeStyle = '#485666';
                ctx.lineWidth = 1;
                ctx.strokeRect(rx + 12, ry + 12, b.pxW - 24, b.pxH - 24);
                // Red aviation warning beacon on skyscraper corner
                ctx.fillStyle = (Math.floor(performance.now() / 600) % 2 === 0) ? '#f85149' : '#5a1e1e';
                ctx.fillRect(rx + 5, ry + 5, 4, 4);
            } else if (b.kind === 'brownstone') {
                // Rooftop water tower & stairwell bulkhead
                ctx.fillStyle = '#3a241f';
                ctx.fillRect(rx + 10, ry + 10, 18, 14);
                ctx.fillStyle = '#8c6239';
                ctx.beginPath();
                ctx.arc(rx + b.pxW - 18, ry + 18, 8, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Industrial HVAC vents & skylights
                ctx.fillStyle = '#2d333b';
                ctx.fillRect(rx + 14, ry + 14, 20, 14);
                ctx.fillStyle = '#58a6ff';
                ctx.globalAlpha = 0.25;
                ctx.fillRect(rx + 42, ry + 16, b.pxW - 56, 12);
                ctx.globalAlpha = 1.0;
            }

            // Street-facing lit/broken windows along lower facade
            for (let wx = b.x + 8; wx < b.x + b.pxW - 10; wx += 14) {
                ctx.fillStyle = ((wx + b.y) % 28 === 0) ? 'rgba(242, 204, 96, 0.28)' : '#0d1117';
                ctx.fillRect(wx, b.y + b.pxH - 6, 7, 4);
            }

            // Subtle landmark rooftop stencil
            if (z >= 0.75) {
                ctx.font = '12px VT323, monospace';
                ctx.fillStyle = 'rgba(230, 237, 243, 0.42)';
                ctx.fillText(b.label, rx + 6, ry + b.pxH - 6);
            }
        }

        // 6. Y-Sorted Entities (Hives, Military Buildings, Vehicles, Infantry, Zombies)
        // Update 3 FOG FIX: non-player units are drawn ONLY while in live vision; structures outside live
        // vision are drawn from the player's last-known snapshot (never from their live state).
        const visibleEntities = [];
        const liveStructs = new Map();
        for (const e of this.entities) {
            if (e.faction === 'player' || e.category === 'depot') {
                visibleEntities.push(e);
            } else if (this.isMemoryEntity(e)) {
                liveStructs.set(e.id, e);
            } else if (this.isEntityVisible(e)) {
                visibleEntities.push(e);
            }
        }
        for (const [id, live] of liveStructs) {
            if (this.isEntityVisible(live)) visibleEntities.push(live);
        }
        for (const [id, snap] of this.knownStructures) {
            const live = liveStructs.get(id);
            if (live && this.isEntityVisible(live)) continue;
            visibleEntities.push(snap);
        }
        // Update 4: only draw what is on screen (big win with thousands of infected)
        const cullPad = 120;
        const cx0 = this.cam.x - cullPad, cx1 = this.cam.x + viewW + cullPad;
        const cy0 = this.cam.y - cullPad, cy1 = this.cam.y + viewH + cullPad;
        for (let vi = visibleEntities.length - 1; vi >= 0; vi--) {
            const ve = visibleEntities[vi];
            if (ve.x < cx0 || ve.x > cx1 || ve.y < cy0 || ve.y > cy1) visibleEntities.splice(vi, 1);
        }
        visibleEntities.sort((a, b) => (a.isAir ? 99999 : a.y) - (b.isAir ? 99999 : b.y));

        for (const ent of visibleEntities) {
            this.renderEntity(ctx, ent);
        }

        // 7. Projectiles & Tracers
        for (const p of this.projectiles) {
            if (p.faction !== 'player' && !this.isWorldPointVisible(p.x, p.y)) continue;
            if (p.acid) {
                // Update 6: lobbed glob — ground shadow + body raised on a parabolic arc with a short trail
                const k = Math.min(1, p.t / p.T);
                const h = p.arcH * 4 * k * (1 - k);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
                ctx.beginPath();
                ctx.ellipse(p.x, p.y, 3.5, 2, 0, 0, Math.PI * 2);
                ctx.fill();
                const k0 = Math.max(0, k - 0.07);
                const tx = p.sx + (p.ex - p.sx) * k0, ty = p.sy + (p.ey - p.sy) * k0 - p.arcH * 4 * k0 * (1 - k0);
                ctx.strokeStyle = 'rgba(126, 231, 135, 0.55)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(tx, ty);
                ctx.lineTo(p.x, p.y - h);
                ctx.stroke();
                ctx.fillStyle = '#7ee787';
                ctx.fillRect(Math.round(p.x) - 3, Math.round(p.y - h) - 3, 6, 6);
                ctx.fillStyle = '#c3e04a';
                ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y - h) - 2, 2, 2);
                continue;
            }
            ctx.strokeStyle = p.weapon === 'acid' ? '#7ee787' : (HEAVY_EXPLOSIVE_WEAPONS.has(p.weapon) ? '#ffa657' :
                              (p.weapon === 'flame' ? '#ff9b42' :
                              (p.faction === 'merc' ? '#ff8e5a' : (p.faction === 'survivor' ? '#a5d6ff' : '#f2cc60'))));
            ctx.lineWidth = p.weapon === 'flame' ? 5 : (HEAVY_EXPLOSIVE_WEAPONS.has(p.weapon) ? 3.5 : 2);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025);
            ctx.stroke();
        }

        // 8. Incoming Tactical Cruise Missiles
        for (const m of this.missiles) {
            const mx = m.startX + (m.targetX - m.startX) * m.progress;
            const my = m.startY + (m.targetY - m.startY) * m.progress - Math.sin(m.progress * Math.PI) * 140;

            ctx.strokeStyle = 'rgba(248, 81, 73, 0.75)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(m.targetX, m.targetY, 155 * (1 - m.progress * 0.35), 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = 'rgba(255, 166, 87, 0.7)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(m.startX, m.startY);
            ctx.lineTo(mx, my);
            ctx.stroke();

            ctx.fillStyle = '#ff7b72';
            ctx.beginPath();
            ctx.arc(mx, my, 5, 0, Math.PI * 2);
            ctx.fill();
        }

        // 9. Active Artillery Loop Reticles
        for (const ent of this.entities) {
            if (ent.type === 'artillery' && ent.bombardTarget) {
                ctx.strokeStyle = 'rgba(255, 166, 87, 0.7)';
                ctx.setLineDash([5, 5]);
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(ent.bombardTarget.x, ent.bombardTarget.y, 64, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.font = 'bold 14px VT323, monospace';
                ctx.fillStyle = '#ffa657';
                ctx.fillText(ent.bombardLoop ? 'ARTY LOOP' : 'ARTY SALVO', ent.bombardTarget.x - 24, ent.bombardTarget.y - 68);
            }
        }

        // 10. Tactical Order Waypoint Lines
        for (const ent of this.entities) {
            if (this.selectedIds.has(ent.id) && ent.faction === 'player' && ent.targetPos) {
                ctx.strokeStyle = 'rgba(86, 211, 100, 0.65)';
                ctx.setLineDash([4, 4]);
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(ent.x, ent.y);
                ctx.lineTo(ent.targetPos.x, ent.targetPos.y);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.fillStyle = '#56d364';
                ctx.fillRect(ent.targetPos.x - 3, ent.targetPos.y - 3, 6, 6);
            }
        }

        // 10b. Update 3: RETURN TO HQ range ring when rescued survivors are selected
        if (this.entities.some(e => this.selectedIds.has(e.id) && e.isSurvivor && e.faction === 'player')) {
            const hq = this.entities.find(e => e.faction === 'player' && e.type === 'hq');
            if (hq) {
                ctx.strokeStyle = 'rgba(86, 212, 221, 0.55)';
                ctx.setLineDash([10, 8]);
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(hq.x, hq.y, SURVIVOR_RETURN_RANGE, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.font = 'bold 14px VT323, monospace';
                ctx.fillStyle = 'rgba(165, 243, 252, 0.8)';
                ctx.fillText('RETURN TO HQ RANGE', hq.x - 60, hq.y - SURVIVOR_RETURN_RANGE + 18);
            }
        }

        // 11. Particles & Floating Combat/Resource Text
        for (const pt of this.particles) {
            if (!pt.global && !this.isWorldPointVisible(pt.x, pt.y)) continue;
            ctx.globalAlpha = Math.max(0, pt.life / (pt.maxLife || 0.5));
            if (pt.text) {
                ctx.font = 'bold 16px VT323, monospace';
                ctx.fillStyle = pt.color;
                ctx.fillText(pt.text, pt.x - 28, pt.y);
            } else if (pt.smoke) {
                ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife) * 0.38;
                ctx.fillStyle = pt.color;
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
                ctx.fill();
            } else if (pt.flash) {
                ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife) * 0.85;
                ctx.fillStyle = pt.color;
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
                ctx.fill();
            } else if (pt.expandRate) {
                ctx.strokeStyle = pt.color;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
                ctx.stroke();
            } else {
                ctx.fillStyle = pt.color;
                ctx.fillRect(pt.x - 1.5, pt.y - 1.5, pt.size || 3, pt.size || 3);
            }
        }
        ctx.globalAlpha = 1.0;

        // 12. Pings
        for (const ping of this.pings) {
            // BUGFIX (Update 2): long-lived pings (cruise missile target marker, life 2.3s) previously
            // produced a NEGATIVE radius here, which makes ctx.arc() throw an IndexSizeError, aborting
            // render() mid-frame and killing the requestAnimationFrame loop (freeze + black screen).
            // Expansion is now normalized against the ping's own lifetime; short pings are unchanged.
            const lifeFrac = ping.maxLife ? ping.life / ping.maxLife : ping.life;
            const pingRadius = Math.max(1, (1 - Math.min(1, lifeFrac)) * 28 + 6);
            ctx.strokeStyle = ping.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(ping.x, ping.y, pingRadius, 0, Math.PI * 2);
            ctx.stroke();
        }

        // 13. Building Placement Ghost & Draggable Wall/Gate Preview
        if (this.buildPlacementType) {
            const def = BUILDING_DEFS[this.buildPlacementType];
            const half = (def.size * TILE_SIZE) / 2;

            if (this.isDragBuilding && this.dragBuildTiles.length > 0) {
                this.dragBuildTiles.forEach(t => {
                    const valid = this.canPlaceBuildingAt(this.buildPlacementType, t.x, t.y);
                    ctx.fillStyle = valid ? 'rgba(63, 185, 80, 0.35)' : 'rgba(248, 81, 73, 0.35)';
                    ctx.strokeStyle = valid ? '#3fb950' : '#f85149';
                    ctx.lineWidth = 2;
                    ctx.fillRect(t.x - half, t.y - half, def.size * TILE_SIZE, def.size * TILE_SIZE);
                    ctx.strokeRect(t.x - half, t.y - half, def.size * TILE_SIZE, def.size * TILE_SIZE);
                });
            } else {
                let gx = (this.buildPlacementType === 'wall' || this.buildPlacementType === 'gate')
                    ? Math.floor(this.mouseWorld.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2
                    : Math.round(this.mouseWorld.x / 16) * 16;
                let gy = (this.buildPlacementType === 'wall' || this.buildPlacementType === 'gate')
                    ? Math.floor(this.mouseWorld.y / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2
                    : Math.round(this.mouseWorld.y / 16) * 16;

                if (def.requiresDepot) {
                    const nearDep = this.findNearestFreeDepot(this.mouseWorld.x, this.mouseWorld.y, 56);
                    if (nearDep) {
                        gx = nearDep.x;
                        gy = nearDep.y;
                    }
                }

                const valid = this.canPlaceBuildingAt(this.buildPlacementType, gx, gy);
                ctx.fillStyle = valid ? 'rgba(63, 185, 80, 0.32)' : 'rgba(248, 81, 73, 0.32)';
                ctx.strokeStyle = valid ? '#3fb950' : '#f85149';
                ctx.lineWidth = 2;
                ctx.fillRect(gx - half, gy - half, def.size * TILE_SIZE, def.size * TILE_SIZE);
                ctx.strokeRect(gx - half, gy - half, def.size * TILE_SIZE, def.size * TILE_SIZE);
            }
        }

        // 14. Targeting Reticle (Cruise Missile / Artillery)
        if (this.targetingMode) {
            const rad = this.targetingMode === 'missile' ? 155 : ((this.targetingMode === 'treat' || this.targetingMode === 'repair') ? 18 : 64);
            ctx.strokeStyle = this.targetingMode === 'missile' ? '#f85149' : (this.targetingMode === 'treat' ? '#7ee787' : (this.targetingMode === 'repair' ? '#58a6ff' : '#ffa657'));
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.mouseWorld.x, this.mouseWorld.y, rad, 0, Math.PI * 2);
            ctx.stroke();
        }

        // 15. Fog of War Layer
        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                const state = this.fog[r][c];
                if (state === 0) {
                    ctx.fillStyle = '#070a0e';
                    ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                } else if (state === 1) {
                    ctx.fillStyle = 'rgba(7, 10, 14, 0.56)';
                    ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                }
            }
        }

        // 15b. Survivor Intel Overlay (estimated signal zones, drawn above fog)
        if (this.showIntel && this.survivorIntel.length > 0) {
            const pulse = 0.5 + Math.sin(performance.now() * 0.004) * 0.25;
            ctx.save();
            for (const sig of this.survivorIntel) {
                const cx = sig.status === 'confirmed' ? sig.trueX : sig.x;
                const cy = sig.status === 'confirmed' ? sig.trueY : sig.y;
                const rad = sig.status === 'confirmed' ? 34 : sig.radius;
                if (cx + rad < this.cam.x || cx - rad > this.cam.x + viewW || cy + rad < this.cam.y || cy - rad > this.cam.y + viewH) continue;

                if (sig.status === 'unknown') {
                    ctx.strokeStyle = `rgba(86, 212, 221, ${0.35 + pulse * 0.35})`;
                    ctx.fillStyle = 'rgba(86, 212, 221, 0.05)';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([9, 7]);
                    ctx.beginPath();
                    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.font = 'bold 15px VT323, monospace';
                    ctx.fillStyle = 'rgba(165, 243, 252, 0.85)';
                    ctx.fillText(`? ${sig.label} — ${sig.flavor} (EST.)`, cx - 90, cy - 4);
                    ctx.font = '13px VT323, monospace';
                    ctx.fillStyle = 'rgba(165, 243, 252, 0.6)';
                    ctx.fillText('POSSIBLE SURVIVORS SOMEWHERE IN ZONE', cx - 86, cy + 12);
                } else if (sig.status === 'confirmed') {
                    ctx.strokeStyle = '#56d4dd';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(cx, cy, rad + pulse * 6, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.font = 'bold 14px VT323, monospace';
                    ctx.fillStyle = '#a5f3fc';
                    ctx.fillText(`${sig.label}: SURVIVORS CONFIRMED`, cx - 70, cy - rad - 10);
                } else if (sig.status === 'false') {
                    ctx.globalAlpha = Math.max(0, Math.min(1, sig.fade / 4));
                    ctx.strokeStyle = 'rgba(139, 148, 158, 0.7)';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([4, 8]);
                    ctx.beginPath();
                    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.font = 'bold 15px VT323, monospace';
                    ctx.fillStyle = '#8b949e';
                    ctx.fillText(`${sig.label}: SIGNAL LOST — FALSE LEAD`, cx - 90, cy);
                    ctx.globalAlpha = 1.0;
                }
            }
            ctx.restore();
        }

        ctx.restore();

        // 16. Screen-Space Selection Drag Box
        if (this.isDragging) {
            const bx = Math.min(this.dragStart.x, this.dragEnd.x);
            const by = Math.min(this.dragStart.y, this.dragEnd.y);
            const bw = Math.abs(this.dragEnd.x - this.dragStart.x);
            const bh = Math.abs(this.dragEnd.y - this.dragStart.y);
            ctx.strokeStyle = '#3fb950';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(bx, by, bw, bh);
            ctx.fillStyle = 'rgba(63, 185, 80, 0.14)';
            ctx.fillRect(bx, by, bw, bh);
        }
    }
});
