// ══════════════════════════════════════════════════════════════════════════════
// Parser CSV Gecond — Import de frações/condóminos depuis Gecond
// Supporte le format complet (42 colonnes) et le format simplifié (export liste)
// ══════════════════════════════════════════════════════════════════════════════

export interface GecondFraction {
  // Fraction
  codigo: string           // Code fraction (ex: "A", "1", "1A")
  complemento: string      // Description (ex: "1o Esquerdo", "R/C Direito")
  permilagem: number       // Millièmes (0-999.99)
  area: number             // Surface m²
  votos: number            // Votes

  // Propriétaire
  nomProprietaire: string
  nifProprietaire: string
  emailProprietaire: string
  indicatifProprietaire: string
  telProprietaire: string
  telemovelProprietaire: string
  conjugeProprietaire: string

  // Locataire (optionnel)
  nomLocataire: string
  nifLocataire: string
  emailLocataire: string
  indicatifLocataire: string
  telLocataire: string
  telemovelLocataire: string
  conjugeLocataire: string

  // Adresse propriétaire
  endereco: string
  codigoPostal: string
  localidade: string
  pais: string

  // Adresse locataire
  enderecoLocataire: string
  codigoPostalLocataire: string
  localidadeLocataire: string
  paisLocataire: string

  // Ligne originale pour debug
  _rawLine: number
}

export interface GecondParseResult {
  fractions: GecondFraction[]
  errors: { line: number; message: string }[]
  warnings: { line: number; message: string }[]
  stats: {
    totalLines: number
    parsedOk: number
    skipped: number
    withOwner: number
    withTenant: number
  }
  detectedFormat: 'full_42' | 'simplified' | 'custom'
  detectedDelimiter: string
  headers: string[]
}

// ── Mapping colonnes Gecond 42-colonnes (par position) ──────────────────────
const GECOND_FULL_COLUMNS = [
  'codigo', 'complemento', 'permilagem', 'area', 'votos', 'zona',
  'nome_proprietario', 'nif_proprietario', 'email_proprietario',
  'indicativo_proprietario', 'telefone_proprietario', 'telemovel_proprietario',
  'conjuge_proprietario', 'lingua_nativa', 'lingua_preferencial',
  'pais', 'endereco', 'codigo_postal', 'localidade',
  'sexo', 'envio_avisos', 'envio_cartas', 'envio_convocatorias', 'data_entrada',
  'nome_inquilino', 'nif_inquilino', 'email_inquilino',
  'indicativo_inquilino', 'telefone_inquilino', 'telemovel_inquilino',
  'conjuge_inquilino', 'lingua_nativa_inq', 'lingua_preferencial_inq',
  'pais_inquilino', 'endereco_inquilino', 'codigo_postal_inquilino', 'localidade_inquilino',
  'sexo_inquilino', 'envio_avisos_inq', 'envio_cartas_inq', 'envio_convocatorias_inq',
  'data_entrada_inquilino',
]

// ── Header aliases pour la détection par nom ────────────────────────────────
const HEADER_ALIASES: Record<string, string[]> = {
  codigo: ['codigo', 'código', 'cod', 'fracao', 'fração', 'fraction', 'code', 'lot'],
  complemento: ['complemento', 'descricao', 'descrição', 'description', 'tipo', 'designation', 'désignation'],
  permilagem: ['permilagem', 'milésimos', 'millesimes', 'millièmes', 'tantiemes', 'tantièmes', 'quota', 'share', 'perm'],
  area: ['area', 'área', 'superficie', 'surface', 'm2'],
  votos: ['votos', 'votes', 'vote'],
  nome_proprietario: ['nome', 'nome_proprietario', 'nome do proprietário', 'nome do proprietario', 'proprietario', 'proprietário', 'owner', 'nom', 'nom_proprietaire', 'nom propriétaire'],
  nif_proprietario: ['nif', 'nif_proprietario', 'contribuinte', 'no contribuinte', 'nº contribuinte', 'tax_id'],
  email_proprietario: ['email', 'email_proprietario', 'e-mail', 'mail', 'email proprietário', 'email_proprietaire'],
  telefone_proprietario: ['telefone', 'telefone_proprietario', 'tel', 'phone', 'telephone', 'téléphone', 'tel_proprietaire'],
  telemovel_proprietario: ['telemovel', 'telemóvel', 'mobile', 'celular', 'portable', 'gsm'],
  nome_inquilino: ['nome_inquilino', 'nome do inquilino', 'inquilino', 'tenant', 'locataire', 'nom_locataire'],
  email_inquilino: ['email_inquilino', 'email inquilino', 'email_locataire'],
  telefone_inquilino: ['telefone_inquilino', 'tel_inquilino', 'tel_locataire'],
  telemovel_inquilino: ['telemovel_inquilino', 'mobile_inquilino'],
  nif_inquilino: ['nif_inquilino', 'nif inquilino'],
  conjuge_proprietario: ['conjuge', 'cônjuge', 'nome do conjuge', 'nome do cônjuge', 'spouse'],
  conjuge_inquilino: ['conjuge_inquilino', 'cônjuge inquilino'],
  endereco: ['endereco', 'endereço', 'morada', 'adresse', 'address', 'rua'],
  codigo_postal: ['codigo_postal', 'código postal', 'cp', 'postal', 'zip', 'code_postal'],
  localidade: ['localidade', 'cidade', 'city', 'ville', 'town'],
  pais: ['pais', 'país', 'country', 'pays'],
  endereco_inquilino: ['endereco_inquilino', 'endereço inquilino', 'morada inquilino'],
  codigo_postal_inquilino: ['codigo_postal_inquilino', 'cp inquilino'],
  localidade_inquilino: ['localidade_inquilino', 'cidade inquilino'],
  pais_inquilino: ['pais_inquilino', 'país inquilino'],
}

// ── Détection automatique du délimiteur ─────────────────────────────────────
function detectDelimiter(firstLines: string[]): string {
  const candidates = [';', ',', '\t', '|']
  let best = ';'
  let bestScore = 0

  for (const delim of candidates) {
    // Compter le nombre de colonnes pour chaque ligne
    const counts = firstLines.map(l => l.split(delim).length)
    // Si toutes les lignes ont le même nombre de colonnes > 1, c'est probablement le bon
    const consistent = counts.every(c => c === counts[0]) && counts[0] > 1
    const score = consistent ? counts[0] * 10 : Math.max(...counts)
    if (score > bestScore) {
      bestScore = score
      best = delim
    }
  }

  return best
}

// ── Parse une valeur numérique avec virgule décimale ────────────────────────
function parseDecimal(val: string): number {
  if (!val || !val.trim()) return 0
  // Gecond utilise la virgule comme séparateur décimal
  const cleaned = val.trim().replace(/\s/g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

// ── Parse CSV respectant les guillemets ─────────────────────────────────────
function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const next = line[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"'
        i++ // skip next quote
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === delimiter) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
  }

  result.push(current.trim())
  return result
}

// ── Normaliser un header pour la correspondance ─────────────────────────────
function normalizeHeader(h: string): string {
  return h.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9_\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
}

// ── Détecter le mapping des colonnes par les headers ────────────────────────
function detectColumnMapping(headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {}
  const normalizedHeaders = headers.map(normalizeHeader)

  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const normalizedAliases = aliases.map(normalizeHeader)
    const idx = normalizedHeaders.findIndex(h =>
      normalizedAliases.some(alias => h === alias || h.includes(alias))
    )
    if (idx !== -1) {
      mapping[field] = idx
    }
  }

  return mapping
}

// ── Extraire étage et porte depuis le "complemento" Gecond ──────────────────
export function parseComplemento(comp: string): { batiment: string; etage: number; porte: string } {
  if (!comp) return { batiment: '', etage: 0, porte: '' }

  const c = comp.trim()
  let etage = 0
  let porte = ''
  let batiment = ''

  // Patterns courants : "1o Esquerdo", "2o Dto", "R/C Esquerdo", "Cave 1", "3o Andar Frente"
  // Étage
  const etageMatch = c.match(/^(\d+)[oº°]?\s*/i)
  if (etageMatch) {
    etage = parseInt(etageMatch[1])
  } else if (/^r\/?c\b/i.test(c) || /^res?\s*do?\s*chao/i.test(c) || /^rdc\b/i.test(c)) {
    etage = 0
  } else if (/^cave/i.test(c) || /^sub/i.test(c)) {
    etage = -1
  }

  // Porte / côté
  const porteMatch = c.match(/(esq(?:uerdo)?|dto|dir(?:eito)?|frente|traseiras?|centro|[a-d])\s*$/i)
  if (porteMatch) {
    const p = porteMatch[1].toLowerCase()
    if (p.startsWith('esq')) porte = 'Esq'
    else if (p === 'dto' || p.startsWith('dir')) porte = 'Dto'
    else if (p === 'frente') porte = 'Frente'
    else if (p.startsWith('traseira')) porte = 'Traseiras'
    else if (p === 'centro') porte = 'Centro'
    else porte = p.toUpperCase()
  }

  // Si pas d'étage ni porte détectés, utiliser le complemento entier comme porte
  if (!etageMatch && !porteMatch && !/^(r\/?c|cave|sub)/i.test(c)) {
    porte = c
  }

  return { batiment, etage, porte: porte || c }
}

// ── Séparer nom/prénom ──────────────────────────────────────────────────────
export function splitName(fullName: string): { nom: string; prenom: string } {
  if (!fullName || !fullName.trim()) return { nom: '', prenom: '' }

  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return { nom: parts[0], prenom: '' }

  // Convention portugaise : dernier mot = nom de famille, reste = prénom(s)
  const nom = parts[parts.length - 1]
  const prenom = parts.slice(0, -1).join(' ')
  return { nom, prenom }
}

// ══════════════════════════════════════════════════════════════════════════════
// PARSER PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export function parseGecondCSV(csvContent: string): GecondParseResult {
  const errors: { line: number; message: string }[] = []
  const warnings: { line: number; message: string }[] = []
  const fractions: GecondFraction[] = []

  // Normaliser les fins de ligne
  const rawLines = csvContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const nonEmptyLines = rawLines.filter(l => l.trim().length > 0)

  if (nonEmptyLines.length < 2) {
    errors.push({ line: 0, message: 'Le fichier CSV est vide ou ne contient qu\'une seule ligne' })
    return {
      fractions, errors, warnings,
      stats: { totalLines: rawLines.length, parsedOk: 0, skipped: 0, withOwner: 0, withTenant: 0 },
      detectedFormat: 'custom', detectedDelimiter: ';', headers: [],
    }
  }

  // Détecter le délimiteur
  const sampleLines = nonEmptyLines.slice(0, Math.min(5, nonEmptyLines.length))
  const delimiter = detectDelimiter(sampleLines)

  // Parser la première ligne comme headers
  const headerLine = nonEmptyLines[0]
  const headers = parseCSVLine(headerLine, delimiter)

  // Détecter le format
  let format: 'full_42' | 'simplified' | 'custom' = 'custom'
  let columnMapping: Record<string, number> = {}

  if (headers.length >= 38) {
    // Probablement le format complet 42 colonnes — mapping par position
    format = 'full_42'
    GECOND_FULL_COLUMNS.forEach((col, idx) => {
      if (idx < headers.length) columnMapping[col] = idx
    })
  } else {
    // Format simplifié ou custom — mapping par nom de header
    columnMapping = detectColumnMapping(headers)
    format = Object.keys(columnMapping).length >= 5 ? 'simplified' : 'custom'
  }

  // Vérifier les colonnes essentielles
  const hasCodigo = 'codigo' in columnMapping
  const hasNom = 'nome_proprietario' in columnMapping
  if (!hasCodigo && !hasNom) {
    errors.push({
      line: 1,
      message: `Impossible de détecter les colonnes essentielles. Headers trouvés : ${headers.join(', ')}`,
    })
  }

  // Fonction pour lire une valeur par nom de colonne
  const getValue = (row: string[], field: string): string => {
    const idx = columnMapping[field]
    if (idx === undefined || idx >= row.length) return ''
    return (row[idx] || '').trim()
  }

  // Parser chaque ligne de données
  for (let i = 1; i < nonEmptyLines.length; i++) {
    const lineNum = i + 1 // numéro affiché (1-indexed)
    const line = nonEmptyLines[i]

    try {
      const cols = parseCSVLine(line, delimiter)

      // Skip lignes trop courtes
      if (cols.length < 2) {
        warnings.push({ line: lineNum, message: 'Ligne ignorée (trop peu de colonnes)' })
        continue
      }

      const codigo = getValue(cols, 'codigo')
      const nomProp = getValue(cols, 'nome_proprietario')

      // Skip si ni code ni nom
      if (!codigo && !nomProp) {
        warnings.push({ line: lineNum, message: 'Ligne ignorée (pas de code fraction ni de nom propriétaire)' })
        continue
      }

      const fraction: GecondFraction = {
        codigo: codigo,
        complemento: getValue(cols, 'complemento'),
        permilagem: parseDecimal(getValue(cols, 'permilagem')),
        area: parseDecimal(getValue(cols, 'area')),
        votos: parseInt(getValue(cols, 'votos')) || 0,

        nomProprietaire: nomProp,
        nifProprietaire: getValue(cols, 'nif_proprietario'),
        emailProprietaire: getValue(cols, 'email_proprietario'),
        indicatifProprietaire: getValue(cols, 'indicativo_proprietario') || '+351',
        telProprietaire: getValue(cols, 'telefone_proprietario'),
        telemovelProprietaire: getValue(cols, 'telemovel_proprietario'),
        conjugeProprietaire: getValue(cols, 'conjuge_proprietario'),

        nomLocataire: getValue(cols, 'nome_inquilino'),
        nifLocataire: getValue(cols, 'nif_inquilino'),
        emailLocataire: getValue(cols, 'email_inquilino'),
        indicatifLocataire: getValue(cols, 'indicativo_inquilino') || '+351',
        telLocataire: getValue(cols, 'telefone_inquilino'),
        telemovelLocataire: getValue(cols, 'telemovel_inquilino'),
        conjugeLocataire: getValue(cols, 'conjuge_inquilino'),

        endereco: getValue(cols, 'endereco'),
        codigoPostal: getValue(cols, 'codigo_postal'),
        localidade: getValue(cols, 'localidade'),
        pais: getValue(cols, 'pais') || 'Portugal',

        enderecoLocataire: getValue(cols, 'endereco_inquilino'),
        codigoPostalLocataire: getValue(cols, 'codigo_postal_inquilino'),
        localidadeLocataire: getValue(cols, 'localidade_inquilino'),
        paisLocataire: getValue(cols, 'pais_inquilino'),

        _rawLine: lineNum,
      }

      // Validations
      if (fraction.permilagem < 0 || fraction.permilagem > 999.99) {
        warnings.push({ line: lineNum, message: `Permilagem hors limites: ${fraction.permilagem}` })
      }

      fractions.push(fraction)
    } catch (err: any) {
      errors.push({ line: lineNum, message: `Erreur de parsing: ${err.message}` })
    }
  }

  return {
    fractions,
    errors,
    warnings,
    stats: {
      totalLines: nonEmptyLines.length - 1, // minus header
      parsedOk: fractions.length,
      skipped: (nonEmptyLines.length - 1) - fractions.length,
      withOwner: fractions.filter(f => f.nomProprietaire).length,
      withTenant: fractions.filter(f => f.nomLocataire).length,
    },
    detectedFormat: format,
    detectedDelimiter: delimiter,
    headers,
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CONVERSION Gecond → Format Fixit (syndic_coproprios)
// ══════════════════════════════════════════════════════════════════════════════
export interface FixitCoproprio {
  immeuble: string
  batiment: string
  etage: number
  numero_porte: string
  nom_proprietaire: string
  prenom_proprietaire: string
  email_proprietaire: string
  tel_proprietaire: string
  nom_locataire?: string
  prenom_locataire?: string
  email_locataire?: string
  tel_locataire?: string
  est_occupe: boolean
  notes?: string
  tantieme: number
}

export function gecondToFixit(
  fractions: GecondFraction[],
  immeubleName: string
): FixitCoproprio[] {
  return fractions.map(f => {
    const { batiment, etage, porte } = parseComplemento(f.complemento)
    const ownerName = splitName(f.nomProprietaire)
    const tenantName = splitName(f.nomLocataire)

    // Téléphone : préférer telemóvel, sinon fixe
    const telProp = f.telemovelProprietaire || f.telProprietaire
    const telLoc = f.telemovelLocataire || f.telLocataire

    // Notes enrichies avec données Gecond non mappées
    const noteParts: string[] = []
    if (f.codigo) noteParts.push(`Fração: ${f.codigo}`)
    if (f.nifProprietaire) noteParts.push(`NIF: ${f.nifProprietaire}`)
    if (f.area) noteParts.push(`Área: ${f.area}m²`)
    if (f.votos) noteParts.push(`Votos: ${f.votos}`)
    if (f.conjugeProprietaire) noteParts.push(`Cônjuge: ${f.conjugeProprietaire}`)
    if (f.endereco) noteParts.push(`Morada: ${f.endereco}`)
    if (f.codigoPostal) noteParts.push(`CP: ${f.codigoPostal}`)
    if (f.localidade) noteParts.push(`Localidade: ${f.localidade}`)
    if (f.nifLocataire) noteParts.push(`NIF inquilino: ${f.nifLocataire}`)

    return {
      immeuble: immeubleName,
      batiment: batiment || '',
      etage,
      numero_porte: porte || f.codigo,
      nom_proprietaire: ownerName.nom,
      prenom_proprietaire: ownerName.prenom,
      email_proprietaire: f.emailProprietaire.toLowerCase().trim(),
      tel_proprietaire: telProp ? `${f.indicatifProprietaire} ${telProp}`.trim() : '',
      nom_locataire: tenantName.nom || undefined,
      prenom_locataire: tenantName.prenom || undefined,
      email_locataire: f.emailLocataire ? f.emailLocataire.toLowerCase().trim() : undefined,
      tel_locataire: telLoc ? `${f.indicatifLocataire} ${telLoc}`.trim() : undefined,
      est_occupe: !!f.nomLocataire,
      notes: noteParts.length > 0 ? `[Import Gecond] ${noteParts.join(' | ')}` : undefined,
      tantieme: f.permilagem, // Gecond = permilagem (‰), Fixit = tantième
    }
  })
}
