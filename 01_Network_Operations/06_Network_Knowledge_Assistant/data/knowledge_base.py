"""Network knowledge base with documentation and device data."""
from typing import Dict, List, Tuple
from dataclasses import dataclass, asdict


@dataclass
class Document:
    """Knowledge base document."""
    doc_id: str
    title: str
    content: str
    category: str  # architecture, configuration, troubleshooting, etc.
    author: str = "NetOps Team"
    created_date: str = ""
    updated_date: str = ""
    tags: List[str] = None

    def __post_init__(self):
        if self.tags is None:
            self.tags = []

    def to_dict(self):
        return asdict(self)


def get_knowledge_base_documents() -> List[Document]:
    """Return comprehensive network knowledge base documents."""
    return [
        Document(
            doc_id="arch_001",
            title="Network Architecture Overview - Data Center Design",
            content="""
# Network Architecture Overview

## Data Center Design

Our data center network follows a three-tier hierarchical design with spine-and-leaf topology:

### Tier 1: Core Layer
- Devices: NEXUS-CORE-01, NEXUS-CORE-02
- Function: Aggregation and routing to external networks
- Technology: Cisco Nexus 9000 series
- BGP AS: 65001
- Loopback IPs: 10.0.0.1, 10.0.0.2

### Tier 2: Distribution Layer
- Devices: CAT6509-DIST-01, CAT6509-DIST-02
- Function: Aggregation of access layer traffic
- Technology: Cisco Catalyst 6509
- BGP AS: 65002
- VLANs managed: 100, 200, 300

### Tier 3: Access Layer
- Multiple access switches
- Direct connection to servers and endpoints
- VLAN distribution

## IP Addressing Scheme

### Management Network
- Subnet: 192.168.100.0/24
- Purpose: Device management, SSH, SNMP
- VLAN: 29
- Gateway: 192.168.100.1

### Production Data Network
- Subnet: 10.100.0.0/24
- Purpose: Application production traffic
- VLAN: 100
- Gateway: 10.100.0.1
- Services: Web servers, databases

### Services Network
- Subnet: 10.200.0.0/24
- Purpose: Services and application infrastructure
- VLAN: 200
- Gateway: 10.200.0.1
- Services: DNS, DHCP, NTP, Logging

### Guest Network
- Subnet: 10.200.50.0/24
- Purpose: Guest and contractor access
- VLAN: 300
- Gateway: 10.200.50.1
- Security: Isolated from production

## BGP Configuration

All devices run BGP with these relationships:
- NEXUS-CORE-01 (AS 65001) - Core aggregation
- NEXUS-CORE-02 (AS 65001) - Core aggregation
- CAT6509-DIST-01 (AS 65002) - Distribution layer
- CAT6509-DIST-02 (AS 65002) - Distribution layer

BGP best-path uses as-path multipath-relax for equal-cost load balancing.

## Redundancy

- All critical links are redundant
- Port-channel aggregation for uplink resilience
- Spanning Tree Protocol (RSTP) for loop prevention
- VLAN trunking for multi-VLAN support
            """,
            category="architecture",
            tags=["topology", "vlan", "bgp", "ip-scheme"]
        ),

        Document(
            doc_id="config_001",
            title="Cisco Device Configuration Standards",
            content="""
# Cisco Device Configuration Standards

## Interface Naming Convention

### Cisco Nexus Devices
- Format: Ethernet[Card]/[Port]
- Example: Ethernet1/1, Ethernet2/48
- Speed: 100G or 40G for uplinks, 10G for aggregation

### Cisco Catalyst Devices
- Format: GigabitEthernet[Slot]/[Port]
- Example: GigabitEthernet1/1, GigabitEthernet2/48
- Speed: 1G for standard access, 10G for uplinks

## VLAN Naming Convention

Format: [FUNCTION]-VLAN
Examples:
- MANAGEMENT-VLAN (VLAN 29)
- DATA-VLAN (VLAN 100)
- SERVICES-VLAN (VLAN 200)
- GUEST-VLAN (VLAN 300)

## Routing Policies

### BGP Configuration
- Always use descriptions for neighbors
- Enable log-neighbor-changes
- Use prefix-lists for filtering
- Apply route-maps for AS path prepending
- Send community extended to peers

### Static Routes
- Use only for out-of-band management
- Default route via edge gateway
- Document all static routes in change log

## MTU Configuration
- Core interfaces: 9216 (jumbo frames)
- Access interfaces: 1500 (standard)
- Management interfaces: 1500

## Access Control Lists (ACLs)

### Management ACL
- Allow SSH from management subnet only
- Allow SNMP from monitoring systems
- Implicit deny all other traffic

### Data Traffic ACL
- Permit DNS (port 53)
- Permit HTTP (port 80)
- Permit HTTPS (port 443)
- Permit SSH (port 22)
- Permit ICMP for diagnostics
- Implicit deny all other

## Logging Configuration
- Central syslog server: 10.0.0.200
- Log facility: LOCAL0
- Log level: 5 (notifications)
- Buffer size: 2000000 bytes
            """,
            category="configuration",
            tags=["standards", "best-practices", "interface", "vlan", "bgp", "acl"]
        ),

        Document(
            doc_id="troubleshoot_001",
            title="Troubleshooting BGP Neighbor Issues",
            content="""
# Troubleshooting BGP Neighbor Issues

## BGP Neighbor Not Coming Up

### Diagnosis Steps

1. **Check Interface Status**
   ```
   show interface Ethernet1/1
   ```
   Ensure interface is up/up

2. **Verify BGP Process**
   ```
   show bgp process
   ```
   Confirm BGP is running

3. **Check Neighbor Configuration**
   ```
   show bgp neighbors 10.1.1.254
   ```
   Verify neighbor IP and AS number

4. **Verify Connectivity**
   ```
   ping 10.1.1.254
   ```
   Ensure routing path exists

### Common Issues

#### Incorrect AS Number
- Symptoms: Neighbor status "active"
- Fix: Correct remote-as in neighbor configuration
- Verify: show bgp neighbors | include "remote AS"

#### Interface Down
- Symptoms: Cannot ping neighbor
- Fix: Check cable, port-channel status, interface shutdown
- Verify: show interface status

#### ACL Blocking BGP
- Symptoms: Connection timeout
- Fix: Ensure ACLs allow TCP 179
- Verify: show ip access-lists

#### BGP Timers
- Default keepalive: 60 seconds
- Default hold-time: 180 seconds
- If not receiving keepalives, check network latency

## High CPU Due to BGP

### Causes
- Route flapping (instability)
- Large routing table size
- Slow BGP peer (network latency)
- Memory pressure

### Resolution
- Use prefix-lists to filter routes
- Implement route dampening
- Check for routing instability
- Monitor peer responsiveness

## BGP Route Not Advertised

### Checklist
1. Route exists in local routing table
2. Route is permitted by outbound prefix-list
3. Route-map is applied and matching
4. Neighbor relationship is established
5. BGP address-family is configured

### Debugging
```
show route-map RM-VLAN-EXPORT
show ip prefix-list PL-CORE-OUT
debug ip bgp keepalives
debug ip bgp updates
            """,
            category="troubleshooting",
            tags=["bgp", "neighbor", "adjacency", "troubleshoot"]
        ),

        Document(
            doc_id="troubleshoot_002",
            title="Troubleshooting High CPU on Cisco Nexus",
            content="""
# Troubleshooting High CPU on Cisco Nexus Devices

## Symptoms
- Device slow to respond
- SSH commands delay
- Log flooding
- Packet loss or high latency

## Diagnosis

### Check CPU Utilization
```
show system resources
show processes cpu | head 20
show module
```

### Identify Process Using CPU
Look for process percentages in output:
- BGP process high: Check route flapping
- CMP process high: Check for broadcast storms
- SDK process high: Check hardware issues

### Common High CPU Causes

1. **Route Flapping**
   - BGP routes unstable
   - Interface up/down cycling
   - Fix: Stabilize links, check BFD

2. **Broadcast Storms**
   - Excessive broadcast/multicast
   - Spanning tree issues
   - Fix: Check for loops, enable storm control

3. **ACL Processing**
   - Large ACLs causing slow lookups
   - Fix: Optimize ACL structure

4. **Logging Overhead**
   - Excessive syslog output
   - Fix: Reduce log level or disable verbose logging

## Resolution

### Immediate Actions
```
show logging | tail 50
clear counters
show bgp summary
show spanning-tree brief
```

### Long-term Fixes
- Implement prefix-lists
- Enable BFD for fast failover
- Configure storm control
- Optimize ACLs
- Update NX-OS version
            """,
            category="troubleshooting",
            tags=["cpu", "performance", "troubleshoot", "nexus"]
        ),

        Document(
            doc_id="ops_001",
            title="Network Operational Runbook",
            content="""
# Network Operational Runbook

## Daily Operations

### Morning Checklist
1. Review network monitoring alerts
2. Check BGP neighbor status:
   ```
   show bgp summary all
   ```
3. Verify no interfaces in error state:
   ```
   show interface status | include err-
   ```
4. Confirm VLAN health:
   ```
   show vlan id 29,100,200,300
   ```

### Link Failure Procedure

1. **Immediate Response**
   - Verify device is reachable
   - Check physical connections
   - Review recent changes

2. **Diagnostics**
   ```
   show interface Ethernet1/1
   show interface counters
   show bgp neighbors
   ```

3. **Failover Verification**
   - Confirm traffic reroutes
   - Monitor CPU and memory
   - Check for new errors

4. **Notification**
   - Alert stakeholders of impact
   - Provide ETA for restoration
   - Update ticket system

## Planned Maintenance

### Pre-Maintenance
- Notify all stakeholders 24 hours ahead
- Verify maintenance window (low traffic)
- Have rollback plan ready
- Test configuration on lab device

### Configuration Change
1. Save current config
2. Apply new configuration
3. Verify changes took effect
4. Monitor for 15 minutes
5. Commit to version control

### Post-Maintenance
- Verify all services operational
- Confirm BGP adjacencies established
- Check for increased CPU/memory
- Document changes in ticket

## Escalation Procedures

### Priority Levels

**CRITICAL (Sev-1)**
- Multiple VLANs down
- Core device unreachable
- BGP routes unstable
- Response: Immediate, Page on-call

**HIGH (Sev-2)**
- Single distribution switch down
- One VLAN affected
- Response: 15 minute response

**MEDIUM (Sev-3)**
- Single interface issue
- Degraded performance
- Response: 1 hour response
            """,
            category="operations",
            tags=["runbook", "procedures", "operations", "incident"]
        ),

        Document(
            doc_id="perf_001",
            title="Network Performance and Capacity Planning",
            content="""
# Network Performance and Capacity Planning

## Current Capacity Status

### Core Layer (Spine)
- Available capacity: 80Tbps per spine
- Current utilization: 12%
- Projected 6-month utilization: 18%

### Distribution Layer
- Uplink capacity (port-channel): 200Gbps per device
- Current utilization: 35%
- Access links: 10Gbps per switch
- Current utilization: 25%

### Access Layer
- 1G access ports: 48 per switch
- 10G uplinks: 4 per switch
- Average link utilization: 15%

## Performance Baselines

### Latency
- Intra-DC (spine-to-leaf): < 1ms
- Cross-DC (if applicable): < 5ms
- Internet path: < 50ms

### Throughput
- Expected: Wire rate minus overhead
- Core links: 95Gbps+ per 100G port
- Distribution: 190Gbps+ per port-channel

### BGP Convergence
- Route loss to recovery: < 30 seconds
- New prefix advertisement: < 5 seconds

## Scaling Projections

### 6-Month Forecast
- Access port growth: +20%
- Traffic growth: +35%
- Recommendation: No action required

### 12-Month Forecast
- Recommend: Add leaf switches (access)
- Recommendation: Upgrade distribution uplinks to 400G

## Optimization Recommendations

1. Enable jumbo frames (MTU 9216) on all data paths
2. Implement BGP route reflection for scalability
3. Deploy fabric path (if upgrading to Nexus)
4. Monitor and optimize ACL performance

## Monitoring Metrics

Track these KPIs:
- Link utilization (all interfaces)
- BGP convergence time
- Application round-trip time
- Device CPU/memory trending
- Interface error rates
            """,
            category="capacity",
            tags=["performance", "capacity", "planning", "scaling"]
        ),

        Document(
            doc_id="change_001",
            title="Recent Network Changes - Change History",
            content="""
# Network Change History

## March 2024 Changes

### 2024-03-15: VLAN 29 Expansion
- Expanded management VLAN subnet from /25 to /24
- Old: 192.168.100.0/25 (gateway .1)
- New: 192.168.100.0/24 (gateway .1)
- Devices affected: All core and distribution switches
- Impact: No downtime, online migration
- Ticket: CHG-2024-0315
- Completed by: John Smith (NetOps)

### 2024-03-01: BGP Peer Addition
- Added NEXUS-CORE-02 BGP peer
- New neighbor: 10.1.2.254 (SPINE-02)
- Remote AS: 65000
- Configuration: Full redundancy with NEXUS-CORE-01
- Impact: Load balancing improvement
- Ticket: CHG-2024-0301
- Completed by: Jane Doe (NetOps)

## February 2024 Changes

### 2024-02-20: Port Channel Upgrade
- Upgraded CAT6509-DIST-01 uplink from LAG-1Gbps to LAG-2x100Gbps
- Technology: Port-channel aggregation
- Bandwidth increase: 1Gbps -> 200Gbps
- Impact: Temporary 30-second outage during cutover
- Ticket: CHG-2024-0220
- Completed by: Mike Wilson (NetOps)

### 2024-02-05: ACL Hardening
- Applied stricter management ACLs
- Restricted SSH to management network only
- Added SNMP community restrictions
- Impact: No production impact
- Security review: Approved
- Ticket: CHG-2024-0205

## Rollback Procedures

All changes have documented rollback:
- Previous configuration backed up to version control
- Rollback time: < 5 minutes
- Verification steps: Documented in each change ticket
- Post-rollback monitoring: Required

## Upcoming Changes

- Q2 2024: Upgrade CAT6509 to latest OS version
- Q2 2024: Add new access switch in building B
- Q3 2024: Implement route reflectors for scale
            """,
            category="operations",
            tags=["changes", "history", "maintenance", "configuration"]
        ),

        Document(
            doc_id="vlan_001",
            title="VLAN Configuration and Management",
            content="""
# VLAN Configuration and Management Guide

## Configured VLANs

### VLAN 29 - Management Network
- Subnet: 192.168.100.0/24
- Gateway: 192.168.100.1
- Purpose: Device management, monitoring
- Devices: All switches (NEXUS-CORE-01, CAT6509-DIST-01, etc.)
- Services depending on this VLAN: SSH, SNMP, NTP, Syslog
- Access: Restricted to management network

### VLAN 100 - Production Data Network
- Subnet: 10.100.0.0/24
- Gateway: 10.100.0.1
- Purpose: Production application traffic
- Access Layer: All access switches
- Services: Web servers, databases, application servers
- Dependencies: CAT6509-DIST-01 (distribution)
- SLA: 99.95% availability required

### VLAN 200 - Services Network
- Subnet: 10.200.0.0/24
- Gateway: 10.200.0.1
- Purpose: Infrastructure services
- Services: DNS, DHCP, NTP, centralized logging
- Dependencies: All devices rely on this
- Critical: DNS and DHCP failure affects all devices

### VLAN 300 - Guest Network
- Subnet: 10.200.50.0/24
- Gateway: 10.200.50.1
- Purpose: Guest and contractor network
- Isolation: Separate from production
- Restrictions: No access to VLAN 100 or 200
- Access: Guest WiFi and visitor ports

## VLAN Dependencies

### What Services Depend on VLAN 29?
- All network device management
- SNMP monitoring for all devices
- SSH connections for configuration
- NTP time synchronization
- Syslog collection infrastructure

### What Services Depend on VLAN 100?
- Production application servers
- Customer-facing web services
- Database servers
- File servers
- Backup infrastructure

### What Services Depend on VLAN 200?
- ALL devices (requires DNS and DHCP)
- DNS resolution for all services
- DHCP IP allocation
- NTP time source
- Centralized logging

## Impact Analysis: VLAN 29 Down
- Duration: Management access is lost
- Impact: No remote management possible
- Recovery: Physical console access required
- Mitigation: Out-of-band console server recommended

## Impact Analysis: VLAN 100 Down
- Duration: Production traffic interrupted
- Impact: Web services unavailable
- Recovery: Traffic reroutes via redundant links (30 seconds)
- Mitigation: Already protected via redundancy

## Adding New VLAN

### Procedure
1. Request VLAN in change ticket
2. Choose unused VLAN ID
3. Plan IP subnet (no overlap)
4. Configure on all distribution switches
5. Configure access layer switches
6. Test from client
7. Update documentation

### Required Information
- VLAN ID
- Subnet and gateway IP
- Purpose/description
- Services/applications
- Owner/responsible team
            """,
            category="configuration",
            tags=["vlan", "network", "services", "configuration"]
        ),

        Document(
            doc_id="bgp_001",
            title="BGP Configuration and Peer Management",
            content="""
# BGP Configuration and Peer Management

## BGP Overview in Our Network

### Autonomous System Numbers
- Core (NEXUS): AS 65001
- Distribution (CAT6509): AS 65002
- Spine (External): AS 65000

### BGP Topology
```
SPINE-01 (AS 65000) -- NEXUS-CORE-01 (AS 65001) -- CAT6509-DIST-01 (AS 65002)
SPINE-02 (AS 65000) -- NEXUS-CORE-02 (AS 65001) -- CAT6509-DIST-02 (AS 65002)
```

## BGP Neighbors

### NEXUS-CORE-01 BGP Configuration
Local AS: 65001
BGP Router ID: 10.0.0.1

Neighbors:
1. IP: 10.1.1.254
   - Remote AS: 65000
   - Device: SPINE-01
   - Interface: Ethernet1/1
   - Status: Established
   - Routes received: 250+
   - Routes advertised: 10

2. IP: 10.1.2.254
   - Remote AS: 65000
   - Device: SPINE-02
   - Interface: Ethernet1/2
   - Status: Established
   - Routes received: 250+
   - Routes advertised: 10

### CAT6509-DIST-01 BGP Configuration
Local AS: 65002
BGP Router ID: 10.0.1.1

Neighbors:
1. IP: 10.1.1.1
   - Remote AS: 65001
   - Device: NEXUS-CORE-01
   - Status: Established
   - Routes received: 250+
   - Routes advertised: 15

## BGP Route Filtering

### Prefix Lists
- PL-CORE-OUT: Advertised from core
  - 10.0.0.0/8 (loopbacks and internal)
  - 192.168.100.0/24 (management)

- PL-VLAN100: Production data VLAN
  - 10.100.0.0/24

- PL-VLAN200: Services VLAN
  - 10.200.0.0/24

### Route Maps
- RM-CONN-TO-BGP: Export connected routes
  - Prepend AS path with 65001
  - Applied to neighbor 10.1.1.254

## BGP Best Practices

1. **Always use descriptions** for all neighbors
2. **Enable logging** for neighbor state changes
3. **Use prefix-lists** for filtering
4. **Apply route-maps** for path selection
5. **Monitor route stability** (check for flapping)
6. **Use BFD** for fast convergence (recommended)

## BGP Monitoring Commands

```
show bgp summary all
show bgp neighbors 10.1.1.254
show bgp process
show ip bgp summary
debug ip bgp updates (use with caution)
```

## BGP Issues and Resolution

### Neighbor Flapping
- Check link stability
- Verify configuration matches
- Check for CPU issues on peer
- Enable BFD for faster convergence

### Route Instability
- Check for config conflicts
- Verify no routing loops
- Review prefix-lists
- Check for BGP convergence delays
            """,
            category="configuration",
            tags=["bgp", "routing", "configuration", "neighbors"]
        ),

        Document(
            doc_id="stp_001",
            title="Spanning Tree Protocol Configuration",
            content="""
# Spanning Tree Protocol Configuration

## STP Mode: RSTP (Rapid Spanning Tree)

### Overview
- Mode: Rapid PVST+ per VLAN
- BpduGuard: Enabled on access ports
- PortFast: Enabled on edge ports
- Hello time: 2 seconds
- Forward delay: 15 seconds
- Max age: 20 seconds

## Root Bridge Selection

### VLAN 1 (Default/Native)
- Root Bridge: CAT6509-DIST-01
- Root ID: 32768:00:11:22:33:44:55
- Priority: 24576 (configured)

### VLAN 100 (Data VLAN)
- Root Bridge: CAT6509-DIST-01
- Priority: 24576

### VLAN 200 (Services VLAN)
- Root Bridge: CAT6509-DIST-01
- Priority: 24576

### VLAN 300 (Guest VLAN)
- Root Bridge: CAT6509-DIST-01
- Priority: 24576

## Port Roles and States

### Uplink Ports (to Core)
- Role: Root port
- State: Forwarding
- BpduGuard: Disabled
- Portfast: Disabled

### Access Ports
- Role: Designated port
- State: Forwarding (after portfast)
- BpduGuard: Enabled
- Portfast: Enabled

### Blocked Ports
- Role: Alternate port
- State: Blocking (provides redundancy)
- Cost: Higher than active path

## STP Stability

### What If NEXUS-CORE-01 Ethernet1/1 Goes Down?

1. Link fails
2. CAT6509-DIST-01 detects failure
3. Root bridge still accessible via Ethernet1/2
4. No topology change (redundant path exists)
5. Traffic continues on backup link (Port-channel1)
6. Convergence time: < 30 seconds

### Impact Assessment: Link Failure
- Affected: Traffic on that link only
- Recovery: Automatic via Port-channel
- Monitoring: Check spanning-tree topology

## STP Monitoring

```
show spanning-tree summary
show spanning-tree vlan 100 root
show spanning-tree interface Ethernet1/1
show spanning-tree blockedports
```

## Common STP Issues

### Bridge ID Collision
- Can occur if priorities misconfigured
- Fix: Ensure unique bridge IDs per VLAN
- Verify: show spanning-tree vlan X

### BPDU Flooding
- Symptom: High CPU on affected port
- Fix: Check BpduGuard on edge ports
- Verify: show spanning-tree summary

### Slow Convergence
- If > 30 seconds, check timer values
- Consider enabling BFD on critical links
- Verify path costs are calculated correctly
            """,
            category="configuration",
            tags=["stp", "spanning-tree", "loop-prevention", "redundancy"]
        ),

        Document(
            doc_id="monitoring_001",
            title="Network Monitoring and Alerting Strategy",
            content="""
# Network Monitoring and Alerting Strategy

## Monitoring Infrastructure

### Monitoring Tool: Prometheus + Grafana
- Polling interval: 30 seconds
- Retention: 15 days
- Storage: 500GB

### Syslog Aggregation
- Server: 10.0.0.200
- Facility: LOCAL0
- Retention: 90 days
- Alerts: Any ERROR or CRITICAL

### SNMP Polling
- Community: public (read-only)
- Devices: All switches and routers
- OID targets: System, interfaces, BGP

## Key Metrics

### Device Health
- CPU utilization (alert > 80%)
- Memory utilization (alert > 85%)
- Temperature (alert > 65C)
- Fan status (alert on failure)
- Power supply status (alert on failure)

### Link Health
- Interface up/down state
- Interface errors (alert > 0.1%)
- Interface discards (alert > 0.01%)
- Broadcast storm (alert > 10K pps)

### BGP Health
- BGP neighbor status (established/down)
- Route count per neighbor
- BGP convergence time
- Route flapping (alert on > 5 flaps/min)

### Performance
- Link utilization
- Latency (inter-device)
- Packet loss
- Traffic trending

## Alert Thresholds

### Critical (Page on-call immediately)
- BGP neighbor down (on critical link)
- Multiple interfaces down
- Device CPU > 95%
- Device unreachable

### High (Create urgent ticket)
- Single interface down
- Link utilization > 85%
- CPU > 80%
- Memory > 85%

### Medium (Create standard ticket)
- Link utilization > 70%
- Interface errors increasing
- Temperature high
- BGP convergence slow

### Low (Daily summary)
- Minor configuration changes
- Non-critical interface flapping
- Routine log entries

## Dashboards

1. **Network Overview**: Core device status, link health
2. **Performance**: Utilization, latency, packet loss
3. **BGP Health**: Neighbor status, route counts
4. **Security**: Access violations, blocked traffic
5. **Capacity**: Growth trending, forecast

## Maintenance Windows

- Alerting disabled during maintenance (with ticket)
- On-call still monitoring for emergencies
- Change window documented in calendar
            """,
            category="operations",
            tags=["monitoring", "alerting", "metrics", "operations"]
        ),

        Document(
            doc_id="disaster_001",
            title="Disaster Recovery and Business Continuity",
            content="""
# Disaster Recovery and Business Continuity Plan

## RTO and RPO Targets

### Tier 1 Services (Critical)
- Production Data VLAN (100): RTO 5 min, RPO 0 min
- Management VLAN (29): RTO 30 min, RPO 0 min

### Tier 2 Services (Important)
- Services VLAN (200): RTO 15 min, RPO 0 min

### Tier 3 Services (Nice-to-have)
- Guest VLAN (300): RTO 1 hour, RPO 1 hour

## Redundancy in Place

### Network Redundancy
- Dual core devices (NEXUS-CORE-01, 02)
- Dual distribution devices (CAT6509-DIST-01, 02)
- Dual uplinks per device (Port-channel)
- RSTP provides automatic failover

### Convergence Times
- BGP neighbor failure: 30 seconds (with BFD < 5 seconds)
- STP topology change: 30 seconds
- Manual failover: Can be done in < 5 minutes

## Backup and Recovery Procedures

### Configuration Backup
- Backup frequency: Daily automated
- Storage: Revision control (Git)
- Retention: 2 years
- Encryption: AES-256

### Device Recovery
- Boot device from: Primary flash
- Fallback: Secondary flash (if configured)
- Recovery image: Always available on USB

### Configuration Recovery Steps
1. Boot device to rommon
2. Reload from primary or secondary
3. Manual config from backup (if needed)
4. Verify routes and neighbors
5. Monitor convergence

## Failure Scenarios and Recovery

### Single Link Failure (e.g., Ethernet1/1 on NEXUS-CORE-01)
- Impact: That link's traffic only
- Automatic recovery: Via Port-channel (< 30 sec)
- Action: Check log for cause
- Monitor: CPU and memory for 1 hour

### Single Device Failure (e.g., NEXUS-CORE-01)
- Impact: Loss of that device's bandwidth
- Automatic recovery: All traffic via NEXUS-CORE-02
- Bandwidth reduction: 50% total capacity
- Recovery: < 30 seconds (BGP failover)

### Dual Core Failure
- Impact: Network unreachable
- Recovery: Requires manual intervention
- Estimated time to restore: 4-8 hours
- Mitigation: Not in current design (edge case)

### Complete Data Center Loss
- Recovery: Failover to secondary site (if exists)
- Estimated RTO: 1-2 hours
- Documentation: Separate DR playbook needed

## Testing and Validation

- Quarterly disaster recovery drills
- Annual full restoration test
- Monthly link failure simulations
- Weekly automated config backups
            """,
            category="operations",
            tags=["disaster-recovery", "backup", "business-continuity", "rto-rpo"]
        ),
    ]


def get_knowledge_base() -> Dict[str, Document]:
    """Get all documents as dictionary indexed by doc_id."""
    docs = get_knowledge_base_documents()
    return {doc.doc_id: doc for doc in docs}
