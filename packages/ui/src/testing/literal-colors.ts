import { readdirSync, readFileSync } from 'node:fs'
import { basename, extname, join, sep } from 'node:path'

// Hex colours, Tailwind palette utilities, white/black utilities and colour functions.
// Regexes over text, not a CSS or TS parser: a hex-looking anchor such as #add is a false positive.
const literal = new RegExp(
  [
    String.raw`(?<![\w&/])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b`,
    String.raw`\b(?:[a-z-]+:)*(?:bg|text|border|ring|outline|fill|stroke|from|via|to|divide|placeholder|decoration|accent|caret|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b`,
    String.raw`\b(?:[a-z-]+:)*(?:bg|text|border|ring|outline|fill|stroke|from|via|to|divide|placeholder|decoration|caret|shadow)-(?:white|black)\b`,
    String.raw`\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(`,
  ]
    .map((p) => `(?:${p})`)
    .join('|'),
  'gi',
)

export function matchLiteralColors(text: string): string[] {
  return text.match(literal) ?? []
}

export function findLiteralColors(
  dir: string,
  ignore: string[] = [],
): { file: string; match: string }[] {
  const skip = new Set(ignore)
  const files = readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .map((f) => f.split(sep).join('/'))
    .sort()
  const found: { file: string; match: string }[] = []
  for (const file of files) {
    if (!['.ts', '.tsx', '.css'].includes(extname(file))) continue
    if (basename(file) === 'tokens.css' || skip.has(file)) continue
    for (const match of matchLiteralColors(readFileSync(join(dir, file), 'utf8'))) {
      found.push({ file, match })
    }
  }
  return found
}
