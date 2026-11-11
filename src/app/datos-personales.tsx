import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
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
import { styles } from "../styles/DatosPersonalesStyles";

export default function DatosPersonales() {
  const [identificacion, setIdentificacion] = useState("");
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    const obtenerUsuario = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) setCorreo(user.email);
    };
    obtenerUsuario();
  }, []);

  const guardarPaso1 = async () => {
    if (!identificacion || !nombreCompleto || !telefono) {
      return Alert.alert("Error", "Por favor completa todos los campos.");
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
      identificacion: identificacion,
      nombre_completo: nombreCompleto,
      rol: "estudiante",
    });

    setCargando(false);

    if (error) {
      Alert.alert("Error guardando datos", error.message);
    } else {
      router.push("/datos-usuario");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Datos personales</Text>
          <Text style={styles.headerSubtitle}>Cuéntanos quién eres.</Text>
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>Paso 1 de 2</Text>
            <View style={styles.progressBarBackground}>
              <View style={styles.progressBarFill} />
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.label}>Número de identificación</Text>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons
              name="card-account-details-outline"
              size={20}
              color="#73799D"
              style={styles.icon}
            />
            <TextInput
              style={styles.input}
              placeholder="Escribe aquí"
              placeholderTextColor="#999"
              keyboardType="numeric"
              value={identificacion}
              onChangeText={setIdentificacion}
            />
          </View>

          <Text style={styles.label}>Correo electrónico</Text>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons
              name="email-outline"
              size={20}
              color="#73799D"
              style={styles.icon}
            />
            <TextInput style={styles.input} value={correo} editable={false} />
            <MaterialCommunityIcons name="lock" size={20} color="#73799D" />
          </View>

          <Text style={styles.label}>Nombre completo</Text>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons
              name="account-outline"
              size={20}
              color="#73799D"
              style={styles.icon}
            />
            <TextInput
              style={styles.input}
              placeholder="Escribe aquí"
              placeholderTextColor="#999"
              value={nombreCompleto}
              onChangeText={setNombreCompleto}
            />
          </View>

          <Text style={styles.label}>Teléfono</Text>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons
              name="phone-outline"
              size={20}
              color="#73799D"
              style={styles.icon}
            />
            <TextInput
              style={styles.input}
              placeholder="Escribe aquí"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
              value={telefono}
              onChangeText={setTelefono}
            />
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={guardarPaso1}
            disabled={cargando}
          >
            <MaterialCommunityIcons name="check" size={20} color="#FFF" />
            <Text style={styles.buttonText}>
              {cargando ? "Guardando..." : "Continuar"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
