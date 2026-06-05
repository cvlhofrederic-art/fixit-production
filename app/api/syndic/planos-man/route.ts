import { createSyndicCrudRoute, str, num } from '@/lib/syndic/v54/crud-route'
import { syndicPlanoManSchema } from '@/lib/validation'

// /api/syndic/planos-man — plans de manutenção (conservation DL 555/99) du cabinet
const handlers = createSyndicCrudRoute({
  table: 'syndic_planos_man',
  select: 'id, cabinet_id, titulo, edificio, estado, orcamento, ano_inicio, periodicidade, descricao, created_at',
  orderBy: 'created_at',
  listKey: 'planos',
  itemKey: 'plano',
  rateKey: 'planos_man',
  schema: syndicPlanoManSchema,
  mapRow: (r) => ({ id: str(r.id), titulo: str(r.titulo), edificio: str(r.edificio), estado: str(r.estado, 'preparacao'), orcamento: num(r.orcamento), anoInicio: typeof r.ano_inicio === 'number' ? r.ano_inicio : null, periodicidade: str(r.periodicidade), descricao: str(r.descricao) }),
  mapInsert: (v, cabinetId) => ({ cabinet_id: cabinetId, titulo: v.titulo, edificio: v.edificio || '', estado: v.estado || 'preparacao', orcamento: v.orcamento ?? 0, ano_inicio: v.anoInicio ?? null, periodicidade: v.periodicidade || '', descricao: v.descricao || '' }),
})

export const GET = handlers.GET
export const POST = handlers.POST
