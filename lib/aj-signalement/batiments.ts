// ── Bâtiments d'une copropriété proposés au déclarant : règles pures ─────────
//
// Demande de Hugo du 17/11/2026 : « dans le formulaire de signalement du copropriétaire, fais un champ de remplissage par
// choix avec les bâtiments qui sont prédéfinis par nous ». Constat : Parc Bel Ombre a ses bâtiments saisis dans sa fiche
// (colonne signalements_qr_coproprietes.batiments : Titan, Planier, Cicies, Faraman, commerces), mais le champ
// « Bâtiment » du formulaire public était un texte libre et un déclarant a pu saisir « A ».
// Quand le cabinet a saisi au moins un bâtiment, le formulaire propose une liste à choix dans l'ordre saisi et la route
// du dépôt refuse un bâtiment absent de la liste ; sans bâtiment saisi, rien ne change (texte libre).
// Module sans dépendance, partagé par les pages publiques (serveur), le formulaire (navigateur), le schéma Zod du dépôt
// (lib/validation.ts) et la route du dépôt :
//   - batimentsProposesQr : la liste que voit le public — textes seuls, sans espaces autour, BATIMENT_MAX_QR caractères
//     au plus (borne du champ et de signalementQrSchema : un nom plus long ne pourrait pas être envoyé), doublons écartés
//     à la casse et aux espaces près (le premier saisi reste), dans l'ordre du cabinet. Seuls ces noms quittent le
//     serveur (minimisation) ;
//   - batimentDeLaListeQr : le nom saisi par le cabinet qui correspond à une saisie, sans tenir compte de la casse ni des
//     espaces en trop ; null s'il n'y en a pas.
// Volontairement plus strict que normaliserBatimentQr (semblables.ts), qui assimile « Bât. B » à « B » pour retrouver
// des signalements saisis librement : ici la personne CHOISIT dans la liste ; seul un écart de casse ou d'espaces
// (POST direct, liste modifiée par le cabinet pendant la saisie) est toléré. Les accents comptent (« Ciciès » n'est pas
// « Cicies ») ; une même lettre accentuée écrite en un ou deux caractères (NFC / NFD) est la même.

/** Longueur maximale d'un bâtiment : celle du champ du formulaire et de signalementQrSchema. */
export const BATIMENT_MAX_QR = 50

/** Clé de comparaison d'un nom de bâtiment : forme NFC, espaces réduits à un seul, sans espaces autour, minuscules. */
export const cleBatimentListeQr = (nom: string): string => nom.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase()

/** Bâtiments saisis par le cabinet, tels que le formulaire public les propose ; [] sans liste utilisable. */
export function batimentsProposesQr(valeur: unknown): string[] {
  if (!Array.isArray(valeur)) return []
  const vus = new Set<string>()
  const proposes: string[] = []
  for (const element of valeur) {
    if (typeof element !== 'string') continue
    const nom = element.trim()
    const cle = cleBatimentListeQr(nom)
    if (!cle || nom.length > BATIMENT_MAX_QR || vus.has(cle)) continue
    vus.add(cle)
    proposes.push(nom)
  }
  return proposes
}

/** Nom saisi par le cabinet correspondant à la saisie (casse et espaces en trop ignorés) ; null s'il n'est pas dans la liste. */
export function batimentDeLaListeQr(saisie: string, batiments: readonly string[]): string | null {
  const cle = cleBatimentListeQr(saisie)
  if (!cle) return null
  return batiments.find((nom) => cleBatimentListeQr(nom) === cle) ?? null
}
