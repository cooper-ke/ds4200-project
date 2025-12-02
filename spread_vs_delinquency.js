// ---- SPREAD vs DELINQUENCY (Drop N/A - No Interpolation) ----

// Helper: compute z-score
function zscore(arr) {
    const mean = d3.mean(arr);
    const std = d3.deviation(arr);
    return arr.map(v => (v - mean) / std);
}

// Add error handling for the CSV loading
d3.csv("merged_mortgage_data.csv")
    .then(raw => {
        console.log("CSV loaded successfully, processing data...");
        
        // ---- 1. CLEAN DATA and DROP N/A values ----
        const data = raw
            .map(d => ({
                date: new Date(d.observation_date),
                delinquency: d.delinquency_rate_interpolated === "" ? null : +d.delinquency_rate_interpolated,
                conforming: d["30yr_conforming_fico740"] === "" ? null : +d["30yr_conforming_fico740"],
                nonconforming: d["30yr_fixed_rate"] === "" ? null : +d["30yr_fixed_rate"]
            }))
            // FILTER OUT rows with missing data
            .filter(d => 
                d.delinquency !== null && !isNaN(d.delinquency) &&
                d.conforming !== null && !isNaN(d.conforming) &&
                d.nonconforming !== null && !isNaN(d.nonconforming)
            )
            .sort((a, b) => a.date - b.date);

        console.log("Valid data points after dropping N/A:", data.length);

        if (data.length < 10) {
            d3.select("#visualization")
                .append("div")
                .style("color", "red")
                .style("padding", "20px")
                .text(`Insufficient data: only ${data.length} rows have all required values (conforming rate, delinquency, and fixed rate).`);
            return;
        }

        // ---- 2. Compute spread ----
        data.forEach(d => {
            d.spread = d.nonconforming - d.conforming;
        });

        // ---- 3. Compute Z-scores ----
        const spreadZ = zscore(data.map(d => d.spread));
        const delinZ = zscore(data.map(d => d.delinquency));
        
        data.forEach((d, i) => {
            d.spreadZ = spreadZ[i];
            d.delinZ = delinZ[i];
        });

        console.log("Data processing complete, creating visualization...");

        // ---- 4. Create the scatterplot ----
        const width = 800;
        const height = 500;
        const margin = {top: 50, right: 40, bottom: 60, left: 60};
        
        // Clear any existing content first
        d3.select("#visualization").selectAll("*").remove();
        
        const svg = d3.select("#visualization")
            .append("svg")
            .attr("width", width)
            .attr("height", height);

        const x = d3.scaleLinear()
            .domain(d3.extent(data, d => d.spreadZ))
            .range([margin.left, width - margin.right]);

        const y = d3.scaleLinear()
            .domain(d3.extent(data, d => d.delinZ))
            .range([height - margin.bottom, margin.top]);

        // Axes
        svg.append("g")
            .attr("transform", `translate(0, ${height - margin.bottom})`)
            .call(d3.axisBottom(x));

        svg.append("g")
            .attr("transform", `translate(${margin.left}, 0)`)
            .call(d3.axisLeft(y));

        // Points
        svg.append("g")
            .selectAll("circle")
            .data(data)
            .enter()
            .append("circle")
            .attr("cx", d => x(d.spreadZ))
            .attr("cy", d => y(d.delinZ))
            .attr("r", 2.5)
            .attr("fill", "steelblue")
            .attr("opacity", 0.6);

        // Compute and draw regression line
        const meanX = d3.mean(data, d => d.spreadZ);
        const meanY = d3.mean(data, d => d.delinZ);
        
        const numerator = d3.sum(data, d => (d.spreadZ - meanX) * (d.delinZ - meanY));
        const denominator = d3.sum(data, d => Math.pow(d.spreadZ - meanX, 2));
        const slope = numerator / denominator;
        const intercept = meanY - slope * meanX;
        
        const correlation = numerator / Math.sqrt(
            d3.sum(data, d => Math.pow(d.spreadZ - meanX, 2)) *
            d3.sum(data, d => Math.pow(d.delinZ - meanY, 2))
        );

        const xExtent = d3.extent(data, d => d.spreadZ);
        svg.append("line")
            .attr("x1", x(xExtent[0]))
            .attr("y1", y(slope * xExtent[0] + intercept))
            .attr("x2", x(xExtent[1]))
            .attr("y2", y(slope * xExtent[1] + intercept))
            .attr("stroke", "red")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "5,5");

        // Title with correlation
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", margin.top - 20)
            .attr("text-anchor", "middle")
            .style("font-size", "20px")
            .style("font-weight", "600")
            .text(`Spread vs Delinquency (Z-Scores) — r = ${correlation.toFixed(3)}`);

        // X label
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", height - 15)
            .attr("text-anchor", "middle")
            .style("font-size", "14px")
            .text("Spread Z-Score");

        // Y label
        svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", -height / 2)
            .attr("y", 20)
            .attr("text-anchor", "middle")
            .style("font-size", "14px")
            .text("Delinquency Z-Score");

        // Info text
        svg.append("text")
            .attr("x", width - margin.right)
            .attr("y", margin.top - 5)
            .attr("text-anchor", "end")
            .style("font-size", "12px")
            .style("fill", "#666")
            .text(`n = ${data.length} days`);

        console.log("Visualization created successfully!");
    })
    .catch(error => {
        console.error("Error loading or processing data:", error);
        d3.select("#visualization")
            .append("div")
            .style("color", "red")
            .style("padding", "20px")
            .text("Error loading data. Check console for details.");
    });
