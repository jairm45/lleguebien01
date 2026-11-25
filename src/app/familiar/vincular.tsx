import { router } from "expo-router";
import { useRef, useState, type ComponentRef } from "react";
import { Clipboard, Platform, Pressable, Text, TextInput, View } from "react-native";
import { Aviso, Boton, Campo, Pantalla, ui, useOperacion } from "../../components/seguidor/Controles";
import { extraerCodigo, guardarCodigo } from "../../services/perfilSesion";

export default function Vincular() {
  const [codigo, setCodigo] = useState("");
  const [enlace, setEnlace] = useState("");
  const [pegar, setPegar] = useState(false);
  const entrada = useRef<ComponentRef<typeof TextInput>>(null);
  const { ejecutar, ocupado, error } = useOperacion();
  async function continuar(valor: string) {
    const valido = extraerCodigo(valor);
    if (!valido) throw new Error("Revisa el enlace o escribe el código de seis caracteres.");
    await guardarCodigo(valido);
    router.push({ pathname: "/familiar/invitacion", params: { codigo: valido } });
  }
  return <Pantalla titulo="Vincular estudiante" detalle="Invitación">
    <Text style={ui.texto}>Escribe el código que te compartió el estudiante. Vence 24 horas después de generarse.</Text>
    <Pressable onPress={() => entrada.current?.focus()} style={{ position: "relative" }}>
      <View pointerEvents="none" style={{ flexDirection: "row", gap: 6 }}>
        {Array.from({ length: 6 }, (_, i) => <View key={i} style={[ui.entrada, { flex: 1, paddingHorizontal: 0, alignItems: "center", justifyContent: "center" }]}>
          <Text style={ui.seccion}>{codigo[i]}</Text></View>)}
      </View>
      <TextInput ref={entrada} accessibilityLabel="Código de seis caracteres" value={codigo} onChangeText={v => setCodigo(v.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
        autoCapitalize="characters" autoCorrect={false} maxLength={6} style={{ position: "absolute", inset: 0, opacity: 0.02 }} />
    </Pressable>
    <Aviso mensaje={error} />
    <Boton titulo="Vincular y continuar" desactivado={ocupado || codigo.length !== 6} accion={() => ejecutar(() => continuar(codigo))} />
    <Boton secundario titulo="Usar enlace de invitación" accion={() => ejecutar(async () => {
      setPegar(true);
      const valor = Platform.OS === "web" ? await navigator.clipboard?.readText().catch(() => "") : await Clipboard.getString();
      if (valor && extraerCodigo(valor)) { setEnlace(valor); await continuar(valor); }
    })} />
    {pegar && <><Campo titulo="Pega el enlace" autoCapitalize="none" value={enlace} onChangeText={setEnlace} />
      <Boton titulo="Abrir invitación" desactivado={ocupado} accion={() => ejecutar(() => continuar(enlace))} /></>}
    <Boton secundario titulo="Ir a mi inicio" accion={() => router.replace("/seguidor/inicio")} />
  </Pantalla>;
}
