import { QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { queryClient } from './api'
import { cartKey } from './cart'
import { fakeCore, apiError, json } from './fake-core'
import { openPincodeSheet } from './pincode'
import { PincodeSheet } from './pincode-sheet'
import { setToken } from './session'

// The device keeps a dialog's children mounted while it fades out; this stand-in does the same, so the closing frame is in the tree.
jest.mock('react-native/Libraries/Modal/Modal', () => {
  const { createElement } = jest.requireActual('react')
  const { View } = jest.requireActual('react-native')
  return {
    __esModule: true,
    default: (props: { children?: unknown }) => createElement(View, null, props.children),
  }
})

const koramangala = {
  id: 's-1',
  name: 'Koramangala',
  isOpen: true,
  deliveryFeeCents: 2500,
  freeDeliveryAboveCents: 19900,
  minOrderCents: 9900,
  promisedMinutes: 10,
}
const indiranagar = { ...koramangala, id: 's-2', name: 'Indiranagar', promisedMinutes: 12 }
const taaza = {
  id: 'p-1',
  name: 'Amul Taaza',
  slug: 'amul-taaza',
  unitLabel: '500 ml',
  mrpCents: 2900,
  priceCents: 2700,
  inStock: true,
  quantity: 5,
}

test('a dialog closing after Keep still names the switch it was asked', async () => {
  fakeCore({
    'GET /serviceability': (request) => {
      const pincode = new URL(request.url).searchParams.get('pincode') ?? ''
      const store = { '560034': koramangala, '560038': indiranagar }[pincode]
      return store ? json(200, { store }) : apiError(404, 'not_serviceable')
    },
  })
  setToken('t-1')
  queryClient.setQueryData(cartKey('t-1'), {
    storeId: koramangala.id,
    items: [{ product: taaza, quantity: 2 }],
    subtotalCents: 5400,
    deliveryFeeCents: 2500,
    totalCents: 7900,
    minOrderCents: 9900,
    shortfallCents: 14500,
  })
  await render(
    <QueryClientProvider client={queryClient}>
      <PincodeSheet />
    </QueryClientProvider>,
  )
  await act(async () => {
    openPincodeSheet()
  })
  await fireEvent.changeText(screen.getByLabelText('Pincode'), '560038')
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }))
  await screen.findByRole('heading', { name: 'Switch to the Indiranagar store?' })

  await fireEvent.press(screen.getByRole('button', { name: 'Keep cart' }))

  expect(screen.getByText(/Pincode 560038 is served by a different store/)).toBeTruthy()
  expect(screen.getByText(/Your cart has 2 items from Koramangala/)).toBeTruthy()
  expect(screen.queryByText(/undefined/)).toBeNull()
  expect(screen.getByRole('heading', { name: 'Switch to the Indiranagar store?' })).toBeTruthy()
})
