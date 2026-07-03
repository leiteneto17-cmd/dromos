# Framework Audit — 03/07/2026

Auditoria arquitetural completa da biblioteca (17 skills: 15 de papel + skill-system-architect + engineering-standards). Não procura bugs de conteúdo - procura arquitetura. Baseada em dados extraídos diretamente dos arquivos (grep/wc), não em impressão.

## 1. Todas têm missão única?

Sim, com uma ressalva. As 17 têm uma frase de `Responsabilidade` coerente com um único propósito verificável (ver tabela abaixo). A ressalva: `skill-system-architect` não tem um Skill Contract preenchido para si mesma - o bloco `Responsabilidade/Entradas/Saídas/Consumidores` que aparece nela é o **template genérico de exemplo**, não a autodescrição da própria skill. Ironia notada: a skill que exige Skill Contract de todas as outras não tem o seu. Baixo risco (ela é a meta-skill, não uma skill de projeto), mas inconsistente com a própria regra.

## 2. Existe overlap?

Não, overlap real nenhum encontrado. Os pontos de maior risco (que exigiram fronteira explícita no "Não faz" na hora de criar) foram todos resolvidos por escrito:
- `senior-code-reviewer` (aderência) vs. `qa-automation-engineer` (correção funcional) vs. `security-engineer` (vulnerabilidade) vs. `performance-engineer` (gargalo) - quatro lentes sobre o mesmo código, sem sobreposição de pergunta.
- `software-architect` (escolhe tecnologia de banco) vs. `database-engineer` (modela dentro da tecnologia escolhida).
- `engineering-standards` (define convenções gerais) vs. `technical-writer` (documenta, não redecide convenções).

## 3. Existe dependência circular?

Não, no sentido problemático (deadlock: A precisa de B pronto para existir e B precisa de A). O campo `Dependências` de todas as 17 forma um grafo acíclico.

Existem, sim, **loops de feedback esperados** (não é defeito): `senior-fullstack-engineer → senior-code-reviewer/qa-automation-engineer/security-engineer` e de volta `→ senior-fullstack-engineer` para correção. Isso é o ciclo normal de implementar → revisar → corrigir, presente em qualquer pipeline de engenharia real - diferente de uma dependência circular de definição.

## 4. Existe Skill órfã?

Não. Toda skill declara um consumidor real (outra skill) ou "usuário final" (para as terminais: `technical-writer`, `design-critic`, `devops-cloud-engineer`). Nenhuma tem `Consumidores` vazio ou apontando para algo inexistente.

## 5. Existe gargalo?

Sim, um estrutural e esperado: **`senior-fullstack-engineer`** é o nó de maior fan-in do grafo - recebe entrada direta de `project-director`, `software-architect`, `ui-ux-design-director`, `database-engineer`, `engineering-standards`, e recebe correções de volta de `senior-code-reviewer`, `qa-automation-engineer`, `security-engineer`, `performance-engineer`, `ai-engineer`, `debug-specialist`. Isso é esperado - é literalmente "o executor", tudo converge para implementação - mas é o ponto único onde uma falha de contrato afetaria mais skills de uma vez. Nenhuma ação necessária agora; é o candidato nº 1 a observar na Fase 4 (Aprendizado) se algum gargalo real de isolamento aparecer (ver `LIBRARY_STANDARDS.md`, critério de quando criar subagent).

## 6. Existe Skill enorme demais?

Uma clara outlier: `skill-system-architect` com 649 linhas contra uma faixa de 97-173 nas demais. Julgamento: **justificada, não é violação da Regra da Missão Única** - é a meta-skill herdando o mecanismo completo de eval/benchmark da skill-creator original da Anthropic, uma única missão (meta-engenharia de skills) só que mecanicamente detalhada. Já usa progressive disclosure corretamente: `references/` (library-standards.md, schemas.md), `scripts/`, `agents/`, `eval-viewer/` - não é tudo empurrado pro SKILL.md. Nenhuma ação necessária.

Das 16 restantes, todas na faixa 97-173 linhas - sem outlier real.

## 7. Todas produzem artefatos previsíveis?

15 de 17 têm seção `Formato de saída` explícita com template fixo. As 2 exceções são esperadas, não lacuna:
- `senior-fullstack-engineer`: produz código, não documento - previsibilidade vem da seção `Artefatos` (sempre entregar / quando fizer sentido), não de um template markdown.
- `skill-system-architect`: é a meta-skill, seu "artefato" é o processo de criação em si (Interview → Research → Write → Test → Iterate), não um documento de projeto.

## 8. Existem templates duplicados?

Não. Comparação por hash de cada bloco "Formato de saída" entre as 15 skills que têm um - todos únicos, nenhuma cópia literal de template entre skills diferentes.

## 9. Existem referências quebradas?

Uma encontrada e corrigida nesta auditoria: `qa-automation-engineer` ainda marcava `devops-cloud-engineer` como "(planejada)", mas ela já existia há duas skills de criação. Corrigido. Nenhuma outra referência a skill inexistente encontrada (busca por todo nome em `**negrito**` cruzado contra as pastas reais).

## 10. O grafo continua compreensível?

Sim, mas está no limite de caber numa visualização única. Com 17 nós, o grafo linear simples das primeiras 5-6 skills já não representa bem a estrutura atual - ela tem 3 formas de conexão diferentes que precisam ser lidas separadamente:

```
SEQUENCIAL (constrói):
product-strategist → project-director ─┬─→ software-architect ──┐
                                        └─→ ui-ux-design-director ┴─→ senior-fullstack-engineer
database-engineer (dentro da tech do software-architect) ─────────┘

VALIDAÇÃO (4 lentes paralelas sobre o que foi implementado):
senior-fullstack-engineer ─┬─→ senior-code-reviewer   (aderência)
                            ├─→ qa-automation-engineer  (correção)
                            ├─→ security-engineer       (vulnerabilidade)
                            └─→ performance-engineer    (gargalo, delega p/ database/devops)
                                        ↓
                              devops-cloud-engineer (fim da execução técnica)

CROSS-CUTTING (acionadas por sintoma ou por demanda, não por etapa fixa):
debug-specialist, ai-engineer, technical-writer

CONSULTADAS (não bloqueantes, referenciadas por várias):
engineering-standards

REVISÃO FINAL (roda por cima de tudo, no fim):
design-critic
```

Recomendação: se a biblioteca crescer além de ~20 skills, vale um diagrama visual (Mermaid) em vez de ASCII - mas ainda não é o caso.

## Veredito Geral

Nenhum problema estrutural grave. Um achado real corrigido nesta auditoria (referência desatualizada). Uma inconsistência de baixo risco identificada e não corrigida automaticamente (skill-system-architect sem Skill Contract próprio) - decisão de correção fica com o usuário, ver observação abaixo.

**Nota**: 9.5/10. A ressalva de meio ponto é a inconsistência do item 1 - pequena, mas é exatamente o tipo de coisa que a própria skill-system-architect ensinaria a não deixar passar em qualquer outra skill.
