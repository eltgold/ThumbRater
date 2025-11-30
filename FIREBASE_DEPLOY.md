# How to Deploy RiceTool to Firebase Hosting

Since you are using Google AI Studio, you likely have the files. Here is how to put them online using Firebase.

## Prerequisites
1.  **Node.js**: Install from [nodejs.org](https://nodejs.org/) (LTS version).
2.  **Firebase Account**: Go to [console.firebase.google.com](https://console.firebase.google.com/) and create a new project (e.g., "ricetool-app").

## Steps

### 1. Setup Local Folder
Create a folder on your computer and copy all the files provided in the Code Tree (`index.html`, `App.tsx`, `package.json`, etc.) into it.

### 2. Install Tools
Open a terminal in that folder and run:
```bash
# Install dependencies
npm install

# Install Firebase CLI globally
npm install -g firebase-tools
```

### 3. Login to Firebase
```bash
firebase login
```
This will open your browser to log in with your Google account.

### 4. Initialize Project
```bash
firebase init hosting
```
- Select **"Use an existing project"** -> Pick the project you created in step 1.
- "What do you want to use as your public directory?" -> Type **`dist`** (Press Enter).
- "Configure as a single-page app?" -> Type **`y`** (Yes).
- "Set up automatic builds and deploys with GitHub?" -> **`n`** (No).
- "File dist/index.html already exists. Overwrite?" -> **`n`** (No, if asked).

### 5. Build and Deploy
Run this command to build your React app and push it to the internet:
```bash
npm run build && firebase deploy
```

## Success!
The terminal will give you a link like `https://ricetool-app.web.app`. Your site is now live.
