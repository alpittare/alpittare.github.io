#!/usr/bin/env python3
"""
Incident Correlation & Root Cause Analysis System
Complete production-grade demo showing clustering, correlation, and RCA

Author: Network Architect
Date: 2025
Description: Demonstrates DBSCAN clustering, K-Means categorization, alarm
deduplication, event correlation, and graph-based root cause analysis on
realistic network alarm data from Cisco Nexus 9000 and Catalyst 6509 devices.
"""

import sys
import os
import json
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime, timedelta
from typing import List, Dict, Tuple
import time

# Add project root to path
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, PROJECT_ROOT)

# Import all modules
from data.cisco_parser import CiscoLogParser, convert_to_dict
from data.topology import create_sample_topology
from data.alarm_generator import AlarmGenerator
from models.dbscan import DBSCAN, DBSCANFeatureEncoder
from models.kmeans import KMeans, ElbowMethod
from models.deduplicator import AlarmDeduplicator, AlarmNormalizer
from models.correlation_engine import CorrelationEngine
from models.rca_graph import RCAGraph
from pipeline.alarm_processor import AlarmProcessor, AlarmValidator
from pipeline.enrichment import AlarmEnricher
from llm.prompt_templates import RCAExplainer
from config.settings import SystemConfig

print("=" * 80)
print("INCIDENT CORRELATION & ROOT CAUSE ANALYSIS SYSTEM")
print("=" * 80)
print(f"Timestamp: {datetime.now().isoformat()}")
print()

# ==============================================================================
# SECTION 1: TOPOLOGY & DATA GENERATION
# ==============================================================================
print("[SECTION 1] Network Topology & Alarm Generation")
print("-" * 80)

print("\n1.1 Creating network topology...")
topology = create_sample_topology()
print(f"    Devices: {len(topology.devices)}")
print(f"    Links: {len(topology.links)}")
print(f"    Device list: {', '.join(sorted(topology.devices.keys()))}")

print("\n1.2 Generating realistic network alarms (3 major incidents)...")
generator = AlarmGenerator()
raw_alarms = generator.generate_all_incidents()
print(f"    Generated {len(raw_alarms)} total alarms")
print(f"    Time span: {raw_alarms[0].timestamp.isoformat()} to {raw_alarms[-1].timestamp.isoformat()}")

# Analyze incident distribution
incidents_data = {
    'Incident 1 (CORE router failure)': 0,
    'Incident 2 (PSU failure)': 0,
    'Incident 3 (Link flapping)': 0,
    'Background noise': 0
}

for alarm in raw_alarms:
    ts = alarm.timestamp.timestamp()
    base_ts = generator.base_time.timestamp()
    
    if ts < base_ts + 300:  # First 5 minutes
        incidents_data['Incident 1 (CORE router failure)'] += 1
    elif ts < base_ts + 3900:  # 5-65 minutes
        incidents_data['Incident 2 (PSU failure)'] += 1
    elif ts < base_ts + 7500:  # 65-125 minutes
        incidents_data['Incident 3 (Link flapping)'] += 1
    else:
        incidents_data['Background noise'] += 1

print("\n    Alarm distribution by scenario:")
for scenario, count in incidents_data.items():
    pct = (count / len(raw_alarms)) * 100
    print(f"      {scenario}: {count} ({pct:.1f}%)")

# ==============================================================================
# SECTION 2: ALARM VALIDATION & DEDUPLICATION
# ==============================================================================
print("\n[SECTION 2] Alarm Validation & Deduplication")
print("-" * 80)

print("\n2.1 Validating alarm data quality...")
validated_alarms = AlarmValidator.validate_batch(raw_alarms)
print(f"    Valid alarms: {len(validated_alarms)}/{len(raw_alarms)}")
print(f"    Invalid alarms: {len(raw_alarms) - len(validated_alarms)}")

print("\n2.2 Deduplicating alarms...")
deduplicator = AlarmDeduplicator(time_window_seconds=300)
deduped_alarms, dedup_stats = deduplicator.deduplicate(validated_alarms)

print(f"    Original count: {dedup_stats.original_count}")
print(f"    After deduplication: {dedup_stats.unique_count}")
print(f"    Suppressions: {dedup_stats.suppressed_count}")
print(f"    Reduction ratio: {dedup_stats.reduction_ratio:.2%}")

print("\n    Top suppressions by alarm type:")
sorted_supp = sorted(
    dedup_stats.suppressions_by_alarm_type.items(),
    key=lambda x: x[1],
    reverse=True
)[:5]
for alarm_type, count in sorted_supp:
    print(f"      {alarm_type}: {count} suppressions")

# ==============================================================================
# SECTION 3: FEATURE ENCODING & CLUSTERING (DBSCAN)
# ==============================================================================
print("\n[SECTION 3] Feature Encoding & DBSCAN Clustering")
print("-" * 80)

print("\n3.1 Encoding alarms to feature vectors...")
encoder = DBSCANFeatureEncoder()
X_features = encoder.fit_transform(deduped_alarms)
print(f"    Feature matrix shape: {X_features.shape}")
print(f"    Features: [normalized_timestamp, device_code, severity_code, alarm_type_code]")

print("\n3.2 Running DBSCAN (eps=0.5, min_pts=3)...")
dbscan = DBSCAN(eps=0.5, min_pts=3, temporal_weight=0.3)
dbscan_result = dbscan.fit(X_features)

print(f"    Clusters found: {dbscan_result.n_clusters}")
print(f"    Core points: {dbscan_result.n_core_points}")
print(f"    Noise points: {np.sum(dbscan_result.labels == -1)}")

cluster_sizes = {}
for label in dbscan_result.labels:
    if label != -1:
        cluster_sizes[label] = cluster_sizes.get(label, 0) + 1

print("\n    Cluster size distribution:")
sorted_clusters = sorted(cluster_sizes.items(), key=lambda x: x[1], reverse=True)
for cluster_id, size in sorted_clusters[:10]:
    pct = (size / len(deduped_alarms)) * 100
    print(f"      Cluster {cluster_id}: {size} alarms ({pct:.1f}%)")

if len(sorted_clusters) > 10:
    remaining = sum(s for _, s in sorted_clusters[10:])
    print(f"      ... and {len(sorted_clusters) - 10} more clusters ({remaining} alarms)")

# ==============================================================================
# SECTION 4: K-MEANS CLUSTERING & ELBOW METHOD
# ==============================================================================
print("\n[SECTION 4] K-Means Clustering with Elbow Method")
print("-" * 80)

print("\n4.1 Finding optimal K using elbow method...")
optimal_k, inertias = ElbowMethod.find_optimal_k(X_features, range(1, 11), random_state=42)
print(f"    Optimal K: {optimal_k}")
print(f"    Inertia values: {[f'{v:.2f}' for v in inertias]}")

print("\n4.2 Running K-Means with optimal K...")
kmeans = KMeans(n_clusters=optimal_k, max_iter=100, random_state=42)
kmeans_result = kmeans.fit(X_features)

print(f"    Iterations: {kmeans_result.n_iter}/{100}")
print(f"    Final inertia: {kmeans_result.inertia:.4f}")

kmeans_cluster_sizes = {}
for label in kmeans_result.labels:
    kmeans_cluster_sizes[label] = kmeans_cluster_sizes.get(label, 0) + 1

print("\n    K-Means cluster distribution:")
for cluster_id in sorted(kmeans_cluster_sizes.keys()):
    size = kmeans_cluster_sizes[cluster_id]
    pct = (size / len(deduped_alarms)) * 100
    print(f"      Cluster {cluster_id}: {size} alarms ({pct:.1f}%)")

# ==============================================================================
# SECTION 5: ALARM PROCESSING & ENRICHMENT
# ==============================================================================
print("\n[SECTION 5] Alarm Processing & Enrichment")
print("-" * 80)

print("\n5.1 Processing alarms...")
processed_alarms = AlarmProcessor.process_batch(deduped_alarms)
print(f"    Processed: {len(processed_alarms)} alarms")

print("\n5.2 Enriching with topology context...")
enricher = AlarmEnricher(topology=topology)
enriched = enricher.enrich_batch(deduped_alarms)
print(f"    Enriched: {len(enriched)} alarms")

criticality_dist = {}
for e in enriched:
    crit = e['criticality']
    criticality_dist[crit] = criticality_dist.get(crit, 0) + 1

print("\n    Criticality distribution:")
for level in ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']:
    count = criticality_dist.get(level, 0)
    pct = (count / len(enriched)) * 100 if enriched else 0
    print(f"      {level}: {count} ({pct:.1f}%)")

# ==============================================================================
# SECTION 6: EVENT CORRELATION ENGINE
# ==============================================================================
print("\n[SECTION 6] Multi-Dimensional Event Correlation")
print("-" * 80)

print("\n6.1 Correlating events (temporal + spatial + causal)...")
correlation_engine = CorrelationEngine(temporal_window_sec=300, topology=topology)
incidents = correlation_engine.correlate(deduped_alarms)

print(f"    Incidents identified: {len(incidents)}")
print(f"    Average alarms per incident: {np.mean([len(i.alarms) for i in incidents]):.1f}")

print("\n6.2 Incident summary (top 5 by size):")
sorted_incidents = sorted(incidents, key=lambda x: len(x.alarms), reverse=True)
for idx, incident in enumerate(sorted_incidents[:5], 1):
    duration = (incident.end_time - incident.start_time).total_seconds()
    severity_set = set(a.severity for a in incident.alarms)
    devices_str = ', '.join(sorted(incident.affected_devices))
    
    print(f"\n      Incident {idx}: {incident.incident_id}")
    print(f"        Alarms: {len(incident.alarms)}")
    print(f"        Duration: {duration:.0f}s")
    print(f"        Confidence: {incident.confidence_score:.2%}")
    print(f"        Devices: {devices_str}")
    print(f"        Severity: {', '.join(sorted(severity_set))}")

# ==============================================================================
# SECTION 7: ROOT CAUSE ANALYSIS (GRAPH-BASED)
# ==============================================================================
print("\n[SECTION 7] Graph-Based Root Cause Analysis")
print("-" * 80)

print("\n7.1 Analyzing root causes for top incidents...")
rca_graph = RCAGraph(topology)
rca_results = {}

for incident in sorted_incidents[:3]:
    root_causes = rca_graph.analyze_incident(incident)
    rca_results[incident.incident_id] = root_causes
    
    print(f"\n      {incident.incident_id} - Top Root Cause Candidates:")
    for idx, rc in enumerate(root_causes[:5], 1):
        print(f"        {idx}. {rc.alarm_type} on {rc.device_id}")
        print(f"           Score: {rc.score:.2%}")
        if rc.evidence:
            print(f"           Evidence: {rc.evidence[0]}")

# ==============================================================================
# SECTION 8: NATURAL LANGUAGE RCA REPORTS
# ==============================================================================
print("\n[SECTION 8] Natural Language RCA Explanations")
print("-" * 80)

for incident in sorted_incidents[:1]:
    root_causes = rca_results.get(incident.incident_id, [])
    
    print(f"\n8.1 Detailed RCA Report for {incident.incident_id}:")
    print("-" * 80)
    
    report = RCAExplainer.explain_incident(incident, root_causes)
    print(report)

# ==============================================================================
# SECTION 9: VISUALIZATION (Charts)
# ==============================================================================
print("\n[SECTION 9] Generating Visualizations")
print("-" * 80)

output_dir = os.path.join(PROJECT_ROOT, 'output')
os.makedirs(output_dir, exist_ok=True)

print("\n9.1 Creating alarm timeline scatter plot...")
fig, ax = plt.subplots(figsize=(14, 6))

severity_colors = {
    'CRITICAL': '#d62728',
    'ERROR': '#ff7f0e',
    'WARNING': '#ffbb78',
    'NOTICE': '#2ca02c',
    'INFO': '#1f77b4'
}

for alarm in deduped_alarms:
    color = severity_colors.get(alarm.severity, '#7f7f7f')
    ax.scatter(alarm.timestamp, 
              AlarmNormalizer.normalize_severity(alarm.severity),
              c=color, s=50, alpha=0.6)

ax.set_ylabel('Severity Level', fontsize=11)
ax.set_xlabel('Time', fontsize=11)
ax.set_title('Alarm Timeline (Color by Severity)', fontsize=13, fontweight='bold')
ax.grid(True, alpha=0.3)
plt.xticks(rotation=45)
plt.tight_layout()
chart_path = os.path.join(output_dir, 'alarm_timeline.png')
plt.savefig(chart_path, dpi=100)
print(f"    Saved: {chart_path}")
plt.close()

print("\n9.2 Creating DBSCAN cluster visualization...")
fig, ax = plt.subplots(figsize=(12, 6))

# Project to 2D: timestamp vs severity
X_2d = np.column_stack([
    X_features[:, 0],  # normalized timestamp
    X_features[:, 2]   # severity code
])

scatter = ax.scatter(X_2d[:, 0], X_2d[:, 1],
                    c=dbscan_result.labels, cmap='tab20',
                    s=60, alpha=0.7)

ax.set_xlabel('Normalized Timestamp', fontsize=11)
ax.set_ylabel('Severity Code', fontsize=11)
ax.set_title('DBSCAN Clustering (Temporal + Severity)', fontsize=13, fontweight='bold')
plt.colorbar(scatter, ax=ax, label='Cluster ID')
plt.tight_layout()
chart_path = os.path.join(output_dir, 'dbscan_clusters.png')
plt.savefig(chart_path, dpi=100)
print(f"    Saved: {chart_path}")
plt.close()

print("\n9.3 Creating K-Means cluster visualization...")
fig, ax = plt.subplots(figsize=(12, 6))

scatter = ax.scatter(X_2d[:, 0], X_2d[:, 1],
                    c=kmeans_result.labels, cmap='tab20',
                    s=60, alpha=0.7)

# Plot centroids
centroids_2d = kmeans_result.centroids[:, [0, 2]]
ax.scatter(centroids_2d[:, 0], centroids_2d[:, 1],
          c='red', marker='X', s=300, edgecolors='black',
          linewidths=2, label='Centroids')

ax.set_xlabel('Normalized Timestamp', fontsize=11)
ax.set_ylabel('Severity Code', fontsize=11)
ax.set_title('K-Means Clustering (K=3)', fontsize=13, fontweight='bold')
plt.colorbar(scatter, ax=ax, label='Cluster ID')
ax.legend()
plt.tight_layout()
chart_path = os.path.join(output_dir, 'kmeans_clusters.png')
plt.savefig(chart_path, dpi=100)
print(f"    Saved: {chart_path}")
plt.close()

print("\n9.4 Creating inertia elbow plot...")
fig, ax = plt.subplots(figsize=(10, 6))

k_values = list(range(1, 11))
ax.plot(k_values, inertias, 'bo-', linewidth=2, markersize=8)
ax.axvline(x=optimal_k, color='red', linestyle='--', linewidth=2,
          label=f'Optimal K={optimal_k}')
ax.set_xlabel('Number of Clusters (K)', fontsize=11)
ax.set_ylabel('Inertia', fontsize=11)
ax.set_title('Elbow Method for K Selection', fontsize=13, fontweight='bold')
ax.grid(True, alpha=0.3)
ax.legend()
plt.tight_layout()
chart_path = os.path.join(output_dir, 'elbow_method.png')
plt.savefig(chart_path, dpi=100)
print(f"    Saved: {chart_path}")
plt.close()

print("\n9.5 Creating incident distribution bar chart...")
fig, ax = plt.subplots(figsize=(12, 6))

incident_ids = [i.incident_id for i in sorted_incidents[:10]]
alarm_counts = [len(i.alarms) for i in sorted_incidents[:10]]
colors = plt.cm.RdYlGn_r(np.linspace(0.3, 0.8, len(incident_ids)))

bars = ax.bar(range(len(incident_ids)), alarm_counts, color=colors)
ax.set_xticks(range(len(incident_ids)))
ax.set_xticklabels(incident_ids, rotation=45, ha='right')
ax.set_ylabel('Number of Alarms', fontsize=11)
ax.set_title('Top 10 Incidents by Alarm Count', fontsize=13, fontweight='bold')

# Add value labels on bars
for i, (bar, count) in enumerate(zip(bars, alarm_counts)):
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height(),
           str(count), ha='center', va='bottom', fontsize=10)

plt.tight_layout()
chart_path = os.path.join(output_dir, 'incident_distribution.png')
plt.savefig(chart_path, dpi=100)
print(f"    Saved: {chart_path}")
plt.close()

print("\n9.6 Creating criticality heatmap...")
fig, ax = plt.subplots(figsize=(10, 6))

devices = sorted(topology.devices.keys())
criticalities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

heatmap_data = []
for device in devices:
    device_alarms = [a for a in deduped_alarms if a.device_id == device]
    row = []
    for criticality in criticalities:
        crit_val = {
            'CRITICAL': 4,
            'HIGH': 3,
            'MEDIUM': 2,
            'LOW': 1
        }.get(criticality, 0)
        
        enriched_device = enricher.enrich(device_alarms[0]) if device_alarms else {}
        match_count = len([
            a for a in device_alarms
            if enriched_device.get('criticality') == criticality
        ])
        row.append(match_count)
    heatmap_data.append(row)

heatmap_array = np.array(heatmap_data)
sns.heatmap(heatmap_array, annot=True, fmt='d', cmap='YlOrRd',
           xticklabels=criticalities, yticklabels=devices, ax=ax)
ax.set_title('Alarm Criticality by Device', fontsize=13, fontweight='bold')
plt.tight_layout()
chart_path = os.path.join(output_dir, 'criticality_heatmap.png')
plt.savefig(chart_path, dpi=100)
print(f"    Saved: {chart_path}")
plt.close()

# ==============================================================================
# SECTION 10: SUMMARY STATISTICS & REPORT
# ==============================================================================
print("\n[SECTION 10] System Summary Report")
print("-" * 80)

print("\nKEY METRICS:")
print(f"  Total Alarms Processed:        {len(raw_alarms):,}")
print(f"  Valid Alarms:                  {len(validated_alarms):,}")
print(f"  After Deduplication:           {len(deduped_alarms):,}")
print(f"  Deduplication Efficiency:      {dedup_stats.reduction_ratio:.2%} reduction")
print(f"  DBSCAN Clusters:               {dbscan_result.n_clusters}")
print(f"  K-Means Clusters (optimal):    {optimal_k}")
print(f"  Incidents Correlated:          {len(incidents)}")
print(f"  Incidents (top-tier):          {len(sorted_incidents[:5])}")

print("\nCLUSTERING PERFORMANCE:")
print(f"  DBSCAN Core Points:            {dbscan_result.n_core_points}")
print(f"  DBSCAN Noise Points:           {np.sum(dbscan_result.labels == -1)}")
print(f"  K-Means Final Inertia:         {kmeans_result.inertia:.4f}")
print(f"  K-Means Iterations:            {kmeans_result.n_iter}")

print("\nTOP INCIDENT RCA RESULTS:")
for idx, incident in enumerate(sorted_incidents[:3], 1):
    root_causes = rca_results.get(incident.incident_id, [])
    primary_rc = root_causes[0] if root_causes else None
    
    if primary_rc:
        print(f"  Incident {idx}:")
        print(f"    Root Cause: {primary_rc.alarm_type} on {primary_rc.device_id}")
        print(f"    Confidence: {primary_rc.score:.2%}")
        print(f"    Affected: {len(incident.affected_devices)} devices")

print("\nVISUALIZATIONS GENERATED:")
chart_files = [
    'alarm_timeline.png',
    'dbscan_clusters.png',
    'kmeans_clusters.png',
    'elbow_method.png',
    'incident_distribution.png',
    'criticality_heatmap.png'
]

for chart_file in chart_files:
    chart_path = os.path.join(output_dir, chart_file)
    if os.path.exists(chart_path):
        print(f"  ✓ {chart_file}")

# ==============================================================================
# SECTION 11: JSON OUTPUT FOR INTEGRATION
# ==============================================================================
print("\n[SECTION 11] JSON Export for External Integration")
print("-" * 80)

export_data = {
    'metadata': {
        'generated_at': datetime.now().isoformat(),
        'total_alarms': len(raw_alarms),
        'deduplicated_alarms': len(deduped_alarms),
        'incidents': len(incidents),
        'system_config': {
            'dbscan_eps': 0.5,
            'dbscan_min_pts': 3,
            'kmeans_k': optimal_k,
            'correlation_window_sec': 300,
        }
    },
    'incidents': []
}

for incident in sorted_incidents[:5]:
    root_causes = rca_results.get(incident.incident_id, [])
    
    incident_data = {
        'incident_id': incident.incident_id,
        'alarm_count': len(incident.alarms),
        'affected_devices': list(incident.affected_devices),
        'confidence_score': float(incident.confidence_score),
        'start_time': incident.start_time.isoformat(),
        'end_time': incident.end_time.isoformat(),
        'duration_seconds': (incident.end_time - incident.start_time).total_seconds(),
        'severity_distribution': dict(
            (sev, len([a for a in incident.alarms if a.severity == sev]))
            for sev in ['CRITICAL', 'ERROR', 'WARNING', 'NOTICE', 'INFO']
        ),
        'root_causes': [
            {
                'alarm_type': rc.alarm_type,
                'device_id': rc.device_id,
                'score': float(rc.score),
                'evidence': rc.evidence[:2]
            }
            for rc in root_causes[:3]
        ]
    }
    export_data['incidents'].append(incident_data)

json_path = os.path.join(output_dir, 'rca_results.json')
with open(json_path, 'w') as f:
    json.dump(export_data, f, indent=2)
print(f"\n  Exported RCA results: {json_path}")

# ==============================================================================
# FINAL SUMMARY
# ==============================================================================
print("\n" + "=" * 80)
print("EXECUTION COMPLETE")
print("=" * 80)
print(f"\nTimestamp: {datetime.now().isoformat()}")
print(f"Output directory: {output_dir}")
print(f"Charts saved: {len(chart_files)}")
print(f"JSON exports: 1 (rca_results.json)")
print("\n" + "=" * 80)

