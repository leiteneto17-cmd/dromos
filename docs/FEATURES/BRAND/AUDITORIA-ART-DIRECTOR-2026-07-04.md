# Auditoria de coerência visual — art-director (2026-07-04)
*Skill art-director · telas atuais vs `GUIA-DE-MARCA.md`. Ordenado por quão gritante.*

## Diagnóstico geral
O app está **meio-marcado**: a paleta certa existe em `src/theme`, mas o CHROME mais visível
usa cores fora dela, e a fonte de marca (Poppins) só chegou a 2 lugares. Resultado: não parece
"feito pela mesma mão". Não achei neon vazando para dentro do leitor (regra das duas peles OK).

> **✅ P1 + P2 CONCLUÍDOS (2026-07-04):** nav e ícones agora usam `Social.green` (#5EF0A0);
> `icon.tsx` BRAND_* alinhados (#6E4FB0/#5EF0A0); link azul → roxo da marca; near-black
> `#14121C` unificado em `Social.dark` (#0E0B16). Nenhum `#00FF66`/`#3c87f7`/`#7C3AED`/`#14121C`
> restou no código. Falta: P3 (token danger) e P4 (rollout da fonte de marca).

## 🔴 P0 — ACHADOS DO TESTE NO APARELHO (2026-07-04, prints)
- **Home/hub é VERDE-DOMINANTE** (`hub.ts` `grad: #2C7E5E→#1B4F3D` + `neon #3DFF85`). Contradiz a
  marca (roxo→preto, verde de ACENTO). É o MAIOR motivo de o app "não sentir Dromos" — a tela mais
  vista tem fundo verde. **Decisão do usuário:** repintar a Home para roxo→preto (recomendado) ou
  manter o hub verde aprovado antes. Bloqueia o P4 na Home.
- **Card transparente AINDA sai PRETO** no export (print confirma). O fix de clipping (P3) NÃO
  resolveu — é o view-shot Android perdendo alpha de verdade. Precisa de OUTRA abordagem de captura
  (não é ajuste de estilo). Item à parte, reaberto.

## P1 — Cores OFF-BRAND no chrome mais visível (gritante — corrigir já)
1. **Barra de navegação** (`src/components/app-tabs.tsx`): usa `#00FF66` (verde PURO berrante) na
   aba ativa, no glow e no ícone central. **A marca é verde-menta `#3EE89A`/`#5EF0A0`**, não neon
   puro. É o elemento MAIS visto do app, no verde errado. → trocar por `Social.greenDeep`.
2. **Sistema de ícones** (`src/components/icon.tsx`): define `BRAND_NEON = #00FF66` e
   `BRAND_PURPLE = #7C3AED` — tokens "de marca" FALSOS (não batem com a logo). → alinhar a
   `#5EF0A0` (verde) e `#9D8AD4` (roxo do `ui.ts`).
3. **Link/acento** (`src/components/themed-text.tsx`): `#3c87f7` (AZUL). Não existe azul na marca.
   → verde ou roxo conforme o papel do texto.
4. **Badge** (`src/app/(tabs)/index.tsx`): `#FF4D4F` solto. → token de danger (ver P3).

## P2 — Near-black DUPLICADO
`#14121C` aparece solto em 4 telas (comunidade, clube, clubes, compartilhar — parte escrita
recentemente) enquanto o token é `Social.dark = #0E0B16`. Dois pretos quase iguais = dívida.
→ unificar no token. (Obs.: o CLAUDE.md §2.7 citou #14121C; o CÓDIGO manda — padronizar em #0E0B16.)

## P3 — Semânticas sem token
- `#E5484D` (13×) = vermelho de erro/perigo, repetido à mão. → criar `danger` no tema.
- `#FFFFFF` (11×) = branco solto. → usar `Social.white`/token conforme o caso.

## P4 — Tipografia meio-marcada (o maior para "mesma mão")
Só o wordmark do card e os títulos de seção usam `BrandFont`. Há **~300 textos pesados**
(`fontWeight` 700–900) ainda na fonte do sistema, em ~25 telas. **Regra (art-director):**
- **BrandFont** → só DISPLAY: títulos de tela (~28px), números-herói (stats/streak), títulos
  de card. `extrabold`/`bold` no herói, `semibold` em títulos.
- **Fonts.sans (sistema)** → corpo, botões, labels, legendas. Poppins em TUDO pesa e atrapalha
  a leitura — display ≠ corpo.
- Rollout é mecânico (troca `fontWeight` por `fontFamily: BrandFont.*` nos spots de display).

## Sequência recomendada
1. **P1 + P2** (cores do chrome): mecânico, altíssimo impacto visual, baixo risco — o app já
   "vira Dromos" só com isso (nav e ícones no verde certo).
2. **P3** (tokens danger/white).
3. **P4** (rollout da fonte de marca nos títulos/números — tela a tela).
4. Depois: `icon-system-designer` (trocar emojis) e `motion-designer`.
