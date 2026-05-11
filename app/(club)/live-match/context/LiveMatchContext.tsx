import { useLocalSearchParams, useRouter } from "expo-router";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Alert } from "react-native";
import { apiFetch } from "../../../../lib/api";
import { useAuthStore } from "../../../../lib/store";

// ─── Types ───────────────────────────────────────────────────────────────────

export type MatchMode = "LIVE" | "EDIT";
export type Step = "callups" | "stats";
export type LiveTab = "field" | "timeline";

export interface MatchEvent {
  id: string;
  playerId: number;
  type: "SUB_IN" | "SUB_OUT" | "RED_CARD" | "YELLOW_CARD" | "GOAL" | "ASSIST";
  minute: number;
}

export interface CallupEntry {
  playerId: number;
  firstName: string;
  lastName: string;
  status: "CALLED_UP" | "NOT_CALLED_UP" | "INJURED";
}

export interface StatsEntry {
  playerId: number;
  firstName: string;
  lastName: string;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  minutesPlayed: number;
  wasStarter: boolean;
  position?: string;
  assignedPosition?: string;
}

// ─── Formations ──────────────────────────────────────────────────────────────

export const FORMATIONS = [
  { id: "4-4-2", label: "4-4-2", por: 1, def: 4, med: 4, del: 2 },
  { id: "4-3-3", label: "4-3-3", por: 1, def: 4, med: 3, del: 3 },
  { id: "3-5-2", label: "3-5-2", por: 1, def: 3, med: 5, del: 2 },
  { id: "3-2-1", label: "3-2-1 ⑦", por: 1, def: 3, med: 2, del: 1 },
] as const;

// ─── Constants ───────────────────────────────────────────────────────────────

export const STAT_FIELDS: { label: string; field: keyof StatsEntry }[] = [
  { label: "Goles", field: "goals" },
  { label: "Asist.", field: "assists" },
  { label: "Amarillas", field: "yellowCards" },
  { label: "Rojas", field: "redCards" },
  { label: "Minutos", field: "minutesPlayed" },
];

export const formatTime = (total: number) => {
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

// ─── Position helpers (pure, module-level) ────────────────────────────────────

export const POSITION_MAP: Record<string, string> = {
  POR: "Porteros", GK: "Porteros", PORTERO: "Porteros",
  DEF: "Defensas", CB: "Defensas", LB: "Defensas", RB: "Defensas",
  WB: "Defensas", DEFENSA: "Defensas",
  MED: "Centrocampistas", CM: "Centrocampistas", MC: "Centrocampistas",
  CAM: "Centrocampistas", CDM: "Centrocampistas", CENTROCAMPISTA: "Centrocampistas",
  MEDIOCAMPISTA: "Centrocampistas",
  DEL: "Delanteros", FW: "Delanteros", ST: "Delanteros", CF: "Delanteros",
  LW: "Delanteros", RW: "Delanteros", DELANTERO: "Delanteros", ATACANTE: "Delanteros",
};

export const POSITION_ORDER = ["Porteros", "Defensas", "Centrocampistas", "Delanteros", "Otros"];

export function groupByPosition(players: StatsEntry[]): Record<string, StatsEntry[]> {
  return players.reduce(
    (acc, player) => {
      const raw = (player.position ?? "").toUpperCase();
      const group = POSITION_MAP[raw] ?? "Otros";
      return { ...acc, [group]: [...(acc[group] ?? []), player] };
    },
    {} as Record<string, StatsEntry[]>,
  );
}

export function getPlayerStatus(
  playerId: number,
  wasStarter: boolean,
  events: MatchEvent[],
): { isCurrentlyPlaying: boolean; isBench: boolean; isSubbedOut: boolean } {
  const subEvents = events
    .filter((e) => e.playerId === playerId && (e.type === "SUB_IN" || e.type === "SUB_OUT"))
    .sort((a, b) => a.minute - b.minute);
  if (subEvents.length === 0) {
    return { isCurrentlyPlaying: wasStarter, isBench: !wasStarter, isSubbedOut: false };
  }
  const lastSub = subEvents[subEvents.length - 1];
  const isCurrentlyPlaying = lastSub.type === "SUB_IN";
  const hasEverPlayed = wasStarter || subEvents.some((e) => e.type === "SUB_IN");
  return {
    isCurrentlyPlaying,
    isBench: !hasEverPlayed,
    isSubbedOut: hasEverPlayed && !isCurrentlyPlaying,
  };
}

// ─── Context interface ────────────────────────────────────────────────────────

interface LiveMatchContextValue {
  // Params / mode
  matchId: string;
  matchMode: MatchMode;
  isLive: boolean;
  // Step / tabs
  step: Step;
  setStep: React.Dispatch<React.SetStateAction<Step>>;
  liveTab: LiveTab;
  setLiveTab: React.Dispatch<React.SetStateAction<LiveTab>>;
  selectedFormation: string | null;
  setSelectedFormation: React.Dispatch<React.SetStateAction<string | null>>;
  pitchPlayer: StatsEntry | null;
  setPitchPlayer: React.Dispatch<React.SetStateAction<StatsEntry | null>>;
  // Data
  stats: StatsEntry[];
  visibleStats: StatsEntry[];
  calledUpIds: Set<number>;
  matchEvents: MatchEvent[];
  // Loading flags
  loading: boolean;
  saving: boolean;
  closing: boolean;
  // Stopwatch
  seconds: number;
  isRunning: boolean;
  setIsRunning: React.Dispatch<React.SetStateAction<boolean>>;
  setSeconds: React.Dispatch<React.SetStateAction<number>>;
  // Close-match modal
  closeModal: boolean;
  setCloseModal: React.Dispatch<React.SetStateAction<boolean>>;
  goalsFor: string;
  setGoalsFor: React.Dispatch<React.SetStateAction<string>>;
  goalsAgainst: string;
  setGoalsAgainst: React.Dispatch<React.SetStateAction<string>>;
  // Sub modal
  subModalVisible: boolean;
  playerToSubOut: StatsEntry | null;
  closeSubModal: () => void;
  // Actions
  updateStat: (playerId: number, field: keyof StatsEntry, value: number | boolean | string) => void;
  getStatus: (playerId: number, wasStarter: boolean) => ReturnType<typeof getPlayerStatus>;
  calculateMinutes: (playerId: number, wasStarter: boolean) => number;
  handleOpenSubModal: (player: StatsEntry) => void;
  handleConfirmSub: (benchPlayer: StatsEntry) => void;
  handleRedCard: (player: StatsEntry) => void;
  handleYellowCard: (player: StatsEntry) => void;
  handleGoal: (player: StatsEntry) => void;
  handleAssist: (player: StatsEntry) => void;
  handleUndoEvent: (eventId: string) => void;
  handleSave: () => Promise<void>;
  handleClose: () => Promise<void>;
  handleResetMatch: () => void;
}

const LiveMatchContext = createContext<LiveMatchContextValue | null>(null);

export function useLiveMatch(): LiveMatchContextValue {
  const ctx = useContext(LiveMatchContext);
  if (!ctx) throw new Error("useLiveMatch must be used within LiveMatchProvider");
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function LiveMatchProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { matchId, mode } = useLocalSearchParams<{ matchId: string; mode: string }>();
  const { activeClubId: clubId } = useAuthStore();

  const matchMode: MatchMode = mode === "EDIT" ? "EDIT" : "LIVE";
  const isLive = matchMode === "LIVE";

  const [step, setStep] = useState<Step>(isLive ? "callups" : "stats");

  const [calledUpIds, setCalledUpIds] = useState<Set<number>>(new Set());
  const [stats, setStats] = useState<StatsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);

  // Stopwatch — functional updater (s) => s + 1 keeps `seconds` out of deps,
  // preventing the interval from restarting every tick.
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  const [closeModal, setCloseModal] = useState(false);
  const [goalsFor, setGoalsFor] = useState("");
  const [goalsAgainst, setGoalsAgainst] = useState("");

  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>([]);

  const [subModalVisible, setSubModalVisible] = useState(false);
  const [playerToSubOut, setPlayerToSubOut] = useState<StatsEntry | null>(null);

  const [selectedFormation, setSelectedFormation] = useState<string | null>(null);
  const [liveTab, setLiveTab] = useState<LiveTab>("field");
  const [pitchPlayer, setPitchPlayer] = useState<StatsEntry | null>(null);

  // ── Stopwatch ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [callupsRes, statsRes] = await Promise.all([
        apiFetch(`/api/coach/match/callups/${matchId}?clubId=${clubId}`),
        apiFetch(`/api/coach/match/${matchId}/stats?clubId=${clubId}`),
      ]);

      if (!callupsRes.ok || !statsRes.ok) {
        Alert.alert("Error", "No se pudo cargar la información del partido.");
        return;
      }

      const callupsData: CallupEntry[] = await callupsRes.json();
      const statsData: StatsEntry[] = await statsRes.json();

      const calledUp = new Set<number>(
        callupsData
          .filter((entry) => entry.status === "CALLED_UP")
          .map((entry) => entry.playerId),
      );

      setCalledUpIds(calledUp);
      setStats(statsData);
    } catch {
      Alert.alert("Error", "Error de red al cargar el partido.");
    } finally {
      setLoading(false);
    }
  }, [matchId, clubId]);

  // Reset all transient match state when navigating to a different match
  useEffect(() => {
    setMatchEvents([]);
    setSeconds(0);
    setIsRunning(false);
    setStep(isLive ? "callups" : "stats");
    setStats([]);
    setCalledUpIds(new Set());
  }, [matchId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const visibleStats = stats.filter((p) => calledUpIds.has(p.playerId));

  // ── Stat mutation ─────────────────────────────────────────────────────────
  const updateStat = (
    playerId: number,
    field: keyof StatsEntry,
    value: number | boolean | string,
  ) => {
    setStats((prev) =>
      prev.map((p) => (p.playerId === playerId ? { ...p, [field]: value } : p)),
    );
  };

  // ── Status helper (closes over matchEvents) ───────────────────────────────
  const getStatus = (playerId: number, wasStarter: boolean) =>
    getPlayerStatus(playerId, wasStarter, matchEvents);

  // ── Minute calculation ────────────────────────────────────────────────────
  const calculateMinutes = (playerId: number, wasStarter: boolean): number => {
    const currentMinute = Math.floor(seconds / 60);
    const events = matchEvents
      .filter((e) => e.playerId === playerId && (e.type === "SUB_IN" || e.type === "SUB_OUT"))
      .sort((a, b) => a.minute - b.minute);

    if (events.length === 0) return wasStarter ? currentMinute : 0;

    let total = 0;
    let entryMinute: number | null = wasStarter ? 0 : null;

    for (const event of events) {
      if (event.type === "SUB_IN") {
        entryMinute = event.minute;
      } else if (event.type === "SUB_OUT" && entryMinute !== null) {
        total += event.minute - entryMinute;
        entryMinute = null;
      }
    }

    if (entryMinute !== null) total += currentMinute - entryMinute;
    return total;
  };

  // ── Substitution handlers ─────────────────────────────────────────────────
  const handleOpenSubModal = (player: StatsEntry) => {
    setPlayerToSubOut(player);
    setSubModalVisible(true);
  };

  const closeSubModal = () => {
    setSubModalVisible(false);
    setPlayerToSubOut(null);
  };

  const handleConfirmSub = (benchPlayer: StatsEntry) => {
    if (!playerToSubOut) return;
    const currentMinute = Math.floor(seconds / 60);
    if (playerToSubOut.assignedPosition) {
      updateStat(benchPlayer.playerId, "assignedPosition", playerToSubOut.assignedPosition);
    }
    const ts = Date.now();
    setMatchEvents((prev) => [
      ...prev,
      { id: `${ts}-out`, playerId: playerToSubOut.playerId, type: "SUB_OUT", minute: currentMinute },
      { id: `${ts}-in`, playerId: benchPlayer.playerId, type: "SUB_IN", minute: currentMinute },
    ]);
    setSubModalVisible(false);
    setPlayerToSubOut(null);
    setPitchPlayer(null);
  };

  // ── Event handlers ────────────────────────────────────────────────────────
  const handleRedCard = (player: StatsEntry) => {
    const currentMinute = Math.floor(seconds / 60);
    updateStat(player.playerId, "redCards", player.redCards + 1);
    setMatchEvents((prev) => [
      ...prev,
      { id: `${Date.now()}-rc`, playerId: player.playerId, type: "RED_CARD", minute: currentMinute },
    ]);
  };

  const handleYellowCard = (player: StatsEntry) => {
    const currentMinute = Math.floor(seconds / 60);
    const newYellowCount = player.yellowCards + 1;
    updateStat(player.playerId, "yellowCards", newYellowCount);
    setMatchEvents((prev) => [
      ...prev,
      { id: `${Date.now()}-yc`, playerId: player.playerId, type: "YELLOW_CARD", minute: currentMinute },
    ]);
    if (isLive && newYellowCount === 2) {
      handleRedCard(player);
      Alert.alert(
        "Doble Amarilla",
        `El jugador ha recibido la segunda amarilla y ha sido expulsado en el min ${currentMinute}.`,
      );
    }
  };

  const handleGoal = (player: StatsEntry) => {
    const currentMinute = Math.floor(seconds / 60);
    updateStat(player.playerId, "goals", player.goals + 1);
    setMatchEvents((prev) => [
      ...prev,
      { id: `${Date.now()}-goal`, playerId: player.playerId, type: "GOAL", minute: currentMinute },
    ]);
  };

  const handleAssist = (player: StatsEntry) => {
    const currentMinute = Math.floor(seconds / 60);
    updateStat(player.playerId, "assists", player.assists + 1);
    setMatchEvents((prev) => [
      ...prev,
      { id: `${Date.now()}-assist`, playerId: player.playerId, type: "ASSIST", minute: currentMinute },
    ]);
  };

  // ── Undo event ────────────────────────────────────────────────────────────
  const handleUndoEvent = (eventId: string) => {
    const event = matchEvents.find((e) => e.id === eventId);
    if (!event) return;
    // Functional updater ensures we always operate on the latest stats snapshot
    setStats((prev) =>
      prev.map((p) => {
        if (p.playerId !== event.playerId) return p;
        switch (event.type) {
          case "GOAL":        return { ...p, goals:       Math.max(0, p.goals - 1) };
          case "ASSIST":      return { ...p, assists:     Math.max(0, p.assists - 1) };
          case "YELLOW_CARD": return { ...p, yellowCards: Math.max(0, p.yellowCards - 1) };
          case "RED_CARD":    return { ...p, redCards:    Math.max(0, p.redCards - 1) };
          default:            return p; // SUB_IN/SUB_OUT: getStatus recalculates from events
        }
      }),
    );
    setMatchEvents((prev) => [...prev.filter((e) => e.id !== eventId)]);
  };

  // ── Save stats ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const entriesToSave = isLive
        ? visibleStats.map((p) => ({
            ...p,
            minutesPlayed: calculateMinutes(p.playerId, p.wasStarter),
          }))
        : visibleStats;

      const res = await apiFetch(
        `/api/coach/match/${matchId}/stats/bulk?clubId=${clubId}`,
        {
          method: "PUT",
          body: JSON.stringify({ entries: entriesToSave }),
        },
      );
      if (!res.ok) {
        Alert.alert("Error", `No se pudo guardar (HTTP ${res.status}).`);
        return;
      }
      Alert.alert("Guardado", "Estadísticas actualizadas correctamente.");
    } catch {
      Alert.alert("Error", "Error de red al guardar.");
    } finally {
      setSaving(false);
    }
  };

  // ── Close match ───────────────────────────────────────────────────────────
  const handleClose = async () => {
    if (!goalsFor || !goalsAgainst) {
      Alert.alert("Atención", "Introduce el marcador final.");
      return;
    }
    if (closing) return;
    setClosing(true);
    try {
      const res = await apiFetch(
        `/api/coach/match/${matchId}/close?clubId=${clubId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            goalsFor: Number(goalsFor),
            goalsAgainst: Number(goalsAgainst),
          }),
        },
      );
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        Alert.alert("Error", msg || `No se pudo cerrar el partido (HTTP ${res.status}).`);
        return;
      }
      setCloseModal(false);
      router.replace("/(club)/calendario");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Error de red al cerrar el partido.");
    } finally {
      setClosing(false);
    }
  };

  // ── Reset match ───────────────────────────────────────────────────────────
  const applyReset = () => {
    setMatchEvents([]);
    setSeconds(0);
    setIsRunning(false);
    setStep("callups");
    setSelectedFormation(null);
    setLiveTab("field");
    setPitchPlayer(null);
    setStats((prev) =>
      prev.map((p) => ({
        ...p,
        goals: 0,
        assists: 0,
        yellowCards: 0,
        redCards: 0,
        minutesPlayed: 0,
        wasStarter: false,
        assignedPosition: undefined,
      })),
    );
  };

  const handleResetMatch = () => {
    Alert.alert(
      "¿Estás seguro?",
      "Esto borrará los titulares, el cronómetro y todos los eventos registrados hasta ahora.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Resetear", style: "destructive", onPress: applyReset },
      ],
    );
  };

  return (
    <LiveMatchContext.Provider
      value={{
        matchId: matchId ?? "",
        matchMode,
        isLive,
        step,
        setStep,
        liveTab,
        setLiveTab,
        selectedFormation,
        setSelectedFormation,
        pitchPlayer,
        setPitchPlayer,
        stats,
        visibleStats,
        calledUpIds,
        matchEvents,
        loading,
        saving,
        closing,
        seconds,
        isRunning,
        setIsRunning,
        setSeconds,
        closeModal,
        setCloseModal,
        goalsFor,
        setGoalsFor,
        goalsAgainst,
        setGoalsAgainst,
        subModalVisible,
        playerToSubOut,
        closeSubModal,
        updateStat,
        getStatus,
        calculateMinutes,
        handleOpenSubModal,
        handleConfirmSub,
        handleRedCard,
        handleYellowCard,
        handleGoal,
        handleAssist,
        handleUndoEvent,
        handleSave,
        handleClose,
        handleResetMatch,
      }}
    >
      {children}
    </LiveMatchContext.Provider>
  );
}
