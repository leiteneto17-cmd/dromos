/**
 * Estado global da biblioteca (Zustand) com persistência MANUAL e síncrona
 * via arquivo (expo-file-system). Lê na inicialização (`textSync`) e regrava a
 * cada mudança. Guarda: livros, livro aberto, posição de leitura e o banco de
 * vocabulário. Tudo sobrevive ao recarregar/fechar (CLAUDE.md §3, §2.3).
 *
 * Os arquivos dos livros ficam em `Paths.document` (permanente) — ver explore.tsx.
 *
 * POR USUÁRIO (2026-06-21): o arquivo de estado é **por conta** (`leitura-library-<uid>.json`).
 * Sem isso, duas contas no MESMO aparelho compartilhavam sessões/stats (bug do teste de
 * seguir). Ao trocar de usuário (login/logout), recarrega o arquivo da conta. Migração:
 * na 1ª vez, o arquivo antigo (`leitura-library.json`) é adotado pela 1ª conta e removido.
 */
import { File, Paths } from 'expo-file-system';
import { create } from 'zustand';

import { FontSizeRange, type ReadingThemeName } from '@/theme/reading';
import { useAuth } from './auth';

/**
 * Preferências do LEITOR (persistidas) — antes eram estado local que resetava a cada
 * abertura. Inclui tema/fonte/Bionic e os controles de ACESSIBILIDADE (intensidade do
 * Bionic, entrelinha e espaço entre letras — apoio a Dislexia/TDAH, IDEIAS-FUTURAS §4).
 */
export type ReaderPrefs = {
  theme: ReadingThemeName; // 'claro' | 'sepia' | 'escuro'
  fontSize: number;
  bionic: boolean;
  /** Fração das letras em negrito no Bionic (0.35 leve · 0.45 médio · 0.55 forte). */
  bionicRatio: number;
  /** Multiplicador da entrelinha (1.0 normal · 1.2 amplo · 1.45 muito amplo). */
  lineSpacing: number;
  /** Espaço entre letras em px (0 normal · 0.6 médio · 1.2 amplo). */
  letterSpacing: number;
};

const DEFAULT_READER_PREFS: ReaderPrefs = {
  theme: 'sepia',
  fontSize: FontSizeRange.default,
  bionic: true,
  bionicRatio: 0.4,
  lineSpacing: 1.0,
  letterSpacing: 0,
};

export type BookFormat = 'epub' | 'pdf';

export type ImportedBook = {
  id: string;
  name: string;
  /** Título real do livro (do metadado do EPUB), quando conhecido. Cai em `name` se faltar. */
  title?: string;
  fileName: string;
  uri: string;
  mimeType?: string;
  size?: number;
  format: BookFormat;
  addedAt: number;
  text?: string;
  extractError?: string;
  /** Capa real (uri local extraída do EPUB ou baixada do catálogo). Sem isso, cai no bloco 📖. */
  coverUrl?: string;
};

export type VocabWord = {
  id: string;
  word: string;
  /** Parágrafo de origem (base para o significado contextual por IA — Fase 2). */
  context?: string;
  bookId?: string;
  bookName?: string;
  addedAt: number;
};

/** Marcador de página salvo pelo usuário (leitura contínua → guarda offset + índice). */
export type Bookmark = {
  id: string;
  /** Offset de rolagem (px) — salto sem travar (não usa scrollToIndex). */
  offset: number;
  /** Parágrafo no topo quando marcou (p/ % e trecho). */
  index: number;
  /** Trecho do parágrafo para reconhecer o marcador. */
  snippet: string;
  /** Progresso (0–1) no momento da marcação. */
  progress: number;
  createdAt: number;
};

/** Grifo (highlight) — trecho EXATO selecionado pelo usuário no leitor, dentro de um
 * parágrafo. Base do "card de citação de verdade" (§2.6) e do marca-texto persistente. */
export type Highlight = {
  id: string;
  /** Índice do parágrafo onde está o grifo. */
  index: number;
  /** Offset (char) de início no parágrafo. */
  start: number;
  /** Offset (char) de fim (exclusivo) no parágrafo. */
  end: number;
  /** O trecho exato grifado (já limpo) — vai direto pro card de citação. */
  text: string;
  createdAt: number;
};

export type ReadingStats = {
  /** Tempo total de leitura, em segundos. */
  totalSeconds: number;
  /** Segundos lidos por dia (chave = 'YYYY-MM-DD') — base p/ média/dia e dias seguidos. */
  perDay: Record<string, number>;
};

/**
 * Sessão de leitura (estilo Strava — vira uma "atividade", §2.6). Guardada localmente
 * (offline-first) e depois sincronizada para o Supabase (`reading_activities`) quando
 * o usuário está logado. Cada período contínuo no leitor finaliza uma sessão.
 */
export type ReadingSession = {
  id: string;
  bookId: string;
  bookTitle: string;
  format: BookFormat;
  /** Tempo de leitura da sessão, em segundos. */
  seconds: number;
  /** Páginas equivalentes lidas (estimativa por parágrafos — §4.9). */
  pages: number;
  startedAt: number;
  createdAt: number;
  /** true quando já foi enviada ao Supabase. */
  synced: boolean;
  /** id da linha no Supabase (após o sync). */
  remoteId?: string;
};

/** Tema da camada social (não confundir com os temas do leitor — §2.5/§2.7). */
export type UITheme = 'system' | 'light' | 'dark';

/** Lembrete de leitura (notificação local diária — IDEIAS-FUTURAS §1b). */
export type ReminderConfig = {
  enabled: boolean;
  /** Hora local (0–23) do lembrete diário. */
  hour: number;
  /** Minuto local (0–59) do lembrete diário. */
  minute: number;
};

/** Meta de leitura (Fase 6). O usuário cria um objetivo com prazo; a app calcula o ritmo
 * necessário por dia (recalcula sozinha = cronograma adaptativo). Concluir = conquista. */
export type GoalKind = 'minutos' | 'dias' | 'livro';
export type Goal = {
  id: string;
  kind: GoalKind;
  title: string;
  /** Alvo: minutos (kind='minutos') ou dias de leitura (kind='dias'). 0 p/ 'livro' (= terminar). */
  target: number;
  /** Prazo final 'YYYY-MM-DD' (data local). */
  deadline: string;
  createdAt: number;
  /** Dia 'YYYY-MM-DD' da criação — base p/ contar só o progresso a partir daqui. */
  createdDayKey: string;
  /** totalSeconds no momento da criação (p/ medir minutos lidos desde então). */
  baselineSeconds: number;
  /** Livro-alvo (kind='livro'): id do livro na biblioteca. */
  bookId?: string;
  /** ms quando foi concluída (vira conquista). */
  doneAt?: number;
};

type Persisted = {
  books: ImportedBook[];
  currentBookId: string | null;
  positions: Record<string, number>;
  /** Progresso de leitura por livro (0..1) — p/ metas por livro (Fase 6). */
  progress: Record<string, number>;
  /** Páginas equivalentes estimadas por livro — p/ "páginas/dia" das metas. */
  bookPages: Record<string, number>;
  bookmarks: Record<string, Bookmark[]>;
  /** Grifos (citações) por livro — o [0] é o mais recente. */
  highlights: Record<string, Highlight[]>;
  vocab: VocabWord[];
  stats: ReadingStats;
  sessions: ReadingSession[];
  goals: Goal[];
  uiTheme: UITheme;
  /** Compartilhar atividades de leitura no feed (visibility 'friends' vs 'private'). Default true. */
  shareActivities: boolean;
  reminder: ReminderConfig;
  readerPrefs: ReaderPrefs;
};

const DEFAULT_REMINDER: ReminderConfig = { enabled: false, hour: 20, minute: 0 };

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

const LEGACY_FILENAME = 'leitura-library.json';
/** Arquivo de estado da conta (ou o legado, quando ainda não há usuário). */
function fileFor(uid?: string): File {
  return new File(Paths.document, uid ? `leitura-library-${uid}.json` : LEGACY_FILENAME);
}

function emptyPersisted(): Persisted {
  return {
    books: [],
    currentBookId: null,
    positions: {},
    progress: {},
    bookPages: {},
    bookmarks: {},
    highlights: {},
    vocab: [],
    stats: { totalSeconds: 0, perDay: {} },
    sessions: [],
    goals: [],
    uiTheme: 'system',
    shareActivities: true,
    reminder: { ...DEFAULT_REMINDER },
    readerPrefs: { ...DEFAULT_READER_PREFS },
  };
}

function parsePersisted(f: File): Persisted {
  try {
    if (!f.exists) return emptyPersisted();
    const parsed = JSON.parse(f.textSync());
    return {
      books: Array.isArray(parsed.books) ? parsed.books : [],
      currentBookId: parsed.currentBookId ?? null,
      positions: parsed.positions ?? {},
      progress: parsed.progress ?? {},
      bookPages: parsed.bookPages ?? {},
      bookmarks: parsed.bookmarks ?? {},
      highlights: parsed.highlights ?? {},
      vocab: Array.isArray(parsed.vocab) ? parsed.vocab : [],
      stats: {
        totalSeconds: parsed.stats?.totalSeconds ?? 0,
        perDay: parsed.stats?.perDay ?? {},
      },
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
      uiTheme: parsed.uiTheme ?? 'system',
      shareActivities: parsed.shareActivities !== false, // default true (compartilha)
      reminder: {
        enabled: Boolean(parsed.reminder?.enabled),
        hour: typeof parsed.reminder?.hour === 'number' ? parsed.reminder.hour : DEFAULT_REMINDER.hour,
        minute: typeof parsed.reminder?.minute === 'number' ? parsed.reminder.minute : DEFAULT_REMINDER.minute,
      },
      readerPrefs: { ...DEFAULT_READER_PREFS, ...(parsed.readerPrefs ?? {}) },
    };
  } catch {
    return emptyPersisted();
  }
}

/** Lê o estado da conta `uid`. Se não houver e existir o arquivo legado, ADOTA o legado
 * (migração única: a 1ª conta a entrar herda os dados antigos) e remove o legado. */
function loadInitialFor(uid?: string): Persisted {
  const f = fileFor(uid);
  if (f.exists) return parsePersisted(f);
  if (uid) {
    const legacy = new File(Paths.document, LEGACY_FILENAME);
    if (legacy.exists) {
      const data = parsePersisted(legacy);
      try {
        if (!f.exists) f.create();
        f.write(JSON.stringify(data));
        legacy.delete();
      } catch {
        // se falhar a migração, segue com os dados em memória
      }
      return data;
    }
  }
  return emptyPersisted();
}

type LibraryState = Persisted & {
  addBook: (book: ImportedBook) => void;
  removeBook: (id: string) => void;
  openBook: (id: string) => void;
  setBookText: (id: string, text: string) => void;
  setBookError: (id: string, message: string) => void;
  setBookTitle: (id: string, title: string) => void;
  setBookCover: (id: string, coverUrl: string) => void;
  setPosition: (id: string, offset: number) => void;
  setBookProgress: (id: string, progress: number) => void;
  setBookPages: (id: string, pages: number) => void;
  addBookmark: (bookId: string, bm: Bookmark) => void;
  removeBookmark: (bookId: string, id: string) => void;
  addHighlight: (bookId: string, hl: Highlight) => void;
  removeHighlight: (bookId: string, id: string) => void;
  addVocab: (entry: VocabWord) => void;
  removeVocab: (id: string) => void;
  addReadingTime: (seconds: number) => void;
  addSession: (session: ReadingSession) => void;
  markSessionSynced: (id: string, remoteId?: string) => void;
  /** Restauração da nuvem: funde as atividades do Supabase no estado local sem apagar
   * nada (sessões por remoteId; estatísticas por dia usando MAX). Idempotente. */
  mergeCloudActivities: (
    rows: { remoteId: string; bookTitle: string; format: BookFormat; seconds: number; pages: number; startedAt: number }[],
  ) => void;
  addGoal: (goal: Goal) => void;
  removeGoal: (id: string) => void;
  completeGoal: (id: string, doneAt: number) => void;
  setUiTheme: (theme: UITheme) => void;
  setShareActivities: (share: boolean) => void;
  setReminder: (reminder: ReminderConfig) => void;
  setReaderPrefs: (prefs: Partial<ReaderPrefs>) => void;
};

// Usuário ativo (escopo do arquivo). No boot a sessão ainda não resolveu → undefined
// (carrega o legado). Quando a sessão resolve, o subscribe abaixo recarrega a conta.
let currentUserId: string | undefined = useAuth.getState().user?.id;
const initial = loadInitialFor(currentUserId);

export const useLibrary = create<LibraryState>((set) => ({
  books: initial.books,
  currentBookId: initial.currentBookId,
  positions: initial.positions,
  progress: initial.progress,
  bookPages: initial.bookPages,
  bookmarks: initial.bookmarks,
  highlights: initial.highlights,
  vocab: initial.vocab,
  stats: initial.stats,
  sessions: initial.sessions,
  goals: initial.goals,
  uiTheme: initial.uiTheme,
  shareActivities: initial.shareActivities,
  reminder: initial.reminder,
  readerPrefs: initial.readerPrefs,
  addBook: (book) =>
    set((s) => ({
      books: [book, ...s.books.filter((b) => b.uri !== book.uri)],
      currentBookId: book.id,
    })),
  removeBook: (id) =>
    set((s) => ({
      books: s.books.filter((b) => b.id !== id),
      currentBookId: s.currentBookId === id ? null : s.currentBookId,
    })),
  openBook: (id) => set({ currentBookId: id }),
  setBookText: (id, text) =>
    set((s) => ({
      books: s.books.map((b) => (b.id === id ? { ...b, text, extractError: undefined } : b)),
    })),
  setBookError: (id, message) =>
    set((s) => ({
      books: s.books.map((b) => (b.id === id ? { ...b, extractError: message } : b)),
    })),
  setBookTitle: (id, title) =>
    set((s) => ({ books: s.books.map((b) => (b.id === id ? { ...b, title } : b)) })),
  setBookCover: (id, coverUrl) =>
    set((s) => ({ books: s.books.map((b) => (b.id === id ? { ...b, coverUrl } : b)) })),
  setPosition: (id, offset) => set((s) => ({ positions: { ...s.positions, [id]: offset } })),
  setBookProgress: (id, p) => set((s) => ({ progress: { ...s.progress, [id]: p } })),
  setBookPages: (id, pages) => set((s) => ({ bookPages: { ...s.bookPages, [id]: pages } })),
  addBookmark: (bookId, bm) =>
    set((s) => ({
      bookmarks: { ...s.bookmarks, [bookId]: [bm, ...(s.bookmarks[bookId] ?? [])] },
    })),
  removeBookmark: (bookId, id) =>
    set((s) => ({
      bookmarks: { ...s.bookmarks, [bookId]: (s.bookmarks[bookId] ?? []).filter((b) => b.id !== id) },
    })),
  addHighlight: (bookId, hl) =>
    set((s) => ({
      highlights: { ...s.highlights, [bookId]: [hl, ...(s.highlights[bookId] ?? [])] },
    })),
  removeHighlight: (bookId, id) =>
    set((s) => ({
      highlights: { ...s.highlights, [bookId]: (s.highlights[bookId] ?? []).filter((h) => h.id !== id) },
    })),
  addVocab: (entry) =>
    set((s) => {
      const exists = s.vocab.some((v) => v.word.toLowerCase() === entry.word.toLowerCase());
      return exists ? s : { vocab: [entry, ...s.vocab] };
    }),
  removeVocab: (id) => set((s) => ({ vocab: s.vocab.filter((v) => v.id !== id) })),
  addSession: (session) => set((s) => ({ sessions: [session, ...s.sessions].slice(0, 300) })),
  markSessionSynced: (id, remoteId) =>
    set((s) => ({
      sessions: s.sessions.map((x) => (x.id === id ? { ...x, synced: true, remoteId } : x)),
    })),
  mergeCloudActivities: (rows) =>
    set((s) => {
      // 1) Sessões: adiciona as da nuvem que ainda não temos (dedupe por remoteId).
      const haveRemote = new Set(s.sessions.map((x) => x.remoteId).filter(Boolean));
      const restored: ReadingSession[] = rows
        .filter((r) => !haveRemote.has(r.remoteId))
        .map((r) => ({
          id: `cloud-${r.remoteId}`,
          bookId: '', // histórico: o arquivo local pode não existir mais
          bookTitle: r.bookTitle,
          format: r.format,
          seconds: r.seconds,
          pages: r.pages,
          startedAt: r.startedAt,
          createdAt: r.startedAt,
          synced: true,
          remoteId: r.remoteId,
        }));
      const sessions =
        restored.length === 0
          ? s.sessions
          : [...s.sessions, ...restored].sort((a, b) => b.startedAt - a.startedAt).slice(0, 300);

      // 2) Estatísticas: perDay com MAX por dia (não apaga o tempo local; só restaura o
      //    que faltava). Mesma chave de dia usada em addReadingTime (UTC, toISOString).
      const cloudPerDay: Record<string, number> = {};
      for (const r of rows) {
        const k = new Date(r.startedAt).toISOString().slice(0, 10);
        cloudPerDay[k] = (cloudPerDay[k] ?? 0) + (r.seconds || 0);
      }
      const perDay: Record<string, number> = { ...s.stats.perDay };
      for (const [k, v] of Object.entries(cloudPerDay)) perDay[k] = Math.max(perDay[k] ?? 0, v);
      const totalSeconds = Object.values(perDay).reduce((a, v) => a + v, 0);

      return { sessions, stats: { totalSeconds, perDay } };
    }),
  addGoal: (goal) => set((s) => ({ goals: [goal, ...s.goals] })),
  removeGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),
  completeGoal: (id, doneAt) =>
    set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, doneAt } : g)) })),
  addReadingTime: (seconds) =>
    set((s) => {
      const key = todayKey();
      return {
        stats: {
          totalSeconds: s.stats.totalSeconds + seconds,
          perDay: { ...s.stats.perDay, [key]: (s.stats.perDay[key] ?? 0) + seconds },
        },
      };
    }),
  setUiTheme: (uiTheme) => set({ uiTheme }),
  setShareActivities: (shareActivities) => set({ shareActivities }),
  setReminder: (reminder) => set({ reminder }),
  setReaderPrefs: (prefs) => set((s) => ({ readerPrefs: { ...s.readerPrefs, ...prefs } })),
}));

// Salva no arquivo DA CONTA ATIVA a cada mudança (escrita síncrona; arquivo pequeno).
let switchingUser = false;
function persist() {
  if (switchingUser) return; // não regravar durante a troca de conta
  try {
    const { books, currentBookId, positions, progress, bookPages, bookmarks, highlights, vocab, stats, sessions, goals, uiTheme, shareActivities, reminder, readerPrefs } =
      useLibrary.getState();
    const f = fileFor(currentUserId);
    if (!f.exists) f.create();
    f.write(
      JSON.stringify({ books, currentBookId, positions, progress, bookPages, bookmarks, highlights, vocab, stats, sessions, goals, uiTheme, shareActivities, reminder, readerPrefs }),
    );
  } catch {
    // ignora falha de escrita
  }
}
useLibrary.subscribe(persist);

// Troca de conta (login/logout/trocar de usuário): carrega o arquivo da nova conta.
// O arquivo da conta anterior já foi salvo pelo subscribe a cada mudança.
useAuth.subscribe((s) => {
  const id = s.user?.id;
  if (id === currentUserId) return;
  currentUserId = id;
  switchingUser = true;
  useLibrary.setState({ ...loadInitialFor(id) });
  switchingUser = false;
  persist(); // garante o arquivo da nova conta no disco
});
