import * as Clipboard from "expo-clipboard";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import { apiFetch } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { usePermissions } from "../../lib/usePermissions";
import { useTheme } from "../../lib/useTheme";

const POSICION_LABEL: Record<string, string> = {
  GOALKEEPER: "Portero",
  DEFENDER: "Defensa",
  MIDFIELDER: "Centrocampista",
  FORWARD: "Delantero",
};

const POSICION_COLOR: Record<string, string> = {
  GOALKEEPER: "#f59e0b",
  DEFENDER: "#3b82f6",
  MIDFIELDER: "#8b5cf6",
  FORWARD: "#16a34a",
};

// Orden táctico: portero → defensa → centrocampista → delantero
const POSICION_ORDEN: Record<string, number> = {
  GOALKEEPER: 1,
  DEFENDER:   2,
  MIDFIELDER: 3,
  FORWARD:    4,
};

// Jerarquía de rol de staff (enum StaffRoleType del backend)
const STAFF_ROL_ORDEN: Record<string, number> = {
  HEAD_COACH:      1,
  ASSISTANT:       2,
  FITNESS_COACH:   3,
  PHYSIOTHERAPIST: 4,
  DELEGATE:        5,
  OTHER:           6,
};

const STAFF_ROL_LABEL: Record<string, string> = {
  HEAD_COACH:      "Entrenador Principal",
  ASSISTANT:       "Asistente",
  FITNESS_COACH:   "Preparador Físico",
  PHYSIOTHERAPIST: "Fisioterapeuta",
  DELEGATE:        "Delegado",
  OTHER:           "Otro",
};

/** Avatar reutilizable: muestra imagen si existe, o iniciales con color de fondo */
function Avatar({
  photoUrl,
  initials,
  size,
  color,
  borderColor,
}: {
  photoUrl?: string | null;
  initials: string;
  size: number;
  color: string;
  borderColor?: string;
}) {
  const fontSize = size * 0.45;
  const borderRadius = size * 0.25;

  return (
    <View
      style={[
        styles.avatarBase,
        {
          width: size,
          height: size,
          borderRadius,
          borderColor: borderColor || `${color}35`,
          backgroundColor: `${color}18`,
          overflow: "hidden",
        },
      ]}
    >
      {photoUrl ? (
        <Image
          source={{ uri: photoUrl }}
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
      ) : (
        <Text style={[styles.avatarText, { color, fontSize }]}>{initials}</Text>
      )}
    </View>
  );
}

export default function MiClub() {
  const c = useTheme();

  const activeTeamId = useAuthStore((s: any) => s.activeTeamId);
  const clubId = useAuthStore((s: any) => s.activeClubId);
  const seasonLabel = useAuthStore((s: any) => s.activeSeasonName);

  const { canSeeInvitationCode, canOpenMemberDetail } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(
    activeTeamId || null
  );

  const [detailModal, setDetailModal] = useState(false);
  const [detailPerson, setDetailPerson] = useState<any>(null);
  const [detailIsStaff, setDetailIsStaff] = useState(false);

  const [statsModal, setStatsModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [playerStats, setPlayerStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  type PlayerSort = "POSITION" | "NAME" | "BIRTH_DATE";
  type StaffSort  = "ROLE" | "NAME";
  const [playerSort, setPlayerSort] = useState<PlayerSort>("POSITION");
  const [staffSort,  setStaffSort]  = useState<StaffSort>("ROLE");

  // ── CARGAR EQUIPOS ───────────────────────────────────────────────────────
  useEffect(() => {
    async function loadTeams() {
      if (!clubId) {
        setLoading(false);
        return;
      }
      try {
        const res = await apiFetch(`/api/club/equipos/${clubId}`);
        if (res.ok) {
          const json = await res.json();
          setTeams(json);
          if (!selectedTeamId && json.length > 0) {
            setSelectedTeamId(json[0].id);
          }
        }
      } catch (e) {
        console.error("Error cargando equipos:", e);
      } finally {
        setLoading(false);
      }
    }
    loadTeams();
  }, [clubId]);

  // ── CARGAR DETALLE ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedTeamId || !seasonLabel) return;
    setLoading(true);
    apiFetch(
      `/api/club/detalle/${selectedTeamId}?clubId=${clubId}&seasonLabel=${seasonLabel}`
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [selectedTeamId, seasonLabel]);

  // ── FICHA DETALLE (solo presidente / entrenador) ──────────────────────────
  const openDetail = (person: any, isStaff = false) => {
    setDetailPerson(person);
    setDetailIsStaff(isStaff);
    setDetailModal(true);
  };

  const closeDetail = () => setDetailModal(false);

  // ── ESTADÍSTICAS ─────────────────────────────────────────────────────────
  const openStats = async (jugador: any) => {
    setSelectedPlayer(jugador);
    setPlayerStats(null);
    setStatsModal(true);
    setLoadingStats(true);
    try {
      const res = await apiFetch(
        `/api/club/jugador/${jugador.id}/stats?clubId=${clubId}&teamId=${selectedTeamId}&seasonLabel=${seasonLabel}`
      );
      if (res.ok) setPlayerStats(await res.json());
    } catch {
      Alert.alert("Error", "No se pudieron cargar las estadísticas.");
    } finally {
      setLoadingStats(false);
    }
  };

  const copyCode = async (code: string) => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    Alert.alert("¡Copiado!", "El código de invitación se ha copiado al portapapeles.");
  };

  // ── LISTAS ORDENADAS ────────────────────────────────────────────────────
  const sortedPlantilla = useMemo(() => {
    const list: any[] = data?.plantilla ?? [];
    return [...list].sort((a, b) => {
      if (playerSort === "POSITION") {
        return (POSICION_ORDEN[a.position] ?? 99) - (POSICION_ORDEN[b.position] ?? 99);
      }
      if (playerSort === "NAME") {
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      }
      // BIRTH_DATE — más joven primero (fecha más reciente = mayor string YYYY-MM-DD)
      return (b.birthDate || "").localeCompare(a.birthDate || "");
    });
  }, [data?.plantilla, playerSort]);

  const sortedStaff = useMemo(() => {
    const list: any[] = data?.staff ?? [];
    return [...list].sort((a, b) => {
      if (staffSort === "ROLE") {
        return (STAFF_ROL_ORDEN[a.staffRole] ?? 99) - (STAFF_ROL_ORDEN[b.staffRole] ?? 99);
      }
      return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    });
  }, [data?.staff, staffSort]);

  // ── GUARDS ───────────────────────────────────────────────────────────────
  if (loading && !data)
    return <ActivityIndicator style={{ flex: 1 }} color={c.boton} />;

  if (!data && teams.length === 0) {
    return (
      <View style={[styles.emptyWrap, { backgroundColor: c.fondo }]}>
        <Text style={{ fontSize: 40 }}>🏟️</Text>
        <Text style={[styles.emptyTitle, { color: c.texto }]}>
          Tu club está vacío
        </Text>
        <Text style={[styles.emptySub, { color: c.subtexto }]}>
          Ve a Gestión para crear tu primer equipo y empezar a añadir jugadores.
        </Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.emptyWrap, { backgroundColor: c.fondo }]}>
        <Text style={[styles.emptySub, { color: c.subtexto }]}>
          No se pudo cargar la información
        </Text>
      </View>
    );
  }

  return (
    <ScreenContainer>
      <View style={{ flex: 1, backgroundColor: c.fondo }}>
        {/* ─── SELECTOR DE EQUIPO ────────────────────────────────────────── */}
        {teams.length > 0 && (
          <View
            style={[
              styles.selectorWrap,
              { borderBottomColor: c.bordeInput },
            ]}
          >
            <Text style={[styles.selectorLabel, { color: c.subtexto }]}>
              Equipo
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
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
                    accessibilityLabel={`Equipo ${t.category} ${t.suffix}`}
                    accessibilityState={{ selected }}
                  >
                    <Text
                      style={{
                        color: selected ? "#fff" : c.texto,
                        fontWeight: selected ? "bold" : "500",
                        fontSize: 13,
                      }}
                    >
                      {t.category} {t.suffix}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── HEADER DEL CLUB ─────────────────────────────────────────── */}
          <View style={styles.header}>
            <Avatar
              photoUrl={data.logoUrl}
              initials={data.nombre?.charAt(0) || "C"}
              size={56}
              color={c.boton}
            />
            <View style={styles.clubInfo}>
              <Text style={[styles.clubNombre, { color: c.texto }]}>
                {data.nombre}
              </Text>
              <Text style={[styles.clubMeta, { color: c.subtexto }]}>
                {data.equipo} · {data.temporada}
              </Text>
            </View>
          </View>

          {/* Código de invitación — solo presidente y staff */}
          {canSeeInvitationCode && (
            <View
              style={[
                styles.codigoCard,
                { backgroundColor: c.input, borderColor: c.bordeInput },
              ]}
            >
              <View>
                <Text style={[styles.codigoLabel, { color: c.subtexto }]}>
                  CÓDIGO DE INVITACIÓN
                </Text>
                <Text style={[styles.codigoValue, { color: c.boton }]}>
                  {data.codigoInvitacion || "---"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => copyCode(data.codigoInvitacion)}
                style={[
                  styles.copiarButton,
                  {
                    backgroundColor: `${c.boton}18`,
                    borderColor: `${c.boton}35`,
                  },
                ]}
              >
                <Text style={[styles.copiarText, { color: c.boton }]}>
                  📋 Copiar
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Chips */}
          <View style={styles.chipsRow}>
            {[
              `🏷 ${data.categoria}`,
              data.genero === "MALE"
                ? "👦 Masculino"
                : data.genero === "FEMALE"
                ? "👧 Femenino"
                : "👥 Mixto",
              `👥 ${data.plantilla?.length || 0} jugadores`,
            ].map((label) => (
              <View
                key={label}
                style={[
                  styles.chip,
                  { backgroundColor: c.input, borderColor: c.bordeInput },
                ]}
              >
                <Text style={[styles.chipText, { color: c.subtexto }]}>
                  {label}
                </Text>
              </View>
            ))}
          </View>

          {/* ─── STAFF ───────────────────────────────────────────────────── */}
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: c.texto, marginBottom: 0 }]}>
              🎽 Staff técnico
            </Text>
            <View style={styles.sortChipsRow}>
              {([{ value: "ROLE" as const, label: "Rol" }, { value: "NAME" as const, label: "A-Z" }]).map(({ value, label }) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.sortChip, {
                    backgroundColor: staffSort === value ? `${c.boton}20` : c.input,
                    borderColor:     staffSort === value ? c.boton : c.bordeInput,
                  }]}
                  onPress={() => setStaffSort(value)}
                >
                  <Text style={[styles.sortChipText, { color: staffSort === value ? c.boton : c.subtexto }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {data.staff?.length > 0 ? (
            <View style={styles.staffList}>
              {sortedStaff.map((m: any) => (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.staffCard,
                    { backgroundColor: c.input, borderColor: c.bordeInput },
                  ]}
                  onPress={canOpenMemberDetail ? () => openDetail(m, true) : undefined}
                  activeOpacity={canOpenMemberDetail ? 0.8 : 1}
                >
                  <Avatar
                    photoUrl={m.photoUrl}
                    initials={m.firstName?.charAt(0) || "?"}
                    size={40}
                    color={c.boton}
                  />
                  <View style={styles.staffInfo}>
                    <Text style={[styles.staffNombre, { color: c.texto }]}>
                      {m.firstName} {m.lastName}
                    </Text>
                    {m.phone && (
                      <Text style={[styles.staffPhone, { color: c.subtexto }]}>
                        📞 {m.phone}
                      </Text>
                    )}
                    {m.staffRole && (
                      <Text style={[styles.staffPhone, { color: c.subtexto }]}>
                        {STAFF_ROL_LABEL[m.staffRole] || m.staffRole}
                      </Text>
                    )}
                  </View>
                  {canOpenMemberDetail && (
                    <Text style={{ color: c.subtexto, fontSize: 18 }}>›</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: c.subtexto }]}>
              Sin staff registrado
            </Text>
          )}

          {/* ─── PLANTILLA ─────────────────────────────────────────────────── */}
          <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
            <Text style={[styles.sectionTitle, { color: c.texto, marginBottom: 0 }]}>
              ⚽ Plantilla
            </Text>
            <View style={styles.sortChipsRow}>
              {([
                { value: "POSITION"   as const, label: "Posición" },
                { value: "NAME"       as const, label: "A-Z"      },
                { value: "BIRTH_DATE" as const, label: "Edad"     },
              ]).map(({ value, label }) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.sortChip, {
                    backgroundColor: playerSort === value ? `${c.boton}20` : c.input,
                    borderColor:     playerSort === value ? c.boton : c.bordeInput,
                  }]}
                  onPress={() => setPlayerSort(value)}
                >
                  <Text style={[styles.sortChipText, { color: playerSort === value ? c.boton : c.subtexto }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {data.plantilla?.length > 0 ? (
            <View style={styles.jugadoresList}>
              {sortedPlantilla.map((j: any) => {
                const posColor = POSICION_COLOR[j.position] || c.boton;
                return (
                  <TouchableOpacity
                    key={j.id}
                    style={[
                      styles.jugadorCard,
                      {
                        backgroundColor: c.input,
                        borderColor: c.bordeInput,
                      },
                    ]}
                    onPress={canOpenMemberDetail ? () => openDetail(j, false) : undefined}
                    activeOpacity={canOpenMemberDetail ? 0.8 : 1}
                    accessibilityLabel={`${j.firstName} ${j.lastName}, ${POSICION_LABEL[j.position] || "Jugador"}`}
                  >
                    <Avatar
                      photoUrl={j.photoUrl}
                      initials={j.firstName?.charAt(0) || "?"}
                      size={44}
                      color={posColor}
                    />
                    <View style={styles.jugadorInfo}>
                      <Text
                        style={[styles.jugadorNombre, { color: c.texto }]}
                      >
                        {j.firstName} {j.lastName}
                      </Text>
                      <View style={styles.jugadorMeta}>
                        {j.birthDate && (
                          <Text
                            style={[
                              styles.jugadorMetaText,
                              { color: c.subtexto },
                            ]}
                          >
                            🎂 {j.birthDate}
                          </Text>
                        )}
                        {j.kitSize && (
                          <Text
                            style={[
                              styles.jugadorMetaText,
                              { color: c.subtexto },
                            ]}
                          >
                            👕 {j.kitSize}
                          </Text>
                        )}
                      </View>
                      {j.docNumber && (
                        <Text
                          style={[
                            styles.jugadorMetaText,
                            { color: c.subtexto, marginTop: 2 },
                          ]}
                        >
                          🪪 {j.docType || "DOC"}: {j.docNumber}
                        </Text>
                      )}
                    </View>
                    <View style={styles.jugadorDerecha}>
                      <View
                        style={[
                          styles.dorsalBadge,
                          {
                            backgroundColor: `${posColor}18`,
                            borderColor: `${posColor}35`,
                          },
                        ]}
                      >
                        <Text
                          style={[styles.dorsalText, { color: posColor }]}
                        >
                          #{j.jerseyNumber || "?"}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.posicionText,
                          { color: c.subtexto },
                        ]}
                      >
                        {POSICION_LABEL[j.position] || "Jugador"}
                      </Text>
                      {canOpenMemberDetail && (
                        <Text style={[styles.statsHint, { color: c.boton }]}>
                          ⋯
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: c.subtexto }]}>
              Sin jugadores registrados
            </Text>
          )}
        </ScrollView>

        {/* ─── FICHA DETALLE (centrada, presidente / entrenador) ─────────── */}
        <Modal
          visible={detailModal}
          transparent
          animationType="fade"
          onRequestClose={closeDetail}
        >
          <Pressable style={styles.overlayCenter} onPress={closeDetail}>
            <Pressable
              style={[
                styles.detailCard,
                { backgroundColor: c.fondo, borderColor: c.bordeInput },
              ]}
              onPress={() => {}}
            >
              {/* Botón cerrar */}
              <TouchableOpacity style={styles.detailClose} onPress={closeDetail}>
                <Text style={{ color: c.subtexto, fontSize: 18, fontWeight: "600" }}>
                  ✕
                </Text>
              </TouchableOpacity>

              {/* Avatar grande */}
              <View style={styles.detailAvatarWrap}>
                <Avatar
                  photoUrl={detailPerson?.photoUrl}
                  initials={detailPerson?.firstName?.charAt(0) || "?"}
                  size={72}
                  color={
                    detailIsStaff
                      ? c.boton
                      : POSICION_COLOR[detailPerson?.position] || c.boton
                  }
                />
              </View>

              {/* Nombre */}
              <Text style={[styles.detailNombre, { color: c.texto }]}>
                {detailPerson?.firstName} {detailPerson?.lastName}
              </Text>

              {/* Chip de rol / posición */}
              {detailIsStaff ? (
                detailPerson?.staffRole ? (
                  <View
                    style={[
                      styles.detailRolChip,
                      { backgroundColor: `${c.boton}18`, borderColor: `${c.boton}35` },
                    ]}
                  >
                    <Text style={[styles.detailRolText, { color: c.boton }]}>
                      {STAFF_ROL_LABEL[detailPerson.staffRole] || detailPerson.staffRole}
                    </Text>
                  </View>
                ) : null
              ) : (
                <View
                  style={[
                    styles.detailRolChip,
                    {
                      backgroundColor: `${POSICION_COLOR[detailPerson?.position] || c.boton}18`,
                      borderColor: `${POSICION_COLOR[detailPerson?.position] || c.boton}35`,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.detailRolText,
                      { color: POSICION_COLOR[detailPerson?.position] || c.boton },
                    ]}
                  >
                    {POSICION_LABEL[detailPerson?.position] || "Jugador"}
                    {detailPerson?.jerseyNumber ? `  ·  #${detailPerson.jerseyNumber}` : ""}
                  </Text>
                </View>
              )}

              {/* Separador */}
              <View style={[styles.detailDivider, { backgroundColor: c.bordeInput }]} />

              {/* Datos */}
              <View style={styles.detailRows}>
                {detailIsStaff ? (
                  <>
                    {detailPerson?.email && (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailRowLabel, { color: c.subtexto }]}>✉️ Email</Text>
                        <Text style={[styles.detailRowValue, { color: c.texto }]}>{detailPerson.email}</Text>
                      </View>
                    )}
                    {detailPerson?.phone && (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailRowLabel, { color: c.subtexto }]}>📞 Teléfono</Text>
                        <Text style={[styles.detailRowValue, { color: c.texto }]}>{detailPerson.phone}</Text>
                      </View>
                    )}
                    {detailPerson?.docNumber && (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailRowLabel, { color: c.subtexto }]}>
                          🪪 {detailPerson.docType || "DOC"}
                        </Text>
                        <Text style={[styles.detailRowValue, { color: c.texto }]}>{detailPerson.docNumber}</Text>
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    {detailPerson?.birthDate && (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailRowLabel, { color: c.subtexto }]}>🎂 Nacimiento</Text>
                        <Text style={[styles.detailRowValue, { color: c.texto }]}>{detailPerson.birthDate}</Text>
                      </View>
                    )}
                    {detailPerson?.email && (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailRowLabel, { color: c.subtexto }]}>✉️ Email</Text>
                        <Text style={[styles.detailRowValue, { color: c.texto }]}>{detailPerson.email}</Text>
                      </View>
                    )}
                    {detailPerson?.phone && (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailRowLabel, { color: c.subtexto }]}>📞 Teléfono</Text>
                        <Text style={[styles.detailRowValue, { color: c.texto }]}>{detailPerson.phone}</Text>
                      </View>
                    )}
                    {detailPerson?.kitSize && (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailRowLabel, { color: c.subtexto }]}>👕 Talla</Text>
                        <Text style={[styles.detailRowValue, { color: c.texto }]}>{detailPerson.kitSize}</Text>
                      </View>
                    )}
                    {detailPerson?.docNumber && (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailRowLabel, { color: c.subtexto }]}>
                          🪪 {detailPerson.docType || "DOC"}
                        </Text>
                        <Text style={[styles.detailRowValue, { color: c.texto }]}>{detailPerson.docNumber}</Text>
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* Botón estadísticas — solo jugadores */}
              {!detailIsStaff && (
                <TouchableOpacity
                  style={[
                    styles.detailStatsBtn,
                    { backgroundColor: c.boton },
                  ]}
                  onPress={() => {
                    closeDetail();
                    openStats(detailPerson);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.detailStatsBtnText}>📊 Ver estadísticas</Text>
                </TouchableOpacity>
              )}
            </Pressable>
          </Pressable>
        </Modal>

        {/* ─── MODAL ESTADÍSTICAS ────────────────────────────────────────── */}
        <Modal
          visible={statsModal}
          transparent
          animationType="slide"
          onRequestClose={() => setStatsModal(false)}
        >
          <Pressable
            style={styles.overlay}
            onPress={() => setStatsModal(false)}
          >
            <Pressable
              style={[
                styles.statsCard,
                { backgroundColor: c.fondo, borderColor: c.bordeInput },
              ]}
              onPress={() => {}}
            >
              <View style={styles.statsHeader}>
                <View>
                  <Text style={[styles.statsNombre, { color: c.texto }]}>
                    {selectedPlayer?.firstName} {selectedPlayer?.lastName}
                  </Text>
                  <Text style={[styles.statsPos, { color: c.subtexto }]}>
                    {POSICION_LABEL[selectedPlayer?.position] || "Jugador"} ·
                    #{selectedPlayer?.jerseyNumber || "?"}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setStatsModal(false)}>
                  <Text style={{ color: c.subtexto, fontSize: 20 }}>✕</Text>
                </TouchableOpacity>
              </View>

              {loadingStats ? (
                <ActivityIndicator
                  color={c.boton}
                  style={{ marginVertical: 30 }}
                />
              ) : playerStats ? (
                <>
                  <Text
                    style={[
                      styles.statsTemporada,
                      { color: c.subtexto },
                    ]}
                  >
                    Temporada {seasonLabel}
                  </Text>
                  <View style={styles.statsGrid}>
                    {[
                      { label: "⚽ Goles", value: playerStats.totalGoles },
                      {
                        label: "🅰️ Asistencias",
                        value: playerStats.totalAsistencias,
                      },
                      {
                        label: "🏆 Partidos gan.",
                        value: playerStats.partidosGanados,
                      },
                      {
                        label: "🎮 Partidos",
                        value: playerStats.totalPartidos,
                      },
                      {
                        label: "🟨 T. Amarillas",
                        value: playerStats.totalTarjetasAmarillas,
                      },
                      {
                        label: "🟥 T. Rojas",
                        value: playerStats.totalTarjetasRojas,
                      },
                    ].map((stat) => (
                      <View
                        key={stat.label}
                        style={[
                          styles.statBox,
                          { backgroundColor: c.input },
                        ]}
                      >
                        <Text
                          style={[styles.statValue, { color: c.texto }]}
                        >
                          {stat.value ?? 0}
                        </Text>
                        <Text
                          style={[styles.statLabel, { color: c.subtexto }]}
                        >
                          {stat.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <Text
                  style={[
                    styles.emptySub,
                    {
                      color: c.subtexto,
                      textAlign: "center",
                      marginTop: 20,
                    },
                  ]}
                >
                  No hay estadísticas disponibles para esta temporada.
                </Text>
              )}
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  avatarBase: {
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontWeight: "bold" },

  selectorWrap: {
    paddingTop: 60,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  selectorLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    fontWeight: "bold",
    marginBottom: 10,
    letterSpacing: 1,
  },
  teamChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },

  container: { flexGrow: 1, padding: 24, paddingTop: 24, paddingBottom: 40 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  clubInfo: { flex: 1 },
  clubNombre: { fontSize: 22, fontWeight: "bold", marginBottom: 2 },
  clubMeta: { fontSize: 13 },

  codigoCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  codigoLabel: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  codigoValue: { fontSize: 22, fontWeight: "bold", letterSpacing: 4 },
  copiarButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  copiarText: { fontSize: 13, fontWeight: "600" },

  chipsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 28,
    flexWrap: "wrap",
  },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipText: { fontSize: 12, fontWeight: "500" },

  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  emptyText: { fontStyle: "italic", marginBottom: 20 },

  staffList: { gap: 10, marginBottom: 8 },
  staffCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  staffInfo: { flex: 1, gap: 3 },
  staffNombre: { fontSize: 14, fontWeight: "600" },
  staffPhone: { fontSize: 12, opacity: 0.8 },

  jugadoresList: { gap: 10 },
  jugadorCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  jugadorInfo: { flex: 1, gap: 2 },
  jugadorNombre: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  jugadorMeta: { flexDirection: "row", gap: 10 },
  jugadorMetaText: { fontSize: 11 },
  jugadorDerecha: { alignItems: "center", gap: 4 },
  dorsalBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  dorsalText: { fontSize: 13, fontWeight: "bold" },
  posicionText: { fontSize: 10, fontWeight: "500", textAlign: "center" },
  statsHint: { fontSize: 10, fontWeight: "600" },

  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 8,
  },
  emptySub: { fontSize: 14, textAlign: "center", lineHeight: 20 },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  overlayCenter: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },

  detailCard: {
    width: "100%",
    borderRadius: 22,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },
  detailClose: {
    position: "absolute",
    top: 16,
    right: 16,
    padding: 4,
  },
  detailAvatarWrap: { marginBottom: 14, marginTop: 4 },
  detailNombre: { fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 8 },
  detailRolChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 18,
  },
  detailRolText: { fontSize: 13, fontWeight: "600" },
  detailDivider: { width: "100%", height: 1, marginBottom: 16 },
  detailRows: { width: "100%", gap: 10, marginBottom: 20 },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailRowLabel: { fontSize: 13 },
  detailRowValue: { fontSize: 13, fontWeight: "600", textAlign: "right", flexShrink: 1, marginLeft: 12 },
  detailStatsBtn: {
    width: "100%",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  detailStatsBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  statsCard: {
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 25,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  statsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  statsNombre: { fontSize: 20, fontWeight: "bold" },
  statsPos: { fontSize: 13, marginTop: 2 },
  statsTemporada: {
    fontSize: 12,
    marginBottom: 20,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingBottom: 20,
  },
  statBox: {
    width: "30%",
    flex: 1,
    minWidth: "28%",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  statValue: { fontSize: 28, fontWeight: "bold", marginBottom: 4 },
  statLabel: { fontSize: 11, fontWeight: "600", textAlign: "center" },

  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    flexWrap: "wrap",
    gap: 8,
  },
  sortChipsRow: { flexDirection: "row", gap: 6 },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  sortChipText: { fontSize: 11, fontWeight: "700" },
});