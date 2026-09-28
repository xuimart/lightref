# Manual de Identidade Visual e UI — Plugins Xuimart

Guia completo para replicar o design, a formatação e os padrões de interação
usados no DrawlapsePS em qualquer novo plugin Adobe CEP.

**Complementa:** `IDENTITY_GUIDE.md` (paleta e tipografia puras) e
`PADRAO_PLUGINS_XUIMART.md` (arquitetura e distribuição).

---

## 1. Estrutura do Painel

O painel segue um layout vertical em 3 zonas fixas:

```
┌─────────────────────────────────┐
│  TABS (navegação principal)     │ ← fixo no topo
├─────────────────────────────────┤
│                                 │
│  CONTEÚDO (scroll interno)      │ ← flex: 1, overflow-y: auto
│                                 │
├─────────────────────────────────┤
│  FOOTER (marca + apoio)         │ ← fixo no fundo
└─────────────────────────────────┘
```

### Tabs

3 abas: **Painel** (dashboard), **Histórico**, **Configurações**.

```html
<div class="tabs-bar">
    <button class="tab active" id="tab-dashboard">
        <svg ...> <span class="lang-dashboard">Painel</span>
    </button>
    <div class="tab-separator"></div>
    <button class="tab" id="tab-history">...</button>
    <div class="tab-separator"></div>
    <button class="tab" id="tab-settings">...</button>
</div>
```

```css
.tabs-bar {
    display: flex;
    justify-content: center;
    gap: 0;
    border-bottom: 1px solid #3c3c48;
    padding: 4px 10px;
    background: #282828;
}
.tab {
    flex: 1;
    background: none;
    border: none;
    color: #888;
    font-size: 10px;
    font-weight: 600;
    padding: 8px 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    transition: color 0.15s;
}
.tab.active { color: #de2246; border-bottom: 2px solid #de2246; }
.tab:hover { color: #e0e0e0; }
.tab-separator { width: 1px; background: #3c3c48; margin: 4px 0; }
```

### Footer

```html
<footer>
    <div class="footer-brand">
        <img src="icons/logo.png" style="height:14px;">
        <span style="color:#888;font-size:10px;">Produto vX.Y.Z</span>
        <img src="img/logo_xuimart_branca.png" class="logo-img" title="Xuimart">
    </div>
    <div class="footer-links">
        <a href="https://livepix.gg/xuimart" class="footer-donate-link">
            <svg ...> Pix
        </a>
        <a href="https://ko-fi.com/xuimart" class="footer-donate-link" style="color:#29abe0;">
            <svg ...> Ko-fi
        </a>
    </div>
</footer>
```

```css
footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 14px;
    background: #1a1a1a;
    border-top: 1px solid #333;
    font-size: 10px;
}
.logo-img { height: 14px; opacity: 0.7; cursor: pointer; }
.logo-img:hover { opacity: 1; }
.footer-donate-link {
    color: #00c8c8;
    text-decoration: none;
    font-size: 10px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 3px;
}
```

---

## 2. Wizard de Primeiro Uso (Onboarding)

O wizard é um modal full-panel com o mascote Xuimzinho guiando o usuário pelos
primeiros passos. Aparece apenas na primeira execução (`onboardingCompleted: false`
no config).

### Anatomia

```
┌──────────────────────────────────────┐
│ Produto vX.Y.Z    ●●●●●●●●●●  [✕]  │ ← header: título + dots + fechar
├──────────────────────────────────────┤
│                                      │
│   [Xuimzinho]  "Balão de fala..."    │ ← mascote (fixo, alterna animação)
│                                      │
│   ┌──────────────────────────────┐   │
│   │  Conteúdo do passo atual     │   │ ← troca por step (display:none/block)
│   └──────────────────────────────┘   │
│                                      │
├──────────────────────────────────────┤
│  [← Voltar]              [Próximo →] │ ← footer: navegação
│                     [🎉 Começar!]    │ ← último step: botão de conclusão
└──────────────────────────────────────┘
```

### Sequência de Passos (modelo)

| Step | Conteúdo | Xuimzinho diz |
|------|----------|---------------|
| 0 | Seleção de idioma (PT/EN) | "Olá! Eu sou o Xuimzinho. Qual idioma?" |
| 1 | Introdução + aviso | "São só X passos rápidos!" |
| 2 | Feature de privacidade | "Só grava o canvas, nunca a tela!" |
| 3 | Feature principal (auto-record) | "Funciona sem você clicar em nada!" |
| 4 | Configurações | "Resolução, qualidade, idle..." |
| 5 | Seleção de pasta principal | (input + botão browse) |
| 6 | Seleção de pasta de exportação | (input + botão browse) |
| 7 | Feature secundária (watermark) | (input + browse opcional) |
| 8 | Como usar (export) | "Quando terminar, é só exportar!" |
| 9 | Apoio/doação | Botões LivePix + Ko-fi |

### Mascote Xuimzinho

```html
<div class="xuim-mascot-container">
    <img id="xuim-avatar-img" src="img/xuim_falando_normal.png"
         class="xuim-avatar-img" alt="Xuimzinho" style="transform: scaleX(-1);">
    <div class="speech-bubble-box" id="xuim-speech-bubble">
        "Texto do balão muda a cada step..."
    </div>
</div>
```

```css
.xuim-mascot-container {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
    min-height: 70px;
}
.xuim-avatar-img {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid #de2246;
    flex-shrink: 0;
}
.speech-bubble-box {
    background: #2c2c36;
    color: #f0f0f0;
    font-size: 11px;
    line-height: 1.5;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid #3c3c48;
    position: relative;
    flex: 1;
}
```

### Animação de Fala

O mascote alterna entre duas imagens pra simular fala:

```javascript
var mascotTalkInterval = setInterval(function() {
    var img = document.getElementById('xuim-avatar-img');
    if (!img) return;
    // Alterna entre normal e olhos fechados
    var isNormal = img.src.indexOf('normal') !== -1;
    img.src = isNormal
        ? 'img/xuim_falandoolhosfechados.png'
        : 'img/xuim_falando_normal.png';
}, 600);  // 600ms entre alternâncias
```

**Estados do mascote:**
- `xuim_falando_normal.png` — fala (boca aberta, olhos abertos)
- `xuim_falandoolhosfechados.png` — fala (olhos fechados, alterna com acima)
- `xuim_pensando.png` — processando, aguardando
- `xuim_bravo.png` — aviso importante, erro
- `xuim_update.png` — notificação de update (versão ícone)

### Dots de Progresso

```css
.step-dots {
    display: flex;
    gap: 6px;
}
.step-dots .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #3a3a4a;
    transition: background 0.2s;
}
.step-dots .dot.active { background: #de2246; }
.step-dots .dot.completed { background: #22c55e; }
```

### Cards de Idioma

```css
.lang-cards-group {
    display: flex;
    gap: 10px;
    justify-content: center;
    margin-top: 8px;
}
.lang-card {
    flex: 1;
    background: #1c1c24;
    border: 2px solid #3a3a4a;
    border-radius: 10px;
    padding: 12px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
}
.lang-card:hover { border-color: #de2246; background: #252532; }
.lang-card.selected { border-color: #de2246; background: #2a161e; }
.lang-flag { font-size: 24px; margin-bottom: 4px; }
.lang-name { font-size: 11px; font-weight: 600; color: #e0e0e0; }
```

### Feature Box (explicação de feature)

```css
.onboard-feature-box {
    background: #1e1e28;
    border: 1px solid #3c3c48;
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 11px;
    line-height: 1.5;
}
```

Variações por cor de borda:
- `border-color: #de2246` — aviso/importante (vermelho)
- `border-color: #22c55e` — sucesso/feature positiva (verde)
- `border-color: #00a2ff` — informação/configuração (azul)

### Interactive Picker Box (pasta/arquivo)

```css
.interactive-picker-box {
    background: #1a1a24;
    border: 1px solid #3c3c48;
    border-radius: 8px;
    padding: 12px;
}
.input-with-button {
    display: flex;
    align-items: center;
    gap: 6px;
}
.input-with-button input {
    flex: 1;
    background: #0e0e14;
    border: 1px solid #555;
    color: #ddd;
    border-radius: 4px;
    padding: 6px 8px;
    font-size: 11px;
}
```

### Lógica de Navegação

```javascript
var currentStep = 0;
var totalSteps = 10; // 0 a 9

function goToStep(n) {
    // Esconde todos
    for (var i = 0; i <= 9; i++) {
        var el = document.getElementById('onboard-step-' + i);
        if (el) el.style.display = 'none';
    }
    // Mostra o atual
    var step = document.getElementById('onboard-step-' + n);
    if (step) step.style.display = 'block';

    // Atualiza dots
    for (var d = 0; d <= 9; d++) {
        var dot = document.getElementById('dot-' + d);
        if (!dot) continue;
        dot.className = 'dot';
        if (d < n) dot.classList.add('completed');
        if (d === n) dot.classList.add('active');
    }

    // Atualiza balão do mascote
    updateMascotSpeech(n);

    // Botões prev/next
    btnPrev.style.visibility = (n === 0) ? 'hidden' : 'visible';
    btnNext.style.display = (n === totalSteps - 1) ? 'none' : 'inline-block';
    btnFinish.style.display = (n === totalSteps - 1) ? 'inline-block' : 'none';
}
```

### Controle de Exibição

```javascript
function checkOnboarding() {
    var cfg = readConfig();
    if (!cfg.onboardingCompleted) {
        document.getElementById('onboarding-modal').style.display = 'flex';
    }
}

function finishOnboarding() {
    document.getElementById('onboarding-modal').style.display = 'none';
    var cfg = readConfig();
    cfg.onboardingCompleted = true;
    writeConfig(cfg);
    // Para animação do mascote
    clearInterval(mascotTalkInterval);
}
```

---

## 3. Componentes Reutilizáveis

### Botão Primário (accent vermelho)

```css
.primary-btn {
    background: #de2246;
    color: #ffffff;
    border: none;
    border-radius: 6px;
    padding: 10px 16px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.15s;
}
.primary-btn:hover { background: #a81834; }
```

### Botão Secundário

```css
.btn-spectrum-secondary {
    background: #2f2f38;
    border: 1px solid #4a4a58;
    color: #e0e0e0;
    border-radius: 4px;
    padding: 7px 14px;
    font-weight: bold;
    font-size: 11px;
    cursor: pointer;
}
.btn-spectrum-secondary:hover { border-color: #666; }
```

### Accordion

```css
.accordion-section {
    background: #282828;
    border: 1px solid #444;
    border-radius: 6px;
    margin-bottom: 8px;
    overflow: hidden;
}
.accordion-header {
    padding: 10px 12px;
    background: #2f2f2f;
    cursor: pointer;
    font-weight: bold;
    color: #f0f0f0;
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.accordion-chevron {
    color: #de2246;
    transition: transform 0.3s;
}
.accordion-section.open .accordion-chevron { transform: rotate(90deg); }
.accordion-body {
    padding: 10px 12px;
    border-top: 1px solid #3a3a3a;
    background: #242424;
    display: none;
}
.accordion-section.open .accordion-body { display: block; }
```

### Tooltip Flutuante

```css
.info-tooltip {
    position: fixed;
    background: #1a1a2e;
    border: 1px solid #de2246;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 10.5px;
    color: #ccccdd;
    line-height: 1.5;
    box-shadow: 0 4px 16px rgba(0,0,0,0.7);
    pointer-events: none;
    max-width: 280px;
    z-index: 99999;
}
```

### Info Row (dashboard)

```css
.row.info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background: #282828;
    border: 1px solid #444;
    border-radius: 6px;
    margin-bottom: 6px;
}
.info-label {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #aaa;
    font-size: 11px;
}
.val-box {
    color: #fff;
    font-weight: 700;
    font-size: 12px;
    background: #1a1a1a;
    padding: 4px 10px;
    border-radius: 4px;
    border: 1px solid #555;
}
```

---

## 4. Padrão do Modal

Todos os modais (export, crop, onboarding) seguem o mesmo container:

```css
.modal {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
}
.modal-content {
    background: #1e1e24;
    border: 1px solid #444;
    border-radius: 10px;
    width: 100%;
    max-width: 340px;
    max-height: 96vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
}
```

---

## 5. Instruções de Implementação

### Replicar o painel num plugin novo

1. **Copie o `index.html` do DrawlapsePS como esqueleto**
2. Mantenha a estrutura: tabs-bar → content-panels → footer
3. Substitua o conteúdo das tabs pelo do novo plugin
4. Mantenha o footer com logo Xuimart + botões de apoio
5. Copie o CSS completo e adapte as classes de conteúdo

### Replicar o wizard

1. Copie o bloco `<!-- GUIA DE PRIMEIRO USO -->` do index.html
2. Adapte os passos: o 0 (idioma) e o último (doação) são fixos
3. Os intermediários descrevem as features do novo plugin
4. Mantenha o mascote no topo com a animação de fala
5. Ajuste `totalSteps` no JS
6. O texto do `speech-bubble-box` muda via `updateMascotSpeech(step)`

### Mascote em outro plugin

O mascote Xuimzinho é compartilhado entre todos os produtos. Use os mesmos
5 PNGs. O avatar é circular com borda vermelha (`border: 2px solid #de2246`),
espelhado horizontalmente (`transform: scaleX(-1)`) pra olhar pro balão.

### SVG em vez de emoji

O IDENTITY_GUIDE proíbe emoji em produção. No wizard do DrawlapsePS eles
aparecem como atalho visual nos feature boxes (🔒, 🔴, ⚙️, 📁, 🎬, ❤️, ☕),
mas em versão final devem ser substituídos por SVGs inline.

Para manter a velocidade de prototipagem: **use emoji durante o desenvolvimento
e substitua por SVG antes da release**.

---

## 6. Princípios de Design

- **Fundo escuro principal:** `#323232` (nunca preto puro)
- **Accent único:** `#de2246` (vermelho Xuimart) — botões, bordas ativas, destaque
- **Texto sobre fundo escuro:** `#e0e0e0` (nunca branco puro)
- **Bordas sutis:** `#444` padrão, `#555` em hover, `#de2246` em foco
- **Border-radius:** 4-6px componentes, 8-10px modais e cards
- **Fonte:** Segoe UI, 13px base, 11px labels, 10px metadata
- **Ícones:** SVG inline, 12-14px, `stroke-width: 2`, `currentColor`
- **Zero scrollbar visível** no content principal (usar `::-webkit-scrollbar` estreito)
- **O mascote é amigável, nunca técnico.** Ele fala em primeira pessoa e usa linguagem
  coloquial. Explicações técnicas vão nos tooltips, não no balão.
- **Cada step faz UMA coisa.** Não combine seleção + explicação no mesmo passo.
- **O wizard deve completar em < 90 segundos.** Se o usuário levar mais, há steps demais.
