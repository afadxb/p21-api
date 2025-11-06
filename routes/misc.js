const express = require('express');
const router = express.Router();

router.post('/order-status', (req, res) => {
  res.json({ message: 'Order Status endpoint received', data: req.body });
});

router.post('/sku-pricing', (req, res) => {
  res.json({ message: 'SKU Pricing endpoint received', data: req.body });
});

router.post('/consignment-billing', (req, res) => {
  res.json({ message: 'Consignment Billing endpoint received', data: req.body });
});

router.post('/consignment-transfer', (req, res) => {
  res.json({ message: 'Consignment Transfer endpoint received', data: req.body });
});

module.exports = router;
