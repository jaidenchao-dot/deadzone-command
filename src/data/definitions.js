const VEHICLE_DEFS = {
    humvee: {
        name: 'HMMWV Humvee',
        hotkey: 'V',
        scrap: 300, fuel: 95, pop: 2, buildTime: 8.5,
        hp: 380, speed: 155, range: 225, damage: 18, fireRate: 0.22,
        vision: 320, capacity: 4, weapon: 'autocannon', radius: 18,
        desc: 'Capacity: 4 Troops. High-speed street recon truck with roof-mounted .50 cal M2 Browning HMG.'
    },
    mrap: {
        name: 'Cougar MRAP',
        hotkey: 'C',
        scrap: 420, fuel: 145, pop: 2, buildTime: 10.5,
        hp: 620, speed: 122, range: 220, damage: 22, fireRate: 0.28,
        vision: 300, capacity: 6, weapon: 'autocannon', radius: 20,
        desc: 'Capacity: 6 Troops. Heavy V-hull ambush-resistant urban armored carrier built to breach infested blocks.'
    },
    stryker: {
        name: 'Stryker ICV',
        hotkey: 'T',
        scrap: 520, fuel: 190, pop: 3, buildTime: 12.0,
        hp: 720, speed: 132, range: 245, damage: 25, fireRate: 0.25,
        vision: 320, capacity: 9, weapon: 'autocannon', radius: 21,
        desc: 'Capacity: 9 Troops. 8x8 Infantry Carrier Vehicle capable of transporting a full 9-trooper squad down avenues.'
    },
    bradley: {
        name: 'M2 Bradley IFV',
        hotkey: 'B',
        scrap: 700, fuel: 270, pop: 3, buildTime: 14.0,
        hp: 880, speed: 112, range: 275, damage: 38, fireRate: 0.34, splash: 22,
        vision: 330, capacity: 6, firingPorts: true, weapon: 'autocannon', radius: 22, requiresArmory: true,
        desc: 'Capacity: 6 Troops. 25mm Bushmaster autocannon + Firing Ports allowing embarked infantry to shoot out!'
    },
    blackhawk: {
        name: 'UH-60 Black Hawk',
        hotkey: 'K',
        scrap: 820, fuel: 330, pop: 3, buildTime: 15.0,
        hp: 540, speed: 185, range: 245, damage: 17, fireRate: 0.13,
        vision: 390, capacity: 8, isAir: true, hasRotor: true, weapon: 'lmg', radius: 22, requiresArmory: true,
        desc: 'Capacity: 8 Troops. Air-assault helicopter that flies directly over skyscrapers, rubble, and rivers with twin miniguns.'
    },
    abrams: {
        name: 'M1A2 Abrams MBT',
        hotkey: 'M',
        scrap: 1050, fuel: 430, pop: 4, buildTime: 17.5,
        hp: 1450, speed: 96, range: 330, damage: 135, fireRate: 1.55, splash: 68,
        vision: 340, capacity: 0, crushesZombies: true, weapon: 'cannon', radius: 24, requiresArmory: true,
        desc: 'Capacity: 0 (4-man tank crew fills hull). Fires 120mm HE splash shells and crushes small zombies on contact.'
    },
    // ===== Update 4: new military vehicles =====
    rockettruck: {
        name: 'M142 Rocket Artillery Truck', shortLabel: 'ROCKETS',
        hotkey: 'R',
        scrap: 650, fuel: 280, pop: 3, buildTime: 16.0,
        hp: 520, speed: 104, range: 430, damage: 52, fireRate: 4.2, splash: 54,
        burst: 6, burstInterval: 0.13, burstSpread: 46,
        vision: 360, capacity: 0, weapon: 'rockets', radius: 22, requiresArmory: true,
        desc: 'Long-range rocket artillery. Fires a 6-rocket saturation salvo that shreds hordes and bandit forts, then needs a long reload. Lightly armored — keep it behind the front line.'
    },
    flameapc: {
        name: 'M113 Flame APC', shortLabel: 'FLAME APC',
        hotkey: 'F',
        scrap: 480, fuel: 190, pop: 2, buildTime: 12.0,
        hp: 700, speed: 118, range: 125, damage: 15, fireRate: 0.18, splash: 30,
        vision: 280, capacity: 4, weapon: 'flame', radius: 20,
        desc: 'Capacity: 4 Troops. Tracked carrier with a turret flamethrower. Short range, but every burst scorches whole clusters of infected — the go-to horde clearer.'
    },
    apache: {
        name: 'AH-64 Apache Gunship', shortLabel: 'APACHE',
        hotkey: 'G',
        scrap: 900, fuel: 380, pop: 3, buildTime: 18.0,
        hp: 620, speed: 175, range: 300, damage: 46, fireRate: 0.95, splash: 30,
        vision: 400, capacity: 0, isAir: true, hasRotor: true, weapon: 'hellfire', radius: 22, requiresArmory: true,
        desc: 'Attack helicopter firing Hellfire missiles over rooftops. Fast hunter-killer — but Acid Spitters can still hit it from the ground.'
    },
    bomber: {
        name: 'B-1B Strike Bomber', shortLabel: 'BOMBER',
        hotkey: 'Z',
        scrap: 1250, fuel: 540, pop: 4, buildTime: 22.0,
        hp: 700, speed: 210, range: 85, agroRange: 420, damage: 170, fireRate: 1.3, splash: 80,
        vision: 440, capacity: 0, isAir: true, weapon: 'bomb', radius: 26, requiresArmory: true,
        desc: 'Heavy bombing plane. Flies over target areas dropping 500lb bombs with a huge blast radius. Order it over a horde, hive or bandit fort. No guns — can\'t fight aircraft.'
    },
    // ===== Update 4: abandoned civilian vehicles (neutral until a soldier climbs in to drive) =====
    civ_sedan: {
        name: 'Abandoned Sedan', shortLabel: 'SEDAN', civilian: true,
        scrap: 0, fuel: 0, pop: 0, buildTime: 0,
        hp: 240, speed: 170, range: 0, damage: 0, fireRate: 1,
        vision: 230, capacity: 4, weapon: null, radius: 17,
        desc: 'Abandoned civilian sedan. Right-click it with infantry to climb in and drive (capacity 4). Unarmed and flimsy, but fast. Left empty, it is abandoned again.'
    },
    civ_pickup: {
        name: 'Abandoned Pickup Truck', shortLabel: 'PICKUP', civilian: true,
        scrap: 0, fuel: 0, pop: 0, buildTime: 0,
        hp: 330, speed: 160, range: 0, damage: 0, fireRate: 1,
        vision: 240, capacity: 3, weapon: null, radius: 18,
        desc: 'Abandoned pickup truck. Right-click it with infantry to climb in and drive (capacity 3). Sturdier than a sedan. Left empty, it is abandoned again.'
    },
    civ_van: {
        name: 'Abandoned Delivery Van', shortLabel: 'VAN', civilian: true,
        scrap: 0, fuel: 0, pop: 0, buildTime: 0,
        hp: 300, speed: 140, range: 0, damage: 0, fireRate: 1,
        vision: 220, capacity: 6, weapon: null, radius: 19,
        desc: 'Abandoned delivery van. Right-click it with infantry to climb in and drive (capacity 6). Slow but roomy. Left empty, it is abandoned again.'
    },
    // ===== Update 5: SUPPLY VEHICLES (carry every ammo type + rations + fuel; exempt from fuel use) =====
    supplytruck: {
        name: 'M977 Supply Truck', shortLabel: 'SUPPLY', hotkey: 'U',
        scrap: 260, fuel: 80, pop: 2, buildTime: 10.0,
        hp: 420, speed: 140, range: 0, damage: 0, fireRate: 1,
        vision: 260, capacity: 2, weapon: null, radius: 20, supply: true, cargoCapacity: 1000,
        desc: 'Standard wheeled supply truck (1000 cargo, 2 troop seats in the cab). Carries every ammo type, rations & fuel. Resupplies nearby troops/vehicles; refill at the Command Center.'
    },
    heavysupply: {
        name: 'HEMTT Heavy Supply Truck', shortLabel: 'HVY SUPPLY', hotkey: 'H',
        scrap: 420, fuel: 140, pop: 2, buildTime: 14.0,
        hp: 620, speed: 112, range: 0, damage: 0, fireRate: 1,
        vision: 260, capacity: 4, weapon: null, radius: 23, supply: true, cargoCapacity: 2400,
        desc: 'Heavy 8x8 logistics truck (2400 cargo, 4 troop seats). Sustains large operations. Slower and bigger.'
    },
    trackedsupply: {
        name: 'M548 Tracked Supply Carrier', shortLabel: 'TRK SUPPLY', hotkey: 'K',
        scrap: 380, fuel: 130, pop: 2, buildTime: 12.0,
        hp: 760, speed: 118, range: 0, damage: 0, fireRate: 1,
        vision: 260, capacity: 3, weapon: null, radius: 21, supply: true, tracked: true, cargoCapacity: 1600,
        desc: 'Armored tracked carrier (1600 cargo, 3 troop seats). Its tracks crawl over rubble that blocks wheeled vehicles.'
    },
    chinook: {
        name: 'CH-47 Supply Chinook', shortLabel: 'CHINOOK', hotkey: 'N',
        scrap: 700, fuel: 300, pop: 3, buildTime: 16.0,
        hp: 600, speed: 160, range: 0, damage: 0, fireRate: 1,
        vision: 380, capacity: 6, isAir: true, hasRotor: true, twinRotor: true, weapon: null, radius: 26, supply: true, cargoCapacity: 1200,
        desc: 'Twin-rotor airlift (1200 cargo, 6 troop seats). Flies supplies and troops over skyscrapers and rubble to cut-off units. Built at the Airbase.'
    }
};

const BUILDING_DEFS = {
    hq: {
        name: 'Command Center HQ',
        hotkey: 'Q',
        scrap: 0, fuel: 0, size: 3, hp: 2200, vision: 400, popBonus: 10, buildTime: 0,
        desc: 'Battery Park Forward Command HQ. Trains Combat Engineers [E] and coordinates Tactical Cruise Missile strikes.'
    },
    collector: {
        name: 'Resource Collector',
        hotkey: 'R',
        scrap: 120, fuel: 0, size: 2, hp: 520, vision: 250, requiresDepot: true, buildTime: 10,
        desc: 'Built ONLY on Urban Supply Depots. Automatically extracts Scrap & Fuel over time. Upgradeable to Level 3 [U].'
    },
    barracks: {
        name: 'Infantry Barracks',
        hotkey: 'B',
        scrap: 175, fuel: 0, size: 2, hp: 760, vision: 280, popBonus: 6, buildTime: 18,
        desc: 'Trains individual infantry soldiers and increases Squad Command Limit (+6 Pop).'
    },
    battalionhq: {
        name: 'Battalion Command HQ',
        hotkey: 'N',
        scrap: 300, fuel: 60, size: 3, hp: 1050, vision: 310, popBonus: 12, buildTime: 30,
        requiresBarracks: true,
        desc: 'Trains entire pre-composed Infantry Battalions in droves at once (+12 Pop). Requires Infantry Barracks.'
    },
    motorpool: {
        name: 'Motor Pool Depot',
        hotkey: 'M',
        scrap: 320, fuel: 80, size: 3, hp: 920, vision: 300, popBonus: 8, buildTime: 26,
        desc: 'Constructs 10 classes of armored vehicles, troop transports, rocket artillery and aircraft (+8 Pop).'
    },
    armory: {
        name: 'Armory & Tech Lab',
        hotkey: 'Y',
        scrap: 340, fuel: 120, size: 2, hp: 680, vision: 270, buildTime: 24,
        desc: 'Unlocks Snipers, Heavy Gunners, Bradley IFV, Black Hawk, Abrams MBT, Artillery, Missile Silo, and combat upgrades.'
    },
    artillery: {
        name: 'M777 Howitzer Battery',
        hotkey: 'Z',
        scrap: 520, fuel: 190, size: 2, hp: 560, vision: 310, buildTime: 30,
        range: 920, damage: 125, fireRate: 3.1, splash: 76, requiresArmory: true,
        desc: 'Long-range 155mm artillery. Supports Single Salvo [F] or Continuous Loop Bombardment [G] across city blocks.'
    },
    silo: {
        name: 'Tactical Missile Silo',
        hotkey: 'I',
        scrap: 820, fuel: 340, size: 2, hp: 820, vision: 320, buildTime: 40,
        requiresArmory: true,
        desc: 'Arms supersonic Tactical Cruise Missiles [L] capable of devastating any hive or infested plaza in the city. Each launch burns ' + 150 + ' Fuel.'
    },
    turret: {
        name: 'Sentry Auto-Turret',
        hotkey: 'T',
        scrap: 160, fuel: 35, size: 1, hp: 440, vision: 290, buildTime: 8,
        range: 220, damage: 15, fireRate: 0.28,
        desc: 'Automated 7.62mm street checkpoint turret. Automatically tracks and fires on nearby zombies.'
    },
    wall: {
        name: 'Sandbag Barricade',
        hotkey: 'L',
        scrap: 30, fuel: 0, size: 1, hp: 440, vision: 140, buildTime: 3,
        desc: 'Draggable reinforced street barricade. Click and drag across avenues or alleys to seal city blocks.'
    },
    gate: {
        name: 'Reinforced Blast Gate',
        hotkey: 'G',
        scrap: 60, fuel: 10, size: 1, hp: 640, vision: 170, buildTime: 4,
        desc: 'Rotatable checkpoint blast gate [R]. Auto-opens for friendly troops/vehicles and seals against hordes.'
    },
    // Update 5: Airbase — aircraft construction, storage (3 helicopters + 3 planes) and refuelling
    airbase: {
        name: 'Airbase', hotkey: 'P',
        scrap: 600, fuel: 220, size: 4, hp: 1500, vision: 340, popBonus: 6, buildTime: 35,
        desc: 'Builds helicopters & planes. Stores up to 3 helicopters (helipads) and 3 planes (runway): right-click it with aircraft selected to land & store them. Stored aircraft stop burning fuel and refuel over time.'
    },
    // Update 6: field hospital — automatically treats wounded friendly troops inside its radius, one patient at a time
    medictent: {
        name: 'Medic Tent', hotkey: 'C',
        scrap: 240, fuel: 40, size: 2, hp: 520, vision: 260, buildTime: 16,
        healRadius: 190, healRate: 11,
        desc: 'Field hospital. Automatically treats wounded friendly troops inside its radius (190) — one patient at a time, most injured first (11 HP/s). Does not heal vehicles, buildings or enemies. Complements Combat Medics (it cannot cure infection).'
    }
};
const MEDIC_TENT_HEAL_SCAN = 0.5;

// Update 6: Spitter acid — slow lobbed glob. A direct hit does heavy single-target damage; a miss leaves a short-lived
// poison puddle that only does small periodic damage to anyone standing in it.
const SPITTER_ACID = {
    directDamage: 28,        // previously 18 (with splash falloff) — direct hits only
    speed: 175,              // px/s along the ground track (previously a 320 px/s straight bolt)
    minFlight: 0.45, maxFlight: 1.5,
    baseHit: 0.72,           // hit chance vs. a stationary target at point-blank range
    rangePenalty: 0.18,      // lost at maximum range
    movingPenalty: 0.22,     // extra miss chance if the target is moving when the glob is spat
    airHit: 0.55,
    missMin: 26, missMax: 64 // scatter distance of a missed glob
};
const HOIST_TIME = 1.3;          // Update 6: seconds on the rope when a helicopter winches a soldier aboard
const ACID_PUDDLE = { radius: 20, maxRadius: 30, life: 7, tick: 0.5, dmg: 2, vehicleDmg: 1, maxCount: 48 };

const BATTALION_DEFS = {
    platoon_rifle: {
        name: 'Rifle Platoon (6x)',
        shortLabel: 'RIFLE PLT',
        hotkey: 'Q',
        scrap: 530, fuel: 20, pop: 6, buildTime: 15.0,
        composition: [{ type: 'rifleman', count: 6 }],
        desc: 'Composition: 6x Assault Riflemen. Deploys a complete 6-trooper frontline rifle platoon in one batch.'
    },
    platoon_breacher: {
        name: 'Breacher Squad (6x)',
        shortLabel: 'BREACH SQD',
        hotkey: 'B',
        scrap: 750, fuel: 120, pop: 8, buildTime: 18.0,
        composition: [{ type: 'shotgunner', count: 4 }, { type: 'heavy', count: 2 }],
        desc: 'Composition: 4x Breacher Shotgunners + 2x Heavy M249 Gunners. Heavy urban street-clearing suppression force.'
    },
    platoon_recon: {
        name: 'Recon Overwatch (5x)',
        shortLabel: 'RECON TEAM',
        hotkey: 'E',
        scrap: 620, fuel: 150, pop: 5, buildTime: 17.0,
        requiresArmory: true,
        composition: [{ type: 'sniper', count: 3 }, { type: 'rifleman', count: 2 }],
        desc: 'Composition: 3x Recon Snipers + 2x Assault Riflemen. Long-range avenue overwatch squad (Requires Armory).'
    },
    platoon_company: {
        name: 'Assault Company (9x)',
        shortLabel: 'ASSAULT CO',
        hotkey: 'R',
        scrap: 1100, fuel: 205, pop: 11, buildTime: 22.0,
        requiresArmory: true,
        composition: [
            { type: 'rifleman', count: 4 },
            { type: 'heavy', count: 2 },
            { type: 'sniper', count: 2 },
            { type: 'engineer', count: 1 }
        ],
        desc: 'Composition: 4x Riflemen + 2x Heavy Gunners + 2x Snipers + 1x Combat Engineer. Combined-arms city liberation force.'
    }
};

const UPGRADE_DEFS = {
    ballistics: {
        name: 'Depleted Uranium Rounds',
        hotkey: 'U',
        scrap: 450, fuel: 180,
        desc: 'Increases all infantry, turret, and vehicle weapon damage by +25%.'
    },
    armor: {
        name: 'Composite Reactive Plating',
        hotkey: 'P',
        scrap: 480, fuel: 200,
        desc: 'Reinforces all infantry, vehicles, and structures with +25% maximum HP.'
    }
};

const ZOMBIE_DEFS = {
    walker: { name: 'Infected Citizen', hp: 70, speed: 46, damage: 11, range: 22, fireRate: 0.95, radius: 10, scrapReward: 2 },
    runner: { name: 'Feral Runner', hp: 52, speed: 104, damage: 13, range: 22, fireRate: 0.72, radius: 9, scrapReward: 2 },
    // Update 4: Spitters are ranged attackers and can lob acid at low-flying aircraft (antiAir)
    spitter: { name: 'Acid Spitter', hp: 85, speed: 62, damage: 18, range: 175, fireRate: 1.65, radius: 11, splash: 24, scrapReward: 4, antiAir: true },
    brute: { name: 'Mutant Juggernaut', hp: 460, speed: 42, damage: 38, range: 28, fireRate: 1.25, radius: 16, scrapReward: 9, heavy: true },
    // Update 3: Late-infestation mutations (unlock by wave number)
    bloater:     { name: 'Bloated Pustule',   hp: 230,  speed: 34,  damage: 10, range: 24, fireRate: 1.3,  radius: 14, scrapReward: 5, unlockWave: 3,
                   burstRadius: 72, burstDamage: 46 },
    stalker:     { name: 'Skinless Stalker',  hp: 95,   speed: 124, damage: 21, range: 22, fireRate: 0.6,  radius: 9,  scrapReward: 4, unlockWave: 4 },
    screamer:    { name: 'Howling Screamer',  hp: 135,  speed: 58,  damage: 9,  range: 22, fireRate: 1.0,  radius: 10, scrapReward: 6, unlockWave: 5 },
    abomination: { name: 'Flesh Abomination', hp: 1450, speed: 36,  damage: 66, range: 36, fireRate: 1.6,  radius: 22, scrapReward: 24, unlockWave: 7,
                   splash: 46, heavy: true }
};

// Update 3: Scratch infection chance per successful melee hit on a human
const INFECTION_CHANCE = { walker: 0.07, runner: 0.06, brute: 0.05, bloater: 0.10, stalker: 0.12, screamer: 0.08, abomination: 0 };

// Update 3: Organized zombie wave themes (weights per type; locked mutants are dropped until unlocked)
const WAVE_COST = { walker: 1, runner: 1, spitter: 1.5, brute: 4, bloater: 2.5, stalker: 2, screamer: 3, abomination: 12 };
const WAVE_TYPES = [
    { key: 'shambler',   name: 'SHAMBLER TIDE',     formation: 'horde', minWave: 1, mix: { walker: 7, runner: 1, bloater: 1 } },
    { key: 'runner',     name: 'RUNNER PACK',       formation: 'horde', minWave: 1, mix: { runner: 6, walker: 1, stalker: 2 }, fast: true },
    { key: 'spitter',    name: 'SPITTER BARRAGE',   formation: 'horde', minWave: 2, mix: { walker: 4, spitter: 4, bloater: 1 } },
    { key: 'juggernaut', name: 'JUGGERNAUT PUSH',   formation: 'horde', minWave: 3, mix: { walker: 4, brute: 2, bloater: 2, abomination: 0.4 } },
    { key: 'tunnel',     name: 'TUNNEL BREACH',     formation: 'horde', minWave: 4, mix: { runner: 4, walker: 3, stalker: 2 }, subways: true },
    { key: 'screamer',   name: 'SCREAMER HORDE',    formation: 'horde', minWave: 5, mix: { walker: 5, runner: 3, stalker: 2, screamer: 1 } },
    { key: 'siege',      name: 'ABOMINATION SIEGE', formation: 'horde', minWave: 7, mix: { walker: 5, brute: 2, bloater: 2, screamer: 1, abomination: 1 } }
];

const HIVE_ARCHETYPES = {
    hive_subway: {
        name: 'Subway Breach Hive',
        hp: 1500,
        radius: 36,
        spawnInterval: 13.5,
        spawnPool: ['runner', 'runner', 'walker'],
        desc: 'Mutated subterranean nest erupting out of a collapsed NYC subway station. Rapidly spawns Feral Runners from underground tunnels.'
    },
    hive_spore: {
        name: 'Spore Spire Hive',
        hp: 1750,
        radius: 38,
        spawnInterval: 15.0,
        spawnPool: ['spitter', 'walker', 'runner'],
        desc: 'Bioluminescent fungal-biomass growth fused into shattered skyscraper steel. Spawns toxic Acid Spitters and infected walkers.'
    },
    hive_foundry: {
        name: 'Flesh-Foundry Hive',
        hp: 2150,
        radius: 40,
        spawnInterval: 18.0,
        spawnPool: ['brute', 'walker', 'walker'],
        desc: 'Heavily armored chitinous incubator welded onto industrial wreckage and tanker ruins. Periodically births Mutant Juggernauts.'
    },
    hive_apex: {
        name: 'Apex Overmind Hive',
        hp: 2650,
        radius: 44,
        spawnInterval: 14.0,
        spawnPool: ['brute', 'spitter', 'runner', 'walker'],
        desc: 'Colossal neural-biomass hive rooted across Central Park ruins. Coordinates city-wide surges and spawns elite mutant strains.'
    }
};

// ---------------------------------------------------------------------------
// UPDATE 2: HOSTILE MERCENARY FACTION & CIVILIAN SURVIVORS
// ---------------------------------------------------------------------------
const MERC_DEFS = {
    raider:   { name: 'Bandit Raider',      hp: 110, speed: 84, range: 180, damage: 10, fireRate: 0.50, vision: 260, aggro: 270, weapon: 'rifle',  radius: 10 },
    gunner:   { name: 'Scrap-Armor Gunner', hp: 210, speed: 68, range: 200, damage: 8,  fireRate: 0.17, vision: 260, aggro: 260, weapon: 'lmg',    radius: 11 },
    marksman: { name: 'Bandit Marksman',    hp: 95,  speed: 78, range: 315, damage: 42, fireRate: 1.80, vision: 340, aggro: 330, weapon: 'sniper', radius: 10 }
};

const MERC_STRUCT_DEFS = {
    wall:   { name: 'Scrap-Metal Barricade', hp: 380,  radius: 14, size: 32,
              desc: 'Spiked corrugated-steel barricade ringing a bandit camp. Funnels attackers into the gang\'s crossfire.' },
    tower:  { name: 'Bandit Watchtower',     hp: 560,  radius: 20, size: 48, range: 245, damage: 11, fireRate: 0.38, weapon: 'lmg',
              desc: 'Scaffold watchtower with a mounted machine gun. Fires on soldiers, zombies and survivors that enter bandit territory.' },
    bunker: { name: 'Bandit Stronghold',     hp: 1500, radius: 32, size: 72,
              desc: 'Shipping-container stronghold. Sends fresh raiders while standing. Destroy it to break the gang and seize its stockpile.' }
};

const SURVIVOR_DEFS = {
    civilian: { name: 'Civilian Survivor',      hp: 60,  speed: 84, radius: 9,
                bonusDesc: 'Joins base support staff: +1 Command Pop.' },
    medic:    { name: 'Survivor Field Medic',   hp: 70,  speed: 84, radius: 9,
                bonusDesc: '+1 Command Pop and HQ Triage: infantry near your HQ regenerate HP. Heals nearby troops while escorted.' },
    mechanic: { name: 'Survivor Mechanic',      hp: 80,  speed: 80, radius: 9,
                bonusDesc: '+1 Command Pop and +10% Resource Collector output (max +50%). Patches nearby vehicles while escorted.' },
    militia:  { name: 'Armed Militia Survivor', hp: 140, speed: 90, radius: 10, armed: true, range: 190, damage: 13, fireRate: 0.6, weapon: 'rifle',
                bonusDesc: 'Enlists as a free Assault Rifleman at your base (or joins support staff for +1 Pop if command limit is full).' }
};
