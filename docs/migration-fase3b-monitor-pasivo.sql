-- Fase 3B. Aplicar antes de desplegar el monitor nuevo.
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
     or to_regclass('public.zonas_riesgo') is null then
    raise exception 'Faltan tablas base de las fases anteriores.';
  end if;
end
$preflight$;

-- ----------------------------------------------------------------------------
-- 1. Columnas de monitoreo pasivo en public.recorridos
-- ----------------------------------------------------------------------------
alter table public.recorridos
  add column if not exists eta_estimado_en timestamptz,
  add column if not exists ultima_ubicacion_en timestamptz,
  add column if not exists parada_riesgo_desde timestamptz,
  add column if not exists checkin_pendiente_desde timestamptz,
  add column if not exists checkin_motivo text;

do $checkin_check$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.recorridos'::regclass
      and conname = 'recorridos_checkin_motivo_check'
  ) then
    alter table public.recorridos
      add constraint recorridos_checkin_motivo_check
      check (
        checkin_motivo is null
        or checkin_motivo in ('sin_senal', 'retraso_eta', 'parada_zona_riesgo')
      );
  end if;
end
$checkin_check$;

comment on column public.recorridos.eta_estimado_en is
  'Hora estimada de llegada calculada con Mapbox Directions al crear el recorrido.';

comment on column public.recorridos.ultima_ubicacion_en is
  'Último punto GPS confiable recibido. Base para detectar pérdida de señal.';

comment on column public.recorridos.parada_riesgo_desde is
  'Inicio de una detención prolongada dentro de una zona de riesgo nivel alto.';

comment on column public.recorridos.checkin_pendiente_desde is
  'Si no es nulo, el servidor ya preguntó "¿Estás bien?" y corre la ventana de gracia.';

comment on column public.recorridos.checkin_motivo is
  'Motivo del check-in: sin_senal, retraso_eta o parada_zona_riesgo.';

-- Índice parcial: el monitor solo audita recorridos activos.
create index if not exists recorridos_monitor_activos_idx
  on public.recorridos (estado, checkin_pendiente_desde, iniciado_en)
  where estado = 'activo';

-- Backfill para recorridos que ya estaban activos antes de esta migración.
update public.recorridos r
set ultima_ubicacion_en = sub.ultima
from (
  select u.recorrido_id, max(u.captured_at) as ultima
  from public.recorrido_ubicaciones u
  where u.es_valido = true
  group by u.recorrido_id
) sub
where r.id = sub.recorrido_id
  and r.ultima_ubicacion_en is null
  and r.estado = 'activo';

update public.recorridos
set eta_estimado_en = iniciado_en + make_interval(secs => duracion_segundos)
where eta_estimado_en is null
  and duracion_segundos is not null
  and estado = 'activo';

-- ----------------------------------------------------------------------------
-- 2. RPC registrar_ubicacion_recorrido
--    - Actualiza ultima_ubicacion_en con puntos GPS confiables.
--    - Detecta paradas en zonas de riesgo alto (PostGIS).
--    - Mantiene la idempotencia offline y el cálculo de distancia.
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
  v_punto_confiable boolean;
  v_evaluar_parada boolean := false;
  v_parada_riesgo boolean := false;
  v_zonas_alto jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_lat is null or p_lng is null
     or p_lat < -90 or p_lat > 90
     or p_lng < -180 or p_lng > 180 then
    raise exception 'Coordenadas inválidas';
  end if;

  perform 1 from public.recorridos r where r.id=p_recorrido_id and r.id_usuario=v_uid
    and r.estado in ('activo','emergencia') for update;
  if not found then
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
    -- El SELECT ... INTO de idempotencia deja las variables en NULL cuando
    -- no encuentra filas, incluida v_es_valido. Se reinicia aquí.
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

  -- Un punto confiable es aquel con GPS utilizable. No exige que implique
  -- desplazamiento: estar quieto también demuestra que hay señal.
  v_punto_confiable := (p_precision_m is null or p_precision_m <= 35);

  -- Detección de parada anómala en zona de riesgo alto. Solo se evalúa con
  -- puntos nuevos (no con reintentos idempotentes) para no borrar el estado.
  if not v_ya_existe and v_punto_confiable then
    v_evaluar_parada := true;

    if v_ultimo is not null then
      v_distancia_ultimo := ST_Distance(v_ultimo, v_nuevo);
      v_delta_segundos := greatest(
        extract(epoch from (v_captured_at - v_ultimo_captured_at))::double precision,
        1
      );
    end if;

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
    into v_zonas_alto
    from public.zonas_riesgo z
    where z.activo = true
      and z.nivel = 'alto'
      and z.geometria is not null
      and ST_Intersects(z.geometria, v_nuevo);

    -- Parada real: poco desplazamiento Y velocidad efectiva baja. Exigir solo
    -- "<15 m" marcaría como parada a alguien que camina despacio dentro de una
    -- zona de riesgo; por eso se combina con la velocidad (reportada o
    -- calculada con el tiempo entre muestras).
    if jsonb_array_length(v_zonas_alto) > 0
       and v_distancia_ultimo is not null
       and v_distancia_ultimo < 15
       and coalesce(
         p_velocidad_mps,
         v_distancia_ultimo / v_delta_segundos
       ) < 0.4 then
      v_parada_riesgo := true;
    end if;
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
  set distancia_metros = round(v_distancia_total)::integer,
      ultima_ubicacion_en = case
        when v_punto_confiable then
          greatest(coalesce(ultima_ubicacion_en, v_captured_at), v_captured_at)
        else ultima_ubicacion_en
      end,
      parada_riesgo_desde = case
        when v_evaluar_parada
          and v_captured_at >= coalesce(ultima_ubicacion_en, v_captured_at) - interval '15 seconds'
          and v_captured_at >= now() - interval '2 minutes' then
          case
            when v_parada_riesgo then
              coalesce(parada_riesgo_desde, v_captured_at)
            else null
          end
        else parada_riesgo_desde
      end
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
    'zonas_riesgo_activas', v_zonas,
    'parada_riesgo', v_parada_riesgo
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
-- 3. RPC finalizar_recorrido: cierra activo/emergencia y limpia el check-in
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
    and r.estado in ('activo', 'emergencia') for update;

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
      duracion_segundos = v_duracion,
      checkin_pendiente_desde = null,
      checkin_motivo = null,
      parada_riesgo_desde = null
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
-- 4. RPC activar_emergencia_recorrido: limpia el check-in al activar
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

  perform 1 from public.recorridos
  where id = p_recorrido_id and id_usuario = v_uid
    and estado in ('activo', 'emergencia') for update;
  if not found then
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

  -- Otro disparador pudo ganar el bloqueo (cron, sacudida o dos dispositivos).
  select a.* into v_alerta from public.alertas a
    where a.id_recorrido=p_recorrido_id and a.id_usuario=v_uid and a.estado='activa'
    order by a.iniciada_en desc limit 1;
  if found then return v_alerta; end if;

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
  set estado = 'emergencia',
      checkin_pendiente_desde = null,
      checkin_motivo = null,
      parada_riesgo_desde = null
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
-- 5. RPC terminar_emergencia_recorrido: limpia el check-in al volver a activo
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

  perform 1 from public.recorridos where id = p_recorrido_id
    and id_usuario = v_uid for update;
  update public.alertas
  set estado = 'terminada',
      terminada_en = coalesce(terminada_en, now())
  where id = p_alerta_id
    and id_usuario = v_uid
    and id_recorrido = p_recorrido_id and estado='activa';

  if not found and exists (
    select 1 from public.alertas where id=p_alerta_id and id_usuario=v_uid and id_recorrido=p_recorrido_id
  ) then
    return jsonb_build_object('alerta_id',p_alerta_id,'recorrido_id',p_recorrido_id,
      'recorrido_estado',(select estado from public.recorridos where id=p_recorrido_id));
  elsif not found then
    raise exception 'Alerta no encontrada o no pertenece al usuario';
  end if;

  update public.recorridos
  set estado = 'activo'
  where id = p_recorrido_id
    and id_usuario = v_uid
    and estado = 'emergencia'
    and not exists (select 1 from public.alertas where id_recorrido=p_recorrido_id and estado='activa')
  returning estado into v_estado_recorrido;

  update public.recorridos
  set checkin_pendiente_desde = null,
      checkin_motivo = null,
      parada_riesgo_desde = null
  where id = p_recorrido_id
    and id_usuario = v_uid;

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
-- Cada pregunta conserva su identidad incluso después del cierre y del replay FIFO.
create table if not exists public.checkins_pasivos (
  checkin_id uuid primary key default gen_random_uuid(),
  recorrido_id uuid not null references public.recorridos(id) on delete cascade,
  motivo text not null check (motivo in ('sin_senal','parada_zona_riesgo','retraso_eta')),
  estado text not null default 'pendiente_entrega' check (estado in
    ('pendiente_entrega','presentada','respondido_ok','escalado','cancelado')),
  creada_en timestamptz not null default clock_timestamp(),
  presentada_en timestamptz,
  respuesta_evento uuid,
  alerta_id uuid references public.alertas(id),
  -- Reserva recuperable para enviar la pregunta o la alerta tras el commit.
  proximo_envio timestamptz default now(),
  intento_id uuid,
  intentos integer not null default 0,
  ultimo_error text
);
create unique index if not exists checkins_uno_abierto on public.checkins_pasivos(recorrido_id)
  where estado in ('pendiente_entrega','presentada');
create index if not exists checkins_por_enviar on public.checkins_pasivos(proximo_envio)
  where proximo_envio is not null;
alter table public.checkins_pasivos enable row level security;
revoke all on public.checkins_pasivos from public, anon, authenticated;
grant select on public.checkins_pasivos to authenticated;
grant select, insert, update on public.checkins_pasivos to service_role;
drop policy if exists leer_checkin_propio on public.checkins_pasivos;
create policy leer_checkin_propio on public.checkins_pasivos for select to authenticated
using (exists (select 1 from public.recorridos r where r.id = recorrido_id and r.id_usuario = (select auth.uid())));

-- Las preguntas antiguas no tenían UUID. Se les concede una nueva ventana de entrega.
insert into public.checkins_pasivos(recorrido_id,motivo)
select id, checkin_motivo from public.recorridos
where estado='activo' and checkin_pendiente_desde is not null and checkin_motivo is not null
on conflict do nothing;
update public.recorridos set checkin_pendiente_desde=null, checkin_motivo=null
where checkin_pendiente_desde is not null or checkin_motivo is not null;
drop function if exists public.responder_checkin_seguridad(uuid,text,uuid);

-- Todos los escritores toman primero el recorrido y luego la pregunta.
create or replace function public.cerrar_checkin_al_salir_de_activo()
returns trigger language plpgsql security definer
set search_path = public, extensions, pg_catalog as $$
begin
  -- Una petición explícita desde el teléfono comparte UUID con la activación FIFO.
  update public.checkins_pasivos c set estado='escalado', alerta_id=a.id,
    proximo_envio=null, intento_id=null
    from public.alertas a where a.client_event_id=c.checkin_id and a.id_recorrido=new.id
      and a.tipo='pasiva' and new.estado='emergencia' and c.recorrido_id=new.id
      and c.estado in ('pendiente_entrega','presentada');
  update public.checkins_pasivos set estado='cancelado', proximo_envio=null, intento_id=null
    where recorrido_id=new.id and estado in ('pendiente_entrega','presentada');
  return new;
end $$;
revoke all on function public.cerrar_checkin_al_salir_de_activo() from public, anon, authenticated;
drop trigger if exists cerrar_checkin_recorrido on public.recorridos;
create trigger cerrar_checkin_recorrido after update of estado on public.recorridos
for each row when (old.estado='activo' and new.estado <> 'activo')
execute function public.cerrar_checkin_al_salir_de_activo();

create or replace function public.marcar_checkin_presentado(p_checkin_id uuid)
returns timestamptz language plpgsql security definer
set search_path = public, extensions, pg_catalog as $$
declare c public.checkins_pasivos;
begin
  perform 1 from public.recorridos r join public.checkins_pasivos p on p.recorrido_id=r.id
    where p.checkin_id=p_checkin_id and r.id_usuario=auth.uid() and r.estado='activo' for update of r;
  if not found then return null; end if;
  select * into c from public.checkins_pasivos where checkin_id=p_checkin_id for update;
  if c.estado='presentada' then return c.presentada_en; end if;
  if c.estado <> 'pendiente_entrega' or clock_timestamp() >= c.creada_en + interval '90 seconds'
    then return null; end if;
  update public.checkins_pasivos set estado='presentada', presentada_en=clock_timestamp(),
    proximo_envio=null, intento_id=null where checkin_id=p_checkin_id returning presentada_en into c.presentada_en;
  return c.presentada_en;
end $$;

create or replace function public.responder_checkin_pasivo(p_checkin_id uuid,p_recorrido_id uuid,p_client_event_id uuid)
returns boolean language plpgsql security definer
set search_path = public, extensions, pg_catalog as $$
declare c public.checkins_pasivos;
begin
  perform 1 from public.recorridos where id=p_recorrido_id and id_usuario=auth.uid()
    and estado='activo' for update;
  if not found then return false; end if;
  select * into c from public.checkins_pasivos where checkin_id=p_checkin_id and recorrido_id=p_recorrido_id for update;
  if not found then return false; end if;
  if c.estado='respondido_ok' then return c.respuesta_evento=p_client_event_id; end if;
  if c.estado not in ('pendiente_entrega','presentada') or clock_timestamp() >=
    coalesce(c.presentada_en + interval '60 seconds', c.creada_en + interval '90 seconds')
    then return false; end if;
  update public.checkins_pasivos set estado='respondido_ok', respuesta_evento=p_client_event_id,
    proximo_envio=null, intento_id=null where checkin_id=p_checkin_id;
  update public.recorridos set
    ultima_ubicacion_en=case when c.motivo='sin_senal' then now() else ultima_ubicacion_en end,
    parada_riesgo_desde=null,
    eta_estimado_en=case when c.motivo='retraso_eta' then now()+interval '15 minutes' else eta_estimado_en end
    where id=p_recorrido_id;
  return true;
end $$;

create or replace function public.escalar_checkin_pasivo(p_checkin_id uuid,p_recorrido_id uuid)
returns uuid language plpgsql security invoker
set search_path = public, extensions, pg_catalog as $$
declare r public.recorridos; c public.checkins_pasivos; a uuid;
begin
  select * into r from public.recorridos where id=p_recorrido_id and estado='activo' for update;
  if not found then return null; end if;
  select * into c from public.checkins_pasivos where checkin_id=p_checkin_id and recorrido_id=r.id for update;
  if not found or c.estado not in ('pendiente_entrega','presentada') or clock_timestamp() <
    coalesce(c.presentada_en + interval '60 seconds', c.creada_en + interval '90 seconds')
    then return null; end if;

  -- El UUID de la pregunta identifica también su única activación pasiva.
  insert into public.alertas(id_recorrido,id_usuario,tipo,estado,modo,lat,lng,client_event_id)
    select r.id,r.id_usuario,'pasiva','activa','silencioso',
      coalesce(u.lat,r.origen_lat),coalesce(u.lng,r.origen_lng),c.checkin_id
    from (select 1) base left join lateral (
      select lat,lng from public.recorrido_ubicaciones where recorrido_id=r.id and es_valido
      order by captured_at desc,id desc limit 1
    ) u on true
    on conflict (client_event_id) do nothing returning id into a;
  if a is null then
    select id into strict a from public.alertas where client_event_id=c.checkin_id and id_recorrido=r.id;
  end if;
  update public.checkins_pasivos set estado='escalado', alerta_id=a, proximo_envio=now(),
    intentos=0, intento_id=null, ultimo_error=null where checkin_id=c.checkin_id;
  update public.recorridos set estado='emergencia', parada_riesgo_desde=null where id=r.id;
  return a;
end $$;

create or replace function public.evaluar_checkins_pasivos()
returns void language plpgsql security invoker
set search_path = public, extensions, pg_catalog as $$
declare r public.recorridos; c public.checkins_pasivos; motivo_actual text;
begin
  for r in select t.* from public.recorridos t where t.estado='activo' and (
    coalesce(t.ultima_ubicacion_en,t.iniciado_en) < now()-interval '4 minutes'
    or t.parada_riesgo_desde < now()-interval '3 minutes'
    or t.eta_estimado_en < now()-interval '15 minutes'
    or exists(select 1 from public.checkins_pasivos p where p.recorrido_id=t.id
      and p.estado in ('pendiente_entrega','presentada'))
  ) order by t.id for update of t skip locked loop
    motivo_actual := case
      when coalesce(r.ultima_ubicacion_en,r.iniciado_en) < now()-interval '4 minutes' then 'sin_senal'
      when r.parada_riesgo_desde < now()-interval '3 minutes' then 'parada_zona_riesgo'
      when r.eta_estimado_en < now()-interval '15 minutes' then 'retraso_eta' end;
    select * into c from public.checkins_pasivos where recorrido_id=r.id
      and estado in ('pendiente_entrega','presentada') for update;
    if found then
      if motivo_actual is null then
        update public.checkins_pasivos set estado='cancelado',proximo_envio=null,intento_id=null
          where checkin_id=c.checkin_id;
      else
        perform public.escalar_checkin_pasivo(c.checkin_id,r.id);
      end if;
    elsif motivo_actual is not null then
      insert into public.checkins_pasivos(recorrido_id,motivo) values(r.id,motivo_actual);
    end if;
  end loop;
end $$;

create or replace function public.reservar_envios_checkin()
returns setof public.checkins_pasivos language sql security invoker
set search_path = public, extensions, pg_catalog as $$
  with lote as (
    select checkin_id from public.checkins_pasivos
    where proximo_envio <= now() and (estado='escalado' or
      (estado='pendiente_entrega' and creada_en + interval '90 seconds' > now()))
    order by proximo_envio limit 25 for update skip locked
  )
  update public.checkins_pasivos c set proximo_envio=now()+interval '2 minutes',
    intento_id=gen_random_uuid(), intentos=intentos+1
  from lote where c.checkin_id=lote.checkin_id returning c.*
$$;

revoke all on function public.marcar_checkin_presentado(uuid), public.responder_checkin_pasivo(uuid,uuid,uuid)
  from public,anon;
grant execute on function public.marcar_checkin_presentado(uuid), public.responder_checkin_pasivo(uuid,uuid,uuid)
  to authenticated;
revoke all on function public.escalar_checkin_pasivo(uuid,uuid), public.evaluar_checkins_pasivos(),
  public.reservar_envios_checkin() from public,anon,authenticated;
grant execute on function public.escalar_checkin_pasivo(uuid,uuid), public.evaluar_checkins_pasivos(),
  public.reservar_envios_checkin() to service_role;

-- Cada dispositivo acepta un solo despacho por alerta. Una reserva expira si cae la función.
create table if not exists public.envios_alerta_push (
  alerta_id uuid not null references public.alertas(id) on delete cascade,
  token text not null, aceptado boolean not null default false,
  reservado_hasta timestamptz, intento_id uuid,
  primary key(alerta_id, token)
);
alter table public.envios_alerta_push enable row level security;
revoke all on public.envios_alerta_push from public,anon,authenticated;
grant select,insert,update on public.envios_alerta_push to service_role;

create or replace function public.reservar_destinos_alerta(p_alerta_id uuid,p_tokens text[],p_intento uuid)
returns setof text language plpgsql security invoker
set search_path = public, extensions, pg_catalog as $$
begin
  insert into public.envios_alerta_push(alerta_id,token)
    select p_alerta_id,t from unnest(p_tokens) t order by t on conflict do nothing;
  return query update public.envios_alerta_push e set intento_id=p_intento,
    reservado_hasta=now()+interval '2 minutes' where e.alerta_id=p_alerta_id and e.token=any(p_tokens)
    and not e.aceptado and (e.reservado_hasta is null or e.reservado_hasta <= now()) returning e.token;
end $$;
revoke all on function public.reservar_destinos_alerta(uuid,text[],uuid) from public,anon,authenticated;
grant execute on function public.reservar_destinos_alerta(uuid,text[],uuid) to service_role;

do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime' and not puballtables)
    and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
      and schemaname='public' and tablename='checkins_pasivos') then
    alter publication supabase_realtime add table public.checkins_pasivos;
  end if;
end $$;
notify pgrst, 'reload schema';
commit;


-- Activación operativa después de desplegar las dos Edge Functions y configurar Vault.
-- El primer trabajo evalúa los vencimientos en la base. El segundo despacha la bandeja.
-- select cron.schedule('evaluar-checkins-pasivos','1 second','select public.evaluar_checkins_pasivos()');
-- select cron.schedule('monitor-recorridos-pasivos','10 seconds', $trabajo$
--   select net.http_post(
--     url := 'https://kbthjrgbrkzbzmnrarnp.supabase.co/functions/v1/monitor-recorridos-pasivos',
--     headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',
--       (select decrypted_secret from vault.decrypted_secrets where name='monitor_cron_secret')),
--     body := '{}'::jsonb, timeout_milliseconds := 30000);
-- $trabajo$);
