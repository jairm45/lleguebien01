-- ============================================================================
-- FASE 2.5 — Destinos guardados
-- Proyecto: LlegueBien01
-- PostgreSQL 17 + Supabase
--
-- EJECUCIÓN:
--   - SQL Editor de Supabase con rol de escritura (postgres).
--   - Ejecutar el archivo completo, incluido BEGIN/COMMIT.
--   - El MCP de este proyecto es de solo lectura; no ejecuta esta migración.
-- ============================================================================

begin;

set search_path = public, extensions, pg_catalog;

-- ----------------------------------------------------------------------------
-- 0. Preflight
-- ----------------------------------------------------------------------------
do $preflight$
begin
  if to_regclass('public.perfiles') is null then
    raise exception 'Falta public.perfiles. Ejecuta primero las migraciones base.';
  end if;
end
$preflight$;

-- ----------------------------------------------------------------------------
-- 1. Tabla destinos_guardados
-- ----------------------------------------------------------------------------
create table if not exists public.destinos_guardados (
  id uuid primary key default gen_random_uuid(),
  id_usuario uuid not null references public.perfiles(id) on delete cascade,
  nombre text not null,
  direccion text,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  es_predeterminado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_destinos_usuario_created_at
  on public.destinos_guardados (id_usuario, created_at desc);

create unique index if not exists idx_destinos_un_predeterminado_por_usuario
  on public.destinos_guardados (id_usuario)
  where es_predeterminado = true;

comment on table public.destinos_guardados is
  'Puntos B guardados por cada estudiante.';

-- ----------------------------------------------------------------------------
-- 2. updated_at automático
-- ----------------------------------------------------------------------------
create or replace function public.set_destino_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, extensions, pg_catalog
as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

drop trigger if exists trg_destinos_updated_at
  on public.destinos_guardados;

create trigger trg_destinos_updated_at
before update on public.destinos_guardados
for each row
execute function public.set_destino_updated_at();

-- ----------------------------------------------------------------------------
-- 3. RLS
-- ----------------------------------------------------------------------------
alter table public.destinos_guardados enable row level security;

drop policy if exists "Usuario ve sus destinos" on public.destinos_guardados;
create policy "Usuario ve sus destinos"
on public.destinos_guardados
for select
to authenticated
using ((select auth.uid()) = id_usuario);

drop policy if exists "Usuario crea sus destinos" on public.destinos_guardados;
create policy "Usuario crea sus destinos"
on public.destinos_guardados
for insert
to authenticated
with check ((select auth.uid()) = id_usuario);

drop policy if exists "Usuario actualiza sus destinos" on public.destinos_guardados;
create policy "Usuario actualiza sus destinos"
on public.destinos_guardados
for update
to authenticated
using ((select auth.uid()) = id_usuario)
with check ((select auth.uid()) = id_usuario);

drop policy if exists "Usuario elimina sus destinos" on public.destinos_guardados;
create policy "Usuario elimina sus destinos"
on public.destinos_guardados
for delete
to authenticated
using ((select auth.uid()) = id_usuario);

revoke all on public.destinos_guardados from anon;
grant select, insert, update, delete on public.destinos_guardados
  to authenticated;

-- ----------------------------------------------------------------------------
-- 4. RPC: guardar_destino_usuario
--    Crea o actualiza un destino. Si se marca como predeterminado,
--    desmarca los demás en la misma transacción.
-- ----------------------------------------------------------------------------
create or replace function public.guardar_destino_usuario(
  p_nombre text,
  p_lat double precision,
  p_lng double precision,
  p_direccion text default null,
  p_es_predeterminado boolean default false,
  p_destino_id uuid default null
)
returns public.destinos_guardados
language plpgsql
security invoker
set search_path = public, extensions, pg_catalog
as $fn$
declare
  v_uid uuid := auth.uid();
  v_destino public.destinos_guardados;
  v_es_predeterminado boolean := coalesce(p_es_predeterminado, false);
begin
  if v_uid is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_nombre is null or trim(p_nombre) = '' then
    raise exception 'El nombre del destino es obligatorio';
  end if;

  if p_lat is null or p_lng is null
     or p_lat < -90 or p_lat > 90
     or p_lng < -180 or p_lng > 180 then
    raise exception 'Coordenadas inválidas';
  end if;

  if p_destino_id is not null and not exists (
    select 1
    from public.destinos_guardados d
    where d.id = p_destino_id
      and d.id_usuario = v_uid
  ) then
    raise exception 'Destino no encontrado';
  end if;

  if v_es_predeterminado then
    update public.destinos_guardados
    set es_predeterminado = false
    where id_usuario = v_uid
      and es_predeterminado = true
      and (p_destino_id is null or id <> p_destino_id);
  end if;

  if p_destino_id is null then
    insert into public.destinos_guardados (
      id_usuario,
      nombre,
      direccion,
      lat,
      lng,
      es_predeterminado
    )
    values (
      v_uid,
      trim(p_nombre),
      p_direccion,
      p_lat,
      p_lng,
      v_es_predeterminado
    )
    returning * into v_destino;
  else
    update public.destinos_guardados
    set nombre = trim(p_nombre),
        direccion = p_direccion,
        lat = p_lat,
        lng = p_lng,
        es_predeterminado = v_es_predeterminado,
        updated_at = now()
    where id = p_destino_id
      and id_usuario = v_uid
    returning * into v_destino;

    if not found then
      raise exception 'Destino no encontrado';
    end if;
  end if;

  return v_destino;
end;
$fn$;

revoke all on function public.guardar_destino_usuario(
  text, double precision, double precision, text, boolean, uuid
) from public;

grant execute on function public.guardar_destino_usuario(
  text, double precision, double precision, text, boolean, uuid
) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. RPC: establecer_destino_predeterminado
-- ----------------------------------------------------------------------------
create or replace function public.establecer_destino_predeterminado(
  p_destino_id uuid
)
returns public.destinos_guardados
language plpgsql
security invoker
set search_path = public, extensions, pg_catalog
as $fn$
declare
  v_uid uuid := auth.uid();
  v_destino public.destinos_guardados;
begin
  if v_uid is null then
    raise exception 'Usuario no autenticado';
  end if;

  if not exists (
    select 1
    from public.destinos_guardados d
    where d.id = p_destino_id
      and d.id_usuario = v_uid
  ) then
    raise exception 'Destino no encontrado';
  end if;

  update public.destinos_guardados
  set es_predeterminado = false
  where id_usuario = v_uid
    and es_predeterminado = true
    and id <> p_destino_id;

  update public.destinos_guardados
  set es_predeterminado = true,
      updated_at = now()
  where id = p_destino_id
    and id_usuario = v_uid
  returning * into v_destino;

  if not found then
    raise exception 'Destino no encontrado';
  end if;

  return v_destino;
end;
$fn$;

revoke all on function public.establecer_destino_predeterminado(uuid)
  from public;

grant execute on function public.establecer_destino_predeterminado(uuid)
  to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. Estadísticas y recarga de PostgREST
-- ----------------------------------------------------------------------------
analyze public.destinos_guardados;

notify pgrst, 'reload schema';

commit;

-- ----------------------------------------------------------------------------
-- 7. Verificación rápida (opcional, solo lectura)
-- ----------------------------------------------------------------------------
-- select column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'destinos_guardados'
-- order by ordinal_position;
--
-- select indexname, indexdef
-- from pg_indexes
-- where schemaname = 'public' and tablename = 'destinos_guardados'
-- order by indexname;
--
-- select policyname, cmd, roles::text, qual, with_check
-- from pg_policies
-- where schemaname = 'public' and tablename = 'destinos_guardados'
-- order by cmd, policyname;
--
-- select proname, pg_get_function_identity_arguments(oid) as args
-- from pg_proc
-- where pronamespace = 'public'::regnamespace
--   and proname in (
--     'guardar_destino_usuario',
--     'establecer_destino_predeterminado',
--     'set_destino_updated_at'
--   )
-- order by proname;
