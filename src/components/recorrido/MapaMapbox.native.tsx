import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Mapbox, {
  Camera,
  FillLayer,
  LineLayer,
  MapView,
  PointAnnotation,
  ShapeSource,
  CircleLayer,
} from "@rnmapbox/maps";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { styles } from "../../styles/RecorridoStyles";
import type { MapaMapboxProps } from "./MapaMapbox.types";

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";

// Permite dibujar el GPS y el destino aunque Mapbox no tenga el estilo en caché.
const ESTILO_LOCAL = JSON.stringify({
  version: 8, sources: {},
  layers: [{ id: "fondo", type: "background", paint: { "background-color": "#E8EFEF" } }],
});

void Mapbox.setAccessToken(MAPBOX_TOKEN || null);

export function MapaMapbox({
  zonas,
  ruta,
  rastro,
  destino,
  centroInicial,
  red,
  seguirUsuario,
  ubicacionActual,
  onMoverMapa,
}: MapaMapboxProps) {
  const camara = useRef<Camera>(null);
  const inicial = useRef({ centerCoordinate: [centroInicial.longitude, centroInicial.latitude], zoomLevel: 16 });
  const [listo, setListo] = useState(false);
  const [estiloLocal, setEstiloLocal] = useState(false);
  useEffect(() => {
    if (red) setEstiloLocal(false);
  }, [red]);

  useEffect(() => {
    if (!listo || !seguirUsuario || !ubicacionActual) return;
    camara.current?.setCamera({
      centerCoordinate: [ubicacionActual.longitude, ubicacionActual.latitude],
      animationMode: "easeTo", animationDuration: 650,
    });
  }, [listo, seguirUsuario, ubicacionActual]);

  if (!MAPBOX_TOKEN) {
    return (
      <View style={fallback.container}>
        <Text style={fallback.text}>
          Falta configurar EXPO_PUBLIC_MAPBOX_TOKEN para mostrar el mapa.
        </Text>
      </View>
    );
  }

  return (
    <MapView
      style={styles.map}
      onDidFinishLoadingStyle={() => setListo(true)}
      onCameraChanged={evento => { if (seguirUsuario && evento.gestures.isGestureActive) onMoverMapa(); }}
      onMapLoadingError={evento => {
        if (evento?.type === "style") setEstiloLocal(true);
      }}
      styleURL={estiloLocal ? undefined : Mapbox.StyleURL.Street}
      styleJSON={estiloLocal ? ESTILO_LOCAL : undefined}
      localizeLabels={{ locale: "es" }}
      logoPosition={{ bottom: 190, left: 12 }}
      attributionPosition={{ bottom: 190, right: 12 }}
    >
      <Camera ref={camara} defaultSettings={inicial.current} />

      {zonas.features.length > 0 ? (
        <ShapeSource id="zonas-riesgo" shape={zonas}>
          <FillLayer
            id="zonas-riesgo-fill"
            style={{
              fillColor: "#E5484D",
              fillOpacity: 0.18,
            }}
          />
          <LineLayer
            id="zonas-riesgo-line"
            style={{
              lineColor: "#E5484D",
              lineWidth: 1.5,
            }}
          />
        </ShapeSource>
      ) : null}

      {ruta ? (
        <ShapeSource id="ruta-peatonal" shape={ruta}>
          <LineLayer
            id="ruta-peatonal-line"
            style={{
              lineColor: "#F5A623",
              lineWidth: 5,
            }}
          />
        </ShapeSource>
      ) : null}

      {rastro.length >= 2 && (
        <ShapeSource id="rastro-local" shape={{ type: "LineString", coordinates: rastro }}>
          <LineLayer id="linea-rastro" style={{ lineColor: "#087E74", lineWidth: 3 }} />
        </ShapeSource>
      )}

      {ubicacionActual && (
        <ShapeSource id="estudiante" shape={{ type: "Point", coordinates: [ubicacionActual.longitude, ubicacionActual.latitude] }}>
          <CircleLayer id="precision-estudiante" style={{
            circleColor: "#1ABC9C", circleOpacity: 0.22,
            // Metros por píxel en Mercator para teselas de 512 px.
            circleRadius: ["interpolate", ["exponential", 2], ["zoom"], 0, 0,
              20, (ubicacionActual.precisionM ?? 0) * 1048576 /
                (78271.52 * Math.cos(ubicacionActual.latitude * Math.PI / 180))],
          }} />
          <CircleLayer id="punto-estudiante" style={{
            circleRadius: 7, circleColor: "#087E74", circleStrokeColor: "#FFFFFF", circleStrokeWidth: 2,
          }} />
        </ShapeSource>
      )}

      <PointAnnotation
        id="destino-universidad"
        coordinate={[destino.longitude, destino.latitude]}
        anchor={{ x: 0.5, y: 0.5 }}
      >
        <View style={styles.marker}>
          <MaterialCommunityIcons name="school" size={20} color="#FFFFFF" />
        </View>
      </PointAnnotation>
    </MapView>
  );
}

const fallback = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1A1E3C",
    padding: 24,
  },
  text: {
    color: "#FFFFFF",
    fontSize: 14,
    textAlign: "center",
  },
});
