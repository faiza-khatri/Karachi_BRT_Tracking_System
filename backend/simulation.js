// simulation.js — Bus simulation engine
// Each bus moves along its route continuously, ping-ponging at the ends.
// Position is interpolated between stops for smooth GPS-like movement.

const TICK_INTERVAL_MS = 2_000;   // tick every 2 real seconds
const SIM_MINUTES_PER_TICK = 1.5; // each tick advances 1.5 sim-minutes
// Effect: a 6-min leg takes 6/1.5 * 2s = 8 real seconds to traverse ✓
// Buses are visibly moving across the map in real time

let db        = null;
let routes    = {};   // routeId → { stops: [{stop_id, stop_name, travel_time, lat, lng}] }
let busStates = {};   // busId   → state object

async function loadRouteData() {
  const [rows] = await db.promise().query(`
    SELECT r.route_id, rs.stop_id, rs.stop_sequence,
           rs.travel_time_from_prev_mins,
           s.stop_name, s.latitude, s.longitude
    FROM Route r
    JOIN Route_Stop rs ON r.route_id = rs.route_id
    JOIN Stop s        ON rs.stop_id  = s.stop_id
    ORDER BY r.route_id, rs.stop_sequence
  `);

  routes = {};
  for (const row of rows) {
    if (!routes[row.route_id]) routes[row.route_id] = { stops: [] };
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

async function loadBusStates() {
  const [busRows] = await db.promise().query(`
    SELECT b.bus_id, b.route_id, b.bus_number, sbs.current_stop_id
    FROM Bus b
    LEFT JOIN Simulated_Bus_Status sbs ON b.bus_id = sbs.bus_id
  `);

  busStates = {};
  for (const bus of busRows) {
    const routeStops = routes[bus.route_id]?.stops || [];

    // Stagger buses on the same route so they don't stack at stop 0
    const busesOnRoute = Object.values(busStates).filter(s => s.route_id === bus.route_id).length;
    const staggerIdx   = routeStops.length > 1
      ? Math.floor((busesOnRoute / 3) * routeStops.length) % routeStops.length
      : 0;

    busStates[bus.bus_id] = {
      bus_id:         bus.bus_id,
      bus_number:     bus.bus_number,
      route_id:       bus.route_id,
      currentStopIdx: staggerIdx,
      minutesElapsed: 0,
      direction:      1,
    };
  }
}

async function updateBusInDb(busId, stopId) {
  await db.promise().query(`
    INSERT INTO Simulated_Bus_Status (bus_id, current_stop_id)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE current_stop_id = VALUES(current_stop_id), last_updated = NOW()
  `, [busId, stopId]).catch(e => console.error(`DB update failed bus ${busId}:`, e.message));
}

function tick() {
  for (const [busId, state] of Object.entries(busStates)) {
    const stops = routes[state.route_id]?.stops;
    if (!stops || stops.length < 2) continue;

    state.minutesElapsed += SIM_MINUTES_PER_TICK;

    const nextIdx  = state.currentStopIdx + state.direction;
    const nextStop = stops[nextIdx];
    if (!nextStop) continue;

    if (state.minutesElapsed >= nextStop.travel_time) {
      state.minutesElapsed = 0;
      state.currentStopIdx = nextIdx;

      if (state.currentStopIdx >= stops.length - 1) state.direction = -1;
      if (state.currentStopIdx <= 0)                state.direction =  1;

      updateBusInDb(parseInt(busId), stops[state.currentStopIdx].stop_id);
    }
  }
}

function getLivePositions() {
  return Object.values(busStates).map(state => {
    const stops       = routes[state.route_id]?.stops || [];
    const currentStop = stops[state.currentStopIdx];
    const nextIdx     = state.currentStopIdx + state.direction;
    const nextStop    = stops[nextIdx];

    if (!currentStop) return null;

    let lat = currentStop.lat;
    let lng = currentStop.lng;
    let progress = 0;

    if (nextStop && nextStop.travel_time > 0) {
      progress = Math.min(state.minutesElapsed / nextStop.travel_time, 1);
      lat = currentStop.lat + (nextStop.lat - currentStop.lat) * progress;
      lng = currentStop.lng + (nextStop.lng - currentStop.lng) * progress;
    }

    // ETAs from current position forward
    const eta = {};
    const remaining = nextStop ? Math.max(0, nextStop.travel_time - state.minutesElapsed) : 0;
    let acc = remaining;
    let idx = nextIdx;
    eta[currentStop.stop_id] = 0;

    while (idx >= 0 && idx < stops.length) {
      eta[stops[idx].stop_id] = Math.round(acc);
      const followIdx = idx + state.direction;
      if (followIdx >= 0 && followIdx < stops.length) acc += stops[followIdx].travel_time;
      idx += state.direction;
    }

    return {
      bus_id:            state.bus_id,
      bus_number:        state.bus_number,
      route_id:          state.route_id,
      current_stop_id:   currentStop.stop_id,
      current_stop_name: currentStop.stop_name,
      next_stop_id:      nextStop?.stop_id   ?? null,
      next_stop_name:    nextStop?.stop_name ?? null,
      lat, lng,
      progress_pct:      Math.round(progress * 100),
      direction:         state.direction === 1 ? 'forward' : 'reverse',
      eta_to_stops:      eta,
    };
  }).filter(Boolean);
}

let tickInterval = null;

async function startSimulation(dbPool) {
  db = dbPool;
  console.log('🔄 Loading simulation data from DB...');
  await loadRouteData();
  await loadBusStates();
  const busCount   = Object.keys(busStates).length;
  const routeCount = Object.keys(routes).length;
  console.log(`✅ Simulation: ${busCount} buses on ${routeCount} routes`);
  console.log(`   Tick: ${TICK_INTERVAL_MS}ms · ${SIM_MINUTES_PER_TICK} sim-min/tick\n`);
  tickInterval = setInterval(tick, TICK_INTERVAL_MS);
}

function stopSimulation() {
  if (tickInterval) clearInterval(tickInterval);
}

module.exports = { startSimulation, stopSimulation, getLivePositions, routes, busStates };