// app/api/syndic/seg-edificio-plano/route.ts
// Phase C — Alfredo : génère un plano de emergência RT-SCIE (DL 220/2008) pour un edifício.
import { NextResponse, type NextRequest } from 'next/server'
import { gateSyndic, callAlfredo } from '@/lib/syndic/v54/alfredo'
import { logger } from '@/lib/logger'

export const maxDuration = 30

const SYSTEM = `És o Alfredo, especialista em Segurança Contra Incêndio em Edifícios (SCIE) em Portugal (DL 220/2008 — RSCIE, Portaria 1532/2008 — RT-SCIE).
Geras um plano de emergência adaptado a um edifício de habitação (utilização-tipo I), pronto a 70% para o Encarregado de Segurança rever.
Estrutura obrigatória (markdown, secções numeradas):
1. Identificação do edifício e enquadramento legal
2. Categoria de risco e implicações
3. Organização de segurança (Encarregado, delegados de piso)
4. Procedimentos em caso de emergência (deteção, alarme, evacuação)
5. Plano de evacuação e pontos de encontro
6. Meios de 1.ª intervenção e sua localização
7. Exercícios de evacuação e formação (periodicidade)
8. Registos de segurança a manter
Português europeu, tom profissional. Conciso mas completo.`

export async function POST(req: NextRequest) {
  const gate = await gateSyndic(req, 'seg-plano')
  if (!gate.ok) return gate.res

  const body = await req.json().catch(() => ({}))
  const edificio: string = typeof body.edificio === 'string' ? body.edificio.trim() : ''
  const categoria: string = typeof body.categoria === 'string' ? body.categoria : '1'
  const encarregado: string = typeof body.encarregado === 'string' ? body.encarregado : ''
  if (!edificio) return NextResponse.json({ error: 'Indique o edifício' }, { status: 400 })

  try {
    const plano = await callAlfredo(gate.user.id, {
      system: SYSTEM,
      user: `Edifício: ${edificio}\nCategoria de risco SCIE: ${categoria}\nEncarregado de Segurança: ${encarregado || '(a designar)'}\n\nGera o plano de emergência completo.`,
      prompt: `plano emergência ${edificio}`,
      maxTokens: 1800,
    })
    return NextResponse.json({ plano })
  } catch (err) {
    logger.error('[syndic/seg-edificio-plano] error:', err)
    return NextResponse.json({ error: 'Erro ao gerar o plano de emergência' }, { status: 500 })
  }
}
