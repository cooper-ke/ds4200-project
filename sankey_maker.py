"""
todo:
make it prettier
Make summary, repotr back on progress

Note: you need the below modules installed

It'll run on a dev server that you can access at http://127.0.0.1:8050/ (by default).
Open that up in your browser to see.

Fully customisable!
"""

import dash
from dash import dcc, html
from dash.dependencies import Input, Output
import plotly.graph_objects as go
import pandas as pd

# Load historical rates
rates_df = pd.read_csv("yearly_mortgage_data.csv")
rate_lookup = dict(zip(rates_df["year"], rates_df["30yr_fixed_rate"] / 100)) # Pre-calculate years to rates

# Generate mortgage nodes (function to update as well)
def generate_mortgage_nodes(mortgage, rate, years):
    # Convert mortgage to thousands
    mortgage = mortgage * 1000
    # Monthly calculations
    monthly_rate = rate / 12
    n_payments = years * 12
    monthly_payment = mortgage * (monthly_rate * (1 + monthly_rate)**n_payments) / ((1 + monthly_rate)**n_payments - 1)
    
    # Then the year-by-year breakdown
    balance = mortgage
    yearly_breakdown = []
    for year in range(years):
        year_principal = year_interest = 0
        for month in range(12): # Iterate monthly for maximum accuracy
            interest_payment = balance * monthly_rate
            principal_payment = monthly_payment - interest_payment
            year_interest += interest_payment
            year_principal += principal_payment
            balance -= principal_payment
        yearly_breakdown.append((year_principal, year_interest))
    
    # Set up initial boxes so they don't change colour distractingly
    label = ["Total Paid", "Principal", "Interest"]

    # Bang into 5-year periods
    groups = [(f"Years {i*5+1}–{(i+1)*5}", i*5, (i+1)*5) for i in range(years // 5)]
    source, target, value = [], [], []
    label.extend([name for name, _, _ in groups])
    
    # Throw 'em into a list
    for index, (name, start, end) in enumerate(groups):
        group_principal = sum(p for p, _ in yearly_breakdown[start:end])
        group_interest = sum(i for _, i in yearly_breakdown[start:end])
        source.extend([index+3, index+3])
        target.extend([1, 2])
        value.extend([group_principal, group_interest])
    
    # Then add the final total payment amounts
    source.extend([1, 2])
    target.extend([0, 0])
    value.extend([mortgage, sum(i for _, i in yearly_breakdown)])
    
    return label, source, target, value

# Set up the app
app = dash.Dash(__name__)

# Lay out the app (mortgage amount too to show that it does not change scale)
app.layout = html.Div([
    html.H1("Mortgage Sankey Diagram"),
    html.Label("Mortgage Amount"),
    dcc.Slider(id="mortgage", min=100, max=900, step=50, value=250, 
               marks={i: f"${i}k" for i in range(0, 901, 100)}), # fancy schamcy f-strings for looks
    
    dcc.RadioItems( # Switch between historical and manual value control
        id="rate-mode",
        options=[
            {"label": "Manual Rate", "value": "manual"},
            {"label": "Historical Rate", "value": "historical"}
        ],
        value="manual",
        inline=True
    ),
    
    html.Div(id="rate-manual", children=[
        html.Label("Interest Rate"),
        dcc.Slider(id="rate", min=0.01, max=0.15, step=0.01, value=0.06,
                   marks={i/100: f"{i}%" for i in range(1, 16, 1)})
    ]),
    
    html.Div(id="rate-historical", style={"display": "none"}, children=[
        html.Label("Historical Year"),
        dcc.Slider(id="hist-year", min=1971, max=2025, step=1, value=2000,
                   marks={i: str(i) for i in range(1970, 2026, 5)})
    ]),
    
    html.Label("Years"),
    dcc.Slider(id="years", min=5, max=30, step=1, value=25,
               marks={i: str(i) for i in range(5, 31, 5)}),
    
    dcc.Graph(id="sankey")
])

@app.callback(
    [Output("rate-manual", "style"),
     Output("rate-historical", "style")],
    Input("rate-mode", "value")
)
def toggle_rate_input(mode):
    if mode == "manual":
        return {"display": "block"}, {"display": "none"}
    return {"display": "none"}, {"display": "block"}

# Recalculate on change
@app.callback(
    Output("sankey", "figure"),
    [Input("mortgage", "value"),
     Input("rate", "value"),
     Input("hist-year", "value"),
     Input("years", "value"),
     Input("rate-mode", "value")]
)
def update_sankey(mortgage, manual_rate, hist_year, years, mode):
    rate = rate_lookup[hist_year] if mode == "historical" else manual_rate
    label, source, target, value = generate_mortgage_nodes(mortgage, rate, years)
    link = {"source": source, "target": target, "value": value,
            "line": {"color": "black", "width": 1}} # Outline links and boxes in black to make 'em look pretty
    node = {"label": label, "pad": 50, "thickness": 100,
            "line": {"color": "black", "width": 1}}
    return go.Figure(go.Sankey(link=link, node=node))

# Run the app!
app.run()
