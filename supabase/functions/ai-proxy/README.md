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
# 1) pegue uma chave grátis em https://aistudio.google.com/app/apikey
# 2) guarde como segredo (NÃO vai pro git, NÃO vai pro app):
supabase secrets set GEMINI_API_KEY=cole_sua_chave_aqui

# 3) publique a função:
supabase functions deploy ai-proxy
```

Pronto. O app passa a usar a IA grátis por padrão para quem está logado.

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
