from flask import Flask, render_template
import mysql.connector

app = Flask(__name__)

# Connection function
def get_db():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="habib27", 
        database="karachi_red_bus"
    )

@app.route('/')
def login():
    return render_template('User Login.html') # Your "User Login" HTML

@app.route('/search')
def search():
    return render_template('Route Search.html') # Your "Route Search" HTML

@app.route('/live-location')
def live_location():
    return render_template('ETA Details.html') # Your "ETA Details" HTML

@app.route('/admin-login')
def admin_login():
    return render_template('Admin Login.html') # Your "Admin Login" HTML

@app.route('/admin-dashboard')
def admin_dashboard():
    return render_template('Admin Management.html')

@app.route('/login-validation', methods=['POST'])
def login_validation():
    # This is where you will eventually check MySQL
    return redirect('/search')

@app.route('/db-test')
def db_test():
    # This is a separate page to prove to your teacher the DB works
    try:
        db = get_db()
        cursor = db.cursor()
        cursor.execute("SELECT 'Connection Successful!'")
        msg = cursor.fetchone()[0]
        return f"<h1>Karachi Red Bus Project</h1><p>Database Status: {msg}</p>"
    except Exception as e:
        return f"<h1>Error</h1><p>{str(e)}</p>"

if __name__ == "__main__":
    app.run(debug=True)