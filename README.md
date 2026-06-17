# Freeport Recovery — Bed Map

A shared bed management web app for Freeport Recovery staff.

---

## Deploying to Railway (free, ~10 minutes)

### 1. Install Git and push to GitHub

If you don't have Git: https://git-scm.com/download/win

Open a terminal in the `freeport-bedmap` folder and run:

```
git init
git add .
git commit -m "Initial commit"
```

Then create a free account at https://github.com and create a **new repository** called `freeport-bedmap`. Follow the instructions GitHub shows you to push your code.

---

### 2. Create a Railway account

Go to https://railway.app and sign up with your GitHub account.

---

### 3. Deploy the app

1. In Railway, click **New Project → Deploy from GitHub repo**
2. Select your `freeport-bedmap` repository
3. Railway will detect it as a Node.js app and deploy automatically

---

### 4. Add a database

1. In your Railway project, click **+ New** → **Database** → **PostgreSQL**
2. Railway automatically sets the `DATABASE_URL` environment variable — nothing else needed

---

### 5. Set your password

1. Click your app service in Railway
2. Go to **Variables** tab
3. Add a variable: `APP_PASSWORD` = your chosen password (e.g. `Freeport2024!`)
4. Railway will redeploy automatically

---

### 6. Get your URL

1. In Railway, click your app service → **Settings** → **Domains**
2. Click **Generate Domain** — you'll get a URL like `freeport-bedmap.up.railway.app`
3. Share that URL and the password with all staff

---

## Running locally (optional)

```
npm install
cp .env.example .env
# Edit .env and set APP_PASSWORD
# You also need a local PostgreSQL database and its connection string in DATABASE_URL
node server.js
```

Then open http://localhost:3000
