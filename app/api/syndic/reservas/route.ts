import { createSyndicCrudRoute, str } from '@/lib/syndic/v54/crud-route'
import { syndicReservaSchema } from '@/lib/validation'

// /api/syndic/reservas — réservations d'espaces communs du cabinet (list + create)
const handlers = createSyndicCrudRoute({
  table: 'syndic_reservas',
  select: 'id, cabinet_id, espaco, quem, data, hora, estado, notes, created_at',
  orderBy: 'data',
  listKey: 'reservas',
  itemKey: 'reserva',
  rateKey: 'reservas',
  schema: syndicReservaSchema,
  mapRow: (r) => ({ id: str(r.id), espaco: str(r.espaco), quem: str(r.quem), data: str(r.data), hora: str(r.hora), estado: str(r.estado, 'pendente'), notes: str(r.notes) }),
  mapInsert: (v, cabinetId) => ({ cabinet_id: cabinetId, espaco: v.espaco, quem: v.quem || '', data: v.data || null, hora: v.hora || '', estado: v.estado || 'pendente', notes: v.notes || '' }),
})

export const GET = handlers.GET
export const POST = handlers.POST
