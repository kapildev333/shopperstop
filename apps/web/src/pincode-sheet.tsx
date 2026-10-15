import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react'
import { Button, FormField, Input, Sheet } from '@shopperstop/ui'
import { MapPin } from 'lucide-react'
import { useServiceability } from './catalog'
import { closePincodeSheet, openPincodeSheet, pincodePattern, usePincode } from './pincode'
import { changePincode } from './store-change'

export function PincodeSheet() {
  const { pincode, sheetOpen } = usePincode()
  const field = useRef<HTMLInputElement>(null)
  // After Sheet's own focus effect (child effects run first), so the field wins over Close.
  useEffect(() => {
    if (sheetOpen) field.current?.focus()
  }, [sheetOpen])
  return (
    <Sheet open={sheetOpen} onClose={closePincodeSheet} title="Your delivery pincode">
      <PincodeForm pincode={pincode} field={field} />
    </Sheet>
  )
}

// Mounted only while the sheet is open, so each open starts from the stored pincode.
function PincodeForm({ pincode, field }: { pincode?: string; field: RefObject<HTMLInputElement | null> }) {
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = String(new FormData(event.currentTarget).get('pincode') ?? '').trim()
    if (!pincodePattern.test(value)) return setError('Enter a 6-digit pincode')
    setBusy(true)
    void changePincode(value).finally(() => setBusy(false))
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <p className="text-body text-ink-muted">We show the store that delivers to you.</p>
      <FormField label="Pincode" error={error}>
        <Input
          ref={field}
          name="pincode"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
          defaultValue={pincode ?? ''}
        />
      </FormField>
      <Button type="submit" size="lg" className="w-full" loading={busy}>
        Save pincode
      </Button>
    </form>
  )
}

export function PincodeButton() {
  const { pincode } = usePincode()
  const { data } = useServiceability(pincode)
  const open = data?.isOpen ? data : undefined
  return (
    <Button variant="secondary" aria-haspopup="dialog" onClick={openPincodeSheet}>
      <MapPin size={16} aria-hidden />
      {!pincode ? (
        'Enter pincode'
      ) : open ? (
        <span className="flex flex-col items-start leading-tight">
          <span className="whitespace-nowrap">Delivery in {open.promisedMinutes} minutes</span>{' '}
          <span className="text-small">{pincode}</span>
        </span>
      ) : (
        pincode
      )}
    </Button>
  )
}
