# Materio Secure Auth Handoff Integration Guide

This document explains how to integrate Materio's secure authentication handoff in your application.

---

## Overview

When users authenticate through Materio and are redirected to your site, they receive a **one-time handoff code** instead of a raw JWT token. This prevents token leakage through URLs, browser history, and referrer headers.

### Security Benefits
- ✅ JWT never appears in URLs
- ✅ Handoff codes expire in 60 seconds
- ✅ Codes can only be used once
- ✅ Codes are cryptographically random (32 characters)

---

## Authentication Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Your Site     │     │    Materio      │     │   Your Site     │
│  (needs auth)   │────▶│   /account      │────▶│  (with code)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                        │
                               │ User logs in           │
                               ▼                        │
                        Generate handoff code           │
                               │                        │
                               └───────────────────────▶│
                                                        │
                        ┌───────────────────────────────┘
                        │
                        ▼
                ┌─────────────────┐
                │  POST /api/v2/  │
                │ exchange-handoff│
                └─────────────────┘
                        │
                        ▼
                ┌─────────────────┐
                │  Receive JWT +  │
                │   User Data     │
                └─────────────────┘
```

---

## Step 1: Redirect Users to Materio Login

When a user needs to authenticate, redirect them to Materio's login page with a `callback` parameter:

```javascript
// Redirect to Materio login
const currentUrl = window.location.href;
window.location.href = `https://materioa.vercel.app/account?callback=${encodeURIComponent(currentUrl)}`;
```

### Parameters

| Parameter  | Description                                      |
|------------|--------------------------------------------------|
| `callback` | The URL to redirect back to after authentication |

---

## Step 2: Handle the Handoff Code

After successful login, Materio redirects the user back to your `callback` URL with a `handoff` parameter:

```
https://your-site.com/page?handoff=a1b2c3d4e5f6...
```

### Extract and Exchange the Code

```javascript
// auth-handler.js - Run this on page load

async function handleAuthHandoff() {
  const urlParams = new URLSearchParams(window.location.search);
  const handoffCode = urlParams.get('handoff');
  
  if (!handoffCode) {
    return null; // No handoff code present
  }
  
  try {
    // Exchange the handoff code for a JWT token
    const response = await fetch('https://materioa.vercel.app/api/v2/exchange-handoff', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code: handoffCode })
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('Handoff failed:', error.error);
      return null;
    }
    
    const data = await response.json();
    
    // Store the JWT token securely
    localStorage.setItem('materio_auth_token', data.token);
    
    // Optionally store user data
    if (data.user) {
      localStorage.setItem('materio_user', JSON.stringify(data.user));
    }
    
    // IMPORTANT: Clean the URL to remove the handoff code from browser history
    const cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState({}, document.title, cleanUrl);
    
    return data;
    
  } catch (error) {
    console.error('Handoff exchange error:', error);
    return null;
  }
}

// Call on page load
document.addEventListener('DOMContentLoaded', async () => {
  const authData = await handleAuthHandoff();
  
  if (authData) {
    console.log('Successfully authenticated:', authData.user);
    // Trigger any UI updates, reload data, etc.
  }
});
```

---

## Step 3: Exchange Handoff API Reference

### Endpoint

```
POST https://materioa.vercel.app/api/v2/exchange-handoff
```

### Request

```json
{
  "code": "a1b2c3d4e5f6789012345678901234567890abcd"
}
```

### Success Response (200 OK)

```json
{
  "message": "Handoff successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "b5840184-eb56-422a-b6ec-a5985da3d877",
    "username": "johndoe",
    "displayName": "John Doe",
    "email": "john@example.com",
    "hasAdminPrivileges": false,
    "isPlusUser": true,
    "profilePicture": "https://..."
  }
}
```

### Error Responses

| Status | Error                              | Description                     |
|--------|------------------------------------|---------------------------------|
| 400    | `Handoff code is required`         | Missing or invalid code format  |
| 401    | `Invalid or expired handoff code`  | Code doesn't exist or was used  |
| 401    | `Handoff code has expired`         | Code is older than 60 seconds   |
| 500    | `Internal server error`            | Server-side error               |

---

## Step 4: Verify User Access Levels

Once you have the JWT token, you can decode it to check user claims or make API calls.

### Option A: Decode JWT Client-Side

```javascript
function decodeToken(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

// Usage
const token = localStorage.getItem('materio_auth_token');
const payload = decodeToken(token);

console.log('User ID:', payload.id);
console.log('Email:', payload.email);
console.log('Username:', payload.username);
```

### Option B: Check User Data from Storage

```javascript
function getUserData() {
  const userStr = localStorage.getItem('materio_user');
  return userStr ? JSON.parse(userStr) : null;
}

// Usage
const user = getUserData();

if (user) {
  if (user.isPlusUser) {
    // Grant Plus access
    console.log('User has Plus subscription');
  }
  
  if (user.hasAdminPrivileges) {
    // Grant admin access
    console.log('User is an admin');
  }
}
```

### Option C: Verify with API (Most Secure)

```javascript
async function verifyAuth() {
  const token = localStorage.getItem('materio_auth_token');
  
  if (!token) {
    return null;
  }
  
  const response = await fetch('https://materioa.vercel.app/api/v2/auth', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    // Token is invalid or expired
    localStorage.removeItem('materio_auth_token');
    localStorage.removeItem('materio_user');
    return null;
  }
  
  return await response.json();
}
```

---

## Complete Integration Example

Here's a complete example for a SvelteKit/React/Vue app:

```javascript
// lib/auth.js

const AUTH_BASE_URL = 'https://materioa.vercel.app';
const TOKEN_KEY = 'materio_auth_token';
const USER_KEY = 'materio_user';

export const auth = {
  // Redirect to login
  login(callbackUrl = window.location.href) {
    window.location.href = `${AUTH_BASE_URL}/account?callback=${encodeURIComponent(callbackUrl)}`;
  },
  
  // Handle handoff code on page load
  async handleHandoff() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('handoff');
    
    if (!code) return null;
    
    try {
      const res = await fetch(`${AUTH_BASE_URL}/api/v2/exchange-handoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      
      if (!res.ok) return null;
      
      const data = await res.json();
      
      localStorage.setItem(TOKEN_KEY, data.token);
      if (data.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      }
      
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      
      return data;
    } catch (e) {
      console.error('Handoff failed:', e);
      return null;
    }
  },
  
  // Get current user
  getUser() {
    const str = localStorage.getItem(USER_KEY);
    return str ? JSON.parse(str) : null;
  },
  
  // Get token
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },
  
  // Check if authenticated
  isAuthenticated() {
    return !!this.getToken();
  },
  
  // Check Plus access
  isPlusUser() {
    const user = this.getUser();
    return user?.isPlusUser === true;
  },
  
  // Logout
  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
};
```

### Usage in Your App

```javascript
import { auth } from './lib/auth';

// On app initialization
await auth.handleHandoff();

// Check authentication
if (!auth.isAuthenticated()) {
  auth.login(); // Redirect to Materio login
}

// Check Plus access
if (auth.isPlusUser()) {
  // Show premium content
}

// Make authenticated API calls
const token = auth.getToken();
fetch('/api/some-endpoint', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

---

## Troubleshooting

### "Invalid or expired handoff code"
- The code has already been used (codes are one-time only)
- The code is older than 60 seconds
- The code was never generated (typo in URL)

### CORS Errors
- Ensure you're calling from an allowed origin
- Check that you're using `Content-Type: application/json`

### Token Not Working
- Verify the token hasn't expired (default: 7 days)
- Check that you're sending it in the `Authorization: Bearer <token>` header

---

## Security Notes

1. **Never log the handoff code or JWT** - These are sensitive credentials
2. **Always clean the URL** after exchanging the code to prevent accidental sharing
3. **Store tokens in localStorage only** - Don't put them in cookies if avoidable
4. **Implement token refresh** if needed for long sessions

---

## Support

For issues with the handoff integration, contact the Materio team or check the API documentation at `/api/v2/API_DOCUMENTATION.md`.
