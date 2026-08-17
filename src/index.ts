/**
 * Host half of dsh-3d-model-viewer.
 *
 * Two contributions:
 *
 * 1. The translator library — `translateFromBytes`/`translateObj`/`translateStl`
 *    plus the standardized document schema, re-exported here so other packages
 *    and the `read_3d_model` tool share one implementation.
 *
 * 2. The `read_3d_model` model tool — lets the agent translate an OBJ/STL file
 *    on disk into the standardized LLM-readable JSON without the viewer. The
 *    tool is registered through `ctx.get('tools')` (optional), so a deployment
 *    without the tools registry simply skips it.
 *
 * The plugin has NO runtime dependency on the DSH monorepo: it reads files with
 * `node:fs` and reaches the tools registry through the context.
 */

import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'

import { quantize, stringifyDocument } from './schema'
import {
  detectFormat,
  StepRequiresBrowserError,
  translateFromBytes,
} from './parse/index'

export * from './schema'
export * from './analyze'
export * from './parse/obj'
export * from './parse/stl'
export * from './parse/step'
export * from './parse/index'

export const name = 'dsh-3d-model-viewer'

const MAX_MODEL_BYTES = 64 * 1024 * 1024

/** Minimal structural view of the Cordis host context this plugin uses. */
export interface HostContext {
  get<T = unknown>(name: string): T | undefined
  effect(fn: () => (() => void) | void, label?: string): void
}

interface ToolParameterSchema {
  type: string
  required?: boolean
  description?: string
}

interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, ToolParameterSchema>
  output: {
    schema: { type: string }
    render: (args: unknown, value: string) => Array<{ type: 'text'; text: string }>
  }
  execute(args: { path?: string; quantizeDecimals?: number }): Promise<string>
}

interface ToolRegistry {
  register(definition: ToolDefinition): () => void
}

function readModelTool(): ToolDefinition {
  return {
    name: 'read_3d_model',
    description:
      'Read a 3D model file (OBJ or STL) from disk and translate it into the standardized, ' +
      'LLM-readable 3D JSON document. Returns geometry (bounds, parts, vertices, indices) a ' +
      'language model can reason about directly. STEP (.stp/.step) files must be opened in the ' +
      'web viewer instead.',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the .obj or .stl file to translate.',
      },
      quantizeDecimals: {
        type: 'number',
        required: false,
        description: 'Decimal places used to round geometry floats. Default 4; lower (e.g. 2) yields smaller output.',
      },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args) {
      const path = String(args.path ?? '').trim()
      if (path === '') return 'error: path is required'

      let bytes: Uint8Array
      try {
        const buffer = await readFile(path)
        bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
      } catch (error) {
        return `error reading file "${path}": ${error instanceof Error ? error.message : String(error)}`
      }

      if (bytes.byteLength > MAX_MODEL_BYTES) {
        return `error: file is ${bytes.byteLength} bytes, over the ${MAX_MODEL_BYTES} byte limit`
      }

      try {
        const doc = translateFromBytes(bytes, path, { name: basename(path), units: 'unknown' })
        const decimals = args.quantizeDecimals === undefined ? undefined : Number(args.quantizeDecimals)
        if (decimals !== undefined && Number.isFinite(decimals)) quantize(doc, decimals)
        const format = detectFormat(path)
        const header =
          `# 3D model "${basename(path)}" (${format})\n` +
          `# Standardized LLM-readable document (${doc.schema})\n` +
          `# parts=${doc.summary.partCount} vertices=${doc.summary.vertexCount} triangles=${doc.summary.triangleCount}\n` +
          `# bounds=${JSON.stringify(doc.bounds)}\n\n`
        return header + stringifyDocument(doc)
      } catch (error) {
        if (error instanceof StepRequiresBrowserError) {
          return 'error: STEP files require the web viewer (WASM tessellation). Open the file in the DSH web UI 3D viewer, then use the "Send to AI" button.'
        }
        return `error translating model: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  }
}

export function apply(ctx: HostContext): void {
  const tools = ctx.get<ToolRegistry>('tools')
  if (tools === undefined || typeof tools.register !== 'function') return
  ctx.effect(() => tools.register(readModelTool()), 'dsh-3d-model-viewer: read_3d_model tool')
}
