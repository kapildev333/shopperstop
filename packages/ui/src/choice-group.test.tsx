import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { Choice, ChoiceGroup } from './index'

test('click chooses', async () => {
  const onChange = vi.fn()
  render(
    <ChoiceGroup label="Deliver to" value="home" onChange={onChange}>
      <Choice value="home">home</Choice>
      <Choice value="work">work</Choice>
    </ChoiceGroup>,
  )
  expect(screen.getByRole('radiogroup', { name: 'Deliver to' })).toBeInTheDocument()
  expect(screen.getAllByRole('radio')).toHaveLength(2)
  expect(screen.getByRole('radio', { name: 'home' })).toHaveAttribute('aria-checked', 'true')
  await userEvent.click(screen.getByRole('radio', { name: 'work' }))
  expect(onChange).toHaveBeenCalledWith('work')
})

test('arrow keys move and choose', async () => {
  const onChange = vi.fn()
  render(
    <ChoiceGroup label="Size" value="c" onChange={onChange}>
      <Choice value="a">a</Choice>
      <Choice value="b">b</Choice>
      <Choice value="c">c</Choice>
    </ChoiceGroup>,
  )
  screen.getByRole('radio', { name: 'c' }).focus()
  await userEvent.keyboard('{ArrowRight}')
  expect(screen.getByRole('radio', { name: 'a' })).toHaveFocus()
  expect(onChange).toHaveBeenLastCalledWith('a')
  await userEvent.keyboard('{ArrowLeft}')
  expect(screen.getByRole('radio', { name: 'c' })).toHaveFocus()
  expect(onChange).toHaveBeenLastCalledWith('c')
  await userEvent.keyboard('{ArrowDown}')
  expect(screen.getByRole('radio', { name: 'a' })).toHaveFocus()
  expect(onChange).toHaveBeenLastCalledWith('a')
  await userEvent.keyboard('{ArrowUp}')
  expect(screen.getByRole('radio', { name: 'c' })).toHaveFocus()
  expect(onChange).toHaveBeenLastCalledWith('c')
})

test('one tab stop', () => {
  const { unmount } = render(
    <ChoiceGroup label="Deliver to" value="work" onChange={() => {}}>
      <Choice value="home">home</Choice>
      <Choice value="work">work</Choice>
      <Choice value="other">other</Choice>
    </ChoiceGroup>,
  )
  expect(screen.getByRole('radio', { name: 'work' })).toHaveAttribute('tabindex', '0')
  expect(screen.getByRole('radio', { name: 'home' })).toHaveAttribute('tabindex', '-1')
  expect(screen.getByRole('radio', { name: 'other' })).toHaveAttribute('tabindex', '-1')
  unmount()
  render(
    <ChoiceGroup label="Pick" onChange={() => {}}>
      <Choice value="x">x</Choice>
      <Choice value="y">y</Choice>
    </ChoiceGroup>,
  )
  expect(screen.getByRole('radio', { name: 'x' })).toHaveAttribute('tabindex', '0')
  expect(screen.getByRole('radio', { name: 'y' })).toHaveAttribute('tabindex', '0')
})

test('choices can sit anywhere inside the group', async () => {
  const onChange = vi.fn()
  render(
    <ChoiceGroup label="Address" value="1" onChange={onChange}>
      <ul>
        <li>
          <Choice value="1">Home</Choice>
        </li>
        <li>
          <Choice value="2">Work</Choice>
        </li>
      </ul>
    </ChoiceGroup>,
  )
  screen.getByRole('radio', { name: 'Home' }).focus()
  await userEvent.keyboard('{ArrowRight}')
  expect(screen.getByRole('radio', { name: 'Work' })).toHaveFocus()
  expect(onChange).toHaveBeenLastCalledWith('2')
})
