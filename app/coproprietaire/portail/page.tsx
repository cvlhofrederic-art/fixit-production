'use client'

import { useState, useEffect, useRef } from 'react'

// ─── Types ─────────────────────────────────────────────────────────────────

type DemandeurRole = 'coproprio' | 'locataire' | 'technicien'

interface DemandeurProfile {
  nom: string
  prenom: string
  role: DemandeurRole
  immeuble: string
  batiment: string
  etage: string
  numLot: string
  telephone: string
  email: string
}

interface CanalMessage {
  auteur: string
  role: string
  texte: string
  date: string
  type?: string
}

interface SignalementForm {
  typeIntervention: string
  description: string
  urgence: 'normale' | 'urgente' | 'planifiee'
  // Pour technicien ou partie commune
  estPartieCommune: boolean
  zoneSignalee: string
  // Bénéficiaire (pour technicien qui signale pour quelqu'un d'autre)
  pourQuoi: string
  batimentSignale: string
  etageSignale: string
  numLotSignale: string
}

const TYPES_INTERVENTION = [
  '🔧 Plomberie (fuite, colonne, robinetterie)',
  '⚡ Électricité (panne, tableau, prise)',
  '🪟 Menuiserie (porte, fenêtre, serrure)',
  '🎨 Peinture / revêtement',
  '🏗️ Gros œuvre (fissure, infiltration)',
  '🌡️ Chauffage / climatisation',
  '🛗 Ascenseur',
  '🧹 Nettoyage / entretien',
  '🔥 Sinistre (dégât des eaux, incendie)',
  '🚨 Urgence sécurité',
  '🌿 Espaces verts',
  '💡 Éclairage parties communes',
  '🚪 Interphone / digicode',
  '📦 Autre',
]

const ZONES_COMMUNES = [
  'Hall d\'entrée',
  'Couloir / palier',
  'Escalier',
  'Cave / sous-sol',
  'Parking / garage',
  'Toiture / terrasse',
  'Jardin / espace vert',
  'Local poubelles',
  'Local vélos',
  'Façade extérieure',
  'Boîtes aux lettres',
  'Ascenseur',
  'Chaufferie',
  'Compteurs communs',
]

// ─── Composant principal ────────────────────────────────────────────────────

export default function PortailCopropriétaire() {
  // Identification du demandeur
  const [profile, setProfile] = useState<DemandeurProfile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [view, setView] = useState<'canal' | 'signalement' | 'profil'>('canal')

  // Formulaire signalement
  const [form, setForm] = useState<SignalementForm>({
    typeIntervention: '',
    description: '',
    urgence: 'normale',
    estPartieCommune: false,
    zoneSignalee: '',
    pourQuoi: '',
    batimentSignale: '',
    etageSignale: '',
    numLotSignale: '',
  })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [signalementEnvoye, setSignalementEnvoye] = useState(false)

  // Canal messages
  const [canalMessages, setCanalMessages] = useState<CanalMessage[]>([])
  const [newMsg, setNewMsg] = useState('')
  const msgEndRef = useRef<HTMLDivElement>(null)

  // ─── Chargement profil depuis localStorage copropriétaires ─────────────

  useEffect(() => {
    // Tenter de récupérer le profil depuis les données existantes
    // En production ce serait depuis Supabase auth
    const saved = localStorage.getItem('portail_profile')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setProfile(parsed)
        loadCanalMessages(parsed)
        setLoadingProfile(false)
        return
      } catch { /* ignore */ }
    }

    // Recherche dans copropriétaires du syndic
    let found: DemandeurProfile | null = null
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith('fixit_copros_')) continue
      try {
        const copros = JSON.parse(localStorage.getItem(key) || '[]')
        for (const copro of copros) {
          // Match par email ou identifiant
          if (copro.emailLocataire || copro.emailProprietaire) {
            found = {
              nom: copro.nomLocataire || copro.nomProprietaire || '',
              prenom: copro.prenomLocataire || copro.prenomProprietaire || '',
              role: copro.type === 'proprietaire' ? 'coproprio' : 'locataire',
              immeuble: copro.immeuble || '',
              batiment: copro.batiment || '',
              etage: String(copro.etage || ''),
              numLot: copro.numeroPorte || copro.lot || '',
              telephone: copro.telephoneLocataire || copro.telephoneProprietaire || '',
              email: copro.emailLocataire || copro.emailProprietaire || '',
            }
            break
          }
        }
        if (found) break
      } catch { /* ignore */ }
    }

    if (found) {
      setProfile(found)
      localStorage.setItem('portail_profile', JSON.stringify(found))
      loadCanalMessages(found)
    } else {
      // Profil démo (Géraldine Xavier - mentionnée par l'utilisateur)
      const demoProfile: DemandeurProfile = {
        nom: 'Xavier',
        prenom: 'Géraldine',
        role: 'coproprio',
        immeuble: 'Résidence Les Acacias',
        batiment: 'D',
        etage: '4',
        numLot: '12',
        telephone: '06 12 34 56 78',
        email: 'geraldine.xavier@email.com',
      }
      setProfile(demoProfile)
      localStorage.setItem('portail_profile', JSON.stringify(demoProfile))
      loadCanalMessages(demoProfile)
    }
    setLoadingProfile(false)
  }, [])

  const loadCanalMessages = (p: DemandeurProfile) => {
    const rawKey = `${p.prenom}_${p.nom}`.replace(/\s+/g, '_').toLowerCase()
    const key = `canal_demandeur_${rawKey}`
    try {
      const msgs = JSON.parse(localStorage.getItem(key) || '[]')
      setCanalMessages(msgs)
    } catch { /* ignore */ }
  }

  const saveCanalMessages = (msgs: CanalMessage[], p: DemandeurProfile) => {
    const rawKey = `${p.prenom}_${p.nom}`.replace(/\s+/g, '_').toLowerCase()
    const key = `canal_demandeur_${rawKey}`
    localStorage.setItem(key, JSON.stringify(msgs))
    setCanalMessages(msgs)
  }

  // Scroll to bottom on new messages
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [canalMessages])

  // ─── Gestion photo ─────────────────────────────────────────────────────

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  // ─── Envoi signalement ─────────────────────────────────────────────────

  const handleEnvoyerSignalement = () => {
    if (!form.typeIntervention || !form.description || !profile) return

    const locationLabel = form.estPartieCommune
      ? `Partie commune — ${form.zoneSignalee || 'Zone non précisée'}`
      : `${profile.immeuble} · Bât. ${profile.batiment} · Ét. ${profile.etage} · Lot ${profile.numLot}`

    const benefLabel = form.estPartieCommune && form.pourQuoi
      ? `\nConcerne : ${form.pourQuoi}${form.batimentSignale ? ` · Bât. ${form.batimentSignale}` : ''}${form.etageSignale ? ` · Ét. ${form.etageSignale}` : ''}${form.numLotSignale ? ` · Lot ${form.numLotSignale}` : ''}`
      : ''

    const msgTexte = `📋 SIGNALEMENT — ${form.typeIntervention}

👤 De : ${profile.prenom} ${profile.nom} (${profile.role === 'coproprio' ? 'Copropriétaire' : profile.role === 'locataire' ? 'Locataire' : 'Technicien bâtiment'})
📍 Localisation : ${locationLabel}${benefLabel}
🔔 Urgence : ${form.urgence === 'urgente' ? '🔴 URGENT' : form.urgence === 'planifiee' ? '🟢 Planifiée' : '🟡 Normale'}

📝 Description :
${form.description}${photoFile ? '\n📸 Photo jointe' : ''}`

    const newMsgObj: CanalMessage = {
      auteur: `${profile.prenom} ${profile.nom}`,
      role: profile.role,
      texte: msgTexte,
      date: new Date().toISOString(),
      type: 'signalement',
    }

    const updated = [...canalMessages, newMsgObj]
    saveCanalMessages(updated, profile)

    // Créer aussi une mission directement dans le localStorage syndic
    // pour que le gestionnaire la voit dans ses demandes
    const missionData = {
      id: Date.now().toString(),
      type: form.typeIntervention,
      description: form.description,
      priorite: form.urgence,
      statut: 'en_attente',
      dateCreation: new Date().toISOString(),
      immeuble: form.estPartieCommune ? form.zoneSignalee : profile.immeuble,
      batiment: form.estPartieCommune ? form.batimentSignale : profile.batiment,
      etage: form.estPartieCommune ? form.etageSignale : profile.etage,
      numLot: form.estPartieCommune ? form.numLotSignale : profile.numLot,
      artisan: '',
      locataire: `${profile.prenom} ${profile.nom}`,
      telephoneLocataire: profile.telephone,
      demandeurNom: `${profile.prenom} ${profile.nom}`,
      demandeurRole: profile.role,
      demandeurEmail: profile.email,
      estPartieCommune: form.estPartieCommune,
      zoneSignalee: form.zoneSignalee,
      demandeurMessages: [newMsgObj],
    }

    // Écrire dans toutes les clés syndic trouvées (le gestionnaire verra la demande)
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith('fixit_syndic_missions_')) continue
      try {
        const existing = JSON.parse(localStorage.getItem(key) || '[]')
        existing.unshift(missionData)
        localStorage.setItem(key, JSON.stringify(existing))
        break // écrire dans le premier compte syndic trouvé
      } catch { /* ignore */ }
    }

    setSignalementEnvoye(true)
    // Reset form
    setForm({
      typeIntervention: '',
      description: '',
      urgence: 'normale',
      estPartieCommune: false,
      zoneSignalee: '',
      pourQuoi: '',
      batimentSignale: '',
      etageSignale: '',
      numLotSignale: '',
    })
    setPhotoFile(null)
    setPhotoPreview(null)

    // Revenir au canal après 2 secondes
    setTimeout(() => {
      setSignalementEnvoye(false)
      setView('canal')
    }, 2000)
  }

  // ─── Envoi message canal ───────────────────────────────────────────────

  const handleSendMsg = () => {
    if (!newMsg.trim() || !profile) return
    const msg: CanalMessage = {
      auteur: `${profile.prenom} ${profile.nom}`,
      role: profile.role,
      texte: newMsg.trim(),
      date: new Date().toISOString(),
    }
    const updated = [...canalMessages, msg]
    saveCanalMessages(updated, profile)
    setNewMsg('')
  }

  // ─── Sauvegarde profil ─────────────────────────────────────────────────

  const saveProfile = (p: DemandeurProfile) => {
    setProfile(p)
    localStorage.setItem('portail_profile', JSON.stringify(p))
  }

  // ─── Render ────────────────────────────────────────────────────────────

  if (loadingProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-purple-700 font-medium">Chargement de votre espace…</p>
        </div>
      </div>
    )
  }

  const roleLabel = profile?.role === 'coproprio' ? 'Copropriétaire' : profile?.role === 'locataire' ? 'Locataire' : 'Technicien bâtiment'
  const roleBgColor = profile?.role === 'coproprio' ? 'bg-purple-700' : profile?.role === 'locataire' ? 'bg-violet-600' : 'bg-purple-600'
  const roleTextColor = profile?.role === 'coproprio' ? 'text-purple-700' : profile?.role === 'locataire' ? 'text-violet-700' : 'text-purple-700'
  const roleBgLight = profile?.role === 'coproprio' ? 'bg-purple-50' : profile?.role === 'locataire' ? 'bg-violet-50' : 'bg-purple-50'
  const roleBorderColor = profile?.role === 'coproprio' ? 'border-purple-200' : profile?.role === 'locataire' ? 'border-violet-200' : 'border-purple-200'

  const unreadCount = canalMessages.filter(m => m.role !== profile?.role && m.role !== 'demandeur' && m.role !== 'coproprio' && m.role !== 'locataire' && m.role !== 'technicien').length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50">

      {/* ── Header ── */}
      <div className={`${roleBgColor} text-white`}>
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-lg font-bold">
                {profile ? (profile.prenom.charAt(0) + profile.nom.charAt(0)).toUpperCase() : '?'}
              </div>
              <div>
                <p className="font-bold text-sm">{profile ? `${profile.prenom} ${profile.nom}` : 'Bienvenue'}</p>
                <p className="text-xs text-white/80">{roleLabel}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/80 font-medium">Portail Résidence</p>
              {profile?.immeuble && <p className="text-xs text-white/60">{profile.immeuble}</p>}
            </div>
          </div>

          {/* Infos localisation */}
          {profile && (profile.batiment || profile.etage || profile.numLot) && (
            <div className="mt-3 bg-white/10 rounded-xl px-3 py-2 flex items-center gap-3 flex-wrap">
              {profile.batiment && <span className="text-xs text-white/90">🏢 Bât. {profile.batiment}</span>}
              {profile.etage && <span className="text-xs text-white/90">· Ét. {profile.etage}</span>}
              {profile.numLot && <span className="text-xs text-white/90">· Lot / Porte {profile.numLot}</span>}
            </div>
          )}
        </div>
      </div>

      {/* ── Navigation tabs ── */}
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-2">
        <div className="flex gap-2">
          <button
            onClick={() => setView('canal')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition border ${view === 'canal' ? `${roleBgLight} ${roleTextColor} ${roleBorderColor}` : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
          >
            💬 Mes messages
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-1.5 rounded-full">{unreadCount}</span>
            )}
          </button>
          <button
            onClick={() => setView('signalement')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition border ${view === 'signalement' ? `${roleBgLight} ${roleTextColor} ${roleBorderColor}` : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
          >
            🔔 Signalement
          </button>
          <button
            onClick={() => setView('profil')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition border ${view === 'profil' ? `${roleBgLight} ${roleTextColor} ${roleBorderColor}` : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
          >
            👤 Profil
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-8">

        {/* ══════════════════════════════════════════════════ */}
        {/* VUE CANAL MESSAGES */}
        {/* ══════════════════════════════════════════════════ */}
        {view === 'canal' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header canal */}
            <div className={`px-4 py-3 border-b ${roleBorderColor} ${roleBgLight}`}>
              <h2 className={`font-bold text-sm ${roleTextColor}`}>💬 Vos échanges avec le gestionnaire</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {canalMessages.length === 0 ? 'Aucun message pour l\'instant' : `${canalMessages.length} message${canalMessages.length > 1 ? 's' : ''}`}
              </p>
            </div>

            {/* Fil messages */}
            <div className="p-4 space-y-3 min-h-[300px] max-h-[60vh] overflow-y-auto bg-gray-50">
              {canalMessages.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-5xl mb-3">💬</div>
                  <p className="text-gray-500 font-medium">Aucun message</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Faites un signalement pour contacter votre gestionnaire.<br/>
                    Les réponses apparaîtront ici.
                  </p>
                  <button
                    onClick={() => setView('signalement')}
                    className={`mt-4 ${roleBgColor} text-white px-5 py-2 rounded-xl text-sm font-semibold`}
                  >
                    Faire un signalement →
                  </button>
                </div>
              ) : canalMessages.map((msg, i) => {
                const isMine = msg.role === profile?.role || msg.auteur === `${profile?.prenom} ${profile?.nom}`
                const isGestionnaire = !isMine && msg.role !== 'system'
                const isSystem = msg.role === 'system' || msg.type === 'mission_traitee'

                if (isSystem || msg.type === 'mission_traitee') {
                  return (
                    <div key={i} className="flex justify-center">
                      <div className={`${roleBgLight} border ${roleBorderColor} rounded-xl px-4 py-3 max-w-sm text-center`}>
                        <p className={`text-xs ${roleTextColor} leading-relaxed whitespace-pre-line`}>{msg.texte}</p>
                        <p className="text-xs text-gray-500 mt-1">{new Date(msg.date).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={i} className={`flex gap-3 ${isMine ? 'flex-row-reverse' : ''}`}>
                    <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${isMine ? `${roleBgColor} text-white` : 'bg-gray-200 text-gray-700'}`}>
                      {msg.auteur.charAt(0).toUpperCase()}
                    </div>
                    <div className={`max-w-xs flex flex-col gap-1 ${isMine ? 'items-end' : 'items-start'}`}>
                      <p className="text-xs text-gray-500 px-1">{msg.auteur} {isGestionnaire ? '· Gestionnaire' : ''}</p>
                      <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line ${isMine ? `${roleBgColor} text-white rounded-tr-sm` : 'bg-white text-gray-900 border border-gray-200 rounded-tl-sm shadow-sm'}`}>
                        {msg.texte}
                      </div>
                      <p className="text-xs text-gray-300 px-1">{new Date(msg.date).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                )
              })}
              <div ref={msgEndRef} />
            </div>

            {/* Zone saisie */}
            <div className={`border-t ${roleBorderColor} p-4`}>
              <div className="flex gap-2">
                <textarea
                  className={`flex-1 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none resize-none`}
                  style={{ borderColor: view === 'canal' ? undefined : undefined }}
                  placeholder="Votre message au gestionnaire…"
                  value={newMsg}
                  rows={2}
                  onChange={e => setNewMsg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMsg())}
                />
                <button
                  onClick={handleSendMsg}
                  disabled={!newMsg.trim()}
                  className={`${roleBgColor} text-white px-5 py-2 rounded-xl font-semibold text-sm transition disabled:opacity-60 self-end`}
                >
                  Envoyer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* VUE SIGNALEMENT */}
        {/* ══════════════════════════════════════════════════ */}
        {view === 'signalement' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className={`px-4 py-3 border-b ${roleBorderColor} ${roleBgLight}`}>
              <h2 className={`font-bold text-sm ${roleTextColor}`}>🔔 Nouveau signalement</h2>
              <p className="text-xs text-gray-500 mt-0.5">Signalez un problème ou une intervention nécessaire</p>
            </div>

            {signalementEnvoye ? (
              <div className="p-12 text-center">
                <div className="text-6xl mb-4">✅</div>
                <h3 className="text-xl font-bold text-green-700">Signalement envoyé !</h3>
                <p className="text-gray-500 mt-2">Votre gestionnaire a été notifié. Vous recevrez une réponse dans votre canal de messages.</p>
              </div>
            ) : (
              <div className="p-4 space-y-4">

                {/* Infos auto-remplies (coproprio / locataire) */}
                {profile?.role !== 'technicien' && (
                  <div className={`${roleBgLight} border ${roleBorderColor} rounded-xl p-3`}>
                    <p className={`text-xs font-semibold ${roleTextColor} mb-2`}>📍 Votre localisation (auto-remplie)</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs bg-white border border-gray-200 px-2 py-1 rounded-lg">🏢 {profile?.immeuble || 'Non renseigné'}</span>
                      {profile?.batiment && <span className="text-xs bg-white border border-gray-200 px-2 py-1 rounded-lg">Bât. {profile.batiment}</span>}
                      {profile?.etage && <span className="text-xs bg-white border border-gray-200 px-2 py-1 rounded-lg">Étage {profile.etage}</span>}
                      {profile?.numLot && <span className="text-xs bg-white border border-gray-200 px-2 py-1 rounded-lg">Lot / Porte {profile.numLot}</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Ces informations seront automatiquement transmises avec votre signalement.</p>
                  </div>
                )}

                {/* Toggle Partie commune (technicien ou coproprio qui peut signaler une partie commune) */}
                <div className="flex items-center justify-between p-3 border border-gray-200 rounded-xl">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Partie commune ?</p>
                    <p className="text-xs text-gray-500 mt-0.5">Cave, couloir, ascenseur, toiture, etc. — pas dans un appartement</p>
                  </div>
                  <button
                    onClick={() => setForm(f => ({ ...f, estPartieCommune: !f.estPartieCommune }))}
                    className={`relative w-12 h-6 rounded-full transition-colors ${form.estPartieCommune ? 'bg-orange-500' : 'bg-gray-200'}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.estPartieCommune ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </div>

                {/* Zone commune si toggle activé */}
                {form.estPartieCommune && (
                  <div className="space-y-3 p-3 bg-orange-50 border border-orange-100 rounded-xl">
                    <div>
                      <label className="text-xs font-semibold text-orange-700 mb-1 block">Zone concernée</label>
                      <select
                        className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                        value={form.zoneSignalee}
                        onChange={e => setForm(f => ({ ...f, zoneSignalee: e.target.value }))}
                      >
                        <option value="">Sélectionner une zone…</option>
                        {ZONES_COMMUNES.map(z => <option key={z} value={z}>{z}</option>)}
                        <option value="Autre">Autre (préciser dans la description)</option>
                      </select>
                    </div>

                    {/* Pour technicien : champ bénéficiaire optionnel */}
                    {profile?.role === 'technicien' && (
                      <div>
                        <label className="text-xs font-semibold text-orange-700 mb-1 block">Pour quel résident ? (optionnel)</label>
                        <input
                          type="text"
                          placeholder="Nom du résident concerné (si applicable)"
                          className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                          value={form.pourQuoi}
                          onChange={e => setForm(f => ({ ...f, pourQuoi: e.target.value }))}
                        />
                        <div className="flex gap-2 mt-2">
                          <input
                            type="text"
                            placeholder="Bât."
                            className="w-20 border border-orange-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                            value={form.batimentSignale}
                            onChange={e => setForm(f => ({ ...f, batimentSignale: e.target.value }))}
                          />
                          <input
                            type="text"
                            placeholder="Étage"
                            className="w-20 border border-orange-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                            value={form.etageSignale}
                            onChange={e => setForm(f => ({ ...f, etageSignale: e.target.value }))}
                          />
                          <input
                            type="text"
                            placeholder="Lot / Porte"
                            className="flex-1 border border-orange-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                            value={form.numLotSignale}
                            onChange={e => setForm(f => ({ ...f, numLotSignale: e.target.value }))}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Localisation manuelle pour technicien (quand pas partie commune) */}
                {profile?.role === 'technicien' && !form.estPartieCommune && (
                  <div className="space-y-3 p-3 bg-orange-50 border border-orange-100 rounded-xl">
                    <p className="text-xs font-semibold text-orange-700">📍 Localisation de l'intervention</p>
                    <input
                      type="text"
                      placeholder="Résidence / Immeuble"
                      className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      value={form.pourQuoi}
                      onChange={e => setForm(f => ({ ...f, pourQuoi: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Bâtiment"
                        className="w-24 border border-orange-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                        value={form.batimentSignale}
                        onChange={e => setForm(f => ({ ...f, batimentSignale: e.target.value }))}
                      />
                      <input
                        type="text"
                        placeholder="Étage"
                        className="w-24 border border-orange-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                        value={form.etageSignale}
                        onChange={e => setForm(f => ({ ...f, etageSignale: e.target.value }))}
                      />
                      <input
                        type="text"
                        placeholder="Lot / Porte"
                        className="flex-1 border border-orange-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                        value={form.numLotSignale}
                        onChange={e => setForm(f => ({ ...f, numLotSignale: e.target.value }))}
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Résident concerné (nom, si applicable)"
                      className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      value={form.zoneSignalee}
                      onChange={e => setForm(f => ({ ...f, zoneSignalee: e.target.value }))}
                    />
                  </div>
                )}

                {/* Type d'intervention */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-2 block">Type d'intervention *</label>
                  <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {TYPES_INTERVENTION.map(type => (
                      <button
                        key={type}
                        onClick={() => setForm(f => ({ ...f, typeIntervention: type }))}
                        className={`text-left text-xs px-3 py-2 rounded-lg border transition ${form.typeIntervention === type ? `${roleBgLight} ${roleBorderColor} ${roleTextColor} font-semibold` : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Urgence */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-2 block">Niveau d'urgence</label>
                  <div className="flex gap-2">
                    {[
                      { val: 'normale', label: '🟡 Normale', color: 'border-yellow-300 bg-yellow-50 text-yellow-700' },
                      { val: 'urgente', label: '🔴 Urgente', color: 'border-red-300 bg-red-50 text-red-700' },
                      { val: 'planifiee', label: '🟢 Planifiée', color: 'border-green-300 bg-green-50 text-green-700' },
                    ].map(opt => (
                      <button
                        key={opt.val}
                        onClick={() => setForm(f => ({ ...f, urgence: opt.val as 'normale' | 'urgente' | 'planifiee' }))}
                        className={`flex-1 text-xs px-3 py-2 rounded-xl border-2 font-medium transition ${form.urgence === opt.val ? opt.color + ' border-2' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Description du problème *</label>
                  <textarea
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none resize-none"
                    placeholder="Décrivez précisément le problème (depuis quand, symptômes, ce que vous avez constaté…)"
                    value={form.description}
                    rows={4}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>

                {/* Photo optionnelle */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Photo (optionnelle)</label>
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-4">
                    {photoPreview ? (
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photoPreview} alt="Aperçu" className="w-full max-h-40 object-cover rounded-lg" />
                        <button
                          onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer flex flex-col items-center gap-2">
                        <div className="text-3xl">📷</div>
                        <p className="text-xs text-gray-500">Cliquer pour ajouter une photo</p>
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
                      </label>
                    )}
                  </div>
                </div>

                {/* Bouton envoi */}
                <button
                  onClick={handleEnvoyerSignalement}
                  disabled={!form.typeIntervention || !form.description.trim()}
                  className={`w-full ${roleBgColor} text-white py-4 rounded-2xl font-bold text-base transition disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  🔔 Envoyer le signalement
                </button>

                <p className="text-xs text-gray-500 text-center">Votre gestionnaire sera notifié immédiatement. Vous recevrez une réponse dans votre canal de messages.</p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* VUE PROFIL */}
        {/* ══════════════════════════════════════════════════ */}
        {view === 'profil' && profile && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h2 className="font-bold text-gray-900 mb-4">👤 Vos informations</h2>

              {/* Rôle */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Votre rôle</label>
                <div className="flex gap-2">
                  {[
                    { val: 'coproprio', label: '🏠 Copropriétaire' },
                    { val: 'locataire', label: '🔑 Locataire' },
                    { val: 'technicien', label: '🔧 Technicien bâtiment' },
                  ].map(opt => (
                    <button
                      key={opt.val}
                      onClick={() => saveProfile({ ...profile, role: opt.val as DemandeurRole })}
                      className={`flex-1 text-xs px-2 py-2 rounded-xl border-2 font-medium transition ${profile.role === opt.val ? `${roleBgLight} ${roleBorderColor} ${roleTextColor}` : 'border-gray-200 text-gray-500'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nom / Prénom */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Prénom</label>
                  <input
                    type="text"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                    value={profile.prenom}
                    onChange={e => saveProfile({ ...profile, prenom: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Nom</label>
                  <input
                    type="text"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                    value={profile.nom}
                    onChange={e => saveProfile({ ...profile, nom: e.target.value })}
                  />
                </div>
              </div>

              {/* Contact */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Téléphone</label>
                  <input
                    type="tel"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                    value={profile.telephone}
                    onChange={e => saveProfile({ ...profile, telephone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Email</label>
                  <input
                    type="email"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                    value={profile.email}
                    onChange={e => saveProfile({ ...profile, email: e.target.value })}
                  />
                </div>
              </div>

              {/* Localisation (masquée pour technicien) */}
              {profile.role !== 'technicien' && (
                <>
                  <div className="mb-3">
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Résidence</label>
                    <input
                      type="text"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                      value={profile.immeuble}
                      onChange={e => saveProfile({ ...profile, immeuble: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">Bâtiment</label>
                      <input
                        type="text"
                        placeholder="ex: A"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                        value={profile.batiment}
                        onChange={e => saveProfile({ ...profile, batiment: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">Étage</label>
                      <input
                        type="text"
                        placeholder="ex: 3"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                        value={profile.etage}
                        onChange={e => saveProfile({ ...profile, etage: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">Lot / Porte</label>
                      <input
                        type="text"
                        placeholder="ex: 12"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                        value={profile.numLot}
                        onChange={e => saveProfile({ ...profile, numLot: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Lien portail */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="font-semibold text-gray-700 text-sm mb-2">🔗 Partager ce portail</h3>
              <p className="text-xs text-gray-500 mb-3">Partagez ce lien avec les résidents pour qu'ils puissent signaler des problèmes directement.</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600 bg-gray-50"
                  value={typeof window !== 'undefined' ? window.location.href : '/coproprietaire/portail'}
                />
                <button
                  onClick={() => typeof navigator !== 'undefined' && navigator.clipboard?.writeText(window.location.href)}
                  className="bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg text-xs font-medium transition"
                >
                  Copier
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
