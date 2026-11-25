import { useLinkingURL } from "expo-linking";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

// Supabase devuelve la sesión de recuperación en el fragmento del enlace nativo.
export function useEnlaceRecuperacion() {
  const url = useLinkingURL();
  const { code, access_token, refresh_token, type } = useLocalSearchParams<{
    code?: string; access_token?: string; refresh_token?: string; type?: string;
  }>();
  const [estado, guardar] = useState<"cargando" | "listo" | "invalido">("cargando");
  useEffect(() => {
    let vigente = true;
    async function recuperar() {
      const enlace = url ? new URL(url) : null;
      const parametros = new URLSearchParams(enlace?.hash.slice(1) ?? "");
      const acceso = access_token ?? parametros.get("access_token");
      const refresco = refresh_token ?? parametros.get("refresh_token");
      if (code) return !(await supabase.auth.exchangeCodeForSession(code)).error;
      if ((type ?? parametros.get("type")) === "recovery" && acceso && refresco)
        return !(await supabase.auth.setSession({ access_token: acceso, refresh_token: refresco })).error;
      return false;
    }
    void recuperar().then(ok => { if (vigente) guardar(ok ? "listo" : "invalido"); })
      .catch(() => { if (vigente) guardar("invalido"); });
    return () => { vigente = false; };
  }, [url, code, access_token, refresh_token, type]);
  return estado;
}
