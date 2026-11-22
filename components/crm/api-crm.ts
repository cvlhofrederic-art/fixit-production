// ── CRM du secrétariat : appels du navigateur vers app/api/crm/* ────────────
// Jeton de la session ajouté par fetchAuthentifie ; une réponse en erreur lève ErreurApiCrm (statut + code court).

import { fetchAuthentifie } from '@/lib/fetch-authentifie'
import type { CompteursCrm, ContactCrm, ContactTrouveCrm, DemandeCrm, DetailDemandeCrm, EvenementCrm } from '@/lib/crm/types'
import type { CreerDemandeEntree, ModifierContactEntree, ModifierDemandeEntree } from '@/lib/crm/schemas'

export class ErreurApiCrm extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`${status} ${code}`)
    this.name = 'ErreurApiCrm'
  }
}

async function appeler<T>(url: string, options: RequestInit = {}): Promise<T> {
  const reponse = await fetchAuthentifie(url, options)
  const corps: unknown = await reponse.json().catch(() => null)
  if (!reponse.ok) {
    const code = typeof corps === 'object' && corps !== null && 'error' in corps ? String((corps as { error: unknown }).error) : 'erreur'
    throw new ErreurApiCrm(reponse.status, code)
  }
  return corps as T
}

const envoyer = (methode: 'POST' | 'PATCH', corps: unknown): RequestInit => ({ method: methode, body: JSON.stringify(corps) })

export const apiCrm = {
  listerDemandes: () => appeler<{ demandes: DemandeCrm[]; compteurs: CompteursCrm; tronquee: boolean }>('/api/crm/demandes'),
  creerDemande: (entree: Partial<CreerDemandeEntree> & Pick<CreerDemandeEntree, 'motif' | 'canal'>) =>
    appeler<{ demande: DemandeCrm }>('/api/crm/demandes', envoyer('POST', entree)),
  lireDemande: (id: string) => appeler<DetailDemandeCrm>(`/api/crm/demandes/${encodeURIComponent(id)}`),
  modifierDemande: (id: string, patch: ModifierDemandeEntree) =>
    appeler<{ demande: DemandeCrm }>(`/api/crm/demandes/${encodeURIComponent(id)}`, envoyer('PATCH', patch)),
  ajouterNote: (id: string, contenu: string) =>
    appeler<{ evenement: EvenementCrm }>(`/api/crm/demandes/${encodeURIComponent(id)}/notes`, envoyer('POST', { contenu })),
  contactParTelephone: (telephone: string) =>
    appeler<{ telephone: string; trouve: ContactTrouveCrm | null }>(`/api/crm/contacts?telephone=${encodeURIComponent(telephone)}`),
  modifierContact: (id: string, patch: Partial<Record<keyof ModifierContactEntree, string>>) =>
    appeler<{ contact: ContactCrm }>(`/api/crm/contacts/${encodeURIComponent(id)}`, envoyer('PATCH', patch)),
}
