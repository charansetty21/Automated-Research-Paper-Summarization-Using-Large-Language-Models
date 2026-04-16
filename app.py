"""
Automated Research Paper Summarization System
Flask Backend — app.py
"""

from flask import Flask, request, jsonify, render_template, session
from flask_cors import CORS
import mysql.connector
import hashlib, os, json, re
from datetime import datetime, timedelta
from functools import wraps

app = Flask(__name__, template_folder='.', static_folder='.', static_url_path='')
app.secret_key = os.environ.get('SECRET_KEY', 'research-summarizer-secret-2024')
CORS(app)

# ─── Database config ─────────────────────────────────────────
DB_CONFIG = {
    'host':     os.environ.get('DB_HOST',     'localhost'),
    'user':     os.environ.get('DB_USER',     'root'),
    'password': os.environ.get('DB_PASSWORD', 'yourpassword'),
    'database': os.environ.get('DB_NAME',     'research_summarizer'),
    'charset':  'utf8mb4',
}

def get_db():
    return mysql.connector.connect(**DB_CONFIG)

def hash_password(pw):
    return hashlib.sha256(pw.encode()).hexdigest()

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated

def log_request(user_id, endpoint, method, status):
    try:
        db = get_db()
        cur = db.cursor()
        cur.execute(
            "INSERT INTO api_logs (user_id, endpoint, method, status_code) VALUES (%s,%s,%s,%s)",
            (user_id, endpoint, method, status)
        )
        db.commit()
        cur.close(); db.close()
    except Exception:
        pass

# ─── Pages ───────────────────────────────────────────────────
@app.route('/')
def index():
    return render_template('index.html')

# ─── Auth ─────────────────────────────────────────────────────
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username','').strip()
    email    = data.get('email','').strip()
    password = data.get('password','')
    if not username or not email or not password:
        return jsonify({'error': 'All fields required'}), 400
    try:
        db  = get_db()
        cur = db.cursor()
        cur.execute(
            "INSERT INTO users (username, email, password) VALUES (%s,%s,%s)",
            (username, email, hash_password(password))
        )
        db.commit()
        user_id = cur.lastrowid
        cur.close(); db.close()
        session['user_id']  = user_id
        session['username'] = username
        return jsonify({'message': 'Registered successfully', 'username': username}), 201
    except mysql.connector.IntegrityError:
        return jsonify({'error': 'Username or email already exists'}), 409
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    data     = request.get_json()
    email    = data.get('email','').strip()
    password = data.get('password','')
    try:
        db  = get_db()
        cur = db.cursor(dictionary=True)
        cur.execute("SELECT * FROM users WHERE email=%s AND password=%s",
                    (email, hash_password(password)))
        user = cur.fetchone()
        if not user:
            return jsonify({'error': 'Invalid credentials'}), 401
        cur.execute("UPDATE users SET last_login=%s WHERE id=%s",
                    (datetime.now(), user['id']))
        db.commit()
        cur.close(); db.close()
        session['user_id']  = user['id']
        session['username'] = user['username']
        session['role']     = user['role']
        return jsonify({'message': 'Login successful', 'username': user['username'], 'role': user['role']})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out'})

@app.route('/api/me', methods=['GET'])
def me():
    if 'user_id' in session:
        return jsonify({'user_id': session['user_id'], 'username': session['username'], 'role': session.get('role','researcher')})
    return jsonify({'user_id': None})

# ─── Papers ───────────────────────────────────────────────────
@app.route('/api/papers', methods=['GET'])
def get_papers():
    domain  = request.args.get('domain','')
    year    = request.args.get('year','')
    search  = request.args.get('q','')
    page    = int(request.args.get('page', 1))
    limit   = int(request.args.get('limit', 8))
    offset  = (page - 1) * limit
    try:
        db  = get_db()
        cur = db.cursor(dictionary=True)
        where = ["p.status='summarized'"]
        params = []
        if domain: where.append("p.domain=%s"); params.append(domain)
        if year:   where.append("p.year=%s");   params.append(year)
        if search:
            where.append("(p.title LIKE %s OR p.authors LIKE %s OR p.abstract LIKE %s)")
            params += [f'%{search}%']*3
        where_sql = ' AND '.join(where)
        cur.execute(f"SELECT COUNT(*) AS cnt FROM papers p WHERE {where_sql}", params)
        total = cur.fetchone()['cnt']
        cur.execute(f"""
            SELECT p.id, p.title, p.authors, p.domain, p.year, p.source_url,
                   LEFT(p.abstract,300) AS abstract_preview,
                   s.summary_type, s.model_used, s.rouge_score, s.bert_score,
                   LEFT(s.summary_text, 250) AS summary_preview,
                   AVG(f.rating) AS avg_rating, COUNT(DISTINCT f.id) AS feedback_count
            FROM papers p
            LEFT JOIN summaries s ON p.id = s.paper_id
            LEFT JOIN feedback  f ON s.id = f.summary_id
            WHERE {where_sql}
            GROUP BY p.id, s.id
            ORDER BY p.year DESC, p.id DESC
            LIMIT %s OFFSET %s
        """, params + [limit, offset])
        papers = cur.fetchall()
        cur.close(); db.close()
        return jsonify({'papers': papers, 'total': total, 'page': page, 'pages': -(-total//limit)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/papers/<int:pid>', methods=['GET'])
def get_paper(pid):
    try:
        db  = get_db()
        cur = db.cursor(dictionary=True)
        cur.execute("""
            SELECT p.*, s.id AS summary_id, s.summary_type, s.summary_text,
                   s.key_findings, s.methodology, s.conclusion,
                   s.model_used, s.rouge_score, s.bert_score, s.generated_at
            FROM papers p
            LEFT JOIN summaries s ON p.id = s.paper_id
            WHERE p.id=%s
        """, (pid,))
        paper = cur.fetchone()
        if not paper: return jsonify({'error': 'Not found'}), 404
        cur.execute("SELECT keyword, weight FROM keywords WHERE paper_id=%s ORDER BY weight DESC", (pid,))
        paper['keywords'] = cur.fetchall()
        cur.execute("""
            SELECT f.rating, f.comment, f.submitted_at, u.username
            FROM feedback f
            LEFT JOIN users u ON f.user_id = u.id
            WHERE f.summary_id=%s
            ORDER BY f.submitted_at DESC
        """, (paper.get('summary_id'),))
        paper['feedback'] = cur.fetchall()
        cur.close(); db.close()
        # convert dates to string
        for k,v in paper.items():
            if isinstance(v, datetime): paper[k] = v.isoformat()
        for fb in paper['feedback']:
            for k,v in fb.items():
                if isinstance(v, datetime): fb[k] = v.isoformat()
        return jsonify(paper)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/papers', methods=['POST'])
@login_required
def add_paper():
    data = request.get_json()
    required = ['title','authors','abstract','domain','year']
    for f in required:
        if not data.get(f): return jsonify({'error': f'{f} is required'}), 400
    try:
        db  = get_db()
        cur = db.cursor()
        cur.execute("""
            INSERT INTO papers (title, authors, abstract, source_url, source_type, domain, year, uploaded_by, status)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'pending')
        """, (data['title'], data['authors'], data['abstract'],
              data.get('source_url'), data.get('source_type','manual'),
              data['domain'], data['year'], session['user_id']))
        paper_id = cur.lastrowid
        # Auto-generate a mock summary for demo
        summary  = f"This paper by {data['authors']} explores {data['domain']}. " \
                   f"{data['abstract'][:200]}..."
        cur.execute("""
            INSERT INTO summaries (paper_id, summary_type, summary_text, model_used, rouge_score, bert_score, generated_by)
            VALUES (%s,'abstractive',%s,'GPT-4',%s,%s,%s)
        """, (paper_id, summary, round(0.65+0.1*hash(data['title'])%10/100,2),
              round(0.80+0.1*hash(data['authors'])%10/100,2), session['user_id']))
        # Extract keywords from title
        stop = {'a','an','the','of','in','for','with','and','or','to','is','are','by','on','at'}
        words = [w.lower() for w in re.findall(r'\b[A-Za-z]{4,}\b', data['title']) if w.lower() not in stop]
        for w in words[:5]:
            cur.execute("INSERT INTO keywords (paper_id, keyword, weight) VALUES (%s,%s,0.9)", (paper_id, w.title()))
        cur.execute("UPDATE papers SET status='summarized' WHERE id=%s", (paper_id,))
        db.commit(); cur.close(); db.close()
        return jsonify({'message': 'Paper added and summarized', 'paper_id': paper_id}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─── Stats ────────────────────────────────────────────────────
@app.route('/api/stats', methods=['GET'])
def get_stats():
    try:
        db  = get_db()
        cur = db.cursor(dictionary=True)
        cur.execute("SELECT COUNT(*) AS total_papers  FROM papers WHERE status='summarized'")
        total_papers = cur.fetchone()['total_papers']
        cur.execute("SELECT COUNT(*) AS total_summaries FROM summaries")
        total_summaries = cur.fetchone()['total_summaries']
        cur.execute("SELECT COUNT(*) AS total_users FROM users")
        total_users = cur.fetchone()['total_users']
        cur.execute("SELECT AVG(rouge_score) AS avg_rouge, AVG(bert_score) AS avg_bert FROM summaries")
        scores = cur.fetchone()
        cur.execute("SELECT domain, COUNT(*) AS cnt FROM papers GROUP BY domain ORDER BY cnt DESC LIMIT 6")
        domains = cur.fetchall()
        cur.execute("SELECT model_used, COUNT(*) AS cnt FROM summaries GROUP BY model_used")
        models = cur.fetchall()
        cur.execute("SELECT year, COUNT(*) AS cnt FROM papers GROUP BY year ORDER BY year")
        yearly = cur.fetchall()
        cur.close(); db.close()
        return jsonify({
            'total_papers':    total_papers,
            'total_summaries': total_summaries,
            'total_users':     total_users,
            'avg_rouge':       round(float(scores['avg_rouge'] or 0), 3),
            'avg_bert':        round(float(scores['avg_bert']  or 0), 3),
            'domains':         domains,
            'models':          models,
            'yearly':          yearly
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─── Feedback ────────────────────────────────────────────────
@app.route('/api/feedback', methods=['POST'])
def submit_feedback():
    data       = request.get_json()
    summary_id = data.get('summary_id')
    rating     = data.get('rating')
    comment    = data.get('comment','')
    user_id    = session.get('user_id')
    if not summary_id or not rating:
        return jsonify({'error': 'summary_id and rating required'}), 400
    try:
        db  = get_db()
        cur = db.cursor()
        cur.execute(
            "INSERT INTO feedback (summary_id, user_id, rating, comment) VALUES (%s,%s,%s,%s)",
            (summary_id, user_id, rating, comment)
        )
        db.commit(); cur.close(); db.close()
        return jsonify({'message': 'Feedback submitted'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─── Domains list ─────────────────────────────────────────────
@app.route('/api/domains', methods=['GET'])
def get_domains():
    try:
        db  = get_db()
        cur = db.cursor(dictionary=True)
        cur.execute("SELECT DISTINCT domain FROM papers WHERE domain IS NOT NULL ORDER BY domain")
        domains = [r['domain'] for r in cur.fetchall()]
        cur.close(); db.close()
        return jsonify(domains)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)
