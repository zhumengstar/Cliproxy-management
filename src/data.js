const DATA_ROOT = './mock-data/CLIProxyAPI'

const AUTH_FILES = [
  'codex-user@example.com-plus.json',
  'claude-user@example.com.json',
  'gemini-user@example.com.json'
]

const RAW_LOG_FILES = [
  'v1-chat-completions-2026-05-27T201122-a1b2c3d4.log',
  'error-v1-chat-completions-2026-05-27T160804-e5f6a7b8.log'
]

export const dataSources = {
  usageRecords: `${DATA_ROOT}/logs/usage-records-2026-05-27.jsonl`,
  config: `${DATA_ROOT}/config.yaml`,
  auths: AUTH_FILES.map((file) => `${DATA_ROOT}/auths/${file}`),
  rawLogs: RAW_LOG_FILES.map((file) => `${DATA_ROOT}/logs/${file}`),
  accountPoolReference: `${DATA_ROOT}/account-pool/list-response.json`
}

export async function loadDashboardData(fetcher = fetch) {
  const [usageText, configText, accountPool, auths, rawLogs] = await Promise.all([
    fetchText(dataSources.usageRecords, fetcher),
    fetchText(dataSources.config, fetcher),
    fetchJson(dataSources.accountPoolReference, fetcher),
    Promise.all(dataSources.auths.map((url) => fetchJson(url, fetcher))),
    Promise.all(dataSources.rawLogs.map((url) => fetchText(url, fetcher)))
  ])

  const usageRecords = parseUsageJsonl(usageText)
  const config = parseConfig(configText)
  const rawLogRecords = rawLogs.map((text, index) => parseRawLog(text, RAW_LOG_FILES[index]))
  const accounts = buildAccountRows({
    usageRecords,
    auths,
    accountPoolReference: accountPool
  })

  return {
    usageRecords,
    auths,
    config,
    rawLogRecords,
    accountPoolReference: accountPool,
    accounts,
    folders: buildFolders(accounts, accountPool.folders || []),
    metrics: aggregateMetrics(usageRecords, auths, config, rawLogRecords)
  }
}

async function fetchText(url, fetcher) {
  const response = await fetcher(url)
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`)
  }
  return response.text()
}

async function fetchJson(url, fetcher) {
  return JSON.parse(await fetchText(url, fetcher))
}

export function parseUsageJsonl(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

export function parseConfig(text) {
  const lines = text.split(/\r?\n/)
  const config = {
    apiKeys: [],
    usageStatisticsEnabled: false,
    requestLog: false,
    loggingToFile: false,
    openaiCompatCount: 0,
    claudeApiKeyCount: 0,
    geminiApiKeyCount: 0
  }
  let section = ''

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    if (/^[\w-]+:/.test(line)) {
      section = line.split(':')[0]
    }

    if (section === 'api-keys' && line.startsWith('- ')) {
      config.apiKeys.push(stripQuotes(line.slice(2)))
    }
    if (line.startsWith('usage-statistics-enabled:')) {
      config.usageStatisticsEnabled = line.endsWith('true')
    }
    if (line.startsWith('request-log:')) {
      config.requestLog = line.endsWith('true')
    }
    if (line.startsWith('logging-to-file:')) {
      config.loggingToFile = line.endsWith('true')
    }
    if (section === 'openai-compat' && line.startsWith('- name:')) {
      config.openaiCompatCount += 1
    }
    if (section === 'claude-api-key' && line.startsWith('- api-key:')) {
      config.claudeApiKeyCount += 1
    }
    if (section === 'gemini-api-key' && line.startsWith('- api-key:')) {
      config.geminiApiKeyCount += 1
    }
  }

  return config
}

function stripQuotes(value) {
  return value.trim().replace(/^["']|["']$/g, '')
}

export function parseRawLog(text, fileName) {
  const timestamp = matchLine(text, /^Timestamp:\s*(.+)$/m)
  const status = Number(matchLine(text, /^Status:\s*(\d+)/m) || 0)
  return {
    fileName,
    isErrorLog: fileName.startsWith('error-'),
    url: matchLine(text, /^URL:\s*(.+)$/m),
    method: matchLine(text, /^Method:\s*(.+)$/m),
    timestamp,
    statusCode: status,
    model: matchLine(text, /"model"\s*:\s*"([^"]+)"/),
    hasUsage: /"usage"\s*:/.test(text)
  }
}

function matchLine(text, pattern) {
  const match = text.match(pattern)
  return match ? match[1].trim() : ''
}

export function aggregateMetrics(usageRecords, auths, config, rawLogRecords = []) {
  const requests = usageRecords.length
  const failures = usageRecords.filter((record) => record.failed).length
  const successes = requests - failures
  const totalTokens = sum(usageRecords, (record) => record.tokens?.total_tokens || 0)
  const inputTokens = sum(usageRecords, (record) => record.tokens?.input_tokens || 0)
  const outputTokens = sum(usageRecords, (record) => record.tokens?.output_tokens || 0)
  const cachedTokens = sum(usageRecords, (record) => record.tokens?.cached_tokens || 0)
  const latencies = usageRecords.map((record) => record.latency_ms || 0).sort((a, b) => a - b)
  const providers = new Set(usageRecords.map((record) => record.provider).filter(Boolean))
  const models = new Set(usageRecords.map((record) => record.model).filter(Boolean))
  const apiKeys = new Set(usageRecords.map((record) => record.api_key).filter(Boolean))

  return {
    requests,
    successes,
    failures,
    failureRate: requests ? failures / requests : 0,
    totalTokens,
    inputTokens,
    outputTokens,
    cachedTokens,
    p50Latency: percentile(latencies, 0.5),
    p95Latency: percentile(latencies, 0.95),
    providerCount: providers.size,
    modelCount: models.size,
    callerApiKeyCount: apiKeys.size || config.apiKeys.length,
    authCount: auths.length,
    rawLogCount: rawLogRecords.length,
    errorRawLogCount: rawLogRecords.filter((record) => record.isErrorLog).length
  }
}

export function buildAccountRows({ usageRecords, auths, accountPoolReference }) {
  const referenceByEmail = new Map(
    (accountPoolReference.files || []).map((file) => [String(file.email || '').toLowerCase(), file])
  )

  const authRows = auths.map((auth, index) => {
    const email = String(auth.email || '').toLowerCase()
    const reference = referenceByEmail.get(email) || {}
    const usage = aggregateAccountUsage(usageRecords, auth.email)
    const expiresAt = auth.expired || auth.expire || auth.token?.expiry || ''
    const failed = usage.failures
    const quotaPercent = Number(reference.check_quota_remaining_percent ?? (failed ? 0 : 80))

    return {
      id: reference.name || `${auth.type || 'auth'}-${index + 1}.json`,
      name: reference.name || `${auth.email || auth.project_id || `account-${index + 1}`}.json`,
      displayName: basename(reference.name || `${auth.email || auth.project_id || `account-${index + 1}`}.json`),
      type: auth.type || reference.type || 'unknown',
      provider: auth.type || reference.provider || 'unknown',
      email: auth.email || '',
      authIndex: `auth-${index + 1}`,
      folder: reference.folder || defaultFolder(auth.type),
      plan: reference.check_plan || inferPlan(auth.type),
      status: reference.check_status || (failed ? 'error' : 'ok'),
      statusMessage: reference.check_message || '',
      quotaPercent,
      accountCost: Number(reference.account_cost || 0),
      sourceChannel: reference.source_channel || 'auth-dir',
      createdAt: reference.account_started_at || auth.last_refresh || '',
      updatedAt: reference.check_updated_at || usage.lastUsedAt || auth.last_refresh || '',
      lifetimeSeconds: Number(reference.account_lifetime_seconds || 0),
      usageRequests: usage.requests,
      usageSuccesses: usage.successes,
      usageFailures: usage.failures,
      usageTotalTokens: usage.totalTokens,
      usageTotalUsd: Number(reference.usage_total_usd || estimateUsd(usage)),
      contentHash: reference.content_hash || '',
      unchecked: !reference.check_content_hash
    }
  })

  const referenceOnlyRows = (accountPoolReference.files || [])
    .filter((file) => !authRows.some((row) => row.email && row.email === file.email))
    .map((file, index) => ({
      id: file.name,
      name: file.name,
      displayName: basename(file.name),
      type: file.type || 'unknown',
      provider: file.provider || file.type || 'unknown',
      email: file.email || '',
      authIndex: `pool-${index + 1}`,
      folder: file.folder || '默认文件夹',
      plan: file.check_plan || 'unknown',
      status: file.check_status || 'unchecked',
      statusMessage: file.check_message || '',
      quotaPercent: Number(file.check_quota_remaining_percent || 0),
      accountCost: Number(file.account_cost || 0),
      sourceChannel: file.source_channel || 'account-pool-reference',
      createdAt: file.account_started_at || '',
      updatedAt: file.check_updated_at || file.usage_last_used_at || '',
      lifetimeSeconds: Number(file.account_lifetime_seconds || 0),
      usageRequests: Number(file.usage_requests || 0),
      usageSuccesses: Number(file.usage_successes || 0),
      usageFailures: Number(file.usage_failures || 0),
      usageTotalTokens: Number(file.usage_total_tokens || 0),
      usageTotalUsd: Number(file.usage_total_usd || 0),
      contentHash: file.content_hash || '',
      unchecked: !file.check_content_hash
    }))

  return [...authRows, ...referenceOnlyRows]
}

export function buildFolders(accounts, referenceFolders = []) {
  const byFolder = new Map()
  for (const account of accounts) {
    const folderName = account.folder || '默认文件夹'
    const current = byFolder.get(folderName) || {
      folder: folderName,
      sourceModel: '',
      sourceInfo: '',
      count: 0,
      requests: 0,
      totalTokens: 0,
      totalUsd: 0,
      totalCost: 0,
      unchecked: 0,
      updatedAt: '',
      createdAt: ''
    }
    current.count += 1
    current.requests += account.usageRequests
    current.totalTokens += account.usageTotalTokens
    current.totalUsd += account.usageTotalUsd
    current.totalCost += account.accountCost
    current.unchecked += account.unchecked ? 1 : 0
    current.updatedAt = maxIso(current.updatedAt, account.updatedAt)
    current.createdAt = maxIso(current.createdAt, account.createdAt)
    byFolder.set(folderName, current)
  }

  for (const folder of referenceFolders) {
    const current = byFolder.get(folder.folder)
    if (!current) continue
    current.sourceModel = folder.source_model || current.sourceModel
    current.sourceInfo = folder.source_info || current.sourceInfo
    current.createdAt = maxIso(current.createdAt, folder.created_at || '')
    current.updatedAt = maxIso(current.updatedAt, folder.updated_at || '')
  }

  return [...byFolder.values()].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
}

function aggregateAccountUsage(usageRecords, email) {
  const lowerEmail = String(email || '').toLowerCase()
  const matched = usageRecords.filter((record) => String(record.email || '').toLowerCase() === lowerEmail)
  return {
    requests: matched.length,
    successes: matched.filter((record) => !record.failed).length,
    failures: matched.filter((record) => record.failed).length,
    totalTokens: sum(matched, (record) => record.tokens?.total_tokens || 0),
    inputTokens: sum(matched, (record) => record.tokens?.input_tokens || 0),
    outputTokens: sum(matched, (record) => record.tokens?.output_tokens || 0),
    cachedTokens: sum(matched, (record) => record.tokens?.cached_tokens || 0),
    lastUsedAt: matched.map((record) => record.timestamp).sort().at(-1) || ''
  }
}

function estimateUsd(usage) {
  return Number(((usage.inputTokens * 0.00000125) + (usage.outputTokens * 0.00001)).toFixed(4))
}

function inferPlan(type) {
  if (type === 'codex') return 'plus'
  if (type === 'claude') return 'pro'
  if (type === 'gemini') return 'free'
  return 'unknown'
}

function defaultFolder(type) {
  if (!type) return '默认文件夹'
  return `默认文件夹-${type}`
}

function basename(name) {
  return String(name || '').split(/[\\/]/).filter(Boolean).at(-1) || String(name || '')
}

function sum(items, pick) {
  return items.reduce((total, item) => total + Number(pick(item) || 0), 0)
}

function percentile(sortedNumbers, ratio) {
  if (!sortedNumbers.length) return 0
  const index = Math.ceil(sortedNumbers.length * ratio) - 1
  return sortedNumbers[Math.max(0, Math.min(index, sortedNumbers.length - 1))]
}

function maxIso(left, right) {
  if (!left) return right || ''
  if (!right) return left
  return new Date(left) > new Date(right) ? left : right
}

export function filterAccounts(accounts, filters) {
  const query = filters.query.trim().toLowerCase()
  return accounts.filter((account) => {
    const text = `${account.name} ${account.type} ${account.status} ${account.email}`.toLowerCase()
    if (query && !text.includes(query)) return false
    if (filters.folder !== 'all' && account.folder !== filters.folder) return false
    if (filters.provider !== 'all' && account.provider !== filters.provider) return false
    if (filters.plan !== 'all' && account.plan !== filters.plan) return false
    if (filters.status !== 'all' && account.status !== filters.status) return false
    if (filters.quota === 'available' && account.quotaPercent <= 0) return false
    if (filters.quota === 'empty' && account.quotaPercent > 0) return false
    return true
  })
}

export function sortAccounts(accounts, sortKey) {
  const copy = [...accounts]
  if (sortKey === 'tokens') {
    return copy.sort((a, b) => b.usageTotalTokens - a.usageTotalTokens)
  }
  if (sortKey === 'failures') {
    return copy.sort((a, b) => b.usageFailures - a.usageFailures)
  }
  return copy.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
}
