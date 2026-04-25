const express = require('express');
const router = express.Router();
const { findShortestPath } = require('../services/routingService');

router.get('/find-route', async (req, res) => {
    const { origin, destination } = req.query;
    try {
        const result = await findShortestPath(origin, destination);
        res.json(result);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

module.exports = router;
