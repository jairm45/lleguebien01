import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  base: {
    width: "100%",
  },
  bloqueo: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#1A1E3C",
    padding: 24,
  },
  panel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#F0C9C9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  banner: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#E5484D",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  icono: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FDE8E8",
    alignItems: "center",
    justifyContent: "center",
  },
  iconoBanner: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  textos: {
    flex: 1,
    gap: 4,
  },
  titulo: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1E3C",
    marginBottom: 2,
  },
  tituloBloqueo: {
    color: "#FFFFFF",
  },
  mensaje: {
    fontSize: 14,
    lineHeight: 20,
    color: "#45445A",
  },
  mensajeBloqueo: {
    color: "#D8DAEF",
  },
  mensajeBanner: {
    fontSize: 12,
    lineHeight: 17,
    color: "#1A1E3C",
  },
  acciones: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  accionesBanner: {
    marginTop: 10,
  },
  botonPrimario: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#1ABC9C",
    alignItems: "center",
    justifyContent: "center",
  },
  botonSecundario: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D9DDEF",
    alignItems: "center",
    justifyContent: "center",
  },
  botonTexto: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  botonTextoSecundario: {
    color: "#1A1E3C",
    fontSize: 13,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.8,
  },
});
