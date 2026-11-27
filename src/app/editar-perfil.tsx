import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../services/supabase";
import { cabeceraEstudiante } from "../styles/CabeceraEstudianteStyles";
import { styles } from "../styles/EditarPerfilStyles";

export default function EditarPerfil() {
  const insets = useSafeAreaInsets();
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [pais, setPais] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [telefono, setTelefono] = useState("");
  const [universidad, setUniversidad] = useState("");
  const [direccion, setDireccion] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const cargarDatos = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: perfil } = await supabase
          .from("perfiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (perfil) {
          setNombreCompleto(perfil.nombre_completo || "");
          setPais(perfil.pais || "");
          setCiudad(perfil.ciudad || "");
          setTelefono(perfil.telefono || "");
          setUniversidad(perfil.universidad || "");
          setDireccion(perfil.direccion || "");
        }
      }
      setCargando(false);
    };
    cargarDatos();
  }, []);

  const guardarCambios = async () => {
    if (!nombreCompleto) {
      return Alert.alert("Error", "El nombre no puede estar vacío.");
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return Alert.alert("Error", "No hay sesión activa");

    const { error } = await supabase
      .from("perfiles")
      .update({
        nombre_completo: nombreCompleto,
        pais: pais,
        ciudad: ciudad,
        telefono: telefono,
        universidad: universidad,
        direccion: direccion,
      })
      .eq("id", user.id);

    if (error) {
      Alert.alert("Error", error.message);
    } else {
      Alert.alert("¡Éxito!", "Tus datos se actualizaron correctamente.");
      router.back(); // Volver a la pantalla de perfil
    }
  };

  if (cargando) {
    return (
      <View
        style={[
          cabeceraEstudiante.fondo,
          { flex: 1, justifyContent: "center", alignItems: "center" },
        ]}
      >
        <StatusBar style="light" />
        <Text style={{ color: "#FFF" }}>Cargando datos...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />
      <View style={[cabeceraEstudiante.fondo, { height: insets.top }]} />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Editar perfil</Text>
          <Text style={styles.headerSubtitle}>
            Actualiza tus datos personales.
          </Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.label}>Nombre completo</Text>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons
              name="account-outline"
              size={20}
              color="#1A1E3C"
              style={styles.icon}
            />
            <TextInput
              style={styles.input}
              accessibilityLabel="Nombre completo"
              value={nombreCompleto}
              onChangeText={setNombreCompleto}
            />
          </View>

          <Text style={styles.label}>País</Text>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons
              name="earth"
              size={20}
              color="#1A1E3C"
              style={styles.icon}
            />
            <TextInput
              style={styles.input}
              accessibilityLabel="País"
              value={pais}
              onChangeText={setPais}
            />
          </View>

          <Text style={styles.label}>Ciudad</Text>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons
              name="map-marker-outline"
              size={20}
              color="#1A1E3C"
              style={styles.icon}
            />
            <TextInput
              style={styles.input}
              accessibilityLabel="Ciudad"
              value={ciudad}
              onChangeText={setCiudad}
            />
          </View>

          <Text style={styles.label}>Teléfono</Text>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons
              name="phone-outline"
              size={20}
              color="#1A1E3C"
              style={styles.icon}
            />
            <TextInput
              style={styles.input}
              accessibilityLabel="Teléfono"
              value={telefono}
              onChangeText={setTelefono}
              keyboardType="phone-pad"
            />
          </View>

          <Text style={styles.label}>Universidad</Text>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons
              name="school-outline"
              size={20}
              color="#1A1E3C"
              style={styles.icon}
            />
            <TextInput
              style={styles.input}
              accessibilityLabel="Universidad"
              value={universidad}
              onChangeText={setUniversidad}
            />
          </View>

          <Text style={styles.label}>Dirección</Text>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons
              name="home-outline"
              size={20}
              color="#1A1E3C"
              style={styles.icon}
            />
            <TextInput
              style={styles.input}
              accessibilityLabel="Dirección"
              value={direccion}
              onChangeText={setDireccion}
            />
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            style={styles.button}
            onPress={guardarCambios}
          >
            <MaterialCommunityIcons
              name="content-save-outline"
              size={20}
              color="#FFF"
            />
            <Text style={styles.buttonText}>Guardar cambios</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
