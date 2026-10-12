import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { expect, test } from 'vitest'
import { Input, inputClass } from './input'

test('input forwards props and ref', () => {
  const ref = createRef<HTMLInputElement>()
  render(<Input ref={ref} placeholder="6 digits" className="extra" name="pin" />)
  const input = screen.getByPlaceholderText('6 digits')
  expect(input).toBe(ref.current)
  expect(input.tagName).toBe('INPUT')
  expect(input).toHaveAttribute('name', 'pin')
  expect(input).toHaveClass(...inputClass.split(' '), 'extra')
})
