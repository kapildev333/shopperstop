import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, DialogFooter, ErrorBanner, FormField, Input, Select } from '@shopperstop/ui'
import { riderApi, type ApiError, type Rider } from './api'
import type { AdminStore } from './stores'

type Field = 'name' | 'email' | 'phone' | 'password' | 'storeId'

// One message per field for the rider service's 400 naming it.
const messages: Record<Field, string> = {
  name: 'Enter 1 to 100 characters.',
  email: 'Enter a valid email address.',
  phone: 'Enter 10 to 15 digits, with an optional + in front.',
  password: 'Enter 8 to 72 characters.',
  storeId: 'Choose a store.',
}
const taken = 'A rider with this email already exists.'

// Create (no rider) or change a rider. `stores` is the admin's store choice; store staff pass `ownStoreId` and get no
// store field. The service changes the name, the phone, the password and the status; never the email or the store.
export function RiderDialog({ rider, stores, ownStoreId, defaultStoreId, onClose }: { rider?: Rider; stores?: AdminStore[]; ownStoreId?: string; defaultStoreId?: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(rider?.name ?? '')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState(rider?.phone ?? '')
  const [password, setPassword] = useState('')
  const [storeId, setStoreId] = useState(ownStoreId ?? defaultStoreId ?? '')
  const [status, setStatus] = useState(rider && !rider.isActive ? 'inactive' : 'active')

  // PATCH sends only what differs from the row; an empty password keeps it, an empty phone removes it.
  const changes = (from: Rider) => ({
    ...(name !== from.name && { name }),
    ...(phone !== (from.phone ?? '') && { phone }),
    ...(password && { password }),
    ...((status === 'active') !== from.isActive && { isActive: status === 'active' }),
  })

  const save = useMutation({
    // The request body holds the password: a finished save is dropped from the mutation cache at once.
    gcTime: 0,
    mutationFn: async () => {
      const { data, error } = rider
        ? await riderApi.PATCH('/admin/riders/{id}', { params: { path: { id: rider.id } }, body: changes(rider) })
        : await riderApi.POST('/admin/riders', { body: { storeId, email, name, password, ...(phone && { phone }) } })
      if (error) throw error.error
      return data
    },
    onSuccess: async () => {
      // ponytail: every riders list is read again (one GET) instead of writing the answer in; fine at 100 riders a list.
      await queryClient.invalidateQueries({ queryKey: ['rider', 'riders'] })
      onClose()
    },
  })

  function close() {
    if (!save.isPending) onClose()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (save.isPending) return
    if (rider && Object.keys(changes(rider)).length === 0) return onClose()
    save.mutate()
  }

  // Any edit clears the last answer, but never while a save runs: reset() would detach it.
  function edit<Value>(set: (value: Value) => void, value: Value) {
    set(value)
    if (!save.isPending) save.reset()
  }

  const apiError = save.error as Partial<ApiError> | null
  const field = apiError?.field && apiError.field in messages ? (apiError.field as Field) : undefined
  const fieldError = field && (apiError?.code === 'validation' ? messages[field] : apiError?.code === 'conflict' && field === 'email' ? taken : undefined)
  const errorFor = (name: Field) => (field === name ? fieldError : undefined)

  return (
    <Dialog open onClose={close} title={rider ? `Edit ${rider.name}` : 'New rider'}>
      <form noValidate onSubmit={submit} className="mt-4 flex flex-col gap-4">
        {save.error && !fieldError && <ErrorBanner message="Could not save the rider. Try again." />}
        {rider && <p className="text-body text-ink">{rider.email}. The email and the store cannot be changed: create a new rider instead.</p>}
        <FormField label="Name" error={errorFor('name')}>
          <Input autoComplete="off" value={name} onChange={(event) => edit(setName, event.target.value)} />
        </FormField>
        {!rider && (
          <FormField label="Email" error={errorFor('email')}>
            <Input type="email" autoComplete="off" value={email} onChange={(event) => edit(setEmail, event.target.value)} />
          </FormField>
        )}
        <FormField label="Phone" hint={rider ? 'Leave empty to remove the phone number.' : 'Optional. 10 to 15 digits, with an optional + in front.'} error={errorFor('phone')}>
          <Input type="tel" autoComplete="off" value={phone} onChange={(event) => edit(setPhone, event.target.value)} />
        </FormField>
        <FormField
          label={rider ? 'New password' : 'Password'}
          hint={rider ? 'Leave empty to keep the current password. 8 to 72 characters.' : '8 to 72 characters.'}
          error={errorFor('password')}
        >
          <Input type="password" autoComplete="new-password" value={password} onChange={(event) => edit(setPassword, event.target.value)} />
        </FormField>
        {!rider && !ownStoreId && (
          <FormField label="Store" error={errorFor('storeId')}>
            <Select value={storeId} onChange={(event) => edit(setStoreId, event.target.value)}>
              <option value="">Choose a store</option>
              {stores?.map((store) => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </Select>
          </FormField>
        )}
        {rider && (
          <FormField label="Status" hint="Inactive riders cannot sign in and are signed out at once.">
            <Select value={status} onChange={(event) => edit(setStatus, event.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </FormField>
        )}
        <DialogFooter onCancel={close} className="mt-2">
          <Button type="submit" aria-disabled={save.isPending}>
            {save.isPending ? 'Saving…' : rider ? 'Save changes' : 'Create rider'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
