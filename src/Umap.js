import * as d3 from 'd3'
import React, {useEffect, useState} from "react";
import {UMAP} from "umap-js";
import {
    Button,
    Drawer,
    Grid,
    Input,
    LinearProgress,
    Paper,
    Slider,
    Typography
} from "@material-ui/core";
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import ReplayIcon from '@material-ui/icons/Replay';
import SettingsIcon from '@material-ui/icons/Settings';

import './Umap.scss'


const maxZoom = 20;
const minDistMarks = [...Array(10).keys()].map(function(x) {
    x = x / 10;
    return { label: x.toString(), value: x }
});
minDistMarks.push({label: "1", value: 0.99});
const nEpochs = 500;
const nNeighborsMarks = [...Array(8).keys()].map(function (x) {
    x = (x + 1) * 25;
    return {label: x.toString(), value: x}
});
nNeighborsMarks.push({label: "2", value: 2});
nNeighborsMarks.push({label: "15", value: 15});


function Umap(props) {
    const [datasetReduced, setDatasetReduced] = useState([]);
    const [epoch, setEpoch] = useState(-1);
    const [minDist, setMinDist] = useState(props.minDist || 0.1);
    const [minDistTemp, setMinDistTemp] = useState(props.minDist || 0.1);
    const [nNeighbors, setNNeighbors] = useState(props.nNeighbors || 15);
    const [nNeighborsTemp, setNNeighborsTemp] = useState(props.nNeighbors || 15);
    const [openSettings, setOpenSettings] = useState(false);

    function onBackgroundClicked() {
        // Shift+click on background is almost always a mis-click
        if(! d3.event.shiftKey) props.updatePermanentSelection("set", new Set([]))
    }

    function onDotClicked(d, i) {
        d3.event.stopPropagation();

        if(d3.event.shiftKey) props.updatePermanentSelection("toggle", [i]);
        else props.updatePermanentSelection("set", new Set([i]));
    }

    function onMinDistChange(e, v) {
        if(v === undefined) v = (e.target.value === '' ? '' : parseFloat(e.target.value));
        setMinDistTemp(v);
    }

    function onNNeighborsChange(e, v) {
        if(v === undefined) v = (e.target.value === '' ? '' : parseFloat(e.target.value));
        setNNeighborsTemp(v);
    }

    function onRepeatClicked() {
        setOpenSettings(false);
        drawUmap();
    }

    function onRunClicked() {
        setMinDist(minDistTemp);
        setNNeighbors(nNeighborsTemp);
        setOpenSettings(false);
    }

    function onSettingsClose() {
        setOpenSettings(false);
        setMinDistTemp(minDist);
        setNNeighborsTemp(nNeighbors)
    }

    function mergeLabels(datasetReduced) {
        for(let i = 0; i < datasetReduced.length; i++) {
            datasetReduced[i][2] = props.labels[i];
        }
    }

    async function drawUmap() {
        props.setBusy(true);
        const datasetReducedTemp = await new UMAP({
            distanceFn: props.distance,
            minDist: minDist,
            nEpochs: nEpochs,
            nNeighbors: nNeighbors})
          .fitAsync(props.dataset, setEpoch);
        if(props.labels !== undefined) mergeLabels(datasetReducedTemp);
        setDatasetReduced(datasetReducedTemp);
        setEpoch(-1);

        const rootSvg = d3.select("#rootUmapChart"),
          baseSvg = d3.select("#baseUmapChart"),
          svg = d3.select('#umapChart'),
          h = props.height,
          w = props.width;

        const brush = d3.brush()
          .extent([[0, 0], [props.width, props.height]])
          .filter(() => (d3.event.shiftKey || d3.event.ctrlKey || d3.event.metaKey) && ! d3.event.button)
          .keyModifiers(false)
          .on("end", brushed);

        const zoom = d3.zoom()
          .scaleExtent([1, maxZoom])
          .on("zoom", zoomed);

        rootSvg
          .on("click", onBackgroundClicked)
          .call(zoom);

        baseSvg
          .on("click", () => d3.event.stopPropagation());
        d3.select("#umapSettingsIcon")
          .on("click", () => setOpenSettings(true));

        // Insert as first child to keep hover and click events on dots
        baseSvg.insert("g", ":first-child")
          .attr("class", "umap brush")
          .on("click", onBackgroundClicked)
          .call(brush);

        const rScale = d3.scaleLinear()
          .domain([1, maxZoom])
          .range([3, 10]);
        const xScale = d3.scaleLinear()
          .domain(d3.extent(datasetReducedTemp, v => v[0])).nice()
          .range([0, w]);
        const yScale = d3.scaleLinear()
          .domain(d3.extent(datasetReducedTemp, v => v[1])).nice()
          .range([h, 0]);

        const xAxis = d3.axisBottom(xScale);
        const yAxis = d3.axisLeft(yScale);

        const gX = baseSvg.append("g")
          .attr("class", "umap axis x")
          .attr("transform", `translate(0, ${h})`)
          .on("click", onBackgroundClicked)
          .call(xAxis);
        const gY = baseSvg.append("g")
          .attr("class", "umap axis y")
          .on("click", onBackgroundClicked)
          .call(yAxis);

        svg.selectAll(".umap.dot")
          .data(datasetReducedTemp)
          .enter().append("circle")
          .attr("class", "umap dot")
          .classed("permanent-selection", (d, i) => props.permanentSelection.has(i))
          .classed("temporary-selection", (d, i) => i === props.temporarySelection)
          .attr("cx", d => xScale(d[0]))
          .attr("cy", d => yScale(d[1]))
          .attr("r", 3)
          .style("fill", d => d.length > 2 ? props.colorScale(d[2]) : undefined)
          .on("click", onDotClicked)
          .on("mouseenter", (d, i) => props.updateTemporarySelection(i))
          .on("mouseout", () => props.updateTemporarySelection(undefined));

        props.setBusy(false);

        function brushed() {
            if(! d3.event.selection) return;
            d3.select(".umap.brush").call(brush.move, null);

            const zoom = d3.zoomTransform(d3.select("#rootUmapChart").node()),
              newXScale = zoom.rescaleX(xScale),
              newYScale = zoom.rescaleY(yScale);

            let [p1, p2] = d3.event.selection;
            p1 = [newXScale.invert(p1[0]), newYScale.invert(p1[1])];
            p2 = [newXScale.invert(p2[0]), newYScale.invert(p2[1])];

            const dots = [];
            d3.selectAll(".umap.dot")
              .each(function(d, i) {
                  if(d[0] >= p1[0] && d[0] <= p2[0] && d[1] >= p2[1] && d[1] <= p1[1]) dots.push(i)
              });

            if(d3.event.sourceEvent.shiftKey) props.updatePermanentSelection("add", dots);
            else props.updatePermanentSelection("delete", new Set(dots))
        }

        function zoomed() {
            const t = d3.event.transform;
            t.x = Math.min(0, Math.max(t.x, (1 - t.k) * props.width));
            t.y = Math.min(0, Math.max(t.y, (1 - t.k) * props.height));

            const newXScale = d3.event.transform.rescaleX(xScale),
              newYScale = d3.event.transform.rescaleY(yScale);

            gX.call(xAxis.scale(newXScale));
            gY.call(yAxis.scale(newYScale));

            svg.selectAll(".umap.dot")
              .attr("cx", d => newXScale(d[0]))
              .attr("cy", d => newYScale(d[1]))
              .attr("r", () => rScale(t.k));
        }
    }

    useEffect(function() {
        if(props.labels === undefined) return;
        mergeLabels(datasetReduced);

        d3.selectAll(".umap.dot")
          .transition(d3.transition().duration(750))
          .style("fill", d => props.colorScale(d[2]))
    }, [props.labels]);

    useEffect(function() {
        d3.selectAll(".umap.dot")
          .classed("permanent-selection", (d, i) => props.permanentSelection.has(i))
          .classed("temporary-selection", false)
    }, [props.permanentSelection]);

    useEffect(function() {
        d3.selectAll(".umap.dot")
          .classed("temporary-selection", (d, i) => i === props.temporarySelection);
    }, [props.temporarySelection]);

    useEffect( function() {
        drawUmap();
    }, [minDist, nNeighbors]);

    function renderLoadingCard() {
        return (
          <foreignObject height={props.height} width={props.width}
                         transform={`translate(${props.padding.x},${props.padding.y})`}>
              <Grid container className="umap loading background" alignItems="center" justify="center">
                  <Paper className="umap loading paper">
                      <Grid container className="umap loading background"
                            alignItems="center" direction="column" justify="center">
                          <Grid item className="umap loading progress-background">
                              <LinearProgress className="umap loading progress" variant="determinate"
                                              value={parseInt(epoch / nEpochs * 100)}/>
                          </Grid>

                          <Grid container item alignItems="baseline" justify="center">
                              <Typography variant='h5' display="inline">
                                  Epoch {epoch}
                              </Typography>

                              <Typography display="contents">
                                  /{ nEpochs }
                              </Typography>
                          </Grid>
                      </Grid>
                  </Paper>
              </Grid>
          </foreignObject>
        )
    }

    function renderUmapChart() {
        return (
          <g id="baseUmapChart"
             transform={`translate(${props.padding.x},${props.padding.y})`}>
              <defs>
                  <clipPath id="umapClipPath">
                      <rect height={props.height} width={props.width} x={0} y={0}/>
                  </clipPath>
              </defs>

              <g id="umapChart" className="umap chart" clipPath="url(#umapClipPath)"/>

              <foreignObject height={props.height} width={props.padding.x}
                             transform={`translate(${props.width},0)`}>
                  <Grid container className="umap toolbar" alignItems="center">
                      <Grid item>
                          <SettingsIcon id="umapSettingsIcon" className="umap settings icon"
                                        fontSize="small"/>
                      </Grid>
                  </Grid>

                  { renderSettingsDrawer() }
              </foreignObject>
          </g>
        )
    }

    function renderSettingsDrawer() {
        return (
          <Drawer anchor="bottom" open={openSettings} onClose={onSettingsClose}>
              <Grid container className="umap settings container" alignItems="center">
                  <Typography variant="h5" className="umap settings min-dist header">
                      minDist
                  </Typography>

                  <Slider className="umap settings min-dist slider"
                          defaultValue={minDist} max={0.99} min={0} step={0.01} value={minDistTemp}
                          marks={minDistMarks} valueLabelDisplay="auto"
                          onChange={onMinDistChange}/>

                  <Input className="umap settings min-dist number"
                         inputProps={{max: 1, min: 0, step: 0.1, type: "number"}}
                         value={minDistTemp} onChange={onMinDistChange}/>

                  <Typography variant="h5" className="umap settings n-neighbors header">
                      nNeighbors
                  </Typography>

                  <Slider className="umap settings n-neighbors slider"
                          defaultValue={nNeighbors} max={200} min={2} value={nNeighborsTemp}
                          marks={nNeighborsMarks} valueLabelDisplay="auto"
                          onChange={onNNeighborsChange}/>

                  <Input className="umap settings n-neighbors number"
                         inputProps={{max: 200, min: 1, step: 1, type: "number"}}
                         value={nNeighborsTemp} onChange={onNNeighborsChange}/>

                  <div className="umap settings run">
                      {
                          minDistTemp === minDist && nNeighborsTemp === nNeighbors ?
                            <Button variant="contained" size="large" startIcon={<ReplayIcon/>}
                                    onClick={onRepeatClicked}>
                                Re-run
                            </Button> :
                            <Button variant="contained" size="large"
                                    startIcon={<PlayArrowIcon/>} onClick={onRunClicked}>
                                Run
                            </Button>
                      }
                  </div>
              </Grid>
          </Drawer>
        )
    }

    return (
      <svg id="rootUmapChart"
           height={props.height + 2*props.padding.y} width={props.width + 2*props.padding.x}>
          { epoch >= 0 ? renderLoadingCard() : renderUmapChart() }
      </svg>
    );
}


export default Umap
