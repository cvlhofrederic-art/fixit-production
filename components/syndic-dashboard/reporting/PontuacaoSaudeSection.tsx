'use client'

import { useState, useEffect, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ImmeubleData {
  id: string
  nom: string
  adresse?: string
  ville?: string
  annee_construction?: number
  nb_lots?: number
  budget_annuel?: number
  depenses_annee?: number
  latitude?: number
  longitude?: number
  reglement_date_maj?: string
  prochain_controle?: string
}

interface ScoreDimension {
  key: string
  label: string
  icon: string
  score: number      // 0-100
  poids: number      // pondération %
  details: string[]
  couleur: string
  recommandations: string[]
}

interface ImmeubleScore {
  immeuble: ImmeubleData
  scoreGlobal: number
  grade: string       // A+ to F
  gradeColor: string
  dimensions: ScoreDimension[]
  tendance: 'up' | 'down' | 'stable'
  alertes: string[]
  derniereMAJ: string
}

// ─── Données locales simulées (enrichies par localStorage) ──────────────────

interface CarnetIntervention {
  id: string; date: string; nature: string; immeuble: string
  cout: number; statut: string
}
interface CarnetEquipement {
  id: string; type: string; immeuble: string
  dateInstallation?: string; prochaineMaintenance?: string
  derniereMaintenance?: string; etat: string
}
interface CarnetContrat {
  id: string; type: string; immeuble: string
  dateDebut?: string; dateFin?: string; montantHT: number; statut: string
}
interface SinistreData {
  id: string; immeuble: string; date: string; statut: string
  montant?: number
}
interface ImpayeData {
  immeuble: string; montant: number; mois_retard: number
}
interface CertifEnergetique {
  immeuble: string; classe: string; dateExpiration?: string
}
interface FundoReserva {
  immeuble: string; saldo: number; percentagemBudget: number
}
interface Seguro {
  immeuble: string; valide: boolean; dateExpiration?: string
}
interface Ocorrencia {
  id: string; immeuble: string; date: string; statut: string
  priorite?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getGrade = (score: number): { grade: string; color: string; bg: string } => {
  if (score >= 95) return { grade: 'A+', color: 'text-emerald-700', bg: 'bg-emerald-50' }
  if (score >= 85) return { grade: 'A',  color: 'text-emerald-600', bg: 'bg-emerald-50' }
  if (score >= 75) return { grade: 'B',  color: 'text-green-600',   bg: 'bg-green-50' }
  if (score >= 65) return { grade: 'C',  color: 'text-yellow-600',  bg: 'bg-yellow-50' }
  if (score >= 50) return { grade: 'D',  color: 'text-orange-600',  bg: 'bg-orange-50' }
  if (score >= 35) return { grade: 'E',  color: 'text-red-500',     bg: 'bg-red-50' }
  return                   { grade: 'F',  color: 'text-red-700',     bg: 'bg-red-100' }
}

const formatEur = (n: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

const daysDiff = (dateStr: string): number => {
  try {
    return Math.round((new Date(dateStr).getTime() - Date.now()) / 86400000)
  } catch { return 0 }
}

const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v))

// ─── Score Calculator ────────────────────────────────────────────────────────

function calculateImmeubleScore(
  imm: ImmeubleData,
  interventions: CarnetIntervention[],
  equipements: CarnetEquipement[],
  contrats: CarnetContrat[],
  sinistres: SinistreData[],
  impayes: ImpayeData[],
  certifEnergetique: CertifEnergetique | null,
  fundoReserva: FundoReserva | null,
  seguro: Seguro | null,
  ocorrencias: Ocorrencia[]
): ImmeubleScore {
  const dimensions: ScoreDimension[] = []
  const alertes: string[] = []

  // ── 1. État technique (25%) ────────────────────────────────────────────────
  let techScore = 70
  const techDetails: string[] = []
  const techRecos: string[] = []

  // Interventions récentes (signe de bonne maintenance)
  const recentInterventions = interventions.filter(i => {
    const d = daysDiff(i.date)
    return d >= -365 && d <= 0
  })
  if (recentInterventions.length >= 3) {
    techScore += 10
    techDetails.push(`${recentInterventions.length} intervenções nos últimos 12 meses`)
  } else if (recentInterventions.length === 0) {
    techScore -= 15
    techDetails.push('Nenhuma intervenção nos últimos 12 meses')
    techRecos.push('Programar inspeção técnica geral')
    alertes.push('⚠️ Sem manutenção há mais de 1 ano')
  } else {
    techDetails.push(`${recentInterventions.length} intervenção(ões) nos últimos 12 meses`)
  }

  // Équipements en mauvais état
  const eqMauvais = equipements.filter(e => e.etat === 'mauvais' || e.etat === 'mau' || e.etat === 'critique')
  if (eqMauvais.length > 0) {
    techScore -= eqMauvais.length * 8
    techDetails.push(`${eqMauvais.length} equipamento(s) em mau estado`)
    techRecos.push(`Reparar/substituir: ${eqMauvais.map(e => e.type).join(', ')}`)
    alertes.push(`🔴 ${eqMauvais.length} equipamento(s) crítico(s)`)
  }

  // Maintenances en retard
  const maintenanceRetard = equipements.filter(e => {
    if (!e.prochaineMaintenance) return false
    return daysDiff(e.prochaineMaintenance) < 0
  })
  if (maintenanceRetard.length > 0) {
    techScore -= maintenanceRetard.length * 5
    techDetails.push(`${maintenanceRetard.length} manutenção(ões) em atraso`)
    techRecos.push('Agendar manutenções em atraso imediatamente')
  }

  // Âge bâtiment
  if (imm.annee_construction) {
    const age = new Date().getFullYear() - imm.annee_construction
    if (age > 50) {
      techScore -= 10
      techDetails.push(`Edifício com ${age} anos (construído em ${imm.annee_construction})`)
      techRecos.push('Considerar auditoria estrutural')
    } else if (age > 30) {
      techScore -= 5
      techDetails.push(`Edifício com ${age} anos`)
    } else {
      techScore += 5
      techDetails.push(`Edifício recente (${age} anos)`)
    }
  }

  if (techDetails.length === 0) techDetails.push('Sem dados técnicos disponíveis')

  dimensions.push({
    key: 'tecnico',
    label: 'Estado Técnico',
    icon: '🔧',
    score: clamp(techScore),
    poids: 25,
    details: techDetails,
    couleur: 'blue',
    recommandations: techRecos,
  })

  // ── 2. Saúde financeira (25%) ──────────────────────────────────────────────
  let finScore = 75
  const finDetails: string[] = []
  const finRecos: string[] = []

  // Budget vs dépenses
  if (imm.budget_annuel && imm.depenses_annee) {
    const ratio = imm.depenses_annee / imm.budget_annuel
    if (ratio <= 0.9) {
      finScore += 15
      finDetails.push(`Despesas ${Math.round(ratio * 100)}% do orçamento (controle excelente)`)
    } else if (ratio <= 1.0) {
      finScore += 5
      finDetails.push(`Despesas ${Math.round(ratio * 100)}% do orçamento (dentro do previsto)`)
    } else if (ratio <= 1.2) {
      finScore -= 10
      finDetails.push(`Despesas ${Math.round(ratio * 100)}% do orçamento (ligeiramente acima)`)
      finRecos.push('Rever orçamento anual ou reduzir despesas')
    } else {
      finScore -= 25
      finDetails.push(`Despesas ${Math.round(ratio * 100)}% do orçamento (superação significativa!)`)
      finRecos.push('URGENTE: Reduzir despesas ou aumentar quotas')
      alertes.push('🔴 Orçamento ultrapassado em mais de 20%')
    }
  }

  // Impayés
  const immImpayes = impayes.filter(i => i.immeuble === imm.nom || i.immeuble === imm.id)
  const totalImpayes = immImpayes.reduce((sum, i) => sum + i.montant, 0)
  if (totalImpayes > 0) {
    const ratio = imm.budget_annuel ? totalImpayes / imm.budget_annuel : 0.5
    if (ratio > 0.2) {
      finScore -= 20
      finDetails.push(`Quotas em atraso: ${formatEur(totalImpayes)} (${Math.round(ratio * 100)}% do orçamento)`)
      finRecos.push('Iniciar cobrança judicial para dívidas > 90 dias')
      alertes.push(`🔴 Dívidas significativas: ${formatEur(totalImpayes)}`)
    } else if (ratio > 0.05) {
      finScore -= 10
      finDetails.push(`Quotas em atraso: ${formatEur(totalImpayes)}`)
      finRecos.push('Enviar avisos de cobrança')
    } else {
      finScore -= 3
      finDetails.push(`Quotas em atraso minor: ${formatEur(totalImpayes)}`)
    }
  } else {
    finScore += 10
    finDetails.push('Nenhuma quota em atraso')
  }

  // Fundo de reserva
  if (fundoReserva) {
    if (fundoReserva.percentagemBudget >= 15) {
      finScore += 10
      finDetails.push(`Fundo reserva: ${fundoReserva.percentagemBudget}% do orçamento (excelente)`)
    } else if (fundoReserva.percentagemBudget >= 10) {
      finScore += 5
      finDetails.push(`Fundo reserva: ${fundoReserva.percentagemBudget}% (mínimo legal cumprido)`)
    } else {
      finScore -= 15
      finDetails.push(`Fundo reserva: ${fundoReserva.percentagemBudget}% (abaixo do mínimo legal 10%!)`)
      finRecos.push('OBRIGATÓRIO: Aumentar fundo de reserva para mínimo 10% (DL 268/94)')
      alertes.push('🔴 Fundo reserva abaixo do mínimo legal')
    }
  }

  if (finDetails.length === 0) finDetails.push('Sem dados financeiros disponíveis')

  dimensions.push({
    key: 'financeiro',
    label: 'Saúde Financeira',
    icon: '💰',
    score: clamp(finScore),
    poids: 25,
    details: finDetails,
    couleur: 'green',
    recommandations: finRecos,
  })

  // ── 3. Conformidade legal (20%) ────────────────────────────────────────────
  let legalScore = 80
  const legalDetails: string[] = []
  const legalRecos: string[] = []

  // Seguro obrigatório
  if (seguro) {
    if (seguro.valide) {
      if (seguro.dateExpiration) {
        const daysLeft = daysDiff(seguro.dateExpiration)
        if (daysLeft < 30) {
          legalScore -= 10
          legalDetails.push(`Seguro expira em ${daysLeft} dias!`)
          legalRecos.push('Renovar seguro obrigatório antes da expiração')
          alertes.push('⚠️ Seguro expira em breve')
        } else {
          legalScore += 10
          legalDetails.push(`Seguro válido (expira em ${Math.round(daysLeft / 30)} meses)`)
        }
      } else {
        legalScore += 10
        legalDetails.push('Seguro obrigatório válido')
      }
    } else {
      legalScore -= 25
      legalDetails.push('Seguro obrigatório INVÁLIDO ou expirado!')
      legalRecos.push('URGENTE: Renovar seguro contra incêndio (Art.º 1429.º CC)')
      alertes.push('🔴 Seguro obrigatório inválido!')
    }
  } else {
    legalScore -= 15
    legalDetails.push('Sem informação sobre seguro obrigatório')
    legalRecos.push('Verificar e registar seguro contra incêndio')
  }

  // Certificação energética
  if (certifEnergetique) {
    if (certifEnergetique.dateExpiration && daysDiff(certifEnergetique.dateExpiration) < 0) {
      legalScore -= 10
      legalDetails.push(`Certificado energético expirado (classe ${certifEnergetique.classe})`)
      legalRecos.push('Renovar certificação energética SCE')
    } else {
      const classBonus: Record<string, number> = { 'A+': 10, 'A': 8, 'B': 5, 'B-': 3, 'C': 0, 'D': -5, 'E': -8, 'F': -10 }
      legalScore += classBonus[certifEnergetique.classe] || 0
      legalDetails.push(`Certificação energética: Classe ${certifEnergetique.classe}`)
      if (['D', 'E', 'F'].includes(certifEnergetique.classe)) {
        legalRecos.push('Planear obras de eficiência energética (EPBD 2024/MEPS)')
      }
    }
  }

  // Prochain contrôle
  if (imm.prochain_controle) {
    const daysUntil = daysDiff(imm.prochain_controle)
    if (daysUntil < 0) {
      legalScore -= 15
      legalDetails.push('Controlo técnico em ATRASO!')
      legalRecos.push('Agendar inspeção técnica imediatamente')
      alertes.push('🔴 Inspeção técnica em atraso')
    } else if (daysUntil < 60) {
      legalScore -= 5
      legalDetails.push(`Próximo controlo em ${daysUntil} dias`)
      legalRecos.push('Preparar documentação para inspeção')
    } else {
      legalDetails.push(`Próximo controlo em ${Math.round(daysUntil / 30)} meses`)
    }
  }

  // Contrats expirés
  const contratsExpires = contrats.filter(c => {
    if (!c.dateFin) return false
    return daysDiff(c.dateFin) < 0 && c.statut !== 'termine'
  })
  if (contratsExpires.length > 0) {
    legalScore -= contratsExpires.length * 5
    legalDetails.push(`${contratsExpires.length} contrato(s) expirado(s)`)
    legalRecos.push(`Renovar contratos: ${contratsExpires.map(c => c.type).join(', ')}`)
  }

  if (legalDetails.length === 0) legalDetails.push('Sem dados de conformidade disponíveis')

  dimensions.push({
    key: 'legal',
    label: 'Conformidade Legal',
    icon: '⚖️',
    score: clamp(legalScore),
    poids: 20,
    details: legalDetails,
    couleur: 'purple',
    recommandations: legalRecos,
  })

  // ── 4. Satisfação / Ocorrências (15%) ─────────────────────────────────────
  let satScore = 80
  const satDetails: string[] = []
  const satRecos: string[] = []

  const immOcorrencias = ocorrencias.filter(o => o.immeuble === imm.nom || o.immeuble === imm.id)
  const ocorrenciasOuvertes = immOcorrencias.filter(o => o.statut !== 'resolvida' && o.statut !== 'fechada')
  const ocorrenciasCritiques = immOcorrencias.filter(o => o.priorite === 'urgente' || o.priorite === 'alta')

  if (ocorrenciasOuvertes.length === 0) {
    satScore += 15
    satDetails.push('Nenhuma ocorrência em aberto')
  } else if (ocorrenciasOuvertes.length <= 2) {
    satScore += 5
    satDetails.push(`${ocorrenciasOuvertes.length} ocorrência(s) em aberto`)
  } else if (ocorrenciasOuvertes.length <= 5) {
    satScore -= 10
    satDetails.push(`${ocorrenciasOuvertes.length} ocorrências em aberto`)
    satRecos.push('Resolver ocorrências pendentes para melhorar satisfação')
  } else {
    satScore -= 20
    satDetails.push(`${ocorrenciasOuvertes.length} ocorrências em aberto (muitas!)`)
    satRecos.push('PRIORITÁRIO: Tratar ocorrências em massa')
    alertes.push(`⚠️ ${ocorrenciasOuvertes.length} ocorrências por resolver`)
  }

  if (ocorrenciasCritiques.length > 0) {
    satScore -= ocorrenciasCritiques.length * 5
    satDetails.push(`${ocorrenciasCritiques.length} ocorrência(s) urgente(s)/alta(s)`)
  }

  // Sinistres
  const immSinistres = sinistres.filter(s => s.immeuble === imm.nom || s.immeuble === imm.id)
  const sinistresOuverts = immSinistres.filter(s => s.statut !== 'reglé' && s.statut !== 'rejete' && s.statut !== 'resolvido')
  if (sinistresOuverts.length > 0) {
    satScore -= sinistresOuverts.length * 10
    satDetails.push(`${sinistresOuverts.length} sinistro(s) em aberto`)
    satRecos.push('Acompanhar resolução de sinistros com seguradoras')
    alertes.push(`🚨 ${sinistresOuverts.length} sinistro(s) ativo(s)`)
  } else if (immSinistres.length === 0) {
    satScore += 5
    satDetails.push('Sem histórico de sinistros')
  }

  if (satDetails.length === 0) satDetails.push('Sem dados de satisfação disponíveis')

  dimensions.push({
    key: 'satisfacao',
    label: 'Satisfação / Ocorrências',
    icon: '😊',
    score: clamp(satScore),
    poids: 15,
    details: satDetails,
    couleur: 'amber',
    recommandations: satRecos,
  })

  // ── 5. Eficiência energética (15%) ─────────────────────────────────────────
  let energyScore = 60
  const energyDetails: string[] = []
  const energyRecos: string[] = []

  if (certifEnergetique) {
    const classScore: Record<string, number> = { 'A+': 100, 'A': 90, 'B': 75, 'B-': 65, 'C': 55, 'D': 40, 'E': 25, 'F': 10 }
    energyScore = classScore[certifEnergetique.classe] || 50
    energyDetails.push(`Classe energética: ${certifEnergetique.classe}`)

    if (['D', 'E', 'F'].includes(certifEnergetique.classe)) {
      energyRecos.push('Instalar isolamento térmico (paredes/cobertura)')
      energyRecos.push('Considerar painéis solares para partes comuns')
      energyRecos.push('Substituir iluminação por LED nas partes comuns')
    } else if (certifEnergetique.classe === 'C') {
      energyRecos.push('Otimizar sistema de iluminação')
      energyRecos.push('Avaliar instalação de painéis fotovoltaicos')
    }
  } else {
    energyDetails.push('Sem certificação energética registada')
    energyRecos.push('Obter certificação energética SCE (DL 101-D/2020)')
  }

  // Âge du bâtiment impact énergie
  if (imm.annee_construction && imm.annee_construction < 1990 && !certifEnergetique) {
    energyScore -= 10
    energyDetails.push('Edifício anterior a 1990 sem reabilitação energética')
    energyRecos.push('Realizar auditoria energética urgente')
  }

  dimensions.push({
    key: 'energia',
    label: 'Eficiência Energética',
    icon: '⚡',
    score: clamp(energyScore),
    poids: 15,
    details: energyDetails,
    couleur: 'teal',
    recommandations: energyRecos,
  })

  // ── Score global pondéré ───────────────────────────────────────────────────
  const scoreGlobal = Math.round(
    dimensions.reduce((sum, d) => sum + d.score * (d.poids / 100), 0)
  )

  const { grade, color } = getGrade(scoreGlobal)

  // Tendance (simulée basée sur les interventions récentes vs anciennes)
  const recent6m = interventions.filter(i => daysDiff(i.date) >= -180 && daysDiff(i.date) <= 0).length
  const older6m = interventions.filter(i => daysDiff(i.date) >= -365 && daysDiff(i.date) < -180).length
  const tendance = recent6m > older6m ? 'up' as const : recent6m < older6m ? 'down' as const : 'stable' as const

  return {
    immeuble: imm,
    scoreGlobal: clamp(scoreGlobal),
    grade,
    gradeColor: color,
    dimensions,
    tendance,
    alertes,
    derniereMAJ: new Date().toISOString(),
  }
}

// ─── Composants visuels ──────────────────────────────────────────────────────

function ScoreCircle({ score, grade, gradeColor, size = 'lg' }: {
  score: number; grade: string; gradeColor: string; size?: 'sm' | 'lg'
}) {
  const radius = size === 'lg' ? 58 : 32
  const stroke = size === 'lg' ? 8 : 5
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - score / 100)
  const dim = (radius + stroke) * 2

  const scoreColor = score >= 85 ? '#059669' : score >= 65 ? '#d97706' : score >= 45 ? '#ea580c' : '#dc2626'

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={dim} height={dim} className="transform -rotate-90">
        <circle
          cx={radius + stroke} cy={radius + stroke} r={radius}
          fill="none" stroke="#e5e7eb" strokeWidth={stroke}
        />
        <circle
          cx={radius + stroke} cy={radius + stroke} r={radius}
          fill="none" stroke={scoreColor} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`font-bold ${gradeColor} ${size === 'lg' ? 'text-3xl' : 'text-lg'}`}>{grade}</span>
        <span className={`text-gray-500 ${size === 'lg' ? 'text-sm' : 'text-xs'}`}>{score}/100</span>
      </div>
    </div>
  )
}

function DimensionBar({ dim }: { dim: ScoreDimension }) {
  const [expanded, setExpanded] = useState(false)
  const barColor = dim.score >= 80 ? 'bg-emerald-500' : dim.score >= 60 ? 'bg-yellow-500' : dim.score >= 40 ? 'bg-orange-500' : 'bg-red-500'

  return (
    <div className="border border-gray-100 rounded-xl p-4 hover:shadow-md transition-all">
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">{dim.icon}</span>
            <span className="font-semibold text-[#0D1B2E] text-sm">{dim.label}</span>
            <span className="text-xs text-gray-400">({dim.poids}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`font-bold text-sm ${dim.score >= 80 ? 'text-emerald-600' : dim.score >= 60 ? 'text-yellow-600' : dim.score >= 40 ? 'text-orange-600' : 'text-red-600'}`}>
              {dim.score}
            </span>
            <svg className={`w-4 h-4 transition-transform text-gray-400 ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-1000 ease-out ${barColor}`} style={{ width: `${dim.score}%` }} />
        </div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2 animate-in slide-in-from-top-2">
          {dim.details.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Detalhes:</p>
              {dim.details.map((d, i) => (
                <p key={i} className="text-xs text-gray-600 pl-3 py-0.5 border-l-2 border-gray-200">• {d}</p>
              ))}
            </div>
          )}
          {dim.recommandations.length > 0 && (
            <div>
              <p className="text-xs font-medium text-amber-600 mb-1">Recomendações:</p>
              {dim.recommandations.map((r, i) => (
                <p key={i} className="text-xs text-amber-700 pl-3 py-0.5 border-l-2 border-amber-300">💡 {r}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TendanceIcon({ tendance }: { tendance: 'up' | 'down' | 'stable' }) {
  if (tendance === 'up') return <span className="text-emerald-500 text-sm font-medium">↗ Em melhoria</span>
  if (tendance === 'down') return <span className="text-red-500 text-sm font-medium">↘ Em declínio</span>
  return <span className="text-gray-400 text-sm font-medium">→ Estável</span>
}

// ─── Composant Principal ─────────────────────────────────────────────────────

interface Props {
  user: User
  userRole: string
}

export default function PontuacaoSaudeSection({ user }: Props) {
  const [immeubles, setImmeubles] = useState<ImmeubleData[]>([])
  const [scores, setScores] = useState<ImmeubleScore[]>([])
  const [selectedImm, setSelectedImm] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'cards' | 'ranking'>('cards')

  // ── Charger données ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const loadData = async () => {
    setLoading(true)
    try {
      // Charger immeubles depuis API
      const res = await fetch(`/api/syndic/immeubles?user_id=${user.id}`)
      const data = await res.json()
      const imms: ImmeubleData[] = data.immeubles || []
      setImmeubles(imms)

      // Charger données localStorage
      const lsKey = (k: string) => `fixit_syndic_${user.id}_${k}`

      const interventions: CarnetIntervention[] = JSON.parse(localStorage.getItem(lsKey('carnet_interventions')) || '[]')
      const equipements: CarnetEquipement[] = JSON.parse(localStorage.getItem(lsKey('carnet_equipements')) || '[]')
      const contrats: CarnetContrat[] = JSON.parse(localStorage.getItem(lsKey('carnet_contrats')) || '[]')
      const sinistres: SinistreData[] = JSON.parse(localStorage.getItem(lsKey('sinistres')) || '[]')
      const impayes: ImpayeData[] = JSON.parse(localStorage.getItem(lsKey('impayes')) || '[]')
      const ocorrencias: Ocorrencia[] = JSON.parse(localStorage.getItem(lsKey('ocorrencias')) || '[]')

      // Certifications et assurances par immeuble
      const certifs: Record<string, CertifEnergetique> = JSON.parse(localStorage.getItem(lsKey('certif_energetica')) || '{}')
      const fundos: Record<string, FundoReserva> = JSON.parse(localStorage.getItem(lsKey('fundo_reserva')) || '{}')
      const seguros: Record<string, Seguro> = JSON.parse(localStorage.getItem(lsKey('seguros')) || '{}')

      // Calculer scores
      const calculated = imms.map(imm => {
        const immInterventions = interventions.filter(i => i.immeuble === imm.nom || i.immeuble === imm.id)
        const immEquipements = equipements.filter(e => e.immeuble === imm.nom || e.immeuble === imm.id)
        const immContrats = contrats.filter(c => c.immeuble === imm.nom || c.immeuble === imm.id)
        const immSinistres = sinistres.filter(s => s.immeuble === imm.nom || s.immeuble === imm.id)
        const immImpayes = impayes.filter(i => i.immeuble === imm.nom || i.immeuble === imm.id)
        const immOcorrencias = ocorrencias.filter(o => o.immeuble === imm.nom || o.immeuble === imm.id)
        const certif = certifs[imm.id] || certifs[imm.nom] || null
        const fundo = fundos[imm.id] || fundos[imm.nom] || null
        const seg = seguros[imm.id] || seguros[imm.nom] || null

        return calculateImmeubleScore(
          imm, immInterventions, immEquipements, immContrats,
          immSinistres, immImpayes, certif, fundo, seg, immOcorrencias
        )
      })

      setScores(calculated.sort((a, b) => b.scoreGlobal - a.scoreGlobal))
      if (calculated.length > 0 && !selectedImm) {
        setSelectedImm(calculated[0].immeuble.id)
      }
    } catch (err) {
      console.error('Erro ao carregar dados de saúde:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Score moyen global ─────────────────────────────────────────────────────
  const avgScore = useMemo(() => {
    if (scores.length === 0) return 0
    return Math.round(scores.reduce((sum, s) => sum + s.scoreGlobal, 0) / scores.length)
  }, [scores])

  const avgGrade = useMemo(() => getGrade(avgScore), [avgScore])

  const selectedScore = useMemo(
    () => scores.find(s => s.immeuble.id === selectedImm),
    [scores, selectedImm]
  )

  // ── Alertes globales ───────────────────────────────────────────────────────
  const totalAlertes = useMemo(() => scores.reduce((sum, s) => sum + s.alertes.length, 0), [scores])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-[#C9A84C] border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500 text-sm">A calcular pontuações de saúde...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#0D1B2E] flex items-center gap-2">
            🏥 Pontuação de Saúde dos Edifícios
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Avaliação IA baseada em estado técnico, finanças, conformidade, satisfação e energia
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('cards')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
              viewMode === 'cards' ? 'bg-[#0D1B2E] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            📊 Detalhes
          </button>
          <button
            onClick={() => setViewMode('ranking')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
              viewMode === 'ranking' ? 'bg-[#0D1B2E] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            🏆 Ranking
          </button>
          <button
            onClick={loadData}
            className="px-3 py-1.5 text-xs rounded-lg font-medium bg-[#C9A84C]/10 text-[#C9A84C] hover:bg-[#C9A84C]/20 transition-all"
          >
            🔄 Atualizar
          </button>
        </div>
      </div>

      {/* ── Score global moyen ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 flex items-center gap-4 shadow-sm">
          <ScoreCircle score={avgScore} grade={avgGrade.grade} gradeColor={avgGrade.color} size="sm" />
          <div>
            <p className="text-xs text-gray-500">Pontuação Média</p>
            <p className="text-lg font-bold text-[#0D1B2E]">{avgScore}/100</p>
            <p className="text-xs text-gray-400">{scores.length} edifício(s)</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Melhor Edifício</p>
          {scores.length > 0 ? (
            <>
              <p className="font-semibold text-[#0D1B2E] text-sm truncate">{scores[0].immeuble.nom}</p>
              <p className={`text-lg font-bold ${scores[0].gradeColor}`}>{scores[0].grade} — {scores[0].scoreGlobal}/100</p>
            </>
          ) : <p className="text-gray-400 text-sm">—</p>}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Pior Edifício</p>
          {scores.length > 0 ? (
            <>
              <p className="font-semibold text-[#0D1B2E] text-sm truncate">{scores[scores.length - 1].immeuble.nom}</p>
              <p className={`text-lg font-bold ${scores[scores.length - 1].gradeColor}`}>
                {scores[scores.length - 1].grade} — {scores[scores.length - 1].scoreGlobal}/100
              </p>
            </>
          ) : <p className="text-gray-400 text-sm">—</p>}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Alertas Ativos</p>
          <p className={`text-2xl font-bold ${totalAlertes > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {totalAlertes}
          </p>
          <p className="text-xs text-gray-400">
            {totalAlertes === 0 ? 'Tudo em ordem!' : `em ${scores.filter(s => s.alertes.length > 0).length} edifício(s)`}
          </p>
        </div>
      </div>

      {/* ── Vue Ranking ────────────────────────────────────────────────────── */}
      {viewMode === 'ranking' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50">
            <h3 className="font-semibold text-[#0D1B2E] text-sm">🏆 Ranking dos Edifícios</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {scores.map((s, idx) => {
              const { bg } = getGrade(s.scoreGlobal)
              return (
                <button
                  key={s.immeuble.id}
                  onClick={() => { setSelectedImm(s.immeuble.id); setViewMode('cards') }}
                  className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-all text-left"
                >
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                    idx === 1 ? 'bg-gray-100 text-gray-600' :
                    idx === 2 ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-50 text-gray-500'
                  }`}>
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#0D1B2E] text-sm truncate">{s.immeuble.nom}</p>
                    <p className="text-xs text-gray-400 truncate">{s.immeuble.adresse || s.immeuble.ville || '—'}</p>
                  </div>
                  <TendanceIcon tendance={s.tendance} />
                  <div className={`px-3 py-1 rounded-lg ${bg}`}>
                    <span className={`font-bold text-sm ${s.gradeColor}`}>{s.grade}</span>
                    <span className="text-gray-400 text-xs ml-1">{s.scoreGlobal}</span>
                  </div>
                  {s.alertes.length > 0 && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-medium rounded-full">
                      {s.alertes.length} alerta(s)
                    </span>
                  )}
                </button>
              )
            })}
            {scores.length === 0 && (
              <div className="px-6 py-12 text-center text-gray-400">
                <p className="text-4xl mb-2">🏢</p>
                <p className="text-sm">Nenhum edifício registado</p>
                <p className="text-xs mt-1">Adicione edifícios no módulo "Imóveis" para ver a pontuação</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Vue Détail immeuble ─────────────────────────────────────────────── */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sélecteur immeubles */}
          <div className="lg:col-span-1 space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider px-1">Edifícios</h3>
            {scores.map(s => (
              <button
                key={s.immeuble.id}
                onClick={() => setSelectedImm(s.immeuble.id)}
                className={`w-full rounded-xl border p-4 text-left transition-all ${
                  selectedImm === s.immeuble.id
                    ? 'border-[#C9A84C] bg-[#C9A84C]/5 shadow-md'
                    : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#0D1B2E] text-sm truncate">{s.immeuble.nom}</p>
                    <p className="text-xs text-gray-400 truncate">{s.immeuble.adresse || '—'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <TendanceIcon tendance={s.tendance} />
                      {s.alertes.length > 0 && (
                        <span className="text-xs text-red-500">• {s.alertes.length} alerta(s)</span>
                      )}
                    </div>
                  </div>
                  <ScoreCircle score={s.scoreGlobal} grade={s.grade} gradeColor={s.gradeColor} size="sm" />
                </div>
              </button>
            ))}
            {scores.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <p className="text-3xl mb-2">🏢</p>
                <p className="text-sm">Nenhum edifício</p>
              </div>
            )}
          </div>

          {/* Détail score sélectionné */}
          <div className="lg:col-span-2 space-y-4">
            {selectedScore ? (
              <>
                {/* Header score */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                  <div className="flex items-start gap-6">
                    <ScoreCircle
                      score={selectedScore.scoreGlobal}
                      grade={selectedScore.grade}
                      gradeColor={selectedScore.gradeColor}
                      size="lg"
                    />
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-[#0D1B2E]">{selectedScore.immeuble.nom}</h3>
                      <p className="text-sm text-gray-500">{selectedScore.immeuble.adresse} {selectedScore.immeuble.ville && `· ${selectedScore.immeuble.ville}`}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <TendanceIcon tendance={selectedScore.tendance} />
                        {selectedScore.immeuble.nb_lots && (
                          <span className="text-xs text-gray-400">🏠 {selectedScore.immeuble.nb_lots} frações</span>
                        )}
                        {selectedScore.immeuble.annee_construction && (
                          <span className="text-xs text-gray-400">📅 {selectedScore.immeuble.annee_construction}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Alertes */}
                {selectedScore.alertes.length > 0 && (
                  <div className="bg-red-50 rounded-2xl border border-red-100 p-4">
                    <h4 className="font-semibold text-red-700 text-sm mb-2">⚠️ Alertas ({selectedScore.alertes.length})</h4>
                    <div className="space-y-1">
                      {selectedScore.alertes.map((a, i) => (
                        <p key={i} className="text-xs text-red-600">{a}</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dimensions */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider px-1">
                    Análise por dimensão
                  </h4>
                  {selectedScore.dimensions.map(dim => (
                    <DimensionBar key={dim.key} dim={dim} />
                  ))}
                </div>

                {/* Radar chart simplifié (barres horizontales comparatives) */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                  <h4 className="font-semibold text-[#0D1B2E] text-sm mb-4">📊 Perfil do Edifício</h4>
                  <div className="space-y-3">
                    {selectedScore.dimensions.map(dim => (
                      <div key={dim.key} className="flex items-center gap-3">
                        <span className="w-6 text-center text-sm">{dim.icon}</span>
                        <span className="text-xs text-gray-600 w-32 truncate">{dim.label}</span>
                        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-1000 ${
                              dim.score >= 80 ? 'bg-emerald-400' :
                              dim.score >= 60 ? 'bg-yellow-400' :
                              dim.score >= 40 ? 'bg-orange-400' : 'bg-red-400'
                            }`}
                            style={{ width: `${dim.score}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono font-bold text-gray-600 w-8 text-right">{dim.score}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Toutes les recommandations */}
                {selectedScore.dimensions.some(d => d.recommandations.length > 0) && (
                  <div className="bg-amber-50 rounded-2xl border border-amber-100 p-6">
                    <h4 className="font-semibold text-amber-800 text-sm mb-3">💡 Plano de Ação Recomendado</h4>
                    <div className="space-y-3">
                      {selectedScore.dimensions
                        .filter(d => d.recommandations.length > 0)
                        .sort((a, b) => a.score - b.score)
                        .map(dim => (
                          <div key={dim.key}>
                            <p className="text-xs font-semibold text-amber-700 mb-1">{dim.icon} {dim.label} (score: {dim.score})</p>
                            {dim.recommandations.map((r, i) => (
                              <p key={i} className="text-xs text-amber-700 pl-4 py-0.5">→ {r}</p>
                            ))}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <div className="text-center">
                  <p className="text-4xl mb-2">👈</p>
                  <p className="text-sm">Selecione um edifício para ver a análise completa</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
