import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { apiFetch } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { useTheme } from "../../lib/useTheme";

export default function Inicio() {
  const c = useTheme();
  const router = useRouter();

  // ── STORE ─────────────────────────────────────────────────────────────────
  const profile = useAuthStore((s: any) => s.profile);
  const clubId = useAuthStore((s: any) => s.activeClubId);
  const clubName = useAuthStore((s: any) => s.activeClubName || "Mi Club");
  const clubLogo = useAuthStore((s: any) => s.activeClubLogo);
  const teamName = useAuthStore((s: any) => s.activeTeamName);
  const seasonLabel = useAuthStore((s: any) => s.activeSeasonName || "");
  const activeTeamId = useAuthStore((s: any) => s.activeTeamId);
  const activeRole = useAuthStore((s: any) => s.activeRole);

  const isPresident = activeRole === "PRESIDENT";

  const bgImage = c.isDark
    ? require("../../assets/images/inicio-oscuro-1.jpg")
    : require("../../assets/images/inicio-claro-1.png");
  const overlayColor = c.isDark
    ? "rgba(0,0,0,0.75)"
    : "rgba(255, 255, 255, 0.35)";
  const cardBg = c.isDark ? "rgba(35,35,35,0.70)" : "rgba(255,255,255,0.80)";

  // ── STATE ─────────────────────────────────────────────────────────────────
  const [saludo, setSaludo] = useState("");
  const [ultimoAnuncio, setUltimoAnuncio] = useState<any>(null);
  const [proximosEventos, setProximos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hayEquipos, setHayEquipos] = useState(false);

  // ── SALUDO ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = new Date().getHours();
    setSaludo(
      h >= 6 && h < 12
        ? "Buenos días"
        : h >= 12 && h < 20
          ? "Buenas tardes"
          : "Buenas noches",
    );
  }, []);

  // ── DATOS ─────────────────────────────────────────────────────────────────
  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      if (!clubId || !seasonLabel) {
        setLoading(false);
        return;
      }

      if (isPresident) {
        const resTeams = await apiFetch(`/api/president/club/${clubId}/teams`);
        if (resTeams.ok) {
          const teams = await resTeams.json();
          setHayEquipos(teams.length > 0);
          if (teams.length === 0) {
            setLoading(false);
            return;
          }
        }
      } else if (!activeTeamId) {
        setLoading(false);
        return;
      }

      // 🟢 CORRECCIÓN: Añadido clubId y teamId a la URL
      let url = `/api/dashboard?clubId=${clubId}&seasonLabel=${seasonLabel}`;
      if (!isPresident && activeTeamId) url += `&teamId=${activeTeamId}`;

      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        setUltimoAnuncio(data.ultimoAnuncio || null);
        setProximos(data.proximosEventos || []);
        if (!isPresident) setHayEquipos(true);
      }
    } catch (e) {
      console.error("Error dashboard:", e);
    } finally {
      setLoading(false);
    }
  }, [clubId, seasonLabel, activeTeamId, activeRole, isPresident]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // ── RENDER ────────────────────────────────────────────────────────────────
  const sinDatos = isPresident ? !hayEquipos : !activeTeamId;

  return (
    <ImageBackground
      source={bgImage}
      style={styles.bgImage}
      resizeMode="cover"
      blurRadius={10}
    >
      <View style={[styles.overlay, { backgroundColor: overlayColor }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── CABECERA ─────────────────────────────────────────────────────── */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.saludo, { color: c.subtexto }]}>
                {saludo},
              </Text>
              <Text style={[styles.userName, { color: c.texto }]}>
                {profile?.firstName || (isPresident ? "Presidente" : "Usuario")}{" "}
                👋
              </Text>
            </View>
            {clubLogo ? (
              <Image source={{ uri: clubLogo }} style={styles.clubLogo} />
            ) : (
              <View
                style={[
                  styles.clubLogo,
                  {
                    backgroundColor: c.input,
                    justifyContent: "center",
                    alignItems: "center",
                  },
                ]}
              >
                <Text style={{ fontSize: 20 }}>🛡️</Text>
              </View>
            )}
          </View>

          <Text style={[styles.clubName, { color: c.texto }]}>{clubName}</Text>

          {/* Chips */}
          {(activeTeamId || isPresident) && (
            <View style={styles.chipsRow}>
              {seasonLabel ? (
                <View
                  style={[styles.chip, { backgroundColor: `${c.boton}20` }]}
                >
                  <Text style={[styles.chipText, { color: c.boton }]}>
                    📅 {seasonLabel}
                  </Text>
                </View>
              ) : null}
              {activeTeamId ? (
                <View
                  style={[styles.chip, { backgroundColor: `${c.boton}20` }]}
                >
                  <Text style={[styles.chipText, { color: c.boton }]}>
                    👕 {teamName || "Equipo"}
                  </Text>
                </View>
              ) : isPresident ? (
                <View
                  style={[styles.chip, { backgroundColor: `${c.boton}20` }]}
                >
                  <Text style={[styles.chipText, { color: c.boton }]}>
                    👑 Presidencia
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          {/* ─── CONTENIDO ─────────────────────────────────────────────────── */}
          {loading ? (
            <ActivityIndicator
              size="large"
              color={c.boton}
              style={{ marginTop: 40 }}
            />
          ) : sinDatos ? (
            /* Pantalla vacía */
            <View style={[styles.noTeamCard, { backgroundColor: cardBg }]}>
              <Text style={{ fontSize: 40, marginBottom: 10 }}>🏟️</Text>
              <Text style={[styles.noTeamTitle, { color: c.texto }]}>
                {isPresident ? "¡Bienvenido, Presidente!" : "¡Bienvenido!"}
              </Text>
              <Text style={[styles.noTeamSub, { color: c.subtexto }]}>
                {isPresident
                  ? "El siguiente paso es crear tu primer equipo desde el menú de gestión."
                  : "Aún no tienes un equipo asignado. Espera a que el club te añada."}
              </Text>
              {isPresident && (
                <TouchableOpacity
                  style={[styles.btnCrear, { backgroundColor: c.boton }]}
                  onPress={() => router.push("/(club)/gestion-presidente")}
                >
                  <Text style={styles.btnCrearText}>Ir a Gestión</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            /* Dashboard normal */
            <>
              {/* ── Último anuncio ── */}
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: c.texto }]}>
                  Último Anuncio
                </Text>
                <TouchableOpacity onPress={() => router.push("/tablon")}>
                  <Text style={[styles.linkText, { color: c.boton }]}>
                    Ver tablón
                  </Text>
                </TouchableOpacity>
              </View>

              {ultimoAnuncio ? (
                <TouchableOpacity
                  style={[
                    styles.card,
                    { backgroundColor: cardBg, borderColor: c.bordeInput },
                  ]}
                  onPress={() => router.push("/tablon")}
                >
                  <Text style={[styles.anuncioTitulo, { color: c.texto }]}>
                    📌 {ultimoAnuncio.titulo}
                  </Text>
                  <Text
                    style={[styles.anuncioResumen, { color: c.subtexto }]}
                    numberOfLines={2}
                  >
                    {ultimoAnuncio.contenido}
                  </Text>
                  <View style={styles.anuncioMeta}>
                    <Text style={[styles.metaText, { color: c.subtexto }]}>
                      👤 {ultimoAnuncio.autor}
                    </Text>
                    <Text style={[styles.metaText, { color: c.subtexto }]}>
                      🕒 {ultimoAnuncio.fecha}
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <View
                  style={[
                    styles.card,
                    {
                      backgroundColor: cardBg,
                      opacity: 0.7,
                      borderStyle: "dashed",
                      borderColor: c.bordeInput,
                    },
                  ]}
                >
                  <Text style={{ color: c.subtexto, textAlign: "center" }}>
                    No hay anuncios para mostrar aún.
                  </Text>
                </View>
              )}

              {/* ── Próximos eventos ── */}
              <View style={[styles.sectionHeader, { marginTop: 30 }]}>
                <Text style={[styles.sectionTitle, { color: c.texto }]}>
                  Próximos Eventos
                </Text>
                <TouchableOpacity onPress={() => router.push("/calendario")}>
                  <Text style={[styles.linkText, { color: c.boton }]}>
                    Ver todos
                  </Text>
                </TouchableOpacity>
              </View>

              {proximosEventos.length > 0 ? (
                <View style={{ gap: 8 }}>
                  {proximosEventos.map((ev, idx) => (
                    <View
                      key={ev.id || idx}
                      style={[
                        styles.card,
                        {
                          backgroundColor: cardBg,
                          borderLeftWidth: 4,
                          borderLeftColor:
                            ev.tipo === "PARTIDO" ? c.boton : "#3b82f6",
                          borderColor: "transparent",
                        },
                      ]}
                    >
                      <Text style={[styles.eventoTitulo, { color: c.texto }]}>
                        {ev.tipo === "PARTIDO" ? "⚽" : "🏃"} {ev.titulo}
                      </Text>
                      {ev.teamName && (
                        <Text
                          style={[
                            styles.metaText,
                            { color: c.subtexto, marginBottom: 4 },
                          ]}
                        >
                          👕 {ev.teamName}
                        </Text>
                      )}
                      <Text style={[styles.metaText, { color: c.subtexto }]}>
                        📅 {ev.fecha} · 🕒 {ev.horaInicio}
                      </Text>
                      {(ev.campo || ev.location) && (
                        <Text
                          style={[
                            styles.metaText,
                            { color: c.subtexto, marginTop: 2 },
                          ]}
                        >
                          📍 {ev.campo || ev.location}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              ) : (
                <View
                  style={[
                    styles.card,
                    {
                      backgroundColor: cardBg,
                      opacity: 0.7,
                      borderStyle: "dashed",
                      borderColor: c.bordeInput,
                    },
                  ]}
                >
                  <Text style={{ color: c.subtexto, textAlign: "center" }}>
                    No hay eventos programados.
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bgImage: { flex: 1, width: "100%", height: "100%" },
  overlay: { flex: 1 },
  scrollView: { flex: 1 },
  container: { padding: 24, paddingTop: 60, paddingBottom: 40 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  saludo: { fontSize: 16, fontWeight: "500" },
  userName: { fontSize: 24, fontWeight: "bold" },
  clubLogo: { width: 50, height: 50, borderRadius: 25 },
  clubName: { fontSize: 20, fontWeight: "bold", marginBottom: 15 },
  chipsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 30,
    flexWrap: "wrap",
  },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  chipText: { fontSize: 13, fontWeight: "bold" },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 15,
  },
  sectionTitle: { fontSize: 18, fontWeight: "bold" },
  linkText: { fontSize: 14, fontWeight: "600" },
  card: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  anuncioTitulo: { fontSize: 16, fontWeight: "bold", marginBottom: 6 },
  anuncioResumen: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  anuncioMeta: { flexDirection: "row", justifyContent: "space-between" },
  metaText: { fontSize: 12, fontWeight: "500" },
  eventoTitulo: { fontSize: 15, fontWeight: "bold", marginBottom: 6 },
  noTeamCard: {
    padding: 30,
    borderRadius: 20,
    alignItems: "center",
    marginTop: 20,
  },
  noTeamTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 10 },
  noTeamSub: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  btnCrear: { paddingHorizontal: 25, paddingVertical: 12, borderRadius: 12 },
  btnCrearText: { color: "white", fontWeight: "bold" },
});
