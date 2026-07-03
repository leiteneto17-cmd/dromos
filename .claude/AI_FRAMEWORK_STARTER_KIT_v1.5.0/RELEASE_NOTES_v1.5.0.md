# Release Notes — Framework v1.5.0

Documento narrativo desta versão - o "porquê" e "como foi", em prosa. Para o log técnico linha a linha, ver `CHANGELOG.md`.

## Objetivos da Biblioteca

Transformar uma lista de 15 papéis desejados (Product Strategist, Software Architect, Senior Fullstack Engineer...) numa biblioteca de skills real, com qualidade de Principal/Staff Engineer em cada uma - não descrições soltas de personas, mas procedimentos com contrato explícito, artefato previsível e fronteira clara com as demais.

## Evolução da Sessão

A biblioteca passou por 4 fases visíveis:
1. **Construção inicial** (3 skills, retrabalhadas com feedback detalhado até nível Principal Engineer).
2. **Padronização estrutural** (esqueleto único, Complexity Mode, Skill Contract, Skill Graph) depois que ficou claro que 15 skills sem padrão comum viraria caos.
3. **Correção de rumo em governança** - um subagent foi criado cedo demais, uma taxonomia (Execution Mode) foi generalizada de uma única evidência, um campo (Output Type) cresceu sem necessidade. Todos os três foram identificados e corrigidos, não escondidos.
4. **Conclusão das 15 skills + kit de inicialização** - as 15 originais completas, mais governança suficiente para a biblioteca sobreviver sem a memória desta conversa.

## Principais Decisões

Registradas integralmente em `governance/DECISIONS.md` (D-001 a D-007). As mais consequentes: subagents só depois de gargalo real validado (não antecipados); dois eixos independentes de escala (Complexity Mode e Execution Mode); Library Standards como implementação das decisões, não origem delas.

## Principais Aprendizados

- **Uma auditoria real (uso em projeto) encontra o que uma auditoria de mesa não encontra.** O teste do `engineering-standards` no projeto "+Leitura" revelou 3 lacunas estruturais que nenhuma revisão interna tinha pego.
- **Generalizar de uma evidência é o erro mais fácil de cometer mesmo seguindo os próprios princípios.** O Execution Mode nasceu certo (2 modos validados) e foi imediatamente inflado para 5 modos hipotéticos antes de ser corrigido.
- **Nem toda sugestão de mais estrutura deveria ser aceita.** `COMPATIBILITY.md` e a pasta `governance/decisions/ADR-NNN.md` por entrada foram avaliados e conscientemente adiados - a mesma disciplina que criou o framework também soube dizer não a ele mesmo.

## Limitações Atuais

- Nenhuma skill, exceto `engineering-standards`, foi validada em uso real ainda - `governance/VALIDATION_REPORT.md` tem 1 entrada.
- `skill-system-architect` não tem Skill Contract próprio preenchido (achado da auditoria, não corrigido automaticamente - decisão pendente do usuário).
- O Skill Graph com 17 nós já não cabe num diagrama único legível - foi documentado em camadas separadas (sequencial, validação, cross-cutting) em vez de um só diagrama.
- Execution Mode continua com status "provisório" - só 1 de 1 teste confirmado.

## Roadmap da v1.6 (sugerido, não comprometido)

- Rodar as skills em pelo menos 2 projetos reais adicionais e registrar em `VALIDATION_REPORT.md` - é o que decide se Execution Mode vira regra oficial.
- Decidir o destino do Skill Contract ausente em `skill-system-architect` (preencher, ou declarar exceção formal).
- Se o Skill Graph continuar difícil de ler conforme mais skills forem adicionadas fora da lista original de 15, considerar um diagrama Mermaid visual em vez de ASCII.
- Primeira consideração real de subagent (Fase 5) - só se algum dos testes reais acima expuser um gargalo genuíno de isolamento, provavelmente em `qa-automation-engineer` ou `devops-cloud-engineer` (mais prováveis candidatos por manipularem execução real, não só texto).
