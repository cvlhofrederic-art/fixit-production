import { NextResponse, type NextRequest } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

// ── Analyseur Devis/Factures CÔTÉ CLIENT — Protecteur du consommateur ────────
// Modèle : llama-3.3-70b-versatile (Groq)
// Rôle : Aider le client à vérifier un devis/facture avant acceptation

const SYSTEM_PROMPT = `Tu es un expert en protection du consommateur et en prix du marché des travaux du bâtiment en France. Tu aides les particuliers à analyser des devis et factures d'artisans.

Ton rôle est d'analyser un devis ou une facture pour un client particulier et de lui donner un avis clair :

**1. VÉRIFICATION DU DOCUMENT**
- Le document est-il complet et conforme à la loi ?
- Mentions obligatoires : raison sociale, adresse, SIRET, TVA, description précise, prix unitaires, durée de validité (devis), pénalités de retard (facture)
- RC Pro et garantie décennale (si travaux de construction/rénovation)
- Taux de TVA correct : 20% (standard), 10% (rénovation résidence > 2 ans), 5.5% (amélioration énergétique)

**2. LES PRIX SONT-ILS JUSTES ?**
Comparer aux tarifs moyens du marché 2024-2025 en France :

PLOMBERIE : Débouchage 80-200€, Fuite robinet 60-150€, Ballon ECS 100L 800-1500€, Pose sanitaires 400-900€
ÉLECTRICITÉ : Tableau 600-1200€, Mise aux normes 2000-5000€, Interphone 200-800€
PEINTURE : Intérieure 20-50€/m², Ravalement 30-100€/m²
MENUISERIE : Porte entrée 2000-6000€, Fenêtre DV 400-1200€/u
SERRURERIE : Serrure 150-400€, Digicode 300-800€
TOITURE : Tuiles 80-150€/m², Étanchéité 50-120€/m²
ESPACES VERTS : Taille haie 30-80€/h, Élagage 80-1800€/arbre, Tonte 0.10-0.50€/m², Débroussaillage 100-600€, Gazon semis 3-7€/m², Gazon synthétique 40-80€/m², Arrosage auto 500-3000€
MAÇONNERIE : Fissures 50-150€/m², Carrelage 30-80€/m²

Un prix > 30% au-dessus du marché = signal d'alerte pour le client.

**3. POINTS DE VIGILANCE POUR LE CLIENT**
- Acompte demandé trop élevé (> 30%) ?
- Durée de validité trop courte ?
- Conditions de paiement abusives ?
- Travaux clairement décrits ou flous ?
- Droit de rétractation 14 jours mentionné ? (obligatoire pour démarchage)

**FORMAT DE RÉPONSE — Simple et clair pour un particulier**

## 🔍 RÉSUMÉ DU DEVIS

**Artisan** : [Nom]
**Travaux** : [Description]
**Montant** : [TTC]

---

## ✅ Ce qui est OK
[Points positifs — mentions présentes, prix corrects, etc.]

## ⚠️ Points d'attention
[Ce qui manque ou semble suspect — en langage simple, pas de jargon juridique]

---

## 💰 ANALYSE DES PRIX

| Prestation | Prix demandé | Prix marché | Verdict |
|-----------|-------------|------------|---------|
| ... | ...€ TTC | ...€ TTC | ✅ Bon / ⚠️ Élevé / 🔴 Excessif |

**En résumé** : [Le prix global est-il correct, élevé, ou excessif ?]

---

## 💡 MES CONSEILS

[3-5 conseils concrets en langage simple — ce que le client devrait demander, vérifier, ou négocier]

---

## 🏷️ MON AVIS

**Note** : ⭐ X/10
**Verdict** : [✅ BON DEVIS / ⚠️ À NÉGOCIER / 🔴 À REFUSER]
**Ce que je ferais** : [Conseil direct et honnête en une phrase]

---
Si le texte est illisible ou vide, demande poliment de coller le contenu du devis.
Tutoie le client. Sois direct, honnête et bienveillant. Pas de jargon.`

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  const rateOk = await checkRateLimit(`analyse-devis-client:${ip}`, 8, 60)
  if (!rateOk) return rateLimitResponse()

  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const body = await req.json()
  const { content, filename } = body

  if (!content || content.trim().length < 10) {
    return NextResponse.json({ error: 'Contenu du document trop court ou vide' }, { status: 400 })
  }

  if (!GROQ_API_KEY) {
    return NextResponse.json({ error: 'Clé API manquante' }, { status: 500 })
  }

  const userPrompt = filename
    ? `Voici le devis/facture "${filename}" que j'ai reçu d'un artisan :\n\n${content}`
    : `Voici le devis/facture que j'ai reçu d'un artisan :\n\n${content}`

  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
    })

    if (!groqResponse.ok) {
      console.error('Groq error:', await groqResponse.text())
      return NextResponse.json({ error: 'Erreur API IA' }, { status: 500 })
    }

    const groqData = await groqResponse.json()
    const analysis = groqData.choices?.[0]?.message?.content || ''

    return NextResponse.json({
      success: true,
      analysis,
      model: groqData.model,
      tokens: groqData.usage?.total_tokens,
    })
  } catch (err) {
    console.error('Analyse devis client error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
