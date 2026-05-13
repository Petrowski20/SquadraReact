import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseStorage = Platform.OS === "web"
  ? {
      getItem: (key: string) => {
        if (typeof window === "undefined") return Promise.resolve(null);
        return Promise.resolve(localStorage.getItem(key));
      },
      setItem: (key: string, value: string) => {
        if (typeof window === "undefined") return Promise.resolve();
        return Promise.resolve(localStorage.setItem(key, value));
      },
      removeItem: (key: string) => {
        if (typeof window === "undefined") return Promise.resolve();
        return Promise.resolve(localStorage.removeItem(key));
      },
    }
  : AsyncStorage;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: supabaseStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});
