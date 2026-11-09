# CodeMate — Sem 5 Project 🎓

A **Flask-based programming tutorial platform** with Firebase authentication, admin panel, and Google Gemini AI integration. Built as a Semester 5 academic project.

---

## ✨ Features

| Feature | Implementation |
|---|---|
| **User Authentication** | Firebase Auth (email/password) via `auth` blueprint |
| **Admin Panel** | Custom admin dashboard (`admin` blueprint) with tutorial management |
| **Tutorial Structure** | Hierarchical: Language → Lessons → Topics (stored in Firestore) |
| **AI Assistant** | Google Gemini integration for code explanations/help |
| **Markdown Rendering** | Tutorial content in Markdown with code highlighting |
| **Responsive UI** | Bootstrap-based templates |

---

## 🏗️ Architecture

```
codemate-sem5/
├── app.py                 # Main Flask app, blueprints, Firebase/Gemini init
├── auth/                  # Authentication blueprint
│   ├── routes.py          # Login, register, logout, password reset
│   └── templates/         # Auth HTML templates
├── admin/                 # Admin blueprint
│   ├── routes.py          # Dashboard, CRUD for tutorials/languages
│   └── templates/         # Admin HTML templates
├── templates/             # Base templates (layout, index, 404)
├── static/                # CSS, JS, images
├── serviceAccountKey.json # Firebase Admin SDK key (gitignored)
├── requirements.txt       # Python dependencies
└── .env                   # Secrets (gitignored)
```

---

## 🚀 Quick Start

```bash
git clone https://github.com/MasterHacx/codemate-sem5.git
cd codemate-sem5
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your Firebase + Gemini credentials
# Place serviceAccountKey.json in project root (from Firebase Console)
python app.py
```

Visit `http://localhost:5000`

---

## 🔧 Configuration (`.env`)

| Variable | Source | Required |
|---|---|---|
| `FIREBASE_API_KEY` | Firebase Console > Project Settings > Web App | ✅ |
| `FIREBASE_AUTH_DOMAIN` | Same as above | ✅ |
| `FIREBASE_PROJECT_ID` | Firebase Console > Project Settings | ✅ |
| `FIREBASE_STORAGE_BUCKET` | Same | ✅ |
| `FIREBASE_MESSAGING_SENDER_ID` | Same | ✅ |
| `FIREBASE_APP_ID` | Same | ✅ |
| `SECRET_KEY` | Generate: `python -c "import secrets; print(secrets.token_hex(32))"` | ✅ |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/app/apikey) | ✅ |
| `ADMIN_USERNAME` | Your choice | ✅ |
| `ADMIN_PASSWORD` | Your choice | ✅ |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to serviceAccountKey.json (optional) | Optional |

### Firebase Admin SDK Setup
1. Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key" → saves `serviceAccountKey.json`
3. Place in project root (or set `GOOGLE_APPLICATION_CREDENTIALS` in `.env`)

---

## 📦 Dependencies

```txt
Flask
python-dotenv
firebase-admin
requests
Markdown
google-generativeai
pymdown-extensions
```

---

## 🛡️ Security

- **No secrets in repo** — all via `.env` (gitignored)
- `serviceAccountKey.json` gitignored — contains Firebase private key
- Admin panel protected by `ADMIN_USERNAME`/`ADMIN_PASSWORD`
- Firebase Auth handles user sessions securely

---

## 📄 License

Academic project — Semester 5, Viva College. All rights reserved.

---

## 👤 Author

**MasterHacx** — [GitHub](https://github.com/MasterHacx)

> *CodeMate — Learn to code, with AI by your side.*