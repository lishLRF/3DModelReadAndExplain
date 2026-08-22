/**
 * Client half of dsh-3d-model-viewer.
 *
 * Registers the floating viewer panel into the additive `shell.overlay` slot
 * (frame-wide surface — it never replaces shipped UI) and injects the
 * "send to AI" business face, which reaches the current session's conversation
 * service through the sessions scope.
 */

import type { AgentContext, ClientContext, IConversation } from './dsh'
import { ViewerPanel } from './panel'
import type { PanelFace } from './panel'
import { ViewerSettingsCard } from './settings-card'
import { en, NS, zh } from './locales'

export const inject = ['slots', 'sessions', 'locale']

interface ResolvedConversation {
  conversation: IConversation
  scoped: AgentContext
}

function resolveConversation(ctx: ClientContext): ResolvedConversation | { error: string } {
  const current = ctx.sessions.list.getSnapshot().current
  if (current === undefined) return { error: 'no session is currently open' }
  const scoped = ctx.sessions.scope(current)
  if (scoped === undefined) return { error: 'session scope is unavailable' }
  const conversation = scoped.get<IConversation>('conversation')
  if (conversation === undefined || typeof conversation.input?.for !== 'function') {
    return { error: 'conversation service is unavailable' }
  }
  return { conversation, scoped }
}

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-3d-model-viewer: dictionaries')

  const face: PanelFace = {
    hasSession() {
      return ctx.sessions.list.getSnapshot().current !== undefined
    },

    appendToDraft(text) {
      const resolved = resolveConversation(ctx)
      if ('error' in resolved) return { ok: false, error: resolved.error }
      try {
        const input = resolved.conversation.input.for(resolved.scoped)
        const draft = input.state.getSnapshot().draft
        input.setDraft(draft.trim() === '' ? text : `${draft}\n\n${text}`)
        return { ok: true }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    },

    async sendNow(text) {
      const resolved = resolveConversation(ctx)
      if ('error' in resolved) return { ok: false, error: resolved.error }
      try {
        await resolved.conversation.send(text)
        return { ok: true }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    },
  }

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'dsh-3d-viewer',
    order: 100,
    locale: NS,
    inject: () => face,
  }, ViewerPanel))

  // 「设置 → 插件 → 配置」页里的插件卡片：查看器开关
  // 注意：新版本 DSH 该槽位已从 list 改为 keyed，注册字段用 key 而非 id/order。
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: 'dsh-3d-model-viewer',
    locale: NS,
  }, ViewerSettingsCard))
}
