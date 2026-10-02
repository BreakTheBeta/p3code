// LessWrong Quick Takes -- the phone half.
//
// The watch cannot talk HTTPS, so everything network-shaped happens here: one
// GraphQL request to lesswrong.com for the most recent shortform comments,
// which is what the site calls Quick Takes, then a random sample of the ones
// posted inside the chosen window gets pushed over AppMessage.
//
// The phone keeps the whole day it fetched, not just the dozen it sent. That is
// what makes SHUFFLE free: a new random sample is a re-deal from memory rather
// than a second trip to the network, and opening a take costs no request at all
// because its full text is already here.

// The wire protocol and the build label are generated from protocol.json by
// tools/gen-protocol.js, which writes the same table into appinfo.json's
// appKeys and into main.c. Edit protocol.json, never this block;
// test/protocol.test.js fails if the copies disagree.
// @generated protocol:begin
var KEY_CMD = "cmd";
var KEY_INDEX = "index";
var KEY_TOTAL = "total";
var KEY_AUTHOR = "author";
var KEY_AGE = "age";
var KEY_PREVIEW = "preview";
var KEY_BODY = "body";
var KEY_OFFSET = "offset";
var KEY_CHUNKS = "chunks";
var KEY_ERROR = "error";
var KEY_STATUS = "status";
var KEY_POOL = "pool";
var KEY_WINDOW = "window";
var KEY_KARMA = "karma";

var CMD_REFRESH = 1;
var CMD_SHUFFLE = 2;
var CMD_TAKE_ITEM = 3;
var CMD_TAKE_END = 4;
var CMD_BODY_REQUEST = 5;
var CMD_BODY_CHUNK = 6;
var CMD_ERROR = 7;
var CMD_STATUS = 8;

var BUILD_LABEL = "v0.1";
// @generated protocol:end

var GRAPHQL_URL = "https://www.lesswrong.com/graphql";
var SETTINGS_KEY = "lwqt_settings";

// LessWrong's shortform view returns roughly-recent comments rather than a
// strict date page, and it mixes in the occasional much older one, so the day
// filter below is ours to apply. Asking for 60 leaves enough inside a 24 hour
// window to sample from without pulling the whole week down the pipe.
var FETCH_LIMIT = 60;
// plaintextMainText arrives already capped around 2000 characters by the API.
// Matching that here keeps the chunk count honest instead of promising a tail
// the server never sent.
var BODY_LIMIT = 2000;
// One AppMessage per chunk, sized so a chunk plus its keys clears the watch's
// 1024 byte inbox with room to spare.
var BODY_CHUNK = 400;
var PREVIEW_LIMIT = 120;
var AUTHOR_LIMIT = 24;
var AGE_LIMIT = 8;
var ERROR_LIMIT = 110;
var STATUS_LIMIT = 40;

var DEFAULT_WINDOW_HOURS = 24;
var DEFAULT_SAMPLE_SIZE = 12;
// The watch holds a fixed-size roster; sending more than it can store would
// silently drop the tail.
var MAX_SAMPLE_SIZE = 20;
// A quiet night on LessWrong can leave a 24 hour window nearly empty, and an
// empty list is a worse answer than a slightly older one. Below this the window
// widens once rather than reporting nothing.
var MIN_POOL = 5;
var WIDEN_HOURS = 72;

var HTTP_TIMEOUT_MS = 20000;
var MAX_APP_MESSAGE_FAILURES = 3;

var HOUR_MS = 3600000;
var DAY_MS = 24 * HOUR_MS;

// Every take inside the window the last fetch covered, newest first, with full
// text. `sample` is the subset currently on the glass; its indices are what the
// watch sends back in a BODY_REQUEST.
var pool = [];
var sample = [];
var poolWindowHours = DEFAULT_WINDOW_HOURS;
var fetchInFlight = false;

var appMessageQueue = [];
var appMessageBusy = false;
var appMessageFailureCount = 0;

// Injectable so the shuffle is testable. Nothing else in here reads Math.random.
var randomSource = function() {
  return Math.random();
};


/** The watch has no console, so `pebble logs` is the only window into what the
    phone half did. One line per fetch is enough to tell a quiet day apart from a
    failed request, which look identical on the glass. */
function log(message) {
  if (typeof console !== "undefined" && console.log) {
    console.log(message);
  }
}


///////////////////////////////////////////////////////////////////// settings

function settings() {
  var stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(SETTINGS_KEY));
  } catch (e) {
    stored = null;
  }
  if (!stored || typeof stored !== "object") {
    stored = {};
  }
  return {
    windowHours: clampInt(stored.windowHours, 1, 24 * 14, DEFAULT_WINDOW_HOURS),
    sampleSize: clampInt(stored.sampleSize, 1, MAX_SAMPLE_SIZE, DEFAULT_SAMPLE_SIZE),
    minKarma: clampInt(stored.minKarma, -1000, 1000, 0)
  };
}

function saveSettings(next) {
  next = next || {};
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({
    windowHours: clampInt(next.windowHours, 1, 24 * 14, DEFAULT_WINDOW_HOURS),
    sampleSize: clampInt(next.sampleSize, 1, MAX_SAMPLE_SIZE, DEFAULT_SAMPLE_SIZE),
    minKarma: clampInt(next.minKarma, -1000, 1000, 0)
  }));
}

function clampInt(value, low, high, fallback) {
  var number = parseInt(value, 10);
  if (isNaN(number)) {
    return fallback;
  }
  if (number < low) return low;
  if (number > high) return high;
  return number;
}


//////////////////////////////////////////////////////////////////////// text

/** Collapses every whitespace run to one space so a preview cannot contain a
    newline the watch would have to lay out. */
function flatten(text) {
  if (!text) {
    return "";
  }
  return String(text).replace(/\s+/g, " ").replace(/^ | $/g, "");
}

/** Keeps paragraph breaks, which the detail screen does render, but normalizes
    the runs of blank lines LessWrong's plaintext conversion leaves behind. */
function tidyBody(text) {
  if (!text) {
    return "";
  }
  return String(text)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+|\n+$/g, "");
}

/** The UTF-8 size of one JS character, and how many JS characters it spans.
    Everything downstream is measured in bytes, because bytes are what the
    watch's fixed buffers hold. */
function utf8Step(text, i) {
  var code = text.charCodeAt(i);
  if (code < 0x80) return { bytes: 1, chars: 1 };
  if (code < 0x800) return { bytes: 2, chars: 1 };
  // A surrogate pair is one character in four UTF-8 bytes, and splitting it
  // produces a string the watch will refuse to draw.
  if (code >= 0xD800 && code <= 0xDBFF && i + 1 < text.length) {
    return { bytes: 4, chars: 2 };
  }
  return { bytes: 3, chars: 1 };
}

function utf8Length(text) {
  var bytes = 0;
  for (var i = 0; i < text.length;) {
    var step = utf8Step(text, i);
    bytes += step.bytes;
    i += step.chars;
  }
  return bytes;
}

/** Truncates to a UTF-8 *byte* budget, never mid-character.
    Pebble's text renderer draws nothing at all -- not a short string, nothing --
    for a string that is not valid UTF-8. Counting JS characters here instead let
    a 120-character preview weigh 122 bytes, get cut to 120 by the watch's
    buffer, and lose its ellipsis's tail along with the whole row. */
function compact(text, limit) {
  var value = text === undefined || text === null ? "" : String(text);
  if (utf8Length(value) <= limit) {
    return value;
  }
  var budget = limit - 3; // the ellipsis costs three of the budget's bytes
  if (budget <= 0) {
    return "";
  }
  var bytes = 0;
  var end = 0;
  for (var i = 0; i < value.length;) {
    var step = utf8Step(value, i);
    if (bytes + step.bytes > budget) {
      break;
    }
    bytes += step.bytes;
    i += step.chars;
    end = i;
  }
  return value.slice(0, end) + "…";
}

/** Splits a body into pieces of at most `budget` UTF-8 bytes, each tagged with
    the byte offset the watch writes it at. The watch reassembles by offset, so
    slicing by JS character index would desynchronize from those offsets the
    moment a take contained one non-ASCII character -- leaving a body with a hole
    in it and no single message that looked wrong. */
function splitBody(text, budget) {
  var pieces = [];
  var offset = 0;
  var start = 0;
  var bytes = 0;
  for (var i = 0; i < text.length;) {
    var step = utf8Step(text, i);
    if (bytes + step.bytes > budget) {
      pieces.push({ offset: offset, text: text.slice(start, i) });
      offset += bytes;
      start = i;
      bytes = 0;
    }
    bytes += step.bytes;
    i += step.chars;
  }
  if (start < text.length || pieces.length === 0) {
    pieces.push({ offset: offset, text: text.slice(start) });
  }
  return pieces;
}

function ageText(ms) {
  if (!(ms > 0)) {
    return "now";
  }
  var minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return minutes + "m";
  var hours = Math.floor(minutes / 60);
  if (hours < 48) return hours + "h";
  return Math.floor(hours / 24) + "d";
}



/////////////////////////////////////////////////////////////////////// fetch

function graphqlBody(limit) {
  return JSON.stringify({
    query: "{comments(input:{terms:{view:\"shortform\",limit:" + limit + "}})" +
      "{results{_id postedAt baseScore user{displayName} contents{plaintextMainText}}}}"
  });
}

/** XMLHttpRequest reports every pre-HTTP failure as status 0 with nothing else,
    so a phone with no signal, a DNS miss and a refused connection all arrive
    identically. The two things we do know are how long the attempt took and
    that nothing answered, which is enough to say something truer than "failed".
    An HTTP status is the server talking and must never be turned into a claim
    about the link. */
function transportFailure(kind, elapsedMs, budgetMs) {
  if (kind === "timeout" || elapsedMs >= budgetMs - 250) {
    return new Error("No answer from lesswrong.com");
  }
  return new Error("Cannot reach lesswrong.com");
}

function fetchTakes(callback) {
  if (typeof XMLHttpRequest === "undefined") {
    callback(new Error("Phone HTTP unavailable"));
    return;
  }

  var done = false;
  var startedAt = Date.now();
  var request = new XMLHttpRequest();

  function finish(error, value) {
    if (done) {
      return;
    }
    done = true;
    clearTimeout(timer);
    callback(error, value);
  }

  function failTransport(kind) {
    finish(transportFailure(kind, Date.now() - startedAt, HTTP_TIMEOUT_MS));
  }

  var timer = setTimeout(function() {
    try {
      request.abort();
    } catch (e) {
      void e;
    }
    failTransport("timeout");
  }, HTTP_TIMEOUT_MS);

  request.ontimeout = function() {
    failTransport("timeout");
  };
  request.onerror = function() {
    failTransport("error");
  };
  request.onreadystatechange = function() {
    if (request.readyState !== 4 || done) {
      return;
    }
    if (!request.status) {
      failTransport("error");
      return;
    }
    if (request.status < 200 || request.status >= 300) {
      finish(new Error("LessWrong error " + request.status));
      return;
    }
    var payload;
    try {
      payload = JSON.parse(request.responseText);
    } catch (e) {
      finish(new Error("Unreadable reply from LessWrong"));
      return;
    }
    // GraphQL answers a rejected query with 200 and an errors array, so a
    // status check alone would read a failure as an empty day.
    if (payload && payload.errors && payload.errors.length) {
      var first = payload.errors[0] || {};
      finish(new Error(compact(first.message || "LessWrong rejected the query", ERROR_LIMIT)));
      return;
    }
    var results = payload && payload.data && payload.data.comments &&
      payload.data.comments.results;
    if (!results || typeof results.length !== "number") {
      finish(new Error("No quick takes in reply"));
      return;
    }
    finish(null, normalizeTakes(results));
  };

  request.open("POST", GRAPHQL_URL, true);
  request.setRequestHeader("Content-Type", "application/json");
  request.setRequestHeader("Accept", "application/json");
  request.timeout = HTTP_TIMEOUT_MS;
  request.send(graphqlBody(FETCH_LIMIT));
}

function normalizeTakes(results) {
  var takes = [];
  for (var i = 0; i < results.length; i++) {
    var comment = results[i] || {};
    var body = tidyBody(comment.contents && comment.contents.plaintextMainText);
    var postedAt = Date.parse(comment.postedAt);
    // A take with no text is a deleted or image-only comment: there is nothing
    // to read, so it should not occupy a row.
    if (!body || isNaN(postedAt)) {
      continue;
    }
    takes.push({
      id: String(comment._id || ("take-" + i)),
      author: flatten((comment.user && comment.user.displayName) || "Anonymous"),
      karma: clampInt(comment.baseScore, -100000, 100000, 0),
      postedAt: postedAt,
      body: compact(body, BODY_LIMIT)
    });
  }
  takes.sort(function(a, b) {
    return b.postedAt - a.postedAt;
  });
  return takes;
}

/** Everything posted inside `hours`, widened once if the day was too quiet to
    sample from. Returns the window actually used so the watch can say so. */
function windowTakes(takes, hours, minKarma, now) {
  function inside(limitHours) {
    var floor = now - limitHours * HOUR_MS;
    var kept = [];
    for (var i = 0; i < takes.length; i++) {
      if (takes[i].postedAt >= floor && takes[i].karma >= minKarma) {
        kept.push(takes[i]);
      }
    }
    return kept;
  }

  var kept = inside(hours);
  if (kept.length >= MIN_POOL || hours >= WIDEN_HOURS) {
    return { takes: kept, hours: hours };
  }
  var widened = inside(WIDEN_HOURS);
  if (widened.length <= kept.length) {
    return { takes: kept, hours: hours };
  }
  return { takes: widened, hours: WIDEN_HOURS };
}

/** A random subset, then newest first. The membership is the random part; the
    order it reads in is not, because a list that reshuffles its ordering as
    well as its contents is hard to tell apart from a list of different takes. */
function drawSample(takes, count) {
  var deck = takes.slice(0);
  for (var i = deck.length - 1; i > 0; i--) {
    var j = Math.floor(randomSource() * (i + 1));
    if (j > i) {
      j = i;
    }
    var swap = deck[i];
    deck[i] = deck[j];
    deck[j] = swap;
  }
  var drawn = deck.slice(0, count);
  drawn.sort(function(a, b) {
    return b.postedAt - a.postedAt;
  });
  return drawn;
}


///////////////////////////////////////////////////////////////////// sending

function send(message) {
  appMessageQueue.push(message);
  flushMessages();
}

function flushMessages() {
  if (appMessageBusy || appMessageQueue.length === 0) {
    return;
  }
  appMessageBusy = true;
  var message = appMessageQueue.shift();
  Pebble.sendAppMessage(message, function() {
    appMessageFailureCount = 0;
    appMessageBusy = false;
    flushMessages();
  }, function() {
    appMessageFailureCount++;
    if (appMessageFailureCount <= MAX_APP_MESSAGE_FAILURES) {
      appMessageQueue.unshift(message);
    } else {
      // Never report a broken AppMessage link over that same broken link: an
      // error message enqueued here would recreate its own failure forever.
      // The watch re-asks when it can, which refills this queue.
      appMessageFailureCount = 0;
      appMessageQueue = [];
    }
    appMessageBusy = false;
    setTimeout(flushMessages, 250);
  });
}

function makeMessage(command, fields) {
  var message = {};
  message[KEY_CMD] = command;
  fields = fields || {};
  if (fields.index !== undefined) message[KEY_INDEX] = fields.index;
  if (fields.total !== undefined) message[KEY_TOTAL] = fields.total;
  if (fields.author !== undefined) message[KEY_AUTHOR] = fields.author;
  if (fields.age !== undefined) message[KEY_AGE] = fields.age;
  if (fields.karma !== undefined) message[KEY_KARMA] = fields.karma;
  if (fields.preview !== undefined) message[KEY_PREVIEW] = fields.preview;
  if (fields.body !== undefined) message[KEY_BODY] = fields.body;
  if (fields.offset !== undefined) message[KEY_OFFSET] = fields.offset;
  if (fields.chunks !== undefined) message[KEY_CHUNKS] = fields.chunks;
  if (fields.error !== undefined) message[KEY_ERROR] = fields.error;
  if (fields.status !== undefined) message[KEY_STATUS] = fields.status;
  if (fields.pool !== undefined) message[KEY_POOL] = fields.pool;
  if (fields.window !== undefined) message[KEY_WINDOW] = fields.window;
  return message;
}

function sendError(message) {
  send(makeMessage(CMD_ERROR, {
    error: compact(message && message.message ? message.message : message, ERROR_LIMIT)
  }));
}

function sendStatus(text) {
  send(makeMessage(CMD_STATUS, { status: compact(text, STATUS_LIMIT) }));
}

function sendSample() {
  var now = Date.now();
  for (var i = 0; i < sample.length; i++) {
    var take = sample[i];
    send(makeMessage(CMD_TAKE_ITEM, {
      index: i,
      total: sample.length,
      author: compact(take.author, AUTHOR_LIMIT),
      // Karma goes over as a number, not baked into a string: the watch colours
      // each row's edge by it, and it formats the "+117 / 3h" line itself.
      karma: take.karma,
      age: compact(ageText(now - take.postedAt), AGE_LIMIT),
      preview: compact(flatten(take.body), PREVIEW_LIMIT)
    }));
  }
  // The end marker carries the totals rather than a second request: `total` is
  // what the watch stores, `pool` is how many it was drawn from, and `window`
  // is the span that pool covers -- which may be wider than the one asked for.
  send(makeMessage(CMD_TAKE_END, {
    total: sample.length,
    pool: pool.length,
    window: poolWindowHours
  }));
}

function sendBody(index) {
  var take = sample[index];
  if (!take) {
    sendError("That take is no longer loaded");
    return;
  }
  var pieces = splitBody(take.body || "", BODY_CHUNK);
  for (var i = 0; i < pieces.length; i++) {
    send(makeMessage(CMD_BODY_CHUNK, {
      index: index,
      offset: pieces[i].offset,
      chunks: pieces.length,
      body: pieces[i].text
    }));
  }
}


////////////////////////////////////////////////////////////////////// actions

function refresh() {
  if (fetchInFlight) {
    return;
  }
  fetchInFlight = true;
  var config = settings();
  sendStatus("Reading LessWrong");
  log("fetching quick takes: window " + config.windowHours + "h, karma >= " +
    config.minKarma + ", showing " + config.sampleSize);
  fetchTakes(function(error, takes) {
    fetchInFlight = false;
    if (error) {
      log("fetch failed: " + error.message);
      sendError(error);
      return;
    }
    var windowed = windowTakes(takes, config.windowHours, config.minKarma, Date.now());
    pool = windowed.takes;
    poolWindowHours = windowed.hours;
    log("got " + takes.length + " takes, " + pool.length + " inside " +
      poolWindowHours + "h");
    if (pool.length === 0) {
      // Not an error: the request worked and the answer was "nothing yet".
      sample = [];
      sendSample();
      return;
    }
    sample = drawSample(pool, config.sampleSize);
    sendSample();
  });
}

/** A fresh draw from the pool already in memory. No network, so it is instant
    and works with the phone's radio asleep. */
function shuffle() {
  if (pool.length === 0) {
    refresh();
    return;
  }
  sample = drawSample(pool, settings().sampleSize);
  sendSample();
}


///////////////////////////////////////////////////////////////////// settings UI

function configurationHtml() {
  var config = settings();
  return [
    "<!DOCTYPE html><html><head>",
    "<meta name='viewport' content='width=device-width,initial-scale=1'>",
    "<title>Quick Takes</title>",
    "<style>",
    "body{font:16px -apple-system,Roboto,sans-serif;margin:0;padding:18px;",
    "background:#11130f;color:#e8ece4}",
    "h1{font-size:19px;margin:0 0 4px}",
    "p.sub{margin:0 0 20px;color:#8f9a86;font-size:13px}",
    "label{display:block;margin:16px 0 6px;font-size:13px;color:#8f9a86;",
    "text-transform:uppercase;letter-spacing:.06em}",
    "select,input{width:100%;box-sizing:border-box;padding:11px;font-size:16px;",
    "border-radius:8px;border:1px solid #39412f;background:#1b1f17;color:#e8ece4}",
    "button{width:100%;margin-top:26px;padding:14px;font-size:16px;font-weight:600;",
    "border:0;border-radius:8px;background:#4c8a52;color:#fff}",
    "small{display:block;margin-top:8px;color:#6f7a67;font-size:12px}",
    "</style></head><body>",
    "<h1>LessWrong Quick Takes</h1>",
    "<p class='sub'>Build " + BUILD_LABEL + "</p>",
    "<label for='window'>Look back</label>",
    "<select id='window'>",
    "<option value='6'>6 hours</option>",
    "<option value='12'>12 hours</option>",
    "<option value='24'>A day</option>",
    "<option value='72'>3 days</option>",
    "<option value='168'>A week</option>",
    "</select>",
    "<small>A quieter window than this widens to 3 days rather than show an empty list.</small>",
    "<label for='count'>Takes on the watch</label>",
    "<select id='count'>",
    "<option value='6'>6</option>",
    "<option value='12'>12</option>",
    "<option value='20'>20</option>",
    "</select>",
    "<label for='karma'>Minimum karma</label>",
    "<input id='karma' type='number' step='1'>",
    "<button id='save'>Save</button>",
    "<script>",
    "var win=document.getElementById('window');",
    "var count=document.getElementById('count');",
    "var karma=document.getElementById('karma');",
    "win.value='" + config.windowHours + "';",
    "count.value='" + config.sampleSize + "';",
    "karma.value='" + config.minKarma + "';",
    // A stored value that is not one of the offered options would otherwise
    // leave the select blank and silently rewrite itself on save.
    "if(!win.value)win.value='24';",
    "if(!count.value)count.value='12';",
    "document.getElementById('save').onclick=function(){",
    "location.href='pebblejs://close#'+encodeURIComponent(JSON.stringify({",
    "windowHours:parseInt(win.value,10),",
    "sampleSize:parseInt(count.value,10),",
    "minKarma:parseInt(karma.value,10)||0}));};",
    "</script></body></html>"
  ].join("");
}


//////////////////////////////////////////////////////////////////////// events

Pebble.addEventListener("ready", function() {
  log("bridge ready " + BUILD_LABEL);
  refresh();
});

Pebble.addEventListener("appmessage", function(event) {
  var message = event.payload || {};
  var command = message[KEY_CMD];
  if (command === CMD_REFRESH) {
    refresh();
  } else if (command === CMD_SHUFFLE) {
    shuffle();
  } else if (command === CMD_BODY_REQUEST) {
    sendBody(message[KEY_INDEX] || 0);
  }
});

Pebble.addEventListener("showConfiguration", function() {
  Pebble.openURL("data:text/html," + encodeURIComponent(configurationHtml()));
});

Pebble.addEventListener("webviewclosed", function(event) {
  if (!event || !event.response) {
    return;
  }
  try {
    saveSettings(JSON.parse(decodeURIComponent(event.response)));
  } catch (e) {
    sendError("Settings not saved");
    return;
  }
  // The window and karma floor decide what the pool contains, so it has to be
  // rebuilt from the network rather than resampled.
  pool = [];
  refresh();
});
