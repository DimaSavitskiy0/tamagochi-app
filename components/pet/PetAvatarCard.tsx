import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';

import { PetCartoonAvatar } from '@/components/pet/PetCartoonAvatar';
import type { PetSpecies } from '@/types/database';

type PetAvatarCardProps = {
  name: string;
  species: PetSpecies;
  onPress?: () => void;
  ringColor: string;
  nameColor: string;
  sceneColor: string;
};

export function PetAvatarCard({ name, species, onPress, ringColor, nameColor, sceneColor }: PetAvatarCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.sceneRow}>
        <Ionicons name="leaf" size={20} color={sceneColor} style={styles.sceneIconLeft} />
        <Pressable
          style={[styles.avatarWrap, { borderColor: ringColor }]}
          onPress={onPress}
          accessibilityLabel="Изменить вид питомца">
          <PetCartoonAvatar species={species} size={82} />
          {onPress ? (
            <View style={[styles.editBadge, { backgroundColor: ringColor }]}>
              <Ionicons name="pencil" size={13} color="#fff" />
            </View>
          ) : null}
        </Pressable>
        <Ionicons name="home" size={20} color={sceneColor} style={styles.sceneIconRight} />
      </View>
      <RNText style={[styles.name, { color: nameColor }]}>{name}</RNText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    paddingVertical: 0,
  },
  sceneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sceneIconLeft: {
    marginRight: 6,
    opacity: 0.6,
  },
  sceneIconRight: {
    marginLeft: 6,
    opacity: 0.6,
  },
  avatarWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 4,
  },
  editBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 0,
  },
});
