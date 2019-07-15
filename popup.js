let submit = document.getElementById('saveSettings');
submit.onclick = function(element) {
    let silenceSpeed = document.getElementById('silenceSpeed').value;
    let soundSpeed = document.getElementById('soundSpeed').value; 

    chrome.storage.sync.set({
        silenceSpeed: parseFloat(silenceSpeed) + 0.01,
        regularSpeed: parseFloat(soundSpeed) + 0.01,
    });
}

chrome.storage.sync.get(['silenceSpeed', 'regularSpeed', 'pauseTime'], (res)=> {
    document.getElementById('silenceSpeed').value = res.silenceSpeed ? res.silenceSpeed - 0.01 : 1;
    document.getElementById('soundSpeed').value = res.regularSpeed ? res.regularSpeed - 0.01 : 1;
    document.getElementById('videoLen').value = res.pauseTime || 0;
})