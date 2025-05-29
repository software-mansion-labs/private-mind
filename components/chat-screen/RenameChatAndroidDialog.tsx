import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';

interface Props {
  visible: boolean;
  initialTitle: string;
  onCancel: () => void;
  onConfirm: (newTitle: string) => void;
}

const RenameChatAndroidDialog: React.FC<Props> = ({
  visible,
  initialTitle,
  onCancel,
  onConfirm,
}) => {
  const [newTitle, setNewTitle] = useState(initialTitle);

  const handleConfirm = () => {
    onConfirm(newTitle.trim());
    setNewTitle('');
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.title}>Rename Chat</Text>
            <TextInput
              style={styles.input}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Enter new chat name"
              autoFocus
            />
            <View style={styles.buttons}>
              <TouchableOpacity onPress={onCancel}>
                <Text style={styles.cancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleConfirm}>
                <Text style={styles.ok}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default RenameChatAndroidDialog;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialog: {
    width: 300,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 20,
    elevation: 4,
  },
  title: {
    fontSize: 18,
    marginBottom: 10,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 4,
    marginBottom: 16,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  cancel: {
    fontSize: 16,
    color: '#666',
  },
  ok: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
});
