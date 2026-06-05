'use client'

import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Pill } from '../primitives/pill'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'

/** Marketplace de Profissionais — port byte-exact du ModMarketplace du bundle V5.7. */

type Pro = { nome: string; empresa: string; espec: string; distrito: string; rating: number; avaliacoes: number; preco: string; resposta: string; anos: string; trabalhos: string; cert: string; destaque: boolean }
const PROS: Pro[] = [
  { nome: 'Maria Santos', empresa: 'ElectroMaria', espec: 'Eletricidade', distrito: 'Porto', rating: 4.9, avaliacoes: 89, preco: '40€/h', resposta: '< 4h', anos: '12 anos', trabalhos: '198 trabalhos', cert: 'DGEG Eletricista Cat. IV', destaque: true },
  { nome: 'António Silva', empresa: 'CanalFix Lda', espec: 'Canalização', distrito: 'Lisboa', rating: 4.8, avaliacoes: 127, preco: '35€/h', resposta: '< 2h', anos: '15 anos', trabalhos: '342 trabalhos', cert: 'CERTIF Canalização Nível III', destaque: true },
  { nome: 'Pedro Mendes', empresa: 'ElevaPT', espec: 'Elevadores', distrito: 'Lisboa', rating: 4.7, avaliacoes: 45, preco: 'Contrato anual', resposta: '< 1h', anos: '20 anos', trabalhos: '89 trabalhos', cert: 'ASAE Elevadores · ISO 9001', destaque: true },
  { nome: 'João Costa', empresa: 'PintaCerta', espec: 'Pintura', distrito: 'Sintra', rating: 4.5, avaliacoes: 63, preco: '28€/h', resposta: '24h', anos: '8 anos', trabalhos: '156 trabalhos', cert: 'CCP Pintura Industrial', destaque: false },
]
const CATS = ['Canalização', 'Eletricidade', 'Pintura', 'Serralharia', 'Elevadores', 'Limpeza', 'Paisagismo', 'Poda / Arboricultura']
const proCard = { background: '#fff', border: '1px solid var(--v54-line)', borderRadius: 14, boxShadow: 'var(--v54-shadow-card)', padding: 22, position: 'relative' } as const

export default function ModMarketplace() {
  return (
    <>
      <PageHead title="Marketplace de Profissionais" lede="Encontre prestadores certificados · Compare orçamentos · Avalie serviços" />
      <KPIGrid items={[
        { icon: 'users', num: 4, lbl: 'Profissionais disponíveis', accent: 'sage' },
        { icon: 'pencil', num: 0, lbl: 'Pedidos ativos' },
        { icon: 'shield', num: 0, lbl: 'Favoritos', accent: 'rust' },
        { icon: 'sparkle', num: '4.7', lbl: 'Avaliação média', accent: 'gold' },
      ]} />
      <Tabs defaultActive="pesq" tabs={[
        { id: 'pesq', icon: 'search', label: 'Pesquisar' },
        { id: 'ped', icon: 'clipboard', label: 'Pedidos de Orçamento' },
        { id: 'av', icon: 'star', label: 'Avaliações' },
        { id: 'fav', icon: 'heart', label: 'Favoritos' },
      ]} />
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div style={{ position: 'relative' }}>
          <Icon name="search" style={{ position: 'absolute', left: 12, top: 11, width: 14, height: 14, color: 'var(--v54-navy-300)' }} />
          <input aria-label="Pesquisar profissional" style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, fontSize: 13 }} placeholder="Pesquisar profissional, empresa ou especialidade…" />
        </div>
        <select className={btnCss.btn} aria-label="Categoria"><option>Todas as categorias</option></select>
        <select className={btnCss.btn} aria-label="Distrito"><option>Todos os distritos</option></select>
        <select className={btnCss.btn} aria-label="Ordenar"><option>Melhor avaliação</option></select>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {CATS.map((c, i) => <Pill key={i} noDot>{c}</Pill>)}
      </div>
      <div className={m.cardGrid3}>
        {PROS.map((p, i) => (
          <div key={i} style={proCard}>
            {p.destaque && <div style={{ position: 'absolute', top: 14, right: 14 }}><Pill kind="gold" noDot>DESTAQUE</Pill></div>}
            <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 22, fontWeight: 500 }}>{p.nome}</div>
            <div style={{ fontSize: 12.5, color: 'var(--v54-navy-500)', marginBottom: 10 }}>{p.empresa}</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              <Pill kind="gold" noDot>{p.espec}</Pill><Pill noDot>{p.distrito}</Pill>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ color: 'var(--v54-gold-600)' }}></span>
              <b>{p.rating}</b><span style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>({p.avaliacoes} avaliações)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: 12, color: 'var(--v54-navy-500)', gap: 6, marginBottom: 10 }}>
              <div>{p.preco}</div><div>{p.resposta}</div><div>{p.anos}</div><div>{p.trabalhos}</div>
            </div>
            <Pill kind="sage" noDot>{p.cert}</Pill>
            <span style={{ marginLeft: 6 }}><Pill kind="sage" noDot>● Disponível</Pill></span>
          </div>
        ))}
      </div>
    </>
  )
}
