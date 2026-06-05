import { createSyndicCrudRoute, str } from '@/lib/syndic/v54/crud-route'
import { syndicDeliberacaoSchema } from '@/lib/validation'

// /api/syndic/deliberacoes — tracker des délibérations d'AG (exécution 15j) du cabinet
const handlers = createSyndicCrudRoute({
  table: 'syndic_deliberacoes',
  select: 'id, cabinet_id, deliberacao, ag, responsavel, prazo, estado, origem, created_at',
  orderBy: 'created_at',
  listKey: 'deliberacoes',
  itemKey: 'deliberacao',
  rateKey: 'deliberacoes',
  schema: syndicDeliberacaoSchema,
  mapRow: (r) => ({ id: str(r.id), deliberacao: str(r.deliberacao), ag: str(r.ag), responsavel: str(r.responsavel), prazo: str(r.prazo), estado: str(r.estado, 'pendente'), origem: str(r.origem, 'manual') }),
  mapInsert: (v, cabinetId) => ({ cabinet_id: cabinetId, deliberacao: v.deliberacao, ag: v.ag || '', responsavel: v.responsavel || '', prazo: v.prazo || null, estado: v.estado || 'pendente', origem: v.origem || 'manual' }),
})

export const GET = handlers.GET
export const POST = handlers.POST
