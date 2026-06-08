// app/api/syndic/orcamentos/route.ts
// Phase A — Orçamentos individuels par obra (comparaison « 3 orçamentos », Lei 8/2022).
// GET (liste cabinet, triée par valeur croissante) + POST (création), via la factory CRUD.
import type { z } from 'zod'
import { createSyndicCrudRoute, str, num, bool, type Row } from '@/lib/syndic/v54/crud-route'
import { syndicOrcamentoSchema } from '@/lib/validation'

type OrcamentoIn = z.infer<typeof syndicOrcamentoSchema>

export const { GET, POST } = createSyndicCrudRoute<OrcamentoIn>({
  table: 'syndic_orcamentos',
  select: 'id, cabinet_id, obra_id, empresa, valor, prazo_dias, validade, notas, recomendado, created_at',
  orderBy: 'valor',
  ascending: true,
  listKey: 'orcamentos',
  itemKey: 'orcamento',
  rateKey: 'orcamentos',
  schema: syndicOrcamentoSchema,
  mapRow: (r: Row) => ({
    id: str(r.id),
    obraId: str(r.obra_id),
    empresa: str(r.empresa),
    valor: num(r.valor),
    prazoDias: r.prazo_dias == null ? null : num(r.prazo_dias),
    validade: str(r.validade),
    notas: str(r.notas),
    recomendado: bool(r.recomendado),
  }),
  mapInsert: (v, cabinetId) => ({
    cabinet_id: cabinetId,
    obra_id: v.obraId,
    empresa: v.empresa ?? '',
    valor: v.valor ?? 0,
    prazo_dias: v.prazoDias ?? null,
    validade: v.validade ?? null,
    notas: v.notas ?? null,
    recomendado: v.recomendado ?? false,
  }),
})
