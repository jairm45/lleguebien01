import { useFocusEffect } from "expo-router";
import { useCallback, useId, useState } from "react";
import { useSesion } from "../context/SesionContext";
import { obtenerVinculosEstudiante, type Vinculo } from "../services/seguidores";
import { supabase } from "../services/supabase";

type Consulta = { id?: string; vinculos?: Vinculo[]; error?: string };

export function useVinculosEstudiante() {
  const { session, cargando } = useSesion();
  const id = session?.user.id;
  const instancia = useId();
  const [consulta, guardar] = useState<Consulta>({});
  const [version, cambiarVersion] = useState(0);
  const recargar = useCallback(() => cambiarVersion(v => v + 1), []);

  useFocusEffect(useCallback(() => {
    if (!id) return;
    let vigente = true;
    let ultimaPeticion = 0;
    async function cargar(estudiante: string) {
      if (!vigente) return;
      const peticion = ++ultimaPeticion;
      try {
        const vinculos = await obtenerVinculosEstudiante(estudiante);
        if (peticion === ultimaPeticion) guardar({ id: estudiante, vinculos });
      } catch {
        if (peticion === ultimaPeticion) guardar({ id: estudiante, error: "No se pudieron cargar tus seguidores." });
      }
    }

    guardar({ id });
    void cargar(id);
    const canal = supabase.channel(`seguidores-${id}-${instancia}-${version}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "seguidores", filter: `id_estudiante=eq.${id}`,
      }, () => { void cargar(id); })
      .subscribe(estado => {
        // Cubre aceptaciones ocurridas mientras se conectaba o reconectaba el canal.
        if (estado === "SUBSCRIBED") void cargar(id);
      });
    return () => {
      vigente = false;
      ultimaPeticion++;
      void supabase.removeChannel(canal);
    };
  }, [id, instancia, version]));

  const actual = id && consulta.id === id ? consulta : {};
  return {
    vinculos: actual.vinculos,
    error: !id && !cargando ? "Inicia sesión para gestionar tus seguidores." : actual.error,
    recargar,
  };
}
