import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import "react-native-url-polyfill/auto";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

type StoragePersistente = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

// Fallback de memoria para SSR/web sin window. En cliente se usa AsyncStorage
// (localStorage en web), por lo que la sesión persiste entre aperturas.
const memoria = new Map<string, string>();
const almacenamientoMemoria: StoragePersistente = {
  async getItem(key) {
    return memoria.get(key) ?? null;
  },
  async setItem(key, value) {
    memoria.set(key, value);
  },
  async removeItem(key) {
    memoria.delete(key);
  },
};

const storage =
  Platform.OS === "web" && typeof window === "undefined"
    ? almacenamientoMemoria
    : AsyncStorage;

export const SUPABASE_URL = supabaseUrl;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Supabase recomienda pausar el auto-refresh en background y reanudarlo al
// volver a foreground. En web el refresh lo maneja el propio cliente.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (estado) => {
    if (estado === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
