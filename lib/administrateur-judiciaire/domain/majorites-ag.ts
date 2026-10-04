/**
 * Calcul des majorités d'assemblée générale (L. 1965 art. 24, 25, 25-1, 26, 26-1 et unanimité).
 * Les textes « detail » sont ceux de la maquette, au caractère près.
 */

export type TypeMajorite = 'art24' | 'art25' | 'art26' | 'unanimite'

/** Résultat d'un vote : voix en tantièmes, membres en nombre de copropriétaires. */
export interface VoteAssemblee {
  voixTotales: number
  membresTotaux: number
  pour: number
  contre: number
  abstention: number
  /** Nombre de copropriétaires ayant voté pour (double majorité de l'art. 26). */
  membresPour?: number | null
}

export interface PasserelleMajorite {
  article: 'art25-1' | 'art26-1'
  possible: boolean
  detail: string
}

export interface ResultatMajorite {
  majorite: TypeMajorite
  adopte: boolean
  seuil: number
  voixExprimees: number
  detail: string
  passerelle?: PasserelleMajorite
}

/** Pourcentage à une décimale, point décimal et espace ordinaire avant « % » (pas de format français) ; « · » si base nulle. */
export const formaterPourcentageVoix = (voix: number, base: number): string =>
  base > 0 ? `${((voix / base) * 100).toFixed(1)} %` : '·'

export function calculerMajoriteAG(vote: VoteAssemblee, majorite: TypeMajorite): ResultatMajorite {
  const voixExprimees = vote.pour + vote.contre
  if (majorite === 'art24') {
    const adopte = voixExprimees > 0 && vote.pour > vote.contre
    return {
      majorite,
      adopte,
      seuil: voixExprimees / 2,
      voixExprimees,
      detail: `Pour ${vote.pour}, contre ${vote.contre} : ${formaterPourcentageVoix(vote.pour, voixExprimees)} des voix exprimées (abstentions ${vote.abstention} non comptées).`,
    }
  }
  if (majorite === 'art25') {
    const adopte = vote.pour > vote.voixTotales / 2,
      tiersAtteint = vote.pour >= vote.voixTotales / 3
    return {
      majorite,
      adopte,
      seuil: vote.voixTotales / 2,
      voixExprimees,
      detail: `Pour ${vote.pour} sur ${vote.voixTotales} voix de tous les copropriétaires : ${formaterPourcentageVoix(vote.pour, vote.voixTotales)} (majorité absolue requise).`,
      passerelle: adopte
        ? undefined
        : {
            article: 'art25-1',
            possible: tiersAtteint,
            detail: tiersAtteint
              ? "Au moins le tiers des voix : second vote immédiat à la majorité de l'art. 24."
              : "Moins du tiers des voix : nouvelle assemblée dans les trois mois, à la majorité de l'art. 24.",
          },
    }
  }
  if (majorite === 'art26') {
    const membresPour = vote.membresPour ?? 0,
      majoriteEnNombre = membresPour > vote.membresTotaux / 2,
      deuxTiersVoix = vote.pour >= (2 * vote.voixTotales) / 3,
      adopte = majoriteEnNombre && deuxTiersVoix,
      moitieDesMembres = membresPour >= vote.membresTotaux / 2,
      tiersDesVoix = vote.pour >= vote.voixTotales / 3
    return {
      majorite,
      adopte,
      seuil: (2 * vote.voixTotales) / 3,
      voixExprimees,
      detail: `Membres pour ${membresPour} sur ${vote.membresTotaux} (${majoriteEnNombre ? 'majorité en nombre atteinte' : 'majorité en nombre non atteinte'}) · voix pour ${vote.pour} sur ${vote.voixTotales} : ${formaterPourcentageVoix(vote.pour, vote.voixTotales)} (deux tiers requis).`,
      passerelle: adopte
        ? undefined
        : {
            article: 'art26-1',
            possible: moitieDesMembres && tiersDesVoix,
            detail:
              moitieDesMembres && tiersDesVoix
                ? "Moitié des membres et tiers des voix : second vote immédiat à la majorité de l'art. 25."
                : "Conditions de l'art. 26-1 non réunies.",
          },
    }
  }
  const adopte = vote.pour >= vote.voixTotales && vote.voixTotales > 0
  return {
    majorite,
    adopte,
    seuil: vote.voixTotales,
    voixExprimees,
    detail: `Unanimité de tous les copropriétaires : pour ${vote.pour} sur ${vote.voixTotales}.`,
  }
}

export interface DefinitionMajorite {
  libelle: string
  base: string
  exemples: string
}

/** L'ordre des clés donne l'ordre des options du calculateur (art24, art25, art26, unanimite). */
export const MAJORITES_AG: Record<TypeMajorite, DefinitionMajorite> = {
  art24: {
    libelle: 'Majorité simple',
    base: 'L. 1965 art. 24',
    exemples: "approbation des comptes, budget, travaux d'entretien",
  },
  art25: {
    libelle: 'Majorité absolue',
    base: 'L. 1965 art. 25',
    exemples: "désignation du syndic, conseil syndical, travaux d'économie d'énergie",
  },
  art26: {
    libelle: 'Double majorité',
    base: 'L. 1965 art. 26',
    exemples: 'actes de disposition, modification du règlement',
  },
  unanimite: {
    libelle: 'Unanimité',
    base: 'L. 1965 art. 26, dernier al.',
    exemples: 'aliénation de parties communes nécessaires au respect de la destination',
  },
}
