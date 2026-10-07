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
import { useComingSoon } from './use-coming-soon'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { DEFINICOES_MESSAGES } from './i18n/ModDefinicoes.messages'

/** Definições — port byte-exact du ModDefinicoes du bundle V5.7. */

// Mockup statique : les toggles affichent leur état mais ne le modifient pas (Phase 2).
const noop = () => { /* no-op */ }

const fieldLabel = { fontSize: 11, fontWeight: 600, color: 'var(--v54-navy-500)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 } as const
const fieldCtrl = { width: '100%', padding: '10px 12px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, background: '#fff', fontSize: 13, color: 'var(--v54-ink)', fontFamily: 'inherit' } as const

export default function ModDefinicoes() {
  const soon = useComingSoon()
  const t = useMessages(DEFINICOES_MESSAGES)
  const { abonnement: ab, agentEmail: ae, profil: pr, cabinet: cab } = t
  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau} />
      <Panel title={ab.titre}>
        <div style={{ padding: 18, background: 'var(--v54-cream)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 18, marginBottom: 14 }}>
          <div style={{ flex: 1 }}><b style={{ fontSize: 15 }}>{ab.essai}</b><div style={{ fontSize: 12, color: 'var(--v54-gold-700)', marginTop: 2, fontWeight: 600 }}>{ab.restant}</div></div>
          <Pill kind="dark" noDot>{ab.pastille}</Pill>
        </div>
        <Button variant="gold" style={{ width: '100%', padding: 14, justifyContent: 'center' }} onClick={soon(ab.titre, ab.formules)}>{ab.choisir}</Button>
      </Panel>
      <Panel title={ae.titre} sub={ae.sousTitre}>
        <Button style={{ width: '100%', padding: 14, justifyContent: 'center' }} onClick={soon(ae.connecterToast, ae.integrationEnCours)}>{ae.connecter}</Button>
      </Panel>
      <Panel title={pr.titre}>
        <div style={{ padding: 14, background: 'var(--v54-cream)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <div className={clsx(m.av, m.avLg, m.avGold)}>SA</div>
          <div><b>{pr.nom}</b><div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>{pr.role}</div></div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <span style={fieldLabel}>{pr.signature}</span>
          <Button style={{ padding: '18px', border: '2px dashed var(--v54-line-strong)', background: 'var(--v54-paper)' }} onClick={soon(pr.dessinerToast)}>{pr.dessiner}</Button>
        </div>
        <Alert icon="alert" title={pr.aucuneTitre}>{pr.aucuneTexte}</Alert>
        <Button variant="primary" onClick={soon(pr.enregistrer)}>{pr.enregistrer}</Button>
      </Panel>
      <Panel title={cab.titre}>
        <div className={m.cardGrid}>
          {cab.champs.map((c) => (
            <div key={c.id}><label htmlFor={c.id} style={fieldLabel}>{c.libelle}</label><input id={c.id} defaultValue={c.valeur} autoComplete={c.autoComplete} style={fieldCtrl} /></div>
          ))}
        </div>
        <div style={{ marginTop: 14 }}><label htmlFor="def-morada" style={fieldLabel}>{cab.adresse}</label><textarea id="def-morada" rows={2} placeholder={cab.adressePlaceholder} style={fieldCtrl} /></div>
        <div style={{ marginTop: 14 }}>
          <span style={fieldLabel}>{cab.logo}</span>
          <Button onClick={soon(cab.importerLogoToast)}><Icon name="image" />{cab.importerLogo}</Button>
        </div>
      </Panel>
      <Panel title={t.notifications.titre}>
        {t.notifications.liste.map((n, i) => (
          <div key={n[0]} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < 4 ? '1px solid var(--v54-line)' : 'none' }}>
            <span>{n[0]}</span><Toggle on={n[1]} onToggle={noop} aria-label={n[0]} />
          </div>
        ))}
      </Panel>
    </>
  )
}
