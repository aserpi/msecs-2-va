import * as d3 from 'd3';
import d3tip from 'd3-tip'
import React, {useEffect} from "react";
import "./ParallelCoordinates.scss"
import {categoricalFeatures, numericalFeatures} from "./utils"

function ParallelCoordinates(props) {
    const data = props.dataset
    useEffect(function() {

        const dimensions = d3.keys(data[0]);
        //console.log(dimensions);
        const svg = d3.select("#paralCoordChart"),
            h = props.height ,
            w = props.width ;
        let yScale = {}
        let i;
        let attribute;
        for (i in dimensions) {
            //console.log("for loop"+i)
            attribute = dimensions[i];
            //console.log("attribute:"+ attribute)
            if(numericalFeatures.includes(attribute)){
                yScale[attribute] = d3.scaleLinear()
                    .domain(d3.extent(data, function(d){return +d[attribute];}))
                    .range([h, 0]);}
            else if (categoricalFeatures.includes(attribute)){
                yScale[attribute] = d3.scaleBand()
                    .domain(data.map(function(d){return d[attribute];}))
                    .range([h, 0])
                    .padding([1]);

            }
            else throw Error("Unrecognizable attribute")
        };
        let xScale;
        xScale = d3.scalePoint()
            .domain(dimensions)
            .range([0, w])
            .padding(1);

        //let color;
        //color = d3.scaleOrdinal()
         //   .domain(props.labels)
          //  .range(props.colorScale);

        console.log(props.colorScale);

        function path(d) {
            return d3.line()(dimensions.map(function(p) { return [xScale(p), yScale[p](d[p])]; }));
        }

        // Draw the path:
        svg.selectAll("myPath")
            .data(data)
            .enter().append("path")
            //.classed("permanent-selection", (d, i) => props.permanentSelection.has(i))
            //.classed("temporary-selection", (d, i) => i === props.temporarySelection)
            .attr("class", "path line")
            .attr("d",  path)
            .style("fill", "none")
            .style("stroke", "lightgrey")
            .style("opacity", 0.05)

        // Draw the axis: (this is done after the path so that the axis is on top of the lines)
        svg.selectAll("myAxis")
            // For each dimension of the dataset I add a 'g' element:
            .data(dimensions).enter()
            .append("g")
            // I translate this element to its right position on the x axis
            .attr("transform", function(d) { return "translate(" + xScale(d) + ")"; })
            // And I build the axis with the call function
            .each(function(d) { d3.select(this).call(d3.axisLeft().scale(yScale[d])); })
            // Add axis title
            .append("text")
            .style("text-anchor", "middle")
            .attr("y", -9)
            .text(function(d) { return d; })
            .style("fill", "black")
    }, []);
    // Functions for colourings, and selections
    useEffect(function() {
        //console.log("sono in useEffect")
        if(props.labels === undefined) return;
        d3.selectAll(".path.line")
            .transition(d3.transition().duration(750))
            .style("stroke",(d, i) => props.colorScale(props.labels[i]))
            .style("opacity", 0.05)
        }, [props.labels]);

    useEffect(function() {
        d3.selectAll(".path.line")
            .transition(d3.transition().duration(750))
            .style("opacity", calcOpacityPerm)
    }, [props.permanentSelection]);

    useEffect(function() {
        d3.selectAll(".path.line")
            .transition(d3.transition().duration(120))
            .style("opacity", calcOpacityTemp)
    }, [props.temporarySelection]);
    function calcOpacityTemp(d, i){
        if(props.temporarySelection !== undefined){
            if (i === props.temporarySelection){
                return 0.9;
            }
            else if(props.permanentSelection.has(i)) {return 0.9;}
            else return 0.05;
        }
        else if (props.permanentSelection.has(i)){return calcOpacityPerm;}
        else return 0.05;
    }
    function calcOpacityPerm(d, i){
        if(props.permanentSelection !== undefined){
            if (props.permanentSelection.has(i)){
                return 0.9;
            }
            else return 0.05;
        }
        else return 0.05;
    }

    function calcOpacity(d, i){
        if(props.temporarySelection !== undefined && props.permanentSelection !== undefined){
            if (i === props.temporarySelection || props.permanentSelection.has(i) ){
                return 1;
            }
            else return 0.05;
        }
    }


        return (
            <svg id="baseParalCoordChart" className="paralCoord chart"
                 height={props.height + 2*props.padding.y} width={props.width + 2*props.padding.x}>
                <g id="paralCoordChart" className="paralCoord chart"
                   height={props.height} width={props.width}
                   transform={`translate(${props.padding.x},${props.padding.y})`}>
                </g>
            </svg>
        )

}

export default ParallelCoordinates
