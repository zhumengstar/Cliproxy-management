# Cliproxy-management

CLIProxyAPI management and usage analytics dashboard.

## Run

```bash
npm start
```

Open `http://localhost:4173`.

The local development build reuses the original `management-center` React code and opens the account pool route without requiring a management key on localhost. Account pool API calls fall back to fixtures under `mock-data/CLIProxyAPI/account-pool`.

## Test

```bash
npm test
```

The current statistics scope is still the four local mock source types under `mock-data/CLIProxyAPI`: structured usage JSONL, auth JSON files, `config.yaml`, and raw request logs. Account pool mock API files are kept as UI/reference fixtures for account pool workflows.

## Docs

- [Data sources and metrics](docs/data-sources-and-metrics.md)
- [Account pool reference](docs/account-pool-reference.md)
- [Management auth files API](docs/management-auth-files-api.md)
