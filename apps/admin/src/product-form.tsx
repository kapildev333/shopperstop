import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import type { components } from '@shopperstop/ui/api'
import { Button, ErrorBanner, FormField, Input, Select, StatusMessage } from '@shopperstop/ui'
import { api, type ApiError } from './api'
import { productQuery, type Product } from './catalog'
import { toCents, toRupees } from './stores'

type ProductCreate = Required<components['schemas']['ProductCreate']>
type Field = keyof ProductCreate
type Values = Record<Field, string>

// One message per field: for a value the form cannot send, and for core's 400 naming the field (core's messages speak in cents).
const messages: Record<Field, string> = {
  name: 'Enter 1 to 100 characters.',
  brand: 'Enter at most 60 characters.',
  categoryId: 'Choose a category.',
  unitLabel: 'Enter 1 to 30 characters, for example 500 g.',
  mrpCents: 'Enter 0.01 to 1000000 rupees, at most two decimals.',
  priceCents: 'Enter a price from 0.01 rupees up to the MRP, at most two decimals.',
  description: 'Enter at most 2000 characters.',
  isActive: 'Choose active or inactive.',
}

function initial(product?: Product): Values {
  return {
    name: product?.name ?? '',
    brand: product?.brand ?? '',
    categoryId: product?.categoryId ?? '',
    unitLabel: product?.unitLabel ?? '',
    mrpCents: product ? toRupees(product.mrpCents) : '',
    priceCents: product ? toRupees(product.priceCents) : '',
    description: product?.description ?? '',
    isActive: !product || product.isActive ? 'active' : 'inactive',
  }
}

// The request body for the values, and the amounts that cannot be sent. Text goes as typed: core trims and checks it.
function parse(values: Values): [ProductCreate, Partial<Values>] {
  const errors: Partial<Values> = {}
  const cents = (field: 'mrpCents' | 'priceCents') => {
    const value = toCents(values[field])
    if (value === undefined) errors[field] = messages[field]
    return value ?? 0
  }
  const body: ProductCreate = {
    name: values.name,
    brand: values.brand,
    categoryId: values.categoryId,
    unitLabel: values.unitLabel,
    mrpCents: cents('mrpCents'),
    priceCents: cents('priceCents'),
    description: values.description,
    isActive: values.isActive === 'active',
  }
  return [body, errors]
}

// PATCH sends only what differs from what the form would send for the loaded product; never null, "" clears brand or description.
function changed(body: ProductCreate, product: Product) {
  const [base] = parse(initial(product))
  return Object.fromEntries(Object.entries(body).filter(([key, value]) => base[key as Field] !== value))
}

// Create when there is no product (then open it), change it otherwise.
export function ProductForm({ product, categories }: { product?: Product; categories: { id: string; label: string }[] }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [values, setValues] = useState(() => initial(product))
  const [errors, setErrors] = useState<Partial<Values>>({})

  const save = useMutation({
    mutationFn: async (body: ProductCreate) => {
      const { data, error } = product
        ? await api.PATCH('/admin/products/{id}', { params: { path: { id: product.id } }, body: changed(body, product) })
        : await api.POST('/admin/products', { body })
      if (error) throw error.error
      return data
    },
    onSuccess: async (saved) => {
      queryClient.setQueryData(productQuery(saved.id).queryKey, saved)
      if (!product) await navigate({ to: '/products/$productId', params: { productId: saved.id } })
    },
  })

  function set(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    save.reset()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const [body, found] = parse(values)
    setErrors(found)
    if (Object.keys(found).length === 0) save.mutate(body)
  }

  // A validation error naming a form field goes to that field; anything else to the banner.
  const apiError = save.error as Partial<ApiError> | null
  const serverField = apiError?.code === 'validation' && apiError.field && apiError.field in messages ? (apiError.field as Field) : undefined
  const errorFor = (field: Field) => errors[field] ?? (serverField === field ? messages[field] : undefined)
  const text = (field: Field, label: string, props: { inputMode?: 'decimal'; hint?: string } = {}) => (
    <FormField label={label} hint={props.hint} error={errorFor(field)}>
      <Input inputMode={props.inputMode} value={values[field]} onChange={(event) => set(field, event.target.value)} />
    </FormField>
  )

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      {save.error && !serverField && <ErrorBanner message="Could not save the product. Try again." />}
      {text('name', 'Name')}
      {text('brand', 'Brand', { hint: 'Optional.' })}
      <FormField label="Category" error={errorFor('categoryId')}>
        <Select value={values.categoryId} onChange={(event) => set('categoryId', event.target.value)}>
          <option value="">Choose a category</option>
          {categories.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </Select>
      </FormField>
      {text('unitLabel', 'Unit', { hint: 'For example 500 g, 1 L or 6 pcs.' })}
      {text('mrpCents', 'MRP (₹)', { inputMode: 'decimal' })}
      {text('priceCents', 'Price (₹)', { inputMode: 'decimal', hint: 'At most the MRP.' })}
      {text('description', 'Description', { hint: 'Optional.' })}
      <FormField label="Status" hint="Customers do not see inactive products." error={errorFor('isActive')}>
        <Select value={values.isActive} onChange={(event) => set('isActive', event.target.value)}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </FormField>
      {product && save.isSuccess && <StatusMessage tone="success">Product saved.</StatusMessage>}
      <div>
        <Button type="submit" loading={save.isPending}>{product ? 'Save changes' : 'Create product'}</Button>
      </div>
    </form>
  )
}
