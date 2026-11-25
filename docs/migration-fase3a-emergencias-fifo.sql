-- ============================================================================
-- FASE 3A — Emergencias, tracking en segundo plano y cola FIFO idempotente
-- Proyecto: LlegueBien01
-- PostgreSQL 17 + PostGIS 3.3.7 (extensions)
--
-- EJECUCIÓN:
--   - SQL Editor de Supabase con rol de escritura (postgres).
--   - Ejecutar el archivo completo, incluido BEGIN/COMMIT.
--   - El MCP de este proyecto es de solo lectura.
-- ============================================================================

begin;

set search_path = public, extensions, pg_catalog;

-- ----------------------------------------------------------------------------
-- 0. Preflight
-- ----------------------------------------------------------------------------
do $preflight$
begin
  if not exists (select 1 from pg_extension where extname = 'postgis') then
    raise exception 'PostGIS no está instalado.';
  end if;

  if to_regclass('public.recorridos') is null
     or to_regclass('public.recorrido_ubicaciones') is null
     or to_regclass('public.alertas') is null
     or to_regclass('public.seguidores') is null
     or to_regclass('public.dispositivos_push') is null
     or to_regclass('public.configuracion_sensores') is null then
    raise exception 'Faltan tablas base de las fases anteriores.';
  end if;
end
$preflight$;

-- ----------------------------------------------------------------------------
-- 1. recorrido_ubicaciones: timestamps reales + idempotencia offline
-- ----------------------------------------------------------------------------
alter table public.recorrido_ubicaciones
  add column if not exists captured_at timestamptz;

update public.recorrido_ubicaciones
set captured_at = created_at
where captured_at is null;

alter table public.recorrido_ubicaciones
  alter column captured_at set default now(),
  alter column captured_at set not null;

alter table public.recorrido_ubicaciones
  add column if not exists client_event_id uuid;

create unique index if not exists idx_recorrido_ubicaciones_client_event_id
  on public.recorrido_ubicaciones (client_event_id)
  where client_event_id is not null;

create index if not exists recorrido_ubicaciones_captured_at_idx
  on public.recorrido_ubicaciones (recorrido_id, captured_at, id);

comment on column public.recorrido_ubicaciones.captured_at is
  'Timestamp real del GPS; puede diferir de created_at si el lote llegó offline.';

comment on column public.recorrido_ubicaciones.client_event_id is
  'UUID generado en el cliente para idempotencia de la cola offline.';

-- ----------------------------------------------------------------------------
-- 2. alertas: modo sonoro/silencioso + idempotencia + nuevos tipos
-- ----------------------------------------------------------------------------
alter table public.alertas
  add column if not exists modo text;

update public.alertas
set modo = 'sonoro'
where modo is null;

alter table public.alertas
  alter column modo set default 'sonoro',
  alter column modo set not null;

alter table public.alertas
  add column if not exists client_event_id uuid;

create unique index if not exists alertas_client_event_id_uidx
  on public.alertas (client_event_id);

do $modo_check$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.alertas'::regclass
      and conname = 'alertas_modo_check'
  ) then
    alter table public.alertas
      add constraint alertas_modo_check
      check (modo in ('sonoro', 'silencioso'));
  end if;
end
$modo_check$;

alter table public.alertas
  drop constraint if exists alertas_tipo_check;

alter table public.alertas
  add constraint alertas_tipo_check
  check (tipo in ('manual', 'sacudida', 'notificacion_rapida', 'pasiva'));

comment on column public.alertas.modo is
  'sonoro = alarma local; silencioso = seguimiento discreto sin audio fuerte.';

-- ----------------------------------------------------------------------------
-- 3. RPC registrar_ubicacion_recorrido (nueva firma, activo o emergencia)
-- ----------------------------------------------------------------------------
drop function if exists public.registrar_ubicacion_recorrido(
  uuid, double precision, double precision, double precision, double precision, double precision
);

create or replace function public.registrar_ubicacion_recorrido(
  p_recorrido_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_precision_m double precision default null,
  p_velocidad_mps double precision default null,
  p_heading double precision default null,
  p_captured_at timestamptz default now(),
  p_client_event_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions, pg_catalog
as $fn$
declare
  v_uid uuid := auth.uid();
  v_captured_at timestamptz := coalesce(p_captured_at, now());
  v_nuevo geography;
  v_ultimo geography;
  v_ultimo_captured_at timestamptz;
  v_recorrido_existente uuid;
  v_distancia_ultimo double precision;
  v_delta_segundos double precision;
  v_es_valido boolean := true;
  v_ya_existe boolean := false;
  v_ubicacion_id bigint;
  v_distancia_total double precision := 0;
  v_zonas jsonb := '[]'::jsonb;
  v_en_zona boolean := false;
begin
  if v_uid is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_lat is null or p_lng is null
     or p_lat < -90 or p_lat > 90
     or p_lng < -180 or p_lng > 180 then
    raise exception 'Coordenadas inválidas';
  end if;

  if not exists (
    select 1
    from public.recorridos r
    where r.id = p_recorrido_id
      and r.id_usuario = v_uid
      and r.estado in ('activo', 'emergencia')
  ) then
    raise exception 'Recorrido no encontrado o no activo';
  end if;

  -- Idempotencia: si el evento ya llegó, devolver su estado sin duplicar.
  if p_client_event_id is not null then
    select
      u.id,
      u.es_valido,
      coalesce(
        u.ubicacion,
        ST_SetSRID(ST_MakePoint(u.lng, u.lat), 4326)::geography
      ),
      u.recorrido_id
      into v_ubicacion_id, v_es_valido, v_nuevo, v_recorrido_existente
    from public.recorrido_ubicaciones u
    where u.client_event_id = p_client_event_id
    limit 1;

    if found then
      if v_recorrido_existente <> p_recorrido_id then
        raise exception 'client_event_id pertenece a otro recorrido';
      end if;

      v_ya_existe := true;
    end if;
  end if;

  if not v_ya_existe then
    -- Importante: el SELECT ... INTO de idempotencia deja las variables en
    -- NULL cuando no encuentra filas, incluida v_es_valido. Se reinicia aquí.
    v_es_valido := true;
    v_nuevo := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;

    select u.ubicacion, u.captured_at
      into v_ultimo, v_ultimo_captured_at
    from public.recorrido_ubicaciones u
    where u.recorrido_id = p_recorrido_id
      and u.es_valido = true
      and u.ubicacion is not null
      and u.captured_at <= v_captured_at
    order by u.captured_at desc, u.id desc
    limit 1;

    if p_precision_m is not null and p_precision_m > 35 then
      v_es_valido := false;
    end if;

    if v_es_valido
       and p_velocidad_mps is not null
       and p_velocidad_mps > 120 then
      v_es_valido := false;
    end if;

    if v_es_valido and v_ultimo is not null then
      v_distancia_ultimo := ST_Distance(v_ultimo, v_nuevo);
      v_delta_segundos := greatest(
        extract(epoch from (v_captured_at - v_ultimo_captured_at))::double precision,
        1
      );

      if v_distancia_ultimo < 3 then
        v_es_valido := false;
      elsif (v_distancia_ultimo / v_delta_segundos) > 120 then
        v_es_valido := false;
      end if;
    end if;

    begin
      insert into public.recorrido_ubicaciones (
        recorrido_id,
        lat,
        lng,
        precision_m,
        velocidad_mps,
        heading,
        es_valido,
        captured_at,
        client_event_id
      )
      values (
        p_recorrido_id,
        p_lat,
        p_lng,
        p_precision_m,
        p_velocidad_mps,
        p_heading,
        v_es_valido,
        v_captured_at,
        p_client_event_id
      )
      returning id into v_ubicacion_id;
    exception when unique_violation then
      -- Carrera entre dos intentos del mismo evento offline.
      select
        u.id,
        u.es_valido,
        coalesce(
          u.ubicacion,
          ST_SetSRID(ST_MakePoint(u.lng, u.lat), 4326)::geography
        )
        into v_ubicacion_id, v_es_valido, v_nuevo
      from public.recorrido_ubicaciones u
      where u.client_event_id = p_client_event_id
        and u.recorrido_id = p_recorrido_id
      limit 1;

      if not found then
        raise;
      end if;

      v_ya_existe := true;
    end;
  end if;

  -- Distancia oficial usando el tiempo real de captura.
  select case
    when count(*) < 2 then 0
    else ST_Length(
      ST_MakeLine(u.ubicacion::geometry order by u.captured_at, u.id)::geography
    )
  end
  into v_distancia_total
  from public.recorrido_ubicaciones u
  where u.recorrido_id = p_recorrido_id
    and u.es_valido = true
    and u.ubicacion is not null;

  v_distancia_total := coalesce(v_distancia_total, 0);

  update public.recorridos
  set distancia_metros = round(v_distancia_total)::integer
  where id = p_recorrido_id
    and estado in ('activo', 'emergencia');

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', z.id,
        'nombre', z.nombre,
        'nivel', z.nivel
      )
      order by z.nombre
    ),
    '[]'::jsonb
  )
  into v_zonas
  from public.zonas_riesgo z
  where z.activo = true
    and z.geometria is not null
    and ST_Intersects(z.geometria, v_nuevo);

  v_en_zona := jsonb_array_length(v_zonas) > 0;

  return jsonb_build_object(
    'ubicacion_id', v_ubicacion_id,
    'es_valido', v_es_valido,
    'distancia_acumulada_metros', round(v_distancia_total)::integer,
    'en_zona_riesgo', v_en_zona,
    'zonas_riesgo_activas', v_zonas
  );
end;
$fn$;

revoke all on function public.registrar_ubicacion_recorrido(
  uuid, double precision, double precision, double precision, double precision, double precision, timestamptz, uuid
) from public;

grant execute on function public.registrar_ubicacion_recorrido(
  uuid, double precision, double precision, double precision, double precision, double precision, timestamptz, uuid
) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. finalizar_recorrido: cierra activo/emergencia y termina alertas activas
-- ----------------------------------------------------------------------------
create or replace function public.finalizar_recorrido(p_recorrido_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions, pg_catalog
as $fn$
declare
  v_uid uuid := auth.uid();
  v_iniciado_en timestamptz;
  v_destino_nombre text;
  v_finalizado_en timestamptz := now();
  v_duracion integer;
  v_distancia double precision := 0;
  v_seguidores integer := 0;
begin
  if v_uid is null then
    raise exception 'Usuario no autenticado';
  end if;

  select r.iniciado_en, r.destino_nombre
    into v_iniciado_en, v_destino_nombre
  from public.recorridos r
  where r.id = p_recorrido_id
    and r.id_usuario = v_uid
    and r.estado in ('activo', 'emergencia');

  if not found then
    raise exception 'Recorrido no encontrado o no activo';
  end if;

  select case
    when count(*) < 2 then 0
    else ST_Length(
      ST_MakeLine(u.ubicacion::geometry order by u.captured_at, u.id)::geography
    )
  end
  into v_distancia
  from public.recorrido_ubicaciones u
  where u.recorrido_id = p_recorrido_id
    and u.es_valido = true
    and u.ubicacion is not null;

  v_distancia := coalesce(v_distancia, 0);
  v_duracion := greatest(
    1,
    extract(epoch from (v_finalizado_en - v_iniciado_en))::integer
  );

  update public.alertas
  set estado = 'terminada',
      terminada_en = v_finalizado_en
  where id_recorrido = p_recorrido_id
    and id_usuario = v_uid
    and estado = 'activa';

  update public.recorridos
  set estado = 'finalizado',
      finalizado_en = v_finalizado_en,
      distancia_metros = round(v_distancia)::integer,
      duracion_segundos = v_duracion
  where id = p_recorrido_id
    and id_usuario = v_uid;

  select count(*)::integer
    into v_seguidores
  from public.seguidores s
  where s.id_estudiante = v_uid
    and s.estado = 'activo';

  return jsonb_build_object(
    'recorrido_id', p_recorrido_id,
    'destino_nombre', v_destino_nombre,
    'distancia_metros', round(v_distancia)::integer,
    'duracion_segundos', v_duracion,
    'iniciado_en', v_iniciado_en,
    'finalizado_en', v_finalizado_en,
    'seguidores_notificados', v_seguidores
  );
end;
$fn$;

revoke all on function public.finalizar_recorrido(uuid) from public;
grant execute on function public.finalizar_recorrido(uuid)
  to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. RPC activar_emergencia_recorrido
-- ----------------------------------------------------------------------------
create or replace function public.activar_emergencia_recorrido(
  p_recorrido_id uuid,
  p_tipo text,
  p_modo text default 'sonoro',
  p_lat double precision default null,
  p_lng double precision default null,
  p_client_event_id uuid default null
)
returns public.alertas
language plpgsql
security invoker
set search_path = public, extensions, pg_catalog
as $fn$
declare
  v_uid uuid := auth.uid();
  v_alerta public.alertas;
begin
  if v_uid is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_tipo not in ('manual', 'sacudida', 'notificacion_rapida', 'pasiva') then
    raise exception 'Tipo de alerta inválido';
  end if;

  if p_modo not in ('sonoro', 'silencioso') then
    raise exception 'Modo de alerta inválido';
  end if;

  if (p_lat is not null and (p_lat < -90 or p_lat > 90))
     or (p_lng is not null and (p_lng < -180 or p_lng > 180)) then
    raise exception 'Coordenadas inválidas';
  end if;

  if not exists (
    select 1
    from public.recorridos r
    where r.id = p_recorrido_id
      and r.id_usuario = v_uid
      and r.estado in ('activo', 'emergencia')
  ) then
    raise exception 'Recorrido no encontrado o no activo';
  end if;

  if p_client_event_id is not null then
    select *
      into v_alerta
    from public.alertas a
    where a.client_event_id = p_client_event_id
    limit 1;

    if found then
      if v_alerta.id_usuario <> v_uid
         or v_alerta.id_recorrido <> p_recorrido_id then
        raise exception 'client_event_id pertenece a otra alerta';
      end if;

      return v_alerta;
    end if;
  end if;

  begin
    insert into public.alertas (
      id_recorrido,
      id_usuario,
      tipo,
      estado,
      modo,
      lat,
      lng,
      client_event_id,
      iniciada_en
    )
    values (
      p_recorrido_id,
      v_uid,
      p_tipo,
      'activa',
      p_modo,
      p_lat,
      p_lng,
      p_client_event_id,
      now()
    )
    returning * into v_alerta;
  exception when unique_violation then
    select *
      into v_alerta
    from public.alertas a
    where a.client_event_id = p_client_event_id
    limit 1;

    if not found then
      raise;
    end if;

    if v_alerta.id_usuario <> v_uid
       or v_alerta.id_recorrido <> p_recorrido_id then
      raise exception 'client_event_id pertenece a otra alerta';
    end if;

    return v_alerta;
  end;

  update public.recorridos
  set estado = 'emergencia'
  where id = p_recorrido_id
    and id_usuario = v_uid
    and estado in ('activo', 'emergencia');

  return v_alerta;
end;
$fn$;

revoke all on function public.activar_emergencia_recorrido(
  uuid, text, text, double precision, double precision, uuid
) from public;

grant execute on function public.activar_emergencia_recorrido(
  uuid, text, text, double precision, double precision, uuid
) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. RPC terminar_emergencia_recorrido
-- ----------------------------------------------------------------------------
create or replace function public.terminar_emergencia_recorrido(
  p_alerta_id uuid,
  p_recorrido_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions, pg_catalog
as $fn$
declare
  v_uid uuid := auth.uid();
  v_estado_recorrido text;
begin
  if v_uid is null then
    raise exception 'Usuario no autenticado';
  end if;

  update public.alertas
  set estado = 'terminada',
      terminada_en = coalesce(terminada_en, now())
  where id = p_alerta_id
    and id_usuario = v_uid
    and id_recorrido = p_recorrido_id;

  if not found then
    raise exception 'Alerta no encontrada o no pertenece al usuario';
  end if;

  update public.recorridos
  set estado = 'activo'
  where id = p_recorrido_id
    and id_usuario = v_uid
    and estado = 'emergencia'
  returning estado into v_estado_recorrido;

  if v_estado_recorrido is null then
    select r.estado
      into v_estado_recorrido
    from public.recorridos r
    where r.id = p_recorrido_id
      and r.id_usuario = v_uid;
  end if;

  return jsonb_build_object(
    'alerta_id', p_alerta_id,
    'recorrido_id', p_recorrido_id,
    'recorrido_estado', v_estado_recorrido
  );
end;
$fn$;

revoke all on function public.terminar_emergencia_recorrido(uuid, uuid)
  from public;

grant execute on function public.terminar_emergencia_recorrido(uuid, uuid)
  to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 7. RPC registrar_token_push (upsert por token entre cuentas del celular)
-- ----------------------------------------------------------------------------
create or replace function public.registrar_token_push(
  p_expo_push_token text,
  p_plataforma text
)
returns public.dispositivos_push
language plpgsql
security definer
set search_path = public, pg_catalog
as $fn$
declare
  v_uid uuid := auth.uid();
  v_token public.dispositivos_push;
begin
  if v_uid is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_expo_push_token is null or trim(p_expo_push_token) = '' then
    raise exception 'Token push inválido';
  end if;

  if p_plataforma not in ('ios', 'android') then
    raise exception 'Plataforma inválida';
  end if;

  insert into public.dispositivos_push (
    id_usuario,
    expo_push_token,
    plataforma,
    actualizado_en
  )
  values (
    v_uid,
    p_expo_push_token,
    p_plataforma,
    now()
  )
  on conflict (expo_push_token) do update
  set id_usuario = excluded.id_usuario,
      plataforma = excluded.plataforma,
      actualizado_en = now()
  returning * into v_token;

  return v_token;
end;
$fn$;

revoke all on function public.registrar_token_push(text, text) from public;
grant execute on function public.registrar_token_push(text, text)
  to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 8. RPC eliminar_token_push
-- ----------------------------------------------------------------------------
create or replace function public.eliminar_token_push(
  p_expo_push_token text
)
returns void
language plpgsql
security invoker
set search_path = public, pg_catalog
as $fn$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Usuario no autenticado';
  end if;

  delete from public.dispositivos_push
  where expo_push_token = p_expo_push_token
    and id_usuario = v_uid;
end;
$fn$;

revoke all on function public.eliminar_token_push(text) from public;
grant execute on function public.eliminar_token_push(text)
  to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 9. Estadísticas y recarga PostgREST
-- ----------------------------------------------------------------------------
analyze public.recorrido_ubicaciones;
analyze public.alertas;
analyze public.dispositivos_push;

notify pgrst, 'reload schema';

commit;

-- ----------------------------------------------------------------------------
-- 10. Verificación opcional (solo lectura)
-- ----------------------------------------------------------------------------
-- select column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name in ('recorrido_ubicaciones','alertas')
--   and column_name in ('captured_at','client_event_id','modo')
-- order by table_name, ordinal_position;
--
-- select proname, pg_get_function_identity_arguments(oid) as args
-- from pg_proc
-- where pronamespace = 'public'::regnamespace
--   and proname in (
--     'registrar_ubicacion_recorrido',
--     'finalizar_recorrido',
--     'activar_emergencia_recorrido',
--     'terminar_emergencia_recorrido',
--     'registrar_token_push',
--     'eliminar_token_push'
--   )
-- order by proname;
