// ══════════════════════════════════════════════════════════════════════════════
// lib/stats-phrases.ts — Transforme les chiffres en phrases humaines
// Pas d'IA — logique conditionnelle pure
// ══════════════════════════════════════════════════════════════════════════════

import type { ResumeActivite } from '@/lib/stats-resume'

export interface PhrasesActivite {
  phrase_principale: string
  phrases_details: string[]
  alertes: string[]
  bonne_nouvelle: string | null
}

function formaterEuro(montant: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(montant)
}

export function genererPhrases(resume: ResumeActivite): PhrasesActivite {
  const { mois_en_cours, alertes, records, comparaison, agenda } = resume

  // ── PHRASE PRINCIPALE ──────────────────────────────────────────────
  let phrase_principale: string

  if (mois_en_cours.revenus_encaisses === 0) {
    phrase_principale = `Aucun encaissement enregistré en ${mois_en_cours.label} pour l'instant.`
  } else {
    const comparaisonStr = comparaison.vs_mois_precedent !== null
      ? comparaison.vs_mois_precedent >= 0
        ? ` (+${comparaison.vs_mois_precedent}% vs le mois dernier)`
        : ` (${comparaison.vs_mois_precedent}% vs le mois dernier)`
      : ''
    phrase_principale =
      `En ${mois_en_cours.label}, vous avez encaissé **${formaterEuro(mois_en_cours.revenus_encaisses)}**${comparaisonStr}.`
  }

  // ── PHRASES DÉTAIL ─────────────────────────────────────────────────
  const phrases_details: string[] = []

  if (mois_en_cours.chantiers_termines > 0) {
    const s = mois_en_cours.chantiers_termines > 1
    phrases_details.push(
      `${mois_en_cours.chantiers_termines} chantier${s ? 's terminés' : ' terminé'} ce mois-ci.`
    )
  }

  if (mois_en_cours.taux_conversion !== null) {
    if (mois_en_cours.taux_conversion >= 70) {
      phrases_details.push(
        `Excellent taux de conversion : ${mois_en_cours.taux_conversion}% de vos devis ont été acceptés.`
      )
    } else if (mois_en_cours.taux_conversion >= 50) {
      phrases_details.push(
        `${mois_en_cours.taux_conversion}% de vos devis acceptés (${mois_en_cours.devis_acceptes} sur ${mois_en_cours.devis_envoyes}).`
      )
    } else if (mois_en_cours.taux_conversion > 0) {
      phrases_details.push(
        `${mois_en_cours.taux_conversion}% de vos devis acceptés — pensez à relancer les devis en attente.`
      )
    }
  }

  if (mois_en_cours.nouveaux_clients > 0) {
    const s = mois_en_cours.nouveaux_clients > 1
    phrases_details.push(
      `${mois_en_cours.nouveaux_clients} nouveau${s ? 'x clients' : ' client'} ce mois-ci.`
    )
  }

  if (records.total_annee_en_cours > 0) {
    phrases_details.push(
      `Depuis le 1er janvier : **${formaterEuro(records.total_annee_en_cours)}** encaissés.`
    )
  }

  if (agenda.chantiers_cette_semaine > 0) {
    const s = agenda.chantiers_cette_semaine > 1
    phrases_details.push(
      `${agenda.chantiers_cette_semaine} chantier${s ? 's prévus' : ' prévu'} cette semaine.`
    )
  } else if (agenda.prochain_chantier_dans_jours !== null) {
    if (agenda.prochain_chantier_dans_jours === 0) {
      phrases_details.push("Vous avez un chantier aujourd'hui.")
    } else if (agenda.prochain_chantier_dans_jours === 1) {
      phrases_details.push('Prochain chantier demain.')
    } else {
      phrases_details.push(`Prochain chantier dans ${agenda.prochain_chantier_dans_jours} jours.`)
    }
  } else {
    phrases_details.push('Aucun chantier planifié pour le moment.')
  }

  // ── ALERTES ────────────────────────────────────────────────────────
  const alertes_phrases: string[] = []

  if (alertes.factures_impayees > 0) {
    const s = alertes.factures_impayees > 1
    alertes_phrases.push(
      `${alertes.factures_impayees} facture${s ? 's impayées' : ' impayée'} — ${formaterEuro(alertes.factures_impayees_montant)} en attente.`
    )
  }

  if (alertes.devis_en_attente > 0) {
    alertes_phrases.push(
      `${alertes.devis_en_attente} devis sans réponse depuis plus de 7 jours (${formaterEuro(alertes.devis_en_attente_montant)}).`
    )
  }

  if (alertes.chantiers_sans_facture > 0) {
    const s = alertes.chantiers_sans_facture > 1
    alertes_phrases.push(
      `${alertes.chantiers_sans_facture} chantier${s ? 's terminés' : ' terminé'} sans facture émise.`
    )
  }

  // ── BONNE NOUVELLE ─────────────────────────────────────────────────
  let bonne_nouvelle: string | null = null

  if (records.meilleur_mois_annee && records.meilleur_mois_annee.revenus > 0) {
    bonne_nouvelle = `Votre meilleur mois de l'année : ${formaterEuro(records.meilleur_mois_annee.revenus)} en ${records.meilleur_mois_annee.mois_label}.`
  }

  if (
    comparaison.vs_mois_precedent !== null &&
    comparaison.vs_mois_precedent > 0 &&
    !bonne_nouvelle
  ) {
    bonne_nouvelle = `Vous progressez de +${comparaison.vs_mois_precedent}% par rapport au mois dernier (+${formaterEuro(comparaison.vs_mois_precedent_montant!)}).`
  }

  return {
    phrase_principale,
    phrases_details,
    alertes: alertes_phrases,
    bonne_nouvelle,
  }
}
