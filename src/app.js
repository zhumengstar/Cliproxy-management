import { filterAccounts, loadDashboardData, sortAccounts } from './data.js'

const state = {
  mode: new URLSearchParams(window.location.search).get('mode') === 'list' ? 'list' : 'folder',
  data: null,
  filteredAccounts: [],
  selected: new Set(),
  filters: {
    query: '',
    folder: 'all',
    provider: 'all',
    plan: 'all',
    status: 'all',
    quota: 'all',
    sort: 'folderTime'
  }
}

const elements = {
  uncheckedCount: document.querySelector('#uncheckedCount'),
  scopeCount: document.querySelector('#scopeCount'),
  selectedCount: document.querySelector('#selectedCount'),
  folderGrid: document.querySelector('#folderGrid'),
  accountGrid: document.querySelector('#accountGrid'),
  notice: document.querySelector('#notice'),
  searchInput: document.querySelector('#searchInput'),
  folderFilter: document.querySelector('#folderFilter'),
  providerFilter: document.querySelector('#providerFilter'),
  planFilter: document.querySelector('#planFilter'),
  statusFilter: document.querySelector('#statusFilter'),
  quotaFilter: document.querySelector('#quotaFilter'),
  sortSelect: document.querySelector('#sortSelect'),
  listModeBtn: document.querySelector('#listModeBtn'),
  folderModeBtn: document.querySelector('#folderModeBtn'),
  selectPage: document.querySelector('#selectPage'),
  selectFiltered: document.querySelector('#selectFiltered'),
  metricRequests: document.querySelector('#metricRequests'),
  metricTokens: document.querySelector('#metricTokens'),
  metricFailureRate: document.querySelector('#metricFailureRate'),
  metricP95: document.querySelector('#metricP95')
}

boot()

async function boot() {
  bindEvents()
  elements.listModeBtn.classList.toggle('is-selected', state.mode === 'list')
  elements.folderModeBtn.classList.toggle('is-selected', state.mode === 'folder')
  showNotice('正在加载账号池数据...')
  try {
    state.data = await loadDashboardData()
    hydrateFilters()
    render()
    showNotice('已从本地模拟数据刷新')
  } catch (error) {
    showNotice(error.message)
    console.error(error)
  }
}

function bindEvents() {
  elements.searchInput.addEventListener('input', (event) => {
    state.filters.query = event.target.value
    render()
  })
  for (const [key, element] of [
    ['folder', elements.folderFilter],
    ['provider', elements.providerFilter],
    ['plan', elements.planFilter],
    ['status', elements.statusFilter],
    ['quota', elements.quotaFilter]
  ]) {
    element.addEventListener('change', (event) => {
      state.filters[key] = event.target.value
      render()
    })
  }
  elements.sortSelect.addEventListener('change', (event) => {
    state.filters.sort = event.target.value
    render()
  })
  elements.listModeBtn.addEventListener('click', () => setMode('list'))
  elements.folderModeBtn.addEventListener('click', () => setMode('folder'))
  elements.selectPage.addEventListener('change', (event) => {
    if (event.target.checked) {
      state.filteredAccounts.forEach((account) => state.selected.add(account.id))
    } else {
      state.filteredAccounts.forEach((account) => state.selected.delete(account.id))
    }
    render()
  })
  elements.selectFiltered.addEventListener('change', (event) => {
    if (event.target.checked) {
      state.filteredAccounts.forEach((account) => state.selected.add(account.id))
      showNotice(`已选择 ${state.filteredAccounts.length} 个筛选结果`)
    }
    render()
  })
  document.querySelector('#clearSelectionBtn').addEventListener('click', () => {
    state.selected.clear()
    render()
    showNotice('已清空选择')
  })
  document.querySelector('#refreshBtn').addEventListener('click', async () => {
    showNotice('正在刷新...')
    state.data = await loadDashboardData()
    render()
    showNotice('刷新完成')
  })
  document.querySelector('#checkSelectedBtn').addEventListener('click', () => {
    showNotice(`已模拟检测 ${state.selected.size} 个账号`)
  })
  document.querySelector('#checkAllBtn').addEventListener('click', () => {
    showNotice(`已模拟检测全部 ${state.data.accounts.length} 个账号`)
  })
  document.querySelector('#downloadBtn').addEventListener('click', () => {
    showNotice(`已准备 ${state.selected.size || state.filteredAccounts.length} 个账号的下载包`)
  })
  document.querySelector('#appendBtn').addEventListener('click', () => {
    showNotice('已模拟追加写回认证文件')
  })
  document.querySelector('#overwriteBtn').addEventListener('click', () => {
    showNotice('覆盖写回需要二次确认，当前仅模拟')
  })
  document.querySelector('#deleteBtn').addEventListener('click', () => {
    showNotice(`删除操作需要确认，当前选中 ${state.selected.size} 个`)
  })
  document.querySelector('#importBtn').addEventListener('click', () => showNotice('导入入口已就绪'))
  document.querySelector('#folderBtn').addEventListener('click', () => setMode('folder'))
}

function setMode(mode) {
  state.mode = mode
  elements.listModeBtn.classList.toggle('is-selected', mode === 'list')
  elements.folderModeBtn.classList.toggle('is-selected', mode === 'folder')
  render()
}

function hydrateFilters() {
  const accounts = state.data.accounts
  fillSelect(elements.folderFilter, unique(accounts.map((account) => account.folder)), '全部文件夹')
  fillSelect(elements.providerFilter, unique(accounts.map((account) => account.provider)), '全部来源模型')
  fillSelect(elements.planFilter, unique(accounts.map((account) => account.plan)), '全部等级')
  fillSelect(elements.statusFilter, unique(accounts.map((account) => account.status)), '全部状态')
}

function fillSelect(select, values, allLabel) {
  select.innerHTML = `<option value="all">${allLabel}</option>`
  for (const value of values) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = value
    select.append(option)
  }
}

function render() {
  if (!state.data) return
  state.filteredAccounts = sortAccounts(filterAccounts(state.data.accounts, state.filters), state.filters.sort)
  renderMetrics()
  renderFolders()
  renderAccounts()
  renderCounts()
}

function renderMetrics() {
  const metrics = state.data.metrics
  elements.metricRequests.textContent = formatNumber(metrics.requests)
  elements.metricTokens.textContent = formatNumber(metrics.totalTokens)
  elements.metricFailureRate.textContent = `${Math.round(metrics.failureRate * 100)}%`
  elements.metricP95.textContent = `${formatNumber(metrics.p95Latency)}ms`
}

function renderCounts() {
  const unchecked = state.data.accounts.filter((account) => account.unchecked || account.status === 'unchecked').length
  elements.uncheckedCount.textContent = unchecked
  elements.scopeCount.textContent = state.filteredAccounts.length
  elements.selectedCount.textContent = state.selected.size
  elements.selectPage.checked =
    state.filteredAccounts.length > 0 && state.filteredAccounts.every((account) => state.selected.has(account.id))
  elements.selectFiltered.checked = false
}

function renderFolders() {
  elements.folderGrid.classList.toggle('is-hidden', state.mode !== 'folder')
  const folders = state.data.folders.filter((folder) => {
    if (state.filters.folder !== 'all' && folder.folder !== state.filters.folder) return false
    const accountIds = new Set(state.filteredAccounts.map((account) => account.folder))
    return accountIds.has(folder.folder)
  })

  elements.folderGrid.innerHTML = folders
    .map((folder) => {
      const costPerDollar = folder.totalUsd > 0 ? folder.totalCost / folder.totalUsd : 0
      return `
        <article class="folder-card">
          <label class="check-bubble">
            <input type="checkbox" data-folder="${escapeHtml(folder.folder)}" />
          </label>
          <div class="folder-visual" aria-hidden="true">
            <span class="folder-tab"></span>
            <span class="folder-date">${formatShortDate(folder.updatedAt || folder.createdAt)}</span>
            <span class="folder-count">${folder.count} 个账号</span>
          </div>
          <h2 title="${escapeHtml(folder.folder)}">${escapeHtml(folder.folder)}</h2>
          <p>${escapeHtml(folder.sourceModel || '未设置来源模型')}</p>
          <div class="pill-row">
            <span>总 Token ${formatNumber(folder.totalTokens)}</span>
            <span>总刀数 $${folder.totalUsd.toFixed(4)}</span>
          </div>
          <div class="pill-row">
            <span>每刀成本 ${costPerDollar ? `¥${costPerDollar.toFixed(3)}/刀` : '-'}</span>
            <span>未检测 ${folder.unchecked}</span>
          </div>
          <div class="card-actions">
            <button type="button" data-action="source" data-folder="${escapeHtml(folder.folder)}">设置来源</button>
            <button type="button" data-action="enter" data-folder="${escapeHtml(folder.folder)}">进入</button>
          </div>
        </article>
      `
    })
    .join('')

  elements.folderGrid.querySelectorAll('[data-action="enter"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.filters.folder = button.dataset.folder
      elements.folderFilter.value = button.dataset.folder
      setMode('list')
    })
  })
}

function renderAccounts() {
  elements.accountGrid.classList.toggle('is-hidden', state.mode !== 'list')
  elements.accountGrid.innerHTML = state.filteredAccounts
    .map((account) => {
      const checked = state.selected.has(account.id) ? 'checked' : ''
      return `
        <article class="account-card">
          <label class="account-title">
            <input type="checkbox" data-account="${escapeHtml(account.id)}" ${checked} />
            <span title="${escapeHtml(account.name)}">${escapeHtml(account.displayName)}</span>
          </label>
          <div class="tag-row">
            <span>${escapeHtml(account.type)}</span>
            <span>${escapeHtml(account.folder)}</span>
            <button type="button">编辑成本/来源</button>
          </div>
          <button class="request-button" type="button">请求大模型</button>
          <div class="stat-grid">
            <span>成本 <strong>${account.accountCost ? `¥${account.accountCost.toFixed(2)}` : '-'}</strong></span>
            <span>每刀成本 <strong>${account.usageTotalUsd ? `¥${(account.accountCost / account.usageTotalUsd).toFixed(3)}/刀` : '-'}</strong></span>
            <span>渠道来源 <strong>${escapeHtml(account.sourceChannel || '-')}</strong></span>
            <span>存活 <strong>${formatLifetime(account.lifetimeSeconds)}</strong></span>
            <span>请求 <strong>${formatNumber(account.usageRequests)}</strong></span>
            <span>成功 <strong>${formatNumber(account.usageSuccesses)}</strong></span>
            <span>Token <strong>${formatNumber(account.usageTotalTokens)}</strong></span>
            <span>刀数 <strong>$${account.usageTotalUsd.toFixed(4)}</strong></span>
            <span>失败 <strong>${formatNumber(account.usageFailures)}</strong></span>
          </div>
        </article>
      `
    })
    .join('')

  elements.accountGrid.querySelectorAll('[data-account]').forEach((input) => {
    input.addEventListener('change', (event) => {
      if (event.target.checked) {
        state.selected.add(event.target.dataset.account)
      } else {
        state.selected.delete(event.target.dataset.account)
      }
      renderCounts()
    })
  })
}

function showNotice(message) {
  elements.notice.textContent = message
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Math.round(Number(value) || 0))
}

function formatShortDate(value) {
  if (!value) return '--/-- --:--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--/-- --:--'
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function formatLifetime(seconds) {
  if (!seconds) return '-'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  return `${days}天${hours}小时`
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
