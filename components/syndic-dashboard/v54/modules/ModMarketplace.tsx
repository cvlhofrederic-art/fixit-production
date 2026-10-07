'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Pill } from '../primitives/pill'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { MARKETPLACE_MESSAGES } from './i18n/ModMarketplace.messages'

/** Marketplace de Profissionais — port byte-exact du ModMarketplace du bundle V5.7. */

const proCard = { background: '#fff', border: '1px solid var(--v54-line)', borderRadius: 14, boxShadow: 'var(--v54-shadow-card)', padding: 22, position: 'relative' } as const

export default function ModMarketplace() {
  const t = useMessages(MARKETPLACE_MESSAGES)
  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau} />
      <KPIGrid items={[
        { icon: 'users', num: 4, lbl: t.kpi.disponibles, accent: 'sage' },
        { icon: 'pencil', num: 0, lbl: t.kpi.demandes },
        { icon: 'shield', num: 0, lbl: t.kpi.favoris, accent: 'rust' },
        { icon: 'sparkle', num: t.kpi.noteMoyenneValeur, lbl: t.kpi.noteMoyenne, accent: 'gold' },
      ]} />
      <Tabs defaultActive="pesq" tabs={[
        { id: 'pesq', icon: 'search', label: t.onglets.pesq },
        { id: 'ped', icon: 'clipboard', label: t.onglets.ped },
        { id: 'av', icon: 'star', label: t.onglets.av },
        { id: 'fav', icon: 'heart', label: t.onglets.fav },
      ]} />
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div style={{ position: 'relative' }}>
          <Icon name="search" style={{ position: 'absolute', left: 12, top: 11, width: 14, height: 14, color: 'var(--v54-navy-300)' }} />
          <input aria-label={t.rechercheAria} style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, fontSize: 13 }} placeholder={t.recherchePlaceholder} />
        </div>
        <select className={btnCss.btn} aria-label={t.categorieAria}><option>{t.toutesCategories}</option></select>
        <select className={btnCss.btn} aria-label={t.zoneAria}><option>{t.toutesZones}</option></select>
        <select className={btnCss.btn} aria-label={t.trierAria}><option>{t.mieuxNotes}</option></select>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {t.categories.map((c, i) => <Pill key={i} noDot>{c}</Pill>)}
      </div>
      <div className={m.cardGrid3}>
        {t.pros.map((p, i) => (
          <div key={i} style={proCard}>
            {p.destaque && <div style={{ position: 'absolute', top: 14, right: 14 }}><Pill kind="gold" noDot>{t.enAvant}</Pill></div>}
            <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 22, fontWeight: 500 }}>{p.nome}</div>
            <div style={{ fontSize: 12.5, color: 'var(--v54-navy-500)', marginBottom: 10 }}>{p.empresa}</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              <Pill kind="gold" noDot>{p.espec}</Pill><Pill noDot>{p.distrito}</Pill>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ color: 'var(--v54-gold-600)' }}></span>
              <b>{t.note(p.rating)}</b><span style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>({p.avaliacoes}{t.avisSuffixe}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: 12, color: 'var(--v54-navy-500)', gap: 6, marginBottom: 10 }}>
              <div>{p.preco}</div><div>{p.resposta}</div><div>{p.anos}</div><div>{p.trabalhos}</div>
            </div>
            <Pill kind="sage" noDot>{p.cert}</Pill>
            <span style={{ marginLeft: 6 }}><Pill kind="sage" noDot>{t.disponible}</Pill></span>
          </div>
        ))}
      </div>
    </>
  )
}
