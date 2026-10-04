const test = require('node:test')
const assert = require('node:assert/strict')
const { environment } = require('./helpers.cjs')
const key = 'demo-sunset-theme:log'

test('OPFS flush commits historical and new lines; export uses the actual sink', async () => {
  const env = environment({ opfs: true, opfsContent: 'HISTORICAL\n', store: new Map([[key, 'STALE_LOCAL_STORAGE']]) })
  const log = new (env.load('log.ts').Log)()
  const labels = []
  const unsubscribe = log.onSinkChange(() => labels.push(log.sinkLabel()))
  log.log('MARKER %s %d', 'new', 2)
  await log.flush()
  assert.match(env.opfs.content, /HISTORICAL\n/)
  assert.match(env.opfs.content, /MARKER new 2/)
  assert.equal(env.opfs.active, 0)
  assert.deepEqual(labels, ['initializing', 'opfs'])
  await log.exportAsFile()
  const text = await env.downloads[0].text()
  assert.match(text, /HISTORICAL/)
  assert.match(text, /MARKER new 2/)
  assert.doesNotMatch(text, /STALE_LOCAL_STORAGE|%s|%d|\0/)
  unsubscribe()
  await log.dispose()
  assert.equal(env.timers.size, 0)
  assert.equal(env.blobs.size, 0)
})

test('periodic flush commits without waiting for plugin unload', async () => {
  const env = environment({ opfs: true })
  const log = new (env.load('log.ts').Log)()
  await log.init()
  log.log('periodic')
  env.runTimers()
  await log.flush()
  assert.match(env.opfs.content, /periodic/)
  assert.ok(env.opfs.commits > 0)
  await log.dispose()
})

test('multiple activations serialize OPFS writes without losing either batch', async () => {
  const env = environment({ opfs: true })
  const { Log } = env.load('log.ts')
  const first = new Log()
  const second = new Log()
  first.log('FIRST')
  second.log('SECOND')
  await Promise.all([first.flush(), second.flush(), first.flush()])
  assert.match(env.opfs.content, /FIRST/)
  assert.match(env.opfs.content, /SECOND/)
  assert.equal(env.opfs.maxActive, 1)
  await first.dispose()
  second.log('STILL_ACTIVE')
  await second.flush()
  assert.match(env.opfs.content, /STILL_ACTIVE/)
  await second.dispose()
})

test('concurrent exports are complete and their download resources are released', async () => {
  const env = environment({ opfs: true })
  const log = new (env.load('log.ts').Log)()
  log.log('export marker')
  await Promise.all([log.exportAsFile(), log.exportAsFile()])
  assert.equal(env.downloads.length, 2)
  for (const blob of env.downloads) assert.match(await blob.text(), /export marker/)
  await log.dispose()
  await log.dispose()
  assert.equal(env.blobs.size, 0)
  assert.equal(env.timers.size, 0)
})

test('export racing disposal is canceled without creating a dangling download', async () => {
  const env = environment({ opfs: true })
  const log = new (env.load('log.ts').Log)()
  log.log('shutdown marker')
  await Promise.all([log.exportAsFile(), log.dispose()])
  assert.equal(env.downloads.length, 0)
  assert.match(env.opfs.content, /shutdown marker/)
  assert.equal(env.opfs.active, 0)
  assert.equal(env.timers.size, 0)
})

test('slow initialization can be disposed while a new logger remains usable', async () => {
  const env = environment({ opfs: true })
  const original = env.sandbox.navigator.storage.getDirectory
  let resolve
  const gate = new Promise((done) => { resolve = done })
  let calls = 0
  env.sandbox.navigator.storage.getDirectory = async () => { if (++calls === 1) await gate; return original() }
  const { Log } = env.load('log.ts')
  const old = new Log()
  old.log('old session')
  void old.init()
  const closing = old.dispose()
  const fresh = new Log()
  fresh.log('fresh session')
  await fresh.flush()
  resolve()
  await closing
  old.log('IGNORED_AFTER_CLOSE')
  fresh.log('fresh survives')
  await fresh.dispose()
  assert.match(env.opfs.content, /old session/)
  assert.match(env.opfs.content, /fresh session/)
  assert.match(env.opfs.content, /fresh survives/)
  assert.doesNotMatch(env.opfs.content, /IGNORED_AFTER_CLOSE/)
})

for (const fault of ['write', 'read', 'close']) {
  test('OPFS ' + fault + ' failure preserves data in localStorage', async () => {
    const env = environment({ opfs: true, opfsContent: 'history\n' })
    const log = new (env.load('log.ts').Log)()
    await log.init()
    env.opfs[fault] = true
    log.log('current')
    await log.flush()
    assert.equal(log.sinkLabel(), 'localStorage')
    assert.match(env.store.get(key), /history/)
    assert.match(env.store.get(key), /current/)
    assert.equal((env.store.get(key).match(/current/g) || []).length, 1)
    await log.dispose()
    assert.equal(env.opfs.active, 0)
  })
}

test('OPFS initialization failure uses persisted localStorage history', async () => {
  const env = environment({ opfs: true, opfsFaults: { read: true }, store: new Map([[key, 'local history\n']]) })
  const log = new (env.load('log.ts').Log)()
  log.log('after fallback')
  await log.flush()
  assert.equal(log.sinkLabel(), 'localStorage')
  assert.match(await log.readPersisted(), /local history/)
  await log.dispose()
})

test('disabled storage and quota failures retain exportable memory logs', async () => {
  for (const storageFaults of [{ read: true, write: true }, { write: true }]) {
    const env = environment({ storageFaults })
    const log = new (env.load('log.ts').Log)()
    log.log('in memory')
    await log.flush()
    assert.equal(log.sinkLabel(), 'console')
    await log.exportAsFile()
    assert.match(await env.downloads[0].text(), /in memory/)
    await log.dispose()
  }
})

test('logs stay within both the line and UTF-8 byte limits', async () => {
  const env = environment({ opfs: true, opfsContent: '\0\0legacy\n' })
  const log = new (env.load('log.ts').Log)()
  for (let i = 0; i < 600; i++) log.log('entry %d', i)
  await log.flush()
  assert.equal(env.opfs.content.trim().split('\n').length, 500)
  assert.match(env.opfs.content, /entry 599/)
  assert.doesNotMatch(env.opfs.content, /entry 0\n|\0/)
  log.log('字'.repeat(50000))
  await log.flush()
  assert.ok(Buffer.byteLength(env.opfs.content) <= 100 * 1024)
  assert.doesNotMatch(env.opfs.content, /\uFFFD/)
  assert.ok(log.readAll().length <= 500)
  await log.dispose()
})

test('fallback after a failed read preserves repeated identical lines', async () => {
  const env = environment({ opfs: true })
  env.sandbox.Date = class extends Date { constructor() { super('2026-10-04T00:00:00Z') } }
  const log = new (env.load('log.ts').Log)()
  log.log('repeat')
  await log.flush()
  env.opfs.read = true
  log.log('repeat')
  await log.flush()
  assert.equal((env.store.get(key).match(/repeat/g) || []).length, 2)
  await log.dispose()
})

test('missing Web Locks still serializes instances in the same bundle', async () => {
  const env = environment({ opfs: true })
  delete env.sandbox.navigator.locks
  const { Log } = env.load('log.ts')
  const logs = [new Log(), new Log()]
  logs[0].log('one')
  logs[1].log('two')
  await Promise.all(logs.map((log) => log.dispose()))
  assert.match(env.opfs.content, /one/)
  assert.match(env.opfs.content, /two/)
  assert.equal(env.opfs.maxActive, 1)
})
