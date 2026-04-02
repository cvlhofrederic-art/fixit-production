// Re-export root homepage — locale is detected from cookie/geo by middleware
// and injected via LanguageProvider in layout.tsx
export { default } from '../page'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Artisans à Marseille et PACA | Vitfix',
  description: 'Trouvez un artisan qualifié à Marseille et en région PACA. Devis gratuit, avis vérifiés.',
  alternates: { canonical: 'https://vitfix.io/fr' },
}
