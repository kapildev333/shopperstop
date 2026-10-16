import { Image, View } from 'react-native'
import { ShoppingBasket } from 'lucide-react-native'
import { colors, radius } from './tokens'

type Props = { uri?: string; size?: number; radius?: 'control' | 'card' }

// A square image on the surface; without a uri, a canvas placeholder with a basket icon.
export function ImageTile({ uri, size, radius: corner = 'control' }: Props) {
  const frame = {
    aspectRatio: 1,
    width: size ?? '100%',
    overflow: 'hidden' as const,
    borderRadius: radius[corner],
    backgroundColor: colors.surface,
  }
  if (!uri) {
    return (
      <View
        testID="image-placeholder"
        style={[frame, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }]}
      >
        <ShoppingBasket size={20} color={colors.inkMuted} />
      </View>
    )
  }
  return (
    <View style={frame}>
      <Image
        testID="image-tile-image"
        source={{ uri }}
        resizeMode="contain"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={{ width: '100%', height: '100%' }}
      />
    </View>
  )
}
