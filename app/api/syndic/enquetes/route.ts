import { createSyndicCrudRoute, str, num, bool, type Row } from '@/lib/syndic/v54/crud-route'
import { syndicEnqueteSchema } from '@/lib/validation'

const normalizeOptions = (raw: unknown): { label: string; votes: number }[] =>
  Array.isArray(raw) ? raw.map((o) => ({ label: str((o as Row)?.label), votes: num((o as Row)?.votes) })) : []

// /api/syndic/enquetes — enquêtes & sondages du cabinet (list + create)
const handlers = createSyndicCrudRoute({
  table: 'syndic_enquetes',
  select: 'id, cabinet_id, titulo, descricao, estado, tipo, edificio, prazo, total, options, anonima, created_at',
  orderBy: 'created_at',
  listKey: 'enquetes',
  itemKey: 'enquete',
  rateKey: 'enquetes',
  schema: syndicEnqueteSchema,
  mapRow: (r) => ({ id: str(r.id), titulo: str(r.titulo), descricao: str(r.descricao), estado: str(r.estado, 'ativa'), tipo: str(r.tipo), edificio: str(r.edificio), prazo: str(r.prazo), total: num(r.total), options: normalizeOptions(r.options), anonima: bool(r.anonima) }),
  mapInsert: (v, cabinetId) => ({ cabinet_id: cabinetId, titulo: v.titulo, descricao: v.descricao || '', estado: v.estado || 'ativa', tipo: v.tipo || '', edificio: v.edificio || '', prazo: v.prazo || null, total: v.total ?? 0, options: v.options ?? [], anonima: v.anonima ?? false }),
})

export const GET = handlers.GET
export const POST = handlers.POST
