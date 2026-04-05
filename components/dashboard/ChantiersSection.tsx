'use client'

import { useState, useMemo } from 'react'

interface ChantiersSectionProps {
  artisan: import('@/lib/types').Artisan
  navigateTo: (page: string) => void
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
const statutColor = (s: string) => s === 'encours' ? { bg: 'var(--v22-amber-light)', color: 'var(--v22-amber)' } : s === 'avenir' ? { bg: '#E8F0FE', color: '#1A56DB' } : { bg: 'var(--v22-green-light)', color: 'var(--v22-green)' }
const formatEur = (v: number) => v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })

const alerteLabel = (a: string) => a === 'facture_manquante' ? 'Facture manquante' : a === 'rapport_manquant' ? 'Rapport manquant' : a === 'facture_impayee' ? 'Facture impayée' : a
const alerteColor = (a: string) => a === 'facture_impayee' ? { bg: 'var(--v22-red-light)', color: 'var(--v22-red)' } : { bg: 'var(--v22-amber-light)', color: 'var(--v22-amber)' }

export default function ChantiersSection({ artisan, navigateTo }: ChantiersSectionProps) {
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
    const sc = statutColor(selected.statut)
    const currentNotes = notes[selected.id] ?? selected.notes
    return (
      <div className="space-y-4 font-[family-name:var(--font-dm-sans)]">
        {/* Toast */}
        {toast && <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm text-white" style={{ background: 'var(--v22-green)' }}>{toast}</div>}

        {/* Back + header */}
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedId(null)} className="p-1.5 rounded-md hover:bg-gray-100" style={{ border: '1px solid var(--v22-border)' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="var(--v22-text)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono" style={{ color: 'var(--v22-text-muted)' }}>{selected.id}</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: sc.bg, color: sc.color }}>{statutLabel(selected.statut)}</span>
            </div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--v22-text)' }}>{selected.titre}</h2>
          </div>
        </div>

        {/* Info panel */}
        <div className="rounded-xl p-4 grid grid-cols-2 gap-3 text-sm" style={{ background: 'var(--v22-surface)', border: '1px solid var(--v22-border)' }}>
          <div><span style={{ color: 'var(--v22-text-muted)' }}>Client</span><p className="font-medium" style={{ color: 'var(--v22-text)' }}>{selected.client}</p></div>
          <div><span style={{ color: 'var(--v22-text-muted)' }}>Montant</span><p className="font-medium" style={{ color: 'var(--v22-text)' }}>{formatEur(selected.montant)}</p></div>
          <div><span style={{ color: 'var(--v22-text-muted)' }}>Adresse</span><p style={{ color: 'var(--v22-text)' }}>{selected.adresse}</p></div>
          <div><span style={{ color: 'var(--v22-text-muted)' }}>Dates</span><p style={{ color: 'var(--v22-text)' }}>{selected.dateDebut} &rarr; {selected.dateFin}</p></div>
          <div><span style={{ color: 'var(--v22-text-muted)' }}>Devis</span><p className="font-mono" style={{ color: 'var(--v22-text)' }}>{selected.devis}</p></div>
          <div><span style={{ color: 'var(--v22-text-muted)' }}>Facture</span><p className="font-mono" style={{ color: selected.facture ? 'var(--v22-text)' : 'var(--v22-red)' }}>{selected.facture || 'Non émise'}</p></div>
        </div>

        {/* Alertes */}
        {selected.alertes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selected.alertes.map(a => { const ac = alerteColor(a); return (
              <span key={a} className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: ac.bg, color: ac.color }}>{alerteLabel(a)}</span>
            )})}
          </div>
        )}

        {/* Timeline */}
        <div className="rounded-xl p-4" style={{ background: 'var(--v22-surface)', border: '1px solid var(--v22-border)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--v22-text)' }}>Chronologie</h3>
          <div className="space-y-3">
            {selected.timeline.map((t, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ background: t.type === 'green' ? 'var(--v22-green)' : t.type === 'red' ? 'var(--v22-red)' : 'var(--v22-border)' }} />
                <div>
                  <span className="text-xs font-mono" style={{ color: 'var(--v22-text-muted)' }}>{t.date}</span>
                  <p className="text-sm" style={{ color: 'var(--v22-text)' }}>{t.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="rounded-xl p-4" style={{ background: 'var(--v22-surface)', border: '1px solid var(--v22-border)' }}>
          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--v22-text)' }}>Notes</h3>
          <textarea
            className="w-full rounded-lg p-2.5 text-sm resize-none focus:outline-none focus:ring-2"
            style={{ border: '1px solid var(--v22-border)', color: 'var(--v22-text)', background: 'var(--v22-bg)', '--tw-ring-color': 'var(--v22-yellow)' } as React.CSSProperties}
            rows={3} value={currentNotes} placeholder="Ajouter une note..."
            onChange={e => setNotes(prev => ({ ...prev, [selected.id]: e.target.value }))}
          />
        </div>

        {/* Documents & Photos */}
        <div className="rounded-xl p-4" style={{ background: 'var(--v22-surface)', border: '1px solid var(--v22-border)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--v22-text)' }}>Documents & Photos</h3>
          <div className="flex flex-wrap gap-2 text-xs">
            {selected.devis && <span className="px-2.5 py-1 rounded-md" style={{ background: 'var(--v22-bg)', border: '1px solid var(--v22-border)', color: 'var(--v22-text)' }}>Devis {selected.devis}</span>}
            {selected.facture && <span className="px-2.5 py-1 rounded-md" style={{ background: 'var(--v22-green-light)', color: 'var(--v22-green)' }}>Facture {selected.facture}</span>}
            {selected.rapport && <span className="px-2.5 py-1 rounded-md" style={{ background: 'var(--v22-bg)', border: '1px solid var(--v22-border)', color: 'var(--v22-text)' }}>Rapport {selected.rapport}</span>}
          </div>
          {selected.photos > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {Array.from({ length: selected.photos }).map((_, i) => (
                <div key={i} className="aspect-square rounded-lg flex items-center justify-center text-xs" style={{ background: 'var(--v22-bg)', border: '1px solid var(--v22-border)', color: 'var(--v22-text-muted)' }}>
                  Photo {i + 1}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {selected.statut === 'avenir' && (
            <button onClick={() => showToast('Chantier démarré')} className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--v22-green)' }}>
              Démarrer le chantier
            </button>
          )}
          {selected.statut === 'encours' && (<>
            <button onClick={() => showToast('Chantier clôturé')} className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--v22-green)' }}>
              Clôturer
            </button>
            <button onClick={() => { navigateTo('devis-factures'); showToast('Redirection vers factures') }} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: 'var(--v22-yellow)', color: 'var(--v22-text)' }}>
              Créer facture
            </button>
          </>)}
          {selected.statut === 'cloture' && (
            <button onClick={() => showToast('PDF exporté')} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: 'var(--v22-bg)', border: '1px solid var(--v22-border)', color: 'var(--v22-text)' }}>
              Exporter PDF
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── List view ──
  return (
    <div className="space-y-4 font-[family-name:var(--font-dm-sans)]">
      {toast && <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm text-white" style={{ background: 'var(--v22-green)' }}>{toast}</div>}

      <h1 className="text-xl font-semibold" style={{ color: 'var(--v22-text)' }}>Chantiers</h1>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'En cours', value: encoursCount, color: 'var(--v22-amber)' },
          { label: 'A venir', value: avenirCount, color: '#1A56DB' },
          { label: 'Clôturés (mars)', value: clotureCount, color: 'var(--v22-green)' },
          { label: 'CA chantiers', value: formatEur(caChantiers), color: 'var(--v22-text)' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: 'var(--v22-surface)', border: '1px solid var(--v22-border)' }}>
            <p className="text-2xl font-semibold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--v22-text-muted)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Alertes */}
      {allAlertes.length > 0 && (
        <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--v22-amber-light)', border: '1px solid #EED580' }}>
          <p className="text-xs font-semibold" style={{ color: 'var(--v22-amber)' }}>Alertes ({allAlertes.length})</p>
          {allAlertes.map((a, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span style={{ color: 'var(--v22-text)' }}><strong>{a.chantier}</strong> {a.titre}</span>
              <span className="px-2 py-0.5 rounded-full font-medium" style={{ ...alerteColor(a.alerte), background: alerteColor(a.alerte).bg, color: alerteColor(a.alerte).color }}>
                {alerteLabel(a.alerte)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--v22-bg)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex-1 py-1.5 text-sm rounded-md font-medium transition-colors"
            style={tab === t.key ? { background: 'var(--v22-surface)', color: 'var(--v22-text)', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' } : { color: 'var(--v22-text-muted)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.map(c => {
          const sc = statutColor(c.statut)
          return (
            <button key={c.id} onClick={() => setSelectedId(c.id)}
              className="w-full text-left rounded-xl p-3.5 transition-shadow hover:shadow-sm"
              style={{ background: 'var(--v22-surface)', border: '1px solid var(--v22-border)' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-mono" style={{ color: 'var(--v22-text-muted)' }}>{c.id}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: sc.bg, color: sc.color }}>{statutLabel(c.statut)}</span>
                    {c.alertes.length > 0 && <span className="w-2 h-2 rounded-full" style={{ background: 'var(--v22-red)' }} />}
                  </div>
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--v22-text)' }}>{c.titre}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--v22-text-muted)' }}>{c.client} &middot; {c.adresse}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--v22-text)' }}>{formatEur(c.montant)}</p>
                  <p className="text-xs" style={{ color: 'var(--v22-text-muted)' }}>{c.dateDebut}</p>
                </div>
              </div>
              {/* Badges row */}
              <div className="flex gap-1.5 mt-2">
                {c.photos > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--v22-bg)', color: 'var(--v22-text-muted)' }}>{c.photos} photos</span>}
                {c.rapport && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--v22-green-light)', color: 'var(--v22-green)' }}>rapport</span>}
                {c.facture && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--v22-green-light)', color: 'var(--v22-green)' }}>facture</span>}
                {!c.facture && c.statut !== 'avenir' && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--v22-red-light)', color: 'var(--v22-red)' }}>sans facture</span>}
              </div>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <p className="text-center py-8 text-sm" style={{ color: 'var(--v22-text-muted)' }}>Aucun chantier dans cette catégorie.</p>
        )}
      </div>
    </div>
  )
}
