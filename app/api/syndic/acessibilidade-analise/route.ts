// app/api/syndic/acessibilidade-analise/route.ts
// Phase C — Alfredo : diagnostic d'accessibilité d'un edifício (DL 163/2006).
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

export async function POST(req: NextRequest) {
  const gate = await gateSyndic(req, 'acess-analise')
  if (!gate.ok) return gate.res

  const body = await req.json().catch(() => ({}))
  const edificio: string = typeof body.edificio === 'string' ? body.edificio.trim() : ''
  const notas: string = typeof body.notas === 'string' ? body.notas : ''
  if (!edificio) return NextResponse.json({ error: 'Indique o edifício' }, { status: 400 })

  try {
    const analise = await callAlfredo(gate.user.id, {
      system: SYSTEM,
      user: `Edifício: ${edificio}${notas ? `\nObservações do síndico: ${notas}` : ''}\n\nFaz o diagnóstico de acessibilidade e o plano de correção.`,
      prompt: `acessibilidade ${edificio}`,
      maxTokens: 1800,
    })
    return NextResponse.json({ analise })
  } catch (err) {
    logger.error('[syndic/acessibilidade-analise] error:', err)
    return NextResponse.json({ error: 'Erro ao analisar a acessibilidade' }, { status: 500 })
  }
}
