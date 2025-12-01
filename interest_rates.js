const filePath = "data/merged_mortgage_data.csv";

const margin = { top: 40, right: 150, bottom: 50, left: 70 },
      width = 1100 - margin.left - margin.right,
      height = 450 - margin.top - margin.bottom;

const svg = d3.select("#interest_rate_chart")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

d3.csv(filePath).then(data => {

    // Filter: keep rows where all three rates exist
    const filtered = data.filter(d =>
        d["30yr_fixed_rate"] !== "" &&
        d["15yr_fixed_rate"] !== "" &&
        d["30yr_conforming_fico740"] !== ""
    );

    filtered.forEach(d => {
        d.date = new Date(d.observation_date);
        d.y30 = +d["30yr_fixed_rate"];
        d.y15 = +d["15yr_fixed_rate"];
        d.conf = +d["30yr_conforming_fico740"];
    });

    const x = d3.scaleTime()
        .domain(d3.extent(filtered, d => d.date))
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(filtered, d => Math.max(d.y30, d.y15, d.conf))])
        .range([height, 0]);

    const lineGen = (key) =>
        d3.line()
            .x(d => x(d.date))
            .y(d => y(d[key]))
            .curve(d3.curveMonotoneX);

    // Draw lines
    svg.append("path")
        .datum(filtered)
        .attr("fill", "none")
        .attr("stroke", "#3b6ea1")
        .attr("stroke-width", 2)
        .attr("d", lineGen("y30"));

    svg.append("path")
        .datum(filtered)
        .attr("fill", "none")
        .attr("stroke", "#e89a2f")
        .attr("stroke-width", 2)
        .attr("d", lineGen("y15"));

    svg.append("path")
        .datum(filtered)
        .attr("fill", "none")
        .attr("stroke", "#1e6b2d")
        .attr("stroke-width", 2)
        .attr("d", lineGen("conf"));

    // Axes
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));

    svg.append("g").call(d3.axisLeft(y));

    // Legend
    const legend = svg.append("g")
        .attr("transform", `translate(${width + 20}, 20)`);

    const items = [
        { color: "#3b6ea1", text: "30-Year Fixed" },
        { color: "#e89a2f", text: "15-Year Fixed" },
        { color: "#1e6b2d", text: "30-Year Conforming" }
    ];

    items.forEach((d, i) => {
        let g = legend.append("g").attr("transform", `translate(0, ${i*25})`);
        g.append("rect").attr("width", 18).attr("height", 18).attr("fill", d.color);
        g.append("text").attr("x", 25).attr("y", 14).style("font-size", "14px").text(d.text);
    });

});
