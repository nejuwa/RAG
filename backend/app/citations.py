import re


def keep_cited_sentences(answer: str, allowed_labels: set[str]) -> tuple[str, list[str]]:
    sentences = re.split(r"(?<=[.!?])\s+|\r?\n+", answer.strip())
    kept: list[str] = []
    cited_labels: list[str] = []
    for sentence in sentences:
        labels = re.findall(r"\[(S\d+)\]", sentence)
        valid = [label for label in labels if label in allowed_labels]
        if not valid:
            continue
        cleaned = re.sub(
            r"\[(S\d+)\]",
            lambda match: match.group(0) if match.group(1) in allowed_labels else "",
            sentence,
        ).strip()
        if cleaned:
            kept.append(cleaned)
            for label in valid:
                if label not in cited_labels:
                    cited_labels.append(label)
    return "\n".join(kept), cited_labels
