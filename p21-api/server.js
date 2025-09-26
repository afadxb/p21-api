const express = require('express');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const app = express();
app.use(express.json());

const swaggerDocument = YAML.load(path.join(__dirname, 'openapi.yaml'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Routes
app.use('/inventory', require('./routes/inventory'));
app.use('/pricing', require('./routes/pricing'));
// Unified orders route handles both creation (CSV export) and status lookup
app.use('/orders', require('./routes/orders'));
app.use('/v1/ap/suppliers', require('./routes/v1/ap/suppliers'));
app.use('/v1/ap/paymentterms', require('./routes/v1/ap/paymentterms'));

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
