# +leitura — Padrões de Engenharia (oficial)

> Produzido pela skill **engineering-standards** em 2026-07-03.
> Fonte de verdade para convenções técnicas transversais do projeto. Skills de execução e
> revisão (software-architect, senior-fullstack-engineer, senior-code-reviewer…) consultam
> este documento em vez de redefinir padrões.
>
> **Precedência:** convenções já declaradas no `CLAUDE.md` e decisões registradas em
> `docs/MEMORIA-PROJETO.md` **vencem** qualquer default. Este documento consolida as duas
> coisas: o que já foi decidido + os defaults que preenchem as lacunas.
>
> **Porte do projeto (Complexity Mode): Pequeno→Médio** — MVP solo, pré-lançamento nas lojas.
> Padrões abaixo são proporcionais a isso; não exigir governança enterprise.

---

## 1. Idioma (declarado — CLAUDE.md §8)

- **PT-BR em tudo:** conversa, documentação, comentários de código, mensagens de commit,
  textos de UI.
- Identificadores de código (variáveis, funções, tipos) podem ser em inglês quando for o
  idioma natural da API/stack (`useReadAloud`, `getBookProgress`) — o repo já mistura
  (`/estatisticas`, `dictionary-basic.ts`); ambos são aceitos, **não renomear em massa**.

## 2. Nomenclatura (TypeScript / React Native)

| Elemento | Convenção | Exemplo do repo |
|---|---|---|
| Arquivos (não-componente) | `kebab-case.ts` | `dictionary-basic.ts`, `use-read-aloud.ts` |
| Hooks | `use-*.ts`, função `useCamelCase` | `use-read-aloud.ts` |
| Componentes | `PascalCase` (função e export) | `BionicText` |
| Variáveis/funções | `camelCase` | `consumeTtsQuota()` |
| Constantes | `UPPER_SNAKE_CASE` | `MAX_TTS_CHARS_DAY` |
| Rotas (Expo Router) | `kebab-case` em PT-BR quando for URL visível | `src/app/estatisticas.tsx` |
| Tabelas/funções SQL (Supabase) | `snake_case` | `curated_books`, `tts_quota_consume` |

- Nomes descrevem **o quê**, não o como (`getActiveBooks`, não `loopBooksAndFilter`).

## 3. Estrutura de pastas (declarada — CLAUDE.md §3, atualizada pelo repo real)

```
/src
  /app         → telas e navegação (Expo Router file-based; substitui a antiga /screens)
  /components  → UI reutilizável (Reader, BionicText, cards…)
  /services    → integrações (TTS, IA/dicionário, DB, sync, supabase)
  /hooks       → hooks reutilizáveis
  /store       → estado global (Zustand)
  /theme       → temas sépia/claro/escuro + identidade roxo+verde (social/stats)
  /constants   → constantes compartilhadas
/supabase/functions → Edge Functions (ai-proxy, tts-proxy)
/docs          → documentação viva do projeto
```

- Organização é **por tipo técnico** (decisão do projeto — vence o default "por domínio").
- Regra prática: lógica que fala com o mundo externo vive em `/services`; tela nunca chama
  `fetch`/SDK direto — chama um service.
- Módulos nativos que quebram o Expo Go (ex.: `expo-notifications`, RevenueCat) entram por
  **require preguiçoso** dentro do service, nunca por import no topo (memória do projeto).

## 4. Commits (declarado pelo uso — histórico do repo)

- **Conventional Commits em PT-BR:** `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`,
  `perf:`, `test:` e o tipo extra já em uso no projeto: **`security:`**.
- Primeira linha curta, no presente/imperativo, descrevendo o valor para o usuário
  (estilo do repo: `feat: voz neural gerida (Azure via tts-proxy) — âncora do premium`).
- **Um tipo por commit.** `fix+feat:` (já ocorreu) fica proibido daqui em diante — dividir
  em dois commits.
- Corpo opcional explica o **porquê**, não o quê (o diff mostra o quê).
- Branches: `main` estável; trabalho em branches descritivas (`checkpoint/…`, `feat/…`).
  Nunca commitar direto em `main` sem o incremento estar testável.

## 5. Definition of Done (adaptada ao fluxo do projeto — CLAUDE.md §8)

Um incremento só está "pronto" quando:

1. **Testável pelo usuário** no fim do bloco — o Paulo testa cada passo no aparelho/emulador
   (regra central do projeto: incrementos pequenos e verificáveis).
2. **Roda no Expo Go OU no dev client**, conforme o alvo declarado da feature — e o desvio
   está documentado (ex.: "só funciona em build de release").
3. **Funciona nas duas plataformas** (iOS + Android) ou a limitação está registrada por
   escrito antes de assumir que funciona (CLAUDE.md §8).
4. **Sem segredo no cliente** (ver §8 abaixo).
5. **Documentado quando a decisão não é óbvia:** decisões de arquitetura/produto vão para
   `CLAUDE.md` ou `docs/MEMORIA-PROJETO.md`; o código recebe comentário só onde a intenção
   não é legível.
6. **Sem regressão conhecida** nos fluxos críticos: abrir livro (EPUB/PDF), Ouvir (escada
   de vozes), dicionário, sessão de leitura/stats, login.

## 6. Política de testes (proporcional ao porte)

- **Hoje (MVP):** o teste primário é o **teste manual do usuário** por incremento + smoke
  test dos fluxos críticos acima. Não há suíte automatizada — isso é aceito como dívida
  consciente, não esquecimento.
- **Quando automatizar (gatilho, não data):** ao preparar a Fase 4 (lojas), criar testes
  unitários para lógica pura de negócio — cálculo de PPM/streak, cota de TTS, parser
  Bionic, gating premium — pois são as áreas onde regressão silenciosa custa caro.
- **Integração/E2E:** só para os fluxos críticos, e só depois que houver build de release
  estável. Não testar UI exaustivamente — caro de manter.

## 7. Tratamento de erros

- **Erros esperados** (sem rede, cota estourada, chave inválida) → mensagem clara em PT-BR
  para o usuário + caminho de saída (ex.: 429 do proxy de IA sugere BYOK/premium — padrão
  já decidido no CLAUDE.md §5).
- **Degradação silenciosa é permitida só onde já foi decidida:** a escada de voz
  (ElevenLabs BYOK → neural gerida → voz do aparelho) cai de degrau **sem alarde**; demais
  features avisam o usuário quando degradam.
- **Erros inesperados** nunca são engolidos: `console.warn/error` com contexto (operação,
  livro/tela, causa) em dev; nas Edge Functions, logar com contexto no lado do servidor.
- **Nunca** incluir em log: chaves de API (BYOK ou nossas), tokens de sessão, texto de
  livro do usuário, e-mail. O que a pessoa lê é dado sensível (CLAUDE.md §4.8).

## 8. Segredos e privacidade (declarado — CLAUDE.md §5/§8, inegociável)

- **Nenhuma chave nossa embarcada no app.** Chaves geridas (Gemini, Azure TTS) vivem só em
  Edge Functions (`ai-proxy`, `tts-proxy`).
- **Chave BYOK do usuário** só em `expo-secure-store` (Keychain/Keystore) — nunca em
  AsyncStorage, nunca sincronizada ao Supabase, nunca logada. Validar com chamada barata
  antes de salvar.
- **Privado por padrão** em tudo que é social (visibilidade de atividade, perfil).
- Toda tabela nova no Supabase nasce **com RLS** — sem exceção (lição do fix de
  enumeração de `profiles`).

## 9. Custo de IA/TTS como padrão de código (declarado — CLAUDE.md §5)

- **Cachear sempre:** áudio TTS + timings e respostas de dicionário nunca são regerados
  para o mesmo (trecho | palavra+contexto).
- Enviar à IA **só o necessário** (parágrafo + palavra, nunca o livro).
- Toda feature nova que consome IA/TTS declara na revisão: o que cacheia, o que consome de
  cota, e o que acontece no 429.

## 10. Performance de leitura (declarado — CLAUDE.md §4.6 + lição do karaokê)

- Nunca renderizar o livro inteiro: virtualizar/paginar.
- Bionic Reading memoizado — não reprocessar a cada render.
- **Regra do karaokê (lição 2026-06-20):** nada de re-render de texto em alta frequência
  (~4×/s) — causa ANR. Destaques mudam no máximo 1× por parágrafo/frase; avaliar
  alternativas nativas antes de aumentar a frequência.
- Julgamento de performance só vale em **build de release / aparelho físico**, não no
  emulador em modo dev.

## 11. Documentação

- `CLAUDE.md` = decisões vivas e regras (atualizar a cada decisão nova, com data).
- `docs/MEMORIA-PROJETO.md` = detalhes/histórico técnico das decisões.
- `docs/IDEIAS-FUTURAS.md` = backlog aprovado da Fase 6.
- Comentário no código só para o "porquê" não óbvio (ex.: por que o require é preguiçoso).

## 12. Versionamento

- App: versão do `app.json`/`package.json` segue **SemVer**; incrementar `MINOR` por pacote
  de features testável, `PATCH` por rodada de fixes. Build numbers das lojas gerenciados
  pelo EAS na Fase 4.

## 13. Princípios gerais

- SOLID como lente (separar responsabilidade quando dói), não como checklist.
- **Overengineering é risco real:** decisão explícita do projeto — *"não montar
  infraestrutura complexa antes de o app validar no mercado"* (escada de TTS, 2026-07-02).
  Simplicidade é escolha válida.
- Estimativas sempre em faixa, nunca número exato de falsa precisão.

---

*Documento vivo — atualizar quando uma convenção mudar. Convenção nova declarada pelo
usuário sempre vence o que está aqui.*
