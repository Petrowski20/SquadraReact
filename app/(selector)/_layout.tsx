import { Stack } from 'expo-router';

export default function SelectorLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Lista aquí las pantallas que tienes dentro de (selector) */}
      <Stack.Screen name="index" />
      <Stack.Screen name="crear-club" />
      <Stack.Screen name="unirse" />
      <Stack.Screen name="esperando" />
    </Stack>
  );
}