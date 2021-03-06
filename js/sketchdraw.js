const apiUrl = "https://pixelapi.gti.nz/";
//const apiUrl = "http://192.168.1.5:8888/";
let guid;
let currTime = Date.now();
let recentPosts = [];
let popularPosts = [];
let replies = [];
let dataCache = [];

function getQueryVariable(variable)
{
  var query = window.location.search.substring(1);
  var vars = query.split("&");
  for (var i=0;i<vars.length;i++) {
          var pair = vars[i].split("=");
          if(pair[0] == variable){return pair[1];}
  }
  return(false);
}

function msToTime(duration) {
  var seconds = Math.floor((duration / 1000) % 60),
    minutes = Math.floor((duration / (1000 * 60)) % 60),
    hours = Math.floor((duration / (1000 * 60 * 60)) % 24),
    days = Math.floor(duration / (1000 * 60 * 60 * 24));

  hours = (hours < 10) ? '0' + hours : hours;
  minutes = (minutes < 10) ? '0' + minutes : minutes;
  seconds = (seconds < 10) ? '0' + seconds : seconds;

  return (days > 0 ? days + 'd ' : '') + (hours > 0 ? hours + 'h ' : '') + minutes + 'm ' + seconds + 's';
}

function getReplyId() {
  return localStorage.getItem("pixelReplyId");
}

function setReplyId(id) {
  if (id)
    localStorage.setItem("pixelReplyId", id);
  else
    localStorage.removeItem("pixelReplyId")
}

function normalizeVector(vector) {
  if (vector.x == 0 && vector.y == 0) {
    return vector;
  }
  var magnitude = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
  vector.x /= magnitude;
  vector.y /= magnitude;
  return vector;
}

function ajaxGet(url, callback) {
  var getReq = new XMLHttpRequest();
  getReq.addEventListener("load", callback);
  getReq.open("GET", apiUrl + url);
  getReq.send();
}

function ajaxPost(url, callback, data) {
  var getReq = new XMLHttpRequest();
  getReq.addEventListener("load", callback);
  getReq.open("POST", apiUrl + url);
  getReq.setRequestHeader("Content-type", "text/plain");
  getReq.send(JSON.stringify(data));
}

function getGuid() {
  guid = localStorage.getItem("pixelGuid");
  if (!guid) {
    ajaxGet("guid", function(){
      guid = this.responseText;
      if (guid) {
        localStorage.setItem("pixelGuid", guid);
      }
    })
  }
}

function downloadURI(uri, name) {
  var link = document.createElement("a");
  link.download = name;
  link.href = uri;
  document.body.append(link);
  link.click();
  link.remove();
}

function downloadSketch(id) {
  let bg = '#eaead9';
  let width = 128 * 4;
  let height = 72 * 4;
  let canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  let context = canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  context.fillStyle = bg;
  context.fillRect(0,0,width,height);
  context.drawImage(document.querySelector('div.sketch[data-sketch-id="' + id + '"] img'), 0, 0, 128, 72, 0, 0, width, height);
  var myImage = canvas.toDataURL("image/png");
  canvas.remove();
  downloadURI("data:" + myImage, "doodle_" + id + ".png");
}


function attachDrawingToCanvas(canvas, replayButton) {

  let context = canvas.getContext("2d");
  let mouseCoords = {x: 0, y: 0};
  let mouseDown, mouseOver, mouseReleased = false;
  let sketchHistory = [];
  let imageData;
  let replayInProgress = false;
  let lastPosition = false;

  let updateCursor = function() {
    context.beginPath();
    if (sketchHistory.filter(s => s.x == mouseCoords.x && s.y == mouseCoords.y).length == 0) {
      context.fillStyle = "#CCC";  
    } else {
      context.fillStyle = "#555";
    }
    
    context.rect(mouseCoords.x, mouseCoords.y, 1, 1);
    context.fill();
  };

  let updateCanvasDrawing = function() {
    if (imageData) {
      context.putImageData(imageData, 0, 0);
    }
    if (mouseDown && mouseOver) {
      context.fillStyle = "#000";
      if (!mouseReleased && lastPosition) {
        fillInGap();
      }
      mouseReleased = false;
      if (sketchHistory.filter(s => s.x == mouseCoords.x && s.y == mouseCoords.y).length == 0) {
        context.beginPath();      
        context.rect(mouseCoords.x, mouseCoords.y, 1, 1);
        context.fill();
        sketchHistory.push({x:mouseCoords.x, y:mouseCoords.y});
      }
      lastPosition = {x:mouseCoords.x, y:mouseCoords.y};
    }
    imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  };

  let fillInGap = function() {
    let vector = {x:mouseCoords.x - lastPosition.x, y: mouseCoords.y - lastPosition.y};
    let steps = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
    if (steps > 1 && steps < 50) {
      vector = normalizeVector(vector);
      let x = lastPosition.x;
      let y = lastPosition.y;
      for (var i = 0; i < steps - 1; i++) {
        x += vector.x;
        y += vector.y;
        if (sketchHistory.filter(s => s.x == Math.round(x) && s.y == Math.round(y)).length == 0) {
          context.beginPath();      
          context.rect(Math.round(x), Math.round(y), 1, 1);
          context.fill();
          sketchHistory.push({x:Math.round(x), y:Math.round(y)});
        }
      }
    }
  };
  
  let updateCanvas = function() {
    if (replayInProgress)
      return;
    updateCanvasDrawing();
    updateCursor();
  };

  let animationFrameId;

  let startReplay = function() {
    if (animationFrameId)
      cancelAnimationFrame(animationFrameId);

    context.fillStyle = "#000";
    replayInProgress = true;
    let replayCounter = 0;
    context.clearRect(0, 0, canvas.width, canvas.height);
    let drawHistory = function() {
      if (replayCounter < sketchHistory.length) {
        context.beginPath();
        context.rect(sketchHistory[replayCounter].x, sketchHistory[replayCounter].y, 1, 1);
        context.fill();
      } else {
        replayInProgress = false;
      }
      replayCounter++;
    }
    let updateReplay = function() {
      drawHistory();
      drawHistory();
      animationFrameId = requestAnimationFrame(updateReplay);
    }
    updateReplay();
  };

  canvas.addEventListener("mousemove", function(event){
    let xFactor = canvas.width / canvas.clientWidth;
    let yFactor = canvas.height / canvas.clientHeight;
    mouseCoords.x = Math.round((xFactor * event.offsetX) - 0.5);
    mouseCoords.y = Math.round((yFactor * event.offsetY) - 0.5);
    updateCanvas();
  });
  canvas.addEventListener("mouseleave", function(){
    mouseOver = false;
  });
  canvas.addEventListener("mouseenter", function(){
    mouseOver = true;
  });
  document.body.addEventListener("mousedown", function(event){
    if (event.button == 0) {
      mouseDown = true;
      updateCanvas();
    }
  });
  document.body.addEventListener("mouseup", function(){
    mouseDown = false;
    mouseReleased = true;
    updateCanvas();
  });
  canvas.addEventListener("touchstart", function(event){
    mouseOver = true;
    mouseDown = true;
    let xFactor = canvas.width / canvas.clientWidth;
    let yFactor = canvas.height / canvas.clientHeight;
    let rect = canvas.getBoundingClientRect();
    mouseCoords.x = Math.round((xFactor * (event.targetTouches[0].clientX  - rect.x)));
    mouseCoords.y = Math.round((yFactor * (event.targetTouches[0].clientY  - rect.y)));
    updateCanvas();
  });
  canvas.addEventListener("touchend", function(){
    mouseOver = false;
    mouseDown = false;
    mouseReleased = true;
  });
  canvas.addEventListener("touchmove", function(event){
    event.preventDefault();
    let xFactor = canvas.width / canvas.clientWidth;
    let yFactor = canvas.height / canvas.clientHeight;
    let rect = canvas.getBoundingClientRect();
    mouseCoords.x = Math.round((xFactor * (event.targetTouches[0].clientX  - rect.x)));
    mouseCoords.y = Math.round((yFactor * (event.targetTouches[0].clientY  - rect.y)));
    updateCanvas();
  });
  replayButton.addEventListener("click", startReplay);
  document.getElementById("post-button").addEventListener("click", function(){
    ajaxPost("post", function(){
      postedDrawing();
      context.clearRect(0, 0, canvas.width, canvas.height);
      sketchHistory = [];
      imageData = false;
    },  {
      user:guid,
      parent:getReplyId(),
      data:LZString.compressToBase64(JSON.stringify(sketchHistory))
    });
  });
  document.getElementById("trash-button").addEventListener("click", function(){
    sketchHistory = [];
    imageData = false;
    context.clearRect(0, 0, canvas.width, canvas.height);
  });
}

function hidePanels() {
  document.getElementById("list-panel").classList.add("hidden");
  document.getElementById("replies").classList.add("hidden");
  document.getElementById("recent").classList.add("hidden");
  document.getElementById("popular").classList.add("hidden");
  document.getElementById("create").classList.add("hidden");
  document.getElementById("doodle-button").classList.add("hidden");
  document.getElementById("back-button").classList.add("hidden");
  document.getElementById("reply-button").classList.add("hidden");
  document.getElementById("recent-button").classList.remove("active");
  document.getElementById("popular-button").classList.remove("active");
}

function startDrawing(addHistory = true) {
  if (addHistory)
    history.pushState(null, null, 'create.html');
  setReplyId(false);
  hidePanels();
  document.getElementById("create").classList.remove("hidden");
  document.getElementById("back-button").classList.remove("hidden");
}

function backButton() {
  if (getReplyId())
    viewReplies(getReplyId());
  else
    showRecent();
}

function showReplies(addHistory = true) {
  if (addHistory)
    history.pushState(null, null, 'replies.html');
  hidePanels();
  document.getElementById("list-panel").classList.remove("hidden");
  document.getElementById("replies").classList.remove("hidden");
  document.getElementById("reply-button").classList.remove("hidden");
}

function showPopular(addHistory = true) {
  if (addHistory)
    history.pushState(null, null, 'popular.html');
  populatePopular();
  hidePanels();
  document.getElementById("list-panel").classList.remove("hidden");
  document.getElementById("popular").classList.remove("hidden");
  document.getElementById("doodle-button").classList.remove("hidden");
  document.getElementById("popular-button").classList.add("active");
}

function showRecent(addHistory = true) {
  if (addHistory)
    history.pushState(null, null, 'recent.html');
  populateRecent();
  hidePanels();
  document.getElementById("list-panel").classList.remove("hidden");
  document.getElementById("recent").classList.remove("hidden");
  document.getElementById("doodle-button").classList.remove("hidden");
  document.getElementById("recent-button").classList.add("active");
}

function reply(id) {
  startDrawing();
  setReplyId(id);
}

function postedDrawing() {
  if (getReplyId()) {
    showReplies();
    setTimeout(function(){
      viewReplies(getReplyId())
    },1000);
  } else {
    showRecent();
    setTimeout(function(){
      populateRecent();
    },1000);
  }
}


function generateSketchElement(sketch, showReplyLink = true) {
  let replies = '<a href="javascript:void(0);" class="download" title="download" onclick="downloadSketch(' + sketch.id + ')"><i class="fas fa-download"></i></a>';

  if (showReplyLink)
    if (sketch.replies) {
      replies += '<a href="javascript:void(0);" class="replies" onclick="viewReplies(' + sketch.id + ')">' + sketch.replies + (sketch.replies > 1 ? ' replies' : ' reply' ) +  '</a>';
    } else {
      replies += '<a href="javascript:void(0);" class="replies" onclick="reply(' + sketch.id + ')">doodle a reply</a>';
    }

  return '<div class="sketch frame" data-sketch-id="' + sketch.id + '"><span class="time" data-time="' + sketch.timestamp + '">' + msToTime(currTime - sketch.timestamp) + ' ago</span><img src="' + sketch.dataUrl + '" onclick="watchReplay(' + sketch.id + ')"/>' + replies + '</div>';
}


setInterval(function(){
  let times = document.getElementsByClassName("time");
  currTime = Date.now();
  for (var i = 0; i < times.length; i++) {
    let stamp = times[i].attributes.getNamedItem('data-time').value;
    times[i].innerHTML = msToTime(currTime - stamp) + ' ago';
  }
}, 5000);

function putSketchesInList(sketchList, element, showReplyLink = true) {
  for (var i = 0; i < sketchList.length; i++) {
    element.innerHTML = element.innerHTML + generateSketchElement(sketchList[i], showReplyLink);
  }
  element.innerHTML = element.innerHTML + '<div class="clear"></div>';
}

function populatePopular() {
  ajaxGet("popular", function(){
    let data = LZString.decompressFromBase64(this.responseText);
    if (data) {
      let response = JSON.parse(data);
      if (Array.isArray(response)) {
        popularPosts = response;
        let popularDiv = document.getElementById("popular");
        popularDiv.innerHTML = '';
        currTime = Date.now();
        putSketchesInList(popularPosts, popularDiv);
      }
    }
  });
}

function populateRecent() {
  ajaxGet("recent", function(){
    let data = LZString.decompressFromBase64(this.responseText);
    if (data) {
      let response = JSON.parse(data);
      if (Array.isArray(response)) {
        recentPosts = response;
        let recentDiv = document.getElementById("recent");
        recentDiv.innerHTML = '';
        currTime = Date.now();
        putSketchesInList(recentPosts, recentDiv);
      }
    }
  });
}

let replayFrameId = false;

function watchReplay(id) {
  document.getElementById("replay").classList.toggle("hidden");
  let canvas = document.getElementById("replay-canvas");
  let context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);

  let renderHistory = function(sketchHistory) {
    if (replayFrameId)
      cancelAnimationFrame(replayFrameId);

    let canvas = document.getElementById("replay-canvas");
    let context = canvas.getContext("2d");
    context.fillStyle = "#000";
    replayInProgress = true;
    let replayCounter = 0;
    context.clearRect(0, 0, canvas.width, canvas.height);
    let drawHistory = function() {
      if (replayCounter < sketchHistory.length) {
        context.beginPath();
        context.rect(sketchHistory[replayCounter].x, sketchHistory[replayCounter].y, 1, 1);
        context.fill();
      } else {
        replayInProgress = false;
      }
      replayCounter++;
    }
    let updateReplay = function() {
      drawHistory();
      drawHistory();
      replayFrameId = requestAnimationFrame(updateReplay);
    }
    updateReplay();
  }
  if (dataCache[id]) {
    renderHistory(JSON.parse(LZString.decompressFromBase64(dataCache[id])))
  } else {
    ajaxGet("data/" + id, function(){
      let response = JSON.parse(LZString.decompressFromBase64(this.responseText));
      if (Array.isArray(response)) {
        dataCache[id] = this.responseText;
        renderHistory(response);
      }
    })
  }
}

function hideReplay() {
  document.getElementById("replay").classList.toggle("hidden");
  if (replayFrameId)
    cancelAnimationFrame(replayFrameId);
}


function viewReplies(id) {
  setReplyId(id);
  showReplies();
  ajaxGet("replies/" + id, function(){
    let response = JSON.parse(LZString.decompressFromBase64(this.responseText));
    if (Array.isArray(response)) {
      replies = response;
      let repliesDiv = document.getElementById("replies");
      repliesDiv.innerHTML = '';
      currTime = Date.now();
      putSketchesInList(replies, repliesDiv, false);
    }
  });
}

function setStateManager() {
  window.addEventListener("popstate", function(e) {
    let path = location.pathname.substring(location.pathname.lastIndexOf('/') + 1, location.pathname.length);
    switch (path) {
      case 'create.html':
        let id = getReplyId();
        startDrawing(false);
        setReplyId(id);
        break;
      case 'replies.html':
        showReplies(false);
        break;
      case 'recent.html':
        showRecent(false);
        break;
      case 'popular.html':
        showPopular(false);
        break;
    }
  });
}