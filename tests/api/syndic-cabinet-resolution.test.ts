import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Garde-fou anti-régression : ces routes syndic doivent dériver le cabinet_id
// depuis `syndic_team_members` (via `resolveCabinetId`) — sinon les team_members
// (`syndic_comptable`, `syndic_tech`, etc.) voient 0 ligne.
//
// Voir l'audit dans .claude/plans/harmonic-roaming-hoare.md — Finding 1.2.

const ROUTES_REQUIRING_CABINET_RESOLUTION = [
  // Catégorie A — Léa
  'app/api/syndic/lea-comptable/route.ts',
  'app/api/syndic/lea-documents/route.ts',
  'app/api/syndic/lea-documents/[id]/route.ts',
  'app/api/syndic/lea-documents/upload/route.ts',
  'app/api/syndic/lea-documents/process/route.ts',
  'app/api/syndic/lea-pdf-generate/route.ts',
  'app/api/syndic/lea-pdf-templates/route.ts',
  'app/api/syndic/lea-pdf-templates/[id]/route.ts',
  // Catégorie B — agents IA / notifications (queries cabinet partiellement)
  'app/api/syndic/alfredo-chat/route.ts',
  'app/api/syndic/notify-artisan/route.ts',
]

describe('Multi-user cabinet resolution — Finding 1.2 fix', () => {
  for (const relPath of ROUTES_REQUIRING_CABINET_RESOLUTION) {
    describe(relPath, () => {
      const absPath = resolve(process.cwd(), relPath)
      const content = readFileSync(absPath, 'utf-8')

      it('importe resolveCabinetId depuis lib/auth-helpers', () => {
        // Tolère les deux ordres : `isSyndicRole, resolveCabinetId` ou inverse.
        expect(content).toMatch(/from\s+['"]@\/lib\/auth-helpers['"]/)
        expect(content).toContain('resolveCabinetId')
      })

      it("appelle await resolveCabinetId(user, ...) au moins une fois", () => {
        expect(content).toMatch(/await\s+resolveCabinetId\s*\(\s*user/)
      })

      it("n'utilise pas .eq('cabinet_id', user.id) — pattern interdit", () => {
        // Le bug initial : filtrer les tables cabinet-scopées par user.id.
        // Tolère uniquement les usages où user.id est intentionnel (per-user audit,
        // uploader, created_by) — ces patterns ne matchent PAS .eq('cabinet_id', user.id).
        expect(content).not.toMatch(/\.eq\(\s*['"]cabinet_id['"]\s*,\s*user\.id\s*\)/)
      })
    })
  }

  it('alfredo-chat ne filtre plus syndic_emails_analysed/syndic_oauth_tokens par user.id', () => {
    const content = readFileSync(resolve(process.cwd(), 'app/api/syndic/alfredo-chat/route.ts'), 'utf-8')
    // Pattern précis du bug : .eq('syndic_id', user.id) sur les tables OAuth/emails.
    expect(content).not.toMatch(/\.eq\(\s*['"]syndic_id['"]\s*,\s*user\.id\s*\)/)
  })

  // ── Self-verification de la regex (red-green safe sans toucher au code prod) ──
  // Le harness auto-deploy interdit de revert un fix sur disque pour faire un
  // red-green. À la place, on prouve que la regex catche bien le pattern bugué.
  describe('regex sanity — la garde anti-régression détecte vraiment le bug', () => {
    const cabinetIdBugRegex = /\.eq\(\s*['"]cabinet_id['"]\s*,\s*user\.id\s*\)/
    const syndicIdBugRegex = /\.eq\(\s*['"]syndic_id['"]\s*,\s*user\.id\s*\)/

    it('matche le pattern bugué cabinet_id', () => {
      expect(`.eq('cabinet_id', user.id)`).toMatch(cabinetIdBugRegex)
      expect(`.eq("cabinet_id", user.id)`).toMatch(cabinetIdBugRegex)
      expect(`.eq( 'cabinet_id' , user.id )`).toMatch(cabinetIdBugRegex)
    })

    it('matche le pattern bugué syndic_id', () => {
      expect(`.eq('syndic_id', user.id)`).toMatch(syndicIdBugRegex)
    })

    it("ne matche PAS le pattern corrigé .eq('cabinet_id', cabinetId)", () => {
      expect(`.eq('cabinet_id', cabinetId)`).not.toMatch(cabinetIdBugRegex)
      expect(`.eq('cabinet_id', cabinet_id)`).not.toMatch(cabinetIdBugRegex)
    })

    it("ne matche PAS les usages légitimes (uploaded_by/created_by: user.id)", () => {
      expect(`uploaded_by: user.id`).not.toMatch(cabinetIdBugRegex)
      expect(`created_by: user.id`).not.toMatch(cabinetIdBugRegex)
      expect(`user_id: user.id`).not.toMatch(cabinetIdBugRegex)
    })
  })
})
