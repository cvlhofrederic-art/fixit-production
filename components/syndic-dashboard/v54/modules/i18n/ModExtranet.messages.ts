import { defineMessages } from '@/lib/syndic/v54/i18n'

/**
 * Textes de l'écran « Extranet Condóminos » / « Extranet copropriétaires ».
 * Droit français : le syndic professionnel propose un accès en ligne sécurisé aux documents
 * dématérialisés de la copropriété (loi du 10 juillet 1965, art. 18 I), dont la liste minimale
 * est fixée par le décret n° 2019-502 du 23 mai 2019. L'URL du portail n'est pas traduite.
 */
interface ExtranetTextes {
  titre: string
  chapeau: string
  ajouter: string
  onglets: { coproprietaires: (n: number) => string; demandes: (n: number) => string }
  kpi: { coproprietaires: string; acces: string; solde: string; retard: string }
  vide: { titre: string; desc: string; action: string }
  colonnes: { nom: string; email: string; telephone: string; lot: string; solde: string; acces: string }
  actif: string
  inactif: string
  portail: { titre: string; texte: string; urlAria: string; copier: string }
  formulaire: {
    titre: string
    nom: string
    nomPlaceholder: string
    email: string
    emailPlaceholder: string
    telephone: string
    telephonePlaceholder: string
    lot: string
    lotPlaceholder: string
    immeuble: string
    immeublePlaceholder: string
    notes: string
    annuler: string
    ajouter: string
  }
  erreurs: { nom: string; email: string }
  toasts: {
    ajoute: string
    erreurAjout: string
    reessayerPlusTard: string
    lienCopie: string
    urlCopiee: string
  }
}

export const EXTRANET_MESSAGES = defineMessages<ExtranetTextes>({
  'pt-PT': {
    titre: 'Extranet Condóminos',
    chapeau: 'Registo · Acesso ao portal · Pedidos de intervenção',
    ajouter: '+ Condómino',
    onglets: {
      coproprietaires: (n) => `Condóminos (${n})`,
      demandes: (n) => `Pedidos de intervenção (${n})`,
    },
    kpi: { coproprietaires: 'Condóminos', acces: 'Acessos ativos', solde: 'Saldo global', retard: 'Em atraso' },
    vide: { titre: 'Registo vazio', desc: 'Adicione os seus condóminos para lhes dar acesso ao portal', action: '+ Primeiro condómino' },
    colonnes: { nom: 'Nome', email: 'Email', telephone: 'Telefone', lot: 'Fração', solde: 'Saldo', acces: 'Acesso' },
    actif: 'Ativo',
    inactif: 'Inativo',
    portail: {
      titre: 'Portal Condóminos',
      texte: 'Cada condómino pode aceder à sua área pessoal para consultar as suas quotas, atas de AG e documentos.',
      urlAria: 'URL do portal',
      copier: 'Copiar',
    },
    formulaire: {
      titre: 'Adicionar condómino',
      nom: 'Nome',
      nomPlaceholder: 'Nome completo',
      email: 'Email',
      emailPlaceholder: 'condomino@exemplo.pt',
      telephone: 'Telefone',
      telephonePlaceholder: '+351 …',
      lot: 'Fração',
      lotPlaceholder: 'Apt 12',
      immeuble: 'Edifício',
      immeublePlaceholder: 'Residência…',
      notes: 'Notas',
      annuler: 'Cancelar',
      ajouter: 'Adicionar',
    },
    erreurs: { nom: 'O nome é obrigatório.', email: 'Email inválido.' },
    toasts: {
      ajoute: 'Condómino adicionado',
      erreurAjout: 'Erro ao adicionar',
      reessayerPlusTard: 'Tente novamente mais tarde',
      lienCopie: 'Link copiado',
      urlCopiee: 'URL do portal copiado para o clipboard',
    },
  },
  'fr-FR': {
    titre: 'Extranet copropriétaires',
    chapeau: "Liste des copropriétaires · Accès à l'extranet (décret n° 2019-502) · Demandes d'intervention",
    ajouter: '+ Copropriétaire',
    onglets: {
      coproprietaires: (n) => `Copropriétaires (${n})`,
      demandes: (n) => `Demandes d'intervention (${n})`,
    },
    kpi: { coproprietaires: 'Copropriétaires', acces: 'Accès actifs', solde: 'Solde global', retard: 'En retard' },
    vide: { titre: 'Aucun copropriétaire inscrit', desc: "Ajoutez vos copropriétaires pour leur ouvrir l'accès à l'extranet", action: '+ Premier copropriétaire' },
    colonnes: { nom: 'Nom', email: 'E-mail', telephone: 'Téléphone', lot: 'Lot', solde: 'Solde', acces: 'Accès' },
    actif: 'Actif',
    inactif: 'Inactif',
    portail: {
      titre: 'Espace copropriétaires',
      texte: "Chaque copropriétaire accède à son espace personnel pour consulter ses appels de fonds, les PV d'AG et les documents de la copropriété (accès en ligne sécurisé que le syndic professionnel doit proposer, sauf décision contraire de l'AG : art. 18 de la loi du 10 juillet 1965 et décret n° 2019-502 du 23 mai 2019).",
      urlAria: "URL de l'extranet",
      copier: 'Copier',
    },
    formulaire: {
      titre: 'Ajouter un copropriétaire',
      nom: 'Nom',
      nomPlaceholder: 'Nom complet',
      email: 'E-mail',
      emailPlaceholder: 'prenom.nom@exemple.fr',
      telephone: 'Téléphone',
      telephonePlaceholder: '06 12 34 56 78',
      lot: 'Lot',
      lotPlaceholder: 'Lot 12',
      immeuble: 'Immeuble',
      immeublePlaceholder: 'Résidence…',
      notes: 'Notes',
      annuler: 'Annuler',
      ajouter: 'Ajouter',
    },
    erreurs: { nom: 'Le nom est obligatoire.', email: 'E-mail invalide.' },
    toasts: {
      ajoute: 'Copropriétaire ajouté',
      erreurAjout: "Erreur lors de l'ajout",
      reessayerPlusTard: 'Veuillez réessayer plus tard',
      lienCopie: 'Lien copié',
      urlCopiee: "URL de l'extranet copiée dans le presse-papiers",
    },
  },
})
