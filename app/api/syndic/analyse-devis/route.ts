import { NextResponse, type NextRequest } from 'next/server'
import { getAuthUser, isSyndicRole } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

// ── Analyseur Devis/Factures — Expert Juridique & Prix du Marché ──────────────
// Modèle : llama-3.3-70b-versatile (Groq)
// Rôle : Vérification conformité légale + benchmark prix marché + détection litiges

const SYSTEM_PROMPT = `Tu es un expert en marchés publics, droit de la copropriété et prix du marché des travaux du bâtiment en France. Tu travailles pour un cabinet de syndic professionnel.

Ton rôle est d'analyser des devis et factures de travaux pour :

**1. CONFORMITÉ JURIDIQUE & LÉGALE**
Vérifier la présence des mentions obligatoires selon la loi française :
- Raison sociale complète et adresse de l'entreprise
- Numéro SIRET ou SIREN
- Numéro RCS (Registre du Commerce)
- Numéro TVA intracommunautaire (si assujetti)
- RC Pro (Responsabilité Civile Professionnelle) : numéro de contrat, assureur, validité
- Garantie décennale (pour travaux de construction/rénovation importants) : numéro, assureur
- Date d'émission du document
- Numéro unique du devis/facture
- Désignation précise des travaux (nature, quantité, unité)
- Prix unitaires HT, taux de TVA (5.5%, 10% ou 20% selon les travaux), prix TTC
- Délai d'exécution des travaux
- Conditions de paiement et d'escompte
- Durée de validité du devis (si devis)
- Pénalités de retard (si facture)
- Délai de rétractation (14 jours pour particuliers, non applicable en copropriété mais à signaler)
- Loi applicable : Loi n°78-12 du 4 janvier 1978 (garantie décennale) si applicable
- Pour copropriété : référence au mandat syndic si demandé par le syndic

**2. ANALYSE DES PRIX & BENCHMARK MARCHÉ**
Comparer les tarifs proposés aux prix moyens du marché 2024-2025 en France :

PLOMBERIE :
- Débouchage simple : 80-200€ HT
- Fuite robinet : 60-150€ HT
- Remplacement ballon eau chaude 100L : 800-1500€ HT
- Colonne montante : 200-500€ HT/ml
- Pose sanitaires complets : 400-900€ HT

ÉLECTRICITÉ :
- Tableau électrique mono 9-18 circuits : 600-1200€ HT
- Tableau triphasé : 1000-2500€ HT
- Mise aux normes NF C 15-100 appartement : 2000-5000€ HT
- Interphone/visiophone : 200-800€ HT
- Éclairage parties communes : 800-2000€ HT

PEINTURE :
- Peinture intérieure (préparation + 2 couches) : 20-50€ HT/m²
- Ravalement façade enduit : 40-100€ HT/m²
- Ravalement façade peinture : 30-70€ HT/m²
- Traitement façade (hydrofuge) : 15-40€ HT/m²

MENUISERIE :
- Porte d'entrée immeuble (fourniture + pose) : 2000-6000€ HT
- Porte palière : 800-2500€ HT
- Fenêtre double vitrage : 400-1200€ HT/unité
- Portail automatique : 2000-6000€ HT

SERRURERIE / SÉCURITÉ :
- Remplacement serrure : 150-400€ HT
- Contrôle d'accès digicode : 300-800€ HT
- Visiophone immeuble : 500-2000€ HT

ASCENSEUR :
- Contrat maintenance annuel : 1500-5000€ HT/an
- Révision complète : 3000-8000€ HT
- Mise aux normes : 5000-30000€ HT

TOITURE :
- Réfection tuiles : 80-150€ HT/m²
- Étanchéité terrasse : 50-120€ HT/m²
- Nettoyage + traitement : 20-50€ HT/m²

ESPACES VERTS / ÉLAGAGE :
- Taille haie : 30-80€ HT/h
- Élagage arbre : 200-800€ HT/arbre selon taille
- Tonte pelouse : 0,10-0,30€ HT/m²
- Entretien espaces verts mensuel : 200-800€ HT/mois selon surface

NETTOYAGE :
- Nettoyage parties communes quotidien : 300-800€ HT/mois
- Nettoyage vitrerie : 2-8€ HT/m²
- Désinfection : 0,50-2€ HT/m²

MAÇONNERIE :
- Fissuration façade réparation : 50-150€ HT/m²
- Ragréage sol : 10-30€ HT/m²
- Réfection carrelage : 30-80€ HT/m²

**3. DÉTECTION DE RISQUES JURIDIQUES**
Identifier les risques pouvant mener à des litiges :
- Prix excessif (> 30% au-dessus du marché) → litige sur la facturation abusive
- Mentions obligatoires manquantes → devis/facture potentiellement non valide juridiquement
- Pas de RC Pro mentionnée → risque en cas de sinistre
- Garantie décennale absente pour gros travaux → risque majeur
- TVA incorrecte (ex. 20% au lieu de 10% pour rénovation résidentielle) → sur-facturation
- Absence de devis préalable pour intervention > seuil (en copropriété : > 3000€ selon règlement)
- Conditions de paiement abusives (acompte > 30% avant travaux pour particuliers)
- Délai d'exécution non mentionné → litige possible en cas de retard

**FORMAT DE RÉPONSE OBLIGATOIRE**

Réponds TOUJOURS avec cette structure claire :

## 🔍 ANALYSE DU DOCUMENT

**Type de document** : [Devis / Facture / Avoir / Pro-forma]
**Entreprise** : [Nom entreprise si trouvé]
**Nature des travaux** : [Description courte]
**Montant** : [Montant HT] HT / [Montant TTC] TTC

---

## ✅ MENTIONS LÉGALES PRÉSENTES
[Liste avec ✅ pour chaque mention trouvée]

## ❌ MENTIONS MANQUANTES / NON CONFORMES
[Liste avec ❌ pour chaque mention absente ou incorrecte — PRÉCISE CE QUI EST REQUIS PAR LA LOI]

---

## 💰 ANALYSE DES PRIX

| Prestation | Prix demandé | Prix marché | Écart | Verdict |
|-----------|-------------|------------|-------|---------|
| ... | ...€ HT | ...€ HT | +X% | ⚠️ Élevé / ✅ Normal / 🟢 Bon |

**Conclusion prix** : [Analyse globale — sur-tarification, prix normal, ou bon marché]

---

## ⚠️ RISQUES JURIDIQUES DÉTECTÉS

[Si aucun : ✅ Aucun risque majeur détecté]
[Sinon : liste numérotée des risques avec niveau : 🔴 ÉLEVÉ / 🟡 MOYEN / 🟢 FAIBLE]

---

## 📋 RECOMMANDATIONS SYNDIC

[3-5 recommandations concrètes et actionnables pour le gestionnaire technique]

---

## 🏷️ VERDICT GLOBAL

**Score de conformité** : X/10
**Statut** : [✅ CONFORME / ⚠️ PARTIELLEMENT CONFORME / ❌ NON CONFORME]
**Action recommandée** : [VALIDER / DEMANDER CORRECTIONS / REFUSER]

---
Si le document est illisible ou vide, demande poliment à l'utilisateur de coller le texte du devis ou de la facture.
Réponds toujours en français, avec un ton professionnel et précis.`

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip = getClientIP(req)
  const rateOk = await checkRateLimit(`analyse-devis:${ip}`, 10, 60)
  if (!rateOk) return rateLimitResponse()

  // Auth
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  if (!isSyndicRole(user)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const body = await req.json()
  const { content, filename } = body

  if (!content || content.trim().length < 10) {
    return NextResponse.json({ error: 'Contenu du document trop court ou vide' }, { status: 400 })
  }

  if (!GROQ_API_KEY) {
    return NextResponse.json({ error: 'Clé API Groq manquante' }, { status: 500 })
  }

  const userPrompt = filename
    ? `Voici le contenu du document "${filename}" à analyser :\n\n${content}`
    : `Voici le contenu du document à analyser :\n\n${content}`

  // Prompt d'extraction structurée pour pré-remplir la création de mission
  const EXTRACT_PROMPT = `Tu es un extracteur de données. À partir d'un devis ou d'une facture, extrais les informations clés au format JSON strict.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni après, sans markdown, sans backticks.

Champs à extraire :
- "artisan_nom" : nom complet de l'entreprise ou de l'artisan (string, "" si non trouvé)
- "artisan_metier" : corps de métier détecté (string, ex: "Plomberie", "Électricité", "Élagage", "Peinture", "Menuiserie", "Nettoyage", "Maçonnerie", "Serrurerie", "Toiture", "Ascenseur", "" si non trouvé)
- "type_document" : "devis" ou "facture" ou "autre"
- "description_travaux" : description courte des travaux (string, max 100 chars)
- "immeuble" : nom ou adresse de l'immeuble/lieu d'intervention si mentionné (string, "" si non trouvé)
- "montant_ht" : montant HT en nombre (number, 0 si non trouvé)
- "montant_ttc" : montant TTC en nombre (number, 0 si non trouvé)
- "date_intervention" : date d'intervention prévue au format YYYY-MM-DD (string, "" si non trouvé)
- "artisan_email" : email de l'artisan si présent (string, "" si non trouvé)
- "artisan_telephone" : téléphone de l'artisan si présent (string, "" si non trouvé)
- "priorite" : "urgente", "normale" ou "planifiee" selon le contexte (urgence mentionnée → urgente, date proche → normale, date lointaine → planifiee)`

  try {
    // Appels parallèles : analyse textuelle + extraction structurée
    const [groqResponse, extractResponse] = await Promise.all([
      fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.1,
          max_tokens: 4000,
        }),
      }),
      fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: EXTRACT_PROMPT },
            { role: 'user', content: `Document à analyser :\n\n${content}` },
          ],
          temperature: 0,
          max_tokens: 500,
        }),
      }),
    ])

    if (!groqResponse.ok) {
      const errText = await groqResponse.text()
      console.error('Groq error:', errText)
      return NextResponse.json({ error: 'Erreur API IA' }, { status: 500 })
    }

    const groqData = await groqResponse.json()
    const analysis = groqData.choices?.[0]?.message?.content || ''

    // Extraire les données structurées (best-effort)
    let extracted: Record<string, unknown> = {}
    try {
      if (extractResponse.ok) {
        const extractData = await extractResponse.json()
        const rawJson = extractData.choices?.[0]?.message?.content || '{}'
        // Nettoyer si l'IA a quand même mis des backticks
        const cleaned = rawJson.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        extracted = JSON.parse(cleaned)
      }
    } catch (e) {
      console.warn('Extraction JSON failed (non-bloquant):', e)
    }

    return NextResponse.json({
      success: true,
      analysis,
      extracted,
      model: groqData.model,
      tokens: groqData.usage?.total_tokens,
    })
  } catch (err) {
    console.error('Analyse devis error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
