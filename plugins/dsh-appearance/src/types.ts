import type { SlotCore, SlotMap } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type * as React from 'react'

/** DSH services used here; registration uses the official slot types. */
export interface ClientContext {
  theme: ThemeRuntime
  slots: {
    register: SlotCore['register']
    inject(key: keyof SlotMap & string, callback: () => (() => void)): () => void | Promise<void>
  }
  effect(callback: () => (() => void | Promise<void>), label?: string): () => Promise<void>
  on(event: 'theme/change', listener: (snapshot: ThemeSnapshot) => void): () => void
}

export interface ThemeDefinition {
  id: string
  colorScheme: 'light' | 'dark'
  tokens: Record<string, string>
}

export interface ThemeSnapshot {
  preference: string
  fontSize: number
  active: ThemeDefinition
  themes: readonly ThemeDefinition[]
  revision: number
}

export interface ThemeRuntime {
  register(definition: ThemeDefinition): () => void
  getTheme(): ThemeSnapshot
  setTheme(id: string): void
  setFontSize(px: number): void
  overrideTokens(
    source: string,
    tokens: Record<string, { light: string; dark: string }>,
  ): () => void
}

/** Module-loader contract — DSH calls factory once at bundle activation. */
export interface ModuleLoaderEntry {
  name: string
  inject?: string[]
  apply(ctx: ClientContext): void
}

export interface ModuleLoader {
  load(opts: {
    id: string
    factory: (require: (id: 'react') => typeof React) => ModuleLoaderEntry
  }): void
}

declare global {
  interface Window {
    __ModuleLoader__: ModuleLoader
  }
}

export {}
