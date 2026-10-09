/**
 * Cinematic pass for the anatomy stage (desktop only): a real depth of field
 * that racks focus onto the part being explained — the rest of the frame goes
 * soft — plus a restrained bloom on the specular glints. three.js's own passes.
 */
import * as THREE from 'three'
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

export type AnatomyPost = {
  setSize: (w: number, h: number) => void
  /** focus distance (scene units = mm) and how shallow the depth of field is (0 = all sharp, 1 = rack-focus blur) */
  setFocus: (distance: number, shallow: number) => void
  render: () => void
  dispose: () => void
}

export function createAnatomyPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): AnatomyPost {
  const composer = new EffectComposer(renderer)
  composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  composer.addPass(new RenderPass(scene, camera))
  const bokeh = new BokehPass(scene, camera, { focus: 300, aperture: 0.0001, maxblur: 0.009 })
  composer.addPass(bokeh)
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.22, 0.5, 0.9)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())
  const u = bokeh.uniforms as unknown as { focus: { value: number }; aperture: { value: number }; maxblur: { value: number } }

  return {
    setSize(w, h) {
      composer.setSize(w, h)
      bloom.resolution.set(w / 2, h / 2)
    },
    setFocus(distance, shallow) {
      u.focus.value = distance
      // ±~60 mm around the focus plane reaches full blur when shallow = 1
      u.aperture.value = 0.00002 + shallow * 0.00016
    },
    render() {
      composer.render()
    },
    dispose() {
      composer.dispose()
      bokeh.dispose()
      bloom.dispose()
    },
  }
}
