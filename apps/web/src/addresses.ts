import { useQuery } from '@tanstack/react-query'
import type { components } from '@shopperstop/ui/api'
import { api, call, queryClient, type ApiError } from './api'
import type { AddressValues } from './address-dialog'
import { useToken } from './session'

export type Address = components['schemas']['Address']

// ponytail: first page only (the API default of 24); paginate when a customer has more.
export function useAddresses() {
  const token = useToken()
  return useQuery({
    queryKey: ['addresses', token],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await api.GET('/me/addresses')
      if (error || !data) throw error ?? new Error('no answer')
      return data.items
    },
  })
}

// Answers the saved address: the caller chooses it from this answer, not from a refetched list.
export async function addAddress(values: AddressValues): Promise<{ address?: Address; error?: ApiError }> {
  let answer: Address | undefined
  const error = await call(async () => {
    const result = await api.POST('/me/addresses', {
      body: { ...values, line2: values.line2 || undefined, isDefault: false },
    })
    answer = result.data
    return result
  })
  if (error) return { error }
  if (!answer) return { error: { code: 'internal', message: 'Core answered without an address.' } }
  await queryClient.invalidateQueries({ queryKey: ['addresses'] })
  return { address: answer }
}
