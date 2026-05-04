import React, { useState, useEffect, useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";
import {
  View, Text, TouchableOpacity, ScrollView, Modal, TextInput,
  StyleSheet, Alert, ActivityIndicator, Switch, KeyboardAvoidingView, Platform
} from "react-native";
import { apiFetch } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { useTheme } from "../../lib/useTheme";
import ScreenContainer from "../../components/ScreenContainer";

// Colores semánticos — no dependen del tema
const COLOR_PELIGRO  = "#ef4444"; 
const COLOR_EXITO    = "#16a34a"; 
const COLOR_NEUTRAL  = "#64748B"; 
const COLOR_AMARILLO = "#f59e0b"; 

type Tab = "ASISTENCIA" | "CONVOCATORIAS" | "STATS" | "MULTAS";

interface Player {
  id: number;
  firstName: string;
  lastName: string;
}

interface PlayerAttendanceItem {
  playerId: number;
  firstName: string;
  lastName: string;
  attended: boolean | null;
  absenceReason: string | null;
  positiveMark: boolean;
}

interface CallupEntry {
  playerId: number;
  firstName: string;
  lastName: string;
  status: "CALLED_UP" | "ABSENT" | "INJURED";
  absenceReason: string | null;
  attendancePercentage?: number;
  positiveMarksCount?: number;
}

interface StatsEntry {
  playerId: number;
  firstName: string;
  lastName: string;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  minutesPlayed: number;
  wasStarter: boolean;
}

interface Fine {
  id: number;
  playerId: number;
  playerName: string;
  reason: string;
  amount: number;
  issuedDate: string;
  status: "PENDING" | "PAID" | "FORGIVEN";
  seasonLabel: string;
}

interface CalendarEvent {
  id: number;
  type: "TRAINING" | "MATCH";
  startTime: string;
  title: string;
  teamId: number;
  teamName: string;
  location?: string;
}

// Configuración visual por estado de convocatoria
const CALLUP_STATUS_CFG = {
  CALLED_UP: { label: "CONV.",  activeColor: "#16a34a", activeBg: "#dcfce7", badgeText: "Convocado"    },
  ABSENT:    { label: "DESC.",  activeColor: "#dc2626", activeBg: "#fee2e2", badgeText: "Descartado"   },
  INJURED:   { label: "BAJA",   activeColor: "#d97706", activeBg: "#fef3c7", badgeText: "Baja / Lesión" },
} as const;

const formatEventLabel = (e: CalendarEvent): string => {
  const d = new Date(e.startTime);
  const day = String(d.getDate()).padStart(2, "0");
  const mon = String(d.getMonth() + 1).padStart(2, "0");
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (e.type === "TRAINING") {
    return e.location ? `${day}/${mon} · ${time}\n(${e.location})` : `${day}/${mon} · ${time}`;
  }
  return `${e.title}\n${day}/${mon} · ${time}`;
};

export default function GestionCoach() {
  const c = useTheme();
  const { activeClubId: clubId, activeTeamId: storeTeamId, activeSeasonName, activeRole } = useAuthStore();
  const isPresident = activeRole === "PRESIDENT";
  const seasonLabel = activeSeasonName || "24-25";

  const [activeTab, setActiveTab] = useState<Tab>("ASISTENCIA");

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Estados de datos
  const [teamPlayers, setTeamPlayers] = useState<Player[]>([]);
  const [attendance, setAttendance] = useState<PlayerAttendanceItem[]>([]);
  const [callups, setCallups] = useState<CallupEntry[]>([]);
  const [stats, setStats] = useState<StatsEntry[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);
  const [finesLoading, setFinesLoading] = useState(false);
  const [finesPage, setFinesPage] = useState(0);
  const [finesHasMore, setFinesHasMore] = useState(true);

  const [localTeamId, setLocalTeamId] = useState<number | null>(storeTeamId ?? null);
  const [teams, setTeams] = useState<{ id: number; label: string }[]>([]);

  const [saving, setSaving] = useState(false);

  // Eventos filtrados según el tab activo para que nunca se mezclen tipos
  const selectorEvents =
    activeTab === "ASISTENCIA" ? events.filter(e => e.type === "TRAINING") :
    (activeTab === "CONVOCATORIAS" || activeTab === "STATS") ? events.filter(e => e.type === "MATCH") :
    events;

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === "MULTAS") return;
    const relevant = tab === "ASISTENCIA"
      ? events.filter(e => e.type === "TRAINING")
      : events.filter(e => e.type === "MATCH");
    setSelectedEvent(relevant.length > 0 ? relevant[0] : null);
  };

  // Estados modales
  const [fineModal, setFineModal] = useState(false);
  const [fineTarget, setFineTarget] = useState<{ id: number; name: string } | null>(null);
  const [fineReason, setFineReason] = useState("");
  const [fineAmount, setFineAmount] = useState("");

  const [closeMatchModal, setCloseMatchModal] = useState(false);
  const [goalsFor, setGoalsFor] = useState("");
  const [goalsAgainst, setGoalsAgainst] = useState("");

  // ── FETCH ──────────────────────────────────────────────────────────────────

  // Carga la lista de equipos del club si el usuario es presidente
  useEffect(() => {
    if (!isPresident || !clubId) return;
    apiFetch(`/api/club/equipos/${clubId}`)
      .then(r => r.json())
      .then((data: any[]) => {
        const mapped = data
          .filter((t: any) => t.isActive)
          .map((t: any) => ({ id: t.id, label: `${t.category}${t.suffix ? " " + t.suffix : ""}` }));
        setTeams(mapped);
        if (!localTeamId && mapped.length > 0) setLocalTeamId(mapped[0].id);
      })
      .catch(() => {});
  }, [isPresident, clubId]);

  // Carga de eventos del equipo seleccionado
  const fetchEvents = useCallback(async () => {
    if (!localTeamId) return;
    setLoadingEvents(true);
    try {
      const now = new Date();
      const from = now.toISOString();
      const to = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const res = await apiFetch(`/api/calendar?clubId=${clubId}&teamId=${localTeamId}&seasonLabel=${seasonLabel}&from=${from}&to=${to}`);
      const data: CalendarEvent[] = await res.json();
      setEvents(data);
      setSelectedEvent(data.length > 0 ? data[0] : null);
    } catch {
      Alert.alert("Error", "No se pudieron cargar los eventos.");
    } finally {
      setLoadingEvents(false);
    }
  }, [clubId, localTeamId, seasonLabel]);

  const isMountedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!isMountedRef.current) {
        isMountedRef.current = true;
        return;
      }
      let isActive = true;
      fetchEvents();
      return () => { isActive = false; };
    }, [fetchEvents])
  );

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Novedad: Cargar jugadores reales del equipo activo
  useEffect(() => {
    if (!localTeamId) return;
    const fetchPlayers = async () => {
      try {
        const res = await apiFetch(`/api/teams/${localTeamId}/players?seasonLabel=${seasonLabel}&clubId=${clubId}`);
        const data = await res.json();
        setTeamPlayers(data);
      } catch (error) {
        console.error("Error cargando plantilla:", error);
      }
    };
    fetchPlayers();
  }, [localTeamId, seasonLabel, clubId]);

  // Al cambiar de equipo, limpia los datos de la sesión anterior
  useEffect(() => {
    setSelectedEvent(null);
    setAttendance([]);
    setCallups([]);
    setStats([]);
    setFineTarget(null); // Limpiar selecciones previas
  }, [localTeamId]);

  useEffect(() => {
    if (!selectedEvent) return;
    if (activeTab === "ASISTENCIA" && selectedEvent.type === "TRAINING") fetchAttendance();
    if (activeTab === "CONVOCATORIAS" && selectedEvent.type === "MATCH") fetchCallups();
    if (activeTab === "STATS" && selectedEvent.type === "MATCH") fetchStats();
  }, [selectedEvent, activeTab]);

  useEffect(() => { if (activeTab === "MULTAS") fetchFines(0); }, [activeTab]);

  const fetchAttendance = async () => {
    if (!selectedEvent) return;
    try {
      const res = await apiFetch(`/api/coach/training/${selectedEvent.id}/attendance?clubId=${clubId}`);
      const data = await res.json();
      setAttendance(data.players.map((p: any) => ({ ...p, positiveMark: p.positiveMark ?? false })));
    } catch {
      Alert.alert("Error", "No se pudo cargar la asistencia.");
    }
  };

  const fetchCallups = async () => {
    if (!selectedEvent) return;
    try {
      const res = await apiFetch(`/api/coach/match/callups/${selectedEvent.id}?clubId=${clubId}`);
      const data: CallupEntry[] = await res.json();
      setCallups(data.length > 0 ? data : []);
    } catch {}
  };

  const fetchStats = async () => {
    if (!selectedEvent) return;
    try {
      const res = await apiFetch(`/api/coach/match/${selectedEvent.id}/stats?clubId=${clubId}`);
      const data: StatsEntry[] = await res.json();
      setStats(data);
    } catch {}
  };

  const fetchFines = async (page: number) => {
    setFinesLoading(true);
    try {
      const res = await apiFetch(`/api/coach/fines?clubId=${clubId}&teamId=${localTeamId}&seasonLabel=${seasonLabel}&page=${page}&size=20`);
      const data = await res.json();
      const newFines: Fine[] = data.content;
      setFines(page === 0 ? newFines : prev => [...prev, ...newFines]);
      setFinesHasMore(!data.last);
      setFinesPage(page);
    } catch {
      Alert.alert("Error", "No se pudieron cargar las multas.");
    } finally { setFinesLoading(false); }
  };

  // ── ACCIONES ───────────────────────────────────────────────────────────────

  const handleSaveBulkAttendance = async () => {
    if (!selectedEvent) return;
    setSaving(true);
    try {
      await apiFetch(`/api/coach/training/attendance/bulk?clubId=${clubId}`, {
        method: "PUT",
        body: JSON.stringify({
          trainingId: selectedEvent.id,
          entries: attendance.map(p => ({
            playerId: p.playerId,
            attended: p.attended ?? false,
            absenceReason: p.absenceReason,
            positiveMark: p.positiveMark,
          })),
        }),
      });
      Alert.alert("Guardado", "Asistencia guardada.");
    } catch {
      Alert.alert("Error", "No se pudo guardar la asistencia.");
    } finally { setSaving(false); }
  };

  const handleSaveBulkCallups = async () => {
    if (!selectedEvent) return;
    setSaving(true);
    try {
      await apiFetch(`/api/coach/match/callups/bulk?clubId=${clubId}`, {
        method: "PUT",
        body: JSON.stringify({
          matchId: selectedEvent.id,
          entries: callups.map(entry => ({
            playerId: entry.playerId,
            status: entry.status,
            absenceReason: entry.absenceReason,
          })),
        }),
      });
      Alert.alert("Guardado", "Convocatoria guardada.");
    } catch {
      Alert.alert("Error", "No se pudo guardar.");
    } finally { setSaving(false); }
  };

  const handleSaveBulkStats = async () => {
    if (!selectedEvent) return;
    setSaving(true);
    try {
      await apiFetch(`/api/coach/match/${selectedEvent.id}/stats/bulk?clubId=${clubId}`, {
        method: "PUT",
        body: JSON.stringify({ entries: stats }),
      });
      Alert.alert("Guardado", "Estadísticas guardadas.");
    } catch {
      Alert.alert("Error", "No se pudieron guardar las estadísticas.");
    } finally { setSaving(false); }
  };

  const handleCloseMatch = async () => {
    if (!selectedEvent) return;
    try {
      await apiFetch(`/api/coach/match/${selectedEvent.id}/close?clubId=${clubId}`, {
        method: "PATCH",
        body: JSON.stringify({
          goalsFor: Number(goalsFor),
          goalsAgainst: Number(goalsAgainst),
        }),
      });
      setCloseMatchModal(false);
      Alert.alert("Cerrado", "Partido cerrado correctamente.");
    } catch { Alert.alert("Error", "No se pudo cerrar."); }
  };

  const handleCreateFine = async () => {
    if (!fineTarget || !fineReason || !fineAmount) {
      Alert.alert("Aviso", "Por favor rellena todos los campos y selecciona un jugador.");
      return;
    }
    try {
      await apiFetch(`/api/coach/fines?clubId=${clubId}`, {
        method: "POST",
        body: JSON.stringify({
          playerId: fineTarget.id,
          teamId: localTeamId,
          reason: fineReason,
          amount: parseFloat(fineAmount),
        }),
      });
      setFineModal(false);
      setFineReason("");
      setFineAmount("");
      setFineTarget(null);
      fetchFines(0);
    } catch { Alert.alert("Error", "No se pudo crear."); }
  };

  // ── RENDERS DE TABS ────────────────────────────────────────────────────────

  const renderAttendanceTab = () => (
    <View style={s.tabContent}>
      {selectedEvent?.type === "TRAINING" ? (
        <>
          {attendance.length === 0 ? (
            <Text style={[s.hintText, { color: c.subtexto }]}>Sin jugadores registrados.</Text>
          ) : attendance.map((item, idx) => (
            <View key={item.playerId} style={[s.playerRow, { backgroundColor: c.input }]}>
              <Text style={[s.playerName, { color: c.texto }]}>{item.firstName} {item.lastName}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TouchableOpacity onPress={() => {
                  const next = [...attendance];
                  next[idx].positiveMark = !next[idx].positiveMark;
                  setAttendance(next);
                }}>
                  <Text style={{ fontSize: 20, opacity: item.positiveMark ? 1 : 0.3 }}>⭐</Text>
                </TouchableOpacity>
                <Switch value={item.attended ?? false} onValueChange={(v) => {
                  const next = [...attendance];
                  next[idx].attended = v;
                  setAttendance(next);
                }} />
              </View>
            </View>
          ))}
          <TouchableOpacity
            style={[s.btnPrimary, { backgroundColor: c.boton, opacity: saving ? 0.6 : 1 }]}
            onPress={handleSaveBulkAttendance}
            disabled={saving}
          >
            <Text style={[s.btnPrimaryText, { color: c.botonTexto }]}>
              {saving ? "Guardando..." : "💾 Guardar asistencia"}
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={[s.hintText, { color: c.subtexto }]}>Selecciona un entrenamiento en el calendario superior.</Text>
      )}
    </View>
  );

  const renderConvocatorias = () => (
    <View style={s.tabContent}>
      {selectedEvent?.type === "MATCH" ? (
        <>
          {callups.length === 0 ? (
            <Text style={[s.hintText, { color: c.subtexto }]}>Sin convocados aún.</Text>
          ) : callups.map((item, idx) => (
            <View key={item.playerId} style={[s.playerRow, { backgroundColor: c.input, alignItems: "center" }]}>

              {/* ── Lado izquierdo: nombre + stats + badge de estado ── */}
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[s.playerName, { color: c.texto }]} numberOfLines={1}>
                  {item.firstName} {item.lastName}
                </Text>

                {(item.attendancePercentage != null || item.positiveMarksCount != null) && (
                  <Text style={{ fontSize: 11, color: c.subtexto, marginTop: 2 }}>
                    {[
                      item.attendancePercentage != null ? `${item.attendancePercentage}% Asist.` : null,
                      item.positiveMarksCount != null ? `⭐ ${item.positiveMarksCount}` : null,
                    ].filter(Boolean).join(" | ")}
                  </Text>
                )}

                {/* Badge de estado — feedback visual inmediato (Task 2) */}
                <Text style={[s.callupStatusBadge, { color: CALLUP_STATUS_CFG[item.status].activeColor }]}>
                  ● {CALLUP_STATUS_CFG[item.status].badgeText}
                </Text>
              </View>

              {/* ── Lado derecho: chips de selección ── */}
              <View style={s.callupChipsRow}>
                {(["CALLED_UP", "ABSENT", "INJURED"] as const).map(st => {
                  const cfg  = CALLUP_STATUS_CFG[st];
                  const active = item.status === st;
                  return (
                    <TouchableOpacity
                      key={st}
                      accessibilityLabel={cfg.badgeText}
                      accessibilityRole="button"
                      style={[
                        s.callupChip,
                        {
                          borderColor:     cfg.activeColor,
                          backgroundColor: active ? cfg.activeBg : "transparent",
                        },
                      ]}
                      onPress={() => {
                        const next = [...callups];
                        next[idx] = { ...next[idx], status: st };
                        setCallups(next);
                      }}
                    >
                      <Text style={[
                        s.callupChipText,
                        { color: active ? cfg.activeColor : c.subtexto,
                          fontWeight: active ? "800" : "600" },
                      ]}>
                        {cfg.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

            </View>
          ))}

          <TouchableOpacity
            style={[s.btnPrimary, { backgroundColor: c.boton, opacity: saving ? 0.6 : 1 }]}
            onPress={handleSaveBulkCallups}
            disabled={saving}
          >
            <Text style={[s.btnPrimaryText, { color: c.botonTexto }]}>
              {saving ? "Guardando..." : "💾 Guardar convocatoria"}
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={[s.hintText, { color: c.subtexto }]}>Selecciona un partido en el calendario superior.</Text>
      )}
    </View>
  );

  const renderStats = () => (
    <View style={s.tabContent}>
      {selectedEvent?.type === "MATCH" ? (
        <>
          {stats.length === 0 ? (
            <Text style={[s.hintText, { color: c.subtexto }]}>Sin estadísticas para este partido.</Text>
          ) : stats.map((item) => (
              <View
                key={item.playerId}
                style={[s.playerRow, { backgroundColor: c.input, flexDirection: "column", alignItems: "flex-start" }]}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%", marginBottom: 8 }}>
                  <Text style={[s.playerName, { color: c.texto }]}>
                    {item.firstName} {item.lastName}
                  </Text>
                  {item.wasStarter && (
                    <Text style={{ fontSize: 11, color: c.boton, fontWeight: "700" }}>Titular</Text>
                  )}
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                  {([
                    { label: "Goles",     value: item.goals },
                    { label: "Asist.",    value: item.assists },
                    { label: "Amarillas", value: item.yellowCards },
                    { label: "Rojas",     value: item.redCards },
                    { label: "Minutos",   value: item.minutesPlayed },
                  ]).map(({ label, value }) => (
                    <View key={label} style={{ alignItems: "center", minWidth: 50 }}>
                      <Text style={{ fontSize: 10, color: c.subtexto, marginBottom: 2 }}>{label}</Text>
                      <Text style={{ fontSize: 18, fontWeight: "800", color: c.texto }}>{value ?? 0}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
        </>
      ) : (
        <Text style={[s.hintText, { color: c.subtexto }]}>Selecciona un partido en el calendario superior.</Text>
      )}
    </View>
  );

  const renderFines = () => (
    <View style={s.tabContent}>
      <TouchableOpacity
        style={[s.btnPrimary, { backgroundColor: c.boton, marginBottom: 16 }]}
        onPress={() => setFineModal(true)}
      >
        <Text style={[s.btnPrimaryText, { color: c.botonTexto }]}>+ Nueva multa</Text>
      </TouchableOpacity>

      {finesLoading && fines.length === 0 ? (
        <ActivityIndicator color={c.boton} style={{ marginTop: 20 }} />
      ) : fines.length === 0 ? (
        <Text style={[s.hintText, { color: c.subtexto }]}>Sin multas registradas.</Text>
      ) : fines.map(f => (
        <View
          key={f.id}
          style={[s.playerRow, { backgroundColor: c.input, flexDirection: "column", alignItems: "flex-start", gap: 4 }]}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%" }}>
            <Text style={[s.playerName, { color: c.texto }]}>{f.playerName}</Text>
            <Text style={{
              fontWeight: "bold",
              color: f.status === "PAID" ? COLOR_EXITO : f.status === "FORGIVEN" ? COLOR_NEUTRAL : COLOR_PELIGRO,
            }}>
              {f.amount.toFixed(2)} €
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: c.subtexto }}>{f.reason}</Text>
          <Text style={{ fontSize: 11, color: c.subtexto, opacity: 0.7 }}>{f.issuedDate} · {f.status}</Text>
        </View>
      ))}

      {finesHasMore && !finesLoading && (
        <TouchableOpacity style={s.btnSecondary} onPress={() => fetchFines(finesPage + 1)}>
          <Text style={{ color: c.boton, fontWeight: "600" }}>Cargar más</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // ── RENDER PRINCIPAL ───────────────────────────────────────────────────────

  return (
    <ScreenContainer>
    <View style={[s.container, { backgroundColor: c.fondo }]}>
      {/* Cabecera */}
      <View style={[s.header, { backgroundColor: c.fondo }]}>
        <Text style={[s.headerTitle, { color: c.texto }]}>Gestión Coach</Text>
        <Text style={[s.headerSub, { color: c.subtexto }]}>Temporada {seasonLabel}</Text>
      </View>

      <ScrollView>
        {/* Selector de equipo — solo visible para el presidente */}
        {isPresident && teams.length > 0 && (
          <View style={s.teamPickerContainer}>
            <Text style={[s.teamPickerLabel, { color: c.subtexto }]}>EQUIPO</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {teams.map(team => {
                const active = localTeamId === team.id;
                return (
                  <TouchableOpacity
                    key={team.id}
                    style={[
                      s.teamChip,
                      {
                        backgroundColor: active ? `${c.boton}20` : c.input,
                        borderWidth: active ? 2 : 1,
                        borderColor: active ? c.boton : c.bordeInput,
                      },
                    ]}
                    onPress={() => setLocalTeamId(team.id)}
                  >
                    <Text style={[s.teamChipText, { color: active ? c.boton : c.texto }]}>
                      {team.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Selector de evento */}
        <ScrollView horizontal style={s.eventPicker} showsHorizontalScrollIndicator={false}>
          {loadingEvents ? (
            <ActivityIndicator color={c.boton} style={{ margin: 12 }} />
          ) : selectorEvents.length === 0 ? (
            <Text style={[s.hintText, { color: c.subtexto, margin: 12 }]}>Sin eventos próximos.</Text>
          ) : selectorEvents.map(e => {
            const active = selectedEvent?.id === e.id;
            const accentColor = e.type === "MATCH" ? "#f97316" : "#3b82f6";
            return (
              <TouchableOpacity
                key={`${e.type}-${e.id}`}
                style={[
                  s.eventChip,
                  {
                    backgroundColor: active ? `${accentColor}18` : c.input,
                    borderWidth: 1,
                    borderColor: active ? accentColor : c.bordeInput,
                    borderLeftWidth: 3,
                    borderLeftColor: accentColor,
                  },
                ]}
                onPress={() => setSelectedEvent(e)}
              >
                <Text>{e.type === "MATCH" ? "⚽" : "🏃"}</Text>
                <Text style={[s.eventChipText, { color: active ? accentColor : c.texto }]} numberOfLines={3}>
                  {formatEventLabel(e)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Tabs */}
        <View style={[s.tabBar, { borderBottomColor: c.bordeInput }]}>
          {(["ASISTENCIA", "CONVOCATORIAS", "STATS", "MULTAS"] as Tab[]).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[s.tabItem, activeTab === tab && { borderBottomWidth: 2, borderBottomColor: c.boton }]}
              onPress={() => handleTabChange(tab)}
            >
              <Text style={[s.tabText, { color: activeTab === tab ? c.boton : c.subtexto }]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === "ASISTENCIA"    && renderAttendanceTab()}
        {activeTab === "CONVOCATORIAS" && renderConvocatorias()}
        {activeTab === "STATS"         && renderStats()}
        {activeTab === "MULTAS"        && renderFines()}
      </ScrollView>

      {/* ── Modal cerrar partido ── */}
      <Modal visible={closeMatchModal} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { backgroundColor: c.fondo, borderColor: c.bordeInput }]}>
            <Text style={[s.modalTitle, { color: c.texto }]}>Cerrar partido</Text>
            <TextInput
              style={[s.scoreInput, { borderColor: c.bordeInput, backgroundColor: c.input, color: c.texto }]}
              placeholder="Goles a favor"
              placeholderTextColor={c.subtexto}
              onChangeText={setGoalsFor}
              keyboardType="numeric"
              returnKeyType="next"
            />
            <TextInput
              style={[s.scoreInput, { borderColor: c.bordeInput, backgroundColor: c.input, color: c.texto }]}
              placeholder="Goles en contra"
              placeholderTextColor={c.subtexto}
              onChangeText={setGoalsAgainst}
              keyboardType="numeric"
              returnKeyType="done"
            />
            <TouchableOpacity style={[s.btnDanger, { backgroundColor: COLOR_PELIGRO }]} onPress={handleCloseMatch}>
              <Text style={s.btnDangerText}>Cerrar partido</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnSecondary} onPress={() => setCloseMatchModal(false)}>
              <Text style={{ color: c.subtexto, fontWeight: "600" }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal nueva multa ── */}
      <Modal visible={fineModal} transparent animationType="slide" onRequestClose={() => setFineModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { backgroundColor: c.fondo, borderColor: c.bordeInput }]}>
            <Text style={[s.modalTitle, { color: c.texto }]}>Nueva multa</Text>

            <Text style={[s.modalLabel, { color: c.subtexto }]}>Selecciona Jugador</Text>
            {/* Nuevo: ScrollView con los jugadores del equipo */}
            <View style={[s.playerSelectorBox, { borderColor: c.bordeInput, backgroundColor: c.input }]}>
              {teamPlayers.length === 0 ? (
                <Text style={{ padding: 12, color: c.subtexto, fontStyle: "italic" }}>
                  Cargando plantilla o sin jugadores...
                </Text>
              ) : (
                <ScrollView nestedScrollEnabled={true}>
                  {teamPlayers.map(p => {
                    const isSelected = fineTarget?.id === p.id;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[s.playerSelectorItem, { backgroundColor: isSelected ? c.boton : "transparent" }]}
                        onPress={() => setFineTarget({ id: p.id, name: `${p.firstName} ${p.lastName}` })}
                      >
                        <Text style={{ color: isSelected ? c.botonTexto : c.texto, fontWeight: isSelected ? "700" : "400" }}>
                          {p.firstName} {p.lastName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            <Text style={[s.modalLabel, { color: c.subtexto }]}>Motivo</Text>
            <TextInput
              style={[s.scoreInput, { borderColor: c.bordeInput, backgroundColor: c.input, color: c.texto, height: 70, textAlignVertical: "top" }]}
              placeholder="Describe el motivo (llegar tarde, sin espinilleras...)"
              placeholderTextColor={c.subtexto}
              value={fineReason}
              onChangeText={setFineReason}
              multiline
            />

            <Text style={[s.modalLabel, { color: c.subtexto }]}>Importe (€)</Text>
            <TextInput
              style={[s.scoreInput, { borderColor: c.bordeInput, backgroundColor: c.input, color: c.texto }]}
              placeholder="0.00"
              placeholderTextColor={c.subtexto}
              keyboardType="numeric"
              value={fineAmount}
              onChangeText={setFineAmount}
            />

            <TouchableOpacity style={[s.btnPrimary, { backgroundColor: c.boton }]} onPress={handleCreateFine}>
              <Text style={[s.btnPrimaryText, { color: c.botonTexto }]}>Crear multa</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnSecondary} onPress={() => { setFineModal(false); setFineTarget(null); }}>
              <Text style={{ color: c.subtexto, fontWeight: "600" }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
    </ScreenContainer>
  );
}

// Solo valores estructurales — sin colores
const s = StyleSheet.create({
  container:      { flex: 1 },
  header:         { paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20 },
  headerTitle:    { fontSize: 22, fontWeight: "800" },
  headerSub:      { fontSize: 13, marginTop: 2 },

  teamPickerContainer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  teamPickerLabel:     { fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginBottom: 8 },
  teamChip:            { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, marginRight: 8 },
  teamChipText:        { fontSize: 13, fontWeight: "600" },

  eventPicker:    { paddingHorizontal: 20, paddingVertical: 12 },
  eventChip:      { alignItems: "center", marginRight: 10, padding: 10, borderRadius: 12, minWidth: 110, maxWidth: 155 },
  eventChipText:  { fontSize: 11, textAlign: "center", marginTop: 4, lineHeight: 15 },

  tabBar:         { flexDirection: "row", paddingHorizontal: 20, borderBottomWidth: 1 },
  tabItem:        { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText:        { fontSize: 11, fontWeight: "600" },

  tabContent:     { padding: 20 },
  hintText:       { textAlign: "center", marginTop: 20 },

  playerRow:      { flexDirection: "row", justifyContent: "space-between", padding: 12, marginBottom: 8, borderRadius: 10 },
  playerName:     { fontWeight: "600", fontSize: 14 },

  // Chips de convocatoria (Task 1)
  callupChipsRow: { flexDirection: "row", gap: 4, alignItems: "center" },
  callupChip:     { height: 30, paddingHorizontal: 7, borderRadius: 6, borderWidth: 1.5,
                    alignItems: "center", justifyContent: "center", minWidth: 42 },
  callupChipText: { fontSize: 9, letterSpacing: 0.4 },

  // Badge de estado debajo del nombre (Task 2)
  callupStatusBadge: { fontSize: 10, fontWeight: "600", marginTop: 3 },

  // Estilos heredados usados en otras secciones del archivo
  statusChip:     { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  statusChipText: { fontSize: 12, fontWeight: "700" },

  btnPrimary:     { padding: 14, borderRadius: 10, alignItems: "center", marginTop: 10 },
  btnPrimaryText: { fontWeight: "700" },
  btnDanger:      { padding: 14, borderRadius: 10, alignItems: "center", marginTop: 8 },
  btnDangerText:  { color: "#fff", fontWeight: "700" },
  btnSecondary:   { padding: 14, alignItems: "center" },

  scoreInput:     { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 10 },

  modalOverlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modalBox:       { padding: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderBottomWidth: 0 },
  modalTitle:     { fontSize: 20, fontWeight: "700", marginBottom: 15 },
  modalLabel:     { fontSize: 12, fontWeight: "600", marginBottom: 4 },

  playerSelectorBox:  { borderWidth: 1, borderRadius: 8, marginBottom: 10, maxHeight: 130 },
  playerSelectorItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.05)" },
});