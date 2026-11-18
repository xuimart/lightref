# LightRef 1.0.0

Referência de luz, materiais e composição 3D dentro do Adobe Photoshop.

[Baixar o instalador Windows](https://github.com/xuimart/lightref/releases/latest/download/LightRef_Setup.exe)

Salve seus documentos, feche o Photoshop e execute o instalador. Ele pede permissão de administrador, como na versão 0.9.1. Depois, abra o Photoshop. Abra **Janela → Extensões (Legado) → LightRef**.

## Atualização de versões anteriores

A versão 1.0 segue o instalador publicado em `build_0.9.1`: detecta os Photoshops e atualiza o LightRef no usuário (`%APPDATA%\Adobe\CEP\extensions\com.lightref.cep`), em Common Files de 32/64 bits e em `Required\CEP\extensions\com.lightref.cep` de cada Photoshop detectado. Mantém os identificadores `com.lightref` / `com.lightref.panel` e os dados em `%APPDATA%\LightRef`: cenas, modelos importados, categorias e preferências continuam no mesmo local. O instalador verifica os arquivos e guarda cada instalação anterior fora das extensões ativas. Se uma troca falhar, restaura os locais já alterados e as alterações do registro.

O aviso aos usuários de versões anteriores depende de `https://www.xuimart.com.br/lightref/version.json`. A release no GitHub, sozinha, não altera esse arquivo. O aviso oferece o download do instalador; o LightRef não instala atualizações silenciosamente.

## Novidades

- Renderização artística como padrão, com reflexos, subsurface e sombras.
- Luzes direcional, pontual, spot e retangular, com controles de feixe e visibilidade.
- Aba Material antes de Luz; acabamento, suavização de normais, Cel + Line Art e cristal.
- Vidro, diamante, esmeralda e rubi com refração em volume, absorção pela distância percorrida, dispersão e cáustica aproximada no piso.
- HDR e cores de chão/céu em Ambiente, com bases de horários.
- Curvas junto dos ajustes de imagem.
- Divisória arrastável entre visor e menus, com tamanho salvo, teclado e restauração 70/30 por duplo clique.
- Duas colunas para os controles de material a partir de 580 px; uma coluna em painéis estreitos.
- Correções de oclusão pelo piso e disputa entre carregamentos de modelos.

## Compatibilidade e limites

Windows, Photoshop com extensões CEP e WebGL. O manifesto mantém a faixa de versões do LightRef anterior (Photoshop 19+); a validação nativa desta atualização foi feita no Photoshop 2025 (26.x), em uma RTX 3060. A renderização e a inversão do cristal também foram verificadas em Chrome forçado a WebGL 1. Não há confirmação de funcionamento nativo em todas as versões antigas e placas de vídeo.

O renderizador usa Babylon.js 9.28 e shaders próprios de integração. Refração em espaço de tela, subsurface e cáusticas são aproximações para estudo artístico; não há path tracing, múltiplos reflexos internos completos nem refração entre vários objetos transparentes. O recorte PNG conserva transparência, mas não distorce um novo fundo colocado depois no Photoshop.

## Desenvolvimento e publicação

```powershell
npm ci --ignore-scripts
npm test
npm run build
powershell -NoProfile -ExecutionPolicy Bypass -File tools/build-installer.ps1
```

O build gera `dist/LightRef_Setup.exe`, com o recurso `lightref.zip` e entradas `cep/...`, como no instalador anterior. Verifica o payload e executa testes do instalador sem alterar o registro real. O nome do executável é estável para preservar os links de atualização.

Os testes de navegador em `tools/browser` usam Chrome instalado (`C:/Program Files/Google/Chrome/Application/chrome.exe`) e produzem relatórios/imagens em `com.lightref.cep/qa`. Os shaders são gerados com os arquivos locais de `tools/shader-sources`, sem depender de outro projeto.

Para publicar: enviar o executável, `version.json` e os hashes à release do GitHub, verificar os downloads e só então enviar o mesmo `version.json` para `/lightref/version.json` no site. A versão 1.0 também verifica o manifesto anexado à última release como canal redundante. Ver [PUBLICACAO.md](PUBLICACAO.md).

## Origem

A interface, modelos, integração CEP e bibliotecas partem do LightRef 0.9.1. A versão artística foi desenvolvida e validada em uma instalação separada antes desta integração. Sua base de shaders inclui adaptações da reconstrução local Xuim Luz Estudo, produzida pela inspeção do arquivo `LightBust_V2.zip` fornecido pelo mantenedor. Isso não é uma declaração de implementação independente nem altera direitos de terceiros. Os avisos existentes das bibliotecas e recursos foram preservados.
