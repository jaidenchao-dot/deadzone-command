// ============================================================================
// 1. CONSTANTS & GAME DATA DEFINITIONS
// ============================================================================
const TILE_SIZE = 32;
let MAP_COLS = 96;
let MAP_ROWS = 96;
let MAP_WIDTH = MAP_COLS * TILE_SIZE;   // 3072px
let MAP_HEIGHT = MAP_ROWS * TILE_SIZE; // 3072px
// Update 7: Infinite Map Mode uses an effectively endless world (16384 x 16384 tiles ≈ 524k px each way, start in
// the middle — hours of travel to any edge). Only chunks around the player's forces exist in memory.
const STD_MAP_TILES = 96;
const INF_WORLD_TILES = 16384;
const INF_CHUNK = 32;                       // tiles per chunk side (1024 px)
const INF_ORIGIN_CHUNK = INF_WORLD_TILES / INF_CHUNK / 2;   // 256
const INF_GRID_WRAP = 256;                  // toroidal spatial-hash size (cells) in infinite mode
const INF_ALERT_WRAP = 256;                 // toroidal hive-alert grid size (cells) in infinite mode
const INF_LOWDETAIL = { road: '#2b3038', sidewalk: '#30353c', plaza: '#262b31', park: '#1f2c20', rubble: '#3a332e', water: '#0e1d2b' };

const UNIT_DEFS = {
    engineer: {
        name: 'Combat Engineer',
        hotkey: 'E',
        scrap: 75, fuel: 0, pop: 1, buildTime: 5.5,
        hp: 110, speed: 92, range: 115, damage: 9, fireRate: 0.65,
        vision: 240, weapon: 'pistol', frontRank: false,
        desc: 'Constructs bases, claims city Supply Depots with Resource Collectors [R], repairs structures/vehicles, and salvages crates.'
    },
    rifleman: {
        name: 'Assault Rifleman',
        hotkey: 'F',
        scrap: 95, fuel: 0, pop: 1, buildTime: 6.0,
        hp: 145, speed: 96, range: 185, damage: 15, fireRate: 0.34,
        vision: 270, weapon: 'rifle', frontRank: true,
        desc: 'Versatile M4A1 infantry trooper. Effective along avenues and intersections against Walkers and Runners.'
    },
    shotgunner: {
        name: 'Breacher Shotgunner',
        hotkey: 'G',
        scrap: 120, fuel: 15, pop: 1, buildTime: 6.5,
        hp: 195, speed: 92, range: 115, damage: 36, fireRate: 0.82, splash: 26,
        vision: 250, weapon: 'shotgun', frontRank: true,
        desc: 'Heavy Kevlar urban breacher firing 12-gauge buckshot blasts ideal for alley and street-corner ambushes.'
    },
    sniper: {
        name: 'Recon Sniper',
        hotkey: 'N',
        scrap: 165, fuel: 35, pop: 1, buildTime: 8.5,
        hp: 105, speed: 88, range: 355, damage: 88, fireRate: 1.45,
        vision: 400, weapon: 'sniper', frontRank: false, requiresArmory: true,
        desc: 'Long-range .50 BMG marksman with extended urban sightlines down city avenues. Eliminates Spitters and Brutes.'
    },
    heavy: {
        name: 'Heavy M249 Gunner',
        hotkey: 'H',
        scrap: 190, fuel: 45, pop: 2, buildTime: 9.5,
        hp: 250, speed: 78, range: 215, damage: 14, fireRate: 0.14,
        vision: 275, weapon: 'lmg', frontRank: true, requiresArmory: true,
        desc: 'Armored suppression specialist with high-rate M249 SAW light machine gun for locking down intersections.'
    },
    // Update 3: Combat Medic — cures infected humans before they turn
    medic: {
        name: 'Combat Medic',
        hotkey: 'M',
        scrap: 130, fuel: 25, pop: 1, buildTime: 7.0,
        hp: 120, speed: 96, range: 140, damage: 8, fireRate: 0.6,
        vision: 255, weapon: 'pistol', frontRank: false,
        treatCharges: 6, treatCooldown: 40,
        desc: 'Field medic carrying 6 anti-viral treatments. Cures infected soldiers & survivors before they turn [T]. Recharges for 40s once all 6 are spent.'
    },
    // Update 4: Combat Mechanic — repairs friendly buildings & vehicles
    mechanic: {
        name: 'Combat Mechanic',
        hotkey: 'R',
        scrap: 140, fuel: 20, pop: 1, buildTime: 7.0,
        hp: 140, speed: 92, range: 120, damage: 8, fireRate: 0.65,
        vision: 240, weapon: 'pistol', frontRank: false,
        repairBuilding: 45, repairVehicle: 60,
        desc: 'Field mechanic. Repairs damaged friendly buildings (45 HP/s) and vehicles (60 HP/s) [Y]. Automatically fixes nearby damaged equipment when idle.'
    },
    // Update 3: Rescued survivors — special player-owned units (not trainable, use no Command Pop)
    surv_civilian: {
        name: 'Rescued Civilian', shortLabel: 'CIV', isSurvivorUnit: true, unarmed: true,
        scrap: 0, fuel: 0, pop: 0, buildTime: 0,
        hp: 60, speed: 86, range: 0, damage: 0, fireRate: 1,
        vision: 180, weapon: null, frontRank: false,
        desc: 'Rescued civilian under your command. Unarmed. Move them to safety and use RETURN TO HQ [R] near your HQ: joins base support staff (+1 Command Pop).'
    },
    surv_medic: {
        name: 'Rescued Field Medic', shortLabel: 'S-MED', isSurvivorUnit: true, unarmed: true,
        scrap: 0, fuel: 0, pop: 0, buildTime: 0,
        hp: 70, speed: 86, range: 0, damage: 0, fireRate: 1,
        vision: 190, weapon: null, frontRank: false,
        desc: 'Rescued paramedic under your command. Patches up nearby infantry. RETURN TO HQ [R]: +1 Pop and HQ triage (infantry near HQ regenerate HP).'
    },
    surv_mechanic: {
        name: 'Rescued Mechanic', shortLabel: 'S-MEC', isSurvivorUnit: true, unarmed: true,
        scrap: 0, fuel: 0, pop: 0, buildTime: 0,
        hp: 80, speed: 82, range: 0, damage: 0, fireRate: 1,
        vision: 190, weapon: null, frontRank: false,
        desc: 'Rescued mechanic under your command. Patches up nearby vehicles. RETURN TO HQ [R]: +1 Pop and +10% Resource Collector output (max +50%).'
    },
    surv_militia: {
        name: 'Rescued Militia', shortLabel: 'MILI', isSurvivorUnit: true, armed: true,
        scrap: 0, fuel: 0, pop: 0, buildTime: 0,
        hp: 140, speed: 90, range: 190, damage: 13, fireRate: 0.6,
        vision: 240, weapon: 'rifle', frontRank: true,
        desc: 'Armed survivor fighting under your command. RETURN TO HQ [R] to enlist as a full Assault Rifleman (or base support staff if Command Pop is full).'
    }
};

// Update 3: Max distance from HQ at which rescued survivors can be ordered to RETURN TO HQ
const SURVIVOR_RETURN_RANGE = 500;
// Update 3: Infection tuning
const INFECTION_TIME = 18;
// Update 4: economy & population tuning
const MISSILE_LAUNCH_FUEL = 150;
const GRID_CELL = 128;
const ALERT_CELL = 256;   // Update 5: hive-mind alert grid resolution
let GRID_COLS = Math.ceil(MAP_WIDTH / GRID_CELL);
let GRID_ROWS = Math.ceil(MAP_HEIGHT / GRID_CELL);
let GRID_WRAP = false;

function setWorldDimensions(infinite) {
    const tiles = infinite ? INF_WORLD_TILES : STD_MAP_TILES;
    MAP_COLS = tiles; MAP_ROWS = tiles;
    MAP_WIDTH = tiles * TILE_SIZE; MAP_HEIGHT = tiles * TILE_SIZE;
    GRID_WRAP = !!infinite;
    GRID_COLS = infinite ? INF_GRID_WRAP : Math.ceil(MAP_WIDTH / GRID_CELL);
    GRID_ROWS = infinite ? INF_GRID_WRAP : Math.ceil(MAP_HEIGHT / GRID_CELL);
}
const MAX_ENTITY_RADIUS = 48;
const HEAVY_EXPLOSIVE_WEAPONS = new Set(['artillery', 'cannon', 'rockets', 'bomb', 'hellfire']);
let ZOMBIE_POP_MULT = 10;              // 10x infestation vs. Update 3 (Update 5: adjustable in Game Settings)
let HIVE_POP_CAP = 130 * ZOMBIE_POP_MULT;
const MEDIC_HEAL_RANGE = 150;
const MEDIC_HEAL_RATE = 7;

// ============================================================================
// UPDATE 5: AMMUNITION, SUPPLIES, FUEL, HUNGER & AIRBASE DATA
// ============================================================================
// Every ammunition / supply type in the game. weight = cargo points per unit; cost = refill price per unit at the Command Center.
const AMMO_DEFS = {
    pistol:     { name: '9mm Pistol Rounds',      short: '9MM',     weight: 0.02, scrap: 0.01,  fuel: 0 },
    rifle:      { name: '5.56mm Rifle Rounds',    short: '5.56',    weight: 0.02, scrap: 0.015, fuel: 0 },
    shotgun:    { name: '12-Gauge Shells',        short: '12GA',    weight: 0.05, scrap: 0.04,  fuel: 0 },
    sniper:     { name: '.50 BMG Sniper Rounds',  short: '.50BMG',  weight: 0.15, scrap: 0.2,   fuel: 0 },
    mg:         { name: '7.62mm MG Belts',        short: '7.62',    weight: 0.03, scrap: 0.02,  fuel: 0 },
    hmg:        { name: '.50 cal HMG Rounds',     short: '.50CAL',  weight: 0.12, scrap: 0.06,  fuel: 0.01 },
    autocannon: { name: '25/30mm Cannon Rounds',  short: '25MM',    weight: 0.3,  scrap: 0.25,  fuel: 0.04 },
    tankshell:  { name: '120mm Tank Shells',      short: '120MM',   weight: 4,    scrap: 5,     fuel: 1.5 },
    rockets:    { name: '227mm Artillery Rockets',short: 'ROCKETS', weight: 8,    scrap: 11,    fuel: 5 },
    missiles:   { name: 'Hellfire Missiles',      short: 'MISSILE', weight: 10,   scrap: 18,    fuel: 8 },
    bombs:      { name: '500lb Bombs',            short: 'BOMBS',   weight: 25,   scrap: 30,    fuel: 14 },
    flame:      { name: 'Napalm Fuel Gel',        short: 'NAPALM',  weight: 0.5,  scrap: 0.15,  fuel: 0.3 },
    food:       { name: 'Field Rations',          short: 'RATIONS', weight: 0.5,  scrap: 0.3,   fuel: 0 },
    fuel:       { name: 'Vehicle Fuel (JP-8)',    short: 'FUEL',    weight: 0.2,  scrap: 0,     fuel: 0.25 }
};
const AMMO_ORDER = Object.keys(AMMO_DEFS);
// Standard supply-vehicle loadout: share of cargo capacity (by weight) used when refilling at the Command Center
const SUPPLY_PLAN = { pistol: 0.02, rifle: 0.08, shotgun: 0.04, sniper: 0.03, mg: 0.06, hmg: 0.06, autocannon: 0.07,
                      tankshell: 0.08, rockets: 0.08, missiles: 0.07, bombs: 0.07, flame: 0.06, food: 0.14, fuel: 0.14 };
const RATION_FOOD = 20;           // food points restored per ration
const HUNGER_DRAIN = 100 / 420;   // full -> empty in ~7 minutes (standard)
const STARVE_DEATH_TIME = 60;     // seconds at zero food before death
const SUPPLY_PULSE_RADIUS = 140;  // passive resupply aura
const SUPPLY_ORDER_RADIUS = 240;  // RESUPPLY command radius
const HQ_REFILL_RANGE = 280;

// Per-unit loadouts: primary ammo type + capacity per ammo type (each weapon tracks its own ammo)
const LOADOUTS = {
    engineer:     { primary: 'pistol',     ammo: { pistol: 60 } },
    rifleman:     { primary: 'rifle',      ammo: { rifle: 210 } },
    shotgunner:   { primary: 'shotgun',    ammo: { shotgun: 48 } },
    sniper:       { primary: 'sniper',     ammo: { sniper: 30 } },
    heavy:        { primary: 'mg',         ammo: { mg: 500 } },
    medic:        { primary: 'pistol',     ammo: { pistol: 60 } },
    mechanic:     { primary: 'pistol',     ammo: { pistol: 60 } },
    surv_militia: { primary: 'rifle',      ammo: { rifle: 120 } },
    humvee:       { primary: 'hmg',        ammo: { hmg: 400 } },
    mrap:         { primary: 'hmg',        ammo: { hmg: 450 } },
    stryker:      { primary: 'hmg',        ammo: { hmg: 500 } },
    bradley:      { primary: 'autocannon', ammo: { autocannon: 300 } },
    blackhawk:    { primary: 'mg',         ammo: { mg: 2400 } },
    abrams:       { primary: 'tankshell',  ammo: { tankshell: 40, mg: 1000 },
                    secondary: { weapon: 'lmg', ammoType: 'mg', name: 'Coaxial M240 MG', range: 210, damage: 9, fireRate: 0.12, splash: 0 } },
    rockettruck:  { primary: 'rockets',    ammo: { rockets: 36 } },
    flameapc:     { primary: 'flame',      ammo: { flame: 260 } },
    apache:       { primary: 'missiles',   ammo: { missiles: 16, autocannon: 600 },
                    secondary: { weapon: 'autocannon', ammoType: 'autocannon', name: 'M230 30mm Chain Gun', range: 250, damage: 14, fireRate: 0.2, splash: 10 } },
    bomber:       { primary: 'bombs',      ammo: { bombs: 12 } }
};
// Vehicle fuel: max tank, burn rate (ground: per 100px driven; air: per second airborne). Supply vehicles are exempt.
const FUEL_SPECS = {
    humvee: { max: 220, burn: 0.6 },  mrap: { max: 260, burn: 0.8 },  stryker: { max: 300, burn: 0.9 },
    bradley: { max: 320, burn: 1.0 }, abrams: { max: 450, burn: 1.6 }, rockettruck: { max: 280, burn: 0.9 },
    flameapc: { max: 260, burn: 1.0 },
    blackhawk: { max: 240, burn: 0.8, air: true }, apache: { max: 220, burn: 0.9, air: true }, bomber: { max: 300, burn: 1.1, air: true }
};
const GROUND_IDLE_BURN = 0.01;
const DIFFICULTY_PRESETS = {
    recruit:  { label: 'RECRUIT',  startRes: 1.6,  wave: 0.7, hunger: 0.6, fuel: 0.7, ammo: 1.5,
                desc: 'More starting resources, smaller waves, slower hunger & fuel use, deeper magazines.' },
    standard: { label: 'STANDARD', startRes: 1.0,  wave: 1.0, hunger: 1.0, fuel: 1.0, ammo: 1.0,
                desc: 'The intended experience (default).' },
    veteran:  { label: 'VETERAN',  startRes: 0.75, wave: 1.3, hunger: 1.3, fuel: 1.2, ammo: 0.85,
                desc: 'Tighter economy, bigger hordes, faster hunger & fuel use, lighter loadouts.' }
};
