import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  scroll: { flexGrow: 1, paddingBottom: 100 },
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
    height: 50,
    backgroundColor: "#FFFFFF",
  },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: "#1A1E3C" },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: "#FFFFFF",
  },
  saveButton: {
    backgroundColor: "#1ABC9C",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    borderRadius: 16,
    gap: 10,
  },
  saveButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
