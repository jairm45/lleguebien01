import type { Feature, FeatureCollection, Geometry, LineString } from "geojson";

import type { Coordenada, PosicionRecorrido } from "../../lib/recorrido";

export type MapaMapboxProps = {
  zonas: FeatureCollection<Geometry>;
  rastro: number[][];
  ruta: Feature<LineString> | null;
  destino: (Coordenada & { nombre: string }) | null;
  vistaFamiliar?: "seguimiento" | "emergencia";
  encuadre?: number;
  pulsar?: boolean;
  centroInicial: Coordenada;
  ubicacionActual: PosicionRecorrido | null;
  red: boolean;
  seguirUsuario: boolean;
  onMoverMapa: () => void;
};
