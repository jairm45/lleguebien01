import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView, Text, TouchableOpacity, View } from "react-native";
import { styles } from "../../../styles/RecuperarStyles";

export default function ExitoPin() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
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
          onPress={() => router.replace("/auth")}
        >
          <Text style={styles.buttonText}>Ir a iniciar sesión</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
