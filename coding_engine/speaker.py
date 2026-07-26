import re
from typing import Dict

QUESTION_WORDS_ID = [
    'apa', 'mengapa', 'kenapa', 'bagaimana', 'kapan', 'dimana', 'di mana', 'siapa', 'kenapa'
]


def detect_speaker(line: str) -> Dict:
    """Detect likely speaker for a single line.

    Returns dict: {"speaker": 'participant'|'interviewer'|'unknown', 'confidence': float}

    Heuristics used:
    - Explicit label at start -> high confidence
    - Presence of question markers or interrogative words -> interviewer
    - Long narrative (lengthy sentence) -> participant
    - Fallback unknown
    """
    if not line:
        return {"speaker": "unknown", "confidence": 0.0}

    ln = line.strip()

    # explicit speaker label patterns
    label_patterns = [
        r'^(interviewer|wawancara|penanya)\b[:\-]?',
        r'^(participant|partisipan|respondent|peserta)\b[:\-]?',
        r'^(i|q|a|p)\d?[:\-]\s',
        r'^[A-Z]{1,4}\s?:',
        r'^nama[:\-]',
        r'^(p\d+|i\d+)[:\-]'
    ]

    for pat in label_patterns:
        if re.match(pat, ln, flags=re.IGNORECASE):
            # crude mapping
            lab = re.match(pat, ln, flags=re.IGNORECASE).group(0).lower()
            if 'interviewer' in lab or 'i' == lab.strip() or lab.startswith('q'):
                return {"speaker": "interviewer", "confidence": 0.95}
            if 'participant' in lab or 'p' == lab.strip() or 'respondent' in lab:
                return {"speaker": "participant", "confidence": 0.95}
            # fallback
            return {"speaker": "unknown", "confidence": 0.6}

    # detect inline label like 'I:' or 'P:' at beginning
    if re.match(r'^[A-Za-z]{1,4}\s?:', ln):
        # ambiguous but often interviewer if short question
        return {"speaker": "interviewer", "confidence": 0.8}

    # question heuristics
    if '?' in ln or any(q + ' ' in ln.lower() or ln.lower().startswith(q + ' ') for q in QUESTION_WORDS_ID):
        return {"speaker": "interviewer", "confidence": 0.7}

    # long narrative heuristics
    if len(ln) > 100 or ln.count(',') + ln.count('.') > 1:
        return {"speaker": "participant", "confidence": 0.7}

    return {"speaker": "unknown", "confidence": 0.5}
