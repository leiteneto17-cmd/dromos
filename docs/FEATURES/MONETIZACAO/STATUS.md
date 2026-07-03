# MONETIZACAO — Status
*Atualizado: 2026-07-03*

## Estado atual
- **Planos (decididos):** Free com ads · Premium **R$5,90/mês ou R$59,90/ano** (tudo).
  Gating pronto: `store/plan.ts` é a fonte única (`setPlan`); tela `/premium` construída.
- **RevenueCat integrado (commit `3ec4dcb`):** react-native-purchases no dev client
  (reconstruído, módulo nativo OK), configure roda, no-op elegante sem chave.
  BILLING_UNAVAILABLE no emulador é normal (sem Play).
- **AdMob tier grátis COMPLETO e rodando** (IDs de teste): banner (biblioteca/explorar/
  comunidade), intersticial ~10min só ao SAIR do leitor, rewarded opt-in (30min sem ads).
  Gateado por plano; no-op no Expo Go. Fix de build Kotlin via
  `plugins/withKotlinMetadataSkip.js`. Ver [[admob-anuncios]].

## Decisões firmadas (ADR resumido)
- IAP nativo obrigatório via RevenueCat (CLAUDE.md §4.2 — anti-steering).
- Preço R$5,90+ (decisão 2026-07-02, substitui R$9,90).
- Paywall só faz sentido com a voz neural dando "UAU" — a voz É a âncora (TTS/STATUS).
- AdMob real POR ÚLTIMO (depende da conta Play).

## Roadmap / próximos passos (ORDEM OFICIAL de retomada)
1. **⚠️ URGENTE — chave RevenueCat:** o usuário colou a chave SECRETA `sk_...` por engano
   (já removida do app.json, mas foi exposta em bundle/logs). **REVOGAR a sk_ no painel**
   e colar a chave PÚBLICA `goog_...` em `extra.revenueCatAndroidKey` + reiniciar expo.
2. **Conta Google Play (US$25)** — destrava produtos `premium_mensal`/`premium_anual` +
   Offering default + internal testing (RevenueCat) E os IDs reais do AdMob.
3. Confirmar deploy completo do `supabase/schema.sql` (cotas ai/tts dependem dele).
4. AdMob IDs reais (após conta Play): App ID + 3 Ad Units → `src/services/ads/config.ts`
   (`REAL_UNITS`, `USE_TEST_IDS=false`) + app.json. NÃO clicar nos próprios anúncios.
5. Antes de publicar: iOS ATT, Android Data Safety (§4.4), avaliar "continuar como
   convidado"/Sign in with Apple (risco Guideline 5.1.1(v) — login obrigatório, §6).
