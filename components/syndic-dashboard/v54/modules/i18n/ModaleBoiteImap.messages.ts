import { defineMessages } from '@/lib/syndic/v54/i18n'

interface ModaleBoiteImapTextes {
  /** Bouton d'ouverture (à côté d'Outlook et Gmail). */
  bouton: string
  /** Nom court du fournisseur affiché une fois la boîte connectée. */
  nomFournisseur: string
  titre: string
  intro: string
  aideMotDePasse: string
  aideMicrosoft: string
  adresse: string
  adressePlaceholder: string
  motDePasse: string
  motDePasseAide: string
  serveur: string
  serveurPlaceholder: string
  serveurAide: string
  identifiant: string
  identifiantAide: string
  domaineMicrosoft: string
  annuler: string
  connecter: string
  connexionEnCours: string
  connexionOk: string
  connexionEchec: string
  champsRequis: string
  /** Messages par code d'erreur renvoyé par /api/email-agent/connect-imap. */
  erreurs: Record<string, string>
}

export const MODALE_BOITE_IMAP_MESSAGES = defineMessages<ModaleBoiteImapTextes>({
  'pt-PT': {
    bouton: 'Outro email (IMAP)',
    nomFournisseur: 'IMAP',
    titre: 'Ligar outra caixa de email (IMAP)',
    intro: 'OVH, Infomaniak, Gandi, Ionos, iCloud, Yahoo, servidor do escritório… O Alfredo só lê a caixa de entrada: nada é enviado nem alterado.',
    aideMotDePasse: 'Gmail, iCloud, Yahoo: crie uma palavra-passe de aplicação nas definições de segurança da conta (a palavra-passe habitual é recusada).',
    aideMicrosoft: 'Outlook, Hotmail, Microsoft 365: use antes o botão « Outlook / Microsoft 365 ».',
    adresse: 'Endereço de email',
    adressePlaceholder: 'gestao@escritorio.pt',
    motDePasse: 'Palavra-passe (de aplicação)',
    motDePasseAide: 'Guardada encriptada, nunca apresentada.',
    serveur: 'Servidor IMAP',
    serveurPlaceholder: 'ssl0.ovh.net',
    serveurAide: 'Porta 993, SSL/TLS. Indicado nas definições « IMAP » do seu fornecedor.',
    identifiant: 'Identificador IMAP',
    identifiantAide: 'Apenas se for diferente do endereço de email.',
    domaineMicrosoft: 'Endereço Microsoft: use o botão « Outlook / Microsoft 365 ».',
    annuler: 'Cancelar',
    connecter: 'Ligar a caixa',
    connexionEnCours: 'A verificar a ligação…',
    connexionOk: 'Caixa de email ligada',
    connexionEchec: 'Ligação impossível',
    champsRequis: 'Preencha o endereço, a palavra-passe e o servidor IMAP.',
    erreurs: {
      identifiants_refuses: 'Identificador ou palavra-passe recusados pelo servidor. Gmail, iCloud, Yahoo: use uma palavra-passe de aplicação.',
      mot_de_passe_application: 'Este fornecedor exige uma palavra-passe de aplicação: crie uma na segurança da sua conta e cole-a aqui.',
      microsoft_oauth: 'O Outlook / Microsoft 365 não aceita a ligação por palavra-passe: use o botão « Outlook / Microsoft 365 ».',
      authentification_non_prise_en_charge: 'Este servidor não aceita a ligação por palavra-passe.',
      boite_inaccessible: 'Ligação estabelecida, mas a caixa de entrada está inacessível.',
      serveur_injoignable: 'Servidor IMAP inacessível: verifique o endereço (porta 993, SSL/TLS).',
      delai_depasse: 'O servidor IMAP não responde. Tente novamente dentro de instantes.',
      imap_indisponible: 'A ligação IMAP não está disponível neste servidor.',
      protocole: 'Resposta inesperada do servidor IMAP.',
    },
  },
  'fr-FR': {
    bouton: 'Autre messagerie (IMAP)',
    nomFournisseur: 'IMAP',
    titre: 'Connecter une autre messagerie (IMAP)',
    intro: 'OVH, Infomaniak, Gandi, Ionos, iCloud, Yahoo, serveur du cabinet… Alfredo lit seulement la boîte de réception : rien n’est envoyé ni modifié.',
    aideMotDePasse: 'Gmail, iCloud, Yahoo : créez un mot de passe d’application dans la sécurité de votre compte (le mot de passe habituel est refusé).',
    aideMicrosoft: 'Outlook, Hotmail, Microsoft 365 : utilisez plutôt le bouton « Outlook / Microsoft 365 ».',
    adresse: 'Adresse e-mail',
    adressePlaceholder: 'gestion@cabinet.fr',
    motDePasse: 'Mot de passe (d’application)',
    motDePasseAide: 'Conservé chiffré, jamais réaffiché.',
    serveur: 'Serveur IMAP',
    serveurPlaceholder: 'ssl0.ovh.net',
    serveurAide: 'Port 993, SSL/TLS. Indiqué dans les réglages « IMAP » de votre messagerie.',
    identifiant: 'Identifiant IMAP',
    identifiantAide: 'Seulement s’il diffère de l’adresse e-mail.',
    domaineMicrosoft: 'Adresse Microsoft : utilisez le bouton « Outlook / Microsoft 365 ».',
    annuler: 'Annuler',
    connecter: 'Connecter la boîte',
    connexionEnCours: 'Vérification de la connexion…',
    connexionOk: 'Boîte e-mail connectée',
    connexionEchec: 'Connexion impossible',
    champsRequis: 'Renseignez l’adresse, le mot de passe et le serveur IMAP.',
    erreurs: {
      identifiants_refuses: 'Identifiant ou mot de passe refusé par le serveur. Gmail, iCloud, Yahoo : utilisez un mot de passe d’application.',
      mot_de_passe_application: 'Ce fournisseur exige un mot de passe d’application : créez-en un dans la sécurité de votre compte, puis collez-le ici.',
      microsoft_oauth: 'Outlook / Microsoft 365 n’accepte pas la connexion par mot de passe : utilisez le bouton « Outlook / Microsoft 365 ».',
      authentification_non_prise_en_charge: 'Ce serveur n’accepte pas la connexion par mot de passe.',
      boite_inaccessible: 'Connexion réussie, mais la boîte de réception est inaccessible.',
      serveur_injoignable: 'Serveur IMAP injoignable : vérifiez son adresse (port 993, SSL/TLS).',
      delai_depasse: 'Le serveur IMAP ne répond pas. Réessayez dans un instant.',
      imap_indisponible: 'La connexion IMAP n’est pas disponible sur ce serveur.',
      protocole: 'Réponse inattendue du serveur IMAP.',
    },
  },
})
