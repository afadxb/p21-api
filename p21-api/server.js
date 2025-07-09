const express = require('express');
require('dotenv').config();
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const app = express();
app.use(express.json());

const swaggerDocument = YAML.load(path.join(__dirname, 'openapi.yaml'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Routes
app.use('/inventory', require('./routes/inventory'));
app.use('/pricing', require('./routes/pricing'));
// Swap the route mounts so `/salesorders` handles exporting orders and
// `/orders` retrieves existing P21 order information
app.use('/salesorders', require('./routes/orders'));
app.use('/orders', require('./routes/salesorders'));

// DEBUG fallback route (handles unmatched routes safely)
app.all('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    path: req.path
  });
});

// Allow the port to be configured via the environment for flexibility
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`P21 API running on port ${PORT}`));
