// FR-V3 — Compliance dashboard pour artisan
// Permet à l'artisan de voir son statut de conformité légale en temps réel :
// audit log de ses documents, intégrité de la chaîne de hash, statut rétention.

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase-server-component'

export const dynamic = 'force-dynamic'

interface AuditLogEntry {
  id: string
  action: string
  table_name: string
  doc_number: string | null
  old_status: string | null
  new_status: string | null
  cancelled_reason: string | null
  created_at: string
}

interface ChainCheckRow {
  id: string
  numero: string
  signed_at: string | null
  chain_status: 'unsigned' | 'missing_hash' | 'broken' | 'ok'
}

export default async function ConformitePage() {
  const supabase = await createServerSupabaseClient()
  const headersList = await headers()
  const isPt = headersList.get('x-locale') === 'pt'
  const mentionsLegalesHref = isPt ? '/pt/avisos-legais/' : '/fr/mentions-legales/'
  const confidentialiteHref = isPt ? '/pt/privacidade/' : '/confidentialite/'

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/login?redirect=/pro/conformite')
  }

  // Audit log (RLS filters automatiquement par user_id côté Supabase)
  const { data: auditLog } = await supabase
    .from('documents_audit_log')
    .select('id, action, table_name, doc_number, old_status, new_status, cancelled_reason, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  // Hash chain check — devis
  const { data: devisChainBroken } = await supabase
    .from('v_devis_chain_check')
    .select('id, numero, signed_at, chain_status')
    .neq('chain_status', 'ok')
    .neq('chain_status', 'unsigned')
    .limit(10)

  // Hash chain check — factures
  const { data: facturesChainBroken } = await supabase
    .from('v_factures_chain_check')
    .select('id, numero, signed_at, chain_status')
    .neq('chain_status', 'ok')
    .neq('chain_status', 'unsigned')
    .limit(10)

  // Compteurs hash chain ok
  const { count: devisChainOkCount } = await supabase
    .from('v_devis_chain_check')
    .select('*', { count: 'exact', head: true })
    .eq('chain_status', 'ok')

  const { count: facturesChainOkCount } = await supabase
    .from('v_factures_chain_check')
    .select('*', { count: 'exact', head: true })
    .eq('chain_status', 'ok')

  const audits = (auditLog || []) as AuditLogEntry[]
  const devisBroken = (devisChainBroken || []) as ChainCheckRow[]
  const facturesBroken = (facturesChainBroken || []) as ChainCheckRow[]

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="mb-6">
          <Link href="/pro/dashboard" className="text-sm text-gray-500 hover:text-gray-700">← Tableau de bord</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Conformité légale</h1>
          <p className="text-sm text-gray-600 mt-1">
            Vue d&apos;ensemble de l&apos;intégrité de vos documents fiscaux. À montrer à votre comptable
            ou à la DGFiP en cas de contrôle.
          </p>
        </header>

        {/* ── KPIs intégrité ── */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <KpiCard
            label="Devis avec chaîne de hash valide"
            value={devisChainOkCount ?? 0}
            status="ok"
          />
          <KpiCard
            label="Factures avec chaîne de hash valide"
            value={facturesChainOkCount ?? 0}
            status="ok"
          />
          <KpiCard
            label="Anomalies de chaîne détectées"
            value={(devisBroken.length + facturesBroken.length)}
            status={(devisBroken.length + facturesBroken.length) > 0 ? 'err' : 'ok'}
          />
        </section>

        {/* ── Anomalies ── */}
        {(devisBroken.length > 0 || facturesBroken.length > 0) && (
          <section className="mb-8 p-4 rounded-lg border border-red-200 bg-red-50">
            <h2 className="text-lg font-semibold text-red-800 mb-2">⚠️ Anomalies de chaîne</h2>
            <p className="text-sm text-red-700 mb-4">
              Un ou plusieurs documents ont une chaîne de hash incohérente. Cela peut indiquer une
              modification post-émission. Contactez le support Vitfix immédiatement : <a href="mailto:conformite@vitfix.io" className="underline">conformite@vitfix.io</a>.
            </p>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-red-800">
                <tr><th className="pb-2">Type</th><th className="pb-2">Numéro</th><th className="pb-2">Statut</th><th className="pb-2">Émis le</th></tr>
              </thead>
              <tbody>
                {devisBroken.map(r => (
                  <tr key={r.id} className="border-t border-red-200">
                    <td className="py-2">Devis</td>
                    <td className="py-2 font-mono text-xs">{r.numero}</td>
                    <td className="py-2"><StatusBadge status={r.chain_status} /></td>
                    <td className="py-2 text-xs text-gray-600">{r.signed_at ? new Date(r.signed_at).toLocaleString('fr-FR') : '—'}</td>
                  </tr>
                ))}
                {facturesBroken.map(r => (
                  <tr key={r.id} className="border-t border-red-200">
                    <td className="py-2">Facture</td>
                    <td className="py-2 font-mono text-xs">{r.numero}</td>
                    <td className="py-2"><StatusBadge status={r.chain_status} /></td>
                    <td className="py-2 text-xs text-gray-600">{r.signed_at ? new Date(r.signed_at).toLocaleString('fr-FR') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ── Audit log ── */}
        <section className="mb-8 bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Journal d&apos;audit ({audits.length} dernières actions)
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Conservation 10 ans. Capture chaque modification de statut, annulation ou
            soft-delete des documents fiscaux. Source : <code>documents_audit_log</code>.
          </p>
          {audits.length === 0 ? (
            <p className="text-sm text-gray-500 italic">
              Aucune action loggée pour l&apos;instant. Les premières actions apparaîtront dès
              qu&apos;un devis ou une facture sera modifié.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-gray-600 border-b">
                  <tr>
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Type</th>
                    <th className="pb-2">Action</th>
                    <th className="pb-2">Numéro</th>
                    <th className="pb-2">Transition</th>
                    <th className="pb-2">Raison</th>
                  </tr>
                </thead>
                <tbody>
                  {audits.map(a => (
                    <tr key={a.id} className="border-b border-gray-100">
                      <td className="py-2 text-xs text-gray-600">{new Date(a.created_at).toLocaleString('fr-FR')}</td>
                      <td className="py-2">{a.table_name === 'devis' ? 'Devis' : 'Facture'}</td>
                      <td className="py-2"><ActionBadge action={a.action} /></td>
                      <td className="py-2 font-mono text-xs">{a.doc_number || '—'}</td>
                      <td className="py-2 text-xs">{a.old_status && a.new_status ? `${a.old_status} → ${a.new_status}` : '—'}</td>
                      <td className="py-2 text-xs text-gray-600 max-w-xs truncate">{a.cancelled_reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Liens documents légaux ── */}
        <section className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Documents légaux</h2>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/fr/attestation-editeur/" target="_blank" className="text-blue-600 hover:underline">
                📜 Attestation éditeur conforme LF 2026
              </Link>
              <span className="text-gray-500 ml-2 text-xs">— à présenter en cas de contrôle DGFiP</span>
            </li>
            <li>
              <Link href={mentionsLegalesHref} className="text-blue-600 hover:underline">
                ⚖️ Mentions légales
              </Link>
            </li>
            <li>
              <Link href={confidentialiteHref} className="text-blue-600 hover:underline">
                🔒 Politique de confidentialité (RGPD)
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </div>
  )
}

function KpiCard({ label, value, status }: { label: string; value: number; status: 'ok' | 'warn' | 'err' }) {
  const colors = {
    ok: 'border-green-200 bg-green-50 text-green-900',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    err: 'border-red-200 bg-red-50 text-red-900',
  }
  return (
    <div className={`p-4 rounded-lg border ${colors[status]}`}>
      <div className="text-xs uppercase tracking-wider opacity-75">{label}</div>
      <div className="text-3xl font-bold mt-2">{value}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'broken') return <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs font-semibold">CHAÎNE CASSÉE</span>
  if (status === 'missing_hash') return <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-semibold">HASH MANQUANT</span>
  if (status === 'unsigned') return <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-xs">non émis</span>
  return <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs font-semibold">OK</span>
}

function ActionBadge({ action }: { action: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    update: { label: 'Modif.', cls: 'bg-blue-100 text-blue-700' },
    cancel: { label: 'Annulé', cls: 'bg-red-100 text-red-700' },
    soft_delete: { label: 'Brouillon supp.', cls: 'bg-gray-100 text-gray-600' },
    restore: { label: 'Restauré', cls: 'bg-green-100 text-green-700' },
    sign: { label: 'Signé', cls: 'bg-purple-100 text-purple-700' },
    anonymize: { label: 'Anonymisé', cls: 'bg-amber-100 text-amber-700' },
  }
  const m = map[action] || { label: action, cls: 'bg-gray-100 text-gray-600' }
  return <span className={`px-2 py-0.5 rounded ${m.cls} text-xs font-semibold`}>{m.label}</span>
}
