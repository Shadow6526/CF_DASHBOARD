import functools
import psycopg2
import psycopg2.extras
from flask import Flask, render_template, request, redirect, url_for, session, flash
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

# Load secret database variables
load_dotenv()

app = Flask(__name__)
app.secret_key = 'super_secret_premium_key'

DB_URL = os.environ.get("DATABASE_URL")

class DBWrapper:
    def __init__(self, conn):
        self.conn = conn
    
    def execute(self, query, args=()):
        # PostgreSQL uses %s instead of ? for variable substitution
        query = query.replace('?', '%s')
        cur = self.conn.cursor()
        cur.execute(query, args)
        return cur
        
    def commit(self):
        self.conn.commit()

    def rollback(self):
        self.conn.rollback()
    
    def close(self):
        self.conn.close()

def get_db_connection():
    # Connect directly to Supabase Postgres
    conn = psycopg2.connect(DB_URL, cursor_factory=psycopg2.extras.DictCursor)
    return DBWrapper(conn)

def setup_db():
    conn = get_db_connection()
    
    # Create Users table (SERIAL instead of AUTOINCREMENT for Postgres)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'student',
            approved INTEGER NOT NULL DEFAULT 0
        )
    ''')
    # Create Books table
    conn.execute('''
        CREATE TABLE IF NOT EXISTS books (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            isbn TEXT UNIQUE NOT NULL,
            total_copies INTEGER DEFAULT 1,
            available_copies INTEGER DEFAULT 1
        )
    ''')
    # Create Issues table
    conn.execute('''
        CREATE TABLE IF NOT EXISTS issues (
            id SERIAL PRIMARY KEY,
            book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            issue_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            due_date TIMESTAMP NOT NULL,
            return_date TIMESTAMP,
            fine REAL DEFAULT 0.0,
            status TEXT DEFAULT 'issued'
        )
    ''')

    # Seed default admin: Shadow6526 / MidgardianX
    admin_hash = generate_password_hash('MidgardianX')

    cur = conn.execute("SELECT id FROM users WHERE username = 'Shadow6526'")
    if not cur.fetchone():
        conn.execute("INSERT INTO users (username, password_hash, role, approved) VALUES (%s, %s, %s, %s)",
                  ('Shadow6526', admin_hash, 'admin', 1))

    # Remove old default admin/student if they exist
    conn.execute("DELETE FROM users WHERE username = 'admin' AND role = 'admin'")
    conn.execute("DELETE FROM users WHERE username = 'student' AND role = 'student'")

    conn.commit()
    conn.close()

# Helper to require login
def login_required(role=None):
    def decorator(f):
        @functools.wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user_id' not in session:
                return redirect(url_for('login'))
            if role and session.get('role') != role:
                flash('Unauthorized access!', 'error')
                return redirect(url_for('login'))
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# Calculate Fine ($1 per day overdue)
def calculate_fine(due_date):
    if isinstance(due_date, str):
        for fmt in ('%Y-%m-%d %H:%M:%S.%f', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d'):
            try:
                due_date = datetime.strptime(due_date, fmt)
                break
            except ValueError:
                continue
        else:
            return 0.0
            
    if not due_date:
        return 0.0

    now = datetime.utcnow()
    # Normalize datetime in case timezone is attached from PostgreSQL
    if due_date.tzinfo:
        due_date = due_date.replace(tzinfo=None)
        
    if now > due_date:
        days_overdue = (now - due_date).days
        return float(days_overdue * 1.0)
    return 0.0

# -------- AUTH ROUTES --------
@app.route('/')
def home():
    if 'user_id' in session:
        if session['role'] == 'admin':
            return redirect(url_for('admin_dashboard'))
        return redirect(url_for('student_dashboard'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        conn = get_db_connection()
        user = conn.execute('SELECT * FROM users WHERE username = %s', (username,)).fetchone()
        conn.close()

        if user and check_password_hash(user['password_hash'], password):
            # Check if approved
            if user['approved'] == 0:
                flash('Your account is pending admin approval.', 'error')
                return render_template('login.html')

            session['user_id'] = user['id']
            session['username'] = user['username']
            session['role'] = user['role']

            if user['role'] == 'admin':
                return redirect(url_for('admin_dashboard'))
            else:
                return redirect(url_for('student_dashboard'))
        else:
            flash('Invalid username or password', 'error')

    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username'].strip()
        password = request.form['password'].strip()
        confirm = request.form['confirm_password'].strip()

        if not username or not password:
            flash('Username and password are required.', 'error')
            return render_template('register.html')

        if password != confirm:
            flash('Passwords do not match.', 'error')
            return render_template('register.html')

        if len(password) < 4:
            flash('Password must be at least 4 characters.', 'error')
            return render_template('register.html')

        conn = get_db_connection()
        existing = conn.execute('SELECT id FROM users WHERE username = %s', (username,)).fetchone()
        if existing:
            conn.close()
            flash('Username already taken.', 'error')
            return render_template('register.html')

        password_hash = generate_password_hash(password)
        conn.execute('INSERT INTO users (username, password_hash, role, approved) VALUES (%s, %s, %s, %s)',
                     (username, password_hash, 'student', 0))
        conn.commit()
        conn.close()

        flash('Registration successful! Please wait for admin approval.', 'success')
        return redirect(url_for('login'))

    return render_template('register.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

# -------- ADMIN ROUTES --------
@app.route('/admin/dashboard')
@login_required(role='admin')
def admin_dashboard():
    conn = get_db_connection()

    total_books = conn.execute('SELECT COUNT(*) FROM books').fetchone()[0]
    active_issues = conn.execute("SELECT COUNT(*) FROM issues WHERE status = 'issued'").fetchone()[0]
    total_users = conn.execute("SELECT COUNT(*) FROM users WHERE role = 'student' AND approved = 1").fetchone()[0]
    pending_users = conn.execute("SELECT COUNT(*) FROM users WHERE role = 'student' AND approved = 0").fetchone()[0]

    # Update fines
    issues = conn.execute("SELECT id, due_date FROM issues WHERE status = 'issued'").fetchall()
    for issue in issues:
        fine = calculate_fine(issue['due_date'])
        conn.execute("UPDATE issues SET fine = %s WHERE id = %s", (fine, issue['id']))
    conn.commit()

    recent_issues = conn.execute('''
        SELECT issues.*, books.title, users.username
        FROM issues
        JOIN books ON issues.book_id = books.id
        JOIN users ON issues.user_id = users.id
        ORDER BY issue_date DESC LIMIT 5
    ''').fetchall()

    conn.close()
    return render_template('admin_dashboard.html',
                           total_books=total_books,
                           active_issues=active_issues,
                           total_users=total_users,
                           pending_users=pending_users,
                           recent_issues=recent_issues)

@app.route('/admin/approve_students', methods=['GET', 'POST'])
@login_required(role='admin')
def approve_students():
    conn = get_db_connection()
    if request.method == 'POST':
        action = request.form.get('action')
        user_id = request.form.get('user_id')

        if action == 'approve':
            conn.execute('UPDATE users SET approved = 1 WHERE id = %s', (user_id,))
            conn.commit()
            flash('Student approved successfully!', 'success')
        elif action == 'reject':
            conn.execute('DELETE FROM users WHERE id = %s AND approved = 0', (user_id,))
            conn.commit()
            flash('Student registration rejected.', 'success')

        conn.close()
        return redirect(url_for('approve_students'))

    pending = conn.execute("SELECT * FROM users WHERE role = 'student' AND approved = 0").fetchall()
    approved = conn.execute("SELECT * FROM users WHERE role = 'student' AND approved = 1").fetchall()
    conn.close()
    return render_template('approve_students.html', pending=pending, approved=approved)

@app.route('/admin/books', methods=['GET', 'POST'])
@login_required(role='admin')
def manage_books():
    conn = get_db_connection()
    if request.method == 'POST':
        action = request.form.get('action')
        if action == 'add':
            title = request.form['title']
            author = request.form['author']
            isbn = request.form['isbn']
            copies = int(request.form['copies'])
            try:
                conn.execute('''
                    INSERT INTO books (title, author, isbn, total_copies, available_copies)
                    VALUES (%s, %s, %s, %s, %s)
                ''', (title, author, isbn, copies, copies))
                conn.commit()
                flash('Book added successfully!', 'success')
            except psycopg2.IntegrityError:
                conn.rollback() # Required to continue using connection after error in psycopg2
                flash('ISBN already exists!', 'error')

        elif action == 'edit':
            book_id = request.form['book_id']
            title = request.form['title']
            author = request.form['author']
            isbn = request.form['isbn']
            new_copies = int(request.form['copies'])

            book = conn.execute('SELECT * FROM books WHERE id = %s', (book_id,)).fetchone()
            if book:
                diff = new_copies - book['total_copies']
                new_available = book['available_copies'] + diff
                conn.execute('''
                    UPDATE books SET title = %s, author = %s, isbn = %s, total_copies = %s, available_copies = %s
                    WHERE id = %s
                ''', (title, author, isbn, new_copies, new_available, book_id))
                conn.commit()
                flash('Book updated successfully!', 'success')

        elif action == 'delete':
            book_id = request.form['book_id']
            book = conn.execute('SELECT * FROM books WHERE id = %s', (book_id,)).fetchone()
            if book and book['available_copies'] == book['total_copies']:
                conn.execute('DELETE FROM books WHERE id = %s', (book_id,))
                conn.commit()
                flash('Book deleted successfully!', 'success')
            else:
                flash('Cannot delete book. Copies might be issued out.', 'error')

        conn.close()
        return redirect(url_for('manage_books'))

    books = conn.execute('SELECT * FROM books').fetchall()
    conn.close()
    return render_template('books.html', books=books)

@app.route('/admin/issue_book', methods=['GET', 'POST'])
@login_required(role='admin')
def issue_book():
    conn = get_db_connection()
    if request.method == 'POST':
        user_id = request.form['user_id']
        book_id = request.form['book_id']
        due_date = datetime.utcnow() + timedelta(days=14)
        due_date_str = due_date.strftime('%Y-%m-%d %H:%M:%S')

        book = conn.execute('SELECT * FROM books WHERE id = %s', (book_id,)).fetchone()
        user = conn.execute('SELECT * FROM users WHERE id = %s', (user_id,)).fetchone()

        if book and user and book['available_copies'] > 0:
            conn.execute('''
                INSERT INTO issues (book_id, user_id, due_date) VALUES (%s, %s, %s)
            ''', (book_id, user_id, due_date_str))
            conn.execute('UPDATE books SET available_copies = available_copies - 1 WHERE id = %s', (book_id,))
            conn.commit()
            flash('Book issued successfully!', 'success')
        else:
            flash('Book not available or User not found.', 'error')
        conn.close()
        return redirect(url_for('issue_book'))

    users = conn.execute("SELECT * FROM users WHERE role = 'student' AND approved = 1").fetchall()
    books = conn.execute("SELECT * FROM books WHERE available_copies > 0").fetchall()
    conn.close()
    return render_template('issue_book.html', users=users, books=books)

@app.route('/admin/return_book', methods=['GET', 'POST'])
@login_required(role='admin')
def return_book():
    conn = get_db_connection()
    if request.method == 'POST':
        issue_id = request.form['issue_id']
        issue = conn.execute('SELECT * FROM issues WHERE id = %s', (issue_id,)).fetchone()
        if issue and issue['status'] == 'issued':
            fine = calculate_fine(issue['due_date'])
            return_date_str = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')

            conn.execute('''
                UPDATE issues SET status = 'returned', return_date = %s, fine = %s WHERE id = %s
            ''', (return_date_str, fine, issue_id))
            conn.execute('UPDATE books SET available_copies = available_copies + 1 WHERE id = %s', (issue['book_id'],))
            conn.commit()

            msg = f'Book returned successfully! Fine: ${fine:.2f}' if fine > 0 else 'Book returned successfully!'
            flash(msg, 'success')

        conn.close()
        return redirect(url_for('return_book'))

    active_issues = conn.execute('''
        SELECT issues.*, books.title, users.username
        FROM issues
        JOIN books ON issues.book_id = books.id
        JOIN users ON issues.user_id = users.id
        WHERE issues.status = 'issued'
    ''').fetchall()
    conn.close()

    return render_template('return_book.html', issues=active_issues)

# -------- STUDENT ROUTES --------
@app.route('/student/dashboard')
@login_required(role='student')
def student_dashboard():
    conn = get_db_connection()
    user_id = session['user_id']

    # Update my fines
    my_issues_raw = conn.execute("SELECT id, due_date FROM issues WHERE user_id = %s AND status = 'issued'", (user_id,)).fetchall()
    for issue in my_issues_raw:
        fine = calculate_fine(issue['due_date'])
        conn.execute("UPDATE issues SET fine = %s WHERE id = %s", (fine, issue['id']))
    conn.commit()

    my_issues = conn.execute('''
        SELECT issues.*, books.title, books.author
        FROM issues
        JOIN books ON issues.book_id = books.id
        WHERE issues.user_id = %s
        ORDER BY issues.issue_date DESC
    ''', (user_id,)).fetchall()

    search_query = request.args.get('q', '')
    if search_query:
        # Prevent SQL injection while using wildcards with psycopg2
        like_query = f"%{search_query}%"
        search_books = conn.execute('''
            SELECT * FROM books WHERE title ILIKE %s OR author ILIKE %s
        ''', (like_query, like_query)).fetchall()
    else:
        search_books = conn.execute('SELECT * FROM books LIMIT 10').fetchall()

    conn.close()
    return render_template('student_dashboard.html', issues=my_issues, books=search_books, query=search_query)

@app.route('/student/issue_book', methods=['POST'])
@login_required(role='student')
def student_issue_book():
    conn = get_db_connection()
    user_id = session['user_id']
    book_id = request.form['book_id']
    
    # Check if this user already has this exact book issued and not returned
    existing = conn.execute("SELECT * FROM issues WHERE user_id = %s AND book_id = %s AND status = 'issued'", (user_id, book_id)).fetchone()
    if existing:
        flash('You have already issued this book.', 'error')
        conn.close()
        return redirect(url_for('student_dashboard'))

    # Check available copies
    book = conn.execute('SELECT * FROM books WHERE id = %s', (book_id,)).fetchone()
    if book and book['available_copies'] > 0:
        due_date = datetime.utcnow() + timedelta(days=14)
        due_date_str = due_date.strftime('%Y-%m-%d %H:%M:%S')

        conn.execute('''
            INSERT INTO issues (book_id, user_id, due_date) VALUES (%s, %s, %s)
        ''', (book_id, user_id, due_date_str))
        conn.execute('UPDATE books SET available_copies = available_copies - 1 WHERE id = %s', (book_id,))
        conn.commit()
        flash('Book issued successfully!', 'success')
    else:
        flash('Book not available.', 'error')

    conn.close()
    return redirect(url_for('student_dashboard'))

if __name__ == '__main__':
    try:
        setup_db()
        print("Database connected and setup successfully!")
    except Exception as e:
        print(f"Error connecting to Supabase: {e}")
        
    app.run(debug=True, port=5000)
