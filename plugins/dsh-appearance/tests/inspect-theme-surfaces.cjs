// Read-only evidence for selectors and CSS in the installed compatibility baseline.
const { installedHost } = require('./installed-host.cjs')
const app = installedHost()
for (const name of ['layout', 'chat', 'conversation', 'sidebar', 'settings-shell']) {
  const file = `dsh/node_modules/@deepseek-ai/dsh-client-ui-${name}/lib/client.js`
  const code = app.read(file)
  if (process.argv[2]) {
    const offset = code.indexOf(process.argv[2])
    if (offset >= 0) console.log(code.slice(Math.max(0, offset - 600), offset + 1000))
    continue
  }
  console.log('\n' + name)
  for (const match of code.matchAll(/(?:const css(?:\$\d+)?|var \w+_css_default) = ("(?:[^"\\]|\\.)*");/g)) {
    const css = JSON.parse(match[1])
    console.log([...css.matchAll(/[^{}]+\{[^{}]*(?:background|bg-base|sidebar-fill)[^{}]*\}/g)].map(m => m[0]).join('\n'))
  }
  console.log([...code.matchAll(/"data-[^"]+": [^\n]+/g)].map(m => m[0]).join('\n'))
}
app.close()
