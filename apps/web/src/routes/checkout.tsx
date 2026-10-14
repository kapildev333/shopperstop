import { createFileRoute, Navigate } from '@tanstack/react-router'
import { CheckoutPage } from '../checkout'
import { useToken } from '../session'

function Checkout() {
  const token = useToken()
  if (!token) return <Navigate to="/sign-in" search={{ returnTo: '/checkout' }} replace />
  return <CheckoutPage />
}

export const Route = createFileRoute('/checkout')({
  component: Checkout,
})
