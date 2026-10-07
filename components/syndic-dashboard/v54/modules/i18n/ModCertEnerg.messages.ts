import { defineMessages } from '@/lib/syndic/v54/i18n'

/**
 * Textes de l'écran « Certificação Energética » (SCE, DL 101-D/2020) / « DPE collectif ».
 * Droit français : DPE collectif des immeubles d'habitation collective dont le permis de
 * construire a été déposé avant le 1er janvier 2013 (CCH art. L126-31, loi n° 2021-1104
 * Climat et résilience) ; échéances selon le nombre de lots ; renouvellement tous les 10 ans
 * sauf classe A, B ou C établie par un DPE réalisé après le 1er juillet 2021 ; étiquettes A à G.
 * Les classes sont des valeurs techniques envoyées telles quelles à l'API (champ libre) :
 * l'échelle proposée et les seuils dépendent du système de certification du pays.
 */
interface CertEnergTextes {
  titre: string
  chapeau: string
  ajouter: string
  alerte: { titre: string; texte: string }
  kpi: { certificats: string; efficaces: string; inefficaces: string; expires: string; aRenouveler: string }
  /** Échelle des classes proposée dans le formulaire (valeurs envoyées à l'API). */
  classes: string[]
  /** Classes comptées comme performantes (pastille verte). */
  classesPerformantes: string[]
  /** Classes comptées comme énergivores (pastille rouge). */
  classesEnergivores: string[]
  vide: { titre: string; desc: string }
  colonnes: { numero: string; immeuble: string; classe: string; emission: string; validite: string; expert: string }
  formulaire: {
    titre: string
    numero: string
    numeroPlaceholder: string
    classe: string
    immeuble: string
    immeublePlaceholder: string
    emission: string
    validite: string
    validiteAide: string
    expert: string
    expertPlaceholder: string
    notes: string
    annuler: string
    enregistrer: string
  }
  erreurs: { numero: string; immeuble: string; emission: string }
  toasts: {
    enregistre: string
    detail: (numero: string, classe: string) => string
    erreur: string
    reessayerPlusTard: string
    enregistreDemo: string
    connexionRequise: string
  }
}

export const CERT_ENERG_MESSAGES = defineMessages<CertEnergTextes>({
  'pt-PT': {
    titre: 'Certificação Energética',
    chapeau: 'SCE — DL 101-D/2020 · EPBD 2024 · Classes A+ a F',
    ajouter: '+ Adicionar certificado',
    alerte: {
      titre: 'Sistema de Certificação Energética (SCE) — DL 101-D/2020',
      texte: 'O certificado energético é obrigatório para todos os edifícios. Validade de 10 anos. Diretiva EPBD 2024: todos os edifícios devem atingir classe E até 2030 e classe D até 2033. Frações classe F ficam impedidas de arrendamento (MEPS).',
    },
    kpi: {
      certificats: 'Certificados',
      efficaces: 'Eficientes (A+ a B-)',
      inefficaces: 'Ineficientes (E & F)',
      expires: 'Expirados',
      aRenouveler: 'A renovar <1 ano',
    },
    classes: ['A+', 'A', 'B', 'B-', 'C', 'D', 'E', 'F'],
    classesPerformantes: ['A+', 'A', 'B', 'B-'],
    classesEnergivores: ['E', 'F'],
    vide: { titre: 'Nenhum certificado registado', desc: 'Comece por registar o certificado energético dos seus edifícios.' },
    colonnes: { numero: 'Nº', immeuble: 'Edifício', classe: 'Classe', emission: 'Emissão', validite: 'Validade', expert: 'Perito' },
    formulaire: {
      titre: 'Adicionar certificado energético',
      numero: 'Nº certificado',
      numeroPlaceholder: 'SCE-2026-…',
      classe: 'Classe',
      immeuble: 'Edifício',
      immeublePlaceholder: 'Residência Os Pinheiros, 12 rua…',
      emission: 'Data de emissão',
      validite: 'Data de validade',
      validiteAide: 'Calculada automaticamente (+10 anos)',
      expert: 'Perito qualificado',
      expertPlaceholder: 'Nome do perito SCE',
      notes: 'Notas',
      annuler: 'Cancelar',
      enregistrer: 'Registar',
    },
    erreurs: {
      numero: 'Indique o nº do certificado.',
      immeuble: 'O edifício é obrigatório.',
      emission: 'A data de emissão é obrigatória.',
    },
    toasts: {
      enregistre: 'Certificado registado',
      detail: (numero, classe) => `${numero} · classe ${classe}`,
      erreur: 'Erro ao registar',
      reessayerPlusTard: 'Tente novamente mais tarde',
      enregistreDemo: 'Certificado registado (demo)',
      connexionRequise: 'Conecte-se como síndico para gravar a sério',
    },
  },
  'fr-FR': {
    titre: 'DPE collectif',
    chapeau: 'Diagnostic de performance énergétique · Loi Climat et résilience · Étiquettes A à G',
    ajouter: '+ Ajouter un DPE',
    alerte: {
      titre: 'DPE collectif obligatoire — loi Climat et résilience',
      texte: "Le DPE collectif est obligatoire pour les immeubles en copropriété dont le permis de construire a été déposé avant le 1er janvier 2013 : depuis le 1er janvier 2024 au-delà de 200 lots, depuis le 1er janvier 2025 de 50 à 200 lots et depuis le 1er janvier 2026 pour 50 lots au plus (art. L126-31 du code de la construction et de l'habitation). Il est renouvelé tous les 10 ans, sauf si un DPE réalisé après le 1er juillet 2021 classe l'immeuble en A, B ou C. Location : les logements classés G sont exclus des nouveaux baux depuis 2025, les F le seront en 2028 et les E en 2034.",
    },
    kpi: {
      certificats: 'DPE enregistrés',
      efficaces: 'Performants (A à C)',
      inefficaces: 'Passoires thermiques (F et G)',
      expires: 'Expirés',
      aRenouveler: 'À renouveler sous 1 an',
    },
    classes: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
    classesPerformantes: ['A', 'B', 'C'],
    classesEnergivores: ['F', 'G'],
    vide: { titre: 'Aucun DPE enregistré', desc: 'Commencez par enregistrer le DPE collectif de vos immeubles.' },
    colonnes: { numero: 'N° ADEME', immeuble: 'Immeuble', classe: 'Étiquette', emission: 'Établi le', validite: 'Validité', expert: 'Diagnostiqueur' },
    formulaire: {
      titre: 'Ajouter un DPE collectif',
      numero: 'N° de DPE (ADEME)',
      numeroPlaceholder: 'Numéro à 13 caractères',
      classe: 'Étiquette',
      immeuble: 'Immeuble',
      immeublePlaceholder: 'Résidence Les Pins, 12 rue…',
      emission: "Date d'établissement",
      validite: 'Date de validité',
      validiteAide: 'Calculée automatiquement (+10 ans)',
      expert: 'Diagnostiqueur certifié',
      expertPlaceholder: 'Nom du diagnostiqueur certifié',
      notes: 'Notes',
      annuler: 'Annuler',
      enregistrer: 'Enregistrer',
    },
    erreurs: {
      numero: 'Indiquez le numéro du DPE.',
      immeuble: "L'immeuble est obligatoire.",
      emission: "La date d'établissement est obligatoire.",
    },
    toasts: {
      enregistre: 'DPE enregistré',
      detail: (numero, classe) => `${numero} · étiquette ${classe}`,
      erreur: "Erreur lors de l'enregistrement",
      reessayerPlusTard: 'Veuillez réessayer plus tard',
      enregistreDemo: 'DPE enregistré (démonstration)',
      connexionRequise: 'Connectez-vous en tant que syndic pour enregistrer réellement',
    },
  },
})
