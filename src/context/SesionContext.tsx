import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { iniciarSincronizacionAutomatica } from "../services/colaOffline";
import { registrarTokenPush } from "../services/notificacionesPush";
import { supabase } from "../services/supabase";

import { leerRecorridoVerificado } from "../services/recorridos";
import { borrarCodigo, destinoEstudianteSinRed, leerPerfil, type PerfilSesion } from "../services/perfilSesion";

type EstadoSesion = {
  session: Session | null;
  cargando: boolean;
  perfil: PerfilSesion | null;
  leyendoPerfil: boolean;
  errorPerfil: string | null;
  actualizarPerfil: (id: string) => Promise<PerfilSesion | null>;
};

const SesionContext = createContext<EstadoSesion | undefined>(undefined);

export function SesionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [cargando, setCargando] = useState(true);
  const inicializadoRef = useRef(false);

  useEffect(() => {
    let activo = true;

    const finalizarCargaInicial = () => {
      if (!activo || inicializadoRef.current) return;
      inicializadoRef.current = true;
      setCargando(false);
    };

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!activo) return;
        setSession(data.session);
      })
      .catch(() => {
        if (!activo) return;
        setSession(null);
      })
      .finally(finalizarCargaInicial);

    const { data } = supabase.auth.onAuthStateChange((evento, nuevaSesion) => {
      if (!activo) return;
      if (!nuevaSesion) guardarLectura(null);
      if (evento === "SIGNED_OUT") void borrarCodigo().catch(() => undefined);
      setSession(nuevaSesion);

      if (inicializadoRef.current) {
        setCargando(false);
      }
    });

    return () => {
      activo = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const usuarioId = session?.user.id ?? null;

  const [lectura, guardarLectura] = useState<{ id: string; perfil: PerfilSesion | null; error: string | null } | null>(null);
  const revision = useRef(0);
  const actualizarPerfil = useCallback(async (id: string) => {
    const turno = ++revision.current;
    try {
      const perfil = await leerPerfil(id);
      if (turno === revision.current) guardarLectura({ id, perfil, error: null });
      return perfil;
    } catch (error) {
      if (turno === revision.current) guardarLectura(anterior => ({ id, perfil: anterior?.id === id ? anterior.perfil : null, error: "No se pudo cargar tu perfil." }));
      throw error;
    }
  }, []);
  useEffect(() => {
    if (usuarioId) void actualizarPerfil(usuarioId).catch(() => undefined);

    return () => { revision.current++; };
  }, [usuarioId, actualizarPerfil]);
  const actual = lectura?.id === usuarioId ? lectura : null;

  useEffect(() => {
    if (!usuarioId) return;

    // El token se elimina del servidor al cerrar sesión (perfil.tsx),
    // antes de que Supabase invalide el JWT.
    void registrarTokenPush();
  }, [usuarioId]);

  const rol = actual?.perfil?.rol;
  useEffect(() => {
    if (!usuarioId || rol === "seguidor") return;
    if (rol === "estudiante") return iniciarSincronizacionAutomatica();
    // Un estudiante sin red puede reanudar su recorrido incluso al actualizar desde 3B.
    let vigente = true;
    let detener: (() => void) | undefined;
    void Promise.all([destinoEstudianteSinRed(usuarioId), leerRecorridoVerificado(usuarioId)])
      .then(([destino, recorrido]) => {
        if (vigente && (destino || recorrido)) detener = iniciarSincronizacionAutomatica();
      }).catch(() => undefined);
    return () => { vigente = false; detener?.(); };
  }, [usuarioId, rol]);

  const value = useMemo(
    () => ({ session, cargando, perfil: actual?.perfil ?? null, errorPerfil: actual?.error ?? null,
      leyendoPerfil: Boolean(usuarioId && !actual), actualizarPerfil }),
    [cargando, session, actual, usuarioId, actualizarPerfil],
  );

  return (
    <SesionContext.Provider value={value}>{children}</SesionContext.Provider>
  );
}

export function useSesion(): EstadoSesion {
  const contexto = useContext(SesionContext);

  if (!contexto) {
    throw new Error("useSesion debe usarse dentro de SesionProvider.");
  }

  return contexto;
}
