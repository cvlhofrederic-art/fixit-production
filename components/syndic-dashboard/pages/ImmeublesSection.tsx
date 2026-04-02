'use client'

import { useState } from 'react'
import type { Immeuble, Page } from '@/components/syndic-dashboard/types'

interface ImmeublesSectionProps {
  immeubles: Immeuble[]
  setImmeubles: React.Dispatch<React.SetStateAction<Immeuble[]>>
  locale: string
  t: (key: string, fallback?: string) => string
  user: { id: string } | null
  setPage: (p: Page) => void
  setShowModalMission: (v: boolean) => void
  getAdminToken: () => Promise<string>
  enregistrerBatiment: (nom: string) => void
}

const EMPTY_FORM: Partial<Immeuble> = { nom: '', adresse: '', ville: '', codePostal: '', nbLots: 1, anneeConstruction: 2000, typeImmeuble: 'Copropriété', gestionnaire: '', budgetAnnuel: 0, depensesAnnee: 0, nbInterventions: 0 }

export default function ImmeublesSection({ immeubles, setImmeubles, locale, t, user, setPage, setShowModalMission, getAdminToken, enregistrerBatiment }: ImmeublesSectionProps) {
  const [showModalImmeuble, setShowModalImmeuble] = useState(false)
  const [editingImmeuble, setEditingImmeuble] = useState<Immeuble | null>(null)
  const [immeubleForm, setImmeubleForm] = useState<Partial<Immeuble>>(EMPTY_FORM)

  const openAddImmeuble = () => {
    setEditingImmeuble(null)
    setImmeubleForm({ ...EMPTY_FORM })
    setShowModalImmeuble(true)
  }

  const openEditImmeuble = (imm: Immeuble) => {
    setEditingImmeuble(imm)
    setImmeubleForm({ ...imm })
    setShowModalImmeuble(true)
  }

  const handleSaveImmeuble = async () => {
    if (!immeubleForm.nom?.trim() || !immeubleForm.adresse?.trim()) return
    enregistrerBatiment(immeubleForm.nom || '')

    if (editingImmeuble) {
      setImmeubles(prev => prev.map(i => i.id === editingImmeuble.id ? { ...i, ...immeubleForm } as Immeuble : i))
    } else {
      const newImm: Immeuble = {
        id: Date.now().toString(),
        nom: immeubleForm.nom || '',
        adresse: immeubleForm.adresse || '',
        ville: immeubleForm.ville || '',
        codePostal: immeubleForm.codePostal || '',
        nbLots: immeubleForm.nbLots || 1,
        anneeConstruction: immeubleForm.anneeConstruction || 2000,
        typeImmeuble: immeubleForm.typeImmeuble || 'Copropriété',
        gestionnaire: immeubleForm.gestionnaire || '',
        prochainControle: immeubleForm.prochainControle,
        nbInterventions: 0,
        budgetAnnuel: immeubleForm.budgetAnnuel || 0,
        depensesAnnee: immeubleForm.depensesAnnee || 0,
      }
      setImmeubles(prev => [newImm, ...prev])
    }
    setShowModalImmeuble(false)

    try {
      const token = await getAdminToken()
      if (!token) return
      const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      if (editingImmeuble) {
        await fetch('/api/syndic/immeubles', {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ id: editingImmeuble.id, ...immeubleForm }),
        })
      } else {
        const res = await fetch('/api/syndic/immeubles', {
          method: 'POST',
          headers,
          body: JSON.stringify(immeubleForm),
        })
        if (res.ok) {
          const { immeuble } = await res.json()
          if (immeuble?.id) {
            setImmeubles(prev => prev.map(i => i.nom === immeubleForm.nom && !i.id?.includes('-') ? { ...i, id: immeuble.id } : i))
          }
        }
      }
    } catch { /* silencieux */ }
  }

  const handleDeleteImmeuble = async (id: string) => {
    if (!confirm(locale === 'pt' ? 'Eliminar este edifício? Esta ação é irreversível.' : 'Supprimer cet immeuble ? Cette action est irréversible.')) return
    setImmeubles(prev => prev.filter(i => i.id !== id))
    try {
      const token = await getAdminToken()
      if (!token) return
      await fetch(`/api/syndic/immeubles?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      })
    } catch { /* silencieux */ }
  }

  // ── Computed values ──
  const totalLots = immeubles.reduce((a, im) => a + (im.nbLots || 0), 0)
  const totalInterventions = immeubles.reduce((a, im) => a + (im.nbInterventions || 0), 0)
  const docsManquants = immeubles.filter(im => !im.reglementTexte && !im.reglementPdfNom).length

  return (
    <>
    <div>
      {/* ── Hero ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontWeight: 400, color: 'var(--sd-navy)', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
            🏢 {t('syndicDash.sidebar.buildings')}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--sd-ink-3)' }}>
            <span style={{ color: 'var(--sd-ink-2)' }}>{immeubles.length} {t('syndicDash.immeubles.inPortfolio')}</span> · <span style={{ color: 'var(--sd-ink-2)' }}>{totalLots} {t('syndicDash.immeubles.totalLots', 'lots totaux')}</span>
          </p>
        </div>
        <button
          onClick={openAddImmeuble}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--sd-navy)', color: '#fff', border: 'none', padding: '11px 22px', borderRadius: 10, fontFamily: "'Outfit',sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 3px 12px rgba(13,27,46,0.22)', whiteSpace: 'nowrap' }}
        >
          <span style={{ color: 'var(--sd-gold)', fontSize: 18, fontWeight: 300, lineHeight: 1 }}>+</span> {t('syndicDash.immeubles.addBuilding')}
        </button>
      </div>

      {/* ── KPI Strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 26 }}>
        {[
          { num: immeubles.length, label: t('syndicDash.immeubles.managedBuildings', 'Immeubles gérés'), sub: t('syndicDash.immeubles.activePortfolio', 'Portefeuille actif'), color: 'var(--sd-navy)', barColor: 'var(--sd-navy)' },
          { num: totalLots, label: t('syndicDash.immeubles.totalLots', 'Lots totaux'), sub: t('syndicDash.immeubles.totalFractions', 'Fractions totales'), color: 'var(--sd-gold)', barColor: 'var(--sd-gold)' },
          { num: totalInterventions, label: t('syndicDash.immeubles.activeInterventions', 'Interventions actives'), sub: t('syndicDash.immeubles.ongoing', 'En cours'), color: '#1A7A6E', barColor: '#1A7A6E' },
          { num: docsManquants, label: t('syndicDash.immeubles.missingDocs', 'Docs manquants'), sub: t('syndicDash.immeubles.regulationsToAdd', 'Règlements à ajouter'), color: '#D4830A', barColor: '#D4830A' },
        ].map((kpi, idx) => (
          <div key={idx} style={{ background: '#fff', border: '1px solid var(--sd-border)', borderRadius: 14, padding: '20px 22px', position: 'relative', overflow: 'hidden', transition: 'transform 0.18s, box-shadow 0.18s', cursor: 'default' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 28px rgba(13,27,46,0.08)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
          >
            <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 38, lineHeight: 1, color: kpi.color }}>{kpi.num}</p>
            <p style={{ fontSize: 12, color: 'var(--sd-ink-3)', marginTop: 6 }}>{kpi.label}</p>
            <p style={{ fontSize: 10, color: 'var(--sd-ink-3)', marginTop: 2 }}>{kpi.sub}</p>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: kpi.barColor, borderRadius: '0 0 14px 14px' }} />
          </div>
        ))}
      </div>

      {/* ── Building Cards ── */}
      {immeubles.map(i => {
        const budgetPct = i.budgetAnnuel > 0 ? Math.min((i.depensesAnnee / i.budgetAnnuel) * 100, 100) : 0
        return (
        <div key={i.id} style={{ background: '#fff', border: '1px solid var(--sd-border)', borderRadius: 16, overflow: 'hidden', marginBottom: 16, boxShadow: '0 1px 6px rgba(13,27,46,0.05)', transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 28px rgba(13,27,46,0.09)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,168,76,0.28)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 6px rgba(13,27,46,0.05)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--sd-border)' }}
        >
          {/* Card Header */}
          <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid var(--sd-border)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: 'linear-gradient(135deg, var(--sd-cream-dark, #EDE8DF), #D4CCBE)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, flexShrink: 0, border: '1px solid var(--sd-border)' }}>🏛️</div>
              <div>
                <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, color: 'var(--sd-navy)', marginBottom: 3 }}>{i.nom}</h3>
                <p style={{ fontSize: 12, color: 'var(--sd-ink-3)', marginBottom: 8 }}>📍 {i.adresse}, {i.codePostal} {i.ville}</p>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: 'rgba(13,27,46,0.05)', color: 'var(--sd-navy)', border: '1px solid rgba(13,27,46,0.1)' }}>
                    🏠 {i.nbLots} {t('syndicDash.immeubles.nbLots')}
                  </span>
                  {i.anneeConstruction > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: 'var(--sd-cream)', color: 'var(--sd-ink-2)', border: '1px solid var(--sd-border)' }}>
                      🗓 {t('syndicDash.immeubles.builtIn', 'Construit en')} {i.anneeConstruction}
                    </span>
                  )}
                  {!i.reglementTexte && !i.reglementPdfNom && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: '#FEF5E4', color: '#D4830A', border: '1px solid rgba(212,131,10,0.2)' }}>
                      ⚠️ {t('syndicDash.immeubles.missingRegulation', 'Règlement manquant')}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/* Actions */}
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => openEditImmeuble(i)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: 'var(--sd-cream)', color: 'var(--sd-ink-2)', border: '1px solid var(--sd-border)', fontFamily: "'Outfit',sans-serif", transition: 'all 0.14s' }}>
                ✏️ {t('syndicDash.immeubles.editBtn')}
              </button>
              <button onClick={() => handleDeleteImmeuble(i.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 8, fontSize: 14, cursor: 'pointer', background: '#FDECEA', color: '#C0392B', border: '1px solid rgba(192,57,43,0.18)', transition: 'all 0.14s' }}>
                🗑
              </button>
              <button onClick={() => setShowModalMission(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: 'var(--sd-navy)', color: '#fff', border: '1px solid var(--sd-navy)', fontFamily: "'Outfit',sans-serif", transition: 'all 0.14s' }}>
                + Mission
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderBottom: '1px solid var(--sd-border)' }}>
            {[
              { val: String(i.nbLots), label: t('syndicDash.immeubles.nbLots').toUpperCase(), sub: t('syndicDash.immeubles.totalFractions', 'Fractions totales') },
              { val: String(i.anneeConstruction || '—'), label: t('syndicDash.immeubles.yearBuilt').toUpperCase(), sub: '' },
              { val: String(i.nbInterventions), label: t('syndicDash.accueil.interventions').toUpperCase(), sub: t('syndicDash.immeubles.ongoing', 'En cours') },
              { val: i.prochainControle ? new Date(i.prochainControle).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: '2-digit', month: 'short' }) : 'N/A', label: t('syndicDash.immeubles.nextControl').toUpperCase(), sub: i.prochainControle ? '' : t('syndicDash.immeubles.notPlanned', 'Non planifié'), muted: !i.prochainControle },
            ].map((s, idx) => (
              <div key={idx} style={{ padding: '16px 22px', borderRight: idx < 3 ? '1px solid var(--sd-border)' : 'none' }}>
                <p style={{ fontFamily: s.muted ? "'Outfit',sans-serif" : "'Playfair Display',serif", fontSize: s.muted ? 18 : 24, color: s.muted ? 'var(--sd-ink-3)' : 'var(--sd-navy)', lineHeight: 1, marginBottom: 3, fontStyle: s.muted ? 'italic' : 'normal' }}>{s.val}</p>
                <p style={{ fontSize: 11, color: 'var(--sd-ink-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</p>
                {s.sub && <p style={{ fontSize: 10, color: 'var(--sd-ink-3)', marginTop: 2 }}>{s.sub}</p>}
              </div>
            ))}
          </div>

          {/* Budget Row */}
          <div style={{ padding: '13px 24px', background: 'var(--sd-cream)', borderBottom: '1px solid var(--sd-border)', display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 12, color: 'var(--sd-ink-2)', fontWeight: 500, whiteSpace: 'nowrap' }}>📊 {t('syndicDash.accueil.budget')} {new Date().getFullYear()}</span>
            <div style={{ flex: 1, height: 5, background: 'var(--sd-cream)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--sd-border)' }}>
              <div style={{ height: '100%', borderRadius: 10, background: budgetPct > 85 ? '#C0392B' : 'linear-gradient(90deg, var(--sd-gold), #E2B84A)', width: `${budgetPct}%` }} />
            </div>
            <span style={{ fontSize: 12, color: 'var(--sd-navy)', fontWeight: 500, whiteSpace: 'nowrap' }}>
              {i.depensesAnnee.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} € <span style={{ color: 'var(--sd-ink-3)', fontWeight: 400 }}>/ {i.budgetAnnuel.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</span>
            </span>
          </div>

          {/* Footer */}
          <div style={{ padding: '11px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {(!i.reglementTexte && !i.reglementPdfNom) ? (
              <button onClick={() => openEditImmeuble(i)} style={{ fontSize: 12, color: '#D4830A', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', background: 'none', border: 'none', fontFamily: "'Outfit',sans-serif", transition: 'opacity 0.15s' }}>
                📄 {t('syndicDash.immeubles.addRegulation')}
              </button>
            ) : (
              <button onClick={() => openEditImmeuble(i)} style={{ fontSize: 12, color: 'var(--sd-gold)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', background: 'none', border: 'none', fontFamily: "'Outfit',sans-serif" }}>
                📜 {t('syndicDash.immeubles.coproRegulation')}
              </button>
            )}
            <div style={{ display: 'flex', gap: 18 }}>
              <button onClick={() => setPage('coproprios')} style={{ fontSize: 12, color: 'var(--sd-ink-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', fontFamily: "'Outfit',sans-serif", transition: 'color 0.14s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--sd-navy)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--sd-ink-3)' }}
              >👥 {t('syndicDash.sidebar.coowners')}</button>
              <button onClick={() => setPage('documents')} style={{ fontSize: 12, color: 'var(--sd-ink-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', fontFamily: "'Outfit',sans-serif", transition: 'color 0.14s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--sd-navy)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--sd-ink-3)' }}
              >📁 {t('syndicDash.sidebar.documents')}</button>
              <button onClick={() => setPage('docs_interventions')} style={{ fontSize: 12, color: 'var(--sd-ink-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', fontFamily: "'Outfit',sans-serif", transition: 'color 0.14s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--sd-navy)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--sd-ink-3)' }}
              >🔧 {t('syndicDash.immeubles.history', 'Historique')}</button>
            </div>
          </div>
        </div>
      )})}

      {/* ── Add Building Placeholder ── */}
      <div
        onClick={openAddImmeuble}
        style={{ border: '2px dashed rgba(201,168,76,0.3)', borderRadius: 16, minHeight: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', color: 'var(--sd-ink-3)', fontSize: 13, transition: 'all 0.18s', background: 'rgba(201,168,76,0.02)' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--sd-gold)'; (e.currentTarget as HTMLElement).style.color = 'var(--sd-navy)'; (e.currentTarget as HTMLElement).style.background = 'rgba(201,168,76,0.06)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,168,76,0.3)'; (e.currentTarget as HTMLElement).style.color = 'var(--sd-ink-3)'; (e.currentTarget as HTMLElement).style.background = 'rgba(201,168,76,0.02)' }}
      >
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(201,168,76,0.14)', color: 'var(--sd-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 300 }}>+</div>
        <div>
          <div style={{ fontWeight: 500 }}>{t('syndicDash.immeubles.addBuilding')}</div>
          <div style={{ fontSize: 12, marginTop: 2 }}>{t('syndicDash.immeubles.managePortfolio', 'Gérez votre portefeuille immobilier')}</div>
        </div>
      </div>
    </div>

    {/* ── Modal Ajouter/Modifier un Immeuble ── */}
    {showModalImmeuble && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingImmeuble ? (locale === 'pt' ? '✏️ Modificar o edifício' : '✏️ Modifier l\'immeuble') : (locale === 'pt' ? '🏢 Adicionar um edifício' : '🏢 Ajouter un immeuble')}
              </h2>
              <button onClick={() => setShowModalImmeuble(false)} aria-label={t('syndicDash.common.close')} className="text-gray-500 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'Nome do edifício *' : 'Nom de l\'immeuble *'}</label>
                <input
                  type="text"
                  value={immeubleForm.nom || ''}
                  onChange={e => setImmeubleForm(f => ({ ...f, nom: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]"
                  placeholder={locale === 'pt' ? 'Residência As Acácias' : 'Résidence Les Acacias'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'Morada *' : 'Adresse *'}</label>
                <input
                  type="text"
                  value={immeubleForm.adresse || ''}
                  onChange={e => setImmeubleForm(f => ({ ...f, adresse: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]"
                  placeholder={locale === 'pt' ? 'Rua das Acácias, 12' : '12 rue des Acacias'}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'Código postal' : 'Code postal'}</label>
                  <input
                    type="text"
                    value={immeubleForm.codePostal || ''}
                    onChange={e => setImmeubleForm(f => ({ ...f, codePostal: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]"
                    placeholder="75008"
                    maxLength={5}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'Cidade' : 'Ville'}</label>
                  <input
                    type="text"
                    value={immeubleForm.ville || ''}
                    onChange={e => setImmeubleForm(f => ({ ...f, ville: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]"
                    placeholder={locale === 'pt' ? 'Lisboa' : 'Paris'}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'Número de frações' : 'Nombre de lots'}</label>
                  <input
                    type="number"
                    min={1}
                    value={immeubleForm.nbLots || 1}
                    onChange={e => setImmeubleForm(f => ({ ...f, nbLots: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'Ano de construção' : 'Année de construction'}</label>
                  <input
                    type="number"
                    min={1800}
                    max={new Date().getFullYear()}
                    value={immeubleForm.anneeConstruction || 2000}
                    onChange={e => setImmeubleForm(f => ({ ...f, anneeConstruction: parseInt(e.target.value) || 2000 }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'Tipo' : 'Type'}</label>
                  <select
                    value={immeubleForm.typeImmeuble || (locale === 'pt' ? 'Condomínio' : 'Copropriété')}
                    onChange={e => setImmeubleForm(f => ({ ...f, typeImmeuble: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]"
                  >
                    <option>{locale === 'pt' ? 'Condomínio' : 'Copropriété'}</option>
                    <option>{locale === 'pt' ? 'Residência' : 'Résidence'}</option>
                    <option>{locale === 'pt' ? 'Edifício misto' : 'Immeuble mixte'}</option>
                    <option>{locale === 'pt' ? 'Parque residencial' : 'Parc résidentiel'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'Gestor' : 'Gestionnaire'}</label>
                  <input
                    type="text"
                    value={immeubleForm.gestionnaire || ''}
                    onChange={e => setImmeubleForm(f => ({ ...f, gestionnaire: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]"
                    placeholder={locale === 'pt' ? 'João Silva' : 'Jean Dupont'}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'Orçamento anual (€)' : 'Budget annuel (€)'}</label>
                  <input
                    type="number"
                    min={0}
                    value={immeubleForm.budgetAnnuel || 0}
                    onChange={e => setImmeubleForm(f => ({ ...f, budgetAnnuel: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{locale === 'pt' ? 'Próximo controlo' : 'Prochain contrôle'}</label>
                  <input
                    type="date"
                    value={immeubleForm.prochainControle || ''}
                    onChange={e => setImmeubleForm(f => ({ ...f, prochainControle: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]"
                  />
                </div>
              </div>
              {/* ── Section Règlement de copropriété ── */}
              <div className="border-t border-gray-100 pt-4 mt-2">
                <p className="text-sm font-semibold text-gray-700 mb-3">📜 {locale === 'pt' ? 'Regulamento de condomínio' : 'Règlement de copropriété'}</p>
                <div className="space-y-3">
                  {/* Upload PDF ou texte */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{locale === 'pt' ? 'Importar o regulamento (PDF ou texto)' : 'Importer le règlement (PDF ou texte)'}</label>
                    <div className="flex gap-2 items-center">
                      <label className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-dashed border-[#C9A84C] bg-[#F7F4EE] hover:bg-[#F7F4EE] rounded-lg text-xs text-[#C9A84C] font-medium transition flex-1">
                        <span>📄</span>
                        <span>{immeubleForm.reglementPdfNom || (locale === 'pt' ? 'Escolher um PDF…' : 'Choisir un PDF…')}</span>
                        <input
                          type="file"
                          accept=".pdf,.txt,.doc,.docx"
                          className="hidden"
                          onChange={async e => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            setImmeubleForm(f => ({ ...f, reglementPdfNom: file.name, reglementDateMaj: new Date().toISOString().split('T')[0] }))
                            if (file.type === 'text/plain') {
                              const text = await file.text()
                              setImmeubleForm(f => ({ ...f, reglementTexte: text }))
                            }
                          }}
                        />
                      </label>
                      {immeubleForm.reglementPdfNom && (
                        <button onClick={() => setImmeubleForm(f => ({ ...f, reglementPdfNom: '', reglementTexte: '' }))} aria-label={t('syndicDash.common.delete')} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                      )}
                    </div>
                  </div>
                  {/* Texte libre */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{locale === 'pt' ? 'Texto do regulamento' : 'Texte du règlement'} <span className="text-gray-500">{locale === 'pt' ? '(colar ou digitar)' : '(coller ou saisir)'}</span></label>
                    <textarea
                      rows={5}
                      value={immeubleForm.reglementTexte || ''}
                      onChange={e => setImmeubleForm(f => ({ ...f, reglementTexte: e.target.value, reglementDateMaj: new Date().toISOString().split('T')[0] }))}
                      placeholder={locale === 'pt' ? 'Cole aqui o texto do regulamento de condomínio, ou os artigos importantes (repartição de encargos, maiorias AG, fundo de reserva…)' : 'Collez ici le texte du règlement de copropriété, ou les articles importants (répartition des charges, majorités AG, fonds de travaux…)'}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#C9A84C] resize-none font-mono leading-relaxed"
                    />
                  </div>
                  {/* Métadonnées clés */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">{locale === 'pt' ? 'Repartição de encargos' : 'Répartition des charges'}</label>
                      <input
                        type="text"
                        value={immeubleForm.reglementChargesRepartition || ''}
                        onChange={e => setImmeubleForm(f => ({ ...f, reglementChargesRepartition: e.target.value }))}
                        placeholder={locale === 'pt' ? 'Ex: permilagem / milésimos' : 'Ex: tantièmes / millièmes'}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#C9A84C]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">{locale === 'pt' ? 'Maiorias AG (art. 24/25/26)' : 'Majorités AG (art. 24/25/26)'}</label>
                      <input
                        type="text"
                        value={immeubleForm.reglementMajoriteAG || ''}
                        onChange={e => setImmeubleForm(f => ({ ...f, reglementMajoriteAG: e.target.value }))}
                        placeholder={locale === 'pt' ? 'Ex: art.24 maioria simples…' : 'Ex: art.24 majorité simple…'}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#C9A84C]"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!immeubleForm.reglementFondsTravaux}
                        onChange={e => setImmeubleForm(f => ({ ...f, reglementFondsTravaux: e.target.checked }))}
                        className="rounded"
                      />
                      {locale === 'pt' ? 'Fundo de reserva obrigatório (art. 14-2)' : 'Fonds de travaux obligatoire (art. 14-2)'}
                    </label>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500">{locale === 'pt' ? 'Fundo maneio (%)' : 'Fonds roulement (%)'}</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={immeubleForm.reglementFondsRoulementPct ?? ''}
                        onChange={e => setImmeubleForm(f => ({ ...f, reglementFondsRoulementPct: parseFloat(e.target.value) || 0 }))}
                        placeholder="0"
                        className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#C9A84C]"
                      />
                    </div>
                  </div>
                  {immeubleForm.reglementDateMaj && (
                    <p className="text-xs text-gray-500">{locale === 'pt' ? 'Última atualização' : 'Dernière mise à jour'} : {new Date(immeubleForm.reglementDateMaj).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModalImmeuble(false)} className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition">
                  {locale === 'pt' ? 'Cancelar' : 'Annuler'}
                </button>
                <button
                  onClick={handleSaveImmeuble}
                  disabled={!immeubleForm.nom?.trim() || !immeubleForm.adresse?.trim()}
                  className="flex-1 px-4 py-2 bg-[#0D1B2E] hover:bg-[#152338] text-white rounded-lg text-sm font-semibold transition disabled:opacity-40"
                >
                  {editingImmeuble ? (locale === 'pt' ? '✅ Guardar' : '✅ Sauvegarder') : (locale === 'pt' ? '+ Adicionar o edifício' : '+ Ajouter l\'immeuble')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
