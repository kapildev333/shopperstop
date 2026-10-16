// Usage: node scripts/icons.mjs (from apps/mobile). Writes every IMAGES entry into assets/ from the brand tokens.
// render() and encodePng() are pure; the files are written only when run directly.
// Reads --brand and --on-brand from packages/ui/src/tokens.css with a regex over `--name: value;`, as gen-tokens does.
// Ceiling: a commented-out declaration would be read; the mark is one polygon, not a traced logo.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { crc32, deflateSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

const SIZE = 1024
const SUBSAMPLES = 4 // 4 x 4 samples per pixel
// Lightning bolt, even-odd interior, unit coordinates, origin top left.
const MARK = [
  [0.58, 0.18],
  [0.3, 0.56],
  [0.47, 0.56],
  [0.42, 0.82],
  [0.7, 0.44],
  [0.53, 0.44],
]

export const IMAGES = [
  { file: 'icon.png', opaque: true, scale: 1 },
  { file: 'adaptive-icon.png', opaque: false, scale: 0.8 },
]

function declaration(css, name) {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(css)
  if (!match) throw new Error(`tokens.css has no --${name}`)
  return match[1].trim()
}

export function brandColors(css) {
  return { brand: declaration(css, 'brand'), onBrand: declaration(css, 'on-brand') }
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

// Even-odd ray cast: true when (x, y) is inside MARK.
function inMark(x, y) {
  let inside = false
  for (let i = 0, j = MARK.length - 1; i < MARK.length; j = i++) {
    const [xi, yi] = MARK[i]
    const [xj, yj] = MARK[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

// Coverage of the mark in pixel (i, j): fraction of the 4 x 4 samples inside, the mark scaled about the centre.
function coverage({ scale }, i, j) {
  let hits = 0
  for (let a = 0; a < SUBSAMPLES; a++) {
    for (let b = 0; b < SUBSAMPLES; b++) {
      const u = (i + (a + 0.5) / SUBSAMPLES) / SIZE
      const v = (j + (b + 0.5) / SUBSAMPLES) / SIZE
      if (inMark(0.5 + (u - 0.5) / scale, 0.5 + (v - 0.5) / scale)) hits++
    }
  }
  return hits / (SUBSAMPLES * SUBSAMPLES)
}

export function render({ opaque, scale }, colors) {
  const brand = rgb(colors.brand)
  const onBrand = rgb(colors.onBrand)
  const channels = opaque ? 3 : 4
  const pixels = Buffer.alloc(SIZE * SIZE * channels)
  for (let j = 0; j < SIZE; j++) {
    for (let i = 0; i < SIZE; i++) {
      const k = coverage({ scale }, i, j)
      const o = (j * SIZE + i) * channels
      if (opaque) {
        for (let c = 0; c < 3; c++) pixels[o + c] = Math.round(brand[c] + (onBrand[c] - brand[c]) * k)
      } else {
        pixels[o] = onBrand[0]
        pixels[o + 1] = onBrand[1]
        pixels[o + 2] = onBrand[2]
        pixels[o + 3] = Math.round(255 * k)
      }
    }
  }
  return { width: SIZE, height: SIZE, channels, pixels }
}

function chunk(type, data) {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'latin1')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'latin1'), data])) >>> 0, 0)
  return Buffer.concat([head, data, crc])
}

export function encodePng({ width, height, channels, pixels }) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = channels === 3 ? 2 : 6 // colour type: RGB or RGBA
  const stride = width * channels
  const raw = Buffer.alloc(height * (stride + 1)) // filter byte 0 before each row
  for (let row = 0; row < height; row++) {
    pixels.copy(raw, row * (stride + 1) + 1, row * stride, (row + 1) * stride)
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const colors = brandColors(readFileSync(join(here, '..', '..', '..', 'packages', 'ui', 'src', 'tokens.css'), 'utf8'))
  mkdirSync(join(here, '..', 'assets'), { recursive: true })
  for (const entry of IMAGES) {
    writeFileSync(join(here, '..', 'assets', entry.file), encodePng(render(entry, colors)))
    console.log(`wrote assets/${entry.file}`)
  }
}
