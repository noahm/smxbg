var Background = (function () {
  function shuffle(data) {
    for (var i = 0; i < data.length; ++i) {
      var swapIdx = Math.floor(Math.random() * i);
      var swap = data[i];
      data[i] = data[swapIdx];
      data[swapIdx] = swap;
    }
  }

  function scale(x, l1, h1, l2, h2) {
    return ((x - l1) * (h2 - l2)) / (h1 - l1) + l2;
  }

  var rand = function (min, max) {
    return Math.random() * (max - min) + min;
  };

  // Cycle from 1 to 0 to 1.
  function cycle(value) {
    var result = value * 2; // 0..2
    result -= 1; // -1..+1
    result = Math.abs(result); // +1..0..+1
    return result;
  }

  var Params = {
    NumParticles: 30,
    VelocityXMin: -10,
    VelocityXMax: 10,
    VelocityYMin: -10,
    VelocityYMax: 10,
    ZoomMin: 0.2,
    ZoomMax: 1.3,
  };

  var SCREEN_WIDTH = 1280;
  var SCREEN_HEIGHT = 720;

  var Background = function () {
    this.init = this.init.bind(this);
    this.draw = this.draw.bind(this);
    this.resize = this.resize.bind(this);
    this.update = this.update.bind(this);
    this.init();
    // window.addEventListener("DOMContentLoaded", this.init);
  };

  Background.prototype.init = function () {
    this.loading = true;

    // Set the canvas size immediately, so if it's visible before we start drawing it'll already
    // cover the window.  This won't draw yet since we haven't loaded images.

    this.images = {};
    this.load_image("under", "img/under.png");
    this.load_image("checkerboard", "img/checkerboard.png");
    this.load_image("particle", "img/particles.png");
    this.load_image("clouds", "img/clouds.jpg");
    // this.load_image("scanline", "img/scanline.png");
    this.load_image("arrow", "img/arrow.png");
    this.load_image("stars", "img/stars.png");
    this.load_image("starcloud", "img/starcloud.png");
    this.resize();
  };

  Background.prototype.load_image = function (name, url) {
    if (!this.loading_images) this.loading_images = 0;

    var img = document.createElement("img");
    img.src = url;
    img.addEventListener(
      "load",
      function (e) {
        this.loading_images--;

        // If we don't have any more images to load, continue init.
        if (this.loading_images == 0) this.init2();
      }.bind(this)
    );

    img.addEventListener(
      "error",
      function (e) {
        console.log("Error loading " + url);
      }.bind(this)
    );

    this.loading_images++;
    this.images[name] = img;
    return img;
  };

  // This is called after all of our images are loaded.
  Background.prototype.init2 = function () {
    this.loading = false;
    this.lastUpdateTime = Date.now();

    this.canvas = document.querySelector("#canvas");
    this.ctx = this.canvas.getContext("2d");

    this.starCanvas = document.createElement("canvas");
    this.starCanvas.width = this.canvas.width;
    this.starCanvas.height = this.canvas.height / 2;

    this.arrowCanvas = document.createElement("canvas");
    this.arrowCanvas.width = this.canvas.width / 2;
    this.arrowCanvas.height = this.canvas.height / 2;

    this.cloudsOffset1 = rand(0, 1000);
    this.cloudsOffset2 = this.cloudsOffset1 + 250;
    this.cloudsVisibility1 = 0;
    this.cloudsVisibility2 = 0;
    this.starScrollPosition = 0;
    this.arrowScrollPosition = 0;

    // Create the clouds.  This just applies a gradient to the cloud image, so we can send it
    // as a JPG instead of a PNG.  We only create this once and then reuse it, so this shouldn't
    // affect performance.
    this.cloudCanvas = this.MakeCloudCanvas();

    var ZoomList = [];
    for (var idx = 0; idx < Params.NumParticles; ++idx) {
      var zoom = scale(
        idx,
        0,
        Params.NumParticles - 1,
        Params.ZoomMin,
        Params.ZoomMax
      );
      ZoomList.push(zoom);
    }
    shuffle(ZoomList);

    this.Particles = [];
    for (var i = 0; i < Params.NumParticles; ++i) {
      var particleWidth = this.images.particle.width;
      this.Particles.push({
        XVelocity: rand(Params.VelocityXMin, Params.VelocityXMax),
        YVelocity: rand(Params.VelocityYMin, Params.VelocityYMax),
        x: rand(
          this.images.particle.width / 2,
          SCREEN_WIDTH - this.images.particle.width / 2
        ),
        y: rand(
          this.images.particle.height / 2,
          SCREEN_HEIGHT - this.images.particle.height / 2
        ),
        zoom: ZoomList[i],
      });
    }

    window.addEventListener(
      "resize",
      function (e) {
        this.resize();
      }.bind(this),
      false
    );
    this.resize();
    this.draw();
  };

  Background.prototype.MakeCloudCanvas = function () {
    var cloudCanvas = document.createElement("canvas");
    cloudCanvas.width = this.images.clouds.width;
    cloudCanvas.height = this.images.clouds.height;
    var cloudCtx = cloudCanvas.getContext("2d");
    cloudCtx.clearRect(0, 0, cloudCanvas.width, cloudCanvas.height);
    cloudCtx.drawImage(
      this.images.clouds,
      0,
      0,
      this.images.clouds.width,
      this.images.clouds.height,
      0,
      0,
      this.images.clouds.width,
      this.images.clouds.height
    );

    var gradient = cloudCtx.createLinearGradient(0, 0, 0, cloudCanvas.height);
    gradient.addColorStop(0.0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.6, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(1.0, "rgba(255, 255, 255, 0)");
    cloudCtx.save();
    cloudCtx.fillStyle = gradient;
    cloudCtx.globalCompositeOperation = "destination-in";
    cloudCtx.fillRect(0, 0, cloudCanvas.width, cloudCanvas.height);
    cloudCtx.restore();

    return cloudCanvas;
  };

  Background.prototype.updateParticles = function (deltaTime) {
    for (var i = 0; i < this.Particles.length; ++i) {
      var particleInfo = this.Particles[i];

      var vX = particleInfo.XVelocity;
      var vY = particleInfo.YVelocity;
      vX = particleInfo.x + vX * deltaTime;
      vY = particleInfo.y + vY * deltaTime;

      var HalfWidth = (this.images.particle.width / 2) * particleInfo.zoom;
      if (vX > SCREEN_WIDTH + HalfWidth) vX = -HalfWidth;
      else if (vX < -HalfWidth) vX = SCREEN_WIDTH + HalfWidth;

      var HalfHeight = (this.images.particle.height / 2) * particleInfo.zoom;
      if (vY > SCREEN_HEIGHT + HalfHeight) vY = -HalfHeight;
      else if (vY < -HalfHeight) vY = SCREEN_HEIGHT + HalfHeight;

      particleInfo.x = vX;
      particleInfo.y = vY;
    }
  };

  Background.prototype.update = function () {
    var now = Date.now();
    var deltaTime = (now - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = now;
    this.updateParticles(deltaTime);

    this.cloudsOffset1 += deltaTime * 5; // cloud 1 pan speed
    this.cloudsOffset2 += deltaTime * 7.5; // cloud 2 pan speed
    this.cloudsVisibility1 += deltaTime / 8; // cloud 1 visibility cycle
    this.cloudsVisibility2 += deltaTime / 13.375; // cloud 2 visibility cycle
    this.starScrollPosition += deltaTime * 35;
    this.arrowScrollPosition += deltaTime * 100;
  };

  Background.prototype.draw = function () {
    if (this.loading) return;

    this.update();

    cancelAnimationFrame(this.waitingForDraw);
    this.waitingForDraw = null;

    // Queue the next draw.
    this.waitingForDraw = requestAnimationFrame(this.draw);

    this.ctx.save();

    // Background
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.images.under, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    this.ctx.save();
    this.ctx.globalCompositeOperation = "lighter"; // additive
    this.ctx.drawImage(
      this.images.checkerboard,
      0,
      0,
      SCREEN_WIDTH,
      SCREEN_HEIGHT
    );
    this.ctx.restore();

    var starCtx = this.starCanvas.getContext("2d");
    starCtx.clearRect(0, 0, this.starCanvas.width, this.starCanvas.height);

    starCtx.save();
    starCtx.translate(
      -(this.starScrollPosition % this.images.starcloud.width),
      0
    );
    for (var i = 0; i < 6; ++i) {
      starCtx.drawImage(
        this.images.starcloud,
        0,
        0,
        this.images.starcloud.width,
        this.images.starcloud.height,
        0,
        0,
        this.images.starcloud.width,
        this.images.starcloud.height
      );
      starCtx.translate(this.images.starcloud.width, 0);
    }
    starCtx.restore();

    starCtx.save();
    starCtx.globalCompositeOperation = "destination-in";
    starCtx.drawImage(
      this.images.stars,
      0,
      0,
      this.images.stars.width,
      this.images.stars.height,
      0,
      0,
      SCREEN_WIDTH,
      SCREEN_HEIGHT / 2
    );
    starCtx.restore();

    this.ctx.save();
    this.ctx.globalCompositeOperation = "lighter"; // additive
    this.ctx.drawImage(this.starCanvas, 0, 0);
    this.ctx.restore();

    // Clouds
    this.ctx.save();
    this.ctx.globalCompositeOperation = "lighter"; // additive
    this.ctx.globalAlpha =
      0.75 * scale(cycle(this.cloudsVisibility1 % 1), 0, 1, 0.5, 1);
    var xScale = SCREEN_WIDTH / 2.56;
    this.ctx.translate(-this.cloudsOffset1 % xScale, 0);
    for (var i = 0; i < 6; ++i) {
      this.ctx.drawImage(
        this.cloudCanvas,
        0,
        0,
        this.cloudCanvas.width,
        this.cloudCanvas.height,
        0,
        0,
        xScale,
        SCREEN_HEIGHT / 2
      );
      this.ctx.translate(xScale, 0);
    }
    this.ctx.restore();

    this.ctx.save();
    this.ctx.globalCompositeOperation = "lighter"; // additive
    this.ctx.globalAlpha =
      0.75 * scale(cycle(this.cloudsVisibility2 % 1), 0, 1, 1, 0.25);
    this.ctx.translate(-this.cloudsOffset2 % xScale, 0);
    for (var i = 0; i < 6; ++i) {
      this.ctx.drawImage(
        this.cloudCanvas,
        0,
        0,
        this.cloudCanvas.width,
        this.cloudCanvas.height,
        0,
        0,
        xScale,
        SCREEN_HEIGHT / 2
      );
      this.ctx.translate(xScale, 0);
    }
    this.ctx.restore();

    // Scanlines
    // this.ctx.save();
    // this.ctx.globalAlpha = 0.6;
    // this.ctx.drawImage(
    //   this.images.scanline,
    //   0,
    //   0,
    //   this.images.scanline.width,
    //   this.images.scanline.height,
    //   0,
    //   40,
    //   SCREEN_WIDTH,
    //   SCREEN_HEIGHT / 2
    // );
    // this.ctx.restore();

    // Arrows
    // Draw the arrows into an offscreen canvas to apply the gradient mask.  We only draw the right
    // side arrows, and use it for both sides.
    var arrowCtx = this.arrowCanvas.getContext("2d");
    arrowCtx.clearRect(0, 0, this.arrowCanvas.width, this.arrowCanvas.height);

    // Draw the arrows.
    arrowCtx.save();
    var arrowScale = this.arrowCanvas.height / this.images.arrow.height;
    arrowCtx.translate(-this.images.arrow.width, 0);
    arrowCtx.translate(
      (this.arrowScrollPosition % this.images.arrow.width) * arrowScale,
      0
    );
    for (var i = 0; i < 5; ++i) {
      arrowCtx.drawImage(
        this.images.arrow,
        0,
        0,
        this.images.arrow.width,
        this.images.arrow.height,
        0,
        0,
        this.images.arrow.width * arrowScale,
        this.arrowCanvas.height
      );
      arrowCtx.translate(this.images.arrow.width * arrowScale, 0);
    }
    arrowCtx.restore();

    // Apply a gradient to all of the arrows.
    arrowCtx.save();
    var gradient = arrowCtx.createLinearGradient(
      0,
      0,
      this.arrowCanvas.width,
      0
    );
    gradient.addColorStop(0.0, "rgba(255, 255, 255, 0)");
    gradient.addColorStop(0.5, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(1.0, "rgba(255, 255, 255, 1)");
    arrowCtx.fillStyle = gradient;
    arrowCtx.globalCompositeOperation = "destination-in";
    arrowCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    arrowCtx.restore();

    // Draw the resulting masked arrows onto the main canvas.
    this.ctx.save();
    this.ctx.globalAlpha = 0.5;
    this.ctx.drawImage(this.arrowCanvas, SCREEN_WIDTH / 2, 0);
    this.ctx.scale(-1, 1);
    this.ctx.drawImage(this.arrowCanvas, -SCREEN_WIDTH / 2, 0);
    this.ctx.restore();

    this.ctx.restore();

    // Particles
    BG.drawParticles();
  };

  Background.prototype.drawParticles = function () {
    this.ctx.save();
    for (var idx in this.Particles) {
      var particleInfo = this.Particles[idx];
      this.ctx.globalAlpha = 0.3;
      this.ctx.globalCompositeOperation = "lighter"; // additive
      this.ctx.save();
      this.ctx.translate(particleInfo.x, particleInfo.y);
      this.ctx.scale(particleInfo.zoom, particleInfo.zoom);
      this.ctx.translate(
        -this.images.particle.width / 2,
        -this.images.particle.height / 2
      );
      this.ctx.drawImage(this.images.particle, 0, 0);
      this.ctx.restore();
    }
    this.ctx.restore();
  };

  Background.prototype.resize = function () {
    var container = document.querySelector("#canvas-container");

    var containerWidth = window.innerWidth;
    var containerHeight = window.innerHeight;
    var canvas = this.canvas ? this.canvas : { style: {} };

    // Scale the canvas to cover the window, cropping the canvas at the edges to fit.
    // object-fit doesn't quite do this for us and still isn't supported in Edge (?!).
    var width = window.innerWidth;
    var height = window.innerHeight;
    var containerRatio = containerWidth / containerHeight;
    var canvasRatio = canvas.width / canvas.height;
    if (canvasRatio < containerRatio) height = width / canvasRatio;
    else width = height * canvasRatio;

    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    canvas.style.marginLeft = (containerWidth - width) / 2 + "px";

    this.draw();
  };

  return Background;
})();

var BG = new Background();
