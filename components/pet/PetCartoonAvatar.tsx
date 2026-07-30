import { Image } from 'react-native';

import type { PetSpecies } from '@/types/database';

type PetCartoonAvatarProps = {
  species: PetSpecies;
  size: number;
};

const SOURCES: Record<PetSpecies, number> = {
  cat: require('../../assets/images/pets/cat.png'),
  dog: require('../../assets/images/pets/dog.png'),
  rabbit: require('../../assets/images/pets/rabbit.png'),
  hamster: require('../../assets/images/pets/hamster.png'),
  bird: require('../../assets/images/pets/bird.png'),
  fish: require('../../assets/images/pets/fish.png'),
  other: require('../../assets/images/pets/other.png'),
};

export function PetCartoonAvatar({ species, size }: PetCartoonAvatarProps) {
  return <Image source={SOURCES[species]} style={{ width: size, height: size, borderRadius: size / 2 }} />;
}
