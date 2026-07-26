from collections import Counter
from typing import Dict, List


def aggregate_theme_codes(cluster: Dict, chunks_map: Dict[int, Dict]) -> Dict:
    """Aggregate codes and indicators for a cluster and rank them.

    - Merge repeated codes
    - Rank by frequency
    - Produce explainable weighting using indicator frequency
    """
    codes = []
    indicators = []
    semantic_relations = []

    for cid in cluster.get('chunks', []):
        ch = chunks_map.get(cid)
        if not ch:
            continue
        for sc in ch.get('codes', []):
            codes.append(sc.get('code'))
        for k, v in (ch.get('indicators') or {}).items():
            if v:
                indicators.append(k)
        if ch.get('semantic_relation'):
            semantic_relations.append(ch.get('semantic_relation'))

    code_counts = Counter(codes)
    indicator_counts = Counter(indicators)

    aggregated = {
        'aggregated_codes': [c for c, _ in code_counts.most_common()],
        'dominant_indicators': [i for i, _ in indicator_counts.most_common()],
        'representative_relations': semantic_relations[:3]
    }

    # weighted score example
    aggregated['score'] = min(1.0, 0.1 + 0.2 * len(aggregated['aggregated_codes']) + 0.1 * len(aggregated['dominant_indicators']))

    # theme label composed of top indicators and top code
    top_code = aggregated['aggregated_codes'][0] if aggregated['aggregated_codes'] else None
    top_inds = aggregated['dominant_indicators'][:2]
    theme_parts = [p for p in (top_code, ) + tuple(top_inds) if p]
    aggregated['theme_label'] = ' - '.join(theme_parts) if theme_parts else 'tema'

    return aggregated
