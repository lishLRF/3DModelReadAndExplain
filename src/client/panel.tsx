/**
 * The floating viewer panel: header, three.js canvas, material/light/section
 * controls, and the "send to AI" actions. Registered into `shell.overlay`, so
 * it is an additive frame-wide surface — it never replaces shipped UI.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import type { ModelDocument } from '../schema'
import { DEFAULT_SETTINGS, SceneController } from './scene'
import type { SectionAxis, ViewerSettings } from './scene'
import { loadModelFile } from './load'
import { buildPromptBlock } from './send'
import css from './styles.module.css'

export interface SendResult {
  ok: boolean
  error?: string
}

/** Business face injected by the plugin's `apply` (captures the root ctx). */
export interface PanelFace {
  /** Append a prompt block to the current composer draft. */
  appendToDraft(text: string): SendResult
  /** Send a prompt block immediately as a queued turn. */
  sendNow(text: string): Promise<SendResult>
  /** Whether a session is currently open. */
  hasSession(): boolean
}

export interface PanelProps extends PanelFace {
  t: (key: string) => string
}

const AXES: SectionAxis[] = ['x', 'y', 'z']

function axisIndex(axis: SectionAxis): number {
  return axis === 'x' ? 0 : axis === 'y' ? 1 : 2
}

export function ViewerPanel({ t, appendToDraft, sendNow, hasSession }: PanelProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const sceneRef = useRef<SceneController | null>(null)
  const [doc, setDoc] = useState<ModelDocument | null>(null)
  const [minimized, setMinimized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [settings, setSettings] = useState<ViewerSettings>(DEFAULT_SETTINGS)
  const [dragging, setDragging] = useState(false)
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (canvasRef.current === null) return
    const controller = new SceneController(canvasRef.current)
    sceneRef.current = controller
    return () => {
      controller.dispose()
      sceneRef.current = null
    }
  }, [])

  const patch = useCallback((next: Partial<ViewerSettings>) => {
    setSettings(prev => ({ ...prev, ...next }))
  }, [])

  useEffect(() => {
    sceneRef.current?.setSettings(settings)
  }, [settings])

  const onLoad = useCallback(async (file: File) => {
    setError(null)
    setStatus(null)
    setDescription('')
    try {
      const model = await loadModelFile(file)
      setDoc(model)
      sceneRef.current?.load(model)
      const axis = settings.sectionAxis
      const center = model.bounds.center[axisIndex(axis)]
      patch({ sectionOffset: center })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [patch, settings.sectionAxis])

  const onPickFile = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file !== undefined) void onLoad(file)
    event.target.value = ''
  }, [onLoad])

  const onDrop = useCallback((event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file !== undefined) void onLoad(file)
  }, [onLoad])

  // 把人工输入的描述合并进文档（供发送/下载/复制使用）
  const currentDoc = useMemo<ModelDocument | null>(() => {
    if (doc === null) return null
    const trimmed = description.trim()
    if (trimmed === '') return doc
    return { ...doc, meta: { ...doc.meta, description: trimmed } }
  }, [doc, description])

  const doAppend = useCallback(() => {
    if (currentDoc === null) return
    const block = buildPromptBlock(currentDoc)
    const result = appendToDraft(block)
    setStatus(result.ok ? t('sent') : result.error ?? t('error'))
  }, [currentDoc, appendToDraft, t])

  const doSendNow = useCallback(async () => {
    if (currentDoc === null) return
    setStatus(t('sending'))
    const result = await sendNow(buildPromptBlock(currentDoc))
    setStatus(result.ok ? t('sent') : result.error ?? t('error'))
  }, [currentDoc, sendNow, t])

  const doDownload = useCallback(() => {
    if (currentDoc === null) return
    const blob = new Blob([JSON.stringify(currentDoc, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentDoc.meta.name ?? 'model'}.dsh3d.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [currentDoc])

  const doCopy = useCallback(async () => {
    if (currentDoc === null) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(currentDoc, null, 2))
      setStatus(t('copied'))
    } catch {
      setStatus(t('error'))
    }
  }, [currentDoc, t])

  const sectionRange = doc === null
    ? { min: -1, max: 1 }
    : { min: doc.bounds.min[axisIndex(settings.sectionAxis)], max: doc.bounds.max[axisIndex(settings.sectionAxis)] }

  const sessionOpen = hasSession()

  return (
    <section
      className={css.panel}
      data-dsh-3d-viewer
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <header className={css.header}>
        <span className={css.title}>{t('title')}</span>
        <div className={css.headerActions}>
          <button
            type="button"
            className={css.iconBtn}
            onClick={() => setMinimized(v => !v)}
            aria-label={minimized ? t('title') : t('title')}
            title={minimized ? 'Maximize' : 'Minimize'}
          >
            {minimized ? '□' : '–'}
          </button>
        </div>
      </header>

      {/* 始终挂载 content（不随最小化卸载），否则收起再展开时 three.js 画布会变成空白 */}
      <div className={`${css.content} ${minimized ? css.collapsed : ''}`}>
        <div className={`${css.canvas} ${dragging ? css.dragging : ''}`} ref={canvasRef}>
            {doc === null && (
              <div className={css.empty}>
                <div className={css.emptyTitle}>{t('empty')}</div>
                <div className={css.emptyHint}>{t('emptyHint')}</div>
              </div>
            )}
          </div>

          {error !== null && <div className={css.error} role="alert">{error}</div>}

          <div className={css.toolbar}>
            <button type="button" className={css.primary} onClick={() => fileRef.current?.click()}>
              {t('load')}
            </button>
            <span className={css.hint}>{t('loadHint')}</span>
            <input
              ref={fileRef}
              type="file"
              accept=".obj,.stl,.stp,.step"
              className={css.fileInput}
              onChange={onPickFile}
            />
          </div>

          {doc !== null && (
            <>
              <div className={css.stats}>
                <span>
                  {t('stats')}: {doc.summary.partCount} parts · {doc.summary.vertexCount} verts · {doc.summary.triangleCount} tris
                </span>
              </div>

              <label className={css.descBlock}>
                <span className={css.descLabel}>{t('description')}</span>
                <textarea
                  className={css.descInput}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('descriptionHint')}
                  rows={3}
                />
              </label>

              <details open>
                <summary>{t('material')}</summary>
                <div className={css.controls}>
                  <label className={css.row}>
                    <span>{t('color')}</span>
                    <input
                      type="color"
                      value={settings.color}
                      onChange={(e) => patch({ color: e.target.value })}
                    />
                  </label>
                  <label className={css.row}>
                    <span>{t('metalness')}</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={settings.metalness}
                      onChange={(e) => patch({ metalness: Number(e.target.value) })}
                    />
                  </label>
                  <label className={css.row}>
                    <span>{t('roughness')}</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={settings.roughness}
                      onChange={(e) => patch({ roughness: Number(e.target.value) })}
                    />
                  </label>
                  <label className={css.row}>
                    <span>{t('opacity')}</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={settings.opacity}
                      onChange={(e) => patch({ opacity: Number(e.target.value) })}
                    />
                  </label>
                  <label className={css.check}>
                    <input
                      type="checkbox"
                      checked={settings.wireframe}
                      onChange={(e) => patch({ wireframe: e.target.checked })}
                    />
                    <span>{t('wireframe')}</span>
                  </label>
                </div>
              </details>

              <details open>
                <summary>{t('lighting')}</summary>
                <div className={css.controls}>
                  <label className={css.row}>
                    <span>{t('ambient')}</span>
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.05}
                      value={settings.ambientIntensity}
                      onChange={(e) => patch({ ambientIntensity: Number(e.target.value) })}
                    />
                  </label>
                  <label className={css.row}>
                    <span>{t('key')}</span>
                    <input
                      type="range"
                      min={0}
                      max={3}
                      step={0.05}
                      value={settings.keyIntensity}
                      onChange={(e) => patch({ keyIntensity: Number(e.target.value) })}
                    />
                  </label>
                </div>
              </details>

              <details open>
                <summary>{t('section')}</summary>
                <div className={css.controls}>
                  <label className={css.check}>
                    <input
                      type="checkbox"
                      checked={settings.sectionEnabled}
                      onChange={(e) => patch({ sectionEnabled: e.target.checked })}
                    />
                    <span>{t('sectionOn')}</span>
                  </label>
                  <div className={css.axisGroup}>
                    <span>{t('sectionAxis')}</span>
                    {AXES.map(axis => (
                      <button
                        key={axis}
                        type="button"
                        className={`${css.axis} ${settings.sectionAxis === axis ? css.axisActive : ''}`}
                        onClick={() => {
                          const center = doc.bounds.center[axisIndex(axis)]
                          patch({ sectionAxis: axis, sectionOffset: center })
                        }}
                      >
                        {axis.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <label className={css.row}>
                    <span>{t('sectionOffset')}</span>
                    <input
                      type="range"
                      min={sectionRange.min}
                      max={sectionRange.max}
                      step={(sectionRange.max - sectionRange.min) / 200}
                      value={settings.sectionOffset}
                      onChange={(e) => patch({ sectionOffset: Number(e.target.value) })}
                    />
                  </label>
                </div>
              </details>

              <div className={css.actions}>
                <button type="button" className={css.secondary} onClick={() => sceneRef.current?.resetView()}>
                  {t('resetView')}
                </button>
                <button type="button" className={css.secondary} onClick={doDownload}>
                  {t('downloadJson')}
                </button>
                <button type="button" className={css.secondary} onClick={() => void doCopy()}>
                  {t('copyJson')}
                </button>
              </div>

              <div className={css.sendRow}>
                <button
                  type="button"
                  className={css.primary}
                  disabled={!sessionOpen}
                  onClick={doAppend}
                  title={sessionOpen ? undefined : t('noSession')}
                >
                  {t('sendToAi')}
                </button>
                <button
                  type="button"
                  className={css.primary}
                  disabled={!sessionOpen}
                  onClick={() => void doSendNow()}
                  title={sessionOpen ? undefined : t('noSession')}
                >
                  {t('sendNow')}
                </button>
              </div>
            </>
          )}

          {status !== null && <div className={css.status} role="status">{status}</div>}
      </div>
    </section>
  )
}

export type { ViewerSettings, SectionAxis }
