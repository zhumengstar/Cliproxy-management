# Management Auth Files API

Base URL:

```text
https://cliproxy2.muling.store/v0/management
```

Authentication header, choose one:

```http
Authorization: Bearer <MANAGEMENT_KEY>
```

```http
X-Management-Key: <MANAGEMENT_KEY>
```

This document records the auth file management APIs for later implementation.

## Import Auth Files

Endpoint:

```http
POST /v0/management/auth-files
```

### Raw JSON Import

Use query `name` as the target file name.

```bash
curl -X POST "https://cliproxy2.muling.store/v0/management/auth-files?name=codex-user@example.com.json" \
  -H "Authorization: Bearer <MANAGEMENT_KEY>" \
  -H "Content-Type: application/json" \
  --data-binary @codex-user@example.com.json
```

Request body example:

```json
{
  "id_token": "",
  "access_token": "eyJ...",
  "refresh_token": "",
  "account_id": "71319e87-b794-4430-bc81-a6f623e61f56",
  "last_refresh": "2026-05-26T14:55:18.000Z",
  "email": "user@example.com",
  "type": "codex",
  "expired": "2026-06-04T10:55:42.000Z"
}
```

Success response:

```json
{
  "status": "ok"
}
```

### Multipart Upload

Upload one or more `.json` files.

```bash
curl -X POST "https://cliproxy2.muling.store/v0/management/auth-files" \
  -H "Authorization: Bearer <MANAGEMENT_KEY>" \
  -F "files=@codex-user1@example.com.json" \
  -F "files=@codex-user2@example.com.json"
```

Success response:

```json
{
  "status": "ok",
  "uploaded": 2,
  "files": [
    "codex-user1@example.com.json",
    "codex-user2@example.com.json"
  ]
}
```

## List Auth Files

Endpoint:

```http
GET /v0/management/auth-files
```

```bash
curl "https://cliproxy2.muling.store/v0/management/auth-files" \
  -H "Authorization: Bearer <MANAGEMENT_KEY>"
```

Response example:

```json
{
  "files": [
    {
      "id": "codex-user@example.com.json",
      "auth_index": "codex-1",
      "name": "codex-user@example.com.json",
      "type": "codex",
      "provider": "codex",
      "email": "user@example.com",
      "status": "active",
      "status_message": "",
      "disabled": false,
      "unavailable": false,
      "last_refresh": "2026-05-26T14:55:18Z",
      "success": 12,
      "failed": 0,
      "source": "file",
      "size": 1234
    }
  ]
}
```

Status interpretation:

| Field | Meaning |
| --- | --- |
| `status = active` | Normal |
| `status = error` | Auth exception, refresh failure, or request failure |
| `status = disabled` | Disabled |
| `unavailable = true` | Currently unavailable, possibly rate limited, no quota, or cooling down |
| `status_message` | Failure reason |
| `failed` | Failure count |
| `last_refresh` | Last refresh time |

There is no dedicated standalone endpoint named "check auth invalid". The normal check path is:

1. Call `GET /auth-files` to inspect runtime status.
2. After real account requests fail, the status fields reflect the failure state.
3. For active probing, call `/api-call` with `auth_index`.

## Active Probe

Endpoint:

```http
POST /v0/management/api-call
```

```bash
curl -X POST "https://cliproxy2.muling.store/v0/management/api-call" \
  -H "Authorization: Bearer <MANAGEMENT_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "auth_index": "codex-1",
    "method": "GET",
    "url": "https://api.openai.com/v1/models",
    "header": {
      "Authorization": "Bearer $TOKEN$"
    }
  }'
```

Success-style response:

```json
{
  "status_code": 200,
  "header": {},
  "body": "{...}"
}
```

Invalid token example:

```json
{
  "status_code": 401,
  "body": "{\"error\":...}"
}
```

## Disable Or Enable Auth File

Endpoint:

```http
PATCH /v0/management/auth-files/status
```

Disable:

```bash
curl -X PATCH "https://cliproxy2.muling.store/v0/management/auth-files/status" \
  -H "Authorization: Bearer <MANAGEMENT_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "codex-user@example.com.json",
    "disabled": true
  }'
```

Enable:

```bash
curl -X PATCH "https://cliproxy2.muling.store/v0/management/auth-files/status" \
  -H "Authorization: Bearer <MANAGEMENT_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "codex-user@example.com.json",
    "disabled": false
  }'
```

Response:

```json
{
  "status": "ok",
  "disabled": true
}
```

## Remove Auth Files

Endpoint:

```http
DELETE /v0/management/auth-files
```

Delete one file with query:

```bash
curl -X DELETE "https://cliproxy2.muling.store/v0/management/auth-files?name=codex-user@example.com.json" \
  -H "Authorization: Bearer <MANAGEMENT_KEY>"
```

Delete one file with JSON body:

```bash
curl -X DELETE "https://cliproxy2.muling.store/v0/management/auth-files" \
  -H "Authorization: Bearer <MANAGEMENT_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "codex-user@example.com.json"
  }'
```

Batch delete:

```bash
curl -X DELETE "https://cliproxy2.muling.store/v0/management/auth-files" \
  -H "Authorization: Bearer <MANAGEMENT_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "names": [
      "codex-user1@example.com.json",
      "codex-user2@example.com.json"
    ]
  }'
```

Batch delete with array body:

```json
[
  "codex-user1@example.com.json",
  "codex-user2@example.com.json"
]
```

Delete all:

```bash
curl -X DELETE "https://cliproxy2.muling.store/v0/management/auth-files?all=true" \
  -H "Authorization: Bearer <MANAGEMENT_KEY>"
```

Success response:

```json
{
  "status": "ok",
  "deleted": 2,
  "files": [
    "codex-user1@example.com.json",
    "codex-user2@example.com.json"
  ]
}
```

`all=true` is destructive and should require explicit UI confirmation before use.
