'use client'

import React from 'react'
import { CATEGORIES } from './shared'

interface MarchesPrefs {
  marches_opt_in: boolean
  marches_categories: string[]
  marches_work_mode: string
  marches_tarif_journalier: number | null
  marches_tarif_horaire: number | null
  marches_description: string
}

interface SettingsTabViewProps {
  isPt: boolean
  marchesPrefs: MarchesPrefs
  prefsSaving: boolean
  onPrefsChange: (updater: (prev: MarchesPrefs) => MarchesPrefs) => void
  onSave: () => void
}

export default function SettingsTabView({
  isPt, marchesPrefs, prefsSaving, onPrefsChange, onSave,
}: SettingsTabViewProps) {
  return (
    <div style={{ maxWidth: 560 }}>
      {/* 1. Opt-in toggle */}
      <div className="v22-card" style={{ marginBottom: 14 }}>
        <div className="v22-card-head">
          <div className="v22-card-title">
            {isPt ? 'Receber propostas de mercados' : 'Recevoir des propositions de marchés'}
          </div>
        </div>
        <div className="v22-card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              onClick={() => onPrefsChange(p => ({ ...p, marches_opt_in: !p.marches_opt_in }))}
              style={{
                width: 36, height: 20, borderRadius: 10, position: 'relative', cursor: 'pointer',
                background: marchesPrefs.marches_opt_in ? 'var(--v22-green)' : 'var(--v22-border)',
                transition: 'background 0.15s',
              }}
            >
              <div style={{
                position: 'absolute', top: 2, width: 16, height: 16, borderRadius: '50%',
                background: 'var(--v22-surface)', transition: 'left 0.15s',
                left: marchesPrefs.marches_opt_in ? 18 : 2,
                boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
              }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: marchesPrefs.marches_opt_in ? 'var(--v22-green)' : 'var(--v22-text-muted)' }}>
              {marchesPrefs.marches_opt_in
                ? (isPt ? 'Ativado' : 'Activé')
                : (isPt ? 'Desativado' : 'Désactivé')}
            </span>
          </div>
          {!marchesPrefs.marches_opt_in && (
            <div style={{ marginTop: 10, borderRadius: 3, background: 'var(--v22-bg)', border: '1px solid var(--v22-border)', padding: '8px 10px', fontSize: 12, color: 'var(--v22-text-muted)' }}>
              {isPt
                ? 'Não receberá notificações para novos mercados'
                : 'Vous ne recevrez plus de notifications pour les nouveaux marchés'}
            </div>
          )}
        </div>
      </div>

      {/* 2. Categories checkboxes */}
      <div className="v22-card" style={{ marginBottom: 14, opacity: !marchesPrefs.marches_opt_in ? 0.5 : 1, pointerEvents: !marchesPrefs.marches_opt_in ? 'none' : undefined }}>
        <div className="v22-card-head">
          <div className="v22-card-title">
            {isPt ? 'As minhas especialidades' : 'Mes spécialités'}
          </div>
        </div>
        <div className="v22-card-body">
          <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', marginBottom: 10 }}>
            {isPt
              ? 'Selecione as categorias de trabalho que lhe interessam'
              : 'Sélectionnez les catégories de travaux qui vous intéressent'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {CATEGORIES.map(cat => {
              const checked = marchesPrefs.marches_categories.includes(cat.id)
              return (
                <label
                  key={cat.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, borderRadius: 3, cursor: 'pointer',
                    border: checked ? '1px solid var(--v22-yellow)' : '1px solid var(--v22-border)',
                    background: checked ? 'var(--v22-yellow-light)' : 'var(--v22-surface)',
                    padding: '6px 8px', fontSize: 12, transition: 'all 0.1s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      onPrefsChange(p => ({
                        ...p,
                        marches_categories: checked
                          ? p.marches_categories.filter(c => c !== cat.id)
                          : [...p.marches_categories, cat.id],
                      }))
                    }}
                    style={{ display: 'none' }}
                  />
                  <div style={{
                    width: 14, height: 14, borderRadius: 2, flexShrink: 0,
                    border: checked ? '2px solid var(--v22-yellow)' : '2px solid var(--v22-border-dark)',
                    background: checked ? 'var(--v22-yellow)' : 'var(--v22-surface)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.1s',
                  }}>
                    {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <span>{cat.emoji} {isPt ? cat.label : cat.labelFr}</span>
                </label>
              )
            })}
          </div>
        </div>
      </div>

      {/* 3. Work mode radio */}
      <div className="v22-card" style={{ marginBottom: 14, opacity: !marchesPrefs.marches_opt_in ? 0.5 : 1, pointerEvents: !marchesPrefs.marches_opt_in ? 'none' : undefined }}>
        <div className="v22-card-head">
          <div className="v22-card-title">
            {isPt ? 'O meu modo de trabalho' : 'Mon mode de travail'}
          </div>
        </div>
        <div className="v22-card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
            {([
              { value: 'forfait', emoji: '💼', fr: 'Forfait', pt: 'Forfait', desc_fr: 'Prix fixe pour la mission', desc_pt: 'Preço fixo para a missão' },
              { value: 'journee', emoji: '📅', fr: 'À la journée', pt: 'Por dia', desc_fr: 'Tarif journalier', desc_pt: 'Tarifa diária' },
              { value: 'horaire', emoji: '⏰', fr: 'À l\'heure', pt: 'Por hora', desc_fr: 'Tarif horaire', desc_pt: 'Tarifa por hora' },
              { value: 'tache', emoji: '✅', fr: 'À la tâche', pt: 'Por tarefa', desc_fr: 'Prix défini par candidature', desc_pt: 'Preço definido por candidatura' },
            ] as const).map(mode => {
              const selected = marchesPrefs.marches_work_mode === mode.value
              return (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => onPrefsChange(p => ({ ...p, marches_work_mode: mode.value }))}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
                    borderRadius: 3, padding: '10px 12px', textAlign: 'left',
                    border: selected ? '2px solid var(--v22-yellow)' : '1px solid var(--v22-border)',
                    background: selected ? 'var(--v22-yellow-light)' : 'var(--v22-surface)',
                    cursor: 'pointer', transition: 'all 0.1s',
                  }}
                >
                  <span style={{ fontSize: 16 }}>{mode.emoji}</span>
                  <span style={{ fontSize: 12, fontWeight: selected ? 600 : 400 }}>
                    {isPt ? mode.pt : mode.fr}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--v22-text-muted)' }}>{isPt ? mode.desc_pt : mode.desc_fr}</span>
                </button>
              )
            })}
          </div>

          {/* Tariff inputs based on work mode */}
          {marchesPrefs.marches_work_mode === 'journee' && (
            <div style={{ marginTop: 10 }}>
              <label className="v22-form-label">
                {isPt ? 'Tarifa diária (€)' : 'Tarif journalier (€)'}
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={marchesPrefs.marches_tarif_journalier ?? ''}
                onChange={e => onPrefsChange(p => ({ ...p, marches_tarif_journalier: e.target.value ? Number(e.target.value) : null }))}
                placeholder="ex: 350"
                className="v22-form-input"
              />
            </div>
          )}
          {marchesPrefs.marches_work_mode === 'horaire' && (
            <div style={{ marginTop: 10 }}>
              <label className="v22-form-label">
                {isPt ? 'Tarifa por hora (€)' : 'Tarif horaire (€)'}
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={marchesPrefs.marches_tarif_horaire ?? ''}
                onChange={e => onPrefsChange(p => ({ ...p, marches_tarif_horaire: e.target.value ? Number(e.target.value) : null }))}
                placeholder="ex: 45"
                className="v22-form-input"
              />
            </div>
          )}
        </div>
      </div>

      {/* 4. Description textarea */}
      <div className="v22-card" style={{ marginBottom: 14, opacity: !marchesPrefs.marches_opt_in ? 0.5 : 1, pointerEvents: !marchesPrefs.marches_opt_in ? 'none' : undefined }}>
        <div className="v22-card-head">
          <div className="v22-card-title">
            {isPt ? 'Apresentação bolsa de mercados' : 'Présentation bourse aux marchés'}
          </div>
        </div>
        <div className="v22-card-body">
          <textarea
            value={marchesPrefs.marches_description}
            onChange={e => onPrefsChange(p => ({ ...p, marches_description: e.target.value.slice(0, 2000) }))}
            rows={5}
            maxLength={2000}
            placeholder={isPt
              ? 'Descreva a sua empresa, experiência e competências principais...'
              : 'Décrivez votre entreprise, expérience et compétences principales...'}
            className="v22-form-input"
            style={{ resize: 'none' }}
          />
          <div className="v22-mono" style={{ marginTop: 4, fontSize: 10, color: 'var(--v22-text-muted)', textAlign: 'right' }}>
            {marchesPrefs.marches_description.length}/2000
          </div>
        </div>
      </div>

      {/* Save button */}
      <button
        type="button"
        onClick={onSave}
        disabled={prefsSaving}
        className="v22-btn v22-btn-primary"
        style={{ width: '100%', padding: '8px 16px', fontSize: 13, opacity: prefsSaving ? 0.5 : 1, cursor: prefsSaving ? 'not-allowed' : 'pointer' }}
      >
        {prefsSaving
          ? (isPt ? 'A guardar...' : 'Enregistrement...')
          : (isPt ? 'Guardar preferências' : 'Enregistrer les préférences')}
      </button>
    </div>
  )
}
