/**
 * Tradução do livro "conforme se lê" (toggle 🌐 Ler em português no leitor).
 *
 * Em vez de traduzir o livro inteiro no download (lento + caro + §5), traduz só os
 * parágrafos que o leitor vai ver, COM PREFETCH de uma janela à frente e CACHE EM DISCO
 * (`translated-<bookId>.json`) — relê instantâneo e sem gastar IA de novo.
 *
 * Usa o `translateToPT` que já existe (BYOK → senão IA grátis/gerida). A fila roda 1 por
 * vez (não estoura rate limit) e nunca trava a UI (é tudo `fetch` assíncrono).
 */
import { File, Paths } from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';

import { translateManyToPT } from '@/services/ai/translate';

/** Parágrafos à frente do topo que pré-traduzimos (esconde a latência). */
const WINDOW = 10;
/**
 * Tamanho-alvo de cada LOTE de tradução (em caracteres) — economiza cota (§5).
 * ~3000 aproveita o teto de saída de 2048 tokens do `ai-proxy` (após o deploy) e o BYOK.
 * Se a resposta vier grande demais pro teto deployado, o `pump` DIVIDE o lote e tenta
 * menor sozinho — então isto é seguro mesmo se o proxy ainda estiver no teto antigo.
 */
const BATCH_CHARS = 3000;
/** Teto de parágrafos por lote (segurança p/ não estourar a saída do modelo). */
const BATCH_MAX = 24;

function cacheFile(bookId: string) {
  return new File(Paths.document, `translated-${bookId}.json`);
}

/** Remove o cache de tradução do livro (ao excluí-lo da biblioteca). */
export function deleteTranslationCache(bookId: string): void {
  try {
    const f = cacheFile(bookId);
    if (f.exists) f.delete();
  } catch {
    // ignora
  }
}

export type BookTranslation = {
  /** índice do parágrafo → tradução PT (só os já traduzidos). */
  map: Record<number, string>;
  /** Garante a tradução de uma janela a partir de `startIndex` (idempotente). */
  ensure: (startIndex: number) => void;
  /** Última mensagem de erro (rede/IA), se houver. */
  error: string | null;
  /** true quando falta login/chave de IA — o leitor desliga o toggle e avisa. */
  needsKey: boolean;
};

export function useBookTranslation(
  bookId: string | undefined,
  paragraphs: string[],
): BookTranslation {
  const [map, setMap] = useState<Record<number, string>>({});
  const mapRef = useRef(map);
  mapRef.current = map;
  const [error, setError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);

  const bookRef = useRef(bookId);
  const queueRef = useRef<number[]>([]);
  const runningRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Troca de livro: zera estado e carrega o cache do disco (se houver).
  useEffect(() => {
    bookRef.current = bookId;
    queueRef.current = [];
    setMap({});
    setError(null);
    setNeedsKey(false);
    if (!bookId) return;
    let alive = true;
    (async () => {
      try {
        const f = cacheFile(bookId);
        if (f.exists) {
          const data = JSON.parse(await f.text()) as Record<number, string>;
          if (alive && data) {
            mapRef.current = data;
            setMap(data);
          }
        }
      } catch {
        // cache ausente/corrompido → ignora
      }
    })();
    return () => {
      alive = false;
    };
  }, [bookId]);

  const persist = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const id = bookRef.current;
      if (!id) return;
      try {
        const f = cacheFile(id);
        if (!f.exists) f.create();
        f.write(JSON.stringify(mapRef.current));
      } catch {
        // ignora falha de escrita
      }
    }, 1500);
  }, []);

  const pump = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;

    // Traduz UM lote. Se falhar por FORMATO/truncação (resposta grande demais pro teto do
    // proxy), DIVIDE em dois e tenta de novo — auto-ajuste ao teto deployado. Retorna false
    // só quando deve PARAR tudo (sem IA / cota estourada).
    const applyBatch = async (idx: number[]): Promise<boolean> => {
      if (idx.length === 0) return true;
      const res = await translateManyToPT(idx.map((i) => paragraphs[i]));
      if (bookRef.current == null) return false; // trocou de livro no meio
      if (res.ok) {
        const next = { ...mapRef.current };
        idx.forEach((i, k) => {
          if (res.texts[k]) next[i] = res.texts[k];
        });
        mapRef.current = next;
        setMap(next);
        persist();
        setError(null);
        return true;
      }
      if (res.needsKey) {
        setNeedsKey(true);
        setError(res.error);
        return false; // sem IA / cota → para tudo (não martela)
      }
      // Falha de formato/truncação → divide o lote e tenta menor.
      if (idx.length > 1) {
        const mid = Math.ceil(idx.length / 2);
        if (!(await applyBatch(idx.slice(0, mid)))) return false;
        return applyBatch(idx.slice(mid));
      }
      // 1 parágrafo só e ainda falhou → desiste DESTE (mostra o original) e segue.
      setError(res.error);
      return true;
    };

    try {
      while (queueRef.current.length) {
        // Monta um LOTE de índices pendentes (até ~3000 chars / 24 parágrafos) → 1 chamada
        // de IA por lote em vez de 1 por parágrafo (economiza cota, §5).
        const batchIdx: number[] = [];
        let chars = 0;
        while (queueRef.current.length && chars < BATCH_CHARS && batchIdx.length < BATCH_MAX) {
          const i = queueRef.current.shift();
          if (i == null || mapRef.current[i] != null) continue;
          const src = paragraphs[i];
          if (!src || !src.trim()) continue;
          batchIdx.push(i);
          chars += src.length;
        }
        if (batchIdx.length === 0) continue;
        if (!(await applyBatch(batchIdx))) {
          queueRef.current = [];
          break;
        }
      }
    } finally {
      runningRef.current = false;
    }
  }, [paragraphs, persist]);

  const ensure = useCallback(
    (startIndex: number) => {
      const end = Math.min(paragraphs.length, Math.max(0, startIndex) + WINDOW);
      for (let i = Math.max(0, startIndex); i < end; i++) {
        if (mapRef.current[i] == null && !queueRef.current.includes(i)) queueRef.current.push(i);
      }
      void pump();
    },
    [paragraphs.length, pump],
  );

  return { map, ensure, error, needsKey };
}
