'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { AgentChatPage } from '@/components/syndic-dashboard/v54/primitives/agent-chat-page'
import { DashboardShell, AGENT_ROUTES, SIDE_TITLES } from '@/components/syndic-dashboard/v54/shell'
import ModDashboard from '@/components/syndic-dashboard/v54/modules/ModDashboard'
import ModOrdens from '@/components/syndic-dashboard/v54/modules/ModOrdens'
import ModProfissionais from '@/components/syndic-dashboard/v54/modules/ModProfissionais'
import ModEdificios from '@/components/syndic-dashboard/v54/modules/ModEdificios'
import ModEquipa from '@/components/syndic-dashboard/v54/modules/ModEquipa'
import ModCondominos from '@/components/syndic-dashboard/v54/modules/ModCondominos'
import ModDocsInterv from '@/components/syndic-dashboard/v54/modules/ModDocsInterv'
import ModContabTec from '@/components/syndic-dashboard/v54/modules/ModContabTec'
import ModFaturacao from '@/components/syndic-dashboard/v54/modules/ModFaturacao'
import ModAlertas from '@/components/syndic-dashboard/v54/modules/ModAlertas'
import ModCalReg from '@/components/syndic-dashboard/v54/modules/ModCalReg'
import ModDocsGED from '@/components/syndic-dashboard/v54/modules/ModDocsGED'
import ModRelatorioMensal from '@/components/syndic-dashboard/v54/modules/ModRelatorioMensal'
import ModAnaliseOrc from '@/components/syndic-dashboard/v54/modules/ModAnaliseOrc'
import ModSeguros from '@/components/syndic-dashboard/v54/modules/ModSeguros'
import ModProcLote from '@/components/syndic-dashboard/v54/modules/ModProcLote'
import ModAGLive from '@/components/syndic-dashboard/v54/modules/ModAGLive'
import ModAtasIA from '@/components/syndic-dashboard/v54/modules/ModAtasIA'
import ModPagDigitais from '@/components/syndic-dashboard/v54/modules/ModPagDigitais'
import ModVotacaoOnline from '@/components/syndic-dashboard/v54/modules/ModVotacaoOnline'
import ModPrepAss from '@/components/syndic-dashboard/v54/modules/ModPrepAss'
import ModPlanoMan from '@/components/syndic-dashboard/v54/modules/ModPlanoMan'
import ModVistoria from '@/components/syndic-dashboard/v54/modules/ModVistoria'
import ModContacto from '@/components/syndic-dashboard/v54/modules/ModContacto'
import ModPredicao from '@/components/syndic-dashboard/v54/modules/ModPredicao'
import ModQRCode from '@/components/syndic-dashboard/v54/modules/ModQRCode'
import ModDashCond from '@/components/syndic-dashboard/v54/modules/ModDashCond'
import ModSinistros from '@/components/syndic-dashboard/v54/modules/ModSinistros'
import ModPreparadorAG from '@/components/syndic-dashboard/v54/modules/ModPreparadorAG'
import ModLancamentoFat from '@/components/syndic-dashboard/v54/modules/ModLancamentoFat'
import ModEmailsFixy from '@/components/syndic-dashboard/v54/modules/ModEmailsFixy'
import ModMultiImoveis from '@/components/syndic-dashboard/v54/modules/ModMultiImoveis'
import ModCobrJud from '@/components/syndic-dashboard/v54/modules/ModCobrJud'
import ModCarregamentoVE from '@/components/syndic-dashboard/v54/modules/ModCarregamentoVE'
import ModPortal from '@/components/syndic-dashboard/v54/modules/ModPortal'
import ModComparadorEnergia from '@/components/syndic-dashboard/v54/modules/ModComparadorEnergia'
import ModCobrAuto from '@/components/syndic-dashboard/v54/modules/ModCobrAuto'
import ModAssinaturaCMD from '@/components/syndic-dashboard/v54/modules/ModAssinaturaCMD'
import ModRelGestao from '@/components/syndic-dashboard/v54/modules/ModRelGestao'
import ModDefinicoes from '@/components/syndic-dashboard/v54/modules/ModDefinicoes'

const MASCOT =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2064%2064'%3E%3Ccircle%20cx='32'%20cy='32'%20r='30'%20fill='%23C9A574'/%3E%3Ccircle%20cx='24'%20cy='28'%20r='4'%20fill='%230B1828'/%3E%3Ccircle%20cx='40'%20cy='28'%20r='4'%20fill='%230B1828'/%3E%3Cpath%20d='M22%2040%20q10%2010%2020%200'%20stroke='%230B1828'%20stroke-width='3'%20fill='none'%20stroke-linecap='round'/%3E%3C/svg%3E"

const AGENTS: Record<string, { name: string; title: string; intro: string }> = {
  fixy: { name: 'Fixy', title: 'Assistente IA de manutenção', intro: 'Olá! Em que posso ajudar na manutenção hoje?' },
  max: { name: 'Max Expert', title: 'Especialista técnico IA', intro: 'Pergunte-me sobre normas, técnica e diagnósticos.' },
  lea: { name: 'Léa', title: 'Assistente contabilística IA', intro: 'Vamos tratar das contas do condomínio?' },
  alfredo: { name: 'Alfredo', title: 'Agente de e-mails IA', intro: 'Eu trato da sua correspondência com os condóminos.' },
  tempo: { name: 'Tempo', title: 'Planeamento IA', intro: 'Organizo a sua agenda, prazos e calendário.' },
}

function Placeholder({ route }: Readonly<{ route: string }>) {
  return (
    <div>
      <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--v54-gold-700)', fontWeight: 600 }}>Módulo</p>
      <h1 style={{ fontFamily: 'var(--v54-font-serif)', fontWeight: 500, fontSize: 30, margin: '4px 0 0' }}>{SIDE_TITLES[route] ?? route}</h1>
      <div style={{ marginTop: 40, padding: '60px 24px', textAlign: 'center', border: '1px dashed var(--v54-line-strong)', borderRadius: 'var(--v54-r-lg)', background: '#fff' }}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--v54-navy-500)' }}>Conteúdo deste módulo em desenvolvimento (Phase 2).</p>
        <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--v54-navy-300)' }}>A coquilha (shell) e a navegação estão funcionais.</p>
      </div>
    </div>
  )
}

function renderModule(route: string): ReactNode {
  if (route === 'dashboard') return <ModDashboard />
  if (route === 'ordens') return <ModOrdens />
  if (route === 'profissionais') return <ModProfissionais />
  if (route === 'edificios') return <ModEdificios />
  if (route === 'equipa') return <ModEquipa />
  if (route === 'condominos') return <ModCondominos />
  if (route === 'docsInterv') return <ModDocsInterv />
  if (route === 'contabTec') return <ModContabTec />
  if (route === 'faturacao') return <ModFaturacao />
  if (route === 'alertas') return <ModAlertas />
  if (route === 'calReg') return <ModCalReg />
  if (route === 'docsGED') return <ModDocsGED />
  if (route === 'relMensal') return <ModRelatorioMensal />
  if (route === 'analiseOrc') return <ModAnaliseOrc />
  if (route === 'seguros') return <ModSeguros />
  if (route === 'procLote') return <ModProcLote />
  if (route === 'agLive') return <ModAGLive />
  if (route === 'atasIA') return <ModAtasIA />
  if (route === 'pagDigitais') return <ModPagDigitais />
  if (route === 'votacaoOnline') return <ModVotacaoOnline />
  if (route === 'prepAss') return <ModPrepAss />
  if (route === 'planoMan') return <ModPlanoMan />
  if (route === 'vistoria') return <ModVistoria />
  if (route === 'contacto') return <ModContacto />
  if (route === 'predicao') return <ModPredicao />
  if (route === 'qrcode') return <ModQRCode />
  if (route === 'dashCond') return <ModDashCond />
  if (route === 'sinistros') return <ModSinistros />
  if (route === 'preparadorAG') return <ModPreparadorAG />
  if (route === 'lancFat') return <ModLancamentoFat />
  if (route === 'emailsFixy') return <ModEmailsFixy />
  if (route === 'multiImoveis') return <ModMultiImoveis />
  if (route === 'cobrJud') return <ModCobrJud />
  if (route === 'carregamentoVE') return <ModCarregamentoVE />
  if (route === 'portal') return <ModPortal />
  if (route === 'compEnergia') return <ModComparadorEnergia />
  if (route === 'cobrAuto') return <ModCobrAuto />
  if (route === 'assinaturaCMD') return <ModAssinaturaCMD />
  if (route === 'relGestao') return <ModRelGestao />
  if (route === 'definicoes') return <ModDefinicoes />
  if (AGENT_ROUTES.has(route)) {
    const a = AGENTS[route]
    return (
      <AgentChatPage
        mascot={MASCOT}
        name={a.name}
        title={a.title}
        intro={a.intro}
        introDetail="Demo do design system v54 — as respostas IA serão ligadas na Phase 2."
        suggestions={['Resumir a última ata', 'Quotas em atraso este mês', 'Estado das obras em curso']}
        conversations={[
          { id: '1', title: 'Orçamento elevador', bucket: 'ontem' },
          { id: '2', title: 'Infiltração garagem -2', bucket: 'esta-semana' },
        ]}
      />
    )
  }
  return <Placeholder route={route} />
}

export default function DashboardV54Preview() {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    setHydrated(true)
  }, [])

  // margin négative pour annuler le padding 32px du gate et obtenir un dashboard plein écran.
  return (
    <div data-hydrated={hydrated ? 'true' : undefined} style={{ margin: -32 }}>
      <ToastProvider>
        <DashboardShell defaultRoute="dashboard" renderModule={renderModule} />
      </ToastProvider>
    </div>
  )
}
