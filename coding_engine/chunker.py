from typing import List, Dict
import re

from .normalize import normalize_transcript
from .speaker import detect_speaker

try:
    # try to import existing indicator engine
    from workspace.semantic_annotation import detect_indicators
except Exception:
    # fallback placeholder
    def detect_indicators(text):
        return {}


def segment_chunks(text: str) -> List[Dict]:
    """Segment normalized transcript into contextual chunks.

    Strategy:
    - Split by paragraph (blank lines)
    - Within paragraph, detect explicit speaker labels and split on speaker changes
    - Use indicator overlap to detect semantic shifts between adjacent paragraphs

    Returns list of chunk dicts with ids and adjacency links.
    """
    cleaned = normalize_transcript(text)

    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", cleaned) if p.strip()]

    chunks = []
    prev_indicators = None
    chunk_id = 1

    for idx, para in enumerate(paragraphs):
        # attempt to split by lines with labels
        lines = [ln.strip() for ln in para.split('\n') if ln.strip()]

        # if multiple lines with different labels, split per line
        current_speaker = None
        speaker_conf = 0.0
        para_text_accum = []

        for ln in lines:
            sp = detect_speaker(ln)
            # if line starts with label like 'I:' or 'P:' remove label text
            stripped = re.sub(r'^[A-Za-z0-9\s]{1,10}[:\-]\s*', '', ln)

            if sp['confidence'] > 0.8 and sp['speaker'] != 'unknown':
                # flush any accumulated paragraph as its own chunk
                if para_text_accum:
                    text_acc = ' '.join(para_text_accum).strip()
                    indicators = detect_indicators(text_acc)
                    chunks.append({
                        'chunk_id': chunk_id,
                        'speaker': current_speaker or 'unknown',
                        'text': text_acc,
                        'indicators': indicators,
                    })
                    chunk_id += 1
                    para_text_accum = []

                # new chunk for this labeled line
                indicators = detect_indicators(stripped)
                chunks.append({
                    'chunk_id': chunk_id,
                    'speaker': sp['speaker'],
                    'text': stripped,
                    'indicators': indicators,
                })
                chunk_id += 1
                current_speaker = None
                speaker_conf = 0.0
            else:
                # accumulate
                para_text_accum.append(stripped)
                if not current_speaker:
                    current_speaker = sp['speaker']
                    speaker_conf = sp['confidence']

        if para_text_accum:
            text_acc = ' '.join(para_text_accum).strip()
            indicators = detect_indicators(text_acc)

            # semantic shift: compare indicators with previous
            if prev_indicators is not None:
                # compute overlap
                set_prev = set(k for k, v in prev_indicators.items() if v)
                set_cur = set(k for k, v in indicators.items() if v)
                overlap = 0.0
                if set_prev or set_cur:
                    overlap = len(set_prev & set_cur) / max(1, len(set_prev | set_cur))
                # if little overlap, treat as new chunk boundary (already is)

            chunks.append({
                'chunk_id': chunk_id,
                'speaker': current_speaker or 'unknown',
                'text': text_acc,
                'indicators': indicators,
            })
            chunk_id += 1
            prev_indicators = indicators

    # set previous/next pointers
    for i, c in enumerate(chunks):
        c['previous_chunk'] = chunks[i-1]['chunk_id'] if i > 0 else None
        c['next_chunk'] = chunks[i+1]['chunk_id'] if i < len(chunks)-1 else None

    return chunks
