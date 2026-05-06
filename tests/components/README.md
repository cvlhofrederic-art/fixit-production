# Component tests — pattern guide

Vitest 4 + @testing-library/react 16 + jsdom. The vitest config already
includes `tests/components/**` and applies `setupFiles: ./tests/setup.ts`
which loads `@testing-library/jest-dom/vitest` (so matchers like
`toBeInTheDocument()` are available).

## Mock first, import second

Vitest hoists `vi.mock(...)` calls to the top of the file regardless of
where you write them, but `await import()` does not — always declare your
module mocks before dynamically importing the component under test:

```ts
vi.mock('@/lib/i18n/context', () => ({
  useLocale: () => 'fr',
  useTranslation: () => ({ t: (k: string) => k }),
}))

import('@/components/MyComponent') // safe
```

Use `await import()` from inside `describe`/`it` blocks when you want
each test to re-run the module factory.

## What we mock by default

- `@/lib/i18n/context` — return a stable `t`/`useLocale` so we don't
  pull in the full provider tree.
- `next/navigation` — `useRouter`/`usePathname` return inert stubs.
- `next/link` — render `<a>` to keep snapshots simple (covered by
  `tests/components/setup.tsx`).
- `sonner` — replace `toast` with `vi.fn()` family so we can assert
  side-effects without DOM noise.

`tests/components/setup.tsx` exposes `mockI18n()`, `mockNextNavigation()`,
`mockSonner()` — call them at the top of any test file that needs them.

## What we don't mock

- React itself, the standard DOM, jest-dom matchers — those are real.
- The component under test — never re-export a partial double of the
  module you're testing. Mock its dependencies, not the SUT.

## Network calls

Patch `globalThis.fetch` with `vi.fn().mockResolvedValueOnce(...)` per
scenario. See `V5Header.test.tsx` for an example covering a happy path
and an error path on the same fetch.

## Coverage

`vitest.config.ts` includes `components/**` in coverage but adds no
threshold. Coverage is a feedback tool, not a CI gate, until we hit a
critical mass. Don't add a threshold without a separate decision.

## Scope of these bootstrap tests

The five files in this folder were not picked for coverage value — they
were picked to exercise distinct patterns (pure component, hooks,
context, link wrapper, fetch + side-effects). Reuse them as templates
when adding tests for new components.
