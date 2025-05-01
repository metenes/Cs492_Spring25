import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { changePassword } from './services/ApiService';

interface Theme {
  backgroundColor: string;
  text: string;
  textSecondary: string;
  inputBackground: string;
  border: string;
  placeholder: string;
  primary: string;
  buttonText: string;
  cardBackground: string;
  danger: string;
}

interface EditProfileModalProps {
  modal_Visible_edit: boolean;
  setModal_Visible_edit: (value: boolean) => void;
  onClose: () => void;
  name: string;
  setName: (name: string) => void;
  bio: string;
  setBio: (bio: string) => void;
  phone: string;
  setPhone: (phone: string) => void;
  location: string;
  setLocation: (location: string) => void;
  saveProfileChanges: () => void;
  theme: Theme;
  token: string;
}

export default function EditProfileModal({
  modal_Visible_edit,
  setModal_Visible_edit,
  onClose,
  name,
  setName,
  bio,
  setBio,
  phone,
  setPhone,
  location,
  setLocation,
  saveProfileChanges,
  theme,
  token
}: EditProfileModalProps) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleSave = async () => {
    try {
      await saveProfileChanges();
      setModal_Visible_edit(false);
    } catch (err) {
      console.log('Save failed, modal stays open');
    }
  };

  const handlePasswordChange = async () => {
    try {
      if (!oldPassword || !newPassword) {
        setPasswordError('Please fill in both password fields');
        return;
      }

      if (!token) {
        setPasswordError('Authentication error. Please try again.');
        return;
      }

      const result = await changePassword(token, oldPassword, newPassword);
      
      if (result.message === 'success') {
        setPasswordError('');
        setOldPassword('');
        setNewPassword('');
        Alert.alert('Success', 'Password changed successfully');
      } else {
        setPasswordError(result.message || 'Failed to change password');
      }
    } catch (error: any) {
      console.error('Password change error:', error);
      if (error.response?.data?.msg) {
        setPasswordError(error.response.data.msg);
      } else {
        setPasswordError('Failed to change password. Please try again.');
      }
    }
  };

  return (
    <Modal
      visible={modal_Visible_edit}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalContainer, { backgroundColor: theme.cardBackground }]}
        >
          <Text style={[styles.header, { color: theme.text }]}>Edit Profile</Text>

          <Text style={[styles.label, { color: theme.textSecondary }]}>Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text }]}
            placeholder="Your name"
            placeholderTextColor={theme.placeholder}
            value={name}
            onChangeText={setName}
          />

          <Text style={[styles.label, { color: theme.textSecondary }]}>Bio</Text>
          <TextInput
            style={[styles.textarea, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text }]}
            placeholder="Tell us about yourself"
            placeholderTextColor={theme.placeholder}
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={3}
          />

          <Text style={[styles.label, { color: theme.textSecondary }]}>Phone</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text }]}
            placeholder="Your phone number"
            placeholderTextColor={theme.placeholder}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <Text style={[styles.label, { color: theme.textSecondary }]}>Location</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text }]}
            placeholder="Your location"
            placeholderTextColor={theme.placeholder}
            value={location}
            onChangeText={setLocation}
          />

          <Text style={[styles.label, { color: theme.textSecondary }]}>Change Password</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text }]}
            placeholder="Old password"
            placeholderTextColor={theme.placeholder}
            value={oldPassword}
            onChangeText={setOldPassword}
            secureTextEntry
          />
          <TextInput
            style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text }]}
            placeholder="New password"
            placeholderTextColor={theme.placeholder}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
          />
          {passwordError ? <Text style={[styles.errorText, { color: theme.danger }]}>{passwordError}</Text> : null}
          <TouchableOpacity
            style={[styles.passwordButton, { backgroundColor: '#000000' }]}
            onPress={handlePasswordChange}
          >
            <Text style={[styles.passwordButtonText, { color: '#FFFFFF' }]}>Change Password</Text>
          </TouchableOpacity>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: '#000000', marginBottom:2 }]}
              onPress={handleSave}
            >
              <Text style={[styles.saveText, { color: '#FFFFFF' }]}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: theme.border, marginBottom:2 }]}
              onPress={onClose}
            >
              <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    marginBottom: 20,
  },
  header: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    marginTop: 12,
    marginBottom: 4,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  textarea: {
    height: 80,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 10,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '500',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
  },
  passwordButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  passwordButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 14,
    marginTop: 5,
    textAlign: 'center',
  },
});
