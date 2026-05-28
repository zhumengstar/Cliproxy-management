# Account Pool Reference

This document summarizes the account pool behavior from:

- `C:\Users\13784\Desktop\git\Cliproxy\deliverables\账号池功能复现方案.docx`
- `C:\Users\13784\Desktop\git\Cliproxy\deliverables\账号池源码-704f8378.zip`

This is reference material only. The current Cliproxy-management statistics scope must only read the four previously defined sources:

- `/opt/CLIProxyAPI/logs/usage-records-*.jsonl`
- `/opt/CLIProxyAPI/auths/*.json`
- `/opt/CLIProxyAPI/config.yaml`
- `/opt/CLIProxyAPI/logs/*.log`

Do not treat account pool APIs, Supabase/Postgres account pool tables, localStorage caches, or account pool usage summaries as statistics data sources in the current project.

## Core Principles

- Supabase/Postgres is the source of truth.
- `localStorage` is only a short-lived frontend cache with a 3 minute TTL.
- Account files are grouped by folder. The default view should be folder mode.
- Folder sorting defaults to newest import time first.
- Check results must be bound to `content_hash` so old check states do not contaminate changed account files.
- Usage statistics are append-only records. Summaries are acceleration data, not the only fact source.
- Deleting invalid or no-quota accounts is a physical delete of selected account pool entries, not a disable operation.
- Sensitive values such as access tokens, refresh tokens, upstream API keys, and caller API keys must be masked.

## Frontend Surface

Recommended first implementation:

| Area | Behavior |
| --- | --- |
| Top status | Show unchecked count and current scoped account count. Refresh remote data on page entry. |
| View switch | List mode and folder mode. Default to folder mode. |
| Import | Support JSON, zip, tar, tar.gz, tgz, gz. Folder upload keeps the top-level folder. |
| Batch actions | Check selected, check current filtered scope, check all, download selected/scope. |
| Write auth files | Append or overwrite formal auth files. Deduplicate by `content_hash`. |
| Delete | Delete selected, delete no-quota, delete invalid. Clear matching local cache/check state. |
| Filters | Search, source, plan, status, quota, sort, pagination. Default page size 100. |

## API Contract

The source registers these management endpoints:

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/account-pool` | GET | Compatibility list endpoint |
| `/account-pool/list?include_hash=true` | GET | List account pool entries and folder summaries |
| `/account-pool` | POST | Compatibility upload endpoint |
| `/account-pool/upload` | POST | Upload JSON/archive/folder bundle |
| `/account-pool/import/:id` | GET | Poll async import progress |
| `/account-pool/repair` | POST | Repair historical data |
| `/account-pool/write-auth-files` | POST | Write selected/scope entries to formal auth files |
| `/account-pool/folder` | PATCH | Update folder source metadata |
| `/account-pool/check-results` | PATCH | Save check results with `content_hash` |
| `/account-pool/download` | GET | Download full account pool archive |
| `/account-pool/download` | POST | Download selected account pool archive |
| `/account-pool/download-entry?name=` | GET | Download a single account JSON |
| `/account-pool` | DELETE | Compatibility delete endpoint |
| `/account-pool/delete` | DELETE | Delete selected entries |
| `/account-pool/usage-records` | GET | Query usage records, summaries, totals |
| `/account-pool/usage-records` | DELETE | Clear usage records. Should be restricted. |

## Data Structures

### AccountPoolEntry

Derived from the backend list response and frontend `AuthFileItem`.

| Field | Meaning |
| --- | --- |
| `name` | Entry name, usually `folder/file.json`. Cards should display `basename(name)`. |
| `type` | Auth file type, such as `codex`, `claude`, `gemini`. |
| `provider` | Provider fallback when `type` is absent. |
| `email` | Service account email. |
| `folder` | Folder name. Empty values become the default folder. |
| `size` | Stored JSON size in bytes. |
| `content_hash` | Normalized JSON hash. Used for dedupe and check binding. |
| `check_result` | Serialized check result or normalized check fields. |
| `check_content_hash` | Hash that the check result belongs to. |
| `check_updated_at` | Check update time. |
| `account_cost` | User-entered account cost. |
| `source_channel` | Import/source channel. |
| `account_started_at` | Account active start time. |
| `account_stopped_at` | Account stopped time. |
| `account_lifetime_seconds` | Persisted lifetime duration. |
| `usage_*` | Aggregated usage snapshot attached by list endpoint. |

### AccountPoolFolder

Returned in `AuthFilesResponse.folders`.

| Field | Meaning |
| --- | --- |
| `folder` | Folder name. |
| `source_model` | Source model or channel. |
| `source_info` | Import batch notes or source notes. |
| `count` | Number of entries in the folder. |
| `requests` | Aggregated request count. |
| `total_tokens` | Aggregated token count. |
| `total_usd` | Aggregated USD usage. |
| `created_at` | First import time. |
| `updated_at` | Last update time. |

Folder cards should show import time, account count, total tokens, requests, total USD, cost per dollar, and unchecked count.

### AccountPoolUsageRecord

The source implementation uses this shape for account pool usage records:

| Field | Meaning |
| --- | --- |
| `id` | Usage record ID. |
| `requested_at` | Request time. |
| `request_id` | Upstream/request ID. |
| `request_path` | API route. |
| `session_id` | Session ID. |
| `newapi_user_id` | New API user ID from headers/metadata. |
| `username` | Username parsed from headers/metadata. |
| `provider` | Provider. |
| `model` | Actual model. |
| `alias` | Requested model alias. |
| `service_email` | Account email. |
| `auth_id` | Auth identifier/file. |
| `auth_index` | Auth slot/index. |
| `auth_type` | Auth method. |
| `success` | Whether request succeeded. |
| `status_code` | HTTP status code. |
| `latency_ms` | Latency in milliseconds. |
| `input_tokens` | Input tokens. |
| `output_tokens` | Output tokens. |
| `cached_tokens` | Cached tokens. |
| `cache_read_tokens` | Cache read tokens. |
| `cache_creation_tokens` | Cache creation tokens. |
| `total_tokens` | Total tokens. |
| `request_params` | Serialized request parameters. |

### AccountPoolUsageSummary

| Field | Meaning |
| --- | --- |
| `key` | Summary key, usually derived from email/auth ID/auth index. |
| `service_email` | Account email. |
| `auth_id` | Auth identifier/file. |
| `auth_index` | Auth slot/index. |
| `auth_type` | Auth method. |
| `provider` | Provider. |
| `model` | Model. |
| `alias` | Alias. |
| `requests` | Request count. |
| `successes` | Success count. |
| `failures` | Failure count. |
| `input_tokens` | Input tokens. |
| `output_tokens` | Output tokens. |
| `cached_tokens` | Cached tokens. |
| `cache_read_tokens` | Cache read tokens. |
| `cache_creation_tokens` | Cache creation tokens. |
| `total_tokens` | Total tokens. |
| `total_usd` | Estimated USD cost. |
| `last_used_at` | Last request time. |

## Storage Model

The source supports business tables, with SQLite and Postgres variants. For this management project, model the data around these entities:

| Table | Key fields |
| --- | --- |
| `account_pool_entries` | `name`, `content_hash`, `type`, `provider`, `email`, `folder`, `size`, `data`, `created_at`, `updated_at`, `check_result`, `check_content_hash`, `check_updated_at`, `account_started_at`, `account_stopped_at`, `account_lifetime_seconds`, `account_lifetime_active_since` |
| `account_pool_folders` | `folder`, `source_model`, `source_info`, `created_at`, `updated_at` |
| `account_pool_usage_records` | append-only usage records keyed by `id` |
| `account_pool_usage_summaries` | aggregate rows keyed by `key` |

Fast compatibility can also use KV-like prefixes:

| Prefix | Meaning |
| --- | --- |
| `.account-pool/{folder}/{file}.json` | Account pool entry |
| `.account-pool-meta/folders/{folder}.json` | Folder metadata |
| `.account-pool-meta/checks/{name}.json` | Check result |
| `.account-pool-usage/records/{id}.json` | Usage record |
| `.account-pool-usage/summaries/{key}.json` | Usage summary |

## Import Flow

1. Frontend reads `FileList`.
2. If `webkitRelativePath` exists, group files by top-level folder and upload a bundled archive.
3. Validate single JSON files with `JSON.parse` before upload.
4. Backend accepts JSON/archive uploads and only stores `.json` entries.
5. Backend normalizes names, rejects unsafe paths, computes `content_hash`, extracts type/provider/email/folder, and stores entries.
6. Large imports create an async job with `pending`, `running`, `done`, or `failed` state.

## Check Flow

1. Load account base info from list response or short-lived cache.
2. Download full JSON only when needed or when `content_hash` changed.
3. Select check logic by `type`/`provider`.
4. Refresh token or construct provider request.
5. Parse plan, quota lines, quota remaining percent, status code, message, and real request result.
6. PATCH `/account-pool/check-results` with `name`, `content_hash`, and result.
7. Update frontend check store, local cache, and visible status.

Defaults from the reference: concurrency 50, minimum 1, retry network/timeout/5xx twice with a 700 ms interval. Treat 401, invalid token, expired token, and unauthorized as invalid.

## Usage and Cost

- Every request creates one usage record.
- Summary rows accelerate list and folder views.
- Folder summary is aggregated from account summaries.
- `username` and `session_id` should be separate display columns.
- `account_cost` is account purchase/input cost.
- Cost per dollar is `account_cost / usage_total_usd`; display `-` when USD is zero.

## Local Cache

- Key: `cli-proxy-account-pool`
- Shape: `cachedAt + records`
- TTL: 3 minutes
- Entry page behavior: refresh remote database immediately.
- Sync behavior: call `/account-pool/list?include_hash=true`; use `content_hash` to decide whether full content must be downloaded.
- Sync completion should write `localStorage` and emit `cli-proxy-account-pool-updated`.
