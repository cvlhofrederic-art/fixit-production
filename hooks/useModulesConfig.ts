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

export function useModulesConfig(artisanId: string | undefined, t: (key: string, fallback?: string) => string, isPt = false) {
  // ── ALL_MODULES — matches V5 BTP Pro sidebar order exactly ──
  const ALL_MODULES: ModuleDef[] = useMemo(() => [
    // ── Pilotage ──
    { id: 'home', icon: '📊', label: isPt ? 'Painel' : 'Tableau de bord', description: isPt ? 'Visão geral da atividade' : 'Vue d\'ensemble de l\'activité', category: 'pilotage', locked: true },
    { id: 'gestion_comptes', icon: '👥', label: isPt ? 'Contas de utilizadores' : 'Comptes utilisateurs', description: isPt ? 'Gerentes, encarregados, chefes de obra' : 'Gérants, conducteurs, chefs de chantier', category: 'pilotage' },
    { id: 'stats', icon: '📈', label: isPt ? 'Estatísticas' : 'Statistiques', description: isPt ? 'Análise de desempenho' : 'Analyse de performance', category: 'pilotage' },
    { id: 'revenus', icon: '💰', label: isPt ? 'Receitas' : 'Revenus', description: isPt ? 'Acompanhamento do volume de negócios' : 'Suivi du chiffre d\'affaires', category: 'pilotage' },
    // ── Chantiers ──
    { id: 'chantiers', icon: '🏗️', label: isPt ? 'Obras' : 'Chantiers', description: isPt ? 'Gestão das obras em curso' : 'Gestion des chantiers en cours', category: 'chantiers' },
    { id: 'gantt', icon: '📊', label: isPt ? 'Planeamento Gantt' : 'Planification Gantt', description: isPt ? 'Planeamento visual das obras' : 'Planning visuel des chantiers', category: 'chantiers' },
    { id: 'equipes', icon: '👷', label: isPt ? 'Equipas' : 'Équipes', description: isPt ? 'Gestão das equipas no terreno' : 'Gestion des équipes terrain', category: 'chantiers' },
    { id: 'pointage', icon: '⏱️', label: isPt ? 'Marcação de horas' : 'Pointage équipes', description: isPt ? 'Marcação GPS em tempo real' : 'Pointage GPS temps réel', category: 'chantiers' },
    { id: 'calendar', icon: '📅', label: isPt ? 'Agenda' : 'Agenda / Planning', description: isPt ? 'Marcações e planeamento' : 'Rendez-vous et planning', category: 'chantiers' },
    { id: 'meteo', icon: '🌤️', label: isPt ? 'Meteorologia' : 'Météo chantiers', description: isPt ? 'Previsão meteorológica por obra' : 'Prévisions météo par chantier', category: 'chantiers' },
    { id: 'photos_chantier', icon: '📸', label: isPt ? 'Fotos de obra' : 'Photos Chantier', description: isPt ? 'Acompanhamento fotográfico das obras' : 'Suivi photo des chantiers', category: 'chantiers' },
    { id: 'rapports', icon: '📋', label: isPt ? 'Relatórios de obra' : 'Rapports de chantier', description: isPt ? 'Relatórios diários e semanais' : 'Rapports journaliers et hebdomadaires', category: 'chantiers' },
    // ── Commercial ──
    { id: 'pipeline', icon: '📊', label: 'Pipeline', description: isPt ? 'Acompanhamento comercial dos orçamentos' : 'Suivi commercial des devis', category: 'commercial' },
    { id: 'devis', icon: '📄', label: isPt ? 'Orçamentos' : 'Devis', description: isPt ? 'Criação e envio de orçamentos' : 'Création et envoi de devis', category: 'commercial' },
    { id: 'dpgf', icon: '📁', label: isPt ? 'Concursos / DPGF' : 'Appels d\'offres / DPGF', description: isPt ? 'Resposta a concursos públicos' : 'Réponse aux appels d\'offres', category: 'commercial' },
    { id: 'marches', icon: '📢', label: isPt ? 'Bolsa de Mercados' : 'Bourse aux Marchés', description: isPt ? 'Concursos e candidaturas' : 'Appels d\'offres et candidatures', category: 'commercial' },
    // ── Facturation ──
    { id: 'factures', icon: '💳', label: isPt ? 'Faturas' : 'Factures', description: isPt ? 'Faturação e acompanhamento de pagamentos' : 'Facturation et suivi paiements', category: 'facturation' },
    { id: 'situations', icon: '📈', label: isPt ? 'Situações de obra' : 'Situations de travaux', description: isPt ? 'Avanço e faturação progressiva' : 'Avancement et facturation progressive', category: 'facturation' },
    { id: 'garanties', icon: '🔒', label: isPt ? 'Retenções de garantia' : 'Retenues de garantie', description: isPt ? 'Acompanhamento das retenções 5%' : 'Suivi des retenues 5%', category: 'facturation' },
    // ── Sous-traitance & Achats ──
    { id: 'sous_traitance', icon: '🤝', label: isPt ? 'Subempreitada DC4' : 'Sous-traitance DC4', description: isPt ? 'Formulários DC4 regulamentares' : 'Formulaires DC4 réglementaires', category: 'sous_traitance' },
    { id: 'sous_traitance_offres', icon: '🔍', label: isPt ? 'Recrutar subempreiteiros' : 'Recruter sous-traitants', description: isPt ? 'Pesquisa de subempreiteiros' : 'Recherche de sous-traitants', category: 'sous_traitance' },
    { id: 'rfq_btp', icon: '📋', label: isPt ? 'Orçamentos Fornecedores' : 'Devis Fournisseurs', description: isPt ? 'Pedidos de preço a fornecedores' : 'Demandes de prix fournisseurs', category: 'sous_traitance' },
    { id: 'materiaux', icon: '🧱', label: isPt ? 'Materiais & Aprovisionamento' : 'Matériaux & Appro', description: isPt ? 'Aprovisionamento e preços' : 'Approvisionnement et prix', category: 'sous_traitance' },
    { id: 'marketplace_btp', icon: '🏪', label: 'Marketplace BTP', description: isPt ? 'Compras entre profissionais' : 'Achats entre professionnels', category: 'sous_traitance' },
    // ── Finances ──
    { id: 'compta_btp', icon: '🧠', label: isPt ? 'Contabilidade IA' : 'Compta Intelligente', description: isPt ? 'Contabilidade assistida por IA' : 'Comptabilité assistée par IA', category: 'finances' },
    { id: 'rentabilite', icon: '💰', label: isPt ? 'Rentabilidade' : 'Rentabilité Chantier', description: isPt ? 'Orçamento previsto vs realizado' : 'Budget prévu vs réalisé', category: 'finances' },
    { id: 'comptabilite', icon: '🧮', label: isPt ? 'Contabilidade' : 'Comptabilité', description: isPt ? 'Receitas, despesas, IVA' : 'Revenus, dépenses, TVA', category: 'finances' },
    // ── Communication ──
    { id: 'messages', icon: '💬', label: isPt ? 'Mensagens' : 'Messagerie', description: isPt ? 'Mensagens com clientes e equipas' : 'Messages clients et équipes', category: 'communication' },
    { id: 'clients', icon: '👥', label: isPt ? 'Clientes' : 'Base clients', description: isPt ? 'Gestão de contactos de clientes' : 'Gestion des contacts clients', category: 'communication' },
    { id: 'portail_client', icon: '🌐', label: isPt ? 'Portal cliente' : 'Portail client', description: isPt ? 'Acesso à obra para os clientes' : 'Accès chantier pour les clients', category: 'communication' },
    // ── Administration ──
    { id: 'wallet', icon: '📁', label: isPt ? 'Conformidade' : 'Conformité', description: isPt ? 'Documentos regulamentares' : 'Documents réglementaires', category: 'administration' },
    { id: 'contrats', icon: '📑', label: isPt ? 'Contratos' : 'Contrats', description: isPt ? 'Gestão de contratos' : 'Gestion des contrats', category: 'administration' },
    { id: 'bibliotheque', icon: '📚', label: isPt ? 'Biblioteca' : 'Bibliothèque', description: isPt ? 'Obras, materiais e mão de obra' : 'Ouvrages, matériaux et main-d\'œuvre', category: 'administration' },
    { id: 'motifs', icon: '🗂️', label: isPt ? 'Prestações' : 'Prestations', description: isPt ? 'Tipos de prestações' : 'Types de prestations', category: 'administration' },
    { id: 'horaires', icon: '⏱️', label: isPt ? 'Horários de obra' : 'Horaires chantier', description: isPt ? 'Horários por dia' : 'Plages horaires par jour', category: 'administration' },
    // ── Vitrine ──
    { id: 'portfolio', icon: '🖼️', label: isPt ? 'Referências de obra' : 'Références chantiers', description: isPt ? 'Galeria de realizações' : 'Galerie de réalisations', category: 'vitrine' },
    { id: 'parrainage', icon: '🎁', label: isPt ? 'Apadrinhamento' : 'Parrainage', description: isPt ? 'Apadrinhe artesãos, ganhe meses grátis' : 'Parrainez des artisans, gagnez des mois gratuits', category: 'vitrine' },
    // ── Compte (locked) ──
    { id: 'settings', icon: '⚙️', label: isPt ? 'O meu perfil' : 'Mon profil', description: isPt ? 'Definições da conta' : 'Paramètres du compte', category: 'compte', locked: true },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [isPt])

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
