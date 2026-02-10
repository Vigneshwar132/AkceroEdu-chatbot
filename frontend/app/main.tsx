import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as Clipboard from 'expo-clipboard';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL + '/api';

interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface Chat {
  id: string;
  project_id?: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export default function Main() {
  const { user, token, logout } = useAuth();
  const router = useRouter();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadProjects();
    loadChats();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await axios.get(`${API_URL}/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProjects(response.data);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const loadChats = async (projectId?: string) => {
    try {
      const url = projectId 
        ? `${API_URL}/chats?project_id=${projectId}`
        : `${API_URL}/chats`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setChats(response.data);
    } catch (error) {
      console.error('Error loading chats:', error);
    }
  };

  const loadChatMessages = async (chatId: string) => {
    try {
      const response = await axios.get(`${API_URL}/chats/${chatId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages(response.data.messages);
      setCurrentChatId(chatId);
      setCurrentProjectId(response.data.project_id);
      setSidebarOpen(false);
    } catch (error) {
      console.error('Error loading chat:', error);
    }
  };

  const createNewChat = () => {
    setCurrentChatId(null);
    setCurrentProjectId(null);
    setMessages([]);
    setSidebarOpen(false);
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMsg: Message = {
      role: 'user',
      content: inputText,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const response = await axios.post(
        `${API_URL}/chat`,
        {
          message: userMsg.content,
          chat_id: currentChatId,
          project_id: currentProjectId,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const assistantMsg: Message = {
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMsg]);
      
      if (!currentChatId) {
        setCurrentChatId(response.data.chat_id);
        loadChats(currentProjectId || undefined);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const createProject = async () => {
    if (!newProjectName.trim()) {
      Alert.alert('Error', 'Please enter a project name');
      return;
    }

    try {
      await axios.post(
        `${API_URL}/projects`,
        {
          name: newProjectName,
          description: newProjectDesc,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setShowNewProjectModal(false);
      setNewProjectName('');
      setNewProjectDesc('');
      loadProjects();
    } catch (error) {
      Alert.alert('Error', 'Failed to create project');
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
            if (currentChatId === chatId) {
              createNewChat();
            }
            loadChats(currentProjectId || undefined);
          } catch (error) {
            Alert.alert('Error', 'Failed to delete chat');
          }
        },
      },
    ]);
  };

  const toggleProject = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', 'Message copied to clipboard');
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.messageBox,
        item.role === 'user' ? styles.userMessageBox : styles.assistantMessageBox,
      ]}
    >
      <View style={styles.messageHeader}>
        <View style={styles.avatarContainer}>
          {item.role === 'user' ? (
            <View style={[styles.avatar, styles.userAvatar]}>
              <Text style={styles.avatarText}>{user?.username[0].toUpperCase()}</Text>
            </View>
          ) : (
            <View style={[styles.avatar, styles.assistantAvatar]}>
              <Ionicons name="school" size={16} color="#fff" />
            </View>
          )}
        </View>
        <Text style={styles.messageContent}>{item.content}</Text>
      </View>
      {item.role === 'assistant' && (
        <TouchableOpacity
          style={styles.copyBtn}
          onPress={() => copyToClipboard(item.content)}
        >
          <Ionicons name="copy-outline" size={14} color="#666" />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => setSidebarOpen(!sidebarOpen)} style={styles.menuBtn}>
          <Ionicons name="menu" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>New Chat</Text>
        <TouchableOpacity onPress={createNewChat} style={styles.newChatBtn}>
          <Ionicons name="create-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Main Chat Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.chatArea}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={80} color="#555" />
            <Text style={styles.emptyTitle}>EduChat</Text>
            <Text style={styles.emptySubtitle}>Ask me anything about CBSE Maths & Science!</Text>
          </View>
        ) : (
          <FlatList
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item, index) => index.toString()}
            contentContainerStyle={styles.messagesList}
          />
        )}

        {/* Input Area */}
        <View style={styles.inputArea}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Message EduChat..."
              placeholderTextColor="#888"
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!inputText.trim() || loading) && styles.sendBtnDisabled]}
              onPress={sendMessage}
              disabled={!inputText.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="arrow-up" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Sidebar */}
      <Modal
        visible={sidebarOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSidebarOpen(false)}
      >
        <View style={styles.sidebarOverlay}>
          <View style={styles.sidebar}>
            <View style={styles.sidebarHeader}>
              <TouchableOpacity onPress={() => setSidebarOpen(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.sidebarTitle}>Menu</Text>
            </View>

            <ScrollView style={styles.sidebarContent}>
              {/* New Chat Button */}
              <TouchableOpacity style={styles.sidebarNewChat} onPress={createNewChat}>
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.sidebarNewChatText}>New Chat</Text>
              </TouchableOpacity>

              {/* Projects Section */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Projects</Text>
                  <TouchableOpacity onPress={() => setShowNewProjectModal(true)}>
                    <Ionicons name="add-circle-outline" size={20} color="#888" />
                  </TouchableOpacity>
                </View>

                {projects.map(project => (
                  <View key={project.id}>
                    <TouchableOpacity
                      style={styles.projectItem}
                      onPress={() => toggleProject(project.id)}
                    >
                      <Ionicons
                        name={expandedProjects.has(project.id) ? 'chevron-down' : 'chevron-forward'}
                        size={16}
                        color="#888"
                      />
                      <Text style={styles.projectName}>{project.name}</Text>
                    </TouchableOpacity>

                    {expandedProjects.has(project.id) && (
                      <View style={styles.projectChats}>
                        {chats
                          .filter(chat => chat.project_id === project.id)
                          .map(chat => (
                            <View key={chat.id} style={styles.chatItemContainer}>
                              <TouchableOpacity
                                style={styles.chatItem}
                                onPress={() => loadChatMessages(chat.id)}
                              >
                                <Text style={styles.chatTitle} numberOfLines={1}>
                                  {chat.title}
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => deleteChat(chat.id)}>
                                <Ionicons name="trash-outline" size={16} color="#666" />
                              </TouchableOpacity>
                            </View>
                          ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>

              {/* Recent Chats (without project) */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recent Chats</Text>
                {chats
                  .filter(chat => !chat.project_id)
                  .map(chat => (
                    <View key={chat.id} style={styles.chatItemContainer}>
                      <TouchableOpacity
                        style={styles.chatItem}
                        onPress={() => loadChatMessages(chat.id)}
                      >
                        <Text style={styles.chatTitle} numberOfLines={1}>
                          {chat.title}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteChat(chat.id)}>
                        <Ionicons name="trash-outline" size={16} color="#666" />
                      </TouchableOpacity>
                    </View>
                  ))}
              </View>
            </ScrollView>

            {/* User Section */}
            <View style={styles.userSection}>
              <View style={styles.userInfo}>
                <View style={[styles.avatar, styles.userAvatar]}>
                  <Text style={styles.avatarText}>{user?.username[0].toUpperCase()}</Text>
                </View>
                <Text style={styles.username}>{user?.username}</Text>
              </View>
              <TouchableOpacity onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={24} color="#E74C3C" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* New Project Modal */}
      <Modal visible={showNewProjectModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Project</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Project Name (e.g., Geometry)"
              placeholderTextColor="#888"
              value={newProjectName}
              onChangeText={setNewProjectName}
            />
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              placeholder="Description (optional)"
              placeholderTextColor="#888"
              value={newProjectDesc}
              onChangeText={setNewProjectDesc}
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => setShowNewProjectModal(false)}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalCreateBtn]} onPress={createProject}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E1E1E',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#2A2A2A',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  menuBtn: {
    padding: 8,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  newChatBtn: {
    padding: 8,
  },
  chatArea: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 24,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#888',
    marginTop: 12,
    textAlign: 'center',
  },
  messagesList: {
    padding: 16,
  },
  messageBox: {
    marginBottom: 24,
  },
  userMessageBox: {},
  assistantMessageBox: {},
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatar: {
    backgroundColor: '#4A90E2',
  },
  assistantAvatar: {
    backgroundColor: '#27AE60',
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  messageContent: {
    flex: 1,
    fontSize: 15,
    color: '#E0E0E0',
    lineHeight: 22,
  },
  copyBtn: {
    marginTop: 8,
    marginLeft: 44,
    padding: 4,
  },
  inputArea: {
    padding: 16,
    backgroundColor: '#2A2A2A',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3A3A3A',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
    maxHeight: 100,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sidebarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sidebar: {
    width: '80%',
    height: '100%',
    backgroundColor: '#2A2A2A',
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1E1E1E',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  sidebarTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 16,
  },
  sidebarContent: {
    flex: 1,
    padding: 16,
  },
  sidebarNewChat: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  sidebarNewChatText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
  },
  projectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginBottom: 4,
  },
  projectName: {
    fontSize: 15,
    color: '#fff',
    marginLeft: 8,
  },
  projectChats: {
    marginLeft: 24,
  },
  chatItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatItem: {
    flex: 1,
    padding: 8,
    backgroundColor: '#3A3A3A',
    borderRadius: 6,
    marginRight: 8,
  },
  chatTitle: {
    fontSize: 14,
    color: '#E0E0E0',
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1E1E1E',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: '#3A3A3A',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#fff',
    marginBottom: 12,
  },
  modalTextArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  modalBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 12,
  },
  modalCancelBtn: {
    backgroundColor: '#555',
  },
  modalCreateBtn: {
    backgroundColor: '#4A90E2',
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
