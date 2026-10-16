import { useQuery } from '@tanstack/react-query'
import type { components } from '@shopperstop/ui/api'
import { api, call, queryClient, unreachable, type ApiError } from './api'
import { useToken } from './session'

export type Address = components['schemas']['Address']

export type AddressValues = { label: string; line1: string; line2: string; pincode: string; isDefault: boolean }

// ponytail: first page only (the API default of 24); paginate when a customer has more.
export function useAddresses() {
  const token = useToken()
  return useQuery({
    queryKey: ['addresses', token],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await api.GET('/me/addresses')
      if (error) throw error.error
      if (!data) throw unreachable
      return data.items
    },
  })
}

// Runs one address write; on success the address lists are read again.
async function changeAddresses(request: () => Promise<{ error?: { error: ApiError } }>): Promise<ApiError | undefined> {
  const error = await call(request)
  if (!error) await queryClient.invalidateQueries({ queryKey: ['addresses'] })
  return error
}

// Adds when `id` is absent, edits when present. An empty line2 is omitted on POST and sent as '' on PATCH, which clears it.
export function saveAddress(id: string | undefined, values: AddressValues): Promise<ApiError | undefined> {
  return changeAddresses(() =>
    id === undefined
      ? api.POST('/me/addresses', { body: { ...values, line2: values.line2 || undefined } })
      : api.PATCH('/me/addresses/{id}', { params: { path: { id } }, body: values }),
  )
}

export function setDefaultAddress(id: string): Promise<ApiError | undefined> {
  return changeAddresses(() => api.PATCH('/me/addresses/{id}', { params: { path: { id } }, body: { isDefault: true } }))
}

export function deleteAddress(id: string): Promise<ApiError | undefined> {
  return changeAddresses(() => api.DELETE('/me/addresses/{id}', { params: { path: { id } } }))
}
