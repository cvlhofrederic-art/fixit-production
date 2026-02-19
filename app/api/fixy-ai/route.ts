import { NextResponse, type NextRequest } from 'next/server'

// Fixy AI — Traitement intelligent des messages via Groq (gratuit, Llama 3)
// L'IA comprend le langage naturel et extrait les données structurées

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

type ClientInfo = {
  name: string
  email: string
  phone: string
  address: string
  siret: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, clients, services, bookings, artisanName } = body

    if (!message) {
      return NextResponse.json({ error: 'Message requis' }, { status: 400 })
    }

    if (!GROQ_API_KEY) {
      // Fallback: retourner un parsing basique si pas de clé API
      return NextResponse.json({ error: 'GROQ_API_KEY non configurée', fallback: true })
    }

    // Construire le contexte pour l'IA
    const clientList = (clients || []).map((c: ClientInfo) =>
      `- ${c.name}${c.phone ? ` (Tél: ${c.phone})` : ''}${c.email ? ` (Email: ${c.email})` : ''}${c.address ? ` (Adresse: ${c.address})` : ''}${c.siret ? ` (SIRET: ${c.siret})` : ''}`
    ).join('\n')

    const serviceList = (services || []).map((s: any) =>
      `- ${s.name}: ${s.price_ttc ? s.price_ttc + '€ TTC' : 'prix libre'}${s.duration_minutes ? ` (${s.duration_minutes} min)` : ''}`
    ).join('\n')

    const upcomingBookings = (bookings || [])
      .filter((b: any) => b.booking_date >= new Date().toISOString().split('T')[0] && b.status !== 'cancelled')
      .slice(0, 10)
      .map((b: any) => {
        const notes = b.notes || ''
        const clientMatch = notes.match(/Client:\s*([^|.]+)/)
        const clientName = clientMatch ? clientMatch[1].trim() : 'Client inconnu'
        return `- ${b.booking_date} à ${b.booking_time?.substring(0, 5) || '?'}: ${b.services?.name || 'Intervention'} avec ${clientName} (${b.status})`
      }).join('\n')

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
    const todayDayName = dayNames[today.getDay()]

    const systemPrompt = `Tu es Fixy, l'assistant IA personnel de ${artisanName || "l'artisan"} sur la plateforme Fixit.
Tu es un petit robot sympa avec une clé à molette 🔧. Tu parles en français, tu es efficace et amical.

📅 Aujourd'hui c'est ${todayDayName} ${today.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}.

Tu dois analyser le message de l'artisan et extraire les informations structurées.

CLIENTS DE L'ARTISAN :
${clientList || '(Aucun client enregistré)'}

SERVICES/MOTIFS DE L'ARTISAN :
${serviceList || '(Aucun service configuré)'}

PROCHAINS RDV :
${upcomingBookings || '(Aucun RDV à venir)'}

IMPORTANT - Tu dois TOUJOURS répondre en JSON valide avec cette structure exacte :
{
  "intent": "create_rdv" | "create_devis" | "create_facture" | "list_rdv" | "help" | "chat",
  "data": {
    "clientName": "nom complet du client si mentionné",
    "clientMatch": true/false (si le client a été trouvé dans la base clients),
    "clientEmail": "email du client si trouvé dans la base",
    "clientPhone": "téléphone du client si trouvé dans la base",
    "clientAddress": "adresse du client si trouvé dans la base",
    "clientSiret": "siret du client si trouvé dans la base",
    "date": "YYYY-MM-DD si mentionné",
    "time": "HH:MM si mentionné",
    "service": "nom du service/motif",
    "amount": nombre en euros TTC si mentionné,
    "address": "adresse de l'intervention si mentionné",
    "description": "description libre de la prestation"
  },
  "response": "Ta réponse naturelle à l'artisan (avec **gras** pour les infos importantes, courte et efficace)",
  "needsConfirmation": true/false (si tu as assez d'infos pour agir),
  "missingFields": ["liste des champs manquants si needed"]
}

RÈGLES :
1. Si l'artisan mentionne un client, cherche TOUJOURS dans la base clients (par nom, même partiel/approximatif).
2. Si le client est trouvé, remplis TOUTES ses infos (email, phone, address, siret).
3. Pour les dates relatives : "demain" = lendemain de ${todayStr}, "mardi" = prochain mardi, etc.
4. Pour les montants : "150€" ou "150 euros" = amount: 150 (TTC).
5. "motif élagage" ou "pour élagage" = service: "Élagage".
6. Si un "motif" est donné mais ne correspond à aucun service existant, utilise-le tel quel comme nom de service.
7. Sois toujours positif et utilise des emojis.
8. Pour "help", "aide", "bonjour" → intent: "help".
9. Pour une question ou conversation générale → intent: "chat".
10. NE JAMAIS inclure de texte avant ou après le JSON.`

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        temperature: 0.3,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
      }),
    })

    if (!groqResponse.ok) {
      const errText = await groqResponse.text()
      console.error('Groq API error:', groqResponse.status, errText)
      return NextResponse.json({ error: 'Erreur API IA', fallback: true })
    }

    const groqData = await groqResponse.json()
    const content = groqData.choices?.[0]?.message?.content || ''

    try {
      const parsed = JSON.parse(content)
      return NextResponse.json({ success: true, ...parsed })
    } catch {
      console.error('Failed to parse Groq response:', content)
      return NextResponse.json({ error: 'Réponse IA invalide', fallback: true, raw: content })
    }

  } catch (error: any) {
    console.error('Fixy AI error:', error)
    return NextResponse.json({ error: error.message || 'Erreur serveur', fallback: true })
  }
}
