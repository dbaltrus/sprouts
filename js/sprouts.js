var data = (function () {
  'use strict';

  var lastRegion = 0,
      spots = [],
      vertices = [],
      lines = [],
      edges = [];

  function addVertex(point) {
    point.id = vertices.length;
    vertices.push(point);
    return point;
  }

  function point(x, y) {
    return {
      x: x,
      y: y
    };
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
    var spot;
    // Add a one point line so that nothing can go through this point.
    lines.push([vertex, vertex]);
    spot = {
      id: spots.length + 1,
      vertex: vertex,
      region: region,
      boundary: boundary,
      neighbours: []
    };
    spots.push(spot);
    return spot;
  }

  function getFirstSegment(spot, line) {
    var last;
    if (!line) {
      return null;
    }
    if (spot.vertex === line[0]) {
      return [line[0], line[1]];
    }
    last = line.length - 1;
    return [line[last], line[last - 1]];
  }

  function getFirstEdgeSegment(edge) {
    if (edge.reversed) {
      return [edge.line[edge.line.length - 1], edge.line[edge.line.length - 2]];
    } else {
      return [edge.line[0], edge.line[1]];
    }
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

  // TODO use this for getSucc
  function getPointSucc(point, neighbours, segment) {
    var lineAngle, difference, next, nextCandidate, min, minCandidate, i;
    next = Number.MAX_VALUE;
    min = Number.MAX_VALUE;
    nextCandidate = null;
    minCandidate = null;
    if (neighbours.length === 0) {
      return null;
    }
    lineAngle = getAngle(segment);
    i = neighbours.length;
    while (i--) {
      difference = getAngle([point, neighbours[i]]) - lineAngle;
      if (0 < difference && (difference < next)) {
        next = difference;
        nextCandidate = neighbours[i];
      } else if (difference < min) {
        min = difference;
        minCandidate = neighbours[i];
      }
    }
    if (nextCandidate !== null) {
      return nextCandidate;
    }
    return minCandidate;
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

  function getRegionSpots(region) {
    return spots.filter(function (spot) {
      return spotInRegion(spot, region);
    });
  }

  function getBoundarySpots(boundary) {
    return spots.filter(function (spot) {
      return spotInBoundary(spot, boundary);
    });
  }

  function getAllBoundarySpots(spot) {
    var i, boundary, spots;
    if (spot.boundary) {
      return getBoundarySpots(spot.boundary);
    }
    i = spot.neighbours.length;
    boundary = null;
    spots = [];
    while (i--) {
      if (boundary !== spot.neighbours[i].boundary) {
        boundary = spot.neighbours[i].boundary;
        spots.push.apply(spots, getBoundarySpots(boundary));
      }
    }
    return spots;
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

  function getBoundaryEdges(edge) {
    var boundary, line;
    boundary = [];
    traverse(edge, function(e) {
      boundary.push(e);
      return e.succ;
    });
    return boundary;
  }

  function getBoundaryAsArray(spot, edge) {
    var boundary, line;
    if (!edge) {
      return [spot.vertex];
    }
    boundary = [];
    traverse(edge, function(e) {
      line = e.line.slice(0);
      if (e.reversed) {
        line.reverse();
      }
      line.pop();
      boundary.push.apply(boundary, line);
      return e.succ;
    });
    return boundary;
  }

  function lineClockwise(line, reversed, fin) {
    var sum = 0;
    d3.pairs(line).forEach(function (p) {
      if (reversed) {
        sum += (p[0].x - p[1].x) * (p[0].y + p[1].y);
      } else {
        sum += (p[1].x - p[0].x) * (p[0].y + p[1].y);
      }
    });
    if (fin) {
      return sum > 0;
    }
    return sum;
  }

  function clockwise(edge) {
    var sum = 0;
    traverse(edge, function (e) {
      sum += lineClockwise(e.line, e.reversed);
      return e.succ;
    });
    return sum > 0;
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
      if (straddle(ray[0], ray[1], s[0], s[1]) &&
        straddle(s[0], s[1], ray[0], ray[1], true, true)) {
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
    var i, ray1, ray2, count1, count2;
    // Cast rays to both sides to eliminate border points.
    ray1 = [point, {x: Number.MAX_VALUE, y: point.y}];
    ray2 = [point, {x: Number.MIN_VALUE, y: point.y}];
    count1 = 0;
    count2 = 0;
    i = edges.length;
    while (i--) {
      if (edges[i].region === region) {
        count1 += countRayTouches(edges[i].line, ray1);
        count2 += countRayTouches(edges[i].line, ray2);
      }
    }
    return (count1 % 2 === 1) && (count2 % 2 === 1);
  }

  function spotIn(spot, value, getter) {
    var i;
    if (getter(spot) === value) {
      return true;
    }
    i = spot.neighbours.length;
    while (i--) {
      if (getter(spot.neighbours[i]) === value) {
        return true;
      }
    }
    return false;
  }

  function spotInRegion(spot, region) {
    return spotIn(spot, region, function (v) { return v.region; });
  }

  function spotInBoundary(spot, boundary) {
    return spotIn(spot, boundary, function (v) { return v.boundary; });
  }

  function holdsExpectation(edge) {
    if (!edge) {
      return true;
    }
    return edge.pred.pred.toSpot.id <= edge.toSpot.id;
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

  function connect(startSpot, endSpot, line, region, boundary) {
    var edge1, edge2, succ1, succ2;
    edge1 = createEdge(endSpot, line, false, region, boundary);
    edge2 = createEdge(startSpot, line, true, region, boundary);
    succ1 = getSucc(startSpot, line);
    succ2 = getSucc(endSpot, line);
    setNeighbours(edge1, edge2, succ2);
    setNeighbours(edge2, edge1, succ1);
    startSpot.neighbours.push(edge1);
    endSpot.neighbours.push(edge2);
  }

  function switchRegion(spot, oldRegion, newRegion) {
    var i = spot.neighbours.length;
    if (i === 0) {
      if (spot.region === oldRegion) {
        spot.region = newRegion;
      }
    } else {
      while (i--) {
        if (spot.neighbours[i].region === oldRegion) {
          spot.neighbours[i].region = newRegion;
        }
      }
    }
  }

  function addEdge(startSpot, endSpot, line) {
    var line2,
        startSpotSucc, endSpotSucc,
        holdsExpectation1, holdsExpectation2,
        at, atSpots,
        spotListClockwise, spotList,
        newSpot, region, boundary, boundary2,
        newRegionEdge,
        regionSpots, newRegionSpots,
        i;
    i = line.length - 1;
    while (--i) {
      addVertex(line[i]);
    }
    line2 = line.splice(line.length / 2, Number.MAX_VALUE);
    line.push(line2[0]);
    lines.push(line2);
    newSpot = addSpot(line2[0], null, null);
    startSpotSucc = getSucc(startSpot, line);
    endSpotSucc = getSucc(endSpot, line2);
    holdsExpectation1 = holdsExpectation(startSpotSucc) ? '' : '!';
    holdsExpectation2 = holdsExpectation(endSpotSucc) ? '' : '!';
    region = getRegion(startSpot, startSpotSucc);
    boundary = getBoundary(startSpot, startSpotSucc);
    boundary2 = getBoundary(endSpot, endSpotSucc);
    if (boundary !== boundary2 && endSpotSucc) {
      setBoundary(endSpotSucc, boundary);
    }
    connect(startSpot, newSpot, line, region, boundary);
    connect(newSpot, endSpot, line2, region, boundary);
    if (boundary === boundary2) {
      lastRegion += 1;
      if (clockwise(newSpot.neighbours[0])) {
        newRegionEdge = newSpot.neighbours[1];
        spotListClockwise = '';
      } else {
        newRegionEdge = newSpot.neighbours[0];
        spotListClockwise = '!';
      }
      setRegion(newRegionEdge, lastRegion);
      regionSpots = spots.
        filter(function (spot) { return spotInRegion(spot, region); });
      regionSpots = regionSpots.
        filter(function (spot) { return !spotInBoundary(spot, boundary); });
      atSpots = regionSpots.filter(function (spot) { return !dead(spot); });
      at = (atSpots.length > 0) ? '@' + atSpots[0].id : '';
      newRegionSpots = regionSpots.
        filter(function (spot) { return inside(lastRegion, spot.vertex); });
      spotList = newRegionSpots.
        filter(function (spot) { return !dead(spot); }).
        map(function (spot) { return spot.id; }).join(',');
      i = newRegionSpots.length;
      while (i--) {
        switchRegion(newRegionSpots[i], region, lastRegion);
      }
    }
    // We no longer need to store region and boundary information in the spots.
    startSpot.region = null;
    endSpot.region = null;
    startSpot.boundary = null;
    endSpot.boundary = null;
    if (boundary === boundary2) {
      return startSpot.id + holdsExpectation1 +
        '(' + newSpot.id + at + ')' +
        holdsExpectation2 + endSpot.id +
        ((spotList === '') ? '' : spotListClockwise + '[' + spotList + ']');
    }
    return startSpot.id + holdsExpectation1 +
      '(' + newSpot.id + ')' +
      holdsExpectation2 + endSpot.id;
  }

  function getRegionVertices(region) {
    var i, j, regionVertices, taken;
    regionVertices = [];
    taken = [];
    i = spots.length;
    while (i--) {
      if (spotInRegion(spots[i], region)) {
        regionVertices.push(spots[i].vertex);
        taken[spots[i].vertex.id] = true;
      }
    }
    i = edges.length;
    while (i--) {
      if (edges[i].region === region) {
        j = edges[i].line.length;
        while (j--) {
          if (!taken[edges[i].line[j].id]) {
            regionVertices.push(edges[i].line[j]);
            taken[edges[i].line[j].id] = true;
          }
        }
      }
    }
    i = regionVertices.length;
    while (i--) {
      regionVertices[i].id = i;
    }
    return regionVertices;
  }

  function createFrame(width, height) {
    var line, p1, p2, p3, p4;
    p1 = addVertex(point(0, 0));
    p2 = addVertex(point(width, 0));
    p3 = addVertex(point(width, height));
    p4 = addVertex(point(0, height));
    line = [p1, p2, p3, p4, p1];
    lines.push(line);
    createEdge(null, line, false, 0);
  }

  function markEdge(edge) {
    var i, j, line, angle;
    line = edge.line;
    i = line.length - 1;
    while (--i) {
      line[i].marked = true;
    }
    i = line.length - 1;
    while (i--) {
      j = i + 1;
      if (edge.reversed) {
        line[i].marked2 = true;
        line[j].marked2 = true;
      } else {
        line[i].marked1 = true;
        line[j].marked1 = true;
      }
      line[i].angle2 = getAngle([line[j], line[i]]);
      line[j].angle1 = getAngle([line[i], line[j]]);
    }
  }

  return {
    lastRegion: lastRegion,
    vertices: vertices,
    addVertex: addVertex,
    spots: spots,
    addSpot: addSpot,
    dead: dead,
    lines: lines,
    createFrame: createFrame,
    touchesAnything: touchesAnything,
    touch: touch,
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
    lineClockwise: lineClockwise,
    clockwise: clockwise,
    point: point,
    getAngle: getAngle,
    getRegionVertices: getRegionVertices,
    holdsExpectation: holdsExpectation,
    spotInBoundary: spotInBoundary,
    traverse: traverse,
    getSucc: getSucc,
    getPointSucc: getPointSucc,
    getBoundary: getBoundary,
    getRegion: getRegion,
    getFirstSegment: getFirstSegment,
    getFirstEdgeSegment: getFirstEdgeSegment,
    getBoundaryAsArray: getBoundaryAsArray,
    getBoundaryEdges: getBoundaryEdges,
    getRegionSpots: getRegionSpots,
    getAllBoundarySpots: getAllBoundarySpots
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
    data.createFrame(settings.width, settings.height);
    i = settings.numberOfSpots;
    while (i--) {
      vertex = data.addVertex(data.point(
          settings.width / 2 * (1 + Math.sin(i * 2 * Math.PI / settings.numberOfSpots) / 2),
          settings.height / 2 * (1 + Math.cos(i * 2 * Math.PI / settings.numberOfSpots) / 2)
        ));
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
        console.log(data.addEdge(startSpot, spot, newLine));
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
    //interpolate('cardinal');
    interpolate('linear');

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

  function drawTriangles(region) {
    var line, triangles;
    line = svgTriangles.selectAll('path').
      data(window.triangles || computerMove.getTriangles(data.vertices, data.lines));
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
      text(function(d) { return d.id.toString(); });
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
    facade.drawLine(data.point(scaleXBack(position[0]), scaleYBack(position[1])));
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
    redrawSpots: redrawSpots,
    drawTriangles: drawTriangles
  };
}());

var computerMove = (function () {
  function getShortestPath(graph, start, end) {
    var distance, dist, from, queue, i, j, neighbour, neighbours, shortest, path;
    distance = [];
    i = graph.length;
    while (i--) {
      distance[i] = Number.MAX_VALUE;
    }
    queue = [];
    from = [];
    i = start.length;
    while (i--) {
      distance[start[i]] = 0;
      queue.push(start[i]);
    }
    i = end.length;
    while (i--) {
      if (distance[end[i]] === Number.MAX_VALUE && distance[graph[end[i]].back.id] === 0) {
        return [graph[end[i]].back, graph[end[i]]];
      }
    }
    i = 0;
    while (i < queue.length) {
      neighbours = graph[queue[i]].neighbours.slice(0);
      j = neighbours.length;
      while (j--) {
        neighbour = neighbours[j];
        dist = distance[queue[i]] + data.distance(graph[queue[i]].point, neighbour.point);
        if (dist < distance[neighbour.id]) {
          distance[neighbour.id] = dist;
          from[neighbour.id] = queue[i];
          queue.push(neighbour.id);
        }
      }
      i++;
    }
    i = end.length;
    shortest = end[0];
    while (i--) {
      if (distance[end[i]] < distance[shortest]) {
        shortest = end[i];
      }
    }
    if (distance[shortest] === Number.MAX_VALUE) {
      return null;
    }
    path = [graph[shortest]];
    while (isSet(from[shortest])) {
      shortest = from[shortest];
      path.push(graph[shortest]);
    }
    path.reverse();
    return path;
  }

  function addTriangles(triangles, adjacencyMatrix, points) {
    var i, triangle;
    while (points.length > 2) {
      i = points.length - 1;
      while (--i) {
        triangle = [points[i - 1], points[i], points[i + 1], points[i - 1]];
        if (data.lineClockwise(triangle, false, true)) {
          d3.pairs(triangle).forEach(function (edge) {
            adjacencyMatrix[edge[0].id][edge[1].id] = triangles.length;
          });
          triangles.push(triangle);
          points.splice(i, 1);
        }
      }
    }
  }

  function getTriangles(points, lines) {
    var output, triangles, i, adjacencyMatrix, getNextEdge, part1, part2, part3;
    getNextEdge = function (triangle, currentEdge, segment) {
      var intersecting = [];
      if (!isSet(triangle) || !isSet(triangles[triangle])) {
        return null;
      }
      d3.pairs(triangles[triangle]).forEach(function (edge) {
        if (data.touch(edge, segment, true, true)) {
          intersecting.push(edge);
        }
      });
      if (!currentEdge) {
        return intersecting[0];
      }
      if (currentEdge[0] === intersecting[0][1]) {
        return intersecting[1];
      } else {
        return intersecting[0];
      }
    };
    output = Delaunay.triangulate(points.map(function (point) {
        return [point.x, point.y];
      }));
    triangles = [];
    for (i = output.length - 3; i >= 0; i -= 3) {
      triangles.push([
        points[output[i]],
        points[output[i + 1]],
        points[output[i + 2]],
        points[output[i]]]);
    }
    adjacencyMatrix = [];
    i = points.length;
    while (i--) {
      adjacencyMatrix[i] = [];
    }
    i = triangles.length;
    while (i--) {
      d3.pairs(triangles[i]).forEach(function (edge) {
        adjacencyMatrix[edge[0].id][edge[1].id] = i;
      });
    }
    i = lines.length;
    while (i--) {
      d3.pairs(lines[i]).forEach(function (segment) {
        var triangle, edge, j;
        if (segment[0] !== segment[1] &&
          !isSet(adjacencyMatrix[segment[0].id][segment[1].id]) &&
          !isSet(adjacencyMatrix[segment[1].id][segment[0].id])) {
            part1 = [segment[0]];
            part2 = [segment[0]];
            j = -1;
            do {
              j++;
              triangle = adjacencyMatrix[segment[0].id][j];
              edge = getNextEdge(triangle, null, segment);
            } while (!edge && j < points.length);
            if (!edge) {
              console.error("RUN. It's the end of the World!!!");
            }
            triangles[triangle] = null;
            while (edge) {
              triangle = adjacencyMatrix[edge[1].id][edge[0].id];
              if (edge[0] !== part1[part1.length - 1]) {
                part1.push(edge[0]);
              }
              if (edge[1] !== part2[part2.length - 1]) {
                part2.push(edge[1]);
              }
              edge = getNextEdge(triangle, edge, segment);
              triangles[triangle] = null;
            }
            part1.push(segment[1]);
            part2.push(segment[1]);
            part3 = part1.slice(0);
            part3.push(segment[0]);
            if (data.lineClockwise(part3)) {
              addTriangles(triangles, adjacencyMatrix, part1);
              addTriangles(triangles, adjacencyMatrix, part2.reverse());
            } else {
              addTriangles(triangles, adjacencyMatrix, part1.reverse());
              addTriangles(triangles, adjacencyMatrix, part2);
            }
        }
      });
    }
    return triangles.filter(function (triangle) {return triangle !== null});
  }

  function getGraph(triangles, lines) {
    var graph, triangle, i, j, k, l, edgeMarked, getEdge;
    graph = [];
    i = triangles.length;
    while (i--) {
      triangle = d3.pairs(triangles[i]);
      j = 3;
      while (j--) {
        if (!graph[triangle[j][0].id]) {
          graph[triangle[j][0].id] = [];
        }
        graph[triangle[j][0].id][triangle[j][1].id] = {
          start: triangle[j][0],
          end: triangle[j][1],
          point: data.add(
            triangle[j][0],
            data.multiply(
              data.subtract(triangle[j][1], triangle[j][0]), 0.6)),
          neighbours: [],
          back: null,
          nextEdge: null
        };
      }
    }
    lines.forEach(function (line) {
        line = d3.pairs(line);
        line.forEach(function (segment) {
            if (graph[segment[0].id][segment[1].id]) {
              graph[segment[0].id][segment[1].id]= null;
            }
            if (graph[segment[1].id][segment[0].id]) {
              graph[segment[1].id][segment[0].id]= null;
            }
          });
      });
    i = triangles.length;
    while (i--) {
      triangle = d3.pairs(triangles[i]);
      j = 3;
      while (j--) {
        if (graph[triangle[j][1].id][triangle[j][0].id]) {
          graph[triangle[j][0].id][triangle[j][1].id].back = graph[triangle[j][1].id][triangle[j][0].id];
          k = 3;
          while (k--) {
            l = (j + 3 - k) % 3;
            if (l !== j && graph[triangle[l][1].id][triangle[l][0].id]) {
              graph[triangle[j][0].id][triangle[j][1].id].neighbours.push(graph[triangle[l][1].id][triangle[l][0].id]);
            }
          }
        }
      }
    }
    return graph;
  }

  function condense(graph) {
    var condensed = [];
    graph.forEach(function (vertex) {
      vertex.forEach(function (edge) {
        if (edge) {
          edge.id = condensed.length;
          condensed.push(edge);
        }
      });
    });
    return condensed;
  }

  function getEntry(spot, region, holdsExpectation) {
    var i;
    i = spot.neighbours.length;
    while (i--) {
      if (spot.neighbours[i].region === region &&
          data.holdsExpectation(spot.neighbours[i]) === holdsExpectation) {
        return spot.neighbours[i];
      }
    }
    return null;
  }

  function getRegions(spot, holds) {
    if (spot.region !== null) {
      return [spot.region];
    } else {
      return spot.neighbours.map(function (neighbour) {
        if (holds === null || holds === data.holdsExpectation(neighbour)) {
          return neighbour.region;
        } else {
          return null;
        }
      }).filter(function (neighbour) {
        return neighbour !== null;
      });
    }
  }

  function getCommonRegion(startSpot, startHolds, endSpot, endHolds, atSpot, boundary) {
    var i, j, k, regions, regionSpots, boundarySpots, start, end, at;
    start = getRegions(startSpot, startHolds);
    end = getRegions(endSpot, endHolds);
    at = atSpot ? getRegions(atSpot, null) : false;
    regions = [];
    i = start.length;
    while (i--) {
      j = end.length;
      while (j--) {
        if (start[i] === end[j]) {
          if (at) {
            k = at.length;
            while (k--) {
              if (start[i] === at[k]) {
                return start[i];
              }
            }
          } else {
            regions.push(start[i]);
          }
        }
      }
    }
    if (regions.length < 2) {
      return regions[0];
    }
    regionSpots = data.getRegionSpots(regions[0]);
    boundarySpots = data.getAllBoundarySpots(startSpot);
    i = regionSpots.length;
    while (i--) {
      if (boundarySpots.indexOf(regionSpots[i]) < 0) {
        return regions[1];
      }
    }
    return regions[0];
  }

  function getIncommingEdges(triangles, graph, spot, entry) {
    var incomming, spotVertex;
    incomming = [];
    spotVertex = spot.vertex;
    graph[spotVertex.id].forEach(function (edge) {
      if (edge && data.getSucc(spot, [spotVertex, edge.point]) === entry) {
        incomming.push(edge.back.id);
        incomming.push(edge.id);
      }
    });
    if (incomming.length === 0) {
      triangles.forEach(function (triangle) {
        if (triangle.indexOf(spotVertex) >= 0) {
          triangle = d3.pairs(triangle);
          triangle.forEach(function (edge) {
            if (graph[edge[0].id][edge[1].id] &&
                data.getSucc(spot, [spotVertex, graph[edge[0].id][edge[1].id].point]) === entry) {
              incomming.push(graph[edge[0].id][edge[1].id].id);
              incomming.push(graph[edge[1].id][edge[0].id].id);
            }
          });
        }
      });
    }
    return incomming;
  }

  //function pointMarked(point, entry, marks) {
  //  var neighbours;
  //  if (!marks[point.id]) {
  //    return false;
  //  }
  //  neighbours = marks[point.id].slice(0);
  //  entry = {angle: data.getAngle([point, entry])};
  //  neighbours.push(entry);
  //  neighbours.sort(function (a, b) {
  //    return a.angle - b.angle;
  //  });
  //  return neighbours[(neighbours.indexOf(entry) + 1) % neighbours.length].value;
  //}

  function isSet(value) {
    return value || value === 0;
  }

  function getBubbles(graph, marked, next, prev, tight) {
    var i, j, edgeMarked, a, switched;
    if (tight) {
      edgeMarked = function (edge) {
        //return pointMarked(edge.end, edge.point, marked) ||
        //  (pointMarked(edge.start, edge.point, marked) && pointMarked(edge.end, edge.point, marked));
        return marked[edge.end.id];
      };
    } else {
      edgeMarked = function (edge) {
        //return !pointMarked(edge.start, edge.point, marked) && pointMarked(edge.end, edge.point, marked);
        return marked[edge.end.id] && !marked[edge.start.id];
      };
    }
    i = graph.length;
    while (i--) {
      if (edgeMarked(graph[i])) {
        j = graph[i].neighbours.length;
        while (j--) {
          if (edgeMarked(graph[i].neighbours[j])) {
            next[i] = graph[i].neighbours[j].id;
            prev[graph[i].neighbours[j].id] = i;
          }
        }
      }
    }
    if (tight) {
      i = graph.length;
      while (i--) {
        if (!isSet(next[i]) && isSet(prev[i]) && isSet(next[graph[i].back.id]) && !isSet(prev[graph[i].back.id])) {
          next[i] = graph[i].back.id;
        }
      }
      i = next.length;
      while (i--) {
        if (next[i]) {
          prev[next[i]] = i;
        }
      }
    }
  }

  function markSpotBoundary(spot, region, marks, value) {
    var boundary, edge;
    if (marks[spot.vertex.id] !== value) {
      marks[spot.vertex.id] = value;
      spot.neighbours.forEach(function (neighbour) {
        if (neighbour.region === region) {
          edge = neighbour;
        }
      });
      if (edge) {
        boundary = data.getBoundaryAsArray(spot, edge);
        boundary.forEach(function (point) {
          marks[point.id] = value;
        });
      }
    }
  }

  //function markEdgeBoundary(startEdge, endEdge, marks, value) {
  //  var boundary1, boundary2, endSegment, i;
  //  boundary1 = data.getBoundaryAsArray(null, startEdge);
  //  boundary1.push(boundary1[0]);
  //  if (endEdge) {
  //    endSegment = data.getFirstEdgeSegment(endEdge);
  //    i = boundary1.length;
  //    while (boundary1[i] !== endSegment[0] || boundary1[i + 1] !== endSegment[1]) {
  //      i--;
  //    }
  //    boundary2 = boundary1.slice(i + 1);
  //    boundary1 = boundary1.slice(0, i + 2);
  //    console.log(boundary1.map(function(a){return a.id}));
  //    console.log(boundary2.map(function(a){return a.id}));
  //  } else {
  //    boundary2 = [];
  //  }
  //  boundary1 = d3.pairs(boundary1);
  //  boundary2 = d3.pairs(boundary2);
  //  boundary1.forEach(function (segment) {
  //    if (!marks[segment[0].id]) {
  //      marks[segment[0].id] = [];
  //    }
  //    marks[segment[0].id].push({
  //      angle: data.getAngle(segment),
  //      value: value
  //    });
  //  });
  //  boundary2.forEach(function (segment) {
  //    if (!marks[segment[0].id]) {
  //      marks[segment[0].id] = [];
  //    }
  //    marks[segment[0].id].push({
  //      angle: data.getAngle(segment),
  //      value: !value
  //    });
  //  });
  //}

  //function markSpotBoundary(spot, region, marks, value) {
  //  var boundary, edge;
  //  if (!marks[spot.vertex.id]) {
  //    spot.neighbours.forEach(function (neighbour) {
  //      if (neighbour.region === region) {
  //        edge = neighbour;
  //      }
  //    });
  //    if (edge) {
  //      markEdgeBoundary(edge, null, marks, value);
  //    } else {
  //      marks[spot.vertex.id] = [{
  //        angle: -1,
  //        value: value
  //      }];
  //    }
  //  }
  //}

  function markLine(start, next, marks) {
    var line = [];
    while (start !== undefined && !marks[start]) {
      line.push(start);
      marks[start] = true;
      start = next[start];
    }
    if (start !== undefined) {
      line.push(start);
    }
    return line;
  }

  function mergeBubbles(graph, connected, next, prev) {
    var start, end, path, back, i, a;
    start = [];
    end = [];
    i = next.length;
    while (i--) {
      if (next[i] !== undefined) {
        if (connected[i]) {
          start.push(i);
        } else {
          end.push(i);
        }
      }
    }
    if (end.length === 0) {
      return false;
    }
    path = getShortestPath(graph, start, end);
    if (!path) {
      return false;
    }
    //if (data.distance(path[0].point, path[1].point, true) > data.distance(path[0].point, path[1].back.point, true)) {
      i = path.length - 1;
      while (--i) {
        path[i] = graph[path[i].id].back;
      }
    //}
    back = path.map(function (point) {
      return point.back;
    });
    back[0] = graph[next[path[0].id]];
    back[back.length - 1] = graph[prev[path[path.length - 1].id]];
    if (data.touch([path[0].point, path[1].point], [back[0].point, back[1].point])) {
      i = path.length - 1;
      while (--i) {
        a = path[i];
        path[i] = back[i];
        back[i] = a;
      }
    }
    d3.pairs(path).forEach(function (segment) {
      next[segment[0].id] = segment[1].id;
      prev[segment[1].id] = segment[0].id;
    });
    d3.pairs(back).forEach(function (segment) {
      prev[segment[0].id] = segment[1].id;
      next[segment[1].id] = segment[0].id;
    });
    return true;
  }

  function mergeAllBubbles(graph, start, next, prev) {
    var connected, line, i;
    if (start === null) {
      i = next.length;
      while (i--) {
        if (next[i]) {
          start = i;
          break;
        }
      }
    }
    i = 0;
    do {
      connected = [];
      line = markLine(start, next, connected);
      i += 1;
      if (i > facade.settings.numberOfSpots) {
        break;
      }
    } while (mergeBubbles(graph, connected, next, prev));
    return line.map(function (point) {
      return graph[point];
    });
  }

  function getMove(startSpot, startHolds, endSpot, endHolds, atSpot, spots) {
    var i, j, triangles, graph, line, line2, condensed, marked, region, next, prev, startBoundary, startBoundaryNr, endBoundaryNr, startEntry, endEntry, endPos, start, end, connected, startConnection, endConnection, reverse, part1, part2;
    next = [];
    prev = [];
    triangles = getTriangles(data.vertices, data.lines);
    graph = getGraph(triangles, data.lines);
    condensed = condense(graph);
    region = getCommonRegion(startSpot, startHolds, endSpot, endHolds, atSpot);
    startEntry = getEntry(startSpot, region, startHolds);
    endEntry = getEntry(endSpot, region, endHolds);
    startBoundaryNr = data.getBoundary(startSpot, startEntry);
    endBoundaryNr = data.getBoundary(endSpot, endEntry);
    start = getIncommingEdges(triangles, graph, startSpot, startEntry);
    end = getIncommingEdges(triangles, graph, endSpot, endEntry);
    if (startBoundaryNr === endBoundaryNr) {

      marked = [];
      next = [];
      prev = [];
      markSpotBoundary(startSpot, region, marked, true);
      i = spots.length;
      if (startEntry === endEntry) {
        while (i--) {
          if (marked[spots[i].vertex.id]) {
            reverse = true;
          }
        }
      } else {
        if (startSpot.neighbours.length > 0) {
          startBoundary = data.getBoundaryEdges(startEntry);
          endPos = startBoundary.indexOf(endEntry);
          part1 = startBoundary.slice(0, endPos).map(function(edge) {return edge.toSpot;});
          part2 = startBoundary.slice(endPos, startBoundary.length - 1).map(function(edge) {return edge.toSpot;});
          i = spots.length;
          while (i--) {
            if (part1.indexOf(spots[i]) >= 0 && part2.indexOf(spots[i]) < 0) {
              reverse = true;
            }
          }
          //i = spots.length;
          //while (i--) {
          //  j = 0;
          //  while (j < startBoundary.length && spots[i] !== startBoundary[j].toSpot) {j++;}
          //  if (j < endPos) {
          //    reverse = true;
          //  }
          //}
          //i = endPos;
          //while (i--) {
          //  if (spots.indexOf(startBoundary[i].toSpot) < 0) {
          //    reverse = true;
          //  }
          //}
        }
      }

      getBubbles(condensed, marked, next, prev, true);

      if (startEntry === endEntry) {
        i = start.length;
        while (i--) {
          if (next[start[i]]) {
            condensed[start[i]].neighbours.forEach(function (point) {
              if (next[point.id] && start.indexOf(point.id) >= 0) {
                startConnection = condensed[start[i]];
                endConnection = point;
              }
            });
          }
        }
      } else {
        startConnection = condensed[start[0]];
        endConnection = condensed[end[0]];
      }
      if (reverse) {
        i = startConnection;
        startConnection = endConnection;
        endConnection = i;
        i = startSpot;
        startSpot = endSpot;
        endSpot = i;
      }
      line = markLine(endConnection.id, next, []);
      next[endConnection.id] = undefined;
      prev[startConnection.id] = undefined;
      i = 1;
      while (condensed[line[i]] !== startConnection) {
        next[line[i]] = undefined;
        prev[line[i]] = undefined;
        i++;
      }

//      i = next.length;
//      while (i--) {
//        if (next[i] || next[i] === 0) {
//          data.lines.push([condensed[i].point, condensed[next[i]].point]);
//        }
//      }
      //line = mergeAllBubbles(condensed, null, next, prev);
      //i = line.length - 1;
      //i = next2.length;
      //while (i--) {
      //  if (next2[i] || next2[i] === 0) {
      //    data.lines.push([condensed[i].point, condensed[next2[i]].point]);
      //  }
      //}

      marked = [];
      spots.forEach(function (spot) {
        markSpotBoundary(spot, region, marked, true);
      });
      markSpotBoundary(startSpot, region, marked, false);
      getBubbles(condensed, marked, next, prev, false);
//      if (startSpot.id === 1) {
//        console.log('aoeu');
//      i = next.length;
//      while (i--) {
//        if (next[i] || next[i] === 0) {
//          data.lines.push([condensed[i].point, condensed[next[i]].point]);
//        }
//      }
//      }
      line = mergeAllBubbles(condensed, startConnection.id, next, prev);
      i = -1;
      while (++i < line.length) {
        while (line[i] && line[i].back === line[i + 1]) {
          line.splice(i, 2);
          i--;
        }
      }

    } else {
      line = getShortestPath(condensed, start, end);
    }
    console.log(line);
    line = line.map(function (edge) {
      return edge.point;
    });
    line.unshift(startSpot.vertex);
    line.push(endSpot.vertex);
    data.lines.push(line);
    data.addEdge(startSpot, endSpot, line);
    graphics.redrawLines();
    graphics.redrawSpots();
  }

  function interpretMove(text) {
    var startSpot, startHolds, endSpot, endHolds, newSpot, atSpot, spots, re, match, a;
    re = /(\d+)(\!?)\((.*)\)(\!?)(\d+)(\!?)(\[(.*)\])?/;
    match = text.match(re);
    startSpot = data.spots[Number(match[1]) - 1];
    startHolds = match[2] !== '!';
    endSpot = data.spots[Number(match[5]) - 1];
    endHolds = match[4] !== '!';
    newSpot = match[3].split('@');
    if (match[6] === '!') {
      a = startSpot;
      startSpot = endSpot;
      endSpot = a;
      a = startHolds;
      startHolds = endHolds;
      endHolds = a;
    }
    atSpot = data.spots[Number(newSpot[1]) - 1];
    spots = match[8];
    if (spots) {
      spots = spots.split(',');
      spots = spots.map(function (spot) {
        return data.spots[Number(spot) - 1];
      });
    }
    getMove(startSpot, startHolds, endSpot, endHolds, atSpot, spots || []);
  }

  return {
    getTriangles: getTriangles,
    getMove: getMove,
    interpretMove: interpretMove
  };
}());

