"""
Tests for Risk Analyzer module
"""

import pytest
import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from risk_analyzer import RiskAnalyzer


@pytest.fixture
def config():
    """Test configuration"""
    return {
        'ai_agent_api_key': 'test_key',
        'ai_model_endpoint': 'https://api.example.com/ai',
        'risk_threshold': 0.75,
        'update_interval': 5000
    }


@pytest.fixture
def risk_analyzer(config):
    """Create RiskAnalyzer instance"""
    return RiskAnalyzer(config)


class TestRiskAnalyzer:
    """Test suite for RiskAnalyzer"""
    
    @pytest.mark.asyncio
    async def test_initialization(self, risk_analyzer):
        """Test risk analyzer initialization"""
        assert risk_analyzer is not None
        assert risk_analyzer.risk_threshold == 0.75
        assert len(risk_analyzer.risk_weights) == 6
    
    @pytest.mark.asyncio
    async def test_amount_anomaly_new_user(self, risk_analyzer):
        """Test amount anomaly detection for new user"""
        sender = "0x1234567890123456789012345678901234567890"
        amount = 100.0
        
        risk = await risk_analyzer._check_amount_anomaly(sender, amount)
        
        # New user should have slight risk
        assert 0.0 <= risk <= 0.5
    
    @pytest.mark.asyncio
    async def test_amount_anomaly_with_history(self, risk_analyzer):
        """Test amount anomaly with transaction history"""
        sender = "0x1234567890123456789012345678901234567890"
        
        # Add transaction history
        for i in range(10):
            risk_analyzer._update_transaction_history(sender, {
                'amount': 100.0,
                'risk_score': 20.0,
                'timestamp': '2024-01-01T00:00:00'
            })
        
        # Test normal amount
        normal_risk = await risk_analyzer._check_amount_anomaly(sender, 100.0)
        assert normal_risk < 0.4
        
        # Test anomalous amount
        anomalous_risk = await risk_analyzer._check_amount_anomaly(sender, 10000.0)
        assert anomalous_risk > 0.5
    
    @pytest.mark.asyncio
    async def test_velocity_check_low(self, risk_analyzer):
        """Test transaction velocity check - low velocity"""
        sender = "0x1234567890123456789012345678901234567890"
        
        # Add minimal history
        risk_analyzer._update_transaction_history(sender, {
            'amount': 100.0,
            'risk_score': 20.0,
            'timestamp': '2024-01-01T00:00:00'
        })
        
        risk = await risk_analyzer._check_transaction_velocity(sender)
        
        # Low velocity should have low risk
        assert risk < 0.3
    
    @pytest.mark.asyncio
    async def test_pattern_detection_round_amount(self, risk_analyzer):
        """Test pattern detection for round amounts"""
        transaction_data = {
            'amount': 1000.0,
            'metadata': {'purpose': 'payment'}
        }
        
        risk = await risk_analyzer._check_patterns(transaction_data)
        
        # Round amount should trigger moderate risk
        assert risk > 0.0
    
    @pytest.mark.asyncio
    async def test_pattern_detection_dust_attack(self, risk_analyzer):
        """Test pattern detection for dust attacks"""
        transaction_data = {
            'amount': 0.001,
            'metadata': {'purpose': 'payment'}
        }
        
        risk = await risk_analyzer._check_patterns(transaction_data)
        
        # Very small amount should trigger risk
        assert risk > 0.5
    
    def test_time_risk_normal_hours(self, risk_analyzer):
        """Test time-based risk for normal hours"""
        timestamp = '2024-01-01T14:00:00'  # 2 PM
        
        risk = risk_analyzer._check_time_risk(timestamp)
        
        # Normal hours should have low risk
        assert risk < 0.3
    
    def test_time_risk_unusual_hours(self, risk_analyzer):
        """Test time-based risk for unusual hours"""
        timestamp = '2024-01-01T03:00:00'  # 3 AM
        
        risk = risk_analyzer._check_time_risk(timestamp)
        
        # Unusual hours should have higher risk
        assert risk > 0.5
    
    def test_metadata_analysis_missing(self, risk_analyzer):
        """Test metadata analysis with missing metadata"""
        metadata = {}
        
        risk = risk_analyzer._analyze_metadata(metadata)
        
        # Missing metadata is suspicious
        assert risk == 0.5
    
    def test_metadata_analysis_suspicious(self, risk_analyzer):
        """Test metadata analysis with suspicious keywords"""
        metadata = {'purpose': 'test hack'}
        
        risk = risk_analyzer._analyze_metadata(metadata)
        
        # Suspicious keywords should trigger high risk
        assert risk > 0.8
    
    def test_metadata_analysis_normal(self, risk_analyzer):
        """Test metadata analysis with normal metadata"""
        metadata = {'purpose': 'invoice payment', 'invoice_id': '12345'}
        
        risk = risk_analyzer._analyze_metadata(metadata)
        
        # Normal metadata should have low risk
        assert risk < 0.3
    
    @pytest.mark.asyncio
    async def test_calculate_risk_score(self, risk_analyzer):
        """Test risk score calculation"""
        risk_factors = {
            'amount_anomaly': 0.3,
            'velocity': 0.2,
            'address_reputation': 0.4,
            'pattern_matching': 0.1,
            'time_based': 0.2,
            'metadata_analysis': 0.1
        }
        
        score = await risk_analyzer.calculate_risk_score(risk_factors)
        
        # Score should be between 0 and 100
        assert 0 <= score <= 100
    
    @pytest.mark.asyncio
    async def test_get_risk_factors(self, risk_analyzer):
        """Test getting all risk factors"""
        transaction_data = {
            'sender': '0x1234567890123456789012345678901234567890',
            'recipient_hash': '0xabcdef',
            'amount': 100.0,
            'metadata': {'purpose': 'payment'},
            'timestamp': '2024-01-01T14:00:00'
        }
        
        factors = await risk_analyzer.get_risk_factors(transaction_data)
        
        # Should return all risk factors
        assert len(factors) == 6
        assert 'amount_anomaly' in factors
        assert 'velocity' in factors
        assert 'address_reputation' in factors
        assert 'pattern_matching' in factors
        assert 'time_based' in factors
        assert 'metadata_analysis' in factors
        
        # All factors should be between 0 and 1
        for factor_name, factor_value in factors.items():
            assert 0 <= factor_value <= 1, f"{factor_name} out of range"
    
    @pytest.mark.asyncio
    async def test_analyze_transaction_low_risk(self, risk_analyzer):
        """Test full transaction analysis - low risk"""
        risk_score = await risk_analyzer.analyze_transaction(
            sender='0x1234567890123456789012345678901234567890',
            recipient_hash='0xabcdef',
            amount=100.0,
            metadata={'purpose': 'invoice payment', 'invoice_id': '12345'}
        )
        
        # Should return a valid risk score
        assert 0 <= risk_score <= 100
        
        # For a normal transaction, should be relatively low
        assert risk_score < 60
    
    @pytest.mark.asyncio
    async def test_analyze_transaction_high_risk(self, risk_analyzer):
        """Test full transaction analysis - high risk"""
        risk_score = await risk_analyzer.analyze_transaction(
            sender='0x1234567890123456789012345678901234567890',
            recipient_hash='0xabcdef',
            amount=0.001,  # Dust amount
            metadata={'purpose': 'hack exploit'}  # Suspicious
        )
        
        # Should return a valid risk score
        assert 0 <= risk_score <= 100
        
        # Suspicious transaction should have higher risk
        assert risk_score > 40
    
    def test_transaction_history_update(self, risk_analyzer):
        """Test transaction history update"""
        sender = "0x1234567890123456789012345678901234567890"
        
        transaction = {
            'amount': 100.0,
            'risk_score': 25.0,
            'timestamp': '2024-01-01T00:00:00'
        }
        
        risk_analyzer._update_transaction_history(sender, transaction)
        
        assert sender in risk_analyzer.transaction_history
        assert len(risk_analyzer.transaction_history[sender]) == 1
        assert risk_analyzer.transaction_history[sender][0] == transaction
    
    def test_transaction_history_limit(self, risk_analyzer):
        """Test transaction history size limit"""
        sender = "0x1234567890123456789012345678901234567890"
        
        # Add more than 100 transactions
        for i in range(150):
            transaction = {
                'amount': float(i),
                'risk_score': 20.0,
                'timestamp': f'2024-01-01T{i % 24:02d}:00:00'
            }
            risk_analyzer._update_transaction_history(sender, transaction)
        
        # Should only keep last 100
        assert len(risk_analyzer.transaction_history[sender]) == 100


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
