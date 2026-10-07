import { defineMessages } from '@/lib/syndic/v54/i18n'

/**
 * Carte de prestataire : [nom, métier, certification ('' = certifié), note, interventions,
 * téléphone, e-mail, fin de validité RC Pro, fin de validité décennale, technicien interne].
 * FR : attestations d'assurance RC professionnelle et décennale (C. civ. art. 1792,
 * C. assur. art. L241-1) ; SIRET à la place du NIF.
 */
export type ProDemo = readonly [string, string, string, string, number, string, string, string | null, string | null, boolean?]

interface CompteursPrestataires {
  total: number
  certifies: number
  rcValide: number
  decennale: number
}

interface ProfissionaisTextes {
  titre: string
  chapeau: (c: CompteursPrestataires) => string
  chapeauDemo: string
  synchroniser: string
  ajouter: string
  toasts: {
    synchronise: string
    synchroniseDesc: string
    synchroniseConnexion: string
    messages: string
    aucunCompteMessagerie: string
    supprime: string
    erreurSuppression: string
    reessayerPlusTard: string
    supprimeDemo: string
    connexionRequise: string
    ajoute: string
    erreurAjout: string
    verifierDonnees: string
    ajouteDemo: string
  }
  carte: {
    certifie: string
    actif: string
    /** Suffixe après le nombre d'interventions (nœud de texte distinct). */
    interventions: string
    rcValide: string
    /** Préfixes avant la date (nœuds de texte distincts). */
    rcValideJusquau: string
    decennaleJusquau: string
    decennaleValide: string
    aucunCompte: string
    creerMission: string
    supprimerAria: string
    supprimerTitre: string
  }
  suppression: {
    titre: string
    avant: string
    apres: string
    annuler: string
    supprimer: string
  }
  formulaire: {
    nom: string
    nomPlaceholder: string
    prenom: string
    facultatif: string
    email: string
    emailPlaceholder: string
    telephone: string
    telephonePlaceholder: string
    metier: string
    metierPlaceholder: string
    siret: string
    annuler: string
    ajouter: string
  }
  erreurs: { nom: string; email: string }
  demo: ProDemo[]
}

export const PROFISSIONAIS_MESSAGES = defineMessages<ProfissionaisTextes>({
  'pt-PT': {
    titre: 'Profissionais',
    chapeau: (c) => `${c.total} prestadores registados · ${c.certifies} certificados Vitfix · ${c.rcValide} com Seguro RC válido · ${c.decennale} com garantia decenal`,
    chapeauDemo: '9 prestadores registados · 7 certificados Vitfix · 9 com Seguro RC válido · 8 com garantia decenal',
    synchroniser: 'Sincro conformidade',
    ajouter: 'Adicionar um profissional',
    toasts: {
      synchronise: 'Conformidade sincronizada',
      synchroniseDesc: 'Dados de conformidade atualizados.',
      synchroniseConnexion: 'Conecte-se como síndico para sincronizar.',
      messages: 'Mensagens',
      aucunCompteMessagerie: 'Nenhuma conta de mensagens ligada',
      supprime: 'Profissional eliminado',
      erreurSuppression: 'Erro ao eliminar',
      reessayerPlusTard: 'Tente novamente mais tarde',
      supprimeDemo: 'Profissional eliminado (demo)',
      connexionRequise: 'Conecte-se como síndico para gravar a sério',
      ajoute: 'Profissional adicionado',
      erreurAjout: 'Erro ao adicionar',
      verifierDonnees: 'Verifique os dados e tente novamente',
      ajouteDemo: 'Profissional adicionado (demo)',
    },
    carte: {
      certifie: 'Certificado',
      actif: 'Ativo',
      interventions: ' intervenções',
      rcValide: 'Seguro RC válido',
      rcValideJusquau: 'Seguro RC válido até ',
      decennaleJusquau: 'Decenal válido até ',
      decennaleValide: 'Decenal válido',
      aucunCompte: 'Sem conta ligada',
      creerMission: 'Criar missão',
      supprimerAria: 'Eliminar profissional',
      supprimerTitre: 'Eliminar',
    },
    suppression: {
      titre: 'Eliminar profissional',
      avant: 'Tem a certeza que pretende eliminar ',
      apres: ' da sua lista de profissionais? Esta ação é irreversível.',
      annuler: 'Cancelar',
      supprimer: 'Eliminar',
    },
    formulaire: {
      nom: 'Nome',
      nomPlaceholder: 'Apelido / empresa',
      prenom: 'Primeiro nome',
      facultatif: 'Opcional',
      email: 'E-mail',
      emailPlaceholder: 'nome@exemplo.pt',
      telephone: 'Telefone',
      telephonePlaceholder: '912 345 678',
      metier: 'Ofício',
      metierPlaceholder: 'Ex.: Canalizador',
      siret: 'NIF / SIRET',
      annuler: 'Cancelar',
      ajouter: 'Adicionar',
    },
    erreurs: { nom: 'O nome é obrigatório.', email: 'O e-mail é obrigatório.' },
    demo: [
      ['Silva', 'Canalizador', 'check', '4.7', 23, '912 345 678', 'joao.silva@canaliz-norte.pt', '31/12/2026', '30/06/2027'],
      ['Ferreira', 'Eletricista', 'check', '4.5', 17, '935 421 098', 'carlos.ferreira@eletro-porto.pt', '15/08/2026', '20/11/2026'],
      ['Santos', 'Pedreiro', '', '4.3', 12, '928 765 432', 'miguel.santos@construsantos.pt', '01/10/2026', '15/03/2028'],
      ['Pereira', 'Pintor', 'check', '4.8', 9, '917 654 321', 'ana.pereira@pinturas-portugal.pt', '28/02/2027', '30/09/2027'],
      ['Costa', 'Jardineiro', '', '4.2', 6, '961 234 567', 'rui.costa@espacos-verdes.pt', '31/07/2026', null],
      ['Martins', 'Serralheiro', 'check', '4.6', 8, '942 876 543', 'pedro.martins@serralharia-douro.pt', '30/11/2026', '22/04/2027'],
      ['Bruno Tavares', 'Técnico interno', 'check', '5', 0, '935 100 002', 'bruno.tavares@gabinete-vitfix.pt', null, null, true],
      ['Diogo Pereira', 'Técnico interno', 'check', '5', 0, '935 100 006', 'diogo.pereira@gabinete-vitfix.pt', null, null, true],
      ['Tiago Mendes', 'Técnico interno', 'check', '5', 0, '935 100 007', 'tiago.mendes@gabinete-vitfix.pt', null, null, true],
    ],
  },
  'fr-FR': {
    titre: 'Prestataires',
    chapeau: (c) => `${c.total} prestataire${c.total > 1 ? 's' : ''} référencé${c.total > 1 ? 's' : ''} · ${c.certifies} certifié${c.certifies > 1 ? 's' : ''} VitFix · ${c.rcValide} avec RC Pro valide · ${c.decennale} avec garantie décennale`,
    chapeauDemo: '9 prestataires référencés · 7 certifiés VitFix · 9 avec RC Pro valide · 8 avec garantie décennale',
    synchroniser: 'Synchroniser la conformité',
    ajouter: 'Ajouter un prestataire',
    toasts: {
      synchronise: 'Conformité synchronisée',
      synchroniseDesc: 'Données de conformité mises à jour.',
      synchroniseConnexion: 'Connectez-vous en tant que syndic pour synchroniser.',
      messages: 'Messagerie',
      aucunCompteMessagerie: 'Aucun compte de messagerie lié',
      supprime: 'Prestataire supprimé',
      erreurSuppression: 'Erreur lors de la suppression',
      reessayerPlusTard: 'Veuillez réessayer plus tard',
      supprimeDemo: 'Prestataire supprimé (démonstration)',
      connexionRequise: 'Connectez-vous en tant que syndic pour enregistrer réellement',
      ajoute: 'Prestataire ajouté',
      erreurAjout: "Erreur lors de l'ajout",
      verifierDonnees: 'Vérifiez les informations et réessayez',
      ajouteDemo: 'Prestataire ajouté (démonstration)',
    },
    carte: {
      certifie: 'Certifié',
      actif: 'Actif',
      interventions: ' interventions',
      rcValide: 'RC Pro valide',
      rcValideJusquau: "RC Pro valide jusqu'au ",
      decennaleJusquau: "Décennale valide jusqu'au ",
      decennaleValide: 'Décennale valide',
      aucunCompte: 'Aucun compte lié',
      creerMission: 'Créer une mission',
      supprimerAria: 'Supprimer le prestataire',
      supprimerTitre: 'Supprimer',
    },
    suppression: {
      titre: 'Supprimer le prestataire',
      avant: 'Voulez-vous vraiment retirer ',
      apres: ' de votre liste de prestataires ? Cette action est irréversible.',
      annuler: 'Annuler',
      supprimer: 'Supprimer',
    },
    formulaire: {
      nom: 'Nom',
      nomPlaceholder: 'Nom / raison sociale',
      prenom: 'Prénom',
      facultatif: 'Facultatif',
      email: 'E-mail',
      emailPlaceholder: 'nom@exemple.fr',
      telephone: 'Téléphone',
      telephonePlaceholder: '06 12 34 56 78',
      metier: 'Métier',
      metierPlaceholder: 'Ex. : Plombier',
      siret: 'SIRET',
      annuler: 'Annuler',
      ajouter: 'Ajouter',
    },
    erreurs: { nom: 'Le nom est obligatoire.', email: "L'e-mail est obligatoire." },
    demo: [
      ['Sylvain', 'Plombier', 'check', '4,7', 23, '06 12 34 56 78', 'jean.sylvain@exemple.fr', '31/12/2026', '30/06/2027'],
      ['Ferrand', 'Électricien', 'check', '4,5', 17, '06 35 42 10 98', 'charles.ferrand@exemple.fr', '15/08/2026', '20/11/2026'],
      ['Sanchez', 'Maçon', '', '4,3', 12, '06 28 76 54 32', 'michel.sanchez@exemple.fr', '01/10/2026', '15/03/2028'],
      ['Perrin', 'Peintre', 'check', '4,8', 9, '07 17 65 43 21', 'anne.perrin@exemple.fr', '28/02/2027', '30/09/2027'],
      ['Costes', 'Jardinier', '', '4,2', 6, '06 61 23 45 67', 'remi.costes@exemple.fr', '31/07/2026', null],
      ['Martin', 'Serrurier-métallier', 'check', '4,6', 8, '07 42 87 65 43', 'pierre.martin@exemple.fr', '30/11/2026', '22/04/2027'],
      ['Bruno Tessier', 'Technicien interne', 'check', '5', 0, '06 35 10 00 02', 'bruno.tessier@cabinet-vitfix.fr', null, null, true],
      ['Damien Perrin', 'Technicien interne', 'check', '5', 0, '06 35 10 00 06', 'damien.perrin@cabinet-vitfix.fr', null, null, true],
      ['Thomas Ménard', 'Technicien interne', 'check', '5', 0, '06 35 10 00 07', 'thomas.menard@cabinet-vitfix.fr', null, null, true],
    ],
  },
})
