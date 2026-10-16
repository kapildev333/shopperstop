import type { FormEvent } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { Input } from '@shopperstop/ui'

// Enter submits: a search box needs no button, and IconButton forces type="button".
export function SearchForm({ className }: { className?: string }) {
  const navigate = useNavigate()
  // Shows the current search on /search only; keyed so the box follows navigation. Read from the
  // committed location, not the route match: the match flips to empty while /search loads, which
  // remounted the box mid-typing (web e2e flake).
  const q = useRouterState({
    select: (s) => (s.location.pathname === '/search' ? String((s.location.search as { q?: unknown }).q ?? '') : ''),
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = String(new FormData(event.currentTarget).get('q') ?? '').trim()
    navigate({ href: text ? `/search?q=${encodeURIComponent(text)}` : '/search' })
  }

  return (
    <form role="search" onSubmit={onSubmit} className={className}>
      <Input
        key={q}
        type="search"
        name="q"
        aria-label="Search products"
        placeholder="Search for milk, bread, eggs"
        defaultValue={q}
      />
    </form>
  )
}
