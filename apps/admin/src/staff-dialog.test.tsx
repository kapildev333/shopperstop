import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { admin, apiError, fakeCore, indiranagar, json } from './fake-core'
import { renderApp } from './render-app'
import { staffUsersQuery } from './staff'
import { createdId, indu, kiran, staffCore } from './staff-fake'

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

const sent = (calls: Request[], method: string) => calls.filter((call) => call.method === method)
const listReads = (calls: Request[]) => calls.filter((call) => call.method === 'GET' && new URL(call.url).pathname.endsWith('/admin/staff-users'))
const emails = () =>
  within(screen.getByRole('table', { name: 'Staff users' }))
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label'))
const row = (email: string) => screen.getByRole('button', { name: `Edit ${email}` }).closest('tr')!

async function openNew() {
  await userEvent.click(await screen.findByRole('button', { name: 'New staff user' }))
  return screen.getByRole('dialog', { name: 'New staff user' })
}

async function openEdit(email: string, name: string) {
  await userEvent.click(await screen.findByRole('button', { name: `Edit ${email}` }))
  return screen.getByRole('dialog', { name: `Edit ${name}` })
}

// Fills the create form for a store-staff user at Indiranagar. The email has a capital: core keeps it as typed and orders by it case-blind.
async function fillNew(dialog: HTMLElement) {
  await userEvent.type(within(dialog).getByLabelText('Name'), 'Jaya Menon')
  await userEvent.type(within(dialog).getByLabelText('Email'), 'Jaya@example.test')
  await userEvent.type(within(dialog).getByLabelText('Password'), 'staff12345')
  await userEvent.selectOptions(within(dialog).getByLabelText('Store'), indiranagar.id)
}

test('create a store-staff user: core gets what was typed and the row appears in email order, case ignored, without a second read', async () => {
  setToken('tok')
  const calls = fakeCore(staffCore().routes)

  renderApp('/staff')
  const dialog = await openNew()
  expect(within(dialog).getAllByRole('button').map((button) => button.textContent)).toEqual(['Cancel', 'Create staff user'])
  expect(within(dialog).getByLabelText('Name')).toHaveFocus()
  expect(within(dialog).getByLabelText('Role')).toHaveValue('store_staff')
  expect(within(dialog).getByLabelText('Password')).toHaveAttribute('type', 'password')
  expect(within(dialog).getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password')
  await fillNew(dialog)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create staff user' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(await sent(calls, 'POST')[0].json()).toEqual({ name: 'Jaya Menon', email: 'Jaya@example.test', password: 'staff12345', role: 'store_staff', storeId: indiranagar.id })
  expect(emails()).toEqual(['Edit admin@example.test', 'Edit indiranagar@example.test', 'Edit Jaya@example.test', 'Edit koramangala@example.test'])
  for (const text of ['Jaya Menon', 'Store staff', 'Indiranagar', 'Active']) expect(within(row('Jaya@example.test')).getByText(text)).toBeInTheDocument()
  expect(listReads(calls)).toHaveLength(1)
})

test('create an admin: no Store field and no store in the request', async () => {
  setToken('tok')
  const calls = fakeCore(staffCore().routes)

  renderApp('/staff')
  const dialog = await openNew()
  await fillNew(dialog)
  await userEvent.selectOptions(within(dialog).getByLabelText('Role'), 'admin')
  expect(within(dialog).queryByLabelText('Store')).not.toBeInTheDocument()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create staff user' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(await sent(calls, 'POST')[0].json()).toEqual({ name: 'Jaya Menon', email: 'Jaya@example.test', password: 'staff12345', role: 'admin' })
  expect(within(row('Jaya@example.test')).getByText('All stores')).toBeInTheDocument()
})

test('store staff created without a store: core is asked without one and its refusal shows on Store', async () => {
  setToken('tok')
  const calls = fakeCore({ ...staffCore().routes, 'POST /admin/staff-users': () => apiError(400, 'validation', 'must be a store id for store staff', 'storeId') })

  renderApp('/staff')
  const dialog = await openNew()
  await userEvent.type(within(dialog).getByLabelText('Name'), 'Jaya Menon')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create staff user' }))

  await waitFor(() => expect(within(dialog).getByLabelText('Store')).toHaveAccessibleDescription('Store staff see this store only. Choose a store.'))
  expect(await sent(calls, 'POST')[0].json()).toEqual({ name: 'Jaya Menon', email: '', password: '', role: 'store_staff' })
  expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
})

test.each([
  ['name', 'Name', 'Enter 1 to 100 characters.'],
  ['email', 'Email', 'Enter a valid email address.'],
  ['password', 'Password', '8 to 72 characters. Enter 8 to 72 characters.'],
  ['role', 'Role', 'Choose a role.'],
])('a validation error from core on %s is shown on its field', async (field, label, description) => {
  setToken('tok')
  fakeCore({ ...staffCore().routes, 'POST /admin/staff-users': () => apiError(400, 'validation', 'core says no', field) })

  renderApp('/staff')
  const dialog = await openNew()
  await fillNew(dialog)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create staff user' }))

  await waitFor(() => expect(within(dialog).getByLabelText(label)).toHaveAccessibleDescription(description))
  expect(within(dialog).getByLabelText(label)).toBeInvalid()
  expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  expect(dialog).not.toHaveTextContent('core says no')
})

test('a taken email is said on the Email field, and the next edit clears it', async () => {
  setToken('tok')
  fakeCore({ ...staffCore().routes, 'POST /admin/staff-users': () => apiError(409, 'conflict', 'email already registered', 'email') })

  renderApp('/staff')
  const dialog = await openNew()
  await fillNew(dialog)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create staff user' }))

  const email = within(dialog).getByLabelText('Email')
  await waitFor(() => expect(email).toHaveAccessibleDescription('A staff user with this email already exists.'))
  expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  expect(within(dialog).getByLabelText('Password')).toHaveValue('staff12345')
  await userEvent.type(within(dialog).getByLabelText('Name'), '!')
  expect(email).toHaveAccessibleDescription('')
  expect(email).not.toBeInvalid()
})

test.each([
  ['core fails', () => apiError(500, 'internal')],
  ['the answer has no error body', () => json(502)],
  ['core refuses without naming a field of the form', () => apiError(400, 'validation', 'invalid JSON')],
  ['core names a conflict that is not the email', () => apiError(409, 'conflict', 'no', 'name')],
])('when %s the dialog stays with an alert, and the next edit clears it', async (_, answer) => {
  setToken('tok')
  fakeCore({ ...staffCore().routes, 'POST /admin/staff-users': answer })

  renderApp('/staff')
  const dialog = await openNew()
  await fillNew(dialog)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create staff user' }))

  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not save the staff user. Try again.')
  expect(within(dialog).getByLabelText('Name')).toHaveValue('Jaya Menon')
  expect(emails()).toHaveLength(3)
  await userEvent.type(within(dialog).getByLabelText('Name'), '!')
  expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
})

test('edit shows what cannot change as text, sends only the changed name and shows core\'s answer in the row', async () => {
  setToken('tok')
  const calls = fakeCore(staffCore().routes)

  renderApp('/staff')
  const dialog = await openEdit(kiran.email, kiran.name)
  expect(within(dialog).getAllByRole('button').map((button) => button.textContent)).toEqual(['Cancel', 'Save changes'])
  expect(dialog).toHaveTextContent('koramangala@example.test, Store staff. The email, the role and the store cannot be changed: create a new staff user instead.')
  for (const label of ['Email', 'Role', 'Store']) expect(within(dialog).queryByLabelText(label)).not.toBeInTheDocument()
  expect(within(dialog).getByLabelText('Status')).toHaveValue('active')
  expect(within(dialog).getByLabelText('New password')).toHaveValue('')
  const name = within(dialog).getByLabelText('Name')
  await userEvent.clear(name)
  await userEvent.type(name, ' Kiran R ')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(await sent(calls, 'PATCH')[0].json()).toEqual({ name: ' Kiran R ' })
  expect(new URL(sent(calls, 'PATCH')[0].url).pathname).toBe(`/api/core/v1/admin/staff-users/${kiran.id}`)
  expect(within(row(kiran.email)).getByText('Kiran R')).toBeInTheDocument()
  expect(listReads(calls)).toHaveLength(1)
})

test('a new password is sent alone, and no password is left in the page or the mutation cache', async () => {
  setToken('tok')
  const calls = fakeCore(staffCore().routes)

  const router = renderApp('/staff')
  const dialog = await openEdit(kiran.email, kiran.name)
  const password = within(dialog).getByLabelText('New password')
  expect(password).toHaveAttribute('type', 'password')
  expect(password).toHaveAttribute('autocomplete', 'new-password')
  await userEvent.type(password, 'newpass123')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(await sent(calls, 'PATCH')[0].json()).toEqual({ password: 'newpass123' })
  await waitFor(() => expect(router.options.context.queryClient.getMutationCache().getAll()).toHaveLength(0))
  expect(JSON.stringify(router.options.context.queryClient.getQueryCache().getAll().map((query) => query.state.data))).not.toContain('newpass123')
  expect(document.body).not.toHaveTextContent('newpass123')
  expect(within(await openEdit(kiran.email, kiran.name)).getByLabelText('New password')).toHaveValue('')
})

test('deactivate and activate: Status is sent alone and the row follows core\'s answer', async () => {
  setToken('tok')
  const calls = fakeCore(staffCore().routes)

  renderApp('/staff')
  let dialog = await openEdit(kiran.email, kiran.name)
  await userEvent.selectOptions(within(dialog).getByLabelText('Status'), 'inactive')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(await sent(calls, 'PATCH')[0].json()).toEqual({ isActive: false })
  expect(within(row(kiran.email)).getByText('Inactive')).toBeInTheDocument()

  dialog = await openEdit(indu.email, indu.name)
  expect(within(dialog).getByLabelText('Status')).toHaveValue('inactive')
  await userEvent.selectOptions(within(dialog).getByLabelText('Status'), 'active')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(await sent(calls, 'PATCH')[1].json()).toEqual({ isActive: true })
  expect(within(row(indu.email)).getByText('Active')).toBeInTheDocument()
})

test('Save changes with nothing changed closes the dialog without a request', async () => {
  setToken('tok')
  const calls = fakeCore(staffCore().routes)

  renderApp('/staff')
  const dialog = await openEdit(kiran.email, kiran.name)
  await userEvent.selectOptions(within(dialog).getByLabelText('Status'), 'inactive')
  await userEvent.selectOptions(within(dialog).getByLabelText('Status'), 'active')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(sent(calls, 'PATCH')).toHaveLength(0)
})

test('an admin\'s own dialog has no Status field, and a saved name shows in the row and the banner', async () => {
  setToken('tok')
  const calls = fakeCore(staffCore().routes)

  renderApp('/staff')
  const dialog = await openEdit(admin.email, admin.name)
  expect(within(dialog).queryByLabelText('Status')).not.toBeInTheDocument()
  expect(within(dialog).getByText('You cannot deactivate your own account.')).toBeInTheDocument()
  const name = within(dialog).getByLabelText('Name')
  await userEvent.clear(name)
  await userEvent.type(name, 'Asha A')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(await sent(calls, 'PATCH')[0].json()).toEqual({ name: 'Asha A' })
  expect(within(row(admin.email)).getByText('Asha A')).toBeInTheDocument()
  expect(within(row(admin.email)).getByText('You')).toBeInTheDocument()
  await waitFor(() => expect(within(screen.getByRole('banner')).getByText('Asha A')).toBeInTheDocument())
  expect(calls.filter((call) => new URL(call.url).pathname.endsWith('/admin/me'))).toHaveLength(1)
})

test('another staff user\'s dialog has the Status field and no own-account line', async () => {
  setToken('tok')
  fakeCore(staffCore().routes)

  renderApp('/staff')
  const dialog = await openEdit(indu.email, indu.name)

  expect(within(dialog).getByLabelText('Status')).toBeInTheDocument()
  expect(within(dialog).queryByText('You cannot deactivate your own account.')).not.toBeInTheDocument()
})

test('while a save runs the button reads "Saving…", keeps focus, is never disabled, and a second press or Enter sends nothing', async () => {
  setToken('tok')
  const core = staffCore()
  const calls = fakeCore(core.routes)

  renderApp('/staff')
  const dialog = await openNew()
  await fillNew(dialog)
  core.hold()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create staff user' }))

  const button = await within(dialog).findByRole('button', { name: 'Saving…' })
  expect(button).toHaveFocus()
  expect(button).toBeEnabled()
  expect(button).toHaveAttribute('aria-disabled', 'true')
  await userEvent.click(button)
  await userEvent.type(within(dialog).getByLabelText('Name'), '{Enter}')
  expect(sent(calls, 'POST')).toHaveLength(1)
  core.release()
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(sent(calls, 'POST')).toHaveLength(1)
  expect(emails()).toHaveLength(4)
})

test('an edit typed while a save runs leaves the save attached: it still closes the dialog', async () => {
  setToken('tok')
  const core = staffCore()
  const calls = fakeCore(core.routes)

  renderApp('/staff')
  const dialog = await openNew()
  await fillNew(dialog)
  core.hold()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create staff user' }))
  await within(dialog).findByRole('button', { name: 'Saving…' })
  await userEvent.type(within(dialog).getByLabelText('Name'), '!')

  expect(within(dialog).getByRole('button', { name: 'Saving…' })).toBeInTheDocument()
  core.release()
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(sent(calls, 'POST')).toHaveLength(1)
  expect(within(row('Jaya@example.test')).getByText('Jaya Menon')).toBeInTheDocument()
})

test('Cancel and Escape close the dialog without a request, but not while a save runs', async () => {
  setToken('tok')
  const core = staffCore()
  const calls = fakeCore(core.routes)

  renderApp('/staff')
  await userEvent.click(within(await openNew()).getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await openNew()
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'New staff user' })).toHaveFocus()

  const dialog = await openNew()
  expect(within(dialog).getByLabelText('Name')).toHaveValue('')
  await fillNew(dialog)
  core.hold()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create staff user' }))
  await within(dialog).findByRole('button', { name: 'Saving…' })
  await userEvent.keyboard('{Escape}')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  expect(screen.getByRole('dialog', { name: 'New staff user' })).toBeInTheDocument()
  core.release()
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(sent(calls, 'POST')).toHaveLength(1)
  expect(row('Jaya@example.test')).toBeInTheDocument()
})

test('an unknown staff user on save shows the alert and leaves the row as it was', async () => {
  setToken('tok')
  fakeCore({ ...staffCore().routes, [`PATCH /admin/staff-users/${kiran.id}`]: () => apiError(404, 'not_found') })

  renderApp('/staff')
  const dialog = await openEdit(kiran.email, kiran.name)
  await userEvent.type(within(dialog).getByLabelText('Name'), ' Jr')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not save the staff user. Try again.')
  expect(within(row(kiran.email)).getByText('Kiran Rao')).toBeInTheDocument()
})

test('a staff user just created can be changed at once: the row is replaced, not added again', async () => {
  setToken('tok')
  const core = staffCore()
  const calls = fakeCore({ ...core.routes, [`PATCH /admin/staff-users/${createdId}`]: () => json(200, { id: createdId, email: 'Jaya@example.test', name: 'Jaya M', role: 'store_staff', storeId: indiranagar.id, isActive: true }) })

  renderApp('/staff')
  const dialog = await openNew()
  await fillNew(dialog)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create staff user' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  const edit = await openEdit('Jaya@example.test', 'Jaya Menon')
  await userEvent.type(within(edit).getByLabelText('Name'), '!')
  await userEvent.click(within(edit).getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(new URL(sent(calls, 'PATCH')[0].url).pathname).toBe(`/api/core/v1/admin/staff-users/${createdId}`)
  expect(within(row('Jaya@example.test')).getByText('Jaya M')).toBeInTheDocument()
  expect(emails()).toHaveLength(4)
})

test('a row changed by a refetch while its dialog is open: the save sends what the dialog shows, against the row as it is now', async () => {
  setToken('tok')
  const core = staffCore()
  let read = core.routes['GET /admin/staff-users']
  const calls = fakeCore({ ...core.routes, 'GET /admin/staff-users': (request) => read(request) })

  const router = renderApp('/staff')
  const dialog = await openEdit(kiran.email, kiran.name)
  // Another admin deactivates Kiran meanwhile; a background read brings it while the dialog is open.
  read = () => json(200, { items: [admin, indu, { ...kiran, isActive: false }], page: 1, pageSize: 100, total: 3 })
  await act(() => router.options.context.queryClient.refetchQueries({ queryKey: staffUsersQuery.queryKey }))
  await waitFor(() => expect(within(row(kiran.email)).getByText('Inactive')).toBeInTheDocument())
  expect(within(dialog).getByLabelText('Status')).toHaveValue('active')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(sent(calls, 'PATCH')).toHaveLength(1)
  expect(await sent(calls, 'PATCH')[0].json()).toEqual({ isActive: true })
  expect(within(row(kiran.email)).getByText('Active')).toBeInTheDocument()
})

test('a row gone from the list while its dialog is open keeps the dialog on the row as opened', async () => {
  setToken('tok')
  const core = staffCore()
  let read = core.routes['GET /admin/staff-users']
  const calls = fakeCore({ ...core.routes, 'GET /admin/staff-users': (request) => read(request) })

  const router = renderApp('/staff')
  const dialog = await openEdit(kiran.email, kiran.name)
  read = () => json(200, { items: [admin, indu], page: 1, pageSize: 100, total: 2 })
  await act(() => router.options.context.queryClient.refetchQueries({ queryKey: staffUsersQuery.queryKey }))
  await waitFor(() => expect(screen.queryByRole('button', { name: `Edit ${kiran.email}` })).not.toBeInTheDocument())
  expect(screen.getByRole('dialog', { name: `Edit ${kiran.name}` })).toBe(dialog)
  expect(within(dialog).queryByLabelText('Email')).not.toBeInTheDocument()
  await userEvent.type(within(dialog).getByLabelText('Name'), ' Jr')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(new URL(sent(calls, 'PATCH')[0].url).pathname).toBe(`/api/core/v1/admin/staff-users/${kiran.id}`)
  expect(await sent(calls, 'PATCH')[0].json()).toEqual({ name: 'Kiran Rao Jr' })
  expect(within(row(kiran.email)).getByText('Kiran Rao Jr')).toBeInTheDocument()
})
