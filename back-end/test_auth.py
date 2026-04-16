"""
Test script for the authentication endpoint
Run this with: python test_auth.py
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_login():
    """Test the login endpoint"""
    print("=" * 60)
    print("TEST 1: Login")
    print("=" * 60)
    
    # First, create a user (signup)
    signup_data = {
        "email": "test@example.com",
        "password": "testpassword123",
        "phone": "+212612345678",
        "role": "CLIENT"
    }
    
    response = requests.post(f"{BASE_URL}/auth/register", json=signup_data)
    print(f"Signup response: {response.status_code}")
    if response.status_code == 200:
        print(f"User created: {response.json()}")
    
    # Now login
    login_data = {
        "login_id": "test@example.com",
        "password": "testpassword123"
    }
    
    response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
    print(f"\nLogin response: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        token = data.get("access_token")
        print(f"✅ Token received: {token[:50]}...")
        return token
    else:
        print(f"❌ Login failed: {response.json()}")
        return None


def test_get_user_profile(token):
    """Test the GET /auth/me endpoint"""
    print("\n" + "=" * 60)
    print("TEST 2: Get User Profile (GET /auth/me)")
    print("=" * 60)
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    response = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    print(f"Response status: {response.status_code}")
    
    if response.status_code == 200:
        user_data = response.json()
        print("✅ User profile retrieved successfully:")
        print(json.dumps(user_data, indent=2))
    else:
        print(f"❌ Failed to get user profile: {response.json()}")


def test_invalid_token():
    """Test with invalid token"""
    print("\n" + "=" * 60)
    print("TEST 3: Invalid Token")
    print("=" * 60)
    
    headers = {
        "Authorization": "Bearer invalid.token.here",
        "Content-Type": "application/json"
    }
    
    response = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    print(f"Response status: {response.status_code}")
    
    if response.status_code == 401:
        print(f"✅ Correctly rejected invalid token: {response.json()}")
    else:
        print(f"❌ Should return 401, got {response.status_code}")


def test_no_token():
    """Test without token"""
    print("\n" + "=" * 60)
    print("TEST 4: Missing Token")
    print("=" * 60)
    
    headers = {
        "Content-Type": "application/json"
    }
    
    response = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    print(f"Response status: {response.status_code}")
    
    if response.status_code == 403:
        print(f"✅ Correctly rejected request without token")
    else:
        print(f"Status: {response.status_code}")


if __name__ == "__main__":
    print("\n" + "🔐 AUTHENTICATION SYSTEM TEST" + "\n")
    
    # Run tests
    token = test_login()
    
    if token:
        test_get_user_profile(token)
        test_invalid_token()
        test_no_token()
    
    print("\n" + "=" * 60)
    print("✅ All tests completed!")
    print("=" * 60)
