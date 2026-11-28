// ── Textes de l'application publique « AJ Signalement » (FR / PT) ─────────────
//
// Le parcours reprend celui de « Signaler un problème » du portail copropriétaire (bloc `demandes` de
// lib/coproprietaire/textes.ts : où, quel type, description, urgence). Ne figurent ici que les libellés
// propres au dépôt par QR code : coordonnées obligatoires (bâtiment et qualité compris), adresse proposée d'après
// la position, signalements déjà faits au même endroit, confirmation, erreurs. Les textes du tableau de bord (vue
// super admin) sont en français seulement (lib/aj-signalement/affichage.ts).
// PR 3, lot 7 (cahier § 6, droit § 4.5 et art. 13 du RGPD ; décision HF3) : information à la collecte sous le bouton
// d'envoi — qui traite les coordonnées, pourquoi, et le lien vers la politique de confidentialité du cabinet ; la partie
// « diffusion » seulement quand la copropriété peut diffuser. TEXTE PROPOSÉ, à valider par Frédéric et Hugo (HF3 ;
// portugais : H4) ; brouillon. Copropriété sans cabinet ou cabinet sans politique : rien ne s'affiche.
// R70 du dossier téléphonie (14/11/2026) : une urgence déclarée par QR code n'alerte aucun secours. Consigne d'appel au 112
// (consigneSecours, en tête du formulaire) et consigne renforcée (consigneSecoursUrgente : sous le choix « urgent », sur
// la confirmation d'un signalement urgent et dans son accusé de réception, lib/aj-signalement/email.ts). TEXTES PROPOSÉS,
// brouillon : textes à valider par Hugo, présentation par Frédéric, portugais à relire (H4). Fondement (note juridique du
// dossier) : numéros d'urgence français fixés par l'annexe de la décision ARCEP n° 2022-2372 (112, 15, 17, 18, 114…) ;
// 114 pour les personnes sourdes, malentendantes, sourdaveugles et aphasiques (CPCE, art. D. 98-8-1) ; au Portugal, le 112
// seul. Aucun texte n'impose cet affichage sur un formulaire privé : mesure de prudence. Ni délai ni intervention promis.
// Bâtiments saisis par le cabinet (demande de Hugo du 17/11/2026, lib/aj-signalement/batiments.ts) : liste à choix au lieu
// du texte libre (choisirBatiment, batimentListeAide) et refus d'un bâtiment absent de la liste (erreurs.batiment_inconnu,
// rendu aussi par la route du dépôt, dans la langue de la page). TEXTES PROPOSÉS, brouillon (portugais à relire, H4).

import { parLangue } from '@/lib/aj-signalement/bilingue'
import type { LangueSignalementQr, QualiteDeclarantQr, StatutOuvertQr } from '@/lib/aj-signalement/types'

/**
 * Information à la collecte lue par le serveur (lib/aj-signalement/serveur-information.ts) pour la page publique :
 * nom du cabinet (nettoyé), politique de confidentialité (https, même forme que la contrainte de la base), diffusion
 * possible pour cette copropriété (règle SQL signalements_qr_diffusion_raison_inactive).
 */
export interface InformationFormulaireQr {
  cabinet: string
  politiqueUrl: string
  diffusion: boolean
}

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
  /** Bâtiments saisis par le cabinet : option vide de la liste à choix et aide sous le champ (17/11/2026). */
  choisirBatiment: string
  batimentListeAide: string
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
    /** 400 du dépôt : bâtiment absent de la liste saisie par le cabinet (17/11/2026). */
    batiment_inconnu: string
  }
  piedDePage: string
  /** PR 3, lot 7 : information à la collecte (texte proposé, HF3). */
  informationTraitement: string
  informationTraitementDiffusion: string
  politiqueConfidentialite: string
  /** R70 : consigne permanente d'appel au 112, en tête du formulaire (texte proposé, brouillon). */
  consigneSecours: string
  /** R70 : consigne renforcée, signalement urgent (choix, confirmation, accusé de réception ; texte proposé, brouillon). */
  consigneSecoursUrgente: { titre: string; texte: string }
}

/** Textes de la page publique, FR et PT côte à côte pour chaque clé (lib/aj-signalement/bilingue.ts). */
export const TEXTES_SIGNALEMENT_QR: Record<LangueSignalementQr, TextesSignalementQr> = parLangue<TextesSignalementQr>({
  application: { fr: 'AJ Signalement', pt: 'AJ Signalement' },
  titre: { fr: 'Signaler un problème', pt: 'Reportar um problema' },
  accroche: {
    fr: 'Vous avez constaté un problème dans la copropriété {copropriete} ? Décrivez-le ici : il sera transmis à l’administrateur.',
    pt: 'Detetou um problema no condomínio {copropriete}? Descreva-o aqui: será transmitido ao administrador.',
  },
  coordonnees: { fr: 'Vos coordonnées', pt: 'Os seus contactos' },
  coordonneesAide: {
    fr: 'Tous les champs sont obligatoires : l’administrateur doit pouvoir vous rappeler.',
    pt: 'Todos os campos são obrigatórios: o administrador tem de poder contactá-lo.',
  },
  prenom: { fr: 'Prénom', pt: 'Nome próprio' },
  nom: { fr: 'Nom', pt: 'Apelido' },
  telephone: { fr: 'Numéro de téléphone', pt: 'Número de telefone' },
  email: { fr: 'Adresse e-mail', pt: 'Endereço de e-mail' },
  batiment: { fr: 'Bâtiment', pt: 'Bloco' },
  batimentAide: {
    fr: 'Lettre, numéro ou nom du bâtiment (ex. A, 2, Les Pins).',
    pt: 'Letra, número ou nome do bloco (ex. A, 2, Os Pinheiros).',
  },
  choisirBatiment: { fr: 'Choisir…', pt: 'Escolher…' },
  batimentListeAide: {
    fr: 'Choisissez votre bâtiment dans la liste.',
    pt: 'Escolha o seu bloco na lista.',
  },
  etage: { fr: 'Étage', pt: 'Piso' },
  numLot: { fr: 'Numéro de lot', pt: 'Número da fração' },
  qualite: { fr: 'Vous êtes :', pt: 'Na qualidade de:' },
  qualites: parLangue({
    proprietaire: { fr: 'Propriétaire', pt: 'Proprietário' },
    locataire: { fr: 'Locataire', pt: 'Inquilino' },
  }),
  votreLogement: { fr: 'votre logement', pt: 'a sua habitação' },
  copropriete: { fr: 'Copropriété', pt: 'Condomínio' },
  geolocalisationExplication: {
    fr: 'Votre position sert seulement à proposer l’adresse de la copropriété, jointe à votre signalement ; elle n’est pas conservée.',
    pt: 'A sua localização serve apenas para propor o endereço do condomínio, anexado à sua ocorrência; não é guardada.',
  },
  adresseRecherche: { fr: 'Recherche de l’adresse…', pt: 'A procurar o endereço…' },
  adresseProposee: { fr: 'Adresse d’après votre position : {adresse}', pt: 'Endereço segundo a sua localização: {adresse}' },
  positionRefusee: {
    fr: 'Position non partagée : vous pouvez envoyer votre signalement normalement.',
    pt: 'Localização não partilhada: pode enviar a sua ocorrência normalmente.',
  },
  adresseIntrouvable: {
    fr: 'Adresse non trouvée : vous pouvez envoyer votre signalement normalement.',
    pt: 'Endereço não encontrado: pode enviar a sua ocorrência normalmente.',
  },
  semblablesTitre: { fr: 'Signalements déjà faits à cet endroit', pt: 'Ocorrências já reportadas neste local' },
  semblablesAide: {
    fr: 'D’autres personnes ont déjà signalé un problème ici. Est-ce le même ? Votre choix n’empêche pas l’envoi.',
    pt: 'Outras pessoas já reportaram um problema aqui. É o mesmo? A sua escolha não impede o envio.',
  },
  semblablesAnnonceUn: {
    fr: '1 signalement a déjà été fait à cet endroit ; il est listé sous la zone. Est-ce le même problème ?',
    pt: 'Já foi reportada 1 ocorrência neste local; está listada abaixo da zona. É o mesmo problema?',
  },
  semblablesAnnonce: {
    fr: '{n} signalements ont déjà été faits à cet endroit ; ils sont listés sous la zone. Est-ce le même problème ?',
    pt: 'Já foram reportadas {n} ocorrências neste local; estão listadas abaixo da zona. É o mesmo problema?',
  },
  semblableNumero: { fr: 'N° {numero}', pt: 'N.º {numero}' },
  statutsSemblables: parLangue({
    en_attente: { fr: 'Reçu', pt: 'Recebida' },
    acceptee: { fr: 'Pris en charge', pt: 'Em tratamento' },
    en_cours: { fr: 'En cours', pt: 'Em curso' },
  }),
  memeProbleme: { fr: 'C’est le même problème', pt: 'É o mesmo problema' },
  autreProbleme: { fr: 'C’est un autre problème', pt: 'É outro problema' },
  rattacheA: { fr: 'Votre signalement sera rattaché au n° {numero}.', pt: 'A sua ocorrência ficará associada à n.º {numero}.' },
  nouveauProbleme: {
    fr: 'Votre signalement sera enregistré comme un nouveau problème.',
    pt: 'A sua ocorrência será registada como um novo problema.',
  },
  envoyer: { fr: 'Envoyer le signalement', pt: 'Enviar a ocorrência' },
  envoiEnCours: { fr: 'Envoi en cours…', pt: 'A enviar…' },
  transmis: {
    fr: 'Votre signalement est transmis à l’administrateur de la copropriété, pas directement à un artisan.',
    pt: 'A sua ocorrência é transmitida ao administrador do condomínio, não diretamente a um profissional.',
  },
  confirmationTitre: { fr: 'Votre signalement a bien été envoyé le {date}.', pt: 'A sua ocorrência foi enviada em {date}.' },
  confirmationNumero: { fr: 'Numéro : {numero}', pt: 'Número: {numero}' },
  confirmationSuite: {
    fr: 'L’administrateur pourra vous recontacter au {telephone} ou à l’adresse {email}.',
    pt: 'O administrador poderá contactá-lo pelo {telephone} ou pelo e-mail {email}.',
  },
  autreSignalement: { fr: 'Faire un autre signalement', pt: 'Reportar outro problema' },
  champObligatoire: { fr: 'Ce champ est obligatoire.', pt: 'Este campo é obrigatório.' },
  emailInvalide: {
    fr: 'Indiquez une adresse e-mail valide (ex. nom@domaine.fr).',
    pt: 'Indique um endereço de e-mail válido (ex. nome@dominio.pt).',
  },
  telephoneInvalide: { fr: 'Indiquez un numéro de téléphone valide.', pt: 'Indique um número de telefone válido.' },
  erreurs: parLangue({
    invalide: {
      fr: 'Le signalement n’a pas pu être enregistré : vérifiez vos coordonnées et la description, puis réessayez.',
      pt: 'A ocorrência não pôde ser registada: verifique os seus contactos e a descrição e tente novamente.',
    },
    trop_de_demandes: {
      fr: 'Trop d’envois en peu de temps : réessayez dans une minute.',
      pt: 'Demasiados envios em pouco tempo: tente novamente dentro de um minuto.',
    },
    serveur: {
      fr: 'Le signalement n’a pas pu être envoyé. Réessayez dans un instant.',
      pt: 'A ocorrência não pôde ser enviada. Tente novamente dentro de instantes.',
    },
    reseau: {
      fr: 'Connexion impossible : vérifiez votre réseau puis réessayez.',
      pt: 'Ligação impossível: verifique a sua rede e tente novamente.',
    },
    introuvable: {
      fr: 'Ce QR code n’est plus valable. Rapprochez-vous de l’administrateur de la copropriété.',
      pt: 'Este código QR já não é válido. Contacte o administrador do condomínio.',
    },
    base_absente: {
      fr: 'Le service de signalement n’est pas encore activé. Réessayez plus tard.',
      pt: 'O serviço de ocorrências ainda não está ativo. Tente mais tarde.',
    },
    batiment_inconnu: {
      fr: 'Ce bâtiment ne figure pas dans la liste de la copropriété : rechargez la page, choisissez votre bâtiment dans la liste, puis réessayez.',
      pt: 'Este bloco não consta da lista do condomínio: recarregue a página, escolha o seu bloco na lista e tente novamente.',
    },
  }),
  piedDePage: { fr: 'AJ Signalement — un service VITFIX', pt: 'AJ Signalement — um serviço VITFIX' },
  informationTraitement: {
    fr: 'Vos coordonnées sont traitées par {cabinet} pour traiter votre signalement.',
    pt: 'Os seus dados são tratados por {cabinet} para tratar a sua ocorrência.',
  },
  informationTraitementDiffusion: {
    fr: 'Vos coordonnées sont traitées par {cabinet} pour traiter votre signalement et vous informer des incidents de votre immeuble ; vous pourrez vous y opposer à tout moment.',
    pt: 'Os seus dados são tratados por {cabinet} para tratar a sua ocorrência e informá-lo dos incidentes do seu prédio; pode opor-se a qualquer momento.',
  },
  politiqueConfidentialite: { fr: 'Politique de confidentialité', pt: 'Política de privacidade' },
  // R70 (dossier téléphonie) : TEXTES PROPOSÉS, brouillon (textes : Hugo ; présentation : Frédéric ; portugais : H4).
  // Décisions de Hugo du 14/11/2026 : vocabulaire de la page (« administrateur de la copropriété » ; PT « ocorrência »,
  // « administrador do condomínio ») ; l'accroche et la confirmation ne promettent plus ni réception immédiate ni rappel.
  consigneSecours: {
    fr: 'En cas de danger immédiat (incendie, odeur de gaz, fumée, personne blessée ou en danger), appelez d’abord le 112. Ce signalement est transmis à l’administrateur de la copropriété ; il n’alerte pas les secours.',
    pt: 'Em caso de perigo imediato (incêndio, cheiro a gás, fumo, pessoa ferida ou em perigo), ligue primeiro para o 112. Esta ocorrência é enviada ao administrador do condomínio; não alerta os serviços de emergência.',
  },
  consigneSecoursUrgente: parLangue({
    titre: { fr: 'Danger immédiat ?', pt: 'Perigo imediato?' },
    texte: {
      fr: 'Appelez tout de suite le 112 (ou le 18, le 15, le 17). Personnes sourdes ou malentendantes : le 114, par SMS, application ou visio. Ce signalement n’alerte pas les secours : il est transmis à l’administrateur de la copropriété.',
      pt: 'Ligue de imediato para o 112. Esta ocorrência não alerta os serviços de emergência: é enviada ao administrador do condomínio.',
    },
  }),
})

/** Mention courte sous le bouton d'envoi : avec la partie « diffusion » seulement quand la copropriété peut diffuser. */
export function mentionInformationQr(tq: TextesSignalementQr, information: InformationFormulaireQr): string {
  const texte = information.diffusion ? tq.informationTraitementDiffusion : tq.informationTraitement
  // Remplacement par une fonction : un « $& » dans le nom du cabinet reste du texte.
  return texte.replace('{cabinet}', () => information.cabinet)
}
