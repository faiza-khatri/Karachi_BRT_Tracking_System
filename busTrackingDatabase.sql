DROP DATABASE IF EXISTS karachi_red_bus;
CREATE DATABASE karachi_red_bus;
USE karachi_red_bus;

-- 1. Routes
CREATE TABLE routes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(10) UNIQUE NOT NULL,
    description VARCHAR(255)
);

-- 2. Stations
CREATE TABLE stations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    area VARCHAR(100)
);

-- 3. Buses
CREATE TABLE buses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bus_number VARCHAR(20) NOT NULL,
    route_id INT,
    capacity INT DEFAULT 0,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL
);

-- 4. Admins
CREATE TABLE admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL
);

-- 5. Users
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(50) NOT NULL
);

-- ── Dummy Data ────────────────────────────────────────────────────────────────

INSERT INTO routes (name, description) VALUES
('R-1', 'Saddar → Clifton → Korangi'),
('R-2', 'North Nazimabad → Gulshan → Landhi'),
('R-3', 'Saddar → Gulshan-e-Iqbal → Landhi');

INSERT INTO stations (name, area) VALUES
('Saddar',          'Central Karachi'),
('Clifton',         'South Karachi'),
('Gulshan-e-Iqbal', 'East Karachi'),
('Korangi',         'East Karachi'),
('Landhi',          'East Karachi'),
('North Nazimabad', 'North Karachi');

INSERT INTO buses (bus_number, route_id, capacity) VALUES
('KB-101', 1, 50),
('KB-102', 2, 45),
('KB-103', 3, 50);

INSERT INTO admins (username, password_hash) VALUES
('admin1', 'habib27'),
('admin2', 'habib24'),
('admin3', 'habib25');

INSERT INTO users (username, password) VALUES
('yusra',   'wow12'),
('niva',   'wow16'),
('sualeha', 'wow17');