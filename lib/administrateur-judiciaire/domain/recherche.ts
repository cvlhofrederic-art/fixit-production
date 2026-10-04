import { dateIsoVersFr } from '@/lib/administrateur-judiciaire/domain/dates'
import { listerEcheancesPortefeuille, type CoproprieteMoteur } from '@/lib/administrateur-judiciaire/domain/echeances-mandat'
import { formatEuros, formatTantiemes, type Tantiemes } from '@/lib/administrateur-judiciaire/domain/format'
import { sansAccentsMinuscules } from '@/lib/administrateur-judiciaire/domain/texte'

/** Index de recherche globale (palette de commandes du shell, compréhension des demandes par Fixy). */

export type CleActePreRedige = 'convocation' | 'notification' | 'misedemeure' | 'requete' | 'etatfrais' | 'pv'

export interface ActePreRedige {
  cle: CleActePreRedige
  label: string
  icon: string
}

/** Actes pré-rédigés proposés par la recherche (mêmes clés que les actes express du cockpit). */
export const ACTES_PRE_REDIGES_RECHERCHE: ActePreRedige[] = [
  {
    cle: 'convocation',
    label: 'Convocation AG élective',
    icon: 'bank',
  },
  {
    cle: 'notification',
    label: "Notification d'ordonnance",
    icon: 'doc',
  },
  {
    cle: 'misedemeure',
    label: 'Mise en demeure (impayés)',
    icon: 'alert',
  },
  {
    cle: 'requete',
    label: 'Requête en prorogation',
    icon: 'scale',
  },
  {
    cle: 'etatfrais',
    label: 'État de frais & honoraires',
    icon: 'coin',
  },
  {
    cle: 'pv',
    label: "Procès-verbal d'AG",
    icon: 'pencil',
  },
]

export type TypeEntreeIndex = 'copro' | 'personne' | 'lot' | 'prestataire' | 'echeance' | 'acte'

export type RouteEntreeIndex = 'fiche360' | 'personne360' | 'prestataires' | 'dossierJud' | 'cockpit'

export interface SelectionEntreeIndex {
  code?: string
  coproprietaireId?: string
}

export interface EntreeIndexRecherche {
  /** « copro:CODE », « personne:id », « lot:id », « prestataire:id », « echeance:CODE:regleId », « acte:cle ». */
  id: string
  type: TypeEntreeIndex
  label: string
  sub: string
  icon: string
  route: RouteEntreeIndex
  selection?: SelectionEntreeIndex
}

/** Données lues pour construire l'index (vues copropriété et entités de la base locale). */
export interface DonneesIndexRecherche {
  copros: (CoproprieteMoteur & { id: string; nom: string; adresse: string; lots: number })[]
  coproprietaires: { id: string; lotId: string; nom: string; solde: number; statut: string }[]
  lots: { id: string; coproprieteId: string; numero: string; tantiemes?: Tantiemes | null }[]
  prestataires: { id: string; nom: string; metier: string; ville: string; statut: string }[]
}

/**
 * Index : copropriétés, copropriétaires, lots, prestataires, échéances légales du portefeuille et actes pré-rédigés,
 * dans cet ordre.
 */
export function construireIndexRecherche(donnees: DonneesIndexRecherche): EntreeIndexRecherche[] {
  const index: EntreeIndexRecherche[] = [],
    coprosParId = new Map(donnees.copros.map((copro) => [copro.id, copro])),
    lotsParId = new Map(donnees.lots.map((lot) => [lot.id, lot]))
  for (const copro of donnees.copros)
    index.push({
      id: `copro:${copro.code}`,
      type: 'copro',
      label: copro.nom,
      sub: `${copro.adresse} · ${copro.lots} lots · ${copro.fondement}`,
      icon: 'building',
      route: 'fiche360',
      selection: {
        code: copro.code,
      },
    })
  for (const personne of donnees.coproprietaires) {
    const lot = lotsParId.get(personne.lotId),
      copro = lot ? coprosParId.get(lot.coproprieteId) : undefined
    index.push({
      id: `personne:${personne.id}`,
      type: 'personne',
      label: personne.nom,
      sub: `${copro ? copro.nom : '·'} · ${lot ? lot.numero : '·'} · ${personne.solde < 0 ? `débiteur ${formatEuros(-personne.solde)}` : personne.statut}`,
      icon: 'users',
      route: 'personne360',
      selection: {
        coproprietaireId: personne.id,
        code: copro?.code,
      },
    })
  }
  for (const lot of donnees.lots) {
    const copro = coprosParId.get(lot.coproprieteId),
      occupant = donnees.coproprietaires.find((personne) => personne.lotId === lot.id)
    index.push({
      id: `lot:${lot.id}`,
      type: 'lot',
      label: `${lot.numero} · ${copro ? copro.nom : '·'}`,
      sub: `${formatTantiemes(lot.tantiemes)} tantièmes${occupant ? ` · ${occupant.nom}` : ''}`,
      icon: 'home',
      route: 'fiche360',
      selection: {
        code: copro?.code,
      },
    })
  }
  for (const prestataire of donnees.prestataires)
    index.push({
      id: `prestataire:${prestataire.id}`,
      type: 'prestataire',
      label: prestataire.nom,
      sub: `${prestataire.metier} · ${prestataire.ville} · ${prestataire.statut}`,
      icon: 'wrench',
      route: 'prestataires',
    })
  for (const { copro, echeance } of listerEcheancesPortefeuille(donnees.copros))
    index.push({
      id: `echeance:${copro.code}:${echeance.regleId}`,
      type: 'echeance',
      label: echeance.libelle,
      sub: `${copro.nom} · ${echeance.dateRetenue ? dateIsoVersFr(echeance.dateRetenue) : echeance.delaiLibelle} · ${echeance.fondements.join(' · ')}`,
      icon: 'clock',
      route: 'dossierJud',
      selection: {
        code: copro.code,
      },
    })
  for (const acte of ACTES_PRE_REDIGES_RECHERCHE)
    index.push({
      id: `acte:${acte.cle}`,
      type: 'acte',
      label: acte.label,
      sub: 'Acte pré-rédigé · cockpit',
      icon: acte.icon,
      route: 'cockpit',
    })
  return index
}

/**
 * Score d'une entrée pour une requête DÉJÀ normalisée (sansAccentsMinuscules) : libellé identique 1000, préfixe 800,
 * contenu 500, sous-titre 300, sous-séquence du libellé (3 caractères au moins) 100, sinon 0.
 */
export function scorerEntreeRecherche(entree: { label: string; sub: string }, requete: string): number {
  const libelle = sansAccentsMinuscules(entree.label),
    sousTitre = sansAccentsMinuscules(entree.sub)
  if (libelle === requete) return 1e3
  if (libelle.startsWith(requete)) return 800
  if (libelle.includes(requete)) return 500
  if (sousTitre.includes(requete)) return 300
  let i = 0,
    trouves = 0
  for (; i < libelle.length && trouves < requete.length; ) {
    if (libelle[i] === requete[trouves]) trouves++
    i++
  }
  return trouves === requete.length && requete.length >= 3 ? 100 : 0
}

/** Rang des types à score égal. */
export const ORDRE_TYPES_RECHERCHE: Record<TypeEntreeIndex, number> = {
  copro: 0,
  personne: 1,
  lot: 2,
  prestataire: 3,
  echeance: 4,
  acte: 5,
}

/** Entrée retenue, avec son score technique `_s`. */
export type ResultatRecherche<E extends EntreeIndexRecherche = EntreeIndexRecherche> = E & { _s: number }

/** Les `limite` meilleures entrées (score, puis type, puis libellé en ordre français) ; requête vide → []. */
export function rechercherDansIndex<E extends EntreeIndexRecherche>(
  index: E[],
  requete: string,
  limite = 10,
): ResultatRecherche<E>[] {
  const requeteNormalisee = sansAccentsMinuscules(requete.trim())
  return requeteNormalisee
    ? index
        .map((entree) => ({
          ...entree,
          _s: scorerEntreeRecherche(entree, requeteNormalisee),
        }))
        .filter((entree) => entree._s > 0)
        .sort(
          (a, b) =>
            b._s - a._s ||
            ORDRE_TYPES_RECHERCHE[a.type] - ORDRE_TYPES_RECHERCHE[b.type] ||
            a.label.localeCompare(b.label, 'fr'),
        )
        .slice(0, limite)
    : []
}
