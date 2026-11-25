import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSesion } from "../../../context/SesionContext";
import { styles } from "../../../styles/RecuperarStyles";

export default function ExitoPin() {
  const { perfil } = useSesion();
  const margen = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingBottom: margen.bottom }]}>
      <View style={[styles.header, { paddingTop: margen.top + 18 }]}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="check" size={50} color="#FFF" />
        </View>
        <Text style={[styles.headerTitle, { textAlign: "center" }]}>
          ¡PIN actualizado!
        </Text>
        <Text style={[styles.headerSubtitle, { textAlign: "center" }]}>
          Ya puedes entrar con tu nuevo PIN.
        </Text>
      </View>
      <View style={styles.body}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace(perfil?.rol === "seguidor" ? "/" : "/auth")}
        >
          <Text style={styles.buttonText}>Ir a iniciar sesión</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
