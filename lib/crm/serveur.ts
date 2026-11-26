// ── CRM du secrétariat : lectures et écritures en base (serveur seul) ───────
// Clé service (supabaseAdmin) : les tables crm_* n'ont aucune politique RLS ni aucun droit pour anon et authenticated
// (migration 20261122_crm_secretariat.sql). L'accès est décidé avant, par controlerAccesCrm (lib/crm/acces.ts).

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import type {
  ContactCrm,
  ContactResumeCrm,
  ContactTrouveCrm,
  DemandeCrm,
  DetailDemandeCrm,
  EvenementCrm,
  StatutCrm,
  TypeEvenementCrm,
} from './types'
import { prioriteParDefaut, titreParDefaut, type CreerDemandeEntree, type ModifierContactEntree, type ModifierDemandeEntree } from './schemas'

const COLONNES_CONTACT = 'id, nom, telephone, email, ville, langue, notes, created_at, updated_at'
const COLONNES_DEMANDE =
  'id, numero, contact_id, titre, description, motif, canal, priorite, statut, rappel_le, resolue_le, created_at, updated_at, contact:crm_contacts(id, nom, telephone)'
const COLONNES_EVENEMENT = 'id, demande_id, contact_id, type, contenu, auteur_nom, created_at'

/** Demandes chargées sur l'écran : toutes les ouvertes, plus les résolues des 30 derniers jours. */
export const JOURS_RESOLUES_AFFICHEES = 30
export const LIMITE_LISTE = 500
const LIMITE_HISTORIQUE = 500
const LIMITE_RECHERCHE = 20

export type CodeErreurCrm = 'introuvable' | 'conflit' | 'base'

export class ErreurCrm extends Error {
  constructor(
    readonly code: CodeErreurCrm,
    message: string,
  ) {
    super(message)
    this.name = 'ErreurCrm'
  }
}

export interface AuteurCrm {
  id: string
  nom: string
}

interface ErreurPostgrest {
  code?: string
  message: string
}

function echec(contexte: string, erreur: ErreurPostgrest): ErreurCrm {
  if (erreur.code === '23505') return new ErreurCrm('conflit', `${contexte} : ${erreur.message}`)
  return new ErreurCrm('base', `${contexte} : ${erreur.message}`)
}

/** PostgREST rend une jointure un-à-un en objet (ou en tableau selon la relation) : toujours un objet ou null. */
function normaliserDemande(ligne: Record<string, unknown>): DemandeCrm {
  const brut = ligne.contact as ContactResumeCrm | ContactResumeCrm[] | null | undefined
  const contact = Array.isArray(brut) ? (brut[0] ?? null) : (brut ?? null)
  return { ...(ligne as unknown as DemandeCrm), contact }
}

/**
 * Caractères spéciaux de LIKE (% et _) et barre oblique inverse échappés : la recherche reste littérale. L'étoile, que
 * PostgREST lit comme %, est retirée (elle ne s'échappe pas).
 */
export function echapperLike(texte: string): string {
  return texte.replaceAll('*', '').replace(/[\\%_]/g, (c) => `\\${c}`)
}

async function journaliser(
  evenement: { demande_id: string | null; contact_id: string | null; type: TypeEvenementCrm; contenu: string },
  auteur: AuteurCrm,
): Promise<EvenementCrm | null> {
  const { data, error } = await supabaseAdmin
    .from('crm_evenements')
    .insert({ ...evenement, auteur: auteur.id, auteur_nom: auteur.nom })
    .select(COLONNES_EVENEMENT)
    .single()
  if (error) {
    // La demande est déjà enregistrée : l'historique incomplet ne doit pas faire croire à un échec de la saisie.
    logger.error('[crm] historique non enregistré', { module: 'crm', type: evenement.type }, new Error(error.message))
    return null
  }
  return data as EvenementCrm
}

export async function listerDemandes(maintenant: Date): Promise<DemandeCrm[]> {
  const depuis = new Date(maintenant.getTime() - JOURS_RESOLUES_AFFICHEES * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabaseAdmin
    .from('crm_demandes')
    .select(COLONNES_DEMANDE)
    .or(`statut.neq.resolue,resolue_le.gte.${depuis}`)
    .order('created_at', { ascending: false })
    .limit(LIMITE_LISTE)
  if (error) throw echec('liste des demandes', error)
  return (data ?? []).map((l) => normaliserDemande(l as Record<string, unknown>))
}

async function contactParTelephone(telephone: string): Promise<ContactCrm | null> {
  const { data, error } = await supabaseAdmin.from('crm_contacts').select(COLONNES_CONTACT).eq('telephone', telephone).maybeSingle()
  if (error) throw echec('contact par numéro', error)
  return (data as ContactCrm | null) ?? null
}

/** Fiche du numéro (créée si besoin) ; sans numéro ni nom, aucune fiche (appel masqué non identifié). */
async function trouverOuCreerContact(telephone: string | null, nom: string | null, auteur: AuteurCrm): Promise<string | null> {
  if (telephone) {
    const existant = await contactParTelephone(telephone)
    if (existant) {
      if (nom && existant.nom === '') {
        const { error } = await supabaseAdmin.from('crm_contacts').update({ nom, updated_at: new Date().toISOString() }).eq('id', existant.id)
        if (error) throw echec('nom du contact', error)
      }
      return existant.id
    }
  }
  if (!telephone && !nom) return null
  const { data, error } = await supabaseAdmin
    .from('crm_contacts')
    .insert({ nom: nom ?? '', telephone, cree_par: auteur.id })
    .select('id')
    .single()
  if (error) {
    // Même numéro créé entre-temps par un autre poste : on reprend sa fiche.
    if (error.code === '23505' && telephone) {
      const course = await contactParTelephone(telephone)
      if (course) return course.id
    }
    throw echec('création du contact', error)
  }
  return (data as { id: string }).id
}

export async function creerDemande(entree: CreerDemandeEntree, auteur: AuteurCrm): Promise<DemandeCrm> {
  let contactId: string | null
  if (entree.contact_id) {
    const { data, error } = await supabaseAdmin.from('crm_contacts').select('id').eq('id', entree.contact_id).maybeSingle()
    if (error) throw echec('contact de la demande', error)
    if (!data) throw new ErreurCrm('introuvable', 'contact inconnu')
    contactId = entree.contact_id
  } else {
    contactId = await trouverOuCreerContact(entree.telephone ?? null, entree.nom?.trim() || null, auteur)
  }

  const { data, error } = await supabaseAdmin
    .from('crm_demandes')
    .insert({
      contact_id: contactId,
      titre: titreParDefaut(entree.titre, entree.description),
      description: entree.description,
      motif: entree.motif,
      canal: entree.canal,
      priorite: prioriteParDefaut(entree.motif, entree.priorite),
      rappel_le: entree.rappel_le ?? null,
      cree_par: auteur.id,
    })
    .select(COLONNES_DEMANDE)
    .single()
  if (error) throw echec('création de la demande', error)
  const demande = normaliserDemande(data as Record<string, unknown>)
  await journaliser({ demande_id: demande.id, contact_id: contactId, type: 'creation', contenu: '' }, auteur)
  return demande
}

export async function lireDemande(id: string): Promise<DetailDemandeCrm> {
  const { data, error } = await supabaseAdmin.from('crm_demandes').select(COLONNES_DEMANDE).eq('id', id).maybeSingle()
  if (error) throw echec('lecture de la demande', error)
  if (!data) throw new ErreurCrm('introuvable', 'demande inconnue')
  const demande = normaliserDemande(data as Record<string, unknown>)

  const [historique, fiche] = await Promise.all([
    supabaseAdmin
      .from('crm_evenements')
      .select(COLONNES_EVENEMENT)
      .eq('demande_id', id)
      .order('created_at', { ascending: true })
      .limit(LIMITE_HISTORIQUE),
    demande.contact_id
      ? supabaseAdmin.from('crm_contacts').select(COLONNES_CONTACT).eq('id', demande.contact_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  if (historique.error) throw echec('historique', historique.error)
  if (fiche.error) throw echec('fiche du contact', fiche.error)
  return { demande, contact: (fiche.data as ContactCrm | null) ?? null, evenements: (historique.data ?? []) as EvenementCrm[] }
}

export async function modifierDemande(id: string, patch: ModifierDemandeEntree, auteur: AuteurCrm, maintenant: Date): Promise<DemandeCrm> {
  const { data: actuelle, error: erreurLecture } = await supabaseAdmin
    .from('crm_demandes')
    .select('id, statut, contact_id')
    .eq('id', id)
    .maybeSingle()
  if (erreurLecture) throw echec('lecture avant modification', erreurLecture)
  if (!actuelle) throw new ErreurCrm('introuvable', 'demande inconnue')
  const avant = actuelle as { id: string; statut: StatutCrm; contact_id: string | null }

  const maj: Record<string, unknown> = { ...patch, updated_at: maintenant.toISOString() }
  const changeDeStatut = patch.statut !== undefined && patch.statut !== avant.statut
  if (changeDeStatut) maj.resolue_le = patch.statut === 'resolue' ? maintenant.toISOString() : null

  const { data, error } = await supabaseAdmin.from('crm_demandes').update(maj).eq('id', id).select(COLONNES_DEMANDE).single()
  if (error) throw echec('modification de la demande', error)
  if (changeDeStatut) {
    await journaliser({ demande_id: id, contact_id: avant.contact_id, type: 'statut', contenu: `${avant.statut}>${patch.statut}` }, auteur)
  }
  return normaliserDemande(data as Record<string, unknown>)
}

export async function ajouterNote(id: string, contenu: string, auteur: AuteurCrm, maintenant: Date): Promise<EvenementCrm> {
  const { data: demande, error } = await supabaseAdmin.from('crm_demandes').select('id, contact_id').eq('id', id).maybeSingle()
  if (error) throw echec('demande de la note', error)
  if (!demande) throw new ErreurCrm('introuvable', 'demande inconnue')
  const { data, error: erreurNote } = await supabaseAdmin
    .from('crm_evenements')
    .insert({ demande_id: id, contact_id: (demande as { contact_id: string | null }).contact_id, type: 'note', contenu, auteur: auteur.id, auteur_nom: auteur.nom })
    .select(COLONNES_EVENEMENT)
    .single()
  if (erreurNote) throw echec('enregistrement de la note', erreurNote)
  const { error: erreurDate } = await supabaseAdmin.from('crm_demandes').update({ updated_at: maintenant.toISOString() }).eq('id', id)
  if (erreurDate) logger.warn('[crm] date de la demande non mise à jour après une note', { module: 'crm' })
  return data as EvenementCrm
}

/** Fiche d'un numéro et nombre de ses demandes, ou null (nouveau client). */
export async function chercherContactParTelephone(telephone: string): Promise<ContactTrouveCrm | null> {
  const contact = await contactParTelephone(telephone)
  if (!contact) return null
  const { count, error } = await supabaseAdmin.from('crm_demandes').select('id', { count: 'exact', head: true }).eq('contact_id', contact.id)
  if (error) throw echec('nombre de demandes du contact', error)
  return { contact, nbDemandes: count ?? 0 }
}

/** Recherche par nom ou par chiffres du numéro (au moins 3), 20 fiches au plus. */
export async function chercherContacts(texte: string): Promise<ContactCrm[]> {
  const q = texte.trim().slice(0, 80)
  if (q.length < 2) return []
  const chiffres = q.replace(/\D/g, '')
  const [parNom, parNumero] = await Promise.all([
    supabaseAdmin.from('crm_contacts').select(COLONNES_CONTACT).ilike('nom', `%${echapperLike(q)}%`).order('nom').limit(LIMITE_RECHERCHE),
    chiffres.length >= 3
      ? supabaseAdmin.from('crm_contacts').select(COLONNES_CONTACT).like('telephone', `%${chiffres}%`).limit(LIMITE_RECHERCHE)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (parNom.error) throw echec('recherche par nom', parNom.error)
  if (parNumero.error) throw echec('recherche par numéro', parNumero.error)
  const vus = new Map<string, ContactCrm>()
  for (const c of [...(parNom.data ?? []), ...(parNumero.data ?? [])] as ContactCrm[]) vus.set(c.id, c)
  return [...vus.values()].slice(0, LIMITE_RECHERCHE)
}

export async function modifierContact(id: string, patch: ModifierContactEntree, maintenant: Date): Promise<ContactCrm> {
  const { data, error } = await supabaseAdmin
    .from('crm_contacts')
    .update({ ...patch, updated_at: maintenant.toISOString() })
    .eq('id', id)
    .select(COLONNES_CONTACT)
    .maybeSingle()
  if (error) throw echec('modification du contact', error)
  if (!data) throw new ErreurCrm('introuvable', 'contact inconnu')
  return data as ContactCrm
}
