import { journaliserActivite, type OptionsEcriture } from '@/lib/administrateur-judiciaire/db/repository'
import { ajDb, type PieceTraitementEnregistree } from '@/lib/administrateur-judiciaire/db/schema'
import { FAMILLES_ENCAISSEMENT } from '@/lib/administrateur-judiciaire/domain/encaissements-pieces'
import {
  annulerPiece,
  changerStatutPiece,
  creerPieceTraitement,
  numeroPieceSuivant,
  segmentComptableSyndicat,
  type OptionsAnnulationPiece,
  type ParametreTraitement,
  type StatutPiece,
} from '@/lib/administrateur-judiciaire/domain/journal-traitements'
import type { Traitement } from '@/lib/administrateur-judiciaire/domain/traitements'

/**
 * Seul point d'écriture des pièces du journal des traitements (table `traitements`, version 3 ; D1 ; R6), sur le modèle
 * de changerStatutAg : dans une même transaction, lecture, fonction du domaine (journal-traitements.ts), écriture et
 * journal d'activité. Une erreur n'écrit rien.
 * - Numéro : séquence unique du cabinet (numeroPieceSuivant sur la dernière pièce), tiré DANS la transaction ; l'index
 *   unique &numero refuse en plus tout doublon.
 * - D1 : le syndicat propriétaire (son segment comptable, lu sur sa copropriété) et le mandat auteur, qui doit être une
 *   mission sur ce syndicat.
 * - Statut : une étape en avant (changerStatutPiece) ; annulation d'une pièce « Enregistré » par une écriture contraire
 *   numérotée à la suite (annulerPiece). Jamais de suppression (repoTraitements la refuse).
 * Appel de fonds (cycle document) : son annulation suit son propre circuit (annulerTraitement et annulerAppelees,
 * echeancier-appels.ts), écrit avec ses échéances par la PR écran.
 * Encaissement (toutes ses familles) : son annulation suit aussi son propre circuit (annulerEncaissementEcrit,
 * db/encaissements.ts), qui passe l'écriture contraire ET défait l'imputation sur les postes du compte copropriétaire ;
 * annulerPieceTraitement refuse donc ces familles (les postes resteraient réglés, et une seconde écriture contraire
 * resterait possible).
 */

const horodater = <T extends object>(objet: T, actor: string | null) => {
  const maintenant = new Date().toISOString()
  return { ...objet, createdAt: maintenant, updatedAt: maintenant, createdBy: actor, updatedBy: actor }
}

/** Segment comptable du syndicat (D1), lu sur sa copropriété. */
async function segmentDuSyndicat(coproprieteId: string): Promise<string> {
  const copropriete = await ajDb.coproprietes.get(coproprieteId)
  if (!copropriete) throw new Error(`Copropriété introuvable (id=${coproprieteId}) : pas de pièce sans syndicat (D1).`)
  return segmentComptableSyndicat(copropriete.code)
}

/** D1 : le mandat auteur existe et porte sur le syndicat de la pièce. */
async function verifierMandat(mandatId: string, coproprieteId: string): Promise<void> {
  const mandat = await ajDb.mandats.get(mandatId)
  if (!mandat) throw new Error(`Mandat introuvable (id=${mandatId}) : D1 garde le mandat qui a produit chaque pièce.`)
  if (mandat.coproprieteId !== coproprieteId)
    throw new Error(`Mandat ${mandatId} d'un autre syndicat (${mandat.coproprieteId}) que la pièce (${coproprieteId}) : D1.`)
}

/** Numéro suivant de la séquence du cabinet, à lire dans la transaction de l'écriture. */
async function numeroSuivant(): Promise<number> {
  const derniere = await ajDb.traitements.orderBy('numero').last()
  return numeroPieceSuivant(derniere ? [derniere] : [])
}

/** Enregistre la pièce d'un traitement (creerPieceTraitement) au statut initial de son cycle. */
export function enregistrerPieceTraitement(
  { traitement, coproprieteId, mandatId, parametres = [] }: { traitement: Traitement; coproprieteId: string; mandatId: string; parametres?: ParametreTraitement[] },
  { actor = null }: OptionsEcriture = {},
): Promise<PieceTraitementEnregistree> {
  return ajDb.transaction('rw', ajDb.traitements, ajDb.coproprietes, ajDb.mandats, ajDb.activityLog, async () => {
    const segmentSyndicat = await segmentDuSyndicat(coproprieteId)
    await verifierMandat(mandatId, coproprieteId)
    const piece = creerPieceTraitement({ traitement, numero: await numeroSuivant(), coproprieteId, segmentSyndicat, mandatId, parametres })
    const enregistree: PieceTraitementEnregistree = horodater(piece, actor)
    await ajDb.traitements.add(enregistree)
    await journaliserActivite({ entite: 'traitements', entiteId: enregistree.id, action: 'create', qui: actor, avant: null, apres: enregistree })
    return enregistree
  })
}

async function lirePiece(id: string): Promise<PieceTraitementEnregistree> {
  const piece = await ajDb.traitements.get(id)
  if (!piece) throw new Error(`traitements introuvable (id=${id})`)
  return piece
}

/** Fait avancer le statut d'une étape (changerStatutPiece) ; « Annulé » passe par annulerPieceTraitement. */
export function changerStatutTraitement(id: string, nouveau: StatutPiece, { actor = null }: OptionsEcriture = {}): Promise<PieceTraitementEnregistree> {
  return ajDb.transaction('rw', ajDb.traitements, ajDb.activityLog, async () => {
    const avant = await lirePiece(id)
    const apres: PieceTraitementEnregistree = {
      ...avant,
      statut: changerStatutPiece(avant, nouveau).statut,
      updatedAt: new Date().toISOString(),
      updatedBy: actor,
    }
    await ajDb.traitements.put(apres)
    await journaliserActivite({ entite: 'traitements', entiteId: id, action: 'update', qui: actor, avant, apres })
    return apres
  })
}

/**
 * Annule une pièce « Enregistré » (annulerPiece) : la pièce passe « Annulé » (annuleePar), l'écriture contraire est
 * enregistrée avec le numéro suivant de la séquence du cabinet. `mandatId` : mandat qui annule, par défaut celui de la
 * pièce ; s'il est donné, il doit porter sur le même syndicat. Refuse une pièce d'encaissement, quelle que soit sa
 * famille : elle s'annule encaissement par encaissement, par annulerEncaissementEcrit (db/encaissements.ts).
 */
export function annulerPieceTraitement(
  id: string,
  options: Omit<OptionsAnnulationPiece, 'numero' | 'segmentSyndicat'>,
  { actor = null }: OptionsEcriture = {},
): Promise<{ piece: PieceTraitementEnregistree; annulation: PieceTraitementEnregistree }> {
  return ajDb.transaction('rw', ajDb.traitements, ajDb.coproprietes, ajDb.mandats, ajDb.activityLog, async () => {
    const avant = await lirePiece(id)
    if ((FAMILLES_ENCAISSEMENT as readonly string[]).includes(avant.famille))
      throw new Error(
        `Pièce n° ${avant.numero} (« ${avant.famille} ») : un encaissement s'annule par annulerEncaissementEcrit (db/encaissements.ts), qui passe l'écriture contraire et défait son imputation sur les postes du compte ; l'annulation générique laisserait ces postes réglés.`,
      )
    const segmentSyndicat = await segmentDuSyndicat(avant.coproprieteId)
    if (options.mandatId !== undefined) await verifierMandat(options.mandatId, avant.coproprieteId)
    const resultat = annulerPiece(avant, { ...options, numero: await numeroSuivant(), segmentSyndicat })
    const maintenant = new Date().toISOString()
    const piece: PieceTraitementEnregistree = {
      ...avant,
      statut: resultat.piece.statut,
      annuleePar: resultat.piece.annuleePar,
      updatedAt: maintenant,
      updatedBy: actor,
    }
    const annulation: PieceTraitementEnregistree = horodater(resultat.annulation, actor)
    await ajDb.traitements.put(piece)
    await ajDb.traitements.add(annulation)
    await journaliserActivite({ entite: 'traitements', entiteId: id, action: 'update', qui: actor, avant, apres: piece })
    await journaliserActivite({ entite: 'traitements', entiteId: annulation.id, action: 'create', qui: actor, avant: null, apres: annulation })
    return { piece, annulation }
  })
}
