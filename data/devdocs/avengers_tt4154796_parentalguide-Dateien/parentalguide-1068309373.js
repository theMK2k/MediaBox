!function a(b,c,d){function e(g,h){if(!c[g]){if(!b[g]){var i="function"==typeof require&&require;if(!h&&i)return i(g,!0);if(f)return f(g,!0);var j=new Error("Cannot find module '"+g+"'");throw j.code="MODULE_NOT_FOUND",j}var k=c[g]={exports:{}};b[g][0].call(k.exports,function(a){var c=b[g][1][a];return e(c?c:a)},k,k.exports,a,b,c,d)}return c[g].exports}for(var f="function"==typeof require&&require,g=0;g<d.length;g++)e(d[g]);return e}({1:[function(a,b,c){"use strict";function d(a){return a&&a.__esModule?a:{"default":a}}var e=a(4),f=d(e);f["default"]()},{4:4}],2:[function(a,b,c){"use strict";function d(a){var b=encodeURIComponent(window.location.pathname+window.location.search),c="https://"+window.location.hostname+"/registration/signin?u="+b+"&ref_="+a;window.location=c}function e(){return g||(g=f.createUserLoginState()),g.getLoggedInStatus()}c.__esModule=!0,c.redirectToLoginPage=d,c.isUserLoggedIn=e;var f=a(3),g=void 0},{3:3}],3:[function(a,b,c){"use strict";function d(a,b){if(!(a instanceof b))throw new TypeError("Cannot call a class as a function")}function e(a){return new g(a)}c.__esModule=!0;var f=function(){function a(a,b){for(var c=0;c<b.length;c++){var d=b[c];d.enumerable=d.enumerable||!1,d.configurable=!0,"value"in d&&(d.writable=!0),Object.defineProperty(a,d.key,d)}}return function(b,c,d){return c&&a(b.prototype,c),d&&a(b,d),b}}();c.createUserLoginState=e;var g=function(){function a(){var b=arguments.length<=0||void 0===arguments[0]?window.XMLHttpRequest:arguments[0];d(this,a),this.Requester=b,this.requestUrl="/registration/is-user-recognized",this.isLoggedIn=void 0,this.hasTestedLogin=!1}return f(a,[{key:"getLoginStateFromResponse",value:function(a){return JSON.parse(a).isUserRecognized||!1}},{key:"getLoggedInStatus",value:function(){if(this.hasTestedLogin)return this.isLoggedIn;var a=new this.Requester;return a.open("GET",this.requestUrl,!1),a.send(),this.isLoggedIn=this.getLoginStateFromResponse(a.response),this.hasTestedLogin=!0,this.isLoggedIn}}]),a}()},{}],4:[function(a,b,c){"use strict";function d(){e.autoInit()}c.__esModule=!0,c["default"]=d;var e=a(6);b.exports=c["default"]},{6:6}],5:[function(a,b,c){"use strict";function d(){var a="https://"+window.location.hostname+"/registration/signin";window.location.href=a,"/"!==window.location.pathname&&(a+="?u="+encodeURIComponent(window.location)),window.location.href=a}function e(){return f.isUserLoggedIn()?!0:(d(),!1)}c.__esModule=!0,c.isLoggedInRedirect=e;var f=a(2)},{2:2}],6:[function(a,b,c){"use strict";function d(a,b){if(!j.isLoggedInRedirect())return!1;var c="parentalguide/vote/"+a,d=new XMLHttpRequest;return d.open("POST",c,!0),d.setRequestHeader("Content-Type","application/x-www-form-urlencoded; charset=UTF-8"),d.setRequestHeader("X-Requested-With","XMLHttpRequest"),d.onreadystatechange=function(){d.readyState===d.DONE&&(200===d.status?e(b.value,b.voteBox):f(b.voteBox))},d.send("voteValue="+b.value),!0}function e(a,b){b.parentNode.classList.add("advisory-severity-vote--vote-cast");var c=b.parentNode.getElementsByClassName("advisory-severity-vote__message-container")[0],d=c.getElementsByClassName("advisory-severity-vote__message")[0],e=c.getElementsByClassName("ipl-status-pill")[0];switch(a){case"none":e.textContent="None";break;case"mild":e.classList.add("ipl-status-pill--ok"),e.textContent="Mild";break;case"moderate":e.classList.add("ipl-status-pill--warning"),e.textContent="Moderate";break;case"severe":e.classList.add("ipl-status-pill--critical"),e.textContent="Severe"}"none"===a?d.textContent="You found this to have none":d.textContent="You found this "+a}function f(a){a.parentNode.classList.add("advisory-severity-vote--error")}function g(a){var b=a.getAttribute("data-category"),c=a.getElementsByClassName("ipl-vote-button__button");Array.from(c).forEach(function(c){c.voteBox=a,c.addEventListener("click",function(){d(b,c)})})}function h(a){g(a)}function i(){var a=document.getElementsByClassName("advisory-severity-vote__cast-vote-container");Array.from(a).forEach(function(a){g(a)})}c.__esModule=!0,c["default"]=h,c.autoInit=i;var j=a(5)},{5:5}]},{},[1]);