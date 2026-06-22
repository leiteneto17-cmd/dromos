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
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { BionicParagraph } from '@/components/bionic-text';
import { BookmarksSheet } from '@/components/bookmarks-sheet';
import { WordPanel } from '@/components/word-panel';
import { BottomTabInset, Fonts } from '@/constants/theme';
import { useReadAloud } from '@/hooks/use-read-aloud';
import {
  loadPreparedCache,
  prepareEpub,
  savePreparedCache,
  type PreparedEpub,
} from '@/services/epub-parser';
import { getUsage } from '@/services/ai/tts';
import { PdfExtractor, type ExtractProgress } from '@/services/pdf-extractor';
import { cleanWord, splitParagraphs } from '@/services/text-utils';
import { syncActivities } from '@/services/activity-sync';
import { getTtsKey, useAI } from '@/store/ai';
import { useLibrary } from '@/store/library';
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

/** ~parágrafos por "página equivalente" (EPUB/PDF reflow não têm páginas reais — §4.9). */
const PARAS_PER_PAGE = 4;

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
  const [themeName, setThemeName] = useState<ReadingThemeName>('sepia');
  const [fontSize, setFontSize] = useState<number>(FontSizeRange.default);
  const [bionic, setBionic] = useState<boolean>(true);
  // Realça o PARÁGRAFO que o áudio está lendo (leitura direcionada). Leve: muda no
  // máximo 1× por parágrafo. Pode ser desligado por quem prefere ouvir sem destaque.
  const [highlightReading, setHighlightReading] = useState<boolean>(true);
  // "Acompanhar": a tela rola sozinha seguindo o parágrafo falado (estilo teleprompter).
  // Desliga automaticamente quando o usuário rola manualmente — não brigar com o dedo.
  const [follow, setFollow] = useState<boolean>(true);

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
  } | null>(null);
  const [showBookmarks, setShowBookmarks] = useState(false);

  const listRef = useRef<FlatList<string>>(null);
  const topIndexRef = useRef(0);
  topIndexRef.current = topIndex;
  const offsetRef = useRef(0); // offset de rolagem atual (p/ salvar marcador/posição)
  const restoredRef = useRef(false); // posição já restaurada ao abrir?
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
  const addReadingTime = useLibrary((s) => s.addReadingTime);
  const addSession = useLibrary((s) => s.addSession);
  const bookmarks = useLibrary((s) => (currentBook ? s.bookmarks[currentBook.id] ?? EMPTY_BM : EMPTY_BM));
  const addBookmark = useLibrary((s) => s.addBookmark);
  const removeBookmark = useLibrary((s) => s.removeBookmark);
  const hasPremiumVoice = useAI((s) => s.hasTtsKey);

  const t = ReadingThemes[themeName];
  const lineHeight = Math.round(fontSize * LineHeightRatio);
  const paragraphSpacing = Math.round(fontSize * 0.9);

  const decFont = () => setFontSize((s) => Math.max(FontSizeRange.min, s - FontSizeRange.step));
  const incFont = () => setFontSize((s) => Math.min(FontSizeRange.max, s + FontSizeRange.step));

  const isPdf = currentBook?.format === 'pdf';
  const isEpub = currentBook?.format === 'epub';
  const extracted = currentBook?.text;
  const extractError = currentBook?.extractError;
  const extracting = !!currentBook && isPdf && extracted === undefined && extractError === undefined;

  // Título "limpo" do livro (sem autor) p/ a sessão de leitura — atualizado a cada render
  // e lido na finalização da sessão (cleanup do useFocusEffect).
  sessionTitleRef.current = currentBook
    ? isEpub
      ? epubBook?.data.title ?? currentBook.name
      : currentBook.name
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
    restoredRef.current = false;

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
      const id = setInterval(() => {
        addReadingTime(TICK);
        sessionSeconds += TICK;
      }, TICK * 1000);
      return () => {
        clearInterval(id);
        if (sessionSeconds < TICK) return; // ignora "passadas" curtas (não vira atividade)
        const parasRead = Math.max(0, topIndexRef.current - startIndex);
        addSession({
          id: `s-${startedAt}`,
          bookId: currentBook.id,
          bookTitle: sessionTitleRef.current || currentBook.name,
          format: currentBook.format,
          seconds: sessionSeconds,
          pages: Math.round(parasRead / PARAS_PER_PAGE),
          startedAt,
          createdAt: Date.now(),
          synced: false,
        });
        // Sobe pro Supabase se logado (no-op se deslogado/offline — tenta de novo depois).
        void syncActivities();
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

  // Audiobook assistido. Lê o livro a partir do parágrafo no topo da tela.
  const read = useReadAloud(paragraphs);
  const readRef = useRef(read.state);
  readRef.current = read.state;

  // Restaura a posição de leitura por OFFSET de rolagem (não por scrollToIndex, que
  // numa lista gigante renderiza tudo até o alvo e trava). Uma vez, ao abrir o livro.
  useEffect(() => {
    if (restoredRef.current || !currentBook || paragraphs.length === 0) return;
    restoredRef.current = true;
    const savedY = useLibrary.getState().positions[currentBook.id] ?? 0;
    if (savedY > 0) {
      requestAnimationFrame(() =>
        listRef.current?.scrollToOffset({ offset: savedY, animated: false }),
      );
    }
  }, [currentBook, paragraphs.length]);

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
      bookLabel = currentBook.name;
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
    (word: string, paragraph: string, index: number, charOffset: number) => {
      const clean = cleanWord(word);
      if (clean) setSelectedWord({ word: clean, context: paragraph, index, charOffset });
    },
    [],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: string; index: number }) => {
      const r = readRef.current;
      const activePara = highlightReading && r.active && index === r.paraIndex;
      const heading = chapterTitleAt.get(index); // título de capítulo inline (estilo livro)
      return (
        <View>
          {heading ? (
            <Text style={[styles.inlineChapter, { color: t.text, fontFamily: Fonts?.serif }]}>
              {heading}
            </Text>
          ) : null}
          <BionicParagraph
            text={item}
            bionic={bionic}
            color={t.text}
            fontSize={fontSize}
            lineHeight={lineHeight}
            fontFamily={Fonts?.serif}
            marginBottom={paragraphSpacing}
            paraIndex={index}
            onWordPress={handleWord}
            markedSet={markedSet}
            highlightColor={t.highlight}
            activePara={activePara}
            activeColor={t.accent + '22'}
          />
        </View>
      );
    },
    [bionic, t, fontSize, lineHeight, paragraphSpacing, handleWord, markedSet, chapterTitleAt, highlightReading],
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

  // O usuário pegou a lista com o dedo → para de acompanhar (não arrancar a tela de volta).
  const onScrollBeginDrag = useCallback(() => {
    if (followRef.current) setFollow(false);
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
      snippet: (paragraphs[idx] ?? '').slice(0, 90),
      progress: paragraphs.length > 1 ? idx / (paragraphs.length - 1) : 0,
      createdAt: Date.now(),
    });
  }, [currentBook, addBookmark, paragraphs]);

  const jumpToBookmark = useCallback((bm: import('@/store/library').Bookmark) => {
    setShowBookmarks(false);
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: bm.offset, animated: false }));
  }, []);

  const listHeader = (
    <View>
      <Text style={[styles.bookLabel, { color: t.textSecondary }]}>{bookLabel}</Text>
      {subtitle ? (
        <Text style={[styles.chapter, { color: t.text, fontFamily: Fonts?.serif }]}>{subtitle}</Text>
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
          </View>

          <Pressable
            onPress={() => setBionic((b) => !b)}
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
            onPress={() => {
              if (read.state.active) read.stop();
              else {
                setFollow(true); // nova sessão começa acompanhando
                read.start(topIndexRef.current);
              }
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
          accessibilityLabel="Progresso e marcadores"
          style={[styles.progressBar, { backgroundColor: t.surface, borderBottomColor: t.border }]}>
          <Text style={{ fontSize: 15 }}>🔖{bookmarks.length > 0 ? ` ${bookmarks.length}` : ''}</Text>
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
        ref={listRef}
        data={paragraphs}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderItem}
        extraData={highlightReading && read.state.active ? read.state.paraIndex : -1}
        ListHeaderComponent={listHeader}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + 48 }]}
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
        onScrollToIndexFailed={() => {
          /* índice fora do alcance medido — ignora (a leitura continua) */
        }}
      />

      {read.state.active ? (
        <View style={[styles.audioBar, { backgroundColor: t.surface, borderTopColor: t.border }]}>
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
        </View>
      ) : null}

      {selectedWord ? (
        <WordPanel
          word={selectedWord.word}
          context={selectedWord.context}
          bookId={currentBook?.id}
          bookName={currentBook?.name}
          t={t}
          onClose={() => setSelectedWord(null)}
          onListenFromHere={() => {
            setFollow(true);
            read.start(selectedWord.index, selectedWord.charOffset);
          }}
        />
      ) : null}

      {showBookmarks ? (
        <BookmarksSheet
          t={t}
          bookmarks={bookmarks}
          currentLabel={`${barChapter ? `${barChapter} · ` : ''}${Math.round(readProgress * 100)}%`}
          onAdd={addBookmarkHere}
          onJump={jumpToBookmark}
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
  progressLabel: { fontSize: 12, flexShrink: 1, maxWidth: '45%' },
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
