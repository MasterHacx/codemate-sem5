from flask import Blueprint, render_template

# This Blueprint handles all authentication-related pages like login, signup, etc.
auth_bp = Blueprint('auth', __name__,
                    template_folder='templates',
                    url_prefix='') 

@auth_bp.route('/login')
def login():
    """Renders the user login page."""
    return render_template('login.html')

@auth_bp.route('/signup')
def signup():
    """Renders the user signup page."""
    return render_template('signup.html')

@auth_bp.route('/forgot-password')
def forgot_password():
    """Renders the password reset request page."""
    return render_template('forgot-password.html')