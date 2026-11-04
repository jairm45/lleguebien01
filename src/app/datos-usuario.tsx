import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
    Alert,
    SafeAreaView,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { supabase } from "../services/supabase";
import { styles } from "../styles/DatosUsuarioStyles";

export default function DatosUsuario() {
  const [pais, setPais] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [universidad, setUniversidad] = useState("");
  const [direccion, setDireccion] = useState("");
  const [cargando, setCargando] = useState(false);

  const guardarDatos = async () => {
    if (!pais || !ciudad || !universidad) {
      return Alert.alert(
        "Error",
        "Por favor completa los campos obligatorios.",
      );
    }

    setCargando(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setCargando(false);
      return Alert.alert("Error", "No hay sesión activa");
    }

    const { error } = await supabase.from("perfiles").upsert({
      id: user.id,
      email: user.email,
      pais: pais,
      ciudad: ciudad,
      universidad: universidad,
      direccion: direccion,
    });

    setCargando(false);

    if (error) {
      Alert.alert("Error guardando datos", error.message);
    } else {
      Alert.alert("¡Éxito!", "Tus datos han sido guardados.");
      router.replace("/estudiante/permisos"); // 👈 Redirige a la pantalla de permisos
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Ubicación y estudios</Text>
          <Text style={styles.headerSubtitle}>
            Último paso antes de empezar.
          </Text>
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>Paso 2 de 2</Text>
            <View style={styles.progressBarBackground}>
              <View style={styles.progressBarFill} />
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.label}>País</Text>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons
              name="earth"
              size={20}
              color="#73799D"
              style={styles.icon}
            />
            <TextInput
              style={styles.input}
              placeholder="Escribe aquí"
              placeholderTextColor="#999"
              value={pais}
              onChangeText={setPais}
            />
          </View>

          <Text style={styles.label}>Ciudad</Text>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons
              name="map-marker-outline"
              size={20}
              color="#73799D"
              style={styles.icon}
            />
            <TextInput
              style={styles.input}
              placeholder="Escribe aquí"
              placeholderTextColor="#999"
              value={ciudad}
              onChangeText={setCiudad}
            />
          </View>

          <Text style={styles.label}>Universidad</Text>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons
              name="school-outline"
              size={20}
              color="#73799D"
              style={styles.icon}
            />
            <TextInput
              style={styles.input}
              placeholder="Escribe aquí"
              placeholderTextColor="#999"
              value={universidad}
              onChangeText={setUniversidad}
            />
          </View>

          <Text style={styles.label}>Dirección</Text>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons
              name="home-outline"
              size={20}
              color="#73799D"
              style={styles.icon}
            />
            <TextInput
              style={styles.input}
              placeholder="Escribe aquí"
              placeholderTextColor="#999"
              value={direccion}
              onChangeText={setDireccion}
            />
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={guardarDatos}
          disabled={cargando}
        >
          <MaterialCommunityIcons
            name="account-check-outline"
            size={20}
            color="#FFF"
          />
          <Text style={styles.saveButtonText}>
            {cargando ? "Guardando..." : "Guardar y continuar"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
