'use client'

import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Tabs } from '../primitives/tabs'
import { Pill } from '../primitives/pill'
import { KPIGrid } from '../primitives/kpi'
import { Alert } from '../primitives/alert'
import m from './modules.module.css'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { CHATBOT_MESSAGES } from './i18n/ModChatbot.messages'

/** Chatbot WhatsApp 24/7 — page net-new (module catalogue-only en V5.7, aucune source byte-exact).
 * Composée uniquement de primitives v54. Chatbot IA autónomo · Resposta automática ·
 * Classificação de pedidos · Criação de ocorrências. */

export default function ModChatbot() {
  const t = useMessages(CHATBOT_MESSAGES)
  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau} />
      <Tabs defaultActive="conversas" tabs={[
        { id: 'conversas', icon: 'chat', label: t.onglets.conversas },
        { id: 'config', icon: 'cog', label: t.onglets.config },
        { id: 'respostas', icon: 'bot', label: t.onglets.respostas },
        { id: 'stats', icon: 'chart', label: t.onglets.stats },
      ]} />
      <Alert kind="sage" icon="bot" title={t.alerteTitre}>
        {t.alerteTexte}
      </Alert>
      <KPIGrid items={[
        { icon: 'chat', num: 47, lbl: t.kpi.conversas },
        { icon: 'bot', num: 38, lbl: t.kpi.resolvidas, accent: 'sage' },
        { icon: 'wrench', num: 5, lbl: t.kpi.ocorrencias, accent: 'gold' },
        { icon: 'check', num: t.taxaDemo, lbl: t.kpi.taxa },
      ]} />
      <Panel title={t.conversasRecentes} flush>
        <div className={m.tblWrap}>
          <table className={m.tbl}>
            <thead><tr><th>{t.colonnes.condomino}</th><th>{t.colonnes.ultima}</th><th>{t.colonnes.classificacao}</th><th>{t.colonnes.estado}</th></tr></thead>
            <tbody>{t.conversas.map((c, i) => (
              <tr key={i}>
                <td><b>{c.condomino}</b><div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>{c.fracao}</div></td>
                <td>{c.ultima}</td>
                <td><Pill kind={c.kind} noDot>{c.classificacao}</Pill></td>
                <td><Pill kind={c.estadoKind} noDot>{c.estado}</Pill></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Panel>
      <Panel title={t.configTitre}>
        {t.config.map((c, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < t.config.length - 1 ? '1px solid var(--v54-line)' : 'none' }}>
            <span>{c[0]}</span><Pill kind={c[2]} noDot>{c[1]}</Pill>
          </div>
        ))}
      </Panel>
    </>
  )
}
