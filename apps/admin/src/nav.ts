import type { Staff } from './api'

const links = [
  { to: '/', label: 'Dashboard', adminOnly: false },
  { to: '/orders', label: 'Orders', adminOnly: false },
  { to: '/stock', label: 'Stock', adminOnly: false },
  { to: '/stores', label: 'Stores', adminOnly: true },
  { to: '/categories', label: 'Categories', adminOnly: true },
  { to: '/products', label: 'Products', adminOnly: true },
  { to: '/staff', label: 'Staff', adminOnly: true },
] as const

export function navLinks(role: Staff['role']) {
  return links.filter((link) => role === 'admin' || !link.adminOnly)
}
