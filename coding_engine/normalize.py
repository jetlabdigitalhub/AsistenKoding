import re

def normalize_transcript(text: str) -> str:
    """Clean transcript text while preserving paragraphs and punctuation.

    - Normalize line endings to \n
    - Collapse excessive blank lines to a single blank line
    - Trim leading/trailing whitespace on lines
    - Collapse multiple spaces to single space (but preserve paragraph breaks)

    Keeps Indonesian characters and punctuation intact.
    """
    if text is None:
        return ""

    # Normalize CRLF/CR to LF
    t = text.replace('\r\n', '\n').replace('\r', '\n')

    # Remove duplicate Unicode non-breaking spaces
    t = t.replace('\u00A0', ' ')

    # Split into lines and trim
    lines = [re.sub(r"\s+", ' ', ln).strip() for ln in t.split('\n')]

    # Reconstruct preserving paragraph breaks (empty lines)
    out_lines = []
    prev_empty = False
    for ln in lines:
        if ln == '':
            if not prev_empty:
                out_lines.append('')
            prev_empty = True
        else:
            out_lines.append(ln)
            prev_empty = False

    # Join and ensure only single trailing newline
    cleaned = '\n'.join(out_lines).strip() + '\n'

    return cleaned
