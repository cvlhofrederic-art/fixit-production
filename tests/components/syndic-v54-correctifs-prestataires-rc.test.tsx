import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import ModProfissionais from '@/components/syndic-dashboard/v54/modules/ModProfissionais'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import { V54LocaleProvider, type V54Locale } from '@/lib/syndic/v54/i18n'
import type { Artisan } from '@/components/syndic-dashboard/types'
import { normaliserArtisan } from '@/lib/syndic/v54/api'

/**
 * Correctifs ModProfissionais :
 * - la pastille « Seguro RC válido » / « RC Pro valide » ne s'affiche que si la RC est réellement
 *   valide d'après les données (attestation déposée, non échue) ;
 * - la certification VitFix n'est plus inversée : « Certificado » / « Certifié » sur les
 *   prestataires certifiés, en démo comme avec les vraies données ;
 * - les vraies données passent, comme en production, par fetchArtisans, qui normalise les
 *   colonnes Supabase en snake_case renvoyées par GET /api/syndic/artisans.
 */

afterEach(cleanup)

/** Ligne renvoyée par GET /api/syndic/artisans (colonnes Supabase brutes), normalisée comme dans fetchArtisans. */
const ligneApi = (over: Record<string, unknown>): Artisan => normaliserArtisan({
  id: 'a1', cabinet_id: 'c1', artisan_user_id: null, email: 'a1@teste.pt', nom: 'Pro Um', prenom: '', nom_famille: 'Um',
  telephone: '910000001', metier: 'Canalizador', siret: '', statut: 'actif', vitfix_certifie: false, note: 4.5,
  nb_interventions: 3, rc_pro_valide: false, rc_pro_expiration: null, assurance_decennale_valide: false,
  assurance_decennale_expiration: null, compte_existant: false,
  ...over,
} as unknown as Artisan)

const donnees = (artisans: Artisan[]): SyndicData => ({ authenticated: true, loading: false, missions: [], immeubles: [], artisans })

function rendre(locale: V54Locale, d?: SyndicData) {
  const mod = <V54LocaleProvider locale={locale}><ModProfissionais /></V54LocaleProvider>
  return render(d ? <SyndicDataContext.Provider value={d}>{mod}</SyndicDataContext.Provider> : mod)
}

/** Carte (Panel) du prestataire dont le nom est donné. */
const carte = (nom: string): HTMLElement => screen.getByText(nom, { selector: 'div' }).closest('[class*="panel"]') as HTMLElement

describe('ModProfissionais — pastille RC Pro', () => {
  it('PT : pastille seulement pour la RC valide (données API snake_case)', () => {
    rendre('pt-PT', donnees([
      ligneApi({ id: 'ok', email: 'ok@teste.pt', nom: 'Com RC', rc_pro_valide: true }),
      ligneApi({ id: 'ko', email: 'ko@teste.pt', nom: 'Sem RC', rc_pro_valide: false }),
    ]))
    expect(within(carte('Com RC')).getByText('Seguro RC válido')).toBeInTheDocument()
    expect(within(carte('Sem RC')).queryByText('Seguro RC válido')).toBeNull()
  })

  it('FR : pastille seulement pour la RC valide (données camelCase)', () => {
    const camel = (over: Partial<Artisan>): Artisan => ({
      id: 'x', nom: 'X', metier: 'Plombier', telephone: '', email: 'x@exemple.fr', siret: '',
      rcProValide: false, rcProExpiration: '', decennaleValide: false, decennaleExpiration: '',
      note: 4, nbInterventions: 0, statut: 'actif', vitfixCertifie: false, ...over,
    })
    rendre('fr-FR', donnees([
      camel({ id: 'ok', email: 'ok@exemple.fr', nom: 'Avec RC', rcProValide: true }),
      camel({ id: 'ko', email: 'ko@exemple.fr', nom: 'Sans RC', rcProValide: false }),
    ]))
    expect(within(carte('Avec RC')).getByText('RC Pro valide')).toBeInTheDocument()
    expect(within(carte('Sans RC')).queryByText('RC Pro valide')).toBeNull()
  })

  it('RC échue (date de fin ISO passée) : ni pastille ni « valide jusqu’au »', () => {
    rendre('fr-FR', donnees([
      ligneApi({ id: 'exp', email: 'exp@teste.pt', nom: 'RC Echue', rc_pro_valide: true, rc_pro_expiration: '2020-01-31' }),
      ligneApi({ id: 'fut', email: 'fut@teste.pt', nom: 'RC Future', rc_pro_valide: true, rc_pro_expiration: '2999-12-31' }),
    ]))
    expect(within(carte('RC Echue')).queryByText('RC Pro valide')).toBeNull()
    expect(within(carte('RC Echue')).queryByText(/valide jusqu'au/)).toBeNull()
    expect(within(carte('RC Future')).getByText('RC Pro valide')).toBeInTheDocument()
    expect(within(carte('RC Future')).getByText(/RC Pro valide jusqu'au/)).toBeInTheDocument()
  })

  it('chapeau : compteurs calculés depuis les colonnes renvoyées par l’API', () => {
    rendre('pt-PT', donnees([
      ligneApi({ id: '1', email: '1@teste.pt', nom: 'Um', vitfix_certifie: true, rc_pro_valide: true, assurance_decennale_valide: true }),
      ligneApi({ id: '2', email: '2@teste.pt', nom: 'Dois', rc_pro_valide: true }),
      ligneApi({ id: '3', email: '3@teste.pt', nom: 'Tres' }),
    ]))
    expect(screen.getByText('3 prestadores registados · 1 certificados Vitfix · 2 com Seguro RC válido · 1 com garantia decenal')).toBeInTheDocument()
    expect(within(carte('Um')).getByText(/intervenções/).textContent).toBe('3 intervenções')
  })

  it('démo : les 9 exemples gardent la pastille RC (tous valides)', () => {
    rendre('pt-PT')
    expect(screen.getAllByText('Seguro RC válido')).toHaveLength(9)
    cleanup()
    rendre('fr-FR')
    expect(screen.getAllByText('RC Pro valide')).toHaveLength(9)
  })
})

describe('ModProfissionais — certification VitFix', () => {
  it('vraies données : « Certificado » sur le prestataire certifié uniquement', () => {
    rendre('pt-PT', donnees([
      ligneApi({ id: 'c', email: 'c@teste.pt', nom: 'Certif Sim', vitfix_certifie: true }),
      ligneApi({ id: 'n', email: 'n@teste.pt', nom: 'Certif Nao', vitfix_certifie: false }),
    ]))
    expect(within(carte('Certif Sim')).getByText('Certificado')).toBeInTheDocument()
    expect(within(carte('Certif Nao')).queryByText('Certificado')).toBeNull()
  })

  it('démo PT : 7 certifiés (chapeau « 7 certificados Vitfix »), pas Santos ni Costa', () => {
    rendre('pt-PT')
    expect(screen.getAllByText('Certificado')).toHaveLength(7)
    expect(within(carte('Silva')).getByText('Certificado')).toBeInTheDocument()
    expect(within(carte('Santos')).queryByText('Certificado')).toBeNull()
    expect(within(carte('Costa')).queryByText('Certificado')).toBeNull()
  })

  it('démo FR : 7 certifiés (chapeau « 7 certifiés VitFix »), pas Sanchez ni Costes', () => {
    rendre('fr-FR')
    expect(screen.getAllByText('Certifié')).toHaveLength(7)
    expect(within(carte('Sylvain')).getByText('Certifié')).toBeInTheDocument()
    expect(within(carte('Sanchez')).queryByText('Certifié')).toBeNull()
    expect(within(carte('Costes')).queryByText('Certifié')).toBeNull()
  })
})
