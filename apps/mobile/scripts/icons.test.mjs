// Checks for the app icon, adaptive icon and splash: the committed PNGs equal the generator's output,
// and app.json points at them. Colours come from packages/ui/src/tokens.css, never written here.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { brandColors, IMAGES, render } from './icons.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const appDir = join(here, '..')
const tokensCss = readFileSync(join(here, '..', '..', '..', 'packages', 'ui', 'src', 'tokens.css'), 'utf8')
const appJson = JSON.parse(readFileSync(join(appDir, 'app.json'), 'utf8'))
const expo = appJson.expo

const hexBytes = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

// Decodes an 8-bit RGB or RGBA PNG written with filter byte 0 on every row.
function decodePng(buf) {
  assert.deepEqual([...buf.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], 'PNG signature')
  let header = null
  const idat = []
  for (let off = 8; off < buf.length; ) {
    const len = buf.readUInt32BE(off)
    const type = buf.toString('latin1', off + 4, off + 8)
    const data = buf.subarray(off + 8, off + 8 + len)
    if (type === 'IHDR') {
      header = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), bitDepth: data[8], colorType: data[9] }
    } else if (type === 'IDAT') {
      idat.push(data)
    }
    off += 12 + len
  }
  assert.ok(header, 'IHDR present')
  const channels = header.colorType === 2 ? 3 : 4
  const raw = inflateSync(Buffer.concat(idat))
  const stride = header.width * channels
  assert.equal(raw.length, header.height * (stride + 1), 'scanline length')
  const pixels = Buffer.alloc(header.height * stride)
  for (let row = 0; row < header.height; row++) {
    assert.equal(raw[row * (stride + 1)], 0, `filter byte 0 on row ${row}`)
    raw.copy(pixels, row * stride, row * (stride + 1) + 1, (row + 1) * (stride + 1))
  }
  return { ...header, channels, pixels }
}

const pixelAt = (img, x, y) => {
  const o = (y * img.width + x) * img.channels
  return [...img.pixels.subarray(o, o + img.channels)]
}

test('committed icons match the generator', () => {
  const colors = brandColors(tokensCss)
  assert.deepEqual(
    IMAGES.map((e) => e.file),
    ['icon.png', 'adaptive-icon.png', 'splash-icon.png'],
  )
  for (const entry of IMAGES) {
    const file = join(appDir, 'assets', entry.file)
    assert.ok(existsSync(file), `${entry.file} exists`)
    const img = decodePng(readFileSync(file))
    assert.equal(img.width, 1024)
    assert.equal(img.height, 1024)
    assert.equal(img.bitDepth, 8)
    assert.equal(img.colorType, entry.opaque ? 2 : 6, `${entry.file} colour type`)
    const expected = render(entry, colors)
    assert.equal(Buffer.compare(img.pixels, expected.pixels), 0, `${entry.file} pixels equal the generator`)
  }
  const [brand, onBrand] = [hexBytes(colors.brand), hexBytes(colors.onBrand)]
  const icon = decodePng(readFileSync(join(appDir, 'assets', 'icon.png')))
  assert.deepEqual(pixelAt(icon, 0, 0), brand, 'icon corner is the brand surface')
  assert.deepEqual(pixelAt(icon, 512, 512), onBrand, 'icon centre is the mark, on-brand')
  const adaptive = decodePng(readFileSync(join(appDir, 'assets', 'adaptive-icon.png')))
  assert.deepEqual(pixelAt(adaptive, 512, 512), [...onBrand, 255], 'adaptive centre is opaque on-brand')
  assert.equal(pixelAt(adaptive, 0, 0)[3], 0, 'adaptive corner is transparent')
})

test('app config points at the icons', () => {
  const colors = brandColors(tokensCss)
  assert.equal(expo.icon, './assets/icon.png')
  assert.equal(expo.android.adaptiveIcon.foregroundImage, './assets/adaptive-icon.png')
  assert.ok(existsSync(join(appDir, 'assets', 'icon.png')), 'icon.png exists')
  assert.ok(existsSync(join(appDir, 'assets', 'adaptive-icon.png')), 'adaptive-icon.png exists')
  assert.equal(expo.android.adaptiveIcon.backgroundColor, colors.brand)
})

test('splash uses the brand surface and the mark', () => {
  const colors = brandColors(tokensCss)
  const plugin = expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-splash-screen')
  assert.ok(plugin, 'expo-splash-screen is in expo.plugins')
  const options = plugin[1]
  assert.equal(options.image, './assets/splash-icon.png')
  assert.equal(options.backgroundColor, colors.brand)
  assert.equal(options.imageWidth, 200)
  assert.equal(options.resizeMode, 'contain')
  assert.ok(existsSync(join(appDir, 'assets', 'splash-icon.png')), 'splash-icon.png exists')
  assert.ok(
    IMAGES.some((e) => e.file === 'splash-icon.png' && e.opaque === false && e.scale === 1),
    'IMAGES holds splash-icon.png (transparent, scale 1)',
  )
})
