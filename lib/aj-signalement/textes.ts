// ── Textes de l'application publique « AJ Signalement » (FR / PT) ─────────────
//
// Le parcours reprend celui de « Signaler un problème » du portail copropriétaire (bloc `demandes` de
// lib/coproprietaire/textes.ts : où, quel type, description, urgence). Ne figurent ici que les libellés
// propres au dépôt par QR code : coordonnées obligatoires, confirmation, erreurs. Les textes du
// tableau de bord (vue super admin) sont en français seulement, dans le composant.

import type { LangueSignalementQr } from '@/lib/aj-signalement/types'

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
  etage: string
  numLot: string
  votreLogement: string
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
    coordonneesAide: 'Tous les champs sont obligatoires, sauf le bâtiment : l’administrateur doit pouvoir vous rappeler.',
    prenom: 'Prénom',
    nom: 'Nom',
    telephone: 'Numéro de téléphone',
    email: 'Adresse e-mail',
    batiment: 'Bâtiment (facultatif)',
    etage: 'Étage',
    numLot: 'Numéro de lot',
    votreLogement: 'votre logement',
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
    coordonneesAide: 'Todos os campos são obrigatórios, exceto o bloco: o administrador tem de poder contactá-lo.',
    prenom: 'Nome próprio',
    nom: 'Apelido',
    telephone: 'Número de telefone',
    email: 'Endereço de e-mail',
    batiment: 'Bloco (facultativo)',
    etage: 'Piso',
    numLot: 'Número da fração',
    votreLogement: 'a sua habitação',
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
