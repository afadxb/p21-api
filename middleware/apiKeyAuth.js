const apiClients = require('../config/apiClients');

const routeAccessMap = apiClients.reduce((map, client) => {
  if (!Array.isArray(client.routes)) {
    return map;
  }

  client.routes.forEach((route) => {
    if (!map[route]) {
      map[route] = [];
    }
    map[route].push(client);
  });

  return map;
}, {});

function apiKeyAuth(routePath) {
  return function apiKeyAuthMiddleware(req, res, next) {
    const providedKey = req.header('x-api-key');

    if (!providedKey) {
      return res.status(401).json({ error: 'Missing API key' });
    }

    const allowedClients = routeAccessMap[routePath] || [];
    const client = allowedClients.find((allowedClient) => allowedClient.apiKey === providedKey);

    if (!client) {
      return res.status(403).json({ error: 'Invalid API key for this route' });
    }

    req.apiClient = { name: client.name };
    return next();
  };
}

module.exports = { apiKeyAuth };
