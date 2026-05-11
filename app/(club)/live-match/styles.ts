import { StyleSheet } from "react-native";

export const s = StyleSheet.create({
  container: { flex: 1, maxWidth: 1000, width: "100%", alignSelf: "center" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 20, fontWeight: "800" },
  modePill: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 3,
    alignSelf: "flex-start",
  },
  modePillText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  closeMatchBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  closeMatchText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 11,
    textAlign: "center",
  },

  // Step indicator
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 10,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  stepLine: { flex: 1, height: 2, marginHorizontal: 8 },
  stepLbl: { fontSize: 13 },

  // List container
  list: { padding: 16, paddingBottom: 50 },
  hint: { fontSize: 13, textAlign: "center", marginBottom: 14 },
  empty: { alignItems: "center", paddingVertical: 40 },

  // Counter box
  counterBox: {
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
  },

  // Position group header
  groupTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 6,
    paddingHorizontal: 2,
  },

  // Natural position badge
  naturalPosBadge: {
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  naturalPosText: { fontSize: 10, fontWeight: "700", color: "#6b7280" },

  // Starter/suplente badge pill
  starterBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1.5,
  },

  // Position selector (inside starter card)
  positionSelector: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  posBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
  },
  posBtnText: { fontSize: 11, fontWeight: "700" },

  // Callup card (tappable, column layout)
  callupsCard: {
    flexDirection: "column",
    alignItems: "stretch",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },

  // Stats card (live actions)
  statsCard: { borderRadius: 12, padding: 14, marginBottom: 10 },
  playerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  playerName: { fontWeight: "700", fontSize: 15 },

  // Bench / subbed-out card
  benchCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  subbedOutBadge: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },

  // Edit mode counters
  countersRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  counter: { alignItems: "center", minWidth: 58 },
  counterBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // Stopwatch
  stopwatch: {
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
  },
  stopwatchTime: { fontSize: 60, fontWeight: "800", letterSpacing: 4 },
  stopwatchBtns: { flexDirection: "row", gap: 12, marginTop: 14 },
  swBtn: { paddingHorizontal: 22, paddingVertical: 10, borderRadius: 10 },
  swBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  // Buttons
  primaryBtn: {
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 6,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  // Modals (shared bottom-sheet style)
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
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 14 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 10 },
  cancelBtn: { padding: 14, alignItems: "center" },

  // Substitution picker rows
  subPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
  },

  // Live-mode section headers
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10 },

  // Live-mode player position tag
  positionTag: { fontSize: 12, marginTop: 2 },

  // Live-mode quick action buttons
  quickActionsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
    flexWrap: "wrap",
  },
  quickActionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    minWidth: 50,
  },
  quickActionText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  // Formation picker
  formationChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  formationRequirements: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },

  // Back-to-lineup banner (LIVE stats step)
  backToLineupBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    alignItems: "flex-start",
  },

  // Live tab bar
  liveTabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  liveTabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },

  // FIFA Pitch
  pitch: {
    backgroundColor: "#166534",
    marginHorizontal: 16,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 8,
    gap: 12,
  },
  pitchRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    gap: 6,
  },
  pitchMidLine: {
    height: 1.5,
    backgroundColor: "rgba(255,255,255,0.35)",
    marginHorizontal: 8,
  },
  pitchHalfLabel: {
    alignItems: "center",
  },
  pitchHalfText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
  },
  pitchPlayerCard: {
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: "center",
    minWidth: 70,
    maxWidth: 90,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  pitchAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.45)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
  },
  pitchPlayerName: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  pitchPlayerStats: {
    flexDirection: "row",
    gap: 2,
    marginTop: 3,
  },
  pitchStatBadge: {
    fontSize: 9,
  },

  // Bench horizontal chip
  benchChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
  },

  // Timeline
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  timelineBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 42,
    alignItems: "center",
  },
  timelineMin: { fontSize: 13, fontWeight: "800" },
});
