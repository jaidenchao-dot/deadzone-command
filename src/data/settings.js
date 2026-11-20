// Update 5: selectable city maps. All maps share the proven street grid / objective layout (so pathing & balance hold),
// but each has its own districts, skyline, building mix, colour palette and landmarks.
const MAP_DEFS = {
    manhattan: {
        id: 'manhattan', name: 'Manhattan', city: 'NYC', cityLong: 'New York City', lz: 'Battery Park LZ', hqName: 'Battery Park',
        blurb: 'Skyscraper canyons between the Hudson & East River. Tall towers, tight avenues. The original operation.',
        tint: null, wallMix: null, kindMap: null, heightMult: 1, districts: null, labels: null, hiveLabels: null
    },
    brooklyn: {
        id: 'brooklyn', name: 'Brooklyn Docklands', city: 'BROOKLYN', cityLong: 'Brooklyn', lz: 'Red Hook Terminal LZ', hqName: 'Red Hook',
        blurb: 'Low-rise brownstones, brick warehouses and waterfront yards. Fewer towers, wider sightlines, more cover from rubble.',
        tint: 'rgba(150, 96, 52, 0.10)', wallMix: ['#6b3f2a', 0.35], kindMap: { skyscraper: 'warehouse', office: 'brownstone' }, heightMult: 0.6,
        districts: {
            battery: ['Red Hook Terminal LZ', 'RED HOOK LZ'], financial: ['Brooklyn Navy Yard', 'NAVY YARD'], soho: ['Williamsburg', 'WILLIAMSBURG'],
            les: ['Bushwick', 'BUSHWICK'], midtown: ['Downtown Brooklyn', 'DOWNTOWN BK'], centralpark: ['Prospect Park', 'PROSPECT PARK']
        },
        labels: ['NAVY YARD DRYDOCK', 'BUILDING 77', 'ATLANTIC TERMINAL', 'PIER 12 SHEDS', 'DUMBO LOFTS', 'WATCHTOWER BLDG',
            'BEDFORD ROWS', 'DOMINO REFINERY', 'KENT AVE LOFTS', 'MCCARREN HALL', 'KNICKERBOCKER FLATS', 'BUSHWICK MILLS',
            'NEWTOWN CREEK', 'BROADWAY TRIANGLE', 'GOWANUS WORKS', 'BAT FACTORY', 'BARCLAYS ARENA', 'WILLIAMSBURG BANK',
            'METROTECH CTR', 'BORO HALL ANNEX', 'FULTON MALL', 'COBBLE HILL ROWS', 'CARROLL GARDENS', 'BOERUM PLACE',
            'ATLANTIC YARDS', 'PARK SLOPE ROWS', 'FORT GREENE', 'CLINTON HILL', 'BED-STUY ROWS', 'CROWN HEIGHTS',
            'GRAND ARMY PLAZA', 'BROOKLYN MUSEUM', 'PROSPECT HEIGHTS', 'WINDSOR TERRACE'],
        hiveLabels: ['Navy Yard Subway Breach Hive', 'Red Hook Spore Hive', 'Williamsburg Subway Hive', 'Bushwick Foundry Hive',
            'Downtown BK Spore Spire Hive', 'Atlantic Ave Foundry Hive', 'Prospect Park Apex Overmind Hive']
    },
    chicago: {
        id: 'chicago', name: 'Chicago Loop', city: 'CHICAGO', cityLong: 'Chicago', lz: 'Navy Pier LZ', hqName: 'Navy Pier',
        blurb: 'Steel-and-glass supertowers along Lake Michigan. The tallest skyline: towers block sight, aircraft rule the air.',
        tint: 'rgba(70, 110, 170, 0.10)', wallMix: ['#2c4a6e', 0.30], kindMap: { brownstone: 'office', warehouse: 'office' }, heightMult: 1.3,
        districts: {
            battery: ['Navy Pier LZ', 'NAVY PIER LZ'], financial: ['The Loop', 'THE LOOP'], soho: ['West Loop', 'WEST LOOP'],
            les: ['Streeterville', 'STREETERVILLE'], midtown: ['River North', 'RIVER NORTH'], centralpark: ['Lincoln Park', 'LINCOLN PARK']
        },
        labels: ['WILLIS TOWER', 'BOARD OF TRADE', 'AON CENTER', 'FEDERAL PLAZA', 'MONADNOCK BLDG', 'UNION STATION',
            'FULTON MARKET', 'RANDOLPH ROW', 'GREEKTOWN', 'OGILVIE TERMINAL', 'NAVY PIER SHEDS', 'NORTHWESTERN MED',
            'LAKE POINT TOWER', 'STREETERVILLE TWR', 'MERCHANDISE MART', 'WOLF POINT', 'MARINA CITY', 'TRIBUNE TOWER',
            'WRIGLEY BLDG', 'PRUDENTIAL PLAZA', 'CHASE TOWER', 'JOHN HANCOCK', 'WATER TOWER PL', 'OLD POST OFFICE',
            'CARBIDE BLDG', 'PALMOLIVE BLDG', 'DRAKE HOTEL', 'GOLD COAST FLATS', 'OLD TOWN ROWS', 'LINCOLN PARK ZOO',
            'CHICAGO HIST MUSEUM', 'DEPAUL HALL', 'GOLD COAST PENTHSE', 'LAKEVIEW TOWER'],
        hiveLabels: ['Loop "L" Station Breach Hive', 'Lakeshore Spore Hive', 'West Loop Subway Hive', 'Streeterville Foundry Hive',
            'River North Spore Spire Hive', 'Mag Mile Foundry Hive', 'Lincoln Park Apex Overmind Hive']
    }
};
const SAVE_VERSION = 1;
// Update 6: keys reserved exclusively for movement
const WASD_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']);
// Update 6: navigation
const NAV_STRUCTURE_CATS = new Set(['building', 'hive', 'depot', 'mercstruct', 'fort', 'shelter']);
const HORDE_SPACING = 14;

// ============================================================================
// Update 7: MOVEMENT PHYSICS — every soldier & vehicle has momentum.
//   accel / brake are px/s² (braking distance = v² / 2·brake, so it grows with speed);
//   turn is the hull turn rate in rad/s (vehicles & planes steer a heading and cannot strafe or reverse instantly;
//   wheeled vehicles turn slower at low speed, tracked vehicles can pivot in place).
//   Infantry & helicopters steer a velocity vector: sharp direction changes must first bleed off momentum.
// ============================================================================
const MOVE_PROFILES = {
    // infantry (vector steering)
    rifleman:     { accel: 230, brake: 380 },
    shotgunner:   { accel: 250, brake: 400 },
    sniper:       { accel: 200, brake: 360 },
    heavy:        { accel: 150, brake: 300 },   // MG + ammo load: slow to build speed
    engineer:     { accel: 220, brake: 360 },
    medic:        { accel: 230, brake: 380 },
    mechanic:     { accel: 210, brake: 360 },
    surv_civilian:{ accel: 170, brake: 300 },
    surv_medic:   { accel: 180, brake: 320 },
    surv_mechanic:{ accel: 180, brake: 320 },
    surv_militia: { accel: 210, brake: 350 },
    // light vehicles
    humvee:       { heading: true, accel: 120, brake: 230, turn: 2.6 },
    sedan:        { heading: true, accel: 130, brake: 210, turn: 2.8 },
    pickup:       { heading: true, accel: 110, brake: 190, turn: 2.4 },
    van:          { heading: true, accel: 80,  brake: 150, turn: 2.0 },
    // standard trucks / armour
    mrap:         { heading: true, accel: 85,  brake: 160, turn: 1.9 },
    stryker:      { heading: true, accel: 75,  brake: 150, turn: 1.8 },
    rockettruck:  { heading: true, accel: 70,  brake: 140, turn: 1.7 },
    flameapc:     { heading: true, accel: 75,  brake: 150, turn: 1.8 },
    supplytruck:  { heading: true, accel: 72,  brake: 135, turn: 1.8 },
    // heavy trucks & carriers
    heavysupply:  { heading: true, accel: 45,  brake: 95,  turn: 1.3 },
    // tracked
    bradley:      { heading: true, tracked: true, accel: 58, brake: 115, turn: 1.5 },
    trackedsupply:{ heading: true, tracked: true, accel: 48, brake: 115, turn: 1.35 },
    abrams:       { heading: true, tracked: true, accel: 40, brake: 85,  turn: 1.1 },
    // aircraft
    blackhawk:    { accel: 150, brake: 175 },
    apache:       { accel: 170, brake: 190 },
    chinook:      { accel: 100, brake: 125 },
    bomber:       { heading: true, plane: true, accel: 70, brake: 80, turn: 1.0 }
};
const DEFAULT_INFANTRY_PROFILE = { accel: 220, brake: 360 };
const DEFAULT_VEHICLE_PROFILE = { heading: true, accel: 80, brake: 150, turn: 1.8 };
const STOP_BRAKE_BONUS = 1.25;     // a deliberate halt (stop order / arrival) brakes a little harder than cornering
const SAVE_SLOTS = ['auto', 'slot1', 'slot2', 'slot3'];
const AUTOSAVE_INTERVAL = 120;

function mixHex(hex, target, t) {
    const a = parseInt(hex.slice(1), 16), b = parseInt(target.slice(1), 16);
    const ch = (v, sh) => (v >> sh) & 255;
    const m = (sh) => Math.round(ch(a, sh) + (ch(b, sh) - ch(a, sh)) * t);
    return '#' + ((1 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)).toString(16).slice(1);
}

const DEFAULT_SETTINGS = { difficulty: 'standard', ammo: true, hunger: true, fuel: true, density: 10, infiniteStart: false, autosave: true, mapId: 'manhattan',
    worldMode: 'standard', infRender: 2, infLoad: 3, infActive: 1 };
const AIRBASE_REFUEL_RATE = 4;    // fuel per second while stored
const HELI_TYPES = new Set(['blackhawk', 'apache', 'chinook']);
const PLANE_TYPES = new Set(['bomber']);
const AIRCRAFT_TYPES = new Set(['blackhawk', 'apache', 'chinook', 'bomber']);

// Update 3: categories whose last-sighted state is remembered under grey fog of war (buildings / static objects)
const FOG_MEMORY_CATEGORIES = new Set(['hive', 'mercstruct', 'fort', 'shelter', 'crate']);
