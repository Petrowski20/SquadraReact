import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../../../lib/useTheme";
import {
  MATCH_TYPES,
  MATCH_TYPE_DISPLAY,
  formatSelectedDate,
  toDateString,
  toTimeString,
  useDashboard,
} from "../context/DashboardContext";

// ─── PickerBtn ────────────────────────────────────────────────────────────────

type PickerColors = {
  input: string;
  boton: string;
  bordeInput: string;
  texto: string;
  subtexto: string;
};

const PickerBtn = ({
  label,
  value,
  onPress,
  mode,
  onChange,
  colors,
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
      <View
        style={[
          styles.pickerBtn,
          {
            backgroundColor: colors.input,
            borderColor: value ? colors.boton : colors.bordeInput,
          },
        ]}
      >
        <input
          type={mode}
          value={value || ""}
          onChange={(e) => onChange?.(e.target.value)}
          style={{
            border: "none",
            background: "transparent",
            fontSize: 15,
            color: colors.texto,
            outline: "none",
            width: "100%",
            padding: 4,
          }}
        />
      </View>
    );
  }
  return (
    <TouchableOpacity
      style={[
        styles.pickerBtn,
        {
          backgroundColor: colors.input,
          borderColor: value ? colors.boton : colors.bordeInput,
        },
      ]}
      onPress={onPress}
    >
      <Text style={{ color: value ? colors.texto : colors.subtexto, fontSize: 15 }}>
        {value || label}
      </Text>
    </TouchableOpacity>
  );
};

// ─── PickerWrapper ─────────────────────────────────────────────────────────────
//
// Android: el DateTimePicker lanza un diálogo nativo del sistema operativo.
//          NO puede estar dentro de un <Modal> de React Native — si lo metes,
//          el sistema no sabe dónde anclar el diálogo y no aparece nada.
//          → Se renderiza directamente (condicional) sin ningún wrapper.
//
// iOS:     el DateTimePicker con display="spinner" se pinta inline como una
//          rueda. Sin Modal propio queda tapado por el bottom-sheet del form.
//          → Se envuelve en un <Modal transparent> con overlay y botón "Listo".

type PickerWrapperProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactElement;
  bgColor: string;
  botonColor: string;
};

function PickerWrapper({ visible, onClose, children, bgColor, botonColor }: PickerWrapperProps) {
  if (Platform.OS === "android") {
    return visible ? children : null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.pickerContainer, { backgroundColor: bgColor }]}
        >
          {children}
          <TouchableOpacity
            style={[styles.pickerDoneBtn, { backgroundColor: botonColor }]}
            onPress={onClose}
          >
            <Text style={styles.pickerDoneText}>Listo</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── CalendarModals ───────────────────────────────────────────────────────────

export default function CalendarModals() {
  const c = useTheme();
  const router = useRouter();
  const {
    isPresident,
    myTeamId,
    teams,
    clubFields,
    canCreate,
    canDeleteEvent,
    selectedDate,
    selectedDayEvents,
    dayModal,
    setDayModal,
    createModal,
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
    isExporting,
    isImporting,
    isSubmitting,
    deletingId,
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
    handleCreateEvent,
    handleDeleteEvent,
    handleEditEvent,
    handleExportCSV,
    handleOpenMap,
    proceedWithImport,
  } = useDashboard();

  return (
    <>
      {/* ─── MODAL SELECCIÓN EQUIPO (IMPORT PRESIDENTE) ──────────────────── */}
      <Modal
        visible={importTeamModal}
        transparent
        animationType="fade"
        onRequestClose={() => setImportTeamModal(false)}
      >
        <View style={styles.centeredOverlay}>
          <View style={[styles.centeredBox, { backgroundColor: c.fondo }]}>
            <Text style={[styles.modalTitle, { color: c.texto }]}>
              ¿A qué equipo van los eventos?
            </Text>
            <Text style={[styles.metaText, { color: c.subtexto, marginBottom: 14 }]}>
              Selecciona el equipo de destino para los eventos importados.
            </Text>
            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              {teams.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: c.input,
                      marginBottom: 10,
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                    },
                  ]}
                  onPress={() => {
                    setImportTeamModal(false);
                    proceedWithImport(t.id);
                  }}
                >
                  <Text style={[styles.chipText, { color: c.texto, fontSize: 14 }]}>
                    {t.category} {t.suffix}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[
                styles.btnCrear,
                { backgroundColor: c.input, borderWidth: 1, borderColor: c.bordeInput, marginTop: 12 },
              ]}
              onPress={() => setImportTeamModal(false)}
            >
              <Text style={[styles.btnCrearText, { color: c.texto }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL EXPORTAR CSV ───────────────────────────────────────────── */}
      <Modal visible={exportModal} transparent animationType="fade">
        <View style={styles.centeredOverlay}>
          <View style={[styles.centeredBox, { backgroundColor: c.fondo }]}>
            <Text style={[styles.modalTitle, { color: c.texto, marginBottom: 14 }]}>
              Exportar a CSV
            </Text>
            <Text style={[styles.inputLabel, { color: c.texto }]}>Tipo de eventos</Text>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 4 }}>
              {(
                [
                  { label: "🏃 Entrenos", val: "TRAINING" },
                  { label: "⚽ Partidos", val: "MATCH" },
                ] as const
              ).map(({ label, val }) => {
                const active = exportTypes.includes(val);
                return (
                  <TouchableOpacity
                    key={val}
                    style={[
                      styles.chipModal,
                      {
                        flex: 1,
                        borderColor: active ? c.boton : c.bordeInput,
                        backgroundColor: active ? `${c.boton}20` : c.input,
                      },
                    ]}
                    onPress={() =>
                      setExportTypes((prev) =>
                        active && prev.length > 1
                          ? prev.filter((t) => t !== val)
                          : active
                            ? prev
                            : [...prev, val],
                      )
                    }
                  >
                    <Text style={[styles.chipText, { color: active ? c.boton : c.subtexto }]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[styles.inputLabel, { color: c.texto }]}>Desde</Text>
            <PickerBtn
              label="Fecha inicio"
              value={exportFrom}
              onPress={() => {}}
              mode="date"
              onChange={(v) => setExportFrom(v)}
              colors={c}
            />
            <Text style={[styles.inputLabel, { color: c.texto }]}>Hasta</Text>
            <PickerBtn
              label="Fecha fin"
              value={exportTo}
              onPress={() => {}}
              mode="date"
              onChange={(v) => setExportTo(v)}
              colors={c}
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[
                  styles.btnCrear,
                  { flex: 1, backgroundColor: c.input, borderWidth: 1, borderColor: c.bordeInput },
                ]}
                onPress={() => setExportModal(false)}
              >
                <Text style={[styles.btnCrearText, { color: c.texto }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnCrear, { flex: 1, backgroundColor: isExporting ? c.bordeInput : c.boton }]}
                onPress={handleExportCSV}
                disabled={isExporting}
              >
                {isExporting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnCrearText}>Exportar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL DÍA — bottom sheet ─────────────────────────────────────── */}
      <Modal
        visible={dayModal}
        transparent
        animationType="slide"
        onRequestClose={() => setDayModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDayModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.modalBox, { backgroundColor: c.fondo }]}
            onPress={() => {}}
          >
            <View style={styles.dayModalHandle} />
            <Text style={[styles.modalTitle, { color: c.texto, marginBottom: 4 }]}>
              {formatSelectedDate(selectedDate)}
            </Text>
            {selectedDayEvents.length === 0 ? (
              <View
                style={[
                  styles.emptyCard,
                  { backgroundColor: c.input, borderColor: c.bordeInput, marginTop: 8 },
                ]}
              >
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
                      style={[
                        styles.dayEventCard,
                        {
                          backgroundColor: c.input,
                          borderColor: c.bordeInput,
                          borderLeftColor: accentColor,
                        },
                      ]}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 5 }}>
                        <View style={[styles.dayEventBadge, { backgroundColor: `${accentColor}20` }]}>
                          <Text style={{ fontSize: 10, fontWeight: "700", color: accentColor }}>
                            {item.type === "MATCH"
                              ? (MATCH_TYPE_DISPLAY[item.matchType ?? ""]?.badge ?? "PARTIDO")
                              : "ENTRENO"}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.eventoTitulo, { color: c.texto, marginBottom: 6 }]}>
                        {item.type === "MATCH"
                          ? `${MATCH_TYPE_DISPLAY[item.matchType ?? ""]?.icon ?? "⚽"} ${item.title}`
                          : `🏃 ${item.title}`}
                      </Text>
                      <Text style={[styles.metaText, { color: c.subtexto }]}>
                        🕒{" "}
                        {new Date(item.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {item.endTime
                          ? ` – ${new Date(item.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                          : ""}
                      </Text>
                      {item.location && (
                        <TouchableOpacity onPress={() => handleOpenMap(item)} activeOpacity={0.7}>
                          <Text style={[styles.metaText, { color: c.boton, marginTop: 3 }]}>
                            📍 {item.location}
                          </Text>
                        </TouchableOpacity>
                      )}
                      {item.teamName && (
                        <Text style={[styles.metaText, { color: c.subtexto, marginTop: 3 }]}>
                          👥 {item.teamName}
                        </Text>
                      )}
                      {item.type === "MATCH" &&
                        canCreate &&
                        (() => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const matchDay = new Date(item.startTime);
                          matchDay.setHours(0, 0, 0, 0);
                          const diff = matchDay.getTime() - today.getTime();
                          if (diff > 0) {
                            return (
                              <View style={[styles.liveBtn, { marginTop: 10, backgroundColor: "#9ca3af" }]}>
                                <Text style={styles.liveBtnText}>⏳ Disponible el día del partido</Text>
                              </View>
                            );
                          }
                          if (diff === 0) {
                            return (
                              <View style={{ gap: 8, marginTop: 10 }}>
                                <TouchableOpacity
                                  style={[styles.liveBtn, { backgroundColor: "#16a34a" }]}
                                  onPress={() => {
                                    setDayModal(false);
                                    router.push(`/(club)/live-match/${item.id}?mode=LIVE`);
                                  }}
                                >
                                  <Text style={styles.liveBtnText}>🟢 Iniciar Partido (En Vivo)</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[
                                    styles.liveBtn,
                                    { backgroundColor: "transparent", borderWidth: 1, borderColor: "#6b7280" },
                                  ]}
                                  onPress={() => {
                                    setDayModal(false);
                                    router.push(`/(club)/live-match/${item.id}?mode=EDIT`);
                                  }}
                                >
                                  <Text style={[styles.liveBtnText, { color: "#6b7280" }]}>
                                    📊 Ver/Editar Estadísticas
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            );
                          }
                          return (
                            <TouchableOpacity
                              style={[styles.liveBtn, { marginTop: 10, backgroundColor: "#2563eb" }]}
                              onPress={() => {
                                setDayModal(false);
                                router.push(`/(club)/live-match/${item.id}?mode=EDIT`);
                              }}
                            >
                              <Text style={styles.liveBtnText}>📊 Ver/Editar Estadísticas</Text>
                            </TouchableOpacity>
                          );
                        })()}
                      {canDeleteEvent(item) && (
                        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                          <TouchableOpacity
                            style={[
                              styles.modalActionBtn,
                              { backgroundColor: `${accentColor}15`, borderColor: accentColor },
                            ]}
                            onPress={() => handleEditEvent(item)}
                          >
                            <Text style={{ color: accentColor, fontWeight: "700", fontSize: 13 }}>
                              ✏️ Editar
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.modalActionBtn,
                              { backgroundColor: "#ef444415", borderColor: "#ef4444" },
                            ]}
                            onPress={() => handleDeleteEvent(item.id, item.type)}
                            disabled={deletingId === `${item.type}-${item.id}`}
                          >
                            {deletingId === `${item.type}-${item.id}` ? (
                              <ActivityIndicator size="small" color="#ef4444" />
                            ) : (
                              <Text style={{ color: "#ef4444", fontWeight: "700", fontSize: 13 }}>
                                🗑 Borrar
                              </Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            )}
            <TouchableOpacity
              style={[
                styles.btnCrear,
                { backgroundColor: c.input, borderWidth: 1, borderColor: c.bordeInput, marginTop: 14 },
              ]}
              onPress={() => setDayModal(false)}
            >
              <Text style={[styles.btnCrearText, { color: c.texto }]}>Cerrar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ─── MODAL CREAR / EDITAR ─────────────────────────────────────────── */}
      <Modal
        visible={createModal}
        transparent
        animationType="slide"
        onRequestClose={handleCancelCreate}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.modalBox, { backgroundColor: c.fondo }]}>
              <Text style={[styles.modalTitle, { color: c.texto }]}>
                {editingEvent ? "Editar Evento" : "Nuevo Evento"}
              </Text>

              <View style={styles.chipsRowModal}>
                {(["TRAINING", "MATCH"] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    onPress={() => setCreateType(type)}
                    style={[
                      styles.chipModal,
                      createType === type
                        ? { backgroundColor: `${c.boton}20`, borderColor: c.boton }
                        : { backgroundColor: c.input, borderColor: c.bordeInput },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: createType === type ? c.boton : c.subtexto }]}>
                      {type === "TRAINING" ? "🏃 Entreno" : "⚽ Partido"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {isPresident ? (
                <>
                  <Text style={[styles.inputLabel, { color: c.texto }]}>Seleccionar Equipo *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    {teams.map((t) => (
                      <TouchableOpacity
                        key={t.id}
                        style={[
                          styles.chip,
                          { backgroundColor: form.teamId === String(t.id) ? `${c.boton}20` : c.input },
                        ]}
                        onPress={() => setForm((f) => ({ ...f, teamId: String(t.id) }))}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: form.teamId === String(t.id) ? c.boton : c.subtexto },
                          ]}
                        >
                          {t.category} {t.suffix}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              ) : myTeamId ? (
                <View
                  style={[styles.coachTeamBanner, { backgroundColor: `${c.boton}12`, borderColor: `${c.boton}30` }]}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: c.boton }}>
                    {`👥 Equipo: ${
                      teams.find((t) => t.id === myTeamId)
                        ? `${teams.find((t) => t.id === myTeamId)!.category} ${teams.find((t) => t.id === myTeamId)!.suffix}`
                        : "Tu equipo asignado"
                    }`}
                  </Text>
                </View>
              ) : (
                <View
                  style={[styles.coachTeamBanner, { backgroundColor: "#ef444415", borderColor: "#ef444430" }]}
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#ef4444", marginBottom: 2 }}>
                    ⚠️ Sin equipo asignado
                  </Text>
                  <Text style={{ fontSize: 12, color: "#ef4444" }}>
                    No tienes equipo asignado para crear eventos. Contacta con el presidente del club.
                  </Text>
                </View>
              )}

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: c.texto }]}>Fecha *</Text>
                  <PickerBtn
                    label="Seleccionar fecha"
                    value={form.date}
                    onPress={() => setShowDatePicker(true)}
                    mode="date"
                    onChange={(v) => setForm((f) => ({ ...f, date: v }))}
                    colors={c}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: c.texto }]}>Hora *</Text>
                  <PickerBtn
                    label="Seleccionar hora"
                    value={form.time}
                    onPress={() => setShowTimePicker(true)}
                    mode="time"
                    onChange={(v) => setForm((f) => ({ ...f, time: v }))}
                    colors={c}
                  />
                </View>
              </View>

              {createType === "TRAINING" && (
                <View>
                  <Text style={[styles.inputLabel, { color: c.texto }]}>Hora fin</Text>
                  <PickerBtn
                    label="Seleccionar hora fin"
                    value={form.endTime}
                    onPress={() => setShowEndTimePicker(true)}
                    mode="time"
                    onChange={(v) => setForm((f) => ({ ...f, endTime: v }))}
                    colors={c}
                  />
                </View>
              )}

              <Text style={[styles.inputLabel, { color: c.texto }]}>Ubicación / Campo</Text>
              {clubFields.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  {clubFields.map((campo) => (
                    <TouchableOpacity
                      key={campo.id}
                      style={[
                        styles.chip,
                        { backgroundColor: form.fieldId === campo.id ? `${c.boton}20` : c.input },
                      ]}
                      onPress={() => setForm((f) => ({ ...f, fieldId: campo.id, location: campo.name }))}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: form.fieldId === campo.id ? c.boton : c.subtexto },
                        ]}
                      >
                        📍 {campo.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: c.input, color: c.texto, borderColor: c.bordeInput, marginBottom: 12 },
                ]}
                placeholder="Escribe o selecciona arriba..."
                placeholderTextColor={c.subtexto}
                value={form.location || ""}
                onChangeText={(v) => setForm((f) => ({ ...f, location: v, fieldId: null }))}
              />

              {createType === "MATCH" && (
                <>
                  <Text style={[styles.inputLabel, { color: c.texto }]}>Rival *</Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      { backgroundColor: c.input, color: c.texto, borderColor: c.bordeInput },
                    ]}
                    placeholder="Nombre del Rival"
                    placeholderTextColor={c.subtexto}
                    onChangeText={(v) => setForm((f) => ({ ...f, opponentName: v }))}
                  />
                  <Text style={[styles.inputLabel, { color: c.texto }]}>Competición</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    {MATCH_TYPES.map((mt) => (
                      <TouchableOpacity
                        key={mt.value}
                        style={[
                          styles.chip,
                          { backgroundColor: form.matchType === mt.value ? `${c.boton}20` : c.input },
                        ]}
                        onPress={() => setForm((f) => ({ ...f, matchType: mt.value }))}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: form.matchType === mt.value ? c.boton : c.subtexto },
                          ]}
                        >
                          {mt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <View style={styles.chipsRowModal}>
                    {[
                      { label: "🏠 Local", val: "true" },
                      { label: "✈️ Visitante", val: "false" },
                    ].map(({ label, val }) => (
                      <TouchableOpacity
                        key={val}
                        onPress={() => setForm((f) => ({ ...f, isHome: val }))}
                        style={[
                          styles.chipModal,
                          form.isHome === val
                            ? { backgroundColor: `${c.boton}20`, borderColor: c.boton }
                            : { backgroundColor: c.input, borderColor: c.bordeInput },
                        ]}
                      >
                        <Text style={[styles.chipText, { color: form.isHome === val ? c.boton : c.subtexto }]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {createType === "TRAINING" && (
                <>
                  <TouchableOpacity
                    onPress={() => setForm((f) => ({ ...f, recurring: !f.recurring }))}
                    style={{ flexDirection: "row", alignItems: "center", marginTop: 12, marginBottom: 6 }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        borderWidth: 1.5,
                        borderColor: c.boton,
                        backgroundColor: form.recurring ? c.boton : "transparent",
                        marginRight: 8,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {form.recurring && (
                        <Text style={{ color: "#fff", fontSize: 12, fontWeight: "bold" }}>✓</Text>
                      )}
                    </View>
                    <Text style={[styles.inputLabel, { color: c.texto, marginTop: 0, marginBottom: 0 }]}>
                      Repetir semanalmente
                    </Text>
                  </TouchableOpacity>
                  {form.recurring && (
                    <>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          marginTop: 8,
                          marginBottom: 12,
                        }}
                      >
                        {[
                          { label: "L", value: 1 },
                          { label: "M", value: 2 },
                          { label: "X", value: 3 },
                          { label: "J", value: 4 },
                          { label: "V", value: 5 },
                          { label: "S", value: 6 },
                          { label: "D", value: 7 },
                        ].map((day) => {
                          const sel = form.recurringDays?.includes(day.value);
                          return (
                            <TouchableOpacity
                              key={day.value}
                              onPress={() =>
                                setForm((f) => ({
                                  ...f,
                                  recurringDays: sel
                                    ? f.recurringDays.filter((d) => d !== day.value)
                                    : [...(f.recurringDays || []), day.value],
                                }))
                              }
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                borderWidth: 1.5,
                                borderColor: sel ? c.boton : c.bordeInput,
                                backgroundColor: sel ? `${c.boton}20` : c.input,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Text style={{ color: sel ? c.boton : c.subtexto, fontSize: 13, fontWeight: "bold" }}>
                                {day.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      <Text style={[styles.inputLabel, { color: c.texto }]}>Repetir hasta</Text>
                      <PickerBtn
                        label="Seleccionar fecha fin"
                        value={form.recurringEndDate}
                        onPress={() => setShowRecurringEndPicker(true)}
                        mode="date"
                        onChange={(v) => setForm((f) => ({ ...f, recurringEndDate: v }))}
                        colors={c}
                      />
                    </>
                  )}
                </>
              )}

              {createError !== "" && (
                <View
                  style={[
                    styles.errorBanner,
                    { backgroundColor: `${c.error || "#ef4444"}15`, borderColor: c.error || "#ef4444" },
                  ]}
                >
                  <Text style={{ color: c.error || "#ef4444", fontSize: 13, textAlign: "center", fontWeight: "500" }}>
                    ⚠️ {createError}
                  </Text>
                </View>
              )}

              <View style={{ flexDirection: "row", gap: 10, marginTop: 15 }}>
                <TouchableOpacity
                  style={[
                    styles.btnCrear,
                    { backgroundColor: c.input, flex: 1, borderWidth: 1, borderColor: c.bordeInput },
                  ]}
                  onPress={handleCancelCreate}
                >
                  <Text style={[styles.btnCrearText, { color: c.texto }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.btnCrear,
                    {
                      backgroundColor:
                        isSubmitting || (!isPresident && !myTeamId) ? c.bordeInput : c.boton,
                      flex: 1,
                    },
                  ]}
                  onPress={handleCreateEvent}
                  disabled={isSubmitting || (!isPresident && !myTeamId)}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnCrearText}>
                      {editingEvent ? "Actualizar" : "Confirmar"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ─── PICKERS ──────────────────────────────────────────────────────────
          Android → diálogo nativo del sistema, sin Modal de React Native.
          iOS     → Modal con overlay oscuro + spinner + botón "Listo".
      ─────────────────────────────────────────────────────────────────────── */}

      {/* Picker: Fecha del evento */}
      <PickerWrapper
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        bgColor={c.fondo}
        botonColor={c.boton}
      >
        <DateTimePicker
          value={pickerDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_, selected) => {
            if (Platform.OS === "android") setShowDatePicker(false);
            if (selected) {
              setPickerDate(selected);
              setForm((f) => ({ ...f, date: toDateString(selected) }));
            }
          }}
        />
      </PickerWrapper>

      {/* Picker: Hora de inicio */}
      <PickerWrapper
        visible={showTimePicker}
        onClose={() => setShowTimePicker(false)}
        bgColor={c.fondo}
        botonColor={c.boton}
      >
        <DateTimePicker
          value={pickerDate}
          mode="time"
          is24Hour
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_, selected) => {
            if (Platform.OS === "android") setShowTimePicker(false);
            if (selected) {
              setPickerDate(selected);
              setForm((f) => ({ ...f, time: toTimeString(selected) }));
            }
          }}
        />
      </PickerWrapper>

      {/* Picker: Hora fin */}
      <PickerWrapper
        visible={showEndTimePicker}
        onClose={() => setShowEndTimePicker(false)}
        bgColor={c.fondo}
        botonColor={c.boton}
      >
        <DateTimePicker
          value={pickerEndTime}
          mode="time"
          is24Hour
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_, selected) => {
            if (Platform.OS === "android") setShowEndTimePicker(false);
            if (selected) {
              setPickerEndTime(selected);
              setForm((f) => ({ ...f, endTime: toTimeString(selected) }));
            }
          }}
        />
      </PickerWrapper>

      {/* Picker: Fecha fin recurrente */}
      <PickerWrapper
        visible={showRecurringEndPicker}
        onClose={() => setShowRecurringEndPicker(false)}
        bgColor={c.fondo}
        botonColor={c.boton}
      >
        <DateTimePicker
          value={recurringEndDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_, selected) => {
            if (Platform.OS === "android") setShowRecurringEndPicker(false);
            if (selected) {
              setRecurringEndDate(selected);
              setForm((f) => ({ ...f, recurringEndDate: toDateString(selected) }));
            }
          }}
        />
      </PickerWrapper>
    </>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, marginRight: 8 },
  chipText: { fontSize: 12, fontWeight: "bold" },
  chipModal: { flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: "center", borderWidth: 1 },
  chipsRowModal: { flexDirection: "row", gap: 10, marginBottom: 10 },
  centeredOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  centeredBox: { width: "100%", borderRadius: 20, padding: 20, paddingBottom: 24, maxHeight: "75%" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modalBox: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 38 },
  modalTitle: { fontSize: 17, fontWeight: "bold", marginBottom: 14 },
  inputLabel: { fontSize: 13, fontWeight: "bold", marginBottom: 6, marginTop: 8 },
  textInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, marginBottom: 5 },
  pickerBtn: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 5 },
  btnCrear: { paddingVertical: 13, borderRadius: 12, alignItems: "center" },
  btnCrearText: { color: "white", fontWeight: "bold", fontSize: 15 },
  coachTeamBanner: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  errorBanner: { padding: 13, borderWidth: 1, borderRadius: 12, marginBottom: 4, marginTop: 12 },
  dayModalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#ccc", alignSelf: "center", marginBottom: 16 },
  dayEventCard: { borderRadius: 12, borderWidth: 1, borderLeftWidth: 4, padding: 12, marginBottom: 10 },
  dayEventBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  eventoTitulo: { fontSize: 14, fontWeight: "bold", marginBottom: 4 },
  metaText: { fontSize: 12, fontWeight: "500" },
  emptyCard: { padding: 22, borderRadius: 12, borderWidth: 1, borderStyle: "dashed", alignItems: "center", marginTop: 6 },
  modalActionBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: "center" },
  liveBtn: { backgroundColor: "#16a34a", paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  liveBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },

  // ── Picker iOS ─────────────────────────────────────────────────────────────
  pickerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  pickerContainer: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, paddingBottom: 34, paddingHorizontal: 16 },
  pickerDoneBtn: { marginTop: 10, marginHorizontal: 16, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  pickerDoneText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
});
