import { createSyndicCrudRoute, str, num } from '@/lib/syndic/v54/crud-route'
import { syndicObraSchema } from '@/lib/validation'

// /api/syndic/obras — obras + comparação de 3 orçamentos (Lei 8/2022) du cabinet
const handlers = createSyndicCrudRoute({
  table: 'syndic_obras',
  select: 'id, cabinet_id, titulo, tipo, descricao, local, prazo, estado, orcamento, empresa, num_orcamentos, created_at',
  orderBy: 'created_at',
  listKey: 'obras',
  itemKey: 'obra',
  rateKey: 'obras',
  schema: syndicObraSchema,
  mapRow: (r) => ({ id: str(r.id), titulo: str(r.titulo), tipo: str(r.tipo), descricao: str(r.descricao), local: str(r.local), prazo: str(r.prazo), estado: str(r.estado, 'orcamentacao'), orcamento: num(r.orcamento), empresa: str(r.empresa), numOrcamentos: num(r.num_orcamentos) }),
  mapInsert: (v, cabinetId) => ({ cabinet_id: cabinetId, titulo: v.titulo, tipo: v.tipo || '', descricao: v.descricao || '', local: v.local || '', prazo: v.prazo || null, estado: v.estado || 'orcamentacao', orcamento: v.orcamento ?? 0, empresa: v.empresa || '', num_orcamentos: v.numOrcamentos ?? 0 }),
})

export const GET = handlers.GET
export const POST = handlers.POST
