/*global _*/
(function () {
  var root = this;
  var hasTouch = 'ontouchstart' in window;
  var START_EV = hasTouch ? 'panstart' : 'mousedown';
  var MOVE_EV = hasTouch ? 'pan' : 'mousemove';
  var END_EV = hasTouch ? 'panend' : 'mouseup';

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
      // 如果为true，内容区域小于视窗区域时，不启用任何触屏效果
      auto: false,
      // 边界检查，设为true时，滑动不允许越出边界
      bounce: false,
      // 边界, outter或inner，或者自定义的[x1, x2, y1, y2]
      bound: "inner"
    };
    _.extend(this.options, options);
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
    if (typeof this.options.snap === 'string') {
      this.snapEl = this.el.find(this.options.snap);
      this.snapWidth = this.snapEl.width();
      this.snapHeight = this.snapEl.height();
    }
    // 如果设置auto为true，当内容小于视窗区域时，不添加触摸事件
    if (that.options.auto) {
      var el = this.el;
      var viewport = this.viewport;
      if (el.width() <= viewport.width() && el.height <= viewport.width()) {
        return;
      }
    }
    that.el.bind(START_EV, function (event) {
      that._start(event);
    });
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
      this.direction = '';
      this.pageX = event.pageX;
      this.pageY = event.pageY;
      this._bound();
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
    if (!this.direction) {
      this.direction = Math.abs(deltaX) > Math.abs(deltaY) ? 'h' : 'v';
      if (this.direction === 'h') {
        deltaY = 0;
      } else {
        deltaX = 0;
      }
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
  };

  Panel.prototype._end = function () {
    var that = this;
    this.status = 'free';
    var x = this.x;
    var y = this.y;
    this.direction = '';
    var options = this.options;
    // 每次触摸完成，重新计算下边界
    var bound = this.bound;
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
        x = hColumn * this.snapWidth;
        this.currPageX = -hColumn;
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
    this.animating = true;
    this.el.anim({translate3d: x + "px, " + y + "px, 0"}, 0.2, 'ease-in-out', function () {
      that.animating = true;
    });
    if (that.options.onScrollEnd) {
      that.options.onScrollEnd.call(that);
    }
  };

  Panel.prototype._pos = function (deltaX, deltaY) {
    var x = this.x + deltaX;
    var y = this.y + deltaY;
    var options = this.options;
    if (options.bounce) {
      var bound = this.bound;
      x = Math.max(Math.min(bound[1], x), bound[0]);
      y = Math.max(Math.min(bound[3], y), bound[2]);
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
  };

  Panel.prototype.refresh = function () {};

  Panel.prototype.scrollTo = function () {};
  Panel.prototype.scrollToElement = function () {};

  Panel.prototype.scrollToPage = function (pageX, pageY, time) {
    var that = this;
    time = time || 400;
    time = time / 1000;

    if (typeof this.options.snap === "string") {
      this.currPageX = pageX === 'next' ? this.currPageX + 1 : pageX === 'prev' ? this.currPageX - 1 : pageX;
      // that.currPageY = pageY === 'next' ? that.currPageY + 1 : pageY === 'prev' ? that.currPageY - 1 : pageY;
      var snap = this.el.find(this.options.snap).width();
      var x = this.currPageX * snap * -1;
      // y = that.currPageX * snap;
      this.el.anim({translate3d: x + "px, " + this.y + "px, 0"}, time, 'ease-in-out', function () {
        that.animating = true;
      });
      this.x = x;
      if (this.options.onScrollEnd) {
        this.options.onScrollEnd.call(this);
      }
    }
  };

  root.Panel = Panel;
}());
