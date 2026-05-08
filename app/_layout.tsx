import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import "../lib/i18n";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../lib/store";

SplashScreen.preventAutoHideAsync();

const STORAGE_KEY = 'squadra-auth';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const token = useAuthStore((state) => state.token);

  const [fontsLoaded, fontError] = useFonts({
    'SquadraStencil': require('../assets/fonts/SquadraFont.ttf'),
  });

  // Native: ready immediately (state lives in memory while app runs).
  // Web: need to restore from localStorage before rendering anything.
  const [isReady, setIsReady] = useState(Platform.OS !== 'web');

  // Web: read persisted session from localStorage on first mount
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.token) {
          useAuthStore.setState(saved);
        }
      }
    } catch {
      // corrupted storage — ignore and start fresh
    } finally {
      setIsReady(true);
    }
  }, []);

  // Native: propagate Supabase OAuth sessions (Google sign-in) to the store
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const user = session.user;
        const fullName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? '';
        const parts = fullName.split(' ');
        const firstName = user.user_metadata?.given_name ?? parts[0] ?? '';
        const lastName = user.user_metadata?.family_name ?? parts.slice(1).join(' ') ?? '';

        useAuthStore.getState().setAuth(session.access_token, {
          userId: user.id,
          email: user.email ?? '',
          firstName,
          lastName,
          phone: user.phone ?? null,
          docType: null,
          docNumber: null,
          photoUrl: user.user_metadata?.avatar_url ?? null,
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Web: persist store changes to localStorage
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    return useAuthStore.subscribe((state) => {
      const {
        token, profile, activeRole, activeClubId, activeClubName,
        activeClubLogo, activeTeamId, activeSeasonId, activeSeasonName,
        themeMode, language,
      } = state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        token, profile, activeRole, activeClubId, activeClubName,
        activeClubLogo, activeTeamId, activeSeasonId, activeSeasonName,
        themeMode, language,
      }));
    });
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Auth guard: only redirect once fonts and persistence are ready
  useEffect(() => {
    if ((!fontsLoaded && !fontError) || !isReady) return;

    const inAuthGroup = segments[0] === "(auth)";
    if (!token && !inAuthGroup) {
      router.replace("/(auth)");
    } else if (token && inAuthGroup) {
      router.replace("/(selector)");
    }
  }, [token, fontsLoaded, fontError, isReady, segments]);

  if ((!fontsLoaded && !fontError) || !isReady) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(selector)" />
      <Stack.Screen name="(club)" />
    </Stack>
  );
}
