import { createSyndicCrudRoute, str, num, type Row } from '@/lib/syndic/v54/crud-route'
import { syndicVotacaoSchema } from '@/lib/validation'

const normalizeOptions = (raw: unknown): { label: string; perm: number }[] =>
  Array.isArray(raw) ? raw.map((o) => ({ label: str((o as Row)?.label), perm: num((o as Row)?.perm) })) : []

// /api/syndic/votacoes — votações online AG (deliberações + permilagem) du cabinet
const handlers = createSyndicCrudRoute({
  table: 'syndic_votacoes',
  select: 'id, cabinet_id, titulo, descricao, edificio, estado, maioria, artigo, prazo, perm_total, options, created_at',
  orderBy: 'created_at',
  listKey: 'votacoes',
  itemKey: 'votacao',
  rateKey: 'votacoes',
  schema: syndicVotacaoSchema,
  mapRow: (r) => ({ id: str(r.id), titulo: str(r.titulo), descricao: str(r.descricao), edificio: str(r.edificio), estado: str(r.estado, 'aberta'), maioria: str(r.maioria, 'simples'), artigo: str(r.artigo), prazo: str(r.prazo), permTotal: num(r.perm_total, 1000), options: normalizeOptions(r.options) }),
  mapInsert: (v, cabinetId) => ({ cabinet_id: cabinetId, titulo: v.titulo, descricao: v.descricao || '', edificio: v.edificio || '', estado: v.estado || 'aberta', maioria: v.maioria || 'simples', artigo: v.artigo || '', prazo: v.prazo || null, perm_total: v.permTotal ?? 1000, options: v.options ?? [] }),
})

export const GET = handlers.GET
export const POST = handlers.POST
