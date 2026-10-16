import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ImageTile } from './index'

describe('ImageTile', () => {
  it('tile shows the image', () => {
    render(<ImageTile src="/img/milk.png" alt="Milk" />)
    const image = screen.getByRole('img', { name: 'Milk' })
    expect(image).toHaveAttribute('src', '/img/milk.png')
    expect(image).toHaveAttribute('loading', 'lazy')
    const tile = image.parentElement!
    expect(tile).toHaveClass('aspect-square', 'rounded-control')
  })

  it('placeholder without an image', () => {
    const { container } = render(<ImageTile alt="Milk" />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    const placeholder = container.querySelector('[data-placeholder]')!
    expect(placeholder).toHaveClass('bg-canvas')
    expect(placeholder.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('decorative tile', () => {
    render(<ImageTile src="/img/milk.png" alt="" />)
    expect(screen.getByRole('presentation')).toHaveAttribute('alt', '')
  })

  it('missing alt does not compile', () => {
    // @ts-expect-error alt is required
    const { container } = render(<ImageTile src="/img/milk.png" />)
    expect(container.querySelector('img')).toHaveAttribute('src', '/img/milk.png')
  })
})
