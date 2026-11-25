import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useVinculosEstudiante } from "../hooks/useVinculosEstudiante";
import { styles } from "../styles/InicioStyles";

export function ResumenSeguidores() {
  const { vinculos, error } = useVinculosEstudiante();
  const activos = vinculos?.filter(v => v.estado === "activo");
  const nombres = activos?.slice(0, 3).map(v => v.nombre).join(", ");
  let texto = error ?? "Cargando seguidores…";
  if (activos) {
    texto = activos.length
      ? `${activos.length} ${activos.length === 1 ? "seguidor activo" : "seguidores activos"} · ${nombres}`
      : "Aún no tienes seguidores activos. Gestiona tus invitaciones.";
  }
  return (
    <Pressable style={styles.card} accessibilityRole="button" onPress={() => router.push("/estudiante/seguidores")}>
      <View style={styles.followersRow}>
        <MaterialCommunityIcons name="account-group-outline" size={24} color="#1A1E3C" />
        <Text style={styles.followersText}>{texto}</Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color="#73799D" />
      </View>
    </Pressable>
  );
}
