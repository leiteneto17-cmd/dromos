# `ai-proxy` — IA grátis/gerida do +leitura

Proxy seguro que guarda **a nossa chave do Gemini no servidor** (nunca no app —
CLAUDE.md §5/§8) e responde ao dicionário contextual quando o usuário ainda não
trouxe a própria chave (BYOK).

## Por que existe

- O Gemini tem _free tier_ (chave grátis do Google AI Studio, sem cartão).
- Se a chave fosse embutida no app, qualquer um extrairia do APK e abusaria dela.
- Aqui a chave fica como **segredo do Supabase**; o app autenticado chama a função.
- `verify_jwt` fica **ligado** (padrão), então só usuário **logado** gasta a cota.

## Deploy (uma vez)

Pré-requisito: [Supabase CLI](https://supabase.com/docs/guides/cli) e `supabase login`.

```bash
# 1) VÁRIAS chaves Gemini (rotação/resiliência) separadas por vírgula:
supabase secrets set GEMINI_API_KEYS="chave1,chave2,chave3"
#    (ainda aceita a antiga GEMINI_API_KEY com 1 chave)

# 2) OPCIONAL — OpenAI como rede de segurança (usada só se TODAS as Gemini falharem):
supabase secrets set OPENAI_API_KEY="sk-..."

# 3) OPCIONAL — limite diário por usuário (padrão 20):
supabase secrets set AI_DAILY_LIMIT=20

# 4) publique a função:
supabase functions deploy ai-proxy
```

> ⚠️ A **cota por usuário** precisa da tabela `ai_usage` + função `ai_quota_consume`
> do `supabase/schema.sql` (rode o schema). Sem elas, a função **fail-open** (não
> bloqueia) — não quebra, mas também não limita até você rodar o SQL.

Pronto. O app usa a IA grátis por padrão para quem está logado.

## Rotação e cota (resumo)

- **Resiliência:** tenta as chaves Gemini (ordem embaralhada p/ distribuir carga) e,
  se todas saturarem/falharem (429/5xx/rede), cai para a **OpenAI**. Só erra quando
  TODAS falham.
- **Cota:** cada usuário tem `AI_DAILY_LIMIT` chamadas/dia. Estourou → resposta `429`
  com `{ "error": "A IA foi dormir 😴 ...", "quota": true }` (o app mostra a mensagem).

## Contrato

`POST` (via `supabase.functions.invoke('ai-proxy', { body })`)

```jsonc
// body
{ "system": "instruções...", "user": "PALAVRA + PARÁGRAFO", "model": "gemini-2.5-flash-lite", "maxTokens": 700 }
// resposta 200
{ "text": "{...json do dicionário...}" }
// erro
{ "error": "mensagem em PT-BR" }   // 429 = limite da cota grátis atingido
```

Modelos aceitos: `gemini-2.5-flash`, `gemini-2.5-flash-lite` (padrão), `gemini-2.0-flash`.

## Limites e próximos passos

- A cota grátis é **uma só para todos** → ótimo para começar/beta; conforme crescer,
  empurre quem usa muito para **BYOK** (Integrações) ou **premium** (chave nossa com
  billing). Dá para adicionar **limite por usuário** consultando uma tabela no Postgres
  dentro desta função (TODO quando fizer sentido).
