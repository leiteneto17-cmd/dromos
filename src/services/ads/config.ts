/**
 * IDs e flags do Google AdMob — CENTRALIZADOS num só lugar (CLAUDE.md §6 "Grátis c/ ads").
 *
 * ⚠️ AdMob ≠ AdSense. App mobile usa **AdMob** (admob.google.com), NÃO AdSense (site).
 * O ID de publisher do usuário (`pub-2737028426130313`) é compartilhado entre os dois, mas
 * o app precisa de **App ID** (formato `ca-app-pub-2737028426130313~XXXXXXXXXX`, com `~`) e de
 * **Ad Unit IDs** (com `/`), que só existem depois de criar o app + as unidades no painel do AdMob.
 *
 * ENQUANTO não houver os IDs reais, usamos os IDs de TESTE oficiais do Google (não geram
 * receita, mas mostram anúncios de teste sem risco de "cliques inválidos"/banimento). Quando
 * o app for criado no AdMob, basta:
 *   1. trocar `APP_ID_ANDROID` / `APP_ID_IOS` aqui E em `app.json` (plugin) → rebuild;
 *   2. preencher `BANNER_*` / `INTERSTITIAL_*` / `REWARDED_*` com as unidades reais;
 *   3. pôr `USE_TEST_IDS = false`.
 */
import { Platform } from 'react-native';

/** true = sempre usar os IDs de teste do Google (seguro p/ desenvolvimento). */
export const USE_TEST_IDS = true;

/**
 * App IDs do AdMob (vão TAMBÉM no app.json → plugin react-native-google-mobile-ads).
 * Hoje = App IDs de TESTE do Google. Trocar pelos reais (`ca-app-pub-2737028426130313~...`).
 */
export const APP_ID_ANDROID = 'ca-app-pub-3940256099942544~3347511713'; // teste Google
export const APP_ID_IOS = 'ca-app-pub-3940256099942544~1458002511'; // teste Google

/** Ad Unit IDs REAIS por plataforma (preencher ao criar as unidades no AdMob). */
const REAL_UNITS = {
  banner: { android: '', ios: '' },
  interstitial: { android: '', ios: '' },
  rewarded: { android: '', ios: '' },
} as const;

type UnitKind = keyof typeof REAL_UNITS;

/** Resolve o Ad Unit ID da plataforma atual, caindo no TestId quando em modo teste/sem real. */
export function adUnitId(kind: UnitKind, testId: string): string {
  if (USE_TEST_IDS) return testId;
  const real = Platform.OS === 'ios' ? REAL_UNITS[kind].ios : REAL_UNITS[kind].android;
  return real || testId; // sem unidade real cadastrada → não quebra: usa o de teste
}
