import { createSyndicCrudRoute, str, num } from '@/lib/syndic/v54/crud-route'
import { syndicNpsSchema } from '@/lib/validation'

// /api/syndic/nps — réponses NPS post-intervention du cabinet
const handlers = createSyndicCrudRoute({
  table: 'syndic_nps',
  select: 'id, cabinet_id, prestador, condomino, intervencao, tipo, nota, comentario, created_at',
  orderBy: 'created_at',
  listKey: 'nps',
  itemKey: 'resposta',
  rateKey: 'nps',
  schema: syndicNpsSchema,
  mapRow: (r) => ({ id: str(r.id), prestador: str(r.prestador), condomino: str(r.condomino), intervencao: str(r.intervencao), tipo: str(r.tipo), nota: num(r.nota), comentario: str(r.comentario) }),
  mapInsert: (v, cabinetId) => ({ cabinet_id: cabinetId, prestador: v.prestador || '', condomino: v.condomino || '', intervencao: v.intervencao || '', tipo: v.tipo || '', nota: v.nota, comentario: v.comentario || '' }),
})

export const GET = handlers.GET
export const POST = handlers.POST
