import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Titre et description d'un toast « en développement ». */
interface Bientot { titre: string; desc: string }

interface OpenBankingTextes {
  surtitre: string
  titre: string
  chapeau: string
  connecterCompteBancaire: string
  synchroniserMaintenant: string
  bientot: { connecterCompteBancaire: Bientot; synchronisation: Bientot; connecterCompte: Bientot }
  alerte: { titre: string; texte: string }
  kpi: { comptes: string; transactions: string; rapprochement: string; revue: string; nonRapprochees: string; derniereSynchro: string }
  /** Pourcentage du KPI de rapprochement automatique (démonstration à 0). */
  zeroPourcent: string
  onglets: { comptes: string; synchro: string; aRevoir: string }
  vide: { titre: string; desc: string; action: string }
  banquesTitre: string
  /** Banques prises en charge (démonstration ; noms fictifs en français). */
  banques: string[]
}

export const OPEN_BANKING_MESSAGES = defineMessages<OpenBankingTextes>({
  'pt-PT': {
    surtitre: 'TESOURARIA · PSD2 AISP',
    titre: 'Open Banking — Reconciliação Automática',
    chapeau: 'Conexão direta bancos PT · Sync diário · Max Expert auto-match transações · Confidence score',
    connecterCompteBancaire: '+ Conectar conta bancária',
    synchroniserMaintenant: 'Sync agora',
    bientot: {
      connecterCompteBancaire: { titre: 'Conectar conta bancária', desc: 'Integração Open Banking em desenvolvimento' },
      synchronisation: { titre: 'Sincronização', desc: 'Sync bancária em desenvolvimento' },
      connecterCompte: { titre: 'Conectar conta', desc: 'Integração Open Banking em desenvolvimento' },
    },
    alerte: {
      titre: 'PSD2 Open Banking — autorização Banco Portugal',
      texte: 'Conexões via providers licenciados AISP (Tink · GoCardless). Suporta Caixa, BCP, Santander, Novobanco, Millennium, BPI, Crédito Agrícola, Revolut Business. Max Expert auto-match 90%+ das transações com confidence score; restantes 10% revisão manual em 1 clique.',
    },
    kpi: {
      comptes: 'Contas conectadas',
      transactions: 'Transações sync (mês)',
      rapprochement: 'Auto-match Max Expert',
      revue: 'Em revisão manual',
      nonRapprochees: 'Não conciliadas',
      derniereSynchro: 'Última sync',
    },
    zeroPourcent: '0%',
    onglets: { comptes: 'Contas (0)', synchro: 'Sync recente', aRevoir: 'A rever (0)' },
    vide: {
      titre: 'Nenhuma conta conectada',
      desc: 'Conecte a conta bancária do condomínio via Open Banking PSD2. Sync automático diário, reconciliação 90%+ por Max Expert.',
      action: 'Conectar primeira conta',
    },
    banquesTitre: 'Bancos suportados',
    banques: ['Caixa Geral', 'BCP Millennium', 'Santander', 'Novobanco', 'BPI', 'Crédito Agrícola', 'Revolut Business', 'Wise Business', 'Activo Bank', 'Banco CTT'],
  },
  'fr-FR': {
    surtitre: 'TRÉSORERIE · DSP2 AISP',
    titre: 'Open Banking — rapprochement bancaire automatique',
    chapeau: 'Connexion directe au compte séparé du syndicat · Synchronisation quotidienne · Rapprochement automatique des opérations par Max Expert · Indice de confiance',
    connecterCompteBancaire: '+ Connecter un compte bancaire',
    synchroniserMaintenant: 'Synchroniser',
    bientot: {
      connecterCompteBancaire: { titre: 'Connecter un compte bancaire', desc: "L'intégration Open Banking est en cours de développement" },
      synchronisation: { titre: 'Synchronisation', desc: 'La synchronisation bancaire est en cours de développement' },
      connecterCompte: { titre: 'Connecter un compte', desc: "L'intégration Open Banking est en cours de développement" },
    },
    alerte: {
      titre: 'DSP2 Open Banking — prestataires AISP habilités',
      texte: "Le syndic ouvre au nom du syndicat un compte bancaire séparé, sur lequel sont versées toutes les sommes reçues au nom ou pour le compte du syndicat (art. 18 de la loi du 10 juillet 1965). La connexion passe par des prestataires de services d'information sur les comptes (AISP) habilités au titre de la directive DSP2 (Tink · GoCardless). Banques prises en charge : Banque des Deux Rives, Banque Fourvière, Crédit Saint-Jean, Néobanque Confluence, Banque de la Part-Dieu, Caisse des Monts d'Or, Rivage Pro. Max Expert rapproche automatiquement plus de 90 % des opérations avec un indice de confiance ; les 10 % restants se valident à la main en un clic.",
    },
    kpi: {
      comptes: 'Comptes connectés',
      transactions: 'Opérations synchronisées (mois)',
      rapprochement: 'Rapprochement auto Max Expert',
      revue: 'À vérifier manuellement',
      nonRapprochees: 'Non rapprochées',
      derniereSynchro: 'Dernière synchronisation',
    },
    zeroPourcent: '0 %',
    onglets: { comptes: 'Comptes (0)', synchro: 'Synchronisations récentes', aRevoir: 'À revoir (0)' },
    vide: {
      titre: 'Aucun compte connecté',
      desc: "Connectez le compte bancaire séparé du syndicat via l'Open Banking (DSP2). Synchronisation automatique quotidienne, plus de 90 % des opérations rapprochées par Max Expert.",
      action: 'Connecter un premier compte',
    },
    banquesTitre: 'Banques prises en charge',
    banques: ['Banque des Deux Rives', 'Banque Fourvière', 'Crédit Saint-Jean', 'Néobanque Confluence', 'Banque de la Part-Dieu', "Caisse des Monts d'Or", 'Rivage Pro', 'Hexa Business', "Banque en ligne Presqu'île", 'Caisse Rhodanienne'],
  },
})
