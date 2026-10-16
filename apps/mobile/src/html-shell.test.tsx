import { renderToStaticMarkup } from 'react-dom/server'
import Root from './app/+html'

// The static export writes this shell into every page before any JavaScript runs, so the title must be here too.
test('exported pages carry the app title in the static shell', () => {
  const markup = renderToStaticMarkup(<Root>{null}</Root>)
  expect(markup).toContain('<title>ShopperStop</title>')
  expect(markup).toContain('<html lang="en">')
})
