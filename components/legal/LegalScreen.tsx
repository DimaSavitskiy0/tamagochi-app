import { ScrollView, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';

// Shared layout for app/legal/offer.tsx and app/legal/privacy.tsx — plain scrollable
// text, each paragraph on its own Text node so line breaks in the source read cleanly.
export function LegalScreen({ paragraphs }: { paragraphs: string[] }) {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {paragraphs.map((paragraph, index) => (
          <Text key={index} style={paragraph.startsWith('#') ? styles.heading : styles.paragraph}>
            {paragraph.replace(/^#\s*/, '')}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  heading: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 18,
    marginBottom: 6,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 21,
    opacity: 0.85,
    marginBottom: 10,
  },
});
