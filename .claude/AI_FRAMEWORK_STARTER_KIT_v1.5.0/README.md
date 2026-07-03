# AI Framework — Biblioteca de Skills

> O framework é a memória. O executor (Claude, em qualquer sessão) é substituível. Se esta é uma conversa nova sem contexto da construção original, isso não importa - a documentação abaixo é suficiente para retomar.

**Comece por `SESSION_BOOTSTRAP.md`** - é o fluxo obrigatório antes de qualquer alteração. Ele te leva primeiro para `AI_FRAMEWORK_CONTEXT.md`, o documento que reconstrói toda a arquitetura mental do framework em 2-3 páginas.

## Estrutura

```
├── README.md                    você está aqui
├── SESSION_BOOTSTRAP.md         ⭐ comece por aqui - fluxo obrigatório
├── AI_FRAMEWORK_CONTEXT.md      ⭐ o coração do framework - 2-3 páginas
├── LEIA-ME.md                   como instalar + versões
├── FRAMEWORK_PHILOSOPHY.md      princípios, 1 página              [Normativo]
├── FRAMEWORK_AUDIT.md           última auditoria arquitetural      [Histórico]
├── RELEASE_NOTES_v1.5.0.md      narrativa desta versão              [Histórico]
├── CHANGELOG.md                 histórico técnico de versões       [Histórico]
│
├── governance/
│   ├── DECISIONS.md             decisões de governança (D-001...) [Normativo]
│   ├── LIBRARY_STANDARDS.md     constituição técnica               [Normativo]
│   ├── VALIDATION_REPORT.md     hipóteses testadas em uso real     [Histórico*]
│   └── FRAMEWORK_LIFECYCLE.md   o ciclo completo, ideia → nova versão
│
├── cheatsheets/
│   └── skills-cheatsheet.md     as 17 skills em uma tabela
│
├── templates/
│   └── new-skill-checklist.md   checklist rápido pré/pós criação de skill
│
└── skills/                      os 17 .zip, prontos para upload individual
```

## Atalhos

- Vai **usar** as skills num projeto → `cheatsheets/skills-cheatsheet.md` + `LEIA-ME.md`
- Vai **criar/revisar** uma skill → skill `skill-system-architect` + `templates/new-skill-checklist.md`
- Vai **retomar contexto** numa sessão nova → `SESSION_BOOTSTRAP.md`
