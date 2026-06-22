/**
 * Extrator de texto de PDF (PDF → reflow), conforme decisão em CLAUDE.md §4.9.
 *
 * Estratégia: roda o **pdf.js** dentro de uma WebView invisível (funciona no
 * Expo Go, sem módulo nativo). `getTextContent()` devolve apenas o TEXTO —
 * imagens são naturalmente ignoradas. Reconstruímos parágrafos por heurística
 * (posição vertical das linhas), removendo quebras de linha "duras" do PDF para
 * o texto poder fluir (reflow) e funcionar com Bionic/temas/fonte ajustável.
 *
 * Limitações conhecidas (avisar o usuário):
 * - Precisa de internet (pdf.js vem de CDN). Empacotar offline = melhoria futura.
 * - PDF escaneado (imagem) não tem texto → resultado vazio (precisará de OCR).
 * - Layout complexo (colunas, fórmulas, tabelas) pode sair fora de ordem.
 */
import { File } from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

const PDFJS = '3.11.174';

export type ExtractProgress = { stage: 'loading' } | { stage: 'page'; page: number; total: number };

type Props = {
  uri: string;
  onResult: (text: string, pages: number) => void;
  onError: (message: string) => void;
  onProgress?: (p: ExtractProgress) => void;
};

const HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body>
<script src="https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS}/legacy/build/pdf.min.js"></script>
<script>
(function(){
  function post(o){ try{ if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(JSON.stringify(o)); } }catch(e){} }
  if (typeof pdfjsLib === 'undefined'){
    post({ type:'error', message:'Falha ao carregar o leitor de PDF (verifique a conexao com a internet).' });
    return;
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS}/legacy/build/pdf.worker.min.js';

  function b64ToBytes(b64){
    var bin = atob(b64); var len = bin.length; var bytes = new Uint8Array(len);
    for (var i=0;i<len;i++){ bytes[i] = bin.charCodeAt(i); }
    return bytes;
  }

  function reconstruct(items){
    var lines = []; var curText=''; var curY=null; var curH=null;
    for (var i=0;i<items.length;i++){
      var it = items[i];
      if (typeof it.str !== 'string') continue;
      var y = (it.transform && it.transform.length>5) ? it.transform[5] : null;
      var h = it.height || curH || 10;
      if (curY === null){ curText = it.str; }
      else if (y === null || Math.abs(y - curY) < Math.max(2, h*0.5)){ curText += it.str; }
      else { lines.push({ text: curText, y: curY }); curText = it.str; }
      curY = (y === null ? curY : y); curH = h;
    }
    if (curText.length){ lines.push({ text: curText, y: curY }); }

    var gaps = [];
    for (var j=1;j<lines.length;j++){ if(lines[j].y!=null && lines[j-1].y!=null){ gaps.push(Math.abs(lines[j-1].y - lines[j].y)); } }
    var median = 0;
    if (gaps.length){ var sg = gaps.slice().sort(function(a,b){return a-b;}); median = sg[Math.floor(sg.length/2)]; }

    var out = lines.length ? lines[0].text.replace(/\\s+$/,'') : '';
    for (var k=1;k<lines.length;k++){
      var cur = lines[k].text.replace(/^\\s+|\\s+$/g,'');
      if (!cur) continue;
      var gap = (lines[k].y!=null && lines[k-1].y!=null) ? Math.abs(lines[k-1].y - lines[k].y) : 0;
      var para = median>0 && gap > median*1.6;
      if (para){ out += '\\n\\n' + cur; }
      else if (out.charAt(out.length-1) === '-'){ out = out.slice(0,-1) + cur; }
      else { out += ' ' + cur; }
    }
    return out;
  }

  window.__extract = function(b64){
    post({ type:'progress', stage:'loading' });
    var bytes;
    try { bytes = b64ToBytes(b64); } catch(e){ post({type:'error', message:'Arquivo invalido.'}); return; }
    pdfjsLib.getDocument({ data: bytes, disableFontFace: true, isEvalSupported: false }).promise.then(function(pdf){
      var total = pdf.numPages;
      var MAX_PAGES = 150;
      var cap = total > MAX_PAGES ? MAX_PAGES : total;
      var pages = [];
      function finish(){
        var text = pages.join('\\n\\n');
        if (total > cap){ text += '\\n\\n[Conversao limitada as primeiras ' + cap + ' de ' + total + ' paginas.]'; }
        post({ type:'result', text: text, pages: total });
      }
      function next(p){
        if (p > cap){ finish(); return; }
        pdf.getPage(p).then(function(page){ return page.getTextContent(); }).then(function(content){
          pages.push(reconstruct(content.items));
          post({ type:'progress', stage:'page', page:p, total:cap });
          next(p+1);
        }).catch(function(e){ post({ type:'error', message:(e&&e.message)?e.message:String(e) }); });
      }
      next(1);
    }).catch(function(e){ post({ type:'error', message:(e&&e.message)?e.message:String(e) }); });
  };

  post({ type:'ready' });
})();
</script>
</body></html>`;

export function PdfExtractor({ uri, onResult, onError, onProgress }: Props) {
  const ref = useRef<WebView>(null);
  const [b64, setB64] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const sent = useRef(false);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = useRef(false);

  function clearWatchdog() {
    if (watchdog.current) {
      clearTimeout(watchdog.current);
      watchdog.current = null;
    }
  }
  // Reinicia a cada sinal de vida; se ficar 45s em silêncio, considera travado.
  function bumpWatchdog() {
    clearWatchdog();
    watchdog.current = setTimeout(() => {
      if (!done.current) {
        done.current = true;
        onError(
          'A conversão travou (PDF muito complexo/ilustrado, ou rede lenta). Tente um PDF de texto mais simples e curto.',
        );
      }
    }, 45000);
  }

  useEffect(() => {
    bumpWatchdog();
    return clearWatchdog;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // API nova do expo-file-system: lê qualquer caminho (inclui o cache do
        // DocumentPicker, que a API legacy recusava no Expo Go — "isn't readable").
        const data = await new File(uri).base64();
        // Trava de memória: arquivo grande demais derruba o app (OOM) no Expo Go.
        // base64 length ≈ bytes * 1.37 → ~35 MB de base64 ≈ ~25 MB de arquivo.
        if (data.length > 35 * 1024 * 1024) {
          done.current = true;
          clearWatchdog();
          onError(
            'Este PDF é grande demais para converter no aparelho por enquanto. Use um PDF de texto mais curto (até ~25 MB).',
          );
          return;
        }
        if (!cancelled) setB64(data);
      } catch (e) {
        done.current = true;
        clearWatchdog();
        onError(e instanceof Error ? e.message : 'Falha ao ler o arquivo.');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri]);

  useEffect(() => {
    if (b64 && ready && ref.current && !sent.current) {
      sent.current = true;
      ref.current.injectJavaScript(`window.__extract && window.__extract(${JSON.stringify(b64)});true;`);
    }
  }, [b64, ready]);

  function onMessage(e: WebViewMessageEvent) {
    let msg: { type?: string; text?: string; pages?: number; message?: string } & Partial<{ stage: string; page: number; total: number }>;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return; // só aceitamos JSON do nosso parser; lixo é descartado
    }
    // Validação estrita do canal: só os tipos conhecidos, com campos do tipo certo.
    if (!msg || typeof msg.type !== 'string') return;
    if (done.current) return;
    bumpWatchdog();
    if (msg.type === 'ready') setReady(true);
    else if (msg.type === 'progress') onProgress?.(msg as unknown as ExtractProgress);
    else if (msg.type === 'result') {
      done.current = true;
      clearWatchdog();
      onResult(typeof msg.text === 'string' ? msg.text : '', typeof msg.pages === 'number' ? msg.pages : 0);
    } else if (msg.type === 'error') {
      done.current = true;
      clearWatchdog();
      onError(typeof msg.message === 'string' ? msg.message : 'Erro na conversão do PDF.');
    }
  }

  return (
    <WebView
      ref={ref}
      source={{ html: HTML }}
      originWhitelist={['*']}
      onMessage={onMessage}
      onLoadEnd={() => setReady(true)}
      onError={() => onError('Não foi possível iniciar o conversor de PDF.')}
      javaScriptEnabled
      // Blindagem (CLAUDE.md §4.9): a WebView só processa a string que injetamos —
      // sem acesso ao sistema de arquivos nem a janelas/navegação externas. Reduz a
      // superfície de ataque de um PDF malicioso (XSS/exfiltração).
      allowFileAccess={false}
      allowFileAccessFromFileURLs={false}
      allowUniversalAccessFromFileURLs={false}
      setSupportMultipleWindows={false}
      domStorageEnabled={false}
      style={styles.hidden}
    />
  );
}

const styles = {
  hidden: { width: 0, height: 0, opacity: 0, position: 'absolute' as const },
};
