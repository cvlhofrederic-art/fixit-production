import { createSyndicCrudRoute, str, num } from '@/lib/syndic/v54/crud-route'
import { syndicInfracaoSchema } from '@/lib/validation'

// /api/syndic/infracoes — infractions au règlement du cabinet (list + create)
const handlers = createSyndicCrudRoute({
  table: 'syndic_infracoes',
  select: 'id, cabinet_id, tipo, condomino, edificio, etapa, multa, descricao, created_at',
  orderBy: 'created_at',
  listKey: 'infracoes',
  itemKey: 'infracao',
  rateKey: 'infracoes',
  schema: syndicInfracaoSchema,
  mapRow: (r) => ({ id: str(r.id), tipo: str(r.tipo), condomino: str(r.condomino), edificio: str(r.edificio), etapa: str(r.etapa, 'sinalizada'), multa: num(r.multa), descricao: str(r.descricao) }),
  mapInsert: (v, cabinetId) => ({ cabinet_id: cabinetId, tipo: v.tipo, condomino: v.condomino || '', edificio: v.edificio || '', etapa: v.etapa || 'sinalizada', multa: v.multa ?? 0, descricao: v.descricao || '' }),
})

export const GET = handlers.GET
export const POST = handlers.POST
