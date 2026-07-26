from .assertion_engine import generate_codeweaving_assertion
from collections import defaultdict
import re


def score_pairwise_relationships(selected_codes):
    """
    Lightweight deterministic relation scoring between codes.
    Returns dict of pair -> score
    """
    codes = [c.get('code','') for c in selected_codes if c.get('code')]
    counts = defaultdict(int)
    for c in codes:
        counts[c] += 1

    pairs = {}
    for i, a in enumerate(codes):
        for b in codes[i+1:]:
            if not a or not b:
                continue
            key = tuple(sorted((a,b)))
            # simple frequency-based score
            f = counts[a] + counts[b]
            # lexical similarity: token overlap ratio
            sa = set(re.findall(r"\w+", a.lower()))
            sb = set(re.findall(r"\w+", b.lower()))
            s = 0.0
            if sa or sb:
                s = len(sa & sb) / max(1, len(sa | sb))
            # positional proximity unknown at this level -> set p=0
            p = 0.0
            alpha, beta, gamma = 0.6, 0.3, 0.1
            score = alpha * f + beta * s + gamma * p
            pairs[key] = score
    return pairs


def generate(selected_codes, mode='auto'):
    # main orchestration: produce assertion + pairwise scores
    assertion = generate_codeweaving_assertion(selected_codes, mode=mode)
    pairs = score_pairwise_relationships(selected_codes)
    assertion['pairwise_scores'] = {f"{a}||{b}": s for (a,b), s in pairs.items()}
    return assertion
