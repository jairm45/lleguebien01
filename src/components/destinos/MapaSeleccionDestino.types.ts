import type { Coordenada } from "../../lib/recorrido";

export type MapaSeleccionDestinoProps = {
  centroInicial: Coordenada;
  centroSolicitado: Coordenada | null;
  marcador: Coordenada;
  paddingInferior: number;
  onPressMapa: (coordenada: Coordenada) => void;
  onDragEnd: (coordenada: Coordenada) => void;
};
