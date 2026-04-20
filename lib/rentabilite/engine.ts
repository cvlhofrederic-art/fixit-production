import { calculeChargesSociales, calculeChargesFiscales } from './charges'
import type {
  CalculRentabiliteInput,
  ResultatRentabilite,
  RefTaux,
  EcartPoste,
  StatutRentabilite,
  TauxApplique,
} from './types'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function ecartPoste(prevu: number, reel: number): EcartPoste {
  return {
    prevu,
    reel,
    ecart_pct: prevu > 0 ? round2(((reel - prevu) / prevu) * 100) : 0,
  }
}

function statut(tauxMargeNette: number): StatutRentabilite {
  if (tauxMargeNette > 15) return 'rentable'
  if (tauxMargeNette >= 5) return 'juste'
  return 'perte'
}

export function calculeRentabilite(
  input: CalculRentabiliteInput,
  allTaux: RefTaux[],
  quotePartFixes: number,
): ResultatRentabilite {
  const { couts, devis_detail, montant_facture_ht, periode } = input
  const taux_appliques: TauxApplique[] = []

  const totalCouts = round2(
    couts.materiaux + couts.main_oeuvre + couts.sous_traitance + couts.frais_annexes,
  )
  const marge_brute = round2(montant_facture_ht - totalCouts)
  const taux_marge_brute =
    montant_facture_ht > 0 ? round2((marge_brute / montant_facture_ht) * 100) : 0

  const sociales = calculeChargesSociales({
    allTaux,
    juridiction: input.juridiction,
    formeJuridique: input.forme_juridique,
    ca: montant_facture_ht,
    masseSalariale: input.masse_salariale_brute,
    beneficeBrut: marge_brute,
    date: periode,
  })
  taux_appliques.push(...sociales.taux_appliques)

  const beneficeAvantImpot = round2(marge_brute - sociales.montant - quotePartFixes)
  const fiscales = calculeChargesFiscales({
    allTaux,
    juridiction: input.juridiction,
    formeJuridique: input.forme_juridique,
    beneficeAvantImpot,
    date: periode,
  })
  taux_appliques.push(...fiscales.taux_appliques)

  const total_charges = round2(sociales.montant + fiscales.montant + quotePartFixes)
  const benefice_net = round2(marge_brute - total_charges)
  const taux_marge_nette =
    montant_facture_ht > 0 ? round2((benefice_net / montant_facture_ht) * 100) : 0

  const ecart_devis = {
    materiaux: ecartPoste(devis_detail?.materiaux ?? 0, couts.materiaux),
    main_oeuvre: ecartPoste(devis_detail?.main_oeuvre ?? 0, couts.main_oeuvre),
    sous_traitance: ecartPoste(devis_detail?.sous_traitance ?? 0, couts.sous_traitance),
    frais_annexes: ecartPoste(devis_detail?.frais_annexes ?? 0, couts.frais_annexes),
    total: ecartPoste(
      devis_detail
        ? devis_detail.materiaux +
            devis_detail.main_oeuvre +
            devis_detail.sous_traitance +
            devis_detail.frais_annexes
        : 0,
      totalCouts,
    ),
  }

  return {
    benefice_net,
    taux_marge_nette,
    statut: statut(taux_marge_nette),
    marge_brute,
    taux_marge_brute,
    charges_sociales: sociales.montant,
    charges_fiscales: fiscales.montant,
    quote_part_fixes: quotePartFixes,
    total_charges,
    ecart_devis,
    taux_appliques,
    date_calcul: new Date(),
  }
}
