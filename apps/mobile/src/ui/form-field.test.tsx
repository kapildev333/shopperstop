import { fireEvent, render, screen, within } from '@testing-library/react-native'
import { Pressable } from 'react-native'
import { Text } from './text'
import { FormField } from './form-field'
import { colors } from './tokens'

test('input named by its label', async () => {
  await render(<FormField label="Email" value="" onChangeText={() => {}} />)
  expect(screen.getByLabelText('Email')).toBeTruthy()
})

test('hint shown', async () => {
  await render(<FormField label="Password" hint="At least 8 characters." value="" onChangeText={() => {}} />)
  expect(screen.getByText('At least 8 characters.')).toBeTruthy()
  expect(screen.getByTestId('form-field-frame')).toHaveStyle({ borderColor: colors.lineStrong })
})

test('error replaces the hint', async () => {
  await render(
    <FormField
      label="Email"
      hint="We never share it."
      error="Enter a valid email."
      value=""
      onChangeText={() => {}}
    />,
  )
  expect(screen.getByText('Enter a valid email.')).toBeTruthy()
  expect(screen.queryByText('We never share it.')).toBeNull()
  expect(screen.getByLabelText('Email')).toHaveProp('accessibilityHint', 'Enter a valid email.')
  expect(screen.getByTestId('form-field-frame')).toHaveStyle({ borderColor: colors.danger })
})

test('optional suffix', async () => {
  await render(<FormField label="Phone" optional value="" onChangeText={() => {}} />)
  expect(screen.getByLabelText('Phone')).toBeTruthy()
  expect(screen.getByText('(optional)')).toBeTruthy()
})

test('trailing slot', async () => {
  const onShow = jest.fn()
  await render(
    <FormField
      label="Password"
      value=""
      onChangeText={() => {}}
      trailing={
        <Pressable accessibilityRole="button" accessibilityLabel="Show password" onPress={onShow}>
          <Text>Show</Text>
        </Pressable>
      }
    />,
  )
  const frame = screen.getByTestId('form-field-frame')
  fireEvent.press(within(frame).getByRole('button', { name: 'Show password' }))
  expect(onShow).toHaveBeenCalledTimes(1)
})

test('typing calls onChangeText', async () => {
  const onChangeText = jest.fn()
  await render(<FormField label="Email" value="" onChangeText={onChangeText} />)
  fireEvent.changeText(screen.getByLabelText('Email'), 'asha@example.com')
  expect(onChangeText).toHaveBeenCalledWith('asha@example.com')
})

test('tabular input', async () => {
  await render(<FormField label="Pincode" tabular value="560034" onChangeText={() => {}} />)
  expect(screen.getByLabelText('Pincode')).toHaveStyle({ fontVariant: ['tabular-nums'], letterSpacing: 2 })
})
