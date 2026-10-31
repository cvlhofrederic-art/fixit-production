/**
 * Sous-sitemap 4 (fiches artisans, lib/sitemap-fiches-artisans.ts, servi par app/sitemap/[id]/route.ts) et sa
 * déclaration dans l'index app/sitemap.xml/route.ts.
 * - La lecture de profiles_artisan ne nomme que des colonnes présentes en production. Le faux client ci-dessous répond
 *   comme PostgREST (42703) à toute autre colonne, sélectionnée ou filtrée : en production, lire org_role, country ou
 *   is_verified faisait échouer la requête et le sitemap sortait vide.
 * - Préfixe de la fiche : forme juridique (legal_form) et langue (language) ; les fiches individuelles PT
 *   (/pt/profissional/, noindex) restent hors sitemap.
 * - Une panne Supabase donne un sitemap vide, jamais une erreur 500, mais elle reste visible dans les logs. Le client
 *   Supabase (postgrest-js) ne lève pas d'exception : il renvoie { data: null, error }, que le catch ne voit jamais.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Ligne = Record<string, unknown>
type Resultat = { data: Ligne[] | null; error: { code: string; message: string } | null }

const supabase = vi.hoisted(() => {
  // Les 90 colonnes de public.profiles_artisan en production, relevées le 31/10/2026 (ni org_role, ni country, ni
  // is_verified, ni nif). Une colonne hors liste est traitée comme absente.
  const colonnesProduction = new Set([
    'acre_actif', 'acre_date_fin', 'active', 'ape_code', 'auto_accept', 'auto_block_duration_minutes', 'auto_reply_message',
    'bio', 'categories', 'certidao_extracted', 'company_address', 'company_city', 'company_name', 'company_postal_code',
    'created_at', 'credit_mois_gratuits', 'decennale_valid', 'declaration_configuree', 'email', 'hourly_rate', 'id',
    'id_document_verso_url', 'insurance_coverage', 'insurance_expiry', 'insurance_name', 'insurance_number',
    'insurance_scan_data', 'insurance_type', 'insurance_url', 'insurance_verified', 'intervention_zones', 'kbis_extracted',
    'kbis_extracted_encrypted', 'kbis_url', 'kyc_checks', 'kyc_market', 'kyc_rejection_reason', 'kyc_reviewed_at',
    'kyc_reviewed_by', 'kyc_score', 'kyc_status', 'kyc_verified_at', 'language', 'last_seen_at', 'latitude', 'legal_form',
    'logo_url', 'longitude', 'marches_categories', 'marches_description', 'marches_opt_in', 'marches_tarif_horaire',
    'marches_tarif_journalier', 'marches_work_mode', 'mediator_name', 'mediator_url', 'naf_code', 'naf_label',
    'nif_encrypted', 'paiement_mention_devis', 'paiement_mention_facture', 'paiement_modes', 'periodicite_declaration',
    'phone', 'pii_encryption_version', 'profile_photo_url', 'qualibat_valid', 'rating_avg', 'rating_count', 'rc_pro_valid',
    'rcs_number', 'referral_code', 'referral_flagged', 'referral_parrain_id', 'rge_valid', 'share_capital', 'siren', 'siret',
    'siret_encrypted', 'slug', 'subscription_tier', 'total_parrainages_reussis', 'tva_auto_activate', 'tva_intra',
    'tva_notified_level', 'type_activite', 'updated_at', 'user_id', 'verified', 'zone_radius_km',
  ])
  const etat = {
    lignes: [] as Ligne[],
    panne: null as { code: string; message: string } | null,
    requetes: [] as Array<{ table: string; colonnes: string[]; filtres: Array<[string, unknown]> }>,
  }
  const client = {
    from(table: string) {
      const requete = { table, colonnes: [] as string[], filtres: [] as Array<[string, unknown]> }
      etat.requetes.push(requete)
      const resultat = (): Resultat => {
        if (etat.panne) return { data: null, error: etat.panne }
        const absente = [...requete.colonnes, ...requete.filtres.map(([c]) => c)].find((c) => !colonnesProduction.has(c))
        if (absente) return { data: null, error: { code: '42703', message: `column ${table}.${absente} does not exist` } }
        const lignes = etat.lignes.filter((l) => requete.filtres.every(([c, v]) => l[c] === v))
        return { data: lignes.map((l) => Object.fromEntries(requete.colonnes.map((c) => [c, l[c] ?? null]))), error: null }
      }
      const constructeur = {
        select(colonnes: string) {
          requete.colonnes = colonnes.split(',').map((c) => c.trim())
          return constructeur
        },
        eq(colonne: string, valeur: unknown) {
          requete.filtres.push([colonne, valeur])
          return constructeur
        },
        then(ok: (r: Resultat) => unknown, ko?: (e: unknown) => unknown) {
          return Promise.resolve(resultat()).then(ok, ko)
        },
      }
      return constructeur
    },
  }
  return { etat, client }
})
vi.mock('@/lib/supabase-server-component', () => ({ createServerSupabaseClient: async () => supabase.client }))
const avertir = vi.hoisted(() => vi.fn())
vi.mock('@/lib/logger', () => ({ logger: { warn: avertir, error: vi.fn(), info: vi.fn(), debug: vi.fn() } }))

import { GET } from '@/app/sitemap/[id]/route'
import { GET as GET_INDEX } from '@/app/sitemap.xml/route'
import { estFormeSociete, getProfilePath } from '@/lib/utils'

const BASE = 'https://vitfix.io'
const sitemap4 = () => GET(new Request(`${BASE}/sitemap/4.xml`), { params: Promise.resolve({ id: '4.xml' }) })
const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(BASE, ''))
const fiche = (champs: Ligne): Ligne => ({ id: 'id-x', slug: null, updated_at: null, legal_form: null, language: 'fr', verified: true, active: true, ...champs })

describe('sitemap des fiches artisans', () => {
  beforeEach(() => {
    avertir.mockClear()
    supabase.etat.lignes = []
    supabase.etat.panne = null
    supabase.etat.requetes = []
  })

  it('lit seulement des colonnes présentes en production (ni org_role, ni country, ni is_verified)', async () => {
    supabase.etat.lignes = [fiche({ id: 'a-1', slug: 'durand-plomberie-marseille' })]
    const xml = await (await sitemap4()).text()
    expect(locs(xml)).toEqual(['/fr/artisan/durand-plomberie-marseille/'])
    expect(avertir).not.toHaveBeenCalled()
    const [requete] = supabase.etat.requetes
    expect(requete.table).toBe('profiles_artisan')
    expect(requete.filtres).toEqual([['verified', true], ['active', true]])
  })

  it('préfixe selon la forme juridique et la langue ; fiches individuelles PT (noindex), non vérifiées ou inactives exclues', async () => {
    supabase.etat.lignes = [
      fiche({ id: 'a-1', slug: 'durand-plomberie-marseille', legal_form: 'Entrepreneur individuel' }),
      fiche({ id: 'a-2', slug: 'batiment-sud-aix-en-provence', legal_form: 'SASU' }),
      fiche({ id: 'a-3', slug: 'construcoes-ribeiro-porto', legal_form: 'Lda', language: 'pt' }),
      fiche({ id: 'a-4', slug: 'canalizacao-silva-porto', legal_form: 'ENI', language: 'pt' }),
      fiche({ id: 'a-5', slug: null, legal_form: null, language: null }),
      fiche({ id: 'a-6', slug: 'non-verifie', verified: false }),
      fiche({ id: 'a-7', slug: 'inactif', active: false }),
    ]
    const xml = await (await sitemap4()).text()
    // Une seule URL par fiche : une société n'apparaît pas aussi sous /fr/artisan/.
    expect(locs(xml)).toEqual([
      '/fr/artisan/durand-plomberie-marseille/',
      '/fr/societe/batiment-sud-aix-en-provence/',
      '/pt/empresa/construcoes-ribeiro-porto/',
      '/fr/artisan/a-5/',
    ])
  })

  it('lastmod : updated_at quand il est renseigné, sinon pas de balise', async () => {
    supabase.etat.lignes = [
      fiche({ id: 'a-1', slug: 'avec-date', updated_at: '2026-10-30T08:15:00+00:00' }),
      fiche({ id: 'a-2', slug: 'sans-date' }),
    ]
    const xml = await (await sitemap4()).text()
    expect(xml).toContain('<loc>https://vitfix.io/fr/artisan/avec-date/</loc>\n    <lastmod>2026-10-30T08:15:00.000Z</lastmod>')
    expect((xml.match(/<lastmod>/g) ?? []).length).toBe(1)
  })

  it('erreur Supabase : sitemap vide et avertissement journalisé', async () => {
    supabase.etat.panne = { message: 'JWT expired', code: 'PGRST301' }
    const res = await sitemap4()
    expect(res.status).toBe(200)
    expect(await res.text()).not.toContain('<url>')
    expect(avertir).toHaveBeenCalledWith('[sitemap] fiches artisans indisponibles', expect.objectContaining({ message: 'JWT expired' }))
  })
})

describe('index /sitemap.xml et sous-sitemap 4', () => {
  beforeEach(() => {
    avertir.mockClear()
    supabase.etat.lignes = []
    supabase.etat.panne = null
    supabase.etat.requetes = []
  })

  const declareSitemap4 = async () => locs(await (await GET_INDEX()).text()).includes('/sitemap/4.xml')

  it('déclare /sitemap/4.xml dès qu’une fiche y est listée', async () => {
    supabase.etat.lignes = [fiche({ id: 'a-1', slug: 'durand-plomberie-marseille' })]
    expect(await declareSitemap4()).toBe(true)
  })

  it('ne le déclare pas quand il serait vide (aucune fiche listable), ni quand la lecture échoue', async () => {
    supabase.etat.lignes = [fiche({ id: 'a-4', slug: 'canalizacao-silva-porto', legal_form: 'ENI', language: 'pt' })]
    expect(await declareSitemap4()).toBe(false)
    supabase.etat.panne = { message: 'JWT expired', code: 'PGRST301' }
    expect(await declareSitemap4()).toBe(false)
    expect(avertir).toHaveBeenCalledWith('[sitemap] fiches artisans indisponibles', expect.objectContaining({ message: 'JWT expired' }))
  })
})

describe('chemin public de la fiche (getProfilePath, estFormeSociete)', () => {
  // Libellés que l'application écrit dans legal_form (app/api/verify-siret, app/api/artisan-company) et saisies courantes.
  it.each([
    'SARL', 'S.A.R.L.', 'SAS', 'SASU', 'EURL', 'SA', 'SA à conseil d\'administration', 'SA à directoire', 'SNC', 'SCI', 'SCP',
    'SELURL', 'SELARL', 'SELAS', 'SELAFA', 'SAS, société par actions simplifiée', 'Société à responsabilité limitée',
    'Entreprise unipersonnelle à responsabilité limitée', 'Société civile immobilière', 'Forme juridique 5202',
    'Lda', 'LDA', 'Unipessoal Lda', 'Sociedade Unipessoal por Quotas', 'Sociedade por Quotas, Lda', 'Sociedade Anónima',
  ])('%s : société', (forme) => expect(estFormeSociete(forme)).toBe(true))

  it.each([
    'Entrepreneur individuel', 'Entreprise individuelle', 'EI', 'EIRL', 'Entrepreneur individuel à responsabilité limitée',
    'Auto-Entrepreneur', 'Micro-entrepreneur', 'Micro-entreprise', 'ENI', 'Empresário em Nome Individual (ENI)',
    'Trabalhador independente', 'Association déclarée', 'Fondation', 'Forme juridique 1000', 'Forme juridique 9220',
    '', null, undefined,
  ])('%s : artisan individuel', (forme) => expect(estFormeSociete(forme)).toBe(false))

  it('société sous /fr/societe/ ou /pt/empresa/, individuel sous /fr/artisan/ ou /pt/profissional/, UUID sans slug', () => {
    expect(getProfilePath({ id: 'a-1', slug: 'batiment-sud', legal_form: 'SAS' }, 'fr')).toBe('/fr/societe/batiment-sud')
    expect(getProfilePath({ id: 'a-1', slug: 'construcoes-ribeiro', legal_form: 'Lda' }, 'pt')).toBe('/pt/empresa/construcoes-ribeiro')
    expect(getProfilePath({ id: 'a-1', slug: 'durand', legal_form: 'EI' }, 'fr')).toBe('/fr/artisan/durand')
    expect(getProfilePath({ id: 'a-1', slug: 'silva', legal_form: null }, 'pt')).toBe('/pt/profissional/silva')
    expect(getProfilePath({ id: 'a-1', slug: null }, 'fr')).toBe('/fr/artisan/a-1')
  })
})
