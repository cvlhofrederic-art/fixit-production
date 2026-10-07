import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Catégorie d'un contrat (valeur stockée par l'API). */
export type CategorieContrat = 'limpezas' | 'elevadores' | 'jardinagem' | 'seguranca' | 'outros'

/**
 * Ligne de catégorie : libellé, code de référence et dernière colonne.
 * PT : code CAE typique du prestataire et déductibilité IRC.
 * FR : compte du plan comptable des copropriétés (arrêté du 14 mars 2005) et caractère
 * récupérable sur le locataire (décret n° 87-713 du 26 août 1987).
 */
export interface LigneCategorie {
  libelle: string
  code: string
  derniere: string
}

interface MapaFiscalTextes {
  surtitre: string
  titre: string
  chapeau: string
  reclasser: string
  exporter: string
  toasts: {
    reclassementBientot: string
    exportTitre: string
    connexionExport: string
    exportReussi: string
    /** Résumé de l'export : nombre de contrats et total des dépenses déjà formaté. */
    resumeExport: (contrats: number, total: string) => string
    erreur: string
    exportImpossible: string
  }
  alerte: { titre: string; avant: string; gras: string; apres: string }
  kpi: { ecritures: string; classementIA: string; totalDepenses: string; totalRecettes: string; rapprochement: string; exports: string }
  ongletEnCours: string
  panneau: string
  /** En-têtes du tableau, repris tels quels dans l'export CSV. */
  colonnes: string[]
  vide: string
  pct: (n: number) => string
  /** Aperçu anonyme : catégories standard à 0. */
  apercu: LigneCategorie[]
  /** Lignes calculées depuis les contrats réels, par catégorie de contrat. */
  categories: Record<CategorieContrat, LigneCategorie>
  csvFichier: string
}

export const MAPA_FISCAL_MESSAGES = defineMessages<MapaFiscalTextes>({
  'pt-PT': {
    surtitre: 'FISCAL · DECLARATIVO ANUAL',
    titre: 'Mapa Fiscal Anual',
    chapeau: 'Categorização Max Expert · Export Primavera/PHC/Sage · Reconciliação 100% com contabilidade',
    reclasser: 'Recategorizar com Max',
    exporter: 'Exportar (Excel · PDF · IES)',
    toasts: {
      reclassementBientot: 'Recategorização IA — em breve',
      exportTitre: 'Exportação',
      connexionExport: 'Conecte-se como síndico para exportar',
      exportReussi: 'Exportação concluída',
      resumeExport: (contrats, total) => `${contrats} contratos · ${total} despesas`,
      erreur: 'Erro',
      exportImpossible: 'Não foi possível exportar.',
    },
    alerte: {
      titre: 'Max Expert categoriza 100% das linhas',
      avant: 'Cada fatura é classificada por ',
      gras: 'CAE prestador + natureza despesa',
      apres: '. O mapa exporta-se em 3 formatos compatíveis com os principais programas de contabilidade portugueses (Primavera, PHC, Sage) + formato AT (SAF-T).',
    },
    kpi: {
      ecritures: 'Lançamentos ano corrente',
      classementIA: 'Categorização IA',
      totalDepenses: 'Total despesas',
      totalRecettes: 'Total receitas',
      rapprochement: 'Reconciliação',
      exports: 'Exportações geradas',
    },
    ongletEnCours: '2026 (em curso)',
    panneau: 'Categorias fiscais — auto Max Expert',
    colonnes: ['Categoria', 'CAE típico', 'Lançamentos', 'Total ano', '% Total', 'Dedutível IRC'],
    vide: 'Nenhum contrato categorizado — adicione contratos para alimentar o mapa fiscal.',
    pct: (n) => `${n}%`,
    apercu: [
      { libelle: 'Limpezas', code: '81210', derniere: 'Sim' },
      { libelle: 'Manutenção elevadores', code: '43222', derniere: 'Sim' },
      { libelle: 'Jardinagem', code: '81300', derniere: 'Sim' },
      { libelle: 'Segurança', code: '80100', derniere: 'Sim' },
      { libelle: 'Eletricidade comum', code: '35140', derniere: 'Sim' },
      { libelle: 'Água comum', code: '36000', derniere: 'Sim' },
      { libelle: 'Seguros', code: '65120', derniere: 'Sim' },
      { libelle: 'Outras despesas', code: '—', derniere: 'Variável' },
    ],
    categories: {
      limpezas: { libelle: 'Limpezas', code: '81210', derniere: 'Sim' },
      elevadores: { libelle: 'Manutenção elevadores', code: '43222', derniere: 'Sim' },
      jardinagem: { libelle: 'Jardinagem', code: '81300', derniere: 'Sim' },
      seguranca: { libelle: 'Segurança', code: '80100', derniere: 'Sim' },
      outros: { libelle: 'Outras despesas', code: '—', derniere: 'Sim' },
    },
    csvFichier: 'mapa-fiscal.csv',
  },
  'fr-FR': {
    surtitre: 'CHARGES · RÉCAPITULATIF ANNUEL',
    titre: 'Récapitulatif fiscal annuel des charges',
    chapeau: 'Classement Max Expert · Base des relevés annuels de charges par lot · Rapprochement 100 % avec la comptabilité du syndicat',
    reclasser: 'Reclasser avec Max',
    exporter: 'Exporter (CSV · Excel)',
    toasts: {
      reclassementBientot: 'Reclassement par IA — bientôt disponible',
      exportTitre: 'Export',
      connexionExport: 'Connectez-vous en tant que syndic pour exporter',
      exportReussi: 'Export terminé',
      resumeExport: (contrats, total) => `${contrats} contrat${contrats > 1 ? 's' : ''} · ${total} de charges`,
      erreur: 'Erreur',
      exportImpossible: "L'export n'a pas pu être réalisé.",
    },
    alerte: {
      titre: 'Max Expert classe 100 % des lignes',
      avant: 'Chaque facture est rattachée à un ',
      gras: 'compte de charges du plan comptable des copropriétés',
      apres: " (arrêté du 14 mars 2005 relatif aux comptes du syndicat des copropriétaires). Pour les copropriétaires bailleurs, le récapitulatif indique les charges récupérables sur le locataire (décret n° 87-713 du 26 août 1987) ; la part déductible des revenus fonciers (déclaration n° 2044) s'apprécie selon la situation de chaque bailleur. L'export CSV s'ouvre dans un tableur et s'importe dans les principaux logiciels comptables.",
    },
    kpi: {
      ecritures: "Écritures de l'exercice",
      classementIA: 'Classement IA',
      totalDepenses: 'Total des charges',
      totalRecettes: 'Total des produits',
      rapprochement: 'Rapprochement',
      exports: 'Exports générés',
    },
    ongletEnCours: '2026 (en cours)',
    panneau: 'Catégories de charges — classement auto Max Expert',
    colonnes: ['Catégorie', 'Compte', 'Écritures', "Total de l'année", '% du total', 'Récupérable sur le locataire'],
    vide: 'Aucun contrat classé — ajoutez des contrats pour alimenter le récapitulatif.',
    pct: (n) => `${n} %`,
    apercu: [
      { libelle: 'Nettoyage des parties communes', code: '611', derniere: 'Oui' },
      { libelle: 'Maintenance des ascenseurs', code: '614', derniere: 'En partie' },
      { libelle: 'Espaces verts', code: '614', derniere: 'Oui' },
      { libelle: 'Sécurité', code: '614', derniere: 'Selon la dépense' },
      { libelle: 'Électricité des parties communes', code: '602', derniere: 'Oui' },
      { libelle: 'Eau des parties communes', code: '601', derniere: 'Oui' },
      { libelle: 'Assurances', code: '616', derniere: 'Non' },
      { libelle: 'Autres charges', code: '—', derniere: 'Selon la dépense' },
    ],
    categories: {
      limpezas: { libelle: 'Nettoyage des parties communes', code: '611', derniere: 'Oui' },
      elevadores: { libelle: 'Maintenance des ascenseurs', code: '614', derniere: 'En partie' },
      jardinagem: { libelle: 'Espaces verts', code: '614', derniere: 'Oui' },
      seguranca: { libelle: 'Sécurité', code: '614', derniere: 'Selon la dépense' },
      outros: { libelle: 'Autres charges', code: '—', derniere: 'Selon la dépense' },
    },
    csvFichier: 'recapitulatif-charges.csv',
  },
})
