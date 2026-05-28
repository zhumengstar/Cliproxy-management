# Cliproxy-management

CLIProxyAPI management and usage analytics dashboard.

## Run

```bash
npm start
```

Open `http://localhost:4173`.

## Test

```bash
npm test
```

The current statistics view reads the four local mock source types under `mock-data/CLIProxyAPI`: structured usage JSONL, auth JSON files, `config.yaml`, and raw request logs. Account pool mock API files are kept as UI/reference fixtures for later account pool workflows.

## Docs

- [Data sources and metrics](docs/data-sources-and-metrics.md)
- [Account pool reference](docs/account-pool-reference.md)
- [Management auth files API](docs/management-auth-files-api.md)
