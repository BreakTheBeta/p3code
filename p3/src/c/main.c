#include <pebble.h>

/* The wire protocol and the build label are generated from protocol.json by
   tools/gen-protocol.js, which writes the same table into appinfo.json's
   appKeys and into the bridge. Edit protocol.json, never this block;
   test/protocol.test.js fails the build if the two disagree.

   SCOPE_ACTIVE / SCOPE_SETTLED pick which slice of a host's threads the list
   is showing. Settled covers snoozed too: both mean the thread is not asking
   for anything right now. */
/* @generated protocol:begin */
#define KEY_CMD          0
#define KEY_INDEX        1
#define KEY_TOTAL        2
#define KEY_SESSION_ID   3
#define KEY_TITLE        4
#define KEY_DIRECTORY    5
#define KEY_AGENT        6
#define KEY_STATUS       7
#define KEY_SUMMARY      8
#define KEY_CONTEXT      9
#define KEY_PROMPT       10
#define KEY_ERROR        11
#define KEY_REQUEST_ID   12
#define KEY_REQUEST_KIND 13
#define KEY_PROJECT_ID   14
#define KEY_CONTEXT_PAGE 15
#define KEY_SERVER       16
#define KEY_STATE        17
#define KEY_HOST_ID      18
#define KEY_DETAIL       19
#define KEY_C_NEEDS      20
#define KEY_C_RUN        21
#define KEY_C_IDLE       22
#define KEY_C_SETTLED    23
#define KEY_SCOPE        24
#define KEY_OFFSET       25
#define KEY_MATCHED      26
#define KEY_OTHER        27
#define KEY_SETTLED      28
#define KEY_ACTION       29
#define KEY_PATH         30
#define KEY_NAME         31
#define KEY_MODEL        32
#define KEY_INSTANCE_ID  33
#define KEY_IS_DEFAULT   34
#define KEY_C_MONITOR    35

#define CMD_REFRESH         1
#define CMD_SESSION_ITEM    2
#define CMD_SESSION_END     3
#define CMD_DETAIL          4
#define CMD_PROMPT          5
#define CMD_ERROR           6
#define CMD_CONTEXT         7
#define CMD_STATUS          8
#define CMD_PROJECT_ITEM    9
#define CMD_PROJECT_END     10
#define CMD_NEW_THREAD      11
#define CMD_HOST_ITEM       12
#define CMD_HOST_END        13
#define CMD_SELECT_HOST     14
#define CMD_THREAD_ACTION   15
#define CMD_PROJECT_NAME    16
#define CMD_PROJECT_PREVIEW 17
#define CMD_PROJECT_CREATE  18
#define CMD_CONCIERGE       19
#define CMD_MODEL_REQUEST   20
#define CMD_MODEL_ITEM      21
#define CMD_MODEL_END       22
#define CMD_PROJECT_DELETE  23
#define CMD_SCREENSHOT_PAGE 90

#define SCOPE_ACTIVE  0
#define SCOPE_SETTLED 1

#define BUILD_LABEL "v0.20"
/* @generated protocol:end */

#define MAX_HOSTS 6
#define MAX_SESSIONS 20
#define MAX_PROJECTS 20
#define MAX_MODELS 24
#define MAX_CONTEXT_TEXT 640
/* Five minutes was too slow to watch a run count drain -- the thing the home
   screen exists to show. One minute is affordable because refreshHosts() only
   sends host rows that actually changed: a poll where nothing moved costs a
   single CMD_HOST_END, so a quiet minute here is cheaper on the radio than one
   busy five-minute poll used to be. The phone still makes one HTTP request per
   host per minute, which is where the real cost of this landed. */
#define REFRESH_INTERVAL_MS 60000
/* A failed send used to leave no timer armed at all, so one Bluetooth blip
   stopped the app polling until a button was pressed. Recovery is worth more
   than the full interval, so a fault re-arms on a short retry instead. */
#define RETRY_INTERVAL_MS 30000
#define DETAIL_CONTENT_HEIGHT 900
#define DETAIL_CONTENT_MIN_HEIGHT 120

/* The reference watch is a chassis around an inset LCD: a legend band, a
   crimson rail pointing at the buttons, the glass, then the same in reverse.
   Both bands are kept, but every character on them is live data rather than a
   model name. */
/* Pebble Time 2 (emery): 200 x 228. Chrome takes 18 top and 18 bottom, the
   glass is inset 4 a side, so the panel is exactly 192 x 192 — which divides
   into four 48px rows with nothing left over. */
#if PBL_DISPLAY_WIDTH != 200 || PBL_DISPLAY_HEIGHT != 228
#error "Laid out for Pebble Time 2 (emery, 200x228)"
#endif
#define SCREEN_W PBL_DISPLAY_WIDTH
#define SCREEN_H PBL_DISPLAY_HEIGHT
#define LEGEND_HEIGHT 16
#define RAIL_HEIGHT 2
#define TOP_CHROME (LEGEND_HEIGHT + RAIL_HEIGHT)
#define BOTTOM_CHROME (LEGEND_HEIGHT + RAIL_HEIGHT)
#define PANEL_INSET 4
#define PANEL_W (SCREEN_W - 2 * PANEL_INSET)
#define PANEL_H (SCREEN_H - TOP_CHROME - BOTTOM_CHROME)
#define GLASS_PAD 8
#define ROW_HEIGHT 48
#define SECTION_HEADER_HEIGHT 18
#define CARD_PAD 8

/* Two rates, because two different things animate for two different reasons.
   A request in flight is a "wait, I am working" signal: it wants a smooth
   sweep, and it is over in seconds. A pulsing state mark means "something is
   running on a machine you are not looking at" -- ambient, indefinite, and the
   only thing that keeps this timer alive when the app is just left open. That
   one used to hold the whole screen at 9 Hz for a 7x7 square.

   s_stream_phase advances by one per fast tick and by IDLE_TICK_STEP per slow
   one, so every consumer's existing divisor still lands on the same on-glass
   rate. Nothing looks different; the watch just wakes a quarter as often. */
#define BUSY_TICK_MS 110
#define IDLE_TICK_MS 440
#define IDLE_TICK_STEP (IDLE_TICK_MS / BUSY_TICK_MS)
#define GHOST_ROWS 4

/* Requests currently in flight. This was five separate booleans, and the two
   error paths each reset a different subset of them -- which is how a spinner
   gets stuck. One field, one place to clear it. */
typedef enum {
  BusyHosts   = 1 << 0,
  BusyThreads = 1 << 1,
  BusyDetail  = 1 << 2,
  BusyContext = 1 << 3,
  BusySending = 1 << 4,
  BusyModels  = 1 << 5
} BusyFlag;

typedef struct {
  char id[40];
  char title[40];
  /* Wide enough for a failure sentence, not just a roll-up phrase: an offline
     host spends the whole panel on this line and it is the only place the
     reason is legible. */
  char detail[96];
  char state[10];
  int needs;
  int run;
  int monitor;
  int idle;
  int settled;
} HostItem;

typedef struct {
  char id[80];
  char title[56];
  char detail[36];
  char state[10];
  char request_id[72];
  char request_kind[12];
  char agent[32];
  char summary[180];
  bool settled;
} SessionItem;

typedef struct {
  char id[80];
  char title[52];
  char directory[40];
} ProjectItem;

typedef struct {
  char label[56];
  char instance_id[40];
  char model[64];
  bool is_default;
} ModelItem;

typedef enum {
  DictationTargetSession,
  DictationTargetProject,
  DictationTargetNewProject,
  DictationTargetConcierge
} DictationTarget;

/* Rows that sit under the thread list and lead somewhere rather than opening a
   thread. Which ones exist depends on the scope and on how much is left to
   page through, so they are rebuilt whenever a listing lands. */
typedef enum {
  FooterScopeSettled,
  FooterScopeActive,
  FooterMore
} FooterKind;

/* What an action menu entry does. Stored as the item's action data. */
typedef enum {
  ActionReply = 1,
  ActionSettle,
  ActionUnsettle,
  ActionInterrupt,
  ActionCancelProject,
  ActionCreateProject,
  ActionCancelDelete,
  ActionDeleteProject,
  ActionModelBase = 100
} ActionKind;

/* Thread-list scope and paging state, all reported by the phone alongside a
   listing so the footer rows can be labelled without a second request. */
static int s_scope;
static int s_offset;
static int s_matched;
static int s_other;
static FooterKind s_footers[2];
static int s_footer_count;

/* A project path proposed by the phone, held while the user confirms it. */
static char s_pending_project_path[160];
static char s_pending_project_name[48];

static Window *s_host_window;
static Window *s_thread_window;
static Window *s_detail_window;
static Window *s_diag_window;
static Layer *s_diag_layer;
static MenuLayer *s_thread_menu;
static Layer *s_host_layer;
/* The sweeping progress rail, lifted out of the full-screen host layer onto a
   strip of its own. It is the only thing that moves on the home screen, and it
   only moves while a refresh is in flight. */
static Layer *s_host_rail_layer;
static Layer *s_thread_chrome;
static Layer *s_detail_header_layer;
static Layer *s_detail_layer;
static ScrollLayer *s_scroll_layer;
static AppTimer *s_refresh_timer;
static AppTimer *s_stream_timer;
static DictationSession *s_dictation;
static GFont s_font_dseg_big;
static GFont s_font_dseg_mid;
static GFont s_font_dot;
static GFont s_font_dot_small;
static GBitmap *s_hatch;
static GColor s_hatch_palette[2];
static DictationTarget s_dictation_target = DictationTargetSession;

/* Segment-block metrics, measured once at launch. These are constant for a
   given font, and laying them out again inside every frame was the single
   most expensive thing the host screen did -- graphics_text_layout_get_content_size
   is a full layout pass, and draw_seg_value ran two of them per readout. */
/* Two segment faces, both at sizes where DSEG7 rasterises on whole pixels.
   The face is an outline, so it is only pixel-exact where its stems land on
   the grid: at 34 and 64 every digit has one stem weight and no ink in a
   one-pixel run, while the 20px face this replaced put 12.5% of its ink in
   slivers and mixed 2px and 8px stems in the same glyph. tools/verify_dseg.py
   is the check; change a size and run it before believing the result. */
typedef enum {
  SegMid = 0,   /* 34px: the sub-display readouts */
  SegBig,       /* 64px: the power-on segment test */
  SegSizeCount
} SegSize;

static GSize s_seg_block[SegSizeCount];  /* "88" in each DSEG face */
static int s_seg_digit[SegSizeCount];    /* one digit's advance, per face */
static GSize s_seg_self_test;  /* "88", the connecting screen's all-segments test */

static HostItem s_hosts[MAX_HOSTS];
static SessionItem s_sessions[MAX_SESSIONS];
static ProjectItem s_projects[MAX_PROJECTS];
static ModelItem s_models[MAX_MODELS];

static int s_host_count;
static int s_session_count;
static int s_project_count;
static int s_model_count;
static int s_host_cursor;
static int s_selected_host_index = -1;
static int s_selected_index = -1;
static int s_selected_project_index = -1;
static int s_selected_model_index = -1;
static int s_context_page;
static int s_context_page_count = 1;
static int s_pending_context_page;
static int s_context_request_counter;
static int s_stream_phase;
static int s_connect_draw_second = -1;

static int s_busy;
static bool s_hosts_synced;
static bool s_threads_synced;
static bool s_showing_context;
static bool s_link_down;
static time_t s_last_sync;

/* What the drawing code costs, measured rather than argued about. Shown on the
   diagnostics page: a redraw is the unit of battery spend here, so the frame
   count is the number to watch after any change to the animation policy. */
static uint32_t s_frame_count;
static uint32_t s_message_in;
static uint32_t s_message_out;
static time_t s_launched_at;
static time_t s_host_connect_started_at;

/* Errors are kept, not flashed. The reference prints MONITOR in red beneath
   the glass; that is where a fault belongs, and the log behind it is what
   makes a failure debuggable from the wrist. */
#define ERROR_LOG_DEPTH 6
/* The bridge sends up to 110 characters. Truncating to a phone-sized field
   used to cut "T3 rejected the access token (missing scope)" down to the half
   that does not say what to fix, so the log holds the whole sentence and the
   diagnostics page wraps it. */
#define ERROR_TEXT_MAX 112
static char s_error_log[ERROR_LOG_DEPTH][ERROR_TEXT_MAX];
static int s_error_log_count;
static int s_error_total;
static bool s_error_active;

static char s_status_text[40];
static char s_full_context[MAX_CONTEXT_TEXT];
static char s_pending_context_session_id[80];
static char s_pending_context_request_id[16];
static char s_draw_body[MAX_CONTEXT_TEXT];

static void log_error(const char *text);
static void enter_error_state(const char *text);
static void update_host_rail(void);
static void request_refresh(void);
static void request_detail(int index, bool full_context);
static void request_context_page(int page);
static void send_prompt_text(const char *text);
static void send_new_thread_text(const char *text);
static void request_project_models(void);
static void open_model_menu(void);
static void open_project_actions(void);
static void start_dictation(void);
static void schedule_refresh(uint32_t delay_ms);
static void update_stream_timer(void);
static void detail_exit_context(bool animated);
static void detail_content_update_proc(Layer *layer, GContext *ctx);
static void update_detail_text(void);
static void detail_reset_scroll(bool animated);
static void open_selected_host(void);
#ifdef SCREENSHOT_BUILD
static void show_screenshot_page(int page);
#endif

static bool busy_is(int flags) {
  return (s_busy & flags) != 0;
}

/* Anything with a request outstanding animates at the fast rate; the ambient
   pulse does not. Kept as one predicate so the tick policy has a single
   definition rather than a disjunction repeated at every call site. */
static bool busy_any(void) {
  return s_busy != 0 || !s_hosts_synced;
}

static int connecting_elapsed_seconds(void) {
  time_t started = s_host_connect_started_at ? s_host_connect_started_at : s_launched_at;
  int elapsed = (int)(time(NULL) - started);
  if (elapsed < 0) {
    return 0;
  }
  return elapsed > 99 ? 99 : elapsed;
}

static void log_error(const char *text) {
  if (!text || !text[0]) {
    return;
  }
  if (s_error_log_count > 0 && strncmp(s_error_log[0], text, sizeof(s_error_log[0]) - 1) == 0) {
    /* A repeating fault should not push the earlier context out of the log. */
    s_error_active = true;
    return;
  }
  for (int i = ERROR_LOG_DEPTH - 1; i > 0; i--) {
    strncpy(s_error_log[i], s_error_log[i - 1], sizeof(s_error_log[i]) - 1);
    s_error_log[i][sizeof(s_error_log[i]) - 1] = '\0';
  }
  strncpy(s_error_log[0], text, sizeof(s_error_log[0]) - 1);
  s_error_log[0][sizeof(s_error_log[0]) - 1] = '\0';
  if (s_error_log_count < ERROR_LOG_DEPTH) {
    s_error_log_count++;
  }
  s_error_total++;
  s_error_active = true;
}

/* ---------------------------------------------------------------- palette */

/* A negative-LCD Casio: near-black chassis, pale glass, dark ink, cyan
   legends, crimson rails. Monochrome watches collapse to black on white,
   which the shape language survives. */
/* A real positive LCD is a warm tan, not neutral grey; pale grey washes out
   on the physical panel. This is the substrate the reference photographs as. */
static GColor lcd_glass(void) {
#ifdef PBL_COLOR
  return GColorBrass;
#else
  return GColorWhite;
#endif
}

/* Unlit segments sit between the substrate and the ink, then get knocked back
   further by the hatch. */
static GColor lcd_ghost_tone(void) {
#ifdef PBL_COLOR
  return GColorPastelYellow;
#else
  return GColorBlack;
#endif
}

static GColor lcd_ink(void) {
  return GColorBlack;
}

static GColor lcd_dim(void) {
#ifdef PBL_COLOR
  return GColorDarkGray;
#else
  return GColorBlack;
#endif
}

static GColor chassis(void) {
  return GColorBlack;
}

static GColor legend(void) {
#ifdef PBL_COLOR
  return GColorPictonBlue;
#else
  return GColorWhite;
#endif
}

/* Red on the black chassis has to be bright to read; the same red on the pale
   glass has to be dark. One value cannot do both jobs. */
static GColor rule_color(void) {
#ifdef PBL_COLOR
  return GColorFolly;
#else
  return GColorWhite;
#endif
}

/* Alerts drawn on the glass: dark enough to hold against the substrate. */
static GColor alert_color(void) {
#ifdef PBL_COLOR
  return GColorDarkCandyAppleRed;
#else
  return GColorBlack;
#endif
}

/* Anything highlighted on the glass uses ink, never a chassis legend colour:
   light blue on a pale substrate is unreadable, and on the monochrome watches
   the legend colour is white, which disappears entirely. */
static GColor glass_accent(void) {
  return GColorBlack;
}

static GColor active_color(void) {
#ifdef PBL_COLOR
  return GColorDukeBlue;
#else
  return GColorBlack;
#endif
}

/* Casio uses green as the quiet-running accent. Keep monitoring distinct from
   active work on colour displays without giving it an animation of its own. */
static GColor monitoring_color(void) {
#ifdef PBL_COLOR
  return GColorIslamicGreen;
#else
  return GColorBlack;
#endif
}

/* UI text is the X11 5x7 dot-matrix face, doubled to a 10x14 cell, converted
   to an outline font whose every coordinate is a whole pixel (see
   tools/dotmatrix_to_pebble.py). It is the character generator a segment LCD
   actually uses, and being authored in pixels it cannot go soft the way an
   outline face does — Share Tech Mono was tried here and at 16px produced 1,
   2, 3 and 5 pixel stems inside a single glyph.

   The cell is 6x10 rather than 5x7 because 5x7 leaves only four usable
   columns, so its W degenerates into a box with a filled middle — thin at the
   top, blocky in the centre, and visibly out of step with every other glyph.
   6x10 draws a proper W with even stems.

   All 95 printable ASCII glyphs are verified bit-identical to the source
   bitmap at both scales. Each size must be requested at the size it was built
   for, or the doubling breaks and the strokes go ragged. */
static GFont font_row_title(void) {
  return s_font_dot ? s_font_dot : fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD);
}

/* Secondary lines drop to the undoubled cell. Everything on the glass is the
   same letterform; only the scale changes, which is how the reference gets its
   hierarchy — a big reading over tiny captions, not two typefaces. */
static GFont font_row_detail(void) {
  return s_font_dot_small ? s_font_dot_small : fonts_get_system_font(FONT_KEY_GOTHIC_14);
}

/* The micro tags — ACT, SYN, R/I/S — take the undoubled cell, the way a real
   panel prints BAT and the day letters far smaller than the reading. */
static GFont font_legend(void) {
  return s_font_dot_small ? s_font_dot_small : fonts_get_system_font(FONT_KEY_GOTHIC_14_BOLD);
}

/* The one deliberate exception to the dot-matrix theme. Reading a full agent
   message is the task where legibility beats styling, and the system face is
   hand-hinted and proportional, so it fits far more words per line. Chrome,
   titles, labels and readouts stay LCD; only the message body is Gothic. */
static GFont font_body(void) {
  return fonts_get_system_font(FONT_KEY_GOTHIC_18);
}

/* -------------------------------------------------------------- utilities */

static bool state_is(const char *state, const char *match) {
  return strcmp(state, match) == 0;
}

static bool state_is_live(const char *state) {
  return state_is(state, "run");
}

/* Both readers check the tuple's declared type before touching the union. A
   dictionary is untrusted input from another process: reading value->cstring
   out of an integer tuple walks off the end of a four-byte entry, and reading
   value->int32 out of an int8 one picks up three bytes of whatever came next.
   PebbleKit JS happens to send int32 today, which is exactly why this was easy
   to miss. */
static void copy_tuple(char *dest, size_t size, DictionaryIterator *iter, uint32_t key) {
  Tuple *tuple = dict_find(iter, key);
  if (!tuple || size == 0 || tuple->type != TUPLE_CSTRING || tuple->length == 0) {
    return;
  }
  size_t limit = size - 1;
  size_t available = (size_t)tuple->length - 1;
  if (available < limit) {
    limit = available;
  }
  strncpy(dest, tuple->value->cstring, limit);
  dest[limit] = '\0';
}

static int int_tuple(DictionaryIterator *iter, uint32_t key, int fallback) {
  Tuple *tuple = dict_find(iter, key);
  if (!tuple) {
    return fallback;
  }
  if (tuple->type == TUPLE_INT) {
    switch (tuple->length) {
      case 1: return tuple->value->int8;
      case 2: return tuple->value->int16;
      case 4: return (int)tuple->value->int32;
      default: return fallback;
    }
  }
  if (tuple->type == TUPLE_UINT) {
    switch (tuple->length) {
      case 1: return tuple->value->uint8;
      case 2: return tuple->value->uint16;
      case 4: return (int)tuple->value->uint32;
      default: return fallback;
    }
  }
  return fallback;
}

static int clamp_int(int value, int min, int max) {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

static bool host_window_visible(void) {
  return s_host_window && window_stack_get_top_window() == s_host_window;
}

static bool thread_window_visible(void) {
  return s_thread_window && window_stack_get_top_window() == s_thread_window;
}

static bool detail_window_visible(void) {
  return s_detail_window && window_stack_get_top_window() == s_detail_window;
}

/* Only the window on top can be seen, so only its layers are worth redrawing.
   menu_layer_reload_data in particular re-runs every cell-height callback, and
   it was doing that for a thread list nobody was looking at on every status
   change. */
static void mark_all_dirty(void) {
  update_host_rail();
  if (host_window_visible() && s_host_layer) {
    layer_mark_dirty(s_host_layer);
  }
  if (thread_window_visible()) {
    if (s_thread_menu) {
      menu_layer_reload_data(s_thread_menu);
    }
    if (s_thread_chrome) {
      layer_mark_dirty(s_thread_chrome);
    }
  }
  if (detail_window_visible() && s_detail_header_layer) {
    layer_mark_dirty(s_detail_header_layer);
  }
}

static void set_status(const char *text) {
  strncpy(s_status_text, text, sizeof(s_status_text) - 1);
  s_status_text[sizeof(s_status_text) - 1] = '\0';
  mark_all_dirty();
}

/* Split from any_live_row because the thread list is the expensive redraw:
   a running thread on some other machine is a reason to keep the host pulse
   going, but not a reason to repaint every visible row. */
static bool any_live_session(void) {
  for (int i = 0; i < s_session_count; i++) {
    if (state_is_live(s_sessions[i].state)) {
      return true;
    }
  }
  return false;
}

/* The home screen is the one that gets left open for hours, so at rest it
   animates nothing at all and registers no timer: a machine working somewhere
   else is a fact, not an event, and a static mark says it just as well as a
   pulsing one. The thread list is a surface you are actively looking at rather
   than one you park on, so a running row there still breathes.

   Anything with a request in flight animates on either screen, because that is
   feedback rather than decoration, and it is over in seconds. */
static bool animation_active(void) {
  if (busy_any()) {
    return true;
  }
  if (thread_window_visible()) {
    return any_live_session();
  }
  return false;
}

/* The app is only worth animating while it is actually on the glass. A
   notification overlay or the modal dictation UI takes the screen without
   unloading the window, and the timer used to keep running underneath. */
static bool s_focused = true;

static void stream_timer_callback(void *context) {
  s_stream_timer = NULL;
  bool busy = busy_any();
  s_stream_phase = (s_stream_phase + (busy ? 1 : IDLE_TICK_STEP)) % 240;

  if (host_window_visible() && busy) {
    /* Only the rail moves during a refresh -- the counts, the headline and the
       legend are settled until the reply lands. So the sweep gets a 200x6 strip
       of its own and the panel underneath is left alone. A sleeping laptop
       costs the full 8s probe timeout, which used to be 72 repaints of the
       whole screen for an animation six pixels tall.

       The connecting counter also updates here, but the full panel is dirtied
       only when its displayed second changes. */
    if (s_host_rail_layer) {
      layer_mark_dirty(s_host_rail_layer);
    }
    if (!s_hosts_synced && s_host_layer) {
      int second = connecting_elapsed_seconds();
      if (second != s_connect_draw_second) {
        s_connect_draw_second = second;
        layer_mark_dirty(s_host_layer);
      }
    }
  }
  if (thread_window_visible()) {
    if (busy && s_thread_chrome) {
      layer_mark_dirty(s_thread_chrome);
    }
    /* Repainting the list is the expensive one, so it only happens when a row
       on it is actually animating -- ghost rows while loading, or a pulse on a
       thread that is running here. A thread running on another machine keeps
       the timer alive for the host screen, not for this one. */
    if (s_thread_menu && (busy || any_live_session())) {
      layer_mark_dirty(menu_layer_get_layer(s_thread_menu));
    }
  }
  if (busy && s_diag_layer && window_stack_get_top_window() == s_diag_window) {
    layer_mark_dirty(s_diag_layer);
  }
  if (detail_window_visible()) {
    if (s_detail_header_layer) {
      layer_mark_dirty(s_detail_header_layer);
    }
    if (s_detail_layer && busy_is(BusyContext | BusyDetail)) {
      layer_mark_dirty(s_detail_layer);
    }
  }
  update_stream_timer();
}

static void update_stream_timer(void) {
  if (!animation_active() || !s_focused) {
    if (s_stream_timer) {
      app_timer_cancel(s_stream_timer);
      s_stream_timer = NULL;
    }
    return;
  }
  uint32_t interval = busy_any() ? BUSY_TICK_MS : IDLE_TICK_MS;
  /* Rescheduling in place rather than cancel-and-register keeps a rate change
     from dropping a frame mid-sweep. The handle goes stale once the timer has
     fired, which reschedule reports rather than crashing on. */
  if (s_stream_timer && app_timer_reschedule(s_stream_timer, interval)) {
    return;
  }
  s_stream_timer = app_timer_register(interval, stream_timer_callback, NULL);
}

/* Both go through update_host_rail: the sweep strip is shown exactly while
   something is in flight, and hidden the rest of the time. */
static void busy_set(int flags) {
  s_busy |= flags;
  update_host_rail();
  update_stream_timer();
}

static void busy_clear(int flags) {
  s_busy &= ~flags;
  update_host_rail();
  update_stream_timer();
}

static void refresh_timer_callback(void *context) {
  s_refresh_timer = NULL;
  request_refresh();
}

static void schedule_refresh(uint32_t delay_ms) {
  if (s_refresh_timer) {
    app_timer_cancel(s_refresh_timer);
  }
  s_refresh_timer = app_timer_register(delay_ms, refresh_timer_callback, NULL);
}

/* Every failure lands here. The two error paths used to clear a different
   subset of the loading flags each, and neither re-armed the refresh timer --
   so one dropped message left the app with a stale list, possibly a stuck
   spinner, and no intention of ever asking again. */
static void enter_error_state(const char *text) {
  s_busy = 0;
  /* Synced means "we have something to draw", not "it is fresh". A failure
     still has to release the connecting screen or the fault is invisible. */
  s_hosts_synced = true;
  s_threads_synced = true;
  log_error(text);
  set_status(text);
  update_detail_text();
  update_stream_timer();
  schedule_refresh(RETRY_INTERVAL_MS);
}

/* -------------------------------------------------- reference primitives */

/* Pebble draws text from the top of the layout box, which sits above the cap
   height by the font's internal leading — so hand-tuned negative offsets were
   guesses that only held for one font at one size. These measure the glyph box
   and place it exactly, which is what makes the result repeatable. */
typedef struct {
  int top;   /* rows between the layout box top and the first inked row */
  int height; /* inked rows for upper-case text */
} InkBox;

/* Exact by construction from the 6x10 cell: caps occupy 7 of the 10 rows from
   row 1, doubled to 14 of 20 from row 2. */
static const InkBox INK_TECH_16 = { 1, 7 };
static const InkBox INK_TECH_20 = { 2, 14 };

static InkBox ink_for(GFont font) {
  return font == s_font_dot ? INK_TECH_20 : INK_TECH_16;
}

/* Line spacing for the undoubled cell: 10 rows plus 2 of leading. */
#define BODY_LINE 12

/* Places text so its inked rows are centred in `box`. */
static int ink_origin_y(GRect box, GFont font) {
  InkBox ink = ink_for(font);
  return box.origin.y + (box.size.h - ink.height) / 2 - ink.top;
}

static GSize measure(const char *text, GFont font) {
  return graphics_text_layout_get_content_size(text, font, GRect(0, 0, SCREEN_W, SCREEN_H),
                                               GTextOverflowModeTrailingEllipsis,
                                               GTextAlignmentLeft);
}

/* Draws `text` vertically centred inside `box`, left-aligned at box.x. */
static void draw_text_v(GContext *ctx, const char *text, GFont font, GRect box,
                        GTextAlignment align) {
  GSize size = measure(text, font);
  int y = box.origin.y + (box.size.h - size.h) / 2;
  graphics_draw_text(ctx, text, font, GRect(box.origin.x, y, box.size.w, size.h + 2),
                     GTextOverflowModeTrailingEllipsis, align, NULL);
}


/* One 1-bit tile does the LCD texture work, blitted rather than drawn pixel by
   pixel: a hatch that knocks unlit segments back so they read as texture
   instead of competing with the lit ones. Built once at launch.

   A second tile stippled the whole substrate for panel grain. It competed with
   every glyph and read as dirt, so it was cut -- the reference substrate is
   smooth and gets its LCD character from the unlit segments instead. */
static void lcd_tiles_create(void) {
  s_hatch_palette[0] = GColorClear;
  s_hatch_palette[1] = lcd_glass();
  s_hatch = gbitmap_create_blank_with_palette(GSize(8, 8), GBitmapFormat1BitPalette,
                                              s_hatch_palette, false);
  if (s_hatch) {
    uint8_t *data = gbitmap_get_data(s_hatch);
    uint16_t stride = gbitmap_get_bytes_per_row(s_hatch);
    for (int y = 0; y < 8; y++) {
      /* 75% coverage: one ghost pixel in four survives. */
      data[y * stride] = (y % 2 == 0) ? 0xAA : 0xFF;
    }
  }

}

static void lcd_tiles_destroy(void) {
  if (s_hatch) {
    gbitmap_destroy(s_hatch);
    s_hatch = NULL;
  }
}

static void hatch_rect(GContext *ctx, GRect r) {
  if (!s_hatch) {
    return;
  }
  graphics_context_set_compositing_mode(ctx, GCompOpSet);
  graphics_draw_bitmap_in_rect(ctx, s_hatch, r);
}

/* The glass sits below the chassis face, so it carries a shadow along the top
   and left inside edges and catches light along the bottom and right. */
static void draw_panel_bevel(GContext *ctx, GRect panel) {
  graphics_context_set_stroke_color(ctx, lcd_dim());
  graphics_draw_line(ctx, GPoint(panel.origin.x + 2, panel.origin.y + 1),
                     GPoint(panel.origin.x + panel.size.w - 3, panel.origin.y + 1));
  graphics_draw_line(ctx, GPoint(panel.origin.x + 1, panel.origin.y + 2),
                     GPoint(panel.origin.x + 1, panel.origin.y + panel.size.h - 3));
  graphics_context_set_stroke_color(ctx, GColorWhite);
  graphics_draw_line(ctx, GPoint(panel.origin.x + 2, panel.origin.y + panel.size.h - 2),
                     GPoint(panel.origin.x + panel.size.w - 3, panel.origin.y + panel.size.h - 2));
  graphics_draw_line(ctx, GPoint(panel.origin.x + panel.size.w - 2, panel.origin.y + 2),
                     GPoint(panel.origin.x + panel.size.w - 2, panel.origin.y + panel.size.h - 3));
}

/* Labels are drawn as whole strings.

   These used to render glyph by glyph to fake letter-spacing, stepping by each
   character's measured width. That was the cause of the uneven, clipped text:
   every glyph was re-positioned and re-clipped into its own box, so stems were
   cut and the pitch wandered. Share Tech Mono is already a fixed-pitch
   technical face — it does not need faked tracking, and one draw call per
   string is both correct and cheaper. A `tracking` argument survived the
   change for a while, ignored at every one of its call sites; it is gone. */
static int tracked_width(const char *text, GFont font) {
  return measure(text, font).w;
}

static void draw_tracked_max(GContext *ctx, const char *text, GFont font, GPoint origin,
                             int max_w) {
  GSize size = measure(text, font);
  int w = max_w > 0 ? max_w : size.w + 2;
  graphics_draw_text(ctx, text, font, GRect(origin.x, origin.y, w, size.h + 2),
                     GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);
}

static void draw_tracked(GContext *ctx, const char *text, GFont font, GPoint origin) {
  draw_tracked_max(ctx, text, font, origin, 0);
}

/* The crimson rails bracket the glass and taper toward the buttons, the way
   the reference marks LIGHT / UP ENTER / DOWN. */
static void draw_rail(GContext *ctx, GRect bounds, int y, bool point_up) {
  graphics_context_set_fill_color(ctx, rule_color());
  graphics_fill_rect(ctx, GRect(7, y, bounds.size.w - 14, RAIL_HEIGHT), 0, GCornerNone);
  for (int i = 0; i < 4; i++) {
    int dy = point_up ? -i : i;
    graphics_fill_rect(ctx, GRect(7 - i - 1, y + dy, 1, RAIL_HEIGHT), 0, GCornerNone);
    graphics_fill_rect(ctx, GRect(bounds.size.w - 7 + i, y + dy, 1, RAIL_HEIGHT), 0, GCornerNone);
  }
}

/* Segment digits come from DSEG7, drawn the way a real panel works: the full
   "88" is laid down in the ghost tone first, the hatch knocks it back, then
   the live value goes on top. Nothing shifts when a digit is blank, because
   DSEG is fixed-width and the unlit segments stay put.

   Every segment draw asks for GTextOverflowModeFill rather than the trailing
   ellipsis used everywhere else. DSEG7 is subset to "[0-9:]", so it carries no
   U+2026, and asking the layout for an ellipsis in a font that has none hangs
   the firmware outright -- it never returns and the watch stops answering the
   protocol. Fill is also what these readouts want: each one is a fixed-width
   value drawn into a box measured from itself, so it can never overflow. */
static GSize seg_text_size(const char *text, GFont font) {
  return graphics_text_layout_get_content_size(text, font, GRect(0, 0, 160, 80),
                                               GTextOverflowModeFill,
                                               GTextAlignmentLeft);
}

/* Every readout on the glass is two digits against an "88" ghost, and DSEG is
   fixed-pitch, so both metrics are constants. They used to be laid out inside
   the draw call -- two full text-layout passes per readout, four readouts on
   the host screen, on every frame of a 9 Hz loop. Measured once at launch
   instead; a digit's advance is all that is needed to right-align the value. */
static GFont seg_font(SegSize size) {
  return size == SegBig ? s_font_dseg_big : s_font_dseg_mid;
}

static void lcd_metrics_measure(void) {
  GFont mid = seg_font(SegMid), big = seg_font(SegBig);
  s_seg_block[SegMid] = mid ? seg_text_size("88", mid) : GSize(56, 34);
  s_seg_block[SegBig] = big ? seg_text_size("88", big) : GSize(104, 64);
  s_seg_digit[SegMid] = mid ? seg_text_size("8", mid).w : s_seg_block[SegMid].w / 2;
  s_seg_digit[SegBig] = big ? seg_text_size("8", big).w : s_seg_block[SegBig].w / 2;
  s_seg_self_test = big ? seg_text_size("88", big) : GSize(104, 64);
}

static GSize seg_block_size(SegSize size) {
  return s_seg_block[size];
}

/* The ghost is what makes it read as a panel rather than as text: a real LCD
   shows its unlit segments, so every readout is drawn as "88" in the ghost
   tone with the live value lit on top of it. `ghost` is a parameter because an
   inverted band runs the same readout on ink instead of on glass, where the
   pale ghost would be the brightest thing on the screen. */
static void draw_seg_value_ex(GContext *ctx, GPoint at, int value, GColor on, SegSize size,
                              GColor ghost, bool hatched) {
  GFont font = seg_font(size);
  char live[8];
  snprintf(live, sizeof(live), "%d", value);

  if (!font) {
    /* A resource that failed to load must not leave a hole where the reading
       goes: fall back to the label face rather than drawing nothing. */
    graphics_context_set_text_color(ctx, on);
    graphics_draw_text(ctx, live, size == SegBig ? font_row_title() : font_row_detail(),
                       GRect(at.x, at.y, 44, size == SegBig ? 30 : 18),
                       GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);
    return;
  }

  GSize full = seg_block_size(size);
  int live_w = (int)strlen(live) * s_seg_digit[size];

  graphics_context_set_text_color(ctx, ghost);
  graphics_draw_text(ctx, "88", font, GRect(at.x, at.y, full.w + 4, full.h + 4),
                     GTextOverflowModeFill, GTextAlignmentLeft, NULL);
  if (hatched) {
    hatch_rect(ctx, GRect(at.x, at.y, full.w + 2, full.h + 2));
  }

  /* Right-aligned into the ghost so the ones column never moves. */
  graphics_context_set_text_color(ctx, on);
  graphics_draw_text(ctx, live, font,
                     GRect(at.x + full.w - live_w, at.y, live_w + 4, full.h + 4),
                     GTextOverflowModeFill, GTextAlignmentLeft, NULL);
}


/* A BAT-style segmented meter. The reference spends this on battery; here it
   carries how much of the list is behind you, so the band stays useful. */
static void draw_segment_meter(GContext *ctx, GPoint origin, int height, int filled, int total, GColor on) {
  int cells = 6;
  int cell_w = 3;
  int gap = 2;
  if (total < 1) {
    total = 1;
  }
  int lit = (filled * cells) / total;
  if (lit < 1 && filled > 0) {
    lit = 1;
  }
  for (int i = 0; i < cells; i++) {
    graphics_context_set_fill_color(ctx, i < lit ? on : lcd_dim());
    graphics_fill_rect(ctx, GRect(origin.x + i * (cell_w + gap), origin.y, cell_w, height), 0, GCornerNone);
  }
}

/* The day strip, reused as a host strip: one square per configured machine,
   the one in view filled in. */
static void draw_host_strip(GContext *ctx, GPoint origin, int count, int current, GColor on) {
  int cell = 5;
  int gap = 3;
  for (int i = 0; i < count && i < MAX_HOSTS; i++) {
    GRect mark = GRect(origin.x + i * (cell + gap), origin.y, cell, cell);
    graphics_context_set_stroke_color(ctx, on);
    graphics_context_set_fill_color(ctx, on);
    if (i == current) {
      graphics_fill_rect(ctx, mark, 0, GCornerNone);
    } else {
      graphics_draw_rect(ctx, mark);
    }
  }
}

/* The inset glass: a black chassis margin, a dim outline, then the panel. */
static GRect draw_panel(GContext *ctx, GRect bounds) {
  graphics_context_set_fill_color(ctx, chassis());
  graphics_fill_rect(ctx, bounds, 0, GCornerNone);

  GRect panel = GRect(PANEL_INSET, TOP_CHROME,
                      bounds.size.w - 2 * PANEL_INSET,
                      bounds.size.h - TOP_CHROME - BOTTOM_CHROME);
  graphics_context_set_fill_color(ctx, lcd_glass());
  graphics_fill_rect(ctx, panel, 2, GCornersAll);
  graphics_context_set_stroke_color(ctx, lcd_dim());
  graphics_draw_round_rect(ctx, panel, 2);
  draw_panel_bevel(ctx, panel);
  return panel;
}

/* A boxed sub-field, like the outlined complication on the reference. */
static void draw_field_box(GContext *ctx, GRect box) {
  graphics_context_set_stroke_color(ctx, lcd_dim());
  graphics_draw_round_rect(ctx, box, 2);
}

static void draw_legend_band(GContext *ctx, GRect bounds, const char *left, const char *right) {
  /* Right-hand fields are laid out first and the left label is bounded by what
     remains, so a long name can never run under the counters. */
  int right_edge = bounds.size.w - GLASS_PAD;
  int band_y = ink_origin_y(GRect(0, 0, 0, LEGEND_HEIGHT), font_legend());
  char tail[24];

  if (s_error_total > 0) {
    snprintf(tail, sizeof(tail), "ERR%d", s_error_total);
    int ew = tracked_width(tail, font_legend());
    graphics_context_set_text_color(ctx, rule_color());
    draw_tracked(ctx, tail, font_legend(), GPoint(right_edge - ew, band_y));
    right_edge -= ew + 6;
  }
  if (right && right[0]) {
    int w = tracked_width(right, font_legend());
    graphics_context_set_text_color(ctx, legend());
    draw_tracked(ctx, right, font_legend(), GPoint(right_edge - w, band_y));
    right_edge -= w + 6;
  }
  if (left && left[0]) {
    graphics_context_set_text_color(ctx, legend());
    draw_tracked_max(ctx, left, font_legend(), GPoint(GLASS_PAD, band_y), right_edge - GLASS_PAD);
  }
}

/* The bottom band: normally a legend, but a live fault takes it over in
   crimson the way MONITOR does on the reference. */
static void draw_bottom_band(GContext *ctx, GRect bounds, const char *left, const char *right) {
  GRect band = GRect(GLASS_PAD, bounds.size.h - BOTTOM_CHROME + RAIL_HEIGHT,
                     bounds.size.w - 2 * GLASS_PAD, LEGEND_HEIGHT - RAIL_HEIGHT);
  int y = ink_origin_y(band, font_legend());
  if (s_error_active && s_error_log_count > 0) {
    graphics_context_set_text_color(ctx, rule_color());
    draw_tracked(ctx, "ERR", font_legend(), GPoint(band.origin.x, y));
    int lead = tracked_width("ERR", font_legend()) + 6;
    graphics_context_set_text_color(ctx, legend());
    draw_text_v(ctx, s_error_log[0], font_row_detail(),
                GRect(band.origin.x + lead, band.origin.y, band.size.w - lead, band.size.h),
                GTextAlignmentLeft);
    return;
  }
  graphics_context_set_text_color(ctx, legend());
  if (left && left[0]) {
    draw_tracked(ctx, left, font_legend(), GPoint(band.origin.x, y));
  }
  if (right && right[0]) {
    int w = tracked_width(right, font_legend());
    draw_tracked(ctx, right, font_legend(), GPoint(band.origin.x + band.size.w - w, y));
  }
}

/* The rail turns into the progress indicator while the phone is working, so
   nothing extra has to appear on screen. */
static void draw_busy_rail(GContext *ctx, GRect bounds, int y) {
  graphics_context_set_fill_color(ctx, chassis());
  graphics_fill_rect(ctx, GRect(0, y - 4, bounds.size.w, RAIL_HEIGHT + 4), 0, GCornerNone);
  int span = bounds.size.w - 14;
  int phase = s_stream_phase % 40;
  int t = phase < 20 ? phase : 40 - phase;
  int eased = (t * t * (60 - 2 * t)) / 4000;
  int width = span / 3;
  int x = 7 + (eased * (span - width)) / 100;
  graphics_context_set_fill_color(ctx, rule_color());
  graphics_fill_rect(ctx, GRect(x, y, width, RAIL_HEIGHT), 0, GCornerNone);
}

/* Micro caption, the size the reference uses for BAT and the day letters. */
static void draw_caption(GContext *ctx, const char *text, GPoint at, GColor color) {
  graphics_context_set_text_color(ctx, color);
  draw_tracked(ctx, text, fonts_get_system_font(FONT_KEY_GOTHIC_14), at);
}

static void sync_age_text(char *out, size_t size) {
  if (s_last_sync == 0) {
    snprintf(out, size, "--");
    return;
  }
  /* A clock that jumped backwards, or an s_last_sync from a previous boot,
     makes this negative or enormous. The field is a two-or-three character
     readout either way, so the value is clamped to what can be drawn rather
     than left to truncate mid-number. */
  int secs = (int)(time(NULL) - s_last_sync);
  if (secs < 0) {
    secs = 0;
  }
  /* Minute granularity, because nothing redraws this more often than that.
     A live second count needs a timer running purely to animate a caption,
     which is the cost this screen exists to avoid. */
  if (secs < 60) {
    snprintf(out, size, "now");
  } else if (secs < 3600) {
    snprintf(out, size, "%dm", secs / 60);
  } else {
    snprintf(out, size, "%dh", clamp_int(secs / 3600, 0, 999));
  }
}

/* The host screen doubles as the surface left open all day. Its clock rides
   the MINUTE_UNIT tick already used by sync age, so it adds neither a timer nor
   an idle animation. Reserve the same live fields as draw_legend_band before
   centring it, so a host counter or fault count can never run through it. */
static void draw_host_clock(GContext *ctx, GRect bounds, const char *right) {
  time_t now = time(NULL);
  struct tm *local = localtime(&now);
  if (!local) {
    return;
  }

  char text[8];
  strftime(text, sizeof(text), clock_is_24h_style() ? "%H:%M" : "%I:%M", local);
  if (!clock_is_24h_style() && text[0] == '0') {
    memmove(text, text + 1, strlen(text));
  }

  int left_edge = GLASS_PAD + tracked_width("P3", font_legend()) + 6;
  int right_edge = bounds.size.w - GLASS_PAD;
  if (s_error_total > 0) {
    char fault[24];
    snprintf(fault, sizeof(fault), "ERR%d", s_error_total);
    right_edge -= tracked_width(fault, font_legend()) + 6;
  }
  if (right && right[0]) {
    right_edge -= tracked_width(right, font_legend()) + 6;
  }

  int width = tracked_width(text, font_legend());
  if (right_edge - left_edge < width) {
    return;
  }
  int x = (bounds.size.w - width) / 2;
  x = clamp_int(x, left_edge, right_edge - width);
  int y = ink_origin_y(GRect(0, 0, 0, LEGEND_HEIGHT), font_legend());
  graphics_context_set_text_color(ctx, legend());
  draw_tracked(ctx, text, font_legend(), GPoint(x, y));
}

/* ------------------------------------------------------------ state marks */

static GColor state_color(const char *state) {
  if (state_is(state, "needs") || state_is(state, "err") || state_is(state, "offline")) {
    return alert_color();
  }
  if (state_is(state, "run")) {
    return active_color();
  }
  if (state_is(state, "monitor")) {
    return monitoring_color();
  }
  if (state_is(state, "settled") || state_is(state, "snooze") || state_is(state, "empty")) {
    return lcd_dim();
  }
  return lcd_ink();
}

static const char *state_word(const char *state) {
  if (state_is(state, "needs")) return "NEEDS YOU";
  if (state_is(state, "run")) return "RUNNING";
  if (state_is(state, "monitor")) return "MONITORING";
  if (state_is(state, "err")) return "ERROR";
  if (state_is(state, "idle")) return "IDLE";
  if (state_is(state, "settled")) return "ALL SETTLED";
  if (state_is(state, "snooze")) return "SNOOZED";
  if (state_is(state, "offline")) return "NO REPLY";
  return "NO THREADS";
}


/* A square block, not a dot: the reference marks its day strip and battery in
   squares, and shape (filled / hollow / struck) carries the state on the
   monochrome watches where colour cannot. */
/* `animated` is false wherever the screen has to be free to sit still. Running
   is already carried by colour and by the filled shape; the breathing is a
   flourish, and on the home screen a flourish costs a timer that never stops. */
static void draw_state_mark(GContext *ctx, GRect box, const char *state, bool inverted,
                            bool animated) {
  GColor ink = inverted ? lcd_glass() : state_color(state);
  bool hollow = state_is(state, "settled") || state_is(state, "snooze") ||
                state_is(state, "empty") || state_is(state, "offline");

  GRect mark = box;
  if (animated && state_is(state, "run")) {
    int phase = (s_stream_phase / 4) % 8;
    int grow = phase < 4 ? phase : 8 - phase;
    mark = GRect(box.origin.x - grow / 2, box.origin.y - grow / 2,
                 box.size.w + grow, box.size.h + grow);
  }

  graphics_context_set_fill_color(ctx, ink);
  graphics_context_set_stroke_color(ctx, ink);
  if (hollow) {
    graphics_draw_rect(ctx, mark);
    if (state_is(state, "snooze")) {
      graphics_fill_rect(ctx, GRect(mark.origin.x + 2, mark.origin.y + mark.size.h / 2,
                                    mark.size.w - 4, 1), 0, GCornerNone);
    }
  } else {
    graphics_fill_rect(ctx, mark, 0, GCornerNone);
    if (state_is(state, "err")) {
      graphics_context_set_stroke_color(ctx, inverted ? lcd_ink() : lcd_glass());
      graphics_draw_line(ctx, GPoint(mark.origin.x + 1, mark.origin.y + 1),
                         GPoint(mark.origin.x + mark.size.w - 2, mark.origin.y + mark.size.h - 2));
      graphics_draw_line(ctx, GPoint(mark.origin.x + mark.size.w - 2, mark.origin.y + 1),
                         GPoint(mark.origin.x + 1, mark.origin.y + mark.size.h - 2));
    }
  }
}

/* ------------------------------------------------------------ host screen */

/* The home screen is an instrument, not a list: one big segment readout for
   the number that matters on this machine, a boxed field carrying the other
   three counts, and the host strip along the bottom. UP/DOWN steps machines
   the way a mode button steps a watch. */

/* The strip the progress sweep owns while a refresh is in flight. Covers the
   static rail's tapered ends as well as the bar itself, so the two never show
   through each other. */
static GRect host_rail_box(void) {
  /* Exactly the band draw_busy_rail paints: four rows above the rail, which is
     what covers the static rail's upward taper, plus the rail itself. */
  return GRect(0, LEGEND_HEIGHT - 4, SCREEN_W, RAIL_HEIGHT + 4);
}

static void update_host_rail(void) {
  if (!s_host_rail_layer) {
    return;
  }
  /* layer_set_hidden marks the parent dirty, so setting it to what it already
     is would schedule a full-panel repaint on every status change. */
  bool hidden = !busy_any();
  if (layer_get_hidden(s_host_rail_layer) != hidden) {
    layer_set_hidden(s_host_rail_layer, hidden);
  }
}

static void host_rail_update_proc(Layer *layer, GContext *ctx) {
  s_frame_count++;
  /* Drawn in the strip's own coordinates, so the sweep's y is the offset of
     the rail within the box rather than its position on the screen. */
  draw_busy_rail(ctx, layer_get_bounds(layer), 4);
}

static void draw_self_test(GContext *ctx, GRect panel, const char *title, const char *hint) {
  /* Nothing to show is still a working instrument: the glass runs its
     all-segments test, which is what a real one does with no data. */
  GFont font = s_font_dseg_big;
  int y = panel.origin.y + 10;
  if (font) {
    GSize full = s_seg_self_test;
    int x = panel.origin.x + (panel.size.w - full.w) / 2;
    graphics_context_set_text_color(ctx, lcd_ghost_tone());
    graphics_draw_text(ctx, "88", font, GRect(x, y, full.w + 4, full.h + 4),
                       GTextOverflowModeFill, GTextAlignmentLeft, NULL);
    hatch_rect(ctx, GRect(x, y, full.w + 2, full.h + 2));

    /* A stationary elapsed timer makes a slow host legible without sending a
       digit walking out of the LCD field. It rides the existing busy timer;
       stream_timer_callback limits full-panel redraws to one per second. */
    if (!s_hosts_synced) {
      int elapsed = connecting_elapsed_seconds();
      char counter[3];
      snprintf(counter, sizeof(counter), "%02d", elapsed);
      s_connect_draw_second = elapsed;
      graphics_context_set_text_color(ctx, lcd_ink());
      graphics_draw_text(ctx, counter, font, GRect(x, y, full.w + 4, full.h + 4),
                         GTextOverflowModeFill, GTextAlignmentLeft, NULL);
    }
    y += full.h + 4;
  } else {
    y += 34;
  }

  graphics_context_set_fill_color(ctx, lcd_dim());
  graphics_fill_rect(ctx, GRect(panel.origin.x + 8, y, panel.size.w - 16, 1), 0, GCornerNone);

  graphics_context_set_text_color(ctx, lcd_ink());
  int tw = tracked_width(title, font_legend());
  draw_tracked(ctx, title, font_legend(), GPoint(panel.origin.x + (panel.size.w - tw) / 2, y + 3));

  graphics_context_set_text_color(ctx, lcd_ink());
  graphics_draw_text(ctx, hint, font_row_detail(),
                     GRect(panel.origin.x + 6, y + 20, panel.size.w - 12, 34),
                     GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);

  char age[12];
  sync_age_text(age, sizeof(age));
  char foot[28];
  snprintf(foot, sizeof(foot), "%s  SYN %s", BUILD_LABEL, age);
  int fw = tracked_width(foot, font_row_detail());
  draw_caption(ctx, foot, GPoint(panel.origin.x + (panel.size.w - fw) / 2,
                                 panel.origin.y + panel.size.h - 17), lcd_ink());
}

/* One channel of the home screen, drawn as a Casio sub-display: a boxed field
   holding a segment readout, the state it counts, and a 14-square roster.
   Three stacked is the whole screen.

   They are deliberately the same size. Which state matters is a property of
   the machine right now, not of the layout. Needs-you uses the Casio alert red
   on the same LCD field as its neighbours, without a black inversion. */
static void draw_state_band(GContext *ctx, GRect band, const char *state, const char *label,
                            int count, int first_count, int second_count,
                            const char *second_state) {
  GColor ink = count > 0 ? state_color(state) : lcd_dim();
  GColor unlit = lcd_ghost_tone();

  draw_field_box(ctx, band);

  GSize block = seg_block_size(SegMid);
  int pad = 5;
  int seg_x = band.origin.x + pad;
  draw_seg_value_ex(ctx, GPoint(seg_x, band.origin.y + (band.size.h - block.h) / 2),
                    clamp_int(count, 0, 99), ink, SegMid, unlit, true);

  int text_x = seg_x + block.w + 8;
  int text_w = band.origin.x + band.size.w - pad - text_x;

  graphics_context_set_text_color(ctx, ink);
  draw_tracked_max(ctx, label, font_legend(), GPoint(text_x, band.origin.y + 7), text_w);

  /* This is a capped roster, not a percentage bar: one square is one thread
     through 14, and 14+ fills the strip. The large segment readout remains
     exact. Fixed 5px cells keep these looking like the chunky squares from
     the original dashboard. The second colour lets running and monitoring coexist. */
  const int slots = 14;
  const int cell = 5;
  const int gap = 2;
  const int meter_w = slots * cell + (slots - 1) * gap;
  int meter_x = text_x + (text_w - meter_w) / 2;
  int meter_y = band.origin.y + 25;
  GColor second_ink = second_count > 0 ? state_color(second_state) : ink;
  for (int i = 0; i < slots; i++) {
    GColor square = i < first_count ? ink :
                    (i < first_count + second_count ? second_ink : unlit);
    graphics_context_set_fill_color(ctx, square);
    graphics_fill_rect(ctx,
                       GRect(meter_x + i * (cell + gap), meter_y, cell, cell),
                       0, GCornerNone);
  }
}

static void host_layer_update_proc(Layer *layer, GContext *ctx) {
  s_frame_count++;
  GRect bounds = layer_get_bounds(layer);
  GRect panel = draw_panel(ctx, bounds);
  bool busy = busy_is(BusyHosts) || !s_hosts_synced;

  char right[20];
  if (busy) {
    snprintf(right, sizeof(right), "SYNC");
  } else if (s_host_count > 0) {
    snprintf(right, sizeof(right), "%d/%d", clamp_int(s_host_cursor + 1, 0, MAX_HOSTS),
             clamp_int(s_host_count, 0, MAX_HOSTS));
  } else {
    snprintf(right, sizeof(right), "--");
  }
  draw_legend_band(ctx, bounds, "P3", right);
  draw_host_clock(ctx, bounds, right);

  /* Always the static rail: s_host_rail_layer sits on top of it and carries the
     sweep while a refresh is in flight, so the panel never has to repaint for
     the animation. */
  draw_rail(ctx, bounds, LEGEND_HEIGHT, true);
  draw_rail(ctx, bounds, bounds.size.h - BOTTOM_CHROME, false);

  if (!s_hosts_synced) {
    draw_self_test(ctx, panel, "CONNECTING", "Reaching the phone bridge");
    return;
  }
  if (s_host_count == 0) {
    if (s_link_down) {
      draw_self_test(ctx, panel, "NO LINK", "Open the T3 app on your phone");
    } else {
      draw_self_test(ctx, panel, "NO HOSTS",
                     s_status_text[0] ? s_status_text : "Add a server in app settings");
    }
    draw_bottom_band(ctx, bounds, "DIAG HOLD", "RETRY");
    return;
  }

  HostItem *host = &s_hosts[clamp_int(s_host_cursor, 0, s_host_count - 1)];
  int inner_x = panel.origin.x + 7;
  int inner_w = panel.size.w - 14;
  int unsettled = host->needs + host->run + host->monitor + host->idle;
  int total = unsettled + host->settled;
  int strip_y = panel.origin.y + panel.size.h - 15;

  /* A host that did not answer has no counts worth reading: the trio would be
     three zeros and the headline a 64pt "0". The readouts are what the reason
     is competing with for the panel, so offline drops them and spends the
     whole glass on why the machine is unreachable. That sentence is the only
     thing here that can be acted on. */
  if (state_is(host->state, "offline")) {
    graphics_context_set_text_color(ctx, lcd_ink());
    graphics_draw_text(ctx, host->title, font_row_title(),
                       GRect(inner_x, panel.origin.y + 2, inner_w, 20),
                       GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);
    graphics_context_set_text_color(ctx, alert_color());
    draw_tracked(ctx, state_word(host->state), font_legend(),
                 GPoint(inner_x, panel.origin.y + 22));

    GRect reason = GRect(inner_x, panel.origin.y + 38, inner_w, strip_y - 22 - (panel.origin.y + 38));
    draw_field_box(ctx, reason);
    graphics_context_set_text_color(ctx, lcd_ink());
    graphics_draw_text(ctx, host->detail[0] ? host->detail : "No answer from this host",
                       fonts_get_system_font(FONT_KEY_GOTHIC_18),
                       grect_inset(reason, GEdgeInsets(4, 5)),
                       GTextOverflowModeWordWrap, GTextAlignmentLeft, NULL);

    draw_caption(ctx, "SELECT TO RETRY", GPoint(inner_x, strip_y - 19), lcd_ink());

    graphics_context_set_fill_color(ctx, lcd_dim());
    graphics_fill_rect(ctx, GRect(inner_x, strip_y - 5, inner_w, 1), 0, GCornerNone);
    char offline_age[12];
    sync_age_text(offline_age, sizeof(offline_age));
    char offline_sync[20];
    snprintf(offline_sync, sizeof(offline_sync), "SYN %s", offline_age);
    draw_caption(ctx, offline_sync, GPoint(inner_x, strip_y - 4), lcd_ink());
    draw_host_strip(ctx, GPoint(panel.origin.x + panel.size.w - 8 - s_host_count * 8, strip_y + 1),
                    s_host_count, s_host_cursor, glass_accent());
    draw_bottom_band(ctx, bounds, "HOST", "RETRY");
    return;
  }

  /* The machine, with what it holds underneath. Settled sits here rather than
     in the bands below: it is history. Monitoring shares the running band so
     quiet background work remains work while keeping its own green squares. */
  graphics_context_set_text_color(ctx, lcd_ink());
  graphics_draw_text(ctx, host->title, font_row_title(),
                     GRect(inner_x, panel.origin.y + 2, inner_w, 20),
                     GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);
  char sub[36];
  snprintf(sub, sizeof(sub), "%d THREAD%s   %d SETTLED",
           clamp_int(unsettled, 0, 999), unsettled == 1 ? "" : "S",
           clamp_int(host->settled, 0, 999));
  draw_caption(ctx, sub, GPoint(inner_x, panel.origin.y + 19), lcd_ink());

  graphics_context_set_fill_color(ctx, lcd_dim());
  graphics_fill_rect(ctx, GRect(inner_x, panel.origin.y + 36, inner_w, 1), 0, GCornerNone);

  /* Three channels filling the glass. The screen this replaced spent its one
     big readout on whichever state happened to be the headline and squeezed
     the rest into a strip of 18px digits, which left 43 rows of the panel --
     roughly a quarter of it -- empty above the indicator row. */
  int bands_top = panel.origin.y + 40;
  int bands_bottom = strip_y - 7;
  int band_gap = 3;
  int band_h = (bands_bottom - bands_top - 2 * band_gap) / 3;
  int running_count = host->run + host->monitor;
  const char *band_state[3] = { "needs", "run", "idle" };
  const char *band_label[3] = { "NEEDS YOU", "RUNNING", "IDLE" };
  int band_count[3] = { host->needs, running_count, host->idle };
  for (int i = 0; i < 3; i++) {
    int primary_count = i == 1 ? host->run : band_count[i];
    int secondary_count = i == 1 ? host->monitor : 0;
    draw_state_band(ctx, GRect(inner_x, bands_top + i * (band_h + band_gap), inner_w, band_h),
                    band_state[i], band_label[i], band_count[i], primary_count,
                    secondary_count, "monitor");
  }

  /* The indicator row: hairline, meter with its caption, sync age, and the
     day strip carrying which machine is in view. */
  graphics_context_set_fill_color(ctx, lcd_dim());
  graphics_fill_rect(ctx, GRect(inner_x, strip_y - 5, inner_w, 1), 0, GCornerNone);

  draw_caption(ctx, "ACT", GPoint(inner_x, strip_y - 4), lcd_ink());
  draw_segment_meter(ctx, GPoint(inner_x + 24, strip_y + 2), 7, unsettled, total, glass_accent());

  char age[12];
  sync_age_text(age, sizeof(age));
  char sync_line[20];
  snprintf(sync_line, sizeof(sync_line), "SYN %s", age);
  draw_caption(ctx, sync_line, GPoint(inner_x + 62, strip_y - 4), lcd_ink());

  draw_host_strip(ctx, GPoint(panel.origin.x + panel.size.w - 8 - s_host_count * 8, strip_y + 1),
                  s_host_count, s_host_cursor, glass_accent());

  draw_bottom_band(ctx, bounds, "HOST", "OPEN");
}

static void host_step(int delta) {
  if (s_host_count <= 0) {
    return;
  }
  s_host_cursor = (s_host_cursor + delta + s_host_count) % s_host_count;
  layer_mark_dirty(s_host_layer);
}

static void host_up_click(ClickRecognizerRef recognizer, void *context) {
  host_step(-1);
}

static void host_down_click(ClickRecognizerRef recognizer, void *context) {
  host_step(1);
}

static void host_select_click(ClickRecognizerRef recognizer, void *context) {
  if (!s_hosts_synced || s_host_count == 0) {
    request_refresh();
    return;
  }
  /* Opening a host that just failed its probe would sit on the thread list for
     the full request timeout only to fail the same way. The screen offers a
     retry, so select performs one. */
  if (state_is(s_hosts[clamp_int(s_host_cursor, 0, s_host_count - 1)].state, "offline")) {
    request_refresh();
    return;
  }
  open_selected_host();
}

static void host_select_long(ClickRecognizerRef recognizer, void *context) {
  if (s_diag_window) {
    window_stack_push(s_diag_window, true);
  }
}

static void host_click_config(void *context) {
  window_single_click_subscribe(BUTTON_ID_UP, host_up_click);
  window_single_click_subscribe(BUTTON_ID_DOWN, host_down_click);
  window_single_click_subscribe(BUTTON_ID_SELECT, host_select_click);
  window_long_click_subscribe(BUTTON_ID_SELECT, 0, host_select_long, NULL);
}

/* Asks the phone for one page of one scope. The list is cleared first so a
   stale page is never left on the glass while the next one is in flight. */
static void request_host_threads(int scope, int offset) {
  s_scope = scope;
  s_offset = offset < 0 ? 0 : offset;
  s_session_count = 0;
  s_project_count = 0;
  s_footer_count = 0;
  s_threads_synced = false;
  busy_set(BusyThreads);
  update_stream_timer();
  mark_all_dirty();

  DictionaryIterator *iter = NULL;
  if (app_message_outbox_begin(&iter) != APP_MSG_OK || !iter) {
    enter_error_state("Phone link busy");
    return;
  }
  int command = CMD_SELECT_HOST;
  dict_write_int(iter, KEY_CMD, &command, sizeof(command), true);
  dict_write_cstring(iter, KEY_HOST_ID, s_hosts[s_selected_host_index].id);
  dict_write_int(iter, KEY_SCOPE, &s_scope, sizeof(s_scope), true);
  dict_write_int(iter, KEY_OFFSET, &s_offset, sizeof(s_offset), true);
  s_message_out++;
  app_message_outbox_send();
}

static void open_selected_host(void) {
  s_selected_host_index = clamp_int(s_host_cursor, 0, s_host_count - 1);
  window_stack_push(s_thread_window, true);
  /* A host always opens on the work that still wants something. */
  request_host_threads(SCOPE_ACTIVE, 0);
}

/* ------------------------------------------------------------ diagnostics */

/* Held behind the host screen: what the app knows about itself, and the fault
   log in full. Rendered on the same glass as everything else so debugging
   never drops out of the theme. */
static void diag_layer_update_proc(Layer *layer, GContext *ctx) {
  s_frame_count++;
  GRect bounds = layer_get_bounds(layer);
  GRect panel = draw_panel(ctx, bounds);

  char count[16];
  snprintf(count, sizeof(count), "%d", s_error_total);
  draw_legend_band(ctx, bounds, "DIAG", s_error_total > 0 ? "" : count);
  draw_rail(ctx, bounds, LEGEND_HEIGHT, true);
  draw_rail(ctx, bounds, bounds.size.h - BOTTOM_CHROME, false);

  int x = panel.origin.x + 7;
  int w = panel.size.w - 14;
  int y = panel.origin.y + 2;

  char age[12];
  sync_age_text(age, sizeof(age));
  char line[64];

  snprintf(line, sizeof(line), "%s   LINK %s", BUILD_LABEL, s_link_down ? "DOWN" : "OK");
  graphics_context_set_text_color(ctx, lcd_ink());
  draw_tracked(ctx, line, font_legend(), GPoint(x, y));
  y += 15;

  snprintf(line, sizeof(line), "HOSTS %d   THR %d   SYN %s", s_host_count, s_session_count, age);
  draw_caption(ctx, line, GPoint(x, y), lcd_ink());
  y += 13;

  /* The battery instrument. A redraw is the unit of spend here, so frames and
     frames-per-second are what tell you whether an animation change actually
     landed -- in seconds, rather than waiting out a four-hour soak. Charge is
     10% granular, which is enough to fit a drain slope over a long run. */
  BatteryChargeState battery = battery_state_service_peek();
  int uptime = (int)(time(NULL) - s_launched_at);
  int fps_x10 = uptime > 0 ? (int)((s_frame_count * 10) / (uint32_t)uptime) : 0;
  snprintf(line, sizeof(line), "BAT %d%%%s   UP %dm", battery.charge_percent,
           battery.is_charging ? "+" : "", uptime / 60);
  draw_caption(ctx, line, GPoint(x, y), lcd_ink());
  y += 13;

  snprintf(line, sizeof(line), "FRM %lu  %d.%dHz   BT %lu/%lu",
           (unsigned long)s_frame_count, fps_x10 / 10, fps_x10 % 10,
           (unsigned long)s_message_out, (unsigned long)s_message_in);
  draw_caption(ctx, line, GPoint(x, y), lcd_ink());
  y += 14;

  graphics_context_set_fill_color(ctx, lcd_dim());
  graphics_fill_rect(ctx, GRect(x, y, w, 1), 0, GCornerNone);
  y += 4;

  int log_bottom = panel.origin.y + panel.size.h - 4;
  if (s_error_log_count == 0) {
    draw_caption(ctx, "NO FAULTS LOGGED", GPoint(x, y + 4), lcd_ink());
  } else {
    /* Faults wrap now that the whole sentence is kept, so each entry's height
       has to be measured. A fixed pitch drew the second line of one fault over
       the first line of the next, which is how a readable log turns into a
       smear. Three lines is the cap; past that the message is padding. */
    GFont entry_font = fonts_get_system_font(FONT_KEY_GOTHIC_14);
    char oldest_idx[12];
    snprintf(oldest_idx, sizeof(oldest_idx), "%d",
             s_error_total - s_error_log_count + 1);
    char newest_idx[12];
    snprintf(newest_idx, sizeof(newest_idx), "%d", s_error_total);
    int index_w = tracked_width(oldest_idx, font_legend());
    int newest_w = tracked_width(newest_idx, font_legend());
    if (newest_w > index_w) {
      index_w = newest_w;
    }
    int gutter = index_w + 6;
    int text_w = w - gutter;
    for (int i = 0; i < s_error_log_count && y < log_bottom; i++) {
      GSize size = graphics_text_layout_get_content_size(
          s_error_log[i], entry_font, GRect(0, 0, text_w, 48),
          GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft);
      int h = size.h > 0 ? size.h : 16;
      int available = log_bottom - y;
      if (h + 2 > available) {
        h = available - 2;
      }
      if (h <= 0) {
        break;
      }
      char idx[12];
      snprintf(idx, sizeof(idx), "%d", s_error_total - i);
      graphics_context_set_text_color(ctx, alert_color());
      draw_tracked(ctx, idx, font_legend(), GPoint(x, y + 1));
      graphics_context_set_text_color(ctx, lcd_ink());
      graphics_draw_text(ctx, s_error_log[i], entry_font,
                         GRect(x + gutter, y, text_w, h + 2),
                         GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);
      /* The next entry begins below this draw rectangle, not inside its extra
         layout padding. This matters when two wrapped faults are adjacent. */
      y += h + 4;
    }
  }

  draw_bottom_band(ctx, bounds, "FAULTS", "BACK");
}

static void diag_window_load(Window *window) {
  Layer *window_layer = window_get_root_layer(window);
  window_set_background_color(window, chassis());
  s_diag_layer = layer_create(layer_get_bounds(window_layer));
  layer_set_update_proc(s_diag_layer, diag_layer_update_proc);
  layer_add_child(window_layer, s_diag_layer);
}

static void diag_window_unload(Window *window) {
  if (s_diag_layer) {
    layer_destroy(s_diag_layer);
  }
  s_diag_layer = NULL;
}

/* ---------------------------------------------------------- thread screen */

static void draw_ghost_row(GContext *ctx, GRect bounds, int row) {
  int lit = (s_stream_phase / 3) % (GHOST_ROWS + 2);
  GColor tone = (row == lit) ? lcd_ink() : lcd_dim();
  int widths[GHOST_ROWS] = { 74, 96, 62, 84 };
  int width = widths[row % GHOST_ROWS];
  if (width > bounds.size.w - 26) {
    width = bounds.size.w - 26;
  }

  graphics_context_set_fill_color(ctx, lcd_glass());
  graphics_fill_rect(ctx, bounds, 0, GCornerNone);
  graphics_context_set_fill_color(ctx, tone);
  graphics_fill_rect(ctx, GRect(6, bounds.size.h / 2 - 9, 7, 7), 0, GCornerNone);
  graphics_fill_rect(ctx, GRect(19, bounds.size.h / 2 - 9, width, 8), 0, GCornerNone);
  graphics_context_set_fill_color(ctx, lcd_dim());
  graphics_fill_rect(ctx, GRect(19, bounds.size.h / 2 + 3, width / 2, 5), 0, GCornerNone);
}

static void draw_list_row(GContext *ctx, const Layer *cell_layer, bool selected,
                          const char *title, const char *detail, const char *state) {
  GRect bounds = layer_get_bounds(cell_layer);
  graphics_context_set_fill_color(ctx, lcd_glass());
  graphics_fill_rect(ctx, bounds, 0, GCornerNone);

  if (selected) {
    graphics_context_set_stroke_color(ctx, lcd_ink());
    graphics_draw_round_rect(ctx, GRect(3, 3, bounds.size.w - 6, bounds.size.h - 7), 2);
    graphics_context_set_fill_color(ctx, lcd_ink());
    graphics_fill_rect(ctx, GRect(6, bounds.size.h / 2 - 10, 3, 20), 0, GCornerNone);
  }

  draw_state_mark(ctx, GRect(12, bounds.size.h / 2 - 9, 7, 7), state, false, true);

  graphics_context_set_text_color(ctx, lcd_ink());
  graphics_draw_text(ctx, title, font_row_title(),
                     GRect(25, 0, bounds.size.w - 31, 21),
                     GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);

  /* Pebble fonts can paint outside their nominal layout rectangle, so merely
     making the two rectangles disjoint does not guarantee separate ink. Give
     the detail its own lower band, then clear a five-row guard between the
     lines after both draws. That makes overlap impossible even with fallback
     font metrics, without changing the fixed 48px row geometry. */
  graphics_context_set_text_color(ctx, lcd_ink());
  graphics_draw_text(ctx, detail, font_row_detail(),
                     GRect(25, 27, bounds.size.w - 31, 15),
                     GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);
  graphics_context_set_fill_color(ctx, lcd_glass());
  graphics_fill_rect(ctx, GRect(25, 22, bounds.size.w - 31, 5), 0, GCornerNone);

  graphics_context_set_fill_color(ctx, lcd_dim());
  graphics_fill_rect(ctx, GRect(6, bounds.size.h - 1, bounds.size.w - 12, 1), 0, GCornerNone);
}

static void thread_chrome_update_proc(Layer *layer, GContext *ctx) {
  s_frame_count++;
  GRect bounds = layer_get_bounds(layer);
  const char *host = (s_selected_host_index >= 0 && s_selected_host_index < s_host_count)
    ? s_hosts[s_selected_host_index].title : "HOST";
  bool busy = busy_is(BusyThreads) || !s_threads_synced;

  graphics_context_set_fill_color(ctx, chassis());
  graphics_fill_rect(ctx, GRect(0, 0, bounds.size.w, TOP_CHROME), 0, GCornerNone);
  graphics_fill_rect(ctx, GRect(0, bounds.size.h - BOTTOM_CHROME, bounds.size.w, BOTTOM_CHROME), 0, GCornerNone);
  graphics_fill_rect(ctx, GRect(0, TOP_CHROME, PANEL_INSET, bounds.size.h - TOP_CHROME - BOTTOM_CHROME), 0, GCornerNone);
  graphics_fill_rect(ctx, GRect(bounds.size.w - PANEL_INSET, TOP_CHROME, PANEL_INSET,
                                bounds.size.h - TOP_CHROME - BOTTOM_CHROME), 0, GCornerNone);

  char right[20];
  if (busy) {
    snprintf(right, sizeof(right), "SYNC");
  } else {
    snprintf(right, sizeof(right), "%d", s_session_count);
  }
  draw_legend_band(ctx, bounds, host, right);

  if (busy) {
    draw_busy_rail(ctx, bounds, LEGEND_HEIGHT);
  } else {
    draw_rail(ctx, bounds, LEGEND_HEIGHT, true);
  }
  draw_rail(ctx, bounds, bounds.size.h - BOTTOM_CHROME, false);

  int needs = 0, running = 0, monitoring = 0, settled = 0;
  for (int i = 0; i < s_session_count; i++) {
    if (state_is(s_sessions[i].state, "needs")) needs++;
    else if (state_is(s_sessions[i].state, "run")) running++;
    else if (state_is(s_sessions[i].state, "monitor")) monitoring++;
    else if (state_is(s_sessions[i].state, "settled") || state_is(s_sessions[i].state, "snooze")) settled++;
  }
  char tally[24];
  /* Bounded by MAX_SESSIONS in practice, but the band is 24 characters and a
     count that somehow ran away would truncate the row rather than overflow
     into the next field. */
  snprintf(tally, sizeof(tally), "N%d R%d M%d S%d", clamp_int(needs, 0, 999),
           clamp_int(running, 0, 999), clamp_int(monitoring, 0, 999),
           clamp_int(settled, 0, 999));
  draw_bottom_band(ctx, bounds, tally, "");
  if (!s_error_active) {
    draw_host_strip(ctx, GPoint(bounds.size.w - 8 - s_host_count * 8, bounds.size.h - BOTTOM_CHROME + 5),
                    s_host_count, s_selected_host_index, legend());
  }
}

/* Footer rows are derived, never stored by the phone: which ones apply follows
   from the scope and from whether this page is the last one. */
static void rebuild_footers(void) {
  s_footer_count = 0;
  if (!s_threads_synced || busy_is(BusyThreads)) {
    return;
  }
  if (s_scope == SCOPE_ACTIVE) {
    if (s_other > 0) {
      s_footers[s_footer_count++] = FooterScopeSettled;
    }
    return;
  }
  if (s_offset + s_session_count < s_matched) {
    s_footers[s_footer_count++] = FooterMore;
  }
  s_footers[s_footer_count++] = FooterScopeActive;
}

/* Rows in section 0 that are threads rather than footers. The empty list still
   occupies one row, so the footers always sit below something. */
static int thread_body_rows(void) {
  if (!s_threads_synced || busy_is(BusyThreads)) {
    return GHOST_ROWS;
  }
  return s_session_count > 0 ? s_session_count : 1;
}

static void footer_label(FooterKind kind, char *out, size_t out_size) {
  switch (kind) {
    case FooterScopeSettled:
      snprintf(out, out_size, "SETTLED %d", s_other);
      return;
    case FooterScopeActive:
      snprintf(out, out_size, "ACTIVE %d", s_other);
      return;
    case FooterMore:
      snprintf(out, out_size, "MORE %d OF %d",
               s_offset + s_session_count, s_matched);
      return;
  }
  out[0] = '\0';
}

static uint16_t thread_num_sections(MenuLayer *menu_layer, void *data) {
  return 2;
}

static uint16_t thread_num_rows(MenuLayer *menu_layer, uint16_t section_index, void *data) {
  if (section_index == 1) {
    /* One row past the projects is the way to make a new one. */
    return (!s_threads_synced || busy_is(BusyThreads)) ? 0 : s_project_count + 1;
  }
  return thread_body_rows() + s_footer_count;
}

static int16_t thread_header_height(MenuLayer *menu_layer, uint16_t section_index, void *data) {
  if (section_index == 1 && s_threads_synced && s_project_count > 0) {
    return SECTION_HEADER_HEIGHT;
  }
  return 0;
}

static void thread_draw_header(GContext *ctx, const Layer *cell_layer, uint16_t section_index, void *data) {
  if (section_index != 1) {
    return;
  }
  GRect bounds = layer_get_bounds(cell_layer);
  graphics_context_set_fill_color(ctx, lcd_glass());
  graphics_fill_rect(ctx, bounds, 0, GCornerNone);
  graphics_context_set_stroke_color(ctx, lcd_dim());
  graphics_draw_rect(ctx, GRect(4, 2, bounds.size.w - 8, bounds.size.h - 4));
  graphics_context_set_text_color(ctx, lcd_ink());
  draw_tracked(ctx, "START NEW", font_legend(),
               GPoint(GLASS_PAD, ink_origin_y(bounds, font_legend())));
}

static bool thread_list_is_empty(void) {
  return s_threads_synced && !busy_is(BusyThreads) && s_session_count == 0 && s_project_count == 0;
}

static int16_t thread_cell_height(MenuLayer *menu_layer, MenuIndex *cell_index, void *data) {
  if (thread_list_is_empty() && cell_index->section == 0) {
    /* One full-height cell so the glass shows a panel rather than a stray row
       floating in empty space. */
    return s_thread_menu ? layer_get_bounds(menu_layer_get_layer(s_thread_menu)).size.h : ROW_HEIGHT;
  }
  return ROW_HEIGHT;
}

static void thread_draw_row(GContext *ctx, const Layer *cell_layer, MenuIndex *cell_index, void *data) {
  bool selected = menu_layer_is_index_selected(s_thread_menu, cell_index);

  if (cell_index->section == 1) {
    if (cell_index->row == s_project_count) {
      draw_list_row(ctx, cell_layer, selected, "New project", "dictate a name", "empty");
      return;
    }
    if (cell_index->row > s_project_count) {
      return;
    }
    ProjectItem *project = &s_projects[cell_index->row];
    draw_list_row(ctx, cell_layer, selected, project->title, project->directory, "idle");
    return;
  }

  /* Footer rows sit past the threads and lead elsewhere rather than opening
     one, so they are drawn before the thread cases below. */
  int body = thread_body_rows();
  if (s_threads_synced && !busy_is(BusyThreads) && cell_index->row >= body) {
    int footer = cell_index->row - body;
    if (footer < s_footer_count) {
      char label[24];
      footer_label(s_footers[footer], label, sizeof(label));
      draw_list_row(ctx, cell_layer, selected, label,
                    s_footers[footer] == FooterMore ? "next page" : "switch list", "empty");
    }
    return;
  }

  if (!s_threads_synced || busy_is(BusyThreads)) {
    draw_ghost_row(ctx, layer_get_bounds(cell_layer), cell_index->row);
    return;
  }
  if (s_session_count == 0) {
    GRect bounds = layer_get_bounds(cell_layer);
    graphics_context_set_fill_color(ctx, lcd_glass());
    graphics_fill_rect(ctx, bounds, 0, GCornerNone);
    if (thread_list_is_empty()) {
      draw_self_test(ctx, bounds, "NO THREADS", "Nothing open on this machine");
    } else {
      draw_list_row(ctx, cell_layer, selected, "No threads", "start one below", "empty");
    }
    return;
  }
  if (cell_index->row >= s_session_count) {
    return;
  }
  SessionItem *item = &s_sessions[cell_index->row];
  draw_list_row(ctx, cell_layer, selected, item->title, item->detail, item->state);
}

/* Holding the new-project row describes a location instead of naming one: the
   concierge agent works out the path and it comes back to the same confirm. */
static void thread_select_long(MenuLayer *menu_layer, MenuIndex *cell_index, void *data) {
  if (cell_index->section != 1 || !s_threads_synced || busy_is(BusyThreads) ||
      cell_index->row > s_project_count) {
    return;
  }
  if (cell_index->row < s_project_count) {
    s_selected_project_index = cell_index->row;
    open_project_actions();
    return;
  }
  s_dictation_target = DictationTargetConcierge;
  set_status("Describe where");
  start_dictation();
}

static void thread_select(MenuLayer *menu_layer, MenuIndex *cell_index, void *data) {
  if (cell_index->section == 1) {
    if (busy_is(BusyModels)) {
      return;
    }
    if (cell_index->row == s_project_count) {
      s_dictation_target = DictationTargetNewProject;
      set_status("Name the project");
      start_dictation();
      return;
    }
    if (cell_index->row > s_project_count) {
      return;
    }
    s_selected_project_index = cell_index->row;
    s_selected_model_index = -1;
    request_project_models();
    return;
  }

  int body = thread_body_rows();
  if (s_threads_synced && !busy_is(BusyThreads) && cell_index->row >= body) {
    int footer = cell_index->row - body;
    if (footer >= s_footer_count) {
      return;
    }
    switch (s_footers[footer]) {
      case FooterScopeSettled:
        request_host_threads(SCOPE_SETTLED, 0);
        return;
      case FooterScopeActive:
        request_host_threads(SCOPE_ACTIVE, 0);
        return;
      case FooterMore:
        request_host_threads(s_scope, s_offset + s_session_count);
        return;
    }
    return;
  }

  if (!s_threads_synced || s_session_count == 0 || cell_index->row >= s_session_count) {
    return;
  }
  s_selected_index = cell_index->row;
  s_showing_context = false;
  busy_clear(BusyContext);
  s_pending_context_session_id[0] = '\0';
  s_pending_context_request_id[0] = '\0';
  s_full_context[0] = '\0';
  window_stack_push(s_detail_window, true);
  update_detail_text();
  request_detail(s_selected_index, false);
}

/* ----------------------------------------------------------------- outbox */

static void send_command_begin(DictionaryIterator **iter, int command) {
  if (app_message_outbox_begin(iter) != APP_MSG_OK || !*iter) {
    /* Startup still has s_hosts_synced=false and detail requests set their
       busy bit before opening the outbox. Returning here used to leave the
       110ms animation timer running forever with no reply possible. */
    enter_error_state("Phone link busy");
    return;
  }
  dict_write_int(*iter, KEY_CMD, &command, sizeof(command), true);
}

static void request_refresh(void) {
  if (busy_is(BusyHosts)) {
    return;
  }
  /* The host counts are drawn on the home screen and nowhere else. Polling
     while the user is reading a transcript costs the phone one HTTP request
     per host per minute for numbers nobody can see, so the poll is deferred
     until that screen is back on top -- host_window_appear catches up if the
     wait ran past an interval. */
  if (!host_window_visible()) {
    schedule_refresh(REFRESH_INTERVAL_MS);
    return;
  }
  DictionaryIterator *iter = NULL;
  send_command_begin(&iter, CMD_REFRESH);
  if (!iter) {
    return;
  }
  if (!s_hosts_synced) {
    s_host_connect_started_at = time(NULL);
    s_connect_draw_second = -1;
  }
  busy_set(BusyHosts);
  mark_all_dirty();
  update_stream_timer();
  s_message_out++;
  app_message_outbox_send();
}

static void request_detail(int index, bool full_context) {
  if (index < 0 || index >= s_session_count) {
    return;
  }
  s_selected_index = index;
  if (full_context) {
    request_context_page(-1);
    return;
  }
  s_showing_context = false;
  busy_clear(BusyContext);
  busy_set(BusyDetail);
  s_pending_context_session_id[0] = '\0';
  s_pending_context_request_id[0] = '\0';
  s_context_page = 0;
  s_context_page_count = 1;
  s_full_context[0] = '\0';
  update_detail_text();
  update_stream_timer();

  DictionaryIterator *iter = NULL;
  send_command_begin(&iter, CMD_DETAIL);
  if (!iter) {
    return;
  }
  dict_write_int(iter, KEY_INDEX, &index, sizeof(index), true);
  dict_write_cstring(iter, KEY_SESSION_ID, s_sessions[index].id);
  s_message_out++;
  app_message_outbox_send();
}

/* Settle, unsettle and interrupt all name the selected thread and differ only
   in the verb, so they share one message. */
static void send_thread_action(const char *action) {
  if (s_selected_index < 0 || s_selected_index >= s_session_count) {
    return;
  }
  DictionaryIterator *iter = NULL;
  send_command_begin(&iter, CMD_THREAD_ACTION);
  if (!iter) {
    return;
  }
  dict_write_cstring(iter, KEY_SESSION_ID, s_sessions[s_selected_index].id);
  dict_write_cstring(iter, KEY_ACTION, action);
  s_message_out++;
  app_message_outbox_send();
}

static void send_project_create(void) {
  if (!s_pending_project_path[0]) {
    return;
  }
  DictionaryIterator *iter = NULL;
  send_command_begin(&iter, CMD_PROJECT_CREATE);
  if (!iter) {
    return;
  }
  dict_write_cstring(iter, KEY_HOST_ID, s_hosts[s_selected_host_index].id);
  dict_write_cstring(iter, KEY_NAME, s_pending_project_name);
  dict_write_cstring(iter, KEY_PATH, s_pending_project_path);
  s_message_out++;
  app_message_outbox_send();
  s_pending_project_path[0] = '\0';
  s_pending_project_name[0] = '\0';
}

static void send_project_delete(void) {
  if (s_selected_project_index < 0 || s_selected_project_index >= s_project_count) {
    return;
  }
  DictionaryIterator *iter = NULL;
  send_command_begin(&iter, CMD_PROJECT_DELETE);
  if (!iter) {
    return;
  }
  dict_write_cstring(iter, KEY_PROJECT_ID, s_projects[s_selected_project_index].id);
  s_message_out++;
  app_message_outbox_send();
}

/* A dictated name is only a proposal: the phone turns it into an absolute path
   and sends it back for confirmation before anything is created. */
static void send_project_name(const char *name) {
  if (s_selected_host_index < 0 || s_selected_host_index >= s_host_count) {
    return;
  }
  DictionaryIterator *iter = NULL;
  send_command_begin(&iter, CMD_PROJECT_NAME);
  if (!iter) {
    return;
  }
  dict_write_cstring(iter, KEY_HOST_ID, s_hosts[s_selected_host_index].id);
  dict_write_cstring(iter, KEY_NAME, name);
  s_message_out++;
  app_message_outbox_send();
}

/* For when the location is easier described than dictated. An agent in the
   configured project proposes the path; confirmation still happens here. */
static void send_concierge_text(const char *text) {
  if (s_selected_host_index < 0 || s_selected_host_index >= s_host_count) {
    return;
  }
  DictionaryIterator *iter = NULL;
  send_command_begin(&iter, CMD_CONCIERGE);
  if (!iter) {
    return;
  }
  dict_write_cstring(iter, KEY_HOST_ID, s_hosts[s_selected_host_index].id);
  dict_write_cstring(iter, KEY_PROMPT, text);
  s_message_out++;
  app_message_outbox_send();
}

static void request_project_models(void) {
  if (s_selected_project_index < 0 || s_selected_project_index >= s_project_count) {
    return;
  }
  DictionaryIterator *iter = NULL;
  send_command_begin(&iter, CMD_MODEL_REQUEST);
  if (!iter) {
    return;
  }
  dict_write_cstring(iter, KEY_PROJECT_ID, s_projects[s_selected_project_index].id);
  s_model_count = 0;
  busy_set(BusyModels);
  set_status("Loading models");
  update_stream_timer();
  s_message_out++;
  app_message_outbox_send();
}

/* The second parameter is the performed item, not the root level, whatever the
   SDK's doc comment says, so the level to free is carried in the context. */
static void action_menu_closed(ActionMenu *menu, const ActionMenuItem *performed, void *context) {
  action_menu_hierarchy_destroy((const ActionMenuLevel *)context, NULL, NULL);
}

static void perform_action(ActionMenu *menu, const ActionMenuItem *action, void *context) {
  uintptr_t kind = (uintptr_t)action_menu_item_get_action_data(action);
  if (kind >= ActionModelBase && kind < ActionModelBase + MAX_MODELS) {
    int index = (int)(kind - ActionModelBase);
    if (index < s_model_count) {
      s_selected_model_index = index;
      s_dictation_target = DictationTargetProject;
      set_status("Dictate prompt");
      start_dictation();
    }
    return;
  }
  switch ((ActionKind)kind) {
    case ActionReply:
      s_dictation_target = DictationTargetSession;
      start_dictation();
      return;
    case ActionSettle:
      set_status("Settling");
      send_thread_action("settle");
      return;
    case ActionUnsettle:
      set_status("Reopening");
      send_thread_action("unsettle");
      return;
    case ActionInterrupt:
      set_status("Interrupting");
      send_thread_action("interrupt");
      return;
    case ActionCancelProject:
      s_pending_project_path[0] = '\0';
      s_pending_project_name[0] = '\0';
      set_status("Project cancelled");
      return;
    case ActionCreateProject:
      set_status("Creating project");
      send_project_create();
      return;
    case ActionCancelDelete:
      set_status("Delete cancelled");
      return;
    case ActionDeleteProject:
      set_status("Deleting project");
      send_project_delete();
      return;
    case ActionModelBase:
      /* Model actions are the ActionModelBase+i range handled above. Keeping
         the sentinel here makes the enum switch exhaustive under GCC 14. */
      return;
  }
}

static void open_action_menu(ActionMenuLevel *level) {
  ActionMenuConfig config = (ActionMenuConfig) {
    .root_level = level,
    .context = level,
    .colors = { .background = legend(), .foreground = lcd_ink() },
    .did_close = action_menu_closed,
    .align = ActionMenuAlignCenter
  };
  action_menu_open(&config);
}

/* Built per thread so it only ever offers what applies: a settled thread can
   be reopened but not settled again, and vice versa. */
static void open_thread_actions(void) {
  if (s_selected_index < 0 || s_selected_index >= s_session_count) {
    return;
  }
  ActionMenuLevel *level = action_menu_level_create(3);
  if (!level) {
    log_error("Out of memory");
    return;
  }
  action_menu_level_add_action(level, "Reply", perform_action, (void *)(uintptr_t)ActionReply);
  if (s_sessions[s_selected_index].settled) {
    action_menu_level_add_action(level, "Unsettle", perform_action, (void *)(uintptr_t)ActionUnsettle);
  } else {
    action_menu_level_add_action(level, "Settle", perform_action, (void *)(uintptr_t)ActionSettle);
    action_menu_level_add_action(level, "Interrupt", perform_action, (void *)(uintptr_t)ActionInterrupt);
  }
  open_action_menu(level);
}

/* The confirm gate for a dictated project: the phone has resolved a path, and
   nothing is created until this menu is answered. */
static void open_project_confirm(void) {
  ActionMenuLevel *level = action_menu_level_create(2);
  if (!level) {
    log_error("Out of memory");
    return;
  }
  /* Dictation can be wildly wrong. Cancellation is deliberately focused by
     default, so accepting a bad folder takes an explicit Down then Select. */
  action_menu_level_add_action(level, "Cancel", perform_action, (void *)(uintptr_t)ActionCancelProject);
  action_menu_level_add_action(level, "Create", perform_action, (void *)(uintptr_t)ActionCreateProject);
  open_action_menu(level);
}

/* Holding a real project opens its destructive action behind a cancel-first
   menu. Deleting therefore takes a deliberate Down then Select, while a short
   Select keeps its existing new-thread flow. */
static void open_project_actions(void) {
  if (s_selected_project_index < 0 || s_selected_project_index >= s_project_count) {
    return;
  }
  ActionMenuLevel *level = action_menu_level_create(2);
  if (!level) {
    log_error("Out of memory");
    return;
  }
  action_menu_level_add_action(level, "Cancel", perform_action, (void *)(uintptr_t)ActionCancelDelete);
  action_menu_level_add_action(level, "Delete project", perform_action, (void *)(uintptr_t)ActionDeleteProject);
  open_action_menu(level);
}

/* The server default is item zero and therefore focused when the menu opens.
   Labels include the provider for alternatives, while the exact instance id
   and model slug stay in s_models for the command sent after dictation. */
static void open_model_menu(void) {
  if (s_model_count <= 0) {
    enter_error_state("No models available");
    return;
  }
  ActionMenuLevel *level = action_menu_level_create(s_model_count);
  if (!level) {
    enter_error_state("Out of memory");
    return;
  }
  for (int i = 0; i < s_model_count; i++) {
    action_menu_level_add_action(level, s_models[i].label, perform_action,
                                 (void *)(uintptr_t)(ActionModelBase + i));
  }
  open_action_menu(level);
}

static void request_context_page(int page) {
  if (s_selected_index < 0 || s_selected_index >= s_session_count || busy_is(BusyContext)) {
    return;
  }
  if (page < -1) {
    page = 0;
  }
  if (s_context_page_count > 0 && page >= s_context_page_count) {
    page = s_context_page_count - 1;
  }

  s_showing_context = true;
  busy_set(BusyContext);
  s_pending_context_page = page;
  strncpy(s_pending_context_session_id, s_sessions[s_selected_index].id, sizeof(s_pending_context_session_id) - 1);
  s_pending_context_session_id[sizeof(s_pending_context_session_id) - 1] = '\0';
  s_context_request_counter = (s_context_request_counter % 9998) + 1;
  snprintf(s_pending_context_request_id, sizeof(s_pending_context_request_id), "c%d", s_context_request_counter);
  s_full_context[0] = '\0';
  update_detail_text();
  update_stream_timer();

  DictionaryIterator *iter = NULL;
  send_command_begin(&iter, CMD_CONTEXT);
  if (!iter) {
    detail_exit_context(false);
    return;
  }
  dict_write_int(iter, KEY_INDEX, &s_selected_index, sizeof(s_selected_index), true);
  dict_write_int(iter, KEY_CONTEXT_PAGE, &page, sizeof(page), true);
  dict_write_cstring(iter, KEY_SESSION_ID, s_sessions[s_selected_index].id);
  dict_write_cstring(iter, KEY_REQUEST_ID, s_pending_context_request_id);
  s_message_out++;
  app_message_outbox_send();
}

static void send_prompt_text(const char *text) {
  if (s_selected_index < 0 || s_selected_index >= s_session_count || !text || !text[0]) {
    return;
  }
  DictionaryIterator *iter = NULL;
  send_command_begin(&iter, CMD_PROMPT);
  if (!iter) {
    return;
  }
  dict_write_int(iter, KEY_INDEX, &s_selected_index, sizeof(s_selected_index), true);
  dict_write_cstring(iter, KEY_SESSION_ID, s_sessions[s_selected_index].id);
  dict_write_cstring(iter, KEY_REQUEST_ID, s_sessions[s_selected_index].request_id);
  dict_write_cstring(iter, KEY_REQUEST_KIND, s_sessions[s_selected_index].request_kind);
  dict_write_cstring(iter, KEY_PROMPT, text);
  busy_set(BusySending);
  set_status("Sending");
  update_stream_timer();
  s_message_out++;
  app_message_outbox_send();
}

static void send_new_thread_text(const char *text) {
  if (s_selected_project_index < 0 || s_selected_project_index >= s_project_count ||
      s_selected_model_index < 0 || s_selected_model_index >= s_model_count ||
      !text || !text[0]) {
    return;
  }
  DictionaryIterator *iter = NULL;
  send_command_begin(&iter, CMD_NEW_THREAD);
  if (!iter) {
    return;
  }
  dict_write_int(iter, KEY_INDEX, &s_selected_project_index, sizeof(s_selected_project_index), true);
  dict_write_cstring(iter, KEY_PROJECT_ID, s_projects[s_selected_project_index].id);
  dict_write_cstring(iter, KEY_PROMPT, text);
  dict_write_cstring(iter, KEY_INSTANCE_ID, s_models[s_selected_model_index].instance_id);
  dict_write_cstring(iter, KEY_MODEL, s_models[s_selected_model_index].model);
  busy_set(BusySending);
  set_status("Starting");
  update_stream_timer();
  s_message_out++;
  app_message_outbox_send();
}

/* ------------------------------------------------------- transcript pages */

static int role_body_start(const char *block, int block_len) {
  for (int i = 0; i < block_len; i++) {
    if (block[i] == '\n') {
      return i + 1;
    }
  }
  return 0;
}

static void block_role(char *dest, size_t size, const char *block, int block_len) {
  int len = role_body_start(block, block_len);
  if (len > 0) {
    len -= 1;
  }
  if (len <= 0 || len >= (int)size) {
    len = 0;
  }
  if (len > 0) {
    memcpy(dest, block, len);
  }
  dest[len] = '\0';
}

static int next_context_block_len(const char *text, int text_len, int start, int *block_start, int *block_len) {
  int len = text_len;
  while (start < len && text[start] == '\n') {
    start++;
  }
  if (start >= len) {
    return len;
  }
  int end = start;
  while (end < len) {
    if (text[end] == '\n' && end + 1 < len && text[end + 1] == '\n') {
      break;
    }
    end++;
  }
  *block_start = start;
  *block_len = end - start;
  return end + 2;
}

static int text_height(const char *text, GFont font, int width) {
  GSize size = graphics_text_layout_get_content_size(
    text, font, GRect(0, 0, width, 1000), GTextOverflowModeWordWrap, GTextAlignmentLeft);
  return size.h;
}

static int context_card_height(const char *body, int width) {
  int body_h = text_height(body, font_body(), width - 20);
  return clamp_int(20 + body_h + 10, 52, 260);
}

static int context_content_height(int width) {
  if (!s_full_context[0] || busy_is(BusyContext)) {
    return DETAIL_CONTENT_MIN_HEIGHT;
  }
  int y = CARD_PAD;
  int pos = 0;
  int block_start = 0;
  int block_len = 0;
  int context_len = strlen(s_full_context);
  while (pos < context_len) {
    pos = next_context_block_len(s_full_context, context_len, pos, &block_start, &block_len);
    if (block_len <= 0) {
      continue;
    }
    int body_start = role_body_start(s_full_context + block_start, block_len);
    int body_len = block_len - body_start;
    if (body_len >= (int)sizeof(s_draw_body)) {
      body_len = sizeof(s_draw_body) - 1;
    }
    memcpy(s_draw_body, s_full_context + block_start + body_start, body_len);
    s_draw_body[body_len] = '\0';
    y += context_card_height(s_draw_body, width) + 6;
  }
  return clamp_int(y + CARD_PAD, DETAIL_CONTENT_MIN_HEIGHT, DETAIL_CONTENT_HEIGHT);
}

static int detail_content_height_for_width(int width) {
  if (s_showing_context) {
    return context_content_height(width);
  }
  if (s_selected_index < 0 || s_selected_index >= s_session_count) {
    return DETAIL_CONTENT_MIN_HEIGHT;
  }
  SessionItem *item = &s_sessions[s_selected_index];
  const char *summary = item->summary[0] ? item->summary : "No summary yet.";
  int height = 42 + text_height(summary, font_body(), width - 20) + 48;
  return clamp_int(height, DETAIL_CONTENT_MIN_HEIGHT, DETAIL_CONTENT_HEIGHT);
}

static void update_detail_text(void) {
  if (s_detail_layer && s_scroll_layer) {
    GRect scroll_bounds = layer_get_bounds(scroll_layer_get_layer(s_scroll_layer));
    int width = scroll_bounds.size.w;
    int height = detail_content_height_for_width(width);
    if (height < scroll_bounds.size.h) {
      height = scroll_bounds.size.h;
    }
    layer_set_frame(s_detail_layer, GRect(0, 0, width, height));
    scroll_layer_set_content_size(s_scroll_layer, GSize(width, height));
    layer_mark_dirty(s_detail_layer);
  }
  if (s_detail_header_layer) {
    layer_mark_dirty(s_detail_header_layer);
  }
}

static int draw_context_card(GContext *ctx, int y, int width, const char *role, const char *body, int card_h) {
  bool from_user = strcmp(role, "You") == 0;
  graphics_context_set_fill_color(ctx, from_user ? lcd_ink() : lcd_dim());
  graphics_fill_rect(ctx, GRect(6, y + 2, 2, card_h - 8), 0, GCornerNone);

  graphics_context_set_text_color(ctx, lcd_ink());
  draw_tracked(ctx, from_user ? "YOU" : "AGENT", font_legend(), GPoint(13, y - 4));

  graphics_context_set_text_color(ctx, lcd_ink());
  graphics_draw_text(ctx, body, font_body(), GRect(13, y + 12, width - 20, card_h - 14),
                     GTextOverflowModeWordWrap, GTextAlignmentLeft, NULL);
  return card_h;
}

static void draw_context_page(GContext *ctx, GRect bounds) {
  if (busy_is(BusyContext)) {
    for (int i = 0; i < 3; i++) {
      int lit = (s_stream_phase / 3) % 4;
      graphics_context_set_fill_color(ctx, i == lit ? lcd_ink() : lcd_dim());
      int w = 60 + i * 30;
      if (w > bounds.size.w - 26) {
        w = bounds.size.w - 26;
      }
      graphics_fill_rect(ctx, GRect(13, 14 + i * 16, w, 8), 0, GCornerNone);
    }
    return;
  }

  int y = CARD_PAD;
  int pos = 0;
  int block_start = 0;
  int block_len = 0;
  int context_len = strlen(s_full_context);
  char role[16];
  while (pos < context_len) {
    pos = next_context_block_len(s_full_context, context_len, pos, &block_start, &block_len);
    if (block_len <= 0) {
      continue;
    }
    block_role(role, sizeof(role), s_full_context + block_start, block_len);
    int body_start = role_body_start(s_full_context + block_start, block_len);
    int body_len = block_len - body_start;
    if (body_len >= (int)sizeof(s_draw_body)) {
      body_len = sizeof(s_draw_body) - 1;
    }
    memcpy(s_draw_body, s_full_context + block_start + body_start, body_len);
    s_draw_body[body_len] = '\0';
    int card_h = context_card_height(s_draw_body, bounds.size.w);
    y += draw_context_card(ctx, y, bounds.size.w, role, s_draw_body, card_h) + 6;
  }
}

static void detail_content_update_proc(Layer *layer, GContext *ctx) {
  s_frame_count++;
  GRect bounds = layer_get_bounds(layer);
  graphics_context_set_fill_color(ctx, lcd_glass());
  graphics_fill_rect(ctx, bounds, 0, GCornerNone);

  if (s_selected_index < 0 || s_selected_index >= s_session_count) {
    return;
  }
  if (s_showing_context) {
    draw_context_page(ctx, bounds);
    return;
  }

  SessionItem *item = &s_sessions[s_selected_index];
  if (busy_is(BusyDetail)) {
    graphics_context_set_text_color(ctx, lcd_ink());
    graphics_draw_text(ctx, item->title, font_row_title(),
                       GRect(10, -2, bounds.size.w - 20, 21),
                       GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);
    graphics_context_set_fill_color(ctx, lcd_dim());
    graphics_fill_rect(ctx, GRect(10, 34, bounds.size.w - 20, 1), 0, GCornerNone);
    for (int i = 0; i < 4; i++) {
      int lit = (s_stream_phase / 3) % 5;
      graphics_context_set_fill_color(ctx, i == lit ? lcd_ink() : lcd_dim());
      int w = bounds.size.w - 26 - (i == 3 ? 40 : 0);
      graphics_fill_rect(ctx, GRect(13, 42 + i * 14, w, 8), 0, GCornerNone);
    }
    return;
  }
  const char *summary = item->summary[0] ? item->summary : "No summary yet.";
  graphics_context_set_text_color(ctx, lcd_ink());
  graphics_draw_text(ctx, item->title, font_row_title(),
                     GRect(10, -2, bounds.size.w - 20, 21),
                     GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);
  draw_caption(ctx, item->detail, GPoint(10, 17), lcd_ink());
  if (item->agent[0]) {
    int aw = tracked_width(item->agent, font_row_detail());
    draw_caption(ctx, item->agent, GPoint(bounds.size.w - 10 - aw, 17), lcd_ink());
  }
  graphics_context_set_fill_color(ctx, lcd_dim());
  graphics_fill_rect(ctx, GRect(10, 34, bounds.size.w - 20, 1), 0, GCornerNone);
  graphics_context_set_text_color(ctx, lcd_ink());
  graphics_draw_text(ctx, summary, font_body(), GRect(10, 38, bounds.size.w - 20, bounds.size.h - 62),
                     GTextOverflowModeWordWrap, GTextAlignmentLeft, NULL);
  draw_caption(ctx, "SELECT LOG   HOLD MENU", GPoint(10, bounds.size.h - 20), lcd_ink());
}

static void detail_header_update_proc(Layer *layer, GContext *ctx) {
  s_frame_count++;
  GRect bounds = layer_get_bounds(layer);
  graphics_context_set_fill_color(ctx, chassis());
  graphics_fill_rect(ctx, GRect(0, 0, bounds.size.w, TOP_CHROME), 0, GCornerNone);

  if (s_selected_index < 0 || s_selected_index >= s_session_count) {
    draw_legend_band(ctx, bounds, "THREAD", "");
    draw_rail(ctx, bounds, LEGEND_HEIGHT, true);
    return;
  }
  SessionItem *item = &s_sessions[s_selected_index];
  char right[20];
  if (busy_is(BusySending)) {
    snprintf(right, sizeof(right), "SEND");
  } else if (s_showing_context) {
    snprintf(right, sizeof(right), "%d/%d", s_context_page + 1, s_context_page_count);
  } else {
    snprintf(right, sizeof(right), "%s", state_word(item->state));
  }
  draw_legend_band(ctx, bounds, s_showing_context ? "LOG" : (item->agent[0] ? item->agent : "THREAD"), right);
  if (busy_is(BusyContext) || busy_is(BusySending)) {
    draw_busy_rail(ctx, bounds, LEGEND_HEIGHT);
  } else {
    draw_rail(ctx, bounds, LEGEND_HEIGHT, true);
  }
}

/* ----------------------------------------------------------- detail input */

static void detail_reset_scroll(bool animated) {
  if (s_scroll_layer) {
    scroll_layer_set_content_offset(s_scroll_layer, GPoint(0, 0), animated);
  }
}

static void detail_exit_context(bool animated) {
  s_showing_context = false;
  busy_clear(BusyContext);
  s_context_page = 0;
  s_context_page_count = 1;
  s_full_context[0] = '\0';
  detail_reset_scroll(false);
  update_detail_text();
  update_stream_timer();
}

static void detail_select_click_handler(ClickRecognizerRef recognizer, void *context) {
  if (s_showing_context) {
    /* Already reading: jump to the newest page, which is the one worth
       reaching quickly in a long log. */
    if (s_context_page != s_context_page_count - 1) {
      request_context_page(s_context_page_count - 1);
    }
    return;
  }
  request_detail(s_selected_index, true);
}

/* Reply stays on a short press because it is the common case; everything else
   lives behind this menu rather than competing for the four buttons. */
static void detail_select_long_handler(ClickRecognizerRef recognizer, void *context) {
  open_thread_actions();
}

static void detail_back_click_handler(ClickRecognizerRef recognizer, void *context) {
  if (s_showing_context || busy_is(BusyContext)) {
    detail_exit_context(false);
    return;
  }
  window_stack_pop(true);
}

static int detail_scroll_max_offset(void) {
  if (!s_scroll_layer || !s_detail_layer) {
    return 0;
  }
  GRect scroll_bounds = layer_get_bounds(scroll_layer_get_layer(s_scroll_layer));
  int content_h = layer_get_frame(s_detail_layer).size.h;
  int max_offset = content_h - scroll_bounds.size.h;
  return max_offset > 0 ? max_offset : 0;
}

static void detail_scroll_by(int delta) {
  if (!s_scroll_layer) {
    return;
  }
  GPoint offset = scroll_layer_get_content_offset(s_scroll_layer);
  int next = clamp_int(-offset.y + delta, 0, detail_scroll_max_offset());
  scroll_layer_set_content_offset(s_scroll_layer, GPoint(0, -next), true);
}

static bool detail_at_top(void) {
  if (!s_scroll_layer) {
    return true;
  }
  return scroll_layer_get_content_offset(s_scroll_layer).y >= 0;
}

static bool detail_at_bottom(void) {
  if (!s_scroll_layer) {
    return true;
  }
  return -scroll_layer_get_content_offset(s_scroll_layer).y >= detail_scroll_max_offset();
}

static void detail_up_click_handler(ClickRecognizerRef recognizer, void *context) {
  if (s_showing_context && detail_at_top() && s_context_page > 0) {
    request_context_page(s_context_page - 1);
    return;
  }
  detail_scroll_by(-40);
}

static void detail_down_click_handler(ClickRecognizerRef recognizer, void *context) {
  if (s_showing_context && detail_at_bottom() && s_context_page < s_context_page_count - 1) {
    request_context_page(s_context_page + 1);
    return;
  }
  detail_scroll_by(40);
}

static void detail_click_config_provider(void *context) {
  window_single_click_subscribe(BUTTON_ID_SELECT, detail_select_click_handler);
  window_long_click_subscribe(BUTTON_ID_SELECT, 0, detail_select_long_handler, NULL);
  window_single_click_subscribe(BUTTON_ID_BACK, detail_back_click_handler);
  window_single_click_subscribe(BUTTON_ID_UP, detail_up_click_handler);
  window_single_click_subscribe(BUTTON_ID_DOWN, detail_down_click_handler);
}

static void dictation_callback(DictationSession *session, DictationSessionStatus status, char *transcription, void *context) {
  if (status == DictationSessionStatusSuccess && transcription && transcription[0]) {
    if (s_dictation_target == DictationTargetProject) {
      send_new_thread_text(transcription);
    } else if (s_dictation_target == DictationTargetNewProject) {
      send_project_name(transcription);
    } else if (s_dictation_target == DictationTargetConcierge) {
      send_concierge_text(transcription);
    } else {
      send_prompt_text(transcription);
    }
  } else {
    log_error("Dictation failed");
    set_status("Dictation failed");
  }
}

static void start_dictation(void) {
#ifdef PBL_MICROPHONE
  if (s_dictation) {
    dictation_session_destroy(s_dictation);
    s_dictation = NULL;
  }
  s_dictation = dictation_session_create(512, dictation_callback, NULL);
  if (!s_dictation) {
    set_status("No dictation");
    return;
  }
  dictation_session_start(s_dictation);
#else
  set_status("Voice unavailable");
#endif
}

/* ------------------------------------------------------------------ inbox */

/* The row a thread id currently occupies, or -1 if the list has moved on. */
static int session_index_for(const char *id) {
  if (!id || !id[0]) {
    return -1;
  }
  for (int i = 0; i < s_session_count; i++) {
    if (strcmp(s_sessions[i].id, id) == 0) {
      return i;
    }
  }
  return -1;
}

static void reset_hosts(void) {
  memset(s_hosts, 0, sizeof(s_hosts));
  s_host_count = 0;
}

static void reset_sessions(void) {
  memset(s_sessions, 0, sizeof(s_sessions));
  s_session_count = 0;
}

static void reset_projects(void) {
  memset(s_projects, 0, sizeof(s_projects));
  s_project_count = 0;
}

#ifdef SCREENSHOT_BUILD
/* Drives the watch through its screens for the capture rig. Built only for
   that, because a shipped app should not accept a command from the phone that
   rearranges its window stack. */
static void show_screenshot_page(int page) {
  /* Pop back to the host window, not off it. window_stack_pop_all() empties the
     stack, and a watchapp with no windows left exits, after which the
     mark_all_dirty() below runs against freed layers. Popping down to the host
     window is what the callers below already assume is on the stack. */
  while (s_host_window && window_stack_get_top_window() &&
         window_stack_get_top_window() != s_host_window) {
    window_stack_pop(false);
  }

  if (page <= 0) {
    mark_all_dirty();
    return;
  }

  /* The host screen again, parked on a machine that did not answer, so the
     unreachable layout is in the capture set alongside the working one. */
  if (page == 5) {
    for (int i = 0; i < s_host_count; i++) {
      if (state_is(s_hosts[i].state, "offline")) {
        s_host_cursor = i;
        break;
      }
    }
    mark_all_dirty();
    return;
  }

  /* The offline capture parks the cursor on REMOTE. All later list/menu pages
     use WORKBENCH's fixture data, so restore that host before deriving the
     thread-screen title. */
  if (page >= 6 && s_host_count > 0) {
    s_host_cursor = 0;
  }
  if (s_host_count > 0) {
    s_selected_host_index = clamp_int(s_host_cursor, 0, s_host_count - 1);
  }

  if (page == 4) {
    if (s_diag_window && window_stack_get_top_window() != s_diag_window) {
      window_stack_push(s_diag_window, false);
    }
    return;
  }

  if (s_thread_window && window_stack_get_top_window() != s_thread_window) {
    window_stack_push(s_thread_window, false);
  }

  if (page == 1 || page == 6) {
    mark_all_dirty();
    return;
  }

  /* Scroll the second section into view so projects and their New project row
     can be documented independently of the thread rows above them. */
  if (page == 7) {
    if (s_thread_menu && s_project_count > 0) {
      menu_layer_set_selected_index(s_thread_menu, MenuIndex(1, 0), MenuRowAlignCenter, false);
    }
    mark_all_dirty();
    return;
  }

  if (page == 8) {
    snprintf(s_pending_project_name, sizeof(s_pending_project_name), "%s", "sparkle renderer");
    snprintf(s_pending_project_path, sizeof(s_pending_project_path), "%s",
             "/home/will/Projects/sparkle-renderer");
    open_project_confirm();
    return;
  }

  if (page == 9) {
    s_selected_project_index = 0;
    open_project_actions();
    return;
  }

  if (page == 10) {
    s_selected_index = 0;
    open_thread_actions();
    return;
  }

  if (s_session_count > 0) {
    s_selected_index = 0;
  }
  if (s_detail_window && window_stack_get_top_window() != s_detail_window) {
    window_stack_push(s_detail_window, false);
  }

  if (page == 2) {
    s_showing_context = false;
    busy_clear(BusyContext);
  } else if (page == 3) {
    s_showing_context = true;
    busy_clear(BusyContext);
  }
  detail_reset_scroll(false);
  update_detail_text();
  mark_all_dirty();
}
#endif /* SCREENSHOT_BUILD */

static void inbox_received_callback(DictionaryIterator *iter, void *context) {
  s_message_in++;
  int command = int_tuple(iter, KEY_CMD, 0);

  if (command == CMD_HOST_ITEM) {
    /* Rows that have not changed since the last poll are not resent, so this
       no longer clears the list on index 0 -- CMD_HOST_END sets the count. */
    int index = int_tuple(iter, KEY_INDEX, -1);
    if (index >= 0 && index < MAX_HOSTS) {
      HostItem *host = &s_hosts[index];
      copy_tuple(host->id, sizeof(host->id), iter, KEY_HOST_ID);
      copy_tuple(host->title, sizeof(host->title), iter, KEY_TITLE);
      copy_tuple(host->detail, sizeof(host->detail), iter, KEY_DETAIL);
      copy_tuple(host->state, sizeof(host->state), iter, KEY_STATE);
      host->needs = int_tuple(iter, KEY_C_NEEDS, 0);
      host->run = int_tuple(iter, KEY_C_RUN, 0);
      host->monitor = int_tuple(iter, KEY_C_MONITOR, 0);
      host->idle = int_tuple(iter, KEY_C_IDLE, 0);
      host->settled = int_tuple(iter, KEY_C_SETTLED, 0);
      if (index + 1 > s_host_count) {
        s_host_count = index + 1;
      }
    }
  } else if (command == CMD_HOST_END) {
    /* The count is authoritative, because unchanged rows are not resent: a
       list that shrank would otherwise keep drawing the machine that left. */
    int total = clamp_int(int_tuple(iter, KEY_TOTAL, s_host_count), 0, MAX_HOSTS);
    if (total == 0) {
      reset_hosts();
    } else {
      for (int i = total; i < s_host_count && i < MAX_HOSTS; i++) {
        memset(&s_hosts[i], 0, sizeof(s_hosts[i]));
      }
      s_host_count = total;
    }
    busy_clear(BusyHosts);
    s_hosts_synced = true;
    s_link_down = false;
    s_error_active = false;
    s_last_sync = time(NULL);
    s_host_cursor = clamp_int(s_host_cursor, 0, s_host_count > 0 ? s_host_count - 1 : 0);
    mark_all_dirty();
    update_stream_timer();
    schedule_refresh(REFRESH_INTERVAL_MS);
  } else if (command == CMD_SESSION_ITEM) {
    int index = int_tuple(iter, KEY_INDEX, -1);
    if (index == 0) {
      reset_sessions();
    }
    if (index >= 0 && index < MAX_SESSIONS) {
      SessionItem *item = &s_sessions[index];
      copy_tuple(item->id, sizeof(item->id), iter, KEY_SESSION_ID);
      copy_tuple(item->title, sizeof(item->title), iter, KEY_TITLE);
      copy_tuple(item->detail, sizeof(item->detail), iter, KEY_DETAIL);
      copy_tuple(item->state, sizeof(item->state), iter, KEY_STATE);
      copy_tuple(item->agent, sizeof(item->agent), iter, KEY_AGENT);
      copy_tuple(item->summary, sizeof(item->summary), iter, KEY_SUMMARY);
      copy_tuple(item->request_id, sizeof(item->request_id), iter, KEY_REQUEST_ID);
      copy_tuple(item->request_kind, sizeof(item->request_kind), iter, KEY_REQUEST_KIND);
      item->settled = int_tuple(iter, KEY_SETTLED, 0) != 0;
      if (index + 1 > s_session_count) {
        s_session_count = index + 1;
      }
    }
  } else if (command == CMD_SESSION_END) {
    int total = int_tuple(iter, KEY_TOTAL, s_session_count);
    if (total == 0) {
      reset_sessions();
    }
    s_scope = int_tuple(iter, KEY_SCOPE, s_scope);
    s_offset = int_tuple(iter, KEY_OFFSET, s_offset);
    s_matched = int_tuple(iter, KEY_MATCHED, s_session_count);
    s_other = int_tuple(iter, KEY_OTHER, 0);
    busy_clear(BusyThreads);
    s_threads_synced = true;
    rebuild_footers();
    mark_all_dirty();
    update_stream_timer();
  } else if (command == CMD_PROJECT_ITEM) {
    int index = int_tuple(iter, KEY_INDEX, -1);
    if (index == 0) {
      reset_projects();
    }
    if (index >= 0 && index < MAX_PROJECTS) {
      ProjectItem *project = &s_projects[index];
      copy_tuple(project->id, sizeof(project->id), iter, KEY_PROJECT_ID);
      copy_tuple(project->title, sizeof(project->title), iter, KEY_TITLE);
      copy_tuple(project->directory, sizeof(project->directory), iter, KEY_DIRECTORY);
      if (index + 1 > s_project_count) {
        s_project_count = index + 1;
      }
    }
  } else if (command == CMD_PROJECT_END) {
    int total = int_tuple(iter, KEY_TOTAL, s_project_count);
    if (total == 0) {
      reset_projects();
    }
    mark_all_dirty();
  } else if (command == CMD_MODEL_ITEM) {
    int index = int_tuple(iter, KEY_INDEX, -1);
    if (index == 0) {
      memset(s_models, 0, sizeof(s_models));
      s_model_count = 0;
    }
    if (index >= 0 && index < MAX_MODELS) {
      ModelItem *model = &s_models[index];
      copy_tuple(model->label, sizeof(model->label), iter, KEY_TITLE);
      copy_tuple(model->instance_id, sizeof(model->instance_id), iter, KEY_INSTANCE_ID);
      copy_tuple(model->model, sizeof(model->model), iter, KEY_MODEL);
      model->is_default = int_tuple(iter, KEY_IS_DEFAULT, 0) != 0;
      if (index + 1 > s_model_count) {
        s_model_count = index + 1;
      }
    }
  } else if (command == CMD_MODEL_END) {
    s_model_count = clamp_int(int_tuple(iter, KEY_TOTAL, s_model_count), 0, MAX_MODELS);
    busy_clear(BusyModels);
    s_selected_model_index = -1;
    set_status("Choose model");
    update_stream_timer();
    if (window_stack_get_top_window() == s_thread_window) {
      open_model_menu();
    }
  } else if (command == CMD_DETAIL) {
    /* Route by thread id, not by the index the phone echoes back. The list can
       be re-fetched while a detail request is in flight, and trusting the
       index landed a late reply on whatever thread now occupies that row.
       CMD_CONTEXT already guards this way; this did not. */
    char session_id[80] = "";
    copy_tuple(session_id, sizeof(session_id), iter, KEY_SESSION_ID);
    int index = session_index_for(session_id);
    if (index < 0) {
      index = int_tuple(iter, KEY_INDEX, s_selected_index);
      /* An id that matches nothing in the current list is a reply to a listing
         that has already been replaced. Only accept the positional fallback
         when the phone sent no id at all. */
      if (session_id[0] || index < 0 || index >= s_session_count) {
        index = -1;
      }
    }
    if (index >= 0 && index < MAX_SESSIONS) {
      SessionItem *item = &s_sessions[index];
      copy_tuple(item->title, sizeof(item->title), iter, KEY_TITLE);
      copy_tuple(item->detail, sizeof(item->detail), iter, KEY_DETAIL);
      copy_tuple(item->state, sizeof(item->state), iter, KEY_STATE);
      copy_tuple(item->agent, sizeof(item->agent), iter, KEY_AGENT);
      copy_tuple(item->summary, sizeof(item->summary), iter, KEY_SUMMARY);
      copy_tuple(item->request_id, sizeof(item->request_id), iter, KEY_REQUEST_ID);
      copy_tuple(item->request_kind, sizeof(item->request_kind), iter, KEY_REQUEST_KIND);
      if (index + 1 > s_session_count) {
        s_session_count = index + 1;
      }
    }
    busy_clear(BusyDetail);
    update_detail_text();
    mark_all_dirty();
    update_stream_timer();
  } else if (command == CMD_CONTEXT) {
    char request_id[16] = "";
    char session_id[80] = "";
    copy_tuple(request_id, sizeof(request_id), iter, KEY_REQUEST_ID);
    copy_tuple(session_id, sizeof(session_id), iter, KEY_SESSION_ID);
    if (s_pending_context_request_id[0] && strcmp(request_id, s_pending_context_request_id) != 0) {
      return;
    }
    if (s_pending_context_session_id[0] && session_id[0] &&
        strcmp(session_id, s_pending_context_session_id) != 0) {
      return;
    }
    copy_tuple(s_full_context, sizeof(s_full_context), iter, KEY_CONTEXT);
    s_context_page_count = clamp_int(int_tuple(iter, KEY_TOTAL, 1), 1, 999);
    s_context_page = clamp_int(int_tuple(iter, KEY_CONTEXT_PAGE, s_pending_context_page < 0 ? 0 : s_pending_context_page),
                               0, s_context_page_count - 1);
    busy_clear(BusyContext);
    s_showing_context = true;
    detail_reset_scroll(false);
    update_detail_text();
    update_stream_timer();
  } else if (command == CMD_PROMPT) {
    busy_clear(BusySending);
    set_status("Sent");
    update_detail_text();
    update_stream_timer();
    schedule_refresh(2500);
  } else if (command == CMD_PROJECT_PREVIEW) {
    /* The phone resolved a dictated name to a path. Show it and wait: nothing
       is created until the confirm menu is answered. */
    copy_tuple(s_pending_project_path, sizeof(s_pending_project_path), iter, KEY_PATH);
    copy_tuple(s_pending_project_name, sizeof(s_pending_project_name), iter, KEY_NAME);
    if (s_pending_project_path[0]) {
      set_status(s_pending_project_path);
      open_project_confirm();
    }
  } else if (command == CMD_STATUS) {
    char status[40] = "";
    copy_tuple(status, sizeof(status), iter, KEY_STATUS);
    set_status(status);
  } else if (command == CMD_ERROR) {
    char error[ERROR_TEXT_MAX] = "";
    copy_tuple(error, sizeof(error), iter, KEY_ERROR);
    enter_error_state(error[0] ? error : "Error");
#ifdef SCREENSHOT_BUILD
  } else if (command == CMD_SCREENSHOT_PAGE) {
    show_screenshot_page(int_tuple(iter, KEY_INDEX, 0));
#endif
  }
}

static void inbox_dropped_callback(AppMessageResult reason, void *context) {
  char text[48];
  snprintf(text, sizeof(text), "Dropped a message (%d)", (int)reason);
  enter_error_state(text);
}

static void outbox_failed_callback(DictionaryIterator *iter, AppMessageResult reason, void *context) {
  s_link_down = true;
  char text[48];
  snprintf(text, sizeof(text), "Phone bridge silent (%d)", (int)reason);
  enter_error_state(text);
}

/* ---------------------------------------------------------------- windows */

static void host_window_load(Window *window) {
  Layer *window_layer = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(window_layer);
  window_set_background_color(window, chassis());

  s_host_layer = layer_create(bounds);
  layer_set_update_proc(s_host_layer, host_layer_update_proc);
  layer_add_child(window_layer, s_host_layer);

  /* Added after the panel so it composites on top of it. Its frame never
     moves; only its visibility does. */
  s_host_rail_layer = layer_create(host_rail_box());
  layer_set_update_proc(s_host_rail_layer, host_rail_update_proc);
  layer_set_hidden(s_host_rail_layer, true);
  layer_add_child(window_layer, s_host_rail_layer);
  update_host_rail();

  window_set_click_config_provider(window, host_click_config);
}

/* Coming back from a thread list or a transcript, where the poll was being
   deferred. The counts on the glass are as old as the last time this screen
   was up, so catch up immediately rather than waiting out the timer that was
   quietly rescheduling itself the whole time. */
static void host_window_appear(Window *window) {
  if (!s_hosts_synced) {
    return;
  }
  int age_ms = (int)(time(NULL) - s_last_sync) * 1000;
  if (s_last_sync == 0 || age_ms >= (int)REFRESH_INTERVAL_MS) {
    request_refresh();
  }
}

static void host_window_unload(Window *window) {
  if (s_host_layer) {
    layer_destroy(s_host_layer);
  }
  if (s_host_rail_layer) {
    layer_destroy(s_host_rail_layer);
  }
  s_host_layer = NULL;
  s_host_rail_layer = NULL;
}

static void thread_window_load(Window *window) {
  Layer *window_layer = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(window_layer);
  window_set_background_color(window, chassis());

  GRect list = GRect(PANEL_INSET, TOP_CHROME,
                     bounds.size.w - 2 * PANEL_INSET,
                     bounds.size.h - TOP_CHROME - BOTTOM_CHROME);
  s_thread_menu = menu_layer_create(list);
  menu_layer_set_normal_colors(s_thread_menu, lcd_glass(), lcd_ink());
  menu_layer_set_highlight_colors(s_thread_menu, lcd_ink(), lcd_glass());
  menu_layer_set_callbacks(s_thread_menu, NULL, (MenuLayerCallbacks) {
    .get_num_sections = thread_num_sections,
    .get_num_rows = thread_num_rows,
    .get_header_height = thread_header_height,
    .get_cell_height = thread_cell_height,
    .draw_header = thread_draw_header,
    .draw_row = thread_draw_row,
    .select_click = thread_select,
    .select_long_click = thread_select_long
  });
  menu_layer_set_click_config_onto_window(s_thread_menu, window);
  layer_add_child(window_layer, menu_layer_get_layer(s_thread_menu));

  s_thread_chrome = layer_create(bounds);
  layer_set_update_proc(s_thread_chrome, thread_chrome_update_proc);
  layer_add_child(window_layer, s_thread_chrome);
}

static void thread_window_unload(Window *window) {
  if (s_thread_menu) {
    menu_layer_destroy(s_thread_menu);
  }
  if (s_thread_chrome) {
    layer_destroy(s_thread_chrome);
  }
  s_thread_menu = NULL;
  s_thread_chrome = NULL;
}

static void detail_window_load(Window *window) {
  Layer *window_layer = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(window_layer);
  window_set_background_color(window, chassis());

  GRect glass = GRect(PANEL_INSET, TOP_CHROME,
                      bounds.size.w - 2 * PANEL_INSET,
                      bounds.size.h - TOP_CHROME - 2);
  s_scroll_layer = scroll_layer_create(glass);
  if (!s_scroll_layer) {
    return;
  }
  layer_add_child(window_layer, scroll_layer_get_layer(s_scroll_layer));
  scroll_layer_set_content_size(s_scroll_layer, GSize(glass.size.w, DETAIL_CONTENT_HEIGHT));

  s_detail_layer = layer_create(GRect(0, 0, glass.size.w, DETAIL_CONTENT_HEIGHT));
  if (!s_detail_layer) {
    return;
  }
  layer_set_update_proc(s_detail_layer, detail_content_update_proc);
  scroll_layer_add_child(s_scroll_layer, s_detail_layer);

  s_detail_header_layer = layer_create(GRect(0, 0, bounds.size.w, TOP_CHROME));
  if (!s_detail_header_layer) {
    return;
  }
  layer_set_update_proc(s_detail_header_layer, detail_header_update_proc);
  layer_add_child(window_layer, s_detail_header_layer);

  window_set_click_config_provider(window, detail_click_config_provider);
  update_detail_text();
}

static void detail_window_unload(Window *window) {
  if (s_detail_layer) {
    layer_destroy(s_detail_layer);
  }
  if (s_scroll_layer) {
    scroll_layer_destroy(s_scroll_layer);
  }
  if (s_detail_header_layer) {
    layer_destroy(s_detail_header_layer);
  }
  s_detail_layer = NULL;
  s_scroll_layer = NULL;
  s_detail_header_layer = NULL;
}

/* A notification overlay or the modal dictation UI takes the screen without
   unloading anything underneath, and the animation timer used to keep running
   below it -- redrawing a panel nobody could see. */
static void app_focus_changed(bool in_focus) {
  s_focused = in_focus;
  update_stream_timer();
}

/* With no animation timer on the home screen, the sync age has nothing to
   refresh it: it would read "now" until the next poll five minutes later and
   then jump. MINUTE_UNIT rides the tick the system already runs for the clock,
   so it adds no wakeup of its own, and it is exactly the granularity
   sync_age_text reports. One repaint a minute, and only if you are looking. */
static void minute_tick(struct tm *tick_time, TimeUnits units_changed) {
  if (host_window_visible() && s_host_layer) {
    layer_mark_dirty(s_host_layer);
  }
  if (s_diag_layer && window_stack_get_top_window() == s_diag_window) {
    layer_mark_dirty(s_diag_layer);
  }
}

static void init(void) {
  s_launched_at = time(NULL);
  s_host_connect_started_at = s_launched_at;
  s_font_dot = fonts_load_custom_font(resource_get_handle(RESOURCE_ID_FONT_DOT_20));
  s_font_dot_small = fonts_load_custom_font(resource_get_handle(RESOURCE_ID_FONT_DOT_10));
  s_font_dseg_big = fonts_load_custom_font(resource_get_handle(RESOURCE_ID_FONT_DSEG_64));
  s_font_dseg_mid = fonts_load_custom_font(resource_get_handle(RESOURCE_ID_FONT_DSEG_34));
  lcd_tiles_create();
  /* Before any window loads: the panel's field geometry is derived from
     these, and host_window_load reads it. */
  lcd_metrics_measure();

  reset_hosts();
  reset_sessions();
  reset_projects();
  set_status(BUILD_LABEL);

  s_host_window = window_create();
  window_set_window_handlers(s_host_window, (WindowHandlers) {
    .load = host_window_load,
    .appear = host_window_appear,
    .unload = host_window_unload
  });

  s_thread_window = window_create();
  window_set_window_handlers(s_thread_window, (WindowHandlers) {
    .load = thread_window_load,
    .unload = thread_window_unload
  });

  s_detail_window = window_create();
  window_set_window_handlers(s_detail_window, (WindowHandlers) {
    .load = detail_window_load,
    .unload = detail_window_unload
  });

  s_diag_window = window_create();
  window_set_window_handlers(s_diag_window, (WindowHandlers) {
    .load = diag_window_load,
    .unload = diag_window_unload
  });

  app_message_register_inbox_received(inbox_received_callback);
  app_message_register_inbox_dropped(inbox_dropped_callback);
  app_message_register_outbox_failed(outbox_failed_callback);
  app_message_open(1024, 1024);
  app_focus_service_subscribe(app_focus_changed);
  tick_timer_service_subscribe(MINUTE_UNIT, minute_tick);

  window_stack_push(s_host_window, true);
  update_stream_timer();
  schedule_refresh(600);
}

static void deinit(void) {
  app_focus_service_unsubscribe();
  tick_timer_service_unsubscribe();
  if (s_refresh_timer) {
    app_timer_cancel(s_refresh_timer);
  }
  if (s_stream_timer) {
    app_timer_cancel(s_stream_timer);
  }
  if (s_dictation) {
    dictation_session_destroy(s_dictation);
  }
  if (s_host_window) {
    window_destroy(s_host_window);
  }
  if (s_thread_window) {
    window_destroy(s_thread_window);
  }
  if (s_detail_window) {
    window_destroy(s_detail_window);
  }
  if (s_diag_window) {
    window_destroy(s_diag_window);
  }
  lcd_tiles_destroy();
  if (s_font_dot) fonts_unload_custom_font(s_font_dot);
  if (s_font_dot_small) fonts_unload_custom_font(s_font_dot_small);
  if (s_font_dseg_big) fonts_unload_custom_font(s_font_dseg_big);
  if (s_font_dseg_mid) fonts_unload_custom_font(s_font_dseg_mid);
}

int main(void) {
  init();
  app_event_loop();
  deinit();
  return 0;
}
