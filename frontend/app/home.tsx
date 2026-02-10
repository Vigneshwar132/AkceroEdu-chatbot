import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function Home() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.username}!</Text>
          <Text style={styles.classInfo}>Class {user?.student_class}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#E74C3C" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.welcomeCard}>
          <Ionicons name="school-outline" size={48} color="#4A90E2" />
          <Text style={styles.welcomeTitle}>Welcome to EduChat</Text>
          <Text style={styles.welcomeSubtitle}>
            Your personal tutor for CBSE NCERT Maths & Science
          </Text>
        </View>

        <View style={styles.menuGrid}>
          <TouchableOpacity
            style={[styles.menuCard, { backgroundColor: '#4A90E2' }]}
            onPress={() => router.push('/chat')}
          >
            <Ionicons name="chatbubbles" size={40} color="#fff" />
            <Text style={styles.menuCardTitle}>New Chat</Text>
            <Text style={styles.menuCardSubtitle}>Ask a question</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuCard, { backgroundColor: '#27AE60' }]}
            onPress={() => router.push('/history')}
          >
            <Ionicons name="time" size={40} color="#fff" />
            <Text style={styles.menuCardTitle}>History</Text>
            <Text style={styles.menuCardSubtitle}>View past chats</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>What I can help with:</Text>
          <View style={styles.infoItem}>
            <Ionicons name="checkmark-circle" size={20} color="#27AE60" />
            <Text style={styles.infoText}>CBSE NCERT Mathematics (Class 6-10)</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="checkmark-circle" size={20} color="#27AE60" />
            <Text style={styles.infoText}>CBSE NCERT Science (Class 6-10)</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="checkmark-circle" size={20} color="#27AE60" />
            <Text style={styles.infoText}>Step-by-step explanations</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="checkmark-circle" size={20} color="#27AE60" />
            <Text style={styles.infoText}>Concept clarifications</Text>
          </View>
        </View>
      </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E8ED',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  classInfo: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 4,
  },
  logoutButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  welcomeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 16,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#7F8C8D',
    textAlign: 'center',
    marginTop: 8,
  },
  menuGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  menuCard: {
    flex: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    minHeight: 140,
    justifyContent: 'center',
  },
  menuCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
  },
  menuCardSubtitle: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
    marginTop: 4,
  },
  infoSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#2C3E50',
    marginLeft: 12,
  },
});
