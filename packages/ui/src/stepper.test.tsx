import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { Stepper } from './stepper'

test('stepper at zero stock', async () => {
  const onChange = vi.fn()
  render(<Stepper value={0} max={0} label="Milk" onChange={onChange} />)
  const out = screen.getByRole('button', { name: 'Out of stock' })
  expect(out).toBeDisabled()
  await userEvent.click(out)
  expect(onChange).not.toHaveBeenCalled()
})

test('stepper at the maximum', () => {
  render(<Stepper value={5} max={5} label="Milk" onChange={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Add one Milk' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Remove one Milk' })).toBeEnabled()
})

test('ADD adds one', async () => {
  const onChange = vi.fn()
  render(<Stepper value={0} max={5} label="Milk" onChange={onChange} />)
  await userEvent.click(screen.getByRole('button', { name: /Add.*Milk/ }))
  expect(onChange).toHaveBeenCalledWith(1)
})

test('decrement reaches zero', async () => {
  const onChange = vi.fn()
  render(<Stepper value={1} max={5} label="Milk" onChange={onChange} />)
  await userEvent.click(screen.getByRole('button', { name: 'Remove one Milk' }))
  expect(onChange).toHaveBeenCalledWith(0)
})
