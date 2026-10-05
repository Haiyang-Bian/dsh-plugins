const { createRequire } = require('node:module')
const path = require('node:path')
const Module = require('node:module')
const esbuild = createRequire(require.resolve('vite/package.json'))('esbuild')
module.exports = function load(name) {
  const entry = path.resolve(__dirname, '../src', name + '.ts')
  const code = esbuild.buildSync({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external' }).outputFiles[0].text
  const compiled = new Module(entry, module); compiled.filename = entry; compiled.paths = Module._nodeModulePaths(path.dirname(entry)); compiled._compile(code, entry)
  return compiled.exports
}
