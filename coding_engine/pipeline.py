from typing import Dict, Any
from .normalize import normalize_transcript
from .chunker import segment_chunks
from .clustering import cluster_related_chunks
from .aggregator import aggregate_theme_codes
from .memory import strengthen_discourse_memory

try:
    from workspace import semantic_annotation as sem
except Exception:
    # try direct import
    try:
        import workspace.semantic_annotation as sem
    except Exception:
        sem = None


def _safe_detect_indicators(text: str):
    if sem and hasattr(sem, 'detect_indicators'):
        return sem.detect_indicators(text)
    return {}


def _safe_generate_semantic(indicators, text: str):
    if sem and hasattr(sem, 'generate_semantic_relationship'):
        return sem.generate_semantic_relationship(indicators, text)
    return {}


def _safe_suggest_codes(indicators):
    if sem and hasattr(sem, 'suggest_codes'):
        return sem.suggest_codes(indicators)
    return []


def process_transcript(raw_text: str) -> Dict[str, Any]:
    """Full pipeline : normalize -> speaker detect -> chunk -> indicators -> semantic relation -> suggest codes -> cluster -> aggregate

    Returns JSON-ready dict with chunks, clusters, global_themes, speaker_summary
    """
    norm = normalize_transcript(raw_text)

    chunks = segment_chunks(norm)

    # attach semantic outputs per chunk
    chunks_map = {}
    speaker_counts = {}
    for ch in chunks:
        text = ch.get('text', '')
        indicators = ch.get('indicators') or _safe_detect_indicators(text)
        semantic = _safe_generate_semantic(indicators, text)
        codes = _safe_suggest_codes(indicators)

        ch['indicators'] = indicators
        ch['semantic_relation'] = semantic
        ch['codes'] = codes

        # simple confidence: combine speaker detection and indicator presence
        sp = ch.get('speaker', 'unknown')
        speaker_counts[sp] = speaker_counts.get(sp, 0) + 1

        chunks_map[ch['chunk_id']] = ch

    # clustering
    clusters = cluster_related_chunks(chunks)

    # aggregate theme codes
    global_themes = []
    for cl in clusters:
        aggregated = aggregate_theme_codes(cl, chunks_map)
        cl.update(aggregated)
        global_themes.append({'cluster_id': cl['cluster_id'], 'theme': cl.get('theme_label'), 'confidence': cl.get('score', cl.get('confidence'))})

    # discourse memory adjustments
    clusters = strengthen_discourse_memory(clusters, chunks_map)

    # speaker summary
    speaker_summary = {
        'counts': speaker_counts,
        'dominant': max(speaker_counts.items(), key=lambda x: x[1])[0] if speaker_counts else None
    }

    return {
        'chunks': chunks,
        'clusters': clusters,
        'global_themes': global_themes,
        'speaker_summary': speaker_summary
    }
