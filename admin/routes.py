import os
import random
from flask import Blueprint, render_template, request, redirect, url_for, session, flash
from functools import wraps
from firebase_admin import firestore

# --- 1. Blueprint and Admin Credentials ---
admin_bp = Blueprint('admin', __name__, template_folder='templates', url_prefix='/admin')
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "password123")

# --- 2. Helper Functions ---
def login_required(f):
    """Decorator to protect routes that require an admin login."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'admin_logged_in' not in session:
            return redirect(url_for('admin.admin_login'))
        return f(*args, **kwargs)
    return decorated_function

def get_all_content(db, content_type):
    """Generic function to fetch all quizzes or tutorials from Firestore."""
    all_content = []
    try:
        categories_ref = db.collection(content_type).stream()
        for category in categories_ref:
            lessons_ref = category.reference.collection('lessons').stream()
            for lesson in lessons_ref:
                topics_ref = lesson.reference.collection('topics').stream()
                for topic in topics_ref:
                    data = topic.to_dict()
                    item = {'category': category.id, 'lesson': lesson.id, 'topic': topic.id, 'title': data.get('title', 'N/A')}
                    if content_type == 'quizzes':
                        item['question_count'] = len(data.get('questions', []))
                    all_content.append(item)
    except Exception as e:
        flash(f"Error fetching {content_type}: {e}", "danger")
    return all_content

def parse_quiz_form(form):
    """Helper to parse quiz questions from the form data."""
    questions_list = []
    q_index = 0
    while True:
        text = form.get(f'q{q_index}_text')
        if not text: break
        correct = form.get(f'q{q_index}_opt1')
        options = [form.get(f'q{q_index}_opt{i}') for i in range(1, 5)]
        random.shuffle(options)
        questions_list.append({'question': text, 'options': options, 'answer': correct})
        q_index += 1
    return questions_list

# --- 3. Main Admin Routes (Login, Logout, Dashboards) ---
@admin_bp.route('/login', methods=['GET', 'POST'])
def admin_login():
    """Handles the admin login process."""
    if request.method == 'POST':
        if request.form.get('username') == ADMIN_USERNAME and request.form.get('password') == ADMIN_PASSWORD:
            session['admin_logged_in'] = True
            return redirect(url_for('admin.dashboard'))
        flash("Invalid credentials.", "error")
    return render_template('admin/admin_login.html')

@admin_bp.route('/logout')
@login_required
def admin_logout():
    """Logs the admin out."""
    session.pop('admin_logged_in', None)
    return redirect(url_for('admin.admin_login'))

@admin_bp.route('/')
@login_required
def dashboard():
    """Renders the quiz management dashboard."""
    db = firestore.client()
    all_quizzes = get_all_content(db, 'quizzes')
    return render_template('admin/admin_dashboard.html', quizzes=all_quizzes)

@admin_bp.route('/tutorials')
@login_required
def manage_tutorials():
    """Renders the tutorial management dashboard."""
    db = firestore.client()
    all_tutorials = get_all_content(db, 'tutorials')
    return render_template('admin/admin_tutorials.html', tutorials=all_tutorials)

# --- 4. Content Management Routes (Add, Edit, Delete) ---

# Quizzes
@admin_bp.route('/add-quiz', methods=['GET', 'POST'])
@login_required
def add_quiz():
    """Handles adding a new quiz."""
    if request.method == 'POST':
        try:
            db = firestore.client()
            category, lesson = request.form.get('category').lower().strip(), request.form.get('lesson').lower().strip()
            topic, title = request.form.get('topic').lower().strip(), request.form.get('title').strip()
            order = int(request.form.get('order'))
            
            lesson_ref = db.collection('quizzes').document(category).collection('lessons').document(lesson)
            if not lesson_ref.get().exists:
                count = len(list(db.collection('quizzes').document(category).collection('lessons').stream()))
                lesson_ref.set({'order': count + 1})
            db.collection('quizzes').document(category).set({}, merge=True)

            quiz_doc = {'title': title, 'questions': parse_quiz_form(request.form), 'order': order}
            lesson_ref.collection('topics').document(topic).set(quiz_doc)
            flash(f"Quiz '{title}' added successfully!", "success")
            return redirect(url_for('admin.dashboard'))
        except Exception as e:
            flash(f"An error occurred: {e}", "danger")
    return render_template('admin/add_quiz.html')

@admin_bp.route('/edit-quiz/<category>/<lesson>/<topic>', methods=['GET', 'POST'])
@login_required
def edit_quiz(category, lesson, topic):
    """Handles editing a quiz."""
    db = firestore.client()
    quiz_ref = db.collection('quizzes').document(category).collection('lessons').document(lesson).collection('topics').document(topic)
    if request.method == 'POST':
        try:
            title, order = request.form.get('title').strip(), int(request.form.get('order'))
            quiz_doc = {'title': title, 'questions': parse_quiz_form(request.form), 'order': order}
            quiz_ref.set(quiz_doc)
            flash(f"Quiz '{title}' updated successfully!", "success")
            return redirect(url_for('admin.dashboard'))
        except Exception as e:
            flash(f"An error occurred while updating: {e}", "danger")

    try:
        quiz = quiz_ref.get().to_dict()
        return render_template('admin/edit_quiz.html', quiz=quiz, ids={'category': category, 'lesson': lesson, 'topic': topic})
    except Exception as e:
        flash(f"Could not load quiz for editing: {e}", "danger")
        return redirect(url_for('admin.dashboard'))

@admin_bp.route('/delete-quiz/<category>/<lesson>/<topic>')
@login_required
def delete_quiz(category, lesson, topic):
    """Deletes a quiz."""
    try:
        db = firestore.client()
        db.collection('quizzes').document(category).collection('lessons').document(lesson).collection('topics').document(topic).delete()
        flash(f"Quiz '{topic}' deleted successfully.", "success")
    except Exception as e:
        flash(f"Error deleting quiz: {e}", "danger")
    return redirect(url_for('admin.dashboard'))

# Tutorials
@admin_bp.route('/add-tutorial', methods=['GET', 'POST'])
@login_required
def add_tutorial():
    """Handles adding a new tutorial."""
    if request.method == 'POST':
        try:
            db = firestore.client()
            category, lesson = request.form.get('category').lower().strip(), request.form.get('lesson').lower().strip()
            topic, title = request.form.get('topic').lower().strip(), request.form.get('title').strip()
            content, order = request.form.get('content').strip(), int(request.form.get('order'))

            lesson_ref = db.collection('tutorials').document(category).collection('lessons').document(lesson)
            if not lesson_ref.get().exists:
                count = len(list(db.collection('tutorials').document(category).collection('lessons').stream()))
                lesson_ref.set({'order': count + 1})
            db.collection('tutorials').document(category).set({}, merge=True)

            tutorial_doc = {'title': title, 'content': content, 'order': order}
            lesson_ref.collection('topics').document(topic).set(tutorial_doc)
            flash(f"Tutorial '{title}' added successfully!", "success")
            return redirect(url_for('admin.manage_tutorials'))
        except Exception as e:
            flash(f"An error occurred: {e}", "danger")
    return render_template('admin/add_tutorial.html')

@admin_bp.route('/edit-tutorial/<category>/<lesson>/<topic>', methods=['GET', 'POST'])
@login_required
def edit_tutorial(category, lesson, topic):
    """Handles editing a tutorial."""
    db = firestore.client()
    doc_ref = db.collection('tutorials').document(category).collection('lessons').document(lesson).collection('topics').document(topic)
    if request.method == 'POST':
        try:
            updated_doc = {
                'title': request.form.get('title').strip(),
                'content': request.form.get('content').strip(),
                'order': int(request.form.get('order'))
            }
            doc_ref.set(updated_doc)
            flash(f"Tutorial '{updated_doc['title']}' updated successfully!", "success")
            return redirect(url_for('admin.manage_tutorials'))
        except Exception as e:
            flash(f"An error occurred while updating: {e}", "danger")

    try:
        tutorial = doc_ref.get().to_dict()
        return render_template('admin/edit_tutorial.html', tutorial=tutorial, ids={'category': category, 'lesson': lesson, 'topic': topic})
    except Exception as e:
        flash(f"Could not load tutorial for editing: {e}", "danger")
        return redirect(url_for('admin.manage_tutorials'))

@admin_bp.route('/delete-tutorial/<category>/<lesson>/<topic>')
@login_required
def delete_tutorial(category, lesson, topic):
    """Deletes a tutorial."""
    try:
        db = firestore.client()
        db.collection('tutorials').document(category).collection('lessons').document(lesson).collection('topics').document(topic).delete()
        flash(f"Tutorial '{topic}' deleted successfully.", "success")
    except Exception as e:
        flash(f"Error deleting tutorial: {e}", "danger")
    return redirect(url_for('admin.manage_tutorials'))