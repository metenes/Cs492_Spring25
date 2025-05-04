import React from 'react';
import {
  View,
  Text,
  Modal,
  Image,
  TouchableOpacity,
  StyleSheet
} from 'react-native';
import { useTheme } from './context/ThemeContext';

// Import badge images
import LockedJournalBadge from './badges/locked_journal.png';
import FreeformBadge from './badges/freeform.png';
import GuidedBadge from './badges/guided.png';
import QuickBadge from './badges/quick.png';
import PromptWandererBadge from './badges/promptwanderer-Photoroom.png';
import EmotionExplorerBadge from './badges/emotion_explorer.png';
import MoodShifterBadge from './badges/mood_shifter.png';
import LetItOutBadge from './badges/Let_itout.png';
import ImageStorytellerBadge from './badges/image_stroyteller.png';
import NightOwl from './badges/night_owl.png';
import EarlyBird from './badges/early_bird.png';
import OneYear from './badges/one_year.png';
interface BadgeCongratsModalProps {
  visible: boolean;
  badgeKey: string | null;
  onClose: () => void;
}

const badgeData = [
  {
    key: "locked_journal",
    image: LockedJournalBadge,
    description: "You locked a journal entry. Your privacy matters!",
  },
  {
    key: "freeform",
    image: FreeformBadge,
    description: "You wrote your first freeform journal. Well done!",
  },
  {
    key: "guided",
    image: GuidedBadge,
    description: "You completed your first guided journal. Great job!",
  },
  {
    key: "quick",
    image: QuickBadge,
    description: "You jotted down a quick journal entry. Way to go!",
  },
  {
    key: "prompt_wanderer",
    image: PromptWandererBadge,
    description: "You explored all prompt types. What a curious mind!",
  },
  {
    key: "emotion_explorer",
    image: EmotionExplorerBadge,
    description: "You uncovered 3+ emotions in one entry. Impressive insight!",
  },
  {
    key: "mood_shifter",
    image: MoodShifterBadge,
    description: "You experienced a range of emotions this week. That’s real growth!",
  },
  {
    key: "let_it_out",
    image: LetItOutBadge,
    description: "You let out strong emotions. That took courage!",
  },
  {
    key: "image_storyteller",
    image: ImageStorytellerBadge,
    description: "You added images to tell a story. A picture is worth a thousand words!",
  },
  {
    key: "night_owl",
    image: NightOwl,
    description: "You journaled late at night. Burning the midnight oil!",
  },
  {
    key: "early_bird",
    image: EarlyBird,
    description: "You journaled early in the morning. What a fresh start!",
  },
  {
    key: "one_year",
    image: OneYear,
    description: "You kept journaling for a full year. What a powerful habit!",
  }
];

  

const BadgeCongratsModal: React.FC<BadgeCongratsModalProps> = ({ visible, badgeKey, onClose }) => {
  const { theme } = useTheme();

  const badge = badgeData.find(b => b.key === badgeKey);

  if (!badge) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.title, { color: theme.primary }]}>🎉 Congratulations!</Text>
          <Image source={badge.image} style={styles.image} />
          <Text style={[styles.description, { color: theme.text }]}>{badge.description}</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={[styles.closeText, { color: theme.primary }]}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  container: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    maxWidth: '80%'
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16
  },
  image: {
    width: 80,
    height: 80,
    marginBottom: 16
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16
  },
  closeText: {
    fontWeight: 'bold',
    fontSize: 16
  }
});

export default BadgeCongratsModal;
