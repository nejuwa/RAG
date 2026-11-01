import re
from pathlib import Path

from bs4 import BeautifulSoup
from docx import Document
from pypdf import PdfReader

from app.chunking import TextBlock
from app.settings import settings


def parse_file(path: Path, filename: str) -> list[TextBlock]:
    suffix = Path(filename).suffix.lower()
    if suffix == ".pdf":
        reader = PdfReader(str(path))
        if len(reader.pages) > settings.max_pdf_pages:
            raise ValueError("This PDF has more pages than the configured limit.")
        return [
            TextBlock(text=page.extract_text() or "", page_number=index)
            for index, page in enumerate(reader.pages, start=1)
        ]
    if suffix == ".docx":
        document = Document(str(path))
        blocks: list[TextBlock] = []
        current_heading: str | None = None
        for paragraph in document.paragraphs:
            text = paragraph.text.strip()
            if not text:
                continue
            style = paragraph.style.name if paragraph.style else ""
            if style.lower().startswith("heading"):
                current_heading = text
            blocks.append(TextBlock(text, section_path=current_heading))
        for table in document.tables:
            for row in table.rows:
                cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                if cells:
                    blocks.append(TextBlock(" | ".join(cells), section_path=current_heading))
        return blocks
    if suffix in {".txt", ".md", ".markdown"}:
        return _parse_plain_text(path.read_text(encoding="utf-8-sig"))
    raise ValueError("This file type is not supported.")


def parse_html(content: bytes) -> tuple[str, str, str | None]:
    soup = BeautifulSoup(content, "html.parser")
    title = soup.title.get_text(" ", strip=True) if soup.title else "Web page"
    canonical_tag = soup.find("link", rel=lambda rel: rel and "canonical" in rel)
    canonical = canonical_tag.get("href") if canonical_tag else None
    for node in soup(["script", "style", "noscript", "svg", "nav", "footer", "header"]):
        node.decompose()
    content_root = soup.find("main") or soup.find("article") or soup.body or soup
    lines: list[str] = []
    for node in content_root.find_all(["h1", "h2", "h3", "h4", "p", "li", "blockquote"]):
        text = node.get_text(" ", strip=True)
        if text:
            lines.append(text)
    if not lines:
        text = content_root.get_text("\n", strip=True)
        lines.extend(line.strip() for line in text.splitlines() if line.strip())
    return title[:500], "\n\n".join(lines), canonical


def _parse_plain_text(content: str) -> list[TextBlock]:
    blocks: list[TextBlock] = []
    current_heading: str | None = None
    for paragraph in re.split(r"\n\s*\n", content.replace("\r\n", "\n")):
        text = paragraph.strip()
        if not text:
            continue
        heading = re.match(r"^#{1,6}\s+(.+)$", text)
        if heading:
            current_heading = heading.group(1).strip()
        blocks.append(TextBlock(text, section_path=current_heading))
    return blocks
