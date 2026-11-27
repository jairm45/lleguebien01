type Parametro = string | string[] | undefined;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function idUnico(valor: Parametro) {
  const id = Array.isArray(valor) ? (valor.length === 1 ? valor[0] : undefined) : valor;
  return id && uuid.test(id) ? id : undefined;
}

export function parametrosMapa(recorrido: Parametro, alerta: Parametro) {
  const recorridoId = idUnico(recorrido);
  const alertaId = idUnico(alerta);
  if (!recorridoId) return { error: "El enlace no contiene un identificador de recorrido válido." } as const;
  if (alerta !== undefined && !alertaId) return { error: "El identificador de la alerta no es válido." } as const;
  return { recorridoId, alertaId } as const;
}

export function destinoMapa(recorridoId: string, emergencia: boolean, alertaId?: string) {
  const pathname = emergencia ? "/seguidor/emergencia" : "/seguidor/seguimiento";
  return { pathname, params: { recorridoId, ...(alertaId !== undefined && { alertaId }) } } as const;
}

export function destinoPushSeguidor(datos: Record<string, unknown>, toqueNormal: boolean) {
  const esEmergencia = "alerta_id" in datos ||
    ["manual", "sacudida", "notificacion_rapida", "pasiva"].includes(String(datos.tipo));
  if (!toqueNormal || !esEmergencia) return null;
  const recorridoId = typeof datos.recorrido_id === "string" && idUnico(datos.recorrido_id);
  const alertaId = datos.alerta_id === undefined ? undefined :
    (typeof datos.alerta_id === "string" && idUnico(datos.alerta_id)) || "invalido";
  return destinoMapa(recorridoId || "invalido", true, alertaId);
}
