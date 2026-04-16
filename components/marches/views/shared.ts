// Shared constants, types, and helpers for marches views

export const CATEGORIES = [
  { id: 'canalizacao', label: 'Canalização', labelFr: 'Plomberie', emoji: '🔧' },
  { id: 'eletricidade', label: 'Eletricidade', labelFr: 'Électricité', emoji: '⚡' },
  { id: 'pintura', label: 'Pintura', labelFr: 'Peinture', emoji: '🎨' },
  { id: 'serralharia', label: 'Serralharia', labelFr: 'Serrurerie', emoji: '🔩' },
  { id: 'elevadores', label: 'Elevadores', labelFr: 'Ascenseurs', emoji: '🛗' },
  { id: 'limpeza', label: 'Limpeza', labelFr: 'Nettoyage', emoji: '🧹' },
  { id: 'jardinagem', label: 'Paisagismo', labelFr: 'Paysagisme', emoji: '🌱' },
  { id: 'poda', label: 'Poda / Arboricultura', labelFr: 'Élagage', emoji: '🌳' },
  { id: 'impermeabilizacao', label: 'Impermeabilização', labelFr: 'Imperméabilisation', emoji: '💧' },
  { id: 'construcao', label: 'Construção Civil', labelFr: 'Construction', emoji: '🏗️' },
  { id: 'climatizacao', label: 'Climatização', labelFr: 'Climatisation', emoji: '❄️' },
  { id: 'seguranca', label: 'Segurança', labelFr: 'Sécurité', emoji: '🔒' },
  { id: 'gas', label: 'Gás', labelFr: 'Gaz', emoji: '🔥' },
  { id: 'telhados', label: 'Telhados', labelFr: 'Toitures', emoji: '🏠' },
  { id: 'desentupimentos', label: 'Desentupimentos', labelFr: 'Débouchage', emoji: '🚰' },
  { id: 'carpintaria', label: 'Carpintaria', labelFr: 'Menuiserie', emoji: '🪚' },
  { id: 'vidracaria', label: 'Vidraçaria', labelFr: 'Vitrerie', emoji: '🪟' },
  { id: 'mudancas', label: 'Mudanças', labelFr: 'Déménagement', emoji: '📦' },
  { id: 'renovacao', label: 'Renovação', labelFr: 'Rénovation', emoji: '🔨' },
  { id: 'isolamento', label: 'Isolamento', labelFr: 'Isolation', emoji: '🧱' },
  { id: 'metallerie', label: 'Serralharia / Ferragem', labelFr: 'Métallerie / Ferronnerie', emoji: '⚙️' },
  { id: 'outro', label: 'Outro', labelFr: 'Autre', emoji: '📋' },
]

export const FR_REGIONS = [
  { id: 'paca', label: 'PACA (Provence-Alpes-Côte d\'Azur)', depts: ['04', '05', '06', '13', '83', '84'] },
  { id: 'occitanie', label: 'Occitanie', depts: ['09', '11', '12', '30', '31', '32', '34', '46', '48', '65', '66', '81', '82'] },
  { id: 'aura', label: 'Auvergne-Rhône-Alpes', depts: ['01', '03', '07', '15', '26', '38', '42', '43', '63', '69', '73', '74'] },
  { id: 'idf', label: 'Île-de-France', depts: ['75', '77', '78', '91', '92', '93', '94', '95'] },
  { id: 'nouvelle-aquitaine', label: 'Nouvelle-Aquitaine', depts: ['16', '17', '19', '23', '24', '33', '40', '47', '64', '79', '86', '87'] },
  { id: 'hdf', label: 'Hauts-de-France', depts: ['02', '59', '60', '62', '80'] },
  { id: 'grand-est', label: 'Grand Est', depts: ['08', '10', '51', '52', '54', '55', '57', '67', '68', '88'] },
  { id: 'bretagne', label: 'Bretagne', depts: ['22', '29', '35', '56'] },
  { id: 'normandie', label: 'Normandie', depts: ['14', '27', '50', '61', '76'] },
  { id: 'pdl', label: 'Pays de la Loire', depts: ['44', '49', '53', '72', '85'] },
  { id: 'bourgogne-fc', label: 'Bourgogne-Franche-Comté', depts: ['21', '25', '39', '58', '70', '71', '89', '90'] },
  { id: 'centre-vdl', label: 'Centre-Val de Loire', depts: ['18', '28', '36', '37', '41', '45'] },
  { id: 'corse', label: 'Corse', depts: ['2A', '2B'] },
]

export const DEPT_LABELS: Record<string, string> = {
  '04': '04 - Alpes-de-Haute-Provence', '05': '05 - Hautes-Alpes', '06': '06 - Alpes-Maritimes',
  '13': '13 - Bouches-du-Rhône', '83': '83 - Var', '84': '84 - Vaucluse',
  '09': '09 - Ariège', '11': '11 - Aude', '12': '12 - Aveyron', '30': '30 - Gard',
  '31': '31 - Haute-Garonne', '32': '32 - Gers', '34': '34 - Hérault', '46': '46 - Lot',
  '48': '48 - Lozère', '65': '65 - Hautes-Pyrénées', '66': '66 - Pyrénées-Orientales',
  '81': '81 - Tarn', '82': '82 - Tarn-et-Garonne',
  '01': '01 - Ain', '03': '03 - Allier', '07': '07 - Ardèche', '15': '15 - Cantal',
  '26': '26 - Drôme', '38': '38 - Isère', '42': '42 - Loire', '43': '43 - Haute-Loire',
  '63': '63 - Puy-de-Dôme', '69': '69 - Rhône', '73': '73 - Savoie', '74': '74 - Haute-Savoie',
  '75': '75 - Paris', '77': '77 - Seine-et-Marne', '78': '78 - Yvelines',
  '91': '91 - Essonne', '92': '92 - Hauts-de-Seine', '93': '93 - Seine-Saint-Denis',
  '94': '94 - Val-de-Marne', '95': '95 - Val-d\'Oise',
  '16': '16 - Charente', '17': '17 - Charente-Maritime', '19': '19 - Corrèze',
  '23': '23 - Creuse', '24': '24 - Dordogne', '33': '33 - Gironde', '40': '40 - Landes',
  '47': '47 - Lot-et-Garonne', '64': '64 - Pyrénées-Atlantiques', '79': '79 - Deux-Sèvres',
  '86': '86 - Vienne', '87': '87 - Haute-Vienne',
  '02': '02 - Aisne', '59': '59 - Nord', '60': '60 - Oise', '62': '62 - Pas-de-Calais', '80': '80 - Somme',
  '08': '08 - Ardennes', '10': '10 - Aube', '51': '51 - Marne', '52': '52 - Haute-Marne',
  '54': '54 - Meurthe-et-Moselle', '55': '55 - Meuse', '57': '57 - Moselle',
  '67': '67 - Bas-Rhin', '68': '68 - Haut-Rhin', '88': '88 - Vosges',
  '22': '22 - Côtes-d\'Armor', '29': '29 - Finistère', '35': '35 - Ille-et-Vilaine', '56': '56 - Morbihan',
  '14': '14 - Calvados', '27': '27 - Eure', '50': '50 - Manche', '61': '61 - Orne', '76': '76 - Seine-Maritime',
  '44': '44 - Loire-Atlantique', '49': '49 - Maine-et-Loire', '53': '53 - Mayenne', '72': '72 - Sarthe', '85': '85 - Vendée',
  '21': '21 - Côte-d\'Or', '25': '25 - Doubs', '39': '39 - Jura', '58': '58 - Nièvre',
  '70': '70 - Haute-Saône', '71': '71 - Saône-et-Loire', '89': '89 - Yonne', '90': '90 - Territoire de Belfort',
  '18': '18 - Cher', '28': '28 - Eure-et-Loir', '36': '36 - Indre', '37': '37 - Indre-et-Loire',
  '41': '41 - Loir-et-Cher', '45': '45 - Loiret',
  '2A': '2A - Corse-du-Sud', '2B': '2B - Haute-Corse',
}

export const TIMELINE_OPTIONS = [
  { value: '1_day', labelFr: '1 jour', labelPt: '1 dia' },
  { value: '3_days', labelFr: '3 jours', labelPt: '3 dias' },
  { value: '1_week', labelFr: '1 semaine', labelPt: '1 semana' },
  { value: '2_weeks', labelFr: '2 semaines', labelPt: '2 semanas' },
  { value: '1_month', labelFr: '1 mois', labelPt: '1 mês' },
  { value: '2_months', labelFr: '2 mois', labelPt: '2 meses' },
  { value: '3_months', labelFr: '3 mois', labelPt: '3 meses' },
  { value: 'custom', labelFr: 'Personnalisé', labelPt: 'Personalizado' },
]

export function getCategoryLabel(id: string, isPt: boolean): string {
  const cat = CATEGORIES.find(c => c.id === id)
  if (!cat) return id
  return `${cat.emoji} ${isPt ? cat.label : cat.labelFr}`
}

export function getCategoryEmoji(id: string): string {
  return CATEGORIES.find(c => c.id === id)?.emoji || '📋'
}

export function daysRemaining(deadline: string): number {
  const now = new Date()
  const end = new Date(deadline)
  const diff = end.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

