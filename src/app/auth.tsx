import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";

import {
  Alert,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../services/supabase";
import { styles } from "../styles/AuthStyles";

export default function AuthScreen() {
  const [paso, setPaso] = useState<"correo" | "pin">("correo");
  const [correo, setCorreo] = useState("");
  const [pin, setPin] = useState("");
  const [cargando, setCargando] = useState(false);

  const dominioCorreo = "@unipacifico.edu.co";
  const longitudPin = 6;

  // Paso 1: Validar correo y pasar al PIN
  const continuarConCorreo = () => {
    if (!correo || !correo.endsWith(dominioCorreo)) {
      return Alert.alert(
        "Error",
        `El correo debe terminar en ${dominioCorreo}`,
      );
    }
    setPaso("pin");
  };

  // Paso 2: Iniciar sesión o registrar con correo y PIN
  const manejarAuth = async () => {
    if (pin.length !== longitudPin) {
      return Alert.alert("Error", `El PIN debe tener ${longitudPin} dígitos.`);
    }

    setCargando(true);

    // 1. Intentamos iniciar sesión
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: correo,
        password: pin,
      });

    // 2. Si el usuario no existe, lo registramos automáticamente
    if (authError && authError.message.includes("Invalid login credentials")) {
      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email: correo,
          password: pin,
        });

      if (signUpError) {
        setCargando(false);
        return Alert.alert("Error al registrar", signUpError.message);
      }

      if (signUpData.user) {
        await supabase.from("perfiles").upsert({
          id: signUpData.user.id,
          email: correo,
          rol: "estudiante",
        });
      }

      setCargando(false);
      router.replace("/datos-personales");
    } else if (authError) {
      setCargando(false);
      return Alert.alert("Error", authError.message);
    } else if (authData.user) {
      // 3. LOGIN EXITOSO: Verificamos si ya tiene datos completos
      const { data: perfil, error: perfilError } = await supabase
        .from("perfiles")
        .select("identificacion")
        .eq("id", authData.user.id)
        .single();

      setCargando(false);

      if (perfilError && perfilError.code !== "PGRST116") {
        console.error(perfilError);
        return Alert.alert("Error", "No se pudo verificar tu perfil.");
      }

      // Si el perfil existe y tiene identificación, ya completó sus datos
      if (perfil && perfil.identificacion) {
        // Redirigir al inicio
        router.replace("/estudiante/inicio");
      } else {
        // Si no tiene identificación, es un usuario nuevo o incompleto
        router.replace("/datos-personales");
      }
    }
  };

  const renderPinBoxes = () => {
    return Array.from({ length: longitudPin }).map((_, index) => {
      const isFilled = pin.length > index;
      return (
        <View
          key={index}
          style={[styles.pinBox, isFilled && styles.pinBoxFilled]}
        >
          {isFilled && <View style={styles.pinDot} />}
        </View>
      );
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <MaterialCommunityIcons name="school" size={40} color="#F5A623" />
        </View>
        <Text style={styles.title}>Estudiante</Text>
        <Text style={styles.subtitle}>
          {paso === "correo"
            ? "Ingresa tu correo institucional"
            : "Ingresa tu PIN"}
        </Text>
      </View>

      <View style={styles.body}>
        {paso === "correo" ? (
          <>
            <Text style={styles.label}>Correo electrónico</Text>
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons
                name="email-outline"
                size={20}
                color="#73799D"
              />
              <TextInput
                style={styles.input}
                placeholder={`usuario${dominioCorreo}`}
                keyboardType="email-address"
                autoCapitalize="none"
                value={correo}
                onChangeText={setCorreo}
                autoFocus
              />
            </View>

            <TouchableOpacity
              style={styles.continueButton}
              onPress={continuarConCorreo}
            >
              <Text style={styles.continueButtonText}>Continuar</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.label}>PIN de {longitudPin} dígitos</Text>
            <View style={styles.pinContainer}>{renderPinBoxes()}</View>

            <TextInput
              style={{ height: 0, width: 0, position: "absolute" }}
              value={pin}
              onChangeText={setPin}
              keyboardType="number-pad"
              maxLength={longitudPin}
              autoFocus
            />

            <TouchableOpacity
              style={styles.button}
              onPress={manejarAuth}
              disabled={cargando}
            >
              <Text style={styles.buttonText}>
                {cargando ? "Cargando..." : "Iniciar sesión"}
              </Text>
            </TouchableOpacity>

            {/* 👇 NUEVO ENLACE DE RECUPERACIÓN */}
            <TouchableOpacity
              onPress={() => router.push("/rol/recuperar/solicitar")}
            >
              <Text style={styles.forgotText}>¿Se te olvidó tu PIN?</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setPaso("correo")}>
              <Text style={styles.backText}>Volver al correo</Text>
            </TouchableOpacity>

            {/* BOTÓN DE REGISTRO AGREGADO */}
            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>¿No tienes cuenta?</Text>
              <TouchableOpacity onPress={() => router.replace("/registro")}>
                <Text style={styles.registerLink}>Regístrate</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
