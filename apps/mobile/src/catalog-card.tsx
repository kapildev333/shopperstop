import { Link } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'
import { imageUri, stockLabel, type Category, type StoreProduct } from './catalog'
import { useLineWrite, useQuantity } from './cart'
import { CartWriteAlert } from './cart-alert'
import { Badge } from './ui/badge'
import { Price } from './ui/price'
import { Stepper } from './ui/stepper'
import { Text } from './ui/text'
import { ImageTile } from './ui/image-tile'
import { colors, fontFamily, radius, spacing } from './ui/tokens'

// The product card: one link to the product, its price and the stepper that counts it in the cart.
export function ProductCard({ product, storeId }: { product: StoreProduct; storeId: string }) {
  const count = useQuantity(product.id)
  const [failure, write] = useLineWrite(storeId, product)
  const stock = product.inStock ? stockLabel(product.quantity) : undefined
  return (
    <View style={styles.card}>
      <Link href={`/product/${product.slug}`} asChild>
        <Pressable accessibilityRole="link" accessibilityLabel={`${product.name} ${product.unitLabel}`} style={styles.link}>
          <ImageTile uri={imageUri(product.imageUrl)} radius="card" />
          {stock ? <Badge variant={product.quantity >= 10 ? 'neutral' : 'warning'}>{stock}</Badge> : null}
          <Text variant="body" style={styles.name} numberOfLines={2}>
            {product.name}
          </Text>
          <Text variant="small" tone="inkMuted">
            {product.unitLabel}
          </Text>
        </Pressable>
      </Link>
      <View style={styles.bar}>
        <Price cents={product.priceCents} mrpCents={product.mrpCents} layout="column" />
        <Stepper
          label={product.name}
          value={count}
          max={product.inStock ? product.quantity : 0}
          onChange={write}
        />
      </View>
      <CartWriteAlert message={failure} />
    </View>
  )
}

// Home's and the Categories tab's parent tiles: four to a row, each opening its category.
export function CategoryGrid({ categories }: { categories: Category[] }) {
  return (
    <View style={styles.categories}>
      {categories.map((category) => (
        <Link key={category.id} href={`/category/${category.slug}`} asChild>
          <Pressable accessibilityRole="link" accessibilityLabel={category.name} style={styles.tile}>
            <ImageTile uri={imageUri(category.imageUrl)} radius="card" />
            <Text variant="small" style={styles.tileName} numberOfLines={2}>
              {category.name}
            </Text>
          </Pressable>
        </Link>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: spacing.unit * 2,
    gap: spacing.unit,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  link: { gap: spacing.unit },
  name: { minHeight: 40 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.unit, marginTop: spacing.unit },
  categories: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.gridGap },
  tile: { width: '23%', gap: 6, alignItems: 'center' },
  tileName: { textAlign: 'center', fontFamily: fontFamily(600) },
})
