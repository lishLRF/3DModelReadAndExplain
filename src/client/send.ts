/**
 * Build the model-aware prompt block that the panel injects into the composer.
 * The block includes a human-readable summary plus the standardized JSON so a
 * language model can reason about the model without a viewer.
 */

import { stringifyDocument, type ModelDocument } from '../schema'

const fmtVec = (v: number[]): string => `[${v.map(n => Number(n.toFixed(3))).join(', ')}]`

export interface SendBlockOptions {
  /** The user's own prompt, placed above the model block. */
  prompt?: string
  /** Include the full JSON (false for summary-only). */
  includeJson?: boolean
  /** Hard cap on the JSON text length (truncates with a marker). */
  maxJsonChars?: number
}

export function buildPromptBlock(doc: ModelDocument, options: SendBlockOptions = {}): string {
  const { prompt, includeJson = true, maxJsonChars = 120_000 } = options
  const { summary, meta, bounds } = doc
  const format = meta.sourceFormat.toUpperCase()
  const name = meta.name ?? 'unnamed model'
  const units = meta.units && meta.units !== 'unknown' ? `, units: ${meta.units}` : ''

  const lines: string[] = []
  if (prompt !== undefined && prompt.trim() !== '') {
    lines.push(prompt.trim())
    lines.push('')
  }

  lines.push(`[3D model: ${name} (${format}${units})]`)
  lines.push('The following is a standardized, LLM-readable description of this 3D model.')
  lines.push(`Semantic analysis: ${doc.analysis.naturalDescription}.`)
  lines.push(
    `Summary: ${summary.partCount} part(s), ${summary.vertexCount} vertices, ` +
    `${summary.triangleCount} triangles.`,
  )
  lines.push(
    `Bounding box: min ${fmtVec(bounds.min)}, max ${fmtVec(bounds.max)}, ` +
    `size ${fmtVec(bounds.size)}, center ${fmtVec(bounds.center)}, radius ${bounds.radius.toFixed(3)}.`,
  )

  if (includeJson) {
    const json = stringifyDocument(doc, true)
    const trimmed = json.length > maxJsonChars
      ? `${json.slice(0, maxJsonChars)}\n… (truncated: ${json.length} characters total)`
      : json
    lines.push('')
    lines.push('```json')
    lines.push(trimmed)
    lines.push('```')
  }

  return lines.join('\n')
}
