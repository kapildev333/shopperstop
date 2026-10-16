import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { AddressSheet } from './address-sheet'
import { apiError, fakeCore, json } from './fake-core'

const id = '3c0d6a8e-7f1b-4d2a-9e44-5b6c7d8e9f01'
const gym = { id, label: 'Gym', line1: '5 Lake Rd', pincode: '560001', isDefault: false }

test('address added', async () => {
  const calls = fakeCore({
    'POST /me/addresses': () => json(201, { id, label: 'Work', line1: '1 Park St', pincode: '560038', isDefault: true }),
  })
  const onClose = jest.fn()
  await render(<AddressSheet open onClose={onClose} />)

  await fireEvent.press(screen.getByRole('button', { name: 'Work' }))
  await fireEvent.changeText(screen.getByLabelText('House, flat, floor'), '1 Park St')
  await fireEvent.changeText(screen.getByLabelText('Pincode'), '560038')
  await fireEvent(screen.getByRole('switch', { name: 'Make this my default address' }), 'valueChange', true)
  await fireEvent.press(screen.getByRole('button', { name: 'Save address' }))

  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  expect(calls).toHaveLength(1)
  expect(calls[0].method).toBe('POST')
  expect(await calls[0].json()).toEqual({ label: 'Work', line1: '1 Park St', pincode: '560038', isDefault: true })
})

test('edit sheet prefilled', async () => {
  const calls = fakeCore({
    [`PATCH /me/addresses/${id}`]: () => json(200, gym),
  })
  const onClose = jest.fn()
  await render(<AddressSheet open address={gym} onClose={onClose} />)

  expect(screen.getByRole('heading', { name: 'Edit address' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Gym' })).toHaveProp('accessibilityState', { selected: true })
  expect(screen.getByLabelText('House, flat, floor')).toHaveProp('value', '5 Lake Rd')
  expect(screen.getByLabelText('Pincode')).toHaveProp('value', '560001')
  expect(screen.getByRole('switch', { name: 'Make this my default address' })).toHaveProp('value', false)

  await fireEvent.press(screen.getByRole('button', { name: 'Save address' }))

  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  expect(calls[0].method).toBe('PATCH')
  expect(new URL(calls[0].url).pathname).toBe(`/api/core/v1/me/addresses/${id}`)
})

test('address sheet checks fields', async () => {
  const calls = fakeCore({})
  const onClose = jest.fn()
  await render(<AddressSheet open onClose={onClose} />)

  await fireEvent.changeText(screen.getByLabelText('Pincode'), '5600')
  await fireEvent.press(screen.getByRole('button', { name: 'Save address' }))

  expect(await screen.findByText('Enter house, flat or floor')).toBeTruthy()
  expect(screen.getByText('Enter a 6-digit pincode')).toBeTruthy()
  expect(calls).toHaveLength(0)
  expect(onClose).not.toHaveBeenCalled()
})

test('envelope field error in the sheet', async () => {
  fakeCore({
    'POST /me/addresses': () => apiError(400, 'validation', 'Pincode is not valid', 'pincode'),
  })
  const onClose = jest.fn()
  await render(<AddressSheet open onClose={onClose} />)

  await fireEvent.changeText(screen.getByLabelText('House, flat, floor'), '1 Park St')
  await fireEvent.changeText(screen.getByLabelText('Pincode'), '560038')
  await fireEvent.press(screen.getByRole('button', { name: 'Save address' }))

  expect(await screen.findByText('Pincode is not valid')).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Add address' })).toBeTruthy()
  expect(onClose).not.toHaveBeenCalled()
})
