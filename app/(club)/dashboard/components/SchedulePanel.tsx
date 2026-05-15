import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../../../lib/useTheme";
import {
  CalendarEvent,
  MATCH_TYPE_DISPLAY,
  formatSelectedDate,
  toDateString,
  useDashboard,
} from "../context/DashboardContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type FiltroTipo = "TODOS" | "MATCH" | "TRAINING";

interface EventSection {
  title: string; // YYYY-MM-DD — used as section key for scroll lookup
  data: CalendarEvent[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseIsHome(event: CalendarEvent): boolean | null {
  if (event.type !== "MATCH") return null;
  if (event.title.startsWith("vs ")) return true;
  if (event.title.startsWith("@ ")) return false;
  return true; // default
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── EventCard ────────────────────────────────────────────────────────────────
// Definido fuera del componente para que React no lo desmonte en cada re-render.

const EventCard = React.memo(function EventCard({
  event,
  showTeam,
  onPressLocation,
  matchButtonMode,
}: {
  event: CalendarEvent;
  showTeam: boolean;
  onPressLocation: (event: CalendarEvent) => void;
  matchButtonMode?: "both" | "edit-only" | null;
}) {
  const c = useTheme();
  const router = useRouter();
  const isMatch = event.type === "MATCH";
  const borderColor = isMatch ? "#16a34a" : "#3b82f6";
  const isHome = parseIsHome(event);
  const matchDisplay = MATCH_TYPE_DISPLAY[event.matchType ?? ""] ?? null;

  return (
    <View
      style={[
        styles.eventoCard,
        { backgroundColor: c.input, borderLeftColor: borderColor },
      ]}
    >
      {/* Cabecera: título + badge de tipo */}
      <View style={styles.eventoHeader}>
        <Text style={[styles.eventoTitulo, { color: c.texto }]} numberOfLines={2}>
          {isMatch ? "⚽" : "🏃"} {event.title}
        </Text>
      </View>

      {/* Badge de equipo (cuando se ven todos) */}
      {showTeam && event.teamName ? (
        <View
          style={[styles.teamBadge, { backgroundColor: `${c.boton}15` }]}
        >
          <Text style={[styles.teamBadgeText, { color: c.boton }]}>
            👕 {event.teamName}
          </Text>
        </View>
      ) : null}

      {/* Hora */}
      <View style={styles.eventoInfoRow}>
        <Text style={[styles.eventoText, { color: c.subtexto }]}>
          🕒 {formatTime(event.startTime)}
          {event.endTime ? ` – ${formatTime(event.endTime)}` : ""}
        </Text>
      </View>

      {/* Ubicación */}
      {event.location ? (
        <TouchableOpacity
          onPress={() => onPressLocation(event)}
          activeOpacity={0.7}
        >
          <Text
            style={[styles.eventoText, { color: c.boton, marginTop: 4 }]}
            numberOfLines={1}
          >
            📍 {event.location}
          </Text>
        </TouchableOpacity>
      ) : (
        <Text
          style={[styles.eventoText, { color: c.subtexto, marginTop: 4 }]}
        >
          📍 Campo por confirmar
        </Text>
      )}

      {/* Badges de partido */}
      {isMatch ? (
        <View style={styles.badgesRow}>
          {matchDisplay ? (
            <View
              style={[
                styles.badge,
                { backgroundColor: "#f59e0b18", borderColor: "#f59e0b35" },
              ]}
            >
              <Text style={[styles.badgeText, { color: "#f59e0b" }]}>
                {matchDisplay.badge}
              </Text>
            </View>
          ) : null}
          {isHome !== null ? (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: `${c.boton}18`,
                  borderColor: `${c.boton}35`,
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: c.boton }]}>
                {isHome ? "🏠 Local" : "✈️ Visitante"}
              </Text>
            </View>
          ) : null}
          {event.goalsFor != null && event.goalsAgainst != null ? (
            <View
              style={[
                styles.badge,
                { backgroundColor: "#16a34a18", borderColor: "#16a34a35" },
              ]}
            >
              <Text style={[styles.badgeText, { color: "#16a34a" }]}>
                ⚽ {event.goalsFor} - {event.goalsAgainst}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Botones de partido en vivo (solo cuando ya es hoy o pasado) */}
      {matchButtonMode ? (
        <View style={{ gap: 6, marginTop: 10 }}>
          {matchButtonMode === "both" && (
            <TouchableOpacity
              style={[styles.liveBtn, { backgroundColor: "#16a34a" }]}
              onPress={() =>
                router.push(`/(club)/live-match/${event.id}?mode=LIVE` as any)
              }
            >
              <Text style={styles.liveBtnText}>🟢 Iniciar Partido</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.liveBtn,
              matchButtonMode === "both"
                ? { backgroundColor: "transparent", borderWidth: 1, borderColor: "#6b7280" }
                : { backgroundColor: "#2563eb" },
            ]}
            onPress={() =>
              router.push(`/(club)/live-match/${event.id}?mode=EDIT` as any)
            }
          >
            <Text
              style={[
                styles.liveBtnText,
                { color: matchButtonMode === "both" ? "#6b7280" : "#fff" },
              ]}
            >
              📊 Ver/Editar Estadísticas
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
});

// ─── Viewability config (must be stable — defined outside component) ──────────
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 50 };

// ─── SchedulePanel ────────────────────────────────────────────────────────────

export default function SchedulePanel() {
  const c = useTheme();
  const {
    events,
    selectedDate,
    setSelectedDate,
    selectedTeamId,
    loading,
    fetchEvents,
    handleOpenMap,
    canCreate,
  } = useDashboard();

  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("TODOS");

  // ─── Refs para scroll programático ────────────────────────────────────────
  const sectionListRef = useRef<SectionList<CalendarEvent, EventSection>>(null);
  // Fecha que estamos intentando alcanzar (para el retry de onScrollToIndexFailed)
  const pendingScrollDate = useRef<string | null>(null);
  // Última fecha a la que scrolleamos: evita re-scroll cuando cambia filtroTipo
  const lastScrolledDate = useRef<string | null>(null);
  // Bloquea onViewableItemsChanged durante scroll programático para evitar bucle
  const isScrollingProgrammatically = useRef<boolean>(false);
  // Indica que selectedDate fue cambiado por scroll manual → bloquea el useEffect de scroll
  const isManualScrollUpdate = useRef<boolean>(false);
  // Ref espejo de selectedDate para que handleViewableItemsChanged sea estable
  const selectedDateRef = useRef<string | null>(selectedDate);
  useEffect(() => { selectedDateRef.current = selectedDate; }, [selectedDate]);

  // ─── Secciones (agrupadas por día, filtradas por tipo) ────────────────────
  const sections = useMemo<EventSection[]>(() => {
    const filtered =
      filtroTipo === "TODOS"
        ? events
        : events.filter((e) => e.type === filtroTipo);

    // Orden cronológico dentro de cada día y entre días
    const sorted = [...filtered].sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );

    // Agrupamos usando un Map para preservar el orden de inserción
    const map = new Map<string, CalendarEvent[]>();
    for (const event of sorted) {
      const dateKey = toDateString(new Date(event.startTime));
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(event);
    }

    return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
  }, [events, filtroTipo]);

  // Mapa fecha → índice de sección para lookup O(1)
  const sectionIndexMap = useMemo<Map<string, number>>(() => {
    const map = new Map<string, number>();
    sections.forEach((section, index) => map.set(section.title, index));
    return map;
  }, [sections]);

  // ─── Scroll programático al día seleccionado ──────────────────────────────
  useEffect(() => {
    if (isManualScrollUpdate.current) {
      isManualScrollUpdate.current = false;
      return;
    }
    if (!selectedDate) return;
    if (selectedDate === lastScrolledDate.current && lastScrolledDate.current !== null) return;

    const sectionIndex = sectionIndexMap.get(selectedDate);

    if (sectionIndex === undefined) {
      // Hoy no tiene eventos: buscamos la sección con fecha más cercana
      // comparando timestamps para no depender del orden del array.
      if (sections.length === 0) return;
      const targetTime = new Date(selectedDate).getTime();
      let closestIdx = 0;
      let minDiff = Infinity;
      sections.forEach((section, idx) => {
        const diff = Math.abs(new Date(section.title).getTime() - targetTime);
        if (diff < minDiff) { minDiff = diff; closestIdx = idx; }
      });
      lastScrolledDate.current = selectedDate;
      pendingScrollDate.current = sections[closestIdx].title;
      isScrollingProgrammatically.current = true;
      setTimeout(() => {
        sectionListRef.current?.scrollToLocation({
          sectionIndex: closestIdx,
          itemIndex: 0,
          animated: true,
          viewOffset: 0,
        });
        setTimeout(() => { isScrollingProgrammatically.current = false; }, 500);
      }, 100);
      return;
    }

    lastScrolledDate.current = selectedDate;
    pendingScrollDate.current = selectedDate;
    isScrollingProgrammatically.current = true;

    setTimeout(() => {
      sectionListRef.current?.scrollToLocation({
        sectionIndex: 0,
        itemIndex: 0,
        animated: false,
      });
      setTimeout(() => {
        sectionListRef.current?.scrollToLocation({
          sectionIndex,
          itemIndex: 0,
          animated: false,
          viewOffset: 0,
        });
        setTimeout(() => { isScrollingProgrammatically.current = false; }, 500);
      }, 200);
    }, 100);
  }, [selectedDate, sectionIndexMap, sections]);

  // ─── Fallback cuando el item aún no está renderizado (fuera del viewport) ─
  const handleScrollToIndexFailed = useCallback(() => {
    const date = pendingScrollDate.current;
    if (!date) return;

    // Primero forzamos al top para que la lista mida todos sus items,
    // luego reintentamos el scroll al destino.
    sectionListRef.current?.scrollToLocation({
      sectionIndex: 0,
      itemIndex: 0,
      animated: false,
    });

    setTimeout(() => {
      const idx = sectionIndexMap.get(date);
      if (idx === undefined) return;
      sectionListRef.current?.scrollToLocation({
        sectionIndex: idx,
        itemIndex: 0,
        animated: true,
        viewOffset: 0,
      });
    }, 200);
  }, [sectionIndexMap]);

  // ─── Sincronización Scroll → Calendario ──────────────────────────────────
  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: any[] }) => {
      if (isScrollingProgrammatically.current) return;
      // Los section-headers no tienen `.section`; buscamos el primer item de datos
      const first = viewableItems.find((v) => v.section != null);
      if (!first) return;
      const date: string = first.section.title;
      if (date !== selectedDateRef.current) {
        isManualScrollUpdate.current = true;
        setSelectedDate(date);
      }
    },
    [setSelectedDate],
  );

  // ─── Render helpers ───────────────────────────────────────────────────────

  const renderSectionHeader = useCallback(
    ({ section }: { section: EventSection }) => (
      <View
        style={[styles.sectionHeader, { backgroundColor: c.fondo }]}
      >
        <Text style={[styles.sectionTitle, { color: c.texto }]}>
          {formatSelectedDate(section.title)}
        </Text>
      </View>
    ),
    [c.fondo, c.texto],
  );

  const renderItem = useCallback(
    ({ item }: { item: CalendarEvent }) => {
      let matchButtonMode: "both" | "edit-only" | null = null;
      if (item.type === "MATCH" && canCreate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const matchDay = new Date(item.startTime);
        matchDay.setHours(0, 0, 0, 0);
        const diff = matchDay.getTime() - today.getTime();
        if (diff === 0) matchButtonMode = "both";
        else if (diff < 0) matchButtonMode = "edit-only";
      }
      return (
        <EventCard
          event={item}
          showTeam={selectedTeamId === null}
          onPressLocation={handleOpenMap}
          matchButtonMode={matchButtonMode}
        />
      );
    },
    [selectedTeamId, handleOpenMap, canCreate],
  );

  const keyExtractor = useCallback(
    (item: CalendarEvent) => `${item.type}-${item.id}`,
    [],
  );

  const ListEmptyComponent = useMemo(
    () => (
      <View
        style={[
          styles.emptyCard,
          { backgroundColor: c.input, borderColor: c.bordeInput },
        ]}
      >
        <Text style={{ fontSize: 30, marginBottom: 8 }}>📅</Text>
        <Text style={{ color: c.subtexto, textAlign: "center", fontSize: 15 }}>
          {loading
            ? "Cargando eventos..."
            : filtroTipo === "TODOS"
              ? "No hay eventos programados este mes."
              : filtroTipo === "MATCH"
                ? "No hay partidos programados este mes."
                : "No hay entrenamientos programados este mes."}
        </Text>
      </View>
    ),
    [c.input, c.bordeInput, c.subtexto, loading, filtroTipo],
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={[styles.wrapper, { backgroundColor: c.fondo }]}>
      {/* FILTRO TIPO */}
      <View style={[styles.tabBar, { borderBottomColor: c.bordeInput }]}>
        {(
          [
            { key: "TODOS", label: "Todos" },
            { key: "MATCH", label: "Partidos" },
            { key: "TRAINING", label: "Entrenos" },
          ] as { key: FiltroTipo; label: string }[]
        ).map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.tabBtn,
              filtroTipo === key && {
                borderBottomColor: c.boton,
                borderBottomWidth: 2,
              },
            ]}
            onPress={() => setFiltroTipo(key)}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: filtroTipo === key ? c.boton : c.subtexto,
                  fontWeight: filtroTipo === key ? "bold" : "600",
                },
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* LISTA DE EVENTOS */}
      {loading && sections.length === 0 ? (
        <ActivityIndicator
          size="large"
          color={c.boton}
          style={{ marginTop: 40 }}
        />
      ) : (
        <SectionList<CalendarEvent, EventSection>
          ref={sectionListRef}
          sections={sections}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          ListEmptyComponent={ListEmptyComponent}
          onScrollToIndexFailed={handleScrollToIndexFailed}
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={VIEWABILITY_CONFIG}
          initialNumToRender={50}
          windowSize={10}
          stickySectionHeadersEnabled
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          SectionSeparatorComponent={() => <View style={{ height: 8 }} />}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={fetchEvents}
              tintColor={c.boton}
            />
          }
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderBottomWidth: 1,
  },
  tabBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: { fontSize: 14 },
  listContent: { padding: 16, paddingBottom: 40 },
  sectionHeader: {
    paddingVertical: 8,
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "bold",
    textTransform: "capitalize",
  },
  eventoCard: {
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 5,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  eventoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  eventoTitulo: { fontSize: 15, fontWeight: "bold", flex: 1 },
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
  badgesRow: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  badge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 11, fontWeight: "bold", textTransform: "uppercase" },
  emptyCard: {
    padding: 40,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 40,
    borderStyle: "dashed",
    alignItems: "center",
  },
  liveBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  liveBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
});
