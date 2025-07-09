# P21 API

This repository contains a minimal Express server exposing a handful of routes used by SRX/P21 integrations.

## Setup

1. Install Node.js 14+.

2. Copy `p21-api/.env.example` to `p21-api/.env` and update the SQL connection details.

3. Install dependencies and start the API from the `p21-api` directory:
   ```bash
   cd p21-api
   npm install
   PORT=3000 npm start
   ```
   The port can be changed with the `PORT` environment variable.
   
4. Access the Swagger UI at `http://localhost:<PORT>/docs` for interactive API documentation.

## Routes

### `GET /inventory`
List inventory items. Supports optional query parameters:
- `limit` – number of results to return (default `100`)
- `page` – page number when `paging=true`
- `paging` – when `true`, enables SQL paging
- `order` – `asc` or `desc` (default `asc`)
- `inactive` – include inactive items (`true` or `false`)

Example:
```bash
curl "http://localhost:3000/inventory?limit=5&paging=true&page=2"
```

### `GET /inventory/{item_id}`
Returns a single item record.

Example:
```bash
curl http://localhost:3000/inventory/ABC123
```

### `GET /pricing/{item_id}`
Returns pricing information for an item (placeholder implementation).

Example:
```bash
curl http://localhost:3000/pricing/ABC123
```

### `POST /orders`
Exports a sales order to CSV files. Required fields are `customer_id`,
`sales_location_id`, `srx_order_id` and an array of line items with `item_id`
and `qty`. Optional `notes` may be provided on the header or individual lines.

Example payload:
```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "CUST1",
    "sales_location_id": "LOC1",
    "srx_order_id": "SO123",
    "notes": "Urgent",
    "lines": [
      { "item_id": "ABC123", "qty": 2 }
    ]
  }'
```

### `GET /orders/{order_id}`
Retrieves the status of an existing order from P21. The response includes header
information with a computed `status` field along with each line item and its
individual `status`.

```bash
curl http://localhost:3000/orders/123456
```

## Standalone `server.js`
A simple `server.js` is provided in the `p21-api/` directory that mounts the `orders` route under `/api`. It is mainly for quick testing:

```bash
node p21-api/server.js
# or
PORT=4000 node p21-api/server.js
```

Access it at `http://localhost:<PORT>/api`.

## Docker Compose Example

An example `docker-compose.yml` is included for running Kong, Mongo, and the API
services together. The `p21-api` service reads its environment variables from
`p21-api/.env`:

```yaml
  p21-api:
    build:
      context: ./p21-api
    env_file:
      - ./p21-api/.env
```

Create `p21-api/.env` before starting Compose:

```bash
docker compose up -d
```


