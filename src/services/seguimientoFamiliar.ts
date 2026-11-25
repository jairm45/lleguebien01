import { estudiantesSeguidos, type EstudianteSeguido } from "./seguidores";
import { supabase } from "./supabase";
import type { RecorridoActivo } from "./recorridos";
import type { Alerta } from "./emergencias";
import { distanciaHaversineMetros, estimarDuracionSegundos } from "../lib/recorrido";
import type { ZonasRiesgo } from "./zonasRiesgo";

const camposRuta = "id,id_usuario,estado,destino_nombre,origen_lat,origen_lng,destino_lat,destino_lng,ruta_geojson,distancia_metros,duracion_segundos,iniciado_en,eta_estimado_en,ultima_ubicacion_en,parada_riesgo_desde";
export async function cargarInicio() {
  const estudiantes = await estudiantesSeguidos();
  const ids = estudiantes.flatMap(e => e.recorrido_actual ? [e.recorrido_actual.id] : []);
  if (!ids.length) return { estudiantes, rutas: [] as RecorridoActivo[] };
  const { data, error } = await supabase.from("recorridos").select(camposRuta).in("id", ids)
    .in("estado", ["activo", "emergencia"]).returns<RecorridoActivo[]>();
  if (error) throw new Error("No se pudieron consultar los recorridos.");
  return { estudiantes, rutas: data ?? [] };
}

export function avance(r: RecorridoActivo) {
  let total = Number(r.ruta_geojson?.properties?.distanciaMetros);
  if (!(total > 0) && r.origen_lat != null && r.origen_lng != null && r.destino_lat != null && r.destino_lng != null) {
    total = distanciaHaversineMetros({ latitude: r.origen_lat, longitude: r.origen_lng }, { latitude: r.destino_lat, longitude: r.destino_lng });
  }
  const restante = total > 0 ? Math.max(0, total - (r.distancia_metros ?? 0)) : null;
  const porcentaje = restante != null ? Math.max(0, Math.min(100, Math.round(100 * (1 - restante / total)))) : null;
  const eta = r.eta_estimado_en ?? (restante != null && r.ultima_ubicacion_en
    ? new Date(Date.parse(r.ultima_ubicacion_en) + estimarDuracionSegundos(restante) * 1000).toISOString() : null);
  return { restante, porcentaje, eta };
}

export type Hito = { clave: string; tipo: "salida" | "llegada" | "emergencia"; fecha: string; nombre: string; recorridoId: string; alertaId?: string };
async function paginas<T>(limite: number, consultar: (desde: number, hasta: number) =>
  PromiseLike<{ data: T[] | null; error: unknown }>) {
  const filas: T[] = [];
  while (filas.length <= limite) {
    const cantidad = Math.min(250, limite + 1 - filas.length);
    const { data, error } = await consultar(filas.length, filas.length + cantidad - 1);
    if (error || !data) throw new Error("No se pudo cargar la actividad.");
    filas.push(...data);
    if (data.length < cantidad) break;
  }
  return filas;
}
export async function cargarHistorial(limite: number) {
  const estudiantes = await estudiantesSeguidos();
  if (!estudiantes.length) return { hitos: [] as Hito[], hayMas: false };
  const nombres = new Map(estudiantes.map(e => [e.id, e.nombre_completo]));
  const ids = [...nombres.keys()];
  const [rutas, alertas] = await Promise.all([
    paginas(limite, (desde, hasta) => supabase.from("recorridos").select("id,id_usuario,iniciado_en,estado,finalizado_en")
      .in("id_usuario", ids).order("iniciado_en", { ascending: false }).order("id").range(desde, hasta)),
    paginas(limite, (desde, hasta) => supabase.from("alertas").select("id,id_usuario,id_recorrido,iniciada_en")
      .in("id_usuario", ids).order("iniciada_en", { ascending: false }).order("id").range(desde, hasta)),
  ]);
  const hitos: Hito[] = [];
  for (const r of rutas.slice(0, limite)) {
    const base = { nombre: nombres.get(r.id_usuario)!, recorridoId: r.id };
    hitos.push({ ...base, clave: r.id + "-salida", tipo: "salida", fecha: r.iniciado_en });
    if (r.estado === "finalizado" && r.finalizado_en)
      hitos.push({ ...base, clave: r.id + "-llegada", tipo: "llegada", fecha: r.finalizado_en });
  }
  for (const a of alertas.slice(0, limite)) hitos.push({ clave: a.id, alertaId: a.id, tipo: "emergencia", nombre: nombres.get(a.id_usuario)!,
    fecha: a.iniciada_en, recorridoId: a.id_recorrido });
  hitos.sort((a,b) => Date.parse(b.fecha) - Date.parse(a.fecha));
  return { hitos, hayMas: rutas.length > limite || alertas.length > limite };
}

export type Punto = { id: number; lat: number; lng: number; precision_m: number | null; captured_at: string };
type AlertaMapa = Pick<Alerta, "id" | "estado" | "lat" | "lng" | "iniciada_en" | "terminada_en">;
export type Seguimiento = { ruta: RecorridoActivo; estudiante: EstudianteSeguido; alerta: AlertaMapa | null; puntos: Punto[] };

export function consultaMapa(recorridoId: string, alertaId?: string) {
  // Las inserciones FIFO pueden llegar tarde. Se leen por id y se dibujan por fecha de captura.
  let ultimoId = 0;
  const puntos = new Map<number, Punto>();
  return async (): Promise<Seguimiento> => {
    const [r, estudiantes] = await Promise.all([
      supabase.from("recorridos").select(camposRuta).eq("id", recorridoId).maybeSingle<RecorridoActivo>(),
      estudiantesSeguidos(),
    ]);
    if (r.error) throw new Error("No se pudo consultar el recorrido.");
    const ruta = r.data;
    const estudiante = estudiantes.find(e => e.id === ruta?.id_usuario);
    if (!ruta || !estudiante) throw new Error("Este recorrido ya no está disponible para tu cuenta.");
    let q = supabase.from("alertas").select("id,estado,lat,lng,iniciada_en,terminada_en").eq("id_recorrido", recorridoId);
    q = alertaId ? q.eq("id", alertaId) : q.eq("estado", "activa");
    const { data: alerta, error } = await q.order("iniciada_en", { ascending: false }).limit(1).maybeSingle<AlertaMapa>();
    if (error || (alertaId && !alerta)) throw new Error("No se pudo consultar esta alerta.");
    for (;;) {
      const { data, error: fallo } = await supabase.from("recorrido_ubicaciones")
        .select("id,lat,lng,precision_m,captured_at").eq("recorrido_id", recorridoId).eq("es_valido", true)
        .gt("id", ultimoId).order("id").limit(500).returns<Punto[]>();
      if (fallo) throw new Error("No se pudo actualizar la ubicación.");
      for (const p of data) puntos.set(p.id, p);
      if (data.length) ultimoId = Math.max(ultimoId, data[data.length - 1].id);
      if (data.length < 500) break;
    }
    const cierre = alerta?.estado && alerta.estado !== "activa" ? Date.parse(alerta.terminada_en ?? alerta.iniciada_en) : Infinity;
    const rastro = [...puntos.values()].filter(p => Date.parse(p.captured_at) <= cierre)
      .sort((a,b) => Date.parse(a.captured_at) - Date.parse(b.captured_at) || a.id - b.id);
    return { ruta, estudiante, alerta, puntos: rastro };
  };
}

function dentroAnillo(x: number, y: number, anillo: number[][]) {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}
export function zonaActual(zonas: ZonasRiesgo, lat: number, lng: number) {
  return zonas.features.find(({ geometry: g }) => {
    const poligonos = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    return poligonos.some(([exterior, ...huecos]) => exterior && dentroAnillo(lng, lat, exterior) && !huecos.some(h => dentroAnillo(lng, lat, h)));
  })?.properties.nombre;
}
