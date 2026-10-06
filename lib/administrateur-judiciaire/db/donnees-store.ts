'use client'

import {
  repoCoproprietaires,
  repoCoproprietes,
  repoContrats,
  repoDocuments,
  repoEcheances,
  repoEcritures,
  repoImpayes,
  repoJournaux,
  repoLots,
  repoMandats,
  repoNotifications,
  repoPrestataires,
  repoSinistres,
  repoTaches,
} from '@/lib/administrateur-judiciaire/db/repositories'
import type { DonneesCreation, DonneesModification } from '@/lib/administrateur-judiciaire/db/repository'
import {
  ajDb,
  type Contrat,
  type Coproprietaire,
  type Copropriete,
  type DocumentLocal,
  type EcheanceSuivi,
  type Ecriture,
  type Impaye,
  type Journal,
  type Lot,
  type Mandat,
  type NotificationLocale,
  type Prestataire,
  type Sinistre,
  type Tache,
} from '@/lib/administrateur-judiciaire/db/schema'
import {
  fusionnerCoproMandat,
  genererCodeCopro,
  type CoproprieteVue,
} from '@/lib/administrateur-judiciaire/domain/coproprietes'
import { ajouterMois, dateVersIso } from '@/lib/administrateur-judiciaire/domain/dates'
import type { LigneListeCoproprietaires } from '@/lib/administrateur-judiciaire/domain/import/liste-coproprietaires'
import type { LigneReleve } from '@/lib/administrateur-judiciaire/domain/import/releve-bancaire'
import { ecrireStatutRecouvrement } from '@/lib/administrateur-judiciaire/domain/recouvrement'
import { piecesRepriseRecues } from '@/lib/administrateur-judiciaire/domain/reprise'
import { AUJOURDHUI } from '@/lib/administrateur-judiciaire/mode'
import { creerStore } from '@/lib/administrateur-judiciaire/store'

/**
 * Données de la base locale chargées en mémoire (une seule lecture de toutes les tables utiles), et actions
 * d'écriture qui passent par les repositories puis mettent l'état à jour. Les consommateurs appellent le hook sans
 * sélecteur (abonnement à tout l'état).
 */

/** Saisie d'une nouvelle copropriété (et de son mandat). */
export interface SaisieCopropriete {
  nom: string
  adresse: string
  nbLots: number
  rg: string
  fondement: string
  /** Date locale ; aujourd'hui (jour courant de l'application) par défaut. */
  ordonnance?: Date | null
  /** 12 mois par défaut. */
  dureeMois?: number | null
  tribunal?: string
  motif?: string
  /** Ordonnance source : un document « ordonnance » est alors rattaché au mandat. */
  source?: { nom: string } | null
}

/** Champs modifiables d'une copropriété (copropriété et mandat). */
export type SaisieModificationCopropriete = Pick<SaisieCopropriete, 'nom' | 'adresse' | 'nbLots' | 'rg' | 'fondement'>

export interface ResultatImportCoproprietaires {
  crees: number
  misAJour: number
}

export interface EtatDonneesStore {
  coproprietes: Copropriete[]
  mandats: Mandat[]
  prestataires: Prestataire[]
  lots: Lot[]
  coproprietaires: Coproprietaire[]
  echeances: EcheanceSuivi[]
  taches: Tache[]
  notifications: NotificationLocale[]
  contrats: Contrat[]
  sinistres: Sinistre[]
  impayes: Impaye[]
  ecritures: Ecriture[]
  journaux: Journal[]
  documents: DocumentLocal[]
  loaded: boolean
  loading: boolean
  erreur: string | null
  /** Charge toutes les tables ; ignoré seulement pendant un chargement (un rechargement reste possible). */
  loadAll: () => Promise<void>
  createCopropriete: (saisie: SaisieCopropriete) => Promise<CoproprieteVue>
  updateCopropriete: (id: string, saisie: SaisieModificationCopropriete) => Promise<CoproprieteVue>
  createPrestataire: (saisie: DonneesCreation<Prestataire>) => Promise<Prestataire>
  /** Écritures 512 (renvoyées) et, pour chaque sortie, une écriture 471 « À ventiler ». Dates reçues en ISO. */
  importerReleve: (coproprieteId: string, lignes: LigneReleve[]) => Promise<Ecriture[]>
  imputerEncaissement: (ecritureId: string, coproprietaireId: string, dateIso: string) => Promise<void>
  avancerRecouvrement: (coproprietaireId: string, etape: string, dateIso: string) => Promise<Impaye>
  importerCoproprietaires: (
    coproprieteId: string,
    lignes: LigneListeCoproprietaires[],
  ) => Promise<ResultatImportCoproprietaires>
  basculerPieceReprise: (coproprieteId: string, cle: string, libelle: string, dateIso: string) => Promise<void>
  creerNote: (
    coproprieteId: string | null,
    titre: string,
    description: string,
    dateIso: string,
  ) => Promise<NotificationLocale>
  updatePrestataire: (id: string, patch: DonneesModification<Prestataire>) => Promise<Prestataire>
}

/**
 * Dernier import de liste de copropriétaires lancé (null quand aucun n'est en cours). Correctif d'un défaut hérité de
 * la maquette : deux imports concurrents (double clic sur « Importer N copropriétaires », bouton actif pendant
 * l'import) lisaient tous deux l'état avant les créations de l'autre et dupliquaient lots et copropriétaires.
 */
let dernierImportCoproprietaires: Promise<unknown> | null = null

/**
 * Exécute les imports de liste de copropriétaires l'un après l'autre : sans import en cours, démarrage immédiat
 * (comportement inchangé) ; sinon, démarrage à la fin du précédent, qu'il ait réussi ou échoué. Le suivant retrouve
 * alors les lots et les personnes déjà créés, qu'il met à jour.
 */
function enFileImportCoproprietaires<T>(executer: () => Promise<T>): Promise<T> {
  const precedent = dernierImportCoproprietaires,
    execution = precedent ? precedent.then(executer) : executer(),
    fin = execution.then(
      () => undefined,
      () => undefined,
    )
  dernierImportCoproprietaires = fin
  // `fin` ne rejette jamais (les deux issues de l'exécution y sont absorbées) : promesse non attendue.
  void fin.then(() => {
    if (dernierImportCoproprietaires === fin) dernierImportCoproprietaires = null
  })
  return execution
}

export const useDonneesStore = creerStore<EtatDonneesStore>()((set, get) => ({
  coproprietes: [],
  mandats: [],
  prestataires: [],
  lots: [],
  coproprietaires: [],
  echeances: [],
  taches: [],
  notifications: [],
  contrats: [],
  sinistres: [],
  impayes: [],
  ecritures: [],
  journaux: [],
  documents: [],
  loaded: false,
  loading: false,
  erreur: null,
  loadAll: async () => {
    if (!get().loading) {
      set({
        loading: true,
      })
      try {
        const [
          coproprietes,
          mandats,
          prestataires,
          lots,
          coproprietaires,
          echeances,
          taches,
          notifications,
          contrats,
          sinistres,
          impayes,
          ecritures,
          journaux,
          documents,
        ] = await Promise.all([
          repoCoproprietes.list(),
          repoMandats.list(),
          repoPrestataires.list(),
          repoLots.list(),
          repoCoproprietaires.list(),
          repoEcheances.list(),
          repoTaches.list(),
          repoNotifications.list(),
          repoContrats.list(),
          repoSinistres.list(),
          repoImpayes.list(),
          repoEcritures.list(),
          repoJournaux.list(),
          repoDocuments.list(),
        ])
        set({
          coproprietes,
          mandats,
          prestataires,
          lots,
          coproprietaires,
          echeances,
          taches,
          notifications,
          contrats,
          sinistres,
          impayes,
          ecritures,
          journaux,
          documents,
          loaded: true,
          loading: false,
          erreur: null,
        })
      } catch (erreur) {
        set({
          loaded: true,
          loading: false,
          erreur: erreur instanceof Error ? erreur.message : String(erreur),
        })
      }
    }
  },
  createCopropriete: async (saisie) => {
    const copro = await repoCoproprietes.create({
        code: genererCodeCopro(saisie.nom),
        nom: saisie.nom,
        adresse: saisie.adresse,
        nbLots: saisie.nbLots,
        budget: 0,
        depense: 0,
        impayes: 0,
        fondsTravaux: 0,
      }),
      ordonnance =
        saisie.ordonnance ?? new Date(AUJOURDHUI.getUTCFullYear(), AUJOURDHUI.getUTCMonth(), AUJOURDHUI.getUTCDate()),
      dureeMois = saisie.dureeMois ?? 12,
      // Comme dans la maquette, une ordonnance invalide (dateVersIso → null) fait lever ajouterMois,
      // alors que la copropriété est déjà enregistrée.
      [annee, mois, jour] = ajouterMois(dateVersIso(ordonnance) as string, dureeMois).split('-').map(Number),
      echeance = new Date(annee, mois - 1, jour),
      mandat = await repoMandats.create({
        coproprieteId: copro.id,
        fondement: saisie.fondement,
        motif: saisie.motif ?? '',
        tribunal: saisie.tribunal ?? '',
        rg: saisie.rg,
        ordonnance,
        dureeMois,
        echeance,
        statut: 'En cours',
        pill: 'sage',
        notifOrdonnance: 'À notifier',
      }),
      vue = fusionnerCoproMandat(copro, mandat)
    set((etat) => ({
      coproprietes: [...etat.coproprietes, copro],
      mandats: [...etat.mandats, mandat],
    }))
    if (saisie.source) {
      const document = await repoDocuments.create({
        entiteType: 'mandat',
        entiteId: mandat.id,
        nom: saisie.source.nom,
        type: 'ordonnance',
        dateCreation: ordonnance,
      })
      set((etat) => ({
        documents: [...etat.documents, document],
      }))
    }
    return vue
  },
  updateCopropriete: async (id, saisie) => {
    const mandatExistant = get().mandats.find((mandat) => mandat.coproprieteId === id),
      copro = await repoCoproprietes.update(id, {
        nom: saisie.nom,
        adresse: saisie.adresse,
        nbLots: saisie.nbLots,
      }),
      mandat = mandatExistant
        ? await repoMandats.update(mandatExistant.id, {
            fondement: saisie.fondement,
            rg: saisie.rg,
          })
        : undefined
    set((etat) => ({
      coproprietes: etat.coproprietes.map((existante) => (existante.id === id ? copro : existante)),
      mandats: mandat ? etat.mandats.map((existant) => (existant.id === mandat.id ? mandat : existant)) : etat.mandats,
    }))
    return fusionnerCoproMandat(copro, mandat)
  },
  createPrestataire: async (saisie) => {
    const prestataire = await repoPrestataires.create(saisie)
    set((etat) => ({
      prestataires: [...etat.prestataires, prestataire],
    }))
    return prestataire
  },
  importerReleve: async (coproprieteId, lignes) => {
    let journal = get().journaux.find((existant) => existant.coproprieteId === coproprieteId)
    if (!journal) {
      const cree = await repoJournaux.create({
        coproprieteId,
      })
      journal = cree
      set((etat) => ({
        journaux: [...etat.journaux, cree],
      }))
    }
    const ecrituresBanque: Ecriture[] = [],
      ecrituresAVentiler: Ecriture[] = [],
      journalId = journal.id
    // Correctif d'un défaut hérité de la maquette : les écritures (et leur journal d'activité) sont enregistrées dans
    // une seule transaction. Une erreur en cours de boucle n'en laisse aucune en base, alors qu'auparavant les
    // premières y restaient, absentes de l'état et donc du dédoublonnage : un nouvel import les dupliquait.
    await ajDb.transaction('rw', [ajDb.ecritures, ajDb.activityLog], async () => {
      for (const ligne of lignes) {
        const [annee, mois, jour] = ligne.date.split('-').map(Number),
          ecriture = await repoEcritures.create({
            journalId,
            date: new Date(annee, mois - 1, jour),
            compte: '512',
            libelle: ligne.libelle,
            montant: Math.abs(ligne.montant),
            sens: ligne.montant >= 0 ? 'debit' : 'credit',
          })
        ecrituresBanque.push(ecriture)
        if (ligne.montant < 0)
          ecrituresAVentiler.push(
            await repoEcritures.create({
              journalId,
              date: new Date(annee, mois - 1, jour),
              compte: '471',
              libelle: `À ventiler · ${ligne.libelle} · relevé ${ecriture.id}`,
              montant: Math.abs(ligne.montant),
              sens: 'debit',
            }),
          )
      }
    })
    set((etat) => ({
      ecritures: [...etat.ecritures, ...ecrituresBanque, ...ecrituresAVentiler],
    }))
    return ecrituresBanque
  },
  imputerEncaissement: async (ecritureId, coproprietaireId, dateIso) => {
    const ecriture = get().ecritures.find((existante) => existante.id === ecritureId),
      coproprietaire = get().coproprietaires.find((existant) => existant.id === coproprietaireId)
    if (!ecriture || !coproprietaire || ecriture.compte !== '512' || ecriture.sens !== 'debit')
      throw new Error("Écriture ou copropriétaire introuvable, ou ligne qui n'est pas un encaissement.")
    const imputation = await repoEcritures.create({
        journalId: ecriture.journalId,
        date: ecriture.date,
        compte: `450-${coproprietaireId}`,
        libelle: `Encaissement ${coproprietaire.nom} · relevé ${ecritureId}`,
        montant: ecriture.montant,
        sens: 'credit',
      }),
      solde = Math.round((coproprietaire.solde + ecriture.montant) * 100) / 100,
      coproprietaireMisAJour = await repoCoproprietaires.update(coproprietaireId, {
        solde,
        statut: solde < 0 ? 'Impayé' : 'À jour',
      }),
      impayeOuvert = get().impayes.find(
        (impaye) => impaye.coproprietaireId === coproprietaireId && !impaye.statut.startsWith('solde'),
      )
    let impayeMisAJour: Impaye | null = null
    if (impayeOuvert) {
      const reste = Math.round((impayeOuvert.montant - ecriture.montant) * 100) / 100
      impayeMisAJour = await repoImpayes.update(
        impayeOuvert.id,
        reste <= 0
          ? {
              montant: 0,
              statut: ecrireStatutRecouvrement('solde', dateIso),
            }
          : {
              montant: reste,
            },
      )
    }
    set((etat) => ({
      ecritures: [...etat.ecritures, imputation],
      coproprietaires: etat.coproprietaires.map((existant) =>
        existant.id === coproprietaireId ? coproprietaireMisAJour : existant,
      ),
      impayes: impayeMisAJour
        ? etat.impayes.map((existant) => (existant.id === impayeMisAJour.id ? impayeMisAJour : existant))
        : etat.impayes,
    }))
  },
  avancerRecouvrement: async (coproprietaireId, etape, dateIso) => {
    const coproprietaire = get().coproprietaires.find((existant) => existant.id === coproprietaireId)
    if (!coproprietaire) throw new Error('Copropriétaire introuvable.')
    const impayeOuvert = get().impayes.find(
        (impaye) => impaye.coproprietaireId === coproprietaireId && !impaye.statut.startsWith('solde'),
      ),
      statut = ecrireStatutRecouvrement(etape, dateIso),
      impaye = impayeOuvert
        ? await repoImpayes.update(impayeOuvert.id, {
            statut,
            montant: etape === 'solde' ? 0 : Math.max(0, -coproprietaire.solde),
          })
        : await repoImpayes.create({
            coproprietaireId,
            montant: Math.max(0, -coproprietaire.solde),
            statut,
          })
    set((etat) => ({
      impayes: impayeOuvert
        ? etat.impayes.map((existant) => (existant.id === impaye.id ? impaye : existant))
        : [...etat.impayes, impaye],
    }))
    return impaye
  },
  importerCoproprietaires: (coproprieteId, lignes) =>
    enFileImportCoproprietaires(async () => {
      let crees = 0,
        misAJour = 0
      const lotsDeLaCopro = () => get().lots.filter((lot) => lot.coproprieteId === coproprieteId)
      for (const ligne of lignes) {
        let lot = lotsDeLaCopro().find(
          (existant) => existant.numero.trim().toLowerCase() === ligne.lot.trim().toLowerCase(),
        )
        if (!lot) {
          const cree = await repoLots.create({
            coproprieteId,
            numero: ligne.lot,
            tantiemes: ligne.tantiemes,
          })
          lot = cree
          set((etat) => ({
            lots: [...etat.lots, cree],
          }))
        } else if (
          lot.tantiemes.numerateur !== ligne.tantiemes.numerateur ||
          lot.tantiemes.denominateur !== ligne.tantiemes.denominateur
        ) {
          const modifie = await repoLots.update(lot.id, {
            tantiemes: ligne.tantiemes,
          })
          set((etat) => ({
            lots: etat.lots.map((existant) => (existant.id === modifie.id ? modifie : existant)),
          }))
          lot = modifie
        }
        const lotId = lot.id,
          existant = get().coproprietaires.find(
            (personne) =>
              personne.lotId === lotId && personne.nom.trim().toLowerCase() === ligne.nom.trim().toLowerCase(),
          ),
          statut = ligne.solde < 0 ? 'Impayé' : 'À jour'
        if (existant) {
          const modifie = await repoCoproprietaires.update(existant.id, {
            solde: ligne.solde,
            statut,
            tel: ligne.tel || existant.tel,
            mail: ligne.mail || existant.mail,
          })
          set((etat) => ({
            coproprietaires: etat.coproprietaires.map((personne) => (personne.id === modifie.id ? modifie : personne)),
          }))
          misAJour++
        } else {
          const cree = await repoCoproprietaires.create({
            lotId,
            nom: ligne.nom,
            tel: ligne.tel,
            mail: ligne.mail,
            solde: ligne.solde,
            statut,
          })
          set((etat) => ({
            coproprietaires: [...etat.coproprietaires, cree],
          }))
          crees++
        }
      }
      return {
        crees,
        misAJour,
      }
    }),
  basculerPieceReprise: async (coproprieteId, cle, libelle, dateIso) => {
    const dejaRecue = piecesRepriseRecues(get().documents, coproprieteId).has(cle),
      [annee, mois, jour] = dateIso.split('-').map(Number),
      document = await repoDocuments.create({
        entiteType: 'reprise',
        entiteId: coproprieteId,
        nom: dejaRecue ? `Retrait : ${libelle}` : libelle,
        type: dejaRecue ? `retrait:${cle}` : cle,
        dateCreation: new Date(annee, mois - 1, jour),
      })
    set((etat) => ({
      documents: [...etat.documents, document],
    }))
  },
  creerNote: async (coproprieteId, titre, description, dateIso) => {
    const [annee, mois, jour] = dateIso.split('-').map(Number),
      note = await repoNotifications.create({
        kind: 'note',
        titre,
        description,
        date: new Date(annee, mois - 1, jour),
        lu: false,
        coproprieteId,
      })
    set((etat) => ({
      notifications: [...etat.notifications, note],
    }))
    return note
  },
  updatePrestataire: async (id, patch) => {
    const prestataire = await repoPrestataires.update(id, patch)
    set((etat) => ({
      prestataires: etat.prestataires.map((existant) => (existant.id === id ? prestataire : existant)),
    }))
    return prestataire
  },
}))
