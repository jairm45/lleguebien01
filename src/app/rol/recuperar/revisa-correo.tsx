import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, useLocalSearchParams } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "../../../styles/RecuperarStyles";

export default function RevisaCorreo() {
  const margen = useSafeAreaInsets();
  const { correo, rol } = useLocalSearchParams();

  return (
    <View style={[styles.container, { paddingBottom: margen.bottom }]}>
      <View style={[styles.header, { paddingTop: margen.top + 18 }]}>
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
          onPress={() => router.replace(rol === "seguidor" ? "/familiar/acceso" : "/auth")}
        >
          <Text style={styles.buttonText}>Volver a iniciar sesión</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
