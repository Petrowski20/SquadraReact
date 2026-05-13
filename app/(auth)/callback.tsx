import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { apiFetch } from "../../lib/api";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = window.location.href;
    console.log("[callback] URL completa:", url);

    const params = new URL(url);
    const code = params.searchParams.get("code");
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");

    console.log("[callback] code:", code);
    console.log("[callback] accessToken:", accessToken ? "presente" : "ausente");

    const navigateAfterAuth = (provider: string | undefined) => {
      if (provider === "google") {
        apiFetch("/profiles/me").then(async (res) => {
          if (!res.ok) {
            router.replace("/(completar-perfil)");
            return;
          }
          const profile = await res.json();
          if (!profile.phone || !profile.docNumber) {
            router.replace("/(completar-perfil)");
          } else {
            router.replace("/(selector)");
          }
        });
      } else {
        router.replace("/(selector)");
      }
    };

    if (code) {
      console.log("[callback] Intentando exchangeCodeForSession...");
      (async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        const { data, error } = await supabase.auth.exchangeCodeForSession(url);
        console.log("[callback] exchangeCodeForSession result - error:", error, "session:", data?.session?.user?.email);
        if (error) {
          console.error("[callback] Error en exchange:", error.message);
          router.replace("/login");
          return;
        }
        const provider = data.session?.user?.app_metadata?.provider;
        console.log("[callback] Provider:", provider);
        navigateAfterAuth(provider);
      })();
    } else if (accessToken && refreshToken) {
      console.log("[callback] Usando setSession con hash tokens...");
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ data, error }) => {
        console.log("[callback] setSession result - error:", error, "session:", data?.session?.user?.email);
        if (error) {
          router.replace("/login");
          return;
        }
        const provider = data.session?.user?.app_metadata?.provider;
        navigateAfterAuth(provider);
      });
    } else {
      console.error("[callback] No hay ni code ni tokens en la URL");
      router.replace("/login");
    }
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
