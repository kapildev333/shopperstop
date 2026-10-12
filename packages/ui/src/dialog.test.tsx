import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './button'
import { Dialog, DialogFooter } from './dialog'

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
