import hmac
import hashlib
import os
from flask import Flask, request, abort

app = Flask(__name__)

WEBHOOK_SECRET = os.environ.get("GITHUB_WEBHOOK_SECRET", "your_secret_here").encode()
TARGET_EXTENSIONS = (".py", ".js", ".yml")


def verify_signature(payload: bytes, signature: str) -> bool:
    if not signature or not signature.startswith("sha256="):
        return False
    expected = "sha256=" + hmac.new(
        WEBHOOK_SECRET, payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def is_target_file(path: str) -> bool:
    return path.lower().endswith(TARGET_EXTENSIONS)


@app.route("/webhook", methods=["POST"])
def webhook():
    signature = request.headers.get("X-Hub-Signature-256", "")
    if not verify_signature(request.data, signature):
        abort(401, "Invalid signature")

    event = request.headers.get("X-GitHub-Event")
    if event == "ping":
        return {"msg": "pong"}, 200
    if event != "push":
        return {"msg": f"ignored event: {event}"}, 200

    payload = request.get_json()
    ref = payload.get("ref", "")
    if ref != "refs/heads/main":
        return {"msg": f"ignored branch: {ref}"}, 200

    added, modified = [], []
    for commit in payload.get("commits", []):
        added.extend(commit.get("added", []))
        modified.extend(commit.get("modified", []))

    new_files = [f for f in added if is_target_file(f)]
    changed_files = [f for f in modified if is_target_file(f)]

    if not new_files and not changed_files:
        return {"msg": "no target files changed"}, 200

    print(f"[+] নতুন ফাইল: {new_files}")
    print(f"[~] পরিবর্তিত ফাইল: {changed_files}")

    from scan import scan_files
    scan_files(new_files + changed_files)

    return {"msg": "scan done", "added": new_files,
            "modified": changed_files}, 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
