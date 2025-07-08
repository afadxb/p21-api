const express = require('express');
const router = express.Router();

router.get('/:item_id', (req, res) => {
  res.json({ message: `Pricing for item ${req.params.item_id}` });
});

module.exports = router;
