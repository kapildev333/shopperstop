import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@shopperstop/ui'
import { getPincode, openPincodeSheet } from '../pincode'
import { StoreGate } from '../store-gate'

function Home() {
  // Every visit without a stored pincode asks for one; closing the sheet leaves the "Set your pincode" notice.
  useEffect(() => {
    if (!getPincode()) openPincodeSheet()
  }, [])
  return (
    <StoreGate title="Groceries in minutes">
      {() => <PageHeader title="Groceries in minutes" />}
    </StoreGate>
  )
}

export const Route = createFileRoute('/')({
  component: Home,
})
