/**
 * Semantic analysis over the standardized model document.
 *
 * Turns raw triangle geometry into features a language model can actually
 * REASON about: surface area, volume, watertightness, boundary-edge count, a
 * coarse primitive classification (box / cylinder / sphere / planar /
 * freeform), and a compact natural-language description.
 *
 * The metrics are computed directly from the mesh (no CAD kernel):
 *
 *   • surface area  — exact sum of triangle areas;
 *   • signed volume — divergence theorem (meaningful only for closed,
 *     consistently-oriented meshes; pair it with `watertight`);
 *   • watertight    — no boundary edges (every edge shared by two triangles);
 *   • primitive     — heuristic from |volume| / bounding-box-volume ratio
 *     (box ≈ 1.0, cylinder ≈ π/4 ≈ 0.785, sphere ≈ π/6 ≈ 0.524).
 */

export type PrimitiveKind = 'box' | 'cylinder' | 'sphere' | 'torus' | 'planar' | 'freeform'

/** Minimal structural view of a model document that analysis needs. */
export interface AnalyzeInput {
  meta: { name?: string; units: string }
  bounds: { size: [number, number, number] }
  parts: Array<{ vertices: number[]; indices: number[] }>
}

export interface PartAnalysis {
  surfaceArea: number
  /** Signed volume; only meaningful when `watertight` is true. */
  volume: number
  watertight: boolean
  boundaryEdgeCount: number
  dimensions: [number, number, number]
  primitive: PrimitiveKind
  primitiveConfidence: number
}

export interface ModelAnalysis {
  partCount: number
  totalSurfaceArea: number
  totalVolume: number
  watertight: boolean
  parts: PartAnalysis[]
  naturalDescription: string
}

function round(value: number, decimals = 6): number {
  if (!Number.isFinite(value)) return 0
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function triangleArea(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number,
): number {
  const ux = bx - ax, uy = by - ay, uz = bz - az
  const vx = cx - ax, vy = cy - ay, vz = cz - az
  const nx = uy * vz - uz * vy
  const ny = uz * vx - ux * vz
  const nz = ux * vy - uy * vx
  return 0.5 * Math.sqrt(nx * nx + ny * ny + nz * nz)
}

export function surfaceAreaOf(vertices: ArrayLike<number>, indices: ArrayLike<number>): number {
  let area = 0
  const triangleCount = Math.floor(indices.length / 3)
  for (let t = 0; t < triangleCount; t++) {
    const i0 = indices[t * 3] * 3
    const i1 = indices[t * 3 + 1] * 3
    const i2 = indices[t * 3 + 2] * 3
    area += triangleArea(
      vertices[i0], vertices[i0 + 1], vertices[i0 + 2],
      vertices[i1], vertices[i1 + 1], vertices[i1 + 2],
      vertices[i2], vertices[i2 + 1], vertices[i2 + 2],
    )
  }
  return area
}

export function signedVolumeOf(vertices: ArrayLike<number>, indices: ArrayLike<number>): number {
  let volume = 0
  const triangleCount = Math.floor(indices.length / 3)
  for (let t = 0; t < triangleCount; t++) {
    const i0 = indices[t * 3] * 3
    const i1 = indices[t * 3 + 1] * 3
    const i2 = indices[t * 3 + 2] * 3
    const ax = vertices[i0], ay = vertices[i0 + 1], az = vertices[i0 + 2]
    const bx = vertices[i1], by = vertices[i1 + 1], bz = vertices[i1 + 2]
    const cx = vertices[i2], cy = vertices[i2 + 1], cz = vertices[i2 + 2]
    // v0 · (v1 × v2)
    volume += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)
  }
  return volume / 6
}

function edgeCounts(vertices: ArrayLike<number>, indices: ArrayLike<number>): Map<string, number> {
  // Key edges by GEOMETRIC POSITION (quantized), not vertex index: OBJ files
  // with per-face normals split a shared corner into multiple vertex indices,
  // yet the two triangles still share the same geometric edge.
  const scale = 1e6
  const posKey = (i: number): string => {
    const x = Math.round(vertices[i * 3] * scale)
    const y = Math.round(vertices[i * 3 + 1] * scale)
    const z = Math.round(vertices[i * 3 + 2] * scale)
    return `${x},${y},${z}`
  }
  const counts = new Map<string, number>()
  const triangleCount = Math.floor(indices.length / 3)
  const key = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`)
  for (let t = 0; t < triangleCount; t++) {
    const i0 = indices[t * 3]
    const i1 = indices[t * 3 + 1]
    const i2 = indices[t * 3 + 2]
    for (const [a, b] of [[i0, i1], [i1, i2], [i2, i0]] as const) {
      const k = key(posKey(a), posKey(b))
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
  }
  return counts
}

export function boundaryEdgeCountOf(vertices: ArrayLike<number>, indices: ArrayLike<number>): number {
  let boundary = 0
  for (const count of edgeCounts(vertices, indices).values()) if (count === 1) boundary += 1
  return boundary
}

/**
 * Topological genus of a CLOSED mesh (0 = sphere-like, 1 = torus, …), from the
 * Euler characteristic χ = V − E + F. Only meaningful when watertight.
 */
export function genusOf(vertices: ArrayLike<number>, indices: ArrayLike<number>): number {
  const V = Math.floor(vertices.length / 3)
  const F = Math.floor(indices.length / 3)
  const E = edgeCounts(vertices, indices).size
  const chi = V - E + F
  return Math.max(0, Math.round((2 - chi) / 2))
}

function classifyPrimitive(
  watertight: boolean,
  volume: number,
  dimensions: [number, number, number],
  genus: number,
): { primitive: PrimitiveKind; confidence: number } {
  const [dx, dy, dz] = dimensions
  const maxDim = Math.max(dx, dy, dz)
  const minDim = Math.min(dx, dy, dz)
  if (!watertight && (maxDim === 0 || minDim / maxDim < 0.05)) {
    return { primitive: 'planar', confidence: 0.9 }
  }
  if (!watertight) return { primitive: 'freeform', confidence: 0.3 }
  if (genus === 1) return { primitive: 'torus', confidence: 0.85 }
  if (genus > 1) return { primitive: 'freeform', confidence: 0.5 }

  const bboxVolume = dx * dy * dz
  if (bboxVolume <= 0) return { primitive: 'freeform', confidence: 0.3 }
  const ratio = Math.abs(volume) / bboxVolume
  if (ratio > 0.9) return { primitive: 'box', confidence: Math.min(1, ratio) }
  if (ratio > 0.7) return { primitive: 'cylinder', confidence: clamp(1 - Math.abs(0.785 - ratio) / 0.2) }
  if (ratio > 0.45) return { primitive: 'sphere', confidence: clamp(1 - Math.abs(0.524 - ratio) / 0.15) }
  return { primitive: 'freeform', confidence: 0.5 }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function dimensionsOf(vertices: ArrayLike<number>): [number, number, number] {
  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  for (let i = 0; i + 2 < vertices.length; i += 3) {
    const x = vertices[i], y = vertices[i + 1], z = vertices[i + 2]
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (z < minZ) minZ = z
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
    if (z > maxZ) maxZ = z
  }
  if (!Number.isFinite(minX)) return [0, 0, 0]
  return [maxX - minX, maxY - minY, maxZ - minZ]
}

export function analyzePart(vertices: ArrayLike<number>, indices: ArrayLike<number>): PartAnalysis {
  const triangleCount = Math.floor(indices.length / 3)
  const surfaceArea = surfaceAreaOf(vertices, indices)
  const volume = signedVolumeOf(vertices, indices)
  const boundaryEdgeCount = boundaryEdgeCountOf(vertices, indices)
  const watertight = triangleCount > 0 && boundaryEdgeCount === 0
  const genus = watertight ? genusOf(vertices, indices) : 0
  const dimensions = dimensionsOf(vertices)
  const { primitive, confidence } = classifyPrimitive(watertight, volume, dimensions, genus)
  return {
    surfaceArea: round(surfaceArea),
    volume: round(volume),
    watertight,
    boundaryEdgeCount,
    dimensions: dimensions.map(d => round(d)) as [number, number, number],
    primitive,
    primitiveConfidence: round(confidence),
  }
}

export function analyzeDocument(doc: AnalyzeInput): ModelAnalysis {
  const parts = doc.parts.map(part => analyzePart(part.vertices, part.indices))
  const totalSurfaceArea = parts.reduce((sum, part) => sum + part.surfaceArea, 0)
  const totalVolume = parts.reduce((sum, part) => sum + part.volume, 0)
  const watertight = parts.length > 0 && parts.every(part => part.watertight)
  const units = doc.meta.units !== undefined && doc.meta.units !== 'unknown' ? doc.meta.units : 'units'
  const name = doc.meta.name ?? 'unnamed model'
  const partWord = parts.length === 1 ? 'part' : 'parts'
  const primitiveSummary = parts.length === 1
    ? parts[0].primitive
    : `${parts.filter(p => p.primitive !== 'freeform').length}/${parts.length} parts classified`

  const dims = doc.bounds.size.map(d => round(d, 4)).join('×')
  const solidity = watertight ? `closed solid, volume ${round(Math.abs(totalVolume), 4)} ${units}³` : 'open mesh'
  const naturalDescription =
    `${name}: ${parts.length} ${partWord} (${primitiveSummary}), ` +
    `bounding box ${dims} ${units}, surface area ${round(totalSurfaceArea, 4)} ${units}², ${solidity}`

  return {
    partCount: parts.length,
    totalSurfaceArea: round(totalSurfaceArea),
    totalVolume: round(totalVolume),
    watertight,
    parts,
    naturalDescription,
  }
}
