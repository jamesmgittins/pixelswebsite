const apiUrl = "https://pixelapi.gti.nz/";
//const apiUrl = "http://192.168.1.5:8888/";
let guid;
let currTime = Date.now();
let recentPosts = [];
let popularPosts = [];
let replyId = false;

function msToTime(duration) {
  var seconds = Math.floor((duration / 1000) % 60),
    minutes = Math.floor((duration / (1000 * 60)) % 60),
    hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

  hours = (hours < 10) ? "0" + hours : hours;
  minutes = (minutes < 10) ? "0" + minutes : minutes;
  seconds = (seconds < 10) ? "0" + seconds : seconds;

  return (hours > 0 ? hours + "h " : '') + minutes + "m " + seconds + "s";
}

function normalizeVector(vector) {
  if (vector.x == 0 && vector.y == 0) {
    return vector;
  }
  var magnitude = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
  vector.x /= magnitude;
  vector.y /= magnitude;
  console.log(vector);
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
    context.fillStyle = "#CCC";
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
      console.log(steps);
      vector = normalizeVector(vector);
      let x = lastPosition.x;
      let y = lastPosition.y;
      for (var i = 0; i < steps - 1; i++) {
        x += vector.x;
        y += vector.y;
        console.log('filling ' + x + ' - ' + y);
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
  canvas.addEventListener("touchstart", function(){
    mouseOver = true;
    mouseDown = true;
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
      parent:replyId,
      data:LZString.compressToBase64(JSON.stringify(sketchHistory))
    });
  });
}

function startDrawing() {
  replyId = false;
  document.getElementById("list").classList.toggle("hidden");
  document.getElementById("create").classList.toggle("hidden");
  document.getElementById("doodle-button").classList.toggle("hidden");
  document.getElementById("back-button").classList.toggle("hidden");
}

function reply(id) {
  startDrawing();
  replyId = id;
}

function postedDrawing() {
  startDrawing();
  setTimeout(function(){
    populateRecent();
    populatePopular();
  },1000);
}


function generateSketchElement(sketch) {
  let replies = "";

  if (sketch.replies) {
    replies = '<a href="javascript:void(0);" class="replies" onclick="reply(' + sketch.id + ')">' + sketch.replies + (sketch.replies > 1 ? ' replies' : ' reply' ) +  '</a>';
  } else {
    replies = '<a href="javascript:void(0);" class="replies" onclick="reply(' + sketch.id + ')">doodle a reply</a>';
  }
  let replayButton = '<a href="javascript:void(0)" class="replay" onclick="watchReplay(' + sketch.id + ')"><i class="far fa-play-circle"></i></a>';

  return '<div class="sketch frame"><span class="time" data-time="' + sketch.timestamp + '">' + msToTime(currTime - sketch.timestamp) + ' ago</span><img src="' + sketch.dataUrl + '" onclick="watchReplay(' + sketch.id + ')"/>' + replayButton + replies + '</div>';
}


setInterval(function(){
  let times = document.getElementsByClassName("time");
  currTime = Date.now();
  for (var i = 0; i < times.length; i++) {
    let stamp = times[i].attributes.getNamedItem('data-time').value;
    times[i].innerHTML = msToTime(currTime - stamp) + ' ago';
  }
}, 1000);

function putSketchesInList(sketchList, element) {
  for (var i = 0; i < sketchList.length; i++) {
    (function(){
      let div = element;
      let sketch = sketchList[i];
      setTimeout(function(){
        div.innerHTML = div.innerHTML + generateSketchElement(sketch);
      });
    })();
  }
}

function populatePopular() {
  ajaxGet("popular", function(){
    let response = JSON.parse(LZString.decompressFromBase64(this.responseText));
    if (Array.isArray(response)) {
      popularPosts = response;
      let popularDiv = document.getElementById("popular");
      popularDiv.innerHTML = '';
      currTime = Date.now();
      putSketchesInList(popularPosts, popularDiv);
    }
  });
}

function populateRecent() {
  ajaxGet("recent", function(){
    let response = JSON.parse(LZString.decompressFromBase64(this.responseText));
    if (Array.isArray(response)) {
      recentPosts = response;
      let recentDiv = document.getElementById("recent");
      recentDiv.innerHTML = '';
      currTime = Date.now();
      putSketchesInList(recentPosts, recentDiv);
    }
  });
}

let replayFrameId = false;

function watchReplay(id) {
  ajaxGet("data/" + id, function(){
    let response = JSON.parse(LZString.decompressFromBase64(this.responseText));
    if (Array.isArray(response)) {
      document.getElementById("replay").classList.toggle("hidden");
      
      (function() {
        let sketchHistory = response;

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
      })();
    }
  })
}

function hideReplay() {
  document.getElementById("replay").classList.toggle("hidden");
  if (replayFrameId)
    cancelAnimationFrame(replayFrameId);
}


function viewReplies() {

}