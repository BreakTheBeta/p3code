#include <pebble.h>

/* LessWrong Quick Takes -- the watch half.
 *
 * Two screens. A list of quick takes drawn at random from the last day, and the
 * full text of whichever one you opened. The phone does all the network work;
 * nothing here knows what HTTPS is.
 *
 * The wire protocol and the build label are generated from protocol.json by
 * tools/gen-protocol.js, which writes the same table into appinfo.json's
 * appKeys and into the bridge. Edit protocol.json, never this block;
 * test/protocol.test.js fails if the copies disagree.
 */
/* @generated protocol:begin */
#define KEY_CMD     0
#define KEY_INDEX   1
#define KEY_TOTAL   2
#define KEY_AUTHOR  3
#define KEY_AGE     4
#define KEY_PREVIEW 5
#define KEY_BODY    6
#define KEY_OFFSET  7
#define KEY_CHUNKS  8
#define KEY_ERROR   9
#define KEY_STATUS  10
#define KEY_POOL    11
#define KEY_WINDOW  12
#define KEY_KARMA   13

#define CMD_REFRESH      1
#define CMD_SHUFFLE      2
#define CMD_TAKE_ITEM    3
#define CMD_TAKE_END     4
#define CMD_BODY_REQUEST 5
#define CMD_BODY_CHUNK   6
#define CMD_ERROR        7
#define CMD_STATUS       8

#define BUILD_LABEL "v0.1"
/* @generated protocol:end */

/* Pebble Time 2 (emery): 200 x 228. The chrome takes 18 top and 18 bottom and
   the panel is inset 4 a side, which leaves the list exactly 192 x 192. */
#if PBL_DISPLAY_WIDTH != 200 || PBL_DISPLAY_HEIGHT != 228
#error "Laid out for Pebble Time 2 (emery, 200x228)"
#endif
#define SCREEN_W PBL_DISPLAY_WIDTH
#define SCREEN_H PBL_DISPLAY_HEIGHT
#define BAND_HEIGHT 16
#define RAIL_HEIGHT 2
#define TOP_CHROME (BAND_HEIGHT + RAIL_HEIGHT)
#define BOTTOM_CHROME (BAND_HEIGHT + RAIL_HEIGHT)
#define PANEL_INSET 4
#define PANEL_W (SCREEN_W - 2 * PANEL_INSET)
/* 62 x 3 = 186, so three whole rows fit in the 192 the list gets and the fourth
   peeks far enough to show there is more. */
#define ROW_HEIGHT 62
#define ROW_GUTTER 9
#define STRIPE_W 3
#define METER_W 40
#define BODY_PAD 8

#define MAX_TAKES 20
/* One over each bridge limit, for the terminator. test/protocol.test.js checks
   these against the phone's truncation so a field cannot arrive already too
   long to store. */
#define AUTHOR_MAX 25
#define AGE_MAX 9
#define PREVIEW_MAX 121
#define BODY_MAX 2049
#define STATUS_MAX 41
#define ERROR_TEXT_MAX 111

/* Nothing on either screen moves at rest. The one timer in this app runs only
   while a request is in flight, and it repaints a two-pixel rail rather than a
   panel. Adding anything that has to animate when idle means a timer that never
   stops on a watch that is worn all day. */
#define BUSY_TICK_MS 110
#define RAIL_SWEEP_W 44

#define BUSY_LIST 0x1
#define BUSY_BODY 0x2

typedef struct {
  char author[AUTHOR_MAX];
  char age[AGE_MAX];
  char preview[PREVIEW_MAX];
  int karma;
} Take;

static Window *s_list_window;
static Window *s_detail_window;
static MenuLayer *s_list_menu;
static Layer *s_list_chrome;
static Layer *s_list_rail;
static ScrollLayer *s_detail_scroll;
static Layer *s_detail_body;
static Layer *s_detail_chrome;
static Layer *s_detail_rail;

static GFont s_font_dot;
static GFont s_font_author;
static GFont s_font_preview;
static GFont s_font_body;

static Take s_takes[MAX_TAKES];
static int s_take_count;
static int s_pool_count;
static int s_window_hours;
static int s_selected;

static char s_body[BODY_MAX];
/* Which take s_body holds, so reopening the one you just read costs nothing. */
static int s_body_index = -1;
static int s_body_chunks;
static int s_body_received;
static int s_body_len;

static char s_status[STATUS_MAX];
static char s_error[ERROR_TEXT_MAX];

static uint8_t s_busy;
static AppTimer *s_busy_timer;
static int s_rail_phase;
static bool s_focused = true;
static time_t s_last_list;
static bool s_listed_once;

static void update_busy_timer(void);
static void request_body(int index);


///////////////////////////////////////////////////////////////////// palette

static GColor chassis(void) { return GColorBlack; }
static GColor band_ink(void) { return GColorWhite; }
static GColor panel(void) { return GColorWhite; }
static GColor ink(void) { return GColorBlack; }
static GColor muted(void) { return GColorDarkGray; }
static GColor accent(void) { return GColorJaegerGreen; }

/* The stripe down a row's left edge is the only place karma is shown at a
   glance, so it has to be legible against both the white row and the black
   selected one -- which is why the strongest tier is not the darkest green. */
static GColor karma_color(int karma) {
  if (karma >= 50) {
    return GColorJaegerGreen;
  }
  if (karma >= 15) {
    return GColorMayGreen;
  }
  if (karma >= 1) {
    return GColorBrass;
  }
  return GColorLightGray;
}


//////////////////////////////////////////////////////////////////////// text

/* Cutting a string at a byte boundary can land in the middle of a UTF-8
   sequence, and Pebble's text renderer draws nothing at all for a string that
   is not valid UTF-8 -- so an over-long field fails as an invisible row rather
   than a shortened one. The bridge now truncates by byte budget so this should
   never fire; it stays because the failure it prevents is silent, and because
   nothing else would tell us the two sides had drifted apart again. */
static void trim_partial_utf8(char *text) {
  int len = (int)strlen(text);
  int start = len - 1;
  while (start >= 0 && ((unsigned char)text[start] & 0xC0) == 0x80) {
    start--;
  }
  if (start < 0) {
    if (len > 0) {
      text[0] = '\0';
    }
    return;
  }
  unsigned char lead = (unsigned char)text[start];
  int need;
  if ((lead & 0x80) == 0) {
    need = 1;
  } else if ((lead & 0xE0) == 0xC0) {
    need = 2;
  } else if ((lead & 0xF0) == 0xE0) {
    need = 3;
  } else if ((lead & 0xF8) == 0xF0) {
    need = 4;
  } else {
    need = -1;
  }
  if (need < 0 || start + need > len) {
    text[start] = '\0';
  }
}

static void copy_text(char *dest, size_t size, const char *src) {
  if (!src) {
    dest[0] = '\0';
    return;
  }
  strncpy(dest, src, size - 1);
  dest[size - 1] = '\0';
  trim_partial_utf8(dest);
}

static int clamp_int(int value, int low, int high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

static int text_height(const char *text, GFont font, int width) {
  GSize size = graphics_text_layout_get_content_size(
    text, font, GRect(0, 0, width, 4000), GTextOverflowModeWordWrap, GTextAlignmentLeft);
  return size.h;
}

/* Bounded to five digits at the point karma is stored, so every buffer this
   writes into can be sized from KARMA_TEXT_MAX rather than from int32. */
#define KARMA_MAX 99999
#define KARMA_TEXT_MAX 8
static void karma_text(char *out, size_t size, int karma) {
  snprintf(out, size, "%s%d", karma > 0 ? "+" : "", clamp_int(karma, -KARMA_MAX, KARMA_MAX));
}

/* Minute granularity because nothing repaints this faster than that: the
   minute tick the system already runs for the clock is what refreshes it, so
   it costs no wakeup of its own. A live seconds counter would mean a timer
   whose only job is animating a caption. */
static void sync_age_text(char *out, size_t size) {
  if (!s_listed_once) {
    out[0] = '\0';
    return;
  }
  int minutes = (int)((time(NULL) - s_last_list) / 60);
  if (minutes <= 0) {
    copy_text(out, size, "NOW");
  } else if (minutes < 60) {
    snprintf(out, size, "%dM", minutes);
  } else {
    snprintf(out, size, "%dH", clamp_int(minutes / 60, 1, 99));
  }
}

/* What the empty list has to say for itself: an error outranks a status,
   because a status is only ever "working on it". */
static const char *empty_text(void) {
  if (s_error[0]) {
    return s_error;
  }
  if (s_status[0]) {
    return s_status;
  }
  return "No quick takes yet";
}


///////////////////////////////////////////////////////////////////// chrome

static void draw_band(GContext *ctx, GRect band, const char *left, const char *right) {
  graphics_context_set_fill_color(ctx, chassis());
  graphics_fill_rect(ctx, band, 0, GCornerNone);
  graphics_context_set_text_color(ctx, band_ink());
  if (left && left[0]) {
    graphics_draw_text(ctx, left, s_font_dot,
                       GRect(band.origin.x + PANEL_INSET, band.origin.y + 2,
                             band.size.w - 2 * PANEL_INSET, BAND_HEIGHT),
                       GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);
  }
  if (right && right[0]) {
    graphics_draw_text(ctx, right, s_font_dot,
                       GRect(band.origin.x + PANEL_INSET, band.origin.y + 2,
                             band.size.w - 2 * PANEL_INSET, BAND_HEIGHT),
                       GTextOverflowModeTrailingEllipsis, GTextAlignmentRight, NULL);
  }
}

/* The accent rail under the top band doubles as the only progress indicator in
   the app: a bright segment sweeps along it while the phone is working, and it
   is a plain line the rest of the time. Reusing the rail rather than adding a
   spinner is what keeps the busy repaint down to two pixel rows. */
static void rail_update_proc(Layer *layer, GContext *ctx) {
  GRect bounds = layer_get_bounds(layer);
  graphics_context_set_fill_color(ctx, accent());
  graphics_fill_rect(ctx, bounds, 0, GCornerNone);
  if (!s_busy) {
    return;
  }
  int span = bounds.size.w + RAIL_SWEEP_W;
  int x = (s_rail_phase * 4) % span - RAIL_SWEEP_W;
  graphics_context_set_fill_color(ctx, GColorWhite);
  graphics_fill_rect(ctx, GRect(x, bounds.origin.y, RAIL_SWEEP_W, bounds.size.h),
                     0, GCornerNone);
}

static void busy_timer_callback(void *data) {
  s_busy_timer = NULL;
  s_rail_phase++;
  if (s_list_rail) {
    layer_mark_dirty(s_list_rail);
  }
  if (s_detail_rail) {
    layer_mark_dirty(s_detail_rail);
  }
  update_busy_timer();
}

static void update_busy_timer(void) {
  bool wanted = s_busy != 0 && s_focused;
  if (wanted && !s_busy_timer) {
    s_busy_timer = app_timer_register(BUSY_TICK_MS, busy_timer_callback, NULL);
  } else if (!wanted && s_busy_timer) {
    app_timer_cancel(s_busy_timer);
    s_busy_timer = NULL;
  }
}

static void set_busy(uint8_t flag, bool on) {
  uint8_t before = s_busy;
  if (on) {
    s_busy |= flag;
  } else {
    s_busy &= ~flag;
  }
  if (before != s_busy) {
    if (s_list_rail) layer_mark_dirty(s_list_rail);
    if (s_detail_rail) layer_mark_dirty(s_detail_rail);
    update_busy_timer();
  }
}


/////////////////////////////////////////////////////////////////// list rows

static void list_chrome_update_proc(Layer *layer, GContext *ctx) {
  GRect bounds = layer_get_bounds(layer);

  char position[12] = "";
  if (s_take_count > 0) {
    snprintf(position, sizeof(position), "%d/%d",
             clamp_int(s_selected + 1, 1, MAX_TAKES), clamp_int(s_take_count, 1, MAX_TAKES));
  }
  draw_band(ctx, GRect(0, 0, bounds.size.w, BAND_HEIGHT), "QUICK TAKES", position);

  char left[24] = "";
  if (s_error[0] && s_take_count > 0) {
    /* Keep the takes on the glass and say so down here rather than replacing a
       list that is still perfectly readable with an error page. */
    copy_text(left, sizeof(left), "REFRESH FAILED");
  } else if (s_take_count > 0) {
    snprintf(left, sizeof(left), "%d OF %d / %dH", s_take_count, s_pool_count, s_window_hours);
  } else {
    copy_text(left, sizeof(left), BUILD_LABEL);
  }
  char age[8] = "";
  sync_age_text(age, sizeof(age));
  draw_band(ctx, GRect(0, bounds.size.h - BOTTOM_CHROME, bounds.size.w, BAND_HEIGHT),
            left, age);
  graphics_context_set_fill_color(ctx, accent());
  graphics_fill_rect(ctx, GRect(0, bounds.size.h - RAIL_HEIGHT, bounds.size.w, RAIL_HEIGHT),
                     0, GCornerNone);
}

static uint16_t list_num_rows(MenuLayer *menu_layer, uint16_t section, void *data) {
  /* The empty list is one row rather than none so it can carry its own
     explanation and stay pressable -- SELECT on it retries. */
  return s_take_count > 0 ? s_take_count : 1;
}

static int16_t list_cell_height(MenuLayer *menu_layer, MenuIndex *index, void *data) {
  if (s_take_count == 0 && s_list_menu) {
    return layer_get_bounds(menu_layer_get_layer(s_list_menu)).size.h;
  }
  return ROW_HEIGHT;
}

static void list_draw_row(GContext *ctx, const Layer *cell, MenuIndex *index, void *data) {
  GRect bounds = layer_get_bounds(cell);

  if (s_take_count == 0) {
    graphics_context_set_text_color(ctx, s_error[0] ? GColorDarkCandyAppleRed : ink());
    const char *message = empty_text();
    int height = text_height(message, s_font_preview, bounds.size.w - 2 * BODY_PAD);
    graphics_draw_text(ctx, message, s_font_preview,
                       GRect(BODY_PAD, (bounds.size.h - height) / 2 - 10,
                             bounds.size.w - 2 * BODY_PAD, height + 4),
                       GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);
    graphics_context_set_text_color(ctx, muted());
    graphics_draw_text(ctx, "SELECT TO RETRY", s_font_dot,
                       GRect(BODY_PAD, (bounds.size.h + height) / 2 + 4,
                             bounds.size.w - 2 * BODY_PAD, BAND_HEIGHT),
                       GTextOverflowModeTrailingEllipsis, GTextAlignmentCenter, NULL);
    return;
  }

  int row = index->row;
  if (row < 0 || row >= s_take_count) {
    return;
  }
  const Take *take = &s_takes[row];
  bool selected = menu_layer_is_index_selected(s_list_menu, index);
  GColor text_color = selected ? GColorWhite : ink();
  GColor meta_color = selected ? GColorLightGray : muted();

  graphics_context_set_fill_color(ctx, karma_color(take->karma));
  graphics_fill_rect(ctx, GRect(0, 0, STRIPE_W, bounds.size.h), 0, GCornerNone);

  int right = bounds.size.w - 6;
  int author_w = right - ROW_GUTTER - METER_W - 4;

  graphics_context_set_text_color(ctx, text_color);
  graphics_draw_text(ctx, take->author, s_font_author,
                     GRect(ROW_GUTTER, -1, author_w, 22),
                     GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);

  char karma[KARMA_TEXT_MAX];
  karma_text(karma, sizeof(karma), take->karma);
  graphics_context_set_text_color(ctx, meta_color);
  graphics_draw_text(ctx, karma, s_font_dot, GRect(right - METER_W, 1, METER_W, 14),
                     GTextOverflowModeTrailingEllipsis, GTextAlignmentRight, NULL);
  graphics_draw_text(ctx, take->age, s_font_dot, GRect(right - METER_W, 13, METER_W, 14),
                     GTextOverflowModeTrailingEllipsis, GTextAlignmentRight, NULL);

  graphics_draw_text(ctx, take->preview, s_font_preview,
                     GRect(ROW_GUTTER, 23, right - ROW_GUTTER, 36),
                     GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);
}

static void list_selection_changed(MenuLayer *menu_layer, MenuIndex new_index,
                                  MenuIndex old_index, void *data) {
  s_selected = new_index.row;
  if (s_list_chrome) {
    layer_mark_dirty(s_list_chrome);
  }
}

static void send_command(int command, int index) {
  DictionaryIterator *iter;
  if (app_message_outbox_begin(&iter) != APP_MSG_OK) {
    return;
  }
  dict_write_uint8(iter, KEY_CMD, command);
  if (index >= 0) {
    dict_write_uint8(iter, KEY_INDEX, (uint8_t)index);
  }
  dict_write_end(iter);
  app_message_outbox_send();
}

static void request_refresh(void) {
  s_error[0] = '\0';
  copy_text(s_status, sizeof(s_status), "Reading LessWrong");
  set_busy(BUSY_LIST, true);
  send_command(CMD_REFRESH, -1);
  if (s_list_chrome) layer_mark_dirty(s_list_chrome);
  if (s_list_menu) layer_mark_dirty(menu_layer_get_layer(s_list_menu));
}

static void request_shuffle(void) {
  s_error[0] = '\0';
  copy_text(s_status, sizeof(s_status), "Dealing again");
  set_busy(BUSY_LIST, true);
  send_command(CMD_SHUFFLE, -1);
  if (s_list_chrome) layer_mark_dirty(s_list_chrome);
}

static void list_select(MenuLayer *menu_layer, MenuIndex *index, void *data) {
  if (s_take_count == 0) {
    request_refresh();
    return;
  }
  request_body(index->row);
  window_stack_push(s_detail_window, true);
}


/////////////////////////////////////////////////////////////// action menu

typedef enum {
  ActionShuffle = 1,
  ActionRefresh
} ActionKind;

static void action_menu_closed(ActionMenu *menu, const ActionMenuItem *performed,
                               void *context) {
  /* The second parameter is the performed item, not the root level, despite
     what the SDK's doc comment says -- so the level has to come through
     ActionMenuConfig.context for there to be anything to free. */
  action_menu_hierarchy_destroy((const ActionMenuLevel *)context, NULL, NULL);
}

static void perform_action(ActionMenu *menu, const ActionMenuItem *action, void *context) {
  switch ((ActionKind)(uintptr_t)action_menu_item_get_action_data(action)) {
    case ActionShuffle:
      request_shuffle();
      return;
    case ActionRefresh:
      request_refresh();
      return;
  }
}

static void list_select_long(MenuLayer *menu_layer, MenuIndex *index, void *data) {
  ActionMenuLevel *level = action_menu_level_create(2);
  if (!level) {
    return;
  }
  action_menu_level_add_action(level, "Shuffle", perform_action, (void *)ActionShuffle);
  action_menu_level_add_action(level, "Refresh", perform_action, (void *)ActionRefresh);
  ActionMenuConfig config = (ActionMenuConfig) {
    .root_level = level,
    .context = level,
    .colors = { .background = accent(), .foreground = GColorWhite },
    .did_close = action_menu_closed,
    .align = ActionMenuAlignCenter
  };
  action_menu_open(&config);
}


////////////////////////////////////////////////////////////////////// detail

static const Take *detail_take(void) {
  if (s_body_index < 0 || s_body_index >= s_take_count) {
    return NULL;
  }
  return &s_takes[s_body_index];
}

static bool detail_ready(void) {
  return s_body_chunks > 0 && s_body_received >= s_body_chunks;
}

static const char *detail_text(void) {
  if (s_error[0]) {
    return s_error;
  }
  if (!detail_ready()) {
    return "Loading…";
  }
  return s_body;
}

static int detail_content_height(int width) {
  int height = text_height(detail_text(), s_font_body, width - 2 * BODY_PAD);
  /* A short take must still fill the scroll view, or ScrollLayer has nothing to
     clamp against and the view sits with its content floating. */
  return clamp_int(height + 2 * BODY_PAD + 8, 120, 4000);
}

static void detail_resize(void) {
  if (!s_detail_scroll || !s_detail_body) {
    return;
  }
  GRect frame = layer_get_frame(scroll_layer_get_layer(s_detail_scroll));
  int height = detail_content_height(frame.size.w);
  layer_set_frame(s_detail_body, GRect(0, 0, frame.size.w, height));
  scroll_layer_set_content_size(s_detail_scroll, GSize(frame.size.w, height));
  layer_mark_dirty(s_detail_body);
  if (s_detail_chrome) {
    layer_mark_dirty(s_detail_chrome);
  }
}

static void detail_body_update_proc(Layer *layer, GContext *ctx) {
  GRect bounds = layer_get_bounds(layer);
  graphics_context_set_fill_color(ctx, panel());
  graphics_fill_rect(ctx, bounds, 0, GCornerNone);
  graphics_context_set_text_color(ctx, s_error[0] ? GColorDarkCandyAppleRed : ink());
  graphics_draw_text(ctx, detail_text(), s_font_body,
                     GRect(BODY_PAD, BODY_PAD, bounds.size.w - 2 * BODY_PAD,
                           bounds.size.h - BODY_PAD),
                     GTextOverflowModeWordWrap, GTextAlignmentLeft, NULL);
}

static void detail_chrome_update_proc(Layer *layer, GContext *ctx) {
  GRect bounds = layer_get_bounds(layer);
  const Take *take = detail_take();
  char right[KARMA_TEXT_MAX + 3 + AGE_MAX] = "";
  if (take) {
    char karma[KARMA_TEXT_MAX];
    karma_text(karma, sizeof(karma), take->karma);
    snprintf(right, sizeof(right), "%s / %s", karma, take->age);
  }
  draw_band(ctx, GRect(0, 0, bounds.size.w, BAND_HEIGHT),
            take ? take->author : "QUICK TAKE", right);
}

static void request_body(int index) {
  index = clamp_int(index, 0, MAX_TAKES - 1);
  if (s_body_index == index && detail_ready()) {
    /* Already in hand from the last time it was opened. */
    detail_resize();
    return;
  }
  s_error[0] = '\0';
  s_body_index = index;
  s_body_chunks = 0;
  s_body_received = 0;
  s_body_len = 0;
  memset(s_body, 0, sizeof(s_body));
  set_busy(BUSY_BODY, true);
  send_command(CMD_BODY_REQUEST, index);
  detail_resize();
}


///////////////////////////////////////////////////////////////// app message

static void store_take(DictionaryIterator *iter) {
  Tuple *index_tuple = dict_find(iter, KEY_INDEX);
  if (!index_tuple) {
    return;
  }
  int index = index_tuple->value->int32;
  if (index < 0 || index >= MAX_TAKES) {
    return;
  }
  Take *take = &s_takes[index];
  Tuple *author = dict_find(iter, KEY_AUTHOR);
  Tuple *age = dict_find(iter, KEY_AGE);
  Tuple *preview = dict_find(iter, KEY_PREVIEW);
  Tuple *karma = dict_find(iter, KEY_KARMA);
  copy_text(take->author, sizeof(take->author), author ? author->value->cstring : "");
  copy_text(take->age, sizeof(take->age), age ? age->value->cstring : "");
  copy_text(take->preview, sizeof(take->preview), preview ? preview->value->cstring : "");
  take->karma = karma ? clamp_int(karma->value->int32, -KARMA_MAX, KARMA_MAX) : 0;
}

static void store_body_chunk(DictionaryIterator *iter) {
  Tuple *index_tuple = dict_find(iter, KEY_INDEX);
  Tuple *offset_tuple = dict_find(iter, KEY_OFFSET);
  Tuple *chunks_tuple = dict_find(iter, KEY_CHUNKS);
  Tuple *body_tuple = dict_find(iter, KEY_BODY);
  if (!offset_tuple || !chunks_tuple || !body_tuple) {
    return;
  }
  /* A chunk for a take we are no longer showing is a straggler from a request
     abandoned by a fast back-and-forward; folding it into this body would
     splice two takes together. */
  if (index_tuple && index_tuple->value->int32 != s_body_index) {
    return;
  }

  int offset = offset_tuple->value->int32;
  int chunks = chunks_tuple->value->int32;
  const char *text = body_tuple->value->cstring;
  if (offset < 0 || chunks <= 0 || offset >= BODY_MAX - 1) {
    return;
  }
  size_t room = (size_t)(BODY_MAX - 1 - offset);
  size_t length = strlen(text);
  if (length > room) {
    length = room;
  }
  /* Written at the byte offset the bridge measured rather than appended, so the
     order chunks arrive in cannot corrupt the result. The bridge splits on
     character boundaries, so an offset always lands between two characters. */
  memcpy(s_body + offset, text, length);
  if (offset + (int)length > s_body_len) {
    s_body_len = offset + (int)length;
  }
  s_body[s_body_len] = '\0';
  trim_partial_utf8(s_body);
  s_body_chunks = chunks;
  s_body_received++;

  if (detail_ready()) {
    set_busy(BUSY_BODY, false);
  }
  detail_resize();
}

static void finish_list(DictionaryIterator *iter) {
  Tuple *total = dict_find(iter, KEY_TOTAL);
  Tuple *pool = dict_find(iter, KEY_POOL);
  Tuple *window = dict_find(iter, KEY_WINDOW);
  s_take_count = total ? clamp_int(total->value->int32, 0, MAX_TAKES) : 0;
  s_pool_count = pool ? pool->value->int32 : s_take_count;
  s_window_hours = window ? window->value->int32 : 24;
  s_status[0] = '\0';
  s_error[0] = '\0';
  s_last_list = time(NULL);
  s_listed_once = true;
  set_busy(BUSY_LIST, false);

  /* The sample changed underneath whatever was cached, so the index it was
     keyed on no longer means the same take. */
  s_body_index = -1;
  s_body_chunks = 0;
  s_body_received = 0;
  s_body_len = 0;

  s_selected = 0;
  if (s_list_menu) {
    menu_layer_reload_data(s_list_menu);
    menu_layer_set_selected_index(s_list_menu, MenuIndex(0, 0), MenuRowAlignTop, false);
    layer_mark_dirty(menu_layer_get_layer(s_list_menu));
  }
  if (s_list_chrome) {
    layer_mark_dirty(s_list_chrome);
  }
}

static void inbox_received_callback(DictionaryIterator *iter, void *context) {
  Tuple *cmd = dict_find(iter, KEY_CMD);
  if (!cmd) {
    return;
  }
  switch (cmd->value->int32) {
    case CMD_TAKE_ITEM:
      store_take(iter);
      break;
    case CMD_TAKE_END:
      finish_list(iter);
      break;
    case CMD_BODY_CHUNK:
      store_body_chunk(iter);
      break;
    case CMD_STATUS: {
      Tuple *status = dict_find(iter, KEY_STATUS);
      if (status) {
        copy_text(s_status, sizeof(s_status), status->value->cstring);
        if (s_take_count == 0 && s_list_menu) {
          layer_mark_dirty(menu_layer_get_layer(s_list_menu));
        }
      }
      break;
    }
    case CMD_ERROR: {
      Tuple *error = dict_find(iter, KEY_ERROR);
      copy_text(s_error, sizeof(s_error), error ? error->value->cstring : "Bridge error");
      s_status[0] = '\0';
      /* Every failure path lands here, so this is the one place that has to
         clear the whole mask -- a branch that cleared only its own flag would
         leave the rail sweeping forever. */
      set_busy(BUSY_LIST | BUSY_BODY, false);
      if (s_list_menu) layer_mark_dirty(menu_layer_get_layer(s_list_menu));
      if (s_list_chrome) layer_mark_dirty(s_list_chrome);
      detail_resize();
      break;
    }
    default:
      break;
  }
}

static void inbox_dropped_callback(AppMessageResult reason, void *context) {
  copy_text(s_error, sizeof(s_error), "Message dropped");
  set_busy(BUSY_LIST | BUSY_BODY, false);
  if (s_list_chrome) layer_mark_dirty(s_list_chrome);
}

static void outbox_failed_callback(DictionaryIterator *iter, AppMessageResult reason,
                                   void *context) {
  copy_text(s_error, sizeof(s_error), "Phone not reachable");
  set_busy(BUSY_LIST | BUSY_BODY, false);
  if (s_list_menu) layer_mark_dirty(menu_layer_get_layer(s_list_menu));
  if (s_list_chrome) layer_mark_dirty(s_list_chrome);
}


/////////////////////////////////////////////////////////////////// windows

static void add_rail(Window *window, Layer **slot) {
  Layer *rail = layer_create(GRect(0, BAND_HEIGHT, SCREEN_W, RAIL_HEIGHT));
  if (!rail) {
    return;
  }
  layer_set_update_proc(rail, rail_update_proc);
  layer_add_child(window_get_root_layer(window), rail);
  *slot = rail;
}

static void list_window_load(Window *window) {
  Layer *root = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(root);
  window_set_background_color(window, chassis());

  GRect list = GRect(PANEL_INSET, TOP_CHROME, bounds.size.w - 2 * PANEL_INSET,
                     bounds.size.h - TOP_CHROME - BOTTOM_CHROME);
  s_list_menu = menu_layer_create(list);
  menu_layer_set_normal_colors(s_list_menu, panel(), ink());
  menu_layer_set_highlight_colors(s_list_menu, ink(), panel());
  menu_layer_set_callbacks(s_list_menu, NULL, (MenuLayerCallbacks) {
    .get_num_rows = list_num_rows,
    .get_cell_height = list_cell_height,
    .draw_row = list_draw_row,
    .select_click = list_select,
    .select_long_click = list_select_long,
    .selection_changed = list_selection_changed
  });
  menu_layer_set_click_config_onto_window(s_list_menu, window);
  layer_add_child(root, menu_layer_get_layer(s_list_menu));

  s_list_chrome = layer_create(bounds);
  layer_set_update_proc(s_list_chrome, list_chrome_update_proc);
  layer_add_child(root, s_list_chrome);

  add_rail(window, &s_list_rail);
}

static void list_window_unload(Window *window) {
  if (s_list_menu) menu_layer_destroy(s_list_menu);
  if (s_list_chrome) layer_destroy(s_list_chrome);
  if (s_list_rail) layer_destroy(s_list_rail);
  s_list_menu = NULL;
  s_list_chrome = NULL;
  s_list_rail = NULL;
}

static void detail_window_load(Window *window) {
  Layer *root = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(root);
  window_set_background_color(window, chassis());

  GRect glass = GRect(PANEL_INSET, TOP_CHROME, bounds.size.w - 2 * PANEL_INSET,
                      bounds.size.h - TOP_CHROME - PANEL_INSET);
  s_detail_scroll = scroll_layer_create(glass);
  if (!s_detail_scroll) {
    return;
  }
  scroll_layer_set_click_config_onto_window(s_detail_scroll, window);
  scroll_layer_set_shadow_hidden(s_detail_scroll, true);
  layer_add_child(root, scroll_layer_get_layer(s_detail_scroll));

  s_detail_body = layer_create(GRect(0, 0, glass.size.w, glass.size.h));
  if (!s_detail_body) {
    return;
  }
  layer_set_update_proc(s_detail_body, detail_body_update_proc);
  scroll_layer_add_child(s_detail_scroll, s_detail_body);

  s_detail_chrome = layer_create(GRect(0, 0, bounds.size.w, BAND_HEIGHT));
  if (!s_detail_chrome) {
    return;
  }
  layer_set_update_proc(s_detail_chrome, detail_chrome_update_proc);
  layer_add_child(root, s_detail_chrome);

  add_rail(window, &s_detail_rail);
  detail_resize();
}

static void detail_window_appear(Window *window) {
  if (s_detail_scroll) {
    scroll_layer_set_content_offset(s_detail_scroll, GPoint(0, 0), false);
  }
}

static void detail_window_unload(Window *window) {
  if (s_detail_body) layer_destroy(s_detail_body);
  if (s_detail_scroll) scroll_layer_destroy(s_detail_scroll);
  if (s_detail_chrome) layer_destroy(s_detail_chrome);
  if (s_detail_rail) layer_destroy(s_detail_rail);
  s_detail_body = NULL;
  s_detail_scroll = NULL;
  s_detail_chrome = NULL;
  s_detail_rail = NULL;
}

/* A notification overlay takes the screen without unloading anything under it,
   so without this the sweep would keep repainting a rail nobody can see. */
static void app_focus_changed(bool in_focus) {
  s_focused = in_focus;
  update_busy_timer();
}

static void minute_tick(struct tm *tick_time, TimeUnits units_changed) {
  if (s_list_chrome && window_stack_get_top_window() == s_list_window) {
    layer_mark_dirty(s_list_chrome);
  }
}

static void init(void) {
  s_font_dot = fonts_load_custom_font(resource_get_handle(RESOURCE_ID_FONT_DOT_10));
  s_font_author = fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD);
  s_font_preview = fonts_get_system_font(FONT_KEY_GOTHIC_14);
  s_font_body = fonts_get_system_font(FONT_KEY_GOTHIC_18);

  copy_text(s_status, sizeof(s_status), "Reading LessWrong");
  s_window_hours = 24;
  set_busy(BUSY_LIST, true);

  s_list_window = window_create();
  window_set_window_handlers(s_list_window, (WindowHandlers) {
    .load = list_window_load,
    .unload = list_window_unload
  });

  s_detail_window = window_create();
  window_set_window_handlers(s_detail_window, (WindowHandlers) {
    .load = detail_window_load,
    .appear = detail_window_appear,
    .unload = detail_window_unload
  });

  app_message_register_inbox_received(inbox_received_callback);
  app_message_register_inbox_dropped(inbox_dropped_callback);
  app_message_register_outbox_failed(outbox_failed_callback);
  app_message_open(1024, 128);
  app_focus_service_subscribe(app_focus_changed);
  tick_timer_service_subscribe(MINUTE_UNIT, minute_tick);

  window_stack_push(s_list_window, true);
}

static void deinit(void) {
  app_focus_service_unsubscribe();
  tick_timer_service_unsubscribe();
  if (s_busy_timer) {
    app_timer_cancel(s_busy_timer);
  }
  if (s_list_window) window_destroy(s_list_window);
  if (s_detail_window) window_destroy(s_detail_window);
  if (s_font_dot) fonts_unload_custom_font(s_font_dot);
}

int main(void) {
  init();
  app_event_loop();
  deinit();
  return 0;
}
