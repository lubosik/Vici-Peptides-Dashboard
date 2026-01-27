# 🔐 Set Up Basic Authentication in Vercel

Your dashboard is showing "Unauthorized" because the Basic Auth environment variables aren't set in Vercel.

## Quick Fix (2 minutes)

### Step 1: Add Environment Variables in Vercel

1. Go to your Vercel dashboard: https://vercel.com
2. Select your project: **Vici-Peptides-Dashboard**
3. Go to **Settings** → **Environment Variables**
4. Add these two variables:

**Variable 1:**
- **Name:** `NEXT_PUBLIC_BASIC_AUTH_USER`
- **Value:** `Vici-admins`
- **Environment:** Production, Preview, Development (select all)

**Variable 2:**
- **Name:** `NEXT_PUBLIC_BASIC_AUTH_PASS`
- **Value:** `Vic!Pept!des#45`
- **Environment:** Production, Preview, Development (select all)

**Important:** The `NEXT_PUBLIC_` prefix is required for middleware to access these variables in Vercel's Edge Runtime.

5. Click **Save** for each variable

### Step 2: Redeploy

1. Go to **Deployments** tab
2. Click the **three dots** (⋯) on the latest deployment
3. Click **Redeploy**
4. Wait 2-3 minutes for deployment to complete

### Step 3: Test

1. Visit `dashboard.vicipeptides.com`
2. You should see a **browser password prompt**
3. Enter:
   - **Username:** `Vici-admins`
   - **Password:** `Vic!Pept!des#45`
4. Click **Sign in**

## ✅ That's It!

After setting the environment variables and redeploying, the password prompt will appear automatically.

## 🔒 Security Note

The credentials are:
- **Username:** `Vici-admins`
- **Password:** `Vic!Pept!des#45`

You can change these in Vercel's environment variables anytime.

**Note:** Variables prefixed with `NEXT_PUBLIC_` are exposed to the client bundle. This is required for middleware to work on Vercel's Edge Runtime. Basic Auth is a simple password gate - for production-grade security, consider implementing proper authentication (Supabase Auth, NextAuth, etc.).
