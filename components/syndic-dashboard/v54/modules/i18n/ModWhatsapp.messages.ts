import { defineMessages } from '@/lib/syndic/v54/i18n'
import type { PillKind } from '../../primitives/pill'

/** Conversation de démonstration : copropriétaire, lot, dernier message, situation de compte, teinte. */
export interface ConversaWhatsapp {
  nome: string
  fracao: string
  msg: string
  estado: string
  kind: PillKind
}

interface WhatsappTextes {
  titre: string
  chapeau: string
  onglets: { msg: string; mod: string; env: string; cfg: string }
  coproprietaires: string
  filtrerCanal: string
  tousLesCanaux: string
  selectionner: string
  demo: ConversaWhatsapp[]
}

export const WHATSAPP_MESSAGES = defineMessages<WhatsappTextes>({
  'pt-PT': {
    titre: 'Comunicação com Condóminos',
    chapeau: 'WhatsApp, SMS e Email — mensagens, modelos e envios em massa',
    onglets: { msg: 'Mensagens', mod: 'Modelos', env: 'Envio em Massa', cfg: 'Configuração' },
    coproprietaires: 'Condóminos',
    filtrerCanal: 'Filtrar canal',
    tousLesCanaux: 'Todos os canais',
    selectionner: 'Selecione um condómino para ver as mensagens',
    demo: [
      { nome: 'Ana Silva', fracao: 'Fração A - 1.º Esq', msg: 'Obrigada, já procedi ao pagamento…', estado: 'Em dia', kind: 'sage' },
      { nome: 'Carlos Santos', fracao: 'Fração B - 1.º Dto', msg: 'Sr. Carlos, a quota de fevereiro encontra-se…', estado: 'Atrasado', kind: 'rust' },
      { nome: 'Maria Costa', fracao: 'Fração C - 2.º Esq', msg: 'CONDOMINIO AURORA: Aviso manutenção…', estado: 'Em dia', kind: 'sage' },
      { nome: 'Pedro Ferreira', fracao: 'Fração D - 2.º Dto', msg: 'Exmo. Sr. Ferreira, serve a presente par…', estado: 'Em divida', kind: 'rust' },
      { nome: 'Sofia Oliveira', fracao: 'Fração A - R/C', msg: 'Convocatória: Assembleia Geral Ordinária', estado: 'Em dia', kind: 'sage' },
    ],
  },
  'fr-FR': {
    titre: 'Communication WhatsApp/SMS avec les copropriétaires',
    chapeau: 'WhatsApp, SMS et e-mail — messages, modèles et envois groupés',
    onglets: { msg: 'Messages', mod: 'Modèles', env: 'Envoi groupé', cfg: 'Configuration' },
    coproprietaires: 'Copropriétaires',
    filtrerCanal: 'Filtrer par canal',
    tousLesCanaux: 'Tous les canaux',
    selectionner: 'Sélectionnez un copropriétaire pour afficher ses messages',
    demo: [
      { nome: 'Anne Simon', fracao: 'Lot A - 1er étage gauche', msg: "Merci, je viens d'effectuer le paiement…", estado: 'À jour', kind: 'sage' },
      { nome: 'Charles Samson', fracao: 'Lot B - 1er étage droite', msg: "M. Samson, l'appel de charges de février reste…", estado: 'En retard', kind: 'rust' },
      { nome: 'Marie Coste', fracao: 'Lot C - 2e étage gauche', msg: "RÉSIDENCE AURORE : avis d'entretien…", estado: 'À jour', kind: 'sage' },
      { nome: 'Pierre Ferrand', fracao: 'Lot D - 2e étage droite', msg: 'Monsieur Ferrand, par la présente, nous vous…', estado: 'Débiteur', kind: 'rust' },
      { nome: 'Sophie Olivier', fracao: 'Lot A - RDC', msg: 'Convocation : assemblée générale ordinaire', estado: 'À jour', kind: 'sage' },
    ],
  },
})
