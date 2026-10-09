// Copies MediaPipe's WASM runtime into public/ so the virtual try-on is fully
// self-hosted (no third-party requests, strict CSP). Runs on postinstall/prebuild.
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
try {
  // the package has an "exports" map without ./package.json — resolve the main entry instead
  const pkg = dirname(require.resolve('@mediapipe/tasks-vision'))
  const src = join(pkg, 'wasm')
  const dest = join(process.cwd(), 'public', 'vendor', 'mediapipe', 'wasm')
  if (existsSync(src)) {
    mkdirSync(dest, { recursive: true })
    cpSync(src, dest, { recursive: true })
    console.log('✓ mediapipe wasm → public/vendor/mediapipe/wasm')
  }
} catch (e) {
  console.warn('vendor: @mediapipe/tasks-vision not found, skipping', e?.message)
}
