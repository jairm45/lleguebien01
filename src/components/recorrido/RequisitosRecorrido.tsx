import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { styles } from "../../styles/RequisitosStyles";

type Variante = "bloqueo" | "card" | "banner";

type Props = {
  faltantes: string[];
  variante?: Variante;
  titulo?: string;
  verificando?: boolean;
  puedeSolicitarPermiso?: boolean;
  onReintentar: () => void;
  onAbrirAjustes: () => void;
  onSolicitarPermiso?: () => void;
};

export function RequisitosRecorrido({
  faltantes,
  variante = "card",
  titulo,
  verificando = false,
  puedeSolicitarPermiso = false,
  onReintentar,
  onAbrirAjustes,
  onSolicitarPermiso,
}: Props) {
  if (faltantes.length === 0) return null;

  const esBanner = variante === "banner";
  const esBloqueo = variante === "bloqueo";
  const tituloVisible =
    titulo ?? (variante === "card" ? "Antes de salir" : "No puedes iniciar el recorrido");

  return (
    <View
      style={[
        styles.base,
        esBanner ? styles.banner : esBloqueo ? styles.bloqueo : styles.panel,
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.icono, esBanner && styles.iconoBanner]}>
          <MaterialCommunityIcons
            name="map-marker-alert-outline"
            size={esBanner ? 20 : 28}
            color="#E5484D"
          />
        </View>

        <View style={styles.textos}>
          {!esBanner ? (
            <Text style={[styles.titulo, esBloqueo && styles.tituloBloqueo]}>
              {tituloVisible}
            </Text>
          ) : null}

          {faltantes.map((mensaje) => (
            <Text
              key={mensaje}
              style={[
                styles.mensaje,
                esBloqueo && styles.mensajeBloqueo,
                esBanner && styles.mensajeBanner,
              ]}
            >
              {mensaje}
            </Text>
          ))}
        </View>
      </View>

      <View style={[styles.acciones, esBanner && styles.accionesBanner]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reintentar verificación"
          disabled={verificando}
          onPress={onReintentar}
          style={({ pressed }) => [
            styles.botonPrimario,
            pressed && styles.pressed,
          ]}
        >
          {verificando ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.botonTexto}>Reintentar</Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir ajustes del sistema"
          onPress={onAbrirAjustes}
          style={({ pressed }) => [
            styles.botonSecundario,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.botonTextoSecundario}>Abrir ajustes</Text>
        </Pressable>

        {puedeSolicitarPermiso && onSolicitarPermiso ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Permitir ubicación"
            onPress={onSolicitarPermiso}
            style={({ pressed }) => [
              styles.botonSecundario,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.botonTextoSecundario}>
              Permitir ubicación
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
