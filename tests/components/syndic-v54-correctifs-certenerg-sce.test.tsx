import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import ModCertEnerg from '@/components/syndic-dashboard/v54/modules/ModCertEnerg'
import { V54LocaleProvider, type V54Locale } from '@/lib/syndic/v54/i18n'

/**
 * Correctif ModCertEnerg, encadré réglementaire.
 *
 * PT : le texte SCE affirmait des obligations qui n'existent pas (certificat « obrigatório
 * para todos os edifícios », classes E en 2030 et D en 2033 imposées par l'EPBD, fractions de
 * classe F interdites à la location). La directive (UE) 2024/1275 adoptée ne fixe aucune classe
 * minimale aux bâtiments résidentiels, et l'interdiction de louer est une règle française.
 * Le texte ne garde que l'exact : cas d'obligation du SCE (DL 101-D/2020), validité de 10 ans
 * pour l'habitation, directive (UE) 2024/1275 à transposer au plus tard le 29 mai 2026 (art. 35).
 *
 * FR : réalité distincte (DPE collectif, art. L126-31 CCH, loi n° 2021-1104 art. 158 ; décence
 * énergétique, art. 6 de la loi n° 89-462). Texte vérifié exact : il ne change pas.
 */

afterEach(cleanup)

function rendre(locale: V54Locale) {
  return render(
    <V54LocaleProvider locale={locale}>
      <ModCertEnerg />
    </V54LocaleProvider>,
  )
}

const TEXTE_SCE_PT =
  'O certificado energético é obrigatório na construção, na venda e no arrendamento de edifícios ou frações, bem como nas grandes renovações. ' +
  'Validade de 10 anos para os edifícios de habitação. ' +
  'A Diretiva (UE) 2024/1275 (EPBD 2024), relativa ao desempenho energético dos edifícios, fixou o prazo de transposição pelos Estados-Membros em 29 de maio de 2026.'

describe('ModCertEnerg — encadré réglementaire', () => {
  it('PT : le texte SCE ne garde que les obligations exactes', () => {
    const { container } = rendre('pt-PT')
    expect(screen.getByText('Sistema de Certificação Energética (SCE) — DL 101-D/2020')).toBeInTheDocument()
    expect(screen.getByText(TEXTE_SCE_PT)).toBeInTheDocument()
    const texte = container.textContent ?? ''
    expect(texte).not.toMatch(/obrigatório para todos os edifícios/)
    expect(texte).not.toMatch(/classe E até 2030|classe D até 2033/)
    expect(texte).not.toMatch(/impedidas de arrendamento/)
  })

  it('PT : le chapeau du module ne change pas', () => {
    rendre('pt-PT')
    expect(screen.getByText('SCE — DL 101-D/2020 · EPBD 2024 · Classes A+ a F')).toBeInTheDocument()
  })

  it('FR : le DPE collectif suit le droit français, sans rien du SCE portugais', () => {
    const { container } = rendre('fr-FR')
    expect(screen.getByText('DPE collectif obligatoire — loi Climat et résilience')).toBeInTheDocument()
    const texte = container.textContent ?? ''
    for (const fragment of [
      'dont le permis de construire a été déposé avant le 1er janvier 2013',
      'depuis le 1er janvier 2024 au-delà de 200 lots',
      'depuis le 1er janvier 2025 de 50 à 200 lots',
      'depuis le 1er janvier 2026 pour 50 lots au plus',
      'renouvelé tous les 10 ans, sauf si un DPE réalisé après le 1er juillet 2021 classe l\'immeuble en A, B ou C',
      'un logement classé G ne peut plus faire l\'objet d\'un nouveau bail ni d\'un renouvellement depuis le 1er janvier 2025',
      'pour la classe F au 1er janvier 2028 et pour la classe E au 1er janvier 2034',
    ]) {
      expect(texte).toContain(fragment)
    }
    expect(texte).not.toMatch(/SCE|101-D\/2020|2024\/1275|EPBD|arrendamento|edifícios/)
  })
})
