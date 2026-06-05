'use client'

import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Pill } from '../primitives/pill'
import { Alert } from '../primitives/alert'
import { Toggle } from '../primitives/toggle'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'

/** Definições — port byte-exact du ModDefinicoes du bundle V5.7. */

// Mockup statique : les toggles affichent leur état mais ne le modifient pas (Phase 2).
const noop = () => { /* no-op */ }

const fieldLabel = { fontSize: 11, fontWeight: 600, color: 'var(--v54-navy-500)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 } as const
const fieldCtrl = { width: '100%', padding: '10px 12px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, background: '#fff', fontSize: 13, color: 'var(--v54-ink)', fontFamily: 'inherit' } as const

const NOTIFS = [
  ['Alertas Seguro RC expirado', true],
  ['Controlos regulamentares iminentes', true],
  ['Novas missões criadas', true],
  ['Sinalizações de condóminos', false],
  ['Resumo semanal', true],
] as const

export default function ModDefinicoes() {
  return (
    <>
      <PageHead title="Definições" lede="Conta, perfil, gabinete e notificações" />
      <Panel title="Subscrição">
        <div style={{ padding: 18, background: 'var(--v54-cream)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 18, marginBottom: 14 }}>
          <div style={{ flex: 1 }}><b style={{ fontSize: 15 }}>Teste gratuito</b><div style={{ fontSize: 12, color: 'var(--v54-gold-700)', marginTop: 2, fontWeight: 600 }}>30 dias restantes · Acesso completo</div></div>
          <Pill kind="dark" noDot>TRIAL</Pill>
        </div>
        <Button variant="gold" style={{ width: '100%', padding: 14, justifyContent: 'center' }}>Escolher uma subscrição → a partir de 49 €/mês</Button>
      </Panel>
      <Panel title="Agente Email Fixy" sub="Conecte a sua caixa Gmail para que o Fixy analise automaticamente os seus emails: urgências, tipos de pedidos, sugestões de ações.">
        <Button style={{ width: '100%', padding: 14, justifyContent: 'center' }}>Ligar a sua caixa Gmail</Button>
      </Panel>
      <Panel title="O Meu Perfil">
        <div style={{ padding: 14, background: 'var(--v54-cream)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <div className={clsx(m.av, m.avLg, m.avGold)}>SA</div>
          <div><b>Super Admin VitFix</b><div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>Administrador</div></div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <span style={fieldLabel}>A minha assinatura digital</span>
          <Button style={{ padding: '18px', border: '2px dashed var(--v54-line-strong)', background: 'var(--v54-paper)' }}>Desenhar a minha assinatura</Button>
        </div>
        <Alert icon="alert" title="Nenhuma assinatura configurada">Os PDFs gerados não terão assinatura.</Alert>
        <Button variant="primary">Guardar assinatura</Button>
      </Panel>
      <Panel title="O Meu Gabinete">
        <div className={m.cardGrid}>
          <div><label htmlFor="def-nome" style={fieldLabel}>Nome do gabinete</label><input id="def-nome" defaultValue="VitFix Admin" autoComplete="name" style={fieldCtrl} /></div>
          <div><label htmlFor="def-email" style={fieldLabel}>Email</label><input id="def-email" defaultValue="admincvlho@gmail.com" autoComplete="email" style={fieldCtrl} /></div>
        </div>
        <div style={{ marginTop: 14 }}><label htmlFor="def-morada" style={fieldLabel}>Morada do gabinete</label><textarea id="def-morada" rows={2} placeholder="Ex: Rua das Flores 123, 1000-001 Lisboa" style={fieldCtrl} /></div>
        <div style={{ marginTop: 14 }}>
          <span style={fieldLabel}>Logo do gabinete</span>
          <Button><Icon name="image" />Carregar logo (PNG/JPG/WebP, max 2 MB)</Button>
        </div>
      </Panel>
      <Panel title="Notificações">
        {NOTIFS.map((n, i) => (
          <div key={n[0]} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < 4 ? '1px solid var(--v54-line)' : 'none' }}>
            <span>{n[0]}</span><Toggle on={n[1]} onToggle={noop} aria-label={n[0]} />
          </div>
        ))}
      </Panel>
    </>
  )
}
