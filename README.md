# 🌊 OceanCast

A full-stack marine weather intelligence platform for fishermen, surfers, and coastal enthusiasts. Combines real-time weather, ocean swell, astronomical tide curves, and Gemini AI planning into a single unified dashboard.

---

## ✨ Features

- **Marine Dashboard** — Live weather, swell height, wind speed/direction, wave period
- **Harmonic Tide Predictor** — Interactive SVG tide curve with hourly scrubber slider
- **Gemini AI Assistant** — Natural language marine condition summaries and trip planning
- **Fisherman Advisory** — Traffic-light safety indicators (🟢🟡🔴) with plain-language advice
- **Guest Access Mode** — One-click entry with no registration required
- **One-Tap Spot Switcher** — Quick preset location tiles on the dashboard
- **Admin Console** — User management, broadcast announcements, thresholds, audit logs, backup/restore
- **User Profile** — Alert preferences, saved locations gauge, account metrics

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 21, Tailwind CSS v4 |
| Backend | Node.js, Express, TypeScript |
| Database | MongoDB (Mongoose) |
| AI | Google Gemini API |
| Auth | JWT (7-day expiry) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- MongoDB (local or Atlas)
- Google Gemini API key ([get one here](https://aistudio.google.com))

### 1. Clone the repository
```bash
git clone https://github.com/your-username/oceancast.git
cd oceancast
```

### 2. Setup the backend
```bash
cd backend
cp .env.example .env       # Fill in your MongoDB URI, JWT secret, Gemini key
npm install
npm run dev                # Starts backend on http://localhost:5000
```

### 3. Setup the frontend
```bash
cd ..                      # Back to project root
npm install
npm start                  # Starts frontend on http://localhost:4200
```

### 4. Create your first admin account
Register via the UI, then run:
```bash
cd backend
node scripts/make_admin.js your@email.com
```

---

## 📁 Project Structure

```
oceancast/
├── backend/               # Express + TypeScript API server
│   ├── src/
│   │   ├── models/        # Mongoose schemas (User, Location, Setting, AuditLog)
│   │   ├── routes/        # REST endpoints (auth, admin, locations, weather…)
│   │   ├── middleware/    # JWT auth, admin guard
│   │   └── services/      # Gemini AI, audit logging
│   └── .env.example       # Environment variable template
│
└── src/                   # Angular 21 frontend
    └── app/
        ├── pages/         # Dashboard, Tides, Marine, Weather, AI Chat, Admin, Profile…
        ├── services/      # AuthService, SettingsService, LocationService, ToastService
        ├── components/    # Navbar, Spinner, Toast
        ├── guards/        # Auth route guard
        └── interceptors/  # JWT HTTP interceptor
```

---

## 🔐 Environment Variables

See [`backend/.env.example`](./backend/.env.example) for all required variables.

---

## 📄 License

MIT
