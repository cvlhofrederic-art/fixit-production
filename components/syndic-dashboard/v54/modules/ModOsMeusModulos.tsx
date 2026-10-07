'use client'

import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Pill } from '../primitives/pill'
import { Alert } from '../primitives/alert'
import { Toggle } from '../primitives/toggle'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import m from './modules.module.css'
import { useComingSoon } from './use-coming-soon'
import { useMessages } from '@/lib/syndic/v54/i18n'
import {
  OS_MEUS_MODULOS_MESSAGES,
  type IdCarte,
  type IdLigne,
  type SectionCatalogue,
  type SectionMenu,
} from './i18n/ModOsMeusModulos.messages'

/** Os Meus Módulos — port byte-exact du ModOsMeusModulos du bundle V5.7 (catalogue 90 módulos + ordem menu). */

/**
 * Structure commune aux deux langues : sections, modules (ids de la sidebar) et icônes.
 * Les noms, descriptions et titres viennent du dictionnaire ; en français, ce sont les
 * libellés de la sidebar FR, et les modules masqués en France sont retirés.
 */
const cardSections: [SectionCatalogue, [IdCarte, IconName | ''][]][] = [
  ['gestaoCorrente', [['ordens', 'clipboard'], ['canal', 'chat'], ['planeamento', 'calendar'], ['faturacao', 'doc'], ['histEdificio', 'bank'], ['urgencias', 'siren'], ['emailsFixy', 'mail'], ['max', 'grad']]],
  ['terreno', [['docsInterv', 'folder'], ['contabTec', 'chart'], ['analiseOrc', 'search'], ['caderneta', 'book'], ['sinistros', 'shield']]],
  ['condominioAG', [['contabCond', 'book'], ['agDigit', 'bank'], ['valoresDiv', 'alert'], ['extranet', 'users'], ['cobrAuto', 'refresh']]],
  ['obrigacoes', [['declEncargos', 'stamp'], ['seguroObr', 'shield'], ['fcr', 'bank'], ['obrigPrazos', 'scale'], ['certEnerg', 'lightning']]],
  ['compliance', [['trackerDelibs', 'bot'], ['procuracoes', 'doc'], ['notificJud', 'scale'], ['acessibilidade', 'target'], ['segEdificio', 'shield'], ['rgpdCenter', 'archive']]],
  ['patrimonio', [['elevadores', 'monitor'], ['contratos', 'handshake'], ['cctv', 'monitor']]],
  ['fiscal', [['mapaFiscal', 'fact'], ['openBanking', 'bank'], ['reembolsos', 'refresh'], ['npsPosIntervencao', 'poll']]],
  ['gestaoCondominos', [['portal', 'home'], ['reserva', 'calendar'], ['ocorrencias', 'wrench'], ['enquetes', 'chart'], ['avisos', 'pin'], ['whatsapp', 'chat'], ['qrcode', 'qr'], ['dashCond', 'users'], ['chatbot', 'bot']]],
  ['ferramentas', [
    ['votacaoOnline', 'archive'], ['pagDigitais', 'coin'], ['carregamentoVE', 'lightning'], ['atasIA', 'pencil'], ['mapaQuotas', 'coin'],
    ['orc3', 'clipboard'], ['cobrJud', 'scale'], ['monitorizacao', 'chart'], ['arquivoDig', 'archive'], ['relGestao', 'doc'],
    ['prepAss', 'pencil'], ['planoMan', 'construction'], ['vistoria', 'clipboard'], ['pontuacao', 'shield'], ['seguros', 'shield'],
    ['marketplace', 'tools'], ['compEnergia', 'lightning'], ['assinaturaCMD', 'pencil'], ['multiImoveis', 'building'], ['efatura', 'flag'],
    ['infracoes', 'alert'], ['benchmarking', 'chart'],
  ]],
  ['agentes', [['orcIA', 'bot'], ['contacto', 'sat'], ['ocClassif', 'bot'], ['checklists', 'clipboard'], ['procLote', 'cog'], ['agLive', 'bank'], ['predicao', 'bot'], ['fixy', ''], ['lea', 'chart'], ['alfredo', 'mail']]],
]

/** Ordre du menu : section de sidebar, puis [module, icône, fixe]. Le rang affiché est la position dans la section. */
const orderSections: [SectionMenu, [IdLigne, IconName | '', boolean?][]][] = [
  ['Agentes IA', [['fixy', ''], ['max', 'grad'], ['lea', 'chart'], ['alfredo', 'mail'], ['tempo', 'clock']]],
  ['Gestão', [['dashboard', 'chart', true], ['ordens', 'clipboard'], ['canal', 'chat'], ['planeamento', 'calendar'], ['equipa', 'users', true]]],
  ['Património', [['edificios', 'bank', true], ['profissionais', 'wrench', true], ['condominos', 'users', true], ['elevadores', 'monitor'], ['contratos', 'handshake'], ['cctv', 'monitor']]],
  ['Técnico', [['docsInterv', 'folder'], ['contabTec', 'chart'], ['analiseOrc', 'search'], ['faturacao', 'doc']]],
  ['Acompanhamento', [['alertas', 'bell', true], ['relMensal', 'doc'], ['calReg', 'calendar'], ['docsGED', 'folder', true]]],
  ['Condomínio', [['contabCond', 'book'], ['agDigit', 'bank'], ['valoresDiv', 'alert'], ['caderneta', 'book'], ['mapaFiscal', 'fact'], ['openBanking', 'bank']]],
  ['Obrigações Legais', [
    ['declEncargos', 'stamp'], ['obrigPrazos', 'scale'], ['prazosLegais', 'calendar'], ['acessibilidade', 'target'],
    ['preparadorAG', 'pencil'], ['trackerDelibs', 'bot'], ['procuracoes', 'doc'],
    ['seguroObr', 'shield'], ['fcr', 'bank'], ['sinistros', 'shield'], ['segEdificio', 'shield'],
    ['notificJud', 'scale'], ['cobrAuto', 'coin'], ['rgpdCenter', 'archive'],
    ['certEnerg', 'lightning'], ['extranet', 'team'],
  ]],
  ['Gestão Condóminos', [['portal', 'home'], ['avisos', 'pin'], ['enquetes', 'chart'], ['reserva', 'calendar'], ['ocorrencias', 'wrench'], ['whatsapp', 'chat'], ['reembolsos', 'refresh'], ['npsPosIntervencao', 'poll']]],
  ['Ferramentas Avançadas', [
    ['relGestao', 'doc'], ['prepAss', 'pencil'], ['planoMan', 'construction'], ['vistoria', 'clipboard'], ['pontuacao', 'shield'],
    ['orcIA', 'bot'], ['contacto', 'sat'], ['ocClassif', 'bot'], ['seguros', 'shield'], ['checklists', 'clipboard'],
    ['procLote', 'cog'], ['agLive', 'bank'], ['marketplace', 'tools'], ['predicao', 'bot'], ['qrcode', 'qr'],
    ['dashCond', 'users'], ['compEnergia', 'lightning'], ['assinaturaCMD', 'pencil'], ['multiImoveis', 'building'], ['efatura', 'flag'],
    ['votacaoOnline', 'archive'], ['atasIA', 'pencil'], ['pagDigitais', 'coin'], ['mapaQuotas', 'coin'], ['orc3', 'clipboard'],
    ['cobrJud', 'scale'], ['carregamentoVE', 'lightning'], ['monitorizacao', 'chart'], ['arquivoDig', 'archive'],
  ]],
  ['Ferramentas IA', [['lancFat', 'bot'], ['comunicDig', 'chat'], ['emailsFixy', 'mail']]],
  ['Conta', [['definicoes', 'cog', true]]],
]

const modCard = { background: '#fff', border: '1px solid var(--v54-line)', borderRadius: 14, boxShadow: 'var(--v54-shadow-card)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 } as const
const cardIco = { width: 42, height: 42, borderRadius: 12, background: 'var(--v54-cream)', display: 'grid', placeItems: 'center', color: 'var(--v54-navy-700)', flexShrink: 0 } as const
const orderRow = { padding: '12px 16px', marginBottom: 8, border: '1px solid var(--v54-line)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 14, background: '#fff' } as const
const arrowBtn = { padding: '2px 8px', minHeight: 'auto', lineHeight: 1 } as const

export default function ModOsMeusModulos() {
  const soon = useComingSoon()
  const t = useMessages(OS_MEUS_MODULOS_MESSAGES)
  const o = t.ordre
  const visible = (id: string) => !t.masques.has(id)
  const catalogue = cardSections.map(([s, mods]) => [s, mods.filter(([id]) => visible(id))] as const)
  const menu = orderSections.map(([s, items]) => [s, items.filter(([id]) => visible(id))] as const)
  const total = catalogue.reduce((n, [, mods]) => n + mods.length, 0)
  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau(total)}
        actions={<Pill kind="gold" noDot>{t.actifs(total)}</Pill>} />

      {catalogue.map((s, si) => (
        <div key={si} style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 20, fontWeight: 600 }}>{t.sectionsCatalogue[s[0]]}</div>
            <div style={{ flex: 1, height: 1, background: 'var(--v54-line)' }}></div>
          </div>
          <div className={m.cardGrid}>
            {s[1].map(([id, ico], i) => (
              <div key={i} style={modCard}>
                <div style={cardIco}>{ico ? <Icon name={ico} style={{ width: 22, height: 22 }} /> : null}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 13.5, display: 'block', marginBottom: 2 }}>{t.nomCarte(id)}</b>
                  <div style={{ fontSize: 11.5, color: 'var(--v54-navy-500)', lineHeight: 1.4 }}>{t.descriptions[id]}</div>
                </div>
                <Toggle on onToggle={() => {}} aria-label={t.nomCarte(id)} />
              </div>
            ))}
          </div>
        </div>
      ))}

      <Panel title={o.titre} sub={o.sousTitre}
        right={<Button onClick={soon(o.reinitialiserToast)}>{o.reinitialiser}</Button>}>
        {menu.map((sec, si) => (
          <div key={si} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--v54-gold-700)', margin: '14px 0 8px' }}>{o.section(sec[0])}</div>
            {sec[1].map(([id, ico, fixe], i) => (
              <div key={i} style={orderRow}>
                <div style={{ color: 'var(--v54-navy-200)', cursor: 'grab', fontSize: 18, lineHeight: 1 }}>⋮⋮</div>
                <div style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', color: 'var(--v54-navy-700)' }}>{ico ? <Icon name={ico} style={{ width: 18, height: 18 }} /> : null}</div>
                <div style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>{o.nomLigne(id)}</div>
                {fixe && <Pill kind="gold" noDot>{o.fixe}</Pill>}
                <div style={{ fontFamily: 'var(--v54-font-mono)', fontSize: 13, color: 'var(--v54-navy-300)', fontWeight: 600, minWidth: 24, textAlign: 'right' }}>{i + 1}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Button size="sm" variant="ghost" style={arrowBtn} aria-label={o.monterAria} title={o.monter} onClick={soon(o.reordonnerToast)}>▲</Button>
                  <Button size="sm" variant="ghost" style={arrowBtn} aria-label={o.descendreAria} title={o.descendre} onClick={soon(o.reordonnerToast)}>▼</Button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </Panel>

      <Alert kind="gold" icon="sparkle" title={t.astuce.titre}>
        {t.astuce.texte}
      </Alert>
    </>
  )
}
