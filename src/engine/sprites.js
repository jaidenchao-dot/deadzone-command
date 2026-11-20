// ============================================================================
// 3. PROCEDURAL PIXEL-ART SPRITE ATLAS (URBAN NYC + MILITARY + 4 HIVE TYPES)
// ============================================================================
const SpriteBank = {};

function createPixelCanvas(w, h, drawFn) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    drawFn(ctx, w, h);
    return c;
}

function initSprites() {
    // Urban & Park Terrain Tiles (32x32)
    SpriteBank.tile_park = createPixelCanvas(32, 32, (ctx) => {
        ctx.fillStyle = '#1d291c';
        ctx.fillRect(0, 0, 32, 32);
        const shades = ['#253423', '#182217', '#2d3f2a', '#223020', '#38462f'];
        for (let i = 0; i < 54; i++) {
            ctx.fillStyle = shades[i % shades.length];
            const px = (i * 7 + (i % 3) * 5) % 30;
            const py = (i * 13 + (i % 5) * 3) % 30;
            ctx.fillRect(px, py, 2, 2);
            if (i % 7 === 0) {
                ctx.fillStyle = '#4e422e'; // autumn/dead leaves
                ctx.fillRect(px + 1, py, 2, 1);
            }
        }
    });

    SpriteBank.tile_road = createPixelCanvas(32, 32, (ctx) => {
        ctx.fillStyle = '#1f2329';
        ctx.fillRect(0, 0, 32, 32);
        ctx.fillStyle = '#181b20';
        for (let i = 0; i < 26; i++) {
            ctx.fillRect((i * 11) % 30, (i * 17) % 30, 2, 2);
        }
        // Asphalt cracks & grime
        ctx.fillStyle = '#2d333c';
        ctx.fillRect(4, 7, 7, 1);
        ctx.fillRect(19, 23, 8, 1);
        ctx.fillRect(10, 12, 1, 5);
    });

    SpriteBank.tile_sidewalk = createPixelCanvas(32, 32, (ctx) => {
        ctx.fillStyle = '#434a54';
        ctx.fillRect(0, 0, 32, 32);
        // Sidewalk slab grid & curb edge
        ctx.fillStyle = '#2c3138';
        ctx.fillRect(0, 0, 32, 1);
        ctx.fillRect(0, 16, 32, 1);
        ctx.fillRect(0, 0, 1, 32);
        ctx.fillRect(16, 0, 1, 32);
        ctx.fillStyle = '#505864';
        ctx.fillRect(2, 2, 13, 13);
        ctx.fillRect(18, 18, 12, 12);
        // Cracks
        ctx.fillStyle = '#252930';
        ctx.fillRect(6, 7, 5, 1);
        ctx.fillRect(21, 22, 4, 1);
    });

    SpriteBank.tile_plaza = createPixelCanvas(32, 32, (ctx) => {
        ctx.fillStyle = '#333942';
        ctx.fillRect(0, 0, 32, 32);
        ctx.fillStyle = '#262b32';
        ctx.fillRect(0, 0, 32, 1);
        ctx.fillRect(0, 0, 1, 32);
        ctx.fillRect(15, 0, 1, 32);
        ctx.fillRect(0, 15, 32, 1);
        ctx.fillStyle = '#3e4550';
        ctx.fillRect(2, 2, 12, 12);
        ctx.fillRect(17, 17, 13, 13);
    });

    SpriteBank.tile_water = createPixelCanvas(32, 32, (ctx) => {
        ctx.fillStyle = '#0e1d2b';
        ctx.fillRect(0, 0, 32, 32);
        ctx.fillStyle = '#14293d';
        ctx.fillRect(3, 6, 10, 2);
        ctx.fillRect(17, 18, 11, 2);
        ctx.fillRect(6, 26, 8, 1);
        ctx.fillStyle = '#1b3650';
        ctx.fillRect(14, 10, 6, 1);
    });

    SpriteBank.tile_rubble = createPixelCanvas(32, 32, (ctx) => {
        ctx.fillStyle = '#1a1d22';
        ctx.fillRect(0, 0, 32, 32);
        ctx.fillStyle = '#101216';
        ctx.fillRect(3, 4, 14, 12);
        ctx.fillRect(18, 6, 12, 12);
        ctx.fillStyle = '#4c423c';
        ctx.fillRect(2, 2, 13, 11);
        ctx.fillStyle = '#61544d';
        ctx.fillRect(17, 4, 12, 11);
        ctx.fillStyle = '#3e3632';
        ctx.fillRect(4, 16, 14, 13);
        ctx.fillStyle = '#554b45';
        ctx.fillRect(19, 19, 10, 10);
        // Twisted steel rebar & broken masonry
        ctx.fillStyle = '#8b949e';
        ctx.fillRect(6, 4, 7, 1);
        ctx.fillRect(20, 21, 7, 1);
        ctx.fillStyle = '#a35d29';
        ctx.fillRect(10, 11, 2, 5);
        ctx.fillRect(23, 8, 2, 4);
    });

    // Urban Props (Yellow Cab, NYPD Cruiser, Wrecked Bus, Subway Entrance)
    SpriteBank.prop_taxi = createPixelCanvas(36, 22, (ctx) => {
        ctx.fillStyle = '#111418';
        ctx.fillRect(3, 2, 30, 18);
        ctx.fillStyle = '#d29922'; // NYC Yellow Cab
        ctx.fillRect(4, 4, 28, 14);
        ctx.fillStyle = '#1f242c'; // Shattered windshield & rear glass
        ctx.fillRect(21, 5, 5, 12);
        ctx.fillRect(8, 5, 4, 12);
        ctx.fillStyle = '#f2cc60'; // Taxi roof sign
        ctx.fillRect(14, 8, 4, 6);
        ctx.fillStyle = '#161b22'; // Checker stripe
        ctx.fillRect(12, 4, 2, 2);
        ctx.fillRect(16, 4, 2, 2);
        ctx.fillRect(12, 16, 2, 2);
        ctx.fillRect(16, 16, 2, 2);
    });

    SpriteBank.prop_nypd = createPixelCanvas(36, 22, (ctx) => {
        ctx.fillStyle = '#111418';
        ctx.fillRect(3, 2, 30, 18);
        ctx.fillStyle = '#e6edf3'; // NYPD white & blue
        ctx.fillRect(4, 4, 28, 14);
        ctx.fillStyle = '#1f6feb';
        ctx.fillRect(4, 4, 28, 3);
        ctx.fillRect(4, 15, 28, 3);
        ctx.fillStyle = '#1f242c';
        ctx.fillRect(21, 5, 5, 12);
        // Lightbar
        ctx.fillStyle = '#f85149';
        ctx.fillRect(14, 6, 3, 4);
        ctx.fillStyle = '#58a6ff';
        ctx.fillRect(14, 12, 3, 4);
    });

    SpriteBank.prop_bus = createPixelCanvas(58, 26, (ctx) => {
        ctx.fillStyle = '#111418';
        ctx.fillRect(2, 2, 54, 22);
        ctx.fillStyle = '#3b4a5e'; // MTA City Bus
        ctx.fillRect(4, 4, 50, 18);
        ctx.fillStyle = '#c9d1d9';
        ctx.fillRect(4, 4, 50, 4);
        ctx.fillStyle = '#1f6feb';
        ctx.fillRect(4, 18, 50, 3);
        ctx.fillStyle = '#161b22';
        for (let wx = 8; wx <= 44; wx += 7) {
            ctx.fillRect(wx, 8, 5, 9);
        }
    });

    SpriteBank.prop_subway = createPixelCanvas(48, 36, (ctx) => {
        ctx.fillStyle = '#161b22';
        ctx.fillRect(2, 2, 44, 32);
        ctx.fillStyle = '#2d333b';
        ctx.fillRect(4, 4, 40, 28);
        // Dark descending stairwell
        ctx.fillStyle = '#090c10';
        ctx.fillRect(8, 8, 26, 20);
        ctx.fillStyle = '#1c2128';
        for (let sx = 12; sx <= 28; sx += 4) {
            ctx.fillRect(sx, 9, 2, 18);
        }
        // Green NYC subway globe & sign
        ctx.fillStyle = '#2ea043';
        ctx.beginPath();
        ctx.arc(38, 10, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d29922';
        ctx.fillRect(6, 5, 28, 2);
        ctx.fillRect(6, 29, 28, 2);
    });

    // Supply Depot & Crates
    SpriteBank.depot_node = createPixelCanvas(64, 64, (ctx) => {
        ctx.fillStyle = '#22272e';
        ctx.fillRect(4, 4, 56, 56);
        ctx.strokeStyle = '#d29922';
        ctx.lineWidth = 2;
        ctx.strokeRect(6, 6, 52, 52);
        ctx.fillStyle = '#d29922';
        ctx.fillRect(6, 6, 10, 4);
        ctx.fillRect(6, 6, 4, 10);
        ctx.fillRect(48, 6, 10, 4);
        ctx.fillRect(54, 6, 4, 10);
        ctx.fillRect(6, 54, 10, 4);
        ctx.fillRect(6, 48, 4, 10);
        ctx.fillRect(48, 54, 10, 4);
        ctx.fillRect(54, 48, 4, 10);
        ctx.fillStyle = '#161b22';
        ctx.beginPath();
        ctx.arc(32, 32, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#58a6ff';
        ctx.fillRect(26, 26, 12, 12);
        ctx.fillStyle = '#f2cc60';
        ctx.fillRect(14, 24, 8, 16);
        ctx.fillRect(42, 24, 8, 16);
    });

    SpriteBank.crate = createPixelCanvas(24, 24, (ctx) => {
        ctx.fillStyle = '#1c1915';
        ctx.fillRect(2, 2, 20, 20);
        ctx.fillStyle = '#8c6239';
        ctx.fillRect(3, 3, 18, 18);
        ctx.fillStyle = '#b07d48';
        ctx.fillRect(5, 5, 14, 14);
        ctx.fillStyle = '#d29922';
        ctx.fillRect(3, 10, 18, 4);
        ctx.fillRect(10, 3, 4, 18);
    });

    // Military Buildings (Preserved)
    SpriteBank.bld_hq = createPixelCanvas(96, 96, (ctx) => {
        ctx.fillStyle = '#13181f';
        ctx.fillRect(4, 4, 88, 88);
        ctx.fillStyle = '#2d3744';
        ctx.fillRect(8, 8, 80, 80);
        ctx.fillStyle = '#3d4b5c';
        ctx.fillRect(12, 12, 72, 44);
        ctx.fillStyle = '#d29922';
        ctx.fillRect(24, 20, 5, 24);
        ctx.fillRect(43, 20, 5, 24);
        ctx.fillRect(24, 30, 24, 4);
        ctx.fillStyle = '#58a6ff';
        ctx.beginPath();
        ctx.arc(68, 32, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(66, 23, 4, 18);
        ctx.fillStyle = '#161b22';
        ctx.fillRect(18, 62, 60, 22);
        ctx.fillStyle = '#3fb950';
        ctx.fillRect(18, 60, 60, 3);
    });

    SpriteBank.bld_collector = createPixelCanvas(64, 64, (ctx) => {
        ctx.fillStyle = '#161b22';
        ctx.fillRect(4, 4, 56, 56);
        ctx.fillStyle = '#30363d';
        ctx.fillRect(8, 8, 48, 48);
        ctx.fillStyle = '#d29922';
        ctx.fillRect(10, 10, 44, 6);
        ctx.fillStyle = '#1f6feb';
        ctx.fillRect(12, 22, 14, 26);
        ctx.fillStyle = '#58a6ff';
        ctx.fillRect(14, 24, 4, 22);
        ctx.fillStyle = '#484f58';
        ctx.fillRect(32, 22, 20, 26);
        ctx.fillStyle = '#f2cc60';
        ctx.fillRect(35, 25, 14, 10);
    });

    SpriteBank.bld_barracks = createPixelCanvas(64, 64, (ctx) => {
        ctx.fillStyle = '#14191f';
        ctx.fillRect(3, 3, 58, 58);
        ctx.fillStyle = '#3a4d39';
        ctx.fillRect(6, 6, 52, 52);
        ctx.fillStyle = '#4a6148';
        ctx.fillRect(8, 8, 48, 22);
        ctx.fillStyle = '#2a3829';
        for (let y = 10; y < 48; y += 5) ctx.fillRect(8, y, 48, 2);
        ctx.fillStyle = '#161b22';
        ctx.fillRect(22, 46, 20, 12);
        ctx.fillStyle = '#d29922';
        ctx.fillRect(22, 44, 20, 2);
        ctx.fillStyle = '#b59b6d';
        ctx.fillRect(12, 51, 8, 7);
        ctx.fillRect(44, 51, 8, 7);
    });

    SpriteBank.bld_battalionhq = createPixelCanvas(96, 96, (ctx) => {
        ctx.fillStyle = '#14191f';
        ctx.fillRect(4, 4, 88, 88);
        ctx.fillStyle = '#2c3c31';
        ctx.fillRect(8, 8, 80, 80);
        ctx.fillStyle = '#3e5446';
        ctx.fillRect(12, 12, 72, 40);
        ctx.fillStyle = '#d29922';
        ctx.fillRect(20, 20, 12, 4);
        ctx.fillRect(24, 16, 4, 12);
        ctx.fillRect(64, 20, 12, 4);
        ctx.fillRect(68, 16, 4, 12);
        ctx.fillStyle = '#58a6ff';
        ctx.beginPath();
        ctx.arc(48, 32, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(46, 24, 4, 16);
        ctx.fillStyle = '#161b22';
        ctx.fillRect(20, 62, 56, 22);
        ctx.fillStyle = '#3fb950';
        ctx.fillRect(20, 60, 56, 3);
    });

    SpriteBank.bld_motorpool = createPixelCanvas(96, 96, (ctx) => {
        ctx.fillStyle = '#14191f';
        ctx.fillRect(4, 4, 88, 88);
        ctx.fillStyle = '#373e47';
        ctx.fillRect(8, 8, 80, 80);
        ctx.fillStyle = '#48525e';
        ctx.fillRect(12, 12, 72, 34);
        ctx.fillStyle = '#d29922';
        ctx.fillRect(12, 48, 72, 5);
        ctx.fillStyle = '#161b22';
        ctx.fillRect(14, 56, 30, 28);
        ctx.fillRect(52, 56, 30, 28);
        ctx.fillStyle = '#58a6ff';
        ctx.fillRect(14, 54, 30, 2);
        ctx.fillRect(52, 54, 30, 2);
    });

    SpriteBank.bld_armory = createPixelCanvas(64, 64, (ctx) => {
        ctx.fillStyle = '#14191f';
        ctx.fillRect(4, 4, 56, 56);
        ctx.fillStyle = '#2d3b4e';
        ctx.fillRect(7, 7, 50, 50);
        ctx.fillStyle = '#3d516b';
        ctx.fillRect(11, 11, 42, 24);
        ctx.fillStyle = '#58a6ff';
        ctx.fillRect(24, 18, 16, 10);
        ctx.fillStyle = '#d29922';
        ctx.fillRect(14, 42, 36, 10);
    });

    SpriteBank.bld_artillery = createPixelCanvas(64, 64, (ctx) => {
        ctx.fillStyle = '#1c2026';
        ctx.beginPath();
        ctx.arc(32, 32, 27, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#6e5619';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#8c754d';
        ctx.fillRect(10, 10, 44, 6);
        ctx.fillRect(10, 48, 44, 6);
    });

    SpriteBank.bld_silo = createPixelCanvas(64, 64, (ctx) => {
        ctx.fillStyle = '#161b22';
        ctx.fillRect(4, 4, 56, 56);
        ctx.fillStyle = '#30363d';
        ctx.fillRect(8, 8, 48, 48);
        ctx.fillStyle = '#1f242c';
        ctx.beginPath();
        ctx.arc(32, 32, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f85149';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#ff7b72';
        ctx.beginPath();
        ctx.arc(32, 32, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f2cc60';
        ctx.fillRect(30, 30, 4, 4);
    });

    // Update 6: Medic Tent (olive field tent with red-cross roof)
    SpriteBank.bld_medictent = createPixelCanvas(64, 64, (ctx) => {
        ctx.fillStyle = '#14191f';
        ctx.fillRect(3, 6, 58, 54);
        ctx.fillStyle = '#4a5434';
        ctx.fillRect(6, 9, 52, 48);
        ctx.fillStyle = '#5d6a40';
        ctx.fillRect(6, 9, 52, 22);
        ctx.fillStyle = '#3b442a';
        ctx.fillRect(31, 9, 2, 48);
        for (let i = 0; i < 4; i++) { ctx.fillStyle = '#2f3622'; ctx.fillRect(6, 15 + i * 12, 52, 1); }
        ctx.fillStyle = '#e6edf3';
        ctx.fillRect(22, 21, 20, 20);
        ctx.fillStyle = '#da3633';
        ctx.fillRect(29, 23, 6, 16);
        ctx.fillRect(24, 28, 16, 6);
        ctx.fillStyle = '#1b1f24';
        ctx.fillRect(27, 50, 10, 7);
        ctx.fillStyle = '#8b949e';
        ctx.fillRect(4, 7, 3, 3); ctx.fillRect(57, 7, 3, 3); ctx.fillRect(4, 56, 3, 3); ctx.fillRect(57, 56, 3, 3);
    });

    SpriteBank.bld_turret = createPixelCanvas(32, 32, (ctx) => {
        ctx.fillStyle = '#161b22';
        ctx.beginPath();
        ctx.arc(16, 16, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#484f58';
        ctx.beginPath();
        ctx.arc(16, 16, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d29922';
        ctx.fillRect(13, 13, 6, 6);
    });

    SpriteBank.bld_wall = createPixelCanvas(32, 32, (ctx) => {
        ctx.fillStyle = '#2a2217';
        ctx.fillRect(1, 5, 30, 22);
        ctx.fillStyle = '#5c4d32';
        ctx.fillRect(2, 6, 28, 20);
        ctx.fillStyle = '#b59b6d';
        ctx.fillRect(3, 7, 12, 8);
        ctx.fillRect(17, 7, 12, 8);
        ctx.fillRect(6, 16, 11, 8);
        ctx.fillRect(18, 16, 10, 8);
        ctx.fillStyle = '#d4bc90';
        ctx.fillRect(4, 8, 10, 2);
        ctx.fillRect(18, 8, 10, 2);
    });

    SpriteBank.bld_gate_closed = createPixelCanvas(32, 32, (ctx) => {
        ctx.fillStyle = '#161b22';
        ctx.fillRect(0, 4, 32, 24);
        ctx.fillStyle = '#484f58';
        ctx.fillRect(1, 3, 7, 26);
        ctx.fillRect(24, 3, 7, 26);
        ctx.fillStyle = '#30363d';
        ctx.fillRect(8, 7, 8, 18);
        ctx.fillRect(16, 7, 8, 18);
        ctx.fillStyle = '#d29922';
        ctx.fillRect(8, 14, 16, 4);
        ctx.fillStyle = '#161b22';
        ctx.fillRect(15, 7, 2, 18);
        ctx.fillStyle = '#f85149';
        ctx.fillRect(3, 14, 3, 4);
        ctx.fillRect(26, 14, 3, 4);
    });

    SpriteBank.bld_gate_open = createPixelCanvas(32, 32, (ctx) => {
        ctx.fillStyle = '#262b33';
        ctx.fillRect(6, 4, 20, 24);
        ctx.fillStyle = '#484f58';
        ctx.fillRect(1, 3, 7, 26);
        ctx.fillRect(24, 3, 7, 26);
        ctx.fillStyle = '#3fb950';
        ctx.fillRect(3, 14, 3, 4);
        ctx.fillRect(26, 14, 3, 4);
    });

    // Infantry Units (24x24 facing right -> +X)
    const unitColors = {
        engineer: { body: '#d29922', helmet: '#f2cc60', gun: '#8b949e', len: 7 },
        rifleman: { body: '#3b6e3c', helmet: '#274728', gun: '#161b22', len: 10 },
        shotgunner: { body: '#2f4f4f', helmet: '#1c3030', gun: '#30363d', len: 9 },
        sniper: { body: '#4a5d42', helmet: '#34422e', gun: '#0d1117', len: 14 },
        heavy: { body: '#2c3e50', helmet: '#1a252f', gun: '#484f58', len: 12 }
    };
    Object.keys(unitColors).forEach(uType => {
        const cfg = unitColors[uType];
        SpriteBank['unit_' + uType] = createPixelCanvas(24, 24, (ctx) => {
            ctx.fillStyle = cfg.body;
            ctx.fillRect(6, 5, 10, 14);
            ctx.fillStyle = cfg.gun;
            ctx.fillRect(11, 13, cfg.len, 3);
            ctx.fillStyle = cfg.helmet;
            ctx.beginPath();
            ctx.arc(11, 12, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#79c0ff';
            ctx.fillRect(14, 10, 2, 4);
        });
    });

    // Armored Vehicles (facing right -> +X)
    SpriteBank.veh_humvee = createPixelCanvas(40, 28, (ctx) => {
        ctx.fillStyle = '#11161d';
        ctx.fillRect(4, 2, 32, 24);
        ctx.fillStyle = '#5c6b4d';
        ctx.fillRect(5, 4, 30, 20);
        ctx.fillStyle = '#222b35';
        ctx.fillRect(24, 6, 6, 16);
        ctx.fillStyle = '#30363d';
        ctx.beginPath();
        ctx.arc(16, 14, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#161b22';
        ctx.fillRect(16, 13, 16, 2);
    });

    SpriteBank.veh_mrap = createPixelCanvas(44, 30, (ctx) => {
        ctx.fillStyle = '#11161d';
        ctx.fillRect(3, 2, 38, 26);
        ctx.fillStyle = '#7c6f55';
        ctx.fillRect(5, 4, 34, 22);
        ctx.fillStyle = '#584e3b';
        ctx.fillRect(8, 6, 22, 18);
        ctx.fillStyle = '#222b35';
        ctx.fillRect(31, 7, 5, 16);
        ctx.fillStyle = '#30363d';
        ctx.fillRect(18, 12, 16, 3);
    });

    SpriteBank.veh_stryker = createPixelCanvas(48, 30, (ctx) => {
        ctx.fillStyle = '#11161d';
        ctx.fillRect(3, 2, 42, 26);
        ctx.fillStyle = '#4c5c4a';
        ctx.fillRect(5, 4, 38, 22);
        ctx.fillStyle = '#3a4738';
        ctx.fillRect(8, 7, 26, 16);
        ctx.fillStyle = '#161b22';
        ctx.fillRect(22, 13, 18, 3);
    });

    SpriteBank.veh_bradley = createPixelCanvas(48, 32, (ctx) => {
        ctx.fillStyle = '#161b22';
        ctx.fillRect(3, 1, 42, 5);
        ctx.fillRect(3, 26, 42, 5);
        ctx.fillStyle = '#556347';
        ctx.fillRect(5, 5, 38, 22);
        ctx.fillStyle = '#3f4b34';
        ctx.beginPath();
        ctx.arc(22, 16, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#161b22';
        ctx.fillRect(24, 14, 21, 4);
    });

    SpriteBank.veh_blackhawk = createPixelCanvas(56, 56, (ctx) => {
        ctx.fillStyle = '#242b33';
        ctx.fillRect(4, 25, 24, 6);
        ctx.fillRect(2, 20, 5, 16);
        ctx.fillStyle = '#323c47';
        ctx.beginPath();
        ctx.ellipse(34, 28, 16, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#58a6ff';
        ctx.fillRect(42, 23, 6, 10);
        ctx.fillStyle = 'rgba(200, 210, 220, 0.45)';
        ctx.fillRect(33, 3, 2, 50);
        ctx.fillRect(9, 27, 50, 2);
    });

    SpriteBank.veh_abrams = createPixelCanvas(54, 34, (ctx) => {
        ctx.fillStyle = '#11161d';
        ctx.fillRect(3, 1, 48, 6);
        ctx.fillRect(3, 27, 48, 6);
        ctx.fillStyle = '#6c6249';
        ctx.fillRect(5, 6, 42, 22);
        ctx.fillStyle = '#524a36';
        ctx.fillRect(12, 8, 22, 18);
        ctx.fillStyle = '#262b33';
        ctx.fillRect(30, 15, 24, 4);
    });

    // Zombies
    const zColors = {
        walker: { body: '#3f5e42', head: '#568259', r: 5 },
        runner: { body: '#7c2d2d', head: '#b84242', r: 4 },
        spitter: { body: '#3d5c2a', head: '#7ee787', r: 5 },
        brute: { body: '#4a2536', head: '#8a3b5e', r: 8 }
    };
    Object.keys(zColors).forEach(zType => {
        const cfg = zColors[zType];
        const sz = zType === 'brute' ? 34 : 24;
        const mid = sz / 2;
        SpriteBank['zombie_' + zType] = createPixelCanvas(sz, sz, (ctx) => {
            ctx.fillStyle = cfg.body;
            ctx.fillRect(mid - cfg.r - 2, mid - cfg.r - 3, (cfg.r + 2) * 2, (cfg.r + 3) * 2);
            ctx.fillRect(mid + 2, mid - cfg.r - 3, 6, 3);
            ctx.fillRect(mid + 2, mid + cfg.r, 6, 3);
            ctx.fillStyle = cfg.head;
            ctx.beginPath();
            ctx.arc(mid, mid, cfg.r, 0, Math.PI * 2);
            ctx.fill();
        });
    });

    // 4 DISTINCT MONSTROUS HIVE TYPES INTEGRATED INTO THE CITY ENVIRONMENT
    // 1. Subway Breach Hive (erupting from shattered subway stairwell & cracked asphalt)
    SpriteBank.hive_subway = createPixelCanvas(88, 88, (ctx) => {
        // Shattered asphalt & subway concrete border
        ctx.fillStyle = '#181b20';
        ctx.fillRect(8, 12, 72, 64);
        ctx.fillStyle = '#30363d';
        ctx.fillRect(10, 14, 68, 6);
        ctx.fillRect(10, 68, 68, 6);
        ctx.fillStyle = '#d29922'; // subway hazard striping
        for (let x = 12; x < 72; x += 10) {
            ctx.fillRect(x, 15, 5, 4);
            ctx.fillRect(x, 69, 5, 4);
        }
        // Creeping crimson biomass tendrils
        ctx.strokeStyle = '#5c1828';
        ctx.lineWidth = 4;
        for (let a = 0; a < 8; a++) {
            const ang = (a / 8) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(44, 44);
            ctx.lineTo(44 + Math.cos(ang) * 40, 44 + Math.sin(ang) * 38);
            ctx.stroke();
        }
        // Subterranean organic maw & egg sacs
        ctx.fillStyle = '#2d0c16';
        ctx.beginPath();
        ctx.arc(44, 44, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7a1f36';
        ctx.beginPath();
        ctx.arc(44, 44, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#090c10';
        ctx.beginPath();
        ctx.ellipse(44, 44, 11, 7, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff7b72';
        ctx.fillRect(28, 32, 5, 5);
        ctx.fillRect(55, 50, 6, 5);
    });

    // 2. Spore Spire Hive (fused into collapsed skyscraper steel girders & toxic sacs)
    SpriteBank.hive_spore = createPixelCanvas(92, 92, (ctx) => {
        // Collapsed skyscraper concrete & steel girders
        ctx.fillStyle = '#262b33';
        ctx.fillRect(12, 12, 68, 68);
        ctx.fillStyle = '#484f58';
        ctx.fillRect(8, 38, 76, 6);
        ctx.fillRect(42, 8, 6, 76);
        // Toxic fungal spore clusters
        const sacs = [[34, 34, 18], [58, 36, 15], [36, 58, 16], [56, 56, 14], [46, 46, 20]];
        sacs.forEach(([sx, sy, sr]) => {
            ctx.fillStyle = '#1f3a24';
            ctx.beginPath();
            ctx.arc(sx, sy, sr + 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#38663a';
            ctx.beginPath();
            ctx.arc(sx, sy, sr, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#7ee787';
            ctx.beginPath();
            ctx.arc(sx - 2, sy - 2, sr * 0.42, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.fillStyle = '#f2cc60';
        ctx.fillRect(44, 44, 4, 4);
    });

    // 3. Flesh-Foundry Hive (armored chitinous carapace welded onto tanker & industrial rubble)
    SpriteBank.hive_foundry = createPixelCanvas(96, 96, (ctx) => {
        // Wrecked fuel tanker & scorched concrete pad
        ctx.fillStyle = '#1a1d22';
        ctx.fillRect(10, 14, 76, 68);
        ctx.fillStyle = '#3b434d';
        ctx.fillRect(14, 24, 68, 22);
        // Thick armored chitin plates & bone ridges
        ctx.fillStyle = '#2b121d';
        ctx.beginPath();
        ctx.arc(48, 48, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#521e33';
        ctx.beginPath();
        ctx.arc(48, 48, 26, 0, Math.PI * 2);
        ctx.fill();
        // Bone-like rib plates
        ctx.fillStyle = '#9e8c7a';
        for (let i = -2; i <= 2; i++) {
            ctx.fillRect(24, 46 + i * 9, 48, 4);
        }
        // Molten bio-core
        ctx.fillStyle = '#ffa657';
        ctx.beginPath();
        ctx.arc(48, 48, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff7b72';
        ctx.beginPath();
        ctx.arc(48, 48, 5, 0, Math.PI * 2);
        ctx.fill();
    });

    // 4. Apex Overmind Hive (massive multi-lobed neural-biomass fortress in Central Park)
    SpriteBank.hive_apex = createPixelCanvas(104, 104, (ctx) => {
        // Arterial root tendrils gripping plaza & park stone
        ctx.strokeStyle = '#3d1122';
        ctx.lineWidth = 6;
        for (let a = 0; a < 12; a++) {
            const ang = (a / 12) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(52, 52);
            ctx.lineTo(52 + Math.cos(ang) * 48, 52 + Math.sin(ang) * 48);
            ctx.stroke();
        }
        ctx.fillStyle = '#220913';
        ctx.beginPath();
        ctx.arc(52, 52, 38, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5c1832';
        ctx.beginPath();
        ctx.arc(52, 52, 29, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#9e2a4b';
        ctx.beginPath();
        ctx.arc(52, 52, 19, 0, Math.PI * 2);
        ctx.fill();
        // Glowing crimson neural eyes
        const eyes = [[52, 52, 8], [38, 42, 4], [66, 42, 4], [40, 64, 4], [64, 64, 4]];
        eyes.forEach(([ex, ey, er]) => {
            ctx.fillStyle = '#ff7b72';
            ctx.beginPath();
            ctx.arc(ex, ey, er, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffd166';
            ctx.fillRect(ex - 1, ey - 1, 3, 3);
        });
    });

    // ===== UPDATE 2: CIVILIAN SURVIVORS (24x24 facing right -> +X) =====
    const civVariants = [
        { shirt: '#4a6fa5', pants: '#2b3445', hair: '#3b2a1e', skin: '#c99a6e' },
        { shirt: '#8a4f9e', pants: '#3a3340', hair: '#d8b25a', skin: '#e0b48a' },
        { shirt: '#b8860b', pants: '#2f3a2f', hair: '#1c1410', skin: '#8d5a3b' }
    ];
    const drawSurvivorBody = (ctx, shirt, pants, skin, hair) => {
        ctx.fillStyle = pants;
        ctx.fillRect(5, 8, 5, 8);
        ctx.fillStyle = shirt;
        ctx.fillRect(8, 6, 8, 12);
        ctx.fillRect(14, 5, 3, 3);
        ctx.fillRect(14, 16, 3, 3);
        ctx.fillStyle = skin;
        ctx.fillRect(17, 5, 2, 3);
        ctx.fillRect(17, 16, 2, 3);
        ctx.beginPath();
        ctx.arc(12, 12, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hair;
        ctx.beginPath();
        ctx.arc(11, 12, 4, Math.PI * 0.5, Math.PI * 1.5);
        ctx.fill();
    };
    civVariants.forEach((cv, i) => {
        SpriteBank['surv_civilian' + i] = createPixelCanvas(24, 24, (ctx) => {
            drawSurvivorBody(ctx, cv.shirt, cv.pants, cv.skin, cv.hair);
        });
    });

    SpriteBank.surv_medic = createPixelCanvas(24, 24, (ctx) => {
        drawSurvivorBody(ctx, '#d0d7de', '#30363d', '#c99a6e', '#2b2016');
        ctx.fillStyle = '#f85149'; // red cross on scrubs/coat
        ctx.fillRect(9, 10, 5, 1);
        ctx.fillRect(11, 8, 1, 5);
        ctx.fillStyle = '#e6edf3'; // med kit
        ctx.fillRect(16, 16, 4, 4);
        ctx.fillStyle = '#f85149';
        ctx.fillRect(17, 17, 2, 2);
    });

    SpriteBank.surv_mechanic = createPixelCanvas(24, 24, (ctx) => {
        drawSurvivorBody(ctx, '#d1792c', '#8a4a17', '#a8754c', '#3b2a1e');
        ctx.fillStyle = '#8b949e'; // wrench
        ctx.fillRect(17, 6, 5, 2);
        ctx.fillRect(21, 5, 2, 4);
        ctx.fillStyle = '#1f6feb'; // cap
        ctx.beginPath();
        ctx.arc(11, 12, 3, Math.PI * 0.6, Math.PI * 1.4);
        ctx.fill();
    });

    SpriteBank.surv_militia = createPixelCanvas(24, 24, (ctx) => {
        // Flannel-and-denim volunteer with a hunting rifle and blue friendly armband
        ctx.fillStyle = '#2f4a6b';
        ctx.fillRect(6, 5, 10, 14);
        ctx.fillStyle = '#7a2f2a';
        ctx.fillRect(8, 5, 8, 14);
        ctx.fillStyle = '#2a1a18';
        ctx.fillRect(8, 8, 8, 1);
        ctx.fillRect(8, 12, 8, 1);
        ctx.fillRect(8, 16, 8, 1);
        ctx.fillStyle = '#6b4a2b'; // wooden rifle stock
        ctx.fillRect(11, 13, 11, 3);
        ctx.fillStyle = '#161b22';
        ctx.fillRect(18, 13, 5, 2);
        ctx.fillStyle = '#c99a6e';
        ctx.beginPath();
        ctx.arc(11, 12, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4a5d42'; // ball cap
        ctx.beginPath();
        ctx.arc(10, 12, 4, Math.PI * 0.5, Math.PI * 1.5);
        ctx.fill();
        ctx.fillStyle = '#58a6ff'; // friendly armband
        ctx.fillRect(13, 5, 3, 2);
    });

    // Locked survivor shelter door (boarded & padlocked) and breached door
    SpriteBank.shelter_locked = createPixelCanvas(32, 32, (ctx) => {
        ctx.fillStyle = '#161b22';
        ctx.fillRect(3, 2, 26, 28);
        ctx.fillStyle = '#484f58';
        ctx.fillRect(4, 3, 24, 26);
        ctx.fillStyle = '#5a4632';
        ctx.fillRect(7, 5, 18, 23);
        ctx.fillStyle = '#8c6239'; // nailed planks
        ctx.fillRect(5, 9, 22, 3);
        ctx.fillRect(5, 19, 22, 3);
        ctx.fillStyle = '#b07d48';
        ctx.fillRect(5, 9, 22, 1);
        ctx.fillRect(5, 19, 22, 1);
        ctx.fillStyle = '#f2cc60'; // padlock
        ctx.fillRect(14, 13, 5, 5);
        ctx.fillStyle = '#8b949e';
        ctx.fillRect(15, 11, 3, 2);
        ctx.fillStyle = '#e6edf3'; // chalk "SOS" tally marks
        ctx.fillRect(8, 24, 2, 1);
        ctx.fillRect(12, 24, 2, 1);
        ctx.fillRect(16, 24, 2, 1);
        ctx.fillRect(8, 26, 10, 1);
    });

    SpriteBank.shelter_open = createPixelCanvas(32, 32, (ctx) => {
        ctx.fillStyle = '#161b22';
        ctx.fillRect(3, 2, 26, 28);
        ctx.fillStyle = '#484f58';
        ctx.fillRect(4, 3, 24, 26);
        ctx.fillStyle = '#090c10'; // dark empty doorway
        ctx.fillRect(7, 5, 18, 23);
        ctx.fillStyle = '#5a4632'; // door swung open
        ctx.fillRect(22, 5, 4, 23);
        ctx.fillStyle = '#8c6239'; // broken planks on the floor
        ctx.fillRect(6, 27, 9, 2);
        ctx.fillRect(14, 25, 8, 2);
    });

    // Survivor outpost barricade (pallets, sandbags & blue tarp)
    SpriteBank.fort_barricade = createPixelCanvas(32, 32, (ctx) => {
        ctx.fillStyle = '#1c1915';
        ctx.fillRect(1, 5, 30, 22);
        ctx.fillStyle = '#8c6239';
        ctx.fillRect(2, 6, 28, 8);
        ctx.fillStyle = '#5a4632';
        ctx.fillRect(2, 9, 28, 1);
        ctx.fillRect(9, 6, 1, 8);
        ctx.fillRect(20, 6, 1, 8);
        ctx.fillStyle = '#2f5d8a';
        ctx.fillRect(3, 15, 14, 10);
        ctx.fillStyle = '#3b74a8';
        ctx.fillRect(4, 16, 12, 2);
        ctx.fillStyle = '#b59b6d';
        ctx.fillRect(18, 15, 11, 5);
        ctx.fillRect(18, 21, 11, 5);
        ctx.fillStyle = '#d4bc90';
        ctx.fillRect(19, 16, 9, 1);
    });

    // ===== UPDATE 2: HOSTILE MERCENARIES / BANDITS (24x24 facing right -> +X) =====
    SpriteBank.merc_raider = createPixelCanvas(24, 24, (ctx) => {
        ctx.fillStyle = '#5b4630'; // patched leather jacket
        ctx.fillRect(6, 5, 10, 14);
        ctx.fillStyle = '#8b949e'; // shoulder spikes
        ctx.fillRect(7, 3, 2, 2);
        ctx.fillRect(12, 3, 2, 2);
        ctx.fillRect(7, 19, 2, 2);
        ctx.fillRect(12, 19, 2, 2);
        ctx.fillStyle = '#161b22'; // sawn-off rifle
        ctx.fillRect(11, 13, 10, 3);
        ctx.fillStyle = '#3a2a1f'; // hood
        ctx.beginPath();
        ctx.arc(11, 12, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#b62f2a'; // red bandana mask
        ctx.fillRect(12, 9, 4, 6);
        ctx.fillStyle = '#f2cc60'; // goggle glint
        ctx.fillRect(15, 10, 1, 2);
    });

    SpriteBank.merc_gunner = createPixelCanvas(24, 24, (ctx) => {
        ctx.fillStyle = '#4e3b2c';
        ctx.fillRect(5, 4, 12, 16);
        ctx.fillStyle = '#7d858f'; // welded scrap armor plates
        ctx.fillRect(6, 5, 5, 6);
        ctx.fillRect(6, 13, 5, 6);
        ctx.fillStyle = '#a35d29';
        ctx.fillRect(7, 6, 2, 1);
        ctx.fillRect(8, 16, 2, 1);
        ctx.fillStyle = '#30363d'; // belt-fed LMG
        ctx.fillRect(11, 12, 12, 4);
        ctx.fillStyle = '#d29922';
        ctx.fillRect(12, 16, 4, 2);
        ctx.fillStyle = '#2d333b'; // gas mask
        ctx.beginPath();
        ctx.arc(11, 12, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff7b72'; // red lenses
        ctx.fillRect(14, 9, 2, 2);
        ctx.fillRect(14, 13, 2, 2);
    });

    SpriteBank.merc_marksman = createPixelCanvas(24, 24, (ctx) => {
        ctx.fillStyle = '#4a4330'; // ragged ghillie cloak
        ctx.fillRect(5, 5, 11, 14);
        ctx.fillStyle = '#5f5a3a';
        ctx.fillRect(4, 7, 2, 3);
        ctx.fillRect(4, 14, 2, 3);
        ctx.fillRect(8, 4, 3, 2);
        ctx.fillStyle = '#0d1117'; // long rifle
        ctx.fillRect(11, 13, 13, 2);
        ctx.fillStyle = '#ff7b72'; // scope glint
        ctx.fillRect(16, 12, 2, 1);
        ctx.fillStyle = '#3b3226';
        ctx.beginPath();
        ctx.arc(11, 12, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#b62f2a';
        ctx.fillRect(13, 10, 3, 4);
    });

    SpriteBank.mstruct_wall = createPixelCanvas(32, 32, (ctx) => {
        ctx.fillStyle = '#1c1410';
        ctx.fillRect(1, 6, 30, 21);
        ctx.fillStyle = '#7a4a26'; // rusted corrugated sheets
        ctx.fillRect(2, 7, 14, 19);
        ctx.fillStyle = '#9c5d2e';
        ctx.fillRect(16, 8, 14, 18);
        ctx.fillStyle = '#5a3418';
        for (let x = 4; x < 30; x += 4) ctx.fillRect(x, 8, 1, 17);
        ctx.fillStyle = '#0d1117'; // stacked tire
        ctx.beginPath();
        ctx.arc(9, 21, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#30363d';
        ctx.beginPath();
        ctx.arc(9, 21, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c9d1d9'; // rebar spikes
        for (let x = 3; x < 30; x += 6) ctx.fillRect(x, 3, 2, 4);
    });

    SpriteBank.mstruct_tower = createPixelCanvas(48, 48, (ctx) => {
        ctx.fillStyle = '#1c1410';
        ctx.fillRect(4, 4, 40, 40);
        ctx.fillStyle = '#5c4033'; // scaffold platform
        ctx.fillRect(6, 6, 36, 36);
        ctx.strokeStyle = '#3e2b20';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(7, 7); ctx.lineTo(41, 41);
        ctx.moveTo(41, 7); ctx.lineTo(7, 41);
        ctx.stroke();
        ctx.fillStyle = '#8b949e'; // corner posts
        ctx.fillRect(5, 5, 5, 5);
        ctx.fillRect(38, 5, 5, 5);
        ctx.fillRect(5, 38, 5, 5);
        ctx.fillRect(38, 38, 5, 5);
        ctx.fillStyle = '#b59b6d'; // sandbag nest
        ctx.beginPath();
        ctx.arc(24, 24, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2a1a12';
        ctx.beginPath();
        ctx.arc(24, 24, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#b62f2a'; // gang banner
        ctx.fillRect(38, 10, 8, 6);
        ctx.fillStyle = '#e6edf3';
        ctx.fillRect(41, 12, 2, 2);
    });

    SpriteBank.mstruct_bunker = createPixelCanvas(72, 72, (ctx) => {
        ctx.fillStyle = '#120d0a';
        ctx.fillRect(3, 3, 66, 66);
        ctx.fillStyle = '#7c2d24'; // rusted shipping container
        ctx.fillRect(6, 8, 60, 24);
        ctx.fillStyle = '#4a5a3a'; // second container
        ctx.fillRect(6, 38, 60, 24);
        ctx.fillStyle = '#5a1e18';
        for (let x = 9; x < 64; x += 5) ctx.fillRect(x, 9, 2, 22);
        ctx.fillStyle = '#34402a';
        for (let x = 9; x < 64; x += 5) ctx.fillRect(x, 39, 2, 22);
        ctx.fillStyle = '#e6edf3'; // painted skull
        ctx.fillRect(30, 13, 12, 9);
        ctx.fillRect(32, 22, 8, 4);
        ctx.fillStyle = '#7c2d24';
        ctx.fillRect(32, 16, 3, 3);
        ctx.fillRect(37, 16, 3, 3);
        ctx.fillStyle = '#d29922'; // fuel barrels
        ctx.beginPath();
        ctx.arc(14, 50, 5, 0, Math.PI * 2);
        ctx.arc(26, 50, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#b62f2a'; // gang flag
        ctx.fillRect(56, 34, 12, 8);
        ctx.fillStyle = '#8b949e';
        ctx.fillRect(55, 30, 1, 14);
    });

    // ===== UPDATE 3: MUTATED ZOMBIE VARIANTS (facing right -> +X) =====
    // Bloated Pustule — swollen acid-filled mass
    SpriteBank.zombie_bloater = createPixelCanvas(34, 34, (ctx) => {
        ctx.fillStyle = '#4b5a22';
        ctx.beginPath();
        ctx.arc(16, 17, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6f8a2c';
        ctx.beginPath();
        ctx.arc(15, 16, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c3e04a'; // glowing pustules
        [[9, 10, 3], [20, 9, 2], [11, 23, 3], [21, 22, 2], [16, 16, 2]].forEach(([px, py, pr]) => {
            ctx.beginPath();
            ctx.arc(px, py, pr, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.fillStyle = '#8a3b5e'; // small head buried in flesh
        ctx.beginPath();
        ctx.arc(27, 17, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4b5a22';
        ctx.fillRect(25, 6, 5, 3);
        ctx.fillRect(25, 25, 5, 3);
    });

    // Skinless Stalker — lean exposed-muscle predator with long claws
    SpriteBank.zombie_stalker = createPixelCanvas(28, 28, (ctx) => {
        ctx.fillStyle = '#5c1a1a';
        ctx.fillRect(7, 9, 12, 10);
        ctx.fillStyle = '#8f2d2d'; // exposed muscle striations
        ctx.fillRect(8, 10, 10, 1);
        ctx.fillRect(8, 13, 10, 1);
        ctx.fillRect(8, 16, 10, 1);
        ctx.fillStyle = '#d8d0c0'; // bone claws
        ctx.fillRect(17, 6, 9, 2);
        ctx.fillRect(17, 20, 9, 2);
        ctx.fillRect(24, 4, 2, 3);
        ctx.fillRect(24, 21, 2, 3);
        ctx.fillStyle = '#2b0d0d';
        ctx.beginPath();
        ctx.arc(14, 14, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd166'; // eyes
        ctx.fillRect(16, 12, 2, 1);
        ctx.fillRect(16, 15, 2, 1);
    });

    // Howling Screamer — pale gaunt body with a gaping red maw
    SpriteBank.zombie_screamer = createPixelCanvas(26, 26, (ctx) => {
        ctx.fillStyle = '#9aa39a';
        ctx.fillRect(5, 6, 12, 14);
        ctx.fillStyle = '#7a837a';
        ctx.fillRect(14, 4, 6, 3);
        ctx.fillRect(14, 19, 6, 3);
        ctx.fillStyle = '#c9cfc4';
        ctx.beginPath();
        ctx.arc(13, 13, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5a0f18'; // gaping maw
        ctx.beginPath();
        ctx.arc(16, 13, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f85149';
        ctx.fillRect(16, 12, 2, 2);
        ctx.strokeStyle = 'rgba(248, 81, 73, 0.7)'; // sound rings
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(16, 13, 8, -0.7, 0.7);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(16, 13, 11, -0.6, 0.6);
        ctx.stroke();
    });

    // Flesh Abomination — towering fused mass of bodies with bone spikes
    SpriteBank.zombie_abomination = createPixelCanvas(52, 52, (ctx) => {
        ctx.fillStyle = '#2b0f1b';
        ctx.beginPath();
        ctx.ellipse(25, 26, 22, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5c1f35';
        ctx.beginPath();
        ctx.ellipse(24, 26, 18, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7d2b47';
        [[16, 18, 6], [30, 20, 5], [20, 33, 6], [32, 33, 4]].forEach(([px, py, pr]) => {
            ctx.beginPath();
            ctx.arc(px, py, pr, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.fillStyle = '#d8d0c0'; // bone spikes
        ctx.fillRect(8, 8, 3, 7);
        ctx.fillRect(22, 4, 3, 7);
        ctx.fillRect(10, 38, 3, 7);
        ctx.fillRect(28, 41, 3, 7);
        ctx.fillStyle = '#4a1a2c'; // massive arms
        ctx.fillRect(34, 6, 14, 7);
        ctx.fillRect(34, 39, 14, 7);
        ctx.fillStyle = '#d8d0c0';
        ctx.fillRect(46, 5, 4, 2);
        ctx.fillRect(46, 45, 4, 2);
        ctx.fillStyle = '#ff7b72'; // cluster of eyes
        [[36, 22], [38, 27], [35, 31], [40, 25]].forEach(([ex, ey]) => ctx.fillRect(ex, ey, 2, 2));
    });

    // ===== UPDATE 3: COMBAT MEDIC (24x24 facing right -> +X) =====
    SpriteBank.unit_medic = createPixelCanvas(24, 24, (ctx) => {
        ctx.fillStyle = '#5a6b4e'; // olive fatigues
        ctx.fillRect(6, 5, 10, 14);
        ctx.fillStyle = '#e6edf3'; // white aid bag
        ctx.fillRect(5, 13, 5, 5);
        ctx.fillStyle = '#f85149';
        ctx.fillRect(6, 15, 3, 1);
        ctx.fillRect(7, 14, 1, 3);
        ctx.fillStyle = '#161b22'; // sidearm
        ctx.fillRect(11, 13, 6, 3);
        ctx.fillStyle = '#d0d7de'; // white helmet
        ctx.beginPath();
        ctx.arc(11, 12, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f85149'; // red cross on helmet
        ctx.fillRect(9, 11, 5, 2);
        ctx.fillRect(10, 10, 2, 5);
        ctx.fillStyle = '#79c0ff';
        ctx.fillRect(14, 10, 2, 4);
    });

    // ===== UPDATE 3: RESCUED SURVIVORS AS PLAYER UNITS (reuse Update 2 survivor art) =====
    for (let i = 0; i < 3; i++) SpriteBank['unit_surv_civilian' + i] = SpriteBank['surv_civilian' + i];
    SpriteBank.unit_surv_civilian = SpriteBank.surv_civilian0;
    SpriteBank.unit_surv_medic = SpriteBank.surv_medic;
    SpriteBank.unit_surv_mechanic = SpriteBank.surv_mechanic;
    SpriteBank.unit_surv_militia = SpriteBank.surv_militia;

    // ===== UPDATE 4: COMBAT MECHANIC (24x24 facing right -> +X) =====
    SpriteBank.unit_mechanic = createPixelCanvas(24, 24, (ctx) => {
        ctx.fillStyle = '#4e5a3e'; // olive coveralls
        ctx.fillRect(6, 5, 10, 14);
        ctx.fillStyle = '#e3b341'; // hi-vis vest stripes
        ctx.fillRect(7, 7, 8, 2);
        ctx.fillRect(7, 15, 8, 2);
        ctx.fillStyle = '#8c6239'; // toolbox on back
        ctx.fillRect(3, 9, 4, 6);
        ctx.fillStyle = '#8b949e'; // wrench
        ctx.fillRect(12, 13, 8, 2);
        ctx.fillRect(19, 12, 2, 4);
        ctx.fillStyle = '#3b4a32'; // helmet
        ctx.beginPath();
        ctx.arc(11, 12, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e3b341'; // yellow helmet stripe
        ctx.fillRect(8, 11, 7, 2);
        ctx.fillStyle = '#79c0ff';
        ctx.fillRect(14, 10, 2, 4);
    });

    // ===== UPDATE 4: NEW MILITARY VEHICLES (facing right -> +X) =====
    SpriteBank.veh_rockettruck = createPixelCanvas(50, 30, (ctx) => {
        ctx.fillStyle = '#11161d';
        ctx.fillRect(3, 2, 44, 26);
        ctx.fillStyle = '#5c6b4d'; // chassis
        ctx.fillRect(5, 4, 40, 22);
        ctx.fillStyle = '#4a5740'; // cab
        ctx.fillRect(35, 6, 10, 18);
        ctx.fillStyle = '#222b35';
        ctx.fillRect(40, 8, 4, 14);
        ctx.fillStyle = '#3b4433'; // launcher pod
        ctx.fillRect(7, 6, 26, 18);
        ctx.fillStyle = '#161b22'; // 6 rocket tubes
        for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 3; tx++) {
            ctx.beginPath();
            ctx.arc(12 + tx * 7, 11 + ty * 8, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = '#d29922';
        ctx.fillRect(9, 8, 14, 2);
        ctx.fillRect(9, 20, 14, 2);
    });

    SpriteBank.veh_flameapc = createPixelCanvas(44, 32, (ctx) => {
        ctx.fillStyle = '#161b22'; // tracks
        ctx.fillRect(3, 1, 38, 5);
        ctx.fillRect(3, 26, 38, 5);
        ctx.fillStyle = '#5a5a3e';
        ctx.fillRect(5, 5, 34, 22);
        ctx.fillStyle = '#48482f';
        ctx.fillRect(8, 8, 18, 16);
        ctx.fillStyle = '#30363d'; // flame turret
        ctx.beginPath();
        ctx.arc(26, 16, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#161b22';
        ctx.fillRect(28, 14, 14, 4);
        ctx.fillStyle = '#ffa657'; // pilot light
        ctx.fillRect(41, 15, 2, 2);
        ctx.fillStyle = '#f85149'; // fuel tanks
        ctx.fillRect(9, 9, 4, 6);
        ctx.fillRect(9, 17, 4, 6);
    });

    SpriteBank.veh_apache = createPixelCanvas(56, 56, (ctx) => {
        ctx.fillStyle = '#2b332a'; // tail boom
        ctx.fillRect(4, 26, 22, 4);
        ctx.fillRect(2, 21, 4, 14);
        ctx.fillStyle = '#3a4535'; // narrow fuselage
        ctx.beginPath();
        ctx.ellipse(34, 28, 15, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2b332a'; // stub wings with rocket pods
        ctx.fillRect(28, 17, 6, 22);
        ctx.fillStyle = '#161b22';
        ctx.fillRect(27, 16, 8, 3);
        ctx.fillRect(27, 37, 8, 3);
        ctx.fillStyle = '#58a6ff'; // tandem canopy
        ctx.fillRect(40, 25, 4, 6);
        ctx.fillRect(45, 26, 3, 4);
        ctx.fillStyle = '#161b22'; // chin gun
        ctx.fillRect(48, 27, 6, 2);
    });

    SpriteBank.veh_bomber = createPixelCanvas(64, 64, (ctx) => {
        ctx.fillStyle = '#3d4450'; // swept wings
        ctx.beginPath();
        ctx.moveTo(38, 30); ctx.lineTo(18, 4); ctx.lineTo(12, 6); ctx.lineTo(26, 30);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(38, 34); ctx.lineTo(18, 60); ctx.lineTo(12, 58); ctx.lineTo(26, 34);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#4b5361'; // fuselage
        ctx.beginPath();
        ctx.ellipse(32, 32, 28, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3d4450'; // tail fins
        ctx.fillRect(4, 24, 8, 4);
        ctx.fillRect(4, 36, 8, 4);
        ctx.fillStyle = '#161b22'; // cockpit glass
        ctx.fillRect(52, 30, 6, 4);
        ctx.fillStyle = '#ffa657'; // engine glow
        ctx.fillRect(14, 22, 3, 3);
        ctx.fillRect(14, 39, 3, 3);
        ctx.fillStyle = '#f85149'; // red wingtip light
        ctx.fillRect(12, 5, 2, 2);
    });

    // ===== UPDATE 4: ABANDONED CIVILIAN VEHICLES (rusted, dusty, broken glass) =====
    const civCar = (w, h, body, roof, extra) => createPixelCanvas(w, h, (ctx) => {
        ctx.fillStyle = '#111418';
        ctx.fillRect(2, 2, w - 4, h - 4);
        ctx.fillStyle = body;
        ctx.fillRect(3, 4, w - 6, h - 8);
        ctx.fillStyle = roof;
        ctx.fillRect(Math.floor(w * 0.3), 5, Math.floor(w * 0.38), h - 10);
        ctx.fillStyle = '#1f242c'; // windshield & rear glass (cracked)
        ctx.fillRect(Math.floor(w * 0.68), 6, 4, h - 12);
        ctx.fillRect(Math.floor(w * 0.22), 6, 3, h - 12);
        ctx.fillStyle = '#8b949e';
        ctx.fillRect(Math.floor(w * 0.69), 8, 1, 4);
        ctx.fillStyle = 'rgba(122, 74, 38, 0.75)'; // rust patches
        ctx.fillRect(5, h - 8, 6, 3);
        ctx.fillRect(w - 12, 5, 5, 2);
        ctx.fillStyle = 'rgba(160, 150, 130, 0.25)'; // dust film
        ctx.fillRect(3, 4, w - 6, Math.floor((h - 8) / 2));
        if (extra) extra(ctx, w, h);
    });
    SpriteBank.veh_civ_sedan = civCar(36, 22, '#5a6f86', '#4a5d72');
    SpriteBank.veh_civ_pickup = civCar(40, 24, '#7a2f2a', '#62261f', (ctx, w, h) => {
        ctx.fillStyle = '#3a1814'; // open cargo bed
        ctx.fillRect(4, 6, 10, h - 12);
        ctx.fillStyle = '#8c6239'; // junk in bed
        ctx.fillRect(6, 8, 4, 3);
    });
    // ===== UPDATE 5: SUPPLY VEHICLES, CHINOOK & AIRBASE =====
    const supplyTruck = (w, h, body, cargo, tracked) => createPixelCanvas(w, h, (ctx) => {
        ctx.fillStyle = '#11161d';
        ctx.fillRect(2, 1, w - 4, h - 2);
        if (tracked) {
            ctx.fillStyle = '#161b22';
            ctx.fillRect(2, 1, w - 4, 5);
            ctx.fillRect(2, h - 6, w - 4, 5);
            ctx.fillStyle = '#30363d';
            for (let x = 4; x < w - 4; x += 4) { ctx.fillRect(x, 2, 2, 3); ctx.fillRect(x, h - 5, 2, 3); }
        } else {
            ctx.fillStyle = '#0d1117'; // wheels
            for (let x = 6; x < w - 8; x += Math.max(8, Math.floor((w - 12) / 3))) { ctx.fillRect(x, 1, 6, 3); ctx.fillRect(x, h - 4, 6, 3); }
        }
        ctx.fillStyle = body;
        ctx.fillRect(4, 5, w - 8, h - 10);
        ctx.fillStyle = cargo; // cargo bed with crates
        ctx.fillRect(5, 6, Math.floor(w * 0.62), h - 12);
        ctx.fillStyle = '#8c6239';
        for (let x = 7; x < Math.floor(w * 0.62); x += 8) { ctx.fillRect(x, 8, 6, 5); ctx.fillRect(x, h - 13, 6, 5); }
        ctx.fillStyle = '#d29922'; // logistics stripe
        ctx.fillRect(5, Math.floor(h / 2) - 1, Math.floor(w * 0.62), 2);
        ctx.fillStyle = '#4a5740'; // cab
        ctx.fillRect(w - 13, 6, 9, h - 12);
        ctx.fillStyle = '#222b35';
        ctx.fillRect(w - 7, 8, 3, h - 16);
    });
    SpriteBank.veh_supplytruck = supplyTruck(42, 26, '#5c6b4d', '#47533b', false);
    SpriteBank.veh_heavysupply = supplyTruck(54, 30, '#6b6a4a', '#55543a', false);
    SpriteBank.veh_trackedsupply = supplyTruck(46, 30, '#4f5a44', '#3e4836', true);

    SpriteBank.veh_chinook = createPixelCanvas(68, 32, (ctx) => {
        ctx.fillStyle = '#3b4433'; // long fuselage
        ctx.beginPath();
        ctx.ellipse(34, 16, 31, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2e3628'; // rotor pylons
        ctx.fillRect(10, 11, 10, 10);
        ctx.fillRect(48, 11, 10, 10);
        ctx.fillStyle = '#d29922'; // cargo markings
        ctx.fillRect(26, 13, 16, 2);
        ctx.fillRect(26, 17, 16, 2);
        ctx.fillStyle = '#58a6ff'; // cockpit
        ctx.fillRect(60, 13, 5, 6);
        ctx.fillStyle = '#161b22'; // sling hook & crate
        ctx.fillRect(31, 24, 6, 6);
    });

    SpriteBank.bld_airbase = createPixelCanvas(128, 128, (ctx) => {
        ctx.fillStyle = '#14191f';
        ctx.fillRect(2, 2, 124, 124);
        ctx.fillStyle = '#2d333b'; // tarmac
        ctx.fillRect(5, 5, 118, 118);
        // Helipads (top row)
        for (let i = 0; i < 3; i++) {
            const cx = 24 + i * 40, cy = 34;
            ctx.fillStyle = '#1f242c';
            ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#d29922'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = '#e6edf3'; // "H"
            ctx.fillRect(cx - 5, cy - 6, 2, 12); ctx.fillRect(cx + 3, cy - 6, 2, 12); ctx.fillRect(cx - 5, cy - 1, 10, 2);
        }
        // Runway (bottom)
        ctx.fillStyle = '#1b1f25';
        ctx.fillRect(5, 84, 118, 30);
        ctx.fillStyle = '#e6edf3';
        for (let x = 10; x < 120; x += 14) ctx.fillRect(x, 98, 8, 2);
        ctx.fillStyle = '#f2cc60'; // parking bay markers
        for (let i = 0; i < 3; i++) { ctx.fillRect(10 + i * 40, 86, 28, 1); ctx.fillRect(10 + i * 40, 111, 28, 1); }
        // Control tower & hangar
        ctx.fillStyle = '#48525e';
        ctx.fillRect(100, 56, 18, 20);
        ctx.fillStyle = '#58a6ff';
        ctx.fillRect(102, 58, 14, 5);
        ctx.fillStyle = '#373e47';
        ctx.fillRect(8, 56, 40, 20);
        ctx.fillStyle = '#d29922';
        ctx.fillRect(8, 56, 40, 2);
        ctx.fillStyle = '#ffa657'; // windsock
        ctx.fillRect(60, 60, 8, 3);
    });

    SpriteBank.veh_civ_van = civCar(46, 26, '#c9c2b0', '#b0a994', (ctx, w, h) => {
        ctx.fillStyle = '#1f6feb'; // faded company stripe
        ctx.fillRect(5, Math.floor(h / 2) - 1, 24, 2);
    });
}
