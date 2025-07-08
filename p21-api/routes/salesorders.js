const express = require('express');
const router = express.Router();

// POST /salesorders
router.post('/', (req, res) => {
  res.json({ message: 'Sales order created (placeholder)' });
});

// GET /salesorders/:order_id
router.get('/:order_id', (req, res) => {
  res.json({ message: `Status of order ${req.params.order_id}` });
});

module.exports = router;
