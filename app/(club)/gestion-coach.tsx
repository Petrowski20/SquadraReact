import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import { apiFetch } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { useTheme } from "../../lib/useTheme";

// Colores semánticos — no dependen del tema
const COLOR_PELIGRO = "#ef4444";
const COLOR_EXITO = "#16a34a";
const COLOR_NEUTRAL = "#64748B";
const COLOR_AMARILLO = "#f59e0b";

type Tab = "ASISTENCIA" | "CONVOCATORIAS" | "STATS" | "MULTAS";

interface Player {
  id: number;
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  image_consent_season?: string | null;
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

interface GlobalStatsEntry {
  playerId: number;
  firstName: string;
  lastName: string;
  totalGoals: number;
  totalAssists: number;
  totalYellowCards: number;
  totalRedCards: number;
  totalMinutesPlayed: number;
  totalMatches: number;
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
  CALLED_UP: {
    label: "CONV.",
    activeColor: "#16a34a",
    activeBg: "#dcfce7",
    badgeText: "Convocado",
  },
  ABSENT: {
    label: "DESC.",
    activeColor: "#dc2626",
    activeBg: "#fee2e2",
    badgeText: "Descartado",
  },
  INJURED: {
    label: "BAJA",
    activeColor: "#d97706",
    activeBg: "#fef3c7",
    badgeText: "Baja / Lesión",
  },
} as const;

const formatEventLabel = (e: CalendarEvent): string => {
  const d = new Date(e.startTime);
  const day = String(d.getDate()).padStart(2, "0");
  const mon = String(d.getMonth() + 1).padStart(2, "0");
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (e.type === "TRAINING") {
    return e.location
      ? `${day}/${mon} · ${time}\n(${e.location})`
      : `${day}/${mon} · ${time}`;
  }
  return `${e.title}\n${day}/${mon} · ${time}`;
};

export default function GestionCoach() {
  const c = useTheme();
  const { t } = useTranslation();
  const {
    activeClubId: clubId,
    activeTeamId: storeTeamId,
    activeSeasonName,
    activeRole,
  } = useAuthStore();
  const isPresident = activeRole === "PRESIDENT";
  const seasonLabel = activeSeasonName || "24-25";

  const [activeTab, setActiveTab] = useState<Tab>("ASISTENCIA");

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null,
  );
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Estados de datos
  const [teamPlayers, setTeamPlayers] = useState<Player[]>([]);
  const [attendance, setAttendance] = useState<PlayerAttendanceItem[]>([]);
  const [callups, setCallups] = useState<CallupEntry[]>([]);
  const [stats, setStats] = useState<StatsEntry[]>([]);
  const [globalStats, setGlobalStats] = useState<GlobalStatsEntry[]>([]);
  const [loadingGlobalStats, setLoadingGlobalStats] = useState(false);
  const [activeMetric, setActiveMetric] = useState<keyof GlobalStatsEntry>("totalGoals");
  const [fines, setFines] = useState<Fine[]>([]);
  const [finesLoading, setFinesLoading] = useState(false);
  const [finesPage, setFinesPage] = useState(0);
  const [finesHasMore, setFinesHasMore] = useState(true);

  const [localTeamId, setLocalTeamId] = useState<number | null>(
    storeTeamId ?? null,
  );
  const [teams, setTeams] = useState<{ id: number; label: string }[]>([]);
  const showTeamPicker = isPresident || teams.length > 1;

  const [saving, setSaving] = useState(false);

  // El selector de eventos solo aplica a ASISTENCIA y CONVOCATORIAS
  const selectorEvents =
    activeTab === "ASISTENCIA"
      ? events.filter((e) => e.type === "TRAINING")
      : activeTab === "CONVOCATORIAS"
        ? events.filter((e) => e.type === "MATCH")
        : [];

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === "MULTAS" || tab === "STATS") return;
    const relevant =
      tab === "ASISTENCIA"
        ? events.filter((e) => e.type === "TRAINING")
        : events.filter((e) => e.type === "MATCH");
    setSelectedEvent(relevant.length > 0 ? relevant[0] : null);
  };

  // Estados modales
  const [fineModal, setFineModal] = useState(false);
  const [fineTarget, setFineTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [fineReason, setFineReason] = useState("");
  const [fineAmount, setFineAmount] = useState("");
  const [fineError, setFineError] = useState("");
  const [fineQuery, setFineQuery] = useState("");

  const [closeMatchModal, setCloseMatchModal] = useState(false);
  const [goalsFor, setGoalsFor] = useState("");
  const [goalsAgainst, setGoalsAgainst] = useState("");

  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ visible: false, title: "", message: "", onConfirm: () => {} });

  // ── FETCH ──────────────────────────────────────────────────────────────────

  // Carga la lista de equipos del club:
  //   - Presidente: todos los equipos activos del club
  //   - Coach: solo los equipos a los que está asignado (filtrando membresías)
  useEffect(() => {
    if (!clubId) return;
    const load = async () => {
      try {
        const allTeamsRes = await apiFetch(`/api/club/equipos/${clubId}`);
        const allTeams: any[] = await allTeamsRes.json();
        const active = allTeams.filter((t: any) => t.isActive);

        if (isPresident) {
          const mapped = active.map((t: any) => ({
            id: t.id,
            label: `${t.category}${t.suffix ? " " + t.suffix : ""}`,
          }));
          setTeams(mapped);
          if (!localTeamId && mapped.length > 0) setLocalTeamId(mapped[0].id);
        } else {
          // Para coaches: cruzar los equipos del club con sus membresías
          const membershipsRes = await apiFetch("/api/clubs/my-memberships");
          const memberships: any[] = membershipsRes.ok
            ? await membershipsRes.json()
            : [];
          const coachTeamIds = new Set(
            memberships
              .filter(
                (m: any) =>
                  m.clubId === clubId &&
                  (m.role === "COACH" || m.role === "coach"),
              )
              .map((m: any) => m.teamId)
              .filter(Boolean),
          );

          if (coachTeamIds.size === 0 && storeTeamId) {
            coachTeamIds.add(storeTeamId);
          }

          const mapped = active
            .filter((t: any) => coachTeamIds.has(t.id))
            .map((t: any) => ({
              id: t.id,
              label: `${t.category}${t.suffix ? " " + t.suffix : ""}`,
            }));

          if (mapped.length > 0) {
            setTeams(mapped);
            if (!localTeamId || !coachTeamIds.has(localTeamId)) {
              setLocalTeamId(mapped[0].id);
            }
          }
        }
      } catch {}
    };
    load();
  }, [isPresident, clubId]);

  // Carga de eventos del equipo seleccionado
  const fetchEvents = useCallback(async () => {
    if (!localTeamId) return;
    setLoadingEvents(true);
    try {
      const now = new Date();
      const from = now.toISOString();
      const to = new Date(
        now.getTime() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const res = await apiFetch(
        `/api/calendar?clubId=${clubId}&teamId=${localTeamId}&seasonLabel=${seasonLabel}&from=${from}&to=${to}`,
      );
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
      return () => {
        isActive = false;
      };
    }, [fetchEvents]),
  );

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Novedad: Cargar jugadores reales del equipo activo
  useEffect(() => {
    if (!localTeamId) return;
    const fetchPlayers = async () => {
      try {
        const res = await apiFetch(
          `/api/president/players?clubId=${clubId}&teamId=${localTeamId}`,
        );
        const data = await res.json();
        console.log("Respuesta /players:", JSON.stringify(data)); 
        setTeamPlayers(Array.isArray(data) ? data : (data.players ?? data.content ?? []));
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
    if (activeTab === "ASISTENCIA" && selectedEvent.type === "TRAINING")
      fetchAttendance();
    if (activeTab === "CONVOCATORIAS" && selectedEvent.type === "MATCH")
      fetchCallups();
    if (activeTab === "STATS" && selectedEvent.type === "MATCH") fetchStats();
  }, [selectedEvent, activeTab]);

  useEffect(() => {
    if (activeTab === "MULTAS") fetchFines(0);
  }, [activeTab]);
  const fetchGlobalStats = useCallback(async () => {
    if (!localTeamId) return;
    setLoadingGlobalStats(true);
    try {
      const res = await apiFetch(
        `/api/coach/team/${localTeamId}/stats/global?clubId=${clubId}&seasonLabel=${seasonLabel}`,
      );
      const data: GlobalStatsEntry[] = await res.json();
      setGlobalStats(data);
    } catch {
      Alert.alert("Error", "No se pudieron cargar las estadísticas globales.");
    } finally {
      setLoadingGlobalStats(false);
    }
  }, [localTeamId, clubId, seasonLabel]);

  useEffect(() => {
    if (activeTab === "STATS") fetchGlobalStats();
  }, [activeTab, fetchGlobalStats]);

  const fetchAttendance = async () => {
    if (!selectedEvent) return;
    try {
      // Fetch attendance records AND the team roster in parallel.
      // The teamId comes from the EVENT itself so both coaches and presidents
      // always load the correct players regardless of their own assigned team.
      const [attendanceRes, playersRes] = await Promise.all([
        apiFetch(`/api/coach/training/${selectedEvent.id}/attendance?clubId=${clubId}`),
        apiFetch(`/api/teams/${selectedEvent.teamId}/players?seasonLabel=${seasonLabel}&clubId=${clubId}`),
      ]);
      const data = await attendanceRes.json();
      const rosterPlayers: Player[] = playersRes.ok ? await playersRes.json() : [];
      const fetched: any[] = data.players ?? [];

      if (fetched.length > 0) {
        setAttendance(fetched.map((p: any) => ({ ...p, positiveMark: p.positiveMark ?? false })));
      } else {
        // No pre-existing records: seed from the team roster with default values
        setAttendance(
          rosterPlayers.map((p) => ({
            playerId: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            attended: false,
            absenceReason: null,
            positiveMark: false,
          })),
        );
      }
    } catch {
      Alert.alert("Error", "No se pudo cargar la asistencia.");
    }
  };

  const fetchCallups = async () => {
    if (!selectedEvent) return;
    try {
      const [callupsRes, playersRes] = await Promise.all([
        apiFetch(`/api/coach/match/callups/${selectedEvent.id}?clubId=${clubId}`),
        apiFetch(`/api/teams/${selectedEvent.teamId}/players?seasonLabel=${seasonLabel}&clubId=${clubId}`),
      ]);
      const data: CallupEntry[] = await callupsRes.json();
      const rosterPlayers: Player[] = playersRes.ok ? await playersRes.json() : [];

      if (data.length > 0) {
        setCallups(data);
      } else {
        // No pre-existing callup records: seed from the team roster
        setCallups(
          rosterPlayers.map((p) => ({
            playerId: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            status: "CALLED_UP" as const,
            absenceReason: null,
          })),
        );
      }
    } catch {}
  };

  const fetchStats = async () => {
    if (!selectedEvent) return;
    try {
      const res = await apiFetch(
        `/api/coach/match/${selectedEvent.id}/stats?clubId=${clubId}`,
      );
      const data: StatsEntry[] = await res.json();
      setStats(data);
    } catch {}
  };

  const fetchFines = async (page: number) => {
    setFinesLoading(true);
    try {
      const res = await apiFetch(
        `/api/coach/fines?clubId=${clubId}&teamId=${localTeamId}&seasonLabel=${seasonLabel}&page=${page}&size=20`,
      );
      const data = await res.json();
      const newFines: Fine[] = data.content ?? [];
      setFines(page === 0 ? newFines : (prev) => [...prev, ...newFines]);
      setFinesHasMore(!data.last);
      setFinesPage(page);
    } catch {
      Alert.alert("Error", "No se pudieron cargar las multas.");
    } finally {
      setFinesLoading(false);
    }
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
          entries: attendance.map((p) => ({
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
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBulkCallups = async () => {
    if (!selectedEvent) return;
    setSaving(true);
    try {
      await apiFetch(`/api/coach/match/callups/bulk?clubId=${clubId}`, {
        method: "PUT",
        body: JSON.stringify({
          matchId: selectedEvent.id,
          entries: callups.map((entry) => ({
            playerId: entry.playerId,
            status: entry.status,
            absenceReason: entry.absenceReason,
          })),
        }),
      });
      Alert.alert("Guardado", "Convocatoria guardada.");
    } catch {
      Alert.alert("Error", "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBulkStats = async () => {
    if (!selectedEvent) return;
    setSaving(true);
    try {
      await apiFetch(
        `/api/coach/match/${selectedEvent.id}/stats/bulk?clubId=${clubId}`,
        {
          method: "PUT",
          body: JSON.stringify({ entries: stats }),
        },
      );
      Alert.alert("Guardado", "Estadísticas guardadas.");
    } catch {
      Alert.alert("Error", "No se pudieron guardar las estadísticas.");
    } finally {
      setSaving(false);
    }
  };

  const handleCloseMatch = async () => {
    if (!selectedEvent) return;
    try {
      await apiFetch(
        `/api/coach/match/${selectedEvent.id}/close?clubId=${clubId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            goalsFor: Number(goalsFor),
            goalsAgainst: Number(goalsAgainst),
          }),
        },
      );
      setCloseMatchModal(false);
      Alert.alert("Cerrado", "Partido cerrado correctamente.");
    } catch {
      Alert.alert("Error", "No se pudo cerrar.");
    }
  };

  const handleCreateFine = async () => {
    setFineError("");
    
    if (!fineTarget || !fineReason || !fineAmount) {
      setFineError("Por favor rellena todos los campos y selecciona un jugador.");
      return;
    }
    const parsedAmount = parseFloat(fineAmount.replace(",", "."));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFineError("El importe debe ser un número mayor que 0.");
      return;
    }
    try {
      const res = await apiFetch(`/api/coach/fines?clubId=${clubId}`, {
        method: "POST",
        body: JSON.stringify({
          playerId: fineTarget.id,
          teamId: localTeamId,
          reason: fineReason,
          amount: parsedAmount,
          seasonLabel,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        setFineError(`Error ${res.status}: ${body || "No se pudo crear la multa."}`);
        return;
      }
      setFineModal(false);
      setFineReason("");
      setFineAmount("");
      setFineTarget(null);
      setFineQuery("");
      fetchFines(0);
    } catch {
      Alert.alert("Error", "No se pudo crear.");
    }
  };

  const handleMarkPaid = (fineId: number) => {
    setConfirmModal({
      visible: true,
      title: "Marcar como pagada",
      message: "¿Confirmas que esta multa ha sido pagada?",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, visible: false }));
        const res = await apiFetch(`/api/coach/fines/${fineId}?clubId=${clubId}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "PAID" }),
        });
        if (res.ok) fetchFines(0);
      },
    });
  };

  const handleDeleteFine = (fineId: number) => {
    setConfirmModal({
      visible: true,
      title: "Eliminar multa",
      message: "¿Seguro que quieres eliminar esta multa? Esta acción no se puede deshacer.",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, visible: false }));
        const res = await apiFetch(`/api/coach/fines/${fineId}?clubId=${clubId}`, {
          method: "DELETE",
        });
        if (res.ok) fetchFines(0);
      },
    });
  };

  // ── RENDERS DE TABS ────────────────────────────────────────────────────────

  const renderAttendanceTab = () => (
    <View style={s.tabContent}>
      {selectedEvent?.type === "TRAINING" ? (
        <>
          {attendance.length === 0 ? (
            <Text style={[s.hintText, { color: c.subtexto }]}>
              Sin jugadores registrados.
            </Text>
          ) : (
            attendance.map((item, idx) => (
              <View
                key={item.playerId}
                style={[s.playerRow, { backgroundColor: c.input }]}
              >
                <Text style={[s.playerName, { color: c.texto }]}>
                  {item.firstName} {item.lastName}
                </Text>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <TouchableOpacity
                    onPress={() => {
                      const next = [...attendance];
                      next[idx].positiveMark = !next[idx].positiveMark;
                      setAttendance(next);
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 20,
                        opacity: item.positiveMark ? 1 : 0.3,
                      }}
                    >
                      ⭐
                    </Text>
                  </TouchableOpacity>
                  <Switch
                    value={item.attended ?? false}
                    onValueChange={(v) => {
                      const next = [...attendance];
                      next[idx].attended = v;
                      setAttendance(next);
                    }}
                  />
                </View>
              </View>
            ))
          )}
          <TouchableOpacity
            style={[
              s.btnPrimary,
              { backgroundColor: c.boton, opacity: saving ? 0.6 : 1 },
            ]}
            onPress={handleSaveBulkAttendance}
            disabled={saving}
          >
            <Text style={[s.btnPrimaryText, { color: c.botonTexto }]}>
              {saving ? "Guardando..." : "💾 Guardar asistencia"}
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={[s.hintText, { color: c.subtexto }]}>
          Selecciona un entrenamiento en el calendario superior.
        </Text>
      )}
    </View>
  );

  const renderConvocatorias = () => (
    <View style={s.tabContent}>
      {selectedEvent?.type === "MATCH" ? (
        <>
          {callups.length === 0 ? (
            <Text style={[s.hintText, { color: c.subtexto }]}>
              Sin convocados aún.
            </Text>
          ) : (
            callups.map((item, idx) => (
              <View
                key={item.playerId}
                style={[
                  s.playerRow,
                  { backgroundColor: c.input, alignItems: "center" },
                ]}
              >
                {/* ── Lado izquierdo: nombre + stats + badge de estado ── */}
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text
                    style={[s.playerName, { color: c.texto }]}
                    numberOfLines={1}
                  >
                    {item.firstName} {item.lastName}
                  </Text>

                  {(item.attendancePercentage != null ||
                    item.positiveMarksCount != null) && (
                    <Text
                      style={{ fontSize: 11, color: c.subtexto, marginTop: 2 }}
                    >
                      {[
                        item.attendancePercentage != null
                          ? `${item.attendancePercentage}% Asist.`
                          : null,
                        item.positiveMarksCount != null
                          ? `⭐ ${item.positiveMarksCount}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" | ")}
                    </Text>
                  )}

                  {/* Badge de estado — feedback visual inmediato (Task 2) */}
                  <Text
                    style={[
                      s.callupStatusBadge,
                      { color: CALLUP_STATUS_CFG[item.status].activeColor },
                    ]}
                  >
                    ● {CALLUP_STATUS_CFG[item.status].badgeText}
                  </Text>
                </View>

                {/* ── Lado derecho: chips de selección ── */}
                <View style={s.callupChipsRow}>
                  {(["CALLED_UP", "ABSENT", "INJURED"] as const).map((st) => {
                    const cfg = CALLUP_STATUS_CFG[st];
                    const active = item.status === st;
                    return (
                      <TouchableOpacity
                        key={st}
                        accessibilityLabel={cfg.badgeText}
                        accessibilityRole="button"
                        style={[
                          s.callupChip,
                          {
                            borderColor: cfg.activeColor,
                            backgroundColor: active
                              ? cfg.activeBg
                              : "transparent",
                          },
                        ]}
                        onPress={() => {
                          const next = [...callups];
                          next[idx] = { ...next[idx], status: st };
                          setCallups(next);
                        }}
                      >
                        <Text
                          style={[
                            s.callupChipText,
                            {
                              color: active ? cfg.activeColor : c.subtexto,
                              fontWeight: active ? "800" : "600",
                            },
                          ]}
                        >
                          {cfg.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))
          )}

          <TouchableOpacity
            style={[
              s.btnPrimary,
              { backgroundColor: c.boton, opacity: saving ? 0.6 : 1 },
            ]}
            onPress={handleSaveBulkCallups}
            disabled={saving}
          >
            <Text style={[s.btnPrimaryText, { color: c.botonTexto }]}>
              {saving ? "Guardando..." : "💾 Guardar convocatoria"}
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={[s.hintText, { color: c.subtexto }]}>
          Selecciona un partido en el calendario superior.
        </Text>
      )}
    </View>
  );

  const renderStats = () => {
    const METRICS: { key: keyof GlobalStatsEntry; label: string; icon: string }[] = [
      { key: "totalGoals",         label: t('coachManagement.statGoals'),   icon: "⚽" },
      { key: "totalAssists",       label: t('coachManagement.statAssists'), icon: "🎯" },
      { key: "totalYellowCards",   label: t('coachManagement.statYellow'),  icon: "🟨" },
      { key: "totalRedCards",      label: t('coachManagement.statRed'),     icon: "🟥" },
      { key: "totalMinutesPlayed", label: t('coachManagement.statMinutes'), icon: "⏱" },
    ];

    if (loadingGlobalStats) {
      return (
        <View style={s.tabContent}>
          <ActivityIndicator color={c.boton} style={{ marginTop: 24 }} />
        </View>
      );
    }

    if (globalStats.length === 0) {
      return (
        <View style={s.tabContent}>
          <Text style={[s.hintText, { color: c.subtexto }]}>
            {t('coachManagement.noStats')}
          </Text>
        </View>
      );
    }

    const sorted = [...globalStats].sort(
      (a, b) => (b[activeMetric] as number) - (a[activeMetric] as number)
    );
    const activeCfg = METRICS.find((m) => m.key === activeMetric)!;

    return (
      <View style={s.tabContent}>
        {/* Selector de métrica */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 14 }}
        >
          {METRICS.map(({ key, label, icon }) => {
            const active = key === activeMetric;
            return (
              <TouchableOpacity
                key={key}
                style={[
                  s.metricChip,
                  {
                    backgroundColor: active ? c.boton : c.input,
                    borderColor:     active ? c.boton : c.bordeInput,
                  },
                ]}
                onPress={() => setActiveMetric(key)}
              >
                <Text style={{ fontSize: 13, marginRight: 5 }}>{icon}</Text>
                <Text style={[s.metricChipText, { color: active ? c.botonTexto : c.subtexto }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Encabezado de la métrica activa */}
        <Text style={[s.rankingHeader, { color: c.subtexto, marginBottom: 10 }]}>
          {activeCfg.icon}  {activeCfg.label.toUpperCase()} · {seasonLabel}
        </Text>

        {/* Lista completa ordenada — todos los jugadores, sin filtros */}
        {sorted.map((p, i) => {
          const isFirst = i === 0;
          const value = p[activeMetric] as number;
          return (
            <View
              key={p.playerId}
              style={[
                s.rankingRow,
                {
                  backgroundColor: c.input,
                  borderLeftWidth:  isFirst ? 3 : 0,
                  borderLeftColor:  "#f59e0b",
                },
              ]}
            >
              <Text style={[s.rankingPos, { color: isFirst ? "#f59e0b" : c.subtexto }]}>
                #{i + 1}
              </Text>
              <Text style={[s.playerName, { color: c.texto, flex: 1 }]}>
                {p.firstName} {p.lastName}
              </Text>
              <Text style={[s.rankingValue, { color: isFirst ? "#f59e0b" : c.boton }]}>
                {value}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  const renderFines = () => (
    <View style={s.tabContent}>
      <TouchableOpacity
        style={[s.btnPrimary, { backgroundColor: c.boton, marginBottom: 16 }]}
        onPress={() => setFineModal(true)}
      >
        <Text style={[s.btnPrimaryText, { color: c.botonTexto }]}>
          {t('coachManagement.newFine')}
        </Text>
      </TouchableOpacity>

      {finesLoading && fines.length === 0 ? (
        <ActivityIndicator color={c.boton} style={{ marginTop: 20 }} />
      ) : fines.length === 0 ? (
        <Text style={[s.hintText, { color: c.subtexto }]}>
          {t('coachManagement.noFines')}
        </Text>
      ) : (
        fines.map((f) => (
          <View
            key={f.id}
            style={[
              s.playerRow,
              {
                backgroundColor: c.input,
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 4,
              },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              <Text style={[s.playerName, { color: c.texto }]}>
                {f.playerName}
              </Text>
              <Text
                style={{
                  fontWeight: "bold",
                  color:
                    f.status === "PAID"
                      ? COLOR_EXITO
                      : f.status === "FORGIVEN"
                        ? COLOR_NEUTRAL
                        : COLOR_PELIGRO,
                }}
              >
                {f.amount.toFixed(2)} €
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: c.subtexto }}>{f.reason}</Text>
            <Text style={{ fontSize: 11, color: c.subtexto, opacity: 0.7 }}>
              {f.issuedDate} · {t(`coachManagement.fineStatus_${f.status}` as any, { defaultValue: f.status })}
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
              <TouchableOpacity
                disabled={f.status !== "PENDING"}
                style={{
                  backgroundColor: f.status === "PENDING" ? COLOR_EXITO : c.input,
                  borderRadius: 6,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  opacity: f.status === "PENDING" ? 1 : 0.4,
                }}
                onPress={() => handleMarkPaid(f.id)}
              >
                <Text style={{ color: f.status === "PENDING" ? "#fff" : c.subtexto, fontSize: 12, fontWeight: "600" }}>
                  {t('coachManagement.fineMarkPaid')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ backgroundColor: COLOR_PELIGRO, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}
                onPress={() => handleDeleteFine(f.id)}
              >
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      {finesHasMore && !finesLoading && (
        <TouchableOpacity
          style={s.btnSecondary}
          onPress={() => fetchFines(finesPage + 1)}
        >
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
          <Text style={[s.headerTitle, { color: c.texto }]}>{t('coachManagement.coachTitle')}</Text>
          <Text style={[s.headerSub, { color: c.subtexto }]}>
            {t('calendar.season')} {seasonLabel}
          </Text>
        </View>

        <ScrollView>
          {/* Selector de equipo — solo visible para el presidente */}
          {isPresident && teams.length > 0 && (
            <View style={s.teamPickerContainer}>
              <Text style={[s.teamPickerLabel, { color: c.subtexto }]}>
                EQUIPO
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {teams.map((team) => {
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
                      <Text
                        style={[
                          s.teamChipText,
                          { color: active ? c.boton : c.texto },
                        ]}
                      >
                        {team.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Selector de evento — oculto en STATS (usa datos globales) y MULTAS */}
          {(activeTab === "ASISTENCIA" || activeTab === "CONVOCATORIAS") && (
            <ScrollView
              horizontal
              style={s.eventPicker}
              showsHorizontalScrollIndicator={false}
            >
              {loadingEvents ? (
                <ActivityIndicator color={c.boton} style={{ margin: 12 }} />
              ) : selectorEvents.length === 0 ? (
                <Text style={[s.hintText, { color: c.subtexto, margin: 12 }]}>
                  Sin eventos próximos.
                </Text>
              ) : (
                selectorEvents.map((e) => {
                  const active = selectedEvent?.id === e.id;
                  const accentColor =
                    e.type === "MATCH" ? "#f97316" : "#3b82f6";
                  return (
                    <TouchableOpacity
                      key={`${e.type}-${e.id}`}
                      style={[
                        s.eventChip,
                        {
                          backgroundColor: active
                            ? `${accentColor}18`
                            : c.input,
                          borderWidth: 1,
                          borderColor: active ? accentColor : c.bordeInput,
                          borderLeftWidth: 3,
                          borderLeftColor: accentColor,
                        },
                      ]}
                      onPress={() => setSelectedEvent(e)}
                    >
                      <Text>{e.type === "MATCH" ? "⚽" : "🏃"}</Text>
                      <Text
                        style={[
                          s.eventChipText,
                          { color: active ? accentColor : c.texto },
                        ]}
                        numberOfLines={3}
                      >
                        {formatEventLabel(e)}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          )}

          {/* Tabs */}
          <View style={[s.tabBar, { borderBottomColor: c.bordeInput }]}>
            {(["ASISTENCIA", "CONVOCATORIAS", "STATS", "MULTAS"] as Tab[]).map(
              (tab) => {
                const TAB_LABEL: Record<Tab, string> = {
                  ASISTENCIA: t('coachManagement.tab_attendance'),
                  CONVOCATORIAS: t('coachManagement.tab_callups'),
                  STATS: t('coachManagement.tab_stats'),
                  MULTAS: t('coachManagement.tab_fines'),
                };
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[
                      s.tabItem,
                      activeTab === tab && {
                        borderBottomWidth: 2,
                        borderBottomColor: c.boton,
                      },
                    ]}
                    onPress={() => handleTabChange(tab)}
                  >
                    <Text
                      style={[
                        s.tabText,
                        { color: activeTab === tab ? c.boton : c.subtexto },
                      ]}
                    >
                      {TAB_LABEL[tab]}
                    </Text>
                  </TouchableOpacity>
                );
              },
            )}
          </View>

          {activeTab === "ASISTENCIA" && renderAttendanceTab()}
          {activeTab === "CONVOCATORIAS" && renderConvocatorias()}
          {activeTab === "STATS" && renderStats()}
          {activeTab === "MULTAS" && renderFines()}
        </ScrollView>

        {/* ── Modal cerrar partido ── */}
        <Modal visible={closeMatchModal} transparent animationType="slide">
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View style={s.modalOverlay}>
              <View
                style={[
                  s.modalBox,
                  { backgroundColor: c.fondo, borderColor: c.bordeInput },
                ]}
              >
                <Text style={[s.modalTitle, { color: c.texto }]}>
                  Cerrar partido
                </Text>
                <TextInput
                  style={[
                    s.scoreInput,
                    {
                      borderColor: c.bordeInput,
                      backgroundColor: c.input,
                      color: c.texto,
                    },
                  ]}
                  placeholder="Goles a favor"
                  placeholderTextColor={c.subtexto}
                  onChangeText={setGoalsFor}
                  keyboardType="numeric"
                  returnKeyType="next"
                />
                <TextInput
                  style={[
                    s.scoreInput,
                    {
                      borderColor: c.bordeInput,
                      backgroundColor: c.input,
                      color: c.texto,
                    },
                  ]}
                  placeholder="Goles en contra"
                  placeholderTextColor={c.subtexto}
                  onChangeText={setGoalsAgainst}
                  keyboardType="numeric"
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={[s.btnDanger, { backgroundColor: COLOR_PELIGRO }]}
                  onPress={handleCloseMatch}
                >
                  <Text style={s.btnDangerText}>Cerrar partido</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.btnSecondary}
                  onPress={() => setCloseMatchModal(false)}
                >
                  <Text style={{ color: c.subtexto, fontWeight: "600" }}>
                    Cancelar
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* ── Modal nueva multa ── */}
        <Modal
          visible={fineModal}
          transparent
          animationType="slide"
          onRequestClose={() => setFineModal(false)}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View style={s.modalOverlay}>
              <View
                style={[
                  s.modalBox,
                  { backgroundColor: c.fondo, borderColor: c.bordeInput },
                ]}
              >
                <Text style={[s.modalTitle, { color: c.texto }]}>
                  {t('coachManagement.newFineTitle')}
                </Text>

                <Text style={[s.modalLabel, { color: c.subtexto }]}>
                  {t('coachManagement.fineSelectPlayer')}
                </Text>
                {fineTarget ? (
                  <View style={[s.linkedBadge, { backgroundColor: `${c.boton}18`, borderColor: `${c.boton}40` }]}>
                    <Text style={{ flex: 1, color: c.boton, fontWeight: "600", fontSize: 13 }}>
                      {fineTarget.name}
                    </Text>
                    <TouchableOpacity onPress={() => { setFineTarget(null); setFineQuery(""); }}>
                      <Text style={{ color: c.subtexto, fontSize: 18, fontWeight: "700", lineHeight: 20 }}>{"✕"}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ marginBottom: 10 }}>
                    <TextInput
                      style={[s.searchInput, { backgroundColor: c.input, borderColor: c.bordeInput, color: c.texto }]}
                      placeholder={"Escribe nombre o apellido (mín. 3 letras)..."}
                      placeholderTextColor={c.subtexto}
                      value={fineQuery}
                      onChangeText={setFineQuery}
                    />
                    {fineQuery.trim().length >= 3 && (() => {
                      const hits = teamPlayers.filter((p) =>
                        `${p.firstName} ${p.lastName ?? ""}`.toLowerCase().includes(fineQuery.trim().toLowerCase())
                      );
                      return hits.length > 0 ? (
                        <View style={[s.dropdown, { borderColor: c.bordeInput }]}>
                          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ maxHeight: 180 }}>
                            {hits.map((p) => (
                              <TouchableOpacity
                                key={p.id}
                                style={[s.dropdownItem, { borderBottomColor: c.bordeInput }]}
                                onPress={() => {
                                  setFineTarget({ id: p.id, name: `${p.firstName} ${p.lastName ?? ""}` });
                                  setFineQuery("");
                                }}
                              >
                                <Text style={{ color: c.texto, fontSize: 13 }}>{p.firstName} {p.lastName ?? ""}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      ) : (
                        <Text style={{ color: c.subtexto, fontSize: 12, marginTop: 6, marginLeft: 4 }}>{"Sin coincidencias."}</Text>
                      );
                    })()}
                    {teamPlayers.length === 0 && (
                      <Text style={{ color: c.subtexto, fontSize: 12, marginTop: 6, marginLeft: 4 }}>{"Sin jugadores en la plantilla."}</Text>
                    )}
                  </View>
                )}

                <Text style={[s.modalLabel, { color: c.subtexto }]}>
                  {t('coachManagement.fineReason')}
                </Text>
                <TextInput
                  style={[
                    s.scoreInput,
                    {
                      borderColor: c.bordeInput,
                      backgroundColor: c.input,
                      color: c.texto,
                      height: 70,
                      textAlignVertical: "top",
                    },
                  ]}
                  placeholder={t('coachManagement.fineReasonPlaceholder')}
                  placeholderTextColor={c.subtexto}
                  value={fineReason}
                  onChangeText={setFineReason}
                  multiline
                />

                <Text style={[s.modalLabel, { color: c.subtexto }]}>
                  {t('coachManagement.fineAmount')}
                </Text>
                <TextInput
                  style={[
                    s.scoreInput,
                    {
                      borderColor: c.bordeInput,
                      backgroundColor: c.input,
                      color: c.texto,
                    },
                  ]}
                  placeholder="0.00"
                  placeholderTextColor={c.subtexto}
                  keyboardType="numeric"
                  value={fineAmount}
                  onChangeText={(text) => {
                    const cleanedText = text.replace(/[^0-9.,]/g, "");
                    setFineAmount(cleanedText);
                  }}
                />

                {/* TEXTO DE ERROR EN ROJO */}
                {fineError !== "" && (
                  <Text style={{ color: "#ef4444", marginBottom: 12, textAlign: "center", fontWeight: "600", fontSize: 13 }}>
                    ⚠️ {fineError}
                  </Text>
                )}

                <TouchableOpacity
                  style={[s.btnPrimary, { backgroundColor: c.boton }]}
                  onPress={handleCreateFine}
                >
                  <Text style={[s.btnPrimaryText, { color: c.botonTexto }]}>
                    {t('coachManagement.fineCreate')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.btnSecondary}
                  onPress={() => {
                    setFineModal(false);
                    setFineTarget(null);
                    setFineError("");
                    setFineQuery("");
                  }}
                >
                  <Text style={{ color: c.subtexto, fontWeight: "600" }}>
                    {t('coachManagement.cancel')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
        {/* ── Modal confirmación ── */}
        <Modal
          visible={confirmModal.visible}
          transparent
          animationType="fade"
          onRequestClose={() => setConfirmModal((prev) => ({ ...prev, visible: false }))}
        >
          <View style={s.modalOverlay}>
            <View style={[s.modalBox, { backgroundColor: c.fondo, borderColor: c.bordeInput }]}>
              <Text style={[s.modalTitle, { color: c.texto }]}>{confirmModal.title}</Text>
              <Text style={{ color: c.subtexto, fontSize: 14, textAlign: "center", marginBottom: 20 }}>
                {confirmModal.message}
              </Text>
              <TouchableOpacity
                style={[s.btnPrimary, { backgroundColor: COLOR_PELIGRO }]}
                onPress={confirmModal.onConfirm}
              >
                <Text style={[s.btnPrimaryText, { color: "#fff" }]}>Confirmar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.btnSecondary}
                onPress={() => setConfirmModal((prev) => ({ ...prev, visible: false }))}
              >
                <Text style={{ color: c.subtexto, fontWeight: "600" }}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </View>
    </ScreenContainer>
  );
}

// Solo valores estructurales — sin colores
const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20 },
  headerTitle: { fontSize: 22, fontWeight: "800" },
  headerSub: { fontSize: 13, marginTop: 2 },

  teamPickerContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  teamPickerLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  teamChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 8,
  },
  teamChipText: { fontSize: 13, fontWeight: "600" },

  eventPicker: { paddingHorizontal: 20, paddingVertical: 12 },
  eventChip: {
    alignItems: "center",
    marginRight: 10,
    padding: 10,
    borderRadius: 12,
    minWidth: 110,
    maxWidth: 155,
  },
  eventChipText: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 15,
  },

  tabBar: { flexDirection: "row", paddingHorizontal: 20, borderBottomWidth: 1 },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: { fontSize: 11, fontWeight: "600" },

  tabContent: { padding: 20 },
  hintText: { textAlign: "center", marginTop: 20 },

  playerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    marginBottom: 8,
    borderRadius: 10,
  },
  playerName: { fontWeight: "600", fontSize: 14 },

  // Chips de convocatoria (Task 1)
  callupChipsRow: { flexDirection: "row", gap: 4, alignItems: "center" },
  callupChip: {
    height: 30,
    paddingHorizontal: 7,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 42,
  },
  callupChipText: { fontSize: 9, letterSpacing: 0.4 },

  // Badge de estado debajo del nombre (Task 2)
  callupStatusBadge: { fontSize: 10, fontWeight: "600", marginTop: 3 },

  // Estilos heredados usados en otras secciones del archivo
  statusChip: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  statusChipText: { fontSize: 12, fontWeight: "700" },

  btnPrimary: {
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  btnPrimaryText: { fontWeight: "700" },
  btnDanger: {
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  btnDangerText: { color: "#fff", fontWeight: "700" },
  btnSecondary: { padding: 14, alignItems: "center" },

  scoreInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalBox: {
    padding: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  modalTitle: { fontSize: 20, fontWeight: "700", marginBottom: 15 },
  modalLabel: { fontSize: 12, fontWeight: "600", marginBottom: 4 },

  searchInput: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 13, marginBottom: 0 },
  dropdown: { borderWidth: 1, borderRadius: 10, marginTop: 4, overflow: "hidden" },
  dropdownItem: { padding: 12, borderBottomWidth: 1 },
  linkedBadge: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 10, borderWidth: 1, padding: 10, marginBottom: 10 },

  // Dashboard global de estadísticas
  dashboardTitle: { fontSize: 15, fontWeight: "700", marginBottom: 16 },
  rankingSection: { marginBottom: 20 },
  rankingHeader: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 8,
  },
  rankingRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    marginBottom: 4,
  },
  rankingPos: { fontWeight: "800", fontSize: 13, width: 26 },
  rankingValue: { fontWeight: "800", fontSize: 17, marginLeft: 8 },
  rankingUnit: { fontSize: 11, marginLeft: 3 },

  metricChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  metricChipText: { fontSize: 13, fontWeight: "700" },
});
