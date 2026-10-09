'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FaceLandmarker as FL, NormalizedLandmark } from '@mediapipe/tasks-vision'
import { FrameArt, type FrameArtProduct } from '@/components/frame-art'
import { Icon } from '@/components/icons'
import { cn } from '@/lib/cn'
import type { Swatch } from '@/lib/db/schema'
import { formatPrice } from '@/lib/format'
import { frameLayout, frameSvgString, type FrameSpec } from '@/lib/frame-geometry'
import { swatchCss } from '@/lib/product-art'

export type TryOnFrame = {
  slug: string
  name: string
  category: 'optical' | 'sun'
  price: number
  art: FrameArtProduct
  variants: { colorName: string; colorSlug: string; swatch: Swatch }[]
}

/* Anatomy constants (mm) */
const IRIS_MM = 11.7 // mean horizontal visible iris diameter
const PUPIL_ABOVE_LENS_CENTRE_MM = 2.7 // pupils sit slightly above the boxed lens centre
const ASSUMED_HFOV_DEG = 63 // typical laptop/phone front camera, used only for distance → PD convergence correction
const EYE_ROTATION_MM = 13 // centre of rotation behind the corneal plane

type Pose = { x: number; y: number; mmPerPx: number; roll: number; yaw: number; pitch: number; pd: number; distance: number; iris: number }
type Phase = 'intro' | 'loading' | 'live' | 'photo' | 'error'

const dist3 = (a: NormalizedLandmark, b: NormalizedLandmark, w: number, h: number) => Math.hypot((a.x - b.x) * w, (a.y - b.y) * h, (a.z - b.z) * w)

function poseFrom(lm: NormalizedLandmark[], matrix: Float32Array | number[] | undefined, w: number, h: number): Pose | null {
  const rIris = lm[468]
  const lIris = lm[473]
  if (!rIris || !lIris || lm.length < 478) return null
  const irisR = dist3(lm[469]!, lm[471]!, w, h)
  const irisL = dist3(lm[474]!, lm[476]!, w, h)
  const iris = (irisR + irisL) / 2
  if (!iris) return null
  const mmPerPx = IRIS_MM / iris
  const pdPx = dist3(rIris, lIris, w, h)
  const pdNear = pdPx * mmPerPx
  const f = w / 2 / Math.tan(((ASSUMED_HFOV_DEG / 2) * Math.PI) / 180)
  const distance = (f * IRIS_MM) / iris // mm from camera
  const theta = Math.atan(pdNear / 2 / Math.max(250, distance))
  const pd = pdNear + Math.min(3, Math.max(0, 2 * EYE_ROTATION_MM * Math.sin(theta)))
  const ax = rIris.x * w
  const ay = rIris.y * h
  const bx = lIris.x * w
  const by = lIris.y * h
  const roll = Math.atan2(by - ay, bx - ax)
  let yaw = 0
  let pitch = 0
  if (matrix && matrix.length >= 16) {
    const m = matrix
    // column-major 4x4; R[i][j] = m[j*4+i]
    yaw = Math.asin(Math.max(-1, Math.min(1, -m[2]!)))
    pitch = Math.atan2(m[6]!, m[10]!)
  }
  // lens centre line: pupil midpoint moved "down the face" by PUPIL_ABOVE_LENS_CENTRE_MM
  const mx = (ax + bx) / 2
  const my = (ay + by) / 2
  const down = PUPIL_ABOVE_LENS_CENTRE_MM / mmPerPx
  return { x: mx - Math.sin(roll) * down, y: my + Math.cos(roll) * down, mmPerPx, roll, yaw, pitch, pd, distance, iris }
}

function smooth(prev: Pose | null, next: Pose, k = 0.45): Pose {
  if (!prev) return next
  const l = (a: number, b: number) => a + (b - a) * k
  return { x: l(prev.x, next.x), y: l(prev.y, next.y), mmPerPx: l(prev.mmPerPx, next.mmPerPx), roll: l(prev.roll, next.roll), yaw: l(prev.yaw, next.yaw), pitch: l(prev.pitch, next.pitch), pd: next.pd, distance: next.distance, iris: next.iris }
}

let landmarkerPromise: Promise<FL> | null = null
async function getLandmarker(mode: 'VIDEO' | 'IMAGE'): Promise<FL> {
  landmarkerPromise ??= (async () => {
    const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
    const fileset = await FilesetResolver.forVisionTasks(process.env.NEXT_PUBLIC_MEDIAPIPE_WASM_URL || '/vendor/mediapipe/wasm')
    const base = { modelAssetPath: process.env.NEXT_PUBLIC_FACE_MODEL_URL || '/vendor/mediapipe/face_landmarker.task' }
    const opts = { numFaces: 1, outputFacialTransformationMatrixes: true, outputFaceBlendshapes: false, minFaceDetectionConfidence: 0.5, minTrackingConfidence: 0.5 }
    try {
      return await FaceLandmarker.createFromOptions(fileset, { baseOptions: { ...base, delegate: 'GPU' }, runningMode: 'VIDEO', ...opts })
    } catch {
      return await FaceLandmarker.createFromOptions(fileset, { baseOptions: { ...base, delegate: 'CPU' }, runningMode: 'VIDEO', ...opts })
    }
  })()
  const lm = await landmarkerPromise
  await lm.setOptions({ runningMode: mode })
  return lm
}

export function TryOn({ frames, initialSlug, initialColor, startWithPd }: { frames: TryOnFrame[]; initialSlug?: string; initialColor?: string; startWithPd?: boolean }) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [error, setError] = useState<string | null>(null)
  const [slug, setSlug] = useState(initialSlug && frames.some((f) => f.slug === initialSlug) ? initialSlug : frames[0]?.slug)
  const frame = frames.find((f) => f.slug === slug) ?? frames[0]!
  const [color, setColor] = useState(initialColor ?? frame.variants[0]?.colorSlug)
  const variant = frame.variants.find((v) => v.colorSlug === color) ?? frame.variants[0]!
  const [measuring, setMeasuring] = useState(!!startWithPd)
  const [pdLive, setPdLive] = useState<number | null>(null)
  const [pdResult, setPdResult] = useState<number | null>(null)
  const [progress, setProgress] = useState(0)
  const [noFace, setNoFace] = useState(false)
  const [nudge, setNudge] = useState(0) // mm: user adjustment of vertical fit
  const [shots, setShots] = useState<{ url: string; name: string }[]>([])
  const [category, setCategory] = useState<'all' | 'optical' | 'sun'>('all')

  const videoRef = useRef<HTMLVideoElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const poseRef = useRef<Pose | null>(null)
  const samples = useRef<number[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef(0)
  const lastTs = useRef(0)
  const nudgeRef = useRef(0)
  const measuringRef = useRef(measuring)
  const specRef = useRef(frame.art as FrameSpec)
  nudgeRef.current = nudge
  measuringRef.current = measuring
  specRef.current = frame.art as FrameSpec

  /** Position the media layer (video/photo) to cover the stage, mirrored for the camera. */
  const layout = useCallback((mw: number, mh: number, mirror: boolean, focus?: { x: number; y: number; mmPerPx: number }) => {
    const stage = stageRef.current
    const layer = layerRef.current
    if (!stage || !layer || !mw || !mh) return
    const sw = stage.clientWidth
    const sh = stage.clientHeight
    let s = Math.max(sw / mw, sh / mh)
    let ox = (sw - mw * s) / 2
    let oy = (sh - mh * s) / 2
    if (focus) {
      // photos: zoom so the face (≈ 160 mm wide) fills ~55% of the stage, centred on the eyes
      const faceW = 160 / focus.mmPerPx
      s = Math.max(s, Math.min(4, (sw * 0.55) / faceW))
      ox = Math.min(0, Math.max(sw - mw * s, sw / 2 - focus.x * s))
      oy = Math.min(0, Math.max(sh - mh * s, sh * 0.42 - focus.y * s))
    }
    layer.style.width = `${mw}px`
    layer.style.height = `${mh}px`
    layer.style.transform = `translate(${ox}px, ${oy}px) scale(${s})${mirror ? ` translateX(${mw}px) scaleX(-1)` : ''}`
  }, [])

  /** Place the frame on the face in media-pixel space. */
  const place = useCallback((pose: Pose | null) => {
    const el = frameRef.current
    if (!el) return
    if (!pose) {
      el.style.opacity = '0'
      return
    }
    const L = frameLayout(specRef.current)
    const [vx, vy, vw, vh] = L.viewBox
    const scale = 1 / pose.mmPerPx
    const wPx = vw * scale
    const hPx = vh * scale
    const originX = -vx * scale
    const originY = -vy * scale
    const y = pose.y + (nudgeRef.current / pose.mmPerPx) * Math.cos(pose.roll)
    const x = pose.x - (nudgeRef.current / pose.mmPerPx) * Math.sin(pose.roll)
    el.style.opacity = '1'
    el.style.width = `${wPx}px`
    el.style.height = `${hPx}px`
    el.style.transformOrigin = `${originX}px ${originY}px`
    el.style.transform = `translate(${x - originX}px, ${y - originY}px) rotate(${pose.roll}rad) perspective(${wPx * 3}px) rotateY(${-pose.yaw * 0.9}rad) rotateX(${pose.pitch * 0.4}rad)`
  }, [])

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])
  useEffect(() => stop, [stop])

  const handleResult = useCallback((lm: NormalizedLandmark[] | undefined, matrix: Float32Array | number[] | undefined, w: number, h: number) => {
    const raw = lm ? poseFrom(lm, matrix, w, h) : null
    if (!raw) {
      poseRef.current = null
      place(null)
      setNoFace(true)
      return
    }
    setNoFace(false)
    poseRef.current = smooth(poseRef.current, raw)
    place(poseRef.current)
    if (measuringRef.current) {
      const frontal = Math.abs(raw.yaw) < 0.12 && Math.abs(raw.roll) < 0.08
      if (frontal) {
        samples.current.push(raw.pd)
        if (samples.current.length > 40) samples.current.shift()
        const p = Math.min(1, samples.current.length / 30)
        setProgress(p)
        const sorted = [...samples.current].sort((a, b) => a - b)
        const median = sorted[Math.floor(sorted.length / 2)]!
        setPdLive(Math.round(median * 2) / 2)
        if (p >= 1) {
          setPdResult(Math.round(median * 2) / 2)
          setMeasuring(false)
        }
      }
    }
  }, [place])

  const startCamera = async () => {
    setError(null)
    setPhase('loading')
    try {
      const [stream, lm] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false }),
        getLandmarker('VIDEO'),
      ])
      streamRef.current = stream
      const v = videoRef.current!
      v.srcObject = stream
      await v.play()
      setPhase('live')
      layout(v.videoWidth, v.videoHeight, true)
      const loop = () => {
        rafRef.current = requestAnimationFrame(loop)
        if (v.readyState < 2) return
        const now = performance.now()
        if (now - lastTs.current < 30) return // ~30 fps inference
        lastTs.current = now
        const r = lm.detectForVideo(v, now)
        handleResult(r.faceLandmarks[0], r.facialTransformationMatrixes?.[0]?.data, v.videoWidth, v.videoHeight)
      }
      loop()
    } catch (e) {
      stop()
      const name = (e as { name?: string }).name
      setError(name === 'NotAllowedError' ? 'Accesul la cameră a fost refuzat. Îl poți permite din setările browserului, sau încearcă cu o poză.' : name === 'NotFoundError' ? 'Nu am găsit nicio cameră. Încearcă cu o poză.' : 'Proba virtuală nu a putut porni pe acest dispozitiv. Încearcă cu o poză sau din alt browser.')
      setPhase('error')
    }
  }

  const startPhoto = async (file: File) => {
    stop()
    setError(null)
    setPhase('loading')
    try {
      const url = URL.createObjectURL(file)
      const img = imgRef.current!
      img.src = url
      await img.decode()
      const lm = await getLandmarker('IMAGE')
      setPhase('photo')
      layout(img.naturalWidth, img.naturalHeight, false)
      const r = lm.detect(img)
      poseRef.current = null
      handleResult(r.faceLandmarks[0], r.facialTransformationMatrixes?.[0]?.data, img.naturalWidth, img.naturalHeight)
      if (poseRef.current) layout(img.naturalWidth, img.naturalHeight, false, poseRef.current)
      if (!r.faceLandmarks[0]) setError('Nu am găsit o față în poză. Încearcă o fotografie din față, cu lumină bună.')
    } catch {
      setError('Nu am putut procesa poza.')
      setPhase('error')
    }
  }

  // re-place when frame / nudge changes (photo mode has no loop)
  useEffect(() => {
    if (poseRef.current) place(poseRef.current)
  }, [slug, color, nudge, place])

  useEffect(() => {
    const onResize = () => {
      if (phase === 'live' && videoRef.current) layout(videoRef.current.videoWidth, videoRef.current.videoHeight, true)
      if (phase === 'photo' && imgRef.current) layout(imgRef.current.naturalWidth, imgRef.current.naturalHeight, false, poseRef.current ?? undefined)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [phase, layout])

  const snapshot = async () => {
    const pose = poseRef.current
    const media = phase === 'photo' ? imgRef.current : videoRef.current
    if (!media || !pose) return
    const w = phase === 'photo' ? imgRef.current!.naturalWidth : videoRef.current!.videoWidth
    const h = phase === 'photo' ? imgRef.current!.naturalHeight : videoRef.current!.videoHeight
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')!
    if (phase === 'live') {
      ctx.translate(w, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(media, 0, 0, w, h)
    const svg = frameSvgString(frame.art as FrameSpec, variant.swatch, { temples: true, subtle: true })
    const im = new Image()
    im.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    await im.decode()
    const L = frameLayout(frame.art as FrameSpec)
    const [vx, vy, vw, vh] = L.viewBox
    const s = 1 / pose.mmPerPx
    ctx.save()
    ctx.translate(pose.x, pose.y + nudge * s)
    ctx.rotate(pose.roll)
    ctx.scale(Math.cos(pose.yaw * 0.9), 1)
    ctx.drawImage(im, vx * s, vy * s, vw * s, vh * s)
    ctx.restore()
    setShots((prev) => [{ url: c.toDataURL('image/jpeg', 0.86), name: `${frame.name} · ${variant.colorName}` }, ...prev].slice(0, 4))
  }

  const savePd = () => {
    if (!pdResult) return
    try {
      localStorage.setItem('sv:pd', JSON.stringify({ value: pdResult, at: Date.now() }))
    } catch {
      /* ignore */
    }
  }

  const list = frames.filter((f) => category === 'all' || f.category === category)
  const active = phase === 'live' || phase === 'photo'

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div>
        <div ref={stageRef} className={cn('relative aspect-[3/4] w-full overflow-hidden rounded-[28px] bg-ink sm:aspect-[4/3]', !active && 'bg-glass ring-1 ring-line-soft')}>
          <div ref={layerRef} className="absolute left-0 top-0 origin-top-left" style={{ width: 0, height: 0 }}>
            <video ref={videoRef} playsInline muted className={cn('absolute inset-0 h-full w-full', phase !== 'live' && 'hidden')} />
            <img ref={imgRef} alt="Poza ta" className={cn('absolute inset-0 h-full w-full', phase !== 'photo' && 'hidden')} />
            <div ref={frameRef} className="absolute left-0 top-0 opacity-0 drop-shadow-[0_6px_8px_rgba(0,0,0,.28)] transition-opacity duration-200" style={{ willChange: 'transform' }}>
              <FrameArt product={frame.art} swatch={variant.swatch} className="h-full w-full" idSalt="tryon" subtle />
            </div>
          </div>

          {!active ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8 text-center">
              <div className="relative">
                <div className="lens-ring size-40 sm:size-48" />
                <div className="absolute inset-0 grid place-items-center">
                  <div className="w-36 sm:w-44">
                    <FrameArt product={frame.art} swatch={variant.swatch} className="h-auto w-full" />
                  </div>
                </div>
              </div>
              {phase === 'loading' ? (
                <p className="flex items-center gap-2 text-[15px]">
                  <span className="size-4 animate-spin rounded-full border-2 border-line border-t-cobalt" /> Pregătim camera și modelul facial…
                </p>
              ) : (
                <>
                  <p className="max-w-sm text-[15.5px] text-ink-2">Ține telefonul la nivelul ochilor, în lumină bună, și privește drept în cameră.</p>
                  <div className="flex flex-wrap justify-center gap-3">
                    <button type="button" onClick={startCamera} className="btn btn-primary">
                      <Icon name="camera" size={20} /> Pornește camera
                    </button>
                    <label className="btn btn-secondary cursor-pointer">
                      <Icon name="upload" size={20} /> Folosește o poză
                      <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && startPhoto(e.target.files[0])} />
                    </label>
                  </div>
                  {error ? <p className="max-w-md text-[14px] text-err">{error}</p> : null}
                  <p className="flex items-center gap-2 text-[12.5px] text-graphite">
                    <Icon name="lock" size={14} /> Rulează local, în browser. Nicio imagine nu e trimisă sau salvată.
                  </p>
                </>
              )}
            </div>
          ) : null}

          {active && noFace ? (
            <div className="absolute inset-x-0 top-4 mx-auto w-fit rounded-full bg-black/60 px-4 py-2 text-[13.5px] text-white backdrop-blur">Nu te vedem — apropie-te și privește în cameră</div>
          ) : null}

          {active ? (
            <div className="absolute inset-x-3 bottom-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 rounded-full bg-black/55 p-1.5 pr-4 text-white backdrop-blur">
                <button type="button" aria-label="Rama mai sus" onClick={() => setNudge((n) => n - 1)} className="grid size-9 place-items-center rounded-full hover:bg-white/15">
                  <Icon name="chevron-down" size={18} className="rotate-180" />
                </button>
                <button type="button" aria-label="Rama mai jos" onClick={() => setNudge((n) => n + 1)} className="grid size-9 place-items-center rounded-full hover:bg-white/15">
                  <Icon name="chevron-down" size={18} />
                </button>
                <span className="font-mono text-[12px]">{nudge ? `${nudge > 0 ? '+' : ''}${nudge} mm` : 'poziție'}</span>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={snapshot} className="btn btn-sm bg-white text-ink hover:bg-fog">
                  <Icon name="camera" size={18} /> Fotografiază
                </button>
                {phase === 'live' ? (
                  <button
                    type="button"
                    onClick={() => {
                      samples.current = []
                      setProgress(0)
                      setPdResult(null)
                      setMeasuring(true)
                    }}
                    className="btn btn-sm bg-white text-ink hover:bg-fog"
                  >
                    <Icon name="ruler" size={18} /> Măsoară PD
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {active && (measuring || pdResult) ? (
            <div className="absolute left-3 top-3 w-[230px] rounded-2xl bg-white/92 p-4 text-ink shadow-lg backdrop-blur" aria-live="polite">
              <div className="flex items-center justify-between font-mono text-[11px] tracking-[0.08em]">
                <span>DISTANȚA PUPILARĂ</span>
                <span className="text-cobalt">±1–2 mm</span>
              </div>
              <div className="disp mt-1 text-[34px] tnum">{(pdResult ?? pdLive)?.toFixed(1).replace('.', ',') ?? '—'} mm</div>
              {measuring ? (
                <>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line-soft">
                    <div className="h-full rounded-full bg-cobalt transition-[width]" style={{ width: `${progress * 100}%` }} />
                  </div>
                  <p className="mt-2 text-[12.5px] text-graphite">Privește drept în cameră, fără să înclini capul.</p>
                </>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  <button type="button" onClick={savePd} className="btn btn-primary btn-sm w-full">
                    Folosește în comandă
                  </button>
                  <p className="text-[12px] leading-snug text-graphite">Estimare pentru vederea la distanță. La progresive o confirmăm prin telefon sau în showroom.</p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {shots.length ? (
          <div className="mt-5">
            <div className="eyebrow mb-3">Comparație</div>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {shots.map((s, i) => (
                <li key={s.url.slice(-24) + i} className="overflow-hidden rounded-2xl bg-glass ring-1 ring-line-soft">
                  <img src={s.url} alt={s.name} className="aspect-[3/4] w-full object-cover" />
                  <div className="flex items-center justify-between gap-2 p-2.5 text-[12.5px]">
                    <span className="truncate font-bold">{s.name}</span>
                    <a href={s.url} download={`sifra-proba-${i + 1}.jpg`} aria-label="Descarcă" className="shrink-0">
                      <Icon name="download" size={16} />
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <aside className="flex flex-col gap-4" aria-label="Alege rama">
        <div className="card bg-glass p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[19px] font-bold">{frame.name}</div>
              <div className="spec">
                {frame.art.lensWidth}□{frame.art.bridgeWidth} · {formatPrice(frame.price)}
              </div>
            </div>
            <Link href={`/rame/${frame.slug}?culoare=${variant.colorSlug}`} className="btn btn-ink btn-sm">
              Vezi rama
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Culoare">
            {frame.variants.map((v) => (
              <button key={v.colorSlug} type="button" role="radio" aria-checked={v.colorSlug === variant.colorSlug} title={v.colorName} aria-label={v.colorName} onClick={() => setColor(v.colorSlug)} className={cn('grid size-9 place-items-center rounded-full', v.colorSlug === variant.colorSlug ? 'ring-[1.5px] ring-ink' : 'ring-1 ring-line')}>
                <span className="size-6 rounded-full ring-1 ring-black/10" style={{ background: swatchCss(v.swatch) }} />
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          {(
            [
              ['all', 'Toate'],
              ['optical', 'Vedere'],
              ['sun', 'Soare'],
            ] as const
          ).map(([v, label]) => (
            <button key={v} type="button" aria-pressed={category === v} onClick={() => setCategory(v)} className={cn('rounded-full px-3.5 py-1.5 text-[13.5px] ring-1', category === v ? 'bg-ink text-fog ring-ink' : 'ring-line')}>
              {label}
            </button>
          ))}
        </div>
        <ul className="grid max-h-[520px] grid-cols-2 gap-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
          {list.map((f) => (
            <li key={f.slug}>
              <button
                type="button"
                aria-pressed={f.slug === frame.slug}
                onClick={() => {
                  setSlug(f.slug)
                  setColor(f.variants[0]?.colorSlug)
                }}
                className={cn('flex w-full flex-col items-center gap-1 rounded-2xl p-3 text-center ring-1 transition-colors', f.slug === frame.slug ? 'bg-paper ring-[1.5px] ring-ink' : 'bg-glass ring-line-soft hover:ring-line')}
              >
                <FrameArt product={f.art} swatch={f.variants[0]!.swatch} className="h-9 w-auto" />
                <span className="text-[13px] font-bold">{f.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
