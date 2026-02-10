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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL + '/api';

interface Chat {
  id: string;
  title: string;
  preview?: string;
  message_count: number;
  updated_at: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
}

export default function ProjectDetail() {
  const { token } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const projectId = id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjectAndChats();
  }, [projectId]);

  const loadProjectAndChats = async () => {
    try {
      // Load project details
      const projectsResponse = await axios.get(`${API_URL}/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const foundProject = projectsResponse.data.find((p: Project) => p.id === projectId);
      setProject(foundProject);

      // Load chats for this project
      const chatsResponse = await axios.get(`${API_URL}/chats?project_id=${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setChats(chatsResponse.data);
    } catch (error) {
      console.error('Error loading project:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteChat = async (chatId: string) => {
    Alert.alert('Delete Chat', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await axios.delete(`${API_URL}/chats/${chatId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            loadProjectAndChats();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete chat');
          }
        },
      },
    ]);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const renderChatItem = ({ item }: { item: Chat }) => (
    <TouchableOpacity
      style={styles.chatCard}
      onPress={() => router.push(`/main?chatId=${item.id}&projectId=${projectId}`)}
    >
      <View style={styles.chatCardContent}>
        <Text style={styles.chatCardTitle} numberOfLines={1}>
          {item.title}
        </Text>
        {item.preview && (
          <Text style={styles.chatCardPreview} numberOfLines={2}>
            {item.preview}
          </Text>
        )}
        <View style={styles.chatCardFooter}>
          <Text style={styles.chatCardDate}>{formatDate(item.updated_at)}</Text>
          <Text style={styles.chatCardCount}>{item.message_count} messages</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.chatDeleteBtn}
        onPress={() => deleteChat(item.id)}
      >
        <Ionicons name="trash-outline" size={18} color="#E74C3C" />
      </TouchableOpacity>
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#2C3E50" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.projectName}>{project?.name}</Text>
          {project?.description && (
            <Text style={styles.projectDesc}>{project.description}</Text>
          )}
        </View>
      </View>

      <TouchableOpacity
        style={styles.newChatBtn}
        onPress={() => router.push(`/main?projectId=${projectId}`)}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.newChatBtnText}>New Chat</Text>
      </TouchableOpacity>

      <FlatList
        data={chats}
        renderItem={renderChatItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.chatsList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color="#BDC3C7" />
            <Text style={styles.emptyText}>No chats yet</Text>
            <Text style={styles.emptySubtext}>Start a new chat in this project</Text>
          </View>
        }
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
  backBtn: {
    padding: 8,
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  projectName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2C3E50',
  },
  projectDesc: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 4,
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90E2',
    margin: 16,
    padding: 14,
    borderRadius: 12,
  },
  newChatBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  chatsList: {
    padding: 16,
    paddingTop: 0,
  },
  chatCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E1E8ED',
    alignItems: 'center',
  },
  chatCardContent: {
    flex: 1,
  },
  chatCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 6,
  },
  chatCardPreview: {
    fontSize: 13,
    color: '#7F8C8D',
    lineHeight: 18,
    marginBottom: 8,
  },
  chatCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chatCardDate: {
    fontSize: 12,
    color: '#95A5A6',
  },
  chatCardCount: {
    fontSize: 12,
    color: '#95A5A6',
  },
  chatDeleteBtn: {
    padding: 8,
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
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
});
