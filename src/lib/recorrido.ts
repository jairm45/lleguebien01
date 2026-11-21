export type Coordenada = {
  latitude: number;
  longitude: number;
};

export const DESTINO_PRUEBA = {
  nombre: "Universidad del Pacífico",
  latitude: 3.8445,
  longitude: -76.9932,
} as const;

export const CENTRO_BUENAVENTURA: Coordenada = {
  latitude: 3.8801,
  longitude: -77.0312,
};

const RADIO_TIERRA_METROS = 6371000;
const VELOCIDAD_CAMINATA_MPS = 1.35; // ~4.8 km/h

export function conTimeout<T>(
  promesa: Promise<T>,
  milisegundos: number,
  mensaje = "La operación tardó demasiado.",
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(mensaje)), milisegundos);

    promesa.then(
      (valor) => {
        clearTimeout(timeout);
        resolve(valor);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

export function distanciaHaversineMetros(
  origen: Coordenada,
  destino: Coordenada,
): number {
  const aRadianes = (grados: number) => (grados * Math.PI) / 180;
  const deltaLat = aRadianes(destino.latitude - origen.latitude);
  const deltaLng = aRadianes(destino.longitude - origen.longitude);
  const latOrigen = aRadianes(origen.latitude);
  const latDestino = aRadianes(destino.latitude);

  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(latOrigen) *
      Math.cos(latDestino) *
      Math.sin(deltaLng / 2) ** 2;

  return 2 * RADIO_TIERRA_METROS * Math.asin(Math.sqrt(h));
}

export function estimarDuracionSegundos(distanciaMetros: number): number {
  return Math.max(60, Math.round(distanciaMetros / VELOCIDAD_CAMINATA_MPS));
}

export function formatearDistancia(metros: number): string {
  if (!Number.isFinite(metros) || metros < 0) return "—";
  if (metros < 1000) return `${Math.round(metros)} m`;
  return `${(metros / 1000).toFixed(1).replace(".", ",")} km`;
}

export function formatearDuracion(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos <= 0) return "—";
  const minutos = Math.max(1, Math.round(segundos / 60));
  return `${minutos} min`;
}
