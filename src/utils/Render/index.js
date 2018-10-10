import calcSize from './calcSize';
import './render.css';
let scrollCount = 0;
let VideoAreaDimension = 0;
let bottomStreamSize = 8;
export default {
  init(elementId, minRatio, maxRatio) {
    this.MAX_RATIO = maxRatio;
    this.MIN_RATIO = minRatio;
    this.canvas = document.querySelector(`#${elementId}`);
  },

  _checkRatio(width, height) {
    let ratio = height / width;
    if (ratio > this.MAX_RATIO || ratio < this.MIN_RATIO) {
      return false;
    }
    return true;
  },

  customRender(streamList, mode, mainId, isModified) {
    // Reinit canvas style first
    this.canvas.classList.remove('container__flex');
    this.canvas.classList.add('container__grid');

    // Get no
    let no = streamList.length;
    mainId =
      mainId ||
      (streamList[streamList.length - 1] && streamList[streamList.length - 1].getId());

    // We should consider no, isMobileSize, currentMode   
    this.rendererFactory(streamList, mode, mainId, isModified);
    for (let stream of streamList) {
      stream.player && stream.player.resize();
    }
  },

  rendererFactory(streamList, mode, mainId, isModified) {

    if (mode === 0) {
      scrollCount = 0;
      this.tileRenderer(streamList);
    } else if (mode === 1) {
      scrollCount = 0;
      this.pipRenderer(streamList, mainId);
    } else if (mode === 2) {
      scrollCount = 0;
      this.sharingRenderer(streamList, mainId);
    } else if (mode === 3) {
      this.customPipeBottomRenderer(streamList, mainId, isModified);
    }
    else {
      throw Error('Wrong mode for renderer');
    }
  },

  updateVideoItem(stream, style, fit = false) {
    if (stream) {
      let id = stream.getId();
      let dom = document.querySelector('#video-item-' + id);
      if (!dom) {
        dom = document.createElement('section');
        let box = document.createElement('div');
        let chatbox = document.createElement('div');
        dom.setAttribute('id', 'video-item-' + id);
        dom.setAttribute('class', 'video-item');
        box.setAttribute('class', 'video-item-box');
        chatbox.setAttribute('class', 'chat-item-box');
        dom.appendChild(box);
        dom.appendChild(chatbox);
        this.canvas.appendChild(dom);
        stream.play('video-item-' + id);
        var div_Label = document.createElement('div');
        div_Label.innerHTML = '<label class="label"> &nbsp;' + id + '</label>';
        var div_Volbar = document.createElement('div');
        div_Volbar.setAttribute('id', 'audiobar-' + id);
        div_Volbar.innerHTML = '<progress id="volume" class="progress is-small is-info" style="position:absolute;bottom:0;display:block;height: 7px;border-radius:1em;" value="0" max="100"></progress>';
        document.getElementById('video-item-' + id).appendChild(div_Volbar);
        $(`#video-item-${stream.getId()} .video-item-box`).append(div_Label);
      }
      if (fit) {
        dom.classList.add('window__fit');
      } else {
        dom.classList.remove('window__fit');
      }
      dom.setAttribute('style', style);
    }
  },

  /**
   * @description Tile mode renderer. Recommended for 1-N people.
   */
  tileRenderer(streamList) {
    let { width, height } = calcSize({
      width: this.canvas.clientWidth,
      height: this.canvas.clientHeight,
      minRatio: this.MIN_RATIO,
      maxRatio: this.MAX_RATIO,
      count: streamList.length
    });
    // Use flex box container
    this.canvas.classList.remove('container__grid');
    this.canvas.classList.add('container__flex');
    for (let stream of streamList) {
      this.updateVideoItem(stream, `width: ${width}px; height: ${height}px;`);
    }
  },
  customPipeBottomRenderer(streamList, mainId, scrollViewMode) {
    let customStyle ="";
    let len = streamList.length;
    let videoAreaWidth = $(".ag-container").width();
    if (videoAreaWidth >= 1100) {
      bottomStreamSize = 11;
    } else if (videoAreaWidth >= 400) {
      bottomStreamSize = parseInt(videoAreaWidth / 100) - 2;
    }
    else {
      bottomStreamSize = 2;
    }
    let VideoAreaHeight = $(".ag-container").height();
    if(VideoAreaHeight <= 200){      
      $(".right-scroll-box").css("font-size","45px");
      $(".left-scroll-box").css("font-size","45px");
     customStyle ="width: 0.74in; height: 0.75in";
     $(".ag-btn-group").css("height","3rem");   
    }else{
      $(".right-scroll-box").css("font-size","65px");
      $(".left-scroll-box").css("font-size","65px");
      customStyle ="width: 1in; height: 1in";
      $(".ag-btn-group").css("height","5rem");   
    }


    if (VideoAreaDimension < videoAreaWidth || len == 2) {
      scrollCount = 0;
    }
    // Now you can render in pip mode
 
    if (scrollViewMode == "leftScroll" || scrollViewMode == "remove"  && scrollCount > 0) {
      scrollCount = scrollCount - 1;
    }
    if ((scrollViewMode == "rightScroll") && scrollCount < streamList.length - 2) {
      scrollCount = scrollCount + 1;
    }
    if (streamList.length >= bottomStreamSize) {
      len = scrollCount + bottomStreamSize
    }

    let stream = streamList.find(ele => ele.getId() == mainId);
    // Main window
    if (stream != null && stream != undefined) {
      this.updateVideoItem(stream, `grid-area: span 12/span 24/13/25`);
    }

    if (scrollCount == 0) {
      $("#leftScrollBtn").css("display", "none");
    } else {
      $("#leftScrollBtn").css("display", "block");
    }

    let bottomStreamList = streamList.filter(ele => ele.getId() != mainId);
    for (let ind = 0; ind < scrollCount; ind++) {
      $("#video-item-" + bottomStreamList[ind].getId()).css("display", "none");
    }

    for (let ind = bottomStreamSize - 1; ind < bottomStreamList.length; ind++) {
      $("#video-item-" + bottomStreamList[ind].getId()).css("display", "none");
    }

    for (let index = scrollCount, count = 0; index < len - 1; index++) {
      let stream = bottomStreamList[index];
      if (stream != null && stream != undefined) {
        $("#video-item-" + stream.getId()).css("display", "block");
      }
      if ($('.ag-btn-group').hasClass('active')) {
        this.updateVideoItem(
          stream,
          `grid-area: span 1/span 4/11/${6 + (bottomStreamSize > 7 ? 2 : 3) * count};
                      z-index:1;${customStyle};`
        );
      }
      else {
        this.updateVideoItem(
          stream,
          `grid-area: span 1/span 4/13/${6 + (bottomStreamSize > 7 ? 2 : 3) * count};
                    z-index:1; ${customStyle};`
        );
      }
      count++;
      if (index < bottomStreamList.length - 1) {
        $("#rightScrollBtn").css("display", "block");
      } else {
        $("#rightScrollBtn").css("display", "none");
      }
    }
    VideoAreaDimension = videoAreaWidth;
  },

  /**
   * @description PIP mode renderer. Recommended for 1-4 people.
   */
  pipRenderer(streamList, mainId) {
    let no = streamList.length;
    if (no > 4) {
      throw Error('PIP mode only suitable for less than 4 stream');
    }

    // Check ratio before using pip ratio
    if (
      !this._checkRatio(
        this.canvas.clientWidth * 4 / 24,
        this.canvas.clientHeight * 3 / 12
      ) ||
      !this._checkRatio(
        this.canvas.clientWidth * 12 / 24,
        this.canvas.clientHeight * 12 / 12
      )
    ) {
      return this.tileRenderer(streamList);
    }

    // Now you can render in pip mode
    for (let index = 0, count = 0; index < no; index++) {
      let stream = streamList[index];
      if (stream.getId() === mainId) {
        // Main window
        this.updateVideoItem(stream, `grid-area: span 12/span 24/13/25`);
      } else {
        // Sub window
        this.updateVideoItem(
          stream,
          `grid-area: span 3/span 4/${4 + 3 * count}/25;
                    z-index:1;width:calc(100% - 20px);height:calc(100% - 20px)`
        );
        count++;
      }
    }
  },

  /**
   * @description Screen sharing mode renderer. Recommended for 1-7 people + 1 sharing stream.
   */
  sharingRenderer(streamList, mainId) {
    let no = streamList.length;
    if (no > 8) {
      throw Error('Screen Sharing Mode only suitable for less than 8 stream');
    }

    // Check ratio before using screen sharing ratio unless there is only one stream
    if (
      !this._checkRatio(
        this.canvas.clientWidth * 4 / 24,
        this.canvas.clientHeight * 4 / 12
      ) &&
      streamList.length !== 1
    ) {
      // Hide other streams
      let mainStreamIndex = streamList.findIndex(function (element) {
        return element.getId() === mainId;
      });
      if (mainStreamIndex === -1) {
        throw Error('Cannot find stream by given mainId!');
      }
      // Only render main stream(sharing stream)
      for (let i = 0; i < no; i++) {
        if (i !== mainStreamIndex) {
          this.updateVideoItem(streamList[i], 'display: none');
        }
      }
      return this.sharingRenderer([streamList[mainStreamIndex]], mainId);
    }

    // Copy a temp streamList
    let tempStreamList = [...streamList];
    // Now you can use screen sharing mode
    if (no === 8) {
      // When there are 7 people with 1 sharing stream, hide audio stream or local stream
      // try to find first audio stream and splice it, if not splice local stream
      let shouldRemoveStreamIndex = tempStreamList.findIndex(function (element) {
        return element.hasAudio() && !element.hasVideo();
      });
      if (shouldRemoveStreamIndex === -1) {
        shouldRemoveStreamIndex = 7;
      }
      let shouldRemoveStream = tempStreamList[shouldRemoveStreamIndex];
      this.updateVideoItem(shouldRemoveStream, 'display: none');
      tempStreamList.splice(shouldRemoveStreamIndex, 1);
    }

    for (let stream of tempStreamList) {
      if (stream.getId() === mainId) {
        // When there were less than 5 people
        // sharing stream will take more place
        if (no === 1) {
          this.updateVideoItem(stream, `grid-area: span 12/span 24/13/25;`, true);
        } else if (no < 5) {
          this.updateVideoItem(stream, `grid-area: span 12/span 20/13/25;`, true);
        } else {
          this.updateVideoItem(stream, `grid-area: span 12/span 16/13/21;`, true);
        }
      } else {
        // Normal stream
        this.updateVideoItem(stream, `grid-area: span 4/span 4`);
      }
    }
  }
};
