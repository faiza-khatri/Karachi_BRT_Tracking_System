const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'yourpassword',
    database: 'KarachiRedBusDB'
};

async function findShortestPath(originArea, destArea) {
    const connection = await mysql.createConnection(dbConfig);

    try {
        // 1. Resolve Areas to Stop IDs
        const [areas] = await connection.execute(
            'SELECT area_name, nearest_stop_id FROM Area WHERE area_name IN (?, ?)',
            [originArea, destArea]
        );

        if (areas.length < 2) throw new Error("One or both areas not found.");

        const startNode = areas.find(a => a.area_name === originArea).nearest_stop_id;
        const endNode = areas.find(a => a.area_name === destArea).nearest_stop_id;

        // 2. Fetch all route segments to build the graph
        const [segments] = await connection.execute(`
            SELECT rs1.stop_id AS start_stop, rs2.stop_id AS end_stop, 
                   rs2.travel_time_from_prev_mins AS time, r.route_code
            FROM Route_Stop rs1
            JOIN Route_Stop rs2 ON rs1.route_id = rs2.route_id 
                AND rs2.stop_sequence = rs1.stop_sequence + 1
            JOIN Route r ON rs1.route_id = r.route_id
        `);

        // 3. Dijkstra's Algorithm
        let times = {};
        let backtrace = {};
        let pq = [{ node: startNode, time: 0, route: null }];

        times[startNode] = 0;

        while (pq.length > 0) {
            pq.sort((a, b) => a.time - b.time);
            let { node: currentNode, time: currentTime, route: lastRoute } = pq.shift();

            if (currentNode === endNode) break;

            const neighbors = segments.filter(s => s.start_stop === currentNode);

            for (let neighbor of neighbors) {
                // Penalty for switching buses (e.g., 5 mins)
                let transferPenalty = (lastRoute && lastRoute !== neighbor.route_code) ? 5 : 0;
                let newTime = currentTime + neighbor.time + transferPenalty;

                if (!times[neighbor.end_stop] || newTime < times[neighbor.end_stop]) {
                    times[neighbor.end_stop] = newTime;
                    backtrace[neighbor.end_stop] = { from: currentNode, route: neighbor.route_code };
                    pq.push({ node: neighbor.end_stop, time: newTime, route: neighbor.route_code });
                }
            }
        }

        // 4. Reconstruct Path
        let path = [];
        let curr = endNode;
        while (curr !== startNode) {
            const step = backtrace[curr];
            const [stopInfo] = await connection.execute('SELECT stop_name FROM Stop WHERE stop_id = ?', [curr]);
            path.unshift({ stop_name: stopInfo[0].stop_name, route: step.route });
            curr = step.from;
        }
        
        const [startStopInfo] = await connection.execute('SELECT stop_name FROM Stop WHERE stop_id = ?', [startNode]);
        path.unshift({ stop_name: startStopInfo[0].stop_name, route: "Starting Point" });

        return { total_time: times[endNode], path };

    } finally {
        await connection.end();
    }
}

module.exports = { findShortestPath };
