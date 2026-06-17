import functools
import psycopg2
import psycopg2.extras
from flask import Flask, render_template, request, redirect, url_for, session, flash
from flask_wtf.csrf import CSRFProtect
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

# Load secret database variables
load_dotenv()

app = Flask(__name__)

# [S1] Secret key from env — never hardcode
app.secret_key = os.environ.get('SECRET_KEY', os.urandom(32).hex())

# [S4] Session cookie hardening
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# [S5] CSRF protection
csrf = CSRFProtect(app)

DB_URL = os.environ.get("DATABASE_URL")


class DBWrapper:
    """Thin wrapper around psycopg2 connection with context manager support."""

    def __init__(self, conn):
        self.conn = conn

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.conn.rollback()
        self.conn.close()
        return False

    def execute(self, query, args=()):
        # [B1] Removed broken '?' → '%s' replacement. All queries already use %s.
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
    conn = psycopg2.connect(DB_URL, cursor_factory=psycopg2.extras.DictCursor)
    return DBWrapper(conn)


def _safe_int(value, default=None):
    """Safely convert a form value to int, returning default if invalid."""
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def _safe_float(value, default=0.0):
    """Safely convert a form value to float, returning default if invalid."""
    try:
        result = float(value)
        return max(result, 0.0)  # Never allow negative fines
    except (ValueError, TypeError):
        return default


def setup_db():
    with get_db_connection() as conn:
        # Create Users table
        conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'student',
                approved INTEGER NOT NULL DEFAULT 0
            )
        ''')
        # Create Books table with CHECK constraint
        conn.execute('''
            CREATE TABLE IF NOT EXISTS books (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                author TEXT NOT NULL,
                isbn TEXT UNIQUE NOT NULL,
                total_copies INTEGER DEFAULT 1 CHECK (total_copies >= 0),
                available_copies INTEGER DEFAULT 1 CHECK (available_copies >= 0)
            )
        ''')
        # Create Issues table
        conn.execute('''
            CREATE TABLE IF NOT EXISTS issues (
                id SERIAL PRIMARY KEY,
                book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                issue_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                due_date TIMESTAMP,
                return_date TIMESTAMP,
                fine REAL DEFAULT 0.0,
                fine_per_day REAL DEFAULT 1.0,
                status TEXT DEFAULT 'issued'
            )
        ''')

        # [O3] Add indexes for common queries
        conn.execute('CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_issues_user_id ON issues(user_id)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_issues_book_id ON issues(book_id)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_users_role_approved ON users(role, approved)')

        # [S2] Seed default admin — password from env var
        admin_password = os.environ.get('ADMIN_PASSWORD', 'ChangeMe!')
        admin_hash = generate_password_hash(admin_password)

        cur = conn.execute("SELECT id FROM users WHERE username = 'Shadow6526'")
        if not cur.fetchone():
            conn.execute(
                "INSERT INTO users (username, password_hash, role, approved) VALUES (%s, %s, %s, %s)",
                ('Shadow6526', admin_hash, 'admin', 1)
            )

        # [B10] Removed dangerous DELETE of users named 'admin'/'student' on every startup

        conn.commit()


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


# Calculate Fine (per day overdue)
def calculate_fine(due_date, fine_per_day=1.0):
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

    now = datetime.now()
    # Normalize datetime in case timezone is attached from PostgreSQL
    if due_date.tzinfo:
        due_date = due_date.replace(tzinfo=None)

    if now.date() > due_date.date():
        days_overdue = (now.date() - due_date.date()).days
        return float(days_overdue * float(fine_per_day))
    return 0.0


# Global notification context processor
@app.context_processor
def inject_notifications():
    if session.get('user_id') and session.get('role') == 'admin':
        try:
            with get_db_connection() as conn:
                pending_book_reqs = conn.execute("SELECT COUNT(*) FROM issues WHERE status = 'pending'").fetchone()[0]
                pending_student_reqs = conn.execute("SELECT COUNT(*) FROM users WHERE role = 'student' AND approved = 0").fetchone()[0]
                pending_returns = conn.execute("SELECT COUNT(*) FROM issues WHERE status = 'return_pending'").fetchone()[0]
            return dict(pending_book_reqs=pending_book_reqs, pending_student_reqs=pending_student_reqs, pending_returns=pending_returns)
        except Exception:
            return dict(pending_book_reqs=0, pending_student_reqs=0, pending_returns=0)
    return dict(pending_book_reqs=0, pending_student_reqs=0, pending_returns=0)

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
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')

        if not username or not password:
            flash('Username and password are required.', 'error')
            return render_template('login.html')

        with get_db_connection() as conn:
            user = conn.execute(
                'SELECT id, username, password_hash, role, approved FROM users WHERE username = %s',
                (username,)
            ).fetchone()

        if user and check_password_hash(user['password_hash'], password):
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
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        confirm = request.form.get('confirm_password', '').strip()

        if not username or not password:
            flash('Username and password are required.', 'error')
            return render_template('register.html')

        if password != confirm:
            flash('Passwords do not match.', 'error')
            return render_template('register.html')

        # [Password policy] Minimum 8 characters
        if len(password) < 8:
            flash('Password must be at least 8 characters.', 'error')
            return render_template('register.html')

        # Validate username (alphanumeric + underscore only, reasonable length)
        if not all(c.isalnum() or c == '_' for c in username) or len(username) > 50:
            flash('Username must be alphanumeric (underscores allowed), max 50 characters.', 'error')
            return render_template('register.html')

        with get_db_connection() as conn:
            existing = conn.execute('SELECT id FROM users WHERE username = %s', (username,)).fetchone()
            if existing:
                flash('Username already taken.', 'error')
                return render_template('register.html')

            password_hash = generate_password_hash(password)
            conn.execute(
                'INSERT INTO users (username, password_hash, role, approved) VALUES (%s, %s, %s, %s)',
                (username, password_hash, 'student', 0)
            )
            conn.commit()

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
    with get_db_connection() as conn:
        total_books = conn.execute('SELECT COUNT(*) FROM books').fetchone()[0]
        active_issues = conn.execute(
            "SELECT COUNT(*) FROM issues WHERE status IN ('issued', 'return_pending')"
        ).fetchone()[0]
        total_users = conn.execute(
            "SELECT COUNT(*) FROM users WHERE role = 'student' AND approved = 1"
        ).fetchone()[0]
        pending_users = conn.execute(
            "SELECT COUNT(*) FROM users WHERE role = 'student' AND approved = 0"
        ).fetchone()[0]

        # [O2] Bulk fine recalculation — single UPDATE instead of N+1
        conn.execute('''
            UPDATE issues
            SET fine = GREATEST(0, EXTRACT(DAY FROM (NOW() - due_date)) * fine_per_day)
            WHERE status IN ('issued', 'return_pending')
              AND due_date IS NOT NULL
              AND due_date < NOW()
        ''')
        # Reset fine to 0 for issues not yet overdue
        conn.execute('''
            UPDATE issues
            SET fine = 0
            WHERE status IN ('issued', 'return_pending')
              AND (due_date IS NULL OR due_date >= NOW())
        ''')
        conn.commit()

        recent_issues = conn.execute('''
            SELECT issues.id, issues.issue_date, issues.due_date, issues.status, issues.fine,
                   books.title, users.username
            FROM issues
            JOIN books ON issues.book_id = books.id
            JOIN users ON issues.user_id = users.id
            ORDER BY issue_date DESC LIMIT 5
        ''').fetchall()

    return render_template('admin_dashboard.html',
                           total_books=total_books,
                           active_issues=active_issues,
                           total_users=total_users,
                           pending_users=pending_users,
                           recent_issues=recent_issues)


@app.route('/admin/approve_students', methods=['GET', 'POST'])
@login_required(role='admin')
def approve_students():
    with get_db_connection() as conn:
        if request.method == 'POST':
            action = request.form.get('action')
            user_id = _safe_int(request.form.get('user_id'))

            if user_id is None:
                flash('Invalid user ID.', 'error')
                return redirect(url_for('approve_students'))

            if action == 'approve':
                conn.execute('UPDATE users SET approved = 1 WHERE id = %s', (user_id,))
                conn.commit()
                flash('Student approved successfully!', 'success')
            elif action == 'reject':
                conn.execute('DELETE FROM users WHERE id = %s AND approved = 0', (user_id,))
                conn.commit()
                flash('Student registration rejected.', 'success')

            return redirect(url_for('approve_students'))

        pending = conn.execute(
            "SELECT id, username FROM users WHERE role = 'student' AND approved = 0"
        ).fetchall()
        approved = conn.execute(
            "SELECT id, username FROM users WHERE role = 'student' AND approved = 1"
        ).fetchall()

    return render_template('approve_students.html', pending=pending, approved=approved)


@app.route('/admin/books', methods=['GET', 'POST'])
@login_required(role='admin')
def manage_books():
    with get_db_connection() as conn:
        if request.method == 'POST':
            action = request.form.get('action')

            if action == 'add':
                title = request.form.get('title', '').strip()
                author = request.form.get('author', '').strip()
                isbn = request.form.get('isbn', '').strip()
                copies = _safe_int(request.form.get('copies'))

                if not title or not author or not isbn:
                    flash('Title, author, and ISBN are required.', 'error')
                    return redirect(url_for('manage_books'))

                if copies is None or copies < 1:
                    flash('Copies must be a positive number.', 'error')
                    return redirect(url_for('manage_books'))

                try:
                    conn.execute('''
                        INSERT INTO books (title, author, isbn, total_copies, available_copies)
                        VALUES (%s, %s, %s, %s, %s)
                    ''', (title, author, isbn, copies, copies))
                    conn.commit()
                    flash('Book added successfully!', 'success')
                except psycopg2.IntegrityError:
                    conn.rollback()
                    flash('ISBN already exists!', 'error')

            elif action == 'edit':
                book_id = _safe_int(request.form.get('book_id'))
                title = request.form.get('title', '').strip()
                author = request.form.get('author', '').strip()
                isbn = request.form.get('isbn', '').strip()
                new_copies = _safe_int(request.form.get('copies'))

                if book_id is None or not title or not author or not isbn:
                    flash('All fields are required.', 'error')
                    return redirect(url_for('manage_books'))

                if new_copies is None or new_copies < 1:
                    flash('Copies must be a positive number.', 'error')
                    return redirect(url_for('manage_books'))

                book = conn.execute(
                    'SELECT total_copies, available_copies FROM books WHERE id = %s', (book_id,)
                ).fetchone()
                if book:
                    diff = new_copies - book['total_copies']
                    new_available = max(0, book['available_copies'] + diff)  # Never go negative
                    try:
                        conn.execute('''
                            UPDATE books SET title = %s, author = %s, isbn = %s,
                                   total_copies = %s, available_copies = %s
                            WHERE id = %s
                        ''', (title, author, isbn, new_copies, new_available, book_id))
                        conn.commit()
                        flash('Book updated successfully!', 'success')
                    except psycopg2.IntegrityError:
                        conn.rollback()
                        flash('ISBN already exists on another book!', 'error')
                else:
                    flash('Book not found.', 'error')

            elif action == 'delete':
                book_id = _safe_int(request.form.get('book_id'))
                if book_id is None:
                    flash('Invalid book ID.', 'error')
                    return redirect(url_for('manage_books'))

                book = conn.execute(
                    'SELECT total_copies, available_copies FROM books WHERE id = %s', (book_id,)
                ).fetchone()
                if book and book['available_copies'] == book['total_copies']:
                    conn.execute('DELETE FROM books WHERE id = %s', (book_id,))
                    conn.commit()
                    flash('Book deleted successfully!', 'success')
                else:
                    flash('Cannot delete book. Copies might be issued out.', 'error')

            return redirect(url_for('manage_books'))

        books = conn.execute('SELECT * FROM books').fetchall()

    return render_template('books.html', books=books)


@app.route('/admin/return_book', methods=['GET', 'POST'])
@login_required(role='admin')
def return_book():
    with get_db_connection() as conn:
        if request.method == 'POST':
            issue_id = _safe_int(request.form.get('issue_id'))
            action = request.form.get('action')

            if issue_id is None:
                flash('Invalid issue ID.', 'error')
                return redirect(url_for('return_book'))

            issue = conn.execute(
                'SELECT id, book_id, due_date, fine_per_day, status FROM issues WHERE id = %s', (issue_id,)
            ).fetchone()

            if issue and issue['status'] in ('issued', 'return_pending'):
                if action == 'cancel':
                    conn.execute("UPDATE issues SET status = 'issued' WHERE id = %s", (issue_id,))
                    conn.commit()
                    flash('Return request safely cancelled.', 'success')
                else:
                    fine = calculate_fine(issue['due_date'], issue.get('fine_per_day', 1.0))
                    # [B7] Use datetime.now() consistently (not utcnow)
                    return_date_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

                    conn.execute('''
                        UPDATE issues SET status = 'returned', return_date = %s, fine = %s WHERE id = %s
                    ''', (return_date_str, fine, issue_id))
                    # [B4] Cap available_copies at total_copies
                    conn.execute(
                        'UPDATE books SET available_copies = LEAST(available_copies + 1, total_copies) WHERE id = %s',
                        (issue['book_id'],)
                    )
                    conn.commit()

                    msg = f'Book returned successfully! Fine: RS {fine:.2f}/-' if fine > 0 else 'Book returned successfully!'
                    flash(msg, 'success')

            return redirect(url_for('return_book'))

        active_issues = conn.execute('''
            SELECT issues.id, issues.book_id, issues.due_date, issues.fine, issues.fine_per_day,
                   issues.status, books.title, users.username
            FROM issues
            JOIN books ON issues.book_id = books.id
            JOIN users ON issues.user_id = users.id
            WHERE issues.status IN ('issued', 'return_pending')
        ''').fetchall()

    return render_template('return_book.html', issues=active_issues)


@app.route('/admin/requests', methods=['GET', 'POST'])
@login_required(role='admin')
def book_requests():
    with get_db_connection() as conn:
        if request.method == 'POST':
            action = request.form.get('action')
            issue_id = _safe_int(request.form.get('issue_id'))

            if issue_id is None:
                flash('Invalid issue ID.', 'error')
                return redirect(url_for('book_requests'))

            issue = conn.execute(
                'SELECT id, book_id FROM issues WHERE id = %s AND status = %s', (issue_id, 'pending')
            ).fetchone()

            if issue:
                if action == 'approve':
                    due_date_str = request.form.get('due_date', '').strip()
                    # [B6] Validate fine_per_day as float
                    fine_per_day_str = request.form.get('fine_per_day', '').strip()
                    fine_per_day = _safe_float(fine_per_day_str if fine_per_day_str else 2.0, default=2.0)

                    if not due_date_str:
                        due_date_str = (datetime.now() + timedelta(days=15)).strftime('%Y-%m-%d %H:%M:%S')

                    conn.execute('''
                        UPDATE issues SET status = 'issued', due_date = %s, fine_per_day = %s,
                               issue_date = CURRENT_TIMESTAMP WHERE id = %s
                    ''', (due_date_str, fine_per_day, issue_id))
                    conn.commit()
                    flash('Book request approved!', 'success')
                elif action == 'reject':
                    conn.execute("UPDATE issues SET status = 'rejected' WHERE id = %s", (issue_id,))
                    conn.execute(
                        'UPDATE books SET available_copies = LEAST(available_copies + 1, total_copies) WHERE id = %s',
                        (issue['book_id'],)
                    )
                    conn.commit()
                    flash('Book request rejected.', 'success')

            return redirect(url_for('book_requests'))

        requests_list = conn.execute('''
            SELECT issues.id, issues.book_id, books.title, users.username
            FROM issues
            JOIN books ON issues.book_id = books.id
            JOIN users ON issues.user_id = users.id
            WHERE issues.status = 'pending'
        ''').fetchall()

    return render_template('book_requests.html', requests=requests_list)


# -------- STUDENT ROUTES --------
@app.route('/student/dashboard')
@login_required(role='student')
def student_dashboard():
    with get_db_connection() as conn:
        user_id = session['user_id']

        # [O2] Bulk fine recalculation for this student's issues
        conn.execute('''
            UPDATE issues
            SET fine = GREATEST(0, EXTRACT(DAY FROM (NOW() - due_date)) * fine_per_day)
            WHERE user_id = %s AND status IN ('issued', 'return_pending')
              AND due_date IS NOT NULL AND due_date < NOW()
        ''', (user_id,))
        conn.execute('''
            UPDATE issues
            SET fine = 0
            WHERE user_id = %s AND status IN ('issued', 'return_pending')
              AND (due_date IS NULL OR due_date >= NOW())
        ''', (user_id,))
        conn.commit()

        my_issues = conn.execute('''
            SELECT issues.id, issues.issue_date, issues.due_date, issues.status,
                   issues.fine, books.title, books.author
            FROM issues
            JOIN books ON issues.book_id = books.id
            WHERE issues.user_id = %s
            ORDER BY issues.issue_date DESC
        ''', (user_id,)).fetchall()

        search_query = request.args.get('q', '').strip()
        if search_query:
            like_query = f"%{search_query}%"
            search_books = conn.execute('''
                SELECT id, title, author, isbn, available_copies FROM books
                WHERE title ILIKE %s OR author ILIKE %s
            ''', (like_query, like_query)).fetchall()
        else:
            search_books = conn.execute(
                'SELECT id, title, author, isbn, available_copies FROM books LIMIT 10'
            ).fetchall()

    return render_template('student_dashboard.html', issues=my_issues, books=search_books, query=search_query)


@app.route('/student/issue_book', methods=['POST'])
@login_required(role='student')
def student_issue_book():
    user_id = session['user_id']
    book_id = _safe_int(request.form.get('book_id'))

    if book_id is None:
        flash('Invalid book ID.', 'error')
        return redirect(url_for('student_dashboard'))

    with get_db_connection() as conn:
        # Check if this user already has this exact book issued and not returned
        existing = conn.execute(
            "SELECT id FROM issues WHERE user_id = %s AND book_id = %s AND status IN ('issued', 'pending', 'return_pending')",
            (user_id, book_id)
        ).fetchone()

        if existing:
            flash('You have already requested or issued this book.', 'error')
            return redirect(url_for('student_dashboard'))

        # Check available copies
        book = conn.execute('SELECT id, available_copies FROM books WHERE id = %s', (book_id,)).fetchone()
        if book and book['available_copies'] > 0:
            conn.execute('''
                INSERT INTO issues (book_id, user_id, status) VALUES (%s, %s, %s)
            ''', (book_id, user_id, 'pending'))
            # [B3] Atomic guard — only decrement if available_copies > 0
            cur = conn.execute(
                'UPDATE books SET available_copies = available_copies - 1 WHERE id = %s AND available_copies > 0',
                (book_id,)
            )
            if cur.rowcount == 0:
                conn.rollback()
                flash('Book not available.', 'error')
                return redirect(url_for('student_dashboard'))
            conn.commit()
            flash('Book requested successfully! Please wait for admin approval.', 'success')
        else:
            flash('Book not available.', 'error')

    return redirect(url_for('student_dashboard'))


@app.route('/student/return_book', methods=['POST'])
@login_required(role='student')
def student_return_book():
    user_id = session['user_id']
    issue_id = _safe_int(request.form.get('issue_id'))

    if issue_id is None:
        flash('Invalid issue ID.', 'error')
        return redirect(url_for('student_dashboard'))

    with get_db_connection() as conn:
        issue = conn.execute(
            "SELECT id FROM issues WHERE id = %s AND user_id = %s AND status = 'issued'",
            (issue_id, user_id)
        ).fetchone()

        if issue:
            conn.execute("UPDATE issues SET status = 'return_pending' WHERE id = %s", (issue_id,))
            conn.commit()
            flash('Return requested successfully! Admin will process it.', 'success')
        else:
            flash('Invalid request or already returned.', 'error')

    return redirect(url_for('student_dashboard'))


@app.route('/student/cancel_return', methods=['POST'])
@login_required(role='student')
def student_cancel_return():
    user_id = session['user_id']
    issue_id = _safe_int(request.form.get('issue_id'))

    if issue_id is None:
        flash('Invalid issue ID.', 'error')
        return redirect(url_for('student_dashboard'))

    with get_db_connection() as conn:
        issue = conn.execute(
            "SELECT id FROM issues WHERE id = %s AND user_id = %s AND status = 'return_pending'",
            (issue_id, user_id)
        ).fetchone()

        if issue:
            conn.execute("UPDATE issues SET status = 'issued' WHERE id = %s", (issue_id,))
            conn.commit()
            flash('Return request cancelled.', 'success')

    return redirect(url_for('student_dashboard'))


if __name__ == '__main__':
    try:
        setup_db()
        print("Database connected and setup successfully!")
    except Exception as e:
        print(f"Error connecting to Supabase: {e}")

    # [S3] Debug mode from env — never True by default
    app.run(debug=os.environ.get('FLASK_DEBUG', 'false').lower() == 'true', port=5000)
