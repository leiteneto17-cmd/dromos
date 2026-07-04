# Dromos (+leitura) — Guia de Marca
*Produzido pela skill **brand-designer** em 2026-07-04 · Complexity Mode: Pequeno (1 página).*
*Fonte de verdade da identidade. As cores refletem os tokens reais de `src/theme/` — ao mudar
o código, atualizar aqui (e vice-versa). Regra maior: CLAUDE.md §2.7.*

---

## 1. Essência
**Dromos é leitura com energia.** Não um leitor genérico: um app **premium, escuro, com pulso
neon** que faz a pessoa ler mais e melhor. A logo diz isso em três signos: o **D** (monograma),
o **livro aberto** (leitura) e as **linhas de velocidade** verdes (ritmo, progresso, hábito — o
"Strava da leitura"). Régua: reconhecer o Dromos por um recorte de 1cm² de qualquer tela.

Tom em uma frase: **caloroso e motivador, nunca corporativo nem infantil.** Fala como um amigo
que lê muito e torce por você.

---

## 2. Logo
- **Versão principal:** ícone (D+livro+linhas) sobre fundo escuro, com o duplo glow roxo/verde.
- **Área de respiro:** manter em volta um espaço ≥ à altura do "+" do "+LEITURA".
- **Assinatura:** wordmark "Dromos" (sans geométrico pesado) + "+LEITURA" em caixa-alta espaçada.
- **Don't:** ❌ girar/inclinar · ❌ trocar as cores do glow · ❌ pôr sobre fundo claro ou ocupado
  sem a "caixa" escura · ❌ achatar/esticar · ❌ recriar o D em outra fonte.

---

## 3. Paleta (com papéis — tokens reais)
A marca vive no **escuro premium**. Duas camadas de token, por finalidade:

### 3a. Marca / artefatos fixos — `src/theme/social.ts` (`Social`)
Card compartilhável, trilha do livro, gradiente de marca. **Roxo→verde fixo**, não cansam porque
são peças, não telas.
| Papel | Token | Hex |
|---|---|---|
| Fundo topo (gradiente) | `Social.purpleTop` | `#3B2A63` |
| Fundo meio | `Social.purpleMid` | `#241B3D` |
| Fundo base (quase-preto) | `Social.dark` | `#0E0B16` |
| Superfície de card | `Social.card` / `cardSoft` | `#1B1530` / `#221A3A` |
| Borda | `Social.border` | `#2E2247` |
| **Verde destaque (glow)** | `Social.green` / `greenDeep` | `#7DF3AD` / `#3EE89A` |
| Rótulo lavanda | `Social.lavender` | `#B9A6E8` |
| Texto branco-gelo | `Social.white` | `#EDEAF5` |
| Texto apagado | `Social.muted` | `#8B82A8` |

### 3b. Chrome do app — `src/theme/ui.ts` (`UIThemes`, regra 60-30-10)
Telas sociais/hub/perfil: base **neutra** com a marca como **acento** (evita fadiga do roxo 100%).
- **60% base:** `bg` grafite `#121214` (escuro) / off-white `#F8F9FA` (claro).
- **30% camada:** `card` `#1E1B24` / `#FFFFFF`.
- **10% acento:** **roxo** em detalhes (`purple` `#9D8AD4`/`#6E4FB0`, títulos de seção, abas
  inativas, ícones) e **verde** nas ações (`green` `#5EF0A0` escuro / `#0FA968` claro — o verde
  fecha no claro por contraste).

### 3c. Leitor — NÃO É ESTA PALETA
O texto corrido usa sépia/claro/escuro de `src/theme/reading.ts`. **Neon nunca entra no leitor**
(§2.7). O único elo com a marca no leitor é o acento (`t.accent`), não o fundo.

---

## 4. Tipografia
- **Marca / display (wordmark, números grandes, títulos):** **Poppins** — geométrica arredondada,
  EMPACOTADA via `@expo-google-fonts/poppins` (§4.5 resolvido). Tokens em `BrandFont`
  (`src/constants/theme.ts`): `extrabold`/`bold` no wordmark e números-herói, `semibold` em
  títulos de seção. ⚠️ Em RN cada peso é uma família — usar o token, NÃO `fontWeight` junto.
- **Interface (UI):** sans do sistema (`Fonts.sans`) — legível e nativo em iOS/Android.
- **Leitura (corpo do livro):** **serifada** (`Fonts.serif`) — conforto em leitura longa (§4.5).
  Ainda do SISTEMA (`ui-serif`) — empacotar uma serifada de e-reading (ex.: Literata) é o próximo TODO.
- **Rótulos de seção:** caixa-alta, tracking positivo (+0.6), na cor lavanda/roxo.

---

## 5. Tom de voz (microcopy)
- **Motivador, não cobrador:** "🔥 Mantenha o ritmo", não "Você falhou hoje".
- **Caloroso e direto:** frases curtas, 1 emoji quando ajuda, PT-BR natural.
- **Celebra progresso:** conquista/streak/recap falam no ganho ("42 páginas hoje!").
- **Nunca:** jargão técnico na cara do usuário, tom infantil, ou culpa/pressão (§4.8).

---

## 6. Do / Don't
1. ✅ **Verde = ação e conquista.** Só em CTA, número de destaque, estado ativo, streak.
   ❌ Verde em bloco de texto longo ou em tudo — mata o brilho.
2. ✅ **Roxo = detalhe e categoria** (rótulos, ícones, abas inativas, divisórias).
   ❌ Fundo 100% roxo em tela de uso longo (a `ui.ts` existe justamente p/ evitar isso).
3. ✅ **Glow com parcimônia:** brilho no logo, número-herói, CTA principal.
   ❌ Glow em cada card/borda — vira ruído e pesa no render.
4. ✅ **Chrome escuro-neon, leitor sépia/claro.** As duas peles são de propósito.
   ❌ Levar o dark-neon para dentro do texto — é fadiga ocular, não marca.
5. ✅ **Contraste AA:** texto branco-gelo/lavanda sobre escuro; verde FECHADO (`#0FA968`) no claro.
   ❌ Verde neon claro como texto sobre fundo claro (não passa contraste).
