// tests/components/zones-intervention-invite.test.tsx — « Zonas de intervenção » de Mon profil pour un compte invité
// dans une société (relecture du 26/11/2026).
//
// La carte lit la fiche depuis le navigateur. Pour un compte invité, la RLS ne la laisse passer que si la fiche de la
// société est publique. Sinon la carte reprenait les zones gardées sur le poste (une clé commune à tous les comptes qui
// s'y connectent), et « Guardar as zonas » les écrivait sur la fiche de la société, par-dessus celles du gérant.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

const h = vi.hoisted(() => ({ ficheLisible: false }))

vi.mock('@/lib/supabase', () => {
  const requete: Record<string, unknown> = {}
  requete.select = () => requete
  requete.eq = () => requete
  requete.update = () => requete
  requete.single = async () => (h.ficheLisible
    ? { data: { intervention_zones: { regions: [], departments: [], cities: ['Penafiel'] } }, error: null }
    : { data: null, error: { code: 'PGRST116', message: 'aucune ligne' } })
  return {
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: { access_token: 'jeton-essai' } } }),
        updateUser: async () => ({ error: null }),
      },
      from: () => requete,
    },
  }
})
vi.mock('next/image', async () => {
  const { createElement } = await import('react')
  return { default: ({ src, alt }: { src?: string; alt?: string }) => createElement('img', { src, alt }) }
})
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

import { LanguageProvider } from '@/lib/i18n/context'
import type { Artisan } from '@/lib/types'
import SettingsSection from '@/components/dashboard/SettingsSection'

type Proprietes = React.ComponentProps<typeof SettingsSection>

const FORMULAIRE: Proprietes['settingsForm'] = {
  company_name: 'Construções Exemplo, Lda', email: 'geral@exemplo.test', phone: '', bio: '', auto_block_duration_minutes: 240,
  auto_reply_message: '', zone_radius_km: 30, rcs_number: '', ape_code: '', share_capital: '', tva_intra: '', insurance_name: '',
  insurance_number: '', insurance_coverage: '', insurance_type: '', insurance_expiry: '', mediator_name: '', mediator_url: '',
}

/** Secrétaire invitée : son compte, la société, la fiche de la société et ses zones (reçues de /api/pro/titulaire). */
const SECRETAIRE = {
  id: 'compte-secretaire', user_id: 'compte-gerant', fiche_societe_id: 'fiche-societe', company_name: 'Construções Exemplo, Lda',
  slug: 'construcoes-exemplo', categories: [], intervention_zones: { regions: [], departments: [], cities: ['Amarante', 'Lousada'] },
} as unknown as Artisan
const GERANT = { id: 'fiche-societe', user_id: 'compte-gerant', company_name: 'Construções Exemplo, Lda', slug: 'construcoes-exemplo', categories: [] } as unknown as Artisan

const proprietes = (artisan: Artisan): Proprietes => ({
  artisan, initials: 'CE', orgRole: 'pro_societe', settingsForm: FORMULAIRE, setSettingsForm: vi.fn(), savingSettings: false,
  saveSettings: vi.fn(), autoAccept: false, toggleAutoAccept: vi.fn(), profilePhotoPreview: '', setProfilePhotoPreview: vi.fn(),
  profilePhotoFile: null, setProfilePhotoFile: vi.fn(), profilePhotoUploading: false, uploadDocument: vi.fn(),
  setProfilePhotoUploading: vi.fn(), uploadMsg: null, setUploadMsg: vi.fn(),
})

let zonesEnvoyees: unknown[]

beforeEach(() => {
  h.ficheLisible = false
  zonesEnvoyees = []
  localStorage.clear()
  // Zones laissées sur ce poste par un autre compte.
  localStorage.setItem('vitfix_intervention_zones', JSON.stringify({ regions: [], depts: [], cities: ['Lisboa'] }))
  vi.stubGlobal('fetch', vi.fn(async (entree: RequestInfo | URL, init?: RequestInit) => {
    if (String(entree) === '/api/artisan-settings' && init?.method === 'POST') {
      zonesEnvoyees.push((JSON.parse(String(init.body)) as { intervention_zones?: unknown }).intervention_zones)
    }
    return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function enregistrerLesZones(artisan: Artisan) {
  await act(async () => { render(<LanguageProvider initialLocale="pt"><SettingsSection {...proprietes(artisan)} /></LanguageProvider>) })
  await act(async () => { await new Promise(resoudre => setTimeout(resoudre, 40)) })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '💾 Guardar as zonas' })) })
  await act(async () => { await new Promise(resoudre => setTimeout(resoudre, 20)) })
  return zonesEnvoyees
}

describe('Zonas de intervenção — compte invité dans une société', () => {
  it('fiche de la société illisible depuis le navigateur : ses zones, jamais celles gardées sur le poste', async () => {
    const envoyees = await enregistrerLesZones(SECRETAIRE)
    expect(envoyees).toEqual([{ regions: [], departments: [], cities: ['Amarante', 'Lousada'] }])
  })

  it('fiche lisible : les zones lues en base, comme pour le gérant', async () => {
    h.ficheLisible = true
    const envoyees = await enregistrerLesZones(SECRETAIRE)
    expect(envoyees).toEqual([{ regions: [], departments: [], cities: ['Penafiel'] }])
  })

  it('gérant titulaire : inchangé, la fiche illisible retombe sur les zones du poste comme avant', async () => {
    const envoyees = await enregistrerLesZones(GERANT)
    expect(envoyees).toEqual([{ regions: [], departments: [], cities: ['Lisboa'] }])
  })
})
