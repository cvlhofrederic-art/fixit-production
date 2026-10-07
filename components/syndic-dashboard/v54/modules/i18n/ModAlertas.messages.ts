import { defineMessages } from '@/lib/syndic/v54/i18n'

interface AlertasTextes {
  titre: string
  chapeau: string
  rcPro: { etiquette: string; titre: string }
  decennale: { etiquette: string; titre: string }
  reglement: { etiquette: string; titre: string }
  vide: { titre: string; description: string }
}

export const ALERTAS_MESSAGES = defineMessages<AlertasTextes>({
  'pt-PT': {
    titre: 'Alertas',
    chapeau: 'Alertas urgentes do sistema, prazos legais e operacionais',
    rcPro: { etiquette: 'Seguro', titre: 'Seguro RC Pro inválido ou em falta' },
    decennale: { etiquette: 'Garantia', titre: 'Garantia decenal em falta' },
    reglement: { etiquette: 'Documento', titre: 'Regulamento de condomínio em falta' },
    vide: { titre: 'Todos os alertas foram tratados!', description: 'Operação nominal' },
  },
  'fr-FR': {
    titre: 'Alertes',
    chapeau: 'Alertes urgentes du système, échéances légales et opérationnelles',
    rcPro: { etiquette: 'Assurance', titre: 'Assurance RC Pro invalide ou manquante' },
    // Assurance de responsabilité décennale obligatoire des constructeurs (C. assur., art. L241-1).
    decennale: { etiquette: 'Garantie', titre: 'Assurance décennale manquante' },
    // Règlement de copropriété (loi n° 65-557 du 10 juillet 1965, art. 8).
    reglement: { etiquette: 'Document', titre: 'Règlement de copropriété manquant' },
    vide: { titre: 'Toutes les alertes ont été traitées !', description: 'Fonctionnement normal' },
  },
})
