import argparse
import csv
import json
import sys
from pathlib import Path
from typing import Any, Dict, List

# Pastikan modul workspace dapat diimpor saat skrip dijalankan dari folder scripts
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from workspace.semantic_annotation import (  # noqa: E402
    LEXICON,
    detect_indicators,
    generate_semantic_relationship,
    suggest_codes,
)


def _round_metric(value: float) -> float:
    """Bulati metrik ke tiga desimal untuk keluaran yang stabil.

    Args:
        value: Nilai numerik yang akan dibulatkan.

    Returns:
        float: Nilai terbulat dalam rentang 0.000 hingga 1.000.
    """
    return round(float(value), 3)


def compute_indicator_scores(indicators: Dict[str, List[str]]) -> Dict[str, Dict[str, Any]]:
    """Hitung coverage indikator per kategori berdasarkan leksikon.

    Args:
        indicators: Peta kategori ke daftar lexicon yang berhasil terdeteksi.

    Returns:
        Dict[str, Dict[str, Any]]: Struktur dengan jumlah match dan coverage.
    """
    scores: Dict[str, Dict[str, Any]] = {}
    for category, matches in indicators.items():
        lexicon_size = len(LEXICON.get(category, []))
        coverage = 0.0 if lexicon_size == 0 else _round_metric(len(matches) / lexicon_size)
        scores[category] = {
            "matches": len(matches),
            "coverage": coverage,
        }
    return scores


def compute_category_density(indicators: Dict[str, List[str]]) -> float:
    """Hitung density kategori aktif terhadap total kategori leksikon.

    Args:
        indicators: Peta kategori ke daftar lexicon yang berhasil terdeteksi.

    Returns:
        float: Nilai category density dalam rentang 0.000 hingga 1.000.
    """
    total_categories = len(LEXICON)
    active_categories = sum(1 for category in LEXICON if indicators.get(category))
    return _round_metric(active_categories / total_categories if total_categories else 0.0)


def compute_semantic_confidence(indicators: Dict[str, List[str]], semantic: Dict[str, Any]) -> float:
    """Hitung confidence relasi semantik secara rule-based dan explainable.

    Args:
        indicators: Peta kategori ke daftar lexicon yang berhasil terdeteksi.
        semantic: Hasil generate_semantic_relationship.

    Returns:
        float: Nilai semantic confidence dalam rentang 0.000 hingga 1.000.
    """
    category_found = 1.0 if semantic.get("category") and indicators.get(semantic.get("category"), []) else 0.0
    actor_found = 1.0 if any(indicators.get(cat, []) for cat in ("aktor", "identitas", "partisipasi")) else 0.0
    phenomenon_found = 1.0 if any(indicators.get(cat, []) for cat in ("tindakan", "evaluasi", "emosi", "motivasi", "persepsi", "perspektif", "pengalaman", "refleksi")) else 0.0
    context_found = 1.0 if any(indicators.get(cat, []) for cat in ("kausalitas", "hambatan", "solusi", "harapan", "konflik", "lokasi", "waktu", "modalitas", "adaptasi", "norma", "perspektif", "persepsi", "representasi")) else 0.0
    score = (category_found + actor_found + phenomenon_found + context_found) / 4.0
    return _round_metric(score)


def compute_linguistic_indicator_strength(indicator_coverage: float, semantic_confidence: float) -> float:
    """Hitung indeks utama sistem LDIS.

    Args:
        indicator_coverage: Nilai Indicator Coverage.
        semantic_confidence: Nilai Semantic Confidence.

    Returns:
        float: Nilai LIS dalam rentang 0.000 hingga 1.000.
    """
    return _round_metric(0.6 * indicator_coverage + 0.4 * semantic_confidence)


def compute_suggestion_weights(suggestions: List[Dict[str, Any]], indicators: Dict[str, List[str]]) -> List[Dict[str, Any]]:
    """Hitung Suggestion Relevance Score (SRS) berdasarkan lexicon kategori.

    Args:
        suggestions: Daftar suggestion yang dihasilkan oleh suggest_codes.
        indicators: Peta kategori ke daftar lexicon yang berhasil terdeteksi.

    Returns:
        List[Dict[str, Any]]: Daftar suggestion dengan relevance numerik.
    """
    if not suggestions:
        return []

    weighted: List[Dict[str, Any]] = []
    for item in suggestions:
        category = item.get("category")
        matches = len(indicators.get(category, []))
        lexicon_size = len(LEXICON.get(category, []))
        relevance = 0.0 if lexicon_size == 0 else _round_metric(matches / lexicon_size)
        weighted.append(
            {
                "category": category,
                "code": item.get("code"),
                "score": item.get("score", 0),
                "relevance": relevance,
                "weight": relevance,
            }
        )
    return weighted


def prepare_scatter_data(suggestions: List[Dict[str, Any]], indicators: Dict[str, List[str]]) -> List[Dict[str, Any]]:
    """Siapkan dataset untuk visualisasi bubble chart.

    Args:
        suggestions: Daftar suggestion yang sudah diberi relevance.
        indicators: Peta kategori ke daftar lexicon yang berhasil terdeteksi.

    Returns:
        List[Dict[str, Any]]: Dataset siap visualisasi JSON.
    """
    scatter_data: List[Dict[str, Any]] = []
    for item in suggestions:
        category = item.get("category")
        matches = len(indicators.get(category, []))
        scatter_data.append(
            {
                "category": category,
                "code": item.get("code"),
                "x": item.get("relevance", 0.0),
                "y": matches,
                "size": max(10, matches * 12),
            }
        )
    return scatter_data


def compute_metrics(text: str) -> Dict[str, Any]:
    """Kalkulasi metrik evaluasi LDIS untuk teks input.

    Args:
        text: Teks input yang dianalisis.

    Returns:
        Dict[str, Any]: Representasi hasil evaluasi yang siap dipakai sebagai JSON.
    """
    indicators = detect_indicators(text)
    suggestions = suggest_codes(indicators)
    semantic = generate_semantic_relationship(indicators, text)

    indicator_scores = compute_indicator_scores(indicators)
    total_indicator_matches = sum(len(values) for values in indicators.values())
    total_indicators = len(indicators)
    indicator_coverage = _round_metric(
        sum(item["matches"] for item in indicator_scores.values()) / sum(len(LEXICON.get(cat, [])) for cat in LEXICON)
        if sum(len(LEXICON.get(cat, [])) for cat in LEXICON) else 0.0
    )
    category_density = compute_category_density(indicators)
    semantic_confidence = compute_semantic_confidence(indicators, semantic)
    linguistic_indicator_strength = compute_linguistic_indicator_strength(indicator_coverage, semantic_confidence)
    suggestions_with_relevance = compute_suggestion_weights(suggestions, indicators)
    scatter_data = prepare_scatter_data(suggestions_with_relevance, indicators)

    extracted_texts = {category: values for category, values in indicators.items()}
    summary = {
        "indicator_coverage": indicator_coverage,
        "category_density": category_density,
        "semantic_confidence": semantic_confidence,
        "linguistic_indicator_strength": linguistic_indicator_strength,
        "semantic_category": semantic.get("category"),
        "total_categories": total_indicators,
        "total_matches": total_indicator_matches,
        "total_suggestions": len(suggestions),
    }

    return {
        "input_text": text,
        "summary": summary,
        "indicator_scores": indicator_scores,
        "indicator_match_texts": extracted_texts,
        "suggested_codes": suggestions_with_relevance,
        "scatter_data": scatter_data,
        "semantic_relation": semantic.get("semantic_relation"),
        "semantic_category": semantic.get("category"),
        "semantic_variables": {
            "X": semantic.get("X"),
            "Y": semantic.get("Y"),
            "Z": semantic.get("Z"),
        },
        "total_indicators": total_indicators,
        "total_indicator_matches": total_indicator_matches,
        "semantic_relation_score": semantic_confidence,
        "total_suggestions": len(suggestions),
    }


def export_metrics_to_csv(result: Dict[str, Any], output_path: str) -> Path:
    """Ekspor hasil evaluasi ke file CSV yang rapi.

    Args:
        result: Hasil evaluasi dari compute_metrics.
        output_path: Jalur file CSV tujuan.

    Returns:
        Path: Jalur file CSV yang berhasil ditulis.
    """
    requested_path = Path(output_path)
    output = requested_path if requested_path.is_absolute() else (ROOT / requested_path).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    summary = result.get("summary", {})
    semantic_variables = result.get("semantic_variables", {})
    suggestions = result.get("suggested_codes", [])
    scatter_data = result.get("scatter_data", [])

    fieldnames = [
        "input_text",
        "summary_indicator_coverage",
        "summary_category_density",
        "summary_semantic_confidence",
        "summary_linguistic_indicator_strength",
        "semantic_category",
        "semantic_relation",
        "semantic_variable_X",
        "semantic_variable_Y",
        "semantic_variable_Z",
        "total_categories",
        "total_matches",
        "total_suggestions",
        "suggestion_category",
        "suggestion_code",
        "suggestion_relevance",
        "suggestion_score",
        "scatter_x",
        "scatter_y",
        "scatter_size",
    ]

    with output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()

        if not suggestions:
            writer.writerow(
                {
                    "input_text": result.get("input_text", ""),
                    "summary_indicator_coverage": summary.get("indicator_coverage", 0.0),
                    "summary_category_density": summary.get("category_density", 0.0),
                    "summary_semantic_confidence": summary.get("semantic_confidence", 0.0),
                    "summary_linguistic_indicator_strength": summary.get("linguistic_indicator_strength", 0.0),
                    "semantic_category": result.get("semantic_category", ""),
                    "semantic_relation": result.get("semantic_relation", ""),
                    "semantic_variable_X": semantic_variables.get("X", ""),
                    "semantic_variable_Y": semantic_variables.get("Y", ""),
                    "semantic_variable_Z": semantic_variables.get("Z", ""),
                    "total_categories": summary.get("total_categories", 0),
                    "total_matches": summary.get("total_matches", 0),
                    "total_suggestions": summary.get("total_suggestions", 0),
                }
            )
            return output

        for index, suggestion in enumerate(suggestions):
            scatter_item = scatter_data[index] if index < len(scatter_data) else {}
            writer.writerow(
                {
                    "input_text": result.get("input_text", ""),
                    "summary_indicator_coverage": summary.get("indicator_coverage", 0.0),
                    "summary_category_density": summary.get("category_density", 0.0),
                    "summary_semantic_confidence": summary.get("semantic_confidence", 0.0),
                    "summary_linguistic_indicator_strength": summary.get("linguistic_indicator_strength", 0.0),
                    "semantic_category": result.get("semantic_category", ""),
                    "semantic_relation": result.get("semantic_relation", ""),
                    "semantic_variable_X": semantic_variables.get("X", ""),
                    "semantic_variable_Y": semantic_variables.get("Y", ""),
                    "semantic_variable_Z": semantic_variables.get("Z", ""),
                    "total_categories": summary.get("total_categories", 0),
                    "total_matches": summary.get("total_matches", 0),
                    "total_suggestions": summary.get("total_suggestions", 0),
                    "suggestion_category": suggestion.get("category", ""),
                    "suggestion_code": suggestion.get("code", ""),
                    "suggestion_relevance": suggestion.get("relevance", 0.0),
                    "suggestion_score": suggestion.get("score", 0),
                    "scatter_x": scatter_item.get("x", 0.0),
                    "scatter_y": scatter_item.get("y", 0),
                    "scatter_size": scatter_item.get("size", 0),
                }
            )

    return output


def _print_report(result: Dict[str, Any]) -> None:
    """Cetak laporan evaluasi LDIS yang rapi ke konsol."""
    summary = result.get("summary", {})
    print("=========================")
    print("LDIS Evaluation Report")
    print("=========================")
    print()
    print("Indicator Coverage")
    print()
    print(f"{int(round(summary.get('indicator_coverage', 0.0) * 100))}%")
    print()
    print("Category Density")
    print()
    print(f"{int(round(summary.get('category_density', 0.0) * 100))}%")
    print()
    print("Semantic Confidence")
    print()
    print(f"{int(round(summary.get('semantic_confidence', 0.0) * 100))}%")
    print()
    print("Linguistic Indicator Strength")
    print()
    print(f"{int(round(summary.get('linguistic_indicator_strength', 0.0) * 100))}%")
    print()
    print("Semantic Category")
    print()
    print(summary.get("semantic_category", "-"))
    print()
    print("Semantic Relation")
    print()
    print(result.get("semantic_relation", "-"))
    print()
    print("Semantic Variables")
    print()
    for key, value in result.get("semantic_variables", {}).items():
        print(f"{key} : {value}")
    print()
    print("Scatter Dataset")
    print()
    print(json.dumps(result.get("scatter_data", []), ensure_ascii=False, indent=2))
    print()
    print("Suggestion Ranking")
    print()
    for item in result.get("suggested_codes", []):
        print(f"{item['category']} -> {item['code']} | relevance: {item.get('relevance', 0.0)}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Uji code suggestion dan keluarkan hasil numerik untuk teks input."
    )
    parser.add_argument(
        "text",
        nargs="?",
        help="Teks input yang akan dianalisis. Jika tidak ada, akan membaca dari stdin.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Cetak hasil dalam format JSON.",
    )
    parser.add_argument(
        "--csv",
        metavar="PATH",
        help="Ekspor hasil evaluasi ke file CSV pada path yang ditentukan.",
    )
    args = parser.parse_args()

    if args.text:
        text = args.text
    else:
        text = "".join(line for line in iter(input, ""))

    if not text.strip():
        print("Tidak ada teks input. Berikan teks sebagai argumen atau lewat stdin.")
        return

    result = compute_metrics(text)
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        _print_report(result)

    if args.csv:
        export_path = export_metrics_to_csv(result, args.csv)
        print(f"\nCSV exported to: {export_path}")


if __name__ == "__main__":
    main()
