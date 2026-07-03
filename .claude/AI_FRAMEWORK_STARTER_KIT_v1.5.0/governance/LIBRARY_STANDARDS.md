# Library Standards

# Library Standards

> **Status: Normativo.** As regras aqui valem como vigentes até serem revisadas via uma nova Decision (ver `DECISIONS.md`) - este documento é a implementação consolidada das decisões, não a origem delas.

Este documento não é uma skill - é a constituição da biblioteca. Ele reúne os princípios, convenções, critérios de qualidade e regras de evolução que **toda skill deve seguir**, para que essas regras parem de ser repetidas (e potencialmente divergir) dentro de cada skill individual.

Para o "porquê" por trás destas regras, em uma página e sem detalhe técnico, ver `FRAMEWORK_PHILOSOPHY.md` - este documento aqui é a camada operacional logo abaixo dele na pilha do framework (Governança → Library Standards → Skills → Projetos).

Consulte este documento ao criar uma skill nova, ao revisar uma existente, ao decidir se algo deveria virar skill/template/resource/subagent, ou ao arbitrar uma dúvida de fronteira entre duas skills. As skills individuais devem apontar para cá em vez de reexplicar estes princípios.

---

## Princípios

**Responsabilidade única** - uma skill resolve um tipo de decisão/entrega, não várias. Ver "Regra da missão única" abaixo para o teste prático.

**Contratos explícitos** - toda skill declara Responsabilidade, Entradas, Saídas, Consumidores, Dependências e "Não faz" (o Skill Contract). Isso é o que permite a biblioteca crescer sem virar um emaranhado de responsabilidades implícitas.

**Baixo acoplamento** - uma skill depende do mínimo necessário de outras. Quando depende, a entrada esperada é explícita (não "adivinha o contexto"), e a skill funciona (de forma degradada, mas funciona) mesmo se a entrada não vier pronta - sinalizando a lacuna em vez de travar.

**Alta coesão** - tudo dentro de uma skill serve à mesma responsabilidade. Se uma seção poderia ser removida sem enfraquecer a razão de existir da skill, ela provavelmente não pertence ali.

**Artefatos padronizados** - a saída de uma skill segue um formato previsível e replicável (o "Formato de saída" de cada skill), não texto solto reinventado a cada resposta.

**Sem duplicação** - uma regra, convenção ou template existe em um único lugar. Se duas skills precisam da mesma regra, a regra sobe de nível (para este documento ou para uma skill de suporte como engineering-standards), e as duas apontam para ela.

**Complexidade proporcional** - a profundidade da resposta de uma skill escala com a complexidade real do projeto (ver "Maturidade / Complexity Mode" abaixo), nunca entrega o máximo possível por padrão.

**Procedimentos acima de personas** - uma skill é um procedimento especializado (critérios, templates, checklists), não um especialista fictício. Uma frase curta de calibração de registro é aceitável; uma biografia de personagem que substitui critério objetivo não é. Teste: remova toda a linguagem de personagem - a skill ainda funciona, só menos agradável de ler? Se sim, está certo. Se perde função, dependia de encenação demais.

**Começar simples** - a primeira versão de uma skill cobre o caso comum bem, não every edge case imaginável. Complexidade se adiciona quando um caso real exige, não preventivamente.

**Evolução incremental** - skills são revisadas com base em uso real (feedback, gargalos observados), não reescritas inteiras por especulação sobre o que "poderia" ser necessário.

---

## Convenções

### Estrutura de arquivos

```
skills/
  nome-da-skill/
    SKILL.md
    examples/    (opcional - casos de uso ilustrativos)
    resources/   (opcional - templates, scripts, referências grandes)
agents/
  nome-da-skill.md   (subagent - só na Fase 5, ver "Quando criar um Subagent?" abaixo)
```

### Ordem canônica das seções em um SKILL.md

Toda skill segue esta ordem (pular uma seção é aceitável quando genuinamente não se aplica; reordenar não é):

```
Papel
Skill Contract
Objetivo
Quando Usar
Quando NÃO Usar
Entradas
Processo (com Complexity Mode quando a skill escala em profundidade)
[Modo de Decisão - apenas skills tipo Decision]
Artefatos (Sempre entregar / Quando fizer sentido)
Formato de saída
Regras
Quality Gate
```

### Output Type (campo opcional do Skill Contract)

Declare **apenas quando adiciona informação que o `Tipo` sozinho não dá**. Na prática, para a maioria das skills, Output Type seria uma repetição do Tipo (Decision→Decision, Execution→Code, Review→Review) - nesse caso, **não declare o campo**. Declare só quando:
- O Tipo não deixa óbvia a forma do artefato (ex: `Planning` pode virar Roadmap, Documento, ou outra coisa - vale dizer qual).
- O artefato varia conforme o Execution Mode da própria skill (ex: engineering-standards produz coisas diferentes em Consulta vs. Geração).

Quando declarado, use só 4 categorias (menos categorias, menos manutenção):

`Decision` · `Artifact` (documento, template, roadmap, checklist - qualquer coisa persistível que não seja código) · `Code` · `Review`

### Nomenclatura

- Nome da skill: `kebab-case`, substantivo do papel (ex: `software-architect`, não `arquiteto` nem `SoftwareArchitect`).
- O nome da pasta do zip precisa ser idêntico ao `name:` do frontmatter (exigência de upload do Claude.ai).

### Versionamento

Skills não têm um campo de versão no frontmatter (o padrão Agent Skills só exige `name` e `description`), mas registre a versão como texto dentro do Skill Contract **a partir da primeira revisão pós-criação** (a versão inicial `1.0.0` é implícita e não precisa ser escrita; assim que a skill for revisada uma vez, declare `Versão: 1.1.0` e siga daí). Use SemVer:
- **MAJOR**: mudança no Skill Contract (Responsabilidade, Entradas, Saídas ou Consumidores mudam de forma incompatível com quem já consumia a skill)
- **MINOR**: novo artefato opcional, nova seção em "Quando fizer sentido", novo Execution Mode
- **PATCH**: correção de texto, exemplo, ou pequeno ajuste que não muda contrato nem comportamento

**Framework version é diferente de `Versão:` de skill.** O `CHANGELOG.md` da biblioteca versiona a **coleção inteira** (ex: "Framework v1.1.0") - é isso que sobe quando qualquer mudança estrutural relevante acontece (nova skill, mudança no library-standards, novo campo no Skill Contract). Já a `Versão:` dentro de cada Skill Contract versiona **aquela skill isoladamente**. As duas coexistem sem se sincronizar automaticamente: uma release do framework pode não mudar nenhuma skill individual (só o library-standards, por exemplo), e uma skill pode ganhar um PATCH sem que isso justifique subir a versão do framework.

### Maturidade / Complexity Mode

Toda skill cuja saída pode variar em profundidade deve declarar como escala com o porte do projeto, usando os três níveis padrão da biblioteca:
- **Pequeno**: essencial apenas
- **Médio**: adiciona rigor proporcional (governança leve)
- **Enterprise**: cobertura completa (governança formal)

Os nomes e critérios exatos de cada nível são específicos de cada skill (o que é "Pequeno" para Software Architect não é o mesmo que "Pequeno" para Product Strategist) - o que é padronizado é a existência dos três níveis e o princípio de que "Pequeno" nunca deve ser forçado a produzir o que só "Enterprise" precisa.

### Execution Mode × Complexity Mode (matriz de dois eixos)

> **Status: hipótese forte / regra provisória.** Descoberta em 03/07/2026 durante a primeira validação real da biblioteca (projeto +Leitura, teste da skill engineering-standards - ver `VALIDATION_REPORT.md`). Ainda não confirmada em outro contexto. Promova esta seção de "provisória" para regra oficial assim que 2-3 skills adicionais, em contextos diferentes, confirmarem o mesmo padrão - não antes.

A hipótese original era que toda skill escala só em um eixo: profundidade (Complexity Mode). O primeiro teste real derrubou essa hipótese - apareceu um segundo eixo, independente, que decide a **forma** da resposta, não a profundidade.

**Execution Mode é uma lista aberta, não um enum fechado.** Só existem dois modos validados por evidência real até agora:
- **Consulta**: responde um trecho pontual, sem produzir artefato formal.
- **Geração**: produz um artefato completo e persistente (documento, código, configuração).

Não pré-declare modos hipotéticos (ex: "Auditoria", "Inicialização", "Migração") só porque parecem plausíveis - isso repetiria exatamente o erro que originou esta seção: generalizar de uma única evidência. Um novo modo só entra nesta lista quando uma skill real precisar dele de fato. Quando isso acontecer, adicione-o aqui com a mesma referência de origem (qual skill, qual teste).

Cada skill declara quais modos suporta, sem precisar conhecer ou listar os que não usa:

```
Execution Mode suportados: ✓ Consulta  ✓ Geração
```

**Complexity Mode** (profundidade - Pequeno/Médio/Enterprise, ver acima) continua sendo o outro eixo, e só se aplica de fato dentro de modos que produzem artefato (Geração) - Consulta pontual não tem "porte de projeto" a calibrar. Os dois eixos são combináveis: uma skill pode ser "Geração + Enterprise" ou "Consulta + Pequeno".

Nem toda skill precisa declarar Execution Mode - só as que genuinamente atendem mais de uma forma de pedido (tipicamente skills **Support** e **Review**). Uma skill de execução única (ex: senior-fullstack-engineer sempre gera código) não precisa dessa seção. Ao criar/revisar uma skill, **skill-system-architect** deve perguntar explicitamente se ela tem só Complexity Mode ou também Execution Mode - ver a etapa "Classificar" dele.

---

## Qualidade

Estas quatro regras se aplicam a toda skill, sempre - não precisam ser reexplicadas na seção "Regras" de cada uma:

1. **Toda decisão precisa de justificativa.** "Porque é o mais comum hoje em dia" não é justificativa.
2. **Toda decisão importante considera alternativas.** Ao menos uma alternativa real, não um espantalho fácil de descartar.
3. **Nenhuma skill implementa a responsabilidade de outra.** Se a resposta exigiria decidir algo que é "Não faz" de outra skill, sinalize a lacuna em vez de decidir por conta própria.
4. **Toda skill possui um Quality Gate.** Uma autoverificação final antes de responder, específica da skill, não genérica.

Duas regras universais adicionais que antes apareciam repetidas em várias skills e agora vivem só aqui:
- **Estimativas (tempo, esforço, probabilidade) são sempre faixas, nunca números exatos de falsa precisão.**
- **Overengineering é tratado como risco de qualidade tão real quanto código/decisão malfeita** - simplicidade é escolha válida, não ausência de esforço.

---

## Fases de maturidade da biblioteca

```
Fase 1: Construção               - criar as skills
Fase 2: Auditoria estrutural     - validar Skill Contract, Skill Graph, ausência de overlap
Fase 3: Uso real                 - rodar em projetos de verdade
Fase 4: Aprendizado da biblioteca - o projeto real gera conhecimento que melhora o framework,
                                     não só a skill usada (ver VALIDATION_REPORT.md e CHANGELOG.md)
Fase 5: Subagents                - só onde a Fase 4 confirmou um gargalo real de isolamento
```

A Fase 4 é o que fecha o ciclo: uma descoberta feita testando uma skill (como o Execution Mode acima) deve retroalimentar o **library-standards.md** e o **skill-system-architect**, não ficar presa como um ajuste isolado daquela skill. Todo teste real relevante gera uma entrada no `VALIDATION_REPORT.md` (hipótese testada, resultado, ação tomada, status) e uma entrada no `CHANGELOG.md` da biblioteca. Sem isso, o aprendizado se perde na skill individual e não vira maturidade do sistema.

## Evolução

Perguntas para decidir o que criar, quando:

**Quando criar uma Skill?** Quando existe uma responsabilidade reutilizável e delimitável (testa no "Padrão de qualidade" do skill-system-architect) que vai ser invocada repetidamente, em contextos diferentes, não apenas no caso que motivou a ideia.

**Quando criar um Template?** Quando o formato de saída é fixo e não exige julgamento — é preenchimento, não decisão. Um template vive dentro de `resources/` de uma skill existente, não como skill própria.

**Quando criar um Resource/reference?** Quando o conteúdo é grande, consultado apenas em parte das execuções, ou específico de uma variante (ex: `references/aws.md`, `references/gcp.md` dentro de uma skill de deploy). Mantém o SKILL.md principal enxuto (ver Progressive Disclosure).

**Quando criar um Subagent?** Só na Fase 5 do ciclo de maturidade acima, e só quando o gargalo observado na Fase 4 é especificamente falta de isolamento de contexto ou necessidade de permissões de ferramenta restritas - não como upgrade automático de uma skill que "parece pronta".

**Quando dividir uma skill?** Quando a Regra da Missão Única é violada - uma segunda missão independente se formou dentro dela. Sinal prático: uma sub-responsabilidade que seria útil para *outras* skills também, não só para esta.

**Quando aposentar uma skill?** Quando nenhuma skill/uso a consome mais (verificável pelo Skill Graph), quando sua responsabilidade foi inteiramente absorvida por outra skill após uma divisão/fusão deliberada, ou quando o caso de uso que a originou deixou de existir. Aposentar é uma decisão explícita e documentada, não um arquivo esquecido.

**Quando criar um `COMPATIBILITY.md`?** Não agora. Com todas as skills nascendo juntas na mesma versão do framework, não existe ainda nenhum caso real de uma skill antiga divergindo de uma versão nova - criar a matriz agora seria resolver um problema hipotético (viola "Começar simples"). Crie quando acontecer a primeira vez de verdade: uma skill em `Versão: X` deixar de funcionar corretamente junto de uma mudança no framework (ex: um Skill Contract que outra skill mais nova não reconhece mais). Até lá, o `CHANGELOG.md` já registra o suficiente.

**Quando registrar uma decisão em `DECISIONS.md`?** Sempre que uma escolha de governança da biblioteca (não de um projeto específico) for tomada e pudesse razoavelmente ter ido para outro lado - ex: Skills vs. Subagents, formato do Skill Contract, dois eixos de modo. Registre no momento da decisão, não depois - o raciocínio se perde rápido.

---

## Camadas da biblioteca

Além do **Departamento** (granular, no Skill Contract de cada skill) e do **Tipo** (Decision/Planning/Execution/Review/Support/Research/Automation), a biblioteca também se organiza em **camadas** - útil para navegar quando a coleção crescer para 20-30 skills:

```
Governança
├── skill-system-architect
├── engineering-standards
└── library-standards (este documento)

Estratégia
├── product-strategist
└── project-director

Arquitetura
├── software-architect
└── ui-ux-design-director

Execução
├── senior-fullstack-engineer
├── database-engineer      (planejada)
├── devops-cloud-engineer  (planejada)
└── qa-automation-engineer (planejada)

Validação
├── senior-code-reviewer   (próxima)
├── security-engineer      (planejada)
└── performance-engineer   (planejada)
```

A camada Governança não produz artefatos de projeto - produz as regras que as demais camadas seguem. A camada Validação sempre roda depois de Execução, nunca antes ou em paralelo - ela audita aderência ao que já foi decidido nas camadas Estratégia e Arquitetura, não decide por conta própria.
