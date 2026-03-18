// ── Password Policy — Politique de mot de passe unifiée ──────────────────────
// Minimum 8 caractères, au moins 1 majuscule, 1 minuscule, 1 chiffre
// Appliquée uniformément sur TOUTES les pages d'inscription et changement MDP

export interface PasswordValidation {
  valid: boolean
  errors: string[]
}

const MIN_LENGTH = 8
const MAX_LENGTH = 128

export function validatePassword(password: string, locale: 'fr' | 'pt' = 'fr'): PasswordValidation {
  const errors: string[] = []

  if (!password || password.length < MIN_LENGTH) {
    errors.push(locale === 'pt'
      ? `A palavra-passe deve ter pelo menos ${MIN_LENGTH} caracteres`
      : `Le mot de passe doit contenir au moins ${MIN_LENGTH} caractères`)
  }

  if (password.length > MAX_LENGTH) {
    errors.push(locale === 'pt'
      ? `A palavra-passe não pode exceder ${MAX_LENGTH} caracteres`
      : `Le mot de passe ne peut pas dépasser ${MAX_LENGTH} caractères`)
  }

  if (!/[A-Z]/.test(password)) {
    errors.push(locale === 'pt'
      ? 'Deve conter pelo menos 1 letra maiúscula'
      : 'Doit contenir au moins 1 lettre majuscule')
  }

  if (!/[a-z]/.test(password)) {
    errors.push(locale === 'pt'
      ? 'Deve conter pelo menos 1 letra minúscula'
      : 'Doit contenir au moins 1 lettre minuscule')
  }

  if (!/[0-9]/.test(password)) {
    errors.push(locale === 'pt'
      ? 'Deve conter pelo menos 1 número'
      : 'Doit contenir au moins 1 chiffre')
  }

  return { valid: errors.length === 0, errors }
}

// Helper : message d'erreur concaténé pour les formulaires
export function getPasswordError(password: string, locale: 'fr' | 'pt' = 'fr'): string | null {
  const { valid, errors } = validatePassword(password, locale)
  if (valid) return null
  return errors[0] // Retourner la première erreur uniquement (UX)
}

// Description des règles pour affichage dans les formulaires
export function getPasswordRules(locale: 'fr' | 'pt' = 'fr'): string {
  return locale === 'pt'
    ? 'Mínimo 8 caracteres, 1 maiúscula, 1 minúscula, 1 número'
    : 'Minimum 8 caractères, 1 majuscule, 1 minuscule, 1 chiffre'
}
