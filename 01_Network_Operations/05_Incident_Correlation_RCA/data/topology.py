"""
Network topology representation for root cause analysis
"""

from typing import Dict, List, Set, Tuple, Optional
from dataclasses import dataclass, field
import json

@dataclass
class Device:
    device_id: str
    device_type: str
    location: str
    asn: int = 65001
    
    def __hash__(self):
        return hash(self.device_id)
    
    def __eq__(self, other):
        if isinstance(other, Device):
            return self.device_id == other.device_id
        return False

@dataclass
class Link:
    source_device: str
    source_interface: str
    dest_device: str
    dest_interface: str
    link_type: str = "layer3"
    
    def __hash__(self):
        return hash((self.source_device, self.dest_device))

@dataclass
class NetworkTopology:
    devices: Dict[str, Device] = field(default_factory=dict)
    links: List[Link] = field(default_factory=list)
    
    def add_device(self, device: Device):
        self.devices[device.device_id] = device
    
    def add_link(self, link: Link):
        self.links.append(link)
    
    def get_neighbors(self, device_id: str) -> List[str]:
        """Get direct neighbors of a device"""
        neighbors = set()
        for link in self.links:
            if link.source_device == device_id:
                neighbors.add(link.dest_device)
            elif link.dest_device == device_id:
                neighbors.add(link.source_device)
        return list(neighbors)
    
    def get_path(self, source: str, dest: str) -> Optional[List[str]]:
        """BFS to find path between two devices"""
        if source not in self.devices or dest not in self.devices:
            return None
        
        visited = set()
        queue = [(source, [source])]
        
        while queue:
            current, path = queue.pop(0)
            if current == dest:
                return path
            
            if current in visited:
                continue
            visited.add(current)
            
            for neighbor in self.get_neighbors(current):
                if neighbor not in visited:
                    queue.append((neighbor, path + [neighbor]))
        
        return None
    
    def get_distance(self, device1: str, device2: str) -> int:
        """Calculate shortest path distance between two devices"""
        path = self.get_path(device1, device2)
        return len(path) - 1 if path else float('inf')


def create_sample_topology() -> NetworkTopology:
    """Create a realistic enterprise network topology"""
    topo = NetworkTopology()
    
    # Core routers
    core1 = Device("CORE-1", "Nexus9000", "DC1", 65001)
    core2 = Device("CORE-2", "Nexus9000", "DC1", 65001)
    
    # Distribution layer
    dist1 = Device("DIST-1", "Catalyst6509", "DC1-Floor1", 65002)
    dist2 = Device("DIST-2", "Catalyst6509", "DC1-Floor2", 65002)
    dist3 = Device("DIST-3", "Catalyst6509", "DC2", 65003)
    
    # Access layer
    access1 = Device("ACC-1", "Catalyst2960", "DC1-F1-Pod1", 65100)
    access2 = Device("ACC-2", "Catalyst2960", "DC1-F1-Pod2", 65100)
    access3 = Device("ACC-3", "Catalyst2960", "DC1-F2-Pod1", 65100)
    access4 = Device("ACC-4", "Catalyst2960", "DC2-Pod1", 65100)
    access5 = Device("ACC-5", "Catalyst2960", "DC2-Pod2", 65100)
    
    devices = [core1, core2, dist1, dist2, dist3, access1, access2, access3, access4, access5]
    for dev in devices:
        topo.add_device(dev)
    
    # Core-to-Core (redundant)
    topo.add_link(Link("CORE-1", "Eth1/1", "CORE-2", "Eth1/1", "layer3"))
    
    # Core to Distribution (dual uplinks)
    topo.add_link(Link("CORE-1", "Eth2/1", "DIST-1", "Eth1/1", "layer3"))
    topo.add_link(Link("CORE-1", "Eth2/2", "DIST-2", "Eth1/1", "layer3"))
    topo.add_link(Link("CORE-2", "Eth2/1", "DIST-1", "Eth1/2", "layer3"))
    topo.add_link(Link("CORE-2", "Eth2/2", "DIST-2", "Eth1/2", "layer3"))
    
    # Distribution to DC2
    topo.add_link(Link("DIST-1", "Eth2/1", "DIST-3", "Eth1/1", "layer3"))
    topo.add_link(Link("DIST-2", "Eth2/1", "DIST-3", "Eth1/2", "layer3"))
    
    # Distribution to Access
    topo.add_link(Link("DIST-1", "Eth3/1", "ACC-1", "Eth1/1", "layer2"))
    topo.add_link(Link("DIST-1", "Eth3/2", "ACC-2", "Eth1/1", "layer2"))
    topo.add_link(Link("DIST-2", "Eth3/1", "ACC-3", "Eth1/1", "layer2"))
    topo.add_link(Link("DIST-3", "Eth3/1", "ACC-4", "Eth1/1", "layer2"))
    topo.add_link(Link("DIST-3", "Eth3/2", "ACC-5", "Eth1/1", "layer2"))
    
    return topo
