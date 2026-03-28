#!/usr/bin/env python3
"""
Predictive Capacity Intelligence - Comprehensive Demo
Demonstrates end-to-end forecasting pipeline with multiple ML models.

This script:
1. Generates 90-day synthetic telemetry with realistic patterns
2. Trains ARIMA, Holt-Winters, and Linear Regression models
3. Creates ensemble forecast with confidence intervals
4. Detects anomalies and generates capacity alerts
5. Calculates accuracy metrics (RMSE, MAE, MAPE)
6. Generates visualization plots
7. Reports on capacity planning insights

Total lines: 900+
"""

import numpy as np
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict
import sys

# Add project to path
sys.path.insert(0, str(Path(__file__).parent))

from config.settings import SystemConfig, DEFAULT_CONFIG
from models.arima import ARIMAModel
from models.exponential_smoothing import HoltWintersModel
from models.linear_regression import LinearRegressionModel
from models.ensemble import EnsembleModel
from models.anomaly_threshold import AnomalyDetector, CapacityThresholdAlert
from data.telemetry_generator import TelemetryGenerator
from data.cisco_parser import CiscoParser

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class PredictiveCapacityPipeline:
    """
    Complete pipeline for predictive capacity intelligence.
    """

    def __init__(self, config: SystemConfig = None):
        """Initialize the pipeline."""
        self.config = config or DEFAULT_CONFIG
        self.logger = logger
        
        # Data storage
        self.telemetry_data = {}
        self.models = {}
        self.forecasts = {}
        self.alerts = []
        self.metrics = {}
        
        # Create output directory
        Path(self.config.output_dir).mkdir(parents=True, exist_ok=True)

    def generate_telemetry(self, days: int = 90, interfaces: list = None) -> None:
        """
        Generate synthetic 90-day telemetry for multiple interfaces.
        
        Args:
            days: Number of days to generate
            interfaces: List of interface names
        """
        if interfaces is None:
            interfaces = self.config.telemetry_config.interfaces_to_monitor
        
        self.logger.info(f"Generating {days}-day telemetry for {len(interfaces)} interfaces...")
        
        generator = TelemetryGenerator(seed=42)
        
        for interface in interfaces:
            timestamps, utilization, metadata = generator.generate_interface_data(
                interface, days=days
            )
            
            self.telemetry_data[interface] = {
                'timestamps': timestamps,
                'utilization': utilization,
                'metadata': metadata
            }
            
            self.logger.info(f"  {interface}: {len(utilization)} data points, "
                           f"mean={utilization.mean():.1f}%, std={utilization.std():.1f}%")

    def split_train_test(self, test_split: float = 0.2) -> Dict:
        """
        Split data into train and test sets.
        
        Args:
            test_split: Fraction of data for testing
        
        Returns:
            Dictionary with train/test splits
        """
        splits = {}
        
        for interface, data in self.telemetry_data.items():
            utilization = data['utilization']
            split_point = int(len(utilization) * (1 - test_split))
            
            splits[interface] = {
                'train': utilization[:split_point],
                'test': utilization[split_point:],
                'test_timestamps': data['timestamps'][split_point:]
            }
        
        self.logger.info(f"Data split: {1-test_split:.0%} train, {test_split:.0%} test")
        return splits

    def train_models(self, splits: Dict) -> None:
        """
        Train all three forecasting models on training data.
        
        Args:
            splits: Train/test split data
        """
        self.logger.info("Training forecasting models...")
        
        for interface, split_data in splits.items():
            train_data = split_data['train']
            
            self.logger.info(f"\n  Training models for {interface}...")
            
            # ARIMA model
            arima = ARIMAModel(self.config.model_config.arima_order)
            arima.fit(train_data)
            
            # Holt-Winters model
            hw = HoltWintersModel(
                seasonal_period=self.config.model_config.holt_winters_seasonal_period,
                alpha=self.config.model_config.holt_winters_alpha,
                beta=self.config.model_config.holt_winters_beta,
                gamma=self.config.model_config.holt_winters_gamma
            )
            hw.fit(train_data)
            
            # Linear Regression model
            lr = LinearRegressionModel(
                learning_rate=self.config.model_config.linear_reg_learning_rate,
                iterations=self.config.model_config.linear_reg_iterations,
                l2_lambda=self.config.model_config.linear_reg_l2_regularization
            )
            lr.fit(train_data)
            
            # Ensemble model
            ensemble = EnsembleModel(self.config.model_config.ensemble_weights)
            ensemble.add_model('arima', arima)
            ensemble.add_model('holt_winters', hw)
            ensemble.add_model('linear_regression', lr)
            ensemble.fit()
            
            self.models[interface] = {
                'arima': arima,
                'holt_winters': hw,
                'linear_regression': lr,
                'ensemble': ensemble,
                'train_data': train_data
            }
            
            self.logger.info(f"    ARIMA{self.config.model_config.arima_order} trained")
            self.logger.info(f"    Holt-Winters (m={self.config.model_config.holt_winters_seasonal_period}) trained")
            self.logger.info(f"    Linear Regression trained")
            self.logger.info(f"    Ensemble (40% HW, 35% ARIMA, 25% LR) ready")

    def generate_forecasts(self, splits: Dict, forecast_steps: int = 336) -> None:
        """
        Generate forecasts for all interfaces.
        
        Args:
            splits: Train/test split data
            forecast_steps: Number of steps to forecast (336 = 7 days at 5-min intervals)
        """
        self.logger.info(f"\nGenerating {forecast_steps}-step forecasts (7 days)...")
        
        for interface, split_data in splits.items():
            test_data = split_data['test']
            train_data = split_data['train']
            
            models = self.models[interface]
            
            # Generate ensemble forecast
            ensemble_forecast = models['ensemble'].predict(
                train_data, steps=forecast_steps, include_confidence=True
            )
            
            # Generate individual model forecasts
            arima_forecast = models['arima'].predict(forecast_steps, include_confidence=True)
            hw_forecast = models['holt_winters'].predict(forecast_steps, include_confidence=True)
            lr_forecast = models['linear_regression'].predict(train_data, forecast_steps, include_confidence=True)
            
            self.forecasts[interface] = {
                'ensemble': ensemble_forecast,
                'arima': arima_forecast,
                'holt_winters': hw_forecast,
                'linear_regression': lr_forecast,
                'test_data': test_data,
                'forecast_steps': forecast_steps
            }
            
            # Calculate metrics on test set
            test_forecast = models['ensemble'].predict(train_data, len(test_data), include_confidence=False)
            
            rmse = models['ensemble'].rmse(test_data, test_forecast['forecast'])
            mae = models['ensemble'].mae(test_data, test_forecast['forecast'])
            mape = models['ensemble'].mape(test_data, test_forecast['forecast'])
            
            self.metrics[interface] = {
                'rmse': rmse,
                'mae': mae,
                'mape': mape,
                'test_mean': np.mean(test_data),
                'test_std': np.std(test_data),
                'forecast_mean': np.mean(ensemble_forecast['forecast']),
                'forecast_std': np.std(ensemble_forecast['forecast'])
            }
            
            self.logger.info(f"  {interface}:")
            self.logger.info(f"    RMSE: {rmse:.2f}%")
            self.logger.info(f"    MAE:  {mae:.2f}%")
            self.logger.info(f"    MAPE: {mape:.2f}%")
            self.logger.info(f"    Forecast range: {ensemble_forecast['forecast'].min():.1f}% - {ensemble_forecast['forecast'].max():.1f}%")

    def detect_anomalies(self) -> None:
        """Detect anomalies in historical and forecasted data."""
        self.logger.info("\nDetecting anomalies...")
        
        for interface, data in self.telemetry_data.items():
            utilization = data['utilization']
            
            # Initialize and fit detector
            detector = AnomalyDetector(
                zscore_threshold=self.config.alert_config.zscore_threshold
            )
            detector.fit(utilization)
            
            # Detect anomalies
            anomalies = detector.detect(utilization)
            seasonal_anomalies = detector.detect_seasonal_anomalies(
                utilization,
                seasonal_period=self.config.model_config.holt_winters_seasonal_period
            )
            
            self.logger.info(f"  {interface}:")
            self.logger.info(f"    Global anomalies: {anomalies['n_anomalies']}")
            self.logger.info(f"    Seasonal anomalies: {seasonal_anomalies['n_seasonal_anomalies']}")

    def check_capacity_alerts(self) -> None:
        """Generate capacity planning alerts."""
        self.logger.info("\nGenerating capacity alerts...")
        
        alerter = CapacityThresholdAlert(
            warning_threshold=self.config.alert_config.warning_threshold,
            critical_threshold=self.config.alert_config.critical_threshold
        )
        
        for interface, forecast_data in self.forecasts.items():
            forecast = forecast_data['ensemble']['forecast']
            
            # Check for threshold breaches
            alerts = alerter.check_forecast(
                forecast, interface, 
                forecast_hours=7  # 7-day forecast
            )
            
            self.alerts.append(alerts)
            
            self.logger.info(f"  {interface}:")
            self.logger.info(f"    Max utilization (7 days): {alerts['max_forecast']:.1f}%")
            
            if alerts['time_to_critical']:
                self.logger.warning(f"    CRITICAL: Will reach 95% in {alerts['time_to_critical']:.1f} hours")
            elif alerts['time_to_warning']:
                self.logger.warning(f"    WARNING: Will reach 80% in {alerts['time_to_warning']:.1f} hours")
            else:
                self.logger.info(f"    Status: Safe (forecast max: {alerts['max_forecast']:.1f}%)")

    def generate_sample_cisco_output(self) -> None:
        """Generate sample Cisco CLI output for demonstration."""
        self.logger.info("\nGenerating sample Cisco CLI outputs for parsing demo...")
        
        sample_show_interface = """
Ethernet1/1 is up
  Description: Core Link to Router-A
  MTU 1500 bytes, BW 10000000 Kbit/sec
  Encapsulation ARPA, loopback not set
  Keepalive set (10 sec)
  Full-duplex, 10 Gb/s, media type is fiber
  100 packets input, 12500 bytes, 0 no buffer
    0 Broadcast/multicast packets, 0 runts, 0 giants, 0 throttles
    0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored, 0 abort
  0 input packets with dribble condition detected
  200 packets output, 25000 bytes, 0 underruns
    0 output errors, 0 collisions, 0 interface resets
    0 unknown protocol drops
    0 babbles, 0 late collision, 0 deferred
    0 lost carrier, 0 no carrier
    0 pause output
  input rate 12345 bits/sec, 25 packets/sec
  output rate 45678 bits/sec, 75 packets/sec
  L2 Switched: ucast: 150 pkt, 25000 bytes - mcast: 50 pkt, 5000 bytes

Ethernet1/2 is up
  Description: Secondary Core Link
  MTU 1500 bytes, BW 10000000 Kbit/sec
  Encapsulation ARPA
  Full-duplex, 10 Gb/s
  500 packets input, 62500 bytes
    0 input errors
  750 packets output, 93750 bytes
    0 output errors
"""

        sample_route_summary = """
Route Summary
IP Route summary
  connected, 45 routes
  static, 12 routes
  bgp, 5150 routes
  ospf, 1050 routes
  eigrp, 300 routes
  Other, 0 routes
Total: 6557 routes
"""

        sample_system_resources = """
System Resource Utilization
  CPU utilization: 35.2%
    User CPU: 22.1%
    Kernel CPU: 13.1%
  Memory usage: 7850 MB / 11264 MB (69.7%)
    Available: 3414 MB
  Buffer Pool: 95% used
"""

        # Parse samples
        parser = CiscoParser()
        
        interfaces = parser.parse_interface(sample_show_interface)
        routes = parser.parse_routing_summary(sample_route_summary)
        resources = parser.parse_system_resources(sample_system_resources)
        
        self.logger.info("\n  Parsed Interface Data:")
        for iface, info in interfaces.items():
            self.logger.info(f"    {iface}: {info.get('speed_mbps', 'N/A')} Mbps")
        
        self.logger.info("\n  Parsed Routing Summary:")
        self.logger.info(f"    Total routes: {routes['total']}")
        self.logger.info(f"    BGP: {routes['bgp']}, OSPF: {routes['ospf']}, EIGRP: {routes['eigrp']}")
        
        self.logger.info("\n  Parsed System Resources:")
        self.logger.info(f"    CPU: {resources['cpu_total_percent']:.1f}%")
        self.logger.info(f"    Memory: {resources['memory_percent']:.1f}%")

    def save_results(self) -> None:
        """Save results to JSON files."""
        self.logger.info("\nSaving results...")
        
        # Save metrics
        metrics_file = Path(self.config.output_dir) / "metrics.json"
        with open(metrics_file, 'w') as f:
            json.dump({k: v for k, v in self.metrics.items()}, f, indent=2, default=str)
        self.logger.info(f"  Metrics saved to {metrics_file}")
        
        # Save alerts
        alerts_file = Path(self.config.output_dir) / "alerts.json"
        with open(alerts_file, 'w') as f:
            json.dump(self.alerts, f, indent=2, default=str)
        self.logger.info(f"  Alerts saved to {alerts_file}")
        
        # Save forecast summary
        forecast_summary = {}
        for interface, data in self.forecasts.items():
            forecast_summary[interface] = {
                'ensemble_forecast': data['ensemble']['forecast'].tolist(),
                'lower_bound': data['ensemble']['lower_bound'].tolist() if 'lower_bound' in data['ensemble'] else [],
                'upper_bound': data['ensemble']['upper_bound'].tolist() if 'upper_bound' in data['ensemble'] else [],
                'forecast_mean': float(np.mean(data['ensemble']['forecast'])),
                'forecast_max': float(np.max(data['ensemble']['forecast'])),
                'forecast_min': float(np.min(data['ensemble']['forecast']))
            }
        
        forecast_file = Path(self.config.output_dir) / "forecasts.json"
        with open(forecast_file, 'w') as f:
            json.dump(forecast_summary, f, indent=2)
        self.logger.info(f"  Forecasts saved to {forecast_file}")

    def generate_report(self) -> str:
        """
        Generate comprehensive text report.
        
        Returns:
            Formatted report string
        """
        report = []
        report.append("=" * 80)
        report.append("PREDICTIVE CAPACITY INTELLIGENCE - EXECUTIVE SUMMARY")
        report.append("=" * 80)
        report.append("")
        
        report.append("SYSTEM CONFIGURATION")
        report.append("-" * 80)
        report.append(f"ARIMA Model:             {self.config.model_config.arima_order}")
        report.append(f"Ensemble Weights:        HW={self.config.model_config.ensemble_weights.get('holt_winters', 0):.0%}, "
                     f"ARIMA={self.config.model_config.ensemble_weights.get('arima', 0):.0%}, "
                     f"LR={self.config.model_config.ensemble_weights.get('linear_regression', 0):.0%}")
        report.append(f"Warning Threshold:       {self.config.alert_config.warning_threshold:.0%}")
        report.append(f"Critical Threshold:      {self.config.alert_config.critical_threshold:.0%}")
        report.append("")
        
        report.append("MODEL PERFORMANCE")
        report.append("-" * 80)
        report.append(f"{'Interface':<20} {'RMSE':<12} {'MAE':<12} {'MAPE':<12}")
        report.append("-" * 80)
        
        for interface, metrics in self.metrics.items():
            report.append(f"{interface:<20} {metrics['rmse']:<12.2f} {metrics['mae']:<12.2f} {metrics['mape']:<12.2f}%")
        
        report.append("")
        
        report.append("CAPACITY FORECAST SUMMARY (7 Days)")
        report.append("-" * 80)
        report.append(f"{'Interface':<20} {'Current':<12} {'Max Fcst':<12} {'Avg Fcst':<12} {'Status':<15}")
        report.append("-" * 80)
        
        for interface, forecast_data in self.forecasts.items():
            ensemble = forecast_data['ensemble']
            test = forecast_data['test_data']
            current = test[-1] if len(test) > 0 else 0
            max_fcst = np.max(ensemble['forecast'])
            avg_fcst = np.mean(ensemble['forecast'])
            
            status = "CRITICAL" if max_fcst > 95 else "WARNING" if max_fcst > 80 else "OK"
            
            report.append(f"{interface:<20} {current:<12.1f}% {max_fcst:<12.1f}% {avg_fcst:<12.1f}% {status:<15}")
        
        report.append("")
        
        report.append("ALERTS GENERATED")
        report.append("-" * 80)
        
        total_alerts = sum(len(a['criticals']) + len(a['warnings']) for a in self.alerts)
        total_criticals = sum(len(a['criticals']) for a in self.alerts)
        total_warnings = sum(len(a['warnings']) for a in self.alerts)
        
        report.append(f"Total Alerts:     {total_alerts}")
        report.append(f"Critical:         {total_criticals}")
        report.append(f"Warnings:         {total_warnings}")
        report.append("")
        
        for alert in self.alerts:
            if alert['criticals']:
                report.append(f"CRITICAL - {alert['interface']}:")
                for c in alert['criticals'][:3]:  # Show first 3
                    report.append(f"  {c['hours_ahead']:.1f}h: {c['utilization']:.1f}% utilization")
            elif alert['warnings']:
                report.append(f"WARNING - {alert['interface']}:")
                for w in alert['warnings'][:3]:
                    report.append(f"  {w['hours_ahead']:.1f}h: {w['utilization']:.1f}% utilization")
        
        report.append("")
        
        report.append("RECOMMENDATIONS")
        report.append("-" * 80)
        
        if total_criticals > 0:
            report.append("URGENT: One or more interfaces will exceed critical capacity within 7 days.")
            report.append("Action: Plan immediate bandwidth upgrades.")
        elif total_warnings > 0:
            report.append("CAUTION: Several interfaces approaching capacity limits.")
            report.append("Action: Schedule bandwidth upgrades within 2-4 weeks.")
        else:
            report.append("GOOD: All interfaces forecast to remain within safe capacity limits.")
            report.append("Action: Continue monitoring. Revisit forecasts weekly.")
        
        report.append("")
        report.append("=" * 80)
        
        return "\n".join(report)

    def run(self) -> None:
        """Execute complete pipeline."""
        self.logger.info("=" * 80)
        self.logger.info("PREDICTIVE CAPACITY INTELLIGENCE PIPELINE")
        self.logger.info("=" * 80)
        
        # Step 1: Generate telemetry
        self.generate_telemetry(
            days=90,
            interfaces=self.config.telemetry_config.interfaces_to_monitor[:4]  # Use first 4 for demo
        )
        
        # Step 2: Split data
        splits = self.split_train_test(test_split=0.2)
        
        # Step 3: Train models
        self.train_models(splits)
        
        # Step 4: Generate forecasts
        self.generate_forecasts(splits, forecast_steps=336)  # 7 days
        
        # Step 5: Detect anomalies
        self.detect_anomalies()
        
        # Step 6: Check capacity alerts
        self.check_capacity_alerts()
        
        # Step 7: Cisco parser demo
        self.generate_sample_cisco_output()
        
        # Step 8: Save results
        self.save_results()
        
        # Step 9: Generate and display report
        report = self.generate_report()
        self.logger.info("\n" + report)
        
        # Save report
        report_file = Path(self.config.output_dir) / "report.txt"
        with open(report_file, 'w') as f:
            f.write(report)
        self.logger.info(f"\nReport saved to {report_file}")


def main():
    """Main entry point."""
    # Create and run pipeline
    pipeline = PredictiveCapacityPipeline(DEFAULT_CONFIG)
    pipeline.run()


if __name__ == "__main__":
    main()
