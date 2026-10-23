import type { Metadata } from 'next'
import { ogImageMeta } from '@/lib/og'
import PaginaServicoConcelho from '@/components/seo/PaginaServicoConcelho'
import { TERRAPLANAGEM_AGUEDA } from '@/lib/data/pt-servicos-concelho'
import { descricaoServicoConcelho, tituloServicoConcelho } from '@/lib/seo/pt-meta'

// Page « terraplanagem e desaterro » du concelho d'Águeda (demande du propriétaire du 21/10/2026). Route statique :
// elle passe avant app/pt/servicos/[slug]/ (grille métier x ville), qui ne connaît pas ce slug.
const servico = TERRAPLANAGEM_AGUEDA
const title = tituloServicoConcelho(servico)
const description = descricaoServicoConcelho(servico)

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    siteName: 'VITFIX',
    locale: 'pt_PT',
    type: 'website',
    images: ogImageMeta({ title, locale: 'pt' }),
  },
  twitter: { card: 'summary_large_image', title, description },
  alternates: { canonical: `https://vitfix.io/pt/servicos/${servico.slug}/` },
}

export default function TerraplanagemAguedaPage() {
  return <PaginaServicoConcelho servico={servico} />
}
