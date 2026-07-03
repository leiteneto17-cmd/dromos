# AI Framework — Context

> **Manutenção**: este documento resume conteúdo que vive em `governance/`. Atualize-o a cada bump MINOR ou MAJOR do Framework (ver `CHANGELOG.md`) - um resumo desatualizado é pior que não ter resumo. Última atualização: **Framework v1.5.0**, 03/07/2026.

Se você está retomando este framework meses depois, sem contexto da construção original: leia só este documento. Ele é suficiente para reconstruir a arquitetura mental sem percorrer dezenas de arquivos. Para profundidade em qualquer ponto, os documentos de origem estão referenciados em cada seção.

## Visão Geral

Uma biblioteca de 17 skills (Agent Skills, formato `SKILL.md`) que simula uma equipe de engenharia de software completa - estratégia de produto, arquitetura, design, execução, validação e revisão - operável tanto no Claude.ai quanto no Claude Code. Cada skill é um procedimento especializado com responsabilidade única, não um personagem.

## Filosofia (fonte: `FRAMEWORK_PHILOSOPHY.md`)

Oito princípios, dos quais os mais frequentemente aplicados nesta biblioteca foram: **não antecipar problemas** (várias propostas de estrutura extra foram avaliadas e conscientemente adiadas por falta de caso real), **validar antes de abstrair** (uma generalização prematura do Execution Mode teve que ser corrigida), **hipóteses precisam de evidência** (regra só vira oficial após confirmação repetida), e **uma skill, uma missão**.

## Estrutura da Biblioteca

```
Framework Philosophy → Decisions → Library Standards → Skills → Projetos → Validation Report → (loop) novas Decisions
```

Library Standards não é a origem das regras - é a implementação consolidada de Decisions já tomadas. Nunca edite Library Standards diretamente sem uma Decision correspondente.

## Departamentos e Camadas

| Camada | Skills |
|---|---|
| Governança | skill-system-architect, engineering-standards |
| Estratégia | product-strategist, project-director |
| Arquitetura | software-architect, ui-ux-design-director |
| Execução | database-engineer, senior-fullstack-engineer, devops-cloud-engineer, ai-engineer |
| Validação | senior-code-reviewer, qa-automation-engineer, security-engineer, performance-engineer |
| Cross-cutting | debug-specialist, technical-writer |
| Revisão Final | design-critic |

## Tipos de Skill

`Decision` (decide entre alternativas) · `Planning` (transforma escopo em plano) · `Execution` (produz artefato final) · `Review` (audita algo existente) · `Support` (apoia outras skills) · `Research` (investiga e sintetiza) · `Automation` (fluxo determinístico). Cada skill declara o seu no Skill Contract.

## Fluxo Completo (detalhe: `cheatsheets/skills-cheatsheet.md`)

```
product-strategist → project-director ─┬─→ software-architect ──┐
                                        └─→ ui-ux-design-director ┴─→ senior-fullstack-engineer
              database-engineer (dentro da tech do software-architect) ┘
                                                    │
                          ┌─────────────┬───────────┼───────────┐
                          ▼             ▼           ▼           ▼
                  senior-code-reviewer  qa      security   performance
                          └─────────────┴───────────┴───────────┘
                                                    ▼
                                        devops-cloud-engineer
                                                    ▼
                                          design-critic (ao final)
```
`engineering-standards` é consultada (não bloqueante) pela maioria das skills de Execução/Validação. `debug-specialist` e `ai-engineer` entram por demanda, não por etapa fixa.

## Princípios de Design das Skills (fonte: `governance/LIBRARY_STANDARDS.md`)

Toda skill segue a ordem canônica: Papel → Skill Contract → Objetivo → Quando Usar → Quando NÃO Usar → Entradas → Processo (com Complexity Mode) → Artefatos → Regras → Quality Gate. Skill Contract sempre declara Responsabilidade, Entradas, Saídas, Consumidores, Dependências e **Não faz** (a seção que previne overlap). Complexity Mode (Pequeno/Médio/Enterprise) escala profundidade; Execution Mode (lista aberta, hoje só Consulta e Geração têm evidência) escala forma, quando aplicável.

## Decisões Permanentes (fonte completa: `governance/DECISIONS.md`)

- **D-001**: Subagents só na Fase 5 de maturidade, nunca antecipados.
- **D-002**: Dois eixos independentes - Complexity Mode (profundidade) e Execution Mode (forma) - status ainda provisório, aguardando mais confirmação.
- **D-003**: Library Standards é documento de referência embutido em cada skill (`resources/`), não uma skill própria - custo de sincronização manual aceito.
- **D-004**: Code Reviewer audita aderência; QA audita correção funcional; Security audita vulnerabilidade; Performance audita gargalo - quatro lentes, sem overlap.
- **D-005**: Output Type no Skill Contract é opcional, só quando diverge do que o Tipo já indica.
- **D-006/D-007**: Governança em arquivo único (não pasta por entrada) até 15+ entradas; ordem causal corrigida (Decisions antes de Library Standards).

## Experimentos em Aberto (fonte: `governance/VALIDATION_REPORT.md`)

- **Execution Mode** (Consulta/Geração): confirmado em 1 de 1 teste real (projeto +Leitura, `engineering-standards`). Ainda **provisório** - precisa de 2-3 confirmações em contextos diferentes antes de virar regra oficial. Candidatos a próximo teste: `senior-code-reviewer` (Auditoria como Execution Mode?).

## Estado Atual da Biblioteca

17 skills - as 15 de papel originalmente planejadas, completas, mais `skill-system-architect` (elevada do skill-creator built-in) e `engineering-standards` (criada para eliminar redundância). Framework v1.5.0. Última auditoria arquitetural: `FRAMEWORK_AUDIT.md` (nota 9.5/10 - uma referência desatualizada corrigida, uma inconsistência de baixo risco identificada e não corrigida: `skill-system-architect` não tem Skill Contract próprio preenchido). Nenhuma skill em uso real validado ainda além do teste do Execution Mode.

## Como Criar uma Skill Nova

Use a skill `skill-system-architect`. Ela conduz: Classificar (departamento, tipo, duplicação, Execution Mode) → Verificar duplicação → Escrever (Skill Contract obrigatório) → Skill Graph → Quality Gate → Auditoria da biblioteca. Consulta `governance/LIBRARY_STANDARDS.md` automaticamente. Checklist rápido: `templates/new-skill-checklist.md`.

## Como Evoluir o Framework

Nunca edite `LIBRARY_STANDARDS.md` diretamente. O fluxo correto: uso real gera uma entrada em `VALIDATION_REPORT.md` → se confirmado (2-3 casos), vira uma entrada em `DECISIONS.md` → só então é consolidado em `LIBRARY_STANDARDS.md` → `CHANGELOG.md` registra a nova versão. Ver `governance/FRAMEWORK_LIFECYCLE.md` para o diagrama completo. Antes de propor uma mudança estrutural, releia `FRAMEWORK_PHILOSOPHY.md` - se a proposta violar um princípio sem boa razão, pare e questione antes de prosseguir.
