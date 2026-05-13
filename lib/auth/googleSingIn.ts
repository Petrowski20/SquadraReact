import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../supabase";

WebBrowser.maybeCompleteAuthSession();

export async function signInWithGoogle() {
  const redirectTo = makeRedirectUri({
    scheme: "squadra",
    path: "auth/callback",
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) throw error ?? new Error("No auth URL");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type !== "success") return null;

  const url = new URL(result.url);
  const code = url.searchParams.get("code");
  if (!code) throw new Error("No code in callback URL");

  const { error: sessionError } = await supabase.auth.exchangeCodeForSession(
    result.url,
  );
  if (sessionError) throw sessionError;

  return true;
}
