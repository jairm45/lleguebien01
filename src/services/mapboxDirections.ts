import type { Feature, LineString } from "geojson";

import type { Coordenada } from "../lib/recorrido";

const TIMEOUT_MS = 8000;
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";

export type RutaPeatonal = {
  feature: Feature<LineString>;
  distanciaMetros: number;
  duracionSegundos: number;
};

type RespuestaDirections = {
  code?: string;
  message?: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry?: LineString;
  }>;
};

export async function obtenerRutaPeatonal(
  origen: Coordenada,
  destino: Coordenada,
): Promise<RutaPeatonal | null> {
  if (!MAPBOX_TOKEN) {
    console.warn("[mapbox] Falta EXPO_PUBLIC_MAPBOX_TOKEN");
    return null;
  }

  const coordenadas = `${origen.longitude},${origen.latitude};${destino.longitude},${destino.latitude}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/walking/${coordenadas}` +
    `?geometries=geojson&overview=full&language=es&access_token=${encodeURIComponent(MAPBOX_TOKEN)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const respuesta = await fetch(url, { signal: controller.signal });

    if (!respuesta.ok) {
      console.warn(`[mapbox] Directions respondió HTTP ${respuesta.status}`);
      return null;
    }

    const data = (await respuesta.json()) as RespuestaDirections;

    if (data.code !== "Ok" || !data.routes?.length) {
      console.warn(
        "[mapbox] Directions no devolvió una ruta:",
        data.message ?? data.code,
      );
      return null;
    }

    const ruta = data.routes[0];

    if (!ruta.geometry) return null;

    return {
      feature: {
        type: "Feature",
        geometry: ruta.geometry,
        properties: {
          distanciaMetros: ruta.distance,
          duracionSegundos: ruta.duration,
        },
      },
      distanciaMetros: ruta.distance,
      duracionSegundos: ruta.duration,
    };
  } catch (error) {
    console.warn("[mapbox] No se pudo calcular la ruta peatonal", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
