/**
 * STEP (.stp/.step) adapter over `occt-import-js` (a WebAssembly port of
 * OpenCascade). STEP is a BREP solid format — tessellating it into triangles
 * needs a CAD kernel, which is why this path runs in the BROWSER (WASM), not
 * on the Host (Node). The Host `read_3d_model` tool reports STEP as requiring
 * the web viewer.
 *
 * This module is import-free on purpose: the caller passes the lazily-loaded
 * `occt-import-js` module in, so the Host build never pulls the WASM package.
 */

import type { RawMesh } from '../schema'

/** Minimal structural view of an occt-import-js result. */
export interface OcctResult {
  success: boolean
  message?: string
  triangles?: Float32Array | null
  triangleColors?: Uint8Array | null
  meshes?: Array<{
    name?: string
    attributes?: {
      position?: { array?: ArrayLike<number> }
      normal?: { array?: ArrayLike<number> }
    }
    index?: { array?: ArrayLike<number> }
  }>
}

/** Minimal structural view of the occt-import-js module surface we use. */
export interface OcctImportJs {
  ReadStepFile(content: string, params: unknown): OcctResult
  ReadBrepFile(content: ArrayBuffer, params: unknown): OcctResult
}

/** Convert an occt-import-js result into the intermediate RawMesh form. */
export function stepResultToMeshes(result: OcctResult): RawMesh[] {
  if (!result || result.success !== true) {
    throw new Error(result?.message ?? 'STEP import failed')
  }

  if (Array.isArray(result.meshes) && result.meshes.length > 0) {
    const meshes: RawMesh[] = []
    for (let i = 0; i < result.meshes.length; i++) {
      const mesh = result.meshes[i]
      const position = mesh.attributes?.position?.array
      const index = mesh.index?.array
      if (position == null || position.length === 0) continue
      meshes.push({
        name: mesh.name ?? `solid-${i}`,
        vertices: position,
        normals: mesh.attributes?.normal?.array ?? null,
        indices: index ?? null,
      })
    }
    if (meshes.length > 0) return meshes
  }

  if (result.triangles != null && result.triangles.length > 0) {
    return [{ triangles: result.triangles }]
  }

  throw new Error('STEP file produced no tessellated geometry')
}
