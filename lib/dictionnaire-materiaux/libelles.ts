// Textes de l'écran du Dictionnaire matériaux, par langue d'interface. Le contenu du dictionnaire
// (situations, matériaux) est rédigé dans la langue de son pays : il n'est pas ici.
// Chaque texte est écrit une fois, en paire [portugais, français] : une clé oubliée dans une langue ne compile pas.
// Garde : tests/dictionnaire-materiaux/libelles.test.ts (textes non vides, un message par code d'erreur de la route).

export interface LibellesDictionnaire {
  titre: string
  sousTitre: (enseignes: string) => string
  verifieLe: (date: string) => string
  indisponible: string
  modeManuel: string
  modeIA: string
  // Recherche manuelle
  recherchePlaceholder: string
  rechercheLabel: string
  effacer: string
  aucunResultat: (saisie: string) => string
  aucunResultatAide: string
  situations: string
  materiaux: string
  parDomaine: string
  parFamille: string
  nombreSituations: (n: number) => string
  nombreMateriaux: (n: number) => string
  // Fiches
  fermer: string
  retour: string
  aVerifier: string
  materiauxAUtiliser: string
  attention: string
  optionnel: string
  copier: string
  copie: string
  copieImpossible: string
  usage: string
  aSavoir: string
  conditionnement: string
  aussiAppele: string
  ouTrouver: string
  voirChez: (enseigne: string) => string
  stockAConfirmer: string
  utiliseDans: string
  voirToutesSituations: (n: number) => string
  // Langage naturel
  iaIntro: string
  iaPlaceholder: string
  iaPlaceholderSuite: string
  iaDescription: string
  ajouterPhotos: string
  retirerPhoto: (n: number) => string
  photoNumero: (n: number) => string
  photosMax: (n: number) => string
  photosEnPreparation: string
  photoIllisible: string
  analyser: string
  analyseEnCours: string
  reponseRecue: string
  nouvelleConversation: string
  vous: string
  reponse: string
  fichesProches: string
  conseils: string
  questions: string
  horsCatalogue: string
  avertissementIA: string
  descriptionTropCourte: string
  /** Question envoyée à la place d'une description quand l'artisan ne joint que des photos. */
  descriptionPhotosSeules: string
  erreurs: Record<string, string>
}

type Langue = 'pt' | 'fr'
type Paire<T> = readonly [pt: T, fr: T]

type CleTexte = { [K in keyof LibellesDictionnaire]: LibellesDictionnaire[K] extends string ? K : never }[keyof LibellesDictionnaire]
type CleGabarit = Exclude<keyof LibellesDictionnaire, CleTexte | 'erreurs'>

const TEXTES: Record<CleTexte, Paire<string>> = {
  titre: ['Dicionário de materiais', 'Dictionnaire matériaux'],
  indisponible: [
    'O dicionário de materiais ainda não está disponível para este país.',
    'Le dictionnaire des matériaux n’est pas encore disponible pour ce pays.',
  ],
  modeManuel: ['Pesquisar', 'Rechercher'],
  modeIA: ['Descrever a situação (IA)', 'Décrire la situation (IA)'],
  recherchePlaceholder: ['Ex.: infiltração fachada, silicone, espátula dentada…', 'Ex. : infiltration façade, silicone, spatule crantée…'],
  rechercheLabel: ['Pesquisar uma situação ou um material', 'Rechercher une situation ou un matériau'],
  effacer: ['Limpar a pesquisa', 'Effacer la recherche'],
  aucunResultatAide: ['Experimente outra palavra, ou descreva a situação à IA.', 'Essayez un autre mot, ou décrivez la situation à l’IA.'],
  situations: ['Situações', 'Situations'],
  materiaux: ['Materiais', 'Matériaux'],
  parDomaine: ['Situações por tipo de obra', 'Situations par type de travaux'],
  parFamille: ['Materiais por categoria', 'Matériaux par catégorie'],
  fermer: ['Fechar', 'Fermer'],
  retour: ['Voltar', 'Retour'],
  aVerifier: ['A verificar no local', 'À vérifier sur place'],
  materiauxAUtiliser: ['Materiais a utilizar', 'Matériaux à utiliser'],
  attention: ['Atenção', 'Attention'],
  optionnel: ['opcional', 'optionnel'],
  copier: ['Copiar a lista', 'Copier la liste'],
  copie: ['Lista copiada', 'Liste copiée'],
  copieImpossible: ['Não foi possível copiar a lista', 'Impossible de copier la liste'],
  usage: ['Para que serve', 'À quoi ça sert'],
  aSavoir: ['A saber', 'À savoir'],
  conditionnement: ['Embalagem habitual', 'Conditionnement courant'],
  aussiAppele: ['Também chamado', 'Aussi appelé'],
  ouTrouver: ['Onde encontrar', 'Où le trouver'],
  stockAConfirmer: ['Confirme o stock e a referência na loja.', 'Confirmez le stock et la référence en magasin.'],
  utiliseDans: ['Usado nestas situações', 'Utilisé dans ces situations'],
  iaIntro: [
    'Descreva a situação como a explicaria a um colega. Pode juntar fotografias.',
    'Décrivez la situation comme vous l’expliqueriez à un collègue. Vous pouvez joindre des photos.',
  ],
  iaPlaceholder: [
    'Ex.: Fachada virada a norte, reboco pintado com fissuras finas. Depois de chover aparecem manchas de humidade no interior, junto à janela.',
    'Ex. : Façade nord, enduit peint avec de fines fissures. Après la pluie, des taches d’humidité apparaissent à l’intérieur, près de la fenêtre.',
  ],
  iaPlaceholderSuite: ['Responda às perguntas ou acrescente um pormenor…', 'Répondez aux questions ou ajoutez un détail…'],
  iaDescription: ['Descrição da situação', 'Description de la situation'],
  ajouterPhotos: ['Juntar fotos', 'Joindre des photos'],
  photosEnPreparation: ['A preparar as fotos…', 'Préparation des photos…'],
  photoIllisible: ['Não foi possível ler esta imagem. Use uma fotografia JPEG ou PNG.', 'Impossible de lire cette image. Utilisez une photo JPEG ou PNG.'],
  analyser: ['Analisar', 'Analyser'],
  analyseEnCours: ['A analisar…', 'Analyse en cours…'],
  reponseRecue: ['Resposta recebida.', 'Réponse reçue.'],
  nouvelleConversation: ['Nova conversa', 'Nouvelle conversation'],
  vous: ['A sua descrição', 'Votre description'],
  reponse: ['Resposta do dicionário', 'Réponse du dictionnaire'],
  fichesProches: ['Fichas do dicionário', 'Fiches du dictionnaire'],
  conseils: ['Conselhos de aplicação', 'Conseils de mise en œuvre'],
  questions: ['Para afinar a resposta', 'Pour affiner la réponse'],
  horsCatalogue: ['Fora do dicionário', 'Hors dictionnaire'],
  avertissementIA: [
    'A IA só propõe materiais deste dicionário. Confirme sempre no local antes de comprar.',
    'L’IA ne propose que des matériaux de ce dictionnaire. Confirmez toujours sur place avant d’acheter.',
  ],
  descriptionTropCourte: ['Descreva a situação em algumas palavras.', 'Décrivez la situation en quelques mots.'],
  descriptionPhotosSeules: ['Veja as fotografias em anexo: que materiais devo usar?', 'Voir les photos jointes : quels matériaux utiliser ?'],
}

const GABARITS: { [K in CleGabarit]: Paire<LibellesDictionnaire[K]> } = {
  sousTitre: [
    (enseignes) => `Os materiais a usar em cada situação, fáceis de encontrar: ${enseignes}`,
    (enseignes) => `Les matériaux à utiliser dans chaque situation, faciles à trouver : ${enseignes}`,
  ],
  verifieLe: [(date) => `Disponibilidade nas lojas verificada em ${date}.`, (date) => `Disponibilité en magasin vérifiée le ${date}.`],
  aucunResultat: [(saisie) => `Nada encontrado para «${saisie}».`, (saisie) => `Rien trouvé pour « ${saisie} ».`],
  nombreSituations: [(n) => (n === 1 ? '1 situação' : `${n} situações`), (n) => (n === 1 ? '1 situation' : `${n} situations`)],
  nombreMateriaux: [(n) => (n === 1 ? '1 material' : `${n} materiais`), (n) => (n === 1 ? '1 matériau' : `${n} matériaux`)],
  voirChez: [(enseigne) => `Ver na ${enseigne}`, (enseigne) => `Voir chez ${enseigne}`],
  voirToutesSituations: [(n) => `Ver as ${n} situações`, (n) => `Voir les ${n} situations`],
  retirerPhoto: [(n) => `Retirar a foto ${n}`, (n) => `Retirer la photo ${n}`],
  photoNumero: [(n) => `Foto ${n}`, (n) => `Photo ${n}`],
  photosMax: [(n) => `No máximo ${n} fotos por mensagem.`, (n) => `${n} photos au plus par message.`],
}

/** Un message par code d'erreur que la route peut rendre (`erreur('<code>', …)`), plus `defaut` et `reseau`. */
const ERREURS: Record<string, Paire<string>> = {
  defaut: ['A análise falhou. Tente novamente.', 'L’analyse a échoué. Réessayez.'],
  reseau: ['Sem ligação ao servidor. Verifique a rede e tente novamente.', 'Pas de connexion au serveur. Vérifiez le réseau et réessayez.'],
  ia_indisponible: [
    'A IA está indisponível de momento. Tente novamente dentro de instantes.',
    'L’IA est indisponible pour le moment. Réessayez dans un instant.',
  ],
  reponse_invalide: [
    'A IA não conseguiu responder a esta descrição. Reformule ou acrescente detalhes.',
    'L’IA n’a pas su répondre à cette description. Reformulez ou ajoutez des détails.',
  ],
  reponse_vide: [
    'A IA não conseguiu responder a esta descrição. Reformule ou acrescente detalhes.',
    'L’IA n’a pas su répondre à cette description. Reformulez ou ajoutez des détails.',
  ],
  requete_invalide: ['Descrição inválida. Escreva algumas palavras sobre a situação.', 'Description invalide. Écrivez quelques mots sur la situation.'],
  pays_non_disponible: [
    'O dicionário de materiais ainda não está disponível para este país.',
    'Le dictionnaire des matériaux n’est pas encore disponible pour ce pays.',
  ],
  photo_trop_volumineuse: ['Uma das fotos é demasiado pesada.', 'Une des photos est trop lourde.'],
  photo_format_non_pris_en_charge: ['Formato de foto não suportado. Use JPEG ou PNG.', 'Format de photo non pris en charge. Utilisez JPEG ou PNG.'],
  photo_illisible: [
    'A IA não conseguiu ler uma das fotos. Tire outra fotografia ou envie só o texto.',
    'L’IA n’a pas pu lire une des photos. Reprenez la photo ou envoyez seulement le texte.',
  ],
  demande_trop_volumineuse: ['Pedido demasiado pesado. Envie menos fotos.', 'Demande trop lourde. Envoyez moins de photos.'],
  acces_reserve_aux_professionnels: ['Funcionalidade reservada às contas profissionais.', 'Fonction réservée aux comptes professionnels.'],
  trop_de_demandes: ['Demasiados pedidos seguidos. Aguarde um minuto.', 'Trop de demandes à la suite. Patientez une minute.'],
  non_connecte: ['Sessão expirada. Inicie sessão novamente.', 'Session expirée. Reconnectez-vous.'],
}

function dansLaLangue<T>(table: Record<string, Paire<T>>, langue: Langue): Record<string, T> {
  const rang = langue === 'pt' ? 0 : 1
  return Object.fromEntries(Object.entries(table).map(([cle, paire]) => [cle, paire[rang]]))
}

function libellesDe(langue: Langue): LibellesDictionnaire {
  // Les tables sont complètes par leur type : l'assemblage clé par clé ne perd aucun libellé.
  return {
    ...dansLaLangue<string>(TEXTES, langue),
    ...dansLaLangue<unknown>(GABARITS as Record<string, Paire<unknown>>, langue),
    erreurs: dansLaLangue(ERREURS, langue),
  } as unknown as LibellesDictionnaire
}

export const LIBELLES: Record<Langue, LibellesDictionnaire> = { pt: libellesDe('pt'), fr: libellesDe('fr') }

/** Libellés de la langue d'interface ; le français sert de repli aux autres langues du site. */
export function libellesPour(langue: string): LibellesDictionnaire {
  return langue === 'pt' ? LIBELLES.pt : LIBELLES.fr
}
