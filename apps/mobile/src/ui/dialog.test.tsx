import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { Button } from './button'
import { Dialog, DialogFooter } from './dialog'

const title = 'Switch to the Indiranagar store?'

// The dialog is named by its title: its Modal carries the label, and the platform's close reaches its onRequestClose.
test('dialog named and closed by the platform', async () => {
  const onClose = jest.fn()
  await render(
    <Dialog open title={title} onClose={onClose}>
      <Button variant="secondary">Keep cart</Button>
    </Dialog>,
  )
  expect(screen.getByRole('heading', { name: title }).props['aria-level']).toBe(2)
  let modal = screen.getByText(title)
  while (!('onRequestClose' in modal.props) && modal.parent) modal = modal.parent
  expect(modal.props.accessibilityLabel).toBe(title)
  await fireEvent(modal, 'requestClose')
  expect(onClose).toHaveBeenCalledTimes(1)
})

// Both footer children get the same flex, and the cancel button stays first in the tree.
test('footer keeps the order', async () => {
  await render(
    <Dialog open title={title} onClose={() => {}}>
      <DialogFooter>
        <Button variant="secondary">Keep cart</Button>
        <Button>Switch store</Button>
      </DialogFooter>
    </Dialog>,
  )
  expect(screen.getAllByText(/^(Keep cart|Switch store)$/).map((text) => text.props.children)).toEqual([
    'Keep cart',
    'Switch store',
  ])
  const flexOf = (name: string) => {
    let node = screen.getByRole('button', { name })
    while (StyleSheet.flatten(node.props.style)?.flex !== 1 && node.parent) node = node.parent
    return StyleSheet.flatten(node.props.style)?.flex
  }
  expect(flexOf('Keep cart')).toBe(1)
  expect(flexOf('Switch store')).toBe(1)
})

test('closed dialog shows nothing', async () => {
  await render(
    <Dialog open={false} title={title} onClose={() => {}}>
      <Button>Switch store</Button>
    </Dialog>,
  )
  expect(screen.queryByText(title)).toBeNull()
  expect(screen.queryByRole('button', { name: 'Switch store' })).toBeNull()
})
