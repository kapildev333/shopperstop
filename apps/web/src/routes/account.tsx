import { useState, type FormEvent } from 'react'
import { createFileRoute, Link, Navigate, useNavigate } from '@tanstack/react-router'
import { Badge, Button, Card, EmptyState, ErrorBanner, FormField, Input, PageHeader, Skeleton, StatusMessage, buttonClass } from '@shopperstop/ui'
import type { components } from '@shopperstop/ui/api'
import { AddressDialog, type AddressValues } from '../address-dialog'
import { addAddress, useAddresses } from '../addresses'
import { api, call, queryClient, splitError, useMe, type ApiError } from '../api'
import { signOutAndGoHome } from '../auth'
import { useToken } from '../session'
import { VerifyEmailBanner } from '../verify-email-banner'

type Address = components['schemas']['Address']
type Errors = { fields: Record<string, string>; banner?: string }

const none: Errors = { fields: {} }

function Account() {
  const token = useToken()
  if (!token) return <Navigate to="/sign-in" search={{ returnTo: '/account' }} replace />
  return <AccountPage />
}

function AccountPage() {
  const navigate = useNavigate()
  async function onSignOut() {
    // Leave the page first: dropping the token while it is mounted would redirect to sign-in.
    await signOutAndGoHome(() => navigate({ to: '/' }))
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Your account"
        actions={
          <>
            <Link to="/orders" className={buttonClass({ variant: 'secondary' })}>
              Your orders
            </Link>
            <Button variant="secondary" onClick={onSignOut}>
              Sign out
            </Button>
          </>
        }
      />
      <VerifyEmailBanner />
      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileCard />
        <AddressesCard />
      </div>
    </div>
  )
}

function ProfileCard() {
  const me = useMe()
  const [errors, setErrors] = useState<Errors>(none)
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const phone = String(form.get('phone') ?? '').trim()
    setSaved(false)
    if (!name) return setErrors({ fields: { name: 'Enter your name' } })
    setPending(true)
    // An empty phone is sent as "" so core clears it.
    const error = await call(() => api.PATCH('/me', { body: { name, phone } }))
    setPending(false)
    setErrors(splitError(error, ['name', 'phone']))
    if (!error) {
      setSaved(true)
      await queryClient.invalidateQueries({ queryKey: ['me'] })
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-6">
      <h2 className="text-h2 text-ink">Profile</h2>
      {me.data ? (
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
          <FormField label="Name" error={errors.fields.name}>
            <Input name="name" autoComplete="name" defaultValue={me.data.name} />
          </FormField>
          <FormField label="Phone" error={errors.fields.phone}>
            <Input name="phone" type="tel" autoComplete="tel" defaultValue={me.data.phone} />
          </FormField>
          {errors.banner && <ErrorBanner message={errors.banner} />}
          {saved && <StatusMessage tone="success">Saved</StatusMessage>}
          <div>
            <Button type="submit" loading={pending}>
              Save
            </Button>
          </div>
        </form>
      ) : me.isError ? (
        <ErrorBanner message="Could not load your profile." onRetry={() => void me.refetch()} />
      ) : (
        <Skeleton variant="list" count={2} />
      )}
    </Card>
  )
}

function toValues(address: Address): AddressValues {
  return { label: address.label, line1: address.line1, line2: address.line2 ?? '', pincode: address.pincode }
}

function AddressesCard() {
  const addresses = useAddresses()
  // null = dialog closed; {} = adding; { address } = editing that address.
  const [dialog, setDialog] = useState<{ address?: Address } | null>(null)
  const [actionError, setActionError] = useState<string>()

  // Adds or edits; the dialog stays open on error and closes on success.
  async function saveAddress(values: AddressValues, id?: string): Promise<ApiError | undefined> {
    if (!id) return (await addAddress(values)).error
    const error = await call(() => api.PATCH('/me/addresses/{id}', { params: { path: { id } }, body: values }))
    if (!error) await queryClient.invalidateQueries({ queryKey: ['addresses'] })
    return error
  }

  // Row actions report failures in one banner at the top of the card.
  async function rowAction(request: () => Promise<{ error?: { error: ApiError } }>) {
    const error = await call(request)
    setActionError(error?.message)
    if (!error) await queryClient.invalidateQueries({ queryKey: ['addresses'] })
  }

  const addButton = (
    <Button variant="secondary" onClick={() => setDialog({})}>
      Add address
    </Button>
  )

  return (
    <Card className="flex flex-col gap-4 p-6">
      <h2 className="text-h2 text-ink">Addresses</h2>
      {actionError && <ErrorBanner message={actionError} />}
      {addresses.data ? (
        addresses.data.length === 0 ? (
          <EmptyState title="No addresses yet" description="Add one to check out faster." action={addButton} />
        ) : (
          <>
            <ul className="flex flex-col">
              {addresses.data.map((address) => (
                <li key={address.id} className="flex flex-col gap-1 border-t border-line py-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-h3 text-ink">{address.label}</h3>
                    {address.isDefault && <Badge variant="accent">Default</Badge>}
                  </div>
                  <p className="text-body text-ink">{address.line1}</p>
                  {address.line2 && <p className="text-body text-ink">{address.line2}</p>}
                  <p className="text-body text-ink-muted tabular-nums">{address.pincode}</p>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="ghost" aria-label={`Edit ${address.label}`} onClick={() => setDialog({ address })}>
                      Edit
                    </Button>
                    {!address.isDefault && (
                      <Button
                        variant="ghost"
                        aria-label={`Set ${address.label} as default`}
                        onClick={() =>
                          rowAction(() =>
                            api.PATCH('/me/addresses/{id}', { params: { path: { id: address.id } }, body: { isDefault: true } }),
                          )
                        }
                      >
                        Set as default
                      </Button>
                    )}
                    <Button
                      variant="ghost-danger"
                      aria-label={`Delete ${address.label}`}
                      onClick={() => rowAction(() => api.DELETE('/me/addresses/{id}', { params: { path: { id: address.id } } }))}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <div>{addButton}</div>
          </>
        )
      ) : addresses.isError ? (
        <ErrorBanner message="Could not load your addresses." onRetry={() => void addresses.refetch()} />
      ) : (
        <Skeleton variant="list" count={2} />
      )}
      <AddressDialog
        open={dialog !== null}
        address={dialog?.address && toValues(dialog.address)}
        onClose={() => setDialog(null)}
        submit={(values) => saveAddress(values, dialog?.address?.id)}
      />
    </Card>
  )
}

export const Route = createFileRoute('/account')({
  component: Account,
})
