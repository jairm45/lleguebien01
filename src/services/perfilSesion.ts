import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

export type PerfilSesion = {
  id: string; rol: "estudiante" | "seguidor"; email: string | null;
  identificacion: string | null; nombre_completo: string | null; telefono: string | null;
  pais: string | null; ciudad: string | null; universidad: string | null; direccion: string | null;
};

export async function leerPerfil(id: string) {
  const { data, error } = await supabase.from("perfiles")
    .select("id,rol,email,identificacion,nombre_completo,telefono,pais,ciudad,universidad,direccion")
    .eq("id", id).maybeSingle<PerfilSesion>();
  if (error) throw new Error("No se pudo consultar tu perfil. Revisa tu conexión.");
  // Solo se conserva el destino de arranque de la cuenta estudiantil, sin datos personales.
  const claveArranque = "lleguebien:inicioEstudiante:" + id;
  if (data?.rol === "estudiante") {
    await AsyncStorage.setItem(claveArranque, data.identificacion ? "/estudiante/inicio" : "/datos-personales").catch(() => undefined);
  } else {
    await AsyncStorage.removeItem(claveArranque).catch(() => undefined);
  }
  return data;
}

export async function destinoEstudianteSinRed(id: string) {
  const ruta = await AsyncStorage.getItem("lleguebien:inicioEstudiante:" + id).catch(() => null);
  return ruta === "/estudiante/inicio" || ruta === "/datos-personales" ? ruta : null;
}

const clave = "lleguebien:invitacionPendiente";
export function extraerCodigo(valor: string) {
  const texto = valor.trim();
  if (/^[a-z0-9]{6}$/i.test(texto)) return texto.toUpperCase();
  const codigo = /(?:^|\s)lleguebien01:\/\/seguir\/?\?codigo=([a-z0-9]{6})(?=\s|$)/i.exec(texto)?.[1];
  return codigo?.toUpperCase() ?? null;
}
export const guardarCodigo = (codigo: string) => AsyncStorage.setItem(clave, codigo);
export const leerCodigo = () => AsyncStorage.getItem(clave);
export const borrarCodigo = () => AsyncStorage.removeItem(clave);

export async function destinoPerfil(perfil: PerfilSesion | null) {
  if (perfil?.rol !== "seguidor") return perfil?.identificacion ? "/estudiante/inicio" : "/datos-personales";
  if (!perfil.identificacion || !perfil.nombre_completo || !perfil.telefono) return "/familiar/datos";
  if (!perfil.pais || !perfil.ciudad) return "/familiar/ubicacion";
  const codigo = await leerCodigo();
  return codigo ? { pathname: "/familiar/invitacion" as const, params: { codigo } } : "/seguidor/inicio";
}
