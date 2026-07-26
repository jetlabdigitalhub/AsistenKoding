import time
import re
from collections import Counter, defaultdict

# Lightweight deterministic assertion engine using semantic templates

TEMPLATES = {
    'process': "Partisipan mengalami {X} yang mendorong munculnya {Y} sebagai bentuk adaptasi terhadap {Z}.",
    'causality': "Motivasi terhadap {X} memengaruhi bagaimana partisipan melakukan {Y} dalam konteks {Z}.",
    'transformation': "Interaksi antara {X} dan {Y} menunjukkan perubahan dalam {Z}.",
    'relational': "{X} dan {Y} saling berkaitan dalam membentuk pengalaman {Z}.",
    'contradiction': "Meskipun {X} muncul secara dominan, beberapa partisipan menunjukkan {Y}."
}

KEYWORD_MAP = {
    'process': ['adaptasi', 'solusi', 'hambat', 'hambatan', 'adapt', 'solusi'],
    'causality': ['motivasi', 'tindakan', 'hasil', 'pengaruh', 'mempengaruhi'],
    'transformation': ['perubahan', 'transformasi', 'konflik', 'dukungan'],
    'relational': ['hubungan', 'kait', 'keterkaitan'],
    'contradiction': ['meskipun', 'namun', 'tetapi']
}


def _normalize_code_text(s):
    return re.sub(r"[^0-9a-zA-Z\-\s]+", '', (s or '').lower()).strip()


def _select_terms(codes_counter):
    # choose top 3 distinctive codes as X, Y, Z
    most = [c for c, _ in codes_counter.most_common(5)]
    X = most[0] if len(most) > 0 else ''
    Y = most[1] if len(most) > 1 else (most[0] if most else '')
    Z = most[2] if len(most) > 2 else (most[1] if len(most) > 1 else X)
    return X, Y, Z


def detect_generation_type(codes):
    # deterministic keyword matching across selected codes
    counts = Counter()
    for c in codes:
        txt = _normalize_code_text(c.get('code',''))
        for g, kws in KEYWORD_MAP.items():
            for kw in kws:
                if kw in txt:
                    counts[g] += 1
    if not counts:
        return 'relational'
    # pick most frequent matched generation type
    return counts.most_common(1)[0][0]


def generate_codeweaving_assertion(selected_codes, mode='auto'):
    """
    selected_codes: list of dicts with keys: code, chunk_id, speaker, indicator, semantic
    Returns deterministic assertion dict with metadata.
    """
    if not selected_codes:
        return {'error': 'no codes selected'}

    # basic counts and metadata
    codes = [c.get('code','').strip() for c in selected_codes if c.get('code')]
    codes_counter = Counter(codes)
    source_chunks = list({c.get('chunk_id') for c in selected_codes if c.get('chunk_id')})
    speaker_dist = defaultdict(int)
    for c in selected_codes:
        speaker_dist[c.get('speaker') or 'unknown'] += 1

    # decide generation type
    gen_type = detect_generation_type(selected_codes) if mode == 'auto' else mode

    # select terms for template
    X, Y, Z = _select_terms(codes_counter)

    template = TEMPLATES.get(gen_type, TEMPLATES['relational'])
    # fill placeholders deterministically
    assertion_text = template.format(X=X, Y=Y, Z=Z)

    # build traceable metadata
    assertion_id = str(int(time.time() * 1000))
    metadata = {
        'assertion_id': assertion_id,
        'assertion_text': assertion_text,
        'codes_used': list(dict.fromkeys(codes)),
        'source_chunks': [s for s in source_chunks if s is not None],
        'clusters': [],
        'speaker_distribution': dict(speaker_dist),
        'generation_type': gen_type,
        'template_used': gen_type
    }

    return metadata
