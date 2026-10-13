import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { admin, apiError, categoryTree, dairy, fakeCore, fruits, json, tonedMilk } from './fake-core'
import { renderApp } from './render-app'

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

const imagePath = `/admin/products/${tonedMilk.id}/image`
const storedUrl = `/api/core/v1/files/products/${tonedMilk.id}.png`
const withProduct = {
  'GET /admin/me': () => json(200, admin),
  'GET /admin/categories': () => categoryTree([fruits, dairy]),
  [`GET /admin/products/${tonedMilk.id}`]: () => json(200, tonedMilk),
}
const png = () => new File([new Uint8Array([137, 80, 78, 71])], 'milk.png', { type: 'image/png' })
// userEvent skips files the input's accept list excludes; the refusal tests need them to reach the page.
const user = () => userEvent.setup({ applyAccept: false })

test('upload a product image shows the stored image', async () => {
  setToken('tok')
  const calls = fakeCore({ ...withProduct, [`PUT ${imagePath}`]: () => json(200, { ...tonedMilk, imageUrl: storedUrl }) })

  renderApp(`/products/${tonedMilk.id}`)
  const input = await screen.findByLabelText('Image')
  expect(input).toHaveAttribute('accept', 'image/png,image/jpeg,image/webp')
  expect(screen.queryByRole('img', { name: 'Image of Sunny Fields Toned Milk' })).not.toBeInTheDocument()
  await userEvent.upload(input, png())

  expect(await screen.findByText('Image saved.')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Image of Sunny Fields Toned Milk' })).toHaveAttribute('src', `${storedUrl}?v=1`)
  const puts = calls.filter((call) => call.method === 'PUT')
  expect(puts).toHaveLength(1)
  const file = (await puts[0].formData()).get('file') as File
  expect(file.type).toBe('image/png')
  expect(file.size).toBe(4)

  // A second upload keeps the URL; the tile still loads the new bytes.
  await userEvent.upload(input, png())
  await waitFor(() => expect(screen.getByRole('img', { name: 'Image of Sunny Fields Toned Milk' })).toHaveAttribute('src', `${storedUrl}?v=2`))
})

test.each([
  ['a GIF', new File(['GIF89a'], 'milk.gif', { type: 'image/gif' })],
  ['a PNG over 5 MB', new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })],
])('%s is refused without a request', async (_name, file) => {
  setToken('tok')
  const calls = fakeCore(withProduct)

  renderApp(`/products/${tonedMilk.id}`)
  const input = await screen.findByLabelText('Image')
  await user().upload(input, file)

  expect(input).toHaveAccessibleDescription(
    'PNG, JPEG or WebP, up to 5 MB. Saved as soon as you pick it. Choose a PNG, JPEG or WebP image of at most 5 MB.',
  )
  expect(calls.filter((call) => call.method === 'PUT')).toHaveLength(0)
})

test('a file core refuses is flagged on the field', async () => {
  setToken('tok')
  fakeCore({ ...withProduct, [`PUT ${imagePath}`]: () => apiError(400, 'validation', 'image must be PNG, JPEG or WebP', 'file') })

  renderApp(`/products/${tonedMilk.id}`)
  const input = await screen.findByLabelText('Image')
  await userEvent.upload(input, png())

  await waitFor(() =>
    expect(input).toHaveAccessibleDescription(
      'PNG, JPEG or WebP, up to 5 MB. Saved as soon as you pick it. Choose a PNG, JPEG or WebP image of at most 5 MB.',
    ),
  )
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('any other upload failure shows a banner', async () => {
  setToken('tok')
  fakeCore({ ...withProduct, [`PUT ${imagePath}`]: () => apiError(500, 'internal') })

  renderApp(`/products/${tonedMilk.id}`)
  await userEvent.upload(await screen.findByLabelText('Image'), png())

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not upload the image. Try again.')
})

test('upload a category image from its dialog', async () => {
  setToken('tok')
  const milk = dairy.children[0]
  const url = `/api/core/v1/files/categories/${milk.id}.png`
  let uploaded = false
  const calls = fakeCore({
    'GET /admin/me': () => json(200, admin),
    'GET /admin/categories': () =>
      categoryTree([fruits, uploaded ? { ...dairy, children: [{ ...milk, imageUrl: url }] } : dairy]),
    [`PUT /admin/categories/${milk.id}/image`]: () => {
      uploaded = true
      return json(200, { ...milk, imageUrl: url })
    },
  })

  renderApp('/categories')
  await userEvent.click(await screen.findByRole('button', { name: 'Edit Milk' }))
  const dialog = screen.getByRole('dialog', { name: 'Edit Milk' })
  await userEvent.upload(within(dialog).getByLabelText('Image'), png())

  expect(await within(dialog).findByText('Image saved.')).toBeInTheDocument()
  expect(within(dialog).getByRole('img', { name: 'Image of Milk' })).toHaveAttribute('src', `${url}?v=1`)
  expect(calls.filter((call) => call.method === 'PUT')).toHaveLength(1)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  const milkRow = within(screen.getByRole('table', { name: 'Categories' })).getAllByRole('row')[4]
  await waitFor(() => expect(milkRow.querySelector('img')).toHaveAttribute('src', url))
})
