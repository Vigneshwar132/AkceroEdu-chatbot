from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import bcrypt
import jwt
from openai import OpenAI
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# OpenAI client
openai_client = OpenAI(api_key=os.environ['OPENAI_API_KEY'])

# JWT configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-this-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 7  # 7 days

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# ==================== Models ====================

class UserRegister(BaseModel):
    username: str
    password: str
    student_class: str  # "6", "7", "8", "9", "10"
    email: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict

class Message(BaseModel):
    role: str
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    session_id: str
    subject: str
    topic: str
    title: str

class ChatSession(BaseModel):
    id: str
    user_id: str
    subject: str
    topic: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int

# ==================== Helper Functions ====================

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(data: dict) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_token(token: str) -> dict:
    """Decode JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user from JWT token"""
    token = credentials.credentials
    payload = decode_token(token)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

def categorize_question(question: str) -> dict:
    """Use GPT to categorize the question into subject and topic"""
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": """You are a classifier for CBSE NCERT questions (Class 6-10).
                    Analyze the question and return ONLY a JSON object with this exact format:
                    {"subject": "Maths" or "Science", "topic": "specific topic name", "is_educational": true/false}
                    
                    For Maths topics: Algebra, Geometry, Trigonometry, Arithmetic, Mensuration, Statistics, Probability, etc.
                    For Science topics: Physics, Chemistry, Biology, Light, Electricity, Heat, Motion, etc.
                    
                    Set is_educational to false if the question is not related to CBSE NCERT Maths or Science (Class 6-10).
                    Return ONLY the JSON, no other text."""
                },
                {"role": "user", "content": question}
            ],
            temperature=0.3,
            max_tokens=100
        )
        
        result = response.choices[0].message.content.strip()
        # Parse JSON response
        import json
        categorization = json.loads(result)
        return categorization
    except Exception as e:
        logger.error(f"Error categorizing question: {e}")
        return {"subject": "General", "topic": "General", "is_educational": True}

def get_educational_response(messages: List[dict]) -> str:
    """Get response from GPT with educational context"""
    system_prompt = """You are an expert CBSE NCERT tutor for students in classes 6-10, specializing in Mathematics and Science.

STRICT RULES:
1. ONLY answer questions related to CBSE NCERT Mathematics and Science curriculum for classes 6-10
2. If a question is NOT about CBSE NCERT Maths/Science (Class 6-10), respond EXACTLY with:
   "I can only help with CBSE NCERT Mathematics and Science questions for classes 6 to 10. Please ask me something related to your Maths or Science curriculum."
3. Do NOT answer personal questions, general knowledge, current affairs, or any non-educational topics
4. Use simple language suitable for students
5. Provide step-by-step explanations
6. Include examples from NCERT books when relevant
7. Be encouraging and supportive
8. If asked about other subjects or topics, politely redirect to Maths/Science

Your goal is to help students understand concepts clearly and build their confidence in Maths and Science."""

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                *messages
            ],
            temperature=0.7,
            max_tokens=1000
        )
        
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Error getting GPT response: {e}")
        raise HTTPException(status_code=500, detail="Error generating response")

# ==================== Authentication Routes ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserRegister):
    """Register a new user"""
    # Check if username already exists
    existing_user = await db.users.find_one({"username": user_data.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Validate class
    if user_data.student_class not in ["6", "7", "8", "9", "10"]:
        raise HTTPException(status_code=400, detail="Class must be between 6 and 10")
    
    # Hash password
    hashed_pw = hash_password(user_data.password)
    
    # Create user document
    user_doc = {
        "username": user_data.username,
        "password": hashed_pw,
        "student_class": user_data.student_class,
        "email": user_data.email,
        "created_at": datetime.utcnow()
    }
    
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    # Create access token
    access_token = create_access_token({"sub": user_id})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "username": user_data.username,
            "student_class": user_data.student_class
        }
    }

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """Login user"""
    user = await db.users.find_one({"username": credentials.username})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    if not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Create access token
    user_id = str(user["_id"])
    access_token = create_access_token({"sub": user_id})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "username": user["username"],
            "student_class": user["student_class"]
        }
    }

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user info"""
    return {
        "id": str(current_user["_id"]),
        "username": current_user["username"],
        "student_class": current_user["student_class"],
        "email": current_user.get("email")
    }

# ==================== Chat Routes ====================

@api_router.post("/chat", response_model=ChatResponse)
async def chat(chat_request: ChatRequest, current_user: dict = Depends(get_current_user)):
    """Send a message and get response"""
    user_id = str(current_user["_id"])
    
    # Categorize the question
    categorization = categorize_question(chat_request.message)
    
    # Check if it's an educational question
    if not categorization.get("is_educational", True):
        return {
            "response": "I can only help with CBSE NCERT Mathematics and Science questions for classes 6 to 10. Please ask me something related to your Maths or Science curriculum.",
            "session_id": chat_request.session_id or str(uuid.uuid4()),
            "subject": "General",
            "topic": "General",
            "title": "Non-educational query"
        }
    
    subject = categorization.get("subject", "General")
    topic = categorization.get("topic", "General")
    
    # Get or create session
    if chat_request.session_id:
        session = await db.chat_sessions.find_one({"_id": ObjectId(chat_request.session_id)})
        if not session or str(session["user_id"]) != user_id:
            raise HTTPException(status_code=404, detail="Session not found")
        
        messages = session.get("messages", [])
    else:
        # Create new session
        session_id = str(uuid.uuid4())
        title = chat_request.message[:50] + "..." if len(chat_request.message) > 50 else chat_request.message
        
        session = {
            "_id": ObjectId(),
            "user_id": ObjectId(user_id),
            "subject": subject,
            "topic": topic,
            "title": title,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "messages": []
        }
        messages = []
    
    # Add user message
    user_message = {
        "role": "user",
        "content": chat_request.message,
        "timestamp": datetime.utcnow()
    }
    messages.append(user_message)
    
    # Prepare messages for GPT (without timestamps)
    gpt_messages = [{"role": msg["role"], "content": msg["content"]} for msg in messages]
    
    # Get response from GPT
    assistant_response = get_educational_response(gpt_messages)
    
    # Add assistant message
    assistant_message = {
        "role": "assistant",
        "content": assistant_response,
        "timestamp": datetime.utcnow()
    }
    messages.append(assistant_message)
    
    # Update or create session
    session["messages"] = messages
    session["updated_at"] = datetime.utcnow()
    
    if chat_request.session_id:
        await db.chat_sessions.update_one(
            {"_id": ObjectId(chat_request.session_id)},
            {"$set": {"messages": messages, "updated_at": datetime.utcnow()}}
        )
        session_id = chat_request.session_id
    else:
        await db.chat_sessions.insert_one(session)
        session_id = str(session["_id"])
    
    return {
        "response": assistant_response,
        "session_id": session_id,
        "subject": subject,
        "topic": topic,
        "title": session["title"]
    }

@api_router.get("/chat/history", response_model=List[ChatSession])
async def get_chat_history(current_user: dict = Depends(get_current_user)):
    """Get all chat sessions for current user"""
    user_id = current_user["_id"]
    
    sessions = await db.chat_sessions.find(
        {"user_id": user_id}
    ).sort("updated_at", -1).to_list(1000)
    
    result = []
    for session in sessions:
        result.append({
            "id": str(session["_id"]),
            "user_id": str(session["user_id"]),
            "subject": session["subject"],
            "topic": session["topic"],
            "title": session["title"],
            "created_at": session["created_at"],
            "updated_at": session["updated_at"],
            "message_count": len(session.get("messages", []))
        })
    
    return result

@api_router.get("/chat/session/{session_id}")
async def get_chat_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific chat session with all messages"""
    user_id = str(current_user["_id"])
    
    session = await db.chat_sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if str(session["user_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return {
        "id": str(session["_id"]),
        "subject": session["subject"],
        "topic": session["topic"],
        "title": session["title"],
        "created_at": session["created_at"],
        "updated_at": session["updated_at"],
        "messages": session.get("messages", [])
    }

@api_router.delete("/chat/session/{session_id}")
async def delete_chat_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a chat session"""
    user_id = str(current_user["_id"])
    
    session = await db.chat_sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if str(session["user_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.chat_sessions.delete_one({"_id": ObjectId(session_id)})
    
    return {"message": "Session deleted successfully"}

# ==================== Health Check ====================

@api_router.get("/")
async def root():
    return {"message": "Educational Chatbot API", "status": "active"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
