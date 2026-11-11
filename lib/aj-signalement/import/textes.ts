// ── AJ Signalement : textes de l'import des copropriétés (français, outil du super admin) ─────────────────────
//
// Libellés de l'assistant (components/aj-signalement/AssistantImportQr.tsx) et messages des lignes, produits par la même
// fonction pure au navigateur et au serveur (lib/aj-signalement/import/ligne.ts). Un message cite la valeur lue dans le
// fichier pour que le super admin la retrouve : il part dans la réponse privée de la route, jamais dans un journal.
// Gabarits à {accolades} remplis par remplir() (lib/coproprietaire/textes). Module pur, sans dépendance.

import type { ChampImportQr, CodeLectureImportQr, CritereDoublonQr, EtatLigneImportQr } from '@/lib/aj-signalement/types'

/** « même n° d'immatriculation »… : ce qui rapproche la ligne d'une copropriété existante ou d'une autre ligne. */
export const LIBELLE_CRITERE_DOUBLON_QR: Record<CritereDoublonQr, string> = {
  immatriculation: 'même n° d’immatriculation',
  reference_cabinet: 'même référence du cabinet',
  nom_code_postal: 'même nom et même code postal',
  adresse_code_postal: 'même adresse et même code postal',
  nom: 'même nom',
}

/** Messages des lignes (diagnostics). */
export const MESSAGES_IMPORT_QR = {
  nomManquant: 'Nom de la copropriété manquant',
  tropLong: (libelle: string, max: number) => `${libelle} : ${max} caractères au plus`,
  codePostal: (valeur: string) => `Code postal « ${valeur} » : 5 chiffres attendus`,
  immatriculation: (valeur: string) => `N° d’immatriculation « ${valeur} » : lettres et chiffres seulement, 20 au plus`,
  immatriculationInattendue: (valeur: string) => `N° d’immatriculation « ${valeur} » : format inattendu (2 lettres puis 7 chiffres), à vérifier`,
  batiments: 'Bâtiments : 50 au plus, de 50 caractères chacun',
  emailInvalide: (valeur: string) => `Adresse « ${valeur} » invalide`,
  tropDeDestinataires: 'Destinataires supplémentaires : 10 au plus',
  tropDeGestionnaires: 'Gestionnaire(s) : 20 au plus',
  gestionnaireInconnu: (valeur: string) => `Gestionnaire « ${valeur} » : pas de fiche au cabinet`,
  gestionnaireDesactive: (valeur: string) => `Gestionnaire « ${valeur} » : fiche désactivée`,
  gestionnaireConteste: (valeur: string) => `Gestionnaire « ${valeur} » : adresse contestée par son destinataire`,
  gestionnaireAutreCabinet: (valeur: string) => `Gestionnaire « ${valeur} » : fiche d’un autre cabinet`,
  gestionnaireHomonymes: (valeur: string) => `Gestionnaire « ${valeur} » : plusieurs fiches portent ce nom, indiquez son adresse e-mail`,
  destinataireGestionnaire: (valeur: string) => `« ${valeur} » est l’adresse d’un gestionnaire : mise dans Gestionnaire(s)`,
  destinataireRetire: (valeur: string) => `« ${valeur} » est l’adresse d’une fiche désactivée ou contestée : retirée`,
  destinataireAutreCabinet: (valeur: string) => `« ${valeur} » est l’adresse d’un gestionnaire d’un autre cabinet : retirée`,
  horsDomaine: (valeur: string) => `« ${valeur} » est hors des domaines du cabinet : à confirmer avant l’import`,
  doublonFichier: (ligne: number) => `Doublon de la ligne ${ligne}`,
  ressembleLigne: (ligne: number) => `Ressemble à la ligne ${ligne}`,
  existeDeja: (nom: string, ville: string, critere: CritereDoublonQr) =>
    `Existe déjà : « ${nom} »${ville ? ` (${ville})` : ''}, ${LIBELLE_CRITERE_DOUBLON_QR[critere]}`,
  ressembleExistante: (nom: string, ville: string, critere: CritereDoublonQr) =>
    `Ressemble à « ${nom} »${ville ? ` (${ville})` : ''}, ${LIBELLE_CRITERE_DOUBLON_QR[critere]}`,
  completerAutre: 'La copropriété à compléter n’est plus celle qui ressemble à cette ligne : vérifiez de nouveau',
  destinatairesNonRepris: 'Destinataires non repris : la fiche existante garde les siens',
  nonVerifiee: 'Ligne non vérifiée par le serveur : vérifiez de nouveau',
} as const

/** Libellé de chaque champ (sélecteurs de la correspondance, messages). */
export const LIBELLE_CHAMP_IMPORT_QR: Record<ChampImportQr, string> = {
  nom: 'Nom de la copropriété',
  adresse: 'Adresse (n° et voie)',
  codePostal: 'Code postal',
  ville: 'Ville',
  immatriculation: 'N° d’immatriculation',
  referenceCabinet: 'Référence du cabinet',
  batiments: 'Bâtiments',
  gestionnaires: 'Gestionnaire(s)',
  emailsDestinataires: 'Destinataires supplémentaires',
}

const ETATS: Record<EtatLigneImportQr, string> = {
  a_creer: 'À créer',
  avertissement: 'Avertissement',
  erreur: 'Erreur',
  doublon_fichier: 'Doublon dans le fichier',
  existe_deja: 'Existe déjà',
}

const ERREURS_LECTURE: Record<CodeLectureImportQr | 'format', string> = {
  trop_gros: 'Fichier de plus de 5 Mo : divisez-le ou enregistrez-le en CSV.',
  format_ancien: 'Ancien format Excel (.xls) ou classeur protégé : enregistrez une copie au format .xlsx ou CSV.',
  illisible: 'Fichier illisible : enregistrez une copie au format .xlsx ou CSV.',
  bombe: 'Fichier trop volumineux une fois décompressé : il n’a pas été lu.',
  vide: 'Fichier vide.',
  format: 'Format non reconnu : choisissez un fichier .xlsx ou .csv.',
}

/** Textes de l'assistant d'import. */
export const TEXTES_IMPORT_QR = {
  bouton: 'Importer un fichier',
  titre: 'Importer des copropriétés',
  intro: 'Le fichier est lu sur cet appareil : il n’est ni envoyé ni conservé. Seules les lignes retenues partent, après une vérification.',
  cabinet: 'Cabinet client',
  choisirCabinet: 'Choisir le cabinet',
  chargementCabinets: 'Chargement des cabinets…',
  aucunCabinet: 'Créez d’abord le cabinet client (vue Cabinets) : chaque copropriété importée lui est rattachée.',
  fichier: 'Fichier Excel (.xlsx) ou CSV',
  fichierAide: '5 Mo et 500 copropriétés au plus. Un fichier .xls : enregistrez une copie au format .xlsx ou CSV.',
  modeleXlsx: 'Télécharger le modèle (Excel)',
  modeleCsv: 'Télécharger le modèle (CSV)',
  lecture: 'Lecture du fichier…',
  erreursLecture: ERREURS_LECTURE,
  lignesTronquees: 'Seules les 2 000 premières lignes et les 30 premières colonnes ont été lues.',
  feuille: 'Feuille',
  feuilleMasquee: '{nom} (masquée)',
  ligneEntetes: 'Ligne des en-têtes',
  ligneEntetesOption: 'Ligne {n} : {apercu}',
  correspondance: 'Colonnes du fichier',
  correspondanceAide: 'Pour chaque champ, la colonne du fichier qui le contient. Les colonnes non choisies sont ignorées et jamais envoyées.',
  champs: LIBELLE_CHAMP_IMPORT_QR,
  ignorer: 'Ignorer',
  colonne: 'Colonne {lettre} — {entete}',
  exemples: 'Exemples : {valeurs}',
  aucunExemple: 'Aucune valeur',
  adresseComplete: 'Une seule colonne contient l’adresse complète (n° et voie, code postal, ville)',
  nomObligatoire: 'Choisissez la colonne du nom de la copropriété.',
  verifier: 'Vérifier les lignes',
  verification: 'Vérification…',
  tropDeLignes: 'Plus de 500 copropriétés : divisez le fichier.',
  aucuneLigne: 'Aucune ligne à importer sous la ligne des en-têtes.',
  apercu: 'Aperçu',
  resume: '{creer} à créer · {completer} à compléter · {ignorer} ignorée(s) · {erreurs} en erreur',
  filtre: 'Afficher',
  filtres: { toutes: 'Toutes les lignes', erreurs: 'Erreurs seulement', doublons: 'Doublons' },
  etats: ETATS,
  ligne: 'Ligne {n}',
  choixLigne: 'Que faire de cette ligne ?',
  choixIgnorer: 'Ignorer',
  choixCompleter: 'Compléter la fiche existante (champs vides seulement, attributions ajoutées)',
  choixPasDoublon: 'Ce n’est pas un doublon, créer',
  choixCreerProbable: 'Créer quand même',
  inconnus: '{n} gestionnaire(s) sans fiche au cabinet',
  inconnusAide: 'Une fiche est créée pour chacun, et un e-mail de confirmation d’adresse lui est envoyé. Vérifiez le nom proposé.',
  nomInconnu: 'Nom de {email}',
  horsDomaineFiches: 'Adresses hors des domaines du cabinet (adresse personnelle ou domaine inattendu ?) : une fiche n’est créée que si sa case est cochée.',
  forcerFiche: 'Créer quand même la fiche de {email}',
  creerFiches: 'Créer ces fiches et leur envoyer la confirmation',
  creationFiches: 'Création des fiches…',
  fichesCreees: '{n} fiche(s) créée(s). Les lignes ont été vérifiées de nouveau.',
  fichesEchec: 'Fiche non créée pour {email} : {raison}',
  horsDomaine: 'Des destinataires supplémentaires sont hors des domaines du cabinet (conseil syndical, gardien…).',
  confirmerHorsDomaine: 'Je confirme ces adresses extérieures au cabinet',
  importer: 'Importer {n} ligne(s) valide(s) et ignorer {m} en erreur',
  creation: 'Import en cours…',
  aReverifier: 'Le cabinet a changé depuis la vérification : l’aperçu est à jour, vérifiez-le puis importez de nouveau.',
  resultat: '{creees} copropriété(s) créée(s), {completees} complétée(s), {ignorees} ignorée(s).',
  affiches: 'Télécharger toutes les affiches (un PDF, une page par copropriété)',
  affichesAvancement: 'Préparation des affiches : {fait} / {total}',
  export: 'Exporter la liste (CSV)',
  erreurFichier: 'Le fichier n’a pas pu être préparé. Réessayez.',
  fermer: 'Fermer',
} as const
