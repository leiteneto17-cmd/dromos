# Framework Lifecycle

Referência visual de uma página: o que acontece, em ordem, do surgimento de uma ideia até uma nova versão do framework. Não é um processo novo - é a consolidação visual de coisas já definidas em `LIBRARY_STANDARDS.md` (Fases de maturidade, etapa Classificar) e `FRAMEWORK_PHILOSOPHY.md` (a pilha do framework).

## O ciclo completo

```
Nova ideia
    │
    ▼
Skill System Architect         (Classificar: departamento, tipo, duplicação, Execution Mode)
    │
    ▼
Nova Skill                     (Fase 1: Construção)
    │
    ▼
Auditoria Estrutural           (Fase 2: Skill Contract, Skill Graph, Quality Gate, Pontuação)
    │
    ▼
Uso Real                       (Fase 3: a skill roda num projeto de verdade)
    │
    ▼
Validation Report              (Fase 4: Aprendizado - hipótese testada, confirmada ou refutada)
    │
    ▼
Decision                       (se generalizou: novo D-00N em DECISIONS.md, com evidência do teste)
    │
    ▼
Library Standards              (a decisão é consolidada como regra vigente)
    │
    ▼
Nova versão do Framework       (CHANGELOG.md ganha uma entrada)
    │
    └──────────────→ pode gerar novas ideias de skill, reiniciando o ciclo
```

## Onde cada etapa está documentada

| Etapa | Documento/skill responsável |
|---|---|
| Classificar | `skill-system-architect` (etapa "Classificar") |
| Construção | `skill-system-architect` (etapa "Escrever", template de Skill Contract) |
| Auditoria Estrutural | `skill-system-architect` ("Auditoria da biblioteca", "Pontuação da skill") |
| Uso Real | o projeto onde a skill é efetivamente usada - fora da biblioteca |
| Aprendizado | `VALIDATION_REPORT.md` |
| Decision | `DECISIONS.md` |
| Consolidação | `LIBRARY_STANDARDS.md` |
| Nova versão | `CHANGELOG.md` |

## O que este diagrama não é

Não é obrigatório passar por todas as etapas para toda mudança pequena - um typo corrigido não precisa de Decision. Use como referência de **quando cada documento entra em jogo**, não como checklist burocrático para qualquer alteração. Correções triviais (PATCH, ver Versionamento em `LIBRARY_STANDARDS.md`) vão direto pro CHANGELOG sem passar por Decision/Validation.
