/**
 * Tela de leitura (Fase 1 — núcleo estilo Kindle). Rota EMPILHADA (não é aba):
 * abrir um livro no HUB/Biblioteca empurra esta tela em cima das abas, para uma
 * leitura sem distrações (CLAUDE.md §2.5). Usa a pele do livro (sépia/claro/escuro),
 * não a pele social roxo+verde.
 *
 * Controles: voltar, 3 temas, tamanho de fonte, Bionic Reading.
 * Conteúdo:
 *  - sem livro → trecho de exemplo (domínio público)
 *  - PDF → convertido para texto (src/services/pdf-extractor.tsx)
 *  - EPUB → preparado uma vez (todos os capítulos viram uma lista de parágrafos)
 *    e lido num scroll único; navegar entre capítulos é só "pular" para a posição.
 *
 * Tudo é renderizado com FlatList (virtualização): só os parágrafos visíveis são
 * montados, e nada é reprocessado ao navegar (CLAUDE.md §4.6).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { BionicParagraph } from '@/components/bionic-text';
import { VoiceSheet } from '@/components/voice-sheet';
import { BookmarksSheet } from '@/components/bookmarks-sheet';
import { ReadingA11ySheet } from '@/components/reading-a11y-sheet';
import { SelectionBar } from '@/components/selection-bar';
import { WordPanel } from '@/components/word-panel';
import { WordPopover } from '@/components/word-popover';
import { BottomTabInset, Fonts } from '@/constants/theme';
import { useBookTranslation } from '@/hooks/use-book-translation';
import { useReadAloud } from '@/hooks/use-read-aloud';
import {
  loadPreparedCache,
  prepareEpub,
  savePreparedCache,
  type PreparedEpub,
} from '@/services/epub-parser';
import { getUsage } from '@/services/ai/tts';
import { accrueReadingSeconds, maybeShowReadingInterstitial } from '@/services/ads/interstitial';
import { PdfExtractor, type ExtractProgress } from '@/services/pdf-extractor';
import { evaluateGoals } from '@/services/goals';
import { computeAchievements, deriveStats } from '@/services/progress';
import { cleanSnippet, cleanWord, splitParagraphs } from '@/services/text-utils';
import { syncActivities } from '@/services/activity-sync';
import { markBookReading } from '@/services/community';
import { syncBadges } from '@/store/profile';
import { managedTtsAvailable } from '@/services/ai/tts-managed';
import { getTtsKey, useAI } from '@/store/ai';
import { useAuth } from '@/store/auth';
import { useLibrary } from '@/store/library';
import { useIsPremium } from '@/store/plan';
import { useSession } from '@/store/session';
import {
  FontSizeRange,
  LineHeightRatio,
  ReadingThemeLabel,
  ReadingThemeOrder,
  ReadingThemes,
  type ReadingPalette,
  type ReadingThemeName,
} from '@/theme/reading';

const EMPTY: string[] = [];
const EMPTY_BM: import('@/store/library').Bookmark[] = [];
const EMPTY_HL: import('@/store/library').Highlight[] = [];
/** Flag "já viu o tooltip do seletor de voz" (1ª vez que a barra de áudio aparece). */
const VOICE_TIP_KEY = 'leitura-voice-tip-v1';

/** ~parágrafos por "página equivalente" (EPUB/PDF reflow não têm páginas reais — §4.9). */
const PARAS_PER_PAGE = 4;

/** Conquistas no estado ATUAL da biblioteca (livros + vocabulário + stats). */
function currentAchievements() {
  const s = useLibrary.getState();
  return computeAchievements({
    booksCount: s.books.length,
    vocabCount: s.vocab.length,
    derived: deriveStats(s.stats),
    sessions: s.sessions,
    progress: s.progress,
  });
}

/** Ids das conquistas já desbloqueadas agora — foto p/ comparar ao fim da sessão. */
function unlockedAchievementIds(): Set<string> {
  return new Set(currentAchievements().filter((a) => a.unlocked).map((a) => a.id));
}

/**
 * Cronômetro AO VIVO da sessão. Isolado de propósito: tem o próprio interval e
 * estado, então o tique a cada 1s re-renderiza só este número — não a lista de
 * parágrafos (CLAUDE.md §4.6). Remonta (zera) ao trocar de livro via `key`.
 */
function SessionTimer({ color }: { color: string }) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return (
    <Text style={[styles.timer, { color }]}>
      ⏱ {mm}:{ss}
    </Text>
  );
}

const SAMPLE_BOOK = 'Dom Casmurro · Machado de Assis';
const SAMPLE_CHAPTER = 'I — Do título';
const SAMPLE_TEXT = `Uma noite destas, vindo da cidade para o Engenho Novo, encontrei num trem da Central um rapaz aqui do bairro, que eu conheço de vista e de chapéu. Cumprimentou-me, sentou-se ao pé de mim, falou da lua e dos ministros, e acabou recitando-me versos. A viagem era curta, e os versos pode ser que não fossem inteiramente maus. Sucedeu, porém, que, como eu estava cansado, fechei os olhos três ou quatro vezes; tanto bastou para que ele interrompesse a leitura e metesse os versos no bolso.

— Continue, disse eu acordando.

— Já acabei, murmurou ele.

— São muito bonitos.

Vi-lhe fazer um gesto para tirá-los outra vez do bolso, mas não passou do gesto; estava amuado. No dia seguinte entrou a dizer de mim nomes feios, e acabou alcunhando-me Dom Casmurro. Os vizinhos, que não gostam dos meus hábitos reclusos e calados, deram curso à alcunha, que afinal pegou.

Não consultes dicionários. Casmurro não está aqui no sentido que eles lhe dão, mas no que lhe pôs o vulgo de homem calado e metido consigo. Dom veio por ironia, para atribuir-me fumos de fidalgo. Tudo por estar cochilando! Também não achei melhor título para a minha narração; se não tiver outro daqui até ao fim do livro, vai este mesmo.`;

function StatusBanner({ t, text }: { t: ReadingPalette; text: string }) {
  return (
    <View style={[styles.banner, { borderLeftColor: t.accent }]}>
      <Text style={[styles.noticeSmall, { color: t.textSecondary }]}>{text}</Text>
    </View>
  );
}

/** Índice do capítulo que contém o parágrafo `idx` (último capítulo iniciado até ele). */
function chapterAt(chapters: { start: number }[], idx: number): number {
  let lo = 0;
  for (let i = 0; i < chapters.length; i++) {
    if (chapters[i].start <= idx) lo = i;
    else break;
  }
  return lo;
}

function PrepStatus({ t, progress }: { t: ReadingPalette; progress: number }) {
  const pct = Math.round(progress * 100);
  return (
    <View style={styles.center}>
      <ActivityIndicator color={t.accent} />
      <Text style={[styles.noticeSmall, { color: t.textSecondary, marginTop: 10 }]}>
        Preparando o livro… {pct}%
      </Text>
      <View style={[styles.prepTrack, { backgroundColor: t.border }]}>
        <View style={[styles.prepFill, { backgroundColor: t.accent, width: `${pct}%` }]} />
      </View>
    </View>
  );
}

export default function ReaderScreen() {
  // Preferências do leitor agora PERSISTEM (tema/fonte/Bionic + acessibilidade) — antes
  // eram estado local e resetavam a cada abertura.
  const prefs = useLibrary((s) => s.readerPrefs);
  const setReaderPrefs = useLibrary((s) => s.setReaderPrefs);
  const themeName = prefs.theme;
  const fontSize = prefs.fontSize;
  const bionic = prefs.bionic;
  const setThemeName = (theme: ReadingThemeName) => setReaderPrefs({ theme });
  const [showA11y, setShowA11y] = useState(false); // folha de Acessibilidade/Leitura
  // Realça o PARÁGRAFO que o áudio está lendo (leitura direcionada). Leve: muda no
  // máximo 1× por parágrafo. Pode ser desligado por quem prefere ouvir sem destaque.
  const [highlightReading, setHighlightReading] = useState<boolean>(true);
  // "Acompanhar": a tela rola sozinha seguindo o parágrafo falado (estilo teleprompter).
  // Desliga automaticamente quando o usuário rola manualmente — não brigar com o dedo.
  const [follow, setFollow] = useState<boolean>(true);
  // 🌐 Ler em português: traduz o texto exibido conforme se lê (tradução automática).
  const [translatePT, setTranslatePT] = useState(false);
  // Sinal vindo do Explorar (livro não-PT) p/ ligar a tradução automaticamente ao abrir.
  const { pt: ptParam } = useLocalSearchParams<{ pt?: string }>();

  // PDF
  const [progress, setProgress] = useState<ExtractProgress | null>(null);
  // EPUB (livro preparado por inteiro)
  const [epubBook, setEpubBook] = useState<{ bookId: string; data: PreparedEpub } | null>(null);
  const [prepProgress, setPrepProgress] = useState(0);
  const [prepError, setPrepError] = useState<string | null>(null);
  // Leitura contínua (estilo KyBook): o livro inteiro num scroll só. `topIndex` é o
  // parágrafo no topo da tela — deriva o capítulo atual e o progresso, sem paginar.
  const [topIndex, setTopIndex] = useState(0);
  const [selectedWord, setSelectedWord] = useState<{
    word: string;
    context: string;
    index: number;
    charOffset: number;
    /** Comprimento do token CRU (com pontuação) — p/ ancorar a seleção de trecho. */
    rawLen: number;
    /** Posição do toque (p/ ancorar o menu contextual). */
    x: number;
    y: number;
  } | null>(null);
  // Seleção de trecho (citação de verdade) — âncora/foco em offsets de char, no MESMO parágrafo.
  const [selection, setSelection] = useState<{
    index: number;
    aStart: number;
    aEnd: number;
    fStart: number;
    fEnd: number;
  } | null>(null);
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  // 'menu' = popover contextual flutuante; 'full' = painel completo (Significado/IA).
  const [wordMode, setWordMode] = useState<'menu' | 'full'>('menu');
  const [wordAuto, setWordAuto] = useState<'significado' | 'ia' | undefined>(undefined);
  const [showBookmarks, setShowBookmarks] = useState(false);

  const listRef = useRef<FlatList<string>>(null);
  const topIndexRef = useRef(0);
  topIndexRef.current = topIndex;
  const offsetRef = useRef(0); // offset de rolagem atual (p/ salvar marcador/posição)
  const followRef = useRef(true); // espelho de `follow` para os callbacks/efeitos
  const sessionTitleRef = useRef(''); // título "limpo" do livro (p/ a sessão de leitura)
  followRef.current = follow;

  const currentBook = useLibrary((s) => s.books.find((b) => b.id === s.currentBookId) ?? null);
  const setBookText = useLibrary((s) => s.setBookText);
  const setBookError = useLibrary((s) => s.setBookError);
  const setPosition = useLibrary((s) => s.setPosition);
  const setBookProgress = useLibrary((s) => s.setBookProgress);
  const setBookPages = useLibrary((s) => s.setBookPages);
  const vocab = useLibrary((s) => s.vocab);
  const addVocab = useLibrary((s) => s.addVocab);
  const removeVocab = useLibrary((s) => s.removeVocab);
  const addReadingTime = useLibrary((s) => s.addReadingTime);
  const addSession = useLibrary((s) => s.addSession);
  const bookmarks = useLibrary((s) => (currentBook ? s.bookmarks[currentBook.id] ?? EMPTY_BM : EMPTY_BM));
  const addBookmark = useLibrary((s) => s.addBookmark);
  const removeBookmark = useLibrary((s) => s.removeBookmark);
  const highlights = useLibrary((s) => (currentBook ? s.highlights[currentBook.id] ?? EMPTY_HL : EMPTY_HL));
  const addHighlight = useLibrary((s) => s.addHighlight);
  const removeHighlight = useLibrary((s) => s.removeHighlight);
  // Voz de nuvem disponível E preferida: chave própria (ElevenLabs) ou neural gerida
  // (logado), com o seletor de voz em "nuvem" (default = voz do aparelho). Controla só
  // o ícone 🎙️/🔊 do botão Ouvir. useAuth mantém reativo ao entrar/sair da conta.
  const hasTtsKey = useAI((s) => s.hasTtsKey);
  const voiceEnginePref = useAI((s) => s.voiceEngine);
  const hasSession = useAuth((s) => !!s.session);
  const hasPremiumVoice =
    voiceEnginePref === 'cloud' && (hasTtsKey || (hasSession && managedTtsAvailable()));

  const t = ReadingThemes[themeName];
  const { width: winWidth } = useWindowDimensions();
  // Entrelinha agora respeita o multiplicador de acessibilidade (entrelinha ampla).
  const lineHeight = Math.round(fontSize * LineHeightRatio * prefs.lineSpacing);
  const paragraphSpacing = Math.round(fontSize * 0.9);

  const decFont = () => setReaderPrefs({ fontSize: Math.max(FontSizeRange.min, fontSize - FontSizeRange.step) });
  const incFont = () => setReaderPrefs({ fontSize: Math.min(FontSizeRange.max, fontSize + FontSizeRange.step) });

  const isPdf = currentBook?.format === 'pdf';
  const isEpub = currentBook?.format === 'epub';
  const extracted = currentBook?.text;
  const extractError = currentBook?.extractError;
  const extracting = !!currentBook && isPdf && extracted === undefined && extractError === undefined;

  // Título "limpo" do livro (sem autor) p/ a sessão de leitura — atualizado a cada render
  // e lido na finalização da sessão (cleanup do useFocusEffect).
  sessionTitleRef.current = currentBook
    ? isEpub
      ? epubBook?.data.title ?? currentBook.title ?? currentBook.name
      : currentBook.title ?? currentBook.name
    : '';

  // Prepara o EPUB inteiro uma vez (com progresso), depois a leitura é fluida.
  useEffect(() => {
    if (!currentBook || currentBook.format !== 'epub') return;
    if (epubBook?.bookId === currentBook.id) return;
    let cancelled = false;
    setEpubBook(null);
    setPrepError(null);
    setPrepProgress(0);
    setTopIndex(0);

    (async () => {
      // tenta o cache (preparado antes) → abre instantâneo, sem "Preparando…"
      let data = await loadPreparedCache(currentBook.id);
      if (cancelled) return;
      if (!data) {
        try {
          data = await prepareEpub(currentBook.uri, (p) => {
            if (!cancelled) setPrepProgress(p);
          });
        } catch (e) {
          if (!cancelled) setPrepError(e instanceof Error ? e.message : 'Falha ao abrir o EPUB.');
          return;
        }
        if (cancelled) return;
        savePreparedCache(currentBook.id, data); // guarda para a próxima vez
      }
      setEpubBook({ bookId: currentBook.id, data });
      // Guarda o título real do EPUB no livro (a biblioteca/comunidade mostravam o nome
      // do arquivo, ex.: "Documento EPUB"). Cai cedo no próximo render (guard do efeito).
      if (data.title && currentBook.title !== data.title) {
        useLibrary.getState().setBookTitle(currentBook.id, data.title);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentBook, epubBook?.bookId]);

  // Conta o tempo de leitura enquanto esta tela está focada e há um livro aberto, e ao
  // SAIR finaliza uma "sessão" (estilo Strava, §2.6): livro + tempo + páginas equivalentes.
  useFocusEffect(
    useCallback(() => {
      if (!currentBook) return;
      const startedAt = Date.now();
      const startIndex = topIndexRef.current;
      let sessionSeconds = 0;
      const TICK = 15;
      // Foto das conquistas JÁ desbloqueadas no início — p/ descobrir, ao terminar,
      // quais foram desbloqueadas NESTA sessão (a tela "Conquista desbloqueada").
      const unlockedAtStart = unlockedAchievementIds();
      const id = setInterval(() => {
        addReadingTime(TICK);
        sessionSeconds += TICK;
        accrueReadingSeconds(TICK); // soma rumo ao próximo intersticial (tier grátis)
        evaluateGoals(); // conclui/celebra metas no momento EXATO em que o alvo é batido
      }, TICK * 1000);
      return () => {
        clearInterval(id);
        if (sessionSeconds < TICK) return; // ignora "passadas" curtas (não vira atividade)
        const sessionId = `s-${startedAt}`;
        const parasRead = Math.max(0, topIndexRef.current - startIndex);
        const pages = Math.round(parasRead / PARAS_PER_PAGE);
        addSession({
          id: sessionId,
          bookId: currentBook.id,
          bookTitle: sessionTitleRef.current || currentBook.name,
          format: currentBook.format,
          seconds: sessionSeconds,
          pages,
          startedAt,
          createdAt: Date.now(),
          synced: false,
        });
        // Sobe pro Supabase se logado (no-op se deslogado/offline — tenta de novo depois).
        void syncActivities();

        // Auto-estante: leu de verdade (≥1 min) → entra como "lendo" na estante (se ainda
        // não estiver lá). No-op se deslogado. Visibilidade segue o perfil (privado por padrão).
        if (sessionSeconds >= 60) {
          void markBookReading({
            title: sessionTitleRef.current || currentBook.name,
            coverUrl: currentBook.coverUrl,
          });
        }

        // Metas: avalia uma última vez ao sair. Se uma meta foi concluída AGORA, a
        // celebração "Meta concluída" tem prioridade sobre o resumo da sessão.
        const goalJustCelebrated = evaluateGoals();

        // Celebração da sessão (fecha o laço Strava): conquistas novas + resumo. Mostra
        // se desbloqueou algo OU a sessão foi de ao menos 1 min (evita "pop" em passadas).
        const allNow = currentAchievements();
        const newAchievements = allNow.filter((a) => a.unlocked && !unlockedAtStart.has(a.id));
        // Espelha os emblemas no perfil do banco (aparecem no perfil público). No-op se
        // deslogado ou se nada mudou desde a última sincronização.
        void syncBadges(allNow.filter((a) => a.unlocked).map((a) => a.id));
        if (!goalJustCelebrated && (newAchievements.length > 0 || sessionSeconds >= 60)) {
          useSession.getState().celebrate({
            kind: 'session',
            sessionId,
            bookTitle: sessionTitleRef.current || currentBook.name,
            seconds: sessionSeconds,
            pages,
            newAchievements,
          });
        }

        // PONTO NATURAL (§2.5): saiu do leitor → se acumulou ~10 min de leitura e é tier grátis,
        // mostra um intersticial de vídeo. Nunca por cima do texto; só aqui, fora da leitura.
        maybeShowReadingInterstitial();
      };
    }, [currentBook, addReadingTime, addSession]),
  );

  const chapters = epubBook?.data.chapters ?? [];

  // --- decide o corpo: parágrafos (texto) ou um nó de status ---
  let bodyText: string | null = null;
  let status: ReactNode = null;

  if (isEpub) {
    if (prepError) status = <StatusBanner t={t} text={prepError} />;
    else if (!epubBook) status = <PrepStatus t={t} progress={prepProgress} />;
  } else if (extracted !== undefined) {
    if (extracted.trim().length === 0)
      status = (
        <StatusBanner
          t={t}
          text="Não encontramos texto neste PDF. Ele provavelmente é escaneado (imagem) — nesse caso precisará de OCR, recurso que entra mais adiante."
        />
      );
    else bodyText = extracted;
  } else if (extractError) {
    status = <StatusBanner t={t} text={`Não foi possível converter este PDF: ${extractError}`} />;
  } else if (extracting && currentBook) {
    const MAX_PDF_BYTES = 25 * 1024 * 1024;
    if (currentBook.size && currentBook.size > MAX_PDF_BYTES) {
      const mb = (currentBook.size / (1024 * 1024)).toFixed(0);
      status = (
        <StatusBanner
          t={t}
          text={`Este PDF é grande (${mb} MB) para converter no aparelho por enquanto (limite ~25 MB). Use um PDF de texto mais curto.`}
        />
      );
    } else {
      status = (
        <View style={styles.center}>
          <ActivityIndicator color={t.accent} />
          <Text style={[styles.noticeSmall, { color: t.textSecondary, marginTop: 10 }]}>
            {progress?.stage === 'page'
              ? `Convertendo página ${progress.page} de ${progress.total}…`
              : 'Lendo o arquivo…'}
          </Text>
          <PdfExtractor
            uri={currentBook.uri}
            onProgress={setProgress}
            onResult={(text) => {
              setProgress(null);
              setBookText(currentBook.id, text);
            }}
            onError={(message) => {
              setProgress(null);
              setBookError(currentBook.id, message);
            }}
          />
        </View>
      );
    }
  } else {
    bodyText = SAMPLE_TEXT;
  }

  const sampleOrPdfParas = useMemo(() => (bodyText ? splitParagraphs(bodyText) : EMPTY), [bodyText]);
  // Leitura contínua: o LIVRO INTEIRO numa lista virtualizada (FlatList só monta os
  // parágrafos visíveis). Nada de fatiar por capítulo — navegar deixa de reprocessar.
  const paragraphs = isEpub && epubBook ? epubBook.data.paragraphs : sampleOrPdfParas;

  // Capítulo no início de cada parágrafo (título inline, estilo livro) e capítulo atual.
  const chapterTitleAt = useMemo(() => {
    const m = new Map<number, string>();
    chapters.forEach((ch) => {
      if (ch.title) m.set(ch.start, ch.title);
    });
    return m;
  }, [chapters]);
  const currentChapter = chapters.length ? chapterAt(chapters, topIndex) : 0;
  const readProgress = paragraphs.length > 1 ? topIndex / (paragraphs.length - 1) : 0;

  // 🌐 Ler em português — tradução sob demanda do livro (prefetch + cache em disco).
  const { map: ptMap, ensure: ensurePT, error: ptError, needsKey: ptNeedsKey } =
    useBookTranslation(currentBook?.id, paragraphs);

  // Pré-traduz a janela a partir do topo da tela enquanto o modo PT está ligado.
  useEffect(() => {
    if (translatePT) ensurePT(topIndex);
  }, [translatePT, topIndex, ensurePT]);

  // Sem login/chave de IA → desliga o modo e avisa (não fica "tentando" à toa).
  useEffect(() => {
    if (translatePT && ptNeedsKey) {
      setTranslatePT(false);
      Alert.alert(
        'Tradução indisponível',
        ptError ?? 'Entre na sua conta ou conecte sua chave de IA em Integrações para ler em português.',
      );
    }
  }, [translatePT, ptNeedsKey, ptError]);

  const toggleTranslate = useCallback(() => {
    setTranslatePT((v) => {
      const next = !v;
      if (next) {
        // sai de seleção/menu (offsets são do texto original) e começa a traduzir o topo
        setSelection(null);
        setSelectedWord(null);
        ensurePT(topIndexRef.current);
      }
      return next;
    });
  }, [ensurePT]);

  // Veio do Explorar com `pt=1` (livro não-PT, clicou "Leia em português no app") → liga a
  // tradução sozinho. Aplica 1× por livro (se o usuário desligar depois, não religa).
  const autoPtBookRef = useRef<string | null>(null);
  useEffect(() => {
    if (ptParam === '1' && currentBook && autoPtBookRef.current !== currentBook.id) {
      autoPtBookRef.current = currentBook.id;
      setTranslatePT(true);
    }
  }, [ptParam, currentBook]);

  // Sumário DENSO: alguns livros têm pouquíssimos capítulos (corte por <h>), e o índice
  // ficava com buracos enormes (25% → 68%). Mantemos os capítulos REAIS e PREENCHEMOS os
  // vãos grandes com marcadores intermediários (trecho + %), pra a pessoa se localizar fino.
  const toc = useMemo(() => {
    const N = paragraphs.length;
    if (N === 0) return [] as { start: number; label: string; pct: number; isChapter: boolean }[];
    const gap = Math.max(50, Math.ceil(N * 0.05)); // no máx ~5% (ou 50 parágrafos) entre marcas
    const chs = chapters.length ? chapters : [{ start: 0, title: undefined as string | undefined }];
    const out: { start: number; label: string; pct: number; isChapter: boolean }[] = [];
    const push = (start: number, label: string, isChapter: boolean) =>
      out.push({ start, label, pct: N > 1 ? start / (N - 1) : 0, isChapter });

    for (let c = 0; c < chs.length; c++) {
      const ch = chs[c];
      const nextStart = c + 1 < chs.length ? chs[c + 1].start : N;
      push(ch.start, ch.title?.trim() || cleanSnippet(paragraphs[ch.start] ?? '', 60) || `Trecho ${c + 1}`, true);
      // preenche o vão até o próximo capítulo com marcadores a cada `gap` parágrafos
      for (let p = ch.start + gap; p < nextStart - Math.floor(gap / 2); p += gap) {
        push(p, cleanSnippet(paragraphs[p] ?? '', 50) || '…', false);
      }
    }
    return out;
  }, [chapters, paragraphs]);

  // Marcador atual do sumário denso (última marca cujo início já passou).
  let currentTocIndex = 0;
  for (let i = 0; i < toc.length; i++) {
    if (toc[i].start <= topIndex) currentTocIndex = i;
    else break;
  }

  // Espaço real da navegação/gestos do sistema embaixo (varia por aparelho — Xiaomi
  // e afins têm barra alta). Sem isso, a barra de áudio colava nos botões do sistema.
  const insets = useSafeAreaInsets();

  // Audiobook assistido. Lê o livro a partir do parágrafo no topo da tela.
  const read = useReadAloud(paragraphs);
  const readRef = useRef(read.state);
  readRef.current = read.state;

  // Seletor de VOZ no ponto de uso (botão 🎙️ da barra de áudio) + tooltip de 1ª vez.
  const [showVoiceSheet, setShowVoiceSheet] = useState(false);
  const [voiceTip, setVoiceTip] = useState(false);
  useEffect(() => {
    if (!read.state.active) return;
    let alive = true;
    AsyncStorage.getItem(VOICE_TIP_KEY).then((seen) => {
      if (alive && !seen) setVoiceTip(true);
    });
    return () => {
      alive = false;
    };
  }, [read.state.active]);
  const dismissVoiceTip = useCallback(() => {
    setVoiceTip(false);
    AsyncStorage.setItem(VOICE_TIP_KEY, '1').catch(() => {});
  }, []);

  const isPremium = useIsPremium();
  // Áudio/voz é recurso Premium (§6). No grátis, "Ouvir" leva à assinatura em vez de tocar.
  function startListening(index: number, offset?: number) {
    if (!isPremium) {
      router.push('/premium');
      return;
    }
    setFollow(true);
    read.start(index, offset);
  }

  // Restaura a posição de leitura SEM travar. Antes tentávamos rolar até o parágrafo
  // depois de montar a lista — numa lista virtualizada isso renderiza todos os parágrafos
  // do caminho (rola da pág. 1 até a 100 = o travamento). A forma certa de "abrir já num
  // ponto fundo" é `initialScrollIndex`: o FlatList MONTA direto naquele índice, sem
  // renderizar os anteriores (o espaço acima vira altura estimada). Calculamos o índice a
  // partir do progresso salvo; a lista remonta (via `key`) quando os parágrafos chegam,
  // aplicando o índice no 1º render. Veja `listKey` e `initialScrollIndex` no FlatList.
  const initialScrollIndex = useMemo(() => {
    if (!currentBook || paragraphs.length === 0) return undefined;
    const saved = useLibrary.getState().progress[currentBook.id] ?? 0;
    const idx = Math.min(
      paragraphs.length - 1,
      Math.max(0, Math.round(saved * (paragraphs.length - 1))),
    );
    return idx > 0 ? idx : undefined;
    // recalcula quando o livro ou a quantidade de parágrafos muda (0 → N ao preparar)
  }, [currentBook?.id, paragraphs.length]);

  // Chave da lista: muda quando os parágrafos ficam prontos, forçando UM remount para o
  // `initialScrollIndex` valer. Sem isso, a lista já estaria montada (vazia) e ignoraria o índice.
  const listKey = `${currentBook?.id ?? 'sample'}:${paragraphs.length > 0 ? 'ready' : 'loading'}`;

  // getItemLayout com altura ESTIMADA por parágrafo. É o que faz o `initialScrollIndex`
  // pular DIRETO para o índice (O(1)) sem medir nem renderizar os parágrafos do caminho —
  // sem isso o FlatList tentava montar tudo até lá (o travamento de ~9 s + "volta ao topo").
  // A estimativa (linhas ≈ caracteres ÷ caracteres-por-linha) não é exata, então a rolagem
  // pode ter pequenas correções, mas cai no parágrafo certo e é instantânea.
  const layout = useMemo(() => {
    const usableW = Math.max(120, winWidth - 44); // content paddingHorizontal 22 × 2
    const charsPerLine = Math.max(8, Math.floor(usableW / (fontSize * 0.5)));
    const headingH = Math.round(fontSize * 1.6) + 32; // inlineChapter (marginTop+Bottom)
    const base = 90; // ListHeaderComponent (rótulo + subtítulo) + paddingTop, aprox
    const offsets = new Array<number>(paragraphs.length);
    const lengths = new Array<number>(paragraphs.length);
    let acc = base;
    for (let i = 0; i < paragraphs.length; i++) {
      const lines = Math.max(1, Math.ceil((paragraphs[i]?.length ?? 0) / charsPerLine));
      const h = lines * lineHeight + paragraphSpacing + (chapterTitleAt.has(i) ? headingH : 0);
      lengths[i] = h;
      offsets[i] = acc;
      acc += h;
    }
    return { offsets, lengths };
  }, [paragraphs, winWidth, fontSize, lineHeight, paragraphSpacing, chapterTitleAt]);

  const getItemLayout = useCallback(
    (_: ArrayLike<string> | null | undefined, index: number) => ({
      length: layout.lengths[index] ?? lineHeight * 4,
      offset: layout.offsets[index] ?? 0,
      index,
    }),
    [layout, lineHeight],
  );

  // Caracteres restantes da voz premium (ElevenLabs) — busca uma vez ao iniciar a
  // sessão premium e mostra na barra de áudio (é só um termômetro da cota, §5).
  const [ttsLeft, setTtsLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!read.state.active) {
      setTtsLeft(null);
      return;
    }
    if (read.state.engine !== 'premium') return;
    let alive = true;
    (async () => {
      const k = await getTtsKey();
      if (!k || !alive) return;
      const u = await getUsage(k);
      if (u && alive) setTtsLeft(Math.max(0, u.limit - u.used));
    })();
    return () => {
      alive = false;
    };
  }, [read.state.active, read.state.engine]);

  // Acompanha a leitura: rola até o parágrafo sendo falado — SÓ enquanto o usuário não
  // tomou o controle da rolagem (modo "Acompanhar"). Isso evita (a) brigar com o dedo e
  // (b) um scrollToIndex para um índice distante, que numa lista gigante trava/ANR.
  useEffect(() => {
    if (!read.state.active || !followRef.current) return;
    try {
      listRef.current?.scrollToIndex({
        index: read.state.paraIndex,
        animated: true,
        viewPosition: 0.3,
      });
    } catch {
      // índice ainda não medido; segue (o handler de falha cobre)
    }
  }, [read.state.active, read.state.paraIndex]);

  // Rótulo e subtítulo do cabeçalho
  let bookLabel = SAMPLE_BOOK;
  let subtitle = SAMPLE_CHAPTER;
  if (currentBook) {
    if (isEpub) {
      const title = epubBook?.data.title ?? currentBook.name;
      bookLabel = epubBook?.data.author ? `${title} · ${epubBook.data.author}` : title;
      if (prepError) subtitle = 'Não foi possível abrir';
      else if (!epubBook) subtitle = 'Preparando…';
      else subtitle = ''; // capítulos aparecem inline no texto (leitura contínua)
    } else {
      bookLabel = currentBook.title ?? currentBook.name;
      if (extracted !== undefined) subtitle = '';
      else if (extracting) subtitle = 'Convertendo PDF para leitura…';
      else if (extractError) subtitle = 'Não foi possível converter';
      else subtitle = 'Prévia de leitura';
    }
  }

  // Barra de progresso (a "mini marcação" estilo KyBook): aparece quando há texto.
  const showProgress = paragraphs.length > 0 && !status;
  const barChapter =
    isEpub && epubBook && chapters.length
      ? chapters[currentChapter]?.title ?? `Capítulo ${currentChapter + 1}`
      : '';

  const markedSet = useMemo(() => new Set(vocab.map((v) => v.word.toLowerCase())), [vocab]);

  const handleWord = useCallback(
    (word: string, paragraph: string, index: number, charOffset: number, x: number, y: number) => {
      // Em modo de seleção: tocar outra palavra do MESMO parágrafo amplia o trecho.
      const sel = selectionRef.current;
      if (sel) {
        if (index === sel.index) setSelection({ ...sel, fStart: charOffset, fEnd: charOffset + word.length });
        return;
      }
      const clean = cleanWord(word);
      if (!clean) return;
      setWordMode('menu'); // sempre abre no menu contextual flutuante
      setWordAuto(undefined);
      setSelectedWord({ word: clean, context: paragraph, index, charOffset, rawLen: word.length, x, y });
    },
    [],
  );

  const closeWord = useCallback(() => setSelectedWord(null), []);

  // Grifos salvos do livro agrupados por parágrafo (estável → não re-renderiza a lista à toa).
  const savedRangesByPara = useMemo(() => {
    const m = new Map<number, { start: number; end: number }[]>();
    for (const h of highlights) {
      const arr = m.get(h.index);
      if (arr) arr.push({ start: h.start, end: h.end });
      else m.set(h.index, [{ start: h.start, end: h.end }]);
    }
    return m;
  }, [highlights]);

  // Faixa atual da seleção (citação) — derivada da âncora/foco.
  const selStart = selection ? Math.min(selection.aStart, selection.fStart) : 0;
  const selEnd = selection ? Math.max(selection.aEnd, selection.fEnd) : 0;
  const selPreview = selection ? cleanSnippet(paragraphs[selection.index]?.slice(selStart, selEnd) ?? '', 220) : '';

  // Grifo salvo que contém a palavra tocada (p/ oferecer "remover grifo" no popover).
  const selectedHl =
    selectedWord && currentBook
      ? highlights.find(
          (h) =>
            h.index === selectedWord.index &&
            selectedWord.charOffset < h.end &&
            selectedWord.charOffset + selectedWord.rawLen > h.start,
        )
      : undefined;

  // Entra no modo seleção a partir da palavra do popover. No modo 🌐 PT a citação fica
  // desativada (os offsets/grifos são ancorados no texto ORIGINAL, não na tradução).
  const startSelection = useCallback(() => {
    if (!selectedWord) return;
    if (translatePT) {
      setSelectedWord(null);
      return;
    }
    const { index, charOffset, rawLen } = selectedWord;
    setSelection({ index, aStart: charOffset, aEnd: charOffset + rawLen, fStart: charOffset, fEnd: charOffset + rawLen });
    setSelectedWord(null);
  }, [selectedWord, translatePT]);

  const cancelSelection = useCallback(() => setSelection(null), []);

  // Salva o trecho selecionado como grifo. Retorna o texto salvo (ou null).
  const saveHighlight = useCallback((): string | null => {
    const sel = selectionRef.current;
    if (!sel || !currentBook) return null;
    const start = Math.min(sel.aStart, sel.fStart);
    const end = Math.max(sel.aEnd, sel.fEnd);
    const text = cleanSnippet(paragraphs[sel.index]?.slice(start, end) ?? '', 300);
    if (!text) return null;
    addHighlight(currentBook.id, { id: `${Date.now()}`, index: sel.index, start, end, text, createdAt: Date.now() });
    return text;
  }, [currentBook, paragraphs, addHighlight]);

  const confirmHighlight = useCallback(() => {
    saveHighlight();
    setSelection(null);
  }, [saveHighlight]);

  // "Citar": salva o grifo e abre o card de compartilhar já no modelo de citação.
  const quoteSelection = useCallback(() => {
    saveHighlight();
    setSelection(null);
    router.push('/compartilhar?model=citacao');
  }, [saveHighlight]);

  const removeSelectedHighlight = useCallback(() => {
    if (selectedHl && currentBook) removeHighlight(currentBook.id, selectedHl.id);
    setSelectedWord(null);
  }, [selectedHl, currentBook, removeHighlight]);

  // Alterna a palavra no banco de vocabulário (ação rápida do menu contextual).
  const toggleMarkWord = useCallback(() => {
    if (!selectedWord) return;
    const existing = vocab.find((v) => v.word.toLowerCase() === selectedWord.word.toLowerCase());
    if (existing) removeVocab(existing.id);
    else
      addVocab({
        id: `${Date.now()}`,
        word: selectedWord.word,
        context: selectedWord.context,
        bookId: currentBook?.id,
        bookName: currentBook?.name,
        addedAt: Date.now(),
      });
  }, [selectedWord, vocab, addVocab, removeVocab, currentBook]);

  const renderItem = useCallback(
    ({ item, index }: { item: string; index: number }) => {
      const r = readRef.current;
      const activePara = highlightReading && r.active && index === r.paraIndex;
      const heading = chapterTitleAt.get(index); // título de capítulo inline (estilo livro)
      // Modo 🌐 PT: mostra a tradução quando já pronta; senão o original (some ao chegar).
      const text = translatePT ? ptMap[index] ?? item : item;
      return (
        <View>
          {heading ? (
            <Text style={[styles.inlineChapter, { color: t.text, fontFamily: Fonts?.serif }]}>
              {heading}
            </Text>
          ) : null}
          <BionicParagraph
            text={text}
            bionic={bionic}
            ratio={prefs.bionicRatio}
            color={t.text}
            fontSize={fontSize}
            lineHeight={lineHeight}
            letterSpacing={prefs.letterSpacing}
            fontFamily={Fonts?.serif}
            marginBottom={paragraphSpacing}
            paraIndex={index}
            onWordPress={handleWord}
            markedSet={markedSet}
            highlightColor={t.highlight}
            selRange={!translatePT && selection && selection.index === index ? { start: selStart, end: selEnd } : undefined}
            selColor={t.accent + '55'}
            savedRanges={translatePT ? undefined : savedRangesByPara.get(index)}
            savedColor={t.accent + '2E'}
            activePara={activePara}
            activeColor={t.accent + '22'}
          />
        </View>
      );
    },
    [bionic, prefs.bionicRatio, prefs.letterSpacing, t, fontSize, lineHeight, paragraphSpacing, handleWord, markedSet, chapterTitleAt, highlightReading, selection, selStart, selEnd, savedRangesByPara, translatePT, ptMap],
  );

  // Rastreia o parágrafo no topo (progresso/capítulo) — estável p/ a FlatList.
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 0, minimumViewTime: 60 }).current;
  const onViewRef = useRef(
    ({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
      const top = viewableItems.find((v) => v.index != null);
      if (top?.index != null) setTopIndex(top.index);
    },
  ).current;

  // Acompanha o offset de rolagem num ref (barato, todo frame) p/ salvar marcador exato.
  const onScroll = useCallback((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    offsetRef.current = e.nativeEvent.contentOffset.y;
  }, []);

  // O usuário pegou a lista com o dedo → para de acompanhar (não arrancar a tela de volta)
  // e FECHA o menu contextual da palavra (interface invisível: some no scroll).
  const onScrollBeginDrag = useCallback(() => {
    if (followRef.current) setFollow(false);
    setSelectedWord((w) => (w ? null : w));
  }, []);

  // Liga/desliga o "Acompanhar". Ao religar durante a leitura, volta ao parágrafo falado.
  const toggleFollow = useCallback(() => {
    setFollow((f) => {
      const next = !f;
      if (next && readRef.current.active) {
        try {
          listRef.current?.scrollToIndex({
            index: readRef.current.paraIndex,
            animated: true,
            viewPosition: 0.3,
          });
        } catch {
          // índice ainda não medido — ignora
        }
      }
      return next;
    });
  }, []);

  // Salva a posição por offset quando a rolagem para (leve, não a cada frame).
  // Também grava o PROGRESSO (0..1) do livro p/ as metas por livro (Fase 6).
  const saveOffset = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      offsetRef.current = e.nativeEvent.contentOffset.y;
      if (!currentBook) return;
      setPosition(currentBook.id, Math.round(e.nativeEvent.contentOffset.y));
      if (paragraphs.length > 1) setBookProgress(currentBook.id, topIndexRef.current / (paragraphs.length - 1));
    },
    [currentBook, setPosition, setBookProgress, paragraphs.length],
  );

  // Estima as páginas equivalentes do livro (parágrafos / 4) p/ "páginas/dia" das metas.
  useEffect(() => {
    if (currentBook && paragraphs.length > 0) {
      setBookPages(currentBook.id, Math.max(1, Math.ceil(paragraphs.length / PARAS_PER_PAGE)));
    }
  }, [currentBook, paragraphs.length, setBookPages]);

  // --- Marcadores de página ---
  const addBookmarkHere = useCallback(() => {
    if (!currentBook) return;
    const idx = topIndexRef.current;
    addBookmark(currentBook.id, {
      id: `${Date.now()}`,
      offset: Math.round(offsetRef.current),
      index: idx,
      // Trecho maior e cortado na fronteira de palavra → vira uma citação legível (card §2.6).
      snippet: cleanSnippet((translatePT ? ptMap[idx] ?? paragraphs[idx] : paragraphs[idx]) ?? '', 180),
      progress: paragraphs.length > 1 ? idx / (paragraphs.length - 1) : 0,
      createdAt: Date.now(),
    });
  }, [currentBook, addBookmark, paragraphs, translatePT, ptMap]);

  const jumpToBookmark = useCallback((bm: import('@/store/library').Bookmark) => {
    setShowBookmarks(false);
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: bm.offset, animated: false }));
  }, []);

  // Pular para um capítulo pelo índice de parágrafo inicial (Sumário). Usa scrollToIndex —
  // funciona com o getItemLayout estimado, sem renderizar o caminho (não trava — §4.6).
  const jumpToChapter = useCallback((startIndex: number) => {
    setShowBookmarks(false);
    requestAnimationFrame(() => {
      try {
        listRef.current?.scrollToIndex({ index: startIndex, animated: false, viewPosition: 0 });
      } catch {
        // índice ainda não medido — ignora (o getItemLayout cobre os casos normais)
      }
    });
  }, []);

  const listHeader = (
    <View>
      <Text style={[styles.bookLabel, { color: t.textSecondary }]}>{bookLabel}</Text>
      {subtitle ? (
        <Text style={[styles.chapter, { color: t.text, fontFamily: Fonts?.serif }]}>{subtitle}</Text>
      ) : null}
      {translatePT ? (
        <Text style={[styles.ptNote, { color: t.accent }]}>
          🌐 Lendo em português · tradução automática
        </Text>
      ) : null}
      {status}
    </View>
  );

  const goBack = () => (router.canGoBack() ? router.back() : router.navigate('/'));

  return (
    <View style={[styles.root, { backgroundColor: t.background }]}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: t.surface }}>
        <View style={[styles.bar, { borderBottomColor: t.border }]}>
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            hitSlop={8}
            style={[styles.btn, { borderColor: t.border }]}>
            <Text style={{ color: t.text, fontSize: 18 }}>‹</Text>
          </Pressable>

          <View style={styles.group}>
            {ReadingThemeOrder.map((name) => {
              const active = name === themeName;
              const sw = ReadingThemes[name];
              return (
                <Pressable
                  key={name}
                  onPress={() => setThemeName(name)}
                  accessibilityRole="button"
                  accessibilityLabel={`Tema ${ReadingThemeLabel[name]}`}
                  style={[
                    styles.swatch,
                    {
                      backgroundColor: sw.background,
                      borderColor: active ? t.accent : t.border,
                      borderWidth: active ? 2 : 1,
                    },
                  ]}>
                  <Text style={{ color: sw.text, fontSize: 13, fontWeight: active ? '700' : '400' }}>
                    A
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.group}>
            <Pressable
              onPress={decFont}
              accessibilityRole="button"
              accessibilityLabel="Diminuir fonte"
              style={[styles.btn, { borderColor: t.border }]}>
              <Text style={{ color: t.text, fontSize: 13 }}>A−</Text>
            </Pressable>
            <Pressable
              onPress={incFont}
              accessibilityRole="button"
              accessibilityLabel="Aumentar fonte"
              style={[styles.btn, { borderColor: t.border }]}>
              <Text style={{ color: t.text, fontSize: 18 }}>A+</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowA11y(true)}
              accessibilityRole="button"
              accessibilityLabel="Ajustes de leitura e acessibilidade"
              style={[styles.btn, { borderColor: t.border }]}>
              <Text style={{ color: t.text, fontSize: 14, fontWeight: '700' }}>Aa</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => setReaderPrefs({ bionic: !bionic })}
            accessibilityRole="switch"
            accessibilityState={{ checked: bionic }}
            accessibilityLabel="Leitura biônica"
            style={[
              styles.btn,
              {
                borderColor: bionic ? t.accent : t.border,
                backgroundColor: bionic ? t.accent : 'transparent',
              },
            ]}>
            <Text
              style={{ color: bionic ? t.surface : t.textSecondary, fontSize: 13, fontWeight: '700' }}>
              Biônica
            </Text>
          </Pressable>

          <Pressable
            onPress={toggleTranslate}
            accessibilityRole="switch"
            accessibilityState={{ checked: translatePT }}
            accessibilityLabel="Ler em português (tradução automática)"
            style={[
              styles.btn,
              {
                borderColor: translatePT ? t.accent : t.border,
                backgroundColor: translatePT ? t.accent : 'transparent',
              },
            ]}>
            <Text
              style={{ color: translatePT ? t.surface : t.textSecondary, fontSize: 13, fontWeight: '700' }}>
              🌐 PT
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              if (read.state.active) read.stop();
              else startListening(topIndexRef.current); // grátis → leva ao Premium
            }}
            accessibilityRole="button"
            accessibilityLabel="Ouvir em voz alta"
            disabled={paragraphs.length === 0}
            style={[
              styles.btn,
              {
                borderColor: read.state.active ? t.accent : t.border,
                backgroundColor: read.state.active ? t.accent : 'transparent',
                opacity: paragraphs.length === 0 ? 0.4 : 1,
              },
            ]}>
            <Text
              style={{
                color: read.state.active ? t.surface : t.textSecondary,
                fontSize: 13,
                fontWeight: '700',
              }}>
              {hasPremiumVoice ? '🎙️ Ouvir' : '🔊 Ouvir'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {showProgress ? (
        <Pressable
          onPress={() => setShowBookmarks(true)}
          accessibilityRole="button"
          accessibilityLabel={chapters.length > 1 ? 'Sumário, progresso e marcadores' : 'Progresso e marcadores'}
          style={[styles.progressBar, { backgroundColor: t.surface, borderBottomColor: t.border }]}>
          <Text style={{ fontSize: 15 }}>{chapters.length > 1 ? '📑' : '🔖'}{bookmarks.length > 0 ? ` ${bookmarks.length}` : ''}</Text>
          <SessionTimer key={currentBook?.id ?? 'sample'} color={t.accent} />
          <Text style={[styles.progressLabel, { color: t.textSecondary }]} numberOfLines={1}>
            {barChapter || 'Lendo'}
          </Text>
          <View style={[styles.progressTrack, { backgroundColor: t.border }]}>
            <View
              style={[styles.progressFill, { backgroundColor: t.accent, width: `${Math.round(readProgress * 100)}%` }]}
            />
          </View>
          <Text style={[styles.progressPct, { color: t.text }]}>{Math.round(readProgress * 100)}%</Text>
        </Pressable>
      ) : null}

      <FlatList
        key={listKey}
        ref={listRef}
        data={paragraphs}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderItem}
        extraData={`${highlightReading && read.state.active ? read.state.paraIndex : -1}|${
          selection ? `${selection.index}:${selStart}:${selEnd}` : ''
        }|${highlights.length}|${translatePT ? 'pt' : 'o'}|${Object.keys(ptMap).length}`}
        ListHeaderComponent={listHeader}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + 48 }]}
        getItemLayout={getItemLayout}
        initialScrollIndex={initialScrollIndex}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={11}
        onViewableItemsChanged={onViewRef}
        viewabilityConfig={viewabilityConfig}
        onScroll={onScroll}
        onScrollBeginDrag={onScrollBeginDrag}
        scrollEventThrottle={64}
        onMomentumScrollEnd={saveOffset}
        onScrollEndDrag={saveOffset}
        onScrollToIndexFailed={(info) => {
          // Tiro ÚNICO (sem loop): salta para um offset estimado. Não re-tentamos
          // scrollToIndex aqui de propósito — o retry é o que renderizava tudo no
          // caminho e travava. Com initialScrollIndex isto quase nunca dispara.
          listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
        }}
      />

      {read.state.active ? (
        <View
          style={[
            styles.audioBar,
            {
              backgroundColor: t.surface,
              borderTopColor: t.border,
              // Empurra os controles acima da barra de navegação/gestos do sistema.
              paddingBottom: Math.max(22, insets.bottom + 10),
            },
          ]}>
          <Text style={[styles.audioLabel, { color: t.textSecondary }]} numberOfLines={1}>
            {read.state.loading
              ? '⏳ Gerando áudio…'
              : `${read.state.engine === 'premium' ? '🎙️ Voz premium' : '🔊 Ouvindo'} · ¶ ${
                  read.state.paraIndex + 1
                }/${paragraphs.length}${
                  read.state.engine === 'premium' && ttsLeft !== null
                    ? ` · ${ttsLeft.toLocaleString('pt-BR')} restantes`
                    : ''
                }`}
          </Text>
          <View style={styles.audioBtns}>
            <Pressable
              onPress={() => {
                dismissVoiceTip();
                setShowVoiceSheet(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Trocar a voz da leitura"
              style={[styles.audioBtn, { borderColor: t.border }]}>
              <Text style={{ fontSize: 14 }}>🎙️</Text>
            </Pressable>
            <Pressable
              onPress={toggleFollow}
              accessibilityRole="switch"
              accessibilityState={{ checked: follow }}
              accessibilityLabel="Acompanhar a leitura"
              style={[
                styles.audioBtn,
                {
                  borderColor: follow ? t.accent : t.border,
                  backgroundColor: follow ? t.accent : 'transparent',
                },
              ]}>
              <Text style={{ color: follow ? t.surface : t.textSecondary, fontSize: 14 }}>📍</Text>
            </Pressable>
            <Pressable
              onPress={() => setHighlightReading((h) => !h)}
              accessibilityRole="switch"
              accessibilityState={{ checked: highlightReading }}
              accessibilityLabel="Destacar o parágrafo em leitura"
              style={[
                styles.audioBtn,
                {
                  borderColor: highlightReading ? t.accent : t.border,
                  backgroundColor: highlightReading ? t.accent : 'transparent',
                },
              ]}>
              <Text style={{ color: highlightReading ? t.surface : t.textSecondary, fontSize: 14 }}>✨</Text>
            </Pressable>
            <Pressable onPress={read.cycleRate} style={[styles.audioBtn, { borderColor: t.border }]}>
              <Text style={{ color: t.text, fontSize: 13, fontWeight: '700' }}>{read.rate}×</Text>
            </Pressable>
            <Pressable
              onPress={read.state.playing ? read.pause : read.resume}
              disabled={read.state.loading}
              style={[
                styles.audioBtn,
                { borderColor: t.accent, backgroundColor: t.accent, opacity: read.state.loading ? 0.6 : 1 },
              ]}>
              {read.state.loading ? (
                <ActivityIndicator size="small" color={t.surface} />
              ) : (
                <Text style={{ color: t.surface, fontSize: 15, fontWeight: '700' }}>
                  {read.state.playing ? '⏸' : '▶'}
                </Text>
              )}
            </Pressable>
            <Pressable onPress={read.stop} style={[styles.audioBtn, { borderColor: t.border }]}>
              <Text style={{ color: t.text, fontSize: 15 }}>⏹</Text>
            </Pressable>
          </View>

          {/* Tooltip de 1ª vez: aponta o seletor de voz (some para sempre ao tocar). */}
          {voiceTip ? (
            <Pressable
              onPress={dismissVoiceTip}
              style={[styles.voiceTip, { backgroundColor: t.accent }]}>
              <Text style={[styles.voiceTipText, { color: t.surface }]}>
                🌟 Toque no 🎙️ e experimente a voz neural realista
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Menu CONTEXTUAL flutuante (perto do toque) — interface invisível */}
      {selectedWord && wordMode === 'menu' ? (
        <WordPopover
          word={selectedWord.word}
          marked={markedSet.has(selectedWord.word.toLowerCase())}
          t={t}
          x={selectedWord.x}
          y={selectedWord.y}
          onMark={toggleMarkWord}
          onMeaning={() => {
            setWordAuto('significado');
            setWordMode('full');
          }}
          onExplainAI={() => {
            setWordAuto('ia');
            setWordMode('full');
          }}
          onListen={() => {
            startListening(selectedWord.index, selectedWord.charOffset);
            closeWord();
          }}
          onSelect={startSelection}
          highlighted={!!selectedHl}
          onRemoveHighlight={removeSelectedHighlight}
        />
      ) : null}

      {/* Barra de SELEÇÃO de trecho (citação de verdade) */}
      {selection ? (
        <SelectionBar
          preview={selPreview}
          text={paragraphs[selection.index]?.slice(selStart, selEnd) ?? ''}
          t={t}
          onCancel={cancelSelection}
          onHighlight={confirmHighlight}
          onQuote={quoteSelection}
        />
      ) : null}

      {/* Painel COMPLETO (resultado de Significado / ✨ IA) */}
      {selectedWord && wordMode === 'full' ? (
        <WordPanel
          word={selectedWord.word}
          context={selectedWord.context}
          bookId={currentBook?.id}
          bookName={currentBook?.name}
          autoAction={wordAuto}
          t={t}
          onClose={closeWord}
          onListenFromHere={() => startListening(selectedWord.index, selectedWord.charOffset)}
        />
      ) : null}

      {showA11y ? (
        <ReadingA11ySheet t={t} prefs={prefs} setPrefs={setReaderPrefs} onClose={() => setShowA11y(false)} />
      ) : null}

      {showVoiceSheet ? (
        <VoiceSheet
          t={t}
          onApplied={() => {
            // Sessão ativa? Re-fala o parágrafo atual já com a voz nova (troca imediata).
            if (readRef.current.active) read.start(readRef.current.paraIndex);
          }}
          onClose={() => setShowVoiceSheet(false)}
        />
      ) : null}

      {showBookmarks ? (
        <BookmarksSheet
          t={t}
          bookmarks={bookmarks}
          currentLabel={`${barChapter ? `${barChapter} · ` : ''}${Math.round(readProgress * 100)}%`}
          chapters={toc}
          currentChapter={currentTocIndex}
          onAdd={addBookmarkHere}
          onJump={jumpToBookmark}
          onJumpChapter={jumpToChapter}
          onRemove={(id) => currentBook && removeBookmark(currentBook.id, id)}
          onClose={() => setShowBookmarks(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  timer: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'], minWidth: 52 },
  progressLabel: { fontSize: 12, flexShrink: 1, maxWidth: '32%' },
  progressTrack: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%' },
  progressPct: { fontSize: 12, fontWeight: '700', minWidth: 34, textAlign: 'right' },
  group: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  btn: {
    minWidth: 36,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 22, paddingTop: 20 },
  bookLabel: { fontSize: 13, letterSpacing: 0.5, marginBottom: 4 },
  chapter: { fontSize: 23, fontWeight: '600', marginBottom: 20 },
  inlineChapter: { fontSize: 22, fontWeight: '700', marginTop: 18, marginBottom: 14 },
  ptNote: { fontSize: 12, fontWeight: '700', marginBottom: 16 },
  banner: { borderLeftWidth: 3, paddingLeft: 12, paddingVertical: 8, marginBottom: 18 },
  noticeSmall: { fontSize: 13, lineHeight: 19 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  prepTrack: { width: 200, height: 4, borderRadius: 2, marginTop: 12, overflow: 'hidden' },
  prepFill: { height: '100%' },
  audioBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  audioLabel: { fontSize: 13, flexShrink: 1 },
  audioBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  voiceTip: {
    position: 'absolute',
    right: 12,
    top: -40,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  voiceTipText: { fontSize: 13, fontWeight: '700' },
  audioBtn: {
    minWidth: 44,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
