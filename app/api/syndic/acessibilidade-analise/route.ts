// app/api/syndic/acessibilidade-analise/route.ts
// Phase C — Alfredo : diagnostic d'accessibilité d'un edifício (DL 163/2006).
// Version française (corps avec locale: 'fr', envoyé par /fr/syndic/v54) : droit français de
// l'accessibilité (loi n° 2005-102, CCH ; travaux en copropriété, art. 24 et 25-2 de la loi du
// 10 juillet 1965). Sans locale 'fr', prompt et réponses portugais inchangés.
import { NextResponse, type NextRequest } from 'next/server'
import { gateSyndic, callAlfredo } from '@/lib/syndic/v54/alfredo'
import { logger } from '@/lib/logger'

export const maxDuration = 30

const SYSTEM = `És o Alfredo, especialista em acessibilidade de edifícios em Portugal (DL 163/2006, normas técnicas).
Fazes um diagnóstico de acessibilidade de um edifício de habitação e propões um plano de correção.
Avalia os critérios principais: rampas exteriores (inclinação ≤ 6%), largura de portas (≥ 0,77m), elevador acessível (cabine ≥ 1,10×1,40m), instalação sanitária adaptada nas partes comuns, sinalética tátil, percurso acessível contínuo, estacionamento reservado.
Estrutura (markdown):
1. Estado geral (Conforme / Parcialmente conforme / Não conforme)
2. Avaliação por critério (com ✅ / ⚠️ / ❌)
3. Plano de correção priorizado (ações + prioridade)
4. Estimativa de esforço/investimento (ordem de grandeza)
Português europeu, tom profissional. Indica claramente que é uma pré-avaliação a confirmar no local.`

const SYSTEM_FR = `Tu es Alfredo, spécialiste de l'accessibilité des immeubles d'habitation en copropriété en France.
Tu réalises une pré-évaluation de l'accessibilité des parties communes d'un immeuble d'habitation collectif et tu proposes un plan de mise en accessibilité.
Cadre juridique à appliquer (droit français uniquement) :
- loi n° 2005-102 du 11 février 2005 et règles d'accessibilité du Code de la construction et de l'habitation : elles s'imposent aux bâtiments d'habitation collectifs neufs et aux travaux réalisés dans les bâtiments existants ; un immeuble existant sans travaux n'a pas d'obligation générale de mise en conformité ;
- loi n° 65-557 du 10 juillet 1965, article 24 : les travaux d'accessibilité aux personnes handicapées ou à mobilité réduite qui n'affectent ni la structure de l'immeuble ni ses éléments d'équipement essentiels sont votés à la majorité de l'article 24 ;
- article 25-2 de la même loi : un copropriétaire peut faire réaliser à ses frais des travaux d'accessibilité affectant les parties communes ou l'aspect extérieur de l'immeuble ; il en informe l'assemblée générale par l'intermédiaire du syndic, et l'assemblée ne peut s'y opposer que par une décision motivée prise à la majorité de l'article 25.
Évalue les critères principaux : cheminement extérieur et rampes, largeur de passage des portes, ascenseur accessible (dimensions de cabine, commandes), éclairage des circulations communes, signalétique et contrastes, cheminement accessible continu, stationnement adapté.
Ne cite aucune valeur chiffrée ni aucun numéro d'article dont tu n'es pas certain : renvoie dans ce cas aux arrêtés d'application du Code de la construction et de l'habitation.
Structure (markdown) :
1. État général (Conforme / Partiellement conforme / Non conforme)
2. Évaluation par critère (avec ✅ / ⚠️ / ❌)
3. Plan de mise en accessibilité priorisé (actions, priorité, majorité d'assemblée générale requise)
4. Estimation de l'effort et de l'investissement (ordre de grandeur)
Réponds en français, en vouvoyant le syndic, sur un ton professionnel. Indique clairement qu'il s'agit d'une pré-évaluation à confirmer sur place par un professionnel.`

export async function POST(req: NextRequest) {
  const gate = await gateSyndic(req, 'acess-analise')
  if (!gate.ok) return gate.res

  const body = await req.json().catch(() => ({}))
  const edificio: string = typeof body.edificio === 'string' ? body.edificio.trim() : ''
  const notas: string = typeof body.notas === 'string' ? body.notas : ''
  const fr = body.locale === 'fr'
  if (!edificio) return NextResponse.json({ error: fr ? "Indiquez l'immeuble" : 'Indique o edifício' }, { status: 400 })

  try {
    const analise = await callAlfredo(gate.user.id, {
      system: fr ? SYSTEM_FR : SYSTEM,
      user: fr
        ? `Immeuble : ${edificio}${notas ? `\nObservations du syndic : ${notas}` : ''}\n\nRéalisez le diagnostic d'accessibilité des parties communes et le plan de mise en accessibilité.`
        : `Edifício: ${edificio}${notas ? `\nObservações do síndico: ${notas}` : ''}\n\nFaz o diagnóstico de acessibilidade e o plano de correção.`,
      prompt: `acessibilidade ${edificio}`,
      maxTokens: 1800,
    })
    return NextResponse.json({ analise })
  } catch (err) {
    logger.error('[syndic/acessibilidade-analise] error:', err)
    return NextResponse.json({ error: fr ? "Erreur lors de l'analyse de l'accessibilité" : 'Erro ao analisar a acessibilidade' }, { status: 500 })
  }
}
