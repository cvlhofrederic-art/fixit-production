import { dateIsoVersFr, ecartJours } from '@/lib/administrateur-judiciaire/domain/dates'
import { calculerEtatEcheance } from '@/lib/administrateur-judiciaire/domain/delais-legaux'
import type { Fiche360Copropriete } from '@/lib/administrateur-judiciaire/domain/fiche-360'
import type { ActionFixy, AgentFixy } from '@/lib/administrateur-judiciaire/domain/fixy/agents'
import { formatEurosCourrielFixy } from '@/lib/administrateur-judiciaire/domain/format'
import { analyserRecouvrement } from '@/lib/administrateur-judiciaire/domain/recouvrement'

/**
 * Veille de Fixy : rappels calculés sur tout le portefeuille (notification de l'ordonnance, échéances légales proches
 * ou échues, débiteurs sans dossier ou à faire avancer, pièces de reprise attendues de l'ancien syndic).
 */

/** Gravité d'un rappel, qui est aussi la couleur de son étiquette. */
export type GraviteVeille = 'rust' | 'amber' | 'navy'

export interface RappelVeille {
  id: string
  agent: AgentFixy
  gravite: GraviteVeille
  texte: string
  action: ActionFixy
}

/** Dossier de recouvrement lu par Fixy (statut « étape:AAAA-MM-JJ », voir domain/recouvrement). */
export interface DossierImpayeFixy {
  coproprietaireId: string
  statut: string
}

/** Pièce de reprise enregistrée pour une copropriété. */
export interface PieceRecueVeille {
  coproprieteId: string
  type: string
}

export interface EntreeVeilleFixy {
  /** Date de référence ISO (aujourd'hui). */
  reference: string
  fiches: Fiche360Copropriete[]
  impayes: DossierImpayeFixy[]
  piecesRecues: PieceRecueVeille[]
  /** Nombre de pièces de reprise attendues par copropriété. */
  nbPieces: number
}

/** Rang de tri des gravités (tri stable : l'ordre de calcul est conservé à gravité égale). */
const RANG_GRAVITE: Record<GraviteVeille, number> = {
  rust: 0,
  amber: 1,
  navy: 2,
}

/** Rappels de la veille, du plus grave au moins grave. */
export function calculerVeilleFixy(entree: EntreeVeilleFixy): RappelVeille[] {
  const rappels: RappelVeille[] = []
  for (const fiche of entree.fiches) {
    const code = fiche.vue.code,
      notification = fiche.echeances.echeances.find(
        (echeance) =>
          echeance.regleId === 'notification-ordonnance-46-47' || echeance.regleId === 'information-coproprietaires-ap291',
      )
    if (notification && !notification.accomplie && notification.dateRetenue) {
      const jours = ecartJours(entree.reference, notification.dateRetenue)
      rappels.push({
        id: `notif:${code}`,
        agent: 'Alfredo',
        gravite: jours < 0 ? 'rust' : jours <= 15 ? 'amber' : 'navy',
        texte: `${fiche.vue.nom} : la notification de l'ordonnance n'est pas enregistrée comme faite (${jours < 0 ? `délai échu depuis ${-jours} j` : `à faire avant le ${dateIsoVersFr(notification.dateRetenue)}`}). Tu veux la préparer ?`,
        action: {
          id: `acte:notification:${code}`,
          label: 'Préparer la notification',
          effet: 'Ouvre le cockpit sur le modèle de notification.',
          type: 'ouvrirActe',
          params: {
            cle: 'notification',
            code,
          },
          ecrit: false,
        },
      })
    }
    for (const echeance of fiche.echeances.echeances) {
      if (
        echeance.accomplie ||
        !echeance.dateRetenue ||
        echeance.regleId === notification?.regleId ||
        (echeance.nature !== 'obligation' && echeance.nature !== 'repere')
      )
        continue
      const etat = calculerEtatEcheance(echeance, entree.reference)
      if (etat === 'depassee' || etat === 'aujourdhui' || etat === 'imminente') {
        const jours = ecartJours(entree.reference, echeance.dateRetenue)
        rappels.push({
          id: `ech:${code}:${echeance.regleId}`,
          agent: 'Tempo',
          gravite: jours <= 0 ? 'rust' : 'amber',
          texte: `${fiche.vue.nom} : ${echeance.libelle} (${echeance.fondements.join(', ')}) ${jours < 0 ? `échue depuis ${-jours} j` : jours === 0 ? "aujourd'hui" : `dans ${jours} j`}.`,
          action: {
            id: `nav:dossierJud:${code}`,
            label: 'Voir le dossier',
            effet: 'Ouvre le dossier juridictionnel.',
            type: 'naviguer',
            params: {
              route: 'dossierJud',
              code,
            },
            ecrit: false,
          },
        })
      }
    }
    for (const debiteur of fiche.debiteurs) {
      const dossier = entree.impayes.find(
        (impaye) => impaye.coproprietaireId === debiteur.id && !impaye.statut.startsWith('solde'),
      )
      if (!dossier) {
        rappels.push({
          id: `deb:${debiteur.id}`,
          agent: 'Léa',
          gravite: 'amber',
          texte: `${fiche.vue.nom} · ${debiteur.nom} doit ${formatEurosCourrielFixy(-debiteur.solde)} et n'a aucun dossier de recouvrement. Tu veux le relancer ?`,
          action: {
            id: `rec:${debiteur.id}:mise_en_demeure`,
            label: 'Ouvrir le dossier en mise en demeure',
            effet: `Enregistre l'étape « Mise en demeure » (L. 1965 art. 19-2) au ${dateIsoVersFr(entree.reference)}.`,
            type: 'avancerRecouvrement',
            params: {
              coproprietaireId: debiteur.id,
              etape: 'mise_en_demeure',
            },
            ecrit: true,
          },
        })
        continue
      }
      const analyse = analyserRecouvrement(dossier.statut, entree.reference)
      // exigibiliteLe n'existe que si la date de mise en demeure (depuis) est lisible.
      if (
        analyse.etape === 'mise_en_demeure' &&
        analyse.depuis &&
        analyse.exigibiliteLe &&
        analyse.exigibiliteLe <= entree.reference
      )
        rappels.push({
          id: `exig:${debiteur.id}`,
          agent: 'Léa',
          gravite: 'rust',
          texte: `${fiche.vue.nom} · ${debiteur.nom} : trente jours écoulés depuis la mise en demeure du ${dateIsoVersFr(analyse.depuis)}, sans paiement enregistré. Constater l'exigibilité anticipée ?`,
          action: {
            id: `rec:${debiteur.id}:exigibilite`,
            label: "Constater l'exigibilité",
            effet: "Enregistre l'étape « Exigibilité anticipée » (L. 1965 art. 19-2).",
            type: 'avancerRecouvrement',
            params: {
              coproprietaireId: debiteur.id,
              etape: 'exigibilite',
            },
            ecrit: true,
          },
        })
      else if (analyse.etape === 'exigibilite')
        rappels.push({
          id: `proc:${debiteur.id}`,
          agent: 'Léa',
          gravite: 'amber',
          texte: `${fiche.vue.nom} · ${debiteur.nom} : exigibilité anticipée constatée, l'action en justice est l'étape suivante.`,
          action: {
            id: `rec:${debiteur.id}:procedure`,
            label: "Passer à l'action en justice",
            effet: "Enregistre l'étape « Action en justice ».",
            type: 'avancerRecouvrement',
            params: {
              coproprietaireId: debiteur.id,
              etape: 'procedure',
            },
            ecrit: true,
          },
        })
    }
    const recues = entree.piecesRecues.filter((piece) => piece.coproprieteId === fiche.vue.id).length,
      tresorerie = fiche.echeances.echeances.find((echeance) => echeance.regleId === 'ancien-syndic-tresorerie')
    if (
      recues < entree.nbPieces &&
      tresorerie &&
      tresorerie.dateRetenue &&
      tresorerie.dateRetenue < entree.reference &&
      !tresorerie.accomplie
    ) {
      const attendues = entree.nbPieces - recues
      rappels.push({
        id: `piece:${code}`,
        agent: 'Fixy',
        gravite: 'amber',
        texte: `${fiche.vue.nom} : ${attendues} pièce${attendues > 1 ? 's' : ''} de reprise encore attendue${attendues > 1 ? 's' : ''} de l'ancien syndic, délai de l'art. 18-2 dépassé. Mise en demeure de l'ancien syndic ?`,
        action: {
          id: `nav:reprise:${code}`,
          label: 'Voir la reprise',
          effet: "Ouvre l'écran Reprise judiciaire.",
          type: 'naviguer',
          params: {
            route: 'reprise',
            code,
          },
          ecrit: false,
        },
      })
    }
  }
  return rappels.sort((a, b) => RANG_GRAVITE[a.gravite] - RANG_GRAVITE[b.gravite])
}
