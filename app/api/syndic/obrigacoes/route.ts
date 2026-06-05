import { createSyndicCrudRoute, str, bool } from '@/lib/syndic/v54/crud-route'
import { syndicObrigacaoSchema } from '@/lib/validation'

// /api/syndic/obrigacoes — obligations légales / calendrier réglementaire du cabinet
const handlers = createSyndicCrudRoute({
  table: 'syndic_obrigacoes',
  select: 'id, cabinet_id, edificio, tipo, descricao, prazo, concluido, created_at',
  orderBy: 'prazo',
  ascending: true,
  listKey: 'obrigacoes',
  itemKey: 'obrigacao',
  rateKey: 'obrigacoes',
  schema: syndicObrigacaoSchema,
  mapRow: (r) => ({ id: str(r.id), edificio: str(r.edificio), tipo: str(r.tipo), descricao: str(r.descricao), prazo: str(r.prazo), concluido: bool(r.concluido) }),
  mapInsert: (v, cabinetId) => ({ cabinet_id: cabinetId, edificio: v.edificio || '', tipo: v.tipo, descricao: v.descricao || '', prazo: v.prazo || null, concluido: v.concluido ?? false }),
})

export const GET = handlers.GET
export const POST = handlers.POST
