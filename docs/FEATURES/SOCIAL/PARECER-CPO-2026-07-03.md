# Parecer CPO: Clube do Livro vs. estratégia de retenção (2026-07-03)
*Skill chief-product-officer · provocação do usuário: "vencer Kindle/Goodreads/Audible em experiência"*

## Contexto e estágio
Pré-lançamento, **~0 usuários** (sem conta Play; distribuição só via dev client). Isso reescala
tudo: **feature social só vale com densidade de rede** — clube vazio é vitrine do deserto.
Arsenal single-player JÁ CONSTRUÍDO: streak, desafios, recap, metas+coach, conquistas, card
compartilhável. O que o loop de hábito diário (Fogg/Hooked) revela: temos ação, recompensa e
investimento — **falta o GATILHO (trigger)**. Nenhuma notificação existe. Duolingo provou que
"streak em risco" é a alavanca de retenção mais barata do mercado.

## Estratégia blank-slate ("fazer milhões lerem todos os dias") em 1 parágrafo
Gatilho: push no horário pessoal de leitura (perguntado no onboarding — implementation
intention) + "streak em risco" à noite + recap no domingo. Ação: abrir JÁ no livro atual,
meta mínima de 5 min (tiny habits). Recompensa variável: streak, conquistas-surpresa, recap.
Investimento: vocabulário, notas, metas, clube. Growth: card compartilhável + convite duo.
**Comparação com o roadmap atual:** o app já tem ~80% disso construído; o roadmap (clube
primeiro) constrói o loop social-semanal ANTES de fechar o loop diário. A estratégia
blank-slate retém mais porque completa o loop diário primeiro — com 1 sessão de esforço.

## Avaliação (RICE: R,I 0–3 · C 0–1 · E sessões · score=R×I×C/E)
| Feature | Loop | R | I | C | E | Score | Veredito |
|---|---|--|--|--|--|--|---|
| Notificações de hábito (streak em risco + horário pessoal + recap dom.) | diário | 3 | 3 | .9 | 1 | **8.1** | **CONSTRUIR JÁ** — fecha o gatilho do loop; infra expo-notifications já mapeada |
| Onboarding boas-vindas + "quando você lê?" | diário/D1 | 3 | 2 | .8 | 1 | **4.8** | **CONSTRUIR** — já estava no backlog como "opcional"; promover |
| Desafio a dois (duo por link de convite) | social+growth | 2 | 3 | .7 | 2 | **2.1** | **CONSTRUIR depois** — social que funciona com N=2 e traz aquisição embutida; reusa `desafios.ts` |
| Clube GUIADO (reformulado: cronograma por capítulos + perguntas de discussão por IA — vale com N=1) | social/conteúdo | 2 | 2 | .6 | 3 | 0.8 | **REFORMULAR** — é o clube que faz sentido pré-rede |
| Clube do Livro como planejado (ROADMAP-CLUBE) | social | .5 | 3 | .5 | 4 | 0.19 | **ADIAR** (não matar) — Impact alto SÓ com rede; gatilho de retomada: app nas lojas + primeiras dezenas de usuários ativos |

## Recomendação final (ordem das próximas ~5 sessões)
1. **Notificações de hábito** (1 sessão) → 2. **Onboarding + horário de leitura** (1 sessão)
→ 3–4. **Desafio duo com convite** (2 sessões) → 5+. **Clube guiado** (a fatia C1 do schema
continua válida — nada do plano técnico se perde, muda o QUANDO e o formato do MVP).
Backlog do clube original fica intacto em ROADMAP-CLUBE.md para quando houver rede.

## Saúde (§4.8)
Notificações: no máx. 1/dia + desligável (anti-spam); nada durante leitura (§2.5). Streak
com "proteção" (1 folga/semana) para não punir a vida real — aversão à perda sem crueldade.
Duo/clube: privacidade por padrão mantida.

**Decisão pendente do usuário:** aceitar o reordenamento (hábito antes de clube) ou manter
clube primeiro. O parecer recomenda reordenar; quem decide é o Paulo.
