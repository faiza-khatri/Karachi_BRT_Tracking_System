const BASE = 'http://localhost:5000/api';

const token = () => localStorage.getItem('adminToken');

const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token()}`,
});

export function getAllStations() {
  return fetch(`${BASE}/stations`).then(r => r.json());
}

export function getBusPositions() {
  return fetch(`${BASE}/bus-positions`).then(r => r.json());
}

export function findRoute(from, to) {
  return fetch(`${BASE}/find-route?from=${from}&to=${to}`).then(r => r.json());
}

export function getRoutes() {
  return fetch(`${BASE}/routes`, { headers: authHeaders() }).then(r => r.json());
}

export function getStations() {
  return fetch(`${BASE}/stations`, { headers: authHeaders() }).then(r => r.json());
}

export function getBuses() {
  return fetch(`${BASE}/buses`, { headers: authHeaders() }).then(r => r.json());
}

export function createRoute(data) {
  return fetch(`${BASE}/routes`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) }).then(r => r.json());
}

export function createStation(data) {
  return fetch(`${BASE}/stations`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) }).then(r => r.json());
}

export function createBus(data) {
  return fetch(`${BASE}/buses`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) }).then(r => r.json());
}

export function deleteRoute(id) {
  return fetch(`${BASE}/routes/${id}`, { method: 'DELETE', headers: authHeaders() }).then(r => r.json());
}

export function deleteStation(id) {
  return fetch(`${BASE}/stations/${id}`, { method: 'DELETE', headers: authHeaders() }).then(r => r.json());
}

export function deleteBus(id) {
  return fetch(`${BASE}/buses/${id}`, { method: 'DELETE', headers: authHeaders() }).then(r => r.json());
}

export function adminLogout() {
  return fetch(`${BASE}/logout`, { method: 'POST', headers: authHeaders() }).then(r => r.json());
}