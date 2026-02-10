import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

interface ChatSession {
  id: string;
  subject: string;
  topic: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL + '/api';

export default function History() {
  const { token } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const response = await axios.get(`${API_URL}/chat/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSessions(response.data);
    } catch (error) {
      console.error('Error loading history:', error);
      Alert.alert('Error', 'Failed to load chat history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  const deleteSession = async (sessionId: string) => {
    Alert.alert(
      'Delete Chat',
      'Are you sure you want to delete this chat?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`${API_URL}/chat/session/${sessionId}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              setSessions(prev => prev.filter(s => s.id !== sessionId));
            } catch (error) {
              Alert.alert('Error', 'Failed to delete chat');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getSubjectColor = (subject: string) => {
    if (subject.toLowerCase().includes('math')) {
      return '#E74C3C';
    } else if (subject.toLowerCase().includes('science')) {
      return '#27AE60';
    }
    return '#95A5A6';
  };

  const getSubjectIcon = (subject: string) => {
    if (subject.toLowerCase().includes('math')) {
      return 'calculator';
    } else if (subject.toLowerCase().includes('science')) {
      return 'flask';
    }
    return 'book';
  };

  const renderSession = ({ item }: { item: ChatSession }) => (
    <TouchableOpacity
      style={styles.sessionCard}
      onPress={() => router.push(`/chat?sessionId=${item.id}`)}
    >
      <View style={styles.sessionHeader}>
        <View style={[styles.subjectIcon, { backgroundColor: getSubjectColor(item.subject) }]}>
          <Ionicons name={getSubjectIcon(item.subject) as any} size={20} color="#fff" />
        </View>
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.sessionMeta}>
            {item.subject} • {item.topic}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteSession(item.id)}
        >
          <Ionicons name="trash-outline" size={20} color="#E74C3C" />
        </TouchableOpacity>
      </View>
      <View style={styles.sessionFooter}>
        <Text style={styles.sessionDate}>{formatDate(item.updated_at)}</Text>
        <Text style={styles.messageCount}>{item.message_count} messages</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#2C3E50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chat History</Text>
      </View>

      <FlatList
        data={sessions}
        renderItem={renderSession}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent=(
          <View style={styles.emptyContainer}>
            <Ionicons name="time-outline" size={64} color="#BDC3C7" />
            <Text style={styles.emptyText}>No chat history yet</Text>
            <Text style={styles.emptySubtext}>Start a new conversation to see it here</Text>
            <TouchableOpacity
              style={styles.newChatButton}
              onPress={() => router.push('/chat')}
            >
              <Text style={styles.newChatButtonText}>Start Chatting</Text>
            </TouchableOpacity>
          </View>
        )
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  sessionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E1E8ED',
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  subjectIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 4,
  },
  sessionMeta: {
    fontSize: 12,
    color: '#7F8C8D',
  },
  deleteButton: {
    padding: 8,
  },
  sessionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sessionDate: {
    fontSize: 12,
    color: '#95A5A6',
  },
  messageCount: {
    fontSize: 12,
    color: '#95A5A6',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 8,
  },
  newChatButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
  },
  newChatButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
