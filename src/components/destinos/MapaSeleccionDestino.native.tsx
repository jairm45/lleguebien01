import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Mapbox, {
  Camera,
  MapView,
  PointAnnotation,
  UserLocation,
} from "@rnmapbox/maps";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { MapaSeleccionDestinoProps } from "./MapaSeleccionDestino.types";

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";

void Mapbox.setAccessToken(MAPBOX_TOKEN || null);

export function MapaSeleccionDestino({
  centroInicial,
  centroSolicitado,
  marcador,
  paddingInferior,
  onPressMapa,
  onDragEnd,
}: MapaSeleccionDestinoProps) {
  const centerCoordinate = useMemo<[number, number] | undefined>(() => {
    if (!centroSolicitado) return undefined;

    return [centroSolicitado.longitude, centroSolicitado.latitude];
  }, [centroSolicitado]);

  if (!MAPBOX_TOKEN) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>
          Falta configurar EXPO_PUBLIC_MAPBOX_TOKEN para mostrar el mapa.
        </Text>
      </View>
    );
  }

  return (
    <MapView
      style={StyleSheet.absoluteFill}
      styleURL={Mapbox.StyleURL.Street}
      localizeLabels={{ locale: "es" }}
      scaleBarEnabled={false}
      logoPosition={{ top: 110, left: 12 }}
      attributionPosition={{ top: 110, right: 12 }}
      onPress={(feature) => {
        const [longitude, latitude] = feature.geometry.coordinates;

        if (typeof latitude === "number" && typeof longitude === "number") {
          onPressMapa({ latitude, longitude });
        }
      }}
    >
      <Camera
        defaultSettings={{
          centerCoordinate: [centroInicial.longitude, centroInicial.latitude],
          zoomLevel: 15,
        }}
        centerCoordinate={centerCoordinate}
        padding={{ paddingBottom: paddingInferior }}
        animationDuration={700}
      />

      <UserLocation
        visible
        showsUserHeadingIndicator
        androidRenderMode="compass"
        minDisplacement={3}
      />

      <PointAnnotation
        id="destino-seleccionado"
        coordinate={[marcador.longitude, marcador.latitude]}
        anchor={{ x: 0.5, y: 1 }}
        draggable
        onDragEnd={(feature) => {
          const [longitude, latitude] = feature.geometry.coordinates;

          if (typeof latitude === "number" && typeof longitude === "number") {
            onDragEnd({ latitude, longitude });
          }
        }}
      >
        <View style={styles.marker} collapsable={false}>
          <MaterialCommunityIcons
            name="map-marker"
            size={44}
            color="#E5484D"
          />
        </View>
      </PointAnnotation>
    </MapView>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1A1E3C",
    padding: 24,
  },
  fallbackText: {
    color: "#FFFFFF",
    fontSize: 14,
    textAlign: "center",
  },
  marker: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
