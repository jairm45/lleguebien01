import { StyleSheet } from "react-native";
import { cabeceraEstudiante } from "./CabeceraEstudianteStyles";

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  header: {
    ...cabeceraEstudiante.fondo,
    ...cabeceraEstudiante.bordes,
    paddingTop: 24,
    paddingHorizontal: 25,
    paddingBottom: 30,
  },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#FFF" },
  headerSubtitle: {
    fontSize: 14,
    color: "#D8DAEF",
    marginTop: 5,
  },
  body: { padding: 25, flex: 1 },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1A1E3C",
    marginBottom: 8,
    marginTop: 15,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D9DDEF",
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 55,
    backgroundColor: "#FFFFFF",
  },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: "#1A1E3C" },
  button: {
    backgroundColor: "#1A1E3C",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    borderRadius: 16,
    gap: 10,
    marginTop: 30,
  },
  buttonText: { color: "#FFF", fontSize: 18, fontWeight: "700" },
  backButton: { minHeight: 48, justifyContent: "center", marginTop: 8 },
  backText: {
    textAlign: "center",
    color: "#1A1E3C",
    fontSize: 14,
    fontWeight: "600",
  },
});
