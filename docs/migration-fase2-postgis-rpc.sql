-- ============================================================================
-- FASE 2 — Tracking en vivo, PostGIS y cierre E14
-- Proyecto: LlegueBien01
-- PostgreSQL 17 + PostGIS 3.3.7 (esquema: extensions)
--
-- EJECUCIÓN:
--   - SQL Editor de Supabase con un rol de escritura (postgres).
--   - Ejecutar el archivo completo, de una sola vez.
--   - El MCP de este proyecto es de solo lectura; no ejecuta esta migración.
--
-- NOTAS:
--   - No cambia lat/lng (double precision) ni geojson (jsonb).
--   - Agrega columnas derivadas geography y las mantiene con triggers.
--   - PostGIS está instalado en el esquema `extensions`; por eso el
--     search_path incluye public, extensions y pg_catalog.
-- ============================================================================

begin;

set search_path = public, extensions, pg_catalog;

-- ----------------------------------------------------------------------------
-- 0. Preflight
-- ----------------------------------------------------------------------------
do $preflight$
begin
  if not exists (select 1 from pg_extension where extname = 'postgis') then
    raise exception 'PostGIS no está instalado en este proyecto.';
  end if;

  if to_regclass('public.recorridos') is null
     or to_regclass('public.recorrido_ubicaciones') is null
     or to_regclass('public.zonas_riesgo') is null
     or to_regclass('public.seguidores') is null then
    raise exception 'Faltan tablas de Fase 1 (recorridos, recorrido_ubicaciones, zonas_riesgo o seguidores).';
  end if;
end
$preflight$;

-- ----------------------------------------------------------------------------
-- 1. Helper: GeoJSON (Geometry, Feature o FeatureCollection) -> geometry
--    ST_GeomFromGeoJSON no acepta directamente el objeto Feature completo
--    en esta versión, así que extraemos su geometría.
-- ----------------------------------------------------------------------------
create or replace function public.geojson_a_geometria(p_geojson jsonb)
returns geometry
language plpgsql
stable
security invoker
set search_path = public, extensions, pg_catalog
as $fn$
declare
  v_tipo text;
  v_geometria geometry;
begin
  if p_geojson is null then
    return null;
  end if;

  v_tipo := p_geojson->>'type';

  if v_tipo = 'Feature' then
    if p_geojson->'geometry' is null
       or jsonb_typeof(p_geojson->'geometry') = 'null' then
      return null;
    end if;

    return ST_GeomFromGeoJSON((p_geojson->'geometry')::text);
  end if;

  if v_tipo = 'FeatureCollection' then
    if p_geojson->'features' is null
       or jsonb_typeof(p_geojson->'features') <> 'array' then
      return null;
    end if;

    select ST_Collect(public.geojson_a_geometria(elem.feature))
      into v_geometria
    from jsonb_array_elements(p_geojson->'features') as elem(feature);

    return v_geometria;
  end if;

  return ST_GeomFromGeoJSON(p_geojson::text);
end;
$fn$;

revoke all on function public.geojson_a_geometria(jsonb) from public;
grant execute on function public.geojson_a_geometria(jsonb)
  to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. recorrido_ubicaciones: flag de validez + geography(Point,4326)
-- ----------------------------------------------------------------------------
alter table public.recorrido_ubicaciones
  add column if not exists es_valido boolean not null default true;

update public.recorrido_ubicaciones
set es_valido = true
where es_valido is null;

alter table public.recorrido_ubicaciones
  alter column es_valido set default true,
  alter column es_valido set not null;

alter table public.recorrido_ubicaciones
  add column if not exists ubicacion geography(Point, 4326);

create or replace function public.set_ubicacion_recorrido()
returns trigger
language plpgsql
security invoker
set search_path = public, extensions, pg_catalog
as $fn$
begin
  if new.lat is not null and new.lng is not null then
    new.ubicacion := ST_SetSRID(
      ST_MakePoint(new.lng, new.lat),
      4326
    )::geography;
  else
    new.ubicacion := null;
  end if;

  return new;
end;
$fn$;

drop trigger if exists trg_set_ubicacion_recorrido
  on public.recorrido_ubicaciones;

create trigger trg_set_ubicacion_recorrido
before insert or update of lat, lng
on public.recorrido_ubicaciones
for each row
execute function public.set_ubicacion_recorrido();

update public.recorrido_ubicaciones
set ubicacion = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
where ubicacion is null
  and lat is not null
  and lng is not null;

create index if not exists recorrido_ubicaciones_ubicacion_gix
  on public.recorrido_ubicaciones
  using gist (ubicacion);

create index if not exists recorrido_ubicaciones_validas_idx
  on public.recorrido_ubicaciones (recorrido_id, created_at)
  where es_valido = true;

comment on column public.recorrido_ubicaciones.ubicacion is
  'Punto derivado de lat/lng en WGS84 para cálculos PostGIS.';
comment on column public.recorrido_ubicaciones.es_valido is
  'False cuando el punto se descarta por ruido GPS o precisión insuficiente.';

-- ----------------------------------------------------------------------------
-- 3. zonas_riesgo: geography derivada de geojson
-- ----------------------------------------------------------------------------
alter table public.zonas_riesgo
  add column if not exists geometria geography;

create or replace function public.set_geometria_zona_riesgo()
returns trigger
language plpgsql
security invoker
set search_path = public, extensions, pg_catalog
as $fn$
begin
  if new.geojson is not null then
    new.geometria := ST_SetSRID(
      public.geojson_a_geometria(new.geojson),
      4326
    )::geography;
  else
    new.geometria := null;
  end if;

  return new;
end;
$fn$;

drop trigger if exists trg_set_geometria_zona_riesgo
  on public.zonas_riesgo;

create trigger trg_set_geometria_zona_riesgo
before insert or update of geojson
on public.zonas_riesgo
for each row
execute function public.set_geometria_zona_riesgo();

update public.zonas_riesgo
set geometria = ST_SetSRID(
  public.geojson_a_geometria(geojson),
  4326
)::geography
where geojson is not null
  and geometria is null;

create index if not exists zonas_riesgo_geometria_gix
  on public.zonas_riesgo
  using gist (geometria);

comment on column public.zonas_riesgo.geometria is
  'Geometría derivada del GeoJSON para intersecciones PostGIS.';

-- ----------------------------------------------------------------------------
-- 4. RPC: registrar_ubicacion_recorrido
--    - Filtra ruido GPS en servidor.
--    - Recalcula distancia acumulada con ST_Length(ST_MakeLine(...)).
--    - Detecta zonas de riesgo con ST_Intersects sobre geography.
-- ----------------------------------------------------------------------------
create or replace function public.registrar_ubicacion_recorrido(
  p_recorrido_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_precision_m double precision default null,
  p_velocidad_mps double precision default null,
  p_heading double precision default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions, pg_catalog
as $fn$
declare
  v_uid uuid := auth.uid();
  v_nuevo geography;
  v_ultimo geography;
  v_ultimo_created_at timestamptz;
  v_distancia_ultimo double precision;
  v_delta_segundos double precision;
  v_es_valido boolean := true;
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
      and r.estado = 'activo'
  ) then
    raise exception 'Recorrido no encontrado o no activo';
  end if;

  v_nuevo := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;

  -- Último punto válido anterior.
  select u.ubicacion, u.created_at
    into v_ultimo, v_ultimo_created_at
  from public.recorrido_ubicaciones u
  where u.recorrido_id = p_recorrido_id
    and u.es_valido = true
    and u.ubicacion is not null
  order by u.created_at desc, u.id desc
  limit 1;

  -- Filtro de precisión.
  if p_precision_m is not null and p_precision_m > 35 then
    v_es_valido := false;
  end if;

  -- Filtro de velocidad reportada por el dispositivo.
  if v_es_valido
     and p_velocidad_mps is not null
     and p_velocidad_mps > 120 then
    v_es_valido := false;
  end if;

  -- Filtro contra el último punto válido: quieto (<3 m) o salto irreal (>120 m/s).
  if v_es_valido and v_ultimo is not null then
    v_distancia_ultimo := ST_Distance(v_ultimo, v_nuevo);

    v_delta_segundos := greatest(
      extract(epoch from (now() - v_ultimo_created_at))::double precision,
      1
    );

    if v_distancia_ultimo < 3 then
      v_es_valido := false;
    elsif (v_distancia_ultimo / v_delta_segundos) > 120 then
      v_es_valido := false;
    end if;
  end if;

  insert into public.recorrido_ubicaciones (
    recorrido_id,
    lat,
    lng,
    precision_m,
    velocidad_mps,
    heading,
    es_valido
  )
  values (
    p_recorrido_id,
    p_lat,
    p_lng,
    p_precision_m,
    p_velocidad_mps,
    p_heading,
    v_es_valido
  )
  returning id into v_ubicacion_id;

  -- Distancia oficial elipsoidal sobre puntos válidos.
  select case
    when count(*) < 2 then 0
    else ST_Length(
      ST_MakeLine(u.ubicacion::geometry order by u.created_at, u.id)::geography
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
    and estado = 'activo';

  -- Zonas de riesgo activas que contienen el punto actual.
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
  uuid, double precision, double precision, double precision, double precision, double precision
) from public;

grant execute on function public.registrar_ubicacion_recorrido(
  uuid, double precision, double precision, double precision, double precision, double precision
) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. RPC: finalizar_recorrido
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
    and r.estado = 'activo';

  if not found then
    raise exception 'Recorrido no encontrado o no activo';
  end if;

  select case
    when count(*) < 2 then 0
    else ST_Length(
      ST_MakeLine(u.ubicacion::geometry order by u.created_at, u.id)::geography
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

  update public.recorridos
  set estado = 'finalizado',
      finalizado_en = v_finalizado_en,
      distancia_metros = round(v_distancia)::integer,
      duracion_segundos = v_duracion
  where id = p_recorrido_id;

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
-- 6. Estadísticas y recarga del esquema PostgREST
-- ----------------------------------------------------------------------------
analyze public.recorrido_ubicaciones;
analyze public.zonas_riesgo;

notify pgrst, 'reload schema';

commit;

-- ----------------------------------------------------------------------------
-- 7. Verificación rápida (opcional, solo lectura)
-- ----------------------------------------------------------------------------
-- select column_name, data_type, udt_name
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name in ('recorrido_ubicaciones','zonas_riesgo')
--   and column_name in ('es_valido','ubicacion','geometria');
--
-- select id, nombre, ST_GeometryType(geometria::geometry) as tipo
-- from public.zonas_riesgo
-- order by nombre;
--
-- select proname, pg_get_function_identity_arguments(oid) as args
-- from pg_proc
-- where pronamespace = 'public'::regnamespace
--   and proname in ('registrar_ubicacion_recorrido','finalizar_recorrido','geojson_a_geometria','set_ubicacion_recorrido','set_geometria_zona_riesgo')
-- order by proname;
