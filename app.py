import os
import requests
from flask import Flask, request, render_template, send_from_directory, abort
import zipfile
import io

app = Flask(__name__)
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# আপনার GitHub Webhook Secret (পরে সেট করবেন)
GITHUB_SECRET = "your_secret_here"

# ১. Webhook রিসিভ করার অংশ (GitHub থেকে ডেটা আসবে)
@app.route('/webhook', methods=['POST'])
def webhook():
    # নিরাপত্তার জন্য সিক্রেট চেক (এখানে সহজ রাখার জন্য বাদ দেওয়া হলো, তবে প্রোডাকশনে দরকার)
    payload = request.json
    
    if 'commits' in payload:
        for commit in payload['commits']:
            files_to_download = commit.get('added', []) + commit.get('modified', [])
            raw_url_base = payload['repository']['html_url'].replace('github.com', 'raw.githubusercontent.com') + '/' + payload['ref'].split('/')[-1] + '/'

            for file_path in files_to_download:
                # গিটহাব থেকে ফাইলটি ডাউনলোড করা
                file_url = raw_url_base + file_path
                response = requests.get(file_url)
                
                if response.status_code == 200:
                    # ফাইলটি সার্ভারে সেভ করা
                    local_path = os.path.join(UPLOAD_FOLDER, file_path)
                    os.makedirs(os.path.dirname(local_path), exist_ok=True)
                    with open(local_path, 'wb') as f:
                        f.write(response.content)
                    print(f"Downloaded: {file_path}")
                    
    return "Webhook Received", 200

# ২. ওয়েবসাইটের হোম পেজ (সার্চ এবং ফাইল লিস্ট)
@app.route('/')
def index():
    search_query = request.args.get('search', '').lower()
    all_files = []
    
    # সার্ভারে জমা থাকা সব ফাইল খোঁজা
    for root, dirs, files in os.walk(UPLOAD_FOLDER):
        for file in files:
            relative_path = os.path.relpath(os.path.join(root, file), UPLOAD_FOLDER)
            if search_query in relative_path.lower():
                all_files.append(relative_path)
                
    return render_template('index.html', files=all_files, search=search_query)

# ৩. একটি একটি করে ফাইল ডাউনলোড করার রুট
@app.route('/download/<path:filename>')
def download_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename, as_attachment=True)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
