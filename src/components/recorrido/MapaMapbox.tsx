import { StyleSheet, Text, View } from "react-native";

import type { MapaMapboxProps } from "./MapaMapbox.types";

/**
 * Fallback para web. El mapa nativo de Mapbox se resuelve en
 * MapaMapbox.native.tsx en iOS/Android.
 */
export function MapaMapbox(_props: MapaMapboxProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        El mapa del recorrido está disponible en iOS y Android.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
