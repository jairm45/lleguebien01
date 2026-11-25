import { supabase } from "./supabase";

export type DestinoGuardado = {
  id: string;
  id_usuario: string;
  nombre: string;
  direccion: string | null;
  lat: number;
  lng: number;
  es_predeterminado: boolean;
  created_at: string;
  updated_at: string;
};

type GuardarDestinoInput = {
  id?: string | null;
  nombre: string;
  direccion?: string | null;
  lat: number;
  lng: number;
  esPredeterminado?: boolean;
};

function normalizarFila(data: unknown): DestinoGuardado | null {
  const fila = Array.isArray(data) ? data[0] : data;

  if (!fila) return null;

  return fila as DestinoGuardado;
}

export async function listarDestinosGuardados(): Promise<DestinoGuardado[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("destinos_guardados")
    .select(
      "id, id_usuario, nombre, direccion, lat, lng, es_predeterminado, created_at, updated_at",
    )
    .eq("id_usuario", user.id)
    .order("es_predeterminado", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`No se pudieron cargar los destinos: ${error.message}`);
  }

  return (data ?? []) as DestinoGuardado[];
}

export async function guardarDestino({
  id,
  nombre,
  direccion = null,
  lat,
  lng,
  esPredeterminado = false,
}: GuardarDestinoInput): Promise<DestinoGuardado> {
  const { data, error } = await supabase.rpc("guardar_destino_usuario", {
    p_nombre: nombre,
    p_lat: lat,
    p_lng: lng,
    p_direccion: direccion,
    p_es_predeterminado: esPredeterminado,
    p_destino_id: id ?? null,
  });

  if (error) {
    throw new Error(`No se pudo guardar el destino: ${error.message}`);
  }

  const destino = normalizarFila(data);

  if (!destino) {
    throw new Error("El servidor no devolvió el destino guardado.");
  }

  return destino;
}

export async function establecerDestinoPredeterminado(
  id: string,
): Promise<DestinoGuardado> {
  const { data, error } = await supabase.rpc(
    "establecer_destino_predeterminado",
    { p_destino_id: id },
  );

  if (error) {
    throw new Error(
      `No se pudo establecer el destino predeterminado: ${error.message}`,
    );
  }

  const destino = normalizarFila(data);

  if (!destino) {
    throw new Error("El servidor no devolvió el destino actualizado.");
  }

  return destino;
}

export async function eliminarDestino(id: string): Promise<void> {
  const { error } = await supabase
    .from("destinos_guardados")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`No se pudo eliminar el destino: ${error.message}`);
  }
}
