const express = require('express');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.use(express.json());

// Routes
app.use('/v1/inventory/items', require('./routes/v1/inventory/items'));
app.use('/v1/ap/suppliers', require('./routes/v1/ap/suppliers'));
app.use('/v1/ap/paymentterms', require('./routes/v1/ap/paymentterms'));
app.use('/v1/ap/purchaseorders', require('./routes/v1/ap/purchaseorders'));
app.use('/v1/ap/purchaseorder', require('./routes/v1/ap/purchaseorder'));
app.use('/v1/ap/paymentdetail', require('./routes/v1/ap/paymentdetail'));
app.use('/v1/ap/receipts', require('./routes/v1/ap/receipts'));
app.use('/v1/ap/voucher', require('./routes/v1/ap/voucher'));
app.use('/v1/sales/order', require('./routes/v1/sales/order'));
app.use('/v1/system/exch_rates', require('./routes/v1/system/exch_rates'));
app.use('/v1/system/periods', require('./routes/v1/system/periods'));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime()
  });
});

// Swagger docs — mounted after API routes so the '/' catch-all doesn't shadow them
const swaggerDocument = YAML.load(path.join(__dirname, 'openapi.yaml'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use('/', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Background jobs
const { startExportJob, stopExportJob } = require('./jobs/exportTmpOrders');
startExportJob().catch((err) => {
  logger.error({ err }, 'Failed to start TMP_OE export job');
});
const { startPurchaseOrderExportJob, stopPurchaseOrderExportJob } = require('./jobs/exportTmpPurchaseOrders');
startPurchaseOrderExportJob().catch((err) => {
  logger.error({ err }, 'Failed to start TMP_PO export job');
});

// 404 handler
app.all('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    path: req.path
  });
});

// Central error handler (must be registered after all routes)
app.use(errorHandler);

// Allow the port to be configured via the environment for flexibility
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => logger.info({ port: PORT }, 'P21 API running'));

// Graceful shutdown
function shutdown(signal) {
  logger.info({ signal }, 'Shutdown signal received, closing gracefully');
  stopExportJob();
  stopPurchaseOrderExportJob();
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  // Force exit after 10s if connections don't close
  setTimeout(() => {
    logger.warn('Forcing shutdown after timeout');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
