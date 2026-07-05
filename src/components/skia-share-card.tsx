/**
 * Card compartilhável em SKIA (motor do Flutter dentro do RN) — o único jeito de exportar
 * um PNG REALMENTE TRANSPARENTE no Android (o react-native-view-shot achata alpha em preto).
 * Desenha o resumo de leitura numa Canvas e exporta via makeImageSnapshot → base64 (com alpha).
 *
 * Só o modelo "Transparente" usa este renderer; os opacos (Foto/Capa/Escuro) seguem no
 * ShareableCard normal (view-shot dá conta deles). Layout por coordenadas (Skia não é flexbox):
 * ajuste fino de posição é esperado. Sem emojis (Skia não rasteriza emoji com fonte de texto).
 */
import {
  Canvas,
  Group,
  RoundedRect,
  Text as SkText,
  useCanvasRef,
  useFont,
  type SkFont,
} from '@shopify/react-native-skia';
import { forwardRef, useImperativeHandle } from 'react';

import { deriveStats } from '@/services/progress';
import { fmtHMS } from '@/services/progress';
import { useLibrary } from '@/store/library';

const POPPINS_BOLD = require('@expo-google-fonts/poppins/700Bold/Poppins_700Bold.ttf');
const POPPINS_MED = require('@expo-google-fonts/poppins/500Medium/Poppins_500Medium.ttf');

// Cores da marca (GUIA-DE-MARCA §3).
const GREEN = '#5EF0A0';
const LAVENDER = '#B9A6E8';
const WHITE = '#EDEAF5';

export const CARD_W = 460;
export const CARD_H = 640;

export type SkiaCardHandle = { exportBase64: () => string | null };

/** Texto centrado horizontalmente na Canvas. */
function Centered({ text, y, font, color }: { text: string; y: number; font: SkFont; color: string }) {
  const w = font.getTextWidth(text);
  return <SkText x={(CARD_W - w) / 2} y={y} text={text} font={font} color={color} />;
}

export const SkiaShareCard = forwardRef<SkiaCardHandle>(function SkiaShareCard(_props, ref) {
  const canvasRef = useCanvasRef();
  const stats = useLibrary((s) => s.stats);
  const booksCount = useLibrary((s) => s.books.length);
  const d = deriveStats(stats);

  const fTitle = useFont(POPPINS_BOLD, 44);
  const fValue = useFont(POPPINS_BOLD, 34);
  const fLogo = useFont(POPPINS_BOLD, 26);
  const fKicker = useFont(POPPINS_MED, 16);
  const fLabel = useFont(POPPINS_MED, 19);
  const fMeta = useFont(POPPINS_BOLD, 22);

  useImperativeHandle(ref, () => ({
    exportBase64: () => {
      const img = canvasRef.current?.makeImageSnapshot();
      // PNG por padrão → preserva o canal alpha (fundo transparente de verdade).
      return img ? img.encodeToBase64() : null;
    },
  }));

  const ready = fTitle && fValue && fLogo && fKicker && fLabel && fMeta;

  return (
    <Canvas ref={canvasRef} style={{ width: CARD_W, height: CARD_H }}>
      {ready ? (
        <Group>
          <Centered text="Progresso" y={64} font={fKicker!} color={LAVENDER} />
          <Centered text="Minha Leitura" y={116} font={fTitle!} color={GREEN} />

          <Centered
            text={`${booksCount} ${booksCount === 1 ? 'livro' : 'livros'}    ${d.activeDays} ${d.activeDays === 1 ? 'dia' : 'dias'}`}
            y={162}
            font={fMeta!}
            color={WHITE}
          />

          <Centered text="Consistência" y={236} font={fKicker!} color={LAVENDER} />
          <Centered text="Média de Leitura" y={266} font={fLabel!} color={WHITE} />
          <Centered text={`${d.avgMinPerDay}m /dia`} y={312} font={fValue!} color={GREEN} />

          <Centered text="Dedicado" y={386} font={fKicker!} color={LAVENDER} />
          <Centered text="Tempo Total de Leitura" y={416} font={fLabel!} color={WHITE} />
          <Centered text={fmtHMS(d.totalSeconds)} y={462} font={fValue!} color={GREEN} />

          {/* Caixa do streak (borda lavanda arredondada) */}
          <RoundedRect
            x={CARD_W / 2 - 150}
            y={510}
            width={300}
            height={46}
            r={23}
            color={LAVENDER}
            style="stroke"
            strokeWidth={1.5}
          />
          <Centered
            text={`${d.streak} ${d.streak === 1 ? 'dia seguido' : 'dias seguidos'} · Nível ${d.level}`}
            y={539}
            font={fLabel!}
            color={LAVENDER}
          />

          <Centered text="Dromos" y={604} font={fLogo!} color={GREEN} />
        </Group>
      ) : null}
    </Canvas>
  );
});
