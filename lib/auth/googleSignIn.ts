import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '../supabase';

export async function signInWithGoogle(): Promise<void> {
  const redirectTo = makeRedirectUri({ scheme: 'squadra' });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      skipBrowserRedirect: true,
      redirectTo,
    },
  });

  if (error || !data.url) throw error ?? new Error('No OAuth URL returned');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === 'success') {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(result.url);
    if (exchangeError) throw exchangeError;
  }
}
