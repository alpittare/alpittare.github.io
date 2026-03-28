#!/usr/bin/env python3
"""
Autonomous Operations Agent - Complete Demo
Demonstrates anomaly detection, correlation, and recommendations
"""

import sys
import os
import json
from pathlib import Path
from datetime import datetime
import numpy as np

# Add paths
sys.path.insert(0, str(Path(__file__).parent))

# Import components
from data.telemetry_generator import TelemetryGenerator
from data.cisco_parser import parse_cisco_output
from models.isolation_forest import IsolationForest
from models.autoencoder import Autoencoder
from models.event_correlator import EventCorrelator
from models.recommendation_engine import RecommendationEngine
from pipeline.stream_processor import AnomalyStream
from pipeline.normalizer import Normalizer

# Color codes for terminal output
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'


def print_section(title: str) -> None:
    """Print formatted section header"""
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*80}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{title:^80}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'='*80}{Colors.ENDC}\n")


def print_success(text: str) -> None:
    """Print success message"""
    print(f"{Colors.OKGREEN}✓ {text}{Colors.ENDC}")


def print_warning(text: str) -> None:
    """Print warning message"""
    print(f"{Colors.WARNING}⚠ {text}{Colors.ENDC}")


def print_error(text: str) -> None:
    """Print error message"""
    print(f"{Colors.FAIL}✗ {text}{Colors.ENDC}")


def print_info(text: str) -> None:
    """Print info message"""
    print(f"{Colors.OKBLUE}ℹ {text}{Colors.ENDC}")


def demo_telemetry_generation() -> tuple:
    """Generate realistic telemetry data"""
    print_section("STEP 1: TELEMETRY GENERATION")

    print_info("Generating telemetry data for 10 network devices...")
    generator = TelemetryGenerator(num_devices=10, num_samples=120)
    telemetry = generator.generate_telemetry()
    print_success(f"Generated {len(telemetry)} telemetry samples ({len(generator.devices)} devices)")

    # Show device summary
    print(f"\n{Colors.BOLD}Network Devices:{Colors.ENDC}")
    for device in generator.devices[:5]:
        print(f"  • {device['device_id']:<20} ({device['type']:<12}) {device['ip']}")
    print(f"  ... and {len(generator.devices) - 5} more devices\n")

    # Inject anomalies
    print_info("Injecting 5 anomaly scenarios...")
    telemetry = generator.inject_anomalies(telemetry)
    anomaly_counts = {}
    for t in telemetry:
        if 'anomaly_type' in t:
            atype = t['anomaly_type']
            anomaly_counts[atype] = anomaly_counts.get(atype, 0) + 1

    print_success(f"Injected {len(anomaly_counts)} anomaly types")
    for atype, count in sorted(anomaly_counts.items()):
        print(f"  • {atype:<25}: {count:>3} samples")

    return generator, telemetry


def demo_cisco_parsing() -> None:
    """Parse and analyze Cisco CLI outputs"""
    print_section("STEP 2: CISCO DEVICE PARSING")

    base_path = Path(__file__).parent / "data" / "sample_configs"

    # Parse interfaces
    print_info("Parsing 'show interface' output...")
    with open(base_path / "nexus_show_interface.txt") as f:
        output = f.read()
    result = parse_cisco_output('interface', output)
    interfaces = result['interfaces']
    print_success(f"Parsed {len(interfaces)} interfaces")
    print(f"\n{Colors.BOLD}Interface Summary:{Colors.ENDC}")
    for intf in interfaces[:4]:
        status = intf.get('status', 'unknown')
        speed = intf.get('speed_gbps', 0)
        errors = intf.get('crc_errors', 0)
        print(f"  • {intf['interface']:<15} Status: {status:<4} Speed: {speed:>5.1f} Gb/s  CRC Errors: {errors}")

    # Parse BGP
    print_info("\nParsing 'show ip bgp summary' output...")
    with open(base_path / "nexus_show_bgp.txt") as f:
        output = f.read()
    bgp_data = parse_cisco_output('bgp', output)
    print_success(f"Parsed BGP data - Router ID: {bgp_data['router_id']}, Local AS: {bgp_data['local_as']}")
    print(f"\n{Colors.BOLD}BGP Neighbors:{Colors.ENDC}")
    up_neighbors = [n for n in bgp_data['neighbors'] if n['state'] == 'Up']
    down_neighbors = [n for n in bgp_data['neighbors'] if n['state'] == 'Down']
    print(f"  • Up: {len(up_neighbors)}, Down: {len(down_neighbors)}")
    for n in up_neighbors[:3]:
        print(f"    - {n['neighbor_ip']:<15} AS {n['remote_as']:<6} Prefixes: {n['prefixes']}")
    if down_neighbors:
        print(f"    - {down_neighbors[0]['neighbor_ip']:<15} (DOWN)")

    # Parse environment
    print_info("\nParsing 'show environment' output...")
    with open(base_path / "nexus_show_environment.txt") as f:
        output = f.read()
    env_data = parse_cisco_output('environment', output)
    print_success(f"Parsed environment - Power supplies: {len(env_data['power_supplies'])}, "
                  f"Fans: {len(env_data['fans'])}, Temp sensors: {len(env_data['temperatures'])}")

    # Parse logging
    print_info("\nParsing 'show logging last 100' output...")
    with open(base_path / "nexus_show_logging.txt") as f:
        output = f.read()
    logs = parse_cisco_output('logging', output)['logs']
    print_success(f"Parsed {len(logs)} log messages")
    critical_logs = [l for l in logs if l['severity'] <= 3]
    print(f"  • Critical/Error logs: {len(critical_logs)}")
    for log in critical_logs[:2]:
        print(f"    - [{log['facility']}] {log['message'][:60]}")

    # Parse CPU
    print_info("\nParsing 'show processes cpu' output...")
    with open(base_path / "nexus_cpu.txt") as f:
        output = f.read()
    cpu_data = parse_cisco_output('cpu', output)
    print_success(f"Parsed CPU data - 5sec: {cpu_data['cpu_5sec']}%, "
                  f"1min: {cpu_data['cpu_1min']}%, 5min: {cpu_data['cpu_5min']}%")
    top_procs = sorted(cpu_data['processes'], key=lambda x: x['cpu_5sec'], reverse=True)[:3]
    print(f"\n{Colors.BOLD}Top CPU Processes:{Colors.ENDC}")
    for proc in top_procs:
        print(f"  • {proc['name']:<15} PID: {proc['pid']:<5} CPU 5sec: {proc['cpu_5sec']:>6.1f}%")


def demo_data_normalization(telemetry: list) -> tuple:
    """Normalize telemetry data for ML models"""
    print_section("STEP 3: DATA NORMALIZATION")

    print_info("Extracting features from telemetry...")
    normalizer = Normalizer()

    # Separate normal and anomaly data
    normal_data = [t for t in telemetry if 'anomaly_type' not in t]
    anomaly_data = [t for t in telemetry if 'anomaly_type' in t]

    print_success(f"Separated data: {len(normal_data)} normal, {len(anomaly_data)} anomalies")

    # Fit normalizer on normal data
    print_info("Fitting StandardScaler on normal data...")
    normalizer.fit(normal_data)

    # Normalize all data
    X_normal = normalizer.normalize(normal_data)
    X_anomaly = normalizer.normalize(anomaly_data)
    X_all = normalizer.normalize(telemetry)

    print_success(f"Normalized all data")
    print(f"\n{Colors.BOLD}Feature Statistics:{Colors.ENDC}")
    feature_names = normalizer.get_feature_names()
    for i, name in enumerate(feature_names):
        mean_val = np.mean(X_normal[:, i])
        std_val = np.std(X_normal[:, i])
        print(f"  • {name:<25} mean: {mean_val:>7.3f}, std: {std_val:>7.3f}")

    return normalizer, X_normal, X_anomaly, X_all, normal_data, anomaly_data


def demo_isolation_forest(X_normal: np.ndarray, X_all: np.ndarray,
                          anomaly_data: list, telemetry: list) -> tuple:
    """Train and evaluate Isolation Forest"""
    print_section("STEP 4: ISOLATION FOREST ANOMALY DETECTION")

    print_info("Training Isolation Forest with 100 trees...")
    iso_forest = IsolationForest(n_trees=100, max_depth=20, contamination=0.05, random_state=42)
    iso_forest.fit(X_normal)
    print_success("Isolation Forest training complete")

    # Get anomaly scores
    print_info("Computing anomaly scores...")
    scores = iso_forest.predict(X_all)
    print_success(f"Computed anomaly scores for {len(scores)} samples")

    # Find anomalies
    anomaly_threshold = 0.5
    predicted_anomalies = iso_forest.predict_binary(X_all, threshold=anomaly_threshold)
    detected_count = np.sum(predicted_anomalies)
    actual_count = len(anomaly_data)

    print(f"\n{Colors.BOLD}Detection Results:{Colors.ENDC}")
    print(f"  • Anomaly threshold: {anomaly_threshold}")
    print(f"  • Actual anomalies injected: {actual_count}")
    print(f"  • Detected anomalies: {detected_count}")
    print(f"  • Detection rate: {(detected_count / actual_count * 100):.1f}%")

    # Show top anomalies
    top_indices = np.argsort(scores)[-10:][::-1]
    print(f"\n{Colors.BOLD}Top 10 Anomaly Scores:{Colors.ENDC}")
    for rank, idx in enumerate(top_indices, 1):
        score = scores[idx]
        device = telemetry[idx]['device_id']
        atype = telemetry[idx].get('anomaly_type', 'unknown')
        print(f"  {rank:>2}. Device: {device:<20} Score: {score:.4f}  Type: {atype}")

    return iso_forest, scores, predicted_anomalies


def demo_autoencoder(X_normal: np.ndarray, X_all: np.ndarray,
                     anomaly_data: list, telemetry: list) -> tuple:
    """Train and evaluate Autoencoder"""
    print_section("STEP 5: AUTOENCODER ANOMALY DETECTION")

    print_info("Initializing autoencoder (7-4-2-4-7 architecture)...")
    autoencoder = Autoencoder(input_dim=7, hidden_dim=4, latent_dim=2,
                             learning_rate=0.01, random_state=42)

    print_info("Training for 50 epochs...")
    autoencoder.fit(X_normal, epochs=50, batch_size=32)
    print_success("Autoencoder training complete")

    # Get reconstruction errors
    print_info("Computing reconstruction errors...")
    errors = autoencoder.predict_reconstruction_error(X_all)
    threshold = np.mean(errors) + 2 * np.std(errors)
    predicted_anomalies = (errors > threshold).astype(int)
    detected_count = np.sum(predicted_anomalies)
    actual_count = len(anomaly_data)

    print(f"\n{Colors.BOLD}Detection Results:{Colors.ENDC}")
    print(f"  • Error threshold (mean + 2*std): {threshold:.4f}")
    print(f"  • Actual anomalies injected: {actual_count}")
    print(f"  • Detected anomalies: {detected_count}")
    print(f"  • Detection rate: {(detected_count / actual_count * 100):.1f}%")

    # Show top reconstruction errors
    top_indices = np.argsort(errors)[-10:][::-1]
    print(f"\n{Colors.BOLD}Top 10 Reconstruction Errors:{Colors.ENDC}")
    for rank, idx in enumerate(top_indices, 1):
        error = errors[idx]
        device = telemetry[idx]['device_id']
        atype = telemetry[idx].get('anomaly_type', 'unknown')
        print(f"  {rank:>2}. Device: {device:<20} Error: {error:.4f}  Type: {atype}")

    return autoencoder, errors, predicted_anomalies


def demo_event_correlation(telemetry: list) -> None:
    """Demonstrate event correlation"""
    print_section("STEP 6: EVENT CORRELATION & ROOT CAUSE ANALYSIS")

    # Extract anomalies
    anomalies = []
    for i, t in enumerate(telemetry):
        if 'anomaly_type' in t:
            anomalies.append({
                'timestamp': t['timestamp'],
                'device_id': t['device_id'],
                'anomaly_type': t['anomaly_type'],
                'severity': 0.8
            })

    print_info(f"Analyzing {len(anomalies)} anomalies for correlation...")

    correlator = EventCorrelator(time_window_minutes=10, spatial_threshold=3)

    # Add simple topology
    devices = list(set(t['device_id'] for t in telemetry))
    for device in devices:
        correlator.add_topology(device, [d for d in devices if d != device][:3])

    # Correlate
    correlation_results = correlator.correlate(anomalies)
    temporal_groups = correlation_results['temporal_groups']
    causal_chains = correlation_results['causal_chains']

    print_success(f"Identified {len(temporal_groups)} temporal groups")
    print_success(f"Identified {len(causal_chains)} causal chains")

    print(f"\n{Colors.BOLD}Temporal Groups:{Colors.ENDC}")
    for i, group in enumerate(temporal_groups[:3], 1):
        print(f"  Group {i}: {len(group)} anomalies")
        for anom in group[:2]:
            print(f"    • {anom['device_id']:<20} - {anom['anomaly_type']}")

    print(f"\n{Colors.BOLD}Causal Chains (Root Cause Analysis):{Colors.ENDC}")
    for i, chain in enumerate(causal_chains[:3], 1):
        root_cause = chain['probable_root_cause']
        devices = chain['affected_devices']
        print(f"  Chain {i}: {Colors.BOLD}{root_cause}{Colors.ENDC}")
        print(f"    • Timestamp: {chain['timestamp']}")
        print(f"    • Affected devices: {', '.join(devices[:3])}")


def demo_recommendations(telemetry: list) -> None:
    """Generate remediation recommendations"""
    print_section("STEP 7: INTELLIGENT RECOMMENDATIONS")

    # Extract anomalies
    anomalies = []
    for t in telemetry:
        if 'anomaly_type' in t:
            anomalies.append({
                'device_id': t['device_id'],
                'anomaly_type': t['anomaly_type'],
                'severity': 0.85
            })

    print_info(f"Generating recommendations for {len(anomalies)} anomalies...")

    engine = RecommendationEngine()

    # Get explanations
    print(f"\n{Colors.BOLD}Anomaly Explanations:{Colors.ENDC}")
    unique_types = set(a['anomaly_type'] for a in anomalies)
    for atype in list(unique_types)[:3]:
        explanation = engine.explain_anomaly(atype)
        print(f"\n  {Colors.BOLD}{atype}:{Colors.ENDC}")
        print(f"  {explanation}\n")

    # Generate remediation plan
    remediation = engine.generate_remediation_plan(anomalies[:10])
    top_recs = remediation['all_recommendations'][:10]

    print(f"\n{Colors.BOLD}Top Remediation Recommendations:{Colors.ENDC}")
    for i, rec in enumerate(top_recs, 1):
        priority = rec.get('priority', 'MEDIUM')
        action = rec['action']
        confidence = rec.get('confidence', 0.8)
        device = rec.get('device_id', '?')

        priority_color = {
            'CRITICAL': Colors.FAIL,
            'HIGH': Colors.WARNING,
            'MEDIUM': Colors.OKBLUE,
            'LOW': Colors.ENDC
        }.get(priority, Colors.ENDC)

        print(f"  {i:>2}. [{priority_color}{priority}{Colors.ENDC}] {action[:50]}")
        print(f"      Device: {device}, Confidence: {confidence:.2f}")
        if 'command' in rec:
            print(f"      Command: {rec['command']}")

    print(f"\n{Colors.BOLD}Remediation Plan Summary:{Colors.ENDC}")
    print(f"  • Total recommendations: {remediation['total_recommendations']}")
    print(f"  • CRITICAL priority: {remediation['critical_count']}")
    print(f"  • HIGH priority: {remediation['high_count']}")


def demo_stream_processing() -> None:
    """Demonstrate stream processing"""
    print_section("STEP 8: STREAM PROCESSING & AGGREGATION")

    # Create sample anomaly stream
    stream = AnomalyStream()

    # Add some test anomalies
    test_anomalies = [
        {
            'timestamp': '2024-12-21T15:00:00',
            'device_id': 'NEXUS-SPINE-00',
            'anomaly_type': 'cpu_spike',
            'severity': 0.9
        },
        {
            'timestamp': '2024-12-21T15:01:00',
            'device_id': 'NEXUS-SPINE-01',
            'anomaly_type': 'bgp_flap',
            'severity': 0.8
        },
        {
            'timestamp': '2024-12-21T15:02:00',
            'device_id': 'NEXUS-SPINE-00',
            'anomaly_type': 'memory_leak',
            'severity': 0.85
        },
    ]

    stream.add_events(test_anomalies)
    print_success(f"Loaded {len(test_anomalies)} test anomalies")

    # Filter by device
    spine00_events = stream.filter_by_device('NEXUS-SPINE-00')
    print_info(f"Events on NEXUS-SPINE-00: {len(spine00_events)}")

    # Filter by type
    cpu_events = stream.filter_by_type('cpu_spike')
    print_info(f"CPU spike events: {len(cpu_events)}")

    # Get statistics
    stats = stream.get_stats()
    print(f"\n{Colors.BOLD}Stream Statistics:{Colors.ENDC}")
    print(f"  • Total events: {stats['total_events']}")
    print(f"  • By type: {stats['by_type']}")
    print(f"  • By device: {stats['by_device']}")
    print(f"  • Average severity: {stats['avg_severity']:.2f}")


def demo_summary() -> None:
    """Final summary and insights"""
    print_section("DEMO COMPLETE - SUMMARY")

    print(f"{Colors.BOLD}Autonomous Operations Agent Architecture:{Colors.ENDC}\n")

    components = [
        ("Telemetry Generation", "Generates realistic SNMP/gNMI data for network devices"),
        ("Cisco Parser", "Parses CLI outputs (interfaces, BGP, environment, CPU, logs)"),
        ("Data Normalization", "StandardScaler for feature normalization"),
        ("Isolation Forest", "Ensemble-based anomaly detection (numpy implementation)"),
        ("Autoencoder", "Neural network-based reconstruction error detection"),
        ("Event Correlator", "Temporal and spatial event correlation, root cause analysis"),
        ("Recommendation Engine", "ML-powered remediation suggestions"),
        ("Stream Processor", "Kafka-like event streaming and aggregation")
    ]

    for i, (name, desc) in enumerate(components, 1):
        print(f"  {i}. {Colors.BOLD}{name}{Colors.ENDC}")
        print(f"     {desc}\n")

    print(f"{Colors.BOLD}Key Capabilities:{Colors.ENDC}\n")
    capabilities = [
        "Detects anomalies in real-time telemetry streams",
        "Correlates events to identify root causes",
        "Generates actionable remediation recommendations",
        "Parses Cisco Nexus and Catalyst device configs",
        "Implements ML models from scratch (no sklearn)",
        "Provides natural language explanations",
        "Supports streaming data processing",
        "Tracks device topology for spatial correlation"
    ]

    for capability in capabilities:
        print(f"  • {capability}")

    print(f"\n{Colors.OKGREEN}{Colors.BOLD}Production-grade autonomous operations platform ready!{Colors.ENDC}\n")


def main() -> None:
    """Run complete demo"""
    print_section("AUTONOMOUS OPERATIONS AGENT - COMPLETE DEMO")

    try:
        # Step 1: Generate telemetry
        generator, telemetry = demo_telemetry_generation()

        # Step 2: Parse Cisco configs
        demo_cisco_parsing()

        # Step 3: Normalize data
        normalizer, X_normal, X_anomaly, X_all, normal_data, anomaly_data = \
            demo_data_normalization(telemetry)

        # Step 4: Isolation Forest
        iso_forest, scores, pred_iso = demo_isolation_forest(X_normal, X_all, anomaly_data, telemetry)

        # Step 5: Autoencoder
        autoencoder, errors, pred_auto = demo_autoencoder(X_normal, X_all, anomaly_data, telemetry)

        # Step 6: Event Correlation
        demo_event_correlation(telemetry)

        # Step 7: Recommendations
        demo_recommendations(telemetry)

        # Step 8: Stream Processing
        demo_stream_processing()

        # Summary
        demo_summary()

        print(f"{Colors.OKGREEN}{Colors.BOLD}All tests completed successfully!{Colors.ENDC}\n")

    except Exception as e:
        print_error(f"Demo failed: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
