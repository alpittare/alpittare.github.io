"""
Tests for Simulation Engine

Tests the change simulation functionality including ADD, MODIFY, DELETE operations.
"""

import pytest
import networkx as nx
from datetime import datetime

from src.services.simulation_engine import (
    SimulationEngine, SimulationRequest, SimulationResult,
    ChangeType, ChangeResult
)


@pytest.fixture
def mock_neo4j():
    """Mock Neo4j client."""
    class MockNeo4j:
        def execute_query(self, query, params=None):
            # Return mock topology
            return [
                {
                    'n': {'id': 'device-1', 'name': 'Device 1', 'type': 'device'},
                    'r': {'type': 'CONTAINS'},
                    'm': {'id': 'service-1', 'name': 'Service 1', 'type': 'service'}
                },
                {
                    'n': {'id': 'service-1', 'name': 'Service 1', 'type': 'service'},
                    'r': {'type': 'DEPENDS_ON'},
                    'm': {'id': 'service-2', 'name': 'Service 2', 'type': 'service'}
                }
            ]
    return MockNeo4j()


@pytest.fixture
def mock_logger():
    """Mock logger."""
    import logging
    return logging.getLogger('test')


@pytest.fixture
def simulation_engine(mock_neo4j, mock_logger):
    """Create simulation engine instance."""
    return SimulationEngine(mock_neo4j, None, mock_logger)


class TestSimulationEngine:
    """Test simulation engine functionality."""

    def test_load_current_topology(self, simulation_engine):
        """Test loading current topology."""
        graph = simulation_engine._load_current_topology()

        assert graph is not None
        assert isinstance(graph, nx.DiGraph)
        assert graph.number_of_nodes() == 2
        assert graph.number_of_edges() == 1

    def test_clone_graph(self, simulation_engine):
        """Test graph cloning."""
        original = nx.DiGraph()
        original.add_node('a', value=1)
        original.add_node('b', value=2)
        original.add_edge('a', 'b', weight=1.5)

        cloned = simulation_engine._clone_graph(original)

        # Verify clone is independent
        assert cloned.number_of_nodes() == original.number_of_nodes()
        assert cloned.number_of_edges() == original.number_of_edges()

        # Modify clone and verify original unchanged
        cloned.add_node('c')
        assert cloned.number_of_nodes() != original.number_of_nodes()

    def test_apply_add_operation(self, simulation_engine):
        """Test ADD (create) operation."""
        graph = nx.DiGraph()
        graph.add_node('service-1', name='Service 1', type='service')
        graph.add_node('service-2', name='Service 2', type='service')

        request = SimulationRequest(
            request_id='sim-1',
            change_type=ChangeType.ADD,
            scope='service-3',
            proposed_change={
                'name': 'Service 3',
                'type': 'service',
                'criticality': 'high',
                'dependencies': ['service-1']
            }
        )

        result = simulation_engine._apply_add(graph, request)

        assert result.success
        assert 'service-3' in graph.nodes()
        assert ('service-3', 'service-1') in graph.edges()

    def test_apply_add_with_missing_dependency(self, simulation_engine):
        """Test ADD operation with missing dependency."""
        graph = nx.DiGraph()
        graph.add_node('service-1', name='Service 1', type='service')

        request = SimulationRequest(
            request_id='sim-1',
            change_type=ChangeType.ADD,
            scope='service-2',
            proposed_change={
                'name': 'Service 2',
                'dependencies': ['service-nonexistent']
            }
        )

        result = simulation_engine._apply_add(graph, request)

        assert not result.success
        assert len(result.errors) > 0

    def test_apply_modify_operation(self, simulation_engine):
        """Test MODIFY (update) operation."""
        graph = nx.DiGraph()
        graph.add_node('service-1', name='Service 1', status='operational')

        request = SimulationRequest(
            request_id='sim-1',
            change_type=ChangeType.MODIFY,
            scope='service-1',
            proposed_change={
                'status': 'degraded',
                'criticality': 'high'
            }
        )

        result = simulation_engine._apply_modify(graph, request)

        assert result.success
        assert graph.nodes['service-1']['status'] == 'degraded'
        assert graph.nodes['service-1']['criticality'] == 'high'

    def test_apply_delete_operation(self, simulation_engine):
        """Test DELETE (remove) operation."""
        graph = nx.DiGraph()
        graph.add_node('service-1', name='Service 1')
        graph.add_node('service-2', name='Service 2')
        graph.add_edge('service-2', 'service-1')

        request = SimulationRequest(
            request_id='sim-1',
            change_type=ChangeType.DELETE,
            scope='service-1',
            proposed_change={}
        )

        result = simulation_engine._apply_delete(graph, request)

        assert result.success
        assert 'service-1' not in graph.nodes()

    def test_apply_delete_with_dependents(self, simulation_engine):
        """Test DELETE operation with dependent services."""
        graph = nx.DiGraph()
        graph.add_node('service-1', name='Service 1')
        graph.add_node('service-2', name='Service 2')
        graph.add_edge('service-2', 'service-1')

        request = SimulationRequest(
            request_id='sim-1',
            change_type=ChangeType.DELETE,
            scope='service-1',
            proposed_change={}
        )

        # Add predecessor (dependent)
        result = simulation_engine._apply_delete(graph, request)

        # Should fail because service-2 depends on service-1
        assert not result.success
        assert len(result.errors) > 0

    def test_run_validations(self, simulation_engine):
        """Test graph validation."""
        graph = nx.DiGraph()
        graph.add_node('service-1', name='Service 1')
        graph.add_node('service-2', name='Service 2')
        graph.add_edge('service-1', 'service-2')

        request = SimulationRequest(
            request_id='sim-1',
            change_type=ChangeType.ADD,
            scope='service-1',
            proposed_change={}
        )

        result = simulation_engine._run_validations(graph, request)

        assert result.all_passed or len(result.errors) == 0

    def test_calculate_blast_radius(self, simulation_engine):
        """Test blast radius calculation."""
        graph = nx.DiGraph()
        graph.add_node('service-1', name='Service 1', type='service')
        graph.add_node('service-2', name='Service 2', type='service')
        graph.add_node('service-3', name='Service 3', type='service')
        graph.add_edge('service-1', 'service-2')
        graph.add_edge('service-2', 'service-3')

        request = SimulationRequest(
            request_id='sim-1',
            change_type=ChangeType.MODIFY,
            scope='service-1',
            proposed_change={}
        )

        blast_radius = simulation_engine._calculate_blast_radius(graph, request)

        assert 'affected_services' in blast_radius
        assert 'affected_devices' in blast_radius
        assert blast_radius['total_affected'] >= 0

    def test_plan_rollback_for_add(self, simulation_engine):
        """Test rollback planning for ADD operation."""
        request = SimulationRequest(
            request_id='sim-1',
            change_type=ChangeType.ADD,
            scope='service-1',
            proposed_change={'name': 'Service 1'}
        )

        rollback = simulation_engine._plan_rollback(nx.DiGraph(), request)

        assert rollback is not None
        assert 'steps' in rollback
        assert rollback['total_duration_minutes'] > 0

    def test_plan_rollback_for_modify(self, simulation_engine):
        """Test rollback planning for MODIFY operation."""
        request = SimulationRequest(
            request_id='sim-1',
            change_type=ChangeType.MODIFY,
            scope='service-1',
            proposed_change={'parameter': 'value'}
        )

        rollback = simulation_engine._plan_rollback(nx.DiGraph(), request)

        assert rollback is not None
        assert len(rollback['steps']) > 0

    def test_plan_rollback_for_delete(self, simulation_engine):
        """Test rollback planning for DELETE operation."""
        request = SimulationRequest(
            request_id='sim-1',
            change_type=ChangeType.DELETE,
            scope='service-1',
            proposed_change={}
        )

        rollback = simulation_engine._plan_rollback(nx.DiGraph(), request)

        assert rollback is not None
        assert rollback['automated']

    def test_simulate_change_success(self, simulation_engine):
        """Test complete change simulation."""
        request = SimulationRequest(
            request_id='sim-1',
            change_type=ChangeType.ADD,
            scope='service-1',
            proposed_change={'name': 'Service 1'},
            include_rollback=True,
            simulate_dependencies=True
        )

        result = simulation_engine.simulate_change(request)

        assert isinstance(result, SimulationResult)
        assert result.request_id == 'sim-1'
        assert result.status in ['success', 'partial_success', 'failed']
        assert result.execution_time_ms > 0

    def test_simulation_confidence_score(self, simulation_engine):
        """Test confidence score calculation."""
        # Perfect validation (no errors or warnings)
        validation_result = type('obj', (object,), {
            'all_passed': True,
            'errors': [],
            'warnings': []
        })()

        confidence = simulation_engine._calculate_confidence(validation_result)
        assert confidence > 0.9

        # Some warnings
        validation_result.warnings = ['warning1', 'warning2']
        confidence = simulation_engine._calculate_confidence(validation_result)
        assert 0.8 < confidence < 0.95

        # With errors
        validation_result.errors = ['error1']
        confidence = simulation_engine._calculate_confidence(validation_result)
        assert confidence == 0.0
