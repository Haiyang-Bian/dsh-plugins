/** Bounded, per-activation logger. Every OPFS batch is committed by close(). */
const OPFS_FILENAME = 'demo-sunset-theme.log'
const STORAGE_KEY = 'demo-sunset-theme:log'
const MAX_LINES = 500
const MAX_FILE_BYTES = 100 * 1024
const FLUSH_INTERVAL_MS = 250
const encoder = new TextEncoder()

interface LogSink {
  readonly label: string
  read(): Promise<string>
  write(text: string): Promise<void>
}

class OpfsSink implements LogSink {
  readonly label = 'opfs'
  constructor(private handle: FileSystemFileHandle) {}
  async read(): Promise<string> { return (await this.handle.getFile()).text() }
  async write(text: string): Promise<void> {
    const writable = await this.handle.createWritable()
    try {
      // This is a complete, bounded snapshot, not an append to an empty stream.
      await writable.write(text)
      await writable.close()
    } catch (error) {
      try { await writable.abort() } catch { /* already closed or errored */ }
      throw error
    }
  }
}

class LocalStorageSink implements LogSink {
  readonly label = 'localStorage'
  async read(): Promise<string> { return localStorage.getItem(STORAGE_KEY) || '' }
  async write(text: string): Promise<void> { localStorage.setItem(STORAGE_KEY, text) }
}

class ConsoleSink implements LogSink {
  readonly label = 'console'
  private text = ''
  async read(): Promise<string> { return this.text }
  async write(text: string): Promise<void> { this.text = text }
}

function clipLine(line: string, bytes: number): string {
  let low = 0
  let high = Math.min(line.length, bytes)
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (encoder.encode(line.slice(0, middle)).length <= bytes) low = middle
    else high = middle - 1
  }
  return line.slice(0, low).replace(/[\uD800-\uDBFF]$/, '')
}

function bound(lines: string[]): string[] {
  const result: string[] = []
  let bytes = 0
  for (let i = lines.length - 1; i >= 0 && result.length < MAX_LINES; i--) {
    let line = lines[i]
    if (!line) continue
    if (result.length === 0 && encoder.encode(line + '\n').length > MAX_FILE_BYTES) {
      line = clipLine(line, MAX_FILE_BYTES - 1)
    }
    const size = encoder.encode(line + '\n').length
    if (bytes + size > MAX_FILE_BYTES) break
    result.push(line)
    bytes += size
  }
  return result.reverse()
}

function parse(text: string): string[] {
  // Salvage logs produced by the previous broken seek/append implementation.
  return bound(text.replace(/\0/g, '').split(/\r?\n/))
}

function serialize(lines: string[]): string { return lines.length ? lines.join('\n') + '\n' : '' }

function describe(value: unknown): string {
  if (value instanceof Error) return value.message
  if (typeof value === 'string') return value
  try { return JSON.stringify(value) ?? String(value) }
  catch { return String(value) }
}

function format(message: string, args: unknown[]): string {
  let index = 0
  const text = message.replace(/%[%sd]/g, (placeholder) => {
    if (placeholder === '%%') return '%'
    if (index >= args.length) return placeholder
    const value = args[index++]
    return placeholder === '%d' ? String(Number(value)) : describe(value)
  })
  return (text + (index < args.length ? ' ' + args.slice(index).map(describe).join(' ') : ''))
    .replace(/[\r\n]+/g, '\\n')
}

// Serialize read/modify/write across activations in this bundle. Web Locks
// also coordinate independent bundles and tabs sharing the same origin.
let persistenceQueue: Promise<unknown> = Promise.resolve()
function withPersistenceLock<T>(work: () => Promise<T>): Promise<T> {
  const task = persistenceQueue.then(async (): Promise<T> => {
    if (navigator.locks) return await navigator.locks.request(STORAGE_KEY, work)
    return await work()
  })
  persistenceQueue = task.catch(() => undefined)
  return task
}

export class Log {
  private sink: LogSink | null = null
  private history: string[] = []
  private pending: string[] = []
  private queue: Promise<unknown> = Promise.resolve()
  private initialization: Promise<void> | null = null
  private disposal: Promise<void> | null = null
  private closing = false
  private flushTimer: number | null = null
  private listeners = new Set<() => void>()
  private downloads = new Map<string, number>()

  init(): Promise<void> {
    if (!this.initialization) this.initialization = this.enqueue(() => this.initialize())
    return this.initialization
  }

  log(message: string, ...args: unknown[]): void { this.record(false, message, args) }
  warn(message: string, ...args: unknown[]): void { this.record(true, message, args) }

  sinkLabel(): string { return this.sink?.label || 'initializing' }
  onSinkChange(listener: () => void): () => void {
    this.listeners.add(listener)
    listener()
    return () => { this.listeners.delete(listener) }
  }

  flush(): Promise<void> {
    if (this.closing) return this.disposal || Promise.resolve()
    this.clearFlushTimer()
    void this.init()
    return this.enqueue(() => this.drain())
  }

  readAll(): string[] { return bound([...this.history, ...this.pending]) }

  readPersisted(): Promise<string> {
    if (this.closing) return (this.disposal || Promise.resolve()).then(() => serialize(this.history))
    this.clearFlushTimer()
    void this.init()
    return this.enqueue(async () => {
      await this.drain()
      return serialize(this.history)
    })
  }

  async exportAsFile(): Promise<void> {
    if (this.closing) return
    const text = await this.readPersisted()
    if (this.closing) return
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a')
    try {
      a.href = url
      a.download = `demo-sunset-theme-${new Date().toISOString().slice(0, 10)}.log`
      document.body.appendChild(a)
      a.click()
      const timer = window.setTimeout(() => {
        URL.revokeObjectURL(url)
        this.downloads.delete(url)
      }, 1000)
      this.downloads.set(url, timer)
      this.log('log exported')
    } catch (error) {
      URL.revokeObjectURL(url)
      throw error
    } finally { a.remove() }
  }

  dispose(): Promise<void> {
    if (this.disposal) return this.disposal
    void this.init()
    this.closing = true
    this.clearFlushTimer()
    for (const [url, timer] of this.downloads) {
      clearTimeout(timer)
      URL.revokeObjectURL(url)
    }
    this.downloads.clear()
    this.disposal = this.enqueue(async () => {
      try { await this.drain() }
      finally { this.listeners.clear() }
    })
    return this.disposal
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const task = this.queue.then(work)
    this.queue = task.catch(() => undefined)
    return task
  }

  private setSink(sink: LogSink): void {
    this.sink = sink
    for (const listener of this.listeners) {
      try { listener() } catch (error) { console.warn('[demo-sunset-theme] log listener failed', error) }
    }
  }

  private async initialize(): Promise<void> {
    try {
      if (navigator.storage?.getDirectory) {
        const root = await navigator.storage.getDirectory()
        const sink = new OpfsSink(await root.getFileHandle(OPFS_FILENAME, { create: true }))
        this.history = parse(await sink.read())
        this.setSink(sink)
        return
      }
    } catch (error) { console.warn('[demo-sunset-theme] OPFS unavailable', error) }
    await this.fallback()
  }

  private async fallback(seed?: string): Promise<void> {
    if (this.sink?.label !== 'localStorage') {
      try {
        const sink = new LocalStorageSink()
        const existing = await sink.read()
        if (seed !== undefined) await sink.write(seed)
        this.history = parse(seed ?? existing)
        this.setSink(sink)
        return
      } catch (error) { console.warn('[demo-sunset-theme] localStorage unavailable', error) }
    }
    const sink = new ConsoleSink()
    await sink.write(seed ?? serialize(this.history))
    this.setSink(sink)
  }

  private record(warning: boolean, message: string, args: unknown[]): void {
    if (this.closing) return
    const line = `[${new Date().toISOString()}] ${warning ? 'WARN ' : ''}${format(message, args)}`
    this.pending = bound([...this.pending, line])
    if (warning) console.warn(line)
    else if (!this.sink || this.sink.label === 'console') console.log(line)
    if (this.flushTimer === null) {
      this.flushTimer = window.setTimeout(() => {
        this.flushTimer = null
        void this.flush().catch((error) => console.warn('[demo-sunset-theme] flush failed', error))
      }, FLUSH_INTERVAL_MS)
    }
  }

  private clearFlushTimer(): void {
    if (this.flushTimer !== null) clearTimeout(this.flushTimer)
    this.flushTimer = null
  }

  private async drain(): Promise<void> {
    const batch = this.pending
    this.pending = []
    let merged = false
    try {
      await withPersistenceLock(async () => {
        const raw = await this.sink!.read()
        this.history = bound([...parse(raw), ...batch])
        merged = true
        const text = serialize(this.history)
        if (batch.length || text !== raw) await this.sink!.write(text)
      })
    } catch (error) {
      console.warn('[demo-sunset-theme] log storage failed', error)
      if (!merged) this.history = bound([...this.history, ...batch])
      await this.fallback(serialize(this.history))
      if (this.sink?.label === 'console') for (const line of batch) console.log(line)
    }
  }
}
