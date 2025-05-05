# 🔥 Firebase App – Local Development Setup

This project is built using Firebase and supports full local development using the **Firebase Emulator Suite**. Follow this guide to set it up on your local machine.

---

## 📦 Prerequisites

Make sure you have the following installed:

- **[Node.js](https://nodejs.org/)** (v20 is used for the application)
- **npm** (comes with Node.js)
- **Firebase CLI**: Install globally if not already installed

```bash
npm install -g firebase-tools
```
- Check Version
```bash
firebase --version
```

## 🚀 Getting Started
- Clone the Repository
  ```bash
  git clone https://github.com/AlphaCoders-IBMH/personal-buddy-service.git
  cd personal-buddy-service
  ```

## Install Project Dependencies
- Install the dependencies for functions
```bash
# Backend (Cloud Functions)
cd functions
npm install
cd ..
```

## 🔐 Firebase Login
- Login to your Firebase account to access project emulators:
  ```bash
  firebase login
  ```

## ▶️ Run Locally
- Start Firebase Emulator Suite
  ```bash
  firebase emulators:start
  ```

Note : When API request is made for JIRA request and if the response is with status 400 , Please change the JIRA API KEY to get the valid responses.
