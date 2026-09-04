// @ts-expect-error Vitest provides Node built-ins at runtime; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const projectFile = (path: string) => readFileSync(path, 'utf8')

describe('public SEO and share metadata', () => {
  it('provides complete social unfurl metadata with an absolute share image', () => {
    const html = projectFile('index.html')

    expect(html).toContain('<link rel="canonical" href="https://planner.kitchen.hotelos.ai/"')
    expect(html).toContain('<meta property="og:type" content="website"')
    expect(html).toContain('<meta property="og:image" content="https://planner.kitchen.hotelos.ai/share-card.png"')
    expect(html).toContain('<meta property="og:image:width" content="1200"')
    expect(html).toContain('<meta property="og:image:height" content="630"')
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image"')
    expect(html).toContain('<link rel="manifest" href="/site.webmanifest"')
  })

  it('publishes valid structured data, sitemap discovery, and install metadata', () => {
    const html = projectFile('index.html')
    const structuredData = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/)?.[1]
    expect(structuredData).toBeTruthy()
    expect(JSON.parse(structuredData!)).toMatchObject({
      '@context': 'https://schema.org',
      '@graph': expect.arrayContaining([expect.objectContaining({ '@type': 'WebApplication', isAccessibleForFree: true })]),
    })

    expect(projectFile('public/robots.txt')).toContain('Sitemap: https://planner.kitchen.hotelos.ai/sitemap.xml')
    expect(projectFile('public/sitemap.xml')).toContain('<loc>https://planner.kitchen.hotelos.ai/</loc>')
    expect(JSON.parse(projectFile('public/site.webmanifest'))).toMatchObject({ name: 'CalmKitchen Designer', display: 'standalone' })
  })
})
