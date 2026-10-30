'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// Bandeau du rapport rédigé automatiquement pour une intervention (texte du rapport IA, modifiable avant envoi), affiché
// par components/pro-mobile/pages/MobileDocumentsSection.tsx. La page de l'app mobile en gardait une copie inutilisée.
export default function RapportIABandeau({ bookingId }: Readonly<{ bookingId: string }>) {
  const [contenu, setContenu] = useState<{ introduction?: string; travaux_realises?: string; observations?: string; conclusion?: string; source?: string } | null>(null)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({ introduction: '', travaux_realises: '', observations: '', conclusion: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!bookingId) return
    supabase.from('bookings').select('rapport_ia_texte_brut, rapport_ia_source').eq('id', bookingId).maybeSingle()
      .then(({ data }) => {
        if (data?.rapport_ia_texte_brut) {
          try {
            const parsed = JSON.parse(data.rapport_ia_texte_brut)
            setContenu(parsed)
            setEditData({
              introduction: parsed.introduction || '',
              travaux_realises: parsed.travaux_realises || '',
              observations: parsed.observations || '',
              conclusion: parsed.conclusion || '',
            })
          } catch { /* invalid JSON */ }
        }
      })
  }, [bookingId])

  if (!contenu?.introduction) return null

  const handleSave = async () => {
    setSaving(true)
    const updated = { ...contenu, ...editData }
    await supabase.from('bookings').update({
      rapport_ia_texte_brut: JSON.stringify(updated),
      rapport_ia_source: 'manuel',
    }).eq('id', bookingId)
    setContenu(updated)
    setEditing(false)
    setSaving(false)
  }

  return (
    <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-emerald-700">
          ✨ Texte rédigé automatiquement
        </span>
        <button
          onClick={() => setEditing(!editing)}
          className="text-xs font-semibold text-emerald-600 underline"
        >
          {editing ? 'Fermer' : 'Modifier'}
        </button>
      </div>
      <p className="text-[11px] text-emerald-600 mb-1">
        Généré depuis les données du chantier. Modifiable avant envoi.
      </p>
      {editing && (
        <div className="space-y-2 mt-2">
          {(['introduction', 'travaux_realises', 'observations', 'conclusion'] as const).map(field => (
            <div key={field}>
              <label className="text-[10px] font-bold text-gray-500 uppercase">{
                field === 'travaux_realises' ? 'Travaux réalisés' :
                field.charAt(0).toUpperCase() + field.slice(1)
              }</label>
              <textarea
                value={editData[field]}
                onChange={e => setEditData(prev => ({ ...prev, [field]: e.target.value }))}
                rows={2}
                className="w-full text-xs border border-gray-200 rounded-lg p-2 mt-0.5 resize-none focus:ring-1 focus:ring-emerald-300 focus:border-emerald-300"
              />
            </div>
          ))}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-emerald-600 text-white text-xs font-bold py-2 rounded-xl active:scale-95 transition"
            style={{ opacity: saving ? 0.5 : 1 }}
          >
            {saving ? '⏳ Enregistrement...' : '💾 Sauvegarder les modifications'}
          </button>
        </div>
      )}
    </div>
  )
}
