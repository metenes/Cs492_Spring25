import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import EditProfileModal from './EditProfileModal';
import { changePassword } from './services/ApiService';

// Mock the changePassword function
jest.mock('./services/ApiService', () => ({
  changePassword: jest.fn(),
}));

describe('EditProfileModal Password Change', () => {
  const mockProps = {
    modal_Visible_edit: true,
    setModal_Visible_edit: jest.fn(),
    onClose: jest.fn(),
    name: 'Test User',
    setName: jest.fn(),
    bio: 'Test Bio',
    setBio: jest.fn(),
    phone: '1234567890',
    setPhone: jest.fn(),
    location: 'Test Location',
    setLocation: jest.fn(),
    saveProfileChanges: jest.fn(),
    theme: {
      backgroundColor: '#fff',
      text: '#000',
      textSecondary: '#666',
      inputBackground: '#f5f5f5',
      border: '#ddd',
      placeholder: '#999',
      primary: '#007AFF',
      buttonText: '#fff',
      cardBackground: '#fff',
      danger: '#FF3B30',
    },
    token: 'test-token',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show error when old password is empty', async () => {
    const { getByTestId, getByText } = render(<EditProfileModal {...mockProps} />);
    
    const newPasswordInput = getByTestId('newPasswordInput');
    const changePasswordButton = getByTestId('changePasswordButton');

    fireEvent.changeText(newPasswordInput, 'newPassword123');
    fireEvent.press(changePasswordButton);

    await waitFor(() => {
      expect(getByText('Please fill in both password fields')).toBeTruthy();
    });
  });

  it('should show error when new password is empty', async () => {
    const { getByTestId, getByText } = render(<EditProfileModal {...mockProps} />);
    
    const oldPasswordInput = getByTestId('oldPasswordInput');
    const changePasswordButton = getByTestId('changePasswordButton');

    fireEvent.changeText(oldPasswordInput, 'oldPassword123');
    fireEvent.press(changePasswordButton);

    await waitFor(() => {
      expect(getByText('Please fill in both password fields')).toBeTruthy();
    });
  });

  it('should show authentication error when token is missing', async () => {
    const { getByTestId, getByText } = render(
      <EditProfileModal {...mockProps} token="" />
    );
    
    const oldPasswordInput = getByTestId('oldPasswordInput');
    const newPasswordInput = getByTestId('newPasswordInput');
    const changePasswordButton = getByTestId('changePasswordButton');

    fireEvent.changeText(oldPasswordInput, 'oldPassword123');
    fireEvent.changeText(newPasswordInput, 'newPassword123');
    fireEvent.press(changePasswordButton);

    await waitFor(() => {
      expect(getByText('Authentication error. Please try again.')).toBeTruthy();
    });
  });

  it('should call changePassword API with correct parameters', async () => {
    const { getByTestId } = render(<EditProfileModal {...mockProps} />);
    
    const oldPasswordInput = getByTestId('oldPasswordInput');
    const newPasswordInput = getByTestId('newPasswordInput');
    const changePasswordButton = getByTestId('changePasswordButton');

    fireEvent.changeText(oldPasswordInput, 'oldPassword123');
    fireEvent.changeText(newPasswordInput, 'newPassword123');
    fireEvent.press(changePasswordButton);

    await waitFor(() => {
      expect(changePassword).toHaveBeenCalledWith(
        mockProps.token,
        'oldPassword123',
        'newPassword123'
      );
    });
  });

  it('should show success message and clear fields on successful password change', async () => {
    (changePassword as jest.Mock).mockResolvedValueOnce({ message: 'success' });
    
    const { getByTestId, getByText, queryByText } = render(
      <EditProfileModal {...mockProps} />
    );
    
    const oldPasswordInput = getByTestId('oldPasswordInput');
    const newPasswordInput = getByTestId('newPasswordInput');
    const changePasswordButton = getByTestId('changePasswordButton');

    fireEvent.changeText(oldPasswordInput, 'oldPassword123');
    fireEvent.changeText(newPasswordInput, 'newPassword123');
    fireEvent.press(changePasswordButton);

    await waitFor(() => {
      expect(changePassword).toHaveBeenCalled();
      expect(getByTestId('passwordSuccessMessage')).toBeTruthy();
      expect(oldPasswordInput.props.value).toBe('');
      expect(newPasswordInput.props.value).toBe('');
      expect(queryByText('Please fill in both password fields')).toBeNull();
    });
  });

  it('should show error message when password change fails', async () => {
    const errorMessage = 'Invalid current password';
    (changePassword as jest.Mock).mockRejectedValueOnce({
      response: { data: { msg: errorMessage } }
    });
    
    const { getByTestId, getByText } = render(
      <EditProfileModal {...mockProps} />
    );
    
    const oldPasswordInput = getByTestId('oldPasswordInput');
    const newPasswordInput = getByTestId('newPasswordInput');
    const changePasswordButton = getByTestId('changePasswordButton');

    fireEvent.changeText(oldPasswordInput, 'wrongPassword');
    fireEvent.changeText(newPasswordInput, 'newPassword123');
    fireEvent.press(changePasswordButton);

    await waitFor(() => {
      expect(getByText(errorMessage)).toBeTruthy();
    });
  });

  it('should successfully change password for user irem.akel@ug.bilkent.edu.tr', async () => {
    (changePassword as jest.Mock).mockResolvedValueOnce({ message: 'success' });
    
    const { getByTestId, getByText, queryByText } = render(
      <EditProfileModal {...mockProps} />
    );
    
    const oldPasswordInput = getByTestId('oldPasswordInput');
    const newPasswordInput = getByTestId('newPasswordInput');
    const changePasswordButton = getByTestId('changePasswordButton');

    fireEvent.changeText(oldPasswordInput, 'password123');
    fireEvent.changeText(newPasswordInput, 'password1234');
    fireEvent.press(changePasswordButton);

    await waitFor(() => {
      expect(changePassword).toHaveBeenCalledWith(
        mockProps.token,
        'password123',
        'password1234'
      );
      expect(getByText('Password changed successfully')).toBeTruthy();
      expect(oldPasswordInput.props.value).toBe('');
      expect(newPasswordInput.props.value).toBe('');
      expect(queryByText('Please fill in both password fields')).toBeNull();
      expect(queryByText('Authentication error')).toBeNull();
    });
  });

  it('should handle failed password change for user irem.akel@ug.bilkent.edu.tr', async () => {
    const errorMessage = 'Invalid current password';
    (changePassword as jest.Mock).mockRejectedValueOnce({
      response: { data: { msg: errorMessage } }
    });
    
    const { getByTestId, getByText } = render(
      <EditProfileModal {...mockProps} />
    );
    
    const oldPasswordInput = getByTestId('oldPasswordInput');
    const newPasswordInput = getByTestId('newPasswordInput');
    const changePasswordButton = getByTestId('changePasswordButton');

    fireEvent.changeText(oldPasswordInput, 'password123');
    fireEvent.changeText(newPasswordInput, 'password1234');
    fireEvent.press(changePasswordButton);

    await waitFor(() => {
      expect(getByText(errorMessage)).toBeTruthy();
      expect(changePassword).toHaveBeenCalledWith(
        mockProps.token,
        'password123',
        'password1234'
      );
    });
  });
});
