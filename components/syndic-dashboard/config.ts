// ══════════════════════════════════════════════════════════════════════════════
// Syndic Dashboard — Static Configuration
// ══════════════════════════════════════════════════════════════════════════════
// Role-based access control (RBAC) and module definitions.
// Extracted from page.tsx for maintainability.
// ══════════════════════════════════════════════════════════════════════════════

import type { Page } from './types'

// ── Pages accessibles par rôle ────────────────────────────────────────────────
// Principe : chaque module uniquement pour le poste où il a du sens métier
export const ROLE_PAGES: Record<string, Page[]> = {
  // Directeur / Propriétaire du cabinet — accès total
  syndic: ['accueil', 'immeubles', 'coproprios', 'artisans', 'missions', 'canal', 'planning', 'pointage', 'docs_interventions', 'comptabilite_tech', 'analyse_devis', 'reglementaire', 'rapport', 'documents', 'facturation', 'compta_copro', 'ag_digitale', 'impayés', 'carnet_entretien', 'sinistres', 'extranet', 'pppt', 'historique_immeuble', 'urgences', 'dpe_collectif', 'visite_technique', 'declaracao_encargos', 'seguro_condominio', 'fundo_reserva', 'alertes', 'emails', 'ia', 'equipe', 'parametres', 'echéances', 'recouvrement', 'preparateur_ag', 'modules', 'votacao_online', 'portal_condomino', 'pagamentos_digitais', 'carregamento_ve', 'reserva_espacos', 'ocorrencias', 'enquetes', 'quadro_avisos', 'atas_ia', 'mapa_quotas', 'orcamentos_obras', 'cobranca_judicial', 'monitorizacao_consumos', 'whatsapp_condominos', 'arquivo_digital', 'vote_correspondance', 'extranet_enrichi', 'irve_bornes', 'saisie_ia_factures', 'reservation_espaces_fr', 'signalements_fr', 'sondages_fr', 'panneau_affichage', 'pv_assemblee_ia', 'appels_fonds', 'mise_en_concurrence', 'recouvrement_enrichi_fr', 'suivi_energetique_fr', 'communication_demat', 'ged_certifiee', 'obrigacoes_legais', 'relatorio_gestao', 'preparador_assembleia', 'plano_manutencao', 'certificacao_energetica', 'vistoria_tecnica', 'pontuacao_saude', 'orcamento_anual_ia', 'contacto_proativo_ia', 'ocorrencias_ia', 'gestao_seguros', 'checklists_ia', 'processamentos_lote', 'ag_live_digital', 'marketplace_artisans', 'predicao_manutencao', 'qrcode_fracao', 'dashboard_condomino_rt', 'comparador_energia', 'assinatura_cmd', 'dashboard_multi_immeubles', 'efatura_at'],
  // Administrateur cabinet — accès large (sauf terrain/pointage)
  syndic_admin: ['accueil', 'immeubles', 'coproprios', 'artisans', 'missions', 'canal', 'planning', 'docs_interventions', 'comptabilite_tech', 'reglementaire', 'rapport', 'documents', 'facturation', 'compta_copro', 'ag_digitale', 'impayés', 'analyse_devis', 'carnet_entretien', 'sinistres', 'extranet', 'pppt', 'historique_immeuble', 'urgences', 'dpe_collectif', 'visite_technique', 'declaracao_encargos', 'seguro_condominio', 'fundo_reserva', 'alertes', 'emails', 'ia', 'equipe', 'parametres', 'echéances', 'recouvrement', 'preparateur_ag', 'modules', 'votacao_online', 'portal_condomino', 'pagamentos_digitais', 'carregamento_ve', 'reserva_espacos', 'ocorrencias', 'enquetes', 'quadro_avisos', 'atas_ia', 'mapa_quotas', 'orcamentos_obras', 'cobranca_judicial', 'monitorizacao_consumos', 'whatsapp_condominos', 'arquivo_digital', 'vote_correspondance', 'extranet_enrichi', 'irve_bornes', 'saisie_ia_factures', 'reservation_espaces_fr', 'signalements_fr', 'sondages_fr', 'panneau_affichage', 'pv_assemblee_ia', 'appels_fonds', 'mise_en_concurrence', 'recouvrement_enrichi_fr', 'suivi_energetique_fr', 'communication_demat', 'ged_certifiee', 'obrigacoes_legais', 'relatorio_gestao', 'preparador_assembleia', 'plano_manutencao', 'certificacao_energetica', 'vistoria_tecnica', 'pontuacao_saude', 'orcamento_anual_ia', 'contacto_proativo_ia', 'ocorrencias_ia', 'gestao_seguros', 'checklists_ia', 'processamentos_lote', 'ag_live_digital', 'marketplace_artisans', 'predicao_manutencao', 'qrcode_fracao', 'dashboard_condomino_rt', 'comparador_energia', 'assinatura_cmd', 'dashboard_multi_immeubles', 'efatura_at'],
  // Gestionnaire Technique — terrain, équipements, maintenance, interventions
  syndic_tech: ['accueil', 'missions', 'planning', 'pointage', 'canal', 'immeubles', 'artisans', 'coproprios', 'docs_interventions', 'comptabilite_tech', 'analyse_devis', 'facturation', 'documents', 'carnet_entretien', 'sinistres', 'pppt', 'historique_immeuble', 'urgences', 'dpe_collectif', 'visite_technique', 'declaracao_encargos', 'seguro_condominio', 'fundo_reserva', 'alertes', 'emails', 'ia', 'parametres', 'modules', 'ocorrencias', 'carregamento_ve', 'monitorizacao_consumos', 'signalements_fr', 'irve_bornes', 'suivi_energetique_fr', 'plano_manutencao', 'certificacao_energetica', 'vistoria_tecnica', 'pontuacao_saude', 'orcamento_anual_ia', 'contacto_proativo_ia', 'ocorrencias_ia', 'gestao_seguros', 'checklists_ia', 'processamentos_lote', 'ag_live_digital', 'marketplace_artisans', 'predicao_manutencao', 'qrcode_fracao', 'dashboard_condomino_rt', 'comparador_energia', 'assinatura_cmd', 'dashboard_multi_immeubles', 'efatura_at'],
  // Secrétaire — coordination, AG, copropriétaires, planning, communication
  syndic_secretaire: ['accueil', 'coproprios', 'immeubles', 'artisans', 'missions', 'canal', 'planning', 'rapport', 'documents', 'extranet', 'ag_digitale', 'sinistres', 'carnet_entretien', 'urgences', 'declaracao_encargos', 'preparateur_ag', 'alertes', 'emails', 'ia', 'parametres', 'modules', 'votacao_online', 'portal_condomino', 'enquetes', 'quadro_avisos', 'atas_ia', 'whatsapp_condominos', 'reserva_espacos', 'vote_correspondance', 'extranet_enrichi', 'sondages_fr', 'panneau_affichage', 'pv_assemblee_ia', 'communication_demat', 'reservation_espaces_fr', 'relatorio_gestao', 'preparador_assembleia'],
  // Gestionnaire Copropriété — pilotage complet de la copropriété
  syndic_gestionnaire: ['accueil', 'immeubles', 'coproprios', 'artisans', 'missions', 'canal', 'planning', 'reglementaire', 'rapport', 'alertes', 'documents', 'docs_interventions', 'comptabilite_tech', 'facturation', 'compta_copro', 'impayés', 'analyse_devis', 'carnet_entretien', 'extranet', 'sinistres', 'recouvrement', 'pppt', 'historique_immeuble', 'urgences', 'dpe_collectif', 'visite_technique', 'declaracao_encargos', 'seguro_condominio', 'fundo_reserva', 'ag_digitale', 'emails', 'ia', 'parametres', 'echéances', 'preparateur_ag', 'modules', 'votacao_online', 'portal_condomino', 'pagamentos_digitais', 'carregamento_ve', 'reserva_espacos', 'ocorrencias', 'enquetes', 'quadro_avisos', 'atas_ia', 'mapa_quotas', 'orcamentos_obras', 'cobranca_judicial', 'monitorizacao_consumos', 'whatsapp_condominos', 'arquivo_digital', 'vote_correspondance', 'extranet_enrichi', 'irve_bornes', 'saisie_ia_factures', 'reservation_espaces_fr', 'signalements_fr', 'sondages_fr', 'panneau_affichage', 'pv_assemblee_ia', 'appels_fonds', 'mise_en_concurrence', 'recouvrement_enrichi_fr', 'suivi_energetique_fr', 'communication_demat', 'ged_certifiee', 'obrigacoes_legais', 'relatorio_gestao', 'preparador_assembleia', 'plano_manutencao', 'certificacao_energetica', 'vistoria_tecnica', 'pontuacao_saude', 'orcamento_anual_ia', 'contacto_proativo_ia', 'ocorrencias_ia', 'gestao_seguros', 'checklists_ia', 'processamentos_lote', 'ag_live_digital', 'marketplace_artisans', 'predicao_manutencao', 'qrcode_fracao', 'dashboard_condomino_rt', 'comparador_energia', 'assinatura_cmd', 'dashboard_multi_immeubles', 'efatura_at'],
  // Comptable — finances, comptabilité copro, impayés
  syndic_comptable: ['accueil', 'immeubles', 'coproprios', 'artisans', 'facturation', 'compta_copro', 'impayés', 'analyse_devis', 'rapport', 'documents', 'sinistres', 'declaracao_encargos', 'fundo_reserva', 'alertes', 'emails', 'ia', 'parametres', 'echéances', 'recouvrement', 'modules', 'pagamentos_digitais', 'mapa_quotas', 'cobranca_judicial', 'saisie_ia_factures', 'appels_fonds', 'recouvrement_enrichi_fr', 'obrigacoes_legais', 'relatorio_gestao', 'orcamento_anual_ia', 'contacto_proativo_ia', 'ocorrencias_ia', 'gestao_seguros', 'checklists_ia', 'processamentos_lote', 'ag_live_digital', 'marketplace_artisans', 'predicao_manutencao', 'qrcode_fracao', 'dashboard_condomino_rt', 'comparador_energia', 'assinatura_cmd', 'dashboard_multi_immeubles', 'efatura_at'],
  // Juriste — contentieux, recouvrement, sinistres, AG, conformité
  syndic_juriste: ['accueil', 'immeubles', 'coproprios', 'artisans', 'missions', 'documents', 'sinistres', 'impayés', 'recouvrement', 'ag_digitale', 'preparateur_ag', 'reglementaire', 'rapport', 'alertes', 'emails', 'ia', 'parametres', 'echéances', 'modules', 'cobranca_judicial', 'recouvrement_enrichi_fr', 'obrigacoes_legais', 'vote_correspondance', 'pv_assemblee_ia', 'atas_ia', 'seguro_condominio', 'ged_certifiee', 'relatorio_gestao', 'preparador_assembleia'],
}

// ── Module definitions ────────────────────────────────────────────────────────
export const SYNDIC_MODULES = [
  // ── Modules communs (FR + PT) ──
  { key: 'missions', label: 'Ordres de mission', icon: '📋', description: 'Créer et suivre les interventions', default: true },
  { key: 'pointage', label: 'Pointage Terrain', icon: '📍', description: 'Contrôle GPS des interventions', default: true },
  { key: 'canal', label: 'Canal Communications', icon: '💬', description: 'Messagerie interne et avec artisans', default: true },
  { key: 'planning', label: 'Planning', icon: '📅', description: 'Vue calendrier des interventions', default: true },
  { key: 'docs_interventions', label: 'Documents Interventions', icon: '🗂️', description: 'Rapports et preuves d\'intervention', default: true },
  { key: 'comptabilite_tech', label: 'Comptabilité Technique', icon: '📊', description: 'Suivi financier des interventions', default: true },
  { key: 'analyse_devis', label: 'Analyse Devis/Factures', icon: '🔍', description: 'Comparaison et validation des devis', default: true },
  { key: 'facturation', label: 'Facturation', icon: '💶', description: 'Gestion des factures', default: true },
  { key: 'compta_copro', label: 'Comptabilité Copro', icon: '💶', description: 'Comptabilité de la copropriété', default: true },
  { key: 'ag_digitale', label: 'AG Digitales', icon: '🏛️', description: 'Assemblées générales en ligne', default: true },
  { key: 'impayés', label: 'Impayés', icon: '⚠️', description: 'Suivi et relance des impayés', default: true },
  { key: 'carnet_entretien', label: 'Carnet d\'Entretien', icon: '📖', description: 'Historique technique · Équipements · Contrats', default: true },
  { key: 'sinistres', label: 'Sinistres', icon: '🚨', description: 'Pipeline de gestion des sinistres', default: false },
  { key: 'extranet', label: 'Extranet Copros', icon: '👥', description: 'Portail copropriétaires · Demandes d\'intervention', default: true },
  { key: 'recouvrement', label: 'Recouvrement auto', icon: '💸', description: 'Procédure automatisée de recouvrement', default: false },
  { key: 'historique_immeuble', label: 'Historique Immeuble', icon: '🏛️', description: 'Vue consolidée par immeuble — interventions, équipements, contrats', default: false },
  { key: 'urgences', label: 'Urgences Techniques', icon: '🚨', description: 'Dispatch immédiat vers l\'artisan VITFIX disponible', default: true },
  { key: 'emails', label: 'Emails Fixy', icon: '📧', description: 'Gestion des emails avec IA', default: true },
  { key: 'ia', label: 'Max Expert', icon: '🎓', description: 'Expert-conseil IA copropriété', default: true },
  // ── Modules FR uniquement ──
  { key: 'reglementaire', label: 'Calendrier réglementaire', icon: '⚖️', description: 'Obligations légales et échéances', default: false, locale: 'fr' as const },
  { key: 'rapport', label: 'Rapport mensuel', icon: '📄', description: 'Rapports d\'activité automatisés', default: false, locale: 'fr' as const },
  { key: 'echéances', label: 'Échéances légales', icon: '📅', description: 'Rappels des échéances réglementaires', default: false, locale: 'fr' as const },
  { key: 'preparateur_ag', label: 'Préparateur AG', icon: '📝', description: 'Préparer les assemblées générales', default: false, locale: 'fr' as const },
  { key: 'pppt', label: 'Plan Pluriannuel de Travaux', icon: '🏗️', description: 'PPPT — obligation légale 2025 · Planification 10 ans', default: true, locale: 'fr' as const },
  { key: 'dpe_collectif', label: 'DPE Collectif', icon: '⚡', description: 'Suivi DPE — obligation légale jan. 2026 · Classes A à G', default: true, locale: 'fr' as const },
  { key: 'visite_technique', label: 'Visite Technique', icon: '📋', description: 'Checklist terrain · Rapport PDF pour le conseil syndical', default: false, locale: 'fr' as const },
  { key: 'vote_correspondance', label: 'Vote par correspondance', icon: '🗳️', description: 'Vote par correspondance · Loi ELAN · AG hybride · Vote électronique', default: true, locale: 'fr' as const },
  { key: 'extranet_enrichi', label: 'Extranet enrichi', icon: '🏠', description: 'Extranet conforme décret 2019 · Documents obligatoires · Espace copropriétaire', default: true, locale: 'fr' as const },
  { key: 'irve_bornes', label: 'IRVE / Bornes VE', icon: '🔌', description: 'Droit à la prise · Ordonnance 2020-71 · Prime ADVENIR · Pré-équipement LOM', default: true, locale: 'fr' as const },
  { key: 'saisie_ia_factures', label: 'Saisie IA Factures', icon: '🤖', description: 'OCR intelligent · Extraction auto · Détection anomalies · Classification IA', default: true, locale: 'fr' as const },
  { key: 'reservation_espaces_fr', label: 'Réservation espaces', icon: '📅', description: 'Réservation espaces communs · Calendrier · Règles · Caution', default: true, locale: 'fr' as const },
  { key: 'signalements_fr', label: 'Signalements', icon: '🔧', description: 'Signalement incidents · QR Codes · SLA · Suivi complet', default: true, locale: 'fr' as const },
  { key: 'sondages_fr', label: 'Sondages', icon: '📊', description: 'Sondages copropriétaires · Vote informel · Participation', default: true, locale: 'fr' as const },
  { key: 'panneau_affichage', label: 'Panneau d\'affichage', icon: '📌', description: 'Avis numériques · Communiqués · Notifications copropriétaires', default: true, locale: 'fr' as const },
  { key: 'pv_assemblee_ia', label: 'PV d\'AG assisté IA', icon: '📝', description: 'Génération PV · Calcul majorités art.24/25/26 · Signatures · Notifications', default: true, locale: 'fr' as const },
  { key: 'appels_fonds', label: 'Appels de fonds', icon: '💰', description: 'Appels trimestriels · Tantièmes · Simulateur · Régularisation art. 18-2', default: true, locale: 'fr' as const },
  { key: 'mise_en_concurrence', label: 'Mise en concurrence', icon: '📋', description: 'Comparaison 3 devis obligatoires · Art. 21 loi 1965 · Scoring', default: true, locale: 'fr' as const },
  { key: 'recouvrement_enrichi_fr', label: 'Recouvrement enrichi', icon: '⚖️', description: 'Pipeline judiciaire FR · Art. 19 loi 1965 · Injonction · Hypothèque légale', default: true, locale: 'fr' as const },
  { key: 'suivi_energetique_fr', label: 'Suivi énergétique', icon: '📈', description: 'Consommations · DPE · Loi Climat · MaPrimeRénov\' Copro · PPT', default: false, locale: 'fr' as const },
  { key: 'communication_demat', label: 'Communication démat.', icon: '📱', description: 'Envoi dématérialisé · Loi 2024-322 · Modèles · Envoi groupé', default: false, locale: 'fr' as const },
  { key: 'ged_certifiee', label: 'GED certifiée', icon: '🗄️', description: 'Archive certifiée · SHA-256 · Conformité décret 2019 · Interopérabilité ELAN', default: false, locale: 'fr' as const },
  // ── Modules PT uniquement ──
  { key: 'declaracao_encargos', label: 'Declaração de Encargos', icon: '📜', description: 'Obrigação legal desde 2022 · Declaração para venda de fração', default: true, locale: 'pt' as const },
  { key: 'seguro_condominio', label: 'Seguro Obrigatório', icon: '🛡️', description: 'Seguro contra incêndio obrigatório · Art.º 1429.º CC', default: true, locale: 'pt' as const },
  { key: 'fundo_reserva', label: 'Fundo Comum de Reserva', icon: '🏦', description: 'Mínimo legal 10% · DL 268/94 · Gestão do fundo de reserva', default: true, locale: 'pt' as const },
  { key: 'votacao_online', label: 'Votação Online', icon: '🗳️', description: 'Votação à distância · Lei 8/2022 · Procurações automáticas', default: true, locale: 'pt' as const },
  { key: 'portal_condomino', label: 'Portal do Condómino', icon: '🏠', description: 'Extrato · Recibos · Documentos · Comunicações · Pedidos', default: true, locale: 'pt' as const },
  { key: 'pagamentos_digitais', label: 'Pagamentos Digitais', icon: '💳', description: 'Multibanco · MB Way · SEPA · Reconciliação automática', default: true, locale: 'pt' as const },
  { key: 'carregamento_ve', label: 'Carregamento VE', icon: '⚡', description: 'Postos carregamento elétrico · DL 101-D/2020 · Fundo Ambiental', default: true, locale: 'pt' as const },
  { key: 'reserva_espacos', label: 'Reserva Espaços', icon: '📅', description: 'Reserva de espaços comuns · Calendário · Regras configuráveis', default: true, locale: 'pt' as const },
  { key: 'ocorrencias', label: 'Ocorrências', icon: '🔧', description: 'Gestão de avarias · QR Codes · SLA · Tracking completo', default: true, locale: 'pt' as const },
  { key: 'enquetes', label: 'Enquetes', icon: '📊', description: 'Sondagens e inquéritos · Votação informal · Participação', default: true, locale: 'pt' as const },
  { key: 'quadro_avisos', label: 'Quadro de Avisos', icon: '📌', description: 'Avisos digitais · Comunicados · Notificações condóminos', default: true, locale: 'pt' as const },
  { key: 'atas_ia', label: 'Atas com IA', icon: '📝', description: 'Geração automática de atas · Cálculo maiorias · Assinatura eletrónica', default: true, locale: 'pt' as const },
  { key: 'mapa_quotas', label: 'Mapa de Quotas', icon: '💰', description: 'Cálculo quotas · Permilagem · Simulador · Cobranças trimestrais', default: true, locale: 'pt' as const },
  { key: 'orcamentos_obras', label: '3 Orçamentos Obras', icon: '📋', description: 'Comparação obrigatória 3 orçamentos · Lei 8/2022 · Scoring IA', default: true, locale: 'pt' as const },
  { key: 'cobranca_judicial', label: 'Cobrança Judicial', icon: '⚖️', description: 'Pipeline recouvrement PT · Prazo 90 dias · Injunção · Art.º 310.º CC', default: true, locale: 'pt' as const },
  { key: 'monitorizacao_consumos', label: 'Monitorização Consumos', icon: '📈', description: 'Água · Eletricidade · Gás · Alertas consumo anormal', default: false, locale: 'pt' as const },
  { key: 'whatsapp_condominos', label: 'WhatsApp/SMS', icon: '📱', description: 'Comunicação WhatsApp · SMS · Modelos · Envio em massa', default: false, locale: 'pt' as const },
  { key: 'arquivo_digital', label: 'Arquivo Digital', icon: '🗄️', description: 'Arquivo certificado · SHA-256 · Pesquisa · Retenção legal', default: false, locale: 'pt' as const },
  { key: 'obrigacoes_legais', label: 'Obrigações Legais', icon: '⚖️', description: 'Calendário obrigações · Prazos legais · DL 555/99 · DL 97/2017 · DL 320/2002', default: true, locale: 'pt' as const },
  { key: 'relatorio_gestao', label: 'Relatório de Gestão', icon: '📄', description: 'Relatório anual · Prestação de contas · Art.º 1436.º CC · Lei 8/2022', default: true, locale: 'pt' as const },
  { key: 'preparador_assembleia', label: 'Preparador Assembleia', icon: '📝', description: 'Convocatória · Ordem de trabalhos · Quórums · Procurações · Lei 8/2022', default: true, locale: 'pt' as const },
  { key: 'plano_manutencao', label: 'Plano de Manutenção', icon: '🏗️', description: 'Conservação obrigatória 8 anos · DL 555/99 art. 89.º · Planificação obras', default: true, locale: 'pt' as const },
  { key: 'certificacao_energetica', label: 'Certificação Energética', icon: '⚡', description: 'SCE · Classes A+ a F · DL 101-D/2020 · EPBD 2024 · MEPS', default: true, locale: 'pt' as const },
  { key: 'vistoria_tecnica', label: 'Vistoria Técnica', icon: '📋', description: 'Inspeção gás 5 anos · Elevadores 2-6 anos · Checklist · Relatório PDF', default: true, locale: 'pt' as const },
  { key: 'pontuacao_saude', label: 'Pontuação de Saúde', icon: '🏥', description: 'Score IA 0-100 por edifício · Estado técnico · Finanças · Conformidade · Energia', default: true, locale: 'pt' as const },
  { key: 'orcamento_anual_ia', label: 'Orçamento Anual IA', icon: '🤖', description: 'Geração automática baseada em 3 exercícios · Tendências · Inflação · DL 268/94', default: true, locale: 'pt' as const },
  { key: 'contacto_proativo_ia', label: 'Contacto Proativo IA', icon: '📡', description: 'Comunicação automática condóminos · Cobranças · Avisos · Relatórios · Multi-canal', default: true, locale: 'pt' as const },
  { key: 'ocorrencias_ia', label: 'Ocorrências com IA', icon: '🤖', description: 'Criação automática a partir de texto/foto · Classificação · Priorização · Localização', default: true, locale: 'pt' as const },
  { key: 'gestao_seguros', label: 'Gestão de Seguros', icon: '🛡️', description: 'Apólices por edifício · Coberturas · Alertas expiração · Sinistros · Art.º 1429.º CC', default: true, locale: 'pt' as const },
  { key: 'checklists_ia', label: 'Checklists IA', icon: '📋', description: 'Listas inteligentes · Inspeção mensal · Preparação AG · Entrada/saída · Segurança incêndio', default: true, locale: 'pt' as const },
  { key: 'processamentos_lote', label: 'Processamentos em Lote', icon: '⚙️', description: 'Emissão quotas · Relances automáticas · Encerramento exercício · Recibos · Agendamentos', default: true, locale: 'pt' as const },
  { key: 'ag_live_digital', label: 'AG Live Digital', icon: '🏛️', description: 'Sessão AG em tempo real · Votação instantânea · Controlo presenças · Quórum · Ata automática', default: true, locale: 'pt' as const },
  { key: 'marketplace_artisans', label: 'Marketplace Profissionais', icon: '🏪', description: 'Pesquisa profissionais certificados · Pedidos orçamento · Avaliações · Comparação · Favoritos', default: true, locale: 'pt' as const },
  { key: 'predicao_manutencao', label: 'Predição Manutenção', icon: '🤖', description: 'ML preditivo · Score risco equipamentos · Timeline intervenções · Alertas · Fatores de risco', default: true, locale: 'pt' as const },
  { key: 'qrcode_fracao', label: 'QR Code Fração', icon: '📱', description: 'QR Codes por zona · Signalements via scan · Estatísticas · Geração em lote · Condómino reporter', default: true, locale: 'pt' as const },
  { key: 'dashboard_condomino_rt', label: 'Dashboard Condómino RT', icon: '👥', description: 'Estado tempo real · Barra progresso intervenções · Financeiro · Comunicação · Atividade', default: true, locale: 'pt' as const },
  { key: 'comparador_energia', label: 'Comparador Energia', icon: '⚡', description: 'Comparar tarifas EDP/Galp/Endesa · Simulação poupança · Histórico consumos · Classe energética', default: true, locale: 'pt' as const },
  { key: 'assinatura_cmd', label: 'Assinatura Digital CMD', icon: '✍️', description: 'Chave Móvel Digital · Assinar atas/contratos · Validação · DL 12/2021 · eIDAS', default: true, locale: 'pt' as const },
  { key: 'dashboard_multi_immeubles', label: 'Dashboard Multi-Imóveis', icon: '🏘️', description: 'Visão global · Comparação edifícios · Ranking · KPIs agregados · Score saúde', default: true, locale: 'pt' as const },
  { key: 'efatura_at', label: 'e-Fatura AT', icon: '🧾', description: 'Submissão faturas AT · ATCUD · SAF-T PT · Portaria 302/2016 · DL 28/2019', default: true, locale: 'pt' as const },
] as const

// ── Event colors for planning calendar ───────────────────────────────────────
export const EVENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  reunion: { bg: 'bg-[#F7F4EE]', text: 'text-[#0D1B2E]', border: 'border-[#C9A84C]' },
  visite:  { bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-300' },
  rdv:     { bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-300' },
  tache:   { bg: 'bg-amber-100',  text: 'text-amber-800',  border: 'border-amber-300' },
  autre:   { bg: 'bg-gray-100',   text: 'text-gray-700',   border: 'border-gray-300' },
}
