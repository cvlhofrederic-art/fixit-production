'use client'

import { useState, useMemo } from 'react'
import { useThemeVars } from './useThemeVars'

interface ChantiersSectionProps {
  artisan: import('@/lib/types').Artisan
  navigateTo: (page: string) => void
  orgRole?: 'artisan' | 'pro_societe' | 'pro_conciergerie' | 'pro_gestionnaire'
}

type Statut = 'tous' | 'avenir' | 'encours' | 'cloture'

interface TimelineEntry { date: string; label: string; type: 'green' | 'red' | 'gray' }
interface Chantier {
  id: string; titre: string; client: string; adresse: string; statut: string
  dateDebut: string; dateFin: string; montant: number; devis: string
  facture: string | null; rapport: string | null; photos: number; notes: string
  alertes: string[]; timeline: TimelineEntry[]
}

const MOCK_CHANTIERS: Chantier[] = [
  { id:'CH-031', titre:'Étanchéité terrasse Bât. A', client:'Foncia Gestion', adresse:'45 bd Haussmann, Paris 9e', statut:'encours', dateDebut:'15/03/2026', dateFin:'25/03/2026', montant:5400, devis:'DEV-039', facture:null, rapport:'RP-031', photos:3, notes:'Accès difficile côté nord.', alertes:['facture_manquante'], timeline:[{date:'15/03/2026',label:'Démarrage chantier',type:'green'},{date:'19/03/2026',label:'Diagnostic réalisé',type:'green'},{date:'25/03/2026',label:'Finalisation prévue',type:'gray'}] },
  { id:'CH-027', titre:'Peinture appartement 85m²', client:'SCI Les Tilleuls', adresse:'12 rue des Acacias, Vincennes', statut:'encours', dateDebut:'17/03/2026', dateFin:'22/03/2026', montant:7440, devis:'DEV-039', facture:'FAC-018', rapport:null, photos:5, notes:'', alertes:['rapport_manquant'], timeline:[{date:'17/03/2026',label:'Préparation sols',type:'green'},{date:'18/03/2026',label:'Sous-couche',type:'green'},{date:'22/03/2026',label:'Finition',type:'gray'}] },
  { id:'CH-025', titre:'Rénovation sanitaires école', client:'Mairie de Ségur', adresse:'3 rue Voltaire, Montreuil', statut:'avenir', dateDebut:'28/03/2026', dateFin:'05/04/2026', montant:18000, devis:'DEV-041', facture:null, rapport:null, photos:0, notes:'', alertes:[], timeline:[{date:'28/03/2026',label:'Démarrage prévu',type:'gray'}] },
  { id:'CH-022', titre:'Tableau électrique NF C15-100', client:'Thomas Mercier', adresse:'24 rue du Temple, Montreuil', statut:'cloture', dateDebut:'10/03/2026', dateFin:'10/03/2026', montant:2520, devis:'DEV-033', facture:'FAC-016', rapport:'RP-022', photos:4, notes:'Client satisfait.', alertes:[], timeline:[{date:'10/03/2026',label:'Intervention',type:'green'},{date:'12/03/2026',label:'Facture envoyée',type:'green'},{date:'15/03/2026',label:'Paiement reçu',type:'green'}] },
  { id:'CH-019', titre:'Pose carrelage cuisine', client:'Nadia Rousseau', adresse:'6 impasse des Lilas, Bagnolet', statut:'cloture', dateDebut:'12/03/2026', dateFin:'13/03/2026', montant:1740, devis:'DEV-033', facture:'FAC-016', rapport:'RP-025', photos:6, notes:'', alertes:[], timeline:[{date:'12/03/2026',label:'Dépose',type:'green'},{date:'13/03/2026',label:'Pose + joints',type:'green'}] },
  { id:'CH-015', titre:'Diagnostic fuite robinet', client:'Marie Fontaine', adresse:'5 rue des Lilas, Paris 11e', statut:'cloture', dateDebut:'08/03/2026', dateFin:'08/03/2026', montant:384, devis:'DEV-035', facture:'FAC-014', rapport:null, photos:2, notes:'Joint remplacé.', alertes:['facture_impayee','rapport_manquant'], timeline:[{date:'08/03/2026',label:'Intervention',type:'green'},{date:'19/03/2026',label:'Facture impayée',type:'red'}] },
]

const TABS: { key: Statut; label: string }[] = [
  { key: 'tous', label: 'Tous' },
  { key: 'avenir', label: 'A venir' },
  { key: 'encours', label: 'En cours' },
  { key: 'cloture', label: 'Clôturés' },
]

const statutLabel = (s: string) => s === 'encours' ? 'En cours' : s === 'avenir' ? 'A venir' : 'Clôturé'
const statutColor = (s: string, tv: { primaryLight: string; primary: string; greenLight: string; green: string }) => s === 'encours' ? { bg: tv.primaryLight, color: tv.primary } : s === 'avenir' ? { bg: '#E8F0FE', color: '#1A56DB' } : { bg: tv.greenLight, color: tv.green }
const formatEur = (v: number) => v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })

const alerteLabel = (a: string) => a === 'facture_manquante' ? 'Facture manquante' : a === 'rapport_manquant' ? 'Rapport manquant' : a === 'facture_impayee' ? 'Facture impayée' : a
const alerteColor = (a: string, tv: { redBg: string; red: string; primaryLight: string; primary: string }) => a === 'facture_impayee' ? { bg: tv.redBg, color: tv.red } : { bg: tv.primaryLight, color: tv.primary }
const statutBadgeV5 = (s: string) => s === 'encours' ? 'v5-badge v5-badge-blue' : s === 'avenir' ? 'v5-badge v5-badge-yellow' : 'v5-badge v5-badge-green'

export default function ChantiersSection({ artisan, navigateTo, orgRole }: ChantiersSectionProps) {
  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'
  const tv = useThemeVars(isV5)
  const [tab, setTab] = useState<Statut>('tous')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const filtered = useMemo(() => tab === 'tous' ? MOCK_CHANTIERS : MOCK_CHANTIERS.filter(c => c.statut === tab), [tab])
  const selected = MOCK_CHANTIERS.find(c => c.id === selectedId)

  const encoursCount = MOCK_CHANTIERS.filter(c => c.statut === 'encours').length
  const avenirCount = MOCK_CHANTIERS.filter(c => c.statut === 'avenir').length
  const clotureCount = MOCK_CHANTIERS.filter(c => c.statut === 'cloture').length
  const caChantiers = MOCK_CHANTIERS.filter(c => c.statut === 'cloture').reduce((s, c) => s + c.montant, 0)

  const allAlertes = MOCK_CHANTIERS.flatMap(c => c.alertes.map(a => ({ chantier: c.id, titre: c.titre, alerte: a })))

  // ── Detail view ──
  if (selected) {
    const sc = statutColor(selected.statut, tv)
    const currentNotes = notes[selected.id] ?? selected.notes
    return (
      <div className={isV5 ? 'v5-fade' : 'space-y-3 font-[family-name:var(--font-dm-sans)]'}>
        {/* Toast */}
        {toast && <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded text-sm text-white" style={{ background: tv.green }}>{toast}</div>}

        {/* Back + header */}
        <div className={isV5 ? 'v5-pg-t' : 'flex items-center gap-3'}>
          <button onClick={() => setSelectedId(null)} className={isV5 ? 'v5-btn' : 'p-1.5 rounded-md hover:bg-gray-100'} style={isV5 ? undefined : { border: `1px solid ${tv.border}` }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke={tv.text} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div className={isV5 ? '' : 'flex-1'}>
            <div className={isV5 ? '' : 'flex items-center gap-2'}>
              <span className={isV5 ? '' : 'text-xs font-mono'} style={isV5 ? undefined : { color: tv.textMuted }}>{selected.id}</span>
              <span className={isV5 ? statutBadgeV5(selected.statut) : 'text-xs px-2 py-0.5 rounded-full font-medium'} style={isV5 ? undefined : { background: sc.bg, color: sc.color }}>{statutLabel(selected.statut)}</span>
            </div>
            <h1 className={isV5 ? '' : 'text-lg font-semibold'} style={isV5 ? undefined : { color: tv.text }}>{selected.titre}</h1>
          </div>
        </div>

        {/* Info panel */}
        <div className={isV5 ? 'v5-card' : 'rounded-md p-4 grid grid-cols-2 gap-3 text-sm'} style={isV5 ? undefined : { background: tv.cardBg, border: `1px solid ${tv.border}` }}>
          {isV5 ? (
            <div className="v5-dt">
              <div><span>Client</span><p>{selected.client}</p></div>
              <div><span>Montant</span><p>{formatEur(selected.montant)}</p></div>
              <div><span>Adresse</span><p>{selected.adresse}</p></div>
              <div><span>Dates</span><p>{selected.dateDebut} &rarr; {selected.dateFin}</p></div>
              <div><span>Devis</span><p>{selected.devis}</p></div>
              <div><span>Facture</span><p style={{ color: selected.facture ? undefined : tv.red }}>{selected.facture || 'Non émise'}</p></div>
            </div>
          ) : (<>
            <div><span style={{ color: tv.textMuted }}>Client</span><p className="font-medium" style={{ color: tv.text }}>{selected.client}</p></div>
            <div><span style={{ color: tv.textMuted }}>Montant</span><p className="font-medium" style={{ color: tv.text }}>{formatEur(selected.montant)}</p></div>
            <div><span style={{ color: tv.textMuted }}>Adresse</span><p style={{ color: tv.text }}>{selected.adresse}</p></div>
            <div><span style={{ color: tv.textMuted }}>Dates</span><p style={{ color: tv.text }}>{selected.dateDebut} &rarr; {selected.dateFin}</p></div>
            <div><span style={{ color: tv.textMuted }}>Devis</span><p className="font-mono" style={{ color: tv.text }}>{selected.devis}</p></div>
            <div><span style={{ color: tv.textMuted }}>Facture</span><p className="font-mono" style={{ color: selected.facture ? tv.text : tv.red }}>{selected.facture || 'Non émise'}</p></div>
          </>)}
        </div>

        {/* Alertes */}
        {selected.alertes.length > 0 && (
          <div className={isV5 ? '' : 'flex flex-wrap gap-2'}>
            {selected.alertes.map(a => { const ac = alerteColor(a, tv); return (
              <span key={a} className={isV5 ? 'v5-badge v5-badge-red' : 'text-xs px-2.5 py-1 rounded-full font-medium'} style={isV5 ? undefined : { background: ac.bg, color: ac.color }}>{alerteLabel(a)}</span>
            )})}
          </div>
        )}

        {/* Timeline */}
        <div className={isV5 ? 'v5-card' : 'rounded-md p-4'} style={isV5 ? undefined : { background: tv.cardBg, border: `1px solid ${tv.border}` }}>
          <h3 className={isV5 ? 'v5-st' : 'text-sm font-semibold mb-3'} style={isV5 ? undefined : { color: tv.text }}>Chronologie</h3>
          <div className={isV5 ? '' : 'space-y-3'}>
            {selected.timeline.map((t, i) => (
              <div key={i} className={isV5 ? 'v5-prog-row' : 'flex items-start gap-3'}>
                <div className={isV5 ? '' : 'w-2.5 h-2.5 rounded-full mt-1 shrink-0'} style={{ background: t.type === 'green' ? tv.green : t.type === 'red' ? tv.red : tv.border, ...(isV5 ? { width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0, marginTop: '4px' } : {}) }} />
                <div>
                  <span className={isV5 ? '' : 'text-xs font-mono'} style={isV5 ? undefined : { color: tv.textMuted }}>{t.date}</span>
                  <p className={isV5 ? '' : 'text-sm'} style={isV5 ? undefined : { color: tv.text }}>{t.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className={isV5 ? 'v5-card' : 'rounded-md p-4'} style={isV5 ? undefined : { background: tv.cardBg, border: `1px solid ${tv.border}` }}>
          <h3 className={isV5 ? 'v5-st' : 'text-sm font-semibold mb-2'} style={isV5 ? undefined : { color: tv.text }}>Notes</h3>
          <textarea
            className={isV5 ? 'v5-fi' : 'w-full rounded p-2.5 text-sm resize-none focus:outline-none focus:ring-2'}
            style={isV5 ? undefined : { border: `1px solid ${tv.border}`, color: tv.text, background: tv.bg, '--tw-ring-color': tv.primary } as React.CSSProperties}
            rows={3} value={currentNotes} placeholder="Ajouter une note..."
            onChange={e => setNotes(prev => ({ ...prev, [selected.id]: e.target.value }))}
          />
        </div>

        {/* Documents & Photos */}
        <div className={isV5 ? 'v5-card' : 'rounded-md p-4'} style={isV5 ? undefined : { background: tv.cardBg, border: `1px solid ${tv.border}` }}>
          <h3 className={isV5 ? 'v5-st' : 'text-sm font-semibold mb-3'} style={isV5 ? undefined : { color: tv.text }}>Documents & Photos</h3>
          <div className={isV5 ? '' : 'flex flex-wrap gap-2 text-xs'}>
            {selected.devis && <span className={isV5 ? 'v5-badge' : 'px-2.5 py-1 rounded-md'} style={isV5 ? undefined : { background: tv.bg, border: `1px solid ${tv.border}`, color: tv.text }}>Devis {selected.devis}</span>}
            {selected.facture && <span className={isV5 ? 'v5-badge v5-badge-green' : 'px-2.5 py-1 rounded-md'} style={isV5 ? undefined : { background: tv.greenLight, color: tv.green }}>Facture {selected.facture}</span>}
            {selected.rapport && <span className={isV5 ? 'v5-badge' : 'px-2.5 py-1 rounded-md'} style={isV5 ? undefined : { background: tv.bg, border: `1px solid ${tv.border}`, color: tv.text }}>Rapport {selected.rapport}</span>}
          </div>
          {selected.photos > 0 && (
            <div className={isV5 ? '' : 'mt-3 grid grid-cols-4 gap-2'} style={isV5 ? { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '12px' } : undefined}>
              {Array.from({ length: selected.photos }).map((_, i) => (
                <div key={i} className={isV5 ? 'v5-card' : 'aspect-square rounded-md flex items-center justify-center text-xs'} style={isV5 ? { aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center' } : { background: tv.bg, border: `1px solid ${tv.border}`, color: tv.textMuted }}>
                  Photo {i + 1}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className={isV5 ? '' : 'flex gap-2'} style={isV5 ? { display: 'flex', gap: '8px' } : undefined}>
          {selected.statut === 'avenir' && (
            <button onClick={() => showToast('Chantier démarré')} className={isV5 ? 'v5-btn v5-btn-p' : 'flex-1 py-2.5 rounded text-sm font-medium text-white'} style={isV5 ? { flex: 1 } : { background: tv.green }}>
              Démarrer le chantier
            </button>
          )}
          {selected.statut === 'encours' && (<>
            <button onClick={() => showToast('Chantier clôturé')} className={isV5 ? 'v5-btn v5-btn-p' : 'flex-1 py-2.5 rounded text-sm font-medium text-white'} style={isV5 ? { flex: 1 } : { background: tv.green }}>
              Clôturer
            </button>
            <button onClick={() => { navigateTo('devis-factures'); showToast('Redirection vers factures') }} className={isV5 ? 'v5-btn' : 'flex-1 py-2.5 rounded text-sm font-medium'} style={isV5 ? { flex: 1 } : { background: tv.primary, color: tv.text }}>
              Créer facture
            </button>
          </>)}
          {selected.statut === 'cloture' && (
            <button onClick={() => showToast('PDF exporté')} className={isV5 ? 'v5-btn' : 'flex-1 py-2.5 rounded text-sm font-medium'} style={isV5 ? { flex: 1 } : { background: tv.bg, border: `1px solid ${tv.border}`, color: tv.text }}>
              Exporter PDF
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── List view ──
  return (
    <div className={isV5 ? 'v5-fade' : 'space-y-3 font-[family-name:var(--font-dm-sans)]'}>
      {toast && <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded text-sm text-white" style={{ background: tv.green }}>{toast}</div>}

      <div className={isV5 ? 'v5-pg-t' : ''}>
        <h1 className={isV5 ? '' : 'text-lg font-semibold'} style={isV5 ? undefined : { color: tv.text }}>Chantiers</h1>
        {isV5 && <p>Suivi de vos chantiers en cours, à venir et clôturés</p>}
      </div>

      {/* Stats */}
      <div className={isV5 ? 'v5-kpi-g' : 'grid grid-cols-4 gap-3'}>
        {[
          { label: 'En cours', value: encoursCount, color: tv.primary },
          { label: 'A venir', value: avenirCount, color: '#1A56DB' },
          { label: 'Clôturés (mars)', value: clotureCount, color: tv.green },
          { label: 'CA chantiers', value: formatEur(caChantiers), color: tv.text },
        ].map(s => (
          isV5 ? (
            <div key={s.label} className="v5-kpi">
              <span className="v5-kpi-l">{s.label}</span>
              <span className="v5-kpi-v">{s.value}</span>
            </div>
          ) : (
            <div key={s.label} className="rounded-md p-3 text-center" style={{ background: tv.cardBg, border: `1px solid ${tv.border}` }}>
              <p className="text-base font-semibold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: tv.textMuted }}>{s.label}</p>
            </div>
          )
        ))}
      </div>

      {/* Alertes */}
      {allAlertes.length > 0 && (
        <div className={isV5 ? 'v5-card' : 'rounded-md p-3 space-y-2'} style={isV5 ? undefined : { background: tv.primaryLight, border: '1px solid #EED580' }}>
          <p className={isV5 ? 'v5-st' : 'text-xs font-semibold'} style={isV5 ? undefined : { color: tv.primary }}>Alertes ({allAlertes.length})</p>
          {allAlertes.map((a, i) => (
            <div key={i} className={isV5 ? '' : 'flex items-center justify-between text-xs'} style={isV5 ? { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } : undefined}>
              <span style={isV5 ? undefined : { color: tv.text }}><strong>{a.chantier}</strong> {a.titre}</span>
              <span className={isV5 ? 'v5-badge v5-badge-red' : 'px-2 py-0.5 rounded-full font-medium'} style={isV5 ? undefined : { ...alerteColor(a.alerte, tv), background: alerteColor(a.alerte, tv).bg, color: alerteColor(a.alerte, tv).color }}>
                {alerteLabel(a.alerte)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className={isV5 ? 'v5-tabs' : 'flex gap-1 p-1 rounded'} style={isV5 ? undefined : { background: tv.bg }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={isV5 ? `v5-tab-b${tab === t.key ? ' active' : ''}` : 'flex-1 py-1.5 text-sm rounded-md font-medium transition-colors'}
            style={isV5 ? undefined : (tab === t.key ? { background: tv.cardBg, color: tv.text, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' } : { color: tv.textMuted })}>
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className={isV5 ? '' : 'space-y-2'}>
        {filtered.map(c => {
          const sc = statutColor(c.statut, tv)
          return (
            <button key={c.id} onClick={() => setSelectedId(c.id)}
              className={isV5 ? 'v5-card' : 'w-full text-left rounded-md p-3.5 transition-shadow hover:shadow-sm'}
              style={isV5 ? { width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: '8px' } : { background: tv.cardBg, border: `1px solid ${tv.border}` }}>
              <div className={isV5 ? '' : 'flex items-start justify-between gap-2'} style={isV5 ? { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' } : undefined}>
                <div className={isV5 ? '' : 'min-w-0 flex-1'} style={isV5 ? { minWidth: 0, flex: 1 } : undefined}>
                  <div className={isV5 ? '' : 'flex items-center gap-2 mb-0.5'} style={isV5 ? { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' } : undefined}>
                    <span className={isV5 ? '' : 'text-xs font-mono'} style={isV5 ? undefined : { color: tv.textMuted }}>{c.id}</span>
                    <span className={isV5 ? statutBadgeV5(c.statut) : 'text-xs px-2 py-0.5 rounded-full font-medium'} style={isV5 ? undefined : { background: sc.bg, color: sc.color }}>{statutLabel(c.statut)}</span>
                    {c.alertes.length > 0 && <span className={isV5 ? 'v5-badge v5-badge-red' : 'w-2 h-2 rounded-full'} style={isV5 ? undefined : { background: tv.red }}>{isV5 ? '!' : ''}</span>}
                  </div>
                  <p className={isV5 ? '' : 'text-sm font-medium truncate'} style={isV5 ? undefined : { color: tv.text }}>{c.titre}</p>
                  <p className={isV5 ? '' : 'text-xs truncate'} style={isV5 ? { opacity: 0.7 } : { color: tv.textMuted }}>{c.client} &middot; {c.adresse}</p>
                </div>
                <div className={isV5 ? '' : 'text-right shrink-0'} style={isV5 ? { textAlign: 'right', flexShrink: 0 } : undefined}>
                  <p className={isV5 ? '' : 'text-sm font-semibold'} style={isV5 ? { fontWeight: 600 } : { color: tv.text }}>{formatEur(c.montant)}</p>
                  <p className={isV5 ? '' : 'text-xs'} style={isV5 ? { opacity: 0.7 } : { color: tv.textMuted }}>{c.dateDebut}</p>
                </div>
              </div>
              {/* Badges row */}
              <div className={isV5 ? '' : 'flex gap-1.5 mt-2'} style={isV5 ? { display: 'flex', gap: '6px', marginTop: '8px' } : undefined}>
                {c.photos > 0 && <span className={isV5 ? 'v5-badge' : 'text-[10px] px-1.5 py-0.5 rounded'} style={isV5 ? undefined : { background: tv.bg, color: tv.textMuted }}>{c.photos} photos</span>}
                {c.rapport && <span className={isV5 ? 'v5-badge v5-badge-green' : 'text-[10px] px-1.5 py-0.5 rounded'} style={isV5 ? undefined : { background: tv.greenLight, color: tv.green }}>rapport</span>}
                {c.facture && <span className={isV5 ? 'v5-badge v5-badge-green' : 'text-[10px] px-1.5 py-0.5 rounded'} style={isV5 ? undefined : { background: tv.greenLight, color: tv.green }}>facture</span>}
                {!c.facture && c.statut !== 'avenir' && <span className={isV5 ? 'v5-badge v5-badge-red' : 'text-[10px] px-1.5 py-0.5 rounded'} style={isV5 ? undefined : { background: tv.redBg, color: tv.red }}>sans facture</span>}
              </div>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <p className={isV5 ? 'v5-card' : 'text-center py-8 text-sm'} style={isV5 ? { textAlign: 'center', padding: '32px 0' } : { color: tv.textMuted }}>Aucun chantier dans cette catégorie.</p>
        )}
      </div>
    </div>
  )
}
