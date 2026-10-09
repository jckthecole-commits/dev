#!/usr/bin/env node
/**
 * Turns the generated campaign media (scripts/media/sources.json) into web assets:
 *
 *   images → AVIF + WebP at the listed widths, plus an optional pre-blurred copy
 *            (a few KB: the out-of-focus layer paints at once and costs no CSS blur)
 *   videos → H.264 MP4s encoded for scroll scrubbing (short GOP, no audio, faststart),
 *            a desktop and a mobile cut, and a poster from the first decoded frame
 *
 * Output goes to public/media/<id>-<hash>/ (the hash of the source URL, so the files
 * can be cached forever) and src/lib/media.json describes what was written.
 * Downloads are cached in .media-cache/. Run: node scripts/media/build.mjs [id…]
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(import.meta.dirname, '../..')
const cache = path.join(root, '.media-cache')
const pub = path.join(root, 'public/media')
const out = path.join(root, 'src/lib/media.json')

const sources = JSON.parse(await readFile(path.join(import.meta.dirname, 'sources.json'), 'utf8'))
const only = new Set(process.argv.slice(2))
const prev = existsSync(out) ? JSON.parse(await readFile(out, 'utf8')) : {}
const media = { ...prev }

const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 8)
const ffmpeg = (...args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' })
const probe = (file) => {
  const [w, h, d] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'csv=p=0:s=,', file])
    .toString()
    .trim()
    .split(/[\n,]/)
    .map(Number)
  return { w, h, duration: Math.round(d * 100) / 100 }
}

async function download(url) {
  await mkdir(cache, { recursive: true })
  const file = path.join(cache, `${hash(url)}${path.extname(new URL(url).pathname) || '.bin'}`)
  if (existsSync(file)) return file
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  await writeFile(file, Buffer.from(await res.arrayBuffer()))
  return file
}

async function image(id, s, dir) {
  const file = await download(s.src)
  const img = sharp(file)
  const { width, height } = await img.metadata()
  const widths = s.widths.filter((w) => w <= width)
  for (const w of widths) {
    const r = sharp(file).resize({ width: w })
    await r.clone().avif({ quality: s.quality ?? 52, effort: 6 }).toFile(path.join(dir, `${w}.avif`))
    await r.clone().webp({ quality: (s.quality ?? 52) + 26, effort: 6 }).toFile(path.join(dir, `${w}.webp`))
  }
  let blur
  if (s.blur) {
    // blurred at a small size: nothing sharp is left, so scaling it up shows no pixels
    const r = sharp(file).resize({ width: s.blur }).blur(s.blur / 36)
    await r.clone().avif({ quality: 46, effort: 6 }).toFile(path.join(dir, 'blur.avif'))
    await r.clone().webp({ quality: 70, effort: 6 }).toFile(path.join(dir, 'blur.webp'))
    blur = s.blur
  }
  return { kind: 'image', w: width, h: height, widths, blur }
}

async function video(id, s, dir) {
  const file = await download(s.src)
  // short GOP and no scene-cut keyframes: any frame is a cheap seek away when scrubbing
  ffmpeg('-i', file, '-an', '-vf', `scale='min(1920,iw)':-2,unsharp=5:5:0.6:5:5:0.0`, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(s.crf ?? 22), '-pix_fmt', 'yuv420p', '-g', '8', '-keyint_min', '8', '-sc_threshold', '0', '-movflags', '+faststart', path.join(dir, 'desktop.mp4'))
  ffmpeg('-i', file, '-an', '-vf', `scale=-2:'min(${s.mobileHeight ?? 540},ih)',unsharp=5:5:0.5:5:5:0.0`, '-c:v', 'libx264', '-preset', 'slow', '-crf', String((s.crf ?? 22) + 3), '-pix_fmt', 'yuv420p', '-g', '4', '-keyint_min', '4', '-sc_threshold', '0', '-movflags', '+faststart', path.join(dir, 'mobile.mp4'))
  // posters are frames of the encoded clips, so the swap to video is seamless
  for (const [cut, name] of [
    ['desktop.mp4', 'poster'],
    ['mobile.mp4', 'poster-m'],
  ]) {
    const png = path.join(dir, `${name}.png`)
    ffmpeg('-i', path.join(dir, cut), '-frames:v', '1', png)
    await sharp(png).avif({ quality: 55, effort: 6 }).toFile(path.join(dir, `${name}.avif`))
    await sharp(png).webp({ quality: 80 }).toFile(path.join(dir, `${name}.webp`))
    await rm(png)
  }
  if (s.endPoster) {
    const png = path.join(dir, 'end.png')
    ffmpeg('-sseof', '-0.08', '-i', path.join(dir, 'desktop.mp4'), '-frames:v', '1', '-update', '1', png)
    await sharp(png).avif({ quality: 55, effort: 6 }).toFile(path.join(dir, 'end.avif'))
    await sharp(png).webp({ quality: 80 }).toFile(path.join(dir, 'end.webp'))
    await rm(png)
  }
  const d = probe(path.join(dir, 'desktop.mp4'))
  const m = probe(path.join(dir, 'mobile.mp4'))
  return { kind: 'video', w: d.w, h: d.h, mw: m.w, mh: m.h, duration: d.duration, endPoster: !!s.endPoster }
}

await mkdir(pub, { recursive: true })
for (const [id, s] of Object.entries(sources)) {
  if (only.size && !only.has(id)) continue
  const base = `${id}-${hash(s.src + JSON.stringify(s))}`
  const dir = path.join(pub, base)
  // drop older builds of the same asset
  for (const d of await readdir(pub)) if (d.startsWith(`${id}-`) && d !== base && d.slice(id.length + 1).length === 8) await rm(path.join(pub, d), { recursive: true })
  if (media[id]?.dir === `/media/${base}` && existsSync(dir)) {
    console.log(`= ${id}`)
    continue
  }
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })
  const info = s.kind === 'video' ? await video(id, s, dir) : await image(id, s, dir)
  media[id] = { dir: `/media/${base}`, ...info, ...(s.alt ? { alt: s.alt } : {}) }
  console.log(`✓ ${id}`, JSON.stringify(media[id]))
}
for (const id of Object.keys(media)) if (!(id in sources)) delete media[id]
await writeFile(out, JSON.stringify(media, null, 2) + '\n')
