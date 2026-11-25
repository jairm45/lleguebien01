import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Mapbox, {
  Camera,
  FillLayer,
  LineLayer,
  MapView,
  PointAnnotation,
  ShapeSource,
  UserLocation,
} from "@rnmapbox/maps";
import { StyleSheet, Text, View } from "react-native";

import { styles } from "../../styles/RecorridoStyles";
import type { MapaMapboxProps } from "./MapaMapbox.types";

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";

void Mapbox.setAccessToken(MAPBOX_TOKEN || null);

export function MapaMapbox({
  zonas,
  ruta,
  destino,
  centroInicial,
  seguirUsuario = true,
}: MapaMapboxProps) {
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
      styleURL={Mapbox.StyleURL.Street}
      localizeLabels={{ locale: "es" }}
      logoPosition={{ bottom: 190, left: 12 }}
      attributionPosition={{ bottom: 190, right: 12 }}
    >
      <Camera
        defaultSettings={{
          centerCoordinate: [centroInicial.longitude, centroInicial.latitude],
          zoomLevel: 14,
        }}
        followUserLocation={seguirUsuario}
        followZoomLevel={16}
        animationDuration={800}
      />

      <UserLocation
        visible
        showsUserHeadingIndicator
        androidRenderMode="compass"
        minDisplacement={3}
      />

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
