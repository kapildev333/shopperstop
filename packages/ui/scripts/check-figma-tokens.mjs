// Usage: node scripts/check-figma-tokens.mjs <export.json> [tokens.css]
// Compares the colour variables of a Figma JSON export with the :root tokens in tokens.css.
// Simplification: colours only; type and spacing variables are not compared.
// Ceiling: add them when the Figma file defines them as variables.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const [exportPath, cssPath = join(here, '..', 'src', 'tokens.css')] = process.argv.slice(2)
const usage = 'usage: node scripts/check-figma-tokens.mjs <export.json> [tokens.css]'

function die(message) {
  console.error(message)
  process.exit(2)
}

if (!exportPath) die(usage)

const HEX = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/

// Upper-case; an FF alpha suffix on an 8-digit value is dropped.
function normalise(hex) {
  const upper = hex.toUpperCase()
  return upper.length === 9 && upper.endsWith('FF') ? upper.slice(0, 7) : upper
}

// A leaf is an object with $value; its token name is its own key.
// Leaves whose value is not a hex colour are not colours and are skipped.
function walkFigma(node, out) {
  for (const [key, child] of Object.entries(node)) {
    if (child === null || typeof child !== 'object') continue
    if ('$value' in child) {
      const value = typeof child.$value === 'string' ? child.$value : child.$value?.hex
      if (typeof value === 'string' && HEX.test(value)) out.set(key, normalise(value))
    } else {
      walkFigma(child, out)
    }
  }
  return out
}

function readRootTokens(css) {
  const root = /:root\s*\{([^}]*)\}/.exec(css)
  const out = new Map()
  if (!root) return out
  for (const [, name, value] of root[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    out.set(name, normalise(value.trim()))
  }
  return out
}

let figma
let css
try {
  figma = walkFigma(JSON.parse(readFileSync(exportPath, 'utf8')), new Map())
  css = readRootTokens(readFileSync(cssPath, 'utf8'))
} catch (error) {
  die(`${usage}\n${error.message}`)
}

const names = [...new Set([...css.keys(), ...figma.keys()])].sort()
const lines = []
for (const name of names) {
  if (!figma.has(name)) lines.push(`missing in figma: ${name}`)
  else if (!css.has(name)) lines.push(`missing in css: ${name}`)
  else if (css.get(name) !== figma.get(name))
    lines.push(`mismatch ${name}: css ${css.get(name)}, figma ${figma.get(name)}`)
}

if (lines.length) {
  console.log(lines.join('\n'))
  process.exit(1)
}
console.log(`figma tokens match tokens.css (${css.size} colours)`)
