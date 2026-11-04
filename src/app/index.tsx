import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView, Text, TouchableOpacity, View } from "react-native";
import { styles } from "../styles/WelcomeStyles";

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <MaterialCommunityIcons
            name="map-marker-radius"
            size={60}
            color="#F5A623"
          />
        </View>

        <Text style={styles.title}>LleguéBien</Text>
        <Text style={styles.subtitle}>
          Tu regreso a casa, siempre acompañado.
        </Text>

        <Text style={styles.question}>¿Cómo vas a usar la app?</Text>

        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push("/auth")}
          activeOpacity={0.8}
        >
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="school" size={30} color="#FFF" />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Soy estudiante</Text>
            <Text style={styles.cardSubtitle}>
              Quiero que me acompañen al volver a casa.
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={26}
            color="#73799D"
          />
        </TouchableOpacity>
      </View>

      <Text style={styles.footerText}>
        Al continuar aceptas los términos y la política de privacidad.
      </Text>
    </SafeAreaView>
  );
}
