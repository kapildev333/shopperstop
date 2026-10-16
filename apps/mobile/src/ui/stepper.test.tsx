import { fireEvent, render, screen, within } from '@testing-library/react-native'
import { useState } from 'react'
import { Stepper } from './stepper'

// The count lives in state, as a screen holds it; the Stepper only reports the next value.
function Harness({ max, size }: { max: number; size?: 'md' | 'lg' }) {
  const [value, setValue] = useState(0)
  return <Stepper label="Toned milk" value={value} max={max} size={size} onChange={setValue} />
}

test('stepper counts within the maximum', async () => {
  await render(<Harness max={2} />)
  await fireEvent.press(screen.getByRole('button', { name: 'Add Toned milk' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Add one Toned milk' }))

  // A group View is not an accessibility element for RNTL's role query; its label is what names it.
  const group = screen.getByLabelText('Quantity of Toned milk')
  expect(within(group).getByText('2')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Add one Toned milk' }).props.accessibilityState).toMatchObject({
    disabled: true,
  })

  await fireEvent.press(screen.getByRole('button', { name: 'Remove one Toned milk' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Remove one Toned milk' }))
  expect(screen.getByRole('button', { name: 'Add Toned milk' })).toBeTruthy()
})

test('out of stock is disabled', async () => {
  await render(<Harness max={0} />)
  const button = screen.getByRole('button', { name: 'Out of stock' })
  expect(button.props.accessibilityState).toMatchObject({ disabled: true })
  expect(screen.queryByRole('button', { name: 'Add Toned milk' })).toBeNull()
})

test('large add reads Add to cart', async () => {
  await render(<Harness max={2} size="lg" />)
  expect(screen.getByText('Add to cart')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Add Toned milk' })).toBeTruthy()
})

test('medium controls reach a 44 point touch area', async () => {
  await render(<Harness max={2} />)
  // hitSlop grows the touch area around the visible 36 point control to 44 by 44.
  expect(screen.getByRole('button', { name: 'Add Toned milk' }).props.hitSlop).toEqual({ top: 4, bottom: 4, left: 4, right: 4 })
})

test('medium remove and add one reach a 44 point touch area', async () => {
  await render(<Harness max={2} />)
  await fireEvent.press(screen.getByRole('button', { name: 'Add Toned milk' }))
  // The 28 point wide controls take 8 points of slop on each side: 28 + 16 = 44 wide, 36 + 8 = 44 tall.
  const remove = screen.getByRole('button', { name: 'Remove one Toned milk' })
  const addOne = screen.getByRole('button', { name: 'Add one Toned milk' })
  expect(remove.props.hitSlop).toEqual({ top: 4, bottom: 4, left: 8, right: 8 })
  expect(addOne.props.hitSlop).toEqual({ top: 4, bottom: 4, left: 8, right: 8 })
})
