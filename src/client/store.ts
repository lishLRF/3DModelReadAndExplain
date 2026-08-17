/**
 * 查看器开关的共享状态（面板与设置页共用），持久化到 localStorage。
 */

import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'dsh-3d-model-viewer.enabled'

function readInitial(): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      const value = localStorage.getItem(STORAGE_KEY)
      return value === null ? true : value === '1'
    }
  } catch {
    /* ignore */
  }
  return true
}

let enabled = readInitial()
const listeners = new Set<() => void>()

export function isViewerEnabled(): boolean {
  return enabled
}

export function setViewerEnabled(value: boolean): void {
  enabled = value
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
    }
  } catch {
    /* ignore */
  }
  for (const listener of listeners) listener()
}

export function subscribeViewerEnabled(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** React hook：返回当前开关状态并订阅变化。 */
export function useViewerEnabled(): boolean {
  return useSyncExternalStore(subscribeViewerEnabled, isViewerEnabled)
}
