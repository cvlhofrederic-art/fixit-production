import { NextResponse, type NextRequest } from 'next/server'

// Agent Matériaux — Powered by Groq (Llama 3.3-70B) + Tavily AI Search
// Expert BTP : normes DTU/NF/RE2020, prix magasin réels, conformité réglementaire

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || ''

interface MaterialItem {
  name: string
  qty: number
  unit: string
  category: string
  norms: string[]          // ex: ["DTU 65.11", "NF EN 12897", "RE2020"]
  normDetails: string      // ex: "Distance mini 0.5m du tableau électrique"
  prices: Array<{ store: string; price: number; url: string | null }>
  bestPrice: { store: string; price: number } | null
  avgPrice: number
}

// ─── Base de connaissances normes BTP ────────────────────────────────────────
const BTP_NORMS_KNOWLEDGE = `
## BASE DE CONNAISSANCES NORMES BTP FRANCE (obligatoire pour chaque matériau)

### CHAUFFAGE / EAU CHAUDE SANITAIRE
- Chauffe-eau électrique : NF EN 60335-2-21, NF C 15-100 (raccordement élec), DTU 60.1 (plomberie)
- Chauffe-eau thermodynamique : NF EN 16147, RE2020 (COP min 2.5), arrêté du 3 mai 2007
- Chaudière gaz : DTU 61.1, NF EN 15420, DTA (Document Technique d'Application), certification NF GAZ
- Pompe à chaleur air/eau : NF EN 14511, RE2020, label RGE QualiPAC obligatoire pour aides
- Plancher chauffant : DTU 65.14 (eau chaude), NF EN 1264, température surface max 29°C
- Radiateur : NF EN 442-1, pression max 4 bars, DTU 65.11 (installation chauffage central)
- Robinet thermostatique : NF EN 215, réglage température par pièce obligatoire depuis 2012

### PLOMBERIE / SANITAIRE
- Tuyaux cuivre : NF EN 1057, DTU 60.1, brasure capillaire ou à sertir selon diamètre
- Tuyaux PER : NF EN ISO 15875, XP P 52-303, température max 70°C usage continu
- Tuyaux multicouche : NF EN ISO 21003, DTU 60.1, rayon de courbure min 5x diamètre
- Robinetterie : NF EN 200 (robinets), marquage CE obligatoire, débit min 0.1 L/s à 1 bar
- Siphon/évacuation : NF EN 1253, pente min 1cm/m obligatoire, DTU 60.11
- Chasse d'eau WC : NF EN 12541, volume chasse 6L standard, 3/6L double commande recommandé
- Raccords à sertir : NF EN 1254-7, outil de sertissage certifié par fabricant obligatoire
- Clapet anti-retour : NF EN 13959, obligatoire sur toute installation eau froide/chaude

### ÉLECTRICITÉ
- Câbles : NF C 32-102 (rigide), NF C 32-201 (souple), section min 1.5mm² éclairage / 2.5mm² prises
- Tableau électrique : NF EN 61439, NF C 15-100, disjoncteur différentiel 30mA obligatoire
- Prises/interrupteurs : NF EN 60669, indice IP selon pièce (IP44 salle de bain min)
- Gaines : NF EN 50086, ICTA obligatoire en neuf, IRL autorisé en rénovation
- Boîtes de dérivation : NF EN 60670, IP2X minimum, étiquetage obligatoire
- Tableau de communication (VDI) : NF C 15-100, NF EN 50173
- Chargeur VE : NF EN 61851, IRVE certifié obligatoire, protection différentielle type B

### ISOLATION
- Laine de verre/roche : Acermi (A+), Euréka, NF EN 13162, épaisseur selon zone climatique (H1/H2/H3)
- Isolation thermique par l'extérieur (ITE) : Avis technique CSTB obligatoire, NF DTU 55.2
- Pare-vapeur : NF EN 13984, Sd min 18m en zone froide, chevauchement 100mm + scotch aluminium
- Isolation combles perdus : RE2020 R≥7 m².K/W minimum, NF EN 13162
- Isolation sous-sol/plancher bas : R≥3 m².K/W RE2020, NF EN 13163 (PSE)
- Enduit isolant : Avis technique CSTB obligatoire, pas de remplacement à isolation classique

### CARRELAGE / REVÊTEMENTS
- Carrelage sol : NF EN 14411, PEI 3 minimum pour usage résidentiel intensif, NF DTU 52.1
- Carrelage mur : NF EN 14411, absorption eau ≤3% pour pièces humides
- Colle carrelage : NF EN 12004, classe C2 minimum pour pièces humides (douche/bain)
- Joint carrelage : NF EN 13888, joint époxy obligatoire douches à l'italienne
- Étanchéité sous carrelage (SPEC) : NF P 84-204, avis technique CSTB, obligatoire douches à l'italienne
- Chape : NF EN 13813, épaisseur min 5cm sur plancher chauffant, NF DTU 26.2

### MENUISERIES / FERMETURES
- Fenêtres PVC/ALU/BOIS : NF EN 14351-1, Uw max 1.3 W/m²K (RE2020), label ACOTHERM recommandé
- Portes d'entrée : NF EN 14351-1, résistance effraction RC2 recommandée, Ud max 1.2 W/m²K
- Volets roulants : NF EN 13659, motorisation NF EN 60335-2-97
- Vitrage : NF EN 1279 (double vitrage), facteur solaire g et Uw sur fiche produit obligatoire
- Garde-corps : NF P 01-012, hauteur min 1m, résistance 0.6 kN/m linéaire
- Escalier : NF P 01-012, giron min 24cm, hauteur max 20cm, main courante obligatoire

### MAÇONNERIE / GROS ŒUVRE
- Béton : NF EN 206, classe C25/30 minimum pour dalle, NF DTU 21
- Parpaing béton : NF EN 771-3, résistance compression selon usage, NF DTU 20.1
- Brique : NF EN 771-1, brique monomur R≥1 selon épaisseur
- Mortier : NF EN 998-2, M5 minimum pour maçonnerie portante
- Enduit façade : NF EN 998-1, NF DTU 26.1, compatibilité support obligatoire

### TOITURE / ÉTANCHÉITÉ
- Tuiles : NF EN 1304, recouvrement min selon pente (DTU 40.21/.22/.23)
- Ardoises : NF EN 12326, NF DTU 40.11, pente min 25° en pose traditionnelle
- Étanchéité toiture terrasse : NF DTU 43.1, Avis technique CSTB pour nouveaux produits
- Membrane EPDM : Avis technique CSTB obligatoire, épaisseur min 1.2mm
- Liteaux : NF B 52-001, section selon espacement et charge de neige zone

### VENTILATION
- VMC simple flux : NF EN 13141-7, NF DTU 68.3, débit réglementaire par pièce (arrêté 24/03/1982)
- VMC double flux : NF EN 308 (échangeur), NF DTU 68.3, rendement thermique >85% RE2020
- Conduit de ventilation : NF EN 13403, pente min 3% pour évacuation condensats
- Bouche VMC : NF EN 13141-2, réglage débit obligatoire, nettoyage annuel conseillé

### PRIX DE RÉFÉRENCE MAGASIN (France, prix TTC 2024-2025)
Chauffage:
- Chauffe-eau élec 150L: LM 280-380€, BD 240-320€, Casto 260-350€
- Chauffe-eau élec 200L: LM 320-450€, BD 280-380€, Casto 300-420€
- Chauffe-eau thermo 200L: LM 900-1400€, BD 750-1100€, Casto 850-1250€
- Chauffe-eau thermo 250L: LM 1100-1600€, BD 950-1300€, Casto 1000-1450€
- PAC air/air (monosplit 2.5kW): LM 600-900€, BD 500-800€, Casto 550-850€

Plomberie:
- Tube cuivre 12/14 (m): LM 4-6€, BD 3.5-5€, PP 3-4.5€
- Tube cuivre 16/18 (m): LM 5-8€, BD 4.5-7€, PP 4-6€
- Tube PER 16 (rouleau 25m): LM 35-50€, BD 28-42€, Casto 32-46€
- Tube multicouche 16 (rouleau 25m): LM 45-65€, BD 38-55€, Casto 42-60€
- Robinet d'arrêt 15/21: LM 8-15€, BD 6-12€, Casto 7-13€
- Mitigeur lavabo: LM 35-120€, BD 28-90€, Casto 30-100€
- Mitigeur douche: LM 45-150€, BD 38-120€, Casto 40-130€
- WC suspendu complet: LM 200-500€, BD 180-450€, Casto 190-470€
- Receveur douche 90x90: LM 80-250€, BD 70-200€, Casto 75-220€

Électricité:
- Câble H07V-U 1.5mm² (100m): LM 25-35€, BD 20-30€, Casto 22-32€
- Câble H07V-U 2.5mm² (100m): LM 38-52€, BD 32-44€, Casto 35-48€
- Tableau 13 modules: LM 35-65€, BD 28-55€, Casto 30-60€
- Disjoncteur différentiel 40A 30mA: LM 35-60€, BD 28-50€, Casto 30-55€
- Prise 2P+T: LM 3-8€, BD 2.5-7€, Casto 2.8-7.5€
- Interrupteur simple: LM 3-10€, BD 2.5-8€, Casto 2.8-9€
- Gaine ICTA 3/4 (100m): LM 18-28€, BD 15-24€, Casto 16-26€

Isolation:
- Laine de verre 100mm (m²): LM 3.5-6€, BD 3-5€, Casto 3.2-5.5€
- Laine de verre 200mm (m²): LM 6-9€, BD 5-8€, Casto 5.5-8.5€
- Pare-vapeur (rouleau 75m²): LM 25-40€, BD 20-35€, Casto 22-38€
- Polystyrène expansé 100mm (m²): LM 5-9€, BD 4-8€, Casto 4.5-8.5€

Carrelage:
- Carrelage sol grès cérame 60x60 (m²): LM 15-60€, BD 12-50€, Casto 13-55€
- Colle carrelage C2 (sac 25kg): LM 12-18€, BD 10-16€, Casto 11-17€
- Joint carrelage (sac 5kg): LM 8-15€, BD 6-12€, Casto 7-13€
- SPEC étanchéité (kit 10m²): LM 35-55€, BD 28-45€, Casto 30-50€

Menuiseries:
- Fenêtre PVC double vitrage 60x120: LM 80-200€, BD 70-180€, Casto 75-190€
- Porte d'entrée PVC: LM 400-1200€, BD 350-1000€, Casto 380-1100€
- Vitrage feuilleté (m²): LM 35-80€ (découpe), spécialiste vitrier

Maçonnerie:
- Parpaing 20x20x50 (unité): LM 1.2-1.8€, BD 1-1.6€, PP 0.9-1.5€
- Sac ciment 35kg: LM 7-10€, BD 6-9€, PP 6-8.5€
- Sac enduit 30kg: LM 8-14€, BD 7-12€, Casto 7.5-13€
`

// ─── Groq API call helper ─────────────────────────────────────────────────────
async function callGroq(messages: Array<{ role: string; content: string }>, maxTokens = 1200) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.15,
      max_tokens: maxTokens,
    }),
  })
  if (!res.ok) throw new Error(`Groq error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

// ─── Tavily search helper ─────────────────────────────────────────────────────
async function searchTavily(query: string): Promise<Array<{ title: string; url: string; content: string }>> {
  if (!TAVILY_API_KEY) return []
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        max_results: 5,
      }),
    })
    if (!res.ok) {
      console.error('Tavily error:', res.status, await res.text())
      return []
    }
    const data = await res.json()
    return data.results || []
  } catch (e) {
    console.error('Tavily fetch error:', e)
    return []
  }
}

// ─── Parse JSON from Groq response (with regex fallback) ─────────────────────
function parseJsonFromText<T>(text: string, fallback: T): T {
  try { return JSON.parse(text) } catch {}
  const stripped = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  try { return JSON.parse(stripped) } catch {}
  const objMatch = stripped.match(/\{[\s\S]*\}/)
  if (objMatch) { try { return JSON.parse(objMatch[0]) } catch {} }
  const arrMatch = stripped.match(/\[[\s\S]*\]/)
  if (arrMatch) { try { return JSON.parse(arrMatch[0]) } catch {} }
  return fallback
}

// ─── POST Handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, city } = body

    if (!query?.trim()) {
      return NextResponse.json({ error: 'Query requise' }, { status: 400 })
    }
    if (!GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY non configurée', fallback: true })
    }

    const cityContext = city ? ` à ${city}` : ' en France'
    const usingTavily = Boolean(TAVILY_API_KEY)

    // ── STAGE 1 : Extraction matériaux + normes applicables ───────────────────
    const stage1System = `Tu es un expert BTP français certifié. Tu connais parfaitement toutes les normes (DTU, NF, RE2020, arrêtés) applicables à chaque type de travaux.

${BTP_NORMS_KNOWLEDGE}

Pour le chantier décrit, génère la liste des matériaux ESSENTIELS avec leurs normes obligatoires.
Réponds UNIQUEMENT avec un tableau JSON valide, sans texte avant ou après, sans markdown, sans backtick.
Maximum 7 matériaux. Format strict (respecte exactement les noms de champs) :
[
  {
    "name": "Chauffe-eau thermodynamique 200L classe A+",
    "qty": 1,
    "unit": "unité",
    "category": "Chauffage",
    "norms": ["NF EN 16147", "RE2020", "DTU 60.1"],
    "normDetails": "COP minimum 2.5 requis RE2020. Raccordement électrique NF C 15-100. Distance mini 0.5m de toute paroi. Soupape de sécurité obligatoire."
  }
]
Chaque matériau DOIT avoir au moins 1 norme et des normDetails précis sur les contraintes de pose/installation.`

    const stage1Text = await callGroq([
      { role: 'system', content: stage1System },
      { role: 'user', content: `Chantier : ${query.trim()}${cityContext}` },
    ], 1000)

    const rawMaterials: Array<{ name: string; qty: number; unit: string; category: string; norms: string[]; normDetails: string }> =
      parseJsonFromText(stage1Text, [])

    if (!rawMaterials.length) {
      return NextResponse.json({
        success: true,
        materials: [],
        totalEstimate: null,
        response: "Je n'ai pas réussi à analyser ce chantier. Pouvez-vous décrire plus précisément l'intervention ? Exemple : \"remplacement chauffe-eau thermodynamique 200L\" ou \"pose carrelage sol 20m² format 60x60\".",
        recommendations: '',
        fallback: false,
      })
    }

    // ── STAGE 2 : Recherche prix Tavily (si disponible) ───────────────────────
    let searchBundle = ''
    if (usingTavily) {
      const searchResults = await Promise.allSettled(
        rawMaterials.map(async (m) => {
          const searchQ = `${m.name} prix magasin France 2025 Leroy Merlin Brico Depot Castorama`
          const results = await searchTavily(searchQ)
          return { material: m, results }
        })
      )

      searchBundle = searchResults
        .map((r, i) => {
          if (r.status !== 'fulfilled') return `Matériau ${i + 1}: aucun résultat`
          const { material, results } = r.value
          const snippets = results
            .map(res => `  - [${res.title}] ${res.content.substring(0, 250)} (${res.url})`)
            .join('\n')
          return `Matériau ${i + 1}: ${material.name} (${material.qty} ${material.unit})\n${snippets || '  Aucun résultat web trouvé'}`
        })
        .join('\n\n---\n\n')
    }

    // ── STAGE 3 : Analyse prix + génération réponse finale ────────────────────
    const priceSystem = `Tu es un expert acheteur BTP en France. Tu connais précisément les prix en rayon de Leroy Merlin (LM), Brico Dépôt (BD), Castorama (Casto), Point P (PP) et Cédéo.

${BTP_NORMS_KNOWLEDGE}

${usingTavily ? 'Des résultats de recherche web sont fournis. Utilise les prix trouvés en priorité. Si insuffisants, complète avec ta connaissance des prix magasin.' : 'Utilise ta connaissance précise des prix magasin France 2024-2025 de la base ci-dessus.'}

IMPORTANT: Retourne UNIQUEMENT un objet JSON valide, sans markdown, sans backtick, sans texte avant ou après.
Structure OBLIGATOIRE:
{
  "materials": [
    {
      "name": "nom exact du matériau avec référence/modèle si possible",
      "qty": 1,
      "unit": "unité",
      "category": "catégorie",
      "norms": ["DTU XX.X", "NF EN XXXXX"],
      "normDetails": "Points de vigilance pour la pose et conformité réglementaire",
      "prices": [
        {"store": "Leroy Merlin", "price": 699, "url": null},
        {"store": "Brico Dépôt", "price": 549, "url": null},
        {"store": "Castorama", "price": 629, "url": null}
      ],
      "bestPrice": {"store": "Brico Dépôt", "price": 549},
      "avgPrice": 625
    }
  ],
  "totalEstimate": {"min": 850, "max": 1200},
  "response": "Synthèse **en gras pour les points importants**, avec les normes clés à respecter",
  "recommendations": "Conseils pratiques : où acheter, quand commander, alertes normes critiques"
}
RÈGLES ABSOLUES:
- prix = nombre entier en euros TTC (JAMAIS de symbole €)
- toujours 2 à 4 enseignes par matériau
- bestPrice = enseigne avec le prix le plus bas dans prices
- avgPrice = moyenne arrondie des prices
- les prix doivent être cohérents avec les fourchettes de la base de connaissances ci-dessus
- normDetails = contraintes concrètes de pose (distances, sections, pentes, épaisseurs)`

    const priceUserContent = usingTavily
      ? `Chantier: "${query}"${cityContext}\nMatériaux identifiés: ${JSON.stringify(rawMaterials)}\n\nRésultats recherche web:\n${searchBundle}`
      : `Chantier: "${query}"${cityContext}\nMatériaux identifiés: ${JSON.stringify(rawMaterials)}`

    const priceText = await callGroq([
      { role: 'system', content: priceSystem },
      { role: 'user', content: priceUserContent },
    ], 2500)

    const parsed = parseJsonFromText<any>(priceText, null)

    if (parsed?.materials?.length) {
      return NextResponse.json({
        success: true,
        materials: parsed.materials,
        totalEstimate: parsed.totalEstimate || null,
        response: parsed.response || `Voici les matériaux et prix pour : **${query}**`,
        recommendations: parsed.recommendations || '',
        fallback: !usingTavily,
        source: usingTavily ? 'tavily+groq' : 'groq-only',
      })
    }

    // Dernier recours — retourner au moins la liste sans prix
    return NextResponse.json({
      success: true,
      materials: rawMaterials.map(m => ({
        ...m,
        prices: [],
        bestPrice: null,
        avgPrice: 0,
      })),
      totalEstimate: null,
      response: `J'ai identifié **${rawMaterials.length} matériaux** pour votre chantier "${query}", mais je n'ai pas pu récupérer les prix cette fois. Réessayez dans quelques instants.`,
      recommendations: '',
      fallback: true,
      source: 'groq-list-only',
    })

  } catch (error: any) {
    console.error('Materiaux AI error:', error)
    return NextResponse.json({ error: error.message || 'Erreur serveur', fallback: true }, { status: 500 })
  }
}
