import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

type RootStackParamList = {
  FreeJournaling: undefined;
  Saving: { content: string };
};

type NavigationProp = StackNavigationProp<RootStackParamList, 'FreeJournaling'>;

const FreeJournalingScreen = () => {
  const [content, setContent] = useState('');
  const navigation = useNavigation<NavigationProp>();

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F8F8', padding: 16 }}>
      <TextInput
        style={{
          flex: 1,
          backgroundColor: 'white',
          padding: 16,
          borderRadius: 8,
          marginBottom: 16
        }}
        multiline
        placeholder="How are you feeling today?"
        value={content}
        onChangeText={setContent}
      />
      <TouchableOpacity 
        style={{
          backgroundColor: '#2196F3',
          padding: 16,
          borderRadius: 8
        }}
        onPress={() => navigation.navigate('Saving', { content })}
      >
        <Text style={{ color: 'white', textAlign: 'center' }}>Save Entry</Text>
      </TouchableOpacity>
    </View>
  );
};

export default FreeJournalingScreen;
