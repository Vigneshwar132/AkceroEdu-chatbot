# EduChat - Educational Chatbot for CBSE Students

An AI-powered educational chatbot designed for CBSE NCERT students (Class 6-10) specializing in Mathematics and Science.

## Features

- 🤖 AI-powered tutoring using Google Gemini 2.5 Flash
- 📁 Project-based chat organization (like ChatGPT)
- 💬 Auto-generated chat titles from conversations
- 📱 Mobile-first React Native app built with Expo
- 🔐 JWT-based authentication
- 📊 Chat history with preview and organization
- ✨ "Thinking..." indicator during AI responses
- 📚 Strict educational content filtering (CBSE NCERT only)

## Tech Stack

**Frontend:**
- React Native with Expo Router
- TypeScript
- Axios for API calls
- AsyncStorage for token persistence

**Backend:**
- FastAPI (Python)
- MongoDB with Motor (async driver)
- Google Generative AI (Gemini)
- JWT authentication with bcrypt

## Setup Instructions

### Prerequisites
- Node.js 18+
- Python 3.11+
- MongoDB running locally
- Google AI Studio API key

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create `.env` file from example:
```bash
cp .env.example .env
```

3. Edit `.env` and add your credentials:
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
GOOGLE_API_KEY="your-google-api-key-here"
JWT_SECRET_KEY="your-jwt-secret-key-here"
```

4. Install dependencies:
```bash
pip install -r requirements.txt
```

5. Run the server:
```bash
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
yarn install
```

3. Start the Expo dev server:
```bash
yarn start
```

4. Scan QR code with Expo Go app or press `w` for web

## Environment Variables

### Backend (.env)
- `MONGO_URL` - MongoDB connection string
- `DB_NAME` - Database name
- `GOOGLE_API_KEY` - Google AI Studio API key
- `JWT_SECRET_KEY` - Secret key for JWT tokens

### Frontend (.env)
- Auto-configured by Expo for preview URLs

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Projects
- `GET /api/projects` - Get all projects
- `POST /api/projects` - Create new project
- `PUT /api/projects/{id}` - Update project
- `DELETE /api/projects/{id}` - Delete project

### Chats
- `POST /api/chat` - Send message and get AI response
- `GET /api/chats` - Get all chats (with optional project filter)
- `GET /api/chats/{id}` - Get specific chat with messages
- `DELETE /api/chats/{id}` - Delete chat

## Project Structure

```
app/
├── backend/
│   ├── server.py          # FastAPI application
│   ├── requirements.txt   # Python dependencies
│   └── .env              # Environment variables (not in git)
├── frontend/
│   ├── app/              # Expo Router screens
│   │   ├── index.tsx     # Entry point
│   │   ├── login.tsx     # Login screen
│   │   ├── register.tsx  # Registration screen
│   │   ├── main.tsx      # Main chat screen
│   │   └── project/[id].tsx  # Project detail screen
│   ├── contexts/         # React contexts
│   │   └── AuthContext.tsx
│   ├── package.json
│   └── .env             # Environment variables (not in git)
└── README.md
```

## How to Get Google API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and add it to your `.env` file

## Educational Content Filtering

The AI is configured to **ONLY** answer questions related to:
- CBSE NCERT Mathematics (Class 6-10)
- CBSE NCERT Science (Class 6-10)

All other questions will be politely redirected to educational topics.

## Features in Detail

### Projects
- Organize chats by topics (e.g., "Geometry", "Algebra")
- Click project to see all related chats
- Create multiple chats within a project

### Auto-Generated Titles
- AI extracts keywords from questions
- Example: "What is photosynthesis?" → "Photosynthesis"

### Chat History
- Each chat shows title, preview, and timestamp
- Organized by projects and recent chats
- Easy navigation and deletion

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.
