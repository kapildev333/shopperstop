// Whole rupees print without decimals; paise print with two. Full ICU is required (Node and every browser ship it).
export function formatInr(cents: number): string {
  const f = cents % 100 === 0 ? 0 : 2
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: f,
    maximumFractionDigits: f,
  }).format(cents / 100)
}
