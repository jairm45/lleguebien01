import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { styles } from "../../styles/SeguidoresStyles";

export default function SeguidoresScreen() {
  // Datos de ejemplo (luego los traeremos de Supabase)
  const [seguidores] = useState([
    {
      id: 1,
      nombre: "Mamá",
      inicial: "M",
      estado: "Vinculada",
      color: "#1ABC9C",
      fecha: "2 de oct.",
    },
    {
      id: 2,
      nombre: "Papá",
      inicial: "P",
      estado: "Vinculado",
      color: "#1A1E3C",
      fecha: "2 de oct.",
    },
    {
      id: 3,
      nombre: "Hermano",
      inicial: "H",
      estado: "Pendiente",
      color: "#F5A623",
      fecha: "Hace 2 h",
    },
  ]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mis seguidores</Text>
        <Text style={styles.headerSubtitle}>
          Ellos ven tu ubicación en tus recorridos.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {seguidores.map((seguidor) => (
          <View key={seguidor.id} style={styles.followerCard}>
            <View style={[styles.avatar, { backgroundColor: seguidor.color }]}>
              <Text style={styles.avatarText}>{seguidor.inicial}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{seguidor.nombre}</Text>
              <Text style={styles.subtext}>
                {seguidor.estado === "Pendiente"
                  ? "Invitación enviada"
                  : "Te sigue desde el"}{" "}
                {seguidor.fecha}
              </Text>
            </View>
            <View
              style={[
                styles.statusTag,
                {
                  backgroundColor:
                    seguidor.estado === "Pendiente" ? "#FFF3DF" : "#E8F8F5",
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color:
                      seguidor.estado === "Pendiente" ? "#F5A623" : "#1ABC9C",
                  },
                ]}
              >
                {seguidor.estado}
              </Text>
            </View>
          </View>
        ))}

        <View style={styles.infoBox}>
          <MaterialCommunityIcons
            name="shield-account-outline"
            size={20}
            color="#F5A623"
          />
          <Text style={styles.infoText}>
            Tú decides quién te sigue. Puedes quitar a un seguidor cuando
            quieras.
          </Text>
        </View>
      </ScrollView>

      <View style={{ padding: 20 }}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push("/")} //pendiente.
        >
          <MaterialCommunityIcons
            name="account-plus-outline"
            size={20}
            color="#FFF"
          />
          <Text style={styles.buttonText}>Invitar seguidor</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
