# Validation Report

> **Status: Histórico**, com uma exceção: enquanto uma hipótese aqui está "provisória" (nem confirmada nem refutada), ela é a informação mais atual sobre aquele ponto específico. Assim que for promovida a Decision ou refutada, o registro aqui vira puramente histórico - a regra vigente passa a viver em `DECISIONS.md`/`LIBRARY_STANDARDS.md`.

Registro persistente de testes reais feitos com as skills da biblioteca. Cada entrada documenta uma hipótese testada, o resultado, a ação tomada e o status atual da regra. Este documento é o que transforma um projeto real em aprendizado do framework (Fase 4 de maturidade), não apenas um ajuste isolado da skill usada.

Ao promover uma regra de "provisória" para "confirmada", exija pelo menos 2-3 testes em contextos diferentes confirmando o mesmo padrão - uma única execução, por melhor que seja, é evidência, não confirmação.

---

## Teste #1 — engineering-standards (projeto "+Leitura")

**Data**: 03/07/2026
**Contexto**: Uso real via Claude Code. Pedido: "assuma o papel da Engineering Standards e produza os padrões técnicos oficiais deste projeto", seguido de auditoria pelo Skill System Architect sobre a própria execução.

### Hipótese testada
Skills tipo Support precisam apenas de Complexity Mode (Pequeno/Médio/Enterprise) para calibrar a profundidade da resposta.

### Resultado
**Falsificada.** A skill recebeu um pedido estruturalmente diferente do que seu processo cobria (ela só definia o modo "consulta pontual"; o pedido real era "gerar um documento oficial completo"). Isso expôs um segundo eixo, independente do Complexity Mode: a **forma** da interação (consulta vs. geração vs., potencialmente, auditoria/inicialização/migração).

### Evidência (resumo da auditoria original)
- Skill Contract: claro, ponto mais forte da execução.
- Faltavam as seções "Artefatos" e "Formato de saída" exigidas pela ordem canônica do próprio library-standards.md - a skill violava o padrão que ela mesma referenciava.
- Não havia processo de descoberta ativa (ler CLAUDE.md, git log, estrutura de pastas) antes de aplicar defaults - isso foi iniciativa da execução, não instrução da skill.
- Não declarava Complexity Mode explícito - o calibre foi inferido, não guiado.
- Redundância interna: duas regras repetidas 3-4x dentro do próprio SKILL.md.
- Sem template de saída, o formato do artefato gerado não era prevísivel entre execuções diferentes.

### Ação tomada
- `engineering-standards` atualizado para v1.1.0: seção "Modo de Operação" (Consulta pontual / Geração de documento oficial), processo de descoberta ativa, Complexity Mode aplicado dentro do modo Geração, seções "Artefatos" e "Formato de saída" adicionadas, `resources/template-padroes-projeto.md` criado, regras duplicadas removidas, consumidores planejados marcados explicitamente, tensão de posse com software-architect sobre estrutura de pastas resolvida por escrito.
- `library-standards.md` atualizado: nova seção "Execution Mode × Complexity Mode" (matriz de dois eixos combináveis), campo "Output Type" adicionado à convenção de Skill Contract, typo corrigido ("previsível").
- `skill-system-architect` atualizado: etapa "Classificar" ganhou a pergunta explícita sobre Execution Mode; "Auditoria da biblioteca" ganhou a checagem correspondente; template de Skill Contract ganhou os campos Versão e Output Type.

### Status da regra
**Hipótese forte / regra provisória.** Confirmada em 1 de 1 teste até agora. Aguardando 2-3 testes adicionais, em skills e contextos diferentes, antes de virar regra oficial não-provisória do library-standards. Próximos candidatos naturais a testar: `senior-code-reviewer` (Auditoria como Execution Mode?) e uma futura skill de inicialização/scaffold (Inicialização como Execution Mode?).

**Promovida para**: ainda não. Quando confirmada, esta entrada deve gerar uma nova entrada em `DECISIONS.md` (formato Modo de Decisão) referenciando este teste como evidência, e a seção "Execution Mode" do `library-standards.md` deixa de ter o aviso "hipótese forte/provisória".

---

## Como adicionar uma nova entrada

Ao rodar um teste real relevante (Fase 3/4), copie este formato:

```markdown
## Teste #N — [skill testada] (projeto "[nome]")

**Data**: [data]
**Contexto**: [o que foi pedido, em que ambiente]

### Hipótese testada
[o que a biblioteca assumia até este teste]

### Resultado
[Confirmada / Falsificada / Parcialmente confirmada - com o porquê]

### Evidência
[o que a execução/auditoria mostrou, resumido]

### Ação tomada
[o que foi corrigido, em quais arquivos]

### Status da regra
[Hipótese forte / provisória / confirmada - e o que falta para promovê-la]

### Promovida para
[Ainda não / D-00N em DECISIONS.md, quando confirmada]
```

## Quando splitar em arquivos por entrada

Hoje `DECISIONS.md` e este `VALIDATION_REPORT.md` são arquivos únicos (formato "log corrido"). Isso é deliberado - com poucas entradas, um arquivo único é mais fácil de escanear do que navegar entre vários. Migre para um arquivo por entrada (`governance/decisions/ADR-NNN.md`, `governance/experiments/EXP-NNN.md`, ao estilo Kubernetes KEPs/Rust RFCs) quando **qualquer** destes acontecer primeiro: mais de ~15 entradas em um dos arquivos, ou o arquivo único começar a ser difícil de escanear/referenciar. Não faça essa migração preventivamente - é o mesmo raciocínio que adiou o `COMPATIBILITY.md`.
