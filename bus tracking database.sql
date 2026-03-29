DROP DATABASE IF EXISTS karachi_red_bus;
CREATE DATABASE karachi_red_bus;
USE karachi_red_bus;

-- 1. Create Routes (Now with start/end points)
CREATE TABLE routes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    route_name VARCHAR(10) UNIQUE NOT NULL,
    start_point VARCHAR(100),
    end_point VARCHAR(100)
);

-- 2. Create Stations (Linked to Routes)
CREATE TABLE stations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    route_id INT,
    station_name VARCHAR(100) NOT NULL,
    stop_order INT NOT NULL,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
);

-- 3. Create Buses (Linked to Routes)
CREATE TABLE buses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bus_number VARCHAR(20) NOT NULL,
    route_id INT,
    current_lat DECIMAL(10, 8),
    current_lng DECIMAL(11, 8),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
);

-- 4. Create Admins
CREATE TABLE admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL
);

-- 5. INSERT DUMMY DATA
INSERT INTO routes (route_name, start_point, end_point) VALUES 
('R-01', 'Airport', 'Saddar'),
('R-07', 'NED University', 'Civic Centre'),
('R-12', 'Gulshan', 'Empress Market');

INSERT INTO admins (username, password_hash) VALUES ('admin1', 'habib27');
INSERT INTO admins (username, password_hash) VALUES ('admin2', 'habib24');
INSERT INTO admins (username, password_hash) VALUES ('admin3', 'habib25');