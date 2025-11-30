# How to Build a Real Backend for RiceTool

Currently, RiceTool runs entirely in the browser (Client-Side). Data is saved to `localStorage`, and the API key is stored in the browser. To make this a real SaaS product, you need a Backend.

## Recommended Stack (The "Indie Hacker" Stack)

1.  **Database & Auth**: **Supabase** (PostgreSQL) or **Firebase**.
    *   *Why?* They handle User Login (Google/Email), Database, and Storage (for thumbnails) without you writing complex server code.
2.  **Framework**: **Next.js** (React Framework).
    *   *Why?* It allows you to write API routes (`/api/analyze`) that hide your Gemini API Key from the frontend.
3.  **Payments**: **Stripe**.

## Architecture Steps

### 1. Authentication (RiceID)
Instead of the current "Simulated Login":
1.  Create a Supabase project.
2.  Enable "Google Auth" in Supabase Authentication settings.
3.  In React, use the Supabase Client to log users in:
    ```javascript
    const { user, error } = await supabase.auth.signInWithOAuth({ provider: 'google' })
    ```
4.  This gives you a real User ID (UUID).

### 2. Hiding the Gemini API Key
**CRITICAL**: Currently, the user puts their key in the frontend, or you leak yours.
1.  Move your `GEMINI_API_KEY` to a `.env.local` file on the server.
2.  Create an API Route (e.g., `pages/api/analyze.ts` in Next.js).
3.  The Frontend sends the image to *your* API:
    ```javascript
    await fetch('/api/analyze', { method: 'POST', body: imageBase64 })
    ```
4.  Your Backend (Next.js) calls Google Gemini using the hidden key and returns the JSON to the frontend.

### 3. Saving to "The Vault" (Database)
Instead of `localStorage`:
1.  Create a table in Supabase called `analyses`.
    *   Columns: `id`, `user_id`, `video_title`, `score`, `json_result`, `created_at`.
2.  When a user clicks "SAVE":
    ```javascript
    await supabase.from('analyses').insert({ 
      user_id: user.id, 
      video_title: title, 
      json_result: result 
    })
    ```
3.  To load the Vault:
    ```javascript
    const { data } = await supabase.from('analyses').select('*').eq('user_id', user.id)
    ```

### 4. Rate Limiting (Prevent Abuse)
If you pay for the API, you don't want bots spamming it.
1.  In your API Route, check how many times `user.id` has requested today.
2.  If > 50, return error "Daily Limit Reached".

## Summary
To "do the backend":
1.  Switch to **Next.js**.
2.  Use **Supabase** for Auth & Database.
3.  Move the Gemini Logic from `geminiService.ts` to a Server Action or API Route.
