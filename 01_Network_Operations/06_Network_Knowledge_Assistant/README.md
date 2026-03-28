# Network Knowledge Assistant

A production-grade LLM-powered conversational interface for querying network documentation, topology, and configurations. Built entirely from scratch using numpy-based ML models and a complete RAG (Retrieval-Augmented Generation) pipeline.

## Features

### Core Components

1. **TF-IDF Vectorizer** - Custom implementation from scratch using numpy
   - Term frequency calculation
   - Inverse document frequency scoring
   - Vocabulary management (5000 term limit)
   - Sparse and dense vector support

2. **Cosine Similarity Search** - Efficient vector similarity
   - Batch similarity computation
   - Top-K retrieval with threshold filtering
   - Full similarity matrix generation

3. **Document Chunking** - Intelligent document splitting
   - Semantic section preservation
   - Configurable chunk overlap (50 tokens)
   - Metadata attachment (source, section, author)

4. **Intent Classification** - Logistic regression classifier
   - 5 intent classes: topology_query, config_query, troubleshoot, capacity_planning, general
   - Multi-class softmax with numpy
   - 24+ training examples included

5. **RAG Pipeline** - Complete retrieval-augmented generation
   - Document retrieval (TF-IDF)
   - Re-ranking with multiple signals (relevance, category, title match)
   - Context building from top-K documents
   - Device mention extraction

6. **Output Guardrails** - Safety filtering
   - Credential pattern detection
   - PII filtering
   - Hallucination indicators
   - Response sanitization

### Network Knowledge Base

- 12 comprehensive documents covering:
  - Network architecture (spine-and-leaf topology)
  - Configuration standards (VLAN, BGP, ACL conventions)
  - Troubleshooting guides (BGP, high CPU, STP)
  - Operational procedures and runbooks
  - Performance and capacity planning
  - Disaster recovery planning
  - Change history and tracking
  - VLAN configuration and dependencies
  - BGP configuration and peer management
  - Spanning Tree Protocol setup
  - Monitoring and alerting strategy

### Cisco Device Parsing

- Comprehensive Cisco config parser supporting:
  - Interface configuration extraction
  - VLAN parsing and mapping
  - BGP neighbor relationships
  - ACL rule parsing
  - Route configuration
  - Device metadata extraction
  
- Sample configurations included:
  - Nexus 9000 (core layer)
  - Catalyst 6509 (distribution layer)

## Project Structure

```
06_Network_Knowledge_Assistant/
├── run_demo.py                          # 900+ line comprehensive demo
├── requirements.txt                     # Python dependencies
├── README.md                            # This file
│
├── models/                              # ML models (numpy-based)
│   ├── tfidf_vectorizer.py             # TF-IDF implementation
│   ├── cosine_similarity.py            # Vector similarity search
│   ├── document_chunker.py             # Smart document chunking
│   ├── intent_classifier.py            # Logistic regression classifier
│   └── __init__.py
│
├── data/                                # Data and parsing
│   ├── cisco_parser.py                 # Cisco config parser
│   ├── knowledge_base.py               # 12 KB documents
│   ├── sample_configs/
│   │   ├── nexus_9000_core.cfg        # Nexus 9000 sample
│   │   └── catalyst_6509_dist.cfg     # Catalyst 6509 sample
│   └── __init__.py
│
├── llm/                                 # LLM and RAG pipeline
│   ├── rag_pipeline.py                 # RAG orchestration
│   ├── prompt_templates.py             # 8+ prompt templates
│   ├── llm_client.py                   # Response generation
│   ├── guardrails.py                   # Safety filtering
│   └── __init__.py
│
├── docs/                                # Documentation (can be expanded)
├── tests/                               # Unit tests (can be expanded)
├── deployment/                          # Docker/K8s configs (optional)
└── api/                                 # REST API server (can be expanded)
```

## Usage

### Running the Demo

```bash
python run_demo.py
```

This executes:
1. **Stage 1**: Loads Cisco configs and builds knowledge base
   - Parses 2 device configurations
   - Creates 118 searchable chunks from 12 documents

2. **Stage 2**: Builds ML indices and trains models
   - Builds TF-IDF vocabulary (679 terms)
   - Trains intent classifier on 24 examples

3. **Stage 3**: Initializes RAG pipeline
   - Creates document vectors
   - Sets up retrieval system

4. **Stage 4**: Initializes LLM client
   - Simulated LLM with intelligent response generation
   - Safety filtering and guardrails

5. **Stage 5**: Processes 10 example queries
   - Shows intent classification
   - Demonstrates retrieval and re-ranking
   - Displays generated answers with sources

### Example Queries

The demo processes these queries:

1. "What services depend on VLAN 29?" → topology_query
2. "Show BGP neighbors on NEXUS-CORE-01" → config_query
3. "What happens if Ethernet1/1 on NEXUS-CORE-01 goes down?" → troubleshoot
4. "How do I troubleshoot high CPU on a Nexus switch?" → troubleshoot
5. "What is the IP scheme for the data center?" → capacity_planning
6. "Show running-config for interface Ethernet1/1" → config_query
7. "List all VLANs and their purposes" → config_query
8. "What changed in the network recently?" → capacity_planning
9. "How many BGP neighbors does the network have?" → troubleshoot
10. "What is the STP root bridge for VLAN 100?" → troubleshoot

### Programmatic Usage

```python
from models.tfidf_vectorizer import TFIDFVectorizer
from models.intent_classifier import IntentClassifier
from data.knowledge_base import get_knowledge_base_documents
from llm.rag_pipeline import RAGPipeline
from llm.llm_client import ResponseGenerator

# Load knowledge base
documents = get_knowledge_base_documents()

# Build TF-IDF index
vectorizer = TFIDFVectorizer(max_features=5000)
doc_texts = [doc.content for doc in documents]
vectorizer.fit(doc_texts)

# Train intent classifier
classifier = IntentClassifier()
training_texts = [...]  # Your training examples
training_labels = [...]  # Intent indices
classifier.train(training_texts, training_labels)

# Create RAG pipeline
pipeline = RAGPipeline(vectorizer, classifier, documents)

# Process a query
query = "What services depend on VLAN 29?"
result = pipeline.process_query(query, retrieve_k=5, rerank_k=3)

# Generate response
generator = ResponseGenerator()
response = generator.generate_response(result)
print(response['answer'])
```

## Output Analysis

The demo output shows:

- **Intent Classification**: 60% troubleshoot, 30% config_query, 10% capacity_planning
- **Average Confidence**: 21.1% (room for improvement with more training data)
- **Sources Retrieved**: Average 2.3 sources per query
- **Knowledge Base**: 118 searchable chunks covering comprehensive network documentation

## ML Models Details

### TF-IDF Vectorizer
- **Terms**: 679 vocabulary terms
- **Documents**: 118 chunks indexed
- **Algorithm**: Fits all documents, transforms queries to vectors
- **Formula**: TF-IDF(t,d) = (count(t,d) / len(d)) * log(N / (1 + df(t)))

### Intent Classifier
- **Classes**: 5 (topology_query, config_query, troubleshoot, capacity_planning, general)
- **Algorithm**: Logistic regression with softmax
- **Training**: 24 labeled examples
- **Features**: Keyword presence, question indicators, entity mentions

### Document Chunker
- **Chunk Size**: 500 tokens
- **Overlap**: 50 tokens
- **Strategy**: Semantic section preservation
- **Metadata**: Source, section, word boundaries

### RAG Pipeline
1. **Retrieval**: Top-5 similar documents via TF-IDF cosine similarity
2. **Re-ranking**: Multi-signal scoring (relevance, category, title)
3. **Context**: Top-3 documents formatted for prompt
4. **Generation**: Intelligent template-based response (simulated)
5. **Filtering**: Safety checks for credentials, PII, hallucinations

## Performance Characteristics

- **Retrieval**: O(n*m) where n=queries, m=documents (fully vectorized)
- **Re-ranking**: O(k) where k=top documents (fast)
- **Vocabulary**: 679 terms (manageable size)
- **Index Size**: 118 document vectors
- **Demo Runtime**: ~5-10 seconds on modern hardware

## Extensibility

### Adding New Documents

```python
from data.knowledge_base import Document

new_doc = Document(
    doc_id="my_doc_001",
    title="My Network Topic",
    content="Detailed documentation...",
    category="configuration",
    tags=["topic1", "topic2"]
)
```

### Custom Intent Classes

Modify `IntentClassifier.INTENTS` and add training examples for new intent types.

### Custom Prompt Templates

Add new methods to `PromptTemplates` class for domain-specific prompts.

### Real LLM Integration

Replace `LLMClient` with OpenAI, Claude, or other LLM API clients:

```python
from llm.llm_client import LLMClient

# Real LLM integration
client = LLMClient(model="gpt-4", api_key="...")
response = client.generate(prompt)
```

## Safety and Guardrails

The system includes multiple safety layers:

1. **Credential Detection**: Filters password, API key patterns
2. **PII Protection**: Masks SSN, credit card, passport patterns
3. **Hallucination Detection**: Identifies uncertainty phrases
4. **Output Filtering**: Automatic sanitization

Example:
```python
from llm.guardrails import OutputGuardrails

result = OutputGuardrails.filter_response(response)
# {'filtered': sanitized_text, 'has_credentials': bool, ...}
```

## Cisco Integration

The parser handles:

- **Interfaces**: Name, description, IP, VLAN, speed, status
- **VLANs**: ID, name, interfaces, status
- **BGP**: Neighbors, AS numbers, routes, filters
- **ACLs**: Rules, protocols, source/destination
- **Routing**: Static routes, OSPF configuration

## Testing and Validation

Run the demo to validate:
- ✓ All components load correctly
- ✓ TF-IDF indexing works
- ✓ Intent classification runs
- ✓ Retrieval and re-ranking function
- ✓ Response generation succeeds
- ✓ Safety filters apply

## Requirements

- Python 3.7+
- numpy 1.21+
- pandas 1.3+ (optional)
- matplotlib 3.4+ (optional, for visualization)

## License

This is a demonstration project. Adapt as needed for production use.

## Future Enhancements

- [ ] Real LLM integration (OpenAI, Claude)
- [ ] REST API server
- [ ] Docker containerization
- [ ] Kubernetes deployment
- [ ] Vector database (Pinecone, Weaviate)
- [ ] User authentication
- [ ] Query history and analytics
- [ ] Feedback loop for model improvement
- [ ] Multi-language support
- [ ] Interactive chat UI dashboard
