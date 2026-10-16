import { act, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { since, useSince, when } from './time'

const at = '2026-10-13T09:00:00Z'
const base = Date.parse(at)

afterEach(() => vi.useRealTimers())

test('relative times in whole minutes', () => {
  expect(since(at, base + 59_000)).toBe('just now')
  expect(since(at, base + 12 * 60_000 + 30_000)).toBe('12 min ago')
  expect(since(at, base + 75 * 60_000)).toBe('1 h 15 min ago')
  expect(since(at, base - 2 * 60_000)).toBe('just now')
})

test("stamp in the stores' time zone", () => {
  expect(when('2026-10-13T09:20:00Z')).toBe('13 Oct 2026, 2:50 pm')
})

function Ago({ at }: { at: string }) {
  return <p>{useSince(at)}</p>
}

test('useSince keeps its text current', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(at))
  render(<Ago at={at} />)
  expect(screen.getByText('just now')).toBeInTheDocument()
  act(() => {
    vi.advanceTimersByTime(60_000)
  })
  expect(screen.getByText('1 min ago')).toBeInTheDocument()
})
