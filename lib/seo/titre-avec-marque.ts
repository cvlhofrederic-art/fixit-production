/**
 * Titre d'une page FR ou EN dont la phrase contient déjà la marque (« Blog Vitfix : … ») : titre absolu, sinon le
 * template « %s | VITFIX » de app/fr/layout.tsx ou de app/en/layout.tsx la répéterait. Les autres pages donnent un
 * titre sans marque, que le template complète (garde : tests/seo/titres-marque-unique.test.ts).
 */
export function titreAvecMarque(phrase: string): { absolute: string } {
  return { absolute: phrase }
}
