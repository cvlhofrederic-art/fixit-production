// ── Lecture de l'espace d'un copropriétaire dans la base du syndic ───────────
//
// Tout l'espace du copropriétaire résolu (lib/coproprietaire/acces.ts) en un appel : profil et lot,
// immeuble, syndic, demandes et travaux, charges et factures, documents, assemblées et votes,
// annonces. Service role → chaque requête est filtrée sur SON cabinet et SON immeuble, et chaque
// ligne passe par lib/coproprietaire/filtrage.ts (rien d'un autre lot, rien d'interne au cabinet).
// Une table en échec (ou absente : migration non appliquée) est journalisée et rendue vide : le
// reste de l'espace est servi. Jamais de cache.
//
// Lu par GET /api/coproprietaire/espace (portail) et par POST /api/copro-ai (assistant Fixy) :
// les deux voient exactement les mêmes données.

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { echapperMotifLike, emailNormalise, type AccesCopro } from '@/lib/coproprietaire/acces'
import {
  TYPES_DOCUMENTS_VISIBLES, construireAnnonces, construireAppels, construireAssemblees, construireAssurances,
  construireAutresLots, construireContrats, construireDemandes, construireDocuments, construireFactures,
  construireImmeuble, construireImpayes, construireProfil, construireSyndic, documentsParMission,
  filtrerInterventions, memeNom, nombre, restreindrePourLocataire,
  type LigneAppel, type LigneAssemblee, type LigneAssurance, type LigneAviso, type LigneCabinet, type LigneContrat,
  type LigneDocument, type LigneFacture, type LigneImmeuble, type LigneImpaye, type LigneMessagePro, type LigneMission,
  type LigneResolution, type LigneSignalement, type LigneVote,
} from '@/lib/coproprietaire/filtrage'
import type { EspaceCopro } from '@/lib/coproprietaire/types'

const COLONNES_IMMEUBLE = 'id, nom, adresse, ville, code_postal, nb_lots, annee_construction, type_immeuble, gestionnaire, '
  + 'budget_annuel, depenses_annee, reglement_texte, reglement_pdf_nom, reglement_date_maj, reglement_charges_repartition, '
  + 'reglement_majorite_ag, reglement_fonds_travaux, reglement_fonds_roulement_pct'
const COLONNES_SIGNALEMENT = 'id, type_intervention, description, priorite, statut, batiment, etage, num_lot, est_partie_commune, '
  + 'zone_signalee, artisan_assigne, created_at, updated_at, syndic_signalement_messages (id, auteur, role, texte, created_at)'
// locataire, telephone_locataire, acces_logement : lus pour décider si la mission est privée, jamais servis.
const COLONNES_MISSION = 'id, signalement_id, immeuble, artisan, type, description, priorite, statut, date_creation, date_intervention, '
  + 'montant_devis, montant_facture, batiment, etage, num_lot, locataire, telephone_locataire, acces_logement, demandeur_email, '
  + 'est_partie_commune, zone_signalee, travail_effectue, materiaux_utilises, problemes_constates, recommandations, date_rapport, '
  + 'duree_intervention, created_at'
const COLONNES_DOCUMENT = 'id, filename, mime_type, size_bytes, type, status, tags, uploaded_at, publie_extranet, espace_extranet, coproprio_id, categorie_extranet'
const COLONNES_MESSAGE_PRO = 'id, conversation_id, type, metadata, ordre_mission, created_at'

// `data: unknown` : les builders Supabase dont le select contient des parenthèses ou de longues
// listes sont typés GenericStringError[] par le client ; le type de ligne est fixé par l'appelant.
type Reponse = PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>

/** Lignes d'une requête, ou [] si elle échoue (journalisé) : une table absente ne bloque pas l'espace. */
async function lignes<T>(nom: string, requete: Reponse): Promise<T[]> {
  try {
    const { data, error } = await requete
    if (error) {
      logger.error(`[COPRO ESPACE] ${nom}`, { code: error.code, message: error.message })
      return []
    }
    return (data || []) as T[]
  } catch (e) {
    logger.error(`[COPRO ESPACE] ${nom} (exception)`, undefined, e)
    return []
  }
}

const vide = <T,>(): Promise<T[]> => Promise.resolve([])

/**
 * Demandes déposées avec l'e-mail du compte, avec leur provenance (`origine`, migration 20261017) ;
 * tant que la colonne manque (42703), relues sans elle : la provenance est alors inconnue (null).
 */
async function signalementsDuCompte(admin: SupabaseClient, cabinetId: string, email: string): Promise<LigneSignalement[]> {
  const requete = (colonnes: string): Reponse => admin.from('syndic_signalements').select(colonnes).eq('cabinet_id', cabinetId).eq('demandeur_email', email).is('deleted_at', null).order('created_at', { ascending: false }).limit(100)
  try {
    const { data, error } = await requete(`${COLONNES_SIGNALEMENT}, origine`)
    if (!error) return (data || []) as LigneSignalement[]
    if (error.code !== '42703') {
      logger.error('[COPRO ESPACE] signalements', { code: error.code, message: error.message })
      return []
    }
    logger.warn('[COPRO ESPACE] colonne origine absente (migration 20261017 non appliquée) : demandes relues sans provenance')
  } catch (e) {
    logger.error('[COPRO ESPACE] signalements (exception)', undefined, e)
    return []
  }
  return lignes<LigneSignalement>('signalements', requete(COLONNES_SIGNALEMENT))
}

/**
 * Espace complet (source 'reel') du copropriétaire dont l'accès a été résolu. Lève si l'assemblage
 * échoue (l'appelant journalise et répond 500) ; une table en échec est seulement rendue vide.
 * `admin` : client service role (injectable pour les tests).
 */
export async function lireEspaceCopro(acces: AccesCopro, admin: SupabaseClient = supabaseAdmin): Promise<EspaceCopro> {
  const { cabinetId, fiche, fiches, role, email, superAdmin } = acces
  const proprietaire = role === 'proprietaire'
  const nomImmeuble = (fiche.immeuble || '').trim()
  const motifImmeuble = echapperMotifLike(nomImmeuble)
  const mesFiches = new Set(fiches.map(f => f.id))

  // ── 1. Lectures indépendantes, en parallèle ──
  const [immeubles, cabinets, lotsImmeuble, signalements, missions, appels, factures, impayes, contrats, assurances, assemblees, avisos] =
    await Promise.all([
      nomImmeuble
        ? lignes<LigneImmeuble>('immeuble', admin.from('syndic_immeubles').select(COLONNES_IMMEUBLE).eq('cabinet_id', cabinetId).ilike('nom', motifImmeuble).limit(5))
        : vide<LigneImmeuble>(),
      lignes<LigneCabinet>('cabinet', admin.from('syndic_cabinets').select('nom, adresse, ville, code_postal, telephone, email').or(`id.eq.${cabinetId},user_id.eq.${cabinetId}`).limit(1)),
      nomImmeuble
        ? lignes<{ tantieme: number | string | null; immeuble: string | null }>('tantièmes', admin.from('syndic_coproprios').select('tantieme, immeuble').eq('cabinet_id', cabinetId).ilike('immeuble', motifImmeuble).limit(1000))
        : vide<{ tantieme: number | string | null; immeuble: string | null }>(),
      email ? signalementsDuCompte(admin, cabinetId, email) : vide<LigneSignalement>(),
      nomImmeuble
        ? lignes<LigneMission>('missions', admin.from('syndic_missions').select(COLONNES_MISSION).eq('cabinet_id', cabinetId).ilike('immeuble', motifImmeuble).is('deleted_at', null).order('created_at', { ascending: false }).limit(200))
        : vide<LigneMission>(),
      proprietaire
        ? lignes<LigneAppel>('appels de charges', admin.from('syndic_appels_charges').select('id, exercice, periode_debut, periode_fin, montant_total, montant_paye, statut, echeance, iban, reference_paiement').eq('cabinet_id', cabinetId).eq('coproprio_id', fiche.id).order('periode_debut', { ascending: false }).limit(100))
        : vide<LigneAppel>(),
      proprietaire
        ? lignes<LigneFacture>('factures', admin.from('syndic_factures_copro').select('id, numero_facture, emise_le, echeance, montant_ht, tva_taux, montant_ttc, description, statut, pdf_url').eq('cabinet_id', cabinetId).eq('coproprio_id', fiche.id).order('emise_le', { ascending: false }).limit(100))
        : vide<LigneFacture>(),
      proprietaire
        ? lignes<LigneImpaye>('impayés', admin.from('syndic_impayes').select('id, montant, nature, depuis, nb_relances, derniere_relance_at, statut').eq('cabinet_id', cabinetId).eq('coproprio_id', fiche.id).order('depuis', { ascending: false }).limit(50))
        : vide<LigneImpaye>(),
      nomImmeuble && proprietaire
        ? lignes<LigneContrat>('contrats', admin.from('syndic_contrats').select('id, immeuble, fornecedor, categoria, custo_mensal, custo_anual, data_inicio, data_fim, statut').eq('cabinet_id', cabinetId).ilike('immeuble', motifImmeuble).limit(100))
        : vide<LigneContrat>(),
      nomImmeuble && proprietaire
        ? lignes<LigneAssurance>('assurances', admin.from('syndic_seguros').select('id, immeuble, seguradora, tipo, apolice, premio_anual, capital, data_inicio, data_fim, statut').eq('cabinet_id', cabinetId).ilike('immeuble', motifImmeuble).limit(100))
        : vide<LigneAssurance>(),
      nomImmeuble && proprietaire
        ? lignes<LigneAssemblee>('assemblées', admin.from('syndic_assemblees').select('id, titre, immeuble, date_ag, lieu, type_ag, statut, ordre_du_jour, total_tantiemes, pv_content, convocation_sent_at').eq('cabinet_id', cabinetId).ilike('immeuble', motifImmeuble).neq('statut', 'brouillon').order('date_ag', { ascending: false }).limit(50))
        : vide<LigneAssemblee>(),
      lignes<LigneAviso>('annonces', admin.from('syndic_avisos').select('id, immeuble, titulo, descricao, categoria, prioridade, fixado, created_at').eq('cabinet_id', cabinetId).order('created_at', { ascending: false }).limit(100)),
    ])

  const immeuble = immeubles.find(i => memeNom(i.nom, nomImmeuble)) ?? null
  const assembleesImmeuble = assemblees.filter(a => memeNom(a.immeuble, nomImmeuble))
  const missionsImmeuble = missions.filter(m => memeNom(m.immeuble, nomImmeuble))
  const fichesImmeuble = lotsImmeuble.filter(l => memeNom(l.immeuble, nomImmeuble))

  // ── 2. Lectures qui dépendent de la première passe ──
  const [documents, resolutions, ordres] = await Promise.all([
    immeuble && proprietaire
      ? lignes<LigneDocument>('documents', admin.from('syndic_documents').select(COLONNES_DOCUMENT).eq('cabinet_id', cabinetId).eq('immeuble_id', immeuble.id).eq('publie_extranet', true).in('type', [...TYPES_DOCUMENTS_VISIBLES]).neq('status', 'error').order('uploaded_at', { ascending: false }).limit(200))
      : vide<LigneDocument>(),
    assembleesImmeuble.length > 0
      ? lignes<LigneResolution>('résolutions', admin.from('syndic_resolutions').select('id, assemblee_id, titre, description, numero_ordre, majorite, vote_pour, vote_contre, vote_abstention, statut').eq('cabinet_id', cabinetId).in('assemblee_id', assembleesImmeuble.map(a => a.id)).limit(500))
      : vide<LigneResolution>(),
    missionsImmeuble.length > 0 && proprietaire
      ? lignes<LigneMessagePro>('ordres de mission', admin.from('conversation_messages').select(COLONNES_MESSAGE_PRO).eq('type', 'ordre_mission').in('ordre_mission->>syndic_mission_id', missionsImmeuble.map(m => m.id)).is('deleted_at', null).limit(300))
      : vide<LigneMessagePro>(),
  ])

  // ── 3. Mon vote par correspondance ; documents des prestataires (conversations du cabinet seulement) ──
  const conversationIds = [...new Set(ordres.map(o => o.conversation_id))]
  const [votes, conversationsDuCabinet] = await Promise.all([
    resolutions.length > 0
      ? lignes<LigneVote>('votes', admin.from('syndic_votes_correspondance').select('resolution_id, vote, date_reception').eq('cabinet_id', cabinetId).in('coproprio_id', [...mesFiches]).in('resolution_id', resolutions.map(r => r.id)).limit(500))
      : vide<LigneVote>(),
    conversationIds.length > 0
      ? lignes<{ id: string }>('conversations', admin.from('conversations').select('id').eq('contact_id', cabinetId).eq('contact_type', 'pro').in('id', conversationIds).is('deleted_at', null).limit(100))
      : vide<{ id: string }>(),
  ])
  const idsSurs = conversationsDuCabinet.map(c => c.id)
  // Tous les ordres de ces conversations (pas seulement ceux de mes missions) : chaque document est
  // rattaché au dernier ordre qui le précède, et un document d'une mission d'un autre immeuble ne
  // doit pas être attribué à la mienne.
  const [tousLesOrdres, documentsPro] = idsSurs.length > 0
    ? await Promise.all([
      lignes<LigneMessagePro>('ordres des conversations', admin.from('conversation_messages').select(COLONNES_MESSAGE_PRO).in('conversation_id', idsSurs).eq('type', 'ordre_mission').is('deleted_at', null).order('created_at', { ascending: true }).limit(500)),
      lignes<LigneMessagePro>('documents des prestataires', admin.from('conversation_messages').select(COLONNES_MESSAGE_PRO).in('conversation_id', idsSurs).not('metadata->document', 'is', null).is('deleted_at', null).order('created_at', { ascending: true }).limit(500)),
    ])
    : [[], []]
  const docsParMission = documentsParMission([...tousLesOrdres, ...documentsPro])

  // ── 4. Vues ──
  const totalTantiemes = fichesImmeuble.reduce((s, l) => s + nombre(l.tantieme), 0)
  const profil = construireProfil(fiche, role, totalTantiemes, fichesImmeuble.length, nombre(immeuble?.nb_lots))
  const contexte = {
    email,
    emailLocataire: proprietaire ? emailNormalise(fiche.email_locataire) || undefined : undefined,
    immeuble: nomImmeuble,
    batiment: profil.batiment,
    etage: profil.etage,
    numLot: profil.numLot,
  }
  const mesSignalements = new Set(signalements.map(s => s.id))

  const espace: EspaceCopro = {
    source: 'reel',
    vueSuperAdmin: superAdmin,
    chargeLe: new Date().toISOString(),
    profil,
    autresLots: construireAutresLots(fiches, fiche),
    immeuble: construireImmeuble(immeuble, nomImmeuble),
    syndic: construireSyndic(cabinets[0] ?? null),
    interventions: {
      mesDemandes: construireDemandes(signalements, missionsImmeuble, docsParMission),
      immeuble: filtrerInterventions(missionsImmeuble, contexte, mesSignalements, docsParMission),
    },
    finances: {
      solde: profil.solde,
      appels: construireAppels(appels),
      factures: construireFactures(factures),
      impayes: construireImpayes(impayes),
    },
    documents: {
      fichiers: construireDocuments(documents, mesFiches),
      contrats: construireContrats(contrats, nomImmeuble),
      assurances: construireAssurances(assurances, nomImmeuble),
    },
    assemblees: construireAssemblees(assembleesImmeuble, resolutions, votes, nomImmeuble),
    annonces: construireAnnonces(avisos, nomImmeuble),
  }
  return role === 'locataire' ? restreindrePourLocataire(espace) : espace
}
