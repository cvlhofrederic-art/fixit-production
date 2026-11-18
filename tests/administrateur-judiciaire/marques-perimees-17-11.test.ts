import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { enTeteDuModule } from './en-tete-module'

/**
 * Marques 🔴 périmées (relevé du 17/11/2026, partie D : D2, D3, D5 à D7, D9, D10 et D11) : la décision est appliquée,
 * la marque est remplacée par un renvoi à la décision (J-n, ou J67 et sa recommandation Rn) ou au module qui la porte.
 * Ces tests gardent les en-têtes. D1, D4 et D8 sont gardés par les tests de leur module.
 */

/** Partie de l'en-tête qui suit le marqueur (les questions ouvertes, en général). */
const apres = (texte: string, marqueur: string): string => {
  const i = texte.indexOf(marqueur)
  if (i < 0) throw new Error(`Marqueur « ${marqueur} » introuvable.`)
  return texte.slice(i)
}

describe('marques périmées retirées des en-têtes', () => {
  it('D2 — formes d’envoi (gabarits-courrier.ts) : LRE et émargement ne sont plus une question ; J50 et D. 1967 art. 64-3 cités', () => {
    const { texte } = enTeteDuModule('gabarits-courrier')
    expect(apres(texte, '🔴 Non établi')).not.toMatch(/remise contre émargement manquent au référentiel/)
    expect(texte).toContain(
      "Formes d'envoi : liste Gestéam inchangée ; mode de notification propre à VitFix (J50) ; remise contre émargement : option de l'appelant (remiseContreEmargement), admise pour la convocation seulement (remiseContreEmargementAdmise), le texte la limitant aux convocations et à l'avis de l'art. 59 (D. 1967 art. 64-3).",
    )
  })

  it('D3 — adresse électronique datée et contrôle avant envoi (identites-positions.ts) : renvoi à voie-notification.ts', () => {
    const { texte } = enTeteDuModule('identites-positions')
    const nonEtabli = apres(texte, '🔴 Non établi')
    expect(nonEtabli).not.toContain('adresse électronique datée (les télécoms ne le sont pas ; voir le point 60)')
    expect(nonEtabli).not.toContain('relève du point 60')
    expect(texte).toMatch(/🟢 Adresse électronique de notification datée : voie-notification\.ts .*appelée par avis-appel\.ts/)
    expect(texte).toContain(
      "contrôle avant envoi : controlerAvantEnvoiElectronique (voie-notification.ts), écrit et testé, à brancher par l'appelant de creerEnvoiNotificationElectronique (anomaliesAvantEnvoi)",
    )
  })

  it('D5 — délais d’assurance (sinistres.ts) : textes relus le 17/11/2026, calendrier réglementaire au choix de Frédéric', () => {
    const { texte } = enTeteDuModule('sinistres')
    expect(texte).not.toContain('🔴 À confirmer sur Légifrance')
    expect(texte).toMatch(/🟢 L\. 113-2, L\. 114-1 et L\. 114-2 relus sur Légifrance le 17\/11\/2026/)
    expect(texte).toContain('leur ajout au calendrier réglementaire est un choix de Frédéric')
  })

  it('D6 — droit proportionnel opération par opération (travaux-budget.ts) : plus de 🔴 dans la phrase de J39', () => {
    const { item } = enTeteDuModule('travaux-budget')
    const j39 = item('- J39 :')
    expect(j39).not.toContain('🔴')
    expect(j39).toContain('La question « opération par opération, ou une seule fois au montant total » est tranchée')
  })

  it('D7 — relance de l’accusé et du rapport (relance-demandes.ts) : J13 citée, la question retirée', () => {
    const { texte } = enTeteDuModule('relance-demandes')
    expect(apres(texte, '🔴 Non établi')).not.toContain('la relance vise-t-elle aussi')
    expect(texte).toMatch(/Décision J13 de Hugo \(03\/11\/2026\) : la relance vise aussi l'« Accusé demandé » et le « Rapport demandé »/)
  })

  it('D9 — espèces refusées à l’encaissement (encaissements-pieces.ts) : J29 citée, la puce 🔴 retirée', () => {
    const { texte } = enTeteDuModule('encaissements-pieces')
    expect(apres(texte, '🔴 Non établi')).not.toMatch(/espèces : refusées/)
    expect(texte).toMatch(/Décisions J25 et J29 de Hugo \(03\/11\/2026\) : espèces refusées/)
  })

  it('D11 — suivi « à faire » (suivi-a-faire.ts) : le jour de fin de la garantie est tranché (J67, R63), aConfirmer gardé', () => {
    const { texte } = enTeteDuModule('suivi-a-faire')
    expect(texte).toContain(
      "échéance au même quantième un an après la réception (J67, R63 ; code gardé) ; aConfirmer gardé, comme R63 le demande",
    )
    expect(texte).not.toContain('est une question ouverte pour Hugo, le calcul du module est gardé')
    const source = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'suivi-a-faire.ts'), 'utf8')
    expect(source).not.toContain('le jour exact de fin du délai reste ouvert')
  })
})
