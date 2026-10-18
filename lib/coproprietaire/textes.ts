// ── Textes de l'espace copropriétaire (FR / PT) ───────────────────────────────
//
// Libellés en langage courant pour un public de tout âge : pas de vocabulaire de cabinet
// (« a_payer », « 2026-T2 », « impayés »), pas de pictogrammes dans les mots, phrases courtes.
// Les écrans lisent `textesCopro(locale)` ; les fonctions `libelle*` traduisent les valeurs
// de la base (statuts, catégories portugaises) en mots.

import type {
  CategorieAnnonce, ChoixVote, MajoriteResolution, NatureImpaye, StatutAppel, StatutAssemblee,
  StatutFacture, StatutIntervention, TypeDocumentImmeuble,
} from '@/lib/coproprietaire/types'

export type LangueCopro = 'fr' | 'pt'

export function langueCopro(locale: string | null | undefined): LangueCopro {
  return (locale || '').toLowerCase().startsWith('pt') ? 'pt' : 'fr'
}

export type EcranCopro = 'accueil' | 'demandes' | 'charges' | 'documents' | 'assemblees' | 'annonces' | 'informations' | 'question'

export const TEXTES = {
  fr: {
    menu: {
      accueil: 'Accueil',
      demandes: 'Mes demandes',
      charges: 'Charges & paiements',
      documents: 'Documents',
      assemblees: 'Assemblées & votes',
      annonces: 'Annonces',
      informations: 'Mes informations',
      question: 'Poser une question',
      plus: 'Plus',
      /** Libellés courts de la barre du bas (téléphone). */
      court: { accueil: 'Accueil', demandes: 'Demandes', charges: 'Charges', documents: 'Documents' },
      panneauAdmin: 'Panneau admin',
      deconnexion: 'Déconnexion',
      menu: 'Menu',
      fermerMenu: 'Fermer le menu',
    },
    sousTitres: {
      accueil: 'Votre espace copropriétaire',
      demandes: 'Vos signalements et les travaux de l’immeuble',
      charges: 'Ce que vous devez et comment payer',
      documents: 'Règlement, procès-verbaux, contrats',
      assemblees: 'Convocations, votes, procès-verbaux',
      annonces: 'Informations de votre syndic',
      informations: 'Votre lot tel que connu du syndic',
      question: 'Fixy répond avec les informations de votre espace',
    },
    commun: {
      signalerProbleme: 'Signaler un problème',
      voirDetail: 'Voir le détail',
      masquerDetail: 'Masquer le détail',
      voirTout: 'Voir tout',
      fermer: 'Fermer',
      annuler: 'Annuler',
      reessayer: 'Réessayer',
      envoyer: 'Envoyer',
      copier: 'Copier',
      copie: 'Copié',
      ouvrir: 'Ouvrir',
      chargement: 'Chargement de votre espace…',
      mettreAJour: 'Mettre à jour',
      derniereMiseAJour: 'Dernière mise à jour à {heure}',
      miseAJourImpossible: 'Les informations affichées datent de {heure} (mise à jour impossible).',
      besoinAide: 'Besoin d’aide ?',
      lotAffiche: 'Lot affiché',
      votreSyndic: 'votre syndic',
      tousImmeubles: 'Tous les immeubles du cabinet',
      bonjour: 'Bonjour',
      batiment: 'bâtiment',
      etage: 'étage',
      lot: 'lot',
      ttc: 'TTC',
      aucunMontant: 'Montant non communiqué',
    },
    shell: {
      demoVisiteur: 'Vous consultez une démonstration : les montants, documents et travaux sont fictifs.',
      demoSuperAdmin: 'Démonstration — vous voyez l’espace de {nom}.',
      vueSuperAdminReelle: 'Vue super admin — vous voyez l’espace réel de {nom} (fiche de votre cabinet).',
      seConnecter: 'Se connecter',
      erreurReseau: 'Impossible de charger vos informations pour le moment. Vérifiez votre connexion internet, puis réessayez.',
      sessionExpiree: 'Votre session a expiré.',
      meReconnecter: 'Me reconnecter',
      tropDeDemandes: 'Trop de demandes en peu de temps : patientez une minute, puis réessayez.',
      espaceNonActiveTitre: 'Votre espace n’est pas encore activé',
      espaceNonActive: 'Votre syndic doit d’abord enregistrer votre lot avec l’adresse {email}. Vous pouvez déjà lui signaler un problème.',
      roleInterdit: 'Cet espace est réservé aux copropriétaires et aux locataires.',
      coordonneesSyndic: 'Coordonnées de votre syndic',
    },
    accueil: {
      aRegler: 'À régler : {montant} avant le {date}',
      enRetard: 'En retard : {montant} depuis le {date}',
      aJour: 'Vous êtes à jour',
      aucunAppel: 'Aucun appel de charges enregistré',
      voirCommentPayer: 'Voir comment payer',
      demandesEnCours: 'Vos demandes en cours',
      aucuneDemande: 'Vous n’avez encore envoyé aucune demande.',
      voirToutesDemandes: 'Voir toutes mes demandes',
      prochaineAssemblee: 'Prochaine assemblée',
      resolutionsAttendent: '{n} résolution(s) sur {total} attendent votre vote',
      voter: 'Voter par correspondance',
      travauxEnCours: 'Travaux dans l’immeuble',
      aucunTravaux: 'Aucun travaux en cours dans l’immeuble.',
      dernieresAnnonces: 'Dernières annonces',
      aucuneAnnonce: 'Aucune annonce pour le moment.',
    },
    demandes: {
      ongletMesDemandes: 'Mes demandes',
      ongletTravaux: 'Travaux dans l’immeuble',
      nouvelleDemande: 'Signaler un problème',
      envoyeeLe: 'envoyée le {date}',
      miseAJourLe: 'dernière mise à jour le {date}',
      passagePrevu: 'Passage prévu le {date}',
      prestataire: 'Prestataire : {nom}',
      etapes: { recue: 'Reçue', priseEnCharge: 'Prise en charge', enCours: 'En cours', terminee: 'Terminée' },
      statuts: {
        en_attente: 'Reçue par le syndic',
        acceptee: 'Prise en charge — prestataire : {nom}',
        accepteeSansPrestataire: 'Prise en charge par le syndic',
        en_cours: 'Intervention en cours',
        terminee: 'Terminée',
        annulee: 'Classée sans suite par le syndic',
      },
      statutsTravaux: {
        en_attente: 'À planifier',
        acceptee: 'Prestataire désigné',
        en_cours: 'En cours',
        terminee: 'Travaux terminés',
        annulee: 'Annulés',
      },
      fil: 'Échanges avec votre syndic',
      vous: 'Vous',
      syndic: 'Votre syndic',
      ecrireAuSyndic: 'Écrire au syndic',
      messagePlaceholder: 'Votre message pour le syndic…',
      messageEnvoye: 'Message envoyé à votre syndic.',
      messageErreur: 'Votre message n’a pas pu être envoyé. Réessayez dans un instant.',
      compteRendu: 'Compte rendu de l’intervention',
      travailEffectue: 'Travail effectué',
      materiaux: 'Matériaux utilisés',
      problemes: 'Problèmes constatés',
      recommandations: 'Recommandations',
      duree: 'Durée',
      coutCopropriete: 'Coût pour la copropriété',
      devis: 'devis',
      facture: 'facturé',
      documentsPrestataire: 'Documents du prestataire',
      typesDocument: { devis: 'Devis', rapport: 'Rapport', facture: 'Facture' },
      aucuneDemande: 'Vous n’avez encore envoyé aucune demande.',
      aucunTravaux: 'Aucun travaux en cours dans l’immeuble.',
      partiesCommunes: 'Parties communes',
      monLogement: 'Mon logement',
      deposeeSansCompte: 'Demande déposée sans connexion à votre espace (formulaire public ou QR code), avec votre adresse e-mail. Si vous n’en êtes pas l’auteur, signalez-le à votre syndic.',
      // Formulaire
      ouProbleme: 'Où est le problème ?',
      dansMonLogement: 'Dans mon logement ({lieu})',
      dansPartiesCommunes: 'Dans les parties communes (hall, escalier, ascenseur, cave, parking…)',
      zone: 'Quelle zone ?',
      choisirZone: 'Choisir une zone…',
      autreZone: 'Autre (précisez dans la description)',
      typeProbleme: 'Quel type de problème ?',
      choisirType: 'Choisir…',
      decrivez: 'Décrivez le problème',
      decrivezPlaceholder: 'Décrivez précisément le problème constaté…',
      descriptionMinimum: '10 caractères minimum, pour que le syndic comprenne le problème.',
      descriptionEncore: 'Encore {n} caractère(s) : 10 caractères minimum.',
      urgent: 'C’est urgent ?',
      urgenceNon: 'Non, ce n’est pas pressé',
      urgenceGenant: 'Oui, c’est gênant (sous 48 h)',
      urgenceUrgent: 'Oui, c’est urgent (fuite importante, panne d’ascenseur, danger)',
      envoyerAuSyndic: 'Envoyer au syndic',
      envoiEnCours: 'Envoi en cours…',
      transmisAuSyndic: 'Votre demande est transmise à votre syndic, pas directement à un artisan.',
      confirmationTitre: 'Votre demande a bien été envoyée à votre syndic le {date}.',
      confirmationNumero: 'Numéro : {numero}',
      confirmationSuite: 'Vous suivrez sa prise en charge ici, dans « Mes demandes ».',
      voirMaDemande: 'Voir ma demande',
      autreDemande: 'Faire une autre demande',
      erreurType: 'Choisissez le type de problème.',
      erreurDescription: 'Décrivez le problème en 10 caractères au moins.',
      erreurInvalide: 'Le syndic n’a pas pu enregistrer ce signalement : vérifiez la description et réessayez.',
      erreurTropDeDemandes: 'Trop d’envois en peu de temps : réessayez dans une minute.',
      erreurServeur: 'Le signalement n’a pas pu être envoyé. Réessayez dans un instant.',
      erreurReseau: 'Connexion impossible : vérifiez votre réseau puis réessayez.',
    },
    charges: {
      ceQueVousDevez: 'Ce que vous devez',
      aReglerAvant: '{montant} à régler avant le {date}',
      aRegler: '{montant} à régler',
      aJour: 'Vous êtes à jour',
      retard: 'Retard de paiement : {montant} depuis le {date}',
      relanceEnvoyee: 'relance envoyée le {date}',
      commentPayer: 'Comment payer',
      parVirement: 'Par virement à votre syndic',
      iban: 'IBAN',
      copierIban: 'Copier l’IBAN',
      reference: 'Référence à indiquer',
      pasDePaiementEnLigne: 'Le paiement en ligne n’est pas disponible ; vous pouvez aussi régler par chèque auprès de votre syndic.',
      ibanInconnu: 'Votre syndic ne vous a pas communiqué d’IBAN : contactez-le pour connaître les moyens de paiement.',
      vosAppels: 'Vos appels de charges',
      chargesDu: 'Charges du {debut} au {fin}',
      montant: 'Montant',
      regle: 'Réglé',
      reste: 'Reste',
      statutsAppel: {
        a_payer: 'À payer',
        partiellement_paye: 'Payé en partie (reste {reste})',
        solde: 'Payé',
        en_retard: 'En retard',
        annule: 'Annulé',
      },
      aucunAppel: 'Votre syndic n’a pas encore publié d’appel de charges.',
      factures: 'Factures de votre syndic',
      aucuneFacture: 'Aucune facture pour le moment.',
      dontTva: 'dont TVA {montant}',
      ouvrirPdf: 'Ouvrir le PDF',
      statutsFacture: {
        a_regler: 'À régler',
        partiellement_regle: 'Réglée en partie',
        reglee: 'Réglée',
        contestee: 'Contestée',
        annulee: 'Annulée',
      },
      retardsDePaiement: 'Retards de paiement',
      natures: {
        charges_courantes: 'Charges courantes',
        travaux: 'Travaux',
        fonds_reserve: 'Fonds de travaux',
        interets_retard: 'Intérêts de retard',
        frais_relance: 'Frais de relance',
        autre: 'Autre',
      },
      statutsImpaye: {
        ouvert: 'En attente de règlement',
        en_recouvrement: 'En recouvrement',
        solde: 'Régularisé',
        passe_perte: 'Clos',
      },
      depuisLe: 'depuis le {date}',
      relances: '{n} relance(s)',
      comprendre: 'Comprendre mes charges',
      tantiemesPhrase: 'Votre lot compte {tantiemes} tantièmes sur {total} : vous payez {pourcentage} des charges communes.',
      budgetPhrase: 'Budget de la copropriété : {budget} ; dépensé à ce jour : {depenses}.',
      soldeDu: 'Solde de votre compte : {montant} (somme due)',
      soldeCredit: 'Solde de votre compte : {montant} (en votre faveur)',
    },
    documents: {
      reglement: 'Règlement de copropriété',
      misAJourLe: 'Mis à jour le {date}',
      repartition: 'Répartition des charges',
      majorite: 'Majorité en assemblée',
      fondsTravaux: 'Fonds de travaux',
      fondsRoulement: 'Fonds de roulement',
      oui: 'oui',
      non: 'non',
      ouvrirReglement: 'Ouvrir le règlement',
      reglementTexte: 'Lire le règlement',
      pv: 'Procès-verbaux d’assemblée',
      contrats: 'Contrats et assurances',
      devis: 'Devis de travaux',
      autres: 'Autres documents',
      ajouteLe: 'ajouté le {date}',
      jusquAu: 'jusqu’au {date}',
      police: 'police n° {numero}',
      aucunDocument: 'Votre syndic n’a pas encore déposé de document pour votre immeuble.',
      erreurOuverture: 'Impossible d’ouvrir ce document pour le moment. Réessayez dans un instant.',
      ouvertureEnCours: 'Ouverture…',
      categoriesContrat: { limpezas: 'Nettoyage', elevadores: 'Ascenseur', seguranca: 'Sécurité', jardinagem: 'Espaces verts', outros: 'Autre' },
      typesAssurance: { multirriscos: 'Assurance multirisque', responsabilidade_civil: 'Responsabilité civile', incendio: 'Incendie', outros: 'Assurance' },
      statutsContrat: { ativo: 'En cours', ativa: 'En cours', expirado: 'Expiré', expirada: 'Expirée', renovacao: 'En renouvellement' },
      parMois: '{montant} par mois',
      parAn: '{montant} par an',
    },
    assemblees: {
      prochaine: 'Prochaine assemblée',
      resolutionsAttendent: '{n} résolution(s) sur {total} attendent votre vote',
      voter: 'Voter par correspondance',
      voterJusquAu: 'Vous pouvez voter jusqu’au {date}',
      voteClos: 'Le vote par correspondance est clos depuis le {date}.',
      ordreDuJour: 'Ordre du jour',
      resolutions: 'Résolutions',
      majoriteRequise: 'Majorité requise : {majorite}',
      majorites: {
        art24: 'majorité simple (art. 24)',
        art25: 'majorité absolue (art. 25)',
        art26: 'double majorité (art. 26)',
        unanimite: 'unanimité',
      },
      pour: 'Pour',
      contre: 'Contre',
      abstention: 'Abstention',
      confirmationTitre: 'Vous votez {choix} la résolution n° {numero}',
      confirmationTexte: 'Votre choix sera transmis à votre syndic, qui le reporte sur le formulaire de vote par correspondance prévu par la loi (article 17-1 A de la loi du 10 juillet 1965). Vous pouvez le modifier jusqu’au {date}. Si vous assistez à l’assemblée, vous voterez en séance.',
      confirmationNote: 'Si la résolution est modifiée en séance, un vote favorable par correspondance est compté comme défaillant pour cette résolution.',
      confirmerVote: 'Confirmer mon vote',
      votreVote: 'Votre vote : {choix}',
      enregistreLe: 'enregistré le {date}',
      modifier: 'Modifier',
      voteErreur: 'Votre vote n’a pas pu être enregistré. Réessayez, ou contactez votre syndic.',
      voteEnregistre: 'Votre vote a été enregistré.',
      choix: { pour: 'POUR', contre: 'CONTRE', abstention: 'ABSTENTION' },
      resultats: 'Résultats',
      adoptee: 'Adoptée',
      rejetee: 'Rejetée',
      enCours: 'Vote en cours',
      tantiemes: 'tantièmes',
      pvTitre: 'Procès-verbal',
      contestation: 'Vous n’êtes pas d’accord avec une décision ? Vous avez jusqu’au {date} pour la contester par lettre recommandée au syndic (deux mois, art. 42 de la loi du 10 juillet 1965).',
      contestationEcoulee: 'Le délai de contestation de deux mois (art. 42 de la loi du 10 juillet 1965) est écoulé.',
      copierModele: 'Copier un modèle de lettre',
      modeleCopie: 'Modèle de lettre copié.',
      precedentes: 'Assemblées précédentes',
      statuts: { convoquee: 'Convoquée', en_cours: 'En cours', cloturee: 'Clôturée', annulee: 'Annulée' },
      types: { ordinaire: 'Assemblée générale ordinaire', extraordinaire: 'Assemblée générale extraordinaire' },
      aucune: 'Aucune assemblée programmée. Vous serez informé ici dès la convocation.',
      convocationEnvoyee: 'Convocation envoyée le {date}',
    },
    annonces: {
      epinglee: 'Épinglée par le syndic',
      urgent: 'Urgent',
      important: 'Important',
      publieLe: 'Publié le {date} par votre syndic',
      categories: {
        manutencao: 'Travaux et entretien',
        assembleia: 'Assemblée',
        financeiro: 'Finances',
        seguranca: 'Sécurité',
        social: 'Vie de l’immeuble',
        outro: 'Autre',
      },
      aucune: 'Aucune annonce pour le moment. Votre syndic publie ici les informations de l’immeuble (travaux, coupures, assemblées).',
    },
    informations: {
      votreLot: 'Votre lot',
      votreLogement: 'Votre logement',
      tantiemes: '{tantiemes} tantièmes ({pourcentage} des charges)',
      coordonnees: 'Vos coordonnées connues du syndic',
      nom: 'Nom',
      email: 'E-mail',
      telephone: 'Téléphone',
      nonRenseigne: 'non renseigné',
      inexact: 'Une information est inexacte ? Contactez votre syndic : lui seul peut la corriger.',
      votreSyndic: 'Votre syndic',
      gestionnaire: 'Gestionnaire de l’immeuble : {nom}',
      syndicInconnu: 'Coordonnées du syndic non renseignées.',
      langue: 'Langue',
      francais: 'Français',
      portugais: 'Português',
      meDeconnecter: 'Me déconnecter',
      confirmationDeconnexion: 'Vous allez être déconnecté.',
      rester: 'Rester',
      locataireNote: 'Vos demandes sont visibles par le syndic et par le propriétaire de votre logement.',
      changerLot: 'Changer de lot',
    },
    question: {
      titre: 'Poser une question',
      intro: 'Fixy est un assistant automatique : il répond avec les informations de votre espace. Pour toute décision, contactez votre syndic.',
      questions: [
        'Combien dois-je payer et avant quand ?',
        'Où en est ma demande ?',
        'Quand est la prochaine assemblée ?',
        'Comment contacter mon syndic ?',
      ],
      placeholder: 'Écrivez votre question',
      envoyer: 'Envoyer',
      nouvelleConversation: 'Nouvelle conversation',
      demo: 'Je réponds avec des données de démonstration.',
      erreur: 'Fixy ne répond pas pour le moment. Réessayez dans un instant ou contactez votre syndic.',
      pasDeReponse: 'Désolé, je n’ai pas pu répondre pour le moment.',
      fixy: 'Fixy',
    },
  },
  pt: {
    menu: {
      accueil: 'Início',
      demandes: 'Os meus pedidos',
      charges: 'Quotas & pagamentos',
      documents: 'Documentos',
      assemblees: 'Assembleias & votos',
      annonces: 'Avisos',
      informations: 'As minhas informações',
      question: 'Fazer uma pergunta',
      plus: 'Mais',
      court: { accueil: 'Início', demandes: 'Pedidos', charges: 'Quotas', documents: 'Documentos' },
      panneauAdmin: 'Painel de administração',
      deconnexion: 'Terminar sessão',
      menu: 'Menu',
      fermerMenu: 'Fechar o menu',
    },
    sousTitres: {
      accueil: 'O seu espaço de condómino',
      demandes: 'As suas ocorrências e as obras do edifício',
      charges: 'O que deve e como pagar',
      documents: 'Regulamento, atas, contratos',
      assemblees: 'Convocatórias, votos, atas',
      annonces: 'Informações do seu administrador',
      informations: 'A sua fração tal como o administrador a conhece',
      question: 'O Fixy responde com as informações do seu espaço',
    },
    commun: {
      signalerProbleme: 'Reportar um problema',
      voirDetail: 'Ver detalhe',
      masquerDetail: 'Ocultar detalhe',
      voirTout: 'Ver tudo',
      fermer: 'Fechar',
      annuler: 'Cancelar',
      reessayer: 'Tentar novamente',
      envoyer: 'Enviar',
      copier: 'Copiar',
      copie: 'Copiado',
      ouvrir: 'Abrir',
      chargement: 'A carregar o seu espaço…',
      mettreAJour: 'Atualizar',
      derniereMiseAJour: 'Última atualização às {heure}',
      miseAJourImpossible: 'As informações apresentadas datam das {heure} (atualização impossível).',
      besoinAide: 'Precisa de ajuda?',
      lotAffiche: 'Fração apresentada',
      votreSyndic: 'o seu administrador',
      tousImmeubles: 'Todos os edifícios da administração',
      bonjour: 'Olá',
      batiment: 'bloco',
      etage: 'piso',
      lot: 'fração',
      ttc: 'c/ IVA',
      aucunMontant: 'Valor não comunicado',
    },
    shell: {
      demoVisiteur: 'Está a consultar uma demonstração: os valores, documentos e obras são fictícios.',
      demoSuperAdmin: 'Demonstração — está a ver o espaço de {nom}.',
      vueSuperAdminReelle: 'Vista de super admin — está a ver o espaço real de {nom} (ficha do seu gabinete).',
      seConnecter: 'Iniciar sessão',
      erreurReseau: 'Não foi possível carregar as suas informações de momento. Verifique a sua ligação à internet e tente novamente.',
      sessionExpiree: 'A sua sessão expirou.',
      meReconnecter: 'Voltar a iniciar sessão',
      tropDeDemandes: 'Demasiados pedidos em pouco tempo: aguarde um minuto e tente novamente.',
      espaceNonActiveTitre: 'O seu espaço ainda não está ativado',
      espaceNonActive: 'O seu administrador tem primeiro de registar a sua fração com o endereço {email}. Já pode reportar-lhe um problema.',
      roleInterdit: 'Este espaço é reservado aos condóminos e aos inquilinos.',
      coordonneesSyndic: 'Contactos do seu administrador',
    },
    accueil: {
      aRegler: 'A pagar: {montant} até {date}',
      enRetard: 'Em atraso: {montant} desde {date}',
      aJour: 'Está em dia',
      aucunAppel: 'Nenhum aviso de quotas registado',
      voirCommentPayer: 'Ver como pagar',
      demandesEnCours: 'Os seus pedidos em curso',
      aucuneDemande: 'Ainda não enviou nenhum pedido.',
      voirToutesDemandes: 'Ver todos os meus pedidos',
      prochaineAssemblee: 'Próxima assembleia',
      resolutionsAttendent: '{n} deliberação(ões) em {total} aguardam o seu voto',
      voter: 'Votar por correspondência',
      travauxEnCours: 'Obras no edifício',
      aucunTravaux: 'Nenhuma obra em curso no edifício.',
      dernieresAnnonces: 'Últimos avisos',
      aucuneAnnonce: 'Nenhum aviso de momento.',
    },
    demandes: {
      ongletMesDemandes: 'Os meus pedidos',
      ongletTravaux: 'Obras no edifício',
      nouvelleDemande: 'Reportar um problema',
      envoyeeLe: 'enviado em {date}',
      miseAJourLe: 'última atualização em {date}',
      passagePrevu: 'Visita prevista em {date}',
      prestataire: 'Prestador: {nom}',
      etapes: { recue: 'Recebido', priseEnCharge: 'Em tratamento', enCours: 'Em curso', terminee: 'Concluído' },
      statuts: {
        en_attente: 'Recebido pelo administrador',
        acceptee: 'Em tratamento — prestador: {nom}',
        accepteeSansPrestataire: 'Em tratamento pelo administrador',
        en_cours: 'Intervenção em curso',
        terminee: 'Concluído',
        annulee: 'Arquivado pelo administrador',
      },
      statutsTravaux: {
        en_attente: 'A planear',
        acceptee: 'Prestador designado',
        en_cours: 'Em curso',
        terminee: 'Obras concluídas',
        annulee: 'Canceladas',
      },
      fil: 'Conversa com o seu administrador',
      vous: 'Você',
      syndic: 'O seu administrador',
      ecrireAuSyndic: 'Escrever ao administrador',
      messagePlaceholder: 'A sua mensagem para o administrador…',
      messageEnvoye: 'Mensagem enviada ao seu administrador.',
      messageErreur: 'Não foi possível enviar a sua mensagem. Tente novamente dentro de instantes.',
      compteRendu: 'Relatório da intervenção',
      travailEffectue: 'Trabalho efetuado',
      materiaux: 'Materiais utilizados',
      problemes: 'Problemas constatados',
      recommandations: 'Recomendações',
      duree: 'Duração',
      coutCopropriete: 'Custo para o condomínio',
      devis: 'orçamento',
      facture: 'faturado',
      documentsPrestataire: 'Documentos do prestador',
      typesDocument: { devis: 'Orçamento', rapport: 'Relatório', facture: 'Fatura' },
      aucuneDemande: 'Ainda não enviou nenhum pedido.',
      aucunTravaux: 'Nenhuma obra em curso no edifício.',
      partiesCommunes: 'Partes comuns',
      monLogement: 'A minha habitação',
      deposeeSansCompte: 'Pedido apresentado sem iniciar sessão no seu espaço (formulário público ou código QR), com o seu endereço de e-mail. Se não foi o autor, avise o administrador.',
      ouProbleme: 'Onde está o problema?',
      dansMonLogement: 'Na minha habitação ({lieu})',
      dansPartiesCommunes: 'Nas partes comuns (hall, escadas, elevador, cave, estacionamento…)',
      zone: 'Que zona?',
      choisirZone: 'Escolher uma zona…',
      autreZone: 'Outra (especifique na descrição)',
      typeProbleme: 'Que tipo de problema?',
      choisirType: 'Escolher…',
      decrivez: 'Descreva o problema',
      decrivezPlaceholder: 'Descreva com precisão o problema constatado…',
      descriptionMinimum: 'Mínimo de 10 caracteres, para que o administrador compreenda o problema.',
      descriptionEncore: 'Faltam {n} caractere(s): mínimo de 10 caracteres.',
      urgent: 'É urgente?',
      urgenceNon: 'Não, não tem pressa',
      urgenceGenant: 'Sim, é incómodo (em 48 h)',
      urgenceUrgent: 'Sim, é urgente (fuga grave, elevador avariado, perigo)',
      envoyerAuSyndic: 'Enviar ao administrador',
      envoiEnCours: 'A enviar…',
      transmisAuSyndic: 'O seu pedido é transmitido ao seu administrador, não diretamente a um técnico.',
      confirmationTitre: 'O seu pedido foi enviado ao seu administrador em {date}.',
      confirmationNumero: 'Número: {numero}',
      confirmationSuite: 'Acompanhará o seu tratamento aqui, em « Os meus pedidos ».',
      voirMaDemande: 'Ver o meu pedido',
      autreDemande: 'Fazer outro pedido',
      erreurType: 'Escolha o tipo de problema.',
      erreurDescription: 'Descreva o problema com pelo menos 10 caracteres.',
      erreurInvalide: 'O administrador não conseguiu registar esta ocorrência: verifique a descrição e tente novamente.',
      erreurTropDeDemandes: 'Demasiados envios em pouco tempo: tente novamente dentro de um minuto.',
      erreurServeur: 'Não foi possível enviar a ocorrência. Tente novamente dentro de instantes.',
      erreurReseau: 'Sem ligação: verifique a sua rede e tente novamente.',
    },
    charges: {
      ceQueVousDevez: 'O que deve',
      aReglerAvant: '{montant} a pagar até {date}',
      aRegler: '{montant} a pagar',
      aJour: 'Está em dia',
      retard: 'Pagamento em atraso: {montant} desde {date}',
      relanceEnvoyee: 'lembrete enviado em {date}',
      commentPayer: 'Como pagar',
      parVirement: 'Por transferência para o seu administrador',
      iban: 'IBAN',
      copierIban: 'Copiar o IBAN',
      reference: 'Referência a indicar',
      pasDePaiementEnLigne: 'O pagamento online não está disponível; pode também pagar por cheque junto do seu administrador.',
      ibanInconnu: 'O seu administrador não lhe comunicou um IBAN: contacte-o para conhecer os meios de pagamento.',
      vosAppels: 'Os seus avisos de quotas',
      chargesDu: 'Quotas de {debut} a {fin}',
      montant: 'Valor',
      regle: 'Pago',
      reste: 'Em falta',
      statutsAppel: {
        a_payer: 'A pagar',
        partiellement_paye: 'Pago em parte (falta {reste})',
        solde: 'Pago',
        en_retard: 'Em atraso',
        annule: 'Anulado',
      },
      aucunAppel: 'O seu administrador ainda não publicou nenhum aviso de quotas.',
      factures: 'Faturas do seu administrador',
      aucuneFacture: 'Nenhuma fatura de momento.',
      dontTva: 'dos quais IVA {montant}',
      ouvrirPdf: 'Abrir o PDF',
      statutsFacture: {
        a_regler: 'A pagar',
        partiellement_regle: 'Paga em parte',
        reglee: 'Paga',
        contestee: 'Contestada',
        annulee: 'Anulada',
      },
      retardsDePaiement: 'Pagamentos em atraso',
      natures: {
        charges_courantes: 'Quotas correntes',
        travaux: 'Obras',
        fonds_reserve: 'Fundo de reserva',
        interets_retard: 'Juros de mora',
        frais_relance: 'Despesas de cobrança',
        autre: 'Outro',
      },
      statutsImpaye: {
        ouvert: 'Por regularizar',
        en_recouvrement: 'Em cobrança',
        solde: 'Regularizado',
        passe_perte: 'Encerrado',
      },
      depuisLe: 'desde {date}',
      relances: '{n} lembrete(s)',
      comprendre: 'Compreender as minhas quotas',
      tantiemesPhrase: 'A sua fração tem {tantiemes} de permilagem em {total}: paga {pourcentage} das despesas comuns.',
      budgetPhrase: 'Orçamento do condomínio: {budget}; gasto até à data: {depenses}.',
      soldeDu: 'Saldo da sua conta: {montant} (valor em dívida)',
      soldeCredit: 'Saldo da sua conta: {montant} (a seu favor)',
    },
    documents: {
      reglement: 'Regulamento do condomínio',
      misAJourLe: 'Atualizado em {date}',
      repartition: 'Repartição das despesas',
      majorite: 'Maioria em assembleia',
      fondsTravaux: 'Fundo de obras',
      fondsRoulement: 'Fundo de maneio',
      oui: 'sim',
      non: 'não',
      ouvrirReglement: 'Abrir o regulamento',
      reglementTexte: 'Ler o regulamento',
      pv: 'Atas de assembleia',
      contrats: 'Contratos e seguros',
      devis: 'Orçamentos de obras',
      autres: 'Outros documentos',
      ajouteLe: 'adicionado em {date}',
      jusquAu: 'até {date}',
      police: 'apólice n.º {numero}',
      aucunDocument: 'O seu administrador ainda não depositou nenhum documento para o seu edifício.',
      erreurOuverture: 'Não foi possível abrir este documento de momento. Tente novamente dentro de instantes.',
      ouvertureEnCours: 'A abrir…',
      categoriesContrat: { limpezas: 'Limpezas', elevadores: 'Elevadores', seguranca: 'Segurança', jardinagem: 'Jardinagem', outros: 'Outro' },
      typesAssurance: { multirriscos: 'Seguro multirriscos', responsabilidade_civil: 'Responsabilidade civil', incendio: 'Incêndio', outros: 'Seguro' },
      statutsContrat: { ativo: 'Em vigor', ativa: 'Em vigor', expirado: 'Expirado', expirada: 'Expirada', renovacao: 'Em renovação' },
      parMois: '{montant} por mês',
      parAn: '{montant} por ano',
    },
    assemblees: {
      prochaine: 'Próxima assembleia',
      resolutionsAttendent: '{n} deliberação(ões) em {total} aguardam o seu voto',
      voter: 'Votar por correspondência',
      voterJusquAu: 'Pode votar até {date}',
      voteClos: 'O voto por correspondência está encerrado desde {date}.',
      ordreDuJour: 'Ordem do dia',
      resolutions: 'Deliberações',
      majoriteRequise: 'Maioria exigida: {majorite}',
      majorites: {
        art24: 'maioria simples',
        art25: 'maioria absoluta',
        art26: 'dupla maioria',
        unanimite: 'unanimidade',
      },
      pour: 'A favor',
      contre: 'Contra',
      abstention: 'Abstenção',
      confirmationTitre: 'Vota {choix} na deliberação n.º {numero}',
      confirmationTexte: 'A sua escolha será transmitida ao seu administrador, que a regista no formulário de voto por correspondência. Pode alterá-la até {date}. Se assistir à assembleia, votará em sessão.',
      confirmationNote: 'Se a deliberação for alterada em sessão, o voto por correspondência pode não ser contabilizado.',
      confirmerVote: 'Confirmar o meu voto',
      votreVote: 'O seu voto: {choix}',
      enregistreLe: 'registado em {date}',
      modifier: 'Alterar',
      voteErreur: 'Não foi possível registar o seu voto. Tente novamente ou contacte o seu administrador.',
      voteEnregistre: 'O seu voto foi registado.',
      choix: { pour: 'A FAVOR', contre: 'CONTRA', abstention: 'ABSTENÇÃO' },
      resultats: 'Resultados',
      adoptee: 'Aprovada',
      rejetee: 'Rejeitada',
      enCours: 'Votação em curso',
      tantiemes: 'permilagem',
      pvTitre: 'Ata',
      contestation: 'Não concorda com uma deliberação? Tem até {date} para a impugnar (art. 1433.º do Código Civil).',
      contestationEcoulee: 'O prazo de impugnação (art. 1433.º do Código Civil) expirou.',
      copierModele: 'Copiar um modelo de carta',
      modeleCopie: 'Modelo de carta copiado.',
      precedentes: 'Assembleias anteriores',
      statuts: { convoquee: 'Convocada', en_cours: 'Em curso', cloturee: 'Encerrada', annulee: 'Anulada' },
      types: { ordinaire: 'Assembleia geral ordinária', extraordinaire: 'Assembleia geral extraordinária' },
      aucune: 'Nenhuma assembleia agendada. Será informado aqui assim que for convocada.',
      convocationEnvoyee: 'Convocatória enviada em {date}',
    },
    annonces: {
      epinglee: 'Fixado pelo administrador',
      urgent: 'Urgente',
      important: 'Importante',
      publieLe: 'Publicado em {date} pelo seu administrador',
      categories: {
        manutencao: 'Obras e manutenção',
        assembleia: 'Assembleia',
        financeiro: 'Finanças',
        seguranca: 'Segurança',
        social: 'Vida do edifício',
        outro: 'Outro',
      },
      aucune: 'Nenhum aviso de momento. O seu administrador publica aqui as informações do edifício (obras, cortes, assembleias).',
    },
    informations: {
      votreLot: 'A sua fração',
      votreLogement: 'A sua habitação',
      tantiemes: '{tantiemes} de permilagem ({pourcentage} das despesas)',
      coordonnees: 'Os seus contactos conhecidos do administrador',
      nom: 'Nome',
      email: 'E-mail',
      telephone: 'Telefone',
      nonRenseigne: 'não indicado',
      inexact: 'Alguma informação está errada? Contacte o seu administrador: só ele a pode corrigir.',
      votreSyndic: 'O seu administrador',
      gestionnaire: 'Gestor do edifício: {nom}',
      syndicInconnu: 'Contactos do administrador não indicados.',
      langue: 'Língua',
      francais: 'Français',
      portugais: 'Português',
      meDeconnecter: 'Terminar sessão',
      confirmationDeconnexion: 'Vai terminar a sessão.',
      rester: 'Ficar',
      locataireNote: 'Os seus pedidos são visíveis pelo administrador e pelo proprietário da sua habitação.',
      changerLot: 'Mudar de fração',
    },
    question: {
      titre: 'Fazer uma pergunta',
      intro: 'O Fixy é um assistente automático: responde com as informações do seu espaço. Para qualquer decisão, contacte o seu administrador.',
      questions: [
        'Quanto tenho de pagar e até quando?',
        'Em que ponto está o meu pedido?',
        'Quando é a próxima assembleia?',
        'Como contactar o meu administrador?',
      ],
      placeholder: 'Escreva a sua pergunta',
      envoyer: 'Enviar',
      nouvelleConversation: 'Nova conversa',
      demo: 'Respondo com dados de demonstração.',
      erreur: 'O Fixy não responde de momento. Tente novamente dentro de instantes ou contacte o seu administrador.',
      pasDeReponse: 'Desculpe, não consegui responder de momento.',
      fixy: 'Fixy',
    },
  },
} as const

export type TextesCopro = typeof TEXTES.fr

/** Textes de l'espace dans la langue du site (français par défaut). */
export function textesCopro(locale: string | null | undefined): TextesCopro {
  return (langueCopro(locale) === 'pt' ? TEXTES.pt : TEXTES.fr) as TextesCopro
}

/** Remplace les {noms} d'un texte : remplir('{montant} avant le {date}', { montant: '855 €', date: '15 octobre 2026' }). */
export function remplir(texte: string, valeurs: Record<string, string | number>): string {
  return texte.replace(/\{(\w+)\}/g, (_, cle: string) => (cle in valeurs ? String(valeurs[cle]) : `{${cle}}`))
}

// ── Mise en forme ─────────────────────────────────────────────────────────────

const LOCALE_INTL: Record<LangueCopro, string> = { fr: 'fr-FR', pt: 'pt-PT' }

/** Montant en euros : « 855 € », « 1 462,50 € ». */
export function euros(montant: number, langue: LangueCopro = 'fr'): string {
  const rond = Number.isInteger(montant)
  return new Intl.NumberFormat(LOCALE_INTL[langue], {
    style: 'currency', currency: 'EUR', minimumFractionDigits: rond ? 0 : 2, maximumFractionDigits: 2,
  }).format(montant)
}

/** Date en toutes lettres : « 15 octobre 2026 » ; chaîne vide si la date est illisible. */
export function dateLongue(iso: string | null | undefined, langue: LangueCopro = 'fr', avecJour = false): string {
  if (!iso) return ''
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso)
  if (Number.isNaN(d.getTime())) return ''
  const texte = new Intl.DateTimeFormat(LOCALE_INTL[langue], {
    ...(avecJour ? { weekday: 'long' } : {}), day: 'numeric', month: 'long', year: 'numeric',
  }).format(d)
  return langue === 'fr' ? texte.replace(/(^|\s)1 /, (_, avant: string) => `${avant}1er `) : texte
}

/** Date et heure : « jeudi 19 novembre 2026 à 18 h 00 ». */
export function dateHeure(iso: string | null | undefined, langue: LangueCopro = 'fr'): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const jour = dateLongue(iso, langue, true)
  const heure = new Intl.DateTimeFormat(LOCALE_INTL[langue], { hour: '2-digit', minute: '2-digit' }).format(d)
  return langue === 'fr' ? `${jour} à ${heure.replace(':', ' h ')}` : `${jour} às ${heure}`
}

/** Heure courte : « 14 h 05 ». */
export function heureCourte(date: Date, langue: LangueCopro = 'fr'): string {
  const h = new Intl.DateTimeFormat(LOCALE_INTL[langue], { hour: '2-digit', minute: '2-digit' }).format(date)
  return langue === 'fr' ? h.replace(':', ' h ') : h
}

/** Taille lisible : « 2,4 Mo », « 760 Ko ». */
export function tailleLisible(octets: number, langue: LangueCopro = 'fr'): string {
  if (octets <= 0) return ''
  const nf = new Intl.NumberFormat(LOCALE_INTL[langue], { maximumFractionDigits: 1 })
  if (octets >= 1_000_000) return `${nf.format(octets / 1_000_000)} ${langue === 'fr' ? 'Mo' : 'MB'}`
  if (octets >= 1_000) return `${nf.format(Math.round(octets / 1_000))} ${langue === 'fr' ? 'Ko' : 'KB'}`
  return `${octets} ${langue === 'fr' ? 'o' : 'B'}`
}

/** Pourcentage : « 4,5 % ». */
export function pourcentage(valeur: number, langue: LangueCopro = 'fr'): string {
  return `${new Intl.NumberFormat(LOCALE_INTL[langue], { maximumFractionDigits: 2 }).format(valeur)} %`
}

// ── Libellés des valeurs de la base ───────────────────────────────────────────

/** Statut d'une demande du copropriétaire, en mots (avec le prestataire quand il est connu). */
export function libelleStatutDemande(statut: StatutIntervention, prestataire: string, t: TextesCopro): string {
  if (statut === 'acceptee') return prestataire ? remplir(t.demandes.statuts.acceptee, { nom: prestataire }) : t.demandes.statuts.accepteeSansPrestataire
  return t.demandes.statuts[statut]
}

export function libelleStatutTravaux(statut: StatutIntervention, t: TextesCopro): string {
  return t.demandes.statutsTravaux[statut]
}

export function libelleStatutAppel(statut: StatutAppel, reste: string, t: TextesCopro): string {
  return remplir(t.charges.statutsAppel[statut], { reste })
}

export function libelleStatutFacture(statut: StatutFacture, t: TextesCopro): string {
  return t.charges.statutsFacture[statut]
}

export function libelleNatureImpaye(nature: NatureImpaye, t: TextesCopro): string {
  return t.charges.natures[nature]
}

export function libelleCategorieContrat(categorie: string, t: TextesCopro): string {
  const c = t.documents.categoriesContrat as Record<string, string>
  return c[categorie] ?? c.outros
}

export function libelleTypeAssurance(type: string, t: TextesCopro): string {
  const c = t.documents.typesAssurance as Record<string, string>
  return c[type] ?? c.outros
}

export function libelleStatutContrat(statut: string, t: TextesCopro): string {
  const c = t.documents.statutsContrat as Record<string, string>
  return c[statut] ?? statut
}

export function libelleTypeDocument(type: TypeDocumentImmeuble, t: TextesCopro): string {
  switch (type) {
    case 'pv_assemblee':
    case 'ata_ag': return t.documents.pv
    case 'contrat': return t.documents.contrats
    case 'devis': return t.documents.devis
    default: return t.documents.autres
  }
}

export function libelleMajorite(majorite: MajoriteResolution, t: TextesCopro): string {
  return t.assemblees.majorites[majorite]
}

export function libelleChoixVote(choix: ChoixVote, t: TextesCopro): string {
  return t.assemblees.choix[choix]
}

export function libelleStatutAssemblee(statut: StatutAssemblee, t: TextesCopro): string {
  return t.assemblees.statuts[statut]
}

export function libelleCategorieAnnonce(categorie: CategorieAnnonce, t: TextesCopro): string {
  return t.annonces.categories[categorie]
}

// ── Formulaire de signalement ─────────────────────────────────────────────────

/** Types de problème proposés (sans pictogramme : c'est ce que le syndic reçoit). */
export const TYPES_PROBLEME: Record<LangueCopro, readonly string[]> = {
  fr: [
    'Plomberie (fuite, colonne, robinetterie)',
    'Électricité (panne, tableau, prise)',
    'Chauffage / climatisation',
    'Ascenseur',
    'Menuiserie (porte, fenêtre, serrure)',
    'Interphone / digicode',
    'Éclairage des parties communes',
    'Gros œuvre (fissure, infiltration)',
    'Sinistre (dégât des eaux, incendie)',
    'Nettoyage / entretien',
    'Espaces verts',
    'Peinture / revêtement',
    'Urgence sécurité',
    'Autre',
  ],
  pt: [
    'Canalização (fuga, coluna, torneira)',
    'Eletricidade (avaria, quadro, tomada)',
    'Aquecimento / climatização',
    'Elevador',
    'Carpintaria (porta, janela, fechadura)',
    'Intercomunicador / código',
    'Iluminação das partes comuns',
    'Obra pesada (fissura, infiltração)',
    'Sinistro (inundação, incêndio)',
    'Limpeza / manutenção',
    'Espaços verdes',
    'Pintura / revestimento',
    'Urgência de segurança',
    'Outro',
  ],
}

export const ZONES_COMMUNES: Record<LangueCopro, readonly string[]> = {
  fr: [
    'Hall d’entrée', 'Couloir / palier', 'Escalier', 'Ascenseur', 'Cave / sous-sol', 'Parking / garage',
    'Toiture / terrasse', 'Jardin / espace vert', 'Local poubelles', 'Local vélos', 'Façade extérieure',
    'Boîtes aux lettres', 'Chaufferie', 'Compteurs communs',
  ],
  pt: [
    'Entrada / hall', 'Corredor / patamar', 'Escadas', 'Elevador', 'Cave / subsolo', 'Estacionamento / garagem',
    'Cobertura / terraço', 'Jardim / espaço verde', 'Sala do lixo', 'Sala de bicicletas', 'Fachada exterior',
    'Caixas de correio', 'Central térmica', 'Contadores comuns',
  ],
}
