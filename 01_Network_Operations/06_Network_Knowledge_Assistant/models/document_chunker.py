"""Document chunking with semantic boundaries and metadata preservation."""
from typing import List, Dict, Tuple
import re


class DocumentChunker:
    """Split documents into overlapping chunks with metadata."""

    def __init__(
        self,
        chunk_size: int = 500,
        overlap: int = 50,
        preserve_sections: bool = True
    ):
        """
        Initialize document chunker.

        Args:
            chunk_size: Target chunk size in tokens
            overlap: Number of tokens to overlap between chunks
            preserve_sections: Try to preserve section boundaries
        """
        self.chunk_size = chunk_size
        self.overlap = overlap
        self.preserve_sections = preserve_sections

    @staticmethod
    def estimate_tokens(text: str) -> int:
        """Rough estimate of token count (words + punctuation)."""
        words = len(text.split())
        return int(words * 1.3)  # Accounting for punctuation

    @staticmethod
    def split_by_sections(text: str) -> List[Tuple[str, str]]:
        """
        Split text by common section headers.

        Returns:
            List of (section_name, section_content) tuples
        """
        # Common section patterns
        patterns = [
            r'^#{1,6}\s+(.+)$',  # Markdown headers
            r'^=+\s*\n(.+)\n=+\s*$',  # Underline headers
            r'^-+\s*\n(.+)\n-+\s*$',
            r'^\*\*(.+?)\*\*$',  # Bold headers
            r'^(\d+\.?\s+[A-Z].+?)(?=\n\d+\.|$)',  # Numbered sections
        ]

        sections = []
        current_section = "introduction"
        current_content = []

        for line in text.split('\n'):
            # Check if line is a header
            is_header = False
            for pattern in patterns:
                match = re.search(pattern, line, re.MULTILINE)
                if match:
                    # Save current section
                    if current_content:
                        sections.append((
                            current_section,
                            '\n'.join(current_content)
                        ))
                    current_section = match.group(1) if match.groups() else line.strip()
                    current_content = []
                    is_header = True
                    break

            if not is_header:
                current_content.append(line)

        # Save final section
        if current_content:
            sections.append((current_section, '\n'.join(current_content)))

        return sections

    def chunk(self, text: str, metadata: Dict = None) -> List[Dict]:
        """
        Split document into chunks.

        Args:
            text: Document text
            metadata: Document-level metadata (source, author, etc.)

        Returns:
            List of chunk dicts with metadata
        """
        metadata = metadata or {}
        chunks = []

        if self.preserve_sections:
            sections = self.split_by_sections(text)
        else:
            sections = [("", text)]

        chunk_id = 0

        for section_name, section_text in sections:
            # Split section into words
            words = section_text.split()

            # Create chunks with overlap
            for i in range(0, len(words), self.chunk_size - self.overlap):
                chunk_words = words[i:i + self.chunk_size]

                if not chunk_words:
                    continue

                chunk_text = ' '.join(chunk_words)
                token_count = self.estimate_tokens(chunk_text)

                chunk_metadata = {
                    'chunk_id': chunk_id,
                    'text': chunk_text,
                    'token_count': token_count,
                    'start_word': i,
                    'end_word': min(i + self.chunk_size, len(words)),
                    'section': section_name.strip() if section_name else 'main',
                    **metadata  # Include document metadata
                }

                chunks.append(chunk_metadata)
                chunk_id += 1

        return chunks

    def chunk_with_overlap(
        self,
        text: str,
        metadata: Dict = None
    ) -> List[Dict]:
        """
        Create overlapping chunks with context preservation.

        Args:
            text: Document text
            metadata: Document metadata

        Returns:
            List of overlapping chunks with metadata
        """
        metadata = metadata or {}
        chunks = []
        words = text.split()

        # Ensure overlap doesn't exceed chunk size
        overlap = min(self.overlap, self.chunk_size // 2)

        step = self.chunk_size - overlap
        chunk_id = 0

        for i in range(0, len(words), step):
            # Get chunk window
            start = max(0, i - overlap // 2) if i > 0 else 0
            end = min(start + self.chunk_size, len(words))

            chunk_words = words[start:end]

            if len(chunk_words) < 10:  # Skip very small chunks
                continue

            chunk_text = ' '.join(chunk_words)
            token_count = self.estimate_tokens(chunk_text)

            # Find section by looking for headers near this chunk
            section_context = self._find_section_context(text, start, end)

            chunk_metadata = {
                'chunk_id': chunk_id,
                'text': chunk_text,
                'token_count': token_count,
                'word_start': start,
                'word_end': end,
                'section': section_context,
                'overlap_start': overlap // 2,
                'overlap_end': overlap - (overlap // 2),
                **metadata
            }

            chunks.append(chunk_metadata)
            chunk_id += 1

        return chunks

    @staticmethod
    def _find_section_context(text: str, word_start: int, word_end: int) -> str:
        """Find section name near word range."""
        # Simple approach: look for nearest header-like line
        lines = text.split('\n')
        char_pos = 0
        current_line = 0
        word_count = 0

        for i, line in enumerate(lines):
            word_count += len(line.split())
            if word_count >= word_start:
                current_line = i
                break

        # Search backwards for a header
        for i in range(current_line, max(-1, current_line - 20), -1):
            line = lines[i].strip()
            if line.startswith('#') or line.startswith('=') or line.startswith('-'):
                return line.lstrip('#=-*').strip()
            if len(line) > 0 and line.isupper() and len(line) < 100:
                return line

        return "main"
