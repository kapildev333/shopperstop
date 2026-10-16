import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { admin, apiError, fakeCore, indiranagar, json, koramangala, storeList, storeStaff } from './fake-core'
import { renderApp } from './render-app'
import { arjun, kabir, riderService } from './riders-fake'

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

const asAdmin = { 'GET /admin/me': () => json(200, admin), 'GET /admin/stores': () => storeList([indiranagar, koramangala]) }
const writes = (calls: Request[]) => calls.filter((call) => call.method === 'POST' || call.method === 'PATCH')

async function openNew() {
  await userEvent.click(await screen.findByRole('button', { name: 'New rider' }))
  return screen.getByRole('dialog', { name: 'New rider' })
}

async function fill(dialog: HTMLElement, fields: Record<string, string>) {
  for (const [label, value] of Object.entries(fields)) await userEvent.type(within(dialog).getByLabelText(label), value)
}

test('an admin creates a rider at a store; the new rider is listed and the dialog closes', async () => {
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...riderService().routes })

  renderApp('/riders')
  const dialog = await openNew()
  expect(within(dialog).getByLabelText('Name')).toHaveFocus()
  await fill(dialog, { Name: 'Meera Iyer', Email: 'meera@example.test', Phone: '+919000000002', Password: 'rider12345' })
  await userEvent.selectOptions(within(dialog).getByLabelText('Store'), koramangala.id)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create rider' }))

  const row = (await screen.findByText('meera@example.test')).closest('tr')!
  expect(row).toHaveTextContent('Koramangala')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(writes(calls)).toHaveLength(1)
  expect(writes(calls)[0].url).toBe(`${location.origin}/api/rider/v1/admin/riders`)
  expect(await writes(calls)[0].json()).toEqual({ storeId: koramangala.id, email: 'meera@example.test', name: 'Meera Iyer', password: 'rider12345', phone: '+919000000002' })
})

test('an admin who chose a store creates the rider there by default', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...riderService().routes })

  renderApp(`/riders?store=${indiranagar.id}`)
  const dialog = await openNew()

  expect(within(dialog).getByLabelText('Store')).toHaveValue(indiranagar.id)
})

test('store staff create a rider at their own store, with no store field', async () => {
  setToken('tok')
  const calls = fakeCore({
    'GET /admin/me': () => json(200, storeStaff),
    [`GET /stores/${storeStaff.storeId}`]: () => json(200, { ...koramangala, id: storeStaff.storeId, name: 'Whitefield' }),
    ...riderService([]).routes,
  })

  renderApp('/riders')
  const dialog = await openNew()
  expect(within(dialog).queryByLabelText('Store')).not.toBeInTheDocument()
  await fill(dialog, { Name: 'Meera Iyer', Email: 'meera@example.test', Password: 'rider12345' })
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create rider' }))

  expect(await screen.findByText('meera@example.test')).toBeInTheDocument()
  expect(await writes(calls)[0].json()).toEqual({ storeId: storeStaff.storeId, email: 'meera@example.test', name: 'Meera Iyer', password: 'rider12345' })
})

test('an edit sends only what changed: a new name, the phone removed, a new password and the rider deactivated', async () => {
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...riderService().routes })

  renderApp('/riders')
  await userEvent.click(await screen.findByRole('button', { name: 'Edit arjun@example.test' }))
  const dialog = screen.getByRole('dialog', { name: 'Edit Arjun Rao' })
  expect(dialog).toHaveTextContent('arjun@example.test. The email and the store cannot be changed: create a new rider instead.')
  expect(within(dialog).queryByLabelText('Email')).not.toBeInTheDocument()
  expect(within(dialog).queryByLabelText('Store')).not.toBeInTheDocument()
  expect(within(dialog).getByLabelText('Phone')).toHaveValue('+919000000001')
  expect(within(dialog).getByLabelText('New password')).toHaveValue('')
  await userEvent.clear(within(dialog).getByLabelText('Name'))
  await userEvent.type(within(dialog).getByLabelText('Name'), 'Arjun R')
  await userEvent.clear(within(dialog).getByLabelText('Phone'))
  await userEvent.type(within(dialog).getByLabelText('New password'), 'new-pass-1')
  await userEvent.selectOptions(within(dialog).getByLabelText('Status'), 'inactive')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  const row = screen.getByText('arjun@example.test').closest('tr')!
  expect(row).toHaveTextContent('Arjun R')
  expect(row).toHaveTextContent('None')
  expect(row).toHaveTextContent('Inactive')
  expect(writes(calls)).toHaveLength(1)
  expect(writes(calls)[0].url).toBe(`${location.origin}/api/rider/v1/admin/riders/${arjun.id}`)
  expect(await writes(calls)[0].json()).toEqual({ name: 'Arjun R', phone: '', password: 'new-pass-1', isActive: false })
})

test('an edit that changes nothing closes without a request', async () => {
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...riderService().routes })

  renderApp('/riders')
  await userEvent.click(await screen.findByRole('button', { name: 'Edit kabir@example.test' }))
  await userEvent.click(within(screen.getByRole('dialog', { name: `Edit ${kabir.name}` })).getByRole('button', { name: 'Save changes' }))

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(writes(calls)).toEqual([])
})

test.each([
  ['email', 409, 'conflict', 'Email', 'A rider with this email already exists.'],
  ['password', 400, 'validation', 'Password', 'Enter 8 to 72 characters.'],
  ['phone', 400, 'validation', 'Phone', 'Enter 10 to 15 digits, with an optional + in front.'],
  ['storeId', 400, 'validation', 'Store', 'Choose a store.'],
  ['name', 400, 'validation', 'Name', 'Enter 1 to 100 characters.'],
])('a refusal naming %s goes to its field and clears on the next edit', async (field, status, code, label, message) => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...riderService().routes, 'POST /api/rider/v1/admin/riders': () => apiError(status, code, 'refused', field) })

  renderApp('/riders')
  const dialog = await openNew()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create rider' }))

  const input = within(dialog).getByLabelText(label)
  await waitFor(() => expect(input).toHaveAccessibleDescription(expect.stringContaining(message)))
  expect(input).toBeInvalid()
  expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  await userEvent.type(within(dialog).getByLabelText('Name'), 'x')
  expect(input).not.toHaveAccessibleDescription(expect.stringContaining(message))
})

test.each([
  ['a 403', () => apiError(403, 'forbidden')],
  ['a 502 from the rider service', () => apiError(502, 'internal')],
  ['an answer without the error envelope', () => new Response(null, { status: 502 })],
])('%s is a banner in the dialog, which stays with what was typed', async (_, answer) => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...riderService().routes, 'POST /api/rider/v1/admin/riders': answer })

  renderApp('/riders')
  const dialog = await openNew()
  await fill(dialog, { Name: 'Meera Iyer' })
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create rider' }))

  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not save the rider. Try again.')
  expect(within(dialog).getByLabelText('Name')).toHaveValue('Meera Iyer')
  expect(screen.getByRole('heading', { level: 1, name: 'Riders' })).toBeInTheDocument()
})

test('while a save runs the button reads Saving…, keeps focus and is never disabled; a second press, Cancel and Escape do nothing', async () => {
  setToken('tok')
  const service = riderService()
  const calls = fakeCore({ ...asAdmin, ...service.routes })

  renderApp('/riders')
  const dialog = await openNew()
  await fill(dialog, { Name: 'Meera Iyer', Email: 'meera@example.test', Password: 'rider12345' })
  await userEvent.selectOptions(within(dialog).getByLabelText('Store'), koramangala.id)
  service.hold()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create rider' }))

  const pressed = await within(dialog).findByRole('button', { name: 'Saving…' })
  expect(pressed).toHaveFocus()
  expect(pressed).toBeEnabled()
  expect(pressed).toHaveAttribute('aria-disabled', 'true')
  await userEvent.click(pressed)
  await userEvent.keyboard('{Escape}')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  expect(screen.getByRole('dialog', { name: 'New rider' })).toBeInTheDocument()
  expect(writes(calls)).toHaveLength(1)

  service.release()
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(writes(calls)).toHaveLength(1)
})

test('a 401 from the rider service ends the session like one from core', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, 'GET /api/rider/v1/admin/riders': () => apiError(401, 'unauthorized') })

  const router = renderApp('/riders')

  await waitFor(() => expect(router.state.location.pathname).toBe('/sign-in'))
  expect(localStorage.getItem('shopperstop:staff-token')).toBeNull()
})
