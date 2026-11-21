import type { Feature, FeatureCollection, Geometry, LineString } from "geojson";

import type { Coordenada } from "../../lib/recorrido";

export type MapaMapboxProps = {
  zonas: FeatureCollection<Geometry>;
  ruta: Feature<LineString> | null;
  destino: Coordenada & { nombre: string };
  centroInicial: Coordenada;
  seguirUsuario?: boolean;
};
