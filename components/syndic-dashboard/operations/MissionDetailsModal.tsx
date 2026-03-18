'use client'

import { useState, useEffect } from 'react'
import type { Mission } from '../types'
import { Badge, PrioriteBadge } from '../types'
import { useTranslation, useLocale } from '@/lib/i18n/context'

export default function MissionDetailsModal({
  mission, onClose, onUpdate, onValider, userRole
}: {
  mission: Mission
  onClose: () => void
  onUpdate: (m: Mission) => void
  onValider: () => void
  userRole: string
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateFmtLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const [activeTab, setActiveTab] = useState<'info' | 'locataire' | 'canal' | 'rapport' | 'transfert'>('info')
  const [editing, setEditing] = useState(false)
  const [localData, setLocalData] = useState<Mission>({ ...mission })
  const [newMsg, setNewMsg] = useState('')
  const [authorName, setAuthorName] = useState(userRole === 'syndic_tech' ? 'Technicien' : 'Gestionnaire')

  const [transfertDone, setTransfertDone] = useState(!!(mission as any).transfertCompta)
  const [showTransfertModal, setShowTransfertModal] = useState(false)
  const [destinataire, setDestinataire] = useState<'comptable' | 'valideur' | 'syndic'>('comptable')
  const [noteTransfert, setNoteTransfert] = useState('')

  // Sync avec la mission externe si elle change
  useEffect(() => { setLocalData({ ...mission }); setTransfertDone(!!(mission as any).transfertCompta) }, [mission.id])

  const save = (data: Mission) => { setLocalData(data); onUpdate(data); setEditing(false) }
  const saveField = (field: keyof Mission, value: string) => {
    const updated = { ...localData, [field]: value }
    setLocalData(updated); onUpdate(updated)
  }

  const sendCanal = () => {
    if (!newMsg.trim()) return
    const msg = { auteur: authorName, role: userRole, texte: newMsg.trim(), date: new Date().toISOString() }
    const updated = { ...localData, canalMessages: [...(localData.canalMessages || []), msg] }
    setLocalData(updated); onUpdate(updated); setNewMsg('')
  }

  const destLabels: Record<string, string> = { comptable: '🧮 Comptabilité', valideur: '✅ Responsable validation', syndic: '🏛️ Syndic principal' }

  const doTransfert = () => {
    // Crée un paquet de transfert dans localStorage (section facturation / docs_interventions)
    const now = new Date()
    const transfertKey = `syndic_transferts_${userRole}`
    const existing = JSON.parse(localStorage.getItem(transfertKey) || '[]')
    const packet = {
      id: Date.now().toString(),
      missionId: localData.id,
      immeuble: localData.immeuble,
      batiment: localData.batiment,
      etage: localData.etage,
      locataire: localData.locataire,
      numLot: localData.numLot,
      artisan: localData.artisan,
      type: localData.type,
      montantDevis: localData.montantDevis,
      montantFacture: localData.montantFacture,
      travailEffectue: localData.travailEffectue,
      materiauxUtilises: localData.materiauxUtilises,
      problemesConstates: localData.problemesConstates,
      recommandations: localData.recommandations,
      dureeIntervention: localData.dureeIntervention,
      dateRapport: localData.dateRapport || now.toISOString().split('T')[0],
      destinataire,
      note: noteTransfert,
      dateTransfert: now.toISOString(),
      statut: 'en_attente_validation',
      transferePar: authorName,
    }
    existing.push(packet)
    localStorage.setItem(transfertKey, JSON.stringify(existing))

    // Marquer la mission comme transférée
    const updated = {
      ...localData,
      transfertCompta: { destinataire, date: now.toISOString(), par: authorName, note: noteTransfert }
    } as Mission & { transfertCompta: any }
    setLocalData(updated as Mission); onUpdate(updated as Mission)
    setTransfertDone(true)
    setShowTransfertModal(false)

    // Message canal auto
    const autoMsg = {
      auteur: 'Système',
      role: 'system',
      texte: `📤 Dossier transféré à ${destLabels[destinataire]} par ${authorName} le ${now.toLocaleDateString(dateFmtLocale)} à ${now.toLocaleTimeString(dateFmtLocale, { hour: '2-digit', minute: '2-digit' })}. Montant : ${localData.montantFacture ? `${localData.montantFacture.toLocaleString(dateFmtLocale)} €` : localData.montantDevis ? `Devis ${localData.montantDevis.toLocaleString(dateFmtLocale)} €` : 'Non renseigné'}. ${noteTransfert ? `Note : ${noteTransfert}` : ''}`,
      date: now.toISOString()
    }
    const withMsg = { ...updated, canalMessages: [...(updated.canalMessages || []), autoMsg] } as Mission
    setLocalData(withMsg); onUpdate(withMsg)
  }

  const exportRapport = () => {
    const lines = [
      `RAPPORT D'INTERVENTION — Mission #${localData.id}`,
      `Date : ${localData.dateRapport ? new Date(localData.dateRapport).toLocaleDateString(dateFmtLocale) : new Date().toLocaleDateString(dateFmtLocale)}`,
      ``,
      `LOCALISATION`,
      `Immeuble : ${localData.immeuble}`,
      `Bâtiment : ${localData.batiment || '—'}`,
      `Étage : ${localData.etage || '—'}`,
      `N° Lot : ${localData.numLot || '—'}`,
      `Locataire : ${localData.locataire || '—'}`,
      `Tél. locataire : ${localData.telephoneLocataire || '—'}`,
      `Accès logement : ${localData.accesLogement || '—'}`,
      ``,
      `MISSION`,
      `Type : ${localData.type}`,
      `Artisan : ${localData.artisan}`,
      `Description : ${localData.description}`,
      `Durée intervention : ${localData.dureeIntervention || '—'}`,
      ``,
      `RAPPORT ARTISAN`,
      `Travail effectué : ${localData.travailEffectue || localData.rapportArtisan || '—'}`,
      `Matériaux utilisés : ${localData.materiauxUtilises || '—'}`,
      `Problèmes constatés : ${localData.problemesConstates || '—'}`,
      `Recommandations : ${localData.recommandations || '—'}`,
      ``,
      `FINANCIER`,
      `Montant devis : ${localData.montantDevis ? `${localData.montantDevis.toLocaleString(dateFmtLocale)} €` : '—'}`,
      `Montant facture : ${localData.montantFacture ? `${localData.montantFacture.toLocaleString(dateFmtLocale)} €` : '—'}`,
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Rapport_Mission_${localData.id}_${localData.immeuble.replace(/\s+/g, '_')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Archiver le dossier de la mission dans Documents Interventions ─────────
  const [archiveDone, setArchiveDone] = useState(!!(localData as any).archivedInDocs)

  const archiverDossier = () => {
    const now = new Date()
    const storageKey = 'vitfix_docs_interventions'
    let existingDocs: any[] = []
    try { existingDocs = JSON.parse(localStorage.getItem(storageKey) || '[]') } catch {}

    const baseDoc = {
      id: `arch_${localData.id}_${Date.now()}`,
      mission_id: localData.id,
      artisan_nom: localData.artisan,
      artisan_metier: localData.type,
      immeuble: localData.immeuble,
      date_intervention: localData.dateRapport || now.toISOString().split('T')[0],
      url: '',
      envoye_compta: false,
      notes: `Archivé depuis canal mission par ${authorName}. Bât. ${localData.batiment || '—'} · Ét. ${localData.etage || '—'} · Lot ${localData.numLot || '—'} · Locataire : ${localData.locataire || '—'}`,
    }

    if (localData.montantDevis) {
      existingDocs.push({
        ...baseDoc,
        id: `arch_devis_${localData.id}_${Date.now()}`,
        type: 'devis',
        filename: `Devis_Mission_${localData.id}_${(localData.immeuble || '').replace(/\s+/g, '_')}.txt`,
        montant: localData.montantDevis,
      })
    }
    if (localData.montantFacture) {
      existingDocs.push({
        ...baseDoc,
        id: `arch_facture_${localData.id}_${Date.now()}`,
        type: 'facture',
        filename: `Facture_Mission_${localData.id}_${(localData.immeuble || '').replace(/\s+/g, '_')}.txt`,
        montant: localData.montantFacture,
      })
    }
    // Rapport d'intervention toujours
    existingDocs.push({
      ...baseDoc,
      type: 'rapport',
      filename: `Rapport_Mission_${localData.id}_${(localData.immeuble || '').replace(/\s+/g, '_')}_${now.toISOString().split('T')[0]}.txt`,
      montant: localData.montantFacture || localData.montantDevis,
    })

    try { localStorage.setItem(storageKey, JSON.stringify(existingDocs)) } catch {}

    const updated = { ...localData, archivedInDocs: { date: now.toISOString(), par: authorName } } as Mission & { archivedInDocs: any }
    setLocalData(updated); onUpdate(updated as Mission)
    setArchiveDone(true)

    const autoMsg = {
      auteur: 'Système',
      role: 'system',
      texte: `🗂️ Dossier archivé dans "Documents Interventions" par ${authorName} le ${now.toLocaleDateString(dateFmtLocale)} à ${now.toLocaleTimeString(dateFmtLocale, { hour: '2-digit', minute: '2-digit' })}. Rapport${localData.montantDevis ? ' + devis' : ''}${localData.montantFacture ? ' + facture' : ''} + historique canal archivés.`,
      date: now.toISOString()
    }
    const withMsg = { ...updated, canalMessages: [...((updated as Mission).canalMessages || []), autoMsg] } as Mission
    setLocalData(withMsg); onUpdate(withMsg)
  }

  const tabs = [
    { id: 'info', label: '📋 Mission' },
    { id: 'locataire', label: '👤 Locataire', dot: !localData.locataire },
    { id: 'canal', label: `💬 Canal${(localData.canalMessages?.length || 0) > 0 ? ` (${localData.canalMessages!.length})` : ''}` },
    { id: 'rapport', label: '📄 Rapport', dot: !localData.travailEffectue && !localData.rapportArtisan },
    { id: 'transfert', label: transfertDone ? '📤 Transféré ✅' : '📤 Transférer' },
  ] as const

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <PrioriteBadge p={localData.priorite} />
              <Badge statut={localData.statut} />
              <span className="text-xs text-gray-500">#{localData.id}</span>
            </div>
            <h2 className="text-xl font-bold text-[#0D1B2E]">{localData.immeuble}</h2>
            <p className="text-sm text-gray-500">{localData.type} · {localData.artisan}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-600 text-2xl leading-none ml-4">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-6 gap-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as typeof activeTab)}
              className={`relative px-4 py-3 text-sm font-medium transition border-b-2 ${activeTab === t.id ? 'border-[#C9A84C] text-[#C9A84C]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t.label}
              {('dot' in t) && t.dot && <span className="absolute top-2 right-1 w-2 h-2 bg-orange-400 rounded-full"></span>}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── TAB TRANSFERT ── */}
          {activeTab === 'transfert' && (
            <div className="space-y-5">
              {transfertDone ? (
                <div className="bg-green-50 border border-green-300 rounded-2xl p-6 text-center">
                  <div className="text-4xl mb-3">✅</div>
                  <h3 className="font-bold text-green-800 text-lg">Dossier transféré</h3>
                  <p className="text-sm text-green-600 mt-1">Ce dossier a déjà été transmis. Retrouvez-le dans la section facturation / validation.</p>
                  <button onClick={() => setTransfertDone(false)} className="mt-4 text-xs text-green-700 underline">Renvoyer quand même</button>
                </div>
              ) : (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-amber-800">📤 Transfert en 1 clic</p>
                    <p className="text-xs text-amber-700 mt-1">Envoyez instantanément le dossier complet (rapport + devis + facture + infos locataire) à la comptabilité ou au valideur, sans passer par votre boîte mail.</p>
                  </div>

                  {/* Résumé du dossier */}
                  <div className="bg-[#F7F4EE] rounded-xl p-4 space-y-2">
                    <p className="text-sm font-semibold text-gray-700 mb-2">📋 Contenu du dossier à transférer</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className={`flex items-center gap-2 ${localData.locataire ? 'text-green-700' : 'text-gray-500'}`}><span>{localData.locataire ? '✅' : '⚠️'}</span><span>Locataire : {localData.locataire || 'Non renseigné'}</span></div>
                      <div className={`flex items-center gap-2 ${localData.etage ? 'text-green-700' : 'text-gray-500'}`}><span>{localData.etage ? '✅' : '⚠️'}</span><span>Étage : {localData.etage || 'Non renseigné'}</span></div>
                      <div className={`flex items-center gap-2 ${localData.travailEffectue ? 'text-green-700' : 'text-gray-500'}`}><span>{localData.travailEffectue ? '✅' : '⚠️'}</span><span>Rapport : {localData.travailEffectue ? 'Rempli' : 'Manquant'}</span></div>
                      <div className={`flex items-center gap-2 ${localData.montantDevis ? 'text-green-700' : 'text-gray-500'}`}><span>{localData.montantDevis ? '✅' : '⚠️'}</span><span>Devis : {localData.montantDevis ? `${localData.montantDevis.toLocaleString(dateFmtLocale)} €` : 'Manquant'}</span></div>
                      <div className={`flex items-center gap-2 ${localData.montantFacture ? 'text-green-700' : 'text-gray-500'}`}><span>{localData.montantFacture ? '✅' : '—'}</span><span>Facture : {localData.montantFacture ? `${localData.montantFacture.toLocaleString(dateFmtLocale)} €` : 'En attente'}</span></div>
                      <div className={`flex items-center gap-2 ${localData.artisan ? 'text-green-700' : 'text-gray-500'}`}><span>✅</span><span>Artisan : {localData.artisan}</span></div>
                    </div>
                  </div>

                  {/* Destinataire */}
                  <div>
                    <label className="text-sm font-semibold text-gray-700">Destinataire</label>
                    <div className="grid grid-cols-3 gap-3 mt-2">
                      {([['comptable', '🧮', 'Comptabilité', 'Validation des montants, intégration comptable'], ['valideur', '✅', 'Responsable', 'Validation du bon de travail avant paiement'], ['syndic', '🏛️', 'Syndic principal', 'Transmission au cabinet syndic pour archivage']] as const).map(([val, emoji, label, desc]) => (
                        <button
                          key={val}
                          onClick={() => setDestinataire(val)}
                          className={`p-3 rounded-xl border-2 text-left transition ${destinataire === val ? 'border-[#C9A84C] bg-[#F7F4EE]' : 'border-gray-200 hover:border-[#C9A84C]'}`}
                        >
                          <div className="text-xl mb-1">{emoji}</div>
                          <div className="text-sm font-semibold text-[#0D1B2E]">{label}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Note optionnelle */}
                  <div>
                    <label className="text-sm font-medium text-gray-700">Note (optionnelle)</label>
                    <textarea
                      className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:border-[#C9A84C] outline-none resize-none"
                      rows={2}
                      placeholder="Ex: Urgence à traiter, attente confirmation devis, pièce à commander…"
                      value={noteTransfert}
                      onChange={e => setNoteTransfert(e.target.value)}
                    />
                  </div>

                  {/* Bouton principal */}
                  <button
                    onClick={doTransfert}
                    className="w-full bg-[#0D1B2E] hover:bg-[#152338] text-white py-4 rounded-2xl font-bold text-base transition shadow-lg shadow-[#E4DDD0] flex items-center justify-center gap-3"
                  >
                    <span className="text-2xl">📤</span>
                    <span>Transférer à {destLabels[destinataire]}</span>
                  </button>
                  <p className="text-xs text-gray-500 text-center">Le dossier complet sera immédiatement disponible dans la section comptabilité / validation. Un message de confirmation sera ajouté au canal.</p>
                </>
              )}
            </div>
          )}

          {/* ── TAB INFO ── */}
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div className="bg-[#F7F4EE] rounded-xl p-4 space-y-3">
                {[
                  ['Immeuble', localData.immeuble],
                  ['Type d\'intervention', localData.type],
                  ['Artisan assigné', localData.artisan],
                  ['Date d\'intervention', localData.dateIntervention ? new Date(localData.dateIntervention).toLocaleDateString(dateFmtLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—'],
                  ['Devis', localData.montantDevis ? `${localData.montantDevis.toLocaleString(dateFmtLocale)} €` : '—'],
                  ['Facturé', localData.montantFacture ? `${localData.montantFacture.toLocaleString(dateFmtLocale)} €` : '—'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-start gap-4">
                    <span className="text-sm text-gray-500 shrink-0">{label}</span>
                    <span className="text-sm font-semibold text-[#0D1B2E] text-right">{value}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Description</p>
                <p className="text-sm text-gray-600 bg-[#F7F4EE] rounded-xl p-3">{localData.description}</p>
              </div>

              {/* ── Lien de suivi GPS ── */}
              {localData.trackingToken && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <p className="text-sm font-bold text-blue-800">Suivi GPS actif</p>
                  </div>
                  <p className="text-xs text-blue-600 mb-2">L'artisan partage sa position en direct. Partagez ce lien au copropriétaire :</p>
                  <div className="flex gap-2">
                    <code className="flex-1 text-xs bg-white border border-blue-200 rounded-lg px-2 py-1.5 text-blue-700 truncate">
                      {typeof window !== 'undefined' ? `${window.location.origin}/tracking/${localData.trackingToken}` : `/tracking/${localData.trackingToken}`}
                    </code>
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/tracking/${localData.trackingToken}`
                        navigator.clipboard.writeText(url).catch(() => {})
                      }}
                      className="flex-shrink-0 bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-blue-700 transition"
                    >
                      Copier
                    </button>
                  </div>
                  <a
                    href={`/tracking/${localData.trackingToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium"
                  >
                    📍 Voir le suivi en direct →
                  </a>
                </div>
              )}

              <div className="bg-[#F7F4EE] rounded-xl p-3 text-xs text-gray-500">
                Mission #{localData.id} · Créée le {new Date(localData.dateCreation).toLocaleDateString(dateFmtLocale)}
              </div>
            </div>
          )}

          {/* ── TAB LOCATAIRE ── */}
          {activeTab === 'locataire' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-blue-800 mb-1">📍 Fiche locataire / localisation</p>
                <p className="text-xs text-blue-600">Ces informations sont enregistrées dans l'ordre de mission et le rapport.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Bâtiment</label>
                  <input
                    className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:border-[#C9A84C] outline-none"
                    placeholder="Ex: Bâtiment A, Résidence B…"
                    value={localData.batiment || ''}
                    onChange={e => setLocalData(d => ({...d, batiment: e.target.value}))}
                    onBlur={() => onUpdate(localData)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Étage</label>
                  <input
                    className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:border-[#C9A84C] outline-none"
                    placeholder="Ex: 3ème, RDC, 5ème…"
                    value={localData.etage || ''}
                    onChange={e => setLocalData(d => ({...d, etage: e.target.value}))}
                    onBlur={() => onUpdate(localData)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">N° de lot / appartement</label>
                  <input
                    className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:border-[#C9A84C] outline-none"
                    placeholder="Ex: Apt 12, Lot 45…"
                    value={localData.numLot || ''}
                    onChange={e => setLocalData(d => ({...d, numLot: e.target.value}))}
                    onBlur={() => onUpdate(localData)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Nom du locataire</label>
                  <input
                    className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:border-[#C9A84C] outline-none"
                    placeholder="Nom Prénom du locataire"
                    value={localData.locataire || ''}
                    onChange={e => setLocalData(d => ({...d, locataire: e.target.value}))}
                    onBlur={() => onUpdate(localData)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Téléphone locataire</label>
                  <input
                    className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:border-[#C9A84C] outline-none"
                    placeholder="06 XX XX XX XX"
                    value={localData.telephoneLocataire || ''}
                    onChange={e => setLocalData(d => ({...d, telephoneLocataire: e.target.value}))}
                    onBlur={() => onUpdate(localData)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Accès logement</label>
                  <input
                    className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:border-[#C9A84C] outline-none"
                    placeholder="Code digicode, clé gardien…"
                    value={localData.accesLogement || ''}
                    onChange={e => setLocalData(d => ({...d, accesLogement: e.target.value}))}
                    onBlur={() => onUpdate(localData)}
                  />
                </div>
              </div>

              <button
                onClick={() => onUpdate(localData)}
                className="w-full bg-[#0D1B2E] text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-[#152338] transition"
              >
                ✅ Enregistrer la fiche locataire
              </button>

              {(localData.locataire || localData.etage || localData.batiment) && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-green-800 mb-2">✅ Fiche enregistrée</p>
                  <div className="grid grid-cols-2 gap-2 text-sm text-green-700">
                    {localData.batiment && <span>🏢 Bât. {localData.batiment}</span>}
                    {localData.etage && <span>🏗️ Étage : {localData.etage}</span>}
                    {localData.numLot && <span>🔢 Lot : {localData.numLot}</span>}
                    {localData.locataire && <span>👤 {localData.locataire}</span>}
                    {localData.telephoneLocataire && <span>📞 {localData.telephoneLocataire}</span>}
                    {localData.accesLogement && <span>🔐 {localData.accesLogement}</span>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB CANAL ── */}
          {activeTab === 'canal' && (
            <div className="flex flex-col h-full" style={{ minHeight: '300px' }}>
              <div className="mb-3">
                <label className="text-xs font-medium text-gray-600">Votre nom dans le canal</label>
                <input className="mt-1 w-48 border rounded-lg px-3 py-1.5 text-sm" value={authorName} onChange={e => setAuthorName(e.target.value)} />
              </div>
              <div className="flex-1 space-y-3 mb-4 max-h-64 overflow-y-auto">
                {(!localData.canalMessages || localData.canalMessages.length === 0) ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-2">💬</div>
                    <p className="text-sm">Aucun message — Ouvrez le dialogue avec l'artisan</p>
                  </div>
                ) : localData.canalMessages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === userRole ? 'flex-row-reverse' : ''}`}>
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${msg.role === 'artisan' ? 'bg-amber-100 text-amber-700' : 'bg-[#F7F4EE] text-[#C9A84C]'}`}>
                      {msg.auteur.charAt(0).toUpperCase()}
                    </div>
                    <div className={`max-w-xs ${msg.role === userRole ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div className={`rounded-2xl px-4 py-2.5 text-sm ${msg.role === userRole ? 'bg-[#0D1B2E] text-white rounded-tr-sm' : 'bg-[#F7F4EE] text-[#0D1B2E] rounded-tl-sm'}`}>
                        {msg.texte}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 px-1">{msg.auteur} · {new Date(msg.date).toLocaleTimeString(dateFmtLocale, { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Quick actions */}
              <div className="flex gap-2 mb-3 flex-wrap">
                {['📍 En route', '✅ Arrivé sur place', '🔍 Diagnostic en cours', '⚠️ Problème constaté', '✅ Intervention terminée', '📦 Commande pièce nécessaire'].map(txt => (
                  <button key={txt} onClick={() => { setNewMsg(txt) }} className="text-xs bg-[#F7F4EE] hover:bg-[#F7F4EE] hover:text-[#C9A84C] px-3 py-1.5 rounded-full transition">{txt}</button>
                ))}
              </div>

              {/* ── Bouton Archiver dans Documents Interventions ── */}
              <div className={`rounded-xl border-2 p-3 mb-3 ${archiveDone ? 'border-green-200 bg-green-50' : 'border-dashed border-[#E4DDD0] bg-[#F7F4EE]'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {archiveDone ? '🗂️ Dossier archivé' : '🗂️ Archiver dans Documents Interventions'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                      {archiveDone
                        ? 'Rapport, devis et facture archivés — disponibles dans Documents'
                        : 'Enregistre rapport + devis/facture + historique dans "Documents Interventions"'}
                    </p>
                    {archiveDone && (localData as any).archivedInDocs && (
                      <p className="text-xs text-green-600 mt-1">
                        Archivé le {new Date((localData as any).archivedInDocs.date).toLocaleDateString(dateFmtLocale)} par {(localData as any).archivedInDocs.par}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={archiverDossier}
                    disabled={archiveDone}
                    className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition ${
                      archiveDone
                        ? 'bg-green-100 text-green-700 cursor-default'
                        : 'bg-[#0D1B2E] hover:bg-[#152338] text-white shadow-sm'
                    }`}
                  >
                    {archiveDone ? '✅ Archivé' : '📥 Archiver'}
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  className="flex-1 border-2 rounded-xl px-4 py-2.5 text-sm focus:border-[#C9A84C] outline-none"
                  placeholder="Message à l'artisan…"
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendCanal())}
                />
                <button onClick={sendCanal} disabled={!newMsg.trim()} className="bg-[#0D1B2E] text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#152338] transition disabled:opacity-60">Envoyer</button>
              </div>
            </div>
          )}

          {/* ── TAB RAPPORT ── */}
          {activeTab === 'rapport' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Date du rapport</label>
                  <input type="date" className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:border-[#C9A84C] outline-none" value={localData.dateRapport || new Date().toISOString().split('T')[0]} onChange={e => setLocalData(d => ({...d, dateRapport: e.target.value}))} onBlur={() => onUpdate(localData)} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Durée intervention</label>
                  <input className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:border-[#C9A84C] outline-none" placeholder="Ex: 2h30" value={localData.dureeIntervention || ''} onChange={e => setLocalData(d => ({...d, dureeIntervention: e.target.value}))} onBlur={() => onUpdate(localData)} />
                </div>
              </div>
              {[
                ['Travail effectué *', 'travailEffectue', 'Décrivez les travaux réalisés…', 3],
                ['Matériaux utilisés', 'materiauxUtilises', 'Ex: 1 joint torique, 2m tuyau PER…', 2],
                ['Problèmes constatés', 'problemesConstates', 'Anomalies, vétusté, défauts constatés…', 2],
                ['Recommandations', 'recommandations', 'Travaux complémentaires à prévoir…', 2],
              ].map(([label, field, placeholder, rows]) => (
                <div key={String(field)}>
                  <label className="text-sm font-medium text-gray-700">{label}</label>
                  <textarea
                    className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm focus:border-[#C9A84C] outline-none resize-none"
                    rows={rows as number}
                    placeholder={placeholder as string}
                    value={(localData as Record<string, any>)[field as string] || ''}
                    onChange={e => setLocalData(d => ({...d, [field as string]: e.target.value}))}
                    onBlur={() => onUpdate(localData)}
                  />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button onClick={() => onUpdate(localData)} className="flex-1 bg-[#0D1B2E] text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-[#152338] transition">
                  ✅ Enregistrer le rapport
                </button>
                <button onClick={exportRapport} className="flex-1 bg-[#F7F4EE] text-gray-700 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-200 transition">
                  ⬇️ Télécharger rapport
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t bg-[#F7F4EE] rounded-b-2xl">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-[#F7F4EE] transition font-medium">
            Fermer
          </button>
          {mission.statut === 'en_attente' && (
            <button onClick={onValider} className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition">
              ✅ Valider la mission
            </button>
          )}
          {mission.statut !== 'terminee' && mission.statut !== 'annulee' && (
            <button
              onClick={() => { const u = { ...localData, statut: 'terminee' as const }; onUpdate(u) }}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition"
            >
              🏁 Marquer terminée
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
