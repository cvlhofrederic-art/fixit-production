// Auto-planification d'un mandat depuis l'ordonnance — port byte-exact du mockup v8.
// Pur (aucune dépendance React) : calcule le calendrier légal, l'échéance de
// mission et les actes à pré-rédiger depuis la date d'ordonnance + durée + fondement.

export interface MandatePlanInput {
  ordonnance?: string
  duree?: string
  fondement?: string
}

export interface MandatePlanStep {
  label: string
  date: string
  basis: string
  role: string
}

export interface MandatePlan {
  ech: string
  calendar: MandatePlanStep[]
  docs: string[]
}

export function fmtD(dt: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()}`
}

export function computeMandatePlan(inp: MandatePlanInput): MandatePlan {
  const parts = (inp.ordonnance || '').split('/').map(Number)
  const base = parts.length === 3 && parts[2] ? new Date(parts[2], (parts[1] || 1) - 1, parts[0] || 1) : new Date(2026, 5, 4)
  const months = parseInt(inp.duree ?? '', 10) || 12
  const ech = new Date(base)
  ech.setMonth(ech.getMonth() + months)
  const plus = (n: number) => {
    const d = new Date(base)
    d.setDate(d.getDate() + n)
    return d
  }
  const echMinus = (n: number) => {
    const d = new Date(ech)
    d.setMonth(d.getMonth() - n)
    return d
  }
  const is29 = (inp.fondement || '').includes('29-1')
  const calendar: MandatePlanStep[] = [
    { label: "Notifier l'ordonnance aux copropriétaires", date: fmtD(plus(30)), basis: 'art. 64 décret 1967', role: 'Secrétariat' },
    { label: 'Mettre à jour le registre des copropriétés', date: fmtD(plus(30)), basis: 'loi ALUR — L.711-2 CCH', role: 'Juridique' },
    { label: 'Ouvrir / vérifier le compte bancaire séparé', date: fmtD(plus(15)), basis: 'art. 18 L. 1965', role: 'Comptabilité' },
    { label: "Convoquer l'AG élective", date: fmtD(echMinus(2)), basis: 'art. 17 L. 1965 — 46 décret', role: 'Juridique' },
    { label: 'Établir la reddition de comptes', date: fmtD(echMinus(1)), basis: is29 ? 'art. 29-1 L. 1965' : 'art. 18-2 L. 1965', role: 'Comptabilité' },
    { label: "Soumettre l'état de frais à taxation", date: fmtD(ech), basis: 'CPC 704-718', role: 'Comptabilité' },
  ]
  const docs = ["Notification d'ordonnance", 'Convocation AG élective'].concat(is29 ? ['Requête art. 29-1 (suivi)'] : [])
  return { ech: fmtD(ech), calendar, docs }
}
