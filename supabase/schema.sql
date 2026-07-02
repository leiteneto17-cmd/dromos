-- =====================================================================
-- +leitura — Schema do banco (Supabase / Postgres)
-- Rodar UMA VEZ no painel: SQL Editor → New query → colar tudo → Run.
-- Seguro reexecutar (idempotente: "if not exists" / "or replace").
--
-- Princípios (CLAUDE.md §4.8):
--  - RLS LIGADO em tudo. Cada um só mexe nos próprios dados.
--  - Atividades nascem PRIVADAS por padrão (visibility = 'private').
--  - O perfil é legível por todos (o feed mostra nome/avatar de quem você segue).
-- =====================================================================

-- ---------- PERFIS (1:1 com auth.users) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  avatar_url text,            -- emoji (ex.: "🦉") por enquanto; depois pode virar URL de foto
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- SELECT: evita ENUMERAÇÃO de todos os usuários via anon key (§4.8). Um perfil é
-- legível se é PÚBLICO, se é o meu, ou se há follow ACEITO entre nós (qualquer direção
-- — cobre o feed/listas de quem eu sigo). Perfis privados de estranhos ficam ocultos.
-- (Referencia follows, cuja policy NÃO referencia profiles → sem recursão de RLS.)
drop policy if exists "perfis legíveis por autenticados" on public.profiles;
drop policy if exists "perfis visíveis (público, eu, ou follow aceito)" on public.profiles;
create policy "perfis visíveis (público, eu, ou follow aceito)"
  on public.profiles for select
  to authenticated
  using (
    is_public
    or auth.uid() = id
    or exists (
      select 1 from public.follows f
      where f.status = 'accepted'
        and ((f.follower_id = auth.uid() and f.followee_id = id)
          or (f.followee_id = auth.uid() and f.follower_id = id))
    )
  );

drop policy if exists "dono insere o próprio perfil" on public.profiles;
create policy "dono insere o próprio perfil"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "dono atualiza o próprio perfil" on public.profiles;
create policy "dono atualiza o próprio perfil"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------- ATIVIDADES DE LEITURA (sessões estilo Strava) ----------
create table if not exists public.reading_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  book_title text not null,
  book_format text,                       -- 'epub' | 'pdf'
  seconds integer not null default 0,     -- tempo de leitura da sessão
  pages integer,                          -- páginas (ou equivalentes) lidas
  started_at timestamptz,
  created_at timestamptz not null default now(),
  visibility text not null default 'friends'  -- 'private' (só o dono) | 'friends' (seguidores aceitos) | 'public'
);

alter table public.reading_activities enable row level security;

-- Por enquanto cada um só vê as PRÓPRIAS atividades. Quando o feed (Fase 5b)
-- entrar, a policy de SELECT será ampliada para amigos/públicas.
drop policy if exists "dono vê suas atividades" on public.reading_activities;
create policy "dono vê suas atividades"
  on public.reading_activities for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "dono insere atividade" on public.reading_activities;
create policy "dono insere atividade"
  on public.reading_activities for insert
  to authenticated
  with check (auth.uid() = user_id);

-- WITH CHECK impede reatribuir a atividade a outro usuário ao atualizar
-- (sem ele, o dono poderia trocar o user_id da própria linha).
drop policy if exists "dono atualiza atividade" on public.reading_activities;
create policy "dono atualiza atividade"
  on public.reading_activities for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "dono apaga atividade" on public.reading_activities;
create policy "dono apaga atividade"
  on public.reading_activities for delete
  to authenticated
  using (auth.uid() = user_id);

create index if not exists reading_activities_user_created_idx
  on public.reading_activities (user_id, created_at desc);

-- ---------- updated_at automático ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------- cria o perfil automaticamente ao cadastrar ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- COMUNIDADE POR LIVRO (Fase 5b) — ESTANTE por status, estilo Skoob.
-- Identidade do livro = `book_key` (título normalizado: minúsculo/sem acento/trim),
-- gerado no app (src/services/community.ts). ISBN guardado à parte. Metadados (capa/
-- autor) vêm de catálogo externo (Google Books + Open Library) e ficam denormalizados.
-- =====================================================================
create table if not exists public.book_shelves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  book_key text not null,
  status text not null check (status in ('lendo','quero_ler','lido','relendo','abandonei')),
  book_title text not null,
  book_author text,
  cover_url text,
  isbn text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, book_key)
);

alter table public.book_shelves enable row level security;

-- Cada um só ENXERGA/gerencia a própria estante (o que você lê é íntimo, §4.8).
-- As contagens agregadas vêm das funções SECURITY DEFINER abaixo (só números).
drop policy if exists "dono vê sua estante" on public.book_shelves;
create policy "dono vê sua estante"
  on public.book_shelves for select to authenticated using (auth.uid() = user_id);

drop policy if exists "dono adiciona à estante" on public.book_shelves;
create policy "dono adiciona à estante"
  on public.book_shelves for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "dono atualiza a estante" on public.book_shelves;
create policy "dono atualiza a estante"
  on public.book_shelves for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "dono remove da estante" on public.book_shelves;
create policy "dono remove da estante"
  on public.book_shelves for delete to authenticated using (auth.uid() = user_id);

create index if not exists book_shelves_key_idx on public.book_shelves (book_key);

drop trigger if exists book_shelves_touch on public.book_shelves;
create trigger book_shelves_touch
  before update on public.book_shelves
  for each row execute function public.touch_updated_at();

-- Leitores totais por livro (agregado, SEM expor identidades — §4.8).
-- DROP antes do CREATE: a versão antiga tinha outra assinatura de retorno.
drop function if exists public.popular_books(int);
create or replace function public.popular_books(p_limit int default 30)
returns table (book_key text, book_title text, cover_url text, reader_count bigint)
language sql security definer set search_path = public stable as $$
  select book_key, min(book_title) as book_title, min(cover_url) as cover_url,
         count(distinct user_id) as reader_count
  from public.book_shelves
  group by book_key
  order by reader_count desc, book_title asc
  limit greatest(1, least(p_limit, 100));
$$;
grant execute on function public.popular_books(int) to authenticated;

-- Contagem por STATUS de um livro (p/ a página do livro: lendo/quero ler/lido/...).
create or replace function public.book_status_counts(p_book_key text)
returns table (status text, n bigint)
language sql security definer set search_path = public stable as $$
  select status, count(distinct user_id) as n
  from public.book_shelves
  where book_key = p_book_key
  group by status;
$$;
grant execute on function public.book_status_counts(text) to authenticated;

-- =====================================================================
-- PRÉ-REQUISITOS p/ policies que vêm a seguir referenciarem estas colunas/tabela
-- (perfil público + follows.status). As definições completas — trigger, RLS, índices —
-- estão na seção "CAMADA SOCIAL" mais abaixo; aqui é só garantir que existam ANTES,
-- pois a policy de resenhas (C3) já filtra por follows.status (seguidor aceito).
-- =====================================================================
alter table public.profiles add column if not exists is_public boolean not null default false;
create table if not exists public.follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  followee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'accepted' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id)
);
alter table public.follows add column if not exists status text not null default 'accepted'
  check (status in ('pending', 'accepted'));

-- =====================================================================
-- C3 — RESENHAS + MODERAÇÃO (Fase 5b). Obrigatório p/ as lojas (Apple 1.2 / §4.8):
-- denúncia, bloqueio e filtro de palavrão. Resenhas são PÚBLICAS (o usuário escolhe
-- escrever = publicar), mas escondidas entre quem se bloqueou (nos dois sentidos).
-- =====================================================================

-- ---------- BLOQUEIO de usuários (precisa existir ANTES da policy de resenhas) ----------
create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id)
);

alter table public.user_blocks enable row level security;

drop policy if exists "dono vê seus bloqueios" on public.user_blocks;
create policy "dono vê seus bloqueios"
  on public.user_blocks for select to authenticated using (auth.uid() = blocker_id);

drop policy if exists "dono cria bloqueio" on public.user_blocks;
create policy "dono cria bloqueio"
  on public.user_blocks for insert to authenticated
  with check (auth.uid() = blocker_id and blocked_id <> auth.uid());

drop policy if exists "dono remove bloqueio" on public.user_blocks;
create policy "dono remove bloqueio"
  on public.user_blocks for delete to authenticated using (auth.uid() = blocker_id);

-- ---------- DENÚNCIAS (visíveis só p/ quem denunciou + admin no painel) ----------
create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  target_type text not null,                 -- 'review'
  target_id uuid,                            -- id do conteúdo denunciado
  target_user_id uuid,                       -- autor denunciado (ajuda a moderação)
  reason text,
  created_at timestamptz not null default now()
);

alter table public.content_reports enable row level security;

drop policy if exists "dono vê suas denúncias" on public.content_reports;
create policy "dono vê suas denúncias"
  on public.content_reports for select to authenticated using (auth.uid() = reporter_id);

drop policy if exists "dono cria denúncia" on public.content_reports;
create policy "dono cria denúncia"
  on public.content_reports for insert to authenticated with check (auth.uid() = reporter_id);

-- ---------- RESENHAS por livro (nota 1–5 + texto) ----------
create table if not exists public.book_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  book_key text not null,
  book_title text not null,
  rating int not null check (rating between 1 and 5),
  text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, book_key)
);

alter table public.book_reviews enable row level security;

-- Visível se o autor é PÚBLICO, sou eu, ou eu o sigo (aceito) — gateando resenhas de
-- perfis PRIVADOS (§4.8). E nunca envolvendo um bloqueio (qualquer direção).
drop policy if exists "ler resenhas exceto bloqueados" on public.book_reviews;
create policy "ler resenhas exceto bloqueados"
  on public.book_reviews for select to authenticated
  using (
    not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = book_reviews.user_id)
         or (b.blocker_id = book_reviews.user_id and b.blocked_id = auth.uid())
    )
    and (
      auth.uid() = user_id
      or exists (select 1 from public.profiles p where p.id = user_id and p.is_public)
      or exists (select 1 from public.follows f
                 where f.follower_id = auth.uid() and f.followee_id = user_id and f.status = 'accepted')
    )
  );

drop policy if exists "dono escreve resenha" on public.book_reviews;
create policy "dono escreve resenha"
  on public.book_reviews for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "dono edita resenha" on public.book_reviews;
create policy "dono edita resenha"
  on public.book_reviews for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "dono apaga resenha" on public.book_reviews;
create policy "dono apaga resenha"
  on public.book_reviews for delete to authenticated using (auth.uid() = user_id);

create index if not exists book_reviews_key_idx on public.book_reviews (book_key);

drop trigger if exists book_reviews_touch on public.book_reviews;
create trigger book_reviews_touch
  before update on public.book_reviews
  for each row execute function public.touch_updated_at();

-- Média + nº de resenhas de um livro (agregado, só números — §4.8).
-- SECURITY DEFINER: a média considera todas as resenhas (não filtra bloqueio — é só estatística).
create or replace function public.book_rating(p_book_key text)
returns table (avg_rating numeric, n bigint)
language sql security definer set search_path = public stable as $$
  select round(avg(rating)::numeric, 1) as avg_rating, count(*) as n
  from public.book_reviews
  where book_key = p_book_key;
$$;
grant execute on function public.book_rating(text) to authenticated;

-- =====================================================================
-- COLEÇÕES da estante (grupos personalizados do usuário, p/ organizar quando a
-- estante fica longa). Privadas (RLS dono). Cada livro da estante pode estar em UMA
-- coleção (coluna collection_id em book_shelves).
-- =====================================================================
create table if not exists public.shelf_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.shelf_collections enable row level security;

drop policy if exists "dono vê suas coleções" on public.shelf_collections;
create policy "dono vê suas coleções"
  on public.shelf_collections for select to authenticated using (auth.uid() = user_id);

drop policy if exists "dono cria coleção" on public.shelf_collections;
create policy "dono cria coleção"
  on public.shelf_collections for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "dono renomeia coleção" on public.shelf_collections;
create policy "dono renomeia coleção"
  on public.shelf_collections for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "dono apaga coleção" on public.shelf_collections;
create policy "dono apaga coleção"
  on public.shelf_collections for delete to authenticated using (auth.uid() = user_id);

-- Liga o livro da estante a uma coleção (apaga a coleção → o livro volta p/ "sem coleção").
alter table public.book_shelves
  add column if not exists collection_id uuid references public.shelf_collections (id) on delete set null;

-- =====================================================================
-- CAMADA SOCIAL ABERTA (opt-in) — follows + feed estilo Strava.
-- Princípio (§4.8): PRIVADO por padrão; a pessoa ESCOLHE tornar o perfil público.
-- Só quem é público aparece em "quem está lendo", tem perfil visível e entra no feed.
-- =====================================================================

-- Perfil público? (default false = privado, respeitando §4.8)
alter table public.profiles add column if not exists is_public boolean not null default false;

-- Emblemas (conquistas) DESBLOQUEADOS — array de ids (ex.: ["first-book","streak-7"]) p/
-- aparecerem no perfil PÚBLICO. O catálogo/arte mora no app (services/progress.ts +
-- theme/medals.ts); aqui guardamos só quais foram conquistados. Lê junto com o profile
-- (mesma policy de leitura), então segue a visibilidade do perfil.
alter table public.profiles add column if not exists badges jsonb not null default '[]'::jsonb;

-- Brasão de FUNDADOR (os 50 PRIMEIROS cadastrados). Atribuído no servidor (handle_new_user,
-- no fim do arquivo, com trava de concorrência). Lido junto com o profile (visível no perfil).
alter table public.profiles add column if not exists is_founder boolean not null default false;

-- Destaque de fundador LIGADO/DESLIGADO (o fundador escolhe exibir ou não os realces:
-- anel no avatar, linha "entre os 50 primeiros", nome verde no feed/mural, selo no card).
-- Default true (mostra). Lido junto com o profile → vale também nas telas sociais de terceiros.
alter table public.profiles add column if not exists founder_flair boolean not null default true;

-- ---------- SEGUIR leitores (com PEDIDO/APROVAÇÃO p/ perfis privados) ----------
-- Perfil PÚBLICO: seguir é aceito na hora. PRIVADO: vira PEDIDO (status 'pending') que
-- o dono aprova. O trigger abaixo define o status (cliente não escolhe — segurança).
create table if not exists public.follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  followee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'accepted' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id)
);
-- migração: tabela já existia sem a coluna → adiciona (follows antigos = aceitos)
alter table public.follows add column if not exists status text not null default 'accepted'
  check (status in ('pending', 'accepted'));

alter table public.follows enable row level security;

-- Define o status no INSERT conforme o perfil-alvo (público=accepted, privado=pending).
create or replace function public.set_follow_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles p where p.id = new.followee_id and p.is_public) then
    new.status := 'accepted';
  else
    new.status := 'pending';
  end if;
  return new;
end; $$;
drop trigger if exists follows_set_status on public.follows;
create trigger follows_set_status before insert on public.follows
  for each row execute function public.set_follow_status();

drop policy if exists "follows legíveis" on public.follows;
-- SELECT: vínculos ACEITOS são legíveis (contadores, listas seguidores/seguindo, checagem
-- do feed). PEDIDOS pendentes (seguir perfil privado) ficam visíveis SÓ p/ as duas partes —
-- não vazar "fulano pediu p/ seguir sicrano" a terceiros (privacidade, §4.8).
create policy "follows legíveis" on public.follows for select to authenticated
  using (status = 'accepted' or auth.uid() = follower_id or auth.uid() = followee_id);

drop policy if exists "dono segue" on public.follows;
create policy "dono segue" on public.follows for insert to authenticated
  with check (auth.uid() = follower_id and follower_id <> followee_id);

-- O DONO (followee) aprova um pedido (status → accepted).
drop policy if exists "dono aceita seguidor" on public.follows;
create policy "dono aceita seguidor" on public.follows for update to authenticated
  using (auth.uid() = followee_id) with check (auth.uid() = followee_id);

-- Deixar de seguir / cancelar pedido (follower) OU recusar/remover seguidor (followee).
drop policy if exists "dono deixa de seguir" on public.follows;
create policy "dono deixa de seguir" on public.follows for delete to authenticated
  using (auth.uid() = follower_id or auth.uid() = followee_id);

-- Ver a ESTANTE de quem é PÚBLICO ou de quem me aceitou como seguidor.
drop policy if exists "ver estante de perfil público" on public.book_shelves;
drop policy if exists "ver estante (público ou seguidor aceito)" on public.book_shelves;
create policy "ver estante (público ou seguidor aceito)" on public.book_shelves for select to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = user_id and p.is_public)
    or exists (select 1 from public.follows f
               where f.follower_id = auth.uid() and f.followee_id = user_id and f.status = 'accepted')
  );

-- #5: a coluna `visibility` agora é RESPEITADA. Default passou p/ 'friends' (compartilhar
-- com seguidores aceitos = o comportamento de fato do feed). Uma atividade 'private' fica
-- visível SÓ p/ o dono (pela policy "dono vê suas atividades"), escondida até dos seguidores.
-- Em DBs já existentes, garante o novo default (idempotente; NÃO mexe nos valores das linhas).
alter table public.reading_activities alter column visibility set default 'friends';

-- Ver as ATIVIDADES de quem eu sigo (aceito), exceto as marcadas 'private'. Alimenta o feed.
drop policy if exists "ver atividade de quem sigo (público)" on public.reading_activities;
drop policy if exists "ver atividade de quem sigo (aceito)" on public.reading_activities;
create policy "ver atividade de quem sigo (aceito)" on public.reading_activities for select to authenticated
  using (
    visibility in ('friends', 'public')
    and exists (select 1 from public.follows f
            where f.follower_id = auth.uid() and f.followee_id = user_id and f.status = 'accepted')
  );

-- Contagem de seguidores/seguindo (só ACEITOS).
create or replace function public.follow_counts(p_user uuid)
returns table (followers bigint, following bigint)
language sql security definer set search_path = public stable as $$
  select
    (select count(*) from public.follows where followee_id = p_user and status = 'accepted'),
    (select count(*) from public.follows where follower_id = p_user and status = 'accepted');
$$;
grant execute on function public.follow_counts(uuid) to authenticated;

-- ---------- KUDOS (curtidas) nas atividades do feed ----------
create table if not exists public.activity_kudos (
  activity_id uuid not null references public.reading_activities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

alter table public.activity_kudos enable row level security;

-- Kudos são sociais (estilo Strava: mostra contagem/quem curtiu) → legíveis por autenticados.
drop policy if exists "kudos legíveis" on public.activity_kudos;
create policy "kudos legíveis" on public.activity_kudos for select to authenticated using (true);

drop policy if exists "dono dá kudo" on public.activity_kudos;
create policy "dono dá kudo" on public.activity_kudos for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "dono tira kudo" on public.activity_kudos;
create policy "dono tira kudo" on public.activity_kudos for delete to authenticated using (auth.uid() = user_id);

-- ---------- VER QUEM ESTÁ LENDO (só perfis PÚBLICOS, §4.8) ----------
-- Lista os leitores PÚBLICOS de um livro (os privados seguem só na contagem agregada).
-- Esconde quem se bloqueou (nos 2 sentidos), igual às resenhas.
create or replace function public.public_readers(p_book_key text)
returns table (user_id uuid, name text, avatar_url text, status text)
language sql security definer set search_path = public stable as $$
  select s.user_id, p.name, p.avatar_url, s.status
  from public.book_shelves s
  join public.profiles p on p.id = s.user_id
  where s.book_key = p_book_key
    and p.is_public = true
    and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = s.user_id)
         or (b.blocker_id = s.user_id and b.blocked_id = auth.uid())
    )
  order by s.updated_at desc
  limit 50;
$$;
grant execute on function public.public_readers(text) to authenticated;

-- =====================================================================
-- SCRAPS / RECADOS (mural no perfil, estilo Orkut) — público (mural) ou privado (DM).
-- TRAVA (decisão do usuário): perfil PRIVADO só recebe recado de quem ELE segue (aceito)
-- ou de seguidor que ele aprovou. Perfil PÚBLICO recebe de qualquer um. Moderação (§4.8):
-- filtro de palavrão no app, denúncia (content_reports target_type='scrap'), bloqueio.
-- =====================================================================
create table if not exists public.scraps (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.scraps enable row level security;

create index if not exists scraps_recipient_idx on public.scraps (recipient_id, created_at desc);

-- Ver: sou autor/destinatário; OU é público num mural de perfil público. Sem bloqueio.
drop policy if exists "ver recados" on public.scraps;
create policy "ver recados" on public.scraps for select to authenticated
  using (
    not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = author_id)
         or (b.blocker_id = author_id and b.blocked_id = auth.uid())
    )
    and (
      auth.uid() = author_id
      or auth.uid() = recipient_id
      or (is_public and exists (select 1 from public.profiles p where p.id = recipient_id and p.is_public))
    )
  );

-- Enviar: sou o autor, não p/ mim mesmo, não bloqueado, e o destinatário PERMITE
-- (público; OU o destinatário me segue aceito; OU eu sigo o destinatário aceito).
drop policy if exists "enviar recado" on public.scraps;
create policy "enviar recado" on public.scraps for insert to authenticated
  with check (
    auth.uid() = author_id
    and author_id <> recipient_id
    and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = recipient_id and b.blocked_id = auth.uid())
         or (b.blocker_id = auth.uid() and b.blocked_id = recipient_id)
    )
    and (
      exists (select 1 from public.profiles p where p.id = recipient_id and p.is_public)
      or exists (select 1 from public.follows f
                 where f.follower_id = recipient_id and f.followee_id = auth.uid() and f.status = 'accepted')
      or exists (select 1 from public.follows f
                 where f.follower_id = auth.uid() and f.followee_id = recipient_id and f.status = 'accepted')
    )
  );

-- Apagar: o autor do recado OU o dono do mural (destinatário).
drop policy if exists "apagar recado" on public.scraps;
create policy "apagar recado" on public.scraps for delete to authenticated
  using (auth.uid() = author_id or auth.uid() = recipient_id);

-- =====================================================================
-- EXCLUSÃO DE CONTA (obrigatório p/ loja — Apple Guideline 5.1.1(v) + Google).
-- O usuário apaga a PRÓPRIA conta de dentro do app. Deleta de auth.users; o
-- `on delete cascade` em TODAS as tabelas (profiles, reading_activities, estante,
-- follows, blocks, reports, kudos, resenhas, scraps...) remove o resto. É
-- `security definer` p/ poder mexer em auth.users (roda como o dono = postgres).
-- =====================================================================
create or replace function public.delete_current_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end; $$;

-- Só um usuário autenticado pode apagar a própria conta (anon não).
revoke all on function public.delete_current_user() from public, anon;
grant execute on function public.delete_current_user() to authenticated;

-- =====================================================================
-- COTA DA IA GERIDA (CLAUDE.md §5) — limite diário por usuário p/ a IA grátis
-- (dicionário + Coach via Edge Function ai-proxy). Protege a cota/contas das chaves.
-- A tabela de USO é fechada (RLS sem policy = cliente não lê/escreve); só a função
-- SECURITY DEFINER mexe nela. A Edge Function chama ai_quota_consume a cada pedido.
-- =====================================================================
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  count int not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
-- (intencional: NENHUMA policy → cliente não acessa direto; só a função abaixo)

-- Consome 1 da cota do DIA do usuário e diz se AINDA está dentro do limite.
-- auth.uid() identifica quem chamou (a Edge Function repassa o JWT do usuário).
create or replace function public.ai_quota_consume(p_limit int)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_count int;
begin
  if v_user is null then return false; end if;
  insert into public.ai_usage (user_id, day, count)
    values (v_user, current_date, 1)
    on conflict (user_id, day) do update set count = public.ai_usage.count + 1
    returning count into v_count;
  return v_count <= p_limit;
end; $$;
grant execute on function public.ai_quota_consume(int) to authenticated;

-- =====================================================================
-- BRASÃO DE FUNDADOR — os 50 PRIMEIROS cadastrados ganham (lançamento).
-- (a coluna is_founder é criada lá em cima, na seção da camada social.)
-- =====================================================================

-- Backfill: os 50 perfis mais antigos viram fundadores (idempotente — só liga, nunca desliga).
with first50 as (
  select id from public.profiles order by created_at asc limit 50
)
update public.profiles p
  set is_founder = true
  from first50
  where p.id = first50.id and p.is_founder = false;

-- handle_new_user (REDEFINIÇÃO): cria o profile no signup E concede o brasão se ainda houver
-- vaga (<50 fundadores). pg_advisory_xact_lock serializa o cálculo → nunca passa de 50 mesmo
-- com cadastros simultâneos. Substitui a versão anterior (que só inseria o profile).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_founders int;
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  -- Trava global (mesmo número arbitrário) p/ contar+atribuir sem corrida.
  perform pg_advisory_xact_lock(742042);
  select count(*) into v_founders from public.profiles where is_founder;
  if v_founders < 50 then
    update public.profiles set is_founder = true where id = new.id;
  end if;
  return new;
end; $$;

-- =====================================================================
-- ACERVO CURADO (CLAUDE.md §4.3 / [[acervo-fontes]]) — catálogo PRÓPRIO de livros
-- (foco: TRADUÇÕES EM PT de clássicos que o Gutenberg só tem em inglês). Antes era um
-- catalog.json no Storage; agora a fonte de verdade é ESTA tabela (mais fácil de gerir/filtrar).
--
-- O ARQUIVO do livro (EPUB/PDF) fica no Storage (bucket público `acervo`); aqui guardamos só
-- os METADADOS + a URL pública. Só livros LEGAIS (domínio público ou tradução própria) — §4.3.
-- =====================================================================
create table if not exists public.curated_books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text,
  language text not null default 'pt',            -- idioma DO ARQUIVO: 'pt' | 'en' | ...
  is_translated boolean not null default false,   -- true = tradução PT curada por nós
  source_language text,                           -- idioma original (ex.: 'en') quando traduzido
  format text not null default 'epub' check (format in ('epub', 'pdf')),
  file_url text not null unique,                  -- URL pública do arquivo (bucket `acervo`); único (idempotência do seed)
  cover_url text,
  description text,
  sort_order int not null default 0,              -- ordena a vitrine (maior = antes)
  active boolean not null default true,           -- desligar sem apagar
  created_at timestamptz not null default now()
);

alter table public.curated_books enable row level security;

-- Catálogo é conteúdo PÚBLICO do app — qualquer logado LÊ (só os ATIVOS). A GESTÃO
-- (inserir/editar/remover) é feita por você no painel/service_role: sem policy de escrita
-- p/ `authenticated`, o cliente não altera o acervo.
drop policy if exists "acervo legível" on public.curated_books;
create policy "acervo legível" on public.curated_books
  for select to authenticated using (active);

create index if not exists curated_books_lang_idx on public.curated_books (language, sort_order desc);

-- ---------- SEED inicial (opcional) — clássicos PT reais (EPUB direto do Gutenberg), só p/ a
-- vitrine já não nascer vazia e ser testável. `on conflict` evita duplicar ao reexecutar. ----------
insert into public.curated_books (title, author, language, format, file_url, cover_url, sort_order)
values
  ('Dom Casmurro', 'Machado de Assis', 'pt', 'epub',
   'https://www.gutenberg.org/ebooks/55752.epub3.images',
   'https://www.gutenberg.org/cache/epub/55752/pg55752.cover.medium.jpg', 100),
  ('O Cortiço', 'Aluísio Azevedo', 'pt', 'epub',
   'https://www.gutenberg.org/ebooks/69187.epub3.images',
   'https://www.gutenberg.org/cache/epub/69187/pg69187.cover.medium.jpg', 90)
on conflict (file_url) do nothing;

-- ---------- MODELO p/ AS SUAS TRADUÇÕES (rodar DEPOIS de subir o arquivo no bucket `acervo`):
-- 1) Storage → bucket `acervo` (público) → upload do PDF/EPUB.
-- 2) Copie a "URL pública" do arquivo e cole em file_url abaixo. Descomente e rode.
--
-- insert into public.curated_books
--   (title, author, language, is_translated, source_language, format, file_url, cover_url, sort_order)
-- values
--   ('A Arte da Guerra', 'Sun Tzu', 'pt', true, 'en', 'pdf',
--    'https://SEU-PROJETO.supabase.co/storage/v1/object/public/acervo/arte-da-guerra-pt.pdf',
--    null, 80),
--   ('Alice no País das Maravilhas', 'Lewis Carroll', 'pt', true, 'en', 'pdf',
--    'https://SEU-PROJETO.supabase.co/storage/v1/object/public/acervo/alice-pt.pdf', null, 70),
--   ('Peter Pan e Wendy', 'J. M. Barrie', 'pt', true, 'en', 'pdf',
--    'https://SEU-PROJETO.supabase.co/storage/v1/object/public/acervo/peter-pan-pt.pdf', null, 60),
--   ('Romeu e Julieta', 'William Shakespeare', 'pt', true, 'en', 'pdf',
--    'https://SEU-PROJETO.supabase.co/storage/v1/object/public/acervo/romeu-julieta-pt.pdf', null, 50);
