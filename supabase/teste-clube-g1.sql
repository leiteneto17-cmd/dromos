-- ============================================================================
-- TESTE G1 — Clube do Livro (rodar no SQL Editor DEPOIS de aplicar o schema.sql)
-- Simula 2 usuários reais impersonando o papel `authenticated` (testa o RLS de
-- verdade). ANTES DE RODAR: pegue 2 UUIDs reais com:
--   select id, email from auth.users limit 5;
-- e substitua UUID_A (dono) e UUID_B (convidado) abaixo. Rode BLOCO POR BLOCO.
-- ============================================================================

-- ---------- BLOCO 1 · Usuário A cria o clube ----------
begin;
select set_config('request.jwt.claims', '{"sub":"UUID_A","role":"authenticated"}', true);
set local role authenticated;

select club_create(
  'Clube do Dom Casmurro', 'Dom Casmurro', 'Machado de Assis',
  null, null, 'Nosso primeiro clube', 4,
  '[{"stage_no":1,"title":"Semana 1 · caps. 1–12","chapters":"1-12"},
    {"stage_no":2,"title":"Semana 2 · caps. 13–25","chapters":"13-25"}]'::jsonb
);
-- ✅ Esperado: 1 linha com o clube + invite_code de 8 letras. ANOTE o invite_code e o id.

select * from clubs;           -- ✅ A vê o clube (é membro)
select * from club_stages;     -- ✅ 2 etapas
commit;

-- ---------- BLOCO 2 · Usuário B NÃO vê nada antes de entrar ----------
begin;
select set_config('request.jwt.claims', '{"sub":"UUID_B","role":"authenticated"}', true);
set local role authenticated;

select * from clubs;           -- ✅ Esperado: 0 linhas (sem descoberta pública)
select * from club_stages;     -- ✅ 0 linhas

-- B entra pelo código (troque CODIGO pelo anotado no bloco 1):
select club_join('CODIGO');    -- ✅ devolve o clube
select * from clubs;           -- ✅ agora 1 linha
insert into club_posts (club_id, stage_no, author_id, body)
values ((select id from clubs limit 1), 1, 'UUID_B', 'Capítulo 1 me pegou!')
returning *;                   -- ✅ B posta na etapa 1
commit;

-- ---------- BLOCO 3 · A vê o post de B; bloqueio esconde ----------
begin;
select set_config('request.jwt.claims', '{"sub":"UUID_A","role":"authenticated"}', true);
set local role authenticated;

select body from club_posts;   -- ✅ A vê o post de B
insert into user_blocks (blocker_id, blocked_id) values ('UUID_A', 'UUID_B');
select body from club_posts;   -- ✅ Esperado: 0 linhas (bloqueio filtra)
delete from user_blocks where blocker_id = 'UUID_A' and blocked_id = 'UUID_B';
select body from club_posts;   -- ✅ voltou a aparecer
commit;

-- ---------- BLOCO 4 · Moderação: dono remove membro ----------
begin;
select set_config('request.jwt.claims', '{"sub":"UUID_A","role":"authenticated"}', true);
set local role authenticated;
delete from club_members where user_id = 'UUID_B';
select count(*) from club_members;  -- ✅ 1 (só o dono)
commit;

-- ---------- LIMPEZA (como admin, fora da impersonação) ----------
-- delete from clubs;  -- cascade limpa members/stages/posts
