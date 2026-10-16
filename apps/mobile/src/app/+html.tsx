import type { ReactNode } from 'react'
import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html'

// The static shell of every exported page. The title is the fallback for pages without their own (screens set theirs with Head).
// The head and body nodes carry the bundle scripts and styles; without them the export does not hydrate.
export default function Root({ children }: { children: ReactNode }) {
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } = useServerDocumentContext()
  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>ShopperStop</title>
        <ScrollViewStyleReset />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  )
}
