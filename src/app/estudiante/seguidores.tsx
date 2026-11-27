import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Clipboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, SectionList,
  Share, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSesion } from "../../context/SesionContext";
import { useVinculosEstudiante } from "../../hooks/useVinculosEstudiante";
import { crearInvitacion, enviarInvitacion, revocarSeguidor, type Vinculo } from "../../services/seguidores";
import { styles } from "../../styles/SeguidoresStyles";

function Boton({ texto, accion, principal, desactivado }: {
  texto: string; accion: () => void; principal?: boolean; desactivado?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" disabled={desactivado} onPress={accion}
      style={[styles.button, principal && styles.primary, desactivado && styles.disabled]}>
      <Text style={[styles.buttonText, principal && styles.primaryText]}>{texto}</Text>
    </Pressable>
  );
}

function Codigo({ fila, avisar, children }: {
  fila: Vinculo;
  avisar: (mensaje: string) => void;
  children?: ReactNode;
}) {
  const codigo = fila.codigo_invitacion;
  const expiracion = Date.parse(fila.codigo_expira_en ?? "");
  const [ahora, actualizar] = useState(Date.now);
  useEffect(() => {
    const espera = expiracion - Date.now();
    if (!(espera > 0)) return;
    const timer = setTimeout(() => actualizar(Date.now()), espera + 1);
    return () => clearTimeout(timer);
  }, [expiracion]);
  if (!codigo || !(expiracion > ahora)) return <Text style={styles.detail}>Invitación vencida. Puedes cancelarla y crear otra.</Text>;
  async function compartir() {
    try {
      await Share.share({ message: `Te invito a seguir mis recorridos en LleguéBien. Código: ${codigo}\nlleguebien01://seguir?codigo=${codigo}` });
    } catch { avisar("No se pudo compartir el código."); }
  }
  async function copiar() {
    if (!codigo) return;
    try {
      if (Platform.OS === "web") await navigator.clipboard.writeText(codigo);
      else Clipboard.setString(codigo);
      avisar("Código copiado.");
    } catch { avisar("Selecciona el código para copiarlo manualmente."); }
  }
  return <>
    <Text selectable style={styles.code}>{codigo}</Text>
    <Text style={styles.detail}>Válido por 24 horas. Vence el {new Date(expiracion).toLocaleString("es-CO")}.</Text>
    <View style={styles.actions}>
      <Boton texto="Copiar código" accion={copiar} />
      <Boton texto="Compartir" accion={compartir} />
      {children}
    </View>
  </>;
}

export default function SeguidoresScreen() {
  const { session } = useSesion();
  return <GestionSeguidores key={session?.user.id} />;
}

function GestionSeguidores() {
  const insets = useSafeAreaInsets();
  const { vinculos, error, recargar } = useVinculosEstudiante();
  const [modal, mostrarModal] = useState(false);
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [aviso, avisar] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const bloqueo = useRef(false);

  async function ejecutar(accion: () => Promise<void>) {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setOcupado(true);
    avisar("");
    try { await accion(); }
    catch (e) { avisar(e instanceof Error ? e.message : "No se pudo completar la operación."); }
    bloqueo.current = false;
    setOcupado(false);
  }
  const secciones = [
    { title: "Seguidores activos", data: (vinculos ?? []).filter(v => v.estado === "activo") },
    { title: "Invitaciones pendientes", data: (vinculos ?? []).filter(v => v.estado === "pendiente") },
  ].filter(s => s.data.length > 0);

  return <View style={styles.container}>
    <StatusBar style="light" />
    <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
      <Text style={styles.title}>Mis seguidores</Text>
      <Text style={styles.subtitle}>Elige quién puede acompañar tus recorridos.</Text>
    </View>
    <SectionList sections={secciones} keyExtractor={v => v.id} stickySectionHeadersEnabled={false}
      contentContainerStyle={styles.body}
      ListHeaderComponent={<>
        <Boton principal texto="Invitar seguidor" accion={() => { avisar(""); mostrarModal(true); }} desactivado={ocupado || !vinculos} />
        {!modal && !!aviso && <Text accessibilityLiveRegion="polite" style={styles.aviso}>{aviso}</Text>}
      </>}
      refreshing={!vinculos && !error} onRefresh={recargar}
      ListEmptyComponent={<View style={styles.card}>
        <Text style={styles.detail}>{error ?? (vinculos ? "Aún no tienes seguidores ni invitaciones." : "Cargando seguidores…")}</Text>
        {!!error && <Boton texto="Reintentar" accion={recargar} />}
      </View>}
      renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
      renderItem={({ item }) => <TarjetaVinculo fila={item} ocupado={ocupado} avisar={avisar}
        confirmar={confirmar === item.id} seleccionar={setConfirmar} ejecutar={ejecutar} recargar={recargar} />}
    />
    {modal && <FormularioInvitacion cerrar={() => mostrarModal(false)} recargar={recargar} informar={avisar} />}

  </View>;
}

function FormularioInvitacion({ cerrar, recargar, informar }: {
  cerrar: () => void; recargar: () => void; informar: (mensaje: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [creada, setCreada] = useState<Vinculo | null>(null);
  const [aviso, avisar] = useState("");
  const [estadoCorreo, setEstadoCorreo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const bloqueo = useRef(false);

  function informarCorreo(mensaje: string) {
    setEstadoCorreo(mensaje);
    informar(mensaje);
  }
  function crear() {
    if (!nombre.trim()) { avisar("Escribe el nombre o parentesco."); return; }
    if (email.trim() && !/^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/.test(email.trim())) {
      avisar("Revisa el correo electrónico."); return;
    }
    if (bloqueo.current) return;
    bloqueo.current = true;
    setOcupado(true);
    avisar("");
    async function guardar() {
      const fila = await crearInvitacion(nombre, email, telefono);
      setCreada(fila); recargar();
      if (fila.email) {
        setEstadoCorreo("Enviando el correo…");
        try { await enviarInvitacion(fila.id); informarCorreo("Correo enviado."); }
        catch { informarCorreo("La invitación está lista. Falló el correo. Puedes compartir el código o reenviarlo desde la lista."); }
      }
    }
    void guardar().catch(e => avisar(e instanceof Error ? e.message : "No se pudo crear la invitación."))
      .finally(() => { bloqueo.current = false; setOcupado(false); });
  }
  return (
    <Modal visible onRequestClose={() => { if (!ocupado || creada) cerrar(); }} animationType="slide">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[
          styles.body, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
        ]}>
          <Text style={styles.section}>{creada ? "Invitación creada" : "Invitar seguidor"}</Text>
          {creada ? <>
            <Text style={styles.name}>{creada.nombre}</Text>
            <Codigo fila={creada} avisar={avisar} />
            {!!estadoCorreo && <Text accessibilityLiveRegion="polite" style={styles.detail}>{estadoCorreo}</Text>}
          </> : <>
            <Text style={styles.name}>Nombre o parentesco</Text>
            <TextInput accessibilityLabel="Nombre o parentesco" style={styles.input} value={nombre} onChangeText={setNombre} maxLength={120} />
            <Text style={styles.name}>Correo electrónico (opcional)</Text>
            <TextInput accessibilityLabel="Correo electrónico" style={styles.input} value={email} onChangeText={setEmail}
              autoCapitalize="none" autoCorrect={false} keyboardType="email-address" maxLength={254} />
            <Text style={styles.name}>Teléfono (opcional)</Text>
            <TextInput accessibilityLabel="Teléfono" style={styles.input} value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" />
            <Boton principal texto={ocupado ? "Creando…" : "Crear invitación"} accion={crear} desactivado={ocupado} />
          </>}
          {!!aviso && <Text accessibilityLiveRegion="polite" style={styles.aviso}>{aviso}</Text>}
          <Boton texto="Cerrar" accion={cerrar} desactivado={ocupado && !creada} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type PropiedadesTarjeta = {
  fila: Vinculo;
  ocupado: boolean;
  confirmar: boolean;
  avisar: (mensaje: string) => void;
  seleccionar: (id: string | null) => void;
  ejecutar: (accion: () => Promise<void>) => Promise<void>;
  recargar: () => void;
};

function TarjetaVinculo({ fila, ocupado, confirmar, avisar, seleccionar, ejecutar, recargar }: PropiedadesTarjeta) {
  const pendiente = fila.estado === "pendiente";
  const reenviar = () => ejecutar(async () => {
    await enviarInvitacion(fila.id);
    avisar("Correo enviado.");
  });
  const revocar = () => ejecutar(async () => {
    await revocarSeguidor(fila.id);
    seleccionar(null);
    recargar();
  });
  return <View style={styles.card}>
    <Text style={styles.name}>{fila.nombre}</Text>
    {!!fila.email && <Text selectable style={styles.detail}>{fila.email}</Text>}
    {pendiente && <Codigo fila={fila} avisar={avisar}>
      {!!fila.email && <Boton texto="Reenviar correo" accion={reenviar} desactivado={ocupado} />}
    </Codigo>}
    {confirmar ? <>
      <Text style={styles.detail}>{pendiente ? "¿Cancelar esta invitación?" : "¿Retirar el acceso a tus recorridos?"}</Text>
      <View style={styles.actions}>
        <Boton texto="Confirmar" accion={revocar} desactivado={ocupado} />
        <Boton texto="Volver" accion={() => seleccionar(null)} desactivado={ocupado} />
      </View>
    </> : <Boton texto={pendiente ? "Cancelar" : "Revocar"} accion={() => seleccionar(fila.id)} desactivado={ocupado} />}
  </View>;
}
