import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Clipboard,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as Clipboard2 from 'expo-clipboard';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL + '/api';

export default function Chat() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const sessionId = params.sessionId as string | undefined;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessionId || null);
  const [sessionInfo, setSessionInfo] = useState({ subject: '', topic: '', title: '' });
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (sessionId) {
      loadSession();
    }
  }, [sessionId]);

  const loadSession = async () => {
    try {
      const response = await axios.get(`${API_URL}/chat/session/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setMessages(response.data.messages);
      setSessionInfo({
        subject: response.data.subject,
        topic: response.data.topic,
        title: response.data.title,
      });
      setCurrentSessionId(sessionId!);
    } catch (error) {
      console.error('Error loading session:', error);
      Alert.alert('Error', 'Failed to load chat session');
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: inputText,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      const response = await axios.post(
        `${API_URL}/chat`,
        {
          message: inputText,
          session_id: currentSessionId,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      setCurrentSessionId(response.data.session_id);
      
      if (!sessionInfo.subject) {
        setSessionInfo({
          subject: response.data.subject,
          topic: response.data.topic,
          title: response.data.title,
        });
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await Clipboard2.setStringAsync(text);
    Alert.alert('Copied', 'Answer copied to clipboard');
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.messageContainer,
        item.role === 'user' ? styles.userMessage : styles.assistantMessage,
      ]}
    >
      <View style={styles.messageHeader}>
        <Ionicons
          name={item.role === 'user' ? 'person-circle' : 'school'}
          size={24}
          color={item.role === 'user' ? '#4A90E2' : '#27AE60'}
        />
        <Text style={styles.messageRole}>
          {item.role === 'user' ? 'You' : 'EduChat'}
        </Text>
      </View>
      <Text style={styles.messageText}>{item.content}</Text>
      {item.role === 'assistant' && (
        <TouchableOpacity
          style={styles.copyButton}
          onPress={() => copyToClipboard(item.content)}
        >
          <Ionicons name="copy-outline" size={16} color="#4A90E2" />
          <Text style={styles.copyButtonText}>Copy</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#2C3E50" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>
            {sessionInfo.title || 'New Chat'}
          </Text>
          {sessionInfo.subject && (
            <Text style={styles.headerSubtitle}>
              {sessionInfo.subject} - {sessionInfo.topic}
            </Text>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.chatContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item, index) => index.toString()}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={64} color="#BDC3C7" />
              <Text style={styles.emptyText}>Ask me anything about</Text>
              <Text style={styles.emptyText}>CBSE NCERT Maths & Science!</Text>
            </View>
          }
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask a question..."
            placeholderTextColor="#999"
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || loading) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E8ED',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 2,
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#7F8C8D',
    marginTop: 8,
  },
  messageContainer: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    maxWidth: '85%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#E3F2FD',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E1E8ED',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  messageRole: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginLeft: 8,
  },
  messageText: {
    fontSize: 15,
    color: '#2C3E50',
    lineHeight: 22,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 4,
  },
  copyButtonText: {
    fontSize: 12,
    color: '#4A90E2',
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E1E8ED',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
