import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  header: { backgroundColor: "#1A1E3C", padding: 20, gap: 6 },
  title: { color: "#FFF", fontWeight: "800", fontSize: 26 },
  subtitle: { color: "#D8DAEF", fontSize: 15 },
  body: { padding: 20, gap: 12 },
  section: { color: "#1A1E3C", fontWeight: "700", fontSize: 19, marginTop: 12 },
  card: { backgroundColor: "#FFF", borderRadius: 16, padding: 16, gap: 8 },
  name: { color: "#1A1E3C", fontWeight: "700", fontSize: 17 },
  detail: { color: "#535978", fontSize: 15 },
  code: { color: "#1A1E3C", fontWeight: "800", fontSize: 24, letterSpacing: 3 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  button: { minHeight: 44, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: "#E8F8F5",
    borderRadius: 10, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: "#1A1E3C" },
  buttonText: { color: "#185C50", fontWeight: "700", fontSize: 15 },
  primaryText: { color: "#FFF" },
  disabled: { opacity: 0.5 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 10, borderColor: "#A6AACD",
    paddingHorizontal: 12, color: "#1A1E3C", backgroundColor: "#FFF" },
  aviso: { color: "#1A1E3C", backgroundColor: "#FFF3DF", padding: 12, borderRadius: 10 },
});
