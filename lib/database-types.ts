// ─────────────────────────────────────────────────────────────────────────────
// Couche CANONIQUE des types Database — lib/database-types.ts (TIRET)
//
// RÈGLE D'IMPORT : tout le code importe `Database` (et les helpers Tables<>,
// TablesInsert<>, Enums<>…) d'ICI, jamais de './database.types' directement.
//
// Historique : ce fichier a porté des définitions « pending » pour les tables/RPC
// créées par le lot de migrations 20260612* (audit Phase 2). Depuis l'application
// du lot en prod le 2026-06-13 (supabase db push) et la régénération de
// database.types.ts, toutes ces tables existent dans le schéma généré : la couche
// pending est VIDE et ce fichier n'est plus qu'un ré-export.
//
// Si une future migration ajoute des objets pas encore en prod, on peut ré-ajouter
// un bloc PendingTables ici et le fusionner — puis le vider après régénération.
// Le test tests/lib/database-types-pending.test.ts garde-fou ce cycle.
// ─────────────────────────────────────────────────────────────────────────────

export * from "./database.types"
export type { Database, Json } from "./database.types"
