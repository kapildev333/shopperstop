import { useState } from 'react'
import type { StoreProduct } from './catalog'

// ponytail: a local count per mounted card, nothing persisted, lost on navigation; web-P2-L3 replaces the body and keeps the signature.
export function useCartQuantity(product: StoreProduct) {
  const [quantity, setQuantity] = useState(0)
  return [quantity, (next: number) => setQuantity(Math.min(next, product.quantity))] as const
}
