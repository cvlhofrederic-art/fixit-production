'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { Tabs } from '../primitives/tabs'
import { Pill, type PillKind } from '../primitives/pill'
import { Button } from '../primitives/button'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import { useMessages, useV54Locale, type V54Locale } from '@/lib/syndic/v54/i18n'
import { CANAL_MESSAGES, type FiltreCanal, type TagCanal } from './i18n/ModCanal.messages'

/** Canal de Comunicações — port byte-exact du ModCanal du bundle V5.7.
 * CSS bespoke dans ./canal.css (scopé #syndic-dashboard-v54). Icônes paperclip/camera/info
 * absentes du jeu d'icônes du bundle → fallback `doc` (paths[name] || paths.doc), reproduit ici. */

const TAG_KIND: Record<TagCanal, PillKind> = { urgente: 'rust', 'em-curso': 'amber', 'em-espera': 'gold', concluida: 'sage' }
const fmtEUR = (n: number, locale: V54Locale) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n)
/** Filtres de la liste : code et couleur de la pastille (le libellé vient du dictionnaire). */
const FILTERS: [FiltreCanal, string | null][] = [['todas', null], ['urgente', 'rust'], ['em-curso', 'amber'], ['em-espera', 'gold']]

export default function ModCanal() {
  const t = useMessages(CANAL_MESSAGES)
  const locale = useV54Locale()
  const MISSIONS = t.missions
  const [tab, setTab] = useState('pro')
  const [subTab, setSubTab] = useState('prest')
  const [filter, setFilter] = useState<FiltreCanal>('todas')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(MISSIONS[0].id)
  const [draft, setDraft] = useState('')
  const { push } = useToast()

  const selected = MISSIONS.find(mi => mi.id === selectedId) || MISSIONS[0]
  const visible = MISSIONS.filter(mi =>
    (filter === 'todas' || mi.tags.includes(filter))
    && (!search || mi.building.toLowerCase().includes(search.toLowerCase()) || mi.professional.toLowerCase().includes(search.toLowerCase())))

  const progress = [
    { step: t.etapes.creee, date: t.dateCreation, state: 'done' },
    { step: t.etapes.attribue, date: t.dateCreation, state: 'done' },
    { step: t.etapes.demarree, date: null, state: 'current' },
    { step: t.etapes.attente, date: null, state: 'pending' },
    { step: t.etapes.cloturee, date: null, state: 'pending' },
  ]
  const participants = [
    { initials: 'G', name: t.roles.gestionnaireNom, role: t.roles.gestionnaire, online: true },
    { initials: 'D', name: selected.professional, role: t.roles.prestataire, online: true },
    { initials: 'J', name: selected.requester, role: t.roles.demandeur, online: false },
  ]
  const sendMessage = () => {
    if (!draft.trim()) return
    push({ kind: 'success', title: t.toasts.messageEnvoye, desc: t.toasts.destinataire(selected.professional) })
    setDraft('')
  }

  return (
    <>
      <PageHead title={t.titre} lede={t.chapeau} />
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'pro', label: t.onglets.pro, icon: 'wrench', badge: 1 },
        { id: 'int', label: t.onglets.int, icon: 'building' },
        { id: 'ped', label: t.onglets.ped, icon: 'doc', badge: 2 },
      ]} />

      <div className="canal-grid">
        <aside className="canal-missions-col" aria-label={t.listeAria}>
          <div className="canal-missions-head">
            <div className="canal-missions-label">{t.missionsLabel}</div>
            <div className="canal-missions-subtabs">
              <button type="button" className={clsx('canal-chip', subTab === 'prest' && 'active')} onClick={() => setSubTab('prest')}>
                <Icon name="wrench" /> {t.sousOnglets.prest} <span className="canal-chip-count">5</span>
              </button>
              <button type="button" className={clsx('canal-chip', subTab === 'equip' && 'active')} onClick={() => setSubTab('equip')}>
                <Icon name="users" /> {t.sousOnglets.equip} <span className="canal-chip-count">4</span>
              </button>
            </div>
            <div className="canal-search">
              <Icon name="search" />
              <input type="text" placeholder={t.recherchePlaceholder} value={search} onChange={e => setSearch(e.target.value)} aria-label={t.rechercheAria} />
            </div>
            <div className="canal-filters" role="group" aria-label={t.filtresAria}>
              {FILTERS.map(([k, kind]) => (
                <button key={k} type="button" className={clsx('canal-filter', filter === k && 'active', kind)} onClick={() => setFilter(k)}>
                  {kind && <span className="canal-filter-dot" />}
                  {t.filtres[k]}
                </button>
              ))}
            </div>
          </div>
          <div className="canal-missions-list">
            {visible.length === 0 ? (
              <p className="canal-empty">{t.aucuneMission}</p>
            ) : visible.map(mi => (
              <button key={mi.id} type="button" className={clsx('canal-mission-card', mi.id === selectedId && 'active')} onClick={() => setSelectedId(mi.id)} aria-current={mi.id === selectedId ? 'true' : undefined}>
                <div className="canal-mission-title">{mi.building}</div>
                <div className="canal-mission-sub"><span className="canal-mission-dot" />{mi.professional}</div>
                <div className="canal-mission-tags">
                  {mi.tags.map(tag => <Pill key={tag} kind={TAG_KIND[tag]} noDot>{t.tags[tag]}</Pill>)}
                </div>
                {mi.unread > 0 && <span className="canal-mission-unread">{mi.unread}</span>}
              </button>
            ))}
          </div>
        </aside>

        <section className="canal-chat-col" aria-label={t.conversationAria}>
          <header className="canal-chat-head">
            <div className="canal-chat-head-info">
              <h3 className="canal-chat-title">{selected.building} <span className="canal-chat-title-sep">·</span> {selected.area}</h3>
              <p className="canal-chat-meta">
                <span className="canal-mission-dot" />{selected.professional}
                <span className="canal-chat-meta-sep">·</span>
                {t.chat.mission}<span className="canal-chat-meta-id">#{selected.id}</span>
                <span className="canal-chat-meta-sep">·</span>
                <a href="#" className="canal-chat-link" onClick={e => { e.preventDefault(); push({ kind: 'info', title: t.toasts.vuePro, desc: t.toasts.vueProDesc }) }}>{t.chat.vue}</a>
              </p>
            </div>
            <div className="canal-chat-head-actions">
              <Button variant="ghost" size="sm" onClick={() => push({ kind: 'info', title: t.toasts.documents, desc: t.toasts.documentsDesc })}><Icon name="doc" />{t.boutons.documents}</Button>
              <Button variant="ghost" size="sm" onClick={() => push({ kind: 'info', title: t.toasts.details, desc: t.toasts.detailsDesc })}><Icon name="doc" />{t.boutons.details}</Button>
              <Button variant="primary" size="sm" onClick={() => push({ kind: 'success', title: t.toasts.missionValidee, desc: selected.building })}><Icon name="check" />{t.boutons.validerMission}</Button>
            </div>
          </header>

          <div className="canal-chat-body">
            <div className="canal-chat-empty">
              <div className="canal-chat-empty-icon"><Icon name="wrench" /></div>
              <h4>{t.chat.ouvert}</h4>
              <p>{t.chat.envoyeA}{selected.professional}{t.chat.envoyeFin}<br />{t.chat.demarrer}</p>
            </div>
          </div>

          <footer className="canal-chat-footer">
            <form className="canal-chat-input-row" onSubmit={e => { e.preventDefault(); sendMessage() }}>
              <button type="button" className="canal-chat-iconbtn" aria-label={t.chat.joindreAria} title={t.chat.joindreTitre}><Icon name="doc" /></button>
              <button type="button" className="canal-chat-iconbtn" aria-label={t.chat.photoAria} title={t.chat.photoTitre}><Icon name="doc" /></button>
              <input type="text" className="canal-chat-input" placeholder={t.chat.repondreA(selected.professional)} value={draft} onChange={e => setDraft(e.target.value)} aria-label={t.chat.messageAria} />
              <button type="submit" className={clsx('canal-chat-send', btnCss.btn, btnCss.primary)} disabled={!draft.trim()} aria-label={t.chat.envoyerAria}><Icon name="arrow" /></button>
            </form>
            <div className="canal-chat-footer-row">
              <p className="canal-chat-hint">{t.chat.aideEnvoyer}<span className="canal-chat-meta-sep">·</span>{t.chat.aideLigne}</p>
              <div className="canal-chat-quickactions">
                <Button variant="ghost" size="sm" onClick={() => push({ kind: 'success', title: t.toasts.missionValidee, desc: selected.building })}><Icon name="check" />{t.boutons.valider}</Button>
                <Button variant="gold" size="sm" onClick={() => push({ kind: 'warning', title: t.toasts.revisionDemandee, desc: selected.building })}><Icon name="refresh" />{t.boutons.demanderRevision}</Button>
                <Button variant="ghost" size="sm" onClick={() => push({ kind: 'info', title: t.toasts.modeles, desc: t.toasts.modelesDesc })}><Icon name="doc" />{t.boutons.modeles}</Button>
              </div>
            </div>
          </footer>
        </section>

        <aside className="canal-details-col" aria-label={t.details.aria}>
          <section className="canal-details-section">
            <h4 className="canal-details-label">{t.details.mission}</h4>
            <h3 className="canal-details-title">{selected.area} — {selected.building}</h3>
            <p className="canal-details-id">#{selected.id}</p>
            <div className="canal-details-pills">
              <Pill kind={selected.priority === 'urgente' ? 'rust' : 'dark'} noDot>{selected.priority === 'urgente' ? t.details.priorites.urgente : t.details.priorites.normal}</Pill>
              <Pill kind="amber" noDot>{t.details.attenteValidation}</Pill>
            </div>
          </section>

          <section className="canal-details-section">
            <h4 className="canal-details-label">{t.details.informations}</h4>
            <ul className="canal-info-list">
              <li><Icon name="building" /><div><div className="canal-info-k">{t.details.immeuble}</div><a href="#" className="canal-info-link" onClick={e => e.preventDefault()}>{selected.building}</a></div></li>
              <li><Icon name="wrench" /><div><div className="canal-info-k">{t.details.metier}</div><div className="canal-info-v">{selected.area}</div></div></li>
              <li><Icon name="calendar" /><div><div className="canal-info-k">{t.details.dateIntervention}</div><div className="canal-info-v">{selected.date}</div></div></li>
              <li><Icon name="clock" /><div><div className="canal-info-k">{t.details.dureeEstimee}</div><div className="canal-info-v">{selected.duration || '—'}</div></div></li>
              <li><Icon name="coin" /><div><div className="canal-info-k">{t.details.montantHT}</div><div className="canal-info-v">{selected.amount ? fmtEUR(selected.amount, locale) : '—'}</div></div></li>
              <li><Icon name="users" /><div><div className="canal-info-k">{t.details.demandeur}</div><div className="canal-info-v">{selected.requester}</div></div></li>
            </ul>
          </section>

          <section className="canal-details-section">
            <h4 className="canal-details-label">{t.details.avancement}</h4>
            <ol className="canal-progress">
              {progress.map((p, i) => (
                <li key={i} className={`canal-progress-step state-${p.state}`}>
                  <span className="canal-progress-marker" />
                  <div className="canal-progress-content">
                    <div className="canal-progress-step-name">{p.step}</div>
                    <div className="canal-progress-step-date">{p.date || '—'}</div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="canal-details-section">
            <h4 className="canal-details-label">{t.details.participants}</h4>
            <ul className="canal-participants">
              {participants.map((p, i) => (
                <li key={i} className="canal-participant">
                  <span className="canal-participant-avatar">{p.initials}</span>
                  <div className="canal-participant-info">
                    <div className="canal-participant-name">{p.name}</div>
                    <div className="canal-participant-role">{p.role}</div>
                  </div>
                  {p.online && <span className="canal-participant-online" aria-label={t.details.enLigne} />}
                </li>
              ))}
            </ul>
          </section>

          <section className="canal-details-section">
            <h4 className="canal-details-label">{t.details.actionsRapides}</h4>
            <div className="canal-actions">
              <button type="button" className="canal-action sage" onClick={() => push({ kind: 'success', title: t.toasts.missionCloturee, desc: selected.building })}><Icon name="check" /><span>{t.details.validerCloturer}</span></button>
              <button type="button" className="canal-action" onClick={() => push({ kind: 'info', title: t.toasts.rapportPdf, desc: t.toasts.rapportPdfDesc })}><Icon name="doc" /><span>{t.details.genererPdf}</span></button>
              <button type="button" className="canal-action gold" onClick={() => push({ kind: 'warning', title: t.toasts.revisionDemandee, desc: selected.building })}><Icon name="refresh" /><span>{t.details.demanderRevision}</span></button>
              <button type="button" className="canal-action rust" onClick={() => push({ kind: 'warning', title: t.toasts.missionAnnulee, desc: selected.building })}><Icon name="ban" /><span>{t.details.annulerMission}</span></button>
            </div>
          </section>
        </aside>
      </div>
    </>
  )
}
