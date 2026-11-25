import { router } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { Pantalla, Campo, Boton, Aviso, ui, useOperacion } from "../../components/seguidor/Controles";
import { useSesion } from "../../context/SesionContext";
import { destinoPerfil } from "../../services/perfilSesion";
import { supabase } from "../../services/supabase";

export default function AccesoFamiliar() {
  const { session, actualizarPerfil } = useSesion();
  const [correo, setCorreo] = useState("");
  const [pin, setPin] = useState("");
  const [mensaje, informar] = useState("");
  const { ejecutar, ocupado, error } = useOperacion();

  async function continuar() {
    let usuario = session?.user;
    if (!usuario) {
      const email = correo.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Escribe un correo válido.");
      if (!/^\d{6}$/.test(pin)) throw new Error("Escribe un PIN de seis dígitos.");
      const credenciales = { email, password: pin };
      const login = await supabase.auth.signInWithPassword(credenciales);
      if (login.error && login.error.code !== "invalid_credentials" && login.error.message !== "Invalid login credentials")
        throw new Error("No se pudo iniciar sesión. Revisa tu conexión y la confirmación de tu correo.");
      usuario = login.data.user ?? undefined;
      if (!usuario) {
        const alta = await supabase.auth.signUp({ ...credenciales, options: { data: { rol_solicitado: "seguidor" } } });
        if (alta.error || alta.data.user?.identities?.length === 0) throw new Error("Revisa tu PIN o usa la recuperación de cuenta.");
        if (!alta.data.session) { informar("Confirma tu correo y vuelve a iniciar sesión."); return; }
        usuario = alta.data.session.user;
      }
    }
    // El rol existente prevalece incluso si se eligió otra tarjeta en P01.
    const { error: escritura } = await supabase.from("perfiles").upsert({
      id: usuario.id, email: usuario.email, rol: "seguidor",
    }, { onConflict: "id", ignoreDuplicates: true });
    if (escritura) throw new Error("No se pudo preparar tu perfil.");
    const perfil = await actualizarPerfil(usuario.id);
    router.replace(await destinoPerfil(perfil));
  }
  return <Pantalla titulo="Accede a tu cuenta" detalle="Seguidor o familiar">
    {session ? <Text style={ui.texto}>{session.user.email}</Text> : <>
      <Campo titulo="Correo electrónico" value={correo} onChangeText={setCorreo} autoCapitalize="none"
        autoCorrect={false} keyboardType="email-address" autoComplete="email" />
      <Campo titulo="PIN de 6 dígitos" value={pin} onChangeText={v => setPin(v.replace(/\D/g, ""))}
        maxLength={6} secureTextEntry keyboardType="number-pad" />
      <Text style={ui.texto}>Si es tu primera vez, crearemos tu cuenta con este correo y PIN.</Text>
    </>}
    <Aviso mensaje={error} />{!!mensaje && <Text style={ui.texto}>{mensaje}</Text>}
    <Boton titulo={ocupado ? "Entrando…" : "Continuar"} desactivado={ocupado} accion={() => ejecutar(continuar)} />
    <Boton secundario titulo="¿Olvidaste tu PIN?" accion={() => router.push({ pathname: "/rol/recuperar/solicitar", params: { rol: "seguidor" } })} />
    <Boton secundario titulo="Volver al inicio" accion={() => router.replace("/")} />
  </Pantalla>;
}
