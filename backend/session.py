import uuid
from functools import wraps
from flask import request, jsonify, g


def get_session_id():
    session_id = request.headers.get('X-Session-ID', '')
    if not isinstance(session_id, str):
        return None
    session_id = session_id.strip()
    if not session_id:
        return None
    try:
        uuid.UUID(session_id)
    except Exception:
        return None
    return session_id


def require_session(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        session_id = get_session_id()
        if not session_id:
            return jsonify({'error': 'Missing or invalid X-Session-ID header'}), 400
        g.session_id = session_id
        return func(*args, **kwargs)
    return wrapper
