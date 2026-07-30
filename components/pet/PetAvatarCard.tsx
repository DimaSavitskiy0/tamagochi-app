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
          <PetCartoonAvatar species={species} size={110} />
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
    paddingVertical: 6,
  },
  sceneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
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
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 4,
  },
  editBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
});
