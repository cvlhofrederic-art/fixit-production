'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'

export default function ImpayésSection({ user, userRole, getToken, coproprios }: { user: any; userRole: string; getToken?: () => Promise<string | null>; coproprios?: any[] }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const uid = user?.id || 'demo'

  type AppelFonds = { id: string; immeuble: string; periode: string; montantTotalBudget: number; dateEmission: string; dateEcheance: string; lots: { lot: string; copropriétaire: string; tantiemes: number; montant: number }[] }
  type Impayé = { id: string; copropriétaire: string; lot: string; immeuble: string; montant: number; dateEchéance: string; dateRelance1?: string; dateRelance2?: string; dateRelance3?: string; statut: 'impayé' | 'relance_1' | 'relance_2' | 'contentieux' | 'soldé'; notes: string; emailSent?: boolean }

  const [activeTab, setActiveTab] = useState<'impayés' | 'appels'>('impayés')
  const [impayés, setImpayés] = useState<Impayé[]>(() => { try { return JSON.parse(localStorage.getItem(`fixit_impayés_${uid}`) || '[]') } catch { return [] } })
  const [appels, setAppels] = useState<AppelFonds[]>(() => { try { return JSON.parse(localStorage.getItem(`fixit_appels_${uid}`) || '[]') } catch { return [] } })
  const [showModal, setShowModal] = useState(false)
  const [showAppelModal, setShowAppelModal] = useState(false)
  const [filter, setFilter] = useState<'tous' | 'impayé' | 'relance_1' | 'relance_2' | 'contentieux' | 'soldé'>('tous')
  const [form, setForm] = useState({ copropriétaire: '', lot: '', immeuble: '', montant: '', dateEchéance: '', notes: '' })
  const [appelForm, setAppelForm] = useState({ immeuble: '', periode: '', montantTotalBudget: '', dateEmission: new Date().toISOString().split('T')[0], dateEcheance: '', lotsText: '' })
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)
  const [emailSending, setEmailSending] = useState<string | null>(null)

  const saveImpayés = (u: Impayé[]) => { setImpayés(u); localStorage.setItem(`fixit_impayés_${uid}`, JSON.stringify(u)) }
  const saveAppels = (u: AppelFonds[]) => { setAppels(u); localStorage.setItem(`fixit_appels_${uid}`, JSON.stringify(u)) }

  const handleAdd = () => {
    if (!form.copropriétaire.trim() || !form.montant) return
    const i: Impayé = { id: Date.now().toString(), copropriétaire: form.copropriétaire, lot: form.lot, immeuble: form.immeuble, montant: parseFloat(form.montant), dateEchéance: form.dateEchéance, statut: 'impayé', notes: form.notes }
    saveImpayés([i, ...impayés])
    setShowModal(false)
    setForm({ copropriétaire: '', lot: '', immeuble: '', montant: '', dateEchéance: '', notes: '' })
  }

  const handleRelance = (id: string) => {
    const i = impayés.find(imp => imp.id === id)
    if (!i) return
    const now = new Date().toISOString().split('T')[0]
    let update: Partial<Impayé> = {}
    if (i.statut === 'impayé') update = { statut: 'relance_1', dateRelance1: now }
    else if (i.statut === 'relance_1') update = { statut: 'relance_2', dateRelance2: now }
    else if (i.statut === 'relance_2') update = { statut: 'contentieux', dateRelance3: now }
    saveImpayés(impayés.map(imp => imp.id === id ? { ...imp, ...update } : imp))
  }

  const handleSolder = (id: string) => { saveImpayés(impayés.map(imp => imp.id === id ? { ...imp, statut: 'soldé' } : imp)) }

  // ── Envoyer un email de relance au copropriétaire ──────────────────
  const handleSendRelanceEmail = useCallback(async (imp: Impayé) => {
    if (!getToken) { alert(locale === 'pt' ? 'Token indisponível' : 'Token non disponible'); return }

    // Chercher l'email du copropriétaire dans la liste
    const copro = coproprios?.find(c =>
      `${c.prenomProprietaire || ''} ${c.nomProprietaire || ''}`.trim().toLowerCase() === imp.copropriétaire.toLowerCase()
      || `${c.nomProprietaire || ''} ${c.prenomProprietaire || ''}`.trim().toLowerCase() === imp.copropriétaire.toLowerCase()
    )
    const email = copro?.emailProprietaire
    if (!email) {
      alert(locale === 'pt'
        ? `Email não encontrado para ${imp.copropriétaire}. Verifique a ficha do copropietário.`
        : `Email introuvable pour ${imp.copropriétaire}. Vérifiez la fiche copropriétaire.`)
      return
    }

    setEmailSending(imp.id)
    try {
      const token = await getToken()
      if (!token) throw new Error('Token error')

      const res = await fetch('/api/syndic/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          template: 'unpaid_reminder',
          recipients: { email, name: imp.copropriétaire },
          params: {
            amount: imp.montant,
            dueDate: imp.dateEchéance ? new Date(imp.dateEchéance).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR') : '',
            buildingName: imp.immeuble || '',
            unit: imp.lot || '',
          },
          locale,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        alert(locale === 'pt'
          ? `✅ Email de lembrete enviado para ${email}`
          : `✅ Email de relance envoyé à ${email}`)
        // Marquer l'impayé comme ayant reçu un email
        saveImpayés(impayés.map(i => i.id === imp.id ? { ...i, emailSent: true } : i))
      } else {
        alert(locale === 'pt'
          ? `❌ Erro ao enviar: ${data.error || 'Erro desconhecido'}`
          : `❌ Erreur d'envoi : ${data.error || 'Erreur inconnue'}`)
      }
    } catch (err: any) {
      console.error('[IMPAYES] Email send error:', err)
      alert(locale === 'pt' ? '❌ Erro ao enviar o email' : '❌ Erreur lors de l\'envoi de l\'email')
    } finally {
      setEmailSending(null)
    }
  }, [getToken, coproprios, locale, impayés, saveImpayés])

  const handleCreateAppel = () => {
    if (!appelForm.immeuble.trim() || !appelForm.periode.trim()) return
    const lots = appelForm.lotsText.split('\n').filter(l => l.trim()).map(line => {
      const parts = line.split(';').map(p => p.trim())
      return { lot: parts[0] || '', copropriétaire: parts[1] || '', tantiemes: parseInt(parts[2]) || 0, montant: parseFloat(parts[3]) || 0 }
    })
    const af: AppelFonds = { id: Date.now().toString(), immeuble: appelForm.immeuble, periode: appelForm.periode, montantTotalBudget: parseFloat(appelForm.montantTotalBudget) || 0, dateEmission: appelForm.dateEmission, dateEcheance: appelForm.dateEcheance, lots }
    saveAppels([af, ...appels])
    setShowAppelModal(false)
    setAppelForm({ immeuble: '', periode: '', montantTotalBudget: '', dateEmission: new Date().toISOString().split('T')[0], dateEcheance: '', lotsText: '' })
  }

  const exportAppelPdf = async (af: AppelFonds) => {
    setPdfLoading(`appel_${af.id}`)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = 210; const margin = 20; const textWidth = W - 2 * margin
      let y = 20

      const addText = (text: string, size = 10, bold = false, color: [number,number,number] = [0,0,0], align: 'left' | 'center' | 'right' = 'left') => {
        doc.setFontSize(size); doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setTextColor(...color)
        if (align !== 'left') { doc.text(text, align === 'center' ? W/2 : W - margin, y, { align }); y += size * 0.45 + 2 }
        else { const lines = doc.splitTextToSize(text, textWidth); lines.forEach((l: string) => { if (y > 270) { doc.addPage(); y = 20 }; doc.text(l, margin, y); y += size * 0.45 }); y += 2 }
      }

      // En-tête bleu
      doc.setFillColor(37, 99, 235); doc.rect(0, 0, W, 38, 'F')
      doc.setTextColor(255,255,255); doc.setFontSize(14); doc.setFont('helvetica','bold')
      doc.text('APPEL DE FONDS', W/2, 14, { align: 'center' })
      doc.setFontSize(10); doc.setFont('helvetica','normal')
      doc.text(`${af.immeuble}  ·  ${af.periode}`, W/2, 23, { align: 'center' })
      doc.text(`Émis le ${new Date(af.dateEmission).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}  ·  Échéance : ${af.dateEcheance ? new Date(af.dateEcheance).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR') : 'N/A'}`, W/2, 30, { align: 'center' })
      y = 48

      // Budget global
      doc.setFillColor(239,246,255); doc.rect(margin, y, textWidth, 14, 'F')
      y += 5
      addText(`Budget prévisionnel total : ${af.montantTotalBudget.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €`, 12, true, [37,99,235])
      y += 4

      // Tableau des lots
      addText('DÉTAIL PAR LOT', 11, true, [37,99,235])
      doc.setDrawColor(37,99,235); doc.line(margin, y, margin + textWidth, y); y += 4

      // En-têtes tableau
      doc.setFillColor(249,250,251); doc.rect(margin, y-2, textWidth, 8, 'F')
      doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(80,80,80)
      doc.text('LOT', margin+2, y+3)
      doc.text('COPROPRIÉTAIRE', margin+25, y+3)
      doc.text('TANTIÈMES', margin+100, y+3)
      doc.text('MONTANT APPELÉ', margin+130, y+3)
      y += 10

      const totalMontant = af.lots.reduce((s, l) => s + l.montant, 0)
      af.lots.forEach((lot, idx) => {
        if (y > 260) { doc.addPage(); y = 20 }
        if (idx % 2 === 0) { doc.setFillColor(248,250,252); doc.rect(margin, y-3, textWidth, 8, 'F') }
        doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(0,0,0)
        doc.text(lot.lot, margin+2, y+2)
        doc.text(lot.copropriétaire, margin+25, y+2)
        doc.text(lot.tantiemes.toString(), margin+105, y+2, { align: 'right' })
        doc.setFont('helvetica','bold'); doc.setTextColor(37,99,235)
        doc.text(`${lot.montant.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €`, W-margin-2, y+2, { align: 'right' })
        y += 8
      })

      y += 4
      doc.setFillColor(37,99,235); doc.rect(margin, y, textWidth, 10, 'F')
      doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255)
      doc.text('TOTAL APPELÉ', margin+5, y+7)
      doc.text(`${totalMontant.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €`, W-margin-5, y+7, { align: 'right' })
      y += 20

      // Modalités paiement
      doc.setFillColor(254,249,195); doc.rect(margin, y, textWidth, 24, 'F')
      y += 5
      addText('MODALITÉS DE PAIEMENT', 10, true, [146,64,14])
      addText(`Veuillez virer le montant correspondant à votre lot avant le ${af.dateEcheance ? new Date(af.dateEcheance).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR') : 'la date indiquée'}.`, 9, false, [80,80,80])
      addText('IBAN : FR76 XXXX XXXX XXXX XXXX XXXX XXX  ·  BIC : XXXXXXXX', 9, false, [80,80,80])
      addText('Référence : Appel de fonds ' + af.periode + ' — Lot N° [votre lot]', 9, false, [80,80,80])

      // Pied de page
      const pages = doc.getNumberOfPages()
      for (let p = 1; p <= pages; p++) {
        doc.setPage(p); doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(150,150,150)
        doc.text(`Vitfix Pro — Appel de fonds généré le ${new Date().toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}  |  Page ${p}/${pages}`, W/2, 290, { align: 'center' })
      }
      doc.save(`AppelFonds_${af.immeuble.replace(/\s+/g,'_')}_${af.periode.replace(/\s+/g,'_')}.pdf`)
    } catch(e) { alert(t('syndicDash.impayes.pdfError') + ' : ' + e) }
    setPdfLoading(null)
  }

  const exportRelatancePdf = async (i: Impayé) => {
    setPdfLoading(`relance_${i.id}`)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = 210; const margin = 20; const textWidth = W - 2 * margin
      let y = 20

      const relanceNum = i.statut === 'relance_1' ? 1 : i.statut === 'relance_2' ? 2 : i.statut === 'contentieux' ? 3 : 1
      const colors: Record<number, [number,number,number]> = { 1: [234,88,12], 2: [202,138,4], 3: [147,51,234] }
      const color = colors[relanceNum] || [234,88,12]
      const titles: Record<number, string> = { 1: 'PREMIER RAPPEL AMIABLE', 2: 'MISE EN DEMEURE', 3: 'MISE EN DEMEURE AVANT CONTENTIEUX' }

      // En-tête coloré selon niveau relance
      doc.setFillColor(...color); doc.rect(0, 0, W, 40, 'F')
      doc.setTextColor(255,255,255); doc.setFontSize(14); doc.setFont('helvetica','bold')
      doc.text(titles[relanceNum], W/2, 16, { align: 'center' })
      doc.setFontSize(10); doc.setFont('helvetica','normal')
      doc.text(`Charges de copropriété impayées — ${i.immeuble || 'Résidence'}`, W/2, 26, { align: 'center' })
      doc.text(`Lot ${i.lot || 'N/A'}  ·  ${new Date().toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}`, W/2, 34, { align: 'center' })
      y = 52

      // Destinataire
      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(0,0,0)
      doc.text(`À l'attention de : ${i.copropriétaire}`, margin, y); y += 8
      if (i.lot) { doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.text(`Lot n° ${i.lot}${i.immeuble ? ` — ${i.immeuble}` : ''}`, margin, y); y += 6 }
      y += 8

      // Corps lettre
      const bodies: Record<number, string> = {
        1: `Madame, Monsieur,

Nous vous informons qu'à ce jour, votre compte de charges de copropriété présente un solde débiteur. Nous vous prions de bien vouloir régulariser cette situation dans les meilleurs délais.

Après vérification de notre comptabilité, vous restez redevable de la somme de :`,
        2: `Madame, Monsieur,

Malgré notre premier rappel qui vous a été adressé le ${i.dateRelance1 ? new Date(i.dateRelance1).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR') : 'récemment'}, votre compte de charges de copropriété présente toujours un solde débiteur.

Par la présente, nous vous mettons en demeure de régler la somme de :`,
        3: `Madame, Monsieur,

Nous avons déjà eu l'occasion de vous contacter à deux reprises concernant votre dette de charges de copropriété, sans qu'aucune régularisation n'ait été effectuée à ce jour.

En l'absence de règlement dans un délai de 8 jours, nous serons dans l'obligation de transmettre ce dossier à notre conseil juridique pour engagement d'une procédure de recouvrement devant le Tribunal judiciaire. Vous en supporterez alors les frais.

Le montant restant dû s'élève à :`
      }

      doc.setFontSize(10); doc.setFont('helvetica','normal')
      const bodyLines = doc.splitTextToSize(bodies[relanceNum], textWidth)
      bodyLines.forEach((line: string) => { if (y > 255) { doc.addPage(); y = 20 }; doc.text(line, margin, y); y += 5 })
      y += 6

      // Montant encadré
      doc.setFillColor(254,242,242); doc.rect(margin, y, textWidth, 16, 'F')
      doc.setDrawColor(...color); doc.setLineWidth(0.5); doc.rect(margin, y, textWidth, 16)
      doc.setFontSize(18); doc.setFont('helvetica','bold'); doc.setTextColor(...color)
      doc.text(`${i.montant.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €`, W/2, y+11, { align: 'center' })
      y += 26

      // Suite lettre
      const endings: Record<number, string> = {
        1: `Nous restons à votre disposition pour tout renseignement complémentaire et espérons une régularisation rapide de votre situation.\n\nVeuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.`,
        2: `Nous vous demandons de bien vouloir procéder à ce règlement dans un délai de 15 jours à compter de la réception du présent courrier.\n\nEn l'absence de règlement, nous serons contraints d'engager une procédure de recouvrement amiable puis contentieuse.\n\nVeuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.`,
        3: `Nous vous accordons un ultime délai de 8 jours pour régulariser votre situation avant tout engagement de procédure judiciaire.\n\nVeuillez agréer, Madame, Monsieur, nos salutations distinguées.`
      }
      const endLines = doc.splitTextToSize(endings[relanceNum], textWidth)
      doc.setFontSize(10); doc.setFont('helvetica','normal'); doc.setTextColor(0,0,0)
      endLines.forEach((line: string) => { if (y > 255) { doc.addPage(); y = 20 }; doc.text(line, margin, y); y += 5 })
      y += 15

      // Signature syndic
      doc.text('Le Syndic de copropriété', margin, y); y += 5
      doc.text('_________________________________', margin, y); y += 4
      doc.setFontSize(8); doc.setTextColor(120,120,120)
      doc.text(`Généré par Vitfix Pro — ${new Date().toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}`, margin, y)

      doc.save(`Relance${relanceNum}_${i.copropriétaire.replace(/\s+/g,'_')}_${i.lot || 'lot'}.pdf`)
    } catch(e) { alert(t('syndicDash.impayes.pdfError') + ' : ' + e) }
    setPdfLoading(null)
  }

  const filtered = filter === 'tous' ? impayés : impayés.filter(i => i.statut === filter)
  const totalImpayé = impayés.filter(i => i.statut !== 'soldé').reduce((s, i) => s + i.montant, 0)
  const STATUS_COLORS: Record<string, string> = { impayé: 'bg-red-100 text-red-700', relance_1: 'bg-orange-100 text-orange-700', relance_2: 'bg-yellow-100 text-yellow-800', contentieux: 'bg-[#F7F4EE] text-[#C9A84C]', soldé: 'bg-green-100 text-green-700' }
  const STATUS_LABELS: Record<string, string> = { impayé: `⚠️ ${t('syndicDash.impayes.statusImpayes')}`, relance_1: `📨 ${t('syndicDash.impayes.statusRelance1')}`, relance_2: `📨 ${t('syndicDash.impayes.statusRelance2')}`, contentieux: `⚖️ ${t('syndicDash.impayes.statusContentieux')}`, soldé: `✅ ${t('syndicDash.impayes.statusSolde')}` }

  return (
    <div className="animate-fadeIn">
      <div className="bg-white px-6 lg:px-10 py-5 border-b-2 border-red-400 shadow-sm flex justify-between items-center">
        <div><h1 className="text-2xl font-semibold">⚠️ {t('syndicDash.impayes.title')}</h1><p className="text-sm text-gray-500">{t('syndicDash.impayes.subtitle')}</p></div>
        <div className="flex gap-2">
          {activeTab === 'impayés' && <button onClick={() => setShowModal(true)} className="bg-red-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-red-600 transition">{t('syndicDash.impayes.addImpayes')}</button>}
          {activeTab === 'appels' && <button onClick={() => setShowAppelModal(true)} className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition">{t('syndicDash.impayes.addAppel')}</button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b flex">
        <button onClick={() => setActiveTab('impayés')} className={`px-6 py-3 font-semibold text-sm border-b-2 transition ${activeTab === 'impayés' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500'}`}>⚠️ {t('syndicDash.impayes.tabImpayes')}</button>
        <button onClick={() => setActiveTab('appels')} className={`px-6 py-3 font-semibold text-sm border-b-2 transition ${activeTab === 'appels' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>📋 {t('syndicDash.impayes.tabAppels')}</button>
      </div>

      {activeTab === 'impayés' && (
        <div className="p-6 lg:p-8">
          <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-red-400 xl:col-span-2"><div className="text-sm text-gray-500">{t('syndicDash.impayes.totalImpayes')}</div><div className="text-3xl font-bold text-red-600">{totalImpayé.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</div></div>
            {(['impayé', 'relance_1', 'relance_2', 'contentieux'] as const).map(s => (
              <div key={s} className="bg-white p-4 rounded-2xl shadow-sm text-center"><div className="text-2xl font-bold">{impayés.filter(i => i.statut === s).length}</div><div className="text-xs text-gray-500 mt-1">{STATUS_LABELS[s]}</div></div>
            ))}
          </div>

          <div className="flex gap-2 mb-6 flex-wrap">
            {(['tous', 'impayé', 'relance_1', 'relance_2', 'contentieux', 'soldé'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-full text-sm font-semibold transition ${filter === f ? 'bg-red-500 text-white' : 'bg-white text-gray-600 hover:bg-[#F7F4EE]'}`}>{f === 'tous' ? t('syndicDash.impayes.all') : STATUS_LABELS[f]} ({f === 'tous' ? impayés.length : impayés.filter(i => i.statut === f).length})</button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center"><div className="text-5xl mb-4">✅</div><h3 className="text-xl font-bold mb-2">{filter === 'tous' ? t('syndicDash.impayes.noImpayes') : t('syndicDash.impayes.noResult')}</h3></div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-[#F7F4EE] text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">{t('syndicDash.impayes.colCopro')}</th>
                    <th className="px-4 py-3 text-left">{t('syndicDash.impayes.colLot')}</th>
                    <th className="px-4 py-3 text-right">{t('syndicDash.impayes.colAmount')}</th>
                    <th className="px-4 py-3 text-center">{t('syndicDash.impayes.colDeadline')}</th>
                    <th className="px-4 py-3 text-center">{t('syndicDash.impayes.colStatus')}</th>
                    <th className="px-4 py-3 text-center">{t('syndicDash.impayes.colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(i => (
                    <tr key={i.id} className="border-t hover:bg-[#F7F4EE]">
                      <td className="px-4 py-3 font-semibold">{i.copropriétaire}</td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{i.lot || '—'}{i.immeuble ? ` · ${i.immeuble}` : ''}</td>
                      <td className="px-4 py-3 text-right font-bold text-red-600">{i.montant.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-500">{i.dateEchéance ? new Date(i.dateEchéance).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR') : '—'}</td>
                      <td className="px-4 py-3 text-center"><span className={`px-2 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[i.statut]}`}>{STATUS_LABELS[i.statut]}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-center flex-wrap">
                          {i.statut !== 'soldé' && i.statut !== 'contentieux' && <button onClick={() => handleRelance(i.id)} className="text-xs bg-orange-100 text-orange-700 px-2 py-1.5 rounded-lg font-semibold hover:bg-orange-200 whitespace-nowrap">📨 {t('syndicDash.impayes.relancer')}</button>}
                          {i.statut !== 'soldé' && (
                            <button onClick={() => handleSendRelanceEmail(i)} disabled={emailSending === i.id} className="text-xs bg-blue-50 text-blue-600 px-2 py-1.5 rounded-lg font-semibold hover:bg-blue-100 whitespace-nowrap disabled:opacity-60">{emailSending === i.id ? '⏳' : `✉️ ${locale === 'pt' ? 'Email' : 'Email'}`}{i.emailSent ? ' ✓' : ''}</button>
                          )}
                          {(i.statut === 'relance_1' || i.statut === 'relance_2' || i.statut === 'contentieux') && (
                            <button onClick={() => exportRelatancePdf(i)} disabled={pdfLoading === `relance_${i.id}`} className="text-xs bg-[#F7F4EE] text-[#C9A84C] px-2 py-1.5 rounded-lg font-semibold hover:bg-[#F7F4EE] whitespace-nowrap disabled:opacity-60">{pdfLoading === `relance_${i.id}` ? '⏳' : `📄 ${t('syndicDash.impayes.lettrePdf')}`}</button>
                          )}
                          {i.statut !== 'soldé' && <button onClick={() => handleSolder(i.id)} className="text-xs bg-green-100 text-green-700 px-2 py-1.5 rounded-lg font-semibold hover:bg-green-200">✅ {t('syndicDash.impayes.solder')}</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'appels' && (
        <div className="p-6 lg:p-8">
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-blue-400"><div className="text-sm text-gray-500">{t('syndicDash.impayes.appelsFonds')}</div><div className="text-3xl font-bold text-blue-600">{appels.length}</div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-green-400"><div className="text-sm text-gray-500">{t('syndicDash.impayes.totalAppele')}</div><div className="text-2xl font-bold text-green-600">{appels.reduce((s, a) => s + a.montantTotalBudget, 0).toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-[#C9A84C]"><div className="text-sm text-gray-500">{t('syndicDash.impayes.lotsTotal')}</div><div className="text-3xl font-bold text-[#C9A84C]">{appels.reduce((s, a) => s + a.lots.length, 0)}</div></div>
          </div>
          {appels.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center"><div className="text-5xl mb-4">📋</div><h3 className="text-xl font-bold mb-2">{t('syndicDash.impayes.noAppels')}</h3><p className="text-gray-500 mb-6">{t('syndicDash.impayes.noAppelsDesc')}</p><button onClick={() => setShowAppelModal(true)} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700">+ {t('syndicDash.impayes.firstAppel')}</button></div>
          ) : (
            <div className="space-y-4">
              {appels.map(af => (
                <div key={af.id} className="bg-white rounded-2xl shadow-sm p-5">
                  <div className="flex justify-between items-start flex-wrap gap-3">
                    <div>
                      <h3 className="font-bold text-lg">{af.immeuble}</h3>
                      <div className="flex gap-4 text-sm text-gray-500 mt-1 flex-wrap">
                        <span>📅 {af.periode}</span>
                        <span>💰 {t('syndicDash.impayes.budget')} : {af.montantTotalBudget.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</span>
                        <span>🏠 {af.lots.length} {t('syndicDash.impayes.lots')}</span>
                        <span>📆 {t('syndicDash.impayes.emitDate')} {new Date(af.dateEmission).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</span>
                        {af.dateEcheance && <span>⚠️ {t('syndicDash.impayes.deadline')} : {new Date(af.dateEcheance).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</span>}
                      </div>
                    </div>
                    <button onClick={() => exportAppelPdf(af)} disabled={pdfLoading === `appel_${af.id}`} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap">{pdfLoading === `appel_${af.id}` ? `⏳ ${t('syndicDash.impayes.generating')}` : `📄 ${t('syndicDash.impayes.exportPdf')}`}</button>
                  </div>
                  {af.lots.length > 0 && (
                    <div className="mt-3 overflow-x-auto">
                      <table className="text-xs w-full">
                        <thead><tr className="text-gray-500 border-b"><th className="text-left py-1 pr-4">{t('syndicDash.impayes.lotCol')}</th><th className="text-left py-1 pr-4">{t('syndicDash.impayes.coproCol')}</th><th className="text-right py-1 pr-4">{t('syndicDash.impayes.tantiemesCol')}</th><th className="text-right py-1">{t('syndicDash.impayes.amountCalledCol')}</th></tr></thead>
                        <tbody>{af.lots.map((l, j) => <tr key={j} className="border-b border-gray-50"><td className="py-1 pr-4 font-medium">{l.lot}</td><td className="py-1 pr-4 text-gray-600">{l.copropriétaire}</td><td className="py-1 pr-4 text-right">{l.tantiemes}</td><td className="py-1 text-right font-semibold text-blue-600">{l.montant.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</td></tr>)}</tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">⚠️ {t('syndicDash.impayes.registerImpayes')}</h2></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.impayes.coproLabel')}</label><input value={form.copropriétaire} onChange={e => setForm({...form, copropriétaire: e.target.value})} placeholder={t('syndicDash.impayes.coproPlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-red-400 outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.impayes.lotLabel')}</label><input value={form.lot} onChange={e => setForm({...form, lot: e.target.value})} placeholder={t('syndicDash.impayes.lotPlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-red-400 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.impayes.amountLabel')}</label><input type="number" value={form.montant} onChange={e => setForm({...form, montant: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-red-400 outline-none" /></div>
              </div>
              <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.impayes.buildingLabel')}</label><input value={form.immeuble} onChange={e => setForm({...form, immeuble: e.target.value})} placeholder={t('syndicDash.impayes.buildingPlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-red-400 outline-none" /></div>
              <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.impayes.deadlineLabel')}</label><input type="date" value={form.dateEchéance} onChange={e => setForm({...form, dateEchéance: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-red-400 outline-none" /></div>
              <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.impayes.notesLabel')}</label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} placeholder={t('syndicDash.impayes.notesPlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-red-400 outline-none resize-none" /></div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-[#F7F4EE]">{t('syndicDash.impayes.cancel')}</button>
              <button onClick={handleAdd} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600">{t('syndicDash.impayes.save')}</button>
            </div>
          </div>
        </div>
      )}

      {showAppelModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">📋 {t('syndicDash.impayes.newAppel')}</h2></div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.impayes.appelBuilding')}</label><input value={appelForm.immeuble} onChange={e => setAppelForm({...appelForm, immeuble: e.target.value})} placeholder={t('syndicDash.impayes.appelBuildingPlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.impayes.appelPeriod')}</label><input value={appelForm.periode} onChange={e => setAppelForm({...appelForm, periode: e.target.value})} placeholder={t('syndicDash.impayes.appelPeriodPlaceholder')} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" /></div>
              </div>
              <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.impayes.appelBudget')}</label><input type="number" value={appelForm.montantTotalBudget} onChange={e => setAppelForm({...appelForm, montantTotalBudget: e.target.value})} placeholder="50000" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.impayes.appelEmitDate')}</label><input type="date" value={appelForm.dateEmission} onChange={e => setAppelForm({...appelForm, dateEmission: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">{t('syndicDash.impayes.appelDeadline')}</label><input type="date" value={appelForm.dateEcheance} onChange={e => setAppelForm({...appelForm, dateEcheance: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none" /></div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">{t('syndicDash.impayes.appelLots')}</label>
                <textarea value={appelForm.lotsText} onChange={e => setAppelForm({...appelForm, lotsText: e.target.value})} rows={6} placeholder={"A101;Dupont Jean;450;1125.00\nB203;Martin Sophie;380;950.00\nC305;Garcia Pedro;170;425.00"} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none resize-none font-mono text-sm" />
                <p className="text-xs text-gray-500 mt-1">{t('syndicDash.impayes.appelLotsFormat')}</p>
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowAppelModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-[#F7F4EE]">{t('syndicDash.impayes.cancel')}</button>
              <button onClick={handleCreateAppel} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700">{t('syndicDash.impayes.createAppel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
