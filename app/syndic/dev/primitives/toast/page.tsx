'use client'

import { useEffect, useState } from 'react'
import { ToastProvider, useToast, type ToastKind } from '@/components/syndic-dashboard/v54/primitives/toast'
import { Modal, ModalHead, ModalBody, ModalFoot } from '@/components/syndic-dashboard/v54/primitives/modal'

const sectionHeader: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
  color: 'var(--v54-gold-700)', fontWeight: 600, margin: '32px 0 16px',
}
const btn: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 'var(--v54-r-sm)', border: '1px solid var(--v54-line)',
  background: 'transparent', color: 'var(--v54-navy-700)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
const btnGold: React.CSSProperties = { ...btn, border: 'none', background: 'var(--v54-gold-500)', color: '#fff' }

const KINDS: { kind: ToastKind; title: string; desc: string }[] = [
  { kind: 'success', title: 'Intervenção criada', desc: 'O fornecedor foi notificado.' },
  { kind: 'info', title: 'Sincronização em curso', desc: 'Atualização dos dados do condomínio.' },
  { kind: 'warning', title: 'Quota por regularizar', desc: 'Vence em 3 dias.' },
  { kind: 'error', title: 'Falha no envio', desc: 'Tente novamente (persistente).' },
]

function Demo() {
  const { push } = useToast()
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div data-testid="toast-demo">
      <h2 style={sectionHeader}>4 kinds (success 4s · info 5s · warning 6s · error persistant)</h2>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            style={btn}
            data-testid={`push-${k.kind}`}
            onClick={() => push({ kind: k.kind, title: k.title, desc: k.desc })}
          >
            {k.kind}
          </button>
        ))}
      </div>

      <h2 style={sectionHeader}>Cap 3 (FIFO) · pause au survol / focus</h2>
      <button
        type="button"
        style={btn}
        data-testid="push-flood"
        onClick={() => KINDS.forEach((k, i) => push({ kind: k.kind, title: `${k.title} #${i + 1}` }))}
      >
        Empiler 4 (le plus ancien tombe)
      </button>

      <h2 style={sectionHeader}>Interaction Modal (inert — #253)</h2>
      <button type="button" style={btnGold} data-testid="open-modal-toast" onClick={() => setModalOpen(true)}>
        Ouvrir un modal
      </button>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} labelledBy="toast-modal-title" size="sm">
        <ModalHead icon="bell" id="toast-modal-title" title="Modal ouvert" onClose={() => setModalOpen(false)} />
        <ModalBody>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--v54-navy-700)' }}>
            Pousser un toast pendant que ce modal est ouvert : le viewport (dans le wrapper app) est neutralisé
            par l’<code>inert</code> du modal — les toasts attendent la fermeture (option 1, #253).
          </p>
        </ModalBody>
        <ModalFoot>
          <button
            type="button"
            style={btn}
            data-testid="push-from-modal"
            onClick={() => push({ kind: 'error', title: 'Erro durante modal', desc: 'Inerté até fechar.' })}
          >
            Pousser un toast (error)
          </button>
          <button type="button" style={btnGold} onClick={() => setModalOpen(false)}>
            Fechar
          </button>
        </ModalFoot>
      </Modal>
    </div>
  )
}

export default function ToastShowcasePage() {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    setHydrated(true)
  }, [])

  return (
    <div data-hydrated={hydrated ? 'true' : undefined}>
      <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--v54-gold-700)', fontWeight: 600, marginBottom: 12 }}>
        Primitive · batch 7
      </p>
      <h1 style={{ fontFamily: 'var(--v54-font-serif)', fontWeight: 500, fontSize: 32, margin: 0 }}>Toast</h1>
      <p style={{ fontSize: 14, color: 'var(--v54-navy-300)', marginTop: 8, maxWidth: 640 }}>
        Notifications empilées (viewport fixe bas-droite, inline — pas de portal). 4 kinds, auto-dismiss par kind,
        cap 3 FIFO, pause au survol et au focus. <code>useToast().push(&#123;kind,title,desc&#125;)</code>.
      </p>

      <ToastProvider>
        <Demo />
      </ToastProvider>
    </div>
  )
}
