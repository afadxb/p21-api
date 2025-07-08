const express = require('express');
require('dotenv').config();

const app = express();
app.use(express.json());

// Routes
app.use('/inventory', require('./routes/inventory'));
app.use('/salesorders', require('./routes/salesorders'));
app.use('/pricing', require('./routes/pricing'));

// DEBUG fallback route (handles unmatched routes safely)
app.all('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    path: req.path
  });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`P21 API running on port ${PORT}`));
