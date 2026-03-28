"""
Generate synthetic 90-day historical telemetry with realistic patterns.
Includes daily and weekly seasonality, anomalies, and trend.
"""
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, Tuple
import logging

logger = logging.getLogger(__name__)


class TelemetryGenerator:
    """Generate realistic network telemetry data."""

    def __init__(self, seed: int = 42):
        """
        Initialize generator.
        
        Args:
            seed: Random seed for reproducibility
        """
        np.random.seed(seed)
        self.seed = seed

    def generate_interface_data(self, interface_name: str, days: int = 90, 
                               interval_minutes: int = 5) -> Tuple[np.ndarray, np.ndarray, Dict]:
        """
        Generate synthetic interface utilization data.
        
        Args:
            interface_name: Name of interface to generate data for
            days: Number of days of historical data
            interval_minutes: Collection interval
        
        Returns:
            Tuple of (timestamps, utilization_values, metadata)
        """
        # Total data points
        n_points = (days * 24 * 60) // interval_minutes
        
        # Time array
        end_time = datetime.now()
        start_time = end_time - timedelta(days=days)
        timestamps = np.array([
            (start_time + timedelta(minutes=i*interval_minutes)).timestamp()
            for i in range(n_points)
        ])
        
        # Base utilization (trending upward)
        trend = np.linspace(30, 50, n_points)
        
        # Daily seasonality (higher during business hours)
        daily_cycle = 288  # 24 hours * 12 (5-min intervals)
        daily_pattern = np.zeros(n_points)
        
        for i in range(n_points):
            hour_of_day = (i % daily_cycle) / 12  # Convert to hours
            
            # Peak during business hours (9-17)
            if 9 <= hour_of_day < 17:
                daily_pattern[i] = 15 * np.sin((hour_of_day - 9) / 8 * np.pi)
            else:
                daily_pattern[i] = -10 * np.sin((hour_of_day - 21) / 8 * np.pi) if hour_of_day > 21 or hour_of_day < 9 else 0
        
        # Weekly seasonality (higher on weekdays)
        weekly_pattern = np.zeros(n_points)
        for i in range(n_points):
            day_of_week = (i // daily_cycle) % 7
            
            if day_of_week < 5:  # Weekdays
                weekly_pattern[i] = 5
            else:  # Weekends
                weekly_pattern[i] = -8
        
        # Random noise
        noise = np.random.normal(0, 2, n_points)
        
        # Combine components
        utilization = trend + daily_pattern + weekly_pattern + noise
        
        # Add anomalies (spikes)
        n_anomalies = max(1, n_points // 500)  # Roughly 1 anomaly per 500 points
        anomaly_indices = np.random.choice(n_points, n_anomalies, replace=False)
        
        for idx in anomaly_indices:
            # Create spike or dip
            spike_type = np.random.choice(['spike', 'dip'])
            magnitude = np.random.uniform(10, 20)
            duration = np.random.randint(1, 24)  # 1-24 intervals
            
            for j in range(duration):
                if idx + j < n_points:
                    if spike_type == 'spike':
                        utilization[idx + j] += magnitude
                    else:
                        utilization[idx + j] -= magnitude
        
        # Clip to valid range (0-100%)
        utilization = np.clip(utilization, 0, 100)
        
        # Add interface speed info
        speed_map = {
            'Ethernet1/1': 10000,  # 10G
            'Ethernet1/2': 10000,
            'Ethernet1/3': 10000,
            'Ethernet1/4': 10000,
            'Ethernet2/1': 1000,   # 1G
            'Ethernet2/2': 1000,
            'Ethernet2/3': 1000,
            'Ethernet2/4': 1000,
            'mgmt0': 100            # 100M
        }
        
        metadata = {
            'interface': interface_name,
            'speed_mbps': speed_map.get(interface_name, 1000),
            'status': 'up',
            'mtu': 1500,
            'days_generated': days,
            'total_points': n_points,
            'interval_minutes': interval_minutes
        }
        
        return timestamps, utilization, metadata

    def generate_cpu_memory_data(self, days: int = 90, 
                                 interval_minutes: int = 5) -> Tuple[np.ndarray, Dict[str, np.ndarray]]:
        """
        Generate synthetic CPU and memory utilization.
        
        Args:
            days: Number of days of historical data
            interval_minutes: Collection interval
        
        Returns:
            Tuple of (timestamps, data_dict)
        """
        # Total data points
        n_points = (days * 24 * 60) // interval_minutes
        
        # Time array
        end_time = datetime.now()
        start_time = end_time - timedelta(days=days)
        timestamps = np.array([
            (start_time + timedelta(minutes=i*interval_minutes)).timestamp()
            for i in range(n_points)
        ])
        
        # CPU utilization
        cpu_base = np.linspace(20, 35, n_points)
        cpu_daily = 10 * np.sin(np.arange(n_points) / 288 * 2 * np.pi)
        cpu_noise = np.random.normal(0, 2, n_points)
        cpu_util = np.clip(cpu_base + cpu_daily + cpu_noise, 0, 100)
        
        # Memory utilization
        mem_base = np.linspace(55, 72, n_points)
        mem_noise = np.random.normal(0, 1, n_points)
        mem_util = np.clip(mem_base + mem_noise, 0, 100)
        
        data = {
            'timestamps': timestamps,
            'cpu_percent': cpu_util,
            'memory_percent': mem_util
        }
        
        return timestamps, data

    def generate_routing_data(self, days: int = 90, 
                             interval_minutes: int = 5) -> Tuple[np.ndarray, Dict]:
        """
        Generate synthetic routing table size data.
        
        Args:
            days: Number of days
            interval_minutes: Collection interval
        
        Returns:
            Tuple of (timestamps, route_data)
        """
        n_points = (days * 24 * 60) // interval_minutes
        
        # Time array
        end_time = datetime.now()
        start_time = end_time - timedelta(days=days)
        timestamps = np.array([
            (start_time + timedelta(minutes=i*interval_minutes)).timestamp()
            for i in range(n_points)
        ])
        
        # Generate route counts with slight upward trend
        connected = np.full(n_points, 45)
        static = np.full(n_points, 12)
        bgp = np.linspace(5000, 5200, n_points) + np.random.normal(0, 50, n_points)
        bgp = np.clip(bgp, 4000, 6000)
        ospf = np.linspace(1000, 1100, n_points) + np.random.normal(0, 20, n_points)
        eigrp = np.full(n_points, 300)
        
        route_data = {
            'timestamps': timestamps,
            'connected': connected.astype(int),
            'static': static.astype(int),
            'bgp': bgp.astype(int),
            'ospf': ospf.astype(int),
            'eigrp': eigrp.astype(int),
            'total': (connected + static + bgp + ospf + eigrp).astype(int)
        }
        
        return timestamps, route_data

    @staticmethod
    def save_to_csv(timestamps: np.ndarray, data: np.ndarray, 
                   filename: str, columns: list = None):
        """Save telemetry to CSV file."""
        import csv
        
        if columns is None:
            columns = ['timestamp', 'value']
        
        with open(filename, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(columns)
            
            for ts, val in zip(timestamps, data):
                writer.writerow([ts, val])
        
        logger.info(f"Data saved to {filename}")
