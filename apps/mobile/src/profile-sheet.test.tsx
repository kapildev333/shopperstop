import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { queryClient } from './api'
import { apiError, fakeCore, json } from './fake-core'
import { ProfileSheet } from './profile-sheet'
import { setToken } from './session'

const customer = { id: '6f1c2a9e-0d7b-4c1e-9a55-2b3c4d5e6f70', email: 'asha@example.test', name: 'Asha Rao', emailVerified: false }

test('profile saved', async () => {
  setToken('t-12')
  const onClose = jest.fn()
  const calls = fakeCore({
    'PATCH /me': () => json(200, { ...customer, phone: '9876543210' }),
  })
  await render(<ProfileSheet open customer={customer} onClose={onClose} />)

  await fireEvent.changeText(screen.getByLabelText('Phone'), '9876543210')
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  expect(calls).toHaveLength(1)
  expect(await calls[0].json()).toEqual({ name: 'Asha Rao', phone: '9876543210' })
  expect(queryClient.getQueryData(['me', 't-12'])).toEqual({ ...customer, phone: '9876543210' })
})

test('bad phone from the envelope', async () => {
  setToken('t-12')
  const onClose = jest.fn()
  fakeCore({
    'PATCH /me': () => apiError(400, 'validation', 'Phone is not valid', 'phone'),
  })
  await render(<ProfileSheet open customer={customer} onClose={onClose} />)

  await fireEvent.changeText(screen.getByLabelText('Phone'), '123')
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(screen.getByText('Phone is not valid')).toBeTruthy())
  expect(onClose).not.toHaveBeenCalled()
  expect(screen.getByRole('heading', { name: 'Edit profile' })).toBeTruthy()
})

test('empty name checked', async () => {
  setToken('t-12')
  const onClose = jest.fn()
  const calls = fakeCore({})
  await render(<ProfileSheet open customer={customer} onClose={onClose} />)

  await fireEvent.changeText(screen.getByLabelText('Name'), '   ')
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }))

  expect(screen.getByText('Enter your name')).toBeTruthy()
  expect(calls).toHaveLength(0)
  expect(onClose).not.toHaveBeenCalled()
})
