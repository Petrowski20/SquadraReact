import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import LogoSimbolo from "../../components/LogoSimbolo";
import ScreenContainer from "../../components/ScreenContainer";
import { apiFetch } from "../../lib/api";
import i18n from "../../lib/i18n";
import { useAuthStore } from "../../lib/store";
import { useTheme } from "../../lib/useTheme";

// 🟢 AQUÍ ESTÁ EL ARREGLO: Añadimos STAFF al diccionario
const ROL_LABEL: Record<string, string> = {
  PRESIDENT: "Presidente",
  STAFF: "Entrenador", // 👈 ¡Fichaje estrella!
  COACH: "Entrenador", // Lo mantenemos por retrocompatibilidad
  PLAYER: "Jugador",
  RELATIVE: "Familiar",
  OTHER: "Miembro",
};

export default function SelectorIndex() {
  const c = useTheme();
  const { setActiveClub, setSeason } = useAuthStore();
  const profile = useAuthStore((s: any) => s.profile);
  const logout = useAuthStore((s: any) => s.logout);
  const themeMode = useAuthStore((s: any) => s.themeMode);
  const language = useAuthStore((s: any) => s.language);
  const setThemeMode = useAuthStore((s: any) => s.setThemeMode);
  const setLanguage = useAuthStore((s: any) => s.setLanguage);
  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  const handleLanguage = (lang: "es" | "en") => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
  };

  const [clubes, setClubes] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadAllData = useCallback(async (isPullToRefresh = false) => {
    if (isPullToRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const [resClubs, resReqs] = await Promise.all([
        apiFetch("/api/clubs/my-memberships"),
        apiFetch("/api/clubs/my-requests"),
      ]);

      if (resClubs.ok) setClubes(await resClubs.json());
      if (resReqs.ok) setRequests(await resReqs.json());
    } catch (e) {
      console.error("Error cargando selector:", e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAllData();
    }, [loadAllData]),
  );

  const handleSelectClub = async (m: any) => {
    try {
      setActiveClub(m.clubId, m.clubName, m.role, m.teamId, m.clubLogo);

      const res = await apiFetch(`/api/clubs/${m.clubId}/current-season`);
      if (res.ok) {
        const label = await res.text();
        setSeason(label, label);
      }
      router.replace("/inicio");
    } catch (e) {
      Alert.alert("Error", "No se pudo conectar con el club");
    }
  };

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={[styles.container, { backgroundColor: c.fondo }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadAllData(true)}
            tintColor={c.boton}
          />
        }
      >
        {/* ── Cabecera alineada a la derecha (igual que WebNavBar) ── */}
        <View style={styles.topRow}>
          {/* Chips de tema e idioma */}
          <View style={styles.chipsGroup}>
            {(
              [
                { value: "light", label: "☀️" },
                { value: "auto", label: "⚙️" },
                { value: "dark", label: "🌙" },
              ] as const
            ).map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.chip,
                  {
                    backgroundColor:
                      themeMode === opt.value ? c.boton : "transparent",
                    borderColor:
                      themeMode === opt.value ? c.boton : c.bordeInput,
                  },
                ]}
                onPress={() => setThemeMode(opt.value)}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: themeMode === opt.value ? "#fff" : c.texto },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
            <View
              style={[styles.dividerV, { backgroundColor: c.bordeInput }]}
            />
            {(["es", "en"] as const).map((lang) => (
              <TouchableOpacity
                key={lang}
                style={[
                  styles.chip,
                  {
                    backgroundColor:
                      language === lang ? c.boton : "transparent",
                    borderColor: language === lang ? c.boton : c.bordeInput,
                  },
                ]}
                onPress={() => handleLanguage(lang)}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: language === lang ? "#fff" : c.texto },
                  ]}
                >
                  {lang.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Perfil + logout */}
          <View
            style={[
              styles.profilePill,
              { backgroundColor: c.input, borderColor: c.bordeInput },
            ]}
          >
            <View
              style={[
                styles.profileAvatar,
                {
                  backgroundColor: `${c.boton}18`,
                  borderColor: `${c.boton}35`,
                  overflow: "hidden",
                },
              ]}
            >
              {profile?.photoUrl ? (
                <Image
                  source={{ uri: profile.photoUrl }}
                  style={{ width: 34, height: 34 }}
                  resizeMode="cover"
                />
              ) : (
                <Text style={[styles.profileAvatarText, { color: c.boton }]}>
                  {profile?.firstName?.charAt(0)?.toUpperCase() || "U"}
                </Text>
              )}
            </View>
            <View style={{ maxWidth: 140 }}>
              <Text
                style={[styles.profileName, { color: c.texto }]}
                numberOfLines={1}
              >
                {[profile?.firstName, profile?.lastName]
                  .filter(Boolean)
                  .join(" ") || "Usuario"}
              </Text>
              <Text
                style={[styles.profileEmail, { color: c.subtexto }]}
                numberOfLines={1}
              >
                {profile?.email || ""}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleLogout}
              style={[
                styles.logoutBtn,
                { borderColor: "#ef444435", backgroundColor: "#ef444410" },
              ]}
            >
              <Text
                style={{ color: "#ef4444", fontWeight: "600", fontSize: 13 }}
              >
                🚪 Salir
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.headerTextContainer}>
          <LogoSimbolo
            size={40}
            color={c.colorMarca}
            style={{ marginBottom: 8 }}
          />
          <Text style={[styles.tituloTexto, { color: c.colorMarca }]}>
            SQUADRA
          </Text>
        </View>

        <Text style={[styles.title, { color: c.texto }]}>Tus clubes</Text>

        {isLoading && !isRefreshing ? (
          <ActivityIndicator
            color={c.boton}
            size="large"
            style={{ marginVertical: 32 }}
          />
        ) : (
          <View style={styles.content}>
            {clubes.map((club, idx) => (
              <TouchableOpacity
                key={`${club.clubId}-${idx}`}
                style={[
                  styles.clubCard,
                  { backgroundColor: c.input, borderColor: c.bordeInput },
                ]}
                onPress={() => handleSelectClub(club)}
              >
                <View
                  style={[
                    styles.clubAvatar,
                    {
                      backgroundColor: `${c.boton}18`,
                      borderColor: `${c.boton}35`,
                    },
                  ]}
                >
                  <Text style={[styles.clubAvatarText, { color: c.boton }]}>
                    {club.clubName.charAt(0)}
                  </Text>
                </View>
                <View style={styles.clubInfo}>
                  <Text style={[styles.clubName, { color: c.texto }]}>
                    {club.clubName}
                  </Text>

                  {/* 🟢 Aquí es donde se aplica la traducción mágica */}
                  <Text style={[styles.clubRol, { color: c.subtexto }]}>
                    {ROL_LABEL[club.role] || "Miembro"}
                  </Text>
                </View>
                <Text style={[styles.clubArrow, { color: c.boton }]}>›</Text>
              </TouchableOpacity>
            ))}

            {requests.map((req) => (
              <TouchableOpacity
                key={req.id}
                style={[
                  styles.requestCard,
                  { backgroundColor: c.input, borderColor: c.bordeInput },
                ]}
                onPress={() => router.push("/(selector)/esperando")}
              >
                <Text style={{ fontSize: 20 }}>⏳</Text>
                <View style={styles.clubInfo}>
                  <Text
                    style={[styles.clubName, { color: c.texto, fontSize: 15 }]}
                  >
                    {req.clubName}
                  </Text>
                  <Text style={[styles.clubRol, { color: "#C9A84C" }]}>
                    Pendiente de aprobación
                  </Text>
                </View>
              </TouchableOpacity>
            ))}

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionCard, { backgroundColor: c.boton }]}
                onPress={() => router.push("/(selector)/crear-club")}
              >
                <Text style={styles.actionTitle}>🏆 Crear mi club</Text>
                <Text style={styles.actionArrow}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionCard,
                  {
                    backgroundColor: c.input,
                    borderWidth: 1,
                    borderColor: c.bordeInput,
                  },
                ]}
                onPress={() => router.push("/(selector)/unirse")}
              >
                <Text style={[styles.actionTitle, { color: c.texto }]}>
                  🔗 Unirme a un club
                </Text>
                <Text style={[styles.actionArrow, { color: c.subtexto }]}>
                  ›
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, paddingTop: 60 },

  topRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    marginBottom: 24,
    flexWrap: "wrap",
  },
  chipsGroup: { flexDirection: "row", alignItems: "center", gap: 6 },
  dividerV: { width: 1, height: 20, marginHorizontal: 2 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  chipText: { fontSize: 12, fontWeight: "600" },
  profilePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  profileAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarText: { fontSize: 15, fontWeight: "bold" },
  profileName: { fontSize: 13, fontWeight: "700" },
  profileEmail: { fontSize: 11, marginTop: 1 },
  logoutBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  headerTextContainer: { alignItems: "center", marginBottom: 30 },
  tituloTexto: {
    fontFamily: "SquadraStencil",
    fontSize: 32,
    textAlign: "center",
    letterSpacing: 2,
  },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 30 },
  content: { gap: 16 },
  clubCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 16,
  },
  clubAvatar: {
    width: 50,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  clubAvatarText: { fontSize: 22, fontWeight: "bold" },
  clubInfo: { flex: 1 },
  clubName: { fontSize: 17, fontWeight: "700" },
  clubRol: { fontSize: 13, marginTop: 2, textTransform: "capitalize" },
  clubArrow: { fontSize: 24, fontWeight: "300" },
  requestCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 14,
    borderStyle: "dashed",
  },
  actions: { marginTop: 20, gap: 12 },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    borderRadius: 16,
    gap: 16,
  },
  actionTitle: { color: "white", fontSize: 16, fontWeight: "700", flex: 1 },
  actionArrow: { color: "white", fontSize: 20, opacity: 0.8 },
});
