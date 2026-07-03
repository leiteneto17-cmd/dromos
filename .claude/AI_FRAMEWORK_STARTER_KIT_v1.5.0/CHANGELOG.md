# Changelog

> **Status: Histórico.** Log de versões - não é regra vigente. A regra vigente vive em `LIBRARY_STANDARDS.md`.

Todas as mudanças relevantes da biblioteca de skills, registradas por versão. Formato inspirado em [Keep a Changelog](https://keepachangelog.com/). "Framework vX.Y.Z" versiona a **biblioteca como um todo**; a `Versão:` dentro do Skill Contract de cada skill versiona **aquela skill isoladamente** - as duas não se sincronizam automaticamente (ver `library-standards.md`, seção Versionamento).

---

## Framework v1.5.1 — 03/07/2026

### Added
- `AI_FRAMEWORK_CONTEXT.md`: documento de 2-3 páginas que reconstrói toda a arquitetura mental do framework - visão geral, filosofia, estrutura, departamentos, tipos, fluxo, Skill Graph resumido, decisões permanentes, experimentos em aberto, estado atual, como criar/evoluir. Nota de manutenção embutida: atualizar a cada bump MINOR/MAJOR.
- `SESSION_BOOTSTRAP.md`: fluxo obrigatório de 7 passos para qualquer sessão nova antes de alterar o framework.
- `templates/new-skill-checklist.md`: checklist condensado de pré/pós-criação de skill, derivado do processo completo do skill-system-architect.
- `RELEASE_NOTES_v1.5.0.md`: documento narrativo da versão (objetivos, evolução, decisões, aprendizados, limitações, roadmap) - distinto do CHANGELOG técnico.

### Fixed
- `senior-code-reviewer` não tinha `resources/library-standards.md` embutido - rodando isolada no Claude.ai, o ponteiro para Library Standards não resolveria em nada. Encontrado rodando o checklist de release real (não apenas descrito), corrigido.

### Changed
- `README.md`: virou ponteiro curto para `SESSION_BOOTSTRAP.md`, em vez de duplicar a ordem de leitura que agora vive só lá.

### Motivation
Fechamento do kit de inicialização, sob o princípio "o framework é a memória, o executor é substituível". Nomenclatura de versão mantida em v1.5.x (não "v1.0" como uma sugestão externa propôs) para não recriar o problema de duas fontes de verdade sobre a versão real - já resolvido nas decisões anteriores sobre Framework version vs. Versão de skill. Checklist de release rodado de fato (zips, Skill Contracts, sincronização de resources/, arquivos referenciados) em vez de apenas declarado - encontrou 1 lacuna real.

---

## Framework v1.5.0 — 03/07/2026

### Added
- `design-critic` (17ª e última skill do roadmap original de 15): revisão holística - avalia coerência entre estratégia, arquitetura, UX, código e roadmap, formato fixo de 5 blocos (👍⚠️🚨💡⭐). Fecha as 15 skills de papel planejadas originalmente.
- `FRAMEWORK_AUDIT.md`: primeira auditoria arquitetural completa da biblioteca (10 perguntas: missão única, overlap, dependência circular, órfã, gargalo, tamanho, previsibilidade, duplicação, referências quebradas, legibilidade do grafo). Nota 9.5/10.
- Kit de inicialização: `README.md` (ponto de entrada, ordem de leitura para retomar contexto sem a sessão original) e `cheatsheets/skills-cheatsheet.md` (as 17 skills em tabela única).

### Fixed
- `qa-automation-engineer`: referência a `devops-cloud-engineer (planejada)` estava desatualizada - ela já existia há duas skills de criação. Encontrado pela auditoria, corrigido.

### Changed
- `LEIA-ME.md`: tabela atualizada com as 17 skills e camadas.

### Motivation
Fechamento do roadmap original de 15 skills de papel. Auditoria pedida explicitamente pelo usuário como "Architecture Review" da própria biblioteca - achou 1 problema real (referência desatualizada) e 1 inconsistência de baixo risco (skill-system-architect sem Skill Contract próprio, não corrigida automaticamente). Kit de inicialização criado sob o princípio "o framework é a memória, o executor é substituível" - uma sessão nova de Claude (ou qualquer outro agente) deve conseguir retomar o contexto só com os documentos, sem precisar da sessão original.

---

## Framework v1.4.0 — 03/07/2026

### Added
- `FRAMEWORK_LIFECYCLE.md` (novo documento): referência visual de uma página do ciclo completo (Nova ideia → Skill System Architect → Nova Skill → Auditoria → Uso Real → Validation Report → Decision → Library Standards → Nova versão), com tabela de "onde cada etapa está documentada".
- Rótulos **Normativo** / **Histórico** em todos os documentos de governança, evitando que um Validation Report antigo seja lido como regra vigente.
- D-007 em `DECISIONS.md`, registrando a correção de causalidade abaixo.

### Changed
- `FRAMEWORK_PHILOSOPHY.md`: a "pilha do framework" foi corrigida - `Decisions` vem **antes** de `Library Standards`, não depois. Library Standards é a implementação consolidada das decisões, não a origem delas. O diagrama agora fecha em loop (Validation Report → novas Decisions) em vez de ser uma hierarquia estática.

### Motivation
Avaliação externa identificou que a ordem original invertia causa e efeito: nenhuma regra desta biblioteca nasceu direto no Library Standards - todas passaram por uma Decision primeiro (confirmado revisando D-002, que nasceu do Teste #1 do Validation Report). Também identificou a necessidade de distinguir documentos que valem como regra hoje (normativos) dos que só registram como chegamos até aqui (históricos), pelo mesmo motivo que motivou o Validation Report ter status provisório - evitar que evidência antiga seja lida como regra atual.

---

## Framework v1.3.0 — 03/07/2026

### Added
- `FRAMEWORK_PHILOSOPHY.md` (novo documento): princípios do framework em uma página, não-técnico, incluindo a "pilha do framework" (Governança → Library Standards → Skills → Projetos) - a 4ª camada que já existia implicitamente e agora está nomeada.
- Pasta `governance/` agrupando os 4 documentos conceituais (`LIBRARY_STANDARDS.md`, `DECISIONS.md`, `VALIDATION_REPORT.md`, `FRAMEWORK_PHILOSOPHY.md`); `CHANGELOG.md` permanece na raiz (log de release, não princípio de governança).
- Mecanismo de promoção Experiment → Decision: `VALIDATION_REPORT.md` ganhou o campo "Promovida para"; `DECISIONS.md` ganhou o campo "Gerada a partir de" - referência cruzada entre os dois documentos quando uma hipótese é confirmada.
- Gatilho documentado de quando migrar `DECISIONS.md`/`VALIDATION_REPORT.md` de arquivo único para pasta por entrada (`governance/decisions/ADR-NNN.md`, estilo Kubernetes KEP/Rust RFC): mais de ~15 entradas, ou dificuldade real de escaneio - não antes.
- `DECISIONS.md`: D-006, registrando a própria decisão de manter arquivo único por enquanto.

### Motivation
Avaliação externa sugeriu adotar desde já uma estrutura de pasta por decisão/experimento (padrão RFC/ADR de projetos como Kubernetes e Rust). O conceito de separar decisão permanente de hipótese experimental já existia (DECISIONS.md vs. VALIDATION_REPORT.md); a proposta de granularidade por arquivo foi avaliada e adiada pelo mesmo princípio que adiou o COMPATIBILITY.md - resolver um problema de escala que ainda não existe com 5 decisões e 1 experimento. Adotada a parte de valor imediato (mecanismo de promoção, agrupamento em `governance/`) sem a máquina completa.

---

## Framework v1.2.0 — 03/07/2026

### Added
- `DECISIONS.md` (novo documento de governança): registro das decisões de arquitetura da biblioteca (Skills antes de Subagents, dois eixos de modo, Library Standards separado, reposicionamento do Code Reviewer, Output Type opcional), no formato Modo de Decisão.
- `library-standards.md`: gatilho documentado de "quando criar `COMPATIBILITY.md`" (deliberadamente não criado ainda - sem caso real de incompatibilidade até agora).
- Rótulo explícito "Framework vX.Y.Z" no CHANGELOG, distinguindo da `Versão:` individual de cada skill.

### Changed
- `Output Type` do Skill Contract passou de obrigatório (8 categorias) para **opcional** (4 categorias: Decision/Artifact/Code/Review), declarado só quando diverge do que o `Tipo` já indica. Removido de 5 skills onde era redundante (product-strategist, software-architect, ui-ux-design-director, senior-fullstack-engineer, senior-code-reviewer); mantido/ajustado em project-director e engineering-standards, onde adiciona informação real.
- `Execution Mode`: lista deixou de ser um enum fechado especulativo (Consulta/Geração/Auditoria/Inicialização/Migração) e virou lista aberta, validada por evidência - hoje só Consulta e Geração têm um caso real. Novo formato de declaração por skill: `Execution Mode suportados: ✓ X ✓ Y`.

### Motivation
Revisão crítica de três decisões da v1.1.0 antes de continuar criando skills novas: Output Type crescendo sem controle, Execution Mode generalizado de uma única evidência (violava a própria regra de não promover hipótese prematuramente), e falta de um registro formal de decisões de governança. Avaliação externa identificou os três problemas; `COMPATIBILITY.md` foi avaliado e conscientemente adiado por não ter caso de uso real ainda.

---

## Framework v1.1.0 — 03/07/2026

### Added
- `engineering-standards`: Modo de Operação (Consulta pontual / Geração de documento oficial), processo de descoberta ativa, `resources/template-padroes-projeto.md`.
- `library-standards.md`: seção "Execution Mode × Complexity Mode" (matriz de dois eixos combináveis, status hipótese provisória), campo "Output Type" na convenção de Skill Contract, seção formal "Fases de maturidade da biblioteca" (Construção → Auditoria estrutural → Uso real → Aprendizado da biblioteca → Subagents).
- `skill-system-architect`: pergunta sobre Execution Mode na etapa "Classificar"; checagem correspondente na "Auditoria da biblioteca"; campos `Versão` e `Output Type` no template de Skill Contract.
- `VALIDATION_REPORT.md` (novo documento da biblioteca): registro persistente de hipóteses testadas em uso real.
- `CHANGELOG.md` (este arquivo).

### Changed
- `engineering-standards`: Skill Contract ganhou `Versão: 1.1.0`; consumidores inexistentes marcados `(planejada)`; tensão de posse com `software-architect` sobre estrutura de pastas resolvida explicitamente.

### Fixed
- `engineering-standards`: regras "responda só o trecho relevante" e "convenção declarada vence default" apareciam repetidas 3-4x dentro do próprio arquivo - deduplicadas.
- `library-standards.md`: typo "prevsummarizable" → "previsível".

### Motivation
Primeira validação real da biblioteca em uso, feita no projeto "+Leitura" via Claude Code. Confirmou que o mecanismo de autoauditoria (Skill System Architect auditando a execução de outra skill) funciona e encontra lacunas reais, não só teóricas.

---

## Framework v1.0.0 — 03/07/2026

### Added
- Retrofit completo de `product-strategist`, `project-director`, `software-architect`, `ui-ux-design-director`, `senior-fullstack-engineer` e `engineering-standards` apontando para `library-standards.md` em vez de repetir regras universais (estimativas em faixa, overengineering como risco).
- `resources/library-standards.md` empacotado dentro de cada uma das 6 skills acima, para que o ponteiro funcione mesmo quando a skill roda isolada no Claude.ai.
- `senior-code-reviewer` criado como skill nova - reposicionado no pipeline como `software-architect → senior-fullstack-engineer → senior-code-reviewer → qa-automation-engineer → devops-cloud-engineer`, com framing de "gatekeeper" (audita aderência a arquitetura/ADRs/SOLID/duplicação/Design System, não caça bugs funcionais).

### Motivation
Marco de "biblioteca coerente": as seis primeiras skills passaram a compartilhar uma única fonte de verdade para regras universais, encerrando a duplicação sistêmica encontrada na primeira auditoria completa.

---

## Framework v0.4.0 — 03/07/2026

### Added
- `skill-system-architect/references/library-standards.md`: documento de governança da biblioteca (não é uma skill) - Princípios, Convenções, Qualidade, Evolução, Camadas da biblioteca.
- Regra da Missão Única (governança de escopo) e Fases de Maturidade "Skills antes de Subagents" no `skill-system-architect` (depois migradas para o library-standards nesta mesma leva).
- Regra do Procedimento, não Personagem.

### Motivation
Correção de rumo: um subagent para `senior-fullstack-engineer` havia sido criado prematuramente, antes de qualquer validação em uso real. A biblioteca precisava de uma constituição própria para regras que se repetiam entre skills individuais.

---

## Framework v0.3.0 — 03/07/2026

### Added
- `senior-fullstack-engineer` (skill de execução) + subagent exploratório correspondente (posteriormente sinalizado como prematuro em v0.4.0).
- `ui-ux-design-director` (Decision, com Modo de Decisão de Design análogo ao Modo de Decisão Arquitetural).

---

## Framework v0.2.0 — 03/07/2026

### Added
- `engineering-standards`: primeira skill de suporte (Support) da biblioteca, criada para eliminar redundância entre `software-architect` e `project-director`.
- `skill-creator` (built-in da Anthropic) elevado a versão customizada `skill-system-architect`: Skill Contract, Skill Graph, Auditoria da biblioteca, Pontuação, tipos de skill (Decision/Planning/Execution/Review/Support/Research/Automation).

### Changed
- `software-architect`: seção "Princípios a aplicar" enxugada, apontando para `engineering-standards` em vez de reexplicar SOLID/Clean/DDD/APIs.
- `project-director`: "Definição de Pronto" passou a referenciar o baseline de `engineering-standards`.

---

## Framework v0.1.0 — 03/07/2026

### Added
- Construção inicial: `product-strategist`, `project-director`, `software-architect` - primeira versão, depois retrabalhada com feedback detalhado do usuário (Viabilidade/Hipóteses/Métricas/Riscos no Product Strategist; Marcos/Definition of Done no Project Director; Objetivos Arquiteturais/Drivers/NFRs/ADRs/Domínios/Observabilidade/Segurança/Evolução/Dívida Técnica/Custos/Roadmap no Software Architect - nível Principal/Staff Engineer).
- Padronização estrutural: esqueleto único (Papel → Skill Contract → Objetivo → Quando Usar → Quando NÃO Usar → Entradas → Processo/Complexity Mode → Artefatos → Regras → Quality Gate) aplicado às três.
- Complexity Mode (Pequeno/Médio/Enterprise) como padrão de escala de profundidade.

### Motivation
Ponto de partida: transformar uma lista de 15 papéis desejados numa biblioteca de skills real, com qualidade de Principal/Staff Engineer em vez de descrições soltas de personas.
