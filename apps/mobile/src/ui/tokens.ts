import { colors, radius, spacing, type, motion, shadows } from '@shopperstop/ui/tokens'

export { colors, radius, spacing, type, motion, shadows }

// React Native picks a font file by family name, so the weight maps to one of the three bundled faces.
const families = {
  400: 'Inter_400Regular',
  600: 'Inter_600SemiBold',
  700: 'Inter_700Bold',
} as const

export function fontFamily(weight: 400 | 600 | 700): string {
  return families[weight]
}
