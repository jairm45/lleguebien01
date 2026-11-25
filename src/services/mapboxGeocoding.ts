const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";
const TIMEOUT_MS = 8000;
const BUENAVENTURA = { lat: 3.8801, lng: -77.0197 };

export type LugarMapbox = {
  id: string;
  nombre: string;
  direccion: string;
  lat: number;
  lng: number;
};

type FeatureGeocoding = {
  id?: string;
  text?: string;
  place_name?: string;
  address?: string;
  center?: [number, number];
};

type RespuestaGeocoding = {
  features?: FeatureGeocoding[];
};

async function consultarMapbox(url: string): Promise<RespuestaGeocoding | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const respuesta = await fetch(url, { signal: controller.signal });

    if (!respuesta.ok) {
      console.warn(`[mapbox-geocoding] HTTP ${respuesta.status}`);
      return null;
    }

    return (await respuesta.json()) as RespuestaGeocoding;
  } catch (error) {
    console.warn("[mapbox-geocoding] Error de red", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function buscarLugaresMapbox(
  query: string,
  proximidad?: { lat: number; lng: number },
): Promise<LugarMapbox[]> {
  const texto = query.trim();

  if (!texto || !MAPBOX_TOKEN) return [];

  const punto = proximidad ?? BUENAVENTURA;
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(texto)}.json` +
    `?country=CO&language=es&limit=5&autocomplete=true` +
    `&types=address,poi,place,locality,neighborhood` +
    `&proximity=${punto.lng},${punto.lat}` +
    `&access_token=${encodeURIComponent(MAPBOX_TOKEN)}`;

  const data = await consultarMapbox(url);

  if (!data?.features?.length) return [];

  return data.features.flatMap((feature) => {
    const center = feature.center;

    if (
      !center ||
      typeof center[0] !== "number" ||
      typeof center[1] !== "number"
    ) {
      return [];
    }

    const direccion = feature.place_name ?? feature.address ?? "";
    const nombre = feature.text ?? direccion;

    return [
      {
        id: feature.id ?? `${center[0]},${center[1]}`,
        nombre: nombre || "Lugar",
        direccion,
        lat: center[1],
        lng: center[0],
      },
    ];
  });
}

export async function obtenerDireccionDesdeCoordenadas(
  lat: number,
  lng: number,
): Promise<string | null> {
  if (!MAPBOX_TOKEN) return null;

  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
    `?language=es&limit=1&types=address,poi,place,locality,neighborhood` +
    `&access_token=${encodeURIComponent(MAPBOX_TOKEN)}`;

  const data = await consultarMapbox(url);
  const feature = data?.features?.[0];

  return feature?.place_name ?? feature?.address ?? null;
}
