import { useState, type FormEvent } from 'react'
import { Button, Dialog, DialogFooter, ErrorBanner, FormField, Input } from '@shopperstop/ui'
import { splitError, type ApiError } from './api'

export type AddressValues = { label: string; line1: string; line2: string; pincode: string }

type Errors = { fields: Record<string, string>; banner?: string }

const none: Errors = { fields: {} }

// Adds when `address` is absent, edits when present. Closes only on success.
export function AddressDialog({
  open,
  address,
  onClose,
  submit,
}: {
  open: boolean
  address?: AddressValues
  onClose: () => void
  submit: (values: AddressValues) => Promise<ApiError | undefined>
}) {
  return (
    <Dialog open={open} onClose={onClose} title={address ? 'Edit address' : 'Add address'}>
      <AddressForm address={address} onClose={onClose} submit={submit} />
    </Dialog>
  )
}

// Mounted only while the dialog is open, so each open starts from fresh defaults.
function AddressForm({
  address,
  onClose,
  submit,
}: {
  address?: AddressValues
  onClose: () => void
  submit: (values: AddressValues) => Promise<ApiError | undefined>
}) {
  const [errors, setErrors] = useState<Errors>(none)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const read = (name: string) => String(form.get(name) ?? '').trim()
    const values = { label: read('label'), line1: read('line1'), line2: read('line2'), pincode: read('pincode') }
    const fields: Record<string, string> = {}
    if (!values.label) fields.label = 'Enter a label'
    if (!values.line1) fields.line1 = 'Enter the first address line'
    if (!/^\d{6}$/.test(values.pincode)) fields.pincode = 'Enter a 6-digit pincode'
    if (Object.keys(fields).length > 0) return setErrors({ fields })
    setPending(true)
    const error = await submit(values)
    setPending(false)
    if (error) return setErrors(splitError(error, ['label', 'line1', 'line2', 'pincode']))
    onClose()
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormField label="Label" hint="Home, Work" error={errors.fields.label}>
        <Input name="label" defaultValue={address?.label} />
      </FormField>
      <FormField label="Address line 1" error={errors.fields.line1}>
        <Input name="line1" defaultValue={address?.line1} />
      </FormField>
      <FormField label="Address line 2" hint="Optional" error={errors.fields.line2}>
        <Input name="line2" defaultValue={address?.line2} />
      </FormField>
      <FormField label="Pincode" error={errors.fields.pincode}>
        <Input name="pincode" inputMode="numeric" autoComplete="postal-code" defaultValue={address?.pincode} />
      </FormField>
      {errors.banner && <ErrorBanner message={errors.banner} />}
      <DialogFooter onCancel={onClose}>
        <Button type="submit" loading={pending}>
          Save address
        </Button>
      </DialogFooter>
    </form>
  )
}
