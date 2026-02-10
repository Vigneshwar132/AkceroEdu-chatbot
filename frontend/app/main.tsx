import React, { useState, useEffect, useRef } from 'react';
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
  preview?: string;
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
  const flatListRef = useRef<FlatList>(null);
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allChats, setAllChats] = useState<Chat[]>([]);
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
    loadAllChats();
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

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

  const loadAllChats = async () => {
    try {
      const response = await axios.get(`${API_URL}/chats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAllChats(response.data);
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

  const createNewChat = (projectId?: string) => {
    setCurrentChatId(null);
    setCurrentProjectId(projectId || null);
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
        loadAllChats();
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
      const response = await axios.post(
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
      
      // Auto-open new chat in this project
      createNewChat(response.data.id);
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
            loadAllChats();
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

  const getChatsForProject = (projectId: string) => {
    return allChats.filter(chat => chat.project_id === projectId);
  };

  const getRecentChats = () => {
    return allChats.filter(chat => !chat.project_id);
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={styles.messageContainer}>
      <View style={[styles.messageBubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
        <View style={styles.messageHeader}>
          <View style={[styles.avatar, item.role === 'user' ? styles.userAvatar : styles.assistantAvatar]}>
            {item.role === 'user' ? (
              <Text style={styles.avatarText}>{user?.username[0].toUpperCase()}</Text>
            ) : (
              <Ionicons name="school" size={18} color="#fff" />
            )}
          </View>
          <Text style={styles.roleText}>{item.role === 'user' ? 'You' : 'EduChat'}</Text>
        </View>
        <Text style={styles.messageText}>{item.content}</Text>
        {item.role === 'assistant' && (
          <TouchableOpacity style={styles.copyButton} onPress={() => copyToClipboard(item.content)}>
            <Ionicons name="copy-outline" size={16} color="#4A90E2" />
            <Text style={styles.copyText}>Copy</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => setSidebarOpen(true)} style={styles.iconButton}>
          <Ionicons name="menu" size={24} color="#2C3E50" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>EduChat</Text>
        <TouchableOpacity onPress={() => createNewChat()} style={styles.iconButton}>
          <Ionicons name="add-circle-outline" size={24} color="#4A90E2" />
        </TouchableOpacity>
      </View>

      {/* Chat Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.chatArea}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={80} color="#BDC3C7" />
            <Text style={styles.emptyTitle}>Welcome to EduChat!</Text>
            <Text style={styles.emptySubtitle}>Ask me anything about CBSE Maths & Science</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
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
              placeholder="Ask a question..."
              placeholderTextColor="#95A5A6"
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!inputText.trim() || loading) && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={!inputText.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Sidebar Modal */}
      <Modal
        visible={sidebarOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSidebarOpen(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setSidebarOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.sidebar} onPress={(e) => e.stopPropagation()}>
            {/* Sidebar Header */}
            <View style={styles.sidebarHeader}>
              <View style={styles.userInfo}>
                <View style={styles.userAvatar}>
                  <Text style={styles.avatarText}>{user?.username[0].toUpperCase()}</Text>
                </View>
                <Text style={styles.username}>{user?.username}</Text>
              </View>
              <TouchableOpacity onPress={() => setSidebarOpen(false)}>
                <Ionicons name="close" size={28} color="#2C3E50" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sidebarContent}>
              {/* New Chat Button */}
              <TouchableOpacity style={styles.newChatButton} onPress={() => createNewChat()}>
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.newChatText}>New Chat</Text>
              </TouchableOpacity>

              {/* Projects Section */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Projects</Text>
                  <TouchableOpacity onPress={() => setShowNewProjectModal(true)}>
                    <Ionicons name="add-circle" size={24} color="#4A90E2" />
                  </TouchableOpacity>
                </View>

                {projects.map(project => (
                  <View key={project.id} style={styles.projectContainer}>
                    <TouchableOpacity
                      style={styles.projectHeader}
                      onPress={() => toggleProject(project.id)}
                    >
                      <Ionicons
                        name={expandedProjects.has(project.id) ? 'chevron-down' : 'chevron-forward'}
                        size={20}
                        color="#7F8C8D"
                      />
                      <Ionicons name="folder" size={20} color="#F39C12" style={styles.projectIcon} />
                      <Text style={styles.projectName}>{project.name}</Text>
                    </TouchableOpacity>

                    {expandedProjects.has(project.id) && (
                      <View style={styles.projectChats}>
                        <TouchableOpacity
                          style={styles.newProjectChatButton}
                          onPress={() => createNewChat(project.id)}
                        >
                          <Ionicons name="add" size={18} color="#4A90E2" />
                        </TouchableOpacity>
                        
                        {getChatsForProject(project.id).map(chat => (
                          <View key={chat.id} style={styles.chatItemRow}>
                            <TouchableOpacity
                              style={styles.chatItem}
                              onPress={() => loadChatMessages(chat.id)}
                            >
                              <View style={styles.chatContent}>
                                <Text style={styles.chatTitle} numberOfLines={1}>
                                  {chat.title}
                                </Text>
                                {chat.preview && (
                                  <Text style={styles.chatPreview} numberOfLines={1}>
                                    {chat.preview}
                                  </Text>
                                )}
                              </View>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => deleteChat(chat.id)} style={styles.deleteButton}>
                              <Ionicons name="trash-outline" size={16} color="#E74C3C" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>

              {/* Recent Chats */}
              {getRecentChats().length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Recent Chats</Text>
                  {getRecentChats().map(chat => (
                    <View key={chat.id} style={styles.chatItemRow}>
                      <TouchableOpacity
                        style={styles.chatItem}
                        onPress={() => loadChatMessages(chat.id)}
                      >
                        <Ionicons name="chatbubble-outline" size={16} color="#7F8C8D" />
                        <Text style={styles.chatTitle} numberOfLines={1}>
                          {chat.title}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteChat(chat.id)} style={styles.deleteButton}>
                        <Ionicons name="trash-outline" size={16} color="#E74C3C" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            {/* Logout Button */}
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color="#E74C3C" />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* New Project Modal */}
      <Modal visible={showNewProjectModal} animationType="fade" transparent={true}>
        <View style={styles.projectModalOverlay}>
          <View style={styles.projectModalContent}>
            <Text style={styles.projectModalTitle}>Create New Project</Text>
            <TextInput
              style={styles.projectModalInput}
              placeholder="Project Name (e.g., Geometry)"
              placeholderTextColor="#95A5A6"
              value={newProjectName}
              onChangeText={setNewProjectName}
            />
            <TextInput
              style={[styles.projectModalInput, styles.projectModalTextArea]}
              placeholder="Description (optional)"
              placeholderTextColor="#95A5A6"
              value={newProjectDesc}
              onChangeText={setNewProjectDesc}
              multiline
            />
            <View style={styles.projectModalButtons}>
              <TouchableOpacity
                style={[styles.projectModalButton, styles.cancelButton]}
                onPress={() => setShowNewProjectModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.projectModalButton, styles.createButton]}
                onPress={createProject}
              >
                <Text style={styles.createButtonText}>Create</Text>
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
    backgroundColor: '#F5F7FA',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E8ED',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  iconButton: {
    padding: 8,
  },
  topBarTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2C3E50',
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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 24,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#7F8C8D',
    marginTop: 12,
    textAlign: 'center',
  },
  messagesList: {
    padding: 16,
  },
  messageContainer: {
    marginBottom: 16,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 12,
    maxWidth: '85%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#E3F2FD',
  },
  assistantBubble: {
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
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  userAvatar: {
    backgroundColor: '#4A90E2',
  },
  assistantAvatar: {
    backgroundColor: '#27AE60',
  },
  avatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  roleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2C3E50',
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
  },
  copyText: {
    fontSize: 12,
    color: '#4A90E2',
    marginLeft: 4,
  },
  inputArea: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E1E8ED',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E1E8ED',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#2C3E50',
    maxHeight: 100,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start',
  },
  sidebar: {
    width: '85%',
    height: '100%',
    backgroundColor: '#fff',
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#F5F7FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E8ED',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
  },
  userClass: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 2,
  },
  sidebarContent: {
    flex: 1,
    padding: 16,
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90E2',
    padding: 14,
    borderRadius: 12,
    marginBottom: 24,
  },
  newChatText: {
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
    fontSize: 16,
    fontWeight: '700',
    color: '#2C3E50',
  },
  projectContainer: {
    marginBottom: 12,
  },
  projectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
  },
  projectIcon: {
    marginLeft: 8,
    marginRight: 8,
  },
  projectName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C3E50',
    flex: 1,
  },
  projectChats: {
    marginLeft: 16,
    marginTop: 8,
  },
  newProjectChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    marginBottom: 8,
  },
  newProjectChatText: {
    fontSize: 14,
    color: '#4A90E2',
    fontWeight: '600',
    marginLeft: 6,
  },
  chatItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  chatItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E1E8ED',
    marginRight: 8,
  },
  chatTitle: {
    fontSize: 14,
    color: '#2C3E50',
    marginLeft: 8,
    flex: 1,
  },
  deleteButton: {
    padding: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E1E8ED',
  },
  logoutText: {
    fontSize: 16,
    color: '#E74C3C',
    fontWeight: '600',
    marginLeft: 8,
  },
  projectModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  projectModalContent: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
  },
  projectModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 20,
  },
  projectModalInput: {
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#2C3E50',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E1E8ED',
  },
  projectModalTextArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  projectModalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  projectModalButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginLeft: 12,
  },
  cancelButton: {
    backgroundColor: '#E1E8ED',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#7F8C8D',
  },
  createButton: {
    backgroundColor: '#4A90E2',
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
