import re

NEGATION_TERMS = ['tidak', 'bukan', 'malas', 'menolak', 'kesulitan', 'sulit']


def _excerpt(text, length=140):
    if not text:
        return ''
    t = text.strip().replace('\n', ' ')
    return (t[:length] + '...') if len(t) > length else t


def find_supporting_chunks(codes_used, highlights):
    """
    codes_used: list of code strings
    highlights: list of highlight dicts with keys: id, text, codes, speaker, chunk_id, indicator
    Returns list of supporting highlight summaries.
    """
    codes_set = set([c.lower() for c in codes_used])
    results = []
    for h in highlights:
        hcodes = [c.lower() for c in (h.get('codes') or [])]
        if any(c in codes_set for c in hcodes):
            results.append({
                'highlight_id': h.get('id'),
                'chunk_id': h.get('chunk_id'),
                'excerpt': _excerpt(h.get('text','')),
                'speaker': h.get('speaker'),
                'indicators': h.get('indicator') or h.get('indicators') or []
            })
    return results


def find_disconfirming_chunks(assertion, highlights):
    """
    Find highlights that contain negation terms or explicit disagreement relative to assertion.
    """
    text = assertion.get('assertion_text','').lower()
    codes_used = [c.lower() for c in assertion.get('codes_used',[])]
    results = []
    for h in highlights:
        ht = (h.get('text') or '').lower()
        # negation heuristic
        neg = any(nt in ht for nt in NEGATION_TERMS)
        # conflicting codes heuristic: same codes used but negative language
        hcodes = [c.lower() for c in (h.get('codes') or [])]
        if neg and (set(hcodes) & set(codes_used)):
            results.append({
                'highlight_id': h.get('id'),
                'chunk_id': h.get('chunk_id'),
                'excerpt': _excerpt(h.get('text','')),
                'speaker': h.get('speaker'),
                'indicators': h.get('indicator') or h.get('indicators') or []
            })
    return results
