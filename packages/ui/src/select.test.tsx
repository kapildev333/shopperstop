import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { FormField } from './form-field'
import { Select } from './select'

test('select changes value', async () => {
  const user = userEvent.setup()
  render(
    <FormField label="State">
      <Select defaultValue="ka">
        <option value="ka">Karnataka</option>
        <option value="tn">Tamil Nadu</option>
      </Select>
    </FormField>,
  )
  const select = screen.getByLabelText('State')
  await user.selectOptions(select, 'tn')
  expect(select).toHaveValue('tn')
})
