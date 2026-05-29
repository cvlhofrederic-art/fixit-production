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
