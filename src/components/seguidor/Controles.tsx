import Icono from "@expo/vector-icons/MaterialCommunityIcons";
import { StatusBar } from "expo-status-bar";
import { useRef, useState, type ComponentProps, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const color = { navy: "#1A1E3C", teal: "#1ABC9C", tinta: "#075D51", rojo: "#E5484D", gris: "#73799D", fondo: "#F4F8F7" };
export const ui = StyleSheet.create({
  base: { flex: 1, backgroundColor: color.fondo },
  cuerpo: { padding: 20, gap: 16 },
  cabecera: { paddingHorizontal: 22, paddingBottom: 22, backgroundColor: color.teal, flexDirection: "row", alignItems: "center", gap: 12 },
  titulo: { fontSize: 28, fontWeight: "800", color: color.navy, letterSpacing: -0.6 },
  seccion: { fontSize: 19, fontWeight: "700", color: color.navy },
  texto: { fontSize: 15, color: "#4A5266", lineHeight: 22 },
  etiqueta: { fontSize: 14, fontWeight: "700", color: color.navy },
  tarjeta: { padding: 18, gap: 10, borderRadius: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DAE5E2" },
  fila: { flexDirection: "row", gap: 12, alignItems: "center" },
  entrada: { backgroundColor: "white", borderColor: "#AEBDB9", borderWidth: 1, borderRadius: 12, minHeight: 48,
    paddingHorizontal: 14, color: color.navy, fontSize: 16 },
  boton: { minHeight: 48, borderRadius: 13, paddingHorizontal: 16, paddingVertical: 10,
    alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9 },
  botonTexto: { fontSize: 16, fontWeight: "700" },
  aviso: { color: "#8A2729", backgroundColor: "#FFF1EF", padding: 12, borderRadius: 10 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#D9F5ED", alignItems: "center", justifyContent: "center" },
});

type CabeceraProps = { titulo: string; detalle?: string; accion?: ReactNode };
export function Cabecera({ titulo, detalle, accion }: CabeceraProps) {
  const margen = useSafeAreaInsets();
  return <View style={[ui.cabecera, { paddingTop: margen.top + 20 }]}>
    <StatusBar style="dark" />
    <View style={{ flex: 1, gap: 4 }}>
      {!!detalle && <Text style={ui.etiqueta}>{detalle}</Text>}
      <Text accessibilityRole="header" style={ui.titulo}>{titulo}</Text>
    </View>{accion}
  </View>;
}
export function Pantalla({ children, ...cabecera }: CabeceraProps & { children: ReactNode }) {
  const margen = useSafeAreaInsets();
  return <KeyboardAvoidingView style={ui.base} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <Cabecera {...cabecera} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[ui.cuerpo, { paddingBottom: margen.bottom + 24 }]}>{children}</ScrollView>
  </KeyboardAvoidingView>;
}
export function Boton({ titulo, accion, secundario, peligro, icono, desactivado }: {
  titulo: string; accion: () => void; secundario?: boolean; peligro?: boolean;
  icono?: ComponentProps<typeof Icono>["name"]; desactivado?: boolean;
}) {
  const tinta = secundario ? color.tinta : "white";
  return <Pressable accessibilityRole="button" disabled={desactivado} onPress={accion}
    style={({ pressed }) => [ui.boton, { backgroundColor: peligro ? "#B83136" : secundario ? "#E1F2EE" : color.tinta,
      opacity: desactivado || pressed ? 0.58 : 1 }]}>
    {icono && <Icono name={icono} size={21} color={tinta} />}
    <Text style={[ui.botonTexto, { color: tinta }]}>{titulo}</Text>
  </Pressable>;
}
export function Campo({ titulo, ...props }: ComponentProps<typeof TextInput> & { titulo: string }) {
  return <View style={{ gap: 6 }}><Text style={ui.etiqueta}>{titulo}</Text>
    <TextInput accessibilityLabel={titulo} style={ui.entrada} {...props} /></View>;
}
export function Avatar({ nombre }: { nombre: string }) {
  return <View style={ui.avatar}><Text style={[ui.seccion, { color: color.tinta }]}>{nombre.trim().slice(0, 1).toUpperCase()}</Text></View>;
}
export function Aviso({ mensaje }: { mensaje?: string | null }) {
  return mensaje ? <Text accessibilityLiveRegion="polite" selectable style={ui.aviso}>{mensaje}</Text> : null;
}
export function useOperacion() {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const enCurso = useRef(false);
  async function ejecutar(tarea: () => Promise<void>) {
    if (enCurso.current) return;
    enCurso.current = true;
    setOcupado(true);
    setError(null);
    try { await tarea(); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo completar la operación."); }
    finally { enCurso.current = false; setOcupado(false); }
  }
  return { error, ocupado, ejecutar };
}
