import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../../services/supabase";
import { styles } from "../../../styles/RecuperarStyles";

export default function NuevoPin() {
  const [pin, setPin] = useState("");
  const [confirmarPin, setConfirmarPin] = useState("");
  const [cargando, setCargando] = useState(false);

  // Estado que controla si ya se completó el primer PIN
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);

  const guardarPin = async () => {
    if (pin.length !== 6)
      return Alert.alert("Error", "El PIN debe tener 6 dígitos.");
    if (pin !== confirmarPin)
      return Alert.alert("Error", "Los PIN no coinciden.");

    setCargando(true);
    const { error } = await supabase.auth.updateUser({ password: pin });
    setCargando(false);

    if (error) Alert.alert("Error", error.message);
    else router.replace("/rol/recuperar/exito");
  };

  const volverAEditarPin = () => {
    setMostrarConfirmacion(false);
    setPin("");
    setConfirmarPin("");
  };

  const renderBoxes = (value: string, active: boolean = false) => {
    return (
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: 10,
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <View
            key={i}
            style={{
              width: 45,
              height: 50,
              borderRadius: 10,
              borderWidth: 1,
              borderColor:
                value.length > i ? "#F5A623" : active ? "#F5A623" : "#D9DDEF",
              backgroundColor: active ? "#FFF3DF" : "#FFF",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: "700", color: "#1A1E3C" }}>
              {value[i] || ""}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Crea tu nuevo PIN</Text>
        <Text style={styles.headerSubtitle}>
          Elige 6 dígitos que puedas recordar.
        </Text>
      </View>
      <View style={styles.body}>
        {/* --- PRIMER PIN --- */}
        <Text style={styles.label}>Nuevo PIN</Text>
        {renderBoxes(pin, !mostrarConfirmacion)}

        {/* El primer input solo se muestra si NO estamos en confirmación */}
        {!mostrarConfirmacion && (
          <TextInput
            style={{ position: "absolute", opacity: 0, height: 1, width: 1 }}
            value={pin}
            onChangeText={(text) => {
              setPin(text);
              if (text.length === 6) {
                setMostrarConfirmacion(true);
              }
            }}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />
        )}

        {/* Botón para volver atrás */}
        {mostrarConfirmacion && (
          <TouchableOpacity
            onPress={volverAEditarPin}
            style={{ marginTop: 10, alignSelf: "flex-start" }}
          >
            <Text style={{ color: "#F5A623", fontSize: 13, fontWeight: "600" }}>
              ← Volver a editar el PIN
            </Text>
          </TouchableOpacity>
        )}

        {/* --- SEGUNDO PIN --- */}
        <Text
          style={[styles.label, { marginTop: mostrarConfirmacion ? 20 : 30 }]}
        >
          Confirmar PIN
        </Text>
        {renderBoxes(confirmarPin, mostrarConfirmacion)}

        {/* El segundo input solo se renderiza cuando el primero está completo */}
        {mostrarConfirmacion && (
          <TextInput
            style={{ position: "absolute", opacity: 0, height: 1, width: 1 }}
            value={confirmarPin}
            onChangeText={setConfirmarPin}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus={true} // 👈 Esto fuerza el foco y el teclado
          />
        )}

        {/* --- BOTÓN GUARDAR --- */}
        <TouchableOpacity
          style={[styles.button, { marginTop: mostrarConfirmacion ? 40 : 60 }]}
          onPress={guardarPin}
          disabled={cargando}
        >
          <MaterialCommunityIcons
            name="lock-check-outline"
            size={20}
            color="#FFF"
          />
          <Text style={styles.buttonText}>
            {cargando ? "Guardando..." : "Guardar nuevo PIN"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
