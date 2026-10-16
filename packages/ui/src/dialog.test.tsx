import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './button'
import { Dialog, DialogFooter } from './dialog'
import { Sheet } from './sheet'

describe('Dialog closes on Escape', () => {
  it('dialog closes on Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Dialog open onClose={onClose} title="Confirm">
        <p>Are you sure?</p>
      </Dialog>,
    )
    expect(screen.getByRole('dialog', { name: 'Confirm' })).toHaveAttribute('aria-modal', 'true')
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

function StackHarness() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  return (
    <>
      <button onClick={() => setSheetOpen(true)}>Open order</button>
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Order">
        <button onClick={() => setDialogOpen(true)}>Cancel order</button>
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Cancel this order?">
          <button onClick={() => setDialogOpen(false)}>Keep order</button>
          <button>Confirm cancel</button>
        </Dialog>
      </Sheet>
    </>
  )
}

describe('Modal focus management', () => {
  it('focus is trapped', async () => {
    const user = userEvent.setup()
    render(
      <>
        <button>Outside</button>
        <Dialog open onClose={() => {}} title="Trap">
          <button>First</button>
          <button>Second</button>
        </Dialog>
      </>,
    )
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Second' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Second' })).toHaveFocus()
  })

  it('focus returns on close', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          <Dialog open={open} onClose={() => setOpen(false)} title="Returns">
            <button>Inside</button>
          </Dialog>
        </>
      )
    }
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(screen.getByRole('button', { name: 'Inside' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus()
  })

  it('stacked modals close top first', async () => {
    const user = userEvent.setup()
    render(<StackHarness />)
    await user.click(screen.getByRole('button', { name: 'Open order' }))
    await user.click(screen.getByRole('button', { name: 'Cancel order' }))
    expect(screen.getByRole('dialog', { name: 'Cancel this order?' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Cancel this order?' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Order' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel order' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Order' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open order' })).toHaveFocus()
  })

  it('tab stays in the top modal', async () => {
    const user = userEvent.setup()
    render(<StackHarness />)
    await user.click(screen.getByRole('button', { name: 'Open order' }))
    await user.click(screen.getByRole('button', { name: 'Cancel order' }))
    expect(screen.getByRole('button', { name: 'Keep order' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Confirm cancel' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Keep order' })).toHaveFocus()
    // The Sheet's last focusable, while the Dialog is on top. Only the top layer may act on Tab:
    // the Sheet must not wrap focus to its Close button nor prevent the default.
    const sheet = screen.getByRole('dialog', { name: 'Order' })
    const sheetFirst = within(sheet).getByRole('button', { name: 'Close' })
    const sheetLast = within(sheet).getByRole('button', { name: 'Cancel order' })
    act(() => sheetLast.focus())
    expect(fireEvent.keyDown(document, { key: 'Tab' })).toBe(true)
    expect(sheetLast).toHaveFocus()
    expect(sheetFirst).not.toHaveFocus()
  })
})

describe('DialogFooter puts Cancel first', () => {
  it('cancel comes first', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(
      <DialogFooter onCancel={onCancel}>
        <Button>Delete</Button>
      </DialogFooter>,
    )
    const buttons = screen.getAllByRole('button').map((button) => button.textContent)
    expect(buttons).toEqual(['Cancel', 'Delete'])
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
