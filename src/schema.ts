/**
 * The standardized, LLM-readable 3D model document.
 *
 * Every supported source format (OBJ, STL, STEP) is translated into this one
 * JSON shape so a language model — or any other consumer — can reason about a
 * 3D model without a CAD kernel or a viewer. The shape is deliberately:
 *
 *   • semantic  — keys describe WHAT a value is, not how a file stored it;
 *   • compact   — geometry is flat number arrays (no per-vertex objects);
 *   • indexed   — triangles share vertices via an index buffer, so shared
 *                 topology is expressed once.
 *
 * See docs/SCHEMA.md for the normative description and a JSON Schema.
 */

import { analyzeDocument } from './analyze'
import type { ModelAnalysis } from './analyze'

export const SCHEMA_ID = 'dsh-3d-model/v1'

export type SourceFormat = 'obj' | 'stl' | 'step' | 'unknown'

export type Vec3 = [number, number, number]

export interface Bounds {
  min: Vec3
  max: Vec3
  size: Vec3
  center: Vec3
  /** Bounding-sphere radius around `center`. */
  radius: number
}

export interface MaterialDescriptor {
  id: string
  name?: string
  /** `#rrggbb` hex string. */
  color: string
  metalness?: number
  roughness?: number
  opacity?: number
}

export interface ModelPart {
  id: string
  name?: string
  /** Material id from the document's `materials` list. */
  material?: string
  /** Flat position buffer: `[x0, y0, z0, x1, y1, z1, …]`. */
  vertices: number[]
  /** Flat per-vertex normal buffer, same length as `vertices`. */
  normals?: number[]
  /** Triangle index buffer; every three entries form one triangle. */
  indices: number[]
}

export interface ModelDocument {
  schema: typeof SCHEMA_ID
  meta: {
    sourceFormat: SourceFormat
    name?: string
    /** Human-provided description of the model (optional). */
    description?: string
    /** Best-effort unit name (e.g. `mm`, `m`, `unknown`). */
    units: string
    generator: string
    generatedAt: string
  }
  bounds: Bounds
  summary: {
    partCount: number
    vertexCount: number
    triangleCount: number
    materialCount: number
  }
  materials: MaterialDescriptor[]
  parts: ModelPart[]
  /** Semantic analysis: surface/volume/watertightness/shape + a description. */
  analysis: ModelAnalysis
}

/** A parsed mesh in an intermediate, source-agnostic form. */
export interface RawMesh {
  name?: string
  material?: string
  /** Indexed form: shared vertices. */
  vertices?: ArrayLike<number>
  normals?: ArrayLike<number> | null
  indices?: ArrayLike<number> | null
  /** Non-indexed form: 9 numbers per triangle (3 vertices × xyz). */
  triangles?: ArrayLike<number> | null
  /** Optional flat per-vertex colors, ignored by the document for now. */
  colors?: ArrayLike<number> | null
}

export interface TranslateOptions {
  /** Unit name recorded in `meta.units`. */
  units?: string
  /** Optional display name for the source file. */
  name?: string
  /** Optional material palette to attach. */
  materials?: MaterialDescriptor[]
}

const GENERATOR = 'dsh-3d-model-viewer'

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/** Round every geometry float to `decimals` places to keep the JSON small. */
export function quantize(doc: ModelDocument, decimals = 4): ModelDocument {
  const q = (n: number): number => {
    if (!Number.isFinite(n)) return 0
    return decimals > 0 ? roundTo(n, decimals) : n
  }
  const qVec = (v: number[]): number[] => v.map(q)
  doc.bounds.min = qVec(doc.bounds.min) as Vec3
  doc.bounds.max = qVec(doc.bounds.max) as Vec3
  doc.bounds.size = qVec(doc.bounds.size) as Vec3
  doc.bounds.center = qVec(doc.bounds.center) as Vec3
  doc.bounds.radius = q(doc.bounds.radius)
  for (const part of doc.parts) {
    part.vertices = qVec(part.vertices)
    if (part.normals !== undefined) part.normals = qVec(part.normals)
  }
  return doc
}

export function computeBounds(vertices: ArrayLike<number>): Bounds {
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i + 2 < vertices.length; i += 3) {
    for (let axis = 0; axis < 3; axis++) {
      const v = vertices[i + axis]
      if (v < min[axis]) min[axis] = v
      if (v > max[axis]) max[axis] = v
    }
  }
  if (!Number.isFinite(min[0])) {
    const zero: Vec3 = [0, 0, 0]
    return { min: zero, max: zero, size: zero, center: zero, radius: 0 }
  }
  const size: Vec3 = [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
  const center: Vec3 = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ]
  const radius = Math.sqrt(size[0] ** 2 + size[1] ** 2 + size[2] ** 2) / 2
  return { min, max, size, center, radius }
}

/** Deduplicate non-indexed triangle soup into shared vertices + indices. */
function indexTriangles(triangles: ArrayLike<number>): { vertices: number[]; indices: number[] } {
  const vertices: number[] = []
  const indices: number[] = []
  const lookup = new Map<string, number>()
  const triangleCount = Math.floor(triangles.length / 9)
  const keyScale = 1e6

  for (let t = 0; t < triangleCount; t++) {
    const base = t * 9
    for (let v = 0; v < 3; v++) {
      const o = base + v * 3
      const x = triangles[o]
      const y = triangles[o + 1]
      const z = triangles[o + 2]
      const key = `${Math.round(x * keyScale)}|${Math.round(y * keyScale)}|${Math.round(z * keyScale)}`
      let idx = lookup.get(key)
      if (idx === undefined) {
        idx = vertices.length / 3
        lookup.set(key, idx)
        vertices.push(x, y, z)
      }
      indices.push(idx)
    }
  }
  return { vertices, indices }
}

/** Normalize a RawMesh into the document's indexed `ModelPart` form. */
export function normalizeMesh(raw: RawMesh): Omit<ModelPart, 'id'> {
  let vertices: number[]
  let normals: number[] | undefined
  let indices: number[]

  if (raw.vertices != null && raw.indices != null) {
    vertices = Array.from(raw.vertices)
    const rawNormals = raw.normals != null ? Array.from(raw.normals) : undefined
    normals = rawNormals !== undefined && rawNormals.length === vertices.length ? rawNormals : undefined
    indices = Array.from(raw.indices)
  } else if (raw.triangles != null) {
    const indexed = indexTriangles(raw.triangles)
    vertices = indexed.vertices
    indices = indexed.indices
  } else {
    vertices = []
    indices = []
  }

  return {
    name: raw.name,
    material: raw.material,
    vertices,
    normals,
    indices,
  }
}

/** Build the final standardized document from one or more parsed meshes. */
export function buildDocument(
  format: SourceFormat,
  meshes: RawMesh[],
  options: TranslateOptions = {},
): ModelDocument {
  const parts: ModelPart[] = meshes.map((mesh, index) => ({
    id: `part-${index}`,
    ...normalizeMesh(mesh),
  }))

  const allVertices: number[] = []
  for (const part of parts) allVertices.push(...part.vertices)
  const bounds = computeBounds(allVertices)

  const triangleCount = parts.reduce((sum, part) => sum + Math.floor(part.indices.length / 3), 0)
  const vertexCount = parts.reduce((sum, part) => sum + Math.floor(part.vertices.length / 3), 0)
  const materials = options.materials ?? []

  const meta = {
    sourceFormat: format,
    name: options.name,
    units: options.units ?? 'unknown',
    generator: GENERATOR,
    generatedAt: new Date().toISOString(),
  }
  const analysis = analyzeDocument({ meta, bounds, parts })

  const doc: ModelDocument = {
    schema: SCHEMA_ID,
    meta,
    bounds,
    summary: {
      partCount: parts.length,
      vertexCount,
      triangleCount,
      materialCount: materials.length,
    },
    materials,
    parts,
    analysis,
  }

  return quantize(doc)
}

/** Serialize with stable key order and a trailing newline. */
export function stringifyDocument(doc: ModelDocument, pretty = true): string {
  const json = pretty ? JSON.stringify(doc, null, 2) : JSON.stringify(doc)
  return json
}
