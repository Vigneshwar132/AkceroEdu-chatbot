#!/usr/bin/env python3
"""Quick verification test for specific functionality"""

import requests
import json

BASE_URL = "https://student-quest-8.preview.emergentagent.com/api"

# Test chat with educational question and verify response contains mock disclaimer
response = requests.post(f"{BASE_URL}/auth/login", json={
    "username": "teststudent1", 
    "password": "test123456"
})

if response.status_code == 200:
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    # Test educational question
    chat_response = requests.post(f"{BASE_URL}/chat", json={
        "message": "What is Pythagoras theorem?"
    }, headers=headers)
    
    if chat_response.status_code == 200:
        response_text = chat_response.json()["response"]
        print("Educational question response:")
        print(response_text)
        print(f"Contains 'MOCKED' disclaimer: {'MOCKED' in response_text}")
        print()
    
    # Test non-educational question
    non_edu_response = requests.post(f"{BASE_URL}/chat", json={
        "message": "Who is the president of USA?"
    }, headers=headers)
    
    if non_edu_response.status_code == 200:
        response_text = non_edu_response.json()["response"]
        print("Non-educational question response:")
        print(response_text)
        print(f"Correctly filtered: {'can only help with' in response_text}")
        print()