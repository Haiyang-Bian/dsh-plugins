// Optional real-browser fixture using the installed DSH renderer/runtime/CSS.
// Start with pnpm run test:browser, open the printed URL, and run its checks.
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const { createRequire } = require('node:module')
const esbuild = createRequire(require.resolve('vite/package.json'))('esbuild')
const cordisRequire = createRequire(require.resolve('@deepseek-ai/dsh-client-ui-slots/package.json'))
const { installedHost } = require('./installed-host.cjs')
const app = installedHost(process.argv[2])
const modulePath = name => 'dsh/node_modules/@deepseek-ai/' + name + '/lib/'
const themeCode = app.read(modulePath('dsh-client-ui-theme') + 'client.js')
const layoutCode = app.read(modulePath('dsh-client-ui-layout') + 'client.js')
function classSource(source, name) {
  const start = source.indexOf('var ' + name + ' = class {')
  const end = source.indexOf('\n\t\t};', start)
  if (start < 0 || end < 0) throw new Error('Missing installed class ' + name)
  return source.slice(start, end + '\n\t\t};'.length)
}
const presenter = `const THEME_SOURCE_ATTRIBUTE='data-ds-theme-source';const DARK_ATTRIBUTE='data-ds-dark-theme';const CONTENT_FONT_SIZE_VARIABLE='--dsh-content-font-size';${classSource(layoutCode, 'ThemePresenter')}\nexport {ThemePresenter};`
const exposedTheme = themeCode.replace('return module.exports;', 'exports.fixture={ThemeRuntime,AppearanceRow,FontSizeRow,createAppearanceRowStore,createFontSizeRowStore};return module.exports;')
const assets = new Map([
  ['/cordis.js', ['text/javascript', esbuild.buildSync({ stdin: {
    contents: app.read(modulePath('cordis') + 'index.js'),
    resolveDir: path.dirname(cordisRequire.resolve('@deepseek-ai/cordis')),
  }, bundle: true, write: false, format: 'esm', platform: 'browser' }).outputFiles[0].text]],
  ['/slots.js', ['text/javascript', app.read(modulePath('dsh-client-ui-slots') + 'index.js')]],
  ['/renderer.js', ['text/javascript', app.read(modulePath('dsh-client-ui-renderer') + 'client.js')]],
  ['/theme.js', ['text/javascript', exposedTheme]],
  ['/presenter.js', ['text/javascript', presenter]],
  ['/react.js', ['text/javascript', fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')), 'umd/react.development.js'), 'utf8')]],
  ['/react-dom.js', ['text/javascript', fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')), 'umd/react-dom.development.js'), 'utf8')]],
])
// Global typography comes from the actual installed UI, not test approximations.
for (const [variable, route] of [['base_css_default', '/base.css'], ['design_platform_css_default', '/palette.css'], ['gradient_shadow_text_css_default', '/typography.css']]) {
  const match = themeCode.match(new RegExp('var ' + variable + ' = ("(?:[^"\\\\]|\\\\.)*");'))
  if (!match) throw new Error('Missing installed CSS ' + variable)
  assets.set(route, ['text/css', JSON.parse(match[1])])
}
const frontendFile = [...app.files.keys()].find(file => /dsh-web-frontend\/dist\/assets\/index-[^/]+\.css$/.test(file))
if (!frontendFile) throw new Error('Missing installed frontend typography CSS')
assets.set('/frontend.css', ['text/css', app.read(frontendFile)])
const surfaceCSS = ['layout', 'sidebar', 'workspace', 'sidebar-right', 'conversation', 'settings-general'].flatMap(name => {
  const code = app.read(modulePath('dsh-client-ui-' + name) + 'client.js')
  return [...code.matchAll(/const css(?:\$\d+)? = ("(?:[^"\\]|\\.)*");/g)].map(match => JSON.parse(match[1]))
}).join('\n')
assets.set('/surfaces.css', ['text/css', surfaceCSS])
app.close()
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname
  let asset = assets.get(pathname)
  if (pathname === '/') asset = ['text/html; charset=utf-8', fs.readFileSync(path.join(__dirname, 'browser-fixture.html'))]
  if (pathname === '/run.js') asset = ['text/javascript', fs.readFileSync(path.join(__dirname, 'browser-fixture.js'))]
  if (pathname === '/client.js') asset = ['text/javascript', fs.readFileSync(path.join(__dirname, '../dist/client.js'))]
  if (!asset) { res.writeHead(404); res.end(); return }
  res.setHeader('Content-Type', asset[0]); res.end(asset[1])
})
server.listen(0, '127.0.0.1', () => console.log('DSH settings verification: http://127.0.0.1:' + server.address().port))
process.on('SIGINT', () => server.close(() => process.exit(0)))
