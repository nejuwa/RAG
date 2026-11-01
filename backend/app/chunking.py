import re
from dataclasses import dataclass


@dataclass(frozen=True)
class TextBlock:
    text: str
    page_number: int | None = None
    section_path: str | None = None


@dataclass(frozen=True)
class TextChunk:
    text: str
    page_number: int | None
    section_path: str | None


def chunk_blocks(
    blocks: list[TextBlock], max_chars: int = 3200, overlap: int = 400
) -> list[TextChunk]:
    if max_chars <= overlap or overlap < 0:
        raise ValueError("max_chars must be greater than a non-negative overlap.")
    chunks: list[TextChunk] = []
    current: list[TextBlock] = []
    current_length = 0

    def emit(items: list[TextBlock]) -> None:
        if not items:
            return
        text = "\n\n".join(block.text.strip() for block in items if block.text.strip())
        if text:
            chunks.append(
                TextChunk(
                    text=text,
                    page_number=items[0].page_number,
                    section_path=items[0].section_path,
                )
            )

    for block in blocks:
        text = re.sub(r"[ \t]+", " ", block.text).strip()
        if not text:
            continue
        if len(text) > max_chars:
            if current:
                emit(current)
                current, current_length = [], 0
            start = 0
            while start < len(text):
                end = min(start + max_chars, len(text))
                if end < len(text):
                    boundary = text.rfind(" ", start, end)
                    if boundary > start:
                        end = boundary
                piece = text[start:end].strip()
                if piece:
                    chunks.append(TextChunk(piece, block.page_number, block.section_path))
                if end >= len(text):
                    break
                start = max(start + 1, end - overlap)
            continue
        if current and current_length + len(text) + 2 > max_chars:
            emit(current)
            overlap_blocks: list[TextBlock] = []
            overlap_length = 0
            for prior in reversed(current):
                if overlap_length + len(prior.text) > overlap:
                    break
                overlap_blocks.insert(0, prior)
                overlap_length += len(prior.text) + 2
            current = overlap_blocks
            current_length = overlap_length
        current.append(TextBlock(text, block.page_number, block.section_path))
        current_length += len(text) + 2
    emit(current)
    return chunks
