# P21 API

This repository contains a minimal Express server exposing a handful of routes used by SRX/P21 integrations.

## Setup

1. Install Node.js 14+.

2. Copy `.env.example` to `.env` and update the SQL connection details. Environment variables will be loaded from this file automatically.

3. Install dependencies and start the API from the repository root:
   ```bash
   npm install
   PORT=3000 npm start
   ```
   The port can be changed with the `PORT` environment variable.
   
4. Access the Swagger UI at `http://localhost:<PORT>/docs` for interactive API documentation.

## Authentication

Certain routes (starting with `/v1/sales/order`) now require an API key. Clients
must send the key in the `x-api-key` request header. Keys and their permitted
routes are defined in `config/apiClients.js`. The sample configuration grants
the client named `SRX` access to `POST /v1/sales/order` using the key
`s2bJT4Up6JeFou5jVVj8xcHgrWVhBOsW` and the client named `Medius` access to the
`/v1/ap/purchaseorders`, `/v1/ap/suppliers`, and `/v1/ap/paymentterms` endpoints
using the key `XXXX`. Override these sample keys in production by setting the
corresponding environment variables (for example `API_KEY_SRX` or
`API_KEY_MEDIUS`).

### TMP_OE export job

When the Express server starts it also launches a background job that scans the
`TMP_OE_Header` and `TMP_OE_Line` staging tables every 30 minutes. Any import
sets whose `TMP_OE_Header.Exported` flag is not `Y` are written to the
`exports/` directory as fixed-width text files named
`SOH<Import_Set_No>.txt` for header records and `SOL<Import_Set_No>.txt` for line
records. After the files are written, the job sets the `Exported` flag to `Y` so
they are not exported again.

Use the following optional environment variables to customise the job:

- `TMP_OE_EXPORT_INTERVAL_MINUTES` – override the 30 minute cadence.
- `TMP_OE_EXPORT_DIR` – change the output directory (default `exports`).

### Swagger/OpenAPI URL

When running locally with the default port, open `http://localhost:3000/docs` in your browser to view the interactive documentation. This UI is generated from the repository's `openapi.yaml` specification file.

## Routes

### `GET /v1/inventory/items`
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
curl "http://localhost:3000/v1/inventory/items?limit=5&paging=true&page=2"
```

### `GET /v1/inventory/items/{item_id}`
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
curl http://localhost:3000/v1/inventory/items/ABC123
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

### `POST /v1/sales/order`
Creates one or more sales orders by inserting into the `TMP_SRX_Header` and
`TMP_SRX_Line` staging tables. The API calculates the next `Import_Set_No`
based on the most recent header value and applies it to both the header and all
line rows inside a single SQL Server transaction.

The request body can either provide a single `{ "header": { ... }, "lines": [] }`
object or an object with an `orders` array containing multiple entries. Header
objects must include `customerId`, `companyId`, `salesLocationId`, `approved`,
`shipToId`, and `contractNumber`. Each line must include `itemId`,
`unitQuantity`, and `unitOfMeasure`. Line numbers are automatically assigned in
the order the lines appear in the payload.

Example payload for multiple orders:

```bash
curl -X POST http://localhost:3000/v1/sales/order \
  -H "Content-Type: application/json" \
  -d '{
    "orders": [
      {
        "header": {
          "customerId": "10001",
          "companyId": "COMP001",
          "salesLocationId": "200",
          "approved": "Y",
          "shipToId": "50001",
          "contractNumber": "CN-2024-0001"
        },
        "lines": [
          {
            "itemId": "MAT-00045",
            "unitQuantity": "10",
            "unitOfMeasure": "EA"
          }
        ]
      }
    ]
  }'
```

On success the service responds with HTTP `201` and returns the generated import
set number for each order along with the number of line rows inserted:

```json
{
  "message": "Sales orders saved",
  "orders": [
    { "importSetNo": "15", "linesInserted": 1 }
  ]
}
```

### `POST /v1/sales/order`
Creates one or more sales orders by inserting into the `TMP_SRX_Header` and
`TMP_SRX_Line` staging tables. The API calculates the next `Import_Set_No`
based on the most recent header value and applies it to both the header and all
line rows inside a single SQL Server transaction.

The request body can either provide a single `{ "header": { ... }, "lines": [] }`
object or an object with an `orders` array containing multiple entries. Header
objects must include `customerId`, `companyId`, `salesLocationId`, `approved`,
`shipToId`, and `contractNumber`. Each line must include `itemId`,
`unitQuantity`, and `unitOfMeasure`. Line numbers are automatically assigned in
the order the lines appear in the payload.

Example payload for multiple orders:

```bash
curl -X POST http://localhost:3000/v1/sales/order \
  -H "Content-Type: application/json" \
  -d '{
    "orders": [
      {
        "header": {
          "customerId": "10001",
          "companyId": "COMP001",
          "salesLocationId": "200",
          "approved": "Y",
          "shipToId": "50001",
          "contractNumber": "CN-2024-0001"
        },
        "lines": [
          {
            "itemId": "MAT-00045",
            "unitQuantity": "10",
            "unitOfMeasure": "EA"
          }
        ]
      }
    ]
  }'
```

On success the service responds with HTTP `201` and returns the generated import
set number for each order along with the number of line rows inserted:

```json
{
  "message": "Sales orders saved",
  "orders": [
    { "importSetNo": "15", "linesInserted": 1 }
  ]
}
```

## Standalone `server.js`
A simple `server.js` is provided in the repository root that mounts the Express routes for quick testing:

```bash
node server.js
# or
PORT=4000 node server.js
```

Access it at `http://localhost:<PORT>`.

## Docker Compose Example

An example `docker-compose.yml` is included for running Kong, Mongo, and the API
services together. The `p21-api` service reads its environment variables from
`.env`:

```yaml
  p21-api:
    build:
      context: .
    env_file:
      - ./.env
```

Create `.env` before starting Compose:

```bash
docker compose up -d
```


