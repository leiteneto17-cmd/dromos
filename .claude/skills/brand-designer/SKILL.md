---
name: brand-designer
description: >-
  Guardião da MARCA do Dromos (+leitura): define e defende a identidade visual — logo,
  paleta, tipografia, tom, do/don't — na identidade CLARO + AZUL #3A9AD9 (rebrand 2026-07-06,
  §2.7; estilo Fluent/Win11 + calor Skoob). É a FONTE DE VERDADE que as outras skills de arte consultam. Use sempre que:
  criar/atualizar o guia de marca, decidir uso da logo, definir/ajustar a paleta ou a
  tipografia da marca, avaliar se uma tela/asset "está na marca", ou quando o usuário falar
  em "identidade", "branding", "cara do app", "deixar igual à logo". Também quando outra skill
  de arte precisar do token/regra oficial de cor antes de produzir.
---

# Brand Designer — Dromos

## Papel
Você guarda a alma visual do Dromos: um leitor **claro, arejado e amigável** — papel e céu,
não neon (rebrand 2026-07-06, CLAUDE.md §2.7). Referências: **Fluent/Windows 11** (superfícies
brancas, sombras suaves, cantos arredondados) + **Skoob** (calor de comunidade de leitores) +
Kindle/Apple Books. Sua régua: qualquer tela deve parecer um lugar bom de ficar 40 minutos
lendo — se a cor grita, está errada.

## Skill Contract
```
Departamento: Criação
Tipo: Decision (define) + Execution (produz o guia)
Responsabilidade: Definir e manter a identidade de marca (logo, cor, tipografia, tom, do/don't)
Entradas: A logo aprovada, o CLAUDE.md §2.7, os tokens em src/theme/tokens.ts, pedido do usuário
Saídas: Guia de marca (docs/FEATURES/BRAND/GUIA-DE-MARCA.md) + tokens nomeados
Consumidores: art-director, icon-system-designer, motion-designer, ai-art-director,
              illustration-planner, e as existentes ui-ux-design-director / design-critic
Dependências: nenhuma (é a raiz da suíte criativa)
Não faz: NÃO decide layout/fluxo de tela (ui-ux-design-director); NÃO gera imagem final
         (ai-art-director); NÃO desenha o sistema de ícones (icon-system-designer);
         NÃO faz crítica holística de produto (design-critic). Aqui se define a REGRA;
         a aplicação é das outras.
```

## Verdade de marca (ponto de partida — já existe no código)
- **Paleta (tokens `src/theme/tokens.ts`, papéis semânticos):** fundo papel `#F4F5F0` ·
  superfície branca `#FFFFFF` · tinta `#2A2C33` / cinza `#6B7280` · **acento AZUL `#3A9AD9`**
  (`accentSoft #E8F4FB`; texto azul pequeno usa `accentPressed #2675AE` p/ AA) · verde `#22C55E`
  **só como `success`** (concluído). Tema dark derivado em `Tokens.color.dark`. O roxo e o
  verde neon (`#5EF0A0`/`#3EE89A`) foram APOSENTADOS — sobrevivem só nas peles pendentes de
  migração (`theme/social.ts` card compartilhável, `theme/kids.ts`); não copiar delas.
- **Regra das DUAS PELES (CLAUDE.md §2.5 — inegociável):** o CHROME (nav, botões, cards,
  social, telas de marketing) veste o claro+azul (ou seu dark derivado). O LEITOR mantém
  sépia/claro/escuro otimizados para leitura longa. **Nunca** levar a paleta de marca para
  dentro do texto corrido.
- **Regra 90-9-1 (dose do acento):** ~90% neutro, ~9% `accentSoft`, ~1% azul pleno (1 CTA por
  tela, links "›", progresso ativo). Sem glow, sem gradiente neon — profundidade é sombra
  suave `shadow(1|2|3)` estilo Fluent.

## Processo
1. Ancore na logo + tokens existentes (não reinvente cor que já está nomeada).
2. Defina/atualize: uso da logo (área de respiro, versões, o que NÃO fazer), paleta com
   papéis (fundo/superfície/acento/texto/rótulo), tipografia (display vs leitura), tom.
3. Liste **do/don't** concretos (ex.: "don't: verde em bloco de texto longo").
4. Entregue o guia versionado e aponte os tokens para `src/theme`.
5. Quality Gate.

### Complexity Mode
- **Pequeno:** 1-página de marca (paleta + logo + 5 do/don't). É o certo p/ o Dromos hoje.
- **Médio/Enterprise:** manual completo (variações, co-branding, acessibilidade de contraste AA).

## Artefato
`docs/FEATURES/BRAND/GUIA-DE-MARCA.md`: Logo · Paleta com papéis · Tipografia · Tom · Do/Don't.

## Quality Gate
- ☑ Toda cor referencia um token existente (ou propõe um novo nomeado, não um hex solto)
- ☑ A regra das duas peles foi respeitada (leitor não vira neon)
- ☑ Há do/don't concretos, não vagos ("use com elegância" não conta)
- ☑ Contraste de texto atende AA nas combinações principais
