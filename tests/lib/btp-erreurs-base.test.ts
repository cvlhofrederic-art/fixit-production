// tests/lib/btp-erreurs-base.test.ts — traduction des refus de la base pour POST /api/btp (lib/btp/erreurs-base-btp.ts).
//
// Chaque cas de traduireErreurBase, y compris ceux que les tests de la route n'atteignent pas (fiche liée introuvable
// à l'écriture, contrainte ou champ non nommés, champ inconnu, absence d'erreur). Le message ne reprend jamais le
// détail brut de la base. Aucune donnée réelle : messages de PostgreSQL recopiés avec des valeurs inventées.

import { describe, it, expect } from 'vitest'
import { MESSAGE_FICHE_INTROUVABLE, traduireErreurBase } from '@/lib/btp/erreurs-base-btp'

const SITUATION_RATTACHEE = {
  code: '23503',
  message: 'update or delete on table "chantiers_btp" violates foreign key constraint "situations_btp_chantier_id_fkey" on table "situations_btp"',
}

describe('traduireErreurBase — clé étrangère (23503)', () => {
  it('suppression : 409 qui nomme la fiche rattachée, lue dans le message', () => {
    expect(traduireErreurBase(SITUATION_RATTACHEE, 'delete', 'chantiers_btp'))
      .toEqual({ status: 409, message: 'Ce chantier ne peut pas être supprimé : une situation de travaux y est rattachée.' })
  })

  it('suppression : fiche rattachée lue dans le détail quand le message ne la donne pas', () => {
    const erreur = { code: '23503', message: 'violation de clé étrangère', details: 'Key (id)=(x) is still referenced from table "equipe_membres_btp".' }
    expect(traduireErreurBase(erreur, 'delete', 'membres_btp'))
      .toEqual({ status: 409, message: 'Ce membre de l\'équipe ne peut pas être supprimé : une équipe y est rattachée.' })
  })

  it('suppression d’une fiche sans sujet prévu, table rattachée inconnue : phrase générale', () => {
    const erreur = { code: '23503', message: 'update or delete on table "dpgf_btp" violates foreign key constraint "x_fkey" on table "autre_table"' }
    expect(traduireErreurBase(erreur, 'delete', 'dpgf_btp'))
      .toEqual({ status: 409, message: 'Cette fiche ne peut pas être supprimée : d\'autres données y sont rattachées.' })
  })

  it('création ou modification : 400, fiche liée introuvable', () => {
    const erreur = { code: '23503', message: 'insert or update on table "pointages_btp" violates foreign key constraint "pointages_btp_chantier_id_fkey"' }
    for (const action of ['insert', 'update', 'import']) {
      expect(traduireErreurBase(erreur, action, 'pointages_btp'))
        .toEqual({ status: 400, message: 'Enregistrement refusé : la fiche liée (chantier, membre ou équipe) est introuvable.' })
    }
  })
})

describe('traduireErreurBase — autres refus', () => {
  it('fiche introuvable (PGRST116) : 404', () => {
    expect(traduireErreurBase({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }, 'update', 'chantiers_btp'))
      .toEqual({ status: 404, message: MESSAGE_FICHE_INTROUVABLE })
  })

  it('doublon (23505) : 409', () => {
    expect(traduireErreurBase({ code: '23505', message: 'duplicate key value violates unique constraint "x_pkey"' }, 'insert', 'charges_fixes'))
      .toEqual({ status: 409, message: 'Enregistrement refusé : cette fiche existe déjà.' })
  })

  it('contrainte CHECK (23514) : le champ est nommé si la contrainte suit la convention, sinon phrase générale', () => {
    expect(traduireErreurBase({ code: '23514', message: 'new row for relation "chantiers_btp" violates check constraint "chantiers_btp_statut_check"' }, 'insert', 'chantiers_btp'))
      .toEqual({ status: 400, message: 'Enregistrement refusé : valeur non autorisée pour statut.' })
    expect(traduireErreurBase({ code: '23514', message: 'new row for relation "chantiers_btp" violates check constraint "budget_positif"' }, 'insert', 'chantiers_btp'))
      .toEqual({ status: 400, message: 'Enregistrement refusé : une des valeurs saisies n\'est pas autorisée.' })
  })

  it('champ obligatoire (23502) : le champ est nommé s’il est lu dans le message, sinon phrase générale', () => {
    expect(traduireErreurBase({ code: '23502', message: 'null value in column "employe" of relation "pointages_btp" violates not-null constraint' }, 'insert', 'pointages_btp'))
      .toEqual({ status: 400, message: 'Enregistrement refusé : champ obligatoire manquant (employe).' })
    expect(traduireErreurBase({ code: '23502', message: 'valeur NULL interdite' }, 'insert', 'pointages_btp'))
      .toEqual({ status: 400, message: 'Enregistrement refusé : un champ obligatoire est manquant.' })
  })

  it('format impossible (nombre, date, heure, identifiant, texte trop long) : 400', () => {
    for (const code of ['22P02', '22007', '22008', '22003', '22023', '22001']) {
      expect(traduireErreurBase({ code, message: 'invalid input syntax' }, 'insert', 'chantiers_btp'))
        .toEqual({ status: 400, message: 'Enregistrement refusé : une des valeurs saisies n\'a pas le bon format (nombre, date, heure ou identifiant).' })
    }
  })

  it('champ inconnu de la base (PGRST204) : 400', () => {
    expect(traduireErreurBase({ code: 'PGRST204', message: 'Could not find the \'couleur\' column of \'chantiers_btp\' in the schema cache' }, 'update', 'chantiers_btp'))
      .toEqual({ status: 400, message: 'Enregistrement refusé : un des champs envoyés n\'existe pas.' })
  })

  it('panne quelconque, ou aucune erreur de la base : 500 « Erreur serveur », sans détail', () => {
    expect(traduireErreurBase({ code: '57014', message: 'canceling statement due to statement timeout' }, 'insert', 'chantiers_btp'))
      .toEqual({ status: 500, message: 'Erreur serveur' })
    expect(traduireErreurBase(null, 'insert', 'chantiers_btp')).toEqual({ status: 500, message: 'Erreur serveur' })
    expect(traduireErreurBase(undefined, 'delete', 'chantiers_btp')).toEqual({ status: 500, message: 'Erreur serveur' })
    expect(traduireErreurBase({ message: 'sans code' }, 'delete', 'chantiers_btp')).toEqual({ status: 500, message: 'Erreur serveur' })
  })
})
