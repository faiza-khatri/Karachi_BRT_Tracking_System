// simulation.js
// Mimics real GPS: every tick computes interpolated lat/lng and writes it
// to Bus_Location table — identical architecture to real GPS pings.
// Swap the setInterval writes for real device writes and nothing else changes.

const TICK_INTERVAL_MS    = 2_000;  // write a "GPS ping" every 2s
const SIM_MINUTES_PER_TICK = 1.5;  // 1 tick = 1.5 simulated minutes
// → a 6-min leg takes 6/1.5 × 2s = 8 real seconds to traverse

let db        = null;
let routes    = {};     // routeId → { route_code, stops: [{...}] }
let busStates = {};     // busId   → in-memory movement state

// ── Schema migration ──────────────────────────────────────────────────────────
async function ensureSchema() {
  // Bus_Location: one row per GPS ping (real or simulated)
  await db.promise().query(`
    CREATE TABLE IF NOT EXISTS Bus_Location (
      location_id BIGINT AUTO_INCREMENT PRIMARY KEY,
      bus_id      INT NOT NULL,
      lat         DECIMAL(10,7) NOT NULL,
      lng         DECIMAL(10,7) NOT NULL,
      recorded_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_bus_recorded (bus_id, recorded_at DESC),
      FOREIGN KEY (bus_id) REFERENCES Bus(bus_id) ON DELETE CASCADE
    )
  `).catch(e => console.error('Bus_Location table error:', e.message));

  console.log('   ✓ Bus_Location table ready');
}

// ── Load route graph from DB ───────────────────────────────────────────────────
async function loadRouteData() {
  const [rows] = await db.promise().query(`
    SELECT r.route_id, r.route_code,
           rs.stop_id, rs.stop_sequence, rs.travel_time_from_prev_mins,
           s.stop_name, s.latitude, s.longitude
    FROM Route r
    JOIN Route_Stop rs ON r.route_id = rs.route_id
    JOIN Stop s        ON rs.stop_id  = s.stop_id
    ORDER BY r.route_id, rs.stop_sequence
  `);

  routes = {};
  for (const row of rows) {
    if (!routes[row.route_id]) routes[row.route_id] = { route_code: row.route_code, stops: [] };
    routes[row.route_id].stops.push({
      stop_id:     row.stop_id,
      stop_name:   row.stop_name,
      sequence:    row.stop_sequence,
      travel_time: Math.max(1, row.travel_time_from_prev_mins || 5),
      lat:         parseFloat(row.latitude),
      lng:         parseFloat(row.longitude),
    });
  }
}

// ── Load buses, spread them across their routes ───────────────────────────────
async function loadBusStates() {
  const [busRows] = await db.promise().query(`
    SELECT b.bus_id, b.route_id, b.bus_number
    FROM Bus b
    ORDER BY b.route_id, b.bus_id
  `);

  // Count buses per route for even spacing
  const routeBusCounts = {};
  busRows.forEach(b => { routeBusCounts[b.route_id] = (routeBusCounts[b.route_id] || 0) + 1; });
  const routeBusIndex = {};

  busStates = {};
  for (const bus of busRows) {
    const stops = routes[bus.route_id]?.stops || [];
    if (!routeBusIndex[bus.route_id]) routeBusIndex[bus.route_id] = 0;
    const busIndex    = routeBusIndex[bus.route_id]++;
    const totalBuses  = routeBusCounts[bus.route_id];

    // Space buses evenly across the route
    const startIdx = stops.length > 1
      ? Math.floor((busIndex / totalBuses) * stops.length) % stops.length
      : 0;

    // Alternate directions so buses aren't all going the same way
    const startDir = busIndex % 2 === 0 ? 1 : -1;

    busStates[bus.bus_id] = {
      bus_id:         bus.bus_id,
      bus_number:     bus.bus_number,
      route_id:       bus.route_id,
      currentStopIdx: startIdx,
      minutesElapsed: (busIndex * 2.0),  // stagger start time too
      direction:      startDir,
    };
  }
}

// ── Write GPS ping to DB ───────────────────────────────────────────────────────
async function writeLocationPing(busId, lat, lng) {
  await db.promise().query(
    'INSERT INTO Bus_Location (bus_id, lat, lng) VALUES (?, ?, ?)',
    [busId, lat, lng]
  ).catch(e => console.error(`Ping write failed bus ${busId}:`, e.message));
}

// Update the "current stop" tracker too
async function updateCurrentStop(busId, stopId) {
  await db.promise().query(`
    INSERT INTO Simulated_Bus_Status (bus_id, current_stop_id)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE current_stop_id = VALUES(current_stop_id), last_updated = NOW()
  `, [busId, stopId]).catch(() => {});
}

// ── Tick: advance simulation, write pings ─────────────────────────────────────
async function tick() {
  const pingPromises = [];

  for (const [busId, state] of Object.entries(busStates)) {
    const stops = routes[state.route_id]?.stops;
    if (!stops || stops.length < 2) continue;

    state.minutesElapsed += SIM_MINUTES_PER_TICK;

    const nextIdx  = state.currentStopIdx + state.direction;
    const nextStop = stops[nextIdx];
    if (!nextStop) continue;

    // Crossed into next stop?
    if (state.minutesElapsed >= nextStop.travel_time) {
      state.minutesElapsed -= nextStop.travel_time; // carry over excess
      state.currentStopIdx  = nextIdx;

      // Ping-pong at route ends
      if (state.currentStopIdx >= stops.length - 1) state.direction = -1;
      if (state.currentStopIdx <= 0)                state.direction =  1;

      // Write exact stop location + update current_stop
      const arrivedStop = stops[state.currentStopIdx];
      pingPromises.push(writeLocationPing(parseInt(busId), arrivedStop.lat, arrivedStop.lng));
      pingPromises.push(updateCurrentStop(parseInt(busId), arrivedStop.stop_id));
    } else {
      // Interpolate position between current and next stop
      const currentStop = stops[state.currentStopIdx];
      const progress    = Math.min(state.minutesElapsed / nextStop.travel_time, 1);
      const lat = currentStop.lat + (nextStop.lat - currentStop.lat) * progress;
      const lng = currentStop.lng + (nextStop.lng - currentStop.lng) * progress;
      pingPromises.push(writeLocationPing(parseInt(busId), lat, lng));
    }
  }

  // Fire all DB writes concurrently, don't block the tick
  await Promise.allSettled(pingPromises);
}

// ── getLivePositions: reads latest ping from DB per bus ───────────────────────
// This is identical to what you'd do with real GPS devices
async function getLivePositionsFromDb() {
  const [rows] = await db.promise().query(`
    SELECT
      bl.bus_id, bl.lat, bl.lng, bl.recorded_at,
      b.bus_number, b.route_id,
      sbs.current_stop_id,
      s.stop_name AS current_stop_name
    FROM Bus_Location bl
    JOIN (
      SELECT bus_id, MAX(recorded_at) AS latest
      FROM Bus_Location
      GROUP BY bus_id
    ) latest ON bl.bus_id = latest.bus_id AND bl.recorded_at = latest.latest
    JOIN Bus b   ON bl.bus_id = b.bus_id
    LEFT JOIN Simulated_Bus_Status sbs ON b.bus_id = sbs.bus_id
    LEFT JOIN Stop s ON sbs.current_stop_id = s.stop_id
  `);

  return rows.map(row => {
    const state     = busStates[row.bus_id];
    const stops     = routes[row.route_id]?.stops || [];
    const nextIdx   = state ? state.currentStopIdx + state.direction : -1;
    const nextStop  = nextIdx >= 0 && nextIdx < stops.length ? stops[nextIdx] : null;
    const curIdx    = state?.currentStopIdx ?? 0;
    const curStop   = stops[curIdx];

    // ETA to each stop on this route
    const eta = {};
    if (state) {
      const remaining = nextStop
        ? Math.max(0, nextStop.travel_time - state.minutesElapsed)
        : 0;
      let acc = remaining;
      let idx = nextIdx;
      if (curStop) eta[curStop.stop_id] = 0;
      while (idx >= 0 && idx < stops.length) {
        eta[stops[idx].stop_id] = Math.round(acc);
        const fi = idx + state.direction;
        if (fi >= 0 && fi < stops.length) acc += stops[fi].travel_time;
        idx += state.direction;
      }
    }

    return {
      bus_id:            row.bus_id,
      bus_number:        row.bus_number,
      route_id:          row.route_id,
      lat:               parseFloat(row.lat),
      lng:               parseFloat(row.lng),
      current_stop_id:   row.current_stop_id,
      current_stop_name: row.current_stop_name || 'En route',
      next_stop_id:      nextStop?.stop_id   ?? null,
      next_stop_name:    nextStop?.stop_name ?? null,
      progress_pct:      state && nextStop
        ? Math.round(Math.min(state.minutesElapsed / nextStop.travel_time, 1) * 100)
        : 0,
      direction:         state?.direction === 1 ? 'forward' : 'reverse',
      eta_to_stops:      eta,
      last_ping:         row.recorded_at,
    };
  });
}

// ── Periodic cleanup: keep only last 200 pings per bus ───────────────────────
async function cleanupOldPings() {
  await db.promise().query(`
    DELETE bl FROM Bus_Location bl
    INNER JOIN (
      SELECT bus_id, recorded_at
      FROM (
        SELECT bus_id, recorded_at,
               ROW_NUMBER() OVER (PARTITION BY bus_id ORDER BY recorded_at DESC) AS rn
        FROM Bus_Location
      ) ranked
      WHERE rn > 200
    ) old ON bl.bus_id = old.bus_id AND bl.recorded_at = old.recorded_at
  `).catch(() => {}); // silently ignore if ROW_NUMBER unsupported
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
let tickInterval    = null;
let cleanupInterval = null;

async function startSimulation(dbPool) {
  db = dbPool;
  console.log('🔄 Setting up simulation...');
  await ensureSchema();
  await loadRouteData();
  await loadBusStates();

  const busCount   = Object.keys(busStates).length;
  const routeCount = Object.keys(routes).length;
  console.log(`✅ Simulation ready: ${busCount} buses on ${routeCount} routes`);
  console.log(`   GPS ping every ${TICK_INTERVAL_MS}ms · ${SIM_MINUTES_PER_TICK} sim-min/tick\n`);

  tickInterval    = setInterval(tick, TICK_INTERVAL_MS);
  cleanupInterval = setInterval(cleanupOldPings, 5 * 60 * 1000); // every 5 min
}

function stopSimulation() {
  if (tickInterval)    clearInterval(tickInterval);
  if (cleanupInterval) clearInterval(cleanupInterval);
}

// Sync in-memory fallback for /api/bus-positions when DB hasn't been written yet
function getLivePositionsMemory() {
  return Object.values(busStates).map(state => {
    const stops       = routes[state.route_id]?.stops || [];
    const currentStop = stops[state.currentStopIdx];
    const nextIdx     = state.currentStopIdx + state.direction;
    const nextStop    = stops[nextIdx];
    if (!currentStop) return null;
    let lat = currentStop.lat, lng = currentStop.lng, progress = 0;
    if (nextStop && nextStop.travel_time > 0) {
      progress = Math.min(state.minutesElapsed / nextStop.travel_time, 1);
      lat = currentStop.lat + (nextStop.lat - currentStop.lat) * progress;
      lng = currentStop.lng + (nextStop.lng - currentStop.lng) * progress;
    }
    const eta = {};
    const remaining = nextStop ? Math.max(0, nextStop.travel_time - state.minutesElapsed) : 0;
    let acc = remaining, idx = nextIdx;
    if (currentStop) eta[currentStop.stop_id] = 0;
    while (idx >= 0 && idx < stops.length) {
      eta[stops[idx].stop_id] = Math.round(acc);
      const fi = idx + state.direction;
      if (fi >= 0 && fi < stops.length) acc += stops[fi].travel_time;
      idx += state.direction;
    }
    return {
      bus_id: state.bus_id, bus_number: state.bus_number, route_id: state.route_id,
      lat, lng, progress_pct: Math.round(progress * 100),
      current_stop_id: currentStop.stop_id, current_stop_name: currentStop.stop_name,
      next_stop_id: nextStop?.stop_id ?? null, next_stop_name: nextStop?.stop_name ?? null,
      direction: state.direction === 1 ? 'forward' : 'reverse',
      eta_to_stops: eta,
    };
  }).filter(Boolean);
}

module.exports = {
  startSimulation,
  stopSimulation,
  getLivePositions: getLivePositionsMemory,   // fast, in-memory
  getLivePositionsFromDb,                      // accurate, from DB (real GPS equivalent)
  routes,
  busStates,
};