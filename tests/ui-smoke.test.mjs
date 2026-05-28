import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { request } from 'node:http'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const port = 5179
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const projectRoot = fileURLToPath(new URL('../', import.meta.url))

assert.equal(existsSync(edgePath), true, 'Microsoft Edge is required for local UI smoke tests')

const serverCommand = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'npm'
const serverArgs =
  process.platform === 'win32'
    ? ['/d', '/s', '/c', `npm run dev -- --port ${port} --strictPort`]
    : ['run', 'dev', '--', '--port', String(port), '--strictPort']

const server = spawn(serverCommand, serverArgs, {
  cwd: projectRoot,
  env: { ...process.env },
  stdio: 'ignore',
  windowsHide: true
})

try {
  await waitForServer(`http://localhost:${port}`)

  const folderDom = dumpDom(`http://localhost:${port}/#/account-pool`)
  assert.match(folderDom, /账号池/)
  assert.match(folderDom, /文件夹模式/)
  assert.match(folderDom, /2026-05-codex|codex-user@example\.com-plus\.json/)

  const rootDom = dumpDom(`http://localhost:${port}`)
  assert.match(rootDom, /账号池/)
  assert.doesNotMatch(rootDom, /管理密钥|Management Key|登录到/)

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
      '--virtual-time-budget=8000',
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
