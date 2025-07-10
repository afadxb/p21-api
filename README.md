# P21 API

This repository contains a minimal Express server exposing a handful of routes used by SRX/P21 integrations.

## Setup

1. Install Node.js 14+.

2. Copy `p21-api/.env.example` to `p21-api/.env` and update the SQL connection details. Environment variables will be loaded from this file automatically.

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

Returns JSON in the form:

```json
{
  "data": [ { "item_id": "ID", "item_desc": "Description" } ],
  "totalCount": 0,
  "page": 1,
  "totalPages": 1
}
```

Example:
```bash
curl "http://localhost:3000/inventory?limit=5&paging=true&page=2"
```

### `GET /inventory/{item_id}`
Returns a single item record with fields:
- `item_id`
- `inv_mast_uid`
- `item_desc`
- `delete_flag`
- `weight`
- `net_weight`
- `inactive`
- `default_sales_discount_group`
- `extended_desc`
- `keywords`
- `base_unit`
- `commodity_code`
- `length`
- `width`
- `height`

Example:
```bash
curl http://localhost:3000/inventory/ABC123
```

### `GET /pricing/{item_id}`
Returns pricing information for an item (placeholder). The response is:
```json
{ "message": "Pricing for item <item_id>" }
```

Example:
```bash
curl http://localhost:3000/pricing/ABC123
```

### `POST /orders`
Exports a sales order to CSV files. Required fields are `customer_id`,
`sales_location_id`, `srx_order_id` and an array of line items with `item_id`
and `qty`. Optional `notes` may be provided on the header or individual lines.
The response returns the generated file paths:

```json
{
  "message": "Order exported",
  "files": {
    "header": "<header.csv>",
    "line": "<line.csv>",
    "headerNotes": null,
    "lineNotes": null
  }
}
```

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
Retrieves the status of an existing order from P21. The `{order_id}` can be the
numeric `order_no` or the `order_ref` (formerly returned as `job_name`).
The response body has:

- `header` – object containing order fields such as `order_no`, `customer_id`,
  `order_date`, `ship2_name`, `po_no`, `status` and `order_ref`.
- `lines` – array of line objects with `order_no`, `line_no`, quantities and a
  computed `status` for each line.

The header field `order_ref` maps to the `job_name` column in P21.

```bash
# Lookup by order number
curl http://localhost:3000/orders/123456

# Lookup by order reference
curl http://localhost:3000/orders/REF-001
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


