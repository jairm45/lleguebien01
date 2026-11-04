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

export default function RegistroScreen() {
  const [paso, setPaso] = useState<"correo" | "pin">("correo");
  const [correo, setCorreo] = useState("");
  const [pin, setPin] = useState("");
  const [cargando, setCargando] = useState(false);

  const dominioCorreo = "@unipacifico.edu.co";
  const longitudPin = 6;

  const continuarConCorreo = () => {
    if (!correo || !correo.endsWith(dominioCorreo)) {
      return Alert.alert(
        "Error",
        `El correo debe terminar en ${dominioCorreo}`,
      );
    }
    setPaso("pin");
  };

  const registrarUsuario = async () => {
    if (pin.length !== longitudPin) {
      return Alert.alert("Error", `El PIN debe tener ${longitudPin} dígitos.`);
    }

    setCargando(true);

    // 1. Intentamos crear la cuenta
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp(
      {
        email: correo,
        password: pin,
      },
    );

    // 2. Si el usuario ya existe, lo logueamos automáticamente
    if (
      signUpError &&
      signUpError.message.includes("User already registered")
    ) {
      const { data: loginData, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: correo,
          password: pin,
        });

      if (loginError) {
        setCargando(false);
        return Alert.alert(
          "Error",
          "El correo ya está registrado, pero el PIN es incorrecto.",
        );
      }

      if (loginData.user) {
        const { data: perfil } = await supabase
          .from("perfiles")
          .select("identificacion")
          .eq("id", loginData.user.id)
          .single();

        setCargando(false);

        if (perfil && perfil.identificacion) {
          router.replace("/estudiante/permisos");
        } else {
          router.replace("/datos-personales");
        }
      }
      return;
    }

    // 3. Si hay otro error real, lo mostramos
    if (signUpError) {
      setCargando(false);
      return Alert.alert("Error al registrar", signUpError.message);
    }

    // 4. Si el registro fue exitoso, guardamos el rol y vamos a datos personales
    if (signUpData.user) {
      await supabase.from("perfiles").upsert({
        id: signUpData.user.id,
        email: correo,
        rol: "estudiante",
      });
    }

    setCargando(false);
    Alert.alert("¡Cuenta creada!", "Ahora completa tus datos.");
    router.replace("/datos-personales");
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
          <MaterialCommunityIcons
            name="account-plus"
            size={40}
            color="#F5A623"
          />
        </View>
        <Text style={styles.title}>Crear cuenta</Text>
        <Text style={styles.subtitle}>
          {paso === "correo"
            ? "Ingresa tu correo institucional"
            : "Crea un PIN de seguridad"}
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

            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>¿Ya tienes cuenta?</Text>
              <TouchableOpacity onPress={() => router.replace("/auth")}>
                <Text style={styles.registerLink}>Inicia sesión</Text>
              </TouchableOpacity>
            </View>
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
              onPress={registrarUsuario}
              disabled={cargando}
            >
              <Text style={styles.buttonText}>
                {cargando ? "Verificando..." : "Registrarme"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setPaso("correo")}>
              <Text style={styles.backText}>Volver al correo</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
