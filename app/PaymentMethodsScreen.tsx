import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { CreditCard } from 'lucide-react';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

type RootStackParamList = {
  PaymentMethods: undefined;
  AddPaymentMethod: undefined;
};

type NavigationProp = StackNavigationProp<RootStackParamList, 'PaymentMethods'>;

export const PaymentMethodsScreen = () => {
  const navigation = useNavigation<NavigationProp>();

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F8F8' }}>
      <ScrollView style={{ padding: 16 }}>
        <TouchableOpacity 
          style={{
            backgroundColor: 'white',
            padding: 16,
            borderRadius: 8,
            marginBottom: 16,
            flexDirection: 'row',
            alignItems: 'center'
          }}
        >
          <CreditCard style={{ marginRight: 16 }} />
          <View>
            <Text style={{ fontWeight: 'bold' }}>•••• •••• •••• 1234</Text>
            <Text style={{ color: '#B0B0B0' }}>Expires 12/24</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity 
          style={{
            backgroundColor: '#2196F3',
            padding: 16,
            borderRadius: 8
          }}
          onPress={() => navigation.navigate('AddPaymentMethod')}
        >
          <Text style={{ color: 'white', textAlign: 'center' }}>Add New Payment Method</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};
