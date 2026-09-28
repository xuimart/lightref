# LightRef — Guia de Desenvolvimento e Teste (MVP v0.1.0)

Plugin CEP para Photoshop: referência de iluminação 3D. Carrega um modelo,
posiciona múltiplas luzes e joga o render como camada no documento ativo.

Segue o padrão Xuimart (ver `PADRAO_PLUGINS_XUIMART.md` e
`MANUAL_IDENTIDADE_UI_XUIMART.md` na raiz do workspace).

---

## O que já funciona neste MVP

- Viewport 3D (Three.js r128 sobre WebGL) com órbita pelo mouse
- Modelo Asaro carregado por padrão (`models/asaro.obj`)
- Upload de outro `.obj` pelo botão de upload
- Múltiplas luzes: adicionar, remover, ligar/desligar
- Por luz: intensidade, direção horizontal (azimute), altura (elevação) e cor
- Sombra projetada no chão (ground shadow) e guias visuais das luzes
- Botão "Jogar como camada no Photoshop" (captura o viewport e cria uma layer)
- Bilíngue PT/EN (dicionário em `js/panel.js`)

---

## 1. Pré-requisito: PlayerDebugMode

Extensões não assinadas só carregam com `PlayerDebugMode` ligado. Rode uma vez
(PowerShell). Cobre as versões de CSXS do Photoshop 2018–2027:

```powershell
$versions = "6","7","8","9","9.4","10","11","12","13","14","15"
foreach ($v in $versions) {
    foreach ($root in "HKCU:\Software\Adobe","HKCU:\Software\WOW6432Node\Adobe") {
        $key = Join-Path $root "CSXS.$v"
        New-Item -Path $key -Force | Out-Null
        Set-ItemProperty -Path $key -Name PlayerDebugMode -Value "1" -Type String
    }
}
Write-Output "PlayerDebugMode habilitado."
```

Depois disso, reinicie o Photoshop.

---

## 2. Instalar a extensão (modo dev)

Copie a pasta `com.lightref.cep` para uma das pastas CEP extensions. A que **não
exige elevação** é a do usuário:

```powershell
$src = "e:\3D Light Ref\com.lightref.cep"
$dst = "$env:APPDATA\Adobe\CEP\extensions\com.lightref.cep"
if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
Copy-Item -Recurse -Force $src $dst
Write-Output "Instalado em: $dst"
```

> Dica de ciclo rápido: durante o desenvolvimento, em vez de copiar, dá para
> criar um link simbólico apontando para a pasta do projeto. Assim editar o
> projeto reflete direto na extensão instalada (precisa de terminal como admin):
>
> ```powershell
> New-Item -ItemType SymbolicLink -Path "$env:APPDATA\Adobe\CEP\extensions\com.lightref.cep" -Target "e:\3D Light Ref\com.lightref.cep"
> ```

Abra no Photoshop em: **Filtros ▸ LightRef** (ou menu **Janela ▸ Extensões**,
dependendo da versão).

---

## 3. Validar que o WebGL subiu (maior risco técnico)

Este é o teste que confirma que a base do plugin funciona no CEF do CEP:

1. Abra o painel LightRef no Photoshop.
2. Aguarde o overlay "Carregando modelo" (o Asaro tem 15 MB, pode levar alguns
   segundos parseando — é esperado neste MVP).
3. **Sucesso:** você vê a cabeça Asaro cinza sobre fundo azul, com sombra no chão.
   Arraste o mouse para girar, scroll para zoom.
4. **Se aparecer tela azul sem modelo:** o WebGL subiu mas o modelo falhou —
   veja o console (passo 5).
5. **Se aparecer preto/vazio:** provável falha de WebGL. Abra o DevTools remoto:
   com o painel aberto, vá em `http://localhost:8088` no Chrome e veja o console.

O arquivo `.debug` já expõe a porta 8088 para esse DevTools remoto.

---

## 4. Testar "jogar como camada"

1. Tenha um documento aberto no Photoshop (qualquer tamanho).
2. Ajuste as luzes no painel.
3. Clique em **Jogar como camada no Photoshop**.
4. Uma nova camada `LightRef HHMMSS` aparece no topo do documento com o render.

Se não houver documento aberto, o painel avisa em vez de dar erro.

---

## 5. Recarregar após editar

| Arquivo editado | Precisa reiniciar o Photoshop? |
|-----------------|-------------------------------|
| `init.jsx` (ExtendScript) | Não — é relido a cada chamada |
| `index.html`, `index.css`, `js/*.js` | Sim (ou feche/reabra o painel) |

Se usou link simbólico, basta fechar e reabrir o painel para pegar mudanças de UI.

---

## Riscos conhecidos / próximos passos

- **OBJ de 15 MB é pesado.** O parse trava o painel por alguns segundos. Próximo
  passo: converter o Asaro para `.glb` (binário, ~3-5x menor e parse muito mais
  rápido) e trocar o OBJLoader pelo GLTFLoader. Reduz o tempo de abertura.
- **Ícones são placeholder.** Círculo com "L". Substituir por ícones reais
  derivados de um `logo.svg` (fluxo `render_icon.html` do padrão Xuimart).
- **Sem onboarding/Xuimzinho ainda.** O wizard de primeiro uso entra numa fase
  posterior, junto com o instalador `.exe` e o `version.json` de update.
- **Não testado em Photoshop real** nesta máquina de build. A validação dos
  passos 3 e 4 é manual, do seu lado.

## Próximas funcionalidades planejadas (pós-MVP)

- Tipos de luz: spot e pontual (hoje só direcional)
- Render clay vs. matcap (modo "só forma")
- Presets de câmera (frente, 3/4, perfil)
- Biblioteca de modelos prontos (esfera, cubo, mão, torso)
- Preservar cena entre sessões (persistência de luzes)
- Instalador `.exe` + sistema de update Xuimart
