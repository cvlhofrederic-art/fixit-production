// PT alias for /fr/artisan/[id] - serves the same component
// URL: /pt/profissional/:slug/
export { default } from '@/app/fr/artisan/[id]/page'

import type { Metadata } from 'next'

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params
  return {
    title: `Profissional | Vitfix`,
    robots: { index: false, follow: false },
    // noindex mais canonical explicite — clarté pour Google et pour le bot
    // de notre propre llms-full.txt.
    alternates: {
      canonical: `https://vitfix.io/pt/profissional/${id}/`,
    },
  }
}
