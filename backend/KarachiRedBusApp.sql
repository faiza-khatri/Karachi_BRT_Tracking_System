CREATE DATABASE KarachiRedBusApp;
USE KarachiRedBusApp;

-- 1. Admin Table
CREATE TABLE Admin (
    admin_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'System_Admin'
);

-- 2. Stop Table: All physical locations on the map
CREATE TABLE Stop (
    stop_id INT AUTO_INCREMENT PRIMARY KEY,
    stop_name VARCHAR(100) NOT NULL,
    landmark VARCHAR(150)
);

-- 3. Area Table: Maps common area names to a specific stop for user input
CREATE TABLE Area (
    area_id INT AUTO_INCREMENT PRIMARY KEY,
    area_name VARCHAR(100) NOT NULL,
    nearest_stop_id INT,
    FOREIGN KEY (nearest_stop_id) REFERENCES Stop(stop_id)
);

-- 4. Route Table: The specific bus lines (e.g., R1, R10, Green Line)
CREATE TABLE Route (
    route_id INT AUTO_INCREMENT PRIMARY KEY,
    route_code VARCHAR(15) UNIQUE NOT NULL, -- e.g., R1, EV3
    start_point VARCHAR(100),
    end_point VARCHAR(100),
    category ENUM('Pink Bus', 'EV Bus', 'BRT')
);

-- 5. Route_Stop Junction: Sequence of stops and simulated times
CREATE TABLE Route_Stop (
    route_stop_id INT AUTO_INCREMENT PRIMARY KEY,
    route_id INT,
    stop_id INT,
    stop_sequence INT NOT NULL, -- 1, 2, 3...
    travel_time_from_prev_mins INT DEFAULT 5, -- Simulated travel time
    FOREIGN KEY (route_id) REFERENCES Route(route_id),
    FOREIGN KEY (stop_id) REFERENCES Stop(stop_id)
);

-- 6. Bus Table: Multiple buses can operate on one route
CREATE TABLE Bus (
    bus_id INT AUTO_INCREMENT PRIMARY KEY,
    bus_number VARCHAR(20) UNIQUE, -- e.g., BUS-001
    route_id INT,
    FOREIGN KEY (route_id) REFERENCES Route(route_id)
);

-- 7. Simulated_Status: Replaces GPS to show where a bus "is"
CREATE TABLE Simulated_Bus_Status (
    status_id INT AUTO_INCREMENT PRIMARY KEY,
    bus_id INT,
    current_stop_id INT,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (bus_id) REFERENCES Bus(bus_id),
    FOREIGN KEY (current_stop_id) REFERENCES Stop(stop_id)
);

INSERT INTO Admin (username, password_hash, role) 
VALUES ('admin1', 'habib27', 'System_Admin');

ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'proj123';
FLUSH PRIVILEGES;
