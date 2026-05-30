"""
Sustainable Fashion AI/ML Platform — Flask Backend
Run: python app.py
"""

import os
import json
import numpy as np
import pandas as pd
import joblib
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ─── Load Artifacts ─────────────────────────
MODEL_DIR = 'models'
DATA_DIR = 'static/data'

def load_models():
    try:
        rating_model = joblib.load(f'{MODEL_DIR}/rating_model.pkl')
        carbon_model = joblib.load(f'{MODEL_DIR}/carbon_model.pkl')
        scaler_cls = joblib.load(f'{MODEL_DIR}/scaler_cls.pkl')
        scaler_reg = joblib.load(f'{MODEL_DIR}/scaler_reg.pkl')
        encoders_meta = joblib.load(f'{MODEL_DIR}/encoders_meta.pkl')
        return rating_model, carbon_model, scaler_cls, scaler_reg, encoders_meta
    except FileNotFoundError:
        print("⚠️  Models not found. Run: python train_models.py first!")
        return None, None, None, None, None

rating_model, carbon_model, scaler_cls, scaler_reg, encoders_meta = load_models()

def load_json(path):
    try:
        with open(path, 'r') as f:
            return json.load(f)
    except:
        return {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/predictor')
def predictor():
    return render_template('predictor.html')

@app.route('/explorer')
def explorer():
    return render_template('explorer.html')

@app.route('/benchmarks')
def benchmarks():
    return render_template('benchmarks.html')

@app.route('/insights')
def insights():
    return render_template('insights.html')

# ─── API: EDA Stats ─────────────────────────
@app.route('/api/eda')
def api_eda():
    data = load_json(f'{DATA_DIR}/eda_stats.json')
    return jsonify(data)

# ─── API: Benchmark Results ──────────────────
@app.route('/api/benchmarks')
def api_benchmarks():
    cls_data = load_json(f'{DATA_DIR}/cls_results.json')
    reg_data = load_json(f'{DATA_DIR}/reg_results.json')
    meta = {}
    if encoders_meta:
        meta = {
            'best_cls_model': encoders_meta.get('best_cls_model', 'Unknown'),
            'best_reg_model': encoders_meta.get('best_reg_model', 'Unknown'),
        }
    return jsonify({'classification': cls_data, 'regression': reg_data, 'meta': meta})

# ─── API: Options for dropdowns ─────────────
@app.route('/api/options')
def api_options():
    if not encoders_meta:
        return jsonify({'error': 'Models not loaded. Run train_models.py first'}), 500
    return jsonify({
        'countries': encoders_meta['le_country_classes'],
        'materials': encoders_meta['le_material_classes'],
        'markets': encoders_meta['le_market_classes'],
        'certifications': encoders_meta['le_cert_classes'],
        'ratings': encoders_meta['le_rating_classes']
    })

# ─── API: Predict Sustainability Rating ──────
@app.route('/api/predict', methods=['POST'])
def api_predict():
    if not rating_model:
        return jsonify({'error': 'Models not loaded. Run train_models.py first'}), 500

    data = request.get_json()

    try:
        country = data.get('country', 'USA')
        year = int(data.get('year', 2024))
        material = data.get('material', 'Organic Cotton')
        eco_friendly = 1 if data.get('eco_friendly', 'Yes') == 'Yes' else 0
        carbon = float(data.get('carbon', 200))
        water = float(data.get('water', 2000000))
        waste = float(data.get('waste', 50000))
        recycling = 1 if data.get('recycling', 'Yes') == 'Yes' else 0
        product_lines = int(data.get('product_lines', 5))
        avg_price = float(data.get('avg_price', 150))
        market = data.get('market', 'Stable')
        cert = data.get('cert', 'GOTS')

        def encode(le_classes, val, default=0):
            try:
                return list(le_classes).index(val)
            except ValueError:
                return default

        country_enc = encode(encoders_meta['le_country_classes'], country)
        material_enc = encode(encoders_meta['le_material_classes'], material)
        market_enc = encode(encoders_meta['le_market_classes'], market)
        cert_enc = encode(encoders_meta['le_cert_classes'], cert)

        # Compute interaction features
        carbon_per_product = carbon / (product_lines + 1)
        water_per_product  = water  / (product_lines + 1)
        carbon_water_ratio = carbon / (water + 1)
        waste_carbon_ratio = waste  / (carbon + 1)
        price_per_line     = avg_price / (product_lines + 1)
        sustainability_score = eco_friendly + recycling  # 0/1/2

        # Classification features (must match training order exactly)
        X_cls = np.array([[country_enc, year, material_enc, eco_friendly, carbon,
                           water, waste, recycling, product_lines, avg_price,
                           market_enc, cert_enc,
                           carbon_per_product, water_per_product, carbon_water_ratio,
                           waste_carbon_ratio, price_per_line, sustainability_score]])
        X_cls_scaled = scaler_cls.transform(X_cls)
        rating_enc = rating_model.predict(X_cls_scaled)[0]
        rating = encoders_meta['le_rating_classes'][rating_enc]

        # Class probabilities
        proba = rating_model.predict_proba(X_cls_scaled)[0]
        rating_proba = {
            encoders_meta['le_rating_classes'][i]: round(float(p) * 100, 1)
            for i, p in enumerate(proba)
        }

        # Regression features (need rating_enc for regression too)
        X_reg = np.array([[country_enc, year, material_enc, eco_friendly,
                           water, waste, recycling, product_lines, avg_price,
                           market_enc, cert_enc, int(rating_enc),
                           carbon_per_product, water_per_product, price_per_line, sustainability_score]])
        X_reg_scaled = scaler_reg.transform(X_reg)
        predicted_carbon = float(carbon_model.predict(X_reg_scaled)[0])

        # Compute eco score (use stored maxes if available)
        max_carbon_v = encoders_meta.get('max_carbon', 500.0)
        max_water_v  = encoders_meta.get('max_water',  5000000.0)
        max_waste_v  = encoders_meta.get('max_waste',  100000.0)
        eco_score = round(
            (1 - min(carbon, max_carbon_v) / max_carbon_v) * 35 +
            (1 - min(water,  max_water_v)  / max_water_v)  * 25 +
            (1 - min(waste,  max_waste_v)  / max_waste_v)  * 20 +
            eco_friendly * 10 +
            recycling    * 10, 2
        )

        # Generate recommendations
        recommendations = generate_recommendations(
            rating, carbon, water, waste, eco_friendly, recycling, cert, material, eco_score
        )

        return jsonify({
            'rating': rating,
            'rating_confidence': rating_proba,
            'predicted_carbon': round(predicted_carbon, 2),
            'eco_score': eco_score,
            'recommendations': recommendations
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 400


def generate_recommendations(rating, carbon, water, waste, eco_friendly, recycling, cert, material, eco_score):
    recs = []

    if rating in ['C', 'D']:
        recs.append({
            'icon': '🌿',
            'title': 'Switch to Sustainable Materials',
            'detail': f'Your current material ({material}) contributes significantly to environmental impact. Consider switching to Organic Cotton or Tencel which have lower carbon footprints.'
        })
    if carbon > 300:
        recs.append({
            'icon': '💨',
            'title': 'Reduce Carbon Footprint',
            'detail': f'Your carbon footprint of {carbon:.1f} MT is above average. Invest in renewable energy sources and optimize supply chain to reduce emissions.'
        })
    if water > 3000000:
        recs.append({
            'icon': '💧',
            'title': 'Reduce Water Consumption',
            'detail': f'Water usage of {water:,.0f} liters is high. Implement water recycling systems and use water-efficient dyeing processes.'
        })
    if not eco_friendly:
        recs.append({
            'icon': '🏭',
            'title': 'Adopt Eco-Friendly Manufacturing',
            'detail': 'Transitioning to eco-friendly manufacturing processes can boost your sustainability rating significantly and reduce overall environmental impact.'
        })
    if not recycling:
        recs.append({
            'icon': '♻️',
            'title': 'Implement Recycling Programs',
            'detail': 'Starting a recycling take-back program increases brand trust and can improve your sustainability rating by one full grade.'
        })
    if cert == 'None':
        recs.append({
            'icon': '🏆',
            'title': 'Obtain Sustainability Certification',
            'detail': 'Certifications like GOTS, OEKO-TEX or B Corp can significantly improve brand credibility and market trend trajectory.'
        })
    if waste > 60000:
        recs.append({
            'icon': '🗑️',
            'title': 'Reduce Waste Production',
            'detail': f'Waste of {waste:,.0f} KG is high. Adopt zero-waste design principles and donate unsold inventory to reduce production waste.'
        })
    if rating == 'A':
        recs.append({
            'icon': '⭐',
            'title': 'Excellent Sustainability Record!',
            'detail': 'Your brand is among the top sustainability performers. Consider publishing an annual sustainability report to showcase your impact.'
        })
    if not recs:
        recs.append({
            'icon': '✅',
            'title': 'Good Sustainability Practices',
            'detail': 'Your brand shows solid sustainability practices. Keep monitoring key metrics and aim for certification upgrades.'
        })
    return recs[:4]


# ─── API: What-If Simulation ─────────────────
@app.route('/api/whatif', methods=['POST'])
def api_whatif():
    if not rating_model:
        return jsonify({'error': 'Models not loaded'}), 500
    data = request.get_json()
    results = []

    # Simulate changing carbon footprint from low to high
    base = data.copy()
    carbon_range = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500]

    def encode(le_classes, val, default=0):
        try:
            return list(le_classes).index(val)
        except ValueError:
            return default

    country_enc = encode(encoders_meta['le_country_classes'], base.get('country', 'USA'))
    material_enc = encode(encoders_meta['le_material_classes'], base.get('material', 'Organic Cotton'))
    market_enc = encode(encoders_meta['le_market_classes'], base.get('market', 'Stable'))
    cert_enc = encode(encoders_meta['le_cert_classes'], base.get('cert', 'GOTS'))
    eco_friendly = 1 if base.get('eco_friendly', 'Yes') == 'Yes' else 0
    recycling = 1 if base.get('recycling', 'Yes') == 'Yes' else 0

    for c in carbon_range:
        # Compute interaction features for simulation
        carbon_per_product = c / (int(base.get('product_lines', 5)) + 1)
        water_per_product  = float(base.get('water', 2000000)) / (int(base.get('product_lines', 5)) + 1)
        carbon_water_ratio = c / (float(base.get('water', 2000000)) + 1)
        waste_carbon_ratio = float(base.get('waste', 50000)) / (c + 1)
        price_per_line     = float(base.get('avg_price', 150)) / (int(base.get('product_lines', 5)) + 1)
        sustainability_score = eco_friendly + recycling

        X = np.array([[country_enc, int(base.get('year', 2024)), material_enc, eco_friendly,
                       c, float(base.get('water', 2000000)),
                       float(base.get('waste', 50000)), recycling,
                       int(base.get('product_lines', 5)),
                       float(base.get('avg_price', 150)),
                       market_enc, cert_enc,
                       carbon_per_product, water_per_product, carbon_water_ratio,
                       waste_carbon_ratio, price_per_line, sustainability_score]])
        X_scaled = scaler_cls.transform(X)
        rating_enc = rating_model.predict(X_scaled)[0]
        rating = encoders_meta['le_rating_classes'][rating_enc]
        results.append({'carbon': c, 'rating': rating})

    return jsonify(results)


# ─── API: Brand Comparison ───────────────────
@app.route('/api/brands/top')
def api_top_brands():
    data = load_json(f'{DATA_DIR}/eda_stats.json')
    return jsonify(data.get('top_brands', []))


if __name__ == '__main__':
    if not os.path.exists('models/rating_model.pkl'):
        print("⚠️  WARNING: Models not found!")
        print("   Please run: python train_models.py")
    app.run(debug=True, host='0.0.0.0', port=5000)





# """
# Sustainable Fashion AI/ML Platform — Flask Backend
# Run: python app.py
# """

# import os
# import json
# import numpy as np
# import pandas as pd
# import joblib
# from flask import Flask, render_template, request, jsonify
# from flask_cors import CORS

# app = Flask(__name__)
# CORS(app)

# # ─── Load Artifacts ─────────────────────────
# MODEL_DIR = 'models'
# DATA_DIR = 'static/data'

# def load_models():
#     try:
#         rating_model = joblib.load(f'{MODEL_DIR}/rating_model.pkl')
#         carbon_model = joblib.load(f'{MODEL_DIR}/carbon_model.pkl')
#         scaler_cls = joblib.load(f'{MODEL_DIR}/scaler_cls.pkl')
#         scaler_reg = joblib.load(f'{MODEL_DIR}/scaler_reg.pkl')
#         encoders_meta = joblib.load(f'{MODEL_DIR}/encoders_meta.pkl')
#         return rating_model, carbon_model, scaler_cls, scaler_reg, encoders_meta
#     except FileNotFoundError:
#         print("⚠️  Models not found. Run: python train_models.py first!")
#         return None, None, None, None, None

# rating_model, carbon_model, scaler_cls, scaler_reg, encoders_meta = load_models()

# def load_json(path):
#     try:
#         with open(path, 'r') as f:
#             return json.load(f)
#     except:
#         return {}

# @app.route('/')
# def index():
#     return render_template('index.html')

# @app.route('/predictor')
# def predictor():
#     return render_template('predictor.html')

# @app.route('/explorer')
# def explorer():
#     return render_template('explorer.html')

# @app.route('/benchmarks')
# def benchmarks():
#     return render_template('benchmarks.html')

# @app.route('/insights')
# def insights():
#     return render_template('insights.html')

# # ─── API: EDA Stats ─────────────────────────
# @app.route('/api/eda')
# def api_eda():
#     data = load_json(f'{DATA_DIR}/eda_stats.json')
#     return jsonify(data)

# # ─── API: Benchmark Results ──────────────────
# @app.route('/api/benchmarks')
# def api_benchmarks():
#     cls_data = load_json(f'{DATA_DIR}/cls_results.json')
#     reg_data = load_json(f'{DATA_DIR}/reg_results.json')
#     meta = {}
#     if encoders_meta:
#         meta = {
#             'best_cls_model': encoders_meta.get('best_cls_model', 'Unknown'),
#             'best_reg_model': encoders_meta.get('best_reg_model', 'Unknown'),
#         }
#     return jsonify({'classification': cls_data, 'regression': reg_data, 'meta': meta})

# # ─── API: Options for dropdowns ─────────────
# @app.route('/api/options')
# def api_options():
#     if not encoders_meta:
#         return jsonify({'error': 'Models not loaded. Run train_models.py first'}), 500
#     return jsonify({
#         'countries': encoders_meta['le_country_classes'],
#         'materials': encoders_meta['le_material_classes'],
#         'markets': encoders_meta['le_market_classes'],
#         'certifications': encoders_meta['le_cert_classes'],
#         'ratings': encoders_meta['le_rating_classes']
#     })

# # ─── API: Predict Sustainability Rating ──────
# @app.route('/api/predict', methods=['POST'])
# def api_predict():
#     if not rating_model:
#         return jsonify({'error': 'Models not loaded. Run train_models.py first'}), 500

#     data = request.get_json()

#     try:
#         country = data.get('country', 'USA')
#         year = int(data.get('year', 2024))
#         material = data.get('material', 'Organic Cotton')
#         eco_friendly = 1 if data.get('eco_friendly', 'Yes') == 'Yes' else 0
#         carbon = float(data.get('carbon', 200))
#         water = float(data.get('water', 2000000))
#         waste = float(data.get('waste', 50000))
#         recycling = 1 if data.get('recycling', 'Yes') == 'Yes' else 0
#         product_lines = int(data.get('product_lines', 5))
#         avg_price = float(data.get('avg_price', 150))
#         market = data.get('market', 'Stable')
#         cert = data.get('cert', 'GOTS')

#         def encode(le_classes, val, default=0):
#             try:
#                 return list(le_classes).index(val)
#             except ValueError:
#                 return default

#         country_enc = encode(encoders_meta['le_country_classes'], country)
#         material_enc = encode(encoders_meta['le_material_classes'], material)
#         market_enc = encode(encoders_meta['le_market_classes'], market)
#         cert_enc = encode(encoders_meta['le_cert_classes'], cert)

#         # Compute interaction features
#         carbon_per_product = carbon / (product_lines + 1)
#         water_per_product  = water  / (product_lines + 1)
#         carbon_water_ratio = carbon / (water + 1)
#         waste_carbon_ratio = waste  / (carbon + 1)
#         price_per_line     = avg_price / (product_lines + 1)
#         sustainability_score = eco_friendly + recycling  # 0/1/2

#         # Classification features (must match training order exactly)
#         X_cls = np.array([[country_enc, year, material_enc, eco_friendly, carbon,
#                            water, waste, recycling, product_lines, avg_price,
#                            market_enc, cert_enc,
#                            carbon_per_product, water_per_product, carbon_water_ratio,
#                            waste_carbon_ratio, price_per_line, sustainability_score]])
#         X_cls_scaled = scaler_cls.transform(X_cls)
#         rating_enc = rating_model.predict(X_cls_scaled)[0]
#         rating = encoders_meta['le_rating_classes'][rating_enc]

#         # Class probabilities
#         proba = rating_model.predict_proba(X_cls_scaled)[0]
#         rating_proba = {
#             encoders_meta['le_rating_classes'][i]: round(float(p) * 100, 1)
#             for i, p in enumerate(proba)
#         }

#         # Regression features (need rating_enc for regression too)
#         X_reg = np.array([[country_enc, year, material_enc, eco_friendly,
#                            water, waste, recycling, product_lines, avg_price,
#                            market_enc, cert_enc, int(rating_enc),
#                            carbon_per_product, water_per_product, price_per_line, sustainability_score]])
#         X_reg_scaled = scaler_reg.transform(X_reg)
#         predicted_carbon = float(carbon_model.predict(X_reg_scaled)[0])

#         # Compute eco score (use stored maxes if available)
#         max_carbon_v = encoders_meta.get('max_carbon', 500.0)
#         max_water_v  = encoders_meta.get('max_water',  5000000.0)
#         max_waste_v  = encoders_meta.get('max_waste',  100000.0)
#         eco_score = round(
#             (1 - min(carbon, max_carbon_v) / max_carbon_v) * 35 +
#             (1 - min(water,  max_water_v)  / max_water_v)  * 25 +
#             (1 - min(waste,  max_waste_v)  / max_waste_v)  * 20 +
#             eco_friendly * 10 +
#             recycling    * 10, 2
#         )

#         # Generate recommendations
#         recommendations = generate_recommendations(
#             rating, carbon, water, waste, eco_friendly, recycling, cert, material, eco_score
#         )

#         return jsonify({
#             'rating': rating,
#             'rating_confidence': rating_proba,
#             'predicted_carbon': round(predicted_carbon, 2),
#             'eco_score': eco_score,
#             'recommendations': recommendations
#         })

#     except Exception as e:
#         return jsonify({'error': str(e)}), 400


# def generate_recommendations(rating, carbon, water, waste, eco_friendly, recycling, cert, material, eco_score):
#     recs = []

#     if rating in ['C', 'D']:
#         recs.append({
#             'icon': '🌿',
#             'title': 'Switch to Sustainable Materials',
#             'detail': f'Your current material ({material}) contributes significantly to environmental impact. Consider switching to Organic Cotton or Tencel which have lower carbon footprints.'
#         })
#     if carbon > 300:
#         recs.append({
#             'icon': '💨',
#             'title': 'Reduce Carbon Footprint',
#             'detail': f'Your carbon footprint of {carbon:.1f} MT is above average. Invest in renewable energy sources and optimize supply chain to reduce emissions.'
#         })
#     if water > 3000000:
#         recs.append({
#             'icon': '💧',
#             'title': 'Reduce Water Consumption',
#             'detail': f'Water usage of {water:,.0f} liters is high. Implement water recycling systems and use water-efficient dyeing processes.'
#         })
#     if not eco_friendly:
#         recs.append({
#             'icon': '🏭',
#             'title': 'Adopt Eco-Friendly Manufacturing',
#             'detail': 'Transitioning to eco-friendly manufacturing processes can boost your sustainability rating significantly and reduce overall environmental impact.'
#         })
#     if not recycling:
#         recs.append({
#             'icon': '♻️',
#             'title': 'Implement Recycling Programs',
#             'detail': 'Starting a recycling take-back program increases brand trust and can improve your sustainability rating by one full grade.'
#         })
#     if cert == 'None':
#         recs.append({
#             'icon': '🏆',
#             'title': 'Obtain Sustainability Certification',
#             'detail': 'Certifications like GOTS, OEKO-TEX or B Corp can significantly improve brand credibility and market trend trajectory.'
#         })
#     if waste > 60000:
#         recs.append({
#             'icon': '🗑️',
#             'title': 'Reduce Waste Production',
#             'detail': f'Waste of {waste:,.0f} KG is high. Adopt zero-waste design principles and donate unsold inventory to reduce production waste.'
#         })
#     if rating == 'A':
#         recs.append({
#             'icon': '⭐',
#             'title': 'Excellent Sustainability Record!',
#             'detail': 'Your brand is among the top sustainability performers. Consider publishing an annual sustainability report to showcase your impact.'
#         })
#     if not recs:
#         recs.append({
#             'icon': '✅',
#             'title': 'Good Sustainability Practices',
#             'detail': 'Your brand shows solid sustainability practices. Keep monitoring key metrics and aim for certification upgrades.'
#         })
#     return recs[:4]


# # ─── API: What-If Simulation ─────────────────
# @app.route('/api/whatif', methods=['POST'])
# def api_whatif():
#     if not rating_model:
#         return jsonify({'error': 'Models not loaded'}), 500
#     data = request.get_json()
#     results = []

#     # Simulate changing carbon footprint from low to high
#     base = data.copy()
#     carbon_range = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500]

#     def encode(le_classes, val, default=0):
#         try:
#             return list(le_classes).index(val)
#         except ValueError:
#             return default

#     country_enc = encode(encoders_meta['le_country_classes'], base.get('country', 'USA'))
#     material_enc = encode(encoders_meta['le_material_classes'], base.get('material', 'Organic Cotton'))
#     market_enc = encode(encoders_meta['le_market_classes'], base.get('market', 'Stable'))
#     cert_enc = encode(encoders_meta['le_cert_classes'], base.get('cert', 'GOTS'))
#     eco_friendly = 1 if base.get('eco_friendly', 'Yes') == 'Yes' else 0
#     recycling = 1 if base.get('recycling', 'Yes') == 'Yes' else 0

#     for c in carbon_range:
#         # Compute interaction features for simulation
#         carbon_per_product = c / (int(base.get('product_lines', 5)) + 1)
#         water_per_product  = float(base.get('water', 2000000)) / (int(base.get('product_lines', 5)) + 1)
#         carbon_water_ratio = c / (float(base.get('water', 2000000)) + 1)
#         waste_carbon_ratio = float(base.get('waste', 50000)) / (c + 1)
#         price_per_line     = float(base.get('avg_price', 150)) / (int(base.get('product_lines', 5)) + 1)
#         sustainability_score = eco_friendly + recycling

#         X = np.array([[country_enc, int(base.get('year', 2024)), material_enc, eco_friendly,
#                        c, float(base.get('water', 2000000)),
#                        float(base.get('waste', 50000)), recycling,
#                        int(base.get('product_lines', 5)),
#                        float(base.get('avg_price', 150)),
#                        market_enc, cert_enc,
#                        carbon_per_product, water_per_product, carbon_water_ratio,
#                        waste_carbon_ratio, price_per_line, sustainability_score]])
#         X_scaled = scaler_cls.transform(X)
#         rating_enc = rating_model.predict(X_scaled)[0]
#         rating = encoders_meta['le_rating_classes'][rating_enc]
#         results.append({'carbon': c, 'rating': rating})

#     return jsonify(results)


# # ─── API: Brand Comparison ───────────────────
# @app.route('/api/brands/top')
# def api_top_brands():
#     data = load_json(f'{DATA_DIR}/eda_stats.json')
#     return jsonify(data.get('top_brands', []))


# if __name__ == '__main__':
#     if not os.path.exists('models/rating_model.pkl'):
#         print("⚠️  WARNING: Models not found!")
#         print("   Please run: python train_models.py")
#     app.run(debug=True, host='0.0.0.0', port=5000)
