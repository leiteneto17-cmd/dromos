# New Skill Checklist

Checklist rápido de pré/pós-voo. Não substitui o processo completo da skill `skill-system-architect` (Classificar → Verificar duplicação → Escrever → Skill Graph → Quality Gate → Auditoria) - é uma verificação condensada para confirmar que nada foi pulado.

## Antes de escrever

- [ ] Consultei `cheatsheets/skills-cheatsheet.md` - a responsabilidade não existe, parcial ou totalmente, em outra skill?
- [ ] Departamento definido
- [ ] Tipo definido (Decision/Planning/Execution/Review/Support/Research/Automation)
- [ ] Ela tem só Complexity Mode, ou também Execution Mode? (não invente modo sem evidência real - ver `governance/LIBRARY_STANDARDS.md`)

## Ao escrever

- [ ] Ordem canônica das seções seguida (Papel → Skill Contract → Objetivo → Quando Usar → Quando NÃO Usar → Entradas → Processo → Artefatos → Regras → Quality Gate)
- [ ] Skill Contract completo: Responsabilidade, Entradas, Saídas, Consumidores, Dependências, **Não faz**
- [ ] "Não faz" resolve qualquer tensão de posse com skill(s) vizinha(s)
- [ ] Complexity Mode declarado, se a profundidade da resposta varia
- [ ] Formato de saída fixo e previsível (ou, se o artefato é código, seção Artefatos clara)
- [ ] Regras universais (estimativa em faixa, overengineering como risco) **não** repetidas - apontar para `resources/library-standards.md`

## Depois de escrever

- [ ] `resources/library-standards.md` copiado pra dentro da skill (necessário para uso isolado no Claude.ai)
- [ ] Validado com `quick_validate.py`
- [ ] Skill Graph atualizado/comunicado (quem alimenta, quem consome)
- [ ] Se esta skill substitui um consumidor "(planejada)" em outra skill já existente, atualizar essa referência agora
- [ ] `CHANGELOG.md` ganhou uma entrada
- [ ] Zip gerado com o nome da pasta = `name:` do frontmatter (exigência do Claude.ai)
