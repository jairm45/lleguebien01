import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
    SafeAreaView,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { styles } from "../styles/ProteccionStyles";

export default function ProteccionScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView bounces={false}>
        {/* Cabecera Azul */}
        <View style={styles.header}>
          {/* 👇 BOTÓN DE CONFIGURACIÓN (ENGRANAJE) */}
          <TouchableOpacity
            onPress={() => router.push("/configuracion")}
            style={{ position: "absolute", top: 50, right: 20, zIndex: 10 }}
          >
            <MaterialCommunityIcons name="cog" size={26} color="#FFF" />
          </TouchableOpacity>

          <View style={styles.iconContainer}>
            <MaterialCommunityIcons
              name="shield-check"
              size={60}
              color="#FFF"
            />
          </View>
          <Text style={styles.headerTitle}>Protección activa</Text>
          <Text style={styles.headerSubtitle}>
            Agita el teléfono 4 veces seguidas para pedir ayuda.
          </Text>
        </View>

        <View style={styles.body}>
          {/* Tarjeta del contacto */}
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>M</Text>
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Mamá</Text>
              <Text style={styles.cardSubtitle}>
                Contacto de confianza · código AB12CD
              </Text>
            </View>
            <View style={styles.statusTag}>
              <Text style={styles.statusText}>Vinculada</Text>
            </View>
          </View>

          {/* Código de invitación */}
          <View style={styles.codeCard}>
            <View>
              <Text style={styles.codeLabel}>
                Tu código para que te vinculen
              </Text>
              <Text style={styles.codeValue}>KM4Q2X</Text>
            </View>
            <MaterialCommunityIcons
              name="content-copy"
              size={24}
              color="#1A1E3C"
            />
          </View>

          {/* Cómo funciona */}
          <View style={styles.howItWorks}>
            <Text style={styles.sectionTitle}>Cómo funciona</Text>
            <View style={styles.stepsRow}>
              <View style={styles.step}>
                <View style={[styles.stepIcon, { backgroundColor: "#E8E8F5" }]}>
                  <MaterialCommunityIcons
                    name="cellphone"
                    size={24}
                    color="#1A1E3C"
                  />
                </View>
                <Text style={styles.stepText}>Agitas 4 veces</Text>
              </View>
              <View style={styles.step}>
                <View style={[styles.stepIcon, { backgroundColor: "#FFF3DF" }]}>
                  <MaterialCommunityIcons
                    name="timer-outline"
                    size={24}
                    color="#F5A623"
                  />
                </View>
                <Text style={styles.stepText}>8 s para cancelar</Text>
              </View>
              <View style={styles.step}>
                <View style={[styles.stepIcon, { backgroundColor: "#FFE5E5" }]}>
                  <MaterialCommunityIcons
                    name="bell-alert"
                    size={24}
                    color="#E5484D"
                  />
                </View>
                <Text style={styles.stepText}>Se avisa a tu contacto</Text>
              </View>
            </View>
          </View>

          {/* Botones */}
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push("/iniciar-recorrido")}
          >
            <MaterialCommunityIcons
              name="map-marker-path"
              size={24}
              color="#FFF"
            />
            <Text style={styles.buttonText}>Iniciar recorrido</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => {}}>
            <MaterialCommunityIcons
              name="cellphone"
              size={24}
              color="#1A1E3C"
            />
            <Text style={styles.secondaryButtonText}>Probar detección</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
