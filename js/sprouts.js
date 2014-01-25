var data = (function () {
  'use strict';

  var lastRegion = 0,
      spots = [],
      vertices = [],
      lines = [],
      edges = [];

  function addVertex(x, y) {
    vertices.push({
      x: x,
      y: y
    });
    return vertices[vertices.length - 1];
  }

  function length(point, squared) {
    var a, b, sq;
    a = point.x * point.x;
    b = point.y * point.y;
    sq = a + b;
    if (squared) {
      return sq;
    }
    return Math.sqrt(sq);
  }

  function add(v1, v2) {
    return {
      x: v1.x + v2.x,
      y: v1.y + v2.y
    };
  }

  function subtract(v1, v2) {
    return {
      x: v1.x - v2.x,
      y: v1.y - v2.y
    };
  }

  function distance(v1, v2, squared) {
    return length(subtract(v1, v2), squared);
  }

  function multiply(v, s) {
    return {
      x: v.x * s,
      y: v.y * s
    };
  }

  function cross(v1, v2) {
    return v1.x * v2.y - v1.y * v2.x;
  }

  function addSpot(vertex, region, boundary) {
    // Add a one point line so that nothing can go through this point.
    lines.push([vertex, vertex]);
    spots.push({
      id: spots.length,
      vertex: vertex,
      region: region,
      boundary: boundary,
      neighbours: []
    });
    return spots.length - 1;
  }

  function getFirstSegment(spot, line) {
    var last;
    if (spot.vertex === line[0]) {
      return [line[0], line[1]];
    }
    last = line.length - 1;
    return [line[last], line[last - 1]];
  }

  function getAngle(segment) {
    var vector, angle;
    vector = subtract(segment[1], segment[0]);
    angle = Math.atan2(vector.x, vector.y);
    if (angle < 0) {
      return angle + 2 * Math.PI;
    }
    return angle;
  }

  function getSucc(spot, line) {
    var lineAngle, difference, next, nextCandidate, min, minCandidate, i;
    next = Number.MAX_VALUE;
    min = Number.MAX_VALUE;
    nextCandidate = null;
    minCandidate = null;
    if (spot.neighbours.length === 0) {
      return null;
    }
    lineAngle = getAngle(getFirstSegment(spot, line));
    i = spot.neighbours.length;
    while (i--) {
      difference = getAngle(getFirstSegment(spot, spot.neighbours[i].line)) - lineAngle;
      if (0 < difference && (difference < next)) {
        next = difference;
        nextCandidate = spot.neighbours[i];
      } else if (difference < min) {
        min = difference;
        minCandidate = spot.neighbours[i];
      }
    }
    if (nextCandidate !== null) {
      return nextCandidate;
    }
    return minCandidate;
  }

  function dead(spot) {
    return spot.neighbours.length > 2;
  }

  function createEdge(toSpot, line, reversed, region, boundary, pred, succ) {
    edges.push({
      toSpot: toSpot,
      line: line,
      reversed: reversed,
      region: region,
      boundary: boundary,
      pred: pred,
      succ: succ
    });
    return edges[edges.length - 1];
  }

  function getRegion(spot, edge) {
    if (edge) {
      return edge.region;
    }
    return spot.region;
  }

  function getBoundary(spot, edge) {
    if (edge) {
      return edge.boundary;
    }
    return spot.boundary;
  }

  function traverse(edge, lambda) {
    var current = edge;
    do {
      current = lambda.call(null, current);
    } while (current && edge !== current);
  }

  function setRegion(edge, region) {
    traverse(edge, function(e) {
      e.region = region;
      return e.succ;
    });
  }

  function setBoundary(edge, boundary) {
    traverse(edge, function(e) {
      e.boundary = boundary;
      return e.succ;
    });
  }

  function clockwise(edge) {
    var sum = 0;
    traverse(edge, function (e) {
      var pairs;
      pairs = d3.pairs(e.line);
      pairs.forEach(function (p) {
        if (e.reversed) {
          sum += (p[0].x - p[1].x) * (p[0].y + p[1].y);
        } else {
          sum += (p[1].x - p[0].x) * (p[0].y + p[1].y);
        }
      });
      return e.succ;
    });
    return sum >= 0;
  }

  function markRegion(region) {
    var i;
    i = edges.length;
    while (i--) {
      if (edges[i].region === region) {
        edges[i].line.selected = true;
      }
    }
  }

  function markBoundary(edge) {
    traverse(edge, function (e) {
      e.line.selected = true;
      return e.succ;
    });
  }

  function unmarkAll() {
    var i;
    i = lines.length;
    while (i--) {
      lines[i].selected = false;
    }
  }

  function straddle(p1, p2, q1, q2, allowStart, allowEnd) {
    var v, sgn1, sgn2, sgn3;
    v = subtract(p1, p2);
    sgn1 = cross(subtract(q1, p1), v);
    // Allow line segments to touch so that polylines and line clusters at sptots
    // are allowed.
    if (allowStart && sgn1 === 0) {
      return false;
    }
    sgn2 = cross(subtract(q2, p1), v);
    if (allowEnd && sgn2 === 0) {
      return false;
    }
    sgn3 = sgn1 * sgn2;
    if (sgn3 <= 0) {
      return true;
    }
    return false;
  }

  function segmentsTouch(p1, p2, q1, q2, allowStart, allowEnd) {
    if (straddle(p1, p2, q1, q2, allowStart, allowEnd) && straddle(q1, q2, p1, p2)) {
      return true;
    }
    return false;
  }

  function touch(line1, line2, allowStart, allowEnd) {
    var l1, l2, i, j;
    l1 = d3.pairs(line1);
    l2 = d3.pairs(line2);
    i = l1.length;
    while (i--) {
      j = l2.length;
      while (j--) {
        if (segmentsTouch(l1[i][0], l1[i][1], l2[j][0], l2[j][1], allowStart, allowEnd)) {
          return true;
        }
      }
    }
    return false;
  }

  function touchesAnything(line, allowStart, allowEnd) {
    var i = lines.length;
    while (i--) {
      if (touch(lines[i], line, allowStart, allowEnd)) {
        return true;
      }
    }
    return false;
  }

  function countRayTouches(line, ray) {
    var l, y, count = 0;
    y = ray[0].y;
    l = d3.pairs(line);
    l.forEach(function (s) {
      if (straddle(ray[0], ray[1], s[0], s[1], true) &&
        straddle(s[0], s[1], ray[0], ray[1], true)) {
        if (s[0].y === y && s[0].y >= s[1].y) {
          return;
        }
        if (s[1].y === y && s[1].y > s[0].y) {
          return;
        }
        count++;
      }
    });
    return count;
  }

  function inside(region, point) {
    var i, ray, count;
    ray = [point, {x: point.x, y: Number.MAX_VALUE}];
    count = 0;
    i = edges.length;
    while (i--) {
      if (edges[i].region === region) {
        count += countRayTouches(edges[i].line, ray);
      }
    }
    return count % 2 === 1;
  }

  function setNeighbours(edge1, edge2, succ) {
    if (succ) {
      edge1.succ = succ;
      succ.pred.succ = edge2;
      edge2.pred = succ.pred;
      succ.pred = edge1;
    } else {
      edge1.succ = edge2;
      edge2.pred = edge1;
    }
  }

  function addSubEdge(startSpot, endSpot, line) {
    var succ1, succ2, region, boundary1, boundary2, edge1, edge2, newRegion, i, j;
    succ1 = getSucc(startSpot, line);
    succ2 = getSucc(endSpot, line);
    region = getRegion(startSpot, succ1);
    boundary1 = getBoundary(startSpot, succ1);
    boundary2 = getBoundary(endSpot, succ2);
    // We no longer need to store region and boundary information in the spots.
    startSpot.region = null;
    endSpot.region = null;
    startSpot.boundary = null;
    endSpot.boundary = null;
    if (boundary1 !== boundary2) {
      if (succ2) {
        setBoundary(succ2, boundary1);
      }
    }
    edge1 = createEdge(endSpot, line, false, region, boundary1);
    edge2 = createEdge(startSpot, line, true, region, boundary1);
    setNeighbours(edge1, edge2, succ2);
    setNeighbours(edge2, edge1, succ1);
    if (boundary1 === boundary2) {
      lastRegion += 1;
      if (clockwise(edge1)) {
        newRegion = edge2;
      } else {
        newRegion = edge1;
      }
      setRegion(newRegion, lastRegion);
      i = spots.length;
      while (i--) {
        if (inside(lastRegion, spots[i].vertex)) {
          j = spots[i].neighbours.length;
          if (j === 0) {
            spots[i].region = lastRegion;
          } else {
            while (j--) {
              if (spots[i].neighbours[j].boundary !== boundary1 &&
                  spots[i].neighbours[j].region === region) {
                setRegion(spots[i].neighbours[j], lastRegion);
              }
            }
          }
        }
      }
    }
    startSpot.neighbours.push(edge1);
    endSpot.neighbours.push(edge2);
  }

  function obeysExpectation(spot, line) {
    var succ;
    succ = getSucc(spot, line);
    if (!succ) {
      return true;
    }
    return succ.pred.pred.toSpot.id <= succ.toSpot.id;
  }

  function addEdge(startSpot, endSpot, line) {
    var line2, newSpot, i, obeysExpectation1, obeysExpectation2;
    obeysExpectation1 = obeysExpectation(startSpot, line);
    obeysExpectation2 = obeysExpectation(endSpot, line);
    i = line.length - 1;
    while (--i) {
      vertices.push(line[i]);
    }
    line2 = line.splice(line.length / 2, Number.MAX_VALUE);
    line.push(line2[0]);
    lines.push(line2);
    newSpot = spots[addSpot(line2[0], null, null)];
    addSubEdge(startSpot, newSpot, line);
    addSubEdge(newSpot, endSpot, line2);
  }

  function createBorder(width, height) {
    var line, p1, p2, p3, p4;
    p1 = addVertex(0, 0);
    p2 = addVertex(width, 0);
    p3 = addVertex(width, height);
    p4 = addVertex(0, height);
    line = [p1, p2, p3, p4, p1];
    lines.push(line);
    createEdge(null, line, false, 0);
  }

  return {
    lastRegion: lastRegion,
    vertices: vertices,
    addVertex: addVertex,
    spots: spots,
    addSpot: addSpot,
    dead: dead,
    lines: lines,
    createBorder: createBorder,
    touchesAnything: touchesAnything,
    distance: distance,
    add: add,
    subtract: subtract,
    multiply: multiply,
    addEdge: addEdge,
    markRegion: markRegion,
    markBoundary: markBoundary,
    unmarkAll: unmarkAll,
    inside: inside,
    edges: edges,
    clockwise: clockwise
  };
}());

var facade = (function () {
  'use strict';

  var settings = {
    width: 700,
    height: 700,
    numberOfSpots: 4
  };

  function init() {
    var i, vertex;
    data.createBorder(settings.width, settings.height);
    i = settings.numberOfSpots;
    while (i--) {
      vertex = data.addVertex(
        settings.width / 2 * (1 + Math.sin(i * 2 * Math.PI / settings.numberOfSpots) / 2),
        settings.height / 2 * (1 + Math.cos(i * 2 * Math.PI / settings.numberOfSpots) / 2)
        );
      data.addSpot(vertex, data.lastRegion, i);
    }
  }

  var newLine = null;
  var startSpot = null;

  function startLine(spot) {
    if (!data.dead(spot)) {
      // Set up new line invariant: fixed line points followed by current
      // cursor position.
      newLine = [spot.vertex, spot.vertex];
      data.lines.push(newLine);
      startSpot = spot;
      // Add a placeholder to track count of lives this spot still has.
      spot.neighbours.push(null);
    }
  }

  function drawLine(cursor) {
    var lastCursor, newSegment, lastVertex, distance;
    if (newLine) {
      lastCursor = newLine.pop();
      lastVertex = newLine[newLine.length - 1];
      newSegment = [lastVertex, cursor];
      if (!data.touchesAnything(newSegment, true)) {
        distance = data.distance(lastVertex, cursor, true);
        if (distance > 400) {
          newLine.push(data.add(lastVertex,
                data.multiply(data.subtract(cursor, lastVertex), 0.7)));
        }
      } else {
        cursor = lastCursor;
      }
      newLine.push(cursor);
    }
  }

  function destroyLine() {
    if (newLine) {
      // Remove the placeholder.
      startSpot.neighbours.pop();
      data.lines.pop();
      newLine = null;
      startSpot = null;
    }
  }

  function endLine(spot) {
    var lastVertex, newSegment;
    if (newLine && (newLine.length > 2)) {
      // Remove the cursor position.
      newLine.pop();
      lastVertex = newLine[newLine.length - 1];
      newSegment = [lastVertex, spot.vertex];
      if (!data.dead(spot) && !data.touchesAnything(newSegment, true, true)) {
        // Remove the placeholder.
        startSpot.neighbours.pop();
        newLine.push(spot.vertex);
        data.addEdge(startSpot, spot, newLine);
        newLine = null;
        startSpot = null;
      } else {
        destroyLine();
      }
    }
  }

  return {
    init: init,
    settings: settings,
    startLine: startLine,
    drawLine: drawLine,
    destroyLine: destroyLine,
    endLine: endLine
  };
}());

var graphics = (function () {
  'use strict';

  var windowWidth, windowHeight;

  function scaleX(x) {
    return windowWidth / facade.settings.width * x;
  }

  function scaleXBack(x) {
    return facade.settings.width / windowWidth * x;
  }

  function scaleY(y) {
    return windowHeight / facade.settings.height * y;
  }

  function scaleYBack(y) {
    return facade.settings.height / windowHeight * y;
  }

  facade.init();

  var svgTriangles = d3.select('body').append('svg').attr('tabindex', 1);

  var svgCentroids = d3.select('body').append('svg').attr('tabindex', 1);

  var svgLines = d3.select('body').append('svg').attr('tabindex', 1);

  var svgSpots = d3.select('body').append('svg').attr('tabindex', 1);

  d3.select(window).on('mousemove', mousemove).on('mouseup', mouseup);

  var lineGenerator = d3.svg.line().
    x(function (d) { return scaleX(d.x); }).
    y(function (d) { return scaleY(d.y); }).
    interpolate('basis');

  var triangleGenerator = d3.svg.line().
    x(function (d) { return scaleX(d.x); }).
    y(function (d) { return scaleY(d.y); }).
    interpolate('linear');

  function redrawLines(animate) {
    var line = svgLines.selectAll('path').data(data.lines.slice(1));
    line.enter().append('path').attr('class', 'line');
    line.exit().remove();
    if (animate) {
      line.transition().duration(750).attr('d', lineGenerator);
    } else {
      line.attr('d', lineGenerator);
    }
    line.classed('selected', function (d) { return d.selected; });
  }

  function drawTriangles() {
    var line, triangles;
    triangles = visualization.triangulate(data.vertices);
    line = svgTriangles.selectAll('path').data(triangles);
    line.enter().append('path').attr('class', 'triangle');
    line.exit().remove();
    line.attr('d', triangleGenerator);
  }

  function redrawSpots() {
    var circle = svgSpots.selectAll('circle').data(data.spots);
    circle.enter().
      append('circle').
      on('mousedown', mousedown).
      on('mouseup', mouseup).
      attr('r', 1e-6).
      transition().
      duration(750).
      ease('elastic').
      attr('r', 10);
    circle.
      attr('cx', function(d) { return scaleX(d.vertex.x); }).
      attr('cy', function(d) { return scaleY(d.vertex.y); });
    circle.classed('dead', function (d) { return data.dead(d); });
    var text = svgSpots.selectAll('text').data(data.spots);
    text.enter().append('text').
      text(function(d) { return '' + d.id; });
    text.
      attr('x', function(d) { return scaleX(d.vertex.x) + 20; }).
      attr('y', function(d) { return scaleY(d.vertex.y) + 6; });
  }

  function moveSpots() {
    var circle = svgSpots.selectAll('circle').data(data.spots);
    circle.transition().duration(750).
      attr('cx', function(d) { return scaleX(d.vertex.x); }).
      attr('cy', function(d) { return scaleY(d.vertex.y); });
  }

  function mousedown(spot) {
    facade.startLine(spot);
    redrawSpots();
  }

  function mousemove() {
    var position = d3.mouse(svgLines.node());
    facade.drawLine({x: scaleXBack(position[0]), y: scaleYBack(position[1])});
    redrawLines();
  }

  function mouseup(spot) {
    if (spot) {
      facade.endLine(spot);
    } else {
      facade.destroyLine();
    }
    redrawLines();
    redrawSpots();
  }

  function updateWindow () {
    windowWidth = window.innerWidth || window.documentElement.clientWidth || document.getElementsByTagName('body')[0].clientWidth;
    windowHeight = window.innerHeight || window.documentElement.clientHeight || document.getElementsByTagName('body')[0].clientHeight;
    redrawLines();
    redrawSpots();
  }

  window.onresize = updateWindow;

  updateWindow();

  return {
    redrawLines: redrawLines,
    drawTriangles: drawTriangles
  };
}());

var visualization = (function () {
  function triangulate(points) {
    var input, output, triangles, i;
    i = points.length;
    input = [];
    while (i--) {
      input[i] = [points[i].x, points[i].y];
    }
    output = Delaunay.triangulate(input);
    triangles = [];
    for (i = output.length - 3; i >= 0; i -= 3) {
      triangles.push([points[output[i]], points[output[i + 1]], points[output[i + 2]]]);
    }
    return triangles;
  }

  function getGraph(points, lines) {
    var triangles;
    triangles = triangulate(points);
  }

  return {
    triangulate: triangulate
  };
}());

