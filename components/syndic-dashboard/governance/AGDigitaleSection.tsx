'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { useTranslation, useLocale } from '@/lib/i18n/context'

export default function AGDigitaleSection({ user, userRole, getToken }: { user: any; userRole: string; getToken?: () => Promise<string | null> }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const uid = user?.id || 'demo'
  const migratedRef = useRef(false)

  // Types enrichis — vote par correspondance + majorités légales
  type MajoriteType = 'art24' | 'art25' | 'art26' | 'unanimite'
  type VoteCorrespondance = { copropriétaire: string; tantiemes: number; vote: 'pour' | 'contre' | 'abstention'; recu: string }
  type Resolution = {
    id: string; titre: string; description: string; majorite: MajoriteType
    votePour: number; voteContre: number; voteAbstention: number
    votesCorrespondance: VoteCorrespondance[]
    statut: 'en_cours' | 'adoptée' | 'rejetée'
  }
  type AG = {
    id: string; titre: string; immeuble: string; date: string; lieu: string
    type: 'ordinaire' | 'extraordinaire'; statut: 'brouillon' | 'convoquée' | 'en_cours' | 'clôturée'
    ordre_du_jour: string[]; resolutions: Resolution[]
    quorum: number; totalTantiemes: number; presents: number
    signataireNom: string; signataireRole: string; signatureTs: string
    createdAt: string
  }

  const [ags, setAGs] = useState<AG[]>([])
  const [loading, setLoading] = useState(true)
  const [activeAG, setActiveAG] = useState<AG | null>(null)
  const [showNewAG, setShowNewAG] = useState(false)
  const [showVote, setShowVote] = useState<Resolution | null>(null)
  const [showVoteCorr, setShowVoteCorr] = useState<Resolution | null>(null)
  const [showSignature, setShowSignature] = useState(false)
  const [activeTab, setActiveTab] = useState<'liste' | 'details' | 'votes' | 'correspondance' | 'pv'>('liste')
  const [agForm, setAgForm] = useState({ titre: '', immeuble: '', date: '', lieu: '', type: 'ordinaire', quorum: '50', totalTantiemes: '10000', odj: '' })
  const [newResolution, setNewResolution] = useState({ titre: '', description: '', majorite: 'art24' as MajoriteType })
  const [voteCorForm, setVoteCorForm] = useState({ copropriétaire: '', tantiemes: '', vote: 'pour' as 'pour' | 'contre' | 'abstention', recu: new Date().toISOString().split('T')[0] })
  const [sigForm, setSigForm] = useState({ nom: '', role: 'Président de séance' })
  const [pvPdfLoading, setPvPdfLoading] = useState(false)
  const [quorumInput, setQuorumInput] = useState('')
  const [newResDesc, setNewResDesc] = useState('')
  const [voteInputs, setVoteInputs] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)

  // ── Mapper DB → frontend types ──────────────────────────────────────
  const dbToAG = (row: any): AG => ({
    id: row.id,
    titre: row.titre || '',
    immeuble: row.immeuble || '',
    date: row.date_ag || '',
    lieu: row.lieu || '',
    type: row.type_ag || 'ordinaire',
    statut: row.statut || 'brouillon',
    ordre_du_jour: Array.isArray(row.ordre_du_jour) ? row.ordre_du_jour : [],
    quorum: row.quorum || 50,
    totalTantiemes: row.total_tantiemes || 10000,
    presents: row.presents || 0,
    signataireNom: row.signataire_nom || '',
    signataireRole: row.signataire_role || '',
    signatureTs: row.signature_ts || '',
    createdAt: row.created_at || '',
    resolutions: (row.resolutions || []).map((r: any) => ({
      id: r.id,
      titre: r.titre || '',
      description: r.description || '',
      majorite: r.majorite || 'art24',
      votePour: r.vote_pour || 0,
      voteContre: r.vote_contre || 0,
      voteAbstention: r.vote_abstention || 0,
      votesCorrespondance: (r.votesCorrespondance || []).map((vc: any) => ({
        copropriétaire: vc.copropriétaire || vc['copropriétaire'] || '',
        tantiemes: vc.tantiemes || 0,
        vote: vc.vote || 'abstention',
        recu: vc.date_reception || vc.recu || '',
      })),
      statut: r.statut || 'en_cours',
    })),
  })

  // ── Fetch AGs from API ──────────────────────────────────────────────
  const fetchAGs = useCallback(async () => {
    if (!getToken) {
      // Fallback localStorage if no token
      try { setAGs(JSON.parse(localStorage.getItem(`fixit_ags_${uid}`) || '[]')) } catch { setAGs([]) }
      setLoading(false)
      return
    }
    try {
      const token = await getToken()
      if (!token) { setLoading(false); return }
      const res = await fetch('/api/syndic/assemblees', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        // La liste retourne les AG sans résolutions détaillées
        // Pour chaque AG, charger les détails complets
        const agsList: AG[] = (data.assemblees || []).map((row: any) => dbToAG({
          ...row,
          resolutions: [], // Les résolutions seront chargées quand on ouvre une AG
        }))
        setAGs(agsList)

        // Tenter migration localStorage → API
        migrateFromLocalStorage(agsList)
      }
    } catch (err) {
      console.error('[AG] Fetch error:', err)
      try { setAGs(JSON.parse(localStorage.getItem(`fixit_ags_${uid}`) || '[]')) } catch { setAGs([]) }
    }
    setLoading(false)
  }, [getToken, uid])

  // ── Migration localStorage → Supabase ──────────────────────────────
  const migrateFromLocalStorage = useCallback(async (existingFromDb: AG[]) => {
    if (migratedRef.current || !getToken) return
    migratedRef.current = true
    const migrationFlag = `fixit_ags_migrated_${uid}`
    if (typeof window !== 'undefined' && localStorage.getItem(migrationFlag)) return

    try {
      const raw = localStorage.getItem(`fixit_ags_${uid}`)
      if (!raw) return
      const localAGs = JSON.parse(raw)
      if (!Array.isArray(localAGs) || localAGs.length === 0) return

      // Ne pas migrer si on a déjà des AG en DB
      if (existingFromDb.length > 0) {
        localStorage.setItem(migrationFlag, 'true')
        return
      }

      const token = await getToken()
      if (!token) return

      const res = await fetch('/api/syndic/assemblees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ assemblees: localAGs }),
      })

      if (res.ok) {
        localStorage.setItem(migrationFlag, 'true')
        localStorage.removeItem(`fixit_ags_${uid}`)
        fetchAGs() // Recharger depuis l'API
        console.log('[AG] Migration localStorage → Supabase OK')
      }
    } catch (err) {
      console.error('[AG] Migration error:', err)
    }
  }, [getToken, uid, fetchAGs])

  useEffect(() => { fetchAGs() }, [fetchAGs])

  // ── Charger les détails complets d'une AG (résolutions + votes) ────
  const loadAGDetails = useCallback(async (agId: string): Promise<AG | null> => {
    if (!getToken) {
      return ags.find(a => a.id === agId) || null
    }
    try {
      const token = await getToken()
      if (!token) return null
      const res = await fetch(`/api/syndic/assemblees?id=${agId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        if (data.assemblee) {
          return dbToAG(data.assemblee)
        }
      }
    } catch (err) {
      console.error('[AG] Load details error:', err)
    }
    return ags.find(a => a.id === agId) || null
  }, [getToken, ags])

  // ── API helper for PATCH actions ───────────────────────────────────
  const apiPatch = useCallback(async (body: Record<string, unknown>): Promise<any> => {
    if (!getToken) return null
    try {
      const token = await getToken()
      if (!token) return null
      const res = await fetch('/api/syndic/assemblees', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      return res.ok ? await res.json() : null
    } catch { return null }
  }, [getToken])

  // ── saveAGs — met à jour le state (la synchro API se fait par action) ──
  const saveAGs = (updated: AG[]) => { setAGs(updated) }

  // Calcul majorité selon la loi du 10/07/1965
  const calculerMajorite = (res: Resolution, totalTantièmes: number): { adopté: boolean; detail: string } => {
    const exprimés = res.votePour + res.voteContre // abstentions exclues pour art24
    const total = res.votePour + res.voteContre + res.voteAbstention
    switch (res.majorite) {
      case 'art24': // majorité simple des voix exprimées
        return { adopté: exprimés > 0 && res.votePour > res.voteContre, detail: `Art. 24 — Majorité simple : ${res.votePour} POUR / ${res.voteContre} CONTRE` }
      case 'art25': // majorité absolue des tantièmes du syndicat (>50% du total)
        return { adopté: res.votePour > totalTantièmes / 2, detail: `Art. 25 — Majorité absolue : ${res.votePour}/${totalTantièmes} (seuil : ${(totalTantièmes / 2).toFixed(0)})` }
      case 'art26': // double majorité : ≥2/3 des tantièmes ET >50% des copropriétaires (ici on fait 2/3 tantièmes)
        return { adopté: res.votePour >= totalTantièmes * 2 / 3, detail: `Art. 26 — Double majorité : ${res.votePour}/${totalTantièmes} (seuil : ${(totalTantièmes * 2 / 3).toFixed(0)})` }
      case 'unanimite':
        return { adopté: total > 0 && res.voteContre === 0 && res.voteAbstention === 0, detail: `Unanimité requise — ${total > 0 && res.voteContre === 0 ? 'AUCUN VOTE CONTRE' : `${res.voteContre} CONTRE`}` }
    }
  }

  const MAJORITE_LABELS: Record<MajoriteType, string> = { art24: t('syndicDash.ag.majoriteArt24'), art25: t('syndicDash.ag.majoriteArt25'), art26: t('syndicDash.ag.majoriteArt26'), unanimite: t('syndicDash.ag.majoriteUnanime') }

  const handleCreateAG = async () => {
    if (!agForm.titre.trim() || !agForm.date) return
    setSaving(true)
    try {
      if (getToken) {
        const token = await getToken()
        if (!token) return
        const res = await fetch('/api/syndic/assemblees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            assemblee: {
              titre: agForm.titre,
              immeuble: agForm.immeuble,
              date: agForm.date,
              lieu: agForm.lieu,
              type: agForm.type,
              ordre_du_jour: agForm.odj.split('\n').filter(l => l.trim()),
              quorum: parseFloat(agForm.quorum) || 50,
              totalTantiemes: parseInt(agForm.totalTantiemes) || 10000,
            },
          }),
        })
        if (res.ok) {
          const data = await res.json()
          const newAG = dbToAG({ ...data.assemblee, resolutions: [] })
          const updated = [newAG, ...ags]
          saveAGs(updated)
          setActiveAG(newAG)
        }
      } else {
        const ag: AG = {
          id: Date.now().toString(), titre: agForm.titre, immeuble: agForm.immeuble, date: agForm.date, lieu: agForm.lieu,
          type: agForm.type as any, statut: 'brouillon', ordre_du_jour: agForm.odj.split('\n').filter(l => l.trim()),
          resolutions: [], quorum: parseFloat(agForm.quorum) || 50, totalTantiemes: parseInt(agForm.totalTantiemes) || 10000,
          presents: 0, signataireNom: '', signataireRole: '', signatureTs: '', createdAt: new Date().toISOString()
        }
        saveAGs([ag, ...ags])
        setActiveAG(ag)
      }
      setShowNewAG(false)
      setActiveTab('details')
      setAgForm({ titre: '', immeuble: '', date: '', lieu: '', type: 'ordinaire', quorum: '50', totalTantiemes: '10000', odj: '' })
    } finally { setSaving(false) }
  }

  const handleAddResolution = async () => {
    if (!newResolution.titre.trim() || !activeAG) return
    setSaving(true)
    try {
      if (getToken) {
        const result = await apiPatch({
          action: 'add_resolution',
          assemblee_id: activeAG.id,
          titre: newResolution.titre,
          description: newResDesc,
          majorite: newResolution.majorite,
        })
        if (result?.resolution) {
          const res: Resolution = {
            id: result.resolution.id, titre: result.resolution.titre, description: result.resolution.description || '',
            majorite: result.resolution.majorite, votePour: 0, voteContre: 0, voteAbstention: 0, votesCorrespondance: [], statut: 'en_cours'
          }
          const updated = ags.map(a => a.id === activeAG.id ? { ...a, resolutions: [...a.resolutions, res] } : a)
          saveAGs(updated)
          setActiveAG(updated.find(a => a.id === activeAG.id) || null)
        }
      } else {
        const res: Resolution = { id: Date.now().toString(), titre: newResolution.titre, description: newResDesc, majorite: newResolution.majorite, votePour: 0, voteContre: 0, voteAbstention: 0, votesCorrespondance: [], statut: 'en_cours' }
        const updated = ags.map(a => a.id === activeAG.id ? { ...a, resolutions: [...a.resolutions, res] } : a)
        saveAGs(updated)
        setActiveAG(updated.find(a => a.id === activeAG.id) || null)
      }
      setNewResolution({ titre: '', description: '', majorite: 'art24' })
      setNewResDesc('')
    } finally { setSaving(false) }
  }

  const handleVoteSeance = async (resId: string) => {
    if (!activeAG) return
    const pour = voteInputs[`${resId}_pour`] || 0
    const contre = voteInputs[`${resId}_contre`] || 0
    const abs = voteInputs[`${resId}_abs`] || 0

    // Sync to API
    if (getToken) {
      await apiPatch({ action: 'vote_seance', resolution_id: resId, pour, contre, abstention: abs })
    }

    const updated = ags.map(a => {
      if (a.id !== activeAG.id) return a
      const res = a.resolutions.map(r => {
        if (r.id !== resId) return r
        const newPour = r.votePour + pour
        const newContre = r.voteContre + contre
        const newAbs = r.voteAbstention + abs
        const { adopté } = calculerMajorite({ ...r, votePour: newPour, voteContre: newContre, voteAbstention: newAbs }, a.totalTantiemes)
        return { ...r, votePour: newPour, voteContre: newContre, voteAbstention: newAbs, statut: (newPour + newContre + newAbs > 0 ? (adopté ? 'adoptée' : 'rejetée') : 'en_cours') as Resolution['statut'] }
      })
      return { ...a, resolutions: res }
    })
    saveAGs(updated)
    setActiveAG(updated.find(a => a.id === activeAG.id) || null)
    setVoteInputs(prev => { const n = {...prev}; delete n[`${resId}_pour`]; delete n[`${resId}_contre`]; delete n[`${resId}_abs`]; return n })
  }

  const handleVoteCorrespondance = async () => {
    if (!showVoteCorr || !activeAG || !voteCorForm.copropriétaire.trim()) return
    const vc: VoteCorrespondance = { copropriétaire: voteCorForm.copropriétaire, tantiemes: parseInt(voteCorForm.tantiemes) || 0, vote: voteCorForm.vote, recu: voteCorForm.recu }

    // Sync to API
    if (getToken) {
      await apiPatch({
        action: 'vote_correspondance',
        resolution_id: showVoteCorr.id,
        copropriétaire: vc.copropriétaire,
        tantiemes: vc.tantiemes,
        vote: vc.vote,
        date_reception: vc.recu,
      })
      // Also update resolution vote totals via vote_seance
      await apiPatch({
        action: 'vote_seance',
        resolution_id: showVoteCorr.id,
        pour: vc.vote === 'pour' ? vc.tantiemes : 0,
        contre: vc.vote === 'contre' ? vc.tantiemes : 0,
        abstention: vc.vote === 'abstention' ? vc.tantiemes : 0,
      })
    }

    const updated = ags.map(a => {
      if (a.id !== activeAG.id) return a
      const res = a.resolutions.map(r => {
        if (r.id !== showVoteCorr.id) return r
        const newVotesCorr = [...r.votesCorrespondance, vc]
        const newPour = r.votePour + (vc.vote === 'pour' ? vc.tantiemes : 0)
        const newContre = r.voteContre + (vc.vote === 'contre' ? vc.tantiemes : 0)
        const newAbs = r.voteAbstention + (vc.vote === 'abstention' ? vc.tantiemes : 0)
        const { adopté } = calculerMajorite({ ...r, votePour: newPour, voteContre: newContre, voteAbstention: newAbs }, a.totalTantiemes)
        return { ...r, votePour: newPour, voteContre: newContre, voteAbstention: newAbs, votesCorrespondance: newVotesCorr, statut: (newPour + newContre + newAbs > 0 ? (adopté ? 'adoptée' : 'rejetée') : 'en_cours') as Resolution['statut'] }
      })
      return { ...a, resolutions: res }
    })
    saveAGs(updated)
    setActiveAG(updated.find(a => a.id === activeAG.id) || null)
    setShowVoteCorr(null)
    setVoteCorForm({ copropriétaire: '', tantiemes: '', vote: 'pour', recu: new Date().toISOString().split('T')[0] })
  }

  const handleSignerPV = async () => {
    if (!activeAG || !sigForm.nom.trim()) return
    const ts = new Date().toISOString()

    if (getToken) {
      await apiPatch({ action: 'update_ag', id: activeAG.id, signataireNom: sigForm.nom, signataireRole: sigForm.role, signatureTs: ts })
    }

    const updated = ags.map(a => a.id === activeAG.id ? { ...a, signataireNom: sigForm.nom, signataireRole: sigForm.role, signatureTs: ts } : a)
    saveAGs(updated)
    setActiveAG(updated.find(a => a.id === activeAG.id) || null)
    setShowSignature(false)
  }

  const handleConvoquer = async (agId: string) => {
    if (getToken) await apiPatch({ action: 'update_ag', id: agId, statut: 'convoquée' })
    const u = ags.map(a => a.id === agId ? { ...a, statut: 'convoquée' as const } : a); saveAGs(u); if (activeAG?.id === agId) setActiveAG(u.find(a => a.id === agId) || null)
  }
  const handleDemarrer = async (agId: string) => {
    if (getToken) await apiPatch({ action: 'update_ag', id: agId, statut: 'en_cours' })
    const u = ags.map(a => a.id === agId ? { ...a, statut: 'en_cours' as const } : a); saveAGs(u); if (activeAG?.id === agId) setActiveAG(u.find(a => a.id === agId) || null)
  }
  const handleCloture = async (agId: string) => {
    if (getToken) await apiPatch({ action: 'update_ag', id: agId, statut: 'clôturée' })
    const u = ags.map(a => a.id === agId ? { ...a, statut: 'clôturée' as const } : a); saveAGs(u); if (activeAG?.id === agId) setActiveAG(u.find(a => a.id === agId) || null)
  }

  const exportPVPdf = async (ag: AG) => {
    setPvPdfLoading(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = 210; const margin = 20; const textWidth = W - 2 * margin
      let y = 20

      const addLine = (text: string, size = 10, bold = false, color: [number,number,number] = [0,0,0]) => {
        doc.setFontSize(size); doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setTextColor(...color)
        const lines = doc.splitTextToSize(text, textWidth)
        lines.forEach((line: string) => { if (y > 270) { doc.addPage(); y = 20 }; doc.text(line, margin, y); y += size * 0.45 })
        y += 2
      }

      // En-tête
      doc.setFillColor(37, 99, 235); doc.rect(0, 0, W, 35, 'F')
      doc.setTextColor(255,255,255); doc.setFontSize(16); doc.setFont('helvetica','bold')
      doc.text('PROCÈS-VERBAL D\'ASSEMBLÉE GÉNÉRALE', W/2, 15, { align: 'center' })
      doc.setFontSize(11); doc.setFont('helvetica','normal')
      doc.text(ag.type === 'ordinaire' ? 'ASSEMBLÉE GÉNÉRALE ORDINAIRE' : 'ASSEMBLÉE GÉNÉRALE EXTRAORDINAIRE', W/2, 24, { align: 'center' })
      y = 45

      addLine(ag.titre, 14, true, [30,64,175])
      y += 2
      addLine(`Immeuble : ${ag.immeuble || '—'}`, 10, false, [80,80,80])
      addLine(`Date : ${new Date(ag.date).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}`, 10)
      addLine(`Lieu : ${ag.lieu || 'Non précisé'}`, 10)
      y += 4

      // Quorum
      doc.setFillColor(239,246,255); doc.rect(margin, y, textWidth, 22, 'F')
      y += 6
      addLine('QUORUM', 11, true, [37,99,235])
      addLine(`Tantièmes présents/représentés : ${ag.presents} / ${ag.totalTantiemes} (${ag.totalTantiemes > 0 ? ((ag.presents/ag.totalTantiemes)*100).toFixed(1) : 0}%)  —  Quorum requis : ${ag.quorum}%`, 9)
      y += 4

      // Ordre du jour
      addLine('ORDRE DU JOUR', 12, true, [37,99,235])
      doc.setDrawColor(37,99,235); doc.line(margin, y, margin + textWidth, y); y += 4
      ag.ordre_du_jour.forEach((item, i) => addLine(`${i+1}. ${item}`, 10))
      y += 4

      // Résolutions
      addLine('RÉSOLUTIONS ET VOTES', 12, true, [37,99,235])
      doc.setDrawColor(37,99,235); doc.line(margin, y, margin + textWidth, y); y += 4
      ag.resolutions.forEach((r, i) => {
        if (y > 240) { doc.addPage(); y = 20 }
        const { adopté, detail } = calculerMajorite(r, ag.totalTantiemes)
        doc.setFillColor(adopté ? 240 : 254, adopté ? 253 : 242, adopté ? 244 : 242)
        doc.rect(margin, y-2, textWidth, 44, 'F')
        addLine(`Résolution ${i+1} — ${r.titre}`, 11, true, adopté ? [22,101,52] : [185,28,28])
        addLine(MAJORITE_LABELS[r.majorite], 9, false, [100,100,100])
        if (r.description) addLine(r.description, 9)
        addLine(`POUR : ${r.votePour} tantièmes   |   CONTRE : ${r.voteContre} tantièmes   |   ABSTENTION : ${r.voteAbstention} tantièmes`, 9)
        addLine(detail, 9, false, [80,80,80])
        addLine(`RÉSULTAT : ${r.statut.toUpperCase()}`, 10, true, adopté ? [22,101,52] : [185,28,28])
        if (r.votesCorrespondance.length > 0) {
          addLine(`Votes par correspondance (${r.votesCorrespondance.length}) :`, 9, true)
          r.votesCorrespondance.forEach(vc => addLine(`  • ${vc.copropriétaire} — ${vc.tantiemes} tantièmes — ${vc.vote.toUpperCase()} (reçu le ${new Date(vc.recu).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')})`, 8))
        }
        y += 4
      })

      // Résumé
      const adopted = ag.resolutions.filter(r => r.statut === 'adoptée').length
      const rejected = ag.resolutions.filter(r => r.statut === 'rejetée').length
      y += 4
      doc.setFillColor(249,250,251); doc.rect(margin, y, textWidth, 18, 'F')
      y += 5
      addLine(`RÉSUMÉ : ${adopted} résolution(s) adoptée(s)  ·  ${rejected} rejetée(s)  ·  ${ag.resolutions.length - adopted - rejected} en cours`, 10, true)
      y += 8

      // Signature
      if (ag.signataireNom) {
        doc.setFillColor(240,253,244); doc.rect(margin, y, textWidth, 28, 'F')
        y += 5
        addLine('SIGNATURE ÉLECTRONIQUE', 11, true, [22,101,52])
        addLine(`Signé par : ${ag.signataireNom} — ${ag.signataireRole}`, 10)
        addLine(`Horodatage : ${new Date(ag.signatureTs).toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}`, 9)
        addLine(`Empreinte : ${btoa(ag.id + ag.signataireNom + ag.signatureTs).substring(0,32).toUpperCase()}`, 8, false, [100,100,100])
      } else {
        addLine('⚠️  PV non encore signé', 10, true, [180,83,9])
      }

      // Pied de page
      doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(150,150,150)
      const pages = doc.getNumberOfPages()
      for (let p = 1; p <= pages; p++) {
        doc.setPage(p); doc.text(`Vitfix Pro — Généré le ${new Date().toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}  |  Page ${p}/${pages}`, W/2, 290, { align: 'center' })
      }

      doc.save(`PV_AG_${ag.titre.replace(/\s+/g,'_')}_${ag.date.split('T')[0]}.pdf`)
    } catch(e) { toast.error(t('syndicDash.ag.pdfError') + ' : ' + e) }
    setPvPdfLoading(false)
  }

  const STATUS_COLORS: Record<string, string> = { brouillon: 'bg-[#F7F4EE] text-gray-700', convoquée: 'bg-blue-100 text-blue-700', en_cours: 'bg-orange-100 text-orange-700', clôturée: 'bg-green-100 text-green-700' }
  const RES_COLORS: Record<string, string> = { en_cours: 'bg-orange-100 text-orange-700', adoptée: 'bg-green-100 text-green-700', rejetée: 'bg-red-100 text-red-700' }

  if (loading) {
    return (
      <div className="animate-fadeIn flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="animate-fadeIn">
      <div className="bg-white px-6 lg:px-10 py-5 border-b-2 border-blue-500 shadow-sm flex justify-between items-center">
        <div><h1 className="text-2xl font-semibold">🏛️ {t('syndicDash.ag.title')}</h1><p className="text-sm text-gray-500">{t('syndicDash.ag.subtitle')}</p></div>
        <button onClick={() => setShowNewAG(true)} disabled={saving} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition shadow-sm disabled:opacity-60">{t('syndicDash.ag.newAG')}</button>
      </div>

      {!activeAG ? (
        <div className="p-6 lg:p-8">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-blue-400"><div className="text-sm text-gray-500">{t('syndicDash.ag.totalAG')}</div><div className="text-3xl font-bold text-blue-600">{ags.length}</div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-orange-400"><div className="text-sm text-gray-500">{t('syndicDash.ag.inProgress')}</div><div className="text-3xl font-bold text-[#C9A84C]">{ags.filter(a => a.statut === 'en_cours').length}</div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-green-400"><div className="text-sm text-gray-500">{t('syndicDash.ag.closed')}</div><div className="text-3xl font-bold text-green-600">{ags.filter(a => a.statut === 'clôturée').length}</div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-[#C9A84C]"><div className="text-sm text-gray-500">{t('syndicDash.ag.totalResolutions')}</div><div className="text-3xl font-bold text-[#C9A84C]">{ags.reduce((s, a) => s + a.resolutions.length, 0)}</div></div>
          </div>
          {ags.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center"><div className="text-6xl mb-4">🏛️</div><h3 className="text-xl font-bold mb-2">{t('syndicDash.ag.noAG')}</h3><p className="text-gray-500 mb-6">{t('syndicDash.ag.noAGDesc')}</p><button onClick={() => setShowNewAG(true)} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700">{t('syndicDash.ag.createFirstAG')}</button></div>
          ) : (
            <div className="space-y-4">
              {ags.map(ag => (
                <div key={ag.id} onClick={async () => { const detailed = await loadAGDetails(ag.id); setActiveAG(detailed || ag); setActiveTab('details') }} className="bg-white rounded-2xl shadow-sm p-6 cursor-pointer hover:shadow-md transition hover:border-blue-200 border-2 border-transparent">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap"><h3 className="font-bold text-lg">{ag.titre}</h3><span className={`px-2 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[ag.statut]}`}>{ag.statut}</span><span className="bg-[#F7F4EE] text-gray-600 px-2 py-1 rounded-full text-xs">{ag.type}</span>{ag.signataireNom && <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs">✍️ Signé</span>}</div>
                      <div className="flex gap-4 text-sm text-gray-500 flex-wrap">{ag.immeuble && <span>🏢 {ag.immeuble}</span>}<span>📅 {new Date(ag.date).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</span>{ag.lieu && <span>📍 {ag.lieu}</span>}<span>📋 {ag.resolutions.length} {t('syndicDash.ag.resolutionCount')}</span><span>✅ {ag.resolutions.filter(r => r.statut === 'adoptée').length} {t('syndicDash.ag.adoptedCount')}</span><span>📮 {ag.resolutions.reduce((s,r) => s + r.votesCorrespondance.length, 0)} {t('syndicDash.ag.corrVoteCount')}</span></div>
                    </div>
                    <div className="text-gray-300 text-2xl">›</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 lg:p-8">
          <button onClick={() => setActiveAG(null)} className="flex items-center gap-2 text-blue-600 hover:underline mb-6 font-semibold">{t('syndicDash.ag.backToList')}</button>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <h2 className="text-2xl font-bold">{activeAG.titre}</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${STATUS_COLORS[activeAG.statut]}`}>{activeAG.statut}</span>
            {activeAG.signataireNom && <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold">✍️ {t('syndicDash.ag.signedBy')} {activeAG.signataireNom}</span>}
          </div>
          <div className="flex gap-2 mb-6 flex-wrap">
            {activeAG.statut === 'brouillon' && <button onClick={() => handleConvoquer(activeAG.id)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700">📤 {t('syndicDash.ag.sendConvocations')}</button>}
            {activeAG.statut === 'convoquée' && <button onClick={() => handleDemarrer(activeAG.id)} className="bg-[#C9A84C] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#C9A84C]">▶️ {t('syndicDash.ag.startAG')}</button>}
            {activeAG.statut === 'en_cours' && <button onClick={() => handleCloture(activeAG.id)} className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-green-700">✅ {t('syndicDash.ag.closeAG')}</button>}
            {activeAG.statut === 'clôturée' && !activeAG.signataireNom && <button onClick={() => setShowSignature(true)} className="bg-[#0D1B2E] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#152338]">✍️ {t('syndicDash.ag.signPV')}</button>}
            {activeAG.statut === 'clôturée' && <button onClick={() => exportPVPdf(activeAG)} disabled={pvPdfLoading} className="bg-[#152338] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#0D1B2E] disabled:opacity-60">{pvPdfLoading ? `⏳ ${t('syndicDash.ag.generating')}` : `📄 ${t('syndicDash.ag.exportPVPdf')}`}</button>}
          </div>

          <div className="flex gap-1 mb-6 border-b overflow-x-auto">
            {(['details', 'votes', 'correspondance', 'pv'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition ${activeTab === tab ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>
                {tab === 'details' ? `📋 ${t('syndicDash.ag.tabDetails')}` : tab === 'votes' ? `🗳️ ${t('syndicDash.ag.tabVotes')}` : tab === 'correspondance' ? `📮 ${t('syndicDash.ag.tabCorrespondance')}` : `📄 ${t('syndicDash.ag.tabPV')}`}
              </button>
            ))}
          </div>

          {activeTab === 'details' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h3 className="font-bold text-lg mb-4">📋 {t('syndicDash.ag.information')}</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex gap-2"><span className="text-gray-500 w-36">{t('syndicDash.ag.building')}</span><span className="font-semibold">{activeAG.immeuble || '—'}</span></div>
                  <div className="flex gap-2"><span className="text-gray-500 w-36">{t('syndicDash.ag.date')}</span><span className="font-semibold">{new Date(activeAG.date).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
                  <div className="flex gap-2"><span className="text-gray-500 w-36">{t('syndicDash.ag.location')}</span><span>{activeAG.lieu || '—'}</span></div>
                  <div className="flex gap-2"><span className="text-gray-500 w-36">{t('syndicDash.ag.typeLabel')}</span><span className="capitalize">{activeAG.type === 'ordinaire' ? t('syndicDash.ag.typeOGM') : t('syndicDash.ag.typeEGM')}</span></div>
                  <div className="flex gap-2"><span className="text-gray-500 w-36">{t('syndicDash.ag.requiredQuorum')}</span><span className="font-semibold">{activeAG.quorum}%</span></div>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h3 className="font-bold text-lg mb-4">👥 {t('syndicDash.ag.quorumTitle')} — {activeAG.presents} / {activeAG.totalTantiemes} {t('syndicDash.ag.tantiemes')}</h3>
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1"><span>{t('syndicDash.ag.attendanceRate')}</span><span className={`font-bold ${activeAG.presents / activeAG.totalTantiemes * 100 >= activeAG.quorum ? 'text-green-600' : 'text-[#C9A84C]'}`}>{activeAG.totalTantiemes > 0 ? ((activeAG.presents / activeAG.totalTantiemes) * 100).toFixed(1) : 0}% {activeAG.presents / activeAG.totalTantiemes * 100 >= activeAG.quorum ? `✅ ${t('syndicDash.ag.reached')}` : `⚠️ ${t('syndicDash.ag.insufficient')}`}</span></div>
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden"><div className={`h-4 rounded-full transition-all ${activeAG.presents / activeAG.totalTantiemes * 100 >= activeAG.quorum ? 'bg-green-500' : 'bg-orange-400'}`} style={{ width: `${Math.min((activeAG.presents / activeAG.totalTantiemes) * 100, 100)}%` }} /></div>
                  <div className="text-xs text-gray-500 mt-1">{t('syndicDash.ag.quorumThreshold')} : {(activeAG.totalTantiemes * activeAG.quorum / 100).toFixed(0)} {t('syndicDash.ag.tantiemes')}</div>
                </div>
                {activeAG.statut === 'en_cours' && (
                  <div className="flex gap-2 mt-3">
                    <input type="number" value={quorumInput} onChange={e => setQuorumInput(e.target.value)} placeholder={t('syndicDash.ag.tantToAdd')} className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-blue-500 outline-none" />
                    <button onClick={async () => { const v = parseInt(quorumInput || '0'); if (v > 0) { const newPresents = (activeAG?.presents || 0) + v; if (getToken) await apiPatch({ action: 'update_ag', id: activeAG.id, presents: newPresents }); const u = ags.map(a => a.id === activeAG.id ? { ...a, presents: newPresents } : a); saveAGs(u); setActiveAG(u.find(a => a.id === activeAG.id) || null); setQuorumInput('') } }} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700">{t('syndicDash.ag.add')}</button>
                  </div>
                )}
              </div>
              <div className="bg-white rounded-2xl shadow-sm p-6 xl:col-span-2">
                <h3 className="font-bold text-lg mb-4">📝 {t('syndicDash.ag.agenda')}</h3>
                {activeAG.ordre_du_jour.length === 0 ? <p className="text-gray-500 text-sm">{t('syndicDash.ag.noPointDefined')}</p> : <ol className="list-decimal pl-5 space-y-2 text-sm">{activeAG.ordre_du_jour.map((item, i) => <li key={i} className="py-1 border-b border-gray-100 last:border-0">{item}</li>)}</ol>}
              </div>
            </div>
          )}

          {activeTab === 'votes' && (
            <div>
              {activeAG.statut === 'en_cours' && (
                <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
                  <h3 className="font-bold mb-4">{t('syndicDash.ag.newResolution')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input value={newResolution.titre} onChange={e => setNewResolution({...newResolution, titre: e.target.value})} placeholder={t('syndicDash.ag.resolutionTitle')} className="md:col-span-2 border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none text-sm" />
                    <select value={newResolution.majorite} onChange={e => setNewResolution({...newResolution, majorite: e.target.value as MajoriteType})} className="border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none text-sm">
                      {(Object.entries(MAJORITE_LABELS) as [MajoriteType, string][]).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <textarea value={newResDesc} onChange={e => setNewResDesc(e.target.value)} placeholder={t('syndicDash.ag.descriptionOptional')} rows={2} className="md:col-span-3 border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none text-sm resize-none" />
                    <button onClick={handleAddResolution} className="md:col-span-3 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700">{t('syndicDash.ag.addResolution')}</button>
                  </div>
                </div>
              )}
              {activeAG.resolutions.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-500">{t('syndicDash.ag.noResolution')} {activeAG.statut === 'en_cours' ? t('syndicDash.ag.addResolutionsPrompt') : ''}</div>
              ) : (
                <div className="space-y-4">
                  {activeAG.resolutions.map((res, i) => {
                    const { adopté, detail } = calculerMajorite(res, activeAG.totalTantiemes)
                    const total = res.votePour + res.voteContre + res.voteAbstention
                    return (
                      <div key={res.id} className={`bg-white rounded-2xl shadow-sm p-6 border-l-4 ${res.statut === 'adoptée' ? 'border-green-400' : res.statut === 'rejetée' ? 'border-red-400' : 'border-orange-300'}`}>
                        <div className="flex justify-between items-start mb-3 flex-wrap gap-2">
                          <div>
                            <h4 className="font-bold text-lg">{t('syndicDash.ag.resolution')} {i + 1} — {res.titre}</h4>
                            {res.description && <p className="text-sm text-gray-500 mt-1">{res.description}</p>}
                            <span className="text-xs text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-full mt-1 inline-block">{MAJORITE_LABELS[res.majorite]}</span>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${RES_COLORS[res.statut]}`}>{res.statut}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3 mb-3">
                          <div className="text-center bg-green-50 rounded-xl p-3"><div className="text-2xl font-bold text-green-600">{res.votePour}</div><div className="text-xs text-gray-500">✅ {t('syndicDash.ag.forTant')}</div></div>
                          <div className="text-center bg-red-50 rounded-xl p-3"><div className="text-2xl font-bold text-red-600">{res.voteContre}</div><div className="text-xs text-gray-500">❌ {t('syndicDash.ag.against')}</div></div>
                          <div className="text-center bg-[#F7F4EE] rounded-xl p-3"><div className="text-2xl font-bold text-gray-600">{res.voteAbstention}</div><div className="text-xs text-gray-500">⬜ {t('syndicDash.ag.abstention')}</div></div>
                        </div>
                        {total > 0 && (
                          <div className="mb-3">
                            <div className="w-full bg-gray-200 rounded-full h-2 flex overflow-hidden">
                              <div className="bg-green-400 h-full" style={{ width: `${total > 0 ? (res.votePour/total*100) : 0}%` }} />
                              <div className="bg-red-400 h-full" style={{ width: `${total > 0 ? (res.voteContre/total*100) : 0}%` }} />
                              <div className="bg-gray-300 h-full" style={{ width: `${total > 0 ? (res.voteAbstention/total*100) : 0}%` }} />
                            </div>
                            <div className="text-xs text-gray-500 mt-1">{detail}</div>
                          </div>
                        )}
                        {res.votesCorrespondance.length > 0 && <div className="text-xs text-[#C9A84C] mb-3">📮 {res.votesCorrespondance.length} {t('syndicDash.ag.corrVotesIncluded')}</div>}
                        {activeAG.statut === 'en_cours' && (
                          <div className="grid grid-cols-3 gap-2 mt-3">
                            <input type="number" min="0" placeholder={t('syndicDash.ag.for')} value={voteInputs[`${res.id}_pour`] || ''} onChange={e => setVoteInputs(p => ({...p, [`${res.id}_pour`]: parseInt(e.target.value)||0}))} className="border-2 border-green-200 rounded-xl px-3 py-2 text-sm focus:border-green-500 outline-none" />
                            <input type="number" min="0" placeholder={t('syndicDash.ag.against')} value={voteInputs[`${res.id}_contre`] || ''} onChange={e => setVoteInputs(p => ({...p, [`${res.id}_contre`]: parseInt(e.target.value)||0}))} className="border-2 border-red-200 rounded-xl px-3 py-2 text-sm focus:border-red-500 outline-none" />
                            <input type="number" min="0" placeholder={t('syndicDash.ag.abstention')} value={voteInputs[`${res.id}_abs`] || ''} onChange={e => setVoteInputs(p => ({...p, [`${res.id}_abs`]: parseInt(e.target.value)||0}))} className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-gray-400 outline-none" />
                            <button onClick={() => handleVoteSeance(res.id)} className="col-span-3 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700">🗳️ {t('syndicDash.ag.validateSessionVote')}</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'correspondance' && (
            <div>
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
                <p className="text-sm text-blue-800"><strong>📮 {t('syndicDash.ag.tabCorrespondance')}</strong> — {t('syndicDash.ag.corrVoteInfo')}</p>
              </div>
              {activeAG.resolutions.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-500">{t('syndicDash.ag.noResolutionCorr')}</div>
              ) : (
                <div className="space-y-4">
                  {activeAG.resolutions.map((res, i) => (
                    <div key={res.id} className="bg-white rounded-2xl shadow-sm p-5">
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <h4 className="font-bold">{t('syndicDash.ag.resolution')} {i+1} — {res.titre}</h4>
                          <span className="text-xs text-blue-600">{MAJORITE_LABELS[res.majorite]}</span>
                        </div>
                        {(activeAG.statut === 'convoquée' || activeAG.statut === 'en_cours') && (
                          <button onClick={() => setShowVoteCorr(res)} className="bg-[#0D1B2E] text-white px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-[#152338]">{t('syndicDash.ag.registerCorrVote')}</button>
                        )}
                      </div>
                      {res.votesCorrespondance.length === 0 ? (
                        <div className="text-sm text-gray-500 py-2">{t('syndicDash.ag.noCorrVote')}</div>
                      ) : (
                        <div className="space-y-1">
                          {res.votesCorrespondance.map((vc, j) => (
                            <div key={j} className="flex items-center gap-3 text-sm bg-[#F7F4EE] rounded-xl px-3 py-2">
                              <span className="font-semibold flex-1">{vc.copropriétaire}</span>
                              <span className="text-gray-500">{vc.tantiemes} {t('syndicDash.ag.tantiemes')}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${vc.vote === 'pour' ? 'bg-green-100 text-green-700' : vc.vote === 'contre' ? 'bg-red-100 text-red-700' : 'bg-[#F7F4EE] text-gray-600'}`}>{vc.vote.toUpperCase()}</span>
                              <span className="text-gray-500 text-xs">{t('syndicDash.ag.receivedOn')} {new Date(vc.recu).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'pv' && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
                <h3 className="font-bold text-lg">📄 {t('syndicDash.ag.pvTitle')}</h3>
                <div className="flex gap-2 flex-wrap">
                  {activeAG.statut === 'clôturée' && !activeAG.signataireNom && <button onClick={() => setShowSignature(true)} className="bg-[#0D1B2E] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#152338]">✍️ {t('syndicDash.ag.sign')}</button>}
                  <button onClick={() => exportPVPdf(activeAG)} disabled={pvPdfLoading} className="bg-[#152338] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#0D1B2E] disabled:opacity-60">{pvPdfLoading ? '⏳…' : '📥 PDF'}</button>
                </div>
              </div>
              <div className="font-mono text-xs bg-[#F7F4EE] rounded-xl p-5 whitespace-pre-wrap leading-relaxed border">
{`PROCÈS-VERBAL D'ASSEMBLÉE GÉNÉRALE ${activeAG.type.toUpperCase()}
════════════════════════════════════════════
${activeAG.titre}
${activeAG.immeuble ? `Immeuble : ${activeAG.immeuble}\n` : ''}Date  : ${new Date(activeAG.date).toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}
Lieu  : ${activeAG.lieu || 'Non précisé'}

QUORUM
Tantièmes présents/représentés : ${activeAG.presents} / ${activeAG.totalTantiemes} (${activeAG.totalTantiemes > 0 ? ((activeAG.presents/activeAG.totalTantiemes)*100).toFixed(1) : 0}%)
Quorum requis : ${activeAG.quorum}%

ORDRE DU JOUR
${activeAG.ordre_du_jour.map((item, i) => `${i+1}. ${item}`).join('\n') || 'Non défini'}

RÉSOLUTIONS
${activeAG.resolutions.map((r, i) => {
  const { adopté, detail } = calculerMajorite(r, activeAG.totalTantiemes)
  return `\nRésolution ${i+1} : ${r.titre}
  Règle de majorité : ${MAJORITE_LABELS[r.majorite]}
  Pour : ${r.votePour} tantièmes | Contre : ${r.voteContre} | Abstention : ${r.voteAbstention}
  Votes par correspondance : ${r.votesCorrespondance.length}
  ${detail}
  ► RÉSULTAT : ${r.statut.toUpperCase()}`
}).join('\n────────────────\n')}

RÉSUMÉ
Adoptées : ${activeAG.resolutions.filter(r=>r.statut==='adoptée').length} | Rejetées : ${activeAG.resolutions.filter(r=>r.statut==='rejetée').length} | Total : ${activeAG.resolutions.length}

${activeAG.signataireNom ? `SIGNATURE ÉLECTRONIQUE
Signé par : ${activeAG.signataireNom} (${activeAG.signataireRole})
Horodatage : ${new Date(activeAG.signatureTs).toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}
Hash : ${typeof btoa !== 'undefined' ? btoa(activeAG.id + activeAG.signataireNom + activeAG.signatureTs).substring(0,32).toUpperCase() : 'N/A'}` : '⚠️  PV non encore signé'}
`}
              </div>
              {activeAG.statut !== 'clôturée' && <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">⚠️ {t('syndicDash.ag.agMustBeClosed')}</div>}
            </div>
          )}
        </div>
      )}

      {showNewAG && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">🏛️ {t('syndicDash.ag.newAGTitle')}</h2></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.ag.titleLabel')}</label><input value={agForm.titre} onChange={e => setAgForm({...agForm, titre: e.target.value})} placeholder={t('syndicDash.ag.titlePlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" /></div>
              <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.ag.buildingLabel')}</label><input value={agForm.immeuble} onChange={e => setAgForm({...agForm, immeuble: e.target.value})} placeholder={t('syndicDash.ag.buildingPlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.ag.dateLabel')}</label><input type="datetime-local" value={agForm.date} onChange={e => setAgForm({...agForm, date: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.ag.typeLabel')}</label><select value={agForm.type} onChange={e => setAgForm({...agForm, type: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none"><option value="ordinaire">{t('syndicDash.ag.typeOrdinaire')}</option><option value="extraordinaire">{t('syndicDash.ag.typeExtraordinaire')}</option></select></div>
              </div>
              <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.ag.locationLabel')}</label><input value={agForm.lieu} onChange={e => setAgForm({...agForm, lieu: e.target.value})} placeholder={t('syndicDash.ag.locationPlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.ag.quorumPercent')}</label><input type="number" value={agForm.quorum} onChange={e => setAgForm({...agForm, quorum: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.ag.totalTantiemes')}</label><input type="number" value={agForm.totalTantiemes} onChange={e => setAgForm({...agForm, totalTantiemes: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" /></div>
              </div>
              <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.ag.agendaLabel')}</label><textarea value={agForm.odj} onChange={e => setAgForm({...agForm, odj: e.target.value})} rows={5} placeholder={t('syndicDash.ag.agendaPlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none resize-none" /></div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowNewAG(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-[#F7F4EE]">{t('syndicDash.ag.cancel')}</button>
              <button onClick={handleCreateAG} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700">{t('syndicDash.ag.createAG')}</button>
            </div>
          </div>
        </div>
      )}

      {showVoteCorr && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">📮 {t('syndicDash.ag.corrVoteTitle')}</h2><p className="text-sm text-gray-500 mt-1">{showVoteCorr.titre}</p></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.ag.coproprietaire')}</label><input value={voteCorForm.copropriétaire} onChange={e => setVoteCorForm({...voteCorForm, copropriétaire: e.target.value})} placeholder={t('syndicDash.ag.coproName')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#C9A84C] outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.ag.tantLabel')}</label><input type="number" value={voteCorForm.tantiemes} onChange={e => setVoteCorForm({...voteCorForm, tantiemes: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#C9A84C] outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.ag.receptionDate')}</label><input type="date" value={voteCorForm.recu} onChange={e => setVoteCorForm({...voteCorForm, recu: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#C9A84C] outline-none" /></div>
              </div>
              <div><label className="block text-sm font-semibold mb-2">{t('syndicDash.ag.voteDirection')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['pour', 'contre', 'abstention'] as const).map(v => (
                    <button key={v} onClick={() => setVoteCorForm({...voteCorForm, vote: v})} className={`py-2 rounded-xl text-sm font-semibold border-2 transition ${voteCorForm.vote === v ? (v === 'pour' ? 'bg-green-500 text-white border-green-500' : v === 'contre' ? 'bg-red-500 text-white border-red-500' : 'bg-[#F7F4EE]0 text-white border-gray-500') : 'border-gray-200 text-gray-600 hover:bg-[#F7F4EE]'}`}>
                      {v === 'pour' ? `✅ ${t('syndicDash.ag.voteFor')}` : v === 'contre' ? `❌ ${t('syndicDash.ag.voteAgainst')}` : `⬜ ${t('syndicDash.ag.voteAbstention')}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowVoteCorr(null)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-[#F7F4EE]">{t('syndicDash.ag.cancel')}</button>
              <button onClick={handleVoteCorrespondance} className="flex-1 py-2.5 bg-[#0D1B2E] text-white rounded-xl font-semibold hover:bg-[#152338]">{t('syndicDash.ag.register')}</button>
            </div>
          </div>
        </div>
      )}

      {showSignature && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">✍️ {t('syndicDash.ag.signatureTitle')}</h2><p className="text-sm text-gray-500 mt-1">{t('syndicDash.ag.signatureIrreversible')}</p></div>
            <div className="p-6 space-y-4">
              <div className="bg-[#F7F4EE] border border-[#E4DDD0] rounded-xl p-3 text-sm text-[#0D1B2E]">{t('syndicDash.ag.signatureInfo')}</div>
              <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.ag.signatoryName')}</label><input value={sigForm.nom} onChange={e => setSigForm({...sigForm, nom: e.target.value})} placeholder={t('syndicDash.ag.signatoryPlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#C9A84C] outline-none" /></div>
              <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.ag.qualityRole')}</label><select value={sigForm.role} onChange={e => setSigForm({...sigForm, role: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#C9A84C] outline-none"><option>{t('syndicDash.ag.rolePresident')}</option><option>{t('syndicDash.ag.roleSyndic')}</option><option>{t('syndicDash.ag.roleSecretary')}</option><option>{t('syndicDash.ag.roleScrutineer')}</option></select></div>
              <div className="text-xs text-gray-500">{t('syndicDash.ag.timestamp')} : {new Date().toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowSignature(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-[#F7F4EE]">{t('syndicDash.ag.cancel')}</button>
              <button onClick={handleSignerPV} className="flex-1 py-2.5 bg-[#0D1B2E] text-white rounded-xl font-semibold hover:bg-[#152338]">✍️ {t('syndicDash.ag.signPVBtn')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
