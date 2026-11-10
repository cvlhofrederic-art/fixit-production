// ── Textes de l'application publique « AJ Signalement » (FR / PT) ─────────────
//
// Le parcours reprend celui de « Signaler un problème » du portail copropriétaire (bloc `demandes` de
// lib/coproprietaire/textes.ts : où, quel type, description, urgence). Ne figurent ici que les libellés
// propres au dépôt par QR code : coordonnées obligatoires (bâtiment et qualité compris), adresse proposée d'après
// la position, signalements déjà faits au même endroit, confirmation, erreurs. Les textes du tableau de bord (vue
// super admin) sont en français seulement (lib/aj-signalement/affichage.ts).

import type { LangueSignalementQr, QualiteDeclarantQr, StatutOuvertQr } from '@/lib/aj-signalement/types'

export interface TextesSignalementQr {
  application: string
  titre: string
  accroche: string
  coordonnees: string
  coordonneesAide: string
  prenom: string
  nom: string
  telephone: string
  email: string
  batiment: string
  batimentAide: string
  etage: string
  numLot: string
  qualite: string
  qualites: Record<QualiteDeclarantQr, string>
  votreLogement: string
  copropriete: string
  geolocalisationExplication: string
  adresseRecherche: string
  adresseProposee: string
  positionRefusee: string
  adresseIntrouvable: string
  semblablesTitre: string
  semblablesAide: string
  /** Annonce aux lecteurs d'écran de l'apparition de la liste : un signalement, ou {n} signalements. */
  semblablesAnnonceUn: string
  semblablesAnnonce: string
  semblableNumero: string
  statutsSemblables: Record<StatutOuvertQr, string>
  memeProbleme: string
  autreProbleme: string
  rattacheA: string
  nouveauProbleme: string
  envoyer: string
  envoiEnCours: string
  transmis: string
  confirmationTitre: string
  confirmationNumero: string
  confirmationSuite: string
  autreSignalement: string
  champObligatoire: string
  emailInvalide: string
  telephoneInvalide: string
  erreurs: {
    invalide: string
    trop_de_demandes: string
    serveur: string
    reseau: string
    introuvable: string
    base_absente: string
  }
  piedDePage: string
}

export const TEXTES_SIGNALEMENT_QR: Record<LangueSignalementQr, TextesSignalementQr> = {
  fr: {
    application: 'AJ Signalement',
    titre: 'Signaler un problème',
    accroche: 'Vous avez constaté un problème dans la copropriété {copropriete} ? Décrivez-le ici : l’administrateur le reçoit immédiatement.',
    coordonnees: 'Vos coordonnées',
    coordonneesAide: 'Tous les champs sont obligatoires : l’administrateur doit pouvoir vous rappeler.',
    prenom: 'Prénom',
    nom: 'Nom',
    telephone: 'Numéro de téléphone',
    email: 'Adresse e-mail',
    batiment: 'Bâtiment',
    batimentAide: 'Lettre, numéro ou nom du bâtiment (ex. A, 2, Les Pins).',
    etage: 'Étage',
    numLot: 'Numéro de lot',
    qualite: 'Vous êtes :',
    qualites: { proprietaire: 'Propriétaire', locataire: 'Locataire' },
    votreLogement: 'votre logement',
    copropriete: 'Copropriété',
    geolocalisationExplication: 'Votre position sert seulement à proposer l’adresse de la copropriété, jointe à votre signalement ; elle n’est pas conservée.',
    adresseRecherche: 'Recherche de l’adresse…',
    adresseProposee: 'Adresse d’après votre position : {adresse}',
    positionRefusee: 'Position non partagée : vous pouvez envoyer votre signalement normalement.',
    adresseIntrouvable: 'Adresse non trouvée : vous pouvez envoyer votre signalement normalement.',
    semblablesTitre: 'Signalements déjà faits à cet endroit',
    semblablesAide: 'D’autres personnes ont déjà signalé un problème ici. Est-ce le même ? Votre choix n’empêche pas l’envoi.',
    semblablesAnnonceUn: '1 signalement a déjà été fait à cet endroit ; il est listé sous la zone. Est-ce le même problème ?',
    semblablesAnnonce: '{n} signalements ont déjà été faits à cet endroit ; ils sont listés sous la zone. Est-ce le même problème ?',
    semblableNumero: 'N° {numero}',
    statutsSemblables: { en_attente: 'Reçu', acceptee: 'Pris en charge', en_cours: 'En cours' },
    memeProbleme: 'C’est le même problème',
    autreProbleme: 'C’est un autre problème',
    rattacheA: 'Votre signalement sera rattaché au n° {numero}.',
    nouveauProbleme: 'Votre signalement sera enregistré comme un nouveau problème.',
    envoyer: 'Envoyer le signalement',
    envoiEnCours: 'Envoi en cours…',
    transmis: 'Votre signalement est transmis à l’administrateur de la copropriété, pas directement à un artisan.',
    confirmationTitre: 'Votre signalement a bien été envoyé le {date}.',
    confirmationNumero: 'Numéro : {numero}',
    confirmationSuite: 'L’administrateur vous recontactera au {telephone} ou à l’adresse {email}.',
    autreSignalement: 'Faire un autre signalement',
    champObligatoire: 'Ce champ est obligatoire.',
    emailInvalide: 'Indiquez une adresse e-mail valide (ex. nom@domaine.fr).',
    telephoneInvalide: 'Indiquez un numéro de téléphone valide.',
    erreurs: {
      invalide: 'Le signalement n’a pas pu être enregistré : vérifiez vos coordonnées et la description, puis réessayez.',
      trop_de_demandes: 'Trop d’envois en peu de temps : réessayez dans une minute.',
      serveur: 'Le signalement n’a pas pu être envoyé. Réessayez dans un instant.',
      reseau: 'Connexion impossible : vérifiez votre réseau puis réessayez.',
      introuvable: 'Ce QR code n’est plus valable. Rapprochez-vous de l’administrateur de la copropriété.',
      base_absente: 'Le service de signalement n’est pas encore activé. Réessayez plus tard.',
    },
    piedDePage: 'AJ Signalement — un service VITFIX',
  },
  pt: {
    application: 'AJ Signalement',
    titre: 'Reportar um problema',
    accroche: 'Detetou um problema no condomínio {copropriete}? Descreva-o aqui: o administrador recebe-o imediatamente.',
    coordonnees: 'Os seus contactos',
    coordonneesAide: 'Todos os campos são obrigatórios: o administrador tem de poder contactá-lo.',
    prenom: 'Nome próprio',
    nom: 'Apelido',
    telephone: 'Número de telefone',
    email: 'Endereço de e-mail',
    batiment: 'Bloco',
    batimentAide: 'Letra, número ou nome do bloco (ex. A, 2, Os Pinheiros).',
    etage: 'Piso',
    numLot: 'Número da fração',
    qualite: 'Na qualidade de:',
    qualites: { proprietaire: 'Proprietário', locataire: 'Inquilino' },
    votreLogement: 'a sua habitação',
    copropriete: 'Condomínio',
    geolocalisationExplication: 'A sua localização serve apenas para propor o endereço do condomínio, anexado à sua ocorrência; não é guardada.',
    adresseRecherche: 'A procurar o endereço…',
    adresseProposee: 'Endereço segundo a sua localização: {adresse}',
    positionRefusee: 'Localização não partilhada: pode enviar a sua ocorrência normalmente.',
    adresseIntrouvable: 'Endereço não encontrado: pode enviar a sua ocorrência normalmente.',
    semblablesTitre: 'Ocorrências já reportadas neste local',
    semblablesAide: 'Outras pessoas já reportaram um problema aqui. É o mesmo? A sua escolha não impede o envio.',
    semblablesAnnonceUn: 'Já foi reportada 1 ocorrência neste local; está listada abaixo da zona. É o mesmo problema?',
    semblablesAnnonce: 'Já foram reportadas {n} ocorrências neste local; estão listadas abaixo da zona. É o mesmo problema?',
    semblableNumero: 'N.º {numero}',
    statutsSemblables: { en_attente: 'Recebida', acceptee: 'Em tratamento', en_cours: 'Em curso' },
    memeProbleme: 'É o mesmo problema',
    autreProbleme: 'É outro problema',
    rattacheA: 'A sua ocorrência ficará associada à n.º {numero}.',
    nouveauProbleme: 'A sua ocorrência será registada como um novo problema.',
    envoyer: 'Enviar a ocorrência',
    envoiEnCours: 'A enviar…',
    transmis: 'A sua ocorrência é transmitida ao administrador do condomínio, não diretamente a um profissional.',
    confirmationTitre: 'A sua ocorrência foi enviada em {date}.',
    confirmationNumero: 'Número: {numero}',
    confirmationSuite: 'O administrador contactá-lo-á pelo {telephone} ou pelo e-mail {email}.',
    autreSignalement: 'Reportar outro problema',
    champObligatoire: 'Este campo é obrigatório.',
    emailInvalide: 'Indique um endereço de e-mail válido (ex. nome@dominio.pt).',
    telephoneInvalide: 'Indique um número de telefone válido.',
    erreurs: {
      invalide: 'A ocorrência não pôde ser registada: verifique os seus contactos e a descrição e tente novamente.',
      trop_de_demandes: 'Demasiados envios em pouco tempo: tente novamente dentro de um minuto.',
      serveur: 'A ocorrência não pôde ser enviada. Tente novamente dentro de instantes.',
      reseau: 'Ligação impossível: verifique a sua rede e tente novamente.',
      introuvable: 'Este código QR já não é válido. Contacte o administrador do condomínio.',
      base_absente: 'O serviço de ocorrências ainda não está ativo. Tente mais tarde.',
    },
    piedDePage: 'AJ Signalement — um serviço VITFIX',
  },
}
