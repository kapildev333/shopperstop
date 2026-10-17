import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import type { components } from '@shopperstop/ui/api'
import { Button, ErrorBanner, FormField, Input, Select, StatusMessage } from '@shopperstop/ui'
import { api, type ApiError } from './api'
import { storeQuery, toCents, toRupees, type AdminStore } from './stores'

type StoreCreate = components['schemas']['StoreCreate']
type StorePatch = components['schemas']['StorePatch']
// Every field as typed; the location is two of them, `lat` and `lng`, and becomes `location` on submit.
type Field = keyof Omit<StoreCreate, 'location'> | 'lat' | 'lng'
type Values = Record<Field, string>

const rupees = 'Enter 0 to 100000 rupees, at most two decimals.'

// One message per field: for a value the form cannot send, and for core's 400 naming the field (core's messages speak in cents).
const messages: Record<Field, string> = {
  name: 'Enter 1 to 100 characters.',
  city: 'Enter at most 100 characters.',
  addressLine: 'Enter 1 to 200 characters.',
  pincode: 'Enter a 6-digit pincode.',
  isOpen: 'Choose open or closed.',
  deliveryFeeCents: rupees,
  freeDeliveryAboveCents: rupees,
  minOrderCents: rupees,
  promisedMinutes: 'Enter 1 to 240 minutes.',
  lat: 'Enter a latitude from -90 to 90.',
  lng: 'Enter a longitude from -180 to 180.',
}
const pair = 'Enter both latitude and longitude, or neither.'
// Core names a location's errors `location` (a half missing), `location.lat` or `location.lng` (out of range).
const coreFields: Record<string, [Field, string]> = { location: ['lat', pair], 'location.lat': ['lat', messages.lat], 'location.lng': ['lng', messages.lng] }

function initial(store?: AdminStore): Values {
  return {
    name: store?.name ?? '',
    city: store?.city ?? '',
    addressLine: store?.addressLine ?? '',
    pincode: store?.pincode ?? '',
    isOpen: store?.isOpen ? 'open' : 'closed',
    deliveryFeeCents: toRupees(store?.deliveryFeeCents ?? 0),
    freeDeliveryAboveCents: toRupees(store?.freeDeliveryAboveCents ?? 0),
    minOrderCents: toRupees(store?.minOrderCents ?? 0),
    promisedMinutes: store ? String(store.promisedMinutes) : '',
    lat: store?.location ? String(store.location.lat) : '',
    lng: store?.location ? String(store.location.lng) : '',
  }
}

// The request body for the values, and the fields that cannot be sent. Text goes as typed: core trims and checks it.
function parse(values: Values, store?: AdminStore): [StoreCreate, Partial<Values>] {
  const errors: Partial<Values> = {}
  const cents = (field: 'deliveryFeeCents' | 'freeDeliveryAboveCents' | 'minOrderCents') => {
    const value = toCents(values[field])
    if (value === undefined) errors[field] = messages[field]
    return value ?? 0
  }
  const minutes = /^\d{1,3}$/.test(values.promisedMinutes.trim()) ? Number(values.promisedMinutes) : undefined
  if (minutes === undefined) errors.promisedMinutes = messages.promisedMinutes
  // Both coordinates, or no location; a store's location can be replaced, never removed (core has no way to clear it).
  const coordinate = (field: 'lat' | 'lng', limit: number) => {
    const text = values[field].trim()
    const value = /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : NaN
    if (text && !(Math.abs(value) <= limit)) errors[field] = messages[field]
    return text ? value : undefined
  }
  const lat = coordinate('lat', 90)
  const lng = coordinate('lng', 180)
  if (lat === undefined && lng !== undefined) errors.lat = pair
  if (lng === undefined && lat !== undefined) errors.lng = pair
  if (lat === undefined && lng === undefined && store?.location) errors.lat = 'A location can be changed but not removed.'
  const location = lat !== undefined && lng !== undefined ? { lat, lng } : undefined
  const body: StoreCreate = {
    name: values.name,
    city: values.city,
    addressLine: values.addressLine,
    pincode: values.pincode.trim(),
    isOpen: values.isOpen === 'open',
    deliveryFeeCents: cents('deliveryFeeCents'),
    freeDeliveryAboveCents: cents('freeDeliveryAboveCents'),
    minOrderCents: cents('minOrderCents'),
    promisedMinutes: minutes ?? 0,
    ...(location && { location }),
  }
  return [body, errors]
}

// PATCH sends only what differs from the loaded store; never null. The location goes whole when either coordinate moved.
function changed({ location, ...body }: StoreCreate, store: AdminStore): StorePatch {
  const patch: StorePatch = Object.fromEntries(Object.entries(body).filter(([key, value]) => (store[key as keyof typeof body] ?? '') !== value))
  if (location && (location.lat !== store.location?.lat || location.lng !== store.location?.lng)) patch.location = location
  return patch
}

// Where core's 400 goes on the form, and the form's own message for it.
function fieldError(error?: ApiError): [Field, string] | undefined {
  const field = error?.code === 'validation' ? error.field : undefined
  if (!field) return undefined
  return coreFields[field] ?? (field in messages ? [field as Field, messages[field as Field]] : undefined)
}

// Create when there is no store (then open it), change it otherwise.
export function StoreForm({ store }: { store?: AdminStore }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [values, setValues] = useState(() => initial(store))
  const [errors, setErrors] = useState<Partial<Values>>({})

  const save = useMutation({
    mutationFn: async (body: StoreCreate) => {
      const { data, error } = store
        ? await api.PATCH('/admin/stores/{id}', { params: { path: { id: store.id } }, body: changed(body, store) })
        : await api.POST('/admin/stores', { body })
      if (error) throw error.error
      return data
    },
    onSuccess: async (saved) => {
      queryClient.setQueryData(storeQuery(saved.id).queryKey, saved)
      if (!store) await navigate({ to: '/stores/$storeId', params: { storeId: saved.id } })
    },
  })

  function set(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    save.reset()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const [body, found] = parse(values, store)
    setErrors(found)
    if (Object.keys(found).length === 0) save.mutate(body)
  }

  // A validation error naming a form field goes to that field; anything else to the banner.
  const apiError = save.error && 'code' in save.error ? (save.error as ApiError) : undefined
  const serverError = fieldError(apiError)
  const serverField = serverError?.[0]
  const errorFor = (field: Field) => errors[field] ?? (serverField === field ? serverError?.[1] : undefined)
  const text = (field: Field, label: string, props: { inputMode?: 'numeric' | 'decimal'; hint?: string } = {}) => (
    <FormField label={label} hint={props.hint} error={errorFor(field)}>
      <Input inputMode={props.inputMode} value={values[field]} onChange={(event) => set(field, event.target.value)} />
    </FormField>
  )

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      {save.error && !serverField && <ErrorBanner message="Could not save the store. Try again." />}
      {text('name', 'Name')}
      {text('addressLine', 'Address')}
      {text('city', 'City', { hint: 'Optional.' })}
      {text('lat', 'Latitude', { hint: 'Optional, with the longitude. Degrees, for example 12.9352.' })}
      {text('lng', 'Longitude', { hint: 'Optional, with the latitude. Degrees, for example 77.6245.' })}
      {text('pincode', 'Pincode', { inputMode: 'numeric' })}
      {text('deliveryFeeCents', 'Delivery fee (₹)', { inputMode: 'decimal' })}
      {text('freeDeliveryAboveCents', 'Free delivery above (₹)', { inputMode: 'decimal', hint: '0 means delivery is always free.' })}
      {text('minOrderCents', 'Minimum order (₹)', { inputMode: 'decimal', hint: '0 means no minimum.' })}
      {text('promisedMinutes', 'Promised minutes', { inputMode: 'numeric' })}
      <FormField label="Status" hint="A closed store takes no new orders." error={errorFor('isOpen')}>
        <Select value={values.isOpen} onChange={(event) => set('isOpen', event.target.value)}>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </Select>
      </FormField>
      {store && save.isSuccess && <StatusMessage tone="success">Store saved.</StatusMessage>}
      <div>
        <Button type="submit" loading={save.isPending}>{store ? 'Save changes' : 'Create store'}</Button>
      </div>
    </form>
  )
}
