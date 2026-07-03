# PDF — Status
*Atualizado: 2026-07-03*

## Estado atual
- PDF suportado com dois modos (CLAUDE.md §4.9): **reflow por padrão** (extração de texto
  no device via pdf.js → habilita Bionic/TTS/dicionário) e **página fiel como fallback**
  (PDFs complexos/escaneados).
- Modelo de dados: livro tem `formato` (epub|pdf) e `modo` (reflow|fixo); progresso e
  estatísticas funcionam para os dois.

## Decisões firmadas (ADR resumido)
- Converter para reflow por padrão; avisar quando a qualidade da conversão for baixa e
  oferecer página fiel (decisão do usuário — §4.9).
- OCR de PDF escaneado = recurso **premium** (Tesseract no device é pesado; OCR na nuvem
  tem custo).
- Preferir pdf.js em WebView enquanto em Expo Go; `react-native-pdf` exigiria dev client.

## Roadmap / próximos passos
1. OCR gerido (premium) — sem data; depende de validação do premium primeiro.
2. Nada urgente neste módulo — estável; mudanças aqui devem passar pelo detector de
   camada de texto antes de mexer no fluxo de importação.
