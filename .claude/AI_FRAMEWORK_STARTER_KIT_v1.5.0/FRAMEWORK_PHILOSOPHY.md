# Framework Philosophy

> **Status: Normativo.**

Por que a biblioteca é como é, em uma página. Se uma proposta nova violar um destes princípios sem uma boa razão, pare e questione antes de prosseguir - é pra isso que este documento existe.

## Princípios

1. **Não antecipar problemas.** Resolva o problema que existe, não o que poderia existir. (`COMPATIBILITY.md` foi avaliado e conscientemente adiado por isso - sem caso real ainda.)
2. **Validar antes de abstrair.** Uma abstração nova - um segundo eixo de modo, um subagent, uma skill nova - só nasce depois de um caso real pedir por ela, não antes. (O Execution Mode chegou a ser generalizado cedo demais - de 1 evidência para 5 modos hipotéticos - e teve que ser corrigido.)
3. **Hipóteses precisam de evidência.** Uma descoberta em um teste é uma hipótese, não uma regra. Regra oficial exige confirmação repetida em contextos diferentes (ver `VALIDATION_REPORT.md`).
4. **Uma skill, uma missão.** Se uma segunda missão independente aparece dentro de uma skill, ela deveria ser outra skill, uma referência compartilhada, ou um resource - não crescer dentro da primeira.
5. **Contratos explícitos, sempre.** Toda skill diz o que recebe, o que entrega, quem consome, e o que **não** faz. A seção "Não faz" previne tanto quanto qualquer outra.
6. **Artefatos previsíveis.** A mesma pergunta para a mesma skill deve produzir resposta na mesma estrutura - "depende de quem executa" é o oposto do objetivo.
7. **Começar simples.** A primeira versão cobre bem o caso comum; complexidade se adiciona quando um caso real exige, não preventivamente.
8. **Procedimento acima de persona.** Uma skill é um conjunto de critérios verificáveis (Skill Contract, templates, Quality Gate), não um personagem. Uma calibração de registro é aceitável; uma biografia que substitui critério, não.

## A pilha do framework

```
Framework Philosophy   por que o framework existe (princípios)          [NORMATIVO]
        ↓
Decisions               decisões concretas de governança, uma a uma      [NORMATIVO]
        ↓
Library Standards       as decisões acima, consolidadas em regras       [NORMATIVO]
        ↓
Skills                  construídas seguindo essas regras
        ↓
Projetos                onde as skills são de fato usadas
        ↓
Validation Report       o que o uso real confirmou ou derrubou           [HISTÓRICO*]
        │
        └──────────────→ novas Decisions (o ciclo se fecha aqui)
```

Library Standards não é a origem das regras - é a **implementação** das Decisions. Uma regra nova nunca nasce direto no Library Standards; ela nasce como uma Decision (com alternativas e trade-offs explícitos) e só depois é consolidada lá. Isso já aconteceu de verdade uma vez: D-002 (dois eixos de modo) nasceu do Teste #1 do Validation Report, virou decisão, e só então virou regra no Library Standards - o ciclo completo, não uma hierarquia estática.

**Normativo vs. Histórico**: Framework Philosophy, Decisions e Library Standards dizem **como trabalhar hoje** - são a referência vigente. Validation Report e o `CHANGELOG.md` explicam **como chegamos até aqui** - não são regra, são evidência e histórico. Nunca cite uma entrada do Validation Report como se fosse regra atual; a regra, se confirmada, está em Decisions/Library Standards.

*Exceção temporária: enquanto uma hipótese no Validation Report ainda está "provisória" (não confirmada nem refutada), ela é a fonte mais atual sobre aquele ponto específico - trate como histórico assim que for promovida a Decision ou refutada, não antes.

## Documentos que aplicam esses princípios

- `LIBRARY_STANDARDS.md` — as regras técnicas concretas (este documento não repete o conteúdo de lá). [Normativo]
- `DECISIONS.md` — decisões de governança já assentadas, uma a uma. [Normativo]
- `VALIDATION_REPORT.md` — hipóteses em teste, ainda não promovidas a regra. [Histórico, com a exceção acima]
- `FRAMEWORK_LIFECYCLE.md` — o fluxo completo, de ideia nova a nova versão do framework, em uma página.
- `CHANGELOG.md` — log de versões do framework. [Histórico]
