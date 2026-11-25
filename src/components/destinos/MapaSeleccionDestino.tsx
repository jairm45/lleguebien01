import { StyleSheet, Text, View } from "react-native";

import type { MapaSeleccionDestinoProps } from "./MapaSeleccionDestino.types";

/**
 * Fallback web. El mapa nativo se resuelve en
 * MapaSeleccionDestino.native.tsx en iOS/Android.
 */
export function MapaSeleccionDestino(_props: MapaSeleccionDestinoProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        El selector de mapa está disponible en iOS y Android.
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
