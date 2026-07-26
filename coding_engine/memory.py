from typing import Dict, List


def strengthen_discourse_memory(clusters: List[Dict], chunks_map: Dict[int, Dict]) -> List[Dict]:
    """Apply lightweight discourse continuity: strengthen clusters where adjacent
    chunks share indicators or codes.
    """
    for cl in clusters:
        boost = 0.0
        for cid in cl.get('chunks', []):
            ch = chunks_map.get(cid)
            if not ch:
                continue
            # check neighbors
            prev_id = ch.get('previous_chunk')
            next_id = ch.get('next_chunk')
            for nb in (prev_id, next_id):
                if not nb:
                    continue
                nbch = chunks_map.get(nb)
                if not nbch:
                    continue
                # shared indicators
                si = set(k for k, v in (ch.get('indicators') or {}).items() if v) & set(k for k, v in (nbch.get('indicators') or {}).items() if v)
                if si:
                    boost += 0.05 * len(si)
                # shared codes
                sc = set(x.get('code') for x in ch.get('codes', [])) & set(x.get('code') for x in nbch.get('codes', []))
                if sc:
                    boost += 0.05 * len(sc)
        cl['confidence'] = min(1.0, cl.get('confidence', 0.5) + boost)
    return clusters
