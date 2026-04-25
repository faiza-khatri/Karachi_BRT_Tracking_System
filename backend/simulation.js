// simulation.js — Bus simulation engine
// Loads all routes+stops from DB, then advances each bus along its route
// based on travel_time_from_prev_mins. Updates Simulated_Bus_Status every tick.

const TICK_INTERVAL_MS = 10_000; // 10 seconds real time = advance simulation clock

// How many real seconds = 1 simulated minute
// At 10s tick and SPEED_FACTOR=3 → each tick advances 30 sim-minutes
// → a 5-min stop gap takes ~10s real time. Adjust to taste.
const SPEED_FACTOR = 1; // 1 real-second = 1 sim-minute

// Internal state
let db         = null;
let routes     = {};   // routeId → { stops: [{stop_id, sequence, travel_time}] }
let busStates  = {};   // busId   → { routeId, currentStopIdx, minutesAtCurrentLeg, direction }

async function loadRouteData() {
  const [routeRows] = await db.promise().query(`
    SELECT r.route_id, rs.stop_id, rs.stop_sequence, rs.travel_time_from_prev_mins,
           s.stop_name, s.latitude, s.longitude
    FROM Route r
    JOIN Route_Stop rs ON r.route_id = rs.route_id
    JOIN Stop s        ON rs.stop_id = s.stop_id
    ORDER BY r.route_id, rs.stop_sequence
  `);

  routes = {};
  for (const row of routeRows) {
    if (!routes[row.route_id]) routes[row.route_id] = { stops: [] };
    routes[row.route_id].stops.push({
      stop_id:    row.stop_id,
      stop_name:  row.stop_name,
      sequence:   row.stop_sequence,
      travel_time: row.travel_time_from_prev_mins || 5,
      lat:        parseFloat(row.latitude),
      lng:        parseFloat(row.longitude),
    });
  }
}

async function loadBusStates() {
  const [busRows] = await db.promise().query(`
    SELECT b.bus_id, b.route_id, b.bus_number,
           sbs.current_stop_id
    FROM Bus b
    LEFT JOIN Simulated_Bus_Status sbs ON b.bus_id = sbs.bus_id
  `);

  for (const bus of busRows) {
    const routeStops = routes[bus.route_id]?.stops || [];
    const currentIdx = routeStops.findIndex(s => s.stop_id === bus.current_stop_id);
    busStates[bus.bus_id] = {
      bus_id:          bus.bus_id,
      bus_number:      bus.bus_number,
      route_id:        bus.route_id,
      currentStopIdx:  currentIdx >= 0 ? currentIdx : 0,
      minutesElapsed:  0,          // minutes elapsed travelling to next stop
      direction:       1,          // 1 = forward, -1 = reverse (ping-pong)
    };
  }
}

async function updateBusInDb(busId, stopId) {
  await db.promise().query(`
    INSERT INTO Simulated_Bus_Status (bus_id, current_stop_id)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE current_stop_id = VALUES(current_stop_id), last_updated = NOW()
  `, [busId, stopId]);
}

function tick() {
  const simMinutesPerTick = TICK_INTERVAL_MS / 1000 * SPEED_FACTOR;

  for (const [busId, state] of Object.entries(busStates)) {
    const routeStops = routes[state.route_id]?.stops;
    if (!routeStops || routeStops.length < 2) continue;

    state.minutesElapsed += simMinutesPerTick;

    // Figure out time needed to reach next stop
    const nextIdx      = state.currentStopIdx + state.direction;
    const nextStop     = routeStops[nextIdx];
    if (!nextStop) continue;

    const timeToNext   = nextStop.travel_time; // minutes

    // Advance stop if enough time has passed
    if (state.minutesElapsed >= timeToNext) {
      state.minutesElapsed = 0;
      state.currentStopIdx = nextIdx;

      // Ping-pong at ends
      if (state.currentStopIdx >= routeStops.length - 1) state.direction = -1;
      if (state.currentStopIdx <= 0)                     state.direction =  1;

      // Update DB
      const newStop = routeStops[state.currentStopIdx];
      updateBusInDb(parseInt(busId), newStop.stop_id).catch(e =>
        console.error(`⚠ Failed to update bus ${busId}:`, e.message)
      );
    }
  }
}

// Returns live enriched positions for the API
function getLivePositions() {
  return Object.values(busStates).map(state => {
    const routeStops  = routes[state.route_id]?.stops || [];
    const currentStop = routeStops[state.currentStopIdx];
    const nextIdx     = state.currentStopIdx + state.direction;
    const nextStop    = routeStops[nextIdx];

    // Interpolate lat/lng between current and next stop
    let lat = currentStop?.lat ?? null;
    let lng = currentStop?.lng ?? null;

    if (currentStop && nextStop && nextStop.travel_time > 0) {
      const progress = Math.min(state.minutesElapsed / nextStop.travel_time, 1);
      lat = currentStop.lat + (nextStop.lat - currentStop.lat) * progress;
      lng = currentStop.lng + (nextStop.lng - currentStop.lng) * progress;
    }

    // ETA to each stop on the route from current position
    const eta = computeEtas(state, routeStops);

    return {
      bus_id:       state.bus_id,
      bus_number:   state.bus_number,
      route_id:     state.route_id,
      current_stop_id:   currentStop?.stop_id   ?? null,
      current_stop_name: currentStop?.stop_name ?? 'Unknown',
      next_stop_id:      nextStop?.stop_id       ?? null,
      next_stop_name:    nextStop?.stop_name     ?? null,
      lat,
      lng,
      progress_pct: nextStop?.travel_time
        ? Math.round((state.minutesElapsed / nextStop.travel_time) * 100)
        : 0,
      direction: state.direction === 1 ? 'forward' : 'reverse',
      eta_to_stops: eta,
    };
  });
}

function computeEtas(state, routeStops) {
  const result = {};
  // Time remaining to next stop
  const nextIdx   = state.currentStopIdx + state.direction;
  const nextStop  = routeStops[nextIdx];
  const remaining = nextStop ? Math.max(0, nextStop.travel_time - state.minutesElapsed) : 0;

  // Walk forward from current position accumulating travel times
  let accMinutes = remaining;
  let idx        = nextIdx;

  while (idx >= 0 && idx < routeStops.length) {
    result[routeStops[idx].stop_id] = Math.round(accMinutes);
    const followIdx = idx + state.direction;
    const follow    = routeStops[followIdx];
    if (follow) accMinutes += follow.travel_time;
    idx += state.direction;
  }

  // Current stop = 0 mins
  if (routeStops[state.currentStopIdx]) {
    result[routeStops[state.currentStopIdx].stop_id] = 0;
  }

  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────
let tickInterval = null;

async function startSimulation(dbPool) {
  db = dbPool;
  console.log('🔄 Loading simulation data from DB...');
  await loadRouteData();
  await loadBusStates();
  const busCount   = Object.keys(busStates).length;
  const routeCount = Object.keys(routes).length;
  console.log(`✅ Simulation started: ${busCount} buses across ${routeCount} routes`);
  console.log(`   Tick every ${TICK_INTERVAL_MS / 1000}s · speed factor ${SPEED_FACTOR}x\n`);

  tickInterval = setInterval(tick, TICK_INTERVAL_MS);
}

function stopSimulation() {
  if (tickInterval) clearInterval(tickInterval);
}

module.exports = { startSimulation, stopSimulation, getLivePositions, routes, busStates };
