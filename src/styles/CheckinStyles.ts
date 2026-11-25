import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(10, 12, 30, 0.88)",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  card: {
    backgroundColor: "#1A1E3C",
    borderRadius: 24,
    padding: 22,
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(245, 166, 35, 0.5)",
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(245, 166, 35, 0.18)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#D8DAEF",
    textAlign: "center",
  },
  motivoCard: {
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  motivoTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#F5A623",
  },
  motivoText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#FFFFFF",
  },
  countdownRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 6,
  },
  countdownNumber: {
    fontSize: 42,
    fontWeight: "800",
    color: "#F5A623",
    lineHeight: 46,
  },
  countdownUnit: {
    fontSize: 14,
    color: "#D8DAEF",
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F5A623",
  },
  actions: {
    gap: 10,
    marginTop: 2,
  },
  buttonBien: {
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: "#1ABC9C",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonAyuda: {
    minHeight: 62,
    borderRadius: 16,
    backgroundColor: "#E5484D",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 12,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  buttonAyudaWrap: {
    alignItems: "center",
    gap: 1,
  },
  buttonSubtext: {
    color: "rgba(255, 255, 255, 0.82)",
    fontSize: 11,
  },
  footer: {
    fontSize: 11,
    lineHeight: 16,
    color: "#A6AACD",
    textAlign: "center",
  },
  pressed: {
    opacity: 0.82,
  },
});
