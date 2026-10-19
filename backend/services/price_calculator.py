from datetime import datetime, timezone

def calculate_fair_price(data: dict) -> dict:
    """
    Computes fair, sustainable artisan pricing based on verifiable production cost factors.
    """
    raw_materials = float(data.get("raw_materials_cost", 0))
    labor_cost = float(data.get("labor_cost", 0))
    packaging_cost = float(data.get("packaging_cost", 0))
    overhead_cost = float(data.get("overhead_cost", 0))
    transport_cost = float(data.get("transport_cost", 0))
    other_costs = float(data.get("other_costs", 0))
    
    saleable_units = int(data.get("saleable_units", 1))
    target_gross_margin = float(data.get("target_gross_margin", 0.25)) # default 25%
    
    # Input validations
    errors = []
    if saleable_units <= 0:
        errors.append("Number of saleable units must be greater than zero.")
    if any(c < 0 for c in [raw_materials, labor_cost, packaging_cost, overhead_cost, transport_cost, other_costs]):
        errors.append("Cost inputs cannot be negative.")
    if target_gross_margin < 0 or target_gross_margin >= 0.99:
        errors.append("Target gross margin must be between 0% and 98% (0.0 to 0.98).")
        
    if errors:
        return {"success": False, "errors": errors}
        
    total_production_cost = (
        raw_materials + labor_cost + packaging_cost + overhead_cost + transport_cost + other_costs
    )
    
    unit_cost = total_production_cost / saleable_units
    
    # Suggested price formula: Unit Cost / (1 - Margin)
    suggested_unit_price = unit_cost / (1.0 - target_gross_margin)
    
    total_order_value = suggested_unit_price * saleable_units
    total_gross_profit = total_order_value - total_production_cost
    actual_gross_margin_pct = (total_gross_profit / total_order_value * 100) if total_order_value > 0 else 0
    
    # Tiered bulk discounts calculation
    volume_tiers = [
        {"tier_label": "Standard MOQ", "min_units": saleable_units, "discount_pct": 0, "unit_price": round(suggested_unit_price, 2)},
        {"tier_label": "Bulk Tier 1", "min_units": saleable_units * 3, "discount_pct": 5, "unit_price": round(suggested_unit_price * 0.95, 2)},
        {"tier_label": "Wholesale Tier 2", "min_units": saleable_units * 10, "discount_pct": 10, "unit_price": round(suggested_unit_price * 0.90, 2)}
    ]
    
    warnings = []
    if labor_cost < (raw_materials * 0.3):
        warnings.append("Labor allocation is relatively low compared to material cost. Ensure fair artisan wages are protected.")
    if unit_cost < 20:
        warnings.append("Calculated unit cost is very low; ensure all hidden packaging and local transport overheads are accounted for.")

    cost_breakdown_pct = {
        "raw_materials": round((raw_materials / total_production_cost * 100), 1) if total_production_cost > 0 else 0,
        "labor": round((labor_cost / total_production_cost * 100), 1) if total_production_cost > 0 else 0,
        "packaging": round((packaging_cost / total_production_cost * 100), 1) if total_production_cost > 0 else 0,
        "overhead": round((overhead_cost / total_production_cost * 100), 1) if total_production_cost > 0 else 0,
        "transport_and_other": round(((transport_cost + other_costs) / total_production_cost * 100), 1) if total_production_cost > 0 else 0
    }

    return {
        "success": True,
        "calculation_type": "cost_plus_sustainable_artisan_margin",
        "inputs": {
            "raw_materials_cost": raw_materials,
            "labor_cost": labor_cost,
            "packaging_cost": packaging_cost,
            "overhead_cost": overhead_cost,
            "transport_cost": transport_cost,
            "other_costs": other_costs,
            "saleable_units": saleable_units,
            "target_gross_margin_pct": round(target_gross_margin * 100, 1)
        },
        "summary": {
            "total_production_cost": round(total_production_cost, 2),
            "unit_cost": round(unit_cost, 2),
            "suggested_unit_price": round(suggested_unit_price, 2),
            "total_estimated_order_value": round(total_order_value, 2),
            "estimated_gross_profit": round(total_gross_profit, 2),
            "effective_gross_margin_pct": round(actual_gross_margin_pct, 1),
            "currency": "INR (₹)"
        },
        "cost_breakdown_percentage": cost_breakdown_pct,
        "volume_tiers": volume_tiers,
        "warnings": warnings,
        "disclaimer": "This price is calculated using your entered cost structure and sustainable artisan margin targets. It does not guarantee market transactions or represent a binding quote."
    }
