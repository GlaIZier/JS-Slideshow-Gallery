// get element by id
function $(id) { return document.getElementById(id); }

// get elements by tag name inside parent element or inseide document if it is undefined
function $$(tagName, parentElement) {
   if (typeof (parentElement) === "undefined") parentElement = document;
   return parentElement.getElementsByTagName(tagName); 
}

// get style of an element
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
   Gallery._PHOTOVIDEO_RATIO = parseInt(getStyle($("fullsize"), "width"), 10) /
      parseInt(getStyle($("fullsize"), "height"), 10);
   Gallery._PX_TO_SLIDE = parseInt(getStyle($("slidearea"), "width"), 10);
   Gallery._SLIDER_SPACE = 4;
   Gallery._PX_TO_CLIMB_UP = 71;
   // animation 
   Gallery._ANIMATION_FRAME_RATE = 80;
   // speed per frame
   Gallery._PX_SLIDE_SPEED = 15;
   Gallery._OPACITY_SPEED = 0.05;
   Gallery._PX_CLIMB_UP_SPEED = 3;

   Gallery._MODAL_WINDOW_BACKGROUND_OPACITY = 0.8;
   // TODO delete after tests
   Gallery._SHOW_MODAL_WINDOW = true;
   
   // array for next to load thumb resource, servlet link and thumbnails 
   Gallery.photoVideoHolder = Gallery.formPhotoVideoList();
   // show first photo-video. Number of photo-video matches to index in photoVideoHolder
   Gallery.loadShownPhotoVideo(1);
   Gallery.loadThumbsPortion();
   
   // add next-prev events 
   $("next").onclick = function() { if (Gallery.shownPhotoVideoNum === Gallery.photoVideoHolder.length - 1) return; 
      Gallery.loadShownPhotoVideo( Gallery.shownPhotoVideoNum + 1); };
   $("prev").onclick = function() { if (Gallery.shownPhotoVideoNum === 1) return; 
      Gallery.loadShownPhotoVideo(Gallery.shownPhotoVideoNum -1); };
   // add sliders events in thumbs
   $("slideleft").onclick = function() { Gallery.animateSlide(-1); };
   $("slideright").onclick = function() { Gallery.animateSlide(1); };
   $("photovideo").onmouseenter = function() { Gallery.animateInfo(1, undefined, false); };
   $("photovideo").onmouseleave = function() { Gallery.animateInfo(-1, undefined, false); };
   // TODO delete after tests
//   myWindow = window.open('', 'header', 'menubar=0', 'toolbar=0');
//   myWindow.document.write('<font color=red>Hello World!</font>');
};

/**
 * Returns 2d array with photo-video resources:
 * 0                                               1                2    ...
 * index of next resource to add in slider   <resource-link>  <resource-link>
 * servlet link                                img/video         img/video
 *                                           <description>     <description>
 * Example input resources string: "1.jpg:img:blah-blah-blah-blah; http://ya.ru/2.mp4:video"
 */
Gallery.formPhotoVideoList = function() {
   var photoVideoHolder = [];
   // form service info
   photoVideoHolder[0] = [1, $("servletlink").value];
   // split to array using regexp. token ';' with >=0 space symbols from both sides 
   var resources = $("photovideolist").value.split(/\s*;\s*/);
   // add resources to photoVideoHolder in format specified above
   for (var resourceNum = 0; resourceNum < resources.length; resourceNum++) {
      var resourceElement = resources[resourceNum].split(/\s*:\s*/);
      // if there is no description then description = name of file
      if (typeof (resourceElement[2]) === "undefined" || (resourceElement[2] === "")) {
         var fileName = resourceElement[0].split(/\s*\.\s*/);
         resourceElement[2] = fileName[0];
      }
      photoVideoHolder[resourceNum + 1] = resourceElement;
   }
   return photoVideoHolder;
};

/**
 * Loads a batch of thumbs to div 'slider' in markup
 */
Gallery.loadThumbsPortion = function() {
   var appendedMarkup = "";
   // load a batch or until the end of thumbs
   for (var thumbNum = Gallery.photoVideoHolder[0][0]; 
      (thumbNum < Gallery.photoVideoHolder[0][0] + Gallery._THUMBS_PORTION) &&
      (thumbNum < Gallery.photoVideoHolder.length); thumbNum++) {
      appendedMarkup += Gallery._getMarkupPhotoVideo(thumbNum, Gallery.photoVideoHolder[0][1]);
   }
   $("slider").insertAdjacentHTML("beforeEnd", appendedMarkup);
   // add onclick listeners to new thumbs
   var sliderChildren = $("slider").children;
   for (thumbNum = Gallery.photoVideoHolder[0][0] - 1; thumbNum < sliderChildren.length; 
      thumbNum++) {
      (function (_thumbNum) {
         // add listeners of loading images and video to calculate width
         // calc width of the slider several times because we don't know which one will be loaded last
         if (sliderChildren[_thumbNum].tagName.toLowerCase() === "img") {
            sliderChildren[_thumbNum].addEventListener("load", function (e) {
               Gallery.fillSliderWidth();
            }, false);
         }
         else if (sliderChildren[_thumbNum].tagName.toLowerCase() === "video") {
            sliderChildren[_thumbNum].addEventListener( "loadedmetadata", function (e) {
               Gallery.fillSliderWidth();
            }, false);
         }
         else {
            console.error("Unknown tag " + sliderChildren[_thumbNum].tagName + " inside 'slider' div!");
         }
         // add click listeners to thumbs
         // use closure to save current thumbNum from 'for' loop
         sliderChildren[_thumbNum].addEventListener( "click", function (e) {
            if ($("show_modal_window").checked) Gallery.overlayModalWindow(_thumbNum + 1);
            else {
               // if was click on the same picture no animation
               if (Gallery.shownPhotoVideoNum ===  _thumbNum + 1) return;
               Gallery.loadShownPhotoVideo(_thumbNum + 1, undefined, undefined);
            }
         }, false);
      })(thumbNum);
   }
   // update next first thumb to add
   Gallery.photoVideoHolder[0][0] = thumbNum + 1;
   // in the case of listener never trigs. photovideo had been loaded earlier than code was executed
   Gallery.fillSliderWidth();
};

/**
 * Loads new photo or video to frame
 * Call this function with photoVideoNumToShow parameter and direction if you need
 */
// Direction: '-1' - fade (default); '+1' - ignition
// Alg: fade to opacity 0, change photo or video; check image photovideo ratio,
//    flare to opacity 1. (synchronous execution of async functions).
Gallery.loadShownPhotoVideo = function(photoVideoNumToShow, direction, opacity) {
   // was called externally
   if (typeof (direction) === "undefined") direction = -1;
   // fade from 1 (initial) to 0
   if (typeof (opacity) === "undefined" && direction === -1) opacity = 1;
   // ignition from 0 (initial) to 1
   if (typeof (opacity) === "undefined" && direction === 1) opacity = 0;

   // if fade ended (or it was call from init) change html, check ratio, start ignition and stop fade
   if ((opacity < 0 && direction === -1) || (!$("photovideo").children[$("photovideo").children.length - 1])) {
      $("photovideo").innerHTML = Gallery._getMarkupPhotoVideo(photoVideoNumToShow, "photo-video/");
      Gallery.shownPhotoVideoNum = photoVideoNumToShow;
      Gallery.repairElementRatio($("photovideo").children[$("photovideo").children.length - 1]);
      // animate flare new photo-video
      Gallery.loadShownPhotoVideo(undefined, 1, undefined);
      return;
   }
   // end of animation (ignition ended)
   if (opacity > 1 && direction === 1) return;

   $("photovideo").children[$("photovideo").children.length - 1].style.opacity = opacity;
   window.setTimeout(function () {
      Gallery.loadShownPhotoVideo(photoVideoNumToShow, direction, opacity + direction * Gallery._OPACITY_SPEED);
   }, 1000 / Gallery._ANIMATION_FRAME_RATE);
};

/** Animates information for Photo Video frame down and up
    Call function with direction parameter. "-1" - animate slide down; "+1" - animate slide up
*/
// Default values: direction = -1
Gallery.animateInfo = function(direction, slidedPixels) {
   // if func has been just called without parameters
   if (typeof (direction) === "undefined") direction = -1;
   // if func has been just called to slide down or up
   if (typeof (slidedPixels) === "undefined") {
      slidedPixels = $("information").offsetHeight;
      // stop previous animation if there is one
      clearTimeout(Gallery.animateInfo.infoAnimationTimer);
      // if func has been just called to slide up
      if (direction === 1) {
         // add markup inside 'information' div
         $("information").innerHTML = "<p>" + Gallery.photoVideoHolder[Gallery.shownPhotoVideoNum][2] + "</p>";
         // if video in frame then don't show information
         if ($("photovideo").children[$("photovideo").children.length - 1] &&
            $("photovideo").children[$("photovideo").children.length - 1].tagName.toLowerCase() === "video") return;
         }
   }

   // stop animation slide down (stop recursion)
   if (slidedPixels < 0 && direction === -1) {
      $("information").innerHTML = "";
      $("information").style.height = "0px";
      return;
   }
   // stop animation slide up (stop recursion)
   if (slidedPixels > Gallery._PX_TO_CLIMB_UP && direction === 1) {
      $("information").style.height = Gallery._PX_TO_CLIMB_UP + "px";
      return;
   }

   $("information").style.height = slidedPixels + "px";
   // use static functional var to track previous animation
   Gallery.animateInfo.infoAnimationTimer = window.setTimeout(function () {
      Gallery.animateInfo(direction, slidedPixels + direction * Gallery._PX_CLIMB_UP_SPEED);
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
      console.error("Unknown tags inside photoVideoHolder object!");
      return;
   }
};

/**
   Calculates and fills 'width' style property of thumbnails ('slider' div)
*/
Gallery.fillSliderWidth = function() {
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

/** Animate slide in thumbnails
    Call function only with direction parameter or without at all(direction = -1 then);
*/
// Direction: "-1" - animate to left; "+1" - animate to right
Gallery.animateSlide = function(direction, slidedPixels) {
   if (typeof (direction) === "undefined") direction = -1;
   // if it was called first time
   if (typeof (slidedPixels) === "undefined") slidedPixels = 0;
   var prevLeft = parseInt(getStyle($("slider"), "left"), 10);
   var slideAreaWidth = parseInt(getStyle($("slidearea"), "width"), 10);
   var sliderWidth = parseInt(getStyle($("slider"), "width"), 10);

   // stop animation if was slided given number of pixels, or stop at right corner, or stop at left corner
   if (slidedPixels >= Gallery._PX_TO_SLIDE) {
      return;
   }
   // stop at left corner of slider
   if (prevLeft > 0) {
      $("slider").style.left = "0px";
      return;
   }
   //stop at right corner of slider
   if (-prevLeft > sliderWidth - slideAreaWidth) {
      $("slider").style.left = -sliderWidth + slideAreaWidth + "px";
      Gallery.loadThumbsPortion();
      return;
   }

   $("slider").style.left = (prevLeft - direction * Gallery._PX_SLIDE_SPEED) + "px";
   window.setTimeout(function () {
      Gallery.animateSlide(direction, slidedPixels + Gallery._PX_SLIDE_SPEED);
   }, 1000 / Gallery._ANIMATION_FRAME_RATE);
};

// Repair image ratio if it doesn't fit to the frame horizontal
Gallery.repairElementRatio = function(element) {
   if (element.tagName.toLowerCase() === "img") {
      element.addEventListener("load", function (e) {
         var ratio = (element.width / element.height);
         if (ratio >= Gallery._PHOTOVIDEO_RATIO) {
            // insert help span to make vertical align middle
            // more info: https://stackoverflow.com/questions/7273338/how-to-vertically-align-an-image-inside-div
            Gallery._insertHelpSpan($("photovideo"));
            // correct image styles
            element.style.height = "auto";
            element.style.maxHeight = 300 + "px";
         }
      }, false);
   }
   else if(element.tagName.toLowerCase() === "video") {
      element.addEventListener("load", function (e) {
         var ratio = (element.getBoundingClientRect().width / element.getBoundingClientRect().height);
         if (ratio >= Gallery._PHOTOVIDEO_RATIO) {
            console.warn("Can't repair ratio for video.");
         }
      }, false);
   }
   else {
      console.error("Unknown tag " + element.tagName + " inside repair ratio function! Can be only <img> or <video>.");
   }
};

// insert help span for Gallery._setElementRatio method
Gallery._insertHelpSpan = function(insideElement) {
   var helpSpan = "<span id='helpspan'></span>";
   insideElement.insertAdjacentHTML("afterBegin", helpSpan);
   $("helpspan").style.display = "inline-block";
   $("helpspan").style.height = "100%";
   $("helpspan").style.verticalAlign = "middle";
};

Gallery.overlayModalWindow = function(photoVideoNumToShow) {
   if ($("overlay").style.visibility === "visible") {
      Gallery.animateModalWindow();
//      $("overlay").style.visibility = "hidden";
//      $("modal_photovideo").innerHTML = "<p> <div id='close_modal_window' onclick='Gallery.overlayModalWindow()'> Close </div> </p>"
   }
   else {
      $("modal_photovideo").insertAdjacentHTML("afterBegin", Gallery._getMarkupPhotoVideo(photoVideoNumToShow, "photo-video/"));
      Gallery.animateModalWindow(1);
//      $("modal_photovideo").insertAdjacentHTML("afterBegin", Gallery._getMarkupPhotoVideo(photoVideoNumToShow, "photo-video/"));
//      $("overlay").style.visibility ="visible";
   }
};

/** Animates Modal Window appearance and disappearance
    Call function with direction parameter. "-1" - disappearance; "+1" - appearance
*/
// Default values: direction = -1
Gallery.animateModalWindow = function(direction, opacity) {
   // if func has been just called without parameters
   if (typeof (direction) === "undefined") direction = -1;
   // if func has been just called
   if (typeof (opacity) === "undefined") {
      opacity = parseInt(getStyle($("overlay"), "opacity"), 10);
      // stop previous animation if there is one
      clearTimeout(Gallery.animateModalWindow.modalWindowAnimationTimer);
      // if func has been just called to slide up
      if (direction === 1) {
         $("overlay").style.opacity = 0;
         $("overlay").style.visibility ="visible";
      }
   }
   // stop animation
   if (opacity < 0 && direction === -1) {
      $("overlay").style.visibility = "hidden";
      $("modal_photovideo").innerHTML = "";
      $("overlay").style.opacity = 0;
      $("overlay").style.backgroundColor = "rgba(0, 0, 0, 0)";
      return;
   }
   if (opacity > 1 && direction === 1) {
      $("overlay").style.opacity = 1;
      $("overlay").style.backgroundColor = "rgba(0, 0, 0, " + Gallery._MODAL_WINDOW_BACKGROUND_OPACITY + ")";;
      return;
   }

   $("overlay").style.opacity = opacity;
   $("overlay").style.backgroundColor = "rgba(0, 0, 0, " + Gallery._MODAL_WINDOW_BACKGROUND_OPACITY * opacity + ")";
   //alert(opacity);
   // use static functional var to track previous animation
   Gallery.animateModalWindow.modalWindowAnimationTimer = window.setTimeout(function () {
      Gallery.animateModalWindow(direction, opacity + direction * Gallery._OPACITY_SPEED);
   }, 1000 / Gallery._ANIMATION_FRAME_RATE);
};

/* TODO Delete after testing. Previous functional
Gallery.loadShownPhotoVideo = function(direction, opacity) {
   // was called externally
   if (typeof (direction) === "undefined") {
      // start info animation down
      Gallery._animateInfo();
      return;
   }
   // fade from 1 (initial) to 0
   if (typeof (opacity) === "undefined" && direction === -1) opacity = 1;
   // ignition from 0 (initial) to 1
   if (typeof (opacity) === "undefined" && direction === 1) opacity = 0;

   // if fade ended (or it was call from init) change html, check ratio, start ignition and stop fade
   if ((opacity < 0 && direction === -1) || (!$("photovideo").children[$("photovideo").children.length - 1])) {
      $("photovideo").innerHTML = Gallery._getMarkupPhotoVideo(Gallery.shownPhotoVideoNum, "photo-video/");
      Gallery._repairElementRatio($("photovideo").children[$("photovideo").children.length - 1]);
      Gallery.loadShownPhotoVideo(1);
      return;
   }
   // end of animation (ignition ended)
   if (opacity > 1 && direction === 1) {
      // start slide up info animation
      Gallery._animateInfo(1);
      return;
   }

   $("photovideo").children[$("photovideo").children.length - 1].style.opacity = opacity;
   window.setTimeout(function () {
      Gallery.loadShownPhotoVideo(direction, opacity + direction * Gallery._OPACITY_SPEED);
   }, 1000 / Gallery._ANIMATION_FRAME_RATE);
};

// Animates information for Photo Video frame down and then up
// Call function without slidedPixels parameter. Other parameters are optional.
// Default values: direction = -1; showNewPhotoVideo = true
// Direction: "-1" - animate slide down; "+1" - animate slide up
Gallery._animateInfo = function(direction, slidedPixels, showNewPhotoVideo) {
   if (typeof (showNewPhotoVideo) === "undefined") showNewPhotoVideo = true;
   // if func has been just called without parameters
   if (typeof (direction) === "undefined") direction = -1;
   // if func has been just called to slide down or up
   if (typeof (slidedPixels) === "undefined") {
      slidedPixels = $("information").offsetHeight;
     // if (slidedPixels !== 0 && slidedPixels !== Gallery._PX_TO_CLIMB_UP) return;
      // if func has been just called to slide up
      if (direction === 1) {
         // add markup inside 'information' div
         $("information").innerHTML = "<p>" + Gallery.photoVideoHolder[Gallery.shownPhotoVideoNum][2] + "</p>";
         // if video in frame then don't show information
         if ($("photovideo").children[$("photovideo").children.length - 1] &&
            $("photovideo").children[$("photovideo").children.length - 1].tagName.toLowerCase() === "video") return;
         }
   }

   // stop animation slide down (stop recursion)
   if (slidedPixels < 0 && direction === -1) {
      $("information").innerHTML = "";
      $("information").style.height = "0px";
      // start animation to show new frame
      if (showNewPhotoVideo) Gallery.loadShownPhotoVideo(-1);
      return;
   }
   // stop animation slide up (stop recursion)
   if (slidedPixels > Gallery._PX_TO_CLIMB_UP && direction === 1) {
      $("information").style.height = Gallery._PX_TO_CLIMB_UP + "px";
      if (showNewPhotoVideo)
         window.setTimeout("Gallery._animateInfo(-1, undefined, false)", Gallery._DISAPPEAR_INFO_TIME);
      return;
   }

   $("information").style.height = slidedPixels + "px";
   window.setTimeout(function () {
      Gallery._animateInfo(direction, slidedPixels + direction * Gallery._PX_CLIMB_UP_SPEED, showNewPhotoVideo);
   }, 1000 / Gallery._ANIMATION_FRAME_RATE);
};
*/