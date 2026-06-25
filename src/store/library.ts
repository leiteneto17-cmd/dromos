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

import { useAuth } from './auth';

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
  vocab: VocabWord[];
  stats: ReadingStats;
  sessions: ReadingSession[];
  goals: Goal[];
  uiTheme: UITheme;
  reminder: ReminderConfig;
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
    vocab: [],
    stats: { totalSeconds: 0, perDay: {} },
    sessions: [],
    goals: [],
    uiTheme: 'system',
    reminder: { ...DEFAULT_REMINDER },
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
      vocab: Array.isArray(parsed.vocab) ? parsed.vocab : [],
      stats: {
        totalSeconds: parsed.stats?.totalSeconds ?? 0,
        perDay: parsed.stats?.perDay ?? {},
      },
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
      uiTheme: parsed.uiTheme ?? 'system',
      reminder: {
        enabled: Boolean(parsed.reminder?.enabled),
        hour: typeof parsed.reminder?.hour === 'number' ? parsed.reminder.hour : DEFAULT_REMINDER.hour,
        minute: typeof parsed.reminder?.minute === 'number' ? parsed.reminder.minute : DEFAULT_REMINDER.minute,
      },
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
  setPosition: (id: string, offset: number) => void;
  setBookProgress: (id: string, progress: number) => void;
  setBookPages: (id: string, pages: number) => void;
  addBookmark: (bookId: string, bm: Bookmark) => void;
  removeBookmark: (bookId: string, id: string) => void;
  addVocab: (entry: VocabWord) => void;
  removeVocab: (id: string) => void;
  addReadingTime: (seconds: number) => void;
  addSession: (session: ReadingSession) => void;
  markSessionSynced: (id: string, remoteId?: string) => void;
  addGoal: (goal: Goal) => void;
  removeGoal: (id: string) => void;
  completeGoal: (id: string, doneAt: number) => void;
  setUiTheme: (theme: UITheme) => void;
  setReminder: (reminder: ReminderConfig) => void;
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
  vocab: initial.vocab,
  stats: initial.stats,
  sessions: initial.sessions,
  goals: initial.goals,
  uiTheme: initial.uiTheme,
  reminder: initial.reminder,
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
  setReminder: (reminder) => set({ reminder }),
}));

// Salva no arquivo DA CONTA ATIVA a cada mudança (escrita síncrona; arquivo pequeno).
let switchingUser = false;
function persist() {
  if (switchingUser) return; // não regravar durante a troca de conta
  try {
    const { books, currentBookId, positions, progress, bookPages, bookmarks, vocab, stats, sessions, goals, uiTheme, reminder } =
      useLibrary.getState();
    const f = fileFor(currentUserId);
    if (!f.exists) f.create();
    f.write(
      JSON.stringify({ books, currentBookId, positions, progress, bookPages, bookmarks, vocab, stats, sessions, goals, uiTheme, reminder }),
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
