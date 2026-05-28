# Data Sources and Metrics

This project uses `usage-records-*.jsonl` as the primary statistics source. Auth files and config files provide account and routing context. Raw request logs are reserved for troubleshooting and audit drill-downs.

The account pool materials in [Account pool reference](account-pool-reference.md) are only future implementation references. They are not statistics data sources for the current project.

## Data Sources

### 1. Structured Usage Logs

- Path: `/opt/CLIProxyAPI/logs/usage-records-*.jsonl`
- Format: JSONL, one request record per line.
- Role: primary fact source for usage, latency, failures, status codes, providers, models, caller API keys, and token details.

Key fields:

| Field | Meaning |
| --- | --- |
| `timestamp` | Request timestamp |
| `provider` | Account source, such as `codex`, `claude`, `gemini` |
| `model` | Actual model used |
| `alias` | Requested model name |
| `endpoint` | API endpoint |
| `auth_type` | Auth method |
| `email` | Account email |
| `auth_id` | Auth file or account identifier |
| `auth_index` | Account index or slot |
| `api_key` | Caller API key |
| `request_id` | Request ID |
| `source` | Request source |
| `reasoning_effort` | Reasoning effort |
| `latency_ms` | Request latency in milliseconds |
| `tokens.*` | Token usage details |
| `failed` | Whether the request failed |
| `fail.status_code` | Response status code |
| `fail.body` | Failure body or empty text |
| `response_headers` | Response headers |

Token fields:

| Field | Meaning |
| --- | --- |
| `input_tokens` | Input tokens |
| `output_tokens` | Output tokens |
| `reasoning_tokens` | Reasoning tokens |
| `cached_tokens` | Cached tokens |
| `cache_read_tokens` | Cache read tokens |
| `cache_creation_tokens` | Cache creation tokens |
| `total_tokens` | Total tokens |

### 2. Auth Files

- Path: `/opt/CLIProxyAPI/auths/*.json`
- Format: JSON, one account per file.
- Role: account inventory, token health, expiration monitoring, provider grouping.

Key fields:

| Field | Meaning |
| --- | --- |
| `email` | Account email |
| `type` | Provider type, such as `codex`, `claude`, `gemini` |
| `account_id` | Codex account ID |
| `expired` | Codex expiration time |
| `expire` | Claude expiration time |
| `last_refresh` | Last token refresh time |
| `project_id` | Gemini project ID |
| `access_token` | Token existence check only, do not display |
| `token.access_token` | Gemini token existence check only, do not display |
| `token.expiry` | Gemini token expiration time |

### 3. Config File

- Path: `/opt/CLIProxyAPI/config.yaml`
- Format: YAML.
- Role: runtime configuration, API key inventory, feature flags, external provider routes.

Key fields:

| Field | Meaning |
| --- | --- |
| `host` | Bind host |
| `port` | Bind port |
| `auth-dir` | Auth file directory |
| `api-keys` | Caller API keys |
| `usage-statistics-enabled` | Whether structured usage statistics are enabled |
| `request-log` | Whether raw request logging is enabled |
| `logging-to-file` | Whether file logging is enabled |
| `remote-management.allow-remote` | Whether remote management is enabled |
| `remote-management.disable-control-panel` | Whether the control panel is disabled |
| `openai-compat` | OpenAI-compatible upstream providers |
| `claude-api-key` | Direct Claude API key providers |
| `gemini-api-key` | Direct Gemini API key providers |

Sensitive fields such as `secret-key`, upstream `api-key`, and caller API keys should be masked in the UI and logs.

### 4. Raw Request Logs

- Path: `/opt/CLIProxyAPI/logs/*.log`
- Format: segmented text logs.
- Role: troubleshooting, request/response inspection, audit drill-down.
- Suggested usage: link from a request detail page when `request_id`, timestamp, endpoint, or generated filename can be matched.

Useful fields:

| Field | Meaning |
| --- | --- |
| `URL` | Request URL |
| `Method` | HTTP method |
| `Timestamp` | Request timestamp |
| `HEADERS` | Request headers, with sensitive values masked |
| `REQUEST BODY.model` | Requested model |
| `REQUEST BODY.messages` | User message payload, sensitive content |
| `API RESPONSE.usage` | Upstream token usage |
| `RESPONSE.Status` | Response status |
| `error-*.log` | Failure log indicator |

Raw logs are not the main statistics source because they may contain sensitive prompts and are harder to parse reliably.

## Statistics Data Model

### UsageRecord

One row per request, derived from `usage-records-*.jsonl`.

| Field | Type | Source |
| --- | --- | --- |
| `id` | string | `request_id` or generated ID |
| `timestamp` | datetime | `timestamp` |
| `date` | date | derived from `timestamp` |
| `hour` | datetime | derived from `timestamp` |
| `provider` | string | `provider` |
| `model` | string | `model` |
| `alias` | string | `alias` |
| `endpoint` | string | `endpoint` |
| `auth_type` | string | `auth_type` |
| `email` | string | `email` |
| `auth_id` | string | `auth_id` |
| `auth_index` | string | `auth_index` |
| `api_key` | string | `api_key`, masked for display |
| `source` | string | `source` |
| `reasoning_effort` | string | `reasoning_effort` |
| `latency_ms` | number | `latency_ms` |
| `status_code` | number | `fail.status_code` |
| `failed` | boolean | `failed` |
| `fail_body` | string | `fail.body`, optional and masked/truncated |
| `input_tokens` | number | `tokens.input_tokens` |
| `output_tokens` | number | `tokens.output_tokens` |
| `reasoning_tokens` | number | `tokens.reasoning_tokens` |
| `cached_tokens` | number | `tokens.cached_tokens` |
| `cache_read_tokens` | number | `tokens.cache_read_tokens` |
| `cache_creation_tokens` | number | `tokens.cache_creation_tokens` |
| `total_tokens` | number | `tokens.total_tokens` |

Recommended indexes:

| Index | Purpose |
| --- | --- |
| `timestamp` | Time-range filtering |
| `provider, model` | Provider/model analytics |
| `email` | Account analytics |
| `api_key` | Caller analytics |
| `failed, status_code` | Error analytics |
| `request_id` | Detail lookup |

### AccountRecord

One row per auth file, derived from `/opt/CLIProxyAPI/auths/*.json`.

| Field | Type | Source |
| --- | --- | --- |
| `id` | string | file name or account ID |
| `file_name` | string | auth file path |
| `provider` | string | `type` |
| `email` | string | `email` |
| `account_id` | string | `account_id` |
| `project_id` | string | `project_id` |
| `last_refresh` | datetime | `last_refresh` |
| `expires_at` | datetime | `expired`, `expire`, or `token.expiry` |
| `has_access_token` | boolean | token existence |
| `has_refresh_token` | boolean | token existence |
| `is_expired` | boolean | derived from `expires_at` |
| `expires_in_seconds` | number | derived from `expires_at` |

Sensitive token values should never be stored in analytics tables or returned to the frontend.

### ConfigSnapshot

One snapshot per config read, derived from `/opt/CLIProxyAPI/config.yaml`.

| Field | Type | Source |
| --- | --- | --- |
| `captured_at` | datetime | read time |
| `host` | string | `host` |
| `port` | number | `port` |
| `auth_dir` | string | `auth-dir` |
| `api_key_count` | number | `api-keys.length` |
| `api_keys` | string[] | `api-keys`, masked |
| `usage_statistics_enabled` | boolean | `usage-statistics-enabled` |
| `request_log_enabled` | boolean | `request-log` |
| `logging_to_file` | boolean | `logging-to-file` |
| `remote_management_enabled` | boolean | `remote-management.allow-remote` |
| `control_panel_disabled` | boolean | `remote-management.disable-control-panel` |
| `openai_compat_sources` | object[] | `openai-compat`, with API keys masked |
| `claude_api_key_count` | number | `claude-api-key.length` |
| `gemini_api_key_count` | number | `gemini-api-key.length` |

### RequestLogRecord

Optional troubleshooting record, derived from `/opt/CLIProxyAPI/logs/*.log`.

| Field | Type | Source |
| --- | --- | --- |
| `file_name` | string | log file name |
| `is_error_log` | boolean | `error-*.log` |
| `timestamp` | datetime | `REQUEST INFO.Timestamp` |
| `url` | string | `REQUEST INFO.URL` |
| `method` | string | `REQUEST INFO.Method` |
| `status_code` | number | `RESPONSE.Status` |
| `model` | string | `REQUEST BODY.model` |
| `api_usage` | object | `API RESPONSE.usage` |
| `response_usage` | object | `RESPONSE.usage` |

Request bodies, messages, headers, and full responses should only be available in restricted debugging views.

## Core Metrics

### Traffic

| Metric | Formula |
| --- | --- |
| Total requests | count of `UsageRecord` |
| Successful requests | count where `failed = false` |
| Failed requests | count where `failed = true` |
| Failure rate | failed requests / total requests |
| Requests by time | group by minute, hour, or day |
| Requests by endpoint | group by `endpoint` |

### Tokens

| Metric | Formula |
| --- | --- |
| Total tokens | sum `total_tokens` |
| Input tokens | sum `input_tokens` |
| Output tokens | sum `output_tokens` |
| Reasoning tokens | sum `reasoning_tokens` |
| Cached tokens | sum `cached_tokens` |
| Cache read tokens | sum `cache_read_tokens` |
| Cache creation tokens | sum `cache_creation_tokens` |
| Average tokens per request | total tokens / total requests |

### Latency

| Metric | Formula |
| --- | --- |
| Average latency | avg `latency_ms` |
| P50 latency | percentile 50 of `latency_ms` |
| P95 latency | percentile 95 of `latency_ms` |
| P99 latency | percentile 99 of `latency_ms` |
| Slow requests | records above configured threshold |

### Dimensions

All traffic, token, latency, and failure metrics should support grouping by:

- `provider`
- `model`
- `alias`
- `email`
- `api_key`
- `endpoint`
- `auth_type`
- `reasoning_effort`
- `status_code`
- time bucket

## Dashboard Views

Recommended first version:

| View | Content |
| --- | --- |
| Overview | total requests, total tokens, failure rate, latency P95, requests over time |
| Providers and models | usage by provider/model/alias |
| Accounts | account usage, token expiration, last refresh, failure count |
| API keys | caller API key usage, tokens, failures, latency |
| Errors | failed requests by status code, provider, model, account, recent failed requests |
| Request details | single request usage record plus optional raw log link |
| Configuration | sanitized config status and provider route inventory |

## Privacy and Masking

The following values must be masked by default:

- caller API keys
- upstream API keys
- access tokens
- refresh tokens
- remote management secret key
- request headers
- request bodies and messages
- failure bodies and raw responses when they may contain user content

Suggested display rule for keys and tokens: keep the first 4-6 characters and last 4 characters, replace the middle with `***`.
