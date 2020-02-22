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


const minDistMarks = [...Array(9).keys()].map(function(x) {
    x = (x + 1) / 10;
    return { label: x.toString(), value: x }
});
minDistMarks.push({label: "0", value: 0.01});
minDistMarks.push({label: "1", value: 0.99});
const nEpochs = 500;
const nNeighborsMarks = [...Array(8).keys()].map(function (x) {
    x = (x + 1) * 25;
    return {label: x.toString(), value: x}
});
nNeighborsMarks.push({label: "0", value: 1});
nNeighborsMarks.push({label: "15", value: 15});


function Umap(props) {
    const [datasetReduced, setDatasetReduced] = useState([]);
    const [epoch, setEpoch] = useState(-1);
    const [minDist, setMinDist] = useState(props.minDist || 0.1);
    const [minDistTemp, setMinDistTemp] = useState(props.minDist || 0.1);
    const [nNeighbors, setNNeighbors] = useState(props.nNeighbors || 15);
    const [nNeighborsTemp, setNNeighborsTemp] = useState(props.nNeighbors || 15);
    const [openSettings, setOpenSettings] = useState(false);

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

    function mergeClusters(datasetReduced) {
        for(let i = 0; i < datasetReduced.length; i++) {
            datasetReduced[i][2] = props.clusters[i];
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
        if(props.clusters !== undefined) mergeClusters(datasetReducedTemp);
        setDatasetReduced(datasetReducedTemp);
        setEpoch(-1);

        const svg = d3.select('#umapChart'),
          h = props.height,
          w = props.width;

        const xScale = d3.scaleLinear()
          .domain([d3.min(datasetReducedTemp, v => v[0]), d3.max(datasetReducedTemp, v => v[0])])
          .range([0, w]);

        const yScale = d3.scaleLinear()
          .domain([d3.min(datasetReducedTemp, v => v[1]), d3.max(datasetReducedTemp, v => v[1])])
          .range([h, 0]);

        svg.append("g")
          .attr("class", "umap axis x")
          .attr("transform", `translate(0, ${h})`)
          .call(d3.axisBottom(xScale));

        svg.append("g")
          .attr("class", "umap axis y")
          .call(d3.axisLeft(yScale));

        svg.selectAll(".umap.dot")
          .data(datasetReducedTemp)
          .enter().append("circle")
          .attr("class", "umap dot")
          .attr("cx", d => xScale(d[0]))
          .attr("cy", d => yScale(d[1]))
          .attr("r", 3)
          .style("fill", d => d.length > 2 ? props.colorScale(d[2]) : undefined);
        props.setBusy(false);
    }

    useEffect(function() {
        if(props.clusters === undefined) return;
        mergeClusters(datasetReduced);

        d3.selectAll(".umap.dot")
          .transition(d3.transition().duration(750))
          .style("fill", d => props.colorScale(d[2]))
    }, [props.clusters]);

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
          <g>
              <g id="umapChart" className="umap chart"
                 height={props.height} width={props.width}
                 transform={`translate(${props.padding.x},${props.padding.y})`}/>

                 <foreignObject height={100} width={100}
                                transform={`translate(${props.width + props.padding.x + 10},
                                ${props.padding.y + props.height/2})`}>
                     <SettingsIcon className={"umap settings icon"} fontSize="small"
                                   onClick={() => setOpenSettings(true)}/>

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
                          defaultValue={minDist} max={0.99} min={0.01} step={0.01} value={minDistTemp}
                          marks={minDistMarks} valueLabelDisplay="auto"
                          onChange={onMinDistChange}/>

                  <Input className="umap settings min-dist number"
                         inputProps={{max: 1, min: 0.01, step: 0.1, type: "number"}}
                         value={minDistTemp} onChange={onMinDistChange}/>

                  <Typography variant="h5" className="umap settings n-neighbors header">
                      nNeighbors
                  </Typography>

                  <Slider className="umap settings n-neighbors slider"
                          defaultValue={nNeighbors} max={200} min={1} value={nNeighborsTemp}
                          marks={nNeighborsMarks} valueLabelDisplay="auto"
                          onChange={onNNeighborsChange}/>

                  <Input className="umap settings n-neighbors number"
                         inputProps={{max: 200, min: 1, step: 1, type: "number"}}
                         value={nNeighborsTemp} onChange={onNNeighborsChange}/>

                  <div className="umap settings run">
                      { renderSettingsRunButton() }
                  </div>
              </Grid>
          </Drawer>
        )
    }

    function renderSettingsRunButton() {
        if(minDistTemp === minDist && nNeighborsTemp === nNeighbors) {
            return (
              <Button variant="contained" size="large"
                      startIcon={<ReplayIcon/>} onClick={onRepeatClicked}>
                  Re-run
              </Button>
            )
        }
        else {
            return (
              <Button variant="contained" size="large"
                      startIcon={<PlayArrowIcon/>} onClick={onRunClicked}>
                  Run
              </Button>
            )
        }
    }

    return (
      <svg id="baseUmapChart"
           height={props.height + 2*props.padding.y} width={props.width + 2*props.padding.x}>
          { epoch >= 0 ? renderLoadingCard() : renderUmapChart() }
      </svg>
    );
}


export default Umap
