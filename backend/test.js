const { findShortestPath } = require('./services/routingService');

async function test() {
    console.log("Testing Route: Malir to Saddar...");
    try {
        const result = await findShortestPath('Malir', 'Saddar');
        console.log(`Total Time: ${result.total_time} mins`);
        result.path.forEach(step => {
            console.log(`-> ${step.stop_name} (${step.route})`);
        });
    } catch (err) {
        console.error(err.message);
    }
}

test();
