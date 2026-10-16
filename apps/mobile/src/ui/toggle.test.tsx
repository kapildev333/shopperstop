import { fireEvent, render, screen } from '@testing-library/react-native'
import { Toggle } from './toggle'

// A switch the screen reader reads as on or off, with a label it can name; one press flips it.
test('toggle is a switch with its checked state and reports the flip', async () => {
  const onChange = jest.fn()
  await render(<Toggle label="Make this my default address" checked={false} onChange={onChange} />)
  const control = screen.getByRole('switch', { name: 'Make this my default address' })
  expect(control).toHaveProp('accessibilityState', { checked: false })

  await fireEvent.press(control)
  expect(onChange).toHaveBeenCalledWith(true)
})

test('checked toggle reports off on press', async () => {
  const onChange = jest.fn()
  await render(<Toggle label="Make this my default address" checked onChange={onChange} />)
  const control = screen.getByRole('switch', { name: 'Make this my default address' })
  expect(control).toHaveProp('accessibilityState', { checked: true })

  await fireEvent.press(control)
  expect(onChange).toHaveBeenCalledWith(false)
})

// react-native-web presses a switch on Enter but not on Space (its press responder maps Space only for buttons), so Space is handled here.
test('Space flips the switch and stops the page scrolling; Enter is left to the press', async () => {
  const onChange = jest.fn()
  const preventDefault = jest.fn()
  await render(<Toggle label="Make this my default address" checked={false} onChange={onChange} />)
  const control = screen.getByRole('switch', { name: 'Make this my default address' })

  await fireEvent(control, 'keyDown', { key: ' ', preventDefault })
  expect(onChange).toHaveBeenCalledWith(true)
  expect(preventDefault).toHaveBeenCalled()

  onChange.mockClear()
  await fireEvent(control, 'keyDown', { key: 'Enter', preventDefault })
  expect(onChange).not.toHaveBeenCalled()
})
