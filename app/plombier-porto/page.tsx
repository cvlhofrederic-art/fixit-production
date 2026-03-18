import type { Metadata } from 'next'
import { FR_INVESTOR_PAGES } from '@/lib/data/investor-pages-data'
import InvestorPageTemplate from '@/components/investor/InvestorPageTemplate'

const page = FR_INVESTOR_PAGES.find(p => p.slug === 'plombier-porto')!

export const metadata: Metadata = {
  title: page.metaTitle,
  description: page.metaDescription,
  openGraph: {
    title: page.metaTitle,
    description: page.metaDescription,
    type: 'website',
    siteName: 'VITFIX',
    locale: 'fr_FR',
    images: [{ url: 'https://vitfix.io/og-image.png', width: 1200, height: 630 }],
  },
  alternates: {
    canonical: `https://vitfix.io${page.canonicalPath}`,
    languages: page.hreflangAlternates,
  },
}

export default function PlombierPortoPage() {
  return <InvestorPageTemplate page={page} />
}
