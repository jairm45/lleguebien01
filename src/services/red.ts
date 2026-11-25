import { SUPABASE_URL } from "./supabase";

const TIMEOUT_MS = 3500;

async function consultarUrl(
  url: string,
  esRespuestaValida: (respuesta: Response) => boolean,
): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const respuesta = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    return esRespuestaValida(respuesta);
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Comprueba conectividad real sin depender de un módulo nativo.
 * Primero busca el 204 de Google (captive portals suelen devolver 200/302)
 * y después usa el health check de Supabase como respaldo.
 */
export async function hayConectividad(): Promise<boolean> {
  const google = await consultarUrl(
    "https://clients3.google.com/generate_204",
    (respuesta) => respuesta.status === 204,
  );

  if (google) return true;

  return consultarUrl(`${SUPABASE_URL}/auth/v1/health`, (respuesta) => {
    const contentType = respuesta.headers.get("content-type") ?? "";
    return respuesta.status < 500 && !contentType.includes("text/html");
  });
}
