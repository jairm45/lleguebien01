BEGIN;

ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS rol text DEFAULT 'estudiante';
UPDATE public.perfiles SET rol = 'estudiante' WHERE rol IS NULL;
ALTER TABLE public.perfiles
  ALTER COLUMN rol SET DEFAULT 'estudiante', ALTER COLUMN rol SET NOT NULL,
  ALTER COLUMN universidad DROP NOT NULL, ALTER COLUMN direccion DROP NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid = 'public.perfiles'::regclass
                 AND conname = 'perfiles_rol_check') THEN
    ALTER TABLE public.perfiles ADD CONSTRAINT perfiles_rol_check CHECK (rol IN ('estudiante', 'seguidor'));
  END IF;
END $$;

ALTER TABLE public.seguidores
  ADD COLUMN IF NOT EXISTS codigo_expira_en timestamptz,
  ADD COLUMN IF NOT EXISTS vinculado_en timestamptz;
UPDATE public.seguidores SET codigo_expira_en = created_at + interval '24 hours'
WHERE estado = 'pendiente' AND codigo_expira_en IS NULL;
CREATE INDEX IF NOT EXISTS seguidores_seguidor_estado_idx ON public.seguidores (id_seguidor, estado);
-- La base ya tiene índices únicos para el código y el par estudiante/seguidor.
-- Las mutaciones pasan por RPC para que el cliente no pueda simular una aceptación.
REVOKE ALL ON public.seguidores FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.seguidores TO authenticated;

CREATE OR REPLACE FUNCTION public.crear_invitacion_seguidor(
  p_nombre text, p_email text DEFAULT NULL, p_telefono text DEFAULT NULL
) RETURNS public.seguidores LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_catalog AS $$
DECLARE
  v_usuario uuid := auth.uid();
  v_email text := nullif(lower(trim(p_email)), '');
  v_fila public.seguidores;
  v_azar bytea;
  v_codigo text;
BEGIN
  IF NOT EXISTS (SELECT FROM public.perfiles p WHERE p.id = v_usuario AND p.rol = 'estudiante')
     OR coalesce(auth.jwt()->>'email', '') !~* '@unipacifico[.]edu[.]co$' THEN
    RAISE EXCEPTION 'Se requiere una cuenta de estudiante.';
  END IF;
  IF nullif(trim(p_nombre), '') IS NULL OR length(trim(p_nombre)) > 120 THEN
    RAISE EXCEPTION 'Escribe un nombre de hasta 120 caracteres.';
  END IF;
  IF v_email IS NOT NULL AND (length(v_email) > 254 OR v_email !~ '^[^[:space:],;<>@"\\]+@([a-z0-9-]+[.])+[a-z0-9-]+$') THEN
    RAISE EXCEPTION 'Escribe un correo electrónico válido.';
  END IF;
  LOOP
    v_azar := extensions.gen_random_bytes(6);
    SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + get_byte(v_azar, i) % 32, 1), '' ORDER BY i)
    INTO v_codigo FROM generate_series(0,5) i;
    INSERT INTO public.seguidores (id_estudiante, nombre, email, telefono, estado, codigo_invitacion, codigo_expira_en)
    VALUES (v_usuario, trim(p_nombre), v_email, nullif(trim(p_telefono), ''), 'pendiente', v_codigo, now() + interval '24 hours')
    ON CONFLICT (codigo_invitacion) DO NOTHING RETURNING * INTO v_fila;
    IF FOUND THEN RETURN v_fila; END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.obtener_invitacion_por_codigo(p_codigo text)
RETURNS TABLE (id uuid, nombre_completo text, universidad text, codigo_expira_en timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions, pg_catalog AS $$
  SELECT s.id, p.nombre_completo, p.universidad, s.codigo_expira_en
  FROM public.seguidores s JOIN public.perfiles p ON p.id = s.id_estudiante
  WHERE auth.uid() IS NOT NULL AND s.codigo_invitacion = upper(trim(p_codigo))
    AND s.estado = 'pendiente' AND s.codigo_expira_en > now();
$$;

CREATE OR REPLACE FUNCTION public.aceptar_invitacion_seguidor(p_codigo text)
RETURNS TABLE (id uuid, nombre_completo text, telefono text, universidad text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_catalog AS $$
DECLARE
  v_usuario uuid := auth.uid();
  v_fila public.seguidores;
BEGIN
  SELECT s.* INTO v_fila FROM public.seguidores s
  WHERE s.codigo_invitacion = upper(trim(p_codigo)) AND s.estado = 'pendiente' FOR UPDATE;
  IF NOT FOUND OR v_fila.codigo_expira_en IS NULL OR v_fila.codigo_expira_en <= clock_timestamp() THEN
    RAISE EXCEPTION 'La invitación ya no está disponible.';
  END IF;
  IF v_fila.id_estudiante = v_usuario THEN RAISE EXCEPTION 'No puedes aceptar tu propia invitación.'; END IF;
  IF NOT EXISTS (SELECT FROM public.perfiles p WHERE p.id = v_usuario AND p.rol = 'seguidor') THEN
    RAISE EXCEPTION 'Se requiere una cuenta de seguidor.';
  END IF;
  -- El código se puede compartir. Las emergencias van a la cuenta que realmente aceptó.
  UPDATE public.seguidores s SET id_seguidor = v_usuario, estado = 'activo', vinculado_en = now(),
    email = (SELECT lower(u.email) FROM auth.users u WHERE u.id = v_usuario AND u.email_confirmed_at IS NOT NULL)
  WHERE s.id = v_fila.id;
  RETURN QUERY SELECT p.id, p.nombre_completo, p.telefono, p.universidad
    FROM public.perfiles p WHERE p.id = v_fila.id_estudiante;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'Ya sigues a este estudiante.';
END $$;

CREATE OR REPLACE FUNCTION public.rechazar_invitacion_seguidor(p_codigo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_catalog AS $$
BEGIN
  UPDATE public.seguidores s SET estado = 'rechazado'
  WHERE s.codigo_invitacion = upper(trim(p_codigo)) AND s.estado = 'pendiente'
    AND s.codigo_expira_en > clock_timestamp() AND s.id_estudiante <> auth.uid()
    AND EXISTS (SELECT FROM public.perfiles p WHERE p.id = auth.uid() AND p.rol = 'seguidor');
  IF NOT FOUND THEN RAISE EXCEPTION 'La invitación ya no está disponible.'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.listar_estudiantes_seguidos()
RETURNS TABLE (id uuid, nombre_completo text, telefono text, universidad text,
               recorrido_actual jsonb, ultimo_recorrido_finalizado jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions, pg_catalog AS $$
  SELECT p.id, p.nombre_completo, p.telefono, p.universidad, to_jsonb(actual), to_jsonb(ultimo)
  FROM public.seguidores s JOIN public.perfiles p ON p.id = s.id_estudiante
  LEFT JOIN LATERAL (
    SELECT r.id, r.estado, r.iniciado_en, r.destino_nombre FROM public.recorridos r
    WHERE r.id_usuario = p.id AND r.estado IN ('activo', 'emergencia')
    ORDER BY r.iniciado_en DESC, r.id LIMIT 1
  ) actual ON true
  LEFT JOIN LATERAL (
    SELECT r.id, r.finalizado_en, r.destino_nombre FROM public.recorridos r
    WHERE r.id_usuario = p.id AND r.estado = 'finalizado'
    ORDER BY r.finalizado_en DESC NULLS LAST, r.id LIMIT 1
  ) ultimo ON true
  WHERE s.id_seguidor = auth.uid() AND s.estado = 'activo' ORDER BY p.nombre_completo, p.id;
$$;

CREATE OR REPLACE FUNCTION public.revocar_seguidor(p_vinculo_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_catalog AS $$
BEGIN
  DELETE FROM public.seguidores s WHERE s.id = p_vinculo_id
    AND s.id_estudiante = auth.uid() AND s.estado IN ('pendiente','activo');
  IF NOT FOUND THEN RAISE EXCEPTION 'El vínculo ya no está disponible.'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.crear_invitacion_seguidor(text,text,text), public.obtener_invitacion_por_codigo(text),
  public.aceptar_invitacion_seguidor(text), public.rechazar_invitacion_seguidor(text),
  public.listar_estudiantes_seguidos(), public.revocar_seguidor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_invitacion_seguidor(text,text,text), public.obtener_invitacion_por_codigo(text),
  public.aceptar_invitacion_seguidor(text), public.rechazar_invitacion_seguidor(text),
  public.listar_estudiantes_seguidos(), public.revocar_seguidor(uuid) TO authenticated;

-- Una reserva no caduca: si Gmail acepta el mensaje y la función se interrumpe,
-- un reintento jamás vuelve a enviarlo. Solo un rechazo SMTP inequívoco permite reintentar.
CREATE TABLE IF NOT EXISTS public.envios_alerta_correo (
  alerta_id uuid NOT NULL REFERENCES public.alertas(id) ON DELETE CASCADE,
  id_seguidor uuid NOT NULL,
  estado text NOT NULL DEFAULT 'reservado' CHECK (estado IN ('reservado','enviado','incierto','reintentar')),
  PRIMARY KEY (alerta_id, id_seguidor)
);
ALTER TABLE public.envios_alerta_correo ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.envios_alerta_correo FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.envios_alerta_correo TO service_role;

CREATE OR REPLACE FUNCTION public.reservar_correo_alerta(p_alerta_id uuid, p_seguidor uuid)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, extensions, pg_catalog AS $$
DECLARE v_email text;
BEGIN
  SELECT s.email INTO v_email FROM public.alertas a JOIN public.seguidores s ON a.id_usuario = s.id_estudiante
  WHERE a.id = p_alerta_id AND a.estado = 'activa' AND a.tipo IN ('manual','sacudida','notificacion_rapida','pasiva')
    AND s.id_seguidor = p_seguidor AND s.estado = 'activo' AND nullif(trim(s.email),'') IS NOT NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;
  INSERT INTO public.envios_alerta_correo AS e (alerta_id, id_seguidor) VALUES (p_alerta_id, p_seguidor)
  ON CONFLICT (alerta_id, id_seguidor) DO UPDATE SET estado = 'reservado' WHERE e.estado = 'reintentar';
  IF FOUND THEN RETURN v_email; END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.reservar_correo_alerta(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reservar_correo_alerta(uuid,uuid) TO service_role;

DO $$
DECLARE v_tabla text;
BEGIN
  FOREACH v_tabla IN ARRAY ARRAY['recorridos','recorrido_ubicaciones','alertas','seguidores'] LOOP
    IF NOT EXISTS (SELECT FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
                   AND schemaname = 'public' AND tablename = v_tabla) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_tabla);
    END IF;
  END LOOP;
END $$;

COMMIT;
