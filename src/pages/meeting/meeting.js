import 'bulma';
import $ from 'jquery';
import 'jquery-ui/ui/widgets/resizable';
import 'jquery-ui/themes/base/resizable.css';
import * as Cookies from 'js-cookie';
import { merge } from 'lodash';
import '@/assets/css/icons.css';
import 'bootstrap-material-design/dist/css/bootstrap-material-design.min.css';
import 'bootstrap-material-design';
import '@/assets/global.scss';
import './meeting.scss';
import ButtonControl from '@/utils/ButtonControl';
import { isSafari, isMobileSize, isChrome, isFirefox } from '@/utils/BrowserCheck';
import Notify from '@/utils/Notify';
import Renderer from '@/utils/Render';
import { SHARE_ID, RESOLUTION_ARR, APP_ID } from '@/utils/Settings';
import { logger, log } from '../../utils/Logger';
import '../../assets/stylesheets/main.css';
import { Browser, Utils } from '../../utils';
import SignalingClient from '../../utils/signalingClient';
import { isNullOrUndefined } from 'util';

let options = {};
let client = {};
let localStream = {};
let streamList = [];
let shareClient = null;
let shareStream = null;
let mainId;
let mainStream;
let isChatDisplayed = false;
let selectedStreamUID;
let isFirstTimeClientInit = true;
let isLocalStreamInitialised = false;
let UIDList = [];

const globalLog = logger.init('global', 'blue');
const shareLog = logger.init('share', 'yellow');
const localLog = logger.init('local', 'green');

//-------------Chat purpose------------//
const appid = AGORA_APP_ID || '',
  appcert = AGORA_CERTIFICATE_ID || '';
if (!appid) {
  alert('App ID missing!');
}
let localAccount = Browser.getParameterByName('account');
let signal = new SignalingClient(appid, appcert);
//---------------------------------------//

const optionsInit = () => {
  let options = {
    videoProfile: Cookies.get('videoProfile').split(',')[0] || '480p_4',
    videoProfileLow: Cookies.get('videoProfileLow'),
    cameraId: Cookies.get('cameraId'),
    microphoneId: Cookies.get('microphoneId'),
    channel: Cookies.get('channel') || 'test',
    transcode: Cookies.get('transcode') || 'interop',
    attendeeMode: Cookies.get('attendeeMode') || 'video',
    baseMode: Cookies.get('baseMode') || 'avc',
    displayMode: 3, // 0 Tile, 1 PIP, 2 screen share, 3 full screen
    uid: undefined, // In default it is dynamically generated
    resolution: undefined
  };

  let tempProfile = RESOLUTION_ARR[Cookies.get('videoProfile')];
  options.resolution = tempProfile[0] / tempProfile[1] || 4 / 3;
  if (options.baseMode === 'avc') {
    options.key = APP_ID;
  }
  return options;
};

const uiInit = options => {
  Renderer.init('ag-canvas', 9 / 16, 8 / 5);

  // Only firefox and chrome support screen sharing
  if (!isFirefox() && !isChrome()) {
    ButtonControl.disable('.shareScreenBtn');
  }
  $('#room-name').html(options.channel);
  switch (options.attendeeMode) {
    case 'audio-only':
      ButtonControl.hide(['.videoControlBtn', '.shareScreenBtn']);
      break;
    case 'audience':
      ButtonControl.hide(['.videoControlBtn', '.audioControlBtn', '.shareScreenBtn']);
      break;
    default:
    case 'video':
      break;
  }
};

const doubleClick = (dom, LocalStreamUID) => {
  if (dom != null)
    selectedStreamUID = parseInt(dom.id.split('-')[2], 10);
  else
    selectedStreamUID = LocalStreamUID;

  if (selectedStreamUID !== mainId) {
    let next = options.displayMode === 2 ? SHARE_ID : selectedStreamUID;
    // Force to swtich
    setHighStream(mainId, next);
    mainId = next;
    mainStream = getStreamById(mainId);
  }
  options.displayMode = 3;
  Renderer.customRender(streamList, options.displayMode, mainId);
  $('#closeBtnId').css('display', 'block');
  if (isChatDisplayed) {
    displayOrHideChat();
  }
}
const clientInit = (client, options) => {
  return new Promise((resolve, reject) => {
    client.init(options.key, () => {
      globalLog('AgoraRTC client initialized');
      let lowStreamParam = RESOLUTION_ARR[options.videoProfileLow];
      client.join(
        options.key,
        options.channel,
        options.uid,
        uid => {
          log(uid, 'brown', `User ${uid} join channel successfully`);
          log(uid, 'brown', new Date().toLocaleTimeString());
          client.setLowStreamParameter({
            width: lowStreamParam[0],
            height: lowStreamParam[1],
            framerate: lowStreamParam[2],
            bitrate: lowStreamParam[3]
          });
         // Chat Login using UID
          if (isFirstTimeClientInit) {
            console.log("localAccount", localAccount)
            localAccount = `${uid}`;
            signal.login(localAccount).then(() => {
              // Once logged in, enable the call btn
              new Client(signal, localAccount);
            });
            isFirstTimeClientInit = false;
          }
	      // Create localstream
          resolve(uid);
        },
        err => {
          reject(err);
        }
      );
    });
  });
};

/**
 *
 * @param {*} uid
 * @param {*} options global option
 * @param {*} config stream config
 */
const streamInit = (uid, options, config) => {
  let defaultConfig = {
    streamID: uid,
    audio: true,
    video: true,
    screen: false
  };

  switch (options.attendeeMode) {
    case 'audio-only':
      defaultConfig.video = false;
      break;
    case 'audience':
      defaultConfig.video = false;
      defaultConfig.audio = false;
      break;
    default:
    case 'video':
      break;
  }
  // eslint-disable-next-line
  let stream = AgoraRTC.createStream(merge(defaultConfig, config));
  stream.setVideoProfile(options.videoProfile);
  return stream;
};

const shareEnd = () => {
  try {
    shareClient && shareClient.unpublish(shareStream);
    shareStream && shareStream.close();
    shareClient &&
      shareClient.leave(
        () => {
          shareLog('Share client succeed to leave.');
        },
        () => {
          shareLog('Share client failed to leave.');
        }
      );
  } finally {
    shareClient = null;
    shareStream = null;
  }
};

const shareStart = () => {
  ButtonControl.disable('.shareScreenBtn');
  // eslint-disable-next-line
  shareClient = AgoraRTC.createClient({
    mode: options.transcode
  });
  let shareOptions = merge(options, {
    uid: SHARE_ID
  });
  clientInit(shareClient, shareOptions).then(uid => {
    let config = {
      screen: true,
      video: false,
      audio: false,
      extensionId: 'minllpmhdgpndnkomcoccfekfegnlikg',
      mediaSource: 'application'
    };
    shareStream = streamInit(uid, shareOptions, config);
    shareStream.init(
      () => {
        ButtonControl.enable('.shareScreenBtn');
        shareStream.on('stopScreenSharing', () => {
          shareEnd();
          shareLog('Stop Screen Sharing at' + new Date());
        });
        shareClient.publish(shareStream, err => {
          shareLog('Publish share stream error: ' + err);
          shareLog('getUserMedia failed', err);
        });
      },
      err => {
        ButtonControl.enable('.shareScreenBtn');
        shareLog('getUserMedia failed', err);
        shareEnd();
        if (isChrome()) {
          // If (!chrome.app.isInstalled) {
          let msg = `Please install chrome extension before using sharing screen. 
            <hr />
            <a id="addExtensionBtn" class="button is-link" onclick="chrome.webstore.install('https://chrome.google.com/webstore/detail/minllpmhdgpndnkomcoccfekfegnlikg', installSuccess, installError)">Add chrome extension</a>
          `;
          Notify.danger(msg, 2000);
          // }
        }
      }
    );
  });
};

window.installSuccess = (...args) => {
  globalLog(...args);
};

window.installError = (...args) => {
  globalLog(...args);
  Notify.danger(
    'Failed to install the extension, please check the network and console.',
    2000
  );
};

const loadChatMembers = () => {
  $("#userlist").html(`${streamList.length}`);
  let element = "";
  streamList.forEach(val => {
    element = element + `<ul class="chat-list"><label class="chat-label"> &nbsp;UID :${val.getId()}</label></ul>`
  })
  $("#channelMembersInnerDiv").html(element);
}
const removeStream = id => {

  var remove = streamList.map((item, index) => {
    if (item.getId() === id) {
      streamList[index].close();
      $('#video-item-' + id).remove();
      streamList.splice(index, 1);
      return 1;
    }
    return 0;
  });

  if (remove.indexOf(1) != -1) {
    loadChatMembers();
    if (id == selectedStreamUID) {
      selectedStreamUID = localStream.getId();
      Renderer.customRender(streamList, options.displayMode, localStream.getId(), 'remove');
    } else {
      Renderer.customRender(streamList, options.displayMode, selectedStreamUID, 'remove');
    }
  }
};


const addStream = (stream, push = false) => {
  let id = stream.getId();
  //Dispaly an alert on New Stream Join.
  var peerExists = false;
  if (UIDList.includes(stream.getId())) {
    peerExists = true;
  }
  if (!peerExists) {
    UIDList.push(stream.getId());
    if ((isLocalStreamInitialised) && id != localStream.getId()) {
      let msg = id + " has been joined.";
      Notify.success(msg, 2000);
    }
  }
  // Check for redundant
  let redundant = streamList.some(item => {
    return item.getId() === id;
  });
  if (redundant) {
    return;
  }
  // Do push for localStream and unshift for other streams
  push ? streamList.push(stream) : streamList.unshift(stream);

  //Render bottom stream icons in full screen mode
  if ($('#closeBtnId').css('display') == 'block') {
    if (selectedStreamUID != '') {
      mainId = selectedStreamUID;
      Renderer.customRender(streamList, 3, selectedStreamUID, 'added');
    }
    else
      Renderer.customRender(streamList, 3, localStream.getId(), 'added');
  } else {
    //To maintian same display when new user joins 
    Renderer.customRender(streamList, options.displayMode, 'added');
  }
  loadChatMembers();
};

const getStreamById = id => {
  return streamList.filter(item => {
    return item.getId() === id;
  })[0];
};

const enableDualStream = () => {
  client.enableDualStream(
    function () {
      localLog('Enable dual stream success!');
    },
    function (e) {
      localLog(e);
    }
  );
};

const setHighStream = (prev, next) => {
  if (prev === next) {
    return;
  }
  let prevStream;
  let nextStream;
  // Get stream by id
  for (let stream of streamList) {
    let id = stream.getId();
    if (id === prev) {
      prevStream = stream;
    } else if (id === next) {
      nextStream = stream;
    } else {
      // Do nothing
    }
  }
  // Set prev stream to low
  prevStream && client.setRemoteVideoStreamType(prevStream, 1);
  // Set next stream to high
  nextStream && client.setRemoteVideoStreamType(nextStream, 0);
};
/**
 * Add callback for client event to control streams
 * @param {*} client
 * @param {*} streamList
 */
const subscribeStreamEvents = () => {
  client.on('stream-added', function (evt) {
    let stream = evt.stream;
    let id = stream.getId();
    localLog('New stream added: ' + id);
    localLog(new Date().toLocaleTimeString());
    localLog('Subscribe ', stream);
    if (id === SHARE_ID) {
      mainId = id;
      mainStream = stream;
      if (!shareClient) {
        ButtonControl.disable('.shareScreenBtn');
      }
    }
    if (id !== mainId) {
      if (options.displayMode === 2) {
        client.setRemoteVideoStreamType(stream, 1);
      } else {
        mainStream && client.setRemoteVideoStreamType(mainStream, 1);
        mainStream = stream;
        mainId = id;
      }
    }
    client.subscribe(stream, function (err) {
      localLog('Subscribe stream failed', err);
    });

    //On left scroll Button click move bottom stream to left
    $(".left-scroll-box").unbind().click(function () {
      Renderer.customPipeBottomRenderer(streamList, mainId, "leftScroll");
      Renderer.customRender(streamList, 3, mainId);
    });
    //On Right scroll button click move bottom stream to right
    $(".right-scroll-box").unbind().click(function () {
      Renderer.customPipeBottomRenderer(streamList, mainId, "rightScroll");
      Renderer.customRender(streamList, 3, mainId);
    });
  });


  //When a stream is Muted, then disaply Agora.io Icon Insteadof Black screen
  client.on('mute-video', function (evt) {
    let id = evt.uid;
    var setClass = setInterval(function () {
      if (document.getElementById('player_' + id) != null) {
        $('#player_' + id).addClass('player');
        clearInterval(setClass);
      }
    }, 500);
  });

  //When a stream is Unmuted, then remove Agora.io Icon and dispaly the stream
  client.on('unmute-video', function (evt) {
    let id = evt.uid;
    var removeClass = setInterval(function () {
      if (document.getElementById('player_' + id) != null) {
        $('#player_' + id).removeClass('player');
        clearInterval(removeClass);
      }
    }, 500);
  });

  client.on('peer-leave', function (evt) {
    let id = evt.uid;
    localLog('Peer has left: ' + id);
    //Notiy when user leaves.
    setTimeout(function () {
      var peerExists = false;
      streamList.forEach(val => {
        if (val.getId() == id) {
          peerExists = true;
        }
      })
      if (!peerExists) {
        Notify.danger(id + ' has been left', 2000);
      }
    }, 7500);

    localLog(new Date().toLocaleTimeString());
    if (id === SHARE_ID) {
      options.displayMode = 0;
      if (options.attendeeMode === 'video') {
        ButtonControl.enable('.shareScreenBtn');
      }
      shareEnd();
    }
    if (id === mainId) {
      let next = options.displayMode === 2 ? SHARE_ID : localStream.getId();
      setHighStream(mainId, next);
      mainId = next;
      mainStream = getStreamById(mainId);
    }
    removeStream(evt.uid);
  });

  client.on('stream-subscribed', function (evt) {

    let stream = evt.stream;
    localLog('Got stream-subscribed event');
    localLog(new Date().toLocaleTimeString());
    localLog('Subscribe remote stream successfully: ' + stream.getId());
    addStream(stream);
  });

  client.on('stream-removed', function (evt) {
    let stream = evt.stream;
    let id = stream.getId();
    localLog('Stream removed: ' + id);
    localLog(new Date().toLocaleTimeString());
    if (id === SHARE_ID) {
      options.displayMode = 0;
      if (options.attendeeMode === 'video') {
        ButtonControl.enable('.shareScreenBtn');
      }
      shareEnd();
    }
    if (id === mainId) {
      let next = options.displayMode === 2 ? SHARE_ID : localStream.getId();
      setHighStream(mainId, next);
      mainId = next;
      mainStream = getStreamById(mainId);
    }
    removeStream(stream.getId());
  });
};

const subscribeMouseEvents = () => {
  $('.displayModeBtn').on('click', function (e) {
    if (e.currentTarget.classList.contains('disabled') || streamList.length <= 1) {
      return;
    }
    // 1 refer to pip mode
    if (options.displayMode === 3 || options.displayMode === 2) {
      options.displayMode = 0;
      $('#closeBtnId').css('display', 'none');
      $('.left-scroll-box').css('display', 'none');
      $('.right-scroll-box').css('display', 'none');
    } else if (options.displayMode === 0) {
      options.displayMode = 3;
      $('#closeBtnId').css('display', 'block');
    } else {
      // Do nothing when in screen share mode
    }
    var selectStreamexists = false;
    var mainIdExists = false;
    streamList.forEach(val => {
      if (val.getId() == selectedStreamUID) {
        selectStreamexists = true;
      } if (val.getId() == mainId) {
        mainIdExists = true;
      }
    });
    if (selectStreamexists) {
      mainId = selectedStreamUID;
      Renderer.customRender(streamList, options.displayMode, selectedStreamUID);
    }
    else if (mainIdExists) {
      Renderer.customRender(streamList, options.displayMode, mainId);
    } else {
      Renderer.customRender(streamList, options.displayMode, localStream.getId());
    }
  });

  $('.exitBtn').on('click', function () {
    try {
      shareClient && shareEnd();
      client && client.unpublish(localStream);
      localStream && localStream.close();
      client &&
        client.leave(
          () => {
            localLog('Client succeed to leave.');
          },
          () => {
            localLog('Client failed to leave.');
          }
        );
    } finally {
      // Redirect to index
      window.location.href = 'index.html';
    }
  });

  $('.videoControlBtn').on('click', function () {
    $('.videoControlBtn').toggleClass('off');
    localStream.isVideoOn() ? localStream.disableVideo() : localStream.enableVideo();
    localStream.isVideoOn() ? $('#player_' + localStream.streamId).removeClass('player') : $('#player_' + localStream.streamId).addClass('player');
  });

  $('.audioControlBtn').on('click', function () {
    $('.audioControlBtn').toggleClass('off');
    localStream.isAudioOn() ? localStream.disableAudio() : localStream.enableAudio();
  });

  $('.shareScreenBtn').on('click', function (e) {
    if (e.currentTarget.classList.contains('disabled')) {
      return;
    }
    if (shareClient) {
      shareEnd();
    } else {
      shareStart();
    }
  });

  $('.disableRemoteBtn').on('click', function (e) {
    if (e.currentTarget.classList.contains('disabled') || streamList.length <= 1) {
      return;
    }
    $('.disableRemoteBtn').toggleClass('off');
    let list;
    let id = localStream.getId();
    list = Array.from(document.querySelectorAll(`.video-item:not(#video-item-${id})`));
    list.map(item => {
      if (item.style.display === 'none') {
        item.style.display = 'block';
        return 1;
      }
      item.style.display = 'none';
      return 0;
    });
  });

  $(window).resize(function (_) {

    if (isMobileSize()) {
      Renderer.customRender(streamList, 0, mainId);
    }
    //On windwo resize set chat height based on parent div
    if ($("#chatparent").height() - $(".chat-members-list").height() >= 5) {
      $(".chat-messages-view").css("height", $("#chatparent").height() - $(".chat-members-list").height());
    } else {
      $(".chat-messages-view").css("height", "84%");
    }
    Renderer.customRender(streamList, options.displayMode, mainId);
  });

  // Dbl click to switch high/low stream
  var touchtime = 0;
  $('.ag-container').on("touchend click", function (e) { 
    let dom = e.target;
    if (touchtime == 0) {
      // set first click
      touchtime = new Date().getTime();      
    } else {
      if (((new Date().getTime()) - touchtime) < 600) {
        // double click occurred
       
        while (!dom.classList.contains('video-item')) {
          dom = dom.parentNode;
          if (dom.classList.contains('ag-main')) {
            return;
          }
        }
        doubleClick(dom);
        touchtime = 0;
      } else {
        // not a double click so set as a new first click
        touchtime = new Date().getTime();
      }
    }
  });

  //On Close button event
  $("#closeBtnId").click(function (event) {
    $('#closeBtnId').css('display', 'none');
    options.displayMode = 0;
    Renderer.customRender(streamList, options.displayMode, mainId);
    $('.left-scroll-box').css('display', 'none');
    $('.right-scroll-box').css('display', 'none');
  }
  );

  $(document).mousemove(function (_) {
    if (global._toolbarToggle) {
      clearTimeout(global._toolbarToggle);
      //Set the bottom stream icon on top of ag-container btn group when .ag-btn-group class is active
      var uid = mainId;
      if (options.displayMode === 3) {
        if (!isNullOrUndefined(selectedStreamUID)) {
          uid = selectedStreamUID;
        }
        else if (isNullOrUndefined(mainId)) {
          if (Object.keys(localStream).length > 0) {
            mainId = localStream.getId();
            uid = mainId;
          }
        }
        if (!isNullOrUndefined(uid))
          Renderer.customPipeBottomRenderer(streamList, uid, "");
        if ($('.ag-btn-group').height() == 70) {
          $('.left-scroll-box').css('bottom', '1.50in');
          $('.right-scroll-box').css('bottom', '1.50in');
        }
        else {
          $('.left-scroll-box').css('bottom', '1.25in');
          $('.right-scroll-box').css('bottom', '1.25in');
        }
      }
    }
    $('.ag-btn-group').addClass('active');
    global._toolbarToggle = setTimeout(function () {
      $('.ag-btn-group').removeClass('active');
      if (options.displayMode === 3) {
        Renderer.customPipeBottomRenderer(streamList, mainId, "");
        $('.left-scroll-box').css('bottom', '0.80in');
        $('.right-scroll-box').css('bottom', '0.80in');
      }
    }, 2500);
  });

  $(".chatBtn").click(function (event) {
    displayOrHideChat();
  });
};

const displayOrHideChat = () => {
  isChatDisplayed = !isChatDisplayed;
  if (isChatDisplayed) {
    $(".chat-area").css("display", "block");
    $(".chat-area").css("width", "20%");
    $(".video-area").css("width", "70%");
    $(".chatBtn").removeClass('fa-chevron-circle-right')
    $(".chatBtn").addClass('fa-chevron-circle-left')
    $('.chat-notification-icon').fadeOut('slow');
  } else {
    $(".chat-area").css("display", "none");
    $(".chat-area").css("width", "20%");
    $(".video-area").css("width", "100%");
    $(".chatBtn").removeClass('fa-chevron-circle-left')
    $(".chatBtn").addClass('fa-chevron-circle-right')
  }
  Renderer.customRender(streamList, options.displayMode, mainId);
}

//Volume calcuation and appending to volume bar (will be called for  every 100 milli seconds)
const volumeInfoDetect = () => {
  for (let i = 0; i < streamList.length; i++) {
    let item = streamList[i];
    let id = item.getId();
    const volume = Math.round(item.getAudioLevel() * 100);
    if (volume <= 10) {
      $('#audiobar-' + (id)).find('progress').css('display', 'none');
    } else {
      $('#audiobar-' + (id)).find('progress').css('display', 'block');
      $('#audiobar-' + (id)).find('progress').val(volume);
    }
  }
}
const subscribeResizableEvents = () => {
  $(".chat-members-list").resizable({
    containment: "parent",
    handles: 'n, s',
    resize: function (event, ui) {
      if ($(this).height() /
        $(this).parent().height() * 100 < 50) {
        $(".chat-messages-view").css("height", $("#chatparent").height() - $(this).height());
      }
    }
  });

  $(".chat-members-list").on('scroll', function () {
    if (($(this).scrollTop() < $(this).height() + 5) && ($("#channelMembersInnerDiv").height() > $(this).scrollTop() + $(this).height())) {
      $('.ui-resizable-s').css('bottom', (-5 - $(this).scrollTop() + "px"));
    }
  });

};
// ------------- start --------------
// ----------------------------------
options = optionsInit();
uiInit(options);
// eslint-disable-next-line
client = AgoraRTC.createClient({
  mode: options.transcode
});

subscribeMouseEvents();
subscribeStreamEvents();
subscribeResizableEvents();
clientInit(client, options).then(uid => {
  options.uid = uid;
  // Use selected device
  let config = isSafari()
    ? {}
    : {
      cameraId: options.cameraId,
      microphoneId: options.microphoneId
    };
  localStream = streamInit(uid, options, config);

  // Enable dual stream
  if (options.attendeeMode !== 'audience') {
    // MainId default to be localStream's ID
    mainId = uid;
    mainStream = localStream;
  }
  enableDualStream();
  localStream.init(
    () => {
      if (options.attendeeMode !== 'audience') {
        setTimeout(function () { isLocalStreamInitialised = true; }, 3000);
        addStream(localStream, true);
        client.publish(localStream, err => {
          localLog('Publish local stream error: ' + err);
        });
        doubleClick(null, localStream.getId());
      }
    },
    err => {
      localLog('getUserMedia failed', err);
    }
  );
});

setInterval(volumeInfoDetect, 150);
//------------Chat functionality-----------------

class Client {
  // Construct a meeting client with signal client and rtc client
  constructor(sclient, localAccount) {
    this.cleanData();
    this.signal = sclient;
    this.localAccount = localAccount;
    this.current_conversation = null;
    this.current_msgs = null;
    this.loadFromLocalStorage();
    this.updateChatList();
    this.subscribeEvents();
  }

  invoke(func, args, cb) {
    let session = this.signal.session;
    session &&
      session.invoke(func, args, function (err, val) {
        if (err) {
          console.error(val.reason);
        } else {
          cb && cb(err, val);
        }
      });
  }

  cleanData() {
    localStorage.setItem('chats', '');
    localStorage.setItem('messages', '');
  }

  updateLocalStorage() {
    localStorage.setItem('chats', JSON.stringify(this.chats));
    localStorage.setItem('messages', JSON.stringify(this.messages));
  }

  loadFromLocalStorage() {
    this.chats = JSON.parse(localStorage.getItem('chats') || '[]');
    this.messages = JSON.parse(localStorage.getItem('messages') || '{}');
  }

  updateChatList() {
    let client = this;
    let chatsContainer = $('.chat-history');
    chatsContainer.html('');
    let html = '';
    for (var i = 0; i < this.chats.length; i++) {
      html +=
        '<li name="' +
        this.chats[i].id +
        '" type="' +
        this.chats[i].type +
        '" account="' +
        this.chats[i].account +
        '">';
      html += '<div class="title">' + this.chats[i].account + '</div>';
      html += '<div class="desc">' + this.chats[i].type + '</div>';
      html += '</li>';
    }
    chatsContainer.html(html);
    $('.chat-history li')
      .off('click')
      .on('click', function () {
        let mid = $(this).attr('name');
        let type = $(this).attr('type');
        let account = $(this).attr('account');
        if (type === 'channel') {
          client.signal.leave().then(() => {
            client.signal.join(account).then(() => {
              client.showMessage(mid);
            });
          });
        } else {
          client.showMessage(mid);
        }
      });

    if (this.chats.length > 0) {
      let type = this.chats[0].type;
      let account = this.chats[0].account;
      let mid = this.chats[0].id;
      if (type === 'channel') {
        client.signal.leave().then(() => {
          client.signal.join(account).then(() => {
            client.showMessage(mid);
          });
        });
      } else {
        client.showMessage(mid);
      }
    }
  }

  showMessage(mid) {
    let client = this;
    this.current_msgs = this.messages[mid] || [];
    let conversation = this.chats.filter(function (item) {
      return String(item.id) === String(mid);
    });
    if (conversation.length === 0) {
      return;
    }
    this.current_conversation = conversation[0];
    this.current_msgs = this.messages[this.current_conversation.id] || [];
    $('#message-to-send')
      .off('keydown')
      .on('keydown', function (e) {
        if (e.keyCode == 13) {
          e.preventDefault();
          client.sendMessage($(this).val());
          $(this).val('');
        }
      });

    let chatMsgContainer = $('.chat-messages');
    chatMsgContainer.html('');
    let html = '';
    for (let i = 0; i < this.current_msgs.length; i++) {
      html += this.buildMsg(
        this.current_msgs[i].text,
        this.current_msgs[i].account === this.localAccount,
        this.current_msgs[i].ts,
        this.current_msgs[i].streamUID
      );
    }
    $('.chat-history li').removeClass('selected');
    $('.chat-history li[name=' + mid + ']').addClass('selected');
    chatMsgContainer.html(html);
    chatMsgContainer.scrollTop(chatMsgContainer[0].scrollHeight);

    if (conversation[0].type === 'instant') {
      let [query, account] = [
        'io.agora.signal.user_query_user_status',
        conversation[0].account
      ];
      let peerStatus;
      client.invoke(query, { account }, function (err, val) {
        if (val.status) {
          peerStatus = 'Online';
        } else {
          peerStatus = 'Offline';
        }
      });
    } else {
      client.invoke(
        'io.agora.signal.channel_query_num',
        { name: conversation[0].account },
        (err, val) => {
        }
      );
    }
  }

  sendMessage(text) {
    if (!text.trim()) return false; // Empty
    if (!this.current_msgs) {
      return;
    }
    let msg_item = { ts: new Date(), text: text, account: this.localAccount };
    this.current_msgs.push(msg_item);
    if (this.current_conversation.type === 'instant') {
      this.signal.sendMessage(this.current_conversation.account, text);
    } else {
      this.signal.broadcastMessage(text);
    }
    let chatMsgContainer = $('.chat-messages');
    chatMsgContainer.append(this.buildMsg(text, true, msg_item.ts, this.localAccount));
    chatMsgContainer.scrollTop(chatMsgContainer[0].scrollHeight);
    this.updateMessageMap();
  }

  updateMessageMap(c, m) {
    let conversation = c || this.current_conversation;
    let msgs = m || this.current_msgs;
    this.messages[conversation.id] = msgs;
    this.chats.filter(item => {
      if (item.id === conversation.id && item.type === conversation.type) {
        item.lastMoment = new Date();
      }
    });
    this.updateLocalStorage();
  }

  // Return a promise resolves a remote account name
  addConversation() {
    let deferred = $.Deferred();
    let dialog = $('.conversation-modal');
    let accountField = dialog.find('.remoteAccountField');
    let localAccount = this.localAccount;
    let client = this;
    let account = options.channel;
    let type = "channel";
    // Validation
    let isValid = () => {
      if (!account) return false; // Empty
      if (!/^[^\s]*$/.test(account)) {
        // Has space character
        return false;
      }
      return true;
    };

    let isExisted = () => {
      return client.chats.some(function (item) {
        return item.account === account && item.type === type;
      });
    };
    let isSelf = () => {
      return type === 'instant' && account === localAccount;
    };

    if (!isValid()) {
      $('.conversation-target-field')
        .siblings('.invalid-feedback')
        .html('Please input a valid name.');
      $('.conversation-target-field')
        .removeClass('is-invalid')
        .addClass('is-invalid');
    } else if (isSelf()) {
      $('.conversation-target-field')
        .siblings('.invalid-feedback')
        .html('You cannot chat with yourself.');
      $('.conversation-target-field')
        .removeClass('is-invalid')
        .addClass('is-invalid');
    } else if (isExisted()) {
      $('.conversation-target-field')
        .siblings('.invalid-feedback')
        .html('Existed.');
      $('.conversation-target-field')
        .removeClass('is-invalid')
        .addClass('is-invalid');
    } else {
      $('.conversation-target-field').removeClass('is-invalid');
      dialog.find('.conversation-target-field').val('');
      dialog.modal('hide');
      client.chats.splice(0, 0, {
        id: new Date().getTime(),
        account: account,
        type: type
      });
      client.updateLocalStorage();
      client.updateChatList();
      deferred.resolve(account);
    }

    dialog
      .find('.cancelBtn')
      .off('click')
      .on('click', e => {
        // Dialog confirm
        dialog.modal('hide');
        deferred.reject();
      });

    dialog
      .find('.conversation-target-field')
      .off('keydown')
      .on('keydown', function (e) {
        if (e.keyCode == 13) {
          e.preventDefault();
          dialog.find('.confirmBtn').click();
        }
      });
    // Start modal 
    return deferred;
  }

  // Events
  subscribeEvents() {
    let signal = this.signal;
    let client = this;
    client.addConversation();
    $('.logout-btn')
      .off('click')
      .on('click', function () {
        signal.logout().then(() => {
          window.location.href = 'index.html';
        });
      });

    $(':radio[name="type"]').change(function () {
      var type = $(this)
        .filter(':checked')
        .val();
      var field = $('.conversation-target-field');
      switch (type) {
        case 'instant':
          field.attr('placeholder', "Input someone's account");
          break;
        case 'channel':
          field.attr('placeholder', 'Input a channel name');
          break;
      }
    });


    signal.sessionEmitter.on('onMessageInstantReceive', (account, uid, msg) => {
      this.onReceiveMessage(account, msg, 'instant');
    });
    signal.channelEmitter.on('onMessageChannelReceive', (account, uid, msg) => {
      if (account !== signal.account) {
        this.onReceiveMessage(signal.channel.name, msg, 'channel', account);
        if (!isChatDisplayed) {
          if ($('.chat-notification-icon').css('display') == 'none') {
            document.getElementById('chat-notification-audio').play();         
          }
          $('.chat-notification-icon').fadeIn('slow');
        } else {
          $('.chat-notification-icon').css('display', 'none');
        }
      }
    });

    signal.channelEmitter.on('onChannelUserLeaved', (account, uid) => {
      client.invoke(
        'io.agora.signal.channel_query_num',
        { name: signal.channel.name },
        (err, val) => {
        }
      );
    });

    signal.channelEmitter.on('onChannelUserJoined', (account, uid) => {
      client.invoke(
        'io.agora.signal.channel_query_num',
        { name: signal.channel.name },
        (err, val) => {
        }
      );
    });
  }

  onReceiveMessage(account, msg, type, streamUID) {
    let client = this;
    var conversations = this.chats.filter(function (item) {
      return item.account === account;
    });

    if (conversations.length === 0) {
      // No conversation yet, create one
      conversations = [{ id: new Date().getTime(), account: account, type: type }];
      client.chats.splice(0, 0, conversations[0]);
      client.updateLocalStorage();
      client.updateChatList();
    }

    for (let i = 0; i < conversations.length; i++) {
      let conversation = conversations[i];
      let msgs = this.messages[conversation.id] || [];
      let msg_item = { ts: new Date(), text: msg, account: account, streamUID: streamUID };
      msgs.push(msg_item);
      this.updateMessageMap(conversation, msgs);
      let chatMsgContainer = $('.chat-messages');
      if (String(conversation.id) === String(this.current_conversation.id)) {
        this.showMessage(this.current_conversation.id)
        chatMsgContainer.scrollTop(chatMsgContainer[0].scrollHeight);
      }
    }
  }

  buildMsg(msg, me, ts, streamUID) {
    let html = '';
    let timeStr = this.compareByLastMoment(ts);
    if (timeStr) {
      html += `<div class="time-stamp">${timeStr}</div>`;
    }
    let className = me ? 'message right clearfix' : 'message left clearfix';
    html += '<li class="' + className + '">';
    // html += '<img src="https://s3-us-west-2.amazonaws.com/s.cdpn.io/245657/1_copy.jpg">';
    if (me)
      html += '<span>' + localAccount + '</span>';
    else
      html += '<span>' + streamUID + '</span>';
    html +=
      '<br><div class="bubble">' +
      Utils.safe_tags_replace(msg) +
      '<div class="corner"></div>';
    html += '<span>' + this.parseTwitterDate(ts) + '</span></div></li>';
    return html;
  }

  compareByLastMoment(ts) {
    let lastMoment = null;
    this.chats.forEach(item => {
      if (
        item.id === this.current_conversation.id &&
        item.type === this.current_conversation.type
      ) {
        lastMoment = item.lastMoment;
      }
    });
    if (!lastMoment) {
      let time = new Date();
      return time.toDateString() + ' ' + time.toLocaleTimeString();
    }
    let diff = Math.floor((ts - lastMoment) / 1000);
    if (diff < 120) {
      return '';
    }
    return new Date().toLocaleTimeString();
  }

  parseTwitterDate(tdate) {
    var system_date = new Date(Date.parse(tdate));
    var user_date = new Date();
    var diff = Math.floor((user_date - system_date) / 1000);
    if (diff <= 1) {
      return 'just now';
    }
    if (diff < 20) {
      return diff + ' seconds ago';
    }
    if (diff < 40) {
      return 'half a minute ago';
    }
    if (diff < 60) {
      return 'less than a minute ago';
    }
    if (diff <= 90) {
      return 'one minute ago';
    }
    if (diff <= 3540) {
      return Math.round(diff / 60) + ' minutes ago';
    }
    if (diff <= 5400) {
      return '1 hour ago';
    }
    if (diff <= 86400) {
      return Math.round(diff / 3600) + ' hours ago';
    }
    if (diff <= 129600) {
      return '1 day ago';
    }
    if (diff < 604800) {
      return Math.round(diff / 86400) + ' days ago';
    }
    if (diff <= 777600) {
      return '1 week ago';
    }
    return 'on ' + system_date;
  }

}
