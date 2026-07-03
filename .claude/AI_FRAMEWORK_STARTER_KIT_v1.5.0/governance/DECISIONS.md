# Decisions

> **Status: Normativo.** Cada decisão aqui vale como regra atual até ser explicitamente revisada (ver "Quando revisar" de cada entrada) - não é um arquivo histórico.

Registro de decisões de **governança da biblioteca** (não de um projeto específico usando as skills). Cada entrada existe para não relitigarmos a mesma discussão daqui a alguns meses. Formato igual ao "Modo de Decisão" que várias skills já usam - consistência deliberada.

---

## D-001 — Skills antes de Subagents

**Decisão**: subagents só são criados na Fase 5 do ciclo de maturidade, depois de Construção → Auditoria estrutural → Uso real → Aprendizado. Nunca como upgrade automático de uma skill recém-criada.

**Alternativas consideradas**: criar subagent para cada skill de execução assim que ela nasce (dá isolamento desde o início, mas fixa fronteiras não validadas).

**Trade-offs**: subagent cedo demais isola uma fronteira que ainda pode estar errada, e tem custo real (contexto, permissões, manutenção). Subagent tarde demais deixa uma skill sem isolamento por mais tempo do que idealmente precisaria.

**Recomendação**: esperar o gargalo real aparecer em uso, não antecipar.

**Impacto no curto prazo**: um subagent exploratório para senior-fullstack-engineer, criado antes desta decisão, foi mantido como está (baixo custo de já existir) mas marcado como não-recomendado para uso imediato.

**Impacto no longo prazo**: biblioteca cresce sem acumular subagents especulativos e mal-configurados.

**Quando revisar**: quando a Fase 4 (Aprendizado) de alguma skill Execution/Review/Automation/Research indicar um gargalo real de contexto ou permissão.

---

## D-002 — Dois eixos: Complexity Mode e Execution Mode

**Decisão**: escala de uma skill não é um eixo só. Complexity Mode (profundidade: Pequeno/Médio/Enterprise) e Execution Mode (forma: Consulta/Geração/...) são independentes e combináveis.

**Alternativas consideradas**: manter só Complexity Mode e forçar toda variação de forma dentro dele (ex: "Pequeno = consulta, Enterprise = documento completo") - mais simples, mas confunde profundidade com forma.

**Trade-offs**: dois eixos são mais precisos, mas adicionam um conceito a mais para toda skill nova considerar.

**Recomendação**: manter os dois eixos, mas com Execution Mode como lista aberta e só obrigatório declarar quando a skill realmente atende mais de uma forma de pedido - não forçar em toda skill.

**Impacto no curto prazo**: engineering-standards ganhou o Modo de Operação; o restante das skills não precisou.

**Impacto no longo prazo**: novas skills Support/Review provavelmente vão precisar do mesmo tratamento; skills Decision/Planning/Execution provavelmente não.

**Quando revisar**: status ainda é "hipótese forte/provisória" (ver VALIDATION_REPORT.md) - revisar assim que houver 2-3 confirmações ou a primeira refutação.

---

## D-003 — Library Standards como documento separado, não como skill

**Decisão**: princípios/convenções/qualidade/evolução da biblioteca vivem em `library-standards.md`, um documento de referência (não invocável como skill), consultado pelo skill-system-architect e embutido em `resources/` de cada skill.

**Alternativas consideradas**: (a) manter tudo inline em cada SKILL.md (gerava duplicação e divergência entre skills); (b) criar `library-standards` como uma skill própria (mas ela não decide/produz nada quando invocada sozinha - não tem "Papel" de execução, é pura referência).

**Trade-offs**: como documento embutido em cada skill (não uma skill própria), ele precisa ser copiado manualmente para `resources/` de cada uma sempre que muda - gera N cópias físicas para manter sincronizadas.

**Recomendação**: aceitar o custo de sincronização manual das cópias em troca de cada skill funcionar de forma autocontida quando usada isolada no Claude.ai (onde uma skill não acessa arquivos de outra).

**Impacto no curto prazo**: toda atualização ao library-standards.md exige repropagar a cópia para as N skills que a embutem.

**Impacto no longo prazo**: se N crescer muito (15+), o custo de propagação manual pode justificar automatizar isso com um script.

**Quando revisar**: quando propagar manualmente para todas as skills começar a ser esquecido ou a causar divergência entre cópias - sinal de que precisa de automação.

---

## D-004 — Senior Code Reviewer reposicionado como gatekeeper, não caça-bugs

**Decisão**: `senior-code-reviewer` audita aderência (arquitetura, ADRs, SOLID, duplicação, Design System) - não cobertura funcional. Roda depois de senior-fullstack-engineer e antes de QA no pipeline.

**Alternativas consideradas**: um único "Reviewer" genérico cobrindo tanto aderência estrutural quanto bugs funcionais (mistura duas responsabilidades diferentes na mesma skill).

**Trade-offs**: separar aumenta o número de skills, mas cada uma fica com missão única de verdade (ver Regra da Missão Única).

**Recomendação**: manter separado; QA Automation Engineer (próxima) cobre a lente funcional.

**Impacto no curto prazo**: nenhum - decisão tomada antes da skill existir.

**Impacto no longo prazo**: fronteira clara evita que as duas skills futuras (Code Reviewer e QA) se sobreponham conforme a biblioteca cresce.

**Quando revisar**: se, em uso real, as duas skills constantemente precisarem uma da outra para responder uma pergunta simples - sinal de fronteira mal cortada.

---

## D-005 — Output Type é opcional, não obrigatório

**Decisão**: o campo `Output Type` do Skill Contract só é declarado quando adiciona informação que o `Tipo` sozinho não dá.

**Alternativas consideradas**: (a) obrigatório em toda skill com 8 categorias (primeira versão) - cresce sem controle e majoritariamente repete o Tipo; (b) obrigatório com 4 categorias - ainda gera repetição na maioria dos casos.

**Trade-offs**: campo opcional é menos "completo" visualmente (nem todo Skill Contract mostra Output Type), mas evita ceremônia sem informação nova.

**Recomendação**: opcional, 4 categorias quando declarado (Decision/Artifact/Code/Review).

**Impacto no curto prazo**: removido de 5 das 8 skills existentes (era redundante com Tipo); mantido em project-director e engineering-standards (onde diverge de fato).

**Quando revisar**: se, na prática, times de skills quiserem ler o Skill Graph sem abrir cada SKILL.md e sentirem falta do campo mesmo nos casos "óbvios" - sinal de que vale voltar a ser obrigatório.

---

## D-006 — Governança em arquivos únicos, não pasta por entrada (por enquanto)

**Decisão**: `DECISIONS.md` e `VALIDATION_REPORT.md` continuam como arquivos únicos (log corrido), não uma pasta `governance/decisions/ADR-NNN.md` + `governance/experiments/EXP-NNN.md` com um arquivo por entrada.

**Gerada a partir de**: decisão direta, provocada por sugestão externa de adotar o padrão Kubernetes KEP/Rust RFC desde já.

**Alternativas consideradas**: adotar a estrutura de pasta por entrada agora, já que o padrão é reconhecido e escala bem.

**Trade-offs**: arquivo único é mais fácil de escanear com poucas entradas, mas fica difícil de navegar/referenciar individualmente conforme cresce. Pasta por entrada escala melhor, mas com 5 decisões e 1 experimento é estrutura para um problema que ainda não existe.

**Recomendação**: manter simples agora; o gatilho de quando migrar já está documentado em `VALIDATION_REPORT.md`.

**Impacto no curto prazo**: nenhuma pasta nova, nenhuma migração de conteúdo.

**Impacto no longo prazo**: quando a migração acontecer (gatilho: >15 entradas ou dificuldade de escaneio), vai exigir quebrar os arquivos existentes em vários - custo adiado, não evitado.

**Quando revisar**: no gatilho documentado em `VALIDATION_REPORT.md` ("Quando splitar em arquivos por entrada").

---

## D-007 — Ordem causal correta: Decisions antes de Library Standards

**Decisão**: a pilha do framework passa a ser `Framework Philosophy → Decisions → Library Standards → Skills → Projetos → Validation Report → (loop) novas Decisions`, não `Library Standards → Decisions` como estava antes.

**Gerada a partir de**: observação direta de que Library Standards nunca foi, na prática, a origem de nenhuma regra nesta biblioteca - toda regra lá nasceu de uma Decision (ex: D-002 nasceu do Teste #1 do Validation Report, virou decisão, só depois virou regra no Library Standards).

**Alternativas consideradas**: manter a ordem antiga (Library Standards antes de Decisions), tratando-os como dois documentos paralelos sem ordem causal explícita.

**Trade-offs**: nenhum trade-off real identificado - é uma correção de modelo mental, não uma mudança de comportamento. O único custo é reescrever o diagrama.

**Recomendação**: adotar a ordem causal - deixa explícito que uma regra nova sempre passa por uma Decision documentada antes de virar Library Standards, nunca o contrário.

**Impacto no curto prazo**: `FRAMEWORK_PHILOSOPHY.md` atualizado; nenhuma skill precisou mudar.

**Impacto no longo prazo**: reforça o hábito de sempre registrar a Decision antes de editar o Library Standards diretamente.

**Quando revisar**: se algum dia uma regra precisar entrar direto no Library Standards sem uma Decision correspondente (ex: correção de typo) - nesse caso, não é uma regra nova, é PATCH, e não precisa de Decision (ver `FRAMEWORK_LIFECYCLE.md`, "O que este diagrama não é").

---

## Como adicionar uma nova decisão

```markdown
## D-00N — [título curto]

**Decisão**: [o que foi decidido]
**Gerada a partir de**: [decisão direta / promovida de VALIDATION_REPORT.md, Teste #N - se aplicável]
**Alternativas consideradas**: [ao menos uma real]
**Trade-offs**: [o que se ganha e o que se perde]
**Recomendação**: [por que essa e não a alternativa]
**Impacto no curto prazo / longo prazo**: [...]
**Quando revisar**: [gatilho concreto]
```

Arquivo único por enquanto (log corrido) - ver `VALIDATION_REPORT.md` para o gatilho de quando migrar para um arquivo por decisão (`governance/decisions/ADR-NNN.md`).
