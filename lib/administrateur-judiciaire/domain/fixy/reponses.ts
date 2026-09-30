import { dateIsoVersFr, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { REGLES_DELAIS_LEGAUX, type EcheanceCalculee } from '@/lib/administrateur-judiciaire/domain/delais-legaux'
import type { Fiche360Copropriete, Fiche360Personne } from '@/lib/administrateur-judiciaire/domain/fiche-360'
import type {
  ActionAvancerRecouvrementFixy,
  ActionFixy,
  ActionNaviguerFixy,
  AgentFixy,
} from '@/lib/administrateur-judiciaire/domain/fixy/agents'
import { MOTIFS_ECRAN_NAVIGATION, type IntentionFixy } from '@/lib/administrateur-judiciaire/domain/fixy/intentions'
import type { DossierImpayeFixy } from '@/lib/administrateur-judiciaire/domain/fixy/veille'
import { citerFondement } from '@/lib/administrateur-judiciaire/domain/fondements'
import { formatEurosReponseFixy } from '@/lib/administrateur-judiciaire/domain/format'
import {
  analyserRecouvrement,
  ETAPES_RECOUVREMENT,
  PARCOURS_RECOUVREMENT_DEBITEUR,
  type DefinitionEtapeRecouvrement,
} from '@/lib/administrateur-judiciaire/domain/recouvrement'
import { normaliserTexteLibre } from '@/lib/administrateur-judiciaire/domain/texte'

/**
 * Réponses de Fixy aux intentions reconnues (comprendreDemandeFixy), construites avec les données de la base locale
 * et le moteur de délais légaux. Aucune action n'est exécutée ici : les réponses proposent des actions.
 */

export interface ReponseFixy {
  agent: AgentFixy
  titre: string
  source: string
  lignes: string[]
  actions: ActionFixy[]
}

/** Ordre de service lu par Fixy (données de démonstration du module Interventions). */
export interface OrdreDeServiceFixy {
  id: string
  copro: string
  objet: string
  frac: string
  presta: string
  date: string
  statut: string
  urg: string
}

/** Données sur lesquelles Fixy répond (assemblées par useFixy). */
export interface DonneesFixy {
  /** Date de référence ISO (aujourd'hui). */
  reference: string
  ficheCopro: (code: string) => Fiche360Copropriete | null
  fichePersonne: (coproprietaireId: string) => Fiche360Personne | null
  copros: { code: string; nom: string }[]
  ordresDeService: OrdreDeServiceFixy[]
  impayes: DossierImpayeFixy[]
}

/**
 * Action « ouvrir un écran ». Les paramètres `code` et `coproprietaireId` ne sont présents que s'ils sont renseignés ;
 * l'identifiant reprend le premier des deux (« nav:route:code »).
 */
export const actionNavigationFixy = (
  route: string,
  libelle: string,
  code?: string,
  coproprietaireId?: string,
): ActionNaviguerFixy => ({
  id: `nav:${route}:${code || coproprietaireId || ''}`,
  label: libelle,
  effet: `Ouvre l'écran ${libelle}.`,
  type: 'naviguer',
  params: {
    route,
    ...(code
      ? {
          code,
        }
      : {}),
    ...(coproprietaireId
      ? {
          coproprietaireId,
        }
      : {}),
  },
  ecrit: false,
})

/** Réponse « aide » (reprise, avec un autre titre, pour une demande non comprise). */
export const REPONSE_AIDE_FIXY: ReponseFixy = {
  agent: 'Fixy',
  titre: 'Ce que je sais faire',
  source: 'Fixy',
  lignes: [
    "Infos : « solde de Garnier », « état des comptes des Tilleuls », « échéances de Villa Montaigne », « qui doit de l'argent ».",
    'Interventions : « intervention au Clos des Vignes », « fuite 4e étage ».',
    "Juridique (Max) : « article 19-2 », « délai de notification de l'ordonnance ».",
    'Actes (Alfredo) : « prépare une mise en demeure pour Benali », « génère la convocation des Tilleuls ».',
    'Actions, toujours après ton OK : « passe Benali en mise en demeure », « ouvre la fiche de Garnier ».',
    'Je réponds avec les données enregistrées ; ce que la base ne sait pas, je le dis.',
  ],
  actions: [],
}

// ─── Branches de repondreDemandeFixy (dans l'ordre des tests) ─────────────────────────────────────────

function repondreNavigation(intention: IntentionFixy): ReponseFixy {
  const cible = intention.cible,
    route = intention.detail || 'fiche360',
    libelle =
      MOTIFS_ECRAN_NAVIGATION.find(([, routeMotif]) => routeMotif === route)?.[2] ||
      (route === 'personne360' ? 'Fiche 360 personne' : route === 'prestataires' ? 'Prestataires' : route)
  return {
    agent: 'Fixy',
    titre: `J'ouvre ${libelle}${cible ? ` pour ${cible.label}` : ''}`,
    lignes: [],
    source: 'Fixy',
    actions: [actionNavigationFixy(route, libelle, cible?.selection?.code, cible?.selection?.coproprietaireId)],
  }
}

function repondrePersonne(intention: IntentionFixy, donnees: DonneesFixy): ReponseFixy {
  const reference = donnees.reference,
    coproprietaireId = intention.cible?.selection?.coproprietaireId,
    fiche = coproprietaireId ? donnees.fichePersonne(coproprietaireId) : null
  if (!fiche)
    return {
      agent: 'Léa',
      titre: 'Personne introuvable',
      lignes: ['Aucun copropriétaire de ce nom dans la base.'],
      actions: [],
      source: 'base locale',
    }
  const dossier = donnees.impayes.find(
      (impaye) => impaye.coproprietaireId === fiche.personne.id && !impaye.statut.startsWith('solde'),
    ),
    recouvrement = dossier ? analyserRecouvrement(dossier.statut, reference) : null,
    lignes = [
      `${fiche.copro ? fiche.copro.nom : 'copropriété inconnue'} · ${fiche.lot ? fiche.lot.numero : 'lot inconnu'} · ${fiche.tantiemes} tantièmes${fiche.quotePart != null ? ` (${(fiche.quotePart * 100).toFixed(2)} %)` : ''}.`,
      `Solde : ${formatEurosReponseFixy(fiche.personne.solde)} · ${fiche.personne.statut}.`,
      `Contact : ${fiche.personne.tel || 'téléphone inconnu'} · ${fiche.personne.mail || 'courriel inconnu'}.`,
      recouvrement
        ? `Recouvrement : ${recouvrement.libelle} (${recouvrement.base})${recouvrement.depuis ? ` depuis le ${dateIsoVersFr(recouvrement.depuis)}` : ''}${recouvrement.exigibiliteLe ? ` · exigibilité anticipée le ${dateIsoVersFr(recouvrement.exigibiliteLe)}` : ''}.`
        : fiche.debiteur
          ? 'Recouvrement : aucun dossier ouvert.'
          : 'Aucun impayé.',
      fiche.homonymes.length
        ? `${fiche.homonymes.length} homonyme${fiche.homonymes.length > 1 ? 's' : ''} ailleurs dans le portefeuille (rapprochement par le nom).`
        : '',
      'Présences en AG, pouvoirs, situation particulière : non enregistrés dans la base.',
    ].filter(Boolean),
    actions: ActionFixy[] = [
      actionNavigationFixy('personne360', 'Fiche 360 personne', fiche.copro?.code, fiche.personne.id),
    ]
  if (fiche.debiteur) {
    const etape = recouvrement?.prochaine ?? 'mise_en_demeure',
      // Toujours trouvée : `etape` est une étape connue.
      definition = ETAPES_RECOUVREMENT.find((candidate) => candidate.etape === etape) as DefinitionEtapeRecouvrement
    actions.push({
      id: `rec:${fiche.personne.id}:${etape}`,
      label: `Passer en « ${definition.libelle} »`,
      effet: `Enregistre l'étape « ${definition.libelle} » (${definition.base}) au ${dateIsoVersFr(reference)} dans le dossier de recouvrement de ${fiche.personne.nom}.`,
      type: 'avancerRecouvrement',
      params: {
        coproprietaireId: fiche.personne.id,
        etape,
      },
      ecrit: true,
    })
    if (etape === 'mise_en_demeure')
      actions.push({
        id: `acte:misedemeure:${fiche.copro?.code || ''}`,
        label: 'Rédiger la mise en demeure',
        effet: 'Ouvre le cockpit sur le modèle de mise en demeure (art. 19-2), pré-rempli pour la copropriété.',
        type: 'ouvrirActe',
        params: {
          cle: 'misedemeure',
          code: fiche.copro?.code || '',
        },
        ecrit: false,
      })
  }
  return {
    agent: 'Léa',
    titre: fiche.personne.nom,
    lignes,
    actions,
    source: 'base locale',
  }
}

function repondreAction(intention: IntentionFixy, donnees: DonneesFixy): ReponseFixy {
  const coproprietaireId = intention.cible?.selection?.coproprietaireId,
    fiche = coproprietaireId ? donnees.fichePersonne(coproprietaireId) : null
  if (!fiche)
    return {
      agent: 'Fixy',
      titre: 'Personne introuvable',
      lignes: ['Je ne sais pas de qui tu parles.'],
      actions: [],
      source: 'Fixy',
    }
  const etapeDemandee = intention.detail || 'mise_en_demeure',
    // Une intention « action » porte une étape connue (MOTIFS_ETAPE_RECOUVREMENT). Sinon, comme dans la maquette,
    // la lecture de `definition.libelle` ci-dessous lève une TypeError.
    definition = ETAPES_RECOUVREMENT.find((candidate) => candidate.etape === etapeDemandee) as DefinitionEtapeRecouvrement,
    confirmation: ActionAvancerRecouvrementFixy = {
      id: `rec:${fiche.personne.id}:${etapeDemandee}`,
      label: `Confirmer « ${definition.libelle} »`,
      effet: `Enregistre l'étape « ${definition.libelle} » (${definition.base}) au ${dateIsoVersFr(donnees.reference)}.`,
      type: 'avancerRecouvrement',
      params: {
        coproprietaireId: fiche.personne.id,
        etape: definition.etape,
      },
      ecrit: true,
    }
  return {
    agent: 'Léa',
    titre: `${definition.libelle} pour ${fiche.personne.nom} : à confirmer`,
    lignes: [
      `Solde actuel ${formatEurosReponseFixy(fiche.personne.solde)}.`,
      definition.conseil,
      "Rien n'est enregistré tant que tu ne confirmes pas.",
    ],
    source: 'base locale',
    actions: [confirmation],
  }
}

function repondreRapport(intention: IntentionFixy): ReponseFixy {
  const code = intention.cible?.selection?.code || ''
  return {
    agent: 'Alfredo',
    titre: `Je rédige le rapport pour ${intention.cible?.label || 'la copropriété sélectionnée'}`,
    lignes: [
      "Le Dossier du juge s'ouvre : clique « Analyser la situation et rédiger », Fixy lit le dossier, choisit le document et les demandes, écrit le texte complet, à relire avant envoi.",
    ],
    source: 'rédacteur',
    actions: [actionNavigationFixy('dossierJuge', 'Dossier du juge', code)],
  }
}

function repondreActe(intention: IntentionFixy): ReponseFixy {
  const code = intention.cible?.selection?.code || '',
    nomCopro = intention.cible?.label || 'la copropriété sélectionnée',
    cle = intention.detail || 'notification'
  return {
    agent: 'Alfredo',
    titre: `Je prépare l'acte pour ${nomCopro}`,
    lignes: ["Le modèle s'ouvre dans le cockpit, pré-rempli avec les données du mandat. Rien n'est envoyé."],
    source: 'modèles du cockpit',
    actions: [
      {
        id: `acte:${cle}:${code}`,
        label: 'Ouvrir le modèle',
        effet: 'Ouvre le cockpit sur le modèle demandé.',
        type: 'ouvrirActe',
        params: {
          cle,
          code,
        },
        ecrit: false,
      },
    ],
  }
}

function repondreJuridique(intention: IntentionFixy): ReponseFixy {
  const texte = normaliserTexteLibre(intention.detail || intention.texte),
    // « 19 2 » (texte normalisé) redevient « 19-2 ».
    articles = Array.from(texte.matchAll(/(\d{1,3}(?:[ -]\d{1,2})?)/g)).map((trouve) => trouve[1].replace(' ', '-')),
    regles = REGLES_DELAIS_LEGAUX.filter(
      (regle) =>
        regle.fondements.some((fondement) =>
          articles.some((article) => fondement.article.replace(' ', '').startsWith(article)),
        ) ||
        texte
          .split(' ')
          .filter((mot) => mot.length > 4)
          .some((mot) => normaliserTexteLibre(regle.libelle).includes(mot)),
    ).slice(0, 5),
    etapes = PARCOURS_RECOUVREMENT_DEBITEUR.filter((etape) => articles.some((article) => etape.base.includes(article))),
    lignes = [
      ...regles.map(
        (regle) =>
          `${regle.libelle} · ${regle.fondements.map(citerFondement).join(', ')} · ${regle.delai ? `${regle.delai.valeur} ${regle.delai.unite}` : "délai fixé par l'ordonnance"} · certitude ${regle.certitude}. ${regle.note}`,
      ),
      ...etapes.map((etape) => `${etape.etape} · ${etape.base} · ${etape.note}`),
    ]
  return {
    agent: 'Max',
    titre: regles.length + etapes.length ? 'Ce que disent les textes (moteur de délais)' : 'Aucune règle du moteur ne correspond',
    lignes: lignes.length
      ? lignes
      : [
          "Le moteur couvre les délais des mandats (art. 46, 47, 29-1), l'art. 18-2 et le recouvrement (art. 19-2, 19-1, 20, 42). Reformule avec un numéro d'article ou un mot du libellé.",
        ],
    actions: [],
    source: 'moteur de délais légaux, textes vérifiés le 18/09/2026',
  }
}

/** Dernier mot du libellé de la copropriété citée, rapproché du nom de copropriété des ordres de service. */
const concerneCopro = (ordre: OrdreDeServiceFixy, intention: IntentionFixy): boolean =>
  !intention.cible ||
  normaliserTexteLibre(ordre.copro).includes(normaliserTexteLibre(intention.cible.label).split(' ').pop() || '')

function repondreInterventions(intention: IntentionFixy, donnees: DonneesFixy): ReponseFixy {
  const texte = normaliserTexteLibre(intention.detail || ''),
    correspondants = donnees.ordresDeService.filter(
      (ordre) =>
        concerneCopro(ordre, intention) &&
        (texte
          .split(' ')
          .some((mot) => mot.length > 3 && normaliserTexteLibre(`${ordre.objet} ${ordre.frac}`).includes(mot)) ||
          !texte.split(' ').some((mot) => mot.length > 3 && !/intervention|ordre|service|travaux/.test(mot))),
    ),
    lignes = (
      correspondants.length ? correspondants : donnees.ordresDeService.filter((ordre) => concerneCopro(ordre, intention))
    )
      .slice(0, 6)
      .map(
        (ordre) =>
          `${ordre.id} · ${ordre.copro} · ${ordre.objet} · ${ordre.frac} · ${ordre.presta} · ${ordre.date} · ${ordre.statut} (${ordre.urg}).`,
      )
  return {
    agent: 'Fixy',
    titre: `Interventions${intention.cible ? ` · ${intention.cible.label}` : ''}`,
    lignes: lignes.length ? lignes : ['Aucune intervention enregistrée.'],
    actions: [actionNavigationFixy('interventions', 'Interventions', intention.cible?.selection?.code)],
    source: 'ordres de service de démonstration (module Interventions non encore branché sur la base)',
  }
}

function repondreDebiteurs(fiches: Fiche360Copropriete[], donnees: DonneesFixy): ReponseFixy {
  const lignes = fiches.flatMap((fiche) =>
      fiche.debiteurs.map((debiteur) => {
        const dossier = donnees.impayes.find(
          (impaye) => impaye.coproprietaireId === debiteur.id && !impaye.statut.startsWith('solde'),
        )
        return `${fiche.vue.nom} · ${debiteur.nom} · ${debiteur.lot} · ${formatEurosReponseFixy(debiteur.solde)}${dossier ? ` · ${analyserRecouvrement(dossier.statut, donnees.reference).libelle}` : ' · aucun dossier'}.`
      }),
    ),
    totalDebiteur = fiches.reduce((total, fiche) => total + fiche.totalDebiteur, 0)
  return {
    agent: 'Léa',
    titre: `${lignes.length} débiteur${lignes.length > 1 ? 's' : ''} · ${formatEurosReponseFixy(-totalDebiteur)} dus`,
    lignes: lignes.length ? lignes : ['Aucun débiteur enregistré.'],
    actions: [
      actionNavigationFixy('tresorerie', 'Banque et recouvrement', fiches.length === 1 ? fiches[0].vue.code : undefined),
    ],
    source: 'base locale',
  }
}

/** Échéance non accomplie et datée. */
type EcheanceDatee = EcheanceCalculee & { dateRetenue: string }

function repondreEcheances(fiches: Fiche360Copropriete[], reference: string): ReponseFixy {
  const lignes = fiches.flatMap((fiche) =>
    fiche.echeances.echeances
      .filter(
        (echeance): echeance is EcheanceDatee =>
          !echeance.accomplie &&
          !!echeance.dateRetenue &&
          (echeance.nature === 'obligation' || echeance.nature === 'repere' || echeance.nature === 'obligation_tiers'),
      )
      .slice(0, 6)
      .map(
        (echeance) =>
          `${fiche.vue.nom} · ${dateIsoVersFr(echeance.dateRetenue)} · ${echeance.libelle} (${echeance.fondements.join(', ')})${echeance.dateRetenue < reference ? ' · échue' : ''}.`,
      ),
  )
  return {
    agent: 'Tempo',
    titre: `Échéances légales au ${dateIsoVersFr(reference)}`,
    lignes: lignes.length ? lignes : ['Aucune échéance datée en cours.'],
    actions: [
      actionNavigationFixy(
        fiches.length === 1 ? 'dossierJud' : 'cockpit',
        fiches.length === 1 ? 'Dossier juridictionnel' : "Aujourd'hui",
        fiches.length === 1 ? fiches[0].vue.code : undefined,
      ),
    ],
    source: 'moteur de délais légaux',
  }
}

/**
 * Date de l'ordonnance « JJ/MM/AAAA » lue, comme dans la maquette, via toISOString() (UTC) : une Date à minuit,
 * heure de Paris, s'affiche à la VEILLE. Toute valeur qui n'est pas une Date valide (dans le calendrier ISO) donne
 * « · », comme une ordonnance absente. C'est le cas d'une vue sans mandat, qui porte une chaîne (createdAt) :
 * écart volontaire avec la maquette, qui levait alors une TypeError (toISOString absent) et laissait la demande
 * à Fixy sans réponse.
 */
function ordonnanceParToIsoString(ordonnance: Date | string): string {
  if (!(ordonnance instanceof Date) || Number.isNaN(ordonnance.getTime())) return '·'
  const iso = ordonnance.toISOString().slice(0, 10)
  return estDateIsoValide(iso) ? dateIsoVersFr(iso) : '·'
}

/** Échéances obligatoires ou repères échues (non accomplies, datées avant la référence). */
const compterEcheancesEchues = (fiche: Fiche360Copropriete, reference: string): number =>
  fiche.echeances.echeances.filter(
    (echeance) =>
      !echeance.accomplie &&
      echeance.dateRetenue &&
      echeance.dateRetenue < reference &&
      (echeance.nature === 'obligation' || echeance.nature === 'repere'),
  ).length

function repondreCoproOuComptes(intention: IntentionFixy, fiche: Fiche360Copropriete, reference: string): ReponseFixy {
  const vue = fiche.vue,
    comptes = intention.type === 'comptes'
  let lignes: string[]
  if (comptes)
    lignes = [
      `Budget ${formatEurosReponseFixy(vue.budget)} · charges engagées ${formatEurosReponseFixy(vue.depense)} · impayés ${formatEurosReponseFixy(vue.impayes)}${fiche.tauxImpayes != null ? ` (${Math.round(fiche.tauxImpayes * 100)} % du budget, seuil ad hoc ${Math.round(fiche.seuilAdHoc * 100)} %)` : ''} · fonds de travaux ${formatEurosReponseFixy(vue.fondsTravaux)}.`,
      `${fiche.personnes.length} copropriétaire${fiche.personnes.length > 1 ? 's' : ''} enregistré${fiche.personnes.length > 1 ? 's' : ''}, ${fiche.debiteurs.length} débiteur${fiche.debiteurs.length > 1 ? 's' : ''} pour ${formatEurosReponseFixy(-fiche.totalDebiteur)}.`,
      'Relevés bancaires, appels de fonds et rapprochements : voir Banque et recouvrement ; comptes annuels : non alimentés dans la base.',
    ]
  else {
    const echues = compterEcheancesEchues(fiche, reference)
    lignes = [
      `${vue.adresse} · ${vue.lots} lots · ${vue.fondement} · ${vue.tribunal || 'tribunal non renseigné'}${vue.rg ? ` · RG ${vue.rg}` : ''}.`,
      `Ordonnance du ${ordonnanceParToIsoString(vue.ordonnance)} · ${vue.dureeMois || '·'} mois · notification ${vue.notifOrdonnance || 'non renseignée'} · statut ${vue.statut}.`,
      `Impayés ${formatEurosReponseFixy(vue.impayes)}${fiche.tauxImpayes != null ? ` (${Math.round(fiche.tauxImpayes * 100)} % du budget)` : ''} · ${fiche.debiteurs.length} débiteur${fiche.debiteurs.length > 1 ? 's' : ''} · ${echues} échéance${echues > 1 ? 's' : ''} échue${echues > 1 ? 's' : ''}.`,
    ]
  }
  return {
    agent: comptes ? 'Léa' : 'Fixy',
    titre: comptes ? `État des comptes · ${vue.nom}` : vue.nom,
    lignes,
    actions: [
      actionNavigationFixy(
        comptes ? 'tresorerie' : 'fiche360',
        comptes ? 'Banque et recouvrement' : 'Fiche 360 copropriété',
        vue.code,
      ),
      actionNavigationFixy('dossierJuge', 'Dossier du juge', vue.code),
    ],
    source: 'base locale et moteur de délais',
  }
}

/**
 * Réponse de Fixy à une intention. Ordre des branches : aide / inconnu, navigation, personne (ou échéances d'une
 * personne), action (étape de recouvrement à confirmer), acte « rapport » (Dossier du juge), acte, juridique ; puis,
 * sur la copropriété citée ou tout le portefeuille : interventions, débiteurs, échéances, comptes ou fiche copropriété.
 */
export function repondreDemandeFixy(intention: IntentionFixy, donnees: DonneesFixy): ReponseFixy {
  const reference = donnees.reference
  if (intention.type === 'aide' || intention.type === 'inconnu')
    return intention.type === 'inconnu'
      ? {
          ...REPONSE_AIDE_FIXY,
          titre: `Je n'ai pas compris « ${intention.texte} »`,
          lignes: ['Nomme une copropriété, une personne ou un sujet. Exemples :', ...REPONSE_AIDE_FIXY.lignes],
        }
      : REPONSE_AIDE_FIXY
  if (intention.type === 'navigation') return repondreNavigation(intention)
  if (intention.type === 'personne' || (intention.type === 'echeances' && intention.cible?.type === 'personne'))
    return repondrePersonne(intention, donnees)
  if (intention.type === 'action') return repondreAction(intention, donnees)
  if (intention.type === 'acte' && intention.detail === 'rapport') return repondreRapport(intention)
  if (intention.type === 'acte') return repondreActe(intention)
  if (intention.type === 'juridique') return repondreJuridique(intention)
  const codeCible = intention.cible?.selection?.code,
    fiches = (codeCible ? [codeCible] : donnees.copros.map((copro) => copro.code))
      .map((code) => donnees.ficheCopro(code))
      .filter((fiche): fiche is Fiche360Copropriete => !!fiche)
  if (fiches.length === 0)
    return {
      agent: 'Fixy',
      titre: 'Copropriété introuvable',
      lignes: ['Aucune copropriété de ce nom dans la base.'],
      actions: [],
      source: 'base locale',
    }
  if (intention.type === 'intervention') return repondreInterventions(intention, donnees)
  if (intention.type === 'debiteurs') return repondreDebiteurs(fiches, donnees)
  if (intention.type === 'echeances') return repondreEcheances(fiches, reference)
  return repondreCoproOuComptes(intention, fiches[0], reference)
}
