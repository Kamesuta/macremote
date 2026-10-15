import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { normalizeServerUrl } from './src/url';

const STORE_KEY = 'macremote.serverUrl';

export default function App() {
  const [server, setServer] = useState<string | null | undefined>(undefined); // undefined = still loading

  useEffect(() => {
    AsyncStorage.getItem(STORE_KEY).then((v) => setServer(v ?? null), () => setServer(null));
  }, []);

  const save = useCallback(async (url: string) => {
    await AsyncStorage.setItem(STORE_KEY, url);
    setServer(url);
  }, []);
  const forget = useCallback(async () => {
    await AsyncStorage.removeItem(STORE_KEY);
    setServer(null);
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SafeAreaView style={styles.root} edges={['top']}>
        {server === undefined ? <ActivityIndicator color={ACCENT} style={styles.center} />
          : server === null ? <ServerForm onSave={save} />
          : <Remote server={server} onChangeServer={forget} />}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function ServerForm({ onSave }: { onSave: (url: string) => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    const url = normalizeServerUrl(text);
    if (!url) { setError('Enter the https address of your Mac, e.g. my-mac.your-tailnet.ts.net'); return; }
    onSave(url);
  };
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Mac Remote</Text>
      <Text style={styles.label}>Your Mac&apos;s address (the Tailscale HTTPS name)</Text>
      <TextInput
        style={styles.input} value={text} onChangeText={setText} onSubmitEditing={submit}
        placeholder="my-mac.your-tailnet.ts.net" placeholderTextColor="#64748b"
        autoCapitalize="none" autoCorrect={false} keyboardType="url" returnKeyType="go"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.primary} onPress={submit}><Text style={styles.primaryText}>Continue</Text></Pressable>
    </View>
  );
}

function Remote({ server, onChangeServer }: { server: string; onChangeServer: () => void }) {
  useKeepAwake(); // the screen stays on while the remote session is showing
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  if (failed) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Can&apos;t reach your Mac</Text>
        <Text style={styles.label}>{server}{'\n'}Check that Tailscale is connected on this phone and macremote is running on the Mac.</Text>
        <Pressable style={styles.primary} onPress={() => { setFailed(false); setAttempt((n) => n + 1); }}>
          <Text style={styles.primaryText}>Try again</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={onChangeServer}><Text style={styles.secondaryText}>Change address</Text></Pressable>
      </View>
    );
  }
  return (
    <WebView
      key={attempt}
      source={{ uri: server }}
      style={styles.web}
      originWhitelist={[`${server}/*`]}
      onShouldStartLoadWithRequest={(req) => req.url.startsWith(server) || req.url === 'about:blank'}
      onError={() => setFailed(true)}
      onHttpError={(e) => { if (e.nativeEvent.statusCode >= 500) setFailed(true); }}
      sharedCookiesEnabled
      keyboardDisplayRequiresUserAction={false}
      bounces={false}
      scrollEnabled={false}
      allowsBackForwardNavigationGestures={false}
      contentInsetAdjustmentBehavior="never"
      startInLoadingState
      renderLoading={() => <ActivityIndicator color={ACCENT} style={styles.center} />}
    />
  );
}

const ACCENT = '#38bdf8';
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, alignSelf: 'center' },
  web: { flex: 1, backgroundColor: '#0f172a' },
  card: { padding: 20, marginTop: 60 },
  title: { color: '#e2e8f0', fontSize: 24, fontWeight: '600', marginBottom: 16 },
  label: { color: '#94a3b8', fontSize: 15, marginBottom: 8 },
  input: { color: '#e2e8f0', backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
  error: { color: '#fca5a5', marginTop: 10 },
  primary: { backgroundColor: ACCENT, borderRadius: 8, padding: 14, marginTop: 18, alignItems: 'center' },
  primaryText: { color: '#082f49', fontWeight: '600', fontSize: 16 },
  secondary: { borderColor: '#334155', borderWidth: 1, borderRadius: 8, padding: 14, marginTop: 12, alignItems: 'center' },
  secondaryText: { color: '#e2e8f0', fontSize: 16 },
});
