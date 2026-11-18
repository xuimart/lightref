# Publicação do LightRef

O repositório oficial é `xuimart/lightref`, ramo `main`.

1. Validar código, cenas antigas e instalação sobre a versão 0.9.1. Gerar `dist/LightRef_Setup.exe` com `tools/build-installer.ps1`.
2. Criar uma release com os assets `LightRef_Setup.exe`, `version.json` e `SHA256SUMS.txt`. Usar tag igual à versão de `version.json`, com prefixo `v`.
3. Confirmar os downloads e hashes. O link estável é `https://github.com/xuimart/lightref/releases/latest/download/LightRef_Setup.exe`.
4. Depois dos assets disponíveis, publicar o conteúdo exato de `version.json` em `https://www.xuimart.com.br/lightref/version.json`.
5. Consultar o arquivo remoto com cache-buster e confirmar versão, changelog e download. Sem esse passo, usuários da 0.9.1 não recebem o aviso, mesmo com a release pronta no GitHub.

A versão 1.0 lê o site e o manifesto anexado à última release, escolhendo a versão mais recente válida. O atualizador só notifica e abre o download após um clique; não substitui arquivos em segundo plano.

Credenciais de publicação, configurações pessoais e arquivos privados ficam fora do repositório. Não incluir diagnósticos da máquina do desenvolvedor nos assets públicos.
