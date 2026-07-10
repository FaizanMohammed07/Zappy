import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSocket } from '../../hooks/useSocket';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { Send } from 'lucide-react-native';

interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: string;
}

export default function ChatScreen() {
  const { id: orderId } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  
  const socketClient = useSocket(orderId);
  const user = useSelector((state: RootState) => state.auth.user);

  useEffect(() => {
    socketClient.on('chat.message', (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socketClient.off('chat.message');
    };
  }, [socketClient]);

  const handleSend = () => {
    if (!text.trim()) return;
    
    const newMessage = {
      orderId,
      text,
      senderId: user?._id || 'unknown',
      createdAt: new Date().toISOString(),
    };

    // Emit to backend socket
    socketClient.emit('chat.send', newMessage);
    
    // Optimistic update
    setMessages((prev) => [...prev, { id: Math.random().toString(), ...newMessage }]);
    setText('');
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === user?._id;
    return (
      <View className={`p-3 rounded-xl max-w-[80%] my-1 ${isMe ? 'bg-primary self-end' : 'bg-gray-200 self-start'}`}>
        <Text className={isMe ? 'text-white' : 'text-navy'}>{item.text}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="p-4 border-b border-gray-200">
          <Text className="text-xl font-bold text-navy">Order Chat</Text>
          <Text className="text-gray-500 text-sm">Order ID: {orderId}</Text>
        </View>

        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={{ padding: 16 }}
          className="flex-1"
        />

        <View className="p-4 border-t border-gray-200 flex-row items-center">
          <TextInput
            className="flex-1 bg-gray-100 rounded-full px-4 py-3 mr-3"
            placeholder="Type a message..."
            value={text}
            onChangeText={setText}
          />
          <TouchableOpacity 
            className="bg-primary w-12 h-12 rounded-full items-center justify-center"
            onPress={handleSend}
          >
            <Send size={20} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
