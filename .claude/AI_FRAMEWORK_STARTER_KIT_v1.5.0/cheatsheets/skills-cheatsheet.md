# Skills Cheatsheet

Referência rápida das 17 skills da biblioteca. Para o contrato completo de cada uma, abra o `SKILL.md` correspondente em `skills/`. Para os princípios por trás da biblioteca, veja `FRAMEWORK_PHILOSOPHY.md`; para as regras técnicas completas, `governance/LIBRARY_STANDARDS.md`.

## Governança (não fazem parte do pipeline de um projeto)

| Skill | Tipo | Quando usar |
|---|---|---|
| `skill-system-architect` | Meta | Criar/revisar/auditar skills desta própria biblioteca |
| `engineering-standards` | Support | Convenções de nomenclatura, commits, testes, DoD - consultada por quase todas as outras |

## Estratégia

| Skill | Tipo | Quando usar | Não faz |
|---|---|---|---|
| `product-strategist` | Decision | Validar uma ideia, definir persona/MVP/monetização | Planejar execução, decidir arquitetura |
| `project-director` | Planning | Quebrar escopo em backlog, marcos, prioridade | Validar negócio, decidir arquitetura |

## Arquitetura

| Skill | Tipo | Quando usar | Não faz |
|---|---|---|---|
| `software-architect` | Decision | Escolher stack, desenhar arquitetura, ADRs | Implementar código |
| `ui-ux-design-director` | Decision | Fluxos, wireframes, design system, acessibilidade | Implementar componentes |

## Execução

| Skill | Tipo | Quando usar | Não faz |
|---|---|---|---|
| `database-engineer` | Decision | Modelar esquema, índices, migrações, queries | Escolher a tecnologia de banco |
| `senior-fullstack-engineer` | Execution | Implementar componentes, APIs, hooks | Decidir arquitetura ou convenções |
| `devops-cloud-engineer` | Execution | CI/CD, containers, deploy, monitoramento | Decidir estratégia de observabilidade |
| `ai-engineer` | Decision | Integrar LLM, RAG, agents, prompts | Decidir arquitetura geral do sistema |

## Validação (4 lentes sobre o código já implementado)

| Skill | Lente | Quando usar |
|---|---|---|
| `senior-code-reviewer` | Aderência (arquitetura/ADRs/SOLID) | Revisar PR contra padrões já decididos |
| `qa-automation-engineer` | Correção funcional | Testes unitários/integração/E2E, cobertura |
| `security-engineer` | Vulnerabilidade | OWASP, LGPD, auth, exposição de dados |
| `performance-engineer` | Gargalo | Diagnosticar lentidão, priorizar otimização |

## Cross-cutting (acionadas por sintoma ou demanda, não por etapa fixa)

| Skill | Tipo | Quando usar |
|---|---|---|
| `debug-specialist` | Research | Investigar erro/stacktrace/bug reportado |
| `technical-writer` | Execution | README, docs de API, onboarding, changelog do projeto |

## Revisão Final

| Skill | Tipo | Quando usar |
|---|---|---|
| `design-critic` | Review | Avaliação crítica holística - produto + arquitetura + UX + código + roadmap juntos |

## Fluxo sequencial típico

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

`engineering-standards` é consultada (não bloqueante) por quase todas as skills de Execução e Validação. `debug-specialist`, `technical-writer` e `ai-engineer` entram quando o contexto pedir, não em ponto fixo da sequência.
