import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { apiFetch } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { useTheme } from "../../lib/useTheme";
import ScreenContainer from "../../components/ScreenContainer";

type FiltroTipo = "TODOS" | "PARTIDO" | "ENTRENAMIENTO";

export default function Horarios() {
  const c = useTheme();

  const clubId = useAuthStore((s: any) => s.activeClubId);
  const activeTeamId = useAuthStore((s: any) => s.activeTeamId);
  const activeRole = useAuthStore((s: any) => s.activeRole);
  const seasonLabel = useAuthStore((s: any) => s.activeSeasonName);

  // ── STATE ─────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [eventos, setEventos] = useState<any[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("TODOS");

  // 🟢 MAGIA AQUÍ: Inicializamos directamente con el equipo del Zustand
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(
    activeRole === "PRESIDENT" ? null : (activeTeamId || null)
  );

  // ── CARGAR LISTA DE EQUIPOS DEL CLUB ─────────────────────────────────────
  useEffect(() => {
    if (!clubId) return;
    apiFetch(`/api/club/equipos/${clubId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: any[]) => {
        setTeams(data);
      })
      .catch(() => {});
  }, [clubId]);

  // ── CARGAR EVENTOS ────────────────────────────────────────────────────────
  const fetchEventos = useCallback(async () => {
    if (!clubId || !seasonLabel) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const now = new Date();
      let url = `/api/eventos/calendario?clubId=${clubId}&year=${now.getFullYear()}&month=${now.getMonth() + 1}&seasonLabel=${seasonLabel}`;
      if (selectedTeamId !== null) url += `&teamId=${selectedTeamId}`;

      const res = await apiFetch(url);
      const data = res.status === 204 ? [] : res.ok ? await res.json() : [];
      setEventos(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error cargando horarios:", e);
      setEventos([]);
    } finally {
      setLoading(false);
    }
  }, [clubId, seasonLabel, selectedTeamId]);

  useEffect(() => {
    fetchEventos();
  }, [fetchEventos]);

  // ── FILTRAR Y AGRUPAR ─────────────────────────────────────────────────────
  const eventosAgrupados = useMemo(() => {
    let filtrados = eventos.filter(
      (e) => filtroTipo === "TODOS" || e.tipo === filtroTipo,
    );
    // Filtrado en cliente como respaldo (por si el endpoint no soporta teamId)
    if (selectedTeamId !== null) {
      filtrados = filtrados.filter(
        (e) => e.teamId === selectedTeamId || e.team_id === selectedTeamId,
      );
    }
    const grupos: Record<string, any[]> = {};
    filtrados.forEach((e) => {
      const d = new Date(e.fecha?.split("/").reverse().join("-") || e.date);
      const label = d.toLocaleString("es-ES", {
        month: "long",
        year: "numeric",
      });
      const key = label.charAt(0).toUpperCase() + label.slice(1);
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(e);
    });
    return grupos;
  }, [eventos, filtroTipo, selectedTeamId]);

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <ScreenContainer>
      <View style={[styles.wrapper, { backgroundColor: c.fondo }]}>
      {/* ─── FILTRO TIPO (Tabs superior) ──────────────────────────────────── */}
      <View style={[styles.tabBar, { borderBottomColor: c.bordeInput }]}>
        {(["TODOS", "PARTIDO", "ENTRENAMIENTO"] as FiltroTipo[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.tabBtn,
              filtroTipo === f && {
                borderBottomColor: c.boton,
                borderBottomWidth: 2,
              },
            ]}
            onPress={() => setFiltroTipo(f)}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: filtroTipo === f ? c.boton : c.subtexto,
                  fontWeight: filtroTipo === f ? "bold" : "600",
                },
              ]}
            >
              {f === "TODOS"
                ? "Todos"
                : f === "PARTIDO"
                  ? "Partidos"
                  : "Entrenos"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ─── SELECTOR DE EQUIPO ───────────────────────────────────────────── */}
      {teams.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={styles.teamScroll}
        >
          {/* "Todos los equipos" — solo visible para roles con visibilidad global */}
          {activeRole !== "RELATIVE" && (
            <TouchableOpacity
              style={[
                styles.teamChip,
                {
                  backgroundColor: selectedTeamId === null ? c.boton : c.input,
                  borderColor: selectedTeamId === null ? c.boton : c.bordeInput,
                },
              ]}
              onPress={() => setSelectedTeamId(null)}
            >
              <Text
                style={{
                  color: selectedTeamId === null ? "#fff" : c.texto,
                  fontWeight: "600",
                  fontSize: 12,
                }}
              >
                🏟 Todos los equipos
              </Text>
            </TouchableOpacity>
          )}

          {teams.map((t: any) => {
            const selected = selectedTeamId === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.teamChip,
                  {
                    backgroundColor: selected ? c.boton : c.input,
                    borderColor: selected ? c.boton : c.bordeInput,
                  },
                ]}
                onPress={() => setSelectedTeamId(t.id)}
              >
                <Text
                  style={{
                    color: selected ? "#fff" : c.texto,
                    fontWeight: "600",
                    fontSize: 12,
                  }}
                >
                  {t.category} {t.suffix}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* ─── LISTA DE EVENTOS ─────────────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchEventos}
            tintColor={c.boton}
          />
        }
      >
        {loading && eventos.length === 0 ? (
          <ActivityIndicator
            size="large"
            color={c.boton}
            style={{ marginTop: 40 }}
          />
        ) : Object.keys(eventosAgrupados).length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: c.input, borderColor: c.bordeInput },
            ]}
          >
            <Text style={{ fontSize: 30, marginBottom: 8 }}>📅</Text>
            <Text
              style={{ color: c.subtexto, textAlign: "center", fontSize: 15 }}
            >
              No hay{" "}
              {filtroTipo === "TODOS"
                ? "eventos"
                : filtroTipo.toLowerCase() + "s"}{" "}
              programados.
            </Text>
          </View>
        ) : (
          Object.entries(eventosAgrupados).map(([mes, evList]) => (
            <View key={mes} style={styles.mesGroup}>
              <Text style={[styles.mesTitle, { color: c.texto }]}>{mes}</Text>
              <View style={styles.eventosList}>
                {evList.map((ev, idx) => {
                  const esPartido = ev.tipo === "PARTIDO";
                  const borde = esPartido ? "#16a34a" : "#3b82f6";
                  return (
                    <View
                      key={ev.id || idx}
                      style={[
                        styles.eventoCard,
                        { backgroundColor: c.input, borderLeftColor: borde },
                      ]}
                    >
                      {/* Cabecera */}
                      <View style={styles.eventoHeader}>
                        <Text style={[styles.eventoTitulo, { color: c.texto }]}>
                          {esPartido ? "⚽" : "🏃"} {ev.titulo}
                        </Text>
                        {esPartido && ev.resultado && (
                          <View
                            style={[
                              styles.resultadoBadge,
                              { backgroundColor: c.fondo },
                            ]}
                          >
                            <Text
                              style={[styles.resultadoText, { color: c.texto }]}
                            >
                              {ev.resultado}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Equipo (cuando se ven todos) */}
                      {selectedTeamId === null && ev.teamName && (
                        <View
                          style={[
                            styles.teamBadge,
                            { backgroundColor: `${c.boton}15` },
                          ]}
                        >
                          <Text
                            style={[styles.teamBadgeText, { color: c.boton }]}
                          >
                            👕 {ev.teamName}
                          </Text>
                        </View>
                      )}

                      {/* Info */}
                      <View style={styles.eventoInfoRow}>
                        <Text
                          style={[styles.eventoText, { color: c.subtexto }]}
                        >
                          📅 {ev.fecha}
                        </Text>
                        <Text
                          style={[styles.eventoText, { color: c.subtexto }]}
                        >
                          🕒 {ev.horaInicio}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.eventoText,
                          { color: c.subtexto, marginTop: 4 },
                        ]}
                      >
                        📍 {ev.campo || ev.location || "Campo por confirmar"}
                      </Text>

                      {/* Badges (partidos) */}
                      {esPartido && (
                        <View style={styles.badgesRow}>
                          <View
                            style={[
                              styles.badge,
                              {
                                backgroundColor: "#f59e0b18",
                                borderColor: "#f59e0b35",
                              },
                            ]}
                          >
                            <Text
                              style={[styles.badgeText, { color: "#f59e0b" }]}
                            >
                              {ev.tipoPartido || "Liga"}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.badge,
                              {
                                backgroundColor: `${c.boton}18`,
                                borderColor: `${c.boton}35`,
                              },
                            ]}
                          >
                            <Text
                              style={[styles.badgeText, { color: c.boton }]}
                            >
                              {ev.isLocal ? "🏠 Local" : "🚌 Visitante"}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 60,
    paddingBottom: 0,
    borderBottomWidth: 1,
  },
  tabBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: { fontSize: 14 },
  teamScroll: { paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  teamChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  container: { padding: 20, paddingBottom: 40 },
  emptyCard: {
    padding: 40,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 40,
    borderStyle: "dashed",
    alignItems: "center",
  },
  mesGroup: { marginBottom: 24 },
  mesTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    textTransform: "capitalize",
  },
  eventosList: { gap: 12 },
  eventoCard: {
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 5,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  eventoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  eventoTitulo: { fontSize: 16, fontWeight: "bold", flex: 1 },
  resultadoBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  resultadoText: { fontSize: 14, fontWeight: "bold", letterSpacing: 1 },
  teamBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 8,
  },
  teamBadgeText: { fontSize: 11, fontWeight: "700" },
  eventoInfoRow: { flexDirection: "row", gap: 16 },
  eventoText: { fontSize: 13 },
  badgesRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  badge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 11, fontWeight: "bold", textTransform: "uppercase" },
});