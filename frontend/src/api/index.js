// All API calls to the Flask backend live here.
// Base URL points to Flask dev server.
// When you add the Vite proxy (vite.config.js), change BASE_URL to '/api'

// const BASE_URL = 'http://localhost:5000/api';
const BASE_URL = 'http://localhost:5000/api';

// ─── AUTH ────────────────────────────────────────────────────────────────────

export async function adminLogin(username, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return res.json();
}

export async function adminLogout() {
  const res = await fetch(`${BASE_URL}/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
  });
  return res.json();
}

// ─── ROUTE FINDER (commuter) ──────────────────────────────────────────────────

export async function findRoute(from, to) {
  const res = await fetch(
    `${BASE_URL}/find-route?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  );
  return res.json();
}

export async function getAllStations() {
  const res = await fetch(`${BASE_URL}/stations`);
  return res.json();
}

// ─── BUS POSITIONS (simulation) ──────────────────────────────────────────────

export async function getBusPositions() {
  const res = await fetch(`${BASE_URL}/buses/positions`);
  return res.json();
}

// ─── ADMIN: ROUTES ───────────────────────────────────────────────────────────

export async function getRoutes() {
  const res = await fetch(`${BASE_URL}/admin/routes`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
  });
  return res.json();
}

export async function createRoute(data) {
  const res = await fetch(`${BASE_URL}/admin/routes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateRoute(id, data) {
  const res = await fetch(`${BASE_URL}/admin/routes/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteRoute(id) {
  const res = await fetch(`${BASE_URL}/admin/routes/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
  });
  return res.json();
}

// ─── ADMIN: STATIONS ─────────────────────────────────────────────────────────

export async function getStations() {
  const res = await fetch(`${BASE_URL}/admin/stations`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
  });
  return res.json();
}

export async function createStation(data) {
  const res = await fetch(`${BASE_URL}/admin/stations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateStation(id, data) {
  const res = await fetch(`${BASE_URL}/admin/stations/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteStation(id) {
  const res = await fetch(`${BASE_URL}/admin/stations/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
  });
  return res.json();
}

// ─── ADMIN: BUSES ────────────────────────────────────────────────────────────

export async function getBuses() {
  const res = await fetch(`${BASE_URL}/admin/buses`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
  });
  return res.json();
}

export async function createBus(data) {
  const res = await fetch(`${BASE_URL}/admin/buses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateBus(id, data) {
  const res = await fetch(`${BASE_URL}/admin/buses/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteBus(id) {
  const res = await fetch(`${BASE_URL}/admin/buses/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
  });
  return res.json();
}