import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert, Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import ScreenContainer from "../../components/ScreenContainer";
import { apiFetch } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { useTheme } from "../../lib/useTheme";

interface CalendarEvent {
  id: number;
  type: "TRAINING" | "MATCH";
  startTime: string;
  endTime?: string;
  title: string;
  teamId: number;
  teamName: string;
  location?: string;
}

interface Team {
  id: number;
  category: string;
  suffix: string;
}
interface Field {
  id: number;
  name: string;
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];

const MATCH_TYPES = [
  { value: "LEAGUE", label: "Liga" },
  { value: "FRIENDLY", label: "Amistoso" },
  { value: "CUP", label: "Copa" },
  { value: "TOURNAMENT", label: "Torneo" },
  { value: "OTHER", label: "Otro" },
];

// PickerBtn definido a nivel de módulo para evitar que React lo desmonte
// en cada re-render del componente padre (pérdida de foco).
type PickerColors = { input: string; boton: string; bordeInput: string; texto: string; subtexto: string };

const PickerBtn = ({
  label, value, onPress, mode, onChange, colors,
}: {
  label: string;
  value: string;
  onPress: () => void;
  mode: "date" | "time";
  onChange?: (v: string) => void;
  colors: PickerColors;
}) => {
  if (Platform.OS === "web") {
    return (
      <View style={[styles.pickerBtn, { backgroundColor: colors.input, borderColor: value ? colors.boton : colors.bordeInput }]}>
        <input
          type={mode}
          value={value || ""}
          onChange={(e) => onChange?.(e.target.value)}
          style={{ border: "none", background: "transparent", fontSize: 15, color: colors.texto, outline: "none", width: "100%", padding: 4 }}
        />
      </View>
    );
  }
  return (
    <TouchableOpacity style={[styles.pickerBtn, { backgroundColor: colors.input, borderColor: value ? colors.boton : colors.bordeInput }]} onPress={onPress}>
      <Text style={{ color: value ? colors.texto : colors.subtexto, fontSize: 15 }}>{value || label}</Text>
    </TouchableOpacity>
  );
};

const toDateString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const toTimeString = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const formatSelectedDate = (dateStr: string | null): string => {
  if (!dateStr) return "Eventos del día";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAY_NAMES[date.getDay()]} ${d} de ${MESES[m - 1]}`;
};

export default function Calendario() {
  const c = useTheme();

  const {
    activeClubId: clubId,
    activeRole: role,
    activeTeamId: myTeamId,
  } = useAuthStore();

  const router = useRouter();
  const isPresident = role === "PRESIDENT";
  const isCoach = role === "COACH";
  const isRelative = role === "RELATIVE";
  const canCreate = isCoach || isPresident;

  const canDeleteEvent = (event: CalendarEvent): boolean => {
    if (isPresident) return true;
    if (isCoach && event.teamId === myTeamId) return true;
    return false;
  };

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [clubFields, setClubFields] = useState<Field[]>([]);

  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(
    isRelative ? (myTeamId ?? null) : null,
  );
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState<CalendarEvent[]>([]);
  const [dayModal, setDayModal] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [createType, setCreateType] = useState<"TRAINING" | "MATCH">("TRAINING");

  // Export
  const [exportModal, setExportModal] = useState(false);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exportTypes, setExportTypes] = useState<("TRAINING" | "MATCH")[]>(["TRAINING", "MATCH"]);
  const [isExporting, setIsExporting] = useState(false);

  // Pickers
  const [pickerDate, setPickerDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [pickerEndTime, setPickerEndTime] = useState(new Date());
  const [showRecurringEndPicker, setShowRecurringEndPicker] = useState(false);
  const [recurringEndDate, setRecurringEndDate] = useState(new Date());

  const [form, setForm] = useState<any>({
    isHome: "true",
    matchType: "LEAGUE",
    location: "",
    fieldId: null as number | null,
    endTime: "",
    recurring: false,
    recurringDays: [] as number[],
    recurringEndDate: "",
    date: "",
    time: "",
  });

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const getSeasonLabel = (y: number, m: number) =>
    m >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  const currentSeasonLabel = getSeasonLabel(year, month);

  // ─── API ──────────────────────────────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const from = new Date(year, month, 1).toISOString();
      const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      const teamParam = selectedTeamId ? `&teamId=${selectedTeamId}` : "";
      const res = await apiFetch(
        `/api/calendar?clubId=${clubId}&seasonLabel=${currentSeasonLabel}${teamParam}&from=${from}&to=${to}`,
      );
      const data: CalendarEvent[] = await res.json();
      setEvents(data);
    } catch {
      Alert.alert("Error", "No se pudieron cargar los eventos.");
    } finally {
      setLoading(false);
    }
  }, [clubId, currentSeasonLabel, selectedTeamId, year, month]);

  const fetchTeams = useCallback(async () => {
    if (!isPresident) return;
    try {
      const res = await apiFetch(`/api/club/equipos/${clubId}`);
      setTeams(await res.json());
    } catch {}
  }, [clubId, isPresident]);

  const fetchFields = useCallback(async () => {
    if (!canCreate) return;
    try {
      const res = await apiFetch(`/api/fields/club/${clubId}`);
      setClubFields(await res.json());
    } catch {}
  }, [clubId, canCreate]);

  const isMountedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!isMountedRef.current) {
        isMountedRef.current = true;
        return;
      }
      let isActive = true;
      fetchTeams();
      fetchFields();
      fetchEvents();
      return () => { isActive = false; };
    }, [fetchTeams, fetchFields, fetchEvents])
  );

  useEffect(() => { fetchTeams(); fetchFields(); }, [fetchTeams, fetchFields]);
  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // ─── CREAR ────────────────────────────────────────────────────────────────
  const handleCreateEvent = async () => {
    if (isSubmitting) return;
    const finalTeamId = isPresident ? form.teamId : myTeamId;
    if (!finalTeamId || !form.date || !form.time) {
      Alert.alert("Atención", "La fecha, la hora y el equipo son obligatorios.");
      return;
    }
    if (createType === "TRAINING" && form.recurring && (!form.recurringDays?.length || !form.recurringEndDate)) {
      Alert.alert("Atención", "Selecciona al menos un día y una fecha de fin para la recurrencia.");
      return;
    }
    setIsSubmitting(true);
    try {
      const fieldIdValue = form.fieldId ? Number(form.fieldId) : null;
      const locationValue = form.fieldId ? null : form.location || null;
      if (editingEvent) {
        await apiFetch(`/api/calendar/${editingEvent.id}?clubId=${clubId}&type=${editingEvent.type}`, { method: "DELETE" });
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
        const formattedDate = `${form.date}T${form.time}:00Z`;
        const endpoint = createType === "TRAINING" ? "/api/calendar/training" : "/api/calendar/match";
        const body = createType === "TRAINING"
          ? { teamId: Number(finalTeamId), startTime: formattedDate, endTime: form.endTime ? `${form.date}T${form.endTime}:00Z` : formattedDate, fieldId: fieldIdValue, location: locationValue, notes: form.notes }
          : { teamId: Number(finalTeamId), opponentName: form.opponentName, matchDate: formattedDate, fieldId: fieldIdValue, location: locationValue, isHome: form.isHome === "true", matchType: form.matchType };
        await apiFetch(`${endpoint}?clubId=${clubId}`, { method: "POST", body: JSON.stringify(body) });
      }
      setCreateModal(false);
      setEditingEvent(null);
      setForm({ isHome: "true", matchType: "LEAGUE", location: "", fieldId: null, endTime: "", recurring: false, recurringDays: [], recurringEndDate: "", date: "", time: "" });
      fetchEvents();
      Alert.alert("Éxito", editingEvent ? "Evento actualizado correctamente." : "Evento programado correctamente.");
    } catch {
      Alert.alert("Error", editingEvent ? "No se pudo actualizar el evento." : "No se pudo crear el evento.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── BORRAR ───────────────────────────────────────────────────────────────
  const handleDeleteEvent = (eventId: number, eventType: "TRAINING" | "MATCH") => {
    const eventKey = `${eventType}-${eventId}`;
    Alert.alert("Eliminar Evento", "¿Estás seguro? Esta acción no se puede deshacer.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar", style: "destructive",
        onPress: async () => {
          setDeletingId(eventKey);
          try {
            const res = await apiFetch(`/api/calendar/${eventId}?clubId=${clubId}&type=${eventType}`, { method: "DELETE" });
            if (!res.ok) {
              Alert.alert("Error", `No se pudo eliminar el evento (HTTP ${res.status}).`);
              return;
            }
            setDayModal(false);
            fetchEvents();
            Alert.alert("Éxito", "Evento eliminado.");
          } catch {
            Alert.alert("Error", "No se pudo eliminar el evento. Comprueba tu conexión.");
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  // ─── EDITAR ───────────────────────────────────────────────────────────────
  const handleEditEvent = (event: CalendarEvent) => {
    const date = new Date(event.startTime);
    setCreateType(event.type);
    setForm({
      isHome: "true",
      matchType: "LEAGUE",
      location: event.location || "",
      fieldId: null,
      endTime: event.endTime ? toTimeString(new Date(event.endTime)) : "",
      recurring: false,
      recurringDays: [],
      recurringEndDate: "",
      date: toDateString(date),
      time: toTimeString(date),
      teamId: String(event.teamId),
      opponentName: event.type === "MATCH" ? event.title.replace(/^vs\s*/i, "") : "",
    });
    setEditingEvent(event);
    setDayModal(false);
    setCreateModal(true);
  };

  // ─── EXPORTAR CSV ─────────────────────────────────────────────────────────
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
        const horaInicio = new Date(e.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const horaFin = e.endTime ? new Date(e.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
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
      const FS = await import("expo-file-system") as any;
      const Share = await import("expo-sharing") as any;
      const path = `${FS.documentDirectory}eventos.csv`;
      await FS.writeAsStringAsync(path, csv, { encoding: FS.EncodingType.UTF8 });
      await Share.shareAsync(path);
    }
      setExportModal(false);
    } catch {
      Alert.alert("Error", "No se pudo exportar.");
    } finally {
      setIsExporting(false);
    }
  };

  // ─── CUADRÍCULA ───────────────────────────────────────────────────────────
  const renderCalendarGrid = () => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    const grid: any[] = [];
    let dayCount = 1;
    for (let row = 0; row < 6; row++) {
      const daysRow: any[] = [];
      for (let col = 0; col < 7; col++) {
        if (row === 0 && col < startOffset) {
          daysRow.push(<View key={`es-${col}`} style={styles.dayCellEmpty} />);
        } else if (dayCount <= daysInMonth) {
          const currentDate = dayCount;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(currentDate).padStart(2, "0")}`;
          const dayEvents = events.filter((e) => {
            const d = new Date(e.startTime);
            return d.getDate() === currentDate && d.getMonth() === month && d.getFullYear() === year;
          });
          const hasMatch = dayEvents.some((e) => e.type === "MATCH");
          const hasTraining = dayEvents.some((e) => e.type === "TRAINING");
          const isSelected = selectedDate === dateStr;
          daysRow.push(
            <TouchableOpacity
              key={`day-${currentDate}`}
              style={[
                styles.dayCell,
                { backgroundColor: isSelected ? `${c.boton}18` : c.input },
                isSelected && { borderWidth: 1.5, borderColor: c.boton },
              ]}
              onPress={() => { setSelectedDate(dateStr); setSelectedDayEvents(dayEvents); setDayModal(true); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.dayText, { color: isSelected ? c.boton : c.texto, fontWeight: isSelected ? "700" : "600" }]}>{currentDate}</Text>
              <View style={styles.barsContainer}>
                {hasTraining && <View style={[styles.eventBar, { backgroundColor: '#3b82f6' }]} />}
                {hasMatch && <View style={[styles.eventBar, { backgroundColor: '#f97316' }]} />}
              </View>
            </TouchableOpacity>,
          );
          dayCount++;
        } else {
          daysRow.push(<View key={`ee-${row}-${col}`} style={styles.dayCellEmpty} />);
        }
      }
      grid.push(<View key={`row-${row}`} style={styles.weekRow}>{daysRow}</View>);
      if (dayCount > daysInMonth) break;
    }
    return grid;
  };

  return (
    <ScreenContainer>
      <View style={[styles.wrapper, { backgroundColor: c.fondo }]}>

        {/* CABECERA */}
        <View style={styles.headerRow}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
            <View>
              <Text style={[styles.headerSub, { color: c.subtexto }]}>Temporada {currentSeasonLabel}</Text>
              <Text style={[styles.headerTitle, { color: c.texto }]}>Calendario</Text>
            </View>
            <TouchableOpacity
              style={[styles.exportBtn, { backgroundColor: c.input, borderColor: c.bordeInput }]}
              onPress={() => setExportModal(true)}
            >
              <Text style={{ fontSize: 14 }}>📤</Text>
              <Text style={{ fontSize: 12, color: c.subtexto, fontWeight: "600" }}>CSV</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* FILTROS presidente */}
        {isPresident && (
          <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity style={[styles.chip, { backgroundColor: !selectedTeamId ? `${c.boton}20` : c.input }]} onPress={() => setSelectedTeamId(null)}>
                <Text style={[styles.chipText, { color: !selectedTeamId ? c.boton : c.subtexto }]}>Todos</Text>
              </TouchableOpacity>
              {teams.map((t) => (
                <TouchableOpacity key={t.id} style={[styles.chip, { backgroundColor: selectedTeamId === t.id ? `${c.boton}20` : c.input }]} onPress={() => setSelectedTeamId(t.id)}>
                  <Text style={[styles.chipText, { color: selectedTeamId === t.id ? c.boton : c.subtexto }]}>{t.category} {t.suffix}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* CALENDARIO FIJO */}
        <View style={{ paddingHorizontal: 14 }}>
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={() => { if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1); }}>
              <Text style={[styles.navBtnText, { color: c.boton }]}>‹</Text>
            </TouchableOpacity>
            <Text style={[styles.monthText, { color: c.texto }]}>{MESES[month]} {year}</Text>
            <TouchableOpacity onPress={() => { if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1); }}>
              <Text style={[styles.navBtnText, { color: c.boton }]}>›</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.calendarWrapper, { borderColor: c.bordeInput }]}>
            <View style={styles.weekRow}>
              {DIAS_SEMANA.map((d) => (
                <Text key={d} style={[styles.weekDayText, { color: c.subtexto }]}>{d}</Text>
              ))}
            </View>
            {loading
              ? <ActivityIndicator size="large" color={c.boton} style={{ marginVertical: 16 }} />
              : renderCalendarGrid()
            }
          </View>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: "#f97316" }]} /><Text style={[styles.legendText, { color: c.subtexto }]}>Partido</Text></View>
            <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: "#3b82f6" }]} /><Text style={[styles.legendText, { color: c.subtexto }]}>Entreno</Text></View>
          </View>
        </View>

        {/* Lista de eventos eliminada — los eventos se ven en el modal del día */}
        {false && <FlatList
          data={events}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true} 
          ListHeaderComponent={
            <Text style={[styles.sectionTitle, { color: c.texto, marginBottom: 10 }]}>
              Lista de Eventos
            </Text>
          }
          ListEmptyComponent={
            !loading ? (
              <View style={[styles.emptyCard, { backgroundColor: c.input, borderColor: c.bordeInput }]}>
                <Text style={{ fontSize: 28, marginBottom: 6 }}>📭</Text>
                <Text style={[styles.metaText, { color: c.subtexto, textAlign: "center" }]}>
                  No hay eventos este mes.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const eventKey = `${item.type}-${item.id}`;
            const isDeleting = deletingId === eventKey;
            const showDelete = canDeleteEvent(item);
            
            return (
              <View 
                style={[
                  styles.card, 
                  { backgroundColor: c.input, borderColor: c.bordeInput, borderLeftWidth: 4, borderLeftColor: item.type === "MATCH" ? c.boton : "#3b82f6" }
                ]}
              >
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.eventoTitulo, { color: c.texto }]}>
                      {item.type === "MATCH" ? "⚽" : "🏃"} {item.title}
                    </Text>
                    <Text style={[styles.metaText, { color: c.subtexto }]}>
                      📅 {new Date(item.startTime).toLocaleDateString("es-ES")} · 🕒 {new Date(item.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                    {item.location && <Text style={[styles.metaText, { color: c.subtexto, marginTop: 2 }]}>📍 {item.location}</Text>}
                    {item.teamName && <Text style={[styles.metaText, { color: c.subtexto, marginTop: 2 }]}>👥 {item.teamName}</Text>}
                  </View>
                  
                  {showDelete && (isDeleting
                    ? <ActivityIndicator size="small" color="#ef4444" style={{ padding: 10 }} />
                    : <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteEvent(item.id, item.type)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
                        <Text style={{ fontSize: 17 }}>🗑️</Text>
                      </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />}

        {/* FAB */}
        {canCreate && (
          <TouchableOpacity style={[styles.fab, { backgroundColor: c.boton }]} onPress={() => setCreateModal(true)}>
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        )}

        {/* ─── MODAL EXPORTAR CSV ───────────────────────────────────────────── */}
        <Modal visible={exportModal} transparent animationType="fade">
          <View style={styles.centeredOverlay}>
            <View style={[styles.centeredBox, { backgroundColor: c.fondo }]}>
              <Text style={[styles.modalTitle, { color: c.texto, marginBottom: 14 }]}>Exportar a CSV</Text>

              <Text style={[styles.inputLabel, { color: c.texto }]}>Tipo de eventos</Text>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 4 }}>
                {([{ label: "🏃 Entrenos", val: "TRAINING" }, { label: "⚽ Partidos", val: "MATCH" }] as const).map(({ label, val }) => {
                  const active = exportTypes.includes(val);
                  return (
                    <TouchableOpacity
                      key={val}
                      style={[styles.chipModal, { flex: 1, borderColor: active ? c.boton : c.bordeInput, backgroundColor: active ? `${c.boton}20` : c.input }]}
                      onPress={() => setExportTypes((prev) =>
                        active && prev.length > 1 ? prev.filter((t) => t !== val) : active ? prev : [...prev, val]
                      )}
                    >
                      <Text style={[styles.chipText, { color: active ? c.boton : c.subtexto }]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.inputLabel, { color: c.texto }]}>Desde</Text>
              <PickerBtn label="Fecha inicio" value={exportFrom} onPress={() => {}} mode="date" onChange={(v) => setExportFrom(v)} colors={c} />

              <Text style={[styles.inputLabel, { color: c.texto }]}>Hasta</Text>
              <PickerBtn label="Fecha fin" value={exportTo} onPress={() => {}} mode="date" onChange={(v) => setExportTo(v)} colors={c} />

              <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                <TouchableOpacity style={[styles.btnCrear, { flex: 1, backgroundColor: c.input, borderWidth: 1, borderColor: c.bordeInput }]} onPress={() => setExportModal(false)}>
                  <Text style={[styles.btnCrearText, { color: c.texto }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnCrear, { flex: 1, backgroundColor: isExporting ? c.bordeInput : c.boton }]} onPress={handleExportCSV} disabled={isExporting}>
                  {isExporting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnCrearText}>Exportar</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ─── MODAL DÍA — bottom sheet ────────────────────────────────────── */}
        <Modal visible={dayModal} transparent animationType="slide" onRequestClose={() => setDayModal(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDayModal(false)}>
            <TouchableOpacity activeOpacity={1} style={[styles.modalBox, { backgroundColor: c.fondo }]} onPress={() => {}}>
              <View style={styles.dayModalHandle} />
              <Text style={[styles.modalTitle, { color: c.texto, marginBottom: 4 }]}>
                {formatSelectedDate(selectedDate)}
              </Text>
              {selectedDayEvents.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: c.input, borderColor: c.bordeInput, marginTop: 8 }]}>
                  <Text style={{ fontSize: 26, marginBottom: 6 }}>📭</Text>
                  <Text style={[styles.metaText, { color: c.subtexto }]}>Sin eventos este día</Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 340 }}>
                  {selectedDayEvents.map((item) => {
                    const accentColor = item.type === "MATCH" ? c.boton : "#3b82f6";
                    return (
                      <View
                        key={`${item.type}-${item.id}`}
                        style={[styles.dayEventCard, { backgroundColor: c.input, borderColor: c.bordeInput, borderLeftColor: accentColor }]}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 5 }}>
                          <View style={[styles.dayEventBadge, { backgroundColor: `${accentColor}20` }]}>
                            <Text style={{ fontSize: 10, fontWeight: "700", color: accentColor }}>
                              {item.type === "MATCH" ? "PARTIDO" : "ENTRENO"}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.eventoTitulo, { color: c.texto, marginBottom: 6 }]}>{item.title}</Text>
                        <Text style={[styles.metaText, { color: c.subtexto }]}>
                          🕒 {new Date(item.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {item.endTime ? ` – ${new Date(item.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
                        </Text>
                        {item.location && (
                          <Text style={[styles.metaText, { color: c.subtexto, marginTop: 3 }]}>📍 {item.location}</Text>
                        )}
                        {item.teamName && (
                          <Text style={[styles.metaText, { color: c.subtexto, marginTop: 3 }]}>👥 {item.teamName}</Text>
                        )}
                        {item.type === "MATCH" && (() => {
                          const today = new Date(); today.setHours(0, 0, 0, 0);
                          const matchDay = new Date(item.startTime); matchDay.setHours(0, 0, 0, 0);
                          const diff = matchDay.getTime() - today.getTime();
                          if (diff > 0) {
                            return (
                              <View style={[styles.liveBtn, { marginTop: 10, backgroundColor: '#9ca3af' }]}>
                                <Text style={styles.liveBtnText}>⏳ Disponible el día del partido</Text>
                              </View>
                            );
                          }
                          if (diff === 0) {
                            return (
                              <TouchableOpacity
                                style={[styles.liveBtn, { marginTop: 10, backgroundColor: '#16a34a' }]}
                                onPress={() => { setDayModal(false); router.push(`/(club)/live-match/${item.id}?mode=LIVE`); }}
                              >
                                <Text style={styles.liveBtnText}>🟢 Iniciar Partido (En Vivo)</Text>
                              </TouchableOpacity>
                            );
                          }
                          return (
                            <TouchableOpacity
                              style={[styles.liveBtn, { marginTop: 10, backgroundColor: '#2563eb' }]}
                              onPress={() => { setDayModal(false); router.push(`/(club)/live-match/${item.id}?mode=EDIT`); }}
                            >
                              <Text style={styles.liveBtnText}>📊 Ver/Editar Estadísticas</Text>
                            </TouchableOpacity>
                          );
                        })()}
                        {canDeleteEvent(item) && (
                          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                            <TouchableOpacity
                              style={[styles.modalActionBtn, { backgroundColor: `${accentColor}15`, borderColor: accentColor }]}
                              onPress={() => handleEditEvent(item)}
                            >
                              <Text style={{ color: accentColor, fontWeight: "700", fontSize: 13 }}>✏️ Editar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.modalActionBtn, { backgroundColor: "#ef444415", borderColor: "#ef4444" }]}
                              onPress={() => handleDeleteEvent(item.id, item.type)}
                              disabled={deletingId === `${item.type}-${item.id}`}
                            >
                              {deletingId === `${item.type}-${item.id}`
                                ? <ActivityIndicator size="small" color="#ef4444" />
                                : <Text style={{ color: "#ef4444", fontWeight: "700", fontSize: 13 }}>🗑 Borrar</Text>
                              }
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              )}
              <TouchableOpacity
                style={[styles.btnCrear, { backgroundColor: c.input, borderWidth: 1, borderColor: c.bordeInput, marginTop: 14 }]}
                onPress={() => setDayModal(false)}
              >
                <Text style={[styles.btnCrearText, { color: c.texto }]}>Cerrar</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* ─── MODAL CREAR ─────────────────────────────────────────────────── */}
        <Modal visible={createModal} transparent animationType="slide" onRequestClose={() => { setCreateModal(false); setEditingEvent(null); }}>
          <View style={styles.modalOverlay}>
            <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} keyboardShouldPersistTaps="handled">
              <View style={[styles.modalBox, { backgroundColor: c.fondo }]}>
                <Text style={[styles.modalTitle, { color: c.texto }]}>{editingEvent ? "Editar Evento" : "Nuevo Evento"}</Text>

                <View style={styles.chipsRowModal}>
                  {(["TRAINING", "MATCH"] as const).map((type) => (
                    <TouchableOpacity key={type} onPress={() => setCreateType(type)}
                      style={[styles.chipModal, createType === type ? { backgroundColor: `${c.boton}20`, borderColor: c.boton } : { backgroundColor: c.input, borderColor: c.bordeInput }]}>
                      <Text style={[styles.chipText, { color: createType === type ? c.boton : c.subtexto }]}>
                        {type === "TRAINING" ? "🏃 Entreno" : "⚽ Partido"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {isPresident && (
                  <>
                    <Text style={[styles.inputLabel, { color: c.texto }]}>Seleccionar Equipo *</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                      {teams.map((t) => (
                        <TouchableOpacity key={t.id} style={[styles.chip, { backgroundColor: form.teamId === String(t.id) ? `${c.boton}20` : c.input }]} onPress={() => setForm((f: any) => ({ ...f, teamId: String(t.id) }))}>
                          <Text style={[styles.chipText, { color: form.teamId === String(t.id) ? c.boton : c.subtexto }]}>{t.category} {t.suffix}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}

                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: c.texto }]}>Fecha *</Text>
                    <PickerBtn label="Seleccionar fecha" value={form.date} onPress={() => setShowDatePicker(true)} mode="date"
                      onChange={(v) => setForm((f: any) => ({ ...f, date: v }))} colors={c} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: c.texto }]}>Hora *</Text>
                    <PickerBtn label="Seleccionar hora" value={form.time} onPress={() => setShowTimePicker(true)} mode="time"
                      onChange={(v) => setForm((f: any) => ({ ...f, time: v }))} colors={c} />
                  </View>
                </View>

                {createType === "TRAINING" && (
                  <View>
                    <Text style={[styles.inputLabel, { color: c.texto }]}>Hora fin</Text>
                    <PickerBtn label="Seleccionar hora fin" value={form.endTime} onPress={() => setShowEndTimePicker(true)} mode="time"
                      onChange={(v) => setForm((f: any) => ({ ...f, endTime: v }))} colors={c} />
                  </View>
                )}

                <Text style={[styles.inputLabel, { color: c.texto }]}>Ubicación / Campo</Text>
                {clubFields.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    {clubFields.map((campo) => (
                      <TouchableOpacity key={campo.id} style={[styles.chip, { backgroundColor: form.fieldId === campo.id ? `${c.boton}20` : c.input }]} onPress={() => setForm((f: any) => ({ ...f, fieldId: campo.id, location: campo.name }))}>
                        <Text style={[styles.chipText, { color: form.fieldId === campo.id ? c.boton : c.subtexto }]}>📍 {campo.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                <TextInput
                  style={[styles.textInput, { backgroundColor: c.input, color: c.texto, borderColor: c.bordeInput, marginBottom: 12 }]}
                  placeholder="Escribe o selecciona arriba..."
                  placeholderTextColor={c.subtexto}
                  value={form.location || ""}
                  onChangeText={(v) => setForm((f: any) => ({ ...f, location: v, fieldId: null }))}
                />

                {createType === "MATCH" && (
                  <>
                    <Text style={[styles.inputLabel, { color: c.texto }]}>Rival *</Text>
                    <TextInput style={[styles.textInput, { backgroundColor: c.input, color: c.texto, borderColor: c.bordeInput }]} placeholder="Nombre del Rival" placeholderTextColor={c.subtexto} onChangeText={(v) => setForm((f: any) => ({ ...f, opponentName: v }))} />
                    <Text style={[styles.inputLabel, { color: c.texto }]}>Competición</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                      {MATCH_TYPES.map((mt) => (
                        <TouchableOpacity key={mt.value} style={[styles.chip, { backgroundColor: form.matchType === mt.value ? `${c.boton}20` : c.input }]} onPress={() => setForm((f: any) => ({ ...f, matchType: mt.value }))}>
                          <Text style={[styles.chipText, { color: form.matchType === mt.value ? c.boton : c.subtexto }]}>{mt.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <View style={styles.chipsRowModal}>
                      {[{ label: "🏠 Local", val: "true" }, { label: "✈️ Visitante", val: "false" }].map(({ label, val }) => (
                        <TouchableOpacity key={val} onPress={() => setForm((f: any) => ({ ...f, isHome: val }))}
                          style={[styles.chipModal, form.isHome === val ? { backgroundColor: `${c.boton}20`, borderColor: c.boton } : { backgroundColor: c.input, borderColor: c.bordeInput }]}>
                          <Text style={[styles.chipText, { color: form.isHome === val ? c.boton : c.subtexto }]}>{label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                {createType === "TRAINING" && (
                  <>
                    <TouchableOpacity onPress={() => setForm((f: any) => ({ ...f, recurring: !f.recurring }))} style={{ flexDirection: "row", alignItems: "center", marginTop: 12, marginBottom: 6 }}>
                      <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: c.boton, backgroundColor: form.recurring ? c.boton : "transparent", marginRight: 8, alignItems: "center", justifyContent: "center" }}>
                        {form.recurring && <Text style={{ color: "#fff", fontSize: 12, fontWeight: "bold" }}>✓</Text>}
                      </View>
                      <Text style={[styles.inputLabel, { color: c.texto, marginTop: 0, marginBottom: 0 }]}>Repetir semanalmente</Text>
                    </TouchableOpacity>
                    {form.recurring && (
                      <>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8, marginBottom: 12 }}>
                          {[{ label: "L", value: 1 }, { label: "M", value: 2 }, { label: "X", value: 3 }, { label: "J", value: 4 }, { label: "V", value: 5 }, { label: "S", value: 6 }, { label: "D", value: 7 }].map((day) => {
                            const sel = form.recurringDays?.includes(day.value);
                            return (
                              <TouchableOpacity key={day.value} onPress={() => setForm((f: any) => ({ ...f, recurringDays: sel ? f.recurringDays.filter((d: number) => d !== day.value) : [...(f.recurringDays || []), day.value] }))}
                                style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: sel ? c.boton : c.bordeInput, backgroundColor: sel ? `${c.boton}20` : c.input, alignItems: "center", justifyContent: "center" }}>
                                <Text style={{ color: sel ? c.boton : c.subtexto, fontSize: 13, fontWeight: "bold" }}>{day.label}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        <Text style={[styles.inputLabel, { color: c.texto }]}>Repetir hasta</Text>
                        <PickerBtn label="Seleccionar fecha fin" value={form.recurringEndDate} onPress={() => setShowRecurringEndPicker(true)} mode="date"
                          onChange={(v) => setForm((f: any) => ({ ...f, recurringEndDate: v }))} colors={c} />
                      </>
                    )}
                  </>
                )}

                <View style={{ flexDirection: "row", gap: 10, marginTop: 15 }}>
                  <TouchableOpacity style={[styles.btnCrear, { backgroundColor: c.input, flex: 1, borderWidth: 1, borderColor: c.bordeInput }]} onPress={() => { setCreateModal(false); setEditingEvent(null); }}>
                    <Text style={[styles.btnCrearText, { color: c.texto }]}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btnCrear, { backgroundColor: isSubmitting ? c.bordeInput : c.boton, flex: 1 }]} onPress={handleCreateEvent} disabled={isSubmitting}>
                    {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnCrearText}>{editingEvent ? "Actualizar" : "Confirmar"}</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </Modal>

        {/* ─── PICKERS ─────────────────────────────────────────────────────── */}
        {showDatePicker && (
          <DateTimePicker value={pickerDate} mode="date" display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(_, selected) => {
              setShowDatePicker(Platform.OS === "ios");
              if (selected) { setPickerDate(selected); setForm((f: any) => ({ ...f, date: toDateString(selected) })); }
              if (Platform.OS === "android") setShowDatePicker(false);
            }}
          />
        )}
        {showTimePicker && (
          <DateTimePicker value={pickerDate} mode="time" is24Hour display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(_, selected) => {
              if (selected) { setPickerDate(selected); setForm((f: any) => ({ ...f, time: toTimeString(selected) })); }
              if (Platform.OS === "android") setShowTimePicker(false);
            }}
          />
        )}
        {showEndTimePicker && (
          <DateTimePicker value={pickerEndTime} mode="time" is24Hour display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(_, selected) => {
              if (selected) { setPickerEndTime(selected); setForm((f: any) => ({ ...f, endTime: toTimeString(selected) })); }
              if (Platform.OS === "android") setShowEndTimePicker(false);
            }}
          />
        )}
        {showRecurringEndPicker && (
          <DateTimePicker value={recurringEndDate} mode="date" display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(_, selected) => {
              if (selected) { setRecurringEndDate(selected); setForm((f: any) => ({ ...f, recurringEndDate: toDateString(selected) })); }
              if (Platform.OS === "android") setShowRecurringEndPicker(false);
            }}
          />
        )}

      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  container: { paddingHorizontal: 14, paddingBottom: 100, paddingTop: 6 },
  headerRow: { paddingHorizontal: 16, paddingTop: 46, paddingBottom: 6 },
  headerTitle: { fontSize: 22, fontWeight: "bold" },
  headerSub: { fontSize: 12, fontWeight: "500", marginBottom: 2 },
  exportBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, borderWidth: 1 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, marginRight: 8 },
  chipText: { fontSize: 12, fontWeight: "bold" },
  monthNav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6, marginTop: 2 },
  navBtnText: { fontSize: 24, fontWeight: "bold", paddingHorizontal: 6 },
  monthText: { fontSize: 15, fontWeight: "bold" },
  calendarWrapper: { borderRadius: 10, borderWidth: 1, padding: 5, paddingBottom: 8 },
  weekRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 3 },
  weekDayText: { flex: 1, textAlign: "center", fontSize: 12, fontWeight: "600" },
  dayCell: { flex: 1, height: 62, alignItems: "center", justifyContent: "flex-start", paddingTop: 8, margin: 1, borderRadius: 7 },
  dayCellEmpty: { flex: 1, height: 62, margin: 1 },
  dayText: { fontSize: 14, fontWeight: "600" },
  barsContainer: { width: "88%", gap: 2, marginTop: 3 },
  eventBar: { height: 3, borderRadius: 1.5 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  modalActionBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: "center" },
  liveBtn: { backgroundColor: "#16a34a", paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  liveBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  liveBtnSecondary: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: "#6b7280" },
  liveBtnTextSecondary: { color: "#6b7280" },
  dayModalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#ccc", alignSelf: "center", marginBottom: 16 },
  dayEventCard: { borderRadius: 12, borderWidth: 1, borderLeftWidth: 4, padding: 12, marginBottom: 10 },
  dayEventBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  legendRow: { flexDirection: "row", gap: 14, justifyContent: "flex-end", marginTop: 5, paddingRight: 2 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendText: { fontSize: 10 },
  sectionTitle: { fontSize: 15, fontWeight: "bold" },
  card: { paddingVertical: 11, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, marginBottom: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  eventoTitulo: { fontSize: 14, fontWeight: "bold", marginBottom: 4 },
  metaText: { fontSize: 12, fontWeight: "500" },
  deleteBtn: { padding: 8, borderRadius: 10, backgroundColor: "#ef444418", alignItems: "center", justifyContent: "center" },
  emptyCard: { padding: 22, borderRadius: 12, borderWidth: 1, borderStyle: "dashed", alignItems: "center", marginTop: 6 },
  fab: { position: "absolute", bottom: 22, right: 22, width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", elevation: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6 },
  fabText: { fontSize: 28, color: "#fff", fontWeight: "bold" },
  centeredOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: 24 },
  centeredBox: { width: "100%", borderRadius: 20, padding: 20, paddingBottom: 24, maxHeight: "75%" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modalBox: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 38 },
  modalTitle: { fontSize: 17, fontWeight: "bold", marginBottom: 14 },
  inputLabel: { fontSize: 13, fontWeight: "bold", marginBottom: 6, marginTop: 8 },
  textInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, marginBottom: 5 },
  pickerBtn: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 5 },
  chipsRowModal: { flexDirection: "row", gap: 10, marginBottom: 10 },
  chipModal: { flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: "center", borderWidth: 1 },
  btnCrear: { paddingVertical: 13, borderRadius: 12, alignItems: "center" },
  btnCrearText: { color: "white", fontWeight: "bold", fontSize: 15 },
});