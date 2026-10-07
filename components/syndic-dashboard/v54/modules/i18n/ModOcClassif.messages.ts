import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Textes de l'écran « Ocorrências — Classificador IA » / « Incidents — classificateur IA ». */
interface OcClassifTextes {
  /** Code de langue attendu par /api/syndic/oc-classif (champ `locale` du corps). */
  langueApi: 'pt' | 'fr' // valeurs acceptées par la route
  titre: string
  chapeau: string
  immeuble: string
  selectionnerImmeuble: string
  description: string
  descriptionPlaceholder: string
  ajouterPhotoTitre: string
  ajouterPhoto: string
  analyseEnCours: string
  analyser: string
  toasts: {
    descriptionTitre: string
    descriptionCourte: string
    classificateur: string
    connexionRequise: string
    erreur: string
    echec: string
    creerTitre: string
    creerBientot: string
  }
  /** Catégorie renvoyée par l'IA (code PT imposé par la route) → libellé ; repli sur la valeur brute. */
  categorie: (code: string) => string
  /** Priorité renvoyée par l'IA (urgente | alta | normal | baixa) → libellé ; repli sur la valeur brute. */
  priorite: (code: string) => string
  /** Préfixe de la pastille de priorité (même nœud texte qu'à l'origine). */
  prioritePrefixe: string
  resultat: { localisation: string; resume: string; suggestion: string }
  creerIncident: string
  initial: { titre: string; texte: string; exemplesTitre: string; exemples: [string, string, string] }
}

/** Codes de catégorie de la route (PROMPT_PT et PROMPT_FR) → libellés français. */
const CATEGORIES_FR: Record<string, string> = {
  'Canalização': 'Plomberie',
  'Eletricidade': 'Électricité',
  'Elevador': 'Ascenseur',
  'Telhado/Cobertura': 'Toiture / couverture',
  'Fachada': 'Façade',
  'Áreas comuns': 'Parties communes',
  'Segurança': 'Sécurité',
  'Limpeza': 'Nettoyage',
  'Jardim': 'Espaces verts',
  'Outro': 'Autre',
}

/** Codes de priorité de la route → libellés français. */
const PRIORITES_FR: Record<string, string> = { urgente: 'Urgente', alta: 'Haute', normal: 'Normale', baixa: 'Basse' }

const libelle = (table: Record<string, string>, code: string): string =>
  (Object.prototype.hasOwnProperty.call(table, code) ? table[code] : code)

export const OC_CLASSIF_MESSAGES = defineMessages<OcClassifTextes>({
  'pt-PT': {
    langueApi: 'pt', // code langue attendu par la route (inchangé)
    titre: 'Ocorrências — Classificador IA',
    chapeau: 'Envie texto e/ou foto — a IA categoriza, prioriza, localiza e cria a ocorrência automaticamente',
    immeuble: 'Edifício',
    selectionnerImmeuble: 'Selecione um edifício…',
    description: 'Descrição do problema (texto livre, como uma mensagem WhatsApp)',
    descriptionPlaceholder: 'Ex: Está a chover dentro do elevador do 3.° andar, parece uma fuga no telhado…',
    ajouterPhotoTitre: 'Adicionar foto',
    ajouterPhoto: 'Adicionar Foto',
    analyseEnCours: 'A analisar…',
    analyser: 'Analisar e Classificar',
    toasts: {
      descriptionTitre: 'Descrição',
      descriptionCourte: 'Escreva a descrição do problema (mín. 8 caracteres).',
      classificateur: 'Classificador IA',
      connexionRequise: 'Conecte-se como síndico para usar o Alfredo.',
      erreur: 'Erro',
      echec: 'Não foi possível classificar. Tente novamente.',
      creerTitre: 'Criar ocorrência',
      creerBientot: 'Registo da ocorrência a partir da classificação — em breve.',
    },
    categorie: (code) => code,
    priorite: (code) => code,
    prioritePrefixe: 'Prioridade: ',
    resultat: { localisation: 'Localização', resume: 'Resumo', suggestion: 'Sugestão da Alfredo' },
    creerIncident: 'Criar ocorrência',
    initial: {
      titre: 'Escreva a descrição do problema',
      texte: 'A IA irá categorizar, priorizar e localizar automaticamente',
      exemplesTitre: 'Exemplos:',
      exemples: [
        '"Fuga de água no 2.° andar, está a pingar para o 1.°"',
        '"Elevador avariado desde ontem, faz barulho estranho"',
        '"Lâmpada fundida na escadaria entre o 3.° e 4.° andar"',
      ],
    },
  },
  'fr-FR': {
    langueApi: 'fr',
    titre: 'Incidents — classificateur IA',
    chapeau: "Envoyez un texte et/ou une photo : l'IA catégorise, hiérarchise, localise et crée l'incident automatiquement",
    immeuble: 'Immeuble',
    selectionnerImmeuble: 'Sélectionnez un immeuble…',
    description: 'Description du problème (texte libre, comme un message WhatsApp)',
    descriptionPlaceholder: "Ex. : Il pleut dans l'ascenseur au 3e étage, on dirait une fuite dans la toiture…",
    ajouterPhotoTitre: 'Ajouter une photo',
    ajouterPhoto: 'Ajouter une photo',
    analyseEnCours: 'Analyse en cours…',
    analyser: 'Analyser et classer',
    toasts: {
      descriptionTitre: 'Description',
      descriptionCourte: 'Décrivez le problème (8 caractères minimum).',
      classificateur: 'Classificateur IA',
      connexionRequise: 'Connectez-vous en tant que syndic pour utiliser Alfredo.',
      erreur: 'Erreur',
      echec: 'Le classement a échoué. Veuillez réessayer.',
      creerTitre: "Créer l'incident",
      creerBientot: "Enregistrement de l'incident à partir du classement — bientôt disponible.",
    },
    categorie: (code) => libelle(CATEGORIES_FR, code),
    priorite: (code) => libelle(PRIORITES_FR, code),
    prioritePrefixe: 'Priorité : ',
    resultat: { localisation: 'Localisation', resume: 'Résumé', suggestion: "Suggestion d'Alfredo" },
    creerIncident: "Créer l'incident",
    initial: {
      titre: 'Décrivez le problème',
      texte: "L'IA le catégorise, en évalue la priorité et le localise automatiquement",
      exemplesTitre: 'Exemples :',
      exemples: [
        "« Fuite d'eau au 2e étage, ça goutte chez le voisin du 1er »",
        '« Ascenseur en panne depuis hier, il fait un bruit bizarre »',
        "« Ampoule grillée dans l'escalier entre le 3e et le 4e étage »",
      ],
    },
  },
})
