'use client'

import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Pill } from '../primitives/pill'
import { Tabs } from '../primitives/tabs'
import { Button } from '../primitives/button'
import { KPIGrid } from '../primitives/kpi'
import { Alert } from '../primitives/alert'
import { Empty } from '../primitives/empty'
import { SectionDivider } from '../primitives/section-divider'
import Icon from '../primitives/icon/Icon'
import m from './modules.module.css'
import { useComingSoon } from './use-coming-soon'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { ARQUIVO_DIGITAL_MESSAGES } from './i18n/ModArquivoDigital.messages'

/** Arquivo Digital Certificado — port byte-exact du ModArquivoDigital du bundle V5.7
 * (assets L37698-37748) + sa sous-section ProjetoAprovSection (L39767-39795, co-localisée).
 * Statique. Tokens inline remappés --* → --v54-*. Tables via modules.module.css.
 * Catégories et documents de démonstration : dictionnaire (une version par langue). */

/** Sous-section « Projeto Aprovado & Licenças » (DL 268/94). */
function ProjetoAprovSection() {
  const soon = useComingSoon()
  const p = useMessages(ARQUIVO_DIGITAL_MESSAGES).projet
  return (
    <>
      <PageHead
        eyebrow={p.surtitre}
        title={p.titre}
        lede={p.chapeau}
        actions={<Button variant="gold" onClick={soon(p.bientotDeposerCertifie.titre, p.bientotDeposerCertifie.desc)}><Icon name="upload" />{p.deposerCertifie}</Button>}
      />
      <Alert kind="gold" icon="scale" title={p.alerteTitre}>
        {p.alerteTexte}
      </Alert>
      <KPIGrid items={[
        { icon: 'archive', num: 0, lbl: p.kpi.certifies },
        { icon: 'building', num: 0, lbl: p.kpi.couverts, accent: 'gold' },
        { icon: 'check', num: 0, lbl: p.kpi.audit, accent: 'sage' },
        { icon: 'alert', num: 0, lbl: p.kpi.sansDoc, accent: 'rust' },
      ]} />
      <Tabs defaultActive="todos" tabs={[
        { id: 'todos', label: p.onglets.todos },
        { id: 'proj', label: p.onglets.proj },
        { id: 'alv', label: p.onglets.alv },
        { id: 'lic', label: p.onglets.lic },
        { id: 'imi', label: p.onglets.imi },
        { id: 'audit', label: p.onglets.audit },
      ]} />
      <Panel>
        <Empty
          illustration="documentos"
          title={p.videTitre}
          desc={p.videDesc}
          action={<Button variant="primary" onClick={soon(p.bientotDeposer.titre, p.bientotDeposer.desc)}><Icon name="upload" />{p.deposerPremier}</Button>}
        />
      </Panel>
    </>
  )
}

export default function ModArquivoDigital() {
  const soon = useComingSoon()
  const t = useMessages(ARQUIVO_DIGITAL_MESSAGES)
  const col = t.colonnes
  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau} />
      <Tabs defaultActive="arq" tabs={[
        { id: 'arq', icon: 'archive', label: t.onglets.arq },
        { id: 'pesq', icon: 'search', label: t.onglets.pesq },
        { id: 'cert', icon: 'lock', label: t.onglets.cert },
        { id: 'proj', icon: 'stamp', label: t.onglets.proj },
        { id: 'cfg', icon: 'cog', label: t.onglets.cfg },
      ]} />
      <KPIGrid items={[
        { icon: 'doc', num: 12, lbl: t.kpi.total },
        { icon: 'folder', num: 9, lbl: t.kpi.categories, accent: 'gold' },
        { icon: 'archive', num: t.kpi.stockageNum, lbl: t.kpi.stockage, accent: 'sage' },
        { icon: 'calendar', num: t.kpi.dernierDepotNum, lbl: t.kpi.dernierDepot },
      ]} />
      <Panel title={t.arborescence} right={<Button variant="gold" onClick={soon(t.bientotAjouter.titre, t.bientotAjouter.desc)}><Icon name="plus" />{t.ajouterDocument}</Button>} flush>
        {t.categories.map((cat, i) => (
          <div key={i} style={{ borderBottom: i < 3 ? '1px solid var(--v54-line)' : 'none' }}>
            <div style={{ padding: '14px 22px', background: cat.docs ? 'var(--v54-gold-50)' : '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><b>{cat.nome}</b><Pill noDot>{cat.count}</Pill></div>
              <span style={{ color: 'var(--v54-navy-300)' }}>{cat.docs ? '▼' : '▶'}</span>
            </div>
            {cat.docs && (
              <div className={m.tblWrap}>
                <table className={m.tbl} style={{ background: 'var(--v54-paper)' }}>
                  <thead><tr><th>{col.nom}</th><th>{col.date}</th><th>{col.taille}</th><th>{col.immeuble}</th><th>{col.empreinte}</th><th>{col.actions}</th></tr></thead>
                  <tbody>{cat.docs.map((d, j) => (
                    <tr key={j}>
                      <td>{d.nome}</td>
                      <td className={m.numCell}>{d.data}</td>
                      <td className={m.numCell}>{d.tam}</td>
                      <td>{d.imovel}</td>
                      <td className={m.mono} style={{ fontSize: 11, color: 'var(--v54-navy-300)' }}>{d.hash}</td>
                      <td>
                        <Button size="sm" variant="ghost" aria-label={t.voirAria} title={t.voirTitre} onClick={soon(t.bientotVoir.titre, t.bientotVoir.desc)}><Icon name="eye" /></Button>{' '}
                        <Button size="sm" variant="ghost" aria-label={t.telechargerAria} title={t.telechargerAria} onClick={soon(t.bientotTelecharger.titre, t.bientotTelecharger.desc)}><Icon name="download" /></Button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </Panel>
      <SectionDivider eyebrow={t.separateur.surtitre} title={t.separateur.titre} sub={t.separateur.sous} />
      <ProjetoAprovSection />
    </>
  )
}
