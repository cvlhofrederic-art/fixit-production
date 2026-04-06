import { useState, useEffect, useMemo } from 'react'

type ModuleConfig = { id: string; enabled: boolean; order: number }
type ModuleDef = { id: string; icon: string; label: string; description: string; category: string; locked?: boolean }

export function useModulesConfig(artisanId: string | undefined, t: (key: string) => string) {
  const ALL_MODULES: ModuleDef[] = useMemo(() => [
    { id: 'home', icon: '🏠', label: t('proDash.modules.home'), description: t('proDash.modules.homeDesc'), category: t('proDash.categories.activity'), locked: true },
    { id: 'calendar', icon: '📅', label: t('proDash.modules.calendar'), description: t('proDash.modules.calendarDesc'), category: t('proDash.categories.activity') },
    { id: 'motifs', icon: '🔧', label: t('proDash.modules.motifs'), description: t('proDash.modules.motifsDesc'), category: t('proDash.categories.activity') },
    { id: 'horaires', icon: '🕐', label: t('proDash.modules.hours'), description: t('proDash.modules.hoursDesc'), category: t('proDash.categories.activity') },
    { id: 'messages', icon: '💬', label: t('proDash.modules.messaging'), description: t('proDash.modules.messagingDesc'), category: t('proDash.categories.communication') },
    { id: 'clients', icon: '👥', label: t('proDash.modules.clients'), description: t('proDash.modules.clientsDesc'), category: t('proDash.categories.communication') },
    { id: 'devis', icon: '📄', label: t('proDash.modules.quotes'), description: t('proDash.modules.quotesDesc'), category: t('proDash.categories.billing') },
    { id: 'factures', icon: '🧾', label: t('proDash.modules.invoices'), description: t('proDash.modules.invoicesDesc'), category: t('proDash.categories.billing') },
    { id: 'rapports', icon: '📋', label: t('proDash.modules.reports'), description: t('proDash.modules.reportsDesc'), category: t('proDash.categories.billing') },
    { id: 'contrats', icon: '📑', label: t('proDash.modules.contracts'), description: t('proDash.modules.contractsDesc'), category: t('proDash.categories.billing') },
    { id: 'stats', icon: '📊', label: t('proDash.modules.stats'), description: t('proDash.modules.statsDesc'), category: t('proDash.categories.analysis') },
    { id: 'revenus', icon: '💰', label: t('proDash.modules.revenue'), description: t('proDash.modules.revenueDesc'), category: t('proDash.categories.analysis') },
    { id: 'comptabilite', icon: '🧮', label: t('proDash.modules.accounting'), description: t('proDash.modules.accountingDesc'), category: t('proDash.categories.analysis') },
    { id: 'materiaux', icon: '🛒', label: t('proDash.modules.materials'), description: t('proDash.modules.materialsDesc'), category: t('proDash.categories.analysis') },
    { id: 'marches', icon: '🏛️', label: t('proDash.modules.marches') || 'Bourse aux Marchés', description: t('proDash.modules.marchesDesc') || 'Appels d\'offres et candidatures', category: t('proDash.categories.activity') },
    { id: 'wallet', icon: '🗂️', label: t('proDash.modules.wallet'), description: t('proDash.modules.walletDesc'), category: t('proDash.categories.proProfil') },
    { id: 'portfolio', icon: '📸', label: t('proDash.modules.portfolio'), description: t('proDash.modules.portfolioDesc'), category: t('proDash.categories.proProfil') },
    { id: 'chantiers_v22', icon: '🏗️', label: 'Chantiers', description: 'Gestion des chantiers en cours', category: t('proDash.categories.activity') },
    { id: 'pipeline', icon: '📊', label: 'Pipeline', description: 'Suivi commercial des devis', category: t('proDash.categories.billing') },
    { id: 'bibliotheque', icon: '📚', label: 'Bibliothèque', description: 'Ouvrages, matériaux et main-d\'œuvre', category: t('proDash.categories.billing') },
    { id: 'parrainage', icon: '🎁', label: t('proDash.modules.parrainage') || 'Parrainage', description: t('proDash.modules.parrainageDesc') || 'Parrainez des artisans, gagnez des mois gratuits', category: t('proDash.categories.proProfil') },
    { id: 'marketplace_btp', icon: '🏗️', label: 'Marketplace BTP', description: 'Achats, ventes et échanges entre professionnels', category: t('proDash.categories.activity') },
    { id: 'settings', icon: '⚙️', label: t('proDash.modules.settings'), description: t('proDash.modules.settingsDesc'), category: t('proDash.categories.account'), locked: true },
  ], [t])

  const MODULES_STORAGE_KEY = useMemo(() => `fixit_modules_config_${artisanId || 'default'}`, [artisanId])

  const [modulesConfig, setModulesConfig] = useState<ModuleConfig[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = JSON.parse(localStorage.getItem(MODULES_STORAGE_KEY) || '[]')
      if (saved.length > 0) {
        const merged = ALL_MODULES.map(m => {
          const s = saved.find((x: ModuleConfig) => x.id === m.id)
          return s ? { id: m.id, enabled: m.locked ? true : s.enabled, order: s.order } : { id: m.id, enabled: true, order: 999 }
        }).sort((a, b) => a.order - b.order)
        setModulesConfig(merged)
      } else {
        setModulesConfig(ALL_MODULES.map((m, i) => ({ id: m.id, enabled: true, order: i })))
      }
    } catch {
      setModulesConfig(ALL_MODULES.map((m, i) => ({ id: m.id, enabled: true, order: i })))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artisanId])

  const saveModulesConfig = (config: ModuleConfig[]) => {
    setModulesConfig(config)
    try { localStorage.setItem(MODULES_STORAGE_KEY, JSON.stringify(config)) } catch {}
  }

  const isModuleEnabled = (moduleId: string): boolean => {
    if (modulesConfig.length === 0) return true
    const m = modulesConfig.find(x => x.id === moduleId)
    return m ? m.enabled : true
  }

  const moveModule = (moduleId: string, direction: 'up' | 'down') => {
    const sorted = [...modulesConfig].sort((a, b) => a.order - b.order)
    const idx = sorted.findIndex(x => x.id === moduleId)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const temp = sorted[idx].order
    sorted[idx] = { ...sorted[idx], order: sorted[swapIdx].order }
    sorted[swapIdx] = { ...sorted[swapIdx], order: temp }
    saveModulesConfig(sorted)
  }

  return { ALL_MODULES, modulesConfig, setModulesConfig: saveModulesConfig, isModuleEnabled, moveModule }
}
