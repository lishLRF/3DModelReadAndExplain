import { describe, expect, it } from 'vitest'
import {
  SCHEMA_ID,
  buildDocument,
  computeBounds,
  normalizeMesh,
  quantize,
  type RawMesh,
} from '../src/schema'

describe('computeBounds', () => {
  it('computes min/max/size/center/radius over a single triangle', () => {
    const bounds = computeBounds([0, 0, 0, 1, 0, 0, 0, 1, 0])
    expect(bounds.min).toEqual([0, 0, 0])
    expect(bounds.max).toEqual([1, 1, 0])
    expect(bounds.size).toEqual([1, 1, 0])
    expect(bounds.center).toEqual([0.5, 0.5, 0])
    expect(bounds.radius).toBeCloseTo(Math.SQRT1_2, 5)
  })

  it('returns a zero bounds for empty input', () => {
    const bounds = computeBounds([])
    expect(bounds).toEqual({ min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0], center: [0, 0, 0], radius: 0 })
  })
})

describe('normalizeMesh', () => {
  it('keeps an indexed mesh as-is', () => {
    const raw: RawMesh = {
      vertices: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
      indices: [0, 1, 2],
    }
    expect(normalizeMesh(raw)).toEqual({
      vertices: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
      indices: [0, 1, 2],
    })
  })

  it('deduplicates a non-indexed triangle soup into shared vertices', () => {
    // Two triangles sharing one edge: 4 unique vertices, 6 indices.
    const raw: RawMesh = {
      triangles: [
        0, 0, 0, 1, 0, 0, 0, 1, 0,
        0, 1, 0, 1, 0, 0, 1, 1, 0,
      ],
    }
    const mesh = normalizeMesh(raw)
    expect(mesh.vertices).toHaveLength(12) // 4 vertices × 3
    expect(mesh.indices).toHaveLength(6)
    expect(mesh.indices).toEqual([0, 1, 2, 2, 1, 3])
  })

  it('drops normals when their length does not match vertices', () => {
    const raw: RawMesh = {
      vertices: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      normals: [0, 0, 1], // misaligned: only one normal for three vertices
      indices: [0, 1, 2],
    }
    expect(normalizeMesh(raw).normals).toBeUndefined()
  })
})

describe('buildDocument', () => {
  it('builds a complete v1 document with summary and bounds', () => {
    const doc = buildDocument('stl', [{ triangles: [0, 0, 0, 1, 0, 0, 0, 1, 0] }], {
      name: 'tri.stl',
      units: 'mm',
    })
    expect(doc.schema).toBe(SCHEMA_ID)
    expect(doc.meta).toMatchObject({ sourceFormat: 'stl', name: 'tri.stl', units: 'mm' })
    expect(doc.summary).toEqual({ partCount: 1, vertexCount: 3, triangleCount: 1, materialCount: 0 })
    expect(doc.parts).toHaveLength(1)
    expect(doc.parts[0].id).toBe('part-0')
  })
})

describe('quantize', () => {
  it('rounds geometry floats to the requested precision', () => {
    const doc = buildDocument('stl', [{ triangles: [0.1234, 0.9876, 0.1111, 0, 0, 0, 0, 0, 0] }])
    expect(doc.bounds.max[0]).toBeCloseTo(0.1234, 4)
    quantize(doc, 2)
    expect(doc.bounds.max[0]).toBe(0.12)
    expect(doc.bounds.max[1]).toBe(0.99)
  })

  it('is a no-op for precision 0', () => {
    const doc = buildDocument('stl', [{ triangles: [0.5, 1.5, 2.5, 0, 0, 0, 0, 0, 0] }])
    const before = doc.parts[0].vertices[0]
    quantize(doc, 0)
    expect(doc.parts[0].vertices[0]).toBe(before)
  })
})
