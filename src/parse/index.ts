/**
 * Format detection and Host-side translation dispatch.
 *
 * OBJ and STL are parsed natively on both Host and Client. STEP requires the
 * browser WASM backend and is therefore handled on the Client only; the Host
 * reports a clear error so the agent knows to open the web viewer.
 */

import { buildDocument } from '../schema'
import type { ModelDocument, SourceFormat, TranslateOptions } from '../schema'
import { parseObj } from './obj'
import { parseStl, parseStlText } from './stl'

const EXTENSIONS: Record<string, SourceFormat> = {
  obj: 'obj',
  stl: 'stl',
  step: 'step',
  stp: 'step',
}

/** Infer the source format from a filename or extension. */
export function detectFormat(filename: string | undefined): SourceFormat {
  if (filename === undefined) return 'unknown'
  const dot = filename.lastIndexOf('.')
  if (dot < 0) return 'unknown'
  const ext = filename.slice(dot + 1).toLowerCase()
  return EXTENSIONS[ext] ?? 'unknown'
}

/** Raised when a format can only be translated in the browser viewer. */
export class StepRequiresBrowserError extends Error {
  readonly format = 'step' as const

  constructor() {
    super('STEP files require the browser viewer (WASM tessellation); open the model in the web UI instead')
    this.name = 'StepRequiresBrowserError'
  }
}

/** Translate an OBJ file's text into the standardized document. */
export function translateObj(text: string, options: TranslateOptions = {}): ModelDocument {
  return buildDocument('obj', parseObj(text), options)
}

/** Translate an STL file's bytes (ASCII or binary) into the standardized document. */
export function translateStl(data: Uint8Array, options: TranslateOptions = {}): ModelDocument {
  return buildDocument('stl', [parseStl(data)], options)
}

/** Translate an STL file already decoded as ASCII text. */
export function translateStlText(text: string, options: TranslateOptions = {}): ModelDocument {
  return buildDocument('stl', [parseStlText(text)], options)
}

/**
 * Translate a model file from raw bytes, dispatching on the filename's
 * extension. Throws `StepRequiresBrowserError` for STEP (Host-only path).
 */
export function translateFromBytes(
  bytes: Uint8Array,
  filename: string | undefined,
  options: TranslateOptions = {},
): ModelDocument {
  const format = detectFormat(filename)
  switch (format) {
    case 'obj':
      return translateObj(new TextDecoder().decode(bytes), { name: filename, ...options })
    case 'stl':
      return translateStl(bytes, { name: filename, ...options })
    case 'step':
      throw new StepRequiresBrowserError()
    default:
      throw new Error(`unsupported 3D model format${filename === undefined ? '' : ` for "${filename}"`}`)
  }
}
