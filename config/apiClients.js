/**
 * List of API clients and the routes they are allowed to access.
 *
 * NOTE: Real API keys should be stored in environment variables or a secrets
 * manager. The values below are only defaults to demonstrate how the
 * configuration works. Each entry can override the default via the matching
 * environment variable, e.g. API_KEY_SRX.
 */

const apiClients = [
  {
    name: 'SRX',
    apiKey: process.env.API_KEY_SRX || 's2bJT4Up6JeFou5jVVj8xcHgrWVhBOsW',
    routes: ['/v1/sales/order']
  },
  {
    name: 'Medius',
    apiKey: process.env.API_KEY_MEDIUS || 'XXXX',
    routes: ['/v1/ap/purchaseorders', '/v1/ap/suppliers', '/v1/ap/paymentterms']
  }
];

module.exports = apiClients;
