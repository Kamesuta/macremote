import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { buy, loadPackage, purchasesConfigured, restore, trialLabel } from './purchases';

const SITE = 'https://phonetopcremote.com';
export const PRIVACY_URL = `${SITE}/privacy/`;
export const TERMS_URL = `${SITE}/terms/`;

const BENEFITS = [
  'Remote control of your Mac from anywhere',
  'Stays signed in: no logging in again when you switch apps',
  'Pinch to zoom, trackpad mode, and a text box for pasting commands',
  'Private: connects straight to your Mac over your own network',
];

export function Paywall({ onUnlocked, onDemo }: { onUnlocked: () => void; onDemo: () => void }) {
  const [pkg, setPkg] = useState<PurchasesPackage | null | undefined>(undefined); // undefined = loading
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!purchasesConfigured) { setPkg(null); return; }
    loadPackage().then(setPkg, () => setPkg(null));
  }, []);

  const run = async (work: () => Promise<boolean>, none?: string) => {
    setBusy(true); setMessage('');
    try {
      if (await work()) onUnlocked();
      else if (none) setMessage(none);
    } catch (e) {
      setMessage((e as Error).message || 'Something went wrong. Please try again.');
    } finally { setBusy(false); }
  };

  const trial = pkg ? trialLabel(pkg) : null;
  const price = pkg ? `${pkg.product.priceString} per year` : '';

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>Control Your PC</Text>
      <Text style={styles.sub}>Remote control for your Mac that keeps you signed in.</Text>
      <View style={styles.list}>
        {BENEFITS.map((b) => <Text key={b} style={styles.item}>•  {b}</Text>)}
      </View>

      {pkg === undefined ? <ActivityIndicator color={ACCENT} style={{ marginTop: 24 }} /> : null}
      {pkg === null ? <Text style={styles.error}>Subscriptions aren't available right now. Check your connection and try again later.</Text> : null}
      {pkg ? (
        <>
          <Pressable style={[styles.primary, busy && styles.disabled]} disabled={busy} onPress={() => run(() => buy(pkg))}>
            <Text style={styles.primaryText}>{trial ? `Start ${trial}` : 'Subscribe'}</Text>
            <Text style={styles.primarySub}>{trial ? `then ${price}` : price}</Text>
          </Pressable>
          <Text style={styles.fine}>
            {trial ? `After your ${trial}, you are charged ${price}. ` : ''}
            Payment is charged to your store account at confirmation. The subscription renews automatically each year unless you cancel at least 24 hours before the period ends. Manage or cancel any time in your account settings.
          </Text>
        </>
      ) : null}

      {message ? <Text style={styles.error}>{message}</Text> : null}

      <Pressable style={styles.secondary} disabled={busy} onPress={() => run(restore, 'No active subscription found for this account.')}>
        <Text style={styles.secondaryText}>Restore purchases</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={onDemo}>
        <Text style={styles.secondaryText}>Try the demo (no Mac needed)</Text>
      </Pressable>

      <View style={styles.links}>
        <Text style={styles.link} onPress={() => Linking.openURL(TERMS_URL)}>Terms of Use</Text>
        <Text style={styles.fine}>  ·  </Text>
        <Text style={styles.link} onPress={() => Linking.openURL(PRIVACY_URL)}>Privacy Policy</Text>
      </View>
    </ScrollView>
  );
}

const ACCENT = '#38bdf8';
const styles = StyleSheet.create({
  wrap: { padding: 24, paddingTop: 40 },
  title: { color: '#e2e8f0', fontSize: 30, fontWeight: '700' },
  sub: { color: '#94a3b8', fontSize: 17, marginTop: 6 },
  list: { marginTop: 24, gap: 10 },
  item: { color: '#e2e8f0', fontSize: 16, lineHeight: 22 },
  primary: { backgroundColor: ACCENT, borderRadius: 12, padding: 16, marginTop: 28, alignItems: 'center' },
  primaryText: { color: '#082f49', fontWeight: '700', fontSize: 18 },
  primarySub: { color: '#0c4a6e', fontSize: 14, marginTop: 2 },
  disabled: { opacity: 0.5 },
  fine: { color: '#64748b', fontSize: 12, lineHeight: 17, marginTop: 12 },
  error: { color: '#fca5a5', marginTop: 14 },
  secondary: { borderColor: '#334155', borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 12, alignItems: 'center' },
  secondaryText: { color: '#e2e8f0', fontSize: 16 },
  links: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  link: { color: ACCENT, fontSize: 13, textDecorationLine: 'underline' },
});
