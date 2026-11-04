import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

const supabaseUrl = "https://kbthjrgbrkzbzmnrarnp.supabase.co";
const supabaseAnonKey = "sb_publishable_Y46VOogDdsXIKsewo8cxpg_cFDDVgJx";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
