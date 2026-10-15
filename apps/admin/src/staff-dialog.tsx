import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, DialogFooter, ErrorBanner, FormField, Input, Select } from '@shopperstop/ui'
import { api, meQuery, type ApiError, type Staff } from './api'
import { roleNames, staffUsersQuery, withStaff } from './staff'
import type { AdminStore } from './stores'

type Field = 'name' | 'email' | 'password' | 'role' | 'storeId'

// One message per field for core's 400 naming it (core's own messages speak of bytes and ids).
const messages: Record<Field, string> = {
  name: 'Enter 1 to 100 characters.',
  email: 'Enter a valid email address.',
  password: 'Enter 8 to 72 characters.',
  role: 'Choose a role.',
  storeId: 'Choose a store.',
}
const taken = 'A staff user with this email already exists.'

// A button that cannot act now stays focusable: `disabled` would drop keyboard focus from the button just pressed.
const idle = 'aria-disabled:cursor-not-allowed aria-disabled:opacity-50'

// Create (no user) or change a staff user in a dialog. Core changes only the name, the password and the status; `self`
// is the signed-in admin's own row, which cannot be deactivated here. The password lives in this component only: it is
// never shown, and it is gone when the dialog closes.
export function StaffDialog({ user, self, stores, onClose }: { user?: Staff; self: boolean; stores: AdminStore[]; onClose: () => void }) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Staff['role']>('store_staff')
  const [storeId, setStoreId] = useState('')
  const [status, setStatus] = useState(user && !user.isActive ? 'inactive' : 'active')

  // PATCH sends only what differs from the row; an empty password field keeps the password.
  const changes = (from: Staff) => ({
    ...(name !== from.name && { name }),
    ...(password && { password }),
    ...((status === 'active') !== from.isActive && { isActive: status === 'active' }),
  })

  const save = useMutation({
    // The request body holds the password: a finished save is dropped from the mutation cache at once, not kept for five minutes.
    gcTime: 0,
    mutationFn: async () => {
      const { data, error } = user
        ? await api.PATCH('/admin/staff-users/{id}', { params: { path: { id: user.id } }, body: changes(user) })
        : await api.POST('/admin/staff-users', { body: { name, email, password, role, ...(role === 'store_staff' && storeId && { storeId }) } })
      if (error) throw error.error
      return data
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(staffUsersQuery.queryKey, (list) => list && withStaff(list, saved))
      if (self) {
        // The banner shows the signed-in admin's name: the guard reads it again from the session entry.
        queryClient.setQueryData(meQuery.queryKey, saved)
        void router.invalidate()
      }
      onClose()
    },
  })

  // While a save runs the dialog stays: its answer closes it, and must not close a dialog opened since.
  function close() {
    if (!save.isPending) onClose()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (save.isPending) return
    if (user && Object.keys(changes(user)).length === 0) return onClose()
    save.mutate()
  }

  // Any edit clears core's last answer, but never while a save runs: reset() would detach it.
  function edit<Value>(set: (value: Value) => void, value: Value) {
    set(value)
    if (!save.isPending) save.reset()
  }

  // A validation error naming a form field, and the taken email, go to that field; anything else to the banner.
  const apiError = save.error as Partial<ApiError> | null
  const field = apiError?.field && apiError.field in messages ? (apiError.field as Field) : undefined
  const fieldError = field && (apiError?.code === 'validation' ? messages[field] : apiError?.code === 'conflict' && field === 'email' ? taken : undefined)
  const errorFor = (name: Field) => (field === name ? fieldError : undefined)

  return (
    <Dialog open onClose={close} title={user ? `Edit ${user.name}` : 'New staff user'}>
      <form noValidate onSubmit={submit} className="mt-4 flex flex-col gap-4">
        {save.error && !fieldError && <ErrorBanner message="Could not save the staff user. Try again." />}
        {user && (
          <p className="text-body text-ink">
            {user.email}, {roleNames[user.role]}. The email, the role and the store cannot be changed: create a new staff user instead.
          </p>
        )}
        <FormField label="Name" error={errorFor('name')}>
          <Input autoComplete="off" value={name} onChange={(event) => edit(setName, event.target.value)} />
        </FormField>
        {!user && (
          <FormField label="Email" error={errorFor('email')}>
            <Input type="email" autoComplete="off" value={email} onChange={(event) => edit(setEmail, event.target.value)} />
          </FormField>
        )}
        <FormField
          label={user ? 'New password' : 'Password'}
          hint={user ? 'Leave empty to keep the current password. 8 to 72 characters.' : '8 to 72 characters.'}
          error={errorFor('password')}
        >
          <Input type="password" autoComplete="new-password" value={password} onChange={(event) => edit(setPassword, event.target.value)} />
        </FormField>
        {!user && (
          <FormField label="Role" error={errorFor('role')}>
            <Select value={role} onChange={(event) => edit(setRole, event.target.value as Staff['role'])}>
              <option value="store_staff">{roleNames.store_staff}</option>
              <option value="admin">{roleNames.admin}</option>
            </Select>
          </FormField>
        )}
        {!user && role === 'store_staff' && (
          <FormField label="Store" hint="Store staff see this store only." error={errorFor('storeId')}>
            <Select value={storeId} onChange={(event) => edit(setStoreId, event.target.value)}>
              <option value="">Choose a store</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </Select>
          </FormField>
        )}
        {user && !self && (
          <FormField label="Status" hint="Inactive staff cannot sign in and are signed out at once.">
            <Select value={status} onChange={(event) => edit(setStatus, event.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </FormField>
        )}
        {self && <p className="text-small text-ink-muted">You cannot deactivate your own account.</p>}
        <DialogFooter onCancel={close} className="mt-2">
          <Button type="submit" aria-disabled={save.isPending} className={idle}>
            {save.isPending ? 'Saving…' : user ? 'Save changes' : 'Create staff user'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
