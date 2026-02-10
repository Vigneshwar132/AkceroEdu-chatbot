#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Educational Chatbot
Tests all authentication and chat functionality
"""

import requests
import json
import time
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://student-quest-8.preview.emergentagent.com/api"
TEST_USER = {
    "username": "teststudent1",
    "password": "test123456", 
    "student_class": "8",
    "email": "test@example.com"
}

class BackendTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.headers = {"Content-Type": "application/json"}
        self.auth_headers = {"Content-Type": "application/json"}
        self.session_id = None
        self.test_results = []

    def log_result(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = f"{status} - {test_name}"
        if details:
            result += f": {details}"
        print(result)
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })

    def make_request(self, method: str, endpoint: str, data: Dict = None, headers: Dict = None) -> tuple:
        """Make HTTP request and return response and success status"""
        url = f"{self.base_url}{endpoint}"
        request_headers = headers or self.headers
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=request_headers, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, headers=request_headers, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=request_headers, timeout=30)
            else:
                return None, False, f"Unsupported method: {method}"
            
            return response, True, ""
        except requests.exceptions.RequestException as e:
            return None, False, f"Request failed: {str(e)}"

    def test_health_check(self):
        """Test basic connectivity"""
        print(f"\n🔍 Testing connectivity to {self.base_url}")
        response, success, error = self.make_request("GET", "/health")
        
        if not success:
            self.log_result("Health Check", False, error)
            return False
        
        if response.status_code == 200:
            self.log_result("Health Check", True, "Backend is responsive")
            return True
        else:
            self.log_result("Health Check", False, f"Status code: {response.status_code}")
            return False

    def test_user_registration(self):
        """Test user registration"""
        print(f"\n👤 Testing User Registration")
        
        # First try to register the user
        response, success, error = self.make_request("POST", "/auth/register", TEST_USER)
        
        if not success:
            self.log_result("User Registration - Network", False, error)
            return False
        
        if response.status_code == 200:
            data = response.json()
            if "access_token" in data and "user" in data:
                self.token = data["access_token"]
                self.auth_headers["Authorization"] = f"Bearer {self.token}"
                self.log_result("User Registration", True, "User registered successfully with JWT token")
                
                # Test duplicate registration
                dup_response, dup_success, _ = self.make_request("POST", "/auth/register", TEST_USER)
                if dup_success and dup_response.status_code == 400:
                    self.log_result("Duplicate Registration Check", True, "Correctly rejected duplicate username")
                else:
                    self.log_result("Duplicate Registration Check", False, "Should reject duplicate username")
                
                return True
            else:
                self.log_result("User Registration", False, "Missing token or user data in response")
                return False
        elif response.status_code == 400:
            # User might already exist, try login instead
            return self.test_user_login_fallback()
        else:
            self.log_result("User Registration", False, f"Status code: {response.status_code}, Body: {response.text}")
            return False

    def test_user_login_fallback(self):
        """Fallback login if registration fails due to existing user"""
        print(f"\n🔐 Testing User Login (Fallback)")
        login_data = {
            "username": TEST_USER["username"],
            "password": TEST_USER["password"]
        }
        
        response, success, error = self.make_request("POST", "/auth/login", login_data)
        
        if not success:
            self.log_result("User Login (Fallback)", False, error)
            return False
        
        if response.status_code == 200:
            data = response.json()
            if "access_token" in data:
                self.token = data["access_token"]
                self.auth_headers["Authorization"] = f"Bearer {self.token}"
                self.log_result("User Login (Fallback)", True, "Login successful")
                return True
        
        self.log_result("User Login (Fallback)", False, f"Status code: {response.status_code}")
        return False

    def test_user_login(self):
        """Test user login"""
        print(f"\n🔐 Testing User Login")
        
        login_data = {
            "username": TEST_USER["username"],
            "password": TEST_USER["password"]
        }
        
        response, success, error = self.make_request("POST", "/auth/login", login_data)
        
        if not success:
            self.log_result("User Login - Network", False, error)
            return False
        
        if response.status_code == 200:
            data = response.json()
            if "access_token" in data and "user" in data:
                self.token = data["access_token"]
                self.auth_headers["Authorization"] = f"Bearer {self.token}"
                self.log_result("User Login", True, "Login successful with JWT token")
                
                # Test wrong password
                wrong_login = {
                    "username": TEST_USER["username"], 
                    "password": "wrongpassword"
                }
                wrong_response, wrong_success, _ = self.make_request("POST", "/auth/login", wrong_login)
                if wrong_success and wrong_response.status_code == 401:
                    self.log_result("Wrong Password Check", True, "Correctly rejected wrong password")
                else:
                    self.log_result("Wrong Password Check", False, "Should reject wrong password")
                
                return True
            else:
                self.log_result("User Login", False, "Missing token or user data in response")
                return False
        else:
            self.log_result("User Login", False, f"Status code: {response.status_code}, Body: {response.text}")
            return False

    def test_get_current_user(self):
        """Test getting current user info"""
        print(f"\n👥 Testing Get Current User")
        
        if not self.token:
            self.log_result("Get Current User", False, "No authentication token available")
            return False
        
        response, success, error = self.make_request("GET", "/auth/me", headers=self.auth_headers)
        
        if not success:
            self.log_result("Get Current User - Network", False, error)
            return False
        
        if response.status_code == 200:
            data = response.json()
            if "username" in data and "student_class" in data:
                self.log_result("Get Current User", True, f"Retrieved user: {data['username']}")
                return True
            else:
                self.log_result("Get Current User", False, "Missing user data in response")
                return False
        else:
            self.log_result("Get Current User", False, f"Status code: {response.status_code}, Body: {response.text}")
            return False

    def test_chat_educational_question(self):
        """Test chat with educational question"""
        print(f"\n💬 Testing Educational Chat")
        
        if not self.token:
            self.log_result("Educational Chat", False, "No authentication token available")
            return False
        
        chat_data = {
            "message": "What is Pythagoras theorem?"
        }
        
        response, success, error = self.make_request("POST", "/chat", chat_data, headers=self.auth_headers)
        
        if not success:
            self.log_result("Educational Chat - Network", False, error)
            return False
        
        if response.status_code == 200:
            data = response.json()
            if "response" in data and "session_id" in data and "subject" in data:
                self.session_id = data["session_id"]
                subject = data.get("subject", "")
                response_text = data["response"]
                
                # Check if it auto-categorized as Maths
                if "maths" in subject.lower() or "math" in subject.lower():
                    self.log_result("Educational Chat - Categorization", True, f"Correctly categorized as {subject}")
                else:
                    self.log_result("Educational Chat - Categorization", False, f"Expected Maths, got {subject}")
                
                # Check if response is educational (contains theorem information)
                if len(response_text) > 50 and ("pythagoras" in response_text.lower() or "theorem" in response_text.lower()):
                    self.log_result("Educational Chat - Response Quality", True, "Generated educational response")
                else:
                    self.log_result("Educational Chat - Response Quality", False, "Response seems too short or not educational")
                
                self.log_result("Educational Chat", True, f"Session ID: {self.session_id[:8]}...")
                return True
            else:
                self.log_result("Educational Chat", False, "Missing required fields in response")
                return False
        else:
            self.log_result("Educational Chat", False, f"Status code: {response.status_code}, Body: {response.text}")
            return False

    def test_continue_chat_session(self):
        """Test continuing chat in same session"""
        print(f"\n🔄 Testing Continue Chat Session")
        
        if not self.token or not self.session_id:
            self.log_result("Continue Chat", False, "No token or session ID available")
            return False
        
        chat_data = {
            "message": "Can you explain the formula for Pythagoras theorem?",
            "session_id": self.session_id
        }
        
        response, success, error = self.make_request("POST", "/chat", chat_data, headers=self.auth_headers)
        
        if not success:
            self.log_result("Continue Chat - Network", False, error)
            return False
        
        if response.status_code == 200:
            data = response.json()
            if data.get("session_id") == self.session_id:
                self.log_result("Continue Chat", True, "Successfully continued in same session")
                return True
            else:
                self.log_result("Continue Chat", False, "Session ID changed unexpectedly")
                return False
        else:
            self.log_result("Continue Chat", False, f"Status code: {response.status_code}, Body: {response.text}")
            return False

    def test_non_educational_question(self):
        """Test chat with non-educational question"""
        print(f"\n🚫 Testing Non-Educational Question Filter")
        
        if not self.token:
            self.log_result("Non-Educational Filter", False, "No authentication token available")
            return False
        
        chat_data = {
            "message": "Who is the president of USA?"
        }
        
        response, success, error = self.make_request("POST", "/chat", chat_data, headers=self.auth_headers)
        
        if not success:
            self.log_result("Non-Educational Filter - Network", False, error)
            return False
        
        if response.status_code == 200:
            data = response.json()
            response_text = data.get("response", "")
            
            # Check if it correctly rejected the question
            rejection_keywords = ["only help with", "cbse", "ncert", "mathematics", "science", "maths"]
            is_rejected = any(keyword in response_text.lower() for keyword in rejection_keywords)
            
            if is_rejected:
                self.log_result("Non-Educational Filter", True, "Correctly rejected non-educational question")
                return True
            else:
                self.log_result("Non-Educational Filter", False, f"Should reject non-educational question. Got: {response_text[:100]}...")
                return False
        else:
            self.log_result("Non-Educational Filter", False, f"Status code: {response.status_code}")
            return False

    def test_chat_history(self):
        """Test getting chat history"""
        print(f"\n📚 Testing Chat History")
        
        if not self.token:
            self.log_result("Chat History", False, "No authentication token available")
            return False
        
        response, success, error = self.make_request("GET", "/chat/history", headers=self.auth_headers)
        
        if not success:
            self.log_result("Chat History - Network", False, error)
            return False
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                if len(data) > 0:
                    session = data[0]
                    if "subject" in session and "topic" in session:
                        self.log_result("Chat History", True, f"Retrieved {len(data)} sessions with subject/topic")
                        return True
                    else:
                        self.log_result("Chat History", False, "Sessions missing subject/topic data")
                        return False
                else:
                    self.log_result("Chat History", True, "No sessions found (empty history)")
                    return True
            else:
                self.log_result("Chat History", False, "Response is not a list")
                return False
        else:
            self.log_result("Chat History", False, f"Status code: {response.status_code}, Body: {response.text}")
            return False

    def test_get_specific_session(self):
        """Test getting specific session"""
        print(f"\n📖 Testing Get Specific Session")
        
        if not self.token or not self.session_id:
            self.log_result("Get Specific Session", False, "No token or session ID available")
            return False
        
        response, success, error = self.make_request("GET", f"/chat/session/{self.session_id}", headers=self.auth_headers)
        
        if not success:
            self.log_result("Get Specific Session - Network", False, error)
            return False
        
        if response.status_code == 200:
            data = response.json()
            if "messages" in data and "subject" in data:
                messages = data["messages"]
                if len(messages) >= 2:  # Should have user and assistant messages
                    self.log_result("Get Specific Session", True, f"Retrieved session with {len(messages)} messages")
                    return True
                else:
                    self.log_result("Get Specific Session", False, "Session should have at least 2 messages")
                    return False
            else:
                self.log_result("Get Specific Session", False, "Missing messages or subject data")
                return False
        else:
            self.log_result("Get Specific Session", False, f"Status code: {response.status_code}")
            return False

    def test_delete_session(self):
        """Test deleting a session"""
        print(f"\n🗑️ Testing Delete Session")
        
        if not self.token or not self.session_id:
            self.log_result("Delete Session", False, "No token or session ID available")
            return False
        
        response, success, error = self.make_request("DELETE", f"/chat/session/{self.session_id}", headers=self.auth_headers)
        
        if not success:
            self.log_result("Delete Session - Network", False, error)
            return False
        
        if response.status_code == 200:
            data = response.json()
            if "message" in data and "success" in data.get("message", "").lower():
                self.log_result("Delete Session", True, "Session deleted successfully")
                return True
            else:
                self.log_result("Delete Session", True, "Session deletion completed")
                return True
        else:
            self.log_result("Delete Session", False, f"Status code: {response.status_code}")
            return False

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Educational Chatbot Backend API Tests")
        print("=" * 60)
        
        # Test sequence
        tests = [
            self.test_health_check,
            self.test_user_registration,
            self.test_user_login,
            self.test_get_current_user,
            self.test_chat_educational_question,
            self.test_continue_chat_session,
            self.test_non_educational_question,
            self.test_chat_history,
            self.test_get_specific_session,
            self.test_delete_session
        ]
        
        passed = 0
        total = 0
        
        for test_func in tests:
            try:
                if test_func():
                    passed += 1
                total += 1
                time.sleep(1)  # Small delay between tests
            except Exception as e:
                print(f"❌ Test {test_func.__name__} crashed: {str(e)}")
                total += 1
        
        # Summary
        print("\n" + "=" * 60)
        print(f"🏁 Test Summary: {passed}/{total} tests passed")
        print("=" * 60)
        
        # Detailed results
        print("\n📊 Detailed Results:")
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}")
            if result["details"] and not result["success"]:
                print(f"   └─ {result['details']}")
        
        return passed, total

if __name__ == "__main__":
    tester = BackendTester()
    passed, total = tester.run_all_tests()
    
    # Exit with appropriate code
    exit(0 if passed == total else 1)