-- INSERT STOPS (Physical locations found on the map)
INSERT INTO Stop (stop_name) VALUES 
('Khokhrapar'), ('Saudabad Chowrangi'), ('Malir Halt'), ('Kalaboard'), ('Quaidabad'), 
('Numaish'), ('Tower'), ('Dockyard'), ('Nasir Jump'), ('Ibrahim Hyderi'),
('Power House'), ('Nagan Chowrangi'), ('Sohrab Goth'), ('Indus Hospital'),
('Malir Cantt'), ('Airport'), ('NIPA'), ('Millennium Mall'), ('Karsaz');

-- INSERT AREAS (For the user location input logic)
INSERT INTO Area (area_name, nearest_stop_id) VALUES 
('Malir', 3), ('Saddar', 6), ('Gulshan', 17), ('Johar', 18), ('Korangi', 14);

-- INSERT ROUTES
INSERT INTO Route (route_code, start_point, end_point, category) VALUES 
('R1', 'Khokhrapar', 'Dockyard', 'Pink Bus'),       -- [cite: 115]
('R10', 'Numaish', 'Ibrahim Hyderi', 'Pink Bus'),  -- [cite: 124]
('EV3', 'Malir Cantt', 'Numaish', 'EV Bus'),       -- 
('Green Line', 'Power House', 'Tower', 'BRT');     -- [cite: 137]

-- MAPPING STOPS TO ROUTES (Sequence and simulated times)

-- Route R1 (Sample Sequence)
INSERT INTO Route_Stop (route_id, stop_id, stop_sequence, travel_time_from_prev_mins) VALUES 
(1, 1, 1, 0),  -- Khokhrapar
(1, 2, 2, 8),  -- Saudabad
(1, 3, 3, 5),  -- Malir Halt
(1, 6, 4, 25), -- Numaish (Major Transfer Point)
(1, 7, 5, 15), -- Tower
(1, 8, 6, 10); -- Dockyard

-- Route R10 (Sample Sequence)
INSERT INTO Route_Stop (route_id, stop_id, stop_sequence, travel_time_from_prev_mins) VALUES 
(2, 6, 1, 0),  -- Numaish
(2, 14, 2, 20),-- Indus Hospital
(2, 9, 3, 10), -- Nasir Jump
(2, 10, 4, 5); -- Ibrahim Hyderi

-- Route EV3 (Sample Sequence)
INSERT INTO Route_Stop (route_id, stop_id, stop_sequence, travel_time_from_prev_mins) VALUES 
(3, 15, 1, 0), -- Malir Cantt
(3, 16, 2, 10),-- Airport
(3, 3, 3, 8),  -- Malir Halt
(3, 19, 4, 15),-- Karsaz
(3, 6, 5, 12); -- Numaish

-- INSERT BUSES (Multiple buses per route)
INSERT INTO Bus (bus_number, route_id) VALUES 
('KHI-RD-101', 1), ('KHI-RD-102', 1), -- Two buses on R1
('KHI-EV-301', 3), ('KHI-EV-302', 3); -- Two buses on EV3

-- SIMULATED LIVE STATUS (Bus 101 is at Malir Halt)
INSERT INTO Simulated_Bus_Status (bus_id, current_stop_id) VALUES (1, 3);
