// Optional installed-app evidence for browser integration; no archive changes.
const fs = require('node:fs')
const path = require('node:path')
function installedHost(archive = path.join(process.env.LOCALAPPDATA, 'Programs/DeepSeek Harness/resources/app.asar')) {
  const fd = fs.openSync(archive, 'r')
  const prefix = Buffer.alloc(16)
  fs.readSync(fd, prefix, 0, 16, 0)
  const headerSize = prefix.readUInt32LE(4)
  const header = Buffer.alloc(prefix.readUInt32LE(12))
  fs.readSync(fd, header, 0, header.length, 16)
  const index = JSON.parse(header.toString())
  const files = new Map()
  function walk(node, root = '') {
    for (const [name, item] of Object.entries(node.files || {})) {
      const file = root ? root + '/' + name : name
      if (item.files) walk(item, file)
      else files.set(file, item)
    }
  }
  walk(index)
  return {
    files,
    read(file) {
      const item = files.get(file)
      if (!item) throw new Error('Missing installed file ' + file)
      if (item.unpacked) return fs.readFileSync(archive + '.unpacked/' + file, 'utf8')
      const buffer = Buffer.alloc(item.size)
      fs.readSync(fd, buffer, 0, buffer.length, 8 + headerSize + Number(item.offset))
      return buffer.toString()
    },
    close: () => fs.closeSync(fd),
  }
}
module.exports = { installedHost }
if (require.main === module) {
  const app = installedHost()
  if (process.argv[2] === '--list') {
    console.log([...app.files.keys()].filter(file => new RegExp(process.argv[3]).test(file)).join('\n'))
    app.close(); return
  }
  if (process.argv[2]) {
    const source = app.read('dsh/node_modules/@deepseek-ai/' + process.argv[2] + '/lib/' + (process.argv[2] === 'dsh-client-ui-renderer' ? 'client.js' : 'index.js'))
    const offset = process.argv[3] ? source.indexOf(process.argv[3]) : 0
    console.log(source.slice(Math.max(0, offset - Number(process.argv[4] || 0)), Math.max(0, offset) + 2200))
    app.close()
    return
  }
  for (const name of ['dsh-client-ui-renderer', 'dsh-client-ui-slots', 'dsh-client-store']) {
    const source = app.read('dsh/node_modules/@deepseek-ai/' + name + '/lib/' + (name === 'dsh-client-ui-renderer' ? 'client.js' : 'index.js'))
    console.log(name, [...source.matchAll(/(?:let \w+ = require\("([^"]+)"\)|var (\w+) = class[^\n]*|exports\.(\w+) = [^;]*;)/g)].map(match => match[0]).join('\n'))
  }
  app.close()
}
