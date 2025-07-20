let userLocation;
let routeSteps = [];
let stepIndex = 0;
let routeLine;
let trackingId = null;
let alerted = false; // Prevent repeat alerts
let hwyRt = false;

// Initial location snapshot
navigator.geolocation.getCurrentPosition(
    (pos) => {
        userLocation = [pos.coords.latitude, pos.coords.longitude];
        L.marker(userLocation)
            .addTo(map)
            .bindPopup("You are here")
            .openPopup();
        map.setView(userLocation, 13);
    },
    (err) => {
        console.error("Geolocation error:", err.message);
        alert("Unable to detect your location. Please check browser permissions and try again.");
    }
);


// Route calculation
async function routeToDestination(customOrigin = null) {
    const query = document.getElementById("searchInput").value;
    const origin = customOrigin || userLocation;
    if (!query || !origin) {
        alert("Please enter a destination and allow location access.");
        return;
    }

    const geocodeRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`
    );
    const results = await geocodeRes.json();
    if (!results[0]) {
        alert("Destination not found.");
        return;
    }

    const destLatLng = [parseFloat(results[0].lat), parseFloat(results[0].lon)];
    L.marker(destLatLng).addTo(map).bindPopup("Destination");

    const routeRes = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${destLatLng[1]},${destLatLng[0]}?overview=full&geometries=geojson&steps=true`
    );
    const routeData = await routeRes.json();

    if (!routeData.routes || routeData.routes.length === 0) {
        alert("Route could not be calculated.");
        return;
    }

    const routeGeoJSON = routeData.routes[0].geometry;
    routeSteps = routeData.routes[0].legs[0].steps;
    checkHighwayRatio();
    stepIndex = 0;
    alerted = false;

    const routeDurationSeconds = routeData.routes[0].duration;
    const routeDistanceMeters = routeData.routes[0].distance;

    window.avgRouteSpeed = routeDistanceMeters / routeDurationSeconds;
    if (hwyRt) {window.assumedSpeed = window.avgRouteSpeed * 1.35;}
    else {window.assumedSpeed = window.avgRouteSpeed * 1.15;}
    window.remainingRouteDistance = routeDistanceMeters;

    const now = new Date();
    const assumedSpeed = window.assumedSpeed || window.avgRouteSpeed || 13.4;
    const initialSeconds = routeDistanceMeters / assumedSpeed;
    const arrival = new Date(now.getTime() + initialSeconds * 1000);
    const formattedETA = arrival.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });

    const totalHours = Math.floor(initialSeconds / 3600);
    const totalMinutes = Math.round((initialSeconds % 3600) / 60);
    const totalDurationFormatted = totalHours > 0
        ? `${totalHours} hr ${totalMinutes} min`
        : `${totalMinutes} min`;

    const totalMiles = (routeDistanceMeters / 1609.34).toFixed(1);

    document.getElementById("etaText").textContent = formattedETA;
    document.getElementById("durationText").textContent = totalDurationFormatted;
    document.getElementById("distanceText").textContent = `${totalMiles} mi`;


    window.routeEndCoord = routeSteps[routeSteps.length - 1].maneuver.location;
    window.routeGeometryCoords = routeGeoJSON.coordinates;

    if (routeLine) {
        map.removeLayer(routeLine);
    }
    routeLine = L.geoJSON(routeGeoJSON, {
        style: { color: "blue", weight: 5 }
    }).addTo(map);

    map.fitBounds(routeLine.getBounds());

    updateNextInstruction();
    updateInstructionList();

    // Show "Start Route" button only if not rerouting mid-trip
    if (!trackingId && !document.getElementById("startBtn")) {
        const startBtn = document.createElement("button");
        startBtn.id = "startBtn";
        startBtn.textContent = "Start Route";
        startBtn.className = "start-button";
        startBtn.onclick = beginTracking;
        document.getElementById("instructionPanel").appendChild(startBtn);
    }

    document.getElementById("endBtn").style.display = "block";
}

function checkHighwayRatio() {
    if (!routeSteps || routeSteps.length === 0) return;

    const highwayKeywords = ["I-", "Interstate", "Hwy", "Highway", "US-", "Route "];
    let highwayCount = 0;

    routeSteps.forEach((step) => {
        const name = step.name || "";
        if (highwayKeywords.some(keyword => name.includes(keyword))) {
            highwayCount++;
        }
    });

    const ratio = (highwayCount / routeSteps.length * 100).toFixed(1);
    console.log(`Highway steps: ${highwayCount}/${routeSteps.length} (${ratio}%)`);

    if (ratio > 50) {
        //alert("Most of your route appears to be on highway segments.");
        hwyRt = true;
    } //else {
        //alert("Your route is primarily on non-highway or local roads.");
    //}
}



// Begin live tracking
function beginTracking() {
    if (trackingId) return;

    trackingId = navigator.geolocation.watchPosition(
        (pos) => {
            userLocation = [pos.coords.latitude, pos.coords.longitude];

            // Zoom and center
            map.setView(userLocation, 16);

            // Live marker
            if (!window.liveMarker) {
                window.liveMarker = L.marker(userLocation).addTo(map);
            } else {
                window.liveMarker.setLatLng(userLocation);
            }

            // Compass rotation setup
            if (typeof window.rotateMap === "undefined") {
                window.rotateMap = true;
                document.getElementById("toggleRotation").onclick = () => {
                    window.rotateMap = !window.rotateMap;
                    document.getElementById("toggleRotation").textContent = window.rotateMap ? "Rotation On" : "Rotation Off";
                    document.getElementById("map").style.transform = "rotate(0deg)";
                    document.getElementById("compass").style.transform = "rotate(0deg)";
                };
            }

            if (window.lastLocation) {
                const deltaLat = userLocation[0] - window.lastLocation[0];
                const deltaLng = userLocation[1] - window.lastLocation[1];
                const headingRadians = Math.atan2(deltaLng, deltaLat);
                const headingDeg = (headingRadians * 180) / Math.PI;

                if (window.rotateMap) {
                    document.getElementById("map").style.transform = `rotate(${-headingDeg}deg)`;
                }
                document.getElementById("compass").style.transform = `rotate(${headingDeg}deg)`;
            }
            window.lastLocation = [...userLocation];

            // Save route start time if first update
            if (!window.routeStartTime) {
                window.routeStartTime = Date.now();
            }

            // Turn alert logic
            if (stepIndex < routeSteps.length) {
                const nextStep = routeSteps[stepIndex];
                const target = nextStep.maneuver.location;
                const distanceToTurn = map.distance(
                    L.latLng(userLocation[0], userLocation[1]),
                    L.latLng(target[1], target[0])
                );

                const prevDist = stepIndex === 0 ? 9999 : routeSteps[stepIndex - 1].distance;
                const threshold = prevDist > 1609 ? 1609 : 321.87;

                if (!alerted && distanceToTurn < threshold + 50 && distanceToTurn > threshold - 50) {
                    const text = nextStep.maneuver.instruction || `${nextStep.maneuver.type} on ${nextStep.name || "road"}`;
                    speechSynthesis.speak(new SpeechSynthesisUtterance(`Upcoming: ${text}`));
                    alerted = true;
                }

                if (distanceToTurn < 30.48) {
                    stepIndex++;
                    alerted = false;
                    updateNextInstruction();
                    updateInstructionList();
                }

                updateSpeedLimitDisplay(); // ⬅️ Refresh speed limit when step changes
            }

            // ETA + miles left updater
            if (routeSteps.length > 0) {
                const remainingMeters = routeSteps
                    .slice(stepIndex)
                    .reduce((total, step) => total + step.distance, 0);

                const avgSpeed = window.assumedSpeed || window.avgRouteSpeed || 13.4;
                const estSecondsLeft = remainingMeters / avgSpeed;
                const elapsedSeconds = (Date.now() - window.routeStartTime) / 1000;
                const adjustedSecondsLeft = Math.max(estSecondsLeft - elapsedSeconds, 60);

                const now = new Date();
                const eta = new Date(now.getTime() + adjustedSecondsLeft * 1000);
                const formattedETA = eta.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit"
                });

                const hours = Math.floor(adjustedSecondsLeft / 3600);
                const minutes = Math.round((adjustedSecondsLeft % 3600) / 60);
                const durationFormatted = hours > 0
                    ? `${hours} hr ${minutes} min`
                    : `${minutes} min`;

                const milesLeft = (remainingMeters / 1609.34).toFixed(1);

                document.getElementById("etaText").textContent = formattedETA;
                document.getElementById("durationText").textContent = durationFormatted;
                document.getElementById("distanceText").textContent = `${milesLeft} mi`;
            }

            // Off-route detection → reroute if off track > 5s
            if (window.routeGeometryCoords) {
                const userLatLng = L.latLng(userLocation[0], userLocation[1]);
                const onRoute = window.routeGeometryCoords.some(coord => {
                    const point = L.latLng(coord[1], coord[0]);
                    return map.distance(userLatLng, point) < 100;
                });

                if (!onRoute) {
                    if (!window.offRouteStart) {
                        window.offRouteStart = Date.now();
                    } else {
                        const timeOffRoute = Date.now() - window.offRouteStart;
                        if (timeOffRoute > 5000) {
                            console.log("Off route! Recalculating...");
                            window.offRouteStart = null;
                            routeToDestination(userLocation);
                            return;
                        }
                    }
                } else {
                    window.offRouteStart = null;
                }
            }
        },
        (err) => {
            console.error("Live tracking error:", err.message);
        },
        { enableHighAccuracy: true }
    );

    const startBtn = document.getElementById("startBtn");
    if (startBtn) {
        startBtn.remove();
    }
}

// Update next instruction
function updateNextInstruction() {
    if (stepIndex >= routeSteps.length) {
        document.getElementById("navText").textContent = "Arrived at destination";
        document.querySelector("#navInstruction i").className = "fas fa-flag-checkered";
        speechSynthesis.speak(new SpeechSynthesisUtterance("You have arrived"));
        return;
    }

    const step = routeSteps[stepIndex];
    const text = step.maneuver.instruction || `${step.maneuver.type} on ${step.name || "road"}`;
    const type = step.maneuver.type;

    document.getElementById("navText").textContent = `Next turn: ${text}`;

    const iconMap = {
        left: "fa-arrow-left",
        right: "fa-arrow-right",
        straight: "fa-arrow-up",
        depart: "fa-play",
        arrive: "fa-flag-checkered",
        roundabout: "fa-circle-notch"
    };
    const iconClass = iconMap[type] || "fa-arrow-up";
    document.querySelector("#navInstruction i").className = `fas ${iconClass}`;

    speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

// Format distance
function formatDistance(meters) {
    if (meters < 161) {
        return `${Math.round(meters * 3.28084)} ft`;
    } else if (meters < 1609) {
        const miles = meters / 1609.34;
        if (miles < 0.33) return "¼ mi";
        if (miles < 0.42) return "⅓ mi";
        if (miles < 0.58) return "½ mi";
        if (miles < 0.70) return "⅔ mi";
        return "¾ mi";
    } else {
        return `${(meters / 1609.34).toFixed(1)} mi`;
    }
}

// Instruction list
function updateInstructionList() {
    const instructionList = document.getElementById("instructionList");
    instructionList.innerHTML = "";

    routeSteps.slice(stepIndex, stepIndex + 3).forEach((step, i) => {
        const text = step.maneuver.instruction || `${step.maneuver.type} on ${step.name || "road"}`;
        const direction = step.maneuver.modifier || "straight";

        // Real-time distance calculation from user to maneuver
        let liveDistanceMeters = step.distance;
        if (userLocation && step.maneuver.location) {
            const maneuverCoord = L.latLng(step.maneuver.location[1], step.maneuver.location[0]);
            const userCoord = L.latLng(userLocation[0], userLocation[1]);
            liveDistanceMeters = map.distance(userCoord, maneuverCoord);
        }

        const distanceFormatted = formatDistance(liveDistanceMeters);

        const li = document.createElement("li");
        li.textContent = `In ${distanceFormatted} → ${direction.toUpperCase()}: ${text}`;
        instructionList.appendChild(li);
    });
}


// Reset route
function clearRoute() {
    if (routeLine) {
        map.removeLayer(routeLine);
        routeLine = null;
    }

    if (trackingId) {
        navigator.geolocation.clearWatch(trackingId);
        trackingId = null;
    }

    routeSteps = [];
    stepIndex = 0;

    map.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });

    document.getElementById("instructionList").innerHTML = "";
    document.getElementById("navText").textContent = "";
    document.querySelector("#navInstruction i").className = "fas fa-arrow-up";

    const startBtn = document.getElementById("startBtn");
    if (startBtn) {
        startBtn.remove();
    }

    document.getElementById("endBtn").style.display = "none";
}

function updateSpeedLimitDisplay() {
    if (stepIndex >= routeSteps.length) {
        document.getElementById("speedLimitSign").style.display = "none";
        return;
    }

    const step = routeSteps[stepIndex];
    let speedLimit = step.speed_limit || null;

    // 🔄 If OSRM doesn't give speed limits, simulate basic logic:
    if (!speedLimit && step.name) {
        const name = step.name;
        if (name.match(/I-|Interstate|US-|Route \d+/)) speedLimit = 65;
        else if (name.match(/Ave|St|Blvd|Dr|Rd/)) speedLimit = 35;
        else speedLimit = null; // Unknown road type
    }

    if (speedLimit) {
        document.getElementById("speedLimitValue").textContent = speedLimit;
        document.getElementById("speedLimitSign").style.display = "block";
    } else {
        document.getElementById("speedLimitSign").style.display = "none";
    }
}
