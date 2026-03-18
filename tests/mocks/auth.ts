import { vi } from 'vitest'

export const mockArtisanUser = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'artisan@test.com',
  user_metadata: { role: 'artisan', full_name: 'Jean Artisan' },
}

export const mockClientUser = {
  id: '550e8400-e29b-41d4-a716-446655440002',
  email: 'client@test.com',
  user_metadata: { role: 'client', full_name: 'Marie Client' },
}

export const mockSyndicUser = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  email: 'syndic@test.com',
  user_metadata: { role: 'syndic', full_name: 'Pierre Syndic' },
}

export const mockNoUser = null

export function mockGetAuthUser(user: typeof mockArtisanUser | null) {
  vi.mock('@/lib/auth-helpers', async (importOriginal) => {
    const actual = await importOriginal() as Record<string, unknown>
    return {
      ...actual,
      getAuthUser: vi.fn().mockResolvedValue(user),
      resolveCabinetId: vi.fn().mockResolvedValue(user?.id || null),
    }
  })
}
