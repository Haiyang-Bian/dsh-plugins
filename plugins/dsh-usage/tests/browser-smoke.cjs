// Installed desktop code is authoritative for rendering. The HTTP test carrier
// connects its real Client Remote to the real Host Gateway with synthetic usage.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http')
const { createRequire } = require('node:module')
const esbuild = createRequire(require.resolve('vite/package.json'))('esbuild')
const { installedHost } = require('../../dsh-appearance/tests/installed-host.cjs')
const { Context } = require('@deepseek-ai/cordis')
const { TypertRegistry } = require('@deepseek-ai/dsh-typert-registry')
const { TypertGatewayService } = require('@deepseek-ai/dsh-api-gateway')
const host = require('./load.cjs')('host')
const app = installedHost(process.argv[2]), prefix = 'dsh/node_modules/@deepseek-ai/'
const hostVersion = JSON.parse(app.read('package.json')).version
// Desktop now embeds some shared cores instead of publishing standalone ASAR
// entries. Use the exact same released SDK for those cores, never an older copy.
function runtimeFile(file) {
  for (const candidate of [prefix + file, 'node_modules/@deepseek-ai/' + file]) if (app.files.has(candidate)) return app.read(candidate)
  const [name, ...parts] = file.split('/')
  const entry = require.resolve('@deepseek-ai/' + name + '/package.json')
  const pkg = JSON.parse(fs.readFileSync(entry, 'utf8'))
  if (pkg.version !== hostVersion) throw Error(name + ' fixture SDK must match installed DSH ' + hostVersion)
  let target = path.join(path.dirname(entry), ...parts)
  if (!fs.existsSync(target) && parts.join('/') === 'lib/client.js') target = path.join(path.dirname(entry), 'lib/client.browser.js')
  return fs.readFileSync(target, 'utf8')
}
const assets = new Map()
const layoutCode = app.read(prefix + 'dsh-client-ui-layout/lib/client.js')
const classStart = layoutCode.indexOf('const THEME_SOURCE_ATTRIBUTE ='), classEnd = layoutCode.indexOf('\n\t\t};', layoutCode.indexOf('var ThemePresenter = class {', classStart))
if (classStart < 0 || classEnd < 0) throw Error('Installed ThemePresenter missing')
assets.set('/presenter.js', ['text/javascript', `const DARK_ATTRIBUTE='data-ds-dark-theme';${layoutCode.slice(classStart, classEnd + '\n\t\t};'.length)}\nexport {ThemePresenter};`])
const theme = app.read(prefix + 'dsh-client-ui-theme/lib/client.js')
for (const [variable, route] of [['base_css_default', '/base.css'], ['design_platform_css_default', '/palette.css']]) {
  const match = theme.match(new RegExp('var ' + variable + ' = ("(?:[^"\\\\]|\\\\.)*");'))
  assets.set(route, ['text/css', JSON.parse(match[1])])
}
const r = createRequire(require.resolve('@deepseek-ai/dsh-client-ui-slots/package.json'))
assets.set('/cordis.js', ['text/javascript', esbuild.buildSync({ stdin: { contents: app.read(prefix + 'cordis/lib/index.js'), resolveDir: path.dirname(r.resolve('@deepseek-ai/cordis')) }, bundle: true, write: false, format: 'esm', platform: 'browser' }).outputFiles[0].text])
assets.set('/slots.js', ['text/javascript', runtimeFile('dsh-client-ui-slots/lib/index.js')])
for (const [route, pkg, expose] of [['renderer', 'renderer', ''], ['sidebar', 'sidebar', 'exports.fixture={SidebarRoot};'], ['layout', 'layout', 'exports.fixture={AppFrame,createLayoutStore};'], ['theme', 'theme', 'exports.fixture={ThemeRuntime};'], ['registry', '', ''], ['remote', '', '']]) {
  const name = route === 'registry' ? 'dsh-typert-registry' : route === 'remote' ? 'dsh-api-gateway' : 'dsh-client-ui-' + pkg
  let code = runtimeFile(name + '/lib/client.js')
  if (expose) code = code.replace('return module.exports;', expose + 'return module.exports;')
  assets.set('/' + route + '.js', ['text/javascript', code])
}
const surfaceCSS = ['layout', 'sidebar'].flatMap(name => [...app.read(prefix + 'dsh-client-ui-' + name + '/lib/client.js').matchAll(/const css(?:\$\d+)? = ("(?:[^"\\]|\\.)*");/g)].map(m => JSON.parse(m[1]))).join('\n')
assets.set('/surfaces.css', ['text/css', surfaceCSS]); app.close()
for (const pkg of ['react', 'react-dom']) assets.set('/' + pkg + '.js', ['text/javascript', fs.readFileSync(path.join(path.dirname(require.resolve(pkg + '/package.json')), 'umd/' + pkg + '.development.js'), 'utf8')])
const zodBundle = esbuild.buildSync({ stdin: { contents: 'export * from "zod"', resolveDir: path.join(__dirname, '..') }, bundle: true, write: false, format: 'esm', platform: 'browser' }).outputFiles[0].text
assets.set('/zod.js', ['text/javascript', zodBundle])
const ctx = new Context(); new TypertRegistry(ctx)
const peerAbort = new AbortController()
const peer = { id: 'fixture-owner', ctx, principal: { kind: 'owner' }, signal: peerAbort.signal, interactions: 'none', dispose: async () => peerAbort.abort() }
const gateway = new TypertGatewayService(ctx, { websocketHeartbeatIntervalMs: 2000, streamInboxBytes: 262144 })
const records = new Map(), events = []
for (let day = 0, seq = 0; day < 30; day++) {
  const time = Date.now() - (29 - day) * 86400000, provider = day % 2 ? 'DeepSeek' : 'OpenAI', model = day % 2 ? 'deepseek-chat' : 'gpt-model'
  for (const [type, data] of [['request/header', { header: { config: { provider, model } } }], ['user/message', { role: 'user', source: { kind: 'user' } }], ['turn/start', { turn: day }], ['step/start', { turn: day }], ['assistant/message', { usage: { inputTokens: 1000 + day * 120, outputTokens: 250 + day * 20, cacheReadTokens: day * 60 }, message: { source: { provider, model } } }]]) events.push({ seq: seq++, time, type, data })
}
ctx.provide('sessionQuery', { listSessions: async () => [{ header: { id: 'fixture' } }], readSession: async () => ({ session: { id: 'fixture', cwd: '默认工作区' }, inheritedEventCount: 0, events }) })
ctx.provide('storageDomain', { open: async () => ({ table: () => ({ entries: () => records.entries(), put: async (id, record) => records.set(id, record) }), close: async () => {} }) }); ctx.provide('llm', {})
const fiber = ctx.plugin(host)
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname
  if (pathname === '/rpc' && req.method === 'POST') {
    try { const chunks = []; for await (const c of req) chunks.push(c); const request = JSON.parse(Buffer.concat(chunks).toString()); const value = await gateway.invoke({ ...request, peer }); res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ok: true, value })); }
    catch (error) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ok: false, error: { code: error.code ?? 'gateway/internal', message: error.message, details: {} } })); } return
  }
  let asset = assets.get(pathname)
  if (pathname === '/') asset = ['text/html;charset=utf-8', fs.readFileSync(path.join(__dirname, 'browser-fixture.html'))]
  if (pathname === '/run.js') asset = ['text/javascript', fs.readFileSync(path.join(__dirname, 'browser-fixture.js'))]
  if (pathname === '/client.js') asset = ['text/javascript', fs.readFileSync(path.join(__dirname, '../dist/client.js'))]
  if (pathname === '/appearance.js') asset = ['text/javascript', fs.readFileSync(path.join(__dirname, '../../dsh-appearance/dist/client.js'))]
  if (!asset) { res.writeHead(404); res.end(); return } res.setHeader('Content-Type', asset[0]); res.end(asset[1])
})
server.listen(0, '127.0.0.1', () => console.log('DSH usage integration: http://127.0.0.1:' + server.address().port))
process.on('SIGINT', () => server.close(async () => { await peer.dispose(); await fiber.dispose(); process.exit(0) }))
