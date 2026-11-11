import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView, Text, TouchableOpacity, View } from "react-native";
import { styles } from "../../../styles/RecuperarStyles";

export default function RevisaCorreo() {
  const { correo } = useLocalSearchParams();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons
            name="email-check-outline"
            size={50}
            color="#FFF"
          />
        </View>
        <Text style={[styles.headerTitle, { textAlign: "center" }]}>
          Revisa tu correo
        </Text>
        <Text style={[styles.headerSubtitle, { textAlign: "center" }]}>
          Enviamos un enlace a {correo}
        </Text>
      </View>
      <View style={styles.body}>
        <Text
          style={{
            textAlign: "center",
            color: "#73799D",
            marginBottom: 20,
            lineHeight: 20,
          }}
        >
          Abre el correo y toca el enlace para crear tu nuevo PIN.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace("/auth")}
        >
          <Text style={styles.buttonText}>Abrir correo / Volver</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
