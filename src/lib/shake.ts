export type MuestraAceleracion = {
  x: number;
  y: number;
  z: number;
};

type Eje = "x" | "y" | "z";

type Pico = {
  eje: Eje;
  signo: number;
  tiempo: number;
};

type OpcionesDetector = {
  sacudidasNecesarias?: number;
  ventanaMs?: number;
  umbral?: number;
  intervaloMinimoMs?: number;
};

export function crearDetectorSacudidas({
  sacudidasNecesarias = 4,
  ventanaMs = 2500,
  umbral = 1.15,
  intervaloMinimoMs = 120,
}: OpcionesDetector = {}) {
  let gravedad = { x: 0, y: 0, z: 0 };
  let picos: Pico[] = [];
  let ultimoPicoEn = 0;

  const reiniciar = () => {
    picos = [];
    ultimoPicoEn = 0;
  };

  const agregarMuestra = (
    muestra: MuestraAceleracion,
    ahora = Date.now(),
  ): boolean => {
    // Filtro paso alto: la gravedad se estima con un promedio lento.
    gravedad = {
      x: gravedad.x * 0.85 + muestra.x * 0.15,
      y: gravedad.y * 0.85 + muestra.y * 0.15,
      z: gravedad.z * 0.85 + muestra.z * 0.15,
    };

    const lineal = {
      x: muestra.x - gravedad.x,
      y: muestra.y - gravedad.y,
      z: muestra.z - gravedad.z,
    };

    const magnitud = Math.sqrt(
      lineal.x * lineal.x + lineal.y * lineal.y + lineal.z * lineal.z,
    );

    if (magnitud < umbral) return false;
    if (ahora - ultimoPicoEn < intervaloMinimoMs) return false;

    const valores: Array<{ eje: Eje; valor: number }> = [
      { eje: "x", valor: lineal.x },
      { eje: "y", valor: lineal.y },
      { eje: "z", valor: lineal.z },
    ];

    const dominante = valores.reduce((mayor, actual) =>
      Math.abs(actual.valor) > Math.abs(mayor.valor) ? actual : mayor,
    );

    const signo = dominante.valor >= 0 ? 1 : -1;
    const anterior = picos[picos.length - 1];

    // Un bache o caminar suele repetir el mismo eje y sentido.
    // Una sacudida intencional invierte el sentido o cambia de eje.
    if (anterior && anterior.eje === dominante.eje && anterior.signo === signo) {
      return false;
    }

    ultimoPicoEn = ahora;
    picos.push({ eje: dominante.eje, signo, tiempo: ahora });
    picos = picos.filter((pico) => ahora - pico.tiempo <= ventanaMs);

    if (picos.length >= sacudidasNecesarias) {
      reiniciar();
      return true;
    }

    return false;
  };

  return { agregarMuestra, reiniciar };
}
