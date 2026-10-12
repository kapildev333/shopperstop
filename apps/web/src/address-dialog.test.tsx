import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { ApiError } from './api'
import { AddressDialog } from './address-dialog'

test('address dialog checks fields', async () => {
  const submit = vi.fn()
  render(<AddressDialog open onClose={vi.fn()} submit={submit} />)
  await userEvent.type(screen.getByLabelText('Pincode'), '5600')
  await userEvent.click(screen.getByRole('button', { name: 'Save address' }))
  expect(await screen.findByText('Enter the first address line')).toBeInTheDocument()
  expect(screen.getByText('Enter a 6-digit pincode')).toBeInTheDocument()
  expect(submit).not.toHaveBeenCalled()
})

test('address dialog shows envelope field error', async () => {
  const error: ApiError = { code: 'validation', message: 'Pincode is not valid', field: 'pincode' }
  const submit = vi.fn().mockResolvedValue(error)
  const onClose = vi.fn()
  render(<AddressDialog open onClose={onClose} submit={submit} />)
  await userEvent.type(screen.getByLabelText('Label'), 'Home')
  await userEvent.type(screen.getByLabelText('Address line 1'), '2 Old Road')
  await userEvent.type(screen.getByLabelText('Pincode'), '560001')
  await userEvent.click(screen.getByRole('button', { name: 'Save address' }))
  expect(await screen.findByText('Pincode is not valid')).toBeInTheDocument()
  expect(screen.getByLabelText('Pincode')).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
  expect(submit).toHaveBeenCalledWith({ label: 'Home', line1: '2 Old Road', line2: '', pincode: '560001' })
})

test('edit dialog prefilled', async () => {
  render(
    <AddressDialog
      open
      address={{ label: 'Home', line1: '2 Old Road', line2: '', pincode: '560001' }}
      onClose={vi.fn()}
      submit={vi.fn()}
    />,
  )
  const dialog = screen.getByRole('dialog', { name: 'Edit address' })
  expect(screen.getByLabelText('Label')).toHaveValue('Home')
  expect(screen.getByLabelText('Pincode')).toHaveValue('560001')
  expect(within(dialog).getAllByRole('button')[0]).toHaveAccessibleName('Cancel')
})
