// Textes « Como a VITFIX trabalha : {métier} » (phase 3 du plan SEO PT, gabarit 3.2, bloc
// « méthode »). Un texte par métier, identique dans les 22 villes (admis par le plan : c'est le
// bloc métier, pas le bloc local). Rédigés le 14/10/2026 à la demande du propriétaire (mandat du
// 13/10 : « à toi de créer tout ça »), à relire par lui ; règle 0.2 : aucun chiffre, délai, prix,
// nombre de professionnels ni promesse propre à VITFIX ; seulement la méthode de travail du métier
// et des faits vérifiables (normes et obligations légales portugaises citées avec prudence).
// Rendus par lib/seo/pt-provas-locais.ts (metodoPara) sous l'ancre #metodo ; un texte fourni dans
// data/seo/local-proof.json (clé `metodos`) a priorité sur celui-ci.

export const METODOS_METIER: Record<string, string> = {
  eletricista: `Uma intervenção elétrica começa sempre por um diagnóstico no local: o eletricista identifica o circuito afetado, mede a instalação (tensão, continuidade, isolamento, diferencial) e procura a causa, não só o sintoma. Um disjuntor que dispara pode vir de um aparelho, de uma tomada húmida ou de um cabo degradado, e a reparação é diferente em cada caso.

O orçamento é escrito antes de qualquer trabalho e descreve o que vai ser feito, os materiais (secção dos cabos, tipo de disjuntores, marca do quadro) e o que fica fora do âmbito. Em Portugal, as instalações elétricas de baixa tensão seguem as Regras Técnicas das Instalações Elétricas de Baixa Tensão (RTIEBT); uma instalação nova ou uma alteração relevante tem de ser executada por um técnico responsável ou por uma entidade instaladora inscritos na DGEG, que emitem o termo de responsabilidade; em certos casos, é ainda obrigatória a inspeção por uma entidade inspetora reconhecida pela DGEG. O eletricista deve dizer-lhe em que caso se encontra a sua obra.

No fim, o profissional testa cada circuito, etiqueta o quadro se foi alterado e explica o que mudou. Peça sempre a fatura com a descrição dos trabalhos: é a prova da data e do âmbito da intervenção, necessária para acionar a garantia e para eventuais pedidos ao seguro.`,

  canalizador: `O canalizador começa por localizar a origem do problema: uma fuga visível raramente nasce onde aparece. Conforme o caso, usa deteção acústica, teste de pressão na rede ou inspeção da ligação dos aparelhos (esquentador, máquina de lavar, autoclismo). Só depois propõe a reparação adequada: substituição de um vedante, de um troço de tubo, de uma válvula ou de um sifão.

O orçamento é escrito e indica o trabalho, as peças e o que fica excluído (alvenaria, pintura). Para trabalhos em aparelhos a gás, o técnico tem de ser técnico de gás habilitado, com título profissional emitido pela DGEG; o canalizador deve informá-lo quando um esquentador ou uma caldeira entra nesse regime.

Terminada a reparação, o profissional verifica a estanquidade, abre e fecha as torneiras para confirmar a pressão e o escoamento, e limpa a zona de trabalho. Guarde a fatura e a referência das peças substituídas: facilita qualquer intervenção futura.`,

  pintor: `Uma boa pintura depende sobretudo da preparação: lavagem ou lixagem das paredes, tratamento das fissuras e das manchas de humidade (que têm de ser resolvidas na origem, senão voltam), aplicação de primário quando o suporte o exige. O pintor avalia o estado das superfícies antes de dar um preço, porque é a preparação que determina o trabalho real.

O orçamento é escrito e indica a área, o número de demãos, o tipo de tinta (lavável, anti-humidade, exterior) e se a proteção de mobiliário e pavimentos está incluída. Em exteriores, as condições meteorológicas contam: o pintor planeia as demãos para evitar chuva e sol direto sobre tinta fresca.

No fim, as superfícies são verificadas à luz natural, os retoques feitos e o espaço devolvido limpo. Peça a referência exata da tinta usada: será útil para retoques futuros.`,

  pladur: `O pladur (placas de gesso cartonado) serve para dividir espaços, baixar ou nivelar tetos, esconder tubagens e cablagens ou melhorar o isolamento acústico de uma parede. O profissional começa por medir o espaço, verificar o estado dos tetos e paredes existentes e definir a estrutura metálica (perfis, montantes, suspensões) que vai suportar as placas.

O orçamento escrito indica o tipo de placa (standard, hidrófuga para zonas húmidas, acústica ou com isolamento incorporado), a estrutura, o isolamento colocado no interior quando aplicável e o acabamento previsto (barramento das juntas, pronto a pintar ou pintado).

A execução segue uma ordem fixa: estrutura, passagem de redes elétricas e de iluminação, isolamento, placas, juntas e barramento. Antes de fechar um teto falso, confirme com o profissional a posição dos pontos de luz e dos acessos técnicos; depois de fechado, mudar custa muito mais.`,

  'obras-remodelacao': `Uma remodelação começa por uma visita ao local e por um levantamento do existente: o que se mantém, o que se demole, onde passam as redes de água, esgoto e eletricidade. A partir daí o profissional propõe um orçamento escrito, por fases e por especialidade, com os materiais previstos e o que fica a cargo do cliente.

Em Portugal, as obras que alteram a estrutura, a fachada, a cércea ou a cobertura de um edifício, ou que incidem sobre imóveis classificados ou em zona de proteção, exigem comunicação prévia ou licença da câmara municipal; as alterações no interior que não tocam nesses elementos estão, em regra, isentas de controlo prévio. Num prédio em propriedade horizontal, as obras que afetem partes comuns carecem ainda de autorização do condomínio. O licenciamento é responsabilidade do dono da obra, mas o empreiteiro deve dizer-lhe em que regime se encontra a sua obra antes de começar. Em obras de remodelação e reabilitação de habitação, pode aplicar-se a taxa reduzida de IVA em determinadas condições (nomeadamente quanto ao peso dos materiais no valor total): pergunte ao empreiteiro se a sua obra se enquadra e peça faturas que descrevam os trabalhos.

Durante a obra, o planeamento das especialidades (demolição, redes, alvenaria, pladur, carpintaria, pintura) evita retrabalho. No fim, uma vistoria conjunta com lista de pendentes permite fechar o trabalho sem pontos em aberto.`,

  'isolamento-termico': `O isolamento térmico pelo exterior (capoto, também chamado ETICS) envolve o edifício com placas isolantes fixadas à fachada, uma camada de base armada com rede e um revestimento final. Trata as pontes térmicas nas lajes e nos pilares, que o isolamento pelo interior corrige mal, e protege a fachada da chuva.

O profissional começa por avaliar o suporte (fissuras, humidade, revestimento existente) e por medir as fachadas. O orçamento escrito indica o isolante (EPS, lã de rocha, cortiça), a espessura, o sistema utilizado e o acabamento. Um sistema ETICS completo, com os componentes do mesmo fabricante, é o que garante o comportamento previsto; evite misturar produtos.

A execução passa pela preparação do suporte, colagem e fixação mecânica das placas, barramento armado, primário e acabamento. Em reabilitação de edifícios, a taxa reduzida de IVA pode aplicar-se em determinadas condições, nomeadamente quanto ao peso dos materiais no valor total ou à localização em área de reabilitação urbana: confirme-o com o empreiteiro antes de assinar. Num prédio em propriedade horizontal, a intervenção na fachada é decidida em assembleia de condóminos.`,

  impermeabilizacao: `Antes de impermeabilizar, é preciso saber por onde entra a água: fissura numa laje, junta de dilatação, rufo mal executado, tela envelhecida ou ponto de passagem de uma tubagem. O profissional faz um diagnóstico no local, se necessário com teste de água ou câmara termográfica, e só depois propõe a solução.

O orçamento escrito indica a técnica (membrana líquida, tela asfáltica, poliureia, argamassa de impermeabilização), a preparação do suporte e os remates nos pontos singulares (ralos, soleiras, muretes), onde as infiltrações voltam a aparecer com mais frequência.

A aplicação respeita os tempos de secagem e as condições de temperatura indicados pelo fabricante; uma impermeabilização feita à pressa sobre um suporte húmido não dura. No fim, o profissional verifica os escoamentos e explica a manutenção necessária (limpeza de ralos e caleiras).`,

  desentupimento: `O desentupimento profissional começa por identificar onde está o bloqueio: num sifão, na tubagem de um aparelho, na coluna do prédio ou no ramal até à rede pública. Essa localização determina o método: mola mecânica para obstruções próximas, hidrojato de alta pressão para gorduras e depósitos ao longo da tubagem, inspeção por câmara quando o problema se repete.

O orçamento é apresentado antes da intervenção e distingue o desentupimento simples da reparação de uma tubagem danificada (raízes, rotura, abatimento), que é um trabalho diferente. Os produtos químicos agressivos são evitados: podem danificar tubagens antigas e vedantes e raramente resolvem a causa do entupimento.

No fim, o profissional confirma o escoamento com água corrente e, se detetou uma anomalia na tubagem, explica-a e propõe a reparação em separado.`,

  'faz-tudo': `O faz-tudo trata das pequenas reparações e montagens que não justificam um especialista: fixar uma prateleira ou um móvel, substituir uma fechadura, um puxador ou uma torneira simples, montar mobiliário, afinar portas e janelas, pequenos retoques de pintura ou de silicone.

Como os trabalhos são variados, o orçamento é feito à tarefa ou por intervenção, com a lista do que vai ser feito e os materiais necessários indicados antes de começar. Quando um problema ultrapassa a pequena reparação (instalação elétrica, rede de água, estrutura), o faz-tudo deve dizê-lo e encaminhar para o profissional adequado em vez de improvisar.

Agrupar várias pequenas tarefas na mesma visita torna o serviço mais rentável: prepare a lista com antecedência e indique-a no pedido.`,

  serralheiro: `O serralheiro intervém em fechaduras, portas blindadas, grades, portões e estruturas metálicas. Numa abertura de porta, o profissional começa pelos métodos não destrutivos (gazua, abertura do canhão sem o danificar) e só parte para a destruição da fechadura quando não há alternativa; pode pedir-lhe um comprovativo de que vive na casa, o que é uma prática normal.

O orçamento escrito indica se a fechadura ou o canhão são reparados ou substituídos, o nível de segurança do modelo proposto e o número de chaves entregues. Em trabalhos de serralharia (grades, portões, escadas), descreve o material, o tratamento anticorrosão e a fixação.

No fim, o profissional testa o funcionamento com todas as chaves e deixa a porta a fechar corretamente. Guarde o cartão de propriedade do canhão (entregue com as chaves de segurança) e a fatura com a referência do modelo: o cartão é normalmente exigido para fazer cópias de chaves de segurança.`,

  telhador: `Uma intervenção na cobertura começa por uma inspeção: estado das telhas, dos rufos, das caleiras e dos tubos de queda, pontos de infiltração, estado da estrutura de madeira ou das placas de suporte. Muitas infiltrações vêm de rufos e remates, não das telhas, e a inspeção evita trabalhos inúteis.

O orçamento escrito distingue a reparação pontual (substituição de telhas, selagem de rufos, limpeza de caleiras) da substituição de uma zona ou de toda a cobertura, com o tipo de telha, o isolamento e a subtelha previstos. O trabalho em altura exige proteção coletiva ou individual contra quedas; um profissional sério inclui-a no planeamento.

No fim, o profissional confirma os escoamentos e explica a manutenção: limpeza de caleiras e verificação dos remates no fim do verão, antes das primeiras chuvas.`,

  vidraceiro: `O vidraceiro substitui vidros partidos, instala vidro duplo, espelhos, resguardos de duche e envidraçados de varandas. Numa situação de vidro partido, a primeira medida é proteger a abertura (painel provisório) e retirar os estilhaços em segurança; a substituição definitiva é feita depois de medir o vão com rigor.

O orçamento escrito indica o tipo de vidro (simples, duplo, laminado de segurança, temperado), a espessura, a caixilharia em que vai ser montado e os vedantes. Em janelas, o vidro duplo com caixa de ar ou gás melhora o isolamento térmico e acústico, desde que a caixilharia o suporte.

A montagem termina com a verificação dos vedantes e da abertura das folhas. Guarde a referência do vidro instalado: facilita uma substituição futura.`,

  azulejador: `O azulejador aplica azulejos, ladrilhos e mosaicos em pavimentos e paredes, repara peças partidas ou descoladas e refaz juntas. O trabalho começa por verificar o suporte: nivelamento, aderência, humidade em zonas molhadas. Em casas de banho e cozinhas, a impermeabilização por baixo do revestimento é tão importante como o revestimento.

O orçamento escrito indica a área, o tipo de material (cerâmica, porcelânico, pedra), a cola e as juntas adequadas ao local, o padrão de assentamento e os remates (perfis, cantos, soleiras). A reparação de peças isoladas é possível quando ainda existe material igual; caso contrário, o profissional propõe uma solução de substituição.

No fim, as juntas são limpas e seladas quando necessário, e o profissional indica o tempo de secagem antes de usar o espaço.`,

  pedreiro: `O pedreiro executa alvenarias, muros, rebocos, betonilhas, pequenas estruturas e demolições interiores. Antes de qualquer trabalho, avalia o existente: fissuras, humidade ascendente, estado das fundações de um muro, cargas que uma parede possa suportar.

O orçamento escrito descreve os materiais (tijolo, bloco, betão, argamassas), as espessuras, o tratamento das juntas e dos remates, e o destino do entulho. Qualquer intervenção que toque numa parede estrutural ou numa fachada deve ser validada por um técnico habilitado e está, em regra, sujeita a controlo prévio da câmara municipal (comunicação prévia ou licença); o pedreiro deve avisá-lo.

Os resíduos de construção e demolição devem ser encaminhados para um operador licenciado ou para o ecocentro do município, com o comprovativo que a lei exige; peça-o ao profissional. No fim, o profissional limpa a zona de trabalho e indica os tempos de cura antes de pintar ou revestir.`,

  'ar-condicionado': `A instalação ou a reparação de ar condicionado começa por um dimensionamento: área e exposição solar da divisão, isolamento, uso previsto. Um equipamento mal dimensionado consome mais e dura menos. O profissional propõe a potência e o tipo de equipamento (mono ou multi-split) a partir dessa avaliação.

O orçamento escrito indica o equipamento, o percurso das tubagens, a fixação da unidade exterior, o escoamento de condensados e a ligação elétrica. A manipulação de gases refrigerantes fluorados exige um técnico e uma empresa certificados nos termos da regulamentação europeia sobre gases fluorados, cuja aplicação em Portugal é acompanhada pela Agência Portuguesa do Ambiente; peça o certificado antes da intervenção.

Na manutenção, o profissional limpa filtros e permutadores, verifica pressões, escoamentos e consumos, e deteta fugas de gás. Uma manutenção anual, de preferência antes do verão, ajuda a prevenir avarias e a manter o consumo controlado.`,

  carpinteiro: `O carpinteiro repara e fabrica portas, janelas, móveis à medida, armários, soalhos e revestimentos de madeira. Começa por medir no local e por avaliar o estado da madeira existente (empenos, humidade, ataques de insetos), porque isso determina se se repara ou se se substitui.

O orçamento escrito indica a madeira ou o derivado (maciço, contraplacado, MDF), os acabamentos (verniz, lacagem, óleo), as ferragens e os tempos de fabrico em oficina quando há peças à medida. Em portas e janelas, a afinação das ferragens resolve muitas vezes o que parece um defeito da madeira.

A montagem termina com a verificação do funcionamento e dos acabamentos. Para soalhos e móveis, o profissional indica os cuidados de manutenção conforme o acabamento aplicado.`,

  jardineiro: `O jardineiro trata da manutenção regular (corte de relva, sebes, limpeza de canteiros, rega) e de trabalhos pontuais (plantações, preparação de solo, pequenos arranjos exteriores). Começa por uma visita para conhecer o terreno: exposição, tipo de solo, estado das plantas e do sistema de rega.

O orçamento escrito distingue a manutenção periódica (frequência, tarefas incluídas) dos trabalhos únicos, e indica o destino dos resíduos verdes. As plantações seguem o calendário adequado à espécie e ao clima da zona; plantar fora de época aumenta as perdas.

Em cada visita, o profissional verifica a rega e o estado das plantas e assinala problemas (pragas, doenças, drenagem) antes que se agravem.`,

  'limpeza-espacos': `Este serviço cobre a limpeza e o esvaziamento de casas, caves, sótãos, garagens e armazéns, e a remoção de entulho de obra. Começa por uma avaliação do volume e do tipo de materiais, porque o custo depende sobretudo do que há para retirar e de onde se encontra (acesso, andar, elevador).

O orçamento escrito indica o volume estimado, a mão de obra, o transporte e as taxas de deposição. Em Portugal, os resíduos de construção e demolição devem ser entregues a um operador licenciado, com registo; os monos e resíduos domésticos seguem as regras do município. O profissional deve indicar o destino dado aos materiais.

No fim, o espaço é entregue varrido e os comprovativos de deposição ficam disponíveis quando a lei os exige.`,

  'poda-arvores': `A poda e o abate de árvores são trabalhos de risco, feitos com equipamento de acesso e de corte adequado e com a zona de queda protegida. O profissional começa por avaliar a árvore (espécie, estado sanitário, inclinação, proximidade de casas, cabos ou vias) e decide a técnica: poda de formação ou de limpeza, redução de copa, abate por secções com cordas.

O orçamento escrito indica a técnica, o equipamento, a remoção dos ramos e do tronco e a eventual destoça. Em Portugal, o abate de algumas espécies está sujeito a autorização: os sobreiros e as azinheiras estão protegidos por lei, e muitos municípios exigem licença para árvores em zona urbana. O profissional deve verificá-lo antes de intervir.

A poda respeita a época adequada a cada espécie; cortes excessivos ou fora de época enfraquecem a árvore.`,

  'limpeza-condominio': `A limpeza de condomínio é um serviço regular definido num plano: entradas, escadas, patamares, elevadores, garagens, zonas técnicas, com a frequência e as tarefas de cada passagem. O profissional visita o edifício para avaliar as superfícies, os acessos e as necessidades específicas (vidros, pavimentos encerados, zonas exteriores).

O orçamento escrito indica o plano de limpeza, os produtos e o material utilizados, a frequência e o modo de comunicação com a administração para pedidos pontuais (após obras, mudanças, eventos). A faturação é feita em nome do condomínio, com o respetivo NIF, por intermédio do administrador, com o descritivo dos serviços.

Um registo das passagens, consultável pelos condóminos, permite verificar que o plano é cumprido.`,

  'estores-portoes': `Este serviço cobre estores (manuais e elétricos), persianas, portões de garagem e automatismos. Numa avaria, o profissional começa por identificar a causa: fita ou correia partida, mola, eixo, motor, automatismo ou fotocélulas. Trocar um motor quando o problema é mecânico é um erro comum que o diagnóstico evita.

O orçamento escrito indica as peças (compatíveis com o modelo existente ou substituição completa), o motor e o automatismo propostos, e a ligação elétrica. Os automatismos de portões devem incluir os dispositivos de segurança previstos pelas normas (deteção de obstáculos, fotocélulas) e ser afinados após a instalação.

No fim, o profissional testa os fins de curso, a força e os comandos, e explica a manutenção (lubrificação, limpeza das guias).`,
}
