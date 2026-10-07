import { defineMessages } from '@/lib/syndic/v54/i18n'

interface QRCodeTextes {
  titre: string
  chapeau: string
  nouveauBouton: string
  bientot: { titre: string; desc: string }
  kpi: { actifs: string; scans: string; signalements: string; resolus: string }
  onglets: { ger: string; sig: string; est: string }
  filtreAria: string
  tousLesImmeubles: string
  vide: { titre: string; desc: string }
}

export const QRCODE_MESSAGES = defineMessages<QRCodeTextes>({
  'pt-PT': {
    titre: 'QR Code por Fração',
    chapeau: 'Gere QR Codes por zona · Condóminos reportam problemas com scan · Sinalizações automáticas',
    nouveauBouton: '+ Novo QR Code',
    bientot: { titre: 'Novo QR Code', desc: 'Geração de QR codes em desenvolvimento' },
    kpi: { actifs: 'QR Codes ativos', scans: 'Total scans', signalements: 'Novas sinalizações', resolus: 'Resolvidos' },
    onglets: { ger: 'Gerir QR Codes', sig: 'Sinalizações (0)', est: 'Estatísticas' },
    filtreAria: 'Filtrar por edifício',
    tousLesImmeubles: 'Todos os edifícios',
    vide: { titre: 'Nenhum QR Code criado', desc: 'Crie QR Codes para zonas comuns ou frações' },
  },
  'fr-FR': {
    titre: 'QR codes par lot',
    chapeau: 'Générez des QR codes par zone · Les copropriétaires signalent un problème en scannant · Signalements automatiques',
    nouveauBouton: '+ Nouveau QR code',
    bientot: { titre: 'Nouveau QR code', desc: 'Génération de QR codes en cours de développement' },
    kpi: { actifs: 'QR codes actifs', scans: 'Scans au total', signalements: 'Nouveaux signalements', resolus: 'Résolus' },
    onglets: { ger: 'Gérer les QR codes', sig: 'Signalements (0)', est: 'Statistiques' },
    filtreAria: 'Filtrer par immeuble',
    tousLesImmeubles: 'Tous les immeubles',
    vide: { titre: 'Aucun QR code créé', desc: 'Créez des QR codes pour les parties communes ou les lots' },
  },
})
