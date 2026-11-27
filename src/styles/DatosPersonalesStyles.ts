import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  scroll: { flexGrow: 1 },
  body: { padding: 25 },
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
    backgroundColor: "#1ABC9C",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    borderRadius: 16,
    gap: 10,
    marginTop: 40,
  },
  buttonText: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
});
