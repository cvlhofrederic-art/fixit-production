'use client'

import { useMemo, useState } from 'react'
import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Pill } from '../primitives/pill'
import { Alert } from '../primitives/alert'
import { Toggle } from '../primitives/toggle'
import { Button } from '../primitives/button'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import m from './modules.module.css'
import { useComingSoon } from './use-coming-soon'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { SIDEBAR_EDITABLE } from '../shell/sidebar-config'

/** Os Meus Módulos — anonyme : catalogue mock byte-exact (preview) ; authentifié :
 * éditeur réel de la barre latérale (réordonner ▲▼ + masquer + persistance cabinet). */

const cardSections: [string, [string, string, string][]][] = [
  ['GESTÃO CORRENTE', [
    ['Ordens de serviço', 'clipboard', 'Criar e acompanhar intervenções'],
    ['Canal de Comunicações', 'chat', 'Mensagens internas e com profissionais'],
    ['Planeamento', 'calendar', 'Vista de calendário das intervenções'],
    ['Faturação', 'doc', 'Gestão de faturas'],
    ['Histórico Edifício', 'bank', 'Vista consolidada por edifício — intervenções, equipamentos, contratos'],
    ['Urgências Técnicas', 'siren', 'Despacho imediato para o profissional VITFIX disponível'],
    ['Emails Fixy', 'mail', 'Gestão de emails com IA'],
    ['Max Expert', 'grad', 'Consultor especialista IA em condomínios'],
  ]],
  ['TERRENO & INTERVENÇÕES', [
    ['Documentos de Intervenções', 'folder', 'Relatórios e comprovativos de intervenção'],
    ['Contabilidade Técnica', 'chart', 'Acompanhamento financeiro das intervenções'],
    ['Análise Orçamentos/Faturas', 'search', 'Comparação e validação de orçamentos'],
    ['Caderneta de Manutenção', 'book', 'Histórico de manutenção dos edifícios'],
    ['Sinistros', 'shield', 'Pipeline de gestão de sinistros'],
  ]],
  ['CONDOMÍNIO & AG', [
    ['Contabilidade Condomínio', 'book', 'Contabilidade do condomínio'],
    ['AG Digitais', 'bank', 'Assembleias gerais online'],
    ['Valores em dívida', 'alert', 'Acompanhamento e cobrança de dívidas'],
    ['Extranet Condóminos', 'users', 'Portal de condóminos'],
    ['Cobrança automática', 'refresh', 'Procedimento automatizado de cobrança'],
  ]],
  ['OBRIGAÇÕES LEGAIS PT', [
    ['Declaração de Encargos', 'stamp', 'Obrigação legal desde 2022 · Declaração para venda de fração'],
    ['Seguro Obrigatório', 'shield', 'Seguro contra incêndio obrigatório · Art.° 1429.° CC'],
    ['Fundo Comum de Reserva', 'bank', 'Mínimo legal 10% · DL 268/94 · Gestão do fundo de reserva'],
    ['Obrigações Legais', 'scale', 'Calendário obrigações · Prazos legais · DL 555/99 · DL 97/2017 · DL 320/2002'],
    ['Certificação Energética', 'lightning', 'SCE · Classes A+ a F · DL 101-D/2020 · EPBD 2024 · MEPS'],
  ]],
  ['COMPLIANCE LEGAL V5 — NOVO', [
    ['Tracker Deliberações', 'bot', 'CC art. 1436.°-i · 15 dias úteis · Fixy extrai · Calendário PT'],
    ['Procurações & Presenças', 'doc', 'CC art. 1433.°-3 · Léa OCR · Validação NIF AT'],
    ['Notificações Judiciais', 'scale', 'CC 1436.°-o + p · Léa OCR · Update semestral auto'],
    ['Acessibilidade DL 163', 'target', '23 critérios · Alfredo Vision · Atestação PDF'],
    ['Segurança Edifício RSCIE', 'shield', 'DL 220/2008 · Categorização auto · Alfredo gera plano emergência'],
    ['RGPD Compliance Center', 'archive', 'Tratamentos · Direitos titulares · 30 dias · Fixy classifica'],
  ]],
  ['PATRIMÓNIO V5 — NOVO', [
    ['Gestão Elevadores', 'monitor', 'DL 320/2002 · Periodicidade auto 2/4/6 anos · Workflow 48h Câmara'],
    ['Contratos com Prestadores', 'handshake', 'Léa OCR · Tempo alertas J-90/60/30 · Auto 3 Orçamentos'],
    ['Câmaras Vigilância', 'monitor', 'RGPD · Autorização CNPD · Sinalização auto · Retenção máx 30d'],
  ]],
  ['FISCAL & TESOURARIA V5 — NOVO', [
    ['Mapa Fiscal Anual', 'fact', 'Max Expert categoriza · Export Primavera/PHC/Sage/SAF-T'],
    ['Open Banking PSD2', 'bank', 'Conexão direta bancos PT · Max Expert auto-match 90%+'],
    ['Reembolsos Automáticos', 'refresh', 'Pro-rata temporis · Lei 8/2022 · Max calcula · OB executa'],
    ['NPS Pós-Intervenção', 'poll', 'Auto-envio 48h · Rating Marketplace · Alfredo agrega insights'],
  ]],
  ['GESTÃO CONDÓMINOS', [
    ['Portal do Condómino', 'home', 'Extrato · Recibos · Documentos · Comunicações · Pedidos'],
    ['Reserva Espaços', 'calendar', 'Reserva de espaços comuns · Calendário · Regras configuráveis'],
    ['Ocorrências', 'wrench', 'Gestão de avarias · QR Codes · SLA · Tracking completo'],
    ['Enquetes', 'chart', 'Sondagens e inquéritos · Votação informal · Participação'],
    ['Quadro de Avisos', 'pin', 'Avisos digitais · Comunicados · Notificações condóminos'],
    ['WhatsApp/SMS', 'chat', 'Comunicação WhatsApp · SMS · Modelos · Envio em massa'],
    ['QR Code Fração', 'qr', 'QR Codes por zona · Sinalizações via scan · Estatísticas · Geração em lote · Condómino reporter'],
    ['Dashboard Condómino RT', 'users', 'Estado tempo real · Barra progresso intervenções · Financeiro · Comunicação · Atividade'],
    ['Chatbot WhatsApp 24/7', 'bot', 'Chatbot IA autónomo · Resposta automática · Classificação pedidos · Criação ocorrências'],
  ]],
  ['FERRAMENTAS PT', [
    ['Votação Online', 'archive', 'Votação à distância · Lei 8/2022 · Procurações automáticas'],
    ['Pagamentos Digitais', 'coin', 'Multibanco · MB Way · SEPA · Reconciliação automática'],
    ['Carregamento VE', 'lightning', 'Postos carregamento elétrico · DL 101-D/2020 · Fundo Ambiental'],
    ['Atas com IA', 'pencil', 'Geração automática de atas · Cálculo maiorias · Assinatura eletrónica'],
    ['Mapa de Quotas', 'coin', 'Cálculo quotas · Permilagem · Simulador · Cobranças trimestrais'],
    ['3 Orçamentos Obras', 'clipboard', 'Comparação obrigatória 3 orçamentos · Lei 8/2022 · Scoring IA'],
    ['Cobrança Judicial', 'scale', 'Pipeline de recuperação · Prazo 90 dias · Injunção · Art.° 310.° CC'],
    ['Monitorização Consumos', 'chart', 'Água · Eletricidade · Gás · Alertas consumo anormal'],
    ['Arquivo Digital', 'archive', 'Arquivo certificado · SHA-256 · Pesquisa · Retenção legal'],
    ['Relatório de Gestão', 'doc', 'Relatório anual · Prestação de contas · Art.° 1436.° CC · Lei 8/2022'],
    ['Preparador Assembleia', 'pencil', 'Convocatória · Ordem de trabalhos · Quóruns · Procurações · Lei 8/2022'],
    ['Plano de Manutenção', 'construction', 'Conservação obrigatória 8 anos · DL 555/99 art. 89.° · Planificação obras'],
    ['Vistoria Técnica', 'clipboard', 'Inspeção gás 5 anos · Elevadores 2-6 anos · Checklist · Relatório PDF'],
    ['Pontuação de Saúde', 'shield', 'Score IA 0-100 por edifício · Estado técnico · Finanças · Conformidade · Energia'],
    ['Gestão de Seguros', 'shield', 'Apólices por edifício · Coberturas · Alertas expiração · Sinistros · Art.° 1429.° CC'],
    ['Marketplace Profissionais', 'tools', 'Pesquisa profissionais certificados · Pedidos orçamento · Avaliações · Comparação · Favoritos'],
    ['Comparador Energia', 'lightning', 'Comparar tarifas EDP/Galp/Endesa · Simulação poupança · Histórico consumos · Classe energética'],
    ['Assinatura Digital CMD', 'pencil', 'Chave Móvel Digital · Assinar atas/contratos · Validação · DL 12/2021 · eIDAS'],
    ['Dashboard Multi-Imóveis', 'building', 'Visão global · Comparação edifícios · Ranking · KPIs agregados · Score saúde'],
    ['e-Fatura AT', 'flag', 'Submissão faturas AT · ATCUD · SAF-T PT · Portaria 302/2016 · DL 28/2019'],
    ['Acompanhamento de Infrações', 'alert', 'Infrações ao regulamento · Pipeline sinalização → multa · Provas · Histórico · Modelos de carta'],
    ['Benchmarking Imóveis', 'chart', 'Comparação KPIs entre edifícios · Rankings · Percentis · Alertas outliers · Exportação'],
  ]],
  ['AGENTES IA', [
    ['Orçamento Anual IA', 'bot', 'Geração automática baseada em 3 exercícios · Tendências · Inflação · DL 268/94'],
    ['Contacto Proativo IA', 'sat', 'Comunicação automática condóminos · Cobranças · Avisos · Relatórios · Multi-canal'],
    ['Ocorrências com IA', 'bot', 'Criação automática a partir de texto/foto · Classificação · Priorização · Localização'],
    ['Checklists IA', 'clipboard', 'Listas inteligentes · Inspeção mensal · Preparação AG · Entrada/saída · Segurança incêndio'],
    ['Processamentos em Lote', 'cog', 'Emissão quotas · Relances automáticos · Encerramento exercício · Recibos · Agendamentos'],
    ['AG Live Digital', 'bank', 'Sessão AG em tempo real · Votação instantânea · Controlo presenças · Quórum · Ata automática'],
    ['Predição Manutenção', 'bot', 'ML preditivo · Score risco equipamentos · Timeline intervenções · Alertas · Fatores de risco'],
    ['Fixy', '', 'Assistente de ação — secretária IA'],
    ['Léa', 'chart', 'Contabilidade de condomínio'],
    ['Alfredo', 'mail', 'Gestor de emails IA'],
  ]],
]

const orderSections: [string, (string | number)[][]][] = [
  ['AGENTES IA', [['Fixy', '', 1], ['Max Expert', 'grad', 2], ['Léa', 'chart', 3], ['Alfredo', 'mail', 4], ['Tempo', 'clock', 5]]],
  ['GESTÃO', [['Painel de controlo', 'chart', 1, 'fixo'], ['Ordens de serviço', 'clipboard', 2], ['Canal de Comunicações', 'chat', 3], ['Planeamento', 'calendar', 4], ['A Minha Equipa', 'users', 5, 'fixo']]],
  ['PATRIMÓNIO', [['Edifícios', 'bank', 1, 'fixo'], ['Profissionais', 'wrench', 2, 'fixo'], ['Condóminos & Inquilinos', 'users', 3, 'fixo'], ['Gestão Elevadores', 'monitor', 4], ['Contratos', 'handshake', 5], ['Câmaras Vigilância', 'monitor', 6]]],
  ['TÉCNICO', [['Documentos de Intervenções', 'folder', 1], ['Contabilidade Técnica', 'chart', 2], ['Análise Orçamentos/Faturas', 'search', 3], ['Faturação', 'doc', 4]]],
  ['ACOMPANHAMENTO', [['Alertas', 'bell', 1, 'fixo'], ['Relatório mensal', 'doc', 2], ['Calendário regulamentar', 'calendar', 3], ['Documentos (GED)', 'folder', 4, 'fixo']]],
  ['CONDOMÍNIO', [['Contabilidade Condomínio', 'book', 1], ['AG Digitais', 'bank', 2], ['Valores em dívida', 'alert', 3], ['Caderneta de Manutenção', 'book', 4], ['Mapa Fiscal Anual', 'fact', 5], ['Open Banking', 'bank', 6]]],
  ['OBRIGAÇÕES LEGAIS', [
    ['Declaração de Encargos', 'stamp', 1], ['Obrigações e Prazos', 'scale', 2], ['Prazos legais', 'calendar', 3], ['Acessibilidade DL 163', 'target', 4],
    ['Preparador AG', 'pencil', 5], ['Tracker Deliberações', 'bot', 6], ['Procurações & Presenças', 'doc', 7],
    ['Seguro Obrigatório', 'shield', 8], ['Fundo Comum de Reserva', 'bank', 9], ['Sinistros', 'shield', 10], ['Segurança Edifício', 'shield', 11],
    ['Notificações Judiciais', 'scale', 12], ['Cobrança automática · Juros & Sanções', 'coin', 13], ['RGPD Center', 'archive', 14],
    ['Certificação Energética', 'lightning', 15], ['Extranet Condóminos', 'team', 16],
  ]],
  ['GESTÃO CONDÓMINOS', [['Portal do Condómino', 'home', 1], ['Quadro de Avisos', 'pin', 2], ['Enquetes', 'chart', 3], ['Reserva Espaços', 'calendar', 4], ['Ocorrências', 'wrench', 5], ['WhatsApp/SMS', 'chat', 6], ['Reembolsos', 'refresh', 7], ['NPS Pós-Intervenção', 'poll', 8]]],
  ['FERRAMENTAS AVANÇADAS', [
    ['Relatório de Gestão', 'doc', 1], ['Preparador Assembleia', 'pencil', 2], ['Plano Manutenção', 'construction', 3], ['Vistoria Técnica', 'clipboard', 4], ['Pontuação Saúde', 'shield', 5],
    ['Orçamento IA', 'bot', 6], ['Contacto Proativo', 'sat', 7], ['Ocorrências (Classificador)', 'bot', 8], ['Gestão Seguros', 'shield', 9], ['Checklists IA', 'clipboard', 10],
    ['Processamentos Lote', 'cog', 11], ['AG Live Digital', 'bank', 12], ['Marketplace Profissionais', 'tools', 13], ['Predição Manutenção', 'bot', 14], ['QR Code Fração', 'qr', 15],
    ['Dashboard Condómino', 'users', 16], ['Comparador Energia', 'lightning', 17], ['Assinatura CMD', 'pencil', 18], ['Multi-Imóveis', 'building', 19], ['e-Fatura AT', 'flag', 20],
    ['Votação Online', 'archive', 21], ['Atas com IA', 'pencil', 22], ['Pagamentos Digitais', 'coin', 23], ['Mapa de Quotas', 'coin', 24], ['3 Orçamentos', 'clipboard', 25],
    ['Cobrança Judicial', 'scale', 26], ['Carregamento VE', 'lightning', 27], ['Monitorização Consumos', 'chart', 28], ['Arquivo Digital', 'archive', 29],
  ]],
  ['FERRAMENTAS IA', [['Lançamento IA Faturas', 'bot', 1], ['Comunicação digital', 'chat', 2], ['Emails Fixy', 'mail', 3]]],
  ['CONTA', [['Definições', 'cog', 1, 'fixo']]],
]

const modCard = { background: '#fff', border: '1px solid var(--v54-line)', borderRadius: 14, boxShadow: 'var(--v54-shadow-card)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 } as const
const cardIco = { width: 42, height: 42, borderRadius: 12, background: 'var(--v54-cream)', display: 'grid', placeItems: 'center', color: 'var(--v54-navy-700)', flexShrink: 0 } as const
const orderRow = { padding: '12px 16px', marginBottom: 8, border: '1px solid var(--v54-line)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 14, background: '#fff' } as const
const arrowBtn = { padding: '2px 8px', minHeight: 'auto', lineHeight: 1 } as const

/** Catalogue mock byte-exact (preview anonyme). */
function MockCatalog() {
  const soon = useComingSoon()
  return (
    <>
      <PageHead title="Os meus módulos" lede="90 módulos profissionais · Ative só o que precisa · Os desativados deixam de aparecer no menu lateral · 4 módulos V5 fusionados como secções nos módulos parentes"
        actions={<Pill kind="gold" noDot>90/90 ativos</Pill>} />

      {cardSections.map((s, si) => (
        <div key={si} style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 20, fontWeight: 600 }}>{s[0]}</div>
            <div style={{ flex: 1, height: 1, background: 'var(--v54-line)' }}></div>
          </div>
          <div className={m.cardGrid}>
            {s[1].map((mod, i) => (
              <div key={i} style={modCard}>
                <div style={cardIco}>{mod[1] ? <Icon name={mod[1] as IconName} style={{ width: 22, height: 22 }} /> : null}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 13.5, display: 'block', marginBottom: 2 }}>{mod[0]}</b>
                  <div style={{ fontSize: 11.5, color: 'var(--v54-navy-500)', lineHeight: 1.4 }}>{mod[2]}</div>
                </div>
                <Toggle on onToggle={() => {}} aria-label={mod[0]} />
              </div>
            ))}
          </div>
        </div>
      ))}

      <Panel title="Ordem do menu" sub="Arraste ou utilize ▲▼ — a barra lateral atualiza-se em tempo real"
        right={<Button onClick={soon('Redefinir ordem')}>↻ Redefinir</Button>}>
        {orderSections.map((sec, si) => (
          <div key={si} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--v54-gold-700)', margin: '14px 0 8px' }}>{sec[0]}</div>
            {sec[1].map((it, i) => (
              <div key={i} style={orderRow}>
                <div style={{ color: 'var(--v54-navy-200)', cursor: 'grab', fontSize: 18, lineHeight: 1 }}>⋮⋮</div>
                <div style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', color: 'var(--v54-navy-700)' }}>{it[1] ? <Icon name={it[1] as IconName} style={{ width: 18, height: 18 }} /> : null}</div>
                <div style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>{it[0]}</div>
                {it[3] && <Pill kind="gold" noDot>{it[3]}</Pill>}
                <div style={{ fontFamily: 'var(--v54-font-mono)', fontSize: 13, color: 'var(--v54-navy-300)', fontWeight: 600, minWidth: 24, textAlign: 'right' }}>{it[2]}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Button size="sm" variant="ghost" style={arrowBtn} aria-label="Subir na ordem" title="Subir" onClick={soon('Reordenar módulos')}>▲</Button>
                  <Button size="sm" variant="ghost" style={arrowBtn} aria-label="Descer na ordem" title="Descer" onClick={soon('Reordenar módulos')}>▼</Button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </Panel>

      <Alert kind="gold" icon="sparkle" title="Dica">
        Os módulos desativados desaparecem da barra lateral mas permanecem acessíveis a qualquer momento. Os seus dados nunca são eliminados.
      </Alert>
    </>
  )
}

/** Éditeur réel (authentifié) : réordonne/masque les items de la vraie sidebar + persiste. */
function RealEditor() {
  const data = useSyndicData()
  const { push } = useToast()
  const defaultOrder = useMemo(() => SIDEBAR_EDITABLE.map((e) => e.id), [])
  const [order, setOrder] = useState<string[]>(() => {
    const saved = (data.dashboardPrefs?.itemOrder ?? []).filter((id) => defaultOrder.includes(id))
    const savedSet = new Set(saved)
    return [...saved, ...defaultOrder.filter((id) => !savedSet.has(id))]
  })
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(data.dashboardPrefs?.itemsHidden ?? []))
  const [busy, setBusy] = useState(false)

  const sections = useMemo(() => {
    const rank = (id: string) => order.indexOf(id)
    const bySection = new Map<string, { id: string; label: string; icon: IconName }[]>()
    for (const e of SIDEBAR_EDITABLE) {
      const arr = bySection.get(e.section) ?? []
      arr.push({ id: e.id, label: e.label, icon: e.icon })
      bySection.set(e.section, arr)
    }
    return [...bySection.entries()].map(([section, items]) => ({ section, items: [...items].sort((a, b) => rank(a.id) - rank(b.id)) }))
  }, [order])

  const move = (id: string, neighborId?: string) => {
    if (!neighborId) return
    setOrder((prev) => {
      const next = [...prev]
      const ia = next.indexOf(id)
      const ib = next.indexOf(neighborId)
      if (ia < 0 || ib < 0) return prev
      next[ia] = neighborId
      next[ib] = id
      return next
    })
  }
  const toggle = (id: string) => setHidden((h) => { const n = new Set(h); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const reset = () => { setOrder(defaultOrder); setHidden(new Set()) }
  const save = () => {
    if (!data.token) { push({ kind: 'info', title: 'Guardar', desc: 'Conecte-se como síndico.' }); return }
    setBusy(true)
    fetch('/api/syndic/dashboard-prefs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
      body: JSON.stringify({ itemOrder: order, itemsHidden: [...hidden] }),
    })
      .then((r) => { if (!r.ok) throw new Error() })
      .then(() => { data.refresh?.(); push({ kind: 'success', title: 'Menu guardado', desc: 'A barra lateral foi atualizada.' }) })
      .catch(() => push({ kind: 'error', title: 'Erro ao guardar', desc: 'Tente novamente mais tarde.' }))
      .finally(() => setBusy(false))
  }

  const ativos = SIDEBAR_EDITABLE.length - hidden.size
  return (
    <>
      <PageHead title="Os meus módulos" lede="Reordene (▲▼) e ative/desative os módulos da barra lateral. As alterações aplicam-se ao menu do seu gabinete após guardar."
        actions={<><Pill kind="gold" noDot>{ativos}/{SIDEBAR_EDITABLE.length} ativos</Pill><Button onClick={reset}>↻ Redefinir</Button><Button variant="gold" disabled={busy} onClick={save}><Icon name="check" />{busy ? 'A guardar…' : 'Guardar'}</Button></>} />
      {sections.map((sec) => (
        <Panel key={sec.section} title={sec.section}>
          {sec.items.map((it, i) => {
            const isHidden = hidden.has(it.id)
            return (
              <div key={it.id} style={orderRow}>
                <div style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', color: 'var(--v54-navy-700)' }}>{it.icon ? <Icon name={it.icon} style={{ width: 18, height: 18 }} /> : null}</div>
                <div style={{ flex: 1, fontSize: 13.5, fontWeight: 500, opacity: isHidden ? 0.45 : 1 }}>{it.label}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Button size="sm" variant="ghost" style={arrowBtn} aria-label={`Subir ${it.label}`} title="Subir" disabled={i === 0} onClick={() => move(it.id, sec.items[i - 1]?.id)}>▲</Button>
                  <Button size="sm" variant="ghost" style={arrowBtn} aria-label={`Descer ${it.label}`} title="Descer" disabled={i === sec.items.length - 1} onClick={() => move(it.id, sec.items[i + 1]?.id)}>▼</Button>
                </div>
                <Toggle on={!isHidden} onToggle={() => toggle(it.id)} aria-label={`Mostrar ${it.label}`} />
              </div>
            )
          })}
        </Panel>
      ))}
      <Alert kind="gold" icon="sparkle" title="Dica">
        Os módulos desativados desaparecem da barra lateral mas permanecem acessíveis a qualquer momento. « Os Meus Módulos » nunca pode ser ocultado.
      </Alert>
    </>
  )
}

export default function ModOsMeusModulos() {
  const data = useSyndicData()
  return data.authenticated ? <RealEditor /> : <MockCatalog />
}
