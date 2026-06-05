// ── Validation NIF / NIPC portugais (algorithme officiel AT — modulo 11) ────
// Premiers chiffres autorisés (Autoridade Tributária) :
//   1, 2, 3 → particulier (résident)
//   5       → personne morale (NIPC)
//   6       → administration publique
//   8       → empresário em nome individual (EI / Recibos Verdes)
//   9       → autres pessoas coletivas (associations, condomínios)
// (Le chiffre 3 reste rare mais existe pour certains résidents anciens — on l'inclut
// pour ne pas faussement rejeter ; le checksum reste le verrou principal.)

const VALID_FIRST_DIGITS = new Set(['1', '2', '3', '5', '6', '8', '9'])

export function validateNif(raw: string | null | undefined): boolean {
  if (!raw || typeof raw !== 'string') return false
  const nif = raw.replace(/\D/g, '')
  if (nif.length !== 9) return false
  if (!VALID_FIRST_DIGITS.has(nif[0])) return false

  const digits = nif.split('').map(Number)
  const sum = digits.slice(0, 8).reduce((acc, d, i) => acc + d * (9 - i), 0)
  const remainder = sum % 11
  const expected = remainder < 2 ? 0 : 11 - remainder
  return digits[8] === expected
}

export function extractNif(text: string | null | undefined): string | null {
  if (!text) return null
  // Pattern : 3+3+3 avec espaces optionnels (ex. "276 873 297" ou "276873297")
  const candidates = text.match(/\b\d{3}\s?\d{3}\s?\d{3}\b/g) || []
  for (const candidate of candidates) {
    const clean = candidate.replace(/\s/g, '')
    if (validateNif(clean)) return clean
  }
  return null
}
