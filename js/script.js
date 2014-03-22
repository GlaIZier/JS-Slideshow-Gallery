// get element by id
function $(id) { return document.getElementById(id); }

// get elements by tag name inside parent element or inseide document if it is undefined
function $$(tagName, parentElement) { 
   parentElement = parentElement || document; 
   return parentElement.getElementsByTagName(tagName); 
}

function getStyle(element, propertyName) {
   // return error if can't get style
   var style = "error";
   if (element.currentStyle)
      style = element.currentStyle[propertyName];
   else
      style = document.defaultView.getComputedStyle(element,null).getPropertyValue(propertyName);
   return style;
}

var Gallery = {};

/**
 * Does preparatory actions before Gallery usage
 */
Gallery.init = function() {
   Gallery._THUMBS_PORTION = 10;
   Gallery._SLIDER_SPACE = 4;
   Gallery._PX_TO_SLIDE = parseInt(getStyle($('slidearea'), 'width'), 10);
   // animation 
   Gallery._ANIMATION_FRAME_RATE = 50;
   // speed per frame
   Gallery._PX_SLIDE_SPEED = 15;
   Gallery._OPACITY_SPEED = 0.2;
   
   // array for next to load thumb resource, servlet link and thumbnails 
   Gallery.photoVideoHolder = Gallery.formPhotoVideoList();
   // current shown photo or video. Number matches to index in photoVideoHolder
   Gallery.shownPhotoVideoNum = 1;
   Gallery.loadShownPhotoVideo();
   Gallery.loadThumbsPortion();
   
// TODO delete this later
//   Gallery._slideLeftElement = $('slideleft');
//   Gallery._slideRightElement = $('slideright');
// $('slideleft').onclick = Gallery._slideLeft;
// $('slideright').onclick = Gallery._slideRight;
   
   // add next-prev events 
   $("next").onclick = function() { if (Gallery.shownPhotoVideoNum === Gallery.photoVideoHolder.length - 1) return; 
      Gallery.shownPhotoVideoNum++; Gallery.loadShownPhotoVideo(); };
   $("prev").onclick = function() { if (Gallery.shownPhotoVideoNum === 1) return; 
      Gallery.shownPhotoVideoNum--; Gallery.loadShownPhotoVideo(); };
   // add sliders events in thumbs
   $('slideleft').onclick = function() { Gallery._animateSlide(-1); };
   $('slideright').onclick = function() { Gallery._animateSlide(1); };
   
   Gallery.fillSliderWidth();
};

/**
 * Returns 2d array with photo-video resources:
 * 0                                               1              2  ... 
 * index of next resource to add in slider   resource-link  resource-link
 * servlet link                                img/video      img/video 
 */
Gallery.formPhotoVideoList = function() {
   var photoVideoHolder = [];
   // form service info
   photoVideoHolder[0] = [1, $('servletlink').value];
   // split to array using regexp. token ';' with >=0 space symbols from both sides 
   var resources = $('photovideolist').value.split(/\s*;\s*/);
   // add resources to photoVideoHolder in format specified above
   for (var resourceNum = 0; resourceNum < resources.length; resourceNum++) {
      var resourceElement = resources[resourceNum].split(/\s*:\s*/);
      photoVideoHolder[resourceNum + 1] = resourceElement;
   }
   return photoVideoHolder;
};

/**
 * Loads a batch of thumbs to slider in markup
 */
Gallery.loadThumbsPortion = function() {
   var appendedMarkup = "";
   for (var thumbNum = Gallery.photoVideoHolder[0][0]; 
      (thumbNum < Gallery.photoVideoHolder[0][0] + Gallery._THUMBS_PORTION) &&
      (thumbNum < Gallery.photoVideoHolder.length); thumbNum++) {
      appendedMarkup += Gallery._getMarkupPhotoVideo(thumbNum, Gallery.photoVideoHolder[0][1]);
   }
   $('slider').insertAdjacentHTML('beforeEnd', appendedMarkup);
   // add onclick listeners to new thumbs
   var sliderChildren = $('slider').children;
   // TODO look for closure
   for (thumbNum = Gallery.photoVideoHolder[0][0] - 1; thumbNum < sliderChildren.length; 
      thumbNum++) {
      (function (_thumbNum) {
         sliderChildren[thumbNum].addEventListener( 'click', function (e) {
            Gallery.shownPhotoVideoNum = _thumbNum + 1;
            Gallery.loadShownPhotoVideo();
         }, false);
      })(thumbNum);
   }
   // update next first thumb to add
   Gallery.photoVideoHolder[0][0] = thumbNum + 1;
};

/**
 * Loads new photo or video to frame
 * Call this function without parameters!
 */
//direction: '-1' - fade; '+1' - ignition
// fade to opacity 0, change photo or video and flare to opacity 1
Gallery.loadShownPhotoVideo = function(direction, opacity) {
   // was called externally
   if (typeof (direction) === "undefined") direction = -1;
   // fade from 1 (initial) to 0
   if (typeof (opacity) === "undefined" && direction === -1) opacity = 1;
   // ignition from 0 (initial) to 1
   if (typeof (opacity) === "undefined" && direction === 1) opacity = 0;
   
   // if fade ended change html, do ignition and stop fade (return from this function)
   if ((opacity < 0 && direction === -1) || (!$("photovideo").children[0])) {
      $("photovideo").innerHTML = Gallery._getMarkupPhotoVideo(Gallery.shownPhotoVideoNum, "photo-video/");
      Gallery.loadShownPhotoVideo(1);
      return;
   }
   // end of animation (ignition ended)
   if (opacity > 1 && direction === 1) {
      return;
   }
   
   $("photovideo").children[0].style.opacity = opacity;
   window.setTimeout(function () {
      Gallery.loadShownPhotoVideo(direction, opacity + direction * Gallery._OPACITY_SPEED);
   }, 1000 / Gallery._ANIMATION_FRAME_RATE);
};


// Returns string with markup for photo or video tag with source specified in photoVideoHolder[photoVideoIndex]
Gallery._getMarkupPhotoVideo = function(photoVideoIndex, imgSrcPreamble) {
   if (Gallery.photoVideoHolder[photoVideoIndex][1] === "img") {
      return "<img src='" + imgSrcPreamble + 
         Gallery.photoVideoHolder[photoVideoIndex][0] + "' alt='Can&apos;t load image!'> ";
   }
   else if (Gallery.photoVideoHolder[photoVideoIndex][1] === "video") {
      return "<video controls> <source src='thumbnails/" + Gallery.photoVideoHolder[photoVideoIndex][0] + "'> " +
         "<object type='application/x-shockwave-flash' data='thumbnails/" + 
         Gallery.photoVideoHolder[photoVideoIndex][0] + "'> " + 
         "<embed src='thumbnails/" + Gallery.photoVideoHolder[photoVideoIndex][0] + "'> " + 
         "</object> </video> ";
   }
   else {
      alert("Error in resources types!");
      return;
   }
};

/**
 * Calculate width of the slider and fill it's width 
 */
Gallery.fillSliderWidth = function() {
   // in the case when loadedmetadata triggered earlier than this code
   // call _fillSliderWidth() several times. Not the best solution. More details: 
   // http://dev.opera.com/articles/view/consistent-event-firing-with-html5-video/
   Gallery._fillSliderWidth();
   var videoList = $$("video", $("slider"));
   // only when all videos are loaded
   if (videoList[0]) {
      for (var videoNumber = 0; videoNumber < videoList.length; videoNumber++) {
         //TODO make closure to load last video
         videoList[videoNumber].addEventListener( "loadedmetadata", function (e) {
            Gallery._fillSliderWidth();
         }, false);
      }
   }
};

Gallery._fillSliderWidth = function() {
   var sliderElement = $("slider");
   var imgList = $$("img", sliderElement);
   var videoList = $$("video", sliderElement);

   var sliderWidth = 0;
   var i = 0;
   for (i = 0; i < imgList.length; i++) {
      sliderWidth += (imgList[i].getBoundingClientRect().width + Gallery._SLIDER_SPACE); //width + borders(2*1) + padding(2*2) + margin(right=4px)
   }
   for (i = 0; i < videoList.length; i++) {
      // Problem with ie. It can't load video faster than this code. That's why now we use fixed width
      sliderWidth += (videoList[i].getBoundingClientRect().width + Gallery._SLIDER_SPACE); // bounding rect = padding + borders + width
   }
   sliderWidth -= Gallery._SLIDER_SPACE; // sub last right margin
   // correct right margin and padding from right border
   sliderWidth = parseInt(sliderWidth, 10);
   sliderElement.style.width = sliderWidth + "px"; //sliderElement.setAttribute("style","width:" + sliderWidth + "px");
};

// TODO delete after test
//Gallery._slideRight = function() {
//   Gallery._animateSlide(1, 0);
//};
//
//Gallery._slideLeft = function() {
//   Gallery._animateSlide(-1, 0);
//};

//direction: "-1" - animate to left; "+1" - animate to right
Gallery._animateSlide = function(direction, slidedPixels) {
   slidedPixels = slidedPixels || 0;
   var prevLeft = parseInt(getStyle($("slider"), "left"), 10);
   var slideAreaWidth = parseInt(getStyle($("slidearea"), "width"), 10);
   var sliderWidth = parseInt(getStyle($("slider"), "width"), 10);
   // if was slided given number of pixels, or stop at right corner, or stop at left corner 
   if (slidedPixels >= Gallery._PX_TO_SLIDE) return;
   // stop at left corner of slider
   if (prevLeft > 0) {
      $("slider").style.left = "0px";
      return;
   }
   //stop at right corner of slider
   if (-prevLeft > sliderWidth - slideAreaWidth) {
      $("slider").style.left = -sliderWidth + slideAreaWidth +"px";
      Gallery.loadThumbsPortion();
      Gallery.fillSliderWidth();
      return;
   }
   $("slider").style.left = (prevLeft - direction * Gallery._PX_SLIDE_SPEED) + "px";
   window.setTimeout(function () {
      Gallery._animateSlide(direction, slidedPixels + Gallery._PX_SLIDE_SPEED);
   }, 1000 / Gallery._ANIMATION_FRAME_RATE);
};
