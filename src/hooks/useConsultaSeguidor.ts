import { useFocusEffect } from "expo-router";
import { useCallback, useId, useRef, useState } from "react";
import { AppState } from "react-native";
import { useSesion } from "../context/SesionContext";
import { supabase } from "../services/supabase";

// El canal solo indica cambios. Las lecturas pasan siempre por las RPC y RLS del usuario.
export function useConsultaSeguidor<T>(cargar: () => Promise<T>, recorridoId?: string) {
  const { session } = useSesion();
  const usuario = session?.user.id;
  const instancia = useId();
  const [revision, cambiar] = useState(0);
  const reintentar = () => cambiar(n => n + 1);
  const [estado, guardar] = useState<{ clave: string; valor?: T; error?: string }>();
  const clave = [usuario, recorridoId, instancia].join("/");
  const turno = useRef(0);
  useFocusEffect(useCallback(() => {
    if (!usuario) return;
    let vigente = true, ocupado = false, pendiente = false;
    const leer = async () => {
      if (!vigente) return;
      if (ocupado) { pendiente = true; return; }
      ocupado = true;
      try { const valor = await cargar(); if (vigente) guardar({ clave, valor }); }
      catch (e) { if (vigente) guardar({ clave, error: e instanceof Error ? e.message : "No se pudo actualizar." }); }
      finally {
        ocupado = false;
        if (pendiente && vigente) { pendiente = false; void leer(); }
      }
    };
    guardar(undefined);
    void leer();
    const canal = supabase.channel(`seguidor/${clave}/${++turno.current}`);
    const tablas = [
      { table: "recorridos", filter: recorridoId ? `id=eq.${recorridoId}` : undefined },
      { table: "alertas", filter: recorridoId ? `id_recorrido=eq.${recorridoId}` : undefined },
      { table: "seguidores", filter: undefined },
    ];
    if (recorridoId) tablas.push({ table: "recorrido_ubicaciones", filter: `recorrido_id=eq.${recorridoId}` });
    for (const tabla of tablas) canal.on("postgres_changes", { event: "*", schema: "public", ...tabla }, () => { void leer(); });
    canal.subscribe(s => { if (s === "SUBSCRIBED") void leer(); });
    const app = AppState.addEventListener("change", s => { if (s === "active") void leer(); });
    const reloj = setInterval(() => { if (AppState.currentState !== "background") void leer(); }, 20000);
    return () => { vigente = false; clearInterval(reloj); app.remove(); void supabase.removeChannel(canal); };
  }, [usuario, instancia, revision, clave, cargar, recorridoId]));
  return { datos: estado?.clave === clave ? estado.valor : undefined, error: estado?.clave === clave ? estado.error : undefined, reintentar };
}
