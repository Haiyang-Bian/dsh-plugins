import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'

/** Stable source and snapshot identities between updates, for slot hooks. */
export function observable<T>(initial: T): HostObservable<T> & {
  publish(value: T): void
  dispose(): void
} {
  let snapshot = initial
  let disposed = false
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      if (disposed) return () => {}
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    publish(value) {
      if (disposed || Object.is(snapshot, value)) return
      snapshot = value
      for (const listener of [...listeners]) listener()
    },
    dispose() { disposed = true; listeners.clear() },
  }
}
