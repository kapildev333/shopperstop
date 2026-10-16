import { Text as NativeText, type TextProps } from 'react-native'
import { colors, type, fontFamily } from './tokens'

export type Variant = keyof typeof type
export type Tone = 'ink' | 'inkMuted' | 'danger' | 'accent' | 'onBrand' | 'onAccent'

type Props = TextProps & {
  variant?: Variant
  tone?: Tone
  heading?: 1 | 2 | 3 | 4 | 5 | 6
  tabular?: boolean
}

export function Text({ variant = 'body', tone = 'ink', heading, tabular, style, ...rest }: Props) {
  const scale = type[variant]
  // React Native's types have no aria-level; the web export passes it through to the heading element.
  const headingProps = (heading === undefined ? {} : { role: 'heading', 'aria-level': heading }) as TextProps
  return (
    <NativeText
      {...rest}
      {...headingProps}
      style={[
        {
          fontFamily: fontFamily(scale.weight),
          fontSize: scale.size,
          lineHeight: scale.lineHeight,
          color: colors[tone],
        },
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
    />
  )
}
