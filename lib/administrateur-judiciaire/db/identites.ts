import { journaliserActivite, type OptionsEcriture } from '@/lib/administrateur-judiciaire/db/repository'
import { ajDb, type IdentiteEnregistree } from '@/lib/administrateur-judiciaire/db/schema'
import {
  changerQualiteProfessionnelle,
  type SaisieQualiteProfessionnelle,
} from '@/lib/administrateur-judiciaire/domain/qualite-professionnelle'

/**
 * Seul point d'écriture de la case « professionnel » datée (J78, décisions du 19/11/2026, à valider par Frédéric) sur la
 * table des identités (version 3) : dans une même transaction, lecture de l'identité, nouvel état daté
 * (changerQualiteProfessionnelle : cochée sur justification écrite, effet le lendemain), écriture et une entrée au
 * journal d'activité. Une erreur n'écrit rien. Aucun appelant aujourd'hui (pas d'écran) ; l'écran passera le jour
 * courant (date figée en démonstration).
 */
export function enregistrerQualiteProfessionnelle(
  identiteId: string,
  saisie: SaisieQualiteProfessionnelle,
  { aujourdhui, actor = null }: OptionsEcriture & { aujourdhui: string },
): Promise<IdentiteEnregistree> {
  return ajDb.transaction('rw', ajDb.identites, ajDb.activityLog, async () => {
    const avant = await ajDb.identites.get(identiteId)
    if (!avant) throw new Error(`identites introuvable (id=${identiteId})`)
    const apres: IdentiteEnregistree = {
      ...avant,
      ...changerQualiteProfessionnelle(avant, saisie, { aujourdhui }),
      updatedAt: new Date().toISOString(),
      updatedBy: actor,
    }
    await ajDb.identites.put(apres)
    await journaliserActivite({ entite: 'identites', entiteId: identiteId, action: 'update', qui: actor, avant, apres })
    return apres
  })
}
