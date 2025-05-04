import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useTheme } from './context/ThemeContext';

const steps = [
  {
    title: "Welcome to Sentio 👋",
    description: "Let us give you a quick tour of how everything works."
  },
  {
    title: "Your Dashboard",
    description: "This is where you'll see your entries, check-ins, and journal streaks."
  },
  {
    title: "Explore & Journal",
    description: "Use the floating + button to write journals, check in, or access the AI assistant."
  }
];

const OnboardingWizard = ({ onComplete }: { onComplete: () => void }) => {
  const [step, setStep] = useState(0);
  const { theme } = useTheme();

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(prev => prev + 1);
    } else {
      onComplete(); // Finish wizard
    }
  };

  const handleSkip = () => {
    onComplete(); // Skip immediately
  };

  const { title, description } = steps[step];

  return (
    <Modal transparent animationType="fade" visible>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>{description}</Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={handleSkip} style={[styles.button, styles.skip]}>
              <Text style={[styles.buttonText, { color: theme.text }]}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleNext} style={[styles.button, styles.next]}>
              <Text style={[styles.buttonText, { color: '#fff' }]}>{step === steps.length - 1 ? 'Finish' : 'Next'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const { width } = Dimensions.get('window');
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  container: {
    width: width * 0.85,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center'
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center'
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10
  },
  skip: {
    borderWidth: 1,
    borderColor: '#ccc'
  },
  next: {
    backgroundColor: '#3b82f6'
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600'
  }
});

export default OnboardingWizard;
