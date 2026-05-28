import http from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'

const root = resolve('.')
const port = Number(process.env.PORT || 4173)

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jsonl': 'application/x-ndjson; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8',
  '.log': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${port}`)
  const cleanPath = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '')
  const target = resolve(join(root, cleanPath || 'index.html'))

  if (!target.startsWith(root) || !existsSync(target)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not found')
    return
  }

  const file = statSync(target).isDirectory() ? join(target, 'index.html') : target
  res.writeHead(200, {
    'Content-Type': contentTypes[extname(file)] || 'application/octet-stream'
  })
  createReadStream(file).pipe(res)
})

server.listen(port, () => {
  console.log(`Cliproxy management preview: http://localhost:${port}`)
})
