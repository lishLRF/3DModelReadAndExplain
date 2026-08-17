/**
 * Build three.js renderables from the standardized model document.
 */

import * as THREE from 'three'
import type { ModelDocument, ModelPart } from '../schema'

export function buildPartGeometry(part: ModelPart): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(part.vertices as number[], 3))
  if (part.normals != null && part.normals.length > 0) {
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(part.normals as number[], 3))
  } else {
    geometry.computeVertexNormals()
  }
  geometry.setIndex(part.indices as number[])
  geometry.computeBoundingSphere()
  return geometry
}

export interface BuiltModel {
  group: THREE.Group
  meshes: THREE.Mesh[]
}

export function buildModel(doc: ModelDocument, defaultMaterial: THREE.MeshStandardMaterial): BuiltModel {
  const group = new THREE.Group()
  const meshes: THREE.Mesh[] = []

  const materialById = new Map<string, THREE.MeshStandardMaterial>()
  for (const descriptor of doc.materials) {
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(descriptor.color),
      metalness: descriptor.metalness ?? 0.1,
      roughness: descriptor.roughness ?? 0.7,
      side: THREE.DoubleSide,
    })
    materialById.set(descriptor.id, material)
  }

  for (const part of doc.parts) {
    const geometry = buildPartGeometry(part)
    const material = part.material !== undefined && materialById.has(part.material)
      ? materialById.get(part.material)!
      : defaultMaterial
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = part.name ?? part.id
    group.add(mesh)
    meshes.push(mesh)
  }

  return { group, meshes }
}
