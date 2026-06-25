/**
 * Lembretes de leitura via NOTIFICAÇÃO LOCAL (expo-notifications) — IDEIAS-FUTURAS §1b.
 *
 * Notificação agendada no próprio aparelho (NÃO precisa de servidor de push; funciona
 * offline). O usuário escolhe um horário e recebe um lembrete diário para manter o ritmo
 * de leitura/metas. Respeita §2.5 ("zero notificações externas DURANTE a leitura"): é só
 * um lembrete diário no horário escolhido, fora do leitor.
 *
 * BYOK/IA é OPCIONAL aqui (§1b): sem chave, o texto é fixo; com chave, a Fase 2 deste
 * recurso personaliza o texto pelo ritmo. Este módulo só agenda — quem chama passa o texto.
 *
 * Expo Go (SDK 53+): notificações locais têm limitações no Expo Go. O app roda em dev build
 * (CLAUDE.md §3), onde funciona. Detectamos Expo Go para não quebrar e avisar o usuário.
 */
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

/** Identificador estável do lembrete diário (um só; reagendar substitui). */
const DAILY_ID = 'leitura-daily-reminder';

/** true quando notificações locais não são suportadas no ambiente atual (Expo Go). */
export const remindersUnsupported = IS_EXPO_GO;

let handlerSet = false;
/** Mostra a notificação mesmo com o app em primeiro plano (chamar uma vez, cedo). */
export function setupNotificationHandler(): void {
  if (handlerSet || IS_EXPO_GO) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Pede permissão de notificação. Retorna true se concedida. */
export async function requestReminderPermission(): Promise<boolean> {
  if (IS_EXPO_GO) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/**
 * Agenda (ou reagenda) o lembrete diário no horário dado. Cancela o anterior antes.
 * `body` é o texto da notificação (fixo por padrão; a IA pode personalizar — §1b).
 * Retorna true se agendou.
 */
export async function scheduleDailyReminder(
  hour: number,
  minute: number,
  body = 'Hora de ler 📖 — mantenha seu ritmo!',
): Promise<boolean> {
  if (IS_EXPO_GO) return false;
  const ok = await requestReminderPermission();
  if (!ok) return false;
  await cancelDailyReminder();
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_ID,
    content: { title: '+leitura', body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
  return true;
}

/** Cancela o lembrete diário, se houver. */
export async function cancelDailyReminder(): Promise<void> {
  if (IS_EXPO_GO) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(DAILY_ID);
  } catch {
    // não havia nada agendado — ok
  }
}

/** "HH:MM" a partir de hora/minuto (p/ exibir o horário escolhido). */
export function fmtTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
