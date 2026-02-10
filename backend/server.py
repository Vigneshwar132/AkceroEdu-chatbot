from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import bcrypt
import jwt
from bson import ObjectId
import google.generativeai as genai

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Google Gemini configuration
genai.configure(api_key=os.environ['GOOGLE_API_KEY'])
gemini_model = genai.GenerativeModel('gemini-1.5-flash')

# JWT configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-this-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 7  # 7 days

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# ==================== Models ====================

class UserRegister(BaseModel):
    username: str
    password: str
    student_class: str
    email: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None

class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime

class Message(BaseModel):
    role: str
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ChatRequest(BaseModel):
    message: str
    chat_id: Optional[str] = None
    project_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    chat_id: str
    title: str

class ChatSession(BaseModel):
    id: str
    project_id: Optional[str]
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int

# ==================== Helper Functions ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_token(token)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def get_gemini_response(messages: List[dict]) -> str:
    """Get response from Google Gemini"""
    try:
        # Build conversation history
        chat_history = []
        for msg in messages[:-1]:  # All except last message
            role = "user" if msg["role"] == "user" else "model"
            chat_history.append({"role": role, "parts": [msg["content"]]})
        
        # Get the last user message
        last_message = messages[-1]["content"]
        
        # System instruction for educational content
        system_instruction = """You are an expert CBSE NCERT tutor for students in classes 6-10, specializing in Mathematics and Science.

STRICT RULES:
1. ONLY answer questions related to CBSE NCERT Mathematics and Science curriculum for classes 6-10
2. If a question is NOT about CBSE NCERT Maths/Science (Class 6-10), respond EXACTLY with:
   "I can only help with CBSE NCERT Mathematics and Science questions for classes 6 to 10. Please ask me something related to your Maths or Science curriculum."
3. Do NOT answer personal questions, general knowledge, current affairs, or any non-educational topics
4. Use simple language suitable for students
5. Provide step-by-step explanations
6. Be encouraging and supportive
7. If asked about other subjects or topics, politely redirect to Maths/Science

Your goal is to help students understand concepts clearly and build their confidence in Maths and Science."""

        # Create a new model instance with system instruction
        model_with_instruction = genai.GenerativeModel(
            'gemini-1.5-flash',
            system_instruction=system_instruction
        )
        
        # Start chat with history
        chat = model_with_instruction.start_chat(history=chat_history)
        
        # Send message and get response
        response = chat.send_message(last_message)
        return response.text
        
    except Exception as e:
        logger.error(f"Error getting Gemini response: {e}")
        raise HTTPException(status_code=500, detail="Error generating response")

# ==================== Authentication Routes ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserRegister):
    existing_user = await db.users.find_one({"username": user_data.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    if user_data.student_class not in ["6", "7", "8", "9", "10"]:
        raise HTTPException(status_code=400, detail="Class must be between 6 and 10")
    
    hashed_pw = hash_password(user_data.password)
    user_doc = {
        "username": user_data.username,
        "password": hashed_pw,
        "student_class": user_data.student_class,
        "email": user_data.email,
        "created_at": datetime.utcnow()
    }
    
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
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
    user = await db.users.find_one({"username": credentials.username})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    if not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
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
    return {
        "id": str(current_user["_id"]),
        "username": current_user["username"],
        "student_class": current_user["student_class"],
        "email": current_user.get("email")
    }

# ==================== Project Routes ====================

@api_router.post("/projects", response_model=ProjectResponse)
async def create_project(project: ProjectCreate, current_user: dict = Depends(get_current_user)):
    """Create a new project"""
    user_id = current_user["_id"]
    
    project_doc = {
        "_id": ObjectId(),
        "user_id": user_id,
        "name": project.name,
        "description": project.description,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.projects.insert_one(project_doc)
    
    return {
        "id": str(project_doc["_id"]),
        "name": project_doc["name"],
        "description": project_doc["description"],
        "created_at": project_doc["created_at"],
        "updated_at": project_doc["updated_at"]
    }

@api_router.get("/projects", response_model=List[ProjectResponse])
async def get_projects(current_user: dict = Depends(get_current_user)):
    """Get all projects for current user"""
    user_id = current_user["_id"]
    
    projects = await db.projects.find(
        {"user_id": user_id}
    ).sort("updated_at", -1).to_list(1000)
    
    result = []
    for project in projects:
        result.append({
            "id": str(project["_id"]),
            "name": project["name"],
            "description": project.get("description"),
            "created_at": project["created_at"],
            "updated_at": project["updated_at"]
        })
    
    return result

@api_router.put("/projects/{project_id}")
async def update_project(
    project_id: str,
    project: ProjectCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update a project"""
    user_id = str(current_user["_id"])
    
    existing_project = await db.projects.find_one({"_id": ObjectId(project_id)})
    if not existing_project or str(existing_project["user_id"]) != user_id:
        raise HTTPException(status_code=404, detail="Project not found")
    
    await db.projects.update_one(
        {"_id": ObjectId(project_id)},
        {"$set": {
            "name": project.name,
            "description": project.description,
            "updated_at": datetime.utcnow()
        }}
    )
    
    return {"message": "Project updated successfully"}

@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a project and all its chats"""
    user_id = str(current_user["_id"])
    
    project = await db.projects.find_one({"_id": ObjectId(project_id)})
    if not project or str(project["user_id"]) != user_id:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Delete all chats in this project
    await db.chat_sessions.delete_many({"project_id": ObjectId(project_id)})
    
    # Delete the project
    await db.projects.delete_one({"_id": ObjectId(project_id)})
    
    return {"message": "Project and associated chats deleted successfully"}

# ==================== Chat Routes ====================

@api_router.post("/chat", response_model=ChatResponse)
async def chat(chat_request: ChatRequest, current_user: dict = Depends(get_current_user)):
    """Send a message and get response"""
    user_id = current_user["_id"]
    
    # Get or create chat session
    if chat_request.chat_id:
        session = await db.chat_sessions.find_one({"_id": ObjectId(chat_request.chat_id)})
        if not session or session["user_id"] != user_id:
            raise HTTPException(status_code=404, detail="Chat not found")
        messages = session.get("messages", [])
    else:
        # Create new chat session
        title = chat_request.message[:50] + "..." if len(chat_request.message) > 50 else chat_request.message
        
        session = {
            "_id": ObjectId(),
            "user_id": user_id,
            "project_id": ObjectId(chat_request.project_id) if chat_request.project_id else None,
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
    
    # Prepare messages for Gemini (without timestamps)
    gemini_messages = [{"role": msg["role"], "content": msg["content"]} for msg in messages]
    
    # Get response from Gemini
    assistant_response = get_gemini_response(gemini_messages)
    
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
    
    if chat_request.chat_id:
        await db.chat_sessions.update_one(
            {"_id": ObjectId(chat_request.chat_id)},
            {"$set": {"messages": messages, "updated_at": datetime.utcnow()}}
        )
        chat_id = chat_request.chat_id
    else:
        await db.chat_sessions.insert_one(session)
        chat_id = str(session["_id"])
    
    return {
        "response": assistant_response,
        "chat_id": chat_id,
        "title": session["title"]
    }

@api_router.get("/chats", response_model=List[ChatSession])
async def get_chats(
    project_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all chats, optionally filtered by project"""
    user_id = current_user["_id"]
    
    query = {"user_id": user_id}
    if project_id:
        query["project_id"] = ObjectId(project_id)
    else:
        # Get chats not in any project
        query["project_id"] = None
    
    chats = await db.chat_sessions.find(query).sort("updated_at", -1).to_list(1000)
    
    result = []
    for chat in chats:
        result.append({
            "id": str(chat["_id"]),
            "project_id": str(chat["project_id"]) if chat.get("project_id") else None,
            "title": chat["title"],
            "created_at": chat["created_at"],
            "updated_at": chat["updated_at"],
            "message_count": len(chat.get("messages", []))
        })
    
    return result

@api_router.get("/chats/{chat_id}")
async def get_chat(chat_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific chat with all messages"""
    user_id = current_user["_id"]
    
    chat = await db.chat_sessions.find_one({"_id": ObjectId(chat_id)})
    if not chat or chat["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    return {
        "id": str(chat["_id"]),
        "project_id": str(chat["project_id"]) if chat.get("project_id") else None,
        "title": chat["title"],
        "created_at": chat["created_at"],
        "updated_at": chat["updated_at"],
        "messages": chat.get("messages", [])
    }

@api_router.delete("/chats/{chat_id}")
async def delete_chat(chat_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a chat"""
    user_id = current_user["_id"]
    
    chat = await db.chat_sessions.find_one({"_id": ObjectId(chat_id)})
    if not chat or chat["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    await db.chat_sessions.delete_one({"_id": ObjectId(chat_id)})
    return {"message": "Chat deleted successfully"}

@api_router.put("/chats/{chat_id}/move")
async def move_chat_to_project(
    chat_id: str,
    project_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Move a chat to a different project or remove from project"""
    user_id = current_user["_id"]
    
    chat = await db.chat_sessions.find_one({"_id": ObjectId(chat_id)})
    if not chat or chat["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    new_project_id = ObjectId(project_id) if project_id else None
    
    await db.chat_sessions.update_one(
        {"_id": ObjectId(chat_id)},
        {"$set": {"project_id": new_project_id, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "Chat moved successfully"}

# ==================== Health Check ====================

@api_router.get("/")
async def root():
    return {"message": "Educational Chatbot API with Projects", "status": "active"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

# Include router
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
