/**
 * Wavefront OBJ parser (text). Pure, isomorphic — runs on Host (Node) and in
 * the browser. Produces indexed meshes with per-vertex normals when the file
 * carries `vn` records; polygons are fan-triangulated.
 */

import type { RawMesh } from '../schema'

interface MeshAccumulator {
  name?: string
  material?: string
  vertices: number[]
  normals: number[]
  indices: number[]
  lookup: Map<string, number>
  hasNormals: boolean
  missingNormals: boolean
}

function newAccumulator(name?: string, material?: string): MeshAccumulator {
  return {
    name,
    material,
    vertices: [],
    normals: [],
    indices: [],
    lookup: new Map(),
    hasNormals: false,
    missingNormals: false,
  }
}

/** Resolve an OBJ 1-based (or negative-relative) index into 0-based. */
function resolveIndex(raw: number, count: number): number {
  if (!Number.isFinite(raw) || raw === 0) return -1
  return raw > 0 ? raw - 1 : count + raw
}

function pushCorner(
  acc: MeshAccumulator,
  position: [number, number, number],
  normal: [number, number, number] | null,
): void {
  const key = `${position[0]}|${position[1]}|${position[2]}|${normal === null ? '-' : `${normal[0]}|${normal[1]}|${normal[2]}`}`
  let idx = acc.lookup.get(key)
  if (idx === undefined) {
    idx = acc.vertices.length / 3
    acc.lookup.set(key, idx)
    acc.vertices.push(position[0], position[1], position[2])
    if (normal !== null) acc.normals.push(normal[0], normal[1], normal[2])
    else acc.missingNormals = true
  }
  acc.indices.push(idx)
}

function parseFace(acc: MeshAccumulator, tokens: string[], positions: number[], normals: number[]): void {
  const corners: Array<{ p: [number, number, number]; n: [number, number, number] | null }> = []
  for (const token of tokens) {
    const parts = token.split('/')
    const pIndex = resolveIndex(Number(parts[0]), positions.length / 3)
    if (pIndex < 0) continue
    const position: [number, number, number] = [
      positions[pIndex * 3],
      positions[pIndex * 3 + 1],
      positions[pIndex * 3 + 2],
    ]
    let normal: [number, number, number] | null = null
    if (parts.length >= 3 && parts[2] !== '') {
      const nIndex = resolveIndex(Number(parts[2]), normals.length / 3)
      if (nIndex >= 0) {
        acc.hasNormals = true
        normal = [normals[nIndex * 3], normals[nIndex * 3 + 1], normals[nIndex * 3 + 2]]
      }
    }
    corners.push({ p: position, n: normal })
  }
  // Fan triangulation for polygons with more than three vertices.
  for (let i = 1; i + 1 < corners.length; i++) {
    for (const corner of [corners[0], corners[i], corners[i + 1]]) {
      pushCorner(acc, corner.p, corner.n)
    }
  }
}

export function parseObj(text: string): RawMesh[] {
  const positions: number[] = []
  const normals: number[] = []
  const meshes: MeshAccumulator[] = []
  let current: MeshAccumulator | null = null
  let currentName: string | undefined
  let currentMaterial: string | undefined

  const ensureCurrent = (): MeshAccumulator => {
    if (current === null) {
      current = newAccumulator(currentName, currentMaterial)
      meshes.push(current)
    }
    return current
  }

  const lines = text.split(/\r?\n/)
  for (const raw of lines) {
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) continue
    const tokens = line.split(/\s+/)
    const keyword = tokens[0]
    const rest = tokens.slice(1)

    switch (keyword) {
      case 'v':
        positions.push(Number(rest[0]), Number(rest[1]), Number(rest[2]))
        break
      case 'vn':
        normals.push(Number(rest[0]), Number(rest[1]), Number(rest[2]))
        break
      case 'o':
      case 'g':
        currentName = rest.join(' ') || undefined
        current = null
        break
      case 'usemtl':
        currentMaterial = rest.join(' ') || undefined
        current = null
        break
      case 'f':
        parseFace(ensureCurrent(), rest, positions, normals)
        break
      default:
        break
    }
  }

  return meshes
    .filter(mesh => mesh.indices.length > 0)
    .map(mesh => ({
      name: mesh.name,
      material: mesh.material,
      vertices: mesh.vertices,
      normals: mesh.hasNormals && !mesh.missingNormals ? mesh.normals : null,
      indices: mesh.indices,
    }))
}
