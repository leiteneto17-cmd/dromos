# Dromos (+leitura) — Guia de Marca

*Produzido pela skill **brand-designer** · v2 em 2026-07-09 (rebrand claro+azul de 2026-07-06,
CLAUDE.md §2.7) · Complexity Mode: Pequeno (1 página).*
*Fonte de verdade da identidade. As cores refletem os tokens reais de `src/theme/tokens.ts` —
ao mudar o código, atualizar aqui (e vice-versa).*

> **⚠️ SUPERSEDE a v1 (roxo + verde neon, 2026-07-04).** O escuro-neon foi aposentado como
> identidade. O verde sobrevive **apenas** como `success` (estado concluído); o roxo morreu.
> Peles ainda não repintadas (`theme/social.ts` card compartilhável, `theme/kids.ts`) são
> **dívida declarada**, não referência — não copiar delas.

---

## 1. Essência

**Dromos é leitura confortável com energia de comunidade.** Um leitor **claro, arejado e
amigável** — papel e céu, não neon e balada. Referências: **Fluent/Windows 11** (superfícies
brancas, sombras suaves em camadas, cantos arredondados, profundidade discreta) + **Skoob**
(calor de comunidade de leitores brasileira, acessível, sem pose) + leitores maduros
(Kindle/Apple Books). Régua: qualquer tela deve parecer **um lugar bom de ficar 40 minutos
lendo** — se a cor grita, está errada.

Tom em uma frase: **caloroso e motivador, nunca corporativo nem infantil.** Fala como um
amigo que lê muito e torce por você.

---

## 2. Logo

- A logo aprovada (monograma D + livro + linhas de velocidade) é da era escura. **Recolorir a
  logo para claro+azul é PENDÊNCIA** (encomendar ao [[ai-art-director]]); até lá, usá-la
  **sempre dentro da sua "caixa" escura original** — nunca solta sobre o fundo claro.
- **Área de respiro:** manter em volta um espaço ≥ à altura do "+" do "+LEITURA".
- **Don't:** ❌ girar/inclinar · ❌ recolorir na mão (a versão azul será um redesenho, não um
  filtro) · ❌ achatar/esticar · ❌ recriar o D em outra fonte.

---

## 3. Paleta (papéis semânticos — tokens reais de `src/theme/tokens.ts`)

A marca vive no **claro**. Nada de hex solto em tela: **todo uso referencia um papel** via
`useUI()` (`src/theme/ui.ts`).

### 3a. Tema claro (padrão)
| Papel | Token | Hex | Uso |
|---|---|---|---|
| Fundo | `bg` | `#F7F6F2` | papel QUENTE — o "ar" de toda tela (refino 2026-07-10; era `#F4F5F0`, mais frio) |
| Superfície | `surface` | `#FFFFFF` | cards (com `shadow(1–3)` suave, clima acrylic) |
| Superfície alt | `surfaceAlt` | `#F1F2F4` | faixas, inputs, chips inativos |
| Borda | `border` | `#E5E7EB` | hairlines discretas |
| Texto | `text` | `#2A2C33` | tinta principal |
| Texto secundário | `textSecondary` | `#6B7280` | apoio, rótulos, unidades, estados inativos |
| **Acento** | `accent` | `#3A9AD9` | **o azul da marca** — CTA, link, progresso ativo |
| Acento (hover/pressed) | `accentHover`/`accentPressed` | `#2E88C6`/`#2675AE` | feedback + **texto azul pequeno** (ver §3c) |
| Acento suave | `accentSoft` | `#E8F4FB` | fundo de badge/chip ativo/destaque calmo |
| Sucesso | `success` | `#22C55E` | **só estado concluído/positivo** (meta batida, ✓) |
| Aviso / Perigo | `warning`/`danger` | `#F59E0B`/`#EF4444` | alertas; bolinha de notificação |

### 3b. Tema escuro (derivado — leitura noturna do chrome)
Mesmos papéis em `Tokens.color.dark`: fundo `#16181D`, superfície `#1E2127`, acento
`#4AA9E6`, texto `#E7E9EE`. **Não é a marca antiga voltando:** é o MESMO sistema claro+azul,
invertido — sem roxo, sem neon, sem glow.

### 3c. Regra 90-9-1 (a lição do parecer de 2026-07-09)
O antigo 60-30-10 tinha DOIS acentos (roxo detalhe + verde ação); com um acento só, a dose cai:
- **~90% neutro:** `bg` + `surface` + tinta/cinza. É o que faz o app parecer calmo.
- **~9% acento suave:** `accentSoft` em fundos de chip/badge/hero.
- **~1% azul pleno:** `accent` APENAS em (a) 1 CTA principal por tela, (b) links de navegação
  "›", (c) a barra/anel de progresso ativo. **Kicker, unidade, número de nível, pontinho de
  hábito, texto de avatar = cinza/tinta, não azul.**
- **Contraste (AA):** `accent #3A9AD9` sobre branco ≈ 2.9:1 — vale só para texto **grande/bold**
  ou ícone. Texto azul pequeno (links, labels) usa `accentPressed #2675AE` (≈ 4.9:1). Botão
  cheio: fundo `accent` + texto branco **bold ≥ 15px**.

### 3d. Leitor — NÃO É ESTA PALETA
O texto corrido usa sépia/claro/escuro de `src/theme/reading.ts` (regra das duas peles,
CLAUDE.md §2.5). O único elo com a marca no leitor é o acento (`t.accent`), nunca o fundo.

---

## 4. Tipografia

- **Marca / display (wordmark, números grandes, títulos):** **Poppins** — empacotada via
  `@expo-google-fonts/poppins`. Tokens em `BrandFont` (`src/constants/theme.ts`):
  `extrabold`/`bold` no wordmark e números-herói, `semibold` em títulos de seção.
  ⚠️ Em RN cada peso é uma família — usar o token, NÃO `fontWeight` junto.
- **Interface (UI):** escala de `Tokens.type` (display 28 → caption 12), sans do sistema.
- **Leitura (corpo do livro):** serifada (`Fonts.serif`) — conforto em leitura longa (§4.5).
  Empacotar uma serifada de e-reading (ex.: Literata) segue como TODO.
- **Rótulos de seção:** caixa-alta, tracking +0.6, em `textSecondary` (cinza — **não mais**
  lavanda/roxo, e não azul).

---

## 5. Tom de voz (microcopy)

- **Motivador, não cobrador:** "🔥 Mantenha o ritmo", não "Você falhou hoje".
- **Caloroso e direto (vibe Skoob):** frases curtas, 1 emoji quando ajuda, PT-BR natural,
  fala de leitor para leitor.
- **Celebra progresso:** conquista/streak/recap falam no ganho ("42 páginas hoje!").
- **Nunca:** jargão técnico na cara do usuário, tom infantil, ou culpa/pressão (§4.8).

---

## 6. Do / Don't

1. ✅ **Azul = decisão.** Um CTA pleno por tela; links "›"; progresso ativo. O resto respira
   em neutro. ❌ Azul em kicker + badge + unidade + link + barra no MESMO card (foi o erro
   da 1ª repintura do hub).
2. ✅ **Verde = concluído.** `success` só em check, meta batida, estado positivo pontual.
   ❌ Verde como cor de ação/CTA (isso era a marca antiga) · ❌ verde neon (`#5EF0A0`/`#3EE89A`)
   em qualquer tela nova.
3. ✅ **Ativo ≠ inativo, sempre legível:** chip ativo = `accentSoft` de fundo + texto
   `accentPressed`; chip inativo = `surfaceAlt` + `textSecondary`. ❌ Diferenciar estado só
   pela borda com o texto da mesma cor.
4. ✅ **Profundidade Fluent:** cards brancos com `shadow(1|2|3)` e cantos `radius.md–xl`;
   transições 150–250ms (`Tokens.motion`). ❌ Glow, gradiente neon, sombra dura/colorida.
5. ✅ **Chrome claro+azul, leitor sépia/claro/escuro.** As duas peles são de propósito.
   ❌ Levar a paleta da marca para dentro do texto corrido.
6. ✅ **Todo hex passa por token** (`useUI()` / `Tokens`). ❌ Hex cru em componente — foi
   assim que `#22C55E` vazou na barra da missão.
