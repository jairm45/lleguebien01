import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
} from "geojson";

import { supabase } from "./supabase";

export type PropiedadesZona = {
  id: string;
  nombre: string;
  nivel: string;
};

export type ZonasRiesgo = FeatureCollection<Geometry, PropiedadesZona>;

type FilaZona = {
  id: string;
  nombre: string;
  geojson: unknown;
  nivel: string;
};

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null;
}

function normalizarZona(
  fila: FilaZona,
): Feature<Geometry, PropiedadesZona>[] {
  let geojson = fila.geojson;

  if (typeof geojson === "string") {
    try {
      geojson = JSON.parse(geojson) as unknown;
    } catch {
      return [];
    }
  }

  if (!esObjeto(geojson) || typeof geojson.type !== "string") {
    return [];
  }

  const propiedades: PropiedadesZona = {
    id: fila.id,
    nombre: fila.nombre,
    nivel: fila.nivel,
  };

  if (geojson.type === "FeatureCollection" && Array.isArray(geojson.features)) {
    return geojson.features.filter(esObjeto).flatMap((item) => {
      const feature = item as unknown as Feature<Geometry, GeoJsonProperties>;

      if (!feature.geometry) return [];

      return [
        {
          ...feature,
          properties: { ...(feature.properties ?? {}), ...propiedades },
        },
      ];
    });
  }

  if (geojson.type === "Feature") {
    const feature = geojson as unknown as Feature<Geometry, GeoJsonProperties>;

    if (!feature.geometry) return [];

    return [
      {
        ...feature,
        properties: { ...(feature.properties ?? {}), ...propiedades },
      },
    ];
  }

  return [
    {
      type: "Feature",
      geometry: geojson as unknown as Geometry,
      properties: propiedades,
    },
  ];
}

export async function obtenerZonasRiesgo(): Promise<ZonasRiesgo> {
  const { data, error } = await supabase
    .from("zonas_riesgo")
    .select("id, nombre, geojson, nivel")
    .eq("activo", true)
    .order("nombre", { ascending: true });

  if (error) {
    throw new Error(
      `No se pudieron cargar las zonas de riesgo: ${error.message}`,
    );
  }

  const filas = (data ?? []) as FilaZona[];

  return {
    type: "FeatureCollection",
    features: filas.flatMap(normalizarZona),
  };
}
