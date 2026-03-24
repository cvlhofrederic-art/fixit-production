// ── Moteur de scoring pour analyse de devis ──────────────────────────────────
// Calcule 3 scores : conformité légale /100, prix marché (% écart), confiance /100

// ── Types ────────────────────────────────────────────────────────────────────

export interface ConformiteCritere {
  id: string
  label: string
  poids: number
  status: 'ok' | 'missing' | 'partial' | 'na'
  detail?: string
}

export interface PrixDetail {
  designation: string
  prix: number
  unite: string
  fourchette_min: number
  fourchette_max: number
  status: 'bas' | 'ok' | 'eleve' | 'excessif' | 'inconnu'
  ecart_pct: number
}

export interface ScoreConformite {
  total: number
  max: number
  details: ConformiteCritere[]
}

export interface ScorePrix {
  ecart_moyen_pct: number
  details: PrixDetail[]
}

export interface AnalyseScores {
  conformite: ScoreConformite
  prix: ScorePrix
  confiance: number
  action_recommandee: 'valider' | 'negocier' | 'devis_vitfix'
  messages_negociation: string[]
}

// ── Fourchettes de prix marché 2025-2026 (TTC) ──────────────────────────────
// Clé = mots-clés normalisés, valeur = [min, max] en euros
const PRIX_MARCHE: Record<string, [number, number]> = {
  // Plomberie
  'debouchage simple': [90, 220],
  'debouchage complexe': [200, 500],
  'debouchage hydrocurage': [200, 500],
  'debouchage canalisation': [90, 500],
  'fuite robinet': [70, 170],
  'remplacement robinet': [150, 350],
  'remplacement mitigeur': [150, 350],
  'ballon eau chaude': [900, 1800],
  'chauffe-eau electrique': [900, 1800],
  'chauffe-eau thermodynamique': [2500, 4500],
  'wc complet': [500, 1200],
  'pose wc': [500, 1200],
  'pose sanitaire': [500, 1200],
  'colonne evacuation': [200, 500],
  'recherche fuite': [150, 400],
  'raccordement lave': [80, 200],
  'flexible alimentation': [50, 120],
  'robinet arret': [80, 180],
  'colonne douche': [100, 300],
  'siphon bonde': [60, 150],
  // Electricité
  'tableau electrique': [700, 1400],
  'tableau triphase': [1100, 2800],
  'mise conformite': [2200, 5500],
  'mise aux normes': [2200, 5500],
  'prise courant': [60, 160],
  'prise electrique': [60, 160],
  'point lumineux': [80, 200],
  'interphone': [250, 900],
  'visiophone': [250, 900],
  'interrupteur': [60, 150],
  'va-et-vient': [60, 150],
  'vmc simple flux': [400, 900],
  'disjoncteur': [80, 200],
  'mise terre': [200, 600],
  'cable reseau': [80, 200],
  'borne recharge': [1200, 2500],
  // Chauffage
  'entretien chaudiere': [100, 220],
  'remplacement chaudiere': [3500, 7500],
  'pompe chaleur air air': [3000, 8000],
  'pac air air': [3000, 8000],
  'climatisation monosplit': [1500, 3500],
  'radiateur electrique': [300, 800],
  'thermostat connecte': [150, 400],
  'purge radiateur': [80, 200],
  'radiateur eau chaude': [400, 1000],
  'vmc double flux': [2500, 6000],
  'plancher chauffant': [500, 1500],
  // Serrurerie
  'ouverture porte claquee': [80, 200],
  'ouverture porte blindee': [150, 400],
  'remplacement cylindre': [100, 300],
  'serrure complete': [200, 500],
  'serrure multipoints': [250, 600],
  'verrou': [80, 200],
  'judas optique': [50, 120],
  'blindage porte': [800, 2500],
  'garde-corps': [150, 400],
  // Peinture (prix au m²)
  'peinture interieur': [25, 55],
  'peinture mur': [25, 55],
  'peinture plafond': [30, 60],
  'ravalement facade': [35, 110],
  'peinture facade': [35, 110],
  'papier peint': [20, 50],
  'enduit lissage': [15, 35],
  'beton cire': [60, 120],
  'toile verre': [15, 30],
  // Menuiserie
  'fenetre double vitrage': [450, 1300],
  'fenetre pvc': [450, 1300],
  'porte entree': [2200, 6500],
  'porte interieure': [300, 800],
  'volet roulant': [400, 1000],
  'parquet flottant': [25, 55],
  'parquet massif': [40, 80],
  'portail': [800, 3000],
  'placard mesure': [500, 2000],
  'plinthe': [8, 20],
  'bardage bois': [40, 100],
  // Carrelage (prix au m²)
  'carrelage sol': [35, 90],
  'carrelage mural': [40, 100],
  'faience': [40, 100],
  'joint carrelage': [15, 35],
  'depose carrelage': [15, 40],
  'mosaique': [50, 120],
  'etancheite douche': [30, 80],
  'carrelage exterieur': [40, 100],
  // Toiture (prix au m²)
  'refection tuile': [90, 170],
  'etancheite terrasse': [55, 130],
  'nettoyage toiture': [25, 55],
  'traitement hydrofuge': [15, 40],
  'gouttiere': [30, 80],
  'velux': [400, 1200],
  'fenetre toit': [400, 1200],
  'reparation fuite toiture': [200, 600],
  'faitage': [30, 70],
  'solin': [25, 60],
  // Espaces verts
  'tonte pelouse': [0.12, 0.55],
  'taille haie': [35, 90],
  'elagage arbre': [100, 2000],
  'elagage': [100, 2000],
  'debroussaillage': [120, 650],
  'abattage arbre': [300, 3000],
  'abattage': [300, 3000],
  'plantation': [20, 60],
  'gazon synthetique': [30, 80],
  'arrosage automatique': [500, 2500],
  'evacuation vegetaux': [50, 150],
  // Maçonnerie
  'fissure facade': [55, 170],
  'reprise fissure': [55, 170],
  'saignee': [15, 40],
  'parpaing': [40, 90],
  'dalle beton': [50, 120],
  'demolition cloison': [20, 50],
  'enduit exterieur': [25, 60],
  'ragreage': [12, 35],
  'linteau': [50, 150],
  // Plaquiste (prix au m²)
  'cloison placo': [30, 70],
  'faux-plafond': [35, 80],
  'faux plafond': [35, 80],
  'isolation mur': [30, 70],
  'isolation comble': [20, 50],
  'bandes enduit placo': [10, 25],
  'placo hydrofuge': [35, 85],
  'isolation phonique': [35, 80],
  // Nettoyage
  'nettoyage chantier': [200, 800],
  'nettoyage fin chantier': [200, 800],
  'nettoyage haute pression': [3, 10],
  'nettoyage vitre': [3, 10],
  'debarras logement': [300, 1500],
  'nettoyage sinistre': [500, 2000],
  'desinfection': [200, 800],
  'desinsectisation': [150, 500],
}

// ── Normalisation texte pour matching ────────────────────────────────────────
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Trouver la fourchette de prix pour une prestation ────────────────────────
export function findPriceRange(designation: string): [number, number] | null {
  const norm = normalize(designation)
  let bestMatch: [number, number] | null = null
  let bestScore = 0

  for (const [key, range] of Object.entries(PRIX_MARCHE)) {
    const keyNorm = normalize(key)
    const words = keyNorm.split(' ')
    const matchCount = words.filter(w => norm.includes(w)).length
    const score = matchCount / words.length
    if (score > bestScore && score >= 0.5) {
      bestScore = score
      bestMatch = range
    }
  }
  return bestMatch
}

// ── Score de conformité légale /100 ──────────────────────────────────────────
export function calculateConformiteScore(
  mentionsPresentes: string[],
  mentionsManquantes: string[],
  extracted: Record<string, unknown>
): ScoreConformite {
  const mp = mentionsPresentes.map(m => normalize(m))
  const mm = mentionsManquantes.map(m => normalize(m))

  function has(keywords: string[]): 'ok' | 'missing' | 'partial' {
    const found = keywords.some(k => mp.some(m => m.includes(normalize(k))))
    const missing = keywords.some(k => mm.some(m => m.includes(normalize(k))))
    if (found && !missing) return 'ok'
    if (found && missing) return 'partial'
    // Check extracted data
    return 'missing'
  }

  const siret = extracted.artisan_siret as string || ''
  const siretValid = /^\d{14}$/.test(siret.replace(/\s/g, ''))

  const criteres: ConformiteCritere[] = [
    {
      id: 'siret',
      label: 'SIRET présent et valide (14 chiffres)',
      poids: 10,
      status: siretValid ? 'ok' : (siret ? 'partial' : has(['siret', 'siren'])),
    },
    {
      id: 'assurance_decennale',
      label: 'Assurance décennale (assureur + n° + couverture)',
      poids: 15,
      status: has(['decennale', 'garantie decennale']),
    },
    {
      id: 'tva',
      label: 'TVA mentionnée (taux ou franchise)',
      poids: 10,
      status: has(['tva', 'taxe valeur ajoutee', 'franchise base']),
    },
    {
      id: 'conditions_paiement',
      label: 'Conditions de paiement',
      poids: 5,
      status: has(['conditions paiement', 'paiement', 'reglement', 'acompte']),
    },
    {
      id: 'penalites_retard',
      label: 'Pénalités de retard + indemnité 40€',
      poids: 10,
      status: has(['penalite', 'retard', '40']),
    },
    {
      id: 'duree_validite',
      label: 'Durée de validité du devis',
      poids: 5,
      status: has(['validite', 'valable', 'expire']),
    },
    {
      id: 'droit_retractation',
      label: 'Droit de rétractation (14 jours)',
      poids: 10,
      status: has(['retractation', '14 jours', 'l221-18', 'l. 221-18']),
    },
    {
      id: 'formulaire_retractation',
      label: 'Formulaire de rétractation joint',
      poids: 5,
      status: has(['formulaire retractation', 'je notifie']),
    },
    {
      id: 'mediateur',
      label: 'Médiateur de la consommation',
      poids: 5,
      status: has(['mediateur', 'mediation', 'consommation']),
    },
    {
      id: 'detail_prestations',
      label: 'Détail des prestations (quantité, unité, prix)',
      poids: 10,
      status: (extracted.prestations as unknown[])?.length > 0 ? 'ok' : has(['designation', 'prestation', 'quantite']),
    },
    {
      id: 'numero_devis',
      label: 'Numéro de devis unique',
      poids: 5,
      status: (extracted.numero_document as string) ? 'ok' : has(['numero', 'devis n', 'facture n']),
    },
    {
      id: 'date_emission',
      label: "Date d'émission",
      poids: 5,
      status: (extracted.date_document as string) ? 'ok' : has(['date emission', 'date du', 'emis le']),
    },
    {
      id: 'statut_juridique',
      label: 'Statut juridique (EI, SARL, SAS...)',
      poids: 5,
      status: has(['ei', 'eirl', 'sarl', 'eurl', 'sas', 'sasu', 'sa', 'entrepreneur individuel', 'auto-entrepreneur', 'micro']),
    },
  ]

  let total = 0
  let max = 0
  for (const c of criteres) {
    if (c.status === 'na') continue
    max += c.poids
    if (c.status === 'ok') total += c.poids
    else if (c.status === 'partial') total += Math.floor(c.poids * 0.5)
  }

  return { total, max, details: criteres }
}

// ── Score de prix ────────────────────────────────────────────────────────────
export function calculatePrixScore(
  prestations: Array<{ designation: string; quantite?: number; unite?: string; prix_unitaire_ht?: number; total_ht?: number }>
): ScorePrix {
  const details: PrixDetail[] = []

  for (const p of prestations) {
    const prix = p.prix_unitaire_ht || p.total_ht || 0
    if (!prix || prix <= 0) continue

    const fourchette = findPriceRange(p.designation)
    if (!fourchette) {
      details.push({
        designation: p.designation,
        prix,
        unite: p.unite || 'u',
        fourchette_min: 0,
        fourchette_max: 0,
        status: 'inconnu',
        ecart_pct: 0,
      })
      continue
    }

    const milieu = (fourchette[0] + fourchette[1]) / 2
    const ecart = ((prix - milieu) / milieu) * 100
    let status: PrixDetail['status'] = 'ok'
    if (prix < fourchette[0]) status = 'bas'
    else if (prix > fourchette[1] * 1.5) status = 'excessif'
    else if (prix > fourchette[1]) status = 'eleve'

    details.push({
      designation: p.designation,
      prix,
      unite: p.unite || 'u',
      fourchette_min: fourchette[0],
      fourchette_max: fourchette[1],
      status,
      ecart_pct: Math.round(ecart),
    })
  }

  const known = details.filter(d => d.status !== 'inconnu')
  const ecart_moyen = known.length > 0
    ? Math.round(known.reduce((sum, d) => sum + d.ecart_pct, 0) / known.length)
    : 0

  return { ecart_moyen_pct: ecart_moyen, details }
}

// ── Score de confiance global /100 ───────────────────────────────────────────
export function calculateScores(
  mentionsPresentes: string[],
  mentionsManquantes: string[],
  extracted: Record<string, unknown>,
  siretVerified?: boolean
): AnalyseScores {
  const conformite = calculateConformiteScore(mentionsPresentes, mentionsManquantes, extracted)
  const prestations = (extracted.prestations || []) as Array<{ designation: string; quantite?: number; unite?: string; prix_unitaire_ht?: number; total_ht?: number }>
  const prix = calculatePrixScore(prestations)

  // Bonus SIRET vérifié via API
  if (siretVerified) {
    const siretCritere = conformite.details.find(c => c.id === 'siret')
    if (siretCritere) siretCritere.status = 'ok'
    // Recalculate total
    conformite.total = 0
    for (const c of conformite.details) {
      if (c.status === 'na') continue
      if (c.status === 'ok') conformite.total += c.poids
      else if (c.status === 'partial') conformite.total += Math.floor(c.poids * 0.5)
    }
  }

  // Score prix normalisé /100 : 100 = pile au milieu, -1pt par % d'écart
  const prixScore = Math.max(0, Math.min(100, 100 - Math.abs(prix.ecart_moyen_pct)))

  // Confiance = conformité × 0.5 + prix × 0.3 + bonus × 0.2
  const bonusEntreprise = siretVerified ? 100 : 50 // 50 par défaut si pas vérifié
  const confiance = Math.round(
    (conformite.total / conformite.max * 100) * 0.5 +
    prixScore * 0.3 +
    bonusEntreprise * 0.2
  )

  // Action recommandée
  const conformitePct = (conformite.total / conformite.max) * 100
  let action: AnalyseScores['action_recommandee'] = 'valider'
  const messages: string[] = []

  if (conformitePct < 70 || prix.details.some(d => d.status === 'excessif')) {
    action = 'devis_vitfix'
  } else if (conformitePct < 90 || prix.details.some(d => d.status === 'eleve')) {
    action = 'negocier'
  }

  // Générer les messages de négociation
  for (const c of conformite.details) {
    if (c.status === 'missing') {
      messages.push(`Votre devis ne mentionne pas : ${c.label}. Pouvez-vous ajouter cette information ?`)
    }
  }
  for (const p of prix.details) {
    if (p.status === 'eleve' || p.status === 'excessif') {
      messages.push(`Le prix de "${p.designation}" (${p.prix}€) semble ${p.status === 'excessif' ? 'très ' : ''}élevé par rapport au marché (${p.fourchette_min}-${p.fourchette_max}€). Est-il négociable ?`)
    }
  }

  return {
    conformite,
    prix,
    confiance: Math.max(0, Math.min(100, confiance)),
    action_recommandee: action,
    messages_negociation: messages,
  }
}
