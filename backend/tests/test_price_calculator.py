from services.price_calculator import calculate_fair_price

def test_price_calculator_formulas():
    data = {
        "raw_materials_cost": 5000,
        "labor_cost": 3000,
        "packaging_cost": 500,
        "overhead_cost": 1000,
        "transport_cost": 500,
        "other_costs": 0,
        "saleable_units": 100,
        "target_gross_margin": 0.20 # 20% margin
    }
    result = calculate_fair_price(data)
    assert result["success"] is True
    
    # Total production cost = 5000 + 3000 + 500 + 1000 + 500 = 10,000
    assert result["summary"]["total_production_cost"] == 10000.0
    # Unit cost = 10,000 / 100 = 100
    assert result["summary"]["unit_cost"] == 100.0
    # Suggested price = 100 / (1 - 0.20) = 125
    assert result["summary"]["suggested_unit_price"] == 125.0
    # Order value = 125 * 100 = 12,500
    assert result["summary"]["total_estimated_order_value"] == 12500.0
    # Gross profit = 12,500 - 10,000 = 2,500
    assert result["summary"]["estimated_gross_profit"] == 2500.0
    assert result["summary"]["effective_gross_margin_pct"] == 20.0
    
    # Check volume tiers
    assert len(result["volume_tiers"]) == 3
    # Check cost breakdown
    assert result["cost_breakdown_percentage"]["raw_materials"] == 50.0
    assert result["cost_breakdown_percentage"]["labor"] == 30.0

def test_price_calculator_validations():
    # Zero units
    res1 = calculate_fair_price({"saleable_units": 0})
    assert res1["success"] is False
    assert "greater than zero" in res1["errors"][0]

    # Negative costs
    res2 = calculate_fair_price({"saleable_units": 10, "raw_materials_cost": -100})
    assert res2["success"] is False
    assert "cannot be negative" in res2["errors"][0]

    # Invalid margin >= 1.0
    res3 = calculate_fair_price({"saleable_units": 10, "target_gross_margin": 1.5})
    assert res3["success"] is False
    assert "Target gross margin" in res3["errors"][0]
