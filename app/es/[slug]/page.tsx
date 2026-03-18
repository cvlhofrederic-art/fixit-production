import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ES_INVESTOR_PAGES, getInvestorPage } from '@/lib/data/investor-pages-data'
import InvestorPageTemplate from '@/components/investor/InvestorPageTemplate'

export const dynamicParams = false

export function generateStaticParams() {
  return ES_INVESTOR_PAGES.map(page => ({ slug: page.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const page = getInvestorPage('es', slug)
  if (!page) return {}

  return {
    title: page.metaTitle,
    description: page.metaDescription,
    openGraph: {
      title: page.metaTitle,
      description: page.metaDescription,
      type: 'website',
      siteName: 'VITFIX',
      locale: 'es_ES',
      images: [{ url: 'https://vitfix.io/og-image.png', width: 1200, height: 630 }],
    },
    alternates: {
      canonical: `https://vitfix.io${page.canonicalPath}`,
      languages: page.hreflangAlternates,
    },
  }
}

export default async function EsServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = getInvestorPage('es', slug)
  if (!page) notFound()

  return <InvestorPageTemplate page={page} />
}
