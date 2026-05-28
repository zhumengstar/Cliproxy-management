import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { request } from 'node:http'
import { spawn, spawnSync } from 'node:child_process'

const port = 4180
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

assert.equal(existsSync(edgePath), true, 'Microsoft Edge is required for local UI smoke tests')

const server = spawn(process.execPath, ['scripts/dev-server.mjs'], {
  cwd: new URL('../', import.meta.url),
  env: { ...process.env, PORT: String(port) },
  stdio: 'ignore',
  windowsHide: true
})

try {
  await waitForServer(`http://localhost:${port}`)

  const folderDom = dumpDom(`http://localhost:${port}`)
  assert.match(folderDom, /账号池/)
  assert.match(folderDom, /2026-05-codex/)
  assert.match(folderDom, /总 Token/)

  const listDom = dumpDom(`http://localhost:${port}/?mode=list`)
  assert.match(listDom, /codex-user@example\.com-plus\.json/)
  assert.match(listDom, /请求大模型/)
  assert.match(listDom, /17,048/)

  console.log('ui smoke tests passed')
} finally {
  server.kill()
}

function dumpDom(url) {
  const result = spawnSync(
    edgePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--virtual-time-budget=3000',
      '--dump-dom',
      url
    ],
    { encoding: 'utf8', windowsHide: true }
  )

  if (result.status !== 0) {
    throw new Error(result.stderr || `Edge exited with status ${result.status}`)
  }
  return result.stdout
}

async function waitForServer(url) {
  const deadline = Date.now() + 8000
  while (Date.now() < deadline) {
    try {
      await ping(url)
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }
  throw new Error(`Server did not start: ${url}`)
}

function ping(url) {
  return new Promise((resolve, reject) => {
    const req = request(url, { timeout: 1000 }, (res) => {
      res.resume()
      if (res.statusCode && res.statusCode < 500) resolve()
      else reject(new Error(`HTTP ${res.statusCode}`))
    })
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('timeout'))
    })
    req.end()
  })
}
