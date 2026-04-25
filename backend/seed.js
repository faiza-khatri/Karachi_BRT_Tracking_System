require('dotenv').config();
const mysql = require('mysql2/promise');

// ─── Real Karachi BRT / Bus Data ──────────────────────────────────────────────
// Stops with real approximate lat/lng for major Karachi locations
const STOPS = [
  // Shared corridor stops (west-east spine)
  { name: 'Numaish',           landmark: 'Numaish Chowrangi',          lat: 24.8607, lng: 67.0099 },
  { name: 'Guru Mandir',       landmark: 'Guru Mandir Bus Stop',        lat: 24.8641, lng: 67.0145 },
  { name: 'Empress Market',    landmark: 'Saddar / Empress Market',     lat: 24.8607, lng: 67.0206 },
  { name: 'Saddar',            landmark: 'Saddar Bus Terminal',         lat: 24.8571, lng: 67.0227 },
  { name: 'Regal Chowk',       landmark: 'Regal Chowk Saddar',         lat: 24.8555, lng: 67.0258 },
  { name: 'Tower',             landmark: 'M.A. Jinnah Road / Tower',   lat: 24.8510, lng: 67.0301 },
  { name: 'Lighthouse',        landmark: 'Lighthouse Market',           lat: 24.8495, lng: 67.0340 },
  { name: 'Lea Market',        landmark: 'Lea Market Lyari',            lat: 24.8513, lng: 67.0186 },
  // Northern stops
  { name: 'Nagan Chowrangi',   landmark: 'Nagan Chowrangi',            lat: 24.9133, lng: 67.0428 },
  { name: 'Paposh Nagar',      landmark: 'Paposh Nagar North Karachi', lat: 24.9380, lng: 67.0597 },
  { name: 'North Nazimabad',   landmark: 'North Nazimabad Chowrangi',  lat: 24.9399, lng: 67.0393 },
  { name: 'Liaquatabad',       landmark: 'Liaquatabad No.10',          lat: 24.9117, lng: 67.0559 },
  { name: 'Nazimabad',         landmark: 'Nazimabad No.1 Chowrangi',   lat: 24.9009, lng: 67.0416 },
  { name: 'Buffer Zone',       landmark: 'Buffer Zone North Karachi',  lat: 24.9604, lng: 67.0719 },
  { name: 'Superhighway',      landmark: 'Superhighway Toll Plaza',    lat: 24.9826, lng: 67.1009 },
  // Eastern stops
  { name: 'Gulshan Chowrangi', landmark: 'Gulshan-e-Iqbal Chowrangi', lat: 24.9253, lng: 67.0900 },
  { name: 'Rashid Minhas Rd',  landmark: 'Rashid Minhas Road',         lat: 24.9144, lng: 67.0782 },
  { name: 'University Road',   landmark: 'University of Karachi Gate', lat: 24.9437, lng: 67.1143 },
  { name: 'Johar Chowrangi',   landmark: 'Gulshan Johar Chowrangi',   lat: 24.9196, lng: 67.1190 },
  { name: 'Safoora Chowrangi', landmark: 'Safoora Goth Chowrangi',    lat: 24.9335, lng: 67.1391 },
  { name: 'Askari IV',         landmark: 'Askari IV Gate',             lat: 24.9170, lng: 67.1499 },
  { name: 'Malir Halt',        landmark: 'Malir Halt Station',         lat: 24.8946, lng: 67.1942 },
  // Southern/Clifton stops
  { name: 'Clifton',           landmark: 'Clifton Bridge',             lat: 24.8134, lng: 67.0291 },
  { name: 'Do Talwar',         landmark: 'Do Talwar Clifton',          lat: 24.8082, lng: 67.0238 },
  { name: 'Boat Basin',        landmark: 'Boat Basin Clifton',         lat: 24.8110, lng: 67.0303 },
  // Korangi/Industrial
  { name: 'Korangi Crossing',  landmark: 'Korangi Crossing',           lat: 24.8380, lng: 67.1285 },
  { name: 'Korangi No.2',      landmark: 'Korangi Sector 2',           lat: 24.8252, lng: 67.1370 },
  { name: 'Landhi',            landmark: 'Landhi Industrial Area',     lat: 24.8513, lng: 67.2056 },
  // Orangi/West
  { name: 'Orangi Town',       landmark: 'Orangi Town Sector 11',      lat: 24.9516, lng: 66.9983 },
  { name: 'Mangopir',          landmark: 'Mangopir Chowrangi',         lat: 24.9751, lng: 66.9901 },
];

// Routes: Karachi's major bus corridors
const ROUTES = [
  {
    route_code: 'R-1',
    start_point: 'Orangi Town',
    end_point: 'Tower',
    category: 'BRT',
    stops: [ // [stop_name, travel_time_from_prev_mins]
      ['Orangi Town',     0],
      ['Mangopir',        7],
      ['Nagan Chowrangi', 10],
      ['Nazimabad',       8],
      ['Liaquatabad',     6],
      ['Numaish',         7],
      ['Guru Mandir',     4],
      ['Empress Market',  5],
      ['Saddar',          4],
      ['Tower',           6],
    ],
  },
  {
    route_code: 'R-3',
    start_point: 'North Nazimabad',
    end_point: 'Tower',
    category: 'BRT',
    stops: [
      ['North Nazimabad',   0],
      ['Paposh Nagar',      6],
      ['Buffer Zone',       8],
      ['Liaquatabad',       7],
      ['Nazimabad',         5],
      ['Numaish',           8],
      ['Guru Mandir',       4],
      ['Saddar',            5],
      ['Regal Chowk',       3],
      ['Tower',             4],
    ],
  },
  {
    route_code: 'R-6',
    start_point: 'Gulshan Chowrangi',
    end_point: 'Saddar',
    category: 'BRT',
    stops: [
      ['Gulshan Chowrangi', 0],
      ['Rashid Minhas Rd',  6],
      ['Johar Chowrangi',   7],
      ['University Road',   8],
      ['Safoora Chowrangi', 9],
      ['Numaish',           12],
      ['Empress Market',    5],
      ['Saddar',            4],
    ],
  },
  {
    route_code: 'K-4',
    start_point: 'Saddar',
    end_point: 'Korangi',
    category: 'BRT',
    stops: [
      ['Saddar',           0],
      ['Lighthouse',       5],
      ['Lea Market',       6],
      ['Korangi Crossing', 15],
      ['Korangi No.2',     7],
    ],
  },
  {
    route_code: 'P-1',
    start_point: 'Saddar',
    end_point: 'Clifton',
    category: 'Pink Bus',
    stops: [
      ['Saddar',     0],
      ['Regal Chowk', 3],
      ['Tower',       5],
      ['Lighthouse',  4],
      ['Clifton',     10],
      ['Do Talwar',   4],
      ['Boat Basin',  3],
    ],
  },
  {
    route_code: 'EV-1',
    start_point: 'Superhighway',
    end_point: 'Tower',
    category: 'EV Bus',
    stops: [
      ['Superhighway',      0],
      ['Buffer Zone',       10],
      ['North Nazimabad',   8],
      ['Nagan Chowrangi',   9],
      ['Liaquatabad',       7],
      ['Numaish',           8],
      ['Tower',             10],
    ],
  },
];

// Buses per route (2-3 buses each)
const BUSES_PER_ROUTE = {
  'R-1':  ['BUS-101', 'BUS-102', 'BUS-103'],
  'R-3':  ['BUS-301', 'BUS-302'],
  'R-6':  ['BUS-601', 'BUS-602'],
  'K-4':  ['BUS-401', 'BUS-402'],
  'P-1':  ['BUS-P01', 'BUS-P02'],
  'EV-1': ['BUS-EV1', 'BUS-EV2'],
};

// ─── Seeder ───────────────────────────────────────────────────────────────────
async function seed() {
  const db = await mysql.createConnection({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT),
    user:     process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl:      { rejectUnauthorized: false },
  });

  console.log('✅ Connected to Aiven DB\n');

  try {
    // ── 0. Add lat/lng columns to Stop if not present ────────────────────────
    console.log('📐 Adding lat/lng columns to Stop...');
    await db.execute(`
      ALTER TABLE Stop
        ADD COLUMN IF NOT EXISTS latitude  DECIMAL(9,6) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS longitude DECIMAL(9,6) DEFAULT NULL
    `).catch(() => {
      // MySQL < 8 doesn't support IF NOT EXISTS on ALTER — try individually
    });
    // Fallback for older MySQL: silently ignore duplicate column errors
    for (const col of ['latitude DECIMAL(9,6) DEFAULT NULL', 'longitude DECIMAL(9,6) DEFAULT NULL']) {
      await db.execute(`ALTER TABLE Stop ADD COLUMN ${col}`).catch(() => {});
    }
    console.log('   ✓ lat/lng columns ready\n');

    // ── 1. Clear existing data (order matters for FK constraints) ────────────
    console.log('🗑  Clearing existing data...');
    await db.execute('SET FOREIGN_KEY_CHECKS = 0');
    await db.execute('TRUNCATE TABLE Simulated_Bus_Status');
    await db.execute('TRUNCATE TABLE Bus');
    await db.execute('TRUNCATE TABLE Route_Stop');
    await db.execute('TRUNCATE TABLE Area');
    await db.execute('TRUNCATE TABLE Route');
    await db.execute('TRUNCATE TABLE Stop');
    await db.execute('SET FOREIGN_KEY_CHECKS = 1');
    console.log('   ✓ Tables cleared\n');

    // ── 2. Insert Stops ───────────────────────────────────────────────────────
    console.log('📍 Inserting stops...');
    const stopIdMap = {}; // stop_name → stop_id
    for (const stop of STOPS) {
      const [r] = await db.execute(
        'INSERT INTO Stop (stop_name, landmark, latitude, longitude) VALUES (?, ?, ?, ?)',
        [stop.name, stop.landmark, stop.lat, stop.lng]
      );
      stopIdMap[stop.name] = r.insertId;
      console.log(`   ✓ ${stop.name} (id=${r.insertId})`);
    }

    // ── 3. Insert Routes + Route_Stop sequences ───────────────────────────────
    console.log('\n🛣  Inserting routes & stop sequences...');
    const routeIdMap = {}; // route_code → route_id
    for (const route of ROUTES) {
      const [r] = await db.execute(
        'INSERT INTO Route (route_code, start_point, end_point, category) VALUES (?, ?, ?, ?)',
        [route.route_code, route.start_point, route.end_point, route.category]
      );
      routeIdMap[route.route_code] = r.insertId;
      console.log(`   ✓ Route ${route.route_code} (id=${r.insertId})`);

      for (let i = 0; i < route.stops.length; i++) {
        const [stopName, travelTime] = route.stops[i];
        const stopId = stopIdMap[stopName];
        if (!stopId) {
          console.warn(`   ⚠ Stop "${stopName}" not found in Stop table — skipping`);
          continue;
        }
        await db.execute(
          'INSERT INTO Route_Stop (route_id, stop_id, stop_sequence, travel_time_from_prev_mins) VALUES (?, ?, ?, ?)',
          [r.insertId, stopId, i + 1, travelTime]
        );
      }
    }

    // ── 4. Insert Buses ───────────────────────────────────────────────────────
    console.log('\n🚌 Inserting buses...');
    const busIdMap = {}; // bus_number → bus_id
    for (const [routeCode, busNumbers] of Object.entries(BUSES_PER_ROUTE)) {
      const routeId = routeIdMap[routeCode];
      for (const busNum of busNumbers) {
        const [r] = await db.execute(
          'INSERT INTO Bus (bus_number, route_id) VALUES (?, ?)',
          [busNum, routeId]
        );
        busIdMap[busNum] = r.insertId;
        console.log(`   ✓ ${busNum} → Route ${routeCode}`);
      }
    }

    // ── 5. Seed Simulated_Bus_Status ─────────────────────────────────────────
    // Spread buses across their route stops so they start at different positions
    console.log('\n🎯 Setting initial bus positions...');
    for (const route of ROUTES) {
      const routeId    = routeIdMap[route.route_code];
      const busNumbers = BUSES_PER_ROUTE[route.route_code];

      // Get ordered stop_ids for this route
      const [routeStops] = await db.execute(
        'SELECT stop_id FROM Route_Stop WHERE route_id = ? ORDER BY stop_sequence',
        [routeId]
      );
      if (routeStops.length === 0) continue;

      for (let i = 0; i < busNumbers.length; i++) {
        const busId  = busIdMap[busNumbers[i]];
        // Distribute buses evenly across the route
        const stopIdx = Math.floor((i / busNumbers.length) * routeStops.length);
        const stopId  = routeStops[stopIdx].stop_id;

        await db.execute(
          'INSERT INTO Simulated_Bus_Status (bus_id, current_stop_id) VALUES (?, ?)',
          [busId, stopId]
        );
        console.log(`   ✓ ${busNumbers[i]} → stop_id ${stopId}`);
      }
    }

    console.log('\n✅ Seed complete! Your Aiven DB is ready.\n');
    console.log('Summary:');
    console.log(`  Stops:   ${STOPS.length}`);
    console.log(`  Routes:  ${ROUTES.length}`);
    const totalBuses = Object.values(BUSES_PER_ROUTE).reduce((a,b) => a + b.length, 0);
    console.log(`  Buses:   ${totalBuses}`);

  } catch (err) {
    console.error('❌ Seed error:', err.message);
    throw err;
  } finally {
    await db.end();
  }
}

seed();
