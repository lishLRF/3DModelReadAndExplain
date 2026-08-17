/**
 * Minimal structural types for the DSH client runtime services this plugin
 * consumes. These are declared locally (not imported from `@deepseek-ai/*`)
 * so the browser bundle has no cross-plugin value imports and builds without
 * the monorepo toolchain; the real services satisfy these shapes at runtime.
 */

export interface SessionInputState {
  draft: string
}

export interface SessionInput {
  state: { getSnapshot(): SessionInputState }
  setDraft(text: string): void
}

export interface IConversation {
  input: { for(actx: AgentContext): SessionInput }
  send(text: string): Promise<void>
}

export interface AgentContext {
  get<T = unknown>(name: string): T | undefined
}

export interface SessionListSnapshot {
  current?: string
}

export interface ISessions {
  list: { getSnapshot(): SessionListSnapshot }
  scope(id: string): AgentContext | undefined
}

export interface ISlots {
  inject(key: string, callback: () => (() => void) | void): () => void
  register(options: Record<string, unknown>, component: unknown): () => void
}

export interface ILocale {
  register(ns: string, dicts: Record<string, Record<string, string>>): () => void
}

export interface ClientContext {
  sessions: ISessions
  slots: ISlots
  locale: ILocale
  get<T = unknown>(name: string): T | undefined
  effect(fn: () => (() => void) | void, label?: string): void
}
