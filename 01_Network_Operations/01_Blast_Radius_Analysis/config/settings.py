"""
Configuration settings for Blast Radius Analysis system.
"""

# Network Analysis Settings
NETWORK_ANALYSIS = {
    'max_cascade_depth': 5,
    'failure_probability_threshold': 0.3,
    'redundancy_weight': 0.4,
    'criticality_weight': 0.6,
}

# ML Model Settings
ML_MODELS = {
    'logistic_regression': {
        'learning_rate': 0.1,
        'max_iterations': 500,
        'regularization': 'L2',
    },
    'decision_tree': {
        'max_depth': 6,
        'min_samples_split': 5,
        'splitting_criterion': 'information_gain',
    },
}

# Risk Assessment
RISK_ASSESSMENT = {
    'ensemble_lr_weight': 0.7,
    'ensemble_tree_weight': 0.3,
    'risk_thresholds': {
        'low': 0.25,
        'medium': 0.50,
        'high': 0.75,
        'critical': 1.0,
    },
}

# RAG Engine
RAG_ENGINE = {
    'vectorizer': 'tfidf',
    'top_k_retrieval': 3,
    'min_relevance': 0.2,
}

# LLM Configuration
LLM_CONFIG = {
    'model': 'gpt-3.5-turbo',
    'temperature': 0.7,
    'max_tokens': 500,
    'use_simulation': True,  # Use simulation if API not available
}

# Logging
LOGGING = {
    'level': 'INFO',
    'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    'file': 'blast_radius.log',
}
