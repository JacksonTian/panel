/*global _*/
(function () {
  var root = this;
  var hasTouch = 'ontouchstart' in window;
  var START_EV = hasTouch ? 'panstart' : 'mousedown';
  var MOVE_EV = hasTouch ? 'pan' : 'mousemove';
  var END_EV = hasTouch ? 'panend' : 'mouseup';

  var getBezier = function (a, b) {
    return [
      [(a / 3 + (a + b) / 3 - a) / (b - a), (a * a / 3 + a * b * 2 / 3 - a * a) / (b * b - a * a)],
      [(b / 3 + (a + b) / 3 - a) / (b - a), (b * b / 3 + a * b * 2 / 3 - a * a) / (b * b - a * a)]
    ];
  };

  var Panel = function (el, options) {
    this.x = 0;
    this.y = 0;
    this.status = 'free';
    this.animating = false;
    this.el = el;
    this.viewport = $(el[0].parentNode);
    this.currPageX = 0;
    this.currPageY = 0;
    this.options = {
      parent: null,
      snap: false,
      vScroll: true,
      hScroll: true,
      vScrollbar: false,
      // 如果为true，内容区域小于视窗区域时，不启用任何触屏效果
      auto: false,
      // 边界检查，设为true时，滑动不允许越出边界
      bounce: false,
      // 边界, outter或inner，或者自定义的[x1, x2, y1, y2]
      bound: "inner"
    };
    $.extend(this.options, options);
    this.init();
  };

  Panel.prototype._bound = function () {
    var viewportWidth = this.viewport.width();
    var viewportHeight = this.viewport.height();
    var elWidth = this.el.width();
    var elHeight = this.el.height();
    this.outterBound = [-elWidth, viewportWidth, -elHeight, viewportHeight];
    this.innerBound = [
      viewportWidth >= elWidth ? 0 : viewportWidth - elWidth, // x1
      viewportWidth >= elWidth ? viewportWidth - elWidth : 0, // x2
      viewportHeight >= elHeight ? 0 : viewportHeight - elHeight, // y1
      viewportHeight >= elHeight ? viewportHeight - elHeight : 0 // y2
    ];
    this.bound = (typeof this.options.bound === 'string') ? this[this.options.bound + "Bound"]
      : this.options.bound;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.elWidth = elWidth;
    this.elHeight = elHeight;
  };

  Panel.prototype.isMoved = function () {
    var ret = false;
    // 当在触摸中
    if (this.status === 'touching') {
      ret = true;
    } else {
      // 当按格停靠时，没有停在格点上
      if (typeof this.options.snap === 'string') {
        ret = this.x % this.snapWidth !== 0 || this.y % this.snapHeight !== 0;
      } else if (this.options.snap) {
        ret = this.x !== 0 || this.y !== 0;
      }
    }
    return ret;
  };

  Panel.prototype.init = function () {
    var that = this;
    this._bound();
    if (typeof this.options.snap === 'string') {
      this.snapEl = this.el.find(this.options.snap);
      this.snapWidth = this.snapEl.width();
      this.snapHeight = this.snapEl.height();
    }
    // 如果设置auto为true，当内容小于视窗区域时，不添加触摸事件
    if (that.options.auto) {
      var el = this.el;
      var viewport = this.viewport;
      if (el.width() <= viewport.width() && el.height() <= viewport.height()) {
        return;
      }
    }
    that.el.bind(START_EV, function (event) {
      that._start(event);
    });

    if (that.options.vScrollbar) {
      // Create the scrollbar wrapper
      var bar = $('<div></div>');

      bar.css({
        'position': 'absolute',
        'z-index': 100,
        'width': 7,
        'bottom': 2,
        'top': 2,
        'right': 1,
        'pointer-events': 'none',
        '-webkit-transition-property': 'opacity',
        '-webkit-transition-duration': '350ms',
        'overflow': 'hidden',
        'opacity': '0',
        'border-radius': '4px'
      });
      this.viewport.append(bar);
      // Create the scrollbar indicator
      var indicator = $('<div></div>');
      indicator.css({
        'position': 'absolute',
        'z-index': 100,
        'background-color': 'rgba(0,0,0,0.5)',
        'border': '1px solid rgba(255,255,255,0.9)',
        '-webkit-background-clip': 'padding-box',
        'box-sizing': 'border-box',
        'width': '100%',
        'border-radius': '3px',
        'pointer-events': 'none',
        '-webkit-transition-property': '-webkit-transform',
        '-webkit-transition-timing-function': 'cubic-bezier(0.33,0.66,0.66,1)',
        '-webkit-transition-duration': '0',
        '-webkit-transform': 'translate3d(0, 0, 0)'
      });
      bar.append(indicator);
      var barHeight = bar.height();
      indicator.css('height', Math.max(Math.round(barHeight * barHeight / this.el.height()), 8));
      this.bar = bar;
      this.indicator = indicator;
    }
  };

  var isMoved = function (panel) {
    if (panel) {
      if (panel.isMoved()) {
        return true;
      } else {
        return isMoved(panel.options.parent);
      }
    } else {
      return false;
    }
  };

  Panel.prototype._start = function (event) {
    // 父容器移动时，子容器不再触发事件
    if (isMoved(this.options.parent)) {
      return;
    }
    if (["SELECT", "INPUT", "TEXTAREA"].indexOf(event.target.tagName) === -1) {
      this.startTime = Date.now();
      this.pageX = event.pageX;
      this.pageY = event.pageY;
      this._bound();
      this.direction = Math.abs(event.offsetX) > Math.abs(event.offsetY) ? 'h' : 'v';
      if (this.direction === 'v') {
        this.setScrollbar();
      }
      if (this.options.pullDownEl) {
        this.pullDownEl = this.options.pullDownEl;
        this.pullDownElHeight = this.pullDownEl.height();
      }
      var that = this;
      this.el.bind(MOVE_EV, function (event) {
        that._move(event);
      });
      this.el.bind(END_EV, function (event) {
        that._end(event);
      });
    }
  };

  Panel.prototype._move = function (event) {
    event.preventDefault();
    if (isMoved(this.options.parent)) {
      return;
    }

    this.status = 'touching';
    // 偏移量
    var deltaX = event.pageX - this.pageX;
    var deltaY = event.pageY - this.pageY;
    this.pageX = event.pageX;
    this.pageY = event.pageY;
    // 做方向判定
    if (this.direction === 'h') {
      deltaY = 0;
    } else {
      deltaX = 0;
    }

    // 是否冒泡给父元素
    if (!this.options.vScroll && this.direction === 'v') {
      event.cancelBubble = false;
    } else {
      event.cancelBubble = true;
    }
    if (!this.options.hScroll && this.direction === 'h') {
      event.cancelBubble = false;
    } else {
      event.cancelBubble = true;
    }

    // 更新位置
    this._pos(deltaX, deltaY);
    if (this.options.pullDownEl) {
      if (this.y > this.pullDownElHeight) {
        if (!this.pullDownEl.hasClass('show')) {
          this.pullDownEl.addClass('show');
          if (this.options.pullDownAction) {
            this.options.pullDownAction.call(this.pullDownEl, true);
          }
        }
      } else {
        if (this.pullDownEl.hasClass('show')) {
          this.pullDownEl.removeClass('show');
          if (this.options.pullDownAction) {
            this.options.pullDownAction.call(this.pullDownEl, false);
          }
        }
      }
    }
    if (this.options.onScrollMove) {
      this.options.onScrollMove.call(this, event);
    }
  };

  Panel.prototype._end = function (event) {
    var that = this;
    this.status = 'free';
    var x = this.x;
    var y = this.y;
    // 每次触摸完成，重新计算下边界
    var bound = this.bound;
    var options = this.options;
    var time = 200;
    var timing = 'ease';
    var callback = null;
    var speedX, speedY;
    if (event.duration < 300) {
      speedX = event.offsetX / event.duration;
      speedX = Math.min(Math.max(speedX, -1.5), 1.5);
      speedY = event.offsetY / event.duration;
      speedY = Math.min(Math.max(speedY, -1.5), 1.5);
      if (!this.options.vScroll) {
        speedY = 0;
      }
      if (!this.options.hScroll) {
        speedX = 0;
      }

      // 是否冒泡给父元素
      if (!this.options.vScroll && this.direction === 'v') {
        event.cancelBubble = false;
      } else {
        event.cancelBubble = true;
      }
      if (!this.options.hScroll && this.direction === 'h') {
        event.cancelBubble = false;
      } else {
        event.cancelBubble = true;
      }

      var speed = Math.sqrt(speedX * speedX + speedY * speedY);
      speed = Math.min(Math.max(speed, -1.5), 1.5);
      // 减速度
      var deceleration = 0.0015 * (speed / Math.abs(speed));
      time = speed / deceleration;
      var distance = time * speed / 2;
      var distance2 = Math.pow(distance, 2);

      var distanceX, distanceY;

      if (speedX === 0) {
        distanceX = 0;
        distanceY = distance;
      } else if (speedY === 0) {
        distanceX = distance;
        distanceY = 0;
      } else {
        var tan2 = Math.pow(speedX / speedY, 2);
        distanceX = Math.sqrt(tan2 * distance2 / (tan2 + 1));
        distanceY = Math.sqrt(distance2 / (tan2 + 1));
      }

      x += (speedX > 0 ? 1 : -1) * distanceX;
      y += (speedY > 0 ? 1 : -1) * distanceY;
      if (y > bound[3] || y < bound[2]) {
        var sign = y > 0 ? 1 : -1,
          edge = y > 0 ? 0 : bound[2];

        y = (y - edge) / 2 + edge;
        time = (sign * Math.sqrt(2 * deceleration * (y - this.y) + speedY * speedY) - speedY) / deceleration;
        timing = getBezier(-speedY / deceleration, -speedY / deceleration + time);
        callback = function () {
          speedY = speedY - deceleration * time;
          deceleration = 0.0045 * (speedY / Math.abs(speedY));
          time = -speedY / deceleration;
          y = edge;

          var timing = 'cubic-bezier(' + getBezier(-time, 0) + ')';
          that.el.anim({translate3d: x + "px, " + y + "px, 0"}, time, timing, function () {
            that.resetScrollbar();
          });
        };
      } else {
        timing = 'cubic-bezier(' + getBezier(-time, 0) + ')';
      }
    }

    if (this.options.snap) {
      // 弹回边界
      if (options.snap === true) {
        x = Math.abs(x - bound[0]) > Math.abs(x - bound[1]) ? bound[1] : bound[0];
        this.currPageX = Math.round(-1 * x / this.viewport.width());
      } else {
        var hColumn = Math.round(x / this.snapWidth);
        var maxColumn = Math.ceil(this.el.width() / this.viewport.width());
        // 边界检查
        hColumn = Math.min(Math.max(-maxColumn + 1, hColumn), 0);
        if (deceled) {
          this.currPageX += (speedX > 0 ? -1 : 1);
          this.currPageX = Math.min(Math.max(0, this.currPageX), maxColumn - 1);
          x = this.currPageX * this.snapWidth * -1;
        } else {
          x = hColumn * this.snapWidth;
          this.currPageX = -hColumn;
        }
      }
      if (!options.hScroll) {
        this.currPageX = 0;
        x = 0;
      }
      // 弹回边界
      if (options.snap === true) {
        y = Math.abs(y - bound[2]) > Math.abs(y - bound[3]) ? bound[3] : bound[2];
        this.currPageY = Math.round(-1 * y / this.viewport.height());
      } else {
        var vColumn = Math.round(y / this.snapHeight);
        var vMaxColumn = Math.ceil(this.el.height() / this.viewport.height());
        // 边界检查
        vColumn = Math.min(Math.max(-vMaxColumn + 1, vColumn), 0);
        y = vColumn * this.snapHeight;
        this.currPageY = -vColumn;
      }
      if (!options.vScroll) {
        this.currPageY = 0;
        y = 0;
      }
    } else {
      // 不做靠边处理时，越出边界还是要做检查的
      x = Math.max(Math.min(bound[1], x), bound[0]);
      y = Math.max(Math.min(bound[3], y), bound[2]);
    }
    this.x = x;
    this.y = y;
    this.direction = '';
    time = (time / 1000).toFixed(2);
    this.el.anim({translate3d: x + "px, " + y + "px, 0"}, time, timing, function () {
      that.resetScrollbar();
    });
    that.scrollbar(time, timing);
    if (that.options.onScrollEnd) {
      that.options.onScrollEnd.call(that);
    }
    this.el.unbind(MOVE_EV);
    this.el.unbind(END_EV);
  };

  Panel.prototype._pos = function (deltaX, deltaY) {
    var x = this.x + deltaX;
    var y = this.y + deltaY;
    var options = this.options;
    var bound = this.bound;
    if (options.bounce) {
      x = Math.max(Math.min(bound[1], x), bound[0]);
      y = Math.max(Math.min(bound[3], y), bound[2]);
    } else {
      // Slow down if outside of the boundaries
      // 越界时做减速
      if (x < bound[0] || x > bound[1]) {
        x = this.x + deltaX / 2;
      }
      if (y < bound[2] || y > bound[3]) {
        y = this.y + deltaY / 2;
      }
    }
    if (!options.vScroll) {
      y = 0;
    }
    if (!options.hScroll) {
      x = 0;
    }
    this.el.anim({translate3d: x + "px, " + y + "px, 0"}, 0, 'ease');
    this.x = x;
    this.y = y;
    this.scrollbar(0, 'ease');
  };

  Panel.prototype.scrollbar = function (time, timing) {
    if (this.options.vScrollbar) {
      var y = - this.y / this.elHeight * this.viewportHeight;
      this.indicator.anim({translate3d: '0, ' + y + 'px, 0'}, time, timing);
    }
  };

  Panel.prototype.setScrollbar = function () {
    if (this.options.vScrollbar) {
      this.bar.css('-webkit-transition-delay', '0');
      this.bar.css('opacity', '1');
    }
  };

  Panel.prototype.resetScrollbar = function () {
    if (this.options.vScrollbar) {
      this.bar.css('-webkit-transition-delay', '300ms');
      this.bar.css('opacity', '0');
    }
  };

  Panel.prototype.refresh = function () {
    this._bound();
    var bound = this.bound;
    this.x = Math.max(Math.min(bound[1], this.x), bound[0]);
    this.y = Math.max(Math.min(bound[3], this.y), bound[2]);
    this.el.anim({translate3d: this.x + "px, " + this.y + "px, 0"}, 0.4, 'ease');
  };

  Panel.prototype.scrollTo = function () {};

  Panel.prototype.scrollToElement = function (el, time) {
    var that = this;
    if (!el) {
      return;
    }
    this._bound();
    el = $(el);

    var elOffset = el.offset();
    var scrollerOffset = this.el.offset();

    var offsetX = scrollerOffset.left - elOffset.left;
    var offsetY = scrollerOffset.top - elOffset.top;

    var bound = this.bound;
    var x = Math.max(Math.min(bound[1], offsetX), bound[0]);
    var y = Math.max(Math.min(bound[3], offsetY), bound[2]);

    time = time || 0.2;
    this.el.anim({translate3d: x + "px, " + y + "px, 0"}, time, 'ease-in-out', function () {
      that.animating = true;
    });
    this.x = x;
    this.y = y;
    if (this.options.onScrollEnd) {
      this.options.onScrollEnd.call(this);
    }
  };

  Panel.prototype.scrollToPage = function (pageX, pageY, time) {
    var that = this;
    time = time || 400;
    time = time / 1000;

    if (typeof this.options.snap === "string") {
      this.currPageX = pageX === 'next' ? this.currPageX + 1 : pageX === 'prev' ? this.currPageX - 1 : pageX;
      that.currPageY = pageY === 'next' ? that.currPageY + 1 : pageY === 'prev' ? that.currPageY - 1 : pageY;
      var x = this.currPageX * this.snapWidth * -1;
      var y = that.currPageY * this.snapHeight * -1;
      this.el.anim({translate3d: x + "px, " + y + "px, 0"}, time, 'ease-in-out', function () {
        that.animating = true;
      });
      this.x = x;
      this.y = y;
      if (this.options.onScrollEnd) {
        this.options.onScrollEnd.call(this);
      }
    }
  };

  Panel.prototype.destroy = function () {
    this.el.unbind();
    this.el = null;
    this.viewport = null;
    this.snapEl = null;
  };

  root.Panel = Panel;
}());
