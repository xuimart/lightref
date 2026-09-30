# Requirements Document

## Introduction

Esta feature traz para o modo Composicao do plugin LightRef uma experiencia de
navegacao e edicao de malha inspirada no Blender. Hoje o modo Composicao permite
adicionar objetos independentes e transforma-los inteiros com atalhos G/S/R
(mover/escalar/rotacionar). Esta feature adiciona: (1) navegacao de camera fiel ao
Blender centrada no botao do meio do mouse com vistas de numpad; e (2) um modo de
edicao de malha (Mesh Edit Mode) que permite selecionar sub-objetos (faces,
vertices e arestas), mover a selecao com G, extrudar faces com E, aplicar inset com
I e apagar faces com X/Delete, tudo manipulando VertexData (positions/indices/
normals) manualmente em JavaScript ES5.

A feature convive com o modo Objeto ja existente: a tecla Tab alterna entre modo
Objeto (transformacao do objeto inteiro, comportamento atual) e modo Edicao
(manipulacao de geometria do objeto selecionado). A geometria editada e usada nas
exportacoes/snapshots e persistida entre sessoes.

### Escopo definido (decisoes do usuario)

- Selecao de sub-objeto: faces, vertices E arestas (modos alternados por 1/2/3),
  com mover (G) para os tres tipos.
- Navegacao: fiel ao Blender com botao do meio (MMB) para orbitar, Shift+MMB para
  pan, scroll para zoom; vistas de numpad (1/3/7/5); tecla ponto (.) para focar no
  selecionado; Home para enquadrar tudo.
- Alternancia de modo: Tab entra/sai do modo Edicao no objeto selecionado.
- Extrude: E extruda a selecao seguindo o mouse (interativo), ao longo da normal por
  padrao, com trava de eixo X/Y/Z, clique confirma, Esc cancela; normais
  recalculadas apos cada operacao.
- Operacoes adicionais: Inset (I) e Apagar faces (X/Delete).
- Objetos editaveis: qualquer objeto de composicao (formas basicas e modelos
  importados OBJ/STL/GLB).
- Selecao multipla: Shift+clique adiciona/remove da selecao.
- Persistencia: a geometria editada e salva e restaurada entre sessoes.
- A geometria editada e usada nas exportacoes/snapshots do plugin.

### Fora de escopo (v1)

- Modificadores nao-destrutivos estilo Blender (Subdivision, Mirror, Array, etc.).
- Loop cut, bevel, knife, spin, bridge e demais ferramentas avancadas de modelagem.
- Edicao de UVs, materiais por face, ou grupos de vertices.
- Undo/redo com historico multi-nivel dentro do modo Edicao (ver Requisito 10 para
  o comportamento minimo de cancelamento por operacao).

## Glossary

- **Composition_Mode**: O modo Composicao do plugin (aba interna "comp"), onde o
  usuario monta uma cena com objetos independentes.
- **Composition_Object**: Um objeto independente da cena de composicao, com pivot,
  transform e selecao proprios (estrutura `sceneObjects[i]` em scene.js).
- **Object_Mode**: Modo em que os atalhos G/S/R transformam o Composition_Object
  inteiro (comportamento atual, existente).
- **Edit_Mode**: Modo em que o usuario manipula a geometria (faces/vertices/arestas)
  do Composition_Object selecionado.
- **Mesh_Editor**: O componente responsavel por selecao de sub-objetos, extrude,
  inset, delete e mover, operando sobre VertexData.
- **Selection_Element**: Um sub-objeto selecionavel: uma face, um vertice ou uma
  aresta.
- **Select_Mode**: O tipo de Selection_Element ativo no Edit_Mode: face, vertice ou
  aresta.
- **Face**: Um poligono (triangulo) da malha, identificado por um trio de indices em
  `indices`.
- **Vertex**: Um vertice da malha, identificado por uma posicao em `positions`.
- **Edge**: Uma aresta da malha, definida por um par de vertices.
- **VertexData**: Os buffers de geometria Babylon.js (`positions`, `indices`,
  `normals`) de uma malha.
- **Face_Normal**: O vetor normal geometrico de uma Face, usado como direcao padrao
  do extrude.
- **Extrude**: Operacao que cria nova geometria a partir das faces selecionadas e as
  desloca, mantendo as faces laterais conectadas.
- **Inset**: Operacao que cria uma face menor dentro de cada face selecionada,
  conectada por faces de borda.
- **Camera_Navigator**: O componente que controla orbita, pan, zoom e vistas da
  camera ArcRotateCamera.
- **Numpad_View**: Uma vista predefinida acionada por tecla de numpad (frente, lado,
  topo, alternancia orto/perspectiva).
- **Interactive_Transform**: Uma operacao que segue o mouse ate confirmacao por
  clique ou cancelamento por Esc (mesmo padrao do G/S/R atual).
- **Axis_Lock**: Restricao de uma Interactive_Transform a um unico eixo (X, Y ou Z).

## Requirements

### Requirement 1: Navegacao de camera estilo Blender

**User Story:** Como artista acostumado ao Blender, quero navegar a cena de composicao com o botao do meio do mouse, para orbitar, deslocar e aproximar sem reaprender controles.

#### Acceptance Criteria

1. WHILE Composition_Mode esta ativo E nenhum Interactive_Transform esta em andamento, WHEN o usuario pressiona o botao do meio do mouse (MMB) e arrasta o cursor, THE Camera_Navigator SHALL orbitar a ArcRotateCamera de modo que 100 pixels horizontais alterem alpha em 90 graus e 100 pixels verticais alterem beta em 90 graus, limitando beta ao intervalo de 1 a 179 graus.
2. WHILE Composition_Mode esta ativo E nenhum Interactive_Transform esta em andamento, WHEN o usuario mantem Shift pressionado, pressiona o MMB e arrasta o cursor, THE Camera_Navigator SHALL deslocar (pan) o alvo da camera no plano da tela na proporcao de 0,01 unidade por pixel, sem alterar alpha e beta.
3. WHEN o usuario gira a roda do mouse para cima em Composition_Mode, THE Camera_Navigator SHALL reduzir o raio em 10 por cento por entalhe (zoom in); WHEN gira para baixo, SHALL aumentar o raio em 10 por cento por entalhe (zoom out); limitando o raio ao intervalo de 0,5 a 100 unidades.
4. WHILE Edit_Mode esta ativo E nenhum Interactive_Transform esta em andamento, THE Camera_Navigator SHALL aplicar as mesmas respostas de orbita, pan e zoom dos criterios 1 a 3, com sensibilidade e limites identicos.
5. WHILE um Interactive_Transform esta em andamento, THE Camera_Navigator SHALL ignorar as entradas de orbita e pan, preservando alpha, beta e o alvo da camera ate a conclusao da operacao.

### Requirement 2: Vistas de numpad e enquadramento

**User Story:** Como artista, quero teclas de vista rapidas como no Blender, para alternar entre frente, lado e topo e enquadrar o que estou editando.

#### Acceptance Criteria

1. WHEN o usuario pressiona Numpad 1 em Composition_Mode, THE Camera_Navigator SHALL posicionar a camera na vista frontal (alinhada ao eixo -Z) em ate 300 ms.
2. WHEN o usuario pressiona Numpad 3 em Composition_Mode, THE Camera_Navigator SHALL posicionar a camera na vista lateral (alinhada ao eixo +X) em ate 300 ms.
3. WHEN o usuario pressiona Numpad 7 em Composition_Mode, THE Camera_Navigator SHALL posicionar a camera na vista de topo (alinhada ao eixo -Y) em ate 300 ms.
4. WHEN o usuario pressiona Numpad 5 em Composition_Mode, THE Camera_Navigator SHALL alternar a projecao da camera entre ortografica e perspectiva, preservando alvo e direcao de visao.
5. WHEN o usuario pressiona a tecla ponto (.) do numpad em Composition_Mode e existe exatamente um Composition_Object selecionado, THE Camera_Navigator SHALL definir o alvo no centro da bounding box do objeto e enquadra-lo entre 80 e 100 por cento do menor lado da area de visao em ate 300 ms.
6. IF o usuario pressiona ponto (.) do numpad e nenhum objeto esta selecionado, THEN THE Camera_Navigator SHALL preservar posicao, alvo e projecao e exibir uma indicacao de que nao ha objeto selecionado.
7. WHEN o usuario pressiona Home em Composition_Mode e existe ao menos um Composition_Object visivel, THE Camera_Navigator SHALL enquadrar a camera para conter todos os objetos visiveis entre 80 e 100 por cento do menor lado da area de visao em ate 300 ms.
8. IF o usuario pressiona Home em Composition_Mode e nao existe nenhum Composition_Object visivel, THEN THE Camera_Navigator SHALL preservar a posicao atual da camera.

### Requirement 3: Alternancia entre modo Objeto e modo Edicao

**User Story:** Como artista, quero entrar e sair do modo de edicao de malha com Tab, para editar a geometria de um objeto e voltar a manipula-lo inteiro.

#### Acceptance Criteria

1. WHEN o usuario pressiona Tab com um Composition_Object que possui malha editavel selecionado no Object_Mode, THE Mesh_Editor SHALL ativar o Edit_Mode em ate 200 ms.
2. WHEN o usuario pressiona Tab com o Edit_Mode ativo, THE Mesh_Editor SHALL retornar ao Object_Mode em ate 200 ms.
3. IF o usuario pressiona Tab sem nenhum objeto selecionado, THEN THE Mesh_Editor SHALL permanecer no Object_Mode e exibir uma indicacao solicitando que um objeto seja selecionado.
4. IF o usuario pressiona Tab com um objeto selecionado que nao possui malha editavel, THEN THE Mesh_Editor SHALL permanecer no Object_Mode e exibir uma indicacao de que o objeto nao pode ser editado.
5. WHILE o Edit_Mode esta ativo, THE Mesh_Editor SHALL suprimir os atalhos G, S e R de transformacao de objeto e aplicar as operacoes correspondentes do Edit_Mode.
6. WHEN o Edit_Mode e ativado, THE Mesh_Editor SHALL desabilitar o gizmo de objeto ate o retorno ao Object_Mode.
7. WHEN o usuario retorna ao Object_Mode a partir do Edit_Mode, THE Mesh_Editor SHALL preservar todas as alteracoes de geometria realizadas durante o Edit_Mode.

### Requirement 4: Alternancia de tipo de selecao (face/vertice/aresta)

**User Story:** Como artista, quero alternar entre selecionar faces, vertices e arestas com as teclas 1/2/3, para editar diferentes partes da malha como no Blender.

#### Acceptance Criteria

1. WHILE o Edit_Mode esta ativo, WHEN o usuario pressiona a tecla 1, THE Mesh_Editor SHALL definir o Select_Mode como vertice em ate 100 ms.
2. WHILE o Edit_Mode esta ativo, WHEN o usuario pressiona a tecla 2, THE Mesh_Editor SHALL definir o Select_Mode como aresta em ate 100 ms.
3. WHILE o Edit_Mode esta ativo, WHEN o usuario pressiona a tecla 3, THE Mesh_Editor SHALL definir o Select_Mode como face em ate 100 ms.
4. WHEN o Edit_Mode e ativado, THE Mesh_Editor SHALL definir o Select_Mode inicial como face.
5. WHEN o Select_Mode muda para um valor diferente do atual, THE Mesh_Editor SHALL limpar a selecao, deixando-a com zero Selection_Elements.
6. IF o usuario pressiona as teclas 1, 2 ou 3 fora do Edit_Mode, THEN THE Mesh_Editor SHALL ignorar o evento e preservar o estado atual.
7. WHEN o usuario pressiona a tecla do Select_Mode ja ativo, THE Mesh_Editor SHALL preservar a selecao atual sem limpa-la.

### Requirement 5: Selecao de sub-objetos por clique

**User Story:** Como artista, quero clicar em faces, vertices ou arestas para seleciona-los, para escolher exatamente a parte da malha que vou editar.

#### Acceptance Criteria

1. WHEN o usuario clica sobre a malha no Edit_Mode e existe ao menos um Selection_Element do Select_Mode ativo dentro de um raio de 8 pixels do ponto clicado, THE Mesh_Editor SHALL selecionar o elemento mais proximo e substituir a selecao anterior por esse unico elemento.
2. WHEN o usuario clica com Shift sobre um Selection_Element nao selecionado no Edit_Mode e a selecao atual contem menos de 100000 elementos, THE Mesh_Editor SHALL adicionar esse elemento a selecao, mantendo os ja selecionados.
3. WHEN o usuario clica com Shift sobre um Selection_Element ja selecionado no Edit_Mode, THE Mesh_Editor SHALL remover esse elemento da selecao, mantendo os demais.
4. WHEN o usuario clica em uma area vazia (nenhuma malha atingida pelo raio de picking) sem Shift no Edit_Mode, THE Mesh_Editor SHALL limpar a selecao, deixando zero elementos selecionados.
5. WHILE existem Selection_Elements selecionados, THE Mesh_Editor SHALL renderizar cada elemento selecionado com um estado visual distinto do nao selecionado, atualizando o destaque em ate 100 ms apos a alteracao da selecao.
6. IF o usuario clica sobre a malha mas nenhum Selection_Element do Select_Mode ativo esta dentro do raio de 8 pixels, THEN THE Mesh_Editor SHALL preservar a selecao atual sem adicionar, remover ou limpar elementos.

### Requirement 6: Mover selecao (G)

**User Story:** Como artista, quero mover faces, vertices ou arestas selecionados com a tecla G, para reposicionar partes da malha como no Blender.

#### Acceptance Criteria

1. WHEN a tecla G e pressionada e existe ao menos um Selection_Element, THE Mesh_Editor SHALL iniciar um Interactive_Transform de deslocamento usando a posicao atual do cursor como ponto de referencia inicial.
2. IF a tecla G e pressionada e nao existe nenhum Selection_Element, THEN THE Mesh_Editor SHALL exibir uma indicacao de "nada selecionado" por 3 segundos e nao iniciar o Interactive_Transform.
3. WHILE um Interactive_Transform de deslocamento esta ativo, THE Mesh_Editor SHALL atualizar as posicoes dos vertices afetados conforme o cursor, com latencia de no maximo 100 ms.
4. WHEN a tecla X, Y ou Z e pressionada durante o deslocamento e nenhum Axis_Lock esta ativo nesse eixo, THE Mesh_Editor SHALL restringir o deslocamento ao eixo correspondente.
5. WHEN a mesma tecla de eixo e pressionada novamente enquanto seu Axis_Lock esta ativo, THE Mesh_Editor SHALL remover o Axis_Lock e retornar ao movimento livre.
6. WHEN o botao esquerdo e clicado durante o deslocamento, THE Mesh_Editor SHALL confirmar a operacao, fixar as novas posicoes e recalcular as Face_Normals das faces afetadas.
7. WHEN a tecla Esc e pressionada durante o deslocamento, THE Mesh_Editor SHALL restaurar as posicoes e as Face_Normals aos valores anteriores ao inicio da operacao e encerrar o Interactive_Transform.
8. IF o foco do painel e perdido durante o deslocamento, THEN THE Mesh_Editor SHALL cancelar a operacao e restaurar posicoes e Face_Normals aos valores anteriores ao inicio.

### Requirement 7: Extrude de faces (E)

**User Story:** Como artista, quero extrudar as faces selecionadas com a tecla E, para criar nova geometria empurrando ou puxando a superficie como no Blender.

#### Acceptance Criteria

1. IF a tecla E e pressionada enquanto o Select_Mode for diferente de face OU nenhuma Face estiver selecionada, THEN THE Mesh_Editor SHALL ignorar o comando, manter a VertexData inalterada e exibir a mensagem "Selecione uma face para extrudar".
2. WHEN a tecla E e pressionada com Select_Mode de face e ao menos uma Face selecionada, THE Mesh_Editor SHALL duplicar as faces selecionadas, criar as faces laterais de conexao, iniciar o Extrude com deslocamento inicial de 0 unidades e exibir uma indicacao de que o Extrude esta ativo em ate 100 ms.
3. WHILE o Extrude esta ativo, THE Mesh_Editor SHALL deslocar as faces extrudadas ao longo da Face_Normal media proporcionalmente ao movimento do cursor, limitando o deslocamento ao intervalo de -10000 a 10000 unidades.
4. WHEN o usuario pressiona X, Y ou Z durante o Extrude, THE Mesh_Editor SHALL travar o deslocamento no eixo correspondente e exibir uma indicacao do eixo travado.
5. WHEN o usuario pressiona novamente a tecla do eixo ja travado durante o Extrude, THE Mesh_Editor SHALL destravar o eixo e retornar o deslocamento ao movimento ao longo da Face_Normal media.
6. WHEN o usuario digita um valor numerico no intervalo de -10000 a 10000 durante o Extrude, THE Mesh_Editor SHALL aplicar esse valor como deslocamento das faces extrudadas ao longo do eixo ou normal ativos.
7. IF o usuario digita um valor numerico fora do intervalo de -10000 a 10000 durante o Extrude, THEN THE Mesh_Editor SHALL rejeitar a entrada, manter o deslocamento anterior e exibir uma indicacao do intervalo permitido.
8. WHEN o usuario confirma o Extrude (clique esquerdo ou Enter), THE Mesh_Editor SHALL finalizar o deslocamento, recalcular as Face_Normals das faces afetadas e atualizar a selecao para conter somente as faces recem-extrudadas, em ate 100 ms.
9. WHEN o usuario pressiona Esc durante o Extrude, THE Mesh_Editor SHALL cancelar mantendo as faces extrudadas com deslocamento igual a 0 unidades (coladas na origem), recalcular as Face_Normals e atualizar a selecao para as faces recem-extrudadas.

### Requirement 8: Inset de faces (I)

**User Story:** Como artista, quero aplicar inset nas faces selecionadas com a tecla I, para criar uma face menor dentro de cada face selecionada como no Blender.

#### Acceptance Criteria

1. WHEN o usuario pressiona I no Edit_Mode com Select_Mode de face e ao menos uma Face selecionada, THE Mesh_Editor SHALL criar, para cada Face selecionada, uma face interna com distancia de inset inicial de 0 unidades, conectada a face original por faces de borda quadrilaterais.
2. WHEN o Inset e iniciado, THE Mesh_Editor SHALL iniciar um Interactive_Transform que mapeia o movimento do mouse para a distancia de inset, restrita ao intervalo de 0 ate metade da menor aresta da face, e exibir o valor atual da distancia.
3. WHEN o usuario clica com o botao esquerdo durante o Inset, THE Mesh_Editor SHALL confirmar a geometria do inset com a distancia corrente.
4. WHEN o usuario pressiona Esc durante o Inset, THE Mesh_Editor SHALL reverter a malha ao estado anterior ao inicio do Inset, removendo as faces internas e de borda criadas.
5. WHEN um Inset e confirmado, THE Mesh_Editor SHALL recalcular as Face_Normals da malha afetada e atualizar a selecao para conter exclusivamente as faces internas recem-criadas.
6. IF o usuario pressiona I no Edit_Mode com Select_Mode diferente de face ou sem Face selecionada, THEN THE Mesh_Editor SHALL exibir a mensagem "Selecione uma face para inset" e nao iniciar a operacao, mantendo selecao e geometria inalteradas.

### Requirement 9: Apagar faces (X / Delete)

**User Story:** Como artista, quero apagar faces selecionadas com X ou Delete, para remover geometria indesejada como no Blender.

#### Acceptance Criteria

1. WHEN o usuario pressiona X ou Delete no Edit_Mode com Select_Mode de face e ao menos uma Face selecionada, THE Mesh_Editor SHALL remover da VertexData todas as faces selecionadas e reconstruir a malha em ate 200 ms para uma selecao de ate 5000 faces.
2. WHEN faces sao removidas, THE Mesh_Editor SHALL recalcular as Face_Normals das faces remanescentes usando VertexData.ComputeNormals.
3. WHEN faces sao removidas, THE Mesh_Editor SHALL limpar a selecao, deixando a contagem de faces selecionadas igual a 0.
4. IF o usuario pressiona X ou Delete no Edit_Mode sem nenhuma Face selecionada, THEN THE Mesh_Editor SHALL exibir uma indicacao de que nenhuma face esta selecionada e manter a VertexData inalterada.
5. IF a remocao das faces selecionadas resultaria em uma malha com 0 faces remanescentes, THEN THE Mesh_Editor SHALL rejeitar a operacao, exibir uma indicacao de que a malha nao pode ficar vazia e manter a VertexData inalterada.

### Requirement 10: Integridade da geometria e recalculo de normais

**User Story:** Como artista, quero que a malha permaneca valida e bem iluminada apos cada edicao, para continuar trabalhando sem artefatos visuais.

#### Acceptance Criteria

1. WHEN uma operacao de edicao (mover, extrude, inset ou apagar) e confirmada, THE Mesh_Editor SHALL atualizar os buffers VertexData de forma que positions, indices e normals fiquem mutuamente consistentes, garantindo que todo indice referencie um vertice existente e que positions e normals possuam o mesmo numero de elementos.
2. WHEN uma operacao de edicao altera a geometria, THE Mesh_Editor SHALL recalcular as normais usando BABYLON.VertexData.ComputeNormals antes de reaplicar os buffers a malha.
3. WHILE o Edit_Mode esta ativo, THE Mesh_Editor SHALL preservar a associacao da malha editada ao seu Composition_Object, mantendo inalterados pivot, transform (posicao, rotacao, escala) e material.
4. IF uma operacao de edicao produz geometria invalida (indice fora do intervalo, quantidade de indices nao multipla de 3, ou positions vazio), THEN THE Mesh_Editor SHALL rejeitar a alteracao, restaurar a malha ao estado anterior e exibir uma indicacao de que a edicao foi revertida.
5. WHEN uma operacao interativa e cancelada com Esc antes da confirmacao, THE Mesh_Editor SHALL restaurar a malha ao estado valido imediatamente anterior ao inicio da operacao, incluindo positions, indices e normals originais.

### Requirement 11: Persistencia da geometria editada

**User Story:** Como artista, quero que a malha editada seja salva, para reencontrar minhas edicoes ao reabrir o plugin.

#### Acceptance Criteria

1. WHEN a geometria de um Composition_Object e alterada no Edit_Mode e nenhuma nova alteracao ocorre por 1000 ms, THE Composition_Mode SHALL registrar a geometria editada na configuracao persistida (LightRefStorage) usando escrita atomica.
2. WHEN o plugin e reaberto e um Composition_Object com geometria editada e recarregado, THE Composition_Mode SHALL aplicar a geometria editada salva a malha somente se a contagem de vertices da geometria salva for igual a da malha original do objeto.
3. IF a geometria salva de um Composition_Object nao pode ser aplicada por dado ausente, JSON corrompido ou contagem de vertices divergente, THEN THE Composition_Mode SHALL carregar a malha original, preservar o dado salvo sem sobrescreve-lo, registrar o erro no diagnostico (diag) e indicar que a geometria editada nao pode ser restaurada.
4. IF a escrita da geometria editada na configuracao persistida falha, THEN THE Composition_Mode SHALL manter a geometria editada em memoria, registrar o erro no diagnostico (diag) e indicar que a edicao nao pode ser salva.

### Requirement 12: Geometria editada nas exportacoes

**User Story:** Como artista, quero que as imagens exportadas mostrem a malha editada, para que meu trabalho de edicao apareca no resultado final.

#### Acceptance Criteria

1. WHEN o usuario gera um snapshot ou exporta a cena de composicao, THE Composition_Mode SHALL renderizar cada Composition_Object usando o estado de geometria editada mais recente confirmado no viewport, sem exigir passo de confirmacao adicional.
2. WHEN o usuario envia a cena para o Photoshop, THE Composition_Mode SHALL usar o mesmo estado de geometria editada dos Composition_Objects exibido no viewport no instante do envio.
3. IF, no instante do snapshot, exportacao ou envio, o estado exibido no viewport diferir do estado usado na imagem gerada, THEN THE Composition_Mode SHALL descartar essa imagem e nao entregar o resultado.
4. IF a geracao do snapshot, exportacao ou envio ao Photoshop falhar, THEN THE Composition_Mode SHALL preservar a geometria editada atual sem alteracao e exibir uma indicacao de que a operacao nao foi concluida.

### Requirement 13: Compatibilidade tecnica

**User Story:** Como desenvolvedor do plugin, quero que a feature respeite as restricoes tecnicas do ambiente CEP, para que funcione no Photoshop sem quebrar.

#### Acceptance Criteria

1. THE Mesh_Editor SHALL manipular a geometria atualizando diretamente os arrays de VertexData (positions, indices, normals) do mesh, sem invocar APIs de edicao de malha ausentes na versao do Babylon.js empacotada no plugin.
2. THE Mesh_Editor SHALL ser implementado exclusivamente em JavaScript ES5, sem etapa de build ou transpilacao, carregando sem erros de sintaxe no runtime CEP.
3. THE Mesh_Editor SHALL executar sob o Chromium 99 (CEF 99) do Photoshop sem invocar recursos posteriores ao ECMAScript 5 (arrow functions, let/const, classes, template literals, Promise nativa).
4. THE Mesh_Editor SHALL manter todos os arquivos JavaScript da feature com conteudo somente ASCII (pontos de codigo de 0 a 127).
5. WHEN uma alteracao de geometria de um Composition_Object e concluida, THE Mesh_Editor SHALL registrar esse objeto como shadow caster via lightManager.addShadowCasters.
6. IF uma alteracao de geometria produzir VertexData invalida, THEN THE Mesh_Editor SHALL rejeitar a alteracao, preservar a geometria anterior inalterada e sinalizar uma indicacao de erro de que a atualizacao falhou.
7. IF o registro do objeto como shadow caster via lightManager.addShadowCasters falhar, THEN THE Mesh_Editor SHALL manter a geometria editada aplicada e sinalizar uma indicacao de que o registro de shadow caster nao foi concluido.
