-- LikindaLine — base de dados e permissões. Executa UMA vez em Supabase > SQL Editor.
-- Regra: qualquer pessoa LÊ os produtos; só contas listadas em "admins" ESCREVEM.

create table if not exists public.products (
  id          text primary key check (id ~ '^[a-z0-9-]{1,80}$'),
  name        text not null check (char_length(name) between 2 and 90),
  price       integer not null check (price >= 0),
  category    text not null default 'Outros',
  description text not null default '' check (char_length(description) <= 1200),
  image       text not null,
  images      text[] not null default '{}',
  stock       text not null default 'available' check (stock in ('available','soldout')),
  featured    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.products enable row level security;
alter table public.admins   enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;

create policy "products_public_read"  on public.products for select using (true);
create policy "products_admin_insert" on public.products for insert to authenticated with check (public.is_admin());
create policy "products_admin_update" on public.products for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "products_admin_delete" on public.products for delete to authenticated using (public.is_admin());
create policy "admins_read_own_row"   on public.admins   for select to authenticated using (user_id = auth.uid());

-- Fotografias (Storage): leitura pública, escrita só para administradores.
insert into storage.buckets (id, name, public) values ('produtos', 'produtos', true) on conflict (id) do nothing;
create policy "produtos_public_read"  on storage.objects for select using (bucket_id = 'produtos');
create policy "produtos_admin_insert" on storage.objects for insert to authenticated with check (bucket_id = 'produtos' and public.is_admin());
create policy "produtos_admin_update" on storage.objects for update to authenticated using (bucket_id = 'produtos' and public.is_admin());
create policy "produtos_admin_delete" on storage.objects for delete to authenticated using (bucket_id = 'produtos' and public.is_admin());

-- PASSO MANUAL: cria o teu utilizador em Authentication > Users (email + palavra-passe),
-- desativa "Allow new users to sign up" em Authentication > Sign In / Providers,
-- e depois executa (com o teu email):
--   insert into public.admins (user_id) select id from auth.users where email = 'O_TEU_EMAIL';
