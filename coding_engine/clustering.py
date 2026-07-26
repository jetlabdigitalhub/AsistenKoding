from typing import List, Dict
from collections import Counter, defaultdict
import math


def _jaccard(a: set, b: set) -> float:
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def cluster_related_chunks(chunks: List[Dict], threshold: float = 0.25) -> List[Dict]:
    """Group chunks into explainable clusters using lexical and indicator overlap.

    Rules:
    - Use indicator category overlap (Jaccard)
    - Use suggested codes overlap (if present)
    - Use adjacency: boost similarity for neighboring chunks
    - Greedy assignment for deterministic behavior
    """
    clusters = []

    for c in chunks:
        ind_keys = set(k for k, v in (c.get('indicators') or {}).items() if v)
        code_keys = set()
        for sc in c.get('codes') or []:
            code_keys.add(sc.get('code'))

        assigned = False
        best_score = 0.0
        best_cluster = None

        for cl in clusters:
            # compute indicator overlap
            cl_ind = set(cl.get('dominant_indicators', []))
            ind_sim = _jaccard(ind_keys, cl_ind)

            # code overlap
            cl_codes = set(cl.get('aggregated_codes', []))
            code_sim = _jaccard(code_keys, cl_codes)

            # adjacency boost
            adj_boost = 0.0
            if cl['chunks'] and (c.get('previous_chunk') in cl['chunks'] or c.get('next_chunk') in cl['chunks']):
                adj_boost = 0.15

            score = 0.6 * ind_sim + 0.3 * code_sim + adj_boost

            if score > best_score:
                best_score = score
                best_cluster = cl

        if best_score >= threshold and best_cluster is not None:
            best_cluster['chunks'].append(c['chunk_id'])
            # update cluster stats
            for k, v in (c.get('indicators') or {}).items():
                if v:
                    best_cluster['dominant_indicators'].append(k)
            for sc in c.get('codes') or []:
                best_cluster['aggregated_codes'].append(sc.get('code'))
            # update confidence
            best_cluster['confidence'] = min(1.0, best_cluster.get('confidence', 0.5) + 0.05)
            assigned = True

        if not assigned:
            # create new cluster
            cl = {
                'cluster_id': len(clusters) + 1,
                'theme': None,
                'chunks': [c['chunk_id']],
                'dominant_indicators': list(ind_keys),
                'aggregated_codes': list(code_keys),
                'confidence': 0.6
            }
            clusters.append(cl)

    # finalize clusters: deduplicate dominant indicators and aggregated codes and rank
    for cl in clusters:
        di = [d for d in cl.get('dominant_indicators', [])]
        counts = Counter(di)
        # sort by frequency
        cl['dominant_indicators'] = [k for k, _ in counts.most_common()]

        ac = [a for a in cl.get('aggregated_codes', [])]
        ac_counts = Counter(ac)
        cl['aggregated_codes'] = [k for k, _ in ac_counts.most_common()]

        # generate a short theme label from top indicators
        if cl['dominant_indicators']:
            cl['theme'] = ' '.join(cl['dominant_indicators'][:2])
        else:
            cl['theme'] = 'tema_umum'

    return clusters
