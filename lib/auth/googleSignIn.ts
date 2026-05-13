import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import { Platform } from "react-native";
import { supabase } from "../supabase";

WebBrowser.maybeCompleteAuthSession();

export async function signInWithGoogle() {
  if (Platform.OS === "web") {
    // Web: redirección completa de página, Supabase lo gestiona solo
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: typeof window !== "undefined"
          ? `${window.location.origin}/callback`
          : undefined,
      },
    });
    if (error) throw error;
    return null; // la página se redirige sola
  }

  // Móvil: flujo con WebBrowser
  const redirectTo = makeRedirectUri({ scheme: "squadra", path: "callback" });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });

  if (error || !data.url) throw error ?? new Error("No auth URL");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") return null;

  const { error: sessionError } = await supabase.auth.exchangeCodeForSession(result.url);
  if (sessionError) throw sessionError;

  return true;
}
