import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  analyzeDocument,
  analyzePart,
  boundaryEdgeCountOf,
  signedVolumeOf,
  surfaceAreaOf,
} from '../src/analyze'
import { buildDocument } from '../src/schema'
import { parseObj } from '../src/parse/obj'

/** Outward-oriented closed tetrahedron: 4 vertices, 4 faces, volume 1/6. */
const TETRA = {
  vertices: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
  indices: [0, 2, 1, 0, 3, 2, 0, 1, 3, 1, 2, 3],
}

/** Outward-oriented unit cube: 8 corners, 12 triangles, volume 1. */
function unitBox(): { vertices: number[]; indices: number[] } {
  const c = [
    [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5],
    [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5],
  ]
  const faces = [
    [0, 3, 2, 1], // -z
    [4, 5, 6, 7], // +z
    [0, 1, 5, 4], // -y
    [3, 7, 6, 2], // +y
    [0, 4, 7, 3], // -x
    [1, 2, 6, 5], // +x
  ]
  const indices: number[] = []
  for (const [a, b, cc, d] of faces) indices.push(a, b, cc, a, cc, d)
  return { vertices: c.flat(), indices }
}

describe('surfaceAreaOf', () => {
  it('computes the area of a unit right triangle', () => {
    expect(surfaceAreaOf([0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2])).toBeCloseTo(0.5, 6)
  })

  it('sums the four faces of a tetrahedron', () => {
    expect(surfaceAreaOf(TETRA.vertices, TETRA.indices)).toBeCloseTo(1.5 + Math.sqrt(3) / 2, 5)
  })
})

describe('signedVolumeOf', () => {
  it('is positive for an outward-oriented tetrahedron', () => {
    expect(signedVolumeOf(TETRA.vertices, TETRA.indices)).toBeCloseTo(1 / 6, 6)
  })

  it('is 1 for a unit cube', () => {
    const box = unitBox()
    expect(signedVolumeOf(box.vertices, box.indices)).toBeCloseTo(1, 6)
  })
})

describe('boundaryEdgeCountOf', () => {
  it('is 0 for a closed tetrahedron', () => {
    expect(boundaryEdgeCountOf(TETRA.vertices, TETRA.indices)).toBe(0)
  })

  it('is 3 for a single open triangle', () => {
    expect(boundaryEdgeCountOf([0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2])).toBe(3)
  })
})

describe('analyzePart', () => {
  it('marks the tetrahedron watertight and freeform', () => {
    const a = analyzePart(TETRA.vertices, TETRA.indices)
    expect(a.watertight).toBe(true)
    expect(a.boundaryEdgeCount).toBe(0)
    expect(a.primitive).toBe('freeform')
  })

  it('classifies a unit cube as a box', () => {
    const box = unitBox()
    const a = analyzePart(box.vertices, box.indices)
    expect(a.primitive).toBe('box')
    expect(a.watertight).toBe(true)
    expect(a.dimensions).toEqual([1, 1, 1])
  })

  it('classifies a flat open triangle as planar', () => {
    const a = analyzePart([0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2])
    expect(a.primitive).toBe('planar')
    expect(a.watertight).toBe(false)
  })

  it('recognizes a hard-edged OBJ cube (per-face normals) as watertight and box', () => {
    // examples/cube.obj splits each corner into 3 vertices (one per face normal),
    // so watertightness must be detected by geometric position, not vertex index.
    const obj = readFileSync('examples/cube.obj', 'utf8')
    const [mesh] = parseObj(obj)
    const a = analyzePart(mesh.vertices!, mesh.indices!)
    expect(a.watertight).toBe(true)
    expect(a.primitive).toBe('box')
    expect(Math.abs(a.volume)).toBeCloseTo(1, 5)
  })
})

describe('analyzeDocument', () => {
  it('attaches a natural-language description and whole-model totals', () => {
    const doc = buildDocument('stl', [TETRA], { name: 'tetra.stl', units: 'mm' })
    expect(doc.analysis).toBeDefined()
    expect(doc.analysis.partCount).toBe(1)
    expect(doc.analysis.watertight).toBe(true)
    expect(doc.analysis.totalVolume).toBeCloseTo(1 / 6, 5)
    expect(doc.analysis.naturalDescription).toMatch(/tetra\.stl/)
    expect(doc.analysis.naturalDescription).toMatch(/1 part/)
  })
})
