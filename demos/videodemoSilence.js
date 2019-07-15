function initialise() {
    window.context = new AudioContext();
    window.videoMedia = context.createMediaElementSource(video);

    analyser = context.createAnalyser(); //we create an analyser
    analyser.smoothingTimeConstant = 0.9;
    analyser.fftSize = 512; //the total samples are half the fft size.
    videoMedia.connect(analyser);
    analyser.connect(context.destination);
    window.canvas = document.getElementById('c');
    window.ctx = canvas.getContext("2d");
}

// Globals
totalMax = 0;
totalAvg = 0;
totalCount = 0;
trackingSamples = 1024
// trackingSamples = 512
volumeTracker = new Array(trackingSamples).fill(0);
speedTracker = new Array(trackingSamples).fill(0);
totalSilence = 0;
totalSound = 0;
silenceLen = 0;

const defaultSettings = {
    threshold: 5,
    silenceSpeed: 6,
    regularSpeed: 1.01,
    interval: 10, // in milliseconds
    timeThreshold: 10, 
    pauseTime: 10, // 0 is default and infinite
}

let zip = (xs, ys) => {
    return xs.map((e, i) =>[e, ys[i]]);
};


function weightedMedian(values, weights) {

  var midpoint = 0.5 * sum(weights);

  var cumulativeWeight = 0;
  var belowMidpointIndex = 0;

  var sortedValues = [];
  var sortedWeights = [];

  values.map(function (value, i) {

    return [value, weights[i]];
  }).sort(function (a, b) {

    return a[0] - b[0];
  }).map(function (pair) {

    sortedValues.push(pair[0]);
    sortedWeights.push(pair[1]);
  });

  if (sortedWeights.some(function (value) { return value > midpoint; })) {

    return sortedValues[sortedWeights.indexOf(Math.max.apply(null, sortedWeights))];
  }

  while (cumulativeWeight <= midpoint) {

    belowMidpointIndex++;
    cumulativeWeight += sortedWeights[belowMidpointIndex - 1];
  }

  cumulativeWeight -= sortedWeights[belowMidpointIndex - 1];

  if (cumulativeWeight - midpoint < Number.EPSILON) {

    var bounds = sortedValues.slice(belowMidpointIndex - 2, belowMidpointIndex);
    return sum(bounds) / bounds.length;
  }

  return sortedValues[belowMidpointIndex - 1];
}

const median = arr => {
  const mid = Math.floor(arr.length / 2),
    nums = [...arr].sort((a, b) => a - b);
  return arr.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
};

const sum = (soundData) => {
	let total = 0
    soundData.forEach(val => {
        total += val
    })
    return total
}

const getVolume = (soundData) => {
    var average = 0;
    for (i = 0; i < soundData.length; i++) {
        a = Math.abs(soundData[i] - 128);
        average += a;
    }
    return average/50
}

function oscilliscope(ctx, data){
	data.forEach((value, index) => {
        ctx.fillStyle = value>128 ? 'white' : 'red'
        ctx.fillRect(index*2, 300-value, 2, value-128)
    })
}


function volumeBar(ctx, volume) {
    ctx.fillStyle = isSilent(volume, 50) ? 'red': 'green';
    ctx.fillRect(100, 700-volume, 200, volume)
}

function drawVolumeTracker(ctx, threshold){
    const yPos = 300;
   	volumeTracker.forEach((volume, index) => {
        ctx.fillStyle = isSilent(volume, threshold) ? 'red' : 'white'
        ctx.fillRect(index, yPos-volume, 1, volume)
    })

    ctx.fillStyle = "red";
    ctx.fillRect(0, yPos-threshold, canvas.width, 2)

}

function drawSpeedTracker(ctx){
    const yPos = 600;
    const scale = 5

   	speedTracker.forEach((speed, index) => {
        // ctx.fillStyle = isSilent(speed, settings.threshold) ? 'red' : 'white'
        ctx.fillStyle = speed === settings.regularSpeed ? 'white' : 'red'
        const displaySpeed = speed*scale
        ctx.fillRect(index, yPos-displaySpeed, 1, displaySpeed)
    })

    ctx.fillStyle = "red";
    ctx.fillRect(0, yPos-(settings.regularSpeed*scale), canvas.width, 1) 
    ctx.fillRect(0, yPos-(settings.silenceSpeed*scale), canvas.width, 1) 
}

function trackVolumes(data) {
    const currVolume = getVolume(data)
    totalCount ++;
    totalMax = Math.max(totalMax, currVolume);
    totalAvg = totalAvg + (currVolume - totalAvg)/totalCount;
    
    isSilent(currVolume, settings.threshold) ? totalSilence += settings.interval :totalSound+= settings.interval;
    volumeTracker.shift()
    volumeTracker.push(currVolume)
    // console.log('totalCount: ', totalCount, ' max: ', totalMax, ' avg: ', totalAvg, ' current vol: ', currVolume);
}

function trackSpeed(){
   speedTracker.shift();
   speedTracker.push(video.playbackRate); 
}

function isSilent(volume, threshold) {
    return volume < threshold;
}

function setVideoSpeed(speed){
    video.playbackRate = speed;
}

function getThresholdValue(){
    const nonZeroVolumes = volumeTracker.filter(e => e>0)
    const avgSeen = sum(nonZeroVolumes)/nonZeroVolumes.length;
    const avgNoiseThresh = avgSeen

    const zipped = zip(volumeTracker, speedTracker)
    const cleanZipped = zipped.filter(t => t[0]<avgNoiseThresh && t[0])
    const cleanVolumes = cleanZipped.map(t => t[0])
    const cleanSpeed = cleanZipped.map(t => t[1])

    // const maxSeen = Math.max(...nonZeroVolumes) || 0;
    // const medianThreshold = median(cleanVolumes.filter(e=>e<avgNoiseThresh)) || 0

    const wMedian = weightedMedian(cleanVolumes, cleanSpeed)
    console.log('weighted median ', wMedian)

    // draw average noise threshold
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 300-avgNoiseThresh, canvas.width, 2) 
    return wMedian
}

 

function loop() {
    let soundData = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(soundData);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'black';
    ctx.fillRect(0,0, canvas.width, canvas.height);

    const currVolume = getVolume(soundData);

    trackVolumes(soundData, settings.threshold)
    trackSpeed()

    if (isSilent(currVolume, settings.threshold)){
        silenceLen += settings.interval;
        const silenceDiff = settings.threshold - currVolume;
        const silenceRatio = silenceDiff / settings.threshold
        if (silenceLen > settings.timeThreshold){
            const dynamicSpeed = settings.regularSpeed + (settings.silenceSpeed - settings.regularSpeed)*silenceRatio;
            setVideoSpeed(dynamicSpeed)
            // setVideoSpeed(settings.silenceSpeed)
            // console.log('silenceRatio: ', silenceRatio, ' speed: ', dynamicSpeed);
        }
    } else {
        // if (silenceLen) {
        //     console.log('silenceLen', silenceLen)
        // }
        silenceLen = 0;
        setVideoSpeed(settings.regularSpeed);
    }

    drawVolumeTracker(ctx, settings.threshold);
    drawSpeedTracker(ctx);
    // oscilliscope(ctx, soundData)

    settings.threshold = getThresholdValue();

    // requestAnimationFrame(loop); // TODO: see if we still need this
}

function loopHandler(){ 
    // only runs loop if video is running
    if (settings.pauseTime && video.currentTime >= settings.pauseTime){
        video.pause()
        const totalSeconds = totalSilence + totalSound
        console.log(' total Time: ', totalSeconds/1000, 'seconds', "\ntotalSilence: ", totalSilence/1000, '\ntotalSound: ', totalSound/1000, '\n% silence: ', (totalSilence/totalSeconds)*100, '\n% sound: ', (totalSound/totalSeconds)*100);
    } else {
        if (!video.paused ) {
            // console.log(settings.pauseTime, video.currentTime)
            loop();
        }
    }
}

settings = defaultSettings
window.video = document.getElementsByTagName('video')[0];
document.addEventListener('DOMContentLoaded', function() {
   initialise();
}, false);

// circumvents a restriction on audio context. Can only be used if after user action
video.addEventListener('playing', function() {
  context.resume().then(() => {
    console.log('Playback resumed successfully');
    // loop();

    setInterval(loopHandler, settings.interval);
  });
});


// }

// window.onload = () => {
//     saveDefaultSettings();

//     video = document.getElementsByTagName('video')[0];
//     initialise();
//     setInterval(loopHandler, settings.interval) 
// };
