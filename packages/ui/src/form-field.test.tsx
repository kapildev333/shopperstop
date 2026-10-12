import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { FormField } from './form-field'
import { Input, inputClass } from './input'

test('label finds the control', () => {
  render(
    <FormField label="Pincode">
      <Input />
    </FormField>,
  )
  const input = screen.getByLabelText('Pincode')
  expect(input.tagName).toBe('INPUT')
  expect(input).toHaveClass(...inputClass.split(' '))
})

test('error describes the control', () => {
  render(
    <FormField label="Pincode" hint="6 digits" error="Enter a valid pincode">
      <Input />
    </FormField>,
  )
  const input = screen.getByLabelText('Pincode')
  expect(input).toHaveAttribute('aria-invalid', 'true')
  expect(input).toHaveAccessibleDescription(/6 digits.*Enter a valid pincode/)
})
