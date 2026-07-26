import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/src/theme";
export function EmptyState({ title, message }: { title: string; message: string }) { return <View style={styles.container}><Text style={styles.title}>{title}</Text><Text style={styles.message}>{message}</Text></View>; }
const styles = StyleSheet.create({ container: { padding: 24, alignItems: "center", gap: 8 }, title: { color: colors.text, fontSize: 18, fontWeight: "700" }, message: { color: colors.muted, fontSize: 15, textAlign: "center", lineHeight: 22 } });
