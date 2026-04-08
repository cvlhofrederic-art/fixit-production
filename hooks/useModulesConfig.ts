import { useState, useEffect, useMemo, useCallback } from 'react'

export type ModuleConfig = { id: string; enabled: boolean; order: number }
export type ModuleDef = { id: string; icon: string; label: string; description: string; category: string; locked?: boolean }
export type CategoryDef = { id: string; label: string; icon: string; order: number }

// ── Categories matching the V5 BTP Pro sidebar (exact order) ──
const CATEGORIES_DEFAULT: CategoryDef[] = [
  { id: 'pilotage', label: 'Pilotage', icon: '🎯', order: 0 },
  { id: 'chantiers', label: 'Chantiers', icon: '🏗️', order: 1 },
  { id: 'commercial', label: 'Commercial', icon: '💼', order: 2 },
  { id: 'facturation', label: 'Facturation', icon: '💳', order: 3 },
  { id: 'sous_traitance', label: 'Sous-traitance & Achats', icon: '🤝', order: 4 },
  { id: 'finances', label: 'Finances', icon: '💰', order: 5 },
  { id: 'communication', label: 'Communication', icon: '💬', order: 6 },
  { id: 'administration', label: 'Administration', icon: '📂', order: 7 },
  { id: 'vitrine', label: 'Vitrine', icon: '🖼️', order: 8 },
]

export function useModulesConfig(artisanId: string | undefined, t: (key: string, fallback?: string) => string) {
  // ── ALL_MODULES — matches V5 BTP Pro sidebar order exactly ──
  const ALL_MODULES: ModuleDef[] = useMemo(() => [
    // ── Pilotage ──
    { id: 'home', icon: '📊', label: t('proDash.modules.home', 'Tableau de bord'), description: 'Vue d\'ensemble de l\'activité', category: 'pilotage', locked: true },
    { id: 'gestion_comptes', icon: '👥', label: 'Comptes utilisateurs', description: 'Gérants, conducteurs, chefs de chantier', category: 'pilotage' },
    { id: 'stats', icon: '📈', label: t('proDash.modules.stats', 'Statistiques'), description: t('proDash.modules.statsDesc', 'Analyse de performance'), category: 'pilotage' },
    { id: 'revenus', icon: '💰', label: t('proDash.modules.revenue', 'Revenus'), description: t('proDash.modules.revenueDesc', 'Suivi du chiffre d\'affaires'), category: 'pilotage' },
    // ── Chantiers ──
    { id: 'chantiers', icon: '🏗️', label: 'Chantiers', description: 'Gestion des chantiers en cours', category: 'chantiers' },
    { id: 'gantt', icon: '📊', label: 'Planification Gantt', description: 'Planning visuel des chantiers', category: 'chantiers' },
    { id: 'equipes', icon: '👷', label: 'Équipes', description: 'Gestion des équipes terrain', category: 'chantiers' },
    { id: 'pointage', icon: '⏱️', label: 'Pointage équipes', description: 'Pointage GPS temps réel', category: 'chantiers' },
    { id: 'calendar', icon: '📅', label: t('proDash.modules.calendar', 'Agenda / Planning'), description: t('proDash.modules.calendarDesc', 'Rendez-vous et planning'), category: 'chantiers' },
    { id: 'meteo', icon: '🌤️', label: 'Météo chantiers', description: 'Prévisions météo par chantier', category: 'chantiers' },
    { id: 'photos_chantier', icon: '📸', label: 'Photos Chantier', description: 'Suivi photo des chantiers', category: 'chantiers' },
    { id: 'rapports', icon: '📋', label: t('proDash.modules.reports', 'Rapports de chantier'), description: t('proDash.modules.reportsDesc', 'Rapports journaliers et hebdomadaires'), category: 'chantiers' },
    // ── Commercial ──
    { id: 'pipeline', icon: '📊', label: 'Pipeline', description: 'Suivi commercial des devis', category: 'commercial' },
    { id: 'devis', icon: '📄', label: t('proDash.modules.quotes', 'Devis'), description: t('proDash.modules.quotesDesc', 'Création et envoi de devis'), category: 'commercial' },
    { id: 'dpgf', icon: '📁', label: 'Appels d\'offres / DPGF', description: 'Réponse aux appels d\'offres', category: 'commercial' },
    { id: 'marches', icon: '📢', label: t('proDash.modules.marches', 'Bourse aux Marchés'), description: t('proDash.modules.marchesDesc', 'Appels d\'offres et candidatures'), category: 'commercial' },
    // ── Facturation ──
    { id: 'factures', icon: '💳', label: t('proDash.modules.invoices', 'Factures'), description: t('proDash.modules.invoicesDesc', 'Facturation et suivi paiements'), category: 'facturation' },
    { id: 'situations', icon: '📈', label: 'Situations de travaux', description: 'Avancement et facturation progressive', category: 'facturation' },
    { id: 'garanties', icon: '🔒', label: 'Retenues de garantie', description: 'Suivi des retenues 5%', category: 'facturation' },
    // ── Sous-traitance & Achats ──
    { id: 'sous_traitance', icon: '🤝', label: 'Sous-traitance DC4', description: 'Formulaires DC4 réglementaires', category: 'sous_traitance' },
    { id: 'sous_traitance_offres', icon: '🔍', label: 'Recruter sous-traitants', description: 'Recherche de sous-traitants', category: 'sous_traitance' },
    { id: 'rfq_btp', icon: '📋', label: 'Devis Fournisseurs', description: 'Demandes de prix fournisseurs', category: 'sous_traitance' },
    { id: 'materiaux', icon: '🧱', label: t('proDash.modules.materials', 'Matériaux & Appro'), description: t('proDash.modules.materialsDesc', 'Approvisionnement et prix'), category: 'sous_traitance' },
    { id: 'marketplace_btp', icon: '🏪', label: 'Marketplace BTP', description: 'Achats entre professionnels', category: 'sous_traitance' },
    // ── Finances ──
    { id: 'compta_btp', icon: '🧠', label: 'Compta Intelligente', description: 'Comptabilité assistée par IA', category: 'finances' },
    { id: 'rentabilite', icon: '💰', label: 'Rentabilité Chantier', description: 'Budget prévu vs réalisé', category: 'finances' },
    { id: 'comptabilite', icon: '🧮', label: t('proDash.modules.accounting', 'Comptabilité'), description: t('proDash.modules.accountingDesc', 'Revenus, dépenses, TVA'), category: 'finances' },
    // ── Communication ──
    { id: 'messages', icon: '💬', label: t('proDash.modules.messaging', 'Messagerie'), description: t('proDash.modules.messagingDesc', 'Messages clients et équipes'), category: 'communication' },
    { id: 'clients', icon: '👥', label: t('proDash.modules.clients', 'Base clients'), description: t('proDash.modules.clientsDesc', 'Gestion des contacts clients'), category: 'communication' },
    { id: 'portail_client', icon: '🌐', label: 'Portail client', description: 'Accès chantier pour les clients', category: 'communication' },
    // ── Administration ──
    { id: 'wallet', icon: '📁', label: t('proDash.modules.wallet', 'Conformité'), description: t('proDash.modules.walletDesc', 'Documents réglementaires'), category: 'administration' },
    { id: 'contrats', icon: '📑', label: t('proDash.modules.contracts', 'Contrats'), description: t('proDash.modules.contractsDesc', 'Gestion des contrats'), category: 'administration' },
    { id: 'bibliotheque', icon: '📚', label: 'Bibliothèque', description: 'Ouvrages, matériaux et main-d\'œuvre', category: 'administration' },
    { id: 'motifs', icon: '🗂️', label: t('proDash.modules.motifs', 'Lots / Prestations'), description: t('proDash.modules.motifsDesc', 'Types de prestations'), category: 'administration' },
    { id: 'horaires', icon: '⏱️', label: t('proDash.modules.hours', 'Horaires chantier'), description: t('proDash.modules.hoursDesc', 'Plages horaires par jour'), category: 'administration' },
    // ── Vitrine ──
    { id: 'portfolio', icon: '🖼️', label: t('proDash.modules.portfolio', 'Références chantiers'), description: t('proDash.modules.portfolioDesc', 'Galerie de réalisations'), category: 'vitrine' },
    { id: 'parrainage', icon: '🎁', label: 'Parrainage', description: 'Parrainez des artisans, gagnez des mois gratuits', category: 'vitrine' },
    // ── Compte (locked) ──
    { id: 'settings', icon: '⚙️', label: t('proDash.modules.settings', 'Mon profil'), description: t('proDash.modules.settingsDesc', 'Paramètres du compte'), category: 'compte', locked: true },
  ], [t])

  const MODULES_STORAGE_KEY = useMemo(() => `fixit_modules_config_${artisanId || 'default'}`, [artisanId])
  const CATEGORIES_STORAGE_KEY = useMemo(() => `fixit_categories_order_${artisanId || 'default'}`, [artisanId])

  const [modulesConfig, setModulesConfig] = useState<ModuleConfig[]>([])
  const [categoriesOrder, setCategoriesOrder] = useState<CategoryDef[]>(CATEGORIES_DEFAULT)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // Load modules config
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
    // Load categories order
    try {
      const savedCats = JSON.parse(localStorage.getItem(CATEGORIES_STORAGE_KEY) || '[]')
      if (savedCats.length > 0) {
        // Merge with defaults (in case new categories were added)
        const merged = CATEGORIES_DEFAULT.map(c => {
          const s = savedCats.find((x: CategoryDef) => x.id === c.id)
          return s ? { ...c, order: s.order } : c
        }).sort((a, b) => a.order - b.order)
        setCategoriesOrder(merged)
      }
    } catch {
      // keep default
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artisanId])

  const saveModulesConfig = useCallback((config: ModuleConfig[]) => {
    setModulesConfig(config)
    try { localStorage.setItem(MODULES_STORAGE_KEY, JSON.stringify(config)) } catch {}
  }, [MODULES_STORAGE_KEY])

  const saveCategoriesOrder = useCallback((cats: CategoryDef[]) => {
    setCategoriesOrder(cats)
    try { localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(cats)) } catch {}
  }, [CATEGORIES_STORAGE_KEY])

  const isModuleEnabled = useCallback((moduleId: string): boolean => {
    if (modulesConfig.length === 0) return true
    const m = modulesConfig.find(x => x.id === moduleId)
    return m ? m.enabled : true
  }, [modulesConfig])

  const moveModule = useCallback((moduleId: string, direction: 'up' | 'down') => {
    const sorted = [...modulesConfig].sort((a, b) => a.order - b.order)
    const idx = sorted.findIndex(x => x.id === moduleId)
    if (idx < 0) return
    // Find next/prev module in the SAME category
    const mod = ALL_MODULES.find(m => m.id === moduleId)
    if (!mod) return
    const sameCatModules = sorted.filter(s => {
      const def = ALL_MODULES.find(m => m.id === s.id)
      return def?.category === mod.category
    })
    const catIdx = sameCatModules.findIndex(x => x.id === moduleId)
    const swapCatIdx = direction === 'up' ? catIdx - 1 : catIdx + 1
    if (swapCatIdx < 0 || swapCatIdx >= sameCatModules.length) return
    // Swap orders
    const globalIdx = sorted.findIndex(x => x.id === moduleId)
    const globalSwapIdx = sorted.findIndex(x => x.id === sameCatModules[swapCatIdx].id)
    const temp = sorted[globalIdx].order
    sorted[globalIdx] = { ...sorted[globalIdx], order: sorted[globalSwapIdx].order }
    sorted[globalSwapIdx] = { ...sorted[globalSwapIdx], order: temp }
    saveModulesConfig(sorted)
  }, [modulesConfig, ALL_MODULES, saveModulesConfig])

  // Move a module to a specific position (1-based) within its category
  const reorderModuleTo = useCallback((moduleId: string, newPos: number) => {
    const mod = ALL_MODULES.find(m => m.id === moduleId)
    if (!mod) return
    const sorted = [...modulesConfig].sort((a, b) => a.order - b.order)
    const sameCat = sorted.filter(s => {
      const def = ALL_MODULES.find(m => m.id === s.id)
      return def?.category === mod.category
    })
    const currentIdx = sameCat.findIndex(x => x.id === moduleId)
    if (currentIdx < 0) return
    const targetIdx = Math.max(0, Math.min(newPos - 1, sameCat.length - 1))
    if (targetIdx === currentIdx) return
    // Remove from current position and insert at target
    const item = sameCat.splice(currentIdx, 1)[0]
    sameCat.splice(targetIdx, 0, item)
    // Reassign orders based on new positions
    const orderMap = new Map<string, number>()
    sameCat.forEach((s, i) => orderMap.set(s.id, i))
    const updated = sorted.map(s => {
      const newOrder = orderMap.get(s.id)
      return newOrder !== undefined ? { ...s, order: newOrder } : s
    })
    saveModulesConfig(updated)
  }, [modulesConfig, ALL_MODULES, saveModulesConfig])

  // Move a category to a specific position (1-based)
  const reorderCategoryTo = useCallback((catId: string, newPos: number) => {
    const sorted = [...categoriesOrder].sort((a, b) => a.order - b.order)
    const currentIdx = sorted.findIndex(x => x.id === catId)
    if (currentIdx < 0) return
    const targetIdx = Math.max(0, Math.min(newPos - 1, sorted.length - 1))
    if (targetIdx === currentIdx) return
    const item = sorted.splice(currentIdx, 1)[0]
    sorted.splice(targetIdx, 0, item)
    sorted.forEach((c, i) => { c.order = i })
    saveCategoriesOrder(sorted)
  }, [categoriesOrder, saveCategoriesOrder])

  const moveCategory = useCallback((catId: string, direction: 'up' | 'down') => {
    const sorted = [...categoriesOrder].sort((a, b) => a.order - b.order)
    const idx = sorted.findIndex(x => x.id === catId)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const temp = sorted[idx].order
    sorted[idx] = { ...sorted[idx], order: sorted[swapIdx].order }
    sorted[swapIdx] = { ...sorted[swapIdx], order: temp }
    saveCategoriesOrder(sorted)
  }, [categoriesOrder, saveCategoriesOrder])

  return {
    ALL_MODULES,
    modulesConfig,
    setModulesConfig: saveModulesConfig,
    isModuleEnabled,
    moveModule,
    categoriesOrder,
    saveCategoriesOrder,
    moveCategory,
    reorderModuleTo,
    reorderCategoryTo,
    CATEGORIES_DEFAULT,
  }
}
