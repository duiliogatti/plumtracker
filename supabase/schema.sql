-- Plum! Tracker: tablas, permisos y tiempo real.
-- Pegar entero en Supabase > SQL Editor > New query > Run.

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  area text not null default 'general',
  owner text not null default '',
  event text not null default 'festival',
  status text not null default 'pendiente',
  start_date date,
  due_date date,
  priority text not null default 'media',
  notes text not null default '',
  origin text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null default '',
  event text not null default 'festival',
  status text not null default 'invitado',
  arr_date date,
  arr_time text not null default '',
  dep_date date,
  dep_time text not null default '',
  transport text not null default '',
  lodging text not null default '',
  diet text not null default '',
  host text not null default '',
  contact text not null default '',
  activities text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Guarda quién y cuándo hizo el último cambio.
create or replace function public.touch_row() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.jwt() ->> 'email', new.updated_by);
  return new;
end $$;

drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before insert or update on public.tasks
  for each row execute function public.touch_row();
drop trigger if exists guests_touch on public.guests;
create trigger guests_touch before insert or update on public.guests
  for each row execute function public.touch_row();

-- Solo usuarios con sesión iniciada (invitados por vos) leen y escriben.
alter table public.tasks enable row level security;
alter table public.guests enable row level security;

drop policy if exists "equipo" on public.tasks;
create policy "equipo" on public.tasks for all to authenticated using (true) with check (true);
drop policy if exists "equipo" on public.guests;
create policy "equipo" on public.guests for all to authenticated using (true) with check (true);

-- Cambios en vivo para todos los que tengan la app abierta.
do $$
begin
  begin alter publication supabase_realtime add table public.tasks; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.guests; exception when duplicate_object then null; end;
end $$;
