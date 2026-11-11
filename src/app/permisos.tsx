import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { styles } from "../styles/PermisosStyles";

export default function PermisosScreen() {
  const [ubicacion, setUbicacion] = useState(true);
  const [notificaciones, setNotificaciones] = useState(true);
  const [movimiento, setMovimiento] = useState(true);

  const pedirPermisos = async () => {
    // 1. Pedir permiso de Ubicación
    if (ubicacion) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permiso denegado",
          "No podremos compartir tu ubicación si no lo permites.",
        );
      }
    }

    // 2. Pedir permiso de Notificaciones
    if (notificaciones) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permiso denegado",
          "No podremos enviarte alertas si no lo permites.",
        );
      }
    }

    // 3. Continuar al recorrido
    router.replace("/recorrido");
  };

  const omitir = () => {
    router.replace("/recorrido");
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Permisos necesarios</Text>
          <Text style={styles.headerSubtitle}>
            Para protegerte necesitamos tu autorización.
          </Text>
        </View>

        <View style={styles.body}>
          <View style={styles.card}>
            <View
              style={[styles.iconContainer, { backgroundColor: "#E8F8F5" }]}
            >
              <MaterialCommunityIcons
                name="map-marker"
                size={24}
                color="#1ABC9C"
              />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Ubicación</Text>
              <Text style={styles.cardDescription}>
                Para compartir dónde estás si pides ayuda.
              </Text>
            </View>
            <Switch
              trackColor={{ false: "#D9DDEF", true: "#1ABC9C" }}
              thumbColor="#FFF"
              onValueChange={setUbicacion}
              value={ubicacion}
            />
          </View>

          <View style={styles.card}>
            <View
              style={[styles.iconContainer, { backgroundColor: "#FFE5E5" }]}
            >
              <MaterialCommunityIcons name="bell" size={24} color="#E5484D" />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Notificaciones</Text>
              <Text style={styles.cardDescription}>
                Para avisar a tu contacto y recibir alertas.
              </Text>
            </View>
            <Switch
              trackColor={{ false: "#D9DDEF", true: "#1ABC9C" }}
              thumbColor="#FFF"
              onValueChange={setNotificaciones}
              value={notificaciones}
            />
          </View>

          <View style={styles.card}>
            <View
              style={[styles.iconContainer, { backgroundColor: "#FFF3DF" }]}
            >
              <MaterialCommunityIcons name="run" size={24} color="#F5A623" />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Movimiento</Text>
              <Text style={styles.cardDescription}>
                Para detectar cuando agitas el teléfono.
              </Text>
            </View>
            <Switch
              trackColor={{ false: "#D9DDEF", true: "#1ABC9C" }}
              thumbColor="#FFF"
              onValueChange={setMovimiento}
              value={movimiento}
            />
          </View>

          <View style={styles.privacyNote}>
            <MaterialCommunityIcons
              name="shield-check-outline"
              size={20}
              color="#1ABC9C"
            />
            <Text style={styles.privacyText}>
              Usamos tu ubicación solo durante una emergencia o un recorrido.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.button} onPress={pedirPermisos}>
          <MaterialCommunityIcons name="check" size={20} color="#FFF" />
          <Text style={styles.buttonText}>Permitir todo</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={omitir}>
          <Text style={styles.skipText}>Ahora no</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
