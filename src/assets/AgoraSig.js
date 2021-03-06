(LOGIN_STATE_NOT_LOGIN = 0),
  (LOGIN_STATE_LOGINING = 1),
  (LOGIN_STATE_LOGINED = 2),
  (LOGIN_STATE_RECONNECTING = 3),
  (SIGNALING_SDK_VERSION = '1.3.0'),
  (Signal_ = function(e) {
    function n(e) {
      var n, t, i;
      for (i = e.length; i; i--)
        (n = Math.floor(Math.random() * i)),
          (t = e[i - 1]),
          (e[i - 1] = e[n]),
          (e[n] = t);
    }
    (this.getSDKVersion = function() {
      return SIGNALING_SDK_VERSION;
    }),
      (this.lbs_url1 = ['https://lbs-1-sig.agora.io', 'https://lbs-2-sig.agora.io']),
      (this.lbs_url2 = ['https://lbs-3-sig.agora.io', 'https://lbs-4-sig.agora.io']),
      (this.vid = e),
      (this.appid = e);
    var t = this;
    function i(e, n, t) {
      var i = e.split(n, t),
        o = 0;
      for (var s in i) o += n.length + i[s].length;
      return i.push(e.substr(o)), i;
    }
    (t.server_urls = []),
      (t.setup_debugging = function(e, n) {
        if (e === 'ap') t.server_urls.push([n, 8001]), (t.debugging = !0);
        else {
          if (e !== 'env') return;
          n === 'lbs100' &&
            ((t.lbs_url1 = [
              'https://lbs100-1-sig.agora.io',
              'https://lbs100-2-sig.agora.io'
            ]),
            (t.lbs_url2 = [
              'https://lbs100-3-sig.agora.io',
              'https://lbs100-4-sig.agora.io'
            ]));
        }
      });
    var o = function(o, s) {
      (this.onLoginSuccess = ''),
        (this.onLoginFailed = ''),
        (this.onLogout = ''),
        (this.onInviteReceived = ''),
        (this.onMessageInstantReceive = ''),
        (this.account = o),
        (this.config_msg_set = 0),
        (this.config_inst_msg_with_msgid = 0),
        (this.debugging = t.debugging),
        (this.m_msgid = 0),
        (this.state = LOGIN_STATE_LOGINING),
        (this.line = ''),
        (this.uid = 0),
        (this.dbg = !1);
      var a = this;
      a.lbs_state = 'requesting';
      var r = t.server_urls.slice();
      n(r),
        (a.idx = 0),
        (a.v3_msg_set = new Map()),
        setTimeout(function() {
          for (var e of ((now = Date.now()), a.v3_msg_set.keys()))
            if (a.v3_msg_set[e]) {
              if (!(now - a.v3_msg_set[e] > 3e5)) break;
              a.v3_msg_set.delete(e);
            }
        }, 2e3),
        (a.socket = null);
      var l = function() {
        if (a.dbg) {
          var e = [];
          for (var n in arguments) e.push(arguments[n]);
          console.log.apply(null, ['Agora sig dbg :'].concat(e));
        }
      };
      (a.logout = function() {
        a.state === LOGIN_STATE_LOGINED && a.onLogout
          ? a.call2('user_logout', { line: a.line }, function(e, n) {
              a.fire_logout(101), a.socket.close();
            })
          : a.state === LOGIN_STATE_LOGINING &&
            ((a.state = LOGIN_STATE_NOT_LOGIN), a.fire_logout(101));
      }),
        (a.fire_login_failed = function(e) {
          try {
            a.state === LOGIN_STATE_LOGINING && a.onLoginFailed && a.onLoginFailed(e);
          } catch (e) {
            console.error(e);
          } finally {
            a.state = LOGIN_STATE_NOT_LOGIN;
          }
        }),
        (a.fire_logout = function(e) {
          e || (e = 0);
          try {
            a.state === LOGIN_STATE_LOGINED && a.onLogout && a.onLogout(e);
          } catch (e) {
            console.error(e);
          } finally {
            a.state = LOGIN_STATE_NOT_LOGIN;
          }
        }),
        (a.getStatus = function() {
          return a.state;
        });
      var c = function(n, t, i) {
          a.lbs_state == 'requesting' &&
            (function(e, n, t) {
              var i = new XMLHttpRequest(),
                o = !1,
                s = setTimeout(function() {
                  (o = !0), i.abort(), t('timeout', '');
                }, n);
              i.open('GET', e),
                (i.onreadystatechange = function() {
                  i.readyState === 4 &&
                    (o || (clearTimeout(s), i.status === 200 && t('', i.responseText)));
                }),
                i.send(null);
            })(t[i] + '/getaddr?vid=' + e, 5e3, function(e, o) {
              if (e)
                n - 1 > 0 ? c(n - 1, t, (i + 1) % t.length) : a.fire_login_failed(201);
              else {
                if (a.lbs_state != 'requesting') return;
                (a.lbs_state = 'completed'), (r = JSON.parse(o).web), g(), g();
              }
            });
        },
        g = function() {
          if (a.state === LOGIN_STATE_LOGINING)
            var n = new function() {
              var e,
                t =
                  'wss://' +
                  (e = r[a.idx])[0].replace(/\./g, '-') +
                  '-sig-web.agora.io:' +
                  (e[1] + 1) +
                  '/';
              //console.log(t), (a.idx = (a.idx + 1) % r.length);
              var i = new WebSocket(t);
              (i.state = 'CONNECTING'),
                setTimeout(function() {
                  i.readyState !== i.CONNECTING || i.close();
                }, 6e3),
                (i.onopen = function(e) {
                  if (a.state === LOGIN_STATE_NOT_LOGIN) i.close();
                  else if (a.state === LOGIN_STATE_LOGINING && a.socket === null)
                    for (var t in ((a.socket = n),
                    (i.state = 'OPEN'),
                    l('on conn open'),
                    a.go_login(),
                    c))
                      i.send(JSON.stringify(c[t]));
                  else i.close();
                }),
                (i.onclose = function(e) {
                  i.state === 'open' &&
                    a.state === LOGIN_STATE_LOGINED &&
                    (a.onLogout && a.onLogout('WebSocket connection closed.'),
                    s('_close', ''),
                    l('on conn close')),
                    i.state === 'CONNECTING' && g();
                }),
                (i.onmessage = function(e) {
                  var n = e.data;
                  l('Received message ', n);
                  var t = JSON.parse(n);
                  t[0];
                  s(t[0], t[1]);
                }),
                (i.onerror = function(e) {
                  (i.state = 'CLOSED'),
                    a.idx < r.length && e.target.readyState === e.target.CLOSED
                      ? g()
                      : (l('on conn error'),
                        a.state === LOGIN_STATE_LOGINED && a.socket === n
                          ? a.fire_logout('conn error')
                          : a.state === LOGIN_STATE_LOGINING &&
                            a.socket == n &&
                            a.fire_login_failed(201));
                });
              var o = {},
                s = function(e, n) {
                  e in o && o[e](n);
                },
                c = [];
              (this.on = function(e, n) {
                o[e] = n;
              }),
                (this.emit = function(e, n) {
                  i.readyState !== 0
                    ? (l('Sending ', [e, n]), i.send(JSON.stringify([e, n])))
                    : c.push([e, n]);
                }),
                (this.close = function() {
                  i.close();
                });
            }();
          var t = 0,
            c = function() {
              setTimeout(function() {
                a.state == LOGIN_STATE_LOGINED &&
                  (l('send ping', ++t), a.socket.emit('ping', t), c());
              }, 1e4);
            };
          a.go_login = function() {
            a.line === ''
              ? (a.socket.emit('login', {
                  vid: e,
                  account: o,
                  uid: 0,
                  token: s,
                  device: 'websdk',
                  ip: ''
                }),
                a.socket.on('login_ret', function(e) {
                  var n = e[0],
                    t = JSON.parse(e[1]);
                  if ((l('login ret', n, t), n || t.result !== 'ok')) {
                    n === '' && (n = t.reason);
                    try {
                      if (a.onLoginFailed) {
                        var i =
                          n === 'kick'
                            ? 207
                            : n === 'TokenErrorExpired'
                              ? 204
                              : n.startsWith('TokenError')
                                ? 206
                                : 201;
                        a.fire_login_failed(i);
                      }
                    } catch (i) {
                      console.error(i);
                    }
                  } else {
                    (a.config_msg_set = t.config_msg_set || 0),
                      (a.config_inst_msg_with_msgid = t.config_inst_msg_with_msgid || 0),
                      (a.uid = t.uid),
                      (a.line = t.line),
                      (a.state = LOGIN_STATE_LOGINED),
                      c(),
                      y();
                    try {
                      a.onLoginSuccess && a.onLoginSuccess(a.uid);
                    } catch (i) {
                      console.error(i);
                    } finally {
                      O();
                    }
                  }
                }))
              : a.socket.emit('line_login', { line: a.line });
            var n = 0,
              t = {},
              r = {};
            (a.call2 = function(e, i, o) {
              (t[++n] = [e, i, o]),
                l('call ', [e, n, i]),
                a.socket.emit('call2', [e, n, i]);
            }),
              a.socket.on('call2-ret', function(e) {
                var n = e[0],
                  i = e[1],
                  o = e[2];
                if (n in t) {
                  var s = t[n][2];
                  if (i === '')
                    try {
                      (o = JSON.parse(o)).result != 'ok' && (i = o.data.result);
                    } catch (e) {
                      i = 'wrong resp:' + o;
                    }
                  s && s(i, o);
                }
              });
            var g,
              _ = function(e, n) {
                return e === '';
              },
              f = function(e) {
                if (e.startsWith('msg-v2 ')) {
                  if ((n = i(e, ' ', 6)).length === 7) return [n[1], n[4], n[6]];
                } else if (e.startsWith('msg-v3 ')) {
                  var n;
                  if ((n = i(e, ' ', 7)).length === 8)
                    return a.v3_msg_set.get(n[1])
                      ? null
                      : (a.v3_msg_set.set(n[1], Date.now()), [n[2], n[5], n[7]]);
                }
                return null;
              };
            a.socket.on('pong', function(e) {
              l('recv pong');
            }),
              a.socket.on('close', function(e) {
                a.fire_logout(0), a.socket.close();
              }),
              a.socket.on('_close', function(e) {
                a.fire_logout(0);
              });
            var h = function(e) {
                if (e) {
                  var n = e,
                    t = n[0],
                    i = n[1],
                    o = n[2];
                  if (i === 'instant')
                    try {
                      a.onMessageInstantReceive && a.onMessageInstantReceive(t, 0, o);
                    } catch (e) {
                      console.error(e);
                    }
                  if (i.startsWith('voip_')) {
                    var s,
                      l = JSON.parse(o),
                      c = l.channel,
                      g = l.peer,
                      _ = l.extra,
                      f = l.peeruid;
                    if (i === 'voip_invite')
                      (s = new G(c, g, f, _)),
                        a.call2('voip_invite_ack', {
                          line: a.line,
                          channelName: c,
                          peer: g,
                          extra: ''
                        });
                    else if (!(s = r[c + g])) return;
                    if (i === 'voip_invite')
                      try {
                        a.onInviteReceived && a.onInviteReceived(s);
                      } catch (e) {
                        console.error(e);
                      }
                    if (i === 'voip_invite_ack')
                      try {
                        s.onInviteReceivedByPeer && s.onInviteReceivedByPeer(_);
                      } catch (e) {
                        console.error(e);
                      }
                    if (i === 'voip_invite_accept')
                      try {
                        s.onInviteAcceptedByPeer && s.onInviteAcceptedByPeer(_);
                      } catch (e) {
                        console.error(e);
                      }
                    if (i === 'voip_invite_refuse')
                      try {
                        s.onInviteRefusedByPeer && s.onInviteRefusedByPeer(_);
                      } catch (e) {
                        console.error(e);
                      }
                    if (i === 'voip_invite_failed')
                      try {
                        s.onInviteFailed && s.onInviteFailed(_);
                      } catch (e) {
                        console.error(e);
                      }
                    if (i === 'voip_invite_bye')
                      try {
                        s.onInviteEndByPeer && s.onInviteEndByPeer(_);
                      } catch (e) {
                        console.error(e);
                      }
                    if (i === 'voip_invite_msg')
                      try {
                        s.onInviteMsg && s.onInviteMsg(_);
                      } catch (e) {
                        console.error(e);
                      }
                  }
                }
              },
              u = function() {
                return Date.now();
              },
              v = 0,
              d = 0,
              m = 0,
              I = 0,
              N = !1,
              p = [],
              L = 0,
              O = function() {
                N ||
                  ((N = !0),
                  (L = 0),
                  a.config_msg_set === 0
                    ? a.call2(
                        'user_getmsg',
                        { line: a.line, ver_clear: v, max: 30 },
                        function(e, n) {
                          if (e === '') {
                            var t = n,
                              i = v;
                            for (var o in ((m = parseInt(t.ver_clear)),
                            (v = Math.max(m, i)),
                            t.msgs)) {
                              var s = t.msgs[o][0],
                                a = t.msgs[o][1];
                              s >= v + 1 && (h(f(a)), (v = s));
                            }
                            (t.msgs.length === 30 || v < d) && O(), u();
                          }
                          (N = !1), (I = u());
                        }
                      )
                    : a.config_msg_set === 1 &&
                      a.call2(
                        'user_getmsg2',
                        { line: a.line, clear_msgs: p, max: 30 },
                        function(e, n) {
                          if (e === '') {
                            for (var t in ((p = []), n.msgs)) {
                              n.msgs[t][0];
                              var i = n.msgs[t][1];
                              h(f(i));
                            }
                            n.msgs.length >= 30 && O(), u();
                          }
                          (N = !1), (I = u());
                        }
                      ));
              },
              T = function() {
                a.config_msg_set === 0
                  ? (I = u())
                  : a.config_msg_set === 1 && L === 0 && (L = u() + 500);
              },
              y = function() {
                setTimeout(function() {
                  if (a.state !== LOGIN_STATE_NOT_LOGIN) {
                    if (a.state === LOGIN_STATE_LOGINED) {
                      var e = u();
                      a.config_msg_set === 0
                        ? m < v && e - I > 1e3
                          ? O()
                          : e - I >= 6e4 && O()
                        : a.config_msg_set === 1 && p.length > 0 && e > L && L > 0 && O();
                    }
                    y();
                  }
                }, 100);
              };
            a.socket.on('notify', function(e) {
              l('recv notify ', e),
                typeof e === 'string' && (e = (e = i(e, ' ', 2)).slice(1));
              var n = e[0];
              if (n === 'channel2') {
                var t = e[1],
                  o = e[2];
                if (
                  a.config_msg_set === 0 &&
                  g.m_channel_msgid != 0 &&
                  g.m_channel_msgid + 1 > o
                )
                  return void l('ignore channel msg', t, o, g.m_channel_msgid);
                g.m_channel_msgid = o;
                var s = f(e[3]);
                if (s) {
                  s[0];
                  var r = s[1],
                    c = s[2],
                    _ = JSON.parse(c);
                  if (r === 'channel_msg')
                    try {
                      g.onMessageChannelReceive &&
                        g.onMessageChannelReceive(_.account, _.uid, _.msg);
                    } catch (n) {
                      console.error(n);
                    }
                  if (r === 'channel_user_join')
                    try {
                      g.onChannelUserJoined && g.onChannelUserJoined(_.account, _.uid);
                    } catch (n) {
                      console.error(n);
                    }
                  if (r === 'channel_user_leave')
                    try {
                      g.onChannelUserLeaved && g.onChannelUserLeaved(_.account, _.uid);
                    } catch (n) {
                      console.error(n);
                    }
                  if (r === 'channel_attr_update')
                    try {
                      g.onChannelAttrUpdated &&
                        g.onChannelAttrUpdated(_.name, _.value, _.type);
                    } catch (n) {
                      console.error(n);
                    }
                }
              }
              if ((n === 'msg' && ((d = e[1]), O()), n === 'recvmsg')) {
                var u = JSON.parse(e[1]),
                  m = u[0],
                  I = u[1];
                m === v + 1 ? (h(f(I)), (v = m), T()) : ((d = m), O());
              }
              n === 'recvmsg_by_msgid' &&
                ((o = i(e[1], ' ', 7)[1]), p.push(o), h(f(e[1])), T());
            }),
              (a.messageInstantSend = function(e, n, t) {
                var i = {
                  line: a.line,
                  peer: e,
                  flag: 'v1:E:3600',
                  t: 'instant',
                  content: n
                };
                if (a.config_inst_msg_with_msgid === 1) {
                  var o = null;
                  typeof n === 'string' && (o = JSON.parse(n).msgid),
                    (i.messageID = o || u() % 1e6 + a.m_msgid++ % 1e6);
                }
                a.call2('user_sendmsg', i, function(e, n) {
                  t && t(!_(e));
                });
              }),
              (a.invoke = function(e, n, t) {
                if (e.startsWith('io.agora.signal.')) {
                  var i = e.split('.')[3];
                  (n.line = a.line),
                    a.call2(i, n, function(e, n) {
                      t && t(e, n);
                    });
                }
              });
            var G = function(e, n, t) {
              (this.onInviteReceivedByPeer = ''),
                (this.onInviteAcceptedByPeer = ''),
                (this.onInviteRefusedByPeer = ''),
                (this.onInviteFailed = ''),
                (this.onInviteEndByPeer = ''),
                (this.onInviteEndByMyself = ''),
                (this.onInviteMsg = '');
              var i = this;
              (this.channelName = e),
                (this.peer = n),
                (this.extra = t),
                (r[e + n] = i),
                (this.channelInviteUser2 = function() {
                  (t = t || ''),
                    a.call2(
                      'voip_invite',
                      { line: a.line, channelName: e, peer: n, extra: t },
                      function(e, n) {
                        if (_(e));
                        else
                          try {
                            i.onInviteFailed(e);
                          } catch (e) {
                            console.error(e);
                          }
                      }
                    );
                }),
                (this.channelInviteAccept = function(t) {
                  (t = t || ''),
                    a.call2('voip_invite_accept', {
                      line: a.line,
                      channelName: e,
                      peer: n,
                      extra: t
                    });
                }),
                (this.channelInviteRefuse = function(t) {
                  (t = t || ''),
                    a.call2('voip_invite_refuse', {
                      line: a.line,
                      channelName: e,
                      peer: n,
                      extra: t
                    });
                }),
                (this.channelInviteDTMF = function(t) {
                  a.call2('voip_invite_msg', {
                    line: a.line,
                    channelName: e,
                    peer: n,
                    extra: JSON.stringify({ msgtype: 'dtmf', msgdata: t })
                  });
                }),
                (this.channelInviteEnd = function(t) {
                  (t = t || ''),
                    a.call2('voip_invite_bye', {
                      line: a.line,
                      channelName: e,
                      peer: n,
                      extra: t
                    });
                  try {
                    i.onInviteEndByMyself && i.onInviteEndByMyself('');
                  } catch (e) {
                    console.error(e);
                  }
                });
            };
            (a.channelInviteUser2 = function(e, n, t) {
              var i = new G(e, n, t);
              return i.channelInviteUser2(), i;
            }),
              (a.channelJoin = function(e) {
                if (a.state == LOGIN_STATE_LOGINED)
                  return (
                    (g = new function() {
                      (this.onChannelJoined = ''),
                        (this.onChannelJoinFailed = ''),
                        (this.onChannelLeaved = ''),
                        (this.onChannelUserList = ''),
                        (this.onChannelUserJoined = ''),
                        (this.onChannelUserLeaved = ''),
                        (this.onChannelUserList = ''),
                        (this.onChannelAttrUpdated = ''),
                        (this.onMessageChannelReceive = ''),
                        (this.name = e),
                        (this.state = 'joining'),
                        (this.m_channel_msgid = 0),
                        (this.messageChannelSend = function(n, t) {
                          var i = { line: a.line, name: e, msg: n };
                          if (a.config_inst_msg_with_msgid === 1) {
                            var o = null;
                            typeof n === 'string' && (o = JSON.parse(n).msgid),
                              (i.msgID = o || u() % 1e6 + a.m_msgid++ % 1e6);
                          }
                          a.call2('channel_sendmsg', i, function(e, n) {
                            t && t();
                          });
                        }),
                        (this.channelLeave = function(n) {
                          a.call2('channel_leave', { line: a.line, name: e }, function(
                            e,
                            t
                          ) {
                            if (((g.state = 'leaved'), n)) n();
                            else
                              try {
                                g.onChannelLeaved && g.onChannelLeaved(0);
                              } catch (e) {
                                console.error(e);
                              }
                          });
                        }),
                        (this.channelSetAttr = function(n, t, i) {
                          a.call2(
                            'channel_set_attr',
                            { line: a.line, channel: e, name: n, value: t },
                            function(e, n) {
                              i && i();
                            }
                          );
                        }),
                        (this.channelDelAttr = function(n, t) {
                          a.call2(
                            'channel_del_attr',
                            { line: a.line, channel: e, name: n },
                            function(e, n) {
                              t && t();
                            }
                          );
                        }),
                        (this.channelClearAttr = function(n) {
                          a.call2(
                            'channel_clear_attr',
                            { line: a.line, channel: e },
                            function(e, t) {
                              n && n();
                            }
                          );
                        });
                    }()),
                    a.call2('channel_join', { line: a.line, name: e }, function(e, n) {
                      if (e === '') {
                        g.state = 'joined';
                        try {
                          g.onChannelJoined && g.onChannelJoined();
                        } catch (e) {
                          console.error(e);
                        }
                        var t = n;
                        try {
                          g.onChannelUserList && g.onChannelUserList(t.list);
                        } catch (e) {
                          console.error(e);
                        }
                        try {
                          if (g.onChannelAttrUpdated)
                            for (var i in t.attrs)
                              g.onChannelAttrUpdated(i, t.attrs[i], 'update');
                        } catch (e) {
                          console.error(e);
                        }
                      } else
                        try {
                          g.onChannelJoinFailed && g.onChannelJoinFailed(e);
                        } catch (e) {
                          console.error(e);
                        }
                    }),
                    g
                  );
                l('You should log in first.');
              });
          };
        };
      (a.socket = null),
        a.debugging
          ? ((a.lbs_state = 'completed'), g())
          : (n(t.lbs_url1), n(t.lbs_url2), c(2, t.lbs_url1, 0), c(2, t.lbs_url2, 0));
    };
    this.login = function(e, n) {
      return new o(e, n);
    };
  }),
  (Signal = function(e) {
    return new Signal_(e);
  });
