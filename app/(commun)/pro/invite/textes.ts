// Textes de la page d'acceptation d'une invitation d'équipe pro, en français et en portugais (PT-PT). La page suit la
// langue de la société qui invite (fiche profiles_artisan.language, renvoyée par GET /api/pro/invite), comme l'e-mail
// d'invitation ; avant cette réponse, celle du site (/pt/…), la même au rendu serveur et dans le navigateur.

import type { DefautMotDePasse } from '@/lib/equipe/mot-de-passe-invitation'

export type LangueInvitation = 'fr' | 'pt'

/** Motif d'un lien refusé (codes de /api/pro/invite) ou panne réseau. */
export type MotifRefus = 'invalide' | 'deja_utilisee' | 'desactivee' | 'expiree' | 'reseau'

/** Erreur affichée sous le formulaire (codes de /api/pro/invite, plus le trop-plein et la panne réseau). */
export type ErreurFormulaire =
  | 'mot_de_passe_incorrect'
  | 'non_confirme'
  | 'recharger'
  | 'non_validee'
  | 'erreur'
  | 'trop'
  | 'reseau'
  | 'differents'

interface TextesInvitation {
  badge: string
  verification: string
  titre: string
  invitation: (societe: string, role: string) => string
  compte: string
  nom: string
  introNouveau: string
  introExistant: string
  introInconnu: string
  motDePasse: string
  motDePasseDuCompte: string
  confirmer: string
  aideNouveau: string
  boutonCreer: string
  boutonRejoindre: string
  enCours: string
  oublie: string
  seConnecter: string
  ouverture: string
  defauts: Record<DefautMotDePasse, string>
  erreurs: Record<ErreurFormulaire, string>
  autreEspace: { titre: string; texte: string }
  refus: Record<MotifRefus, { titre: string; texte: string }>
  succes: { titre: string; texteNouveau: string; texteExistant: string }
}

export const TEXTES: Record<LangueInvitation, TextesInvitation> = {
  fr: {
    badge: 'ESPACE PRO',
    verification: "Vérification de l'invitation…",
    titre: "Rejoindre l'équipe",
    invitation: (societe, role) => `${societe} vous invite en tant que ${role}`,
    compte: 'Compte',
    nom: 'Nom',
    introNouveau: 'Choisissez le mot de passe de votre compte Vitfix.',
    introExistant: "Vous avez déjà un compte Vitfix avec cette adresse. Entrez son mot de passe pour rejoindre l'équipe.",
    introInconnu: 'Choisissez votre mot de passe. Si vous avez déjà un compte Vitfix avec cette adresse, entrez le sien.',
    motDePasse: 'Mot de passe',
    motDePasseDuCompte: 'Mot de passe de votre compte Vitfix',
    confirmer: 'Confirmer le mot de passe',
    aideNouveau: 'Min. 8 caractères, 1 majuscule, 1 chiffre',
    boutonCreer: "Créer mon compte et rejoindre l'équipe",
    boutonRejoindre: "Rejoindre l'équipe",
    enCours: 'Un instant…',
    oublie: 'Mot de passe oublié ?',
    seConnecter: 'Se connecter',
    ouverture: 'Ouverture de votre espace…',
    defauts: {
      longueur: 'Minimum 8 caractères',
      majuscule: 'Au moins 1 majuscule',
      chiffre: 'Au moins 1 chiffre',
    },
    erreurs: {
      mot_de_passe_incorrect: 'Mot de passe incorrect. Réessayez, ou choisissez-en un nouveau avec « Mot de passe oublié ? ».',
      non_confirme: "L'adresse de ce compte n'a jamais été confirmée. Choisissez un mot de passe avec « Mot de passe oublié ? » : l'e-mail reçu la confirme.",
      recharger: 'Un compte existe déjà avec cette adresse. Rechargez la page.',
      non_validee: "Votre compte est prêt, mais l'invitation n'a pas pu être validée. Contactez le support.",
      erreur: 'Une erreur est survenue. Réessayez dans un instant.',
      trop: 'Trop de tentatives. Réessayez dans quelques minutes.',
      reseau: 'Erreur de connexion. Vérifiez votre réseau et réessayez.',
      differents: 'Les mots de passe ne correspondent pas',
    },
    autreEspace: {
      titre: 'Adresse déjà utilisée ailleurs',
      texte: "Cette adresse est déjà celle d'un autre espace Vitfix (artisan, client ou autre société). Demandez à votre responsable une invitation sur une autre adresse, ou contactez le support.",
    },
    refus: {
      invalide: { titre: 'Invitation invalide', texte: "Ce lien d'invitation n'est pas valable. Demandez une nouvelle invitation à votre responsable." },
      expiree: { titre: 'Invitation expirée', texte: 'Ce lien a expiré. Demandez une nouvelle invitation à votre responsable.' },
      desactivee: { titre: 'Invitation désactivée', texte: 'Cette invitation a été désactivée. Demandez une nouvelle invitation à votre responsable.' },
      deja_utilisee: { titre: 'Invitation déjà acceptée', texte: "Vous faites déjà partie de l'équipe. Connectez-vous avec votre compte Vitfix." },
      reseau: { titre: 'Erreur de connexion', texte: 'Réessayez dans un instant.' },
    },
    succes: {
      titre: "Bienvenue dans l'équipe",
      texteNouveau: 'Votre compte est prêt. Connectez-vous pour ouvrir votre espace.',
      texteExistant: 'Votre compte est rattaché. Connectez-vous avec le mot de passe de votre compte Vitfix.',
    },
  },
  pt: {
    badge: 'ESPAÇO PRO',
    verification: 'A verificar o convite…',
    titre: 'Juntar-se à equipa',
    invitation: (societe, role) => `${societe} convidou-o(a) como ${role}`,
    compte: 'Conta',
    nom: 'Nome',
    introNouveau: 'Escolha a palavra-passe da sua conta Vitfix.',
    introExistant: 'Já tem uma conta Vitfix com este endereço. Introduza a respetiva palavra-passe para se juntar à equipa.',
    introInconnu: 'Escolha a sua palavra-passe. Se já tem uma conta Vitfix com este endereço, introduza a dessa conta.',
    motDePasse: 'Palavra-passe',
    motDePasseDuCompte: 'Palavra-passe da sua conta Vitfix',
    confirmer: 'Confirmar a palavra-passe',
    aideNouveau: 'Mín. 8 caracteres, 1 maiúscula, 1 algarismo',
    boutonCreer: 'Criar a conta e juntar-me à equipa',
    boutonRejoindre: 'Juntar-me à equipa',
    enCours: 'Um momento…',
    oublie: 'Esqueceu-se da palavra-passe?',
    seConnecter: 'Iniciar sessão',
    ouverture: 'A abrir o seu espaço…',
    defauts: {
      longueur: 'Mínimo 8 caracteres',
      majuscule: 'Pelo menos 1 maiúscula',
      chiffre: 'Pelo menos 1 algarismo',
    },
    erreurs: {
      mot_de_passe_incorrect: 'Palavra-passe incorreta. Tente novamente ou defina uma nova em «Esqueceu-se da palavra-passe?».',
      non_confirme: 'O endereço desta conta nunca foi confirmado. Defina uma palavra-passe em «Esqueceu-se da palavra-passe?»: o e-mail recebido confirma-o.',
      recharger: 'Já existe uma conta com este endereço. Recarregue a página.',
      non_validee: 'A sua conta está pronta, mas o convite não pôde ser validado. Contacte o suporte.',
      erreur: 'Ocorreu um erro. Tente novamente dentro de instantes.',
      trop: 'Demasiadas tentativas. Tente novamente dentro de alguns minutos.',
      reseau: 'Erro de ligação. Verifique a sua rede e tente novamente.',
      differents: 'As palavras-passe não coincidem',
    },
    autreEspace: {
      titre: 'Endereço já utilizado noutro espaço',
      texte: 'Este endereço já pertence a outro espaço Vitfix (profissional, cliente ou outra empresa). Peça ao seu responsável um convite para outro endereço ou contacte o suporte.',
    },
    refus: {
      invalide: { titre: 'Convite inválido', texte: 'Esta ligação de convite não é válida. Peça um novo convite ao seu responsável.' },
      expiree: { titre: 'Convite expirado', texte: 'Esta ligação expirou. Peça um novo convite ao seu responsável.' },
      desactivee: { titre: 'Convite desativado', texte: 'Este convite foi desativado. Peça um novo convite ao seu responsável.' },
      deja_utilisee: { titre: 'Convite já aceite', texte: 'Já faz parte da equipa. Inicie sessão com a sua conta Vitfix.' },
      reseau: { titre: 'Erro de ligação', texte: 'Tente novamente dentro de instantes.' },
    },
    succes: {
      titre: 'Bem-vindo(a) à equipa',
      texteNouveau: 'A sua conta está pronta. Inicie sessão para abrir o seu espaço.',
      texteExistant: 'A sua conta foi associada. Inicie sessão com a palavra-passe da sua conta Vitfix.',
    },
  },
}
