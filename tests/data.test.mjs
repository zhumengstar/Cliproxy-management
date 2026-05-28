import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import {
  aggregateMetrics,
  buildAccountRows,
  buildFolders,
  filterAccounts,
  parseConfig,
  parseRawLog,
  parseUsageJsonl,
  sortAccounts
} from '../src/data.js'

const root = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

const usageRecords = parseUsageJsonl(await read('mock-data/CLIProxyAPI/logs/usage-records-2026-05-27.jsonl'))
const config = parseConfig(await read('mock-data/CLIProxyAPI/config.yaml'))
const auths = await Promise.all(
  [
    'codex-user@example.com-plus.json',
    'claude-user@example.com.json',
    'gemini-user@example.com.json'
  ].map(async (file) => JSON.parse(await read(`mock-data/CLIProxyAPI/auths/${file}`)))
)
const accountPoolReference = JSON.parse(
  await read('mock-data/CLIProxyAPI/account-pool/list-response.json')
)
const rawLog = parseRawLog(
  await read('mock-data/CLIProxyAPI/logs/error-v1-chat-completions-2026-05-27T160804-e5f6a7b8.log'),
  'error-v1-chat-completions-2026-05-27T160804-e5f6a7b8.log'
)

assert.equal(usageRecords.length, 10)
assert.equal(config.apiKeys.length, 3)
assert.equal(config.usageStatisticsEnabled, true)
assert.equal(rawLog.isErrorLog, true)
assert.equal(rawLog.statusCode, 500)

const metrics = aggregateMetrics(usageRecords, auths, config, [rawLog])
assert.equal(metrics.requests, 10)
assert.equal(metrics.failures, 2)
assert.equal(metrics.totalTokens, 17048)
assert.equal(metrics.p95Latency, 4100)
assert.equal(metrics.authCount, 3)

const accounts = buildAccountRows({ usageRecords, auths, accountPoolReference })
assert.equal(accounts.length, 3)
assert.equal(accounts.find((account) => account.provider === 'codex').usageRequests, 5)

const folders = buildFolders(accounts, accountPoolReference.folders)
assert.equal(folders.length, 3)
assert.ok(folders.some((folder) => folder.folder === '2026-05-codex'))

const codexAccounts = filterAccounts(accounts, {
  query: '',
  folder: 'all',
  provider: 'codex',
  plan: 'all',
  status: 'all',
  quota: 'available'
})
assert.equal(codexAccounts.length, 1)

const sorted = sortAccounts(accounts, 'tokens')
assert.equal(sorted[0].provider, 'codex')

console.log('data tests passed')
