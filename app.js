// Initialize HLS.js player
const video = document.getElementById('video');
const requestsLog = document.getElementById('requestsLog');
const initializeButton = document.getElementById('initializePlayer');
const timeframeInput = document.getElementById('timeframe');
const applyTimeframeButton = document.getElementById('applyTimeframe');
const requestTypeSelect = document.getElementById('requestType');
const clearLogButton = document.getElementById('clearLog');
const streamUrlInput = document.getElementById('streamUrl');
const quickLinksSelect = document.getElementById('quickLinks');
const useSelectedLinkButton = document.getElementById('useSelectedLink');
const rebufferingAlert = document.getElementById('rebufferingAlert');
const audioRebufferingAlert = document.getElementById('audioRebufferingAlert');
const bufferDropsAlert = document.getElementById('bufferDropsAlert');
const audioBufferDropsAlert = document.getElementById('audioBufferDropsAlert');
const throughputAlert = document.getElementById('throughputAlert');
const audioThroughputAlert = document.getElementById('audioThroughputAlert');
let hls = null;

// Initialize charts
let charts = null;
let chartData = {
    timestamps: [],
    bufferLength: [],
    playbackRate: [],
    bitrate: [],
    measuredThroughput: []
};

// Store all requests for filtering
let allRequests = [];

// Smart scrolling variables
let isUserScrolled = false;
let lastScrollTop = 0;
const SCROLL_THRESHOLD = 50; // pixels from bottom to consider "at bottom"

// Gauge elements
const rebufferingPercentageElement = document.getElementById('rebufferingPercentage');
const bufferDropsElement = document.getElementById('bufferDrops');
const averageBufferElement = document.getElementById('averageBuffer');
const averageBitrateElement = document.getElementById('averageBitrate');
const averageThroughputElement = document.getElementById('averageThroughput');
const maxBitrateElement = document.getElementById('maxBitrate');

// Audio gauge elements
const audioRebufferingPercentageElement = document.getElementById('audioRebufferingPercentage');
const audioBufferDropsElement = document.getElementById('audioBufferDrops');
const audioAverageBufferElement = document.getElementById('audioAverageBuffer');
const audioAverageBitrateElement = document.getElementById('audioAverageBitrate');
const audioAverageThroughputElement = document.getElementById('audioAverageThroughput');
const audioMaxBitrateElement = document.getElementById('audioMaxBitrate');

// Function to check if user is at the bottom of the log
function isAtBottom() {
    const scrollTop = requestsLog.scrollTop;
    const scrollHeight = requestsLog.scrollHeight;
    const clientHeight = requestsLog.clientHeight;
    
    // Check if we're within the threshold of the bottom
    return (scrollHeight - scrollTop - clientHeight) <= SCROLL_THRESHOLD;
}

// Function to handle scroll events
function handleScroll() {
    const currentScrollTop = requestsLog.scrollTop;
    
    // If user has scrolled up, mark as user scrolled
    if (currentScrollTop < lastScrollTop) {
        isUserScrolled = true;
    }
    
    // If user scrolls to bottom, reset the flag
    if (isAtBottom()) {
        isUserScrolled = false;
    }
    
    lastScrollTop = currentScrollTop;
}

// Function to scroll to bottom if appropriate
function scrollToBottomIfNeeded() {
    if (!isUserScrolled) {
        requestsLog.scrollTop = requestsLog.scrollHeight;
    }
}

// Function to parse CMCD data from query string
function parseCMCD(urlString) {
    const cmcdData = {};

    try{
        // Parse the URL string
        const urlObj = new URL(urlString);
        const queryString = urlObj.search;
        //console.log("Query string:", queryString);
        const params = new URLSearchParams(queryString);
        // Get CMCD parameter
        cmcdParam = params.get('CMCD');
    } catch (error) {
        console.error("Invalid URL:", error);
    }
    
    if (cmcdParam) {
        const pairs = cmcdParam.split(',');
        pairs.forEach(pair => {
            const [key, value] = pair.split('=');
            if (key && value) {
                cmcdData[key] = value;
            }
        });
    }
    return cmcdData;
}

// Function to filter requests based on type
function filterRequestsByType(requests, type) {
    if (type === 'all') return requests;
    return requests.filter(request => request.cmcdData.ot === type);
}

// Function to calculate buffer drops
function calculateBufferDrops(requests) {
    if (requests.length < 2) return 0;
    
    let drops = 0;
    for (let i = 1; i < requests.length; i++) {
        const prevBuffer = parseFloat(requests[i-1].cmcdData.bl || 0);
        const currentBuffer = parseFloat(requests[i].cmcdData.bl || 0);
        
        // Check if current buffer is 20% less than previous buffer
        if (currentBuffer < prevBuffer * 0.80) {
            drops++;
        }
    }
    return drops;
}

// Function to calculate gauge metrics
function updateGaugeMetrics() {
    if (allRequests.length === 0) return;

    const timeframe = parseInt(timeframeInput.value) * 1000;
    const now = Date.now();
    const filteredRequests = allRequests.filter(req => now - req.timestamp <= timeframe);

    if (filteredRequests.length === 0) return;

    // Calculate video metrics
    const videoRequests = filteredRequests.filter(req => req.cmcdData.ot === 'v' || req.cmcdData.ot === 'av');
    const videoRebuffering = videoRequests.filter(req => req.cmcdData.bl === '0').length;
    const videoRebufferingPercentage = (videoRebuffering / videoRequests.length) * 100;
    const videoBufferDrops = calculateBufferDrops(videoRequests);
    const videoBufferLengths = videoRequests.map(req => parseFloat(req.cmcdData.bl || 0) / 1000).filter(Boolean);
    const videoBitrates = videoRequests.map(req => parseFloat(req.cmcdData.br || 0)).filter(Boolean);
    const videoThroughputs = videoRequests.map(req => parseFloat(req.cmcdData.mtp || 0)).filter(Boolean);

    // Calculate video averages
    const videoAvgBitrate = videoBitrates.reduce((a, b) => a + b, 0) / videoBitrates.length;
    const videoAvgThroughput = videoThroughputs.reduce((a, b) => a + b, 0) / videoThroughputs.length;

    // Update video gauges
    rebufferingPercentageElement.textContent = `${videoRebufferingPercentage.toFixed(2)}%`;
    rebufferingAlert.style.display = videoRebufferingPercentage > 1.0 ? 'inline' : 'none';
    bufferDropsElement.textContent = videoBufferDrops;
    bufferDropsAlert.style.display = videoBufferDrops > 0 ? 'inline' : 'none';
    averageBufferElement.textContent = `${(videoBufferLengths.reduce((a, b) => a + b, 0) / videoBufferLengths.length).toFixed(2)} sec`;
    averageBitrateElement.textContent = `${(videoAvgBitrate / 1000).toFixed(2)} Mbps`;
    maxBitrateElement.textContent = `${(Math.max(...videoBitrates) / 1000).toFixed(2)} Mbps`;
    averageThroughputElement.textContent = `${(videoAvgThroughput / 1000).toFixed(2)} Mbps`;
    throughputAlert.style.display = videoAvgThroughput < videoAvgBitrate ? 'inline' : 'none';

    // Calculate audio metrics
    const audioRequests = filteredRequests.filter(req => req.cmcdData.ot === 'a');
    const audioRebuffering = audioRequests.filter(req => req.cmcdData.bl === '0').length;
    const audioRebufferingPercentage = (audioRebuffering / audioRequests.length) * 100;
    const audioBufferDrops = calculateBufferDrops(audioRequests);
    const audioBufferLengths = audioRequests.map(req => parseFloat(req.cmcdData.bl || 0) / 1000).filter(Boolean);
    const audioBitrates = audioRequests.map(req => parseFloat(req.cmcdData.br || 0)).filter(Boolean);
    const audioThroughputs = audioRequests.map(req => parseFloat(req.cmcdData.mtp || 0)).filter(Boolean);

    // Calculate audio averages
    const audioAvgBitrate = audioBitrates.reduce((a, b) => a + b, 0) / audioBitrates.length;
    const audioAvgThroughput = audioThroughputs.reduce((a, b) => a + b, 0) / audioThroughputs.length;

    // Update audio gauges
    audioRebufferingPercentageElement.textContent = `${audioRebufferingPercentage.toFixed(2)}%`;
    audioRebufferingAlert.style.display = audioRebufferingPercentage > 1.0 ? 'inline' : 'none';
    audioBufferDropsElement.textContent = audioBufferDrops;
    audioBufferDropsAlert.style.display = audioBufferDrops > 0 ? 'inline' : 'none';
    audioAverageBufferElement.textContent = `${(audioBufferLengths.reduce((a, b) => a + b, 0) / audioBufferLengths.length).toFixed(2)} sec`;
    audioAverageBitrateElement.textContent = `${(audioAvgBitrate / 1000).toFixed(2)} Mbps`;
    audioMaxBitrateElement.textContent = `${(Math.max(...audioBitrates) / 1000).toFixed(2)} Mbps`;
    audioAverageThroughputElement.textContent = `${(audioAvgThroughput / 1000).toFixed(2)} Mbps`;
    audioThroughputAlert.style.display = audioAvgThroughput < audioAvgBitrate ? 'inline' : 'none';
}

// Function to update charts with new data
function updateCharts(cmcdData, timestamp) {
    if (!charts) {
        console.error('Charts not initialized');
        return;
    }
    
    try {
        // Add new data to allRequests
        allRequests.push({
            timestamp,
            cmcdData,
            url: '' // Add URL if needed
        });
        
        // Update gauge metrics
        updateGaugeMetrics();
        
        // Get current timeframe
        const timeframeSeconds = parseInt(timeframeInput.value) * 1000; // Convert to milliseconds
        const currentTime = Date.now();
        const cutoffTime = currentTime - timeframeSeconds;
        
        // Filter requests by type and timeframe
        const selectedType = requestTypeSelect.value;
        const filteredRequests = filterRequestsByType(allRequests, selectedType)
            .filter(request => request.timestamp >= cutoffTime);
        
        // Extract data for charts
        const filteredData = {
            timestamps: filteredRequests.map(r => r.timestamp),
            bufferLength: filteredRequests.map(r => r.cmcdData.bl ? parseFloat(r.cmcdData.bl) : null),
            playbackRate: filteredRequests.map(r => r.cmcdData.pr ? parseFloat(r.cmcdData.pr) : null),
            bitrate: filteredRequests.map(r => r.cmcdData.br ? parseFloat(r.cmcdData.br) : null),
            measuredThroughput: filteredRequests.map(r => r.cmcdData.mtp ? parseFloat(r.cmcdData.mtp) : null)
        };
        
        // Update charts with filtered data
        const timeLabels = filteredData.timestamps.map(t => new Date(t));
        
        // Update each chart with error handling
        try {
            charts.bufferLength.data.labels = timeLabels;
            charts.bufferLength.data.datasets[0].data = filteredData.bufferLength;
            charts.bufferLength.options.scales.x.min = new Date(cutoffTime);
            charts.bufferLength.options.scales.x.max = new Date(currentTime);
            charts.bufferLength.update('none');
        } catch (error) {
            console.error('Error updating buffer length chart:', error);
        }
        
        try {
            charts.playbackRate.data.labels = timeLabels;
            charts.playbackRate.data.datasets[0].data = filteredData.playbackRate;
            charts.playbackRate.options.scales.x.min = new Date(cutoffTime);
            charts.playbackRate.options.scales.x.max = new Date(currentTime);
            charts.playbackRate.update('none');
        } catch (error) {
            console.error('Error updating playback rate chart:', error);
        }
        
        try {
            charts.bitrate.data.labels = timeLabels;
            charts.bitrate.data.datasets[0].data = filteredData.bitrate;
            charts.bitrate.options.scales.x.min = new Date(cutoffTime);
            charts.bitrate.options.scales.x.max = new Date(currentTime);
            charts.bitrate.update('none');
        } catch (error) {
            console.error('Error updating bitrate chart:', error);
        }

        try {
            charts.measuredThroughput.data.labels = timeLabels;
            charts.measuredThroughput.data.datasets[0].data = filteredData.measuredThroughput;
            charts.measuredThroughput.options.scales.x.min = new Date(cutoffTime);
            charts.measuredThroughput.options.scales.x.max = new Date(currentTime);
            charts.measuredThroughput.update('none');
        } catch (error) {
            console.error('Error updating measured throughput chart:', error);
        }
    } catch (error) {
        console.error('Error in updateCharts:', error);
    }
}

// Function to apply timeframe filter
function applyTimeframeFilter() {
    if (!charts) return;
    
    const timeframe = parseInt(timeframeInput.value) * 1000;
    const now = Date.now();
    
    // Remove requests older than the new timeframe from allRequests
    allRequests = allRequests.filter(req => now - req.timestamp <= timeframe);

    // Get the most recent data point
    const lastTimestamp = allRequests.length > 0 ? allRequests[allRequests.length - 1].timestamp : null;
    if (!lastTimestamp) return;
    
    // Update the log display with filtered requests
    updateLogDisplay();

    // Update charts with current data filtered by new timeframe
    updateCharts({}, lastTimestamp);
}

// Function to log request data
function logRequest(url, cmcdData) {
    const selectedType = requestTypeSelect.value;
    
    // Check if the request matches the selected type
    if (selectedType === 'all' || cmcdData.ot === selectedType) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${url}\nCMCD Data: ${JSON.stringify(cmcdData, null, 2)}\n\n`;
        requestsLog.value += logEntry;
        scrollToBottomIfNeeded();
    }
}

// Function to update log display based on current filter
function updateLogDisplay() {
    // Clear current log
    requestsLog.value = '';
    
    // Get selected type
    const selectedType = requestTypeSelect.value;
    
    // Filter and display matching requests
    allRequests.forEach(request => {
        if (selectedType === 'all' || request.cmcdData.ot === selectedType) {
            const timestamp = new Date(request.timestamp).toISOString();
            const logEntry = `[${timestamp}] ${request.url}\nCMCD Data: ${JSON.stringify(request.cmcdData, null, 2)}\n\n`;
            requestsLog.value += logEntry;
        }
    });
    
    // Scroll to bottom if appropriate
    scrollToBottomIfNeeded();
}

// Function to clear all data
function clearAllData() {
    // Clear the requests log
    requestsLog.value = '';
    
    // Reset scroll state
    isUserScrolled = false;
    lastScrollTop = 0;
    
    // Clear all requests array
    allRequests = [];
    
    // Reset gauge metrics
    updateGaugeMetrics();
    
    // Clear chart data
    if (charts) {
        // Clear each chart's data
        Object.values(charts).forEach(chart => {
            chart.data.labels = [];
            chart.data.datasets[0].data = [];
            chart.update('none');
        });
    }
    
    // Reset chart data object
    chartData = {
        timestamps: [],
        bufferLength: [],
        playbackRate: [],
        bitrate: [],
        measuredThroughput: []
    };
}

// Function to clean up previous player instance
function cleanupPlayer() {
    if (hls) {
        hls.stopLoad();
        hls.destroy();
        hls = null;
    }
    
    // Reset video element
    video.pause();
    video.currentTime = 0;
    video.src = '';
    
    // Clear all data
    clearAllData();
}

// Initialize HLS.js with CMCD monitoring
function initializePlayer(hlsUrl) {
    // Clean up previous instance
    cleanupPlayer();
    
    if (Hls.isSupported()) {
        hls = new Hls({
            debug: false,
            enableWorker: true,
            lowLatencyMode: true,
            preload: false,  // Disable preloading
            maxBufferLength: 30, // Maximum buffer length in seconds
            maxMaxBufferLength: 600, // Maximum buffer length in seconds when buffer is full
            maxBufferSize: 60 * 1000 * 1000, // Maximum buffer size in bytes
            maxBufferHole: 0.5, // Maximum buffer hole in seconds
            lowLatencyMode: true,
            backBufferLength: 90, // Back buffer length in seconds
            cmcd: {
                enabled: true,
                sessionId: 'session-' + Date.now(),
                version: 1
                //,
                // value: {
                //     bl: true,    // Buffer Length
                //     br: true,    // Encoded Bitrate
                //     pr: true,    // Playback Rate
                //     bs: true,    // Buffer State
                //     cid: true,   // Content ID
                //     nrr: true,   // Next Request Range
                //     su: true,    // Startup
                //     tb: true,    // Throughput
                //     ot: true     // Object Type
                // }
            },
            xhrSetup: function(xhr, url) {
                xhr.onload = function() {
                    const cmcdData = parseCMCD(url);
                    if (Object.keys(cmcdData).length > 0) {
                        logRequest(url, cmcdData);
                        updateCharts(cmcdData, Date.now());
                    }
                };
            }
        });
        
        // Use the URL from input field
        hls.loadSource(hlsUrl);
        hls.attachMedia(video);
        
        // Handle playback state changes
        video.addEventListener('pause', function() {
            if (hls) {
                hls.stopLoad(); // Stop loading new segments
                console.log('Playback paused, stopped loading segments');
            }
        });
        
        video.addEventListener('play', function() {
            if (hls) {
                hls.startLoad(); // Resume loading segments
                console.log('Playback resumed, started loading segments');
            }
        });
        
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
            // Set video to muted and start playback
            video.muted = true;
            video.play().catch(function(error) {
                console.error('Error starting playback:', error);
            });
        });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = hlsUrl;
        // Set video to muted and start playback
        video.muted = true;
        video.play().catch(function(error) {
            console.error('Error starting playback:', error);
        });
    }
}

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded event triggered');
    
    // Debug log for canvas elements
    const bufferLengthCanvas = document.getElementById('bufferLengthChart');
    const playbackRateCanvas = document.getElementById('playbackRateChart');
    const bitrateCanvas = document.getElementById('bitrateChart');
    const measuredThroughputCanvas = document.getElementById('measuredThroughputChart');
    
    console.log('Canvas elements:', {
        bufferLength: bufferLengthCanvas,
        playbackRate: playbackRateCanvas,
        bitrate: bitrateCanvas,
        measuredThroughput: measuredThroughputCanvas
    });

    // Verify Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded!');
        return;
    }

    try {
        // Initialize charts
        charts = {
            bufferLength: new Chart(bufferLengthCanvas, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Buffer Length (bl)',
                        data: [],
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    debug: true,
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'second',
                                displayFormats: {
                                    second: 'HH:mm:ss'
                                }
                            }
                        },
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            }),
            playbackRate: new Chart(playbackRateCanvas, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Playback Rate (pr)',
                        data: [],
                        borderColor: 'rgb(255, 99, 132)',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    debug: true,
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'second',
                                displayFormats: {
                                    second: 'HH:mm:ss'
                                }
                            }
                        },
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            }),
            bitrate: new Chart(bitrateCanvas, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Encoded Bitrate (br)',
                        data: [],
                        borderColor: 'rgb(54, 162, 235)',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    debug: true,
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'second',
                                displayFormats: {
                                    second: 'HH:mm:ss'
                                }
                            }
                        },
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            }),
            measuredThroughput: new Chart(measuredThroughputCanvas, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Measured Throughput (mtp)',
                        data: [],
                        borderColor: 'rgb(153, 102, 255)',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    debug: true,
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'second',
                                displayFormats: {
                                    second: 'HH:mm:ss'
                                }
                            }
                        },
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            })
        };

        console.log('Charts initialized successfully:', charts);

        // Add scroll event listener to requests log
        requestsLog.addEventListener('scroll', handleScroll);

        // Add click handler for initialize button
        initializeButton.addEventListener('click', function() {
            const hlsUrl = streamUrlInput.value.trim();
            if (!hlsUrl) {
                console.error('Please enter a valid stream URL');
                return;
            }
            initializePlayer(hlsUrl);
        });


        // Add change handler for request type select
        requestTypeSelect.addEventListener('change', function() {
            applyTimeframeFilter();
            updateLogDisplay();
        });

        // Add click handler for clear log button
        clearLogButton.addEventListener('click', function() {
            clearAllData();
        });

        // Add event listener for Use selected link button
        useSelectedLinkButton.addEventListener('click', function() {
            streamUrlInput.value = quickLinksSelect.value;
        });
    } catch (error) {
        console.error('Error initializing charts:', error);
    }
}); 