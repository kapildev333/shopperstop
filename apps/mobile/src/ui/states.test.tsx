import { fireEvent, render, screen } from '@testing-library/react-native'
import { EmptyState } from './empty-state'
import { ErrorBanner } from './error-banner'
import { Skeleton } from './skeleton'
import { Text } from './text'
import { colors } from './tokens'

test('empty state', async () => {
  await render(
    <EmptyState title="Nothing here yet" description="Browse the categories" action={<Text>Shop now</Text>} />,
  )
  expect(screen.getByRole('heading', { name: 'Nothing here yet' })).toBeTruthy()
  expect(screen.getByText('Browse the categories')).toBeTruthy()
  expect(screen.getByText('Shop now')).toBeTruthy()
})

test('offline error', async () => {
  await render(<ErrorBanner error={new TypeError('Network request failed')} onRetry={jest.fn()} />)
  const alert = screen.getByRole('alert')
  expect(alert).toBeTruthy()
  expect(screen.getByText("You're offline")).toBeTruthy()
  expect(screen.getByText('Check your connection and try again.')).toBeTruthy()
})

test('server error', async () => {
  await render(<ErrorBanner error={{ code: 'internal', message: 'x' }} onRetry={jest.fn()} />)
  expect(screen.getByRole('alert')).toBeTruthy()
  expect(screen.getByText('Something went wrong on our side')).toBeTruthy()
  expect(screen.getByText('Please try again in a moment.')).toBeTruthy()
})

test('try again', async () => {
  const onRetry = jest.fn()
  await render(<ErrorBanner error={{ code: 'internal', message: 'x' }} onRetry={onRetry} />)
  fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
  expect(onRetry).toHaveBeenCalledTimes(1)
})

test('skeleton labelled loading', async () => {
  await render(<Skeleton count={2} />)
  expect(screen.getByLabelText('Loading')).toBeTruthy()
  expect(screen.getAllByTestId('skeleton-block')).toHaveLength(2)
})

test('skeleton tiles', async () => {
  await render(<Skeleton variant="tiles" columns={4} count={8} />)
  expect(screen.getByLabelText('Loading')).toBeTruthy()
  const blocks = screen.getAllByTestId('skeleton-block')
  expect(blocks).toHaveLength(8)
  expect(blocks[0]).toHaveStyle({ aspectRatio: 1 })
})

test('try again is a button', async () => {
  const onRetry = jest.fn()
  await render(<ErrorBanner error={{ code: 'internal', message: 'x' }} onRetry={onRetry} />)
  const retry = screen.getByRole('button', { name: 'Try again' })
  expect(retry).toHaveStyle({ minHeight: 44, backgroundColor: colors.accent })
  expect(retry.props.accessibilityState).toEqual({ disabled: false, busy: false })
  fireEvent.press(retry)
  expect(onRetry).toHaveBeenCalledTimes(1)
})

test('empty state level', async () => {
  await render(<EmptyState level={1} title="Category not found" />)
  // RNTL 14 has no `level` query option; the heading level is the aria-level prop.
  expect(screen.getByRole('heading', { name: 'Category not found' }).props['aria-level']).toBe(1)
})
