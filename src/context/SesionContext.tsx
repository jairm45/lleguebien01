import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { procesarColaOffline } from "../services/colaOffline";
import { registrarTokenPush } from "../services/notificacionesPush";
import { supabase } from "../services/supabase";

type EstadoSesion = {
  session: Session | null;
  cargando: boolean;
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

    const { data } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      if (!activo) return;
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

  useEffect(() => {
    if (!usuarioId) return;

    // El token se elimina del servidor al cerrar sesión (perfil.tsx),
    // antes de que Supabase invalide el JWT.
    void registrarTokenPush();

    // Con sesión restaurada ya se puede vaciar la cola offline pendiente.
    void procesarColaOffline();
  }, [usuarioId]);

  const value = useMemo(
    () => ({ session, cargando }),
    [cargando, session],
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
