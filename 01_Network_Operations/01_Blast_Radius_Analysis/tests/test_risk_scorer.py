"""
Tests for Risk Scoring Engine

Tests the multi-factor risk assessment functionality.
"""

import pytest
import logging

from src.services.risk_scorer import RiskScorer, RiskLevel
from src.models.dependency import (
    BlastRadius, ServiceImpact, DependencyGraph,
    Criticality
)


@pytest.fixture
def risk_scorer():
    """Create risk scorer instance."""
    return RiskScorer(logger=logging.getLogger('test'))


@pytest.fixture
def mock_blast_radius():
    """Create mock blast radius."""
    br = BlastRadius()
    br.affected_services = {
        'svc-1': ServiceImpact(
            service_id='svc-1',
            service_name='Service 1',
            criticality=Criticality.CRITICAL,
            impact_type='direct',
            affected_users=5000,
            estimated_downtime_minutes=10.0
        ),
        'svc-2': ServiceImpact(
            service_id='svc-2',
            service_name='Service 2',
            criticality=Criticality.HIGH,
            impact_type='transitive',
            affected_users=2000,
            estimated_downtime_minutes=5.0
        )
    }
    br.total_affected_count = 2
    br.estimated_impact_users = 7000
    br.estimated_downtime_minutes = 10.0
    return br


class TestRiskScorer:
    """Test risk scoring functionality."""

    def test_score_criticality_no_services(self, risk_scorer):
        """Test criticality score with no affected services."""
        br = BlastRadius()
        score = risk_scorer._score_criticality(br)

        assert score == 0.0

    def test_score_criticality_with_critical_service(self, risk_scorer, mock_blast_radius):
        """Test criticality score with critical service."""
        score = risk_scorer._score_criticality(mock_blast_radius)

        assert score > 0
        assert score <= 30.0

    def test_score_criticality_multiple_critical(self, risk_scorer):
        """Test criticality score with multiple critical services."""
        br = BlastRadius()
        br.affected_services = {
            'svc-1': ServiceImpact(
                service_id='svc-1',
                service_name='Service 1',
                criticality=Criticality.CRITICAL,
                impact_type='direct'
            ),
            'svc-2': ServiceImpact(
                service_id='svc-2',
                service_name='Service 2',
                criticality=Criticality.CRITICAL,
                impact_type='direct'
            ),
            'svc-3': ServiceImpact(
                service_id='svc-3',
                service_name='Service 3',
                criticality=Criticality.CRITICAL,
                impact_type='direct'
            )
        }

        score = risk_scorer._score_criticality(br)

        # Multiple critical services should increase score
        assert score > 30.0
        assert score <= 30.0 * 1.5  # Max multiplier is 1.5

    def test_score_blast_radius(self, risk_scorer):
        """Test blast radius scoring."""
        # Small blast radius
        score_small = risk_scorer._score_blast_radius(2, 1)
        assert 0 < score_small < 10

        # Medium blast radius
        score_medium = risk_scorer._score_blast_radius(10, 5)
        assert score_medium > score_small

        # Large blast radius
        score_large = risk_scorer._score_blast_radius(100, 50)
        assert score_large > score_medium
        assert score_large <= 25.0  # Max score

    def test_score_complexity_add(self, risk_scorer):
        """Test complexity score for ADD operation."""
        change = {'type': 'add'}
        score = risk_scorer._score_complexity(change)

        assert 15 <= score <= 20

    def test_score_complexity_modify(self, risk_scorer):
        """Test complexity score for MODIFY operation."""
        change = {'type': 'modify'}
        score = risk_scorer._score_complexity(change)

        assert 5 <= score < 15

    def test_score_complexity_delete(self, risk_scorer):
        """Test complexity score for DELETE operation."""
        change = {'type': 'delete'}
        score = risk_scorer._score_complexity(change)

        assert 10 <= score <= 15

    def test_score_complexity_with_components(self, risk_scorer):
        """Test complexity score with multiple components."""
        change = {
            'type': 'modify',
            'components_affected': ['comp1', 'comp2', 'comp3'],
            'requires_rollback_test': True,
            'requires_approval': True
        }
        score = risk_scorer._score_complexity(change)

        assert score > 10

    def test_determine_risk_level_critical(self, risk_scorer):
        """Test risk level determination for critical score."""
        level = risk_scorer._determine_risk_level(85.0)
        assert level == RiskLevel.CRITICAL

    def test_determine_risk_level_high(self, risk_scorer):
        """Test risk level determination for high score."""
        level = risk_scorer._determine_risk_level(70.0)
        assert level == RiskLevel.HIGH

    def test_determine_risk_level_medium(self, risk_scorer):
        """Test risk level determination for medium score."""
        level = risk_scorer._determine_risk_level(50.0)
        assert level == RiskLevel.MEDIUM

    def test_determine_risk_level_low(self, risk_scorer):
        """Test risk level determination for low score."""
        level = risk_scorer._determine_risk_level(30.0)
        assert level == RiskLevel.LOW

    def test_determine_risk_level_minimal(self, risk_scorer):
        """Test risk level determination for minimal score."""
        level = risk_scorer._determine_risk_level(5.0)
        assert level == RiskLevel.MINIMAL

    def test_score_change_complete(self, risk_scorer, mock_blast_radius):
        """Test complete change scoring."""
        change = {
            'type': 'modify',
            'scope': 'service-1',
            'components_affected': ['config1', 'config2']
        }

        risk_score = risk_scorer.score_change(change, mock_blast_radius)

        assert risk_score.total_score >= 0
        assert risk_score.total_score <= 100
        assert risk_score.risk_level in [
            RiskLevel.CRITICAL, RiskLevel.HIGH,
            RiskLevel.MEDIUM, RiskLevel.LOW,
            RiskLevel.MINIMAL
        ]
        assert len(risk_score.factors) == 5
        assert len(risk_score.recommendations) > 0

    def test_approval_required_high_score(self, risk_scorer, mock_blast_radius):
        """Test approval requirement for high risk."""
        change = {'type': 'add', 'components_affected': ['comp1'] * 10}

        risk_score = risk_scorer.score_change(change, mock_blast_radius)

        # High risk score should require approval
        if risk_score.total_score >= 50:
            assert risk_score.approval_required

    def test_approval_not_required_low_score(self, risk_scorer):
        """Test approval not required for low risk."""
        br = BlastRadius()
        change = {'type': 'modify'}

        risk_score = risk_scorer.score_change(change, br)

        # Low risk should not require approval
        if risk_score.total_score < 50:
            assert not risk_score.approval_required

    def test_recommendations_generation(self, risk_scorer):
        """Test recommendation generation."""
        br = BlastRadius()
        br.affected_services = {
            'svc-1': ServiceImpact(
                service_id='svc-1',
                service_name='Service 1',
                criticality=Criticality.CRITICAL,
                impact_type='direct'
            )
        }
        br.estimated_impact_users = 50000

        change = {
            'type': 'add',
            'components_affected': ['comp1', 'comp2']
        }

        risk_score = risk_scorer.score_change(change, br)

        assert len(risk_score.recommendations) > 0
        # Check for specific recommendations
        recommendations_text = ' '.join(risk_score.recommendations).lower()
        assert any(word in recommendations_text for word in [
            'maintenance', 'peer review', 'notification', 'approval'
        ])

    def test_justification_generation(self, risk_scorer, mock_blast_radius):
        """Test justification generation."""
        change = {'type': 'modify'}
        risk_score = risk_scorer.score_change(change, mock_blast_radius)

        assert len(risk_score.justification) > 0
        assert isinstance(risk_score.justification, str)

    def test_risk_factors_explanation(self, risk_scorer, mock_blast_radius):
        """Test risk factors explanation."""
        change = {'type': 'modify'}
        risk_score = risk_scorer.score_change(change, mock_blast_radius)

        assert risk_score.risk_factors is not None
        assert 'criticality' in risk_score.risk_factors
        assert 'blast_radius' in risk_score.risk_factors
        assert 'change_complexity' in risk_score.risk_factors
        assert 'dependency_depth' in risk_score.risk_factors

    def test_score_to_dict(self, risk_scorer, mock_blast_radius):
        """Test risk score conversion to dictionary."""
        change = {'type': 'modify'}
        risk_score = risk_scorer.score_change(change, mock_blast_radius)

        score_dict = risk_score.to_dict()

        assert 'total_score' in score_dict
        assert 'risk_level' in score_dict
        assert 'factors' in score_dict
        assert 'recommendations' in score_dict
        assert 'approval_required' in score_dict

    def test_extract_features(self, risk_scorer):
        """Test feature extraction for ML."""
        change = {
            'type': 'add',
            'components_affected': ['comp1', 'comp2'],
            'requires_rollback_test': True,
            'requires_approval': True
        }

        features = risk_scorer._extract_features(change)

        assert len(features) == 10
        assert all(isinstance(f, float) for f in features)
