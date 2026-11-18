# Verificação de release

Os relatórios locais do instalador ficam nesta pasta e são ignorados pelo Git. A validação inclui payload, backup, atualização de uma instalação com manifesto 0.9.1, preservação de configurações/cenas/modelos importados, restauração após falha e recusa de outro plugin.

Os testes antigos continuam em `com.lightref.cep/tests`. Os testes de navegador em `tools/browser` verificam o renderizador, refração/inversão, mudanças de material, curvas, layout e redimensionamento. A execução em Chrome não substitui a validação nativa em cada versão do Photoshop.

O instalador segue `build_0.9.1`: UAC na abertura normal, detecção de Photoshop, destinos no usuário/Common Files/Required CEP e registro HKCU/HKLM. Os testes adicionais simulam seis instalações antigas, verificam seus backups e interrompem a segunda troca para conferir a restauração de todos os locais. Nenhum Photoshop real é alterado por `/self-test`.

A interface está em `installer/InstallerDesign.cs`, com a paleta e a composição em dois painéis do `GUIA_INSTALADOR_XUIMART.md`. O botão “Ver detalhes” alterna o resumo e o log; “Localizar Photoshop” permite incluir uma instalação não detectada. Os destinos compartilhados continuam atendendo todas as versões. O ícone é gerado localmente por `tools/build-installer-icon.ps1`, sem recursos externos.

O build captura as telas de início, progresso, conclusão, erro e detalhes em `installer-*.png`. `/render-ui caminho.png [installing|success|error|details]` simula somente a apresentação fora da tela, sem iniciar a instalação ou alterar o registro. As capturas não comprovam uma instalação real no Photoshop.
