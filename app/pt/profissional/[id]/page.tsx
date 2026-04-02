// PT alias for /fr/artisan/[id] — serves the same component
// URL: /pt/profissional/:slug/
export { default } from '@/app/fr/artisan/[id]/page'

import type { Metadata } from 'next'

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  return {
    title: `Profissional | Vitfix`,
    robots: { index: false, follow: false },
  }
}
