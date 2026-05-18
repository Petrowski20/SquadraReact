import * as DocumentPicker from "expo-document-picker";
import { useFocusEffect, useRouter } from "expo-router";
import Papa from "papaparse";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Alert, Linking, Platform } from "react-native";
import { apiFetch } from "../../../../lib/api";
import { useAuthStore } from "../../../../lib/store";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: number;
  type: "TRAINING" | "MATCH";
  matchType?: string;
  startTime: string;
  endTime?: string;
  title: string;
  teamId: number;
  teamName: string;
  location?: string;
  fieldId?: number | null;
  goalsFor?: number | null;
  goalsAgainst?: number | null;
  matchStatus?: string | null;
}

export interface Team {
  id: number;
  category: string;
  suffix: string;
}

export interface Field {
  id: number;
  name: string;
  mapUrl?: string;
}

export interface EventForm {
  isHome: string;
  matchType: string;
  location: string;
  fieldId: number | null;
  endTime: string;
  recurring: boolean;
  recurringDays: number[];
  recurringEndDate: string;
  date: string;
  time: string;
  teamId?: string;
  opponentName?: string;
  notes?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];

export const MATCH_TYPES = [
  { value: "LEAGUE", label: "Liga" },
  { value: "FRIENDLY", label: "Amistoso" },
  { value: "CUP", label: "Copa" },
  { value: "TOURNAMENT", label: "Torneo" },
  { value: "OTHER", label: "Otro" },
];

export const MATCH_TYPE_DISPLAY: Record<string, { badge: string; icon: string }> = {
  LEAGUE: { badge: "LIGA", icon: "⚽" },
  CUP: { badge: "COPA", icon: "🏆" },
  TOURNAMENT: { badge: "TORNEO", icon: "🏆" },
  FRIENDLY: { badge: "AMISTOSO", icon: "🤝" },
  OTHER: { badge: "PARTIDO", icon: "⚽" },
};

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// ─── Utils ────────────────────────────────────────────────────────────────────

export const toDateString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const toTimeString = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

// Convierte fecha local (YYYY-MM-DD) + hora local (HH:MM) al ISO UTC correcto.
// Usar `new Date(y, m, d, h, min)` crea un Date en hora local; .toISOString() lo pasa a UTC.
export const buildUtcIso = (dateStr: string, timeStr: string): string => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = (timeStr || "00:00").split(":").map(Number);
  return new Date(y, m - 1, d, h, min, 0).toISOString();
};

export const formatSelectedDate = (dateStr: string | null): string => {
  if (!dateStr) return "Eventos del día";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAY_NAMES[date.getDay()]} ${d} de ${MESES[m - 1]}`;
};

export const getSeasonLabel = (y: number, m: number) =>
  m >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;

const EMPTY_FORM: EventForm = {
  isHome: "true",
  matchType: "LEAGUE",
  location: "",
  fieldId: null,
  endTime: "",
  recurring: false,
  recurringDays: [],
  recurringEndDate: "",
  date: "",
  time: "",
};

// ─── Context shape ────────────────────────────────────────────────────────────

interface DashboardContextValue {
  // Auth / roles
  clubId: number | null;
  myTeamId: number | null;
  isPresident: boolean;
  isCoach: boolean;
  canCreate: boolean;
  canDeleteEvent: (event: CalendarEvent) => boolean;

  // Data
  events: CalendarEvent[];
  teams: Team[];
  clubFields: Field[];

  // Calendar navigation
  year: number;
  month: number;
  currentSeasonLabel: string;
  goToPrevMonth: () => void;
  goToNextMonth: () => void;

  // Selection
  selectedDate: string | null;
  setSelectedDate: (date: string | null) => void;
  selectedDayEvents: CalendarEvent[];
  setSelectedDayEvents: (events: CalendarEvent[]) => void;

  // Filters
  selectedTeamId: number | null;
  setSelectedTeamId: (id: number | null) => void;

  // Loading states
  loading: boolean;
  isSubmitting: boolean;
  deletingId: string | null;
  isExporting: boolean;
  isImporting: boolean;

  // Modal visibility
  dayModal: boolean;
  setDayModal: (v: boolean) => void;
  createModal: boolean;
  setCreateModal: (v: boolean) => void;
  exportModal: boolean;
  setExportModal: (v: boolean) => void;
  importTeamModal: boolean;
  setImportTeamModal: (v: boolean) => void;

  // Create / Edit form
  createType: "TRAINING" | "MATCH";
  setCreateType: (t: "TRAINING" | "MATCH") => void;
  editingEvent: CalendarEvent | null;
  form: EventForm;
  setForm: React.Dispatch<React.SetStateAction<EventForm>>;
  createError: string;
  handleCancelCreate: () => void;

  // Export state
  exportFrom: string;
  setExportFrom: (v: string) => void;
  exportTo: string;
  setExportTo: (v: string) => void;
  exportTypes: ("TRAINING" | "MATCH")[];
  setExportTypes: React.Dispatch<React.SetStateAction<("TRAINING" | "MATCH")[]>>;

  // Picker state
  pickerDate: Date;
  setPickerDate: (d: Date) => void;
  showDatePicker: boolean;
  setShowDatePicker: (v: boolean) => void;
  showTimePicker: boolean;
  setShowTimePicker: (v: boolean) => void;
  showEndTimePicker: boolean;
  setShowEndTimePicker: (v: boolean) => void;
  pickerEndTime: Date;
  setPickerEndTime: (d: Date) => void;
  showRecurringEndPicker: boolean;
  setShowRecurringEndPicker: (v: boolean) => void;
  recurringEndDate: Date;
  setRecurringEndDate: (d: Date) => void;

  // Handlers
  fetchEvents: () => Promise<void>;
  handleCreateEvent: () => Promise<void>;
  handleDeleteEvent: (eventId: number, eventType: "TRAINING" | "MATCH") => Promise<void>;
  handleEditEvent: (event: CalendarEvent) => void;
  handleExportCSV: () => Promise<void>;
  handleImportClick: () => void;
  proceedWithImport: (teamId: number) => Promise<void>;
  handleOpenMap: (event: CalendarEvent) => Promise<void>;
}

// ─── Context + hook ───────────────────────────────────────────────────────────

const DashboardContext = createContext<DashboardContextValue | null>(null);

export const useDashboard = (): DashboardContextValue => {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used inside DashboardProvider");
  return ctx;
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const {
    activeClubId: clubId,
    activeRole: role,
    activeTeamId: myTeamId,
  } = useAuthStore();

  const isPresident = role === "PRESIDENT";
  const isCoach = role === "COACH";
  const isRelative = role === "RELATIVE";
  const canCreate = isCoach || isPresident;

  const canDeleteEvent = (event: CalendarEvent): boolean => {
    if (isPresident) return true;
    if (isCoach && event.teamId === myTeamId) return true;
    return false;
  };

  // ─── Data ───────────────────────────────────────────────────────────────
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [clubFields, setClubFields] = useState<Field[]>([]);
  const [createError, setCreateError] = useState("");

  // ─── Filters ────────────────────────────────────────────────────────────
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(
    isRelative ? (myTeamId ?? null) : null,
  );

  // ─── Loading ────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // ─── Selection ──────────────────────────────────────────────────────────
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState<CalendarEvent[]>([]);
  // Ref para leer selectedDate dentro de fetchEvents sin añadirlo a sus deps
  const selectedDateRef = useRef<string | null>(null);
  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  // ─── Modal visibility ───────────────────────────────────────────────────
  const [dayModal, setDayModal] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [exportModal, setExportModal] = useState(false);
  const [importTeamModal, setImportTeamModal] = useState(false);
  const [createType, setCreateType] = useState<"TRAINING" | "MATCH">("TRAINING");

  // ─── Export ─────────────────────────────────────────────────────────────
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exportTypes, setExportTypes] = useState<("TRAINING" | "MATCH")[]>(["TRAINING", "MATCH"]);

  // ─── Pickers ────────────────────────────────────────────────────────────
  const [pickerDate, setPickerDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [pickerEndTime, setPickerEndTime] = useState(new Date());
  const [showRecurringEndPicker, setShowRecurringEndPicker] = useState(false);
  const [recurringEndDate, setRecurringEndDate] = useState(new Date());

  // ─── Form ───────────────────────────────────────────────────────────────
  const [form, setForm] = useState<EventForm>(EMPTY_FORM);

  // ─── Calendar navigation ────────────────────────────────────────────────
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const currentSeasonLabel = getSeasonLabel(year, month);

  const goToPrevMonth = useCallback(() => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }, [month]);

  const goToNextMonth = useCallback(() => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }, [month]);

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleCancelCreate = useCallback(() => {
    setCreateModal(false);
    setEditingEvent(null);
    setCreateError("");
  }, []);

  // ─── API ────────────────────────────────────────────────────────────────

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const from = new Date(year, month, 1).toISOString();
      const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      const teamParam = selectedTeamId ? `&teamId=${selectedTeamId}` : "";
      const res = await apiFetch(
        `/api/calendar?clubId=${clubId}&seasonLabel=${currentSeasonLabel}${teamParam}&from=${from}&to=${to}&_t=${Date.now()}`,
      );
      const data: CalendarEvent[] = await res.json();
      setEvents([...data]);
      // En la carga inicial (selectedDate === null) fija la fecha local de hoy.
      // Construimos YYYY-MM-DD desde los componentes locales para evitar el offset UTC de toISOString.
      if (selectedDateRef.current === null) {
        const now = new Date();
        const localToday =
          now.getFullYear() +
          "-" +
          String(now.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(now.getDate()).padStart(2, "0");
        setSelectedDate(localToday);
      }
    } catch {
      Alert.alert("Error", "No se pudieron cargar los eventos.");
    } finally {
      setLoading(false);
    }
  }, [clubId, currentSeasonLabel, selectedTeamId, year, month]);

  const fetchTeams = useCallback(async () => {
    if (!isPresident && !isCoach) return;
    try {
      const res = await apiFetch(`/api/club/equipos/${clubId}`);
      setTeams(await res.json());
    } catch {}
  }, [clubId, isPresident, isCoach]);

  const fetchFields = useCallback(async () => {
    if (!canCreate) return;
    try {
      const res = await apiFetch(`/api/fields/club/${clubId}`);
      setClubFields(await res.json());
    } catch {}
  }, [clubId, canCreate]);

  useFocusEffect(
    useCallback(() => {
      fetchTeams();
      fetchFields();
      fetchEvents();
    }, [fetchTeams, fetchFields, fetchEvents]),
  );

  useEffect(() => {
    fetchTeams();
    fetchFields();
  }, [fetchTeams, fetchFields]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // ─── CREAR ──────────────────────────────────────────────────────────────

  const handleCreateEvent = async () => {
    setCreateError("");
    if (isSubmitting) return;

    const finalTeamId = isPresident ? form.teamId : myTeamId;

    if (!finalTeamId || !form.date || !form.time) {
      setCreateError("La fecha, la hora y el equipo son obligatorios.");
      return;
    }
    if (createType === "MATCH" && !form.opponentName?.trim()) {
      setCreateError("El nombre del rival es obligatorio para crear un partido.");
      return;
    }
    if (
      createType === "TRAINING" &&
      form.recurring &&
      (!form.recurringDays?.length || !form.recurringEndDate)
    ) {
      setCreateError("Selecciona al menos un día y una fecha de fin para la recurrencia.");
      return;
    }

    const [fy, fm, fd] = form.date.split("-").map(Number);
    const selectedDay = new Date(fy, fm - 1, fd);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDay < today) {
      setCreateError("La fecha no puede ser anterior a hoy.");
      return;
    }

    setIsSubmitting(true);
    try {
      const fieldIdValue = form.fieldId ? Number(form.fieldId) : null;
      const locationValue = form.fieldId ? null : form.location || null;
      if (editingEvent) {
        await apiFetch(
          `/api/calendar/${editingEvent.id}?clubId=${clubId}&type=${editingEvent.type}`,
          { method: "DELETE" },
        );
      }
      if (createType === "TRAINING" && form.recurring) {
        await apiFetch(`/api/calendar/training/recurring?clubId=${clubId}`, {
          method: "POST",
          body: JSON.stringify({
            teamId: Number(finalTeamId),
            startTime: `${form.time}:00`,
            endTime: form.endTime ? `${form.endTime}:00` : `${form.time}:00`,
            startDate: form.date,
            endDate: form.recurringEndDate,
            daysOfWeek: form.recurringDays,
            fieldId: fieldIdValue,
            location: locationValue,
            notes: form.notes,
          }),
        });
      } else {
        const formattedDate = buildUtcIso(form.date, form.time);
        const endpoint =
          createType === "TRAINING" ? "/api/calendar/training" : "/api/calendar/match";
        const body =
          createType === "TRAINING"
            ? {
                teamId: Number(finalTeamId),
                startTime: formattedDate,
                endTime: form.endTime
                  ? buildUtcIso(form.date, form.endTime)
                  : formattedDate,
                fieldId: fieldIdValue,
                location: locationValue,
                notes: form.notes || null,
                seasonLabel: currentSeasonLabel,
              }
            : {
                teamId: Number(finalTeamId),
                opponentName: form.opponentName,
                matchDate: formattedDate,
                fieldId: fieldIdValue,
                location: locationValue,
                isHome: form.isHome === "true",
                matchType: form.matchType,
                seasonLabel: currentSeasonLabel,
              };
        console.log("PAYLOAD ENTRENAMIENTO:", body);
        const res = await apiFetch(`${endpoint}?clubId=${clubId}`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          Alert.alert("Error", "No se pudo guardar el evento");
          return;
        }
      }
      setCreateModal(false);
      setEditingEvent(null);
      setForm(EMPTY_FORM);
      fetchEvents();
      Alert.alert(
        "Éxito",
        editingEvent
          ? "Evento actualizado correctamente."
          : "Evento programado correctamente.",
      );
    } catch {
      Alert.alert(
        "Error",
        editingEvent
          ? "No se pudo actualizar el evento."
          : "No se pudo crear el evento.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── BORRAR ─────────────────────────────────────────────────────────────

  const handleDeleteEvent = async (eventId: number, eventType: "TRAINING" | "MATCH") => {
    const eventKey = `${eventType}-${eventId}`;
    setDeletingId(eventKey);
    try {
      const res = await apiFetch(
        `/api/calendar/${eventId}?clubId=${clubId}&type=${eventType}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        Alert.alert("Error", `No se pudo eliminar el evento (HTTP ${res.status}).`);
        return;
      }
      setEvents((prev) =>
        prev.filter((e) => !(e.type === eventType && e.id === eventId)),
      );
      setSelectedDayEvents((prev) =>
        prev.filter((e) => !(e.type === eventType && e.id === eventId)),
      );
      setDayModal(false);
      fetchEvents();
    } catch {
      Alert.alert("Error", "No se pudo eliminar el evento. Comprueba tu conexión.");
    } finally {
      setDeletingId(null);
    }
  };

  // ─── EDITAR ─────────────────────────────────────────────────────────────

  const handleEditEvent = (event: CalendarEvent) => {
    const date = new Date(event.startTime);
    setCreateType(event.type);
    setForm({
      isHome: event.title.startsWith("vs ")
        ? "true"
        : event.title.startsWith("@ ")
          ? "false"
          : "true",
      matchType: event.matchType || "LEAGUE",
      location: event.location || "",
      fieldId: event.fieldId ?? null,
      endTime: event.endTime ? toTimeString(new Date(event.endTime)) : "",
      recurring: false,
      recurringDays: [],
      recurringEndDate: "",
      date: toDateString(date),
      time: toTimeString(date),
      teamId: String(event.teamId),
      opponentName:
        event.type === "MATCH" ? event.title.replace(/^(vs |@ )/i, "") : "",
    });
    setEditingEvent(event);
    setDayModal(false);
    setCreateModal(true);
  };

  // ─── EXPORTAR CSV ───────────────────────────────────────────────────────

  const handleExportCSV = async () => {
    if (!exportFrom || !exportTo) {
      Alert.alert("Atención", "Selecciona un rango de fechas.");
      return;
    }
    setIsExporting(true);
    try {
      const from = new Date(`${exportFrom}T00:00:00`).toISOString();
      const to = new Date(`${exportTo}T23:59:59`).toISOString();
      const res = await apiFetch(
        `/api/calendar?clubId=${clubId}&seasonLabel=${currentSeasonLabel}&from=${from}&to=${to}`,
      );
      const data: CalendarEvent[] = await res.json();
      const filtered = data.filter((e) => exportTypes.includes(e.type));

      if (filtered.length === 0) {
        Alert.alert("Sin resultados", "No hay eventos en ese rango.");
        return;
      }

      const header = "Tipo,Título,Equipo,Fecha,Hora inicio,Hora fin,Ubicación";
      const rows = filtered.map((e) => {
        const tipo = e.type === "MATCH" ? "Partido" : "Entrenamiento";
        const fecha = new Date(e.startTime).toLocaleDateString("es-ES");
        const horaInicio = new Date(e.startTime).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        const horaFin = e.endTime
          ? new Date(e.endTime).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";
        const ubicacion = e.location || "";
        return `${tipo},"${e.title}","${e.teamName}",${fecha},${horaInicio},${horaFin},"${ubicacion}"`;
      });

      const csv = [header, ...rows].join("\n");

      if (Platform.OS === "web") {
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `eventos_${exportFrom}_${exportTo}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        const FS = (await import("expo-file-system")) as any;
        const Share = (await import("expo-sharing")) as any;
        const path = `${FS.documentDirectory}eventos.csv`;
        await FS.writeAsStringAsync(path, csv, {
          encoding: FS.EncodingType.UTF8,
        });
        await Share.shareAsync(path);
      }
      setExportModal(false);
    } catch {
      Alert.alert("Error", "No se pudo exportar.");
    } finally {
      setIsExporting(false);
    }
  };

  // ─── IMPORTAR CSV / JSON ─────────────────────────────────────────────────

  const handleImportClick = () => {
    if (isPresident) {
      if (!teams.length) {
        Alert.alert("Atención", "No hay equipos en el club.");
        return;
      }
      setImportTeamModal(true);
    } else {
      if (!myTeamId) {
        Alert.alert("Atención", "No tienes equipo asignado.");
        return;
      }
      proceedWithImport(myTeamId);
    }
  };

  const proceedWithImport = async (teamId: number) => {
    try {
      setIsImporting(true);
      const result = await DocumentPicker.getDocumentAsync({
        type:
          Platform.OS === "android"
            ? "*/*"
            : ["text/csv", "text/plain", "application/json"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      let text: string;
      if (Platform.OS === "web") {
        text = await fetch(asset.uri).then((r) => r.text());
      } else {
        const FS = (await import("expo-file-system")) as any;
        text = await FS.readAsStringAsync(asset.uri);
      }

      const isJson = asset.name?.toLowerCase().endsWith(".json");
      let rows: any[];
      if (isJson) {
        const parsed = JSON.parse(text);
        rows = Array.isArray(parsed) ? parsed : [parsed];
      } else {
        const { data } = Papa.parse<any>(text, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
        });
        rows = data;
      }

      if (!rows.length) {
        Alert.alert("Sin datos", "No se encontraron registros en el archivo.");
        return;
      }

      // Reconstruye UTC desde dd/mm/yyyy + HH:MM (formato del export propio).
      // Usa new Date(y, m, d, h, min) para crear el Date en hora local antes de llamar a .toISOString()
      const buildIso = (fecha: string, hora: string): string => {
        const parts = String(fecha).split("/");
        let y: number, m: number, d: number;
        if (parts.length === 3) {
          [d, m, y] = parts.map(Number);
        } else {
          const iso = fecha.split("-").map(Number);
          [y, m, d] = iso;
        }
        const [h, min] = (hora || "00:00").split(":").map(Number);
        return new Date(y, m - 1, d, h, min, 0).toISOString();
      };

      const normalizedFields = clubFields.map((f) => ({
        ...f,
        _norm: f.name.trim().toLowerCase(),
      }));

      const candidatos: CalendarEvent[] = rows.map((row) => {
        const startTime =
          row.startTime ||
          (row.Fecha
            ? buildIso(String(row.Fecha), row["Hora inicio"] || "00:00")
            : new Date().toISOString());

        const endTime =
          row.endTime ||
          (row.Fecha && row["Hora fin"]
            ? buildIso(String(row.Fecha), row["Hora fin"])
            : undefined);

        const rawLocation: string | undefined =
          row.location || row.Ubicación || undefined;

        let linkedFieldId: number | null = null;
        if (rawLocation) {
          const norm = rawLocation.trim().toLowerCase();
          const matched = normalizedFields.find((f) => f._norm === norm);
          if (matched) linkedFieldId = matched.id;
        }

        return {
          id: -(Date.now() + Math.random()),
          type:
            row.type === "MATCH" || row.Tipo === "Partido" ? "MATCH" : "TRAINING",
          startTime,
          endTime,
          title: row.title || row.Título || row.titulo || "Importado",
          teamId,
          teamName: row.teamName || row.Equipo || "",
          location: rawLocation,
          fieldId: linkedFieldId,
        };
      });

      const existingKeys = new Set(
        events.map((e) => `${e.type}|${new Date(e.startTime).getTime()}`),
      );
      const nuevos = candidatos.filter(
        (e) =>
          !existingKeys.has(`${e.type}|${new Date(e.startTime).getTime()}`),
      );
      const partidosOmitidos = candidatos.length - nuevos.length;
      const partidosAñadidos = nuevos.length;

      if (partidosAñadidos === 0) {
        Alert.alert(
          "Sin novedades",
          "Todos los eventos del archivo ya estaban registrados.",
        );
        return;
      }

      setEvents((prev) => [...prev, ...nuevos]);
      const linked = nuevos.filter((e) => e.fieldId).length;

      let msg: string;
      if (partidosOmitidos > 0 && linked > 0) {
        msg = `Se han importado ${partidosAñadidos} partidos para el equipo seleccionado. Se omitieron ${partidosOmitidos} duplicados. ${linked} ubicación(es) enlazadas automáticamente.`;
      } else if (partidosOmitidos > 0) {
        msg = `Se han importado ${partidosAñadidos} partidos para el equipo seleccionado. Se omitieron ${partidosOmitidos} duplicados.`;
      } else if (linked > 0) {
        msg = `Se han importado ${partidosAñadidos} partidos para el equipo seleccionado. ${linked} ubicación(es) enlazadas automáticamente.`;
      } else {
        msg = `Se han importado ${partidosAñadidos} partidos para el equipo seleccionado.`;
      }
      Alert.alert("Importación Completada", msg);
    } catch {
      Alert.alert(
        "Error de formato",
        "El archivo tiene un formato inválido o no se pudo leer.",
      );
    } finally {
      setIsImporting(false);
    }
  };

  // ─── MAPA ────────────────────────────────────────────────────────────────

  const handleOpenMap = async (event: CalendarEvent) => {
    let url: string | null = null;
    if (event.fieldId) {
      const field = clubFields.find((f) => f.id === event.fieldId);
      if (field?.mapUrl) url = field.mapUrl;
    }
    if (!url && event.location) {
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`;
    }
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Error", "No se pudo abrir el mapa.");
    }
  };

  // ─── Value ───────────────────────────────────────────────────────────────

  const value: DashboardContextValue = {
    clubId,
    myTeamId,
    isPresident,
    isCoach,
    canCreate,
    canDeleteEvent,
    events,
    teams,
    clubFields,
    year,
    month,
    currentSeasonLabel,
    goToPrevMonth,
    goToNextMonth,
    selectedDate,
    setSelectedDate,
    selectedDayEvents,
    setSelectedDayEvents,
    selectedTeamId,
    setSelectedTeamId,
    loading,
    isSubmitting,
    deletingId,
    isExporting,
    isImporting,
    dayModal,
    setDayModal,
    createModal,
    setCreateModal,
    exportModal,
    setExportModal,
    importTeamModal,
    setImportTeamModal,
    createType,
    setCreateType,
    editingEvent,
    form,
    setForm,
    createError,
    handleCancelCreate,
    exportFrom,
    setExportFrom,
    exportTo,
    setExportTo,
    exportTypes,
    setExportTypes,
    pickerDate,
    setPickerDate,
    showDatePicker,
    setShowDatePicker,
    showTimePicker,
    setShowTimePicker,
    showEndTimePicker,
    setShowEndTimePicker,
    pickerEndTime,
    setPickerEndTime,
    showRecurringEndPicker,
    setShowRecurringEndPicker,
    recurringEndDate,
    setRecurringEndDate,
    fetchEvents,
    handleCreateEvent,
    handleDeleteEvent,
    handleEditEvent,
    handleExportCSV,
    handleImportClick,
    proceedWithImport,
    handleOpenMap,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}
