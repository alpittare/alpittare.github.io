#!/usr/bin/env python3
"""Network Knowledge Assistant - Complete Production Demo"""

import sys
import os
from pathlib import Path
from typing import List, Dict

# Add project to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# Import all components
from models.tfidf_vectorizer import TFIDFVectorizer
from models.cosine_similarity import CosineSimilaritySearch
from models.document_chunker import DocumentChunker
from models.intent_classifier import IntentClassifier
from data.knowledge_base import get_knowledge_base_documents
from data.cisco_parser import parse_cisco_config
from llm.rag_pipeline import RAGPipeline
from llm.llm_client import LLMClient, ResponseGenerator
from llm.guardrails import OutputGuardrails

# Color codes for output
class Colors:
    HEADER = '\033[95m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    WHITE = '\033[97m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_header(title: str, level: int = 1):
    """Print formatted header."""
    if level == 1:
        print(f"\n{Colors.BOLD}{Colors.HEADER}{'='*80}{Colors.RESET}")
        print(f"{Colors.BOLD}{Colors.HEADER}{title:^80}{Colors.RESET}")
        print(f"{Colors.BOLD}{Colors.HEADER}{'='*80}{Colors.RESET}\n")
    elif level == 2:
        print(f"\n{Colors.BOLD}{Colors.CYAN}{'-'*80}{Colors.RESET}")
        print(f"{Colors.BOLD}{Colors.CYAN}{title}{Colors.RESET}")
        print(f"{Colors.BOLD}{Colors.CYAN}{'-'*80}{Colors.RESET}\n")
    else:
        print(f"\n{Colors.GREEN}» {title}{Colors.RESET}")

def print_section(text: str, color=Colors.WHITE):
    """Print formatted section."""
    print(f"{color}{text}{Colors.RESET}")

def load_cisco_configs() -> Dict[str, Dict]:
    """Load and parse sample Cisco configurations."""
    print_section("Loading Cisco configurations...", Colors.YELLOW)
    configs = {}
    config_files = [
        'data/sample_configs/nexus_9000_core.cfg',
        'data/sample_configs/catalyst_6509_dist.cfg',
    ]
    device_names = {
        'nexus_9000_core.cfg': 'NEXUS-CORE-01',
        'catalyst_6509_dist.cfg': 'CAT6509-DIST-01'
    }
    for config_file in config_files:
        filepath = project_root / config_file
        if filepath.exists():
            with open(filepath, 'r') as f:
                config_text = f.read()
            device_name = device_names[Path(config_file).name]
            parsed = parse_cisco_config(config_text)
            configs[device_name] = parsed
            print_section(
                f"✓ Parsed {device_name}: "
                f"{len(parsed.get('interfaces', {}))} interfaces, "
                f"{len(parsed.get('vlans', {}))} VLANs, "
                f"{len(parsed.get('bgp_neighbors', {}))} BGP neighbors",
                Colors.GREEN
            )
    return configs

def build_knowledge_base() -> List[Dict]:
    """Build searchable knowledge base."""
    print_section("Building knowledge base...", Colors.YELLOW)
    documents = get_knowledge_base_documents()
    chunker = DocumentChunker(chunk_size=500, overlap=50)
    chunked_docs = []
    for doc in documents:
        chunks = chunker.chunk(doc.content, metadata={
            'doc_id': doc.doc_id,
            'title': doc.title,
            'category': doc.category,
            'source': doc.doc_id
        })
        for chunk in chunks:
            chunked_docs.append({
                'doc_id': chunk['doc_id'],
                'title': doc.title,
                'content': chunk['text'],
                'category': doc.category,
                'chunk_id': chunk['chunk_id'],
                'section': chunk['section'],
                'author': doc.author
            })
    print_section(f"✓ Built knowledge base: {len(documents)} documents, "
                  f"{len(chunked_docs)} searchable chunks", Colors.GREEN)
    return chunked_docs

def build_tfidf_index(documents: List[Dict]) -> TFIDFVectorizer:
    """Build TF-IDF index."""
    print_section("Building TF-IDF index...", Colors.YELLOW)
    vectorizer = TFIDFVectorizer(max_features=5000, min_df=1, max_df=0.95)
    doc_texts = [doc['content'] for doc in documents]
    vectorizer.fit(doc_texts)
    print_section(f"✓ TF-IDF index built: {vectorizer.get_vocabulary_size()} terms", Colors.GREEN)
    return vectorizer

def train_intent_classifier() -> IntentClassifier:
    """Train intent classifier."""
    print_section("Training intent classifier...", Colors.YELLOW)
    classifier = IntentClassifier(learning_rate=0.01, iterations=100)
    training_texts = [
        "What devices are connected to NEXUS-CORE-01?",
        "Show me the network topology",
        "What services depend on VLAN 29?",
        "What happens if a link goes down?",
        "Show BGP neighbors on NEXUS-CORE-01",
        "What is the BGP configuration?",
        "List all VLANs and their purposes",
        "Show running-config for interface Eth1/1",
        "What is the IP scheme?",
        "How do I troubleshoot high CPU on a Nexus switch?",
        "What should I do if BGP neighbors are down?",
        "How to diagnose network latency?",
        "What causes broadcast storms?",
        "Why are interfaces going down?",
        "What is the current network capacity?",
        "How much bandwidth is available?",
        "What is the growth forecast?",
        "When should we upgrade the network?",
        "What is VLAN?",
        "Explain Spanning Tree Protocol",
        "What is BGP?",
        "Best practices for network security",
        "How to optimize network performance?",
        "What is network redundancy?",
    ]
    training_labels = [
        0, 0, 0, 0,  # topology
        1, 1, 1, 1, 1,  # config
        2, 2, 2, 2, 2,  # troubleshoot
        3, 3, 3, 3, 3,  # capacity
        4, 4, 4, 4, 4,  # general
    ]
    classifier.train(training_texts, training_labels)
    print_section("✓ Intent classifier trained on 24 examples", Colors.GREEN)
    return classifier

def create_rag_pipeline(vectorizer: TFIDFVectorizer, classifier: IntentClassifier,
                        documents: List[Dict], parsed_configs: Dict) -> RAGPipeline:
    """Create RAG pipeline."""
    print_section("Creating RAG pipeline...", Colors.YELLOW)
    pipeline = RAGPipeline(
        vectorizer=vectorizer,
        intent_classifier=classifier,
        documents=documents,
        parsed_configs=parsed_configs
    )
    print_section("✓ RAG pipeline ready", Colors.GREEN)
    return pipeline

def process_query(pipeline: RAGPipeline, response_generator: ResponseGenerator,
                  query: str, query_num: int = 1) -> Dict:
    """Process a single query through the full pipeline."""
    print_header(f"Query {query_num}: {query}", 2)
    print_section("Processing...", Colors.CYAN)
    rag_result = pipeline.process_query(query, retrieve_k=5, rerank_k=3)
    print_section(f"Intent: {Colors.BOLD}{rag_result['intent']}{Colors.RESET} "
                  f"(confidence: {rag_result['intent_confidence']:.1%})", Colors.CYAN)
    print_section(f"Retrieved: {rag_result['num_sources']} sources", Colors.CYAN)
    response = response_generator.generate_response(rag_result)
    print_header("Answer", 3)
    print_section(response['answer'], Colors.WHITE)
    if response['sources']:
        print_header("Sources & Relevance", 3)
        for i, (source, score) in enumerate(zip(response['sources'], response['relevance_scores']), 1):
            relevance_pct = score * 100
            color = Colors.GREEN if score > 0.7 else Colors.YELLOW if score > 0.4 else Colors.RED
            print_section(
                f"{i}. {source['title']} ({source['doc_id']}) - "
                f"Relevance: {color}{relevance_pct:.0f}%{Colors.RESET}",
                Colors.WHITE
            )
    if 'safety_check' in response:
        safety = response['safety_check']
        if not safety['is_safe']:
            print_header("Security Warning", 3)
            if safety['has_credentials']:
                print_section("⚠ Credentials detected - filtered from response", Colors.RED)
            if safety['has_pii']:
                print_section("⚠ PII detected - filtered from response", Colors.RED)
            if safety['hallucination_risk']:
                print_section("⚠ Potential hallucination detected", Colors.YELLOW)
    return response

def main():
    """Run complete demo."""
    print_header("Network Knowledge Assistant - Full Demo", 1)
    print_header("Stage 1: Load Data and Configs", 1)
    cisco_configs = load_cisco_configs()
    kb_documents = build_knowledge_base()
    print_header("Stage 2: Build Indices and Train Models", 1)
    vectorizer = build_tfidf_index(kb_documents)
    intent_classifier = train_intent_classifier()
    print_header("Stage 3: Initialize RAG Pipeline", 1)
    rag_pipeline = create_rag_pipeline(
        vectorizer,
        intent_classifier,
        kb_documents,
        cisco_configs
    )
    print_header("Stage 4: Initialize LLM and Response Generator", 1)
    print_section("Creating LLM client...", Colors.YELLOW)
    llm_client = LLMClient(model="simulated", temperature=0.7)
    response_generator = ResponseGenerator(llm_client)
    print_section("✓ LLM client ready", Colors.GREEN)
    print_header("Stage 5: Process Example Queries", 1)
    queries = [
        "What services depend on VLAN 29?",
        "Show BGP neighbors on NEXUS-CORE-01",
        "What happens if Ethernet1/1 on NEXUS-CORE-01 goes down?",
        "How do I troubleshoot high CPU on a Nexus switch?",
        "What is the IP scheme for the data center?",
        "Show running-config for interface Ethernet1/1",
        "List all VLANs and their purposes",
        "What changed in the network recently?",
        "How many BGP neighbors does the network have?",
        "What is the STP root bridge for VLAN 100?",
    ]
    results = []
    for i, query in enumerate(queries, 1):
        result = process_query(rag_pipeline, response_generator, query, i)
        results.append(result)
    print_header("Execution Summary", 1)
    intent_distribution = {}
    for result in results:
        intent = result['intent']
        intent_distribution[intent] = intent_distribution.get(intent, 0) + 1
    print_section("Intent Distribution:", Colors.CYAN)
    for intent, count in sorted(intent_distribution.items()):
        pct = (count / len(results)) * 100
        print_section(f"  {intent}: {count} queries ({pct:.0f}%)", Colors.WHITE)
    avg_confidence = sum(r['intent_confidence'] for r in results) / len(results)
    avg_sources = sum(r['num_sources'] for r in results) / len(results)
    print_section(f"\nAverage intent confidence: {avg_confidence:.1%}", Colors.GREEN)
    print_section(f"Average sources per query: {avg_sources:.1f}", Colors.GREEN)
    print_section(f"Total queries processed: {len(results)}", Colors.GREEN)
    print_header("System Metrics", 1)
    print_section(f"Knowledge base size: {len(kb_documents)} chunks from {len(get_knowledge_base_documents())} documents",
                  Colors.CYAN)
    print_section(f"Vocabulary size: {vectorizer.get_vocabulary_size()} terms", Colors.CYAN)
    print_section(f"Cisco devices parsed: {len(cisco_configs)} devices", Colors.CYAN)
    print_section(f"Intent classifier: 5 classes trained on 24 examples", Colors.CYAN)
    print_header("Demo Complete", 1)
    print_section(
        "Network Knowledge Assistant is operational and ready for deployment.",
        Colors.GREEN
    )
    return 0

if __name__ == '__main__':
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Demo interrupted by user{Colors.RESET}")
        sys.exit(1)
    except Exception as e:
        print(f"{Colors.RED}Error: {e}{Colors.RESET}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
