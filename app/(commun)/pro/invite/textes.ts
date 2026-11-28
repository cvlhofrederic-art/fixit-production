// Textes de la page d'acceptation d'une invitation d'équipe pro, en français et en portugais (PT-PT). La page suit la
// langue de la société qui invite (fiche profiles_artisan.language, renvoyée par GET /api/pro/invite), comme l'e-mail
// d'invitation ; avant cette réponse, celle du site (/pt/…), la même au rendu serveur et dans le navigateur.
//
// Chaque texte porte ses deux langues côte à côte ({ fr, pt }), comme ROLE_LABELS (lib/permissions.ts) : une seule
// structure, lue par textesInvitation(langue).

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

type Bilingue<V> = { fr: V; pt: V }

const BILINGUE = {
  badge: { fr: 'ESPACE PRO', pt: 'ESPAÇO PRO' },
  verification: { fr: "Vérification de l'invitation…", pt: 'A verificar o convite…' },
  titre: { fr: "Rejoindre l'équipe", pt: 'Juntar-se à equipa' },
  invitation: {
    fr: (societe: string, role: string) => `${societe} vous invite en tant que ${role}`,
    pt: (societe: string, role: string) => `${societe} convidou-o(a) como ${role}`,
  },
  compte: { fr: 'Compte', pt: 'Conta' },
  nom: { fr: 'Nom', pt: 'Nome' },
  introNouveau: { fr: 'Choisissez le mot de passe de votre compte Vitfix.', pt: 'Escolha a palavra-passe da sua conta Vitfix.' },
  introExistant: {
    fr: "Vous avez déjà un compte Vitfix avec cette adresse. Entrez son mot de passe pour rejoindre l'équipe.",
    pt: 'Já tem uma conta Vitfix com este endereço. Introduza a respetiva palavra-passe para se juntar à equipa.',
  },
  introInconnu: {
    fr: 'Choisissez votre mot de passe. Si vous avez déjà un compte Vitfix avec cette adresse, entrez le sien.',
    pt: 'Escolha a sua palavra-passe. Se já tem uma conta Vitfix com este endereço, introduza a dessa conta.',
  },
  motDePasse: { fr: 'Mot de passe', pt: 'Palavra-passe' },
  motDePasseDuCompte: { fr: 'Mot de passe de votre compte Vitfix', pt: 'Palavra-passe da sua conta Vitfix' },
  confirmer: { fr: 'Confirmer le mot de passe', pt: 'Confirmar a palavra-passe' },
  aideNouveau: { fr: 'Min. 8 caractères, 1 majuscule, 1 chiffre', pt: 'Mín. 8 caracteres, 1 maiúscula, 1 algarismo' },
  boutonCreer: { fr: "Créer mon compte et rejoindre l'équipe", pt: 'Criar a conta e juntar-me à equipa' },
  boutonRejoindre: { fr: "Rejoindre l'équipe", pt: 'Juntar-me à equipa' },
  enCours: { fr: 'Un instant…', pt: 'Um momento…' },
  oublie: { fr: 'Mot de passe oublié ?', pt: 'Esqueceu-se da palavra-passe?' },
  seConnecter: { fr: 'Se connecter', pt: 'Iniciar sessão' },
  ouverture: { fr: 'Ouverture de votre espace…', pt: 'A abrir o seu espaço…' },
  defautLongueur: { fr: 'Minimum 8 caractères', pt: 'Mínimo 8 caracteres' },
  defautMajuscule: { fr: 'Au moins 1 majuscule', pt: 'Pelo menos 1 maiúscula' },
  defautChiffre: { fr: 'Au moins 1 chiffre', pt: 'Pelo menos 1 algarismo' },
  erreurMotDePasse: {
    fr: 'Mot de passe incorrect. Réessayez, ou choisissez-en un nouveau avec « Mot de passe oublié ? ».',
    pt: 'Palavra-passe incorreta. Tente novamente ou defina uma nova em «Esqueceu-se da palavra-passe?».',
  },
  erreurNonConfirme: {
    fr: "L'adresse de ce compte n'a jamais été confirmée. Choisissez un mot de passe avec « Mot de passe oublié ? » : l'e-mail reçu la confirme.",
    pt: 'O endereço desta conta nunca foi confirmado. Defina uma palavra-passe em «Esqueceu-se da palavra-passe?»: o e-mail recebido confirma-o.',
  },
  erreurRecharger: {
    fr: 'Un compte existe déjà avec cette adresse. Rechargez la page.',
    pt: 'Já existe uma conta com este endereço. Recarregue a página.',
  },
  erreurNonValidee: {
    fr: "Votre compte est prêt, mais l'invitation n'a pas pu être validée. Contactez le support.",
    pt: 'A sua conta está pronta, mas o convite não pôde ser validado. Contacte o suporte.',
  },
  erreurGenerale: { fr: 'Une erreur est survenue. Réessayez dans un instant.', pt: 'Ocorreu um erro. Tente novamente dentro de instantes.' },
  erreurTrop: { fr: 'Trop de tentatives. Réessayez dans quelques minutes.', pt: 'Demasiadas tentativas. Tente novamente dentro de alguns minutos.' },
  erreurReseau: { fr: 'Erreur de connexion. Vérifiez votre réseau et réessayez.', pt: 'Erro de ligação. Verifique a sua rede e tente novamente.' },
  erreurDifferents: { fr: 'Les mots de passe ne correspondent pas', pt: 'As palavras-passe não coincidem' },
  autreEspaceTitre: { fr: 'Adresse déjà utilisée ailleurs', pt: 'Endereço já utilizado noutro espaço' },
  autreEspaceTexte: {
    fr: "Cette adresse est déjà celle d'un autre espace Vitfix (artisan, client ou autre société). Demandez à votre responsable une invitation sur une autre adresse, ou contactez le support.",
    pt: 'Este endereço já pertence a outro espaço Vitfix (profissional, cliente ou outra empresa). Peça ao seu responsável um convite para outro endereço ou contacte o suporte.',
  },
  refusInvalideTitre: { fr: 'Invitation invalide', pt: 'Convite inválido' },
  refusInvalideTexte: {
    fr: "Ce lien d'invitation n'est pas valable. Demandez une nouvelle invitation à votre responsable.",
    pt: 'Esta ligação de convite não é válida. Peça um novo convite ao seu responsável.',
  },
  refusExpireeTitre: { fr: 'Invitation expirée', pt: 'Convite expirado' },
  refusExpireeTexte: {
    fr: 'Ce lien a expiré. Demandez une nouvelle invitation à votre responsable.',
    pt: 'Esta ligação expirou. Peça um novo convite ao seu responsável.',
  },
  refusDesactiveeTitre: { fr: 'Invitation désactivée', pt: 'Convite desativado' },
  refusDesactiveeTexte: {
    fr: 'Cette invitation a été désactivée. Demandez une nouvelle invitation à votre responsable.',
    pt: 'Este convite foi desativado. Peça um novo convite ao seu responsável.',
  },
  refusAccepteeTitre: { fr: 'Invitation déjà acceptée', pt: 'Convite já aceite' },
  refusAccepteeTexte: {
    fr: "Vous faites déjà partie de l'équipe. Connectez-vous avec votre compte Vitfix.",
    pt: 'Já faz parte da equipa. Inicie sessão com a sua conta Vitfix.',
  },
  refusReseauTitre: { fr: 'Erreur de connexion', pt: 'Erro de ligação' },
  refusReseauTexte: { fr: 'Réessayez dans un instant.', pt: 'Tente novamente dentro de instantes.' },
  succesTitre: { fr: "Bienvenue dans l'équipe", pt: 'Bem-vindo(a) à equipa' },
  succesNouveau: {
    fr: 'Votre compte est prêt. Connectez-vous pour ouvrir votre espace.',
    pt: 'A sua conta está pronta. Inicie sessão para abrir o seu espaço.',
  },
  succesExistant: {
    fr: 'Votre compte est rattaché. Connectez-vous avec le mot de passe de votre compte Vitfix.',
    pt: 'A sua conta foi associada. Inicie sessão com a palavra-passe da sua conta Vitfix.',
  },
} satisfies Record<string, Bilingue<string> | Bilingue<(societe: string, role: string) => string>>

type CleTexte = keyof typeof BILINGUE
type TexteEnLangue<K extends CleTexte> = (typeof BILINGUE)[K]['fr']

/** Textes de la page dans une langue, regroupés comme la page les lit. */
export function textesInvitation(langue: LangueInvitation) {
  const t = <K extends CleTexte>(cle: K): TexteEnLangue<K> => BILINGUE[cle][langue] as TexteEnLangue<K>
  const defauts: Record<DefautMotDePasse, string> = {
    longueur: t('defautLongueur'),
    majuscule: t('defautMajuscule'),
    chiffre: t('defautChiffre'),
  }
  const erreurs: Record<ErreurFormulaire, string> = {
    mot_de_passe_incorrect: t('erreurMotDePasse'),
    non_confirme: t('erreurNonConfirme'),
    recharger: t('erreurRecharger'),
    non_validee: t('erreurNonValidee'),
    erreur: t('erreurGenerale'),
    trop: t('erreurTrop'),
    reseau: t('erreurReseau'),
    differents: t('erreurDifferents'),
  }
  const refus: Record<MotifRefus, { titre: string; texte: string }> = {
    invalide: { titre: t('refusInvalideTitre'), texte: t('refusInvalideTexte') },
    expiree: { titre: t('refusExpireeTitre'), texte: t('refusExpireeTexte') },
    desactivee: { titre: t('refusDesactiveeTitre'), texte: t('refusDesactiveeTexte') },
    deja_utilisee: { titre: t('refusAccepteeTitre'), texte: t('refusAccepteeTexte') },
    reseau: { titre: t('refusReseauTitre'), texte: t('refusReseauTexte') },
  }
  return {
    badge: t('badge'),
    verification: t('verification'),
    titre: t('titre'),
    invitation: t('invitation'),
    compte: t('compte'),
    nom: t('nom'),
    introNouveau: t('introNouveau'),
    introExistant: t('introExistant'),
    introInconnu: t('introInconnu'),
    motDePasse: t('motDePasse'),
    motDePasseDuCompte: t('motDePasseDuCompte'),
    confirmer: t('confirmer'),
    aideNouveau: t('aideNouveau'),
    boutonCreer: t('boutonCreer'),
    boutonRejoindre: t('boutonRejoindre'),
    enCours: t('enCours'),
    oublie: t('oublie'),
    seConnecter: t('seConnecter'),
    ouverture: t('ouverture'),
    defauts,
    erreurs,
    autreEspace: { titre: t('autreEspaceTitre'), texte: t('autreEspaceTexte') },
    refus,
    succes: { titre: t('succesTitre'), texteNouveau: t('succesNouveau'), texteExistant: t('succesExistant') },
  }
}
