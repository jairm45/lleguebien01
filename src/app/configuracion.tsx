import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { supabase } from "../services/supabase";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "../styles/ConfiguracionStyles";

export default function ConfiguracionScreen() {
  const insets = useSafeAreaInsets();
  const [sacudidas, setSacudidas] = useState(4);
  const [tiempoCancelacion, setTiempoCancelacion] = useState(8);
  const [contactoNombre, setContactoNombre] = useState("");
  const [contactoTelefono, setContactoTelefono] = useState("");
  const [contactoEmail, setContactoEmail] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const cargarConfig = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("configuracion_sensores")
          .select("*")
          .eq("id_usuario", user.id)
          .single();

        if (data) {
          setSacudidas(data.sacudidas_necesarias);
          setTiempoCancelacion(data.tiempo_cancelacion);
          setContactoNombre(data.contacto_nombre || "");
          setContactoTelefono(data.contacto_telefono || "");
          setContactoEmail(data.contacto_email || "");
        }
      }
      setCargando(false);
    };
    cargarConfig();
  }, []);

  const guardarConfig = async () => {
    if (!contactoNombre || !contactoTelefono || !contactoEmail) {
      return Alert.alert(
        "Error",
        "Por favor completa todos los datos del contacto de emergencia.",
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return Alert.alert("Error", "No hay sesión activa");

    const { error } = await supabase.from("configuracion_sensores").upsert({
      id_usuario: user.id,
      sacudidas_necesarias: sacudidas,
      tiempo_cancelacion: tiempoCancelacion,
      contacto_nombre: contactoNombre,
      contacto_telefono: contactoTelefono,
      contacto_email: contactoEmail,
    });

    if (error) Alert.alert("Error", error.message);
    else {
      Alert.alert("¡Guardado!", "Tu configuración se ha actualizado.");
      router.back();
    }
  };

  if (cargando) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#1A1E3C",
        }}
      >
        <Text style={{ color: "#FFF" }}>Cargando configuración...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />
      {/* 👇 KeyboardAvoidingView para que el teclado no tape los campos */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
            <Text style={styles.headerTitle}>Configuración</Text>
            <Text style={styles.headerSubtitle}>
              Ajusta cómo funciona la alerta de emergencia.
            </Text>
          </View>

          <View style={styles.body}>
            {/* Sacudidas necesarias */}
            <Text style={styles.sectionTitle}>
              Sacudidas para activar la alerta
            </Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.label}>Número de sacudidas</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity
                    style={styles.stepButton}
                    onPress={() => setSacudidas(Math.max(1, sacudidas - 1))}
                  >
                    <Text style={styles.stepButtonText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.value}>{sacudidas}</Text>
                  <TouchableOpacity
                    style={styles.stepButton}
                    onPress={() => setSacudidas(sacudidas + 1)}
                  >
                    <Text style={styles.stepButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Tiempo de cancelación */}
            <Text style={styles.sectionTitle}>
              Tiempo para cancelar la alerta
            </Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.label}>Segundos de espera</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity
                    style={styles.stepButton}
                    onPress={() =>
                      setTiempoCancelacion(Math.max(3, tiempoCancelacion - 1))
                    }
                  >
                    <Text style={styles.stepButtonText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.value}>{tiempoCancelacion}</Text>
                  <TouchableOpacity
                    style={styles.stepButton}
                    onPress={() => setTiempoCancelacion(tiempoCancelacion + 1)}
                  >
                    <Text style={styles.stepButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Contacto de emergencia */}
            <Text style={styles.sectionTitle}>Contacto de emergencia</Text>
            <View style={styles.card}>
              <Text style={styles.label}>Nombre</Text>
              <View style={styles.inputContainer}>
                <MaterialCommunityIcons
                  name="account-outline"
                  size={20}
                  color="#73799D"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Nombre del contacto"
                  value={contactoNombre}
                  onChangeText={setContactoNombre}
                />
              </View>

              <Text style={[styles.label, { marginTop: 15 }]}>Teléfono</Text>
              <View style={styles.inputContainer}>
                <MaterialCommunityIcons
                  name="phone-outline"
                  size={20}
                  color="#73799D"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Número de teléfono"
                  keyboardType="phone-pad"
                  value={contactoTelefono}
                  onChangeText={setContactoTelefono}
                />
              </View>

              <Text style={[styles.label, { marginTop: 15 }]}>
                Correo electrónico
              </Text>
              <View style={styles.inputContainer}>
                <MaterialCommunityIcons
                  name="email-outline"
                  size={20}
                  color="#73799D"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Correo del contacto"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={contactoEmail}
                  onChangeText={setContactoEmail}
                />
              </View>
            </View>

            <TouchableOpacity style={styles.button} onPress={guardarConfig}>
              <MaterialCommunityIcons
                name="content-save-outline"
                size={20}
                color="#FFF"
              />
              <Text style={styles.buttonText}>Guardar configuración</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
