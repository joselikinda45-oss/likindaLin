-- Executa uma vez no SQL Editor depois de configurar a loja e o login de administrador.
-- Publicações são visíveis a todos; só administradores podem criar ou eliminar.

create table if not exists public.testimonials (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 2 and 90),
  kind         text not null check (kind in ('video', 'image')),
  content_url  text not null check (content_url ~ '^https://'),
  storage_path text,
  created_at   timestamptz not null default now(),
  constraint testimonials_content_check check (
    (kind = 'video'
      and storage_path is null
      and (content_url ~ '^https://(www[.]|m[.])?youtube[.]com/'
        or content_url ~ '^https://youtu[.]be/')
    )
    or
    (kind = 'image'
      and storage_path is not null
      and storage_path like 'clientes/%'
    )
  )
);

alter table public.testimonials enable row level security;

drop policy if exists "testimonials_public_read" on public.testimonials;
drop policy if exists "testimonials_admin_insert" on public.testimonials;
drop policy if exists "testimonials_admin_delete" on public.testimonials;

create policy "testimonials_public_read"
  on public.testimonials for select using (true);
create policy "testimonials_admin_insert"
  on public.testimonials for insert to authenticated
  with check (public.is_admin());
create policy "testimonials_admin_delete"
  on public.testimonials for delete to authenticated
  using (public.is_admin());

grant select on table public.testimonials to anon, authenticated;
grant insert, delete on table public.testimonials to authenticated;
