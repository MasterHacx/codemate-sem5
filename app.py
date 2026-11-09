import os
import markdown
import requests
import google.generativeai as genai
from flask import Flask, render_template, abort, redirect, url_for, request, jsonify
from dotenv import load_dotenv

# --- 1. Initial Setup ---
load_dotenv()
app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "a-default-secret-key-for-development")

# --- 2. Initialize External Services ---
try:
    # Initialize Firebase Admin SDK for backend operations
    import firebase_admin
    from firebase_admin import credentials, firestore
    
    # Use service account from env var, fallback to local file
    sa_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "serviceAccountKey.json")
    if os.path.exists(sa_path):
        cred = credentials.Certificate(sa_path)
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        print("Firebase Admin SDK initialized successfully.")
    else:
        print(f"WARNING: Service account key not found at {sa_path}. Firestore will be unavailable.")
        db = None
except Exception as e:
    print(f"CRITICAL: Firebase Admin SDK failed to initialize: {e}")
    db = None

try:
    # Configure Google Gemini API
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
    if GEMINI_API_KEY:
        genai.configure(api_key=GEMINI_API_KEY)
        print("Google Gemini API configured successfully.")
    else:
        print("WARNING: GEMINI_API_KEY not found in .env file. AI features will be disabled.")
except Exception as e:
    print(f"CRITICAL: Google Gemini API failed to configure: {e}")

# --- 3. Register Blueprints ---
from auth.routes import auth_bp
from admin.routes import admin_bp
app.register_blueprint(auth_bp)
app.register_blueprint(admin_bp)

# --- 4. Helper Functions ---
def get_tutorial_structure(language):
    """Fetches the nested structure of lessons and topics for a language from Firestore."""
    if not db: return None
    structure = {}
    try:
        lessons_ref = db.collection('tutorials').document(language).collection('lessons').order_by('order').stream()
        for lesson in lessons_ref:
            topics_ref = lesson.reference.collection('topics').order_by('order').stream()
            topics = [topic.id for topic in topics_ref]
            if topics:
                structure[lesson.id] = topics
        return structure
    except Exception as e:
        print(f"Error fetching tutorial structure for '{language}': {e}")
        return None

# --- 5. Context Processor ---
@app.context_processor
def inject_firebase_config():
    """Makes Firebase client-side config available to all templates."""
    return dict(firebase_config={
        "apiKey": os.getenv("FIREBASE_API_KEY"),
        "authDomain": os.getenv("FIREBASE_AUTH_DOMAIN"),
        "projectId": os.getenv("FIREBASE_PROJECT_ID"),
        "storageBucket": os.getenv("FIREBASE_STORAGE_BUCKET"),
        "messagingSenderId": os.getenv("FIREBASE_MESSAGING_SENDER_ID"),
        "appId": os.getenv("FIREBASE_APP_ID")
    })

# --- 6. Main Application Routes ---
@app.route('/')
def home():
    """Renders the homepage."""
    return render_template('homepage.html')

@app.route('/dashboard')
def dashboard():
    """Renders the user's dashboard."""
    return render_template('dashboard.html')

@app.route('/playground')
def playground():
    """Renders the quiz and practice playground."""
    return render_template('playground.html')

@app.route('/tutorials/<language>')
def show_language_default(language):
    """Redirects to the first topic of the first lesson for a language."""
    structure = get_tutorial_structure(language)
    if not structure: abort(404)
    first_lesson = list(structure.keys())[0]
    first_topic = structure[first_lesson][0]
    return redirect(url_for('show_tutorial', language=language, lesson=first_lesson, topic=first_topic))

@app.route('/tutorials/<language>/<lesson>/<topic>')
def show_tutorial(language, lesson, topic):
    """Renders a specific tutorial page using content from Firestore."""
    if not db: abort(503, "Database service is unavailable.")
    structure = get_tutorial_structure(language)
    if not structure: abort(404)
    
    try:
        doc_ref = db.collection('tutorials').document(language).collection('lessons').document(lesson).collection('topics').document(topic)
        doc = doc_ref.get()
        if not doc.exists: abort(404)
        
        tutorial_data = doc.to_dict()
        md_content = tutorial_data.get('content', '# Content Not Found')
        html_content = markdown.markdown(md_content, extensions=['extra', 'codehilite', 'toc', 'tables'])
        topic_id = f"{language}-{lesson}-{topic}"
        
        return render_template('tutorial_page.html', content=html_content, topic_title=tutorial_data.get('title', ''),
                               tutorial_structure=structure, language=language, current_lesson=lesson,
                               current_topic=topic, topic_id=topic_id)
    except Exception as e:
        print(f"Error fetching tutorial '{language}/{lesson}/{topic}': {e}")
        abort(500)

# --- 7. API Routes ---
@app.route('/compiler/', defaults={'language': 'python'})
@app.route('/compiler/<language>')
def compiler_page(language):
    """Renders the code compiler page."""
    supported = ['python', 'cpp', 'java', 'kotlin', 'javascript', 'go', 'c', 'csharp', 'rust', 'swift']
    return render_template('compiler.html', selected_language=language if language in supported else 'python')

@app.route('/compilers')
def compilers_redirect():
    """Redirects /compilers to the default Python compiler."""
    return redirect(url_for('compiler_page', language='python'))

@app.route('/run-code', methods=['POST'])
def run_code():
    """API endpoint to execute code using the Piston API."""
    data = request.get_json()
    lang, code, user_input = data.get('language'), data.get('code'), data.get('input', '')
    
    versions = {'python': '3.10.0', 'cpp': '10.2.0', 'java': '15.0.2', 'kotlin': '1.8.20',
                'javascript': '18.15.0', 'go': '1.16.2', 'c': '10.2.0',
                'csharp': '6.12.0', 'rust': '*', 'swift': '5.3.3'}

    payload = {"language": lang, "version": versions.get(lang, "*"), "files": [{"content": code}], "stdin": user_input}
    
    try:
        response = requests.post("https://emkc.org/api/v2/piston/execute", json=payload, timeout=10)
        result = response.json()
        output = (result.get('run', {}).get('stdout', '') + result.get('run', {}).get('stderr', '')) or result.get('message', 'No output.')
        return jsonify({'output': output})
    except requests.exceptions.RequestException as e:
        return jsonify({'output': f'Error connecting to compiler service: {e}'}), 503

@app.route('/ask-ai', methods=['POST'])
def ask_ai():
    """API endpoint to get help from the Google Gemini AI."""
    if not GEMINI_API_KEY:
        return jsonify({'response': "AI assistant is not configured on the server."}), 503

    data = request.get_json()
    user_query, current_code, language = data.get('query'), data.get('code', ''), data.get('language', 'code')
    if not user_query: return jsonify({'response': 'Query is required.'}), 400

    prompt = f"""You are 'CODEMATE AI', an expert and friendly coding mentor.
    Your main goal is to help a user who is learning to code.
    - Be concise: Keep your answer very short and to the point. Use bullet points or numbered lists.
    - Be context-aware: Your answer MUST relate to the user's code provided below.
    - Be a teacher: When debugging, don't just give the answer. Explain the error simply and then provide the corrected code.
    - Format correctly: ALWAYS use Markdown. Use triple backticks for code blocks (e.g., ```python ... ```).

    The user is working with this {language} code:
    ```
    {current_code}
    ```

    The user's question is: "{user_query}"
    """
    
    for model_name in ['gemini-2.5-flash', 'gemini-2.5-pro']:
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            return jsonify({'response': response.text})
        except Exception:
            continue
    return jsonify({'response': 'AI service is currently unavailable. Please try again later.'}), 503

# --- Boilerplate ---
if __name__ == '__main__':
    app.run(debug=True)