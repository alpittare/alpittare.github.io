"""LLM client with response generation (simulated for demo)."""
import re
from typing import Dict, Any
from llm.guardrails import OutputGuardrails


class LLMClient:
    """Client for generating responses (simulated with templates)."""

    def __init__(self, model: str = "simulated", temperature: float = 0.7):
        """Initialize LLM client."""
        self.model = model
        self.temperature = temperature

    def generate(
        self,
        prompt: str,
        max_tokens: int = 1024,
        temperature: float = None
    ) -> str:
        """
        Generate response from prompt.

        Args:
            prompt: Full prompt with context
            max_tokens: Maximum response length
            temperature: Sampling temperature

        Returns:
            Generated response
        """
        temp = temperature or self.temperature

        # Extract key information from prompt for intelligent response
        response = self._generate_intelligent_response(prompt, temp)

        # Apply guardrails
        guardrails = OutputGuardrails.filter_response(response)

        return guardrails['filtered']

    def _generate_intelligent_response(self, prompt: str, temperature: float) -> str:
        """Generate intelligent response based on prompt content."""
        prompt_lower = prompt.lower()

        # Determine response type from prompt
        if 'topology' in prompt_lower or 'connected to' in prompt_lower:
            return self._generate_topology_response(prompt)
        elif 'configuration' in prompt_lower or 'config' in prompt_lower:
            return self._generate_config_response(prompt)
        elif 'troubleshoot' in prompt_lower or 'issue' in prompt_lower or 'problem' in prompt_lower:
            return self._generate_troubleshooting_response(prompt)
        elif 'capacity' in prompt_lower or 'performance' in prompt_lower:
            return self._generate_capacity_response(prompt)
        elif 'vlan' in prompt_lower:
            return self._generate_vlan_response(prompt)
        elif 'bgp' in prompt_lower:
            return self._generate_bgp_response(prompt)
        else:
            return self._generate_general_response(prompt)

    def _generate_topology_response(self, prompt: str) -> str:
        """Generate topology-related response."""
        if 'depends on' in prompt.lower() or 'vlan 29' in prompt.lower():
            return """Based on the network architecture documentation, the following services depend on VLAN 29 (Management Network):

1. **Device Management**: All network switches (NEXUS-CORE-01, NEXUS-CORE-02, CAT6509-DIST-01, CAT6509-DIST-02) require VLAN 29 for SSH/Telnet access and configuration management.

2. **SNMP Monitoring**: All network devices use VLAN 29 as the management transport for SNMP polling from the monitoring system (10.0.0.200).

3. **NTP Time Synchronization**: All network devices synchronize time via NTP servers (10.0.0.100, 10.0.0.101) accessible through VLAN 29.

4. **Syslog Collection**: Centralized logging infrastructure uses VLAN 29 to collect syslog messages from all devices to server 10.0.0.200.

5. **DNS Resolution**: While DNS is technically in VLAN 200, it's queried from VLAN 29 for device configuration management tasks.

**Impact if VLAN 29 is down**: Complete loss of management access to all network devices. Physical console access would be required for recovery.

**Mitigation**: Deploy out-of-band management network (separate from VLAN 29) for critical situations."""

        elif 'nexus' in prompt.lower() and 'ethernet1/1' in prompt.lower():
            return """NEXUS-CORE-01 Ethernet1/1 is the uplink to SPINE-01 (IP 10.1.1.1/24). Here's the impact if this interface goes down:

1. **Direct Impact**: Loss of the Ethernet1/1 link itself - traffic redirects to Ethernet1/2 (backup link to SPINE-02)

2. **BGP Neighbor**: Neighbor 10.1.1.254 on SPINE-01 becomes unreachable, BGP session drops

3. **Route Changes**: Routes learned through SPINE-01 become unavailable. BGP convergence time: ~30 seconds (or <5 seconds with BFD)

4. **Traffic**: All traffic destined through SPINE-01 automatically reroutes through SPINE-02 via Ethernet1/2

5. **Throughput**: Reduced from ~200Gbps to ~100Gbps during the failure until recovery

6. **Services Affected**: Minimal impact due to redundancy (Port-channel1 continues operation)

**Diagnosis**: Check `show interface Ethernet1/1` and `show bgp neighbors 10.1.1.254`

**Recovery**: Fix the link issue, interface automatically comes back up, BGP re-establishes adjacency"""

        return """Based on the network topology documentation, the network uses a spine-and-leaf design:

**Core Layer**: NEXUS-CORE-01 and NEXUS-CORE-02 aggregate traffic to external networks

**Distribution Layer**: CAT6509-DIST-01 and CAT6509-DIST-02 provide VLAN services

**Access Layer**: Multiple access switches connect to the distribution layer

All critical paths are redundant with automatic failover via BGP and Spanning Tree Protocol."""

    def _generate_config_response(self, prompt: str) -> str:
        """Generate configuration-related response."""
        if 'vlan' in prompt.lower():
            return """The network has the following VLANs configured:

**VLAN 29 - Management Network**
- Subnet: 192.168.100.0/24
- Gateway: 192.168.100.1
- Purpose: Device management, SNMP, SSH
- Status: Active on all core and distribution switches

**VLAN 100 - Production Data Network**
- Subnet: 10.100.0.0/24
- Gateway: 10.100.0.1
- Purpose: Production application traffic
- Access interfaces: All access switches have access ports in this VLAN

**VLAN 200 - Services Network**
- Subnet: 10.200.0.0/24
- Gateway: 10.200.0.1
- Purpose: DNS, DHCP, NTP, centralized logging
- Dependency: Critical - all devices depend on this

**VLAN 300 - Guest Network**
- Subnet: 10.200.50.0/24
- Gateway: 10.200.50.1
- Purpose: Guest and contractor access
- Isolation: Separated from production VLANs

All VLANs are trunked across core and distribution switches using 802.1Q encapsulation."""

        elif 'bgp' in prompt.lower():
            return """BGP Configuration Summary:

**NEXUS-CORE-01 (Core Layer)**
- Local AS: 65001
- Router ID: 10.0.0.1
- Neighbors:
  - 10.1.1.254 (SPINE-01, AS 65000)
  - 10.1.2.254 (SPINE-02, AS 65000)
- Prefix-list: PL-CORE-OUT (10.0.0.0/8, 192.168.100.0/24)
- Route-map: RM-CONN-TO-BGP (AS path prepend 65001)
- Address families: IPv4 unicast
- Send community: Extended

**CAT6509-DIST-01 (Distribution Layer)**
- Local AS: 65002
- Router ID: 10.0.1.1
- Neighbor: 10.1.1.1 (NEXUS-CORE-01, AS 65001)
- Advertised VLANs: 100, 200, 300
- Route-map: RM-VLAN-EXPORT (filter by VLAN)

All BGP sessions are in established state with full route exchange."""

        return """Network configuration is based on Cisco Nexus 9000 (core) and Catalyst 6509 (distribution) devices.

Key configuration elements:
- Port-channels for redundancy
- VLANs for traffic separation
- BGP for dynamic routing
- Access-lists for security
- Prefix-lists for route filtering
- Route-maps for path selection"""

    def _generate_troubleshooting_response(self, prompt: str) -> str:
        """Generate troubleshooting response."""
        if 'high cpu' in prompt.lower() or 'cpu' in prompt.lower():
            return """Troubleshooting High CPU on Cisco Nexus:

**Step 1: Verify CPU utilization**
```
show system resources
show processes cpu | head 20
```

**Step 2: Identify process consuming CPU**
Look for processes with high percentage. Common causes:
- BGP process: Check route flapping with `show bgp flap-statistics`
- CMP process: Check for broadcast storms with `show interface counters`
- SDK process: Hardware issue, may need reload

**Step 3: Check for route instability**
```
show bgp summary all
show route-map RM-CONN-TO-BGP
```

**Step 4: Verify interface stability**
```
show interface status | include up
show interface counters errors
```

**Step 5: Review recent changes**
- Check configuration changes from Change Management System
- Verify BGP neighbors are stable
- Look for STP topology changes

**Step 6: Immediate mitigation**
- If critical, reduce log level: `logging console 6`
- Enable BFD on critical BGP peers for faster failover
- Consider configuration rollback if recent changes

**Step 7: Long-term fix**
- Optimize prefix-lists to reduce BGP processing
- Update NX-OS version if known bug exists
- Implement BGP route reflectors for scale"""

        return """Network troubleshooting methodology:

1. **Gather Information**: Verify symptoms, check alerts/logs
2. **Isolate Problem**: Determine scope (device, link, service)
3. **Root Cause Analysis**: Check configurations and device state
4. **Implement Fix**: Apply solution with minimal impact
5. **Verify**: Confirm fix works and no new issues introduced
6. **Document**: Record issue and resolution for future reference"""

    def _generate_capacity_response(self, prompt: str) -> str:
        """Generate capacity/performance response."""
        if 'ip scheme' in prompt.lower() or 'ip addressing' in prompt.lower():
            return """IP Addressing Scheme for the Data Center:

**Management Network (VLAN 29)**
- Subnet: 192.168.100.0/24
- Devices: NEXUS-CORE-01 (192.168.100.11), CAT6509-DIST-01 (192.168.100.10)
- Gateway: 192.168.100.1
- Available hosts: 254
- Current utilization: ~10 devices (4%)

**Production Data Network (VLAN 100)**
- Subnet: 10.100.0.0/24
- Devices: Application servers, web servers, databases
- Gateway: 10.100.0.1
- Available hosts: 254
- Current utilization: ~60 devices (24%)
- Expansion plan: Scale to 10.100.0.0/23 in Q3 2024

**Services Network (VLAN 200)**
- Subnet: 10.200.0.0/24
- Devices: DNS (10.200.0.10), DHCP (10.200.0.20), NTP (10.200.0.30)
- Gateway: 10.200.0.1
- Available hosts: 254
- Critical infrastructure - no expansion needed

**Guest Network (VLAN 300)**
- Subnet: 10.200.50.0/24
- Devices: Guest access points, temporary devices
- Gateway: 10.200.50.1
- Available hosts: 254
- Current utilization: ~15 devices (6%)

**Summary**: All subnets have adequate capacity for current and projected growth. No subnetting conflicts detected. All addresses follow organizational standard."""

        return """Network capacity planning metrics:

- Current link utilization: 15-35% depending on tier
- Available capacity: >60% on all links
- Projected 6-month growth: +35%
- Scaling recommendation: Monitor to 50% before expansion
- Next upgrade target: Distribution uplinks to 400G (12+ months)"""

    def _generate_vlan_response(self, prompt: str) -> str:
        """Generate VLAN-related response."""
        return """VLAN Configuration and Status:

**Active VLANs:**
- VLAN 1: Default VLAN (native VLAN)
- VLAN 29: Management Network (192.168.100.0/24)
- VLAN 100: Production Data (10.100.0.0/24)
- VLAN 200: Services (10.200.0.0/24)
- VLAN 300: Guest Network (10.200.50.0/24)

**VLAN Trunking:**
- All core-to-distribution links: trunked
- Allowed VLANs: 1, 29, 100, 200, 300
- Trunk protocol: 802.1Q
- Native VLAN: 1

**Spanning Tree:**
- Mode: RSTP per VLAN
- Root Bridge: CAT6509-DIST-01 (VLAN 100, 200, 300)
- Portfast enabled on access ports
- BpduGuard enabled on access ports

**VLAN Health Check:**
- All VLANs active and operational
- No STP blocked ports
- All trunks carrying expected VLAN traffic
- No VLAN mismatch issues detected"""

    def _generate_bgp_response(self, prompt: str) -> str:
        """Generate BGP-related response."""
        return """BGP Neighbor Status and Configuration:

**NEXUS-CORE-01 BGP Summary:**
- BGP Process: Enabled
- Local AS: 65001
- Router ID: 10.0.0.1
- Total neighbors: 2
- Established: 2 (100%)

Neighbor Details:
1. 10.1.1.254 (SPINE-01)
   - Remote AS: 65000
   - Status: Established ✓
   - Uptime: 45 days 12 hours
   - Routes received: 250
   - Routes advertised: 10
   - Last reset: N/A

2. 10.1.2.254 (SPINE-02)
   - Remote AS: 65000
   - Status: Established ✓
   - Uptime: 30 days 8 hours
   - Routes received: 250
   - Routes advertised: 10
   - Last reset: Recent (within 30 days)

**Configuration Applied:**
- log-neighbor-changes: Enabled
- bestpath as-path multipath-relax: Enabled
- Prefix-list filtering: PL-CORE-OUT
- Route-map filtering: RM-CONN-TO-BGP (AS path prepend)
- Community propagation: Extended

**No issues detected. All BGP neighbors are stable and passing traffic.**"""

    def _generate_general_response(self, prompt: str) -> str:
        """Generate general response."""
        return """This network uses a modern three-tier hierarchical design with Cisco Nexus and Catalyst switches.

Key features:
- Spine-and-leaf topology for scalability
- BGP for dynamic routing and failover
- VLAN-based traffic segmentation
- Port-channel redundancy
- RSTP for loop prevention
- Comprehensive monitoring and alerting

All critical services are redundant with automated failover capabilities. The network supports high availability with multiple paths for traffic and graceful convergence on failures."""


class ResponseGenerator:
    """Generate complete responses with formatting."""

    def __init__(self, llm_client: LLMClient = None):
        """Initialize response generator."""
        self.llm_client = llm_client or LLMClient()

    def generate_response(
        self,
        rag_result: Dict[str, Any],
        apply_guardrails: bool = True
    ) -> Dict[str, Any]:
        """
        Generate complete response from RAG results.

        Args:
            rag_result: Output from RAG pipeline
            apply_guardrails: Apply safety filters

        Returns:
            Complete response with answer and sources
        """
        # Build prompt
        template_func = rag_result['template_func']
        query = rag_result['query']
        context = rag_result['context']
        prompt = template_func(query, context)

        # Generate answer
        answer = self.llm_client.generate(prompt)

        # Format response
        reranked_docs = rag_result['reranked_docs']
        sources = [doc for doc, _ in reranked_docs]
        relevance_scores = [score for _, score in reranked_docs]

        response = {
            'query': query,
            'intent': rag_result['intent'],
            'intent_confidence': rag_result['intent_confidence'],
            'answer': answer,
            'sources': sources,
            'relevance_scores': relevance_scores,
            'num_sources': len(sources)
        }

        # Apply guardrails
        if apply_guardrails:
            guardrail_result = OutputGuardrails.filter_response(answer)
            response['answer'] = guardrail_result['filtered']
            response['safety_check'] = {
                'has_credentials': guardrail_result['has_credentials'],
                'has_pii': guardrail_result['has_pii'],
                'hallucination_risk': guardrail_result['hallucination_risk'],
                'is_safe': guardrail_result['is_safe']
            }

        return response
