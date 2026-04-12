import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    template: '%s | VITFIX Porto',
    default: 'Home Services in Porto | English Speaking Professionals | VITFIX',
  },
  description: 'Find verified, English-speaking home service professionals in Porto. Plumbers, electricians, handymen and more. Free quotes, fast response.',
  openGraph: {
    siteName: 'VITFIX',
    locale: 'en_GB',
    type: 'website',
    images: [{ url: 'https://vitfix.io/og-image.png', width: 1200, height: 630 }],
  },
  alternates: {
    languages: {
      'pt': 'https://vitfix.io/pt/',
      'fr': 'https://vitfix.io/fr/',
      'en': 'https://vitfix.io/en/',
      'nl': 'https://vitfix.io/nl/',
      'es': 'https://vitfix.io/es/',
      'x-default': 'https://vitfix.io/',
    },
  },
}

export default function EnLayout({ children }: { children: React.ReactNode }) {
  return children
}
