import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { DEMO_HTML } from './demoHtml';

export function Demo({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.root}>
      <WebView
        source={{ html: DEMO_HTML }}
        originWhitelist={['about:*']}
        style={styles.web}
        scrollEnabled={false}
        bounces={false}
        keyboardDisplayRequiresUserAction={false}
      />
      <Pressable style={styles.close} onPress={onClose}>
        <Text style={styles.closeText}>Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  web: { flex: 1, backgroundColor: '#0f172a' },
  close: { backgroundColor: '#1e293b', borderTopColor: '#334155', borderTopWidth: 1, padding: 14, alignItems: 'center' },
  closeText: { color: '#e2e8f0', fontSize: 16 },
});
