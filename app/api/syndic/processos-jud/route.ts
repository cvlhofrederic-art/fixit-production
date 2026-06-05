import { createSyndicCrudRoute, str, num } from '@/lib/syndic/v54/crud-route'
import { syndicProcessoJudSchema } from '@/lib/validation'

// /api/syndic/processos-jud — processus / notifications judiciaires du cabinet
const handlers = createSyndicCrudRoute({
  table: 'syndic_processos_jud',
  select: 'id, cabinet_id, tipo, contraparte, processo, data, prazo, estado, valor, descricao, created_at',
  orderBy: 'created_at',
  listKey: 'processos',
  itemKey: 'processo',
  rateKey: 'processos_jud',
  schema: syndicProcessoJudSchema,
  mapRow: (r) => ({ id: str(r.id), tipo: str(r.tipo), contraparte: str(r.contraparte), processo: str(r.processo), data: str(r.data), prazo: str(r.prazo), estado: str(r.estado, 'ativo'), valor: num(r.valor), descricao: str(r.descricao) }),
  mapInsert: (v, cabinetId) => ({ cabinet_id: cabinetId, tipo: v.tipo, contraparte: v.contraparte || '', processo: v.processo || '', data: v.data || null, prazo: v.prazo || null, estado: v.estado || 'ativo', valor: v.valor ?? 0, descricao: v.descricao || '' }),
})

export const GET = handlers.GET
export const POST = handlers.POST
