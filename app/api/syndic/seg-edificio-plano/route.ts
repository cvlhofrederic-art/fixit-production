// app/api/syndic/seg-edificio-plano/route.ts
// Phase C — Alfredo : génère un plano de emergência RT-SCIE (DL 220/2008) pour un edifício.
// Version française (corps `locale: 'fr'`) : consignes de sécurité incendie d'un immeuble
// d'habitation selon l'arrêté du 31 janvier 1986. Sans `locale`, comportement PT inchangé.
import { NextResponse, type NextRequest } from 'next/server'
import { gateSyndic, callAlfredo } from '@/lib/syndic/v54/alfredo'
import { logger } from '@/lib/logger'

export const maxDuration = 30

const SYSTEM = `És o Alfredo, especialista em Segurança Contra Incêndio em Edifícios (SCIE) em Portugal (DL 220/2008 — RSCIE, Portaria 1532/2008 — RT-SCIE).
Geras um plano de emergência adaptado a um edifício de habitação (utilização-tipo I), pronto a 70% para o Encarregado de Segurança rever.
Estrutura obrigatória (markdown, secções numeradas):
1. Identificação do edifício e enquadramento legal
2. Categoria de risco e implicações
3. Organização de segurança (Encarregado, delegados de piso)
4. Procedimentos em caso de emergência (deteção, alarme, evacuação)
5. Plano de evacuação e pontos de encontro
6. Meios de 1.ª intervenção e sua localização
7. Exercícios de evacuação e formação (periodicidade)
8. Registos de segurança a manter
Português europeu, tom profissional. Conciso mas completo.`

const SYSTEM_FR = `Tu es Alfredo, expert en sécurité incendie des bâtiments d'habitation en France (arrêté du 31 janvier 1986 relatif à la protection contre l'incendie des bâtiments d'habitation ; au-delà de 50 m, réglementation des immeubles de grande hauteur).
Tu rédiges les consignes de sécurité incendie d'un immeuble d'habitation en copropriété, prêtes à 70 % pour relecture par le syndic.
Familles d'habitation : 1re famille (maisons individuelles), 2e famille (maisons de plus d'un étage, collectifs de 3 étages au plus sur rez-de-chaussée), 3e famille (plancher bas du logement le plus haut à 28 m au plus, 3A ou 3B), 4e famille (plancher bas du logement le plus haut entre 28 et 50 m).
Structure obligatoire (markdown, sections numérotées) :
1. Identification de l'immeuble et cadre réglementaire
2. Famille d'habitation et conséquences pratiques
3. Organisation (syndic, conseil syndical, gardien, référent sécurité éventuel)
4. Conduite à tenir en cas d'incendie (appel des secours au 18 ou au 112, évacuer si le feu est chez soi, rester chez soi porte fermée si les circulations sont enfumées, ne jamais utiliser l'ascenseur)
5. Consignes et plans à afficher dans les halls d'entrée, près des escaliers et des ascenseurs (article 100 de l'arrêté)
6. Équipements de sécurité des parties communes et leur entretien (désenfumage, colonnes sèches, éclairage de sécurité, portes coupe-feu, extincteurs le cas échéant)
7. Détecteurs de fumée dans chaque logement (loi n° 2010-238 du 9 mars 2010) et information des occupants
8. Vérifications au moins annuelles (détection, désenfumage, ventilation, colonnes sèches, portes coupe-feu), contrats d'entretien et registre de sécurité (article 101 de l'arrêté)
Rédige en français, sur un ton professionnel, en vouvoyant le lecteur. Concis mais complet. Ne cite aucun numéro d'article dont tu n'es pas certain.`

export async function POST(req: NextRequest) {
  const gate = await gateSyndic(req, 'seg-plano')
  if (!gate.ok) return gate.res

  const body = await req.json().catch(() => ({}))
  const fr = body.locale === 'fr'
  const edificio: string = typeof body.edificio === 'string' ? body.edificio.trim() : ''
  const categoria: string = typeof body.categoria === 'string' ? body.categoria : '1'
  const encarregado: string = typeof body.encarregado === 'string' ? body.encarregado : ''
  if (!edificio) return NextResponse.json({ error: fr ? "Indiquez l'immeuble" : 'Indique o edifício' }, { status: 400 })

  try {
    const plano = await callAlfredo(gate.user.id, fr
      ? {
          system: SYSTEM_FR,
          user: `Immeuble : ${edificio}\nFamille d'habitation (1 à 4) : ${categoria}\nRéférent sécurité : ${encarregado || '(à désigner)'}\n\nRédige les consignes de sécurité incendie complètes.`,
          prompt: `consignes sécurité incendie ${edificio}`,
          maxTokens: 1800,
        }
      : {
          system: SYSTEM,
          user: `Edifício: ${edificio}\nCategoria de risco SCIE: ${categoria}\nEncarregado de Segurança: ${encarregado || '(a designar)'}\n\nGera o plano de emergência completo.`,
          prompt: `plano emergência ${edificio}`,
          maxTokens: 1800,
        })
    return NextResponse.json({ plano })
  } catch (err) {
    logger.error('[syndic/seg-edificio-plano] error:', err)
    return NextResponse.json({ error: fr ? 'Erreur lors de la génération des consignes de sécurité' : 'Erro ao gerar o plano de emergência' }, { status: 500 })
  }
}
