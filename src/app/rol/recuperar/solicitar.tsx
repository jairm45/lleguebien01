import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../../services/supabase";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "../../../styles/RecuperarStyles";

export default function SolicitarRecuperacion() {
  const { rol } = useLocalSearchParams<{ rol?: string }>();
  const margen = useSafeAreaInsets();
  const [correo, setCorreo] = useState("");
  const [cargando, setCargando] = useState(false);

  const enviarEnlace = async () => {
    if (!correo) return Alert.alert("Error", "Ingresa tu correo");
    setCargando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(correo, {
      redirectTo: "lleguebien01://rol/recuperar/nuevo-pin", //
    });
    setCargando(false);
    if (error) Alert.alert("Error", error.message);
    else
      router.push({
        pathname: "/rol/recuperar/revisa-correo",
        params: { correo, rol },
      });
  };

  return (
    <View style={[styles.container, { paddingBottom: margen.bottom }]}>
      <View style={[styles.header, { paddingTop: margen.top + 18 }]}>
        <Text style={styles.headerTitle}>Recupera tu PIN</Text>
        <Text style={styles.headerSubtitle}>
          Te enviaremos un correo para crear uno nuevo.
        </Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.label}>Correo electrónico</Text>
        <View style={styles.inputContainer}>
          <MaterialCommunityIcons
            name="email-outline"
            size={20}
            color="#73799D"
          />
          <TextInput
            style={styles.input}
            placeholder="Tu correo electrónico"
            value={correo}
            onChangeText={setCorreo}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>
        <View style={styles.infoBox}>
          <MaterialCommunityIcons
            name="email-check-outline"
            size={20}
            color="#F5A623"
          />
          <Text style={styles.infoText}>
            Recibirás un enlace para crear un PIN nuevo de 6 dígitos.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.button}
          onPress={enviarEnlace}
          disabled={cargando}
        >
          <MaterialCommunityIcons name="send" size={20} color="#FFF" />

          <Text style={styles.buttonText}>
            {cargando ? "Enviando..." : "Enviar enlace"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>Volver a iniciar sesión</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
