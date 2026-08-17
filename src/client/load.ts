/**
 * Client-side model loading: browser File → standardized ModelDocument.
 * OBJ/STL are parsed in-thread; STEP runs through the lazy-loaded
 * occt-import-js WASM module.
 */

import { buildDocument, type ModelDocument } from '../schema'
import { detectFormat, translateObj, translateStl } from '../parse/index'
import { stepResultToMeshes, type OcctImportJs, type OcctResult } from '../parse/step'
// Statically imported so the browser bundle inlines the occt-import-js JS
// (a dynamic import would code-split, and the DSH client loader serves a
// single `client.js` per plugin). The WASM binary still loads lazily on the
// first STEP file.
import * as occtModule from 'occt-import-js'

/**
 * URL of the occt-import-js WASM binary. The bundled `client.js` cannot
 * co-locate the `.wasm`, so the default points at a pinned CDN build. Set this
 * to your own host (or serve the `.wasm` beside the bundle) for air-gapped
 * deployments. See README § "STEP (.stp/.step) 支持".
 */
export const STEP_WASM_URL =
  'https://cdn.jsdelivr.net/npm/occt-import-js@0.0.23/dist/occt-import-js.wasm'

type OcctFactory = (options?: { locateFile?: (path: string) => string }) => Promise<OcctImportJs>

/** Resolve the occt-import-js factory (the module's default/CJS export). */
function getFactory(): OcctFactory {
  const mod = occtModule as unknown as Record<string, unknown> & { default?: unknown }
  const candidate = mod.default ?? mod
  if (typeof candidate !== 'function') {
    throw new Error('occt-import-js: cannot resolve the factory function')
  }
  return candidate as OcctFactory
}

export class UnsupportedModelFormatError extends Error {
  constructor(filename: string) {
    super(`unsupported 3D model format for "${filename}" (supported: .obj, .stl, .step, .stp)`)
    this.name = 'UnsupportedModelFormatError'
  }
}

/** Load + translate a browser File into the standardized document. */
export async function loadModelFile(file: File): Promise<ModelDocument> {
  const format = detectFormat(file.name)
  const name = file.name

  switch (format) {
    case 'obj':
      return translateObj(await file.text(), { name, units: 'unknown' })
    case 'stl':
      return translateStl(new Uint8Array(await file.arrayBuffer()), { name, units: 'unknown' })
    case 'step':
      return translateStepFile(file, name)
    default:
      throw new UnsupportedModelFormatError(file.name)
  }
}

let occtReady: Promise<OcctImportJs> | null = null

/** Lazily initialize the occt-import-js WASM module (memoized). */
function ensureOcct(): Promise<OcctImportJs> {
  if (occtReady === null) {
    occtReady = getFactory()({ locateFile: () => STEP_WASM_URL })
  }
  return occtReady
}

/** Translate a STEP file through the occt-import-js WASM backend. */
export async function translateStepFile(file: File, name: string): Promise<ModelDocument> {
  let instance: OcctImportJs
  try {
    instance = await ensureOcct()
  } catch (error) {
    throw new Error(
      `STEP support could not be initialized (occt-import-js WASM): ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  const content = new Uint8Array(await file.arrayBuffer())
  let result: OcctResult
  try {
    result = instance.ReadStepFile(content, null)
  } catch (error) {
    throw new Error(`STEP import failed: ${error instanceof Error ? error.message : String(error)}`)
  }

  const meshes = stepResultToMeshes(result)
  return buildDocument('step', meshes, { name, units: 'unknown' })
}
