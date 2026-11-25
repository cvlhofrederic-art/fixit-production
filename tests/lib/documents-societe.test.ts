// tests/lib/documents-societe.test.ts — les devis et factures d'une société BTP vus par ses sous-comptes (25/11/2026).
//
// Ce que ces cas protègent, et qu'aucun écran ne montrerait avant qu'un salarié ouvre l'application :
//
//  1. un rôle sans droit sur les documents ne doit RIEN voir et RIEN pouvoir écrire — la fonction SQL de
//     numérotation accepte tout membre actif de la société sans regarder son rôle, donc la garde est ici ;
//  2. une société non résolue doit être REFUSÉE, jamais remplacée par le compte lui-même — sinon l'écran s'ouvre
//     vide et muet, ce qui était le défaut d'origine ;
//  3. la clé du navigateur reste celle du COMPTE, et la fiche de la société ne sert qu'à l'identité du document :
//     si les deux se confondaient, l'écran d'un salarié écrirait la clé du gérant et, sur un poste partagé, ses
//     brouillons — qui n'existent nulle part ailleurs qu'en local — seraient perdus ;
//  4. les routes ne doivent plus jamais viser `user.id` : une liste visible dont chaque bouton répond 404 est pire
//     qu'une liste vide.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { PerimetreBtp } from '@/lib/btp/perimetre-compte'
import {
  famillesLisibles,
  familleDuTypeSerie,
  ficheEnTeteSeulement,
  ficheSansSecrets,
  niveauDocuments,
  peutEcrireDocuments,
  peutLireDocuments,
  proprietairePourEcriture,
  resoudreTitulaireDocuments,
  societeNonResolue,
} from '@/lib/btp/titulaire-documents'
import { estSousCompteSociete, idFicheDocuments } from '@/lib/documents/identite-documents'
import { getDefaultPermissionsForRole, type ProTeamRole } from '@/lib/permissions'

const SOCIETE = 'c09f69e3-c8ad-4ef4-bdd9-f24c1210c0fa'
const FICHE = '7cfb1e10-0000-4000-8000-000000000001'

/** Compte connecté, tel que le serveur le lit : app_metadata seulement, jamais user_metadata. */
function compte(id: string, appMetadata: Record<string, unknown>): User {
  return { id, email: `${id}@exemple.test`, app_metadata: appMetadata, user_metadata: {} } as unknown as User
}

type Reponse = { data: unknown; error: { message: string } | null }

/**
 * Client d'administration simulé : une réponse par table, et une chaîne d'appels qui accepte `select`, `eq`, `in`,
 * `maybeSingle` et l'attente directe. Un seul harnais pour tous les cas — écrit d'emblée, pour ne pas le recopier.
 */
function adminSimule(reponses: Record<string, Reponse>): SupabaseClient {
  const pourTable = (table: string) => {
    const resultat: Reponse = reponses[table] ?? { data: null, error: null }
    const chaine: Record<string, unknown> = {}
    const soi = () => chaine
    for (const methode of ['select', 'eq', 'in', 'neq', 'is', 'limit', 'order']) chaine[methode] = soi
    chaine.maybeSingle = () => Promise.resolve(resultat)
    chaine.single = () => Promise.resolve(resultat)
    chaine.then = (suite: (v: Reponse) => unknown) => Promise.resolve(resultat).then(suite)
    return chaine
  }
  return { from: (table: string) => pourTable(table) } as unknown as SupabaseClient
}

/** Périmètre d'un sous-compte porteur des permissions réelles de son rôle. */
function perimetreDuRole(role: ProTeamRole): PerimetreBtp {
  return {
    societeId: SOCIETE,
    titulaire: false,
    roleEquipe: role,
    permissions: getDefaultPermissionsForRole(role),
    email: 'salarie@exemple.test',
  }
}

const titulaire: PerimetreBtp = {
  societeId: SOCIETE, titulaire: true, roleEquipe: null, permissions: {}, email: 'patron@exemple.test',
}

describe('familleDuTypeSerie', () => {
  it('rattache les quatre types de série à leur famille', () => {
    expect(familleDuTypeSerie('devis')).toBe('devis')
    expect(familleDuTypeSerie('facture')).toBe('factures')
    // Un acompte et un avoir sont des factures : c'est la permission « factures » qui les gouverne.
    expect(familleDuTypeSerie('acompte')).toBe('factures')
    expect(familleDuTypeSerie('avoir')).toBe('factures')
  })

  it('ne rattache rien à un type inconnu — donc aucun droit', () => {
    expect(familleDuTypeSerie('bon_de_commande')).toBeNull()
    expect(familleDuTypeSerie('')).toBeNull()
  })
})

describe('droits sur les documents, rôle par rôle', () => {
  it('le titulaire voit et écrit tout', () => {
    expect(famillesLisibles(titulaire)).toEqual(['devis', 'factures'])
    expect(peutEcrireDocuments(titulaire, 'devis')).toBe(true)
    expect(peutEcrireDocuments(titulaire, 'factures')).toBe(true)
  })

  it('la secrétaire voit et écrit les deux familles', () => {
    const p = perimetreDuRole('SECRETAIRE')
    expect(niveauDocuments(p, 'devis')).toBe('FULL')
    expect(niveauDocuments(p, 'factures')).toBe('FULL')
    expect(famillesLisibles(p)).toEqual(['devis', 'factures'])
  })

  it('le comptable lit les devis sans pouvoir les écrire, et écrit les factures', () => {
    const p = perimetreDuRole('COMPTABLE')
    expect(niveauDocuments(p, 'devis')).toBe('READ')
    expect(peutLireDocuments(p, 'devis')).toBe(true)
    expect(peutEcrireDocuments(p, 'devis')).toBe(false)
    expect(peutEcrireDocuments(p, 'factures')).toBe(true)
  })

  it('le conducteur de travaux écrit les devis et ne lit que les factures', () => {
    const p = perimetreDuRole('CONDUCTEUR_TRAVAUX')
    expect(peutEcrireDocuments(p, 'devis')).toBe(true)
    expect(niveauDocuments(p, 'factures')).toBe('READ')
    expect(peutEcrireDocuments(p, 'factures')).toBe(false)
  })

  it('un ouvrier et un chef de chantier ne voient aucun document', () => {
    for (const role of ['OUVRIER', 'CHEF_CHANTIER'] as ProTeamRole[]) {
      const p = perimetreDuRole(role)
      expect(famillesLisibles(p)).toEqual([])
      expect(peutEcrireDocuments(p, 'devis')).toBe(false)
      expect(peutEcrireDocuments(p, 'factures')).toBe(false)
    }
  })

  it('un rôle d’équipe non reconnu ne donne aucun droit', () => {
    const inconnu: PerimetreBtp = { ...titulaire, titulaire: false, roleEquipe: null, permissions: {} }
    expect(famillesLisibles(inconnu)).toEqual([])
  })
})

describe('societeNonResolue', () => {
  it('refuse un rattachement annoncé que le serveur n’a pas résolu', () => {
    // Cas réel du co-gérant invité : isProGerant le déclare titulaire de SA société, alors que son jeton dit
    // qu'il appartient à celle d'un autre. Servir son propre compte lui donnerait une liste vide.
    const coGerant = compte('11111111-1111-4111-8111-111111111111', {
      role: 'pro_societe', pro_team_role: 'GERANT', company_id: SOCIETE,
    })
    expect(societeNonResolue(coGerant, { ...titulaire, societeId: coGerant.id })).toBe(true)
  })

  it('laisse passer un gérant qui est sa propre société', () => {
    const gerant = compte(SOCIETE, { role: 'pro_societe' })
    expect(societeNonResolue(gerant, { ...titulaire, societeId: SOCIETE })).toBe(false)
  })

  it('laisse passer un sous-compte dont la société est bien résolue', () => {
    const salarie = compte('22222222-2222-4222-8222-222222222222', {
      role: 'pro_societe', pro_team_role: 'SECRETAIRE', company_id: SOCIETE,
    })
    expect(societeNonResolue(salarie, perimetreDuRole('SECRETAIRE'))).toBe(false)
  })

  it('laisse passer un artisan, qui n’annonce aucun rattachement', () => {
    const artisan = compte('33333333-3333-4333-8333-333333333333', { role: 'artisan' })
    expect(societeNonResolue(artisan, { ...titulaire, societeId: artisan.id })).toBe(false)
  })
})

describe('ficheSansSecrets', () => {
  it('retire les pièces d’identité et les identifiants chiffrés, garde l’en-tête légal', () => {
    const nettoyee = ficheSansSecrets({
      id: FICHE, company_name: 'VITFIX CONSTRUÇÕES, LDA', siret: '516123456', language: 'pt',
      insurance_name: 'Fidelidade', mediator_name: 'CIAB', logo_url: 'https://exemple.test/l.png',
      kyc_status: 'approved', kyc_market: 'pt_btp', nif_encrypted: 'xxx',
      id_document_url: 'https://exemple.test/cc.pdf', stripe_customer_id: 'cus_1',
    })
    expect(Object.keys(nettoyee).sort()).toEqual([
      'company_name', 'id', 'insurance_name', 'language', 'logo_url', 'mediator_name', 'siret',
    ])
  })
})

describe('resoudreTitulaireDocuments', () => {
  const salarie = () => compte(`4${Math.abs(1).toString()}000000-0000-4000-8000-00000000000a`, {
    role: 'pro_societe', pro_team_role: 'SECRETAIRE', company_id: SOCIETE,
  })

  it('rend la société et sa fiche pour un gérant', async () => {
    const gerant = compte(SOCIETE, { role: 'pro_societe' })
    const resultat = await resoudreTitulaireDocuments(gerant, adminSimule({
      profiles_artisan: { data: [{ id: FICHE, company_name: 'VITFIX CONSTRUÇÕES, LDA' }], error: null },
    }))
    expect(resultat.ok).toBe(true)
    if (resultat.ok) {
      expect(resultat.societeId).toBe(SOCIETE)
      expect(resultat.ficheId).toBe(FICHE)
    }
  })

  it('refuse quand la société n’a aucune fiche', async () => {
    const resultat = await resoudreTitulaireDocuments(compte(SOCIETE, { role: 'pro_societe' }), adminSimule({
      profiles_artisan: { data: [], error: null },
    }))
    expect(resultat.ok).toBe(false)
    if (!resultat.ok) expect(resultat.code).toBe('fiche_societe_absente')
  })

  it('refuse quand la société a plusieurs fiches, au lieu d’en choisir une', async () => {
    // profiles_artisan.user_id n'est pas unique : « la première » donnerait un en-tête et un gabarit arbitraires.
    const resultat = await resoudreTitulaireDocuments(compte(SOCIETE, { role: 'pro_societe' }), adminSimule({
      profiles_artisan: { data: [{ id: FICHE }, { id: 'autre-fiche' }], error: null },
    }))
    expect(resultat.ok).toBe(false)
    if (!resultat.ok) expect(resultat.code).toBe('fiche_societe_multiple')
  })

  it('refuse, sans rien lire, un rattachement non résolu', async () => {
    const coGerant = compte('55555555-5555-4555-8555-555555555555', {
      role: 'pro_societe', pro_team_role: 'GERANT', company_id: SOCIETE,
    })
    const resultat = await resoudreTitulaireDocuments(coGerant, adminSimule({
      profiles_artisan: { data: [{ id: FICHE }], error: null },
    }))
    expect(resultat.ok).toBe(false)
    if (!resultat.ok) expect(resultat.code).toBe('societe_non_resolue')
  })

  it('refuse en 500 quand la fiche est illisible, au lieu de rendre une liste vide', async () => {
    const resultat = await resoudreTitulaireDocuments(compte(SOCIETE, { role: 'pro_societe' }), adminSimule({
      profiles_artisan: { data: null, error: { message: 'connection reset' } },
    }))
    expect(resultat.ok).toBe(false)
    if (!resultat.ok) {
      expect(resultat.status).toBe(500)
      expect(resultat.code).toBe('lecture_impossible')
    }
  })

  it('résout la société d’un salarié par sa ligne d’équipe active', async () => {
    const resultat = await resoudreTitulaireDocuments(salarie(), adminSimule({
      pro_team_members: { data: { company_id: SOCIETE, id: 'membre-1' }, error: null },
      pro_role_permissions: { data: [], error: null },
      profiles_artisan: { data: [{ id: FICHE }], error: null },
    }))
    expect(resultat.ok).toBe(true)
    if (resultat.ok) {
      expect(resultat.societeId).toBe(SOCIETE)
      expect(resultat.perimetre.roleEquipe).toBe('SECRETAIRE')
    }
  })
})

describe('un compte sans droit sur les documents garde son application', () => {
  // Un ouvrier pointe ses heures tous les jours : lui refuser l'identité de son entreprise fermerait tout.
  // Il reçoit donc la fiche réduite à l'en-tête d'écran, et aucune famille lisible.
  it('l’ouvrier reçoit l’en-tête de son entreprise, sans son identité légale', async () => {
    const ouvrier = compte('99999999-9999-4999-8999-999999999999', {
      role: 'pro_societe', pro_team_role: 'OUVRIER', company_id: SOCIETE,
    })
    const resultat = await resoudreTitulaireDocuments(ouvrier, adminSimule({
      pro_team_members: { data: { company_id: SOCIETE, id: 'membre-9' }, error: null },
      pro_role_permissions: { data: [], error: null },
      profiles_artisan: {
        data: [{
          id: FICHE, user_id: SOCIETE, company_name: 'VITFIX CONSTRUÇÕES, LDA', logo_url: 'https://x.test/l.png',
          language: 'pt', legal_form: 'Lda.', siret: '516123456', company_address: 'Rua X', insurance_name: 'Fidelidade',
        }],
        error: null,
      },
    }))
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.lisibles).toEqual([])
    expect(Object.keys(resultat.fiche).sort()).toEqual([
      'company_name', 'id', 'language', 'legal_form', 'logo_url', 'user_id',
    ])
  })

  it('ficheEnTeteSeulement ne laisse passer que de quoi afficher l’entreprise', () => {
    const reduite = ficheEnTeteSeulement({
      id: FICHE, user_id: SOCIETE, company_name: 'X', logo_url: null, language: 'pt', legal_form: 'Lda.',
      siret: '516123456', company_address: 'Rua X', rcs_number: 'RCS', tva_intra: 'PT5', insurance_number: 'A1',
      mediator_name: 'CIAB', iban: 'PT50', email: 'x@y.test', phone: '+351',
    })
    expect(Object.keys(reduite).sort()).toEqual([
      'company_name', 'id', 'language', 'legal_form', 'logo_url', 'user_id',
    ])
  })

  it('un gérant invité dans l’équipe d’un autre compte est résolu sur SA société', async () => {
    // isProGerant ne lit pas company_id : sans le correctif, ce compte se déclarait titulaire de lui-même et
    // recevait des listes vides partout, puis un refus sec après l'arrivée de ce lot.
    const coGerant = compte('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', {
      role: 'pro_societe', pro_team_role: 'GERANT', company_id: SOCIETE,
    })
    const resultat = await resoudreTitulaireDocuments(coGerant, adminSimule({
      pro_team_members: { data: { company_id: SOCIETE, id: 'membre-co' }, error: null },
      pro_role_permissions: { data: [], error: null },
      profiles_artisan: { data: [{ id: FICHE, user_id: SOCIETE }], error: null },
    }))
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.societeId).toBe(SOCIETE)
    // Le rôle GERANT donne FULL partout : il voit et écrit les documents de la société.
    expect(resultat.lisibles).toEqual(['devis', 'factures'])
  })
})

describe('proprietairePourEcriture', () => {
  it('rend son propre compte à un artisan : aucune requête ne change', async () => {
    const artisan = compte('66666666-6666-4666-8666-666666666666', { role: 'artisan' })
    const acces = await proprietairePourEcriture(artisan, adminSimule({}), 'factures')
    expect(acces.ok).toBe(true)
    if (acces.ok) expect(acces.proprietaire).toBe(artisan.id)
  })

  it('rend la société à une secrétaire', async () => {
    const secretaire = compte('77777777-7777-4777-8777-777777777777', {
      role: 'pro_societe', pro_team_role: 'SECRETAIRE', company_id: SOCIETE,
    })
    const acces = await proprietairePourEcriture(secretaire, adminSimule({
      pro_team_members: { data: { company_id: SOCIETE, id: 'membre-2' }, error: null },
      pro_role_permissions: { data: [], error: null },
    }), 'factures')
    expect(acces.ok).toBe(true)
    if (acces.ok) expect(acces.proprietaire).toBe(SOCIETE)
  })

  it('refuse un ouvrier en 403', async () => {
    const ouvrier = compte('88888888-8888-4888-8888-888888888888', {
      role: 'pro_societe', pro_team_role: 'OUVRIER', company_id: SOCIETE,
    })
    const acces = await proprietairePourEcriture(ouvrier, adminSimule({
      pro_team_members: { data: { company_id: SOCIETE, id: 'membre-3' }, error: null },
      pro_role_permissions: { data: [], error: null },
    }), 'devis')
    expect(acces.ok).toBe(false)
    if (!acces.ok) expect(acces.status).toBe(403)
  })
})

describe('identité des documents : la clé du navigateur reste au compte', () => {
  it('la fiche de la société sert à l’identité du document', () => {
    const salarie = { id: 'compte-du-salarie', fiche_societe_id: FICHE }
    expect(idFicheDocuments(salarie)).toBe(FICHE)
    expect(estSousCompteSociete(salarie)).toBe(true)
  })

  it('un titulaire garde exactement son propre identifiant', () => {
    const artisan = { id: FICHE }
    expect(idFicheDocuments(artisan)).toBe(FICHE)
    expect(estSousCompteSociete(artisan)).toBe(false)
  })

  it('une fiche de société égale à son propre identifiant n’est pas un sous-compte', () => {
    expect(estSousCompteSociete({ id: FICHE, fiche_societe_id: FICHE })).toBe(false)
  })

  it('une identité pas encore chargée ne fabrique aucun identifiant', () => {
    expect(idFicheDocuments(null)).toBeUndefined()
    expect(idFicheDocuments({ id: '' })).toBeUndefined()
    expect(estSousCompteSociete(null)).toBe(false)
  })
})

// ── Invariants des routes ──────────────────────────────────────────────────────────────────────────────────
// Une liste visible dont chaque bouton répond 404 est pire qu'une liste vide : ces lignes sont celles dont le
// retour à `user.id` ferait exactement cela, sans qu'aucun test de logique ne rougisse.

const racine = process.cwd()
const lire = (chemin: string) => readFileSync(join(racine, chemin), 'utf8')

/**
 * Code d'un fichier sans ses lignes de commentaire. Indispensable : les commentaires de ces routes CITENT
 * justement ce qui n'y est plus (« enregistrée sous `artisan_user_id: user.id` jusqu'au 25/11/2026 »), et une
 * recherche de texte brut les prendrait pour du code.
 */
const lireCode = (chemin: string): string =>
  lire(chemin)
    .split('\n')
    .filter(ligne => {
      const nue = ligne.trim()
      return !nue.startsWith('//') && !nue.startsWith('*') && !nue.startsWith('/*')
    })
    .join('\n')

describe('les routes des documents visent la société, plus le compte qui appelle', () => {
  it('/api/devis/sync enregistre la ligne sous le propriétaire résolu', () => {
    const route = lireCode('app/api/devis/sync/route.ts')
    expect(route).toContain('artisan_user_id: proprietaire')
    expect(route).not.toContain('artisan_user_id: user.id')
    expect(route).not.toContain(".eq('artisan_user_id', user.id)")
    // Garde IDOR comparée au propriétaire, sinon un salarié ne pourrait pas modifier un document de sa société.
    expect(route).toContain("existingOwner !== proprietaire")
  })

  it('/api/doc-number tire le numéro de la série de la société', () => {
    const route = lireCode('app/api/doc-number/route.ts')
    expect(route).toContain('p_artisan_user_id: perimetre.societeId')
    expect(route).not.toContain('p_artisan_user_id: user.id')
    // La fonction SQL n'inspecte aucun rôle : la garde ne peut être qu'ici.
    expect(route).toContain('peutEcrireDocuments')
  })

  it('les routes de mutation ne filtrent plus sur le compte connecté', () => {
    for (const route of [
      'app/api/devis-status/route.ts',
      'app/api/document-cancel/route.ts',
      'app/api/document-legal-hold/route.ts',
    ]) {
      const code = lireCode(route)
      expect(code).not.toContain(".eq('artisan_user_id', user.id)")
      expect(code).toContain('proprietairePourEcriture')
    }
  })

  it('le formulaire BTP enregistre sous la fiche de la société, pas sous le compte du salarié', () => {
    // Sans cela, chaque enregistrement répondait 403 APRÈS avoir consommé un numéro légal : un trou définitif
    // dans la série du gérant, et un écran qui disait « enregistré ».
    const form = lireCode('components/DevisFactureFormBTP.tsx')
    expect(form).not.toContain('syncDocumentSafe(payload as Record<string, unknown>, artisan.id)')
    expect(form).toContain('idFicheDocuments(artisan) || artisan.id')
    // Le repli RPC ne doit jamais servir un sous-compte : la fonction SQL n'inspecte aucun rôle.
    expect(form).toContain("artisan?.user_id && !estSousCompteSociete(artisan)")
  })

  it('un refus de numérotation par le serveur n’est pas contourné par le RPC', () => {
    const client = lireCode('lib/doc-number.ts')
    expect(client).toContain('refuseParLeServeur')
    expect(client).toContain('throw new NumerotationIndisponibleError()')
  })

  it('la lecture de la société ne projette aucune colonne : un document est indivisible', () => {
    // Une ligne sans raw_data qui repasserait par /api/devis/sync écraserait le document par une coquille à 0 €.
    const route = lireCode('app/api/pro/documents/route.ts')
    expect(route).toContain('CHAMPS_DOCUMENT_COMPLET')
    expect(route).not.toContain('COLONNES_VUE_RESTREINTE')
    expect(route).not.toContain('projeter(')
  })
})
