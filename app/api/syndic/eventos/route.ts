import { createSyndicCrudRoute, str } from '@/lib/syndic/v54/crud-route'
import { syndicEventoSchema } from '@/lib/validation'

// /api/syndic/eventos — événements de l'agenda hebdomadaire (Planeamento) du cabinet
const handlers = createSyndicCrudRoute({
  table: 'syndic_eventos',
  select: 'id, cabinet_id, titulo, dia, hora_inicio, hora_fim, tipo, responsavel, edificio, created_at',
  orderBy: 'created_at',
  ascending: true,
  listKey: 'eventos',
  itemKey: 'evento',
  rateKey: 'eventos',
  schema: syndicEventoSchema,
  mapRow: (r) => ({ id: str(r.id), titulo: str(r.titulo), dia: str(r.dia, 'mon'), horaInicio: str(r.hora_inicio, '09:00'), horaFim: str(r.hora_fim, '10:00'), tipo: str(r.tipo, 'gold'), responsavel: str(r.responsavel), edificio: str(r.edificio) }),
  mapInsert: (v, cabinetId) => ({ cabinet_id: cabinetId, titulo: v.titulo, dia: v.dia || 'mon', hora_inicio: v.horaInicio || '09:00', hora_fim: v.horaFim || '10:00', tipo: v.tipo || 'gold', responsavel: v.responsavel || '', edificio: v.edificio || '' }),
})

export const GET = handlers.GET
export const POST = handlers.POST
