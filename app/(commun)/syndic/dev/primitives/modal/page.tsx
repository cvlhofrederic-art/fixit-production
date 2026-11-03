'use client'

import { useEffect, useState } from 'react'
import { Modal, ModalHead, ModalBody, ModalFoot } from '@/components/syndic-dashboard/v54/primitives/modal'
import { Field } from '@/components/syndic-dashboard/v54/primitives/field'
import { FormRow } from '@/components/syndic-dashboard/v54/primitives/form-row'

const sectionHeader: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
  color: 'var(--v54-gold-700)', fontWeight: 600, margin: '32px 0 16px',
}

const btnGold: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 'var(--v54-r-sm)', border: 'none',
  background: 'var(--v54-gold-500)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
const btnGhost: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 'var(--v54-r-sm)', border: '1px solid var(--v54-line)',
  background: 'transparent', color: 'var(--v54-navy-700)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
}

export default function ModalShowcasePage() {
  const [formOpen, setFormOpen] = useState(false)
  const [sizeOpen, setSizeOpen] = useState<null | 'sm' | 'md' | 'lg'>(null)

  // Marqueur d'hydratation : les E2E clavier/focus attendent ce flag (le pattern
  // focus-trap exige React hydraté → validé en build prod, cf. .claude/rules/testing.md).
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    setHydrated(true)
  }, [])

  return (
    <div data-hydrated={hydrated ? 'true' : undefined}>
      <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--v54-gold-700)', fontWeight: 600, marginBottom: 12 }}>
        Primitive · batch 6
      </p>
      <h1 style={{ fontFamily: 'var(--v54-font-serif)', fontWeight: 500, fontSize: 32, margin: 0 }}>Modal</h1>
      <p style={{ fontSize: 14, color: 'var(--v54-navy-300)', marginTop: 8, maxWidth: 640 }}>
        Dialogue modal (portal vers body). Focus trap WAI-ARIA : focus initial, Tab/Shift+Tab cyclique,
        ESC ferme, clic backdrop ferme, restauration du focus. Durcissements : <code>inert</code> sur le fond,
        re-query des focusables au Tab, compensation scrollbar.
      </p>

      <h2 style={sectionHeader}>Form modal (md)</h2>
      <div data-testid="modal-demo">
        <button type="button" style={btnGold} data-testid="open-modal" onClick={() => setFormOpen(true)}>
          Nova intervenção
        </button>

        <Modal open={formOpen} onClose={() => setFormOpen(false)} labelledBy="demo-modal-title" size="md">
          <ModalHead icon="wrench" id="demo-modal-title" title="Nova intervenção" onClose={() => setFormOpen(false)} />
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              setFormOpen(false)
            }}
          >
            <ModalBody>
              <FormRow>
                <Field label="Título" name="ticket-title" required>
                  <input type="text" placeholder="Ex.: Infiltração garagem -2" />
                </Field>
                <Field label="Prioridade" name="ticket-priority">
                  <select defaultValue="normal">
                    <option value="baixa">Baixa</option>
                    <option value="normal">Normal</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </Field>
              </FormRow>
              <Field label="Descrição" name="ticket-desc" full hint="Visível para os fornecedores convidados.">
                <textarea rows={3} placeholder="Detalhe o problema…" />
              </Field>
            </ModalBody>
            <ModalFoot>
              <button type="button" style={btnGhost} className="btn ghost" onClick={() => setFormOpen(false)}>
                Cancelar
              </button>
              <button type="submit" style={btnGold} className="btn gold" data-testid="modal-submit">
                Criar intervenção
              </button>
            </ModalFoot>
          </form>
        </Modal>
      </div>

      <h2 style={sectionHeader}>Tailles (sm · md · lg)</h2>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {(['sm', 'md', 'lg'] as const).map((s) => (
          <button key={s} type="button" style={btnGhost} onClick={() => setSizeOpen(s)} data-testid={`open-${s}`}>
            Ouvrir {s}
          </button>
        ))}
      </div>
      <Modal open={sizeOpen !== null} onClose={() => setSizeOpen(null)} labelledBy="size-modal-title" size={sizeOpen ?? 'md'}>
        <ModalHead icon="info" id="size-modal-title" title={`Modal ${sizeOpen ?? ''}`} onClose={() => setSizeOpen(null)} />
        <ModalBody>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--v54-navy-700)' }}>
            Largeur max : sm 420 · md 580 · lg 720. Le corps défile (<code>overflow-y:auto</code>) au-delà de
            <code> calc(100vh - 48px)</code>.
          </p>
        </ModalBody>
        <ModalFoot>
          <button type="button" style={btnGhost} className="btn ghost" onClick={() => setSizeOpen(null)}>
            Fechar
          </button>
        </ModalFoot>
      </Modal>
    </div>
  )
}
