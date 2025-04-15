// ColoredPoint.js (c) 2012 matsuda
// Edited by Evan Brannon-Wu

// Vertex shader program
  var VSHADER_SOURCE = `
  attribute vec4 a_Position;
  uniform mat4 u_ModelMatrix;
  void main() {
    gl_Position = u_ModelMatrix * a_Position;   
  }`


// Fragment shader program
var FSHADER_SOURCE = `
  precision mediump float;
  uniform vec4 u_FragColor;
  void main() {
    gl_FragColor = u_FragColor;
  }`


// Global Variables
let canvas, gl, a_Position, u_FragColor, u_Size;
let g_selectedColor = [0.1, 0.1, 0.1, 1.0]; // default values
let g_selectedSize = 5;
var g_shapesList = []; // The array that holds lists of points
const POINT = 0;
const TRIANGLE = 1;
const CIRCLE = 2;
let g_selectedType = POINT;
let g_selectedSegments = 10;


function main() {
  setupWebGL(); 
  connectVariablesToGLSL();
  addActionsForHTMLUI();

  // Register function (event handler) to be called on a mouse press
  canvas.onmousedown = click;
  canvas.onmousemove = function(ev) { if(ev.buttons == 1) { click(ev) } };

  // Specify the color for clearing <canvas>
  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  // Clear <canvas>
  renderAllShapes();
}


// Set up canvas and gl variables
function setupWebGL(){
  // Retrieve <canvas> element
  canvas = document.getElementById('webgl');

  // Get the rendering context for WebGL
  gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }
}


// Set up GLSL shader programs and connect GLSL variables
function connectVariablesToGLSL(){
  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.');
    return;
  }

  // Get the storage location of a_Position
  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  if (a_Position < 0) {
    console.log('Failed to get the storage location of a_Position');
    return;
  }

  // Get the storage location of u_FragColor
  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  if (!u_FragColor) {
    console.log('Failed to get the storage location of u_FragColor');
    return;
  }

  // Get the storage location of u_ModelMatrix
  u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  if (!u_ModelMatrix) {
    console.log('Failed to get the storage location of u_ModelMatrix');
    return;
  }

  // Set an initial value for this matrix to identify
  var identityM = new Matrix4();
  gl.uniformMatrix4fv(u_ModelMatrix, false, identityM.elements);
}


// Fix to dynamically update slider input with button clicks
function updateSliders() {
  document.getElementById('redSlider').value = g_selectedColor[0] * 100;
  document.getElementById('greenSlider').value = g_selectedColor[1] * 100;
  document.getElementById('blueSlider').value = g_selectedColor[2] * 100;
  document.getElementById('alphaSlider').value = g_selectedColor[3] * 100;
}


// Set up actions for HTML UI Elements
function addActionsForHTMLUI() {
  // Button elements, have to dynamically update sliders with new button clicks
  document.getElementById('red').onclick =   function() { g_selectedColor = [1.0, 0.0, 0.0, 1.0]; updateSliders(); };
  document.getElementById('green').onclick = function() { g_selectedColor = [0.0, 1.0, 0.0, 1.0]; updateSliders(); };
  document.getElementById('blue').onclick =  function() { g_selectedColor = [0.0, 0.0, 1.0, 1.0]; updateSliders(); };
  
  document.getElementById('clearCanvas').onclick = function() { g_shapesList=[]; renderAllShapes(); };

  document.getElementById('point').onclick    = function() { g_selectedType = POINT };
  document.getElementById('triangle').onclick = function() { g_selectedType = TRIANGLE };
  document.getElementById('circle').onclick   = function() { g_selectedType = CIRCLE };

  // Slider elements, have to rerender shapes with new dynamic fixes
  document.getElementById('redSlider').addEventListener('mouseup',   function() { g_selectedColor[0] = this.value/100; renderAllShapes(); });
  document.getElementById('greenSlider').addEventListener('mouseup', function() { g_selectedColor[1] = this.value/100; renderAllShapes(); });
  document.getElementById('blueSlider').addEventListener('mouseup',  function() { g_selectedColor[2] = this.value/100; renderAllShapes(); });

  document.getElementById('alphaSlider').addEventListener('mouseup', function() { g_selectedColor[3] = this.value/100; renderAllShapes(); });

  document.getElementById('sizeSlider').addEventListener('mouseup',  function() { g_selectedSize = this.value;});

  document.getElementById('segmentsSlider').addEventListener('mouseup', function() { g_selectedSegments = this.value;});

  // See/hide the performance
  document.getElementById('showNumDot').onclick = function() {
    const numDotElement = document.getElementById('numdot');
    if (numDotElement.style.display === 'none') { //if hidden
      numDotElement.style.display = 'block'; // Show the element
    } else { //if seen
      numDotElement.style.display = 'none'; // Hide the element
    } 
  };

  // Dropdown menu for changing canvas color
  document.getElementById('canvasColorDropdown').addEventListener('change', function() {
    const color = this.value; 
    const rgb = hexToRgb(color); // Convert hex to RGB
    gl.clearColor(rgb.r / 255, rgb.g / 255, rgb.b / 255, 1.0); // Update WebGL clear color
    gl.clear(gl.COLOR_BUFFER_BIT); // Clear the canvas with the new color
    renderAllShapes(); //Re-render all of the old shapes
  });
}


// Helper function for converting the hex codes into rgb values
function hexToRgb(hex) {
  const bigint = parseInt(hex.slice(1), 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  };
}


// Register mouse presses & assigns as a 'point' unless chosen otherwise
function click(ev) {
  let [x, y] = convertCoordinatesEventToGL(ev);

  // Create/store new point w/ coordinates, color and size
  let shape;
  if (g_selectedType == POINT) {
    shape = new Point();
  } else if (g_selectedType == TRIANGLE) {
    shape = new Triangle();
  } else {
    shape = new Circle();
    shape.segments = g_selectedSegments;
  }
  shape.position = [x, y];
  shape.color = g_selectedColor.slice();
  shape.size = g_selectedSize;
  g_shapesList.push(shape);

  renderAllShapes();
}


// Extract event click and return in WebGL coordinates
function convertCoordinatesEventToGL(ev) {
  var x = ev.clientX; // x coordinate of a mouse pointer
  var y = ev.clientY; // y coordinate of a mouse pointer
  var rect = ev.target.getBoundingClientRect();

  x = ((x - rect.left) - canvas.width/2) / (canvas.width/2);
  y = (canvas.height/2 - (y - rect.top)) / (canvas.height/2);

  return([x, y]);
}


// Draw every shape that is supposed to be in canvas
function renderAllShapes() {
  var startTime = performance.now();

  gl.clear(gl.COLOR_BUFFER_BIT); 

  // Test triangle
  drawTriangle3D( [-1.0,0.0,0.0,   -0.5,-1.0,0.0,    0.0,0.0,0.0] );

  // Draw the body cube
  var body = new Cube();
  body.color = [1.0, 0.0, 0.0, 1.0];
  body.matrix.translate(-0.25, -0.5, 0.0);
  body.matrix.scale(0.5, 1.0, 0.5);
  body.render();

  // Draw the left arm
  var leftArm = new Cube();
  leftArm.color = [1.0, 1.0, 0.0, 1.0];
  leftArm.matrix.setTranslate(0.7, 0.0, 0.0);
  leftArm.matrix.rotate(45, 0, 0, 1);
  leftArm.matrix.scale(0.25, 0.7, 0.5);
  leftArm.render();

  var duration = performance.now() - startTime;
  sendTextToHTML("ms: " + Math.floor(duration) + " fps: " + Math.floor(10000/duration)/10, "numdot");
}


// Set the text of a HTML element
function sendTextToHTML(text, htmlID) {
  var htmlElm = document.getElementById(htmlID);
  if (!htmlElm) {
    console.log("Failed to get " + htmlID + " from HTML");
    return;
  }
  htmlElm.innerHTML = text;
}
