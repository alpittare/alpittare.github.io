"""Output guardrails for filtering sensitive content and hallucinations."""
import re
from typing import Tuple


class OutputGuardrails:
    """Filter responses for PII, credentials, and hallucination indicators."""

    CREDENTIAL_PATTERNS = [
        r'password\s*[=:]\s*\S+',
        r'secret\s*[=:]\s*\S+',
        r'api[_-]?key\s*[=:]\s*\S+',
        r'token\s*[=:]\s*\S+',
        r'passwd\s*[=:]\s*\S+',
    ]

    PII_PATTERNS = [
        r'\b\d{3}-\d{2}-\d{4}\b',  # SSN
        r'\b\d{15,16}\b',  # Credit card
        r'\b[A-Z]{2}\d{6,9}\b',  # Passport
    ]

    HALLUCINATION_INDICATORS = [
        'according to my knowledge',
        'i believe',
        'i think',
        'in my opinion',
        'it is likely that',
        'probably',
        'probably means',
        'as far as i know',
    ]

    @staticmethod
    def check_for_credentials(text: str) -> Tuple[bool, str]:
        """
        Check if text contains credential patterns.

        Returns:
            (contains_credentials, sanitized_text)
        """
        sanitized = text
        found = False

        for pattern in OutputGuardrails.CREDENTIAL_PATTERNS:
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                found = True
                # Replace with placeholder
                sanitized = re.sub(
                    pattern,
                    '[CREDENTIALS_FILTERED]',
                    sanitized,
                    flags=re.IGNORECASE
                )

        return found, sanitized

    @staticmethod
    def check_for_pii(text: str) -> Tuple[bool, str]:
        """
        Check if text contains PII.

        Returns:
            (contains_pii, sanitized_text)
        """
        sanitized = text
        found = False

        for pattern in OutputGuardrails.PII_PATTERNS:
            matches = re.findall(pattern, text)
            if matches:
                found = True
                sanitized = re.sub(pattern, '[PII_FILTERED]', sanitized)

        return found, sanitized

    @staticmethod
    def check_for_hallucination(text: str) -> Tuple[bool, list]:
        """
        Check for hallucination indicators.

        Returns:
            (likely_hallucination, confidence_phrases_found)
        """
        indicators_found = []

        for indicator in OutputGuardrails.HALLUCINATION_INDICATORS:
            if indicator.lower() in text.lower():
                indicators_found.append(indicator)

        # More than one uncertainty phrase suggests hallucination
        likely_hallucination = len(indicators_found) > 1

        return likely_hallucination, indicators_found

    @staticmethod
    def filter_response(text: str) -> dict:
        """
        Apply all guardrails to a response.

        Returns:
            {
                'original': original text,
                'filtered': sanitized text,
                'has_credentials': bool,
                'has_pii': bool,
                'hallucination_risk': bool,
                'issues': [list of issues found]
            }
        """
        issues = []
        filtered_text = text

        # Check credentials
        has_creds, filtered_text = OutputGuardrails.check_for_credentials(filtered_text)
        if has_creds:
            issues.append("Credentials detected and filtered")

        # Check PII
        has_pii, filtered_text = OutputGuardrails.check_for_pii(filtered_text)
        if has_pii:
            issues.append("PII detected and filtered")

        # Check hallucination
        hallucination_risk, indicators = OutputGuardrails.check_for_hallucination(filtered_text)
        if hallucination_risk:
            issues.append(f"Potential hallucination detected ({len(indicators)} uncertainty phrases)")

        return {
            'original': text,
            'filtered': filtered_text,
            'has_credentials': has_creds,
            'has_pii': has_pii,
            'hallucination_risk': hallucination_risk,
            'issues': issues,
            'is_safe': len(issues) == 0
        }
