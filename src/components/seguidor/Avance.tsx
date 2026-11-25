import { Text, View } from "react-native";
import { formatearDistancia } from "../../lib/recorrido";
import type { RecorridoActivo } from "../../services/recorridos";
import { avance } from "../../services/seguimientoFamiliar";
import { color, ui } from "./Controles";

export function hora(fecha: string) {
  return new Date(fecha).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}
export function Avance({ ruta }: { ruta: RecorridoActivo }) {
  const { restante, porcentaje, eta } = avance(ruta);
  return <View style={{ gap: 7 }}>
    <Text style={ui.etiqueta}>{porcentaje == null ? "Avance pendiente de ruta" : `Avance aproximado · ${porcentaje}%`}</Text>
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: porcentaje ?? undefined }}
      style={{ height: 6, backgroundColor: "#DCEDE8", borderRadius: 3 }}>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: color.teal, width: `${porcentaje ?? 0}%` }} />
    </View>
    <Text style={ui.texto}>{restante != null ? `${formatearDistancia(restante)} restantes` : "Distancia por calcular"} · {eta ? `Llegada est. ${hora(eta)}` : "Llegada por estimar"}</Text>
  </View>;
}
