# BRAND — Creative Suite do Dromos
*Criada em 2026-07-04 · 6 skills locais em `.claude/skills/` · departamento Criação*

Time de arte que redesenha a marca do Dromos alinhada à logo (roxo profundo + verde neon,
CLAUDE.md §2.7). Suíte enxuta por decisão do usuário (a lista original de 15 tinha sobreposição
e skills de estúdio de jogo que um app de leitura não usa — Character/Environment/VFX).

## Skill Graph (cadeia de produção)
```
brand-designer  (FONTE DE VERDADE — logo, paleta, tipografia, tom, do/don't)
      │
      ▼
art-director    (aplica e FISCALIZA a linguagem visual entre telas/assets)
      ├──────────────┬──────────────────┬─────────────────┐
      ▼              ▼                  ▼                 ▼
icon-system-    motion-designer   illustration-      ai-art-director
 designer       (→ fullstack       planner           (gera a arte por IA;
 (ícones)         implementa)      (o quê/porquê)     critica e itera)
      └──────────────┴──────────────────┴─────────────────┘
                     ▼  (arte final é gerada pelo)  ▲
                            ai-art-director
Consumidores externos: ui-ux-design-director, design-critic (existentes), senior-fullstack-engineer, loja.
```

## Fronteiras (auditoria de sobreposição — sem duplicar a biblioteca)
- **brand-designer × theme-factory:** theme-factory tematiza artefatos genéricos (slides/docs);
  brand-designer é a identidade do Dromos. Distintos.
- **art-director × design-critic:** design-critic dá veredito HOLÍSTICO de produto (5 blocos);
  art-director cuida da coerência ESTÉTICA. Fronteira declarada no contrato.
- **art-director × ui-ux-design-director:** ui-ux manda na EXPERIÊNCIA/fluxo; art-director na
  ESTÉTICA. Onde brigam, usabilidade vence.
- **ai-art-director × canvas-design:** canvas-design DESENHA a arte via código/SVG; ai-art-director
  dirige geração por IA EXTERNA (prompt+crítica). Escolha pelo meio: código vs gen-AI.
- Sem dependências circulares (brand→art→{ícone,motion,ilustração,ai-art}).

## Regra inegociável (CLAUDE.md §2.7)
Duas peles: o **chrome** (nav, botões, cards, social, loja, ícone do app) veste a identidade
neon-escura; o **leitor** mantém sépia/claro/escuro otimizados para leitura longa. Neon nunca
entra no texto corrido.

## Estado / próximos passos
- [ ] **brand-designer → `GUIA-DE-MARCA.md`** (1º entregável: consolida logo + paleta dos tokens
      `src/theme/social.ts` + tipografia + do/don't). É a base de tudo.
- [ ] **art-director:** auditar as telas atuais contra o guia (o que está fora da marca).
- [ ] **icon-system-designer:** trocar os emojis soltos (nav + 🔥 hábito primeiro).
- [ ] **illustration-planner + ai-art-director:** ícone da loja + onboarding + estados vazios.
- [ ] **motion-designer:** microanimações de maior impacto (streak, Logos, entrar no clube).
