// src/components/KLineOutboundTime.jsx
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
  } from "react";
  import * as d3 from "d3";
  import {
    calculateTimeElapsed,
    safeToArray,
    findNearestIndex,
    isWithinDistance,
    getDistanceInFeet,
  } from "../utils/helpers.js";
  import "./KLineInboundTime.css"; // we'll copy your <style> into here
  
  function KLineOutboundTime() {
    // -----------------------
    //  Vue refs  -> useState
    // -----------------------
    const [graphData, setGraphData] = useState([]); // graphData
    const [currentTripIndex, setCurrentTripIndex] = useState(-1); // -1 == all trips
    const [isLoading, setIsLoading] = useState(true);
    const [availableDates, setAvailableDates] = useState([]);
    const [selectedDate, setSelectedDate] = useState(null);
    const [allDatesMode, setAllDatesMode] = useState(false);
  
    const [westPortalStationIndex, setWestPortalStationIndex] = useState(null);
    const [westPortalDistance, setWestPortalDistance] = useState(null);
    const [stationDistances, setStationDistances] = useState([]);
    const [intersectionDistances, setIntersectionDistances] = useState([]);
    const [locations, setLocations] = useState([]);
  
    const [vehicleAtStopRadiusFeet, setVehicleAtStopRadiusFeet] = useState(250);
    const [totalNumberOfFullTrips, setTotalNumberOfFullTrips] = useState(0);
    const [totalDurationOfFullTrips, setTotalDurationOfFullTrips] = useState(0);
  
    // Zoom-related state
    const [isZoomEnabled, setIsZoomEnabled] = useState(false);
    const [isZoomLensVisible, setIsZoomLensVisible] = useState(false);
    const [zoomLensPosition, setZoomLensPosition] = useState({ left: 0, top: 0 });
    const [zoomBackgroundSize, setZoomBackgroundSize] = useState("0px 0px");
    const [zoomBackgroundPosition, setZoomBackgroundPosition] =
      useState("0px 0px");
    const [zoomImageUrl, setZoomImageUrl] = useState("");
  
    const ZOOM_FACTOR = 2.5;
    const LENS_SIZE = 220;
    const CURSOR_OFFSET = 24;

    const updateZoomSnapshot = useCallback(() => {
      if (!graphSvgRef.current || typeof window === "undefined") return;
    
      const serializer = new XMLSerializer();
      let source = serializer.serializeToString(graphSvgRef.current);
    
      // Ensure the SVG has the xmlns attribute
      if (!source.includes('xmlns="http://www.w3.org/2000/svg"')) {
        source = source.replace(
          "<svg",
          '<svg xmlns="http://www.w3.org/2000/svg"'
        );
      }
    
      const encoded = window.btoa(unescape(encodeURIComponent(source)));
      // Plain data URL; we'll wrap it in `url(...)` in the style
      setZoomImageUrl(`data:image/svg+xml;base64,${encoded}`);
    }, []);
  
    // -----------------------
    //  Vue template refs -> useRef
    // -----------------------
    const graphContainerRef = useRef(null);
    const graphSvgRef = useRef(null);
  
    // -----------------------------------
    //  computed: filteredTrips, etc.
    // -----------------------------------
  
    // ✅ All trips in scope (date-filtered OR all dates)
    const filteredTrips = useMemo(() => {
      if (allDatesMode) {
        // Vue:
        // return graphData.value.filter(trip =>
        //   trip.some(item => isWithinDistance(item.latitude, item.longitude, trip[trip.length - 1].latitude, trip[trip.length - 1].longitude))
        // )
        return graphData.filter((trip) =>
          trip.some((item) =>
            isWithinDistance(
              item.latitude, 
              item.longitude, 
              locations[26].location.latitude, 
              locations[26].location.longitude, 
              350
            ) 
            &&
            !isWithinDistance(
              item.latitude,
              item.longitude,
              trip[trip.length - 1].latitude,
              trip[trip.length - 1].longitude,
              350
            )
          )
        );
      }
  
      if (!selectedDate) return [];
  
      // Vue:
      // return graphData.value.filter(trip =>
      //   trip.some(item => item.date_pst === selectedDate.value) && trip.some(item => ... vehicle moved ...)
      // )
      return graphData.filter(
        (trip) =>
          trip.some((item) => item.date_pst === selectedDate) &&
          trip.some((item) =>
            isWithinDistance(
              item.latitude, 
              item.longitude, 
              locations[26].location.latitude, 
              locations[26].location.longitude, 
              350
            ) 
            &&
            !isWithinDistance(
              item.latitude,
              item.longitude,
              trip[trip.length - 1].latitude,
              trip[trip.length - 1].longitude,
              350
            )
          )
      );
    }, [allDatesMode, graphData, selectedDate]);
  
    // ✅ Trips to actually render
    const displayTrips = useMemo(() => {
      if (currentTripIndex === -1) return filteredTrips;
      return [filteredTrips[currentTripIndex]];
    }, [currentTripIndex, filteredTrips]);
  
    // Current selected trip (or null)
    const selectedTrip = useMemo(() => {
      if (
        currentTripIndex < 0 ||
        currentTripIndex >= filteredTrips.length ||
        filteredTrips.length === 0
      ) {
        return null;
      }
      return filteredTrips[currentTripIndex];
    }, [currentTripIndex, filteredTrips]);
  
    const numTrips = useMemo(() => filteredTrips.length, [filteredTrips]);
  
    // Totals over intersections (from your Vue computed)
    const totalTimeAtIntersections = useMemo(
      () =>
        locations.reduce(
          (sum, loc) => (loc.isIntersection ? sum + loc.timeAtStop : sum),
          0
        ),
      [locations]
    );
  
    const totalNumVehiclesAtIntersections = useMemo(
      () =>
        locations.reduce(
          (sum, loc) => (loc.isIntersection ? sum + loc.numVehicles : sum),
          0
        ),
      [locations]
    );
  
    const averageIntersectionDurationDisplay = useMemo(() => {
      const avgSeconds =
        totalTimeAtIntersections / (totalNumVehiclesAtIntersections || 1);
      return Number.isFinite(avgSeconds)
        ? `${avgSeconds.toFixed(2)} (seconds)`
        : "No intersection data";
    }, [totalTimeAtIntersections, totalNumVehiclesAtIntersections]);

    console.log("Total Duration of Full Trips:", totalDurationOfFullTrips);
  
    const averageFullTripDurationDisplay = useMemo(() => {
      const avgMinutes =
        totalDurationOfFullTrips / (totalNumberOfFullTrips || 1) / 60;
      return Number.isFinite(avgMinutes)
        ? `${avgMinutes.toFixed(2)} (minutes)`
        : "No full trip data";
    }, [totalDurationOfFullTrips, totalNumberOfFullTrips]);
  
    // -----------------------------------
    //  Lifecycle: onMounted -> useEffect
    // -----------------------------------
    // This is where your original Vue onMounted() lives.
    // Copy the logic that:
    //   - fetches/loads your JSON data
    //   - processes trips, distances, locations
    //   - populates graphData, availableDates, etc.
    //   - sets isLoading to false
    useEffect(() => {
      let cancelled = false;
  
      async function loadData() {
        try {
            // ⬇️ TAKE the body of your Vue onMounted(async () => { ... })
            // and paste it here, with the following changes:
            //
            // 1. graphData.value = ...  ->  setGraphData(...)
            // 2. availableDates.value = ... -> setAvailableDates(...)
            // 3. selectedDate.value = ...   -> setSelectedDate(...)
            // 4. locations.value = ...      -> setLocations(...)
            // 5. westPortalStationIndex.value = ... -> setWestPortalStationIndex(...)
            // 6. westPortalDistance.value = ...     -> setWestPortalDistance(...)
            // 7. stationDistances.value = ...       -> setStationDistances(...)
            // 8. intersectionDistances.value = ...  -> setIntersectionDistances(...)
            // 9. totalNumberOfFullTrips.value = ... -> setTotalNumberOfFullTrips(...)
            // 10. totalDurationOfFullTrips.value = ... -> setTotalDurationOfFullTrips(...)
            //
            // Also replace any `.value` reads with plain variables from state:
            // e.g. graphData.value -> graphData, selectedDate.value -> selectedDate
            //
            // Make sure to guard with `if (cancelled) return;` if you do async work.
    
            // Example shape (NOT your real data code):
            //
            // const res = await fetch('/data/your-file.json');
            // if (cancelled) return;
            // const raw = await res.json();
            // const processedTrips = yourProcessingFn(raw);
            // setGraphData(processedTrips);
            // setAvailableDates([...new Set(processedTrips.map(d => d.date_pst))].sort());
            // setSelectedDate(processedTrips[0]?.date_pst ?? null);
            // setIsLoading(false);

            // Load data from May 11 to May 16, 2025
            const responses = await Promise.all([
                fetch(`${import.meta.env.BASE_URL}data/gfts_realtime_data_2025-05-11_8-00_PST.json`),
                fetch(`${import.meta.env.BASE_URL}data/gfts_realtime_data_2025-05-12_8-00_PST.json`),
                fetch(`${import.meta.env.BASE_URL}data/gfts_realtime_data_2025-05-13_8-00_PST.json`),
                fetch(`${import.meta.env.BASE_URL}data/gfts_realtime_data_2025-05-14_8-00_PST.json`),
                fetch(`${import.meta.env.BASE_URL}data/gfts_realtime_data_2025-05-15_8-00_PST.json`),
                fetch(`${import.meta.env.BASE_URL}data/gfts_realtime_data_2025-05-16_8-00_PST.json`),
            ])
            if (cancelled) return;
            const jsonData = await Promise.all(responses.map(r => r.json()))
            if (cancelled) return;
            const combinedData = jsonData.flatMap(d => safeToArray(d))

            // Group data by trip_id, vehicle_id, and date into a 2D array
            const filteredData = Object.values(
                combinedData.reduce((acc, item) => {
                    if (item.route_id === "K" && item.direction_id === 0) { // 0 for outbound
                        const uniqueKey = item.trip_id + '_' + item.vehicle_id + '_' + item.date_pst
                        if (!acc[uniqueKey]) acc[uniqueKey] = []
                        acc[uniqueKey].push(item)
                    }
                    return acc
                }, {})
            )

            // Load stops.json data
            const stopsResponse = await fetch(`${import.meta.env.BASE_URL}data/stops.json`)
            const stopsData = await stopsResponse.json()
            const stopsArray = Array.isArray(stopsData) ? stopsData : Object.values(stopsData)

            // Array of location objects (intersections and stations), includes total time at each location (timeAtStop) and total number of vehicles (numVehicles)
            setLocations([
                { isIntersection: false, name: "Balboa Park BART Mezzanine Level", location: stopsArray[0].outbound.stops[19].location, timeAtStop: 0, numVehicles: 0 },
                { isIntersection: true, name: "Ocean Ave & Balboa Park", location: stopsArray[0].intersections.stops[3].location, timeAtStop: 0, numVehicles: 0 },
                { isIntersection: true, name: "Howlth St & Ocean Ave", location: stopsArray[0].intersections.stops[1].location, timeAtStop: 0, numVehicles: 0 },
                { isIntersection: false, name: "Ocean Ave/CCSF Pedestrian Bridge", location: stopsArray[0].outbound.stops[18].location, timeAtStop: 0, numVehicles: 0 },
                { isIntersection: false, name: "Ocean Ave & Lee St", location: stopsArray[0].outbound.stops[17].location, timeAtStop: 0, numVehicles: 0 },
                { isIntersection: true, name: "Ocean Ave & Plymouth Ave", location: stopsArray[0].intersections.stops[4].location, timeAtStop: 0, numVehicles: 0 },
                { isIntersection: false, name: "Ocean Ave & Miramar Ave", location: stopsArray[0].outbound.stops[16].location, timeAtStop: 0, numVehicles: 0 },
                { isIntersection: false, name: "Ocean Ave & Jules Ave", location: stopsArray[0].outbound.stops[15].location, timeAtStop: 0, numVehicles: 0 },
                { isIntersection: false, name: "Ocean Ave & Victoria Street", location: stopsArray[0].outbound.stops[14].location, timeAtStop: 0, numVehicles: 0 },
                { isIntersection: true, name: "Ocean Ave & Cerritos Ave", location: stopsArray[0].intersections.stops[5].location, timeAtStop: 0, numVehicles: 0 },
                { isIntersection: false, name: "Ocean Ave & Aptos Ave", location: stopsArray[0].outbound.stops[13].location, timeAtStop: 0, numVehicles: 0 },
                { isIntersection: false, name: "Ocean Ave & San Leandro Way", location: stopsArray[0].outbound.stops[12].location, timeAtStop: 0, numVehicles: 0 },
                { isIntersection: false, name: "Junipero Serra Blvd & Ocean Ave", location: stopsArray[0].outbound.stops[11].location, timeAtStop: 0, numVehicles: 0 },
                { isIntersection: true, name: "Junipero Serra Blvd & Monterey Blvd", location: stopsArray[0].intersections.stops[0].location, timeAtStop: 0, numVehicles: 0 },
                { isIntersection: false, name: "West Portal Ave & Sloat Blvd", location: stopsArray[0].outbound.stops[10].location, timeAtStop: 0, numVehicles: 0 },
                { isIntersection: true, name: "West Portal Ave & 15th Ave", location: stopsArray[0].intersections.stops[6].location, timeAtStop: 0, numVehicles: 0 },
                { isIntersection: false, name: "West Portal Ave & 14th Ave", location: stopsArray[0].outbound.stops[9].location, timeAtStop: 0, numVehicles: 0 },
                { isIntersection: true, name: "West Portal Ave & Vicente St", location: stopsArray[0].intersections.stops[2].location, timeAtStop: 0, numVehicles: 0 },
                { isIntersection: false, name: "West Portal Station", location: stopsArray[0].outbound.stops[8].location, timeAtStop: 0, numVehicles: 0 },
                { isIntersection: false, name: "Forest Hill Station", location: stopsArray[0].outbound.stops[7].location, timeAtStop: 0, numVehicles: 0 },
                { isIntersection: false, name: "Castro Station", location: stopsArray[0].outbound.stops[6].location, timeAtStop: 0, numVehicles: 0 },
                { isIntersection: false, name: "Church Station", location: stopsArray[0].outbound.stops[5].location, timeAtStop: 0, numVehicles: 0 },
                { isIntersection: false, name: "Van Ness Station", location: stopsArray[0].outbound.stops[4].location, timeAtStop: 0, numVehicles: 0 },
                { isIntersection: false, name: "Civic Center Station", location: stopsArray[0].outbound.stops[3].location, timeAtStop: 0, numVehicles: 0 },
                { isIntersection: false, name: "Powell Station", location: stopsArray[0].outbound.stops[2].location, timeAtStop: 0, numVehicles: 0 },
                { isIntersection: false, name: "Montgomery Station", location: stopsArray[0].outbound.stops[1].location, timeAtStop: 0, numVehicles: 0 },
                { isIntersection: false, name: "Embarcadero Station", location: stopsArray[0].outbound.stops[0].location, timeAtStop: 0, numVehicles: 0 },
            ]);

            // Lon and Lat of start station (beyond Embarcadero station, using first point on polyline)
            const startStationLongitude = stopsArray[0].polyline.shapeArrayOutbound[0].shape_pt_lon;
            const startStationLatitude = stopsArray[0].polyline.shapeArrayOutbound[0].shape_pt_lat;

            // Get the K line path coordinates
            const kLinePath = stopsArray[0].polyline.shapeArrayOutbound.map(point => ({
                lat: point.shape_pt_lat,
                lon: point.shape_pt_lon,
                shape_dist_traveled: point.shape_dist_traveled
            }));

            // Find and store the index and distance of West Portal station for drawing the underground background
            setWestPortalStationIndex(findNearestIndex(kLinePath, { lat: 37.741171, lon: -122.465609 }));
            setWestPortalDistance(kLinePath[findNearestIndex(kLinePath, { lat: 37.741171, lon: -122.465609 })].shape_dist_traveled);

            // Store distances of all stations along K line path
            setStationDistances(
                stopsArray[0].outbound.stops.map(stop => {
                    const idx = findNearestIndex(kLinePath, { lat: stop.location.latitude, lon: stop.location.longitude })
                    return {
                        cumulativeDistance: kLinePath[idx].shape_dist_traveled,
                        stop_id: stop.stop_id,
                        stop_name: stop.stop_name,
                        k_line_index: idx
                    };
                })
            );

            // Store distances of intersections along K line path
            setIntersectionDistances(
                stopsArray[0].intersections.stops.map(intersection => {
                    const idx = findNearestIndex(kLinePath, { lat: intersection.location.latitude, lon: intersection.location.longitude })
                    return {
                        cumulativeDistance: kLinePath[idx].shape_dist_traveled,
                        intersection_name: intersection.stop_name,
                        k_line_index: idx
                    };
                })
            );

            // Process each trip to calculate cumulative distance and time
            const allProcessedTrips = filteredData.map((trip) => {
                let cumulativeDistance = 0;
                let cumulativeTime = 0;

                // Find nearest point on K line path for the starting point of the trip
                const startIdx = findNearestIndex(kLinePath, { lat: trip[0].latitude, lon: trip[0].longitude });
                const startDistance = kLinePath[startIdx].shape_dist_traveled;

                return trip.map((item, index, array) => {
                    // If within 350 feet of start station, vehicle is considered at start
                    if (index === 0 || isWithinDistance(item.latitude, item.longitude, startStationLatitude, startStationLongitude, 350)) {
                        return { cumulativeDistance: startDistance, cumulativeTime: 0, trip_id: item.trip_id, date_pst: item.date_pst, latitude: item.latitude, longitude: item.longitude, speed: item.speed, vehicle_id: item.vehicle_id};
                    }

                    // Calculate time elapsed since last point
                    const prev = array[index - 1];
                    const time = calculateTimeElapsed(prev.timestamp, item.timestamp);

                    // Find nearest point on K line path
                    const currIdx = findNearestIndex(kLinePath, { lat: item.latitude, lon: item.longitude });

                    cumulativeDistance = kLinePath[currIdx].shape_dist_traveled;
                    cumulativeTime += time;

                    return {
                        cumulativeDistance,
                        cumulativeTime,
                        trip_id: item.trip_id,
                        date_pst: item.date_pst,
                        latitude: item.latitude,
                        longitude: item.longitude,
                        speed: item.speed,
                        vehicle_id: item.vehicle_id
                    };
                });
            });

            setGraphData(allProcessedTrips);

            // Collect unique dates
            const dates = [...new Set(combinedData.map(d => d.date_pst))].sort()
            setAvailableDates(dates);
            setSelectedDate(dates[0]); // default to first date
  
          // After you've pasted your real logic, leave this:
        } catch (err) {
          console.error("Error loading K Line Outbound data", err);
        } finally {
          if (!cancelled) {
            setIsLoading(false);
          }
        }
      }
  
      loadData();
  
      return () => {
        cancelled = true;
      };
    }, []); // empty deps == run once on mount
  
    // -----------------------------------
    //  watch(...) that re-draws D3 graph
    // -----------------------------------
    // In Vue you had something like:
    // watch([displayTrips, westPortalDistance, stationDistances, ...], () => { ... draw with d3 ... }, { deep: true, immediate: true })
    //
    // That becomes a useEffect that depends on the same things.
    useEffect(() => {
      const allTrips = displayTrips;
      const containerEl = graphContainerRef.current;
      const svgEl = graphSvgRef.current;
      if (!containerEl || !svgEl) return;

      // Make D3 selections
      const container = d3.select(containerEl);
      const svg = d3.select(svgEl);
  
      // ⬇️ PASTE your D3 drawing logic from the Vue watch() body here.
      //    You can keep almost everything identical, with these changes:
      //
      //  - Replace graphData.value   -> graphData
      //  - Replace displayTrips.value -> displayTrips
      //  - Replace westPortalDistance.value -> westPortalDistance
      //  - Replace stationDistances.value   -> stationDistances
      //  - Replace intersectionDistances.value -> intersectionDistances
      //  - Replace locations.value -> locations
      //  - Replace currentTripIndex.value -> currentTripIndex
      //  - Replace isZoomEnabled.value, etc. with their React values
      //
      //  - If you had helper functions defined inside <script setup>, you can
      //    either keep them outside the component, or re-define them above
      //    this effect in React syntax.
      //
      //  The entirety of:
      //    watch(graphData, (newTrips) => {
      //      ... D3 scales, axes, path, circles, mouse handlers, etc ...
      //    }, { deep: true, immediate: true })
      //
      //  basically becomes:
      //    useEffect(() => {
      //      ...the body of that watcher...
      //    }, [graphData, selectedDate, allDatesMode, currentTripIndex, ...]);
  
      // Example skeleton (NOT your full code):
      //
      // const width = container.clientWidth;
      // const height = container.clientHeight || 600;
      //
      // const svg = d3
      //   .select(svgElement)
      //   .attr("width", width)
      //   .attr("height", height);
      //
      // const xScale = d3.scaleLinear().range([margin.left, width - margin.right]);
      // const yScale = d3.scaleLinear().range([height - margin.bottom, margin.top]);
      //
      // // Use `displayTrips` here the same way you did in Vue
      // // to compute domains, lines, intersection markers, etc.
      //
      // // When you're done drawing, if you relied on nextTick/DOM refs in Vue,
      // // they're just direct refs in React now (graphSvgRef.current).

      if (isLoading || !allTrips.length || !graphSvgRef || !graphContainerRef) return;

        svg.selectAll('*').remove();

        let tooltip = container.select('.graph-tooltip');
        if (tooltip.empty()) {
            tooltip = container
                .append('div')
                .attr('class', 'graph-tooltip');
        }
        tooltip.style('opacity', 0);

        const width = 1100;
        const height = 760;
        svg
            .attr('viewBox', `0 0 ${width} ${height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');
        const margin = { top: 20, right: 140, bottom: 50, left: 200 };

        const flatData = allTrips.flat();

        const x = d3.scaleLinear()
            .domain([0, d3.max(flatData, d => d?.cumulativeTime)])
            .range([margin.left, width - margin.right]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(flatData, d => d?.cumulativeDistance)])
            .range([height - margin.bottom, margin.top]);

        const line = d3.line()
            .x(d => x(d?.cumulativeTime))
            .y(d => y(d?.cumulativeDistance));

        const maxYValue = d3.max(flatData, d => d?.cumulativeDistance);

        // Add gray background rectangle for distances <= kLinePath[westPortalStationIndex].shape_dist_traveled
        const thresholdDistance = westPortalDistance || 0; // Default to 0 if not found
        svg.append('rect')
            .attr('x', margin.left)
            .attr('y', y(thresholdDistance))
            .attr('width', width - margin.left - margin.right)
            .attr('height', height - margin.bottom - y(thresholdDistance))
            .attr('fill', 'lightgray')
            .attr('opacity', 0.5);

        svg.append('g')
            .attr('transform', `translate(0,${height - margin.bottom})`)
            .call(
                d3.axisBottom(x).tickFormat((d) => {
                    const minutes = Math.floor(d / 60);
                    const seconds = Math.floor(d % 60);
                    return `${minutes}m ${seconds}s`;
                })
            );

        svg.append('g')
            .attr('transform', `translate(${margin.left},0)`)
            .call(d3.axisLeft(y));

        const color = d3.scaleOrdinal(d3.schemeCategory10);

        // Reset timeAtStop and numVehicles for all locations
        /*locations.forEach(location => {
            location.timeAtStop = 0;
            location.numVehicles = 0;
        });*/
        const workingLocations = locations.map(loc => ({
          ...loc,
          timeAtStop: 0,
          numVehicles: 0,
        }));

        // Reset total trip counters
        //setTotalNumberOfFullTrips(0);
        //setTotalDurationOfFullTrips(0);
        let totalTrips = 0;
        let totalDuration = 0;

        // Cycle through each individual trip, check if vehicle is at location, and draw svg path
        allTrips.forEach((trip, i) => {
            let lastStop = null; // previous location match in this trip
            let lastPoint = null; // previous point in this trip
            let alreadyVisitedLocations = []; // array or already visited locations
            let leavingFirstTerminalStation = null; // point where the vehicle first leaves the terminal station starting the trip

            // Check each point in the trip against all locations to see where the vehicle is stopped
            trip.forEach((point) => {
                const locationMatch = workingLocations.find(({ location }) =>
                    isWithinDistance(point.latitude, point.longitude, location.latitude, location.longitude, vehicleAtStopRadiusFeet)
                );

                // If vehicle is at a location
                if (locationMatch) {
                    const seen = alreadyVisitedLocations.some(loc => loc.name === locationMatch.name)

                    // If this is the first time vehicle is at this location during this trip
                    if (!seen) {
                        alreadyVisitedLocations.push(locationMatch);
                        locationMatch.numVehicles += 1; // Increment vehicle count for this location
                    }

                    // If vehicle is at starting terminal station, set leavingFirstTerminalStation to signify start of trip
                    if (locationMatch.name === "Embarcadero Station") {
                        leavingFirstTerminalStation = point;
                    }

                    // If vehicle is at ending terminal station, and left starting terminal station in same trip, compute trip duration
                    if (locationMatch.name === "Balboa Park BART Mezzanine Level" && leavingFirstTerminalStation) {
                        const tripDuration = point.cumulativeTime - leavingFirstTerminalStation.cumulativeTime;
                        leavingFirstTerminalStation = null; // reset for next trip
                        totalTrips += 1;
                        totalDuration += tripDuration;
                    }
                }

                // If vehicle is at the same location as last point, accumulate time at stop
                if (locationMatch && lastPoint) {
                    const time = point.cumulativeTime - lastPoint.cumulativeTime;
                    let calculatedSpeed = null;

                    // If vehicle is at same stop as last point
                    if (lastStop === locationMatch) {
                        // Calculate speed since last point
                        const distanceFeet = getDistanceInFeet(point.latitude, point.longitude, lastPoint.latitude, lastPoint.longitude);
                        const speedFeetPerSecond = distanceFeet / time;
                        calculatedSpeed = speedFeetPerSecond * 0.3048; // Convert to m/s

                        // If vehicle speed is less that 7mph
                        if (point.speed < 3.12928 || calculatedSpeed < 3.12928) { // 7mph in m/s
                            locationMatch.timeAtStop += time;
                        }
                    }
                    lastStop = locationMatch;
                }
                lastPoint = point;
            });

            svg.append('path')
                .datum(trip)
                .attr('fill', 'none')
                .attr('stroke', color(i))
                .attr('stroke-width', 1.5)
                .attr('d', line);
        });

        setLocations(workingLocations);
        setTotalNumberOfFullTrips(totalTrips);
        setTotalDurationOfFullTrips(totalDuration);

        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height - 10)
            .attr('text-anchor', 'middle')
            .attr('font-size', '14px')
            .attr('font-weight', 'bold')
            .text('Time (seconds)');

        svg.append('text')
            .attr('x', -(height / 2))
            .attr('y', 15)
            .attr('text-anchor', 'middle')
            .attr('font-size', '14px')
            .attr('font-weight', 'bold')
            .attr('transform', 'rotate(-90)')
            .text('Distance (miles)');

        // Add horizontal lines and labels for station distances
        stationDistances.forEach(entry => {
            const yPosition = y(entry.cumulativeDistance);

            // Add the actual horizontal line
            const line = svg.append('line')
                .attr('x1', margin.left)
                .attr('x2', width - margin.right)
                .attr('y1', yPosition)
                .attr('y2', yPosition)
                .attr('stroke', 'gray')
                .attr('stroke-dasharray', '4,4')
                .attr('class', 'station-line');

            // Add an invisible line for easier hover detection
            svg.append('line')
                .attr('x1', margin.left)
                .attr('x2', width - margin.right)
                .attr('y1', yPosition)
                .attr('y2', yPosition)
                .attr('stroke', 'transparent') // Invisible line
                .attr('stroke-width', 10) // Wider hover area
                .on('mouseover', function (event) {
                    line.attr('stroke-dasharray', null) // Remove dashed style
                        .attr('stroke-width', 2); // Make the line thicker

                    d3.select(`#label-${entry.k_line_index}`)
                        .attr('font-weight', 'bold'); // Bold the corresponding label

                    const locationInfo = workingLocations.find(loc => loc.name === entry.stop_name);
                    if (!locationInfo) return;

                    // Check if numVehicles is zero to avoid division by zero
                    const avgStopDuration = Number.isFinite(locationInfo.timeAtStop / locationInfo.numVehicles)
                        ? (locationInfo.timeAtStop / locationInfo.numVehicles).toFixed(1)
                        : '0';

                    const [xPos, yPos] = d3.pointer(event, container.node());
                    tooltip
                        .style('opacity', 1)
                        .style('left', `${xPos + 16}px`)
                        .style('top', `${yPos - 20}px`)
                        .html(`
                            <div><strong>${entry.stop_name}</strong></div>
                            <div>Vehicles: ${locationInfo.numVehicles}</div>
                            <div>Time at stop: ${locationInfo.timeAtStop > 60 ? `${(locationInfo.timeAtStop / 60).toFixed(2)}min` : `${locationInfo.timeAtStop.toFixed(1)}s`}</div>
                            <div>Average stop duration: ${avgStopDuration}s</div>
                        `.trim());
                })
                .on('mouseout', function () {
                    line.attr('stroke-dasharray', '4,4') // Restore dashed style
                        .attr('stroke-width', 1); // Restore original width

                    d3.select(`#label-${entry.k_line_index}`)
                        .attr('font-weight', 'normal'); // Restore normal font weight

                    tooltip.style('opacity', 0);
                });

            // Add label
            svg.append('text')
                .attr('id', `label-${entry.k_line_index}`) // Add an ID for easier selection
                .attr('x', margin.left - 20) // Position to the left of the graph
                .attr('y', yPosition + 3) // Slightly above the line
                .attr('text-anchor', 'end') // Align text to the end (right)
                .attr('font-size', '10px')
                .attr('fill', 'black')
                .text(entry.stop_name);
        });

        // Add horizontal lines and labels for intersection distances
        intersectionDistances.forEach(entry => {
            const yPosition = y(entry.cumulativeDistance);

            // Add the actual horizontal line
            const line = svg.append('line')
                .attr('x1', margin.left)
                .attr('x2', width - margin.right)
                .attr('y1', yPosition)
                .attr('y2', yPosition)
                .attr('stroke', 'blue')
                .attr('stroke-dasharray', '4,4')
                .attr('class', 'intersection-line');

            // Add an invisible line for easier hover detection
            svg.append('line')
                .attr('x1', margin.left)
                .attr('x2', width - margin.right)
                .attr('y1', yPosition)
                .attr('y2', yPosition)
                .attr('stroke', 'transparent') // Invisible line
                .attr('stroke-width', 10) // Wider hover area
                .on('mouseover', function (event) {
                    line.attr('stroke-dasharray', null) // Remove dashed style
                        .attr('stroke-width', 2); // Make the line thicker

                    d3.select(`#label-intersection-${entry.k_line_index}`)
                        .attr('font-weight', 'bold'); // Bold the corresponding label

                    const locationInfo = workingLocations.find(loc => loc.name === entry.intersection_name);
                    if (!locationInfo) return;

                    // Check if numVehicles is greater than 0 to avoid division by zero
                    const avgIntersectionStop = Number.isFinite(locationInfo.timeAtStop / locationInfo.numVehicles)
                        ? (locationInfo.timeAtStop / locationInfo.numVehicles).toFixed(1)
                        : '0';

                    const [xPos, yPos] = d3.pointer(event, container.node());
                    tooltip
                        .style('opacity', 1)
                        .style('left', `${xPos + 16}px`)
                        .style('top', `${yPos - 20}px`)
                        .html(`
                            <div><strong>${entry.intersection_name}</strong></div>
                            <div>Vehicles: ${locationInfo.numVehicles}</div>
                            <div>Time at stop: ${locationInfo.timeAtStop > 60 ? `${(locationInfo.timeAtStop / 60).toFixed(2)}min` : `${locationInfo.timeAtStop.toFixed(1)}s`}</div>
                            <div>Average stop duration: ${avgIntersectionStop}s</div>
                        `.trim());
                })
                .on('mouseout', function () {
                    line.attr('stroke-dasharray', '4,4') // Restore dashed style
                        .attr('stroke-width', 1); // Restore original width

                    d3.select(`#label-intersection-${entry.k_line_index}`)
                        .attr('font-weight', 'normal'); // Restore normal font weight

                    tooltip.style('opacity', 0);
                });

            // Add label
            svg.append('text')
                .attr('id', `label-intersection-${entry.k_line_index}`) // Add an ID for easier selection
                .attr('x', width - margin.right + 6) // Position to the right of the graph
                .attr('y', yPosition + 3) // Slightly above the line
                .attr('text-anchor', 'start') // Align text to the start (left)
                .attr('font-size', '10px')
                .attr('fill', 'blue')
                .text(entry.intersection_name);
        });

        // Add "Intersections" label
        svg.append('text')
            .attr('id', `label-intersection`) // Add an ID for easier selection
            .attr('x', width - margin.right + 6) // Position to the right of the graph
            .attr('y', y(maxYValue) - 10) // Above last intersection line
            .attr('text-anchor', 'start') // Align text to the start (left)
            .attr('font-size', '13px')
            .attr('fill', 'blue')
            .attr('font-weight', 'bold')
            .attr('style', 'text-decoration: underline;')
            .text("Intersections");

        // Add "Stations" label
        svg.append('text')
            .attr('id', `label-stations`) // Add an ID for easier selection
            .attr('x', margin.left - 20) // Position to the left of the graph
            .attr('y', y(maxYValue) - 10) // Above last station line
            .attr('text-anchor', 'end') // Align text to the end (right)
            .attr('font-size', '13px')
            .attr('fill', 'gray')
            .attr('font-weight', 'bold')
            .attr('style', 'text-decoration: underline;')
            .text("Stations");

        // Add "Underground" label with background
        svg.append('rect')
            .attr('x', width - margin.right - 65) // Adjust position to align with text
            .attr('y', (y(maxYValue) + y(thresholdDistance)) / 2 - 10) // Center vertically and adjust for text height
            .attr('width', 55) // Width of the background rectangle
            .attr('height', 20) // Height of the background rectangle
            .attr('fill', 'black')
            .attr('opacity', 0.6);

        svg.append('text')
            .attr('x', width - margin.right - 16) // Right-aligned
            .attr('y', (y(maxYValue) + y(thresholdDistance)) / 2 + 5) // Vertically centered on the gray background
            .attr('text-anchor', 'end') // Align text to the end (right)
            .attr('font-size', '14px')
            .attr('fill', 'white') // Text color to contrast with the black background
            .text('Surface');

        // Add "Surface" label with background
        svg.append('rect')
            .attr('x', width - margin.right - 95) // Adjust position to align with text
            .attr('y', (y(thresholdDistance) + y(0)) / 2 - 10) // Center vertically and adjust for text height
            .attr('width', 85) // Width of the background rectangle
            .attr('height', 20) // Height of the background rectangle
            .attr('fill', 'black')
            .attr('opacity', 0.6);

        svg.append('text')
            .attr('x', width - margin.right - 16) // Right-aligned
            .attr('y', (y(thresholdDistance) + y(0)) / 2 + 5) // Vertically centered on the rest of the graph
            .attr('text-anchor', 'end') // Align text to the end (right)
            .attr('font-size', '14px')
            .attr('fill', 'white') // Text color to contrast with the black background
            .text('Underground');

        updateZoomSnapshot();
  
    }, [
      displayTrips,
      westPortalDistance,
      stationDistances,
      intersectionDistances,
      currentTripIndex,
      allDatesMode,
      selectedDate,
      isLoading,
      updateZoomSnapshot,
    ]);
  
    // -----------------------------------
    //  Methods: showPrevTrip, showNextTrip, etc.
    // -----------------------------------
    const showPrevTrip = useCallback(() => {
      setAllDatesMode(false);
      setCurrentTripIndex((prev) => {
        if (filteredTrips.length === 0) return -1;
        if (prev <= 0) return filteredTrips.length - 1;
        return prev - 1;
      });
    }, [filteredTrips.length]);
  
    const showNextTrip = useCallback(() => {
      setAllDatesMode(false);
      setCurrentTripIndex((prev) => {
        if (filteredTrips.length === 0) return -1;
        if (prev === -1 || prev >= filteredTrips.length - 1) return 0;
        return prev + 1;
      });
    }, [filteredTrips.length]);
  
    const showAllTrips = useCallback(() => {
      setCurrentTripIndex(-1);
      setAllDatesMode(true);
    }, []);
  
    const toggleZoom = useCallback(() => {
      setIsZoomEnabled((prev) => !prev);
      setIsZoomLensVisible(false);
    }, []);
  
    // -----------------------------------
    //  Zoom lens mouse handlers
    // -----------------------------------
    const handleGraphMouseMove = useCallback(
      (event) => {
        if (!isZoomEnabled) return;
    
        const container = graphContainerRef.current;
        if (!container || !zoomImageUrl) return;
    
        const rect = container.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
    
        setIsZoomLensVisible(true);
    
        // Move lens near cursor
        setZoomLensPosition({
          left: x + CURSOR_OFFSET,
          top: y - LENS_SIZE / 2,
        });
    
        // Background (zoomed SVG) size and position
        const bgWidth = rect.width * ZOOM_FACTOR;
        const bgHeight = rect.height * ZOOM_FACTOR;
        setZoomBackgroundSize(`${bgWidth}px ${bgHeight}px`);
    
        const bgPosX = -(x * ZOOM_FACTOR) + LENS_SIZE / 2;
        const bgPosY = -(y * ZOOM_FACTOR) + LENS_SIZE / 2;
        setZoomBackgroundPosition(`${bgPosX}px ${bgPosY}px`);
      },
      [isZoomEnabled, zoomImageUrl]
    );
  
    const handleGraphMouseLeave = useCallback(() => {
      setIsZoomLensVisible(false);
    }, []);
  
    // Styles for the zoom lens div (like your zoomLensStyles computed)
    const zoomLensStyles = useMemo(
      () => ({
        position: "absolute",
        pointerEvents: "none",
        width: `${LENS_SIZE}px`,
        height: `${LENS_SIZE}px`,
        borderRadius: "5%",
        border: "2px solid #f9f8f7",
        overflow: "hidden",
        backgroundRepeat: "no-repeat",
        backgroundImage: zoomImageUrl ? `url(${zoomImageUrl})` : "none",
        backgroundSize: zoomBackgroundSize,
        backgroundPosition: zoomBackgroundPosition,
        transform: `translate(${zoomLensPosition.left}px, ${zoomLensPosition.top}px)`,
        display:
          isZoomLensVisible && isZoomEnabled && zoomImageUrl ? "block" : "none",
        boxShadow: "0 0 12px rgba(0,0,0,0.5)",
        zIndex: 15,
      }),
      [
        LENS_SIZE,
        zoomImageUrl,
        zoomBackgroundSize,
        zoomBackgroundPosition,
        zoomLensPosition.left,
        zoomLensPosition.top,
        isZoomLensVisible,
        isZoomEnabled,
      ]
    );
  
    // -----------------------------------
    //  JSX (template conversion)
    // -----------------------------------
    return (
      <div className="d-flex">
        <div className="v-container">
          <div className="v-row">
            <div className="v-col">
              <div className="v-card">
                <div className="v-card-title">
                  Tenco CityScale K Line Intersection Delays For Outbound K Line
                  (Distance vs Time)
                </div>
  
                <div className="v-card-text">
                  {/* Date filter buttons */}
                  <div className="date-button-container mb-4 flex gap-2">
                    {availableDates.map((date) => (
                      <button
                        key={date}
                        className="mr-2 v-btn v-btn--small"
                        type="button"
                        onClick={() => {
                          setSelectedDate(date);
                          setCurrentTripIndex(-1);
                          setAllDatesMode(false);
                        }}
                      >
                        {date.substring(0, 5)}
                      </button>
                    ))}
  
                    <button
                      type="button"
                      className="mr-2 v-btn v-btn--small v-btn--prev"
                      onClick={showPrevTrip}
                    >
                      Previous Trip
                    </button>
  
                    <button
                      type="button"
                      className="mr-2 v-btn v-btn--small v-btn--next"
                      onClick={showNextTrip}
                    >
                      Next Trip
                    </button>
  
                    <button
                      type="button"
                      className="mr-2 v-btn v-btn--small v-btn--all"
                      onClick={showAllTrips}
                    >
                      Show All Trips
                    </button>
  
                    <span>
                      {currentTripIndex >= 0 ? (
                        <>
                          Showing Trip {currentTripIndex + 1} of{" "}
                          {filteredTrips.length}
                        </>
                      ) : (
                        <>
                          Showing{" "}
                          {allDatesMode
                            ? "All Trips For All Dates"
                            : "All Trips"}{" "}
                          ({filteredTrips.length})
                        </>
                      )}
                    </span>
                  </div>
  
                  {/* Toggle Zoom Function */}
                  <div className="mb-4 flex gap-2 zoom-controls">
                    <button
                      type="button"
                      className={`mr-2 v-btn v-btn--small zoom-button ${
                        isZoomEnabled ? "zoom-enabled" : ""
                      }`}
                      onClick={toggleZoom}
                    >
                      {isZoomEnabled ? "Disable Zoom" : "Enable Zoom"}
                    </button>
                    {isZoomEnabled && (
                      <span className="zoom-hint">
                        Hover over the graph to preview a magnified area.
                      </span>
                    )}
                  </div>
  
                  {/* Graph container with loader overlay */}
                  <div
                    ref={graphContainerRef}
                    className={`graph-container relative ${
                      isZoomEnabled ? "zoom-active" : ""
                    }`}
                    onMouseMove={handleGraphMouseMove}
                    onMouseLeave={handleGraphMouseLeave}
                  >
                    {isLoading && (
                      <div
                        id="loader"
                        className="absolute inset-0 flex items-center justify-center z-10"
                      >
                        {/* Replace Vuetify progress with simple div or your own component */}
                        <div className="loader-circle" />
                      </div>
                    )}
  
                    {/* Zoom lens overlay */}
                    <div className="zoom-lens" style={zoomLensStyles} />
  
                    {/* The actual SVG */}
                    <svg id="line-graph" ref={graphSvgRef} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
  
        {/* Right Rail */}
        <div className="rail right-rail pa-4">
          <h2 className="totals-header">Totals and Averages</h2>
          <div className="totals-wrapper">
            <div className="summary-box">
              <h4>Total time at intersections:</h4>
              <p>{(totalTimeAtIntersections / 60).toFixed(2)} (minutes)</p>
            </div>
  
            <div className="summary-box">
              <h4>Average intersection duration:</h4>
              <p>{averageIntersectionDurationDisplay}</p>
            </div>
  
            <div className="summary-box">
              <h4>Average full trip duration:</h4>
              <p>{averageFullTripDurationDisplay}</p>
            </div>
  
            <div className="summary-box">
              <h4>Total full trips:</h4>
              <p>{totalNumberOfFullTrips} (vehicles)</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  export default KLineOutboundTime;
  