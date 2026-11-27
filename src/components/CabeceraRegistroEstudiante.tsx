import { StyleSheet, Text, View } from "react-native";
import { cabeceraEstudiante } from "../styles/CabeceraEstudianteStyles";

type Props = {
  titulo: string;
  subtitulo: string;
  paso: 1 | 2;
};

export function CabeceraRegistroEstudiante({ titulo, subtitulo, paso }: Props) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>{titulo}</Text>
      <Text style={styles.headerSubtitle}>{subtitulo}</Text>
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>Paso {paso} de 2</Text>
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: paso === 1 ? "50%" : "100%" }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    ...cabeceraEstudiante.fondo,
    ...cabeceraEstudiante.bordes,
    paddingTop: 24,
    paddingHorizontal: 25,
    paddingBottom: 30,
  },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#FFFFFF" },
  headerSubtitle: {
    fontSize: 14,
    color: "#D8DAEF",
    marginTop: 5,
  },
  progressContainer: { marginTop: 20 },
  progressText: { fontSize: 10, color: "#FFFFFF", marginBottom: 5 },
  progressBarBackground: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 3,
  },
  progressBarFill: {
    height: 6,
    backgroundColor: "#1ABC9C",
    borderRadius: 3,
  },
});
