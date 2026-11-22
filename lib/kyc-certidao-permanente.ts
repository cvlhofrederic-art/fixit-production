// Lecture du texte d'une certidão permanente du registre commercial portugais, pièce que dépose une société BTP
// inscrite en portugais (marché KYC pt_btp, lib/kyc-orchestrate.ts). Le texte vient de la lecture de l'image par un
// modèle : mise en page libre (lignes « Libellé : valeur », libellé seul puis valeur à la ligne, tableau, gras
// Markdown), libellés en majuscules ou non, chiffres parfois groupés par trois. Fonctions pures, sans réseau.

export interface CertidaoLue {
  /** NIPC lu : celui déclaré par la société s'il figure dans le texte, sinon le premier numéro après « NIPC » ou « Matrícula ». */
  nipc: string | null
  /** Le NIPC déclaré figure dans le texte (groupé par trois ou non). */
  nipcDeclarePresent: boolean
  /** Firma (dénomination) de la société, lue sur la ligne « Firma » ou « Denominação ». */
  firma: string | null
  /** Gérant ou administrateur, s'il est lisible : montré à l'administrateur, jamais compté dans le score. */
  gerente: string | null
  /** Código de acesso (0000-0000-0000) : l'administrateur consulte la certidão en ligne avec ce code. */
  codigoAcesso: string | null
  /** Fin de validité de la certidão (AAAA-MM-JJ). */
  validaAte: string | null
}

// Libellé d'une autre rubrique de la matrícula, suivi de son séparateur : une firma lue sur une ligne qui enchaîne les
// rubriques s'arrête avant lui (« Obras Capital, Lda » reste entière).
const RUBRIQUE_SUIVANTE = /\s+(?:natureza\s+jur[ií]dica|sede|nipc|matr[ií]cula|capital|obje(?:c)?to|cae)[ \t]*[:.–-].*$/i
// Neuf chiffres, groupés par trois ou non (espace, point ou tiret), sans chiffre collé avant ni après.
const NEUF_CHIFFRES = /(?<!\d)(\d{3})[\s.-]?(\d{3})[\s.-]?(\d{3})(?!\d)/g

/** Texte ramené à des lignes « libellé : valeur » : gras et titres Markdown retirés, cellules de tableau à la ligne. */
function normaliser(texte: string): string {
  return texte.replace(/[*#`]/g, '').replace(/\|/g, '\n').replace(/\r/g, '')
}

/** Valeur d'un libellé : sur sa ligne après un séparateur, ou seule sur la ligne suivante quand le libellé est seul. */
function valeurApres(texte: string, libelle: string): string | null {
  const surLaLigne = new RegExp(`^[ \\t]*(?:${libelle})[ \\t]*[:.–-][ \\t]*(\\S[^\\n]*)$`, 'im').exec(texte)
  if (surLaLigne) return surLaLigne[1].trim()
  const ligneSuivante = new RegExp(`^[ \\t]*(?:${libelle})[ \\t]*(?::[ \\t]*)?\\n[ \\t]*(\\S[^\\n]*)$`, 'im').exec(texte)
  return ligneSuivante ? ligneSuivante[1].trim() : null
}

function lireFirma(texte: string): string | null {
  const valeur = valeurApres(texte, 'firma|denomina[cç][aã]o(?:[ \\t]+social)?')
  if (!valeur) return null
  const firma = valeur.replace(RUBRIQUE_SUIVANTE, '').trim()
  return firma.length >= 2 ? firma.slice(0, 160) : null
}

function lireGerente(texte: string): string | null {
  const direct = valeurApres(texte, 'gerente(?:s)?|administrador(?:es)?')
  if (direct) return direct.slice(0, 100)
  // Rubrique « Gerência » (ou « Órgãos sociais ») suivie, dans les lignes d'après, du nom de la personne désignée.
  const rubrique = /ger[eê]ncia|administra[cç][aã]o|[oó]rg[aã]os\s+sociais/i.exec(texte)
  if (!rubrique) return null
  const suite = texte.slice(rubrique.index, rubrique.index + 400)
  const nom = /nome(?:[ \t]*\/[ \t]*firma)?[ \t]*[:.–-][ \t]*(\S[^\n]{2,99})/i.exec(suite)
  return nom ? nom[1].trim() : null
}

function lireCodigoAcesso(texte: string): string | null {
  const m = /c[oó]digo[ \t]+de[ \t]+acesso\s*(?:[:.–-]\s*)?(\d{4})[ \t]*-[ \t]*(\d{4})[ \t]*-[ \t]*(\d{4})/i.exec(texte)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

/** Date AAAA-MM-JJ, à partir de AAAA-MM-JJ ou de JJ/MM/AAAA (JJ.MM.AAAA, JJ-MM-AAAA) ; null si le jour ou le mois est impossible. */
function dateIso(annee: string, mois: string, jour: string): string | null {
  const m = Number(mois)
  const j = Number(jour)
  if (m < 1 || m > 12 || j < 1 || j > 31) return null
  return `${annee}-${mois}-${jour}`
}

function lireValidaAte(texte: string): string | null {
  const m = /v[aá]lida[ \t]+at[eé]\s*(?:[:.–-]\s*)?(?:(\d{4})-(\d{2})-(\d{2})|(\d{2})[/.-](\d{2})[/.-](\d{4}))/i.exec(texte)
  if (!m) return null
  return m[1] ? dateIso(m[1], m[2], m[3]) : dateIso(m[6], m[5], m[4])
}

function lireNipc(texte: string, nipcDeclare: string): { nipc: string | null; nipcDeclarePresent: boolean } {
  const numeros = [...texte.matchAll(NEUF_CHIFFRES)].map((m) => `${m[1]}${m[2]}${m[3]}`)
  if (nipcDeclare && numeros.includes(nipcDeclare)) return { nipc: nipcDeclare, nipcDeclarePresent: true }
  const libelle = /(?:nipc|matr[ií]cula)\D{0,30}(\d{3})[\s.-]?(\d{3})[\s.-]?(\d{3})(?!\d)/i.exec(texte)
  return { nipc: libelle ? `${libelle[1]}${libelle[2]}${libelle[3]}` : null, nipcDeclarePresent: false }
}

/** Lit la certidão d'après son texte ; `nipcDeclare` est le NIPC de la fiche (9 chiffres, sans espace). */
export function lireCertidaoPermanente(texte: string, nipcDeclare: string): CertidaoLue {
  const propre = normaliser(texte)
  return {
    ...lireNipc(propre, nipcDeclare),
    firma: lireFirma(propre),
    gerente: lireGerente(propre),
    codigoAcesso: lireCodigoAcesso(propre),
    validaAte: lireValidaAte(propre),
  }
}
