/**
 * Three.js scene controller: owns the renderer, camera, lights, orbit controls,
 * and the material/light/section settings. Imperative (framework-free) so the
 * React panel can drive it through a thin ref handle.
 */

import * as THREE from 'three'
import type { ModelDocument } from '../schema'
import { buildModel, type BuiltModel } from './geometry'

export type SectionAxis = 'x' | 'y' | 'z'

export interface ViewerSettings {
  color: string
  metalness: number
  roughness: number
  opacity: number
  wireframe: boolean
  ambientIntensity: number
  keyIntensity: number
  sectionEnabled: boolean
  sectionAxis: SectionAxis
  sectionOffset: number
}

export const DEFAULT_SETTINGS: ViewerSettings = {
  color: '#9aa4b2',
  metalness: 0.1,
  roughness: 0.7,
  opacity: 1,
  wireframe: false,
  ambientIntensity: 0.7,
  keyIntensity: 1.1,
  sectionEnabled: false,
  sectionAxis: 'z',
  sectionOffset: 0,
}

/** Minimal orbit controller (rotate / pan / zoom) around a target point. */
class OrbitControls {
  readonly target = new THREE.Vector3()
  private theta = Math.PI / 4
  private phi = Math.PI / 3
  private radius = 5
  private readonly minRadius: number
  private readonly maxRadius: number
  private dragging = false
  private panning = false
  private lastX = 0
  private lastY = 0
  private readonly element: HTMLElement
  private readonly camera: THREE.PerspectiveCamera

  constructor(element: HTMLElement, camera: THREE.PerspectiveCamera, radius: number) {
    this.element = element
    this.camera = camera
    this.radius = radius
    this.minRadius = radius * 0.05
    this.maxRadius = radius * 20
    element.addEventListener('pointerdown', this.onPointerDown)
    element.addEventListener('pointermove', this.onPointerMove)
    element.addEventListener('pointerup', this.onPointerUp)
    element.addEventListener('pointerleave', this.onPointerUp)
    element.addEventListener('wheel', this.onWheel, { passive: false })
    element.addEventListener('contextmenu', this.onContextMenu)
    this.update(camera)
  }

  private onContextMenu = (event: MouseEvent): void => {
    event.preventDefault()
  }

  private onPointerDown = (event: PointerEvent): void => {
    this.dragging = true
    this.panning = event.button === 2 || event.shiftKey
    this.lastX = event.clientX
    this.lastY = event.clientY
    this.element.setPointerCapture?.(event.pointerId)
  }

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.dragging) return
    const dx = event.clientX - this.lastX
    const dy = event.clientY - this.lastY
    this.lastX = event.clientX
    this.lastY = event.clientY
    if (this.panning) this.pan(dx, dy)
    else this.rotate(dx, dy)
  }

  private onPointerUp = (event: PointerEvent): void => {
    if (this.dragging) this.element.releasePointerCapture?.(event.pointerId)
    this.dragging = false
    this.panning = false
  }

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault()
    const factor = Math.exp(event.deltaY * 0.001)
    this.radius = THREE.MathUtils.clamp(this.radius * factor, this.minRadius, this.maxRadius)
  }

  private rotate(dx: number, dy: number): void {
    this.theta -= dx * 0.005
    this.phi = THREE.MathUtils.clamp(this.phi - dy * 0.005, 0.05, Math.PI - 0.05)
  }

  private pan(dx: number, dy: number): void {
    const factor = this.radius * 0.0012
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0)
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 1)
    this.target.addScaledVector(right, -dx * factor)
    this.target.addScaledVector(up, dy * factor)
  }

  /** Apply the current orbit state to the camera. */
  update(camera: THREE.PerspectiveCamera): void {
    const sinPhi = Math.sin(this.phi)
    const position = new THREE.Vector3(
      this.target.x + this.radius * sinPhi * Math.sin(this.theta),
      this.target.y + this.radius * Math.cos(this.phi),
      this.target.z + this.radius * sinPhi * Math.cos(this.theta),
    )
    camera.position.copy(position)
    camera.lookAt(this.target)
    camera.updateProjectionMatrix()
  }

  reset(radius: number): void {
    this.theta = Math.PI / 4
    this.phi = Math.PI / 3
    this.radius = radius
  }

  dispose(): void {
    this.element.removeEventListener('pointerdown', this.onPointerDown)
    this.element.removeEventListener('pointermove', this.onPointerMove)
    this.element.removeEventListener('pointerup', this.onPointerUp)
    this.element.removeEventListener('pointerleave', this.onPointerUp)
    this.element.removeEventListener('wheel', this.onWheel)
    this.element.removeEventListener('contextmenu', this.onContextMenu)
  }
}

export class SceneController {
  readonly settings: ViewerSettings = { ...DEFAULT_SETTINGS }

  private readonly renderer: THREE.WebGLRenderer
  private readonly scene: THREE.Scene
  private readonly camera: THREE.PerspectiveCamera
  private readonly controls: OrbitControls
  private readonly ambient: THREE.AmbientLight
  private readonly key: THREE.DirectionalLight
  private readonly fill: THREE.DirectionalLight
  private readonly clipPlane: THREE.Plane
  private built: BuiltModel | null = null
  private defaultMaterial: THREE.MeshStandardMaterial
  private readonly container: HTMLElement
  private readonly resizeObserver: ResizeObserver
  private lastRadius = 1
  private lastCenter = new THREE.Vector3()
  private disposed = false
  private animationId = 0

  constructor(container: HTMLElement) {
    this.container = container
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, 2))
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.localClippingEnabled = true
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()

    const size = this.measure()
    this.camera = new THREE.PerspectiveCamera(50, size.width / size.height, 0.01, 10000)
    this.camera.position.set(5, 4, 6)

    this.ambient = new THREE.AmbientLight(0xffffff, DEFAULT_SETTINGS.ambientIntensity)
    this.key = new THREE.DirectionalLight(0xffffff, DEFAULT_SETTINGS.keyIntensity)
    this.key.position.set(5, 8, 5)
    this.fill = new THREE.DirectionalLight(0xffffff, 0.35)
    this.fill.position.set(-4, 2, -3)
    this.scene.add(this.ambient, this.key, this.fill)

    this.clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)

    this.defaultMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(DEFAULT_SETTINGS.color),
      metalness: DEFAULT_SETTINGS.metalness,
      roughness: DEFAULT_SETTINGS.roughness,
      side: THREE.DoubleSide,
    })

    this.controls = new OrbitControls(this.renderer.domElement, this.camera, 8)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)

    this.addGrid()
    this.applySettings()
    this.start()
  }

  private measure(): { width: number; height: number } {
    const rect = this.container.getBoundingClientRect()
    return { width: Math.max(rect.width, 1), height: Math.max(rect.height, 1) }
  }

  private addGrid(): void {
    const grid = new THREE.GridHelper(10, 10, 0x666666, 0x333333)
    ;(grid.material as THREE.Material).transparent = true
    ;(grid.material as THREE.Material).opacity = 0.4
    this.scene.add(grid)
    const axes = new THREE.AxesHelper(1)
    this.scene.add(axes)
  }

  private resize(): void {
    if (this.disposed) return
    const size = this.measure()
    this.renderer.setSize(size.width, size.height, false)
    this.camera.aspect = size.width / size.height
    this.camera.updateProjectionMatrix()
  }

  private start(): void {
    const loop = (): void => {
      if (this.disposed) return
      this.animationId = requestAnimationFrame(loop)
      this.controls.update(this.camera)
      this.renderer.render(this.scene, this.camera)
    }
    loop()
  }

  /** Replace the currently displayed model and fit the camera to it. */
  load(doc: ModelDocument): void {
    if (this.built !== null) {
      this.scene.remove(this.built.group)
      for (const mesh of this.built.meshes) {
        mesh.geometry.dispose()
        if (mesh.material !== this.defaultMaterial) (mesh.material as THREE.Material).dispose()
      }
    }
    this.built = buildModel(doc, this.defaultMaterial)
    this.scene.add(this.built.group)

    const radius = doc.bounds.radius > 0 ? doc.bounds.radius : 1
    this.lastRadius = radius
    const center = new THREE.Vector3(...doc.bounds.center)
    this.lastCenter.copy(center)
    this.controls.target.copy(center)
    this.controls.reset(radius * 2.6)
    this.controls.update(this.camera)
    this.applySettings()
  }

  setSettings(patch: Partial<ViewerSettings>): void {
    Object.assign(this.settings, patch)
    this.applySettings()
  }

  private applySettings(): void {
    const s = this.settings
    this.ambient.intensity = s.ambientIntensity
    this.key.intensity = s.keyIntensity

    this.defaultMaterial.color.set(s.color)
    this.defaultMaterial.metalness = s.metalness
    this.defaultMaterial.roughness = s.roughness
    this.defaultMaterial.opacity = s.opacity
    this.defaultMaterial.transparent = s.opacity < 1
    this.defaultMaterial.wireframe = s.wireframe

    const applyTo = (material: THREE.Material): void => {
      const std = material as THREE.MeshStandardMaterial
      if (std === this.defaultMaterial) return
      std.metalness = s.metalness
      std.roughness = s.roughness
      std.opacity = s.opacity
      std.transparent = s.opacity < 1
      std.wireframe = s.wireframe
    }
    if (this.built !== null) {
      for (const mesh of this.built.meshes) {
        if (mesh.material !== this.defaultMaterial) applyTo(mesh.material as THREE.Material)
      }
    }

    const clippingPlanes = s.sectionEnabled ? [this.clipPlane] : []
    this.renderer.clippingPlanes = clippingPlanes
    const clipFor = (material: THREE.Material): void => {
      material.clippingPlanes = clippingPlanes
      material.clipShadows = true
      material.needsUpdate = true
    }
    clipFor(this.defaultMaterial)
    if (this.built !== null) {
      for (const mesh of this.built.meshes) {
        if (mesh.material !== this.defaultMaterial) clipFor(mesh.material as THREE.Material)
      }
    }

    const axis = s.sectionAxis
    const normal = new THREE.Vector3(
      axis === 'x' ? 1 : 0,
      axis === 'y' ? 1 : 0,
      axis === 'z' ? 1 : 0,
    )
    this.clipPlane.normal.copy(normal)
    this.clipPlane.constant = s.sectionOffset
  }

  resetView(): void {
    this.controls.target.copy(this.lastCenter)
    this.controls.reset(Math.max(this.lastRadius, 1) * 2.6)
    this.controls.update(this.camera)
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.animationId)
    this.resizeObserver.disconnect()
    this.controls.dispose()
    if (this.built !== null) {
      for (const mesh of this.built.meshes) {
        mesh.geometry.dispose()
        if (mesh.material !== this.defaultMaterial) (mesh.material as THREE.Material).dispose()
      }
    }
    this.defaultMaterial.dispose()
    this.renderer.dispose()
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement)
    }
  }
}
