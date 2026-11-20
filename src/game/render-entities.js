'use strict';
// Per-entity drawing, health bars, logistics & infection markers, sprite keys
defineGameMethods({
    renderEntity(ctx, ent) {
        const isSelected = this.selectedIds.has(ent.id);

        if (isSelected) {
            ctx.strokeStyle = ent.faction === 'player' ? '#3fb950' :
                              ((ent.faction === 'zombie' || ent.faction === 'merc') ? '#f85149' :
                              ((ent.faction === 'survivor' || ent.category === 'shelter') ? '#56d4dd' : '#f2cc60'));
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(ent.x, ent.y, ent.radius + 5, 0, Math.PI * 2);
            ctx.stroke();
        }

        if (ent.category === 'depot') {
            ctx.drawImage(SpriteBank.depot_node, ent.x - 32, ent.y - 32);
            if (!ent.claimedBy) {
                ctx.font = 'bold 13px VT323, monospace';
                ctx.fillStyle = '#f2cc60';
                ctx.fillText(`+${ent.scrapRate}S/+${ent.fuelRate}F`, ent.x - 24, ent.y - 35);
            }
            return;
        }

        if (ent.category === 'crate') {
            ctx.drawImage(SpriteBank.crate, ent.x - 12, ent.y - 12);
            return;
        }

        // ===== Update 2: Survivor shelters, outposts, survivors & mercenaries =====
        if (ent.category === 'shelter') {
            ctx.drawImage(ent.opened ? SpriteBank.shelter_open : SpriteBank.shelter_locked, ent.x - 16, ent.y - 16);
            if (!ent.opened) {
                ctx.font = 'bold 12px VT323, monospace';
                ctx.fillStyle = '#56d4dd';
                ctx.fillText('LOCKED SHELTER', ent.x - 30, ent.y - 22);
                if (ent.unlockProgress > 0) {
                    this.renderHealthBar(ctx, ent.x, ent.y + 20, 30, ent.unlockProgress, ent.unlockTime, '#56d4dd');
                }
            }
            return;
        }

        if (ent.category === 'fort') {
            ctx.drawImage(SpriteBank.fort_barricade, ent.x - 16, ent.y - 16);
            if (ent.hp < ent.maxHp || isSelected) {
                this.renderHealthBar(ctx, ent.x, ent.y - 20, 24, ent.hp, ent.maxHp, '#56d4dd');
            }
            return;
        }

        if (ent.category === 'mercstruct') {
            const spr = SpriteBank['mstruct_' + ent.type];
            if (spr) ctx.drawImage(spr, ent.x - spr.width / 2, ent.y - spr.height / 2);
            if (ent.type === 'tower') {
                ctx.save();
                ctx.translate(ent.x, ent.y);
                ctx.rotate(ent.angle);
                ctx.fillStyle = '#161b22';
                ctx.fillRect(0, -2, 18, 4);
                if (ent.muzzleFlash > 0) {
                    ctx.fillStyle = '#ffd166';
                    ctx.beginPath();
                    ctx.arc(20, 0, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }
            if (ent.type === 'bunker') {
                ctx.font = 'bold 13px VT323, monospace';
                ctx.fillStyle = '#ffa657';
                ctx.fillText('BANDIT STRONGHOLD', ent.x - 38, ent.y - ent.radius - 12);
            }
            if (ent.hp < ent.maxHp || isSelected || ent.type === 'bunker') {
                const w = ent.type === 'bunker' ? 60 : (ent.type === 'tower' ? 36 : 24);
                this.renderHealthBar(ctx, ent.x, ent.y - ent.radius - 6, w, ent.hp, ent.maxHp, '#ffa657');
            }
            return;
        }

        if (ent.category === 'merc' || ent.category === 'survivor') {
            const spr = SpriteBank[ent.category === 'merc' ? 'merc_' + ent.type : this.getSurvivorSpriteKey(ent)];
            ctx.save();
            ctx.translate(ent.x, ent.y);
            ctx.rotate(ent.angle);
            if (spr) ctx.drawImage(spr, -12, -12);
            if (ent.muzzleFlash > 0) {
                ctx.fillStyle = '#ffd166';
                ctx.beginPath();
                ctx.arc(14, 2, 4, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();

            if (ent.category === 'survivor' && ent.state !== 'follow') {
                // Bobbing cyan marker: "rescue me"
                const bob = Math.sin(performance.now() * 0.006 + ent.id) * 2;
                ctx.fillStyle = '#56d4dd';
                ctx.beginPath();
                ctx.moveTo(ent.x - 4, ent.y - 22 + bob);
                ctx.lineTo(ent.x + 4, ent.y - 22 + bob);
                ctx.lineTo(ent.x, ent.y - 16 + bob);
                ctx.closePath();
                ctx.fill();
            }
            if (ent.hp < ent.maxHp || isSelected) {
                this.renderHealthBar(ctx, ent.x, ent.y - 15, 20, ent.hp, ent.maxHp, ent.category === 'merc' ? '#ffa657' : '#56d4dd');
            }
            if (ent.infected) this.renderInfectionMarker(ctx, ent);
            return;
        }

        if (ent.category === 'hive') {
            const pulse = 1 + Math.sin(performance.now() * 0.005 + ent.id) * 0.04;
            const spr = SpriteBank[ent.type] || SpriteBank.hive_subway;
            ctx.save();
            ctx.translate(ent.x, ent.y);
            ctx.scale(pulse, pulse);
            ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
            ctx.restore();

            ctx.font = 'bold 13px VT323, monospace';
            ctx.fillStyle = '#ff7b72';
            ctx.fillText(ent.name.toUpperCase(), ent.x - 42, ent.y - ent.radius - 12);
            this.renderHealthBar(ctx, ent.x, ent.y - ent.radius - 8, 60, ent.hp, ent.maxHp, '#f85149');
            return;
        }

        if (ent.category === 'building') {
            const pxSize = ent.size * TILE_SIZE;
            if (ent.underConstruction) ctx.globalAlpha = 0.45 + 0.4 * (ent.buildProgress / ent.buildTime);
            if (ent.type === 'gate') {
                ctx.save();
                ctx.translate(ent.x, ent.y);
                ctx.rotate((ent.rotation || 0) * (Math.PI / 2));
                const gSpr = ent.isOpen ? SpriteBank.bld_gate_open : SpriteBank.bld_gate_closed;
                ctx.drawImage(gSpr, -16, -16);
                ctx.restore();
            } else {
                const spr = SpriteBank['bld_' + ent.type];
                if (spr) {
                    ctx.save();
                    ctx.translate(ent.x, ent.y);
                    if (ent.rotation && ent.type !== 'turret' && ent.type !== 'artillery') {
                        ctx.rotate(ent.rotation * (Math.PI / 2));
                    }
                    ctx.drawImage(spr, -pxSize / 2, -pxSize / 2, pxSize, pxSize);
                    ctx.restore();
                }
            }

            if (ent.type === 'airbase' && !ent.underConstruction) this.renderAirbaseStorage(ctx, ent);
            if (ent.type === 'medictent' && !ent.underConstruction) {
                const R = ent.healRadius || BUILDING_DEFS.medictent.healRadius;
                if (this.selectedIds.has(ent.id) || this.buildPlacementType === 'medictent') {
                    ctx.strokeStyle = 'rgba(255, 123, 114, 0.55)';
                    ctx.setLineDash([8, 6]);
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(ent.x, ent.y, R, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.fillStyle = 'rgba(255, 123, 114, 0.05)';
                    ctx.fill();
                }
                const pt = ent.healTargetId ? this.getEntityById(ent.healTargetId) : null;
                if (pt) {
                    const pulse = 0.5 + Math.sin(performance.now() * 0.01) * 0.5;
                    ctx.strokeStyle = `rgba(255, 123, 114, ${0.3 + pulse * 0.4})`;
                    ctx.lineWidth = 2;
                    ctx.setLineDash([3, 4]);
                    ctx.beginPath();
                    ctx.moveTo(ent.x, ent.y);
                    ctx.lineTo(pt.x, pt.y);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.fillStyle = '#e6edf3';
                    ctx.fillRect(pt.x - 4, pt.y - 25, 9, 9);
                    ctx.fillStyle = '#da3633';
                    ctx.fillRect(pt.x - 1, pt.y - 24, 3, 7);
                    ctx.fillRect(pt.x - 3, pt.y - 22, 7, 3);
                }
            }
            if (ent.type === 'turret' || ent.type === 'artillery') {
                ctx.save();
                ctx.translate(ent.x, ent.y);
                ctx.rotate(ent.angle);
                ctx.fillStyle = '#161b22';
                ctx.fillRect(0, ent.type === 'artillery' ? -4 : -2, ent.type === 'artillery' ? 28 : 16, ent.type === 'artillery' ? 8 : 4);
                ctx.restore();
            }

            if (ent.type === 'collector') {
                ctx.font = 'bold 14px VT323, monospace';
                ctx.fillStyle = '#f2cc60';
                ctx.fillText(`LVL ${ent.level}`, ent.x - 14, ent.y - pxSize / 2 - 10);
            }

            if (ent.rallyPoint && isSelected) {
                ctx.strokeStyle = '#3fb950';
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(ent.x, ent.y);
                ctx.lineTo(ent.rallyPoint.x, ent.rallyPoint.y);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = '#3fb950';
                ctx.fillRect(ent.rallyPoint.x - 4, ent.rallyPoint.y - 4, 8, 8);
            }

            ctx.globalAlpha = 1.0;
            // Update 4: scaffolding frame + construction progress bar
            if (ent.underConstruction) {
                const half = pxSize / 2;
                const pct = ent.buildProgress / ent.buildTime;
                ctx.strokeStyle = '#d29922';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 4]);
                ctx.strokeRect(ent.x - half + 1, ent.y - half + 1, pxSize - 2, pxSize - 2);
                ctx.setLineDash([]);
                ctx.strokeStyle = 'rgba(210, 153, 34, 0.55)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(ent.x - half, ent.y - half); ctx.lineTo(ent.x + half, ent.y + half);
                ctx.moveTo(ent.x + half, ent.y - half); ctx.lineTo(ent.x - half, ent.y + half);
                ctx.stroke();
                const bw = Math.max(28, pxSize * 0.8);
                ctx.fillStyle = '#0d1117';
                ctx.fillRect(ent.x - bw / 2 - 1, ent.y + half + 3, bw + 2, 6);
                ctx.fillStyle = '#f2cc60';
                ctx.fillRect(ent.x - bw / 2, ent.y + half + 4, bw * pct, 4);
                if (ent.size >= 2) {
                    ctx.font = 'bold 12px VT323, monospace';
                    ctx.fillStyle = '#f2cc60';
                    ctx.fillText(`BUILDING ${Math.floor(pct * 100)}%`, ent.x - 30, ent.y + half + 20);
                }
            }

            if (ent.hp < ent.maxHp || isSelected) {
                this.renderHealthBar(ctx, ent.x, ent.y - pxSize / 2 - 6, Math.max(26, pxSize * 0.75), ent.hp, ent.maxHp, '#3fb950');
            }
            return;
        }

        if (ent.category === 'unit' && ent.hoistTimer > 0) {
            // Update 6: winched up on a rope to a hovering helicopter
            const k = 1 - ent.hoistTimer / HOIST_TIME;
            const hx = ent.hoistFromX, hy = ent.hoistFromY;
            const sx = ent.hoistStartX !== undefined ? ent.hoistStartX : ent.x, sy = ent.hoistStartY !== undefined ? ent.hoistStartY : ent.y;
            const ux = sx + (hx - sx) * k, uy = sy + (hy - sy) * k;
            ctx.strokeStyle = 'rgba(201, 209, 217, 0.85)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(hx, hy);
            ctx.lineTo(ux, uy);
            ctx.stroke();
            ctx.save();
            ctx.translate(ux, uy);
            ctx.scale(1 - 0.3 * k, 1 - 0.3 * k);
            const hs = SpriteBank[this.getUnitSpriteKey(ent)] || SpriteBank['unit_' + ent.type];
            if (hs) ctx.drawImage(hs, -12, -12);
            ctx.restore();
            return;
        }

        if (ent.category === 'unit' && ent.rappelTimer > 0) {
            // Update 5: fast-rope descent from a hovering helicopter
            const k = 1 - ent.rappelTimer / 1.0;
            const hx = ent.rappelFromX, hy = ent.rappelFromY;
            const ux = hx + (ent.x - hx) * k, uy = hy + (ent.y - hy) * k;
            ctx.strokeStyle = 'rgba(201, 209, 217, 0.85)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(hx, hy);
            ctx.lineTo(ux, uy);
            ctx.stroke();
            ctx.save();
            ctx.translate(ux, uy);
            ctx.scale(0.75 + 0.25 * k, 0.75 + 0.25 * k);
            const rs = SpriteBank[this.getUnitSpriteKey(ent)] || SpriteBank['unit_' + ent.type];
            if (rs) ctx.drawImage(rs, -12, -12);
            ctx.restore();
            return;
        }

        if (ent.category === 'unit') {
            ctx.save();
            ctx.translate(ent.x, ent.y);
            ctx.rotate(ent.angle);
            const uSpr = SpriteBank[this.getUnitSpriteKey(ent)] || SpriteBank['unit_' + ent.type];
            if (uSpr) ctx.drawImage(uSpr, -12, -12);
            if (ent.muzzleFlash > 0) {
                ctx.fillStyle = '#ffd166';
                ctx.beginPath();
                ctx.arc(14, 2, 4, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();

            if (ent.hp < ent.maxHp || isSelected) {
                this.renderHealthBar(ctx, ent.x, ent.y - 16, 22, ent.hp, ent.maxHp, ent.isSurvivor ? '#56d4dd' : '#3fb950');
            }
            // Update 4: medic healing link & mechanic repair link
            if (ent.type === 'medic' && ent.healTargetId) {
                const pt = this.getEntityById(ent.healTargetId);
                if (pt) {
                    const pulse = 0.5 + Math.sin(performance.now() * 0.01) * 0.5;
                    ctx.strokeStyle = `rgba(126, 231, 135, ${0.35 + pulse * 0.4})`;
                    ctx.lineWidth = 2;
                    ctx.setLineDash([3, 3]);
                    ctx.beginPath();
                    ctx.moveTo(ent.x, ent.y);
                    ctx.lineTo(pt.x, pt.y);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.fillStyle = '#7ee787';
                    ctx.fillRect(pt.x - 1, pt.y - 22, 3, 7);
                    ctx.fillRect(pt.x - 3, pt.y - 20, 7, 3);
                }
            }
            if (ent.type === 'mechanic' && ent.state === 'repair' && ent.repairing) {
                const tg = this.getEntityById(ent.targetId);
                if (tg) {
                    ctx.strokeStyle = (Math.floor(performance.now() / 90) % 2) ? '#58a6ff' : '#a5d6ff';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(ent.x, ent.y);
                    ctx.lineTo(tg.x + (Math.random() - 0.5) * 8, tg.y + (Math.random() - 0.5) * 8);
                    ctx.stroke();
                    ctx.font = 'bold 12px VT323, monospace';
                    ctx.fillStyle = '#79c0ff';
                    ctx.fillText(`REPAIRING ${Math.floor((tg.hp / tg.maxHp) * 100)}%`, tg.x - 30, tg.y + (tg.radius || 16) + 14);
                }
            }

            // Update 3: Combat Medic treatment pips / recharge bar
            if (ent.treatMax && (isSelected || ent.treatCharges < ent.treatMax)) {
                if (ent.treatCharges > 0) {
                    for (let i = 0; i < ent.treatMax; i++) {
                        ctx.fillStyle = i < ent.treatCharges ? '#7ee787' : '#30363d';
                        ctx.fillRect(ent.x - 11 + i * 4, ent.y + 13, 3, 3);
                    }
                } else {
                    const pct = 1 - ent.treatCooldown / UNIT_DEFS.medic.treatCooldown;
                    ctx.fillStyle = '#0d1117';
                    ctx.fillRect(ent.x - 12, ent.y + 12, 24, 5);
                    ctx.fillStyle = '#d29922';
                    ctx.fillRect(ent.x - 11, ent.y + 13, 22 * Math.max(0, Math.min(1, pct)), 3);
                }
            }
            if (ent.infected) this.renderInfectionMarker(ctx, ent);
            this.renderLogisticsMarkers(ctx, ent, isSelected);
            return;
        }

        if (ent.category === 'vehicle') {
            ctx.save();
            ctx.translate(ent.x, ent.y);
            // Update 5: altitude (landing/takeoff) drives shadow offset & sprite scale
            const alt = ent.canFly ? (ent.altitude !== undefined ? ent.altitude : 1) : 0;
            if (alt > 0.02) {
                ctx.fillStyle = 'rgba(0,0,0,0.35)';
                ctx.beginPath();
                ctx.ellipse(6 * alt, 18 * alt, 22, 12, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.rotate(ent.angle);
            const sc = ent.canFly ? 0.86 + 0.14 * alt : 1;
            if (sc !== 1) ctx.scale(sc, sc);
            const spr = SpriteBank['veh_' + ent.type];
            ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);

            if (ent.hasRotor) {
                const offs = ent.twinRotor ? [-18, 18] : [0];
                for (const o of offs) {
                    ctx.save();
                    ctx.translate(o, 0);
                    ctx.rotate(alt > 0.02 ? ent.rotorAngle : 0.6);
                    ctx.fillStyle = alt > 0.02 ? 'rgba(230, 237, 243, 0.5)' : 'rgba(139, 148, 158, 0.75)';
                    ctx.fillRect(-26, -1.5, 52, 3);
                    ctx.fillRect(-1.5, -26, 3, 52);
                    ctx.restore();
                }
            }
            ctx.restore();

            if (ent.capacity > 0 && (ent.passengers.length > 0 || isSelected)) {
                ctx.font = 'bold 13px VT323, monospace';
                ctx.fillStyle = '#f2cc60';
                ctx.fillText(`${ent.passengers.length}/${ent.capacity}`, ent.x - 10, ent.y - ent.radius - 11);
            }

            if (ent.hp < ent.maxHp || isSelected) {
                this.renderHealthBar(ctx, ent.x, ent.y - ent.radius - 6, 36, ent.hp, ent.maxHp, '#3fb950');
            }
            this.renderLogisticsMarkers(ctx, ent, isSelected);
            return;
        }

        if (ent.category === 'zombie') {
            ctx.save();
            ctx.translate(ent.x, ent.y);
            ctx.rotate(ent.angle);
            const spr = SpriteBank['zombie_' + ent.type];
            ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
            ctx.restore();

            if (ent.hp < ent.maxHp || isSelected) {
                this.renderHealthBar(ctx, ent.x, ent.y - ent.radius - 6, Math.max(20, ent.radius * 2), ent.hp, ent.maxHp, '#f85149');
            }
        }
    },

    // Update 5: food bar / ammo / fuel warnings drawn under player units & vehicles
    renderLogisticsMarkers(ctx, ent, isSelected) {
        if (ent.faction !== 'player') return;
        const by = ent.y + (ent.radius || 10) + 6;
        if (ent.food !== undefined && (isSelected || ent.food < 30)) {
            ctx.fillStyle = '#0d1117';
            ctx.fillRect(ent.x - 12, by + 8, 24, 4);
            ctx.fillStyle = ent.food <= 0 ? '#f85149' : (ent.food < 25 ? '#ffa657' : '#d29922');
            ctx.fillRect(ent.x - 11, by + 9, 22 * Math.max(0.05, ent.food / 100), 2);
        }
        if (ent.fuelMax && (isSelected || ent.fuel / ent.fuelMax < 0.25)) {
            const w = Math.max(24, ent.radius * 1.6);
            ctx.fillStyle = '#0d1117';
            ctx.fillRect(ent.x - w / 2 - 1, by, w + 2, 4);
            ctx.fillStyle = ent.fuel <= 0 ? '#f85149' : '#58a6ff';
            ctx.fillRect(ent.x - w / 2, by + 1, w * (ent.fuel / ent.fuelMax), 2);
        }
        const warn = [];
        if (ent.ammoType && this.settings.ammo && !this.hasAmmo(ent)) warn.push('NO AMMO');
        else if (ent.ammoMax && this.settings.ammo && this.ammoFraction(ent) < 0.2) warn.push('LOW AMMO');
        if (ent.fuelMax && ent.fuel <= 0 && this.settings.fuel) warn.push('NO FUEL');
        if (ent.food !== undefined && ent.food <= 0 && this.settings.hunger) warn.push('STARVING');
        if (warn.length) {
            ctx.font = 'bold 11px VT323, monospace';
            ctx.fillStyle = warn[0] === 'LOW AMMO' ? '#ffa657' : '#f85149';
            ctx.fillText(warn.join(' · '), ent.x - warn.join(' · ').length * 2.2, by + 22);
        }
    },

    getUnitSpriteKey(ent) {
        if (ent.type === 'surv_civilian') return 'unit_surv_civilian' + (ent.variant || 0);
        return 'unit_' + ent.type;
    },

    // Update 3: pulsing green biohazard ring + countdown bar on infected humans
    renderInfectionMarker(ctx, ent) {
        const t = performance.now() * 0.008;
        const pulse = 0.5 + Math.sin(t + ent.id) * 0.5;
        ctx.strokeStyle = `rgba(166, 226, 46, ${0.45 + pulse * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ent.x, ent.y, ent.radius + 4 + pulse * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = 'bold 14px VT323, monospace';
        ctx.fillStyle = '#a6e22e';
        ctx.fillText('☣', ent.x + ent.radius - 2, ent.y - ent.radius - 2);
        const pct = Math.max(0, Math.min(1, ent.infectionTimer / INFECTION_TIME));
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(ent.x - 12, ent.y + 17, 24, 4);
        ctx.fillStyle = pct > 0.35 ? '#a6e22e' : '#f85149';
        ctx.fillRect(ent.x - 11, ent.y + 18, 22 * pct, 2);
    },

    getSurvivorSpriteKey(ent) {
        return ent.type === 'civilian' ? 'surv_civilian' + (ent.variant || 0) : 'surv_' + ent.type;
    },

    renderHealthBar(ctx, cx, y, width, hp, maxHp, color) {
        const pct = Math.max(0, Math.min(1, hp / maxHp));
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(cx - width / 2 - 1, y - 1, width + 2, 5);
        ctx.fillStyle = color;
        ctx.fillRect(cx - width / 2, y, width * pct, 3);
    }
});
