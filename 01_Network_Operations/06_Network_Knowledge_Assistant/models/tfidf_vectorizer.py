"""TF-IDF Vectorizer implementation from scratch using numpy."""
import numpy as np
import json
import re
from collections import defaultdict
from typing import Dict, List, Tuple, Set
from pathlib import Path


class TFIDFVectorizer:
    """TF-IDF vectorizer with vocabulary management and sparse vector support."""

    def __init__(self, max_features=5000, min_df=1, max_df=0.95, lowercase=True):
        """
        Initialize TF-IDF vectorizer.

        Args:
            max_features: Maximum number of features (vocabulary size)
            min_df: Minimum document frequency threshold
            max_df: Maximum document frequency threshold (as fraction)
            lowercase: Convert text to lowercase
        """
        self.max_features = max_features
        self.min_df = min_df
        self.max_df = max_df
        self.lowercase = lowercase

        self.vocabulary = {}  # term -> idx
        self.reverse_vocabulary = {}  # idx -> term
        self.idf = {}  # idx -> idf value
        self.document_freqs = defaultdict(int)  # term -> count

        self.n_documents = 0
        self.is_fitted = False

    def _tokenize(self, text: str) -> List[str]:
        """Tokenize text into words."""
        text = text.lower() if self.lowercase else text
        # Remove special characters, keep alphanumeric and underscores
        text = re.sub(r'[^\w\s\-]', ' ', text)
        tokens = text.split()
        return [t for t in tokens if len(t) > 1]  # Filter single chars

    def fit(self, documents: List[str]) -> 'TFIDFVectorizer':
        """
        Fit the vectorizer to a collection of documents.

        Args:
            documents: List of text documents

        Returns:
            self
        """
        self.n_documents = len(documents)
        vocabulary = defaultdict(int)

        # Build vocabulary and document frequencies
        for doc in documents:
            tokens = set(self._tokenize(doc))  # Unique tokens per document
            for token in tokens:
                self.document_freqs[token] += 1
                vocabulary[token] += 1

        # Filter by min/max document frequency
        max_df_count = int(self.max_df * self.n_documents)
        filtered_vocab = {
            term: count
            for term, count in vocabulary.items()
            if self.min_df <= count <= max_df_count
        }

        # Sort by frequency and limit to max_features
        sorted_vocab = sorted(
            filtered_vocab.items(),
            key=lambda x: x[1],
            reverse=True
        )[:self.max_features]

        # Build vocabulary mapping
        for idx, (term, _) in enumerate(sorted_vocab):
            self.vocabulary[term] = idx
            self.reverse_vocabulary[idx] = term

        # Calculate IDF for each term
        for term, idx in self.vocabulary.items():
            df = self.document_freqs[term]
            self.idf[idx] = np.log(self.n_documents / (1 + df))

        self.is_fitted = True
        return self

    def _get_term_frequency(self, tokens: List[str]) -> Dict[int, float]:
        """Calculate term frequencies for a document."""
        tf_dict = defaultdict(int)
        doc_length = len(tokens)

        if doc_length == 0:
            return {}

        for token in tokens:
            if token in self.vocabulary:
                tf_dict[self.vocabulary[token]] += 1

        # Normalize by document length
        return {
            idx: count / doc_length
            for idx, count in tf_dict.items()
        }

    def transform(self, documents: List[str]) -> np.ndarray:
        """
        Transform documents to TF-IDF vectors.

        Args:
            documents: List of text documents

        Returns:
            Dense matrix of shape (n_documents, n_features)
        """
        if not self.is_fitted:
            raise ValueError("Vectorizer must be fitted before transform")

        n_docs = len(documents)
        vocab_size = len(self.vocabulary)
        matrix = np.zeros((n_docs, vocab_size))

        for doc_idx, doc in enumerate(documents):
            tokens = self._tokenize(doc)
            tf = self._get_term_frequency(tokens)

            for term_idx, tf_value in tf.items():
                idf_value = self.idf.get(term_idx, 0)
                matrix[doc_idx, term_idx] = tf_value * idf_value

        return matrix

    def fit_transform(self, documents: List[str]) -> np.ndarray:
        """Fit to documents and transform in one step."""
        self.fit(documents)
        return self.transform(documents)

    def get_feature_names(self) -> List[str]:
        """Get vocabulary terms in order."""
        if not self.is_fitted:
            raise ValueError("Vectorizer must be fitted first")
        return [self.reverse_vocabulary[i] for i in range(len(self.vocabulary))]

    def get_vocabulary_size(self) -> int:
        """Get vocabulary size."""
        return len(self.vocabulary)

    def save_vocabulary(self, filepath: str):
        """Save vocabulary to JSON file."""
        data = {
            'vocabulary': self.vocabulary,
            'reverse_vocabulary': {str(k): v for k, v in self.reverse_vocabulary.items()},
            'idf': {str(k): float(v) for k, v in self.idf.items()},
            'document_freqs': {k: v for k, v in self.document_freqs.items()},
            'n_documents': self.n_documents,
            'max_features': self.max_features,
            'min_df': self.min_df,
            'max_df': self.max_df
        }

        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)

    def load_vocabulary(self, filepath: str):
        """Load vocabulary from JSON file."""
        with open(filepath, 'r') as f:
            data = json.load(f)

        self.vocabulary = data['vocabulary']
        self.reverse_vocabulary = {int(k): v for k, v in data['reverse_vocabulary'].items()}
        self.idf = {int(k): v for k, v in data['idf'].items()}
        self.document_freqs = defaultdict(int, data['document_freqs'])
        self.n_documents = data['n_documents']
        self.max_features = data['max_features']
        self.min_df = data['min_df']
        self.max_df = data['max_df']
        self.is_fitted = True
