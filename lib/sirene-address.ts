// ══════════════════════════════════════════════════════════════════════════════
// SIRENE — formatage d'adresse de siège (anti-duplication)
// ══════════════════════════════════════════════════════════════════════════════
// BUG HISTORIQUE (12/05/2026, profil Carvalho 920b7d34-…) :
//   L'API recherche-entreprises.api.gouv.fr renvoie un objet `siege` avec
//   3 champs : `adresse`, `code_postal`, `libelle_commune`. Selon l'entité,
//   `adresse` peut être SOIT la rue seule ("ETG RDC ALLEE HIPPOLYTE
//   GONDREXON") SOIT déjà concaténée avec CP+ville ("ETG RDC ALLEE
//   HIPPOLYTE GONDREXON 13830 ROQUEFORT-LA-BEDOULE").
//
//   Le code historique faisait `[adresse, "CP VILLE"].join(', ')` naïvement
//   sans dédoublonner. Résultat : profil_artisan.company_address pollué
//   en "...13830 ROQUEFORT-LA-BEDOULE, 13830 ROQUEFORT-LA-BEDOULE".
//   Le PDF V2 rendait ensuite "Ville : 13830 Roquefort, 13830 Roquefort".
//
// FIX : un seul helper utilisé par TOUS les points d'écriture profil
// (verify-siret, artisan-company, register fallback).

export interface SireneSiege {
  adresse?: string | null
  code_postal?: string | null
  libelle_commune?: string | null
}

/**
 * Concatène l'adresse complète du siège en évitant la duplication CP+ville
 * lorsque `adresse` contient déjà le code postal.
 */
export function formatSiegeAddress(siege?: SireneSiege | null): string {
  if (!siege) return ''
  const adresse = (siege.adresse || '').trim()
  const cp = (siege.code_postal || '').trim()
  const ville = (siege.libelle_commune || '').trim()

  if (!adresse) return [cp, ville].filter(Boolean).join(' ').trim()
  // Si l'adresse SIRENE contient déjà le code postal, elle est complète.
  if (cp && adresse.includes(cp)) return adresse
  const tail = `${cp} ${ville}`.trim()
  return tail ? `${adresse}, ${tail}` : adresse
}
