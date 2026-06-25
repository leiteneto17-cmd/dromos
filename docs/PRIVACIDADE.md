# +leitura — Privacidade (preparação para as lojas)

> Documento de **conformidade** para preencher os formulários obrigatórios das duas lojas
> (Apple *Privacy Nutrition Labels* e Google Play *Data Safety*) e para servir de base à
> **Política de Privacidade** pública. Idioma: PT-BR. Última atualização: 2026-06-22.
>
> ⚠️ Este arquivo descreve o que o app **realmente faz hoje** (auditado no código). Reavaliar
> a cada feature nova que colete/envie dados. Ver CLAUDE.md §4.4 e §4.8.

---

## 0. Princípios (como o app trata dados)

1. **Offline-first / privado por padrão (§4.8):** o que a pessoa lê é íntimo. Biblioteca,
   progresso, vocabulário e marcadores ficam **no aparelho** (arquivo local por usuário). A
   visibilidade de atividades sociais é **privada por padrão**; tornar público é opt-in explícito.
2. **BYOK — a chave da IA é do usuário e fica no device (§5):** a chave de IA/TTS é guardada
   **criptografada** (`expo-secure-store` = Keychain iOS / Keystore Android), **nunca** é enviada
   ao nosso backend nem logada. Sai do aparelho **só** para o provedor que o próprio usuário escolheu.
3. **Sem rastreamento / sem anúncios:** auditado — **nenhum SDK de analytics, ads, crash ou
   tracking** (Firebase, Sentry, Amplitude, Facebook SDK etc.). Não há *App Tracking Transparency*
   a pedir porque não rastreamos o usuário entre apps.
4. **Mínimo necessário às APIs de IA (§5):** ao usar o dicionário/TTS, enviamos só o **trecho**
   (palavra + parágrafo, ou o parágrafo a narrar) — nunca o livro inteiro.

---

## 1. Dados que o app trata (por categoria)

| Dado | Origem | Onde fica | Finalidade |
|---|---|---|---|
| **E-mail + senha** | cadastro/login | Supabase (Auth) | autenticar a conta (login obrigatório, §6) |
| **Nome de exibição + avatar (emoji)** | perfil | Supabase (`profiles`) | identificar o usuário na camada social |
| **Atividades de leitura** (título do livro, tempo, páginas, data, visibilidade) | uso do leitor | local **+** Supabase (`reading_activities`) quando logado | histórico/estatísticas e feed social (privado por padrão) |
| **Conteúdo social gerado** (resenhas, recados/scraps, kudos, follows) | o usuário escreve/age | Supabase | comunidade (§2.6); sujeito a moderação (§4.8) |
| **Biblioteca, progresso, vocabulário, marcadores, metas** | uso do app | **só no aparelho** (arquivo local por usuário) | funcionamento do leitor; não sincronizado hoje |
| **Arquivos de livro importados** (EPUB/PDF) | o usuário importa | **só no aparelho** (`Paths.document`) | leitura; o conteúdo nunca é enviado ao nosso backend |
| **Trecho de texto** (palavra+parágrafo / parágrafo a narrar) | leitor, sob ação do usuário | enviado **direto** ao provedor de IA/TTS escolhido (BYOK) | dicionário contextual e narração (TTS) |
| **Chave de API de IA/TTS** | o usuário cola | **secure-store** no aparelho | chamar o provedor; nunca sai p/ o nosso backend |
| **Buscas no catálogo** (termo digitado) | busca de livros | enviado a Gutendex/Google Books/Open Library | descobrir livros de domínio público |
| **Lembrete de leitura** (horário) | config do usuário | **só no aparelho** (notificação local) | lembrete diário; sem servidor de push |

---

## 2. Terceiros que podem receber dados

| Terceiro | O que recebe | Quando | Observação |
|---|---|---|---|
| **Supabase** (backend nosso) | e-mail, nome/avatar, atividades, conteúdo social | ao logar/usar a camada social | Postgres + RLS (cada um só vê o próprio/permitido) |
| **OpenAI / Anthropic / Google (Gemini)** | trecho (palavra+parágrafo) | usuário aciona o dicionário por IA | **BYOK** — conta/chave do próprio usuário |
| **ElevenLabs** | parágrafo a ser narrado | usuário aciona a voz premium | **BYOK** — conta/chave do próprio usuário |
| **dictionaryapi.dev** | a palavra consultada | dicionário básico (inglês, sem chave) | gratuito, sem conta |
| **Gutendex / Google Books / Open Library** | termo de busca | busca/descoberta no catálogo | só metadados/capas de domínio público |
| **jsDelivr (CDN)** | — (baixa a lib pdf.js) | extração de PDF | nenhum dado do usuário é enviado |

> **Importante p/ a Política:** como o BYOK envia **trechos do livro** ao provedor escolhido pelo
> usuário, a política deve dizer isso claramente e **linkar as políticas** desses provedores. O
> tratamento lá é regido pela conta do próprio usuário no provedor.

---

## 3. Apple — *Privacy Nutrition Labels* (App Store Connect)

**Data Used to Track You:** *Nenhum* (não há tracking entre apps/sites).

**Data Linked to You** (vinculado à identidade, porque há conta):
- **Contact Info → Email Address** — finalidade: *App Functionality* (login).
- **User Content → Other User Content** — atividades de leitura, resenhas, recados (camada social).
- **Identifiers → User ID** — id da conta (Supabase).
- **Contact Info → Name** — nome de exibição.

**Data Not Linked to You:** *Nenhum* hoje (não coletamos diagnósticos/uso anônimo).

**Observações ao preencher:**
- A chave BYOK e os arquivos/trechos de livro **enviados ao provedor de IA** são tratados como
  *"data collected by third parties"* sob a conta do usuário — declarar o fluxo na política, não
  como dado coletado **por nós** (não passa pelo nosso backend).
- Marcar **"Data is encrypted in transit"** (HTTPS em tudo).

---

## 4. Google Play — *Data Safety* (Play Console)

**Coleta e compartilhamento:**
- **Personal info → Email address** — coletado; finalidade: *Account management*; obrigatório.
- **Personal info → Name** — coletado; *Account management / App functionality*.
- **App activity → Other user-generated content** — resenhas, recados, atividades; *App functionality*.
- **App info & performance** — *não coletamos* (sem crash/analytics).
- **Files & docs** — os EPUB/PDF ficam **no dispositivo**; **não** são coletados/enviados ao nosso backend.

**Segurança:**
- ✅ *Data is encrypted in transit*.
- ✅ *Users can request that data be deleted* — **depende de implementar a exclusão de conta** (ver §6).

**Compartilhamento com terceiros:** declarar o envio de **trechos** aos provedores de IA/TTS (BYOK)
e dos **termos de busca** aos catálogos.

---

## 5. Permissões do app e justificativa

| Permissão | Plataforma | Por quê | Texto (já no app.json) |
|---|---|---|---|
| **Notificações** | iOS/Android | lembrete de leitura local (§1b) | (padrão do `expo-notifications`) |
| **Salvar na galeria** (`expo-media-library`) | iOS/Android | salvar o card compartilhável de stats (§2.6) | "Salvar o card de leitura na sua galeria." |
| **Microfone/Câmera/Localização** | — | **não usadas** | — |

---

## 6. ⚠️ Pendências OBRIGATÓRIAS antes de publicar

1. **Exclusão de conta (Apple Guideline 5.1.1(v) + Google): ✅ IMPLEMENTADO (2026-06-22).** Botão
   **"Excluir conta"** em Perfil (com dupla confirmação) → `deleteAccount()` chama a função Supabase
   `delete_current_user()` (`security definer`, apaga de `auth.users`; o `on delete cascade` remove
   perfil/atividades/estante/follows/resenhas/recados/etc.) → desloga → o guard leva ao /login.
   **Pendente:** rodar o `supabase/schema.sql` atualizado (a nova função) e testar com uma conta real.
2. **Política de Privacidade pública (URL):** ambas as lojas exigem uma URL hospedada. **Hoje NÃO
   existe** (há só o domínio `mindreaderapp.com` referenciado). Redigir a partir deste documento e
   hospedar; linkar no app (Perfil → "Privacidade") e nas fichas das lojas.
3. **Login obrigatório × Apple 5.1.1(v) (§4.4/§6):** exigir conta p/ ler o **próprio** EPUB pode ser
   rejeitado. Avaliar "continuar como convidado" / Sign in with Apple antes de submeter.
4. **Disclosure do BYOK:** a política deve explicar que, ao usar IA/TTS, **trechos do livro** vão
   ao provedor escolhido pelo usuário, sob a conta dele, e linkar as políticas desses provedores.
5. **Moderação de UGC (§4.8) — já implementada** (denúncia/bloqueio/filtro/contato em C3); confirmar
   que está acessível e descrita na ficha da loja (requisito de apps com feed/comentários).

---

## 7. Resumo para a ficha da loja (rascunho curto)

> O +leitura é um leitor de livros com foco em aprendizado. Seus livros, progresso e vocabulário
> ficam **no seu aparelho**. Criamos uma conta (e-mail) para a parte social, que é **privada por
> padrão**. Os recursos de IA usam **a sua própria chave** (BYOK), guardada criptografada no
> aparelho — enviamos apenas o trecho necessário, direto ao provedor que você escolher. **Não
> usamos anúncios nem rastreamento.**
