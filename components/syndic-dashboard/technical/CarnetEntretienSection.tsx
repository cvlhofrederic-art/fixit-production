'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import type { User } from '@supabase/supabase-js'

export default function CarnetEntretienSection({ user, userRole }: { user: User; userRole: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const isPt = locale === 'pt'
  const uid = user?.id || 'demo'

  type Intervention = { id: string; date: string; nature: string; immeuble: string; localisation: string; prestataire: string; cout: number; garantie: string; statut: 'réalisé' | 'planifié' | 'en_cours'; notes: string; dpe?: string }
  type EtatDate = { id: string; immeuble: string; adresse: string; dateVente: string; acquereur: string; vendeur: string; notaire: string; syndicNom: string; syndicAdresse: string; dateGeneration: string; chargesExercice: number; chargesRestant: number; travoteVotee: number; travauxRestant: number; fondsTravaux: number; impayesCopro: number; proceduresEnCours: string; diagnosticsDPE: string; reglement: string; notes: string }
  type Equipement = { id: string; type: string; marque: string; modele: string; numeroSerie: string; immeuble: string; localisation: string; dateInstallation: string; garantieExpiration: string; derniereMaintenance: string; prochaineMaintenance: string; etat: 'bon' | 'surveiller' | 'defaillant'; prestataire: string; notes: string }
  type Contrat = { id: string; type: string; prestataire: string; contact: string; immeuble: string; numero: string; dateDebut: string; dateFin: string; montantHT: number; reconduction: boolean; statut: 'actif' | 'renouvellement' | 'resilie'; notes: string }

  const [activeTab, setActiveTab] = useState<'carnet' | 'etat_date' | 'dpe' | 'equipements' | 'contrats'>('carnet')
  const [interventions, setInterventions] = useState<Intervention[]>(() => { try { return JSON.parse(localStorage.getItem(`fixit_carnet_${uid}`) || '[]') } catch { return [] } })
  const [etats, setEtats] = useState<EtatDate[]>(() => { try { return JSON.parse(localStorage.getItem(`fixit_etat_date_${uid}`) || '[]') } catch { return [] } })
  const [showModal, setShowModal] = useState(false)
  const [showEtatModal, setShowEtatModal] = useState(false)
  const [showEquipModal, setShowEquipModal] = useState(false)
  const [showContratModal, setShowContratModal] = useState(false)
  const [filterImmeuble, setFilterImmeuble] = useState('')
  const [filterDpe, setFilterDpe] = useState<string>('')
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], nature: '', immeuble: '', localisation: '', prestataire: '', cout: '', garantie: '', statut: 'réalisé', notes: '', dpe: '' })
  const [etatForm, setEtatForm] = useState({ immeuble: '', adresse: '', dateVente: '', acquereur: '', vendeur: '', notaire: '', syndicNom: '', syndicAdresse: '', chargesExercice: '', chargesRestant: '', travoteVotee: '', travauxRestant: '', fondsTravaux: '', impayesCopro: '', proceduresEnCours: '', diagnosticsDPE: '', reglement: '', notes: '' })
  const [equipements, setEquipements] = useState<Equipement[]>(() => { try { return JSON.parse(localStorage.getItem(`fixit_equipements_${uid}`) || '[]') } catch { return [] } })
  const [contrats, setContrats] = useState<Contrat[]>(() => { try { return JSON.parse(localStorage.getItem(`fixit_contrats_${uid}`) || '[]') } catch { return [] } })
  const defaultEquipForm = { type: '', marque: '', modele: '', numeroSerie: '', immeuble: '', localisation: '', dateInstallation: '', garantieExpiration: '', derniereMaintenance: '', prochaineMaintenance: '', etat: 'bon' as const, prestataire: '', notes: '' }
  const defaultContratForm = { type: '', prestataire: '', contact: '', immeuble: '', numero: '', dateDebut: '', dateFin: '', montantHT: '', reconduction: false, statut: 'actif' as const, notes: '' }
  const [equipForm, setEquipForm] = useState<typeof defaultEquipForm>(defaultEquipForm)
  const [contratForm, setContratForm] = useState<any>(defaultContratForm)

  const saveEquipements = (u: Equipement[]) => { setEquipements(u); localStorage.setItem(`fixit_equipements_${uid}`, JSON.stringify(u)) }
  const saveContrats = (u: Contrat[]) => { setContrats(u); localStorage.setItem(`fixit_contrats_${uid}`, JSON.stringify(u)) }

  const EQUIP_TYPES = isPt ? ['Elevador', 'Caldeira coletiva', 'VMC / Ventilação', 'Portão / Porta garagem', 'Intercomunicador / Código', 'Gerador elétrico', 'Bomba de elevação', 'Sistema incêndio / Extintores', 'Climatização coletiva', 'Iluminação comum (relógio)', 'Estação de elevação águas residuais', 'Cobertura terraço / Impermeabilização', 'Outro'] : ['Ascenseur', 'Chaudière collective', 'VMC / Ventilation', 'Portail / Porte garage', 'Interphone / Digicode', 'Groupe électrogène', 'Pompe de relevage', 'Système incendie / Extincteurs', 'Climatisation collective', 'Éclairage communs (horloge)', 'Station de relevage eaux usées', 'Toiture terrasse / Étanchéité', 'Autre']
  const CONTRAT_TYPES = isPt ? ['Manutenção elevador', 'Manutenção caldeira / aquecimento', 'Limpeza partes comuns', 'Manutenção sistema incêndio', 'Manutenção espaços verdes', 'Manutenção VMC', 'Manutenção portão / intercomunicador', 'Remoção de neve', 'Desinfestação / desratização', 'Manutenção piscina', 'Seguro edifício', 'Outro'] : ['Entretien ascenseur', 'Entretien chaudière / chauffage', 'Nettoyage parties communes', 'Maintenance système incendie', 'Entretien espaces verts', 'Entretien VMC', 'Maintenance portail / interphone', 'Déneigement', 'Désinsectisation / dératisation', 'Maintenance piscine', 'Assurance immeuble', 'Autre']
  const ETAT_COLORS: Record<string, string> = { bon: 'bg-green-100 text-green-700', surveiller: 'bg-orange-100 text-orange-700', defaillant: 'bg-red-100 text-red-700' }
  const STATUT_CONTRAT_COLORS: Record<string, string> = { actif: 'bg-green-100 text-green-700', renouvellement: 'bg-[#F7F4EE] text-[#0D1B2E] border border-[#E4DDD0]', resilie: 'bg-gray-100 text-gray-500' }

  const handleAddEquip = () => {
    if (!equipForm.type || !equipForm.immeuble) return
    saveEquipements([{ ...equipForm, id: Date.now().toString() }, ...equipements])
    setShowEquipModal(false); setEquipForm(defaultEquipForm)
  }
  const handleAddContrat = () => {
    if (!contratForm.type || !contratForm.prestataire) return
    saveContrats([{ ...contratForm, id: Date.now().toString(), montantHT: parseFloat(contratForm.montantHT) || 0 }, ...contrats])
    setShowContratModal(false); setContratForm(defaultContratForm)
  }
  const joursAvantEcheance = (dateFin: string) => {
    if (!dateFin) return null
    return Math.ceil((new Date(dateFin).getTime() - Date.now()) / 86400000)
  }

  const saveInterventions = (u: Intervention[]) => { setInterventions(u); localStorage.setItem(`fixit_carnet_${uid}`, JSON.stringify(u)) }
  const saveEtats = (u: EtatDate[]) => { setEtats(u); localStorage.setItem(`fixit_etat_date_${uid}`, JSON.stringify(u)) }

  const handleAdd = () => {
    if (!form.nature.trim()) return
    const i: Intervention = { id: Date.now().toString(), date: form.date, nature: form.nature, immeuble: form.immeuble, localisation: form.localisation, prestataire: form.prestataire, cout: parseFloat(form.cout) || 0, garantie: form.garantie, statut: form.statut as any, notes: form.notes, dpe: form.dpe }
    saveInterventions([i, ...interventions])
    setShowModal(false)
    setForm({ date: new Date().toISOString().split('T')[0], nature: '', immeuble: '', localisation: '', prestataire: '', cout: '', garantie: '', statut: 'réalisé', notes: '', dpe: '' })
  }

  const handleCreateEtat = () => {
    if (!etatForm.immeuble.trim()) return
    const e: EtatDate = { id: Date.now().toString(), ...etatForm, chargesExercice: parseFloat(etatForm.chargesExercice) || 0, chargesRestant: parseFloat(etatForm.chargesRestant) || 0, travoteVotee: parseFloat(etatForm.travoteVotee) || 0, travauxRestant: parseFloat(etatForm.travauxRestant) || 0, fondsTravaux: parseFloat(etatForm.fondsTravaux) || 0, impayesCopro: parseFloat(etatForm.impayesCopro) || 0, dateGeneration: new Date().toISOString() }
    saveEtats([e, ...etats])
    setShowEtatModal(false)
    setEtatForm({ immeuble: '', adresse: '', dateVente: '', acquereur: '', vendeur: '', notaire: '', syndicNom: '', syndicAdresse: '', chargesExercice: '', chargesRestant: '', travoteVotee: '', travauxRestant: '', fondsTravaux: '', impayesCopro: '', proceduresEnCours: '', diagnosticsDPE: '', reglement: '', notes: '' })
  }

  const exportEtatDatePdf = async (e: EtatDate) => {
    setPdfLoading(`etat_${e.id}`)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = 210; const margin = 18; const textWidth = W - 2 * margin
      let y = 18

      const line = (txt: string, size = 9, bold = false, clr: [number,number,number] = [0,0,0], xa = margin) => {
        doc.setFontSize(size); doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setTextColor(...clr)
        const ls = doc.splitTextToSize(txt, textWidth - (xa - margin))
        ls.forEach((l: string) => { if (y > 272) { doc.addPage(); y = 18 }; doc.text(l, xa, y); y += size * 0.43 }); y += 1.5
      }
      const sectionTitle = (title: string) => {
        y += 3; doc.setFillColor(37,99,235); doc.rect(margin, y-4, textWidth, 8, 'F')
        doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255)
        doc.text(title, margin+4, y+0.5); y += 8
      }
      const row = (label: string, val: string, highlight = false) => {
        if (highlight) { doc.setFillColor(254,249,195); doc.rect(margin, y-3, textWidth, 7, 'F') }
        doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(80,80,80); doc.text(label, margin+3, y+0.5)
        doc.setFont('helvetica','normal'); doc.setTextColor(0,0,0)
        const vlines = doc.splitTextToSize(val || '—', textWidth - 72)
        vlines.forEach((vl: string, vi: number) => { doc.text(vl, margin + 72, y + vi * 4.5) })
        y += Math.max(6, vlines.length * 4.5); doc.setDrawColor(230,230,230); doc.line(margin, y-1, margin+textWidth, y-1)
      }

      // En-tête officiel
      doc.setFillColor(15, 23, 42); doc.rect(0, 0, W, 45, 'F')
      doc.setTextColor(255,255,255); doc.setFontSize(15); doc.setFont('helvetica','bold')
      doc.text(isPt ? 'ESTADO DATADO' : 'ÉTAT DATÉ', W/2, 13, { align: 'center' })
      doc.setFontSize(9); doc.setFont('helvetica','normal')
      doc.text(isPt ? 'Artigo 1424.º do Código Civil — Transmissão de fração autónoma' : 'Article 5 du Décret n°67-223 du 17 mars 1967 — Loi n°65-557 du 10 juillet 1965', W/2, 21, { align: 'center' })
      doc.setFontSize(11); doc.setFont('helvetica','bold')
      doc.text(e.immeuble, W/2, 31, { align: 'center' })
      if (e.adresse) { doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.text(e.adresse, W/2, 38, { align: 'center' }) }
      y = 52

      // Infos mutation
      sectionTitle(isPt ? 'I. IDENTIFICAÇÃO DA TRANSMISSÃO' : 'I. IDENTIFICATION DE LA MUTATION')
      row(isPt ? 'Data de venda prevista' : 'Date de vente prévue', e.dateVente ? new Date(e.dateVente).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR') : '—')
      row(isPt ? 'Adquirente' : 'Acquéreur', e.acquereur)
      row(isPt ? 'Vendedor / Cedente' : 'Vendeur / Cédant', e.vendeur)
      row(isPt ? 'Notário responsável' : 'Notaire chargé de l\'acte', e.notaire)

      sectionTitle(isPt ? 'II. IDENTIFICAÇÃO DO ADMINISTRADOR' : 'II. IDENTIFICATION DU SYNDIC')
      row(isPt ? 'Gabinete administrador' : 'Cabinet syndic', e.syndicNom)
      row(isPt ? 'Morada do administrador' : 'Adresse du syndic', e.syndicAdresse)
      row(isPt ? 'Data de emissão' : 'Date d\'établissement', new Date(e.dateGeneration).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR'))

      sectionTitle(isPt ? 'III. ENCARGOS E PROVISÕES' : 'III. CHARGES ET PROVISIONS')
      row(isPt ? 'Encargos orçamento exercício em curso' : 'Charges budget exercice en cours', e.chargesExercice > 0 ? `${e.chargesExercice.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €` : '—', e.chargesExercice > 0)
      row(isPt ? 'Encargos pendentes (quota-parte fração)' : 'Charges restant à solder (quote-part lot)', e.chargesRestant > 0 ? `${e.chargesRestant.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €` : '—', e.chargesRestant > 0)
      row(isPt ? 'Obras votadas não cobradas' : 'Travaux votés non encore appelés', e.travoteVotee > 0 ? `${e.travoteVotee.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €` : '0 €')
      row(isPt ? 'Obras restantes (quota-parte)' : 'Travaux restant à effectuer (quote-part)', e.travauxRestant > 0 ? `${e.travauxRestant.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €` : '—', e.travauxRestant > 0)

      sectionTitle(isPt ? 'IV. FUNDO DE OBRAS (Art. 1424.º CC)' : 'IV. FONDS DE TRAVAUX (Art. 14-2 Loi 1965)')
      row(isPt ? 'Fundo de obras — quota-parte fração' : 'Fonds de travaux — quote-part lot', e.fondsTravaux > 0 ? `${e.fondsTravaux.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €` : '—', e.fondsTravaux > 0)

      sectionTitle(isPt ? 'V. SITUAÇÃO DOS VALORES EM DÍVIDA' : 'V. SITUATION DES IMPAYÉS')
      row(isPt ? 'Valores em dívida do condomínio' : 'Impayés de charges de la copropriété', e.impayesCopro > 0 ? `${e.impayesCopro.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €` : (isPt ? 'Nenhum' : 'Néant'), e.impayesCopro > 0)
      row(isPt ? 'Processos em curso' : 'Procédures en cours', e.proceduresEnCours || (isPt ? 'Nenhum' : 'Aucune'))

      if (e.diagnosticsDPE) {
        sectionTitle(isPt ? 'VI. DIAGNÓSTICOS & CEE' : 'VI. DIAGNOSTICS & DPE')
        line(e.diagnosticsDPE, 9)
      }

      if (e.reglement || e.notes) {
        sectionTitle(isPt ? 'VII. INFORMAÇÕES COMPLEMENTARES' : 'VII. INFORMATIONS COMPLÉMENTAIRES')
        if (e.reglement) { line((isPt ? 'Regulamento do condomínio : ' : 'Règlement de copropriété : ') + e.reglement, 9) }
        if (e.notes) { line(e.notes, 9) }
      }

      // Certification
      y += 6
      doc.setFillColor(240,253,244); doc.rect(margin, y, textWidth, 24, 'F')
      doc.setDrawColor(22,101,52); doc.rect(margin, y, textWidth, 24)
      y += 6
      line(isPt ? 'CERTIFICAÇÃO DO ADMINISTRADOR' : 'CERTIFICATION DU SYNDIC', 10, true, [22,101,52])
      line(isPt ? `Eu, abaixo assinado(a), representando o gabinete de administração ${e.syndicNom || '[Gabinete]'}, certifico a exatidão das informações constantes no presente estado datado, elaborado em conformidade com os textos legais em vigor.` : `Je soussigné(e), représentant le cabinet syndic ${e.syndicNom || '[Cabinet]'}, certifie l'exactitude des informations figurant dans le présent état daté établi conformément aux textes légaux en vigueur.`, 9, false, [40,40,40])
      y += 4
      doc.setFontSize(9); doc.setTextColor(80,80,80)
      doc.text(isPt ? 'Data e assinatura :' : 'Date et signature :', margin+5, y)
      doc.text('_______________________________', margin+50, y)
      y += 10

      // Mentions légales
      doc.setFontSize(7); doc.setTextColor(150,150,150)
      const pages = doc.getNumberOfPages()
      for (let p = 1; p <= pages; p++) {
        doc.setPage(p)
        doc.text(isPt ? `Estado datado — ${e.immeuble}  |  Gerado por Vitfix Pro em ${new Date().toLocaleString('pt-PT')}  |  Página ${p}/${pages}` : `État daté — ${e.immeuble}  |  Généré par Vitfix Pro le ${new Date().toLocaleString('fr-FR')}  |  Page ${p}/${pages}`, W/2, 292, { align: 'center' })
      }
      doc.save(`EtatDate_${e.immeuble.replace(/\s+/g,'_')}_${new Date(e.dateGeneration).toISOString().split('T')[0]}.pdf`)
    } catch(err) { toast.error((isPt ? 'Erro PDF : ' : 'Erreur PDF : ') + err) }
    setPdfLoading(null)
  }

  const exportCarnetPdf = async () => {
    setPdfLoading('carnet')
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = 210; const margin = 18
      let y = 18

      doc.setFillColor(13,148,136); doc.rect(0,0,W,35,'F')
      doc.setTextColor(255,255,255); doc.setFontSize(14); doc.setFont('helvetica','bold')
      doc.text(isPt ? 'CADERNETA DE MANUTENÇÃO' : 'CARNET D\'ENTRETIEN', W/2, 14, { align: 'center' })
      doc.setFontSize(10); doc.setFont('helvetica','normal')
      doc.text(isPt ? `Gerado em ${new Date().toLocaleDateString('pt-PT')} — ${interventions.length} intervenção(ões)` : `Généré le ${new Date().toLocaleDateString('fr-FR')} — ${interventions.length} intervention(s)`, W/2, 24, { align: 'center' })
      y = 45

      const byYear: Record<string, Intervention[]> = {}
      interventions.forEach(i => { const yr = new Date(i.date).getFullYear().toString(); if (!byYear[yr]) byYear[yr] = []; byYear[yr].push(i) })
      const years = Object.keys(byYear).sort((a,b) => parseInt(b)-parseInt(a))

      years.forEach(yr => {
        if (y > 240) { doc.addPage(); y = 18 }
        doc.setFillColor(13,148,136); doc.rect(margin, y-3, W-2*margin, 9, 'F')
        doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255)
        doc.text(isPt ? `ANO ${yr}` : `ANNÉE ${yr}`, margin+4, y+3); y += 10

        byYear[yr].forEach((itv, idx) => {
          if (y > 265) { doc.addPage(); y = 18 }
          if (idx%2===0) { doc.setFillColor(248,250,252); doc.rect(margin, y-2, W-2*margin, 18, 'F') }
          doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(0,0,0)
          doc.text(new Date(itv.date).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day:'2-digit', month:'short' }), margin+2, y+4)
          doc.text(itv.nature, margin+25, y+4)
          const sc: Record<string, string> = isPt ? { réalisé: '✓ Realizado', planifié: '⋯ Planeado', en_cours: '→ Em curso' } : { réalisé: '✓ Réalisé', planifié: '⋯ Planifié', en_cours: '→ En cours' }
          doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(80,80,80)
          doc.text(sc[itv.statut] || itv.statut, W-margin-35, y+4)
          y += 6
          doc.setFontSize(8); doc.setTextColor(100,100,100)
          const details = [itv.immeuble && `🏢 ${itv.immeuble}`, itv.localisation && `📍 ${itv.localisation}`, itv.prestataire && `👷 ${itv.prestataire}`, itv.cout>0 && `💰 ${itv.cout.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €`, itv.garantie && `🛡️ ${itv.garantie}`].filter(Boolean).join('  ·  ')
          if (details) { const ls = doc.splitTextToSize(details, W-2*margin-10); ls.forEach((l: string) => { doc.text(l, margin+25, y); y += 4 }) }
          y += 4; doc.setDrawColor(220,220,220); doc.line(margin, y, W-margin, y); y += 3
        })
        y += 4
      })

      const pages = doc.getNumberOfPages()
      for (let p=1; p<=pages; p++) { doc.setPage(p); doc.setFontSize(7); doc.setTextColor(150,150,150); doc.text(isPt ? `Vitfix Pro — Caderneta de manutenção — Página ${p}/${pages}` : `Vitfix Pro — Carnet d'entretien — Page ${p}/${pages}`, W/2, 292, { align: 'center' }) }
      doc.save(`CarnetEntretien_${new Date().toISOString().split('T')[0]}.pdf`)
    } catch(err) { toast.error((isPt ? 'Erro PDF : ' : 'Erreur PDF : ') + err) }
    setPdfLoading(null)
  }

  const immeubles = [...new Set(interventions.map(i => i.immeuble).filter(Boolean))]
  const filtered = filterImmeuble ? interventions.filter(i => i.immeuble === filterImmeuble) : interventions
  const totalCouts = filtered.reduce((s, i) => s + i.cout, 0)
  const STATUS_COLORS: Record<string, string> = { réalisé: 'bg-green-100 text-green-700', planifié: 'bg-[#F7F4EE] text-[#0D1B2E] border border-[#E4DDD0]', en_cours: 'bg-orange-100 text-orange-700' }
  const DPE_COLORS: Record<string, string> = { A: 'bg-green-700 text-white', B: 'bg-green-500 text-white', C: 'bg-lime-400 text-[#0D1B2E]', D: 'bg-yellow-400 text-[#0D1B2E]', E: 'bg-orange-400 text-white', F: 'bg-[#C9A84C] text-white', G: 'bg-red-600 text-white' }
  const NATURES = isPt ? ['Manutenção elevador', 'Reabilitação fachada', 'Cobertura / impermeabilização', 'Canalização coletiva', 'Eletricidade comum', 'Espaços verdes', 'Limpeza partes comuns', 'Aquecimento / caldeira', 'Estacionamento', 'Código / Intercomunicador', 'Pintura partes comuns', 'Carpintaria', 'Desinfeção / desratização', 'Inspeção técnica', 'Diagnóstico CEE coletivo', 'Outro'] : ['Entretien ascenseur', 'Ravalement façade', 'Toiture / étanchéité', 'Plomberie collective', 'Électricité commune', 'Espaces verts', 'Nettoyage parties communes', 'Chaufferie / chaudière', 'Parking', 'Digicode / Interphone', 'Peinture parties communes', 'Menuiserie', 'Désinfection / dératisation', 'Contrôle technique', 'Diagnostic DPE collectif', 'Autre']

  return (
    <div className="animate-fadeIn">
      <div className="bg-white px-6 lg:px-10 py-5 border-b-2 border-teal-500 shadow-sm flex justify-between items-center">
        <div><h1 className="text-2xl font-semibold">{isPt ? '📖 Caderneta de Manutenção & Técnica' : "📖 Carnet d'Entretien & Technique"}</h1><p className="text-sm text-gray-500">{isPt ? 'Obras · Equipamentos · Contratos manutenção · Estado datado · CEE' : 'Travaux · Équipements · Contrats maintenance · État daté · DPE'}</p></div>
        <div className="flex gap-2">
          {activeTab === 'carnet' && <><button onClick={exportCarnetPdf} disabled={pdfLoading === 'carnet' || interventions.length === 0} className="bg-gray-600 text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-gray-700 disabled:opacity-60">{pdfLoading === 'carnet' ? '⏳' : '📄 Export PDF'}</button><button onClick={() => setShowModal(true)} className="bg-teal-600 text-white px-4 py-2 rounded-xl font-semibold text-sm hover:bg-teal-700">{isPt ? '+ Intervenção' : '+ Intervention'}</button></>}
          {activeTab === 'etat_date' && <button onClick={() => setShowEtatModal(true)} className="bg-[#0D1B2E] text-white px-4 py-2 rounded-xl font-semibold text-sm hover:bg-[#152338]">{isPt ? '+ Novo estado datado' : '+ Nouvel état daté'}</button>}
          {activeTab === 'equipements' && <button onClick={() => setShowEquipModal(true)} className="bg-teal-600 text-white px-4 py-2 rounded-xl font-semibold text-sm hover:bg-teal-700">{isPt ? '+ Equipamento' : '+ Équipement'}</button>}
          {activeTab === 'contrats' && <button onClick={() => setShowContratModal(true)} className="bg-teal-600 text-white px-4 py-2 rounded-xl font-semibold text-sm hover:bg-teal-700">{isPt ? '+ Contrato' : '+ Contrat'}</button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b flex overflow-x-auto">
        <button onClick={() => setActiveTab('carnet')} className={`px-5 py-3 font-semibold text-sm border-b-2 whitespace-nowrap transition ${activeTab === 'carnet' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500'}`}>{isPt ? '📖 Caderneta de manutenção' : "📖 Carnet d'entretien"}</button>
        <button onClick={() => setActiveTab('equipements')} className={`px-5 py-3 font-semibold text-sm border-b-2 whitespace-nowrap transition ${activeTab === 'equipements' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500'}`}>{isPt ? '⚙️ Equipamentos' : '⚙️ Équipements'} {equipements.length > 0 && <span className="ml-1 bg-teal-100 text-teal-700 text-xs px-1.5 rounded-full">{equipements.length}</span>}</button>
        <button onClick={() => setActiveTab('contrats')} className={`px-5 py-3 font-semibold text-sm border-b-2 whitespace-nowrap transition ${activeTab === 'contrats' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500'}`}>{isPt ? '📄 Contratos' : '📄 Contrats'} {contrats.filter(c=>c.statut==='actif').length > 0 && <span className="ml-1 bg-teal-100 text-teal-700 text-xs px-1.5 rounded-full">{contrats.filter(c=>c.statut==='actif').length}</span>}</button>
        <button onClick={() => setActiveTab('etat_date')} className={`px-5 py-3 font-semibold text-sm border-b-2 whitespace-nowrap transition ${activeTab === 'etat_date' ? 'border-[#C9A84C] text-[#C9A84C]' : 'border-transparent text-gray-500'}`}>{isPt ? '📋 Estado Datado' : '📋 État Daté'}</button>
        <button onClick={() => setActiveTab('dpe')} className={`px-5 py-3 font-semibold text-sm border-b-2 whitespace-nowrap transition ${activeTab === 'dpe' ? 'border-[#C9A84C] text-[#C9A84C]' : 'border-transparent text-gray-500'}`}>{isPt ? '🏷️ CEE Coletivo' : '🏷️ DPE Collectif'}</button>
      </div>

      {/* ── CARNET ── */}
      {activeTab === 'carnet' && (
        <div className="p-6 lg:p-8">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-teal-400"><div className="text-sm text-gray-500">{isPt ? 'Intervenções' : 'Interventions'}</div><div className="text-3xl font-bold text-teal-600">{filtered.length}</div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-[#C9A84C]"><div className="text-sm text-gray-500">{isPt ? 'Planeadas' : 'Planifiées'}</div><div className="text-3xl font-bold text-[#0D1B2E]">{filtered.filter(i => i.statut === 'planifié').length}</div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-green-400"><div className="text-sm text-gray-500">{isPt ? 'Custo total' : 'Coût total'}</div><div className="text-2xl font-bold text-green-600">{totalCouts.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-[#C9A84C]"><div className="text-sm text-gray-500">{isPt ? 'Edifícios' : 'Immeubles'}</div><div className="text-3xl font-bold text-[#C9A84C]">{immeubles.length}</div></div>
          </div>

          {immeubles.length > 1 && (
            <div className="flex gap-2 mb-6 flex-wrap">
              <button onClick={() => setFilterImmeuble('')} className={`px-4 py-2 rounded-full text-sm font-semibold transition ${!filterImmeuble ? 'bg-teal-600 text-white' : 'bg-white text-gray-600'}`}>{isPt ? 'Todos' : 'Tous'} ({interventions.length})</button>
              {immeubles.map(im => <button key={im} onClick={() => setFilterImmeuble(im)} className={`px-4 py-2 rounded-full text-sm font-semibold transition ${filterImmeuble === im ? 'bg-teal-600 text-white' : 'bg-white text-gray-600'}`}>{im}</button>)}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center"><div className="text-5xl mb-4">📖</div><h3 className="text-xl font-bold mb-2">{isPt ? 'Caderneta vazia' : 'Carnet vide'}</h3><p className="text-gray-500 mb-6">{isPt ? 'Registe todas as intervenções para rastreabilidade completa' : 'Enregistrez toutes les interventions pour traçabilité complète'}</p><button onClick={() => setShowModal(true)} className="bg-teal-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-teal-700">{isPt ? '+ Primeira intervenção' : '+ Première intervention'}</button></div>
          ) : (
            <div className="space-y-3">
              {filtered.map(i => (
                <div key={i.id} className="bg-white rounded-2xl shadow-sm p-5 flex flex-col md:flex-row gap-4">
                  <div className="w-20 text-center flex-shrink-0 bg-[#F7F4EE] rounded-xl py-3">
                    <div className="text-xs text-gray-500">{new Date(i.date).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: '2-digit', month: 'short' })}</div>
                    <div className="text-lg font-bold text-gray-700">{new Date(i.date).getFullYear()}</div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap"><h3 className="font-bold">{i.nature}</h3><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[i.statut]}`}>{i.statut === 'réalisé' ? (isPt ? 'realizado' : 'réalisé') : i.statut === 'planifié' ? (isPt ? 'planeado' : 'planifié') : (isPt ? 'em curso' : 'en_cours')}</span>{i.dpe && <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${DPE_COLORS[i.dpe] || 'bg-[#F7F4EE] text-gray-600'}`}>{isPt ? 'CEE' : 'DPE'} {i.dpe}</span>}</div>
                    <div className="flex gap-3 text-sm text-gray-500 flex-wrap">
                      {i.immeuble && <span>🏢 {i.immeuble}</span>}
                      {i.localisation && <span>📍 {i.localisation}</span>}
                      {i.prestataire && <span>👷 {i.prestataire}</span>}
                      {i.cout > 0 && <span className="font-semibold text-gray-700">💰 {i.cout.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</span>}
                      {i.garantie && <span>🛡️ {i.garantie}</span>}
                    </div>
                    {i.notes && <p className="text-xs text-gray-500 mt-1">{i.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ÉTAT DATÉ ── */}
      {activeTab === 'etat_date' && (
        <div className="p-6 lg:p-8">
          <div className="bg-[#F7F4EE] border border-[#E4DDD0] rounded-2xl p-4 mb-6">
            <p className="text-sm text-[#0D1B2E]">{locale === 'pt'
              ? <><strong>📋 Estado datado — Art.º 1424.º CC</strong> — Documento obrigatório aquando de qualquer transferência de fração. Gere um PDF conforme em poucos segundos.</>
              : <><strong>📋 État daté — Art. 5 Décret 67-223</strong> — Document obligatoire lors de toute mutation de lot de copropriété. Générez un PDF conforme en quelques secondes.</>}</p>
          </div>
          {etats.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center"><div className="text-5xl mb-4">📋</div><h3 className="text-xl font-bold mb-2">{locale === 'pt' ? 'Nenhum estado datado' : 'Aucun état daté'}</h3><p className="text-gray-500 mb-6">{locale === 'pt' ? 'Gere estados datados conformes à lei para cada transferência de fração' : 'Générez des états datés conformes à la loi pour chaque mutation de lot'}</p><button onClick={() => setShowEtatModal(true)} className="bg-[#0D1B2E] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#152338]">+ {locale === 'pt' ? 'Criar um estado datado' : 'Créer un état daté'}</button></div>
          ) : (
            <div className="space-y-4">
              {etats.map(e => (
                <div key={e.id} className="bg-white rounded-2xl shadow-sm p-5">
                  <div className="flex justify-between items-start flex-wrap gap-3">
                    <div>
                      <h3 className="font-bold text-lg">{e.immeuble}</h3>
                      <div className="text-sm text-gray-500 mt-1 flex gap-4 flex-wrap">
                        {e.adresse && <span>📍 {e.adresse}</span>}
                        {e.acquereur && <span>👤 {isPt ? 'Adquirente' : 'Acquéreur'} : {e.acquereur}</span>}
                        {e.dateVente && <span>📅 {isPt ? 'Venda' : 'Vente'} : {new Date(e.dateVente).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</span>}
                        <span>📆 {isPt ? 'Gerado em' : 'Généré le'} {new Date(e.dateGeneration).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</span>
                      </div>
                      <div className="flex gap-4 text-sm mt-2 flex-wrap">
                        {e.chargesRestant > 0 && <span className="text-[#C9A84C] font-semibold">{isPt ? 'Encargos pendentes' : 'Charges restant'} : {e.chargesRestant.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</span>}
                        {e.fondsTravaux > 0 && <span className="text-[#C9A84C] font-semibold">{isPt ? 'Fundo de obras' : 'Fonds travaux'} : {e.fondsTravaux.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</span>}
                        {e.impayesCopro > 0 && <span className="text-red-600 font-semibold">⚠️ {isPt ? 'Valores em dívida' : 'Impayés'} : {e.impayesCopro.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</span>}
                      </div>
                    </div>
                    <button onClick={() => exportEtatDatePdf(e)} disabled={pdfLoading === `etat_${e.id}`} className="bg-[#0D1B2E] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#152338] disabled:opacity-60 whitespace-nowrap">{pdfLoading === `etat_${e.id}` ? (isPt ? '⏳ A gerar…' : '⏳ Génération…') : (isPt ? '📄 Exportar Estado Datado PDF' : '📄 Exporter État Daté PDF')}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── DPE COLLECTIF ── */}
      {activeTab === 'dpe' && (
        <div className="p-6 lg:p-8">
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-6">
            <p className="text-sm text-orange-800">{isPt ? <><strong>🏷️ CEE Coletivo</strong> — Desde 1 de janeiro de 2024, o CEE coletivo é obrigatório para condomínios com &gt;200 frações e progressivamente para todos. Filtre as suas intervenções por classe CEE para acompanhamento.</> : <><strong>🏷️ DPE Collectif</strong> — Depuis le 1er janvier 2024, le DPE collectif est obligatoire pour les copropriétés &gt;200 lots et progressivement pour toutes. Filtrez vos interventions par classe DPE pour le suivi.</>}</p>
          </div>
          <div className="flex gap-2 mb-6 flex-wrap">
            <button onClick={() => setFilterDpe('')} className={`px-3 py-1.5 rounded-full text-sm font-bold transition ${!filterDpe ? 'bg-gray-700 text-white' : 'bg-white text-gray-600'}`}>{isPt ? 'Todos' : 'Tous'}</button>
            {['A','B','C','D','E','F','G'].map(cl => (
              <button key={cl} onClick={() => setFilterDpe(filterDpe === cl ? '' : cl)} className={`px-3 py-1.5 rounded-full text-sm font-bold transition ${filterDpe === cl ? DPE_COLORS[cl] : 'bg-white text-gray-600 border-2 border-gray-200'}`}>{cl}</button>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-3 mb-8">
            {['A','B','C','D','E','F','G'].map(cl => {
              const count = interventions.filter(i => i.dpe === cl).length
              return (
                <div key={cl} className="bg-white rounded-2xl shadow-sm p-3 text-center">
                  <div className={`w-10 h-10 rounded-xl ${DPE_COLORS[cl]} flex items-center justify-center text-lg font-black mx-auto mb-2`}>{cl}</div>
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-xs text-gray-500">{count === 1 ? (isPt ? 'edifício' : 'immeuble') : (isPt ? 'edifícios' : 'immeubles')}</div>
                </div>
              )
            })}
          </div>

          {interventions.filter(i => i.nature.toLowerCase().includes('dpe') || i.dpe).length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-8 text-center"><div className="text-4xl mb-3">🏷️</div><p className="text-gray-500">{isPt ? 'Adicione intervenções do tipo "Diagnóstico CEE coletivo" com a classe CEE para acompanhá-las aqui.' : 'Ajoutez des interventions de type "Diagnostic DPE collectif" avec la classe DPE pour les suivre ici.'}</p></div>
          ) : (
            <div className="space-y-3">
              {interventions.filter(i => (i.nature.toLowerCase().includes('dpe') || i.dpe) && (!filterDpe || i.dpe === filterDpe)).map(i => (
                <div key={i.id} className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4">
                  {i.dpe && <div className={`w-12 h-12 rounded-xl ${DPE_COLORS[i.dpe]} flex items-center justify-center text-xl font-black flex-shrink-0`}>{i.dpe}</div>}
                  <div className="flex-1">
                    <div className="font-bold">{i.immeuble || (isPt ? 'Edifício não indicado' : 'Immeuble non précisé')}</div>
                    <div className="text-sm text-gray-500">{new Date(i.date).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} · {i.prestataire || (isPt ? 'Prestador não indicado' : 'Prestataire non précisé')}</div>
                    {i.garantie && <div className="text-xs text-gray-500">{isPt ? 'Validade' : 'Validité'} : {i.garantie}</div>}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[i.statut]}`}>{i.statut === 'réalisé' ? (isPt ? 'realizado' : 'réalisé') : i.statut === 'planifié' ? (isPt ? 'planeado' : 'planifié') : (isPt ? 'em curso' : 'en_cours')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ÉQUIPEMENTS ── */}
      {activeTab === 'equipements' && (
        <div className="p-6 lg:p-8">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-teal-400"><div className="text-sm text-gray-500">{isPt ? 'Total equipamentos' : 'Total équipements'}</div><div className="text-3xl font-bold text-teal-600">{equipements.length}</div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-green-400"><div className="text-sm text-gray-500">{isPt ? 'Bom estado' : 'Bon état'}</div><div className="text-3xl font-bold text-green-600">{equipements.filter(e => e.etat === 'bon').length}</div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-orange-400"><div className="text-sm text-gray-500">{isPt ? 'A vigiar' : 'À surveiller'}</div><div className="text-3xl font-bold text-orange-600">{equipements.filter(e => e.etat === 'surveiller').length}</div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-red-400"><div className="text-sm text-gray-500">{isPt ? 'Com avaria' : 'Défaillants'}</div><div className="text-3xl font-bold text-red-600">{equipements.filter(e => e.etat === 'defaillant').length}</div></div>
          </div>

          {equipements.filter(e => { const j = joursAvantEcheance(e.prochaineMaintenance); return j !== null && j <= 30 && j >= 0 }).length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-6">
              <p className="text-sm text-orange-800 font-semibold">⚠️ {isPt ? 'Manutenções nos próximos 30 dias' : 'Maintenances dans les 30 jours'} : {equipements.filter(e => { const j = joursAvantEcheance(e.prochaineMaintenance); return j !== null && j <= 30 && j >= 0 }).map(e => e.type + (e.immeuble ? ` (${e.immeuble})` : '')).join(', ')}</p>
            </div>
          )}
          {equipements.filter(e => { const j = joursAvantEcheance(e.prochaineMaintenance); return j !== null && j < 0 }).length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
              <p className="text-sm text-red-700 font-semibold">🔴 {isPt ? 'Manutenções ultrapassadas' : 'Maintenances dépassées'} : {equipements.filter(e => { const j = joursAvantEcheance(e.prochaineMaintenance); return j !== null && j < 0 }).map(e => e.type + (e.immeuble ? ` (${e.immeuble})` : '')).join(', ')}</p>
            </div>
          )}

          {equipements.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
              <div className="text-5xl mb-4">⚙️</div>
              <h3 className="text-xl font-bold mb-2">{isPt ? 'Nenhum equipamento registado' : 'Aucun équipement référencé'}</h3>
              <p className="text-gray-500 mb-6">{isPt ? 'Registe os equipamentos técnicos dos seus edifícios para um acompanhamento de manutenção ideal' : 'Référencez les équipements techniques de vos immeubles pour un suivi de maintenance optimal'}</p>
              <button onClick={() => setShowEquipModal(true)} className="bg-teal-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-teal-700">{isPt ? '+ Primeiro equipamento' : '+ Premier équipement'}</button>
            </div>
          ) : (
            <div className="space-y-3">
              {equipements.map(eq => {
                const joursM = joursAvantEcheance(eq.prochaineMaintenance)
                const joursG = joursAvantEcheance(eq.garantieExpiration)
                return (
                  <div key={eq.id} className="bg-white rounded-2xl shadow-sm p-5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-bold">{eq.type}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${ETAT_COLORS[eq.etat]}`}>{eq.etat === 'bon' ? (isPt ? '✅ Bom estado' : '✅ Bon état') : eq.etat === 'surveiller' ? (isPt ? '⚠️ A vigiar' : '⚠️ À surveiller') : (isPt ? '🔴 Com avaria' : '🔴 Défaillant')}</span>
                        </div>
                        <div className="flex gap-3 text-sm text-gray-500 flex-wrap">
                          {eq.marque && <span>🏷️ {eq.marque}{eq.modele ? ` ${eq.modele}` : ''}</span>}
                          {eq.immeuble && <span>🏢 {eq.immeuble}</span>}
                          {eq.localisation && <span>📍 {eq.localisation}</span>}
                          {eq.prestataire && <span>👷 {eq.prestataire}</span>}
                          {eq.numeroSerie && <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">N° {eq.numeroSerie}</span>}
                        </div>
                        <div className="flex gap-4 text-xs mt-2 flex-wrap">
                          {eq.dateInstallation && <span className="text-gray-500">📅 {isPt ? 'Instalado' : 'Installé'} : {new Date(eq.dateInstallation).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</span>}
                          {eq.derniereMaintenance && <span className="text-gray-500">🔧 {isPt ? 'Última manutenção' : 'Dernière maint.'} : {new Date(eq.derniereMaintenance).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</span>}
                          {eq.prochaineMaintenance && (
                            <span className={joursM !== null && joursM < 0 ? 'text-red-600 font-semibold' : joursM !== null && joursM <= 30 ? 'text-orange-600 font-semibold' : 'text-teal-600'}>
                              🗓️ {isPt ? 'Próxima manutenção' : 'Prochaine maint.'} : {new Date(eq.prochaineMaintenance).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}{joursM !== null && joursM < 0 ? (isPt ? ' ⚠️ ULTRAPASSADA' : ' ⚠️ DÉPASSÉE') : joursM !== null && joursM <= 30 ? (isPt ? ` (dentro de ${joursM}d)` : ` (dans ${joursM}j)`) : ''}
                            </span>
                          )}
                          {eq.garantieExpiration && (
                            <span className={joursG !== null && joursG < 0 ? 'text-gray-400' : joursG !== null && joursG <= 90 ? 'text-orange-500 font-semibold' : 'text-gray-500'}>
                              🛡️ {isPt ? 'Garantia' : 'Garantie'} : {new Date(eq.garantieExpiration).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}{joursG !== null && joursG < 0 ? (isPt ? ' (expirada)' : ' (expirée)') : ''}
                            </span>
                          )}
                        </div>
                        {eq.notes && <p className="text-xs text-gray-500 mt-1">{eq.notes}</p>}
                      </div>
                      <button onClick={() => saveEquipements(equipements.filter(e => e.id !== eq.id))} aria-label={locale === 'pt' ? 'Eliminar equipamento' : 'Supprimer équipement'} className="text-red-400 hover:text-red-600 text-sm px-2 py-1 rounded-lg hover:bg-red-50">🗑️</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── CONTRATS ── */}
      {activeTab === 'contrats' && (
        <div className="p-6 lg:p-8">
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-green-400"><div className="text-sm text-gray-500">{isPt ? 'Contratos ativos' : 'Contrats actifs'}</div><div className="text-3xl font-bold text-green-600">{contrats.filter(c => c.statut === 'actif').length}</div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-[#C9A84C]"><div className="text-sm text-gray-500">{isPt ? 'A renovar' : 'À renouveler'}</div><div className="text-3xl font-bold text-[#0D1B2E]">{contrats.filter(c => c.statut === 'renouvellement').length}</div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-teal-400"><div className="text-sm text-gray-500">{isPt ? 'Orçamento anual s/IVA' : 'Budget annuel HT'}</div><div className="text-2xl font-bold text-teal-600">{contrats.filter(c => c.statut !== 'resilie').reduce((s, c) => s + (c.montantHT || 0), 0).toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</div></div>
          </div>

          {contrats.filter(c => { const j = joursAvantEcheance(c.dateFin); return j !== null && j <= 60 && j >= 0 && c.statut !== 'resilie' }).length > 0 && (
            <div className="bg-[#F7F4EE] border border-[#E4DDD0] rounded-2xl p-4 mb-6">
              <p className="text-sm text-[#0D1B2E] font-semibold">🔄 {isPt ? 'Contratos a vencer (60 dias)' : 'Contrats arrivant à échéance (60 jours)'} : {contrats.filter(c => { const j = joursAvantEcheance(c.dateFin); return j !== null && j <= 60 && j >= 0 && c.statut !== 'resilie' }).map(c => `${c.type} — ${c.prestataire}`).join(', ')}</p>
            </div>
          )}

          {contrats.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
              <div className="text-5xl mb-4">📄</div>
              <h3 className="text-xl font-bold mb-2">{isPt ? 'Nenhum contrato registado' : 'Aucun contrat enregistré'}</h3>
              <p className="text-gray-500 mb-6">{isPt ? 'Centralize os seus contratos de manutenção para não perder nenhuma renovação' : 'Centralisez vos contrats de maintenance pour ne manquer aucun renouvellement'}</p>
              <button onClick={() => setShowContratModal(true)} className="bg-teal-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-teal-700">{isPt ? '+ Primeiro contrato' : '+ Premier contrat'}</button>
            </div>
          ) : (
            <div className="space-y-3">
              {contrats.map(c => {
                const jours = joursAvantEcheance(c.dateFin)
                return (
                  <div key={c.id} className="bg-white rounded-2xl shadow-sm p-5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-bold">{c.type}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUT_CONTRAT_COLORS[c.statut]}`}>{c.statut === 'actif' ? (isPt ? '✅ Ativo' : '✅ Actif') : c.statut === 'renouvellement' ? (isPt ? '🔄 A renovar' : '🔄 À renouveler') : (isPt ? '⛔ Rescindido' : '⛔ Résilié')}</span>
                          {c.reconduction && <span className="px-2 py-0.5 rounded-full text-xs bg-[#F7F4EE] text-[#C9A84C] border border-[#E4DDD0]">{isPt ? '♾️ Renov. tácita' : '♾️ Recond. tacite'}</span>}
                        </div>
                        <div className="flex gap-3 text-sm text-gray-500 flex-wrap">
                          <span>👷 {c.prestataire}</span>
                          {c.contact && <span>📞 {c.contact}</span>}
                          {c.immeuble && <span>🏢 {c.immeuble}</span>}
                          {c.numero && <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{isPt ? 'Contrato' : 'Contrat'} {c.numero}</span>}
                        </div>
                        <div className="flex gap-4 text-xs mt-2 flex-wrap">
                          {c.dateDebut && <span className="text-gray-500">📅 {isPt ? 'Início' : 'Début'} : {new Date(c.dateDebut).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</span>}
                          {c.dateFin && (
                            <span className={jours !== null && jours < 0 ? 'text-red-600 font-semibold' : jours !== null && jours <= 60 ? 'text-orange-500 font-semibold' : 'text-gray-500'}>
                              📅 {isPt ? 'Fim' : 'Fin'} : {new Date(c.dateFin).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}{jours !== null && jours < 0 ? (isPt ? ' ⚠️ VENCIDO' : ' ⚠️ ÉCHU') : jours !== null && jours <= 60 ? (isPt ? ` (dentro de ${jours}d)` : ` (dans ${jours}j)`) : ''}
                            </span>
                          )}
                          {c.montantHT > 0 && <span className="text-teal-700 font-semibold">💰 {c.montantHT.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} € {isPt ? 's/IVA/ano' : 'HT/an'}</span>}
                        </div>
                        {c.notes && <p className="text-xs text-gray-500 mt-1">{c.notes}</p>}
                      </div>
                      <button onClick={() => saveContrats(contrats.filter(ct => ct.id !== c.id))} aria-label={locale === 'pt' ? 'Eliminar contrato' : 'Supprimer contrat'} className="text-red-400 hover:text-red-600 text-sm px-2 py-1 rounded-lg hover:bg-red-50">🗑️</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Intervention */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">{isPt ? '📖 Nova intervenção' : '📖 Nouvelle intervention'}</h2></div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Data *' : 'Date *'}</label><input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Estado' : 'Statut'}</label><select value={form.statut} onChange={e => setForm({...form, statut: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none"><option value="réalisé">{isPt ? '✅ Realizado' : '✅ Réalisé'}</option><option value="en_cours">{isPt ? '🔄 Em curso' : '🔄 En cours'}</option><option value="planifié">{isPt ? '📅 Planeado' : '📅 Planifié'}</option></select></div>
              </div>
              <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Natureza das obras *' : 'Nature des travaux *'}</label><select value={form.nature} onChange={e => setForm({...form, nature: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none"><option value="">{isPt ? 'Escolher...' : 'Choisir...'}</option>{NATURES.map(n => <option key={n}>{n}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Edifício' : 'Immeuble'}</label><input value={form.immeuble} onChange={e => setForm({...form, immeuble: e.target.value})} placeholder={isPt ? 'Edifício...' : 'Résidence...'} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Localização' : 'Localisation'}</label><input value={form.localisation} onChange={e => setForm({...form, localisation: e.target.value})} placeholder={isPt ? 'Bloco A, entrada 2...' : 'Bât A, cage 2...'} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Prestador' : 'Prestataire'}</label><input value={form.prestataire} onChange={e => setForm({...form, prestataire: e.target.value})} placeholder={isPt ? 'Nome empresa' : 'Nom entreprise'} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Custo (€)' : 'Coût (€)'}</label><input type="number" value={form.cout} onChange={e => setForm({...form, cout: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Garantia' : 'Garantie'}</label><input value={form.garantie} onChange={e => setForm({...form, garantie: e.target.value})} placeholder={isPt ? '10 anos / até 2036' : '10 ans / jusqu\'au 2036'} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Classe CEE (se diagnóstico)' : 'Classe DPE (si diagnostic)'}</label><select value={form.dpe} onChange={e => setForm({...form, dpe: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none"><option value="">{isPt ? 'Não aplicável' : 'Sans objet'}</option>{['A','B','C','D','E','F','G'].map(c => <option key={c} value={c}>Classe {c}</option>)}</select></div>
              </div>
              <div><label className="block text-sm font-semibold mb-1">Notes</label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none resize-none" /></div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-[#F7F4EE]">{isPt ? 'Cancelar' : 'Annuler'}</button>
              <button onClick={handleAdd} className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700">{isPt ? 'Registar' : 'Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal État Daté */}
      {showEtatModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">{isPt ? '📋 Novo Estado Datado' : '📋 Nouvel État Daté'}</h2><p className="text-sm text-gray-500 mt-1">{isPt ? 'Art.º 1424.º CC — Documento de transmissão de fração' : 'Art. 5 Décret 67-223 — Document de mutation de lot'}</p></div>
            <div className="p-6 space-y-5">
              {/* Immeuble */}
              <div>
                <h3 className="font-semibold text-sm text-gray-500 uppercase mb-3 border-b pb-2">{isPt ? 'Edifício e Transmissão' : 'Immeuble et Mutation'}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><label className="block text-sm font-semibold mb-1">{isPt ? 'Edifício / Condomínio *' : 'Immeuble / Résidence *'}</label><input value={etatForm.immeuble} onChange={e => setEtatForm({...etatForm, immeuble: e.target.value})} placeholder={isPt ? 'Edifício Os Pinheiros' : 'Résidence Les Pins'} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#C9A84C] outline-none" /></div>
                  <div className="col-span-2"><label className="block text-sm font-semibold mb-1">{isPt ? 'Morada' : 'Adresse'}</label><input value={etatForm.adresse} onChange={e => setEtatForm({...etatForm, adresse: e.target.value})} placeholder={isPt ? 'Rua da Paz 12, 4000-001 Porto' : '12 rue de la Paix, 75001 Paris'} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#C9A84C] outline-none" /></div>
                  <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Data de venda prevista' : 'Date de vente prévue'}</label><input type="date" value={etatForm.dateVente} onChange={e => setEtatForm({...etatForm, dateVente: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#C9A84C] outline-none" /></div>
                  <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Notário' : 'Notaire'}</label><input value={etatForm.notaire} onChange={e => setEtatForm({...etatForm, notaire: e.target.value})} placeholder={isPt ? 'Dr. Silva' : 'Me Dupont'} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#C9A84C] outline-none" /></div>
                  <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Adquirente' : 'Acquéreur'}</label><input value={etatForm.acquereur} onChange={e => setEtatForm({...etatForm, acquereur: e.target.value})} placeholder={isPt ? 'Nome APELIDO' : 'Prénom NOM'} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#C9A84C] outline-none" /></div>
                  <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Vendedor / Cedente' : 'Vendeur / Cédant'}</label><input value={etatForm.vendeur} onChange={e => setEtatForm({...etatForm, vendeur: e.target.value})} placeholder={isPt ? 'Nome APELIDO' : 'Prénom NOM'} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#C9A84C] outline-none" /></div>
                </div>
              </div>

              {/* Syndic */}
              <div>
                <h3 className="font-semibold text-sm text-gray-500 uppercase mb-3 border-b pb-2">{isPt ? 'Administrador' : 'Syndic'}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Nome do gabinete' : 'Nom du cabinet'}</label><input value={etatForm.syndicNom} onChange={e => setEtatForm({...etatForm, syndicNom: e.target.value})} placeholder={isPt ? 'Gabinete XYZ Administração' : 'Cabinet XYZ Syndic'} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#C9A84C] outline-none" /></div>
                  <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Morada administrador' : 'Adresse syndic'}</label><input value={etatForm.syndicAdresse} onChange={e => setEtatForm({...etatForm, syndicAdresse: e.target.value})} placeholder={isPt ? 'Av. dos Aliados 5, 4000-064 Porto' : '5 av. des Ternes, 75017 Paris'} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#C9A84C] outline-none" /></div>
                </div>
              </div>

              {/* Finances */}
              <div>
                <h3 className="font-semibold text-sm text-gray-500 uppercase mb-3 border-b pb-2">{isPt ? 'Situação Financeira' : 'Situation Financière'}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Encargos exercício em curso (€)' : 'Charges exercice en cours (€)'}</label><input type="number" value={etatForm.chargesExercice} onChange={e => setEtatForm({...etatForm, chargesExercice: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#C9A84C] outline-none" /></div>
                  <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Encargos pendentes (€)' : 'Charges restant à solder (€)'}</label><input type="number" value={etatForm.chargesRestant} onChange={e => setEtatForm({...etatForm, chargesRestant: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#C9A84C] outline-none" /></div>
                  <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Obras votadas não cobradas (€)' : 'Travaux votés non appelés (€)'}</label><input type="number" value={etatForm.travoteVotee} onChange={e => setEtatForm({...etatForm, travoteVotee: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#C9A84C] outline-none" /></div>
                  <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Obras restantes fração (€)' : 'Travaux restant lot (€)'}</label><input type="number" value={etatForm.travauxRestant} onChange={e => setEtatForm({...etatForm, travauxRestant: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#C9A84C] outline-none" /></div>
                  <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Fundo de obras fração (€)' : 'Fonds de travaux lot (€)'}</label><input type="number" value={etatForm.fondsTravaux} onChange={e => setEtatForm({...etatForm, fondsTravaux: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#C9A84C] outline-none" /></div>
                  <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Valores em dívida condomínio (€)' : 'Impayés copropriété (€)'}</label><input type="number" value={etatForm.impayesCopro} onChange={e => setEtatForm({...etatForm, impayesCopro: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#C9A84C] outline-none" /></div>
                </div>
                <div className="mt-3"><label className="block text-sm font-semibold mb-1">{isPt ? 'Processos em curso' : 'Procédures en cours'}</label><input value={etatForm.proceduresEnCours} onChange={e => setEtatForm({...etatForm, proceduresEnCours: e.target.value})} placeholder={isPt ? 'Nenhum / Descreva os processos' : 'Aucune / Décrivez les procédures'} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#C9A84C] outline-none" /></div>
              </div>

              {/* DPE et autres */}
              <div>
                <h3 className="font-semibold text-sm text-gray-500 uppercase mb-3 border-b pb-2">{isPt ? 'Diagnósticos & Informações' : 'Diagnostics & Informations'}</h3>
                <div className="space-y-3">
                  <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Diagnósticos & CEE coletivo' : 'Diagnostics & DPE collectif'}</label><textarea value={etatForm.diagnosticsDPE} onChange={e => setEtatForm({...etatForm, diagnosticsDPE: e.target.value})} rows={2} placeholder={isPt ? 'CEE coletivo classe C — válido até 01/2030' : 'DPE collectif classe C — valide jusqu\'au 01/2030'} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#C9A84C] outline-none resize-none" /></div>
                  <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Notas sobre o regulamento' : 'Notes sur le règlement'}</label><textarea value={etatForm.reglement} onChange={e => setEtatForm({...etatForm, reglement: e.target.value})} rows={2} placeholder={isPt ? 'Regulamento do condomínio, data, alterações...' : 'Règlement de copropriété, date, modifications...'} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#C9A84C] outline-none resize-none" /></div>
                  <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Notas complementares' : 'Notes complémentaires'}</label><textarea value={etatForm.notes} onChange={e => setEtatForm({...etatForm, notes: e.target.value})} rows={2} placeholder={isPt ? 'Qualquer informação complementar...' : 'Toute information complémentaire...'} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#C9A84C] outline-none resize-none" /></div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowEtatModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-[#F7F4EE]">{isPt ? 'Cancelar' : 'Annuler'}</button>
              <button onClick={handleCreateEtat} className="flex-1 py-2.5 bg-[#0D1B2E] text-white rounded-xl font-semibold hover:bg-[#152338]">{isPt ? 'Criar o estado datado' : "Créer l'état daté"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Équipement */}
      {showEquipModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">{isPt ? '⚙️ Novo equipamento técnico' : '⚙️ Nouvel équipement technique'}</h2></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Tipo de equipamento *' : "Type d'équipement *"}</label><select value={equipForm.type} onChange={e => setEquipForm({...equipForm, type: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none"><option value="">{isPt ? 'Escolher...' : 'Choisir...'}</option>{EQUIP_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Marca' : 'Marque'}</label><input value={equipForm.marque} onChange={e => setEquipForm({...equipForm, marque: e.target.value})} placeholder="Schindler, Daikin..." className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Modelo' : 'Modèle'}</label><input value={equipForm.modele} onChange={e => setEquipForm({...equipForm, modele: e.target.value})} placeholder={isPt ? 'Referência modelo' : 'Référence modèle'} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none" /></div>
              </div>
              <div><label className="block text-sm font-semibold mb-1">{isPt ? 'N.º de série' : 'N° de série'}</label><input value={equipForm.numeroSerie} onChange={e => setEquipForm({...equipForm, numeroSerie: e.target.value})} placeholder="SN-XXXXXXXX" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none font-mono" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Edifício *' : 'Immeuble *'}</label><input value={equipForm.immeuble} onChange={e => setEquipForm({...equipForm, immeuble: e.target.value})} placeholder={isPt ? 'Edifício Os Pinheiros' : 'Résidence Les Pins'} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Localização' : 'Localisation'}</label><input value={equipForm.localisation} onChange={e => setEquipForm({...equipForm, localisation: e.target.value})} placeholder={isPt ? 'Cave, cobertura...' : 'Cave, toit-terrasse...'} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Data de instalação' : "Date d'installation"}</label><input type="date" value={equipForm.dateInstallation} onChange={e => setEquipForm({...equipForm, dateInstallation: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Garantia até' : "Garantie jusqu'au"}</label><input type="date" value={equipForm.garantieExpiration} onChange={e => setEquipForm({...equipForm, garantieExpiration: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Última manutenção' : 'Dernière maintenance'}</label><input type="date" value={equipForm.derniereMaintenance} onChange={e => setEquipForm({...equipForm, derniereMaintenance: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Próxima manutenção' : 'Prochaine maintenance'}</label><input type="date" value={equipForm.prochaineMaintenance} onChange={e => setEquipForm({...equipForm, prochaineMaintenance: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Estado' : 'État'}</label><select value={equipForm.etat} onChange={e => setEquipForm({...equipForm, etat: e.target.value as any})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none"><option value="bon">{isPt ? '✅ Bom estado' : '✅ Bon état'}</option><option value="surveiller">{isPt ? '⚠️ A vigiar' : '⚠️ À surveiller'}</option><option value="defaillant">{isPt ? '🔴 Com avaria' : '🔴 Défaillant'}</option></select></div>
                <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Prestador manutenção' : 'Prestataire maintenance'}</label><input value={equipForm.prestataire} onChange={e => setEquipForm({...equipForm, prestataire: e.target.value})} placeholder={isPt ? 'Empresa XYZ' : 'Entreprise XYZ'} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none" /></div>
              </div>
              <div><label className="block text-sm font-semibold mb-1">Notes</label><textarea value={equipForm.notes} onChange={e => setEquipForm({...equipForm, notes: e.target.value})} rows={2} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none resize-none" /></div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => { setShowEquipModal(false); setEquipForm(defaultEquipForm) }} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-[#F7F4EE]">{isPt ? 'Cancelar' : 'Annuler'}</button>
              <button onClick={handleAddEquip} className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700">{isPt ? 'Registar' : 'Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Contrat */}
      {showContratModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">{isPt ? '📄 Novo contrato de manutenção' : '📄 Nouveau contrat de maintenance'}</h2></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Tipo de contrato *' : 'Type de contrat *'}</label><select value={contratForm.type} onChange={e => setContratForm({...contratForm, type: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none"><option value="">{isPt ? 'Escolher...' : 'Choisir...'}</option>{CONTRAT_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Prestador *' : 'Prestataire *'}</label><input value={contratForm.prestataire} onChange={e => setContratForm({...contratForm, prestataire: e.target.value})} placeholder={isPt ? 'Empresa XYZ' : 'Entreprise XYZ'} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Contacto / Tel' : 'Contact / Tél'}</label><input value={contratForm.contact} onChange={e => setContratForm({...contratForm, contact: e.target.value})} placeholder={isPt ? '91 xxx xxx xxx' : '06 xx xx xx xx'} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Edifício' : 'Immeuble'}</label><input value={contratForm.immeuble} onChange={e => setContratForm({...contratForm, immeuble: e.target.value})} placeholder={isPt ? 'Edifício Os Pinheiros' : 'Résidence Les Pins'} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">{isPt ? 'N.º contrato' : 'N° contrat'}</label><input value={contratForm.numero} onChange={e => setContratForm({...contratForm, numero: e.target.value})} placeholder="CTR-2024-001" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none font-mono" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Data de início' : 'Date de début'}</label><input type="date" value={contratForm.dateDebut} onChange={e => setContratForm({...contratForm, dateDebut: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Data de fim' : 'Date de fin'}</label><input type="date" value={contratForm.dateFin} onChange={e => setContratForm({...contratForm, dateFin: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Montante s/IVA anual (€)' : 'Montant HT annuel (€)'}</label><input type="number" value={contratForm.montantHT} onChange={e => setContratForm({...contratForm, montantHT: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">{isPt ? 'Estado' : 'Statut'}</label><select value={contratForm.statut} onChange={e => setContratForm({...contratForm, statut: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none"><option value="actif">{isPt ? '✅ Ativo' : '✅ Actif'}</option><option value="renouvellement">{isPt ? '🔄 A renovar' : '🔄 À renouveler'}</option><option value="resilie">{isPt ? '⛔ Rescindido' : '⛔ Résilié'}</option></select></div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-[#F7F4EE] rounded-xl">
                <input type="checkbox" id="reconduction" checked={contratForm.reconduction} onChange={e => setContratForm({...contratForm, reconduction: e.target.checked})} className="w-5 h-5 rounded accent-teal-600" />
                <label htmlFor="reconduction" className="text-sm font-semibold cursor-pointer">{isPt ? 'Renovação tácita automática' : 'Reconduction tacite automatique'}</label>
              </div>
              <div><label className="block text-sm font-semibold mb-1">Notes</label><textarea value={contratForm.notes} onChange={e => setContratForm({...contratForm, notes: e.target.value})} rows={2} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-teal-500 outline-none resize-none" /></div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => { setShowContratModal(false); setContratForm(defaultContratForm) }} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-[#F7F4EE]">{isPt ? 'Cancelar' : 'Annuler'}</button>
              <button onClick={handleAddContrat} className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700">{isPt ? 'Registar' : 'Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
