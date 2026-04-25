const BASE = 'http://localhost:5000/api';

const token = () => localStorage.getItem('adminToken');

const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token()}`,
});

// ─── Public endpoints (no auth required) ─────────────────────────────────────

// FIX: was hitting /api/stations (auth-protected). Now hits the public /api/stops
// endpoint and remaps stop_id→id, stop_name→name so RouteFinder's <select> works.
export function getAllStations() {
  return fetch(`${BASE}/stops`)
    .then(r => r.json())
    .then(data => ({
      stations: (data.stops || []).map(s => ({
        id:   s.stop_id,
        name: s.stop_name,
      })),
    }));
}

// Used by LiveMap — polls every 3s for interpolated bus positions
export function getBusPositions() {
  return fetch(`${BASE}/bus-positions`).then(r => r.json());
}

// Used by RouteFinder — from/to are stop_ids coming from getAllStations above
export function findRoute(from, to) {
  return fetch(`${BASE}/find-route?from=${from}&to=${to}`).then(r => r.json());
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

// Login.jsx calls this directly with fetch, but exported here for consistency
export function adminLogin(username, password) {
  return fetch(`${BASE}/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ username, password }),
  }).then(r => r.json());
}

export function adminLogout() {
  return fetch(`${BASE}/logout`, {
    method:  'POST',
    headers: authHeaders(),
  }).then(r => r.json());
}

// ─── Routes CRUD (Dashboard) ──────────────────────────────────────────────────

export function getRoutes() {
  return fetch(`${BASE}/routes`, { headers: authHeaders() }).then(r => r.json());
}

// FIX: CrudPanel sends whatever keys match its `fields` array.
// Update Dashboard.jsx Routes fields to use these exact keys:
//   { key:'route_code', label:'Route Code (e.g. R-1)' }
//   { key:'start_point', label:'Start Point' }
//   { key:'end_point', label:'End Point' }
//   { key:'category', label:'Category (BRT / Pink Bus / EV Bus)' }
export function createRoute(data) {
  return fetch(`${BASE}/routes`, {
    method:  'POST',
    headers: authHeaders(),
    body:    JSON.stringify({
      route_code:  data.route_code  || '',
      start_point: data.start_point || '',
      end_point:   data.end_point   || '',
      category:    data.category    || 'BRT',
    }),
  }).then(r => r.json());
}

export function deleteRoute(id) {
  return fetch(`${BASE}/routes/${id}`, {
    method:  'DELETE',
    headers: authHeaders(),
  }).then(r => r.json());
}

// ─── Stations CRUD (Dashboard) ────────────────────────────────────────────────

export function getStations() {
  return fetch(`${BASE}/stations`, { headers: authHeaders() }).then(r => r.json());
}

// FIX: Update Dashboard.jsx Stations fields to:
//   { key:'stop_name', label:'Station Name' }
//   { key:'landmark',  label:'Landmark / Area' }
export function createStation(data) {
  return fetch(`${BASE}/stations`, {
    method:  'POST',
    headers: authHeaders(),
    body:    JSON.stringify({
      stop_name: data.stop_name || '',
      landmark:  data.landmark  || '',
    }),
  }).then(r => r.json());
}

export function deleteStation(id) {
  return fetch(`${BASE}/stations/${id}`, {
    method:  'DELETE',
    headers: authHeaders(),
  }).then(r => r.json());
}

// ─── Buses CRUD (Dashboard) ───────────────────────────────────────────────────

export function getBuses() {
  return fetch(`${BASE}/buses`, { headers: authHeaders() }).then(r => r.json());
}

// Note: 'capacity' is in the Dashboard form but not in your DB schema — dropped.
// Bus table only has bus_number and route_id.
export function createBus(data) {
  return fetch(`${BASE}/buses`, {
    method:  'POST',
    headers: authHeaders(),
    body:    JSON.stringify({
      bus_number: data.bus_number || '',
      route_id:   parseInt(data.route_id) || null,
    }),
  }).then(r => r.json());
}

export function deleteBus(id) {
  return fetch(`${BASE}/buses/${id}`, {
    method:  'DELETE',
    headers: authHeaders(),
  }).then(r => r.json());
}