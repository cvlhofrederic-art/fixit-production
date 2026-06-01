'use client'

import { useState } from 'react'
import { PageHead } from '../primitives/page-head'
import { Pill } from '../primitives/pill'
import { Panel } from '../primitives/panel'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import type { Artisan } from '@/components/syndic-dashboard/types'

/** Profissionais — port byte-exact du ModProfissionais du bundle V5.7. */

type Pro = readonly [string, string, string, string, number, string, string, string | null, string | null, boolean?]
const PROS: Pro[] = [
  ['Silva', 'Canalizador', 'check', '4.7', 23, '912 345 678', 'joao.silva@canaliz-norte.pt', '31/12/2026', '30/06/2027'],
  ['Ferreira', 'Eletricista', 'check', '4.5', 17, '935 421 098', 'carlos.ferreira@eletro-porto.pt', '15/08/2026', '20/11/2026'],
  ['Santos', 'Pedreiro', '', '4.3', 12, '928 765 432', 'miguel.santos@construsantos.pt', '01/10/2026', '15/03/2028'],
  ['Pereira', 'Pintor', 'check', '4.8', 9, '917 654 321', 'ana.pereira@pinturas-portugal.pt', '28/02/2027', '30/09/2027'],
  ['Costa', 'Jardineiro', '', '4.2', 6, '961 234 567', 'rui.costa@espacos-verdes.pt', '31/07/2026', null],
  ['Martins', 'Serralheiro', 'check', '4.6', 8, '942 876 543', 'pedro.martins@serralharia-douro.pt', '30/11/2026', '22/04/2027'],
  ['Bruno Tavares', 'Técnico interno', 'check', '5', 0, '935 100 002', 'bruno.tavares@gabinete-vitfix.pt', null, null, true],
  ['Diogo Pereira', 'Técnico interno', 'check', '5', 0, '935 100 006', 'diogo.pereira@gabinete-vitfix.pt', null, null, true],
  ['Tiago Mendes', 'Técnico interno', 'check', '5', 0, '935 100 007', 'tiago.mendes@gabinete-vitfix.pt', null, null, true],
]

const badge = (bg: string, color: string): React.CSSProperties => ({ padding: '8px 12px', background: bg, borderRadius: 8, fontSize: 12, color, marginBottom: 6 })

/** Mappe un artisan réel vers la tuple de rendu d'une carte (Phase 2). */
function artisanToPro(a: Artisan): Pro {
  const name = [a.prenom, a.nom].filter(Boolean).join(' ').trim() || a.nom
  return [
    name,
    a.metier,
    a.vitfixCertifie ? '' : 'check',
    String(a.note ?? ''),
    a.nbInterventions ?? 0,
    a.telephone ?? '',
    a.email ?? '',
    a.rcProValide ? (a.rcProExpiration ?? null) : null,
    a.decennaleValide ? (a.decennaleExpiration ?? null) : null,
  ]
}

export default function ModProfissionais() {
  // Phase 2 : vrais artisans du cabinet si syndic connecté, sinon mock (preview).
  const data = useSyndicData()
  const real = data.authenticated
  const items: ReadonlyArray<{ pro: Pro; id: string | null }> = real
    ? data.artisans.map((a) => ({ pro: artisanToPro(a), id: a.id }))
    : PROS.map((p) => ({ pro: p, id: null }))
  const lede = real
    ? `${data.artisans.length} prestadores registados · ${data.artisans.filter((a) => a.vitfixCertifie).length} certificados Vitfix · ${data.artisans.filter((a) => a.rcProValide).length} com Seguro RC válido · ${data.artisans.filter((a) => a.decennaleValide).length} com garantia decenal`
    : `${PROS.length} prestadores registados · 7 certificados Vitfix · 9 com Seguro RC válido · 8 com garantia decenal`

  // Phase 2 écritures : « Eliminar » → DELETE /api/syndic/artisans (avec confirmation).
  const { push } = useToast()
  const [delTarget, setDelTarget] = useState<{ id: string | null; name: string } | null>(null)
  const [busyDel, setBusyDel] = useState(false)
  const confirmDelete = () => {
    if (real && data.token && delTarget?.id) {
      setBusyDel(true)
      fetch(`/api/syndic/artisans?artisan_id=${encodeURIComponent(delTarget.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${data.token}` },
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); const n = delTarget?.name; setDelTarget(null); push({ kind: 'success', title: 'Profissional eliminado', desc: n }) })
        .catch(() => push({ kind: 'error', title: 'Erro ao eliminar', desc: 'Tente novamente mais tarde' }))
        .finally(() => setBusyDel(false))
      return
    }
    setDelTarget(null)
    push({ kind: 'info', title: 'Profissional eliminado (demo)', desc: 'Conecte-se como síndico para gravar a sério' })
  }
  return (
    <>
      <PageHead
        title="Profissionais"
        lede={lede}
        actions={<>
          <Button><Icon name="check" />Sincro conformidade</Button>
          <Button variant="gold"><Icon name="plus" />Adicionar um profissional</Button>
        </>}
      />
      <div className={m.cardGrid}>
        {items.map(({ pro: p, id }) => (
          <Panel key={p[6]}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 22, fontWeight: 500 }}>{p[0]}</div>
                  {p[2] === '' && <Pill kind="gold" noDot>Certificado</Pill>}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--v54-navy-500)', marginTop: 2 }}>{p[1]}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'var(--v54-gold-600)', fontWeight: 600, fontSize: 13 }}>{p[3]}</div>
                <Pill kind="sage" noDot>Ativo</Pill>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12.5, marginBottom: 12 }}>
              <div style={{ color: 'var(--v54-navy-500)' }}>{p[5]}</div>
              <div style={{ color: 'var(--v54-navy-500)' }}>{p[6]}</div>
              <div style={{ color: 'var(--v54-navy-500)' }}>{p[4]} intervenções</div>
              <div><Pill kind="sage" noDot>Seguro RC válido</Pill></div>
            </div>
            {p[7] && <div style={badge('var(--v54-sage-50)', 'var(--v54-sage-700)')}>Seguro RC válido até {p[7]}</div>}
            {p[8] && <div style={badge('var(--v54-sage-50)', 'var(--v54-sage-700)')}>Decenal válido até {p[8]}</div>}
            {p[9] && <div style={badge('var(--v54-sage-50)', 'var(--v54-sage-700)')}>Decenal válido</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <Button style={{ flex: 1, justifyContent: 'center' }}><Icon name="chat" />Sem conta ligada</Button>
              <Button variant="primary" style={{ flex: 1, justifyContent: 'center' }}>Criar missão</Button>
              <Button variant="ghost" aria-label="Eliminar profissional" title="Eliminar" onClick={() => setDelTarget({ id, name: p[0] })}><Icon name="trash" /></Button>
            </div>
          </Panel>
        ))}
      </div>

      <Modal open={delTarget != null} onClose={() => setDelTarget(null)} labelledBy="dp-title" size="sm">
        <ModalHead icon="trash" id="dp-title" title="Eliminar profissional" onClose={() => setDelTarget(null)} />
        <ModalBody>
          <p style={{ fontSize: 13.5, color: 'var(--v54-navy-500)', lineHeight: 1.5, margin: 0 }}>
            Tem a certeza que pretende eliminar <b>{delTarget?.name}</b> da sua lista de profissionais? Esta ação é irreversível.
          </p>
        </ModalBody>
        <ModalFoot>
          <Button variant="ghost" onClick={() => setDelTarget(null)}>Cancelar</Button>
          <button type="button" onClick={confirmDelete} disabled={busyDel} className={btnCss.btn} style={{ color: 'var(--v54-rust-700)', borderColor: 'var(--v54-rust-100)', background: 'var(--v54-rust-50)' }}>Eliminar</button>
        </ModalFoot>
      </Modal>
    </>
  )
}
