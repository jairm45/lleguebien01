import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../services/supabase";
import { olvidarRecorridoVerificado } from "../../services/recorridos";
import { eliminarTokenPush } from "../../services/notificacionesPush";
import {
  limpiarColaOffline,
  limpiarRecorridoActivoLocal,
} from "../../services/colaOffline";
import { cabeceraEstudiante } from "../../styles/CabeceraEstudianteStyles";
import { styles } from "../../styles/PerfilStyles";

export default function PerfilScreen() {
  const insets = useSafeAreaInsets();
  const [perfil, setPerfil] = useState<any>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const obtenerPerfil = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data, error } = await supabase
          .from("perfiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (error) {
          console.error(error);
          Alert.alert("Error", "No se pudo cargar el perfil.");
        } else {
          setPerfil(data);
        }
      }
      setCargando(false);
    };

    obtenerPerfil();
  }, []);

  const cerrarSesion = async () => {
    // Se elimina el token push mientras el JWT aún es válido.
    await eliminarTokenPush();
    await limpiarColaOffline();
    await limpiarRecorridoActivoLocal();
    await olvidarRecorridoVerificado();
    await supabase.auth.signOut();
    router.replace("/");
  };

  // Obtener la inicial del nombre para el avatar
  const inicial = perfil?.nombre_completo?.charAt(0).toUpperCase() || "U";
  const nombreCompleto = perfil?.nombre_completo || "Usuario";

  if (cargando) {
    return (
      <View
        style={[
          cabeceraEstudiante.fondo,
          { flex: 1, justifyContent: "center", alignItems: "center" },
        ]}
      >
        <StatusBar style="light" />
        <Text style={{ color: "#FFF" }}>Cargando perfil...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={[cabeceraEstudiante.fondo, { height: insets.top }]} />
      <ScrollView bounces={false}>
        <View style={styles.header}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{inicial}</Text>
          </View>
          <Text style={styles.name}>{nombreCompleto}</Text>
          <Text style={styles.role}>Estudiante · cuenta de Google</Text>
        </View>

        <View style={styles.body}>
          {/* País */}
          <View style={styles.infoCard}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="earth" size={20} color="#1A1E3C" />
            </View>
            <Text style={styles.infoLabel}>País</Text>
            <Text style={styles.infoValue}>
              {perfil?.pais || "No registrado"}
            </Text>
          </View>

          {/* Ciudad */}
          <View style={styles.infoCard}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons
                name="map-marker-outline"
                size={20}
                color="#1A1E3C"
              />
            </View>
            <Text style={styles.infoLabel}>Ciudad</Text>
            <Text style={styles.infoValue}>
              {perfil?.ciudad || "No registrado"}
            </Text>
          </View>

          {/* Teléfono */}
          <View style={styles.infoCard}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons
                name="phone-outline"
                size={20}
                color="#1A1E3C"
              />
            </View>
            <Text style={styles.infoLabel}>Teléfono</Text>
            <Text style={styles.infoValue}>
              {perfil?.telefono || "No registrado"}
            </Text>
          </View>

          {/* Universidad */}
          <View style={styles.infoCard}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons
                name="school-outline"
                size={20}
                color="#1A1E3C"
              />
            </View>
            <Text style={styles.infoLabel}>Universidad</Text>
            <Text style={styles.infoValue}>
              {perfil?.universidad || "No registrada"}
            </Text>
          </View>

          {/* Dirección */}
          <View style={styles.infoCard}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons
                name="home-outline"
                size={20}
                color="#1A1E3C"
              />
            </View>
            <Text style={styles.infoLabel}>Dirección</Text>
            <Text style={styles.infoValue}>
              {perfil?.direccion || "No registrado"}
            </Text>
          </View>

          {/* 👇 BOTÓN DE EDITAR DATOS */}
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.button}
            onPress={() => router.push("/editar-perfil")}
          >
            <MaterialCommunityIcons name="pencil-outline" size={20} color="#1A1E3C" />
            <Text style={styles.buttonText}>Editar perfil</Text>
          </TouchableOpacity>

          {/* Botón Cerrar Sesión */}
          <TouchableOpacity onPress={cerrarSesion}>
            <Text style={styles.logoutText}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
