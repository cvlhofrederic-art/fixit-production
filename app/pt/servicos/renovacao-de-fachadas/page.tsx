import type { Metadata } from 'next'
import { ogImageMeta } from '@/lib/og'
import PaginaServicoDistrito from '@/components/seo/PaginaServicoDistrito'
import { RENOVACAO_DE_FACHADAS } from '@/lib/data/pt-servicos-distrito'
import { descricaoServicoDistrito, tituloServicoDistrito } from '@/lib/seo/pt-meta'

// Page de district « renovação de fachadas » (gel A0 levé par le propriétaire le 20/10/2026, faits confirmés du 20 au
// 23/10/2026). Route statique : elle passe avant app/pt/servicos/[slug]/ (grille métier x ville), qui ne connaît pas ce slug.
const servico = RENOVACAO_DE_FACHADAS
const title = tituloServicoDistrito(servico)
const description = descricaoServicoDistrito(servico)

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

export default function RenovacaoDeFachadasPage() {
  return <PaginaServicoDistrito servico={servico} />
}
