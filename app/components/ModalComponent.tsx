import React from "react";
import { Modal, View, Text, Button, StyleSheet } from "react-native";

const ModalComponent = ({ visible, message, onConfirm, onCancel }) => {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContent}>
          <Text>{message}</Text>
          <View style={styles.buttonContainer}>
            <Button title="Confirm" onPress={onConfirm} />
            <Button title="Cancel" onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonContainer: {
    flexDirection: "row",
    marginTop: 20,
  },
});

export default ModalComponent;
