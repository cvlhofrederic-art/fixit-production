import { createSyndicCrudRoute, str, bool, type Row } from '@/lib/syndic/v54/crud-route'
import { syndicChecklistSchema } from '@/lib/validation'

const normalizeItems = (raw: unknown): { label: string; done: boolean }[] =>
  Array.isArray(raw) ? raw.map((i) => ({ label: str((i as Row)?.label), done: bool((i as Row)?.done) })) : []

// /api/syndic/checklists — checklists opérationnelles du cabinet (list + create)
const handlers = createSyndicCrudRoute({
  table: 'syndic_checklists',
  select: 'id, cabinet_id, titulo, tipo, edificio, estado, items, created_at',
  orderBy: 'created_at',
  listKey: 'checklists',
  itemKey: 'checklist',
  rateKey: 'checklists',
  schema: syndicChecklistSchema,
  mapRow: (r) => ({ id: str(r.id), titulo: str(r.titulo), tipo: str(r.tipo), edificio: str(r.edificio), estado: str(r.estado, 'em_curso'), items: normalizeItems(r.items) }),
  mapInsert: (v, cabinetId) => ({ cabinet_id: cabinetId, titulo: v.titulo, tipo: v.tipo || '', edificio: v.edificio || '', estado: v.estado || 'em_curso', items: v.items ?? [] }),
})

export const GET = handlers.GET
export const POST = handlers.POST
