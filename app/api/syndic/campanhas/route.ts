import { createSyndicCrudRoute, str, num } from '@/lib/syndic/v54/crud-route'
import { syndicCampanhaSchema } from '@/lib/validation'

// /api/syndic/campanhas — campagnes de contact proactif du cabinet (suivi, sans envoi)
const handlers = createSyndicCrudRoute({
  table: 'syndic_campanhas',
  select: 'id, cabinet_id, nome, tipo, edificio, destinatarios, estado, mensagem, created_at',
  orderBy: 'created_at',
  listKey: 'campanhas',
  itemKey: 'campanha',
  rateKey: 'campanhas',
  schema: syndicCampanhaSchema,
  mapRow: (r) => ({ id: str(r.id), nome: str(r.nome), tipo: str(r.tipo), edificio: str(r.edificio), destinatarios: num(r.destinatarios), estado: str(r.estado, 'rascunho'), mensagem: str(r.mensagem) }),
  mapInsert: (v, cabinetId) => ({ cabinet_id: cabinetId, nome: v.nome, tipo: v.tipo || '', edificio: v.edificio || '', destinatarios: v.destinatarios ?? 0, estado: v.estado || 'rascunho', mensagem: v.mensagem || '' }),
})

export const GET = handlers.GET
export const POST = handlers.POST
