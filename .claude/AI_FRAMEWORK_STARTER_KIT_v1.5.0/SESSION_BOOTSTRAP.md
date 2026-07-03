# Session Bootstrap

Fluxo obrigatório antes de fazer qualquer alteração neste framework numa conversa nova. Não pule etapas mesmo que pareçam óbvias - o objetivo é garantir que a mudança respeita o que já existe, não redescobrir do zero.

## Fluxo

1. **Ler `AI_FRAMEWORK_CONTEXT.md`** - visão geral completa em 2-3 páginas. Se só puder ler um arquivo, é este.
2. **Ler `FRAMEWORK_PHILOSOPHY.md`** - os 8 princípios, 1 página.
3. **Ler `governance/LIBRARY_STANDARDS.md`** - as regras técnicas concretas (Skill Contract, Complexity Mode, Execution Mode, convenções).
4. **Ler `governance/DECISIONS.md`** - decisões já assentadas, para não relitigar o que já foi decidido.
5. **Ler `governance/VALIDATION_REPORT.md`** - hipóteses em teste; verificar se alguma tem status "provisório" relevante à tarefa atual.
6. **Resumir o estado atual em 3-4 frases** antes de agir - quantas skills existem, qual a versão do Framework, o que está em aberto. Isso confirma que o contexto foi absorvido corretamente antes de mudar qualquer coisa.
7. **Só então começar** a nova alteração - criar skill, revisar skill, ou propor mudança de governança.

## Se a tarefa for criar/revisar uma skill

Use a skill `skill-system-architect` diretamente - ela conduz o processo completo (Classificar → Verificar duplicação → Skill Contract → Skill Graph → Quality Gate). Consulte `cheatsheets/skills-cheatsheet.md` primeiro para confirmar que a skill não existe parcialmente em outra.

## Se a tarefa for mudar a governança (Library Standards, Decisions)

Não edite `LIBRARY_STANDARDS.md` diretamente. Siga o ciclo em `governance/FRAMEWORK_LIFECYCLE.md`: evidência real → `VALIDATION_REPORT.md` → confirmação (2-3 casos) → `DECISIONS.md` → só então `LIBRARY_STANDARDS.md`. Releia `FRAMEWORK_PHILOSOPHY.md` antes - se a mudança antecipa um problema que ainda não aconteceu, ela provavelmente deveria esperar.

## Checklist antes de encerrar a sessão

- [ ] `AI_FRAMEWORK_CONTEXT.md` ainda reflete o estado real (se mudou algo estrutural, atualize-o)
- [ ] `CHANGELOG.md` tem uma entrada para a mudança
- [ ] Skills tocadas tiveram a `Versão:` do Skill Contract incrementada (SemVer - ver Library Standards)
- [ ] Nenhuma referência a skill como "(planejada)" ficou desatualizada, se algo novo foi criado
