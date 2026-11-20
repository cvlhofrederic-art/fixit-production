// Dictionnaires d'essai : petits, figés, indépendants des données réelles (qui évoluent). Ils servent aux tests
// de la recherche, des consignes de l'IA, de la route et de l'écran. Les données réelles ont leurs propres
// contrôles dans donnees.test.ts.

import type { Dictionnaire, Enseigne } from '@/lib/dictionnaire-materiaux/types'

const ENSEIGNES_ESSAI: Enseigne[] = [
  { id: 'leroy-merlin', nom: 'Leroy Merlin', lienRecherche: (terme) => `https://lm.example/search?q=${encodeURIComponent(terme)}` },
  { id: 'maxmat', nom: 'Maxmat', lienRecherche: (terme) => `https://maxmat.example/pesquisa?term=${encodeURIComponent(terme)}` },
]

export const DICO_ESSAI: Dictionnaire = {
  pays: 'PT',
  langue: 'pt',
  verifieLe: '2026-11-14',
  enseignes: ENSEIGNES_ESSAI,
  familles: [
    {
      id: 'silicones-mastiques',
      nom: 'Silicones, mástiques e espumas',
      description: 'Vedantes para juntas.',
      icone: '🧴',
      sousFamilles: [
        { id: 'silicone-sanitario', nom: 'Silicone sanitário', description: 'Com fungicida, para zonas húmidas.' },
        { id: 'silicone-neutro', nom: 'Silicone neutro', description: 'Caixilharia, vidro, espelhos e pedra.' },
        { id: 'mastique-acrilico', nom: 'Mástique acrílico', description: 'Pintável, para interior.' },
        { id: 'mastique-poliuretano', nom: 'Mástique de poliuretano', description: 'Juntas de fachada e betão.' },
      ],
    },
    {
      id: 'espatulas-talochas',
      nom: 'Espátulas, talochas e colheres',
      description: 'Ferramentas de aplicação.',
      icone: '🪛',
      sousFamilles: [
        { id: 'espatulas-dentadas', nom: 'Espátulas dentadas', description: 'Para espalhar cimento-cola.' },
        { id: 'espatulas-pintor', nom: 'Espátulas de pintor', description: 'Para betumar e raspar.' },
      ],
    },
    {
      id: 'impermeabilizacao',
      nom: 'Impermeabilização',
      description: 'Proteção contra a água.',
      icone: '💧',
      sousFamilles: [
        { id: 'hidrofugantes', nom: 'Hidrofugantes de fachada', description: 'Repelentes de água incolores.' },
        { id: 'argamassas-reparacao', nom: 'Argamassas de reparação', description: 'Reparar reboco e betão.' },
      ],
    },
  ],
  materiaux: [
    {
      id: 'silicone-sanitario-antifungos',
      famille: 'silicones-mastiques',
      sousFamille: 'silicone-sanitario',
      nom: 'Silicone sanitário anti-fungos',
      aussiAppele: ['silicone para casa de banho', 'silicone anti-bolor'],
      usage: 'Vedar juntas de banheiras, bases de duche e lavatórios.',
      aSavoir: 'Não é pintável.',
      conditionnement: 'Cartucho de 280 ml',
      recherche: 'silicone sanitário',
      enseignes: ['leroy-merlin', 'maxmat'],
    },
    {
      id: 'silicone-neutro-caixilharia',
      famille: 'silicones-mastiques',
      sousFamille: 'silicone-neutro',
      nom: 'Silicone neutro para caixilharia',
      aussiAppele: ['silicone de janelas'],
      usage: 'Vedar o contorno de janelas em alumínio e PVC.',
      recherche: 'silicone neutro',
      enseignes: ['leroy-merlin'],
    },
    {
      id: 'mastique-acrilico-pintavel',
      famille: 'silicones-mastiques',
      sousFamille: 'mastique-acrilico',
      nom: 'Mástique acrílico pintável',
      aussiAppele: ['acrílico de pintor'],
      usage: 'Fechar fissuras finas e remates de rodapés antes de pintar.',
      aSavoir: 'Só para interior e fora de zonas com água.',
      recherche: 'mástique acrílico',
      enseignes: ['leroy-merlin', 'maxmat'],
    },
    {
      id: 'mastique-poliuretano-fachada',
      famille: 'silicones-mastiques',
      sousFamille: 'mastique-poliuretano',
      nom: 'Mástique de poliuretano para fachadas',
      aussiAppele: ['PU de juntas'],
      usage: 'Selar fissuras e juntas de dilatação em fachadas.',
      recherche: 'mástique poliuretano',
      enseignes: ['maxmat'],
    },
    {
      id: 'espatula-dentada',
      famille: 'espatulas-talochas',
      sousFamille: 'espatulas-dentadas',
      nom: 'Espátula dentada',
      aussiAppele: ['pente de cola'],
      usage: 'Espalhar cimento-cola em pavimentos e paredes.',
      recherche: 'espátula dentada',
      enseignes: ['maxmat'],
    },
    {
      id: 'espatula-pintor',
      famille: 'espatulas-talochas',
      sousFamille: 'espatulas-pintor',
      nom: 'Espátula de pintor',
      aussiAppele: ['espátula de betumar'],
      usage: 'Betumar fissuras e raspar tinta solta.',
      recherche: 'espátula pintor',
      enseignes: ['leroy-merlin', 'maxmat'],
    },
    {
      id: 'hidrofugante-fachada',
      famille: 'impermeabilizacao',
      sousFamille: 'hidrofugantes',
      nom: 'Hidrofugante incolor para fachadas',
      aussiAppele: ['repelente de água'],
      usage: 'Impedir a absorção de água da chuva em reboco, tijolo e pedra.',
      recherche: 'hidrofugante fachada',
      enseignes: ['leroy-merlin'],
    },
    {
      id: 'argamassa-reparacao',
      famille: 'impermeabilizacao',
      sousFamille: 'argamassas-reparacao',
      nom: 'Argamassa de reparação',
      aussiAppele: [],
      usage: 'Refazer zonas de reboco degradado.',
      recherche: 'argamassa reparação',
      // Maxmat nomme ce produit autrement : son lien part avec un terme à lui.
      rechercheEnseigne: { maxmat: 'massa de reparação' },
      enseignes: ['leroy-merlin', 'maxmat'],
    },
  ],
  domaines: [
    { id: 'fachadas', nom: 'Fachadas e paredes exteriores', icone: '🧱' },
    { id: 'casas-de-banho-cozinhas', nom: 'Casas de banho e cozinhas', icone: '🚿' },
  ],
  situations: [
    {
      id: 'infiltracao-fachada',
      domaine: 'fachadas',
      titre: 'Infiltração em fachada',
      motsCles: ['água entra pela parede', 'humidade na parede exterior', 'fachada a meter água'],
      description: 'A água da chuva atravessa a fachada por fissuras ou por reboco poroso.',
      aVerifier: ['Largura das fissuras.', 'Estado dos remates das janelas.'],
      etapes: [
        {
          titre: 'Reparação',
          materiaux: [
            { id: 'argamassa-reparacao', note: 'Refazer o reboco solto.' },
            { id: 'mastique-poliuretano-fachada', note: 'Selar as fissuras abertas.' },
          ],
        },
        {
          titre: 'Proteção',
          materiaux: [{ id: 'hidrofugante-fachada', note: 'Em suporte seco.', optionnel: true }],
        },
        { titre: 'Ferramentas', materiaux: [{ id: 'espatula-pintor' }] },
      ],
      attention: ['Uma fissura larga ou que volta a abrir pode ser estrutural.'],
    },
    {
      id: 'fissuras-fachada',
      domaine: 'fachadas',
      titre: 'Fissuras finas no reboco da fachada',
      motsCles: ['microfissuras', 'reboco rachado'],
      description: 'Fissuras superficiais do reboco, sem entrada de água visível.',
      aVerifier: [],
      etapes: [{ titre: 'Reparação', materiaux: [{ id: 'mastique-poliuretano-fachada' }] }],
      attention: [],
    },
    {
      id: 'junta-silicone-com-bolor',
      domaine: 'casas-de-banho-cozinhas',
      titre: 'Junta de silicone com bolor no duche',
      motsCles: ['silicone preto', 'bolor na banheira', 'refazer silicone'],
      description: 'A junta da base de duche ou da banheira está negra de bolor ou a descolar.',
      aVerifier: ['Se a junta descola do suporte.'],
      etapes: [{ titre: 'Vedação', materiaux: [{ id: 'silicone-sanitario-antifungos', note: 'Em suporte limpo e seco.' }] }],
      attention: [],
    },
  ],
}

/** Variante française minimale : sert à prouver que les consignes et les libellés suivent la langue du dictionnaire. */
export const DICO_ESSAI_FR: Dictionnaire = {
  pays: 'FR',
  langue: 'fr',
  verifieLe: '2026-11-14',
  enseignes: [ENSEIGNES_ESSAI[0]],
  familles: [
    {
      id: 'mastics',
      nom: 'Mastics et silicones',
      description: 'Joints souples.',
      icone: '🧴',
      sousFamilles: [{ id: 'silicone-sanitaire', nom: 'Silicone sanitaire', description: 'Pièces humides.' }],
    },
  ],
  materiaux: [
    {
      id: 'silicone-sanitaire',
      famille: 'mastics',
      sousFamille: 'silicone-sanitaire',
      nom: 'Silicone sanitaire anti-moisissures',
      aussiAppele: ['joint de baignoire'],
      usage: 'Joints de baignoire, de douche et de lavabo.',
      recherche: 'silicone sanitaire',
      enseignes: ['leroy-merlin'],
    },
  ],
  domaines: [{ id: 'salles-de-bain', nom: 'Salles de bain', icone: '🚿' }],
  situations: [
    {
      id: 'joint-silicone-moisi',
      domaine: 'salles-de-bain',
      titre: 'Joint de douche moisi',
      motsCles: ['joint noirci'],
      description: 'Le joint de la douche est noirci ou se décolle.',
      aVerifier: [],
      etapes: [{ titre: 'Étanchéité', materiaux: [{ id: 'silicone-sanitaire' }] }],
      attention: [],
    },
  ],
}
