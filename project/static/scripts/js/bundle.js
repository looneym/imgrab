(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = require('./lib/axios');
},{"./lib/axios":3}],2:[function(require,module,exports){
(function (process){
'use strict';

var utils = require('./../utils');
var settle = require('./../core/settle');
var buildURL = require('./../helpers/buildURL');
var parseHeaders = require('./../helpers/parseHeaders');
var isURLSameOrigin = require('./../helpers/isURLSameOrigin');
var createError = require('../core/createError');
var btoa = (typeof window !== 'undefined' && window.btoa && window.btoa.bind(window)) || require('./../helpers/btoa');

module.exports = function xhrAdapter(config) {
  return new Promise(function dispatchXhrRequest(resolve, reject) {
    var requestData = config.data;
    var requestHeaders = config.headers;

    if (utils.isFormData(requestData)) {
      delete requestHeaders['Content-Type']; // Let the browser set it
    }

    var request = new XMLHttpRequest();
    var loadEvent = 'onreadystatechange';
    var xDomain = false;

    // For IE 8/9 CORS support
    // Only supports POST and GET calls and doesn't returns the response headers.
    // DON'T do this for testing b/c XMLHttpRequest is mocked, not XDomainRequest.
    if (process.env.NODE_ENV !== 'test' &&
        typeof window !== 'undefined' &&
        window.XDomainRequest && !('withCredentials' in request) &&
        !isURLSameOrigin(config.url)) {
      request = new window.XDomainRequest();
      loadEvent = 'onload';
      xDomain = true;
      request.onprogress = function handleProgress() {};
      request.ontimeout = function handleTimeout() {};
    }

    // HTTP basic authentication
    if (config.auth) {
      var username = config.auth.username || '';
      var password = config.auth.password || '';
      requestHeaders.Authorization = 'Basic ' + btoa(username + ':' + password);
    }

    request.open(config.method.toUpperCase(), buildURL(config.url, config.params, config.paramsSerializer), true);

    // Set the request timeout in MS
    request.timeout = config.timeout;

    // Listen for ready state
    request[loadEvent] = function handleLoad() {
      if (!request || (request.readyState !== 4 && !xDomain)) {
        return;
      }

      // The request errored out and we didn't get a response, this will be
      // handled by onerror instead
      // With one exception: request that using file: protocol, most browsers
      // will return status as 0 even though it's a successful request
      if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf('file:') === 0)) {
        return;
      }

      // Prepare the response
      var responseHeaders = 'getAllResponseHeaders' in request ? parseHeaders(request.getAllResponseHeaders()) : null;
      var responseData = !config.responseType || config.responseType === 'text' ? request.responseText : request.response;
      var response = {
        data: responseData,
        // IE sends 1223 instead of 204 (https://github.com/mzabriskie/axios/issues/201)
        status: request.status === 1223 ? 204 : request.status,
        statusText: request.status === 1223 ? 'No Content' : request.statusText,
        headers: responseHeaders,
        config: config,
        request: request
      };

      settle(resolve, reject, response);

      // Clean up request
      request = null;
    };

    // Handle low level network errors
    request.onerror = function handleError() {
      // Real errors are hidden from us by the browser
      // onerror should only fire if it's a network error
      reject(createError('Network Error', config, null, request));

      // Clean up request
      request = null;
    };

    // Handle timeout
    request.ontimeout = function handleTimeout() {
      reject(createError('timeout of ' + config.timeout + 'ms exceeded', config, 'ECONNABORTED',
        request));

      // Clean up request
      request = null;
    };

    // Add xsrf header
    // This is only done if running in a standard browser environment.
    // Specifically not if we're in a web worker, or react-native.
    if (utils.isStandardBrowserEnv()) {
      var cookies = require('./../helpers/cookies');

      // Add xsrf header
      var xsrfValue = (config.withCredentials || isURLSameOrigin(config.url)) && config.xsrfCookieName ?
          cookies.read(config.xsrfCookieName) :
          undefined;

      if (xsrfValue) {
        requestHeaders[config.xsrfHeaderName] = xsrfValue;
      }
    }

    // Add headers to the request
    if ('setRequestHeader' in request) {
      utils.forEach(requestHeaders, function setRequestHeader(val, key) {
        if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') {
          // Remove Content-Type if data is undefined
          delete requestHeaders[key];
        } else {
          // Otherwise add header to the request
          request.setRequestHeader(key, val);
        }
      });
    }

    // Add withCredentials to request if needed
    if (config.withCredentials) {
      request.withCredentials = true;
    }

    // Add responseType to request if needed
    if (config.responseType) {
      try {
        request.responseType = config.responseType;
      } catch (e) {
        // Expected DOMException thrown by browsers not compatible XMLHttpRequest Level 2.
        // But, this can be suppressed for 'json' type as it can be parsed by default 'transformResponse' function.
        if (config.responseType !== 'json') {
          throw e;
        }
      }
    }

    // Handle progress if needed
    if (typeof config.onDownloadProgress === 'function') {
      request.addEventListener('progress', config.onDownloadProgress);
    }

    // Not all browsers support upload events
    if (typeof config.onUploadProgress === 'function' && request.upload) {
      request.upload.addEventListener('progress', config.onUploadProgress);
    }

    if (config.cancelToken) {
      // Handle cancellation
      config.cancelToken.promise.then(function onCanceled(cancel) {
        if (!request) {
          return;
        }

        request.abort();
        reject(cancel);
        // Clean up request
        request = null;
      });
    }

    if (requestData === undefined) {
      requestData = null;
    }

    // Send the request
    request.send(requestData);
  });
};

}).call(this,require('_process'))

},{"../core/createError":9,"./../core/settle":12,"./../helpers/btoa":16,"./../helpers/buildURL":17,"./../helpers/cookies":19,"./../helpers/isURLSameOrigin":21,"./../helpers/parseHeaders":23,"./../utils":25,"_process":33}],3:[function(require,module,exports){
'use strict';

var utils = require('./utils');
var bind = require('./helpers/bind');
var Axios = require('./core/Axios');
var defaults = require('./defaults');

/**
 * Create an instance of Axios
 *
 * @param {Object} defaultConfig The default config for the instance
 * @return {Axios} A new instance of Axios
 */
function createInstance(defaultConfig) {
  var context = new Axios(defaultConfig);
  var instance = bind(Axios.prototype.request, context);

  // Copy axios.prototype to instance
  utils.extend(instance, Axios.prototype, context);

  // Copy context to instance
  utils.extend(instance, context);

  return instance;
}

// Create the default instance to be exported
var axios = createInstance(defaults);

// Expose Axios class to allow class inheritance
axios.Axios = Axios;

// Factory for creating new instances
axios.create = function create(instanceConfig) {
  return createInstance(utils.merge(defaults, instanceConfig));
};

// Expose Cancel & CancelToken
axios.Cancel = require('./cancel/Cancel');
axios.CancelToken = require('./cancel/CancelToken');
axios.isCancel = require('./cancel/isCancel');

// Expose all/spread
axios.all = function all(promises) {
  return Promise.all(promises);
};
axios.spread = require('./helpers/spread');

module.exports = axios;

// Allow use of default import syntax in TypeScript
module.exports.default = axios;

},{"./cancel/Cancel":4,"./cancel/CancelToken":5,"./cancel/isCancel":6,"./core/Axios":7,"./defaults":14,"./helpers/bind":15,"./helpers/spread":24,"./utils":25}],4:[function(require,module,exports){
'use strict';

/**
 * A `Cancel` is an object that is thrown when an operation is canceled.
 *
 * @class
 * @param {string=} message The message.
 */
function Cancel(message) {
  this.message = message;
}

Cancel.prototype.toString = function toString() {
  return 'Cancel' + (this.message ? ': ' + this.message : '');
};

Cancel.prototype.__CANCEL__ = true;

module.exports = Cancel;

},{}],5:[function(require,module,exports){
'use strict';

var Cancel = require('./Cancel');

/**
 * A `CancelToken` is an object that can be used to request cancellation of an operation.
 *
 * @class
 * @param {Function} executor The executor function.
 */
function CancelToken(executor) {
  if (typeof executor !== 'function') {
    throw new TypeError('executor must be a function.');
  }

  var resolvePromise;
  this.promise = new Promise(function promiseExecutor(resolve) {
    resolvePromise = resolve;
  });

  var token = this;
  executor(function cancel(message) {
    if (token.reason) {
      // Cancellation has already been requested
      return;
    }

    token.reason = new Cancel(message);
    resolvePromise(token.reason);
  });
}

/**
 * Throws a `Cancel` if cancellation has been requested.
 */
CancelToken.prototype.throwIfRequested = function throwIfRequested() {
  if (this.reason) {
    throw this.reason;
  }
};

/**
 * Returns an object that contains a new `CancelToken` and a function that, when called,
 * cancels the `CancelToken`.
 */
CancelToken.source = function source() {
  var cancel;
  var token = new CancelToken(function executor(c) {
    cancel = c;
  });
  return {
    token: token,
    cancel: cancel
  };
};

module.exports = CancelToken;

},{"./Cancel":4}],6:[function(require,module,exports){
'use strict';

module.exports = function isCancel(value) {
  return !!(value && value.__CANCEL__);
};

},{}],7:[function(require,module,exports){
'use strict';

var defaults = require('./../defaults');
var utils = require('./../utils');
var InterceptorManager = require('./InterceptorManager');
var dispatchRequest = require('./dispatchRequest');
var isAbsoluteURL = require('./../helpers/isAbsoluteURL');
var combineURLs = require('./../helpers/combineURLs');

/**
 * Create a new instance of Axios
 *
 * @param {Object} instanceConfig The default config for the instance
 */
function Axios(instanceConfig) {
  this.defaults = instanceConfig;
  this.interceptors = {
    request: new InterceptorManager(),
    response: new InterceptorManager()
  };
}

/**
 * Dispatch a request
 *
 * @param {Object} config The config specific for this request (merged with this.defaults)
 */
Axios.prototype.request = function request(config) {
  /*eslint no-param-reassign:0*/
  // Allow for axios('example/url'[, config]) a la fetch API
  if (typeof config === 'string') {
    config = utils.merge({
      url: arguments[0]
    }, arguments[1]);
  }

  config = utils.merge(defaults, this.defaults, { method: 'get' }, config);
  config.method = config.method.toLowerCase();

  // Support baseURL config
  if (config.baseURL && !isAbsoluteURL(config.url)) {
    config.url = combineURLs(config.baseURL, config.url);
  }

  // Hook up interceptors middleware
  var chain = [dispatchRequest, undefined];
  var promise = Promise.resolve(config);

  this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
    chain.unshift(interceptor.fulfilled, interceptor.rejected);
  });

  this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
    chain.push(interceptor.fulfilled, interceptor.rejected);
  });

  while (chain.length) {
    promise = promise.then(chain.shift(), chain.shift());
  }

  return promise;
};

// Provide aliases for supported request methods
utils.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function(url, config) {
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url
    }));
  };
});

utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function(url, data, config) {
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url,
      data: data
    }));
  };
});

module.exports = Axios;

},{"./../defaults":14,"./../helpers/combineURLs":18,"./../helpers/isAbsoluteURL":20,"./../utils":25,"./InterceptorManager":8,"./dispatchRequest":10}],8:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

function InterceptorManager() {
  this.handlers = [];
}

/**
 * Add a new interceptor to the stack
 *
 * @param {Function} fulfilled The function to handle `then` for a `Promise`
 * @param {Function} rejected The function to handle `reject` for a `Promise`
 *
 * @return {Number} An ID used to remove interceptor later
 */
InterceptorManager.prototype.use = function use(fulfilled, rejected) {
  this.handlers.push({
    fulfilled: fulfilled,
    rejected: rejected
  });
  return this.handlers.length - 1;
};

/**
 * Remove an interceptor from the stack
 *
 * @param {Number} id The ID that was returned by `use`
 */
InterceptorManager.prototype.eject = function eject(id) {
  if (this.handlers[id]) {
    this.handlers[id] = null;
  }
};

/**
 * Iterate over all the registered interceptors
 *
 * This method is particularly useful for skipping over any
 * interceptors that may have become `null` calling `eject`.
 *
 * @param {Function} fn The function to call for each interceptor
 */
InterceptorManager.prototype.forEach = function forEach(fn) {
  utils.forEach(this.handlers, function forEachHandler(h) {
    if (h !== null) {
      fn(h);
    }
  });
};

module.exports = InterceptorManager;

},{"./../utils":25}],9:[function(require,module,exports){
'use strict';

var enhanceError = require('./enhanceError');

/**
 * Create an Error with the specified message, config, error code, request and response.
 *
 * @param {string} message The error message.
 * @param {Object} config The config.
 * @param {string} [code] The error code (for example, 'ECONNABORTED').
 * @param {Object} [request] The request.
 * @param {Object} [response] The response.
 * @returns {Error} The created error.
 */
module.exports = function createError(message, config, code, request, response) {
  var error = new Error(message);
  return enhanceError(error, config, code, request, response);
};

},{"./enhanceError":11}],10:[function(require,module,exports){
'use strict';

var utils = require('./../utils');
var transformData = require('./transformData');
var isCancel = require('../cancel/isCancel');
var defaults = require('../defaults');

/**
 * Throws a `Cancel` if cancellation has been requested.
 */
function throwIfCancellationRequested(config) {
  if (config.cancelToken) {
    config.cancelToken.throwIfRequested();
  }
}

/**
 * Dispatch a request to the server using the configured adapter.
 *
 * @param {object} config The config that is to be used for the request
 * @returns {Promise} The Promise to be fulfilled
 */
module.exports = function dispatchRequest(config) {
  throwIfCancellationRequested(config);

  // Ensure headers exist
  config.headers = config.headers || {};

  // Transform request data
  config.data = transformData(
    config.data,
    config.headers,
    config.transformRequest
  );

  // Flatten headers
  config.headers = utils.merge(
    config.headers.common || {},
    config.headers[config.method] || {},
    config.headers || {}
  );

  utils.forEach(
    ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
    function cleanHeaderConfig(method) {
      delete config.headers[method];
    }
  );

  var adapter = config.adapter || defaults.adapter;

  return adapter(config).then(function onAdapterResolution(response) {
    throwIfCancellationRequested(config);

    // Transform response data
    response.data = transformData(
      response.data,
      response.headers,
      config.transformResponse
    );

    return response;
  }, function onAdapterRejection(reason) {
    if (!isCancel(reason)) {
      throwIfCancellationRequested(config);

      // Transform response data
      if (reason && reason.response) {
        reason.response.data = transformData(
          reason.response.data,
          reason.response.headers,
          config.transformResponse
        );
      }
    }

    return Promise.reject(reason);
  });
};

},{"../cancel/isCancel":6,"../defaults":14,"./../utils":25,"./transformData":13}],11:[function(require,module,exports){
'use strict';

/**
 * Update an Error with the specified config, error code, and response.
 *
 * @param {Error} error The error to update.
 * @param {Object} config The config.
 * @param {string} [code] The error code (for example, 'ECONNABORTED').
 * @param {Object} [request] The request.
 * @param {Object} [response] The response.
 * @returns {Error} The error.
 */
module.exports = function enhanceError(error, config, code, request, response) {
  error.config = config;
  if (code) {
    error.code = code;
  }
  error.request = request;
  error.response = response;
  return error;
};

},{}],12:[function(require,module,exports){
'use strict';

var createError = require('./createError');

/**
 * Resolve or reject a Promise based on response status.
 *
 * @param {Function} resolve A function that resolves the promise.
 * @param {Function} reject A function that rejects the promise.
 * @param {object} response The response.
 */
module.exports = function settle(resolve, reject, response) {
  var validateStatus = response.config.validateStatus;
  // Note: status is not exposed by XDomainRequest
  if (!response.status || !validateStatus || validateStatus(response.status)) {
    resolve(response);
  } else {
    reject(createError(
      'Request failed with status code ' + response.status,
      response.config,
      null,
      response.request,
      response
    ));
  }
};

},{"./createError":9}],13:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

/**
 * Transform the data for a request or a response
 *
 * @param {Object|String} data The data to be transformed
 * @param {Array} headers The headers for the request or response
 * @param {Array|Function} fns A single function or Array of functions
 * @returns {*} The resulting transformed data
 */
module.exports = function transformData(data, headers, fns) {
  /*eslint no-param-reassign:0*/
  utils.forEach(fns, function transform(fn) {
    data = fn(data, headers);
  });

  return data;
};

},{"./../utils":25}],14:[function(require,module,exports){
(function (process){
'use strict';

var utils = require('./utils');
var normalizeHeaderName = require('./helpers/normalizeHeaderName');

var DEFAULT_CONTENT_TYPE = {
  'Content-Type': 'application/x-www-form-urlencoded'
};

function setContentTypeIfUnset(headers, value) {
  if (!utils.isUndefined(headers) && utils.isUndefined(headers['Content-Type'])) {
    headers['Content-Type'] = value;
  }
}

function getDefaultAdapter() {
  var adapter;
  if (typeof XMLHttpRequest !== 'undefined') {
    // For browsers use XHR adapter
    adapter = require('./adapters/xhr');
  } else if (typeof process !== 'undefined') {
    // For node use HTTP adapter
    adapter = require('./adapters/http');
  }
  return adapter;
}

var defaults = {
  adapter: getDefaultAdapter(),

  transformRequest: [function transformRequest(data, headers) {
    normalizeHeaderName(headers, 'Content-Type');
    if (utils.isFormData(data) ||
      utils.isArrayBuffer(data) ||
      utils.isBuffer(data) ||
      utils.isStream(data) ||
      utils.isFile(data) ||
      utils.isBlob(data)
    ) {
      return data;
    }
    if (utils.isArrayBufferView(data)) {
      return data.buffer;
    }
    if (utils.isURLSearchParams(data)) {
      setContentTypeIfUnset(headers, 'application/x-www-form-urlencoded;charset=utf-8');
      return data.toString();
    }
    if (utils.isObject(data)) {
      setContentTypeIfUnset(headers, 'application/json;charset=utf-8');
      return JSON.stringify(data);
    }
    return data;
  }],

  transformResponse: [function transformResponse(data) {
    /*eslint no-param-reassign:0*/
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) { /* Ignore */ }
    }
    return data;
  }],

  timeout: 0,

  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',

  maxContentLength: -1,

  validateStatus: function validateStatus(status) {
    return status >= 200 && status < 300;
  }
};

defaults.headers = {
  common: {
    'Accept': 'application/json, text/plain, */*'
  }
};

utils.forEach(['delete', 'get', 'head'], function forEachMethodNoData(method) {
  defaults.headers[method] = {};
});

utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  defaults.headers[method] = utils.merge(DEFAULT_CONTENT_TYPE);
});

module.exports = defaults;

}).call(this,require('_process'))

},{"./adapters/http":2,"./adapters/xhr":2,"./helpers/normalizeHeaderName":22,"./utils":25,"_process":33}],15:[function(require,module,exports){
'use strict';

module.exports = function bind(fn, thisArg) {
  return function wrap() {
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }
    return fn.apply(thisArg, args);
  };
};

},{}],16:[function(require,module,exports){
'use strict';

// btoa polyfill for IE<10 courtesy https://github.com/davidchambers/Base64.js

var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function E() {
  this.message = 'String contains an invalid character';
}
E.prototype = new Error;
E.prototype.code = 5;
E.prototype.name = 'InvalidCharacterError';

function btoa(input) {
  var str = String(input);
  var output = '';
  for (
    // initialize result and counter
    var block, charCode, idx = 0, map = chars;
    // if the next str index does not exist:
    //   change the mapping table to "="
    //   check if d has no fractional digits
    str.charAt(idx | 0) || (map = '=', idx % 1);
    // "8 - idx % 1 * 8" generates the sequence 2, 4, 6, 8
    output += map.charAt(63 & block >> 8 - idx % 1 * 8)
  ) {
    charCode = str.charCodeAt(idx += 3 / 4);
    if (charCode > 0xFF) {
      throw new E();
    }
    block = block << 8 | charCode;
  }
  return output;
}

module.exports = btoa;

},{}],17:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

function encode(val) {
  return encodeURIComponent(val).
    replace(/%40/gi, '@').
    replace(/%3A/gi, ':').
    replace(/%24/g, '$').
    replace(/%2C/gi, ',').
    replace(/%20/g, '+').
    replace(/%5B/gi, '[').
    replace(/%5D/gi, ']');
}

/**
 * Build a URL by appending params to the end
 *
 * @param {string} url The base of the url (e.g., http://www.google.com)
 * @param {object} [params] The params to be appended
 * @returns {string} The formatted url
 */
module.exports = function buildURL(url, params, paramsSerializer) {
  /*eslint no-param-reassign:0*/
  if (!params) {
    return url;
  }

  var serializedParams;
  if (paramsSerializer) {
    serializedParams = paramsSerializer(params);
  } else if (utils.isURLSearchParams(params)) {
    serializedParams = params.toString();
  } else {
    var parts = [];

    utils.forEach(params, function serialize(val, key) {
      if (val === null || typeof val === 'undefined') {
        return;
      }

      if (utils.isArray(val)) {
        key = key + '[]';
      }

      if (!utils.isArray(val)) {
        val = [val];
      }

      utils.forEach(val, function parseValue(v) {
        if (utils.isDate(v)) {
          v = v.toISOString();
        } else if (utils.isObject(v)) {
          v = JSON.stringify(v);
        }
        parts.push(encode(key) + '=' + encode(v));
      });
    });

    serializedParams = parts.join('&');
  }

  if (serializedParams) {
    url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
  }

  return url;
};

},{"./../utils":25}],18:[function(require,module,exports){
'use strict';

/**
 * Creates a new URL by combining the specified URLs
 *
 * @param {string} baseURL The base URL
 * @param {string} relativeURL The relative URL
 * @returns {string} The combined URL
 */
module.exports = function combineURLs(baseURL, relativeURL) {
  return relativeURL
    ? baseURL.replace(/\/+$/, '') + '/' + relativeURL.replace(/^\/+/, '')
    : baseURL;
};

},{}],19:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

module.exports = (
  utils.isStandardBrowserEnv() ?

  // Standard browser envs support document.cookie
  (function standardBrowserEnv() {
    return {
      write: function write(name, value, expires, path, domain, secure) {
        var cookie = [];
        cookie.push(name + '=' + encodeURIComponent(value));

        if (utils.isNumber(expires)) {
          cookie.push('expires=' + new Date(expires).toGMTString());
        }

        if (utils.isString(path)) {
          cookie.push('path=' + path);
        }

        if (utils.isString(domain)) {
          cookie.push('domain=' + domain);
        }

        if (secure === true) {
          cookie.push('secure');
        }

        document.cookie = cookie.join('; ');
      },

      read: function read(name) {
        var match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
        return (match ? decodeURIComponent(match[3]) : null);
      },

      remove: function remove(name) {
        this.write(name, '', Date.now() - 86400000);
      }
    };
  })() :

  // Non standard browser env (web workers, react-native) lack needed support.
  (function nonStandardBrowserEnv() {
    return {
      write: function write() {},
      read: function read() { return null; },
      remove: function remove() {}
    };
  })()
);

},{"./../utils":25}],20:[function(require,module,exports){
'use strict';

/**
 * Determines whether the specified URL is absolute
 *
 * @param {string} url The URL to test
 * @returns {boolean} True if the specified URL is absolute, otherwise false
 */
module.exports = function isAbsoluteURL(url) {
  // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
  // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
  // by any combination of letters, digits, plus, period, or hyphen.
  return /^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(url);
};

},{}],21:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

module.exports = (
  utils.isStandardBrowserEnv() ?

  // Standard browser envs have full support of the APIs needed to test
  // whether the request URL is of the same origin as current location.
  (function standardBrowserEnv() {
    var msie = /(msie|trident)/i.test(navigator.userAgent);
    var urlParsingNode = document.createElement('a');
    var originURL;

    /**
    * Parse a URL to discover it's components
    *
    * @param {String} url The URL to be parsed
    * @returns {Object}
    */
    function resolveURL(url) {
      var href = url;

      if (msie) {
        // IE needs attribute set twice to normalize properties
        urlParsingNode.setAttribute('href', href);
        href = urlParsingNode.href;
      }

      urlParsingNode.setAttribute('href', href);

      // urlParsingNode provides the UrlUtils interface - http://url.spec.whatwg.org/#urlutils
      return {
        href: urlParsingNode.href,
        protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, '') : '',
        host: urlParsingNode.host,
        search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, '') : '',
        hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, '') : '',
        hostname: urlParsingNode.hostname,
        port: urlParsingNode.port,
        pathname: (urlParsingNode.pathname.charAt(0) === '/') ?
                  urlParsingNode.pathname :
                  '/' + urlParsingNode.pathname
      };
    }

    originURL = resolveURL(window.location.href);

    /**
    * Determine if a URL shares the same origin as the current location
    *
    * @param {String} requestURL The URL to test
    * @returns {boolean} True if URL shares the same origin, otherwise false
    */
    return function isURLSameOrigin(requestURL) {
      var parsed = (utils.isString(requestURL)) ? resolveURL(requestURL) : requestURL;
      return (parsed.protocol === originURL.protocol &&
            parsed.host === originURL.host);
    };
  })() :

  // Non standard browser envs (web workers, react-native) lack needed support.
  (function nonStandardBrowserEnv() {
    return function isURLSameOrigin() {
      return true;
    };
  })()
);

},{"./../utils":25}],22:[function(require,module,exports){
'use strict';

var utils = require('../utils');

module.exports = function normalizeHeaderName(headers, normalizedName) {
  utils.forEach(headers, function processHeader(value, name) {
    if (name !== normalizedName && name.toUpperCase() === normalizedName.toUpperCase()) {
      headers[normalizedName] = value;
      delete headers[name];
    }
  });
};

},{"../utils":25}],23:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

/**
 * Parse headers into an object
 *
 * ```
 * Date: Wed, 27 Aug 2014 08:58:49 GMT
 * Content-Type: application/json
 * Connection: keep-alive
 * Transfer-Encoding: chunked
 * ```
 *
 * @param {String} headers Headers needing to be parsed
 * @returns {Object} Headers parsed into an object
 */
module.exports = function parseHeaders(headers) {
  var parsed = {};
  var key;
  var val;
  var i;

  if (!headers) { return parsed; }

  utils.forEach(headers.split('\n'), function parser(line) {
    i = line.indexOf(':');
    key = utils.trim(line.substr(0, i)).toLowerCase();
    val = utils.trim(line.substr(i + 1));

    if (key) {
      parsed[key] = parsed[key] ? parsed[key] + ', ' + val : val;
    }
  });

  return parsed;
};

},{"./../utils":25}],24:[function(require,module,exports){
'use strict';

/**
 * Syntactic sugar for invoking a function and expanding an array for arguments.
 *
 * Common use case would be to use `Function.prototype.apply`.
 *
 *  ```js
 *  function f(x, y, z) {}
 *  var args = [1, 2, 3];
 *  f.apply(null, args);
 *  ```
 *
 * With `spread` this example can be re-written.
 *
 *  ```js
 *  spread(function(x, y, z) {})([1, 2, 3]);
 *  ```
 *
 * @param {Function} callback
 * @returns {Function}
 */
module.exports = function spread(callback) {
  return function wrap(arr) {
    return callback.apply(null, arr);
  };
};

},{}],25:[function(require,module,exports){
'use strict';

var bind = require('./helpers/bind');
var isBuffer = require('is-buffer');

/*global toString:true*/

// utils is a library of generic helper functions non-specific to axios

var toString = Object.prototype.toString;

/**
 * Determine if a value is an Array
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an Array, otherwise false
 */
function isArray(val) {
  return toString.call(val) === '[object Array]';
}

/**
 * Determine if a value is an ArrayBuffer
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an ArrayBuffer, otherwise false
 */
function isArrayBuffer(val) {
  return toString.call(val) === '[object ArrayBuffer]';
}

/**
 * Determine if a value is a FormData
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an FormData, otherwise false
 */
function isFormData(val) {
  return (typeof FormData !== 'undefined') && (val instanceof FormData);
}

/**
 * Determine if a value is a view on an ArrayBuffer
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a view on an ArrayBuffer, otherwise false
 */
function isArrayBufferView(val) {
  var result;
  if ((typeof ArrayBuffer !== 'undefined') && (ArrayBuffer.isView)) {
    result = ArrayBuffer.isView(val);
  } else {
    result = (val) && (val.buffer) && (val.buffer instanceof ArrayBuffer);
  }
  return result;
}

/**
 * Determine if a value is a String
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a String, otherwise false
 */
function isString(val) {
  return typeof val === 'string';
}

/**
 * Determine if a value is a Number
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Number, otherwise false
 */
function isNumber(val) {
  return typeof val === 'number';
}

/**
 * Determine if a value is undefined
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if the value is undefined, otherwise false
 */
function isUndefined(val) {
  return typeof val === 'undefined';
}

/**
 * Determine if a value is an Object
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an Object, otherwise false
 */
function isObject(val) {
  return val !== null && typeof val === 'object';
}

/**
 * Determine if a value is a Date
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Date, otherwise false
 */
function isDate(val) {
  return toString.call(val) === '[object Date]';
}

/**
 * Determine if a value is a File
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a File, otherwise false
 */
function isFile(val) {
  return toString.call(val) === '[object File]';
}

/**
 * Determine if a value is a Blob
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Blob, otherwise false
 */
function isBlob(val) {
  return toString.call(val) === '[object Blob]';
}

/**
 * Determine if a value is a Function
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Function, otherwise false
 */
function isFunction(val) {
  return toString.call(val) === '[object Function]';
}

/**
 * Determine if a value is a Stream
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Stream, otherwise false
 */
function isStream(val) {
  return isObject(val) && isFunction(val.pipe);
}

/**
 * Determine if a value is a URLSearchParams object
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a URLSearchParams object, otherwise false
 */
function isURLSearchParams(val) {
  return typeof URLSearchParams !== 'undefined' && val instanceof URLSearchParams;
}

/**
 * Trim excess whitespace off the beginning and end of a string
 *
 * @param {String} str The String to trim
 * @returns {String} The String freed of excess whitespace
 */
function trim(str) {
  return str.replace(/^\s*/, '').replace(/\s*$/, '');
}

/**
 * Determine if we're running in a standard browser environment
 *
 * This allows axios to run in a web worker, and react-native.
 * Both environments support XMLHttpRequest, but not fully standard globals.
 *
 * web workers:
 *  typeof window -> undefined
 *  typeof document -> undefined
 *
 * react-native:
 *  navigator.product -> 'ReactNative'
 */
function isStandardBrowserEnv() {
  if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
    return false;
  }
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined'
  );
}

/**
 * Iterate over an Array or an Object invoking a function for each item.
 *
 * If `obj` is an Array callback will be called passing
 * the value, index, and complete array for each item.
 *
 * If 'obj' is an Object callback will be called passing
 * the value, key, and complete object for each property.
 *
 * @param {Object|Array} obj The object to iterate
 * @param {Function} fn The callback to invoke for each item
 */
function forEach(obj, fn) {
  // Don't bother if no value provided
  if (obj === null || typeof obj === 'undefined') {
    return;
  }

  // Force an array if not already something iterable
  if (typeof obj !== 'object' && !isArray(obj)) {
    /*eslint no-param-reassign:0*/
    obj = [obj];
  }

  if (isArray(obj)) {
    // Iterate over array values
    for (var i = 0, l = obj.length; i < l; i++) {
      fn.call(null, obj[i], i, obj);
    }
  } else {
    // Iterate over object keys
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        fn.call(null, obj[key], key, obj);
      }
    }
  }
}

/**
 * Accepts varargs expecting each argument to be an object, then
 * immutably merges the properties of each object and returns result.
 *
 * When multiple objects contain the same key the later object in
 * the arguments list will take precedence.
 *
 * Example:
 *
 * ```js
 * var result = merge({foo: 123}, {foo: 456});
 * console.log(result.foo); // outputs 456
 * ```
 *
 * @param {Object} obj1 Object to merge
 * @returns {Object} Result of all merge properties
 */
function merge(/* obj1, obj2, obj3, ... */) {
  var result = {};
  function assignValue(val, key) {
    if (typeof result[key] === 'object' && typeof val === 'object') {
      result[key] = merge(result[key], val);
    } else {
      result[key] = val;
    }
  }

  for (var i = 0, l = arguments.length; i < l; i++) {
    forEach(arguments[i], assignValue);
  }
  return result;
}

/**
 * Extends object a by mutably adding to it the properties of object b.
 *
 * @param {Object} a The object to be extended
 * @param {Object} b The object to copy properties from
 * @param {Object} thisArg The object to bind function to
 * @return {Object} The resulting value of object a
 */
function extend(a, b, thisArg) {
  forEach(b, function assignValue(val, key) {
    if (thisArg && typeof val === 'function') {
      a[key] = bind(val, thisArg);
    } else {
      a[key] = val;
    }
  });
  return a;
}

module.exports = {
  isArray: isArray,
  isArrayBuffer: isArrayBuffer,
  isBuffer: isBuffer,
  isFormData: isFormData,
  isArrayBufferView: isArrayBufferView,
  isString: isString,
  isNumber: isNumber,
  isObject: isObject,
  isUndefined: isUndefined,
  isDate: isDate,
  isFile: isFile,
  isBlob: isBlob,
  isFunction: isFunction,
  isStream: isStream,
  isURLSearchParams: isURLSearchParams,
  isStandardBrowserEnv: isStandardBrowserEnv,
  forEach: forEach,
  merge: merge,
  extend: extend,
  trim: trim
};

},{"./helpers/bind":15,"is-buffer":32}],26:[function(require,module,exports){
(function (process){
/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 */

'use strict';

var _assign = require('object-assign');

var emptyObject = require('fbjs/lib/emptyObject');
var _invariant = require('fbjs/lib/invariant');

if (process.env.NODE_ENV !== 'production') {
  var warning = require('fbjs/lib/warning');
}

var MIXINS_KEY = 'mixins';

// Helper function to allow the creation of anonymous functions which do not
// have .name set to the name of the variable being assigned to.
function identity(fn) {
  return fn;
}

var ReactPropTypeLocationNames;
if (process.env.NODE_ENV !== 'production') {
  ReactPropTypeLocationNames = {
    prop: 'prop',
    context: 'context',
    childContext: 'child context'
  };
} else {
  ReactPropTypeLocationNames = {};
}

function factory(ReactComponent, isValidElement, ReactNoopUpdateQueue) {
  /**
   * Policies that describe methods in `ReactClassInterface`.
   */

  var injectedMixins = [];

  /**
   * Composite components are higher-level components that compose other composite
   * or host components.
   *
   * To create a new type of `ReactClass`, pass a specification of
   * your new class to `React.createClass`. The only requirement of your class
   * specification is that you implement a `render` method.
   *
   *   var MyComponent = React.createClass({
   *     render: function() {
   *       return <div>Hello World</div>;
   *     }
   *   });
   *
   * The class specification supports a specific protocol of methods that have
   * special meaning (e.g. `render`). See `ReactClassInterface` for
   * more the comprehensive protocol. Any other properties and methods in the
   * class specification will be available on the prototype.
   *
   * @interface ReactClassInterface
   * @internal
   */
  var ReactClassInterface = {
    /**
     * An array of Mixin objects to include when defining your component.
     *
     * @type {array}
     * @optional
     */
    mixins: 'DEFINE_MANY',

    /**
     * An object containing properties and methods that should be defined on
     * the component's constructor instead of its prototype (static methods).
     *
     * @type {object}
     * @optional
     */
    statics: 'DEFINE_MANY',

    /**
     * Definition of prop types for this component.
     *
     * @type {object}
     * @optional
     */
    propTypes: 'DEFINE_MANY',

    /**
     * Definition of context types for this component.
     *
     * @type {object}
     * @optional
     */
    contextTypes: 'DEFINE_MANY',

    /**
     * Definition of context types this component sets for its children.
     *
     * @type {object}
     * @optional
     */
    childContextTypes: 'DEFINE_MANY',

    // ==== Definition methods ====

    /**
     * Invoked when the component is mounted. Values in the mapping will be set on
     * `this.props` if that prop is not specified (i.e. using an `in` check).
     *
     * This method is invoked before `getInitialState` and therefore cannot rely
     * on `this.state` or use `this.setState`.
     *
     * @return {object}
     * @optional
     */
    getDefaultProps: 'DEFINE_MANY_MERGED',

    /**
     * Invoked once before the component is mounted. The return value will be used
     * as the initial value of `this.state`.
     *
     *   getInitialState: function() {
     *     return {
     *       isOn: false,
     *       fooBaz: new BazFoo()
     *     }
     *   }
     *
     * @return {object}
     * @optional
     */
    getInitialState: 'DEFINE_MANY_MERGED',

    /**
     * @return {object}
     * @optional
     */
    getChildContext: 'DEFINE_MANY_MERGED',

    /**
     * Uses props from `this.props` and state from `this.state` to render the
     * structure of the component.
     *
     * No guarantees are made about when or how often this method is invoked, so
     * it must not have side effects.
     *
     *   render: function() {
     *     var name = this.props.name;
     *     return <div>Hello, {name}!</div>;
     *   }
     *
     * @return {ReactComponent}
     * @required
     */
    render: 'DEFINE_ONCE',

    // ==== Delegate methods ====

    /**
     * Invoked when the component is initially created and about to be mounted.
     * This may have side effects, but any external subscriptions or data created
     * by this method must be cleaned up in `componentWillUnmount`.
     *
     * @optional
     */
    componentWillMount: 'DEFINE_MANY',

    /**
     * Invoked when the component has been mounted and has a DOM representation.
     * However, there is no guarantee that the DOM node is in the document.
     *
     * Use this as an opportunity to operate on the DOM when the component has
     * been mounted (initialized and rendered) for the first time.
     *
     * @param {DOMElement} rootNode DOM element representing the component.
     * @optional
     */
    componentDidMount: 'DEFINE_MANY',

    /**
     * Invoked before the component receives new props.
     *
     * Use this as an opportunity to react to a prop transition by updating the
     * state using `this.setState`. Current props are accessed via `this.props`.
     *
     *   componentWillReceiveProps: function(nextProps, nextContext) {
     *     this.setState({
     *       likesIncreasing: nextProps.likeCount > this.props.likeCount
     *     });
     *   }
     *
     * NOTE: There is no equivalent `componentWillReceiveState`. An incoming prop
     * transition may cause a state change, but the opposite is not true. If you
     * need it, you are probably looking for `componentWillUpdate`.
     *
     * @param {object} nextProps
     * @optional
     */
    componentWillReceiveProps: 'DEFINE_MANY',

    /**
     * Invoked while deciding if the component should be updated as a result of
     * receiving new props, state and/or context.
     *
     * Use this as an opportunity to `return false` when you're certain that the
     * transition to the new props/state/context will not require a component
     * update.
     *
     *   shouldComponentUpdate: function(nextProps, nextState, nextContext) {
     *     return !equal(nextProps, this.props) ||
     *       !equal(nextState, this.state) ||
     *       !equal(nextContext, this.context);
     *   }
     *
     * @param {object} nextProps
     * @param {?object} nextState
     * @param {?object} nextContext
     * @return {boolean} True if the component should update.
     * @optional
     */
    shouldComponentUpdate: 'DEFINE_ONCE',

    /**
     * Invoked when the component is about to update due to a transition from
     * `this.props`, `this.state` and `this.context` to `nextProps`, `nextState`
     * and `nextContext`.
     *
     * Use this as an opportunity to perform preparation before an update occurs.
     *
     * NOTE: You **cannot** use `this.setState()` in this method.
     *
     * @param {object} nextProps
     * @param {?object} nextState
     * @param {?object} nextContext
     * @param {ReactReconcileTransaction} transaction
     * @optional
     */
    componentWillUpdate: 'DEFINE_MANY',

    /**
     * Invoked when the component's DOM representation has been updated.
     *
     * Use this as an opportunity to operate on the DOM when the component has
     * been updated.
     *
     * @param {object} prevProps
     * @param {?object} prevState
     * @param {?object} prevContext
     * @param {DOMElement} rootNode DOM element representing the component.
     * @optional
     */
    componentDidUpdate: 'DEFINE_MANY',

    /**
     * Invoked when the component is about to be removed from its parent and have
     * its DOM representation destroyed.
     *
     * Use this as an opportunity to deallocate any external resources.
     *
     * NOTE: There is no `componentDidUnmount` since your component will have been
     * destroyed by that point.
     *
     * @optional
     */
    componentWillUnmount: 'DEFINE_MANY',

    // ==== Advanced methods ====

    /**
     * Updates the component's currently mounted DOM representation.
     *
     * By default, this implements React's rendering and reconciliation algorithm.
     * Sophisticated clients may wish to override this.
     *
     * @param {ReactReconcileTransaction} transaction
     * @internal
     * @overridable
     */
    updateComponent: 'OVERRIDE_BASE'
  };

  /**
   * Mapping from class specification keys to special processing functions.
   *
   * Although these are declared like instance properties in the specification
   * when defining classes using `React.createClass`, they are actually static
   * and are accessible on the constructor instead of the prototype. Despite
   * being static, they must be defined outside of the "statics" key under
   * which all other static methods are defined.
   */
  var RESERVED_SPEC_KEYS = {
    displayName: function(Constructor, displayName) {
      Constructor.displayName = displayName;
    },
    mixins: function(Constructor, mixins) {
      if (mixins) {
        for (var i = 0; i < mixins.length; i++) {
          mixSpecIntoComponent(Constructor, mixins[i]);
        }
      }
    },
    childContextTypes: function(Constructor, childContextTypes) {
      if (process.env.NODE_ENV !== 'production') {
        validateTypeDef(Constructor, childContextTypes, 'childContext');
      }
      Constructor.childContextTypes = _assign(
        {},
        Constructor.childContextTypes,
        childContextTypes
      );
    },
    contextTypes: function(Constructor, contextTypes) {
      if (process.env.NODE_ENV !== 'production') {
        validateTypeDef(Constructor, contextTypes, 'context');
      }
      Constructor.contextTypes = _assign(
        {},
        Constructor.contextTypes,
        contextTypes
      );
    },
    /**
     * Special case getDefaultProps which should move into statics but requires
     * automatic merging.
     */
    getDefaultProps: function(Constructor, getDefaultProps) {
      if (Constructor.getDefaultProps) {
        Constructor.getDefaultProps = createMergedResultFunction(
          Constructor.getDefaultProps,
          getDefaultProps
        );
      } else {
        Constructor.getDefaultProps = getDefaultProps;
      }
    },
    propTypes: function(Constructor, propTypes) {
      if (process.env.NODE_ENV !== 'production') {
        validateTypeDef(Constructor, propTypes, 'prop');
      }
      Constructor.propTypes = _assign({}, Constructor.propTypes, propTypes);
    },
    statics: function(Constructor, statics) {
      mixStaticSpecIntoComponent(Constructor, statics);
    },
    autobind: function() {}
  };

  function validateTypeDef(Constructor, typeDef, location) {
    for (var propName in typeDef) {
      if (typeDef.hasOwnProperty(propName)) {
        // use a warning instead of an _invariant so components
        // don't show up in prod but only in __DEV__
        if (process.env.NODE_ENV !== 'production') {
          warning(
            typeof typeDef[propName] === 'function',
            '%s: %s type `%s` is invalid; it must be a function, usually from ' +
              'React.PropTypes.',
            Constructor.displayName || 'ReactClass',
            ReactPropTypeLocationNames[location],
            propName
          );
        }
      }
    }
  }

  function validateMethodOverride(isAlreadyDefined, name) {
    var specPolicy = ReactClassInterface.hasOwnProperty(name)
      ? ReactClassInterface[name]
      : null;

    // Disallow overriding of base class methods unless explicitly allowed.
    if (ReactClassMixin.hasOwnProperty(name)) {
      _invariant(
        specPolicy === 'OVERRIDE_BASE',
        'ReactClassInterface: You are attempting to override ' +
          '`%s` from your class specification. Ensure that your method names ' +
          'do not overlap with React methods.',
        name
      );
    }

    // Disallow defining methods more than once unless explicitly allowed.
    if (isAlreadyDefined) {
      _invariant(
        specPolicy === 'DEFINE_MANY' || specPolicy === 'DEFINE_MANY_MERGED',
        'ReactClassInterface: You are attempting to define ' +
          '`%s` on your component more than once. This conflict may be due ' +
          'to a mixin.',
        name
      );
    }
  }

  /**
   * Mixin helper which handles policy validation and reserved
   * specification keys when building React classes.
   */
  function mixSpecIntoComponent(Constructor, spec) {
    if (!spec) {
      if (process.env.NODE_ENV !== 'production') {
        var typeofSpec = typeof spec;
        var isMixinValid = typeofSpec === 'object' && spec !== null;

        if (process.env.NODE_ENV !== 'production') {
          warning(
            isMixinValid,
            "%s: You're attempting to include a mixin that is either null " +
              'or not an object. Check the mixins included by the component, ' +
              'as well as any mixins they include themselves. ' +
              'Expected object but got %s.',
            Constructor.displayName || 'ReactClass',
            spec === null ? null : typeofSpec
          );
        }
      }

      return;
    }

    _invariant(
      typeof spec !== 'function',
      "ReactClass: You're attempting to " +
        'use a component class or function as a mixin. Instead, just use a ' +
        'regular object.'
    );
    _invariant(
      !isValidElement(spec),
      "ReactClass: You're attempting to " +
        'use a component as a mixin. Instead, just use a regular object.'
    );

    var proto = Constructor.prototype;
    var autoBindPairs = proto.__reactAutoBindPairs;

    // By handling mixins before any other properties, we ensure the same
    // chaining order is applied to methods with DEFINE_MANY policy, whether
    // mixins are listed before or after these methods in the spec.
    if (spec.hasOwnProperty(MIXINS_KEY)) {
      RESERVED_SPEC_KEYS.mixins(Constructor, spec.mixins);
    }

    for (var name in spec) {
      if (!spec.hasOwnProperty(name)) {
        continue;
      }

      if (name === MIXINS_KEY) {
        // We have already handled mixins in a special case above.
        continue;
      }

      var property = spec[name];
      var isAlreadyDefined = proto.hasOwnProperty(name);
      validateMethodOverride(isAlreadyDefined, name);

      if (RESERVED_SPEC_KEYS.hasOwnProperty(name)) {
        RESERVED_SPEC_KEYS[name](Constructor, property);
      } else {
        // Setup methods on prototype:
        // The following member methods should not be automatically bound:
        // 1. Expected ReactClass methods (in the "interface").
        // 2. Overridden methods (that were mixed in).
        var isReactClassMethod = ReactClassInterface.hasOwnProperty(name);
        var isFunction = typeof property === 'function';
        var shouldAutoBind =
          isFunction &&
          !isReactClassMethod &&
          !isAlreadyDefined &&
          spec.autobind !== false;

        if (shouldAutoBind) {
          autoBindPairs.push(name, property);
          proto[name] = property;
        } else {
          if (isAlreadyDefined) {
            var specPolicy = ReactClassInterface[name];

            // These cases should already be caught by validateMethodOverride.
            _invariant(
              isReactClassMethod &&
                (specPolicy === 'DEFINE_MANY_MERGED' ||
                  specPolicy === 'DEFINE_MANY'),
              'ReactClass: Unexpected spec policy %s for key %s ' +
                'when mixing in component specs.',
              specPolicy,
              name
            );

            // For methods which are defined more than once, call the existing
            // methods before calling the new property, merging if appropriate.
            if (specPolicy === 'DEFINE_MANY_MERGED') {
              proto[name] = createMergedResultFunction(proto[name], property);
            } else if (specPolicy === 'DEFINE_MANY') {
              proto[name] = createChainedFunction(proto[name], property);
            }
          } else {
            proto[name] = property;
            if (process.env.NODE_ENV !== 'production') {
              // Add verbose displayName to the function, which helps when looking
              // at profiling tools.
              if (typeof property === 'function' && spec.displayName) {
                proto[name].displayName = spec.displayName + '_' + name;
              }
            }
          }
        }
      }
    }
  }

  function mixStaticSpecIntoComponent(Constructor, statics) {
    if (!statics) {
      return;
    }
    for (var name in statics) {
      var property = statics[name];
      if (!statics.hasOwnProperty(name)) {
        continue;
      }

      var isReserved = name in RESERVED_SPEC_KEYS;
      _invariant(
        !isReserved,
        'ReactClass: You are attempting to define a reserved ' +
          'property, `%s`, that shouldn\'t be on the "statics" key. Define it ' +
          'as an instance property instead; it will still be accessible on the ' +
          'constructor.',
        name
      );

      var isInherited = name in Constructor;
      _invariant(
        !isInherited,
        'ReactClass: You are attempting to define ' +
          '`%s` on your component more than once. This conflict may be ' +
          'due to a mixin.',
        name
      );
      Constructor[name] = property;
    }
  }

  /**
   * Merge two objects, but throw if both contain the same key.
   *
   * @param {object} one The first object, which is mutated.
   * @param {object} two The second object
   * @return {object} one after it has been mutated to contain everything in two.
   */
  function mergeIntoWithNoDuplicateKeys(one, two) {
    _invariant(
      one && two && typeof one === 'object' && typeof two === 'object',
      'mergeIntoWithNoDuplicateKeys(): Cannot merge non-objects.'
    );

    for (var key in two) {
      if (two.hasOwnProperty(key)) {
        _invariant(
          one[key] === undefined,
          'mergeIntoWithNoDuplicateKeys(): ' +
            'Tried to merge two objects with the same key: `%s`. This conflict ' +
            'may be due to a mixin; in particular, this may be caused by two ' +
            'getInitialState() or getDefaultProps() methods returning objects ' +
            'with clashing keys.',
          key
        );
        one[key] = two[key];
      }
    }
    return one;
  }

  /**
   * Creates a function that invokes two functions and merges their return values.
   *
   * @param {function} one Function to invoke first.
   * @param {function} two Function to invoke second.
   * @return {function} Function that invokes the two argument functions.
   * @private
   */
  function createMergedResultFunction(one, two) {
    return function mergedResult() {
      var a = one.apply(this, arguments);
      var b = two.apply(this, arguments);
      if (a == null) {
        return b;
      } else if (b == null) {
        return a;
      }
      var c = {};
      mergeIntoWithNoDuplicateKeys(c, a);
      mergeIntoWithNoDuplicateKeys(c, b);
      return c;
    };
  }

  /**
   * Creates a function that invokes two functions and ignores their return vales.
   *
   * @param {function} one Function to invoke first.
   * @param {function} two Function to invoke second.
   * @return {function} Function that invokes the two argument functions.
   * @private
   */
  function createChainedFunction(one, two) {
    return function chainedFunction() {
      one.apply(this, arguments);
      two.apply(this, arguments);
    };
  }

  /**
   * Binds a method to the component.
   *
   * @param {object} component Component whose method is going to be bound.
   * @param {function} method Method to be bound.
   * @return {function} The bound method.
   */
  function bindAutoBindMethod(component, method) {
    var boundMethod = method.bind(component);
    if (process.env.NODE_ENV !== 'production') {
      boundMethod.__reactBoundContext = component;
      boundMethod.__reactBoundMethod = method;
      boundMethod.__reactBoundArguments = null;
      var componentName = component.constructor.displayName;
      var _bind = boundMethod.bind;
      boundMethod.bind = function(newThis) {
        for (
          var _len = arguments.length,
            args = Array(_len > 1 ? _len - 1 : 0),
            _key = 1;
          _key < _len;
          _key++
        ) {
          args[_key - 1] = arguments[_key];
        }

        // User is trying to bind() an autobound method; we effectively will
        // ignore the value of "this" that the user is trying to use, so
        // let's warn.
        if (newThis !== component && newThis !== null) {
          if (process.env.NODE_ENV !== 'production') {
            warning(
              false,
              'bind(): React component methods may only be bound to the ' +
                'component instance. See %s',
              componentName
            );
          }
        } else if (!args.length) {
          if (process.env.NODE_ENV !== 'production') {
            warning(
              false,
              'bind(): You are binding a component method to the component. ' +
                'React does this for you automatically in a high-performance ' +
                'way, so you can safely remove this call. See %s',
              componentName
            );
          }
          return boundMethod;
        }
        var reboundMethod = _bind.apply(boundMethod, arguments);
        reboundMethod.__reactBoundContext = component;
        reboundMethod.__reactBoundMethod = method;
        reboundMethod.__reactBoundArguments = args;
        return reboundMethod;
      };
    }
    return boundMethod;
  }

  /**
   * Binds all auto-bound methods in a component.
   *
   * @param {object} component Component whose method is going to be bound.
   */
  function bindAutoBindMethods(component) {
    var pairs = component.__reactAutoBindPairs;
    for (var i = 0; i < pairs.length; i += 2) {
      var autoBindKey = pairs[i];
      var method = pairs[i + 1];
      component[autoBindKey] = bindAutoBindMethod(component, method);
    }
  }

  var IsMountedPreMixin = {
    componentDidMount: function() {
      this.__isMounted = true;
    }
  };

  var IsMountedPostMixin = {
    componentWillUnmount: function() {
      this.__isMounted = false;
    }
  };

  /**
   * Add more to the ReactClass base class. These are all legacy features and
   * therefore not already part of the modern ReactComponent.
   */
  var ReactClassMixin = {
    /**
     * TODO: This will be deprecated because state should always keep a consistent
     * type signature and the only use case for this, is to avoid that.
     */
    replaceState: function(newState, callback) {
      this.updater.enqueueReplaceState(this, newState, callback);
    },

    /**
     * Checks whether or not this composite component is mounted.
     * @return {boolean} True if mounted, false otherwise.
     * @protected
     * @final
     */
    isMounted: function() {
      if (process.env.NODE_ENV !== 'production') {
        warning(
          this.__didWarnIsMounted,
          '%s: isMounted is deprecated. Instead, make sure to clean up ' +
            'subscriptions and pending requests in componentWillUnmount to ' +
            'prevent memory leaks.',
          (this.constructor && this.constructor.displayName) ||
            this.name ||
            'Component'
        );
        this.__didWarnIsMounted = true;
      }
      return !!this.__isMounted;
    }
  };

  var ReactClassComponent = function() {};
  _assign(
    ReactClassComponent.prototype,
    ReactComponent.prototype,
    ReactClassMixin
  );

  /**
   * Creates a composite component class given a class specification.
   * See https://facebook.github.io/react/docs/top-level-api.html#react.createclass
   *
   * @param {object} spec Class specification (which must define `render`).
   * @return {function} Component constructor function.
   * @public
   */
  function createClass(spec) {
    // To keep our warnings more understandable, we'll use a little hack here to
    // ensure that Constructor.name !== 'Constructor'. This makes sure we don't
    // unnecessarily identify a class without displayName as 'Constructor'.
    var Constructor = identity(function(props, context, updater) {
      // This constructor gets overridden by mocks. The argument is used
      // by mocks to assert on what gets mounted.

      if (process.env.NODE_ENV !== 'production') {
        warning(
          this instanceof Constructor,
          'Something is calling a React component directly. Use a factory or ' +
            'JSX instead. See: https://fb.me/react-legacyfactory'
        );
      }

      // Wire up auto-binding
      if (this.__reactAutoBindPairs.length) {
        bindAutoBindMethods(this);
      }

      this.props = props;
      this.context = context;
      this.refs = emptyObject;
      this.updater = updater || ReactNoopUpdateQueue;

      this.state = null;

      // ReactClasses doesn't have constructors. Instead, they use the
      // getInitialState and componentWillMount methods for initialization.

      var initialState = this.getInitialState ? this.getInitialState() : null;
      if (process.env.NODE_ENV !== 'production') {
        // We allow auto-mocks to proceed as if they're returning null.
        if (
          initialState === undefined &&
          this.getInitialState._isMockFunction
        ) {
          // This is probably bad practice. Consider warning here and
          // deprecating this convenience.
          initialState = null;
        }
      }
      _invariant(
        typeof initialState === 'object' && !Array.isArray(initialState),
        '%s.getInitialState(): must return an object or null',
        Constructor.displayName || 'ReactCompositeComponent'
      );

      this.state = initialState;
    });
    Constructor.prototype = new ReactClassComponent();
    Constructor.prototype.constructor = Constructor;
    Constructor.prototype.__reactAutoBindPairs = [];

    injectedMixins.forEach(mixSpecIntoComponent.bind(null, Constructor));

    mixSpecIntoComponent(Constructor, IsMountedPreMixin);
    mixSpecIntoComponent(Constructor, spec);
    mixSpecIntoComponent(Constructor, IsMountedPostMixin);

    // Initialize the defaultProps property after all mixins have been merged.
    if (Constructor.getDefaultProps) {
      Constructor.defaultProps = Constructor.getDefaultProps();
    }

    if (process.env.NODE_ENV !== 'production') {
      // This is a tag to indicate that the use of these method names is ok,
      // since it's used with createClass. If it's not, then it's likely a
      // mistake so we'll warn you to use the static property, property
      // initializer or constructor respectively.
      if (Constructor.getDefaultProps) {
        Constructor.getDefaultProps.isReactClassApproved = {};
      }
      if (Constructor.prototype.getInitialState) {
        Constructor.prototype.getInitialState.isReactClassApproved = {};
      }
    }

    _invariant(
      Constructor.prototype.render,
      'createClass(...): Class specification must implement a `render` method.'
    );

    if (process.env.NODE_ENV !== 'production') {
      warning(
        !Constructor.prototype.componentShouldUpdate,
        '%s has a method called ' +
          'componentShouldUpdate(). Did you mean shouldComponentUpdate()? ' +
          'The name is phrased as a question because the function is ' +
          'expected to return a value.',
        spec.displayName || 'A component'
      );
      warning(
        !Constructor.prototype.componentWillRecieveProps,
        '%s has a method called ' +
          'componentWillRecieveProps(). Did you mean componentWillReceiveProps()?',
        spec.displayName || 'A component'
      );
    }

    // Reduce time spent doing lookups by setting these on the prototype.
    for (var methodName in ReactClassInterface) {
      if (!Constructor.prototype[methodName]) {
        Constructor.prototype[methodName] = null;
      }
    }

    return Constructor;
  }

  return createClass;
}

module.exports = factory;

}).call(this,require('_process'))

},{"_process":33,"fbjs/lib/emptyObject":29,"fbjs/lib/invariant":30,"fbjs/lib/warning":31,"object-assign":27}],27:[function(require,module,exports){
/*
object-assign
(c) Sindre Sorhus
@license MIT
*/

'use strict';
/* eslint-disable no-unused-vars */
var getOwnPropertySymbols = Object.getOwnPropertySymbols;
var hasOwnProperty = Object.prototype.hasOwnProperty;
var propIsEnumerable = Object.prototype.propertyIsEnumerable;

function toObject(val) {
	if (val === null || val === undefined) {
		throw new TypeError('Object.assign cannot be called with null or undefined');
	}

	return Object(val);
}

function shouldUseNative() {
	try {
		if (!Object.assign) {
			return false;
		}

		// Detect buggy property enumeration order in older V8 versions.

		// https://bugs.chromium.org/p/v8/issues/detail?id=4118
		var test1 = new String('abc');  // eslint-disable-line no-new-wrappers
		test1[5] = 'de';
		if (Object.getOwnPropertyNames(test1)[0] === '5') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test2 = {};
		for (var i = 0; i < 10; i++) {
			test2['_' + String.fromCharCode(i)] = i;
		}
		var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
			return test2[n];
		});
		if (order2.join('') !== '0123456789') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test3 = {};
		'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
			test3[letter] = letter;
		});
		if (Object.keys(Object.assign({}, test3)).join('') !==
				'abcdefghijklmnopqrst') {
			return false;
		}

		return true;
	} catch (err) {
		// We don't expect any of the above to throw, but better to be safe.
		return false;
	}
}

module.exports = shouldUseNative() ? Object.assign : function (target, source) {
	var from;
	var to = toObject(target);
	var symbols;

	for (var s = 1; s < arguments.length; s++) {
		from = Object(arguments[s]);

		for (var key in from) {
			if (hasOwnProperty.call(from, key)) {
				to[key] = from[key];
			}
		}

		if (getOwnPropertySymbols) {
			symbols = getOwnPropertySymbols(from);
			for (var i = 0; i < symbols.length; i++) {
				if (propIsEnumerable.call(from, symbols[i])) {
					to[symbols[i]] = from[symbols[i]];
				}
			}
		}
	}

	return to;
};

},{}],28:[function(require,module,exports){
"use strict";

/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * 
 */

function makeEmptyFunction(arg) {
  return function () {
    return arg;
  };
}

/**
 * This function accepts and discards inputs; it has no side effects. This is
 * primarily useful idiomatically for overridable function endpoints which
 * always need to be callable, since JS lacks a null-call idiom ala Cocoa.
 */
var emptyFunction = function emptyFunction() {};

emptyFunction.thatReturns = makeEmptyFunction;
emptyFunction.thatReturnsFalse = makeEmptyFunction(false);
emptyFunction.thatReturnsTrue = makeEmptyFunction(true);
emptyFunction.thatReturnsNull = makeEmptyFunction(null);
emptyFunction.thatReturnsThis = function () {
  return this;
};
emptyFunction.thatReturnsArgument = function (arg) {
  return arg;
};

module.exports = emptyFunction;
},{}],29:[function(require,module,exports){
(function (process){
/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 */

'use strict';

var emptyObject = {};

if (process.env.NODE_ENV !== 'production') {
  Object.freeze(emptyObject);
}

module.exports = emptyObject;
}).call(this,require('_process'))

},{"_process":33}],30:[function(require,module,exports){
(function (process){
/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 */

'use strict';

/**
 * Use invariant() to assert state which your program assumes to be true.
 *
 * Provide sprintf-style format (only %s is supported) and arguments
 * to provide information about what broke and what you were
 * expecting.
 *
 * The invariant message will be stripped in production, but the invariant
 * will remain to ensure logic does not differ in production.
 */

var validateFormat = function validateFormat(format) {};

if (process.env.NODE_ENV !== 'production') {
  validateFormat = function validateFormat(format) {
    if (format === undefined) {
      throw new Error('invariant requires an error message argument');
    }
  };
}

function invariant(condition, format, a, b, c, d, e, f) {
  validateFormat(format);

  if (!condition) {
    var error;
    if (format === undefined) {
      error = new Error('Minified exception occurred; use the non-minified dev environment ' + 'for the full error message and additional helpful warnings.');
    } else {
      var args = [a, b, c, d, e, f];
      var argIndex = 0;
      error = new Error(format.replace(/%s/g, function () {
        return args[argIndex++];
      }));
      error.name = 'Invariant Violation';
    }

    error.framesToPop = 1; // we don't care about invariant's own frame
    throw error;
  }
}

module.exports = invariant;
}).call(this,require('_process'))

},{"_process":33}],31:[function(require,module,exports){
(function (process){
/**
 * Copyright 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 */

'use strict';

var emptyFunction = require('./emptyFunction');

/**
 * Similar to invariant but only logs a warning if the condition is not met.
 * This can be used to log issues in development environments in critical
 * paths. Removing the logging code for production environments will keep the
 * same logic and follow the same code paths.
 */

var warning = emptyFunction;

if (process.env.NODE_ENV !== 'production') {
  var printWarning = function printWarning(format) {
    for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }

    var argIndex = 0;
    var message = 'Warning: ' + format.replace(/%s/g, function () {
      return args[argIndex++];
    });
    if (typeof console !== 'undefined') {
      console.error(message);
    }
    try {
      // --- Welcome to debugging React ---
      // This error was thrown as a convenience so that you can use this stack
      // to find the callsite that caused this warning to fire.
      throw new Error(message);
    } catch (x) {}
  };

  warning = function warning(condition, format) {
    if (format === undefined) {
      throw new Error('`warning(condition, format, ...args)` requires a warning ' + 'message argument');
    }

    if (format.indexOf('Failed Composite propType: ') === 0) {
      return; // Ignore CompositeComponent proptype check.
    }

    if (!condition) {
      for (var _len2 = arguments.length, args = Array(_len2 > 2 ? _len2 - 2 : 0), _key2 = 2; _key2 < _len2; _key2++) {
        args[_key2 - 2] = arguments[_key2];
      }

      printWarning.apply(undefined, [format].concat(args));
    }
  };
}

module.exports = warning;
}).call(this,require('_process'))

},{"./emptyFunction":28,"_process":33}],32:[function(require,module,exports){
/*!
 * Determine if an object is a Buffer
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

// The _isBuffer check is for Safari 5-7 support, because it's missing
// Object.prototype.constructor. Remove this eventually
module.exports = function (obj) {
  return obj != null && (isBuffer(obj) || isSlowBuffer(obj) || !!obj._isBuffer)
}

function isBuffer (obj) {
  return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

// For Node v0.10 support. Remove this eventually.
function isSlowBuffer (obj) {
  return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isBuffer(obj.slice(0, 0))
}

},{}],33:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],34:[function(require,module,exports){
(function (process){
/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

'use strict';

if (process.env.NODE_ENV !== 'production') {
  var invariant = require('fbjs/lib/invariant');
  var warning = require('fbjs/lib/warning');
  var ReactPropTypesSecret = require('./lib/ReactPropTypesSecret');
  var loggedTypeFailures = {};
}

/**
 * Assert that the values match with the type specs.
 * Error messages are memorized and will only be shown once.
 *
 * @param {object} typeSpecs Map of name to a ReactPropType
 * @param {object} values Runtime values that need to be type-checked
 * @param {string} location e.g. "prop", "context", "child context"
 * @param {string} componentName Name of the component for error messages.
 * @param {?Function} getStack Returns the component stack.
 * @private
 */
function checkPropTypes(typeSpecs, values, location, componentName, getStack) {
  if (process.env.NODE_ENV !== 'production') {
    for (var typeSpecName in typeSpecs) {
      if (typeSpecs.hasOwnProperty(typeSpecName)) {
        var error;
        // Prop type validation may throw. In case they do, we don't want to
        // fail the render phase where it didn't fail before. So we log it.
        // After these have been cleaned up, we'll let them throw.
        try {
          // This is intentionally an invariant that gets caught. It's the same
          // behavior as without this statement except with a better message.
          invariant(typeof typeSpecs[typeSpecName] === 'function', '%s: %s type `%s` is invalid; it must be a function, usually from ' + 'React.PropTypes.', componentName || 'React class', location, typeSpecName);
          error = typeSpecs[typeSpecName](values, typeSpecName, componentName, location, null, ReactPropTypesSecret);
        } catch (ex) {
          error = ex;
        }
        warning(!error || error instanceof Error, '%s: type specification of %s `%s` is invalid; the type checker ' + 'function must return `null` or an `Error` but returned a %s. ' + 'You may have forgotten to pass an argument to the type checker ' + 'creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and ' + 'shape all require an argument).', componentName || 'React class', location, typeSpecName, typeof error);
        if (error instanceof Error && !(error.message in loggedTypeFailures)) {
          // Only monitor this failure once because there tends to be a lot of the
          // same error.
          loggedTypeFailures[error.message] = true;

          var stack = getStack ? getStack() : '';

          warning(false, 'Failed %s type: %s%s', location, error.message, stack != null ? stack : '');
        }
      }
    }
  }
}

module.exports = checkPropTypes;

}).call(this,require('_process'))

},{"./lib/ReactPropTypesSecret":37,"_process":33,"fbjs/lib/invariant":30,"fbjs/lib/warning":31}],35:[function(require,module,exports){
/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

'use strict';

// React 15.5 references this module, and assumes PropTypes are still callable in production.
// Therefore we re-export development-only version with all the PropTypes checks here.
// However if one is migrating to the `prop-types` npm library, they will go through the
// `index.js` entry point, and it will branch depending on the environment.
var factory = require('./factoryWithTypeCheckers');
module.exports = function(isValidElement) {
  // It is still allowed in 15.5.
  var throwOnDirectAccess = false;
  return factory(isValidElement, throwOnDirectAccess);
};

},{"./factoryWithTypeCheckers":36}],36:[function(require,module,exports){
(function (process){
/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

'use strict';

var emptyFunction = require('fbjs/lib/emptyFunction');
var invariant = require('fbjs/lib/invariant');
var warning = require('fbjs/lib/warning');

var ReactPropTypesSecret = require('./lib/ReactPropTypesSecret');
var checkPropTypes = require('./checkPropTypes');

module.exports = function(isValidElement, throwOnDirectAccess) {
  /* global Symbol */
  var ITERATOR_SYMBOL = typeof Symbol === 'function' && Symbol.iterator;
  var FAUX_ITERATOR_SYMBOL = '@@iterator'; // Before Symbol spec.

  /**
   * Returns the iterator method function contained on the iterable object.
   *
   * Be sure to invoke the function with the iterable as context:
   *
   *     var iteratorFn = getIteratorFn(myIterable);
   *     if (iteratorFn) {
   *       var iterator = iteratorFn.call(myIterable);
   *       ...
   *     }
   *
   * @param {?object} maybeIterable
   * @return {?function}
   */
  function getIteratorFn(maybeIterable) {
    var iteratorFn = maybeIterable && (ITERATOR_SYMBOL && maybeIterable[ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL]);
    if (typeof iteratorFn === 'function') {
      return iteratorFn;
    }
  }

  /**
   * Collection of methods that allow declaration and validation of props that are
   * supplied to React components. Example usage:
   *
   *   var Props = require('ReactPropTypes');
   *   var MyArticle = React.createClass({
   *     propTypes: {
   *       // An optional string prop named "description".
   *       description: Props.string,
   *
   *       // A required enum prop named "category".
   *       category: Props.oneOf(['News','Photos']).isRequired,
   *
   *       // A prop named "dialog" that requires an instance of Dialog.
   *       dialog: Props.instanceOf(Dialog).isRequired
   *     },
   *     render: function() { ... }
   *   });
   *
   * A more formal specification of how these methods are used:
   *
   *   type := array|bool|func|object|number|string|oneOf([...])|instanceOf(...)
   *   decl := ReactPropTypes.{type}(.isRequired)?
   *
   * Each and every declaration produces a function with the same signature. This
   * allows the creation of custom validation functions. For example:
   *
   *  var MyLink = React.createClass({
   *    propTypes: {
   *      // An optional string or URI prop named "href".
   *      href: function(props, propName, componentName) {
   *        var propValue = props[propName];
   *        if (propValue != null && typeof propValue !== 'string' &&
   *            !(propValue instanceof URI)) {
   *          return new Error(
   *            'Expected a string or an URI for ' + propName + ' in ' +
   *            componentName
   *          );
   *        }
   *      }
   *    },
   *    render: function() {...}
   *  });
   *
   * @internal
   */

  var ANONYMOUS = '<<anonymous>>';

  // Important!
  // Keep this list in sync with production version in `./factoryWithThrowingShims.js`.
  var ReactPropTypes = {
    array: createPrimitiveTypeChecker('array'),
    bool: createPrimitiveTypeChecker('boolean'),
    func: createPrimitiveTypeChecker('function'),
    number: createPrimitiveTypeChecker('number'),
    object: createPrimitiveTypeChecker('object'),
    string: createPrimitiveTypeChecker('string'),
    symbol: createPrimitiveTypeChecker('symbol'),

    any: createAnyTypeChecker(),
    arrayOf: createArrayOfTypeChecker,
    element: createElementTypeChecker(),
    instanceOf: createInstanceTypeChecker,
    node: createNodeChecker(),
    objectOf: createObjectOfTypeChecker,
    oneOf: createEnumTypeChecker,
    oneOfType: createUnionTypeChecker,
    shape: createShapeTypeChecker
  };

  /**
   * inlined Object.is polyfill to avoid requiring consumers ship their own
   * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is
   */
  /*eslint-disable no-self-compare*/
  function is(x, y) {
    // SameValue algorithm
    if (x === y) {
      // Steps 1-5, 7-10
      // Steps 6.b-6.e: +0 != -0
      return x !== 0 || 1 / x === 1 / y;
    } else {
      // Step 6.a: NaN == NaN
      return x !== x && y !== y;
    }
  }
  /*eslint-enable no-self-compare*/

  /**
   * We use an Error-like object for backward compatibility as people may call
   * PropTypes directly and inspect their output. However, we don't use real
   * Errors anymore. We don't inspect their stack anyway, and creating them
   * is prohibitively expensive if they are created too often, such as what
   * happens in oneOfType() for any type before the one that matched.
   */
  function PropTypeError(message) {
    this.message = message;
    this.stack = '';
  }
  // Make `instanceof Error` still work for returned errors.
  PropTypeError.prototype = Error.prototype;

  function createChainableTypeChecker(validate) {
    if (process.env.NODE_ENV !== 'production') {
      var manualPropTypeCallCache = {};
      var manualPropTypeWarningCount = 0;
    }
    function checkType(isRequired, props, propName, componentName, location, propFullName, secret) {
      componentName = componentName || ANONYMOUS;
      propFullName = propFullName || propName;

      if (secret !== ReactPropTypesSecret) {
        if (throwOnDirectAccess) {
          // New behavior only for users of `prop-types` package
          invariant(
            false,
            'Calling PropTypes validators directly is not supported by the `prop-types` package. ' +
            'Use `PropTypes.checkPropTypes()` to call them. ' +
            'Read more at http://fb.me/use-check-prop-types'
          );
        } else if (process.env.NODE_ENV !== 'production' && typeof console !== 'undefined') {
          // Old behavior for people using React.PropTypes
          var cacheKey = componentName + ':' + propName;
          if (
            !manualPropTypeCallCache[cacheKey] &&
            // Avoid spamming the console because they are often not actionable except for lib authors
            manualPropTypeWarningCount < 3
          ) {
            warning(
              false,
              'You are manually calling a React.PropTypes validation ' +
              'function for the `%s` prop on `%s`. This is deprecated ' +
              'and will throw in the standalone `prop-types` package. ' +
              'You may be seeing this warning due to a third-party PropTypes ' +
              'library. See https://fb.me/react-warning-dont-call-proptypes ' + 'for details.',
              propFullName,
              componentName
            );
            manualPropTypeCallCache[cacheKey] = true;
            manualPropTypeWarningCount++;
          }
        }
      }
      if (props[propName] == null) {
        if (isRequired) {
          if (props[propName] === null) {
            return new PropTypeError('The ' + location + ' `' + propFullName + '` is marked as required ' + ('in `' + componentName + '`, but its value is `null`.'));
          }
          return new PropTypeError('The ' + location + ' `' + propFullName + '` is marked as required in ' + ('`' + componentName + '`, but its value is `undefined`.'));
        }
        return null;
      } else {
        return validate(props, propName, componentName, location, propFullName);
      }
    }

    var chainedCheckType = checkType.bind(null, false);
    chainedCheckType.isRequired = checkType.bind(null, true);

    return chainedCheckType;
  }

  function createPrimitiveTypeChecker(expectedType) {
    function validate(props, propName, componentName, location, propFullName, secret) {
      var propValue = props[propName];
      var propType = getPropType(propValue);
      if (propType !== expectedType) {
        // `propValue` being instance of, say, date/regexp, pass the 'object'
        // check, but we can offer a more precise error message here rather than
        // 'of type `object`'.
        var preciseType = getPreciseType(propValue);

        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + preciseType + '` supplied to `' + componentName + '`, expected ') + ('`' + expectedType + '`.'));
      }
      return null;
    }
    return createChainableTypeChecker(validate);
  }

  function createAnyTypeChecker() {
    return createChainableTypeChecker(emptyFunction.thatReturnsNull);
  }

  function createArrayOfTypeChecker(typeChecker) {
    function validate(props, propName, componentName, location, propFullName) {
      if (typeof typeChecker !== 'function') {
        return new PropTypeError('Property `' + propFullName + '` of component `' + componentName + '` has invalid PropType notation inside arrayOf.');
      }
      var propValue = props[propName];
      if (!Array.isArray(propValue)) {
        var propType = getPropType(propValue);
        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected an array.'));
      }
      for (var i = 0; i < propValue.length; i++) {
        var error = typeChecker(propValue, i, componentName, location, propFullName + '[' + i + ']', ReactPropTypesSecret);
        if (error instanceof Error) {
          return error;
        }
      }
      return null;
    }
    return createChainableTypeChecker(validate);
  }

  function createElementTypeChecker() {
    function validate(props, propName, componentName, location, propFullName) {
      var propValue = props[propName];
      if (!isValidElement(propValue)) {
        var propType = getPropType(propValue);
        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected a single ReactElement.'));
      }
      return null;
    }
    return createChainableTypeChecker(validate);
  }

  function createInstanceTypeChecker(expectedClass) {
    function validate(props, propName, componentName, location, propFullName) {
      if (!(props[propName] instanceof expectedClass)) {
        var expectedClassName = expectedClass.name || ANONYMOUS;
        var actualClassName = getClassName(props[propName]);
        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + actualClassName + '` supplied to `' + componentName + '`, expected ') + ('instance of `' + expectedClassName + '`.'));
      }
      return null;
    }
    return createChainableTypeChecker(validate);
  }

  function createEnumTypeChecker(expectedValues) {
    if (!Array.isArray(expectedValues)) {
      process.env.NODE_ENV !== 'production' ? warning(false, 'Invalid argument supplied to oneOf, expected an instance of array.') : void 0;
      return emptyFunction.thatReturnsNull;
    }

    function validate(props, propName, componentName, location, propFullName) {
      var propValue = props[propName];
      for (var i = 0; i < expectedValues.length; i++) {
        if (is(propValue, expectedValues[i])) {
          return null;
        }
      }

      var valuesString = JSON.stringify(expectedValues);
      return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of value `' + propValue + '` ' + ('supplied to `' + componentName + '`, expected one of ' + valuesString + '.'));
    }
    return createChainableTypeChecker(validate);
  }

  function createObjectOfTypeChecker(typeChecker) {
    function validate(props, propName, componentName, location, propFullName) {
      if (typeof typeChecker !== 'function') {
        return new PropTypeError('Property `' + propFullName + '` of component `' + componentName + '` has invalid PropType notation inside objectOf.');
      }
      var propValue = props[propName];
      var propType = getPropType(propValue);
      if (propType !== 'object') {
        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected an object.'));
      }
      for (var key in propValue) {
        if (propValue.hasOwnProperty(key)) {
          var error = typeChecker(propValue, key, componentName, location, propFullName + '.' + key, ReactPropTypesSecret);
          if (error instanceof Error) {
            return error;
          }
        }
      }
      return null;
    }
    return createChainableTypeChecker(validate);
  }

  function createUnionTypeChecker(arrayOfTypeCheckers) {
    if (!Array.isArray(arrayOfTypeCheckers)) {
      process.env.NODE_ENV !== 'production' ? warning(false, 'Invalid argument supplied to oneOfType, expected an instance of array.') : void 0;
      return emptyFunction.thatReturnsNull;
    }

    for (var i = 0; i < arrayOfTypeCheckers.length; i++) {
      var checker = arrayOfTypeCheckers[i];
      if (typeof checker !== 'function') {
        warning(
          false,
          'Invalid argument supplid to oneOfType. Expected an array of check functions, but ' +
          'received %s at index %s.',
          getPostfixForTypeWarning(checker),
          i
        );
        return emptyFunction.thatReturnsNull;
      }
    }

    function validate(props, propName, componentName, location, propFullName) {
      for (var i = 0; i < arrayOfTypeCheckers.length; i++) {
        var checker = arrayOfTypeCheckers[i];
        if (checker(props, propName, componentName, location, propFullName, ReactPropTypesSecret) == null) {
          return null;
        }
      }

      return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` supplied to ' + ('`' + componentName + '`.'));
    }
    return createChainableTypeChecker(validate);
  }

  function createNodeChecker() {
    function validate(props, propName, componentName, location, propFullName) {
      if (!isNode(props[propName])) {
        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` supplied to ' + ('`' + componentName + '`, expected a ReactNode.'));
      }
      return null;
    }
    return createChainableTypeChecker(validate);
  }

  function createShapeTypeChecker(shapeTypes) {
    function validate(props, propName, componentName, location, propFullName) {
      var propValue = props[propName];
      var propType = getPropType(propValue);
      if (propType !== 'object') {
        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type `' + propType + '` ' + ('supplied to `' + componentName + '`, expected `object`.'));
      }
      for (var key in shapeTypes) {
        var checker = shapeTypes[key];
        if (!checker) {
          continue;
        }
        var error = checker(propValue, key, componentName, location, propFullName + '.' + key, ReactPropTypesSecret);
        if (error) {
          return error;
        }
      }
      return null;
    }
    return createChainableTypeChecker(validate);
  }

  function isNode(propValue) {
    switch (typeof propValue) {
      case 'number':
      case 'string':
      case 'undefined':
        return true;
      case 'boolean':
        return !propValue;
      case 'object':
        if (Array.isArray(propValue)) {
          return propValue.every(isNode);
        }
        if (propValue === null || isValidElement(propValue)) {
          return true;
        }

        var iteratorFn = getIteratorFn(propValue);
        if (iteratorFn) {
          var iterator = iteratorFn.call(propValue);
          var step;
          if (iteratorFn !== propValue.entries) {
            while (!(step = iterator.next()).done) {
              if (!isNode(step.value)) {
                return false;
              }
            }
          } else {
            // Iterator will provide entry [k,v] tuples rather than values.
            while (!(step = iterator.next()).done) {
              var entry = step.value;
              if (entry) {
                if (!isNode(entry[1])) {
                  return false;
                }
              }
            }
          }
        } else {
          return false;
        }

        return true;
      default:
        return false;
    }
  }

  function isSymbol(propType, propValue) {
    // Native Symbol.
    if (propType === 'symbol') {
      return true;
    }

    // 19.4.3.5 Symbol.prototype[@@toStringTag] === 'Symbol'
    if (propValue['@@toStringTag'] === 'Symbol') {
      return true;
    }

    // Fallback for non-spec compliant Symbols which are polyfilled.
    if (typeof Symbol === 'function' && propValue instanceof Symbol) {
      return true;
    }

    return false;
  }

  // Equivalent of `typeof` but with special handling for array and regexp.
  function getPropType(propValue) {
    var propType = typeof propValue;
    if (Array.isArray(propValue)) {
      return 'array';
    }
    if (propValue instanceof RegExp) {
      // Old webkits (at least until Android 4.0) return 'function' rather than
      // 'object' for typeof a RegExp. We'll normalize this here so that /bla/
      // passes PropTypes.object.
      return 'object';
    }
    if (isSymbol(propType, propValue)) {
      return 'symbol';
    }
    return propType;
  }

  // This handles more types than `getPropType`. Only used for error messages.
  // See `createPrimitiveTypeChecker`.
  function getPreciseType(propValue) {
    if (typeof propValue === 'undefined' || propValue === null) {
      return '' + propValue;
    }
    var propType = getPropType(propValue);
    if (propType === 'object') {
      if (propValue instanceof Date) {
        return 'date';
      } else if (propValue instanceof RegExp) {
        return 'regexp';
      }
    }
    return propType;
  }

  // Returns a string that is postfixed to a warning about an invalid type.
  // For example, "undefined" or "of type array"
  function getPostfixForTypeWarning(value) {
    var type = getPreciseType(value);
    switch (type) {
      case 'array':
      case 'object':
        return 'an ' + type;
      case 'boolean':
      case 'date':
      case 'regexp':
        return 'a ' + type;
      default:
        return type;
    }
  }

  // Returns class name of the object, if any.
  function getClassName(propValue) {
    if (!propValue.constructor || !propValue.constructor.name) {
      return ANONYMOUS;
    }
    return propValue.constructor.name;
  }

  ReactPropTypes.checkPropTypes = checkPropTypes;
  ReactPropTypes.PropTypes = ReactPropTypes;

  return ReactPropTypes;
};

}).call(this,require('_process'))

},{"./checkPropTypes":34,"./lib/ReactPropTypesSecret":37,"_process":33,"fbjs/lib/emptyFunction":28,"fbjs/lib/invariant":30,"fbjs/lib/warning":31}],37:[function(require,module,exports){
/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

'use strict';

var ReactPropTypesSecret = 'SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED';

module.exports = ReactPropTypesSecret;

},{}],38:[function(require,module,exports){
/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * 
 */

'use strict';

/**
 * Escape and wrap key so it is safe to use as a reactid
 *
 * @param {string} key to be escaped.
 * @return {string} the escaped key.
 */

function escape(key) {
  var escapeRegex = /[=:]/g;
  var escaperLookup = {
    '=': '=0',
    ':': '=2'
  };
  var escapedString = ('' + key).replace(escapeRegex, function (match) {
    return escaperLookup[match];
  });

  return '$' + escapedString;
}

/**
 * Unescape and unwrap key for human-readable display
 *
 * @param {string} key to unescape.
 * @return {string} the unescaped key.
 */
function unescape(key) {
  var unescapeRegex = /(=0|=2)/g;
  var unescaperLookup = {
    '=0': '=',
    '=2': ':'
  };
  var keySubstring = key[0] === '.' && key[1] === '$' ? key.substring(2) : key.substring(1);

  return ('' + keySubstring).replace(unescapeRegex, function (match) {
    return unescaperLookup[match];
  });
}

var KeyEscapeUtils = {
  escape: escape,
  unescape: unescape
};

module.exports = KeyEscapeUtils;
},{}],39:[function(require,module,exports){
(function (process){
/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * 
 */

'use strict';

var _prodInvariant = require('./reactProdInvariant');

var invariant = require('fbjs/lib/invariant');

/**
 * Static poolers. Several custom versions for each potential number of
 * arguments. A completely generic pooler is easy to implement, but would
 * require accessing the `arguments` object. In each of these, `this` refers to
 * the Class itself, not an instance. If any others are needed, simply add them
 * here, or in their own files.
 */
var oneArgumentPooler = function (copyFieldsFrom) {
  var Klass = this;
  if (Klass.instancePool.length) {
    var instance = Klass.instancePool.pop();
    Klass.call(instance, copyFieldsFrom);
    return instance;
  } else {
    return new Klass(copyFieldsFrom);
  }
};

var twoArgumentPooler = function (a1, a2) {
  var Klass = this;
  if (Klass.instancePool.length) {
    var instance = Klass.instancePool.pop();
    Klass.call(instance, a1, a2);
    return instance;
  } else {
    return new Klass(a1, a2);
  }
};

var threeArgumentPooler = function (a1, a2, a3) {
  var Klass = this;
  if (Klass.instancePool.length) {
    var instance = Klass.instancePool.pop();
    Klass.call(instance, a1, a2, a3);
    return instance;
  } else {
    return new Klass(a1, a2, a3);
  }
};

var fourArgumentPooler = function (a1, a2, a3, a4) {
  var Klass = this;
  if (Klass.instancePool.length) {
    var instance = Klass.instancePool.pop();
    Klass.call(instance, a1, a2, a3, a4);
    return instance;
  } else {
    return new Klass(a1, a2, a3, a4);
  }
};

var standardReleaser = function (instance) {
  var Klass = this;
  !(instance instanceof Klass) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Trying to release an instance into a pool of a different type.') : _prodInvariant('25') : void 0;
  instance.destructor();
  if (Klass.instancePool.length < Klass.poolSize) {
    Klass.instancePool.push(instance);
  }
};

var DEFAULT_POOL_SIZE = 10;
var DEFAULT_POOLER = oneArgumentPooler;

/**
 * Augments `CopyConstructor` to be a poolable class, augmenting only the class
 * itself (statically) not adding any prototypical fields. Any CopyConstructor
 * you give this may have a `poolSize` property, and will look for a
 * prototypical `destructor` on instances.
 *
 * @param {Function} CopyConstructor Constructor that can be used to reset.
 * @param {Function} pooler Customizable pooler.
 */
var addPoolingTo = function (CopyConstructor, pooler) {
  // Casting as any so that flow ignores the actual implementation and trusts
  // it to match the type we declared
  var NewKlass = CopyConstructor;
  NewKlass.instancePool = [];
  NewKlass.getPooled = pooler || DEFAULT_POOLER;
  if (!NewKlass.poolSize) {
    NewKlass.poolSize = DEFAULT_POOL_SIZE;
  }
  NewKlass.release = standardReleaser;
  return NewKlass;
};

var PooledClass = {
  addPoolingTo: addPoolingTo,
  oneArgumentPooler: oneArgumentPooler,
  twoArgumentPooler: twoArgumentPooler,
  threeArgumentPooler: threeArgumentPooler,
  fourArgumentPooler: fourArgumentPooler
};

module.exports = PooledClass;
}).call(this,require('_process'))

},{"./reactProdInvariant":60,"_process":33,"fbjs/lib/invariant":30}],40:[function(require,module,exports){
(function (process){
/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 */

'use strict';

var _assign = require('object-assign');

var ReactBaseClasses = require('./ReactBaseClasses');
var ReactChildren = require('./ReactChildren');
var ReactDOMFactories = require('./ReactDOMFactories');
var ReactElement = require('./ReactElement');
var ReactPropTypes = require('./ReactPropTypes');
var ReactVersion = require('./ReactVersion');

var createReactClass = require('./createClass');
var onlyChild = require('./onlyChild');

var createElement = ReactElement.createElement;
var createFactory = ReactElement.createFactory;
var cloneElement = ReactElement.cloneElement;

if (process.env.NODE_ENV !== 'production') {
  var lowPriorityWarning = require('./lowPriorityWarning');
  var canDefineProperty = require('./canDefineProperty');
  var ReactElementValidator = require('./ReactElementValidator');
  var didWarnPropTypesDeprecated = false;
  createElement = ReactElementValidator.createElement;
  createFactory = ReactElementValidator.createFactory;
  cloneElement = ReactElementValidator.cloneElement;
}

var __spread = _assign;
var createMixin = function (mixin) {
  return mixin;
};

if (process.env.NODE_ENV !== 'production') {
  var warnedForSpread = false;
  var warnedForCreateMixin = false;
  __spread = function () {
    lowPriorityWarning(warnedForSpread, 'React.__spread is deprecated and should not be used. Use ' + 'Object.assign directly or another helper function with similar ' + 'semantics. You may be seeing this warning due to your compiler. ' + 'See https://fb.me/react-spread-deprecation for more details.');
    warnedForSpread = true;
    return _assign.apply(null, arguments);
  };

  createMixin = function (mixin) {
    lowPriorityWarning(warnedForCreateMixin, 'React.createMixin is deprecated and should not be used. ' + 'In React v16.0, it will be removed. ' + 'You can use this mixin directly instead. ' + 'See https://fb.me/createmixin-was-never-implemented for more info.');
    warnedForCreateMixin = true;
    return mixin;
  };
}

var React = {
  // Modern

  Children: {
    map: ReactChildren.map,
    forEach: ReactChildren.forEach,
    count: ReactChildren.count,
    toArray: ReactChildren.toArray,
    only: onlyChild
  },

  Component: ReactBaseClasses.Component,
  PureComponent: ReactBaseClasses.PureComponent,

  createElement: createElement,
  cloneElement: cloneElement,
  isValidElement: ReactElement.isValidElement,

  // Classic

  PropTypes: ReactPropTypes,
  createClass: createReactClass,
  createFactory: createFactory,
  createMixin: createMixin,

  // This looks DOM specific but these are actually isomorphic helpers
  // since they are just generating DOM strings.
  DOM: ReactDOMFactories,

  version: ReactVersion,

  // Deprecated hook for JSX spread, don't use this for anything.
  __spread: __spread
};

if (process.env.NODE_ENV !== 'production') {
  var warnedForCreateClass = false;
  if (canDefineProperty) {
    Object.defineProperty(React, 'PropTypes', {
      get: function () {
        lowPriorityWarning(didWarnPropTypesDeprecated, 'Accessing PropTypes via the main React package is deprecated,' + ' and will be removed in  React v16.0.' + ' Use the latest available v15.* prop-types package from npm instead.' + ' For info on usage, compatibility, migration and more, see ' + 'https://fb.me/prop-types-docs');
        didWarnPropTypesDeprecated = true;
        return ReactPropTypes;
      }
    });

    Object.defineProperty(React, 'createClass', {
      get: function () {
        lowPriorityWarning(warnedForCreateClass, 'Accessing createClass via the main React package is deprecated,' + ' and will be removed in React v16.0.' + " Use a plain JavaScript class instead. If you're not yet " + 'ready to migrate, create-react-class v15.* is available ' + 'on npm as a temporary, drop-in replacement. ' + 'For more info see https://fb.me/react-create-class');
        warnedForCreateClass = true;
        return createReactClass;
      }
    });
  }

  // React.DOM factories are deprecated. Wrap these methods so that
  // invocations of the React.DOM namespace and alert users to switch
  // to the `react-dom-factories` package.
  React.DOM = {};
  var warnedForFactories = false;
  Object.keys(ReactDOMFactories).forEach(function (factory) {
    React.DOM[factory] = function () {
      if (!warnedForFactories) {
        lowPriorityWarning(false, 'Accessing factories like React.DOM.%s has been deprecated ' + 'and will be removed in v16.0+. Use the ' + 'react-dom-factories package instead. ' + ' Version 1.0 provides a drop-in replacement.' + ' For more info, see https://fb.me/react-dom-factories', factory);
        warnedForFactories = true;
      }
      return ReactDOMFactories[factory].apply(ReactDOMFactories, arguments);
    };
  });
}

module.exports = React;
}).call(this,require('_process'))

},{"./ReactBaseClasses":41,"./ReactChildren":42,"./ReactDOMFactories":45,"./ReactElement":46,"./ReactElementValidator":48,"./ReactPropTypes":51,"./ReactVersion":53,"./canDefineProperty":54,"./createClass":56,"./lowPriorityWarning":58,"./onlyChild":59,"_process":33,"object-assign":62}],41:[function(require,module,exports){
(function (process){
/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 */

'use strict';

var _prodInvariant = require('./reactProdInvariant'),
    _assign = require('object-assign');

var ReactNoopUpdateQueue = require('./ReactNoopUpdateQueue');

var canDefineProperty = require('./canDefineProperty');
var emptyObject = require('fbjs/lib/emptyObject');
var invariant = require('fbjs/lib/invariant');
var lowPriorityWarning = require('./lowPriorityWarning');

/**
 * Base class helpers for the updating state of a component.
 */
function ReactComponent(props, context, updater) {
  this.props = props;
  this.context = context;
  this.refs = emptyObject;
  // We initialize the default updater but the real one gets injected by the
  // renderer.
  this.updater = updater || ReactNoopUpdateQueue;
}

ReactComponent.prototype.isReactComponent = {};

/**
 * Sets a subset of the state. Always use this to mutate
 * state. You should treat `this.state` as immutable.
 *
 * There is no guarantee that `this.state` will be immediately updated, so
 * accessing `this.state` after calling this method may return the old value.
 *
 * There is no guarantee that calls to `setState` will run synchronously,
 * as they may eventually be batched together.  You can provide an optional
 * callback that will be executed when the call to setState is actually
 * completed.
 *
 * When a function is provided to setState, it will be called at some point in
 * the future (not synchronously). It will be called with the up to date
 * component arguments (state, props, context). These values can be different
 * from this.* because your function may be called after receiveProps but before
 * shouldComponentUpdate, and this new state, props, and context will not yet be
 * assigned to this.
 *
 * @param {object|function} partialState Next partial state or function to
 *        produce next partial state to be merged with current state.
 * @param {?function} callback Called after state is updated.
 * @final
 * @protected
 */
ReactComponent.prototype.setState = function (partialState, callback) {
  !(typeof partialState === 'object' || typeof partialState === 'function' || partialState == null) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'setState(...): takes an object of state variables to update or a function which returns an object of state variables.') : _prodInvariant('85') : void 0;
  this.updater.enqueueSetState(this, partialState);
  if (callback) {
    this.updater.enqueueCallback(this, callback, 'setState');
  }
};

/**
 * Forces an update. This should only be invoked when it is known with
 * certainty that we are **not** in a DOM transaction.
 *
 * You may want to call this when you know that some deeper aspect of the
 * component's state has changed but `setState` was not called.
 *
 * This will not invoke `shouldComponentUpdate`, but it will invoke
 * `componentWillUpdate` and `componentDidUpdate`.
 *
 * @param {?function} callback Called after update is complete.
 * @final
 * @protected
 */
ReactComponent.prototype.forceUpdate = function (callback) {
  this.updater.enqueueForceUpdate(this);
  if (callback) {
    this.updater.enqueueCallback(this, callback, 'forceUpdate');
  }
};

/**
 * Deprecated APIs. These APIs used to exist on classic React classes but since
 * we would like to deprecate them, we're not going to move them over to this
 * modern base class. Instead, we define a getter that warns if it's accessed.
 */
if (process.env.NODE_ENV !== 'production') {
  var deprecatedAPIs = {
    isMounted: ['isMounted', 'Instead, make sure to clean up subscriptions and pending requests in ' + 'componentWillUnmount to prevent memory leaks.'],
    replaceState: ['replaceState', 'Refactor your code to use setState instead (see ' + 'https://github.com/facebook/react/issues/3236).']
  };
  var defineDeprecationWarning = function (methodName, info) {
    if (canDefineProperty) {
      Object.defineProperty(ReactComponent.prototype, methodName, {
        get: function () {
          lowPriorityWarning(false, '%s(...) is deprecated in plain JavaScript React classes. %s', info[0], info[1]);
          return undefined;
        }
      });
    }
  };
  for (var fnName in deprecatedAPIs) {
    if (deprecatedAPIs.hasOwnProperty(fnName)) {
      defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
    }
  }
}

/**
 * Base class helpers for the updating state of a component.
 */
function ReactPureComponent(props, context, updater) {
  // Duplicated from ReactComponent.
  this.props = props;
  this.context = context;
  this.refs = emptyObject;
  // We initialize the default updater but the real one gets injected by the
  // renderer.
  this.updater = updater || ReactNoopUpdateQueue;
}

function ComponentDummy() {}
ComponentDummy.prototype = ReactComponent.prototype;
ReactPureComponent.prototype = new ComponentDummy();
ReactPureComponent.prototype.constructor = ReactPureComponent;
// Avoid an extra prototype jump for these methods.
_assign(ReactPureComponent.prototype, ReactComponent.prototype);
ReactPureComponent.prototype.isPureReactComponent = true;

module.exports = {
  Component: ReactComponent,
  PureComponent: ReactPureComponent
};
}).call(this,require('_process'))

},{"./ReactNoopUpdateQueue":49,"./canDefineProperty":54,"./lowPriorityWarning":58,"./reactProdInvariant":60,"_process":33,"fbjs/lib/emptyObject":29,"fbjs/lib/invariant":30,"object-assign":62}],42:[function(require,module,exports){
/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 */

'use strict';

var PooledClass = require('./PooledClass');
var ReactElement = require('./ReactElement');

var emptyFunction = require('fbjs/lib/emptyFunction');
var traverseAllChildren = require('./traverseAllChildren');

var twoArgumentPooler = PooledClass.twoArgumentPooler;
var fourArgumentPooler = PooledClass.fourArgumentPooler;

var userProvidedKeyEscapeRegex = /\/+/g;
function escapeUserProvidedKey(text) {
  return ('' + text).replace(userProvidedKeyEscapeRegex, '$&/');
}

/**
 * PooledClass representing the bookkeeping associated with performing a child
 * traversal. Allows avoiding binding callbacks.
 *
 * @constructor ForEachBookKeeping
 * @param {!function} forEachFunction Function to perform traversal with.
 * @param {?*} forEachContext Context to perform context with.
 */
function ForEachBookKeeping(forEachFunction, forEachContext) {
  this.func = forEachFunction;
  this.context = forEachContext;
  this.count = 0;
}
ForEachBookKeeping.prototype.destructor = function () {
  this.func = null;
  this.context = null;
  this.count = 0;
};
PooledClass.addPoolingTo(ForEachBookKeeping, twoArgumentPooler);

function forEachSingleChild(bookKeeping, child, name) {
  var func = bookKeeping.func,
      context = bookKeeping.context;

  func.call(context, child, bookKeeping.count++);
}

/**
 * Iterates through children that are typically specified as `props.children`.
 *
 * See https://facebook.github.io/react/docs/top-level-api.html#react.children.foreach
 *
 * The provided forEachFunc(child, index) will be called for each
 * leaf child.
 *
 * @param {?*} children Children tree container.
 * @param {function(*, int)} forEachFunc
 * @param {*} forEachContext Context for forEachContext.
 */
function forEachChildren(children, forEachFunc, forEachContext) {
  if (children == null) {
    return children;
  }
  var traverseContext = ForEachBookKeeping.getPooled(forEachFunc, forEachContext);
  traverseAllChildren(children, forEachSingleChild, traverseContext);
  ForEachBookKeeping.release(traverseContext);
}

/**
 * PooledClass representing the bookkeeping associated with performing a child
 * mapping. Allows avoiding binding callbacks.
 *
 * @constructor MapBookKeeping
 * @param {!*} mapResult Object containing the ordered map of results.
 * @param {!function} mapFunction Function to perform mapping with.
 * @param {?*} mapContext Context to perform mapping with.
 */
function MapBookKeeping(mapResult, keyPrefix, mapFunction, mapContext) {
  this.result = mapResult;
  this.keyPrefix = keyPrefix;
  this.func = mapFunction;
  this.context = mapContext;
  this.count = 0;
}
MapBookKeeping.prototype.destructor = function () {
  this.result = null;
  this.keyPrefix = null;
  this.func = null;
  this.context = null;
  this.count = 0;
};
PooledClass.addPoolingTo(MapBookKeeping, fourArgumentPooler);

function mapSingleChildIntoContext(bookKeeping, child, childKey) {
  var result = bookKeeping.result,
      keyPrefix = bookKeeping.keyPrefix,
      func = bookKeeping.func,
      context = bookKeeping.context;


  var mappedChild = func.call(context, child, bookKeeping.count++);
  if (Array.isArray(mappedChild)) {
    mapIntoWithKeyPrefixInternal(mappedChild, result, childKey, emptyFunction.thatReturnsArgument);
  } else if (mappedChild != null) {
    if (ReactElement.isValidElement(mappedChild)) {
      mappedChild = ReactElement.cloneAndReplaceKey(mappedChild,
      // Keep both the (mapped) and old keys if they differ, just as
      // traverseAllChildren used to do for objects as children
      keyPrefix + (mappedChild.key && (!child || child.key !== mappedChild.key) ? escapeUserProvidedKey(mappedChild.key) + '/' : '') + childKey);
    }
    result.push(mappedChild);
  }
}

function mapIntoWithKeyPrefixInternal(children, array, prefix, func, context) {
  var escapedPrefix = '';
  if (prefix != null) {
    escapedPrefix = escapeUserProvidedKey(prefix) + '/';
  }
  var traverseContext = MapBookKeeping.getPooled(array, escapedPrefix, func, context);
  traverseAllChildren(children, mapSingleChildIntoContext, traverseContext);
  MapBookKeeping.release(traverseContext);
}

/**
 * Maps children that are typically specified as `props.children`.
 *
 * See https://facebook.github.io/react/docs/top-level-api.html#react.children.map
 *
 * The provided mapFunction(child, key, index) will be called for each
 * leaf child.
 *
 * @param {?*} children Children tree container.
 * @param {function(*, int)} func The map function.
 * @param {*} context Context for mapFunction.
 * @return {object} Object containing the ordered map of results.
 */
function mapChildren(children, func, context) {
  if (children == null) {
    return children;
  }
  var result = [];
  mapIntoWithKeyPrefixInternal(children, result, null, func, context);
  return result;
}

function forEachSingleChildDummy(traverseContext, child, name) {
  return null;
}

/**
 * Count the number of children that are typically specified as
 * `props.children`.
 *
 * See https://facebook.github.io/react/docs/top-level-api.html#react.children.count
 *
 * @param {?*} children Children tree container.
 * @return {number} The number of children.
 */
function countChildren(children, context) {
  return traverseAllChildren(children, forEachSingleChildDummy, null);
}

/**
 * Flatten a children object (typically specified as `props.children`) and
 * return an array with appropriately re-keyed children.
 *
 * See https://facebook.github.io/react/docs/top-level-api.html#react.children.toarray
 */
function toArray(children) {
  var result = [];
  mapIntoWithKeyPrefixInternal(children, result, null, emptyFunction.thatReturnsArgument);
  return result;
}

var ReactChildren = {
  forEach: forEachChildren,
  map: mapChildren,
  mapIntoWithKeyPrefixInternal: mapIntoWithKeyPrefixInternal,
  count: countChildren,
  toArray: toArray
};

module.exports = ReactChildren;
},{"./PooledClass":39,"./ReactElement":46,"./traverseAllChildren":61,"fbjs/lib/emptyFunction":28}],43:[function(require,module,exports){
(function (process){
/**
 * Copyright 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * 
 */

'use strict';

var _prodInvariant = require('./reactProdInvariant');

var ReactCurrentOwner = require('./ReactCurrentOwner');

var invariant = require('fbjs/lib/invariant');
var warning = require('fbjs/lib/warning');

function isNative(fn) {
  // Based on isNative() from Lodash
  var funcToString = Function.prototype.toString;
  var hasOwnProperty = Object.prototype.hasOwnProperty;
  var reIsNative = RegExp('^' + funcToString
  // Take an example native function source for comparison
  .call(hasOwnProperty
  // Strip regex characters so we can use it for regex
  ).replace(/[\\^$.*+?()[\]{}|]/g, '\\$&'
  // Remove hasOwnProperty from the template to make it generic
  ).replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$');
  try {
    var source = funcToString.call(fn);
    return reIsNative.test(source);
  } catch (err) {
    return false;
  }
}

var canUseCollections =
// Array.from
typeof Array.from === 'function' &&
// Map
typeof Map === 'function' && isNative(Map) &&
// Map.prototype.keys
Map.prototype != null && typeof Map.prototype.keys === 'function' && isNative(Map.prototype.keys) &&
// Set
typeof Set === 'function' && isNative(Set) &&
// Set.prototype.keys
Set.prototype != null && typeof Set.prototype.keys === 'function' && isNative(Set.prototype.keys);

var setItem;
var getItem;
var removeItem;
var getItemIDs;
var addRoot;
var removeRoot;
var getRootIDs;

if (canUseCollections) {
  var itemMap = new Map();
  var rootIDSet = new Set();

  setItem = function (id, item) {
    itemMap.set(id, item);
  };
  getItem = function (id) {
    return itemMap.get(id);
  };
  removeItem = function (id) {
    itemMap['delete'](id);
  };
  getItemIDs = function () {
    return Array.from(itemMap.keys());
  };

  addRoot = function (id) {
    rootIDSet.add(id);
  };
  removeRoot = function (id) {
    rootIDSet['delete'](id);
  };
  getRootIDs = function () {
    return Array.from(rootIDSet.keys());
  };
} else {
  var itemByKey = {};
  var rootByKey = {};

  // Use non-numeric keys to prevent V8 performance issues:
  // https://github.com/facebook/react/pull/7232
  var getKeyFromID = function (id) {
    return '.' + id;
  };
  var getIDFromKey = function (key) {
    return parseInt(key.substr(1), 10);
  };

  setItem = function (id, item) {
    var key = getKeyFromID(id);
    itemByKey[key] = item;
  };
  getItem = function (id) {
    var key = getKeyFromID(id);
    return itemByKey[key];
  };
  removeItem = function (id) {
    var key = getKeyFromID(id);
    delete itemByKey[key];
  };
  getItemIDs = function () {
    return Object.keys(itemByKey).map(getIDFromKey);
  };

  addRoot = function (id) {
    var key = getKeyFromID(id);
    rootByKey[key] = true;
  };
  removeRoot = function (id) {
    var key = getKeyFromID(id);
    delete rootByKey[key];
  };
  getRootIDs = function () {
    return Object.keys(rootByKey).map(getIDFromKey);
  };
}

var unmountedIDs = [];

function purgeDeep(id) {
  var item = getItem(id);
  if (item) {
    var childIDs = item.childIDs;

    removeItem(id);
    childIDs.forEach(purgeDeep);
  }
}

function describeComponentFrame(name, source, ownerName) {
  return '\n    in ' + (name || 'Unknown') + (source ? ' (at ' + source.fileName.replace(/^.*[\\\/]/, '') + ':' + source.lineNumber + ')' : ownerName ? ' (created by ' + ownerName + ')' : '');
}

function getDisplayName(element) {
  if (element == null) {
    return '#empty';
  } else if (typeof element === 'string' || typeof element === 'number') {
    return '#text';
  } else if (typeof element.type === 'string') {
    return element.type;
  } else {
    return element.type.displayName || element.type.name || 'Unknown';
  }
}

function describeID(id) {
  var name = ReactComponentTreeHook.getDisplayName(id);
  var element = ReactComponentTreeHook.getElement(id);
  var ownerID = ReactComponentTreeHook.getOwnerID(id);
  var ownerName;
  if (ownerID) {
    ownerName = ReactComponentTreeHook.getDisplayName(ownerID);
  }
  process.env.NODE_ENV !== 'production' ? warning(element, 'ReactComponentTreeHook: Missing React element for debugID %s when ' + 'building stack', id) : void 0;
  return describeComponentFrame(name, element && element._source, ownerName);
}

var ReactComponentTreeHook = {
  onSetChildren: function (id, nextChildIDs) {
    var item = getItem(id);
    !item ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Item must have been set') : _prodInvariant('144') : void 0;
    item.childIDs = nextChildIDs;

    for (var i = 0; i < nextChildIDs.length; i++) {
      var nextChildID = nextChildIDs[i];
      var nextChild = getItem(nextChildID);
      !nextChild ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Expected hook events to fire for the child before its parent includes it in onSetChildren().') : _prodInvariant('140') : void 0;
      !(nextChild.childIDs != null || typeof nextChild.element !== 'object' || nextChild.element == null) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Expected onSetChildren() to fire for a container child before its parent includes it in onSetChildren().') : _prodInvariant('141') : void 0;
      !nextChild.isMounted ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Expected onMountComponent() to fire for the child before its parent includes it in onSetChildren().') : _prodInvariant('71') : void 0;
      if (nextChild.parentID == null) {
        nextChild.parentID = id;
        // TODO: This shouldn't be necessary but mounting a new root during in
        // componentWillMount currently causes not-yet-mounted components to
        // be purged from our tree data so their parent id is missing.
      }
      !(nextChild.parentID === id) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Expected onBeforeMountComponent() parent and onSetChildren() to be consistent (%s has parents %s and %s).', nextChildID, nextChild.parentID, id) : _prodInvariant('142', nextChildID, nextChild.parentID, id) : void 0;
    }
  },
  onBeforeMountComponent: function (id, element, parentID) {
    var item = {
      element: element,
      parentID: parentID,
      text: null,
      childIDs: [],
      isMounted: false,
      updateCount: 0
    };
    setItem(id, item);
  },
  onBeforeUpdateComponent: function (id, element) {
    var item = getItem(id);
    if (!item || !item.isMounted) {
      // We may end up here as a result of setState() in componentWillUnmount().
      // In this case, ignore the element.
      return;
    }
    item.element = element;
  },
  onMountComponent: function (id) {
    var item = getItem(id);
    !item ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Item must have been set') : _prodInvariant('144') : void 0;
    item.isMounted = true;
    var isRoot = item.parentID === 0;
    if (isRoot) {
      addRoot(id);
    }
  },
  onUpdateComponent: function (id) {
    var item = getItem(id);
    if (!item || !item.isMounted) {
      // We may end up here as a result of setState() in componentWillUnmount().
      // In this case, ignore the element.
      return;
    }
    item.updateCount++;
  },
  onUnmountComponent: function (id) {
    var item = getItem(id);
    if (item) {
      // We need to check if it exists.
      // `item` might not exist if it is inside an error boundary, and a sibling
      // error boundary child threw while mounting. Then this instance never
      // got a chance to mount, but it still gets an unmounting event during
      // the error boundary cleanup.
      item.isMounted = false;
      var isRoot = item.parentID === 0;
      if (isRoot) {
        removeRoot(id);
      }
    }
    unmountedIDs.push(id);
  },
  purgeUnmountedComponents: function () {
    if (ReactComponentTreeHook._preventPurging) {
      // Should only be used for testing.
      return;
    }

    for (var i = 0; i < unmountedIDs.length; i++) {
      var id = unmountedIDs[i];
      purgeDeep(id);
    }
    unmountedIDs.length = 0;
  },
  isMounted: function (id) {
    var item = getItem(id);
    return item ? item.isMounted : false;
  },
  getCurrentStackAddendum: function (topElement) {
    var info = '';
    if (topElement) {
      var name = getDisplayName(topElement);
      var owner = topElement._owner;
      info += describeComponentFrame(name, topElement._source, owner && owner.getName());
    }

    var currentOwner = ReactCurrentOwner.current;
    var id = currentOwner && currentOwner._debugID;

    info += ReactComponentTreeHook.getStackAddendumByID(id);
    return info;
  },
  getStackAddendumByID: function (id) {
    var info = '';
    while (id) {
      info += describeID(id);
      id = ReactComponentTreeHook.getParentID(id);
    }
    return info;
  },
  getChildIDs: function (id) {
    var item = getItem(id);
    return item ? item.childIDs : [];
  },
  getDisplayName: function (id) {
    var element = ReactComponentTreeHook.getElement(id);
    if (!element) {
      return null;
    }
    return getDisplayName(element);
  },
  getElement: function (id) {
    var item = getItem(id);
    return item ? item.element : null;
  },
  getOwnerID: function (id) {
    var element = ReactComponentTreeHook.getElement(id);
    if (!element || !element._owner) {
      return null;
    }
    return element._owner._debugID;
  },
  getParentID: function (id) {
    var item = getItem(id);
    return item ? item.parentID : null;
  },
  getSource: function (id) {
    var item = getItem(id);
    var element = item ? item.element : null;
    var source = element != null ? element._source : null;
    return source;
  },
  getText: function (id) {
    var element = ReactComponentTreeHook.getElement(id);
    if (typeof element === 'string') {
      return element;
    } else if (typeof element === 'number') {
      return '' + element;
    } else {
      return null;
    }
  },
  getUpdateCount: function (id) {
    var item = getItem(id);
    return item ? item.updateCount : 0;
  },


  getRootIDs: getRootIDs,
  getRegisteredIDs: getItemIDs,

  pushNonStandardWarningStack: function (isCreatingElement, currentSource) {
    if (typeof console.reactStack !== 'function') {
      return;
    }

    var stack = [];
    var currentOwner = ReactCurrentOwner.current;
    var id = currentOwner && currentOwner._debugID;

    try {
      if (isCreatingElement) {
        stack.push({
          name: id ? ReactComponentTreeHook.getDisplayName(id) : null,
          fileName: currentSource ? currentSource.fileName : null,
          lineNumber: currentSource ? currentSource.lineNumber : null
        });
      }

      while (id) {
        var element = ReactComponentTreeHook.getElement(id);
        var parentID = ReactComponentTreeHook.getParentID(id);
        var ownerID = ReactComponentTreeHook.getOwnerID(id);
        var ownerName = ownerID ? ReactComponentTreeHook.getDisplayName(ownerID) : null;
        var source = element && element._source;
        stack.push({
          name: ownerName,
          fileName: source ? source.fileName : null,
          lineNumber: source ? source.lineNumber : null
        });
        id = parentID;
      }
    } catch (err) {
      // Internal state is messed up.
      // Stop building the stack (it's just a nice to have).
    }

    console.reactStack(stack);
  },
  popNonStandardWarningStack: function () {
    if (typeof console.reactStackEnd !== 'function') {
      return;
    }
    console.reactStackEnd();
  }
};

module.exports = ReactComponentTreeHook;
}).call(this,require('_process'))

},{"./ReactCurrentOwner":44,"./reactProdInvariant":60,"_process":33,"fbjs/lib/invariant":30,"fbjs/lib/warning":31}],44:[function(require,module,exports){
/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * 
 */

'use strict';

/**
 * Keeps track of the current owner.
 *
 * The current owner is the component who should own any components that are
 * currently being constructed.
 */
var ReactCurrentOwner = {
  /**
   * @internal
   * @type {ReactComponent}
   */
  current: null
};

module.exports = ReactCurrentOwner;
},{}],45:[function(require,module,exports){
(function (process){
/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 */

'use strict';

var ReactElement = require('./ReactElement');

/**
 * Create a factory that creates HTML tag elements.
 *
 * @private
 */
var createDOMFactory = ReactElement.createFactory;
if (process.env.NODE_ENV !== 'production') {
  var ReactElementValidator = require('./ReactElementValidator');
  createDOMFactory = ReactElementValidator.createFactory;
}

/**
 * Creates a mapping from supported HTML tags to `ReactDOMComponent` classes.
 *
 * @public
 */
var ReactDOMFactories = {
  a: createDOMFactory('a'),
  abbr: createDOMFactory('abbr'),
  address: createDOMFactory('address'),
  area: createDOMFactory('area'),
  article: createDOMFactory('article'),
  aside: createDOMFactory('aside'),
  audio: createDOMFactory('audio'),
  b: createDOMFactory('b'),
  base: createDOMFactory('base'),
  bdi: createDOMFactory('bdi'),
  bdo: createDOMFactory('bdo'),
  big: createDOMFactory('big'),
  blockquote: createDOMFactory('blockquote'),
  body: createDOMFactory('body'),
  br: createDOMFactory('br'),
  button: createDOMFactory('button'),
  canvas: createDOMFactory('canvas'),
  caption: createDOMFactory('caption'),
  cite: createDOMFactory('cite'),
  code: createDOMFactory('code'),
  col: createDOMFactory('col'),
  colgroup: createDOMFactory('colgroup'),
  data: createDOMFactory('data'),
  datalist: createDOMFactory('datalist'),
  dd: createDOMFactory('dd'),
  del: createDOMFactory('del'),
  details: createDOMFactory('details'),
  dfn: createDOMFactory('dfn'),
  dialog: createDOMFactory('dialog'),
  div: createDOMFactory('div'),
  dl: createDOMFactory('dl'),
  dt: createDOMFactory('dt'),
  em: createDOMFactory('em'),
  embed: createDOMFactory('embed'),
  fieldset: createDOMFactory('fieldset'),
  figcaption: createDOMFactory('figcaption'),
  figure: createDOMFactory('figure'),
  footer: createDOMFactory('footer'),
  form: createDOMFactory('form'),
  h1: createDOMFactory('h1'),
  h2: createDOMFactory('h2'),
  h3: createDOMFactory('h3'),
  h4: createDOMFactory('h4'),
  h5: createDOMFactory('h5'),
  h6: createDOMFactory('h6'),
  head: createDOMFactory('head'),
  header: createDOMFactory('header'),
  hgroup: createDOMFactory('hgroup'),
  hr: createDOMFactory('hr'),
  html: createDOMFactory('html'),
  i: createDOMFactory('i'),
  iframe: createDOMFactory('iframe'),
  img: createDOMFactory('img'),
  input: createDOMFactory('input'),
  ins: createDOMFactory('ins'),
  kbd: createDOMFactory('kbd'),
  keygen: createDOMFactory('keygen'),
  label: createDOMFactory('label'),
  legend: createDOMFactory('legend'),
  li: createDOMFactory('li'),
  link: createDOMFactory('link'),
  main: createDOMFactory('main'),
  map: createDOMFactory('map'),
  mark: createDOMFactory('mark'),
  menu: createDOMFactory('menu'),
  menuitem: createDOMFactory('menuitem'),
  meta: createDOMFactory('meta'),
  meter: createDOMFactory('meter'),
  nav: createDOMFactory('nav'),
  noscript: createDOMFactory('noscript'),
  object: createDOMFactory('object'),
  ol: createDOMFactory('ol'),
  optgroup: createDOMFactory('optgroup'),
  option: createDOMFactory('option'),
  output: createDOMFactory('output'),
  p: createDOMFactory('p'),
  param: createDOMFactory('param'),
  picture: createDOMFactory('picture'),
  pre: createDOMFactory('pre'),
  progress: createDOMFactory('progress'),
  q: createDOMFactory('q'),
  rp: createDOMFactory('rp'),
  rt: createDOMFactory('rt'),
  ruby: createDOMFactory('ruby'),
  s: createDOMFactory('s'),
  samp: createDOMFactory('samp'),
  script: createDOMFactory('script'),
  section: createDOMFactory('section'),
  select: createDOMFactory('select'),
  small: createDOMFactory('small'),
  source: createDOMFactory('source'),
  span: createDOMFactory('span'),
  strong: createDOMFactory('strong'),
  style: createDOMFactory('style'),
  sub: createDOMFactory('sub'),
  summary: createDOMFactory('summary'),
  sup: createDOMFactory('sup'),
  table: createDOMFactory('table'),
  tbody: createDOMFactory('tbody'),
  td: createDOMFactory('td'),
  textarea: createDOMFactory('textarea'),
  tfoot: createDOMFactory('tfoot'),
  th: createDOMFactory('th'),
  thead: createDOMFactory('thead'),
  time: createDOMFactory('time'),
  title: createDOMFactory('title'),
  tr: createDOMFactory('tr'),
  track: createDOMFactory('track'),
  u: createDOMFactory('u'),
  ul: createDOMFactory('ul'),
  'var': createDOMFactory('var'),
  video: createDOMFactory('video'),
  wbr: createDOMFactory('wbr'),

  // SVG
  circle: createDOMFactory('circle'),
  clipPath: createDOMFactory('clipPath'),
  defs: createDOMFactory('defs'),
  ellipse: createDOMFactory('ellipse'),
  g: createDOMFactory('g'),
  image: createDOMFactory('image'),
  line: createDOMFactory('line'),
  linearGradient: createDOMFactory('linearGradient'),
  mask: createDOMFactory('mask'),
  path: createDOMFactory('path'),
  pattern: createDOMFactory('pattern'),
  polygon: createDOMFactory('polygon'),
  polyline: createDOMFactory('polyline'),
  radialGradient: createDOMFactory('radialGradient'),
  rect: createDOMFactory('rect'),
  stop: createDOMFactory('stop'),
  svg: createDOMFactory('svg'),
  text: createDOMFactory('text'),
  tspan: createDOMFactory('tspan')
};

module.exports = ReactDOMFactories;
}).call(this,require('_process'))

},{"./ReactElement":46,"./ReactElementValidator":48,"_process":33}],46:[function(require,module,exports){
(function (process){
/**
 * Copyright 2014-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 */

'use strict';

var _assign = require('object-assign');

var ReactCurrentOwner = require('./ReactCurrentOwner');

var warning = require('fbjs/lib/warning');
var canDefineProperty = require('./canDefineProperty');
var hasOwnProperty = Object.prototype.hasOwnProperty;

var REACT_ELEMENT_TYPE = require('./ReactElementSymbol');

var RESERVED_PROPS = {
  key: true,
  ref: true,
  __self: true,
  __source: true
};

var specialPropKeyWarningShown, specialPropRefWarningShown;

function hasValidRef(config) {
  if (process.env.NODE_ENV !== 'production') {
    if (hasOwnProperty.call(config, 'ref')) {
      var getter = Object.getOwnPropertyDescriptor(config, 'ref').get;
      if (getter && getter.isReactWarning) {
        return false;
      }
    }
  }
  return config.ref !== undefined;
}

function hasValidKey(config) {
  if (process.env.NODE_ENV !== 'production') {
    if (hasOwnProperty.call(config, 'key')) {
      var getter = Object.getOwnPropertyDescriptor(config, 'key').get;
      if (getter && getter.isReactWarning) {
        return false;
      }
    }
  }
  return config.key !== undefined;
}

function defineKeyPropWarningGetter(props, displayName) {
  var warnAboutAccessingKey = function () {
    if (!specialPropKeyWarningShown) {
      specialPropKeyWarningShown = true;
      process.env.NODE_ENV !== 'production' ? warning(false, '%s: `key` is not a prop. Trying to access it will result ' + 'in `undefined` being returned. If you need to access the same ' + 'value within the child component, you should pass it as a different ' + 'prop. (https://fb.me/react-special-props)', displayName) : void 0;
    }
  };
  warnAboutAccessingKey.isReactWarning = true;
  Object.defineProperty(props, 'key', {
    get: warnAboutAccessingKey,
    configurable: true
  });
}

function defineRefPropWarningGetter(props, displayName) {
  var warnAboutAccessingRef = function () {
    if (!specialPropRefWarningShown) {
      specialPropRefWarningShown = true;
      process.env.NODE_ENV !== 'production' ? warning(false, '%s: `ref` is not a prop. Trying to access it will result ' + 'in `undefined` being returned. If you need to access the same ' + 'value within the child component, you should pass it as a different ' + 'prop. (https://fb.me/react-special-props)', displayName) : void 0;
    }
  };
  warnAboutAccessingRef.isReactWarning = true;
  Object.defineProperty(props, 'ref', {
    get: warnAboutAccessingRef,
    configurable: true
  });
}

/**
 * Factory method to create a new React element. This no longer adheres to
 * the class pattern, so do not use new to call it. Also, no instanceof check
 * will work. Instead test $$typeof field against Symbol.for('react.element') to check
 * if something is a React Element.
 *
 * @param {*} type
 * @param {*} key
 * @param {string|object} ref
 * @param {*} self A *temporary* helper to detect places where `this` is
 * different from the `owner` when React.createElement is called, so that we
 * can warn. We want to get rid of owner and replace string `ref`s with arrow
 * functions, and as long as `this` and owner are the same, there will be no
 * change in behavior.
 * @param {*} source An annotation object (added by a transpiler or otherwise)
 * indicating filename, line number, and/or other information.
 * @param {*} owner
 * @param {*} props
 * @internal
 */
var ReactElement = function (type, key, ref, self, source, owner, props) {
  var element = {
    // This tag allow us to uniquely identify this as a React Element
    $$typeof: REACT_ELEMENT_TYPE,

    // Built-in properties that belong on the element
    type: type,
    key: key,
    ref: ref,
    props: props,

    // Record the component responsible for creating this element.
    _owner: owner
  };

  if (process.env.NODE_ENV !== 'production') {
    // The validation flag is currently mutative. We put it on
    // an external backing store so that we can freeze the whole object.
    // This can be replaced with a WeakMap once they are implemented in
    // commonly used development environments.
    element._store = {};

    // To make comparing ReactElements easier for testing purposes, we make
    // the validation flag non-enumerable (where possible, which should
    // include every environment we run tests in), so the test framework
    // ignores it.
    if (canDefineProperty) {
      Object.defineProperty(element._store, 'validated', {
        configurable: false,
        enumerable: false,
        writable: true,
        value: false
      });
      // self and source are DEV only properties.
      Object.defineProperty(element, '_self', {
        configurable: false,
        enumerable: false,
        writable: false,
        value: self
      });
      // Two elements created in two different places should be considered
      // equal for testing purposes and therefore we hide it from enumeration.
      Object.defineProperty(element, '_source', {
        configurable: false,
        enumerable: false,
        writable: false,
        value: source
      });
    } else {
      element._store.validated = false;
      element._self = self;
      element._source = source;
    }
    if (Object.freeze) {
      Object.freeze(element.props);
      Object.freeze(element);
    }
  }

  return element;
};

/**
 * Create and return a new ReactElement of the given type.
 * See https://facebook.github.io/react/docs/top-level-api.html#react.createelement
 */
ReactElement.createElement = function (type, config, children) {
  var propName;

  // Reserved names are extracted
  var props = {};

  var key = null;
  var ref = null;
  var self = null;
  var source = null;

  if (config != null) {
    if (hasValidRef(config)) {
      ref = config.ref;
    }
    if (hasValidKey(config)) {
      key = '' + config.key;
    }

    self = config.__self === undefined ? null : config.__self;
    source = config.__source === undefined ? null : config.__source;
    // Remaining properties are added to a new props object
    for (propName in config) {
      if (hasOwnProperty.call(config, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
        props[propName] = config[propName];
      }
    }
  }

  // Children can be more than one argument, and those are transferred onto
  // the newly allocated props object.
  var childrenLength = arguments.length - 2;
  if (childrenLength === 1) {
    props.children = children;
  } else if (childrenLength > 1) {
    var childArray = Array(childrenLength);
    for (var i = 0; i < childrenLength; i++) {
      childArray[i] = arguments[i + 2];
    }
    if (process.env.NODE_ENV !== 'production') {
      if (Object.freeze) {
        Object.freeze(childArray);
      }
    }
    props.children = childArray;
  }

  // Resolve default props
  if (type && type.defaultProps) {
    var defaultProps = type.defaultProps;
    for (propName in defaultProps) {
      if (props[propName] === undefined) {
        props[propName] = defaultProps[propName];
      }
    }
  }
  if (process.env.NODE_ENV !== 'production') {
    if (key || ref) {
      if (typeof props.$$typeof === 'undefined' || props.$$typeof !== REACT_ELEMENT_TYPE) {
        var displayName = typeof type === 'function' ? type.displayName || type.name || 'Unknown' : type;
        if (key) {
          defineKeyPropWarningGetter(props, displayName);
        }
        if (ref) {
          defineRefPropWarningGetter(props, displayName);
        }
      }
    }
  }
  return ReactElement(type, key, ref, self, source, ReactCurrentOwner.current, props);
};

/**
 * Return a function that produces ReactElements of a given type.
 * See https://facebook.github.io/react/docs/top-level-api.html#react.createfactory
 */
ReactElement.createFactory = function (type) {
  var factory = ReactElement.createElement.bind(null, type);
  // Expose the type on the factory and the prototype so that it can be
  // easily accessed on elements. E.g. `<Foo />.type === Foo`.
  // This should not be named `constructor` since this may not be the function
  // that created the element, and it may not even be a constructor.
  // Legacy hook TODO: Warn if this is accessed
  factory.type = type;
  return factory;
};

ReactElement.cloneAndReplaceKey = function (oldElement, newKey) {
  var newElement = ReactElement(oldElement.type, newKey, oldElement.ref, oldElement._self, oldElement._source, oldElement._owner, oldElement.props);

  return newElement;
};

/**
 * Clone and return a new ReactElement using element as the starting point.
 * See https://facebook.github.io/react/docs/top-level-api.html#react.cloneelement
 */
ReactElement.cloneElement = function (element, config, children) {
  var propName;

  // Original props are copied
  var props = _assign({}, element.props);

  // Reserved names are extracted
  var key = element.key;
  var ref = element.ref;
  // Self is preserved since the owner is preserved.
  var self = element._self;
  // Source is preserved since cloneElement is unlikely to be targeted by a
  // transpiler, and the original source is probably a better indicator of the
  // true owner.
  var source = element._source;

  // Owner will be preserved, unless ref is overridden
  var owner = element._owner;

  if (config != null) {
    if (hasValidRef(config)) {
      // Silently steal the ref from the parent.
      ref = config.ref;
      owner = ReactCurrentOwner.current;
    }
    if (hasValidKey(config)) {
      key = '' + config.key;
    }

    // Remaining properties override existing props
    var defaultProps;
    if (element.type && element.type.defaultProps) {
      defaultProps = element.type.defaultProps;
    }
    for (propName in config) {
      if (hasOwnProperty.call(config, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
        if (config[propName] === undefined && defaultProps !== undefined) {
          // Resolve default props
          props[propName] = defaultProps[propName];
        } else {
          props[propName] = config[propName];
        }
      }
    }
  }

  // Children can be more than one argument, and those are transferred onto
  // the newly allocated props object.
  var childrenLength = arguments.length - 2;
  if (childrenLength === 1) {
    props.children = children;
  } else if (childrenLength > 1) {
    var childArray = Array(childrenLength);
    for (var i = 0; i < childrenLength; i++) {
      childArray[i] = arguments[i + 2];
    }
    props.children = childArray;
  }

  return ReactElement(element.type, key, ref, self, source, owner, props);
};

/**
 * Verifies the object is a ReactElement.
 * See https://facebook.github.io/react/docs/top-level-api.html#react.isvalidelement
 * @param {?object} object
 * @return {boolean} True if `object` is a valid component.
 * @final
 */
ReactElement.isValidElement = function (object) {
  return typeof object === 'object' && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;
};

module.exports = ReactElement;
}).call(this,require('_process'))

},{"./ReactCurrentOwner":44,"./ReactElementSymbol":47,"./canDefineProperty":54,"_process":33,"fbjs/lib/warning":31,"object-assign":62}],47:[function(require,module,exports){
/**
 * Copyright 2014-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * 
 */

'use strict';

// The Symbol used to tag the ReactElement type. If there is no native Symbol
// nor polyfill, then a plain number is used for performance.

var REACT_ELEMENT_TYPE = typeof Symbol === 'function' && Symbol['for'] && Symbol['for']('react.element') || 0xeac7;

module.exports = REACT_ELEMENT_TYPE;
},{}],48:[function(require,module,exports){
(function (process){
/**
 * Copyright 2014-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 */

/**
 * ReactElementValidator provides a wrapper around a element factory
 * which validates the props passed to the element. This is intended to be
 * used only in DEV and could be replaced by a static type checker for languages
 * that support it.
 */

'use strict';

var ReactCurrentOwner = require('./ReactCurrentOwner');
var ReactComponentTreeHook = require('./ReactComponentTreeHook');
var ReactElement = require('./ReactElement');

var checkReactTypeSpec = require('./checkReactTypeSpec');

var canDefineProperty = require('./canDefineProperty');
var getIteratorFn = require('./getIteratorFn');
var warning = require('fbjs/lib/warning');
var lowPriorityWarning = require('./lowPriorityWarning');

function getDeclarationErrorAddendum() {
  if (ReactCurrentOwner.current) {
    var name = ReactCurrentOwner.current.getName();
    if (name) {
      return ' Check the render method of `' + name + '`.';
    }
  }
  return '';
}

function getSourceInfoErrorAddendum(elementProps) {
  if (elementProps !== null && elementProps !== undefined && elementProps.__source !== undefined) {
    var source = elementProps.__source;
    var fileName = source.fileName.replace(/^.*[\\\/]/, '');
    var lineNumber = source.lineNumber;
    return ' Check your code at ' + fileName + ':' + lineNumber + '.';
  }
  return '';
}

/**
 * Warn if there's no key explicitly set on dynamic arrays of children or
 * object keys are not valid. This allows us to keep track of children between
 * updates.
 */
var ownerHasKeyUseWarning = {};

function getCurrentComponentErrorInfo(parentType) {
  var info = getDeclarationErrorAddendum();

  if (!info) {
    var parentName = typeof parentType === 'string' ? parentType : parentType.displayName || parentType.name;
    if (parentName) {
      info = ' Check the top-level render call using <' + parentName + '>.';
    }
  }
  return info;
}

/**
 * Warn if the element doesn't have an explicit key assigned to it.
 * This element is in an array. The array could grow and shrink or be
 * reordered. All children that haven't already been validated are required to
 * have a "key" property assigned to it. Error statuses are cached so a warning
 * will only be shown once.
 *
 * @internal
 * @param {ReactElement} element Element that requires a key.
 * @param {*} parentType element's parent's type.
 */
function validateExplicitKey(element, parentType) {
  if (!element._store || element._store.validated || element.key != null) {
    return;
  }
  element._store.validated = true;

  var memoizer = ownerHasKeyUseWarning.uniqueKey || (ownerHasKeyUseWarning.uniqueKey = {});

  var currentComponentErrorInfo = getCurrentComponentErrorInfo(parentType);
  if (memoizer[currentComponentErrorInfo]) {
    return;
  }
  memoizer[currentComponentErrorInfo] = true;

  // Usually the current owner is the offender, but if it accepts children as a
  // property, it may be the creator of the child that's responsible for
  // assigning it a key.
  var childOwner = '';
  if (element && element._owner && element._owner !== ReactCurrentOwner.current) {
    // Give the component that originally created this child.
    childOwner = ' It was passed a child from ' + element._owner.getName() + '.';
  }

  process.env.NODE_ENV !== 'production' ? warning(false, 'Each child in an array or iterator should have a unique "key" prop.' + '%s%s See https://fb.me/react-warning-keys for more information.%s', currentComponentErrorInfo, childOwner, ReactComponentTreeHook.getCurrentStackAddendum(element)) : void 0;
}

/**
 * Ensure that every element either is passed in a static location, in an
 * array with an explicit keys property defined, or in an object literal
 * with valid key property.
 *
 * @internal
 * @param {ReactNode} node Statically passed child of any type.
 * @param {*} parentType node's parent's type.
 */
function validateChildKeys(node, parentType) {
  if (typeof node !== 'object') {
    return;
  }
  if (Array.isArray(node)) {
    for (var i = 0; i < node.length; i++) {
      var child = node[i];
      if (ReactElement.isValidElement(child)) {
        validateExplicitKey(child, parentType);
      }
    }
  } else if (ReactElement.isValidElement(node)) {
    // This element was passed in a valid location.
    if (node._store) {
      node._store.validated = true;
    }
  } else if (node) {
    var iteratorFn = getIteratorFn(node);
    // Entry iterators provide implicit keys.
    if (iteratorFn) {
      if (iteratorFn !== node.entries) {
        var iterator = iteratorFn.call(node);
        var step;
        while (!(step = iterator.next()).done) {
          if (ReactElement.isValidElement(step.value)) {
            validateExplicitKey(step.value, parentType);
          }
        }
      }
    }
  }
}

/**
 * Given an element, validate that its props follow the propTypes definition,
 * provided by the type.
 *
 * @param {ReactElement} element
 */
function validatePropTypes(element) {
  var componentClass = element.type;
  if (typeof componentClass !== 'function') {
    return;
  }
  var name = componentClass.displayName || componentClass.name;
  if (componentClass.propTypes) {
    checkReactTypeSpec(componentClass.propTypes, element.props, 'prop', name, element, null);
  }
  if (typeof componentClass.getDefaultProps === 'function') {
    process.env.NODE_ENV !== 'production' ? warning(componentClass.getDefaultProps.isReactClassApproved, 'getDefaultProps is only used on classic React.createClass ' + 'definitions. Use a static property named `defaultProps` instead.') : void 0;
  }
}

var ReactElementValidator = {
  createElement: function (type, props, children) {
    var validType = typeof type === 'string' || typeof type === 'function';
    // We warn in this case but don't throw. We expect the element creation to
    // succeed and there will likely be errors in render.
    if (!validType) {
      if (typeof type !== 'function' && typeof type !== 'string') {
        var info = '';
        if (type === undefined || typeof type === 'object' && type !== null && Object.keys(type).length === 0) {
          info += ' You likely forgot to export your component from the file ' + "it's defined in.";
        }

        var sourceInfo = getSourceInfoErrorAddendum(props);
        if (sourceInfo) {
          info += sourceInfo;
        } else {
          info += getDeclarationErrorAddendum();
        }

        info += ReactComponentTreeHook.getCurrentStackAddendum();

        var currentSource = props !== null && props !== undefined && props.__source !== undefined ? props.__source : null;
        ReactComponentTreeHook.pushNonStandardWarningStack(true, currentSource);
        process.env.NODE_ENV !== 'production' ? warning(false, 'React.createElement: type is invalid -- expected a string (for ' + 'built-in components) or a class/function (for composite ' + 'components) but got: %s.%s', type == null ? type : typeof type, info) : void 0;
        ReactComponentTreeHook.popNonStandardWarningStack();
      }
    }

    var element = ReactElement.createElement.apply(this, arguments);

    // The result can be nullish if a mock or a custom function is used.
    // TODO: Drop this when these are no longer allowed as the type argument.
    if (element == null) {
      return element;
    }

    // Skip key warning if the type isn't valid since our key validation logic
    // doesn't expect a non-string/function type and can throw confusing errors.
    // We don't want exception behavior to differ between dev and prod.
    // (Rendering will throw with a helpful message and as soon as the type is
    // fixed, the key warnings will appear.)
    if (validType) {
      for (var i = 2; i < arguments.length; i++) {
        validateChildKeys(arguments[i], type);
      }
    }

    validatePropTypes(element);

    return element;
  },

  createFactory: function (type) {
    var validatedFactory = ReactElementValidator.createElement.bind(null, type);
    // Legacy hook TODO: Warn if this is accessed
    validatedFactory.type = type;

    if (process.env.NODE_ENV !== 'production') {
      if (canDefineProperty) {
        Object.defineProperty(validatedFactory, 'type', {
          enumerable: false,
          get: function () {
            lowPriorityWarning(false, 'Factory.type is deprecated. Access the class directly ' + 'before passing it to createFactory.');
            Object.defineProperty(this, 'type', {
              value: type
            });
            return type;
          }
        });
      }
    }

    return validatedFactory;
  },

  cloneElement: function (element, props, children) {
    var newElement = ReactElement.cloneElement.apply(this, arguments);
    for (var i = 2; i < arguments.length; i++) {
      validateChildKeys(arguments[i], newElement.type);
    }
    validatePropTypes(newElement);
    return newElement;
  }
};

module.exports = ReactElementValidator;
}).call(this,require('_process'))

},{"./ReactComponentTreeHook":43,"./ReactCurrentOwner":44,"./ReactElement":46,"./canDefineProperty":54,"./checkReactTypeSpec":55,"./getIteratorFn":57,"./lowPriorityWarning":58,"_process":33,"fbjs/lib/warning":31}],49:[function(require,module,exports){
(function (process){
/**
 * Copyright 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 */

'use strict';

var warning = require('fbjs/lib/warning');

function warnNoop(publicInstance, callerName) {
  if (process.env.NODE_ENV !== 'production') {
    var constructor = publicInstance.constructor;
    process.env.NODE_ENV !== 'production' ? warning(false, '%s(...): Can only update a mounted or mounting component. ' + 'This usually means you called %s() on an unmounted component. ' + 'This is a no-op. Please check the code for the %s component.', callerName, callerName, constructor && (constructor.displayName || constructor.name) || 'ReactClass') : void 0;
  }
}

/**
 * This is the abstract API for an update queue.
 */
var ReactNoopUpdateQueue = {
  /**
   * Checks whether or not this composite component is mounted.
   * @param {ReactClass} publicInstance The instance we want to test.
   * @return {boolean} True if mounted, false otherwise.
   * @protected
   * @final
   */
  isMounted: function (publicInstance) {
    return false;
  },

  /**
   * Enqueue a callback that will be executed after all the pending updates
   * have processed.
   *
   * @param {ReactClass} publicInstance The instance to use as `this` context.
   * @param {?function} callback Called after state is updated.
   * @internal
   */
  enqueueCallback: function (publicInstance, callback) {},

  /**
   * Forces an update. This should only be invoked when it is known with
   * certainty that we are **not** in a DOM transaction.
   *
   * You may want to call this when you know that some deeper aspect of the
   * component's state has changed but `setState` was not called.
   *
   * This will not invoke `shouldComponentUpdate`, but it will invoke
   * `componentWillUpdate` and `componentDidUpdate`.
   *
   * @param {ReactClass} publicInstance The instance that should rerender.
   * @internal
   */
  enqueueForceUpdate: function (publicInstance) {
    warnNoop(publicInstance, 'forceUpdate');
  },

  /**
   * Replaces all of the state. Always use this or `setState` to mutate state.
   * You should treat `this.state` as immutable.
   *
   * There is no guarantee that `this.state` will be immediately updated, so
   * accessing `this.state` after calling this method may return the old value.
   *
   * @param {ReactClass} publicInstance The instance that should rerender.
   * @param {object} completeState Next state.
   * @internal
   */
  enqueueReplaceState: function (publicInstance, completeState) {
    warnNoop(publicInstance, 'replaceState');
  },

  /**
   * Sets a subset of the state. This only exists because _pendingState is
   * internal. This provides a merging strategy that is not available to deep
   * properties which is confusing. TODO: Expose pendingState or don't use it
   * during the merge.
   *
   * @param {ReactClass} publicInstance The instance that should rerender.
   * @param {object} partialState Next partial state to be merged with state.
   * @internal
   */
  enqueueSetState: function (publicInstance, partialState) {
    warnNoop(publicInstance, 'setState');
  }
};

module.exports = ReactNoopUpdateQueue;
}).call(this,require('_process'))

},{"_process":33,"fbjs/lib/warning":31}],50:[function(require,module,exports){
(function (process){
/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * 
 */

'use strict';

var ReactPropTypeLocationNames = {};

if (process.env.NODE_ENV !== 'production') {
  ReactPropTypeLocationNames = {
    prop: 'prop',
    context: 'context',
    childContext: 'child context'
  };
}

module.exports = ReactPropTypeLocationNames;
}).call(this,require('_process'))

},{"_process":33}],51:[function(require,module,exports){
/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 */

'use strict';

var _require = require('./ReactElement'),
    isValidElement = _require.isValidElement;

var factory = require('prop-types/factory');

module.exports = factory(isValidElement);
},{"./ReactElement":46,"prop-types/factory":35}],52:[function(require,module,exports){
/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * 
 */

'use strict';

var ReactPropTypesSecret = 'SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED';

module.exports = ReactPropTypesSecret;
},{}],53:[function(require,module,exports){
/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 */

'use strict';

module.exports = '15.6.1';
},{}],54:[function(require,module,exports){
(function (process){
/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * 
 */

'use strict';

var canDefineProperty = false;
if (process.env.NODE_ENV !== 'production') {
  try {
    // $FlowFixMe https://github.com/facebook/flow/issues/285
    Object.defineProperty({}, 'x', { get: function () {} });
    canDefineProperty = true;
  } catch (x) {
    // IE will fail on defineProperty
  }
}

module.exports = canDefineProperty;
}).call(this,require('_process'))

},{"_process":33}],55:[function(require,module,exports){
(function (process){
/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 */

'use strict';

var _prodInvariant = require('./reactProdInvariant');

var ReactPropTypeLocationNames = require('./ReactPropTypeLocationNames');
var ReactPropTypesSecret = require('./ReactPropTypesSecret');

var invariant = require('fbjs/lib/invariant');
var warning = require('fbjs/lib/warning');

var ReactComponentTreeHook;

if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
  // Temporary hack.
  // Inline requires don't work well with Jest:
  // https://github.com/facebook/react/issues/7240
  // Remove the inline requires when we don't need them anymore:
  // https://github.com/facebook/react/pull/7178
  ReactComponentTreeHook = require('./ReactComponentTreeHook');
}

var loggedTypeFailures = {};

/**
 * Assert that the values match with the type specs.
 * Error messages are memorized and will only be shown once.
 *
 * @param {object} typeSpecs Map of name to a ReactPropType
 * @param {object} values Runtime values that need to be type-checked
 * @param {string} location e.g. "prop", "context", "child context"
 * @param {string} componentName Name of the component for error messages.
 * @param {?object} element The React element that is being type-checked
 * @param {?number} debugID The React component instance that is being type-checked
 * @private
 */
function checkReactTypeSpec(typeSpecs, values, location, componentName, element, debugID) {
  for (var typeSpecName in typeSpecs) {
    if (typeSpecs.hasOwnProperty(typeSpecName)) {
      var error;
      // Prop type validation may throw. In case they do, we don't want to
      // fail the render phase where it didn't fail before. So we log it.
      // After these have been cleaned up, we'll let them throw.
      try {
        // This is intentionally an invariant that gets caught. It's the same
        // behavior as without this statement except with a better message.
        !(typeof typeSpecs[typeSpecName] === 'function') ? process.env.NODE_ENV !== 'production' ? invariant(false, '%s: %s type `%s` is invalid; it must be a function, usually from React.PropTypes.', componentName || 'React class', ReactPropTypeLocationNames[location], typeSpecName) : _prodInvariant('84', componentName || 'React class', ReactPropTypeLocationNames[location], typeSpecName) : void 0;
        error = typeSpecs[typeSpecName](values, typeSpecName, componentName, location, null, ReactPropTypesSecret);
      } catch (ex) {
        error = ex;
      }
      process.env.NODE_ENV !== 'production' ? warning(!error || error instanceof Error, '%s: type specification of %s `%s` is invalid; the type checker ' + 'function must return `null` or an `Error` but returned a %s. ' + 'You may have forgotten to pass an argument to the type checker ' + 'creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and ' + 'shape all require an argument).', componentName || 'React class', ReactPropTypeLocationNames[location], typeSpecName, typeof error) : void 0;
      if (error instanceof Error && !(error.message in loggedTypeFailures)) {
        // Only monitor this failure once because there tends to be a lot of the
        // same error.
        loggedTypeFailures[error.message] = true;

        var componentStackInfo = '';

        if (process.env.NODE_ENV !== 'production') {
          if (!ReactComponentTreeHook) {
            ReactComponentTreeHook = require('./ReactComponentTreeHook');
          }
          if (debugID !== null) {
            componentStackInfo = ReactComponentTreeHook.getStackAddendumByID(debugID);
          } else if (element !== null) {
            componentStackInfo = ReactComponentTreeHook.getCurrentStackAddendum(element);
          }
        }

        process.env.NODE_ENV !== 'production' ? warning(false, 'Failed %s type: %s%s', location, error.message, componentStackInfo) : void 0;
      }
    }
  }
}

module.exports = checkReactTypeSpec;
}).call(this,require('_process'))

},{"./ReactComponentTreeHook":43,"./ReactPropTypeLocationNames":50,"./ReactPropTypesSecret":52,"./reactProdInvariant":60,"_process":33,"fbjs/lib/invariant":30,"fbjs/lib/warning":31}],56:[function(require,module,exports){
/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 */

'use strict';

var _require = require('./ReactBaseClasses'),
    Component = _require.Component;

var _require2 = require('./ReactElement'),
    isValidElement = _require2.isValidElement;

var ReactNoopUpdateQueue = require('./ReactNoopUpdateQueue');
var factory = require('create-react-class/factory');

module.exports = factory(Component, isValidElement, ReactNoopUpdateQueue);
},{"./ReactBaseClasses":41,"./ReactElement":46,"./ReactNoopUpdateQueue":49,"create-react-class/factory":26}],57:[function(require,module,exports){
/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * 
 */

'use strict';

/* global Symbol */

var ITERATOR_SYMBOL = typeof Symbol === 'function' && Symbol.iterator;
var FAUX_ITERATOR_SYMBOL = '@@iterator'; // Before Symbol spec.

/**
 * Returns the iterator method function contained on the iterable object.
 *
 * Be sure to invoke the function with the iterable as context:
 *
 *     var iteratorFn = getIteratorFn(myIterable);
 *     if (iteratorFn) {
 *       var iterator = iteratorFn.call(myIterable);
 *       ...
 *     }
 *
 * @param {?object} maybeIterable
 * @return {?function}
 */
function getIteratorFn(maybeIterable) {
  var iteratorFn = maybeIterable && (ITERATOR_SYMBOL && maybeIterable[ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL]);
  if (typeof iteratorFn === 'function') {
    return iteratorFn;
  }
}

module.exports = getIteratorFn;
},{}],58:[function(require,module,exports){
(function (process){
/**
 * Copyright 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 */

'use strict';

/**
 * Forked from fbjs/warning:
 * https://github.com/facebook/fbjs/blob/e66ba20ad5be433eb54423f2b097d829324d9de6/packages/fbjs/src/__forks__/warning.js
 *
 * Only change is we use console.warn instead of console.error,
 * and do nothing when 'console' is not supported.
 * This really simplifies the code.
 * ---
 * Similar to invariant but only logs a warning if the condition is not met.
 * This can be used to log issues in development environments in critical
 * paths. Removing the logging code for production environments will keep the
 * same logic and follow the same code paths.
 */

var lowPriorityWarning = function () {};

if (process.env.NODE_ENV !== 'production') {
  var printWarning = function (format) {
    for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }

    var argIndex = 0;
    var message = 'Warning: ' + format.replace(/%s/g, function () {
      return args[argIndex++];
    });
    if (typeof console !== 'undefined') {
      console.warn(message);
    }
    try {
      // --- Welcome to debugging React ---
      // This error was thrown as a convenience so that you can use this stack
      // to find the callsite that caused this warning to fire.
      throw new Error(message);
    } catch (x) {}
  };

  lowPriorityWarning = function (condition, format) {
    if (format === undefined) {
      throw new Error('`warning(condition, format, ...args)` requires a warning ' + 'message argument');
    }
    if (!condition) {
      for (var _len2 = arguments.length, args = Array(_len2 > 2 ? _len2 - 2 : 0), _key2 = 2; _key2 < _len2; _key2++) {
        args[_key2 - 2] = arguments[_key2];
      }

      printWarning.apply(undefined, [format].concat(args));
    }
  };
}

module.exports = lowPriorityWarning;
}).call(this,require('_process'))

},{"_process":33}],59:[function(require,module,exports){
(function (process){
/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 */
'use strict';

var _prodInvariant = require('./reactProdInvariant');

var ReactElement = require('./ReactElement');

var invariant = require('fbjs/lib/invariant');

/**
 * Returns the first child in a collection of children and verifies that there
 * is only one child in the collection.
 *
 * See https://facebook.github.io/react/docs/top-level-api.html#react.children.only
 *
 * The current implementation of this function assumes that a single child gets
 * passed without a wrapper, but the purpose of this helper function is to
 * abstract away the particular structure of children.
 *
 * @param {?object} children Child collection structure.
 * @return {ReactElement} The first and only `ReactElement` contained in the
 * structure.
 */
function onlyChild(children) {
  !ReactElement.isValidElement(children) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'React.Children.only expected to receive a single React element child.') : _prodInvariant('143') : void 0;
  return children;
}

module.exports = onlyChild;
}).call(this,require('_process'))

},{"./ReactElement":46,"./reactProdInvariant":60,"_process":33,"fbjs/lib/invariant":30}],60:[function(require,module,exports){
/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * 
 */
'use strict';

/**
 * WARNING: DO NOT manually require this module.
 * This is a replacement for `invariant(...)` used by the error code system
 * and will _only_ be required by the corresponding babel pass.
 * It always throws.
 */

function reactProdInvariant(code) {
  var argCount = arguments.length - 1;

  var message = 'Minified React error #' + code + '; visit ' + 'http://facebook.github.io/react/docs/error-decoder.html?invariant=' + code;

  for (var argIdx = 0; argIdx < argCount; argIdx++) {
    message += '&args[]=' + encodeURIComponent(arguments[argIdx + 1]);
  }

  message += ' for the full message or use the non-minified dev environment' + ' for full errors and additional helpful warnings.';

  var error = new Error(message);
  error.name = 'Invariant Violation';
  error.framesToPop = 1; // we don't care about reactProdInvariant's own frame

  throw error;
}

module.exports = reactProdInvariant;
},{}],61:[function(require,module,exports){
(function (process){
/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 */

'use strict';

var _prodInvariant = require('./reactProdInvariant');

var ReactCurrentOwner = require('./ReactCurrentOwner');
var REACT_ELEMENT_TYPE = require('./ReactElementSymbol');

var getIteratorFn = require('./getIteratorFn');
var invariant = require('fbjs/lib/invariant');
var KeyEscapeUtils = require('./KeyEscapeUtils');
var warning = require('fbjs/lib/warning');

var SEPARATOR = '.';
var SUBSEPARATOR = ':';

/**
 * This is inlined from ReactElement since this file is shared between
 * isomorphic and renderers. We could extract this to a
 *
 */

/**
 * TODO: Test that a single child and an array with one item have the same key
 * pattern.
 */

var didWarnAboutMaps = false;

/**
 * Generate a key string that identifies a component within a set.
 *
 * @param {*} component A component that could contain a manual key.
 * @param {number} index Index that is used if a manual key is not provided.
 * @return {string}
 */
function getComponentKey(component, index) {
  // Do some typechecking here since we call this blindly. We want to ensure
  // that we don't block potential future ES APIs.
  if (component && typeof component === 'object' && component.key != null) {
    // Explicit key
    return KeyEscapeUtils.escape(component.key);
  }
  // Implicit key determined by the index in the set
  return index.toString(36);
}

/**
 * @param {?*} children Children tree container.
 * @param {!string} nameSoFar Name of the key path so far.
 * @param {!function} callback Callback to invoke with each child found.
 * @param {?*} traverseContext Used to pass information throughout the traversal
 * process.
 * @return {!number} The number of children in this subtree.
 */
function traverseAllChildrenImpl(children, nameSoFar, callback, traverseContext) {
  var type = typeof children;

  if (type === 'undefined' || type === 'boolean') {
    // All of the above are perceived as null.
    children = null;
  }

  if (children === null || type === 'string' || type === 'number' ||
  // The following is inlined from ReactElement. This means we can optimize
  // some checks. React Fiber also inlines this logic for similar purposes.
  type === 'object' && children.$$typeof === REACT_ELEMENT_TYPE) {
    callback(traverseContext, children,
    // If it's the only child, treat the name as if it was wrapped in an array
    // so that it's consistent if the number of children grows.
    nameSoFar === '' ? SEPARATOR + getComponentKey(children, 0) : nameSoFar);
    return 1;
  }

  var child;
  var nextName;
  var subtreeCount = 0; // Count of children found in the current subtree.
  var nextNamePrefix = nameSoFar === '' ? SEPARATOR : nameSoFar + SUBSEPARATOR;

  if (Array.isArray(children)) {
    for (var i = 0; i < children.length; i++) {
      child = children[i];
      nextName = nextNamePrefix + getComponentKey(child, i);
      subtreeCount += traverseAllChildrenImpl(child, nextName, callback, traverseContext);
    }
  } else {
    var iteratorFn = getIteratorFn(children);
    if (iteratorFn) {
      var iterator = iteratorFn.call(children);
      var step;
      if (iteratorFn !== children.entries) {
        var ii = 0;
        while (!(step = iterator.next()).done) {
          child = step.value;
          nextName = nextNamePrefix + getComponentKey(child, ii++);
          subtreeCount += traverseAllChildrenImpl(child, nextName, callback, traverseContext);
        }
      } else {
        if (process.env.NODE_ENV !== 'production') {
          var mapsAsChildrenAddendum = '';
          if (ReactCurrentOwner.current) {
            var mapsAsChildrenOwnerName = ReactCurrentOwner.current.getName();
            if (mapsAsChildrenOwnerName) {
              mapsAsChildrenAddendum = ' Check the render method of `' + mapsAsChildrenOwnerName + '`.';
            }
          }
          process.env.NODE_ENV !== 'production' ? warning(didWarnAboutMaps, 'Using Maps as children is not yet fully supported. It is an ' + 'experimental feature that might be removed. Convert it to a ' + 'sequence / iterable of keyed ReactElements instead.%s', mapsAsChildrenAddendum) : void 0;
          didWarnAboutMaps = true;
        }
        // Iterator will provide entry [k,v] tuples rather than values.
        while (!(step = iterator.next()).done) {
          var entry = step.value;
          if (entry) {
            child = entry[1];
            nextName = nextNamePrefix + KeyEscapeUtils.escape(entry[0]) + SUBSEPARATOR + getComponentKey(child, 0);
            subtreeCount += traverseAllChildrenImpl(child, nextName, callback, traverseContext);
          }
        }
      }
    } else if (type === 'object') {
      var addendum = '';
      if (process.env.NODE_ENV !== 'production') {
        addendum = ' If you meant to render a collection of children, use an array ' + 'instead or wrap the object using createFragment(object) from the ' + 'React add-ons.';
        if (children._isReactElement) {
          addendum = " It looks like you're using an element created by a different " + 'version of React. Make sure to use only one copy of React.';
        }
        if (ReactCurrentOwner.current) {
          var name = ReactCurrentOwner.current.getName();
          if (name) {
            addendum += ' Check the render method of `' + name + '`.';
          }
        }
      }
      var childrenString = String(children);
      !false ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Objects are not valid as a React child (found: %s).%s', childrenString === '[object Object]' ? 'object with keys {' + Object.keys(children).join(', ') + '}' : childrenString, addendum) : _prodInvariant('31', childrenString === '[object Object]' ? 'object with keys {' + Object.keys(children).join(', ') + '}' : childrenString, addendum) : void 0;
    }
  }

  return subtreeCount;
}

/**
 * Traverses children that are typically specified as `props.children`, but
 * might also be specified through attributes:
 *
 * - `traverseAllChildren(this.props.children, ...)`
 * - `traverseAllChildren(this.props.leftPanelChildren, ...)`
 *
 * The `traverseContext` is an optional argument that is passed through the
 * entire traversal. It can be used to store accumulations or anything else that
 * the callback might find relevant.
 *
 * @param {?*} children Children tree object.
 * @param {!function} callback To invoke upon traversing each child.
 * @param {?*} traverseContext Context for traversal.
 * @return {!number} The number of children in this subtree.
 */
function traverseAllChildren(children, callback, traverseContext) {
  if (children == null) {
    return 0;
  }

  return traverseAllChildrenImpl(children, '', callback, traverseContext);
}

module.exports = traverseAllChildren;
}).call(this,require('_process'))

},{"./KeyEscapeUtils":38,"./ReactCurrentOwner":44,"./ReactElementSymbol":47,"./getIteratorFn":57,"./reactProdInvariant":60,"_process":33,"fbjs/lib/invariant":30,"fbjs/lib/warning":31}],62:[function(require,module,exports){
arguments[4][27][0].apply(exports,arguments)
},{"dup":27}],63:[function(require,module,exports){
'use strict';

module.exports = require('./lib/React');

},{"./lib/React":40}],64:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var DynamicSearch = function (_Component) {
    _inherits(DynamicSearch, _Component);

    function DynamicSearch(props) {
        _classCallCheck(this, DynamicSearch);

        return _possibleConstructorReturn(this, (DynamicSearch.__proto__ || Object.getPrototypeOf(DynamicSearch)).call(this, props));
    }

    _createClass(DynamicSearch, [{
        key: 'getInitialState',
        value: function getInitialState() {
            return { searchString: '' };
        }
    }, {
        key: 'handleChange',
        value: function handleChange() {
            this.setState({ searchString: event.target.value });
        }
    }, {
        key: 'render',
        value: function render() {
            var countries = this.props.items;
            var searchString = this.state.searchString.trim().toLowerCase();
            // filter countries list by value from input box
            if (searchString.length > 0) {
                countries = countries.filter(function (country) {
                    return country.name.toLowerCase().match(searchString);
                });
            }

            return _react2.default.createElement(
                'div',
                { className: 'search-component' },
                _react2.default.createElement('input', { type: 'text', value: this.state.searchString, onChange: this.handleChange, placeholder: 'Search!' }),
                _react2.default.createElement(
                    'ul',
                    null,
                    countries.map(function (country) {
                        return _react2.default.createElement(
                            'li',
                            null,
                            country.name,
                            ' '
                        );
                    })
                )
            );
        }
    }]);

    return DynamicSearch;
}(_react.Component);

exports.default = DynamicSearch;

},{"react":63}],65:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require("react");

var _react2 = _interopRequireDefault(_react);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Nav = function (_Component) {
    _inherits(Nav, _Component);

    function Nav(props) {
        _classCallCheck(this, Nav);

        return _possibleConstructorReturn(this, (Nav.__proto__ || Object.getPrototypeOf(Nav)).call(this, props));
        // this.testGet();
    }

    _createClass(Nav, [{
        key: "render",
        value: function render() {
            return _react2.default.createElement(
                "nav",
                { id: "mainNav", className: "navbar navbar-default navbar-fixed-top navbar-custom" },
                _react2.default.createElement(
                    "div",
                    { className: "container" },
                    _react2.default.createElement(
                        "div",
                        { className: "navbar-header page-scroll" },
                        _react2.default.createElement(
                            "button",
                            { type: "button", className: "navbar-toggle", "data-toggle": "collapse", "data-target": "#bs-example-navbar-collapse-1" },
                            _react2.default.createElement(
                                "span",
                                { className: "sr-only" },
                                "Toggle navigation"
                            ),
                            " Menu ",
                            _react2.default.createElement("i", { className: "fa fa-bars" })
                        ),
                        _react2.default.createElement(
                            "a",
                            { className: "navbar-brand", href: "/" },
                            "Imgrab"
                        )
                    ),
                    _react2.default.createElement(
                        "div",
                        { className: "collapse navbar-collapse", id: "bs-example-navbar-collapse-1" },
                        _react2.default.createElement(
                            "ul",
                            { className: "nav navbar-nav navbar-right" },
                            _react2.default.createElement(
                                "li",
                                { className: "hidden" },
                                _react2.default.createElement("a", { href: "#page-top" })
                            ),
                            _react2.default.createElement(
                                "li",
                                { className: "page-scroll" },
                                _react2.default.createElement(
                                    "a",
                                    { href: "/images" },
                                    "My Images"
                                )
                            ),
                            _react2.default.createElement(
                                "li",
                                { className: "page-scroll" },
                                _react2.default.createElement(
                                    "a",
                                    { href: "#" },
                                    "Help"
                                )
                            ),
                            _react2.default.createElement(
                                "li",
                                { className: "page-scroll" },
                                _react2.default.createElement(
                                    "a",
                                    { href: "#" },
                                    "Contact"
                                )
                            )
                        )
                    )
                )
            );
        }
    }]);

    return Nav;
}(_react.Component);

;

exports.default = Nav;

},{"react":63}],66:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require("react");

var _react2 = _interopRequireDefault(_react);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var PageContainer = function (_Component) {
  _inherits(PageContainer, _Component);

  function PageContainer() {
    _classCallCheck(this, PageContainer);

    return _possibleConstructorReturn(this, (PageContainer.__proto__ || Object.getPrototypeOf(PageContainer)).apply(this, arguments));
  }

  _createClass(PageContainer, [{
    key: "render",
    value: function render() {
      return _react2.default.createElement(
        "div",
        { className: "page-container" },
        this.props.children
      );
    }
  }]);

  return PageContainer;
}(_react.Component);

exports.default = PageContainer;

},{"react":63}],67:[function(require,module,exports){
'use strict';

var _axios = require('axios');

var _axios2 = _interopRequireDefault(_axios);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _nav = require('./components/nav');

var _nav2 = _interopRequireDefault(_nav);

var _dynamic_search = require('./components/dynamic_search');

var _dynamic_search2 = _interopRequireDefault(_dynamic_search);

var _page_container = require('./components/page_container');

var _page_container2 = _interopRequireDefault(_page_container);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var countries = [{ "name": "Sweden" }, { "name": "China" }, { "name": "Peru" }, { "name": "Czech Republic" }, { "name": "Bolivia" }, { "name": "Latvia" }, { "name": "Samoa" }, { "name": "Armenia" }, { "name": "Greenland" }, { "name": "Cuba" }, { "name": "Western Sahara" }, { "name": "Ethiopia" }, { "name": "Malaysia" }, { "name": "Argentina" }, { "name": "Uganda" }, { "name": "Chile" }, { "name": "Aruba" }, { "name": "Japan" }, { "name": "Trinidad and Tobago" }, { "name": "Italy" }, { "name": "Cambodia" }, { "name": "Iceland" }, { "name": "Dominican Republic" }, { "name": "Turkey" }, { "name": "Spain" }, { "name": "Poland" }, { "name": "Haiti" }];

var MainContent = _react2.default.createElement(
  'div',
  null,
  _react2.default.createElement(_nav2.default, null),
  _react2.default.createElement(
    _page_container2.default,
    null,
    _react2.default.createElement(_dynamic_search2.default, { items: countries })
  )
);

ReactDOM.render(MainContent, document.getElementById("app-container"));

},{"./components/dynamic_search":64,"./components/nav":65,"./components/page_container":66,"axios":1,"react":63}]},{},[67])

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvaW5kZXguanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2FkYXB0ZXJzL3hoci5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvYXhpb3MuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2NhbmNlbC9DYW5jZWwuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2NhbmNlbC9DYW5jZWxUb2tlbi5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvY2FuY2VsL2lzQ2FuY2VsLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9jb3JlL0F4aW9zLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9jb3JlL0ludGVyY2VwdG9yTWFuYWdlci5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvY29yZS9jcmVhdGVFcnJvci5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvY29yZS9kaXNwYXRjaFJlcXVlc3QuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2NvcmUvZW5oYW5jZUVycm9yLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9jb3JlL3NldHRsZS5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvY29yZS90cmFuc2Zvcm1EYXRhLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9kZWZhdWx0cy5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvaGVscGVycy9iaW5kLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9oZWxwZXJzL2J0b2EuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2hlbHBlcnMvYnVpbGRVUkwuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2hlbHBlcnMvY29tYmluZVVSTHMuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2hlbHBlcnMvY29va2llcy5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvaGVscGVycy9pc0Fic29sdXRlVVJMLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9oZWxwZXJzL2lzVVJMU2FtZU9yaWdpbi5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvaGVscGVycy9ub3JtYWxpemVIZWFkZXJOYW1lLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9oZWxwZXJzL3BhcnNlSGVhZGVycy5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvaGVscGVycy9zcHJlYWQuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL3V0aWxzLmpzIiwibm9kZV9tb2R1bGVzL2NyZWF0ZS1yZWFjdC1jbGFzcy9mYWN0b3J5LmpzIiwibm9kZV9tb2R1bGVzL2NyZWF0ZS1yZWFjdC1jbGFzcy9ub2RlX21vZHVsZXMvb2JqZWN0LWFzc2lnbi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9mYmpzL2xpYi9lbXB0eUZ1bmN0aW9uLmpzIiwibm9kZV9tb2R1bGVzL2ZianMvbGliL2VtcHR5T2JqZWN0LmpzIiwibm9kZV9tb2R1bGVzL2ZianMvbGliL2ludmFyaWFudC5qcyIsIm5vZGVfbW9kdWxlcy9mYmpzL2xpYi93YXJuaW5nLmpzIiwibm9kZV9tb2R1bGVzL2lzLWJ1ZmZlci9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvcHJvcC10eXBlcy9jaGVja1Byb3BUeXBlcy5qcyIsIm5vZGVfbW9kdWxlcy9wcm9wLXR5cGVzL2ZhY3RvcnkuanMiLCJub2RlX21vZHVsZXMvcHJvcC10eXBlcy9mYWN0b3J5V2l0aFR5cGVDaGVja2Vycy5qcyIsIm5vZGVfbW9kdWxlcy9wcm9wLXR5cGVzL2xpYi9SZWFjdFByb3BUeXBlc1NlY3JldC5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9saWIvS2V5RXNjYXBlVXRpbHMuanMiLCJub2RlX21vZHVsZXMvcmVhY3QvbGliL1Bvb2xlZENsYXNzLmpzIiwibm9kZV9tb2R1bGVzL3JlYWN0L2xpYi9SZWFjdC5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9saWIvUmVhY3RCYXNlQ2xhc3Nlcy5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9saWIvUmVhY3RDaGlsZHJlbi5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9saWIvUmVhY3RDb21wb25lbnRUcmVlSG9vay5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9saWIvUmVhY3RDdXJyZW50T3duZXIuanMiLCJub2RlX21vZHVsZXMvcmVhY3QvbGliL1JlYWN0RE9NRmFjdG9yaWVzLmpzIiwibm9kZV9tb2R1bGVzL3JlYWN0L2xpYi9SZWFjdEVsZW1lbnQuanMiLCJub2RlX21vZHVsZXMvcmVhY3QvbGliL1JlYWN0RWxlbWVudFN5bWJvbC5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9saWIvUmVhY3RFbGVtZW50VmFsaWRhdG9yLmpzIiwibm9kZV9tb2R1bGVzL3JlYWN0L2xpYi9SZWFjdE5vb3BVcGRhdGVRdWV1ZS5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9saWIvUmVhY3RQcm9wVHlwZUxvY2F0aW9uTmFtZXMuanMiLCJub2RlX21vZHVsZXMvcmVhY3QvbGliL1JlYWN0UHJvcFR5cGVzLmpzIiwibm9kZV9tb2R1bGVzL3JlYWN0L2xpYi9SZWFjdFByb3BUeXBlc1NlY3JldC5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9saWIvUmVhY3RWZXJzaW9uLmpzIiwibm9kZV9tb2R1bGVzL3JlYWN0L2xpYi9jYW5EZWZpbmVQcm9wZXJ0eS5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9saWIvY2hlY2tSZWFjdFR5cGVTcGVjLmpzIiwibm9kZV9tb2R1bGVzL3JlYWN0L2xpYi9jcmVhdGVDbGFzcy5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9saWIvZ2V0SXRlcmF0b3JGbi5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9saWIvbG93UHJpb3JpdHlXYXJuaW5nLmpzIiwibm9kZV9tb2R1bGVzL3JlYWN0L2xpYi9vbmx5Q2hpbGQuanMiLCJub2RlX21vZHVsZXMvcmVhY3QvbGliL3JlYWN0UHJvZEludmFyaWFudC5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9saWIvdHJhdmVyc2VBbGxDaGlsZHJlbi5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9yZWFjdC5qcyIsInByb2plY3Qvc3RhdGljL3NjcmlwdHMvanN4L2NvbXBvbmVudHMvZHluYW1pY19zZWFyY2guanMiLCJwcm9qZWN0L3N0YXRpYy9zY3JpcHRzL2pzeC9jb21wb25lbnRzL25hdi5qcyIsInByb2plY3Qvc3RhdGljL3NjcmlwdHMvanN4L2NvbXBvbmVudHMvcGFnZV9jb250YWluZXIuanMiLCJwcm9qZWN0L3N0YXRpYy9zY3JpcHRzL2pzeC9tYWluLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7OztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDcExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDNUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQy9TQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUN4MkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNyQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ3REQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQy9EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDeExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM3REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNoZ0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDekRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUM5R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNsSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM3SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzdMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUN6WEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDdktBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDblZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUM3UEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDN0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3ZCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUN4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3JGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3ZDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUMvREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7QUM5S0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7Ozs7QUNIQTs7Ozs7Ozs7Ozs7O0lBRU8sYTs7O0FBRUgsMkJBQVksS0FBWixFQUFrQjtBQUFBOztBQUFBLDZIQUNSLEtBRFE7QUFFakI7Ozs7MENBRWdCO0FBQ2IsbUJBQU8sRUFBRSxjQUFjLEVBQWhCLEVBQVA7QUFDSDs7O3VDQUVhO0FBQ1YsaUJBQUssUUFBTCxDQUFjLEVBQUMsY0FBYSxNQUFNLE1BQU4sQ0FBYSxLQUEzQixFQUFkO0FBQ0g7OztpQ0FFTztBQUNSLGdCQUFJLFlBQVksS0FBSyxLQUFMLENBQVcsS0FBM0I7QUFDQSxnQkFBSSxlQUFlLEtBQUssS0FBTCxDQUFXLFlBQVgsQ0FBd0IsSUFBeEIsR0FBK0IsV0FBL0IsRUFBbkI7QUFDQTtBQUNBLGdCQUFHLGFBQWEsTUFBYixHQUFzQixDQUF6QixFQUEyQjtBQUN2Qiw0QkFBWSxVQUFVLE1BQVYsQ0FBaUIsVUFBUyxPQUFULEVBQWlCO0FBQzlDLDJCQUFPLFFBQVEsSUFBUixDQUFhLFdBQWIsR0FBMkIsS0FBM0IsQ0FBa0MsWUFBbEMsQ0FBUDtBQUNDLGlCQUZXLENBQVo7QUFHSDs7QUFFRCxtQkFDSTtBQUFBO0FBQUEsa0JBQUssV0FBVSxrQkFBZjtBQUNBLHlEQUFPLE1BQUssTUFBWixFQUFtQixPQUFPLEtBQUssS0FBTCxDQUFXLFlBQXJDLEVBQW1ELFVBQVUsS0FBSyxZQUFsRSxFQUFnRixhQUFZLFNBQTVGLEdBREE7QUFFQTtBQUFBO0FBQUE7QUFDTSw4QkFBVSxHQUFWLENBQWMsVUFBUyxPQUFULEVBQWlCO0FBQUUsK0JBQU87QUFBQTtBQUFBO0FBQUssb0NBQVEsSUFBYjtBQUFBO0FBQUEseUJBQVA7QUFBaUMscUJBQWxFO0FBRE47QUFGQSxhQURKO0FBT0U7Ozs7OztrQkFJVSxhOzs7Ozs7Ozs7OztBQ3JDaEI7Ozs7Ozs7Ozs7OztJQUdNLEc7OztBQUVGLGlCQUFZLEtBQVosRUFBa0I7QUFBQTs7QUFBQSx5R0FDWixLQURZO0FBRWxCO0FBQ0M7Ozs7aUNBRU87QUFDUixtQkFDSTtBQUFBO0FBQUEsa0JBQUssSUFBRyxTQUFSLEVBQWtCLFdBQVUsc0RBQTVCO0FBQ0E7QUFBQTtBQUFBLHNCQUFLLFdBQVUsV0FBZjtBQUNJO0FBQUE7QUFBQSwwQkFBSyxXQUFVLDJCQUFmO0FBQ0E7QUFBQTtBQUFBLDhCQUFRLE1BQUssUUFBYixFQUFzQixXQUFVLGVBQWhDLEVBQWdELGVBQVksVUFBNUQsRUFBdUUsZUFBWSwrQkFBbkY7QUFDSTtBQUFBO0FBQUEsa0NBQU0sV0FBVSxTQUFoQjtBQUFBO0FBQUEsNkJBREo7QUFBQTtBQUM0RCxpRUFBRyxXQUFVLFlBQWI7QUFENUQseUJBREE7QUFJQTtBQUFBO0FBQUEsOEJBQUcsV0FBVSxjQUFiLEVBQTRCLE1BQUssR0FBakM7QUFBQTtBQUFBO0FBSkEscUJBREo7QUFPSTtBQUFBO0FBQUEsMEJBQUssV0FBVSwwQkFBZixFQUEwQyxJQUFHLDhCQUE3QztBQUNBO0FBQUE7QUFBQSw4QkFBSSxXQUFVLDZCQUFkO0FBQ0k7QUFBQTtBQUFBLGtDQUFJLFdBQVUsUUFBZDtBQUNBLHFFQUFHLE1BQUssV0FBUjtBQURBLDZCQURKO0FBSUk7QUFBQTtBQUFBLGtDQUFJLFdBQVUsYUFBZDtBQUNBO0FBQUE7QUFBQSxzQ0FBRyxNQUFLLFNBQVI7QUFBQTtBQUFBO0FBREEsNkJBSko7QUFPSTtBQUFBO0FBQUEsa0NBQUksV0FBVSxhQUFkO0FBQ0E7QUFBQTtBQUFBLHNDQUFHLE1BQUssR0FBUjtBQUFBO0FBQUE7QUFEQSw2QkFQSjtBQVVJO0FBQUE7QUFBQSxrQ0FBSSxXQUFVLGFBQWQ7QUFDQTtBQUFBO0FBQUEsc0NBQUcsTUFBSyxHQUFSO0FBQUE7QUFBQTtBQURBO0FBVko7QUFEQTtBQVBKO0FBREEsYUFESjtBQTJCRTs7Ozs7O0FBWUw7O2tCQUVjLEc7Ozs7Ozs7Ozs7O0FDcERmOzs7Ozs7Ozs7Ozs7SUFFTSxhOzs7Ozs7Ozs7Ozs2QkFDTztBQUNQLGFBQ0U7QUFBQTtBQUFBLFVBQUssV0FBVSxnQkFBZjtBQUNHLGFBQUssS0FBTCxDQUFXO0FBRGQsT0FERjtBQUtEOzs7Ozs7a0JBR1ksYTs7Ozs7QUNaakI7Ozs7QUFDQTs7OztBQUVBOzs7O0FBQ0E7Ozs7QUFDQTs7Ozs7O0FBR0EsSUFBSSxZQUFZLENBQ2QsRUFBQyxRQUFRLFFBQVQsRUFEYyxFQUNNLEVBQUMsUUFBUSxPQUFULEVBRE4sRUFDeUIsRUFBQyxRQUFRLE1BQVQsRUFEekIsRUFDMkMsRUFBQyxRQUFRLGdCQUFULEVBRDNDLEVBRWQsRUFBQyxRQUFRLFNBQVQsRUFGYyxFQUVPLEVBQUMsUUFBUSxRQUFULEVBRlAsRUFFMkIsRUFBQyxRQUFRLE9BQVQsRUFGM0IsRUFFOEMsRUFBQyxRQUFRLFNBQVQsRUFGOUMsRUFHZCxFQUFDLFFBQVEsV0FBVCxFQUhjLEVBR1MsRUFBQyxRQUFRLE1BQVQsRUFIVCxFQUcyQixFQUFDLFFBQVEsZ0JBQVQsRUFIM0IsRUFHdUQsRUFBQyxRQUFRLFVBQVQsRUFIdkQsRUFJZCxFQUFDLFFBQVEsVUFBVCxFQUpjLEVBSVEsRUFBQyxRQUFRLFdBQVQsRUFKUixFQUkrQixFQUFDLFFBQVEsUUFBVCxFQUovQixFQUltRCxFQUFDLFFBQVEsT0FBVCxFQUpuRCxFQUtkLEVBQUMsUUFBUSxPQUFULEVBTGMsRUFLSyxFQUFDLFFBQVEsT0FBVCxFQUxMLEVBS3dCLEVBQUMsUUFBUSxxQkFBVCxFQUx4QixFQUt5RCxFQUFDLFFBQVEsT0FBVCxFQUx6RCxFQU1kLEVBQUMsUUFBUSxVQUFULEVBTmMsRUFNUSxFQUFDLFFBQVEsU0FBVCxFQU5SLEVBTTZCLEVBQUMsUUFBUSxvQkFBVCxFQU43QixFQU02RCxFQUFDLFFBQVEsUUFBVCxFQU43RCxFQU9kLEVBQUMsUUFBUSxPQUFULEVBUGMsRUFPSyxFQUFDLFFBQVEsUUFBVCxFQVBMLEVBT3lCLEVBQUMsUUFBUSxPQUFULEVBUHpCLENBQWhCOztBQVdBLElBQUksY0FDRjtBQUFBO0FBQUE7QUFDRSxvREFERjtBQUVFO0FBQUE7QUFBQTtBQUNFLDhEQUFlLE9BQVEsU0FBdkI7QUFERjtBQUZGLENBREY7O0FBU0EsU0FBUyxNQUFULENBQ0UsV0FERixFQUVFLFNBQVMsY0FBVCxDQUF3QixlQUF4QixDQUZGIiwiZmlsZSI6ImJ1bmRsZS5qcyIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2xpYi9heGlvcycpOyIsIid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi8uLi91dGlscycpO1xudmFyIHNldHRsZSA9IHJlcXVpcmUoJy4vLi4vY29yZS9zZXR0bGUnKTtcbnZhciBidWlsZFVSTCA9IHJlcXVpcmUoJy4vLi4vaGVscGVycy9idWlsZFVSTCcpO1xudmFyIHBhcnNlSGVhZGVycyA9IHJlcXVpcmUoJy4vLi4vaGVscGVycy9wYXJzZUhlYWRlcnMnKTtcbnZhciBpc1VSTFNhbWVPcmlnaW4gPSByZXF1aXJlKCcuLy4uL2hlbHBlcnMvaXNVUkxTYW1lT3JpZ2luJyk7XG52YXIgY3JlYXRlRXJyb3IgPSByZXF1aXJlKCcuLi9jb3JlL2NyZWF0ZUVycm9yJyk7XG52YXIgYnRvYSA9ICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cuYnRvYSAmJiB3aW5kb3cuYnRvYS5iaW5kKHdpbmRvdykpIHx8IHJlcXVpcmUoJy4vLi4vaGVscGVycy9idG9hJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24geGhyQWRhcHRlcihjb25maWcpIHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIGRpc3BhdGNoWGhyUmVxdWVzdChyZXNvbHZlLCByZWplY3QpIHtcbiAgICB2YXIgcmVxdWVzdERhdGEgPSBjb25maWcuZGF0YTtcbiAgICB2YXIgcmVxdWVzdEhlYWRlcnMgPSBjb25maWcuaGVhZGVycztcblxuICAgIGlmICh1dGlscy5pc0Zvcm1EYXRhKHJlcXVlc3REYXRhKSkge1xuICAgICAgZGVsZXRlIHJlcXVlc3RIZWFkZXJzWydDb250ZW50LVR5cGUnXTsgLy8gTGV0IHRoZSBicm93c2VyIHNldCBpdFxuICAgIH1cblxuICAgIHZhciByZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgdmFyIGxvYWRFdmVudCA9ICdvbnJlYWR5c3RhdGVjaGFuZ2UnO1xuICAgIHZhciB4RG9tYWluID0gZmFsc2U7XG5cbiAgICAvLyBGb3IgSUUgOC85IENPUlMgc3VwcG9ydFxuICAgIC8vIE9ubHkgc3VwcG9ydHMgUE9TVCBhbmQgR0VUIGNhbGxzIGFuZCBkb2Vzbid0IHJldHVybnMgdGhlIHJlc3BvbnNlIGhlYWRlcnMuXG4gICAgLy8gRE9OJ1QgZG8gdGhpcyBmb3IgdGVzdGluZyBiL2MgWE1MSHR0cFJlcXVlc3QgaXMgbW9ja2VkLCBub3QgWERvbWFpblJlcXVlc3QuXG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAndGVzdCcgJiZcbiAgICAgICAgdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICAgICAgd2luZG93LlhEb21haW5SZXF1ZXN0ICYmICEoJ3dpdGhDcmVkZW50aWFscycgaW4gcmVxdWVzdCkgJiZcbiAgICAgICAgIWlzVVJMU2FtZU9yaWdpbihjb25maWcudXJsKSkge1xuICAgICAgcmVxdWVzdCA9IG5ldyB3aW5kb3cuWERvbWFpblJlcXVlc3QoKTtcbiAgICAgIGxvYWRFdmVudCA9ICdvbmxvYWQnO1xuICAgICAgeERvbWFpbiA9IHRydWU7XG4gICAgICByZXF1ZXN0Lm9ucHJvZ3Jlc3MgPSBmdW5jdGlvbiBoYW5kbGVQcm9ncmVzcygpIHt9O1xuICAgICAgcmVxdWVzdC5vbnRpbWVvdXQgPSBmdW5jdGlvbiBoYW5kbGVUaW1lb3V0KCkge307XG4gICAgfVxuXG4gICAgLy8gSFRUUCBiYXNpYyBhdXRoZW50aWNhdGlvblxuICAgIGlmIChjb25maWcuYXV0aCkge1xuICAgICAgdmFyIHVzZXJuYW1lID0gY29uZmlnLmF1dGgudXNlcm5hbWUgfHwgJyc7XG4gICAgICB2YXIgcGFzc3dvcmQgPSBjb25maWcuYXV0aC5wYXNzd29yZCB8fCAnJztcbiAgICAgIHJlcXVlc3RIZWFkZXJzLkF1dGhvcml6YXRpb24gPSAnQmFzaWMgJyArIGJ0b2EodXNlcm5hbWUgKyAnOicgKyBwYXNzd29yZCk7XG4gICAgfVxuXG4gICAgcmVxdWVzdC5vcGVuKGNvbmZpZy5tZXRob2QudG9VcHBlckNhc2UoKSwgYnVpbGRVUkwoY29uZmlnLnVybCwgY29uZmlnLnBhcmFtcywgY29uZmlnLnBhcmFtc1NlcmlhbGl6ZXIpLCB0cnVlKTtcblxuICAgIC8vIFNldCB0aGUgcmVxdWVzdCB0aW1lb3V0IGluIE1TXG4gICAgcmVxdWVzdC50aW1lb3V0ID0gY29uZmlnLnRpbWVvdXQ7XG5cbiAgICAvLyBMaXN0ZW4gZm9yIHJlYWR5IHN0YXRlXG4gICAgcmVxdWVzdFtsb2FkRXZlbnRdID0gZnVuY3Rpb24gaGFuZGxlTG9hZCgpIHtcbiAgICAgIGlmICghcmVxdWVzdCB8fCAocmVxdWVzdC5yZWFkeVN0YXRlICE9PSA0ICYmICF4RG9tYWluKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIFRoZSByZXF1ZXN0IGVycm9yZWQgb3V0IGFuZCB3ZSBkaWRuJ3QgZ2V0IGEgcmVzcG9uc2UsIHRoaXMgd2lsbCBiZVxuICAgICAgLy8gaGFuZGxlZCBieSBvbmVycm9yIGluc3RlYWRcbiAgICAgIC8vIFdpdGggb25lIGV4Y2VwdGlvbjogcmVxdWVzdCB0aGF0IHVzaW5nIGZpbGU6IHByb3RvY29sLCBtb3N0IGJyb3dzZXJzXG4gICAgICAvLyB3aWxsIHJldHVybiBzdGF0dXMgYXMgMCBldmVuIHRob3VnaCBpdCdzIGEgc3VjY2Vzc2Z1bCByZXF1ZXN0XG4gICAgICBpZiAocmVxdWVzdC5zdGF0dXMgPT09IDAgJiYgIShyZXF1ZXN0LnJlc3BvbnNlVVJMICYmIHJlcXVlc3QucmVzcG9uc2VVUkwuaW5kZXhPZignZmlsZTonKSA9PT0gMCkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBQcmVwYXJlIHRoZSByZXNwb25zZVxuICAgICAgdmFyIHJlc3BvbnNlSGVhZGVycyA9ICdnZXRBbGxSZXNwb25zZUhlYWRlcnMnIGluIHJlcXVlc3QgPyBwYXJzZUhlYWRlcnMocmVxdWVzdC5nZXRBbGxSZXNwb25zZUhlYWRlcnMoKSkgOiBudWxsO1xuICAgICAgdmFyIHJlc3BvbnNlRGF0YSA9ICFjb25maWcucmVzcG9uc2VUeXBlIHx8IGNvbmZpZy5yZXNwb25zZVR5cGUgPT09ICd0ZXh0JyA/IHJlcXVlc3QucmVzcG9uc2VUZXh0IDogcmVxdWVzdC5yZXNwb25zZTtcbiAgICAgIHZhciByZXNwb25zZSA9IHtcbiAgICAgICAgZGF0YTogcmVzcG9uc2VEYXRhLFxuICAgICAgICAvLyBJRSBzZW5kcyAxMjIzIGluc3RlYWQgb2YgMjA0IChodHRwczovL2dpdGh1Yi5jb20vbXphYnJpc2tpZS9heGlvcy9pc3N1ZXMvMjAxKVxuICAgICAgICBzdGF0dXM6IHJlcXVlc3Quc3RhdHVzID09PSAxMjIzID8gMjA0IDogcmVxdWVzdC5zdGF0dXMsXG4gICAgICAgIHN0YXR1c1RleHQ6IHJlcXVlc3Quc3RhdHVzID09PSAxMjIzID8gJ05vIENvbnRlbnQnIDogcmVxdWVzdC5zdGF0dXNUZXh0LFxuICAgICAgICBoZWFkZXJzOiByZXNwb25zZUhlYWRlcnMsXG4gICAgICAgIGNvbmZpZzogY29uZmlnLFxuICAgICAgICByZXF1ZXN0OiByZXF1ZXN0XG4gICAgICB9O1xuXG4gICAgICBzZXR0bGUocmVzb2x2ZSwgcmVqZWN0LCByZXNwb25zZSk7XG5cbiAgICAgIC8vIENsZWFuIHVwIHJlcXVlc3RcbiAgICAgIHJlcXVlc3QgPSBudWxsO1xuICAgIH07XG5cbiAgICAvLyBIYW5kbGUgbG93IGxldmVsIG5ldHdvcmsgZXJyb3JzXG4gICAgcmVxdWVzdC5vbmVycm9yID0gZnVuY3Rpb24gaGFuZGxlRXJyb3IoKSB7XG4gICAgICAvLyBSZWFsIGVycm9ycyBhcmUgaGlkZGVuIGZyb20gdXMgYnkgdGhlIGJyb3dzZXJcbiAgICAgIC8vIG9uZXJyb3Igc2hvdWxkIG9ubHkgZmlyZSBpZiBpdCdzIGEgbmV0d29yayBlcnJvclxuICAgICAgcmVqZWN0KGNyZWF0ZUVycm9yKCdOZXR3b3JrIEVycm9yJywgY29uZmlnLCBudWxsLCByZXF1ZXN0KSk7XG5cbiAgICAgIC8vIENsZWFuIHVwIHJlcXVlc3RcbiAgICAgIHJlcXVlc3QgPSBudWxsO1xuICAgIH07XG5cbiAgICAvLyBIYW5kbGUgdGltZW91dFxuICAgIHJlcXVlc3Qub250aW1lb3V0ID0gZnVuY3Rpb24gaGFuZGxlVGltZW91dCgpIHtcbiAgICAgIHJlamVjdChjcmVhdGVFcnJvcigndGltZW91dCBvZiAnICsgY29uZmlnLnRpbWVvdXQgKyAnbXMgZXhjZWVkZWQnLCBjb25maWcsICdFQ09OTkFCT1JURUQnLFxuICAgICAgICByZXF1ZXN0KSk7XG5cbiAgICAgIC8vIENsZWFuIHVwIHJlcXVlc3RcbiAgICAgIHJlcXVlc3QgPSBudWxsO1xuICAgIH07XG5cbiAgICAvLyBBZGQgeHNyZiBoZWFkZXJcbiAgICAvLyBUaGlzIGlzIG9ubHkgZG9uZSBpZiBydW5uaW5nIGluIGEgc3RhbmRhcmQgYnJvd3NlciBlbnZpcm9ubWVudC5cbiAgICAvLyBTcGVjaWZpY2FsbHkgbm90IGlmIHdlJ3JlIGluIGEgd2ViIHdvcmtlciwgb3IgcmVhY3QtbmF0aXZlLlxuICAgIGlmICh1dGlscy5pc1N0YW5kYXJkQnJvd3NlckVudigpKSB7XG4gICAgICB2YXIgY29va2llcyA9IHJlcXVpcmUoJy4vLi4vaGVscGVycy9jb29raWVzJyk7XG5cbiAgICAgIC8vIEFkZCB4c3JmIGhlYWRlclxuICAgICAgdmFyIHhzcmZWYWx1ZSA9IChjb25maWcud2l0aENyZWRlbnRpYWxzIHx8IGlzVVJMU2FtZU9yaWdpbihjb25maWcudXJsKSkgJiYgY29uZmlnLnhzcmZDb29raWVOYW1lID9cbiAgICAgICAgICBjb29raWVzLnJlYWQoY29uZmlnLnhzcmZDb29raWVOYW1lKSA6XG4gICAgICAgICAgdW5kZWZpbmVkO1xuXG4gICAgICBpZiAoeHNyZlZhbHVlKSB7XG4gICAgICAgIHJlcXVlc3RIZWFkZXJzW2NvbmZpZy54c3JmSGVhZGVyTmFtZV0gPSB4c3JmVmFsdWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQWRkIGhlYWRlcnMgdG8gdGhlIHJlcXVlc3RcbiAgICBpZiAoJ3NldFJlcXVlc3RIZWFkZXInIGluIHJlcXVlc3QpIHtcbiAgICAgIHV0aWxzLmZvckVhY2gocmVxdWVzdEhlYWRlcnMsIGZ1bmN0aW9uIHNldFJlcXVlc3RIZWFkZXIodmFsLCBrZXkpIHtcbiAgICAgICAgaWYgKHR5cGVvZiByZXF1ZXN0RGF0YSA9PT0gJ3VuZGVmaW5lZCcgJiYga2V5LnRvTG93ZXJDYXNlKCkgPT09ICdjb250ZW50LXR5cGUnKSB7XG4gICAgICAgICAgLy8gUmVtb3ZlIENvbnRlbnQtVHlwZSBpZiBkYXRhIGlzIHVuZGVmaW5lZFxuICAgICAgICAgIGRlbGV0ZSByZXF1ZXN0SGVhZGVyc1trZXldO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIE90aGVyd2lzZSBhZGQgaGVhZGVyIHRvIHRoZSByZXF1ZXN0XG4gICAgICAgICAgcmVxdWVzdC5zZXRSZXF1ZXN0SGVhZGVyKGtleSwgdmFsKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gQWRkIHdpdGhDcmVkZW50aWFscyB0byByZXF1ZXN0IGlmIG5lZWRlZFxuICAgIGlmIChjb25maWcud2l0aENyZWRlbnRpYWxzKSB7XG4gICAgICByZXF1ZXN0LndpdGhDcmVkZW50aWFscyA9IHRydWU7XG4gICAgfVxuXG4gICAgLy8gQWRkIHJlc3BvbnNlVHlwZSB0byByZXF1ZXN0IGlmIG5lZWRlZFxuICAgIGlmIChjb25maWcucmVzcG9uc2VUeXBlKSB7XG4gICAgICB0cnkge1xuICAgICAgICByZXF1ZXN0LnJlc3BvbnNlVHlwZSA9IGNvbmZpZy5yZXNwb25zZVR5cGU7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIC8vIEV4cGVjdGVkIERPTUV4Y2VwdGlvbiB0aHJvd24gYnkgYnJvd3NlcnMgbm90IGNvbXBhdGlibGUgWE1MSHR0cFJlcXVlc3QgTGV2ZWwgMi5cbiAgICAgICAgLy8gQnV0LCB0aGlzIGNhbiBiZSBzdXBwcmVzc2VkIGZvciAnanNvbicgdHlwZSBhcyBpdCBjYW4gYmUgcGFyc2VkIGJ5IGRlZmF1bHQgJ3RyYW5zZm9ybVJlc3BvbnNlJyBmdW5jdGlvbi5cbiAgICAgICAgaWYgKGNvbmZpZy5yZXNwb25zZVR5cGUgIT09ICdqc29uJykge1xuICAgICAgICAgIHRocm93IGU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBIYW5kbGUgcHJvZ3Jlc3MgaWYgbmVlZGVkXG4gICAgaWYgKHR5cGVvZiBjb25maWcub25Eb3dubG9hZFByb2dyZXNzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXF1ZXN0LmFkZEV2ZW50TGlzdGVuZXIoJ3Byb2dyZXNzJywgY29uZmlnLm9uRG93bmxvYWRQcm9ncmVzcyk7XG4gICAgfVxuXG4gICAgLy8gTm90IGFsbCBicm93c2VycyBzdXBwb3J0IHVwbG9hZCBldmVudHNcbiAgICBpZiAodHlwZW9mIGNvbmZpZy5vblVwbG9hZFByb2dyZXNzID09PSAnZnVuY3Rpb24nICYmIHJlcXVlc3QudXBsb2FkKSB7XG4gICAgICByZXF1ZXN0LnVwbG9hZC5hZGRFdmVudExpc3RlbmVyKCdwcm9ncmVzcycsIGNvbmZpZy5vblVwbG9hZFByb2dyZXNzKTtcbiAgICB9XG5cbiAgICBpZiAoY29uZmlnLmNhbmNlbFRva2VuKSB7XG4gICAgICAvLyBIYW5kbGUgY2FuY2VsbGF0aW9uXG4gICAgICBjb25maWcuY2FuY2VsVG9rZW4ucHJvbWlzZS50aGVuKGZ1bmN0aW9uIG9uQ2FuY2VsZWQoY2FuY2VsKSB7XG4gICAgICAgIGlmICghcmVxdWVzdCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlcXVlc3QuYWJvcnQoKTtcbiAgICAgICAgcmVqZWN0KGNhbmNlbCk7XG4gICAgICAgIC8vIENsZWFuIHVwIHJlcXVlc3RcbiAgICAgICAgcmVxdWVzdCA9IG51bGw7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAocmVxdWVzdERhdGEgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmVxdWVzdERhdGEgPSBudWxsO1xuICAgIH1cblxuICAgIC8vIFNlbmQgdGhlIHJlcXVlc3RcbiAgICByZXF1ZXN0LnNlbmQocmVxdWVzdERhdGEpO1xuICB9KTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcbnZhciBiaW5kID0gcmVxdWlyZSgnLi9oZWxwZXJzL2JpbmQnKTtcbnZhciBBeGlvcyA9IHJlcXVpcmUoJy4vY29yZS9BeGlvcycpO1xudmFyIGRlZmF1bHRzID0gcmVxdWlyZSgnLi9kZWZhdWx0cycpO1xuXG4vKipcbiAqIENyZWF0ZSBhbiBpbnN0YW5jZSBvZiBBeGlvc1xuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBkZWZhdWx0Q29uZmlnIFRoZSBkZWZhdWx0IGNvbmZpZyBmb3IgdGhlIGluc3RhbmNlXG4gKiBAcmV0dXJuIHtBeGlvc30gQSBuZXcgaW5zdGFuY2Ugb2YgQXhpb3NcbiAqL1xuZnVuY3Rpb24gY3JlYXRlSW5zdGFuY2UoZGVmYXVsdENvbmZpZykge1xuICB2YXIgY29udGV4dCA9IG5ldyBBeGlvcyhkZWZhdWx0Q29uZmlnKTtcbiAgdmFyIGluc3RhbmNlID0gYmluZChBeGlvcy5wcm90b3R5cGUucmVxdWVzdCwgY29udGV4dCk7XG5cbiAgLy8gQ29weSBheGlvcy5wcm90b3R5cGUgdG8gaW5zdGFuY2VcbiAgdXRpbHMuZXh0ZW5kKGluc3RhbmNlLCBBeGlvcy5wcm90b3R5cGUsIGNvbnRleHQpO1xuXG4gIC8vIENvcHkgY29udGV4dCB0byBpbnN0YW5jZVxuICB1dGlscy5leHRlbmQoaW5zdGFuY2UsIGNvbnRleHQpO1xuXG4gIHJldHVybiBpbnN0YW5jZTtcbn1cblxuLy8gQ3JlYXRlIHRoZSBkZWZhdWx0IGluc3RhbmNlIHRvIGJlIGV4cG9ydGVkXG52YXIgYXhpb3MgPSBjcmVhdGVJbnN0YW5jZShkZWZhdWx0cyk7XG5cbi8vIEV4cG9zZSBBeGlvcyBjbGFzcyB0byBhbGxvdyBjbGFzcyBpbmhlcml0YW5jZVxuYXhpb3MuQXhpb3MgPSBBeGlvcztcblxuLy8gRmFjdG9yeSBmb3IgY3JlYXRpbmcgbmV3IGluc3RhbmNlc1xuYXhpb3MuY3JlYXRlID0gZnVuY3Rpb24gY3JlYXRlKGluc3RhbmNlQ29uZmlnKSB7XG4gIHJldHVybiBjcmVhdGVJbnN0YW5jZSh1dGlscy5tZXJnZShkZWZhdWx0cywgaW5zdGFuY2VDb25maWcpKTtcbn07XG5cbi8vIEV4cG9zZSBDYW5jZWwgJiBDYW5jZWxUb2tlblxuYXhpb3MuQ2FuY2VsID0gcmVxdWlyZSgnLi9jYW5jZWwvQ2FuY2VsJyk7XG5heGlvcy5DYW5jZWxUb2tlbiA9IHJlcXVpcmUoJy4vY2FuY2VsL0NhbmNlbFRva2VuJyk7XG5heGlvcy5pc0NhbmNlbCA9IHJlcXVpcmUoJy4vY2FuY2VsL2lzQ2FuY2VsJyk7XG5cbi8vIEV4cG9zZSBhbGwvc3ByZWFkXG5heGlvcy5hbGwgPSBmdW5jdGlvbiBhbGwocHJvbWlzZXMpIHtcbiAgcmV0dXJuIFByb21pc2UuYWxsKHByb21pc2VzKTtcbn07XG5heGlvcy5zcHJlYWQgPSByZXF1aXJlKCcuL2hlbHBlcnMvc3ByZWFkJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gYXhpb3M7XG5cbi8vIEFsbG93IHVzZSBvZiBkZWZhdWx0IGltcG9ydCBzeW50YXggaW4gVHlwZVNjcmlwdFxubW9kdWxlLmV4cG9ydHMuZGVmYXVsdCA9IGF4aW9zO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIEEgYENhbmNlbGAgaXMgYW4gb2JqZWN0IHRoYXQgaXMgdGhyb3duIHdoZW4gYW4gb3BlcmF0aW9uIGlzIGNhbmNlbGVkLlxuICpcbiAqIEBjbGFzc1xuICogQHBhcmFtIHtzdHJpbmc9fSBtZXNzYWdlIFRoZSBtZXNzYWdlLlxuICovXG5mdW5jdGlvbiBDYW5jZWwobWVzc2FnZSkge1xuICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xufVxuXG5DYW5jZWwucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gdG9TdHJpbmcoKSB7XG4gIHJldHVybiAnQ2FuY2VsJyArICh0aGlzLm1lc3NhZ2UgPyAnOiAnICsgdGhpcy5tZXNzYWdlIDogJycpO1xufTtcblxuQ2FuY2VsLnByb3RvdHlwZS5fX0NBTkNFTF9fID0gdHJ1ZTtcblxubW9kdWxlLmV4cG9ydHMgPSBDYW5jZWw7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBDYW5jZWwgPSByZXF1aXJlKCcuL0NhbmNlbCcpO1xuXG4vKipcbiAqIEEgYENhbmNlbFRva2VuYCBpcyBhbiBvYmplY3QgdGhhdCBjYW4gYmUgdXNlZCB0byByZXF1ZXN0IGNhbmNlbGxhdGlvbiBvZiBhbiBvcGVyYXRpb24uXG4gKlxuICogQGNsYXNzXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBleGVjdXRvciBUaGUgZXhlY3V0b3IgZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIENhbmNlbFRva2VuKGV4ZWN1dG9yKSB7XG4gIGlmICh0eXBlb2YgZXhlY3V0b3IgIT09ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdleGVjdXRvciBtdXN0IGJlIGEgZnVuY3Rpb24uJyk7XG4gIH1cblxuICB2YXIgcmVzb2x2ZVByb21pc2U7XG4gIHRoaXMucHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uIHByb21pc2VFeGVjdXRvcihyZXNvbHZlKSB7XG4gICAgcmVzb2x2ZVByb21pc2UgPSByZXNvbHZlO1xuICB9KTtcblxuICB2YXIgdG9rZW4gPSB0aGlzO1xuICBleGVjdXRvcihmdW5jdGlvbiBjYW5jZWwobWVzc2FnZSkge1xuICAgIGlmICh0b2tlbi5yZWFzb24pIHtcbiAgICAgIC8vIENhbmNlbGxhdGlvbiBoYXMgYWxyZWFkeSBiZWVuIHJlcXVlc3RlZFxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRva2VuLnJlYXNvbiA9IG5ldyBDYW5jZWwobWVzc2FnZSk7XG4gICAgcmVzb2x2ZVByb21pc2UodG9rZW4ucmVhc29uKTtcbiAgfSk7XG59XG5cbi8qKlxuICogVGhyb3dzIGEgYENhbmNlbGAgaWYgY2FuY2VsbGF0aW9uIGhhcyBiZWVuIHJlcXVlc3RlZC5cbiAqL1xuQ2FuY2VsVG9rZW4ucHJvdG90eXBlLnRocm93SWZSZXF1ZXN0ZWQgPSBmdW5jdGlvbiB0aHJvd0lmUmVxdWVzdGVkKCkge1xuICBpZiAodGhpcy5yZWFzb24pIHtcbiAgICB0aHJvdyB0aGlzLnJlYXNvbjtcbiAgfVxufTtcblxuLyoqXG4gKiBSZXR1cm5zIGFuIG9iamVjdCB0aGF0IGNvbnRhaW5zIGEgbmV3IGBDYW5jZWxUb2tlbmAgYW5kIGEgZnVuY3Rpb24gdGhhdCwgd2hlbiBjYWxsZWQsXG4gKiBjYW5jZWxzIHRoZSBgQ2FuY2VsVG9rZW5gLlxuICovXG5DYW5jZWxUb2tlbi5zb3VyY2UgPSBmdW5jdGlvbiBzb3VyY2UoKSB7XG4gIHZhciBjYW5jZWw7XG4gIHZhciB0b2tlbiA9IG5ldyBDYW5jZWxUb2tlbihmdW5jdGlvbiBleGVjdXRvcihjKSB7XG4gICAgY2FuY2VsID0gYztcbiAgfSk7XG4gIHJldHVybiB7XG4gICAgdG9rZW46IHRva2VuLFxuICAgIGNhbmNlbDogY2FuY2VsXG4gIH07XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENhbmNlbFRva2VuO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGlzQ2FuY2VsKHZhbHVlKSB7XG4gIHJldHVybiAhISh2YWx1ZSAmJiB2YWx1ZS5fX0NBTkNFTF9fKTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBkZWZhdWx0cyA9IHJlcXVpcmUoJy4vLi4vZGVmYXVsdHMnKTtcbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vLi4vdXRpbHMnKTtcbnZhciBJbnRlcmNlcHRvck1hbmFnZXIgPSByZXF1aXJlKCcuL0ludGVyY2VwdG9yTWFuYWdlcicpO1xudmFyIGRpc3BhdGNoUmVxdWVzdCA9IHJlcXVpcmUoJy4vZGlzcGF0Y2hSZXF1ZXN0Jyk7XG52YXIgaXNBYnNvbHV0ZVVSTCA9IHJlcXVpcmUoJy4vLi4vaGVscGVycy9pc0Fic29sdXRlVVJMJyk7XG52YXIgY29tYmluZVVSTHMgPSByZXF1aXJlKCcuLy4uL2hlbHBlcnMvY29tYmluZVVSTHMnKTtcblxuLyoqXG4gKiBDcmVhdGUgYSBuZXcgaW5zdGFuY2Ugb2YgQXhpb3NcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gaW5zdGFuY2VDb25maWcgVGhlIGRlZmF1bHQgY29uZmlnIGZvciB0aGUgaW5zdGFuY2VcbiAqL1xuZnVuY3Rpb24gQXhpb3MoaW5zdGFuY2VDb25maWcpIHtcbiAgdGhpcy5kZWZhdWx0cyA9IGluc3RhbmNlQ29uZmlnO1xuICB0aGlzLmludGVyY2VwdG9ycyA9IHtcbiAgICByZXF1ZXN0OiBuZXcgSW50ZXJjZXB0b3JNYW5hZ2VyKCksXG4gICAgcmVzcG9uc2U6IG5ldyBJbnRlcmNlcHRvck1hbmFnZXIoKVxuICB9O1xufVxuXG4vKipcbiAqIERpc3BhdGNoIGEgcmVxdWVzdFxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgVGhlIGNvbmZpZyBzcGVjaWZpYyBmb3IgdGhpcyByZXF1ZXN0IChtZXJnZWQgd2l0aCB0aGlzLmRlZmF1bHRzKVxuICovXG5BeGlvcy5wcm90b3R5cGUucmVxdWVzdCA9IGZ1bmN0aW9uIHJlcXVlc3QoY29uZmlnKSB7XG4gIC8qZXNsaW50IG5vLXBhcmFtLXJlYXNzaWduOjAqL1xuICAvLyBBbGxvdyBmb3IgYXhpb3MoJ2V4YW1wbGUvdXJsJ1ssIGNvbmZpZ10pIGEgbGEgZmV0Y2ggQVBJXG4gIGlmICh0eXBlb2YgY29uZmlnID09PSAnc3RyaW5nJykge1xuICAgIGNvbmZpZyA9IHV0aWxzLm1lcmdlKHtcbiAgICAgIHVybDogYXJndW1lbnRzWzBdXG4gICAgfSwgYXJndW1lbnRzWzFdKTtcbiAgfVxuXG4gIGNvbmZpZyA9IHV0aWxzLm1lcmdlKGRlZmF1bHRzLCB0aGlzLmRlZmF1bHRzLCB7IG1ldGhvZDogJ2dldCcgfSwgY29uZmlnKTtcbiAgY29uZmlnLm1ldGhvZCA9IGNvbmZpZy5tZXRob2QudG9Mb3dlckNhc2UoKTtcblxuICAvLyBTdXBwb3J0IGJhc2VVUkwgY29uZmlnXG4gIGlmIChjb25maWcuYmFzZVVSTCAmJiAhaXNBYnNvbHV0ZVVSTChjb25maWcudXJsKSkge1xuICAgIGNvbmZpZy51cmwgPSBjb21iaW5lVVJMcyhjb25maWcuYmFzZVVSTCwgY29uZmlnLnVybCk7XG4gIH1cblxuICAvLyBIb29rIHVwIGludGVyY2VwdG9ycyBtaWRkbGV3YXJlXG4gIHZhciBjaGFpbiA9IFtkaXNwYXRjaFJlcXVlc3QsIHVuZGVmaW5lZF07XG4gIHZhciBwcm9taXNlID0gUHJvbWlzZS5yZXNvbHZlKGNvbmZpZyk7XG5cbiAgdGhpcy5pbnRlcmNlcHRvcnMucmVxdWVzdC5mb3JFYWNoKGZ1bmN0aW9uIHVuc2hpZnRSZXF1ZXN0SW50ZXJjZXB0b3JzKGludGVyY2VwdG9yKSB7XG4gICAgY2hhaW4udW5zaGlmdChpbnRlcmNlcHRvci5mdWxmaWxsZWQsIGludGVyY2VwdG9yLnJlamVjdGVkKTtcbiAgfSk7XG5cbiAgdGhpcy5pbnRlcmNlcHRvcnMucmVzcG9uc2UuZm9yRWFjaChmdW5jdGlvbiBwdXNoUmVzcG9uc2VJbnRlcmNlcHRvcnMoaW50ZXJjZXB0b3IpIHtcbiAgICBjaGFpbi5wdXNoKGludGVyY2VwdG9yLmZ1bGZpbGxlZCwgaW50ZXJjZXB0b3IucmVqZWN0ZWQpO1xuICB9KTtcblxuICB3aGlsZSAoY2hhaW4ubGVuZ3RoKSB7XG4gICAgcHJvbWlzZSA9IHByb21pc2UudGhlbihjaGFpbi5zaGlmdCgpLCBjaGFpbi5zaGlmdCgpKTtcbiAgfVxuXG4gIHJldHVybiBwcm9taXNlO1xufTtcblxuLy8gUHJvdmlkZSBhbGlhc2VzIGZvciBzdXBwb3J0ZWQgcmVxdWVzdCBtZXRob2RzXG51dGlscy5mb3JFYWNoKFsnZGVsZXRlJywgJ2dldCcsICdoZWFkJywgJ29wdGlvbnMnXSwgZnVuY3Rpb24gZm9yRWFjaE1ldGhvZE5vRGF0YShtZXRob2QpIHtcbiAgLyplc2xpbnQgZnVuYy1uYW1lczowKi9cbiAgQXhpb3MucHJvdG90eXBlW21ldGhvZF0gPSBmdW5jdGlvbih1cmwsIGNvbmZpZykge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3QodXRpbHMubWVyZ2UoY29uZmlnIHx8IHt9LCB7XG4gICAgICBtZXRob2Q6IG1ldGhvZCxcbiAgICAgIHVybDogdXJsXG4gICAgfSkpO1xuICB9O1xufSk7XG5cbnV0aWxzLmZvckVhY2goWydwb3N0JywgJ3B1dCcsICdwYXRjaCddLCBmdW5jdGlvbiBmb3JFYWNoTWV0aG9kV2l0aERhdGEobWV0aG9kKSB7XG4gIC8qZXNsaW50IGZ1bmMtbmFtZXM6MCovXG4gIEF4aW9zLnByb3RvdHlwZVttZXRob2RdID0gZnVuY3Rpb24odXJsLCBkYXRhLCBjb25maWcpIHtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KHV0aWxzLm1lcmdlKGNvbmZpZyB8fCB7fSwge1xuICAgICAgbWV0aG9kOiBtZXRob2QsXG4gICAgICB1cmw6IHVybCxcbiAgICAgIGRhdGE6IGRhdGFcbiAgICB9KSk7XG4gIH07XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBBeGlvcztcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi8uLi91dGlscycpO1xuXG5mdW5jdGlvbiBJbnRlcmNlcHRvck1hbmFnZXIoKSB7XG4gIHRoaXMuaGFuZGxlcnMgPSBbXTtcbn1cblxuLyoqXG4gKiBBZGQgYSBuZXcgaW50ZXJjZXB0b3IgdG8gdGhlIHN0YWNrXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gZnVsZmlsbGVkIFRoZSBmdW5jdGlvbiB0byBoYW5kbGUgYHRoZW5gIGZvciBhIGBQcm9taXNlYFxuICogQHBhcmFtIHtGdW5jdGlvbn0gcmVqZWN0ZWQgVGhlIGZ1bmN0aW9uIHRvIGhhbmRsZSBgcmVqZWN0YCBmb3IgYSBgUHJvbWlzZWBcbiAqXG4gKiBAcmV0dXJuIHtOdW1iZXJ9IEFuIElEIHVzZWQgdG8gcmVtb3ZlIGludGVyY2VwdG9yIGxhdGVyXG4gKi9cbkludGVyY2VwdG9yTWFuYWdlci5wcm90b3R5cGUudXNlID0gZnVuY3Rpb24gdXNlKGZ1bGZpbGxlZCwgcmVqZWN0ZWQpIHtcbiAgdGhpcy5oYW5kbGVycy5wdXNoKHtcbiAgICBmdWxmaWxsZWQ6IGZ1bGZpbGxlZCxcbiAgICByZWplY3RlZDogcmVqZWN0ZWRcbiAgfSk7XG4gIHJldHVybiB0aGlzLmhhbmRsZXJzLmxlbmd0aCAtIDE7XG59O1xuXG4vKipcbiAqIFJlbW92ZSBhbiBpbnRlcmNlcHRvciBmcm9tIHRoZSBzdGFja1xuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBpZCBUaGUgSUQgdGhhdCB3YXMgcmV0dXJuZWQgYnkgYHVzZWBcbiAqL1xuSW50ZXJjZXB0b3JNYW5hZ2VyLnByb3RvdHlwZS5lamVjdCA9IGZ1bmN0aW9uIGVqZWN0KGlkKSB7XG4gIGlmICh0aGlzLmhhbmRsZXJzW2lkXSkge1xuICAgIHRoaXMuaGFuZGxlcnNbaWRdID0gbnVsbDtcbiAgfVxufTtcblxuLyoqXG4gKiBJdGVyYXRlIG92ZXIgYWxsIHRoZSByZWdpc3RlcmVkIGludGVyY2VwdG9yc1xuICpcbiAqIFRoaXMgbWV0aG9kIGlzIHBhcnRpY3VsYXJseSB1c2VmdWwgZm9yIHNraXBwaW5nIG92ZXIgYW55XG4gKiBpbnRlcmNlcHRvcnMgdGhhdCBtYXkgaGF2ZSBiZWNvbWUgYG51bGxgIGNhbGxpbmcgYGVqZWN0YC5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmbiBUaGUgZnVuY3Rpb24gdG8gY2FsbCBmb3IgZWFjaCBpbnRlcmNlcHRvclxuICovXG5JbnRlcmNlcHRvck1hbmFnZXIucHJvdG90eXBlLmZvckVhY2ggPSBmdW5jdGlvbiBmb3JFYWNoKGZuKSB7XG4gIHV0aWxzLmZvckVhY2godGhpcy5oYW5kbGVycywgZnVuY3Rpb24gZm9yRWFjaEhhbmRsZXIoaCkge1xuICAgIGlmIChoICE9PSBudWxsKSB7XG4gICAgICBmbihoKTtcbiAgICB9XG4gIH0pO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBJbnRlcmNlcHRvck1hbmFnZXI7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBlbmhhbmNlRXJyb3IgPSByZXF1aXJlKCcuL2VuaGFuY2VFcnJvcicpO1xuXG4vKipcbiAqIENyZWF0ZSBhbiBFcnJvciB3aXRoIHRoZSBzcGVjaWZpZWQgbWVzc2FnZSwgY29uZmlnLCBlcnJvciBjb2RlLCByZXF1ZXN0IGFuZCByZXNwb25zZS5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZSBUaGUgZXJyb3IgbWVzc2FnZS5cbiAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgVGhlIGNvbmZpZy5cbiAqIEBwYXJhbSB7c3RyaW5nfSBbY29kZV0gVGhlIGVycm9yIGNvZGUgKGZvciBleGFtcGxlLCAnRUNPTk5BQk9SVEVEJykuXG4gKiBAcGFyYW0ge09iamVjdH0gW3JlcXVlc3RdIFRoZSByZXF1ZXN0LlxuICogQHBhcmFtIHtPYmplY3R9IFtyZXNwb25zZV0gVGhlIHJlc3BvbnNlLlxuICogQHJldHVybnMge0Vycm9yfSBUaGUgY3JlYXRlZCBlcnJvci5cbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBjcmVhdGVFcnJvcihtZXNzYWdlLCBjb25maWcsIGNvZGUsIHJlcXVlc3QsIHJlc3BvbnNlKSB7XG4gIHZhciBlcnJvciA9IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgcmV0dXJuIGVuaGFuY2VFcnJvcihlcnJvciwgY29uZmlnLCBjb2RlLCByZXF1ZXN0LCByZXNwb25zZSk7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLy4uL3V0aWxzJyk7XG52YXIgdHJhbnNmb3JtRGF0YSA9IHJlcXVpcmUoJy4vdHJhbnNmb3JtRGF0YScpO1xudmFyIGlzQ2FuY2VsID0gcmVxdWlyZSgnLi4vY2FuY2VsL2lzQ2FuY2VsJyk7XG52YXIgZGVmYXVsdHMgPSByZXF1aXJlKCcuLi9kZWZhdWx0cycpO1xuXG4vKipcbiAqIFRocm93cyBhIGBDYW5jZWxgIGlmIGNhbmNlbGxhdGlvbiBoYXMgYmVlbiByZXF1ZXN0ZWQuXG4gKi9cbmZ1bmN0aW9uIHRocm93SWZDYW5jZWxsYXRpb25SZXF1ZXN0ZWQoY29uZmlnKSB7XG4gIGlmIChjb25maWcuY2FuY2VsVG9rZW4pIHtcbiAgICBjb25maWcuY2FuY2VsVG9rZW4udGhyb3dJZlJlcXVlc3RlZCgpO1xuICB9XG59XG5cbi8qKlxuICogRGlzcGF0Y2ggYSByZXF1ZXN0IHRvIHRoZSBzZXJ2ZXIgdXNpbmcgdGhlIGNvbmZpZ3VyZWQgYWRhcHRlci5cbiAqXG4gKiBAcGFyYW0ge29iamVjdH0gY29uZmlnIFRoZSBjb25maWcgdGhhdCBpcyB0byBiZSB1c2VkIGZvciB0aGUgcmVxdWVzdFxuICogQHJldHVybnMge1Byb21pc2V9IFRoZSBQcm9taXNlIHRvIGJlIGZ1bGZpbGxlZFxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGRpc3BhdGNoUmVxdWVzdChjb25maWcpIHtcbiAgdGhyb3dJZkNhbmNlbGxhdGlvblJlcXVlc3RlZChjb25maWcpO1xuXG4gIC8vIEVuc3VyZSBoZWFkZXJzIGV4aXN0XG4gIGNvbmZpZy5oZWFkZXJzID0gY29uZmlnLmhlYWRlcnMgfHwge307XG5cbiAgLy8gVHJhbnNmb3JtIHJlcXVlc3QgZGF0YVxuICBjb25maWcuZGF0YSA9IHRyYW5zZm9ybURhdGEoXG4gICAgY29uZmlnLmRhdGEsXG4gICAgY29uZmlnLmhlYWRlcnMsXG4gICAgY29uZmlnLnRyYW5zZm9ybVJlcXVlc3RcbiAgKTtcblxuICAvLyBGbGF0dGVuIGhlYWRlcnNcbiAgY29uZmlnLmhlYWRlcnMgPSB1dGlscy5tZXJnZShcbiAgICBjb25maWcuaGVhZGVycy5jb21tb24gfHwge30sXG4gICAgY29uZmlnLmhlYWRlcnNbY29uZmlnLm1ldGhvZF0gfHwge30sXG4gICAgY29uZmlnLmhlYWRlcnMgfHwge31cbiAgKTtcblxuICB1dGlscy5mb3JFYWNoKFxuICAgIFsnZGVsZXRlJywgJ2dldCcsICdoZWFkJywgJ3Bvc3QnLCAncHV0JywgJ3BhdGNoJywgJ2NvbW1vbiddLFxuICAgIGZ1bmN0aW9uIGNsZWFuSGVhZGVyQ29uZmlnKG1ldGhvZCkge1xuICAgICAgZGVsZXRlIGNvbmZpZy5oZWFkZXJzW21ldGhvZF07XG4gICAgfVxuICApO1xuXG4gIHZhciBhZGFwdGVyID0gY29uZmlnLmFkYXB0ZXIgfHwgZGVmYXVsdHMuYWRhcHRlcjtcblxuICByZXR1cm4gYWRhcHRlcihjb25maWcpLnRoZW4oZnVuY3Rpb24gb25BZGFwdGVyUmVzb2x1dGlvbihyZXNwb25zZSkge1xuICAgIHRocm93SWZDYW5jZWxsYXRpb25SZXF1ZXN0ZWQoY29uZmlnKTtcblxuICAgIC8vIFRyYW5zZm9ybSByZXNwb25zZSBkYXRhXG4gICAgcmVzcG9uc2UuZGF0YSA9IHRyYW5zZm9ybURhdGEoXG4gICAgICByZXNwb25zZS5kYXRhLFxuICAgICAgcmVzcG9uc2UuaGVhZGVycyxcbiAgICAgIGNvbmZpZy50cmFuc2Zvcm1SZXNwb25zZVxuICAgICk7XG5cbiAgICByZXR1cm4gcmVzcG9uc2U7XG4gIH0sIGZ1bmN0aW9uIG9uQWRhcHRlclJlamVjdGlvbihyZWFzb24pIHtcbiAgICBpZiAoIWlzQ2FuY2VsKHJlYXNvbikpIHtcbiAgICAgIHRocm93SWZDYW5jZWxsYXRpb25SZXF1ZXN0ZWQoY29uZmlnKTtcblxuICAgICAgLy8gVHJhbnNmb3JtIHJlc3BvbnNlIGRhdGFcbiAgICAgIGlmIChyZWFzb24gJiYgcmVhc29uLnJlc3BvbnNlKSB7XG4gICAgICAgIHJlYXNvbi5yZXNwb25zZS5kYXRhID0gdHJhbnNmb3JtRGF0YShcbiAgICAgICAgICByZWFzb24ucmVzcG9uc2UuZGF0YSxcbiAgICAgICAgICByZWFzb24ucmVzcG9uc2UuaGVhZGVycyxcbiAgICAgICAgICBjb25maWcudHJhbnNmb3JtUmVzcG9uc2VcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QocmVhc29uKTtcbiAgfSk7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIFVwZGF0ZSBhbiBFcnJvciB3aXRoIHRoZSBzcGVjaWZpZWQgY29uZmlnLCBlcnJvciBjb2RlLCBhbmQgcmVzcG9uc2UuXG4gKlxuICogQHBhcmFtIHtFcnJvcn0gZXJyb3IgVGhlIGVycm9yIHRvIHVwZGF0ZS5cbiAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgVGhlIGNvbmZpZy5cbiAqIEBwYXJhbSB7c3RyaW5nfSBbY29kZV0gVGhlIGVycm9yIGNvZGUgKGZvciBleGFtcGxlLCAnRUNPTk5BQk9SVEVEJykuXG4gKiBAcGFyYW0ge09iamVjdH0gW3JlcXVlc3RdIFRoZSByZXF1ZXN0LlxuICogQHBhcmFtIHtPYmplY3R9IFtyZXNwb25zZV0gVGhlIHJlc3BvbnNlLlxuICogQHJldHVybnMge0Vycm9yfSBUaGUgZXJyb3IuXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZW5oYW5jZUVycm9yKGVycm9yLCBjb25maWcsIGNvZGUsIHJlcXVlc3QsIHJlc3BvbnNlKSB7XG4gIGVycm9yLmNvbmZpZyA9IGNvbmZpZztcbiAgaWYgKGNvZGUpIHtcbiAgICBlcnJvci5jb2RlID0gY29kZTtcbiAgfVxuICBlcnJvci5yZXF1ZXN0ID0gcmVxdWVzdDtcbiAgZXJyb3IucmVzcG9uc2UgPSByZXNwb25zZTtcbiAgcmV0dXJuIGVycm9yO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGNyZWF0ZUVycm9yID0gcmVxdWlyZSgnLi9jcmVhdGVFcnJvcicpO1xuXG4vKipcbiAqIFJlc29sdmUgb3IgcmVqZWN0IGEgUHJvbWlzZSBiYXNlZCBvbiByZXNwb25zZSBzdGF0dXMuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gcmVzb2x2ZSBBIGZ1bmN0aW9uIHRoYXQgcmVzb2x2ZXMgdGhlIHByb21pc2UuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSByZWplY3QgQSBmdW5jdGlvbiB0aGF0IHJlamVjdHMgdGhlIHByb21pc2UuXG4gKiBAcGFyYW0ge29iamVjdH0gcmVzcG9uc2UgVGhlIHJlc3BvbnNlLlxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIHNldHRsZShyZXNvbHZlLCByZWplY3QsIHJlc3BvbnNlKSB7XG4gIHZhciB2YWxpZGF0ZVN0YXR1cyA9IHJlc3BvbnNlLmNvbmZpZy52YWxpZGF0ZVN0YXR1cztcbiAgLy8gTm90ZTogc3RhdHVzIGlzIG5vdCBleHBvc2VkIGJ5IFhEb21haW5SZXF1ZXN0XG4gIGlmICghcmVzcG9uc2Uuc3RhdHVzIHx8ICF2YWxpZGF0ZVN0YXR1cyB8fCB2YWxpZGF0ZVN0YXR1cyhyZXNwb25zZS5zdGF0dXMpKSB7XG4gICAgcmVzb2x2ZShyZXNwb25zZSk7XG4gIH0gZWxzZSB7XG4gICAgcmVqZWN0KGNyZWF0ZUVycm9yKFxuICAgICAgJ1JlcXVlc3QgZmFpbGVkIHdpdGggc3RhdHVzIGNvZGUgJyArIHJlc3BvbnNlLnN0YXR1cyxcbiAgICAgIHJlc3BvbnNlLmNvbmZpZyxcbiAgICAgIG51bGwsXG4gICAgICByZXNwb25zZS5yZXF1ZXN0LFxuICAgICAgcmVzcG9uc2VcbiAgICApKTtcbiAgfVxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi8uLi91dGlscycpO1xuXG4vKipcbiAqIFRyYW5zZm9ybSB0aGUgZGF0YSBmb3IgYSByZXF1ZXN0IG9yIGEgcmVzcG9uc2VcbiAqXG4gKiBAcGFyYW0ge09iamVjdHxTdHJpbmd9IGRhdGEgVGhlIGRhdGEgdG8gYmUgdHJhbnNmb3JtZWRcbiAqIEBwYXJhbSB7QXJyYXl9IGhlYWRlcnMgVGhlIGhlYWRlcnMgZm9yIHRoZSByZXF1ZXN0IG9yIHJlc3BvbnNlXG4gKiBAcGFyYW0ge0FycmF5fEZ1bmN0aW9ufSBmbnMgQSBzaW5nbGUgZnVuY3Rpb24gb3IgQXJyYXkgb2YgZnVuY3Rpb25zXG4gKiBAcmV0dXJucyB7Kn0gVGhlIHJlc3VsdGluZyB0cmFuc2Zvcm1lZCBkYXRhXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gdHJhbnNmb3JtRGF0YShkYXRhLCBoZWFkZXJzLCBmbnMpIHtcbiAgLyplc2xpbnQgbm8tcGFyYW0tcmVhc3NpZ246MCovXG4gIHV0aWxzLmZvckVhY2goZm5zLCBmdW5jdGlvbiB0cmFuc2Zvcm0oZm4pIHtcbiAgICBkYXRhID0gZm4oZGF0YSwgaGVhZGVycyk7XG4gIH0pO1xuXG4gIHJldHVybiBkYXRhO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xudmFyIG5vcm1hbGl6ZUhlYWRlck5hbWUgPSByZXF1aXJlKCcuL2hlbHBlcnMvbm9ybWFsaXplSGVhZGVyTmFtZScpO1xuXG52YXIgREVGQVVMVF9DT05URU5UX1RZUEUgPSB7XG4gICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkJ1xufTtcblxuZnVuY3Rpb24gc2V0Q29udGVudFR5cGVJZlVuc2V0KGhlYWRlcnMsIHZhbHVlKSB7XG4gIGlmICghdXRpbHMuaXNVbmRlZmluZWQoaGVhZGVycykgJiYgdXRpbHMuaXNVbmRlZmluZWQoaGVhZGVyc1snQ29udGVudC1UeXBlJ10pKSB7XG4gICAgaGVhZGVyc1snQ29udGVudC1UeXBlJ10gPSB2YWx1ZTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXREZWZhdWx0QWRhcHRlcigpIHtcbiAgdmFyIGFkYXB0ZXI7XG4gIGlmICh0eXBlb2YgWE1MSHR0cFJlcXVlc3QgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgLy8gRm9yIGJyb3dzZXJzIHVzZSBYSFIgYWRhcHRlclxuICAgIGFkYXB0ZXIgPSByZXF1aXJlKCcuL2FkYXB0ZXJzL3hocicpO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBwcm9jZXNzICE9PSAndW5kZWZpbmVkJykge1xuICAgIC8vIEZvciBub2RlIHVzZSBIVFRQIGFkYXB0ZXJcbiAgICBhZGFwdGVyID0gcmVxdWlyZSgnLi9hZGFwdGVycy9odHRwJyk7XG4gIH1cbiAgcmV0dXJuIGFkYXB0ZXI7XG59XG5cbnZhciBkZWZhdWx0cyA9IHtcbiAgYWRhcHRlcjogZ2V0RGVmYXVsdEFkYXB0ZXIoKSxcblxuICB0cmFuc2Zvcm1SZXF1ZXN0OiBbZnVuY3Rpb24gdHJhbnNmb3JtUmVxdWVzdChkYXRhLCBoZWFkZXJzKSB7XG4gICAgbm9ybWFsaXplSGVhZGVyTmFtZShoZWFkZXJzLCAnQ29udGVudC1UeXBlJyk7XG4gICAgaWYgKHV0aWxzLmlzRm9ybURhdGEoZGF0YSkgfHxcbiAgICAgIHV0aWxzLmlzQXJyYXlCdWZmZXIoZGF0YSkgfHxcbiAgICAgIHV0aWxzLmlzQnVmZmVyKGRhdGEpIHx8XG4gICAgICB1dGlscy5pc1N0cmVhbShkYXRhKSB8fFxuICAgICAgdXRpbHMuaXNGaWxlKGRhdGEpIHx8XG4gICAgICB1dGlscy5pc0Jsb2IoZGF0YSlcbiAgICApIHtcbiAgICAgIHJldHVybiBkYXRhO1xuICAgIH1cbiAgICBpZiAodXRpbHMuaXNBcnJheUJ1ZmZlclZpZXcoZGF0YSkpIHtcbiAgICAgIHJldHVybiBkYXRhLmJ1ZmZlcjtcbiAgICB9XG4gICAgaWYgKHV0aWxzLmlzVVJMU2VhcmNoUGFyYW1zKGRhdGEpKSB7XG4gICAgICBzZXRDb250ZW50VHlwZUlmVW5zZXQoaGVhZGVycywgJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZDtjaGFyc2V0PXV0Zi04Jyk7XG4gICAgICByZXR1cm4gZGF0YS50b1N0cmluZygpO1xuICAgIH1cbiAgICBpZiAodXRpbHMuaXNPYmplY3QoZGF0YSkpIHtcbiAgICAgIHNldENvbnRlbnRUeXBlSWZVbnNldChoZWFkZXJzLCAnYXBwbGljYXRpb24vanNvbjtjaGFyc2V0PXV0Zi04Jyk7XG4gICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoZGF0YSk7XG4gICAgfVxuICAgIHJldHVybiBkYXRhO1xuICB9XSxcblxuICB0cmFuc2Zvcm1SZXNwb25zZTogW2Z1bmN0aW9uIHRyYW5zZm9ybVJlc3BvbnNlKGRhdGEpIHtcbiAgICAvKmVzbGludCBuby1wYXJhbS1yZWFzc2lnbjowKi9cbiAgICBpZiAodHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnKSB7XG4gICAgICB0cnkge1xuICAgICAgICBkYXRhID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHsgLyogSWdub3JlICovIH1cbiAgICB9XG4gICAgcmV0dXJuIGRhdGE7XG4gIH1dLFxuXG4gIHRpbWVvdXQ6IDAsXG5cbiAgeHNyZkNvb2tpZU5hbWU6ICdYU1JGLVRPS0VOJyxcbiAgeHNyZkhlYWRlck5hbWU6ICdYLVhTUkYtVE9LRU4nLFxuXG4gIG1heENvbnRlbnRMZW5ndGg6IC0xLFxuXG4gIHZhbGlkYXRlU3RhdHVzOiBmdW5jdGlvbiB2YWxpZGF0ZVN0YXR1cyhzdGF0dXMpIHtcbiAgICByZXR1cm4gc3RhdHVzID49IDIwMCAmJiBzdGF0dXMgPCAzMDA7XG4gIH1cbn07XG5cbmRlZmF1bHRzLmhlYWRlcnMgPSB7XG4gIGNvbW1vbjoge1xuICAgICdBY2NlcHQnOiAnYXBwbGljYXRpb24vanNvbiwgdGV4dC9wbGFpbiwgKi8qJ1xuICB9XG59O1xuXG51dGlscy5mb3JFYWNoKFsnZGVsZXRlJywgJ2dldCcsICdoZWFkJ10sIGZ1bmN0aW9uIGZvckVhY2hNZXRob2ROb0RhdGEobWV0aG9kKSB7XG4gIGRlZmF1bHRzLmhlYWRlcnNbbWV0aG9kXSA9IHt9O1xufSk7XG5cbnV0aWxzLmZvckVhY2goWydwb3N0JywgJ3B1dCcsICdwYXRjaCddLCBmdW5jdGlvbiBmb3JFYWNoTWV0aG9kV2l0aERhdGEobWV0aG9kKSB7XG4gIGRlZmF1bHRzLmhlYWRlcnNbbWV0aG9kXSA9IHV0aWxzLm1lcmdlKERFRkFVTFRfQ09OVEVOVF9UWVBFKTtcbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGRlZmF1bHRzO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGJpbmQoZm4sIHRoaXNBcmcpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIHdyYXAoKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBhcmdzW2ldID0gYXJndW1lbnRzW2ldO1xuICAgIH1cbiAgICByZXR1cm4gZm4uYXBwbHkodGhpc0FyZywgYXJncyk7XG4gIH07XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vLyBidG9hIHBvbHlmaWxsIGZvciBJRTwxMCBjb3VydGVzeSBodHRwczovL2dpdGh1Yi5jb20vZGF2aWRjaGFtYmVycy9CYXNlNjQuanNcblxudmFyIGNoYXJzID0gJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky89JztcblxuZnVuY3Rpb24gRSgpIHtcbiAgdGhpcy5tZXNzYWdlID0gJ1N0cmluZyBjb250YWlucyBhbiBpbnZhbGlkIGNoYXJhY3Rlcic7XG59XG5FLnByb3RvdHlwZSA9IG5ldyBFcnJvcjtcbkUucHJvdG90eXBlLmNvZGUgPSA1O1xuRS5wcm90b3R5cGUubmFtZSA9ICdJbnZhbGlkQ2hhcmFjdGVyRXJyb3InO1xuXG5mdW5jdGlvbiBidG9hKGlucHV0KSB7XG4gIHZhciBzdHIgPSBTdHJpbmcoaW5wdXQpO1xuICB2YXIgb3V0cHV0ID0gJyc7XG4gIGZvciAoXG4gICAgLy8gaW5pdGlhbGl6ZSByZXN1bHQgYW5kIGNvdW50ZXJcbiAgICB2YXIgYmxvY2ssIGNoYXJDb2RlLCBpZHggPSAwLCBtYXAgPSBjaGFycztcbiAgICAvLyBpZiB0aGUgbmV4dCBzdHIgaW5kZXggZG9lcyBub3QgZXhpc3Q6XG4gICAgLy8gICBjaGFuZ2UgdGhlIG1hcHBpbmcgdGFibGUgdG8gXCI9XCJcbiAgICAvLyAgIGNoZWNrIGlmIGQgaGFzIG5vIGZyYWN0aW9uYWwgZGlnaXRzXG4gICAgc3RyLmNoYXJBdChpZHggfCAwKSB8fCAobWFwID0gJz0nLCBpZHggJSAxKTtcbiAgICAvLyBcIjggLSBpZHggJSAxICogOFwiIGdlbmVyYXRlcyB0aGUgc2VxdWVuY2UgMiwgNCwgNiwgOFxuICAgIG91dHB1dCArPSBtYXAuY2hhckF0KDYzICYgYmxvY2sgPj4gOCAtIGlkeCAlIDEgKiA4KVxuICApIHtcbiAgICBjaGFyQ29kZSA9IHN0ci5jaGFyQ29kZUF0KGlkeCArPSAzIC8gNCk7XG4gICAgaWYgKGNoYXJDb2RlID4gMHhGRikge1xuICAgICAgdGhyb3cgbmV3IEUoKTtcbiAgICB9XG4gICAgYmxvY2sgPSBibG9jayA8PCA4IHwgY2hhckNvZGU7XG4gIH1cbiAgcmV0dXJuIG91dHB1dDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBidG9hO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLy4uL3V0aWxzJyk7XG5cbmZ1bmN0aW9uIGVuY29kZSh2YWwpIHtcbiAgcmV0dXJuIGVuY29kZVVSSUNvbXBvbmVudCh2YWwpLlxuICAgIHJlcGxhY2UoLyU0MC9naSwgJ0AnKS5cbiAgICByZXBsYWNlKC8lM0EvZ2ksICc6JykuXG4gICAgcmVwbGFjZSgvJTI0L2csICckJykuXG4gICAgcmVwbGFjZSgvJTJDL2dpLCAnLCcpLlxuICAgIHJlcGxhY2UoLyUyMC9nLCAnKycpLlxuICAgIHJlcGxhY2UoLyU1Qi9naSwgJ1snKS5cbiAgICByZXBsYWNlKC8lNUQvZ2ksICddJyk7XG59XG5cbi8qKlxuICogQnVpbGQgYSBVUkwgYnkgYXBwZW5kaW5nIHBhcmFtcyB0byB0aGUgZW5kXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHVybCBUaGUgYmFzZSBvZiB0aGUgdXJsIChlLmcuLCBodHRwOi8vd3d3Lmdvb2dsZS5jb20pXG4gKiBAcGFyYW0ge29iamVjdH0gW3BhcmFtc10gVGhlIHBhcmFtcyB0byBiZSBhcHBlbmRlZFxuICogQHJldHVybnMge3N0cmluZ30gVGhlIGZvcm1hdHRlZCB1cmxcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBidWlsZFVSTCh1cmwsIHBhcmFtcywgcGFyYW1zU2VyaWFsaXplcikge1xuICAvKmVzbGludCBuby1wYXJhbS1yZWFzc2lnbjowKi9cbiAgaWYgKCFwYXJhbXMpIHtcbiAgICByZXR1cm4gdXJsO1xuICB9XG5cbiAgdmFyIHNlcmlhbGl6ZWRQYXJhbXM7XG4gIGlmIChwYXJhbXNTZXJpYWxpemVyKSB7XG4gICAgc2VyaWFsaXplZFBhcmFtcyA9IHBhcmFtc1NlcmlhbGl6ZXIocGFyYW1zKTtcbiAgfSBlbHNlIGlmICh1dGlscy5pc1VSTFNlYXJjaFBhcmFtcyhwYXJhbXMpKSB7XG4gICAgc2VyaWFsaXplZFBhcmFtcyA9IHBhcmFtcy50b1N0cmluZygpO1xuICB9IGVsc2Uge1xuICAgIHZhciBwYXJ0cyA9IFtdO1xuXG4gICAgdXRpbHMuZm9yRWFjaChwYXJhbXMsIGZ1bmN0aW9uIHNlcmlhbGl6ZSh2YWwsIGtleSkge1xuICAgICAgaWYgKHZhbCA9PT0gbnVsbCB8fCB0eXBlb2YgdmFsID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmICh1dGlscy5pc0FycmF5KHZhbCkpIHtcbiAgICAgICAga2V5ID0ga2V5ICsgJ1tdJztcbiAgICAgIH1cblxuICAgICAgaWYgKCF1dGlscy5pc0FycmF5KHZhbCkpIHtcbiAgICAgICAgdmFsID0gW3ZhbF07XG4gICAgICB9XG5cbiAgICAgIHV0aWxzLmZvckVhY2godmFsLCBmdW5jdGlvbiBwYXJzZVZhbHVlKHYpIHtcbiAgICAgICAgaWYgKHV0aWxzLmlzRGF0ZSh2KSkge1xuICAgICAgICAgIHYgPSB2LnRvSVNPU3RyaW5nKCk7XG4gICAgICAgIH0gZWxzZSBpZiAodXRpbHMuaXNPYmplY3QodikpIHtcbiAgICAgICAgICB2ID0gSlNPTi5zdHJpbmdpZnkodik7XG4gICAgICAgIH1cbiAgICAgICAgcGFydHMucHVzaChlbmNvZGUoa2V5KSArICc9JyArIGVuY29kZSh2KSk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIHNlcmlhbGl6ZWRQYXJhbXMgPSBwYXJ0cy5qb2luKCcmJyk7XG4gIH1cblxuICBpZiAoc2VyaWFsaXplZFBhcmFtcykge1xuICAgIHVybCArPSAodXJsLmluZGV4T2YoJz8nKSA9PT0gLTEgPyAnPycgOiAnJicpICsgc2VyaWFsaXplZFBhcmFtcztcbiAgfVxuXG4gIHJldHVybiB1cmw7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgVVJMIGJ5IGNvbWJpbmluZyB0aGUgc3BlY2lmaWVkIFVSTHNcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gYmFzZVVSTCBUaGUgYmFzZSBVUkxcbiAqIEBwYXJhbSB7c3RyaW5nfSByZWxhdGl2ZVVSTCBUaGUgcmVsYXRpdmUgVVJMXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgY29tYmluZWQgVVJMXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gY29tYmluZVVSTHMoYmFzZVVSTCwgcmVsYXRpdmVVUkwpIHtcbiAgcmV0dXJuIHJlbGF0aXZlVVJMXG4gICAgPyBiYXNlVVJMLnJlcGxhY2UoL1xcLyskLywgJycpICsgJy8nICsgcmVsYXRpdmVVUkwucmVwbGFjZSgvXlxcLysvLCAnJylcbiAgICA6IGJhc2VVUkw7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLy4uL3V0aWxzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gKFxuICB1dGlscy5pc1N0YW5kYXJkQnJvd3NlckVudigpID9cblxuICAvLyBTdGFuZGFyZCBicm93c2VyIGVudnMgc3VwcG9ydCBkb2N1bWVudC5jb29raWVcbiAgKGZ1bmN0aW9uIHN0YW5kYXJkQnJvd3NlckVudigpIHtcbiAgICByZXR1cm4ge1xuICAgICAgd3JpdGU6IGZ1bmN0aW9uIHdyaXRlKG5hbWUsIHZhbHVlLCBleHBpcmVzLCBwYXRoLCBkb21haW4sIHNlY3VyZSkge1xuICAgICAgICB2YXIgY29va2llID0gW107XG4gICAgICAgIGNvb2tpZS5wdXNoKG5hbWUgKyAnPScgKyBlbmNvZGVVUklDb21wb25lbnQodmFsdWUpKTtcblxuICAgICAgICBpZiAodXRpbHMuaXNOdW1iZXIoZXhwaXJlcykpIHtcbiAgICAgICAgICBjb29raWUucHVzaCgnZXhwaXJlcz0nICsgbmV3IERhdGUoZXhwaXJlcykudG9HTVRTdHJpbmcoKSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodXRpbHMuaXNTdHJpbmcocGF0aCkpIHtcbiAgICAgICAgICBjb29raWUucHVzaCgncGF0aD0nICsgcGF0aCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodXRpbHMuaXNTdHJpbmcoZG9tYWluKSkge1xuICAgICAgICAgIGNvb2tpZS5wdXNoKCdkb21haW49JyArIGRvbWFpbik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc2VjdXJlID09PSB0cnVlKSB7XG4gICAgICAgICAgY29va2llLnB1c2goJ3NlY3VyZScpO1xuICAgICAgICB9XG5cbiAgICAgICAgZG9jdW1lbnQuY29va2llID0gY29va2llLmpvaW4oJzsgJyk7XG4gICAgICB9LFxuXG4gICAgICByZWFkOiBmdW5jdGlvbiByZWFkKG5hbWUpIHtcbiAgICAgICAgdmFyIG1hdGNoID0gZG9jdW1lbnQuY29va2llLm1hdGNoKG5ldyBSZWdFeHAoJyhefDtcXFxccyopKCcgKyBuYW1lICsgJyk9KFteO10qKScpKTtcbiAgICAgICAgcmV0dXJuIChtYXRjaCA/IGRlY29kZVVSSUNvbXBvbmVudChtYXRjaFszXSkgOiBudWxsKTtcbiAgICAgIH0sXG5cbiAgICAgIHJlbW92ZTogZnVuY3Rpb24gcmVtb3ZlKG5hbWUpIHtcbiAgICAgICAgdGhpcy53cml0ZShuYW1lLCAnJywgRGF0ZS5ub3coKSAtIDg2NDAwMDAwKTtcbiAgICAgIH1cbiAgICB9O1xuICB9KSgpIDpcblxuICAvLyBOb24gc3RhbmRhcmQgYnJvd3NlciBlbnYgKHdlYiB3b3JrZXJzLCByZWFjdC1uYXRpdmUpIGxhY2sgbmVlZGVkIHN1cHBvcnQuXG4gIChmdW5jdGlvbiBub25TdGFuZGFyZEJyb3dzZXJFbnYoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHdyaXRlOiBmdW5jdGlvbiB3cml0ZSgpIHt9LFxuICAgICAgcmVhZDogZnVuY3Rpb24gcmVhZCgpIHsgcmV0dXJuIG51bGw7IH0sXG4gICAgICByZW1vdmU6IGZ1bmN0aW9uIHJlbW92ZSgpIHt9XG4gICAgfTtcbiAgfSkoKVxuKTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBEZXRlcm1pbmVzIHdoZXRoZXIgdGhlIHNwZWNpZmllZCBVUkwgaXMgYWJzb2x1dGVcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdXJsIFRoZSBVUkwgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIHNwZWNpZmllZCBVUkwgaXMgYWJzb2x1dGUsIG90aGVyd2lzZSBmYWxzZVxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGlzQWJzb2x1dGVVUkwodXJsKSB7XG4gIC8vIEEgVVJMIGlzIGNvbnNpZGVyZWQgYWJzb2x1dGUgaWYgaXQgYmVnaW5zIHdpdGggXCI8c2NoZW1lPjovL1wiIG9yIFwiLy9cIiAocHJvdG9jb2wtcmVsYXRpdmUgVVJMKS5cbiAgLy8gUkZDIDM5ODYgZGVmaW5lcyBzY2hlbWUgbmFtZSBhcyBhIHNlcXVlbmNlIG9mIGNoYXJhY3RlcnMgYmVnaW5uaW5nIHdpdGggYSBsZXR0ZXIgYW5kIGZvbGxvd2VkXG4gIC8vIGJ5IGFueSBjb21iaW5hdGlvbiBvZiBsZXR0ZXJzLCBkaWdpdHMsIHBsdXMsIHBlcmlvZCwgb3IgaHlwaGVuLlxuICByZXR1cm4gL14oW2Etel1bYS16XFxkXFwrXFwtXFwuXSo6KT9cXC9cXC8vaS50ZXN0KHVybCk7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLy4uL3V0aWxzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gKFxuICB1dGlscy5pc1N0YW5kYXJkQnJvd3NlckVudigpID9cblxuICAvLyBTdGFuZGFyZCBicm93c2VyIGVudnMgaGF2ZSBmdWxsIHN1cHBvcnQgb2YgdGhlIEFQSXMgbmVlZGVkIHRvIHRlc3RcbiAgLy8gd2hldGhlciB0aGUgcmVxdWVzdCBVUkwgaXMgb2YgdGhlIHNhbWUgb3JpZ2luIGFzIGN1cnJlbnQgbG9jYXRpb24uXG4gIChmdW5jdGlvbiBzdGFuZGFyZEJyb3dzZXJFbnYoKSB7XG4gICAgdmFyIG1zaWUgPSAvKG1zaWV8dHJpZGVudCkvaS50ZXN0KG5hdmlnYXRvci51c2VyQWdlbnQpO1xuICAgIHZhciB1cmxQYXJzaW5nTm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcbiAgICB2YXIgb3JpZ2luVVJMO1xuXG4gICAgLyoqXG4gICAgKiBQYXJzZSBhIFVSTCB0byBkaXNjb3ZlciBpdCdzIGNvbXBvbmVudHNcbiAgICAqXG4gICAgKiBAcGFyYW0ge1N0cmluZ30gdXJsIFRoZSBVUkwgdG8gYmUgcGFyc2VkXG4gICAgKiBAcmV0dXJucyB7T2JqZWN0fVxuICAgICovXG4gICAgZnVuY3Rpb24gcmVzb2x2ZVVSTCh1cmwpIHtcbiAgICAgIHZhciBocmVmID0gdXJsO1xuXG4gICAgICBpZiAobXNpZSkge1xuICAgICAgICAvLyBJRSBuZWVkcyBhdHRyaWJ1dGUgc2V0IHR3aWNlIHRvIG5vcm1hbGl6ZSBwcm9wZXJ0aWVzXG4gICAgICAgIHVybFBhcnNpbmdOb2RlLnNldEF0dHJpYnV0ZSgnaHJlZicsIGhyZWYpO1xuICAgICAgICBocmVmID0gdXJsUGFyc2luZ05vZGUuaHJlZjtcbiAgICAgIH1cblxuICAgICAgdXJsUGFyc2luZ05vZGUuc2V0QXR0cmlidXRlKCdocmVmJywgaHJlZik7XG5cbiAgICAgIC8vIHVybFBhcnNpbmdOb2RlIHByb3ZpZGVzIHRoZSBVcmxVdGlscyBpbnRlcmZhY2UgLSBodHRwOi8vdXJsLnNwZWMud2hhdHdnLm9yZy8jdXJsdXRpbHNcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGhyZWY6IHVybFBhcnNpbmdOb2RlLmhyZWYsXG4gICAgICAgIHByb3RvY29sOiB1cmxQYXJzaW5nTm9kZS5wcm90b2NvbCA/IHVybFBhcnNpbmdOb2RlLnByb3RvY29sLnJlcGxhY2UoLzokLywgJycpIDogJycsXG4gICAgICAgIGhvc3Q6IHVybFBhcnNpbmdOb2RlLmhvc3QsXG4gICAgICAgIHNlYXJjaDogdXJsUGFyc2luZ05vZGUuc2VhcmNoID8gdXJsUGFyc2luZ05vZGUuc2VhcmNoLnJlcGxhY2UoL15cXD8vLCAnJykgOiAnJyxcbiAgICAgICAgaGFzaDogdXJsUGFyc2luZ05vZGUuaGFzaCA/IHVybFBhcnNpbmdOb2RlLmhhc2gucmVwbGFjZSgvXiMvLCAnJykgOiAnJyxcbiAgICAgICAgaG9zdG5hbWU6IHVybFBhcnNpbmdOb2RlLmhvc3RuYW1lLFxuICAgICAgICBwb3J0OiB1cmxQYXJzaW5nTm9kZS5wb3J0LFxuICAgICAgICBwYXRobmFtZTogKHVybFBhcnNpbmdOb2RlLnBhdGhuYW1lLmNoYXJBdCgwKSA9PT0gJy8nKSA/XG4gICAgICAgICAgICAgICAgICB1cmxQYXJzaW5nTm9kZS5wYXRobmFtZSA6XG4gICAgICAgICAgICAgICAgICAnLycgKyB1cmxQYXJzaW5nTm9kZS5wYXRobmFtZVxuICAgICAgfTtcbiAgICB9XG5cbiAgICBvcmlnaW5VUkwgPSByZXNvbHZlVVJMKHdpbmRvdy5sb2NhdGlvbi5ocmVmKTtcblxuICAgIC8qKlxuICAgICogRGV0ZXJtaW5lIGlmIGEgVVJMIHNoYXJlcyB0aGUgc2FtZSBvcmlnaW4gYXMgdGhlIGN1cnJlbnQgbG9jYXRpb25cbiAgICAqXG4gICAgKiBAcGFyYW0ge1N0cmluZ30gcmVxdWVzdFVSTCBUaGUgVVJMIHRvIHRlc3RcbiAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIFVSTCBzaGFyZXMgdGhlIHNhbWUgb3JpZ2luLCBvdGhlcndpc2UgZmFsc2VcbiAgICAqL1xuICAgIHJldHVybiBmdW5jdGlvbiBpc1VSTFNhbWVPcmlnaW4ocmVxdWVzdFVSTCkge1xuICAgICAgdmFyIHBhcnNlZCA9ICh1dGlscy5pc1N0cmluZyhyZXF1ZXN0VVJMKSkgPyByZXNvbHZlVVJMKHJlcXVlc3RVUkwpIDogcmVxdWVzdFVSTDtcbiAgICAgIHJldHVybiAocGFyc2VkLnByb3RvY29sID09PSBvcmlnaW5VUkwucHJvdG9jb2wgJiZcbiAgICAgICAgICAgIHBhcnNlZC5ob3N0ID09PSBvcmlnaW5VUkwuaG9zdCk7XG4gICAgfTtcbiAgfSkoKSA6XG5cbiAgLy8gTm9uIHN0YW5kYXJkIGJyb3dzZXIgZW52cyAod2ViIHdvcmtlcnMsIHJlYWN0LW5hdGl2ZSkgbGFjayBuZWVkZWQgc3VwcG9ydC5cbiAgKGZ1bmN0aW9uIG5vblN0YW5kYXJkQnJvd3NlckVudigpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gaXNVUkxTYW1lT3JpZ2luKCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfTtcbiAgfSkoKVxuKTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbHMnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBub3JtYWxpemVIZWFkZXJOYW1lKGhlYWRlcnMsIG5vcm1hbGl6ZWROYW1lKSB7XG4gIHV0aWxzLmZvckVhY2goaGVhZGVycywgZnVuY3Rpb24gcHJvY2Vzc0hlYWRlcih2YWx1ZSwgbmFtZSkge1xuICAgIGlmIChuYW1lICE9PSBub3JtYWxpemVkTmFtZSAmJiBuYW1lLnRvVXBwZXJDYXNlKCkgPT09IG5vcm1hbGl6ZWROYW1lLnRvVXBwZXJDYXNlKCkpIHtcbiAgICAgIGhlYWRlcnNbbm9ybWFsaXplZE5hbWVdID0gdmFsdWU7XG4gICAgICBkZWxldGUgaGVhZGVyc1tuYW1lXTtcbiAgICB9XG4gIH0pO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi8uLi91dGlscycpO1xuXG4vKipcbiAqIFBhcnNlIGhlYWRlcnMgaW50byBhbiBvYmplY3RcbiAqXG4gKiBgYGBcbiAqIERhdGU6IFdlZCwgMjcgQXVnIDIwMTQgMDg6NTg6NDkgR01UXG4gKiBDb250ZW50LVR5cGU6IGFwcGxpY2F0aW9uL2pzb25cbiAqIENvbm5lY3Rpb246IGtlZXAtYWxpdmVcbiAqIFRyYW5zZmVyLUVuY29kaW5nOiBjaHVua2VkXG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gaGVhZGVycyBIZWFkZXJzIG5lZWRpbmcgdG8gYmUgcGFyc2VkXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBIZWFkZXJzIHBhcnNlZCBpbnRvIGFuIG9iamVjdFxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIHBhcnNlSGVhZGVycyhoZWFkZXJzKSB7XG4gIHZhciBwYXJzZWQgPSB7fTtcbiAgdmFyIGtleTtcbiAgdmFyIHZhbDtcbiAgdmFyIGk7XG5cbiAgaWYgKCFoZWFkZXJzKSB7IHJldHVybiBwYXJzZWQ7IH1cblxuICB1dGlscy5mb3JFYWNoKGhlYWRlcnMuc3BsaXQoJ1xcbicpLCBmdW5jdGlvbiBwYXJzZXIobGluZSkge1xuICAgIGkgPSBsaW5lLmluZGV4T2YoJzonKTtcbiAgICBrZXkgPSB1dGlscy50cmltKGxpbmUuc3Vic3RyKDAsIGkpKS50b0xvd2VyQ2FzZSgpO1xuICAgIHZhbCA9IHV0aWxzLnRyaW0obGluZS5zdWJzdHIoaSArIDEpKTtcblxuICAgIGlmIChrZXkpIHtcbiAgICAgIHBhcnNlZFtrZXldID0gcGFyc2VkW2tleV0gPyBwYXJzZWRba2V5XSArICcsICcgKyB2YWwgOiB2YWw7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gcGFyc2VkO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBTeW50YWN0aWMgc3VnYXIgZm9yIGludm9raW5nIGEgZnVuY3Rpb24gYW5kIGV4cGFuZGluZyBhbiBhcnJheSBmb3IgYXJndW1lbnRzLlxuICpcbiAqIENvbW1vbiB1c2UgY2FzZSB3b3VsZCBiZSB0byB1c2UgYEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseWAuXG4gKlxuICogIGBgYGpzXG4gKiAgZnVuY3Rpb24gZih4LCB5LCB6KSB7fVxuICogIHZhciBhcmdzID0gWzEsIDIsIDNdO1xuICogIGYuYXBwbHkobnVsbCwgYXJncyk7XG4gKiAgYGBgXG4gKlxuICogV2l0aCBgc3ByZWFkYCB0aGlzIGV4YW1wbGUgY2FuIGJlIHJlLXdyaXR0ZW4uXG4gKlxuICogIGBgYGpzXG4gKiAgc3ByZWFkKGZ1bmN0aW9uKHgsIHksIHopIHt9KShbMSwgMiwgM10pO1xuICogIGBgYFxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259XG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gc3ByZWFkKGNhbGxiYWNrKSB7XG4gIHJldHVybiBmdW5jdGlvbiB3cmFwKGFycikge1xuICAgIHJldHVybiBjYWxsYmFjay5hcHBseShudWxsLCBhcnIpO1xuICB9O1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGJpbmQgPSByZXF1aXJlKCcuL2hlbHBlcnMvYmluZCcpO1xudmFyIGlzQnVmZmVyID0gcmVxdWlyZSgnaXMtYnVmZmVyJyk7XG5cbi8qZ2xvYmFsIHRvU3RyaW5nOnRydWUqL1xuXG4vLyB1dGlscyBpcyBhIGxpYnJhcnkgb2YgZ2VuZXJpYyBoZWxwZXIgZnVuY3Rpb25zIG5vbi1zcGVjaWZpYyB0byBheGlvc1xuXG52YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIGFuIEFycmF5XG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbCBUaGUgdmFsdWUgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdmFsdWUgaXMgYW4gQXJyYXksIG90aGVyd2lzZSBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0FycmF5KHZhbCkge1xuICByZXR1cm4gdG9TdHJpbmcuY2FsbCh2YWwpID09PSAnW29iamVjdCBBcnJheV0nO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIGFuIEFycmF5QnVmZmVyXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbCBUaGUgdmFsdWUgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdmFsdWUgaXMgYW4gQXJyYXlCdWZmZXIsIG90aGVyd2lzZSBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0FycmF5QnVmZmVyKHZhbCkge1xuICByZXR1cm4gdG9TdHJpbmcuY2FsbCh2YWwpID09PSAnW29iamVjdCBBcnJheUJ1ZmZlcl0nO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIGEgRm9ybURhdGFcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsIFRoZSB2YWx1ZSB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB2YWx1ZSBpcyBhbiBGb3JtRGF0YSwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzRm9ybURhdGEodmFsKSB7XG4gIHJldHVybiAodHlwZW9mIEZvcm1EYXRhICE9PSAndW5kZWZpbmVkJykgJiYgKHZhbCBpbnN0YW5jZW9mIEZvcm1EYXRhKTtcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgYSB2YWx1ZSBpcyBhIHZpZXcgb24gYW4gQXJyYXlCdWZmZXJcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsIFRoZSB2YWx1ZSB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB2YWx1ZSBpcyBhIHZpZXcgb24gYW4gQXJyYXlCdWZmZXIsIG90aGVyd2lzZSBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0FycmF5QnVmZmVyVmlldyh2YWwpIHtcbiAgdmFyIHJlc3VsdDtcbiAgaWYgKCh0eXBlb2YgQXJyYXlCdWZmZXIgIT09ICd1bmRlZmluZWQnKSAmJiAoQXJyYXlCdWZmZXIuaXNWaWV3KSkge1xuICAgIHJlc3VsdCA9IEFycmF5QnVmZmVyLmlzVmlldyh2YWwpO1xuICB9IGVsc2Uge1xuICAgIHJlc3VsdCA9ICh2YWwpICYmICh2YWwuYnVmZmVyKSAmJiAodmFsLmJ1ZmZlciBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIGEgU3RyaW5nXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbCBUaGUgdmFsdWUgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdmFsdWUgaXMgYSBTdHJpbmcsIG90aGVyd2lzZSBmYWxzZVxuICovXG5mdW5jdGlvbiBpc1N0cmluZyh2YWwpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWwgPT09ICdzdHJpbmcnO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIGEgTnVtYmVyXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbCBUaGUgdmFsdWUgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdmFsdWUgaXMgYSBOdW1iZXIsIG90aGVyd2lzZSBmYWxzZVxuICovXG5mdW5jdGlvbiBpc051bWJlcih2YWwpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWwgPT09ICdudW1iZXInO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIHVuZGVmaW5lZFxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSB2YWx1ZSBpcyB1bmRlZmluZWQsIG90aGVyd2lzZSBmYWxzZVxuICovXG5mdW5jdGlvbiBpc1VuZGVmaW5lZCh2YWwpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWwgPT09ICd1bmRlZmluZWQnO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIGFuIE9iamVjdFxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHZhbHVlIGlzIGFuIE9iamVjdCwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzT2JqZWN0KHZhbCkge1xuICByZXR1cm4gdmFsICE9PSBudWxsICYmIHR5cGVvZiB2YWwgPT09ICdvYmplY3QnO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIGEgRGF0ZVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHZhbHVlIGlzIGEgRGF0ZSwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzRGF0ZSh2YWwpIHtcbiAgcmV0dXJuIHRvU3RyaW5nLmNhbGwodmFsKSA9PT0gJ1tvYmplY3QgRGF0ZV0nO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIGEgRmlsZVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHZhbHVlIGlzIGEgRmlsZSwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzRmlsZSh2YWwpIHtcbiAgcmV0dXJuIHRvU3RyaW5nLmNhbGwodmFsKSA9PT0gJ1tvYmplY3QgRmlsZV0nO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIGEgQmxvYlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHZhbHVlIGlzIGEgQmxvYiwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzQmxvYih2YWwpIHtcbiAgcmV0dXJuIHRvU3RyaW5nLmNhbGwodmFsKSA9PT0gJ1tvYmplY3QgQmxvYl0nO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIGEgRnVuY3Rpb25cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsIFRoZSB2YWx1ZSB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB2YWx1ZSBpcyBhIEZ1bmN0aW9uLCBvdGhlcndpc2UgZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNGdW5jdGlvbih2YWwpIHtcbiAgcmV0dXJuIHRvU3RyaW5nLmNhbGwodmFsKSA9PT0gJ1tvYmplY3QgRnVuY3Rpb25dJztcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgYSB2YWx1ZSBpcyBhIFN0cmVhbVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHZhbHVlIGlzIGEgU3RyZWFtLCBvdGhlcndpc2UgZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNTdHJlYW0odmFsKSB7XG4gIHJldHVybiBpc09iamVjdCh2YWwpICYmIGlzRnVuY3Rpb24odmFsLnBpcGUpO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIGEgVVJMU2VhcmNoUGFyYW1zIG9iamVjdFxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHZhbHVlIGlzIGEgVVJMU2VhcmNoUGFyYW1zIG9iamVjdCwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzVVJMU2VhcmNoUGFyYW1zKHZhbCkge1xuICByZXR1cm4gdHlwZW9mIFVSTFNlYXJjaFBhcmFtcyAhPT0gJ3VuZGVmaW5lZCcgJiYgdmFsIGluc3RhbmNlb2YgVVJMU2VhcmNoUGFyYW1zO1xufVxuXG4vKipcbiAqIFRyaW0gZXhjZXNzIHdoaXRlc3BhY2Ugb2ZmIHRoZSBiZWdpbm5pbmcgYW5kIGVuZCBvZiBhIHN0cmluZ1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgVGhlIFN0cmluZyB0byB0cmltXG4gKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgU3RyaW5nIGZyZWVkIG9mIGV4Y2VzcyB3aGl0ZXNwYWNlXG4gKi9cbmZ1bmN0aW9uIHRyaW0oc3RyKSB7XG4gIHJldHVybiBzdHIucmVwbGFjZSgvXlxccyovLCAnJykucmVwbGFjZSgvXFxzKiQvLCAnJyk7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIHdlJ3JlIHJ1bm5pbmcgaW4gYSBzdGFuZGFyZCBicm93c2VyIGVudmlyb25tZW50XG4gKlxuICogVGhpcyBhbGxvd3MgYXhpb3MgdG8gcnVuIGluIGEgd2ViIHdvcmtlciwgYW5kIHJlYWN0LW5hdGl2ZS5cbiAqIEJvdGggZW52aXJvbm1lbnRzIHN1cHBvcnQgWE1MSHR0cFJlcXVlc3QsIGJ1dCBub3QgZnVsbHkgc3RhbmRhcmQgZ2xvYmFscy5cbiAqXG4gKiB3ZWIgd29ya2VyczpcbiAqICB0eXBlb2Ygd2luZG93IC0+IHVuZGVmaW5lZFxuICogIHR5cGVvZiBkb2N1bWVudCAtPiB1bmRlZmluZWRcbiAqXG4gKiByZWFjdC1uYXRpdmU6XG4gKiAgbmF2aWdhdG9yLnByb2R1Y3QgLT4gJ1JlYWN0TmF0aXZlJ1xuICovXG5mdW5jdGlvbiBpc1N0YW5kYXJkQnJvd3NlckVudigpIHtcbiAgaWYgKHR5cGVvZiBuYXZpZ2F0b3IgIT09ICd1bmRlZmluZWQnICYmIG5hdmlnYXRvci5wcm9kdWN0ID09PSAnUmVhY3ROYXRpdmUnKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiAoXG4gICAgdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICB0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnXG4gICk7XG59XG5cbi8qKlxuICogSXRlcmF0ZSBvdmVyIGFuIEFycmF5IG9yIGFuIE9iamVjdCBpbnZva2luZyBhIGZ1bmN0aW9uIGZvciBlYWNoIGl0ZW0uXG4gKlxuICogSWYgYG9iamAgaXMgYW4gQXJyYXkgY2FsbGJhY2sgd2lsbCBiZSBjYWxsZWQgcGFzc2luZ1xuICogdGhlIHZhbHVlLCBpbmRleCwgYW5kIGNvbXBsZXRlIGFycmF5IGZvciBlYWNoIGl0ZW0uXG4gKlxuICogSWYgJ29iaicgaXMgYW4gT2JqZWN0IGNhbGxiYWNrIHdpbGwgYmUgY2FsbGVkIHBhc3NpbmdcbiAqIHRoZSB2YWx1ZSwga2V5LCBhbmQgY29tcGxldGUgb2JqZWN0IGZvciBlYWNoIHByb3BlcnR5LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fEFycmF5fSBvYmogVGhlIG9iamVjdCB0byBpdGVyYXRlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmbiBUaGUgY2FsbGJhY2sgdG8gaW52b2tlIGZvciBlYWNoIGl0ZW1cbiAqL1xuZnVuY3Rpb24gZm9yRWFjaChvYmosIGZuKSB7XG4gIC8vIERvbid0IGJvdGhlciBpZiBubyB2YWx1ZSBwcm92aWRlZFxuICBpZiAob2JqID09PSBudWxsIHx8IHR5cGVvZiBvYmogPT09ICd1bmRlZmluZWQnKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gRm9yY2UgYW4gYXJyYXkgaWYgbm90IGFscmVhZHkgc29tZXRoaW5nIGl0ZXJhYmxlXG4gIGlmICh0eXBlb2Ygb2JqICE9PSAnb2JqZWN0JyAmJiAhaXNBcnJheShvYmopKSB7XG4gICAgLyplc2xpbnQgbm8tcGFyYW0tcmVhc3NpZ246MCovXG4gICAgb2JqID0gW29ial07XG4gIH1cblxuICBpZiAoaXNBcnJheShvYmopKSB7XG4gICAgLy8gSXRlcmF0ZSBvdmVyIGFycmF5IHZhbHVlc1xuICAgIGZvciAodmFyIGkgPSAwLCBsID0gb2JqLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgZm4uY2FsbChudWxsLCBvYmpbaV0sIGksIG9iaik7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIC8vIEl0ZXJhdGUgb3ZlciBvYmplY3Qga2V5c1xuICAgIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBrZXkpKSB7XG4gICAgICAgIGZuLmNhbGwobnVsbCwgb2JqW2tleV0sIGtleSwgb2JqKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBBY2NlcHRzIHZhcmFyZ3MgZXhwZWN0aW5nIGVhY2ggYXJndW1lbnQgdG8gYmUgYW4gb2JqZWN0LCB0aGVuXG4gKiBpbW11dGFibHkgbWVyZ2VzIHRoZSBwcm9wZXJ0aWVzIG9mIGVhY2ggb2JqZWN0IGFuZCByZXR1cm5zIHJlc3VsdC5cbiAqXG4gKiBXaGVuIG11bHRpcGxlIG9iamVjdHMgY29udGFpbiB0aGUgc2FtZSBrZXkgdGhlIGxhdGVyIG9iamVjdCBpblxuICogdGhlIGFyZ3VtZW50cyBsaXN0IHdpbGwgdGFrZSBwcmVjZWRlbmNlLlxuICpcbiAqIEV4YW1wbGU6XG4gKlxuICogYGBganNcbiAqIHZhciByZXN1bHQgPSBtZXJnZSh7Zm9vOiAxMjN9LCB7Zm9vOiA0NTZ9KTtcbiAqIGNvbnNvbGUubG9nKHJlc3VsdC5mb28pOyAvLyBvdXRwdXRzIDQ1NlxuICogYGBgXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9iajEgT2JqZWN0IHRvIG1lcmdlXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBSZXN1bHQgb2YgYWxsIG1lcmdlIHByb3BlcnRpZXNcbiAqL1xuZnVuY3Rpb24gbWVyZ2UoLyogb2JqMSwgb2JqMiwgb2JqMywgLi4uICovKSB7XG4gIHZhciByZXN1bHQgPSB7fTtcbiAgZnVuY3Rpb24gYXNzaWduVmFsdWUodmFsLCBrZXkpIHtcbiAgICBpZiAodHlwZW9mIHJlc3VsdFtrZXldID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgdmFsID09PSAnb2JqZWN0Jykge1xuICAgICAgcmVzdWx0W2tleV0gPSBtZXJnZShyZXN1bHRba2V5XSwgdmFsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0W2tleV0gPSB2YWw7XG4gICAgfVxuICB9XG5cbiAgZm9yICh2YXIgaSA9IDAsIGwgPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgZm9yRWFjaChhcmd1bWVudHNbaV0sIGFzc2lnblZhbHVlKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIEV4dGVuZHMgb2JqZWN0IGEgYnkgbXV0YWJseSBhZGRpbmcgdG8gaXQgdGhlIHByb3BlcnRpZXMgb2Ygb2JqZWN0IGIuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGEgVGhlIG9iamVjdCB0byBiZSBleHRlbmRlZFxuICogQHBhcmFtIHtPYmplY3R9IGIgVGhlIG9iamVjdCB0byBjb3B5IHByb3BlcnRpZXMgZnJvbVxuICogQHBhcmFtIHtPYmplY3R9IHRoaXNBcmcgVGhlIG9iamVjdCB0byBiaW5kIGZ1bmN0aW9uIHRvXG4gKiBAcmV0dXJuIHtPYmplY3R9IFRoZSByZXN1bHRpbmcgdmFsdWUgb2Ygb2JqZWN0IGFcbiAqL1xuZnVuY3Rpb24gZXh0ZW5kKGEsIGIsIHRoaXNBcmcpIHtcbiAgZm9yRWFjaChiLCBmdW5jdGlvbiBhc3NpZ25WYWx1ZSh2YWwsIGtleSkge1xuICAgIGlmICh0aGlzQXJnICYmIHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGFba2V5XSA9IGJpbmQodmFsLCB0aGlzQXJnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgYVtrZXldID0gdmFsO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBhO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgaXNBcnJheTogaXNBcnJheSxcbiAgaXNBcnJheUJ1ZmZlcjogaXNBcnJheUJ1ZmZlcixcbiAgaXNCdWZmZXI6IGlzQnVmZmVyLFxuICBpc0Zvcm1EYXRhOiBpc0Zvcm1EYXRhLFxuICBpc0FycmF5QnVmZmVyVmlldzogaXNBcnJheUJ1ZmZlclZpZXcsXG4gIGlzU3RyaW5nOiBpc1N0cmluZyxcbiAgaXNOdW1iZXI6IGlzTnVtYmVyLFxuICBpc09iamVjdDogaXNPYmplY3QsXG4gIGlzVW5kZWZpbmVkOiBpc1VuZGVmaW5lZCxcbiAgaXNEYXRlOiBpc0RhdGUsXG4gIGlzRmlsZTogaXNGaWxlLFxuICBpc0Jsb2I6IGlzQmxvYixcbiAgaXNGdW5jdGlvbjogaXNGdW5jdGlvbixcbiAgaXNTdHJlYW06IGlzU3RyZWFtLFxuICBpc1VSTFNlYXJjaFBhcmFtczogaXNVUkxTZWFyY2hQYXJhbXMsXG4gIGlzU3RhbmRhcmRCcm93c2VyRW52OiBpc1N0YW5kYXJkQnJvd3NlckVudixcbiAgZm9yRWFjaDogZm9yRWFjaCxcbiAgbWVyZ2U6IG1lcmdlLFxuICBleHRlbmQ6IGV4dGVuZCxcbiAgdHJpbTogdHJpbVxufTtcbiIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTMtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICpcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBfYXNzaWduID0gcmVxdWlyZSgnb2JqZWN0LWFzc2lnbicpO1xuXG52YXIgZW1wdHlPYmplY3QgPSByZXF1aXJlKCdmYmpzL2xpYi9lbXB0eU9iamVjdCcpO1xudmFyIF9pbnZhcmlhbnQgPSByZXF1aXJlKCdmYmpzL2xpYi9pbnZhcmlhbnQnKTtcblxuaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgdmFyIHdhcm5pbmcgPSByZXF1aXJlKCdmYmpzL2xpYi93YXJuaW5nJyk7XG59XG5cbnZhciBNSVhJTlNfS0VZID0gJ21peGlucyc7XG5cbi8vIEhlbHBlciBmdW5jdGlvbiB0byBhbGxvdyB0aGUgY3JlYXRpb24gb2YgYW5vbnltb3VzIGZ1bmN0aW9ucyB3aGljaCBkbyBub3Rcbi8vIGhhdmUgLm5hbWUgc2V0IHRvIHRoZSBuYW1lIG9mIHRoZSB2YXJpYWJsZSBiZWluZyBhc3NpZ25lZCB0by5cbmZ1bmN0aW9uIGlkZW50aXR5KGZuKSB7XG4gIHJldHVybiBmbjtcbn1cblxudmFyIFJlYWN0UHJvcFR5cGVMb2NhdGlvbk5hbWVzO1xuaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgUmVhY3RQcm9wVHlwZUxvY2F0aW9uTmFtZXMgPSB7XG4gICAgcHJvcDogJ3Byb3AnLFxuICAgIGNvbnRleHQ6ICdjb250ZXh0JyxcbiAgICBjaGlsZENvbnRleHQ6ICdjaGlsZCBjb250ZXh0J1xuICB9O1xufSBlbHNlIHtcbiAgUmVhY3RQcm9wVHlwZUxvY2F0aW9uTmFtZXMgPSB7fTtcbn1cblxuZnVuY3Rpb24gZmFjdG9yeShSZWFjdENvbXBvbmVudCwgaXNWYWxpZEVsZW1lbnQsIFJlYWN0Tm9vcFVwZGF0ZVF1ZXVlKSB7XG4gIC8qKlxuICAgKiBQb2xpY2llcyB0aGF0IGRlc2NyaWJlIG1ldGhvZHMgaW4gYFJlYWN0Q2xhc3NJbnRlcmZhY2VgLlxuICAgKi9cblxuICB2YXIgaW5qZWN0ZWRNaXhpbnMgPSBbXTtcblxuICAvKipcbiAgICogQ29tcG9zaXRlIGNvbXBvbmVudHMgYXJlIGhpZ2hlci1sZXZlbCBjb21wb25lbnRzIHRoYXQgY29tcG9zZSBvdGhlciBjb21wb3NpdGVcbiAgICogb3IgaG9zdCBjb21wb25lbnRzLlxuICAgKlxuICAgKiBUbyBjcmVhdGUgYSBuZXcgdHlwZSBvZiBgUmVhY3RDbGFzc2AsIHBhc3MgYSBzcGVjaWZpY2F0aW9uIG9mXG4gICAqIHlvdXIgbmV3IGNsYXNzIHRvIGBSZWFjdC5jcmVhdGVDbGFzc2AuIFRoZSBvbmx5IHJlcXVpcmVtZW50IG9mIHlvdXIgY2xhc3NcbiAgICogc3BlY2lmaWNhdGlvbiBpcyB0aGF0IHlvdSBpbXBsZW1lbnQgYSBgcmVuZGVyYCBtZXRob2QuXG4gICAqXG4gICAqICAgdmFyIE15Q29tcG9uZW50ID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuICAgKiAgICAgcmVuZGVyOiBmdW5jdGlvbigpIHtcbiAgICogICAgICAgcmV0dXJuIDxkaXY+SGVsbG8gV29ybGQ8L2Rpdj47XG4gICAqICAgICB9XG4gICAqICAgfSk7XG4gICAqXG4gICAqIFRoZSBjbGFzcyBzcGVjaWZpY2F0aW9uIHN1cHBvcnRzIGEgc3BlY2lmaWMgcHJvdG9jb2wgb2YgbWV0aG9kcyB0aGF0IGhhdmVcbiAgICogc3BlY2lhbCBtZWFuaW5nIChlLmcuIGByZW5kZXJgKS4gU2VlIGBSZWFjdENsYXNzSW50ZXJmYWNlYCBmb3JcbiAgICogbW9yZSB0aGUgY29tcHJlaGVuc2l2ZSBwcm90b2NvbC4gQW55IG90aGVyIHByb3BlcnRpZXMgYW5kIG1ldGhvZHMgaW4gdGhlXG4gICAqIGNsYXNzIHNwZWNpZmljYXRpb24gd2lsbCBiZSBhdmFpbGFibGUgb24gdGhlIHByb3RvdHlwZS5cbiAgICpcbiAgICogQGludGVyZmFjZSBSZWFjdENsYXNzSW50ZXJmYWNlXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgdmFyIFJlYWN0Q2xhc3NJbnRlcmZhY2UgPSB7XG4gICAgLyoqXG4gICAgICogQW4gYXJyYXkgb2YgTWl4aW4gb2JqZWN0cyB0byBpbmNsdWRlIHdoZW4gZGVmaW5pbmcgeW91ciBjb21wb25lbnQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7YXJyYXl9XG4gICAgICogQG9wdGlvbmFsXG4gICAgICovXG4gICAgbWl4aW5zOiAnREVGSU5FX01BTlknLFxuXG4gICAgLyoqXG4gICAgICogQW4gb2JqZWN0IGNvbnRhaW5pbmcgcHJvcGVydGllcyBhbmQgbWV0aG9kcyB0aGF0IHNob3VsZCBiZSBkZWZpbmVkIG9uXG4gICAgICogdGhlIGNvbXBvbmVudCdzIGNvbnN0cnVjdG9yIGluc3RlYWQgb2YgaXRzIHByb3RvdHlwZSAoc3RhdGljIG1ldGhvZHMpLlxuICAgICAqXG4gICAgICogQHR5cGUge29iamVjdH1cbiAgICAgKiBAb3B0aW9uYWxcbiAgICAgKi9cbiAgICBzdGF0aWNzOiAnREVGSU5FX01BTlknLFxuXG4gICAgLyoqXG4gICAgICogRGVmaW5pdGlvbiBvZiBwcm9wIHR5cGVzIGZvciB0aGlzIGNvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtvYmplY3R9XG4gICAgICogQG9wdGlvbmFsXG4gICAgICovXG4gICAgcHJvcFR5cGVzOiAnREVGSU5FX01BTlknLFxuXG4gICAgLyoqXG4gICAgICogRGVmaW5pdGlvbiBvZiBjb250ZXh0IHR5cGVzIGZvciB0aGlzIGNvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtvYmplY3R9XG4gICAgICogQG9wdGlvbmFsXG4gICAgICovXG4gICAgY29udGV4dFR5cGVzOiAnREVGSU5FX01BTlknLFxuXG4gICAgLyoqXG4gICAgICogRGVmaW5pdGlvbiBvZiBjb250ZXh0IHR5cGVzIHRoaXMgY29tcG9uZW50IHNldHMgZm9yIGl0cyBjaGlsZHJlbi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtvYmplY3R9XG4gICAgICogQG9wdGlvbmFsXG4gICAgICovXG4gICAgY2hpbGRDb250ZXh0VHlwZXM6ICdERUZJTkVfTUFOWScsXG5cbiAgICAvLyA9PT09IERlZmluaXRpb24gbWV0aG9kcyA9PT09XG5cbiAgICAvKipcbiAgICAgKiBJbnZva2VkIHdoZW4gdGhlIGNvbXBvbmVudCBpcyBtb3VudGVkLiBWYWx1ZXMgaW4gdGhlIG1hcHBpbmcgd2lsbCBiZSBzZXQgb25cbiAgICAgKiBgdGhpcy5wcm9wc2AgaWYgdGhhdCBwcm9wIGlzIG5vdCBzcGVjaWZpZWQgKGkuZS4gdXNpbmcgYW4gYGluYCBjaGVjaykuXG4gICAgICpcbiAgICAgKiBUaGlzIG1ldGhvZCBpcyBpbnZva2VkIGJlZm9yZSBgZ2V0SW5pdGlhbFN0YXRlYCBhbmQgdGhlcmVmb3JlIGNhbm5vdCByZWx5XG4gICAgICogb24gYHRoaXMuc3RhdGVgIG9yIHVzZSBgdGhpcy5zZXRTdGF0ZWAuXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtvYmplY3R9XG4gICAgICogQG9wdGlvbmFsXG4gICAgICovXG4gICAgZ2V0RGVmYXVsdFByb3BzOiAnREVGSU5FX01BTllfTUVSR0VEJyxcblxuICAgIC8qKlxuICAgICAqIEludm9rZWQgb25jZSBiZWZvcmUgdGhlIGNvbXBvbmVudCBpcyBtb3VudGVkLiBUaGUgcmV0dXJuIHZhbHVlIHdpbGwgYmUgdXNlZFxuICAgICAqIGFzIHRoZSBpbml0aWFsIHZhbHVlIG9mIGB0aGlzLnN0YXRlYC5cbiAgICAgKlxuICAgICAqICAgZ2V0SW5pdGlhbFN0YXRlOiBmdW5jdGlvbigpIHtcbiAgICAgKiAgICAgcmV0dXJuIHtcbiAgICAgKiAgICAgICBpc09uOiBmYWxzZSxcbiAgICAgKiAgICAgICBmb29CYXo6IG5ldyBCYXpGb28oKVxuICAgICAqICAgICB9XG4gICAgICogICB9XG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtvYmplY3R9XG4gICAgICogQG9wdGlvbmFsXG4gICAgICovXG4gICAgZ2V0SW5pdGlhbFN0YXRlOiAnREVGSU5FX01BTllfTUVSR0VEJyxcblxuICAgIC8qKlxuICAgICAqIEByZXR1cm4ge29iamVjdH1cbiAgICAgKiBAb3B0aW9uYWxcbiAgICAgKi9cbiAgICBnZXRDaGlsZENvbnRleHQ6ICdERUZJTkVfTUFOWV9NRVJHRUQnLFxuXG4gICAgLyoqXG4gICAgICogVXNlcyBwcm9wcyBmcm9tIGB0aGlzLnByb3BzYCBhbmQgc3RhdGUgZnJvbSBgdGhpcy5zdGF0ZWAgdG8gcmVuZGVyIHRoZVxuICAgICAqIHN0cnVjdHVyZSBvZiB0aGUgY29tcG9uZW50LlxuICAgICAqXG4gICAgICogTm8gZ3VhcmFudGVlcyBhcmUgbWFkZSBhYm91dCB3aGVuIG9yIGhvdyBvZnRlbiB0aGlzIG1ldGhvZCBpcyBpbnZva2VkLCBzb1xuICAgICAqIGl0IG11c3Qgbm90IGhhdmUgc2lkZSBlZmZlY3RzLlxuICAgICAqXG4gICAgICogICByZW5kZXI6IGZ1bmN0aW9uKCkge1xuICAgICAqICAgICB2YXIgbmFtZSA9IHRoaXMucHJvcHMubmFtZTtcbiAgICAgKiAgICAgcmV0dXJuIDxkaXY+SGVsbG8sIHtuYW1lfSE8L2Rpdj47XG4gICAgICogICB9XG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtSZWFjdENvbXBvbmVudH1cbiAgICAgKiBAcmVxdWlyZWRcbiAgICAgKi9cbiAgICByZW5kZXI6ICdERUZJTkVfT05DRScsXG5cbiAgICAvLyA9PT09IERlbGVnYXRlIG1ldGhvZHMgPT09PVxuXG4gICAgLyoqXG4gICAgICogSW52b2tlZCB3aGVuIHRoZSBjb21wb25lbnQgaXMgaW5pdGlhbGx5IGNyZWF0ZWQgYW5kIGFib3V0IHRvIGJlIG1vdW50ZWQuXG4gICAgICogVGhpcyBtYXkgaGF2ZSBzaWRlIGVmZmVjdHMsIGJ1dCBhbnkgZXh0ZXJuYWwgc3Vic2NyaXB0aW9ucyBvciBkYXRhIGNyZWF0ZWRcbiAgICAgKiBieSB0aGlzIG1ldGhvZCBtdXN0IGJlIGNsZWFuZWQgdXAgaW4gYGNvbXBvbmVudFdpbGxVbm1vdW50YC5cbiAgICAgKlxuICAgICAqIEBvcHRpb25hbFxuICAgICAqL1xuICAgIGNvbXBvbmVudFdpbGxNb3VudDogJ0RFRklORV9NQU5ZJyxcblxuICAgIC8qKlxuICAgICAqIEludm9rZWQgd2hlbiB0aGUgY29tcG9uZW50IGhhcyBiZWVuIG1vdW50ZWQgYW5kIGhhcyBhIERPTSByZXByZXNlbnRhdGlvbi5cbiAgICAgKiBIb3dldmVyLCB0aGVyZSBpcyBubyBndWFyYW50ZWUgdGhhdCB0aGUgRE9NIG5vZGUgaXMgaW4gdGhlIGRvY3VtZW50LlxuICAgICAqXG4gICAgICogVXNlIHRoaXMgYXMgYW4gb3Bwb3J0dW5pdHkgdG8gb3BlcmF0ZSBvbiB0aGUgRE9NIHdoZW4gdGhlIGNvbXBvbmVudCBoYXNcbiAgICAgKiBiZWVuIG1vdW50ZWQgKGluaXRpYWxpemVkIGFuZCByZW5kZXJlZCkgZm9yIHRoZSBmaXJzdCB0aW1lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtET01FbGVtZW50fSByb290Tm9kZSBET00gZWxlbWVudCByZXByZXNlbnRpbmcgdGhlIGNvbXBvbmVudC5cbiAgICAgKiBAb3B0aW9uYWxcbiAgICAgKi9cbiAgICBjb21wb25lbnREaWRNb3VudDogJ0RFRklORV9NQU5ZJyxcblxuICAgIC8qKlxuICAgICAqIEludm9rZWQgYmVmb3JlIHRoZSBjb21wb25lbnQgcmVjZWl2ZXMgbmV3IHByb3BzLlxuICAgICAqXG4gICAgICogVXNlIHRoaXMgYXMgYW4gb3Bwb3J0dW5pdHkgdG8gcmVhY3QgdG8gYSBwcm9wIHRyYW5zaXRpb24gYnkgdXBkYXRpbmcgdGhlXG4gICAgICogc3RhdGUgdXNpbmcgYHRoaXMuc2V0U3RhdGVgLiBDdXJyZW50IHByb3BzIGFyZSBhY2Nlc3NlZCB2aWEgYHRoaXMucHJvcHNgLlxuICAgICAqXG4gICAgICogICBjb21wb25lbnRXaWxsUmVjZWl2ZVByb3BzOiBmdW5jdGlvbihuZXh0UHJvcHMsIG5leHRDb250ZXh0KSB7XG4gICAgICogICAgIHRoaXMuc2V0U3RhdGUoe1xuICAgICAqICAgICAgIGxpa2VzSW5jcmVhc2luZzogbmV4dFByb3BzLmxpa2VDb3VudCA+IHRoaXMucHJvcHMubGlrZUNvdW50XG4gICAgICogICAgIH0pO1xuICAgICAqICAgfVxuICAgICAqXG4gICAgICogTk9URTogVGhlcmUgaXMgbm8gZXF1aXZhbGVudCBgY29tcG9uZW50V2lsbFJlY2VpdmVTdGF0ZWAuIEFuIGluY29taW5nIHByb3BcbiAgICAgKiB0cmFuc2l0aW9uIG1heSBjYXVzZSBhIHN0YXRlIGNoYW5nZSwgYnV0IHRoZSBvcHBvc2l0ZSBpcyBub3QgdHJ1ZS4gSWYgeW91XG4gICAgICogbmVlZCBpdCwgeW91IGFyZSBwcm9iYWJseSBsb29raW5nIGZvciBgY29tcG9uZW50V2lsbFVwZGF0ZWAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gbmV4dFByb3BzXG4gICAgICogQG9wdGlvbmFsXG4gICAgICovXG4gICAgY29tcG9uZW50V2lsbFJlY2VpdmVQcm9wczogJ0RFRklORV9NQU5ZJyxcblxuICAgIC8qKlxuICAgICAqIEludm9rZWQgd2hpbGUgZGVjaWRpbmcgaWYgdGhlIGNvbXBvbmVudCBzaG91bGQgYmUgdXBkYXRlZCBhcyBhIHJlc3VsdCBvZlxuICAgICAqIHJlY2VpdmluZyBuZXcgcHJvcHMsIHN0YXRlIGFuZC9vciBjb250ZXh0LlxuICAgICAqXG4gICAgICogVXNlIHRoaXMgYXMgYW4gb3Bwb3J0dW5pdHkgdG8gYHJldHVybiBmYWxzZWAgd2hlbiB5b3UncmUgY2VydGFpbiB0aGF0IHRoZVxuICAgICAqIHRyYW5zaXRpb24gdG8gdGhlIG5ldyBwcm9wcy9zdGF0ZS9jb250ZXh0IHdpbGwgbm90IHJlcXVpcmUgYSBjb21wb25lbnRcbiAgICAgKiB1cGRhdGUuXG4gICAgICpcbiAgICAgKiAgIHNob3VsZENvbXBvbmVudFVwZGF0ZTogZnVuY3Rpb24obmV4dFByb3BzLCBuZXh0U3RhdGUsIG5leHRDb250ZXh0KSB7XG4gICAgICogICAgIHJldHVybiAhZXF1YWwobmV4dFByb3BzLCB0aGlzLnByb3BzKSB8fFxuICAgICAqICAgICAgICFlcXVhbChuZXh0U3RhdGUsIHRoaXMuc3RhdGUpIHx8XG4gICAgICogICAgICAgIWVxdWFsKG5leHRDb250ZXh0LCB0aGlzLmNvbnRleHQpO1xuICAgICAqICAgfVxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IG5leHRQcm9wc1xuICAgICAqIEBwYXJhbSB7P29iamVjdH0gbmV4dFN0YXRlXG4gICAgICogQHBhcmFtIHs/b2JqZWN0fSBuZXh0Q29udGV4dFxuICAgICAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgaWYgdGhlIGNvbXBvbmVudCBzaG91bGQgdXBkYXRlLlxuICAgICAqIEBvcHRpb25hbFxuICAgICAqL1xuICAgIHNob3VsZENvbXBvbmVudFVwZGF0ZTogJ0RFRklORV9PTkNFJyxcblxuICAgIC8qKlxuICAgICAqIEludm9rZWQgd2hlbiB0aGUgY29tcG9uZW50IGlzIGFib3V0IHRvIHVwZGF0ZSBkdWUgdG8gYSB0cmFuc2l0aW9uIGZyb21cbiAgICAgKiBgdGhpcy5wcm9wc2AsIGB0aGlzLnN0YXRlYCBhbmQgYHRoaXMuY29udGV4dGAgdG8gYG5leHRQcm9wc2AsIGBuZXh0U3RhdGVgXG4gICAgICogYW5kIGBuZXh0Q29udGV4dGAuXG4gICAgICpcbiAgICAgKiBVc2UgdGhpcyBhcyBhbiBvcHBvcnR1bml0eSB0byBwZXJmb3JtIHByZXBhcmF0aW9uIGJlZm9yZSBhbiB1cGRhdGUgb2NjdXJzLlxuICAgICAqXG4gICAgICogTk9URTogWW91ICoqY2Fubm90KiogdXNlIGB0aGlzLnNldFN0YXRlKClgIGluIHRoaXMgbWV0aG9kLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IG5leHRQcm9wc1xuICAgICAqIEBwYXJhbSB7P29iamVjdH0gbmV4dFN0YXRlXG4gICAgICogQHBhcmFtIHs/b2JqZWN0fSBuZXh0Q29udGV4dFxuICAgICAqIEBwYXJhbSB7UmVhY3RSZWNvbmNpbGVUcmFuc2FjdGlvbn0gdHJhbnNhY3Rpb25cbiAgICAgKiBAb3B0aW9uYWxcbiAgICAgKi9cbiAgICBjb21wb25lbnRXaWxsVXBkYXRlOiAnREVGSU5FX01BTlknLFxuXG4gICAgLyoqXG4gICAgICogSW52b2tlZCB3aGVuIHRoZSBjb21wb25lbnQncyBET00gcmVwcmVzZW50YXRpb24gaGFzIGJlZW4gdXBkYXRlZC5cbiAgICAgKlxuICAgICAqIFVzZSB0aGlzIGFzIGFuIG9wcG9ydHVuaXR5IHRvIG9wZXJhdGUgb24gdGhlIERPTSB3aGVuIHRoZSBjb21wb25lbnQgaGFzXG4gICAgICogYmVlbiB1cGRhdGVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IHByZXZQcm9wc1xuICAgICAqIEBwYXJhbSB7P29iamVjdH0gcHJldlN0YXRlXG4gICAgICogQHBhcmFtIHs/b2JqZWN0fSBwcmV2Q29udGV4dFxuICAgICAqIEBwYXJhbSB7RE9NRWxlbWVudH0gcm9vdE5vZGUgRE9NIGVsZW1lbnQgcmVwcmVzZW50aW5nIHRoZSBjb21wb25lbnQuXG4gICAgICogQG9wdGlvbmFsXG4gICAgICovXG4gICAgY29tcG9uZW50RGlkVXBkYXRlOiAnREVGSU5FX01BTlknLFxuXG4gICAgLyoqXG4gICAgICogSW52b2tlZCB3aGVuIHRoZSBjb21wb25lbnQgaXMgYWJvdXQgdG8gYmUgcmVtb3ZlZCBmcm9tIGl0cyBwYXJlbnQgYW5kIGhhdmVcbiAgICAgKiBpdHMgRE9NIHJlcHJlc2VudGF0aW9uIGRlc3Ryb3llZC5cbiAgICAgKlxuICAgICAqIFVzZSB0aGlzIGFzIGFuIG9wcG9ydHVuaXR5IHRvIGRlYWxsb2NhdGUgYW55IGV4dGVybmFsIHJlc291cmNlcy5cbiAgICAgKlxuICAgICAqIE5PVEU6IFRoZXJlIGlzIG5vIGBjb21wb25lbnREaWRVbm1vdW50YCBzaW5jZSB5b3VyIGNvbXBvbmVudCB3aWxsIGhhdmUgYmVlblxuICAgICAqIGRlc3Ryb3llZCBieSB0aGF0IHBvaW50LlxuICAgICAqXG4gICAgICogQG9wdGlvbmFsXG4gICAgICovXG4gICAgY29tcG9uZW50V2lsbFVubW91bnQ6ICdERUZJTkVfTUFOWScsXG5cbiAgICAvLyA9PT09IEFkdmFuY2VkIG1ldGhvZHMgPT09PVxuXG4gICAgLyoqXG4gICAgICogVXBkYXRlcyB0aGUgY29tcG9uZW50J3MgY3VycmVudGx5IG1vdW50ZWQgRE9NIHJlcHJlc2VudGF0aW9uLlxuICAgICAqXG4gICAgICogQnkgZGVmYXVsdCwgdGhpcyBpbXBsZW1lbnRzIFJlYWN0J3MgcmVuZGVyaW5nIGFuZCByZWNvbmNpbGlhdGlvbiBhbGdvcml0aG0uXG4gICAgICogU29waGlzdGljYXRlZCBjbGllbnRzIG1heSB3aXNoIHRvIG92ZXJyaWRlIHRoaXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1JlYWN0UmVjb25jaWxlVHJhbnNhY3Rpb259IHRyYW5zYWN0aW9uXG4gICAgICogQGludGVybmFsXG4gICAgICogQG92ZXJyaWRhYmxlXG4gICAgICovXG4gICAgdXBkYXRlQ29tcG9uZW50OiAnT1ZFUlJJREVfQkFTRSdcbiAgfTtcblxuICAvKipcbiAgICogTWFwcGluZyBmcm9tIGNsYXNzIHNwZWNpZmljYXRpb24ga2V5cyB0byBzcGVjaWFsIHByb2Nlc3NpbmcgZnVuY3Rpb25zLlxuICAgKlxuICAgKiBBbHRob3VnaCB0aGVzZSBhcmUgZGVjbGFyZWQgbGlrZSBpbnN0YW5jZSBwcm9wZXJ0aWVzIGluIHRoZSBzcGVjaWZpY2F0aW9uXG4gICAqIHdoZW4gZGVmaW5pbmcgY2xhc3NlcyB1c2luZyBgUmVhY3QuY3JlYXRlQ2xhc3NgLCB0aGV5IGFyZSBhY3R1YWxseSBzdGF0aWNcbiAgICogYW5kIGFyZSBhY2Nlc3NpYmxlIG9uIHRoZSBjb25zdHJ1Y3RvciBpbnN0ZWFkIG9mIHRoZSBwcm90b3R5cGUuIERlc3BpdGVcbiAgICogYmVpbmcgc3RhdGljLCB0aGV5IG11c3QgYmUgZGVmaW5lZCBvdXRzaWRlIG9mIHRoZSBcInN0YXRpY3NcIiBrZXkgdW5kZXJcbiAgICogd2hpY2ggYWxsIG90aGVyIHN0YXRpYyBtZXRob2RzIGFyZSBkZWZpbmVkLlxuICAgKi9cbiAgdmFyIFJFU0VSVkVEX1NQRUNfS0VZUyA9IHtcbiAgICBkaXNwbGF5TmFtZTogZnVuY3Rpb24oQ29uc3RydWN0b3IsIGRpc3BsYXlOYW1lKSB7XG4gICAgICBDb25zdHJ1Y3Rvci5kaXNwbGF5TmFtZSA9IGRpc3BsYXlOYW1lO1xuICAgIH0sXG4gICAgbWl4aW5zOiBmdW5jdGlvbihDb25zdHJ1Y3RvciwgbWl4aW5zKSB7XG4gICAgICBpZiAobWl4aW5zKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbWl4aW5zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgbWl4U3BlY0ludG9Db21wb25lbnQoQ29uc3RydWN0b3IsIG1peGluc1tpXSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIGNoaWxkQ29udGV4dFR5cGVzOiBmdW5jdGlvbihDb25zdHJ1Y3RvciwgY2hpbGRDb250ZXh0VHlwZXMpIHtcbiAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgIHZhbGlkYXRlVHlwZURlZihDb25zdHJ1Y3RvciwgY2hpbGRDb250ZXh0VHlwZXMsICdjaGlsZENvbnRleHQnKTtcbiAgICAgIH1cbiAgICAgIENvbnN0cnVjdG9yLmNoaWxkQ29udGV4dFR5cGVzID0gX2Fzc2lnbihcbiAgICAgICAge30sXG4gICAgICAgIENvbnN0cnVjdG9yLmNoaWxkQ29udGV4dFR5cGVzLFxuICAgICAgICBjaGlsZENvbnRleHRUeXBlc1xuICAgICAgKTtcbiAgICB9LFxuICAgIGNvbnRleHRUeXBlczogZnVuY3Rpb24oQ29uc3RydWN0b3IsIGNvbnRleHRUeXBlcykge1xuICAgICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgICAgdmFsaWRhdGVUeXBlRGVmKENvbnN0cnVjdG9yLCBjb250ZXh0VHlwZXMsICdjb250ZXh0Jyk7XG4gICAgICB9XG4gICAgICBDb25zdHJ1Y3Rvci5jb250ZXh0VHlwZXMgPSBfYXNzaWduKFxuICAgICAgICB7fSxcbiAgICAgICAgQ29uc3RydWN0b3IuY29udGV4dFR5cGVzLFxuICAgICAgICBjb250ZXh0VHlwZXNcbiAgICAgICk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBTcGVjaWFsIGNhc2UgZ2V0RGVmYXVsdFByb3BzIHdoaWNoIHNob3VsZCBtb3ZlIGludG8gc3RhdGljcyBidXQgcmVxdWlyZXNcbiAgICAgKiBhdXRvbWF0aWMgbWVyZ2luZy5cbiAgICAgKi9cbiAgICBnZXREZWZhdWx0UHJvcHM6IGZ1bmN0aW9uKENvbnN0cnVjdG9yLCBnZXREZWZhdWx0UHJvcHMpIHtcbiAgICAgIGlmIChDb25zdHJ1Y3Rvci5nZXREZWZhdWx0UHJvcHMpIHtcbiAgICAgICAgQ29uc3RydWN0b3IuZ2V0RGVmYXVsdFByb3BzID0gY3JlYXRlTWVyZ2VkUmVzdWx0RnVuY3Rpb24oXG4gICAgICAgICAgQ29uc3RydWN0b3IuZ2V0RGVmYXVsdFByb3BzLFxuICAgICAgICAgIGdldERlZmF1bHRQcm9wc1xuICAgICAgICApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgQ29uc3RydWN0b3IuZ2V0RGVmYXVsdFByb3BzID0gZ2V0RGVmYXVsdFByb3BzO1xuICAgICAgfVxuICAgIH0sXG4gICAgcHJvcFR5cGVzOiBmdW5jdGlvbihDb25zdHJ1Y3RvciwgcHJvcFR5cGVzKSB7XG4gICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgICB2YWxpZGF0ZVR5cGVEZWYoQ29uc3RydWN0b3IsIHByb3BUeXBlcywgJ3Byb3AnKTtcbiAgICAgIH1cbiAgICAgIENvbnN0cnVjdG9yLnByb3BUeXBlcyA9IF9hc3NpZ24oe30sIENvbnN0cnVjdG9yLnByb3BUeXBlcywgcHJvcFR5cGVzKTtcbiAgICB9LFxuICAgIHN0YXRpY3M6IGZ1bmN0aW9uKENvbnN0cnVjdG9yLCBzdGF0aWNzKSB7XG4gICAgICBtaXhTdGF0aWNTcGVjSW50b0NvbXBvbmVudChDb25zdHJ1Y3Rvciwgc3RhdGljcyk7XG4gICAgfSxcbiAgICBhdXRvYmluZDogZnVuY3Rpb24oKSB7fVxuICB9O1xuXG4gIGZ1bmN0aW9uIHZhbGlkYXRlVHlwZURlZihDb25zdHJ1Y3RvciwgdHlwZURlZiwgbG9jYXRpb24pIHtcbiAgICBmb3IgKHZhciBwcm9wTmFtZSBpbiB0eXBlRGVmKSB7XG4gICAgICBpZiAodHlwZURlZi5oYXNPd25Qcm9wZXJ0eShwcm9wTmFtZSkpIHtcbiAgICAgICAgLy8gdXNlIGEgd2FybmluZyBpbnN0ZWFkIG9mIGFuIF9pbnZhcmlhbnQgc28gY29tcG9uZW50c1xuICAgICAgICAvLyBkb24ndCBzaG93IHVwIGluIHByb2QgYnV0IG9ubHkgaW4gX19ERVZfX1xuICAgICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgICAgIHdhcm5pbmcoXG4gICAgICAgICAgICB0eXBlb2YgdHlwZURlZltwcm9wTmFtZV0gPT09ICdmdW5jdGlvbicsXG4gICAgICAgICAgICAnJXM6ICVzIHR5cGUgYCVzYCBpcyBpbnZhbGlkOyBpdCBtdXN0IGJlIGEgZnVuY3Rpb24sIHVzdWFsbHkgZnJvbSAnICtcbiAgICAgICAgICAgICAgJ1JlYWN0LlByb3BUeXBlcy4nLFxuICAgICAgICAgICAgQ29uc3RydWN0b3IuZGlzcGxheU5hbWUgfHwgJ1JlYWN0Q2xhc3MnLFxuICAgICAgICAgICAgUmVhY3RQcm9wVHlwZUxvY2F0aW9uTmFtZXNbbG9jYXRpb25dLFxuICAgICAgICAgICAgcHJvcE5hbWVcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gdmFsaWRhdGVNZXRob2RPdmVycmlkZShpc0FscmVhZHlEZWZpbmVkLCBuYW1lKSB7XG4gICAgdmFyIHNwZWNQb2xpY3kgPSBSZWFjdENsYXNzSW50ZXJmYWNlLmhhc093blByb3BlcnR5KG5hbWUpXG4gICAgICA/IFJlYWN0Q2xhc3NJbnRlcmZhY2VbbmFtZV1cbiAgICAgIDogbnVsbDtcblxuICAgIC8vIERpc2FsbG93IG92ZXJyaWRpbmcgb2YgYmFzZSBjbGFzcyBtZXRob2RzIHVubGVzcyBleHBsaWNpdGx5IGFsbG93ZWQuXG4gICAgaWYgKFJlYWN0Q2xhc3NNaXhpbi5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgX2ludmFyaWFudChcbiAgICAgICAgc3BlY1BvbGljeSA9PT0gJ09WRVJSSURFX0JBU0UnLFxuICAgICAgICAnUmVhY3RDbGFzc0ludGVyZmFjZTogWW91IGFyZSBhdHRlbXB0aW5nIHRvIG92ZXJyaWRlICcgK1xuICAgICAgICAgICdgJXNgIGZyb20geW91ciBjbGFzcyBzcGVjaWZpY2F0aW9uLiBFbnN1cmUgdGhhdCB5b3VyIG1ldGhvZCBuYW1lcyAnICtcbiAgICAgICAgICAnZG8gbm90IG92ZXJsYXAgd2l0aCBSZWFjdCBtZXRob2RzLicsXG4gICAgICAgIG5hbWVcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gRGlzYWxsb3cgZGVmaW5pbmcgbWV0aG9kcyBtb3JlIHRoYW4gb25jZSB1bmxlc3MgZXhwbGljaXRseSBhbGxvd2VkLlxuICAgIGlmIChpc0FscmVhZHlEZWZpbmVkKSB7XG4gICAgICBfaW52YXJpYW50KFxuICAgICAgICBzcGVjUG9saWN5ID09PSAnREVGSU5FX01BTlknIHx8IHNwZWNQb2xpY3kgPT09ICdERUZJTkVfTUFOWV9NRVJHRUQnLFxuICAgICAgICAnUmVhY3RDbGFzc0ludGVyZmFjZTogWW91IGFyZSBhdHRlbXB0aW5nIHRvIGRlZmluZSAnICtcbiAgICAgICAgICAnYCVzYCBvbiB5b3VyIGNvbXBvbmVudCBtb3JlIHRoYW4gb25jZS4gVGhpcyBjb25mbGljdCBtYXkgYmUgZHVlICcgK1xuICAgICAgICAgICd0byBhIG1peGluLicsXG4gICAgICAgIG5hbWVcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIE1peGluIGhlbHBlciB3aGljaCBoYW5kbGVzIHBvbGljeSB2YWxpZGF0aW9uIGFuZCByZXNlcnZlZFxuICAgKiBzcGVjaWZpY2F0aW9uIGtleXMgd2hlbiBidWlsZGluZyBSZWFjdCBjbGFzc2VzLlxuICAgKi9cbiAgZnVuY3Rpb24gbWl4U3BlY0ludG9Db21wb25lbnQoQ29uc3RydWN0b3IsIHNwZWMpIHtcbiAgICBpZiAoIXNwZWMpIHtcbiAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgIHZhciB0eXBlb2ZTcGVjID0gdHlwZW9mIHNwZWM7XG4gICAgICAgIHZhciBpc01peGluVmFsaWQgPSB0eXBlb2ZTcGVjID09PSAnb2JqZWN0JyAmJiBzcGVjICE9PSBudWxsO1xuXG4gICAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgICAgd2FybmluZyhcbiAgICAgICAgICAgIGlzTWl4aW5WYWxpZCxcbiAgICAgICAgICAgIFwiJXM6IFlvdSdyZSBhdHRlbXB0aW5nIHRvIGluY2x1ZGUgYSBtaXhpbiB0aGF0IGlzIGVpdGhlciBudWxsIFwiICtcbiAgICAgICAgICAgICAgJ29yIG5vdCBhbiBvYmplY3QuIENoZWNrIHRoZSBtaXhpbnMgaW5jbHVkZWQgYnkgdGhlIGNvbXBvbmVudCwgJyArXG4gICAgICAgICAgICAgICdhcyB3ZWxsIGFzIGFueSBtaXhpbnMgdGhleSBpbmNsdWRlIHRoZW1zZWx2ZXMuICcgK1xuICAgICAgICAgICAgICAnRXhwZWN0ZWQgb2JqZWN0IGJ1dCBnb3QgJXMuJyxcbiAgICAgICAgICAgIENvbnN0cnVjdG9yLmRpc3BsYXlOYW1lIHx8ICdSZWFjdENsYXNzJyxcbiAgICAgICAgICAgIHNwZWMgPT09IG51bGwgPyBudWxsIDogdHlwZW9mU3BlY1xuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIF9pbnZhcmlhbnQoXG4gICAgICB0eXBlb2Ygc3BlYyAhPT0gJ2Z1bmN0aW9uJyxcbiAgICAgIFwiUmVhY3RDbGFzczogWW91J3JlIGF0dGVtcHRpbmcgdG8gXCIgK1xuICAgICAgICAndXNlIGEgY29tcG9uZW50IGNsYXNzIG9yIGZ1bmN0aW9uIGFzIGEgbWl4aW4uIEluc3RlYWQsIGp1c3QgdXNlIGEgJyArXG4gICAgICAgICdyZWd1bGFyIG9iamVjdC4nXG4gICAgKTtcbiAgICBfaW52YXJpYW50KFxuICAgICAgIWlzVmFsaWRFbGVtZW50KHNwZWMpLFxuICAgICAgXCJSZWFjdENsYXNzOiBZb3UncmUgYXR0ZW1wdGluZyB0byBcIiArXG4gICAgICAgICd1c2UgYSBjb21wb25lbnQgYXMgYSBtaXhpbi4gSW5zdGVhZCwganVzdCB1c2UgYSByZWd1bGFyIG9iamVjdC4nXG4gICAgKTtcblxuICAgIHZhciBwcm90byA9IENvbnN0cnVjdG9yLnByb3RvdHlwZTtcbiAgICB2YXIgYXV0b0JpbmRQYWlycyA9IHByb3RvLl9fcmVhY3RBdXRvQmluZFBhaXJzO1xuXG4gICAgLy8gQnkgaGFuZGxpbmcgbWl4aW5zIGJlZm9yZSBhbnkgb3RoZXIgcHJvcGVydGllcywgd2UgZW5zdXJlIHRoZSBzYW1lXG4gICAgLy8gY2hhaW5pbmcgb3JkZXIgaXMgYXBwbGllZCB0byBtZXRob2RzIHdpdGggREVGSU5FX01BTlkgcG9saWN5LCB3aGV0aGVyXG4gICAgLy8gbWl4aW5zIGFyZSBsaXN0ZWQgYmVmb3JlIG9yIGFmdGVyIHRoZXNlIG1ldGhvZHMgaW4gdGhlIHNwZWMuXG4gICAgaWYgKHNwZWMuaGFzT3duUHJvcGVydHkoTUlYSU5TX0tFWSkpIHtcbiAgICAgIFJFU0VSVkVEX1NQRUNfS0VZUy5taXhpbnMoQ29uc3RydWN0b3IsIHNwZWMubWl4aW5zKTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBuYW1lIGluIHNwZWMpIHtcbiAgICAgIGlmICghc3BlYy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKG5hbWUgPT09IE1JWElOU19LRVkpIHtcbiAgICAgICAgLy8gV2UgaGF2ZSBhbHJlYWR5IGhhbmRsZWQgbWl4aW5zIGluIGEgc3BlY2lhbCBjYXNlIGFib3ZlLlxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgdmFyIHByb3BlcnR5ID0gc3BlY1tuYW1lXTtcbiAgICAgIHZhciBpc0FscmVhZHlEZWZpbmVkID0gcHJvdG8uaGFzT3duUHJvcGVydHkobmFtZSk7XG4gICAgICB2YWxpZGF0ZU1ldGhvZE92ZXJyaWRlKGlzQWxyZWFkeURlZmluZWQsIG5hbWUpO1xuXG4gICAgICBpZiAoUkVTRVJWRURfU1BFQ19LRVlTLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgIFJFU0VSVkVEX1NQRUNfS0VZU1tuYW1lXShDb25zdHJ1Y3RvciwgcHJvcGVydHkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gU2V0dXAgbWV0aG9kcyBvbiBwcm90b3R5cGU6XG4gICAgICAgIC8vIFRoZSBmb2xsb3dpbmcgbWVtYmVyIG1ldGhvZHMgc2hvdWxkIG5vdCBiZSBhdXRvbWF0aWNhbGx5IGJvdW5kOlxuICAgICAgICAvLyAxLiBFeHBlY3RlZCBSZWFjdENsYXNzIG1ldGhvZHMgKGluIHRoZSBcImludGVyZmFjZVwiKS5cbiAgICAgICAgLy8gMi4gT3ZlcnJpZGRlbiBtZXRob2RzICh0aGF0IHdlcmUgbWl4ZWQgaW4pLlxuICAgICAgICB2YXIgaXNSZWFjdENsYXNzTWV0aG9kID0gUmVhY3RDbGFzc0ludGVyZmFjZS5oYXNPd25Qcm9wZXJ0eShuYW1lKTtcbiAgICAgICAgdmFyIGlzRnVuY3Rpb24gPSB0eXBlb2YgcHJvcGVydHkgPT09ICdmdW5jdGlvbic7XG4gICAgICAgIHZhciBzaG91bGRBdXRvQmluZCA9XG4gICAgICAgICAgaXNGdW5jdGlvbiAmJlxuICAgICAgICAgICFpc1JlYWN0Q2xhc3NNZXRob2QgJiZcbiAgICAgICAgICAhaXNBbHJlYWR5RGVmaW5lZCAmJlxuICAgICAgICAgIHNwZWMuYXV0b2JpbmQgIT09IGZhbHNlO1xuXG4gICAgICAgIGlmIChzaG91bGRBdXRvQmluZCkge1xuICAgICAgICAgIGF1dG9CaW5kUGFpcnMucHVzaChuYW1lLCBwcm9wZXJ0eSk7XG4gICAgICAgICAgcHJvdG9bbmFtZV0gPSBwcm9wZXJ0eTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAoaXNBbHJlYWR5RGVmaW5lZCkge1xuICAgICAgICAgICAgdmFyIHNwZWNQb2xpY3kgPSBSZWFjdENsYXNzSW50ZXJmYWNlW25hbWVdO1xuXG4gICAgICAgICAgICAvLyBUaGVzZSBjYXNlcyBzaG91bGQgYWxyZWFkeSBiZSBjYXVnaHQgYnkgdmFsaWRhdGVNZXRob2RPdmVycmlkZS5cbiAgICAgICAgICAgIF9pbnZhcmlhbnQoXG4gICAgICAgICAgICAgIGlzUmVhY3RDbGFzc01ldGhvZCAmJlxuICAgICAgICAgICAgICAgIChzcGVjUG9saWN5ID09PSAnREVGSU5FX01BTllfTUVSR0VEJyB8fFxuICAgICAgICAgICAgICAgICAgc3BlY1BvbGljeSA9PT0gJ0RFRklORV9NQU5ZJyksXG4gICAgICAgICAgICAgICdSZWFjdENsYXNzOiBVbmV4cGVjdGVkIHNwZWMgcG9saWN5ICVzIGZvciBrZXkgJXMgJyArXG4gICAgICAgICAgICAgICAgJ3doZW4gbWl4aW5nIGluIGNvbXBvbmVudCBzcGVjcy4nLFxuICAgICAgICAgICAgICBzcGVjUG9saWN5LFxuICAgICAgICAgICAgICBuYW1lXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAvLyBGb3IgbWV0aG9kcyB3aGljaCBhcmUgZGVmaW5lZCBtb3JlIHRoYW4gb25jZSwgY2FsbCB0aGUgZXhpc3RpbmdcbiAgICAgICAgICAgIC8vIG1ldGhvZHMgYmVmb3JlIGNhbGxpbmcgdGhlIG5ldyBwcm9wZXJ0eSwgbWVyZ2luZyBpZiBhcHByb3ByaWF0ZS5cbiAgICAgICAgICAgIGlmIChzcGVjUG9saWN5ID09PSAnREVGSU5FX01BTllfTUVSR0VEJykge1xuICAgICAgICAgICAgICBwcm90b1tuYW1lXSA9IGNyZWF0ZU1lcmdlZFJlc3VsdEZ1bmN0aW9uKHByb3RvW25hbWVdLCBwcm9wZXJ0eSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHNwZWNQb2xpY3kgPT09ICdERUZJTkVfTUFOWScpIHtcbiAgICAgICAgICAgICAgcHJvdG9bbmFtZV0gPSBjcmVhdGVDaGFpbmVkRnVuY3Rpb24ocHJvdG9bbmFtZV0sIHByb3BlcnR5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHJvdG9bbmFtZV0gPSBwcm9wZXJ0eTtcbiAgICAgICAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgICAgICAgIC8vIEFkZCB2ZXJib3NlIGRpc3BsYXlOYW1lIHRvIHRoZSBmdW5jdGlvbiwgd2hpY2ggaGVscHMgd2hlbiBsb29raW5nXG4gICAgICAgICAgICAgIC8vIGF0IHByb2ZpbGluZyB0b29scy5cbiAgICAgICAgICAgICAgaWYgKHR5cGVvZiBwcm9wZXJ0eSA9PT0gJ2Z1bmN0aW9uJyAmJiBzcGVjLmRpc3BsYXlOYW1lKSB7XG4gICAgICAgICAgICAgICAgcHJvdG9bbmFtZV0uZGlzcGxheU5hbWUgPSBzcGVjLmRpc3BsYXlOYW1lICsgJ18nICsgbmFtZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG1peFN0YXRpY1NwZWNJbnRvQ29tcG9uZW50KENvbnN0cnVjdG9yLCBzdGF0aWNzKSB7XG4gICAgaWYgKCFzdGF0aWNzKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGZvciAodmFyIG5hbWUgaW4gc3RhdGljcykge1xuICAgICAgdmFyIHByb3BlcnR5ID0gc3RhdGljc1tuYW1lXTtcbiAgICAgIGlmICghc3RhdGljcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgdmFyIGlzUmVzZXJ2ZWQgPSBuYW1lIGluIFJFU0VSVkVEX1NQRUNfS0VZUztcbiAgICAgIF9pbnZhcmlhbnQoXG4gICAgICAgICFpc1Jlc2VydmVkLFxuICAgICAgICAnUmVhY3RDbGFzczogWW91IGFyZSBhdHRlbXB0aW5nIHRvIGRlZmluZSBhIHJlc2VydmVkICcgK1xuICAgICAgICAgICdwcm9wZXJ0eSwgYCVzYCwgdGhhdCBzaG91bGRuXFwndCBiZSBvbiB0aGUgXCJzdGF0aWNzXCIga2V5LiBEZWZpbmUgaXQgJyArXG4gICAgICAgICAgJ2FzIGFuIGluc3RhbmNlIHByb3BlcnR5IGluc3RlYWQ7IGl0IHdpbGwgc3RpbGwgYmUgYWNjZXNzaWJsZSBvbiB0aGUgJyArXG4gICAgICAgICAgJ2NvbnN0cnVjdG9yLicsXG4gICAgICAgIG5hbWVcbiAgICAgICk7XG5cbiAgICAgIHZhciBpc0luaGVyaXRlZCA9IG5hbWUgaW4gQ29uc3RydWN0b3I7XG4gICAgICBfaW52YXJpYW50KFxuICAgICAgICAhaXNJbmhlcml0ZWQsXG4gICAgICAgICdSZWFjdENsYXNzOiBZb3UgYXJlIGF0dGVtcHRpbmcgdG8gZGVmaW5lICcgK1xuICAgICAgICAgICdgJXNgIG9uIHlvdXIgY29tcG9uZW50IG1vcmUgdGhhbiBvbmNlLiBUaGlzIGNvbmZsaWN0IG1heSBiZSAnICtcbiAgICAgICAgICAnZHVlIHRvIGEgbWl4aW4uJyxcbiAgICAgICAgbmFtZVxuICAgICAgKTtcbiAgICAgIENvbnN0cnVjdG9yW25hbWVdID0gcHJvcGVydHk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIE1lcmdlIHR3byBvYmplY3RzLCBidXQgdGhyb3cgaWYgYm90aCBjb250YWluIHRoZSBzYW1lIGtleS5cbiAgICpcbiAgICogQHBhcmFtIHtvYmplY3R9IG9uZSBUaGUgZmlyc3Qgb2JqZWN0LCB3aGljaCBpcyBtdXRhdGVkLlxuICAgKiBAcGFyYW0ge29iamVjdH0gdHdvIFRoZSBzZWNvbmQgb2JqZWN0XG4gICAqIEByZXR1cm4ge29iamVjdH0gb25lIGFmdGVyIGl0IGhhcyBiZWVuIG11dGF0ZWQgdG8gY29udGFpbiBldmVyeXRoaW5nIGluIHR3by5cbiAgICovXG4gIGZ1bmN0aW9uIG1lcmdlSW50b1dpdGhOb0R1cGxpY2F0ZUtleXMob25lLCB0d28pIHtcbiAgICBfaW52YXJpYW50KFxuICAgICAgb25lICYmIHR3byAmJiB0eXBlb2Ygb25lID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgdHdvID09PSAnb2JqZWN0JyxcbiAgICAgICdtZXJnZUludG9XaXRoTm9EdXBsaWNhdGVLZXlzKCk6IENhbm5vdCBtZXJnZSBub24tb2JqZWN0cy4nXG4gICAgKTtcblxuICAgIGZvciAodmFyIGtleSBpbiB0d28pIHtcbiAgICAgIGlmICh0d28uaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICBfaW52YXJpYW50KFxuICAgICAgICAgIG9uZVtrZXldID09PSB1bmRlZmluZWQsXG4gICAgICAgICAgJ21lcmdlSW50b1dpdGhOb0R1cGxpY2F0ZUtleXMoKTogJyArXG4gICAgICAgICAgICAnVHJpZWQgdG8gbWVyZ2UgdHdvIG9iamVjdHMgd2l0aCB0aGUgc2FtZSBrZXk6IGAlc2AuIFRoaXMgY29uZmxpY3QgJyArXG4gICAgICAgICAgICAnbWF5IGJlIGR1ZSB0byBhIG1peGluOyBpbiBwYXJ0aWN1bGFyLCB0aGlzIG1heSBiZSBjYXVzZWQgYnkgdHdvICcgK1xuICAgICAgICAgICAgJ2dldEluaXRpYWxTdGF0ZSgpIG9yIGdldERlZmF1bHRQcm9wcygpIG1ldGhvZHMgcmV0dXJuaW5nIG9iamVjdHMgJyArXG4gICAgICAgICAgICAnd2l0aCBjbGFzaGluZyBrZXlzLicsXG4gICAgICAgICAga2V5XG4gICAgICAgICk7XG4gICAgICAgIG9uZVtrZXldID0gdHdvW2tleV07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBvbmU7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgaW52b2tlcyB0d28gZnVuY3Rpb25zIGFuZCBtZXJnZXMgdGhlaXIgcmV0dXJuIHZhbHVlcy5cbiAgICpcbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gb25lIEZ1bmN0aW9uIHRvIGludm9rZSBmaXJzdC5cbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gdHdvIEZ1bmN0aW9uIHRvIGludm9rZSBzZWNvbmQuXG4gICAqIEByZXR1cm4ge2Z1bmN0aW9ufSBGdW5jdGlvbiB0aGF0IGludm9rZXMgdGhlIHR3byBhcmd1bWVudCBmdW5jdGlvbnMuXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBmdW5jdGlvbiBjcmVhdGVNZXJnZWRSZXN1bHRGdW5jdGlvbihvbmUsIHR3bykge1xuICAgIHJldHVybiBmdW5jdGlvbiBtZXJnZWRSZXN1bHQoKSB7XG4gICAgICB2YXIgYSA9IG9uZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgdmFyIGIgPSB0d28uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgIGlmIChhID09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIGI7XG4gICAgICB9IGVsc2UgaWYgKGIgPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gYTtcbiAgICAgIH1cbiAgICAgIHZhciBjID0ge307XG4gICAgICBtZXJnZUludG9XaXRoTm9EdXBsaWNhdGVLZXlzKGMsIGEpO1xuICAgICAgbWVyZ2VJbnRvV2l0aE5vRHVwbGljYXRlS2V5cyhjLCBiKTtcbiAgICAgIHJldHVybiBjO1xuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgaW52b2tlcyB0d28gZnVuY3Rpb25zIGFuZCBpZ25vcmVzIHRoZWlyIHJldHVybiB2YWxlcy5cbiAgICpcbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gb25lIEZ1bmN0aW9uIHRvIGludm9rZSBmaXJzdC5cbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gdHdvIEZ1bmN0aW9uIHRvIGludm9rZSBzZWNvbmQuXG4gICAqIEByZXR1cm4ge2Z1bmN0aW9ufSBGdW5jdGlvbiB0aGF0IGludm9rZXMgdGhlIHR3byBhcmd1bWVudCBmdW5jdGlvbnMuXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBmdW5jdGlvbiBjcmVhdGVDaGFpbmVkRnVuY3Rpb24ob25lLCB0d28pIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gY2hhaW5lZEZ1bmN0aW9uKCkge1xuICAgICAgb25lLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICB0d28uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEJpbmRzIGEgbWV0aG9kIHRvIHRoZSBjb21wb25lbnQuXG4gICAqXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBjb21wb25lbnQgQ29tcG9uZW50IHdob3NlIG1ldGhvZCBpcyBnb2luZyB0byBiZSBib3VuZC5cbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gbWV0aG9kIE1ldGhvZCB0byBiZSBib3VuZC5cbiAgICogQHJldHVybiB7ZnVuY3Rpb259IFRoZSBib3VuZCBtZXRob2QuXG4gICAqL1xuICBmdW5jdGlvbiBiaW5kQXV0b0JpbmRNZXRob2QoY29tcG9uZW50LCBtZXRob2QpIHtcbiAgICB2YXIgYm91bmRNZXRob2QgPSBtZXRob2QuYmluZChjb21wb25lbnQpO1xuICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICBib3VuZE1ldGhvZC5fX3JlYWN0Qm91bmRDb250ZXh0ID0gY29tcG9uZW50O1xuICAgICAgYm91bmRNZXRob2QuX19yZWFjdEJvdW5kTWV0aG9kID0gbWV0aG9kO1xuICAgICAgYm91bmRNZXRob2QuX19yZWFjdEJvdW5kQXJndW1lbnRzID0gbnVsbDtcbiAgICAgIHZhciBjb21wb25lbnROYW1lID0gY29tcG9uZW50LmNvbnN0cnVjdG9yLmRpc3BsYXlOYW1lO1xuICAgICAgdmFyIF9iaW5kID0gYm91bmRNZXRob2QuYmluZDtcbiAgICAgIGJvdW5kTWV0aG9kLmJpbmQgPSBmdW5jdGlvbihuZXdUaGlzKSB7XG4gICAgICAgIGZvciAoXG4gICAgICAgICAgdmFyIF9sZW4gPSBhcmd1bWVudHMubGVuZ3RoLFxuICAgICAgICAgICAgYXJncyA9IEFycmF5KF9sZW4gPiAxID8gX2xlbiAtIDEgOiAwKSxcbiAgICAgICAgICAgIF9rZXkgPSAxO1xuICAgICAgICAgIF9rZXkgPCBfbGVuO1xuICAgICAgICAgIF9rZXkrK1xuICAgICAgICApIHtcbiAgICAgICAgICBhcmdzW19rZXkgLSAxXSA9IGFyZ3VtZW50c1tfa2V5XTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFVzZXIgaXMgdHJ5aW5nIHRvIGJpbmQoKSBhbiBhdXRvYm91bmQgbWV0aG9kOyB3ZSBlZmZlY3RpdmVseSB3aWxsXG4gICAgICAgIC8vIGlnbm9yZSB0aGUgdmFsdWUgb2YgXCJ0aGlzXCIgdGhhdCB0aGUgdXNlciBpcyB0cnlpbmcgdG8gdXNlLCBzb1xuICAgICAgICAvLyBsZXQncyB3YXJuLlxuICAgICAgICBpZiAobmV3VGhpcyAhPT0gY29tcG9uZW50ICYmIG5ld1RoaXMgIT09IG51bGwpIHtcbiAgICAgICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgICAgICAgd2FybmluZyhcbiAgICAgICAgICAgICAgZmFsc2UsXG4gICAgICAgICAgICAgICdiaW5kKCk6IFJlYWN0IGNvbXBvbmVudCBtZXRob2RzIG1heSBvbmx5IGJlIGJvdW5kIHRvIHRoZSAnICtcbiAgICAgICAgICAgICAgICAnY29tcG9uZW50IGluc3RhbmNlLiBTZWUgJXMnLFxuICAgICAgICAgICAgICBjb21wb25lbnROYW1lXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICghYXJncy5sZW5ndGgpIHtcbiAgICAgICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgICAgICAgd2FybmluZyhcbiAgICAgICAgICAgICAgZmFsc2UsXG4gICAgICAgICAgICAgICdiaW5kKCk6IFlvdSBhcmUgYmluZGluZyBhIGNvbXBvbmVudCBtZXRob2QgdG8gdGhlIGNvbXBvbmVudC4gJyArXG4gICAgICAgICAgICAgICAgJ1JlYWN0IGRvZXMgdGhpcyBmb3IgeW91IGF1dG9tYXRpY2FsbHkgaW4gYSBoaWdoLXBlcmZvcm1hbmNlICcgK1xuICAgICAgICAgICAgICAgICd3YXksIHNvIHlvdSBjYW4gc2FmZWx5IHJlbW92ZSB0aGlzIGNhbGwuIFNlZSAlcycsXG4gICAgICAgICAgICAgIGNvbXBvbmVudE5hbWVcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBib3VuZE1ldGhvZDtcbiAgICAgICAgfVxuICAgICAgICB2YXIgcmVib3VuZE1ldGhvZCA9IF9iaW5kLmFwcGx5KGJvdW5kTWV0aG9kLCBhcmd1bWVudHMpO1xuICAgICAgICByZWJvdW5kTWV0aG9kLl9fcmVhY3RCb3VuZENvbnRleHQgPSBjb21wb25lbnQ7XG4gICAgICAgIHJlYm91bmRNZXRob2QuX19yZWFjdEJvdW5kTWV0aG9kID0gbWV0aG9kO1xuICAgICAgICByZWJvdW5kTWV0aG9kLl9fcmVhY3RCb3VuZEFyZ3VtZW50cyA9IGFyZ3M7XG4gICAgICAgIHJldHVybiByZWJvdW5kTWV0aG9kO1xuICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIGJvdW5kTWV0aG9kO1xuICB9XG5cbiAgLyoqXG4gICAqIEJpbmRzIGFsbCBhdXRvLWJvdW5kIG1ldGhvZHMgaW4gYSBjb21wb25lbnQuXG4gICAqXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBjb21wb25lbnQgQ29tcG9uZW50IHdob3NlIG1ldGhvZCBpcyBnb2luZyB0byBiZSBib3VuZC5cbiAgICovXG4gIGZ1bmN0aW9uIGJpbmRBdXRvQmluZE1ldGhvZHMoY29tcG9uZW50KSB7XG4gICAgdmFyIHBhaXJzID0gY29tcG9uZW50Ll9fcmVhY3RBdXRvQmluZFBhaXJzO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcGFpcnMubGVuZ3RoOyBpICs9IDIpIHtcbiAgICAgIHZhciBhdXRvQmluZEtleSA9IHBhaXJzW2ldO1xuICAgICAgdmFyIG1ldGhvZCA9IHBhaXJzW2kgKyAxXTtcbiAgICAgIGNvbXBvbmVudFthdXRvQmluZEtleV0gPSBiaW5kQXV0b0JpbmRNZXRob2QoY29tcG9uZW50LCBtZXRob2QpO1xuICAgIH1cbiAgfVxuXG4gIHZhciBJc01vdW50ZWRQcmVNaXhpbiA9IHtcbiAgICBjb21wb25lbnREaWRNb3VudDogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLl9faXNNb3VudGVkID0gdHJ1ZTtcbiAgICB9XG4gIH07XG5cbiAgdmFyIElzTW91bnRlZFBvc3RNaXhpbiA9IHtcbiAgICBjb21wb25lbnRXaWxsVW5tb3VudDogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLl9faXNNb3VudGVkID0gZmFsc2U7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBBZGQgbW9yZSB0byB0aGUgUmVhY3RDbGFzcyBiYXNlIGNsYXNzLiBUaGVzZSBhcmUgYWxsIGxlZ2FjeSBmZWF0dXJlcyBhbmRcbiAgICogdGhlcmVmb3JlIG5vdCBhbHJlYWR5IHBhcnQgb2YgdGhlIG1vZGVybiBSZWFjdENvbXBvbmVudC5cbiAgICovXG4gIHZhciBSZWFjdENsYXNzTWl4aW4gPSB7XG4gICAgLyoqXG4gICAgICogVE9ETzogVGhpcyB3aWxsIGJlIGRlcHJlY2F0ZWQgYmVjYXVzZSBzdGF0ZSBzaG91bGQgYWx3YXlzIGtlZXAgYSBjb25zaXN0ZW50XG4gICAgICogdHlwZSBzaWduYXR1cmUgYW5kIHRoZSBvbmx5IHVzZSBjYXNlIGZvciB0aGlzLCBpcyB0byBhdm9pZCB0aGF0LlxuICAgICAqL1xuICAgIHJlcGxhY2VTdGF0ZTogZnVuY3Rpb24obmV3U3RhdGUsIGNhbGxiYWNrKSB7XG4gICAgICB0aGlzLnVwZGF0ZXIuZW5xdWV1ZVJlcGxhY2VTdGF0ZSh0aGlzLCBuZXdTdGF0ZSwgY2FsbGJhY2spO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBDaGVja3Mgd2hldGhlciBvciBub3QgdGhpcyBjb21wb3NpdGUgY29tcG9uZW50IGlzIG1vdW50ZWQuXG4gICAgICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSBpZiBtb3VudGVkLCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQHByb3RlY3RlZFxuICAgICAqIEBmaW5hbFxuICAgICAqL1xuICAgIGlzTW91bnRlZDogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgICB3YXJuaW5nKFxuICAgICAgICAgIHRoaXMuX19kaWRXYXJuSXNNb3VudGVkLFxuICAgICAgICAgICclczogaXNNb3VudGVkIGlzIGRlcHJlY2F0ZWQuIEluc3RlYWQsIG1ha2Ugc3VyZSB0byBjbGVhbiB1cCAnICtcbiAgICAgICAgICAgICdzdWJzY3JpcHRpb25zIGFuZCBwZW5kaW5nIHJlcXVlc3RzIGluIGNvbXBvbmVudFdpbGxVbm1vdW50IHRvICcgK1xuICAgICAgICAgICAgJ3ByZXZlbnQgbWVtb3J5IGxlYWtzLicsXG4gICAgICAgICAgKHRoaXMuY29uc3RydWN0b3IgJiYgdGhpcy5jb25zdHJ1Y3Rvci5kaXNwbGF5TmFtZSkgfHxcbiAgICAgICAgICAgIHRoaXMubmFtZSB8fFxuICAgICAgICAgICAgJ0NvbXBvbmVudCdcbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy5fX2RpZFdhcm5Jc01vdW50ZWQgPSB0cnVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuICEhdGhpcy5fX2lzTW91bnRlZDtcbiAgICB9XG4gIH07XG5cbiAgdmFyIFJlYWN0Q2xhc3NDb21wb25lbnQgPSBmdW5jdGlvbigpIHt9O1xuICBfYXNzaWduKFxuICAgIFJlYWN0Q2xhc3NDb21wb25lbnQucHJvdG90eXBlLFxuICAgIFJlYWN0Q29tcG9uZW50LnByb3RvdHlwZSxcbiAgICBSZWFjdENsYXNzTWl4aW5cbiAgKTtcblxuICAvKipcbiAgICogQ3JlYXRlcyBhIGNvbXBvc2l0ZSBjb21wb25lbnQgY2xhc3MgZ2l2ZW4gYSBjbGFzcyBzcGVjaWZpY2F0aW9uLlxuICAgKiBTZWUgaHR0cHM6Ly9mYWNlYm9vay5naXRodWIuaW8vcmVhY3QvZG9jcy90b3AtbGV2ZWwtYXBpLmh0bWwjcmVhY3QuY3JlYXRlY2xhc3NcbiAgICpcbiAgICogQHBhcmFtIHtvYmplY3R9IHNwZWMgQ2xhc3Mgc3BlY2lmaWNhdGlvbiAod2hpY2ggbXVzdCBkZWZpbmUgYHJlbmRlcmApLlxuICAgKiBAcmV0dXJuIHtmdW5jdGlvbn0gQ29tcG9uZW50IGNvbnN0cnVjdG9yIGZ1bmN0aW9uLlxuICAgKiBAcHVibGljXG4gICAqL1xuICBmdW5jdGlvbiBjcmVhdGVDbGFzcyhzcGVjKSB7XG4gICAgLy8gVG8ga2VlcCBvdXIgd2FybmluZ3MgbW9yZSB1bmRlcnN0YW5kYWJsZSwgd2UnbGwgdXNlIGEgbGl0dGxlIGhhY2sgaGVyZSB0b1xuICAgIC8vIGVuc3VyZSB0aGF0IENvbnN0cnVjdG9yLm5hbWUgIT09ICdDb25zdHJ1Y3RvcicuIFRoaXMgbWFrZXMgc3VyZSB3ZSBkb24ndFxuICAgIC8vIHVubmVjZXNzYXJpbHkgaWRlbnRpZnkgYSBjbGFzcyB3aXRob3V0IGRpc3BsYXlOYW1lIGFzICdDb25zdHJ1Y3RvcicuXG4gICAgdmFyIENvbnN0cnVjdG9yID0gaWRlbnRpdHkoZnVuY3Rpb24ocHJvcHMsIGNvbnRleHQsIHVwZGF0ZXIpIHtcbiAgICAgIC8vIFRoaXMgY29uc3RydWN0b3IgZ2V0cyBvdmVycmlkZGVuIGJ5IG1vY2tzLiBUaGUgYXJndW1lbnQgaXMgdXNlZFxuICAgICAgLy8gYnkgbW9ja3MgdG8gYXNzZXJ0IG9uIHdoYXQgZ2V0cyBtb3VudGVkLlxuXG4gICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgICB3YXJuaW5nKFxuICAgICAgICAgIHRoaXMgaW5zdGFuY2VvZiBDb25zdHJ1Y3RvcixcbiAgICAgICAgICAnU29tZXRoaW5nIGlzIGNhbGxpbmcgYSBSZWFjdCBjb21wb25lbnQgZGlyZWN0bHkuIFVzZSBhIGZhY3Rvcnkgb3IgJyArXG4gICAgICAgICAgICAnSlNYIGluc3RlYWQuIFNlZTogaHR0cHM6Ly9mYi5tZS9yZWFjdC1sZWdhY3lmYWN0b3J5J1xuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICAvLyBXaXJlIHVwIGF1dG8tYmluZGluZ1xuICAgICAgaWYgKHRoaXMuX19yZWFjdEF1dG9CaW5kUGFpcnMubGVuZ3RoKSB7XG4gICAgICAgIGJpbmRBdXRvQmluZE1ldGhvZHModGhpcyk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMucHJvcHMgPSBwcm9wcztcbiAgICAgIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG4gICAgICB0aGlzLnJlZnMgPSBlbXB0eU9iamVjdDtcbiAgICAgIHRoaXMudXBkYXRlciA9IHVwZGF0ZXIgfHwgUmVhY3ROb29wVXBkYXRlUXVldWU7XG5cbiAgICAgIHRoaXMuc3RhdGUgPSBudWxsO1xuXG4gICAgICAvLyBSZWFjdENsYXNzZXMgZG9lc24ndCBoYXZlIGNvbnN0cnVjdG9ycy4gSW5zdGVhZCwgdGhleSB1c2UgdGhlXG4gICAgICAvLyBnZXRJbml0aWFsU3RhdGUgYW5kIGNvbXBvbmVudFdpbGxNb3VudCBtZXRob2RzIGZvciBpbml0aWFsaXphdGlvbi5cblxuICAgICAgdmFyIGluaXRpYWxTdGF0ZSA9IHRoaXMuZ2V0SW5pdGlhbFN0YXRlID8gdGhpcy5nZXRJbml0aWFsU3RhdGUoKSA6IG51bGw7XG4gICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgICAvLyBXZSBhbGxvdyBhdXRvLW1vY2tzIHRvIHByb2NlZWQgYXMgaWYgdGhleSdyZSByZXR1cm5pbmcgbnVsbC5cbiAgICAgICAgaWYgKFxuICAgICAgICAgIGluaXRpYWxTdGF0ZSA9PT0gdW5kZWZpbmVkICYmXG4gICAgICAgICAgdGhpcy5nZXRJbml0aWFsU3RhdGUuX2lzTW9ja0Z1bmN0aW9uXG4gICAgICAgICkge1xuICAgICAgICAgIC8vIFRoaXMgaXMgcHJvYmFibHkgYmFkIHByYWN0aWNlLiBDb25zaWRlciB3YXJuaW5nIGhlcmUgYW5kXG4gICAgICAgICAgLy8gZGVwcmVjYXRpbmcgdGhpcyBjb252ZW5pZW5jZS5cbiAgICAgICAgICBpbml0aWFsU3RhdGUgPSBudWxsO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBfaW52YXJpYW50KFxuICAgICAgICB0eXBlb2YgaW5pdGlhbFN0YXRlID09PSAnb2JqZWN0JyAmJiAhQXJyYXkuaXNBcnJheShpbml0aWFsU3RhdGUpLFxuICAgICAgICAnJXMuZ2V0SW5pdGlhbFN0YXRlKCk6IG11c3QgcmV0dXJuIGFuIG9iamVjdCBvciBudWxsJyxcbiAgICAgICAgQ29uc3RydWN0b3IuZGlzcGxheU5hbWUgfHwgJ1JlYWN0Q29tcG9zaXRlQ29tcG9uZW50J1xuICAgICAgKTtcblxuICAgICAgdGhpcy5zdGF0ZSA9IGluaXRpYWxTdGF0ZTtcbiAgICB9KTtcbiAgICBDb25zdHJ1Y3Rvci5wcm90b3R5cGUgPSBuZXcgUmVhY3RDbGFzc0NvbXBvbmVudCgpO1xuICAgIENvbnN0cnVjdG9yLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IENvbnN0cnVjdG9yO1xuICAgIENvbnN0cnVjdG9yLnByb3RvdHlwZS5fX3JlYWN0QXV0b0JpbmRQYWlycyA9IFtdO1xuXG4gICAgaW5qZWN0ZWRNaXhpbnMuZm9yRWFjaChtaXhTcGVjSW50b0NvbXBvbmVudC5iaW5kKG51bGwsIENvbnN0cnVjdG9yKSk7XG5cbiAgICBtaXhTcGVjSW50b0NvbXBvbmVudChDb25zdHJ1Y3RvciwgSXNNb3VudGVkUHJlTWl4aW4pO1xuICAgIG1peFNwZWNJbnRvQ29tcG9uZW50KENvbnN0cnVjdG9yLCBzcGVjKTtcbiAgICBtaXhTcGVjSW50b0NvbXBvbmVudChDb25zdHJ1Y3RvciwgSXNNb3VudGVkUG9zdE1peGluKTtcblxuICAgIC8vIEluaXRpYWxpemUgdGhlIGRlZmF1bHRQcm9wcyBwcm9wZXJ0eSBhZnRlciBhbGwgbWl4aW5zIGhhdmUgYmVlbiBtZXJnZWQuXG4gICAgaWYgKENvbnN0cnVjdG9yLmdldERlZmF1bHRQcm9wcykge1xuICAgICAgQ29uc3RydWN0b3IuZGVmYXVsdFByb3BzID0gQ29uc3RydWN0b3IuZ2V0RGVmYXVsdFByb3BzKCk7XG4gICAgfVxuXG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgIC8vIFRoaXMgaXMgYSB0YWcgdG8gaW5kaWNhdGUgdGhhdCB0aGUgdXNlIG9mIHRoZXNlIG1ldGhvZCBuYW1lcyBpcyBvayxcbiAgICAgIC8vIHNpbmNlIGl0J3MgdXNlZCB3aXRoIGNyZWF0ZUNsYXNzLiBJZiBpdCdzIG5vdCwgdGhlbiBpdCdzIGxpa2VseSBhXG4gICAgICAvLyBtaXN0YWtlIHNvIHdlJ2xsIHdhcm4geW91IHRvIHVzZSB0aGUgc3RhdGljIHByb3BlcnR5LCBwcm9wZXJ0eVxuICAgICAgLy8gaW5pdGlhbGl6ZXIgb3IgY29uc3RydWN0b3IgcmVzcGVjdGl2ZWx5LlxuICAgICAgaWYgKENvbnN0cnVjdG9yLmdldERlZmF1bHRQcm9wcykge1xuICAgICAgICBDb25zdHJ1Y3Rvci5nZXREZWZhdWx0UHJvcHMuaXNSZWFjdENsYXNzQXBwcm92ZWQgPSB7fTtcbiAgICAgIH1cbiAgICAgIGlmIChDb25zdHJ1Y3Rvci5wcm90b3R5cGUuZ2V0SW5pdGlhbFN0YXRlKSB7XG4gICAgICAgIENvbnN0cnVjdG9yLnByb3RvdHlwZS5nZXRJbml0aWFsU3RhdGUuaXNSZWFjdENsYXNzQXBwcm92ZWQgPSB7fTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBfaW52YXJpYW50KFxuICAgICAgQ29uc3RydWN0b3IucHJvdG90eXBlLnJlbmRlcixcbiAgICAgICdjcmVhdGVDbGFzcyguLi4pOiBDbGFzcyBzcGVjaWZpY2F0aW9uIG11c3QgaW1wbGVtZW50IGEgYHJlbmRlcmAgbWV0aG9kLidcbiAgICApO1xuXG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgIHdhcm5pbmcoXG4gICAgICAgICFDb25zdHJ1Y3Rvci5wcm90b3R5cGUuY29tcG9uZW50U2hvdWxkVXBkYXRlLFxuICAgICAgICAnJXMgaGFzIGEgbWV0aG9kIGNhbGxlZCAnICtcbiAgICAgICAgICAnY29tcG9uZW50U2hvdWxkVXBkYXRlKCkuIERpZCB5b3UgbWVhbiBzaG91bGRDb21wb25lbnRVcGRhdGUoKT8gJyArXG4gICAgICAgICAgJ1RoZSBuYW1lIGlzIHBocmFzZWQgYXMgYSBxdWVzdGlvbiBiZWNhdXNlIHRoZSBmdW5jdGlvbiBpcyAnICtcbiAgICAgICAgICAnZXhwZWN0ZWQgdG8gcmV0dXJuIGEgdmFsdWUuJyxcbiAgICAgICAgc3BlYy5kaXNwbGF5TmFtZSB8fCAnQSBjb21wb25lbnQnXG4gICAgICApO1xuICAgICAgd2FybmluZyhcbiAgICAgICAgIUNvbnN0cnVjdG9yLnByb3RvdHlwZS5jb21wb25lbnRXaWxsUmVjaWV2ZVByb3BzLFxuICAgICAgICAnJXMgaGFzIGEgbWV0aG9kIGNhbGxlZCAnICtcbiAgICAgICAgICAnY29tcG9uZW50V2lsbFJlY2lldmVQcm9wcygpLiBEaWQgeW91IG1lYW4gY29tcG9uZW50V2lsbFJlY2VpdmVQcm9wcygpPycsXG4gICAgICAgIHNwZWMuZGlzcGxheU5hbWUgfHwgJ0EgY29tcG9uZW50J1xuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBSZWR1Y2UgdGltZSBzcGVudCBkb2luZyBsb29rdXBzIGJ5IHNldHRpbmcgdGhlc2Ugb24gdGhlIHByb3RvdHlwZS5cbiAgICBmb3IgKHZhciBtZXRob2ROYW1lIGluIFJlYWN0Q2xhc3NJbnRlcmZhY2UpIHtcbiAgICAgIGlmICghQ29uc3RydWN0b3IucHJvdG90eXBlW21ldGhvZE5hbWVdKSB7XG4gICAgICAgIENvbnN0cnVjdG9yLnByb3RvdHlwZVttZXRob2ROYW1lXSA9IG51bGw7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIENvbnN0cnVjdG9yO1xuICB9XG5cbiAgcmV0dXJuIGNyZWF0ZUNsYXNzO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZhY3Rvcnk7XG4iLCIvKlxub2JqZWN0LWFzc2lnblxuKGMpIFNpbmRyZSBTb3JodXNcbkBsaWNlbnNlIE1JVFxuKi9cblxuJ3VzZSBzdHJpY3QnO1xuLyogZXNsaW50LWRpc2FibGUgbm8tdW51c2VkLXZhcnMgKi9cbnZhciBnZXRPd25Qcm9wZXJ0eVN5bWJvbHMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzO1xudmFyIGhhc093blByb3BlcnR5ID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcbnZhciBwcm9wSXNFbnVtZXJhYmxlID0gT2JqZWN0LnByb3RvdHlwZS5wcm9wZXJ0eUlzRW51bWVyYWJsZTtcblxuZnVuY3Rpb24gdG9PYmplY3QodmFsKSB7XG5cdGlmICh2YWwgPT09IG51bGwgfHwgdmFsID09PSB1bmRlZmluZWQpIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKCdPYmplY3QuYXNzaWduIGNhbm5vdCBiZSBjYWxsZWQgd2l0aCBudWxsIG9yIHVuZGVmaW5lZCcpO1xuXHR9XG5cblx0cmV0dXJuIE9iamVjdCh2YWwpO1xufVxuXG5mdW5jdGlvbiBzaG91bGRVc2VOYXRpdmUoKSB7XG5cdHRyeSB7XG5cdFx0aWYgKCFPYmplY3QuYXNzaWduKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Ly8gRGV0ZWN0IGJ1Z2d5IHByb3BlcnR5IGVudW1lcmF0aW9uIG9yZGVyIGluIG9sZGVyIFY4IHZlcnNpb25zLlxuXG5cdFx0Ly8gaHR0cHM6Ly9idWdzLmNocm9taXVtLm9yZy9wL3Y4L2lzc3Vlcy9kZXRhaWw/aWQ9NDExOFxuXHRcdHZhciB0ZXN0MSA9IG5ldyBTdHJpbmcoJ2FiYycpOyAgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1uZXctd3JhcHBlcnNcblx0XHR0ZXN0MVs1XSA9ICdkZSc7XG5cdFx0aWYgKE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHRlc3QxKVswXSA9PT0gJzUnKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Ly8gaHR0cHM6Ly9idWdzLmNocm9taXVtLm9yZy9wL3Y4L2lzc3Vlcy9kZXRhaWw/aWQ9MzA1NlxuXHRcdHZhciB0ZXN0MiA9IHt9O1xuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgMTA7IGkrKykge1xuXHRcdFx0dGVzdDJbJ18nICsgU3RyaW5nLmZyb21DaGFyQ29kZShpKV0gPSBpO1xuXHRcdH1cblx0XHR2YXIgb3JkZXIyID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModGVzdDIpLm1hcChmdW5jdGlvbiAobikge1xuXHRcdFx0cmV0dXJuIHRlc3QyW25dO1xuXHRcdH0pO1xuXHRcdGlmIChvcmRlcjIuam9pbignJykgIT09ICcwMTIzNDU2Nzg5Jykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdC8vIGh0dHBzOi8vYnVncy5jaHJvbWl1bS5vcmcvcC92OC9pc3N1ZXMvZGV0YWlsP2lkPTMwNTZcblx0XHR2YXIgdGVzdDMgPSB7fTtcblx0XHQnYWJjZGVmZ2hpamtsbW5vcHFyc3QnLnNwbGl0KCcnKS5mb3JFYWNoKGZ1bmN0aW9uIChsZXR0ZXIpIHtcblx0XHRcdHRlc3QzW2xldHRlcl0gPSBsZXR0ZXI7XG5cdFx0fSk7XG5cdFx0aWYgKE9iamVjdC5rZXlzKE9iamVjdC5hc3NpZ24oe30sIHRlc3QzKSkuam9pbignJykgIT09XG5cdFx0XHRcdCdhYmNkZWZnaGlqa2xtbm9wcXJzdCcpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0Ly8gV2UgZG9uJ3QgZXhwZWN0IGFueSBvZiB0aGUgYWJvdmUgdG8gdGhyb3csIGJ1dCBiZXR0ZXIgdG8gYmUgc2FmZS5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBzaG91bGRVc2VOYXRpdmUoKSA/IE9iamVjdC5hc3NpZ24gOiBmdW5jdGlvbiAodGFyZ2V0LCBzb3VyY2UpIHtcblx0dmFyIGZyb207XG5cdHZhciB0byA9IHRvT2JqZWN0KHRhcmdldCk7XG5cdHZhciBzeW1ib2xzO1xuXG5cdGZvciAodmFyIHMgPSAxOyBzIDwgYXJndW1lbnRzLmxlbmd0aDsgcysrKSB7XG5cdFx0ZnJvbSA9IE9iamVjdChhcmd1bWVudHNbc10pO1xuXG5cdFx0Zm9yICh2YXIga2V5IGluIGZyb20pIHtcblx0XHRcdGlmIChoYXNPd25Qcm9wZXJ0eS5jYWxsKGZyb20sIGtleSkpIHtcblx0XHRcdFx0dG9ba2V5XSA9IGZyb21ba2V5XTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoZ2V0T3duUHJvcGVydHlTeW1ib2xzKSB7XG5cdFx0XHRzeW1ib2xzID0gZ2V0T3duUHJvcGVydHlTeW1ib2xzKGZyb20pO1xuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBzeW1ib2xzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGlmIChwcm9wSXNFbnVtZXJhYmxlLmNhbGwoZnJvbSwgc3ltYm9sc1tpXSkpIHtcblx0XHRcdFx0XHR0b1tzeW1ib2xzW2ldXSA9IGZyb21bc3ltYm9sc1tpXV07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gdG87XG59O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbi8qKlxuICogQ29weXJpZ2h0IChjKSAyMDEzLXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqXG4gKiBcbiAqL1xuXG5mdW5jdGlvbiBtYWtlRW1wdHlGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gYXJnO1xuICB9O1xufVxuXG4vKipcbiAqIFRoaXMgZnVuY3Rpb24gYWNjZXB0cyBhbmQgZGlzY2FyZHMgaW5wdXRzOyBpdCBoYXMgbm8gc2lkZSBlZmZlY3RzLiBUaGlzIGlzXG4gKiBwcmltYXJpbHkgdXNlZnVsIGlkaW9tYXRpY2FsbHkgZm9yIG92ZXJyaWRhYmxlIGZ1bmN0aW9uIGVuZHBvaW50cyB3aGljaFxuICogYWx3YXlzIG5lZWQgdG8gYmUgY2FsbGFibGUsIHNpbmNlIEpTIGxhY2tzIGEgbnVsbC1jYWxsIGlkaW9tIGFsYSBDb2NvYS5cbiAqL1xudmFyIGVtcHR5RnVuY3Rpb24gPSBmdW5jdGlvbiBlbXB0eUZ1bmN0aW9uKCkge307XG5cbmVtcHR5RnVuY3Rpb24udGhhdFJldHVybnMgPSBtYWtlRW1wdHlGdW5jdGlvbjtcbmVtcHR5RnVuY3Rpb24udGhhdFJldHVybnNGYWxzZSA9IG1ha2VFbXB0eUZ1bmN0aW9uKGZhbHNlKTtcbmVtcHR5RnVuY3Rpb24udGhhdFJldHVybnNUcnVlID0gbWFrZUVtcHR5RnVuY3Rpb24odHJ1ZSk7XG5lbXB0eUZ1bmN0aW9uLnRoYXRSZXR1cm5zTnVsbCA9IG1ha2VFbXB0eUZ1bmN0aW9uKG51bGwpO1xuZW1wdHlGdW5jdGlvbi50aGF0UmV0dXJuc1RoaXMgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzO1xufTtcbmVtcHR5RnVuY3Rpb24udGhhdFJldHVybnNBcmd1bWVudCA9IGZ1bmN0aW9uIChhcmcpIHtcbiAgcmV0dXJuIGFyZztcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZW1wdHlGdW5jdGlvbjsiLCIvKipcbiAqIENvcHlyaWdodCAoYykgMjAxMy1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIGVtcHR5T2JqZWN0ID0ge307XG5cbmlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gIE9iamVjdC5mcmVlemUoZW1wdHlPYmplY3QpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGVtcHR5T2JqZWN0OyIsIi8qKlxuICogQ29weXJpZ2h0IChjKSAyMDEzLXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIFVzZSBpbnZhcmlhbnQoKSB0byBhc3NlcnQgc3RhdGUgd2hpY2ggeW91ciBwcm9ncmFtIGFzc3VtZXMgdG8gYmUgdHJ1ZS5cbiAqXG4gKiBQcm92aWRlIHNwcmludGYtc3R5bGUgZm9ybWF0IChvbmx5ICVzIGlzIHN1cHBvcnRlZCkgYW5kIGFyZ3VtZW50c1xuICogdG8gcHJvdmlkZSBpbmZvcm1hdGlvbiBhYm91dCB3aGF0IGJyb2tlIGFuZCB3aGF0IHlvdSB3ZXJlXG4gKiBleHBlY3RpbmcuXG4gKlxuICogVGhlIGludmFyaWFudCBtZXNzYWdlIHdpbGwgYmUgc3RyaXBwZWQgaW4gcHJvZHVjdGlvbiwgYnV0IHRoZSBpbnZhcmlhbnRcbiAqIHdpbGwgcmVtYWluIHRvIGVuc3VyZSBsb2dpYyBkb2VzIG5vdCBkaWZmZXIgaW4gcHJvZHVjdGlvbi5cbiAqL1xuXG52YXIgdmFsaWRhdGVGb3JtYXQgPSBmdW5jdGlvbiB2YWxpZGF0ZUZvcm1hdChmb3JtYXQpIHt9O1xuXG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICB2YWxpZGF0ZUZvcm1hdCA9IGZ1bmN0aW9uIHZhbGlkYXRlRm9ybWF0KGZvcm1hdCkge1xuICAgIGlmIChmb3JtYXQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdpbnZhcmlhbnQgcmVxdWlyZXMgYW4gZXJyb3IgbWVzc2FnZSBhcmd1bWVudCcpO1xuICAgIH1cbiAgfTtcbn1cblxuZnVuY3Rpb24gaW52YXJpYW50KGNvbmRpdGlvbiwgZm9ybWF0LCBhLCBiLCBjLCBkLCBlLCBmKSB7XG4gIHZhbGlkYXRlRm9ybWF0KGZvcm1hdCk7XG5cbiAgaWYgKCFjb25kaXRpb24pIHtcbiAgICB2YXIgZXJyb3I7XG4gICAgaWYgKGZvcm1hdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBlcnJvciA9IG5ldyBFcnJvcignTWluaWZpZWQgZXhjZXB0aW9uIG9jY3VycmVkOyB1c2UgdGhlIG5vbi1taW5pZmllZCBkZXYgZW52aXJvbm1lbnQgJyArICdmb3IgdGhlIGZ1bGwgZXJyb3IgbWVzc2FnZSBhbmQgYWRkaXRpb25hbCBoZWxwZnVsIHdhcm5pbmdzLicpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgYXJncyA9IFthLCBiLCBjLCBkLCBlLCBmXTtcbiAgICAgIHZhciBhcmdJbmRleCA9IDA7XG4gICAgICBlcnJvciA9IG5ldyBFcnJvcihmb3JtYXQucmVwbGFjZSgvJXMvZywgZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gYXJnc1thcmdJbmRleCsrXTtcbiAgICAgIH0pKTtcbiAgICAgIGVycm9yLm5hbWUgPSAnSW52YXJpYW50IFZpb2xhdGlvbic7XG4gICAgfVxuXG4gICAgZXJyb3IuZnJhbWVzVG9Qb3AgPSAxOyAvLyB3ZSBkb24ndCBjYXJlIGFib3V0IGludmFyaWFudCdzIG93biBmcmFtZVxuICAgIHRocm93IGVycm9yO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaW52YXJpYW50OyIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTQtMjAxNSwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICpcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBlbXB0eUZ1bmN0aW9uID0gcmVxdWlyZSgnLi9lbXB0eUZ1bmN0aW9uJyk7XG5cbi8qKlxuICogU2ltaWxhciB0byBpbnZhcmlhbnQgYnV0IG9ubHkgbG9ncyBhIHdhcm5pbmcgaWYgdGhlIGNvbmRpdGlvbiBpcyBub3QgbWV0LlxuICogVGhpcyBjYW4gYmUgdXNlZCB0byBsb2cgaXNzdWVzIGluIGRldmVsb3BtZW50IGVudmlyb25tZW50cyBpbiBjcml0aWNhbFxuICogcGF0aHMuIFJlbW92aW5nIHRoZSBsb2dnaW5nIGNvZGUgZm9yIHByb2R1Y3Rpb24gZW52aXJvbm1lbnRzIHdpbGwga2VlcCB0aGVcbiAqIHNhbWUgbG9naWMgYW5kIGZvbGxvdyB0aGUgc2FtZSBjb2RlIHBhdGhzLlxuICovXG5cbnZhciB3YXJuaW5nID0gZW1wdHlGdW5jdGlvbjtcblxuaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgdmFyIHByaW50V2FybmluZyA9IGZ1bmN0aW9uIHByaW50V2FybmluZyhmb3JtYXQpIHtcbiAgICBmb3IgKHZhciBfbGVuID0gYXJndW1lbnRzLmxlbmd0aCwgYXJncyA9IEFycmF5KF9sZW4gPiAxID8gX2xlbiAtIDEgOiAwKSwgX2tleSA9IDE7IF9rZXkgPCBfbGVuOyBfa2V5KyspIHtcbiAgICAgIGFyZ3NbX2tleSAtIDFdID0gYXJndW1lbnRzW19rZXldO1xuICAgIH1cblxuICAgIHZhciBhcmdJbmRleCA9IDA7XG4gICAgdmFyIG1lc3NhZ2UgPSAnV2FybmluZzogJyArIGZvcm1hdC5yZXBsYWNlKC8lcy9nLCBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gYXJnc1thcmdJbmRleCsrXTtcbiAgICB9KTtcbiAgICBpZiAodHlwZW9mIGNvbnNvbGUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBjb25zb2xlLmVycm9yKG1lc3NhZ2UpO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgLy8gLS0tIFdlbGNvbWUgdG8gZGVidWdnaW5nIFJlYWN0IC0tLVxuICAgICAgLy8gVGhpcyBlcnJvciB3YXMgdGhyb3duIGFzIGEgY29udmVuaWVuY2Ugc28gdGhhdCB5b3UgY2FuIHVzZSB0aGlzIHN0YWNrXG4gICAgICAvLyB0byBmaW5kIHRoZSBjYWxsc2l0ZSB0aGF0IGNhdXNlZCB0aGlzIHdhcm5pbmcgdG8gZmlyZS5cbiAgICAgIHRocm93IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgICB9IGNhdGNoICh4KSB7fVxuICB9O1xuXG4gIHdhcm5pbmcgPSBmdW5jdGlvbiB3YXJuaW5nKGNvbmRpdGlvbiwgZm9ybWF0KSB7XG4gICAgaWYgKGZvcm1hdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2B3YXJuaW5nKGNvbmRpdGlvbiwgZm9ybWF0LCAuLi5hcmdzKWAgcmVxdWlyZXMgYSB3YXJuaW5nICcgKyAnbWVzc2FnZSBhcmd1bWVudCcpO1xuICAgIH1cblxuICAgIGlmIChmb3JtYXQuaW5kZXhPZignRmFpbGVkIENvbXBvc2l0ZSBwcm9wVHlwZTogJykgPT09IDApIHtcbiAgICAgIHJldHVybjsgLy8gSWdub3JlIENvbXBvc2l0ZUNvbXBvbmVudCBwcm9wdHlwZSBjaGVjay5cbiAgICB9XG5cbiAgICBpZiAoIWNvbmRpdGlvbikge1xuICAgICAgZm9yICh2YXIgX2xlbjIgPSBhcmd1bWVudHMubGVuZ3RoLCBhcmdzID0gQXJyYXkoX2xlbjIgPiAyID8gX2xlbjIgLSAyIDogMCksIF9rZXkyID0gMjsgX2tleTIgPCBfbGVuMjsgX2tleTIrKykge1xuICAgICAgICBhcmdzW19rZXkyIC0gMl0gPSBhcmd1bWVudHNbX2tleTJdO1xuICAgICAgfVxuXG4gICAgICBwcmludFdhcm5pbmcuYXBwbHkodW5kZWZpbmVkLCBbZm9ybWF0XS5jb25jYXQoYXJncykpO1xuICAgIH1cbiAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB3YXJuaW5nOyIsIi8qIVxuICogRGV0ZXJtaW5lIGlmIGFuIG9iamVjdCBpcyBhIEJ1ZmZlclxuICpcbiAqIEBhdXRob3IgICBGZXJvc3MgQWJvdWtoYWRpamVoIDxmZXJvc3NAZmVyb3NzLm9yZz4gPGh0dHA6Ly9mZXJvc3Mub3JnPlxuICogQGxpY2Vuc2UgIE1JVFxuICovXG5cbi8vIFRoZSBfaXNCdWZmZXIgY2hlY2sgaXMgZm9yIFNhZmFyaSA1LTcgc3VwcG9ydCwgYmVjYXVzZSBpdCdzIG1pc3Npbmdcbi8vIE9iamVjdC5wcm90b3R5cGUuY29uc3RydWN0b3IuIFJlbW92ZSB0aGlzIGV2ZW50dWFsbHlcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKG9iaikge1xuICByZXR1cm4gb2JqICE9IG51bGwgJiYgKGlzQnVmZmVyKG9iaikgfHwgaXNTbG93QnVmZmVyKG9iaikgfHwgISFvYmouX2lzQnVmZmVyKVxufVxuXG5mdW5jdGlvbiBpc0J1ZmZlciAob2JqKSB7XG4gIHJldHVybiAhIW9iai5jb25zdHJ1Y3RvciAmJiB0eXBlb2Ygb2JqLmNvbnN0cnVjdG9yLmlzQnVmZmVyID09PSAnZnVuY3Rpb24nICYmIG9iai5jb25zdHJ1Y3Rvci5pc0J1ZmZlcihvYmopXG59XG5cbi8vIEZvciBOb2RlIHYwLjEwIHN1cHBvcnQuIFJlbW92ZSB0aGlzIGV2ZW50dWFsbHkuXG5mdW5jdGlvbiBpc1Nsb3dCdWZmZXIgKG9iaikge1xuICByZXR1cm4gdHlwZW9mIG9iai5yZWFkRmxvYXRMRSA9PT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2Ygb2JqLnNsaWNlID09PSAnZnVuY3Rpb24nICYmIGlzQnVmZmVyKG9iai5zbGljZSgwLCAwKSlcbn1cbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG4vLyBjYWNoZWQgZnJvbSB3aGF0ZXZlciBnbG9iYWwgaXMgcHJlc2VudCBzbyB0aGF0IHRlc3QgcnVubmVycyB0aGF0IHN0dWIgaXRcbi8vIGRvbid0IGJyZWFrIHRoaW5ncy4gIEJ1dCB3ZSBuZWVkIHRvIHdyYXAgaXQgaW4gYSB0cnkgY2F0Y2ggaW4gY2FzZSBpdCBpc1xuLy8gd3JhcHBlZCBpbiBzdHJpY3QgbW9kZSBjb2RlIHdoaWNoIGRvZXNuJ3QgZGVmaW5lIGFueSBnbG9iYWxzLiAgSXQncyBpbnNpZGUgYVxuLy8gZnVuY3Rpb24gYmVjYXVzZSB0cnkvY2F0Y2hlcyBkZW9wdGltaXplIGluIGNlcnRhaW4gZW5naW5lcy5cblxudmFyIGNhY2hlZFNldFRpbWVvdXQ7XG52YXIgY2FjaGVkQ2xlYXJUaW1lb3V0O1xuXG5mdW5jdGlvbiBkZWZhdWx0U2V0VGltb3V0KCkge1xuICAgIHRocm93IG5ldyBFcnJvcignc2V0VGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuZnVuY3Rpb24gZGVmYXVsdENsZWFyVGltZW91dCAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdjbGVhclRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbihmdW5jdGlvbiAoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBzZXRUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBjbGVhclRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgfVxufSAoKSlcbmZ1bmN0aW9uIHJ1blRpbWVvdXQoZnVuKSB7XG4gICAgaWYgKGNhY2hlZFNldFRpbWVvdXQgPT09IHNldFRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIC8vIGlmIHNldFRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRTZXRUaW1lb3V0ID09PSBkZWZhdWx0U2V0VGltb3V0IHx8ICFjYWNoZWRTZXRUaW1lb3V0KSAmJiBzZXRUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfSBjYXRjaChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbChudWxsLCBmdW4sIDApO1xuICAgICAgICB9IGNhdGNoKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3JcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwodGhpcywgZnVuLCAwKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG59XG5mdW5jdGlvbiBydW5DbGVhclRpbWVvdXQobWFya2VyKSB7XG4gICAgaWYgKGNhY2hlZENsZWFyVGltZW91dCA9PT0gY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIC8vIGlmIGNsZWFyVGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZENsZWFyVGltZW91dCA9PT0gZGVmYXVsdENsZWFyVGltZW91dCB8fCAhY2FjaGVkQ2xlYXJUaW1lb3V0KSAmJiBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0ICB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKG51bGwsIG1hcmtlcik7XG4gICAgICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3IuXG4gICAgICAgICAgICAvLyBTb21lIHZlcnNpb25zIG9mIEkuRS4gaGF2ZSBkaWZmZXJlbnQgcnVsZXMgZm9yIGNsZWFyVGltZW91dCB2cyBzZXRUaW1lb3V0XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwodGhpcywgbWFya2VyKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG5cbn1cbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGlmICghZHJhaW5pbmcgfHwgIWN1cnJlbnRRdWV1ZSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHJ1blRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIHJ1bkNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHJ1blRpbWVvdXQoZHJhaW5RdWV1ZSk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcbnByb2Nlc3MucHJlcGVuZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucHJlcGVuZE9uY2VMaXN0ZW5lciA9IG5vb3A7XG5cbnByb2Nlc3MubGlzdGVuZXJzID0gZnVuY3Rpb24gKG5hbWUpIHsgcmV0dXJuIFtdIH1cblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCIvKipcbiAqIENvcHlyaWdodCAyMDEzLXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbmlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gIHZhciBpbnZhcmlhbnQgPSByZXF1aXJlKCdmYmpzL2xpYi9pbnZhcmlhbnQnKTtcbiAgdmFyIHdhcm5pbmcgPSByZXF1aXJlKCdmYmpzL2xpYi93YXJuaW5nJyk7XG4gIHZhciBSZWFjdFByb3BUeXBlc1NlY3JldCA9IHJlcXVpcmUoJy4vbGliL1JlYWN0UHJvcFR5cGVzU2VjcmV0Jyk7XG4gIHZhciBsb2dnZWRUeXBlRmFpbHVyZXMgPSB7fTtcbn1cblxuLyoqXG4gKiBBc3NlcnQgdGhhdCB0aGUgdmFsdWVzIG1hdGNoIHdpdGggdGhlIHR5cGUgc3BlY3MuXG4gKiBFcnJvciBtZXNzYWdlcyBhcmUgbWVtb3JpemVkIGFuZCB3aWxsIG9ubHkgYmUgc2hvd24gb25jZS5cbiAqXG4gKiBAcGFyYW0ge29iamVjdH0gdHlwZVNwZWNzIE1hcCBvZiBuYW1lIHRvIGEgUmVhY3RQcm9wVHlwZVxuICogQHBhcmFtIHtvYmplY3R9IHZhbHVlcyBSdW50aW1lIHZhbHVlcyB0aGF0IG5lZWQgdG8gYmUgdHlwZS1jaGVja2VkXG4gKiBAcGFyYW0ge3N0cmluZ30gbG9jYXRpb24gZS5nLiBcInByb3BcIiwgXCJjb250ZXh0XCIsIFwiY2hpbGQgY29udGV4dFwiXG4gKiBAcGFyYW0ge3N0cmluZ30gY29tcG9uZW50TmFtZSBOYW1lIG9mIHRoZSBjb21wb25lbnQgZm9yIGVycm9yIG1lc3NhZ2VzLlxuICogQHBhcmFtIHs/RnVuY3Rpb259IGdldFN0YWNrIFJldHVybnMgdGhlIGNvbXBvbmVudCBzdGFjay5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIGNoZWNrUHJvcFR5cGVzKHR5cGVTcGVjcywgdmFsdWVzLCBsb2NhdGlvbiwgY29tcG9uZW50TmFtZSwgZ2V0U3RhY2spIHtcbiAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICBmb3IgKHZhciB0eXBlU3BlY05hbWUgaW4gdHlwZVNwZWNzKSB7XG4gICAgICBpZiAodHlwZVNwZWNzLmhhc093blByb3BlcnR5KHR5cGVTcGVjTmFtZSkpIHtcbiAgICAgICAgdmFyIGVycm9yO1xuICAgICAgICAvLyBQcm9wIHR5cGUgdmFsaWRhdGlvbiBtYXkgdGhyb3cuIEluIGNhc2UgdGhleSBkbywgd2UgZG9uJ3Qgd2FudCB0b1xuICAgICAgICAvLyBmYWlsIHRoZSByZW5kZXIgcGhhc2Ugd2hlcmUgaXQgZGlkbid0IGZhaWwgYmVmb3JlLiBTbyB3ZSBsb2cgaXQuXG4gICAgICAgIC8vIEFmdGVyIHRoZXNlIGhhdmUgYmVlbiBjbGVhbmVkIHVwLCB3ZSdsbCBsZXQgdGhlbSB0aHJvdy5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAvLyBUaGlzIGlzIGludGVudGlvbmFsbHkgYW4gaW52YXJpYW50IHRoYXQgZ2V0cyBjYXVnaHQuIEl0J3MgdGhlIHNhbWVcbiAgICAgICAgICAvLyBiZWhhdmlvciBhcyB3aXRob3V0IHRoaXMgc3RhdGVtZW50IGV4Y2VwdCB3aXRoIGEgYmV0dGVyIG1lc3NhZ2UuXG4gICAgICAgICAgaW52YXJpYW50KHR5cGVvZiB0eXBlU3BlY3NbdHlwZVNwZWNOYW1lXSA9PT0gJ2Z1bmN0aW9uJywgJyVzOiAlcyB0eXBlIGAlc2AgaXMgaW52YWxpZDsgaXQgbXVzdCBiZSBhIGZ1bmN0aW9uLCB1c3VhbGx5IGZyb20gJyArICdSZWFjdC5Qcm9wVHlwZXMuJywgY29tcG9uZW50TmFtZSB8fCAnUmVhY3QgY2xhc3MnLCBsb2NhdGlvbiwgdHlwZVNwZWNOYW1lKTtcbiAgICAgICAgICBlcnJvciA9IHR5cGVTcGVjc1t0eXBlU3BlY05hbWVdKHZhbHVlcywgdHlwZVNwZWNOYW1lLCBjb21wb25lbnROYW1lLCBsb2NhdGlvbiwgbnVsbCwgUmVhY3RQcm9wVHlwZXNTZWNyZXQpO1xuICAgICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICAgIGVycm9yID0gZXg7XG4gICAgICAgIH1cbiAgICAgICAgd2FybmluZyghZXJyb3IgfHwgZXJyb3IgaW5zdGFuY2VvZiBFcnJvciwgJyVzOiB0eXBlIHNwZWNpZmljYXRpb24gb2YgJXMgYCVzYCBpcyBpbnZhbGlkOyB0aGUgdHlwZSBjaGVja2VyICcgKyAnZnVuY3Rpb24gbXVzdCByZXR1cm4gYG51bGxgIG9yIGFuIGBFcnJvcmAgYnV0IHJldHVybmVkIGEgJXMuICcgKyAnWW91IG1heSBoYXZlIGZvcmdvdHRlbiB0byBwYXNzIGFuIGFyZ3VtZW50IHRvIHRoZSB0eXBlIGNoZWNrZXIgJyArICdjcmVhdG9yIChhcnJheU9mLCBpbnN0YW5jZU9mLCBvYmplY3RPZiwgb25lT2YsIG9uZU9mVHlwZSwgYW5kICcgKyAnc2hhcGUgYWxsIHJlcXVpcmUgYW4gYXJndW1lbnQpLicsIGNvbXBvbmVudE5hbWUgfHwgJ1JlYWN0IGNsYXNzJywgbG9jYXRpb24sIHR5cGVTcGVjTmFtZSwgdHlwZW9mIGVycm9yKTtcbiAgICAgICAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IgJiYgIShlcnJvci5tZXNzYWdlIGluIGxvZ2dlZFR5cGVGYWlsdXJlcykpIHtcbiAgICAgICAgICAvLyBPbmx5IG1vbml0b3IgdGhpcyBmYWlsdXJlIG9uY2UgYmVjYXVzZSB0aGVyZSB0ZW5kcyB0byBiZSBhIGxvdCBvZiB0aGVcbiAgICAgICAgICAvLyBzYW1lIGVycm9yLlxuICAgICAgICAgIGxvZ2dlZFR5cGVGYWlsdXJlc1tlcnJvci5tZXNzYWdlXSA9IHRydWU7XG5cbiAgICAgICAgICB2YXIgc3RhY2sgPSBnZXRTdGFjayA/IGdldFN0YWNrKCkgOiAnJztcblxuICAgICAgICAgIHdhcm5pbmcoZmFsc2UsICdGYWlsZWQgJXMgdHlwZTogJXMlcycsIGxvY2F0aW9uLCBlcnJvci5tZXNzYWdlLCBzdGFjayAhPSBudWxsID8gc3RhY2sgOiAnJyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjaGVja1Byb3BUeXBlcztcbiIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTMtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxuLy8gUmVhY3QgMTUuNSByZWZlcmVuY2VzIHRoaXMgbW9kdWxlLCBhbmQgYXNzdW1lcyBQcm9wVHlwZXMgYXJlIHN0aWxsIGNhbGxhYmxlIGluIHByb2R1Y3Rpb24uXG4vLyBUaGVyZWZvcmUgd2UgcmUtZXhwb3J0IGRldmVsb3BtZW50LW9ubHkgdmVyc2lvbiB3aXRoIGFsbCB0aGUgUHJvcFR5cGVzIGNoZWNrcyBoZXJlLlxuLy8gSG93ZXZlciBpZiBvbmUgaXMgbWlncmF0aW5nIHRvIHRoZSBgcHJvcC10eXBlc2AgbnBtIGxpYnJhcnksIHRoZXkgd2lsbCBnbyB0aHJvdWdoIHRoZVxuLy8gYGluZGV4LmpzYCBlbnRyeSBwb2ludCwgYW5kIGl0IHdpbGwgYnJhbmNoIGRlcGVuZGluZyBvbiB0aGUgZW52aXJvbm1lbnQuXG52YXIgZmFjdG9yeSA9IHJlcXVpcmUoJy4vZmFjdG9yeVdpdGhUeXBlQ2hlY2tlcnMnKTtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oaXNWYWxpZEVsZW1lbnQpIHtcbiAgLy8gSXQgaXMgc3RpbGwgYWxsb3dlZCBpbiAxNS41LlxuICB2YXIgdGhyb3dPbkRpcmVjdEFjY2VzcyA9IGZhbHNlO1xuICByZXR1cm4gZmFjdG9yeShpc1ZhbGlkRWxlbWVudCwgdGhyb3dPbkRpcmVjdEFjY2Vzcyk7XG59O1xuIiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxMy1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgZW1wdHlGdW5jdGlvbiA9IHJlcXVpcmUoJ2ZianMvbGliL2VtcHR5RnVuY3Rpb24nKTtcbnZhciBpbnZhcmlhbnQgPSByZXF1aXJlKCdmYmpzL2xpYi9pbnZhcmlhbnQnKTtcbnZhciB3YXJuaW5nID0gcmVxdWlyZSgnZmJqcy9saWIvd2FybmluZycpO1xuXG52YXIgUmVhY3RQcm9wVHlwZXNTZWNyZXQgPSByZXF1aXJlKCcuL2xpYi9SZWFjdFByb3BUeXBlc1NlY3JldCcpO1xudmFyIGNoZWNrUHJvcFR5cGVzID0gcmVxdWlyZSgnLi9jaGVja1Byb3BUeXBlcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGlzVmFsaWRFbGVtZW50LCB0aHJvd09uRGlyZWN0QWNjZXNzKSB7XG4gIC8qIGdsb2JhbCBTeW1ib2wgKi9cbiAgdmFyIElURVJBVE9SX1NZTUJPTCA9IHR5cGVvZiBTeW1ib2wgPT09ICdmdW5jdGlvbicgJiYgU3ltYm9sLml0ZXJhdG9yO1xuICB2YXIgRkFVWF9JVEVSQVRPUl9TWU1CT0wgPSAnQEBpdGVyYXRvcic7IC8vIEJlZm9yZSBTeW1ib2wgc3BlYy5cblxuICAvKipcbiAgICogUmV0dXJucyB0aGUgaXRlcmF0b3IgbWV0aG9kIGZ1bmN0aW9uIGNvbnRhaW5lZCBvbiB0aGUgaXRlcmFibGUgb2JqZWN0LlxuICAgKlxuICAgKiBCZSBzdXJlIHRvIGludm9rZSB0aGUgZnVuY3Rpb24gd2l0aCB0aGUgaXRlcmFibGUgYXMgY29udGV4dDpcbiAgICpcbiAgICogICAgIHZhciBpdGVyYXRvckZuID0gZ2V0SXRlcmF0b3JGbihteUl0ZXJhYmxlKTtcbiAgICogICAgIGlmIChpdGVyYXRvckZuKSB7XG4gICAqICAgICAgIHZhciBpdGVyYXRvciA9IGl0ZXJhdG9yRm4uY2FsbChteUl0ZXJhYmxlKTtcbiAgICogICAgICAgLi4uXG4gICAqICAgICB9XG4gICAqXG4gICAqIEBwYXJhbSB7P29iamVjdH0gbWF5YmVJdGVyYWJsZVxuICAgKiBAcmV0dXJuIHs/ZnVuY3Rpb259XG4gICAqL1xuICBmdW5jdGlvbiBnZXRJdGVyYXRvckZuKG1heWJlSXRlcmFibGUpIHtcbiAgICB2YXIgaXRlcmF0b3JGbiA9IG1heWJlSXRlcmFibGUgJiYgKElURVJBVE9SX1NZTUJPTCAmJiBtYXliZUl0ZXJhYmxlW0lURVJBVE9SX1NZTUJPTF0gfHwgbWF5YmVJdGVyYWJsZVtGQVVYX0lURVJBVE9SX1NZTUJPTF0pO1xuICAgIGlmICh0eXBlb2YgaXRlcmF0b3JGbiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcmV0dXJuIGl0ZXJhdG9yRm47XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENvbGxlY3Rpb24gb2YgbWV0aG9kcyB0aGF0IGFsbG93IGRlY2xhcmF0aW9uIGFuZCB2YWxpZGF0aW9uIG9mIHByb3BzIHRoYXQgYXJlXG4gICAqIHN1cHBsaWVkIHRvIFJlYWN0IGNvbXBvbmVudHMuIEV4YW1wbGUgdXNhZ2U6XG4gICAqXG4gICAqICAgdmFyIFByb3BzID0gcmVxdWlyZSgnUmVhY3RQcm9wVHlwZXMnKTtcbiAgICogICB2YXIgTXlBcnRpY2xlID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuICAgKiAgICAgcHJvcFR5cGVzOiB7XG4gICAqICAgICAgIC8vIEFuIG9wdGlvbmFsIHN0cmluZyBwcm9wIG5hbWVkIFwiZGVzY3JpcHRpb25cIi5cbiAgICogICAgICAgZGVzY3JpcHRpb246IFByb3BzLnN0cmluZyxcbiAgICpcbiAgICogICAgICAgLy8gQSByZXF1aXJlZCBlbnVtIHByb3AgbmFtZWQgXCJjYXRlZ29yeVwiLlxuICAgKiAgICAgICBjYXRlZ29yeTogUHJvcHMub25lT2YoWydOZXdzJywnUGhvdG9zJ10pLmlzUmVxdWlyZWQsXG4gICAqXG4gICAqICAgICAgIC8vIEEgcHJvcCBuYW1lZCBcImRpYWxvZ1wiIHRoYXQgcmVxdWlyZXMgYW4gaW5zdGFuY2Ugb2YgRGlhbG9nLlxuICAgKiAgICAgICBkaWFsb2c6IFByb3BzLmluc3RhbmNlT2YoRGlhbG9nKS5pc1JlcXVpcmVkXG4gICAqICAgICB9LFxuICAgKiAgICAgcmVuZGVyOiBmdW5jdGlvbigpIHsgLi4uIH1cbiAgICogICB9KTtcbiAgICpcbiAgICogQSBtb3JlIGZvcm1hbCBzcGVjaWZpY2F0aW9uIG9mIGhvdyB0aGVzZSBtZXRob2RzIGFyZSB1c2VkOlxuICAgKlxuICAgKiAgIHR5cGUgOj0gYXJyYXl8Ym9vbHxmdW5jfG9iamVjdHxudW1iZXJ8c3RyaW5nfG9uZU9mKFsuLi5dKXxpbnN0YW5jZU9mKC4uLilcbiAgICogICBkZWNsIDo9IFJlYWN0UHJvcFR5cGVzLnt0eXBlfSguaXNSZXF1aXJlZCk/XG4gICAqXG4gICAqIEVhY2ggYW5kIGV2ZXJ5IGRlY2xhcmF0aW9uIHByb2R1Y2VzIGEgZnVuY3Rpb24gd2l0aCB0aGUgc2FtZSBzaWduYXR1cmUuIFRoaXNcbiAgICogYWxsb3dzIHRoZSBjcmVhdGlvbiBvZiBjdXN0b20gdmFsaWRhdGlvbiBmdW5jdGlvbnMuIEZvciBleGFtcGxlOlxuICAgKlxuICAgKiAgdmFyIE15TGluayA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcbiAgICogICAgcHJvcFR5cGVzOiB7XG4gICAqICAgICAgLy8gQW4gb3B0aW9uYWwgc3RyaW5nIG9yIFVSSSBwcm9wIG5hbWVkIFwiaHJlZlwiLlxuICAgKiAgICAgIGhyZWY6IGZ1bmN0aW9uKHByb3BzLCBwcm9wTmFtZSwgY29tcG9uZW50TmFtZSkge1xuICAgKiAgICAgICAgdmFyIHByb3BWYWx1ZSA9IHByb3BzW3Byb3BOYW1lXTtcbiAgICogICAgICAgIGlmIChwcm9wVmFsdWUgIT0gbnVsbCAmJiB0eXBlb2YgcHJvcFZhbHVlICE9PSAnc3RyaW5nJyAmJlxuICAgKiAgICAgICAgICAgICEocHJvcFZhbHVlIGluc3RhbmNlb2YgVVJJKSkge1xuICAgKiAgICAgICAgICByZXR1cm4gbmV3IEVycm9yKFxuICAgKiAgICAgICAgICAgICdFeHBlY3RlZCBhIHN0cmluZyBvciBhbiBVUkkgZm9yICcgKyBwcm9wTmFtZSArICcgaW4gJyArXG4gICAqICAgICAgICAgICAgY29tcG9uZW50TmFtZVxuICAgKiAgICAgICAgICApO1xuICAgKiAgICAgICAgfVxuICAgKiAgICAgIH1cbiAgICogICAgfSxcbiAgICogICAgcmVuZGVyOiBmdW5jdGlvbigpIHsuLi59XG4gICAqICB9KTtcbiAgICpcbiAgICogQGludGVybmFsXG4gICAqL1xuXG4gIHZhciBBTk9OWU1PVVMgPSAnPDxhbm9ueW1vdXM+Pic7XG5cbiAgLy8gSW1wb3J0YW50IVxuICAvLyBLZWVwIHRoaXMgbGlzdCBpbiBzeW5jIHdpdGggcHJvZHVjdGlvbiB2ZXJzaW9uIGluIGAuL2ZhY3RvcnlXaXRoVGhyb3dpbmdTaGltcy5qc2AuXG4gIHZhciBSZWFjdFByb3BUeXBlcyA9IHtcbiAgICBhcnJheTogY3JlYXRlUHJpbWl0aXZlVHlwZUNoZWNrZXIoJ2FycmF5JyksXG4gICAgYm9vbDogY3JlYXRlUHJpbWl0aXZlVHlwZUNoZWNrZXIoJ2Jvb2xlYW4nKSxcbiAgICBmdW5jOiBjcmVhdGVQcmltaXRpdmVUeXBlQ2hlY2tlcignZnVuY3Rpb24nKSxcbiAgICBudW1iZXI6IGNyZWF0ZVByaW1pdGl2ZVR5cGVDaGVja2VyKCdudW1iZXInKSxcbiAgICBvYmplY3Q6IGNyZWF0ZVByaW1pdGl2ZVR5cGVDaGVja2VyKCdvYmplY3QnKSxcbiAgICBzdHJpbmc6IGNyZWF0ZVByaW1pdGl2ZVR5cGVDaGVja2VyKCdzdHJpbmcnKSxcbiAgICBzeW1ib2w6IGNyZWF0ZVByaW1pdGl2ZVR5cGVDaGVja2VyKCdzeW1ib2wnKSxcblxuICAgIGFueTogY3JlYXRlQW55VHlwZUNoZWNrZXIoKSxcbiAgICBhcnJheU9mOiBjcmVhdGVBcnJheU9mVHlwZUNoZWNrZXIsXG4gICAgZWxlbWVudDogY3JlYXRlRWxlbWVudFR5cGVDaGVja2VyKCksXG4gICAgaW5zdGFuY2VPZjogY3JlYXRlSW5zdGFuY2VUeXBlQ2hlY2tlcixcbiAgICBub2RlOiBjcmVhdGVOb2RlQ2hlY2tlcigpLFxuICAgIG9iamVjdE9mOiBjcmVhdGVPYmplY3RPZlR5cGVDaGVja2VyLFxuICAgIG9uZU9mOiBjcmVhdGVFbnVtVHlwZUNoZWNrZXIsXG4gICAgb25lT2ZUeXBlOiBjcmVhdGVVbmlvblR5cGVDaGVja2VyLFxuICAgIHNoYXBlOiBjcmVhdGVTaGFwZVR5cGVDaGVja2VyXG4gIH07XG5cbiAgLyoqXG4gICAqIGlubGluZWQgT2JqZWN0LmlzIHBvbHlmaWxsIHRvIGF2b2lkIHJlcXVpcmluZyBjb25zdW1lcnMgc2hpcCB0aGVpciBvd25cbiAgICogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvT2JqZWN0L2lzXG4gICAqL1xuICAvKmVzbGludC1kaXNhYmxlIG5vLXNlbGYtY29tcGFyZSovXG4gIGZ1bmN0aW9uIGlzKHgsIHkpIHtcbiAgICAvLyBTYW1lVmFsdWUgYWxnb3JpdGhtXG4gICAgaWYgKHggPT09IHkpIHtcbiAgICAgIC8vIFN0ZXBzIDEtNSwgNy0xMFxuICAgICAgLy8gU3RlcHMgNi5iLTYuZTogKzAgIT0gLTBcbiAgICAgIHJldHVybiB4ICE9PSAwIHx8IDEgLyB4ID09PSAxIC8geTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gU3RlcCA2LmE6IE5hTiA9PSBOYU5cbiAgICAgIHJldHVybiB4ICE9PSB4ICYmIHkgIT09IHk7XG4gICAgfVxuICB9XG4gIC8qZXNsaW50LWVuYWJsZSBuby1zZWxmLWNvbXBhcmUqL1xuXG4gIC8qKlxuICAgKiBXZSB1c2UgYW4gRXJyb3ItbGlrZSBvYmplY3QgZm9yIGJhY2t3YXJkIGNvbXBhdGliaWxpdHkgYXMgcGVvcGxlIG1heSBjYWxsXG4gICAqIFByb3BUeXBlcyBkaXJlY3RseSBhbmQgaW5zcGVjdCB0aGVpciBvdXRwdXQuIEhvd2V2ZXIsIHdlIGRvbid0IHVzZSByZWFsXG4gICAqIEVycm9ycyBhbnltb3JlLiBXZSBkb24ndCBpbnNwZWN0IHRoZWlyIHN0YWNrIGFueXdheSwgYW5kIGNyZWF0aW5nIHRoZW1cbiAgICogaXMgcHJvaGliaXRpdmVseSBleHBlbnNpdmUgaWYgdGhleSBhcmUgY3JlYXRlZCB0b28gb2Z0ZW4sIHN1Y2ggYXMgd2hhdFxuICAgKiBoYXBwZW5zIGluIG9uZU9mVHlwZSgpIGZvciBhbnkgdHlwZSBiZWZvcmUgdGhlIG9uZSB0aGF0IG1hdGNoZWQuXG4gICAqL1xuICBmdW5jdGlvbiBQcm9wVHlwZUVycm9yKG1lc3NhZ2UpIHtcbiAgICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xuICAgIHRoaXMuc3RhY2sgPSAnJztcbiAgfVxuICAvLyBNYWtlIGBpbnN0YW5jZW9mIEVycm9yYCBzdGlsbCB3b3JrIGZvciByZXR1cm5lZCBlcnJvcnMuXG4gIFByb3BUeXBlRXJyb3IucHJvdG90eXBlID0gRXJyb3IucHJvdG90eXBlO1xuXG4gIGZ1bmN0aW9uIGNyZWF0ZUNoYWluYWJsZVR5cGVDaGVja2VyKHZhbGlkYXRlKSB7XG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgIHZhciBtYW51YWxQcm9wVHlwZUNhbGxDYWNoZSA9IHt9O1xuICAgICAgdmFyIG1hbnVhbFByb3BUeXBlV2FybmluZ0NvdW50ID0gMDtcbiAgICB9XG4gICAgZnVuY3Rpb24gY2hlY2tUeXBlKGlzUmVxdWlyZWQsIHByb3BzLCBwcm9wTmFtZSwgY29tcG9uZW50TmFtZSwgbG9jYXRpb24sIHByb3BGdWxsTmFtZSwgc2VjcmV0KSB7XG4gICAgICBjb21wb25lbnROYW1lID0gY29tcG9uZW50TmFtZSB8fCBBTk9OWU1PVVM7XG4gICAgICBwcm9wRnVsbE5hbWUgPSBwcm9wRnVsbE5hbWUgfHwgcHJvcE5hbWU7XG5cbiAgICAgIGlmIChzZWNyZXQgIT09IFJlYWN0UHJvcFR5cGVzU2VjcmV0KSB7XG4gICAgICAgIGlmICh0aHJvd09uRGlyZWN0QWNjZXNzKSB7XG4gICAgICAgICAgLy8gTmV3IGJlaGF2aW9yIG9ubHkgZm9yIHVzZXJzIG9mIGBwcm9wLXR5cGVzYCBwYWNrYWdlXG4gICAgICAgICAgaW52YXJpYW50KFxuICAgICAgICAgICAgZmFsc2UsXG4gICAgICAgICAgICAnQ2FsbGluZyBQcm9wVHlwZXMgdmFsaWRhdG9ycyBkaXJlY3RseSBpcyBub3Qgc3VwcG9ydGVkIGJ5IHRoZSBgcHJvcC10eXBlc2AgcGFja2FnZS4gJyArXG4gICAgICAgICAgICAnVXNlIGBQcm9wVHlwZXMuY2hlY2tQcm9wVHlwZXMoKWAgdG8gY2FsbCB0aGVtLiAnICtcbiAgICAgICAgICAgICdSZWFkIG1vcmUgYXQgaHR0cDovL2ZiLm1lL3VzZS1jaGVjay1wcm9wLXR5cGVzJ1xuICAgICAgICAgICk7XG4gICAgICAgIH0gZWxzZSBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiB0eXBlb2YgY29uc29sZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAvLyBPbGQgYmVoYXZpb3IgZm9yIHBlb3BsZSB1c2luZyBSZWFjdC5Qcm9wVHlwZXNcbiAgICAgICAgICB2YXIgY2FjaGVLZXkgPSBjb21wb25lbnROYW1lICsgJzonICsgcHJvcE5hbWU7XG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgIW1hbnVhbFByb3BUeXBlQ2FsbENhY2hlW2NhY2hlS2V5XSAmJlxuICAgICAgICAgICAgLy8gQXZvaWQgc3BhbW1pbmcgdGhlIGNvbnNvbGUgYmVjYXVzZSB0aGV5IGFyZSBvZnRlbiBub3QgYWN0aW9uYWJsZSBleGNlcHQgZm9yIGxpYiBhdXRob3JzXG4gICAgICAgICAgICBtYW51YWxQcm9wVHlwZVdhcm5pbmdDb3VudCA8IDNcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIHdhcm5pbmcoXG4gICAgICAgICAgICAgIGZhbHNlLFxuICAgICAgICAgICAgICAnWW91IGFyZSBtYW51YWxseSBjYWxsaW5nIGEgUmVhY3QuUHJvcFR5cGVzIHZhbGlkYXRpb24gJyArXG4gICAgICAgICAgICAgICdmdW5jdGlvbiBmb3IgdGhlIGAlc2AgcHJvcCBvbiBgJXNgLiBUaGlzIGlzIGRlcHJlY2F0ZWQgJyArXG4gICAgICAgICAgICAgICdhbmQgd2lsbCB0aHJvdyBpbiB0aGUgc3RhbmRhbG9uZSBgcHJvcC10eXBlc2AgcGFja2FnZS4gJyArXG4gICAgICAgICAgICAgICdZb3UgbWF5IGJlIHNlZWluZyB0aGlzIHdhcm5pbmcgZHVlIHRvIGEgdGhpcmQtcGFydHkgUHJvcFR5cGVzICcgK1xuICAgICAgICAgICAgICAnbGlicmFyeS4gU2VlIGh0dHBzOi8vZmIubWUvcmVhY3Qtd2FybmluZy1kb250LWNhbGwtcHJvcHR5cGVzICcgKyAnZm9yIGRldGFpbHMuJyxcbiAgICAgICAgICAgICAgcHJvcEZ1bGxOYW1lLFxuICAgICAgICAgICAgICBjb21wb25lbnROYW1lXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgbWFudWFsUHJvcFR5cGVDYWxsQ2FjaGVbY2FjaGVLZXldID0gdHJ1ZTtcbiAgICAgICAgICAgIG1hbnVhbFByb3BUeXBlV2FybmluZ0NvdW50Kys7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAocHJvcHNbcHJvcE5hbWVdID09IG51bGwpIHtcbiAgICAgICAgaWYgKGlzUmVxdWlyZWQpIHtcbiAgICAgICAgICBpZiAocHJvcHNbcHJvcE5hbWVdID09PSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFByb3BUeXBlRXJyb3IoJ1RoZSAnICsgbG9jYXRpb24gKyAnIGAnICsgcHJvcEZ1bGxOYW1lICsgJ2AgaXMgbWFya2VkIGFzIHJlcXVpcmVkICcgKyAoJ2luIGAnICsgY29tcG9uZW50TmFtZSArICdgLCBidXQgaXRzIHZhbHVlIGlzIGBudWxsYC4nKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBuZXcgUHJvcFR5cGVFcnJvcignVGhlICcgKyBsb2NhdGlvbiArICcgYCcgKyBwcm9wRnVsbE5hbWUgKyAnYCBpcyBtYXJrZWQgYXMgcmVxdWlyZWQgaW4gJyArICgnYCcgKyBjb21wb25lbnROYW1lICsgJ2AsIGJ1dCBpdHMgdmFsdWUgaXMgYHVuZGVmaW5lZGAuJykpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHZhbGlkYXRlKHByb3BzLCBwcm9wTmFtZSwgY29tcG9uZW50TmFtZSwgbG9jYXRpb24sIHByb3BGdWxsTmFtZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGNoYWluZWRDaGVja1R5cGUgPSBjaGVja1R5cGUuYmluZChudWxsLCBmYWxzZSk7XG4gICAgY2hhaW5lZENoZWNrVHlwZS5pc1JlcXVpcmVkID0gY2hlY2tUeXBlLmJpbmQobnVsbCwgdHJ1ZSk7XG5cbiAgICByZXR1cm4gY2hhaW5lZENoZWNrVHlwZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZVByaW1pdGl2ZVR5cGVDaGVja2VyKGV4cGVjdGVkVHlwZSkge1xuICAgIGZ1bmN0aW9uIHZhbGlkYXRlKHByb3BzLCBwcm9wTmFtZSwgY29tcG9uZW50TmFtZSwgbG9jYXRpb24sIHByb3BGdWxsTmFtZSwgc2VjcmV0KSB7XG4gICAgICB2YXIgcHJvcFZhbHVlID0gcHJvcHNbcHJvcE5hbWVdO1xuICAgICAgdmFyIHByb3BUeXBlID0gZ2V0UHJvcFR5cGUocHJvcFZhbHVlKTtcbiAgICAgIGlmIChwcm9wVHlwZSAhPT0gZXhwZWN0ZWRUeXBlKSB7XG4gICAgICAgIC8vIGBwcm9wVmFsdWVgIGJlaW5nIGluc3RhbmNlIG9mLCBzYXksIGRhdGUvcmVnZXhwLCBwYXNzIHRoZSAnb2JqZWN0J1xuICAgICAgICAvLyBjaGVjaywgYnV0IHdlIGNhbiBvZmZlciBhIG1vcmUgcHJlY2lzZSBlcnJvciBtZXNzYWdlIGhlcmUgcmF0aGVyIHRoYW5cbiAgICAgICAgLy8gJ29mIHR5cGUgYG9iamVjdGAnLlxuICAgICAgICB2YXIgcHJlY2lzZVR5cGUgPSBnZXRQcmVjaXNlVHlwZShwcm9wVmFsdWUpO1xuXG4gICAgICAgIHJldHVybiBuZXcgUHJvcFR5cGVFcnJvcignSW52YWxpZCAnICsgbG9jYXRpb24gKyAnIGAnICsgcHJvcEZ1bGxOYW1lICsgJ2Agb2YgdHlwZSAnICsgKCdgJyArIHByZWNpc2VUeXBlICsgJ2Agc3VwcGxpZWQgdG8gYCcgKyBjb21wb25lbnROYW1lICsgJ2AsIGV4cGVjdGVkICcpICsgKCdgJyArIGV4cGVjdGVkVHlwZSArICdgLicpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICByZXR1cm4gY3JlYXRlQ2hhaW5hYmxlVHlwZUNoZWNrZXIodmFsaWRhdGUpO1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlQW55VHlwZUNoZWNrZXIoKSB7XG4gICAgcmV0dXJuIGNyZWF0ZUNoYWluYWJsZVR5cGVDaGVja2VyKGVtcHR5RnVuY3Rpb24udGhhdFJldHVybnNOdWxsKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZUFycmF5T2ZUeXBlQ2hlY2tlcih0eXBlQ2hlY2tlcikge1xuICAgIGZ1bmN0aW9uIHZhbGlkYXRlKHByb3BzLCBwcm9wTmFtZSwgY29tcG9uZW50TmFtZSwgbG9jYXRpb24sIHByb3BGdWxsTmFtZSkge1xuICAgICAgaWYgKHR5cGVvZiB0eXBlQ2hlY2tlciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICByZXR1cm4gbmV3IFByb3BUeXBlRXJyb3IoJ1Byb3BlcnR5IGAnICsgcHJvcEZ1bGxOYW1lICsgJ2Agb2YgY29tcG9uZW50IGAnICsgY29tcG9uZW50TmFtZSArICdgIGhhcyBpbnZhbGlkIFByb3BUeXBlIG5vdGF0aW9uIGluc2lkZSBhcnJheU9mLicpO1xuICAgICAgfVxuICAgICAgdmFyIHByb3BWYWx1ZSA9IHByb3BzW3Byb3BOYW1lXTtcbiAgICAgIGlmICghQXJyYXkuaXNBcnJheShwcm9wVmFsdWUpKSB7XG4gICAgICAgIHZhciBwcm9wVHlwZSA9IGdldFByb3BUeXBlKHByb3BWYWx1ZSk7XG4gICAgICAgIHJldHVybiBuZXcgUHJvcFR5cGVFcnJvcignSW52YWxpZCAnICsgbG9jYXRpb24gKyAnIGAnICsgcHJvcEZ1bGxOYW1lICsgJ2Agb2YgdHlwZSAnICsgKCdgJyArIHByb3BUeXBlICsgJ2Agc3VwcGxpZWQgdG8gYCcgKyBjb21wb25lbnROYW1lICsgJ2AsIGV4cGVjdGVkIGFuIGFycmF5LicpKTtcbiAgICAgIH1cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcHJvcFZhbHVlLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBlcnJvciA9IHR5cGVDaGVja2VyKHByb3BWYWx1ZSwgaSwgY29tcG9uZW50TmFtZSwgbG9jYXRpb24sIHByb3BGdWxsTmFtZSArICdbJyArIGkgKyAnXScsIFJlYWN0UHJvcFR5cGVzU2VjcmV0KTtcbiAgICAgICAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgICByZXR1cm4gZXJyb3I7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICByZXR1cm4gY3JlYXRlQ2hhaW5hYmxlVHlwZUNoZWNrZXIodmFsaWRhdGUpO1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlRWxlbWVudFR5cGVDaGVja2VyKCkge1xuICAgIGZ1bmN0aW9uIHZhbGlkYXRlKHByb3BzLCBwcm9wTmFtZSwgY29tcG9uZW50TmFtZSwgbG9jYXRpb24sIHByb3BGdWxsTmFtZSkge1xuICAgICAgdmFyIHByb3BWYWx1ZSA9IHByb3BzW3Byb3BOYW1lXTtcbiAgICAgIGlmICghaXNWYWxpZEVsZW1lbnQocHJvcFZhbHVlKSkge1xuICAgICAgICB2YXIgcHJvcFR5cGUgPSBnZXRQcm9wVHlwZShwcm9wVmFsdWUpO1xuICAgICAgICByZXR1cm4gbmV3IFByb3BUeXBlRXJyb3IoJ0ludmFsaWQgJyArIGxvY2F0aW9uICsgJyBgJyArIHByb3BGdWxsTmFtZSArICdgIG9mIHR5cGUgJyArICgnYCcgKyBwcm9wVHlwZSArICdgIHN1cHBsaWVkIHRvIGAnICsgY29tcG9uZW50TmFtZSArICdgLCBleHBlY3RlZCBhIHNpbmdsZSBSZWFjdEVsZW1lbnQuJykpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHJldHVybiBjcmVhdGVDaGFpbmFibGVUeXBlQ2hlY2tlcih2YWxpZGF0ZSk7XG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGVJbnN0YW5jZVR5cGVDaGVja2VyKGV4cGVjdGVkQ2xhc3MpIHtcbiAgICBmdW5jdGlvbiB2YWxpZGF0ZShwcm9wcywgcHJvcE5hbWUsIGNvbXBvbmVudE5hbWUsIGxvY2F0aW9uLCBwcm9wRnVsbE5hbWUpIHtcbiAgICAgIGlmICghKHByb3BzW3Byb3BOYW1lXSBpbnN0YW5jZW9mIGV4cGVjdGVkQ2xhc3MpKSB7XG4gICAgICAgIHZhciBleHBlY3RlZENsYXNzTmFtZSA9IGV4cGVjdGVkQ2xhc3MubmFtZSB8fCBBTk9OWU1PVVM7XG4gICAgICAgIHZhciBhY3R1YWxDbGFzc05hbWUgPSBnZXRDbGFzc05hbWUocHJvcHNbcHJvcE5hbWVdKTtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9wVHlwZUVycm9yKCdJbnZhbGlkICcgKyBsb2NhdGlvbiArICcgYCcgKyBwcm9wRnVsbE5hbWUgKyAnYCBvZiB0eXBlICcgKyAoJ2AnICsgYWN0dWFsQ2xhc3NOYW1lICsgJ2Agc3VwcGxpZWQgdG8gYCcgKyBjb21wb25lbnROYW1lICsgJ2AsIGV4cGVjdGVkICcpICsgKCdpbnN0YW5jZSBvZiBgJyArIGV4cGVjdGVkQ2xhc3NOYW1lICsgJ2AuJykpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHJldHVybiBjcmVhdGVDaGFpbmFibGVUeXBlQ2hlY2tlcih2YWxpZGF0ZSk7XG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGVFbnVtVHlwZUNoZWNrZXIoZXhwZWN0ZWRWYWx1ZXMpIHtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoZXhwZWN0ZWRWYWx1ZXMpKSB7XG4gICAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nID8gd2FybmluZyhmYWxzZSwgJ0ludmFsaWQgYXJndW1lbnQgc3VwcGxpZWQgdG8gb25lT2YsIGV4cGVjdGVkIGFuIGluc3RhbmNlIG9mIGFycmF5LicpIDogdm9pZCAwO1xuICAgICAgcmV0dXJuIGVtcHR5RnVuY3Rpb24udGhhdFJldHVybnNOdWxsO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHZhbGlkYXRlKHByb3BzLCBwcm9wTmFtZSwgY29tcG9uZW50TmFtZSwgbG9jYXRpb24sIHByb3BGdWxsTmFtZSkge1xuICAgICAgdmFyIHByb3BWYWx1ZSA9IHByb3BzW3Byb3BOYW1lXTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZXhwZWN0ZWRWYWx1ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGlzKHByb3BWYWx1ZSwgZXhwZWN0ZWRWYWx1ZXNbaV0pKSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdmFyIHZhbHVlc1N0cmluZyA9IEpTT04uc3RyaW5naWZ5KGV4cGVjdGVkVmFsdWVzKTtcbiAgICAgIHJldHVybiBuZXcgUHJvcFR5cGVFcnJvcignSW52YWxpZCAnICsgbG9jYXRpb24gKyAnIGAnICsgcHJvcEZ1bGxOYW1lICsgJ2Agb2YgdmFsdWUgYCcgKyBwcm9wVmFsdWUgKyAnYCAnICsgKCdzdXBwbGllZCB0byBgJyArIGNvbXBvbmVudE5hbWUgKyAnYCwgZXhwZWN0ZWQgb25lIG9mICcgKyB2YWx1ZXNTdHJpbmcgKyAnLicpKTtcbiAgICB9XG4gICAgcmV0dXJuIGNyZWF0ZUNoYWluYWJsZVR5cGVDaGVja2VyKHZhbGlkYXRlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZU9iamVjdE9mVHlwZUNoZWNrZXIodHlwZUNoZWNrZXIpIHtcbiAgICBmdW5jdGlvbiB2YWxpZGF0ZShwcm9wcywgcHJvcE5hbWUsIGNvbXBvbmVudE5hbWUsIGxvY2F0aW9uLCBwcm9wRnVsbE5hbWUpIHtcbiAgICAgIGlmICh0eXBlb2YgdHlwZUNoZWNrZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9wVHlwZUVycm9yKCdQcm9wZXJ0eSBgJyArIHByb3BGdWxsTmFtZSArICdgIG9mIGNvbXBvbmVudCBgJyArIGNvbXBvbmVudE5hbWUgKyAnYCBoYXMgaW52YWxpZCBQcm9wVHlwZSBub3RhdGlvbiBpbnNpZGUgb2JqZWN0T2YuJyk7XG4gICAgICB9XG4gICAgICB2YXIgcHJvcFZhbHVlID0gcHJvcHNbcHJvcE5hbWVdO1xuICAgICAgdmFyIHByb3BUeXBlID0gZ2V0UHJvcFR5cGUocHJvcFZhbHVlKTtcbiAgICAgIGlmIChwcm9wVHlwZSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9wVHlwZUVycm9yKCdJbnZhbGlkICcgKyBsb2NhdGlvbiArICcgYCcgKyBwcm9wRnVsbE5hbWUgKyAnYCBvZiB0eXBlICcgKyAoJ2AnICsgcHJvcFR5cGUgKyAnYCBzdXBwbGllZCB0byBgJyArIGNvbXBvbmVudE5hbWUgKyAnYCwgZXhwZWN0ZWQgYW4gb2JqZWN0LicpKTtcbiAgICAgIH1cbiAgICAgIGZvciAodmFyIGtleSBpbiBwcm9wVmFsdWUpIHtcbiAgICAgICAgaWYgKHByb3BWYWx1ZS5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgdmFyIGVycm9yID0gdHlwZUNoZWNrZXIocHJvcFZhbHVlLCBrZXksIGNvbXBvbmVudE5hbWUsIGxvY2F0aW9uLCBwcm9wRnVsbE5hbWUgKyAnLicgKyBrZXksIFJlYWN0UHJvcFR5cGVzU2VjcmV0KTtcbiAgICAgICAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHJldHVybiBjcmVhdGVDaGFpbmFibGVUeXBlQ2hlY2tlcih2YWxpZGF0ZSk7XG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGVVbmlvblR5cGVDaGVja2VyKGFycmF5T2ZUeXBlQ2hlY2tlcnMpIHtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoYXJyYXlPZlR5cGVDaGVja2VycykpIHtcbiAgICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyB3YXJuaW5nKGZhbHNlLCAnSW52YWxpZCBhcmd1bWVudCBzdXBwbGllZCB0byBvbmVPZlR5cGUsIGV4cGVjdGVkIGFuIGluc3RhbmNlIG9mIGFycmF5LicpIDogdm9pZCAwO1xuICAgICAgcmV0dXJuIGVtcHR5RnVuY3Rpb24udGhhdFJldHVybnNOdWxsO1xuICAgIH1cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJyYXlPZlR5cGVDaGVja2Vycy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGNoZWNrZXIgPSBhcnJheU9mVHlwZUNoZWNrZXJzW2ldO1xuICAgICAgaWYgKHR5cGVvZiBjaGVja2VyICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHdhcm5pbmcoXG4gICAgICAgICAgZmFsc2UsXG4gICAgICAgICAgJ0ludmFsaWQgYXJndW1lbnQgc3VwcGxpZCB0byBvbmVPZlR5cGUuIEV4cGVjdGVkIGFuIGFycmF5IG9mIGNoZWNrIGZ1bmN0aW9ucywgYnV0ICcgK1xuICAgICAgICAgICdyZWNlaXZlZCAlcyBhdCBpbmRleCAlcy4nLFxuICAgICAgICAgIGdldFBvc3RmaXhGb3JUeXBlV2FybmluZyhjaGVja2VyKSxcbiAgICAgICAgICBpXG4gICAgICAgICk7XG4gICAgICAgIHJldHVybiBlbXB0eUZ1bmN0aW9uLnRoYXRSZXR1cm5zTnVsbDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiB2YWxpZGF0ZShwcm9wcywgcHJvcE5hbWUsIGNvbXBvbmVudE5hbWUsIGxvY2F0aW9uLCBwcm9wRnVsbE5hbWUpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJyYXlPZlR5cGVDaGVja2Vycy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgY2hlY2tlciA9IGFycmF5T2ZUeXBlQ2hlY2tlcnNbaV07XG4gICAgICAgIGlmIChjaGVja2VyKHByb3BzLCBwcm9wTmFtZSwgY29tcG9uZW50TmFtZSwgbG9jYXRpb24sIHByb3BGdWxsTmFtZSwgUmVhY3RQcm9wVHlwZXNTZWNyZXQpID09IG51bGwpIHtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gbmV3IFByb3BUeXBlRXJyb3IoJ0ludmFsaWQgJyArIGxvY2F0aW9uICsgJyBgJyArIHByb3BGdWxsTmFtZSArICdgIHN1cHBsaWVkIHRvICcgKyAoJ2AnICsgY29tcG9uZW50TmFtZSArICdgLicpKTtcbiAgICB9XG4gICAgcmV0dXJuIGNyZWF0ZUNoYWluYWJsZVR5cGVDaGVja2VyKHZhbGlkYXRlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZU5vZGVDaGVja2VyKCkge1xuICAgIGZ1bmN0aW9uIHZhbGlkYXRlKHByb3BzLCBwcm9wTmFtZSwgY29tcG9uZW50TmFtZSwgbG9jYXRpb24sIHByb3BGdWxsTmFtZSkge1xuICAgICAgaWYgKCFpc05vZGUocHJvcHNbcHJvcE5hbWVdKSkge1xuICAgICAgICByZXR1cm4gbmV3IFByb3BUeXBlRXJyb3IoJ0ludmFsaWQgJyArIGxvY2F0aW9uICsgJyBgJyArIHByb3BGdWxsTmFtZSArICdgIHN1cHBsaWVkIHRvICcgKyAoJ2AnICsgY29tcG9uZW50TmFtZSArICdgLCBleHBlY3RlZCBhIFJlYWN0Tm9kZS4nKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIGNyZWF0ZUNoYWluYWJsZVR5cGVDaGVja2VyKHZhbGlkYXRlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZVNoYXBlVHlwZUNoZWNrZXIoc2hhcGVUeXBlcykge1xuICAgIGZ1bmN0aW9uIHZhbGlkYXRlKHByb3BzLCBwcm9wTmFtZSwgY29tcG9uZW50TmFtZSwgbG9jYXRpb24sIHByb3BGdWxsTmFtZSkge1xuICAgICAgdmFyIHByb3BWYWx1ZSA9IHByb3BzW3Byb3BOYW1lXTtcbiAgICAgIHZhciBwcm9wVHlwZSA9IGdldFByb3BUeXBlKHByb3BWYWx1ZSk7XG4gICAgICBpZiAocHJvcFR5cGUgIT09ICdvYmplY3QnKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvcFR5cGVFcnJvcignSW52YWxpZCAnICsgbG9jYXRpb24gKyAnIGAnICsgcHJvcEZ1bGxOYW1lICsgJ2Agb2YgdHlwZSBgJyArIHByb3BUeXBlICsgJ2AgJyArICgnc3VwcGxpZWQgdG8gYCcgKyBjb21wb25lbnROYW1lICsgJ2AsIGV4cGVjdGVkIGBvYmplY3RgLicpKTtcbiAgICAgIH1cbiAgICAgIGZvciAodmFyIGtleSBpbiBzaGFwZVR5cGVzKSB7XG4gICAgICAgIHZhciBjaGVja2VyID0gc2hhcGVUeXBlc1trZXldO1xuICAgICAgICBpZiAoIWNoZWNrZXIpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgZXJyb3IgPSBjaGVja2VyKHByb3BWYWx1ZSwga2V5LCBjb21wb25lbnROYW1lLCBsb2NhdGlvbiwgcHJvcEZ1bGxOYW1lICsgJy4nICsga2V5LCBSZWFjdFByb3BUeXBlc1NlY3JldCk7XG4gICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgIHJldHVybiBlcnJvcjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHJldHVybiBjcmVhdGVDaGFpbmFibGVUeXBlQ2hlY2tlcih2YWxpZGF0ZSk7XG4gIH1cblxuICBmdW5jdGlvbiBpc05vZGUocHJvcFZhbHVlKSB7XG4gICAgc3dpdGNoICh0eXBlb2YgcHJvcFZhbHVlKSB7XG4gICAgICBjYXNlICdudW1iZXInOlxuICAgICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgIGNhc2UgJ3VuZGVmaW5lZCc6XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICAgIHJldHVybiAhcHJvcFZhbHVlO1xuICAgICAgY2FzZSAnb2JqZWN0JzpcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocHJvcFZhbHVlKSkge1xuICAgICAgICAgIHJldHVybiBwcm9wVmFsdWUuZXZlcnkoaXNOb2RlKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocHJvcFZhbHVlID09PSBudWxsIHx8IGlzVmFsaWRFbGVtZW50KHByb3BWYWx1ZSkpIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBpdGVyYXRvckZuID0gZ2V0SXRlcmF0b3JGbihwcm9wVmFsdWUpO1xuICAgICAgICBpZiAoaXRlcmF0b3JGbikge1xuICAgICAgICAgIHZhciBpdGVyYXRvciA9IGl0ZXJhdG9yRm4uY2FsbChwcm9wVmFsdWUpO1xuICAgICAgICAgIHZhciBzdGVwO1xuICAgICAgICAgIGlmIChpdGVyYXRvckZuICE9PSBwcm9wVmFsdWUuZW50cmllcykge1xuICAgICAgICAgICAgd2hpbGUgKCEoc3RlcCA9IGl0ZXJhdG9yLm5leHQoKSkuZG9uZSkge1xuICAgICAgICAgICAgICBpZiAoIWlzTm9kZShzdGVwLnZhbHVlKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBJdGVyYXRvciB3aWxsIHByb3ZpZGUgZW50cnkgW2ssdl0gdHVwbGVzIHJhdGhlciB0aGFuIHZhbHVlcy5cbiAgICAgICAgICAgIHdoaWxlICghKHN0ZXAgPSBpdGVyYXRvci5uZXh0KCkpLmRvbmUpIHtcbiAgICAgICAgICAgICAgdmFyIGVudHJ5ID0gc3RlcC52YWx1ZTtcbiAgICAgICAgICAgICAgaWYgKGVudHJ5KSB7XG4gICAgICAgICAgICAgICAgaWYgKCFpc05vZGUoZW50cnlbMV0pKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGlzU3ltYm9sKHByb3BUeXBlLCBwcm9wVmFsdWUpIHtcbiAgICAvLyBOYXRpdmUgU3ltYm9sLlxuICAgIGlmIChwcm9wVHlwZSA9PT0gJ3N5bWJvbCcpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8vIDE5LjQuMy41IFN5bWJvbC5wcm90b3R5cGVbQEB0b1N0cmluZ1RhZ10gPT09ICdTeW1ib2wnXG4gICAgaWYgKHByb3BWYWx1ZVsnQEB0b1N0cmluZ1RhZyddID09PSAnU3ltYm9sJykge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLy8gRmFsbGJhY2sgZm9yIG5vbi1zcGVjIGNvbXBsaWFudCBTeW1ib2xzIHdoaWNoIGFyZSBwb2x5ZmlsbGVkLlxuICAgIGlmICh0eXBlb2YgU3ltYm9sID09PSAnZnVuY3Rpb24nICYmIHByb3BWYWx1ZSBpbnN0YW5jZW9mIFN5bWJvbCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLy8gRXF1aXZhbGVudCBvZiBgdHlwZW9mYCBidXQgd2l0aCBzcGVjaWFsIGhhbmRsaW5nIGZvciBhcnJheSBhbmQgcmVnZXhwLlxuICBmdW5jdGlvbiBnZXRQcm9wVHlwZShwcm9wVmFsdWUpIHtcbiAgICB2YXIgcHJvcFR5cGUgPSB0eXBlb2YgcHJvcFZhbHVlO1xuICAgIGlmIChBcnJheS5pc0FycmF5KHByb3BWYWx1ZSkpIHtcbiAgICAgIHJldHVybiAnYXJyYXknO1xuICAgIH1cbiAgICBpZiAocHJvcFZhbHVlIGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICAvLyBPbGQgd2Via2l0cyAoYXQgbGVhc3QgdW50aWwgQW5kcm9pZCA0LjApIHJldHVybiAnZnVuY3Rpb24nIHJhdGhlciB0aGFuXG4gICAgICAvLyAnb2JqZWN0JyBmb3IgdHlwZW9mIGEgUmVnRXhwLiBXZSdsbCBub3JtYWxpemUgdGhpcyBoZXJlIHNvIHRoYXQgL2JsYS9cbiAgICAgIC8vIHBhc3NlcyBQcm9wVHlwZXMub2JqZWN0LlxuICAgICAgcmV0dXJuICdvYmplY3QnO1xuICAgIH1cbiAgICBpZiAoaXNTeW1ib2wocHJvcFR5cGUsIHByb3BWYWx1ZSkpIHtcbiAgICAgIHJldHVybiAnc3ltYm9sJztcbiAgICB9XG4gICAgcmV0dXJuIHByb3BUeXBlO1xuICB9XG5cbiAgLy8gVGhpcyBoYW5kbGVzIG1vcmUgdHlwZXMgdGhhbiBgZ2V0UHJvcFR5cGVgLiBPbmx5IHVzZWQgZm9yIGVycm9yIG1lc3NhZ2VzLlxuICAvLyBTZWUgYGNyZWF0ZVByaW1pdGl2ZVR5cGVDaGVja2VyYC5cbiAgZnVuY3Rpb24gZ2V0UHJlY2lzZVR5cGUocHJvcFZhbHVlKSB7XG4gICAgaWYgKHR5cGVvZiBwcm9wVmFsdWUgPT09ICd1bmRlZmluZWQnIHx8IHByb3BWYWx1ZSA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuICcnICsgcHJvcFZhbHVlO1xuICAgIH1cbiAgICB2YXIgcHJvcFR5cGUgPSBnZXRQcm9wVHlwZShwcm9wVmFsdWUpO1xuICAgIGlmIChwcm9wVHlwZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIGlmIChwcm9wVmFsdWUgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgICAgIHJldHVybiAnZGF0ZSc7XG4gICAgICB9IGVsc2UgaWYgKHByb3BWYWx1ZSBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgICByZXR1cm4gJ3JlZ2V4cCc7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBwcm9wVHlwZTtcbiAgfVxuXG4gIC8vIFJldHVybnMgYSBzdHJpbmcgdGhhdCBpcyBwb3N0Zml4ZWQgdG8gYSB3YXJuaW5nIGFib3V0IGFuIGludmFsaWQgdHlwZS5cbiAgLy8gRm9yIGV4YW1wbGUsIFwidW5kZWZpbmVkXCIgb3IgXCJvZiB0eXBlIGFycmF5XCJcbiAgZnVuY3Rpb24gZ2V0UG9zdGZpeEZvclR5cGVXYXJuaW5nKHZhbHVlKSB7XG4gICAgdmFyIHR5cGUgPSBnZXRQcmVjaXNlVHlwZSh2YWx1ZSk7XG4gICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICBjYXNlICdhcnJheSc6XG4gICAgICBjYXNlICdvYmplY3QnOlxuICAgICAgICByZXR1cm4gJ2FuICcgKyB0eXBlO1xuICAgICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICBjYXNlICdkYXRlJzpcbiAgICAgIGNhc2UgJ3JlZ2V4cCc6XG4gICAgICAgIHJldHVybiAnYSAnICsgdHlwZTtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiB0eXBlO1xuICAgIH1cbiAgfVxuXG4gIC8vIFJldHVybnMgY2xhc3MgbmFtZSBvZiB0aGUgb2JqZWN0LCBpZiBhbnkuXG4gIGZ1bmN0aW9uIGdldENsYXNzTmFtZShwcm9wVmFsdWUpIHtcbiAgICBpZiAoIXByb3BWYWx1ZS5jb25zdHJ1Y3RvciB8fCAhcHJvcFZhbHVlLmNvbnN0cnVjdG9yLm5hbWUpIHtcbiAgICAgIHJldHVybiBBTk9OWU1PVVM7XG4gICAgfVxuICAgIHJldHVybiBwcm9wVmFsdWUuY29uc3RydWN0b3IubmFtZTtcbiAgfVxuXG4gIFJlYWN0UHJvcFR5cGVzLmNoZWNrUHJvcFR5cGVzID0gY2hlY2tQcm9wVHlwZXM7XG4gIFJlYWN0UHJvcFR5cGVzLlByb3BUeXBlcyA9IFJlYWN0UHJvcFR5cGVzO1xuXG4gIHJldHVybiBSZWFjdFByb3BUeXBlcztcbn07XG4iLCIvKipcbiAqIENvcHlyaWdodCAyMDEzLXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBSZWFjdFByb3BUeXBlc1NlY3JldCA9ICdTRUNSRVRfRE9fTk9UX1BBU1NfVEhJU19PUl9ZT1VfV0lMTF9CRV9GSVJFRCc7XG5cbm1vZHVsZS5leHBvcnRzID0gUmVhY3RQcm9wVHlwZXNTZWNyZXQ7XG4iLCIvKipcbiAqIENvcHlyaWdodCAyMDEzLXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqXG4gKiBcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbi8qKlxuICogRXNjYXBlIGFuZCB3cmFwIGtleSBzbyBpdCBpcyBzYWZlIHRvIHVzZSBhcyBhIHJlYWN0aWRcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30ga2V5IHRvIGJlIGVzY2FwZWQuXG4gKiBAcmV0dXJuIHtzdHJpbmd9IHRoZSBlc2NhcGVkIGtleS5cbiAqL1xuXG5mdW5jdGlvbiBlc2NhcGUoa2V5KSB7XG4gIHZhciBlc2NhcGVSZWdleCA9IC9bPTpdL2c7XG4gIHZhciBlc2NhcGVyTG9va3VwID0ge1xuICAgICc9JzogJz0wJyxcbiAgICAnOic6ICc9MidcbiAgfTtcbiAgdmFyIGVzY2FwZWRTdHJpbmcgPSAoJycgKyBrZXkpLnJlcGxhY2UoZXNjYXBlUmVnZXgsIGZ1bmN0aW9uIChtYXRjaCkge1xuICAgIHJldHVybiBlc2NhcGVyTG9va3VwW21hdGNoXTtcbiAgfSk7XG5cbiAgcmV0dXJuICckJyArIGVzY2FwZWRTdHJpbmc7XG59XG5cbi8qKlxuICogVW5lc2NhcGUgYW5kIHVud3JhcCBrZXkgZm9yIGh1bWFuLXJlYWRhYmxlIGRpc3BsYXlcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30ga2V5IHRvIHVuZXNjYXBlLlxuICogQHJldHVybiB7c3RyaW5nfSB0aGUgdW5lc2NhcGVkIGtleS5cbiAqL1xuZnVuY3Rpb24gdW5lc2NhcGUoa2V5KSB7XG4gIHZhciB1bmVzY2FwZVJlZ2V4ID0gLyg9MHw9MikvZztcbiAgdmFyIHVuZXNjYXBlckxvb2t1cCA9IHtcbiAgICAnPTAnOiAnPScsXG4gICAgJz0yJzogJzonXG4gIH07XG4gIHZhciBrZXlTdWJzdHJpbmcgPSBrZXlbMF0gPT09ICcuJyAmJiBrZXlbMV0gPT09ICckJyA/IGtleS5zdWJzdHJpbmcoMikgOiBrZXkuc3Vic3RyaW5nKDEpO1xuXG4gIHJldHVybiAoJycgKyBrZXlTdWJzdHJpbmcpLnJlcGxhY2UodW5lc2NhcGVSZWdleCwgZnVuY3Rpb24gKG1hdGNoKSB7XG4gICAgcmV0dXJuIHVuZXNjYXBlckxvb2t1cFttYXRjaF07XG4gIH0pO1xufVxuXG52YXIgS2V5RXNjYXBlVXRpbHMgPSB7XG4gIGVzY2FwZTogZXNjYXBlLFxuICB1bmVzY2FwZTogdW5lc2NhcGVcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gS2V5RXNjYXBlVXRpbHM7IiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxMy1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICogXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgX3Byb2RJbnZhcmlhbnQgPSByZXF1aXJlKCcuL3JlYWN0UHJvZEludmFyaWFudCcpO1xuXG52YXIgaW52YXJpYW50ID0gcmVxdWlyZSgnZmJqcy9saWIvaW52YXJpYW50Jyk7XG5cbi8qKlxuICogU3RhdGljIHBvb2xlcnMuIFNldmVyYWwgY3VzdG9tIHZlcnNpb25zIGZvciBlYWNoIHBvdGVudGlhbCBudW1iZXIgb2ZcbiAqIGFyZ3VtZW50cy4gQSBjb21wbGV0ZWx5IGdlbmVyaWMgcG9vbGVyIGlzIGVhc3kgdG8gaW1wbGVtZW50LCBidXQgd291bGRcbiAqIHJlcXVpcmUgYWNjZXNzaW5nIHRoZSBgYXJndW1lbnRzYCBvYmplY3QuIEluIGVhY2ggb2YgdGhlc2UsIGB0aGlzYCByZWZlcnMgdG9cbiAqIHRoZSBDbGFzcyBpdHNlbGYsIG5vdCBhbiBpbnN0YW5jZS4gSWYgYW55IG90aGVycyBhcmUgbmVlZGVkLCBzaW1wbHkgYWRkIHRoZW1cbiAqIGhlcmUsIG9yIGluIHRoZWlyIG93biBmaWxlcy5cbiAqL1xudmFyIG9uZUFyZ3VtZW50UG9vbGVyID0gZnVuY3Rpb24gKGNvcHlGaWVsZHNGcm9tKSB7XG4gIHZhciBLbGFzcyA9IHRoaXM7XG4gIGlmIChLbGFzcy5pbnN0YW5jZVBvb2wubGVuZ3RoKSB7XG4gICAgdmFyIGluc3RhbmNlID0gS2xhc3MuaW5zdGFuY2VQb29sLnBvcCgpO1xuICAgIEtsYXNzLmNhbGwoaW5zdGFuY2UsIGNvcHlGaWVsZHNGcm9tKTtcbiAgICByZXR1cm4gaW5zdGFuY2U7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG5ldyBLbGFzcyhjb3B5RmllbGRzRnJvbSk7XG4gIH1cbn07XG5cbnZhciB0d29Bcmd1bWVudFBvb2xlciA9IGZ1bmN0aW9uIChhMSwgYTIpIHtcbiAgdmFyIEtsYXNzID0gdGhpcztcbiAgaWYgKEtsYXNzLmluc3RhbmNlUG9vbC5sZW5ndGgpIHtcbiAgICB2YXIgaW5zdGFuY2UgPSBLbGFzcy5pbnN0YW5jZVBvb2wucG9wKCk7XG4gICAgS2xhc3MuY2FsbChpbnN0YW5jZSwgYTEsIGEyKTtcbiAgICByZXR1cm4gaW5zdGFuY2U7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG5ldyBLbGFzcyhhMSwgYTIpO1xuICB9XG59O1xuXG52YXIgdGhyZWVBcmd1bWVudFBvb2xlciA9IGZ1bmN0aW9uIChhMSwgYTIsIGEzKSB7XG4gIHZhciBLbGFzcyA9IHRoaXM7XG4gIGlmIChLbGFzcy5pbnN0YW5jZVBvb2wubGVuZ3RoKSB7XG4gICAgdmFyIGluc3RhbmNlID0gS2xhc3MuaW5zdGFuY2VQb29sLnBvcCgpO1xuICAgIEtsYXNzLmNhbGwoaW5zdGFuY2UsIGExLCBhMiwgYTMpO1xuICAgIHJldHVybiBpbnN0YW5jZTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbmV3IEtsYXNzKGExLCBhMiwgYTMpO1xuICB9XG59O1xuXG52YXIgZm91ckFyZ3VtZW50UG9vbGVyID0gZnVuY3Rpb24gKGExLCBhMiwgYTMsIGE0KSB7XG4gIHZhciBLbGFzcyA9IHRoaXM7XG4gIGlmIChLbGFzcy5pbnN0YW5jZVBvb2wubGVuZ3RoKSB7XG4gICAgdmFyIGluc3RhbmNlID0gS2xhc3MuaW5zdGFuY2VQb29sLnBvcCgpO1xuICAgIEtsYXNzLmNhbGwoaW5zdGFuY2UsIGExLCBhMiwgYTMsIGE0KTtcbiAgICByZXR1cm4gaW5zdGFuY2U7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG5ldyBLbGFzcyhhMSwgYTIsIGEzLCBhNCk7XG4gIH1cbn07XG5cbnZhciBzdGFuZGFyZFJlbGVhc2VyID0gZnVuY3Rpb24gKGluc3RhbmNlKSB7XG4gIHZhciBLbGFzcyA9IHRoaXM7XG4gICEoaW5zdGFuY2UgaW5zdGFuY2VvZiBLbGFzcykgPyBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nID8gaW52YXJpYW50KGZhbHNlLCAnVHJ5aW5nIHRvIHJlbGVhc2UgYW4gaW5zdGFuY2UgaW50byBhIHBvb2wgb2YgYSBkaWZmZXJlbnQgdHlwZS4nKSA6IF9wcm9kSW52YXJpYW50KCcyNScpIDogdm9pZCAwO1xuICBpbnN0YW5jZS5kZXN0cnVjdG9yKCk7XG4gIGlmIChLbGFzcy5pbnN0YW5jZVBvb2wubGVuZ3RoIDwgS2xhc3MucG9vbFNpemUpIHtcbiAgICBLbGFzcy5pbnN0YW5jZVBvb2wucHVzaChpbnN0YW5jZSk7XG4gIH1cbn07XG5cbnZhciBERUZBVUxUX1BPT0xfU0laRSA9IDEwO1xudmFyIERFRkFVTFRfUE9PTEVSID0gb25lQXJndW1lbnRQb29sZXI7XG5cbi8qKlxuICogQXVnbWVudHMgYENvcHlDb25zdHJ1Y3RvcmAgdG8gYmUgYSBwb29sYWJsZSBjbGFzcywgYXVnbWVudGluZyBvbmx5IHRoZSBjbGFzc1xuICogaXRzZWxmIChzdGF0aWNhbGx5KSBub3QgYWRkaW5nIGFueSBwcm90b3R5cGljYWwgZmllbGRzLiBBbnkgQ29weUNvbnN0cnVjdG9yXG4gKiB5b3UgZ2l2ZSB0aGlzIG1heSBoYXZlIGEgYHBvb2xTaXplYCBwcm9wZXJ0eSwgYW5kIHdpbGwgbG9vayBmb3IgYVxuICogcHJvdG90eXBpY2FsIGBkZXN0cnVjdG9yYCBvbiBpbnN0YW5jZXMuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gQ29weUNvbnN0cnVjdG9yIENvbnN0cnVjdG9yIHRoYXQgY2FuIGJlIHVzZWQgdG8gcmVzZXQuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBwb29sZXIgQ3VzdG9taXphYmxlIHBvb2xlci5cbiAqL1xudmFyIGFkZFBvb2xpbmdUbyA9IGZ1bmN0aW9uIChDb3B5Q29uc3RydWN0b3IsIHBvb2xlcikge1xuICAvLyBDYXN0aW5nIGFzIGFueSBzbyB0aGF0IGZsb3cgaWdub3JlcyB0aGUgYWN0dWFsIGltcGxlbWVudGF0aW9uIGFuZCB0cnVzdHNcbiAgLy8gaXQgdG8gbWF0Y2ggdGhlIHR5cGUgd2UgZGVjbGFyZWRcbiAgdmFyIE5ld0tsYXNzID0gQ29weUNvbnN0cnVjdG9yO1xuICBOZXdLbGFzcy5pbnN0YW5jZVBvb2wgPSBbXTtcbiAgTmV3S2xhc3MuZ2V0UG9vbGVkID0gcG9vbGVyIHx8IERFRkFVTFRfUE9PTEVSO1xuICBpZiAoIU5ld0tsYXNzLnBvb2xTaXplKSB7XG4gICAgTmV3S2xhc3MucG9vbFNpemUgPSBERUZBVUxUX1BPT0xfU0laRTtcbiAgfVxuICBOZXdLbGFzcy5yZWxlYXNlID0gc3RhbmRhcmRSZWxlYXNlcjtcbiAgcmV0dXJuIE5ld0tsYXNzO1xufTtcblxudmFyIFBvb2xlZENsYXNzID0ge1xuICBhZGRQb29saW5nVG86IGFkZFBvb2xpbmdUbyxcbiAgb25lQXJndW1lbnRQb29sZXI6IG9uZUFyZ3VtZW50UG9vbGVyLFxuICB0d29Bcmd1bWVudFBvb2xlcjogdHdvQXJndW1lbnRQb29sZXIsXG4gIHRocmVlQXJndW1lbnRQb29sZXI6IHRocmVlQXJndW1lbnRQb29sZXIsXG4gIGZvdXJBcmd1bWVudFBvb2xlcjogZm91ckFyZ3VtZW50UG9vbGVyXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFBvb2xlZENsYXNzOyIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTMtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICpcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBfYXNzaWduID0gcmVxdWlyZSgnb2JqZWN0LWFzc2lnbicpO1xuXG52YXIgUmVhY3RCYXNlQ2xhc3NlcyA9IHJlcXVpcmUoJy4vUmVhY3RCYXNlQ2xhc3NlcycpO1xudmFyIFJlYWN0Q2hpbGRyZW4gPSByZXF1aXJlKCcuL1JlYWN0Q2hpbGRyZW4nKTtcbnZhciBSZWFjdERPTUZhY3RvcmllcyA9IHJlcXVpcmUoJy4vUmVhY3RET01GYWN0b3JpZXMnKTtcbnZhciBSZWFjdEVsZW1lbnQgPSByZXF1aXJlKCcuL1JlYWN0RWxlbWVudCcpO1xudmFyIFJlYWN0UHJvcFR5cGVzID0gcmVxdWlyZSgnLi9SZWFjdFByb3BUeXBlcycpO1xudmFyIFJlYWN0VmVyc2lvbiA9IHJlcXVpcmUoJy4vUmVhY3RWZXJzaW9uJyk7XG5cbnZhciBjcmVhdGVSZWFjdENsYXNzID0gcmVxdWlyZSgnLi9jcmVhdGVDbGFzcycpO1xudmFyIG9ubHlDaGlsZCA9IHJlcXVpcmUoJy4vb25seUNoaWxkJyk7XG5cbnZhciBjcmVhdGVFbGVtZW50ID0gUmVhY3RFbGVtZW50LmNyZWF0ZUVsZW1lbnQ7XG52YXIgY3JlYXRlRmFjdG9yeSA9IFJlYWN0RWxlbWVudC5jcmVhdGVGYWN0b3J5O1xudmFyIGNsb25lRWxlbWVudCA9IFJlYWN0RWxlbWVudC5jbG9uZUVsZW1lbnQ7XG5cbmlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gIHZhciBsb3dQcmlvcml0eVdhcm5pbmcgPSByZXF1aXJlKCcuL2xvd1ByaW9yaXR5V2FybmluZycpO1xuICB2YXIgY2FuRGVmaW5lUHJvcGVydHkgPSByZXF1aXJlKCcuL2NhbkRlZmluZVByb3BlcnR5Jyk7XG4gIHZhciBSZWFjdEVsZW1lbnRWYWxpZGF0b3IgPSByZXF1aXJlKCcuL1JlYWN0RWxlbWVudFZhbGlkYXRvcicpO1xuICB2YXIgZGlkV2FyblByb3BUeXBlc0RlcHJlY2F0ZWQgPSBmYWxzZTtcbiAgY3JlYXRlRWxlbWVudCA9IFJlYWN0RWxlbWVudFZhbGlkYXRvci5jcmVhdGVFbGVtZW50O1xuICBjcmVhdGVGYWN0b3J5ID0gUmVhY3RFbGVtZW50VmFsaWRhdG9yLmNyZWF0ZUZhY3Rvcnk7XG4gIGNsb25lRWxlbWVudCA9IFJlYWN0RWxlbWVudFZhbGlkYXRvci5jbG9uZUVsZW1lbnQ7XG59XG5cbnZhciBfX3NwcmVhZCA9IF9hc3NpZ247XG52YXIgY3JlYXRlTWl4aW4gPSBmdW5jdGlvbiAobWl4aW4pIHtcbiAgcmV0dXJuIG1peGluO1xufTtcblxuaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgdmFyIHdhcm5lZEZvclNwcmVhZCA9IGZhbHNlO1xuICB2YXIgd2FybmVkRm9yQ3JlYXRlTWl4aW4gPSBmYWxzZTtcbiAgX19zcHJlYWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgbG93UHJpb3JpdHlXYXJuaW5nKHdhcm5lZEZvclNwcmVhZCwgJ1JlYWN0Ll9fc3ByZWFkIGlzIGRlcHJlY2F0ZWQgYW5kIHNob3VsZCBub3QgYmUgdXNlZC4gVXNlICcgKyAnT2JqZWN0LmFzc2lnbiBkaXJlY3RseSBvciBhbm90aGVyIGhlbHBlciBmdW5jdGlvbiB3aXRoIHNpbWlsYXIgJyArICdzZW1hbnRpY3MuIFlvdSBtYXkgYmUgc2VlaW5nIHRoaXMgd2FybmluZyBkdWUgdG8geW91ciBjb21waWxlci4gJyArICdTZWUgaHR0cHM6Ly9mYi5tZS9yZWFjdC1zcHJlYWQtZGVwcmVjYXRpb24gZm9yIG1vcmUgZGV0YWlscy4nKTtcbiAgICB3YXJuZWRGb3JTcHJlYWQgPSB0cnVlO1xuICAgIHJldHVybiBfYXNzaWduLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XG4gIH07XG5cbiAgY3JlYXRlTWl4aW4gPSBmdW5jdGlvbiAobWl4aW4pIHtcbiAgICBsb3dQcmlvcml0eVdhcm5pbmcod2FybmVkRm9yQ3JlYXRlTWl4aW4sICdSZWFjdC5jcmVhdGVNaXhpbiBpcyBkZXByZWNhdGVkIGFuZCBzaG91bGQgbm90IGJlIHVzZWQuICcgKyAnSW4gUmVhY3QgdjE2LjAsIGl0IHdpbGwgYmUgcmVtb3ZlZC4gJyArICdZb3UgY2FuIHVzZSB0aGlzIG1peGluIGRpcmVjdGx5IGluc3RlYWQuICcgKyAnU2VlIGh0dHBzOi8vZmIubWUvY3JlYXRlbWl4aW4td2FzLW5ldmVyLWltcGxlbWVudGVkIGZvciBtb3JlIGluZm8uJyk7XG4gICAgd2FybmVkRm9yQ3JlYXRlTWl4aW4gPSB0cnVlO1xuICAgIHJldHVybiBtaXhpbjtcbiAgfTtcbn1cblxudmFyIFJlYWN0ID0ge1xuICAvLyBNb2Rlcm5cblxuICBDaGlsZHJlbjoge1xuICAgIG1hcDogUmVhY3RDaGlsZHJlbi5tYXAsXG4gICAgZm9yRWFjaDogUmVhY3RDaGlsZHJlbi5mb3JFYWNoLFxuICAgIGNvdW50OiBSZWFjdENoaWxkcmVuLmNvdW50LFxuICAgIHRvQXJyYXk6IFJlYWN0Q2hpbGRyZW4udG9BcnJheSxcbiAgICBvbmx5OiBvbmx5Q2hpbGRcbiAgfSxcblxuICBDb21wb25lbnQ6IFJlYWN0QmFzZUNsYXNzZXMuQ29tcG9uZW50LFxuICBQdXJlQ29tcG9uZW50OiBSZWFjdEJhc2VDbGFzc2VzLlB1cmVDb21wb25lbnQsXG5cbiAgY3JlYXRlRWxlbWVudDogY3JlYXRlRWxlbWVudCxcbiAgY2xvbmVFbGVtZW50OiBjbG9uZUVsZW1lbnQsXG4gIGlzVmFsaWRFbGVtZW50OiBSZWFjdEVsZW1lbnQuaXNWYWxpZEVsZW1lbnQsXG5cbiAgLy8gQ2xhc3NpY1xuXG4gIFByb3BUeXBlczogUmVhY3RQcm9wVHlwZXMsXG4gIGNyZWF0ZUNsYXNzOiBjcmVhdGVSZWFjdENsYXNzLFxuICBjcmVhdGVGYWN0b3J5OiBjcmVhdGVGYWN0b3J5LFxuICBjcmVhdGVNaXhpbjogY3JlYXRlTWl4aW4sXG5cbiAgLy8gVGhpcyBsb29rcyBET00gc3BlY2lmaWMgYnV0IHRoZXNlIGFyZSBhY3R1YWxseSBpc29tb3JwaGljIGhlbHBlcnNcbiAgLy8gc2luY2UgdGhleSBhcmUganVzdCBnZW5lcmF0aW5nIERPTSBzdHJpbmdzLlxuICBET006IFJlYWN0RE9NRmFjdG9yaWVzLFxuXG4gIHZlcnNpb246IFJlYWN0VmVyc2lvbixcblxuICAvLyBEZXByZWNhdGVkIGhvb2sgZm9yIEpTWCBzcHJlYWQsIGRvbid0IHVzZSB0aGlzIGZvciBhbnl0aGluZy5cbiAgX19zcHJlYWQ6IF9fc3ByZWFkXG59O1xuXG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICB2YXIgd2FybmVkRm9yQ3JlYXRlQ2xhc3MgPSBmYWxzZTtcbiAgaWYgKGNhbkRlZmluZVByb3BlcnR5KSB7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFJlYWN0LCAnUHJvcFR5cGVzJywge1xuICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGxvd1ByaW9yaXR5V2FybmluZyhkaWRXYXJuUHJvcFR5cGVzRGVwcmVjYXRlZCwgJ0FjY2Vzc2luZyBQcm9wVHlwZXMgdmlhIHRoZSBtYWluIFJlYWN0IHBhY2thZ2UgaXMgZGVwcmVjYXRlZCwnICsgJyBhbmQgd2lsbCBiZSByZW1vdmVkIGluICBSZWFjdCB2MTYuMC4nICsgJyBVc2UgdGhlIGxhdGVzdCBhdmFpbGFibGUgdjE1LiogcHJvcC10eXBlcyBwYWNrYWdlIGZyb20gbnBtIGluc3RlYWQuJyArICcgRm9yIGluZm8gb24gdXNhZ2UsIGNvbXBhdGliaWxpdHksIG1pZ3JhdGlvbiBhbmQgbW9yZSwgc2VlICcgKyAnaHR0cHM6Ly9mYi5tZS9wcm9wLXR5cGVzLWRvY3MnKTtcbiAgICAgICAgZGlkV2FyblByb3BUeXBlc0RlcHJlY2F0ZWQgPSB0cnVlO1xuICAgICAgICByZXR1cm4gUmVhY3RQcm9wVHlwZXM7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoUmVhY3QsICdjcmVhdGVDbGFzcycsIHtcbiAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBsb3dQcmlvcml0eVdhcm5pbmcod2FybmVkRm9yQ3JlYXRlQ2xhc3MsICdBY2Nlc3NpbmcgY3JlYXRlQ2xhc3MgdmlhIHRoZSBtYWluIFJlYWN0IHBhY2thZ2UgaXMgZGVwcmVjYXRlZCwnICsgJyBhbmQgd2lsbCBiZSByZW1vdmVkIGluIFJlYWN0IHYxNi4wLicgKyBcIiBVc2UgYSBwbGFpbiBKYXZhU2NyaXB0IGNsYXNzIGluc3RlYWQuIElmIHlvdSdyZSBub3QgeWV0IFwiICsgJ3JlYWR5IHRvIG1pZ3JhdGUsIGNyZWF0ZS1yZWFjdC1jbGFzcyB2MTUuKiBpcyBhdmFpbGFibGUgJyArICdvbiBucG0gYXMgYSB0ZW1wb3JhcnksIGRyb3AtaW4gcmVwbGFjZW1lbnQuICcgKyAnRm9yIG1vcmUgaW5mbyBzZWUgaHR0cHM6Ly9mYi5tZS9yZWFjdC1jcmVhdGUtY2xhc3MnKTtcbiAgICAgICAgd2FybmVkRm9yQ3JlYXRlQ2xhc3MgPSB0cnVlO1xuICAgICAgICByZXR1cm4gY3JlYXRlUmVhY3RDbGFzcztcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8vIFJlYWN0LkRPTSBmYWN0b3JpZXMgYXJlIGRlcHJlY2F0ZWQuIFdyYXAgdGhlc2UgbWV0aG9kcyBzbyB0aGF0XG4gIC8vIGludm9jYXRpb25zIG9mIHRoZSBSZWFjdC5ET00gbmFtZXNwYWNlIGFuZCBhbGVydCB1c2VycyB0byBzd2l0Y2hcbiAgLy8gdG8gdGhlIGByZWFjdC1kb20tZmFjdG9yaWVzYCBwYWNrYWdlLlxuICBSZWFjdC5ET00gPSB7fTtcbiAgdmFyIHdhcm5lZEZvckZhY3RvcmllcyA9IGZhbHNlO1xuICBPYmplY3Qua2V5cyhSZWFjdERPTUZhY3RvcmllcykuZm9yRWFjaChmdW5jdGlvbiAoZmFjdG9yeSkge1xuICAgIFJlYWN0LkRPTVtmYWN0b3J5XSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmICghd2FybmVkRm9yRmFjdG9yaWVzKSB7XG4gICAgICAgIGxvd1ByaW9yaXR5V2FybmluZyhmYWxzZSwgJ0FjY2Vzc2luZyBmYWN0b3JpZXMgbGlrZSBSZWFjdC5ET00uJXMgaGFzIGJlZW4gZGVwcmVjYXRlZCAnICsgJ2FuZCB3aWxsIGJlIHJlbW92ZWQgaW4gdjE2LjArLiBVc2UgdGhlICcgKyAncmVhY3QtZG9tLWZhY3RvcmllcyBwYWNrYWdlIGluc3RlYWQuICcgKyAnIFZlcnNpb24gMS4wIHByb3ZpZGVzIGEgZHJvcC1pbiByZXBsYWNlbWVudC4nICsgJyBGb3IgbW9yZSBpbmZvLCBzZWUgaHR0cHM6Ly9mYi5tZS9yZWFjdC1kb20tZmFjdG9yaWVzJywgZmFjdG9yeSk7XG4gICAgICAgIHdhcm5lZEZvckZhY3RvcmllcyA9IHRydWU7XG4gICAgICB9XG4gICAgICByZXR1cm4gUmVhY3RET01GYWN0b3JpZXNbZmFjdG9yeV0uYXBwbHkoUmVhY3RET01GYWN0b3JpZXMsIGFyZ3VtZW50cyk7XG4gICAgfTtcbiAgfSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gUmVhY3Q7IiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxMy1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIF9wcm9kSW52YXJpYW50ID0gcmVxdWlyZSgnLi9yZWFjdFByb2RJbnZhcmlhbnQnKSxcbiAgICBfYXNzaWduID0gcmVxdWlyZSgnb2JqZWN0LWFzc2lnbicpO1xuXG52YXIgUmVhY3ROb29wVXBkYXRlUXVldWUgPSByZXF1aXJlKCcuL1JlYWN0Tm9vcFVwZGF0ZVF1ZXVlJyk7XG5cbnZhciBjYW5EZWZpbmVQcm9wZXJ0eSA9IHJlcXVpcmUoJy4vY2FuRGVmaW5lUHJvcGVydHknKTtcbnZhciBlbXB0eU9iamVjdCA9IHJlcXVpcmUoJ2ZianMvbGliL2VtcHR5T2JqZWN0Jyk7XG52YXIgaW52YXJpYW50ID0gcmVxdWlyZSgnZmJqcy9saWIvaW52YXJpYW50Jyk7XG52YXIgbG93UHJpb3JpdHlXYXJuaW5nID0gcmVxdWlyZSgnLi9sb3dQcmlvcml0eVdhcm5pbmcnKTtcblxuLyoqXG4gKiBCYXNlIGNsYXNzIGhlbHBlcnMgZm9yIHRoZSB1cGRhdGluZyBzdGF0ZSBvZiBhIGNvbXBvbmVudC5cbiAqL1xuZnVuY3Rpb24gUmVhY3RDb21wb25lbnQocHJvcHMsIGNvbnRleHQsIHVwZGF0ZXIpIHtcbiAgdGhpcy5wcm9wcyA9IHByb3BzO1xuICB0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuICB0aGlzLnJlZnMgPSBlbXB0eU9iamVjdDtcbiAgLy8gV2UgaW5pdGlhbGl6ZSB0aGUgZGVmYXVsdCB1cGRhdGVyIGJ1dCB0aGUgcmVhbCBvbmUgZ2V0cyBpbmplY3RlZCBieSB0aGVcbiAgLy8gcmVuZGVyZXIuXG4gIHRoaXMudXBkYXRlciA9IHVwZGF0ZXIgfHwgUmVhY3ROb29wVXBkYXRlUXVldWU7XG59XG5cblJlYWN0Q29tcG9uZW50LnByb3RvdHlwZS5pc1JlYWN0Q29tcG9uZW50ID0ge307XG5cbi8qKlxuICogU2V0cyBhIHN1YnNldCBvZiB0aGUgc3RhdGUuIEFsd2F5cyB1c2UgdGhpcyB0byBtdXRhdGVcbiAqIHN0YXRlLiBZb3Ugc2hvdWxkIHRyZWF0IGB0aGlzLnN0YXRlYCBhcyBpbW11dGFibGUuXG4gKlxuICogVGhlcmUgaXMgbm8gZ3VhcmFudGVlIHRoYXQgYHRoaXMuc3RhdGVgIHdpbGwgYmUgaW1tZWRpYXRlbHkgdXBkYXRlZCwgc29cbiAqIGFjY2Vzc2luZyBgdGhpcy5zdGF0ZWAgYWZ0ZXIgY2FsbGluZyB0aGlzIG1ldGhvZCBtYXkgcmV0dXJuIHRoZSBvbGQgdmFsdWUuXG4gKlxuICogVGhlcmUgaXMgbm8gZ3VhcmFudGVlIHRoYXQgY2FsbHMgdG8gYHNldFN0YXRlYCB3aWxsIHJ1biBzeW5jaHJvbm91c2x5LFxuICogYXMgdGhleSBtYXkgZXZlbnR1YWxseSBiZSBiYXRjaGVkIHRvZ2V0aGVyLiAgWW91IGNhbiBwcm92aWRlIGFuIG9wdGlvbmFsXG4gKiBjYWxsYmFjayB0aGF0IHdpbGwgYmUgZXhlY3V0ZWQgd2hlbiB0aGUgY2FsbCB0byBzZXRTdGF0ZSBpcyBhY3R1YWxseVxuICogY29tcGxldGVkLlxuICpcbiAqIFdoZW4gYSBmdW5jdGlvbiBpcyBwcm92aWRlZCB0byBzZXRTdGF0ZSwgaXQgd2lsbCBiZSBjYWxsZWQgYXQgc29tZSBwb2ludCBpblxuICogdGhlIGZ1dHVyZSAobm90IHN5bmNocm9ub3VzbHkpLiBJdCB3aWxsIGJlIGNhbGxlZCB3aXRoIHRoZSB1cCB0byBkYXRlXG4gKiBjb21wb25lbnQgYXJndW1lbnRzIChzdGF0ZSwgcHJvcHMsIGNvbnRleHQpLiBUaGVzZSB2YWx1ZXMgY2FuIGJlIGRpZmZlcmVudFxuICogZnJvbSB0aGlzLiogYmVjYXVzZSB5b3VyIGZ1bmN0aW9uIG1heSBiZSBjYWxsZWQgYWZ0ZXIgcmVjZWl2ZVByb3BzIGJ1dCBiZWZvcmVcbiAqIHNob3VsZENvbXBvbmVudFVwZGF0ZSwgYW5kIHRoaXMgbmV3IHN0YXRlLCBwcm9wcywgYW5kIGNvbnRleHQgd2lsbCBub3QgeWV0IGJlXG4gKiBhc3NpZ25lZCB0byB0aGlzLlxuICpcbiAqIEBwYXJhbSB7b2JqZWN0fGZ1bmN0aW9ufSBwYXJ0aWFsU3RhdGUgTmV4dCBwYXJ0aWFsIHN0YXRlIG9yIGZ1bmN0aW9uIHRvXG4gKiAgICAgICAgcHJvZHVjZSBuZXh0IHBhcnRpYWwgc3RhdGUgdG8gYmUgbWVyZ2VkIHdpdGggY3VycmVudCBzdGF0ZS5cbiAqIEBwYXJhbSB7P2Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsZWQgYWZ0ZXIgc3RhdGUgaXMgdXBkYXRlZC5cbiAqIEBmaW5hbFxuICogQHByb3RlY3RlZFxuICovXG5SZWFjdENvbXBvbmVudC5wcm90b3R5cGUuc2V0U3RhdGUgPSBmdW5jdGlvbiAocGFydGlhbFN0YXRlLCBjYWxsYmFjaykge1xuICAhKHR5cGVvZiBwYXJ0aWFsU3RhdGUgPT09ICdvYmplY3QnIHx8IHR5cGVvZiBwYXJ0aWFsU3RhdGUgPT09ICdmdW5jdGlvbicgfHwgcGFydGlhbFN0YXRlID09IG51bGwpID8gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/IGludmFyaWFudChmYWxzZSwgJ3NldFN0YXRlKC4uLik6IHRha2VzIGFuIG9iamVjdCBvZiBzdGF0ZSB2YXJpYWJsZXMgdG8gdXBkYXRlIG9yIGEgZnVuY3Rpb24gd2hpY2ggcmV0dXJucyBhbiBvYmplY3Qgb2Ygc3RhdGUgdmFyaWFibGVzLicpIDogX3Byb2RJbnZhcmlhbnQoJzg1JykgOiB2b2lkIDA7XG4gIHRoaXMudXBkYXRlci5lbnF1ZXVlU2V0U3RhdGUodGhpcywgcGFydGlhbFN0YXRlKTtcbiAgaWYgKGNhbGxiYWNrKSB7XG4gICAgdGhpcy51cGRhdGVyLmVucXVldWVDYWxsYmFjayh0aGlzLCBjYWxsYmFjaywgJ3NldFN0YXRlJyk7XG4gIH1cbn07XG5cbi8qKlxuICogRm9yY2VzIGFuIHVwZGF0ZS4gVGhpcyBzaG91bGQgb25seSBiZSBpbnZva2VkIHdoZW4gaXQgaXMga25vd24gd2l0aFxuICogY2VydGFpbnR5IHRoYXQgd2UgYXJlICoqbm90KiogaW4gYSBET00gdHJhbnNhY3Rpb24uXG4gKlxuICogWW91IG1heSB3YW50IHRvIGNhbGwgdGhpcyB3aGVuIHlvdSBrbm93IHRoYXQgc29tZSBkZWVwZXIgYXNwZWN0IG9mIHRoZVxuICogY29tcG9uZW50J3Mgc3RhdGUgaGFzIGNoYW5nZWQgYnV0IGBzZXRTdGF0ZWAgd2FzIG5vdCBjYWxsZWQuXG4gKlxuICogVGhpcyB3aWxsIG5vdCBpbnZva2UgYHNob3VsZENvbXBvbmVudFVwZGF0ZWAsIGJ1dCBpdCB3aWxsIGludm9rZVxuICogYGNvbXBvbmVudFdpbGxVcGRhdGVgIGFuZCBgY29tcG9uZW50RGlkVXBkYXRlYC5cbiAqXG4gKiBAcGFyYW0gez9mdW5jdGlvbn0gY2FsbGJhY2sgQ2FsbGVkIGFmdGVyIHVwZGF0ZSBpcyBjb21wbGV0ZS5cbiAqIEBmaW5hbFxuICogQHByb3RlY3RlZFxuICovXG5SZWFjdENvbXBvbmVudC5wcm90b3R5cGUuZm9yY2VVcGRhdGUgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgdGhpcy51cGRhdGVyLmVucXVldWVGb3JjZVVwZGF0ZSh0aGlzKTtcbiAgaWYgKGNhbGxiYWNrKSB7XG4gICAgdGhpcy51cGRhdGVyLmVucXVldWVDYWxsYmFjayh0aGlzLCBjYWxsYmFjaywgJ2ZvcmNlVXBkYXRlJyk7XG4gIH1cbn07XG5cbi8qKlxuICogRGVwcmVjYXRlZCBBUElzLiBUaGVzZSBBUElzIHVzZWQgdG8gZXhpc3Qgb24gY2xhc3NpYyBSZWFjdCBjbGFzc2VzIGJ1dCBzaW5jZVxuICogd2Ugd291bGQgbGlrZSB0byBkZXByZWNhdGUgdGhlbSwgd2UncmUgbm90IGdvaW5nIHRvIG1vdmUgdGhlbSBvdmVyIHRvIHRoaXNcbiAqIG1vZGVybiBiYXNlIGNsYXNzLiBJbnN0ZWFkLCB3ZSBkZWZpbmUgYSBnZXR0ZXIgdGhhdCB3YXJucyBpZiBpdCdzIGFjY2Vzc2VkLlxuICovXG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICB2YXIgZGVwcmVjYXRlZEFQSXMgPSB7XG4gICAgaXNNb3VudGVkOiBbJ2lzTW91bnRlZCcsICdJbnN0ZWFkLCBtYWtlIHN1cmUgdG8gY2xlYW4gdXAgc3Vic2NyaXB0aW9ucyBhbmQgcGVuZGluZyByZXF1ZXN0cyBpbiAnICsgJ2NvbXBvbmVudFdpbGxVbm1vdW50IHRvIHByZXZlbnQgbWVtb3J5IGxlYWtzLiddLFxuICAgIHJlcGxhY2VTdGF0ZTogWydyZXBsYWNlU3RhdGUnLCAnUmVmYWN0b3IgeW91ciBjb2RlIHRvIHVzZSBzZXRTdGF0ZSBpbnN0ZWFkIChzZWUgJyArICdodHRwczovL2dpdGh1Yi5jb20vZmFjZWJvb2svcmVhY3QvaXNzdWVzLzMyMzYpLiddXG4gIH07XG4gIHZhciBkZWZpbmVEZXByZWNhdGlvbldhcm5pbmcgPSBmdW5jdGlvbiAobWV0aG9kTmFtZSwgaW5mbykge1xuICAgIGlmIChjYW5EZWZpbmVQcm9wZXJ0eSkge1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFJlYWN0Q29tcG9uZW50LnByb3RvdHlwZSwgbWV0aG9kTmFtZSwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBsb3dQcmlvcml0eVdhcm5pbmcoZmFsc2UsICclcyguLi4pIGlzIGRlcHJlY2F0ZWQgaW4gcGxhaW4gSmF2YVNjcmlwdCBSZWFjdCBjbGFzc2VzLiAlcycsIGluZm9bMF0sIGluZm9bMV0pO1xuICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfTtcbiAgZm9yICh2YXIgZm5OYW1lIGluIGRlcHJlY2F0ZWRBUElzKSB7XG4gICAgaWYgKGRlcHJlY2F0ZWRBUElzLmhhc093blByb3BlcnR5KGZuTmFtZSkpIHtcbiAgICAgIGRlZmluZURlcHJlY2F0aW9uV2FybmluZyhmbk5hbWUsIGRlcHJlY2F0ZWRBUElzW2ZuTmFtZV0pO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEJhc2UgY2xhc3MgaGVscGVycyBmb3IgdGhlIHVwZGF0aW5nIHN0YXRlIG9mIGEgY29tcG9uZW50LlxuICovXG5mdW5jdGlvbiBSZWFjdFB1cmVDb21wb25lbnQocHJvcHMsIGNvbnRleHQsIHVwZGF0ZXIpIHtcbiAgLy8gRHVwbGljYXRlZCBmcm9tIFJlYWN0Q29tcG9uZW50LlxuICB0aGlzLnByb3BzID0gcHJvcHM7XG4gIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG4gIHRoaXMucmVmcyA9IGVtcHR5T2JqZWN0O1xuICAvLyBXZSBpbml0aWFsaXplIHRoZSBkZWZhdWx0IHVwZGF0ZXIgYnV0IHRoZSByZWFsIG9uZSBnZXRzIGluamVjdGVkIGJ5IHRoZVxuICAvLyByZW5kZXJlci5cbiAgdGhpcy51cGRhdGVyID0gdXBkYXRlciB8fCBSZWFjdE5vb3BVcGRhdGVRdWV1ZTtcbn1cblxuZnVuY3Rpb24gQ29tcG9uZW50RHVtbXkoKSB7fVxuQ29tcG9uZW50RHVtbXkucHJvdG90eXBlID0gUmVhY3RDb21wb25lbnQucHJvdG90eXBlO1xuUmVhY3RQdXJlQ29tcG9uZW50LnByb3RvdHlwZSA9IG5ldyBDb21wb25lbnREdW1teSgpO1xuUmVhY3RQdXJlQ29tcG9uZW50LnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IFJlYWN0UHVyZUNvbXBvbmVudDtcbi8vIEF2b2lkIGFuIGV4dHJhIHByb3RvdHlwZSBqdW1wIGZvciB0aGVzZSBtZXRob2RzLlxuX2Fzc2lnbihSZWFjdFB1cmVDb21wb25lbnQucHJvdG90eXBlLCBSZWFjdENvbXBvbmVudC5wcm90b3R5cGUpO1xuUmVhY3RQdXJlQ29tcG9uZW50LnByb3RvdHlwZS5pc1B1cmVSZWFjdENvbXBvbmVudCA9IHRydWU7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBDb21wb25lbnQ6IFJlYWN0Q29tcG9uZW50LFxuICBQdXJlQ29tcG9uZW50OiBSZWFjdFB1cmVDb21wb25lbnRcbn07IiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxMy1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIFBvb2xlZENsYXNzID0gcmVxdWlyZSgnLi9Qb29sZWRDbGFzcycpO1xudmFyIFJlYWN0RWxlbWVudCA9IHJlcXVpcmUoJy4vUmVhY3RFbGVtZW50Jyk7XG5cbnZhciBlbXB0eUZ1bmN0aW9uID0gcmVxdWlyZSgnZmJqcy9saWIvZW1wdHlGdW5jdGlvbicpO1xudmFyIHRyYXZlcnNlQWxsQ2hpbGRyZW4gPSByZXF1aXJlKCcuL3RyYXZlcnNlQWxsQ2hpbGRyZW4nKTtcblxudmFyIHR3b0FyZ3VtZW50UG9vbGVyID0gUG9vbGVkQ2xhc3MudHdvQXJndW1lbnRQb29sZXI7XG52YXIgZm91ckFyZ3VtZW50UG9vbGVyID0gUG9vbGVkQ2xhc3MuZm91ckFyZ3VtZW50UG9vbGVyO1xuXG52YXIgdXNlclByb3ZpZGVkS2V5RXNjYXBlUmVnZXggPSAvXFwvKy9nO1xuZnVuY3Rpb24gZXNjYXBlVXNlclByb3ZpZGVkS2V5KHRleHQpIHtcbiAgcmV0dXJuICgnJyArIHRleHQpLnJlcGxhY2UodXNlclByb3ZpZGVkS2V5RXNjYXBlUmVnZXgsICckJi8nKTtcbn1cblxuLyoqXG4gKiBQb29sZWRDbGFzcyByZXByZXNlbnRpbmcgdGhlIGJvb2trZWVwaW5nIGFzc29jaWF0ZWQgd2l0aCBwZXJmb3JtaW5nIGEgY2hpbGRcbiAqIHRyYXZlcnNhbC4gQWxsb3dzIGF2b2lkaW5nIGJpbmRpbmcgY2FsbGJhY2tzLlxuICpcbiAqIEBjb25zdHJ1Y3RvciBGb3JFYWNoQm9va0tlZXBpbmdcbiAqIEBwYXJhbSB7IWZ1bmN0aW9ufSBmb3JFYWNoRnVuY3Rpb24gRnVuY3Rpb24gdG8gcGVyZm9ybSB0cmF2ZXJzYWwgd2l0aC5cbiAqIEBwYXJhbSB7Pyp9IGZvckVhY2hDb250ZXh0IENvbnRleHQgdG8gcGVyZm9ybSBjb250ZXh0IHdpdGguXG4gKi9cbmZ1bmN0aW9uIEZvckVhY2hCb29rS2VlcGluZyhmb3JFYWNoRnVuY3Rpb24sIGZvckVhY2hDb250ZXh0KSB7XG4gIHRoaXMuZnVuYyA9IGZvckVhY2hGdW5jdGlvbjtcbiAgdGhpcy5jb250ZXh0ID0gZm9yRWFjaENvbnRleHQ7XG4gIHRoaXMuY291bnQgPSAwO1xufVxuRm9yRWFjaEJvb2tLZWVwaW5nLnByb3RvdHlwZS5kZXN0cnVjdG9yID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLmZ1bmMgPSBudWxsO1xuICB0aGlzLmNvbnRleHQgPSBudWxsO1xuICB0aGlzLmNvdW50ID0gMDtcbn07XG5Qb29sZWRDbGFzcy5hZGRQb29saW5nVG8oRm9yRWFjaEJvb2tLZWVwaW5nLCB0d29Bcmd1bWVudFBvb2xlcik7XG5cbmZ1bmN0aW9uIGZvckVhY2hTaW5nbGVDaGlsZChib29rS2VlcGluZywgY2hpbGQsIG5hbWUpIHtcbiAgdmFyIGZ1bmMgPSBib29rS2VlcGluZy5mdW5jLFxuICAgICAgY29udGV4dCA9IGJvb2tLZWVwaW5nLmNvbnRleHQ7XG5cbiAgZnVuYy5jYWxsKGNvbnRleHQsIGNoaWxkLCBib29rS2VlcGluZy5jb3VudCsrKTtcbn1cblxuLyoqXG4gKiBJdGVyYXRlcyB0aHJvdWdoIGNoaWxkcmVuIHRoYXQgYXJlIHR5cGljYWxseSBzcGVjaWZpZWQgYXMgYHByb3BzLmNoaWxkcmVuYC5cbiAqXG4gKiBTZWUgaHR0cHM6Ly9mYWNlYm9vay5naXRodWIuaW8vcmVhY3QvZG9jcy90b3AtbGV2ZWwtYXBpLmh0bWwjcmVhY3QuY2hpbGRyZW4uZm9yZWFjaFxuICpcbiAqIFRoZSBwcm92aWRlZCBmb3JFYWNoRnVuYyhjaGlsZCwgaW5kZXgpIHdpbGwgYmUgY2FsbGVkIGZvciBlYWNoXG4gKiBsZWFmIGNoaWxkLlxuICpcbiAqIEBwYXJhbSB7Pyp9IGNoaWxkcmVuIENoaWxkcmVuIHRyZWUgY29udGFpbmVyLlxuICogQHBhcmFtIHtmdW5jdGlvbigqLCBpbnQpfSBmb3JFYWNoRnVuY1xuICogQHBhcmFtIHsqfSBmb3JFYWNoQ29udGV4dCBDb250ZXh0IGZvciBmb3JFYWNoQ29udGV4dC5cbiAqL1xuZnVuY3Rpb24gZm9yRWFjaENoaWxkcmVuKGNoaWxkcmVuLCBmb3JFYWNoRnVuYywgZm9yRWFjaENvbnRleHQpIHtcbiAgaWYgKGNoaWxkcmVuID09IG51bGwpIHtcbiAgICByZXR1cm4gY2hpbGRyZW47XG4gIH1cbiAgdmFyIHRyYXZlcnNlQ29udGV4dCA9IEZvckVhY2hCb29rS2VlcGluZy5nZXRQb29sZWQoZm9yRWFjaEZ1bmMsIGZvckVhY2hDb250ZXh0KTtcbiAgdHJhdmVyc2VBbGxDaGlsZHJlbihjaGlsZHJlbiwgZm9yRWFjaFNpbmdsZUNoaWxkLCB0cmF2ZXJzZUNvbnRleHQpO1xuICBGb3JFYWNoQm9va0tlZXBpbmcucmVsZWFzZSh0cmF2ZXJzZUNvbnRleHQpO1xufVxuXG4vKipcbiAqIFBvb2xlZENsYXNzIHJlcHJlc2VudGluZyB0aGUgYm9va2tlZXBpbmcgYXNzb2NpYXRlZCB3aXRoIHBlcmZvcm1pbmcgYSBjaGlsZFxuICogbWFwcGluZy4gQWxsb3dzIGF2b2lkaW5nIGJpbmRpbmcgY2FsbGJhY2tzLlxuICpcbiAqIEBjb25zdHJ1Y3RvciBNYXBCb29rS2VlcGluZ1xuICogQHBhcmFtIHshKn0gbWFwUmVzdWx0IE9iamVjdCBjb250YWluaW5nIHRoZSBvcmRlcmVkIG1hcCBvZiByZXN1bHRzLlxuICogQHBhcmFtIHshZnVuY3Rpb259IG1hcEZ1bmN0aW9uIEZ1bmN0aW9uIHRvIHBlcmZvcm0gbWFwcGluZyB3aXRoLlxuICogQHBhcmFtIHs/Kn0gbWFwQ29udGV4dCBDb250ZXh0IHRvIHBlcmZvcm0gbWFwcGluZyB3aXRoLlxuICovXG5mdW5jdGlvbiBNYXBCb29rS2VlcGluZyhtYXBSZXN1bHQsIGtleVByZWZpeCwgbWFwRnVuY3Rpb24sIG1hcENvbnRleHQpIHtcbiAgdGhpcy5yZXN1bHQgPSBtYXBSZXN1bHQ7XG4gIHRoaXMua2V5UHJlZml4ID0ga2V5UHJlZml4O1xuICB0aGlzLmZ1bmMgPSBtYXBGdW5jdGlvbjtcbiAgdGhpcy5jb250ZXh0ID0gbWFwQ29udGV4dDtcbiAgdGhpcy5jb3VudCA9IDA7XG59XG5NYXBCb29rS2VlcGluZy5wcm90b3R5cGUuZGVzdHJ1Y3RvciA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5yZXN1bHQgPSBudWxsO1xuICB0aGlzLmtleVByZWZpeCA9IG51bGw7XG4gIHRoaXMuZnVuYyA9IG51bGw7XG4gIHRoaXMuY29udGV4dCA9IG51bGw7XG4gIHRoaXMuY291bnQgPSAwO1xufTtcblBvb2xlZENsYXNzLmFkZFBvb2xpbmdUbyhNYXBCb29rS2VlcGluZywgZm91ckFyZ3VtZW50UG9vbGVyKTtcblxuZnVuY3Rpb24gbWFwU2luZ2xlQ2hpbGRJbnRvQ29udGV4dChib29rS2VlcGluZywgY2hpbGQsIGNoaWxkS2V5KSB7XG4gIHZhciByZXN1bHQgPSBib29rS2VlcGluZy5yZXN1bHQsXG4gICAgICBrZXlQcmVmaXggPSBib29rS2VlcGluZy5rZXlQcmVmaXgsXG4gICAgICBmdW5jID0gYm9va0tlZXBpbmcuZnVuYyxcbiAgICAgIGNvbnRleHQgPSBib29rS2VlcGluZy5jb250ZXh0O1xuXG5cbiAgdmFyIG1hcHBlZENoaWxkID0gZnVuYy5jYWxsKGNvbnRleHQsIGNoaWxkLCBib29rS2VlcGluZy5jb3VudCsrKTtcbiAgaWYgKEFycmF5LmlzQXJyYXkobWFwcGVkQ2hpbGQpKSB7XG4gICAgbWFwSW50b1dpdGhLZXlQcmVmaXhJbnRlcm5hbChtYXBwZWRDaGlsZCwgcmVzdWx0LCBjaGlsZEtleSwgZW1wdHlGdW5jdGlvbi50aGF0UmV0dXJuc0FyZ3VtZW50KTtcbiAgfSBlbHNlIGlmIChtYXBwZWRDaGlsZCAhPSBudWxsKSB7XG4gICAgaWYgKFJlYWN0RWxlbWVudC5pc1ZhbGlkRWxlbWVudChtYXBwZWRDaGlsZCkpIHtcbiAgICAgIG1hcHBlZENoaWxkID0gUmVhY3RFbGVtZW50LmNsb25lQW5kUmVwbGFjZUtleShtYXBwZWRDaGlsZCxcbiAgICAgIC8vIEtlZXAgYm90aCB0aGUgKG1hcHBlZCkgYW5kIG9sZCBrZXlzIGlmIHRoZXkgZGlmZmVyLCBqdXN0IGFzXG4gICAgICAvLyB0cmF2ZXJzZUFsbENoaWxkcmVuIHVzZWQgdG8gZG8gZm9yIG9iamVjdHMgYXMgY2hpbGRyZW5cbiAgICAgIGtleVByZWZpeCArIChtYXBwZWRDaGlsZC5rZXkgJiYgKCFjaGlsZCB8fCBjaGlsZC5rZXkgIT09IG1hcHBlZENoaWxkLmtleSkgPyBlc2NhcGVVc2VyUHJvdmlkZWRLZXkobWFwcGVkQ2hpbGQua2V5KSArICcvJyA6ICcnKSArIGNoaWxkS2V5KTtcbiAgICB9XG4gICAgcmVzdWx0LnB1c2gobWFwcGVkQ2hpbGQpO1xuICB9XG59XG5cbmZ1bmN0aW9uIG1hcEludG9XaXRoS2V5UHJlZml4SW50ZXJuYWwoY2hpbGRyZW4sIGFycmF5LCBwcmVmaXgsIGZ1bmMsIGNvbnRleHQpIHtcbiAgdmFyIGVzY2FwZWRQcmVmaXggPSAnJztcbiAgaWYgKHByZWZpeCAhPSBudWxsKSB7XG4gICAgZXNjYXBlZFByZWZpeCA9IGVzY2FwZVVzZXJQcm92aWRlZEtleShwcmVmaXgpICsgJy8nO1xuICB9XG4gIHZhciB0cmF2ZXJzZUNvbnRleHQgPSBNYXBCb29rS2VlcGluZy5nZXRQb29sZWQoYXJyYXksIGVzY2FwZWRQcmVmaXgsIGZ1bmMsIGNvbnRleHQpO1xuICB0cmF2ZXJzZUFsbENoaWxkcmVuKGNoaWxkcmVuLCBtYXBTaW5nbGVDaGlsZEludG9Db250ZXh0LCB0cmF2ZXJzZUNvbnRleHQpO1xuICBNYXBCb29rS2VlcGluZy5yZWxlYXNlKHRyYXZlcnNlQ29udGV4dCk7XG59XG5cbi8qKlxuICogTWFwcyBjaGlsZHJlbiB0aGF0IGFyZSB0eXBpY2FsbHkgc3BlY2lmaWVkIGFzIGBwcm9wcy5jaGlsZHJlbmAuXG4gKlxuICogU2VlIGh0dHBzOi8vZmFjZWJvb2suZ2l0aHViLmlvL3JlYWN0L2RvY3MvdG9wLWxldmVsLWFwaS5odG1sI3JlYWN0LmNoaWxkcmVuLm1hcFxuICpcbiAqIFRoZSBwcm92aWRlZCBtYXBGdW5jdGlvbihjaGlsZCwga2V5LCBpbmRleCkgd2lsbCBiZSBjYWxsZWQgZm9yIGVhY2hcbiAqIGxlYWYgY2hpbGQuXG4gKlxuICogQHBhcmFtIHs/Kn0gY2hpbGRyZW4gQ2hpbGRyZW4gdHJlZSBjb250YWluZXIuXG4gKiBAcGFyYW0ge2Z1bmN0aW9uKCosIGludCl9IGZ1bmMgVGhlIG1hcCBmdW5jdGlvbi5cbiAqIEBwYXJhbSB7Kn0gY29udGV4dCBDb250ZXh0IGZvciBtYXBGdW5jdGlvbi5cbiAqIEByZXR1cm4ge29iamVjdH0gT2JqZWN0IGNvbnRhaW5pbmcgdGhlIG9yZGVyZWQgbWFwIG9mIHJlc3VsdHMuXG4gKi9cbmZ1bmN0aW9uIG1hcENoaWxkcmVuKGNoaWxkcmVuLCBmdW5jLCBjb250ZXh0KSB7XG4gIGlmIChjaGlsZHJlbiA9PSBudWxsKSB7XG4gICAgcmV0dXJuIGNoaWxkcmVuO1xuICB9XG4gIHZhciByZXN1bHQgPSBbXTtcbiAgbWFwSW50b1dpdGhLZXlQcmVmaXhJbnRlcm5hbChjaGlsZHJlbiwgcmVzdWx0LCBudWxsLCBmdW5jLCBjb250ZXh0KTtcbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gZm9yRWFjaFNpbmdsZUNoaWxkRHVtbXkodHJhdmVyc2VDb250ZXh0LCBjaGlsZCwgbmFtZSkge1xuICByZXR1cm4gbnVsbDtcbn1cblxuLyoqXG4gKiBDb3VudCB0aGUgbnVtYmVyIG9mIGNoaWxkcmVuIHRoYXQgYXJlIHR5cGljYWxseSBzcGVjaWZpZWQgYXNcbiAqIGBwcm9wcy5jaGlsZHJlbmAuXG4gKlxuICogU2VlIGh0dHBzOi8vZmFjZWJvb2suZ2l0aHViLmlvL3JlYWN0L2RvY3MvdG9wLWxldmVsLWFwaS5odG1sI3JlYWN0LmNoaWxkcmVuLmNvdW50XG4gKlxuICogQHBhcmFtIHs/Kn0gY2hpbGRyZW4gQ2hpbGRyZW4gdHJlZSBjb250YWluZXIuXG4gKiBAcmV0dXJuIHtudW1iZXJ9IFRoZSBudW1iZXIgb2YgY2hpbGRyZW4uXG4gKi9cbmZ1bmN0aW9uIGNvdW50Q2hpbGRyZW4oY2hpbGRyZW4sIGNvbnRleHQpIHtcbiAgcmV0dXJuIHRyYXZlcnNlQWxsQ2hpbGRyZW4oY2hpbGRyZW4sIGZvckVhY2hTaW5nbGVDaGlsZER1bW15LCBudWxsKTtcbn1cblxuLyoqXG4gKiBGbGF0dGVuIGEgY2hpbGRyZW4gb2JqZWN0ICh0eXBpY2FsbHkgc3BlY2lmaWVkIGFzIGBwcm9wcy5jaGlsZHJlbmApIGFuZFxuICogcmV0dXJuIGFuIGFycmF5IHdpdGggYXBwcm9wcmlhdGVseSByZS1rZXllZCBjaGlsZHJlbi5cbiAqXG4gKiBTZWUgaHR0cHM6Ly9mYWNlYm9vay5naXRodWIuaW8vcmVhY3QvZG9jcy90b3AtbGV2ZWwtYXBpLmh0bWwjcmVhY3QuY2hpbGRyZW4udG9hcnJheVxuICovXG5mdW5jdGlvbiB0b0FycmF5KGNoaWxkcmVuKSB7XG4gIHZhciByZXN1bHQgPSBbXTtcbiAgbWFwSW50b1dpdGhLZXlQcmVmaXhJbnRlcm5hbChjaGlsZHJlbiwgcmVzdWx0LCBudWxsLCBlbXB0eUZ1bmN0aW9uLnRoYXRSZXR1cm5zQXJndW1lbnQpO1xuICByZXR1cm4gcmVzdWx0O1xufVxuXG52YXIgUmVhY3RDaGlsZHJlbiA9IHtcbiAgZm9yRWFjaDogZm9yRWFjaENoaWxkcmVuLFxuICBtYXA6IG1hcENoaWxkcmVuLFxuICBtYXBJbnRvV2l0aEtleVByZWZpeEludGVybmFsOiBtYXBJbnRvV2l0aEtleVByZWZpeEludGVybmFsLFxuICBjb3VudDogY291bnRDaGlsZHJlbixcbiAgdG9BcnJheTogdG9BcnJheVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBSZWFjdENoaWxkcmVuOyIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTYtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICpcbiAqIFxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIF9wcm9kSW52YXJpYW50ID0gcmVxdWlyZSgnLi9yZWFjdFByb2RJbnZhcmlhbnQnKTtcblxudmFyIFJlYWN0Q3VycmVudE93bmVyID0gcmVxdWlyZSgnLi9SZWFjdEN1cnJlbnRPd25lcicpO1xuXG52YXIgaW52YXJpYW50ID0gcmVxdWlyZSgnZmJqcy9saWIvaW52YXJpYW50Jyk7XG52YXIgd2FybmluZyA9IHJlcXVpcmUoJ2ZianMvbGliL3dhcm5pbmcnKTtcblxuZnVuY3Rpb24gaXNOYXRpdmUoZm4pIHtcbiAgLy8gQmFzZWQgb24gaXNOYXRpdmUoKSBmcm9tIExvZGFzaFxuICB2YXIgZnVuY1RvU3RyaW5nID0gRnVuY3Rpb24ucHJvdG90eXBlLnRvU3RyaW5nO1xuICB2YXIgaGFzT3duUHJvcGVydHkgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuICB2YXIgcmVJc05hdGl2ZSA9IFJlZ0V4cCgnXicgKyBmdW5jVG9TdHJpbmdcbiAgLy8gVGFrZSBhbiBleGFtcGxlIG5hdGl2ZSBmdW5jdGlvbiBzb3VyY2UgZm9yIGNvbXBhcmlzb25cbiAgLmNhbGwoaGFzT3duUHJvcGVydHlcbiAgLy8gU3RyaXAgcmVnZXggY2hhcmFjdGVycyBzbyB3ZSBjYW4gdXNlIGl0IGZvciByZWdleFxuICApLnJlcGxhY2UoL1tcXFxcXiQuKis/KClbXFxde318XS9nLCAnXFxcXCQmJ1xuICAvLyBSZW1vdmUgaGFzT3duUHJvcGVydHkgZnJvbSB0aGUgdGVtcGxhdGUgdG8gbWFrZSBpdCBnZW5lcmljXG4gICkucmVwbGFjZSgvaGFzT3duUHJvcGVydHl8KGZ1bmN0aW9uKS4qPyg/PVxcXFxcXCgpfCBmb3IgLis/KD89XFxcXFxcXSkvZywgJyQxLio/JykgKyAnJCcpO1xuICB0cnkge1xuICAgIHZhciBzb3VyY2UgPSBmdW5jVG9TdHJpbmcuY2FsbChmbik7XG4gICAgcmV0dXJuIHJlSXNOYXRpdmUudGVzdChzb3VyY2UpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxudmFyIGNhblVzZUNvbGxlY3Rpb25zID1cbi8vIEFycmF5LmZyb21cbnR5cGVvZiBBcnJheS5mcm9tID09PSAnZnVuY3Rpb24nICYmXG4vLyBNYXBcbnR5cGVvZiBNYXAgPT09ICdmdW5jdGlvbicgJiYgaXNOYXRpdmUoTWFwKSAmJlxuLy8gTWFwLnByb3RvdHlwZS5rZXlzXG5NYXAucHJvdG90eXBlICE9IG51bGwgJiYgdHlwZW9mIE1hcC5wcm90b3R5cGUua2V5cyA9PT0gJ2Z1bmN0aW9uJyAmJiBpc05hdGl2ZShNYXAucHJvdG90eXBlLmtleXMpICYmXG4vLyBTZXRcbnR5cGVvZiBTZXQgPT09ICdmdW5jdGlvbicgJiYgaXNOYXRpdmUoU2V0KSAmJlxuLy8gU2V0LnByb3RvdHlwZS5rZXlzXG5TZXQucHJvdG90eXBlICE9IG51bGwgJiYgdHlwZW9mIFNldC5wcm90b3R5cGUua2V5cyA9PT0gJ2Z1bmN0aW9uJyAmJiBpc05hdGl2ZShTZXQucHJvdG90eXBlLmtleXMpO1xuXG52YXIgc2V0SXRlbTtcbnZhciBnZXRJdGVtO1xudmFyIHJlbW92ZUl0ZW07XG52YXIgZ2V0SXRlbUlEcztcbnZhciBhZGRSb290O1xudmFyIHJlbW92ZVJvb3Q7XG52YXIgZ2V0Um9vdElEcztcblxuaWYgKGNhblVzZUNvbGxlY3Rpb25zKSB7XG4gIHZhciBpdGVtTWFwID0gbmV3IE1hcCgpO1xuICB2YXIgcm9vdElEU2V0ID0gbmV3IFNldCgpO1xuXG4gIHNldEl0ZW0gPSBmdW5jdGlvbiAoaWQsIGl0ZW0pIHtcbiAgICBpdGVtTWFwLnNldChpZCwgaXRlbSk7XG4gIH07XG4gIGdldEl0ZW0gPSBmdW5jdGlvbiAoaWQpIHtcbiAgICByZXR1cm4gaXRlbU1hcC5nZXQoaWQpO1xuICB9O1xuICByZW1vdmVJdGVtID0gZnVuY3Rpb24gKGlkKSB7XG4gICAgaXRlbU1hcFsnZGVsZXRlJ10oaWQpO1xuICB9O1xuICBnZXRJdGVtSURzID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBBcnJheS5mcm9tKGl0ZW1NYXAua2V5cygpKTtcbiAgfTtcblxuICBhZGRSb290ID0gZnVuY3Rpb24gKGlkKSB7XG4gICAgcm9vdElEU2V0LmFkZChpZCk7XG4gIH07XG4gIHJlbW92ZVJvb3QgPSBmdW5jdGlvbiAoaWQpIHtcbiAgICByb290SURTZXRbJ2RlbGV0ZSddKGlkKTtcbiAgfTtcbiAgZ2V0Um9vdElEcyA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gQXJyYXkuZnJvbShyb290SURTZXQua2V5cygpKTtcbiAgfTtcbn0gZWxzZSB7XG4gIHZhciBpdGVtQnlLZXkgPSB7fTtcbiAgdmFyIHJvb3RCeUtleSA9IHt9O1xuXG4gIC8vIFVzZSBub24tbnVtZXJpYyBrZXlzIHRvIHByZXZlbnQgVjggcGVyZm9ybWFuY2UgaXNzdWVzOlxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vZmFjZWJvb2svcmVhY3QvcHVsbC83MjMyXG4gIHZhciBnZXRLZXlGcm9tSUQgPSBmdW5jdGlvbiAoaWQpIHtcbiAgICByZXR1cm4gJy4nICsgaWQ7XG4gIH07XG4gIHZhciBnZXRJREZyb21LZXkgPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgcmV0dXJuIHBhcnNlSW50KGtleS5zdWJzdHIoMSksIDEwKTtcbiAgfTtcblxuICBzZXRJdGVtID0gZnVuY3Rpb24gKGlkLCBpdGVtKSB7XG4gICAgdmFyIGtleSA9IGdldEtleUZyb21JRChpZCk7XG4gICAgaXRlbUJ5S2V5W2tleV0gPSBpdGVtO1xuICB9O1xuICBnZXRJdGVtID0gZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIGtleSA9IGdldEtleUZyb21JRChpZCk7XG4gICAgcmV0dXJuIGl0ZW1CeUtleVtrZXldO1xuICB9O1xuICByZW1vdmVJdGVtID0gZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIGtleSA9IGdldEtleUZyb21JRChpZCk7XG4gICAgZGVsZXRlIGl0ZW1CeUtleVtrZXldO1xuICB9O1xuICBnZXRJdGVtSURzID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyhpdGVtQnlLZXkpLm1hcChnZXRJREZyb21LZXkpO1xuICB9O1xuXG4gIGFkZFJvb3QgPSBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIga2V5ID0gZ2V0S2V5RnJvbUlEKGlkKTtcbiAgICByb290QnlLZXlba2V5XSA9IHRydWU7XG4gIH07XG4gIHJlbW92ZVJvb3QgPSBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIga2V5ID0gZ2V0S2V5RnJvbUlEKGlkKTtcbiAgICBkZWxldGUgcm9vdEJ5S2V5W2tleV07XG4gIH07XG4gIGdldFJvb3RJRHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHJvb3RCeUtleSkubWFwKGdldElERnJvbUtleSk7XG4gIH07XG59XG5cbnZhciB1bm1vdW50ZWRJRHMgPSBbXTtcblxuZnVuY3Rpb24gcHVyZ2VEZWVwKGlkKSB7XG4gIHZhciBpdGVtID0gZ2V0SXRlbShpZCk7XG4gIGlmIChpdGVtKSB7XG4gICAgdmFyIGNoaWxkSURzID0gaXRlbS5jaGlsZElEcztcblxuICAgIHJlbW92ZUl0ZW0oaWQpO1xuICAgIGNoaWxkSURzLmZvckVhY2gocHVyZ2VEZWVwKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBkZXNjcmliZUNvbXBvbmVudEZyYW1lKG5hbWUsIHNvdXJjZSwgb3duZXJOYW1lKSB7XG4gIHJldHVybiAnXFxuICAgIGluICcgKyAobmFtZSB8fCAnVW5rbm93bicpICsgKHNvdXJjZSA/ICcgKGF0ICcgKyBzb3VyY2UuZmlsZU5hbWUucmVwbGFjZSgvXi4qW1xcXFxcXC9dLywgJycpICsgJzonICsgc291cmNlLmxpbmVOdW1iZXIgKyAnKScgOiBvd25lck5hbWUgPyAnIChjcmVhdGVkIGJ5ICcgKyBvd25lck5hbWUgKyAnKScgOiAnJyk7XG59XG5cbmZ1bmN0aW9uIGdldERpc3BsYXlOYW1lKGVsZW1lbnQpIHtcbiAgaWYgKGVsZW1lbnQgPT0gbnVsbCkge1xuICAgIHJldHVybiAnI2VtcHR5JztcbiAgfSBlbHNlIGlmICh0eXBlb2YgZWxlbWVudCA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIGVsZW1lbnQgPT09ICdudW1iZXInKSB7XG4gICAgcmV0dXJuICcjdGV4dCc7XG4gIH0gZWxzZSBpZiAodHlwZW9mIGVsZW1lbnQudHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gZWxlbWVudC50eXBlO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBlbGVtZW50LnR5cGUuZGlzcGxheU5hbWUgfHwgZWxlbWVudC50eXBlLm5hbWUgfHwgJ1Vua25vd24nO1xuICB9XG59XG5cbmZ1bmN0aW9uIGRlc2NyaWJlSUQoaWQpIHtcbiAgdmFyIG5hbWUgPSBSZWFjdENvbXBvbmVudFRyZWVIb29rLmdldERpc3BsYXlOYW1lKGlkKTtcbiAgdmFyIGVsZW1lbnQgPSBSZWFjdENvbXBvbmVudFRyZWVIb29rLmdldEVsZW1lbnQoaWQpO1xuICB2YXIgb3duZXJJRCA9IFJlYWN0Q29tcG9uZW50VHJlZUhvb2suZ2V0T3duZXJJRChpZCk7XG4gIHZhciBvd25lck5hbWU7XG4gIGlmIChvd25lcklEKSB7XG4gICAgb3duZXJOYW1lID0gUmVhY3RDb21wb25lbnRUcmVlSG9vay5nZXREaXNwbGF5TmFtZShvd25lcklEKTtcbiAgfVxuICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nID8gd2FybmluZyhlbGVtZW50LCAnUmVhY3RDb21wb25lbnRUcmVlSG9vazogTWlzc2luZyBSZWFjdCBlbGVtZW50IGZvciBkZWJ1Z0lEICVzIHdoZW4gJyArICdidWlsZGluZyBzdGFjaycsIGlkKSA6IHZvaWQgMDtcbiAgcmV0dXJuIGRlc2NyaWJlQ29tcG9uZW50RnJhbWUobmFtZSwgZWxlbWVudCAmJiBlbGVtZW50Ll9zb3VyY2UsIG93bmVyTmFtZSk7XG59XG5cbnZhciBSZWFjdENvbXBvbmVudFRyZWVIb29rID0ge1xuICBvblNldENoaWxkcmVuOiBmdW5jdGlvbiAoaWQsIG5leHRDaGlsZElEcykge1xuICAgIHZhciBpdGVtID0gZ2V0SXRlbShpZCk7XG4gICAgIWl0ZW0gPyBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nID8gaW52YXJpYW50KGZhbHNlLCAnSXRlbSBtdXN0IGhhdmUgYmVlbiBzZXQnKSA6IF9wcm9kSW52YXJpYW50KCcxNDQnKSA6IHZvaWQgMDtcbiAgICBpdGVtLmNoaWxkSURzID0gbmV4dENoaWxkSURzO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBuZXh0Q2hpbGRJRHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBuZXh0Q2hpbGRJRCA9IG5leHRDaGlsZElEc1tpXTtcbiAgICAgIHZhciBuZXh0Q2hpbGQgPSBnZXRJdGVtKG5leHRDaGlsZElEKTtcbiAgICAgICFuZXh0Q2hpbGQgPyBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nID8gaW52YXJpYW50KGZhbHNlLCAnRXhwZWN0ZWQgaG9vayBldmVudHMgdG8gZmlyZSBmb3IgdGhlIGNoaWxkIGJlZm9yZSBpdHMgcGFyZW50IGluY2x1ZGVzIGl0IGluIG9uU2V0Q2hpbGRyZW4oKS4nKSA6IF9wcm9kSW52YXJpYW50KCcxNDAnKSA6IHZvaWQgMDtcbiAgICAgICEobmV4dENoaWxkLmNoaWxkSURzICE9IG51bGwgfHwgdHlwZW9mIG5leHRDaGlsZC5lbGVtZW50ICE9PSAnb2JqZWN0JyB8fCBuZXh0Q2hpbGQuZWxlbWVudCA9PSBudWxsKSA/IHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyBpbnZhcmlhbnQoZmFsc2UsICdFeHBlY3RlZCBvblNldENoaWxkcmVuKCkgdG8gZmlyZSBmb3IgYSBjb250YWluZXIgY2hpbGQgYmVmb3JlIGl0cyBwYXJlbnQgaW5jbHVkZXMgaXQgaW4gb25TZXRDaGlsZHJlbigpLicpIDogX3Byb2RJbnZhcmlhbnQoJzE0MScpIDogdm9pZCAwO1xuICAgICAgIW5leHRDaGlsZC5pc01vdW50ZWQgPyBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nID8gaW52YXJpYW50KGZhbHNlLCAnRXhwZWN0ZWQgb25Nb3VudENvbXBvbmVudCgpIHRvIGZpcmUgZm9yIHRoZSBjaGlsZCBiZWZvcmUgaXRzIHBhcmVudCBpbmNsdWRlcyBpdCBpbiBvblNldENoaWxkcmVuKCkuJykgOiBfcHJvZEludmFyaWFudCgnNzEnKSA6IHZvaWQgMDtcbiAgICAgIGlmIChuZXh0Q2hpbGQucGFyZW50SUQgPT0gbnVsbCkge1xuICAgICAgICBuZXh0Q2hpbGQucGFyZW50SUQgPSBpZDtcbiAgICAgICAgLy8gVE9ETzogVGhpcyBzaG91bGRuJ3QgYmUgbmVjZXNzYXJ5IGJ1dCBtb3VudGluZyBhIG5ldyByb290IGR1cmluZyBpblxuICAgICAgICAvLyBjb21wb25lbnRXaWxsTW91bnQgY3VycmVudGx5IGNhdXNlcyBub3QteWV0LW1vdW50ZWQgY29tcG9uZW50cyB0b1xuICAgICAgICAvLyBiZSBwdXJnZWQgZnJvbSBvdXIgdHJlZSBkYXRhIHNvIHRoZWlyIHBhcmVudCBpZCBpcyBtaXNzaW5nLlxuICAgICAgfVxuICAgICAgIShuZXh0Q2hpbGQucGFyZW50SUQgPT09IGlkKSA/IHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyBpbnZhcmlhbnQoZmFsc2UsICdFeHBlY3RlZCBvbkJlZm9yZU1vdW50Q29tcG9uZW50KCkgcGFyZW50IGFuZCBvblNldENoaWxkcmVuKCkgdG8gYmUgY29uc2lzdGVudCAoJXMgaGFzIHBhcmVudHMgJXMgYW5kICVzKS4nLCBuZXh0Q2hpbGRJRCwgbmV4dENoaWxkLnBhcmVudElELCBpZCkgOiBfcHJvZEludmFyaWFudCgnMTQyJywgbmV4dENoaWxkSUQsIG5leHRDaGlsZC5wYXJlbnRJRCwgaWQpIDogdm9pZCAwO1xuICAgIH1cbiAgfSxcbiAgb25CZWZvcmVNb3VudENvbXBvbmVudDogZnVuY3Rpb24gKGlkLCBlbGVtZW50LCBwYXJlbnRJRCkge1xuICAgIHZhciBpdGVtID0ge1xuICAgICAgZWxlbWVudDogZWxlbWVudCxcbiAgICAgIHBhcmVudElEOiBwYXJlbnRJRCxcbiAgICAgIHRleHQ6IG51bGwsXG4gICAgICBjaGlsZElEczogW10sXG4gICAgICBpc01vdW50ZWQ6IGZhbHNlLFxuICAgICAgdXBkYXRlQ291bnQ6IDBcbiAgICB9O1xuICAgIHNldEl0ZW0oaWQsIGl0ZW0pO1xuICB9LFxuICBvbkJlZm9yZVVwZGF0ZUNvbXBvbmVudDogZnVuY3Rpb24gKGlkLCBlbGVtZW50KSB7XG4gICAgdmFyIGl0ZW0gPSBnZXRJdGVtKGlkKTtcbiAgICBpZiAoIWl0ZW0gfHwgIWl0ZW0uaXNNb3VudGVkKSB7XG4gICAgICAvLyBXZSBtYXkgZW5kIHVwIGhlcmUgYXMgYSByZXN1bHQgb2Ygc2V0U3RhdGUoKSBpbiBjb21wb25lbnRXaWxsVW5tb3VudCgpLlxuICAgICAgLy8gSW4gdGhpcyBjYXNlLCBpZ25vcmUgdGhlIGVsZW1lbnQuXG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGl0ZW0uZWxlbWVudCA9IGVsZW1lbnQ7XG4gIH0sXG4gIG9uTW91bnRDb21wb25lbnQ6IGZ1bmN0aW9uIChpZCkge1xuICAgIHZhciBpdGVtID0gZ2V0SXRlbShpZCk7XG4gICAgIWl0ZW0gPyBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nID8gaW52YXJpYW50KGZhbHNlLCAnSXRlbSBtdXN0IGhhdmUgYmVlbiBzZXQnKSA6IF9wcm9kSW52YXJpYW50KCcxNDQnKSA6IHZvaWQgMDtcbiAgICBpdGVtLmlzTW91bnRlZCA9IHRydWU7XG4gICAgdmFyIGlzUm9vdCA9IGl0ZW0ucGFyZW50SUQgPT09IDA7XG4gICAgaWYgKGlzUm9vdCkge1xuICAgICAgYWRkUm9vdChpZCk7XG4gICAgfVxuICB9LFxuICBvblVwZGF0ZUNvbXBvbmVudDogZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIGl0ZW0gPSBnZXRJdGVtKGlkKTtcbiAgICBpZiAoIWl0ZW0gfHwgIWl0ZW0uaXNNb3VudGVkKSB7XG4gICAgICAvLyBXZSBtYXkgZW5kIHVwIGhlcmUgYXMgYSByZXN1bHQgb2Ygc2V0U3RhdGUoKSBpbiBjb21wb25lbnRXaWxsVW5tb3VudCgpLlxuICAgICAgLy8gSW4gdGhpcyBjYXNlLCBpZ25vcmUgdGhlIGVsZW1lbnQuXG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGl0ZW0udXBkYXRlQ291bnQrKztcbiAgfSxcbiAgb25Vbm1vdW50Q29tcG9uZW50OiBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIgaXRlbSA9IGdldEl0ZW0oaWQpO1xuICAgIGlmIChpdGVtKSB7XG4gICAgICAvLyBXZSBuZWVkIHRvIGNoZWNrIGlmIGl0IGV4aXN0cy5cbiAgICAgIC8vIGBpdGVtYCBtaWdodCBub3QgZXhpc3QgaWYgaXQgaXMgaW5zaWRlIGFuIGVycm9yIGJvdW5kYXJ5LCBhbmQgYSBzaWJsaW5nXG4gICAgICAvLyBlcnJvciBib3VuZGFyeSBjaGlsZCB0aHJldyB3aGlsZSBtb3VudGluZy4gVGhlbiB0aGlzIGluc3RhbmNlIG5ldmVyXG4gICAgICAvLyBnb3QgYSBjaGFuY2UgdG8gbW91bnQsIGJ1dCBpdCBzdGlsbCBnZXRzIGFuIHVubW91bnRpbmcgZXZlbnQgZHVyaW5nXG4gICAgICAvLyB0aGUgZXJyb3IgYm91bmRhcnkgY2xlYW51cC5cbiAgICAgIGl0ZW0uaXNNb3VudGVkID0gZmFsc2U7XG4gICAgICB2YXIgaXNSb290ID0gaXRlbS5wYXJlbnRJRCA9PT0gMDtcbiAgICAgIGlmIChpc1Jvb3QpIHtcbiAgICAgICAgcmVtb3ZlUm9vdChpZCk7XG4gICAgICB9XG4gICAgfVxuICAgIHVubW91bnRlZElEcy5wdXNoKGlkKTtcbiAgfSxcbiAgcHVyZ2VVbm1vdW50ZWRDb21wb25lbnRzOiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKFJlYWN0Q29tcG9uZW50VHJlZUhvb2suX3ByZXZlbnRQdXJnaW5nKSB7XG4gICAgICAvLyBTaG91bGQgb25seSBiZSB1c2VkIGZvciB0ZXN0aW5nLlxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdW5tb3VudGVkSURzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgaWQgPSB1bm1vdW50ZWRJRHNbaV07XG4gICAgICBwdXJnZURlZXAoaWQpO1xuICAgIH1cbiAgICB1bm1vdW50ZWRJRHMubGVuZ3RoID0gMDtcbiAgfSxcbiAgaXNNb3VudGVkOiBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIgaXRlbSA9IGdldEl0ZW0oaWQpO1xuICAgIHJldHVybiBpdGVtID8gaXRlbS5pc01vdW50ZWQgOiBmYWxzZTtcbiAgfSxcbiAgZ2V0Q3VycmVudFN0YWNrQWRkZW5kdW06IGZ1bmN0aW9uICh0b3BFbGVtZW50KSB7XG4gICAgdmFyIGluZm8gPSAnJztcbiAgICBpZiAodG9wRWxlbWVudCkge1xuICAgICAgdmFyIG5hbWUgPSBnZXREaXNwbGF5TmFtZSh0b3BFbGVtZW50KTtcbiAgICAgIHZhciBvd25lciA9IHRvcEVsZW1lbnQuX293bmVyO1xuICAgICAgaW5mbyArPSBkZXNjcmliZUNvbXBvbmVudEZyYW1lKG5hbWUsIHRvcEVsZW1lbnQuX3NvdXJjZSwgb3duZXIgJiYgb3duZXIuZ2V0TmFtZSgpKTtcbiAgICB9XG5cbiAgICB2YXIgY3VycmVudE93bmVyID0gUmVhY3RDdXJyZW50T3duZXIuY3VycmVudDtcbiAgICB2YXIgaWQgPSBjdXJyZW50T3duZXIgJiYgY3VycmVudE93bmVyLl9kZWJ1Z0lEO1xuXG4gICAgaW5mbyArPSBSZWFjdENvbXBvbmVudFRyZWVIb29rLmdldFN0YWNrQWRkZW5kdW1CeUlEKGlkKTtcbiAgICByZXR1cm4gaW5mbztcbiAgfSxcbiAgZ2V0U3RhY2tBZGRlbmR1bUJ5SUQ6IGZ1bmN0aW9uIChpZCkge1xuICAgIHZhciBpbmZvID0gJyc7XG4gICAgd2hpbGUgKGlkKSB7XG4gICAgICBpbmZvICs9IGRlc2NyaWJlSUQoaWQpO1xuICAgICAgaWQgPSBSZWFjdENvbXBvbmVudFRyZWVIb29rLmdldFBhcmVudElEKGlkKTtcbiAgICB9XG4gICAgcmV0dXJuIGluZm87XG4gIH0sXG4gIGdldENoaWxkSURzOiBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIgaXRlbSA9IGdldEl0ZW0oaWQpO1xuICAgIHJldHVybiBpdGVtID8gaXRlbS5jaGlsZElEcyA6IFtdO1xuICB9LFxuICBnZXREaXNwbGF5TmFtZTogZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIGVsZW1lbnQgPSBSZWFjdENvbXBvbmVudFRyZWVIb29rLmdldEVsZW1lbnQoaWQpO1xuICAgIGlmICghZWxlbWVudCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHJldHVybiBnZXREaXNwbGF5TmFtZShlbGVtZW50KTtcbiAgfSxcbiAgZ2V0RWxlbWVudDogZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIGl0ZW0gPSBnZXRJdGVtKGlkKTtcbiAgICByZXR1cm4gaXRlbSA/IGl0ZW0uZWxlbWVudCA6IG51bGw7XG4gIH0sXG4gIGdldE93bmVySUQ6IGZ1bmN0aW9uIChpZCkge1xuICAgIHZhciBlbGVtZW50ID0gUmVhY3RDb21wb25lbnRUcmVlSG9vay5nZXRFbGVtZW50KGlkKTtcbiAgICBpZiAoIWVsZW1lbnQgfHwgIWVsZW1lbnQuX293bmVyKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIGVsZW1lbnQuX293bmVyLl9kZWJ1Z0lEO1xuICB9LFxuICBnZXRQYXJlbnRJRDogZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIGl0ZW0gPSBnZXRJdGVtKGlkKTtcbiAgICByZXR1cm4gaXRlbSA/IGl0ZW0ucGFyZW50SUQgOiBudWxsO1xuICB9LFxuICBnZXRTb3VyY2U6IGZ1bmN0aW9uIChpZCkge1xuICAgIHZhciBpdGVtID0gZ2V0SXRlbShpZCk7XG4gICAgdmFyIGVsZW1lbnQgPSBpdGVtID8gaXRlbS5lbGVtZW50IDogbnVsbDtcbiAgICB2YXIgc291cmNlID0gZWxlbWVudCAhPSBudWxsID8gZWxlbWVudC5fc291cmNlIDogbnVsbDtcbiAgICByZXR1cm4gc291cmNlO1xuICB9LFxuICBnZXRUZXh0OiBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIgZWxlbWVudCA9IFJlYWN0Q29tcG9uZW50VHJlZUhvb2suZ2V0RWxlbWVudChpZCk7XG4gICAgaWYgKHR5cGVvZiBlbGVtZW50ID09PSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuIGVsZW1lbnQ7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgZWxlbWVudCA9PT0gJ251bWJlcicpIHtcbiAgICAgIHJldHVybiAnJyArIGVsZW1lbnQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfSxcbiAgZ2V0VXBkYXRlQ291bnQ6IGZ1bmN0aW9uIChpZCkge1xuICAgIHZhciBpdGVtID0gZ2V0SXRlbShpZCk7XG4gICAgcmV0dXJuIGl0ZW0gPyBpdGVtLnVwZGF0ZUNvdW50IDogMDtcbiAgfSxcblxuXG4gIGdldFJvb3RJRHM6IGdldFJvb3RJRHMsXG4gIGdldFJlZ2lzdGVyZWRJRHM6IGdldEl0ZW1JRHMsXG5cbiAgcHVzaE5vblN0YW5kYXJkV2FybmluZ1N0YWNrOiBmdW5jdGlvbiAoaXNDcmVhdGluZ0VsZW1lbnQsIGN1cnJlbnRTb3VyY2UpIHtcbiAgICBpZiAodHlwZW9mIGNvbnNvbGUucmVhY3RTdGFjayAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBzdGFjayA9IFtdO1xuICAgIHZhciBjdXJyZW50T3duZXIgPSBSZWFjdEN1cnJlbnRPd25lci5jdXJyZW50O1xuICAgIHZhciBpZCA9IGN1cnJlbnRPd25lciAmJiBjdXJyZW50T3duZXIuX2RlYnVnSUQ7XG5cbiAgICB0cnkge1xuICAgICAgaWYgKGlzQ3JlYXRpbmdFbGVtZW50KSB7XG4gICAgICAgIHN0YWNrLnB1c2goe1xuICAgICAgICAgIG5hbWU6IGlkID8gUmVhY3RDb21wb25lbnRUcmVlSG9vay5nZXREaXNwbGF5TmFtZShpZCkgOiBudWxsLFxuICAgICAgICAgIGZpbGVOYW1lOiBjdXJyZW50U291cmNlID8gY3VycmVudFNvdXJjZS5maWxlTmFtZSA6IG51bGwsXG4gICAgICAgICAgbGluZU51bWJlcjogY3VycmVudFNvdXJjZSA/IGN1cnJlbnRTb3VyY2UubGluZU51bWJlciA6IG51bGxcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIHdoaWxlIChpZCkge1xuICAgICAgICB2YXIgZWxlbWVudCA9IFJlYWN0Q29tcG9uZW50VHJlZUhvb2suZ2V0RWxlbWVudChpZCk7XG4gICAgICAgIHZhciBwYXJlbnRJRCA9IFJlYWN0Q29tcG9uZW50VHJlZUhvb2suZ2V0UGFyZW50SUQoaWQpO1xuICAgICAgICB2YXIgb3duZXJJRCA9IFJlYWN0Q29tcG9uZW50VHJlZUhvb2suZ2V0T3duZXJJRChpZCk7XG4gICAgICAgIHZhciBvd25lck5hbWUgPSBvd25lcklEID8gUmVhY3RDb21wb25lbnRUcmVlSG9vay5nZXREaXNwbGF5TmFtZShvd25lcklEKSA6IG51bGw7XG4gICAgICAgIHZhciBzb3VyY2UgPSBlbGVtZW50ICYmIGVsZW1lbnQuX3NvdXJjZTtcbiAgICAgICAgc3RhY2sucHVzaCh7XG4gICAgICAgICAgbmFtZTogb3duZXJOYW1lLFxuICAgICAgICAgIGZpbGVOYW1lOiBzb3VyY2UgPyBzb3VyY2UuZmlsZU5hbWUgOiBudWxsLFxuICAgICAgICAgIGxpbmVOdW1iZXI6IHNvdXJjZSA/IHNvdXJjZS5saW5lTnVtYmVyIDogbnVsbFxuICAgICAgICB9KTtcbiAgICAgICAgaWQgPSBwYXJlbnRJRDtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIC8vIEludGVybmFsIHN0YXRlIGlzIG1lc3NlZCB1cC5cbiAgICAgIC8vIFN0b3AgYnVpbGRpbmcgdGhlIHN0YWNrIChpdCdzIGp1c3QgYSBuaWNlIHRvIGhhdmUpLlxuICAgIH1cblxuICAgIGNvbnNvbGUucmVhY3RTdGFjayhzdGFjayk7XG4gIH0sXG4gIHBvcE5vblN0YW5kYXJkV2FybmluZ1N0YWNrOiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHR5cGVvZiBjb25zb2xlLnJlYWN0U3RhY2tFbmQgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc29sZS5yZWFjdFN0YWNrRW5kKCk7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUmVhY3RDb21wb25lbnRUcmVlSG9vazsiLCIvKipcbiAqIENvcHlyaWdodCAyMDEzLXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqXG4gKiBcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbi8qKlxuICogS2VlcHMgdHJhY2sgb2YgdGhlIGN1cnJlbnQgb3duZXIuXG4gKlxuICogVGhlIGN1cnJlbnQgb3duZXIgaXMgdGhlIGNvbXBvbmVudCB3aG8gc2hvdWxkIG93biBhbnkgY29tcG9uZW50cyB0aGF0IGFyZVxuICogY3VycmVudGx5IGJlaW5nIGNvbnN0cnVjdGVkLlxuICovXG52YXIgUmVhY3RDdXJyZW50T3duZXIgPSB7XG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICogQHR5cGUge1JlYWN0Q29tcG9uZW50fVxuICAgKi9cbiAgY3VycmVudDogbnVsbFxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBSZWFjdEN1cnJlbnRPd25lcjsiLCIvKipcbiAqIENvcHlyaWdodCAyMDEzLXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgUmVhY3RFbGVtZW50ID0gcmVxdWlyZSgnLi9SZWFjdEVsZW1lbnQnKTtcblxuLyoqXG4gKiBDcmVhdGUgYSBmYWN0b3J5IHRoYXQgY3JlYXRlcyBIVE1MIHRhZyBlbGVtZW50cy5cbiAqXG4gKiBAcHJpdmF0ZVxuICovXG52YXIgY3JlYXRlRE9NRmFjdG9yeSA9IFJlYWN0RWxlbWVudC5jcmVhdGVGYWN0b3J5O1xuaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgdmFyIFJlYWN0RWxlbWVudFZhbGlkYXRvciA9IHJlcXVpcmUoJy4vUmVhY3RFbGVtZW50VmFsaWRhdG9yJyk7XG4gIGNyZWF0ZURPTUZhY3RvcnkgPSBSZWFjdEVsZW1lbnRWYWxpZGF0b3IuY3JlYXRlRmFjdG9yeTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgbWFwcGluZyBmcm9tIHN1cHBvcnRlZCBIVE1MIHRhZ3MgdG8gYFJlYWN0RE9NQ29tcG9uZW50YCBjbGFzc2VzLlxuICpcbiAqIEBwdWJsaWNcbiAqL1xudmFyIFJlYWN0RE9NRmFjdG9yaWVzID0ge1xuICBhOiBjcmVhdGVET01GYWN0b3J5KCdhJyksXG4gIGFiYnI6IGNyZWF0ZURPTUZhY3RvcnkoJ2FiYnInKSxcbiAgYWRkcmVzczogY3JlYXRlRE9NRmFjdG9yeSgnYWRkcmVzcycpLFxuICBhcmVhOiBjcmVhdGVET01GYWN0b3J5KCdhcmVhJyksXG4gIGFydGljbGU6IGNyZWF0ZURPTUZhY3RvcnkoJ2FydGljbGUnKSxcbiAgYXNpZGU6IGNyZWF0ZURPTUZhY3RvcnkoJ2FzaWRlJyksXG4gIGF1ZGlvOiBjcmVhdGVET01GYWN0b3J5KCdhdWRpbycpLFxuICBiOiBjcmVhdGVET01GYWN0b3J5KCdiJyksXG4gIGJhc2U6IGNyZWF0ZURPTUZhY3RvcnkoJ2Jhc2UnKSxcbiAgYmRpOiBjcmVhdGVET01GYWN0b3J5KCdiZGknKSxcbiAgYmRvOiBjcmVhdGVET01GYWN0b3J5KCdiZG8nKSxcbiAgYmlnOiBjcmVhdGVET01GYWN0b3J5KCdiaWcnKSxcbiAgYmxvY2txdW90ZTogY3JlYXRlRE9NRmFjdG9yeSgnYmxvY2txdW90ZScpLFxuICBib2R5OiBjcmVhdGVET01GYWN0b3J5KCdib2R5JyksXG4gIGJyOiBjcmVhdGVET01GYWN0b3J5KCdicicpLFxuICBidXR0b246IGNyZWF0ZURPTUZhY3RvcnkoJ2J1dHRvbicpLFxuICBjYW52YXM6IGNyZWF0ZURPTUZhY3RvcnkoJ2NhbnZhcycpLFxuICBjYXB0aW9uOiBjcmVhdGVET01GYWN0b3J5KCdjYXB0aW9uJyksXG4gIGNpdGU6IGNyZWF0ZURPTUZhY3RvcnkoJ2NpdGUnKSxcbiAgY29kZTogY3JlYXRlRE9NRmFjdG9yeSgnY29kZScpLFxuICBjb2w6IGNyZWF0ZURPTUZhY3RvcnkoJ2NvbCcpLFxuICBjb2xncm91cDogY3JlYXRlRE9NRmFjdG9yeSgnY29sZ3JvdXAnKSxcbiAgZGF0YTogY3JlYXRlRE9NRmFjdG9yeSgnZGF0YScpLFxuICBkYXRhbGlzdDogY3JlYXRlRE9NRmFjdG9yeSgnZGF0YWxpc3QnKSxcbiAgZGQ6IGNyZWF0ZURPTUZhY3RvcnkoJ2RkJyksXG4gIGRlbDogY3JlYXRlRE9NRmFjdG9yeSgnZGVsJyksXG4gIGRldGFpbHM6IGNyZWF0ZURPTUZhY3RvcnkoJ2RldGFpbHMnKSxcbiAgZGZuOiBjcmVhdGVET01GYWN0b3J5KCdkZm4nKSxcbiAgZGlhbG9nOiBjcmVhdGVET01GYWN0b3J5KCdkaWFsb2cnKSxcbiAgZGl2OiBjcmVhdGVET01GYWN0b3J5KCdkaXYnKSxcbiAgZGw6IGNyZWF0ZURPTUZhY3RvcnkoJ2RsJyksXG4gIGR0OiBjcmVhdGVET01GYWN0b3J5KCdkdCcpLFxuICBlbTogY3JlYXRlRE9NRmFjdG9yeSgnZW0nKSxcbiAgZW1iZWQ6IGNyZWF0ZURPTUZhY3RvcnkoJ2VtYmVkJyksXG4gIGZpZWxkc2V0OiBjcmVhdGVET01GYWN0b3J5KCdmaWVsZHNldCcpLFxuICBmaWdjYXB0aW9uOiBjcmVhdGVET01GYWN0b3J5KCdmaWdjYXB0aW9uJyksXG4gIGZpZ3VyZTogY3JlYXRlRE9NRmFjdG9yeSgnZmlndXJlJyksXG4gIGZvb3RlcjogY3JlYXRlRE9NRmFjdG9yeSgnZm9vdGVyJyksXG4gIGZvcm06IGNyZWF0ZURPTUZhY3RvcnkoJ2Zvcm0nKSxcbiAgaDE6IGNyZWF0ZURPTUZhY3RvcnkoJ2gxJyksXG4gIGgyOiBjcmVhdGVET01GYWN0b3J5KCdoMicpLFxuICBoMzogY3JlYXRlRE9NRmFjdG9yeSgnaDMnKSxcbiAgaDQ6IGNyZWF0ZURPTUZhY3RvcnkoJ2g0JyksXG4gIGg1OiBjcmVhdGVET01GYWN0b3J5KCdoNScpLFxuICBoNjogY3JlYXRlRE9NRmFjdG9yeSgnaDYnKSxcbiAgaGVhZDogY3JlYXRlRE9NRmFjdG9yeSgnaGVhZCcpLFxuICBoZWFkZXI6IGNyZWF0ZURPTUZhY3RvcnkoJ2hlYWRlcicpLFxuICBoZ3JvdXA6IGNyZWF0ZURPTUZhY3RvcnkoJ2hncm91cCcpLFxuICBocjogY3JlYXRlRE9NRmFjdG9yeSgnaHInKSxcbiAgaHRtbDogY3JlYXRlRE9NRmFjdG9yeSgnaHRtbCcpLFxuICBpOiBjcmVhdGVET01GYWN0b3J5KCdpJyksXG4gIGlmcmFtZTogY3JlYXRlRE9NRmFjdG9yeSgnaWZyYW1lJyksXG4gIGltZzogY3JlYXRlRE9NRmFjdG9yeSgnaW1nJyksXG4gIGlucHV0OiBjcmVhdGVET01GYWN0b3J5KCdpbnB1dCcpLFxuICBpbnM6IGNyZWF0ZURPTUZhY3RvcnkoJ2lucycpLFxuICBrYmQ6IGNyZWF0ZURPTUZhY3RvcnkoJ2tiZCcpLFxuICBrZXlnZW46IGNyZWF0ZURPTUZhY3RvcnkoJ2tleWdlbicpLFxuICBsYWJlbDogY3JlYXRlRE9NRmFjdG9yeSgnbGFiZWwnKSxcbiAgbGVnZW5kOiBjcmVhdGVET01GYWN0b3J5KCdsZWdlbmQnKSxcbiAgbGk6IGNyZWF0ZURPTUZhY3RvcnkoJ2xpJyksXG4gIGxpbms6IGNyZWF0ZURPTUZhY3RvcnkoJ2xpbmsnKSxcbiAgbWFpbjogY3JlYXRlRE9NRmFjdG9yeSgnbWFpbicpLFxuICBtYXA6IGNyZWF0ZURPTUZhY3RvcnkoJ21hcCcpLFxuICBtYXJrOiBjcmVhdGVET01GYWN0b3J5KCdtYXJrJyksXG4gIG1lbnU6IGNyZWF0ZURPTUZhY3RvcnkoJ21lbnUnKSxcbiAgbWVudWl0ZW06IGNyZWF0ZURPTUZhY3RvcnkoJ21lbnVpdGVtJyksXG4gIG1ldGE6IGNyZWF0ZURPTUZhY3RvcnkoJ21ldGEnKSxcbiAgbWV0ZXI6IGNyZWF0ZURPTUZhY3RvcnkoJ21ldGVyJyksXG4gIG5hdjogY3JlYXRlRE9NRmFjdG9yeSgnbmF2JyksXG4gIG5vc2NyaXB0OiBjcmVhdGVET01GYWN0b3J5KCdub3NjcmlwdCcpLFxuICBvYmplY3Q6IGNyZWF0ZURPTUZhY3RvcnkoJ29iamVjdCcpLFxuICBvbDogY3JlYXRlRE9NRmFjdG9yeSgnb2wnKSxcbiAgb3B0Z3JvdXA6IGNyZWF0ZURPTUZhY3RvcnkoJ29wdGdyb3VwJyksXG4gIG9wdGlvbjogY3JlYXRlRE9NRmFjdG9yeSgnb3B0aW9uJyksXG4gIG91dHB1dDogY3JlYXRlRE9NRmFjdG9yeSgnb3V0cHV0JyksXG4gIHA6IGNyZWF0ZURPTUZhY3RvcnkoJ3AnKSxcbiAgcGFyYW06IGNyZWF0ZURPTUZhY3RvcnkoJ3BhcmFtJyksXG4gIHBpY3R1cmU6IGNyZWF0ZURPTUZhY3RvcnkoJ3BpY3R1cmUnKSxcbiAgcHJlOiBjcmVhdGVET01GYWN0b3J5KCdwcmUnKSxcbiAgcHJvZ3Jlc3M6IGNyZWF0ZURPTUZhY3RvcnkoJ3Byb2dyZXNzJyksXG4gIHE6IGNyZWF0ZURPTUZhY3RvcnkoJ3EnKSxcbiAgcnA6IGNyZWF0ZURPTUZhY3RvcnkoJ3JwJyksXG4gIHJ0OiBjcmVhdGVET01GYWN0b3J5KCdydCcpLFxuICBydWJ5OiBjcmVhdGVET01GYWN0b3J5KCdydWJ5JyksXG4gIHM6IGNyZWF0ZURPTUZhY3RvcnkoJ3MnKSxcbiAgc2FtcDogY3JlYXRlRE9NRmFjdG9yeSgnc2FtcCcpLFxuICBzY3JpcHQ6IGNyZWF0ZURPTUZhY3RvcnkoJ3NjcmlwdCcpLFxuICBzZWN0aW9uOiBjcmVhdGVET01GYWN0b3J5KCdzZWN0aW9uJyksXG4gIHNlbGVjdDogY3JlYXRlRE9NRmFjdG9yeSgnc2VsZWN0JyksXG4gIHNtYWxsOiBjcmVhdGVET01GYWN0b3J5KCdzbWFsbCcpLFxuICBzb3VyY2U6IGNyZWF0ZURPTUZhY3RvcnkoJ3NvdXJjZScpLFxuICBzcGFuOiBjcmVhdGVET01GYWN0b3J5KCdzcGFuJyksXG4gIHN0cm9uZzogY3JlYXRlRE9NRmFjdG9yeSgnc3Ryb25nJyksXG4gIHN0eWxlOiBjcmVhdGVET01GYWN0b3J5KCdzdHlsZScpLFxuICBzdWI6IGNyZWF0ZURPTUZhY3RvcnkoJ3N1YicpLFxuICBzdW1tYXJ5OiBjcmVhdGVET01GYWN0b3J5KCdzdW1tYXJ5JyksXG4gIHN1cDogY3JlYXRlRE9NRmFjdG9yeSgnc3VwJyksXG4gIHRhYmxlOiBjcmVhdGVET01GYWN0b3J5KCd0YWJsZScpLFxuICB0Ym9keTogY3JlYXRlRE9NRmFjdG9yeSgndGJvZHknKSxcbiAgdGQ6IGNyZWF0ZURPTUZhY3RvcnkoJ3RkJyksXG4gIHRleHRhcmVhOiBjcmVhdGVET01GYWN0b3J5KCd0ZXh0YXJlYScpLFxuICB0Zm9vdDogY3JlYXRlRE9NRmFjdG9yeSgndGZvb3QnKSxcbiAgdGg6IGNyZWF0ZURPTUZhY3RvcnkoJ3RoJyksXG4gIHRoZWFkOiBjcmVhdGVET01GYWN0b3J5KCd0aGVhZCcpLFxuICB0aW1lOiBjcmVhdGVET01GYWN0b3J5KCd0aW1lJyksXG4gIHRpdGxlOiBjcmVhdGVET01GYWN0b3J5KCd0aXRsZScpLFxuICB0cjogY3JlYXRlRE9NRmFjdG9yeSgndHInKSxcbiAgdHJhY2s6IGNyZWF0ZURPTUZhY3RvcnkoJ3RyYWNrJyksXG4gIHU6IGNyZWF0ZURPTUZhY3RvcnkoJ3UnKSxcbiAgdWw6IGNyZWF0ZURPTUZhY3RvcnkoJ3VsJyksXG4gICd2YXInOiBjcmVhdGVET01GYWN0b3J5KCd2YXInKSxcbiAgdmlkZW86IGNyZWF0ZURPTUZhY3RvcnkoJ3ZpZGVvJyksXG4gIHdicjogY3JlYXRlRE9NRmFjdG9yeSgnd2JyJyksXG5cbiAgLy8gU1ZHXG4gIGNpcmNsZTogY3JlYXRlRE9NRmFjdG9yeSgnY2lyY2xlJyksXG4gIGNsaXBQYXRoOiBjcmVhdGVET01GYWN0b3J5KCdjbGlwUGF0aCcpLFxuICBkZWZzOiBjcmVhdGVET01GYWN0b3J5KCdkZWZzJyksXG4gIGVsbGlwc2U6IGNyZWF0ZURPTUZhY3RvcnkoJ2VsbGlwc2UnKSxcbiAgZzogY3JlYXRlRE9NRmFjdG9yeSgnZycpLFxuICBpbWFnZTogY3JlYXRlRE9NRmFjdG9yeSgnaW1hZ2UnKSxcbiAgbGluZTogY3JlYXRlRE9NRmFjdG9yeSgnbGluZScpLFxuICBsaW5lYXJHcmFkaWVudDogY3JlYXRlRE9NRmFjdG9yeSgnbGluZWFyR3JhZGllbnQnKSxcbiAgbWFzazogY3JlYXRlRE9NRmFjdG9yeSgnbWFzaycpLFxuICBwYXRoOiBjcmVhdGVET01GYWN0b3J5KCdwYXRoJyksXG4gIHBhdHRlcm46IGNyZWF0ZURPTUZhY3RvcnkoJ3BhdHRlcm4nKSxcbiAgcG9seWdvbjogY3JlYXRlRE9NRmFjdG9yeSgncG9seWdvbicpLFxuICBwb2x5bGluZTogY3JlYXRlRE9NRmFjdG9yeSgncG9seWxpbmUnKSxcbiAgcmFkaWFsR3JhZGllbnQ6IGNyZWF0ZURPTUZhY3RvcnkoJ3JhZGlhbEdyYWRpZW50JyksXG4gIHJlY3Q6IGNyZWF0ZURPTUZhY3RvcnkoJ3JlY3QnKSxcbiAgc3RvcDogY3JlYXRlRE9NRmFjdG9yeSgnc3RvcCcpLFxuICBzdmc6IGNyZWF0ZURPTUZhY3RvcnkoJ3N2ZycpLFxuICB0ZXh0OiBjcmVhdGVET01GYWN0b3J5KCd0ZXh0JyksXG4gIHRzcGFuOiBjcmVhdGVET01GYWN0b3J5KCd0c3BhbicpXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFJlYWN0RE9NRmFjdG9yaWVzOyIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTQtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICpcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBfYXNzaWduID0gcmVxdWlyZSgnb2JqZWN0LWFzc2lnbicpO1xuXG52YXIgUmVhY3RDdXJyZW50T3duZXIgPSByZXF1aXJlKCcuL1JlYWN0Q3VycmVudE93bmVyJyk7XG5cbnZhciB3YXJuaW5nID0gcmVxdWlyZSgnZmJqcy9saWIvd2FybmluZycpO1xudmFyIGNhbkRlZmluZVByb3BlcnR5ID0gcmVxdWlyZSgnLi9jYW5EZWZpbmVQcm9wZXJ0eScpO1xudmFyIGhhc093blByb3BlcnR5ID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcblxudmFyIFJFQUNUX0VMRU1FTlRfVFlQRSA9IHJlcXVpcmUoJy4vUmVhY3RFbGVtZW50U3ltYm9sJyk7XG5cbnZhciBSRVNFUlZFRF9QUk9QUyA9IHtcbiAga2V5OiB0cnVlLFxuICByZWY6IHRydWUsXG4gIF9fc2VsZjogdHJ1ZSxcbiAgX19zb3VyY2U6IHRydWVcbn07XG5cbnZhciBzcGVjaWFsUHJvcEtleVdhcm5pbmdTaG93biwgc3BlY2lhbFByb3BSZWZXYXJuaW5nU2hvd247XG5cbmZ1bmN0aW9uIGhhc1ZhbGlkUmVmKGNvbmZpZykge1xuICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgIGlmIChoYXNPd25Qcm9wZXJ0eS5jYWxsKGNvbmZpZywgJ3JlZicpKSB7XG4gICAgICB2YXIgZ2V0dGVyID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihjb25maWcsICdyZWYnKS5nZXQ7XG4gICAgICBpZiAoZ2V0dGVyICYmIGdldHRlci5pc1JlYWN0V2FybmluZykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBjb25maWcucmVmICE9PSB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIGhhc1ZhbGlkS2V5KGNvbmZpZykge1xuICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgIGlmIChoYXNPd25Qcm9wZXJ0eS5jYWxsKGNvbmZpZywgJ2tleScpKSB7XG4gICAgICB2YXIgZ2V0dGVyID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihjb25maWcsICdrZXknKS5nZXQ7XG4gICAgICBpZiAoZ2V0dGVyICYmIGdldHRlci5pc1JlYWN0V2FybmluZykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBjb25maWcua2V5ICE9PSB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIGRlZmluZUtleVByb3BXYXJuaW5nR2V0dGVyKHByb3BzLCBkaXNwbGF5TmFtZSkge1xuICB2YXIgd2FybkFib3V0QWNjZXNzaW5nS2V5ID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICghc3BlY2lhbFByb3BLZXlXYXJuaW5nU2hvd24pIHtcbiAgICAgIHNwZWNpYWxQcm9wS2V5V2FybmluZ1Nob3duID0gdHJ1ZTtcbiAgICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyB3YXJuaW5nKGZhbHNlLCAnJXM6IGBrZXlgIGlzIG5vdCBhIHByb3AuIFRyeWluZyB0byBhY2Nlc3MgaXQgd2lsbCByZXN1bHQgJyArICdpbiBgdW5kZWZpbmVkYCBiZWluZyByZXR1cm5lZC4gSWYgeW91IG5lZWQgdG8gYWNjZXNzIHRoZSBzYW1lICcgKyAndmFsdWUgd2l0aGluIHRoZSBjaGlsZCBjb21wb25lbnQsIHlvdSBzaG91bGQgcGFzcyBpdCBhcyBhIGRpZmZlcmVudCAnICsgJ3Byb3AuIChodHRwczovL2ZiLm1lL3JlYWN0LXNwZWNpYWwtcHJvcHMpJywgZGlzcGxheU5hbWUpIDogdm9pZCAwO1xuICAgIH1cbiAgfTtcbiAgd2FybkFib3V0QWNjZXNzaW5nS2V5LmlzUmVhY3RXYXJuaW5nID0gdHJ1ZTtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3BzLCAna2V5Jywge1xuICAgIGdldDogd2FybkFib3V0QWNjZXNzaW5nS2V5LFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICB9KTtcbn1cblxuZnVuY3Rpb24gZGVmaW5lUmVmUHJvcFdhcm5pbmdHZXR0ZXIocHJvcHMsIGRpc3BsYXlOYW1lKSB7XG4gIHZhciB3YXJuQWJvdXRBY2Nlc3NpbmdSZWYgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKCFzcGVjaWFsUHJvcFJlZldhcm5pbmdTaG93bikge1xuICAgICAgc3BlY2lhbFByb3BSZWZXYXJuaW5nU2hvd24gPSB0cnVlO1xuICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/IHdhcm5pbmcoZmFsc2UsICclczogYHJlZmAgaXMgbm90IGEgcHJvcC4gVHJ5aW5nIHRvIGFjY2VzcyBpdCB3aWxsIHJlc3VsdCAnICsgJ2luIGB1bmRlZmluZWRgIGJlaW5nIHJldHVybmVkLiBJZiB5b3UgbmVlZCB0byBhY2Nlc3MgdGhlIHNhbWUgJyArICd2YWx1ZSB3aXRoaW4gdGhlIGNoaWxkIGNvbXBvbmVudCwgeW91IHNob3VsZCBwYXNzIGl0IGFzIGEgZGlmZmVyZW50ICcgKyAncHJvcC4gKGh0dHBzOi8vZmIubWUvcmVhY3Qtc3BlY2lhbC1wcm9wcyknLCBkaXNwbGF5TmFtZSkgOiB2b2lkIDA7XG4gICAgfVxuICB9O1xuICB3YXJuQWJvdXRBY2Nlc3NpbmdSZWYuaXNSZWFjdFdhcm5pbmcgPSB0cnVlO1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkocHJvcHMsICdyZWYnLCB7XG4gICAgZ2V0OiB3YXJuQWJvdXRBY2Nlc3NpbmdSZWYsXG4gICAgY29uZmlndXJhYmxlOiB0cnVlXG4gIH0pO1xufVxuXG4vKipcbiAqIEZhY3RvcnkgbWV0aG9kIHRvIGNyZWF0ZSBhIG5ldyBSZWFjdCBlbGVtZW50LiBUaGlzIG5vIGxvbmdlciBhZGhlcmVzIHRvXG4gKiB0aGUgY2xhc3MgcGF0dGVybiwgc28gZG8gbm90IHVzZSBuZXcgdG8gY2FsbCBpdC4gQWxzbywgbm8gaW5zdGFuY2VvZiBjaGVja1xuICogd2lsbCB3b3JrLiBJbnN0ZWFkIHRlc3QgJCR0eXBlb2YgZmllbGQgYWdhaW5zdCBTeW1ib2wuZm9yKCdyZWFjdC5lbGVtZW50JykgdG8gY2hlY2tcbiAqIGlmIHNvbWV0aGluZyBpcyBhIFJlYWN0IEVsZW1lbnQuXG4gKlxuICogQHBhcmFtIHsqfSB0eXBlXG4gKiBAcGFyYW0geyp9IGtleVxuICogQHBhcmFtIHtzdHJpbmd8b2JqZWN0fSByZWZcbiAqIEBwYXJhbSB7Kn0gc2VsZiBBICp0ZW1wb3JhcnkqIGhlbHBlciB0byBkZXRlY3QgcGxhY2VzIHdoZXJlIGB0aGlzYCBpc1xuICogZGlmZmVyZW50IGZyb20gdGhlIGBvd25lcmAgd2hlbiBSZWFjdC5jcmVhdGVFbGVtZW50IGlzIGNhbGxlZCwgc28gdGhhdCB3ZVxuICogY2FuIHdhcm4uIFdlIHdhbnQgdG8gZ2V0IHJpZCBvZiBvd25lciBhbmQgcmVwbGFjZSBzdHJpbmcgYHJlZmBzIHdpdGggYXJyb3dcbiAqIGZ1bmN0aW9ucywgYW5kIGFzIGxvbmcgYXMgYHRoaXNgIGFuZCBvd25lciBhcmUgdGhlIHNhbWUsIHRoZXJlIHdpbGwgYmUgbm9cbiAqIGNoYW5nZSBpbiBiZWhhdmlvci5cbiAqIEBwYXJhbSB7Kn0gc291cmNlIEFuIGFubm90YXRpb24gb2JqZWN0IChhZGRlZCBieSBhIHRyYW5zcGlsZXIgb3Igb3RoZXJ3aXNlKVxuICogaW5kaWNhdGluZyBmaWxlbmFtZSwgbGluZSBudW1iZXIsIGFuZC9vciBvdGhlciBpbmZvcm1hdGlvbi5cbiAqIEBwYXJhbSB7Kn0gb3duZXJcbiAqIEBwYXJhbSB7Kn0gcHJvcHNcbiAqIEBpbnRlcm5hbFxuICovXG52YXIgUmVhY3RFbGVtZW50ID0gZnVuY3Rpb24gKHR5cGUsIGtleSwgcmVmLCBzZWxmLCBzb3VyY2UsIG93bmVyLCBwcm9wcykge1xuICB2YXIgZWxlbWVudCA9IHtcbiAgICAvLyBUaGlzIHRhZyBhbGxvdyB1cyB0byB1bmlxdWVseSBpZGVudGlmeSB0aGlzIGFzIGEgUmVhY3QgRWxlbWVudFxuICAgICQkdHlwZW9mOiBSRUFDVF9FTEVNRU5UX1RZUEUsXG5cbiAgICAvLyBCdWlsdC1pbiBwcm9wZXJ0aWVzIHRoYXQgYmVsb25nIG9uIHRoZSBlbGVtZW50XG4gICAgdHlwZTogdHlwZSxcbiAgICBrZXk6IGtleSxcbiAgICByZWY6IHJlZixcbiAgICBwcm9wczogcHJvcHMsXG5cbiAgICAvLyBSZWNvcmQgdGhlIGNvbXBvbmVudCByZXNwb25zaWJsZSBmb3IgY3JlYXRpbmcgdGhpcyBlbGVtZW50LlxuICAgIF9vd25lcjogb3duZXJcbiAgfTtcblxuICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgIC8vIFRoZSB2YWxpZGF0aW9uIGZsYWcgaXMgY3VycmVudGx5IG11dGF0aXZlLiBXZSBwdXQgaXQgb25cbiAgICAvLyBhbiBleHRlcm5hbCBiYWNraW5nIHN0b3JlIHNvIHRoYXQgd2UgY2FuIGZyZWV6ZSB0aGUgd2hvbGUgb2JqZWN0LlxuICAgIC8vIFRoaXMgY2FuIGJlIHJlcGxhY2VkIHdpdGggYSBXZWFrTWFwIG9uY2UgdGhleSBhcmUgaW1wbGVtZW50ZWQgaW5cbiAgICAvLyBjb21tb25seSB1c2VkIGRldmVsb3BtZW50IGVudmlyb25tZW50cy5cbiAgICBlbGVtZW50Ll9zdG9yZSA9IHt9O1xuXG4gICAgLy8gVG8gbWFrZSBjb21wYXJpbmcgUmVhY3RFbGVtZW50cyBlYXNpZXIgZm9yIHRlc3RpbmcgcHVycG9zZXMsIHdlIG1ha2VcbiAgICAvLyB0aGUgdmFsaWRhdGlvbiBmbGFnIG5vbi1lbnVtZXJhYmxlICh3aGVyZSBwb3NzaWJsZSwgd2hpY2ggc2hvdWxkXG4gICAgLy8gaW5jbHVkZSBldmVyeSBlbnZpcm9ubWVudCB3ZSBydW4gdGVzdHMgaW4pLCBzbyB0aGUgdGVzdCBmcmFtZXdvcmtcbiAgICAvLyBpZ25vcmVzIGl0LlxuICAgIGlmIChjYW5EZWZpbmVQcm9wZXJ0eSkge1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGVsZW1lbnQuX3N0b3JlLCAndmFsaWRhdGVkJywge1xuICAgICAgICBjb25maWd1cmFibGU6IGZhbHNlLFxuICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgIHZhbHVlOiBmYWxzZVxuICAgICAgfSk7XG4gICAgICAvLyBzZWxmIGFuZCBzb3VyY2UgYXJlIERFViBvbmx5IHByb3BlcnRpZXMuXG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZWxlbWVudCwgJ19zZWxmJywge1xuICAgICAgICBjb25maWd1cmFibGU6IGZhbHNlLFxuICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICAgICAgd3JpdGFibGU6IGZhbHNlLFxuICAgICAgICB2YWx1ZTogc2VsZlxuICAgICAgfSk7XG4gICAgICAvLyBUd28gZWxlbWVudHMgY3JlYXRlZCBpbiB0d28gZGlmZmVyZW50IHBsYWNlcyBzaG91bGQgYmUgY29uc2lkZXJlZFxuICAgICAgLy8gZXF1YWwgZm9yIHRlc3RpbmcgcHVycG9zZXMgYW5kIHRoZXJlZm9yZSB3ZSBoaWRlIGl0IGZyb20gZW51bWVyYXRpb24uXG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZWxlbWVudCwgJ19zb3VyY2UnLCB7XG4gICAgICAgIGNvbmZpZ3VyYWJsZTogZmFsc2UsXG4gICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgICAgIHZhbHVlOiBzb3VyY2VcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBlbGVtZW50Ll9zdG9yZS52YWxpZGF0ZWQgPSBmYWxzZTtcbiAgICAgIGVsZW1lbnQuX3NlbGYgPSBzZWxmO1xuICAgICAgZWxlbWVudC5fc291cmNlID0gc291cmNlO1xuICAgIH1cbiAgICBpZiAoT2JqZWN0LmZyZWV6ZSkge1xuICAgICAgT2JqZWN0LmZyZWV6ZShlbGVtZW50LnByb3BzKTtcbiAgICAgIE9iamVjdC5mcmVlemUoZWxlbWVudCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGVsZW1lbnQ7XG59O1xuXG4vKipcbiAqIENyZWF0ZSBhbmQgcmV0dXJuIGEgbmV3IFJlYWN0RWxlbWVudCBvZiB0aGUgZ2l2ZW4gdHlwZS5cbiAqIFNlZSBodHRwczovL2ZhY2Vib29rLmdpdGh1Yi5pby9yZWFjdC9kb2NzL3RvcC1sZXZlbC1hcGkuaHRtbCNyZWFjdC5jcmVhdGVlbGVtZW50XG4gKi9cblJlYWN0RWxlbWVudC5jcmVhdGVFbGVtZW50ID0gZnVuY3Rpb24gKHR5cGUsIGNvbmZpZywgY2hpbGRyZW4pIHtcbiAgdmFyIHByb3BOYW1lO1xuXG4gIC8vIFJlc2VydmVkIG5hbWVzIGFyZSBleHRyYWN0ZWRcbiAgdmFyIHByb3BzID0ge307XG5cbiAgdmFyIGtleSA9IG51bGw7XG4gIHZhciByZWYgPSBudWxsO1xuICB2YXIgc2VsZiA9IG51bGw7XG4gIHZhciBzb3VyY2UgPSBudWxsO1xuXG4gIGlmIChjb25maWcgIT0gbnVsbCkge1xuICAgIGlmIChoYXNWYWxpZFJlZihjb25maWcpKSB7XG4gICAgICByZWYgPSBjb25maWcucmVmO1xuICAgIH1cbiAgICBpZiAoaGFzVmFsaWRLZXkoY29uZmlnKSkge1xuICAgICAga2V5ID0gJycgKyBjb25maWcua2V5O1xuICAgIH1cblxuICAgIHNlbGYgPSBjb25maWcuX19zZWxmID09PSB1bmRlZmluZWQgPyBudWxsIDogY29uZmlnLl9fc2VsZjtcbiAgICBzb3VyY2UgPSBjb25maWcuX19zb3VyY2UgPT09IHVuZGVmaW5lZCA/IG51bGwgOiBjb25maWcuX19zb3VyY2U7XG4gICAgLy8gUmVtYWluaW5nIHByb3BlcnRpZXMgYXJlIGFkZGVkIHRvIGEgbmV3IHByb3BzIG9iamVjdFxuICAgIGZvciAocHJvcE5hbWUgaW4gY29uZmlnKSB7XG4gICAgICBpZiAoaGFzT3duUHJvcGVydHkuY2FsbChjb25maWcsIHByb3BOYW1lKSAmJiAhUkVTRVJWRURfUFJPUFMuaGFzT3duUHJvcGVydHkocHJvcE5hbWUpKSB7XG4gICAgICAgIHByb3BzW3Byb3BOYW1lXSA9IGNvbmZpZ1twcm9wTmFtZV07XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gQ2hpbGRyZW4gY2FuIGJlIG1vcmUgdGhhbiBvbmUgYXJndW1lbnQsIGFuZCB0aG9zZSBhcmUgdHJhbnNmZXJyZWQgb250b1xuICAvLyB0aGUgbmV3bHkgYWxsb2NhdGVkIHByb3BzIG9iamVjdC5cbiAgdmFyIGNoaWxkcmVuTGVuZ3RoID0gYXJndW1lbnRzLmxlbmd0aCAtIDI7XG4gIGlmIChjaGlsZHJlbkxlbmd0aCA9PT0gMSkge1xuICAgIHByb3BzLmNoaWxkcmVuID0gY2hpbGRyZW47XG4gIH0gZWxzZSBpZiAoY2hpbGRyZW5MZW5ndGggPiAxKSB7XG4gICAgdmFyIGNoaWxkQXJyYXkgPSBBcnJheShjaGlsZHJlbkxlbmd0aCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGlsZHJlbkxlbmd0aDsgaSsrKSB7XG4gICAgICBjaGlsZEFycmF5W2ldID0gYXJndW1lbnRzW2kgKyAyXTtcbiAgICB9XG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgIGlmIChPYmplY3QuZnJlZXplKSB7XG4gICAgICAgIE9iamVjdC5mcmVlemUoY2hpbGRBcnJheSk7XG4gICAgICB9XG4gICAgfVxuICAgIHByb3BzLmNoaWxkcmVuID0gY2hpbGRBcnJheTtcbiAgfVxuXG4gIC8vIFJlc29sdmUgZGVmYXVsdCBwcm9wc1xuICBpZiAodHlwZSAmJiB0eXBlLmRlZmF1bHRQcm9wcykge1xuICAgIHZhciBkZWZhdWx0UHJvcHMgPSB0eXBlLmRlZmF1bHRQcm9wcztcbiAgICBmb3IgKHByb3BOYW1lIGluIGRlZmF1bHRQcm9wcykge1xuICAgICAgaWYgKHByb3BzW3Byb3BOYW1lXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHByb3BzW3Byb3BOYW1lXSA9IGRlZmF1bHRQcm9wc1twcm9wTmFtZV07XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgaWYgKGtleSB8fCByZWYpIHtcbiAgICAgIGlmICh0eXBlb2YgcHJvcHMuJCR0eXBlb2YgPT09ICd1bmRlZmluZWQnIHx8IHByb3BzLiQkdHlwZW9mICE9PSBSRUFDVF9FTEVNRU5UX1RZUEUpIHtcbiAgICAgICAgdmFyIGRpc3BsYXlOYW1lID0gdHlwZW9mIHR5cGUgPT09ICdmdW5jdGlvbicgPyB0eXBlLmRpc3BsYXlOYW1lIHx8IHR5cGUubmFtZSB8fCAnVW5rbm93bicgOiB0eXBlO1xuICAgICAgICBpZiAoa2V5KSB7XG4gICAgICAgICAgZGVmaW5lS2V5UHJvcFdhcm5pbmdHZXR0ZXIocHJvcHMsIGRpc3BsYXlOYW1lKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocmVmKSB7XG4gICAgICAgICAgZGVmaW5lUmVmUHJvcFdhcm5pbmdHZXR0ZXIocHJvcHMsIGRpc3BsYXlOYW1lKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gUmVhY3RFbGVtZW50KHR5cGUsIGtleSwgcmVmLCBzZWxmLCBzb3VyY2UsIFJlYWN0Q3VycmVudE93bmVyLmN1cnJlbnQsIHByb3BzKTtcbn07XG5cbi8qKlxuICogUmV0dXJuIGEgZnVuY3Rpb24gdGhhdCBwcm9kdWNlcyBSZWFjdEVsZW1lbnRzIG9mIGEgZ2l2ZW4gdHlwZS5cbiAqIFNlZSBodHRwczovL2ZhY2Vib29rLmdpdGh1Yi5pby9yZWFjdC9kb2NzL3RvcC1sZXZlbC1hcGkuaHRtbCNyZWFjdC5jcmVhdGVmYWN0b3J5XG4gKi9cblJlYWN0RWxlbWVudC5jcmVhdGVGYWN0b3J5ID0gZnVuY3Rpb24gKHR5cGUpIHtcbiAgdmFyIGZhY3RvcnkgPSBSZWFjdEVsZW1lbnQuY3JlYXRlRWxlbWVudC5iaW5kKG51bGwsIHR5cGUpO1xuICAvLyBFeHBvc2UgdGhlIHR5cGUgb24gdGhlIGZhY3RvcnkgYW5kIHRoZSBwcm90b3R5cGUgc28gdGhhdCBpdCBjYW4gYmVcbiAgLy8gZWFzaWx5IGFjY2Vzc2VkIG9uIGVsZW1lbnRzLiBFLmcuIGA8Rm9vIC8+LnR5cGUgPT09IEZvb2AuXG4gIC8vIFRoaXMgc2hvdWxkIG5vdCBiZSBuYW1lZCBgY29uc3RydWN0b3JgIHNpbmNlIHRoaXMgbWF5IG5vdCBiZSB0aGUgZnVuY3Rpb25cbiAgLy8gdGhhdCBjcmVhdGVkIHRoZSBlbGVtZW50LCBhbmQgaXQgbWF5IG5vdCBldmVuIGJlIGEgY29uc3RydWN0b3IuXG4gIC8vIExlZ2FjeSBob29rIFRPRE86IFdhcm4gaWYgdGhpcyBpcyBhY2Nlc3NlZFxuICBmYWN0b3J5LnR5cGUgPSB0eXBlO1xuICByZXR1cm4gZmFjdG9yeTtcbn07XG5cblJlYWN0RWxlbWVudC5jbG9uZUFuZFJlcGxhY2VLZXkgPSBmdW5jdGlvbiAob2xkRWxlbWVudCwgbmV3S2V5KSB7XG4gIHZhciBuZXdFbGVtZW50ID0gUmVhY3RFbGVtZW50KG9sZEVsZW1lbnQudHlwZSwgbmV3S2V5LCBvbGRFbGVtZW50LnJlZiwgb2xkRWxlbWVudC5fc2VsZiwgb2xkRWxlbWVudC5fc291cmNlLCBvbGRFbGVtZW50Ll9vd25lciwgb2xkRWxlbWVudC5wcm9wcyk7XG5cbiAgcmV0dXJuIG5ld0VsZW1lbnQ7XG59O1xuXG4vKipcbiAqIENsb25lIGFuZCByZXR1cm4gYSBuZXcgUmVhY3RFbGVtZW50IHVzaW5nIGVsZW1lbnQgYXMgdGhlIHN0YXJ0aW5nIHBvaW50LlxuICogU2VlIGh0dHBzOi8vZmFjZWJvb2suZ2l0aHViLmlvL3JlYWN0L2RvY3MvdG9wLWxldmVsLWFwaS5odG1sI3JlYWN0LmNsb25lZWxlbWVudFxuICovXG5SZWFjdEVsZW1lbnQuY2xvbmVFbGVtZW50ID0gZnVuY3Rpb24gKGVsZW1lbnQsIGNvbmZpZywgY2hpbGRyZW4pIHtcbiAgdmFyIHByb3BOYW1lO1xuXG4gIC8vIE9yaWdpbmFsIHByb3BzIGFyZSBjb3BpZWRcbiAgdmFyIHByb3BzID0gX2Fzc2lnbih7fSwgZWxlbWVudC5wcm9wcyk7XG5cbiAgLy8gUmVzZXJ2ZWQgbmFtZXMgYXJlIGV4dHJhY3RlZFxuICB2YXIga2V5ID0gZWxlbWVudC5rZXk7XG4gIHZhciByZWYgPSBlbGVtZW50LnJlZjtcbiAgLy8gU2VsZiBpcyBwcmVzZXJ2ZWQgc2luY2UgdGhlIG93bmVyIGlzIHByZXNlcnZlZC5cbiAgdmFyIHNlbGYgPSBlbGVtZW50Ll9zZWxmO1xuICAvLyBTb3VyY2UgaXMgcHJlc2VydmVkIHNpbmNlIGNsb25lRWxlbWVudCBpcyB1bmxpa2VseSB0byBiZSB0YXJnZXRlZCBieSBhXG4gIC8vIHRyYW5zcGlsZXIsIGFuZCB0aGUgb3JpZ2luYWwgc291cmNlIGlzIHByb2JhYmx5IGEgYmV0dGVyIGluZGljYXRvciBvZiB0aGVcbiAgLy8gdHJ1ZSBvd25lci5cbiAgdmFyIHNvdXJjZSA9IGVsZW1lbnQuX3NvdXJjZTtcblxuICAvLyBPd25lciB3aWxsIGJlIHByZXNlcnZlZCwgdW5sZXNzIHJlZiBpcyBvdmVycmlkZGVuXG4gIHZhciBvd25lciA9IGVsZW1lbnQuX293bmVyO1xuXG4gIGlmIChjb25maWcgIT0gbnVsbCkge1xuICAgIGlmIChoYXNWYWxpZFJlZihjb25maWcpKSB7XG4gICAgICAvLyBTaWxlbnRseSBzdGVhbCB0aGUgcmVmIGZyb20gdGhlIHBhcmVudC5cbiAgICAgIHJlZiA9IGNvbmZpZy5yZWY7XG4gICAgICBvd25lciA9IFJlYWN0Q3VycmVudE93bmVyLmN1cnJlbnQ7XG4gICAgfVxuICAgIGlmIChoYXNWYWxpZEtleShjb25maWcpKSB7XG4gICAgICBrZXkgPSAnJyArIGNvbmZpZy5rZXk7XG4gICAgfVxuXG4gICAgLy8gUmVtYWluaW5nIHByb3BlcnRpZXMgb3ZlcnJpZGUgZXhpc3RpbmcgcHJvcHNcbiAgICB2YXIgZGVmYXVsdFByb3BzO1xuICAgIGlmIChlbGVtZW50LnR5cGUgJiYgZWxlbWVudC50eXBlLmRlZmF1bHRQcm9wcykge1xuICAgICAgZGVmYXVsdFByb3BzID0gZWxlbWVudC50eXBlLmRlZmF1bHRQcm9wcztcbiAgICB9XG4gICAgZm9yIChwcm9wTmFtZSBpbiBjb25maWcpIHtcbiAgICAgIGlmIChoYXNPd25Qcm9wZXJ0eS5jYWxsKGNvbmZpZywgcHJvcE5hbWUpICYmICFSRVNFUlZFRF9QUk9QUy5oYXNPd25Qcm9wZXJ0eShwcm9wTmFtZSkpIHtcbiAgICAgICAgaWYgKGNvbmZpZ1twcm9wTmFtZV0gPT09IHVuZGVmaW5lZCAmJiBkZWZhdWx0UHJvcHMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIC8vIFJlc29sdmUgZGVmYXVsdCBwcm9wc1xuICAgICAgICAgIHByb3BzW3Byb3BOYW1lXSA9IGRlZmF1bHRQcm9wc1twcm9wTmFtZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcHJvcHNbcHJvcE5hbWVdID0gY29uZmlnW3Byb3BOYW1lXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIENoaWxkcmVuIGNhbiBiZSBtb3JlIHRoYW4gb25lIGFyZ3VtZW50LCBhbmQgdGhvc2UgYXJlIHRyYW5zZmVycmVkIG9udG9cbiAgLy8gdGhlIG5ld2x5IGFsbG9jYXRlZCBwcm9wcyBvYmplY3QuXG4gIHZhciBjaGlsZHJlbkxlbmd0aCA9IGFyZ3VtZW50cy5sZW5ndGggLSAyO1xuICBpZiAoY2hpbGRyZW5MZW5ndGggPT09IDEpIHtcbiAgICBwcm9wcy5jaGlsZHJlbiA9IGNoaWxkcmVuO1xuICB9IGVsc2UgaWYgKGNoaWxkcmVuTGVuZ3RoID4gMSkge1xuICAgIHZhciBjaGlsZEFycmF5ID0gQXJyYXkoY2hpbGRyZW5MZW5ndGgpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hpbGRyZW5MZW5ndGg7IGkrKykge1xuICAgICAgY2hpbGRBcnJheVtpXSA9IGFyZ3VtZW50c1tpICsgMl07XG4gICAgfVxuICAgIHByb3BzLmNoaWxkcmVuID0gY2hpbGRBcnJheTtcbiAgfVxuXG4gIHJldHVybiBSZWFjdEVsZW1lbnQoZWxlbWVudC50eXBlLCBrZXksIHJlZiwgc2VsZiwgc291cmNlLCBvd25lciwgcHJvcHMpO1xufTtcblxuLyoqXG4gKiBWZXJpZmllcyB0aGUgb2JqZWN0IGlzIGEgUmVhY3RFbGVtZW50LlxuICogU2VlIGh0dHBzOi8vZmFjZWJvb2suZ2l0aHViLmlvL3JlYWN0L2RvY3MvdG9wLWxldmVsLWFwaS5odG1sI3JlYWN0LmlzdmFsaWRlbGVtZW50XG4gKiBAcGFyYW0gez9vYmplY3R9IG9iamVjdFxuICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSBpZiBgb2JqZWN0YCBpcyBhIHZhbGlkIGNvbXBvbmVudC5cbiAqIEBmaW5hbFxuICovXG5SZWFjdEVsZW1lbnQuaXNWYWxpZEVsZW1lbnQgPSBmdW5jdGlvbiAob2JqZWN0KSB7XG4gIHJldHVybiB0eXBlb2Ygb2JqZWN0ID09PSAnb2JqZWN0JyAmJiBvYmplY3QgIT09IG51bGwgJiYgb2JqZWN0LiQkdHlwZW9mID09PSBSRUFDVF9FTEVNRU5UX1RZUEU7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFJlYWN0RWxlbWVudDsiLCIvKipcbiAqIENvcHlyaWdodCAyMDE0LXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqXG4gKiBcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbi8vIFRoZSBTeW1ib2wgdXNlZCB0byB0YWcgdGhlIFJlYWN0RWxlbWVudCB0eXBlLiBJZiB0aGVyZSBpcyBubyBuYXRpdmUgU3ltYm9sXG4vLyBub3IgcG9seWZpbGwsIHRoZW4gYSBwbGFpbiBudW1iZXIgaXMgdXNlZCBmb3IgcGVyZm9ybWFuY2UuXG5cbnZhciBSRUFDVF9FTEVNRU5UX1RZUEUgPSB0eXBlb2YgU3ltYm9sID09PSAnZnVuY3Rpb24nICYmIFN5bWJvbFsnZm9yJ10gJiYgU3ltYm9sWydmb3InXSgncmVhY3QuZWxlbWVudCcpIHx8IDB4ZWFjNztcblxubW9kdWxlLmV4cG9ydHMgPSBSRUFDVF9FTEVNRU5UX1RZUEU7IiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNC1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICovXG5cbi8qKlxuICogUmVhY3RFbGVtZW50VmFsaWRhdG9yIHByb3ZpZGVzIGEgd3JhcHBlciBhcm91bmQgYSBlbGVtZW50IGZhY3RvcnlcbiAqIHdoaWNoIHZhbGlkYXRlcyB0aGUgcHJvcHMgcGFzc2VkIHRvIHRoZSBlbGVtZW50LiBUaGlzIGlzIGludGVuZGVkIHRvIGJlXG4gKiB1c2VkIG9ubHkgaW4gREVWIGFuZCBjb3VsZCBiZSByZXBsYWNlZCBieSBhIHN0YXRpYyB0eXBlIGNoZWNrZXIgZm9yIGxhbmd1YWdlc1xuICogdGhhdCBzdXBwb3J0IGl0LlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIFJlYWN0Q3VycmVudE93bmVyID0gcmVxdWlyZSgnLi9SZWFjdEN1cnJlbnRPd25lcicpO1xudmFyIFJlYWN0Q29tcG9uZW50VHJlZUhvb2sgPSByZXF1aXJlKCcuL1JlYWN0Q29tcG9uZW50VHJlZUhvb2snKTtcbnZhciBSZWFjdEVsZW1lbnQgPSByZXF1aXJlKCcuL1JlYWN0RWxlbWVudCcpO1xuXG52YXIgY2hlY2tSZWFjdFR5cGVTcGVjID0gcmVxdWlyZSgnLi9jaGVja1JlYWN0VHlwZVNwZWMnKTtcblxudmFyIGNhbkRlZmluZVByb3BlcnR5ID0gcmVxdWlyZSgnLi9jYW5EZWZpbmVQcm9wZXJ0eScpO1xudmFyIGdldEl0ZXJhdG9yRm4gPSByZXF1aXJlKCcuL2dldEl0ZXJhdG9yRm4nKTtcbnZhciB3YXJuaW5nID0gcmVxdWlyZSgnZmJqcy9saWIvd2FybmluZycpO1xudmFyIGxvd1ByaW9yaXR5V2FybmluZyA9IHJlcXVpcmUoJy4vbG93UHJpb3JpdHlXYXJuaW5nJyk7XG5cbmZ1bmN0aW9uIGdldERlY2xhcmF0aW9uRXJyb3JBZGRlbmR1bSgpIHtcbiAgaWYgKFJlYWN0Q3VycmVudE93bmVyLmN1cnJlbnQpIHtcbiAgICB2YXIgbmFtZSA9IFJlYWN0Q3VycmVudE93bmVyLmN1cnJlbnQuZ2V0TmFtZSgpO1xuICAgIGlmIChuYW1lKSB7XG4gICAgICByZXR1cm4gJyBDaGVjayB0aGUgcmVuZGVyIG1ldGhvZCBvZiBgJyArIG5hbWUgKyAnYC4nO1xuICAgIH1cbiAgfVxuICByZXR1cm4gJyc7XG59XG5cbmZ1bmN0aW9uIGdldFNvdXJjZUluZm9FcnJvckFkZGVuZHVtKGVsZW1lbnRQcm9wcykge1xuICBpZiAoZWxlbWVudFByb3BzICE9PSBudWxsICYmIGVsZW1lbnRQcm9wcyAhPT0gdW5kZWZpbmVkICYmIGVsZW1lbnRQcm9wcy5fX3NvdXJjZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgdmFyIHNvdXJjZSA9IGVsZW1lbnRQcm9wcy5fX3NvdXJjZTtcbiAgICB2YXIgZmlsZU5hbWUgPSBzb3VyY2UuZmlsZU5hbWUucmVwbGFjZSgvXi4qW1xcXFxcXC9dLywgJycpO1xuICAgIHZhciBsaW5lTnVtYmVyID0gc291cmNlLmxpbmVOdW1iZXI7XG4gICAgcmV0dXJuICcgQ2hlY2sgeW91ciBjb2RlIGF0ICcgKyBmaWxlTmFtZSArICc6JyArIGxpbmVOdW1iZXIgKyAnLic7XG4gIH1cbiAgcmV0dXJuICcnO1xufVxuXG4vKipcbiAqIFdhcm4gaWYgdGhlcmUncyBubyBrZXkgZXhwbGljaXRseSBzZXQgb24gZHluYW1pYyBhcnJheXMgb2YgY2hpbGRyZW4gb3JcbiAqIG9iamVjdCBrZXlzIGFyZSBub3QgdmFsaWQuIFRoaXMgYWxsb3dzIHVzIHRvIGtlZXAgdHJhY2sgb2YgY2hpbGRyZW4gYmV0d2VlblxuICogdXBkYXRlcy5cbiAqL1xudmFyIG93bmVySGFzS2V5VXNlV2FybmluZyA9IHt9O1xuXG5mdW5jdGlvbiBnZXRDdXJyZW50Q29tcG9uZW50RXJyb3JJbmZvKHBhcmVudFR5cGUpIHtcbiAgdmFyIGluZm8gPSBnZXREZWNsYXJhdGlvbkVycm9yQWRkZW5kdW0oKTtcblxuICBpZiAoIWluZm8pIHtcbiAgICB2YXIgcGFyZW50TmFtZSA9IHR5cGVvZiBwYXJlbnRUeXBlID09PSAnc3RyaW5nJyA/IHBhcmVudFR5cGUgOiBwYXJlbnRUeXBlLmRpc3BsYXlOYW1lIHx8IHBhcmVudFR5cGUubmFtZTtcbiAgICBpZiAocGFyZW50TmFtZSkge1xuICAgICAgaW5mbyA9ICcgQ2hlY2sgdGhlIHRvcC1sZXZlbCByZW5kZXIgY2FsbCB1c2luZyA8JyArIHBhcmVudE5hbWUgKyAnPi4nO1xuICAgIH1cbiAgfVxuICByZXR1cm4gaW5mbztcbn1cblxuLyoqXG4gKiBXYXJuIGlmIHRoZSBlbGVtZW50IGRvZXNuJ3QgaGF2ZSBhbiBleHBsaWNpdCBrZXkgYXNzaWduZWQgdG8gaXQuXG4gKiBUaGlzIGVsZW1lbnQgaXMgaW4gYW4gYXJyYXkuIFRoZSBhcnJheSBjb3VsZCBncm93IGFuZCBzaHJpbmsgb3IgYmVcbiAqIHJlb3JkZXJlZC4gQWxsIGNoaWxkcmVuIHRoYXQgaGF2ZW4ndCBhbHJlYWR5IGJlZW4gdmFsaWRhdGVkIGFyZSByZXF1aXJlZCB0b1xuICogaGF2ZSBhIFwia2V5XCIgcHJvcGVydHkgYXNzaWduZWQgdG8gaXQuIEVycm9yIHN0YXR1c2VzIGFyZSBjYWNoZWQgc28gYSB3YXJuaW5nXG4gKiB3aWxsIG9ubHkgYmUgc2hvd24gb25jZS5cbiAqXG4gKiBAaW50ZXJuYWxcbiAqIEBwYXJhbSB7UmVhY3RFbGVtZW50fSBlbGVtZW50IEVsZW1lbnQgdGhhdCByZXF1aXJlcyBhIGtleS5cbiAqIEBwYXJhbSB7Kn0gcGFyZW50VHlwZSBlbGVtZW50J3MgcGFyZW50J3MgdHlwZS5cbiAqL1xuZnVuY3Rpb24gdmFsaWRhdGVFeHBsaWNpdEtleShlbGVtZW50LCBwYXJlbnRUeXBlKSB7XG4gIGlmICghZWxlbWVudC5fc3RvcmUgfHwgZWxlbWVudC5fc3RvcmUudmFsaWRhdGVkIHx8IGVsZW1lbnQua2V5ICE9IG51bGwpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgZWxlbWVudC5fc3RvcmUudmFsaWRhdGVkID0gdHJ1ZTtcblxuICB2YXIgbWVtb2l6ZXIgPSBvd25lckhhc0tleVVzZVdhcm5pbmcudW5pcXVlS2V5IHx8IChvd25lckhhc0tleVVzZVdhcm5pbmcudW5pcXVlS2V5ID0ge30pO1xuXG4gIHZhciBjdXJyZW50Q29tcG9uZW50RXJyb3JJbmZvID0gZ2V0Q3VycmVudENvbXBvbmVudEVycm9ySW5mbyhwYXJlbnRUeXBlKTtcbiAgaWYgKG1lbW9pemVyW2N1cnJlbnRDb21wb25lbnRFcnJvckluZm9dKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIG1lbW9pemVyW2N1cnJlbnRDb21wb25lbnRFcnJvckluZm9dID0gdHJ1ZTtcblxuICAvLyBVc3VhbGx5IHRoZSBjdXJyZW50IG93bmVyIGlzIHRoZSBvZmZlbmRlciwgYnV0IGlmIGl0IGFjY2VwdHMgY2hpbGRyZW4gYXMgYVxuICAvLyBwcm9wZXJ0eSwgaXQgbWF5IGJlIHRoZSBjcmVhdG9yIG9mIHRoZSBjaGlsZCB0aGF0J3MgcmVzcG9uc2libGUgZm9yXG4gIC8vIGFzc2lnbmluZyBpdCBhIGtleS5cbiAgdmFyIGNoaWxkT3duZXIgPSAnJztcbiAgaWYgKGVsZW1lbnQgJiYgZWxlbWVudC5fb3duZXIgJiYgZWxlbWVudC5fb3duZXIgIT09IFJlYWN0Q3VycmVudE93bmVyLmN1cnJlbnQpIHtcbiAgICAvLyBHaXZlIHRoZSBjb21wb25lbnQgdGhhdCBvcmlnaW5hbGx5IGNyZWF0ZWQgdGhpcyBjaGlsZC5cbiAgICBjaGlsZE93bmVyID0gJyBJdCB3YXMgcGFzc2VkIGEgY2hpbGQgZnJvbSAnICsgZWxlbWVudC5fb3duZXIuZ2V0TmFtZSgpICsgJy4nO1xuICB9XG5cbiAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/IHdhcm5pbmcoZmFsc2UsICdFYWNoIGNoaWxkIGluIGFuIGFycmF5IG9yIGl0ZXJhdG9yIHNob3VsZCBoYXZlIGEgdW5pcXVlIFwia2V5XCIgcHJvcC4nICsgJyVzJXMgU2VlIGh0dHBzOi8vZmIubWUvcmVhY3Qtd2FybmluZy1rZXlzIGZvciBtb3JlIGluZm9ybWF0aW9uLiVzJywgY3VycmVudENvbXBvbmVudEVycm9ySW5mbywgY2hpbGRPd25lciwgUmVhY3RDb21wb25lbnRUcmVlSG9vay5nZXRDdXJyZW50U3RhY2tBZGRlbmR1bShlbGVtZW50KSkgOiB2b2lkIDA7XG59XG5cbi8qKlxuICogRW5zdXJlIHRoYXQgZXZlcnkgZWxlbWVudCBlaXRoZXIgaXMgcGFzc2VkIGluIGEgc3RhdGljIGxvY2F0aW9uLCBpbiBhblxuICogYXJyYXkgd2l0aCBhbiBleHBsaWNpdCBrZXlzIHByb3BlcnR5IGRlZmluZWQsIG9yIGluIGFuIG9iamVjdCBsaXRlcmFsXG4gKiB3aXRoIHZhbGlkIGtleSBwcm9wZXJ0eS5cbiAqXG4gKiBAaW50ZXJuYWxcbiAqIEBwYXJhbSB7UmVhY3ROb2RlfSBub2RlIFN0YXRpY2FsbHkgcGFzc2VkIGNoaWxkIG9mIGFueSB0eXBlLlxuICogQHBhcmFtIHsqfSBwYXJlbnRUeXBlIG5vZGUncyBwYXJlbnQncyB0eXBlLlxuICovXG5mdW5jdGlvbiB2YWxpZGF0ZUNoaWxkS2V5cyhub2RlLCBwYXJlbnRUeXBlKSB7XG4gIGlmICh0eXBlb2Ygbm9kZSAhPT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKEFycmF5LmlzQXJyYXkobm9kZSkpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG5vZGUubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBjaGlsZCA9IG5vZGVbaV07XG4gICAgICBpZiAoUmVhY3RFbGVtZW50LmlzVmFsaWRFbGVtZW50KGNoaWxkKSkge1xuICAgICAgICB2YWxpZGF0ZUV4cGxpY2l0S2V5KGNoaWxkLCBwYXJlbnRUeXBlKTtcbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSBpZiAoUmVhY3RFbGVtZW50LmlzVmFsaWRFbGVtZW50KG5vZGUpKSB7XG4gICAgLy8gVGhpcyBlbGVtZW50IHdhcyBwYXNzZWQgaW4gYSB2YWxpZCBsb2NhdGlvbi5cbiAgICBpZiAobm9kZS5fc3RvcmUpIHtcbiAgICAgIG5vZGUuX3N0b3JlLnZhbGlkYXRlZCA9IHRydWU7XG4gICAgfVxuICB9IGVsc2UgaWYgKG5vZGUpIHtcbiAgICB2YXIgaXRlcmF0b3JGbiA9IGdldEl0ZXJhdG9yRm4obm9kZSk7XG4gICAgLy8gRW50cnkgaXRlcmF0b3JzIHByb3ZpZGUgaW1wbGljaXQga2V5cy5cbiAgICBpZiAoaXRlcmF0b3JGbikge1xuICAgICAgaWYgKGl0ZXJhdG9yRm4gIT09IG5vZGUuZW50cmllcykge1xuICAgICAgICB2YXIgaXRlcmF0b3IgPSBpdGVyYXRvckZuLmNhbGwobm9kZSk7XG4gICAgICAgIHZhciBzdGVwO1xuICAgICAgICB3aGlsZSAoIShzdGVwID0gaXRlcmF0b3IubmV4dCgpKS5kb25lKSB7XG4gICAgICAgICAgaWYgKFJlYWN0RWxlbWVudC5pc1ZhbGlkRWxlbWVudChzdGVwLnZhbHVlKSkge1xuICAgICAgICAgICAgdmFsaWRhdGVFeHBsaWNpdEtleShzdGVwLnZhbHVlLCBwYXJlbnRUeXBlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBHaXZlbiBhbiBlbGVtZW50LCB2YWxpZGF0ZSB0aGF0IGl0cyBwcm9wcyBmb2xsb3cgdGhlIHByb3BUeXBlcyBkZWZpbml0aW9uLFxuICogcHJvdmlkZWQgYnkgdGhlIHR5cGUuXG4gKlxuICogQHBhcmFtIHtSZWFjdEVsZW1lbnR9IGVsZW1lbnRcbiAqL1xuZnVuY3Rpb24gdmFsaWRhdGVQcm9wVHlwZXMoZWxlbWVudCkge1xuICB2YXIgY29tcG9uZW50Q2xhc3MgPSBlbGVtZW50LnR5cGU7XG4gIGlmICh0eXBlb2YgY29tcG9uZW50Q2xhc3MgIT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIG5hbWUgPSBjb21wb25lbnRDbGFzcy5kaXNwbGF5TmFtZSB8fCBjb21wb25lbnRDbGFzcy5uYW1lO1xuICBpZiAoY29tcG9uZW50Q2xhc3MucHJvcFR5cGVzKSB7XG4gICAgY2hlY2tSZWFjdFR5cGVTcGVjKGNvbXBvbmVudENsYXNzLnByb3BUeXBlcywgZWxlbWVudC5wcm9wcywgJ3Byb3AnLCBuYW1lLCBlbGVtZW50LCBudWxsKTtcbiAgfVxuICBpZiAodHlwZW9mIGNvbXBvbmVudENsYXNzLmdldERlZmF1bHRQcm9wcyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyB3YXJuaW5nKGNvbXBvbmVudENsYXNzLmdldERlZmF1bHRQcm9wcy5pc1JlYWN0Q2xhc3NBcHByb3ZlZCwgJ2dldERlZmF1bHRQcm9wcyBpcyBvbmx5IHVzZWQgb24gY2xhc3NpYyBSZWFjdC5jcmVhdGVDbGFzcyAnICsgJ2RlZmluaXRpb25zLiBVc2UgYSBzdGF0aWMgcHJvcGVydHkgbmFtZWQgYGRlZmF1bHRQcm9wc2AgaW5zdGVhZC4nKSA6IHZvaWQgMDtcbiAgfVxufVxuXG52YXIgUmVhY3RFbGVtZW50VmFsaWRhdG9yID0ge1xuICBjcmVhdGVFbGVtZW50OiBmdW5jdGlvbiAodHlwZSwgcHJvcHMsIGNoaWxkcmVuKSB7XG4gICAgdmFyIHZhbGlkVHlwZSA9IHR5cGVvZiB0eXBlID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgdHlwZSA9PT0gJ2Z1bmN0aW9uJztcbiAgICAvLyBXZSB3YXJuIGluIHRoaXMgY2FzZSBidXQgZG9uJ3QgdGhyb3cuIFdlIGV4cGVjdCB0aGUgZWxlbWVudCBjcmVhdGlvbiB0b1xuICAgIC8vIHN1Y2NlZWQgYW5kIHRoZXJlIHdpbGwgbGlrZWx5IGJlIGVycm9ycyBpbiByZW5kZXIuXG4gICAgaWYgKCF2YWxpZFR5cGUpIHtcbiAgICAgIGlmICh0eXBlb2YgdHlwZSAhPT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgdHlwZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgdmFyIGluZm8gPSAnJztcbiAgICAgICAgaWYgKHR5cGUgPT09IHVuZGVmaW5lZCB8fCB0eXBlb2YgdHlwZSA9PT0gJ29iamVjdCcgJiYgdHlwZSAhPT0gbnVsbCAmJiBPYmplY3Qua2V5cyh0eXBlKS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBpbmZvICs9ICcgWW91IGxpa2VseSBmb3Jnb3QgdG8gZXhwb3J0IHlvdXIgY29tcG9uZW50IGZyb20gdGhlIGZpbGUgJyArIFwiaXQncyBkZWZpbmVkIGluLlwiO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHNvdXJjZUluZm8gPSBnZXRTb3VyY2VJbmZvRXJyb3JBZGRlbmR1bShwcm9wcyk7XG4gICAgICAgIGlmIChzb3VyY2VJbmZvKSB7XG4gICAgICAgICAgaW5mbyArPSBzb3VyY2VJbmZvO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGluZm8gKz0gZ2V0RGVjbGFyYXRpb25FcnJvckFkZGVuZHVtKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpbmZvICs9IFJlYWN0Q29tcG9uZW50VHJlZUhvb2suZ2V0Q3VycmVudFN0YWNrQWRkZW5kdW0oKTtcblxuICAgICAgICB2YXIgY3VycmVudFNvdXJjZSA9IHByb3BzICE9PSBudWxsICYmIHByb3BzICE9PSB1bmRlZmluZWQgJiYgcHJvcHMuX19zb3VyY2UgIT09IHVuZGVmaW5lZCA/IHByb3BzLl9fc291cmNlIDogbnVsbDtcbiAgICAgICAgUmVhY3RDb21wb25lbnRUcmVlSG9vay5wdXNoTm9uU3RhbmRhcmRXYXJuaW5nU3RhY2sodHJ1ZSwgY3VycmVudFNvdXJjZSk7XG4gICAgICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyB3YXJuaW5nKGZhbHNlLCAnUmVhY3QuY3JlYXRlRWxlbWVudDogdHlwZSBpcyBpbnZhbGlkIC0tIGV4cGVjdGVkIGEgc3RyaW5nIChmb3IgJyArICdidWlsdC1pbiBjb21wb25lbnRzKSBvciBhIGNsYXNzL2Z1bmN0aW9uIChmb3IgY29tcG9zaXRlICcgKyAnY29tcG9uZW50cykgYnV0IGdvdDogJXMuJXMnLCB0eXBlID09IG51bGwgPyB0eXBlIDogdHlwZW9mIHR5cGUsIGluZm8pIDogdm9pZCAwO1xuICAgICAgICBSZWFjdENvbXBvbmVudFRyZWVIb29rLnBvcE5vblN0YW5kYXJkV2FybmluZ1N0YWNrKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGVsZW1lbnQgPSBSZWFjdEVsZW1lbnQuY3JlYXRlRWxlbWVudC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXG4gICAgLy8gVGhlIHJlc3VsdCBjYW4gYmUgbnVsbGlzaCBpZiBhIG1vY2sgb3IgYSBjdXN0b20gZnVuY3Rpb24gaXMgdXNlZC5cbiAgICAvLyBUT0RPOiBEcm9wIHRoaXMgd2hlbiB0aGVzZSBhcmUgbm8gbG9uZ2VyIGFsbG93ZWQgYXMgdGhlIHR5cGUgYXJndW1lbnQuXG4gICAgaWYgKGVsZW1lbnQgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGVsZW1lbnQ7XG4gICAgfVxuXG4gICAgLy8gU2tpcCBrZXkgd2FybmluZyBpZiB0aGUgdHlwZSBpc24ndCB2YWxpZCBzaW5jZSBvdXIga2V5IHZhbGlkYXRpb24gbG9naWNcbiAgICAvLyBkb2Vzbid0IGV4cGVjdCBhIG5vbi1zdHJpbmcvZnVuY3Rpb24gdHlwZSBhbmQgY2FuIHRocm93IGNvbmZ1c2luZyBlcnJvcnMuXG4gICAgLy8gV2UgZG9uJ3Qgd2FudCBleGNlcHRpb24gYmVoYXZpb3IgdG8gZGlmZmVyIGJldHdlZW4gZGV2IGFuZCBwcm9kLlxuICAgIC8vIChSZW5kZXJpbmcgd2lsbCB0aHJvdyB3aXRoIGEgaGVscGZ1bCBtZXNzYWdlIGFuZCBhcyBzb29uIGFzIHRoZSB0eXBlIGlzXG4gICAgLy8gZml4ZWQsIHRoZSBrZXkgd2FybmluZ3Mgd2lsbCBhcHBlYXIuKVxuICAgIGlmICh2YWxpZFR5cGUpIHtcbiAgICAgIGZvciAodmFyIGkgPSAyOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhbGlkYXRlQ2hpbGRLZXlzKGFyZ3VtZW50c1tpXSwgdHlwZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFsaWRhdGVQcm9wVHlwZXMoZWxlbWVudCk7XG5cbiAgICByZXR1cm4gZWxlbWVudDtcbiAgfSxcblxuICBjcmVhdGVGYWN0b3J5OiBmdW5jdGlvbiAodHlwZSkge1xuICAgIHZhciB2YWxpZGF0ZWRGYWN0b3J5ID0gUmVhY3RFbGVtZW50VmFsaWRhdG9yLmNyZWF0ZUVsZW1lbnQuYmluZChudWxsLCB0eXBlKTtcbiAgICAvLyBMZWdhY3kgaG9vayBUT0RPOiBXYXJuIGlmIHRoaXMgaXMgYWNjZXNzZWRcbiAgICB2YWxpZGF0ZWRGYWN0b3J5LnR5cGUgPSB0eXBlO1xuXG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgIGlmIChjYW5EZWZpbmVQcm9wZXJ0eSkge1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodmFsaWRhdGVkRmFjdG9yeSwgJ3R5cGUnLCB7XG4gICAgICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBsb3dQcmlvcml0eVdhcm5pbmcoZmFsc2UsICdGYWN0b3J5LnR5cGUgaXMgZGVwcmVjYXRlZC4gQWNjZXNzIHRoZSBjbGFzcyBkaXJlY3RseSAnICsgJ2JlZm9yZSBwYXNzaW5nIGl0IHRvIGNyZWF0ZUZhY3RvcnkuJyk7XG4gICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ3R5cGUnLCB7XG4gICAgICAgICAgICAgIHZhbHVlOiB0eXBlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiB0eXBlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHZhbGlkYXRlZEZhY3Rvcnk7XG4gIH0sXG5cbiAgY2xvbmVFbGVtZW50OiBmdW5jdGlvbiAoZWxlbWVudCwgcHJvcHMsIGNoaWxkcmVuKSB7XG4gICAgdmFyIG5ld0VsZW1lbnQgPSBSZWFjdEVsZW1lbnQuY2xvbmVFbGVtZW50LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgZm9yICh2YXIgaSA9IDI7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhbGlkYXRlQ2hpbGRLZXlzKGFyZ3VtZW50c1tpXSwgbmV3RWxlbWVudC50eXBlKTtcbiAgICB9XG4gICAgdmFsaWRhdGVQcm9wVHlwZXMobmV3RWxlbWVudCk7XG4gICAgcmV0dXJuIG5ld0VsZW1lbnQ7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUmVhY3RFbGVtZW50VmFsaWRhdG9yOyIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTUtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICpcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciB3YXJuaW5nID0gcmVxdWlyZSgnZmJqcy9saWIvd2FybmluZycpO1xuXG5mdW5jdGlvbiB3YXJuTm9vcChwdWJsaWNJbnN0YW5jZSwgY2FsbGVyTmFtZSkge1xuICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgIHZhciBjb25zdHJ1Y3RvciA9IHB1YmxpY0luc3RhbmNlLmNvbnN0cnVjdG9yO1xuICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyB3YXJuaW5nKGZhbHNlLCAnJXMoLi4uKTogQ2FuIG9ubHkgdXBkYXRlIGEgbW91bnRlZCBvciBtb3VudGluZyBjb21wb25lbnQuICcgKyAnVGhpcyB1c3VhbGx5IG1lYW5zIHlvdSBjYWxsZWQgJXMoKSBvbiBhbiB1bm1vdW50ZWQgY29tcG9uZW50LiAnICsgJ1RoaXMgaXMgYSBuby1vcC4gUGxlYXNlIGNoZWNrIHRoZSBjb2RlIGZvciB0aGUgJXMgY29tcG9uZW50LicsIGNhbGxlck5hbWUsIGNhbGxlck5hbWUsIGNvbnN0cnVjdG9yICYmIChjb25zdHJ1Y3Rvci5kaXNwbGF5TmFtZSB8fCBjb25zdHJ1Y3Rvci5uYW1lKSB8fCAnUmVhY3RDbGFzcycpIDogdm9pZCAwO1xuICB9XG59XG5cbi8qKlxuICogVGhpcyBpcyB0aGUgYWJzdHJhY3QgQVBJIGZvciBhbiB1cGRhdGUgcXVldWUuXG4gKi9cbnZhciBSZWFjdE5vb3BVcGRhdGVRdWV1ZSA9IHtcbiAgLyoqXG4gICAqIENoZWNrcyB3aGV0aGVyIG9yIG5vdCB0aGlzIGNvbXBvc2l0ZSBjb21wb25lbnQgaXMgbW91bnRlZC5cbiAgICogQHBhcmFtIHtSZWFjdENsYXNzfSBwdWJsaWNJbnN0YW5jZSBUaGUgaW5zdGFuY2Ugd2Ugd2FudCB0byB0ZXN0LlxuICAgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIGlmIG1vdW50ZWQsIGZhbHNlIG90aGVyd2lzZS5cbiAgICogQHByb3RlY3RlZFxuICAgKiBAZmluYWxcbiAgICovXG4gIGlzTW91bnRlZDogZnVuY3Rpb24gKHB1YmxpY0luc3RhbmNlKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9LFxuXG4gIC8qKlxuICAgKiBFbnF1ZXVlIGEgY2FsbGJhY2sgdGhhdCB3aWxsIGJlIGV4ZWN1dGVkIGFmdGVyIGFsbCB0aGUgcGVuZGluZyB1cGRhdGVzXG4gICAqIGhhdmUgcHJvY2Vzc2VkLlxuICAgKlxuICAgKiBAcGFyYW0ge1JlYWN0Q2xhc3N9IHB1YmxpY0luc3RhbmNlIFRoZSBpbnN0YW5jZSB0byB1c2UgYXMgYHRoaXNgIGNvbnRleHQuXG4gICAqIEBwYXJhbSB7P2Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsZWQgYWZ0ZXIgc3RhdGUgaXMgdXBkYXRlZC5cbiAgICogQGludGVybmFsXG4gICAqL1xuICBlbnF1ZXVlQ2FsbGJhY2s6IGZ1bmN0aW9uIChwdWJsaWNJbnN0YW5jZSwgY2FsbGJhY2spIHt9LFxuXG4gIC8qKlxuICAgKiBGb3JjZXMgYW4gdXBkYXRlLiBUaGlzIHNob3VsZCBvbmx5IGJlIGludm9rZWQgd2hlbiBpdCBpcyBrbm93biB3aXRoXG4gICAqIGNlcnRhaW50eSB0aGF0IHdlIGFyZSAqKm5vdCoqIGluIGEgRE9NIHRyYW5zYWN0aW9uLlxuICAgKlxuICAgKiBZb3UgbWF5IHdhbnQgdG8gY2FsbCB0aGlzIHdoZW4geW91IGtub3cgdGhhdCBzb21lIGRlZXBlciBhc3BlY3Qgb2YgdGhlXG4gICAqIGNvbXBvbmVudCdzIHN0YXRlIGhhcyBjaGFuZ2VkIGJ1dCBgc2V0U3RhdGVgIHdhcyBub3QgY2FsbGVkLlxuICAgKlxuICAgKiBUaGlzIHdpbGwgbm90IGludm9rZSBgc2hvdWxkQ29tcG9uZW50VXBkYXRlYCwgYnV0IGl0IHdpbGwgaW52b2tlXG4gICAqIGBjb21wb25lbnRXaWxsVXBkYXRlYCBhbmQgYGNvbXBvbmVudERpZFVwZGF0ZWAuXG4gICAqXG4gICAqIEBwYXJhbSB7UmVhY3RDbGFzc30gcHVibGljSW5zdGFuY2UgVGhlIGluc3RhbmNlIHRoYXQgc2hvdWxkIHJlcmVuZGVyLlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIGVucXVldWVGb3JjZVVwZGF0ZTogZnVuY3Rpb24gKHB1YmxpY0luc3RhbmNlKSB7XG4gICAgd2Fybk5vb3AocHVibGljSW5zdGFuY2UsICdmb3JjZVVwZGF0ZScpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBSZXBsYWNlcyBhbGwgb2YgdGhlIHN0YXRlLiBBbHdheXMgdXNlIHRoaXMgb3IgYHNldFN0YXRlYCB0byBtdXRhdGUgc3RhdGUuXG4gICAqIFlvdSBzaG91bGQgdHJlYXQgYHRoaXMuc3RhdGVgIGFzIGltbXV0YWJsZS5cbiAgICpcbiAgICogVGhlcmUgaXMgbm8gZ3VhcmFudGVlIHRoYXQgYHRoaXMuc3RhdGVgIHdpbGwgYmUgaW1tZWRpYXRlbHkgdXBkYXRlZCwgc29cbiAgICogYWNjZXNzaW5nIGB0aGlzLnN0YXRlYCBhZnRlciBjYWxsaW5nIHRoaXMgbWV0aG9kIG1heSByZXR1cm4gdGhlIG9sZCB2YWx1ZS5cbiAgICpcbiAgICogQHBhcmFtIHtSZWFjdENsYXNzfSBwdWJsaWNJbnN0YW5jZSBUaGUgaW5zdGFuY2UgdGhhdCBzaG91bGQgcmVyZW5kZXIuXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBjb21wbGV0ZVN0YXRlIE5leHQgc3RhdGUuXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgZW5xdWV1ZVJlcGxhY2VTdGF0ZTogZnVuY3Rpb24gKHB1YmxpY0luc3RhbmNlLCBjb21wbGV0ZVN0YXRlKSB7XG4gICAgd2Fybk5vb3AocHVibGljSW5zdGFuY2UsICdyZXBsYWNlU3RhdGUnKTtcbiAgfSxcblxuICAvKipcbiAgICogU2V0cyBhIHN1YnNldCBvZiB0aGUgc3RhdGUuIFRoaXMgb25seSBleGlzdHMgYmVjYXVzZSBfcGVuZGluZ1N0YXRlIGlzXG4gICAqIGludGVybmFsLiBUaGlzIHByb3ZpZGVzIGEgbWVyZ2luZyBzdHJhdGVneSB0aGF0IGlzIG5vdCBhdmFpbGFibGUgdG8gZGVlcFxuICAgKiBwcm9wZXJ0aWVzIHdoaWNoIGlzIGNvbmZ1c2luZy4gVE9ETzogRXhwb3NlIHBlbmRpbmdTdGF0ZSBvciBkb24ndCB1c2UgaXRcbiAgICogZHVyaW5nIHRoZSBtZXJnZS5cbiAgICpcbiAgICogQHBhcmFtIHtSZWFjdENsYXNzfSBwdWJsaWNJbnN0YW5jZSBUaGUgaW5zdGFuY2UgdGhhdCBzaG91bGQgcmVyZW5kZXIuXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBwYXJ0aWFsU3RhdGUgTmV4dCBwYXJ0aWFsIHN0YXRlIHRvIGJlIG1lcmdlZCB3aXRoIHN0YXRlLlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIGVucXVldWVTZXRTdGF0ZTogZnVuY3Rpb24gKHB1YmxpY0luc3RhbmNlLCBwYXJ0aWFsU3RhdGUpIHtcbiAgICB3YXJuTm9vcChwdWJsaWNJbnN0YW5jZSwgJ3NldFN0YXRlJyk7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUmVhY3ROb29wVXBkYXRlUXVldWU7IiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxMy1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICogXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgUmVhY3RQcm9wVHlwZUxvY2F0aW9uTmFtZXMgPSB7fTtcblxuaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgUmVhY3RQcm9wVHlwZUxvY2F0aW9uTmFtZXMgPSB7XG4gICAgcHJvcDogJ3Byb3AnLFxuICAgIGNvbnRleHQ6ICdjb250ZXh0JyxcbiAgICBjaGlsZENvbnRleHQ6ICdjaGlsZCBjb250ZXh0J1xuICB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFJlYWN0UHJvcFR5cGVMb2NhdGlvbk5hbWVzOyIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTMtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICpcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBfcmVxdWlyZSA9IHJlcXVpcmUoJy4vUmVhY3RFbGVtZW50JyksXG4gICAgaXNWYWxpZEVsZW1lbnQgPSBfcmVxdWlyZS5pc1ZhbGlkRWxlbWVudDtcblxudmFyIGZhY3RvcnkgPSByZXF1aXJlKCdwcm9wLXR5cGVzL2ZhY3RvcnknKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KGlzVmFsaWRFbGVtZW50KTsiLCIvKipcbiAqIENvcHlyaWdodCAyMDEzLXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqXG4gKiBcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBSZWFjdFByb3BUeXBlc1NlY3JldCA9ICdTRUNSRVRfRE9fTk9UX1BBU1NfVEhJU19PUl9ZT1VfV0lMTF9CRV9GSVJFRCc7XG5cbm1vZHVsZS5leHBvcnRzID0gUmVhY3RQcm9wVHlwZXNTZWNyZXQ7IiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxMy1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSAnMTUuNi4xJzsiLCIvKipcbiAqIENvcHlyaWdodCAyMDEzLXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqXG4gKiBcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBjYW5EZWZpbmVQcm9wZXJ0eSA9IGZhbHNlO1xuaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgdHJ5IHtcbiAgICAvLyAkRmxvd0ZpeE1lIGh0dHBzOi8vZ2l0aHViLmNvbS9mYWNlYm9vay9mbG93L2lzc3Vlcy8yODVcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoe30sICd4JywgeyBnZXQ6IGZ1bmN0aW9uICgpIHt9IH0pO1xuICAgIGNhbkRlZmluZVByb3BlcnR5ID0gdHJ1ZTtcbiAgfSBjYXRjaCAoeCkge1xuICAgIC8vIElFIHdpbGwgZmFpbCBvbiBkZWZpbmVQcm9wZXJ0eVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gY2FuRGVmaW5lUHJvcGVydHk7IiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxMy1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIF9wcm9kSW52YXJpYW50ID0gcmVxdWlyZSgnLi9yZWFjdFByb2RJbnZhcmlhbnQnKTtcblxudmFyIFJlYWN0UHJvcFR5cGVMb2NhdGlvbk5hbWVzID0gcmVxdWlyZSgnLi9SZWFjdFByb3BUeXBlTG9jYXRpb25OYW1lcycpO1xudmFyIFJlYWN0UHJvcFR5cGVzU2VjcmV0ID0gcmVxdWlyZSgnLi9SZWFjdFByb3BUeXBlc1NlY3JldCcpO1xuXG52YXIgaW52YXJpYW50ID0gcmVxdWlyZSgnZmJqcy9saWIvaW52YXJpYW50Jyk7XG52YXIgd2FybmluZyA9IHJlcXVpcmUoJ2ZianMvbGliL3dhcm5pbmcnKTtcblxudmFyIFJlYWN0Q29tcG9uZW50VHJlZUhvb2s7XG5cbmlmICh0eXBlb2YgcHJvY2VzcyAhPT0gJ3VuZGVmaW5lZCcgJiYgcHJvY2Vzcy5lbnYgJiYgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICd0ZXN0Jykge1xuICAvLyBUZW1wb3JhcnkgaGFjay5cbiAgLy8gSW5saW5lIHJlcXVpcmVzIGRvbid0IHdvcmsgd2VsbCB3aXRoIEplc3Q6XG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9mYWNlYm9vay9yZWFjdC9pc3N1ZXMvNzI0MFxuICAvLyBSZW1vdmUgdGhlIGlubGluZSByZXF1aXJlcyB3aGVuIHdlIGRvbid0IG5lZWQgdGhlbSBhbnltb3JlOlxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vZmFjZWJvb2svcmVhY3QvcHVsbC83MTc4XG4gIFJlYWN0Q29tcG9uZW50VHJlZUhvb2sgPSByZXF1aXJlKCcuL1JlYWN0Q29tcG9uZW50VHJlZUhvb2snKTtcbn1cblxudmFyIGxvZ2dlZFR5cGVGYWlsdXJlcyA9IHt9O1xuXG4vKipcbiAqIEFzc2VydCB0aGF0IHRoZSB2YWx1ZXMgbWF0Y2ggd2l0aCB0aGUgdHlwZSBzcGVjcy5cbiAqIEVycm9yIG1lc3NhZ2VzIGFyZSBtZW1vcml6ZWQgYW5kIHdpbGwgb25seSBiZSBzaG93biBvbmNlLlxuICpcbiAqIEBwYXJhbSB7b2JqZWN0fSB0eXBlU3BlY3MgTWFwIG9mIG5hbWUgdG8gYSBSZWFjdFByb3BUeXBlXG4gKiBAcGFyYW0ge29iamVjdH0gdmFsdWVzIFJ1bnRpbWUgdmFsdWVzIHRoYXQgbmVlZCB0byBiZSB0eXBlLWNoZWNrZWRcbiAqIEBwYXJhbSB7c3RyaW5nfSBsb2NhdGlvbiBlLmcuIFwicHJvcFwiLCBcImNvbnRleHRcIiwgXCJjaGlsZCBjb250ZXh0XCJcbiAqIEBwYXJhbSB7c3RyaW5nfSBjb21wb25lbnROYW1lIE5hbWUgb2YgdGhlIGNvbXBvbmVudCBmb3IgZXJyb3IgbWVzc2FnZXMuXG4gKiBAcGFyYW0gez9vYmplY3R9IGVsZW1lbnQgVGhlIFJlYWN0IGVsZW1lbnQgdGhhdCBpcyBiZWluZyB0eXBlLWNoZWNrZWRcbiAqIEBwYXJhbSB7P251bWJlcn0gZGVidWdJRCBUaGUgUmVhY3QgY29tcG9uZW50IGluc3RhbmNlIHRoYXQgaXMgYmVpbmcgdHlwZS1jaGVja2VkXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBjaGVja1JlYWN0VHlwZVNwZWModHlwZVNwZWNzLCB2YWx1ZXMsIGxvY2F0aW9uLCBjb21wb25lbnROYW1lLCBlbGVtZW50LCBkZWJ1Z0lEKSB7XG4gIGZvciAodmFyIHR5cGVTcGVjTmFtZSBpbiB0eXBlU3BlY3MpIHtcbiAgICBpZiAodHlwZVNwZWNzLmhhc093blByb3BlcnR5KHR5cGVTcGVjTmFtZSkpIHtcbiAgICAgIHZhciBlcnJvcjtcbiAgICAgIC8vIFByb3AgdHlwZSB2YWxpZGF0aW9uIG1heSB0aHJvdy4gSW4gY2FzZSB0aGV5IGRvLCB3ZSBkb24ndCB3YW50IHRvXG4gICAgICAvLyBmYWlsIHRoZSByZW5kZXIgcGhhc2Ugd2hlcmUgaXQgZGlkbid0IGZhaWwgYmVmb3JlLiBTbyB3ZSBsb2cgaXQuXG4gICAgICAvLyBBZnRlciB0aGVzZSBoYXZlIGJlZW4gY2xlYW5lZCB1cCwgd2UnbGwgbGV0IHRoZW0gdGhyb3cuXG4gICAgICB0cnkge1xuICAgICAgICAvLyBUaGlzIGlzIGludGVudGlvbmFsbHkgYW4gaW52YXJpYW50IHRoYXQgZ2V0cyBjYXVnaHQuIEl0J3MgdGhlIHNhbWVcbiAgICAgICAgLy8gYmVoYXZpb3IgYXMgd2l0aG91dCB0aGlzIHN0YXRlbWVudCBleGNlcHQgd2l0aCBhIGJldHRlciBtZXNzYWdlLlxuICAgICAgICAhKHR5cGVvZiB0eXBlU3BlY3NbdHlwZVNwZWNOYW1lXSA9PT0gJ2Z1bmN0aW9uJykgPyBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nID8gaW52YXJpYW50KGZhbHNlLCAnJXM6ICVzIHR5cGUgYCVzYCBpcyBpbnZhbGlkOyBpdCBtdXN0IGJlIGEgZnVuY3Rpb24sIHVzdWFsbHkgZnJvbSBSZWFjdC5Qcm9wVHlwZXMuJywgY29tcG9uZW50TmFtZSB8fCAnUmVhY3QgY2xhc3MnLCBSZWFjdFByb3BUeXBlTG9jYXRpb25OYW1lc1tsb2NhdGlvbl0sIHR5cGVTcGVjTmFtZSkgOiBfcHJvZEludmFyaWFudCgnODQnLCBjb21wb25lbnROYW1lIHx8ICdSZWFjdCBjbGFzcycsIFJlYWN0UHJvcFR5cGVMb2NhdGlvbk5hbWVzW2xvY2F0aW9uXSwgdHlwZVNwZWNOYW1lKSA6IHZvaWQgMDtcbiAgICAgICAgZXJyb3IgPSB0eXBlU3BlY3NbdHlwZVNwZWNOYW1lXSh2YWx1ZXMsIHR5cGVTcGVjTmFtZSwgY29tcG9uZW50TmFtZSwgbG9jYXRpb24sIG51bGwsIFJlYWN0UHJvcFR5cGVzU2VjcmV0KTtcbiAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgIGVycm9yID0gZXg7XG4gICAgICB9XG4gICAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nID8gd2FybmluZyghZXJyb3IgfHwgZXJyb3IgaW5zdGFuY2VvZiBFcnJvciwgJyVzOiB0eXBlIHNwZWNpZmljYXRpb24gb2YgJXMgYCVzYCBpcyBpbnZhbGlkOyB0aGUgdHlwZSBjaGVja2VyICcgKyAnZnVuY3Rpb24gbXVzdCByZXR1cm4gYG51bGxgIG9yIGFuIGBFcnJvcmAgYnV0IHJldHVybmVkIGEgJXMuICcgKyAnWW91IG1heSBoYXZlIGZvcmdvdHRlbiB0byBwYXNzIGFuIGFyZ3VtZW50IHRvIHRoZSB0eXBlIGNoZWNrZXIgJyArICdjcmVhdG9yIChhcnJheU9mLCBpbnN0YW5jZU9mLCBvYmplY3RPZiwgb25lT2YsIG9uZU9mVHlwZSwgYW5kICcgKyAnc2hhcGUgYWxsIHJlcXVpcmUgYW4gYXJndW1lbnQpLicsIGNvbXBvbmVudE5hbWUgfHwgJ1JlYWN0IGNsYXNzJywgUmVhY3RQcm9wVHlwZUxvY2F0aW9uTmFtZXNbbG9jYXRpb25dLCB0eXBlU3BlY05hbWUsIHR5cGVvZiBlcnJvcikgOiB2b2lkIDA7XG4gICAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvciAmJiAhKGVycm9yLm1lc3NhZ2UgaW4gbG9nZ2VkVHlwZUZhaWx1cmVzKSkge1xuICAgICAgICAvLyBPbmx5IG1vbml0b3IgdGhpcyBmYWlsdXJlIG9uY2UgYmVjYXVzZSB0aGVyZSB0ZW5kcyB0byBiZSBhIGxvdCBvZiB0aGVcbiAgICAgICAgLy8gc2FtZSBlcnJvci5cbiAgICAgICAgbG9nZ2VkVHlwZUZhaWx1cmVzW2Vycm9yLm1lc3NhZ2VdID0gdHJ1ZTtcblxuICAgICAgICB2YXIgY29tcG9uZW50U3RhY2tJbmZvID0gJyc7XG5cbiAgICAgICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgICAgICBpZiAoIVJlYWN0Q29tcG9uZW50VHJlZUhvb2spIHtcbiAgICAgICAgICAgIFJlYWN0Q29tcG9uZW50VHJlZUhvb2sgPSByZXF1aXJlKCcuL1JlYWN0Q29tcG9uZW50VHJlZUhvb2snKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGRlYnVnSUQgIT09IG51bGwpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudFN0YWNrSW5mbyA9IFJlYWN0Q29tcG9uZW50VHJlZUhvb2suZ2V0U3RhY2tBZGRlbmR1bUJ5SUQoZGVidWdJRCk7XG4gICAgICAgICAgfSBlbHNlIGlmIChlbGVtZW50ICE9PSBudWxsKSB7XG4gICAgICAgICAgICBjb21wb25lbnRTdGFja0luZm8gPSBSZWFjdENvbXBvbmVudFRyZWVIb29rLmdldEN1cnJlbnRTdGFja0FkZGVuZHVtKGVsZW1lbnQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyB3YXJuaW5nKGZhbHNlLCAnRmFpbGVkICVzIHR5cGU6ICVzJXMnLCBsb2NhdGlvbiwgZXJyb3IubWVzc2FnZSwgY29tcG9uZW50U3RhY2tJbmZvKSA6IHZvaWQgMDtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjaGVja1JlYWN0VHlwZVNwZWM7IiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxMy1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIF9yZXF1aXJlID0gcmVxdWlyZSgnLi9SZWFjdEJhc2VDbGFzc2VzJyksXG4gICAgQ29tcG9uZW50ID0gX3JlcXVpcmUuQ29tcG9uZW50O1xuXG52YXIgX3JlcXVpcmUyID0gcmVxdWlyZSgnLi9SZWFjdEVsZW1lbnQnKSxcbiAgICBpc1ZhbGlkRWxlbWVudCA9IF9yZXF1aXJlMi5pc1ZhbGlkRWxlbWVudDtcblxudmFyIFJlYWN0Tm9vcFVwZGF0ZVF1ZXVlID0gcmVxdWlyZSgnLi9SZWFjdE5vb3BVcGRhdGVRdWV1ZScpO1xudmFyIGZhY3RvcnkgPSByZXF1aXJlKCdjcmVhdGUtcmVhY3QtY2xhc3MvZmFjdG9yeScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoQ29tcG9uZW50LCBpc1ZhbGlkRWxlbWVudCwgUmVhY3ROb29wVXBkYXRlUXVldWUpOyIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTMtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICpcbiAqIFxuICovXG5cbid1c2Ugc3RyaWN0JztcblxuLyogZ2xvYmFsIFN5bWJvbCAqL1xuXG52YXIgSVRFUkFUT1JfU1lNQk9MID0gdHlwZW9mIFN5bWJvbCA9PT0gJ2Z1bmN0aW9uJyAmJiBTeW1ib2wuaXRlcmF0b3I7XG52YXIgRkFVWF9JVEVSQVRPUl9TWU1CT0wgPSAnQEBpdGVyYXRvcic7IC8vIEJlZm9yZSBTeW1ib2wgc3BlYy5cblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBpdGVyYXRvciBtZXRob2QgZnVuY3Rpb24gY29udGFpbmVkIG9uIHRoZSBpdGVyYWJsZSBvYmplY3QuXG4gKlxuICogQmUgc3VyZSB0byBpbnZva2UgdGhlIGZ1bmN0aW9uIHdpdGggdGhlIGl0ZXJhYmxlIGFzIGNvbnRleHQ6XG4gKlxuICogICAgIHZhciBpdGVyYXRvckZuID0gZ2V0SXRlcmF0b3JGbihteUl0ZXJhYmxlKTtcbiAqICAgICBpZiAoaXRlcmF0b3JGbikge1xuICogICAgICAgdmFyIGl0ZXJhdG9yID0gaXRlcmF0b3JGbi5jYWxsKG15SXRlcmFibGUpO1xuICogICAgICAgLi4uXG4gKiAgICAgfVxuICpcbiAqIEBwYXJhbSB7P29iamVjdH0gbWF5YmVJdGVyYWJsZVxuICogQHJldHVybiB7P2Z1bmN0aW9ufVxuICovXG5mdW5jdGlvbiBnZXRJdGVyYXRvckZuKG1heWJlSXRlcmFibGUpIHtcbiAgdmFyIGl0ZXJhdG9yRm4gPSBtYXliZUl0ZXJhYmxlICYmIChJVEVSQVRPUl9TWU1CT0wgJiYgbWF5YmVJdGVyYWJsZVtJVEVSQVRPUl9TWU1CT0xdIHx8IG1heWJlSXRlcmFibGVbRkFVWF9JVEVSQVRPUl9TWU1CT0xdKTtcbiAgaWYgKHR5cGVvZiBpdGVyYXRvckZuID09PSAnZnVuY3Rpb24nKSB7XG4gICAgcmV0dXJuIGl0ZXJhdG9yRm47XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBnZXRJdGVyYXRvckZuOyIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTQtMjAxNSwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICpcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbi8qKlxuICogRm9ya2VkIGZyb20gZmJqcy93YXJuaW5nOlxuICogaHR0cHM6Ly9naXRodWIuY29tL2ZhY2Vib29rL2ZianMvYmxvYi9lNjZiYTIwYWQ1YmU0MzNlYjU0NDIzZjJiMDk3ZDgyOTMyNGQ5ZGU2L3BhY2thZ2VzL2ZianMvc3JjL19fZm9ya3NfXy93YXJuaW5nLmpzXG4gKlxuICogT25seSBjaGFuZ2UgaXMgd2UgdXNlIGNvbnNvbGUud2FybiBpbnN0ZWFkIG9mIGNvbnNvbGUuZXJyb3IsXG4gKiBhbmQgZG8gbm90aGluZyB3aGVuICdjb25zb2xlJyBpcyBub3Qgc3VwcG9ydGVkLlxuICogVGhpcyByZWFsbHkgc2ltcGxpZmllcyB0aGUgY29kZS5cbiAqIC0tLVxuICogU2ltaWxhciB0byBpbnZhcmlhbnQgYnV0IG9ubHkgbG9ncyBhIHdhcm5pbmcgaWYgdGhlIGNvbmRpdGlvbiBpcyBub3QgbWV0LlxuICogVGhpcyBjYW4gYmUgdXNlZCB0byBsb2cgaXNzdWVzIGluIGRldmVsb3BtZW50IGVudmlyb25tZW50cyBpbiBjcml0aWNhbFxuICogcGF0aHMuIFJlbW92aW5nIHRoZSBsb2dnaW5nIGNvZGUgZm9yIHByb2R1Y3Rpb24gZW52aXJvbm1lbnRzIHdpbGwga2VlcCB0aGVcbiAqIHNhbWUgbG9naWMgYW5kIGZvbGxvdyB0aGUgc2FtZSBjb2RlIHBhdGhzLlxuICovXG5cbnZhciBsb3dQcmlvcml0eVdhcm5pbmcgPSBmdW5jdGlvbiAoKSB7fTtcblxuaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgdmFyIHByaW50V2FybmluZyA9IGZ1bmN0aW9uIChmb3JtYXQpIHtcbiAgICBmb3IgKHZhciBfbGVuID0gYXJndW1lbnRzLmxlbmd0aCwgYXJncyA9IEFycmF5KF9sZW4gPiAxID8gX2xlbiAtIDEgOiAwKSwgX2tleSA9IDE7IF9rZXkgPCBfbGVuOyBfa2V5KyspIHtcbiAgICAgIGFyZ3NbX2tleSAtIDFdID0gYXJndW1lbnRzW19rZXldO1xuICAgIH1cblxuICAgIHZhciBhcmdJbmRleCA9IDA7XG4gICAgdmFyIG1lc3NhZ2UgPSAnV2FybmluZzogJyArIGZvcm1hdC5yZXBsYWNlKC8lcy9nLCBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gYXJnc1thcmdJbmRleCsrXTtcbiAgICB9KTtcbiAgICBpZiAodHlwZW9mIGNvbnNvbGUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBjb25zb2xlLndhcm4obWVzc2FnZSk7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAvLyAtLS0gV2VsY29tZSB0byBkZWJ1Z2dpbmcgUmVhY3QgLS0tXG4gICAgICAvLyBUaGlzIGVycm9yIHdhcyB0aHJvd24gYXMgYSBjb252ZW5pZW5jZSBzbyB0aGF0IHlvdSBjYW4gdXNlIHRoaXMgc3RhY2tcbiAgICAgIC8vIHRvIGZpbmQgdGhlIGNhbGxzaXRlIHRoYXQgY2F1c2VkIHRoaXMgd2FybmluZyB0byBmaXJlLlxuICAgICAgdGhyb3cgbmV3IEVycm9yKG1lc3NhZ2UpO1xuICAgIH0gY2F0Y2ggKHgpIHt9XG4gIH07XG5cbiAgbG93UHJpb3JpdHlXYXJuaW5nID0gZnVuY3Rpb24gKGNvbmRpdGlvbiwgZm9ybWF0KSB7XG4gICAgaWYgKGZvcm1hdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2B3YXJuaW5nKGNvbmRpdGlvbiwgZm9ybWF0LCAuLi5hcmdzKWAgcmVxdWlyZXMgYSB3YXJuaW5nICcgKyAnbWVzc2FnZSBhcmd1bWVudCcpO1xuICAgIH1cbiAgICBpZiAoIWNvbmRpdGlvbikge1xuICAgICAgZm9yICh2YXIgX2xlbjIgPSBhcmd1bWVudHMubGVuZ3RoLCBhcmdzID0gQXJyYXkoX2xlbjIgPiAyID8gX2xlbjIgLSAyIDogMCksIF9rZXkyID0gMjsgX2tleTIgPCBfbGVuMjsgX2tleTIrKykge1xuICAgICAgICBhcmdzW19rZXkyIC0gMl0gPSBhcmd1bWVudHNbX2tleTJdO1xuICAgICAgfVxuXG4gICAgICBwcmludFdhcm5pbmcuYXBwbHkodW5kZWZpbmVkLCBbZm9ybWF0XS5jb25jYXQoYXJncykpO1xuICAgIH1cbiAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBsb3dQcmlvcml0eVdhcm5pbmc7IiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxMy1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBfcHJvZEludmFyaWFudCA9IHJlcXVpcmUoJy4vcmVhY3RQcm9kSW52YXJpYW50Jyk7XG5cbnZhciBSZWFjdEVsZW1lbnQgPSByZXF1aXJlKCcuL1JlYWN0RWxlbWVudCcpO1xuXG52YXIgaW52YXJpYW50ID0gcmVxdWlyZSgnZmJqcy9saWIvaW52YXJpYW50Jyk7XG5cbi8qKlxuICogUmV0dXJucyB0aGUgZmlyc3QgY2hpbGQgaW4gYSBjb2xsZWN0aW9uIG9mIGNoaWxkcmVuIGFuZCB2ZXJpZmllcyB0aGF0IHRoZXJlXG4gKiBpcyBvbmx5IG9uZSBjaGlsZCBpbiB0aGUgY29sbGVjdGlvbi5cbiAqXG4gKiBTZWUgaHR0cHM6Ly9mYWNlYm9vay5naXRodWIuaW8vcmVhY3QvZG9jcy90b3AtbGV2ZWwtYXBpLmh0bWwjcmVhY3QuY2hpbGRyZW4ub25seVxuICpcbiAqIFRoZSBjdXJyZW50IGltcGxlbWVudGF0aW9uIG9mIHRoaXMgZnVuY3Rpb24gYXNzdW1lcyB0aGF0IGEgc2luZ2xlIGNoaWxkIGdldHNcbiAqIHBhc3NlZCB3aXRob3V0IGEgd3JhcHBlciwgYnV0IHRoZSBwdXJwb3NlIG9mIHRoaXMgaGVscGVyIGZ1bmN0aW9uIGlzIHRvXG4gKiBhYnN0cmFjdCBhd2F5IHRoZSBwYXJ0aWN1bGFyIHN0cnVjdHVyZSBvZiBjaGlsZHJlbi5cbiAqXG4gKiBAcGFyYW0gez9vYmplY3R9IGNoaWxkcmVuIENoaWxkIGNvbGxlY3Rpb24gc3RydWN0dXJlLlxuICogQHJldHVybiB7UmVhY3RFbGVtZW50fSBUaGUgZmlyc3QgYW5kIG9ubHkgYFJlYWN0RWxlbWVudGAgY29udGFpbmVkIGluIHRoZVxuICogc3RydWN0dXJlLlxuICovXG5mdW5jdGlvbiBvbmx5Q2hpbGQoY2hpbGRyZW4pIHtcbiAgIVJlYWN0RWxlbWVudC5pc1ZhbGlkRWxlbWVudChjaGlsZHJlbikgPyBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nID8gaW52YXJpYW50KGZhbHNlLCAnUmVhY3QuQ2hpbGRyZW4ub25seSBleHBlY3RlZCB0byByZWNlaXZlIGEgc2luZ2xlIFJlYWN0IGVsZW1lbnQgY2hpbGQuJykgOiBfcHJvZEludmFyaWFudCgnMTQzJykgOiB2b2lkIDA7XG4gIHJldHVybiBjaGlsZHJlbjtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBvbmx5Q2hpbGQ7IiwiLyoqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTMtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICpcbiAqIFxuICovXG4ndXNlIHN0cmljdCc7XG5cbi8qKlxuICogV0FSTklORzogRE8gTk9UIG1hbnVhbGx5IHJlcXVpcmUgdGhpcyBtb2R1bGUuXG4gKiBUaGlzIGlzIGEgcmVwbGFjZW1lbnQgZm9yIGBpbnZhcmlhbnQoLi4uKWAgdXNlZCBieSB0aGUgZXJyb3IgY29kZSBzeXN0ZW1cbiAqIGFuZCB3aWxsIF9vbmx5XyBiZSByZXF1aXJlZCBieSB0aGUgY29ycmVzcG9uZGluZyBiYWJlbCBwYXNzLlxuICogSXQgYWx3YXlzIHRocm93cy5cbiAqL1xuXG5mdW5jdGlvbiByZWFjdFByb2RJbnZhcmlhbnQoY29kZSkge1xuICB2YXIgYXJnQ291bnQgPSBhcmd1bWVudHMubGVuZ3RoIC0gMTtcblxuICB2YXIgbWVzc2FnZSA9ICdNaW5pZmllZCBSZWFjdCBlcnJvciAjJyArIGNvZGUgKyAnOyB2aXNpdCAnICsgJ2h0dHA6Ly9mYWNlYm9vay5naXRodWIuaW8vcmVhY3QvZG9jcy9lcnJvci1kZWNvZGVyLmh0bWw/aW52YXJpYW50PScgKyBjb2RlO1xuXG4gIGZvciAodmFyIGFyZ0lkeCA9IDA7IGFyZ0lkeCA8IGFyZ0NvdW50OyBhcmdJZHgrKykge1xuICAgIG1lc3NhZ2UgKz0gJyZhcmdzW109JyArIGVuY29kZVVSSUNvbXBvbmVudChhcmd1bWVudHNbYXJnSWR4ICsgMV0pO1xuICB9XG5cbiAgbWVzc2FnZSArPSAnIGZvciB0aGUgZnVsbCBtZXNzYWdlIG9yIHVzZSB0aGUgbm9uLW1pbmlmaWVkIGRldiBlbnZpcm9ubWVudCcgKyAnIGZvciBmdWxsIGVycm9ycyBhbmQgYWRkaXRpb25hbCBoZWxwZnVsIHdhcm5pbmdzLic7XG5cbiAgdmFyIGVycm9yID0gbmV3IEVycm9yKG1lc3NhZ2UpO1xuICBlcnJvci5uYW1lID0gJ0ludmFyaWFudCBWaW9sYXRpb24nO1xuICBlcnJvci5mcmFtZXNUb1BvcCA9IDE7IC8vIHdlIGRvbid0IGNhcmUgYWJvdXQgcmVhY3RQcm9kSW52YXJpYW50J3Mgb3duIGZyYW1lXG5cbiAgdGhyb3cgZXJyb3I7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gcmVhY3RQcm9kSW52YXJpYW50OyIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTMtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICpcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBfcHJvZEludmFyaWFudCA9IHJlcXVpcmUoJy4vcmVhY3RQcm9kSW52YXJpYW50Jyk7XG5cbnZhciBSZWFjdEN1cnJlbnRPd25lciA9IHJlcXVpcmUoJy4vUmVhY3RDdXJyZW50T3duZXInKTtcbnZhciBSRUFDVF9FTEVNRU5UX1RZUEUgPSByZXF1aXJlKCcuL1JlYWN0RWxlbWVudFN5bWJvbCcpO1xuXG52YXIgZ2V0SXRlcmF0b3JGbiA9IHJlcXVpcmUoJy4vZ2V0SXRlcmF0b3JGbicpO1xudmFyIGludmFyaWFudCA9IHJlcXVpcmUoJ2ZianMvbGliL2ludmFyaWFudCcpO1xudmFyIEtleUVzY2FwZVV0aWxzID0gcmVxdWlyZSgnLi9LZXlFc2NhcGVVdGlscycpO1xudmFyIHdhcm5pbmcgPSByZXF1aXJlKCdmYmpzL2xpYi93YXJuaW5nJyk7XG5cbnZhciBTRVBBUkFUT1IgPSAnLic7XG52YXIgU1VCU0VQQVJBVE9SID0gJzonO1xuXG4vKipcbiAqIFRoaXMgaXMgaW5saW5lZCBmcm9tIFJlYWN0RWxlbWVudCBzaW5jZSB0aGlzIGZpbGUgaXMgc2hhcmVkIGJldHdlZW5cbiAqIGlzb21vcnBoaWMgYW5kIHJlbmRlcmVycy4gV2UgY291bGQgZXh0cmFjdCB0aGlzIHRvIGFcbiAqXG4gKi9cblxuLyoqXG4gKiBUT0RPOiBUZXN0IHRoYXQgYSBzaW5nbGUgY2hpbGQgYW5kIGFuIGFycmF5IHdpdGggb25lIGl0ZW0gaGF2ZSB0aGUgc2FtZSBrZXlcbiAqIHBhdHRlcm4uXG4gKi9cblxudmFyIGRpZFdhcm5BYm91dE1hcHMgPSBmYWxzZTtcblxuLyoqXG4gKiBHZW5lcmF0ZSBhIGtleSBzdHJpbmcgdGhhdCBpZGVudGlmaWVzIGEgY29tcG9uZW50IHdpdGhpbiBhIHNldC5cbiAqXG4gKiBAcGFyYW0geyp9IGNvbXBvbmVudCBBIGNvbXBvbmVudCB0aGF0IGNvdWxkIGNvbnRhaW4gYSBtYW51YWwga2V5LlxuICogQHBhcmFtIHtudW1iZXJ9IGluZGV4IEluZGV4IHRoYXQgaXMgdXNlZCBpZiBhIG1hbnVhbCBrZXkgaXMgbm90IHByb3ZpZGVkLlxuICogQHJldHVybiB7c3RyaW5nfVxuICovXG5mdW5jdGlvbiBnZXRDb21wb25lbnRLZXkoY29tcG9uZW50LCBpbmRleCkge1xuICAvLyBEbyBzb21lIHR5cGVjaGVja2luZyBoZXJlIHNpbmNlIHdlIGNhbGwgdGhpcyBibGluZGx5LiBXZSB3YW50IHRvIGVuc3VyZVxuICAvLyB0aGF0IHdlIGRvbid0IGJsb2NrIHBvdGVudGlhbCBmdXR1cmUgRVMgQVBJcy5cbiAgaWYgKGNvbXBvbmVudCAmJiB0eXBlb2YgY29tcG9uZW50ID09PSAnb2JqZWN0JyAmJiBjb21wb25lbnQua2V5ICE9IG51bGwpIHtcbiAgICAvLyBFeHBsaWNpdCBrZXlcbiAgICByZXR1cm4gS2V5RXNjYXBlVXRpbHMuZXNjYXBlKGNvbXBvbmVudC5rZXkpO1xuICB9XG4gIC8vIEltcGxpY2l0IGtleSBkZXRlcm1pbmVkIGJ5IHRoZSBpbmRleCBpbiB0aGUgc2V0XG4gIHJldHVybiBpbmRleC50b1N0cmluZygzNik7XG59XG5cbi8qKlxuICogQHBhcmFtIHs/Kn0gY2hpbGRyZW4gQ2hpbGRyZW4gdHJlZSBjb250YWluZXIuXG4gKiBAcGFyYW0geyFzdHJpbmd9IG5hbWVTb0ZhciBOYW1lIG9mIHRoZSBrZXkgcGF0aCBzbyBmYXIuXG4gKiBAcGFyYW0geyFmdW5jdGlvbn0gY2FsbGJhY2sgQ2FsbGJhY2sgdG8gaW52b2tlIHdpdGggZWFjaCBjaGlsZCBmb3VuZC5cbiAqIEBwYXJhbSB7Pyp9IHRyYXZlcnNlQ29udGV4dCBVc2VkIHRvIHBhc3MgaW5mb3JtYXRpb24gdGhyb3VnaG91dCB0aGUgdHJhdmVyc2FsXG4gKiBwcm9jZXNzLlxuICogQHJldHVybiB7IW51bWJlcn0gVGhlIG51bWJlciBvZiBjaGlsZHJlbiBpbiB0aGlzIHN1YnRyZWUuXG4gKi9cbmZ1bmN0aW9uIHRyYXZlcnNlQWxsQ2hpbGRyZW5JbXBsKGNoaWxkcmVuLCBuYW1lU29GYXIsIGNhbGxiYWNrLCB0cmF2ZXJzZUNvbnRleHQpIHtcbiAgdmFyIHR5cGUgPSB0eXBlb2YgY2hpbGRyZW47XG5cbiAgaWYgKHR5cGUgPT09ICd1bmRlZmluZWQnIHx8IHR5cGUgPT09ICdib29sZWFuJykge1xuICAgIC8vIEFsbCBvZiB0aGUgYWJvdmUgYXJlIHBlcmNlaXZlZCBhcyBudWxsLlxuICAgIGNoaWxkcmVuID0gbnVsbDtcbiAgfVxuXG4gIGlmIChjaGlsZHJlbiA9PT0gbnVsbCB8fCB0eXBlID09PSAnc3RyaW5nJyB8fCB0eXBlID09PSAnbnVtYmVyJyB8fFxuICAvLyBUaGUgZm9sbG93aW5nIGlzIGlubGluZWQgZnJvbSBSZWFjdEVsZW1lbnQuIFRoaXMgbWVhbnMgd2UgY2FuIG9wdGltaXplXG4gIC8vIHNvbWUgY2hlY2tzLiBSZWFjdCBGaWJlciBhbHNvIGlubGluZXMgdGhpcyBsb2dpYyBmb3Igc2ltaWxhciBwdXJwb3Nlcy5cbiAgdHlwZSA9PT0gJ29iamVjdCcgJiYgY2hpbGRyZW4uJCR0eXBlb2YgPT09IFJFQUNUX0VMRU1FTlRfVFlQRSkge1xuICAgIGNhbGxiYWNrKHRyYXZlcnNlQ29udGV4dCwgY2hpbGRyZW4sXG4gICAgLy8gSWYgaXQncyB0aGUgb25seSBjaGlsZCwgdHJlYXQgdGhlIG5hbWUgYXMgaWYgaXQgd2FzIHdyYXBwZWQgaW4gYW4gYXJyYXlcbiAgICAvLyBzbyB0aGF0IGl0J3MgY29uc2lzdGVudCBpZiB0aGUgbnVtYmVyIG9mIGNoaWxkcmVuIGdyb3dzLlxuICAgIG5hbWVTb0ZhciA9PT0gJycgPyBTRVBBUkFUT1IgKyBnZXRDb21wb25lbnRLZXkoY2hpbGRyZW4sIDApIDogbmFtZVNvRmFyKTtcbiAgICByZXR1cm4gMTtcbiAgfVxuXG4gIHZhciBjaGlsZDtcbiAgdmFyIG5leHROYW1lO1xuICB2YXIgc3VidHJlZUNvdW50ID0gMDsgLy8gQ291bnQgb2YgY2hpbGRyZW4gZm91bmQgaW4gdGhlIGN1cnJlbnQgc3VidHJlZS5cbiAgdmFyIG5leHROYW1lUHJlZml4ID0gbmFtZVNvRmFyID09PSAnJyA/IFNFUEFSQVRPUiA6IG5hbWVTb0ZhciArIFNVQlNFUEFSQVRPUjtcblxuICBpZiAoQXJyYXkuaXNBcnJheShjaGlsZHJlbikpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjaGlsZCA9IGNoaWxkcmVuW2ldO1xuICAgICAgbmV4dE5hbWUgPSBuZXh0TmFtZVByZWZpeCArIGdldENvbXBvbmVudEtleShjaGlsZCwgaSk7XG4gICAgICBzdWJ0cmVlQ291bnQgKz0gdHJhdmVyc2VBbGxDaGlsZHJlbkltcGwoY2hpbGQsIG5leHROYW1lLCBjYWxsYmFjaywgdHJhdmVyc2VDb250ZXh0KTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdmFyIGl0ZXJhdG9yRm4gPSBnZXRJdGVyYXRvckZuKGNoaWxkcmVuKTtcbiAgICBpZiAoaXRlcmF0b3JGbikge1xuICAgICAgdmFyIGl0ZXJhdG9yID0gaXRlcmF0b3JGbi5jYWxsKGNoaWxkcmVuKTtcbiAgICAgIHZhciBzdGVwO1xuICAgICAgaWYgKGl0ZXJhdG9yRm4gIT09IGNoaWxkcmVuLmVudHJpZXMpIHtcbiAgICAgICAgdmFyIGlpID0gMDtcbiAgICAgICAgd2hpbGUgKCEoc3RlcCA9IGl0ZXJhdG9yLm5leHQoKSkuZG9uZSkge1xuICAgICAgICAgIGNoaWxkID0gc3RlcC52YWx1ZTtcbiAgICAgICAgICBuZXh0TmFtZSA9IG5leHROYW1lUHJlZml4ICsgZ2V0Q29tcG9uZW50S2V5KGNoaWxkLCBpaSsrKTtcbiAgICAgICAgICBzdWJ0cmVlQ291bnQgKz0gdHJhdmVyc2VBbGxDaGlsZHJlbkltcGwoY2hpbGQsIG5leHROYW1lLCBjYWxsYmFjaywgdHJhdmVyc2VDb250ZXh0KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgICAgICB2YXIgbWFwc0FzQ2hpbGRyZW5BZGRlbmR1bSA9ICcnO1xuICAgICAgICAgIGlmIChSZWFjdEN1cnJlbnRPd25lci5jdXJyZW50KSB7XG4gICAgICAgICAgICB2YXIgbWFwc0FzQ2hpbGRyZW5Pd25lck5hbWUgPSBSZWFjdEN1cnJlbnRPd25lci5jdXJyZW50LmdldE5hbWUoKTtcbiAgICAgICAgICAgIGlmIChtYXBzQXNDaGlsZHJlbk93bmVyTmFtZSkge1xuICAgICAgICAgICAgICBtYXBzQXNDaGlsZHJlbkFkZGVuZHVtID0gJyBDaGVjayB0aGUgcmVuZGVyIG1ldGhvZCBvZiBgJyArIG1hcHNBc0NoaWxkcmVuT3duZXJOYW1lICsgJ2AuJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/IHdhcm5pbmcoZGlkV2FybkFib3V0TWFwcywgJ1VzaW5nIE1hcHMgYXMgY2hpbGRyZW4gaXMgbm90IHlldCBmdWxseSBzdXBwb3J0ZWQuIEl0IGlzIGFuICcgKyAnZXhwZXJpbWVudGFsIGZlYXR1cmUgdGhhdCBtaWdodCBiZSByZW1vdmVkLiBDb252ZXJ0IGl0IHRvIGEgJyArICdzZXF1ZW5jZSAvIGl0ZXJhYmxlIG9mIGtleWVkIFJlYWN0RWxlbWVudHMgaW5zdGVhZC4lcycsIG1hcHNBc0NoaWxkcmVuQWRkZW5kdW0pIDogdm9pZCAwO1xuICAgICAgICAgIGRpZFdhcm5BYm91dE1hcHMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIEl0ZXJhdG9yIHdpbGwgcHJvdmlkZSBlbnRyeSBbayx2XSB0dXBsZXMgcmF0aGVyIHRoYW4gdmFsdWVzLlxuICAgICAgICB3aGlsZSAoIShzdGVwID0gaXRlcmF0b3IubmV4dCgpKS5kb25lKSB7XG4gICAgICAgICAgdmFyIGVudHJ5ID0gc3RlcC52YWx1ZTtcbiAgICAgICAgICBpZiAoZW50cnkpIHtcbiAgICAgICAgICAgIGNoaWxkID0gZW50cnlbMV07XG4gICAgICAgICAgICBuZXh0TmFtZSA9IG5leHROYW1lUHJlZml4ICsgS2V5RXNjYXBlVXRpbHMuZXNjYXBlKGVudHJ5WzBdKSArIFNVQlNFUEFSQVRPUiArIGdldENvbXBvbmVudEtleShjaGlsZCwgMCk7XG4gICAgICAgICAgICBzdWJ0cmVlQ291bnQgKz0gdHJhdmVyc2VBbGxDaGlsZHJlbkltcGwoY2hpbGQsIG5leHROYW1lLCBjYWxsYmFjaywgdHJhdmVyc2VDb250ZXh0KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdvYmplY3QnKSB7XG4gICAgICB2YXIgYWRkZW5kdW0gPSAnJztcbiAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgIGFkZGVuZHVtID0gJyBJZiB5b3UgbWVhbnQgdG8gcmVuZGVyIGEgY29sbGVjdGlvbiBvZiBjaGlsZHJlbiwgdXNlIGFuIGFycmF5ICcgKyAnaW5zdGVhZCBvciB3cmFwIHRoZSBvYmplY3QgdXNpbmcgY3JlYXRlRnJhZ21lbnQob2JqZWN0KSBmcm9tIHRoZSAnICsgJ1JlYWN0IGFkZC1vbnMuJztcbiAgICAgICAgaWYgKGNoaWxkcmVuLl9pc1JlYWN0RWxlbWVudCkge1xuICAgICAgICAgIGFkZGVuZHVtID0gXCIgSXQgbG9va3MgbGlrZSB5b3UncmUgdXNpbmcgYW4gZWxlbWVudCBjcmVhdGVkIGJ5IGEgZGlmZmVyZW50IFwiICsgJ3ZlcnNpb24gb2YgUmVhY3QuIE1ha2Ugc3VyZSB0byB1c2Ugb25seSBvbmUgY29weSBvZiBSZWFjdC4nO1xuICAgICAgICB9XG4gICAgICAgIGlmIChSZWFjdEN1cnJlbnRPd25lci5jdXJyZW50KSB7XG4gICAgICAgICAgdmFyIG5hbWUgPSBSZWFjdEN1cnJlbnRPd25lci5jdXJyZW50LmdldE5hbWUoKTtcbiAgICAgICAgICBpZiAobmFtZSkge1xuICAgICAgICAgICAgYWRkZW5kdW0gKz0gJyBDaGVjayB0aGUgcmVuZGVyIG1ldGhvZCBvZiBgJyArIG5hbWUgKyAnYC4nO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdmFyIGNoaWxkcmVuU3RyaW5nID0gU3RyaW5nKGNoaWxkcmVuKTtcbiAgICAgICFmYWxzZSA/IHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyBpbnZhcmlhbnQoZmFsc2UsICdPYmplY3RzIGFyZSBub3QgdmFsaWQgYXMgYSBSZWFjdCBjaGlsZCAoZm91bmQ6ICVzKS4lcycsIGNoaWxkcmVuU3RyaW5nID09PSAnW29iamVjdCBPYmplY3RdJyA/ICdvYmplY3Qgd2l0aCBrZXlzIHsnICsgT2JqZWN0LmtleXMoY2hpbGRyZW4pLmpvaW4oJywgJykgKyAnfScgOiBjaGlsZHJlblN0cmluZywgYWRkZW5kdW0pIDogX3Byb2RJbnZhcmlhbnQoJzMxJywgY2hpbGRyZW5TdHJpbmcgPT09ICdbb2JqZWN0IE9iamVjdF0nID8gJ29iamVjdCB3aXRoIGtleXMgeycgKyBPYmplY3Qua2V5cyhjaGlsZHJlbikuam9pbignLCAnKSArICd9JyA6IGNoaWxkcmVuU3RyaW5nLCBhZGRlbmR1bSkgOiB2b2lkIDA7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHN1YnRyZWVDb3VudDtcbn1cblxuLyoqXG4gKiBUcmF2ZXJzZXMgY2hpbGRyZW4gdGhhdCBhcmUgdHlwaWNhbGx5IHNwZWNpZmllZCBhcyBgcHJvcHMuY2hpbGRyZW5gLCBidXRcbiAqIG1pZ2h0IGFsc28gYmUgc3BlY2lmaWVkIHRocm91Z2ggYXR0cmlidXRlczpcbiAqXG4gKiAtIGB0cmF2ZXJzZUFsbENoaWxkcmVuKHRoaXMucHJvcHMuY2hpbGRyZW4sIC4uLilgXG4gKiAtIGB0cmF2ZXJzZUFsbENoaWxkcmVuKHRoaXMucHJvcHMubGVmdFBhbmVsQ2hpbGRyZW4sIC4uLilgXG4gKlxuICogVGhlIGB0cmF2ZXJzZUNvbnRleHRgIGlzIGFuIG9wdGlvbmFsIGFyZ3VtZW50IHRoYXQgaXMgcGFzc2VkIHRocm91Z2ggdGhlXG4gKiBlbnRpcmUgdHJhdmVyc2FsLiBJdCBjYW4gYmUgdXNlZCB0byBzdG9yZSBhY2N1bXVsYXRpb25zIG9yIGFueXRoaW5nIGVsc2UgdGhhdFxuICogdGhlIGNhbGxiYWNrIG1pZ2h0IGZpbmQgcmVsZXZhbnQuXG4gKlxuICogQHBhcmFtIHs/Kn0gY2hpbGRyZW4gQ2hpbGRyZW4gdHJlZSBvYmplY3QuXG4gKiBAcGFyYW0geyFmdW5jdGlvbn0gY2FsbGJhY2sgVG8gaW52b2tlIHVwb24gdHJhdmVyc2luZyBlYWNoIGNoaWxkLlxuICogQHBhcmFtIHs/Kn0gdHJhdmVyc2VDb250ZXh0IENvbnRleHQgZm9yIHRyYXZlcnNhbC5cbiAqIEByZXR1cm4geyFudW1iZXJ9IFRoZSBudW1iZXIgb2YgY2hpbGRyZW4gaW4gdGhpcyBzdWJ0cmVlLlxuICovXG5mdW5jdGlvbiB0cmF2ZXJzZUFsbENoaWxkcmVuKGNoaWxkcmVuLCBjYWxsYmFjaywgdHJhdmVyc2VDb250ZXh0KSB7XG4gIGlmIChjaGlsZHJlbiA9PSBudWxsKSB7XG4gICAgcmV0dXJuIDA7XG4gIH1cblxuICByZXR1cm4gdHJhdmVyc2VBbGxDaGlsZHJlbkltcGwoY2hpbGRyZW4sICcnLCBjYWxsYmFjaywgdHJhdmVyc2VDb250ZXh0KTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB0cmF2ZXJzZUFsbENoaWxkcmVuOyIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2xpYi9SZWFjdCcpO1xuIiwiaW1wb3J0IFJlYWN0LCB7IENvbXBvbmVudCB9ICBmcm9tICdyZWFjdCc7XG5cbiBjbGFzcyBEeW5hbWljU2VhcmNoIGV4dGVuZHMgQ29tcG9uZW50IHtcblxuICAgIGNvbnN0cnVjdG9yKHByb3BzKXtcbiAgICAgICAgc3VwZXIocHJvcHMpO1xuICAgIH07XG5cbiAgICBnZXRJbml0aWFsU3RhdGUoKXtcbiAgICAgICAgcmV0dXJuIHsgc2VhcmNoU3RyaW5nOiAnJyB9O1xuICAgIH1cblxuICAgIGhhbmRsZUNoYW5nZSgpe1xuICAgICAgICB0aGlzLnNldFN0YXRlKHtzZWFyY2hTdHJpbmc6ZXZlbnQudGFyZ2V0LnZhbHVlfSk7ICAgICAgICBcbiAgICB9XG5cbiAgICByZW5kZXIoKXtcbiAgICB2YXIgY291bnRyaWVzID0gdGhpcy5wcm9wcy5pdGVtcztcbiAgICB2YXIgc2VhcmNoU3RyaW5nID0gdGhpcy5zdGF0ZS5zZWFyY2hTdHJpbmcudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gICAgLy8gZmlsdGVyIGNvdW50cmllcyBsaXN0IGJ5IHZhbHVlIGZyb20gaW5wdXQgYm94XG4gICAgaWYoc2VhcmNoU3RyaW5nLmxlbmd0aCA+IDApe1xuICAgICAgICBjb3VudHJpZXMgPSBjb3VudHJpZXMuZmlsdGVyKGZ1bmN0aW9uKGNvdW50cnkpe1xuICAgICAgICByZXR1cm4gY291bnRyeS5uYW1lLnRvTG93ZXJDYXNlKCkubWF0Y2goIHNlYXJjaFN0cmluZyApO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIChcbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzZWFyY2gtY29tcG9uZW50XCI+XG4gICAgICAgIDxpbnB1dCB0eXBlPVwidGV4dFwiIHZhbHVlPXt0aGlzLnN0YXRlLnNlYXJjaFN0cmluZ30gb25DaGFuZ2U9e3RoaXMuaGFuZGxlQ2hhbmdlfSBwbGFjZWhvbGRlcj1cIlNlYXJjaCFcIiAvPlxuICAgICAgICA8dWw+XG4gICAgICAgICAgICB7IGNvdW50cmllcy5tYXAoZnVuY3Rpb24oY291bnRyeSl7IHJldHVybiA8bGk+e2NvdW50cnkubmFtZX0gPC9saT4gfSkgfVxuICAgICAgICA8L3VsPlxuICAgICAgICA8L2Rpdj5cbiAgICApfVxuXG4gfSAgXG4gXG4gZXhwb3J0IGRlZmF1bHQgRHluYW1pY1NlYXJjaFxuICIsImltcG9ydCBSZWFjdCwgeyBDb21wb25lbnQgfSAgZnJvbSAncmVhY3QnO1xuXG5cbmNsYXNzIE5hdiBleHRlbmRzIENvbXBvbmVudCB7ICBcblxuICAgIGNvbnN0cnVjdG9yKHByb3BzKXtcbiAgICBzdXBlcihwcm9wcyk7XG4gICAgLy8gdGhpcy50ZXN0R2V0KCk7XG4gICAgfTtcblxuICAgIHJlbmRlcigpe1xuICAgIHJldHVybiAoXG4gICAgICAgIDxuYXYgaWQ9XCJtYWluTmF2XCIgY2xhc3NOYW1lPVwibmF2YmFyIG5hdmJhci1kZWZhdWx0IG5hdmJhci1maXhlZC10b3AgbmF2YmFyLWN1c3RvbVwiPlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImNvbnRhaW5lclwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJuYXZiYXItaGVhZGVyIHBhZ2Utc2Nyb2xsXCI+XG4gICAgICAgICAgICA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzc05hbWU9XCJuYXZiYXItdG9nZ2xlXCIgZGF0YS10b2dnbGU9XCJjb2xsYXBzZVwiIGRhdGEtdGFyZ2V0PVwiI2JzLWV4YW1wbGUtbmF2YmFyLWNvbGxhcHNlLTFcIj5cbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJzci1vbmx5XCI+VG9nZ2xlIG5hdmlnYXRpb248L3NwYW4+IE1lbnUgPGkgY2xhc3NOYW1lPVwiZmEgZmEtYmFyc1wiIC8+XG4gICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgIDxhIGNsYXNzTmFtZT1cIm5hdmJhci1icmFuZFwiIGhyZWY9XCIvXCI+SW1ncmFiPC9hPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImNvbGxhcHNlIG5hdmJhci1jb2xsYXBzZVwiIGlkPVwiYnMtZXhhbXBsZS1uYXZiYXItY29sbGFwc2UtMVwiPlxuICAgICAgICAgICAgPHVsIGNsYXNzTmFtZT1cIm5hdiBuYXZiYXItbmF2IG5hdmJhci1yaWdodFwiPlxuICAgICAgICAgICAgICAgIDxsaSBjbGFzc05hbWU9XCJoaWRkZW5cIj5cbiAgICAgICAgICAgICAgICA8YSBocmVmPVwiI3BhZ2UtdG9wXCIgLz5cbiAgICAgICAgICAgICAgICA8L2xpPlxuICAgICAgICAgICAgICAgIDxsaSBjbGFzc05hbWU9XCJwYWdlLXNjcm9sbFwiPlxuICAgICAgICAgICAgICAgIDxhIGhyZWY9XCIvaW1hZ2VzXCI+TXkgSW1hZ2VzPC9hPlxuICAgICAgICAgICAgICAgIDwvbGk+XG4gICAgICAgICAgICAgICAgPGxpIGNsYXNzTmFtZT1cInBhZ2Utc2Nyb2xsXCI+XG4gICAgICAgICAgICAgICAgPGEgaHJlZj1cIiNcIj5IZWxwPC9hPlxuICAgICAgICAgICAgICAgIDwvbGk+XG4gICAgICAgICAgICAgICAgPGxpIGNsYXNzTmFtZT1cInBhZ2Utc2Nyb2xsXCI+XG4gICAgICAgICAgICAgICAgPGEgaHJlZj1cIiNcIj5Db250YWN0PC9hPlxuICAgICAgICAgICAgICAgIDwvbGk+XG4gICAgICAgICAgICA8L3VsPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8L25hdj5cbiAgICApfTtcblxuICAgIC8vIHRlc3RHZXQoKSB7XG4gICAgLy8gYXhpb3MuZ2V0KCdodHRwOi8vMTI3LjAuMC4xOjUwMDAvYXBpL2ltYWdlcycpXG4gICAgLy8gLnRoZW4oZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG4gICAgLy8gICAgIGNvbnNvbGUubG9nKHJlc3BvbnNlKTtcbiAgICAvLyB9KVxuICAgIC8vIC5jYXRjaChmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAvLyAgICAgY29uc29sZS5sb2coZXJyb3IpO1xuICAgIC8vIH0pO1xuICAgIC8vIH1cblxufTtcblxuZXhwb3J0IGRlZmF1bHQgTmF2XG4iLCJpbXBvcnQgUmVhY3QsIHsgQ29tcG9uZW50IH0gIGZyb20gJ3JlYWN0JztcblxuY2xhc3MgUGFnZUNvbnRhaW5lciBleHRlbmRzIENvbXBvbmVudCB7XG4gICAgcmVuZGVyKCkge1xuICAgICAgcmV0dXJuIChcbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJwYWdlLWNvbnRhaW5lclwiPlxuICAgICAgICAgIHt0aGlzLnByb3BzLmNoaWxkcmVufVxuICAgICAgICA8L2Rpdj5cbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgZXhwb3J0IGRlZmF1bHQgUGFnZUNvbnRhaW5lclxuICAiLCJpbXBvcnQgYXhpb3MgZnJvbSAnYXhpb3MnO1xuaW1wb3J0IFJlYWN0LCB7IENvbXBvbmVudCB9ICBmcm9tICdyZWFjdCc7XG5cbmltcG9ydCBOYXYgZnJvbSAnLi9jb21wb25lbnRzL25hdic7XG5pbXBvcnQgRHluYW1pY1NlYXJjaCBmcm9tICcuL2NvbXBvbmVudHMvZHluYW1pY19zZWFyY2gnO1xuaW1wb3J0IFBhZ2VDb250YWluZXIgZnJvbSAnLi9jb21wb25lbnRzL3BhZ2VfY29udGFpbmVyJztcblxuXG52YXIgY291bnRyaWVzID0gW1xuICB7XCJuYW1lXCI6IFwiU3dlZGVuXCJ9LCB7XCJuYW1lXCI6IFwiQ2hpbmFcIn0sIHtcIm5hbWVcIjogXCJQZXJ1XCJ9LCB7XCJuYW1lXCI6IFwiQ3plY2ggUmVwdWJsaWNcIn0sXG4gIHtcIm5hbWVcIjogXCJCb2xpdmlhXCJ9LCB7XCJuYW1lXCI6IFwiTGF0dmlhXCJ9LCB7XCJuYW1lXCI6IFwiU2Ftb2FcIn0sIHtcIm5hbWVcIjogXCJBcm1lbmlhXCJ9LFxuICB7XCJuYW1lXCI6IFwiR3JlZW5sYW5kXCJ9LCB7XCJuYW1lXCI6IFwiQ3ViYVwifSwge1wibmFtZVwiOiBcIldlc3Rlcm4gU2FoYXJhXCJ9LCB7XCJuYW1lXCI6IFwiRXRoaW9waWFcIn0sXG4gIHtcIm5hbWVcIjogXCJNYWxheXNpYVwifSwge1wibmFtZVwiOiBcIkFyZ2VudGluYVwifSwge1wibmFtZVwiOiBcIlVnYW5kYVwifSwge1wibmFtZVwiOiBcIkNoaWxlXCJ9LFxuICB7XCJuYW1lXCI6IFwiQXJ1YmFcIn0sIHtcIm5hbWVcIjogXCJKYXBhblwifSwge1wibmFtZVwiOiBcIlRyaW5pZGFkIGFuZCBUb2JhZ29cIn0sIHtcIm5hbWVcIjogXCJJdGFseVwifSxcbiAge1wibmFtZVwiOiBcIkNhbWJvZGlhXCJ9LCB7XCJuYW1lXCI6IFwiSWNlbGFuZFwifSwge1wibmFtZVwiOiBcIkRvbWluaWNhbiBSZXB1YmxpY1wifSwge1wibmFtZVwiOiBcIlR1cmtleVwifSxcbiAge1wibmFtZVwiOiBcIlNwYWluXCJ9LCB7XCJuYW1lXCI6IFwiUG9sYW5kXCJ9LCB7XCJuYW1lXCI6IFwiSGFpdGlcIn1cbl07XG5cbiAgXG5sZXQgTWFpbkNvbnRlbnQgPSAoXG4gIDxkaXY+XG4gICAgPE5hdiAvPlxuICAgIDxQYWdlQ29udGFpbmVyPlxuICAgICAgPER5bmFtaWNTZWFyY2ggaXRlbXM9eyBjb3VudHJpZXMgfSAvPlxuICAgIDwvUGFnZUNvbnRhaW5lcj5cbiAgPC9kaXY+XG4pO1xuXG5SZWFjdERPTS5yZW5kZXIoXG4gIE1haW5Db250ZW50ICwgXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYXBwLWNvbnRhaW5lclwiKVxuKTtcbiJdLCJwcmVFeGlzdGluZ0NvbW1lbnQiOiIvLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247Y2hhcnNldD11dGYtODtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSnpiM1Z5WTJWeklqcGJJbTV2WkdWZmJXOWtkV3hsY3k5aWNtOTNjMlZ5TFhCaFkyc3ZYM0J5Wld4MVpHVXVhbk1pTENKdWIyUmxYMjF2WkhWc1pYTXZZWGhwYjNNdmFXNWtaWGd1YW5NaUxDSnViMlJsWDIxdlpIVnNaWE12WVhocGIzTXZiR2xpTDJGa1lYQjBaWEp6TDNob2NpNXFjeUlzSW01dlpHVmZiVzlrZFd4bGN5OWhlR2x2Y3k5c2FXSXZZWGhwYjNNdWFuTWlMQ0p1YjJSbFgyMXZaSFZzWlhNdllYaHBiM012YkdsaUwyTmhibU5sYkM5RFlXNWpaV3d1YW5NaUxDSnViMlJsWDIxdlpIVnNaWE12WVhocGIzTXZiR2xpTDJOaGJtTmxiQzlEWVc1alpXeFViMnRsYmk1cWN5SXNJbTV2WkdWZmJXOWtkV3hsY3k5aGVHbHZjeTlzYVdJdlkyRnVZMlZzTDJselEyRnVZMlZzTG1weklpd2libTlrWlY5dGIyUjFiR1Z6TDJGNGFXOXpMMnhwWWk5amIzSmxMMEY0YVc5ekxtcHpJaXdpYm05a1pWOXRiMlIxYkdWekwyRjRhVzl6TDJ4cFlpOWpiM0psTDBsdWRHVnlZMlZ3ZEc5eVRXRnVZV2RsY2k1cWN5SXNJbTV2WkdWZmJXOWtkV3hsY3k5aGVHbHZjeTlzYVdJdlkyOXlaUzlqY21WaGRHVkZjbkp2Y2k1cWN5SXNJbTV2WkdWZmJXOWtkV3hsY3k5aGVHbHZjeTlzYVdJdlkyOXlaUzlrYVhOd1lYUmphRkpsY1hWbGMzUXVhbk1pTENKdWIyUmxYMjF2WkhWc1pYTXZZWGhwYjNNdmJHbGlMMk52Y21VdlpXNW9ZVzVqWlVWeWNtOXlMbXB6SWl3aWJtOWtaVjl0YjJSMWJHVnpMMkY0YVc5ekwyeHBZaTlqYjNKbEwzTmxkSFJzWlM1cWN5SXNJbTV2WkdWZmJXOWtkV3hsY3k5aGVHbHZjeTlzYVdJdlkyOXlaUzkwY21GdWMyWnZjbTFFWVhSaExtcHpJaXdpYm05a1pWOXRiMlIxYkdWekwyRjRhVzl6TDJ4cFlpOWtaV1poZFd4MGN5NXFjeUlzSW01dlpHVmZiVzlrZFd4bGN5OWhlR2x2Y3k5c2FXSXZhR1ZzY0dWeWN5OWlhVzVrTG1weklpd2libTlrWlY5dGIyUjFiR1Z6TDJGNGFXOXpMMnhwWWk5b1pXeHdaWEp6TDJKMGIyRXVhbk1pTENKdWIyUmxYMjF2WkhWc1pYTXZZWGhwYjNNdmJHbGlMMmhsYkhCbGNuTXZZblZwYkdSVlVrd3Vhbk1pTENKdWIyUmxYMjF2WkhWc1pYTXZZWGhwYjNNdmJHbGlMMmhsYkhCbGNuTXZZMjl0WW1sdVpWVlNUSE11YW5NaUxDSnViMlJsWDIxdlpIVnNaWE12WVhocGIzTXZiR2xpTDJobGJIQmxjbk12WTI5dmEybGxjeTVxY3lJc0ltNXZaR1ZmYlc5a2RXeGxjeTloZUdsdmN5OXNhV0l2YUdWc2NHVnljeTlwYzBGaWMyOXNkWFJsVlZKTUxtcHpJaXdpYm05a1pWOXRiMlIxYkdWekwyRjRhVzl6TDJ4cFlpOW9aV3h3WlhKekwybHpWVkpNVTJGdFpVOXlhV2RwYmk1cWN5SXNJbTV2WkdWZmJXOWtkV3hsY3k5aGVHbHZjeTlzYVdJdmFHVnNjR1Z5Y3k5dWIzSnRZV3hwZW1WSVpXRmtaWEpPWVcxbExtcHpJaXdpYm05a1pWOXRiMlIxYkdWekwyRjRhVzl6TDJ4cFlpOW9aV3h3WlhKekwzQmhjbk5sU0dWaFpHVnljeTVxY3lJc0ltNXZaR1ZmYlc5a2RXeGxjeTloZUdsdmN5OXNhV0l2YUdWc2NHVnljeTl6Y0hKbFlXUXVhbk1pTENKdWIyUmxYMjF2WkhWc1pYTXZZWGhwYjNNdmJHbGlMM1YwYVd4ekxtcHpJaXdpYm05a1pWOXRiMlIxYkdWekwyTnlaV0YwWlMxeVpXRmpkQzFqYkdGemN5OW1ZV04wYjNKNUxtcHpJaXdpYm05a1pWOXRiMlIxYkdWekwyTnlaV0YwWlMxeVpXRmpkQzFqYkdGemN5OXViMlJsWDIxdlpIVnNaWE12YjJKcVpXTjBMV0Z6YzJsbmJpOXBibVJsZUM1cWN5SXNJbTV2WkdWZmJXOWtkV3hsY3k5bVltcHpMMnhwWWk5bGJYQjBlVVoxYm1OMGFXOXVMbXB6SWl3aWJtOWtaVjl0YjJSMWJHVnpMMlppYW5NdmJHbGlMMlZ0Y0hSNVQySnFaV04wTG1weklpd2libTlrWlY5dGIyUjFiR1Z6TDJaaWFuTXZiR2xpTDJsdWRtRnlhV0Z1ZEM1cWN5SXNJbTV2WkdWZmJXOWtkV3hsY3k5bVltcHpMMnhwWWk5M1lYSnVhVzVuTG1weklpd2libTlrWlY5dGIyUjFiR1Z6TDJsekxXSjFabVpsY2k5cGJtUmxlQzVxY3lJc0ltNXZaR1ZmYlc5a2RXeGxjeTl3Y205alpYTnpMMkp5YjNkelpYSXVhbk1pTENKdWIyUmxYMjF2WkhWc1pYTXZjSEp2Y0MxMGVYQmxjeTlqYUdWamExQnliM0JVZVhCbGN5NXFjeUlzSW01dlpHVmZiVzlrZFd4bGN5OXdjbTl3TFhSNWNHVnpMMlpoWTNSdmNua3Vhbk1pTENKdWIyUmxYMjF2WkhWc1pYTXZjSEp2Y0MxMGVYQmxjeTltWVdOMGIzSjVWMmwwYUZSNWNHVkRhR1ZqYTJWeWN5NXFjeUlzSW01dlpHVmZiVzlrZFd4bGN5OXdjbTl3TFhSNWNHVnpMMnhwWWk5U1pXRmpkRkJ5YjNCVWVYQmxjMU5sWTNKbGRDNXFjeUlzSW01dlpHVmZiVzlrZFd4bGN5OXlaV0ZqZEM5c2FXSXZTMlY1UlhOallYQmxWWFJwYkhNdWFuTWlMQ0p1YjJSbFgyMXZaSFZzWlhNdmNtVmhZM1F2YkdsaUwxQnZiMnhsWkVOc1lYTnpMbXB6SWl3aWJtOWtaVjl0YjJSMWJHVnpMM0psWVdOMEwyeHBZaTlTWldGamRDNXFjeUlzSW01dlpHVmZiVzlrZFd4bGN5OXlaV0ZqZEM5c2FXSXZVbVZoWTNSQ1lYTmxRMnhoYzNObGN5NXFjeUlzSW01dlpHVmZiVzlrZFd4bGN5OXlaV0ZqZEM5c2FXSXZVbVZoWTNSRGFHbHNaSEpsYmk1cWN5SXNJbTV2WkdWZmJXOWtkV3hsY3k5eVpXRmpkQzlzYVdJdlVtVmhZM1JEYjIxd2IyNWxiblJVY21WbFNHOXZheTVxY3lJc0ltNXZaR1ZmYlc5a2RXeGxjeTl5WldGamRDOXNhV0l2VW1WaFkzUkRkWEp5Wlc1MFQzZHVaWEl1YW5NaUxDSnViMlJsWDIxdlpIVnNaWE12Y21WaFkzUXZiR2xpTDFKbFlXTjBSRTlOUm1GamRHOXlhV1Z6TG1weklpd2libTlrWlY5dGIyUjFiR1Z6TDNKbFlXTjBMMnhwWWk5U1pXRmpkRVZzWlcxbGJuUXVhbk1pTENKdWIyUmxYMjF2WkhWc1pYTXZjbVZoWTNRdmJHbGlMMUpsWVdOMFJXeGxiV1Z1ZEZONWJXSnZiQzVxY3lJc0ltNXZaR1ZmYlc5a2RXeGxjeTl5WldGamRDOXNhV0l2VW1WaFkzUkZiR1Z0Wlc1MFZtRnNhV1JoZEc5eUxtcHpJaXdpYm05a1pWOXRiMlIxYkdWekwzSmxZV04wTDJ4cFlpOVNaV0ZqZEU1dmIzQlZjR1JoZEdWUmRXVjFaUzVxY3lJc0ltNXZaR1ZmYlc5a2RXeGxjeTl5WldGamRDOXNhV0l2VW1WaFkzUlFjbTl3Vkhsd1pVeHZZMkYwYVc5dVRtRnRaWE11YW5NaUxDSnViMlJsWDIxdlpIVnNaWE12Y21WaFkzUXZiR2xpTDFKbFlXTjBVSEp2Y0ZSNWNHVnpMbXB6SWl3aWJtOWtaVjl0YjJSMWJHVnpMM0psWVdOMEwyeHBZaTlTWldGamRGQnliM0JVZVhCbGMxTmxZM0psZEM1cWN5SXNJbTV2WkdWZmJXOWtkV3hsY3k5eVpXRmpkQzlzYVdJdlVtVmhZM1JXWlhKemFXOXVMbXB6SWl3aWJtOWtaVjl0YjJSMWJHVnpMM0psWVdOMEwyeHBZaTlqWVc1RVpXWnBibVZRY205d1pYSjBlUzVxY3lJc0ltNXZaR1ZmYlc5a2RXeGxjeTl5WldGamRDOXNhV0l2WTJobFkydFNaV0ZqZEZSNWNHVlRjR1ZqTG1weklpd2libTlrWlY5dGIyUjFiR1Z6TDNKbFlXTjBMMnhwWWk5amNtVmhkR1ZEYkdGemN5NXFjeUlzSW01dlpHVmZiVzlrZFd4bGN5OXlaV0ZqZEM5c2FXSXZaMlYwU1hSbGNtRjBiM0pHYmk1cWN5SXNJbTV2WkdWZmJXOWtkV3hsY3k5eVpXRmpkQzlzYVdJdmJHOTNVSEpwYjNKcGRIbFhZWEp1YVc1bkxtcHpJaXdpYm05a1pWOXRiMlIxYkdWekwzSmxZV04wTDJ4cFlpOXZibXg1UTJocGJHUXVhbk1pTENKdWIyUmxYMjF2WkhWc1pYTXZjbVZoWTNRdmJHbGlMM0psWVdOMFVISnZaRWx1ZG1GeWFXRnVkQzVxY3lJc0ltNXZaR1ZmYlc5a2RXeGxjeTl5WldGamRDOXNhV0l2ZEhKaGRtVnljMlZCYkd4RGFHbHNaSEpsYmk1cWN5SXNJbTV2WkdWZmJXOWtkV3hsY3k5eVpXRmpkQzl5WldGamRDNXFjeUlzSW5CeWIycGxZM1F2YzNSaGRHbGpMM05qY21sd2RITXZhbk40TDJOdmJYQnZibVZ1ZEhNdlpIbHVZVzFwWTE5elpXRnlZMmd1YW5NaUxDSndjbTlxWldOMEwzTjBZWFJwWXk5elkzSnBjSFJ6TDJwemVDOWpiMjF3YjI1bGJuUnpMMjVoZGk1cWN5SXNJbkJ5YjJwbFkzUXZjM1JoZEdsakwzTmpjbWx3ZEhNdmFuTjRMMk52YlhCdmJtVnVkSE12Y0dGblpWOWpiMjUwWVdsdVpYSXVhbk1pTENKd2NtOXFaV04wTDNOMFlYUnBZeTl6WTNKcGNIUnpMMnB6ZUM5dFlXbHVMbXB6SWwwc0ltNWhiV1Z6SWpwYlhTd2liV0Z3Y0dsdVozTWlPaUpCUVVGQk8wRkRRVUU3T3p0QlEwRkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPenM3TzBGRGNFeEJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdPMEZEY0VSQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3TzBGRGJrSkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk96dEJRM3BFUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3TzBGRFRFRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk96dEJRM1JHUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CT3p0QlEzQkVRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHM3UVVOc1FrRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUczdRVU12UlVFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3TzBGRGNrSkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVRzN1FVTXhRa0U3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CT3pzN1FVTndRa0U3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CT3pzN08wRkROVVpCTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVRzN1FVTllRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHM3UVVOd1EwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk96dEJRM0JGUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3TzBGRFpFRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CT3p0QlEzSkVRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdPMEZEWkVFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CT3p0QlEzQkZRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUczdRVU5hUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPenRCUTNKRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUczdRVU16UWtFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdPenRCUXk5VFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3T3pzN1FVTjRNa0pCTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CT3p0QlF6RkdRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk96czdRVU55UTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN096czdPMEZEYkVKQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk96czdPenRCUTNSRVFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUczdPenRCUXk5RVFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVRzN1FVTnlRa0U3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVRzN08wRkRlRXhCTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3T3pzN1FVTTNSRUU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdPenRCUTNKQ1FUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3T3pzN1FVTm9aMEpCTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHM3UVVOa1FUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVRzN08wRkRla1JCTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVRzN096czdRVU01UjBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUczdPenM3UVVOc1NVRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3T3pzN1FVTTNTVUU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3T3p0QlF6ZE1RVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN096czdRVU42V0VFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN096dEJRek5DUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3T3pzN08wRkRka3RCTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk96czdPMEZEYmxaQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk96czdRVU5zUWtFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHM3T3pzN1FVTTNVRUU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdPenM3TzBGRE4wWkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUczdPenRCUTNaQ1FUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3TzBGRGFrSkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CT3p0QlEyWkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk96czdRVU5hUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUczdPenM3UVVONFFrRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHM3T3p0QlEzSkdRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUczdRVU55UWtFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3T3p0QlEzWkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHM3T3pzN1FVTXZSRUU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3T3pzN1FVTndRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUczdPMEZEY2tOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CT3pzN096czdRVU01UzBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3T3pzN096czdPenM3UVVOSVFUczdPenM3T3pzN096czdPMGxCUlU4c1lUczdPMEZCUlVnc01rSkJRVmtzUzBGQldpeEZRVUZyUWp0QlFVRkJPenRCUVVGQkxEWklRVU5TTEV0QlJGRTdRVUZGYWtJN096czdNRU5CUldkQ08wRkJRMklzYlVKQlFVOHNSVUZCUlN4alFVRmpMRVZCUVdoQ0xFVkJRVkE3UVVGRFNEczdPM1ZEUVVWaE8wRkJRMVlzYVVKQlFVc3NVVUZCVEN4RFFVRmpMRVZCUVVNc1kwRkJZU3hOUVVGTkxFMUJRVTRzUTBGQllTeExRVUV6UWl4RlFVRmtPMEZCUTBnN096dHBRMEZGVHp0QlFVTlNMR2RDUVVGSkxGbEJRVmtzUzBGQlN5eExRVUZNTEVOQlFWY3NTMEZCTTBJN1FVRkRRU3huUWtGQlNTeGxRVUZsTEV0QlFVc3NTMEZCVEN4RFFVRlhMRmxCUVZnc1EwRkJkMElzU1VGQmVFSXNSMEZCSzBJc1YwRkJMMElzUlVGQmJrSTdRVUZEUVR0QlFVTkJMR2RDUVVGSExHRkJRV0VzVFVGQllpeEhRVUZ6UWl4RFFVRjZRaXhGUVVFeVFqdEJRVU4yUWl3MFFrRkJXU3hWUVVGVkxFMUJRVllzUTBGQmFVSXNWVUZCVXl4UFFVRlVMRVZCUVdsQ08wRkJRemxETERKQ1FVRlBMRkZCUVZFc1NVRkJVaXhEUVVGaExGZEJRV0lzUjBGQk1rSXNTMEZCTTBJc1EwRkJhME1zV1VGQmJFTXNRMEZCVUR0QlFVTkRMR2xDUVVaWExFTkJRVm83UVVGSFNEczdRVUZGUkN4dFFrRkRTVHRCUVVGQk8wRkJRVUVzYTBKQlFVc3NWMEZCVlN4clFrRkJaanRCUVVOQkxIbEVRVUZQTEUxQlFVc3NUVUZCV2l4RlFVRnRRaXhQUVVGUExFdEJRVXNzUzBGQlRDeERRVUZYTEZsQlFYSkRMRVZCUVcxRUxGVkJRVlVzUzBGQlN5eFpRVUZzUlN4RlFVRm5SaXhoUVVGWkxGTkJRVFZHTEVkQlJFRTdRVUZGUVR0QlFVRkJPMEZCUVVFN1FVRkRUU3c0UWtGQlZTeEhRVUZXTEVOQlFXTXNWVUZCVXl4UFFVRlVMRVZCUVdsQ08wRkJRVVVzSzBKQlFVODdRVUZCUVR0QlFVRkJPMEZCUVVzc2IwTkJRVkVzU1VGQllqdEJRVUZCTzBGQlFVRXNlVUpCUVZBN1FVRkJhVU1zY1VKQlFXeEZPMEZCUkU0N1FVRkdRU3hoUVVSS08wRkJUMFU3T3pzN096dHJRa0ZKVlN4aE96czdPenM3T3pzN096dEJRM0pEYUVJN096czdPenM3T3pzN096dEpRVWROTEVjN096dEJRVVZHTEdsQ1FVRlpMRXRCUVZvc1JVRkJhMEk3UVVGQlFUczdRVUZCUVN4NVIwRkRXaXhMUVVSWk8wRkJSV3hDTzBGQlEwTTdPenM3YVVOQlJVODdRVUZEVWl4dFFrRkRTVHRCUVVGQk8wRkJRVUVzYTBKQlFVc3NTVUZCUnl4VFFVRlNMRVZCUVd0Q0xGZEJRVlVzYzBSQlFUVkNPMEZCUTBFN1FVRkJRVHRCUVVGQkxITkNRVUZMTEZkQlFWVXNWMEZCWmp0QlFVTkpPMEZCUVVFN1FVRkJRU3d3UWtGQlN5eFhRVUZWTERKQ1FVRm1PMEZCUTBFN1FVRkJRVHRCUVVGQkxEaENRVUZSTEUxQlFVc3NVVUZCWWl4RlFVRnpRaXhYUVVGVkxHVkJRV2hETEVWQlFXZEVMR1ZCUVZrc1ZVRkJOVVFzUlVGQmRVVXNaVUZCV1N3clFrRkJia1k3UVVGRFNUdEJRVUZCTzBGQlFVRXNhME5CUVUwc1YwRkJWU3hUUVVGb1FqdEJRVUZCTzBGQlFVRXNOa0pCUkVvN1FVRkJRVHRCUVVNMFJDeHBSVUZCUnl4WFFVRlZMRmxCUVdJN1FVRkVOVVFzZVVKQlJFRTdRVUZKUVR0QlFVRkJPMEZCUVVFc09FSkJRVWNzVjBGQlZTeGpRVUZpTEVWQlFUUkNMRTFCUVVzc1IwRkJha003UVVGQlFUdEJRVUZCTzBGQlNrRXNjVUpCUkVvN1FVRlBTVHRCUVVGQk8wRkJRVUVzTUVKQlFVc3NWMEZCVlN3d1FrRkJaaXhGUVVFd1F5eEpRVUZITERoQ1FVRTNRenRCUVVOQk8wRkJRVUU3UVVGQlFTdzRRa0ZCU1N4WFFVRlZMRFpDUVVGa08wRkJRMGs3UVVGQlFUdEJRVUZCTEd0RFFVRkpMRmRCUVZVc1VVRkJaRHRCUVVOQkxIRkZRVUZITEUxQlFVc3NWMEZCVWp0QlFVUkJMRFpDUVVSS08wRkJTVWs3UVVGQlFUdEJRVUZCTEd0RFFVRkpMRmRCUVZVc1lVRkJaRHRCUVVOQk8wRkJRVUU3UVVGQlFTeHpRMEZCUnl4TlFVRkxMRk5CUVZJN1FVRkJRVHRCUVVGQk8wRkJSRUVzTmtKQlNrbzdRVUZQU1R0QlFVRkJPMEZCUVVFc2EwTkJRVWtzVjBGQlZTeGhRVUZrTzBGQlEwRTdRVUZCUVR0QlFVRkJMSE5EUVVGSExFMUJRVXNzUjBGQlVqdEJRVUZCTzBGQlFVRTdRVUZFUVN3MlFrRlFTanRCUVZWSk8wRkJRVUU3UVVGQlFTeHJRMEZCU1N4WFFVRlZMR0ZCUVdRN1FVRkRRVHRCUVVGQk8wRkJRVUVzYzBOQlFVY3NUVUZCU3l4SFFVRlNPMEZCUVVFN1FVRkJRVHRCUVVSQk8wRkJWa283UVVGRVFUdEJRVkJLTzBGQlJFRXNZVUZFU2p0QlFUSkNSVHM3T3pzN08wRkJXVXc3TzJ0Q1FVVmpMRWM3T3pzN096czdPenM3TzBGRGNFUm1PenM3T3pzN096czdPenM3U1VGRlRTeGhPenM3T3pzN096czdPenMyUWtGRFR6dEJRVU5RTEdGQlEwVTdRVUZCUVR0QlFVRkJMRlZCUVVzc1YwRkJWU3huUWtGQlpqdEJRVU5ITEdGQlFVc3NTMEZCVEN4RFFVRlhPMEZCUkdRc1QwRkVSanRCUVV0RU96czdPenM3YTBKQlIxa3NZVHM3T3pzN1FVTmFha0k3T3pzN1FVRkRRVHM3T3p0QlFVVkJPenM3TzBGQlEwRTdPenM3UVVGRFFUczdPenM3TzBGQlIwRXNTVUZCU1N4WlFVRlpMRU5CUTJRc1JVRkJReXhSUVVGUkxGRkJRVlFzUlVGRVl5eEZRVU5OTEVWQlFVTXNVVUZCVVN4UFFVRlVMRVZCUkU0c1JVRkRlVUlzUlVGQlF5eFJRVUZSTEUxQlFWUXNSVUZFZWtJc1JVRkRNa01zUlVGQlF5eFJRVUZSTEdkQ1FVRlVMRVZCUkRORExFVkJSV1FzUlVGQlF5eFJRVUZSTEZOQlFWUXNSVUZHWXl4RlFVVlBMRVZCUVVNc1VVRkJVU3hSUVVGVUxFVkJSbEFzUlVGRk1rSXNSVUZCUXl4UlFVRlJMRTlCUVZRc1JVRkdNMElzUlVGRk9FTXNSVUZCUXl4UlFVRlJMRk5CUVZRc1JVRkdPVU1zUlVGSFpDeEZRVUZETEZGQlFWRXNWMEZCVkN4RlFVaGpMRVZCUjFNc1JVRkJReXhSUVVGUkxFMUJRVlFzUlVGSVZDeEZRVWN5UWl4RlFVRkRMRkZCUVZFc1owSkJRVlFzUlVGSU0wSXNSVUZIZFVRc1JVRkJReXhSUVVGUkxGVkJRVlFzUlVGSWRrUXNSVUZKWkN4RlFVRkRMRkZCUVZFc1ZVRkJWQ3hGUVVwakxFVkJTVkVzUlVGQlF5eFJRVUZSTEZkQlFWUXNSVUZLVWl4RlFVa3JRaXhGUVVGRExGRkJRVkVzVVVGQlZDeEZRVW92UWl4RlFVbHRSQ3hGUVVGRExGRkJRVkVzVDBGQlZDeEZRVXB1UkN4RlFVdGtMRVZCUVVNc1VVRkJVU3hQUVVGVUxFVkJUR01zUlVGTFN5eEZRVUZETEZGQlFWRXNUMEZCVkN4RlFVeE1MRVZCUzNkQ0xFVkJRVU1zVVVGQlVTeHhRa0ZCVkN4RlFVeDRRaXhGUVV0NVJDeEZRVUZETEZGQlFWRXNUMEZCVkN4RlFVeDZSQ3hGUVUxa0xFVkJRVU1zVVVGQlVTeFZRVUZVTEVWQlRtTXNSVUZOVVN4RlFVRkRMRkZCUVZFc1UwRkJWQ3hGUVU1U0xFVkJUVFpDTEVWQlFVTXNVVUZCVVN4dlFrRkJWQ3hGUVU0M1FpeEZRVTAyUkN4RlFVRkRMRkZCUVZFc1VVRkJWQ3hGUVU0M1JDeEZRVTlrTEVWQlFVTXNVVUZCVVN4UFFVRlVMRVZCVUdNc1JVRlBTeXhGUVVGRExGRkJRVkVzVVVGQlZDeEZRVkJNTEVWQlQzbENMRVZCUVVNc1VVRkJVU3hQUVVGVUxFVkJVSHBDTEVOQlFXaENPenRCUVZkQkxFbEJRVWtzWTBGRFJqdEJRVUZCTzBGQlFVRTdRVUZEUlN4dlJFRkVSanRCUVVWRk8wRkJRVUU3UVVGQlFUdEJRVU5GTERoRVFVRmxMRTlCUVZFc1UwRkJka0k3UVVGRVJqdEJRVVpHTEVOQlJFWTdPMEZCVTBFc1UwRkJVeXhOUVVGVUxFTkJRMFVzVjBGRVJpeEZRVVZGTEZOQlFWTXNZMEZCVkN4RFFVRjNRaXhsUVVGNFFpeERRVVpHSWl3aVptbHNaU0k2SW1kbGJtVnlZWFJsWkM1cWN5SXNJbk52ZFhKalpWSnZiM1FpT2lJaUxDSnpiM1Z5WTJWelEyOXVkR1Z1ZENJNld5SW9ablZ1WTNScGIyNGdaU2gwTEc0c2NpbDdablZ1WTNScGIyNGdjeWh2TEhVcGUybG1LQ0Z1VzI5ZEtYdHBaaWdoZEZ0dlhTbDdkbUZ5SUdFOWRIbHdaVzltSUhKbGNYVnBjbVU5UFZ3aVpuVnVZM1JwYjI1Y0lpWW1jbVZ4ZFdseVpUdHBaaWdoZFNZbVlTbHlaWFIxY200Z1lTaHZMQ0V3S1R0cFppaHBLWEpsZEhWeWJpQnBLRzhzSVRBcE8zWmhjaUJtUFc1bGR5QkZjbkp2Y2loY0lrTmhibTV2ZENCbWFXNWtJRzF2WkhWc1pTQW5YQ0lyYnl0Y0lpZGNJaWs3ZEdoeWIzY2daaTVqYjJSbFBWd2lUVTlFVlV4RlgwNVBWRjlHVDFWT1JGd2lMR1o5ZG1GeUlHdzlibHR2WFQxN1pYaHdiM0owY3pwN2ZYMDdkRnR2WFZzd1hTNWpZV3hzS0d3dVpYaHdiM0owY3l4bWRXNWpkR2x2YmlobEtYdDJZWElnYmoxMFcyOWRXekZkVzJWZE8zSmxkSFZ5YmlCektHNC9ianBsS1gwc2JDeHNMbVY0Y0c5eWRITXNaU3gwTEc0c2NpbDljbVYwZFhKdUlHNWJiMTB1Wlhod2IzSjBjMzEyWVhJZ2FUMTBlWEJsYjJZZ2NtVnhkV2x5WlQwOVhDSm1kVzVqZEdsdmJsd2lKaVp5WlhGMWFYSmxPMlp2Y2loMllYSWdiejB3TzI4OGNpNXNaVzVuZEdnN2J5c3JLWE1vY2x0dlhTazdjbVYwZFhKdUlITjlLU0lzSW0xdlpIVnNaUzVsZUhCdmNuUnpJRDBnY21WeGRXbHlaU2duTGk5c2FXSXZZWGhwYjNNbktUc2lMQ0luZFhObElITjBjbWxqZENjN1hHNWNiblpoY2lCMWRHbHNjeUE5SUhKbGNYVnBjbVVvSnk0dkxpNHZkWFJwYkhNbktUdGNiblpoY2lCelpYUjBiR1VnUFNCeVpYRjFhWEpsS0NjdUx5NHVMMk52Y21VdmMyVjBkR3hsSnlrN1hHNTJZWElnWW5WcGJHUlZVa3dnUFNCeVpYRjFhWEpsS0NjdUx5NHVMMmhsYkhCbGNuTXZZblZwYkdSVlVrd25LVHRjYm5aaGNpQndZWEp6WlVobFlXUmxjbk1nUFNCeVpYRjFhWEpsS0NjdUx5NHVMMmhsYkhCbGNuTXZjR0Z5YzJWSVpXRmtaWEp6SnlrN1hHNTJZWElnYVhOVlVreFRZVzFsVDNKcFoybHVJRDBnY21WeGRXbHlaU2duTGk4dUxpOW9aV3h3WlhKekwybHpWVkpNVTJGdFpVOXlhV2RwYmljcE8xeHVkbUZ5SUdOeVpXRjBaVVZ5Y205eUlEMGdjbVZ4ZFdseVpTZ25MaTR2WTI5eVpTOWpjbVZoZEdWRmNuSnZjaWNwTzF4dWRtRnlJR0owYjJFZ1BTQW9kSGx3Wlc5bUlIZHBibVJ2ZHlBaFBUMGdKM1Z1WkdWbWFXNWxaQ2NnSmlZZ2QybHVaRzkzTG1KMGIyRWdKaVlnZDJsdVpHOTNMbUowYjJFdVltbHVaQ2gzYVc1a2IzY3BLU0I4ZkNCeVpYRjFhWEpsS0NjdUx5NHVMMmhsYkhCbGNuTXZZblJ2WVNjcE8xeHVYRzV0YjJSMWJHVXVaWGh3YjNKMGN5QTlJR1oxYm1OMGFXOXVJSGhvY2tGa1lYQjBaWElvWTI5dVptbG5LU0I3WEc0Z0lISmxkSFZ5YmlCdVpYY2dVSEp2YldselpTaG1kVzVqZEdsdmJpQmthWE53WVhSamFGaG9jbEpsY1hWbGMzUW9jbVZ6YjJ4MlpTd2djbVZxWldOMEtTQjdYRzRnSUNBZ2RtRnlJSEpsY1hWbGMzUkVZWFJoSUQwZ1kyOXVabWxuTG1SaGRHRTdYRzRnSUNBZ2RtRnlJSEpsY1hWbGMzUklaV0ZrWlhKeklEMGdZMjl1Wm1sbkxtaGxZV1JsY25NN1hHNWNiaUFnSUNCcFppQW9kWFJwYkhNdWFYTkdiM0p0UkdGMFlTaHlaWEYxWlhOMFJHRjBZU2twSUh0Y2JpQWdJQ0FnSUdSbGJHVjBaU0J5WlhGMVpYTjBTR1ZoWkdWeWMxc25RMjl1ZEdWdWRDMVVlWEJsSjEwN0lDOHZJRXhsZENCMGFHVWdZbkp2ZDNObGNpQnpaWFFnYVhSY2JpQWdJQ0I5WEc1Y2JpQWdJQ0IyWVhJZ2NtVnhkV1Z6ZENBOUlHNWxkeUJZVFV4SWRIUndVbVZ4ZFdWemRDZ3BPMXh1SUNBZ0lIWmhjaUJzYjJGa1JYWmxiblFnUFNBbmIyNXlaV0ZrZVhOMFlYUmxZMmhoYm1kbEp6dGNiaUFnSUNCMllYSWdlRVJ2YldGcGJpQTlJR1poYkhObE8xeHVYRzRnSUNBZ0x5OGdSbTl5SUVsRklEZ3ZPU0JEVDFKVElITjFjSEJ2Y25SY2JpQWdJQ0F2THlCUGJteDVJSE4xY0hCdmNuUnpJRkJQVTFRZ1lXNWtJRWRGVkNCallXeHNjeUJoYm1RZ1pHOWxjMjRuZENCeVpYUjFjbTV6SUhSb1pTQnlaWE53YjI1elpTQm9aV0ZrWlhKekxseHVJQ0FnSUM4dklFUlBUaWRVSUdSdklIUm9hWE1nWm05eUlIUmxjM1JwYm1jZ1lpOWpJRmhOVEVoMGRIQlNaWEYxWlhOMElHbHpJRzF2WTJ0bFpDd2dibTkwSUZoRWIyMWhhVzVTWlhGMVpYTjBMbHh1SUNBZ0lHbG1JQ2h3Y205alpYTnpMbVZ1ZGk1T1QwUkZYMFZPVmlBaFBUMGdKM1JsYzNRbklDWW1YRzRnSUNBZ0lDQWdJSFI1Y0dWdlppQjNhVzVrYjNjZ0lUMDlJQ2QxYm1SbFptbHVaV1FuSUNZbVhHNGdJQ0FnSUNBZ0lIZHBibVJ2ZHk1WVJHOXRZV2x1VW1WeGRXVnpkQ0FtSmlBaEtDZDNhWFJvUTNKbFpHVnVkR2xoYkhNbklHbHVJSEpsY1hWbGMzUXBJQ1ltWEc0Z0lDQWdJQ0FnSUNGcGMxVlNURk5oYldWUGNtbG5hVzRvWTI5dVptbG5MblZ5YkNrcElIdGNiaUFnSUNBZ0lISmxjWFZsYzNRZ1BTQnVaWGNnZDJsdVpHOTNMbGhFYjIxaGFXNVNaWEYxWlhOMEtDazdYRzRnSUNBZ0lDQnNiMkZrUlhabGJuUWdQU0FuYjI1c2IyRmtKenRjYmlBZ0lDQWdJSGhFYjIxaGFXNGdQU0IwY25WbE8xeHVJQ0FnSUNBZ2NtVnhkV1Z6ZEM1dmJuQnliMmR5WlhOeklEMGdablZ1WTNScGIyNGdhR0Z1Wkd4bFVISnZaM0psYzNNb0tTQjdmVHRjYmlBZ0lDQWdJSEpsY1hWbGMzUXViMjUwYVcxbGIzVjBJRDBnWm5WdVkzUnBiMjRnYUdGdVpHeGxWR2x0Wlc5MWRDZ3BJSHQ5TzF4dUlDQWdJSDFjYmx4dUlDQWdJQzh2SUVoVVZGQWdZbUZ6YVdNZ1lYVjBhR1Z1ZEdsallYUnBiMjVjYmlBZ0lDQnBaaUFvWTI5dVptbG5MbUYxZEdncElIdGNiaUFnSUNBZ0lIWmhjaUIxYzJWeWJtRnRaU0E5SUdOdmJtWnBaeTVoZFhSb0xuVnpaWEp1WVcxbElIeDhJQ2NuTzF4dUlDQWdJQ0FnZG1GeUlIQmhjM04zYjNKa0lEMGdZMjl1Wm1sbkxtRjFkR2d1Y0dGemMzZHZjbVFnZkh3Z0p5YzdYRzRnSUNBZ0lDQnlaWEYxWlhOMFNHVmhaR1Z5Y3k1QmRYUm9iM0pwZW1GMGFXOXVJRDBnSjBKaGMybGpJQ2NnS3lCaWRHOWhLSFZ6WlhKdVlXMWxJQ3NnSnpvbklDc2djR0Z6YzNkdmNtUXBPMXh1SUNBZ0lIMWNibHh1SUNBZ0lISmxjWFZsYzNRdWIzQmxiaWhqYjI1bWFXY3ViV1YwYUc5a0xuUnZWWEJ3WlhKRFlYTmxLQ2tzSUdKMWFXeGtWVkpNS0dOdmJtWnBaeTUxY213c0lHTnZibVpwWnk1d1lYSmhiWE1zSUdOdmJtWnBaeTV3WVhKaGJYTlRaWEpwWVd4cGVtVnlLU3dnZEhKMVpTazdYRzVjYmlBZ0lDQXZMeUJUWlhRZ2RHaGxJSEpsY1hWbGMzUWdkR2x0Wlc5MWRDQnBiaUJOVTF4dUlDQWdJSEpsY1hWbGMzUXVkR2x0Wlc5MWRDQTlJR052Ym1acFp5NTBhVzFsYjNWME8xeHVYRzRnSUNBZ0x5OGdUR2x6ZEdWdUlHWnZjaUJ5WldGa2VTQnpkR0YwWlZ4dUlDQWdJSEpsY1hWbGMzUmJiRzloWkVWMlpXNTBYU0E5SUdaMWJtTjBhVzl1SUdoaGJtUnNaVXh2WVdRb0tTQjdYRzRnSUNBZ0lDQnBaaUFvSVhKbGNYVmxjM1FnZkh3Z0tISmxjWFZsYzNRdWNtVmhaSGxUZEdGMFpTQWhQVDBnTkNBbUppQWhlRVJ2YldGcGJpa3BJSHRjYmlBZ0lDQWdJQ0FnY21WMGRYSnVPMXh1SUNBZ0lDQWdmVnh1WEc0Z0lDQWdJQ0F2THlCVWFHVWdjbVZ4ZFdWemRDQmxjbkp2Y21Wa0lHOTFkQ0JoYm1RZ2QyVWdaR2xrYmlkMElHZGxkQ0JoSUhKbGMzQnZibk5sTENCMGFHbHpJSGRwYkd3Z1ltVmNiaUFnSUNBZ0lDOHZJR2hoYm1Sc1pXUWdZbmtnYjI1bGNuSnZjaUJwYm5OMFpXRmtYRzRnSUNBZ0lDQXZMeUJYYVhSb0lHOXVaU0JsZUdObGNIUnBiMjQ2SUhKbGNYVmxjM1FnZEdoaGRDQjFjMmx1WnlCbWFXeGxPaUJ3Y205MGIyTnZiQ3dnYlc5emRDQmljbTkzYzJWeWMxeHVJQ0FnSUNBZ0x5OGdkMmxzYkNCeVpYUjFjbTRnYzNSaGRIVnpJR0Z6SURBZ1pYWmxiaUIwYUc5MVoyZ2dhWFFuY3lCaElITjFZMk5sYzNObWRXd2djbVZ4ZFdWemRGeHVJQ0FnSUNBZ2FXWWdLSEpsY1hWbGMzUXVjM1JoZEhWeklEMDlQU0F3SUNZbUlDRW9jbVZ4ZFdWemRDNXlaWE53YjI1elpWVlNUQ0FtSmlCeVpYRjFaWE4wTG5KbGMzQnZibk5sVlZKTUxtbHVaR1Y0VDJZb0oyWnBiR1U2SnlrZ1BUMDlJREFwS1NCN1hHNGdJQ0FnSUNBZ0lISmxkSFZ5Ymp0Y2JpQWdJQ0FnSUgxY2JseHVJQ0FnSUNBZ0x5OGdVSEpsY0dGeVpTQjBhR1VnY21WemNHOXVjMlZjYmlBZ0lDQWdJSFpoY2lCeVpYTndiMjV6WlVobFlXUmxjbk1nUFNBbloyVjBRV3hzVW1WemNHOXVjMlZJWldGa1pYSnpKeUJwYmlCeVpYRjFaWE4wSUQ4Z2NHRnljMlZJWldGa1pYSnpLSEpsY1hWbGMzUXVaMlYwUVd4c1VtVnpjRzl1YzJWSVpXRmtaWEp6S0NrcElEb2diblZzYkR0Y2JpQWdJQ0FnSUhaaGNpQnlaWE53YjI1elpVUmhkR0VnUFNBaFkyOXVabWxuTG5KbGMzQnZibk5sVkhsd1pTQjhmQ0JqYjI1bWFXY3VjbVZ6Y0c5dWMyVlVlWEJsSUQwOVBTQW5kR1Y0ZENjZ1B5QnlaWEYxWlhOMExuSmxjM0J2Ym5ObFZHVjRkQ0E2SUhKbGNYVmxjM1F1Y21WemNHOXVjMlU3WEc0Z0lDQWdJQ0IyWVhJZ2NtVnpjRzl1YzJVZ1BTQjdYRzRnSUNBZ0lDQWdJR1JoZEdFNklISmxjM0J2Ym5ObFJHRjBZU3hjYmlBZ0lDQWdJQ0FnTHk4Z1NVVWdjMlZ1WkhNZ01USXlNeUJwYm5OMFpXRmtJRzltSURJd05DQW9hSFIwY0hNNkx5OW5hWFJvZFdJdVkyOXRMMjE2WVdKeWFYTnJhV1V2WVhocGIzTXZhWE56ZFdWekx6SXdNU2xjYmlBZ0lDQWdJQ0FnYzNSaGRIVnpPaUJ5WlhGMVpYTjBMbk4wWVhSMWN5QTlQVDBnTVRJeU15QS9JREl3TkNBNklISmxjWFZsYzNRdWMzUmhkSFZ6TEZ4dUlDQWdJQ0FnSUNCemRHRjBkWE5VWlhoME9pQnlaWEYxWlhOMExuTjBZWFIxY3lBOVBUMGdNVEl5TXlBL0lDZE9ieUJEYjI1MFpXNTBKeUE2SUhKbGNYVmxjM1F1YzNSaGRIVnpWR1Y0ZEN4Y2JpQWdJQ0FnSUNBZ2FHVmhaR1Z5Y3pvZ2NtVnpjRzl1YzJWSVpXRmtaWEp6TEZ4dUlDQWdJQ0FnSUNCamIyNW1hV2M2SUdOdmJtWnBaeXhjYmlBZ0lDQWdJQ0FnY21WeGRXVnpkRG9nY21WeGRXVnpkRnh1SUNBZ0lDQWdmVHRjYmx4dUlDQWdJQ0FnYzJWMGRHeGxLSEpsYzI5c2RtVXNJSEpsYW1WamRDd2djbVZ6Y0c5dWMyVXBPMXh1WEc0Z0lDQWdJQ0F2THlCRGJHVmhiaUIxY0NCeVpYRjFaWE4wWEc0Z0lDQWdJQ0J5WlhGMVpYTjBJRDBnYm5Wc2JEdGNiaUFnSUNCOU8xeHVYRzRnSUNBZ0x5OGdTR0Z1Wkd4bElHeHZkeUJzWlhabGJDQnVaWFIzYjNKcklHVnljbTl5YzF4dUlDQWdJSEpsY1hWbGMzUXViMjVsY25KdmNpQTlJR1oxYm1OMGFXOXVJR2hoYm1Sc1pVVnljbTl5S0NrZ2UxeHVJQ0FnSUNBZ0x5OGdVbVZoYkNCbGNuSnZjbk1nWVhKbElHaHBaR1JsYmlCbWNtOXRJSFZ6SUdKNUlIUm9aU0JpY205M2MyVnlYRzRnSUNBZ0lDQXZMeUJ2Ym1WeWNtOXlJSE5vYjNWc1pDQnZibXg1SUdacGNtVWdhV1lnYVhRbmN5QmhJRzVsZEhkdmNtc2daWEp5YjNKY2JpQWdJQ0FnSUhKbGFtVmpkQ2hqY21WaGRHVkZjbkp2Y2lnblRtVjBkMjl5YXlCRmNuSnZjaWNzSUdOdmJtWnBaeXdnYm5Wc2JDd2djbVZ4ZFdWemRDa3BPMXh1WEc0Z0lDQWdJQ0F2THlCRGJHVmhiaUIxY0NCeVpYRjFaWE4wWEc0Z0lDQWdJQ0J5WlhGMVpYTjBJRDBnYm5Wc2JEdGNiaUFnSUNCOU8xeHVYRzRnSUNBZ0x5OGdTR0Z1Wkd4bElIUnBiV1Z2ZFhSY2JpQWdJQ0J5WlhGMVpYTjBMbTl1ZEdsdFpXOTFkQ0E5SUdaMWJtTjBhVzl1SUdoaGJtUnNaVlJwYldWdmRYUW9LU0I3WEc0Z0lDQWdJQ0J5WldwbFkzUW9ZM0psWVhSbFJYSnliM0lvSjNScGJXVnZkWFFnYjJZZ0p5QXJJR052Ym1acFp5NTBhVzFsYjNWMElDc2dKMjF6SUdWNFkyVmxaR1ZrSnl3Z1kyOXVabWxuTENBblJVTlBUazVCUWs5U1ZFVkVKeXhjYmlBZ0lDQWdJQ0FnY21WeGRXVnpkQ2twTzF4dVhHNGdJQ0FnSUNBdkx5QkRiR1ZoYmlCMWNDQnlaWEYxWlhOMFhHNGdJQ0FnSUNCeVpYRjFaWE4wSUQwZ2JuVnNiRHRjYmlBZ0lDQjlPMXh1WEc0Z0lDQWdMeThnUVdSa0lIaHpjbVlnYUdWaFpHVnlYRzRnSUNBZ0x5OGdWR2hwY3lCcGN5QnZibXg1SUdSdmJtVWdhV1lnY25WdWJtbHVaeUJwYmlCaElITjBZVzVrWVhKa0lHSnliM2R6WlhJZ1pXNTJhWEp2Ym0xbGJuUXVYRzRnSUNBZ0x5OGdVM0JsWTJsbWFXTmhiR3g1SUc1dmRDQnBaaUIzWlNkeVpTQnBiaUJoSUhkbFlpQjNiM0pyWlhJc0lHOXlJSEpsWVdOMExXNWhkR2wyWlM1Y2JpQWdJQ0JwWmlBb2RYUnBiSE11YVhOVGRHRnVaR0Z5WkVKeWIzZHpaWEpGYm5Zb0tTa2dlMXh1SUNBZ0lDQWdkbUZ5SUdOdmIydHBaWE1nUFNCeVpYRjFhWEpsS0NjdUx5NHVMMmhsYkhCbGNuTXZZMjl2YTJsbGN5Y3BPMXh1WEc0Z0lDQWdJQ0F2THlCQlpHUWdlSE55WmlCb1pXRmtaWEpjYmlBZ0lDQWdJSFpoY2lCNGMzSm1WbUZzZFdVZ1BTQW9ZMjl1Wm1sbkxuZHBkR2hEY21Wa1pXNTBhV0ZzY3lCOGZDQnBjMVZTVEZOaGJXVlBjbWxuYVc0b1kyOXVabWxuTG5WeWJDa3BJQ1ltSUdOdmJtWnBaeTU0YzNKbVEyOXZhMmxsVG1GdFpTQS9YRzRnSUNBZ0lDQWdJQ0FnWTI5dmEybGxjeTV5WldGa0tHTnZibVpwWnk1NGMzSm1RMjl2YTJsbFRtRnRaU2tnT2x4dUlDQWdJQ0FnSUNBZ0lIVnVaR1ZtYVc1bFpEdGNibHh1SUNBZ0lDQWdhV1lnS0hoemNtWldZV3gxWlNrZ2UxeHVJQ0FnSUNBZ0lDQnlaWEYxWlhOMFNHVmhaR1Z5YzF0amIyNW1hV2N1ZUhOeVpraGxZV1JsY2s1aGJXVmRJRDBnZUhOeVpsWmhiSFZsTzF4dUlDQWdJQ0FnZlZ4dUlDQWdJSDFjYmx4dUlDQWdJQzh2SUVGa1pDQm9aV0ZrWlhKeklIUnZJSFJvWlNCeVpYRjFaWE4wWEc0Z0lDQWdhV1lnS0NkelpYUlNaWEYxWlhOMFNHVmhaR1Z5SnlCcGJpQnlaWEYxWlhOMEtTQjdYRzRnSUNBZ0lDQjFkR2xzY3k1bWIzSkZZV05vS0hKbGNYVmxjM1JJWldGa1pYSnpMQ0JtZFc1amRHbHZiaUJ6WlhSU1pYRjFaWE4wU0dWaFpHVnlLSFpoYkN3Z2EyVjVLU0I3WEc0Z0lDQWdJQ0FnSUdsbUlDaDBlWEJsYjJZZ2NtVnhkV1Z6ZEVSaGRHRWdQVDA5SUNkMWJtUmxabWx1WldRbklDWW1JR3RsZVM1MGIweHZkMlZ5UTJGelpTZ3BJRDA5UFNBblkyOXVkR1Z1ZEMxMGVYQmxKeWtnZTF4dUlDQWdJQ0FnSUNBZ0lDOHZJRkpsYlc5MlpTQkRiMjUwWlc1MExWUjVjR1VnYVdZZ1pHRjBZU0JwY3lCMWJtUmxabWx1WldSY2JpQWdJQ0FnSUNBZ0lDQmtaV3hsZEdVZ2NtVnhkV1Z6ZEVobFlXUmxjbk5iYTJWNVhUdGNiaUFnSUNBZ0lDQWdmU0JsYkhObElIdGNiaUFnSUNBZ0lDQWdJQ0F2THlCUGRHaGxjbmRwYzJVZ1lXUmtJR2hsWVdSbGNpQjBieUIwYUdVZ2NtVnhkV1Z6ZEZ4dUlDQWdJQ0FnSUNBZ0lISmxjWFZsYzNRdWMyVjBVbVZ4ZFdWemRFaGxZV1JsY2loclpYa3NJSFpoYkNrN1hHNGdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lIMHBPMXh1SUNBZ0lIMWNibHh1SUNBZ0lDOHZJRUZrWkNCM2FYUm9RM0psWkdWdWRHbGhiSE1nZEc4Z2NtVnhkV1Z6ZENCcFppQnVaV1ZrWldSY2JpQWdJQ0JwWmlBb1kyOXVabWxuTG5kcGRHaERjbVZrWlc1MGFXRnNjeWtnZTF4dUlDQWdJQ0FnY21WeGRXVnpkQzUzYVhSb1EzSmxaR1Z1ZEdsaGJITWdQU0IwY25WbE8xeHVJQ0FnSUgxY2JseHVJQ0FnSUM4dklFRmtaQ0J5WlhOd2IyNXpaVlI1Y0dVZ2RHOGdjbVZ4ZFdWemRDQnBaaUJ1WldWa1pXUmNiaUFnSUNCcFppQW9ZMjl1Wm1sbkxuSmxjM0J2Ym5ObFZIbHdaU2tnZTF4dUlDQWdJQ0FnZEhKNUlIdGNiaUFnSUNBZ0lDQWdjbVZ4ZFdWemRDNXlaWE53YjI1elpWUjVjR1VnUFNCamIyNW1hV2N1Y21WemNHOXVjMlZVZVhCbE8xeHVJQ0FnSUNBZ2ZTQmpZWFJqYUNBb1pTa2dlMXh1SUNBZ0lDQWdJQ0F2THlCRmVIQmxZM1JsWkNCRVQwMUZlR05sY0hScGIyNGdkR2h5YjNkdUlHSjVJR0p5YjNkelpYSnpJRzV2ZENCamIyMXdZWFJwWW14bElGaE5URWgwZEhCU1pYRjFaWE4wSUV4bGRtVnNJREl1WEc0Z0lDQWdJQ0FnSUM4dklFSjFkQ3dnZEdocGN5QmpZVzRnWW1VZ2MzVndjSEpsYzNObFpDQm1iM0lnSjJwemIyNG5JSFI1Y0dVZ1lYTWdhWFFnWTJGdUlHSmxJSEJoY25ObFpDQmllU0JrWldaaGRXeDBJQ2QwY21GdWMyWnZjbTFTWlhOd2IyNXpaU2NnWm5WdVkzUnBiMjR1WEc0Z0lDQWdJQ0FnSUdsbUlDaGpiMjVtYVdjdWNtVnpjRzl1YzJWVWVYQmxJQ0U5UFNBbmFuTnZiaWNwSUh0Y2JpQWdJQ0FnSUNBZ0lDQjBhSEp2ZHlCbE8xeHVJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQjlYRzRnSUNBZ2ZWeHVYRzRnSUNBZ0x5OGdTR0Z1Wkd4bElIQnliMmR5WlhOeklHbG1JRzVsWldSbFpGeHVJQ0FnSUdsbUlDaDBlWEJsYjJZZ1kyOXVabWxuTG05dVJHOTNibXh2WVdSUWNtOW5jbVZ6Y3lBOVBUMGdKMloxYm1OMGFXOXVKeWtnZTF4dUlDQWdJQ0FnY21WeGRXVnpkQzVoWkdSRmRtVnVkRXhwYzNSbGJtVnlLQ2R3Y205bmNtVnpjeWNzSUdOdmJtWnBaeTV2YmtSdmQyNXNiMkZrVUhKdlozSmxjM01wTzF4dUlDQWdJSDFjYmx4dUlDQWdJQzh2SUU1dmRDQmhiR3dnWW5KdmQzTmxjbk1nYzNWd2NHOXlkQ0IxY0d4dllXUWdaWFpsYm5SelhHNGdJQ0FnYVdZZ0tIUjVjR1Z2WmlCamIyNW1hV2N1YjI1VmNHeHZZV1JRY205bmNtVnpjeUE5UFQwZ0oyWjFibU4wYVc5dUp5QW1KaUJ5WlhGMVpYTjBMblZ3Ykc5aFpDa2dlMXh1SUNBZ0lDQWdjbVZ4ZFdWemRDNTFjR3h2WVdRdVlXUmtSWFpsYm5STWFYTjBaVzVsY2lnbmNISnZaM0psYzNNbkxDQmpiMjVtYVdjdWIyNVZjR3h2WVdSUWNtOW5jbVZ6Y3lrN1hHNGdJQ0FnZlZ4dVhHNGdJQ0FnYVdZZ0tHTnZibVpwWnk1allXNWpaV3hVYjJ0bGJpa2dlMXh1SUNBZ0lDQWdMeThnU0dGdVpHeGxJR05oYm1ObGJHeGhkR2x2Ymx4dUlDQWdJQ0FnWTI5dVptbG5MbU5oYm1ObGJGUnZhMlZ1TG5CeWIyMXBjMlV1ZEdobGJpaG1kVzVqZEdsdmJpQnZia05oYm1ObGJHVmtLR05oYm1ObGJDa2dlMXh1SUNBZ0lDQWdJQ0JwWmlBb0lYSmxjWFZsYzNRcElIdGNiaUFnSUNBZ0lDQWdJQ0J5WlhSMWNtNDdYRzRnSUNBZ0lDQWdJSDFjYmx4dUlDQWdJQ0FnSUNCeVpYRjFaWE4wTG1GaWIzSjBLQ2s3WEc0Z0lDQWdJQ0FnSUhKbGFtVmpkQ2hqWVc1alpXd3BPMXh1SUNBZ0lDQWdJQ0F2THlCRGJHVmhiaUIxY0NCeVpYRjFaWE4wWEc0Z0lDQWdJQ0FnSUhKbGNYVmxjM1FnUFNCdWRXeHNPMXh1SUNBZ0lDQWdmU2s3WEc0Z0lDQWdmVnh1WEc0Z0lDQWdhV1lnS0hKbGNYVmxjM1JFWVhSaElEMDlQU0IxYm1SbFptbHVaV1FwSUh0Y2JpQWdJQ0FnSUhKbGNYVmxjM1JFWVhSaElEMGdiblZzYkR0Y2JpQWdJQ0I5WEc1Y2JpQWdJQ0F2THlCVFpXNWtJSFJvWlNCeVpYRjFaWE4wWEc0Z0lDQWdjbVZ4ZFdWemRDNXpaVzVrS0hKbGNYVmxjM1JFWVhSaEtUdGNiaUFnZlNrN1hHNTlPMXh1SWl3aUozVnpaU0J6ZEhKcFkzUW5PMXh1WEc1MllYSWdkWFJwYkhNZ1BTQnlaWEYxYVhKbEtDY3VMM1YwYVd4ekp5azdYRzUyWVhJZ1ltbHVaQ0E5SUhKbGNYVnBjbVVvSnk0dmFHVnNjR1Z5Y3k5aWFXNWtKeWs3WEc1MllYSWdRWGhwYjNNZ1BTQnlaWEYxYVhKbEtDY3VMMk52Y21VdlFYaHBiM01uS1R0Y2JuWmhjaUJrWldaaGRXeDBjeUE5SUhKbGNYVnBjbVVvSnk0dlpHVm1ZWFZzZEhNbktUdGNibHh1THlvcVhHNGdLaUJEY21WaGRHVWdZVzRnYVc1emRHRnVZMlVnYjJZZ1FYaHBiM05jYmlBcVhHNGdLaUJBY0dGeVlXMGdlMDlpYW1WamRIMGdaR1ZtWVhWc2RFTnZibVpwWnlCVWFHVWdaR1ZtWVhWc2RDQmpiMjVtYVdjZ1ptOXlJSFJvWlNCcGJuTjBZVzVqWlZ4dUlDb2dRSEpsZEhWeWJpQjdRWGhwYjNOOUlFRWdibVYzSUdsdWMzUmhibU5sSUc5bUlFRjRhVzl6WEc0Z0tpOWNibVoxYm1OMGFXOXVJR055WldGMFpVbHVjM1JoYm1ObEtHUmxabUYxYkhSRGIyNW1hV2NwSUh0Y2JpQWdkbUZ5SUdOdmJuUmxlSFFnUFNCdVpYY2dRWGhwYjNNb1pHVm1ZWFZzZEVOdmJtWnBaeWs3WEc0Z0lIWmhjaUJwYm5OMFlXNWpaU0E5SUdKcGJtUW9RWGhwYjNNdWNISnZkRzkwZVhCbExuSmxjWFZsYzNRc0lHTnZiblJsZUhRcE8xeHVYRzRnSUM4dklFTnZjSGtnWVhocGIzTXVjSEp2ZEc5MGVYQmxJSFJ2SUdsdWMzUmhibU5sWEc0Z0lIVjBhV3h6TG1WNGRHVnVaQ2hwYm5OMFlXNWpaU3dnUVhocGIzTXVjSEp2ZEc5MGVYQmxMQ0JqYjI1MFpYaDBLVHRjYmx4dUlDQXZMeUJEYjNCNUlHTnZiblJsZUhRZ2RHOGdhVzV6ZEdGdVkyVmNiaUFnZFhScGJITXVaWGgwWlc1a0tHbHVjM1JoYm1ObExDQmpiMjUwWlhoMEtUdGNibHh1SUNCeVpYUjFjbTRnYVc1emRHRnVZMlU3WEc1OVhHNWNiaTh2SUVOeVpXRjBaU0IwYUdVZ1pHVm1ZWFZzZENCcGJuTjBZVzVqWlNCMGJ5QmlaU0JsZUhCdmNuUmxaRnh1ZG1GeUlHRjRhVzl6SUQwZ1kzSmxZWFJsU1c1emRHRnVZMlVvWkdWbVlYVnNkSE1wTzF4dVhHNHZMeUJGZUhCdmMyVWdRWGhwYjNNZ1kyeGhjM01nZEc4Z1lXeHNiM2NnWTJ4aGMzTWdhVzVvWlhKcGRHRnVZMlZjYm1GNGFXOXpMa0Y0YVc5eklEMGdRWGhwYjNNN1hHNWNiaTh2SUVaaFkzUnZjbmtnWm05eUlHTnlaV0YwYVc1bklHNWxkeUJwYm5OMFlXNWpaWE5jYm1GNGFXOXpMbU55WldGMFpTQTlJR1oxYm1OMGFXOXVJR055WldGMFpTaHBibk4wWVc1alpVTnZibVpwWnlrZ2UxeHVJQ0J5WlhSMWNtNGdZM0psWVhSbFNXNXpkR0Z1WTJVb2RYUnBiSE11YldWeVoyVW9aR1ZtWVhWc2RITXNJR2x1YzNSaGJtTmxRMjl1Wm1sbktTazdYRzU5TzF4dVhHNHZMeUJGZUhCdmMyVWdRMkZ1WTJWc0lDWWdRMkZ1WTJWc1ZHOXJaVzVjYm1GNGFXOXpMa05oYm1ObGJDQTlJSEpsY1hWcGNtVW9KeTR2WTJGdVkyVnNMME5oYm1ObGJDY3BPMXh1WVhocGIzTXVRMkZ1WTJWc1ZHOXJaVzRnUFNCeVpYRjFhWEpsS0NjdUwyTmhibU5sYkM5RFlXNWpaV3hVYjJ0bGJpY3BPMXh1WVhocGIzTXVhWE5EWVc1alpXd2dQU0J5WlhGMWFYSmxLQ2N1TDJOaGJtTmxiQzlwYzBOaGJtTmxiQ2NwTzF4dVhHNHZMeUJGZUhCdmMyVWdZV3hzTDNOd2NtVmhaRnh1WVhocGIzTXVZV3hzSUQwZ1puVnVZM1JwYjI0Z1lXeHNLSEJ5YjIxcGMyVnpLU0I3WEc0Z0lISmxkSFZ5YmlCUWNtOXRhWE5sTG1Gc2JDaHdjbTl0YVhObGN5azdYRzU5TzF4dVlYaHBiM011YzNCeVpXRmtJRDBnY21WeGRXbHlaU2duTGk5b1pXeHdaWEp6TDNOd2NtVmhaQ2NwTzF4dVhHNXRiMlIxYkdVdVpYaHdiM0owY3lBOUlHRjRhVzl6TzF4dVhHNHZMeUJCYkd4dmR5QjFjMlVnYjJZZ1pHVm1ZWFZzZENCcGJYQnZjblFnYzNsdWRHRjRJR2x1SUZSNWNHVlRZM0pwY0hSY2JtMXZaSFZzWlM1bGVIQnZjblJ6TG1SbFptRjFiSFFnUFNCaGVHbHZjenRjYmlJc0lpZDFjMlVnYzNSeWFXTjBKenRjYmx4dUx5b3FYRzRnS2lCQklHQkRZVzVqWld4Z0lHbHpJR0Z1SUc5aWFtVmpkQ0IwYUdGMElHbHpJSFJvY205M2JpQjNhR1Z1SUdGdUlHOXdaWEpoZEdsdmJpQnBjeUJqWVc1alpXeGxaQzVjYmlBcVhHNGdLaUJBWTJ4aGMzTmNiaUFxSUVCd1lYSmhiU0I3YzNSeWFXNW5QWDBnYldWemMyRm5aU0JVYUdVZ2JXVnpjMkZuWlM1Y2JpQXFMMXh1Wm5WdVkzUnBiMjRnUTJGdVkyVnNLRzFsYzNOaFoyVXBJSHRjYmlBZ2RHaHBjeTV0WlhOellXZGxJRDBnYldWemMyRm5aVHRjYm4xY2JseHVRMkZ1WTJWc0xuQnliM1J2ZEhsd1pTNTBiMU4wY21sdVp5QTlJR1oxYm1OMGFXOXVJSFJ2VTNSeWFXNW5LQ2tnZTF4dUlDQnlaWFIxY200Z0owTmhibU5sYkNjZ0t5QW9kR2hwY3k1dFpYTnpZV2RsSUQ4Z0p6b2dKeUFySUhSb2FYTXViV1Z6YzJGblpTQTZJQ2NuS1R0Y2JuMDdYRzVjYmtOaGJtTmxiQzV3Y205MGIzUjVjR1V1WDE5RFFVNURSVXhmWHlBOUlIUnlkV1U3WEc1Y2JtMXZaSFZzWlM1bGVIQnZjblJ6SUQwZ1EyRnVZMlZzTzF4dUlpd2lKM1Z6WlNCemRISnBZM1FuTzF4dVhHNTJZWElnUTJGdVkyVnNJRDBnY21WeGRXbHlaU2duTGk5RFlXNWpaV3duS1R0Y2JseHVMeW9xWEc0Z0tpQkJJR0JEWVc1alpXeFViMnRsYm1BZ2FYTWdZVzRnYjJKcVpXTjBJSFJvWVhRZ1kyRnVJR0psSUhWelpXUWdkRzhnY21WeGRXVnpkQ0JqWVc1alpXeHNZWFJwYjI0Z2IyWWdZVzRnYjNCbGNtRjBhVzl1TGx4dUlDcGNiaUFxSUVCamJHRnpjMXh1SUNvZ1FIQmhjbUZ0SUh0R2RXNWpkR2x2Ym4wZ1pYaGxZM1YwYjNJZ1ZHaGxJR1Y0WldOMWRHOXlJR1oxYm1OMGFXOXVMbHh1SUNvdlhHNW1kVzVqZEdsdmJpQkRZVzVqWld4VWIydGxiaWhsZUdWamRYUnZjaWtnZTF4dUlDQnBaaUFvZEhsd1pXOW1JR1Y0WldOMWRHOXlJQ0U5UFNBblpuVnVZM1JwYjI0bktTQjdYRzRnSUNBZ2RHaHliM2NnYm1WM0lGUjVjR1ZGY25KdmNpZ25aWGhsWTNWMGIzSWdiWFZ6ZENCaVpTQmhJR1oxYm1OMGFXOXVMaWNwTzF4dUlDQjlYRzVjYmlBZ2RtRnlJSEpsYzI5c2RtVlFjbTl0YVhObE8xeHVJQ0IwYUdsekxuQnliMjFwYzJVZ1BTQnVaWGNnVUhKdmJXbHpaU2htZFc1amRHbHZiaUJ3Y205dGFYTmxSWGhsWTNWMGIzSW9jbVZ6YjJ4MlpTa2dlMXh1SUNBZ0lISmxjMjlzZG1WUWNtOXRhWE5sSUQwZ2NtVnpiMngyWlR0Y2JpQWdmU2s3WEc1Y2JpQWdkbUZ5SUhSdmEyVnVJRDBnZEdocGN6dGNiaUFnWlhobFkzVjBiM0lvWm5WdVkzUnBiMjRnWTJGdVkyVnNLRzFsYzNOaFoyVXBJSHRjYmlBZ0lDQnBaaUFvZEc5clpXNHVjbVZoYzI5dUtTQjdYRzRnSUNBZ0lDQXZMeUJEWVc1alpXeHNZWFJwYjI0Z2FHRnpJR0ZzY21WaFpIa2dZbVZsYmlCeVpYRjFaWE4wWldSY2JpQWdJQ0FnSUhKbGRIVnlianRjYmlBZ0lDQjlYRzVjYmlBZ0lDQjBiMnRsYmk1eVpXRnpiMjRnUFNCdVpYY2dRMkZ1WTJWc0tHMWxjM05oWjJVcE8xeHVJQ0FnSUhKbGMyOXNkbVZRY205dGFYTmxLSFJ2YTJWdUxuSmxZWE52YmlrN1hHNGdJSDBwTzF4dWZWeHVYRzR2S2lwY2JpQXFJRlJvY205M2N5QmhJR0JEWVc1alpXeGdJR2xtSUdOaGJtTmxiR3hoZEdsdmJpQm9ZWE1nWW1WbGJpQnlaWEYxWlhOMFpXUXVYRzRnS2k5Y2JrTmhibU5sYkZSdmEyVnVMbkJ5YjNSdmRIbHdaUzUwYUhKdmQwbG1VbVZ4ZFdWemRHVmtJRDBnWm5WdVkzUnBiMjRnZEdoeWIzZEpabEpsY1hWbGMzUmxaQ2dwSUh0Y2JpQWdhV1lnS0hSb2FYTXVjbVZoYzI5dUtTQjdYRzRnSUNBZ2RHaHliM2NnZEdocGN5NXlaV0Z6YjI0N1hHNGdJSDFjYm4wN1hHNWNiaThxS2x4dUlDb2dVbVYwZFhKdWN5QmhiaUJ2WW1wbFkzUWdkR2hoZENCamIyNTBZV2x1Y3lCaElHNWxkeUJnUTJGdVkyVnNWRzlyWlc1Z0lHRnVaQ0JoSUdaMWJtTjBhVzl1SUhSb1lYUXNJSGRvWlc0Z1kyRnNiR1ZrTEZ4dUlDb2dZMkZ1WTJWc2N5QjBhR1VnWUVOaGJtTmxiRlJ2YTJWdVlDNWNiaUFxTDF4dVEyRnVZMlZzVkc5clpXNHVjMjkxY21ObElEMGdablZ1WTNScGIyNGdjMjkxY21ObEtDa2dlMXh1SUNCMllYSWdZMkZ1WTJWc08xeHVJQ0IyWVhJZ2RHOXJaVzRnUFNCdVpYY2dRMkZ1WTJWc1ZHOXJaVzRvWm5WdVkzUnBiMjRnWlhobFkzVjBiM0lvWXlrZ2UxeHVJQ0FnSUdOaGJtTmxiQ0E5SUdNN1hHNGdJSDBwTzF4dUlDQnlaWFIxY200Z2UxeHVJQ0FnSUhSdmEyVnVPaUIwYjJ0bGJpeGNiaUFnSUNCallXNWpaV3c2SUdOaGJtTmxiRnh1SUNCOU8xeHVmVHRjYmx4dWJXOWtkV3hsTG1WNGNHOXlkSE1nUFNCRFlXNWpaV3hVYjJ0bGJqdGNiaUlzSWlkMWMyVWdjM1J5YVdOMEp6dGNibHh1Ylc5a2RXeGxMbVY0Y0c5eWRITWdQU0JtZFc1amRHbHZiaUJwYzBOaGJtTmxiQ2gyWVd4MVpTa2dlMXh1SUNCeVpYUjFjbTRnSVNFb2RtRnNkV1VnSmlZZ2RtRnNkV1V1WDE5RFFVNURSVXhmWHlrN1hHNTlPMXh1SWl3aUozVnpaU0J6ZEhKcFkzUW5PMXh1WEc1MllYSWdaR1ZtWVhWc2RITWdQU0J5WlhGMWFYSmxLQ2N1THk0dUwyUmxabUYxYkhSekp5azdYRzUyWVhJZ2RYUnBiSE1nUFNCeVpYRjFhWEpsS0NjdUx5NHVMM1YwYVd4ekp5azdYRzUyWVhJZ1NXNTBaWEpqWlhCMGIzSk5ZVzVoWjJWeUlEMGdjbVZ4ZFdseVpTZ25MaTlKYm5SbGNtTmxjSFJ2Y2sxaGJtRm5aWEluS1R0Y2JuWmhjaUJrYVhOd1lYUmphRkpsY1hWbGMzUWdQU0J5WlhGMWFYSmxLQ2N1TDJScGMzQmhkR05vVW1WeGRXVnpkQ2NwTzF4dWRtRnlJR2x6UVdKemIyeDFkR1ZWVWt3Z1BTQnlaWEYxYVhKbEtDY3VMeTR1TDJobGJIQmxjbk12YVhOQlluTnZiSFYwWlZWU1RDY3BPMXh1ZG1GeUlHTnZiV0pwYm1WVlVreHpJRDBnY21WeGRXbHlaU2duTGk4dUxpOW9aV3h3WlhKekwyTnZiV0pwYm1WVlVreHpKeWs3WEc1Y2JpOHFLbHh1SUNvZ1EzSmxZWFJsSUdFZ2JtVjNJR2x1YzNSaGJtTmxJRzltSUVGNGFXOXpYRzRnS2x4dUlDb2dRSEJoY21GdElIdFBZbXBsWTNSOUlHbHVjM1JoYm1ObFEyOXVabWxuSUZSb1pTQmtaV1poZFd4MElHTnZibVpwWnlCbWIzSWdkR2hsSUdsdWMzUmhibU5sWEc0Z0tpOWNibVoxYm1OMGFXOXVJRUY0YVc5ektHbHVjM1JoYm1ObFEyOXVabWxuS1NCN1hHNGdJSFJvYVhNdVpHVm1ZWFZzZEhNZ1BTQnBibk4wWVc1alpVTnZibVpwWnp0Y2JpQWdkR2hwY3k1cGJuUmxjbU5sY0hSdmNuTWdQU0I3WEc0Z0lDQWdjbVZ4ZFdWemREb2dibVYzSUVsdWRHVnlZMlZ3ZEc5eVRXRnVZV2RsY2lncExGeHVJQ0FnSUhKbGMzQnZibk5sT2lCdVpYY2dTVzUwWlhKalpYQjBiM0pOWVc1aFoyVnlLQ2xjYmlBZ2ZUdGNibjFjYmx4dUx5b3FYRzRnS2lCRWFYTndZWFJqYUNCaElISmxjWFZsYzNSY2JpQXFYRzRnS2lCQWNHRnlZVzBnZTA5aWFtVmpkSDBnWTI5dVptbG5JRlJvWlNCamIyNW1hV2NnYzNCbFkybG1hV01nWm05eUlIUm9hWE1nY21WeGRXVnpkQ0FvYldWeVoyVmtJSGRwZEdnZ2RHaHBjeTVrWldaaGRXeDBjeWxjYmlBcUwxeHVRWGhwYjNNdWNISnZkRzkwZVhCbExuSmxjWFZsYzNRZ1BTQm1kVzVqZEdsdmJpQnlaWEYxWlhOMEtHTnZibVpwWnlrZ2UxeHVJQ0F2S21WemJHbHVkQ0J1Ynkxd1lYSmhiUzF5WldGemMybG5iam93S2k5Y2JpQWdMeThnUVd4c2IzY2dabTl5SUdGNGFXOXpLQ2RsZUdGdGNHeGxMM1Z5YkNkYkxDQmpiMjVtYVdkZEtTQmhJR3hoSUdabGRHTm9JRUZRU1Z4dUlDQnBaaUFvZEhsd1pXOW1JR052Ym1acFp5QTlQVDBnSjNOMGNtbHVaeWNwSUh0Y2JpQWdJQ0JqYjI1bWFXY2dQU0IxZEdsc2N5NXRaWEpuWlNoN1hHNGdJQ0FnSUNCMWNtdzZJR0Z5WjNWdFpXNTBjMXN3WFZ4dUlDQWdJSDBzSUdGeVozVnRaVzUwYzFzeFhTazdYRzRnSUgxY2JseHVJQ0JqYjI1bWFXY2dQU0IxZEdsc2N5NXRaWEpuWlNoa1pXWmhkV3gwY3l3Z2RHaHBjeTVrWldaaGRXeDBjeXdnZXlCdFpYUm9iMlE2SUNkblpYUW5JSDBzSUdOdmJtWnBaeWs3WEc0Z0lHTnZibVpwWnk1dFpYUm9iMlFnUFNCamIyNW1hV2N1YldWMGFHOWtMblJ2VEc5M1pYSkRZWE5sS0NrN1hHNWNiaUFnTHk4Z1UzVndjRzl5ZENCaVlYTmxWVkpNSUdOdmJtWnBaMXh1SUNCcFppQW9ZMjl1Wm1sbkxtSmhjMlZWVWt3Z0ppWWdJV2x6UVdKemIyeDFkR1ZWVWt3b1kyOXVabWxuTG5WeWJDa3BJSHRjYmlBZ0lDQmpiMjVtYVdjdWRYSnNJRDBnWTI5dFltbHVaVlZTVEhNb1kyOXVabWxuTG1KaGMyVlZVa3dzSUdOdmJtWnBaeTUxY213cE8xeHVJQ0I5WEc1Y2JpQWdMeThnU0c5dmF5QjFjQ0JwYm5SbGNtTmxjSFJ2Y25NZ2JXbGtaR3hsZDJGeVpWeHVJQ0IyWVhJZ1kyaGhhVzRnUFNCYlpHbHpjR0YwWTJoU1pYRjFaWE4wTENCMWJtUmxabWx1WldSZE8xeHVJQ0IyWVhJZ2NISnZiV2x6WlNBOUlGQnliMjFwYzJVdWNtVnpiMngyWlNoamIyNW1hV2NwTzF4dVhHNGdJSFJvYVhNdWFXNTBaWEpqWlhCMGIzSnpMbkpsY1hWbGMzUXVabTl5UldGamFDaG1kVzVqZEdsdmJpQjFibk5vYVdaMFVtVnhkV1Z6ZEVsdWRHVnlZMlZ3ZEc5eWN5aHBiblJsY21ObGNIUnZjaWtnZTF4dUlDQWdJR05vWVdsdUxuVnVjMmhwWm5Rb2FXNTBaWEpqWlhCMGIzSXVablZzWm1sc2JHVmtMQ0JwYm5SbGNtTmxjSFJ2Y2k1eVpXcGxZM1JsWkNrN1hHNGdJSDBwTzF4dVhHNGdJSFJvYVhNdWFXNTBaWEpqWlhCMGIzSnpMbkpsYzNCdmJuTmxMbVp2Y2tWaFkyZ29ablZ1WTNScGIyNGdjSFZ6YUZKbGMzQnZibk5sU1c1MFpYSmpaWEIwYjNKektHbHVkR1Z5WTJWd2RHOXlLU0I3WEc0Z0lDQWdZMmhoYVc0dWNIVnphQ2hwYm5SbGNtTmxjSFJ2Y2k1bWRXeG1hV3hzWldRc0lHbHVkR1Z5WTJWd2RHOXlMbkpsYW1WamRHVmtLVHRjYmlBZ2ZTazdYRzVjYmlBZ2QyaHBiR1VnS0dOb1lXbHVMbXhsYm1kMGFDa2dlMXh1SUNBZ0lIQnliMjFwYzJVZ1BTQndjbTl0YVhObExuUm9aVzRvWTJoaGFXNHVjMmhwWm5Rb0tTd2dZMmhoYVc0dWMyaHBablFvS1NrN1hHNGdJSDFjYmx4dUlDQnlaWFIxY200Z2NISnZiV2x6WlR0Y2JuMDdYRzVjYmk4dklGQnliM1pwWkdVZ1lXeHBZWE5sY3lCbWIzSWdjM1Z3Y0c5eWRHVmtJSEpsY1hWbGMzUWdiV1YwYUc5a2MxeHVkWFJwYkhNdVptOXlSV0ZqYUNoYkoyUmxiR1YwWlNjc0lDZG5aWFFuTENBbmFHVmhaQ2NzSUNkdmNIUnBiMjV6SjEwc0lHWjFibU4wYVc5dUlHWnZja1ZoWTJoTlpYUm9iMlJPYjBSaGRHRW9iV1YwYUc5a0tTQjdYRzRnSUM4cVpYTnNhVzUwSUdaMWJtTXRibUZ0WlhNNk1Db3ZYRzRnSUVGNGFXOXpMbkJ5YjNSdmRIbHdaVnR0WlhSb2IyUmRJRDBnWm5WdVkzUnBiMjRvZFhKc0xDQmpiMjVtYVdjcElIdGNiaUFnSUNCeVpYUjFjbTRnZEdocGN5NXlaWEYxWlhOMEtIVjBhV3h6TG0xbGNtZGxLR052Ym1acFp5QjhmQ0I3ZlN3Z2UxeHVJQ0FnSUNBZ2JXVjBhRzlrT2lCdFpYUm9iMlFzWEc0Z0lDQWdJQ0IxY213NklIVnliRnh1SUNBZ0lIMHBLVHRjYmlBZ2ZUdGNibjBwTzF4dVhHNTFkR2xzY3k1bWIzSkZZV05vS0ZzbmNHOXpkQ2NzSUNkd2RYUW5MQ0FuY0dGMFkyZ25YU3dnWm5WdVkzUnBiMjRnWm05eVJXRmphRTFsZEdodlpGZHBkR2hFWVhSaEtHMWxkR2h2WkNrZ2UxeHVJQ0F2S21WemJHbHVkQ0JtZFc1akxXNWhiV1Z6T2pBcUwxeHVJQ0JCZUdsdmN5NXdjbTkwYjNSNWNHVmJiV1YwYUc5a1hTQTlJR1oxYm1OMGFXOXVLSFZ5YkN3Z1pHRjBZU3dnWTI5dVptbG5LU0I3WEc0Z0lDQWdjbVYwZFhKdUlIUm9hWE11Y21WeGRXVnpkQ2gxZEdsc2N5NXRaWEpuWlNoamIyNW1hV2NnZkh3Z2UzMHNJSHRjYmlBZ0lDQWdJRzFsZEdodlpEb2diV1YwYUc5a0xGeHVJQ0FnSUNBZ2RYSnNPaUIxY213c1hHNGdJQ0FnSUNCa1lYUmhPaUJrWVhSaFhHNGdJQ0FnZlNrcE8xeHVJQ0I5TzF4dWZTazdYRzVjYm0xdlpIVnNaUzVsZUhCdmNuUnpJRDBnUVhocGIzTTdYRzRpTENJbmRYTmxJSE4wY21samRDYzdYRzVjYm5aaGNpQjFkR2xzY3lBOUlISmxjWFZwY21Vb0p5NHZMaTR2ZFhScGJITW5LVHRjYmx4dVpuVnVZM1JwYjI0Z1NXNTBaWEpqWlhCMGIzSk5ZVzVoWjJWeUtDa2dlMXh1SUNCMGFHbHpMbWhoYm1Sc1pYSnpJRDBnVzEwN1hHNTlYRzVjYmk4cUtseHVJQ29nUVdSa0lHRWdibVYzSUdsdWRHVnlZMlZ3ZEc5eUlIUnZJSFJvWlNCemRHRmphMXh1SUNwY2JpQXFJRUJ3WVhKaGJTQjdSblZ1WTNScGIyNTlJR1oxYkdacGJHeGxaQ0JVYUdVZ1puVnVZM1JwYjI0Z2RHOGdhR0Z1Wkd4bElHQjBhR1Z1WUNCbWIzSWdZU0JnVUhKdmJXbHpaV0JjYmlBcUlFQndZWEpoYlNCN1JuVnVZM1JwYjI1OUlISmxhbVZqZEdWa0lGUm9aU0JtZFc1amRHbHZiaUIwYnlCb1lXNWtiR1VnWUhKbGFtVmpkR0FnWm05eUlHRWdZRkJ5YjIxcGMyVmdYRzRnS2x4dUlDb2dRSEpsZEhWeWJpQjdUblZ0WW1WeWZTQkJiaUJKUkNCMWMyVmtJSFJ2SUhKbGJXOTJaU0JwYm5SbGNtTmxjSFJ2Y2lCc1lYUmxjbHh1SUNvdlhHNUpiblJsY21ObGNIUnZjazFoYm1GblpYSXVjSEp2ZEc5MGVYQmxMblZ6WlNBOUlHWjFibU4wYVc5dUlIVnpaU2htZFd4bWFXeHNaV1FzSUhKbGFtVmpkR1ZrS1NCN1hHNGdJSFJvYVhNdWFHRnVaR3hsY25NdWNIVnphQ2g3WEc0Z0lDQWdablZzWm1sc2JHVmtPaUJtZFd4bWFXeHNaV1FzWEc0Z0lDQWdjbVZxWldOMFpXUTZJSEpsYW1WamRHVmtYRzRnSUgwcE8xeHVJQ0J5WlhSMWNtNGdkR2hwY3k1b1lXNWtiR1Z5Y3k1c1pXNW5kR2dnTFNBeE8xeHVmVHRjYmx4dUx5b3FYRzRnS2lCU1pXMXZkbVVnWVc0Z2FXNTBaWEpqWlhCMGIzSWdabkp2YlNCMGFHVWdjM1JoWTJ0Y2JpQXFYRzRnS2lCQWNHRnlZVzBnZTA1MWJXSmxjbjBnYVdRZ1ZHaGxJRWxFSUhSb1lYUWdkMkZ6SUhKbGRIVnlibVZrSUdKNUlHQjFjMlZnWEc0Z0tpOWNia2x1ZEdWeVkyVndkRzl5VFdGdVlXZGxjaTV3Y205MGIzUjVjR1V1WldwbFkzUWdQU0JtZFc1amRHbHZiaUJsYW1WamRDaHBaQ2tnZTF4dUlDQnBaaUFvZEdocGN5NW9ZVzVrYkdWeWMxdHBaRjBwSUh0Y2JpQWdJQ0IwYUdsekxtaGhibVJzWlhKelcybGtYU0E5SUc1MWJHdzdYRzRnSUgxY2JuMDdYRzVjYmk4cUtseHVJQ29nU1hSbGNtRjBaU0J2ZG1WeUlHRnNiQ0IwYUdVZ2NtVm5hWE4wWlhKbFpDQnBiblJsY21ObGNIUnZjbk5jYmlBcVhHNGdLaUJVYUdseklHMWxkR2h2WkNCcGN5QndZWEowYVdOMWJHRnliSGtnZFhObFpuVnNJR1p2Y2lCemEybHdjR2x1WnlCdmRtVnlJR0Z1ZVZ4dUlDb2dhVzUwWlhKalpYQjBiM0p6SUhSb1lYUWdiV0Y1SUdoaGRtVWdZbVZqYjIxbElHQnVkV3hzWUNCallXeHNhVzVuSUdCbGFtVmpkR0F1WEc0Z0tseHVJQ29nUUhCaGNtRnRJSHRHZFc1amRHbHZibjBnWm00Z1ZHaGxJR1oxYm1OMGFXOXVJSFJ2SUdOaGJHd2dabTl5SUdWaFkyZ2dhVzUwWlhKalpYQjBiM0pjYmlBcUwxeHVTVzUwWlhKalpYQjBiM0pOWVc1aFoyVnlMbkJ5YjNSdmRIbHdaUzVtYjNKRllXTm9JRDBnWm5WdVkzUnBiMjRnWm05eVJXRmphQ2htYmlrZ2UxeHVJQ0IxZEdsc2N5NW1iM0pGWVdOb0tIUm9hWE11YUdGdVpHeGxjbk1zSUdaMWJtTjBhVzl1SUdadmNrVmhZMmhJWVc1a2JHVnlLR2dwSUh0Y2JpQWdJQ0JwWmlBb2FDQWhQVDBnYm5Wc2JDa2dlMXh1SUNBZ0lDQWdabTRvYUNrN1hHNGdJQ0FnZlZ4dUlDQjlLVHRjYm4wN1hHNWNibTF2WkhWc1pTNWxlSEJ2Y25SeklEMGdTVzUwWlhKalpYQjBiM0pOWVc1aFoyVnlPMXh1SWl3aUozVnpaU0J6ZEhKcFkzUW5PMXh1WEc1MllYSWdaVzVvWVc1alpVVnljbTl5SUQwZ2NtVnhkV2x5WlNnbkxpOWxibWhoYm1ObFJYSnliM0luS1R0Y2JseHVMeW9xWEc0Z0tpQkRjbVZoZEdVZ1lXNGdSWEp5YjNJZ2QybDBhQ0IwYUdVZ2MzQmxZMmxtYVdWa0lHMWxjM05oWjJVc0lHTnZibVpwWnl3Z1pYSnliM0lnWTI5a1pTd2djbVZ4ZFdWemRDQmhibVFnY21WemNHOXVjMlV1WEc0Z0tseHVJQ29nUUhCaGNtRnRJSHR6ZEhKcGJtZDlJRzFsYzNOaFoyVWdWR2hsSUdWeWNtOXlJRzFsYzNOaFoyVXVYRzRnS2lCQWNHRnlZVzBnZTA5aWFtVmpkSDBnWTI5dVptbG5JRlJvWlNCamIyNW1hV2N1WEc0Z0tpQkFjR0Z5WVcwZ2UzTjBjbWx1WjMwZ1cyTnZaR1ZkSUZSb1pTQmxjbkp2Y2lCamIyUmxJQ2htYjNJZ1pYaGhiWEJzWlN3Z0owVkRUMDVPUVVKUFVsUkZSQ2NwTGx4dUlDb2dRSEJoY21GdElIdFBZbXBsWTNSOUlGdHlaWEYxWlhOMFhTQlVhR1VnY21WeGRXVnpkQzVjYmlBcUlFQndZWEpoYlNCN1QySnFaV04wZlNCYmNtVnpjRzl1YzJWZElGUm9aU0J5WlhOd2IyNXpaUzVjYmlBcUlFQnlaWFIxY201eklIdEZjbkp2Y24wZ1ZHaGxJR055WldGMFpXUWdaWEp5YjNJdVhHNGdLaTljYm0xdlpIVnNaUzVsZUhCdmNuUnpJRDBnWm5WdVkzUnBiMjRnWTNKbFlYUmxSWEp5YjNJb2JXVnpjMkZuWlN3Z1kyOXVabWxuTENCamIyUmxMQ0J5WlhGMVpYTjBMQ0J5WlhOd2IyNXpaU2tnZTF4dUlDQjJZWElnWlhKeWIzSWdQU0J1WlhjZ1JYSnliM0lvYldWemMyRm5aU2s3WEc0Z0lISmxkSFZ5YmlCbGJtaGhibU5sUlhKeWIzSW9aWEp5YjNJc0lHTnZibVpwWnl3Z1kyOWtaU3dnY21WeGRXVnpkQ3dnY21WemNHOXVjMlVwTzF4dWZUdGNiaUlzSWlkMWMyVWdjM1J5YVdOMEp6dGNibHh1ZG1GeUlIVjBhV3h6SUQwZ2NtVnhkV2x5WlNnbkxpOHVMaTkxZEdsc2N5Y3BPMXh1ZG1GeUlIUnlZVzV6Wm05eWJVUmhkR0VnUFNCeVpYRjFhWEpsS0NjdUwzUnlZVzV6Wm05eWJVUmhkR0VuS1R0Y2JuWmhjaUJwYzBOaGJtTmxiQ0E5SUhKbGNYVnBjbVVvSnk0dUwyTmhibU5sYkM5cGMwTmhibU5sYkNjcE8xeHVkbUZ5SUdSbFptRjFiSFJ6SUQwZ2NtVnhkV2x5WlNnbkxpNHZaR1ZtWVhWc2RITW5LVHRjYmx4dUx5b3FYRzRnS2lCVWFISnZkM01nWVNCZ1EyRnVZMlZzWUNCcFppQmpZVzVqWld4c1lYUnBiMjRnYUdGeklHSmxaVzRnY21WeGRXVnpkR1ZrTGx4dUlDb3ZYRzVtZFc1amRHbHZiaUIwYUhKdmQwbG1RMkZ1WTJWc2JHRjBhVzl1VW1WeGRXVnpkR1ZrS0dOdmJtWnBaeWtnZTF4dUlDQnBaaUFvWTI5dVptbG5MbU5oYm1ObGJGUnZhMlZ1S1NCN1hHNGdJQ0FnWTI5dVptbG5MbU5oYm1ObGJGUnZhMlZ1TG5Sb2NtOTNTV1pTWlhGMVpYTjBaV1FvS1R0Y2JpQWdmVnh1ZlZ4dVhHNHZLaXBjYmlBcUlFUnBjM0JoZEdOb0lHRWdjbVZ4ZFdWemRDQjBieUIwYUdVZ2MyVnlkbVZ5SUhWemFXNW5JSFJvWlNCamIyNW1hV2QxY21Wa0lHRmtZWEIwWlhJdVhHNGdLbHh1SUNvZ1FIQmhjbUZ0SUh0dlltcGxZM1I5SUdOdmJtWnBaeUJVYUdVZ1kyOXVabWxuSUhSb1lYUWdhWE1nZEc4Z1ltVWdkWE5sWkNCbWIzSWdkR2hsSUhKbGNYVmxjM1JjYmlBcUlFQnlaWFIxY201eklIdFFjbTl0YVhObGZTQlVhR1VnVUhKdmJXbHpaU0IwYnlCaVpTQm1kV3htYVd4c1pXUmNiaUFxTDF4dWJXOWtkV3hsTG1WNGNHOXlkSE1nUFNCbWRXNWpkR2x2YmlCa2FYTndZWFJqYUZKbGNYVmxjM1FvWTI5dVptbG5LU0I3WEc0Z0lIUm9jbTkzU1daRFlXNWpaV3hzWVhScGIyNVNaWEYxWlhOMFpXUW9ZMjl1Wm1sbktUdGNibHh1SUNBdkx5QkZibk4xY21VZ2FHVmhaR1Z5Y3lCbGVHbHpkRnh1SUNCamIyNW1hV2N1YUdWaFpHVnljeUE5SUdOdmJtWnBaeTVvWldGa1pYSnpJSHg4SUh0OU8xeHVYRzRnSUM4dklGUnlZVzV6Wm05eWJTQnlaWEYxWlhOMElHUmhkR0ZjYmlBZ1kyOXVabWxuTG1SaGRHRWdQU0IwY21GdWMyWnZjbTFFWVhSaEtGeHVJQ0FnSUdOdmJtWnBaeTVrWVhSaExGeHVJQ0FnSUdOdmJtWnBaeTVvWldGa1pYSnpMRnh1SUNBZ0lHTnZibVpwWnk1MGNtRnVjMlp2Y20xU1pYRjFaWE4wWEc0Z0lDazdYRzVjYmlBZ0x5OGdSbXhoZEhSbGJpQm9aV0ZrWlhKelhHNGdJR052Ym1acFp5NW9aV0ZrWlhKeklEMGdkWFJwYkhNdWJXVnlaMlVvWEc0Z0lDQWdZMjl1Wm1sbkxtaGxZV1JsY25NdVkyOXRiVzl1SUh4OElIdDlMRnh1SUNBZ0lHTnZibVpwWnk1b1pXRmtaWEp6VzJOdmJtWnBaeTV0WlhSb2IyUmRJSHg4SUh0OUxGeHVJQ0FnSUdOdmJtWnBaeTVvWldGa1pYSnpJSHg4SUh0OVhHNGdJQ2s3WEc1Y2JpQWdkWFJwYkhNdVptOXlSV0ZqYUNoY2JpQWdJQ0JiSjJSbGJHVjBaU2NzSUNkblpYUW5MQ0FuYUdWaFpDY3NJQ2R3YjNOMEp5d2dKM0IxZENjc0lDZHdZWFJqYUNjc0lDZGpiMjF0YjI0blhTeGNiaUFnSUNCbWRXNWpkR2x2YmlCamJHVmhia2hsWVdSbGNrTnZibVpwWnlodFpYUm9iMlFwSUh0Y2JpQWdJQ0FnSUdSbGJHVjBaU0JqYjI1bWFXY3VhR1ZoWkdWeWMxdHRaWFJvYjJSZE8xeHVJQ0FnSUgxY2JpQWdLVHRjYmx4dUlDQjJZWElnWVdSaGNIUmxjaUE5SUdOdmJtWnBaeTVoWkdGd2RHVnlJSHg4SUdSbFptRjFiSFJ6TG1Ga1lYQjBaWEk3WEc1Y2JpQWdjbVYwZFhKdUlHRmtZWEIwWlhJb1kyOXVabWxuS1M1MGFHVnVLR1oxYm1OMGFXOXVJRzl1UVdSaGNIUmxjbEpsYzI5c2RYUnBiMjRvY21WemNHOXVjMlVwSUh0Y2JpQWdJQ0IwYUhKdmQwbG1RMkZ1WTJWc2JHRjBhVzl1VW1WeGRXVnpkR1ZrS0dOdmJtWnBaeWs3WEc1Y2JpQWdJQ0F2THlCVWNtRnVjMlp2Y20wZ2NtVnpjRzl1YzJVZ1pHRjBZVnh1SUNBZ0lISmxjM0J2Ym5ObExtUmhkR0VnUFNCMGNtRnVjMlp2Y20xRVlYUmhLRnh1SUNBZ0lDQWdjbVZ6Y0c5dWMyVXVaR0YwWVN4Y2JpQWdJQ0FnSUhKbGMzQnZibk5sTG1obFlXUmxjbk1zWEc0Z0lDQWdJQ0JqYjI1bWFXY3VkSEpoYm5ObWIzSnRVbVZ6Y0c5dWMyVmNiaUFnSUNBcE8xeHVYRzRnSUNBZ2NtVjBkWEp1SUhKbGMzQnZibk5sTzF4dUlDQjlMQ0JtZFc1amRHbHZiaUJ2YmtGa1lYQjBaWEpTWldwbFkzUnBiMjRvY21WaGMyOXVLU0I3WEc0Z0lDQWdhV1lnS0NGcGMwTmhibU5sYkNoeVpXRnpiMjRwS1NCN1hHNGdJQ0FnSUNCMGFISnZkMGxtUTJGdVkyVnNiR0YwYVc5dVVtVnhkV1Z6ZEdWa0tHTnZibVpwWnlrN1hHNWNiaUFnSUNBZ0lDOHZJRlJ5WVc1elptOXliU0J5WlhOd2IyNXpaU0JrWVhSaFhHNGdJQ0FnSUNCcFppQW9jbVZoYzI5dUlDWW1JSEpsWVhOdmJpNXlaWE53YjI1elpTa2dlMXh1SUNBZ0lDQWdJQ0J5WldGemIyNHVjbVZ6Y0c5dWMyVXVaR0YwWVNBOUlIUnlZVzV6Wm05eWJVUmhkR0VvWEc0Z0lDQWdJQ0FnSUNBZ2NtVmhjMjl1TG5KbGMzQnZibk5sTG1SaGRHRXNYRzRnSUNBZ0lDQWdJQ0FnY21WaGMyOXVMbkpsYzNCdmJuTmxMbWhsWVdSbGNuTXNYRzRnSUNBZ0lDQWdJQ0FnWTI5dVptbG5MblJ5WVc1elptOXliVkpsYzNCdmJuTmxYRzRnSUNBZ0lDQWdJQ2s3WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdmVnh1WEc0Z0lDQWdjbVYwZFhKdUlGQnliMjFwYzJVdWNtVnFaV04wS0hKbFlYTnZiaWs3WEc0Z0lIMHBPMXh1ZlR0Y2JpSXNJaWQxYzJVZ2MzUnlhV04wSnp0Y2JseHVMeW9xWEc0Z0tpQlZjR1JoZEdVZ1lXNGdSWEp5YjNJZ2QybDBhQ0IwYUdVZ2MzQmxZMmxtYVdWa0lHTnZibVpwWnl3Z1pYSnliM0lnWTI5a1pTd2dZVzVrSUhKbGMzQnZibk5sTGx4dUlDcGNiaUFxSUVCd1lYSmhiU0I3UlhKeWIzSjlJR1Z5Y205eUlGUm9aU0JsY25KdmNpQjBieUIxY0dSaGRHVXVYRzRnS2lCQWNHRnlZVzBnZTA5aWFtVmpkSDBnWTI5dVptbG5JRlJvWlNCamIyNW1hV2N1WEc0Z0tpQkFjR0Z5WVcwZ2UzTjBjbWx1WjMwZ1cyTnZaR1ZkSUZSb1pTQmxjbkp2Y2lCamIyUmxJQ2htYjNJZ1pYaGhiWEJzWlN3Z0owVkRUMDVPUVVKUFVsUkZSQ2NwTGx4dUlDb2dRSEJoY21GdElIdFBZbXBsWTNSOUlGdHlaWEYxWlhOMFhTQlVhR1VnY21WeGRXVnpkQzVjYmlBcUlFQndZWEpoYlNCN1QySnFaV04wZlNCYmNtVnpjRzl1YzJWZElGUm9aU0J5WlhOd2IyNXpaUzVjYmlBcUlFQnlaWFIxY201eklIdEZjbkp2Y24wZ1ZHaGxJR1Z5Y205eUxseHVJQ292WEc1dGIyUjFiR1V1Wlhod2IzSjBjeUE5SUdaMWJtTjBhVzl1SUdWdWFHRnVZMlZGY25KdmNpaGxjbkp2Y2l3Z1kyOXVabWxuTENCamIyUmxMQ0J5WlhGMVpYTjBMQ0J5WlhOd2IyNXpaU2tnZTF4dUlDQmxjbkp2Y2k1amIyNW1hV2NnUFNCamIyNW1hV2M3WEc0Z0lHbG1JQ2hqYjJSbEtTQjdYRzRnSUNBZ1pYSnliM0l1WTI5a1pTQTlJR052WkdVN1hHNGdJSDFjYmlBZ1pYSnliM0l1Y21WeGRXVnpkQ0E5SUhKbGNYVmxjM1E3WEc0Z0lHVnljbTl5TG5KbGMzQnZibk5sSUQwZ2NtVnpjRzl1YzJVN1hHNGdJSEpsZEhWeWJpQmxjbkp2Y2p0Y2JuMDdYRzRpTENJbmRYTmxJSE4wY21samRDYzdYRzVjYm5aaGNpQmpjbVZoZEdWRmNuSnZjaUE5SUhKbGNYVnBjbVVvSnk0dlkzSmxZWFJsUlhKeWIzSW5LVHRjYmx4dUx5b3FYRzRnS2lCU1pYTnZiSFpsSUc5eUlISmxhbVZqZENCaElGQnliMjFwYzJVZ1ltRnpaV1FnYjI0Z2NtVnpjRzl1YzJVZ2MzUmhkSFZ6TGx4dUlDcGNiaUFxSUVCd1lYSmhiU0I3Um5WdVkzUnBiMjU5SUhKbGMyOXNkbVVnUVNCbWRXNWpkR2x2YmlCMGFHRjBJSEpsYzI5c2RtVnpJSFJvWlNCd2NtOXRhWE5sTGx4dUlDb2dRSEJoY21GdElIdEdkVzVqZEdsdmJuMGdjbVZxWldOMElFRWdablZ1WTNScGIyNGdkR2hoZENCeVpXcGxZM1J6SUhSb1pTQndjbTl0YVhObExseHVJQ29nUUhCaGNtRnRJSHR2WW1wbFkzUjlJSEpsYzNCdmJuTmxJRlJvWlNCeVpYTndiMjV6WlM1Y2JpQXFMMXh1Ylc5a2RXeGxMbVY0Y0c5eWRITWdQU0JtZFc1amRHbHZiaUJ6WlhSMGJHVW9jbVZ6YjJ4MlpTd2djbVZxWldOMExDQnlaWE53YjI1elpTa2dlMXh1SUNCMllYSWdkbUZzYVdSaGRHVlRkR0YwZFhNZ1BTQnlaWE53YjI1elpTNWpiMjVtYVdjdWRtRnNhV1JoZEdWVGRHRjBkWE03WEc0Z0lDOHZJRTV2ZEdVNklITjBZWFIxY3lCcGN5QnViM1FnWlhod2IzTmxaQ0JpZVNCWVJHOXRZV2x1VW1WeGRXVnpkRnh1SUNCcFppQW9JWEpsYzNCdmJuTmxMbk4wWVhSMWN5QjhmQ0FoZG1Gc2FXUmhkR1ZUZEdGMGRYTWdmSHdnZG1Gc2FXUmhkR1ZUZEdGMGRYTW9jbVZ6Y0c5dWMyVXVjM1JoZEhWektTa2dlMXh1SUNBZ0lISmxjMjlzZG1Vb2NtVnpjRzl1YzJVcE8xeHVJQ0I5SUdWc2MyVWdlMXh1SUNBZ0lISmxhbVZqZENoamNtVmhkR1ZGY25KdmNpaGNiaUFnSUNBZ0lDZFNaWEYxWlhOMElHWmhhV3hsWkNCM2FYUm9JSE4wWVhSMWN5QmpiMlJsSUNjZ0t5QnlaWE53YjI1elpTNXpkR0YwZFhNc1hHNGdJQ0FnSUNCeVpYTndiMjV6WlM1amIyNW1hV2NzWEc0Z0lDQWdJQ0J1ZFd4c0xGeHVJQ0FnSUNBZ2NtVnpjRzl1YzJVdWNtVnhkV1Z6ZEN4Y2JpQWdJQ0FnSUhKbGMzQnZibk5sWEc0Z0lDQWdLU2s3WEc0Z0lIMWNibjA3WEc0aUxDSW5kWE5sSUhOMGNtbGpkQ2M3WEc1Y2JuWmhjaUIxZEdsc2N5QTlJSEpsY1hWcGNtVW9KeTR2TGk0dmRYUnBiSE1uS1R0Y2JseHVMeW9xWEc0Z0tpQlVjbUZ1YzJadmNtMGdkR2hsSUdSaGRHRWdabTl5SUdFZ2NtVnhkV1Z6ZENCdmNpQmhJSEpsYzNCdmJuTmxYRzRnS2x4dUlDb2dRSEJoY21GdElIdFBZbXBsWTNSOFUzUnlhVzVuZlNCa1lYUmhJRlJvWlNCa1lYUmhJSFJ2SUdKbElIUnlZVzV6Wm05eWJXVmtYRzRnS2lCQWNHRnlZVzBnZTBGeWNtRjVmU0JvWldGa1pYSnpJRlJvWlNCb1pXRmtaWEp6SUdadmNpQjBhR1VnY21WeGRXVnpkQ0J2Y2lCeVpYTndiMjV6WlZ4dUlDb2dRSEJoY21GdElIdEJjbkpoZVh4R2RXNWpkR2x2Ym4wZ1ptNXpJRUVnYzJsdVoyeGxJR1oxYm1OMGFXOXVJRzl5SUVGeWNtRjVJRzltSUdaMWJtTjBhVzl1YzF4dUlDb2dRSEpsZEhWeWJuTWdleXA5SUZSb1pTQnlaWE4xYkhScGJtY2dkSEpoYm5ObWIzSnRaV1FnWkdGMFlWeHVJQ292WEc1dGIyUjFiR1V1Wlhod2IzSjBjeUE5SUdaMWJtTjBhVzl1SUhSeVlXNXpabTl5YlVSaGRHRW9aR0YwWVN3Z2FHVmhaR1Z5Y3l3Z1ptNXpLU0I3WEc0Z0lDOHFaWE5zYVc1MElHNXZMWEJoY21GdExYSmxZWE56YVdkdU9qQXFMMXh1SUNCMWRHbHNjeTVtYjNKRllXTm9LR1p1Y3l3Z1puVnVZM1JwYjI0Z2RISmhibk5tYjNKdEtHWnVLU0I3WEc0Z0lDQWdaR0YwWVNBOUlHWnVLR1JoZEdFc0lHaGxZV1JsY25NcE8xeHVJQ0I5S1R0Y2JseHVJQ0J5WlhSMWNtNGdaR0YwWVR0Y2JuMDdYRzRpTENJbmRYTmxJSE4wY21samRDYzdYRzVjYm5aaGNpQjFkR2xzY3lBOUlISmxjWFZwY21Vb0p5NHZkWFJwYkhNbktUdGNiblpoY2lCdWIzSnRZV3hwZW1WSVpXRmtaWEpPWVcxbElEMGdjbVZ4ZFdseVpTZ25MaTlvWld4d1pYSnpMMjV2Y20xaGJHbDZaVWhsWVdSbGNrNWhiV1VuS1R0Y2JseHVkbUZ5SUVSRlJrRlZURlJmUTA5T1ZFVk9WRjlVV1ZCRklEMGdlMXh1SUNBblEyOXVkR1Z1ZEMxVWVYQmxKem9nSjJGd2NHeHBZMkYwYVc5dUwzZ3RkM2QzTFdadmNtMHRkWEpzWlc1amIyUmxaQ2RjYm4wN1hHNWNibVoxYm1OMGFXOXVJSE5sZEVOdmJuUmxiblJVZVhCbFNXWlZibk5sZENob1pXRmtaWEp6TENCMllXeDFaU2tnZTF4dUlDQnBaaUFvSVhWMGFXeHpMbWx6Vlc1a1pXWnBibVZrS0dobFlXUmxjbk1wSUNZbUlIVjBhV3h6TG1selZXNWtaV1pwYm1Wa0tHaGxZV1JsY25OYkowTnZiblJsYm5RdFZIbHdaU2RkS1NrZ2UxeHVJQ0FnSUdobFlXUmxjbk5iSjBOdmJuUmxiblF0Vkhsd1pTZGRJRDBnZG1Gc2RXVTdYRzRnSUgxY2JuMWNibHh1Wm5WdVkzUnBiMjRnWjJWMFJHVm1ZWFZzZEVGa1lYQjBaWElvS1NCN1hHNGdJSFpoY2lCaFpHRndkR1Z5TzF4dUlDQnBaaUFvZEhsd1pXOW1JRmhOVEVoMGRIQlNaWEYxWlhOMElDRTlQU0FuZFc1a1pXWnBibVZrSnlrZ2UxeHVJQ0FnSUM4dklFWnZjaUJpY205M2MyVnljeUIxYzJVZ1dFaFNJR0ZrWVhCMFpYSmNiaUFnSUNCaFpHRndkR1Z5SUQwZ2NtVnhkV2x5WlNnbkxpOWhaR0Z3ZEdWeWN5OTRhSEluS1R0Y2JpQWdmU0JsYkhObElHbG1JQ2gwZVhCbGIyWWdjSEp2WTJWemN5QWhQVDBnSjNWdVpHVm1hVzVsWkNjcElIdGNiaUFnSUNBdkx5QkdiM0lnYm05a1pTQjFjMlVnU0ZSVVVDQmhaR0Z3ZEdWeVhHNGdJQ0FnWVdSaGNIUmxjaUE5SUhKbGNYVnBjbVVvSnk0dllXUmhjSFJsY25NdmFIUjBjQ2NwTzF4dUlDQjlYRzRnSUhKbGRIVnliaUJoWkdGd2RHVnlPMXh1ZlZ4dVhHNTJZWElnWkdWbVlYVnNkSE1nUFNCN1hHNGdJR0ZrWVhCMFpYSTZJR2RsZEVSbFptRjFiSFJCWkdGd2RHVnlLQ2tzWEc1Y2JpQWdkSEpoYm5ObWIzSnRVbVZ4ZFdWemREb2dXMloxYm1OMGFXOXVJSFJ5WVc1elptOXliVkpsY1hWbGMzUW9aR0YwWVN3Z2FHVmhaR1Z5Y3lrZ2UxeHVJQ0FnSUc1dmNtMWhiR2w2WlVobFlXUmxjazVoYldVb2FHVmhaR1Z5Y3l3Z0owTnZiblJsYm5RdFZIbHdaU2NwTzF4dUlDQWdJR2xtSUNoMWRHbHNjeTVwYzBadmNtMUVZWFJoS0dSaGRHRXBJSHg4WEc0Z0lDQWdJQ0IxZEdsc2N5NXBjMEZ5Y21GNVFuVm1abVZ5S0dSaGRHRXBJSHg4WEc0Z0lDQWdJQ0IxZEdsc2N5NXBjMEoxWm1abGNpaGtZWFJoS1NCOGZGeHVJQ0FnSUNBZ2RYUnBiSE11YVhOVGRISmxZVzBvWkdGMFlTa2dmSHhjYmlBZ0lDQWdJSFYwYVd4ekxtbHpSbWxzWlNoa1lYUmhLU0I4ZkZ4dUlDQWdJQ0FnZFhScGJITXVhWE5DYkc5aUtHUmhkR0VwWEc0Z0lDQWdLU0I3WEc0Z0lDQWdJQ0J5WlhSMWNtNGdaR0YwWVR0Y2JpQWdJQ0I5WEc0Z0lDQWdhV1lnS0hWMGFXeHpMbWx6UVhKeVlYbENkV1ptWlhKV2FXVjNLR1JoZEdFcEtTQjdYRzRnSUNBZ0lDQnlaWFIxY200Z1pHRjBZUzVpZFdabVpYSTdYRzRnSUNBZ2ZWeHVJQ0FnSUdsbUlDaDFkR2xzY3k1cGMxVlNURk5sWVhKamFGQmhjbUZ0Y3loa1lYUmhLU2tnZTF4dUlDQWdJQ0FnYzJWMFEyOXVkR1Z1ZEZSNWNHVkpabFZ1YzJWMEtHaGxZV1JsY25Nc0lDZGhjSEJzYVdOaGRHbHZiaTk0TFhkM2R5MW1iM0p0TFhWeWJHVnVZMjlrWldRN1kyaGhjbk5sZEQxMWRHWXRPQ2NwTzF4dUlDQWdJQ0FnY21WMGRYSnVJR1JoZEdFdWRHOVRkSEpwYm1jb0tUdGNiaUFnSUNCOVhHNGdJQ0FnYVdZZ0tIVjBhV3h6TG1selQySnFaV04wS0dSaGRHRXBLU0I3WEc0Z0lDQWdJQ0J6WlhSRGIyNTBaVzUwVkhsd1pVbG1WVzV6WlhRb2FHVmhaR1Z5Y3l3Z0oyRndjR3hwWTJGMGFXOXVMMnB6YjI0N1kyaGhjbk5sZEQxMWRHWXRPQ2NwTzF4dUlDQWdJQ0FnY21WMGRYSnVJRXBUVDA0dWMzUnlhVzVuYVdaNUtHUmhkR0VwTzF4dUlDQWdJSDFjYmlBZ0lDQnlaWFIxY200Z1pHRjBZVHRjYmlBZ2ZWMHNYRzVjYmlBZ2RISmhibk5tYjNKdFVtVnpjRzl1YzJVNklGdG1kVzVqZEdsdmJpQjBjbUZ1YzJadmNtMVNaWE53YjI1elpTaGtZWFJoS1NCN1hHNGdJQ0FnTHlwbGMyeHBiblFnYm04dGNHRnlZVzB0Y21WaGMzTnBaMjQ2TUNvdlhHNGdJQ0FnYVdZZ0tIUjVjR1Z2WmlCa1lYUmhJRDA5UFNBbmMzUnlhVzVuSnlrZ2UxeHVJQ0FnSUNBZ2RISjVJSHRjYmlBZ0lDQWdJQ0FnWkdGMFlTQTlJRXBUVDA0dWNHRnljMlVvWkdGMFlTazdYRzRnSUNBZ0lDQjlJR05oZEdOb0lDaGxLU0I3SUM4cUlFbG5ibTl5WlNBcUx5QjlYRzRnSUNBZ2ZWeHVJQ0FnSUhKbGRIVnliaUJrWVhSaE8xeHVJQ0I5WFN4Y2JseHVJQ0IwYVcxbGIzVjBPaUF3TEZ4dVhHNGdJSGh6Y21aRGIyOXJhV1ZPWVcxbE9pQW5XRk5TUmkxVVQwdEZUaWNzWEc0Z0lIaHpjbVpJWldGa1pYSk9ZVzFsT2lBbldDMVlVMUpHTFZSUFMwVk9KeXhjYmx4dUlDQnRZWGhEYjI1MFpXNTBUR1Z1WjNSb09pQXRNU3hjYmx4dUlDQjJZV3hwWkdGMFpWTjBZWFIxY3pvZ1puVnVZM1JwYjI0Z2RtRnNhV1JoZEdWVGRHRjBkWE1vYzNSaGRIVnpLU0I3WEc0Z0lDQWdjbVYwZFhKdUlITjBZWFIxY3lBK1BTQXlNREFnSmlZZ2MzUmhkSFZ6SUR3Z016QXdPMXh1SUNCOVhHNTlPMXh1WEc1a1pXWmhkV3gwY3k1b1pXRmtaWEp6SUQwZ2UxeHVJQ0JqYjIxdGIyNDZJSHRjYmlBZ0lDQW5RV05qWlhCMEp6b2dKMkZ3Y0d4cFkyRjBhVzl1TDJwemIyNHNJSFJsZUhRdmNHeGhhVzRzSUNvdktpZGNiaUFnZlZ4dWZUdGNibHh1ZFhScGJITXVabTl5UldGamFDaGJKMlJsYkdWMFpTY3NJQ2RuWlhRbkxDQW5hR1ZoWkNkZExDQm1kVzVqZEdsdmJpQm1iM0pGWVdOb1RXVjBhRzlrVG05RVlYUmhLRzFsZEdodlpDa2dlMXh1SUNCa1pXWmhkV3gwY3k1b1pXRmtaWEp6VzIxbGRHaHZaRjBnUFNCN2ZUdGNibjBwTzF4dVhHNTFkR2xzY3k1bWIzSkZZV05vS0ZzbmNHOXpkQ2NzSUNkd2RYUW5MQ0FuY0dGMFkyZ25YU3dnWm5WdVkzUnBiMjRnWm05eVJXRmphRTFsZEdodlpGZHBkR2hFWVhSaEtHMWxkR2h2WkNrZ2UxeHVJQ0JrWldaaGRXeDBjeTVvWldGa1pYSnpXMjFsZEdodlpGMGdQU0IxZEdsc2N5NXRaWEpuWlNoRVJVWkJWVXhVWDBOUFRsUkZUbFJmVkZsUVJTazdYRzU5S1R0Y2JseHViVzlrZFd4bExtVjRjRzl5ZEhNZ1BTQmtaV1poZFd4MGN6dGNiaUlzSWlkMWMyVWdjM1J5YVdOMEp6dGNibHh1Ylc5a2RXeGxMbVY0Y0c5eWRITWdQU0JtZFc1amRHbHZiaUJpYVc1a0tHWnVMQ0IwYUdselFYSm5LU0I3WEc0Z0lISmxkSFZ5YmlCbWRXNWpkR2x2YmlCM2NtRndLQ2tnZTF4dUlDQWdJSFpoY2lCaGNtZHpJRDBnYm1WM0lFRnljbUY1S0dGeVozVnRaVzUwY3k1c1pXNW5kR2dwTzF4dUlDQWdJR1p2Y2lBb2RtRnlJR2tnUFNBd095QnBJRHdnWVhKbmN5NXNaVzVuZEdnN0lHa3JLeWtnZTF4dUlDQWdJQ0FnWVhKbmMxdHBYU0E5SUdGeVozVnRaVzUwYzF0cFhUdGNiaUFnSUNCOVhHNGdJQ0FnY21WMGRYSnVJR1p1TG1Gd2NHeDVLSFJvYVhOQmNtY3NJR0Z5WjNNcE8xeHVJQ0I5TzF4dWZUdGNiaUlzSWlkMWMyVWdjM1J5YVdOMEp6dGNibHh1THk4Z1luUnZZU0J3YjJ4NVptbHNiQ0JtYjNJZ1NVVThNVEFnWTI5MWNuUmxjM2tnYUhSMGNITTZMeTluYVhSb2RXSXVZMjl0TDJSaGRtbGtZMmhoYldKbGNuTXZRbUZ6WlRZMExtcHpYRzVjYm5aaGNpQmphR0Z5Y3lBOUlDZEJRa05FUlVaSFNFbEtTMHhOVGs5UVVWSlRWRlZXVjFoWldtRmlZMlJsWm1kb2FXcHJiRzF1YjNCeGNuTjBkWFozZUhsNk1ERXlNelExTmpjNE9Tc3ZQU2M3WEc1Y2JtWjFibU4wYVc5dUlFVW9LU0I3WEc0Z0lIUm9hWE11YldWemMyRm5aU0E5SUNkVGRISnBibWNnWTI5dWRHRnBibk1nWVc0Z2FXNTJZV3hwWkNCamFHRnlZV04wWlhJbk8xeHVmVnh1UlM1d2NtOTBiM1I1Y0dVZ1BTQnVaWGNnUlhKeWIzSTdYRzVGTG5CeWIzUnZkSGx3WlM1amIyUmxJRDBnTlR0Y2JrVXVjSEp2ZEc5MGVYQmxMbTVoYldVZ1BTQW5TVzUyWVd4cFpFTm9ZWEpoWTNSbGNrVnljbTl5Snp0Y2JseHVablZ1WTNScGIyNGdZblJ2WVNocGJuQjFkQ2tnZTF4dUlDQjJZWElnYzNSeUlEMGdVM1J5YVc1bktHbHVjSFYwS1R0Y2JpQWdkbUZ5SUc5MWRIQjFkQ0E5SUNjbk8xeHVJQ0JtYjNJZ0tGeHVJQ0FnSUM4dklHbHVhWFJwWVd4cGVtVWdjbVZ6ZFd4MElHRnVaQ0JqYjNWdWRHVnlYRzRnSUNBZ2RtRnlJR0pzYjJOckxDQmphR0Z5UTI5a1pTd2dhV1I0SUQwZ01Dd2diV0Z3SUQwZ1kyaGhjbk03WEc0Z0lDQWdMeThnYVdZZ2RHaGxJRzVsZUhRZ2MzUnlJR2x1WkdWNElHUnZaWE1nYm05MElHVjRhWE4wT2x4dUlDQWdJQzh2SUNBZ1kyaGhibWRsSUhSb1pTQnRZWEJ3YVc1bklIUmhZbXhsSUhSdklGd2lQVndpWEc0Z0lDQWdMeThnSUNCamFHVmpheUJwWmlCa0lHaGhjeUJ1YnlCbWNtRmpkR2x2Ym1Gc0lHUnBaMmwwYzF4dUlDQWdJSE4wY2k1amFHRnlRWFFvYVdSNElId2dNQ2tnZkh3Z0tHMWhjQ0E5SUNjOUp5d2dhV1I0SUNVZ01TazdYRzRnSUNBZ0x5OGdYQ0k0SUMwZ2FXUjRJQ1VnTVNBcUlEaGNJaUJuWlc1bGNtRjBaWE1nZEdobElITmxjWFZsYm1ObElESXNJRFFzSURZc0lEaGNiaUFnSUNCdmRYUndkWFFnS3owZ2JXRndMbU5vWVhKQmRDZzJNeUFtSUdKc2IyTnJJRDQrSURnZ0xTQnBaSGdnSlNBeElDb2dPQ2xjYmlBZ0tTQjdYRzRnSUNBZ1kyaGhja052WkdVZ1BTQnpkSEl1WTJoaGNrTnZaR1ZCZENocFpIZ2dLejBnTXlBdklEUXBPMXh1SUNBZ0lHbG1JQ2hqYUdGeVEyOWtaU0ErSURCNFJrWXBJSHRjYmlBZ0lDQWdJSFJvY205M0lHNWxkeUJGS0NrN1hHNGdJQ0FnZlZ4dUlDQWdJR0pzYjJOcklEMGdZbXh2WTJzZ1BEd2dPQ0I4SUdOb1lYSkRiMlJsTzF4dUlDQjlYRzRnSUhKbGRIVnliaUJ2ZFhSd2RYUTdYRzU5WEc1Y2JtMXZaSFZzWlM1bGVIQnZjblJ6SUQwZ1luUnZZVHRjYmlJc0lpZDFjMlVnYzNSeWFXTjBKenRjYmx4dWRtRnlJSFYwYVd4eklEMGdjbVZ4ZFdseVpTZ25MaTh1TGk5MWRHbHNjeWNwTzF4dVhHNW1kVzVqZEdsdmJpQmxibU52WkdVb2RtRnNLU0I3WEc0Z0lISmxkSFZ5YmlCbGJtTnZaR1ZWVWtsRGIyMXdiMjVsYm5Rb2RtRnNLUzVjYmlBZ0lDQnlaWEJzWVdObEtDOGxOREF2WjJrc0lDZEFKeWt1WEc0Z0lDQWdjbVZ3YkdGalpTZ3ZKVE5CTDJkcExDQW5PaWNwTGx4dUlDQWdJSEpsY0d4aFkyVW9MeVV5TkM5bkxDQW5KQ2NwTGx4dUlDQWdJSEpsY0d4aFkyVW9MeVV5UXk5bmFTd2dKeXduS1M1Y2JpQWdJQ0J5WlhCc1lXTmxLQzhsTWpBdlp5d2dKeXNuS1M1Y2JpQWdJQ0J5WlhCc1lXTmxLQzhsTlVJdloya3NJQ2RiSnlrdVhHNGdJQ0FnY21Wd2JHRmpaU2d2SlRWRUwyZHBMQ0FuWFNjcE8xeHVmVnh1WEc0dktpcGNiaUFxSUVKMWFXeGtJR0VnVlZKTUlHSjVJR0Z3Y0dWdVpHbHVaeUJ3WVhKaGJYTWdkRzhnZEdobElHVnVaRnh1SUNwY2JpQXFJRUJ3WVhKaGJTQjdjM1J5YVc1bmZTQjFjbXdnVkdobElHSmhjMlVnYjJZZ2RHaGxJSFZ5YkNBb1pTNW5MaXdnYUhSMGNEb3ZMM2QzZHk1bmIyOW5iR1V1WTI5dEtWeHVJQ29nUUhCaGNtRnRJSHR2WW1wbFkzUjlJRnR3WVhKaGJYTmRJRlJvWlNCd1lYSmhiWE1nZEc4Z1ltVWdZWEJ3Wlc1a1pXUmNiaUFxSUVCeVpYUjFjbTV6SUh0emRISnBibWQ5SUZSb1pTQm1iM0p0WVhSMFpXUWdkWEpzWEc0Z0tpOWNibTF2WkhWc1pTNWxlSEJ2Y25SeklEMGdablZ1WTNScGIyNGdZblZwYkdSVlVrd29kWEpzTENCd1lYSmhiWE1zSUhCaGNtRnRjMU5sY21saGJHbDZaWElwSUh0Y2JpQWdMeXBsYzJ4cGJuUWdibTh0Y0dGeVlXMHRjbVZoYzNOcFoyNDZNQ292WEc0Z0lHbG1JQ2doY0dGeVlXMXpLU0I3WEc0Z0lDQWdjbVYwZFhKdUlIVnliRHRjYmlBZ2ZWeHVYRzRnSUhaaGNpQnpaWEpwWVd4cGVtVmtVR0Z5WVcxek8xeHVJQ0JwWmlBb2NHRnlZVzF6VTJWeWFXRnNhWHBsY2lrZ2UxeHVJQ0FnSUhObGNtbGhiR2w2WldSUVlYSmhiWE1nUFNCd1lYSmhiWE5UWlhKcFlXeHBlbVZ5S0hCaGNtRnRjeWs3WEc0Z0lIMGdaV3h6WlNCcFppQW9kWFJwYkhNdWFYTlZVa3hUWldGeVkyaFFZWEpoYlhNb2NHRnlZVzF6S1NrZ2UxeHVJQ0FnSUhObGNtbGhiR2w2WldSUVlYSmhiWE1nUFNCd1lYSmhiWE11ZEc5VGRISnBibWNvS1R0Y2JpQWdmU0JsYkhObElIdGNiaUFnSUNCMllYSWdjR0Z5ZEhNZ1BTQmJYVHRjYmx4dUlDQWdJSFYwYVd4ekxtWnZja1ZoWTJnb2NHRnlZVzF6TENCbWRXNWpkR2x2YmlCelpYSnBZV3hwZW1Vb2RtRnNMQ0JyWlhrcElIdGNiaUFnSUNBZ0lHbG1JQ2gyWVd3Z1BUMDlJRzUxYkd3Z2ZId2dkSGx3Wlc5bUlIWmhiQ0E5UFQwZ0ozVnVaR1ZtYVc1bFpDY3BJSHRjYmlBZ0lDQWdJQ0FnY21WMGRYSnVPMXh1SUNBZ0lDQWdmVnh1WEc0Z0lDQWdJQ0JwWmlBb2RYUnBiSE11YVhOQmNuSmhlU2gyWVd3cEtTQjdYRzRnSUNBZ0lDQWdJR3RsZVNBOUlHdGxlU0FySUNkYlhTYzdYRzRnSUNBZ0lDQjlYRzVjYmlBZ0lDQWdJR2xtSUNnaGRYUnBiSE11YVhOQmNuSmhlU2gyWVd3cEtTQjdYRzRnSUNBZ0lDQWdJSFpoYkNBOUlGdDJZV3hkTzF4dUlDQWdJQ0FnZlZ4dVhHNGdJQ0FnSUNCMWRHbHNjeTVtYjNKRllXTm9LSFpoYkN3Z1puVnVZM1JwYjI0Z2NHRnljMlZXWVd4MVpTaDJLU0I3WEc0Z0lDQWdJQ0FnSUdsbUlDaDFkR2xzY3k1cGMwUmhkR1VvZGlrcElIdGNiaUFnSUNBZ0lDQWdJQ0IySUQwZ2RpNTBiMGxUVDFOMGNtbHVaeWdwTzF4dUlDQWdJQ0FnSUNCOUlHVnNjMlVnYVdZZ0tIVjBhV3h6TG1selQySnFaV04wS0hZcEtTQjdYRzRnSUNBZ0lDQWdJQ0FnZGlBOUlFcFRUMDR1YzNSeWFXNW5hV1o1S0hZcE8xeHVJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJSEJoY25SekxuQjFjMmdvWlc1amIyUmxLR3RsZVNrZ0t5QW5QU2NnS3lCbGJtTnZaR1VvZGlrcE8xeHVJQ0FnSUNBZ2ZTazdYRzRnSUNBZ2ZTazdYRzVjYmlBZ0lDQnpaWEpwWVd4cGVtVmtVR0Z5WVcxeklEMGdjR0Z5ZEhNdWFtOXBiaWduSmljcE8xeHVJQ0I5WEc1Y2JpQWdhV1lnS0hObGNtbGhiR2w2WldSUVlYSmhiWE1wSUh0Y2JpQWdJQ0IxY213Z0t6MGdLSFZ5YkM1cGJtUmxlRTltS0NjL0p5a2dQVDA5SUMweElEOGdKejhuSURvZ0p5WW5LU0FySUhObGNtbGhiR2w2WldSUVlYSmhiWE03WEc0Z0lIMWNibHh1SUNCeVpYUjFjbTRnZFhKc08xeHVmVHRjYmlJc0lpZDFjMlVnYzNSeWFXTjBKenRjYmx4dUx5b3FYRzRnS2lCRGNtVmhkR1Z6SUdFZ2JtVjNJRlZTVENCaWVTQmpiMjFpYVc1cGJtY2dkR2hsSUhOd1pXTnBabWxsWkNCVlVreHpYRzRnS2x4dUlDb2dRSEJoY21GdElIdHpkSEpwYm1kOUlHSmhjMlZWVWt3Z1ZHaGxJR0poYzJVZ1ZWSk1YRzRnS2lCQWNHRnlZVzBnZTNOMGNtbHVaMzBnY21Wc1lYUnBkbVZWVWt3Z1ZHaGxJSEpsYkdGMGFYWmxJRlZTVEZ4dUlDb2dRSEpsZEhWeWJuTWdlM04wY21sdVozMGdWR2hsSUdOdmJXSnBibVZrSUZWU1RGeHVJQ292WEc1dGIyUjFiR1V1Wlhod2IzSjBjeUE5SUdaMWJtTjBhVzl1SUdOdmJXSnBibVZWVWt4ektHSmhjMlZWVWt3c0lISmxiR0YwYVhabFZWSk1LU0I3WEc0Z0lISmxkSFZ5YmlCeVpXeGhkR2wyWlZWU1RGeHVJQ0FnSUQ4Z1ltRnpaVlZTVEM1eVpYQnNZV05sS0M5Y1hDOHJKQzhzSUNjbktTQXJJQ2N2SnlBcklISmxiR0YwYVhabFZWSk1MbkpsY0d4aFkyVW9MMTVjWEM4ckx5d2dKeWNwWEc0Z0lDQWdPaUJpWVhObFZWSk1PMXh1ZlR0Y2JpSXNJaWQxYzJVZ2MzUnlhV04wSnp0Y2JseHVkbUZ5SUhWMGFXeHpJRDBnY21WeGRXbHlaU2duTGk4dUxpOTFkR2xzY3ljcE8xeHVYRzV0YjJSMWJHVXVaWGh3YjNKMGN5QTlJQ2hjYmlBZ2RYUnBiSE11YVhOVGRHRnVaR0Z5WkVKeWIzZHpaWEpGYm5Zb0tTQS9YRzVjYmlBZ0x5OGdVM1JoYm1SaGNtUWdZbkp2ZDNObGNpQmxiblp6SUhOMWNIQnZjblFnWkc5amRXMWxiblF1WTI5dmEybGxYRzRnSUNobWRXNWpkR2x2YmlCemRHRnVaR0Z5WkVKeWIzZHpaWEpGYm5Zb0tTQjdYRzRnSUNBZ2NtVjBkWEp1SUh0Y2JpQWdJQ0FnSUhkeWFYUmxPaUJtZFc1amRHbHZiaUIzY21sMFpTaHVZVzFsTENCMllXeDFaU3dnWlhod2FYSmxjeXdnY0dGMGFDd2daRzl0WVdsdUxDQnpaV04xY21VcElIdGNiaUFnSUNBZ0lDQWdkbUZ5SUdOdmIydHBaU0E5SUZ0ZE8xeHVJQ0FnSUNBZ0lDQmpiMjlyYVdVdWNIVnphQ2h1WVcxbElDc2dKejBuSUNzZ1pXNWpiMlJsVlZKSlEyOXRjRzl1Wlc1MEtIWmhiSFZsS1NrN1hHNWNiaUFnSUNBZ0lDQWdhV1lnS0hWMGFXeHpMbWx6VG5WdFltVnlLR1Y0Y0dseVpYTXBLU0I3WEc0Z0lDQWdJQ0FnSUNBZ1kyOXZhMmxsTG5CMWMyZ29KMlY0Y0dseVpYTTlKeUFySUc1bGR5QkVZWFJsS0dWNGNHbHlaWE1wTG5SdlIwMVVVM1J5YVc1bktDa3BPMXh1SUNBZ0lDQWdJQ0I5WEc1Y2JpQWdJQ0FnSUNBZ2FXWWdLSFYwYVd4ekxtbHpVM1J5YVc1bktIQmhkR2dwS1NCN1hHNGdJQ0FnSUNBZ0lDQWdZMjl2YTJsbExuQjFjMmdvSjNCaGRHZzlKeUFySUhCaGRHZ3BPMXh1SUNBZ0lDQWdJQ0I5WEc1Y2JpQWdJQ0FnSUNBZ2FXWWdLSFYwYVd4ekxtbHpVM1J5YVc1bktHUnZiV0ZwYmlrcElIdGNiaUFnSUNBZ0lDQWdJQ0JqYjI5cmFXVXVjSFZ6YUNnblpHOXRZV2x1UFNjZ0t5QmtiMjFoYVc0cE8xeHVJQ0FnSUNBZ0lDQjlYRzVjYmlBZ0lDQWdJQ0FnYVdZZ0tITmxZM1Z5WlNBOVBUMGdkSEoxWlNrZ2UxeHVJQ0FnSUNBZ0lDQWdJR052YjJ0cFpTNXdkWE5vS0NkelpXTjFjbVVuS1R0Y2JpQWdJQ0FnSUNBZ2ZWeHVYRzRnSUNBZ0lDQWdJR1J2WTNWdFpXNTBMbU52YjJ0cFpTQTlJR052YjJ0cFpTNXFiMmx1S0NjN0lDY3BPMXh1SUNBZ0lDQWdmU3hjYmx4dUlDQWdJQ0FnY21WaFpEb2dablZ1WTNScGIyNGdjbVZoWkNodVlXMWxLU0I3WEc0Z0lDQWdJQ0FnSUhaaGNpQnRZWFJqYUNBOUlHUnZZM1Z0Wlc1MExtTnZiMnRwWlM1dFlYUmphQ2h1WlhjZ1VtVm5SWGh3S0Njb1hudzdYRnhjWEhNcUtTZ25JQ3NnYm1GdFpTQXJJQ2NwUFNoYlhqdGRLaWtuS1NrN1hHNGdJQ0FnSUNBZ0lISmxkSFZ5YmlBb2JXRjBZMmdnUHlCa1pXTnZaR1ZWVWtsRGIyMXdiMjVsYm5Rb2JXRjBZMmhiTTEwcElEb2diblZzYkNrN1hHNGdJQ0FnSUNCOUxGeHVYRzRnSUNBZ0lDQnlaVzF2ZG1VNklHWjFibU4wYVc5dUlISmxiVzkyWlNodVlXMWxLU0I3WEc0Z0lDQWdJQ0FnSUhSb2FYTXVkM0pwZEdVb2JtRnRaU3dnSnljc0lFUmhkR1V1Ym05M0tDa2dMU0E0TmpRd01EQXdNQ2s3WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdmVHRjYmlBZ2ZTa29LU0E2WEc1Y2JpQWdMeThnVG05dUlITjBZVzVrWVhKa0lHSnliM2R6WlhJZ1pXNTJJQ2gzWldJZ2QyOXlhMlZ5Y3l3Z2NtVmhZM1F0Ym1GMGFYWmxLU0JzWVdOcklHNWxaV1JsWkNCemRYQndiM0owTGx4dUlDQW9ablZ1WTNScGIyNGdibTl1VTNSaGJtUmhjbVJDY205M2MyVnlSVzUyS0NrZ2UxeHVJQ0FnSUhKbGRIVnliaUI3WEc0Z0lDQWdJQ0IzY21sMFpUb2dablZ1WTNScGIyNGdkM0pwZEdVb0tTQjdmU3hjYmlBZ0lDQWdJSEpsWVdRNklHWjFibU4wYVc5dUlISmxZV1FvS1NCN0lISmxkSFZ5YmlCdWRXeHNPeUI5TEZ4dUlDQWdJQ0FnY21WdGIzWmxPaUJtZFc1amRHbHZiaUJ5WlcxdmRtVW9LU0I3ZlZ4dUlDQWdJSDA3WEc0Z0lIMHBLQ2xjYmlrN1hHNGlMQ0luZFhObElITjBjbWxqZENjN1hHNWNiaThxS2x4dUlDb2dSR1YwWlhKdGFXNWxjeUIzYUdWMGFHVnlJSFJvWlNCemNHVmphV1pwWldRZ1ZWSk1JR2x6SUdGaWMyOXNkWFJsWEc0Z0tseHVJQ29nUUhCaGNtRnRJSHR6ZEhKcGJtZDlJSFZ5YkNCVWFHVWdWVkpNSUhSdklIUmxjM1JjYmlBcUlFQnlaWFIxY201eklIdGliMjlzWldGdWZTQlVjblZsSUdsbUlIUm9aU0J6Y0dWamFXWnBaV1FnVlZKTUlHbHpJR0ZpYzI5c2RYUmxMQ0J2ZEdobGNuZHBjMlVnWm1Gc2MyVmNiaUFxTDF4dWJXOWtkV3hsTG1WNGNHOXlkSE1nUFNCbWRXNWpkR2x2YmlCcGMwRmljMjlzZFhSbFZWSk1LSFZ5YkNrZ2UxeHVJQ0F2THlCQklGVlNUQ0JwY3lCamIyNXphV1JsY21Wa0lHRmljMjlzZFhSbElHbG1JR2wwSUdKbFoybHVjeUIzYVhSb0lGd2lQSE5qYUdWdFpUNDZMeTljSWlCdmNpQmNJaTh2WENJZ0tIQnliM1J2WTI5c0xYSmxiR0YwYVhabElGVlNUQ2t1WEc0Z0lDOHZJRkpHUXlBek9UZzJJR1JsWm1sdVpYTWdjMk5vWlcxbElHNWhiV1VnWVhNZ1lTQnpaWEYxWlc1alpTQnZaaUJqYUdGeVlXTjBaWEp6SUdKbFoybHVibWx1WnlCM2FYUm9JR0VnYkdWMGRHVnlJR0Z1WkNCbWIyeHNiM2RsWkZ4dUlDQXZMeUJpZVNCaGJua2dZMjl0WW1sdVlYUnBiMjRnYjJZZ2JHVjBkR1Z5Y3l3Z1pHbG5hWFJ6TENCd2JIVnpMQ0J3WlhKcGIyUXNJRzl5SUdoNWNHaGxiaTVjYmlBZ2NtVjBkWEp1SUM5ZUtGdGhMWHBkVzJFdGVseGNaRnhjSzF4Y0xWeGNMbDBxT2lrL1hGd3ZYRnd2TDJrdWRHVnpkQ2gxY213cE8xeHVmVHRjYmlJc0lpZDFjMlVnYzNSeWFXTjBKenRjYmx4dWRtRnlJSFYwYVd4eklEMGdjbVZ4ZFdseVpTZ25MaTh1TGk5MWRHbHNjeWNwTzF4dVhHNXRiMlIxYkdVdVpYaHdiM0owY3lBOUlDaGNiaUFnZFhScGJITXVhWE5UZEdGdVpHRnlaRUp5YjNkelpYSkZibllvS1NBL1hHNWNiaUFnTHk4Z1UzUmhibVJoY21RZ1luSnZkM05sY2lCbGJuWnpJR2hoZG1VZ1puVnNiQ0J6ZFhCd2IzSjBJRzltSUhSb1pTQkJVRWx6SUc1bFpXUmxaQ0IwYnlCMFpYTjBYRzRnSUM4dklIZG9aWFJvWlhJZ2RHaGxJSEpsY1hWbGMzUWdWVkpNSUdseklHOW1JSFJvWlNCellXMWxJRzl5YVdkcGJpQmhjeUJqZFhKeVpXNTBJR3h2WTJGMGFXOXVMbHh1SUNBb1puVnVZM1JwYjI0Z2MzUmhibVJoY21SQ2NtOTNjMlZ5Ulc1MktDa2dlMXh1SUNBZ0lIWmhjaUJ0YzJsbElEMGdMeWh0YzJsbGZIUnlhV1JsYm5RcEwya3VkR1Z6ZENodVlYWnBaMkYwYjNJdWRYTmxja0ZuWlc1MEtUdGNiaUFnSUNCMllYSWdkWEpzVUdGeWMybHVaMDV2WkdVZ1BTQmtiMk4xYldWdWRDNWpjbVZoZEdWRmJHVnRaVzUwS0NkaEp5azdYRzRnSUNBZ2RtRnlJRzl5YVdkcGJsVlNURHRjYmx4dUlDQWdJQzhxS2x4dUlDQWdJQ29nVUdGeWMyVWdZU0JWVWt3Z2RHOGdaR2x6WTI5MlpYSWdhWFFuY3lCamIyMXdiMjVsYm5SelhHNGdJQ0FnS2x4dUlDQWdJQ29nUUhCaGNtRnRJSHRUZEhKcGJtZDlJSFZ5YkNCVWFHVWdWVkpNSUhSdklHSmxJSEJoY25ObFpGeHVJQ0FnSUNvZ1FISmxkSFZ5Ym5NZ2UwOWlhbVZqZEgxY2JpQWdJQ0FxTDF4dUlDQWdJR1oxYm1OMGFXOXVJSEpsYzI5c2RtVlZVa3dvZFhKc0tTQjdYRzRnSUNBZ0lDQjJZWElnYUhKbFppQTlJSFZ5YkR0Y2JseHVJQ0FnSUNBZ2FXWWdLRzF6YVdVcElIdGNiaUFnSUNBZ0lDQWdMeThnU1VVZ2JtVmxaSE1nWVhSMGNtbGlkWFJsSUhObGRDQjBkMmxqWlNCMGJ5QnViM0p0WVd4cGVtVWdjSEp2Y0dWeWRHbGxjMXh1SUNBZ0lDQWdJQ0IxY214UVlYSnphVzVuVG05a1pTNXpaWFJCZEhSeWFXSjFkR1VvSjJoeVpXWW5MQ0JvY21WbUtUdGNiaUFnSUNBZ0lDQWdhSEpsWmlBOUlIVnliRkJoY25OcGJtZE9iMlJsTG1oeVpXWTdYRzRnSUNBZ0lDQjlYRzVjYmlBZ0lDQWdJSFZ5YkZCaGNuTnBibWRPYjJSbExuTmxkRUYwZEhKcFluVjBaU2duYUhKbFppY3NJR2h5WldZcE8xeHVYRzRnSUNBZ0lDQXZMeUIxY214UVlYSnphVzVuVG05a1pTQndjbTkyYVdSbGN5QjBhR1VnVlhKc1ZYUnBiSE1nYVc1MFpYSm1ZV05sSUMwZ2FIUjBjRG92TDNWeWJDNXpjR1ZqTG5kb1lYUjNaeTV2Y21jdkkzVnliSFYwYVd4elhHNGdJQ0FnSUNCeVpYUjFjbTRnZTF4dUlDQWdJQ0FnSUNCb2NtVm1PaUIxY214UVlYSnphVzVuVG05a1pTNW9jbVZtTEZ4dUlDQWdJQ0FnSUNCd2NtOTBiMk52YkRvZ2RYSnNVR0Z5YzJsdVowNXZaR1V1Y0hKdmRHOWpiMndnUHlCMWNteFFZWEp6YVc1blRtOWtaUzV3Y205MGIyTnZiQzV5WlhCc1lXTmxLQzg2SkM4c0lDY25LU0E2SUNjbkxGeHVJQ0FnSUNBZ0lDQm9iM04wT2lCMWNteFFZWEp6YVc1blRtOWtaUzVvYjNOMExGeHVJQ0FnSUNBZ0lDQnpaV0Z5WTJnNklIVnliRkJoY25OcGJtZE9iMlJsTG5ObFlYSmphQ0EvSUhWeWJGQmhjbk5wYm1kT2IyUmxMbk5sWVhKamFDNXlaWEJzWVdObEtDOWVYRncvTHl3Z0p5Y3BJRG9nSnljc1hHNGdJQ0FnSUNBZ0lHaGhjMmc2SUhWeWJGQmhjbk5wYm1kT2IyUmxMbWhoYzJnZ1B5QjFjbXhRWVhKemFXNW5UbTlrWlM1b1lYTm9MbkpsY0d4aFkyVW9MMTRqTHl3Z0p5Y3BJRG9nSnljc1hHNGdJQ0FnSUNBZ0lHaHZjM1J1WVcxbE9pQjFjbXhRWVhKemFXNW5UbTlrWlM1b2IzTjBibUZ0WlN4Y2JpQWdJQ0FnSUNBZ2NHOXlkRG9nZFhKc1VHRnljMmx1WjA1dlpHVXVjRzl5ZEN4Y2JpQWdJQ0FnSUNBZ2NHRjBhRzVoYldVNklDaDFjbXhRWVhKemFXNW5UbTlrWlM1d1lYUm9ibUZ0WlM1amFHRnlRWFFvTUNrZ1BUMDlJQ2N2SnlrZ1AxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdkWEpzVUdGeWMybHVaMDV2WkdVdWNHRjBhRzVoYldVZ09seHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdKeThuSUNzZ2RYSnNVR0Z5YzJsdVowNXZaR1V1Y0dGMGFHNWhiV1ZjYmlBZ0lDQWdJSDA3WEc0Z0lDQWdmVnh1WEc0Z0lDQWdiM0pwWjJsdVZWSk1JRDBnY21WemIyeDJaVlZTVENoM2FXNWtiM2N1Ykc5allYUnBiMjR1YUhKbFppazdYRzVjYmlBZ0lDQXZLaXBjYmlBZ0lDQXFJRVJsZEdWeWJXbHVaU0JwWmlCaElGVlNUQ0J6YUdGeVpYTWdkR2hsSUhOaGJXVWdiM0pwWjJsdUlHRnpJSFJvWlNCamRYSnlaVzUwSUd4dlkyRjBhVzl1WEc0Z0lDQWdLbHh1SUNBZ0lDb2dRSEJoY21GdElIdFRkSEpwYm1kOUlISmxjWFZsYzNSVlVrd2dWR2hsSUZWU1RDQjBieUIwWlhOMFhHNGdJQ0FnS2lCQWNtVjBkWEp1Y3lCN1ltOXZiR1ZoYm4wZ1ZISjFaU0JwWmlCVlVrd2djMmhoY21WeklIUm9aU0J6WVcxbElHOXlhV2RwYml3Z2IzUm9aWEozYVhObElHWmhiSE5sWEc0Z0lDQWdLaTljYmlBZ0lDQnlaWFIxY200Z1puVnVZM1JwYjI0Z2FYTlZVa3hUWVcxbFQzSnBaMmx1S0hKbGNYVmxjM1JWVWt3cElIdGNiaUFnSUNBZ0lIWmhjaUJ3WVhKelpXUWdQU0FvZFhScGJITXVhWE5UZEhKcGJtY29jbVZ4ZFdWemRGVlNUQ2twSUQ4Z2NtVnpiMngyWlZWU1RDaHlaWEYxWlhOMFZWSk1LU0E2SUhKbGNYVmxjM1JWVWt3N1hHNGdJQ0FnSUNCeVpYUjFjbTRnS0hCaGNuTmxaQzV3Y205MGIyTnZiQ0E5UFQwZ2IzSnBaMmx1VlZKTUxuQnliM1J2WTI5c0lDWW1YRzRnSUNBZ0lDQWdJQ0FnSUNCd1lYSnpaV1F1YUc5emRDQTlQVDBnYjNKcFoybHVWVkpNTG1odmMzUXBPMXh1SUNBZ0lIMDdYRzRnSUgwcEtDa2dPbHh1WEc0Z0lDOHZJRTV2YmlCemRHRnVaR0Z5WkNCaWNtOTNjMlZ5SUdWdWRuTWdLSGRsWWlCM2IzSnJaWEp6TENCeVpXRmpkQzF1WVhScGRtVXBJR3hoWTJzZ2JtVmxaR1ZrSUhOMWNIQnZjblF1WEc0Z0lDaG1kVzVqZEdsdmJpQnViMjVUZEdGdVpHRnlaRUp5YjNkelpYSkZibllvS1NCN1hHNGdJQ0FnY21WMGRYSnVJR1oxYm1OMGFXOXVJR2x6VlZKTVUyRnRaVTl5YVdkcGJpZ3BJSHRjYmlBZ0lDQWdJSEpsZEhWeWJpQjBjblZsTzF4dUlDQWdJSDA3WEc0Z0lIMHBLQ2xjYmlrN1hHNGlMQ0luZFhObElITjBjbWxqZENjN1hHNWNiblpoY2lCMWRHbHNjeUE5SUhKbGNYVnBjbVVvSnk0dUwzVjBhV3h6SnlrN1hHNWNibTF2WkhWc1pTNWxlSEJ2Y25SeklEMGdablZ1WTNScGIyNGdibTl5YldGc2FYcGxTR1ZoWkdWeVRtRnRaU2hvWldGa1pYSnpMQ0J1YjNKdFlXeHBlbVZrVG1GdFpTa2dlMXh1SUNCMWRHbHNjeTVtYjNKRllXTm9LR2hsWVdSbGNuTXNJR1oxYm1OMGFXOXVJSEJ5YjJObGMzTklaV0ZrWlhJb2RtRnNkV1VzSUc1aGJXVXBJSHRjYmlBZ0lDQnBaaUFvYm1GdFpTQWhQVDBnYm05eWJXRnNhWHBsWkU1aGJXVWdKaVlnYm1GdFpTNTBiMVZ3Y0dWeVEyRnpaU2dwSUQwOVBTQnViM0p0WVd4cGVtVmtUbUZ0WlM1MGIxVndjR1Z5UTJGelpTZ3BLU0I3WEc0Z0lDQWdJQ0JvWldGa1pYSnpXMjV2Y20xaGJHbDZaV1JPWVcxbFhTQTlJSFpoYkhWbE8xeHVJQ0FnSUNBZ1pHVnNaWFJsSUdobFlXUmxjbk5iYm1GdFpWMDdYRzRnSUNBZ2ZWeHVJQ0I5S1R0Y2JuMDdYRzRpTENJbmRYTmxJSE4wY21samRDYzdYRzVjYm5aaGNpQjFkR2xzY3lBOUlISmxjWFZwY21Vb0p5NHZMaTR2ZFhScGJITW5LVHRjYmx4dUx5b3FYRzRnS2lCUVlYSnpaU0JvWldGa1pYSnpJR2x1ZEc4Z1lXNGdiMkpxWldOMFhHNGdLbHh1SUNvZ1lHQmdYRzRnS2lCRVlYUmxPaUJYWldRc0lESTNJRUYxWnlBeU1ERTBJREE0T2pVNE9qUTVJRWROVkZ4dUlDb2dRMjl1ZEdWdWRDMVVlWEJsT2lCaGNIQnNhV05oZEdsdmJpOXFjMjl1WEc0Z0tpQkRiMjV1WldOMGFXOXVPaUJyWldWd0xXRnNhWFpsWEc0Z0tpQlVjbUZ1YzJabGNpMUZibU52WkdsdVp6b2dZMmgxYm10bFpGeHVJQ29nWUdCZ1hHNGdLbHh1SUNvZ1FIQmhjbUZ0SUh0VGRISnBibWQ5SUdobFlXUmxjbk1nU0dWaFpHVnljeUJ1WldWa2FXNW5JSFJ2SUdKbElIQmhjbk5sWkZ4dUlDb2dRSEpsZEhWeWJuTWdlMDlpYW1WamRIMGdTR1ZoWkdWeWN5QndZWEp6WldRZ2FXNTBieUJoYmlCdlltcGxZM1JjYmlBcUwxeHViVzlrZFd4bExtVjRjRzl5ZEhNZ1BTQm1kVzVqZEdsdmJpQndZWEp6WlVobFlXUmxjbk1vYUdWaFpHVnljeWtnZTF4dUlDQjJZWElnY0dGeWMyVmtJRDBnZTMwN1hHNGdJSFpoY2lCclpYazdYRzRnSUhaaGNpQjJZV3c3WEc0Z0lIWmhjaUJwTzF4dVhHNGdJR2xtSUNnaGFHVmhaR1Z5Y3lrZ2V5QnlaWFIxY200Z2NHRnljMlZrT3lCOVhHNWNiaUFnZFhScGJITXVabTl5UldGamFDaG9aV0ZrWlhKekxuTndiR2wwS0NkY1hHNG5LU3dnWm5WdVkzUnBiMjRnY0dGeWMyVnlLR3hwYm1VcElIdGNiaUFnSUNCcElEMGdiR2x1WlM1cGJtUmxlRTltS0NjNkp5azdYRzRnSUNBZ2EyVjVJRDBnZFhScGJITXVkSEpwYlNoc2FXNWxMbk4xWW5OMGNpZ3dMQ0JwS1NrdWRHOU1iM2RsY2tOaGMyVW9LVHRjYmlBZ0lDQjJZV3dnUFNCMWRHbHNjeTUwY21sdEtHeHBibVV1YzNWaWMzUnlLR2tnS3lBeEtTazdYRzVjYmlBZ0lDQnBaaUFvYTJWNUtTQjdYRzRnSUNBZ0lDQndZWEp6WldSYmEyVjVYU0E5SUhCaGNuTmxaRnRyWlhsZElEOGdjR0Z5YzJWa1cydGxlVjBnS3lBbkxDQW5JQ3NnZG1Gc0lEb2dkbUZzTzF4dUlDQWdJSDFjYmlBZ2ZTazdYRzVjYmlBZ2NtVjBkWEp1SUhCaGNuTmxaRHRjYm4wN1hHNGlMQ0luZFhObElITjBjbWxqZENjN1hHNWNiaThxS2x4dUlDb2dVM2x1ZEdGamRHbGpJSE4xWjJGeUlHWnZjaUJwYm5admEybHVaeUJoSUdaMWJtTjBhVzl1SUdGdVpDQmxlSEJoYm1ScGJtY2dZVzRnWVhKeVlYa2dabTl5SUdGeVozVnRaVzUwY3k1Y2JpQXFYRzRnS2lCRGIyMXRiMjRnZFhObElHTmhjMlVnZDI5MWJHUWdZbVVnZEc4Z2RYTmxJR0JHZFc1amRHbHZiaTV3Y205MGIzUjVjR1V1WVhCd2JIbGdMbHh1SUNwY2JpQXFJQ0JnWUdCcWMxeHVJQ29nSUdaMWJtTjBhVzl1SUdZb2VDd2dlU3dnZWlrZ2UzMWNiaUFxSUNCMllYSWdZWEpuY3lBOUlGc3hMQ0F5TENBelhUdGNiaUFxSUNCbUxtRndjR3g1S0c1MWJHd3NJR0Z5WjNNcE8xeHVJQ29nSUdCZ1lGeHVJQ3BjYmlBcUlGZHBkR2dnWUhOd2NtVmhaR0FnZEdocGN5QmxlR0Z0Y0d4bElHTmhiaUJpWlNCeVpTMTNjbWwwZEdWdUxseHVJQ3BjYmlBcUlDQmdZR0JxYzF4dUlDb2dJSE53Y21WaFpDaG1kVzVqZEdsdmJpaDRMQ0I1TENCNktTQjdmU2tvV3pFc0lESXNJRE5kS1R0Y2JpQXFJQ0JnWUdCY2JpQXFYRzRnS2lCQWNHRnlZVzBnZTBaMWJtTjBhVzl1ZlNCallXeHNZbUZqYTF4dUlDb2dRSEpsZEhWeWJuTWdlMFoxYm1OMGFXOXVmVnh1SUNvdlhHNXRiMlIxYkdVdVpYaHdiM0owY3lBOUlHWjFibU4wYVc5dUlITndjbVZoWkNoallXeHNZbUZqYXlrZ2UxeHVJQ0J5WlhSMWNtNGdablZ1WTNScGIyNGdkM0poY0NoaGNuSXBJSHRjYmlBZ0lDQnlaWFIxY200Z1kyRnNiR0poWTJzdVlYQndiSGtvYm5Wc2JDd2dZWEp5S1R0Y2JpQWdmVHRjYm4wN1hHNGlMQ0luZFhObElITjBjbWxqZENjN1hHNWNiblpoY2lCaWFXNWtJRDBnY21WeGRXbHlaU2duTGk5b1pXeHdaWEp6TDJKcGJtUW5LVHRjYm5aaGNpQnBjMEoxWm1abGNpQTlJSEpsY1hWcGNtVW9KMmx6TFdKMVptWmxjaWNwTzF4dVhHNHZLbWRzYjJKaGJDQjBiMU4wY21sdVp6cDBjblZsS2k5Y2JseHVMeThnZFhScGJITWdhWE1nWVNCc2FXSnlZWEo1SUc5bUlHZGxibVZ5YVdNZ2FHVnNjR1Z5SUdaMWJtTjBhVzl1Y3lCdWIyNHRjM0JsWTJsbWFXTWdkRzhnWVhocGIzTmNibHh1ZG1GeUlIUnZVM1J5YVc1bklEMGdUMkpxWldOMExuQnliM1J2ZEhsd1pTNTBiMU4wY21sdVp6dGNibHh1THlvcVhHNGdLaUJFWlhSbGNtMXBibVVnYVdZZ1lTQjJZV3gxWlNCcGN5QmhiaUJCY25KaGVWeHVJQ3BjYmlBcUlFQndZWEpoYlNCN1QySnFaV04wZlNCMllXd2dWR2hsSUhaaGJIVmxJSFJ2SUhSbGMzUmNiaUFxSUVCeVpYUjFjbTV6SUh0aWIyOXNaV0Z1ZlNCVWNuVmxJR2xtSUhaaGJIVmxJR2x6SUdGdUlFRnljbUY1TENCdmRHaGxjbmRwYzJVZ1ptRnNjMlZjYmlBcUwxeHVablZ1WTNScGIyNGdhWE5CY25KaGVTaDJZV3dwSUh0Y2JpQWdjbVYwZFhKdUlIUnZVM1J5YVc1bkxtTmhiR3dvZG1Gc0tTQTlQVDBnSjF0dlltcGxZM1FnUVhKeVlYbGRKenRjYm4xY2JseHVMeW9xWEc0Z0tpQkVaWFJsY20xcGJtVWdhV1lnWVNCMllXeDFaU0JwY3lCaGJpQkJjbkpoZVVKMVptWmxjbHh1SUNwY2JpQXFJRUJ3WVhKaGJTQjdUMkpxWldOMGZTQjJZV3dnVkdobElIWmhiSFZsSUhSdklIUmxjM1JjYmlBcUlFQnlaWFIxY201eklIdGliMjlzWldGdWZTQlVjblZsSUdsbUlIWmhiSFZsSUdseklHRnVJRUZ5Y21GNVFuVm1abVZ5TENCdmRHaGxjbmRwYzJVZ1ptRnNjMlZjYmlBcUwxeHVablZ1WTNScGIyNGdhWE5CY25KaGVVSjFabVpsY2loMllXd3BJSHRjYmlBZ2NtVjBkWEp1SUhSdlUzUnlhVzVuTG1OaGJHd29kbUZzS1NBOVBUMGdKMXR2WW1wbFkzUWdRWEp5WVhsQ2RXWm1aWEpkSnp0Y2JuMWNibHh1THlvcVhHNGdLaUJFWlhSbGNtMXBibVVnYVdZZ1lTQjJZV3gxWlNCcGN5QmhJRVp2Y20xRVlYUmhYRzRnS2x4dUlDb2dRSEJoY21GdElIdFBZbXBsWTNSOUlIWmhiQ0JVYUdVZ2RtRnNkV1VnZEc4Z2RHVnpkRnh1SUNvZ1FISmxkSFZ5Ym5NZ2UySnZiMnhsWVc1OUlGUnlkV1VnYVdZZ2RtRnNkV1VnYVhNZ1lXNGdSbTl5YlVSaGRHRXNJRzkwYUdWeWQybHpaU0JtWVd4elpWeHVJQ292WEc1bWRXNWpkR2x2YmlCcGMwWnZjbTFFWVhSaEtIWmhiQ2tnZTF4dUlDQnlaWFIxY200Z0tIUjVjR1Z2WmlCR2IzSnRSR0YwWVNBaFBUMGdKM1Z1WkdWbWFXNWxaQ2NwSUNZbUlDaDJZV3dnYVc1emRHRnVZMlZ2WmlCR2IzSnRSR0YwWVNrN1hHNTlYRzVjYmk4cUtseHVJQ29nUkdWMFpYSnRhVzVsSUdsbUlHRWdkbUZzZFdVZ2FYTWdZU0IyYVdWM0lHOXVJR0Z1SUVGeWNtRjVRblZtWm1WeVhHNGdLbHh1SUNvZ1FIQmhjbUZ0SUh0UFltcGxZM1I5SUhaaGJDQlVhR1VnZG1Gc2RXVWdkRzhnZEdWemRGeHVJQ29nUUhKbGRIVnlibk1nZTJKdmIyeGxZVzU5SUZSeWRXVWdhV1lnZG1Gc2RXVWdhWE1nWVNCMmFXVjNJRzl1SUdGdUlFRnljbUY1UW5WbVptVnlMQ0J2ZEdobGNuZHBjMlVnWm1Gc2MyVmNiaUFxTDF4dVpuVnVZM1JwYjI0Z2FYTkJjbkpoZVVKMVptWmxjbFpwWlhjb2RtRnNLU0I3WEc0Z0lIWmhjaUJ5WlhOMWJIUTdYRzRnSUdsbUlDZ29kSGx3Wlc5bUlFRnljbUY1UW5WbVptVnlJQ0U5UFNBbmRXNWtaV1pwYm1Wa0p5a2dKaVlnS0VGeWNtRjVRblZtWm1WeUxtbHpWbWxsZHlrcElIdGNiaUFnSUNCeVpYTjFiSFFnUFNCQmNuSmhlVUoxWm1abGNpNXBjMVpwWlhjb2RtRnNLVHRjYmlBZ2ZTQmxiSE5sSUh0Y2JpQWdJQ0J5WlhOMWJIUWdQU0FvZG1Gc0tTQW1KaUFvZG1Gc0xtSjFabVpsY2lrZ0ppWWdLSFpoYkM1aWRXWm1aWElnYVc1emRHRnVZMlZ2WmlCQmNuSmhlVUoxWm1abGNpazdYRzRnSUgxY2JpQWdjbVYwZFhKdUlISmxjM1ZzZER0Y2JuMWNibHh1THlvcVhHNGdLaUJFWlhSbGNtMXBibVVnYVdZZ1lTQjJZV3gxWlNCcGN5QmhJRk4wY21sdVoxeHVJQ3BjYmlBcUlFQndZWEpoYlNCN1QySnFaV04wZlNCMllXd2dWR2hsSUhaaGJIVmxJSFJ2SUhSbGMzUmNiaUFxSUVCeVpYUjFjbTV6SUh0aWIyOXNaV0Z1ZlNCVWNuVmxJR2xtSUhaaGJIVmxJR2x6SUdFZ1UzUnlhVzVuTENCdmRHaGxjbmRwYzJVZ1ptRnNjMlZjYmlBcUwxeHVablZ1WTNScGIyNGdhWE5UZEhKcGJtY29kbUZzS1NCN1hHNGdJSEpsZEhWeWJpQjBlWEJsYjJZZ2RtRnNJRDA5UFNBbmMzUnlhVzVuSnp0Y2JuMWNibHh1THlvcVhHNGdLaUJFWlhSbGNtMXBibVVnYVdZZ1lTQjJZV3gxWlNCcGN5QmhJRTUxYldKbGNseHVJQ3BjYmlBcUlFQndZWEpoYlNCN1QySnFaV04wZlNCMllXd2dWR2hsSUhaaGJIVmxJSFJ2SUhSbGMzUmNiaUFxSUVCeVpYUjFjbTV6SUh0aWIyOXNaV0Z1ZlNCVWNuVmxJR2xtSUhaaGJIVmxJR2x6SUdFZ1RuVnRZbVZ5TENCdmRHaGxjbmRwYzJVZ1ptRnNjMlZjYmlBcUwxeHVablZ1WTNScGIyNGdhWE5PZFcxaVpYSW9kbUZzS1NCN1hHNGdJSEpsZEhWeWJpQjBlWEJsYjJZZ2RtRnNJRDA5UFNBbmJuVnRZbVZ5Snp0Y2JuMWNibHh1THlvcVhHNGdLaUJFWlhSbGNtMXBibVVnYVdZZ1lTQjJZV3gxWlNCcGN5QjFibVJsWm1sdVpXUmNiaUFxWEc0Z0tpQkFjR0Z5WVcwZ2UwOWlhbVZqZEgwZ2RtRnNJRlJvWlNCMllXeDFaU0IwYnlCMFpYTjBYRzRnS2lCQWNtVjBkWEp1Y3lCN1ltOXZiR1ZoYm4wZ1ZISjFaU0JwWmlCMGFHVWdkbUZzZFdVZ2FYTWdkVzVrWldacGJtVmtMQ0J2ZEdobGNuZHBjMlVnWm1Gc2MyVmNiaUFxTDF4dVpuVnVZM1JwYjI0Z2FYTlZibVJsWm1sdVpXUW9kbUZzS1NCN1hHNGdJSEpsZEhWeWJpQjBlWEJsYjJZZ2RtRnNJRDA5UFNBbmRXNWtaV1pwYm1Wa0p6dGNibjFjYmx4dUx5b3FYRzRnS2lCRVpYUmxjbTFwYm1VZ2FXWWdZU0IyWVd4MVpTQnBjeUJoYmlCUFltcGxZM1JjYmlBcVhHNGdLaUJBY0dGeVlXMGdlMDlpYW1WamRIMGdkbUZzSUZSb1pTQjJZV3gxWlNCMGJ5QjBaWE4wWEc0Z0tpQkFjbVYwZFhKdWN5QjdZbTl2YkdWaGJuMGdWSEoxWlNCcFppQjJZV3gxWlNCcGN5QmhiaUJQWW1wbFkzUXNJRzkwYUdWeWQybHpaU0JtWVd4elpWeHVJQ292WEc1bWRXNWpkR2x2YmlCcGMwOWlhbVZqZENoMllXd3BJSHRjYmlBZ2NtVjBkWEp1SUhaaGJDQWhQVDBnYm5Wc2JDQW1KaUIwZVhCbGIyWWdkbUZzSUQwOVBTQW5iMkpxWldOMEp6dGNibjFjYmx4dUx5b3FYRzRnS2lCRVpYUmxjbTFwYm1VZ2FXWWdZU0IyWVd4MVpTQnBjeUJoSUVSaGRHVmNiaUFxWEc0Z0tpQkFjR0Z5WVcwZ2UwOWlhbVZqZEgwZ2RtRnNJRlJvWlNCMllXeDFaU0IwYnlCMFpYTjBYRzRnS2lCQWNtVjBkWEp1Y3lCN1ltOXZiR1ZoYm4wZ1ZISjFaU0JwWmlCMllXeDFaU0JwY3lCaElFUmhkR1VzSUc5MGFHVnlkMmx6WlNCbVlXeHpaVnh1SUNvdlhHNW1kVzVqZEdsdmJpQnBjMFJoZEdVb2RtRnNLU0I3WEc0Z0lISmxkSFZ5YmlCMGIxTjBjbWx1Wnk1allXeHNLSFpoYkNrZ1BUMDlJQ2RiYjJKcVpXTjBJRVJoZEdWZEp6dGNibjFjYmx4dUx5b3FYRzRnS2lCRVpYUmxjbTFwYm1VZ2FXWWdZU0IyWVd4MVpTQnBjeUJoSUVacGJHVmNiaUFxWEc0Z0tpQkFjR0Z5WVcwZ2UwOWlhbVZqZEgwZ2RtRnNJRlJvWlNCMllXeDFaU0IwYnlCMFpYTjBYRzRnS2lCQWNtVjBkWEp1Y3lCN1ltOXZiR1ZoYm4wZ1ZISjFaU0JwWmlCMllXeDFaU0JwY3lCaElFWnBiR1VzSUc5MGFHVnlkMmx6WlNCbVlXeHpaVnh1SUNvdlhHNW1kVzVqZEdsdmJpQnBjMFpwYkdVb2RtRnNLU0I3WEc0Z0lISmxkSFZ5YmlCMGIxTjBjbWx1Wnk1allXeHNLSFpoYkNrZ1BUMDlJQ2RiYjJKcVpXTjBJRVpwYkdWZEp6dGNibjFjYmx4dUx5b3FYRzRnS2lCRVpYUmxjbTFwYm1VZ2FXWWdZU0IyWVd4MVpTQnBjeUJoSUVKc2IySmNiaUFxWEc0Z0tpQkFjR0Z5WVcwZ2UwOWlhbVZqZEgwZ2RtRnNJRlJvWlNCMllXeDFaU0IwYnlCMFpYTjBYRzRnS2lCQWNtVjBkWEp1Y3lCN1ltOXZiR1ZoYm4wZ1ZISjFaU0JwWmlCMllXeDFaU0JwY3lCaElFSnNiMklzSUc5MGFHVnlkMmx6WlNCbVlXeHpaVnh1SUNvdlhHNW1kVzVqZEdsdmJpQnBjMEpzYjJJb2RtRnNLU0I3WEc0Z0lISmxkSFZ5YmlCMGIxTjBjbWx1Wnk1allXeHNLSFpoYkNrZ1BUMDlJQ2RiYjJKcVpXTjBJRUpzYjJKZEp6dGNibjFjYmx4dUx5b3FYRzRnS2lCRVpYUmxjbTFwYm1VZ2FXWWdZU0IyWVd4MVpTQnBjeUJoSUVaMWJtTjBhVzl1WEc0Z0tseHVJQ29nUUhCaGNtRnRJSHRQWW1wbFkzUjlJSFpoYkNCVWFHVWdkbUZzZFdVZ2RHOGdkR1Z6ZEZ4dUlDb2dRSEpsZEhWeWJuTWdlMkp2YjJ4bFlXNTlJRlJ5ZFdVZ2FXWWdkbUZzZFdVZ2FYTWdZU0JHZFc1amRHbHZiaXdnYjNSb1pYSjNhWE5sSUdaaGJITmxYRzRnS2k5Y2JtWjFibU4wYVc5dUlHbHpSblZ1WTNScGIyNG9kbUZzS1NCN1hHNGdJSEpsZEhWeWJpQjBiMU4wY21sdVp5NWpZV3hzS0haaGJDa2dQVDA5SUNkYmIySnFaV04wSUVaMWJtTjBhVzl1WFNjN1hHNTlYRzVjYmk4cUtseHVJQ29nUkdWMFpYSnRhVzVsSUdsbUlHRWdkbUZzZFdVZ2FYTWdZU0JUZEhKbFlXMWNiaUFxWEc0Z0tpQkFjR0Z5WVcwZ2UwOWlhbVZqZEgwZ2RtRnNJRlJvWlNCMllXeDFaU0IwYnlCMFpYTjBYRzRnS2lCQWNtVjBkWEp1Y3lCN1ltOXZiR1ZoYm4wZ1ZISjFaU0JwWmlCMllXeDFaU0JwY3lCaElGTjBjbVZoYlN3Z2IzUm9aWEozYVhObElHWmhiSE5sWEc0Z0tpOWNibVoxYm1OMGFXOXVJR2x6VTNSeVpXRnRLSFpoYkNrZ2UxeHVJQ0J5WlhSMWNtNGdhWE5QWW1wbFkzUW9kbUZzS1NBbUppQnBjMFoxYm1OMGFXOXVLSFpoYkM1d2FYQmxLVHRjYm4xY2JseHVMeW9xWEc0Z0tpQkVaWFJsY20xcGJtVWdhV1lnWVNCMllXeDFaU0JwY3lCaElGVlNURk5sWVhKamFGQmhjbUZ0Y3lCdlltcGxZM1JjYmlBcVhHNGdLaUJBY0dGeVlXMGdlMDlpYW1WamRIMGdkbUZzSUZSb1pTQjJZV3gxWlNCMGJ5QjBaWE4wWEc0Z0tpQkFjbVYwZFhKdWN5QjdZbTl2YkdWaGJuMGdWSEoxWlNCcFppQjJZV3gxWlNCcGN5QmhJRlZTVEZObFlYSmphRkJoY21GdGN5QnZZbXBsWTNRc0lHOTBhR1Z5ZDJselpTQm1ZV3h6WlZ4dUlDb3ZYRzVtZFc1amRHbHZiaUJwYzFWU1RGTmxZWEpqYUZCaGNtRnRjeWgyWVd3cElIdGNiaUFnY21WMGRYSnVJSFI1Y0dWdlppQlZVa3hUWldGeVkyaFFZWEpoYlhNZ0lUMDlJQ2QxYm1SbFptbHVaV1FuSUNZbUlIWmhiQ0JwYm5OMFlXNWpaVzltSUZWU1RGTmxZWEpqYUZCaGNtRnRjenRjYm4xY2JseHVMeW9xWEc0Z0tpQlVjbWx0SUdWNFkyVnpjeUIzYUdsMFpYTndZV05sSUc5bVppQjBhR1VnWW1WbmFXNXVhVzVuSUdGdVpDQmxibVFnYjJZZ1lTQnpkSEpwYm1kY2JpQXFYRzRnS2lCQWNHRnlZVzBnZTFOMGNtbHVaMzBnYzNSeUlGUm9aU0JUZEhKcGJtY2dkRzhnZEhKcGJWeHVJQ29nUUhKbGRIVnlibk1nZTFOMGNtbHVaMzBnVkdobElGTjBjbWx1WnlCbWNtVmxaQ0J2WmlCbGVHTmxjM01nZDJocGRHVnpjR0ZqWlZ4dUlDb3ZYRzVtZFc1amRHbHZiaUIwY21sdEtITjBjaWtnZTF4dUlDQnlaWFIxY200Z2MzUnlMbkpsY0d4aFkyVW9MMTVjWEhNcUx5d2dKeWNwTG5KbGNHeGhZMlVvTDF4Y2N5b2tMeXdnSnljcE8xeHVmVnh1WEc0dktpcGNiaUFxSUVSbGRHVnliV2x1WlNCcFppQjNaU2R5WlNCeWRXNXVhVzVuSUdsdUlHRWdjM1JoYm1SaGNtUWdZbkp2ZDNObGNpQmxiblpwY205dWJXVnVkRnh1SUNwY2JpQXFJRlJvYVhNZ1lXeHNiM2R6SUdGNGFXOXpJSFJ2SUhKMWJpQnBiaUJoSUhkbFlpQjNiM0pyWlhJc0lHRnVaQ0J5WldGamRDMXVZWFJwZG1VdVhHNGdLaUJDYjNSb0lHVnVkbWx5YjI1dFpXNTBjeUJ6ZFhCd2IzSjBJRmhOVEVoMGRIQlNaWEYxWlhOMExDQmlkWFFnYm05MElHWjFiR3g1SUhOMFlXNWtZWEprSUdkc2IySmhiSE11WEc0Z0tseHVJQ29nZDJWaUlIZHZjbXRsY25NNlhHNGdLaUFnZEhsd1pXOW1JSGRwYm1SdmR5QXRQaUIxYm1SbFptbHVaV1JjYmlBcUlDQjBlWEJsYjJZZ1pHOWpkVzFsYm5RZ0xUNGdkVzVrWldacGJtVmtYRzRnS2x4dUlDb2djbVZoWTNRdGJtRjBhWFpsT2x4dUlDb2dJRzVoZG1sbllYUnZjaTV3Y205a2RXTjBJQzArSUNkU1pXRmpkRTVoZEdsMlpTZGNiaUFxTDF4dVpuVnVZM1JwYjI0Z2FYTlRkR0Z1WkdGeVpFSnliM2R6WlhKRmJuWW9LU0I3WEc0Z0lHbG1JQ2gwZVhCbGIyWWdibUYyYVdkaGRHOXlJQ0U5UFNBbmRXNWtaV1pwYm1Wa0p5QW1KaUJ1WVhacFoyRjBiM0l1Y0hKdlpIVmpkQ0E5UFQwZ0oxSmxZV04wVG1GMGFYWmxKeWtnZTF4dUlDQWdJSEpsZEhWeWJpQm1ZV3h6WlR0Y2JpQWdmVnh1SUNCeVpYUjFjbTRnS0Z4dUlDQWdJSFI1Y0dWdlppQjNhVzVrYjNjZ0lUMDlJQ2QxYm1SbFptbHVaV1FuSUNZbVhHNGdJQ0FnZEhsd1pXOW1JR1J2WTNWdFpXNTBJQ0U5UFNBbmRXNWtaV1pwYm1Wa0oxeHVJQ0FwTzF4dWZWeHVYRzR2S2lwY2JpQXFJRWwwWlhKaGRHVWdiM1psY2lCaGJpQkJjbkpoZVNCdmNpQmhiaUJQWW1wbFkzUWdhVzUyYjJ0cGJtY2dZU0JtZFc1amRHbHZiaUJtYjNJZ1pXRmphQ0JwZEdWdExseHVJQ3BjYmlBcUlFbG1JR0J2WW1wZ0lHbHpJR0Z1SUVGeWNtRjVJR05oYkd4aVlXTnJJSGRwYkd3Z1ltVWdZMkZzYkdWa0lIQmhjM05wYm1kY2JpQXFJSFJvWlNCMllXeDFaU3dnYVc1a1pYZ3NJR0Z1WkNCamIyMXdiR1YwWlNCaGNuSmhlU0JtYjNJZ1pXRmphQ0JwZEdWdExseHVJQ3BjYmlBcUlFbG1JQ2R2WW1vbklHbHpJR0Z1SUU5aWFtVmpkQ0JqWVd4c1ltRmpheUIzYVd4c0lHSmxJR05oYkd4bFpDQndZWE56YVc1blhHNGdLaUIwYUdVZ2RtRnNkV1VzSUd0bGVTd2dZVzVrSUdOdmJYQnNaWFJsSUc5aWFtVmpkQ0JtYjNJZ1pXRmphQ0J3Y205d1pYSjBlUzVjYmlBcVhHNGdLaUJBY0dGeVlXMGdlMDlpYW1WamRIeEJjbkpoZVgwZ2IySnFJRlJvWlNCdlltcGxZM1FnZEc4Z2FYUmxjbUYwWlZ4dUlDb2dRSEJoY21GdElIdEdkVzVqZEdsdmJuMGdabTRnVkdobElHTmhiR3hpWVdOcklIUnZJR2x1ZG05clpTQm1iM0lnWldGamFDQnBkR1Z0WEc0Z0tpOWNibVoxYm1OMGFXOXVJR1p2Y2tWaFkyZ29iMkpxTENCbWJpa2dlMXh1SUNBdkx5QkViMjRuZENCaWIzUm9aWElnYVdZZ2JtOGdkbUZzZFdVZ2NISnZkbWxrWldSY2JpQWdhV1lnS0c5aWFpQTlQVDBnYm5Wc2JDQjhmQ0IwZVhCbGIyWWdiMkpxSUQwOVBTQW5kVzVrWldacGJtVmtKeWtnZTF4dUlDQWdJSEpsZEhWeWJqdGNiaUFnZlZ4dVhHNGdJQzh2SUVadmNtTmxJR0Z1SUdGeWNtRjVJR2xtSUc1dmRDQmhiSEpsWVdSNUlITnZiV1YwYUdsdVp5QnBkR1Z5WVdKc1pWeHVJQ0JwWmlBb2RIbHdaVzltSUc5aWFpQWhQVDBnSjI5aWFtVmpkQ2NnSmlZZ0lXbHpRWEp5WVhrb2IySnFLU2tnZTF4dUlDQWdJQzhxWlhOc2FXNTBJRzV2TFhCaGNtRnRMWEpsWVhOemFXZHVPakFxTDF4dUlDQWdJRzlpYWlBOUlGdHZZbXBkTzF4dUlDQjlYRzVjYmlBZ2FXWWdLR2x6UVhKeVlYa29iMkpxS1NrZ2UxeHVJQ0FnSUM4dklFbDBaWEpoZEdVZ2IzWmxjaUJoY25KaGVTQjJZV3gxWlhOY2JpQWdJQ0JtYjNJZ0tIWmhjaUJwSUQwZ01Dd2diQ0E5SUc5aWFpNXNaVzVuZEdnN0lHa2dQQ0JzT3lCcEt5c3BJSHRjYmlBZ0lDQWdJR1p1TG1OaGJHd29iblZzYkN3Z2IySnFXMmxkTENCcExDQnZZbW9wTzF4dUlDQWdJSDFjYmlBZ2ZTQmxiSE5sSUh0Y2JpQWdJQ0F2THlCSmRHVnlZWFJsSUc5MlpYSWdiMkpxWldOMElHdGxlWE5jYmlBZ0lDQm1iM0lnS0haaGNpQnJaWGtnYVc0Z2IySnFLU0I3WEc0Z0lDQWdJQ0JwWmlBb1QySnFaV04wTG5CeWIzUnZkSGx3WlM1b1lYTlBkMjVRY205d1pYSjBlUzVqWVd4c0tHOWlhaXdnYTJWNUtTa2dlMXh1SUNBZ0lDQWdJQ0JtYmk1allXeHNLRzUxYkd3c0lHOWlhbHRyWlhsZExDQnJaWGtzSUc5aWFpazdYRzRnSUNBZ0lDQjlYRzRnSUNBZ2ZWeHVJQ0I5WEc1OVhHNWNiaThxS2x4dUlDb2dRV05qWlhCMGN5QjJZWEpoY21keklHVjRjR1ZqZEdsdVp5QmxZV05vSUdGeVozVnRaVzUwSUhSdklHSmxJR0Z1SUc5aWFtVmpkQ3dnZEdobGJseHVJQ29nYVcxdGRYUmhZbXg1SUcxbGNtZGxjeUIwYUdVZ2NISnZjR1Z5ZEdsbGN5QnZaaUJsWVdOb0lHOWlhbVZqZENCaGJtUWdjbVYwZFhKdWN5QnlaWE4xYkhRdVhHNGdLbHh1SUNvZ1YyaGxiaUJ0ZFd4MGFYQnNaU0J2WW1wbFkzUnpJR052Ym5SaGFXNGdkR2hsSUhOaGJXVWdhMlY1SUhSb1pTQnNZWFJsY2lCdlltcGxZM1FnYVc1Y2JpQXFJSFJvWlNCaGNtZDFiV1Z1ZEhNZ2JHbHpkQ0IzYVd4c0lIUmhhMlVnY0hKbFkyVmtaVzVqWlM1Y2JpQXFYRzRnS2lCRmVHRnRjR3hsT2x4dUlDcGNiaUFxSUdCZ1lHcHpYRzRnS2lCMllYSWdjbVZ6ZFd4MElEMGdiV1Z5WjJVb2UyWnZiem9nTVRJemZTd2dlMlp2YnpvZ05EVTJmU2s3WEc0Z0tpQmpiMjV6YjJ4bExteHZaeWh5WlhOMWJIUXVabTl2S1RzZ0x5OGdiM1YwY0hWMGN5QTBOVFpjYmlBcUlHQmdZRnh1SUNwY2JpQXFJRUJ3WVhKaGJTQjdUMkpxWldOMGZTQnZZbW94SUU5aWFtVmpkQ0IwYnlCdFpYSm5aVnh1SUNvZ1FISmxkSFZ5Ym5NZ2UwOWlhbVZqZEgwZ1VtVnpkV3gwSUc5bUlHRnNiQ0J0WlhKblpTQndjbTl3WlhKMGFXVnpYRzRnS2k5Y2JtWjFibU4wYVc5dUlHMWxjbWRsS0M4cUlHOWlhakVzSUc5aWFqSXNJRzlpYWpNc0lDNHVMaUFxTHlrZ2UxeHVJQ0IyWVhJZ2NtVnpkV3gwSUQwZ2UzMDdYRzRnSUdaMWJtTjBhVzl1SUdGemMybG5ibFpoYkhWbEtIWmhiQ3dnYTJWNUtTQjdYRzRnSUNBZ2FXWWdLSFI1Y0dWdlppQnlaWE4xYkhSYmEyVjVYU0E5UFQwZ0oyOWlhbVZqZENjZ0ppWWdkSGx3Wlc5bUlIWmhiQ0E5UFQwZ0oyOWlhbVZqZENjcElIdGNiaUFnSUNBZ0lISmxjM1ZzZEZ0clpYbGRJRDBnYldWeVoyVW9jbVZ6ZFd4MFcydGxlVjBzSUhaaGJDazdYRzRnSUNBZ2ZTQmxiSE5sSUh0Y2JpQWdJQ0FnSUhKbGMzVnNkRnRyWlhsZElEMGdkbUZzTzF4dUlDQWdJSDFjYmlBZ2ZWeHVYRzRnSUdadmNpQW9kbUZ5SUdrZ1BTQXdMQ0JzSUQwZ1lYSm5kVzFsYm5SekxteGxibWQwYURzZ2FTQThJR3c3SUdrckt5a2dlMXh1SUNBZ0lHWnZja1ZoWTJnb1lYSm5kVzFsYm5SelcybGRMQ0JoYzNOcFoyNVdZV3gxWlNrN1hHNGdJSDFjYmlBZ2NtVjBkWEp1SUhKbGMzVnNkRHRjYm4xY2JseHVMeW9xWEc0Z0tpQkZlSFJsYm1SeklHOWlhbVZqZENCaElHSjVJRzExZEdGaWJIa2dZV1JrYVc1bklIUnZJR2wwSUhSb1pTQndjbTl3WlhKMGFXVnpJRzltSUc5aWFtVmpkQ0JpTGx4dUlDcGNiaUFxSUVCd1lYSmhiU0I3VDJKcVpXTjBmU0JoSUZSb1pTQnZZbXBsWTNRZ2RHOGdZbVVnWlhoMFpXNWtaV1JjYmlBcUlFQndZWEpoYlNCN1QySnFaV04wZlNCaUlGUm9aU0J2WW1wbFkzUWdkRzhnWTI5d2VTQndjbTl3WlhKMGFXVnpJR1p5YjIxY2JpQXFJRUJ3WVhKaGJTQjdUMkpxWldOMGZTQjBhR2x6UVhKbklGUm9aU0J2WW1wbFkzUWdkRzhnWW1sdVpDQm1kVzVqZEdsdmJpQjBiMXh1SUNvZ1FISmxkSFZ5YmlCN1QySnFaV04wZlNCVWFHVWdjbVZ6ZFd4MGFXNW5JSFpoYkhWbElHOW1JRzlpYW1WamRDQmhYRzRnS2k5Y2JtWjFibU4wYVc5dUlHVjRkR1Z1WkNoaExDQmlMQ0IwYUdselFYSm5LU0I3WEc0Z0lHWnZja1ZoWTJnb1lpd2dablZ1WTNScGIyNGdZWE56YVdkdVZtRnNkV1VvZG1Gc0xDQnJaWGtwSUh0Y2JpQWdJQ0JwWmlBb2RHaHBjMEZ5WnlBbUppQjBlWEJsYjJZZ2RtRnNJRDA5UFNBblpuVnVZM1JwYjI0bktTQjdYRzRnSUNBZ0lDQmhXMnRsZVYwZ1BTQmlhVzVrS0haaGJDd2dkR2hwYzBGeVp5azdYRzRnSUNBZ2ZTQmxiSE5sSUh0Y2JpQWdJQ0FnSUdGYmEyVjVYU0E5SUhaaGJEdGNiaUFnSUNCOVhHNGdJSDBwTzF4dUlDQnlaWFIxY200Z1lUdGNibjFjYmx4dWJXOWtkV3hsTG1WNGNHOXlkSE1nUFNCN1hHNGdJR2x6UVhKeVlYazZJR2x6UVhKeVlYa3NYRzRnSUdselFYSnlZWGxDZFdabVpYSTZJR2x6UVhKeVlYbENkV1ptWlhJc1hHNGdJR2x6UW5WbVptVnlPaUJwYzBKMVptWmxjaXhjYmlBZ2FYTkdiM0p0UkdGMFlUb2dhWE5HYjNKdFJHRjBZU3hjYmlBZ2FYTkJjbkpoZVVKMVptWmxjbFpwWlhjNklHbHpRWEp5WVhsQ2RXWm1aWEpXYVdWM0xGeHVJQ0JwYzFOMGNtbHVaem9nYVhOVGRISnBibWNzWEc0Z0lHbHpUblZ0WW1WeU9pQnBjMDUxYldKbGNpeGNiaUFnYVhOUFltcGxZM1E2SUdselQySnFaV04wTEZ4dUlDQnBjMVZ1WkdWbWFXNWxaRG9nYVhOVmJtUmxabWx1WldRc1hHNGdJR2x6UkdGMFpUb2dhWE5FWVhSbExGeHVJQ0JwYzBacGJHVTZJR2x6Um1sc1pTeGNiaUFnYVhOQ2JHOWlPaUJwYzBKc2IySXNYRzRnSUdselJuVnVZM1JwYjI0NklHbHpSblZ1WTNScGIyNHNYRzRnSUdselUzUnlaV0Z0T2lCcGMxTjBjbVZoYlN4Y2JpQWdhWE5WVWt4VFpXRnlZMmhRWVhKaGJYTTZJR2x6VlZKTVUyVmhjbU5vVUdGeVlXMXpMRnh1SUNCcGMxTjBZVzVrWVhKa1FuSnZkM05sY2tWdWRqb2dhWE5UZEdGdVpHRnlaRUp5YjNkelpYSkZibllzWEc0Z0lHWnZja1ZoWTJnNklHWnZja1ZoWTJnc1hHNGdJRzFsY21kbE9pQnRaWEpuWlN4Y2JpQWdaWGgwWlc1a09pQmxlSFJsYm1Rc1hHNGdJSFJ5YVcwNklIUnlhVzFjYm4wN1hHNGlMQ0l2S2lwY2JpQXFJRU52Y0hseWFXZG9kQ0F5TURFekxYQnlaWE5sYm5Rc0lFWmhZMlZpYjI5ckxDQkpibU11WEc0Z0tpQkJiR3dnY21sbmFIUnpJSEpsYzJWeWRtVmtMbHh1SUNwY2JpQXFJRlJvYVhNZ2MyOTFjbU5sSUdOdlpHVWdhWE1nYkdsalpXNXpaV1FnZFc1a1pYSWdkR2hsSUVKVFJDMXpkSGxzWlNCc2FXTmxibk5sSUdadmRXNWtJR2x1SUhSb1pWeHVJQ29nVEVsRFJVNVRSU0JtYVd4bElHbHVJSFJvWlNCeWIyOTBJR1JwY21WamRHOXllU0J2WmlCMGFHbHpJSE52ZFhKalpTQjBjbVZsTGlCQmJpQmhaR1JwZEdsdmJtRnNJR2R5WVc1MFhHNGdLaUJ2WmlCd1lYUmxiblFnY21sbmFIUnpJR05oYmlCaVpTQm1iM1Z1WkNCcGJpQjBhR1VnVUVGVVJVNVVVeUJtYVd4bElHbHVJSFJvWlNCellXMWxJR1JwY21WamRHOXllUzVjYmlBcVhHNGdLaTljYmx4dUozVnpaU0J6ZEhKcFkzUW5PMXh1WEc1MllYSWdYMkZ6YzJsbmJpQTlJSEpsY1hWcGNtVW9KMjlpYW1WamRDMWhjM05wWjI0bktUdGNibHh1ZG1GeUlHVnRjSFI1VDJKcVpXTjBJRDBnY21WeGRXbHlaU2duWm1KcWN5OXNhV0l2Wlcxd2RIbFBZbXBsWTNRbktUdGNiblpoY2lCZmFXNTJZWEpwWVc1MElEMGdjbVZ4ZFdseVpTZ25abUpxY3k5c2FXSXZhVzUyWVhKcFlXNTBKeWs3WEc1Y2JtbG1JQ2h3Y205alpYTnpMbVZ1ZGk1T1QwUkZYMFZPVmlBaFBUMGdKM0J5YjJSMVkzUnBiMjRuS1NCN1hHNGdJSFpoY2lCM1lYSnVhVzVuSUQwZ2NtVnhkV2x5WlNnblptSnFjeTlzYVdJdmQyRnlibWx1WnljcE8xeHVmVnh1WEc1MllYSWdUVWxZU1U1VFgwdEZXU0E5SUNkdGFYaHBibk1uTzF4dVhHNHZMeUJJWld4d1pYSWdablZ1WTNScGIyNGdkRzhnWVd4c2IzY2dkR2hsSUdOeVpXRjBhVzl1SUc5bUlHRnViMjU1Ylc5MWN5Qm1kVzVqZEdsdmJuTWdkMmhwWTJnZ1pHOGdibTkwWEc0dkx5Qm9ZWFpsSUM1dVlXMWxJSE5sZENCMGJ5QjBhR1VnYm1GdFpTQnZaaUIwYUdVZ2RtRnlhV0ZpYkdVZ1ltVnBibWNnWVhOemFXZHVaV1FnZEc4dVhHNW1kVzVqZEdsdmJpQnBaR1Z1ZEdsMGVTaG1iaWtnZTF4dUlDQnlaWFIxY200Z1ptNDdYRzU5WEc1Y2JuWmhjaUJTWldGamRGQnliM0JVZVhCbFRHOWpZWFJwYjI1T1lXMWxjenRjYm1sbUlDaHdjbTlqWlhOekxtVnVkaTVPVDBSRlgwVk9WaUFoUFQwZ0ozQnliMlIxWTNScGIyNG5LU0I3WEc0Z0lGSmxZV04wVUhKdmNGUjVjR1ZNYjJOaGRHbHZiazVoYldWeklEMGdlMXh1SUNBZ0lIQnliM0E2SUNkd2NtOXdKeXhjYmlBZ0lDQmpiMjUwWlhoME9pQW5ZMjl1ZEdWNGRDY3NYRzRnSUNBZ1kyaHBiR1JEYjI1MFpYaDBPaUFuWTJocGJHUWdZMjl1ZEdWNGRDZGNiaUFnZlR0Y2JuMGdaV3h6WlNCN1hHNGdJRkpsWVdOMFVISnZjRlI1Y0dWTWIyTmhkR2x2Yms1aGJXVnpJRDBnZTMwN1hHNTlYRzVjYm1aMWJtTjBhVzl1SUdaaFkzUnZjbmtvVW1WaFkzUkRiMjF3YjI1bGJuUXNJR2x6Vm1Gc2FXUkZiR1Z0Wlc1MExDQlNaV0ZqZEU1dmIzQlZjR1JoZEdWUmRXVjFaU2tnZTF4dUlDQXZLaXBjYmlBZ0lDb2dVRzlzYVdOcFpYTWdkR2hoZENCa1pYTmpjbWxpWlNCdFpYUm9iMlJ6SUdsdUlHQlNaV0ZqZEVOc1lYTnpTVzUwWlhKbVlXTmxZQzVjYmlBZ0lDb3ZYRzVjYmlBZ2RtRnlJR2x1YW1WamRHVmtUV2w0YVc1eklEMGdXMTA3WEc1Y2JpQWdMeW9xWEc0Z0lDQXFJRU52YlhCdmMybDBaU0JqYjIxd2IyNWxiblJ6SUdGeVpTQm9hV2RvWlhJdGJHVjJaV3dnWTI5dGNHOXVaVzUwY3lCMGFHRjBJR052YlhCdmMyVWdiM1JvWlhJZ1kyOXRjRzl6YVhSbFhHNGdJQ0FxSUc5eUlHaHZjM1FnWTI5dGNHOXVaVzUwY3k1Y2JpQWdJQ3BjYmlBZ0lDb2dWRzhnWTNKbFlYUmxJR0VnYm1WM0lIUjVjR1VnYjJZZ1lGSmxZV04wUTJ4aGMzTmdMQ0J3WVhOeklHRWdjM0JsWTJsbWFXTmhkR2x2YmlCdlpseHVJQ0FnS2lCNWIzVnlJRzVsZHlCamJHRnpjeUIwYnlCZ1VtVmhZM1F1WTNKbFlYUmxRMnhoYzNOZ0xpQlVhR1VnYjI1c2VTQnlaWEYxYVhKbGJXVnVkQ0J2WmlCNWIzVnlJR05zWVhOelhHNGdJQ0FxSUhOd1pXTnBabWxqWVhScGIyNGdhWE1nZEdoaGRDQjViM1VnYVcxd2JHVnRaVzUwSUdFZ1lISmxibVJsY21BZ2JXVjBhRzlrTGx4dUlDQWdLbHh1SUNBZ0tpQWdJSFpoY2lCTmVVTnZiWEJ2Ym1WdWRDQTlJRkpsWVdOMExtTnlaV0YwWlVOc1lYTnpLSHRjYmlBZ0lDb2dJQ0FnSUhKbGJtUmxjam9nWm5WdVkzUnBiMjRvS1NCN1hHNGdJQ0FxSUNBZ0lDQWdJSEpsZEhWeWJpQThaR2wyUGtobGJHeHZJRmR2Y214a1BDOWthWFkrTzF4dUlDQWdLaUFnSUNBZ2ZWeHVJQ0FnS2lBZ0lIMHBPMXh1SUNBZ0tseHVJQ0FnS2lCVWFHVWdZMnhoYzNNZ2MzQmxZMmxtYVdOaGRHbHZiaUJ6ZFhCd2IzSjBjeUJoSUhOd1pXTnBabWxqSUhCeWIzUnZZMjlzSUc5bUlHMWxkR2h2WkhNZ2RHaGhkQ0JvWVhabFhHNGdJQ0FxSUhOd1pXTnBZV3dnYldWaGJtbHVaeUFvWlM1bkxpQmdjbVZ1WkdWeVlDa3VJRk5sWlNCZ1VtVmhZM1JEYkdGemMwbHVkR1Z5Wm1GalpXQWdabTl5WEc0Z0lDQXFJRzF2Y21VZ2RHaGxJR052YlhCeVpXaGxibk5wZG1VZ2NISnZkRzlqYjJ3dUlFRnVlU0J2ZEdobGNpQndjbTl3WlhKMGFXVnpJR0Z1WkNCdFpYUm9iMlJ6SUdsdUlIUm9aVnh1SUNBZ0tpQmpiR0Z6Y3lCemNHVmphV1pwWTJGMGFXOXVJSGRwYkd3Z1ltVWdZWFpoYVd4aFlteGxJRzl1SUhSb1pTQndjbTkwYjNSNWNHVXVYRzRnSUNBcVhHNGdJQ0FxSUVCcGJuUmxjbVpoWTJVZ1VtVmhZM1JEYkdGemMwbHVkR1Z5Wm1GalpWeHVJQ0FnS2lCQWFXNTBaWEp1WVd4Y2JpQWdJQ292WEc0Z0lIWmhjaUJTWldGamRFTnNZWE56U1c1MFpYSm1ZV05sSUQwZ2UxeHVJQ0FnSUM4cUtseHVJQ0FnSUNBcUlFRnVJR0Z5Y21GNUlHOW1JRTFwZUdsdUlHOWlhbVZqZEhNZ2RHOGdhVzVqYkhWa1pTQjNhR1Z1SUdSbFptbHVhVzVuSUhsdmRYSWdZMjl0Y0c5dVpXNTBMbHh1SUNBZ0lDQXFYRzRnSUNBZ0lDb2dRSFI1Y0dVZ2UyRnljbUY1ZlZ4dUlDQWdJQ0FxSUVCdmNIUnBiMjVoYkZ4dUlDQWdJQ0FxTDF4dUlDQWdJRzFwZUdsdWN6b2dKMFJGUmtsT1JWOU5RVTVaSnl4Y2JseHVJQ0FnSUM4cUtseHVJQ0FnSUNBcUlFRnVJRzlpYW1WamRDQmpiMjUwWVdsdWFXNW5JSEJ5YjNCbGNuUnBaWE1nWVc1a0lHMWxkR2h2WkhNZ2RHaGhkQ0J6YUc5MWJHUWdZbVVnWkdWbWFXNWxaQ0J2Ymx4dUlDQWdJQ0FxSUhSb1pTQmpiMjF3YjI1bGJuUW5jeUJqYjI1emRISjFZM1J2Y2lCcGJuTjBaV0ZrSUc5bUlHbDBjeUJ3Y205MGIzUjVjR1VnS0hOMFlYUnBZeUJ0WlhSb2IyUnpLUzVjYmlBZ0lDQWdLbHh1SUNBZ0lDQXFJRUIwZVhCbElIdHZZbXBsWTNSOVhHNGdJQ0FnSUNvZ1FHOXdkR2x2Ym1Gc1hHNGdJQ0FnSUNvdlhHNGdJQ0FnYzNSaGRHbGpjem9nSjBSRlJrbE9SVjlOUVU1Wkp5eGNibHh1SUNBZ0lDOHFLbHh1SUNBZ0lDQXFJRVJsWm1sdWFYUnBiMjRnYjJZZ2NISnZjQ0IwZVhCbGN5Qm1iM0lnZEdocGN5QmpiMjF3YjI1bGJuUXVYRzRnSUNBZ0lDcGNiaUFnSUNBZ0tpQkFkSGx3WlNCN2IySnFaV04wZlZ4dUlDQWdJQ0FxSUVCdmNIUnBiMjVoYkZ4dUlDQWdJQ0FxTDF4dUlDQWdJSEJ5YjNCVWVYQmxjem9nSjBSRlJrbE9SVjlOUVU1Wkp5eGNibHh1SUNBZ0lDOHFLbHh1SUNBZ0lDQXFJRVJsWm1sdWFYUnBiMjRnYjJZZ1kyOXVkR1Y0ZENCMGVYQmxjeUJtYjNJZ2RHaHBjeUJqYjIxd2IyNWxiblF1WEc0Z0lDQWdJQ3BjYmlBZ0lDQWdLaUJBZEhsd1pTQjdiMkpxWldOMGZWeHVJQ0FnSUNBcUlFQnZjSFJwYjI1aGJGeHVJQ0FnSUNBcUwxeHVJQ0FnSUdOdmJuUmxlSFJVZVhCbGN6b2dKMFJGUmtsT1JWOU5RVTVaSnl4Y2JseHVJQ0FnSUM4cUtseHVJQ0FnSUNBcUlFUmxabWx1YVhScGIyNGdiMllnWTI5dWRHVjRkQ0IwZVhCbGN5QjBhR2x6SUdOdmJYQnZibVZ1ZENCelpYUnpJR1p2Y2lCcGRITWdZMmhwYkdSeVpXNHVYRzRnSUNBZ0lDcGNiaUFnSUNBZ0tpQkFkSGx3WlNCN2IySnFaV04wZlZ4dUlDQWdJQ0FxSUVCdmNIUnBiMjVoYkZ4dUlDQWdJQ0FxTDF4dUlDQWdJR05vYVd4a1EyOXVkR1Y0ZEZSNWNHVnpPaUFuUkVWR1NVNUZYMDFCVGxrbkxGeHVYRzRnSUNBZ0x5OGdQVDA5UFNCRVpXWnBibWwwYVc5dUlHMWxkR2h2WkhNZ1BUMDlQVnh1WEc0Z0lDQWdMeW9xWEc0Z0lDQWdJQ29nU1c1MmIydGxaQ0IzYUdWdUlIUm9aU0JqYjIxd2IyNWxiblFnYVhNZ2JXOTFiblJsWkM0Z1ZtRnNkV1Z6SUdsdUlIUm9aU0J0WVhCd2FXNW5JSGRwYkd3Z1ltVWdjMlYwSUc5dVhHNGdJQ0FnSUNvZ1lIUm9hWE11Y0hKdmNITmdJR2xtSUhSb1lYUWdjSEp2Y0NCcGN5QnViM1FnYzNCbFkybG1hV1ZrSUNocExtVXVJSFZ6YVc1bklHRnVJR0JwYm1BZ1kyaGxZMnNwTGx4dUlDQWdJQ0FxWEc0Z0lDQWdJQ29nVkdocGN5QnRaWFJvYjJRZ2FYTWdhVzUyYjJ0bFpDQmlaV1p2Y21VZ1lHZGxkRWx1YVhScFlXeFRkR0YwWldBZ1lXNWtJSFJvWlhKbFptOXlaU0JqWVc1dWIzUWdjbVZzZVZ4dUlDQWdJQ0FxSUc5dUlHQjBhR2x6TG5OMFlYUmxZQ0J2Y2lCMWMyVWdZSFJvYVhNdWMyVjBVM1JoZEdWZ0xseHVJQ0FnSUNBcVhHNGdJQ0FnSUNvZ1FISmxkSFZ5YmlCN2IySnFaV04wZlZ4dUlDQWdJQ0FxSUVCdmNIUnBiMjVoYkZ4dUlDQWdJQ0FxTDF4dUlDQWdJR2RsZEVSbFptRjFiSFJRY205d2N6b2dKMFJGUmtsT1JWOU5RVTVaWDAxRlVrZEZSQ2NzWEc1Y2JpQWdJQ0F2S2lwY2JpQWdJQ0FnS2lCSmJuWnZhMlZrSUc5dVkyVWdZbVZtYjNKbElIUm9aU0JqYjIxd2IyNWxiblFnYVhNZ2JXOTFiblJsWkM0Z1ZHaGxJSEpsZEhWeWJpQjJZV3gxWlNCM2FXeHNJR0psSUhWelpXUmNiaUFnSUNBZ0tpQmhjeUIwYUdVZ2FXNXBkR2xoYkNCMllXeDFaU0J2WmlCZ2RHaHBjeTV6ZEdGMFpXQXVYRzRnSUNBZ0lDcGNiaUFnSUNBZ0tpQWdJR2RsZEVsdWFYUnBZV3hUZEdGMFpUb2dablZ1WTNScGIyNG9LU0I3WEc0Z0lDQWdJQ29nSUNBZ0lISmxkSFZ5YmlCN1hHNGdJQ0FnSUNvZ0lDQWdJQ0FnYVhOUGJqb2dabUZzYzJVc1hHNGdJQ0FnSUNvZ0lDQWdJQ0FnWm05dlFtRjZPaUJ1WlhjZ1FtRjZSbTl2S0NsY2JpQWdJQ0FnS2lBZ0lDQWdmVnh1SUNBZ0lDQXFJQ0FnZlZ4dUlDQWdJQ0FxWEc0Z0lDQWdJQ29nUUhKbGRIVnliaUI3YjJKcVpXTjBmVnh1SUNBZ0lDQXFJRUJ2Y0hScGIyNWhiRnh1SUNBZ0lDQXFMMXh1SUNBZ0lHZGxkRWx1YVhScFlXeFRkR0YwWlRvZ0owUkZSa2xPUlY5TlFVNVpYMDFGVWtkRlJDY3NYRzVjYmlBZ0lDQXZLaXBjYmlBZ0lDQWdLaUJBY21WMGRYSnVJSHR2WW1wbFkzUjlYRzRnSUNBZ0lDb2dRRzl3ZEdsdmJtRnNYRzRnSUNBZ0lDb3ZYRzRnSUNBZ1oyVjBRMmhwYkdSRGIyNTBaWGgwT2lBblJFVkdTVTVGWDAxQlRsbGZUVVZTUjBWRUp5eGNibHh1SUNBZ0lDOHFLbHh1SUNBZ0lDQXFJRlZ6WlhNZ2NISnZjSE1nWm5KdmJTQmdkR2hwY3k1d2NtOXdjMkFnWVc1a0lITjBZWFJsSUdaeWIyMGdZSFJvYVhNdWMzUmhkR1ZnSUhSdklISmxibVJsY2lCMGFHVmNiaUFnSUNBZ0tpQnpkSEoxWTNSMWNtVWdiMllnZEdobElHTnZiWEJ2Ym1WdWRDNWNiaUFnSUNBZ0tseHVJQ0FnSUNBcUlFNXZJR2QxWVhKaGJuUmxaWE1nWVhKbElHMWhaR1VnWVdKdmRYUWdkMmhsYmlCdmNpQm9iM2NnYjJaMFpXNGdkR2hwY3lCdFpYUm9iMlFnYVhNZ2FXNTJiMnRsWkN3Z2MyOWNiaUFnSUNBZ0tpQnBkQ0J0ZFhOMElHNXZkQ0JvWVhabElITnBaR1VnWldabVpXTjBjeTVjYmlBZ0lDQWdLbHh1SUNBZ0lDQXFJQ0FnY21WdVpHVnlPaUJtZFc1amRHbHZiaWdwSUh0Y2JpQWdJQ0FnS2lBZ0lDQWdkbUZ5SUc1aGJXVWdQU0IwYUdsekxuQnliM0J6TG01aGJXVTdYRzRnSUNBZ0lDb2dJQ0FnSUhKbGRIVnliaUE4WkdsMlBraGxiR3h2TENCN2JtRnRaWDBoUEM5a2FYWStPMXh1SUNBZ0lDQXFJQ0FnZlZ4dUlDQWdJQ0FxWEc0Z0lDQWdJQ29nUUhKbGRIVnliaUI3VW1WaFkzUkRiMjF3YjI1bGJuUjlYRzRnSUNBZ0lDb2dRSEpsY1hWcGNtVmtYRzRnSUNBZ0lDb3ZYRzRnSUNBZ2NtVnVaR1Z5T2lBblJFVkdTVTVGWDA5T1EwVW5MRnh1WEc0Z0lDQWdMeThnUFQwOVBTQkVaV3hsWjJGMFpTQnRaWFJvYjJSeklEMDlQVDFjYmx4dUlDQWdJQzhxS2x4dUlDQWdJQ0FxSUVsdWRtOXJaV1FnZDJobGJpQjBhR1VnWTI5dGNHOXVaVzUwSUdseklHbHVhWFJwWVd4c2VTQmpjbVZoZEdWa0lHRnVaQ0JoWW05MWRDQjBieUJpWlNCdGIzVnVkR1ZrTGx4dUlDQWdJQ0FxSUZSb2FYTWdiV0Y1SUdoaGRtVWdjMmxrWlNCbFptWmxZM1J6TENCaWRYUWdZVzU1SUdWNGRHVnlibUZzSUhOMVluTmpjbWx3ZEdsdmJuTWdiM0lnWkdGMFlTQmpjbVZoZEdWa1hHNGdJQ0FnSUNvZ1lua2dkR2hwY3lCdFpYUm9iMlFnYlhWemRDQmlaU0JqYkdWaGJtVmtJSFZ3SUdsdUlHQmpiMjF3YjI1bGJuUlhhV3hzVlc1dGIzVnVkR0F1WEc0Z0lDQWdJQ3BjYmlBZ0lDQWdLaUJBYjNCMGFXOXVZV3hjYmlBZ0lDQWdLaTljYmlBZ0lDQmpiMjF3YjI1bGJuUlhhV3hzVFc5MWJuUTZJQ2RFUlVaSlRrVmZUVUZPV1Njc1hHNWNiaUFnSUNBdktpcGNiaUFnSUNBZ0tpQkpiblp2YTJWa0lIZG9aVzRnZEdobElHTnZiWEJ2Ym1WdWRDQm9ZWE1nWW1WbGJpQnRiM1Z1ZEdWa0lHRnVaQ0JvWVhNZ1lTQkVUMDBnY21Wd2NtVnpaVzUwWVhScGIyNHVYRzRnSUNBZ0lDb2dTRzkzWlhabGNpd2dkR2hsY21VZ2FYTWdibThnWjNWaGNtRnVkR1ZsSUhSb1lYUWdkR2hsSUVSUFRTQnViMlJsSUdseklHbHVJSFJvWlNCa2IyTjFiV1Z1ZEM1Y2JpQWdJQ0FnS2x4dUlDQWdJQ0FxSUZWelpTQjBhR2x6SUdGeklHRnVJRzl3Y0c5eWRIVnVhWFI1SUhSdklHOXdaWEpoZEdVZ2IyNGdkR2hsSUVSUFRTQjNhR1Z1SUhSb1pTQmpiMjF3YjI1bGJuUWdhR0Z6WEc0Z0lDQWdJQ29nWW1WbGJpQnRiM1Z1ZEdWa0lDaHBibWwwYVdGc2FYcGxaQ0JoYm1RZ2NtVnVaR1Z5WldRcElHWnZjaUIwYUdVZ1ptbHljM1FnZEdsdFpTNWNiaUFnSUNBZ0tseHVJQ0FnSUNBcUlFQndZWEpoYlNCN1JFOU5SV3hsYldWdWRIMGdjbTl2ZEU1dlpHVWdSRTlOSUdWc1pXMWxiblFnY21Wd2NtVnpaVzUwYVc1bklIUm9aU0JqYjIxd2IyNWxiblF1WEc0Z0lDQWdJQ29nUUc5d2RHbHZibUZzWEc0Z0lDQWdJQ292WEc0Z0lDQWdZMjl0Y0c5dVpXNTBSR2xrVFc5MWJuUTZJQ2RFUlVaSlRrVmZUVUZPV1Njc1hHNWNiaUFnSUNBdktpcGNiaUFnSUNBZ0tpQkpiblp2YTJWa0lHSmxabTl5WlNCMGFHVWdZMjl0Y0c5dVpXNTBJSEpsWTJWcGRtVnpJRzVsZHlCd2NtOXdjeTVjYmlBZ0lDQWdLbHh1SUNBZ0lDQXFJRlZ6WlNCMGFHbHpJR0Z6SUdGdUlHOXdjRzl5ZEhWdWFYUjVJSFJ2SUhKbFlXTjBJSFJ2SUdFZ2NISnZjQ0IwY21GdWMybDBhVzl1SUdKNUlIVndaR0YwYVc1bklIUm9aVnh1SUNBZ0lDQXFJSE4wWVhSbElIVnphVzVuSUdCMGFHbHpMbk5sZEZOMFlYUmxZQzRnUTNWeWNtVnVkQ0J3Y205d2N5QmhjbVVnWVdOalpYTnpaV1FnZG1saElHQjBhR2x6TG5CeWIzQnpZQzVjYmlBZ0lDQWdLbHh1SUNBZ0lDQXFJQ0FnWTI5dGNHOXVaVzUwVjJsc2JGSmxZMlZwZG1WUWNtOXdjem9nWm5WdVkzUnBiMjRvYm1WNGRGQnliM0J6TENCdVpYaDBRMjl1ZEdWNGRDa2dlMXh1SUNBZ0lDQXFJQ0FnSUNCMGFHbHpMbk5sZEZOMFlYUmxLSHRjYmlBZ0lDQWdLaUFnSUNBZ0lDQnNhV3RsYzBsdVkzSmxZWE5wYm1jNklHNWxlSFJRY205d2N5NXNhV3RsUTI5MWJuUWdQaUIwYUdsekxuQnliM0J6TG14cGEyVkRiM1Z1ZEZ4dUlDQWdJQ0FxSUNBZ0lDQjlLVHRjYmlBZ0lDQWdLaUFnSUgxY2JpQWdJQ0FnS2x4dUlDQWdJQ0FxSUU1UFZFVTZJRlJvWlhKbElHbHpJRzV2SUdWeGRXbDJZV3hsYm5RZ1lHTnZiWEJ2Ym1WdWRGZHBiR3hTWldObGFYWmxVM1JoZEdWZ0xpQkJiaUJwYm1OdmJXbHVaeUJ3Y205d1hHNGdJQ0FnSUNvZ2RISmhibk5wZEdsdmJpQnRZWGtnWTJGMWMyVWdZU0J6ZEdGMFpTQmphR0Z1WjJVc0lHSjFkQ0IwYUdVZ2IzQndiM05wZEdVZ2FYTWdibTkwSUhSeWRXVXVJRWxtSUhsdmRWeHVJQ0FnSUNBcUlHNWxaV1FnYVhRc0lIbHZkU0JoY21VZ2NISnZZbUZpYkhrZ2JHOXZhMmx1WnlCbWIzSWdZR052YlhCdmJtVnVkRmRwYkd4VmNHUmhkR1ZnTGx4dUlDQWdJQ0FxWEc0Z0lDQWdJQ29nUUhCaGNtRnRJSHR2WW1wbFkzUjlJRzVsZUhSUWNtOXdjMXh1SUNBZ0lDQXFJRUJ2Y0hScGIyNWhiRnh1SUNBZ0lDQXFMMXh1SUNBZ0lHTnZiWEJ2Ym1WdWRGZHBiR3hTWldObGFYWmxVSEp2Y0hNNklDZEVSVVpKVGtWZlRVRk9XU2NzWEc1Y2JpQWdJQ0F2S2lwY2JpQWdJQ0FnS2lCSmJuWnZhMlZrSUhkb2FXeGxJR1JsWTJsa2FXNW5JR2xtSUhSb1pTQmpiMjF3YjI1bGJuUWdjMmh2ZFd4a0lHSmxJSFZ3WkdGMFpXUWdZWE1nWVNCeVpYTjFiSFFnYjJaY2JpQWdJQ0FnS2lCeVpXTmxhWFpwYm1jZ2JtVjNJSEJ5YjNCekxDQnpkR0YwWlNCaGJtUXZiM0lnWTI5dWRHVjRkQzVjYmlBZ0lDQWdLbHh1SUNBZ0lDQXFJRlZ6WlNCMGFHbHpJR0Z6SUdGdUlHOXdjRzl5ZEhWdWFYUjVJSFJ2SUdCeVpYUjFjbTRnWm1Gc2MyVmdJSGRvWlc0Z2VXOTFKM0psSUdObGNuUmhhVzRnZEdoaGRDQjBhR1ZjYmlBZ0lDQWdLaUIwY21GdWMybDBhVzl1SUhSdklIUm9aU0J1WlhjZ2NISnZjSE12YzNSaGRHVXZZMjl1ZEdWNGRDQjNhV3hzSUc1dmRDQnlaWEYxYVhKbElHRWdZMjl0Y0c5dVpXNTBYRzRnSUNBZ0lDb2dkWEJrWVhSbExseHVJQ0FnSUNBcVhHNGdJQ0FnSUNvZ0lDQnphRzkxYkdSRGIyMXdiMjVsYm5SVmNHUmhkR1U2SUdaMWJtTjBhVzl1S0c1bGVIUlFjbTl3Y3l3Z2JtVjRkRk4wWVhSbExDQnVaWGgwUTI5dWRHVjRkQ2tnZTF4dUlDQWdJQ0FxSUNBZ0lDQnlaWFIxY200Z0lXVnhkV0ZzS0c1bGVIUlFjbTl3Y3l3Z2RHaHBjeTV3Y205d2N5a2dmSHhjYmlBZ0lDQWdLaUFnSUNBZ0lDQWhaWEYxWVd3b2JtVjRkRk4wWVhSbExDQjBhR2x6TG5OMFlYUmxLU0I4ZkZ4dUlDQWdJQ0FxSUNBZ0lDQWdJQ0ZsY1hWaGJDaHVaWGgwUTI5dWRHVjRkQ3dnZEdocGN5NWpiMjUwWlhoMEtUdGNiaUFnSUNBZ0tpQWdJSDFjYmlBZ0lDQWdLbHh1SUNBZ0lDQXFJRUJ3WVhKaGJTQjdiMkpxWldOMGZTQnVaWGgwVUhKdmNITmNiaUFnSUNBZ0tpQkFjR0Z5WVcwZ2V6OXZZbXBsWTNSOUlHNWxlSFJUZEdGMFpWeHVJQ0FnSUNBcUlFQndZWEpoYlNCN1AyOWlhbVZqZEgwZ2JtVjRkRU52Ym5SbGVIUmNiaUFnSUNBZ0tpQkFjbVYwZFhKdUlIdGliMjlzWldGdWZTQlVjblZsSUdsbUlIUm9aU0JqYjIxd2IyNWxiblFnYzJodmRXeGtJSFZ3WkdGMFpTNWNiaUFnSUNBZ0tpQkFiM0IwYVc5dVlXeGNiaUFnSUNBZ0tpOWNiaUFnSUNCemFHOTFiR1JEYjIxd2IyNWxiblJWY0dSaGRHVTZJQ2RFUlVaSlRrVmZUMDVEUlNjc1hHNWNiaUFnSUNBdktpcGNiaUFnSUNBZ0tpQkpiblp2YTJWa0lIZG9aVzRnZEdobElHTnZiWEJ2Ym1WdWRDQnBjeUJoWW05MWRDQjBieUIxY0dSaGRHVWdaSFZsSUhSdklHRWdkSEpoYm5OcGRHbHZiaUJtY205dFhHNGdJQ0FnSUNvZ1lIUm9hWE11Y0hKdmNITmdMQ0JnZEdocGN5NXpkR0YwWldBZ1lXNWtJR0IwYUdsekxtTnZiblJsZUhSZ0lIUnZJR0J1WlhoMFVISnZjSE5nTENCZ2JtVjRkRk4wWVhSbFlGeHVJQ0FnSUNBcUlHRnVaQ0JnYm1WNGRFTnZiblJsZUhSZ0xseHVJQ0FnSUNBcVhHNGdJQ0FnSUNvZ1ZYTmxJSFJvYVhNZ1lYTWdZVzRnYjNCd2IzSjBkVzVwZEhrZ2RHOGdjR1Z5Wm05eWJTQndjbVZ3WVhKaGRHbHZiaUJpWldadmNtVWdZVzRnZFhCa1lYUmxJRzlqWTNWeWN5NWNiaUFnSUNBZ0tseHVJQ0FnSUNBcUlFNVBWRVU2SUZsdmRTQXFLbU5oYm01dmRDb3FJSFZ6WlNCZ2RHaHBjeTV6WlhSVGRHRjBaU2dwWUNCcGJpQjBhR2x6SUcxbGRHaHZaQzVjYmlBZ0lDQWdLbHh1SUNBZ0lDQXFJRUJ3WVhKaGJTQjdiMkpxWldOMGZTQnVaWGgwVUhKdmNITmNiaUFnSUNBZ0tpQkFjR0Z5WVcwZ2V6OXZZbXBsWTNSOUlHNWxlSFJUZEdGMFpWeHVJQ0FnSUNBcUlFQndZWEpoYlNCN1AyOWlhbVZqZEgwZ2JtVjRkRU52Ym5SbGVIUmNiaUFnSUNBZ0tpQkFjR0Z5WVcwZ2UxSmxZV04wVW1WamIyNWphV3hsVkhKaGJuTmhZM1JwYjI1OUlIUnlZVzV6WVdOMGFXOXVYRzRnSUNBZ0lDb2dRRzl3ZEdsdmJtRnNYRzRnSUNBZ0lDb3ZYRzRnSUNBZ1kyOXRjRzl1Wlc1MFYybHNiRlZ3WkdGMFpUb2dKMFJGUmtsT1JWOU5RVTVaSnl4Y2JseHVJQ0FnSUM4cUtseHVJQ0FnSUNBcUlFbHVkbTlyWldRZ2QyaGxiaUIwYUdVZ1kyOXRjRzl1Wlc1MEozTWdSRTlOSUhKbGNISmxjMlZ1ZEdGMGFXOXVJR2hoY3lCaVpXVnVJSFZ3WkdGMFpXUXVYRzRnSUNBZ0lDcGNiaUFnSUNBZ0tpQlZjMlVnZEdocGN5QmhjeUJoYmlCdmNIQnZjblIxYm1sMGVTQjBieUJ2Y0dWeVlYUmxJRzl1SUhSb1pTQkVUMDBnZDJobGJpQjBhR1VnWTI5dGNHOXVaVzUwSUdoaGMxeHVJQ0FnSUNBcUlHSmxaVzRnZFhCa1lYUmxaQzVjYmlBZ0lDQWdLbHh1SUNBZ0lDQXFJRUJ3WVhKaGJTQjdiMkpxWldOMGZTQndjbVYyVUhKdmNITmNiaUFnSUNBZ0tpQkFjR0Z5WVcwZ2V6OXZZbXBsWTNSOUlIQnlaWFpUZEdGMFpWeHVJQ0FnSUNBcUlFQndZWEpoYlNCN1AyOWlhbVZqZEgwZ2NISmxka052Ym5SbGVIUmNiaUFnSUNBZ0tpQkFjR0Z5WVcwZ2UwUlBUVVZzWlcxbGJuUjlJSEp2YjNST2IyUmxJRVJQVFNCbGJHVnRaVzUwSUhKbGNISmxjMlZ1ZEdsdVp5QjBhR1VnWTI5dGNHOXVaVzUwTGx4dUlDQWdJQ0FxSUVCdmNIUnBiMjVoYkZ4dUlDQWdJQ0FxTDF4dUlDQWdJR052YlhCdmJtVnVkRVJwWkZWd1pHRjBaVG9nSjBSRlJrbE9SVjlOUVU1Wkp5eGNibHh1SUNBZ0lDOHFLbHh1SUNBZ0lDQXFJRWx1ZG05clpXUWdkMmhsYmlCMGFHVWdZMjl0Y0c5dVpXNTBJR2x6SUdGaWIzVjBJSFJ2SUdKbElISmxiVzkyWldRZ1puSnZiU0JwZEhNZ2NHRnlaVzUwSUdGdVpDQm9ZWFpsWEc0Z0lDQWdJQ29nYVhSeklFUlBUU0J5WlhCeVpYTmxiblJoZEdsdmJpQmtaWE4wY205NVpXUXVYRzRnSUNBZ0lDcGNiaUFnSUNBZ0tpQlZjMlVnZEdocGN5QmhjeUJoYmlCdmNIQnZjblIxYm1sMGVTQjBieUJrWldGc2JHOWpZWFJsSUdGdWVTQmxlSFJsY201aGJDQnlaWE52ZFhKalpYTXVYRzRnSUNBZ0lDcGNiaUFnSUNBZ0tpQk9UMVJGT2lCVWFHVnlaU0JwY3lCdWJ5QmdZMjl0Y0c5dVpXNTBSR2xrVlc1dGIzVnVkR0FnYzJsdVkyVWdlVzkxY2lCamIyMXdiMjVsYm5RZ2QybHNiQ0JvWVhabElHSmxaVzVjYmlBZ0lDQWdLaUJrWlhOMGNtOTVaV1FnWW5rZ2RHaGhkQ0J3YjJsdWRDNWNiaUFnSUNBZ0tseHVJQ0FnSUNBcUlFQnZjSFJwYjI1aGJGeHVJQ0FnSUNBcUwxeHVJQ0FnSUdOdmJYQnZibVZ1ZEZkcGJHeFZibTF2ZFc1ME9pQW5SRVZHU1U1RlgwMUJUbGtuTEZ4dVhHNGdJQ0FnTHk4Z1BUMDlQU0JCWkhaaGJtTmxaQ0J0WlhSb2IyUnpJRDA5UFQxY2JseHVJQ0FnSUM4cUtseHVJQ0FnSUNBcUlGVndaR0YwWlhNZ2RHaGxJR052YlhCdmJtVnVkQ2R6SUdOMWNuSmxiblJzZVNCdGIzVnVkR1ZrSUVSUFRTQnlaWEJ5WlhObGJuUmhkR2x2Ymk1Y2JpQWdJQ0FnS2x4dUlDQWdJQ0FxSUVKNUlHUmxabUYxYkhRc0lIUm9hWE1nYVcxd2JHVnRaVzUwY3lCU1pXRmpkQ2R6SUhKbGJtUmxjbWx1WnlCaGJtUWdjbVZqYjI1amFXeHBZWFJwYjI0Z1lXeG5iM0pwZEdodExseHVJQ0FnSUNBcUlGTnZjR2hwYzNScFkyRjBaV1FnWTJ4cFpXNTBjeUJ0WVhrZ2QybHphQ0IwYnlCdmRtVnljbWxrWlNCMGFHbHpMbHh1SUNBZ0lDQXFYRzRnSUNBZ0lDb2dRSEJoY21GdElIdFNaV0ZqZEZKbFkyOXVZMmxzWlZSeVlXNXpZV04wYVc5dWZTQjBjbUZ1YzJGamRHbHZibHh1SUNBZ0lDQXFJRUJwYm5SbGNtNWhiRnh1SUNBZ0lDQXFJRUJ2ZG1WeWNtbGtZV0pzWlZ4dUlDQWdJQ0FxTDF4dUlDQWdJSFZ3WkdGMFpVTnZiWEJ2Ym1WdWREb2dKMDlXUlZKU1NVUkZYMEpCVTBVblhHNGdJSDA3WEc1Y2JpQWdMeW9xWEc0Z0lDQXFJRTFoY0hCcGJtY2dabkp2YlNCamJHRnpjeUJ6Y0dWamFXWnBZMkYwYVc5dUlHdGxlWE1nZEc4Z2MzQmxZMmxoYkNCd2NtOWpaWE56YVc1bklHWjFibU4wYVc5dWN5NWNiaUFnSUNwY2JpQWdJQ29nUVd4MGFHOTFaMmdnZEdobGMyVWdZWEpsSUdSbFkyeGhjbVZrSUd4cGEyVWdhVzV6ZEdGdVkyVWdjSEp2Y0dWeWRHbGxjeUJwYmlCMGFHVWdjM0JsWTJsbWFXTmhkR2x2Ymx4dUlDQWdLaUIzYUdWdUlHUmxabWx1YVc1bklHTnNZWE56WlhNZ2RYTnBibWNnWUZKbFlXTjBMbU55WldGMFpVTnNZWE56WUN3Z2RHaGxlU0JoY21VZ1lXTjBkV0ZzYkhrZ2MzUmhkR2xqWEc0Z0lDQXFJR0Z1WkNCaGNtVWdZV05qWlhOemFXSnNaU0J2YmlCMGFHVWdZMjl1YzNSeWRXTjBiM0lnYVc1emRHVmhaQ0J2WmlCMGFHVWdjSEp2ZEc5MGVYQmxMaUJFWlhOd2FYUmxYRzRnSUNBcUlHSmxhVzVuSUhOMFlYUnBZeXdnZEdobGVTQnRkWE4wSUdKbElHUmxabWx1WldRZ2IzVjBjMmxrWlNCdlppQjBhR1VnWENKemRHRjBhV056WENJZ2EyVjVJSFZ1WkdWeVhHNGdJQ0FxSUhkb2FXTm9JR0ZzYkNCdmRHaGxjaUJ6ZEdGMGFXTWdiV1YwYUc5a2N5QmhjbVVnWkdWbWFXNWxaQzVjYmlBZ0lDb3ZYRzRnSUhaaGNpQlNSVk5GVWxaRlJGOVRVRVZEWDB0RldWTWdQU0I3WEc0Z0lDQWdaR2x6Y0d4aGVVNWhiV1U2SUdaMWJtTjBhVzl1S0VOdmJuTjBjblZqZEc5eUxDQmthWE53YkdGNVRtRnRaU2tnZTF4dUlDQWdJQ0FnUTI5dWMzUnlkV04wYjNJdVpHbHpjR3hoZVU1aGJXVWdQU0JrYVhOd2JHRjVUbUZ0WlR0Y2JpQWdJQ0I5TEZ4dUlDQWdJRzFwZUdsdWN6b2dablZ1WTNScGIyNG9RMjl1YzNSeWRXTjBiM0lzSUcxcGVHbHVjeWtnZTF4dUlDQWdJQ0FnYVdZZ0tHMXBlR2x1Y3lrZ2UxeHVJQ0FnSUNBZ0lDQm1iM0lnS0haaGNpQnBJRDBnTURzZ2FTQThJRzFwZUdsdWN5NXNaVzVuZEdnN0lHa3JLeWtnZTF4dUlDQWdJQ0FnSUNBZ0lHMXBlRk53WldOSmJuUnZRMjl0Y0c5dVpXNTBLRU52Ym5OMGNuVmpkRzl5TENCdGFYaHBibk5iYVYwcE8xeHVJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQjlYRzRnSUNBZ2ZTeGNiaUFnSUNCamFHbHNaRU52Ym5SbGVIUlVlWEJsY3pvZ1puVnVZM1JwYjI0b1EyOXVjM1J5ZFdOMGIzSXNJR05vYVd4a1EyOXVkR1Y0ZEZSNWNHVnpLU0I3WEc0Z0lDQWdJQ0JwWmlBb2NISnZZMlZ6Y3k1bGJuWXVUazlFUlY5RlRsWWdJVDA5SUNkd2NtOWtkV04wYVc5dUp5a2dlMXh1SUNBZ0lDQWdJQ0IyWVd4cFpHRjBaVlI1Y0dWRVpXWW9RMjl1YzNSeWRXTjBiM0lzSUdOb2FXeGtRMjl1ZEdWNGRGUjVjR1Z6TENBblkyaHBiR1JEYjI1MFpYaDBKeWs3WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdJQ0JEYjI1emRISjFZM1J2Y2k1amFHbHNaRU52Ym5SbGVIUlVlWEJsY3lBOUlGOWhjM05wWjI0b1hHNGdJQ0FnSUNBZ0lIdDlMRnh1SUNBZ0lDQWdJQ0JEYjI1emRISjFZM1J2Y2k1amFHbHNaRU52Ym5SbGVIUlVlWEJsY3l4Y2JpQWdJQ0FnSUNBZ1kyaHBiR1JEYjI1MFpYaDBWSGx3WlhOY2JpQWdJQ0FnSUNrN1hHNGdJQ0FnZlN4Y2JpQWdJQ0JqYjI1MFpYaDBWSGx3WlhNNklHWjFibU4wYVc5dUtFTnZibk4wY25WamRHOXlMQ0JqYjI1MFpYaDBWSGx3WlhNcElIdGNiaUFnSUNBZ0lHbG1JQ2h3Y205alpYTnpMbVZ1ZGk1T1QwUkZYMFZPVmlBaFBUMGdKM0J5YjJSMVkzUnBiMjRuS1NCN1hHNGdJQ0FnSUNBZ0lIWmhiR2xrWVhSbFZIbHdaVVJsWmloRGIyNXpkSEoxWTNSdmNpd2dZMjl1ZEdWNGRGUjVjR1Z6TENBblkyOXVkR1Y0ZENjcE8xeHVJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ1EyOXVjM1J5ZFdOMGIzSXVZMjl1ZEdWNGRGUjVjR1Z6SUQwZ1gyRnpjMmxuYmloY2JpQWdJQ0FnSUNBZ2UzMHNYRzRnSUNBZ0lDQWdJRU52Ym5OMGNuVmpkRzl5TG1OdmJuUmxlSFJVZVhCbGN5eGNiaUFnSUNBZ0lDQWdZMjl1ZEdWNGRGUjVjR1Z6WEc0Z0lDQWdJQ0FwTzF4dUlDQWdJSDBzWEc0Z0lDQWdMeW9xWEc0Z0lDQWdJQ29nVTNCbFkybGhiQ0JqWVhObElHZGxkRVJsWm1GMWJIUlFjbTl3Y3lCM2FHbGphQ0J6YUc5MWJHUWdiVzkyWlNCcGJuUnZJSE4wWVhScFkzTWdZblYwSUhKbGNYVnBjbVZ6WEc0Z0lDQWdJQ29nWVhWMGIyMWhkR2xqSUcxbGNtZHBibWN1WEc0Z0lDQWdJQ292WEc0Z0lDQWdaMlYwUkdWbVlYVnNkRkJ5YjNCek9pQm1kVzVqZEdsdmJpaERiMjV6ZEhKMVkzUnZjaXdnWjJWMFJHVm1ZWFZzZEZCeWIzQnpLU0I3WEc0Z0lDQWdJQ0JwWmlBb1EyOXVjM1J5ZFdOMGIzSXVaMlYwUkdWbVlYVnNkRkJ5YjNCektTQjdYRzRnSUNBZ0lDQWdJRU52Ym5OMGNuVmpkRzl5TG1kbGRFUmxabUYxYkhSUWNtOXdjeUE5SUdOeVpXRjBaVTFsY21kbFpGSmxjM1ZzZEVaMWJtTjBhVzl1S0Z4dUlDQWdJQ0FnSUNBZ0lFTnZibk4wY25WamRHOXlMbWRsZEVSbFptRjFiSFJRY205d2N5eGNiaUFnSUNBZ0lDQWdJQ0JuWlhSRVpXWmhkV3gwVUhKdmNITmNiaUFnSUNBZ0lDQWdLVHRjYmlBZ0lDQWdJSDBnWld4elpTQjdYRzRnSUNBZ0lDQWdJRU52Ym5OMGNuVmpkRzl5TG1kbGRFUmxabUYxYkhSUWNtOXdjeUE5SUdkbGRFUmxabUYxYkhSUWNtOXdjenRjYmlBZ0lDQWdJSDFjYmlBZ0lDQjlMRnh1SUNBZ0lIQnliM0JVZVhCbGN6b2dablZ1WTNScGIyNG9RMjl1YzNSeWRXTjBiM0lzSUhCeWIzQlVlWEJsY3lrZ2UxeHVJQ0FnSUNBZ2FXWWdLSEJ5YjJObGMzTXVaVzUyTGs1UFJFVmZSVTVXSUNFOVBTQW5jSEp2WkhWamRHbHZiaWNwSUh0Y2JpQWdJQ0FnSUNBZ2RtRnNhV1JoZEdWVWVYQmxSR1ZtS0VOdmJuTjBjblZqZEc5eUxDQndjbTl3Vkhsd1pYTXNJQ2R3Y205d0p5azdYRzRnSUNBZ0lDQjlYRzRnSUNBZ0lDQkRiMjV6ZEhKMVkzUnZjaTV3Y205d1ZIbHdaWE1nUFNCZllYTnphV2R1S0h0OUxDQkRiMjV6ZEhKMVkzUnZjaTV3Y205d1ZIbHdaWE1zSUhCeWIzQlVlWEJsY3lrN1hHNGdJQ0FnZlN4Y2JpQWdJQ0J6ZEdGMGFXTnpPaUJtZFc1amRHbHZiaWhEYjI1emRISjFZM1J2Y2l3Z2MzUmhkR2xqY3lrZ2UxeHVJQ0FnSUNBZ2JXbDRVM1JoZEdsalUzQmxZMGx1ZEc5RGIyMXdiMjVsYm5Rb1EyOXVjM1J5ZFdOMGIzSXNJSE4wWVhScFkzTXBPMXh1SUNBZ0lIMHNYRzRnSUNBZ1lYVjBiMkpwYm1RNklHWjFibU4wYVc5dUtDa2dlMzFjYmlBZ2ZUdGNibHh1SUNCbWRXNWpkR2x2YmlCMllXeHBaR0YwWlZSNWNHVkVaV1lvUTI5dWMzUnlkV04wYjNJc0lIUjVjR1ZFWldZc0lHeHZZMkYwYVc5dUtTQjdYRzRnSUNBZ1ptOXlJQ2gyWVhJZ2NISnZjRTVoYldVZ2FXNGdkSGx3WlVSbFppa2dlMXh1SUNBZ0lDQWdhV1lnS0hSNWNHVkVaV1l1YUdGelQzZHVVSEp2Y0dWeWRIa29jSEp2Y0U1aGJXVXBLU0I3WEc0Z0lDQWdJQ0FnSUM4dklIVnpaU0JoSUhkaGNtNXBibWNnYVc1emRHVmhaQ0J2WmlCaGJpQmZhVzUyWVhKcFlXNTBJSE52SUdOdmJYQnZibVZ1ZEhOY2JpQWdJQ0FnSUNBZ0x5OGdaRzl1SjNRZ2MyaHZkeUIxY0NCcGJpQndjbTlrSUdKMWRDQnZibXg1SUdsdUlGOWZSRVZXWDE5Y2JpQWdJQ0FnSUNBZ2FXWWdLSEJ5YjJObGMzTXVaVzUyTGs1UFJFVmZSVTVXSUNFOVBTQW5jSEp2WkhWamRHbHZiaWNwSUh0Y2JpQWdJQ0FnSUNBZ0lDQjNZWEp1YVc1bktGeHVJQ0FnSUNBZ0lDQWdJQ0FnZEhsd1pXOW1JSFI1Y0dWRVpXWmJjSEp2Y0U1aGJXVmRJRDA5UFNBblpuVnVZM1JwYjI0bkxGeHVJQ0FnSUNBZ0lDQWdJQ0FnSnlWek9pQWxjeUIwZVhCbElHQWxjMkFnYVhNZ2FXNTJZV3hwWkRzZ2FYUWdiWFZ6ZENCaVpTQmhJR1oxYm1OMGFXOXVMQ0IxYzNWaGJHeDVJR1p5YjIwZ0p5QXJYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDZFNaV0ZqZEM1UWNtOXdWSGx3WlhNdUp5eGNiaUFnSUNBZ0lDQWdJQ0FnSUVOdmJuTjBjblZqZEc5eUxtUnBjM0JzWVhsT1lXMWxJSHg4SUNkU1pXRmpkRU5zWVhOekp5eGNiaUFnSUNBZ0lDQWdJQ0FnSUZKbFlXTjBVSEp2Y0ZSNWNHVk1iMk5oZEdsdmJrNWhiV1Z6VzJ4dlkyRjBhVzl1WFN4Y2JpQWdJQ0FnSUNBZ0lDQWdJSEJ5YjNCT1lXMWxYRzRnSUNBZ0lDQWdJQ0FnS1R0Y2JpQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ2ZWeHVJQ0FnSUgxY2JpQWdmVnh1WEc0Z0lHWjFibU4wYVc5dUlIWmhiR2xrWVhSbFRXVjBhRzlrVDNabGNuSnBaR1VvYVhOQmJISmxZV1I1UkdWbWFXNWxaQ3dnYm1GdFpTa2dlMXh1SUNBZ0lIWmhjaUJ6Y0dWalVHOXNhV041SUQwZ1VtVmhZM1JEYkdGemMwbHVkR1Z5Wm1GalpTNW9ZWE5QZDI1UWNtOXdaWEowZVNodVlXMWxLVnh1SUNBZ0lDQWdQeUJTWldGamRFTnNZWE56U1c1MFpYSm1ZV05sVzI1aGJXVmRYRzRnSUNBZ0lDQTZJRzUxYkd3N1hHNWNiaUFnSUNBdkx5QkVhWE5oYkd4dmR5QnZkbVZ5Y21sa2FXNW5JRzltSUdKaGMyVWdZMnhoYzNNZ2JXVjBhRzlrY3lCMWJteGxjM01nWlhod2JHbGphWFJzZVNCaGJHeHZkMlZrTGx4dUlDQWdJR2xtSUNoU1pXRmpkRU5zWVhOelRXbDRhVzR1YUdGelQzZHVVSEp2Y0dWeWRIa29ibUZ0WlNrcElIdGNiaUFnSUNBZ0lGOXBiblpoY21saGJuUW9YRzRnSUNBZ0lDQWdJSE53WldOUWIyeHBZM2tnUFQwOUlDZFBWa1ZTVWtsRVJWOUNRVk5GSnl4Y2JpQWdJQ0FnSUNBZ0oxSmxZV04wUTJ4aGMzTkpiblJsY21aaFkyVTZJRmx2ZFNCaGNtVWdZWFIwWlcxd2RHbHVaeUIwYnlCdmRtVnljbWxrWlNBbklDdGNiaUFnSUNBZ0lDQWdJQ0FuWUNWellDQm1jbTl0SUhsdmRYSWdZMnhoYzNNZ2MzQmxZMmxtYVdOaGRHbHZiaTRnUlc1emRYSmxJSFJvWVhRZ2VXOTFjaUJ0WlhSb2IyUWdibUZ0WlhNZ0p5QXJYRzRnSUNBZ0lDQWdJQ0FnSjJSdklHNXZkQ0J2ZG1WeWJHRndJSGRwZEdnZ1VtVmhZM1FnYldWMGFHOWtjeTRuTEZ4dUlDQWdJQ0FnSUNCdVlXMWxYRzRnSUNBZ0lDQXBPMXh1SUNBZ0lIMWNibHh1SUNBZ0lDOHZJRVJwYzJGc2JHOTNJR1JsWm1sdWFXNW5JRzFsZEdodlpITWdiVzl5WlNCMGFHRnVJRzl1WTJVZ2RXNXNaWE56SUdWNGNHeHBZMmwwYkhrZ1lXeHNiM2RsWkM1Y2JpQWdJQ0JwWmlBb2FYTkJiSEpsWVdSNVJHVm1hVzVsWkNrZ2UxeHVJQ0FnSUNBZ1gybHVkbUZ5YVdGdWRDaGNiaUFnSUNBZ0lDQWdjM0JsWTFCdmJHbGplU0E5UFQwZ0owUkZSa2xPUlY5TlFVNVpKeUI4ZkNCemNHVmpVRzlzYVdONUlEMDlQU0FuUkVWR1NVNUZYMDFCVGxsZlRVVlNSMFZFSnl4Y2JpQWdJQ0FnSUNBZ0oxSmxZV04wUTJ4aGMzTkpiblJsY21aaFkyVTZJRmx2ZFNCaGNtVWdZWFIwWlcxd2RHbHVaeUIwYnlCa1pXWnBibVVnSnlBclhHNGdJQ0FnSUNBZ0lDQWdKMkFsYzJBZ2IyNGdlVzkxY2lCamIyMXdiMjVsYm5RZ2JXOXlaU0IwYUdGdUlHOXVZMlV1SUZSb2FYTWdZMjl1Wm14cFkzUWdiV0Y1SUdKbElHUjFaU0FuSUN0Y2JpQWdJQ0FnSUNBZ0lDQW5kRzhnWVNCdGFYaHBiaTRuTEZ4dUlDQWdJQ0FnSUNCdVlXMWxYRzRnSUNBZ0lDQXBPMXh1SUNBZ0lIMWNiaUFnZlZ4dVhHNGdJQzhxS2x4dUlDQWdLaUJOYVhocGJpQm9aV3h3WlhJZ2QyaHBZMmdnYUdGdVpHeGxjeUJ3YjJ4cFkza2dkbUZzYVdSaGRHbHZiaUJoYm1RZ2NtVnpaWEoyWldSY2JpQWdJQ29nYzNCbFkybG1hV05oZEdsdmJpQnJaWGx6SUhkb1pXNGdZblZwYkdScGJtY2dVbVZoWTNRZ1kyeGhjM05sY3k1Y2JpQWdJQ292WEc0Z0lHWjFibU4wYVc5dUlHMXBlRk53WldOSmJuUnZRMjl0Y0c5dVpXNTBLRU52Ym5OMGNuVmpkRzl5TENCemNHVmpLU0I3WEc0Z0lDQWdhV1lnS0NGemNHVmpLU0I3WEc0Z0lDQWdJQ0JwWmlBb2NISnZZMlZ6Y3k1bGJuWXVUazlFUlY5RlRsWWdJVDA5SUNkd2NtOWtkV04wYVc5dUp5a2dlMXh1SUNBZ0lDQWdJQ0IyWVhJZ2RIbHdaVzltVTNCbFl5QTlJSFI1Y0dWdlppQnpjR1ZqTzF4dUlDQWdJQ0FnSUNCMllYSWdhWE5OYVhocGJsWmhiR2xrSUQwZ2RIbHdaVzltVTNCbFl5QTlQVDBnSjI5aWFtVmpkQ2NnSmlZZ2MzQmxZeUFoUFQwZ2JuVnNiRHRjYmx4dUlDQWdJQ0FnSUNCcFppQW9jSEp2WTJWemN5NWxibll1VGs5RVJWOUZUbFlnSVQwOUlDZHdjbTlrZFdOMGFXOXVKeWtnZTF4dUlDQWdJQ0FnSUNBZ0lIZGhjbTVwYm1jb1hHNGdJQ0FnSUNBZ0lDQWdJQ0JwYzAxcGVHbHVWbUZzYVdRc1hHNGdJQ0FnSUNBZ0lDQWdJQ0JjSWlWek9pQlpiM1VuY21VZ1lYUjBaVzF3ZEdsdVp5QjBieUJwYm1Oc2RXUmxJR0VnYldsNGFXNGdkR2hoZENCcGN5QmxhWFJvWlhJZ2JuVnNiQ0JjSWlBclhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNkdmNpQnViM1FnWVc0Z2IySnFaV04wTGlCRGFHVmpheUIwYUdVZ2JXbDRhVzV6SUdsdVkyeDFaR1ZrSUdKNUlIUm9aU0JqYjIxd2IyNWxiblFzSUNjZ0sxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBbllYTWdkMlZzYkNCaGN5QmhibmtnYldsNGFXNXpJSFJvWlhrZ2FXNWpiSFZrWlNCMGFHVnRjMlZzZG1WekxpQW5JQ3RjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdKMFY0Y0dWamRHVmtJRzlpYW1WamRDQmlkWFFnWjI5MElDVnpMaWNzWEc0Z0lDQWdJQ0FnSUNBZ0lDQkRiMjV6ZEhKMVkzUnZjaTVrYVhOd2JHRjVUbUZ0WlNCOGZDQW5VbVZoWTNSRGJHRnpjeWNzWEc0Z0lDQWdJQ0FnSUNBZ0lDQnpjR1ZqSUQwOVBTQnVkV3hzSUQ4Z2JuVnNiQ0E2SUhSNWNHVnZabE53WldOY2JpQWdJQ0FnSUNBZ0lDQXBPMXh1SUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0I5WEc1Y2JpQWdJQ0FnSUhKbGRIVnlianRjYmlBZ0lDQjlYRzVjYmlBZ0lDQmZhVzUyWVhKcFlXNTBLRnh1SUNBZ0lDQWdkSGx3Wlc5bUlITndaV01nSVQwOUlDZG1kVzVqZEdsdmJpY3NYRzRnSUNBZ0lDQmNJbEpsWVdOMFEyeGhjM002SUZsdmRTZHlaU0JoZEhSbGJYQjBhVzVuSUhSdklGd2lJQ3RjYmlBZ0lDQWdJQ0FnSjNWelpTQmhJR052YlhCdmJtVnVkQ0JqYkdGemN5QnZjaUJtZFc1amRHbHZiaUJoY3lCaElHMXBlR2x1TGlCSmJuTjBaV0ZrTENCcWRYTjBJSFZ6WlNCaElDY2dLMXh1SUNBZ0lDQWdJQ0FuY21WbmRXeGhjaUJ2WW1wbFkzUXVKMXh1SUNBZ0lDazdYRzRnSUNBZ1gybHVkbUZ5YVdGdWRDaGNiaUFnSUNBZ0lDRnBjMVpoYkdsa1JXeGxiV1Z1ZENoemNHVmpLU3hjYmlBZ0lDQWdJRndpVW1WaFkzUkRiR0Z6Y3pvZ1dXOTFKM0psSUdGMGRHVnRjSFJwYm1jZ2RHOGdYQ0lnSzF4dUlDQWdJQ0FnSUNBbmRYTmxJR0VnWTI5dGNHOXVaVzUwSUdGeklHRWdiV2w0YVc0dUlFbHVjM1JsWVdRc0lHcDFjM1FnZFhObElHRWdjbVZuZFd4aGNpQnZZbXBsWTNRdUoxeHVJQ0FnSUNrN1hHNWNiaUFnSUNCMllYSWdjSEp2ZEc4Z1BTQkRiMjV6ZEhKMVkzUnZjaTV3Y205MGIzUjVjR1U3WEc0Z0lDQWdkbUZ5SUdGMWRHOUNhVzVrVUdGcGNuTWdQU0J3Y205MGJ5NWZYM0psWVdOMFFYVjBiMEpwYm1SUVlXbHljenRjYmx4dUlDQWdJQzh2SUVKNUlHaGhibVJzYVc1bklHMXBlR2x1Y3lCaVpXWnZjbVVnWVc1NUlHOTBhR1Z5SUhCeWIzQmxjblJwWlhNc0lIZGxJR1Z1YzNWeVpTQjBhR1VnYzJGdFpWeHVJQ0FnSUM4dklHTm9ZV2x1YVc1bklHOXlaR1Z5SUdseklHRndjR3hwWldRZ2RHOGdiV1YwYUc5a2N5QjNhWFJvSUVSRlJrbE9SVjlOUVU1WklIQnZiR2xqZVN3Z2QyaGxkR2hsY2x4dUlDQWdJQzh2SUcxcGVHbHVjeUJoY21VZ2JHbHpkR1ZrSUdKbFptOXlaU0J2Y2lCaFpuUmxjaUIwYUdWelpTQnRaWFJvYjJSeklHbHVJSFJvWlNCemNHVmpMbHh1SUNBZ0lHbG1JQ2h6Y0dWakxtaGhjMDkzYmxCeWIzQmxjblI1S0UxSldFbE9VMTlMUlZrcEtTQjdYRzRnSUNBZ0lDQlNSVk5GVWxaRlJGOVRVRVZEWDB0RldWTXViV2w0YVc1ektFTnZibk4wY25WamRHOXlMQ0J6Y0dWakxtMXBlR2x1Y3lrN1hHNGdJQ0FnZlZ4dVhHNGdJQ0FnWm05eUlDaDJZWElnYm1GdFpTQnBiaUJ6Y0dWaktTQjdYRzRnSUNBZ0lDQnBaaUFvSVhOd1pXTXVhR0Z6VDNkdVVISnZjR1Z5ZEhrb2JtRnRaU2twSUh0Y2JpQWdJQ0FnSUNBZ1kyOXVkR2x1ZFdVN1hHNGdJQ0FnSUNCOVhHNWNiaUFnSUNBZ0lHbG1JQ2h1WVcxbElEMDlQU0JOU1ZoSlRsTmZTMFZaS1NCN1hHNGdJQ0FnSUNBZ0lDOHZJRmRsSUdoaGRtVWdZV3h5WldGa2VTQm9ZVzVrYkdWa0lHMXBlR2x1Y3lCcGJpQmhJSE53WldOcFlXd2dZMkZ6WlNCaFltOTJaUzVjYmlBZ0lDQWdJQ0FnWTI5dWRHbHVkV1U3WEc0Z0lDQWdJQ0I5WEc1Y2JpQWdJQ0FnSUhaaGNpQndjbTl3WlhKMGVTQTlJSE53WldOYmJtRnRaVjA3WEc0Z0lDQWdJQ0IyWVhJZ2FYTkJiSEpsWVdSNVJHVm1hVzVsWkNBOUlIQnliM1J2TG1oaGMwOTNibEJ5YjNCbGNuUjVLRzVoYldVcE8xeHVJQ0FnSUNBZ2RtRnNhV1JoZEdWTlpYUm9iMlJQZG1WeWNtbGtaU2hwYzBGc2NtVmhaSGxFWldacGJtVmtMQ0J1WVcxbEtUdGNibHh1SUNBZ0lDQWdhV1lnS0ZKRlUwVlNWa1ZFWDFOUVJVTmZTMFZaVXk1b1lYTlBkMjVRY205d1pYSjBlU2h1WVcxbEtTa2dlMXh1SUNBZ0lDQWdJQ0JTUlZORlVsWkZSRjlUVUVWRFgwdEZXVk5iYm1GdFpWMG9RMjl1YzNSeWRXTjBiM0lzSUhCeWIzQmxjblI1S1R0Y2JpQWdJQ0FnSUgwZ1pXeHpaU0I3WEc0Z0lDQWdJQ0FnSUM4dklGTmxkSFZ3SUcxbGRHaHZaSE1nYjI0Z2NISnZkRzkwZVhCbE9seHVJQ0FnSUNBZ0lDQXZMeUJVYUdVZ1ptOXNiRzkzYVc1bklHMWxiV0psY2lCdFpYUm9iMlJ6SUhOb2IzVnNaQ0J1YjNRZ1ltVWdZWFYwYjIxaGRHbGpZV3hzZVNCaWIzVnVaRHBjYmlBZ0lDQWdJQ0FnTHk4Z01TNGdSWGh3WldOMFpXUWdVbVZoWTNSRGJHRnpjeUJ0WlhSb2IyUnpJQ2hwYmlCMGFHVWdYQ0pwYm5SbGNtWmhZMlZjSWlrdVhHNGdJQ0FnSUNBZ0lDOHZJREl1SUU5MlpYSnlhV1JrWlc0Z2JXVjBhRzlrY3lBb2RHaGhkQ0IzWlhKbElHMXBlR1ZrSUdsdUtTNWNiaUFnSUNBZ0lDQWdkbUZ5SUdselVtVmhZM1JEYkdGemMwMWxkR2h2WkNBOUlGSmxZV04wUTJ4aGMzTkpiblJsY21aaFkyVXVhR0Z6VDNkdVVISnZjR1Z5ZEhrb2JtRnRaU2s3WEc0Z0lDQWdJQ0FnSUhaaGNpQnBjMFoxYm1OMGFXOXVJRDBnZEhsd1pXOW1JSEJ5YjNCbGNuUjVJRDA5UFNBblpuVnVZM1JwYjI0bk8xeHVJQ0FnSUNBZ0lDQjJZWElnYzJodmRXeGtRWFYwYjBKcGJtUWdQVnh1SUNBZ0lDQWdJQ0FnSUdselJuVnVZM1JwYjI0Z0ppWmNiaUFnSUNBZ0lDQWdJQ0FoYVhOU1pXRmpkRU5zWVhOelRXVjBhRzlrSUNZbVhHNGdJQ0FnSUNBZ0lDQWdJV2x6UVd4eVpXRmtlVVJsWm1sdVpXUWdKaVpjYmlBZ0lDQWdJQ0FnSUNCemNHVmpMbUYxZEc5aWFXNWtJQ0U5UFNCbVlXeHpaVHRjYmx4dUlDQWdJQ0FnSUNCcFppQW9jMmh2ZFd4a1FYVjBiMEpwYm1RcElIdGNiaUFnSUNBZ0lDQWdJQ0JoZFhSdlFtbHVaRkJoYVhKekxuQjFjMmdvYm1GdFpTd2djSEp2Y0dWeWRIa3BPMXh1SUNBZ0lDQWdJQ0FnSUhCeWIzUnZXMjVoYldWZElEMGdjSEp2Y0dWeWRIazdYRzRnSUNBZ0lDQWdJSDBnWld4elpTQjdYRzRnSUNBZ0lDQWdJQ0FnYVdZZ0tHbHpRV3h5WldGa2VVUmxabWx1WldRcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUhaaGNpQnpjR1ZqVUc5c2FXTjVJRDBnVW1WaFkzUkRiR0Z6YzBsdWRHVnlabUZqWlZ0dVlXMWxYVHRjYmx4dUlDQWdJQ0FnSUNBZ0lDQWdMeThnVkdobGMyVWdZMkZ6WlhNZ2MyaHZkV3hrSUdGc2NtVmhaSGtnWW1VZ1kyRjFaMmgwSUdKNUlIWmhiR2xrWVhSbFRXVjBhRzlrVDNabGNuSnBaR1V1WEc0Z0lDQWdJQ0FnSUNBZ0lDQmZhVzUyWVhKcFlXNTBLRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQnBjMUpsWVdOMFEyeGhjM05OWlhSb2IyUWdKaVpjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FvYzNCbFkxQnZiR2xqZVNBOVBUMGdKMFJGUmtsT1JWOU5RVTVaWDAxRlVrZEZSQ2NnZkh4Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lITndaV05RYjJ4cFkza2dQVDA5SUNkRVJVWkpUa1ZmVFVGT1dTY3BMRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQW5VbVZoWTNSRGJHRnpjem9nVlc1bGVIQmxZM1JsWkNCemNHVmpJSEJ2YkdsamVTQWxjeUJtYjNJZ2EyVjVJQ1Z6SUNjZ0sxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDZDNhR1Z1SUcxcGVHbHVaeUJwYmlCamIyMXdiMjVsYm5RZ2MzQmxZM011Snl4Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnYzNCbFkxQnZiR2xqZVN4Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnYm1GdFpWeHVJQ0FnSUNBZ0lDQWdJQ0FnS1R0Y2JseHVJQ0FnSUNBZ0lDQWdJQ0FnTHk4Z1JtOXlJRzFsZEdodlpITWdkMmhwWTJnZ1lYSmxJR1JsWm1sdVpXUWdiVzl5WlNCMGFHRnVJRzl1WTJVc0lHTmhiR3dnZEdobElHVjRhWE4wYVc1blhHNGdJQ0FnSUNBZ0lDQWdJQ0F2THlCdFpYUm9iMlJ6SUdKbFptOXlaU0JqWVd4c2FXNW5JSFJvWlNCdVpYY2djSEp2Y0dWeWRIa3NJRzFsY21kcGJtY2dhV1lnWVhCd2NtOXdjbWxoZEdVdVhHNGdJQ0FnSUNBZ0lDQWdJQ0JwWmlBb2MzQmxZMUJ2YkdsamVTQTlQVDBnSjBSRlJrbE9SVjlOUVU1WlgwMUZVa2RGUkNjcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ2NISnZkRzliYm1GdFpWMGdQU0JqY21WaGRHVk5aWEpuWldSU1pYTjFiSFJHZFc1amRHbHZiaWh3Y205MGIxdHVZVzFsWFN3Z2NISnZjR1Z5ZEhrcE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnZlNCbGJITmxJR2xtSUNoemNHVmpVRzlzYVdONUlEMDlQU0FuUkVWR1NVNUZYMDFCVGxrbktTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lIQnliM1J2VzI1aGJXVmRJRDBnWTNKbFlYUmxRMmhoYVc1bFpFWjFibU4wYVc5dUtIQnliM1J2VzI1aGJXVmRMQ0J3Y205d1pYSjBlU2s3WEc0Z0lDQWdJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJQ0FnZlNCbGJITmxJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lIQnliM1J2VzI1aGJXVmRJRDBnY0hKdmNHVnlkSGs3WEc0Z0lDQWdJQ0FnSUNBZ0lDQnBaaUFvY0hKdlkyVnpjeTVsYm5ZdVRrOUVSVjlGVGxZZ0lUMDlJQ2R3Y205a2RXTjBhVzl1SnlrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBdkx5QkJaR1FnZG1WeVltOXpaU0JrYVhOd2JHRjVUbUZ0WlNCMGJ5QjBhR1VnWm5WdVkzUnBiMjRzSUhkb2FXTm9JR2hsYkhCeklIZG9aVzRnYkc5dmEybHVaMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQXZMeUJoZENCd2NtOW1hV3hwYm1jZ2RHOXZiSE11WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJR2xtSUNoMGVYQmxiMllnY0hKdmNHVnlkSGtnUFQwOUlDZG1kVzVqZEdsdmJpY2dKaVlnYzNCbFl5NWthWE53YkdGNVRtRnRaU2tnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhCeWIzUnZXMjVoYldWZExtUnBjM0JzWVhsT1lXMWxJRDBnYzNCbFl5NWthWE53YkdGNVRtRnRaU0FySUNkZkp5QXJJRzVoYldVN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lIMWNiaUFnSUNCOVhHNGdJSDFjYmx4dUlDQm1kVzVqZEdsdmJpQnRhWGhUZEdGMGFXTlRjR1ZqU1c1MGIwTnZiWEJ2Ym1WdWRDaERiMjV6ZEhKMVkzUnZjaXdnYzNSaGRHbGpjeWtnZTF4dUlDQWdJR2xtSUNnaGMzUmhkR2xqY3lrZ2UxeHVJQ0FnSUNBZ2NtVjBkWEp1TzF4dUlDQWdJSDFjYmlBZ0lDQm1iM0lnS0haaGNpQnVZVzFsSUdsdUlITjBZWFJwWTNNcElIdGNiaUFnSUNBZ0lIWmhjaUJ3Y205d1pYSjBlU0E5SUhOMFlYUnBZM05iYm1GdFpWMDdYRzRnSUNBZ0lDQnBaaUFvSVhOMFlYUnBZM011YUdGelQzZHVVSEp2Y0dWeWRIa29ibUZ0WlNrcElIdGNiaUFnSUNBZ0lDQWdZMjl1ZEdsdWRXVTdYRzRnSUNBZ0lDQjlYRzVjYmlBZ0lDQWdJSFpoY2lCcGMxSmxjMlZ5ZG1Wa0lEMGdibUZ0WlNCcGJpQlNSVk5GVWxaRlJGOVRVRVZEWDB0RldWTTdYRzRnSUNBZ0lDQmZhVzUyWVhKcFlXNTBLRnh1SUNBZ0lDQWdJQ0FoYVhOU1pYTmxjblpsWkN4Y2JpQWdJQ0FnSUNBZ0oxSmxZV04wUTJ4aGMzTTZJRmx2ZFNCaGNtVWdZWFIwWlcxd2RHbHVaeUIwYnlCa1pXWnBibVVnWVNCeVpYTmxjblpsWkNBbklDdGNiaUFnSUNBZ0lDQWdJQ0FuY0hKdmNHVnlkSGtzSUdBbGMyQXNJSFJvWVhRZ2MyaHZkV3hrYmx4Y0ozUWdZbVVnYjI0Z2RHaGxJRndpYzNSaGRHbGpjMXdpSUd0bGVTNGdSR1ZtYVc1bElHbDBJQ2NnSzF4dUlDQWdJQ0FnSUNBZ0lDZGhjeUJoYmlCcGJuTjBZVzVqWlNCd2NtOXdaWEowZVNCcGJuTjBaV0ZrT3lCcGRDQjNhV3hzSUhOMGFXeHNJR0psSUdGalkyVnpjMmxpYkdVZ2IyNGdkR2hsSUNjZ0sxeHVJQ0FnSUNBZ0lDQWdJQ2RqYjI1emRISjFZM1J2Y2k0bkxGeHVJQ0FnSUNBZ0lDQnVZVzFsWEc0Z0lDQWdJQ0FwTzF4dVhHNGdJQ0FnSUNCMllYSWdhWE5KYm1obGNtbDBaV1FnUFNCdVlXMWxJR2x1SUVOdmJuTjBjblZqZEc5eU8xeHVJQ0FnSUNBZ1gybHVkbUZ5YVdGdWRDaGNiaUFnSUNBZ0lDQWdJV2x6U1c1b1pYSnBkR1ZrTEZ4dUlDQWdJQ0FnSUNBblVtVmhZM1JEYkdGemN6b2dXVzkxSUdGeVpTQmhkSFJsYlhCMGFXNW5JSFJ2SUdSbFptbHVaU0FuSUN0Y2JpQWdJQ0FnSUNBZ0lDQW5ZQ1Z6WUNCdmJpQjViM1Z5SUdOdmJYQnZibVZ1ZENCdGIzSmxJSFJvWVc0Z2IyNWpaUzRnVkdocGN5QmpiMjVtYkdsamRDQnRZWGtnWW1VZ0p5QXJYRzRnSUNBZ0lDQWdJQ0FnSjJSMVpTQjBieUJoSUcxcGVHbHVMaWNzWEc0Z0lDQWdJQ0FnSUc1aGJXVmNiaUFnSUNBZ0lDazdYRzRnSUNBZ0lDQkRiMjV6ZEhKMVkzUnZjbHR1WVcxbFhTQTlJSEJ5YjNCbGNuUjVPMXh1SUNBZ0lIMWNiaUFnZlZ4dVhHNGdJQzhxS2x4dUlDQWdLaUJOWlhKblpTQjBkMjhnYjJKcVpXTjBjeXdnWW5WMElIUm9jbTkzSUdsbUlHSnZkR2dnWTI5dWRHRnBiaUIwYUdVZ2MyRnRaU0JyWlhrdVhHNGdJQ0FxWEc0Z0lDQXFJRUJ3WVhKaGJTQjdiMkpxWldOMGZTQnZibVVnVkdobElHWnBjbk4wSUc5aWFtVmpkQ3dnZDJocFkyZ2dhWE1nYlhWMFlYUmxaQzVjYmlBZ0lDb2dRSEJoY21GdElIdHZZbXBsWTNSOUlIUjNieUJVYUdVZ2MyVmpiMjVrSUc5aWFtVmpkRnh1SUNBZ0tpQkFjbVYwZFhKdUlIdHZZbXBsWTNSOUlHOXVaU0JoWm5SbGNpQnBkQ0JvWVhNZ1ltVmxiaUJ0ZFhSaGRHVmtJSFJ2SUdOdmJuUmhhVzRnWlhabGNubDBhR2x1WnlCcGJpQjBkMjh1WEc0Z0lDQXFMMXh1SUNCbWRXNWpkR2x2YmlCdFpYSm5aVWx1ZEc5WGFYUm9UbTlFZFhCc2FXTmhkR1ZMWlhsektHOXVaU3dnZEhkdktTQjdYRzRnSUNBZ1gybHVkbUZ5YVdGdWRDaGNiaUFnSUNBZ0lHOXVaU0FtSmlCMGQyOGdKaVlnZEhsd1pXOW1JRzl1WlNBOVBUMGdKMjlpYW1WamRDY2dKaVlnZEhsd1pXOW1JSFIzYnlBOVBUMGdKMjlpYW1WamRDY3NYRzRnSUNBZ0lDQW5iV1Z5WjJWSmJuUnZWMmwwYUU1dlJIVndiR2xqWVhSbFMyVjVjeWdwT2lCRFlXNXViM1FnYldWeVoyVWdibTl1TFc5aWFtVmpkSE11SjF4dUlDQWdJQ2s3WEc1Y2JpQWdJQ0JtYjNJZ0tIWmhjaUJyWlhrZ2FXNGdkSGR2S1NCN1hHNGdJQ0FnSUNCcFppQW9kSGR2TG1oaGMwOTNibEJ5YjNCbGNuUjVLR3RsZVNrcElIdGNiaUFnSUNBZ0lDQWdYMmx1ZG1GeWFXRnVkQ2hjYmlBZ0lDQWdJQ0FnSUNCdmJtVmJhMlY1WFNBOVBUMGdkVzVrWldacGJtVmtMRnh1SUNBZ0lDQWdJQ0FnSUNkdFpYSm5aVWx1ZEc5WGFYUm9UbTlFZFhCc2FXTmhkR1ZMWlhsektDazZJQ2NnSzF4dUlDQWdJQ0FnSUNBZ0lDQWdKMVJ5YVdWa0lIUnZJRzFsY21kbElIUjNieUJ2WW1wbFkzUnpJSGRwZEdnZ2RHaGxJSE5oYldVZ2EyVjVPaUJnSlhOZ0xpQlVhR2x6SUdOdmJtWnNhV04wSUNjZ0sxeHVJQ0FnSUNBZ0lDQWdJQ0FnSjIxaGVTQmlaU0JrZFdVZ2RHOGdZU0J0YVhocGJqc2dhVzRnY0dGeWRHbGpkV3hoY2l3Z2RHaHBjeUJ0WVhrZ1ltVWdZMkYxYzJWa0lHSjVJSFIzYnlBbklDdGNiaUFnSUNBZ0lDQWdJQ0FnSUNkblpYUkpibWwwYVdGc1UzUmhkR1VvS1NCdmNpQm5aWFJFWldaaGRXeDBVSEp2Y0hNb0tTQnRaWFJvYjJSeklISmxkSFZ5Ym1sdVp5QnZZbXBsWTNSeklDY2dLMXh1SUNBZ0lDQWdJQ0FnSUNBZ0ozZHBkR2dnWTJ4aGMyaHBibWNnYTJWNWN5NG5MRnh1SUNBZ0lDQWdJQ0FnSUd0bGVWeHVJQ0FnSUNBZ0lDQXBPMXh1SUNBZ0lDQWdJQ0J2Ym1WYmEyVjVYU0E5SUhSM2IxdHJaWGxkTzF4dUlDQWdJQ0FnZlZ4dUlDQWdJSDFjYmlBZ0lDQnlaWFIxY200Z2IyNWxPMXh1SUNCOVhHNWNiaUFnTHlvcVhHNGdJQ0FxSUVOeVpXRjBaWE1nWVNCbWRXNWpkR2x2YmlCMGFHRjBJR2x1ZG05clpYTWdkSGR2SUdaMWJtTjBhVzl1Y3lCaGJtUWdiV1Z5WjJWeklIUm9aV2x5SUhKbGRIVnliaUIyWVd4MVpYTXVYRzRnSUNBcVhHNGdJQ0FxSUVCd1lYSmhiU0I3Wm5WdVkzUnBiMjU5SUc5dVpTQkdkVzVqZEdsdmJpQjBieUJwYm5admEyVWdabWx5YzNRdVhHNGdJQ0FxSUVCd1lYSmhiU0I3Wm5WdVkzUnBiMjU5SUhSM2J5QkdkVzVqZEdsdmJpQjBieUJwYm5admEyVWdjMlZqYjI1a0xseHVJQ0FnS2lCQWNtVjBkWEp1SUh0bWRXNWpkR2x2Ym4wZ1JuVnVZM1JwYjI0Z2RHaGhkQ0JwYm5admEyVnpJSFJvWlNCMGQyOGdZWEpuZFcxbGJuUWdablZ1WTNScGIyNXpMbHh1SUNBZ0tpQkFjSEpwZG1GMFpWeHVJQ0FnS2k5Y2JpQWdablZ1WTNScGIyNGdZM0psWVhSbFRXVnlaMlZrVW1WemRXeDBSblZ1WTNScGIyNG9iMjVsTENCMGQyOHBJSHRjYmlBZ0lDQnlaWFIxY200Z1puVnVZM1JwYjI0Z2JXVnlaMlZrVW1WemRXeDBLQ2tnZTF4dUlDQWdJQ0FnZG1GeUlHRWdQU0J2Ym1VdVlYQndiSGtvZEdocGN5d2dZWEpuZFcxbGJuUnpLVHRjYmlBZ0lDQWdJSFpoY2lCaUlEMGdkSGR2TG1Gd2NHeDVLSFJvYVhNc0lHRnlaM1Z0Wlc1MGN5azdYRzRnSUNBZ0lDQnBaaUFvWVNBOVBTQnVkV3hzS1NCN1hHNGdJQ0FnSUNBZ0lISmxkSFZ5YmlCaU8xeHVJQ0FnSUNBZ2ZTQmxiSE5sSUdsbUlDaGlJRDA5SUc1MWJHd3BJSHRjYmlBZ0lDQWdJQ0FnY21WMGRYSnVJR0U3WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdJQ0IyWVhJZ1l5QTlJSHQ5TzF4dUlDQWdJQ0FnYldWeVoyVkpiblJ2VjJsMGFFNXZSSFZ3YkdsallYUmxTMlY1Y3loakxDQmhLVHRjYmlBZ0lDQWdJRzFsY21kbFNXNTBiMWRwZEdoT2IwUjFjR3hwWTJGMFpVdGxlWE1vWXl3Z1lpazdYRzRnSUNBZ0lDQnlaWFIxY200Z1l6dGNiaUFnSUNCOU8xeHVJQ0I5WEc1Y2JpQWdMeW9xWEc0Z0lDQXFJRU55WldGMFpYTWdZU0JtZFc1amRHbHZiaUIwYUdGMElHbHVkbTlyWlhNZ2RIZHZJR1oxYm1OMGFXOXVjeUJoYm1RZ2FXZHViM0psY3lCMGFHVnBjaUJ5WlhSMWNtNGdkbUZzWlhNdVhHNGdJQ0FxWEc0Z0lDQXFJRUJ3WVhKaGJTQjdablZ1WTNScGIyNTlJRzl1WlNCR2RXNWpkR2x2YmlCMGJ5QnBiblp2YTJVZ1ptbHljM1F1WEc0Z0lDQXFJRUJ3WVhKaGJTQjdablZ1WTNScGIyNTlJSFIzYnlCR2RXNWpkR2x2YmlCMGJ5QnBiblp2YTJVZ2MyVmpiMjVrTGx4dUlDQWdLaUJBY21WMGRYSnVJSHRtZFc1amRHbHZibjBnUm5WdVkzUnBiMjRnZEdoaGRDQnBiblp2YTJWeklIUm9aU0IwZDI4Z1lYSm5kVzFsYm5RZ1puVnVZM1JwYjI1ekxseHVJQ0FnS2lCQWNISnBkbUYwWlZ4dUlDQWdLaTljYmlBZ1puVnVZM1JwYjI0Z1kzSmxZWFJsUTJoaGFXNWxaRVoxYm1OMGFXOXVLRzl1WlN3Z2RIZHZLU0I3WEc0Z0lDQWdjbVYwZFhKdUlHWjFibU4wYVc5dUlHTm9ZV2x1WldSR2RXNWpkR2x2YmlncElIdGNiaUFnSUNBZ0lHOXVaUzVoY0hCc2VTaDBhR2x6TENCaGNtZDFiV1Z1ZEhNcE8xeHVJQ0FnSUNBZ2RIZHZMbUZ3Y0d4NUtIUm9hWE1zSUdGeVozVnRaVzUwY3lrN1hHNGdJQ0FnZlR0Y2JpQWdmVnh1WEc0Z0lDOHFLbHh1SUNBZ0tpQkNhVzVrY3lCaElHMWxkR2h2WkNCMGJ5QjBhR1VnWTI5dGNHOXVaVzUwTGx4dUlDQWdLbHh1SUNBZ0tpQkFjR0Z5WVcwZ2UyOWlhbVZqZEgwZ1kyOXRjRzl1Wlc1MElFTnZiWEJ2Ym1WdWRDQjNhRzl6WlNCdFpYUm9iMlFnYVhNZ1oyOXBibWNnZEc4Z1ltVWdZbTkxYm1RdVhHNGdJQ0FxSUVCd1lYSmhiU0I3Wm5WdVkzUnBiMjU5SUcxbGRHaHZaQ0JOWlhSb2IyUWdkRzhnWW1VZ1ltOTFibVF1WEc0Z0lDQXFJRUJ5WlhSMWNtNGdlMloxYm1OMGFXOXVmU0JVYUdVZ1ltOTFibVFnYldWMGFHOWtMbHh1SUNBZ0tpOWNiaUFnWm5WdVkzUnBiMjRnWW1sdVpFRjFkRzlDYVc1a1RXVjBhRzlrS0dOdmJYQnZibVZ1ZEN3Z2JXVjBhRzlrS1NCN1hHNGdJQ0FnZG1GeUlHSnZkVzVrVFdWMGFHOWtJRDBnYldWMGFHOWtMbUpwYm1Rb1kyOXRjRzl1Wlc1MEtUdGNiaUFnSUNCcFppQW9jSEp2WTJWemN5NWxibll1VGs5RVJWOUZUbFlnSVQwOUlDZHdjbTlrZFdOMGFXOXVKeWtnZTF4dUlDQWdJQ0FnWW05MWJtUk5aWFJvYjJRdVgxOXlaV0ZqZEVKdmRXNWtRMjl1ZEdWNGRDQTlJR052YlhCdmJtVnVkRHRjYmlBZ0lDQWdJR0p2ZFc1a1RXVjBhRzlrTGw5ZmNtVmhZM1JDYjNWdVpFMWxkR2h2WkNBOUlHMWxkR2h2WkR0Y2JpQWdJQ0FnSUdKdmRXNWtUV1YwYUc5a0xsOWZjbVZoWTNSQ2IzVnVaRUZ5WjNWdFpXNTBjeUE5SUc1MWJHdzdYRzRnSUNBZ0lDQjJZWElnWTI5dGNHOXVaVzUwVG1GdFpTQTlJR052YlhCdmJtVnVkQzVqYjI1emRISjFZM1J2Y2k1a2FYTndiR0Y1VG1GdFpUdGNiaUFnSUNBZ0lIWmhjaUJmWW1sdVpDQTlJR0p2ZFc1a1RXVjBhRzlrTG1KcGJtUTdYRzRnSUNBZ0lDQmliM1Z1WkUxbGRHaHZaQzVpYVc1a0lEMGdablZ1WTNScGIyNG9ibVYzVkdocGN5a2dlMXh1SUNBZ0lDQWdJQ0JtYjNJZ0tGeHVJQ0FnSUNBZ0lDQWdJSFpoY2lCZmJHVnVJRDBnWVhKbmRXMWxiblJ6TG14bGJtZDBhQ3hjYmlBZ0lDQWdJQ0FnSUNBZ0lHRnlaM01nUFNCQmNuSmhlU2hmYkdWdUlENGdNU0EvSUY5c1pXNGdMU0F4SURvZ01Da3NYRzRnSUNBZ0lDQWdJQ0FnSUNCZmEyVjVJRDBnTVR0Y2JpQWdJQ0FnSUNBZ0lDQmZhMlY1SUR3Z1gyeGxianRjYmlBZ0lDQWdJQ0FnSUNCZmEyVjVLeXRjYmlBZ0lDQWdJQ0FnS1NCN1hHNGdJQ0FnSUNBZ0lDQWdZWEpuYzF0ZmEyVjVJQzBnTVYwZ1BTQmhjbWQxYldWdWRITmJYMnRsZVYwN1hHNGdJQ0FnSUNBZ0lIMWNibHh1SUNBZ0lDQWdJQ0F2THlCVmMyVnlJR2x6SUhSeWVXbHVaeUIwYnlCaWFXNWtLQ2tnWVc0Z1lYVjBiMkp2ZFc1a0lHMWxkR2h2WkRzZ2QyVWdaV1ptWldOMGFYWmxiSGtnZDJsc2JGeHVJQ0FnSUNBZ0lDQXZMeUJwWjI1dmNtVWdkR2hsSUhaaGJIVmxJRzltSUZ3aWRHaHBjMXdpSUhSb1lYUWdkR2hsSUhWelpYSWdhWE1nZEhKNWFXNW5JSFJ2SUhWelpTd2djMjljYmlBZ0lDQWdJQ0FnTHk4Z2JHVjBKM01nZDJGeWJpNWNiaUFnSUNBZ0lDQWdhV1lnS0c1bGQxUm9hWE1nSVQwOUlHTnZiWEJ2Ym1WdWRDQW1KaUJ1WlhkVWFHbHpJQ0U5UFNCdWRXeHNLU0I3WEc0Z0lDQWdJQ0FnSUNBZ2FXWWdLSEJ5YjJObGMzTXVaVzUyTGs1UFJFVmZSVTVXSUNFOVBTQW5jSEp2WkhWamRHbHZiaWNwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJSGRoY201cGJtY29YRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lHWmhiSE5sTEZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FuWW1sdVpDZ3BPaUJTWldGamRDQmpiMjF3YjI1bGJuUWdiV1YwYUc5a2N5QnRZWGtnYjI1c2VTQmlaU0JpYjNWdVpDQjBieUIwYUdVZ0p5QXJYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdKMk52YlhCdmJtVnVkQ0JwYm5OMFlXNWpaUzRnVTJWbElDVnpKeXhjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdZMjl0Y0c5dVpXNTBUbUZ0WlZ4dUlDQWdJQ0FnSUNBZ0lDQWdLVHRjYmlBZ0lDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lIMGdaV3h6WlNCcFppQW9JV0Z5WjNNdWJHVnVaM1JvS1NCN1hHNGdJQ0FnSUNBZ0lDQWdhV1lnS0hCeWIyTmxjM011Wlc1MkxrNVBSRVZmUlU1V0lDRTlQU0FuY0hKdlpIVmpkR2x2YmljcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUhkaGNtNXBibWNvWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJR1poYkhObExGeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBblltbHVaQ2dwT2lCWmIzVWdZWEpsSUdKcGJtUnBibWNnWVNCamIyMXdiMjVsYm5RZ2JXVjBhRzlrSUhSdklIUm9aU0JqYjIxd2IyNWxiblF1SUNjZ0sxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDZFNaV0ZqZENCa2IyVnpJSFJvYVhNZ1ptOXlJSGx2ZFNCaGRYUnZiV0YwYVdOaGJHeDVJR2x1SUdFZ2FHbG5hQzF3WlhKbWIzSnRZVzVqWlNBbklDdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQW5kMkY1TENCemJ5QjViM1VnWTJGdUlITmhabVZzZVNCeVpXMXZkbVVnZEdocGN5QmpZV3hzTGlCVFpXVWdKWE1uTEZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0JqYjIxd2IyNWxiblJPWVcxbFhHNGdJQ0FnSUNBZ0lDQWdJQ0FwTzF4dUlDQWdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdZbTkxYm1STlpYUm9iMlE3WEc0Z0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ2RtRnlJSEpsWW05MWJtUk5aWFJvYjJRZ1BTQmZZbWx1WkM1aGNIQnNlU2hpYjNWdVpFMWxkR2h2WkN3Z1lYSm5kVzFsYm5SektUdGNiaUFnSUNBZ0lDQWdjbVZpYjNWdVpFMWxkR2h2WkM1ZlgzSmxZV04wUW05MWJtUkRiMjUwWlhoMElEMGdZMjl0Y0c5dVpXNTBPMXh1SUNBZ0lDQWdJQ0J5WldKdmRXNWtUV1YwYUc5a0xsOWZjbVZoWTNSQ2IzVnVaRTFsZEdodlpDQTlJRzFsZEdodlpEdGNiaUFnSUNBZ0lDQWdjbVZpYjNWdVpFMWxkR2h2WkM1ZlgzSmxZV04wUW05MWJtUkJjbWQxYldWdWRITWdQU0JoY21kek8xeHVJQ0FnSUNBZ0lDQnlaWFIxY200Z2NtVmliM1Z1WkUxbGRHaHZaRHRjYmlBZ0lDQWdJSDA3WEc0Z0lDQWdmVnh1SUNBZ0lISmxkSFZ5YmlCaWIzVnVaRTFsZEdodlpEdGNiaUFnZlZ4dVhHNGdJQzhxS2x4dUlDQWdLaUJDYVc1a2N5QmhiR3dnWVhWMGJ5MWliM1Z1WkNCdFpYUm9iMlJ6SUdsdUlHRWdZMjl0Y0c5dVpXNTBMbHh1SUNBZ0tseHVJQ0FnS2lCQWNHRnlZVzBnZTI5aWFtVmpkSDBnWTI5dGNHOXVaVzUwSUVOdmJYQnZibVZ1ZENCM2FHOXpaU0J0WlhSb2IyUWdhWE1nWjI5cGJtY2dkRzhnWW1VZ1ltOTFibVF1WEc0Z0lDQXFMMXh1SUNCbWRXNWpkR2x2YmlCaWFXNWtRWFYwYjBKcGJtUk5aWFJvYjJSektHTnZiWEJ2Ym1WdWRDa2dlMXh1SUNBZ0lIWmhjaUJ3WVdseWN5QTlJR052YlhCdmJtVnVkQzVmWDNKbFlXTjBRWFYwYjBKcGJtUlFZV2x5Y3p0Y2JpQWdJQ0JtYjNJZ0tIWmhjaUJwSUQwZ01Ec2dhU0E4SUhCaGFYSnpMbXhsYm1kMGFEc2dhU0FyUFNBeUtTQjdYRzRnSUNBZ0lDQjJZWElnWVhWMGIwSnBibVJMWlhrZ1BTQndZV2x5YzF0cFhUdGNiaUFnSUNBZ0lIWmhjaUJ0WlhSb2IyUWdQU0J3WVdseWMxdHBJQ3NnTVYwN1hHNGdJQ0FnSUNCamIyMXdiMjVsYm5SYllYVjBiMEpwYm1STFpYbGRJRDBnWW1sdVpFRjFkRzlDYVc1a1RXVjBhRzlrS0dOdmJYQnZibVZ1ZEN3Z2JXVjBhRzlrS1R0Y2JpQWdJQ0I5WEc0Z0lIMWNibHh1SUNCMllYSWdTWE5OYjNWdWRHVmtVSEpsVFdsNGFXNGdQU0I3WEc0Z0lDQWdZMjl0Y0c5dVpXNTBSR2xrVFc5MWJuUTZJR1oxYm1OMGFXOXVLQ2tnZTF4dUlDQWdJQ0FnZEdocGN5NWZYMmx6VFc5MWJuUmxaQ0E5SUhSeWRXVTdYRzRnSUNBZ2ZWeHVJQ0I5TzF4dVhHNGdJSFpoY2lCSmMwMXZkVzUwWldSUWIzTjBUV2w0YVc0Z1BTQjdYRzRnSUNBZ1kyOXRjRzl1Wlc1MFYybHNiRlZ1Ylc5MWJuUTZJR1oxYm1OMGFXOXVLQ2tnZTF4dUlDQWdJQ0FnZEdocGN5NWZYMmx6VFc5MWJuUmxaQ0E5SUdaaGJITmxPMXh1SUNBZ0lIMWNiaUFnZlR0Y2JseHVJQ0F2S2lwY2JpQWdJQ29nUVdSa0lHMXZjbVVnZEc4Z2RHaGxJRkpsWVdOMFEyeGhjM01nWW1GelpTQmpiR0Z6Y3k0Z1ZHaGxjMlVnWVhKbElHRnNiQ0JzWldkaFkza2dabVZoZEhWeVpYTWdZVzVrWEc0Z0lDQXFJSFJvWlhKbFptOXlaU0J1YjNRZ1lXeHlaV0ZrZVNCd1lYSjBJRzltSUhSb1pTQnRiMlJsY200Z1VtVmhZM1JEYjIxd2IyNWxiblF1WEc0Z0lDQXFMMXh1SUNCMllYSWdVbVZoWTNSRGJHRnpjMDFwZUdsdUlEMGdlMXh1SUNBZ0lDOHFLbHh1SUNBZ0lDQXFJRlJQUkU4NklGUm9hWE1nZDJsc2JDQmlaU0JrWlhCeVpXTmhkR1ZrSUdKbFkyRjFjMlVnYzNSaGRHVWdjMmh2ZFd4a0lHRnNkMkY1Y3lCclpXVndJR0VnWTI5dWMybHpkR1Z1ZEZ4dUlDQWdJQ0FxSUhSNWNHVWdjMmxuYm1GMGRYSmxJR0Z1WkNCMGFHVWdiMjVzZVNCMWMyVWdZMkZ6WlNCbWIzSWdkR2hwY3l3Z2FYTWdkRzhnWVhadmFXUWdkR2hoZEM1Y2JpQWdJQ0FnS2k5Y2JpQWdJQ0J5WlhCc1lXTmxVM1JoZEdVNklHWjFibU4wYVc5dUtHNWxkMU4wWVhSbExDQmpZV3hzWW1GamF5a2dlMXh1SUNBZ0lDQWdkR2hwY3k1MWNHUmhkR1Z5TG1WdWNYVmxkV1ZTWlhCc1lXTmxVM1JoZEdVb2RHaHBjeXdnYm1WM1UzUmhkR1VzSUdOaGJHeGlZV05yS1R0Y2JpQWdJQ0I5TEZ4dVhHNGdJQ0FnTHlvcVhHNGdJQ0FnSUNvZ1EyaGxZMnR6SUhkb1pYUm9aWElnYjNJZ2JtOTBJSFJvYVhNZ1kyOXRjRzl6YVhSbElHTnZiWEJ2Ym1WdWRDQnBjeUJ0YjNWdWRHVmtMbHh1SUNBZ0lDQXFJRUJ5WlhSMWNtNGdlMkp2YjJ4bFlXNTlJRlJ5ZFdVZ2FXWWdiVzkxYm5SbFpDd2dabUZzYzJVZ2IzUm9aWEozYVhObExseHVJQ0FnSUNBcUlFQndjbTkwWldOMFpXUmNiaUFnSUNBZ0tpQkFabWx1WVd4Y2JpQWdJQ0FnS2k5Y2JpQWdJQ0JwYzAxdmRXNTBaV1E2SUdaMWJtTjBhVzl1S0NrZ2UxeHVJQ0FnSUNBZ2FXWWdLSEJ5YjJObGMzTXVaVzUyTGs1UFJFVmZSVTVXSUNFOVBTQW5jSEp2WkhWamRHbHZiaWNwSUh0Y2JpQWdJQ0FnSUNBZ2QyRnlibWx1WnloY2JpQWdJQ0FnSUNBZ0lDQjBhR2x6TGw5ZlpHbGtWMkZ5YmtselRXOTFiblJsWkN4Y2JpQWdJQ0FnSUNBZ0lDQW5KWE02SUdselRXOTFiblJsWkNCcGN5QmtaWEJ5WldOaGRHVmtMaUJKYm5OMFpXRmtMQ0J0WVd0bElITjFjbVVnZEc4Z1kyeGxZVzRnZFhBZ0p5QXJYRzRnSUNBZ0lDQWdJQ0FnSUNBbmMzVmljMk55YVhCMGFXOXVjeUJoYm1RZ2NHVnVaR2x1WnlCeVpYRjFaWE4wY3lCcGJpQmpiMjF3YjI1bGJuUlhhV3hzVlc1dGIzVnVkQ0IwYnlBbklDdGNiaUFnSUNBZ0lDQWdJQ0FnSUNkd2NtVjJaVzUwSUcxbGJXOXllU0JzWldGcmN5NG5MRnh1SUNBZ0lDQWdJQ0FnSUNoMGFHbHpMbU52Ym5OMGNuVmpkRzl5SUNZbUlIUm9hWE11WTI5dWMzUnlkV04wYjNJdVpHbHpjR3hoZVU1aGJXVXBJSHg4WEc0Z0lDQWdJQ0FnSUNBZ0lDQjBhR2x6TG01aGJXVWdmSHhjYmlBZ0lDQWdJQ0FnSUNBZ0lDZERiMjF3YjI1bGJuUW5YRzRnSUNBZ0lDQWdJQ2s3WEc0Z0lDQWdJQ0FnSUhSb2FYTXVYMTlrYVdSWFlYSnVTWE5OYjNWdWRHVmtJRDBnZEhKMVpUdGNiaUFnSUNBZ0lIMWNiaUFnSUNBZ0lISmxkSFZ5YmlBaElYUm9hWE11WDE5cGMwMXZkVzUwWldRN1hHNGdJQ0FnZlZ4dUlDQjlPMXh1WEc0Z0lIWmhjaUJTWldGamRFTnNZWE56UTI5dGNHOXVaVzUwSUQwZ1puVnVZM1JwYjI0b0tTQjdmVHRjYmlBZ1gyRnpjMmxuYmloY2JpQWdJQ0JTWldGamRFTnNZWE56UTI5dGNHOXVaVzUwTG5CeWIzUnZkSGx3WlN4Y2JpQWdJQ0JTWldGamRFTnZiWEJ2Ym1WdWRDNXdjbTkwYjNSNWNHVXNYRzRnSUNBZ1VtVmhZM1JEYkdGemMwMXBlR2x1WEc0Z0lDazdYRzVjYmlBZ0x5b3FYRzRnSUNBcUlFTnlaV0YwWlhNZ1lTQmpiMjF3YjNOcGRHVWdZMjl0Y0c5dVpXNTBJR05zWVhOeklHZHBkbVZ1SUdFZ1kyeGhjM01nYzNCbFkybG1hV05oZEdsdmJpNWNiaUFnSUNvZ1UyVmxJR2gwZEhCek9pOHZabUZqWldKdmIyc3VaMmwwYUhWaUxtbHZMM0psWVdOMEwyUnZZM012ZEc5d0xXeGxkbVZzTFdGd2FTNW9kRzFzSTNKbFlXTjBMbU55WldGMFpXTnNZWE56WEc0Z0lDQXFYRzRnSUNBcUlFQndZWEpoYlNCN2IySnFaV04wZlNCemNHVmpJRU5zWVhOeklITndaV05wWm1sallYUnBiMjRnS0hkb2FXTm9JRzExYzNRZ1pHVm1hVzVsSUdCeVpXNWtaWEpnS1M1Y2JpQWdJQ29nUUhKbGRIVnliaUI3Wm5WdVkzUnBiMjU5SUVOdmJYQnZibVZ1ZENCamIyNXpkSEoxWTNSdmNpQm1kVzVqZEdsdmJpNWNiaUFnSUNvZ1FIQjFZbXhwWTF4dUlDQWdLaTljYmlBZ1puVnVZM1JwYjI0Z1kzSmxZWFJsUTJ4aGMzTW9jM0JsWXlrZ2UxeHVJQ0FnSUM4dklGUnZJR3RsWlhBZ2IzVnlJSGRoY201cGJtZHpJRzF2Y21VZ2RXNWtaWEp6ZEdGdVpHRmliR1VzSUhkbEoyeHNJSFZ6WlNCaElHeHBkSFJzWlNCb1lXTnJJR2hsY21VZ2RHOWNiaUFnSUNBdkx5Qmxibk4xY21VZ2RHaGhkQ0JEYjI1emRISjFZM1J2Y2k1dVlXMWxJQ0U5UFNBblEyOXVjM1J5ZFdOMGIzSW5MaUJVYUdseklHMWhhMlZ6SUhOMWNtVWdkMlVnWkc5dUozUmNiaUFnSUNBdkx5QjFibTVsWTJWemMyRnlhV3g1SUdsa1pXNTBhV1o1SUdFZ1kyeGhjM01nZDJsMGFHOTFkQ0JrYVhOd2JHRjVUbUZ0WlNCaGN5QW5RMjl1YzNSeWRXTjBiM0luTGx4dUlDQWdJSFpoY2lCRGIyNXpkSEoxWTNSdmNpQTlJR2xrWlc1MGFYUjVLR1oxYm1OMGFXOXVLSEJ5YjNCekxDQmpiMjUwWlhoMExDQjFjR1JoZEdWeUtTQjdYRzRnSUNBZ0lDQXZMeUJVYUdseklHTnZibk4wY25WamRHOXlJR2RsZEhNZ2IzWmxjbkpwWkdSbGJpQmllU0J0YjJOcmN5NGdWR2hsSUdGeVozVnRaVzUwSUdseklIVnpaV1JjYmlBZ0lDQWdJQzh2SUdKNUlHMXZZMnR6SUhSdklHRnpjMlZ5ZENCdmJpQjNhR0YwSUdkbGRITWdiVzkxYm5SbFpDNWNibHh1SUNBZ0lDQWdhV1lnS0hCeWIyTmxjM011Wlc1MkxrNVBSRVZmUlU1V0lDRTlQU0FuY0hKdlpIVmpkR2x2YmljcElIdGNiaUFnSUNBZ0lDQWdkMkZ5Ym1sdVp5aGNiaUFnSUNBZ0lDQWdJQ0IwYUdseklHbHVjM1JoYm1ObGIyWWdRMjl1YzNSeWRXTjBiM0lzWEc0Z0lDQWdJQ0FnSUNBZ0oxTnZiV1YwYUdsdVp5QnBjeUJqWVd4c2FXNW5JR0VnVW1WaFkzUWdZMjl0Y0c5dVpXNTBJR1JwY21WamRHeDVMaUJWYzJVZ1lTQm1ZV04wYjNKNUlHOXlJQ2NnSzF4dUlDQWdJQ0FnSUNBZ0lDQWdKMHBUV0NCcGJuTjBaV0ZrTGlCVFpXVTZJR2gwZEhCek9pOHZabUl1YldVdmNtVmhZM1F0YkdWbllXTjVabUZqZEc5eWVTZGNiaUFnSUNBZ0lDQWdLVHRjYmlBZ0lDQWdJSDFjYmx4dUlDQWdJQ0FnTHk4Z1YybHlaU0IxY0NCaGRYUnZMV0pwYm1ScGJtZGNiaUFnSUNBZ0lHbG1JQ2gwYUdsekxsOWZjbVZoWTNSQmRYUnZRbWx1WkZCaGFYSnpMbXhsYm1kMGFDa2dlMXh1SUNBZ0lDQWdJQ0JpYVc1a1FYVjBiMEpwYm1STlpYUm9iMlJ6S0hSb2FYTXBPMXh1SUNBZ0lDQWdmVnh1WEc0Z0lDQWdJQ0IwYUdsekxuQnliM0J6SUQwZ2NISnZjSE03WEc0Z0lDQWdJQ0IwYUdsekxtTnZiblJsZUhRZ1BTQmpiMjUwWlhoME8xeHVJQ0FnSUNBZ2RHaHBjeTV5WldaeklEMGdaVzF3ZEhsUFltcGxZM1E3WEc0Z0lDQWdJQ0IwYUdsekxuVndaR0YwWlhJZ1BTQjFjR1JoZEdWeUlIeDhJRkpsWVdOMFRtOXZjRlZ3WkdGMFpWRjFaWFZsTzF4dVhHNGdJQ0FnSUNCMGFHbHpMbk4wWVhSbElEMGdiblZzYkR0Y2JseHVJQ0FnSUNBZ0x5OGdVbVZoWTNSRGJHRnpjMlZ6SUdSdlpYTnVKM1FnYUdGMlpTQmpiMjV6ZEhKMVkzUnZjbk11SUVsdWMzUmxZV1FzSUhSb1pYa2dkWE5sSUhSb1pWeHVJQ0FnSUNBZ0x5OGdaMlYwU1c1cGRHbGhiRk4wWVhSbElHRnVaQ0JqYjIxd2IyNWxiblJYYVd4c1RXOTFiblFnYldWMGFHOWtjeUJtYjNJZ2FXNXBkR2xoYkdsNllYUnBiMjR1WEc1Y2JpQWdJQ0FnSUhaaGNpQnBibWwwYVdGc1UzUmhkR1VnUFNCMGFHbHpMbWRsZEVsdWFYUnBZV3hUZEdGMFpTQS9JSFJvYVhNdVoyVjBTVzVwZEdsaGJGTjBZWFJsS0NrZ09pQnVkV3hzTzF4dUlDQWdJQ0FnYVdZZ0tIQnliMk5sYzNNdVpXNTJMazVQUkVWZlJVNVdJQ0U5UFNBbmNISnZaSFZqZEdsdmJpY3BJSHRjYmlBZ0lDQWdJQ0FnTHk4Z1YyVWdZV3hzYjNjZ1lYVjBieTF0YjJOcmN5QjBieUJ3Y205alpXVmtJR0Z6SUdsbUlIUm9aWGtuY21VZ2NtVjBkWEp1YVc1bklHNTFiR3d1WEc0Z0lDQWdJQ0FnSUdsbUlDaGNiaUFnSUNBZ0lDQWdJQ0JwYm1sMGFXRnNVM1JoZEdVZ1BUMDlJSFZ1WkdWbWFXNWxaQ0FtSmx4dUlDQWdJQ0FnSUNBZ0lIUm9hWE11WjJWMFNXNXBkR2xoYkZOMFlYUmxMbDlwYzAxdlkydEdkVzVqZEdsdmJseHVJQ0FnSUNBZ0lDQXBJSHRjYmlBZ0lDQWdJQ0FnSUNBdkx5QlVhR2x6SUdseklIQnliMkpoWW14NUlHSmhaQ0J3Y21GamRHbGpaUzRnUTI5dWMybGtaWElnZDJGeWJtbHVaeUJvWlhKbElHRnVaRnh1SUNBZ0lDQWdJQ0FnSUM4dklHUmxjSEpsWTJGMGFXNW5JSFJvYVhNZ1kyOXVkbVZ1YVdWdVkyVXVYRzRnSUNBZ0lDQWdJQ0FnYVc1cGRHbGhiRk4wWVhSbElEMGdiblZzYkR0Y2JpQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ1gybHVkbUZ5YVdGdWRDaGNiaUFnSUNBZ0lDQWdkSGx3Wlc5bUlHbHVhWFJwWVd4VGRHRjBaU0E5UFQwZ0oyOWlhbVZqZENjZ0ppWWdJVUZ5Y21GNUxtbHpRWEp5WVhrb2FXNXBkR2xoYkZOMFlYUmxLU3hjYmlBZ0lDQWdJQ0FnSnlWekxtZGxkRWx1YVhScFlXeFRkR0YwWlNncE9pQnRkWE4wSUhKbGRIVnliaUJoYmlCdlltcGxZM1FnYjNJZ2JuVnNiQ2NzWEc0Z0lDQWdJQ0FnSUVOdmJuTjBjblZqZEc5eUxtUnBjM0JzWVhsT1lXMWxJSHg4SUNkU1pXRmpkRU52YlhCdmMybDBaVU52YlhCdmJtVnVkQ2RjYmlBZ0lDQWdJQ2s3WEc1Y2JpQWdJQ0FnSUhSb2FYTXVjM1JoZEdVZ1BTQnBibWwwYVdGc1UzUmhkR1U3WEc0Z0lDQWdmU2s3WEc0Z0lDQWdRMjl1YzNSeWRXTjBiM0l1Y0hKdmRHOTBlWEJsSUQwZ2JtVjNJRkpsWVdOMFEyeGhjM05EYjIxd2IyNWxiblFvS1R0Y2JpQWdJQ0JEYjI1emRISjFZM1J2Y2k1d2NtOTBiM1I1Y0dVdVkyOXVjM1J5ZFdOMGIzSWdQU0JEYjI1emRISjFZM1J2Y2p0Y2JpQWdJQ0JEYjI1emRISjFZM1J2Y2k1d2NtOTBiM1I1Y0dVdVgxOXlaV0ZqZEVGMWRHOUNhVzVrVUdGcGNuTWdQU0JiWFR0Y2JseHVJQ0FnSUdsdWFtVmpkR1ZrVFdsNGFXNXpMbVp2Y2tWaFkyZ29iV2w0VTNCbFkwbHVkRzlEYjIxd2IyNWxiblF1WW1sdVpDaHVkV3hzTENCRGIyNXpkSEoxWTNSdmNpa3BPMXh1WEc0Z0lDQWdiV2w0VTNCbFkwbHVkRzlEYjIxd2IyNWxiblFvUTI5dWMzUnlkV04wYjNJc0lFbHpUVzkxYm5SbFpGQnlaVTFwZUdsdUtUdGNiaUFnSUNCdGFYaFRjR1ZqU1c1MGIwTnZiWEJ2Ym1WdWRDaERiMjV6ZEhKMVkzUnZjaXdnYzNCbFl5azdYRzRnSUNBZ2JXbDRVM0JsWTBsdWRHOURiMjF3YjI1bGJuUW9RMjl1YzNSeWRXTjBiM0lzSUVselRXOTFiblJsWkZCdmMzUk5hWGhwYmlrN1hHNWNiaUFnSUNBdkx5QkpibWwwYVdGc2FYcGxJSFJvWlNCa1pXWmhkV3gwVUhKdmNITWdjSEp2Y0dWeWRIa2dZV1owWlhJZ1lXeHNJRzFwZUdsdWN5Qm9ZWFpsSUdKbFpXNGdiV1Z5WjJWa0xseHVJQ0FnSUdsbUlDaERiMjV6ZEhKMVkzUnZjaTVuWlhSRVpXWmhkV3gwVUhKdmNITXBJSHRjYmlBZ0lDQWdJRU52Ym5OMGNuVmpkRzl5TG1SbFptRjFiSFJRY205d2N5QTlJRU52Ym5OMGNuVmpkRzl5TG1kbGRFUmxabUYxYkhSUWNtOXdjeWdwTzF4dUlDQWdJSDFjYmx4dUlDQWdJR2xtSUNod2NtOWpaWE56TG1WdWRpNU9UMFJGWDBWT1ZpQWhQVDBnSjNCeWIyUjFZM1JwYjI0bktTQjdYRzRnSUNBZ0lDQXZMeUJVYUdseklHbHpJR0VnZEdGbklIUnZJR2x1WkdsallYUmxJSFJvWVhRZ2RHaGxJSFZ6WlNCdlppQjBhR1Z6WlNCdFpYUm9iMlFnYm1GdFpYTWdhWE1nYjJzc1hHNGdJQ0FnSUNBdkx5QnphVzVqWlNCcGRDZHpJSFZ6WldRZ2QybDBhQ0JqY21WaGRHVkRiR0Z6Y3k0Z1NXWWdhWFFuY3lCdWIzUXNJSFJvWlc0Z2FYUW5jeUJzYVd0bGJIa2dZVnh1SUNBZ0lDQWdMeThnYldsemRHRnJaU0J6YnlCM1pTZHNiQ0IzWVhKdUlIbHZkU0IwYnlCMWMyVWdkR2hsSUhOMFlYUnBZeUJ3Y205d1pYSjBlU3dnY0hKdmNHVnlkSGxjYmlBZ0lDQWdJQzh2SUdsdWFYUnBZV3hwZW1WeUlHOXlJR052Ym5OMGNuVmpkRzl5SUhKbGMzQmxZM1JwZG1Wc2VTNWNiaUFnSUNBZ0lHbG1JQ2hEYjI1emRISjFZM1J2Y2k1blpYUkVaV1poZFd4MFVISnZjSE1wSUh0Y2JpQWdJQ0FnSUNBZ1EyOXVjM1J5ZFdOMGIzSXVaMlYwUkdWbVlYVnNkRkJ5YjNCekxtbHpVbVZoWTNSRGJHRnpjMEZ3Y0hKdmRtVmtJRDBnZTMwN1hHNGdJQ0FnSUNCOVhHNGdJQ0FnSUNCcFppQW9RMjl1YzNSeWRXTjBiM0l1Y0hKdmRHOTBlWEJsTG1kbGRFbHVhWFJwWVd4VGRHRjBaU2tnZTF4dUlDQWdJQ0FnSUNCRGIyNXpkSEoxWTNSdmNpNXdjbTkwYjNSNWNHVXVaMlYwU1c1cGRHbGhiRk4wWVhSbExtbHpVbVZoWTNSRGJHRnpjMEZ3Y0hKdmRtVmtJRDBnZTMwN1hHNGdJQ0FnSUNCOVhHNGdJQ0FnZlZ4dVhHNGdJQ0FnWDJsdWRtRnlhV0Z1ZENoY2JpQWdJQ0FnSUVOdmJuTjBjblZqZEc5eUxuQnliM1J2ZEhsd1pTNXlaVzVrWlhJc1hHNGdJQ0FnSUNBblkzSmxZWFJsUTJ4aGMzTW9MaTR1S1RvZ1EyeGhjM01nYzNCbFkybG1hV05oZEdsdmJpQnRkWE4wSUdsdGNHeGxiV1Z1ZENCaElHQnlaVzVrWlhKZ0lHMWxkR2h2WkM0blhHNGdJQ0FnS1R0Y2JseHVJQ0FnSUdsbUlDaHdjbTlqWlhOekxtVnVkaTVPVDBSRlgwVk9WaUFoUFQwZ0ozQnliMlIxWTNScGIyNG5LU0I3WEc0Z0lDQWdJQ0IzWVhKdWFXNW5LRnh1SUNBZ0lDQWdJQ0FoUTI5dWMzUnlkV04wYjNJdWNISnZkRzkwZVhCbExtTnZiWEJ2Ym1WdWRGTm9iM1ZzWkZWd1pHRjBaU3hjYmlBZ0lDQWdJQ0FnSnlWeklHaGhjeUJoSUcxbGRHaHZaQ0JqWVd4c1pXUWdKeUFyWEc0Z0lDQWdJQ0FnSUNBZ0oyTnZiWEJ2Ym1WdWRGTm9iM1ZzWkZWd1pHRjBaU2dwTGlCRWFXUWdlVzkxSUcxbFlXNGdjMmh2ZFd4a1EyOXRjRzl1Wlc1MFZYQmtZWFJsS0NrL0lDY2dLMXh1SUNBZ0lDQWdJQ0FnSUNkVWFHVWdibUZ0WlNCcGN5QndhSEpoYzJWa0lHRnpJR0VnY1hWbGMzUnBiMjRnWW1WallYVnpaU0IwYUdVZ1puVnVZM1JwYjI0Z2FYTWdKeUFyWEc0Z0lDQWdJQ0FnSUNBZ0oyVjRjR1ZqZEdWa0lIUnZJSEpsZEhWeWJpQmhJSFpoYkhWbExpY3NYRzRnSUNBZ0lDQWdJSE53WldNdVpHbHpjR3hoZVU1aGJXVWdmSHdnSjBFZ1kyOXRjRzl1Wlc1MEoxeHVJQ0FnSUNBZ0tUdGNiaUFnSUNBZ0lIZGhjbTVwYm1jb1hHNGdJQ0FnSUNBZ0lDRkRiMjV6ZEhKMVkzUnZjaTV3Y205MGIzUjVjR1V1WTI5dGNHOXVaVzUwVjJsc2JGSmxZMmxsZG1WUWNtOXdjeXhjYmlBZ0lDQWdJQ0FnSnlWeklHaGhjeUJoSUcxbGRHaHZaQ0JqWVd4c1pXUWdKeUFyWEc0Z0lDQWdJQ0FnSUNBZ0oyTnZiWEJ2Ym1WdWRGZHBiR3hTWldOcFpYWmxVSEp2Y0hNb0tTNGdSR2xrSUhsdmRTQnRaV0Z1SUdOdmJYQnZibVZ1ZEZkcGJHeFNaV05sYVhabFVISnZjSE1vS1Q4bkxGeHVJQ0FnSUNBZ0lDQnpjR1ZqTG1ScGMzQnNZWGxPWVcxbElIeDhJQ2RCSUdOdmJYQnZibVZ1ZENkY2JpQWdJQ0FnSUNrN1hHNGdJQ0FnZlZ4dVhHNGdJQ0FnTHk4Z1VtVmtkV05sSUhScGJXVWdjM0JsYm5RZ1pHOXBibWNnYkc5dmEzVndjeUJpZVNCelpYUjBhVzVuSUhSb1pYTmxJRzl1SUhSb1pTQndjbTkwYjNSNWNHVXVYRzRnSUNBZ1ptOXlJQ2gyWVhJZ2JXVjBhRzlrVG1GdFpTQnBiaUJTWldGamRFTnNZWE56U1c1MFpYSm1ZV05sS1NCN1hHNGdJQ0FnSUNCcFppQW9JVU52Ym5OMGNuVmpkRzl5TG5CeWIzUnZkSGx3WlZ0dFpYUm9iMlJPWVcxbFhTa2dlMXh1SUNBZ0lDQWdJQ0JEYjI1emRISjFZM1J2Y2k1d2NtOTBiM1I1Y0dWYmJXVjBhRzlrVG1GdFpWMGdQU0J1ZFd4c08xeHVJQ0FnSUNBZ2ZWeHVJQ0FnSUgxY2JseHVJQ0FnSUhKbGRIVnliaUJEYjI1emRISjFZM1J2Y2p0Y2JpQWdmVnh1WEc0Z0lISmxkSFZ5YmlCamNtVmhkR1ZEYkdGemN6dGNibjFjYmx4dWJXOWtkV3hsTG1WNGNHOXlkSE1nUFNCbVlXTjBiM0o1TzF4dUlpd2lMeXBjYm05aWFtVmpkQzFoYzNOcFoyNWNiaWhqS1NCVGFXNWtjbVVnVTI5eWFIVnpYRzVBYkdsalpXNXpaU0JOU1ZSY2Jpb3ZYRzVjYmlkMWMyVWdjM1J5YVdOMEp6dGNiaThxSUdWemJHbHVkQzFrYVhOaFlteGxJRzV2TFhWdWRYTmxaQzEyWVhKeklDb3ZYRzUyWVhJZ1oyVjBUM2R1VUhKdmNHVnlkSGxUZVcxaWIyeHpJRDBnVDJKcVpXTjBMbWRsZEU5M2JsQnliM0JsY25SNVUzbHRZbTlzY3p0Y2JuWmhjaUJvWVhOUGQyNVFjbTl3WlhKMGVTQTlJRTlpYW1WamRDNXdjbTkwYjNSNWNHVXVhR0Z6VDNkdVVISnZjR1Z5ZEhrN1hHNTJZWElnY0hKdmNFbHpSVzUxYldWeVlXSnNaU0E5SUU5aWFtVmpkQzV3Y205MGIzUjVjR1V1Y0hKdmNHVnlkSGxKYzBWdWRXMWxjbUZpYkdVN1hHNWNibVoxYm1OMGFXOXVJSFJ2VDJKcVpXTjBLSFpoYkNrZ2UxeHVYSFJwWmlBb2RtRnNJRDA5UFNCdWRXeHNJSHg4SUhaaGJDQTlQVDBnZFc1a1pXWnBibVZrS1NCN1hHNWNkRngwZEdoeWIzY2dibVYzSUZSNWNHVkZjbkp2Y2lnblQySnFaV04wTG1GemMybG5iaUJqWVc1dWIzUWdZbVVnWTJGc2JHVmtJSGRwZEdnZ2JuVnNiQ0J2Y2lCMWJtUmxabWx1WldRbktUdGNibHgwZlZ4dVhHNWNkSEpsZEhWeWJpQlBZbXBsWTNRb2RtRnNLVHRjYm4xY2JseHVablZ1WTNScGIyNGdjMmh2ZFd4a1ZYTmxUbUYwYVhabEtDa2dlMXh1WEhSMGNua2dlMXh1WEhSY2RHbG1JQ2doVDJKcVpXTjBMbUZ6YzJsbmJpa2dlMXh1WEhSY2RGeDBjbVYwZFhKdUlHWmhiSE5sTzF4dVhIUmNkSDFjYmx4dVhIUmNkQzh2SUVSbGRHVmpkQ0JpZFdkbmVTQndjbTl3WlhKMGVTQmxiblZ0WlhKaGRHbHZiaUJ2Y21SbGNpQnBiaUJ2YkdSbGNpQldPQ0IyWlhKemFXOXVjeTVjYmx4dVhIUmNkQzh2SUdoMGRIQnpPaTh2WW5WbmN5NWphSEp2YldsMWJTNXZjbWN2Y0M5Mk9DOXBjM04xWlhNdlpHVjBZV2xzUDJsa1BUUXhNVGhjYmx4MFhIUjJZWElnZEdWemRERWdQU0J1WlhjZ1UzUnlhVzVuS0NkaFltTW5LVHNnSUM4dklHVnpiR2x1ZEMxa2FYTmhZbXhsTFd4cGJtVWdibTh0Ym1WM0xYZHlZWEJ3WlhKelhHNWNkRngwZEdWemRERmJOVjBnUFNBblpHVW5PMXh1WEhSY2RHbG1JQ2hQWW1wbFkzUXVaMlYwVDNkdVVISnZjR1Z5ZEhsT1lXMWxjeWgwWlhOME1TbGJNRjBnUFQwOUlDYzFKeWtnZTF4dVhIUmNkRngwY21WMGRYSnVJR1poYkhObE8xeHVYSFJjZEgxY2JseHVYSFJjZEM4dklHaDBkSEJ6T2k4dlluVm5jeTVqYUhKdmJXbDFiUzV2Y21jdmNDOTJPQzlwYzNOMVpYTXZaR1YwWVdsc1AybGtQVE13TlRaY2JseDBYSFIyWVhJZ2RHVnpkRElnUFNCN2ZUdGNibHgwWEhSbWIzSWdLSFpoY2lCcElEMGdNRHNnYVNBOElERXdPeUJwS3lzcElIdGNibHgwWEhSY2RIUmxjM1F5V3lkZkp5QXJJRk4wY21sdVp5NW1jbTl0UTJoaGNrTnZaR1VvYVNsZElEMGdhVHRjYmx4MFhIUjlYRzVjZEZ4MGRtRnlJRzl5WkdWeU1pQTlJRTlpYW1WamRDNW5aWFJQZDI1UWNtOXdaWEowZVU1aGJXVnpLSFJsYzNReUtTNXRZWEFvWm5WdVkzUnBiMjRnS0c0cElIdGNibHgwWEhSY2RISmxkSFZ5YmlCMFpYTjBNbHR1WFR0Y2JseDBYSFI5S1R0Y2JseDBYSFJwWmlBb2IzSmtaWEl5TG1wdmFXNG9KeWNwSUNFOVBTQW5NREV5TXpRMU5qYzRPU2NwSUh0Y2JseDBYSFJjZEhKbGRIVnliaUJtWVd4elpUdGNibHgwWEhSOVhHNWNibHgwWEhRdkx5Qm9kSFJ3Y3pvdkwySjFaM011WTJoeWIyMXBkVzB1YjNKbkwzQXZkamd2YVhOemRXVnpMMlJsZEdGcGJEOXBaRDB6TURVMlhHNWNkRngwZG1GeUlIUmxjM1F6SUQwZ2UzMDdYRzVjZEZ4MEoyRmlZMlJsWm1kb2FXcHJiRzF1YjNCeGNuTjBKeTV6Y0d4cGRDZ25KeWt1Wm05eVJXRmphQ2htZFc1amRHbHZiaUFvYkdWMGRHVnlLU0I3WEc1Y2RGeDBYSFIwWlhOME0xdHNaWFIwWlhKZElEMGdiR1YwZEdWeU8xeHVYSFJjZEgwcE8xeHVYSFJjZEdsbUlDaFBZbXBsWTNRdWEyVjVjeWhQWW1wbFkzUXVZWE56YVdkdUtIdDlMQ0IwWlhOME15a3BMbXB2YVc0b0p5Y3BJQ0U5UFZ4dVhIUmNkRngwWEhRbllXSmpaR1ZtWjJocGFtdHNiVzV2Y0hGeWMzUW5LU0I3WEc1Y2RGeDBYSFJ5WlhSMWNtNGdabUZzYzJVN1hHNWNkRngwZlZ4dVhHNWNkRngwY21WMGRYSnVJSFJ5ZFdVN1hHNWNkSDBnWTJGMFkyZ2dLR1Z5Y2lrZ2UxeHVYSFJjZEM4dklGZGxJR1J2YmlkMElHVjRjR1ZqZENCaGJua2diMllnZEdobElHRmliM1psSUhSdklIUm9jbTkzTENCaWRYUWdZbVYwZEdWeUlIUnZJR0psSUhOaFptVXVYRzVjZEZ4MGNtVjBkWEp1SUdaaGJITmxPMXh1WEhSOVhHNTlYRzVjYm0xdlpIVnNaUzVsZUhCdmNuUnpJRDBnYzJodmRXeGtWWE5sVG1GMGFYWmxLQ2tnUHlCUFltcGxZM1F1WVhOemFXZHVJRG9nWm5WdVkzUnBiMjRnS0hSaGNtZGxkQ3dnYzI5MWNtTmxLU0I3WEc1Y2RIWmhjaUJtY205dE8xeHVYSFIyWVhJZ2RHOGdQU0IwYjA5aWFtVmpkQ2gwWVhKblpYUXBPMXh1WEhSMllYSWdjM2x0WW05c2N6dGNibHh1WEhSbWIzSWdLSFpoY2lCeklEMGdNVHNnY3lBOElHRnlaM1Z0Wlc1MGN5NXNaVzVuZEdnN0lITXJLeWtnZTF4dVhIUmNkR1p5YjIwZ1BTQlBZbXBsWTNRb1lYSm5kVzFsYm5SelczTmRLVHRjYmx4dVhIUmNkR1p2Y2lBb2RtRnlJR3RsZVNCcGJpQm1jbTl0S1NCN1hHNWNkRngwWEhScFppQW9hR0Z6VDNkdVVISnZjR1Z5ZEhrdVkyRnNiQ2htY205dExDQnJaWGtwS1NCN1hHNWNkRngwWEhSY2RIUnZXMnRsZVYwZ1BTQm1jbTl0VzJ0bGVWMDdYRzVjZEZ4MFhIUjlYRzVjZEZ4MGZWeHVYRzVjZEZ4MGFXWWdLR2RsZEU5M2JsQnliM0JsY25SNVUzbHRZbTlzY3lrZ2UxeHVYSFJjZEZ4MGMzbHRZbTlzY3lBOUlHZGxkRTkzYmxCeWIzQmxjblI1VTNsdFltOXNjeWhtY205dEtUdGNibHgwWEhSY2RHWnZjaUFvZG1GeUlHa2dQU0F3T3lCcElEd2djM2x0WW05c2N5NXNaVzVuZEdnN0lHa3JLeWtnZTF4dVhIUmNkRngwWEhScFppQW9jSEp2Y0VselJXNTFiV1Z5WVdKc1pTNWpZV3hzS0daeWIyMHNJSE41YldKdmJITmJhVjBwS1NCN1hHNWNkRngwWEhSY2RGeDBkRzliYzNsdFltOXNjMXRwWFYwZ1BTQm1jbTl0VzNONWJXSnZiSE5iYVYxZE8xeHVYSFJjZEZ4MFhIUjlYRzVjZEZ4MFhIUjlYRzVjZEZ4MGZWeHVYSFI5WEc1Y2JseDBjbVYwZFhKdUlIUnZPMXh1ZlR0Y2JpSXNJbHdpZFhObElITjBjbWxqZEZ3aU8xeHVYRzR2S2lwY2JpQXFJRU52Y0hseWFXZG9kQ0FvWXlrZ01qQXhNeTF3Y21WelpXNTBMQ0JHWVdObFltOXZheXdnU1c1akxseHVJQ29nUVd4c0lISnBaMmgwY3lCeVpYTmxjblpsWkM1Y2JpQXFYRzRnS2lCVWFHbHpJSE52ZFhKalpTQmpiMlJsSUdseklHeHBZMlZ1YzJWa0lIVnVaR1Z5SUhSb1pTQkNVMFF0YzNSNWJHVWdiR2xqWlc1elpTQm1iM1Z1WkNCcGJpQjBhR1ZjYmlBcUlFeEpRMFZPVTBVZ1ptbHNaU0JwYmlCMGFHVWdjbTl2ZENCa2FYSmxZM1J2Y25rZ2IyWWdkR2hwY3lCemIzVnlZMlVnZEhKbFpTNGdRVzRnWVdSa2FYUnBiMjVoYkNCbmNtRnVkRnh1SUNvZ2IyWWdjR0YwWlc1MElISnBaMmgwY3lCallXNGdZbVVnWm05MWJtUWdhVzRnZEdobElGQkJWRVZPVkZNZ1ptbHNaU0JwYmlCMGFHVWdjMkZ0WlNCa2FYSmxZM1J2Y25rdVhHNGdLbHh1SUNvZ1hHNGdLaTljYmx4dVpuVnVZM1JwYjI0Z2JXRnJaVVZ0Y0hSNVJuVnVZM1JwYjI0b1lYSm5LU0I3WEc0Z0lISmxkSFZ5YmlCbWRXNWpkR2x2YmlBb0tTQjdYRzRnSUNBZ2NtVjBkWEp1SUdGeVp6dGNiaUFnZlR0Y2JuMWNibHh1THlvcVhHNGdLaUJVYUdseklHWjFibU4wYVc5dUlHRmpZMlZ3ZEhNZ1lXNWtJR1JwYzJOaGNtUnpJR2x1Y0hWMGN6c2dhWFFnYUdGeklHNXZJSE5wWkdVZ1pXWm1aV04wY3k0Z1ZHaHBjeUJwYzF4dUlDb2djSEpwYldGeWFXeDVJSFZ6WldaMWJDQnBaR2x2YldGMGFXTmhiR3g1SUdadmNpQnZkbVZ5Y21sa1lXSnNaU0JtZFc1amRHbHZiaUJsYm1Sd2IybHVkSE1nZDJocFkyaGNiaUFxSUdGc2QyRjVjeUJ1WldWa0lIUnZJR0psSUdOaGJHeGhZbXhsTENCemFXNWpaU0JLVXlCc1lXTnJjeUJoSUc1MWJHd3RZMkZzYkNCcFpHbHZiU0JoYkdFZ1EyOWpiMkV1WEc0Z0tpOWNiblpoY2lCbGJYQjBlVVoxYm1OMGFXOXVJRDBnWm5WdVkzUnBiMjRnWlcxd2RIbEdkVzVqZEdsdmJpZ3BJSHQ5TzF4dVhHNWxiWEIwZVVaMWJtTjBhVzl1TG5Sb1lYUlNaWFIxY201eklEMGdiV0ZyWlVWdGNIUjVSblZ1WTNScGIyNDdYRzVsYlhCMGVVWjFibU4wYVc5dUxuUm9ZWFJTWlhSMWNtNXpSbUZzYzJVZ1BTQnRZV3RsUlcxd2RIbEdkVzVqZEdsdmJpaG1ZV3h6WlNrN1hHNWxiWEIwZVVaMWJtTjBhVzl1TG5Sb1lYUlNaWFIxY201elZISjFaU0E5SUcxaGEyVkZiWEIwZVVaMWJtTjBhVzl1S0hSeWRXVXBPMXh1Wlcxd2RIbEdkVzVqZEdsdmJpNTBhR0YwVW1WMGRYSnVjMDUxYkd3Z1BTQnRZV3RsUlcxd2RIbEdkVzVqZEdsdmJpaHVkV3hzS1R0Y2JtVnRjSFI1Um5WdVkzUnBiMjR1ZEdoaGRGSmxkSFZ5Ym5OVWFHbHpJRDBnWm5WdVkzUnBiMjRnS0NrZ2UxeHVJQ0J5WlhSMWNtNGdkR2hwY3p0Y2JuMDdYRzVsYlhCMGVVWjFibU4wYVc5dUxuUm9ZWFJTWlhSMWNtNXpRWEpuZFcxbGJuUWdQU0JtZFc1amRHbHZiaUFvWVhKbktTQjdYRzRnSUhKbGRIVnliaUJoY21jN1hHNTlPMXh1WEc1dGIyUjFiR1V1Wlhod2IzSjBjeUE5SUdWdGNIUjVSblZ1WTNScGIyNDdJaXdpTHlvcVhHNGdLaUJEYjNCNWNtbG5hSFFnS0dNcElESXdNVE10Y0hKbGMyVnVkQ3dnUm1GalpXSnZiMnNzSUVsdVl5NWNiaUFxSUVGc2JDQnlhV2RvZEhNZ2NtVnpaWEoyWldRdVhHNGdLbHh1SUNvZ1ZHaHBjeUJ6YjNWeVkyVWdZMjlrWlNCcGN5QnNhV05sYm5ObFpDQjFibVJsY2lCMGFHVWdRbE5FTFhOMGVXeGxJR3hwWTJWdWMyVWdabTkxYm1RZ2FXNGdkR2hsWEc0Z0tpQk1TVU5GVGxORklHWnBiR1VnYVc0Z2RHaGxJSEp2YjNRZ1pHbHlaV04wYjNKNUlHOW1JSFJvYVhNZ2MyOTFjbU5sSUhSeVpXVXVJRUZ1SUdGa1pHbDBhVzl1WVd3Z1ozSmhiblJjYmlBcUlHOW1JSEJoZEdWdWRDQnlhV2RvZEhNZ1kyRnVJR0psSUdadmRXNWtJR2x1SUhSb1pTQlFRVlJGVGxSVElHWnBiR1VnYVc0Z2RHaGxJSE5oYldVZ1pHbHlaV04wYjNKNUxseHVJQ3BjYmlBcUwxeHVYRzRuZFhObElITjBjbWxqZENjN1hHNWNiblpoY2lCbGJYQjBlVTlpYW1WamRDQTlJSHQ5TzF4dVhHNXBaaUFvY0hKdlkyVnpjeTVsYm5ZdVRrOUVSVjlGVGxZZ0lUMDlJQ2R3Y205a2RXTjBhVzl1SnlrZ2UxeHVJQ0JQWW1wbFkzUXVabkpsWlhwbEtHVnRjSFI1VDJKcVpXTjBLVHRjYm4xY2JseHViVzlrZFd4bExtVjRjRzl5ZEhNZ1BTQmxiWEIwZVU5aWFtVmpkRHNpTENJdktpcGNiaUFxSUVOdmNIbHlhV2RvZENBb1l5a2dNakF4TXkxd2NtVnpaVzUwTENCR1lXTmxZbTl2YXl3Z1NXNWpMbHh1SUNvZ1FXeHNJSEpwWjJoMGN5QnlaWE5sY25abFpDNWNiaUFxWEc0Z0tpQlVhR2x6SUhOdmRYSmpaU0JqYjJSbElHbHpJR3hwWTJWdWMyVmtJSFZ1WkdWeUlIUm9aU0JDVTBRdGMzUjViR1VnYkdsalpXNXpaU0JtYjNWdVpDQnBiaUIwYUdWY2JpQXFJRXhKUTBWT1UwVWdabWxzWlNCcGJpQjBhR1VnY205dmRDQmthWEpsWTNSdmNua2diMllnZEdocGN5QnpiM1Z5WTJVZ2RISmxaUzRnUVc0Z1lXUmthWFJwYjI1aGJDQm5jbUZ1ZEZ4dUlDb2diMllnY0dGMFpXNTBJSEpwWjJoMGN5QmpZVzRnWW1VZ1ptOTFibVFnYVc0Z2RHaGxJRkJCVkVWT1ZGTWdabWxzWlNCcGJpQjBhR1VnYzJGdFpTQmthWEpsWTNSdmNua3VYRzRnS2x4dUlDb3ZYRzVjYmlkMWMyVWdjM1J5YVdOMEp6dGNibHh1THlvcVhHNGdLaUJWYzJVZ2FXNTJZWEpwWVc1MEtDa2dkRzhnWVhOelpYSjBJSE4wWVhSbElIZG9hV05vSUhsdmRYSWdjSEp2WjNKaGJTQmhjM04xYldWeklIUnZJR0psSUhSeWRXVXVYRzRnS2x4dUlDb2dVSEp2ZG1sa1pTQnpjSEpwYm5SbUxYTjBlV3hsSUdadmNtMWhkQ0FvYjI1c2VTQWxjeUJwY3lCemRYQndiM0owWldRcElHRnVaQ0JoY21kMWJXVnVkSE5jYmlBcUlIUnZJSEJ5YjNacFpHVWdhVzVtYjNKdFlYUnBiMjRnWVdKdmRYUWdkMmhoZENCaWNtOXJaU0JoYm1RZ2QyaGhkQ0I1YjNVZ2QyVnlaVnh1SUNvZ1pYaHdaV04wYVc1bkxseHVJQ3BjYmlBcUlGUm9aU0JwYm5aaGNtbGhiblFnYldWemMyRm5aU0IzYVd4c0lHSmxJSE4wY21sd2NHVmtJR2x1SUhCeWIyUjFZM1JwYjI0c0lHSjFkQ0IwYUdVZ2FXNTJZWEpwWVc1MFhHNGdLaUIzYVd4c0lISmxiV0ZwYmlCMGJ5Qmxibk4xY21VZ2JHOW5hV01nWkc5bGN5QnViM1FnWkdsbVptVnlJR2x1SUhCeWIyUjFZM1JwYjI0dVhHNGdLaTljYmx4dWRtRnlJSFpoYkdsa1lYUmxSbTl5YldGMElEMGdablZ1WTNScGIyNGdkbUZzYVdSaGRHVkdiM0p0WVhRb1ptOXliV0YwS1NCN2ZUdGNibHh1YVdZZ0tIQnliMk5sYzNNdVpXNTJMazVQUkVWZlJVNVdJQ0U5UFNBbmNISnZaSFZqZEdsdmJpY3BJSHRjYmlBZ2RtRnNhV1JoZEdWR2IzSnRZWFFnUFNCbWRXNWpkR2x2YmlCMllXeHBaR0YwWlVadmNtMWhkQ2htYjNKdFlYUXBJSHRjYmlBZ0lDQnBaaUFvWm05eWJXRjBJRDA5UFNCMWJtUmxabWx1WldRcElIdGNiaUFnSUNBZ0lIUm9jbTkzSUc1bGR5QkZjbkp2Y2lnbmFXNTJZWEpwWVc1MElISmxjWFZwY21WeklHRnVJR1Z5Y205eUlHMWxjM05oWjJVZ1lYSm5kVzFsYm5RbktUdGNiaUFnSUNCOVhHNGdJSDA3WEc1OVhHNWNibVoxYm1OMGFXOXVJR2x1ZG1GeWFXRnVkQ2hqYjI1a2FYUnBiMjRzSUdadmNtMWhkQ3dnWVN3Z1lpd2dZeXdnWkN3Z1pTd2daaWtnZTF4dUlDQjJZV3hwWkdGMFpVWnZjbTFoZENobWIzSnRZWFFwTzF4dVhHNGdJR2xtSUNnaFkyOXVaR2wwYVc5dUtTQjdYRzRnSUNBZ2RtRnlJR1Z5Y205eU8xeHVJQ0FnSUdsbUlDaG1iM0p0WVhRZ1BUMDlJSFZ1WkdWbWFXNWxaQ2tnZTF4dUlDQWdJQ0FnWlhKeWIzSWdQU0J1WlhjZ1JYSnliM0lvSjAxcGJtbG1hV1ZrSUdWNFkyVndkR2x2YmlCdlkyTjFjbkpsWkRzZ2RYTmxJSFJvWlNCdWIyNHRiV2x1YVdacFpXUWdaR1YySUdWdWRtbHliMjV0Wlc1MElDY2dLeUFuWm05eUlIUm9aU0JtZFd4c0lHVnljbTl5SUcxbGMzTmhaMlVnWVc1a0lHRmtaR2wwYVc5dVlXd2dhR1ZzY0daMWJDQjNZWEp1YVc1bmN5NG5LVHRjYmlBZ0lDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUNBZ2RtRnlJR0Z5WjNNZ1BTQmJZU3dnWWl3Z1l5d2daQ3dnWlN3Z1psMDdYRzRnSUNBZ0lDQjJZWElnWVhKblNXNWtaWGdnUFNBd08xeHVJQ0FnSUNBZ1pYSnliM0lnUFNCdVpYY2dSWEp5YjNJb1ptOXliV0YwTG5KbGNHeGhZMlVvTHlWekwyY3NJR1oxYm1OMGFXOXVJQ2dwSUh0Y2JpQWdJQ0FnSUNBZ2NtVjBkWEp1SUdGeVozTmJZWEpuU1c1a1pYZ3JLMTA3WEc0Z0lDQWdJQ0I5S1NrN1hHNGdJQ0FnSUNCbGNuSnZjaTV1WVcxbElEMGdKMGx1ZG1GeWFXRnVkQ0JXYVc5c1lYUnBiMjRuTzF4dUlDQWdJSDFjYmx4dUlDQWdJR1Z5Y205eUxtWnlZVzFsYzFSdlVHOXdJRDBnTVRzZ0x5OGdkMlVnWkc5dUozUWdZMkZ5WlNCaFltOTFkQ0JwYm5aaGNtbGhiblFuY3lCdmQyNGdabkpoYldWY2JpQWdJQ0IwYUhKdmR5Qmxjbkp2Y2p0Y2JpQWdmVnh1ZlZ4dVhHNXRiMlIxYkdVdVpYaHdiM0owY3lBOUlHbHVkbUZ5YVdGdWREc2lMQ0l2S2lwY2JpQXFJRU52Y0hseWFXZG9kQ0F5TURFMExUSXdNVFVzSUVaaFkyVmliMjlyTENCSmJtTXVYRzRnS2lCQmJHd2djbWxuYUhSeklISmxjMlZ5ZG1Wa0xseHVJQ3BjYmlBcUlGUm9hWE1nYzI5MWNtTmxJR052WkdVZ2FYTWdiR2xqWlc1elpXUWdkVzVrWlhJZ2RHaGxJRUpUUkMxemRIbHNaU0JzYVdObGJuTmxJR1p2ZFc1a0lHbHVJSFJvWlZ4dUlDb2dURWxEUlU1VFJTQm1hV3hsSUdsdUlIUm9aU0J5YjI5MElHUnBjbVZqZEc5eWVTQnZaaUIwYUdseklITnZkWEpqWlNCMGNtVmxMaUJCYmlCaFpHUnBkR2x2Ym1Gc0lHZHlZVzUwWEc0Z0tpQnZaaUJ3WVhSbGJuUWdjbWxuYUhSeklHTmhiaUJpWlNCbWIzVnVaQ0JwYmlCMGFHVWdVRUZVUlU1VVV5Qm1hV3hsSUdsdUlIUm9aU0J6WVcxbElHUnBjbVZqZEc5eWVTNWNiaUFxWEc0Z0tpOWNibHh1SjNWelpTQnpkSEpwWTNRbk8xeHVYRzUyWVhJZ1pXMXdkSGxHZFc1amRHbHZiaUE5SUhKbGNYVnBjbVVvSnk0dlpXMXdkSGxHZFc1amRHbHZiaWNwTzF4dVhHNHZLaXBjYmlBcUlGTnBiV2xzWVhJZ2RHOGdhVzUyWVhKcFlXNTBJR0oxZENCdmJteDVJR3h2WjNNZ1lTQjNZWEp1YVc1bklHbG1JSFJvWlNCamIyNWthWFJwYjI0Z2FYTWdibTkwSUcxbGRDNWNiaUFxSUZSb2FYTWdZMkZ1SUdKbElIVnpaV1FnZEc4Z2JHOW5JR2x6YzNWbGN5QnBiaUJrWlhabGJHOXdiV1Z1ZENCbGJuWnBjbTl1YldWdWRITWdhVzRnWTNKcGRHbGpZV3hjYmlBcUlIQmhkR2h6TGlCU1pXMXZkbWx1WnlCMGFHVWdiRzluWjJsdVp5QmpiMlJsSUdadmNpQndjbTlrZFdOMGFXOXVJR1Z1ZG1seWIyNXRaVzUwY3lCM2FXeHNJR3RsWlhBZ2RHaGxYRzRnS2lCellXMWxJR3h2WjJsaklHRnVaQ0JtYjJ4c2IzY2dkR2hsSUhOaGJXVWdZMjlrWlNCd1lYUm9jeTVjYmlBcUwxeHVYRzUyWVhJZ2QyRnlibWx1WnlBOUlHVnRjSFI1Um5WdVkzUnBiMjQ3WEc1Y2JtbG1JQ2h3Y205alpYTnpMbVZ1ZGk1T1QwUkZYMFZPVmlBaFBUMGdKM0J5YjJSMVkzUnBiMjRuS1NCN1hHNGdJSFpoY2lCd2NtbHVkRmRoY201cGJtY2dQU0JtZFc1amRHbHZiaUJ3Y21sdWRGZGhjbTVwYm1jb1ptOXliV0YwS1NCN1hHNGdJQ0FnWm05eUlDaDJZWElnWDJ4bGJpQTlJR0Z5WjNWdFpXNTBjeTVzWlc1bmRHZ3NJR0Z5WjNNZ1BTQkJjbkpoZVNoZmJHVnVJRDRnTVNBL0lGOXNaVzRnTFNBeElEb2dNQ2tzSUY5clpYa2dQU0F4T3lCZmEyVjVJRHdnWDJ4bGJqc2dYMnRsZVNzcktTQjdYRzRnSUNBZ0lDQmhjbWR6VzE5clpYa2dMU0F4WFNBOUlHRnlaM1Z0Wlc1MGMxdGZhMlY1WFR0Y2JpQWdJQ0I5WEc1Y2JpQWdJQ0IyWVhJZ1lYSm5TVzVrWlhnZ1BTQXdPMXh1SUNBZ0lIWmhjaUJ0WlhOellXZGxJRDBnSjFkaGNtNXBibWM2SUNjZ0t5Qm1iM0p0WVhRdWNtVndiR0ZqWlNndkpYTXZaeXdnWm5WdVkzUnBiMjRnS0NrZ2UxeHVJQ0FnSUNBZ2NtVjBkWEp1SUdGeVozTmJZWEpuU1c1a1pYZ3JLMTA3WEc0Z0lDQWdmU2s3WEc0Z0lDQWdhV1lnS0hSNWNHVnZaaUJqYjI1emIyeGxJQ0U5UFNBbmRXNWtaV1pwYm1Wa0p5a2dlMXh1SUNBZ0lDQWdZMjl1YzI5c1pTNWxjbkp2Y2lodFpYTnpZV2RsS1R0Y2JpQWdJQ0I5WEc0Z0lDQWdkSEo1SUh0Y2JpQWdJQ0FnSUM4dklDMHRMU0JYWld4amIyMWxJSFJ2SUdSbFluVm5aMmx1WnlCU1pXRmpkQ0F0TFMxY2JpQWdJQ0FnSUM4dklGUm9hWE1nWlhKeWIzSWdkMkZ6SUhSb2NtOTNiaUJoY3lCaElHTnZiblpsYm1sbGJtTmxJSE52SUhSb1lYUWdlVzkxSUdOaGJpQjFjMlVnZEdocGN5QnpkR0ZqYTF4dUlDQWdJQ0FnTHk4Z2RHOGdabWx1WkNCMGFHVWdZMkZzYkhOcGRHVWdkR2hoZENCallYVnpaV1FnZEdocGN5QjNZWEp1YVc1bklIUnZJR1pwY21VdVhHNGdJQ0FnSUNCMGFISnZkeUJ1WlhjZ1JYSnliM0lvYldWemMyRm5aU2s3WEc0Z0lDQWdmU0JqWVhSamFDQW9lQ2tnZTMxY2JpQWdmVHRjYmx4dUlDQjNZWEp1YVc1bklEMGdablZ1WTNScGIyNGdkMkZ5Ym1sdVp5aGpiMjVrYVhScGIyNHNJR1p2Y20xaGRDa2dlMXh1SUNBZ0lHbG1JQ2htYjNKdFlYUWdQVDA5SUhWdVpHVm1hVzVsWkNrZ2UxeHVJQ0FnSUNBZ2RHaHliM2NnYm1WM0lFVnljbTl5S0NkZ2QyRnlibWx1WnloamIyNWthWFJwYjI0c0lHWnZjbTFoZEN3Z0xpNHVZWEpuY3lsZ0lISmxjWFZwY21WeklHRWdkMkZ5Ym1sdVp5QW5JQ3NnSjIxbGMzTmhaMlVnWVhKbmRXMWxiblFuS1R0Y2JpQWdJQ0I5WEc1Y2JpQWdJQ0JwWmlBb1ptOXliV0YwTG1sdVpHVjRUMllvSjBaaGFXeGxaQ0JEYjIxd2IzTnBkR1VnY0hKdmNGUjVjR1U2SUNjcElEMDlQU0F3S1NCN1hHNGdJQ0FnSUNCeVpYUjFjbTQ3SUM4dklFbG5ibTl5WlNCRGIyMXdiM05wZEdWRGIyMXdiMjVsYm5RZ2NISnZjSFI1Y0dVZ1kyaGxZMnN1WEc0Z0lDQWdmVnh1WEc0Z0lDQWdhV1lnS0NGamIyNWthWFJwYjI0cElIdGNiaUFnSUNBZ0lHWnZjaUFvZG1GeUlGOXNaVzR5SUQwZ1lYSm5kVzFsYm5SekxteGxibWQwYUN3Z1lYSm5jeUE5SUVGeWNtRjVLRjlzWlc0eUlENGdNaUEvSUY5c1pXNHlJQzBnTWlBNklEQXBMQ0JmYTJWNU1pQTlJREk3SUY5clpYa3lJRHdnWDJ4bGJqSTdJRjlyWlhreUt5c3BJSHRjYmlBZ0lDQWdJQ0FnWVhKbmMxdGZhMlY1TWlBdElESmRJRDBnWVhKbmRXMWxiblJ6VzE5clpYa3lYVHRjYmlBZ0lDQWdJSDFjYmx4dUlDQWdJQ0FnY0hKcGJuUlhZWEp1YVc1bkxtRndjR3g1S0hWdVpHVm1hVzVsWkN3Z1cyWnZjbTFoZEYwdVkyOXVZMkYwS0dGeVozTXBLVHRjYmlBZ0lDQjlYRzRnSUgwN1hHNTlYRzVjYm0xdlpIVnNaUzVsZUhCdmNuUnpJRDBnZDJGeWJtbHVaenNpTENJdktpRmNiaUFxSUVSbGRHVnliV2x1WlNCcFppQmhiaUJ2WW1wbFkzUWdhWE1nWVNCQ2RXWm1aWEpjYmlBcVhHNGdLaUJBWVhWMGFHOXlJQ0FnUm1WeWIzTnpJRUZpYjNWcmFHRmthV3BsYUNBOFptVnliM056UUdabGNtOXpjeTV2Y21jK0lEeG9kSFJ3T2k4dlptVnliM056TG05eVp6NWNiaUFxSUVCc2FXTmxibk5sSUNCTlNWUmNiaUFxTDF4dVhHNHZMeUJVYUdVZ1gybHpRblZtWm1WeUlHTm9aV05ySUdseklHWnZjaUJUWVdaaGNta2dOUzAzSUhOMWNIQnZjblFzSUdKbFkyRjFjMlVnYVhRbmN5QnRhWE56YVc1blhHNHZMeUJQWW1wbFkzUXVjSEp2ZEc5MGVYQmxMbU52Ym5OMGNuVmpkRzl5TGlCU1pXMXZkbVVnZEdocGN5QmxkbVZ1ZEhWaGJHeDVYRzV0YjJSMWJHVXVaWGh3YjNKMGN5QTlJR1oxYm1OMGFXOXVJQ2h2WW1vcElIdGNiaUFnY21WMGRYSnVJRzlpYWlBaFBTQnVkV3hzSUNZbUlDaHBjMEoxWm1abGNpaHZZbW9wSUh4OElHbHpVMnh2ZDBKMVptWmxjaWh2WW1vcElIeDhJQ0VoYjJKcUxsOXBjMEoxWm1abGNpbGNibjFjYmx4dVpuVnVZM1JwYjI0Z2FYTkNkV1ptWlhJZ0tHOWlhaWtnZTF4dUlDQnlaWFIxY200Z0lTRnZZbW91WTI5dWMzUnlkV04wYjNJZ0ppWWdkSGx3Wlc5bUlHOWlhaTVqYjI1emRISjFZM1J2Y2k1cGMwSjFabVpsY2lBOVBUMGdKMloxYm1OMGFXOXVKeUFtSmlCdlltb3VZMjl1YzNSeWRXTjBiM0l1YVhOQ2RXWm1aWElvYjJKcUtWeHVmVnh1WEc0dkx5QkdiM0lnVG05a1pTQjJNQzR4TUNCemRYQndiM0owTGlCU1pXMXZkbVVnZEdocGN5QmxkbVZ1ZEhWaGJHeDVMbHh1Wm5WdVkzUnBiMjRnYVhOVGJHOTNRblZtWm1WeUlDaHZZbW9wSUh0Y2JpQWdjbVYwZFhKdUlIUjVjR1Z2WmlCdlltb3VjbVZoWkVac2IyRjBURVVnUFQwOUlDZG1kVzVqZEdsdmJpY2dKaVlnZEhsd1pXOW1JRzlpYWk1emJHbGpaU0E5UFQwZ0oyWjFibU4wYVc5dUp5QW1KaUJwYzBKMVptWmxjaWh2WW1vdWMyeHBZMlVvTUN3Z01Da3BYRzU5WEc0aUxDSXZMeUJ6YUdsdElHWnZjaUIxYzJsdVp5QndjbTlqWlhOeklHbHVJR0p5YjNkelpYSmNiblpoY2lCd2NtOWpaWE56SUQwZ2JXOWtkV3hsTG1WNGNHOXlkSE1nUFNCN2ZUdGNibHh1THk4Z1kyRmphR1ZrSUdaeWIyMGdkMmhoZEdWMlpYSWdaMnh2WW1Gc0lHbHpJSEJ5WlhObGJuUWdjMjhnZEdoaGRDQjBaWE4wSUhKMWJtNWxjbk1nZEdoaGRDQnpkSFZpSUdsMFhHNHZMeUJrYjI0bmRDQmljbVZoYXlCMGFHbHVaM011SUNCQ2RYUWdkMlVnYm1WbFpDQjBieUIzY21Gd0lHbDBJR2x1SUdFZ2RISjVJR05oZEdOb0lHbHVJR05oYzJVZ2FYUWdhWE5jYmk4dklIZHlZWEJ3WldRZ2FXNGdjM1J5YVdOMElHMXZaR1VnWTI5a1pTQjNhR2xqYUNCa2IyVnpiaWQwSUdSbFptbHVaU0JoYm5rZ1oyeHZZbUZzY3k0Z0lFbDBKM01nYVc1emFXUmxJR0ZjYmk4dklHWjFibU4wYVc5dUlHSmxZMkYxYzJVZ2RISjVMMk5oZEdOb1pYTWdaR1Z2Y0hScGJXbDZaU0JwYmlCalpYSjBZV2x1SUdWdVoybHVaWE11WEc1Y2JuWmhjaUJqWVdOb1pXUlRaWFJVYVcxbGIzVjBPMXh1ZG1GeUlHTmhZMmhsWkVOc1pXRnlWR2x0Wlc5MWREdGNibHh1Wm5WdVkzUnBiMjRnWkdWbVlYVnNkRk5sZEZScGJXOTFkQ2dwSUh0Y2JpQWdJQ0IwYUhKdmR5QnVaWGNnUlhKeWIzSW9KM05sZEZScGJXVnZkWFFnYUdGeklHNXZkQ0JpWldWdUlHUmxabWx1WldRbktUdGNibjFjYm1aMWJtTjBhVzl1SUdSbFptRjFiSFJEYkdWaGNsUnBiV1Z2ZFhRZ0tDa2dlMXh1SUNBZ0lIUm9jbTkzSUc1bGR5QkZjbkp2Y2lnblkyeGxZWEpVYVcxbGIzVjBJR2hoY3lCdWIzUWdZbVZsYmlCa1pXWnBibVZrSnlrN1hHNTlYRzRvWm5WdVkzUnBiMjRnS0NrZ2UxeHVJQ0FnSUhSeWVTQjdYRzRnSUNBZ0lDQWdJR2xtSUNoMGVYQmxiMllnYzJWMFZHbHRaVzkxZENBOVBUMGdKMloxYm1OMGFXOXVKeWtnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdZMkZqYUdWa1UyVjBWR2x0Wlc5MWRDQTlJSE5sZEZScGJXVnZkWFE3WEc0Z0lDQWdJQ0FnSUgwZ1pXeHpaU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQmpZV05vWldSVFpYUlVhVzFsYjNWMElEMGdaR1ZtWVhWc2RGTmxkRlJwYlc5MWREdGNiaUFnSUNBZ0lDQWdmVnh1SUNBZ0lIMGdZMkYwWTJnZ0tHVXBJSHRjYmlBZ0lDQWdJQ0FnWTJGamFHVmtVMlYwVkdsdFpXOTFkQ0E5SUdSbFptRjFiSFJUWlhSVWFXMXZkWFE3WEc0Z0lDQWdmVnh1SUNBZ0lIUnllU0I3WEc0Z0lDQWdJQ0FnSUdsbUlDaDBlWEJsYjJZZ1kyeGxZWEpVYVcxbGIzVjBJRDA5UFNBblpuVnVZM1JwYjI0bktTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNCallXTm9aV1JEYkdWaGNsUnBiV1Z2ZFhRZ1BTQmpiR1ZoY2xScGJXVnZkWFE3WEc0Z0lDQWdJQ0FnSUgwZ1pXeHpaU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQmpZV05vWldSRGJHVmhjbFJwYldWdmRYUWdQU0JrWldaaGRXeDBRMnhsWVhKVWFXMWxiM1YwTzF4dUlDQWdJQ0FnSUNCOVhHNGdJQ0FnZlNCallYUmphQ0FvWlNrZ2UxeHVJQ0FnSUNBZ0lDQmpZV05vWldSRGJHVmhjbFJwYldWdmRYUWdQU0JrWldaaGRXeDBRMnhsWVhKVWFXMWxiM1YwTzF4dUlDQWdJSDFjYm4wZ0tDa3BYRzVtZFc1amRHbHZiaUJ5ZFc1VWFXMWxiM1YwS0daMWJpa2dlMXh1SUNBZ0lHbG1JQ2hqWVdOb1pXUlRaWFJVYVcxbGIzVjBJRDA5UFNCelpYUlVhVzFsYjNWMEtTQjdYRzRnSUNBZ0lDQWdJQzh2Ym05eWJXRnNJR1Z1ZG1seWIyMWxiblJ6SUdsdUlITmhibVVnYzJsMGRXRjBhVzl1YzF4dUlDQWdJQ0FnSUNCeVpYUjFjbTRnYzJWMFZHbHRaVzkxZENobWRXNHNJREFwTzF4dUlDQWdJSDFjYmlBZ0lDQXZMeUJwWmlCelpYUlVhVzFsYjNWMElIZGhjMjRuZENCaGRtRnBiR0ZpYkdVZ1luVjBJSGRoY3lCc1lYUjBaWElnWkdWbWFXNWxaRnh1SUNBZ0lHbG1JQ2dvWTJGamFHVmtVMlYwVkdsdFpXOTFkQ0E5UFQwZ1pHVm1ZWFZzZEZObGRGUnBiVzkxZENCOGZDQWhZMkZqYUdWa1UyVjBWR2x0Wlc5MWRDa2dKaVlnYzJWMFZHbHRaVzkxZENrZ2UxeHVJQ0FnSUNBZ0lDQmpZV05vWldSVFpYUlVhVzFsYjNWMElEMGdjMlYwVkdsdFpXOTFkRHRjYmlBZ0lDQWdJQ0FnY21WMGRYSnVJSE5sZEZScGJXVnZkWFFvWm5WdUxDQXdLVHRjYmlBZ0lDQjlYRzRnSUNBZ2RISjVJSHRjYmlBZ0lDQWdJQ0FnTHk4Z2QyaGxiaUIzYUdWdUlITnZiV1ZpYjJSNUlHaGhjeUJ6WTNKbGQyVmtJSGRwZEdnZ2MyVjBWR2x0Wlc5MWRDQmlkWFFnYm04Z1NTNUZMaUJ0WVdSa2JtVnpjMXh1SUNBZ0lDQWdJQ0J5WlhSMWNtNGdZMkZqYUdWa1UyVjBWR2x0Wlc5MWRDaG1kVzRzSURBcE8xeHVJQ0FnSUgwZ1kyRjBZMmdvWlNsN1hHNGdJQ0FnSUNBZ0lIUnllU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQXZMeUJYYUdWdUlIZGxJR0Z5WlNCcGJpQkpMa1V1SUdKMWRDQjBhR1VnYzJOeWFYQjBJR2hoY3lCaVpXVnVJR1YyWVd4bFpDQnpieUJKTGtVdUlHUnZaWE51SjNRZ2RISjFjM1FnZEdobElHZHNiMkpoYkNCdlltcGxZM1FnZDJobGJpQmpZV3hzWldRZ2JtOXliV0ZzYkhsY2JpQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQmpZV05vWldSVFpYUlVhVzFsYjNWMExtTmhiR3dvYm5Wc2JDd2dablZ1TENBd0tUdGNiaUFnSUNBZ0lDQWdmU0JqWVhSamFDaGxLWHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDOHZJSE5oYldVZ1lYTWdZV0p2ZG1VZ1luVjBJSGRvWlc0Z2FYUW5jeUJoSUhabGNuTnBiMjRnYjJZZ1NTNUZMaUIwYUdGMElHMTFjM1FnYUdGMlpTQjBhR1VnWjJ4dlltRnNJRzlpYW1WamRDQm1iM0lnSjNSb2FYTW5MQ0JvYjNCbWRXeHNlU0J2ZFhJZ1kyOXVkR1Y0ZENCamIzSnlaV04wSUc5MGFHVnlkMmx6WlNCcGRDQjNhV3hzSUhSb2NtOTNJR0VnWjJ4dlltRnNJR1Z5Y205eVhHNGdJQ0FnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdZMkZqYUdWa1UyVjBWR2x0Wlc5MWRDNWpZV3hzS0hSb2FYTXNJR1oxYml3Z01DazdYRzRnSUNBZ0lDQWdJSDFjYmlBZ0lDQjlYRzVjYmx4dWZWeHVablZ1WTNScGIyNGdjblZ1UTJ4bFlYSlVhVzFsYjNWMEtHMWhjbXRsY2lrZ2UxeHVJQ0FnSUdsbUlDaGpZV05vWldSRGJHVmhjbFJwYldWdmRYUWdQVDA5SUdOc1pXRnlWR2x0Wlc5MWRDa2dlMXh1SUNBZ0lDQWdJQ0F2TDI1dmNtMWhiQ0JsYm5acGNtOXRaVzUwY3lCcGJpQnpZVzVsSUhOcGRIVmhkR2x2Ym5OY2JpQWdJQ0FnSUNBZ2NtVjBkWEp1SUdOc1pXRnlWR2x0Wlc5MWRDaHRZWEpyWlhJcE8xeHVJQ0FnSUgxY2JpQWdJQ0F2THlCcFppQmpiR1ZoY2xScGJXVnZkWFFnZDJGemJpZDBJR0YyWVdsc1lXSnNaU0JpZFhRZ2QyRnpJR3hoZEhSbGNpQmtaV1pwYm1Wa1hHNGdJQ0FnYVdZZ0tDaGpZV05vWldSRGJHVmhjbFJwYldWdmRYUWdQVDA5SUdSbFptRjFiSFJEYkdWaGNsUnBiV1Z2ZFhRZ2ZId2dJV05oWTJobFpFTnNaV0Z5VkdsdFpXOTFkQ2tnSmlZZ1kyeGxZWEpVYVcxbGIzVjBLU0I3WEc0Z0lDQWdJQ0FnSUdOaFkyaGxaRU5zWldGeVZHbHRaVzkxZENBOUlHTnNaV0Z5VkdsdFpXOTFkRHRjYmlBZ0lDQWdJQ0FnY21WMGRYSnVJR05zWldGeVZHbHRaVzkxZENodFlYSnJaWElwTzF4dUlDQWdJSDFjYmlBZ0lDQjBjbmtnZTF4dUlDQWdJQ0FnSUNBdkx5QjNhR1Z1SUhkb1pXNGdjMjl0WldKdlpIa2dhR0Z6SUhOamNtVjNaV1FnZDJsMGFDQnpaWFJVYVcxbGIzVjBJR0oxZENCdWJ5QkpMa1V1SUcxaFpHUnVaWE56WEc0Z0lDQWdJQ0FnSUhKbGRIVnliaUJqWVdOb1pXUkRiR1ZoY2xScGJXVnZkWFFvYldGeWEyVnlLVHRjYmlBZ0lDQjlJR05oZEdOb0lDaGxLWHRjYmlBZ0lDQWdJQ0FnZEhKNUlIdGNiaUFnSUNBZ0lDQWdJQ0FnSUM4dklGZG9aVzRnZDJVZ1lYSmxJR2x1SUVrdVJTNGdZblYwSUhSb1pTQnpZM0pwY0hRZ2FHRnpJR0psWlc0Z1pYWmhiR1ZrSUhOdklFa3VSUzRnWkc5bGMyNG5kQ0FnZEhKMWMzUWdkR2hsSUdkc2IySmhiQ0J2WW1wbFkzUWdkMmhsYmlCallXeHNaV1FnYm05eWJXRnNiSGxjYmlBZ0lDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCallXTm9aV1JEYkdWaGNsUnBiV1Z2ZFhRdVkyRnNiQ2h1ZFd4c0xDQnRZWEpyWlhJcE8xeHVJQ0FnSUNBZ0lDQjlJR05oZEdOb0lDaGxLWHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDOHZJSE5oYldVZ1lYTWdZV0p2ZG1VZ1luVjBJSGRvWlc0Z2FYUW5jeUJoSUhabGNuTnBiMjRnYjJZZ1NTNUZMaUIwYUdGMElHMTFjM1FnYUdGMlpTQjBhR1VnWjJ4dlltRnNJRzlpYW1WamRDQm1iM0lnSjNSb2FYTW5MQ0JvYjNCbWRXeHNlU0J2ZFhJZ1kyOXVkR1Y0ZENCamIzSnlaV04wSUc5MGFHVnlkMmx6WlNCcGRDQjNhV3hzSUhSb2NtOTNJR0VnWjJ4dlltRnNJR1Z5Y205eUxseHVJQ0FnSUNBZ0lDQWdJQ0FnTHk4Z1UyOXRaU0IyWlhKemFXOXVjeUJ2WmlCSkxrVXVJR2hoZG1VZ1pHbG1abVZ5Wlc1MElISjFiR1Z6SUdadmNpQmpiR1ZoY2xScGJXVnZkWFFnZG5NZ2MyVjBWR2x0Wlc5MWRGeHVJQ0FnSUNBZ0lDQWdJQ0FnY21WMGRYSnVJR05oWTJobFpFTnNaV0Z5VkdsdFpXOTFkQzVqWVd4c0tIUm9hWE1zSUcxaGNtdGxjaWs3WEc0Z0lDQWdJQ0FnSUgxY2JpQWdJQ0I5WEc1Y2JseHVYRzU5WEc1MllYSWdjWFZsZFdVZ1BTQmJYVHRjYm5aaGNpQmtjbUZwYm1sdVp5QTlJR1poYkhObE8xeHVkbUZ5SUdOMWNuSmxiblJSZFdWMVpUdGNiblpoY2lCeGRXVjFaVWx1WkdWNElEMGdMVEU3WEc1Y2JtWjFibU4wYVc5dUlHTnNaV0Z1VlhCT1pYaDBWR2xqYXlncElIdGNiaUFnSUNCcFppQW9JV1J5WVdsdWFXNW5JSHg4SUNGamRYSnlaVzUwVVhWbGRXVXBJSHRjYmlBZ0lDQWdJQ0FnY21WMGRYSnVPMXh1SUNBZ0lIMWNiaUFnSUNCa2NtRnBibWx1WnlBOUlHWmhiSE5sTzF4dUlDQWdJR2xtSUNoamRYSnlaVzUwVVhWbGRXVXViR1Z1WjNSb0tTQjdYRzRnSUNBZ0lDQWdJSEYxWlhWbElEMGdZM1Z5Y21WdWRGRjFaWFZsTG1OdmJtTmhkQ2h4ZFdWMVpTazdYRzRnSUNBZ2ZTQmxiSE5sSUh0Y2JpQWdJQ0FnSUNBZ2NYVmxkV1ZKYm1SbGVDQTlJQzB4TzF4dUlDQWdJSDFjYmlBZ0lDQnBaaUFvY1hWbGRXVXViR1Z1WjNSb0tTQjdYRzRnSUNBZ0lDQWdJR1J5WVdsdVVYVmxkV1VvS1R0Y2JpQWdJQ0I5WEc1OVhHNWNibVoxYm1OMGFXOXVJR1J5WVdsdVVYVmxkV1VvS1NCN1hHNGdJQ0FnYVdZZ0tHUnlZV2x1YVc1bktTQjdYRzRnSUNBZ0lDQWdJSEpsZEhWeWJqdGNiaUFnSUNCOVhHNGdJQ0FnZG1GeUlIUnBiV1Z2ZFhRZ1BTQnlkVzVVYVcxbGIzVjBLR05zWldGdVZYQk9aWGgwVkdsamF5azdYRzRnSUNBZ1pISmhhVzVwYm1jZ1BTQjBjblZsTzF4dVhHNGdJQ0FnZG1GeUlHeGxiaUE5SUhGMVpYVmxMbXhsYm1kMGFEdGNiaUFnSUNCM2FHbHNaU2hzWlc0cElIdGNiaUFnSUNBZ0lDQWdZM1Z5Y21WdWRGRjFaWFZsSUQwZ2NYVmxkV1U3WEc0Z0lDQWdJQ0FnSUhGMVpYVmxJRDBnVzEwN1hHNGdJQ0FnSUNBZ0lIZG9hV3hsSUNnckszRjFaWFZsU1c1a1pYZ2dQQ0JzWlc0cElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUdsbUlDaGpkWEp5Wlc1MFVYVmxkV1VwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCamRYSnlaVzUwVVhWbGRXVmJjWFZsZFdWSmJtUmxlRjB1Y25WdUtDazdYRzRnSUNBZ0lDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdjWFZsZFdWSmJtUmxlQ0E5SUMweE8xeHVJQ0FnSUNBZ0lDQnNaVzRnUFNCeGRXVjFaUzVzWlc1bmRHZzdYRzRnSUNBZ2ZWeHVJQ0FnSUdOMWNuSmxiblJSZFdWMVpTQTlJRzUxYkd3N1hHNGdJQ0FnWkhKaGFXNXBibWNnUFNCbVlXeHpaVHRjYmlBZ0lDQnlkVzVEYkdWaGNsUnBiV1Z2ZFhRb2RHbHRaVzkxZENrN1hHNTlYRzVjYm5CeWIyTmxjM011Ym1WNGRGUnBZMnNnUFNCbWRXNWpkR2x2YmlBb1puVnVLU0I3WEc0Z0lDQWdkbUZ5SUdGeVozTWdQU0J1WlhjZ1FYSnlZWGtvWVhKbmRXMWxiblJ6TG14bGJtZDBhQ0F0SURFcE8xeHVJQ0FnSUdsbUlDaGhjbWQxYldWdWRITXViR1Z1WjNSb0lENGdNU2tnZTF4dUlDQWdJQ0FnSUNCbWIzSWdLSFpoY2lCcElEMGdNVHNnYVNBOElHRnlaM1Z0Wlc1MGN5NXNaVzVuZEdnN0lHa3JLeWtnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdZWEpuYzF0cElDMGdNVjBnUFNCaGNtZDFiV1Z1ZEhOYmFWMDdYRzRnSUNBZ0lDQWdJSDFjYmlBZ0lDQjlYRzRnSUNBZ2NYVmxkV1V1Y0hWemFDaHVaWGNnU1hSbGJTaG1kVzRzSUdGeVozTXBLVHRjYmlBZ0lDQnBaaUFvY1hWbGRXVXViR1Z1WjNSb0lEMDlQU0F4SUNZbUlDRmtjbUZwYm1sdVp5a2dlMXh1SUNBZ0lDQWdJQ0J5ZFc1VWFXMWxiM1YwS0dSeVlXbHVVWFZsZFdVcE8xeHVJQ0FnSUgxY2JuMDdYRzVjYmk4dklIWTRJR3hwYTJWeklIQnlaV1JwWTNScFlteGxJRzlpYW1WamRITmNibVoxYm1OMGFXOXVJRWwwWlcwb1puVnVMQ0JoY25KaGVTa2dlMXh1SUNBZ0lIUm9hWE11Wm5WdUlEMGdablZ1TzF4dUlDQWdJSFJvYVhNdVlYSnlZWGtnUFNCaGNuSmhlVHRjYm4xY2JrbDBaVzB1Y0hKdmRHOTBlWEJsTG5KMWJpQTlJR1oxYm1OMGFXOXVJQ2dwSUh0Y2JpQWdJQ0IwYUdsekxtWjFiaTVoY0hCc2VTaHVkV3hzTENCMGFHbHpMbUZ5Y21GNUtUdGNibjA3WEc1d2NtOWpaWE56TG5ScGRHeGxJRDBnSjJKeWIzZHpaWEluTzF4dWNISnZZMlZ6Y3k1aWNtOTNjMlZ5SUQwZ2RISjFaVHRjYm5CeWIyTmxjM011Wlc1MklEMGdlMzA3WEc1d2NtOWpaWE56TG1GeVozWWdQU0JiWFR0Y2JuQnliMk5sYzNNdWRtVnljMmx2YmlBOUlDY25PeUF2THlCbGJYQjBlU0J6ZEhKcGJtY2dkRzhnWVhadmFXUWdjbVZuWlhod0lHbHpjM1ZsYzF4dWNISnZZMlZ6Y3k1MlpYSnphVzl1Y3lBOUlIdDlPMXh1WEc1bWRXNWpkR2x2YmlCdWIyOXdLQ2tnZTMxY2JseHVjSEp2WTJWemN5NXZiaUE5SUc1dmIzQTdYRzV3Y205alpYTnpMbUZrWkV4cGMzUmxibVZ5SUQwZ2JtOXZjRHRjYm5CeWIyTmxjM011YjI1alpTQTlJRzV2YjNBN1hHNXdjbTlqWlhOekxtOW1aaUE5SUc1dmIzQTdYRzV3Y205alpYTnpMbkpsYlc5MlpVeHBjM1JsYm1WeUlEMGdibTl2Y0R0Y2JuQnliMk5sYzNNdWNtVnRiM1psUVd4c1RHbHpkR1Z1WlhKeklEMGdibTl2Y0R0Y2JuQnliMk5sYzNNdVpXMXBkQ0E5SUc1dmIzQTdYRzV3Y205alpYTnpMbkJ5WlhCbGJtUk1hWE4wWlc1bGNpQTlJRzV2YjNBN1hHNXdjbTlqWlhOekxuQnlaWEJsYm1SUGJtTmxUR2x6ZEdWdVpYSWdQU0J1YjI5d08xeHVYRzV3Y205alpYTnpMbXhwYzNSbGJtVnljeUE5SUdaMWJtTjBhVzl1SUNodVlXMWxLU0I3SUhKbGRIVnliaUJiWFNCOVhHNWNibkJ5YjJObGMzTXVZbWx1WkdsdVp5QTlJR1oxYm1OMGFXOXVJQ2h1WVcxbEtTQjdYRzRnSUNBZ2RHaHliM2NnYm1WM0lFVnljbTl5S0Nkd2NtOWpaWE56TG1KcGJtUnBibWNnYVhNZ2JtOTBJSE4xY0hCdmNuUmxaQ2NwTzF4dWZUdGNibHh1Y0hKdlkyVnpjeTVqZDJRZ1BTQm1kVzVqZEdsdmJpQW9LU0I3SUhKbGRIVnliaUFuTHljZ2ZUdGNibkJ5YjJObGMzTXVZMmhrYVhJZ1BTQm1kVzVqZEdsdmJpQW9aR2x5S1NCN1hHNGdJQ0FnZEdoeWIzY2dibVYzSUVWeWNtOXlLQ2R3Y205alpYTnpMbU5vWkdseUlHbHpJRzV2ZENCemRYQndiM0owWldRbktUdGNibjA3WEc1d2NtOWpaWE56TG5WdFlYTnJJRDBnWm5WdVkzUnBiMjRvS1NCN0lISmxkSFZ5YmlBd095QjlPMXh1SWl3aUx5b3FYRzRnS2lCRGIzQjVjbWxuYUhRZ01qQXhNeTF3Y21WelpXNTBMQ0JHWVdObFltOXZheXdnU1c1akxseHVJQ29nUVd4c0lISnBaMmgwY3lCeVpYTmxjblpsWkM1Y2JpQXFYRzRnS2lCVWFHbHpJSE52ZFhKalpTQmpiMlJsSUdseklHeHBZMlZ1YzJWa0lIVnVaR1Z5SUhSb1pTQkNVMFF0YzNSNWJHVWdiR2xqWlc1elpTQm1iM1Z1WkNCcGJpQjBhR1ZjYmlBcUlFeEpRMFZPVTBVZ1ptbHNaU0JwYmlCMGFHVWdjbTl2ZENCa2FYSmxZM1J2Y25rZ2IyWWdkR2hwY3lCemIzVnlZMlVnZEhKbFpTNGdRVzRnWVdSa2FYUnBiMjVoYkNCbmNtRnVkRnh1SUNvZ2IyWWdjR0YwWlc1MElISnBaMmgwY3lCallXNGdZbVVnWm05MWJtUWdhVzRnZEdobElGQkJWRVZPVkZNZ1ptbHNaU0JwYmlCMGFHVWdjMkZ0WlNCa2FYSmxZM1J2Y25rdVhHNGdLaTljYmx4dUozVnpaU0J6ZEhKcFkzUW5PMXh1WEc1cFppQW9jSEp2WTJWemN5NWxibll1VGs5RVJWOUZUbFlnSVQwOUlDZHdjbTlrZFdOMGFXOXVKeWtnZTF4dUlDQjJZWElnYVc1MllYSnBZVzUwSUQwZ2NtVnhkV2x5WlNnblptSnFjeTlzYVdJdmFXNTJZWEpwWVc1MEp5azdYRzRnSUhaaGNpQjNZWEp1YVc1bklEMGdjbVZ4ZFdseVpTZ25abUpxY3k5c2FXSXZkMkZ5Ym1sdVp5Y3BPMXh1SUNCMllYSWdVbVZoWTNSUWNtOXdWSGx3WlhOVFpXTnlaWFFnUFNCeVpYRjFhWEpsS0NjdUwyeHBZaTlTWldGamRGQnliM0JVZVhCbGMxTmxZM0psZENjcE8xeHVJQ0IyWVhJZ2JHOW5aMlZrVkhsd1pVWmhhV3gxY21WeklEMGdlMzA3WEc1OVhHNWNiaThxS2x4dUlDb2dRWE56WlhKMElIUm9ZWFFnZEdobElIWmhiSFZsY3lCdFlYUmphQ0IzYVhSb0lIUm9aU0IwZVhCbElITndaV056TGx4dUlDb2dSWEp5YjNJZ2JXVnpjMkZuWlhNZ1lYSmxJRzFsYlc5eWFYcGxaQ0JoYm1RZ2QybHNiQ0J2Ym14NUlHSmxJSE5vYjNkdUlHOXVZMlV1WEc0Z0tseHVJQ29nUUhCaGNtRnRJSHR2WW1wbFkzUjlJSFI1Y0dWVGNHVmpjeUJOWVhBZ2IyWWdibUZ0WlNCMGJ5QmhJRkpsWVdOMFVISnZjRlI1Y0dWY2JpQXFJRUJ3WVhKaGJTQjdiMkpxWldOMGZTQjJZV3gxWlhNZ1VuVnVkR2x0WlNCMllXeDFaWE1nZEdoaGRDQnVaV1ZrSUhSdklHSmxJSFI1Y0dVdFkyaGxZMnRsWkZ4dUlDb2dRSEJoY21GdElIdHpkSEpwYm1kOUlHeHZZMkYwYVc5dUlHVXVaeTRnWENKd2NtOXdYQ0lzSUZ3aVkyOXVkR1Y0ZEZ3aUxDQmNJbU5vYVd4a0lHTnZiblJsZUhSY0lseHVJQ29nUUhCaGNtRnRJSHR6ZEhKcGJtZDlJR052YlhCdmJtVnVkRTVoYldVZ1RtRnRaU0J2WmlCMGFHVWdZMjl0Y0c5dVpXNTBJR1p2Y2lCbGNuSnZjaUJ0WlhOellXZGxjeTVjYmlBcUlFQndZWEpoYlNCN1AwWjFibU4wYVc5dWZTQm5aWFJUZEdGamF5QlNaWFIxY201eklIUm9aU0JqYjIxd2IyNWxiblFnYzNSaFkyc3VYRzRnS2lCQWNISnBkbUYwWlZ4dUlDb3ZYRzVtZFc1amRHbHZiaUJqYUdWamExQnliM0JVZVhCbGN5aDBlWEJsVTNCbFkzTXNJSFpoYkhWbGN5d2diRzlqWVhScGIyNHNJR052YlhCdmJtVnVkRTVoYldVc0lHZGxkRk4wWVdOcktTQjdYRzRnSUdsbUlDaHdjbTlqWlhOekxtVnVkaTVPVDBSRlgwVk9WaUFoUFQwZ0ozQnliMlIxWTNScGIyNG5LU0I3WEc0Z0lDQWdabTl5SUNoMllYSWdkSGx3WlZOd1pXTk9ZVzFsSUdsdUlIUjVjR1ZUY0dWamN5a2dlMXh1SUNBZ0lDQWdhV1lnS0hSNWNHVlRjR1ZqY3k1b1lYTlBkMjVRY205d1pYSjBlU2gwZVhCbFUzQmxZMDVoYldVcEtTQjdYRzRnSUNBZ0lDQWdJSFpoY2lCbGNuSnZjanRjYmlBZ0lDQWdJQ0FnTHk4Z1VISnZjQ0IwZVhCbElIWmhiR2xrWVhScGIyNGdiV0Y1SUhSb2NtOTNMaUJKYmlCallYTmxJSFJvWlhrZ1pHOHNJSGRsSUdSdmJpZDBJSGRoYm5RZ2RHOWNiaUFnSUNBZ0lDQWdMeThnWm1GcGJDQjBhR1VnY21WdVpHVnlJSEJvWVhObElIZG9aWEpsSUdsMElHUnBaRzRuZENCbVlXbHNJR0psWm05eVpTNGdVMjhnZDJVZ2JHOW5JR2wwTGx4dUlDQWdJQ0FnSUNBdkx5QkJablJsY2lCMGFHVnpaU0JvWVhabElHSmxaVzRnWTJ4bFlXNWxaQ0IxY0N3Z2QyVW5iR3dnYkdWMElIUm9aVzBnZEdoeWIzY3VYRzRnSUNBZ0lDQWdJSFJ5ZVNCN1hHNGdJQ0FnSUNBZ0lDQWdMeThnVkdocGN5QnBjeUJwYm5SbGJuUnBiMjVoYkd4NUlHRnVJR2x1ZG1GeWFXRnVkQ0IwYUdGMElHZGxkSE1nWTJGMVoyaDBMaUJKZENkeklIUm9aU0J6WVcxbFhHNGdJQ0FnSUNBZ0lDQWdMeThnWW1Wb1lYWnBiM0lnWVhNZ2QybDBhRzkxZENCMGFHbHpJSE4wWVhSbGJXVnVkQ0JsZUdObGNIUWdkMmwwYUNCaElHSmxkSFJsY2lCdFpYTnpZV2RsTGx4dUlDQWdJQ0FnSUNBZ0lHbHVkbUZ5YVdGdWRDaDBlWEJsYjJZZ2RIbHdaVk53WldOelczUjVjR1ZUY0dWalRtRnRaVjBnUFQwOUlDZG1kVzVqZEdsdmJpY3NJQ2NsY3pvZ0pYTWdkSGx3WlNCZ0pYTmdJR2x6SUdsdWRtRnNhV1E3SUdsMElHMTFjM1FnWW1VZ1lTQm1kVzVqZEdsdmJpd2dkWE4xWVd4c2VTQm1jbTl0SUNjZ0t5QW5VbVZoWTNRdVVISnZjRlI1Y0dWekxpY3NJR052YlhCdmJtVnVkRTVoYldVZ2ZId2dKMUpsWVdOMElHTnNZWE56Snl3Z2JHOWpZWFJwYjI0c0lIUjVjR1ZUY0dWalRtRnRaU2s3WEc0Z0lDQWdJQ0FnSUNBZ1pYSnliM0lnUFNCMGVYQmxVM0JsWTNOYmRIbHdaVk53WldOT1lXMWxYU2gyWVd4MVpYTXNJSFI1Y0dWVGNHVmpUbUZ0WlN3Z1kyOXRjRzl1Wlc1MFRtRnRaU3dnYkc5allYUnBiMjRzSUc1MWJHd3NJRkpsWVdOMFVISnZjRlI1Y0dWelUyVmpjbVYwS1R0Y2JpQWdJQ0FnSUNBZ2ZTQmpZWFJqYUNBb1pYZ3BJSHRjYmlBZ0lDQWdJQ0FnSUNCbGNuSnZjaUE5SUdWNE8xeHVJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJSGRoY201cGJtY29JV1Z5Y205eUlIeDhJR1Z5Y205eUlHbHVjM1JoYm1ObGIyWWdSWEp5YjNJc0lDY2xjem9nZEhsd1pTQnpjR1ZqYVdacFkyRjBhVzl1SUc5bUlDVnpJR0FsYzJBZ2FYTWdhVzUyWVd4cFpEc2dkR2hsSUhSNWNHVWdZMmhsWTJ0bGNpQW5JQ3NnSjJaMWJtTjBhVzl1SUcxMWMzUWdjbVYwZFhKdUlHQnVkV3hzWUNCdmNpQmhiaUJnUlhKeWIzSmdJR0oxZENCeVpYUjFjbTVsWkNCaElDVnpMaUFuSUNzZ0oxbHZkU0J0WVhrZ2FHRjJaU0JtYjNKbmIzUjBaVzRnZEc4Z2NHRnpjeUJoYmlCaGNtZDFiV1Z1ZENCMGJ5QjBhR1VnZEhsd1pTQmphR1ZqYTJWeUlDY2dLeUFuWTNKbFlYUnZjaUFvWVhKeVlYbFBaaXdnYVc1emRHRnVZMlZQWml3Z2IySnFaV04wVDJZc0lHOXVaVTltTENCdmJtVlBabFI1Y0dVc0lHRnVaQ0FuSUNzZ0ozTm9ZWEJsSUdGc2JDQnlaWEYxYVhKbElHRnVJR0Z5WjNWdFpXNTBLUzRuTENCamIyMXdiMjVsYm5ST1lXMWxJSHg4SUNkU1pXRmpkQ0JqYkdGemN5Y3NJR3h2WTJGMGFXOXVMQ0IwZVhCbFUzQmxZMDVoYldVc0lIUjVjR1Z2WmlCbGNuSnZjaWs3WEc0Z0lDQWdJQ0FnSUdsbUlDaGxjbkp2Y2lCcGJuTjBZVzVqWlc5bUlFVnljbTl5SUNZbUlDRW9aWEp5YjNJdWJXVnpjMkZuWlNCcGJpQnNiMmRuWldSVWVYQmxSbUZwYkhWeVpYTXBLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0x5OGdUMjVzZVNCdGIyNXBkRzl5SUhSb2FYTWdabUZwYkhWeVpTQnZibU5sSUdKbFkyRjFjMlVnZEdobGNtVWdkR1Z1WkhNZ2RHOGdZbVVnWVNCc2IzUWdiMllnZEdobFhHNGdJQ0FnSUNBZ0lDQWdMeThnYzJGdFpTQmxjbkp2Y2k1Y2JpQWdJQ0FnSUNBZ0lDQnNiMmRuWldSVWVYQmxSbUZwYkhWeVpYTmJaWEp5YjNJdWJXVnpjMkZuWlYwZ1BTQjBjblZsTzF4dVhHNGdJQ0FnSUNBZ0lDQWdkbUZ5SUhOMFlXTnJJRDBnWjJWMFUzUmhZMnNnUHlCblpYUlRkR0ZqYXlncElEb2dKeWM3WEc1Y2JpQWdJQ0FnSUNBZ0lDQjNZWEp1YVc1bktHWmhiSE5sTENBblJtRnBiR1ZrSUNWeklIUjVjR1U2SUNWekpYTW5MQ0JzYjJOaGRHbHZiaXdnWlhKeWIzSXViV1Z6YzJGblpTd2djM1JoWTJzZ0lUMGdiblZzYkNBL0lITjBZV05ySURvZ0p5Y3BPMXh1SUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdmVnh1SUNCOVhHNTlYRzVjYm0xdlpIVnNaUzVsZUhCdmNuUnpJRDBnWTJobFkydFFjbTl3Vkhsd1pYTTdYRzRpTENJdktpcGNiaUFxSUVOdmNIbHlhV2RvZENBeU1ERXpMWEJ5WlhObGJuUXNJRVpoWTJWaWIyOXJMQ0JKYm1NdVhHNGdLaUJCYkd3Z2NtbG5hSFJ6SUhKbGMyVnlkbVZrTGx4dUlDcGNiaUFxSUZSb2FYTWdjMjkxY21ObElHTnZaR1VnYVhNZ2JHbGpaVzV6WldRZ2RXNWtaWElnZEdobElFSlRSQzF6ZEhsc1pTQnNhV05sYm5ObElHWnZkVzVrSUdsdUlIUm9aVnh1SUNvZ1RFbERSVTVUUlNCbWFXeGxJR2x1SUhSb1pTQnliMjkwSUdScGNtVmpkRzl5ZVNCdlppQjBhR2x6SUhOdmRYSmpaU0IwY21WbExpQkJiaUJoWkdScGRHbHZibUZzSUdkeVlXNTBYRzRnS2lCdlppQndZWFJsYm5RZ2NtbG5hSFJ6SUdOaGJpQmlaU0JtYjNWdVpDQnBiaUIwYUdVZ1VFRlVSVTVVVXlCbWFXeGxJR2x1SUhSb1pTQnpZVzFsSUdScGNtVmpkRzl5ZVM1Y2JpQXFMMXh1WEc0bmRYTmxJSE4wY21samRDYzdYRzVjYmk4dklGSmxZV04wSURFMUxqVWdjbVZtWlhKbGJtTmxjeUIwYUdseklHMXZaSFZzWlN3Z1lXNWtJR0Z6YzNWdFpYTWdVSEp2Y0ZSNWNHVnpJR0Z5WlNCemRHbHNiQ0JqWVd4c1lXSnNaU0JwYmlCd2NtOWtkV04wYVc5dUxseHVMeThnVkdobGNtVm1iM0psSUhkbElISmxMV1Y0Y0c5eWRDQmtaWFpsYkc5d2JXVnVkQzF2Ym14NUlIWmxjbk5wYjI0Z2QybDBhQ0JoYkd3Z2RHaGxJRkJ5YjNCVWVYQmxjeUJqYUdWamEzTWdhR1Z5WlM1Y2JpOHZJRWh2ZDJWMlpYSWdhV1lnYjI1bElHbHpJRzFwWjNKaGRHbHVaeUIwYnlCMGFHVWdZSEJ5YjNBdGRIbHdaWE5nSUc1d2JTQnNhV0p5WVhKNUxDQjBhR1Y1SUhkcGJHd2daMjhnZEdoeWIzVm5hQ0IwYUdWY2JpOHZJR0JwYm1SbGVDNXFjMkFnWlc1MGNua2djRzlwYm5Rc0lHRnVaQ0JwZENCM2FXeHNJR0p5WVc1amFDQmtaWEJsYm1ScGJtY2diMjRnZEdobElHVnVkbWx5YjI1dFpXNTBMbHh1ZG1GeUlHWmhZM1J2Y25rZ1BTQnlaWEYxYVhKbEtDY3VMMlpoWTNSdmNubFhhWFJvVkhsd1pVTm9aV05yWlhKekp5azdYRzV0YjJSMWJHVXVaWGh3YjNKMGN5QTlJR1oxYm1OMGFXOXVLR2x6Vm1Gc2FXUkZiR1Z0Wlc1MEtTQjdYRzRnSUM4dklFbDBJR2x6SUhOMGFXeHNJR0ZzYkc5M1pXUWdhVzRnTVRVdU5TNWNiaUFnZG1GeUlIUm9jbTkzVDI1RWFYSmxZM1JCWTJObGMzTWdQU0JtWVd4elpUdGNiaUFnY21WMGRYSnVJR1poWTNSdmNua29hWE5XWVd4cFpFVnNaVzFsYm5Rc0lIUm9jbTkzVDI1RWFYSmxZM1JCWTJObGMzTXBPMXh1ZlR0Y2JpSXNJaThxS2x4dUlDb2dRMjl3ZVhKcFoyaDBJREl3TVRNdGNISmxjMlZ1ZEN3Z1JtRmpaV0p2YjJzc0lFbHVZeTVjYmlBcUlFRnNiQ0J5YVdkb2RITWdjbVZ6WlhKMlpXUXVYRzRnS2x4dUlDb2dWR2hwY3lCemIzVnlZMlVnWTI5a1pTQnBjeUJzYVdObGJuTmxaQ0IxYm1SbGNpQjBhR1VnUWxORUxYTjBlV3hsSUd4cFkyVnVjMlVnWm05MWJtUWdhVzRnZEdobFhHNGdLaUJNU1VORlRsTkZJR1pwYkdVZ2FXNGdkR2hsSUhKdmIzUWdaR2x5WldOMGIzSjVJRzltSUhSb2FYTWdjMjkxY21ObElIUnlaV1V1SUVGdUlHRmtaR2wwYVc5dVlXd2daM0poYm5SY2JpQXFJRzltSUhCaGRHVnVkQ0J5YVdkb2RITWdZMkZ1SUdKbElHWnZkVzVrSUdsdUlIUm9aU0JRUVZSRlRsUlRJR1pwYkdVZ2FXNGdkR2hsSUhOaGJXVWdaR2x5WldOMGIzSjVMbHh1SUNvdlhHNWNiaWQxYzJVZ2MzUnlhV04wSnp0Y2JseHVkbUZ5SUdWdGNIUjVSblZ1WTNScGIyNGdQU0J5WlhGMWFYSmxLQ2RtWW1wekwyeHBZaTlsYlhCMGVVWjFibU4wYVc5dUp5azdYRzUyWVhJZ2FXNTJZWEpwWVc1MElEMGdjbVZ4ZFdseVpTZ25abUpxY3k5c2FXSXZhVzUyWVhKcFlXNTBKeWs3WEc1MllYSWdkMkZ5Ym1sdVp5QTlJSEpsY1hWcGNtVW9KMlppYW5NdmJHbGlMM2RoY201cGJtY25LVHRjYmx4dWRtRnlJRkpsWVdOMFVISnZjRlI1Y0dWelUyVmpjbVYwSUQwZ2NtVnhkV2x5WlNnbkxpOXNhV0l2VW1WaFkzUlFjbTl3Vkhsd1pYTlRaV055WlhRbktUdGNiblpoY2lCamFHVmphMUJ5YjNCVWVYQmxjeUE5SUhKbGNYVnBjbVVvSnk0dlkyaGxZMnRRY205d1ZIbHdaWE1uS1R0Y2JseHViVzlrZFd4bExtVjRjRzl5ZEhNZ1BTQm1kVzVqZEdsdmJpaHBjMVpoYkdsa1JXeGxiV1Z1ZEN3Z2RHaHliM2RQYmtScGNtVmpkRUZqWTJWemN5a2dlMXh1SUNBdktpQm5iRzlpWVd3Z1UzbHRZbTlzSUNvdlhHNGdJSFpoY2lCSlZFVlNRVlJQVWw5VFdVMUNUMHdnUFNCMGVYQmxiMllnVTNsdFltOXNJRDA5UFNBblpuVnVZM1JwYjI0bklDWW1JRk41YldKdmJDNXBkR1Z5WVhSdmNqdGNiaUFnZG1GeUlFWkJWVmhmU1ZSRlVrRlVUMUpmVTFsTlFrOU1JRDBnSjBCQWFYUmxjbUYwYjNJbk95QXZMeUJDWldadmNtVWdVM2x0WW05c0lITndaV011WEc1Y2JpQWdMeW9xWEc0Z0lDQXFJRkpsZEhWeWJuTWdkR2hsSUdsMFpYSmhkRzl5SUcxbGRHaHZaQ0JtZFc1amRHbHZiaUJqYjI1MFlXbHVaV1FnYjI0Z2RHaGxJR2wwWlhKaFlteGxJRzlpYW1WamRDNWNiaUFnSUNwY2JpQWdJQ29nUW1VZ2MzVnlaU0IwYnlCcGJuWnZhMlVnZEdobElHWjFibU4wYVc5dUlIZHBkR2dnZEdobElHbDBaWEpoWW14bElHRnpJR052Ym5SbGVIUTZYRzRnSUNBcVhHNGdJQ0FxSUNBZ0lDQjJZWElnYVhSbGNtRjBiM0pHYmlBOUlHZGxkRWwwWlhKaGRHOXlSbTRvYlhsSmRHVnlZV0pzWlNrN1hHNGdJQ0FxSUNBZ0lDQnBaaUFvYVhSbGNtRjBiM0pHYmlrZ2UxeHVJQ0FnS2lBZ0lDQWdJQ0IyWVhJZ2FYUmxjbUYwYjNJZ1BTQnBkR1Z5WVhSdmNrWnVMbU5oYkd3b2JYbEpkR1Z5WVdKc1pTazdYRzRnSUNBcUlDQWdJQ0FnSUM0dUxseHVJQ0FnS2lBZ0lDQWdmVnh1SUNBZ0tseHVJQ0FnS2lCQWNHRnlZVzBnZXo5dlltcGxZM1I5SUcxaGVXSmxTWFJsY21GaWJHVmNiaUFnSUNvZ1FISmxkSFZ5YmlCN1AyWjFibU4wYVc5dWZWeHVJQ0FnS2k5Y2JpQWdablZ1WTNScGIyNGdaMlYwU1hSbGNtRjBiM0pHYmlodFlYbGlaVWwwWlhKaFlteGxLU0I3WEc0Z0lDQWdkbUZ5SUdsMFpYSmhkRzl5Um00Z1BTQnRZWGxpWlVsMFpYSmhZbXhsSUNZbUlDaEpWRVZTUVZSUFVsOVRXVTFDVDB3Z0ppWWdiV0Y1WW1WSmRHVnlZV0pzWlZ0SlZFVlNRVlJQVWw5VFdVMUNUMHhkSUh4OElHMWhlV0psU1hSbGNtRmliR1ZiUmtGVldGOUpWRVZTUVZSUFVsOVRXVTFDVDB4ZEtUdGNiaUFnSUNCcFppQW9kSGx3Wlc5bUlHbDBaWEpoZEc5eVJtNGdQVDA5SUNkbWRXNWpkR2x2YmljcElIdGNiaUFnSUNBZ0lISmxkSFZ5YmlCcGRHVnlZWFJ2Y2tadU8xeHVJQ0FnSUgxY2JpQWdmVnh1WEc0Z0lDOHFLbHh1SUNBZ0tpQkRiMnhzWldOMGFXOXVJRzltSUcxbGRHaHZaSE1nZEdoaGRDQmhiR3h2ZHlCa1pXTnNZWEpoZEdsdmJpQmhibVFnZG1Gc2FXUmhkR2x2YmlCdlppQndjbTl3Y3lCMGFHRjBJR0Z5WlZ4dUlDQWdLaUJ6ZFhCd2JHbGxaQ0IwYnlCU1pXRmpkQ0JqYjIxd2IyNWxiblJ6TGlCRmVHRnRjR3hsSUhWellXZGxPbHh1SUNBZ0tseHVJQ0FnS2lBZ0lIWmhjaUJRY205d2N5QTlJSEpsY1hWcGNtVW9KMUpsWVdOMFVISnZjRlI1Y0dWekp5azdYRzRnSUNBcUlDQWdkbUZ5SUUxNVFYSjBhV05zWlNBOUlGSmxZV04wTG1OeVpXRjBaVU5zWVhOektIdGNiaUFnSUNvZ0lDQWdJSEJ5YjNCVWVYQmxjem9nZTF4dUlDQWdLaUFnSUNBZ0lDQXZMeUJCYmlCdmNIUnBiMjVoYkNCemRISnBibWNnY0hKdmNDQnVZVzFsWkNCY0ltUmxjMk55YVhCMGFXOXVYQ0l1WEc0Z0lDQXFJQ0FnSUNBZ0lHUmxjMk55YVhCMGFXOXVPaUJRY205d2N5NXpkSEpwYm1jc1hHNGdJQ0FxWEc0Z0lDQXFJQ0FnSUNBZ0lDOHZJRUVnY21WeGRXbHlaV1FnWlc1MWJTQndjbTl3SUc1aGJXVmtJRndpWTJGMFpXZHZjbmxjSWk1Y2JpQWdJQ29nSUNBZ0lDQWdZMkYwWldkdmNuazZJRkJ5YjNCekxtOXVaVTltS0ZzblRtVjNjeWNzSjFCb2IzUnZjeWRkS1M1cGMxSmxjWFZwY21Wa0xGeHVJQ0FnS2x4dUlDQWdLaUFnSUNBZ0lDQXZMeUJCSUhCeWIzQWdibUZ0WldRZ1hDSmthV0ZzYjJkY0lpQjBhR0YwSUhKbGNYVnBjbVZ6SUdGdUlHbHVjM1JoYm1ObElHOW1JRVJwWVd4dlp5NWNiaUFnSUNvZ0lDQWdJQ0FnWkdsaGJHOW5PaUJRY205d2N5NXBibk4wWVc1alpVOW1LRVJwWVd4dlp5a3VhWE5TWlhGMWFYSmxaRnh1SUNBZ0tpQWdJQ0FnZlN4Y2JpQWdJQ29nSUNBZ0lISmxibVJsY2pvZ1puVnVZM1JwYjI0b0tTQjdJQzR1TGlCOVhHNGdJQ0FxSUNBZ2ZTazdYRzRnSUNBcVhHNGdJQ0FxSUVFZ2JXOXlaU0JtYjNKdFlXd2djM0JsWTJsbWFXTmhkR2x2YmlCdlppQm9iM2NnZEdobGMyVWdiV1YwYUc5a2N5QmhjbVVnZFhObFpEcGNiaUFnSUNwY2JpQWdJQ29nSUNCMGVYQmxJRG85SUdGeWNtRjVmR0p2YjJ4OFpuVnVZM3h2WW1wbFkzUjhiblZ0WW1WeWZITjBjbWx1WjN4dmJtVlBaaWhiTGk0dVhTbDhhVzV6ZEdGdVkyVlBaaWd1TGk0cFhHNGdJQ0FxSUNBZ1pHVmpiQ0E2UFNCU1pXRmpkRkJ5YjNCVWVYQmxjeTU3ZEhsd1pYMG9MbWx6VW1WeGRXbHlaV1FwUDF4dUlDQWdLbHh1SUNBZ0tpQkZZV05vSUdGdVpDQmxkbVZ5ZVNCa1pXTnNZWEpoZEdsdmJpQndjbTlrZFdObGN5QmhJR1oxYm1OMGFXOXVJSGRwZEdnZ2RHaGxJSE5oYldVZ2MybG5ibUYwZFhKbExpQlVhR2x6WEc0Z0lDQXFJR0ZzYkc5M2N5QjBhR1VnWTNKbFlYUnBiMjRnYjJZZ1kzVnpkRzl0SUhaaGJHbGtZWFJwYjI0Z1puVnVZM1JwYjI1ekxpQkdiM0lnWlhoaGJYQnNaVHBjYmlBZ0lDcGNiaUFnSUNvZ0lIWmhjaUJOZVV4cGJtc2dQU0JTWldGamRDNWpjbVZoZEdWRGJHRnpjeWg3WEc0Z0lDQXFJQ0FnSUhCeWIzQlVlWEJsY3pvZ2UxeHVJQ0FnS2lBZ0lDQWdJQzh2SUVGdUlHOXdkR2x2Ym1Gc0lITjBjbWx1WnlCdmNpQlZVa2tnY0hKdmNDQnVZVzFsWkNCY0ltaHlaV1pjSWk1Y2JpQWdJQ29nSUNBZ0lDQm9jbVZtT2lCbWRXNWpkR2x2Ymlod2NtOXdjeXdnY0hKdmNFNWhiV1VzSUdOdmJYQnZibVZ1ZEU1aGJXVXBJSHRjYmlBZ0lDb2dJQ0FnSUNBZ0lIWmhjaUJ3Y205d1ZtRnNkV1VnUFNCd2NtOXdjMXR3Y205d1RtRnRaVjA3WEc0Z0lDQXFJQ0FnSUNBZ0lDQnBaaUFvY0hKdmNGWmhiSFZsSUNFOUlHNTFiR3dnSmlZZ2RIbHdaVzltSUhCeWIzQldZV3gxWlNBaFBUMGdKM04wY21sdVp5Y2dKaVpjYmlBZ0lDb2dJQ0FnSUNBZ0lDQWdJQ0FoS0hCeWIzQldZV3gxWlNCcGJuTjBZVzVqWlc5bUlGVlNTU2twSUh0Y2JpQWdJQ29nSUNBZ0lDQWdJQ0FnY21WMGRYSnVJRzVsZHlCRmNuSnZjaWhjYmlBZ0lDb2dJQ0FnSUNBZ0lDQWdJQ0FuUlhod1pXTjBaV1FnWVNCemRISnBibWNnYjNJZ1lXNGdWVkpKSUdadmNpQW5JQ3NnY0hKdmNFNWhiV1VnS3lBbklHbHVJQ2NnSzF4dUlDQWdLaUFnSUNBZ0lDQWdJQ0FnSUdOdmJYQnZibVZ1ZEU1aGJXVmNiaUFnSUNvZ0lDQWdJQ0FnSUNBZ0tUdGNiaUFnSUNvZ0lDQWdJQ0FnSUgxY2JpQWdJQ29nSUNBZ0lDQjlYRzRnSUNBcUlDQWdJSDBzWEc0Z0lDQXFJQ0FnSUhKbGJtUmxjam9nWm5WdVkzUnBiMjRvS1NCN0xpNHVmVnh1SUNBZ0tpQWdmU2s3WEc0Z0lDQXFYRzRnSUNBcUlFQnBiblJsY201aGJGeHVJQ0FnS2k5Y2JseHVJQ0IyWVhJZ1FVNVBUbGxOVDFWVElEMGdKenc4WVc1dmJubHRiM1Z6UGo0bk8xeHVYRzRnSUM4dklFbHRjRzl5ZEdGdWRDRmNiaUFnTHk4Z1MyVmxjQ0IwYUdseklHeHBjM1FnYVc0Z2MzbHVZeUIzYVhSb0lIQnliMlIxWTNScGIyNGdkbVZ5YzJsdmJpQnBiaUJnTGk5bVlXTjBiM0o1VjJsMGFGUm9jbTkzYVc1blUyaHBiWE11YW5OZ0xseHVJQ0IyWVhJZ1VtVmhZM1JRY205d1ZIbHdaWE1nUFNCN1hHNGdJQ0FnWVhKeVlYazZJR055WldGMFpWQnlhVzFwZEdsMlpWUjVjR1ZEYUdWamEyVnlLQ2RoY25KaGVTY3BMRnh1SUNBZ0lHSnZiMnc2SUdOeVpXRjBaVkJ5YVcxcGRHbDJaVlI1Y0dWRGFHVmphMlZ5S0NkaWIyOXNaV0Z1Snlrc1hHNGdJQ0FnWm5WdVl6b2dZM0psWVhSbFVISnBiV2wwYVhabFZIbHdaVU5vWldOclpYSW9KMloxYm1OMGFXOXVKeWtzWEc0Z0lDQWdiblZ0WW1WeU9pQmpjbVZoZEdWUWNtbHRhWFJwZG1WVWVYQmxRMmhsWTJ0bGNpZ25iblZ0WW1WeUp5a3NYRzRnSUNBZ2IySnFaV04wT2lCamNtVmhkR1ZRY21sdGFYUnBkbVZVZVhCbFEyaGxZMnRsY2lnbmIySnFaV04wSnlrc1hHNGdJQ0FnYzNSeWFXNW5PaUJqY21WaGRHVlFjbWx0YVhScGRtVlVlWEJsUTJobFkydGxjaWduYzNSeWFXNW5KeWtzWEc0Z0lDQWdjM2x0WW05c09pQmpjbVZoZEdWUWNtbHRhWFJwZG1WVWVYQmxRMmhsWTJ0bGNpZ25jM2x0WW05c0p5a3NYRzVjYmlBZ0lDQmhibms2SUdOeVpXRjBaVUZ1ZVZSNWNHVkRhR1ZqYTJWeUtDa3NYRzRnSUNBZ1lYSnlZWGxQWmpvZ1kzSmxZWFJsUVhKeVlYbFBabFI1Y0dWRGFHVmphMlZ5TEZ4dUlDQWdJR1ZzWlcxbGJuUTZJR055WldGMFpVVnNaVzFsYm5SVWVYQmxRMmhsWTJ0bGNpZ3BMRnh1SUNBZ0lHbHVjM1JoYm1ObFQyWTZJR055WldGMFpVbHVjM1JoYm1ObFZIbHdaVU5vWldOclpYSXNYRzRnSUNBZ2JtOWtaVG9nWTNKbFlYUmxUbTlrWlVOb1pXTnJaWElvS1N4Y2JpQWdJQ0J2WW1wbFkzUlBaam9nWTNKbFlYUmxUMkpxWldOMFQyWlVlWEJsUTJobFkydGxjaXhjYmlBZ0lDQnZibVZQWmpvZ1kzSmxZWFJsUlc1MWJWUjVjR1ZEYUdWamEyVnlMRnh1SUNBZ0lHOXVaVTltVkhsd1pUb2dZM0psWVhSbFZXNXBiMjVVZVhCbFEyaGxZMnRsY2l4Y2JpQWdJQ0J6YUdGd1pUb2dZM0psWVhSbFUyaGhjR1ZVZVhCbFEyaGxZMnRsY2x4dUlDQjlPMXh1WEc0Z0lDOHFLbHh1SUNBZ0tpQnBibXhwYm1Wa0lFOWlhbVZqZEM1cGN5QndiMng1Wm1sc2JDQjBieUJoZG05cFpDQnlaWEYxYVhKcGJtY2dZMjl1YzNWdFpYSnpJSE5vYVhBZ2RHaGxhWElnYjNkdVhHNGdJQ0FxSUdoMGRIQnpPaTh2WkdWMlpXeHZjR1Z5TG0xdmVtbHNiR0V1YjNKbkwyVnVMVlZUTDJSdlkzTXZWMlZpTDBwaGRtRlRZM0pwY0hRdlVtVm1aWEpsYm1ObEwwZHNiMkpoYkY5UFltcGxZM1J6TDA5aWFtVmpkQzlwYzF4dUlDQWdLaTljYmlBZ0x5cGxjMnhwYm5RdFpHbHpZV0pzWlNCdWJ5MXpaV3htTFdOdmJYQmhjbVVxTDF4dUlDQm1kVzVqZEdsdmJpQnBjeWg0TENCNUtTQjdYRzRnSUNBZ0x5OGdVMkZ0WlZaaGJIVmxJR0ZzWjI5eWFYUm9iVnh1SUNBZ0lHbG1JQ2g0SUQwOVBTQjVLU0I3WEc0Z0lDQWdJQ0F2THlCVGRHVndjeUF4TFRVc0lEY3RNVEJjYmlBZ0lDQWdJQzh2SUZOMFpYQnpJRFl1WWkwMkxtVTZJQ3N3SUNFOUlDMHdYRzRnSUNBZ0lDQnlaWFIxY200Z2VDQWhQVDBnTUNCOGZDQXhJQzhnZUNBOVBUMGdNU0F2SUhrN1hHNGdJQ0FnZlNCbGJITmxJSHRjYmlBZ0lDQWdJQzh2SUZOMFpYQWdOaTVoT2lCT1lVNGdQVDBnVG1GT1hHNGdJQ0FnSUNCeVpYUjFjbTRnZUNBaFBUMGdlQ0FtSmlCNUlDRTlQU0I1TzF4dUlDQWdJSDFjYmlBZ2ZWeHVJQ0F2S21WemJHbHVkQzFsYm1GaWJHVWdibTh0YzJWc1ppMWpiMjF3WVhKbEtpOWNibHh1SUNBdktpcGNiaUFnSUNvZ1YyVWdkWE5sSUdGdUlFVnljbTl5TFd4cGEyVWdiMkpxWldOMElHWnZjaUJpWVdOcmQyRnlaQ0JqYjIxd1lYUnBZbWxzYVhSNUlHRnpJSEJsYjNCc1pTQnRZWGtnWTJGc2JGeHVJQ0FnS2lCUWNtOXdWSGx3WlhNZ1pHbHlaV04wYkhrZ1lXNWtJR2x1YzNCbFkzUWdkR2hsYVhJZ2IzVjBjSFYwTGlCSWIzZGxkbVZ5TENCM1pTQmtiMjRuZENCMWMyVWdjbVZoYkZ4dUlDQWdLaUJGY25KdmNuTWdZVzU1Ylc5eVpTNGdWMlVnWkc5dUozUWdhVzV6Y0dWamRDQjBhR1ZwY2lCemRHRmpheUJoYm5sM1lYa3NJR0Z1WkNCamNtVmhkR2x1WnlCMGFHVnRYRzRnSUNBcUlHbHpJSEJ5YjJocFltbDBhWFpsYkhrZ1pYaHdaVzV6YVhabElHbG1JSFJvWlhrZ1lYSmxJR055WldGMFpXUWdkRzl2SUc5bWRHVnVMQ0J6ZFdOb0lHRnpJSGRvWVhSY2JpQWdJQ29nYUdGd2NHVnVjeUJwYmlCdmJtVlBabFI1Y0dVb0tTQm1iM0lnWVc1NUlIUjVjR1VnWW1WbWIzSmxJSFJvWlNCdmJtVWdkR2hoZENCdFlYUmphR1ZrTGx4dUlDQWdLaTljYmlBZ1puVnVZM1JwYjI0Z1VISnZjRlI1Y0dWRmNuSnZjaWh0WlhOellXZGxLU0I3WEc0Z0lDQWdkR2hwY3k1dFpYTnpZV2RsSUQwZ2JXVnpjMkZuWlR0Y2JpQWdJQ0IwYUdsekxuTjBZV05ySUQwZ0p5YzdYRzRnSUgxY2JpQWdMeThnVFdGclpTQmdhVzV6ZEdGdVkyVnZaaUJGY25KdmNtQWdjM1JwYkd3Z2QyOXlheUJtYjNJZ2NtVjBkWEp1WldRZ1pYSnliM0p6TGx4dUlDQlFjbTl3Vkhsd1pVVnljbTl5TG5CeWIzUnZkSGx3WlNBOUlFVnljbTl5TG5CeWIzUnZkSGx3WlR0Y2JseHVJQ0JtZFc1amRHbHZiaUJqY21WaGRHVkRhR0ZwYm1GaWJHVlVlWEJsUTJobFkydGxjaWgyWVd4cFpHRjBaU2tnZTF4dUlDQWdJR2xtSUNod2NtOWpaWE56TG1WdWRpNU9UMFJGWDBWT1ZpQWhQVDBnSjNCeWIyUjFZM1JwYjI0bktTQjdYRzRnSUNBZ0lDQjJZWElnYldGdWRXRnNVSEp2Y0ZSNWNHVkRZV3hzUTJGamFHVWdQU0I3ZlR0Y2JpQWdJQ0FnSUhaaGNpQnRZVzUxWVd4UWNtOXdWSGx3WlZkaGNtNXBibWREYjNWdWRDQTlJREE3WEc0Z0lDQWdmVnh1SUNBZ0lHWjFibU4wYVc5dUlHTm9aV05yVkhsd1pTaHBjMUpsY1hWcGNtVmtMQ0J3Y205d2N5d2djSEp2Y0U1aGJXVXNJR052YlhCdmJtVnVkRTVoYldVc0lHeHZZMkYwYVc5dUxDQndjbTl3Um5Wc2JFNWhiV1VzSUhObFkzSmxkQ2tnZTF4dUlDQWdJQ0FnWTI5dGNHOXVaVzUwVG1GdFpTQTlJR052YlhCdmJtVnVkRTVoYldVZ2ZId2dRVTVQVGxsTlQxVlRPMXh1SUNBZ0lDQWdjSEp2Y0VaMWJHeE9ZVzFsSUQwZ2NISnZjRVoxYkd4T1lXMWxJSHg4SUhCeWIzQk9ZVzFsTzF4dVhHNGdJQ0FnSUNCcFppQW9jMlZqY21WMElDRTlQU0JTWldGamRGQnliM0JVZVhCbGMxTmxZM0psZENrZ2UxeHVJQ0FnSUNBZ0lDQnBaaUFvZEdoeWIzZFBia1JwY21WamRFRmpZMlZ6Y3lrZ2UxeHVJQ0FnSUNBZ0lDQWdJQzh2SUU1bGR5QmlaV2hoZG1sdmNpQnZibXg1SUdadmNpQjFjMlZ5Y3lCdlppQmdjSEp2Y0MxMGVYQmxjMkFnY0dGamEyRm5aVnh1SUNBZ0lDQWdJQ0FnSUdsdWRtRnlhV0Z1ZENoY2JpQWdJQ0FnSUNBZ0lDQWdJR1poYkhObExGeHVJQ0FnSUNBZ0lDQWdJQ0FnSjBOaGJHeHBibWNnVUhKdmNGUjVjR1Z6SUhaaGJHbGtZWFJ2Y25NZ1pHbHlaV04wYkhrZ2FYTWdibTkwSUhOMWNIQnZjblJsWkNCaWVTQjBhR1VnWUhCeWIzQXRkSGx3WlhOZ0lIQmhZMnRoWjJVdUlDY2dLMXh1SUNBZ0lDQWdJQ0FnSUNBZ0oxVnpaU0JnVUhKdmNGUjVjR1Z6TG1Ob1pXTnJVSEp2Y0ZSNWNHVnpLQ2xnSUhSdklHTmhiR3dnZEdobGJTNGdKeUFyWEc0Z0lDQWdJQ0FnSUNBZ0lDQW5VbVZoWkNCdGIzSmxJR0YwSUdoMGRIQTZMeTltWWk1dFpTOTFjMlV0WTJobFkyc3RjSEp2Y0MxMGVYQmxjeWRjYmlBZ0lDQWdJQ0FnSUNBcE8xeHVJQ0FnSUNBZ0lDQjlJR1ZzYzJVZ2FXWWdLSEJ5YjJObGMzTXVaVzUyTGs1UFJFVmZSVTVXSUNFOVBTQW5jSEp2WkhWamRHbHZiaWNnSmlZZ2RIbHdaVzltSUdOdmJuTnZiR1VnSVQwOUlDZDFibVJsWm1sdVpXUW5LU0I3WEc0Z0lDQWdJQ0FnSUNBZ0x5OGdUMnhrSUdKbGFHRjJhVzl5SUdadmNpQndaVzl3YkdVZ2RYTnBibWNnVW1WaFkzUXVVSEp2Y0ZSNWNHVnpYRzRnSUNBZ0lDQWdJQ0FnZG1GeUlHTmhZMmhsUzJWNUlEMGdZMjl0Y0c5dVpXNTBUbUZ0WlNBcklDYzZKeUFySUhCeWIzQk9ZVzFsTzF4dUlDQWdJQ0FnSUNBZ0lHbG1JQ2hjYmlBZ0lDQWdJQ0FnSUNBZ0lDRnRZVzUxWVd4UWNtOXdWSGx3WlVOaGJHeERZV05vWlZ0allXTm9aVXRsZVYwZ0ppWmNiaUFnSUNBZ0lDQWdJQ0FnSUM4dklFRjJiMmxrSUhOd1lXMXRhVzVuSUhSb1pTQmpiMjV6YjJ4bElHSmxZMkYxYzJVZ2RHaGxlU0JoY21VZ2IyWjBaVzRnYm05MElHRmpkR2x2Ym1GaWJHVWdaWGhqWlhCMElHWnZjaUJzYVdJZ1lYVjBhRzl5YzF4dUlDQWdJQ0FnSUNBZ0lDQWdiV0Z1ZFdGc1VISnZjRlI1Y0dWWFlYSnVhVzVuUTI5MWJuUWdQQ0F6WEc0Z0lDQWdJQ0FnSUNBZ0tTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNCM1lYSnVhVzVuS0Z4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0JtWVd4elpTeGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0oxbHZkU0JoY21VZ2JXRnVkV0ZzYkhrZ1kyRnNiR2x1WnlCaElGSmxZV04wTGxCeWIzQlVlWEJsY3lCMllXeHBaR0YwYVc5dUlDY2dLMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQW5ablZ1WTNScGIyNGdabTl5SUhSb1pTQmdKWE5nSUhCeWIzQWdiMjRnWUNWellDNGdWR2hwY3lCcGN5QmtaWEJ5WldOaGRHVmtJQ2NnSzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FuWVc1a0lIZHBiR3dnZEdoeWIzY2dhVzRnZEdobElITjBZVzVrWVd4dmJtVWdZSEJ5YjNBdGRIbHdaWE5nSUhCaFkydGhaMlV1SUNjZ0sxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBbldXOTFJRzFoZVNCaVpTQnpaV1ZwYm1jZ2RHaHBjeUIzWVhKdWFXNW5JR1IxWlNCMGJ5QmhJSFJvYVhKa0xYQmhjblI1SUZCeWIzQlVlWEJsY3lBbklDdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0oyeHBZbkpoY25rdUlGTmxaU0JvZEhSd2N6b3ZMMlppTG0xbEwzSmxZV04wTFhkaGNtNXBibWN0Wkc5dWRDMWpZV3hzTFhCeWIzQjBlWEJsY3lBbklDc2dKMlp2Y2lCa1pYUmhhV3h6TGljc1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUhCeWIzQkdkV3hzVG1GdFpTeGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ1kyOXRjRzl1Wlc1MFRtRnRaVnh1SUNBZ0lDQWdJQ0FnSUNBZ0tUdGNiaUFnSUNBZ0lDQWdJQ0FnSUcxaGJuVmhiRkJ5YjNCVWVYQmxRMkZzYkVOaFkyaGxXMk5oWTJobFMyVjVYU0E5SUhSeWRXVTdYRzRnSUNBZ0lDQWdJQ0FnSUNCdFlXNTFZV3hRY205d1ZIbHdaVmRoY201cGJtZERiM1Z1ZENzck8xeHVJQ0FnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnZlZ4dUlDQWdJQ0FnYVdZZ0tIQnliM0J6VzNCeWIzQk9ZVzFsWFNBOVBTQnVkV3hzS1NCN1hHNGdJQ0FnSUNBZ0lHbG1JQ2hwYzFKbGNYVnBjbVZrS1NCN1hHNGdJQ0FnSUNBZ0lDQWdhV1lnS0hCeWIzQnpXM0J5YjNCT1lXMWxYU0E5UFQwZ2JuVnNiQ2tnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdjbVYwZFhKdUlHNWxkeUJRY205d1ZIbHdaVVZ5Y205eUtDZFVhR1VnSnlBcklHeHZZMkYwYVc5dUlDc2dKeUJnSnlBcklIQnliM0JHZFd4c1RtRnRaU0FySUNkZ0lHbHpJRzFoY210bFpDQmhjeUJ5WlhGMWFYSmxaQ0FuSUNzZ0tDZHBiaUJnSnlBcklHTnZiWEJ2Ym1WdWRFNWhiV1VnS3lBbllDd2dZblYwSUdsMGN5QjJZV3gxWlNCcGN5QmdiblZzYkdBdUp5a3BPMXh1SUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z2JtVjNJRkJ5YjNCVWVYQmxSWEp5YjNJb0oxUm9aU0FuSUNzZ2JHOWpZWFJwYjI0Z0t5QW5JR0FuSUNzZ2NISnZjRVoxYkd4T1lXMWxJQ3NnSjJBZ2FYTWdiV0Z5YTJWa0lHRnpJSEpsY1hWcGNtVmtJR2x1SUNjZ0t5QW9KMkFuSUNzZ1kyOXRjRzl1Wlc1MFRtRnRaU0FySUNkZ0xDQmlkWFFnYVhSeklIWmhiSFZsSUdseklHQjFibVJsWm1sdVpXUmdMaWNwS1R0Y2JpQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ0lDQnlaWFIxY200Z2JuVnNiRHRjYmlBZ0lDQWdJSDBnWld4elpTQjdYRzRnSUNBZ0lDQWdJSEpsZEhWeWJpQjJZV3hwWkdGMFpTaHdjbTl3Y3l3Z2NISnZjRTVoYldVc0lHTnZiWEJ2Ym1WdWRFNWhiV1VzSUd4dlkyRjBhVzl1TENCd2NtOXdSblZzYkU1aGJXVXBPMXh1SUNBZ0lDQWdmVnh1SUNBZ0lIMWNibHh1SUNBZ0lIWmhjaUJqYUdGcGJtVmtRMmhsWTJ0VWVYQmxJRDBnWTJobFkydFVlWEJsTG1KcGJtUW9iblZzYkN3Z1ptRnNjMlVwTzF4dUlDQWdJR05vWVdsdVpXUkRhR1ZqYTFSNWNHVXVhWE5TWlhGMWFYSmxaQ0E5SUdOb1pXTnJWSGx3WlM1aWFXNWtLRzUxYkd3c0lIUnlkV1VwTzF4dVhHNGdJQ0FnY21WMGRYSnVJR05vWVdsdVpXUkRhR1ZqYTFSNWNHVTdYRzRnSUgxY2JseHVJQ0JtZFc1amRHbHZiaUJqY21WaGRHVlFjbWx0YVhScGRtVlVlWEJsUTJobFkydGxjaWhsZUhCbFkzUmxaRlI1Y0dVcElIdGNiaUFnSUNCbWRXNWpkR2x2YmlCMllXeHBaR0YwWlNod2NtOXdjeXdnY0hKdmNFNWhiV1VzSUdOdmJYQnZibVZ1ZEU1aGJXVXNJR3h2WTJGMGFXOXVMQ0J3Y205d1JuVnNiRTVoYldVc0lITmxZM0psZENrZ2UxeHVJQ0FnSUNBZ2RtRnlJSEJ5YjNCV1lXeDFaU0E5SUhCeWIzQnpXM0J5YjNCT1lXMWxYVHRjYmlBZ0lDQWdJSFpoY2lCd2NtOXdWSGx3WlNBOUlHZGxkRkJ5YjNCVWVYQmxLSEJ5YjNCV1lXeDFaU2s3WEc0Z0lDQWdJQ0JwWmlBb2NISnZjRlI1Y0dVZ0lUMDlJR1Y0Y0dWamRHVmtWSGx3WlNrZ2UxeHVJQ0FnSUNBZ0lDQXZMeUJnY0hKdmNGWmhiSFZsWUNCaVpXbHVaeUJwYm5OMFlXNWpaU0J2Wml3Z2MyRjVMQ0JrWVhSbEwzSmxaMlY0Y0N3Z2NHRnpjeUIwYUdVZ0oyOWlhbVZqZENkY2JpQWdJQ0FnSUNBZ0x5OGdZMmhsWTJzc0lHSjFkQ0IzWlNCallXNGdiMlptWlhJZ1lTQnRiM0psSUhCeVpXTnBjMlVnWlhKeWIzSWdiV1Z6YzJGblpTQm9aWEpsSUhKaGRHaGxjaUIwYUdGdVhHNGdJQ0FnSUNBZ0lDOHZJQ2R2WmlCMGVYQmxJR0J2WW1wbFkzUmdKeTVjYmlBZ0lDQWdJQ0FnZG1GeUlIQnlaV05wYzJWVWVYQmxJRDBnWjJWMFVISmxZMmx6WlZSNWNHVW9jSEp2Y0ZaaGJIVmxLVHRjYmx4dUlDQWdJQ0FnSUNCeVpYUjFjbTRnYm1WM0lGQnliM0JVZVhCbFJYSnliM0lvSjBsdWRtRnNhV1FnSnlBcklHeHZZMkYwYVc5dUlDc2dKeUJnSnlBcklIQnliM0JHZFd4c1RtRnRaU0FySUNkZ0lHOW1JSFI1Y0dVZ0p5QXJJQ2duWUNjZ0t5QndjbVZqYVhObFZIbHdaU0FySUNkZ0lITjFjSEJzYVdWa0lIUnZJR0FuSUNzZ1kyOXRjRzl1Wlc1MFRtRnRaU0FySUNkZ0xDQmxlSEJsWTNSbFpDQW5LU0FySUNnbllDY2dLeUJsZUhCbFkzUmxaRlI1Y0dVZ0t5QW5ZQzRuS1NrN1hHNGdJQ0FnSUNCOVhHNGdJQ0FnSUNCeVpYUjFjbTRnYm5Wc2JEdGNiaUFnSUNCOVhHNGdJQ0FnY21WMGRYSnVJR055WldGMFpVTm9ZV2x1WVdKc1pWUjVjR1ZEYUdWamEyVnlLSFpoYkdsa1lYUmxLVHRjYmlBZ2ZWeHVYRzRnSUdaMWJtTjBhVzl1SUdOeVpXRjBaVUZ1ZVZSNWNHVkRhR1ZqYTJWeUtDa2dlMXh1SUNBZ0lISmxkSFZ5YmlCamNtVmhkR1ZEYUdGcGJtRmliR1ZVZVhCbFEyaGxZMnRsY2lobGJYQjBlVVoxYm1OMGFXOXVMblJvWVhSU1pYUjFjbTV6VG5Wc2JDazdYRzRnSUgxY2JseHVJQ0JtZFc1amRHbHZiaUJqY21WaGRHVkJjbkpoZVU5bVZIbHdaVU5vWldOclpYSW9kSGx3WlVOb1pXTnJaWElwSUh0Y2JpQWdJQ0JtZFc1amRHbHZiaUIyWVd4cFpHRjBaU2h3Y205d2N5d2djSEp2Y0U1aGJXVXNJR052YlhCdmJtVnVkRTVoYldVc0lHeHZZMkYwYVc5dUxDQndjbTl3Um5Wc2JFNWhiV1VwSUh0Y2JpQWdJQ0FnSUdsbUlDaDBlWEJsYjJZZ2RIbHdaVU5vWldOclpYSWdJVDA5SUNkbWRXNWpkR2x2YmljcElIdGNiaUFnSUNBZ0lDQWdjbVYwZFhKdUlHNWxkeUJRY205d1ZIbHdaVVZ5Y205eUtDZFFjbTl3WlhKMGVTQmdKeUFySUhCeWIzQkdkV3hzVG1GdFpTQXJJQ2RnSUc5bUlHTnZiWEJ2Ym1WdWRDQmdKeUFySUdOdmJYQnZibVZ1ZEU1aGJXVWdLeUFuWUNCb1lYTWdhVzUyWVd4cFpDQlFjbTl3Vkhsd1pTQnViM1JoZEdsdmJpQnBibk5wWkdVZ1lYSnlZWGxQWmk0bktUdGNiaUFnSUNBZ0lIMWNiaUFnSUNBZ0lIWmhjaUJ3Y205d1ZtRnNkV1VnUFNCd2NtOXdjMXR3Y205d1RtRnRaVjA3WEc0Z0lDQWdJQ0JwWmlBb0lVRnljbUY1TG1selFYSnlZWGtvY0hKdmNGWmhiSFZsS1NrZ2UxeHVJQ0FnSUNBZ0lDQjJZWElnY0hKdmNGUjVjR1VnUFNCblpYUlFjbTl3Vkhsd1pTaHdjbTl3Vm1Gc2RXVXBPMXh1SUNBZ0lDQWdJQ0J5WlhSMWNtNGdibVYzSUZCeWIzQlVlWEJsUlhKeWIzSW9KMGx1ZG1Gc2FXUWdKeUFySUd4dlkyRjBhVzl1SUNzZ0p5QmdKeUFySUhCeWIzQkdkV3hzVG1GdFpTQXJJQ2RnSUc5bUlIUjVjR1VnSnlBcklDZ25ZQ2NnS3lCd2NtOXdWSGx3WlNBcklDZGdJSE4xY0hCc2FXVmtJSFJ2SUdBbklDc2dZMjl0Y0c5dVpXNTBUbUZ0WlNBcklDZGdMQ0JsZUhCbFkzUmxaQ0JoYmlCaGNuSmhlUzRuS1NrN1hHNGdJQ0FnSUNCOVhHNGdJQ0FnSUNCbWIzSWdLSFpoY2lCcElEMGdNRHNnYVNBOElIQnliM0JXWVd4MVpTNXNaVzVuZEdnN0lHa3JLeWtnZTF4dUlDQWdJQ0FnSUNCMllYSWdaWEp5YjNJZ1BTQjBlWEJsUTJobFkydGxjaWh3Y205d1ZtRnNkV1VzSUdrc0lHTnZiWEJ2Ym1WdWRFNWhiV1VzSUd4dlkyRjBhVzl1TENCd2NtOXdSblZzYkU1aGJXVWdLeUFuV3ljZ0t5QnBJQ3NnSjEwbkxDQlNaV0ZqZEZCeWIzQlVlWEJsYzFObFkzSmxkQ2s3WEc0Z0lDQWdJQ0FnSUdsbUlDaGxjbkp2Y2lCcGJuTjBZVzVqWlc5bUlFVnljbTl5S1NCN1hHNGdJQ0FnSUNBZ0lDQWdjbVYwZFhKdUlHVnljbTl5TzF4dUlDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNCOVhHNGdJQ0FnSUNCeVpYUjFjbTRnYm5Wc2JEdGNiaUFnSUNCOVhHNGdJQ0FnY21WMGRYSnVJR055WldGMFpVTm9ZV2x1WVdKc1pWUjVjR1ZEYUdWamEyVnlLSFpoYkdsa1lYUmxLVHRjYmlBZ2ZWeHVYRzRnSUdaMWJtTjBhVzl1SUdOeVpXRjBaVVZzWlcxbGJuUlVlWEJsUTJobFkydGxjaWdwSUh0Y2JpQWdJQ0JtZFc1amRHbHZiaUIyWVd4cFpHRjBaU2h3Y205d2N5d2djSEp2Y0U1aGJXVXNJR052YlhCdmJtVnVkRTVoYldVc0lHeHZZMkYwYVc5dUxDQndjbTl3Um5Wc2JFNWhiV1VwSUh0Y2JpQWdJQ0FnSUhaaGNpQndjbTl3Vm1Gc2RXVWdQU0J3Y205d2MxdHdjbTl3VG1GdFpWMDdYRzRnSUNBZ0lDQnBaaUFvSVdselZtRnNhV1JGYkdWdFpXNTBLSEJ5YjNCV1lXeDFaU2twSUh0Y2JpQWdJQ0FnSUNBZ2RtRnlJSEJ5YjNCVWVYQmxJRDBnWjJWMFVISnZjRlI1Y0dVb2NISnZjRlpoYkhWbEtUdGNiaUFnSUNBZ0lDQWdjbVYwZFhKdUlHNWxkeUJRY205d1ZIbHdaVVZ5Y205eUtDZEpiblpoYkdsa0lDY2dLeUJzYjJOaGRHbHZiaUFySUNjZ1lDY2dLeUJ3Y205d1JuVnNiRTVoYldVZ0t5QW5ZQ0J2WmlCMGVYQmxJQ2NnS3lBb0oyQW5JQ3NnY0hKdmNGUjVjR1VnS3lBbllDQnpkWEJ3YkdsbFpDQjBieUJnSnlBcklHTnZiWEJ2Ym1WdWRFNWhiV1VnS3lBbllDd2daWGh3WldOMFpXUWdZU0J6YVc1bmJHVWdVbVZoWTNSRmJHVnRaVzUwTGljcEtUdGNiaUFnSUNBZ0lIMWNiaUFnSUNBZ0lISmxkSFZ5YmlCdWRXeHNPMXh1SUNBZ0lIMWNiaUFnSUNCeVpYUjFjbTRnWTNKbFlYUmxRMmhoYVc1aFlteGxWSGx3WlVOb1pXTnJaWElvZG1Gc2FXUmhkR1VwTzF4dUlDQjlYRzVjYmlBZ1puVnVZM1JwYjI0Z1kzSmxZWFJsU1c1emRHRnVZMlZVZVhCbFEyaGxZMnRsY2lobGVIQmxZM1JsWkVOc1lYTnpLU0I3WEc0Z0lDQWdablZ1WTNScGIyNGdkbUZzYVdSaGRHVW9jSEp2Y0hNc0lIQnliM0JPWVcxbExDQmpiMjF3YjI1bGJuUk9ZVzFsTENCc2IyTmhkR2x2Yml3Z2NISnZjRVoxYkd4T1lXMWxLU0I3WEc0Z0lDQWdJQ0JwWmlBb0lTaHdjbTl3YzF0d2NtOXdUbUZ0WlYwZ2FXNXpkR0Z1WTJWdlppQmxlSEJsWTNSbFpFTnNZWE56S1NrZ2UxeHVJQ0FnSUNBZ0lDQjJZWElnWlhod1pXTjBaV1JEYkdGemMwNWhiV1VnUFNCbGVIQmxZM1JsWkVOc1lYTnpMbTVoYldVZ2ZId2dRVTVQVGxsTlQxVlRPMXh1SUNBZ0lDQWdJQ0IyWVhJZ1lXTjBkV0ZzUTJ4aGMzTk9ZVzFsSUQwZ1oyVjBRMnhoYzNOT1lXMWxLSEJ5YjNCelczQnliM0JPWVcxbFhTazdYRzRnSUNBZ0lDQWdJSEpsZEhWeWJpQnVaWGNnVUhKdmNGUjVjR1ZGY25KdmNpZ25TVzUyWVd4cFpDQW5JQ3NnYkc5allYUnBiMjRnS3lBbklHQW5JQ3NnY0hKdmNFWjFiR3hPWVcxbElDc2dKMkFnYjJZZ2RIbHdaU0FuSUNzZ0tDZGdKeUFySUdGamRIVmhiRU5zWVhOelRtRnRaU0FySUNkZ0lITjFjSEJzYVdWa0lIUnZJR0FuSUNzZ1kyOXRjRzl1Wlc1MFRtRnRaU0FySUNkZ0xDQmxlSEJsWTNSbFpDQW5LU0FySUNnbmFXNXpkR0Z1WTJVZ2IyWWdZQ2NnS3lCbGVIQmxZM1JsWkVOc1lYTnpUbUZ0WlNBcklDZGdMaWNwS1R0Y2JpQWdJQ0FnSUgxY2JpQWdJQ0FnSUhKbGRIVnliaUJ1ZFd4c08xeHVJQ0FnSUgxY2JpQWdJQ0J5WlhSMWNtNGdZM0psWVhSbFEyaGhhVzVoWW14bFZIbHdaVU5vWldOclpYSW9kbUZzYVdSaGRHVXBPMXh1SUNCOVhHNWNiaUFnWm5WdVkzUnBiMjRnWTNKbFlYUmxSVzUxYlZSNWNHVkRhR1ZqYTJWeUtHVjRjR1ZqZEdWa1ZtRnNkV1Z6S1NCN1hHNGdJQ0FnYVdZZ0tDRkJjbkpoZVM1cGMwRnljbUY1S0dWNGNHVmpkR1ZrVm1Gc2RXVnpLU2tnZTF4dUlDQWdJQ0FnY0hKdlkyVnpjeTVsYm5ZdVRrOUVSVjlGVGxZZ0lUMDlJQ2R3Y205a2RXTjBhVzl1SnlBL0lIZGhjbTVwYm1jb1ptRnNjMlVzSUNkSmJuWmhiR2xrSUdGeVozVnRaVzUwSUhOMWNIQnNhV1ZrSUhSdklHOXVaVTltTENCbGVIQmxZM1JsWkNCaGJpQnBibk4wWVc1alpTQnZaaUJoY25KaGVTNG5LU0E2SUhadmFXUWdNRHRjYmlBZ0lDQWdJSEpsZEhWeWJpQmxiWEIwZVVaMWJtTjBhVzl1TG5Sb1lYUlNaWFIxY201elRuVnNiRHRjYmlBZ0lDQjlYRzVjYmlBZ0lDQm1kVzVqZEdsdmJpQjJZV3hwWkdGMFpTaHdjbTl3Y3l3Z2NISnZjRTVoYldVc0lHTnZiWEJ2Ym1WdWRFNWhiV1VzSUd4dlkyRjBhVzl1TENCd2NtOXdSblZzYkU1aGJXVXBJSHRjYmlBZ0lDQWdJSFpoY2lCd2NtOXdWbUZzZFdVZ1BTQndjbTl3YzF0d2NtOXdUbUZ0WlYwN1hHNGdJQ0FnSUNCbWIzSWdLSFpoY2lCcElEMGdNRHNnYVNBOElHVjRjR1ZqZEdWa1ZtRnNkV1Z6TG14bGJtZDBhRHNnYVNzcktTQjdYRzRnSUNBZ0lDQWdJR2xtSUNocGN5aHdjbTl3Vm1Gc2RXVXNJR1Y0Y0dWamRHVmtWbUZzZFdWelcybGRLU2tnZTF4dUlDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCdWRXeHNPMXh1SUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0I5WEc1Y2JpQWdJQ0FnSUhaaGNpQjJZV3gxWlhOVGRISnBibWNnUFNCS1UwOU9Mbk4wY21sdVoybG1lU2hsZUhCbFkzUmxaRlpoYkhWbGN5azdYRzRnSUNBZ0lDQnlaWFIxY200Z2JtVjNJRkJ5YjNCVWVYQmxSWEp5YjNJb0owbHVkbUZzYVdRZ0p5QXJJR3h2WTJGMGFXOXVJQ3NnSnlCZ0p5QXJJSEJ5YjNCR2RXeHNUbUZ0WlNBcklDZGdJRzltSUhaaGJIVmxJR0FuSUNzZ2NISnZjRlpoYkhWbElDc2dKMkFnSnlBcklDZ25jM1Z3Y0d4cFpXUWdkRzhnWUNjZ0t5QmpiMjF3YjI1bGJuUk9ZVzFsSUNzZ0oyQXNJR1Y0Y0dWamRHVmtJRzl1WlNCdlppQW5JQ3NnZG1Gc2RXVnpVM1J5YVc1bklDc2dKeTRuS1NrN1hHNGdJQ0FnZlZ4dUlDQWdJSEpsZEhWeWJpQmpjbVZoZEdWRGFHRnBibUZpYkdWVWVYQmxRMmhsWTJ0bGNpaDJZV3hwWkdGMFpTazdYRzRnSUgxY2JseHVJQ0JtZFc1amRHbHZiaUJqY21WaGRHVlBZbXBsWTNSUFpsUjVjR1ZEYUdWamEyVnlLSFI1Y0dWRGFHVmphMlZ5S1NCN1hHNGdJQ0FnWm5WdVkzUnBiMjRnZG1Gc2FXUmhkR1VvY0hKdmNITXNJSEJ5YjNCT1lXMWxMQ0JqYjIxd2IyNWxiblJPWVcxbExDQnNiMk5oZEdsdmJpd2djSEp2Y0VaMWJHeE9ZVzFsS1NCN1hHNGdJQ0FnSUNCcFppQW9kSGx3Wlc5bUlIUjVjR1ZEYUdWamEyVnlJQ0U5UFNBblpuVnVZM1JwYjI0bktTQjdYRzRnSUNBZ0lDQWdJSEpsZEhWeWJpQnVaWGNnVUhKdmNGUjVjR1ZGY25KdmNpZ25VSEp2Y0dWeWRIa2dZQ2NnS3lCd2NtOXdSblZzYkU1aGJXVWdLeUFuWUNCdlppQmpiMjF3YjI1bGJuUWdZQ2NnS3lCamIyMXdiMjVsYm5ST1lXMWxJQ3NnSjJBZ2FHRnpJR2x1ZG1Gc2FXUWdVSEp2Y0ZSNWNHVWdibTkwWVhScGIyNGdhVzV6YVdSbElHOWlhbVZqZEU5bUxpY3BPMXh1SUNBZ0lDQWdmVnh1SUNBZ0lDQWdkbUZ5SUhCeWIzQldZV3gxWlNBOUlIQnliM0J6VzNCeWIzQk9ZVzFsWFR0Y2JpQWdJQ0FnSUhaaGNpQndjbTl3Vkhsd1pTQTlJR2RsZEZCeWIzQlVlWEJsS0hCeWIzQldZV3gxWlNrN1hHNGdJQ0FnSUNCcFppQW9jSEp2Y0ZSNWNHVWdJVDA5SUNkdlltcGxZM1FuS1NCN1hHNGdJQ0FnSUNBZ0lISmxkSFZ5YmlCdVpYY2dVSEp2Y0ZSNWNHVkZjbkp2Y2lnblNXNTJZV3hwWkNBbklDc2diRzlqWVhScGIyNGdLeUFuSUdBbklDc2djSEp2Y0VaMWJHeE9ZVzFsSUNzZ0oyQWdiMllnZEhsd1pTQW5JQ3NnS0NkZ0p5QXJJSEJ5YjNCVWVYQmxJQ3NnSjJBZ2MzVndjR3hwWldRZ2RHOGdZQ2NnS3lCamIyMXdiMjVsYm5ST1lXMWxJQ3NnSjJBc0lHVjRjR1ZqZEdWa0lHRnVJRzlpYW1WamRDNG5LU2s3WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdJQ0JtYjNJZ0tIWmhjaUJyWlhrZ2FXNGdjSEp2Y0ZaaGJIVmxLU0I3WEc0Z0lDQWdJQ0FnSUdsbUlDaHdjbTl3Vm1Gc2RXVXVhR0Z6VDNkdVVISnZjR1Z5ZEhrb2EyVjVLU2tnZTF4dUlDQWdJQ0FnSUNBZ0lIWmhjaUJsY25KdmNpQTlJSFI1Y0dWRGFHVmphMlZ5S0hCeWIzQldZV3gxWlN3Z2EyVjVMQ0JqYjIxd2IyNWxiblJPWVcxbExDQnNiMk5oZEdsdmJpd2djSEp2Y0VaMWJHeE9ZVzFsSUNzZ0p5NG5JQ3NnYTJWNUxDQlNaV0ZqZEZCeWIzQlVlWEJsYzFObFkzSmxkQ2s3WEc0Z0lDQWdJQ0FnSUNBZ2FXWWdLR1Z5Y205eUlHbHVjM1JoYm1ObGIyWWdSWEp5YjNJcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUJsY25KdmNqdGNiaUFnSUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUgxY2JpQWdJQ0FnSUhKbGRIVnliaUJ1ZFd4c08xeHVJQ0FnSUgxY2JpQWdJQ0J5WlhSMWNtNGdZM0psWVhSbFEyaGhhVzVoWW14bFZIbHdaVU5vWldOclpYSW9kbUZzYVdSaGRHVXBPMXh1SUNCOVhHNWNiaUFnWm5WdVkzUnBiMjRnWTNKbFlYUmxWVzVwYjI1VWVYQmxRMmhsWTJ0bGNpaGhjbkpoZVU5bVZIbHdaVU5vWldOclpYSnpLU0I3WEc0Z0lDQWdhV1lnS0NGQmNuSmhlUzVwYzBGeWNtRjVLR0Z5Y21GNVQyWlVlWEJsUTJobFkydGxjbk1wS1NCN1hHNGdJQ0FnSUNCd2NtOWpaWE56TG1WdWRpNU9UMFJGWDBWT1ZpQWhQVDBnSjNCeWIyUjFZM1JwYjI0bklEOGdkMkZ5Ym1sdVp5aG1ZV3h6WlN3Z0owbHVkbUZzYVdRZ1lYSm5kVzFsYm5RZ2MzVndjR3hwWldRZ2RHOGdiMjVsVDJaVWVYQmxMQ0JsZUhCbFkzUmxaQ0JoYmlCcGJuTjBZVzVqWlNCdlppQmhjbkpoZVM0bktTQTZJSFp2YVdRZ01EdGNiaUFnSUNBZ0lISmxkSFZ5YmlCbGJYQjBlVVoxYm1OMGFXOXVMblJvWVhSU1pYUjFjbTV6VG5Wc2JEdGNiaUFnSUNCOVhHNWNiaUFnSUNCbWIzSWdLSFpoY2lCcElEMGdNRHNnYVNBOElHRnljbUY1VDJaVWVYQmxRMmhsWTJ0bGNuTXViR1Z1WjNSb095QnBLeXNwSUh0Y2JpQWdJQ0FnSUhaaGNpQmphR1ZqYTJWeUlEMGdZWEp5WVhsUFpsUjVjR1ZEYUdWamEyVnljMXRwWFR0Y2JpQWdJQ0FnSUdsbUlDaDBlWEJsYjJZZ1kyaGxZMnRsY2lBaFBUMGdKMloxYm1OMGFXOXVKeWtnZTF4dUlDQWdJQ0FnSUNCM1lYSnVhVzVuS0Z4dUlDQWdJQ0FnSUNBZ0lHWmhiSE5sTEZ4dUlDQWdJQ0FnSUNBZ0lDZEpiblpoYkdsa0lHRnlaM1Z0Wlc1MElITjFjSEJzYVdRZ2RHOGdiMjVsVDJaVWVYQmxMaUJGZUhCbFkzUmxaQ0JoYmlCaGNuSmhlU0J2WmlCamFHVmpheUJtZFc1amRHbHZibk1zSUdKMWRDQW5JQ3RjYmlBZ0lDQWdJQ0FnSUNBbmNtVmpaV2wyWldRZ0pYTWdZWFFnYVc1a1pYZ2dKWE11Snl4Y2JpQWdJQ0FnSUNBZ0lDQm5aWFJRYjNOMFptbDRSbTl5Vkhsd1pWZGhjbTVwYm1jb1kyaGxZMnRsY2lrc1hHNGdJQ0FnSUNBZ0lDQWdhVnh1SUNBZ0lDQWdJQ0FwTzF4dUlDQWdJQ0FnSUNCeVpYUjFjbTRnWlcxd2RIbEdkVzVqZEdsdmJpNTBhR0YwVW1WMGRYSnVjMDUxYkd3N1hHNGdJQ0FnSUNCOVhHNGdJQ0FnZlZ4dVhHNGdJQ0FnWm5WdVkzUnBiMjRnZG1Gc2FXUmhkR1VvY0hKdmNITXNJSEJ5YjNCT1lXMWxMQ0JqYjIxd2IyNWxiblJPWVcxbExDQnNiMk5oZEdsdmJpd2djSEp2Y0VaMWJHeE9ZVzFsS1NCN1hHNGdJQ0FnSUNCbWIzSWdLSFpoY2lCcElEMGdNRHNnYVNBOElHRnljbUY1VDJaVWVYQmxRMmhsWTJ0bGNuTXViR1Z1WjNSb095QnBLeXNwSUh0Y2JpQWdJQ0FnSUNBZ2RtRnlJR05vWldOclpYSWdQU0JoY25KaGVVOW1WSGx3WlVOb1pXTnJaWEp6VzJsZE8xeHVJQ0FnSUNBZ0lDQnBaaUFvWTJobFkydGxjaWh3Y205d2N5d2djSEp2Y0U1aGJXVXNJR052YlhCdmJtVnVkRTVoYldVc0lHeHZZMkYwYVc5dUxDQndjbTl3Um5Wc2JFNWhiV1VzSUZKbFlXTjBVSEp2Y0ZSNWNHVnpVMlZqY21WMEtTQTlQU0J1ZFd4c0tTQjdYRzRnSUNBZ0lDQWdJQ0FnY21WMGRYSnVJRzUxYkd3N1hHNGdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lIMWNibHh1SUNBZ0lDQWdjbVYwZFhKdUlHNWxkeUJRY205d1ZIbHdaVVZ5Y205eUtDZEpiblpoYkdsa0lDY2dLeUJzYjJOaGRHbHZiaUFySUNjZ1lDY2dLeUJ3Y205d1JuVnNiRTVoYldVZ0t5QW5ZQ0J6ZFhCd2JHbGxaQ0IwYnlBbklDc2dLQ2RnSnlBcklHTnZiWEJ2Ym1WdWRFNWhiV1VnS3lBbllDNG5LU2s3WEc0Z0lDQWdmVnh1SUNBZ0lISmxkSFZ5YmlCamNtVmhkR1ZEYUdGcGJtRmliR1ZVZVhCbFEyaGxZMnRsY2loMllXeHBaR0YwWlNrN1hHNGdJSDFjYmx4dUlDQm1kVzVqZEdsdmJpQmpjbVZoZEdWT2IyUmxRMmhsWTJ0bGNpZ3BJSHRjYmlBZ0lDQm1kVzVqZEdsdmJpQjJZV3hwWkdGMFpTaHdjbTl3Y3l3Z2NISnZjRTVoYldVc0lHTnZiWEJ2Ym1WdWRFNWhiV1VzSUd4dlkyRjBhVzl1TENCd2NtOXdSblZzYkU1aGJXVXBJSHRjYmlBZ0lDQWdJR2xtSUNnaGFYTk9iMlJsS0hCeWIzQnpXM0J5YjNCT1lXMWxYU2twSUh0Y2JpQWdJQ0FnSUNBZ2NtVjBkWEp1SUc1bGR5QlFjbTl3Vkhsd1pVVnljbTl5S0NkSmJuWmhiR2xrSUNjZ0t5QnNiMk5oZEdsdmJpQXJJQ2NnWUNjZ0t5QndjbTl3Um5Wc2JFNWhiV1VnS3lBbllDQnpkWEJ3YkdsbFpDQjBieUFuSUNzZ0tDZGdKeUFySUdOdmJYQnZibVZ1ZEU1aGJXVWdLeUFuWUN3Z1pYaHdaV04wWldRZ1lTQlNaV0ZqZEU1dlpHVXVKeWtwTzF4dUlDQWdJQ0FnZlZ4dUlDQWdJQ0FnY21WMGRYSnVJRzUxYkd3N1hHNGdJQ0FnZlZ4dUlDQWdJSEpsZEhWeWJpQmpjbVZoZEdWRGFHRnBibUZpYkdWVWVYQmxRMmhsWTJ0bGNpaDJZV3hwWkdGMFpTazdYRzRnSUgxY2JseHVJQ0JtZFc1amRHbHZiaUJqY21WaGRHVlRhR0Z3WlZSNWNHVkRhR1ZqYTJWeUtITm9ZWEJsVkhsd1pYTXBJSHRjYmlBZ0lDQm1kVzVqZEdsdmJpQjJZV3hwWkdGMFpTaHdjbTl3Y3l3Z2NISnZjRTVoYldVc0lHTnZiWEJ2Ym1WdWRFNWhiV1VzSUd4dlkyRjBhVzl1TENCd2NtOXdSblZzYkU1aGJXVXBJSHRjYmlBZ0lDQWdJSFpoY2lCd2NtOXdWbUZzZFdVZ1BTQndjbTl3YzF0d2NtOXdUbUZ0WlYwN1hHNGdJQ0FnSUNCMllYSWdjSEp2Y0ZSNWNHVWdQU0JuWlhSUWNtOXdWSGx3WlNod2NtOXdWbUZzZFdVcE8xeHVJQ0FnSUNBZ2FXWWdLSEJ5YjNCVWVYQmxJQ0U5UFNBbmIySnFaV04wSnlrZ2UxeHVJQ0FnSUNBZ0lDQnlaWFIxY200Z2JtVjNJRkJ5YjNCVWVYQmxSWEp5YjNJb0owbHVkbUZzYVdRZ0p5QXJJR3h2WTJGMGFXOXVJQ3NnSnlCZ0p5QXJJSEJ5YjNCR2RXeHNUbUZ0WlNBcklDZGdJRzltSUhSNWNHVWdZQ2NnS3lCd2NtOXdWSGx3WlNBcklDZGdJQ2NnS3lBb0ozTjFjSEJzYVdWa0lIUnZJR0FuSUNzZ1kyOXRjRzl1Wlc1MFRtRnRaU0FySUNkZ0xDQmxlSEJsWTNSbFpDQmdiMkpxWldOMFlDNG5LU2s3WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdJQ0JtYjNJZ0tIWmhjaUJyWlhrZ2FXNGdjMmhoY0dWVWVYQmxjeWtnZTF4dUlDQWdJQ0FnSUNCMllYSWdZMmhsWTJ0bGNpQTlJSE5vWVhCbFZIbHdaWE5iYTJWNVhUdGNiaUFnSUNBZ0lDQWdhV1lnS0NGamFHVmphMlZ5S1NCN1hHNGdJQ0FnSUNBZ0lDQWdZMjl1ZEdsdWRXVTdYRzRnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnZG1GeUlHVnljbTl5SUQwZ1kyaGxZMnRsY2lod2NtOXdWbUZzZFdVc0lHdGxlU3dnWTI5dGNHOXVaVzUwVG1GdFpTd2diRzlqWVhScGIyNHNJSEJ5YjNCR2RXeHNUbUZ0WlNBcklDY3VKeUFySUd0bGVTd2dVbVZoWTNSUWNtOXdWSGx3WlhOVFpXTnlaWFFwTzF4dUlDQWdJQ0FnSUNCcFppQW9aWEp5YjNJcElIdGNiaUFnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdaWEp5YjNJN1hHNGdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lIMWNiaUFnSUNBZ0lISmxkSFZ5YmlCdWRXeHNPMXh1SUNBZ0lIMWNiaUFnSUNCeVpYUjFjbTRnWTNKbFlYUmxRMmhoYVc1aFlteGxWSGx3WlVOb1pXTnJaWElvZG1Gc2FXUmhkR1VwTzF4dUlDQjlYRzVjYmlBZ1puVnVZM1JwYjI0Z2FYTk9iMlJsS0hCeWIzQldZV3gxWlNrZ2UxeHVJQ0FnSUhOM2FYUmphQ0FvZEhsd1pXOW1JSEJ5YjNCV1lXeDFaU2tnZTF4dUlDQWdJQ0FnWTJGelpTQW5iblZ0WW1WeUp6cGNiaUFnSUNBZ0lHTmhjMlVnSjNOMGNtbHVaeWM2WEc0Z0lDQWdJQ0JqWVhObElDZDFibVJsWm1sdVpXUW5PbHh1SUNBZ0lDQWdJQ0J5WlhSMWNtNGdkSEoxWlR0Y2JpQWdJQ0FnSUdOaGMyVWdKMkp2YjJ4bFlXNG5PbHh1SUNBZ0lDQWdJQ0J5WlhSMWNtNGdJWEJ5YjNCV1lXeDFaVHRjYmlBZ0lDQWdJR05oYzJVZ0oyOWlhbVZqZENjNlhHNGdJQ0FnSUNBZ0lHbG1JQ2hCY25KaGVTNXBjMEZ5Y21GNUtIQnliM0JXWVd4MVpTa3BJSHRjYmlBZ0lDQWdJQ0FnSUNCeVpYUjFjbTRnY0hKdmNGWmhiSFZsTG1WMlpYSjVLR2x6VG05a1pTazdYRzRnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnYVdZZ0tIQnliM0JXWVd4MVpTQTlQVDBnYm5Wc2JDQjhmQ0JwYzFaaGJHbGtSV3hsYldWdWRDaHdjbTl3Vm1Gc2RXVXBLU0I3WEc0Z0lDQWdJQ0FnSUNBZ2NtVjBkWEp1SUhSeWRXVTdYRzRnSUNBZ0lDQWdJSDFjYmx4dUlDQWdJQ0FnSUNCMllYSWdhWFJsY21GMGIzSkdiaUE5SUdkbGRFbDBaWEpoZEc5eVJtNG9jSEp2Y0ZaaGJIVmxLVHRjYmlBZ0lDQWdJQ0FnYVdZZ0tHbDBaWEpoZEc5eVJtNHBJSHRjYmlBZ0lDQWdJQ0FnSUNCMllYSWdhWFJsY21GMGIzSWdQU0JwZEdWeVlYUnZja1p1TG1OaGJHd29jSEp2Y0ZaaGJIVmxLVHRjYmlBZ0lDQWdJQ0FnSUNCMllYSWdjM1JsY0R0Y2JpQWdJQ0FnSUNBZ0lDQnBaaUFvYVhSbGNtRjBiM0pHYmlBaFBUMGdjSEp2Y0ZaaGJIVmxMbVZ1ZEhKcFpYTXBJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lIZG9hV3hsSUNnaEtITjBaWEFnUFNCcGRHVnlZWFJ2Y2k1dVpYaDBLQ2twTG1SdmJtVXBJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdhV1lnS0NGcGMwNXZaR1VvYzNSbGNDNTJZV3gxWlNrcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z1ptRnNjMlU3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdJQ0I5SUdWc2MyVWdlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0x5OGdTWFJsY21GMGIzSWdkMmxzYkNCd2NtOTJhV1JsSUdWdWRISjVJRnRyTEhaZElIUjFjR3hsY3lCeVlYUm9aWElnZEdoaGJpQjJZV3gxWlhNdVhHNGdJQ0FnSUNBZ0lDQWdJQ0IzYUdsc1pTQW9JU2h6ZEdWd0lEMGdhWFJsY21GMGIzSXVibVY0ZENncEtTNWtiMjVsS1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUhaaGNpQmxiblJ5ZVNBOUlITjBaWEF1ZG1Gc2RXVTdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lHbG1JQ2hsYm5SeWVTa2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR2xtSUNnaGFYTk9iMlJsS0dWdWRISjVXekZkS1NrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdjbVYwZFhKdUlHWmhiSE5sTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ2ZTQmxiSE5sSUh0Y2JpQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z1ptRnNjMlU3WEc0Z0lDQWdJQ0FnSUgxY2JseHVJQ0FnSUNBZ0lDQnlaWFIxY200Z2RISjFaVHRjYmlBZ0lDQWdJR1JsWm1GMWJIUTZYRzRnSUNBZ0lDQWdJSEpsZEhWeWJpQm1ZV3h6WlR0Y2JpQWdJQ0I5WEc0Z0lIMWNibHh1SUNCbWRXNWpkR2x2YmlCcGMxTjViV0p2YkNod2NtOXdWSGx3WlN3Z2NISnZjRlpoYkhWbEtTQjdYRzRnSUNBZ0x5OGdUbUYwYVhabElGTjViV0p2YkM1Y2JpQWdJQ0JwWmlBb2NISnZjRlI1Y0dVZ1BUMDlJQ2R6ZVcxaWIyd25LU0I3WEc0Z0lDQWdJQ0J5WlhSMWNtNGdkSEoxWlR0Y2JpQWdJQ0I5WEc1Y2JpQWdJQ0F2THlBeE9TNDBMak11TlNCVGVXMWliMnd1Y0hKdmRHOTBlWEJsVzBCQWRHOVRkSEpwYm1kVVlXZGRJRDA5UFNBblUzbHRZbTlzSjF4dUlDQWdJR2xtSUNod2NtOXdWbUZzZFdWYkowQkFkRzlUZEhKcGJtZFVZV2NuWFNBOVBUMGdKMU41YldKdmJDY3BJSHRjYmlBZ0lDQWdJSEpsZEhWeWJpQjBjblZsTzF4dUlDQWdJSDFjYmx4dUlDQWdJQzh2SUVaaGJHeGlZV05ySUdadmNpQnViMjR0YzNCbFl5QmpiMjF3YkdsaGJuUWdVM2x0WW05c2N5QjNhR2xqYUNCaGNtVWdjRzlzZVdacGJHeGxaQzVjYmlBZ0lDQnBaaUFvZEhsd1pXOW1JRk41YldKdmJDQTlQVDBnSjJaMWJtTjBhVzl1SnlBbUppQndjbTl3Vm1Gc2RXVWdhVzV6ZEdGdVkyVnZaaUJUZVcxaWIyd3BJSHRjYmlBZ0lDQWdJSEpsZEhWeWJpQjBjblZsTzF4dUlDQWdJSDFjYmx4dUlDQWdJSEpsZEhWeWJpQm1ZV3h6WlR0Y2JpQWdmVnh1WEc0Z0lDOHZJRVZ4ZFdsMllXeGxiblFnYjJZZ1lIUjVjR1Z2Wm1BZ1luVjBJSGRwZEdnZ2MzQmxZMmxoYkNCb1lXNWtiR2x1WnlCbWIzSWdZWEp5WVhrZ1lXNWtJSEpsWjJWNGNDNWNiaUFnWm5WdVkzUnBiMjRnWjJWMFVISnZjRlI1Y0dVb2NISnZjRlpoYkhWbEtTQjdYRzRnSUNBZ2RtRnlJSEJ5YjNCVWVYQmxJRDBnZEhsd1pXOW1JSEJ5YjNCV1lXeDFaVHRjYmlBZ0lDQnBaaUFvUVhKeVlYa3VhWE5CY25KaGVTaHdjbTl3Vm1Gc2RXVXBLU0I3WEc0Z0lDQWdJQ0J5WlhSMWNtNGdKMkZ5Y21GNUp6dGNiaUFnSUNCOVhHNGdJQ0FnYVdZZ0tIQnliM0JXWVd4MVpTQnBibk4wWVc1alpXOW1JRkpsWjBWNGNDa2dlMXh1SUNBZ0lDQWdMeThnVDJ4a0lIZGxZbXRwZEhNZ0tHRjBJR3hsWVhOMElIVnVkR2xzSUVGdVpISnZhV1FnTkM0d0tTQnlaWFIxY200Z0oyWjFibU4wYVc5dUp5QnlZWFJvWlhJZ2RHaGhibHh1SUNBZ0lDQWdMeThnSjI5aWFtVmpkQ2NnWm05eUlIUjVjR1Z2WmlCaElGSmxaMFY0Y0M0Z1YyVW5iR3dnYm05eWJXRnNhWHBsSUhSb2FYTWdhR1Z5WlNCemJ5QjBhR0YwSUM5aWJHRXZYRzRnSUNBZ0lDQXZMeUJ3WVhOelpYTWdVSEp2Y0ZSNWNHVnpMbTlpYW1WamRDNWNiaUFnSUNBZ0lISmxkSFZ5YmlBbmIySnFaV04wSnp0Y2JpQWdJQ0I5WEc0Z0lDQWdhV1lnS0dselUzbHRZbTlzS0hCeWIzQlVlWEJsTENCd2NtOXdWbUZzZFdVcEtTQjdYRzRnSUNBZ0lDQnlaWFIxY200Z0ozTjViV0p2YkNjN1hHNGdJQ0FnZlZ4dUlDQWdJSEpsZEhWeWJpQndjbTl3Vkhsd1pUdGNiaUFnZlZ4dVhHNGdJQzh2SUZSb2FYTWdhR0Z1Wkd4bGN5QnRiM0psSUhSNWNHVnpJSFJvWVc0Z1lHZGxkRkJ5YjNCVWVYQmxZQzRnVDI1c2VTQjFjMlZrSUdadmNpQmxjbkp2Y2lCdFpYTnpZV2RsY3k1Y2JpQWdMeThnVTJWbElHQmpjbVZoZEdWUWNtbHRhWFJwZG1WVWVYQmxRMmhsWTJ0bGNtQXVYRzRnSUdaMWJtTjBhVzl1SUdkbGRGQnlaV05wYzJWVWVYQmxLSEJ5YjNCV1lXeDFaU2tnZTF4dUlDQWdJR2xtSUNoMGVYQmxiMllnY0hKdmNGWmhiSFZsSUQwOVBTQW5kVzVrWldacGJtVmtKeUI4ZkNCd2NtOXdWbUZzZFdVZ1BUMDlJRzUxYkd3cElIdGNiaUFnSUNBZ0lISmxkSFZ5YmlBbkp5QXJJSEJ5YjNCV1lXeDFaVHRjYmlBZ0lDQjlYRzRnSUNBZ2RtRnlJSEJ5YjNCVWVYQmxJRDBnWjJWMFVISnZjRlI1Y0dVb2NISnZjRlpoYkhWbEtUdGNiaUFnSUNCcFppQW9jSEp2Y0ZSNWNHVWdQVDA5SUNkdlltcGxZM1FuS1NCN1hHNGdJQ0FnSUNCcFppQW9jSEp2Y0ZaaGJIVmxJR2x1YzNSaGJtTmxiMllnUkdGMFpTa2dlMXh1SUNBZ0lDQWdJQ0J5WlhSMWNtNGdKMlJoZEdVbk8xeHVJQ0FnSUNBZ2ZTQmxiSE5sSUdsbUlDaHdjbTl3Vm1Gc2RXVWdhVzV6ZEdGdVkyVnZaaUJTWldkRmVIQXBJSHRjYmlBZ0lDQWdJQ0FnY21WMGRYSnVJQ2R5WldkbGVIQW5PMXh1SUNBZ0lDQWdmVnh1SUNBZ0lIMWNiaUFnSUNCeVpYUjFjbTRnY0hKdmNGUjVjR1U3WEc0Z0lIMWNibHh1SUNBdkx5QlNaWFIxY201eklHRWdjM1J5YVc1bklIUm9ZWFFnYVhNZ2NHOXpkR1pwZUdWa0lIUnZJR0VnZDJGeWJtbHVaeUJoWW05MWRDQmhiaUJwYm5aaGJHbGtJSFI1Y0dVdVhHNGdJQzh2SUVadmNpQmxlR0Z0Y0d4bExDQmNJblZ1WkdWbWFXNWxaRndpSUc5eUlGd2liMllnZEhsd1pTQmhjbkpoZVZ3aVhHNGdJR1oxYm1OMGFXOXVJR2RsZEZCdmMzUm1hWGhHYjNKVWVYQmxWMkZ5Ym1sdVp5aDJZV3gxWlNrZ2UxeHVJQ0FnSUhaaGNpQjBlWEJsSUQwZ1oyVjBVSEpsWTJselpWUjVjR1VvZG1Gc2RXVXBPMXh1SUNBZ0lITjNhWFJqYUNBb2RIbHdaU2tnZTF4dUlDQWdJQ0FnWTJGelpTQW5ZWEp5WVhrbk9seHVJQ0FnSUNBZ1kyRnpaU0FuYjJKcVpXTjBKenBjYmlBZ0lDQWdJQ0FnY21WMGRYSnVJQ2RoYmlBbklDc2dkSGx3WlR0Y2JpQWdJQ0FnSUdOaGMyVWdKMkp2YjJ4bFlXNG5PbHh1SUNBZ0lDQWdZMkZ6WlNBblpHRjBaU2M2WEc0Z0lDQWdJQ0JqWVhObElDZHlaV2RsZUhBbk9seHVJQ0FnSUNBZ0lDQnlaWFIxY200Z0oyRWdKeUFySUhSNWNHVTdYRzRnSUNBZ0lDQmtaV1poZFd4ME9seHVJQ0FnSUNBZ0lDQnlaWFIxY200Z2RIbHdaVHRjYmlBZ0lDQjlYRzRnSUgxY2JseHVJQ0F2THlCU1pYUjFjbTV6SUdOc1lYTnpJRzVoYldVZ2IyWWdkR2hsSUc5aWFtVmpkQ3dnYVdZZ1lXNTVMbHh1SUNCbWRXNWpkR2x2YmlCblpYUkRiR0Z6YzA1aGJXVW9jSEp2Y0ZaaGJIVmxLU0I3WEc0Z0lDQWdhV1lnS0NGd2NtOXdWbUZzZFdVdVkyOXVjM1J5ZFdOMGIzSWdmSHdnSVhCeWIzQldZV3gxWlM1amIyNXpkSEoxWTNSdmNpNXVZVzFsS1NCN1hHNGdJQ0FnSUNCeVpYUjFjbTRnUVU1UFRsbE5UMVZUTzF4dUlDQWdJSDFjYmlBZ0lDQnlaWFIxY200Z2NISnZjRlpoYkhWbExtTnZibk4wY25WamRHOXlMbTVoYldVN1hHNGdJSDFjYmx4dUlDQlNaV0ZqZEZCeWIzQlVlWEJsY3k1amFHVmphMUJ5YjNCVWVYQmxjeUE5SUdOb1pXTnJVSEp2Y0ZSNWNHVnpPMXh1SUNCU1pXRmpkRkJ5YjNCVWVYQmxjeTVRY205d1ZIbHdaWE1nUFNCU1pXRmpkRkJ5YjNCVWVYQmxjenRjYmx4dUlDQnlaWFIxY200Z1VtVmhZM1JRY205d1ZIbHdaWE03WEc1OU8xeHVJaXdpTHlvcVhHNGdLaUJEYjNCNWNtbG5hSFFnTWpBeE15MXdjbVZ6Wlc1MExDQkdZV05sWW05dmF5d2dTVzVqTGx4dUlDb2dRV3hzSUhKcFoyaDBjeUJ5WlhObGNuWmxaQzVjYmlBcVhHNGdLaUJVYUdseklITnZkWEpqWlNCamIyUmxJR2x6SUd4cFkyVnVjMlZrSUhWdVpHVnlJSFJvWlNCQ1UwUXRjM1I1YkdVZ2JHbGpaVzV6WlNCbWIzVnVaQ0JwYmlCMGFHVmNiaUFxSUV4SlEwVk9VMFVnWm1sc1pTQnBiaUIwYUdVZ2NtOXZkQ0JrYVhKbFkzUnZjbmtnYjJZZ2RHaHBjeUJ6YjNWeVkyVWdkSEpsWlM0Z1FXNGdZV1JrYVhScGIyNWhiQ0JuY21GdWRGeHVJQ29nYjJZZ2NHRjBaVzUwSUhKcFoyaDBjeUJqWVc0Z1ltVWdabTkxYm1RZ2FXNGdkR2hsSUZCQlZFVk9WRk1nWm1sc1pTQnBiaUIwYUdVZ2MyRnRaU0JrYVhKbFkzUnZjbmt1WEc0Z0tpOWNibHh1SjNWelpTQnpkSEpwWTNRbk8xeHVYRzUyWVhJZ1VtVmhZM1JRY205d1ZIbHdaWE5UWldOeVpYUWdQU0FuVTBWRFVrVlVYMFJQWDA1UFZGOVFRVk5UWDFSSVNWTmZUMUpmV1U5VlgxZEpURXhmUWtWZlJrbFNSVVFuTzF4dVhHNXRiMlIxYkdVdVpYaHdiM0owY3lBOUlGSmxZV04wVUhKdmNGUjVjR1Z6VTJWamNtVjBPMXh1SWl3aUx5b3FYRzRnS2lCRGIzQjVjbWxuYUhRZ01qQXhNeTF3Y21WelpXNTBMQ0JHWVdObFltOXZheXdnU1c1akxseHVJQ29nUVd4c0lISnBaMmgwY3lCeVpYTmxjblpsWkM1Y2JpQXFYRzRnS2lCVWFHbHpJSE52ZFhKalpTQmpiMlJsSUdseklHeHBZMlZ1YzJWa0lIVnVaR1Z5SUhSb1pTQkNVMFF0YzNSNWJHVWdiR2xqWlc1elpTQm1iM1Z1WkNCcGJpQjBhR1ZjYmlBcUlFeEpRMFZPVTBVZ1ptbHNaU0JwYmlCMGFHVWdjbTl2ZENCa2FYSmxZM1J2Y25rZ2IyWWdkR2hwY3lCemIzVnlZMlVnZEhKbFpTNGdRVzRnWVdSa2FYUnBiMjVoYkNCbmNtRnVkRnh1SUNvZ2IyWWdjR0YwWlc1MElISnBaMmgwY3lCallXNGdZbVVnWm05MWJtUWdhVzRnZEdobElGQkJWRVZPVkZNZ1ptbHNaU0JwYmlCMGFHVWdjMkZ0WlNCa2FYSmxZM1J2Y25rdVhHNGdLbHh1SUNvZ1hHNGdLaTljYmx4dUozVnpaU0J6ZEhKcFkzUW5PMXh1WEc0dktpcGNiaUFxSUVWelkyRndaU0JoYm1RZ2QzSmhjQ0JyWlhrZ2MyOGdhWFFnYVhNZ2MyRm1aU0IwYnlCMWMyVWdZWE1nWVNCeVpXRmpkR2xrWEc0Z0tseHVJQ29nUUhCaGNtRnRJSHR6ZEhKcGJtZDlJR3RsZVNCMGJ5QmlaU0JsYzJOaGNHVmtMbHh1SUNvZ1FISmxkSFZ5YmlCN2MzUnlhVzVuZlNCMGFHVWdaWE5qWVhCbFpDQnJaWGt1WEc0Z0tpOWNibHh1Wm5WdVkzUnBiMjRnWlhOallYQmxLR3RsZVNrZ2UxeHVJQ0IyWVhJZ1pYTmpZWEJsVW1WblpYZ2dQU0F2V3owNlhTOW5PMXh1SUNCMllYSWdaWE5qWVhCbGNreHZiMnQxY0NBOUlIdGNiaUFnSUNBblBTYzZJQ2M5TUNjc1hHNGdJQ0FnSnpvbk9pQW5QVEluWEc0Z0lIMDdYRzRnSUhaaGNpQmxjMk5oY0dWa1UzUnlhVzVuSUQwZ0tDY25JQ3NnYTJWNUtTNXlaWEJzWVdObEtHVnpZMkZ3WlZKbFoyVjRMQ0JtZFc1amRHbHZiaUFvYldGMFkyZ3BJSHRjYmlBZ0lDQnlaWFIxY200Z1pYTmpZWEJsY2t4dmIydDFjRnR0WVhSamFGMDdYRzRnSUgwcE8xeHVYRzRnSUhKbGRIVnliaUFuSkNjZ0t5QmxjMk5oY0dWa1UzUnlhVzVuTzF4dWZWeHVYRzR2S2lwY2JpQXFJRlZ1WlhOallYQmxJR0Z1WkNCMWJuZHlZWEFnYTJWNUlHWnZjaUJvZFcxaGJpMXlaV0ZrWVdKc1pTQmthWE53YkdGNVhHNGdLbHh1SUNvZ1FIQmhjbUZ0SUh0emRISnBibWQ5SUd0bGVTQjBieUIxYm1WelkyRndaUzVjYmlBcUlFQnlaWFIxY200Z2UzTjBjbWx1WjMwZ2RHaGxJSFZ1WlhOallYQmxaQ0JyWlhrdVhHNGdLaTljYm1aMWJtTjBhVzl1SUhWdVpYTmpZWEJsS0d0bGVTa2dlMXh1SUNCMllYSWdkVzVsYzJOaGNHVlNaV2RsZUNBOUlDOG9QVEI4UFRJcEwyYzdYRzRnSUhaaGNpQjFibVZ6WTJGd1pYSk1iMjlyZFhBZ1BTQjdYRzRnSUNBZ0p6MHdKem9nSnowbkxGeHVJQ0FnSUNjOU1pYzZJQ2M2SjF4dUlDQjlPMXh1SUNCMllYSWdhMlY1VTNWaWMzUnlhVzVuSUQwZ2EyVjVXekJkSUQwOVBTQW5MaWNnSmlZZ2EyVjVXekZkSUQwOVBTQW5KQ2NnUHlCclpYa3VjM1ZpYzNSeWFXNW5LRElwSURvZ2EyVjVMbk4xWW5OMGNtbHVaeWd4S1R0Y2JseHVJQ0J5WlhSMWNtNGdLQ2NuSUNzZ2EyVjVVM1ZpYzNSeWFXNW5LUzV5WlhCc1lXTmxLSFZ1WlhOallYQmxVbVZuWlhnc0lHWjFibU4wYVc5dUlDaHRZWFJqYUNrZ2UxeHVJQ0FnSUhKbGRIVnliaUIxYm1WelkyRndaWEpNYjI5cmRYQmJiV0YwWTJoZE8xeHVJQ0I5S1R0Y2JuMWNibHh1ZG1GeUlFdGxlVVZ6WTJGd1pWVjBhV3h6SUQwZ2UxeHVJQ0JsYzJOaGNHVTZJR1Z6WTJGd1pTeGNiaUFnZFc1bGMyTmhjR1U2SUhWdVpYTmpZWEJsWEc1OU8xeHVYRzV0YjJSMWJHVXVaWGh3YjNKMGN5QTlJRXRsZVVWelkyRndaVlYwYVd4ek95SXNJaThxS2x4dUlDb2dRMjl3ZVhKcFoyaDBJREl3TVRNdGNISmxjMlZ1ZEN3Z1JtRmpaV0p2YjJzc0lFbHVZeTVjYmlBcUlFRnNiQ0J5YVdkb2RITWdjbVZ6WlhKMlpXUXVYRzRnS2x4dUlDb2dWR2hwY3lCemIzVnlZMlVnWTI5a1pTQnBjeUJzYVdObGJuTmxaQ0IxYm1SbGNpQjBhR1VnUWxORUxYTjBlV3hsSUd4cFkyVnVjMlVnWm05MWJtUWdhVzRnZEdobFhHNGdLaUJNU1VORlRsTkZJR1pwYkdVZ2FXNGdkR2hsSUhKdmIzUWdaR2x5WldOMGIzSjVJRzltSUhSb2FYTWdjMjkxY21ObElIUnlaV1V1SUVGdUlHRmtaR2wwYVc5dVlXd2daM0poYm5SY2JpQXFJRzltSUhCaGRHVnVkQ0J5YVdkb2RITWdZMkZ1SUdKbElHWnZkVzVrSUdsdUlIUm9aU0JRUVZSRlRsUlRJR1pwYkdVZ2FXNGdkR2hsSUhOaGJXVWdaR2x5WldOMGIzSjVMbHh1SUNwY2JpQXFJRnh1SUNvdlhHNWNiaWQxYzJVZ2MzUnlhV04wSnp0Y2JseHVkbUZ5SUY5d2NtOWtTVzUyWVhKcFlXNTBJRDBnY21WeGRXbHlaU2duTGk5eVpXRmpkRkJ5YjJSSmJuWmhjbWxoYm5RbktUdGNibHh1ZG1GeUlHbHVkbUZ5YVdGdWRDQTlJSEpsY1hWcGNtVW9KMlppYW5NdmJHbGlMMmx1ZG1GeWFXRnVkQ2NwTzF4dVhHNHZLaXBjYmlBcUlGTjBZWFJwWXlCd2IyOXNaWEp6TGlCVFpYWmxjbUZzSUdOMWMzUnZiU0IyWlhKemFXOXVjeUJtYjNJZ1pXRmphQ0J3YjNSbGJuUnBZV3dnYm5WdFltVnlJRzltWEc0Z0tpQmhjbWQxYldWdWRITXVJRUVnWTI5dGNHeGxkR1ZzZVNCblpXNWxjbWxqSUhCdmIyeGxjaUJwY3lCbFlYTjVJSFJ2SUdsdGNHeGxiV1Z1ZEN3Z1luVjBJSGR2ZFd4a1hHNGdLaUJ5WlhGMWFYSmxJR0ZqWTJWemMybHVaeUIwYUdVZ1lHRnlaM1Z0Wlc1MGMyQWdiMkpxWldOMExpQkpiaUJsWVdOb0lHOW1JSFJvWlhObExDQmdkR2hwYzJBZ2NtVm1aWEp6SUhSdlhHNGdLaUIwYUdVZ1EyeGhjM01nYVhSelpXeG1MQ0J1YjNRZ1lXNGdhVzV6ZEdGdVkyVXVJRWxtSUdGdWVTQnZkR2hsY25NZ1lYSmxJRzVsWldSbFpDd2djMmx0Y0d4NUlHRmtaQ0IwYUdWdFhHNGdLaUJvWlhKbExDQnZjaUJwYmlCMGFHVnBjaUJ2ZDI0Z1ptbHNaWE11WEc0Z0tpOWNiblpoY2lCdmJtVkJjbWQxYldWdWRGQnZiMnhsY2lBOUlHWjFibU4wYVc5dUlDaGpiM0I1Um1sbGJHUnpSbkp2YlNrZ2UxeHVJQ0IyWVhJZ1MyeGhjM01nUFNCMGFHbHpPMXh1SUNCcFppQW9TMnhoYzNNdWFXNXpkR0Z1WTJWUWIyOXNMbXhsYm1kMGFDa2dlMXh1SUNBZ0lIWmhjaUJwYm5OMFlXNWpaU0E5SUV0c1lYTnpMbWx1YzNSaGJtTmxVRzl2YkM1d2IzQW9LVHRjYmlBZ0lDQkxiR0Z6Y3k1allXeHNLR2x1YzNSaGJtTmxMQ0JqYjNCNVJtbGxiR1J6Um5KdmJTazdYRzRnSUNBZ2NtVjBkWEp1SUdsdWMzUmhibU5sTzF4dUlDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUhKbGRIVnliaUJ1WlhjZ1MyeGhjM01vWTI5d2VVWnBaV3hrYzBaeWIyMHBPMXh1SUNCOVhHNTlPMXh1WEc1MllYSWdkSGR2UVhKbmRXMWxiblJRYjI5c1pYSWdQU0JtZFc1amRHbHZiaUFvWVRFc0lHRXlLU0I3WEc0Z0lIWmhjaUJMYkdGemN5QTlJSFJvYVhNN1hHNGdJR2xtSUNoTGJHRnpjeTVwYm5OMFlXNWpaVkJ2YjJ3dWJHVnVaM1JvS1NCN1hHNGdJQ0FnZG1GeUlHbHVjM1JoYm1ObElEMGdTMnhoYzNNdWFXNXpkR0Z1WTJWUWIyOXNMbkJ2Y0NncE8xeHVJQ0FnSUV0c1lYTnpMbU5oYkd3b2FXNXpkR0Z1WTJVc0lHRXhMQ0JoTWlrN1hHNGdJQ0FnY21WMGRYSnVJR2x1YzNSaGJtTmxPMXh1SUNCOUlHVnNjMlVnZTF4dUlDQWdJSEpsZEhWeWJpQnVaWGNnUzJ4aGMzTW9ZVEVzSUdFeUtUdGNiaUFnZlZ4dWZUdGNibHh1ZG1GeUlIUm9jbVZsUVhKbmRXMWxiblJRYjI5c1pYSWdQU0JtZFc1amRHbHZiaUFvWVRFc0lHRXlMQ0JoTXlrZ2UxeHVJQ0IyWVhJZ1MyeGhjM01nUFNCMGFHbHpPMXh1SUNCcFppQW9TMnhoYzNNdWFXNXpkR0Z1WTJWUWIyOXNMbXhsYm1kMGFDa2dlMXh1SUNBZ0lIWmhjaUJwYm5OMFlXNWpaU0E5SUV0c1lYTnpMbWx1YzNSaGJtTmxVRzl2YkM1d2IzQW9LVHRjYmlBZ0lDQkxiR0Z6Y3k1allXeHNLR2x1YzNSaGJtTmxMQ0JoTVN3Z1lUSXNJR0V6S1R0Y2JpQWdJQ0J5WlhSMWNtNGdhVzV6ZEdGdVkyVTdYRzRnSUgwZ1pXeHpaU0I3WEc0Z0lDQWdjbVYwZFhKdUlHNWxkeUJMYkdGemN5aGhNU3dnWVRJc0lHRXpLVHRjYmlBZ2ZWeHVmVHRjYmx4dWRtRnlJR1p2ZFhKQmNtZDFiV1Z1ZEZCdmIyeGxjaUE5SUdaMWJtTjBhVzl1SUNoaE1Td2dZVElzSUdFekxDQmhOQ2tnZTF4dUlDQjJZWElnUzJ4aGMzTWdQU0IwYUdsek8xeHVJQ0JwWmlBb1MyeGhjM011YVc1emRHRnVZMlZRYjI5c0xteGxibWQwYUNrZ2UxeHVJQ0FnSUhaaGNpQnBibk4wWVc1alpTQTlJRXRzWVhOekxtbHVjM1JoYm1ObFVHOXZiQzV3YjNBb0tUdGNiaUFnSUNCTGJHRnpjeTVqWVd4c0tHbHVjM1JoYm1ObExDQmhNU3dnWVRJc0lHRXpMQ0JoTkNrN1hHNGdJQ0FnY21WMGRYSnVJR2x1YzNSaGJtTmxPMXh1SUNCOUlHVnNjMlVnZTF4dUlDQWdJSEpsZEhWeWJpQnVaWGNnUzJ4aGMzTW9ZVEVzSUdFeUxDQmhNeXdnWVRRcE8xeHVJQ0I5WEc1OU8xeHVYRzUyWVhJZ2MzUmhibVJoY21SU1pXeGxZWE5sY2lBOUlHWjFibU4wYVc5dUlDaHBibk4wWVc1alpTa2dlMXh1SUNCMllYSWdTMnhoYzNNZ1BTQjBhR2x6TzF4dUlDQWhLR2x1YzNSaGJtTmxJR2x1YzNSaGJtTmxiMllnUzJ4aGMzTXBJRDhnY0hKdlkyVnpjeTVsYm5ZdVRrOUVSVjlGVGxZZ0lUMDlJQ2R3Y205a2RXTjBhVzl1SnlBL0lHbHVkbUZ5YVdGdWRDaG1ZV3h6WlN3Z0oxUnllV2x1WnlCMGJ5QnlaV3hsWVhObElHRnVJR2x1YzNSaGJtTmxJR2x1ZEc4Z1lTQndiMjlzSUc5bUlHRWdaR2xtWm1WeVpXNTBJSFI1Y0dVdUp5a2dPaUJmY0hKdlpFbHVkbUZ5YVdGdWRDZ25NalVuS1NBNklIWnZhV1FnTUR0Y2JpQWdhVzV6ZEdGdVkyVXVaR1Z6ZEhKMVkzUnZjaWdwTzF4dUlDQnBaaUFvUzJ4aGMzTXVhVzV6ZEdGdVkyVlFiMjlzTG14bGJtZDBhQ0E4SUV0c1lYTnpMbkJ2YjJ4VGFYcGxLU0I3WEc0Z0lDQWdTMnhoYzNNdWFXNXpkR0Z1WTJWUWIyOXNMbkIxYzJnb2FXNXpkR0Z1WTJVcE8xeHVJQ0I5WEc1OU8xeHVYRzUyWVhJZ1JFVkdRVlZNVkY5UVQwOU1YMU5KV2tVZ1BTQXhNRHRjYm5aaGNpQkVSVVpCVlV4VVgxQlBUMHhGVWlBOUlHOXVaVUZ5WjNWdFpXNTBVRzl2YkdWeU8xeHVYRzR2S2lwY2JpQXFJRUYxWjIxbGJuUnpJR0JEYjNCNVEyOXVjM1J5ZFdOMGIzSmdJSFJ2SUdKbElHRWdjRzl2YkdGaWJHVWdZMnhoYzNNc0lHRjFaMjFsYm5ScGJtY2diMjVzZVNCMGFHVWdZMnhoYzNOY2JpQXFJR2wwYzJWc1ppQW9jM1JoZEdsallXeHNlU2tnYm05MElHRmtaR2x1WnlCaGJua2djSEp2ZEc5MGVYQnBZMkZzSUdacFpXeGtjeTRnUVc1NUlFTnZjSGxEYjI1emRISjFZM1J2Y2x4dUlDb2dlVzkxSUdkcGRtVWdkR2hwY3lCdFlYa2dhR0YyWlNCaElHQndiMjlzVTJsNlpXQWdjSEp2Y0dWeWRIa3NJR0Z1WkNCM2FXeHNJR3h2YjJzZ1ptOXlJR0ZjYmlBcUlIQnliM1J2ZEhsd2FXTmhiQ0JnWkdWemRISjFZM1J2Y21BZ2IyNGdhVzV6ZEdGdVkyVnpMbHh1SUNwY2JpQXFJRUJ3WVhKaGJTQjdSblZ1WTNScGIyNTlJRU52Y0hsRGIyNXpkSEoxWTNSdmNpQkRiMjV6ZEhKMVkzUnZjaUIwYUdGMElHTmhiaUJpWlNCMWMyVmtJSFJ2SUhKbGMyVjBMbHh1SUNvZ1FIQmhjbUZ0SUh0R2RXNWpkR2x2Ym4wZ2NHOXZiR1Z5SUVOMWMzUnZiV2w2WVdKc1pTQndiMjlzWlhJdVhHNGdLaTljYm5aaGNpQmhaR1JRYjI5c2FXNW5WRzhnUFNCbWRXNWpkR2x2YmlBb1EyOXdlVU52Ym5OMGNuVmpkRzl5TENCd2IyOXNaWElwSUh0Y2JpQWdMeThnUTJGemRHbHVaeUJoY3lCaGJua2djMjhnZEdoaGRDQm1iRzkzSUdsbmJtOXlaWE1nZEdobElHRmpkSFZoYkNCcGJYQnNaVzFsYm5SaGRHbHZiaUJoYm1RZ2RISjFjM1J6WEc0Z0lDOHZJR2wwSUhSdklHMWhkR05vSUhSb1pTQjBlWEJsSUhkbElHUmxZMnhoY21Wa1hHNGdJSFpoY2lCT1pYZExiR0Z6Y3lBOUlFTnZjSGxEYjI1emRISjFZM1J2Y2p0Y2JpQWdUbVYzUzJ4aGMzTXVhVzV6ZEdGdVkyVlFiMjlzSUQwZ1cxMDdYRzRnSUU1bGQwdHNZWE56TG1kbGRGQnZiMnhsWkNBOUlIQnZiMnhsY2lCOGZDQkVSVVpCVlV4VVgxQlBUMHhGVWp0Y2JpQWdhV1lnS0NGT1pYZExiR0Z6Y3k1d2IyOXNVMmw2WlNrZ2UxeHVJQ0FnSUU1bGQwdHNZWE56TG5CdmIyeFRhWHBsSUQwZ1JFVkdRVlZNVkY5UVQwOU1YMU5KV2tVN1hHNGdJSDFjYmlBZ1RtVjNTMnhoYzNNdWNtVnNaV0Z6WlNBOUlITjBZVzVrWVhKa1VtVnNaV0Z6WlhJN1hHNGdJSEpsZEhWeWJpQk9aWGRMYkdGemN6dGNibjA3WEc1Y2JuWmhjaUJRYjI5c1pXUkRiR0Z6Y3lBOUlIdGNiaUFnWVdSa1VHOXZiR2x1WjFSdk9pQmhaR1JRYjI5c2FXNW5WRzhzWEc0Z0lHOXVaVUZ5WjNWdFpXNTBVRzl2YkdWeU9pQnZibVZCY21kMWJXVnVkRkJ2YjJ4bGNpeGNiaUFnZEhkdlFYSm5kVzFsYm5SUWIyOXNaWEk2SUhSM2IwRnlaM1Z0Wlc1MFVHOXZiR1Z5TEZ4dUlDQjBhSEpsWlVGeVozVnRaVzUwVUc5dmJHVnlPaUIwYUhKbFpVRnlaM1Z0Wlc1MFVHOXZiR1Z5TEZ4dUlDQm1iM1Z5UVhKbmRXMWxiblJRYjI5c1pYSTZJR1p2ZFhKQmNtZDFiV1Z1ZEZCdmIyeGxjbHh1ZlR0Y2JseHViVzlrZFd4bExtVjRjRzl5ZEhNZ1BTQlFiMjlzWldSRGJHRnpjenNpTENJdktpcGNiaUFxSUVOdmNIbHlhV2RvZENBeU1ERXpMWEJ5WlhObGJuUXNJRVpoWTJWaWIyOXJMQ0JKYm1NdVhHNGdLaUJCYkd3Z2NtbG5hSFJ6SUhKbGMyVnlkbVZrTGx4dUlDcGNiaUFxSUZSb2FYTWdjMjkxY21ObElHTnZaR1VnYVhNZ2JHbGpaVzV6WldRZ2RXNWtaWElnZEdobElFSlRSQzF6ZEhsc1pTQnNhV05sYm5ObElHWnZkVzVrSUdsdUlIUm9aVnh1SUNvZ1RFbERSVTVUUlNCbWFXeGxJR2x1SUhSb1pTQnliMjkwSUdScGNtVmpkRzl5ZVNCdlppQjBhR2x6SUhOdmRYSmpaU0IwY21WbExpQkJiaUJoWkdScGRHbHZibUZzSUdkeVlXNTBYRzRnS2lCdlppQndZWFJsYm5RZ2NtbG5hSFJ6SUdOaGJpQmlaU0JtYjNWdVpDQnBiaUIwYUdVZ1VFRlVSVTVVVXlCbWFXeGxJR2x1SUhSb1pTQnpZVzFsSUdScGNtVmpkRzl5ZVM1Y2JpQXFYRzRnS2k5Y2JseHVKM1Z6WlNCemRISnBZM1FuTzF4dVhHNTJZWElnWDJGemMybG5iaUE5SUhKbGNYVnBjbVVvSjI5aWFtVmpkQzFoYzNOcFoyNG5LVHRjYmx4dWRtRnlJRkpsWVdOMFFtRnpaVU5zWVhOelpYTWdQU0J5WlhGMWFYSmxLQ2N1TDFKbFlXTjBRbUZ6WlVOc1lYTnpaWE1uS1R0Y2JuWmhjaUJTWldGamRFTm9hV3hrY21WdUlEMGdjbVZ4ZFdseVpTZ25MaTlTWldGamRFTm9hV3hrY21WdUp5azdYRzUyWVhJZ1VtVmhZM1JFVDAxR1lXTjBiM0pwWlhNZ1BTQnlaWEYxYVhKbEtDY3VMMUpsWVdOMFJFOU5SbUZqZEc5eWFXVnpKeWs3WEc1MllYSWdVbVZoWTNSRmJHVnRaVzUwSUQwZ2NtVnhkV2x5WlNnbkxpOVNaV0ZqZEVWc1pXMWxiblFuS1R0Y2JuWmhjaUJTWldGamRGQnliM0JVZVhCbGN5QTlJSEpsY1hWcGNtVW9KeTR2VW1WaFkzUlFjbTl3Vkhsd1pYTW5LVHRjYm5aaGNpQlNaV0ZqZEZabGNuTnBiMjRnUFNCeVpYRjFhWEpsS0NjdUwxSmxZV04wVm1WeWMybHZiaWNwTzF4dVhHNTJZWElnWTNKbFlYUmxVbVZoWTNSRGJHRnpjeUE5SUhKbGNYVnBjbVVvSnk0dlkzSmxZWFJsUTJ4aGMzTW5LVHRjYm5aaGNpQnZibXg1UTJocGJHUWdQU0J5WlhGMWFYSmxLQ2N1TDI5dWJIbERhR2xzWkNjcE8xeHVYRzUyWVhJZ1kzSmxZWFJsUld4bGJXVnVkQ0E5SUZKbFlXTjBSV3hsYldWdWRDNWpjbVZoZEdWRmJHVnRaVzUwTzF4dWRtRnlJR055WldGMFpVWmhZM1J2Y25rZ1BTQlNaV0ZqZEVWc1pXMWxiblF1WTNKbFlYUmxSbUZqZEc5eWVUdGNiblpoY2lCamJHOXVaVVZzWlcxbGJuUWdQU0JTWldGamRFVnNaVzFsYm5RdVkyeHZibVZGYkdWdFpXNTBPMXh1WEc1cFppQW9jSEp2WTJWemN5NWxibll1VGs5RVJWOUZUbFlnSVQwOUlDZHdjbTlrZFdOMGFXOXVKeWtnZTF4dUlDQjJZWElnYkc5M1VISnBiM0pwZEhsWFlYSnVhVzVuSUQwZ2NtVnhkV2x5WlNnbkxpOXNiM2RRY21sdmNtbDBlVmRoY201cGJtY25LVHRjYmlBZ2RtRnlJR05oYmtSbFptbHVaVkJ5YjNCbGNuUjVJRDBnY21WeGRXbHlaU2duTGk5allXNUVaV1pwYm1WUWNtOXdaWEowZVNjcE8xeHVJQ0IyWVhJZ1VtVmhZM1JGYkdWdFpXNTBWbUZzYVdSaGRHOXlJRDBnY21WeGRXbHlaU2duTGk5U1pXRmpkRVZzWlcxbGJuUldZV3hwWkdGMGIzSW5LVHRjYmlBZ2RtRnlJR1JwWkZkaGNtNVFjbTl3Vkhsd1pYTkVaWEJ5WldOaGRHVmtJRDBnWm1Gc2MyVTdYRzRnSUdOeVpXRjBaVVZzWlcxbGJuUWdQU0JTWldGamRFVnNaVzFsYm5SV1lXeHBaR0YwYjNJdVkzSmxZWFJsUld4bGJXVnVkRHRjYmlBZ1kzSmxZWFJsUm1GamRHOXllU0E5SUZKbFlXTjBSV3hsYldWdWRGWmhiR2xrWVhSdmNpNWpjbVZoZEdWR1lXTjBiM0o1TzF4dUlDQmpiRzl1WlVWc1pXMWxiblFnUFNCU1pXRmpkRVZzWlcxbGJuUldZV3hwWkdGMGIzSXVZMnh2Ym1WRmJHVnRaVzUwTzF4dWZWeHVYRzUyWVhJZ1gxOXpjSEpsWVdRZ1BTQmZZWE56YVdkdU8xeHVkbUZ5SUdOeVpXRjBaVTFwZUdsdUlEMGdablZ1WTNScGIyNGdLRzFwZUdsdUtTQjdYRzRnSUhKbGRIVnliaUJ0YVhocGJqdGNibjA3WEc1Y2JtbG1JQ2h3Y205alpYTnpMbVZ1ZGk1T1QwUkZYMFZPVmlBaFBUMGdKM0J5YjJSMVkzUnBiMjRuS1NCN1hHNGdJSFpoY2lCM1lYSnVaV1JHYjNKVGNISmxZV1FnUFNCbVlXeHpaVHRjYmlBZ2RtRnlJSGRoY201bFpFWnZja055WldGMFpVMXBlR2x1SUQwZ1ptRnNjMlU3WEc0Z0lGOWZjM0J5WldGa0lEMGdablZ1WTNScGIyNGdLQ2tnZTF4dUlDQWdJR3h2ZDFCeWFXOXlhWFI1VjJGeWJtbHVaeWgzWVhKdVpXUkdiM0pUY0hKbFlXUXNJQ2RTWldGamRDNWZYM053Y21WaFpDQnBjeUJrWlhCeVpXTmhkR1ZrSUdGdVpDQnphRzkxYkdRZ2JtOTBJR0psSUhWelpXUXVJRlZ6WlNBbklDc2dKMDlpYW1WamRDNWhjM05wWjI0Z1pHbHlaV04wYkhrZ2IzSWdZVzV2ZEdobGNpQm9aV3h3WlhJZ1puVnVZM1JwYjI0Z2QybDBhQ0J6YVcxcGJHRnlJQ2NnS3lBbmMyVnRZVzUwYVdOekxpQlpiM1VnYldGNUlHSmxJSE5sWldsdVp5QjBhR2x6SUhkaGNtNXBibWNnWkhWbElIUnZJSGx2ZFhJZ1kyOXRjR2xzWlhJdUlDY2dLeUFuVTJWbElHaDBkSEJ6T2k4dlptSXViV1V2Y21WaFkzUXRjM0J5WldGa0xXUmxjSEpsWTJGMGFXOXVJR1p2Y2lCdGIzSmxJR1JsZEdGcGJITXVKeWs3WEc0Z0lDQWdkMkZ5Ym1Wa1JtOXlVM0J5WldGa0lEMGdkSEoxWlR0Y2JpQWdJQ0J5WlhSMWNtNGdYMkZ6YzJsbmJpNWhjSEJzZVNodWRXeHNMQ0JoY21kMWJXVnVkSE1wTzF4dUlDQjlPMXh1WEc0Z0lHTnlaV0YwWlUxcGVHbHVJRDBnWm5WdVkzUnBiMjRnS0cxcGVHbHVLU0I3WEc0Z0lDQWdiRzkzVUhKcGIzSnBkSGxYWVhKdWFXNW5LSGRoY201bFpFWnZja055WldGMFpVMXBlR2x1TENBblVtVmhZM1F1WTNKbFlYUmxUV2w0YVc0Z2FYTWdaR1Z3Y21WallYUmxaQ0JoYm1RZ2MyaHZkV3hrSUc1dmRDQmlaU0IxYzJWa0xpQW5JQ3NnSjBsdUlGSmxZV04wSUhZeE5pNHdMQ0JwZENCM2FXeHNJR0psSUhKbGJXOTJaV1F1SUNjZ0t5QW5XVzkxSUdOaGJpQjFjMlVnZEdocGN5QnRhWGhwYmlCa2FYSmxZM1JzZVNCcGJuTjBaV0ZrTGlBbklDc2dKMU5sWlNCb2RIUndjem92TDJaaUxtMWxMMk55WldGMFpXMXBlR2x1TFhkaGN5MXVaWFpsY2kxcGJYQnNaVzFsYm5SbFpDQm1iM0lnYlc5eVpTQnBibVp2TGljcE8xeHVJQ0FnSUhkaGNtNWxaRVp2Y2tOeVpXRjBaVTFwZUdsdUlEMGdkSEoxWlR0Y2JpQWdJQ0J5WlhSMWNtNGdiV2w0YVc0N1hHNGdJSDA3WEc1OVhHNWNiblpoY2lCU1pXRmpkQ0E5SUh0Y2JpQWdMeThnVFc5a1pYSnVYRzVjYmlBZ1EyaHBiR1J5Wlc0NklIdGNiaUFnSUNCdFlYQTZJRkpsWVdOMFEyaHBiR1J5Wlc0dWJXRndMRnh1SUNBZ0lHWnZja1ZoWTJnNklGSmxZV04wUTJocGJHUnlaVzR1Wm05eVJXRmphQ3hjYmlBZ0lDQmpiM1Z1ZERvZ1VtVmhZM1JEYUdsc1pISmxiaTVqYjNWdWRDeGNiaUFnSUNCMGIwRnljbUY1T2lCU1pXRmpkRU5vYVd4a2NtVnVMblJ2UVhKeVlYa3NYRzRnSUNBZ2IyNXNlVG9nYjI1c2VVTm9hV3hrWEc0Z0lIMHNYRzVjYmlBZ1EyOXRjRzl1Wlc1ME9pQlNaV0ZqZEVKaGMyVkRiR0Z6YzJWekxrTnZiWEJ2Ym1WdWRDeGNiaUFnVUhWeVpVTnZiWEJ2Ym1WdWREb2dVbVZoWTNSQ1lYTmxRMnhoYzNObGN5NVFkWEpsUTI5dGNHOXVaVzUwTEZ4dVhHNGdJR055WldGMFpVVnNaVzFsYm5RNklHTnlaV0YwWlVWc1pXMWxiblFzWEc0Z0lHTnNiMjVsUld4bGJXVnVkRG9nWTJ4dmJtVkZiR1Z0Wlc1MExGeHVJQ0JwYzFaaGJHbGtSV3hsYldWdWREb2dVbVZoWTNSRmJHVnRaVzUwTG1selZtRnNhV1JGYkdWdFpXNTBMRnh1WEc0Z0lDOHZJRU5zWVhOemFXTmNibHh1SUNCUWNtOXdWSGx3WlhNNklGSmxZV04wVUhKdmNGUjVjR1Z6TEZ4dUlDQmpjbVZoZEdWRGJHRnpjem9nWTNKbFlYUmxVbVZoWTNSRGJHRnpjeXhjYmlBZ1kzSmxZWFJsUm1GamRHOXllVG9nWTNKbFlYUmxSbUZqZEc5eWVTeGNiaUFnWTNKbFlYUmxUV2w0YVc0NklHTnlaV0YwWlUxcGVHbHVMRnh1WEc0Z0lDOHZJRlJvYVhNZ2JHOXZhM01nUkU5TklITndaV05wWm1saklHSjFkQ0IwYUdWelpTQmhjbVVnWVdOMGRXRnNiSGtnYVhOdmJXOXljR2hwWXlCb1pXeHdaWEp6WEc0Z0lDOHZJSE5wYm1ObElIUm9aWGtnWVhKbElHcDFjM1FnWjJWdVpYSmhkR2x1WnlCRVQwMGdjM1J5YVc1bmN5NWNiaUFnUkU5Tk9pQlNaV0ZqZEVSUFRVWmhZM1J2Y21sbGN5eGNibHh1SUNCMlpYSnphVzl1T2lCU1pXRmpkRlpsY25OcGIyNHNYRzVjYmlBZ0x5OGdSR1Z3Y21WallYUmxaQ0JvYjI5cklHWnZjaUJLVTFnZ2MzQnlaV0ZrTENCa2IyNG5kQ0IxYzJVZ2RHaHBjeUJtYjNJZ1lXNTVkR2hwYm1jdVhHNGdJRjlmYzNCeVpXRmtPaUJmWDNOd2NtVmhaRnh1ZlR0Y2JseHVhV1lnS0hCeWIyTmxjM011Wlc1MkxrNVBSRVZmUlU1V0lDRTlQU0FuY0hKdlpIVmpkR2x2YmljcElIdGNiaUFnZG1GeUlIZGhjbTVsWkVadmNrTnlaV0YwWlVOc1lYTnpJRDBnWm1Gc2MyVTdYRzRnSUdsbUlDaGpZVzVFWldacGJtVlFjbTl3WlhKMGVTa2dlMXh1SUNBZ0lFOWlhbVZqZEM1a1pXWnBibVZRY205d1pYSjBlU2hTWldGamRDd2dKMUJ5YjNCVWVYQmxjeWNzSUh0Y2JpQWdJQ0FnSUdkbGREb2dablZ1WTNScGIyNGdLQ2tnZTF4dUlDQWdJQ0FnSUNCc2IzZFFjbWx2Y21sMGVWZGhjbTVwYm1jb1pHbGtWMkZ5YmxCeWIzQlVlWEJsYzBSbGNISmxZMkYwWldRc0lDZEJZMk5sYzNOcGJtY2dVSEp2Y0ZSNWNHVnpJSFpwWVNCMGFHVWdiV0ZwYmlCU1pXRmpkQ0J3WVdOcllXZGxJR2x6SUdSbGNISmxZMkYwWldRc0p5QXJJQ2NnWVc1a0lIZHBiR3dnWW1VZ2NtVnRiM1psWkNCcGJpQWdVbVZoWTNRZ2RqRTJMakF1SnlBcklDY2dWWE5sSUhSb1pTQnNZWFJsYzNRZ1lYWmhhV3hoWW14bElIWXhOUzRxSUhCeWIzQXRkSGx3WlhNZ2NHRmphMkZuWlNCbWNtOXRJRzV3YlNCcGJuTjBaV0ZrTGljZ0t5QW5JRVp2Y2lCcGJtWnZJRzl1SUhWellXZGxMQ0JqYjIxd1lYUnBZbWxzYVhSNUxDQnRhV2R5WVhScGIyNGdZVzVrSUcxdmNtVXNJSE5sWlNBbklDc2dKMmgwZEhCek9pOHZabUl1YldVdmNISnZjQzEwZVhCbGN5MWtiMk56SnlrN1hHNGdJQ0FnSUNBZ0lHUnBaRmRoY201UWNtOXdWSGx3WlhORVpYQnlaV05oZEdWa0lEMGdkSEoxWlR0Y2JpQWdJQ0FnSUNBZ2NtVjBkWEp1SUZKbFlXTjBVSEp2Y0ZSNWNHVnpPMXh1SUNBZ0lDQWdmVnh1SUNBZ0lIMHBPMXh1WEc0Z0lDQWdUMkpxWldOMExtUmxabWx1WlZCeWIzQmxjblI1S0ZKbFlXTjBMQ0FuWTNKbFlYUmxRMnhoYzNNbkxDQjdYRzRnSUNBZ0lDQm5aWFE2SUdaMWJtTjBhVzl1SUNncElIdGNiaUFnSUNBZ0lDQWdiRzkzVUhKcGIzSnBkSGxYWVhKdWFXNW5LSGRoY201bFpFWnZja055WldGMFpVTnNZWE56TENBblFXTmpaWE56YVc1bklHTnlaV0YwWlVOc1lYTnpJSFpwWVNCMGFHVWdiV0ZwYmlCU1pXRmpkQ0J3WVdOcllXZGxJR2x6SUdSbGNISmxZMkYwWldRc0p5QXJJQ2NnWVc1a0lIZHBiR3dnWW1VZ2NtVnRiM1psWkNCcGJpQlNaV0ZqZENCMk1UWXVNQzRuSUNzZ1hDSWdWWE5sSUdFZ2NHeGhhVzRnU21GMllWTmpjbWx3ZENCamJHRnpjeUJwYm5OMFpXRmtMaUJKWmlCNWIzVW5jbVVnYm05MElIbGxkQ0JjSWlBcklDZHlaV0ZrZVNCMGJ5QnRhV2R5WVhSbExDQmpjbVZoZEdVdGNtVmhZM1F0WTJ4aGMzTWdkakUxTGlvZ2FYTWdZWFpoYVd4aFlteGxJQ2NnS3lBbmIyNGdibkJ0SUdGeklHRWdkR1Z0Y0c5eVlYSjVMQ0JrY205d0xXbHVJSEpsY0d4aFkyVnRaVzUwTGlBbklDc2dKMFp2Y2lCdGIzSmxJR2x1Wm04Z2MyVmxJR2gwZEhCek9pOHZabUl1YldVdmNtVmhZM1F0WTNKbFlYUmxMV05zWVhOekp5azdYRzRnSUNBZ0lDQWdJSGRoY201bFpFWnZja055WldGMFpVTnNZWE56SUQwZ2RISjFaVHRjYmlBZ0lDQWdJQ0FnY21WMGRYSnVJR055WldGMFpWSmxZV04wUTJ4aGMzTTdYRzRnSUNBZ0lDQjlYRzRnSUNBZ2ZTazdYRzRnSUgxY2JseHVJQ0F2THlCU1pXRmpkQzVFVDAwZ1ptRmpkRzl5YVdWeklHRnlaU0JrWlhCeVpXTmhkR1ZrTGlCWGNtRndJSFJvWlhObElHMWxkR2h2WkhNZ2MyOGdkR2hoZEZ4dUlDQXZMeUJwYm5adlkyRjBhVzl1Y3lCdlppQjBhR1VnVW1WaFkzUXVSRTlOSUc1aGJXVnpjR0ZqWlNCaGJtUWdZV3hsY25RZ2RYTmxjbk1nZEc4Z2MzZHBkR05vWEc0Z0lDOHZJSFJ2SUhSb1pTQmdjbVZoWTNRdFpHOXRMV1poWTNSdmNtbGxjMkFnY0dGamEyRm5aUzVjYmlBZ1VtVmhZM1F1UkU5TklEMGdlMzA3WEc0Z0lIWmhjaUIzWVhKdVpXUkdiM0pHWVdOMGIzSnBaWE1nUFNCbVlXeHpaVHRjYmlBZ1QySnFaV04wTG10bGVYTW9VbVZoWTNSRVQwMUdZV04wYjNKcFpYTXBMbVp2Y2tWaFkyZ29ablZ1WTNScGIyNGdLR1poWTNSdmNua3BJSHRjYmlBZ0lDQlNaV0ZqZEM1RVQwMWJabUZqZEc5eWVWMGdQU0JtZFc1amRHbHZiaUFvS1NCN1hHNGdJQ0FnSUNCcFppQW9JWGRoY201bFpFWnZja1poWTNSdmNtbGxjeWtnZTF4dUlDQWdJQ0FnSUNCc2IzZFFjbWx2Y21sMGVWZGhjbTVwYm1jb1ptRnNjMlVzSUNkQlkyTmxjM05wYm1jZ1ptRmpkRzl5YVdWeklHeHBhMlVnVW1WaFkzUXVSRTlOTGlWeklHaGhjeUJpWldWdUlHUmxjSEpsWTJGMFpXUWdKeUFySUNkaGJtUWdkMmxzYkNCaVpTQnlaVzF2ZG1Wa0lHbHVJSFl4Tmk0d0t5NGdWWE5sSUhSb1pTQW5JQ3NnSjNKbFlXTjBMV1J2YlMxbVlXTjBiM0pwWlhNZ2NHRmphMkZuWlNCcGJuTjBaV0ZrTGlBbklDc2dKeUJXWlhKemFXOXVJREV1TUNCd2NtOTJhV1JsY3lCaElHUnliM0F0YVc0Z2NtVndiR0ZqWlcxbGJuUXVKeUFySUNjZ1JtOXlJRzF2Y21VZ2FXNW1ieXdnYzJWbElHaDBkSEJ6T2k4dlptSXViV1V2Y21WaFkzUXRaRzl0TFdaaFkzUnZjbWxsY3ljc0lHWmhZM1J2Y25rcE8xeHVJQ0FnSUNBZ0lDQjNZWEp1WldSR2IzSkdZV04wYjNKcFpYTWdQU0IwY25WbE8xeHVJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ2NtVjBkWEp1SUZKbFlXTjBSRTlOUm1GamRHOXlhV1Z6VzJaaFkzUnZjbmxkTG1Gd2NHeDVLRkpsWVdOMFJFOU5SbUZqZEc5eWFXVnpMQ0JoY21kMWJXVnVkSE1wTzF4dUlDQWdJSDA3WEc0Z0lIMHBPMXh1ZlZ4dVhHNXRiMlIxYkdVdVpYaHdiM0owY3lBOUlGSmxZV04wT3lJc0lpOHFLbHh1SUNvZ1EyOXdlWEpwWjJoMElESXdNVE10Y0hKbGMyVnVkQ3dnUm1GalpXSnZiMnNzSUVsdVl5NWNiaUFxSUVGc2JDQnlhV2RvZEhNZ2NtVnpaWEoyWldRdVhHNGdLbHh1SUNvZ1ZHaHBjeUJ6YjNWeVkyVWdZMjlrWlNCcGN5QnNhV05sYm5ObFpDQjFibVJsY2lCMGFHVWdRbE5FTFhOMGVXeGxJR3hwWTJWdWMyVWdabTkxYm1RZ2FXNGdkR2hsWEc0Z0tpQk1TVU5GVGxORklHWnBiR1VnYVc0Z2RHaGxJSEp2YjNRZ1pHbHlaV04wYjNKNUlHOW1JSFJvYVhNZ2MyOTFjbU5sSUhSeVpXVXVJRUZ1SUdGa1pHbDBhVzl1WVd3Z1ozSmhiblJjYmlBcUlHOW1JSEJoZEdWdWRDQnlhV2RvZEhNZ1kyRnVJR0psSUdadmRXNWtJR2x1SUhSb1pTQlFRVlJGVGxSVElHWnBiR1VnYVc0Z2RHaGxJSE5oYldVZ1pHbHlaV04wYjNKNUxseHVJQ3BjYmlBcUwxeHVYRzRuZFhObElITjBjbWxqZENjN1hHNWNiblpoY2lCZmNISnZaRWx1ZG1GeWFXRnVkQ0E5SUhKbGNYVnBjbVVvSnk0dmNtVmhZM1JRY205a1NXNTJZWEpwWVc1MEp5a3NYRzRnSUNBZ1gyRnpjMmxuYmlBOUlISmxjWFZwY21Vb0oyOWlhbVZqZEMxaGMzTnBaMjRuS1R0Y2JseHVkbUZ5SUZKbFlXTjBUbTl2Y0ZWd1pHRjBaVkYxWlhWbElEMGdjbVZ4ZFdseVpTZ25MaTlTWldGamRFNXZiM0JWY0dSaGRHVlJkV1YxWlNjcE8xeHVYRzUyWVhJZ1kyRnVSR1ZtYVc1bFVISnZjR1Z5ZEhrZ1BTQnlaWEYxYVhKbEtDY3VMMk5oYmtSbFptbHVaVkJ5YjNCbGNuUjVKeWs3WEc1MllYSWdaVzF3ZEhsUFltcGxZM1FnUFNCeVpYRjFhWEpsS0NkbVltcHpMMnhwWWk5bGJYQjBlVTlpYW1WamRDY3BPMXh1ZG1GeUlHbHVkbUZ5YVdGdWRDQTlJSEpsY1hWcGNtVW9KMlppYW5NdmJHbGlMMmx1ZG1GeWFXRnVkQ2NwTzF4dWRtRnlJR3h2ZDFCeWFXOXlhWFI1VjJGeWJtbHVaeUE5SUhKbGNYVnBjbVVvSnk0dmJHOTNVSEpwYjNKcGRIbFhZWEp1YVc1bkp5azdYRzVjYmk4cUtseHVJQ29nUW1GelpTQmpiR0Z6Y3lCb1pXeHdaWEp6SUdadmNpQjBhR1VnZFhCa1lYUnBibWNnYzNSaGRHVWdiMllnWVNCamIyMXdiMjVsYm5RdVhHNGdLaTljYm1aMWJtTjBhVzl1SUZKbFlXTjBRMjl0Y0c5dVpXNTBLSEJ5YjNCekxDQmpiMjUwWlhoMExDQjFjR1JoZEdWeUtTQjdYRzRnSUhSb2FYTXVjSEp2Y0hNZ1BTQndjbTl3Y3p0Y2JpQWdkR2hwY3k1amIyNTBaWGgwSUQwZ1kyOXVkR1Y0ZER0Y2JpQWdkR2hwY3k1eVpXWnpJRDBnWlcxd2RIbFBZbXBsWTNRN1hHNGdJQzh2SUZkbElHbHVhWFJwWVd4cGVtVWdkR2hsSUdSbFptRjFiSFFnZFhCa1lYUmxjaUJpZFhRZ2RHaGxJSEpsWVd3Z2IyNWxJR2RsZEhNZ2FXNXFaV04wWldRZ1lua2dkR2hsWEc0Z0lDOHZJSEpsYm1SbGNtVnlMbHh1SUNCMGFHbHpMblZ3WkdGMFpYSWdQU0IxY0dSaGRHVnlJSHg4SUZKbFlXTjBUbTl2Y0ZWd1pHRjBaVkYxWlhWbE8xeHVmVnh1WEc1U1pXRmpkRU52YlhCdmJtVnVkQzV3Y205MGIzUjVjR1V1YVhOU1pXRmpkRU52YlhCdmJtVnVkQ0E5SUh0OU8xeHVYRzR2S2lwY2JpQXFJRk5sZEhNZ1lTQnpkV0p6WlhRZ2IyWWdkR2hsSUhOMFlYUmxMaUJCYkhkaGVYTWdkWE5sSUhSb2FYTWdkRzhnYlhWMFlYUmxYRzRnS2lCemRHRjBaUzRnV1c5MUlITm9iM1ZzWkNCMGNtVmhkQ0JnZEdocGN5NXpkR0YwWldBZ1lYTWdhVzF0ZFhSaFlteGxMbHh1SUNwY2JpQXFJRlJvWlhKbElHbHpJRzV2SUdkMVlYSmhiblJsWlNCMGFHRjBJR0IwYUdsekxuTjBZWFJsWUNCM2FXeHNJR0psSUdsdGJXVmthV0YwWld4NUlIVndaR0YwWldRc0lITnZYRzRnS2lCaFkyTmxjM05wYm1jZ1lIUm9hWE11YzNSaGRHVmdJR0ZtZEdWeUlHTmhiR3hwYm1jZ2RHaHBjeUJ0WlhSb2IyUWdiV0Y1SUhKbGRIVnliaUIwYUdVZ2IyeGtJSFpoYkhWbExseHVJQ3BjYmlBcUlGUm9aWEpsSUdseklHNXZJR2QxWVhKaGJuUmxaU0IwYUdGMElHTmhiR3h6SUhSdklHQnpaWFJUZEdGMFpXQWdkMmxzYkNCeWRXNGdjM2x1WTJoeWIyNXZkWE5zZVN4Y2JpQXFJR0Z6SUhSb1pYa2diV0Y1SUdWMlpXNTBkV0ZzYkhrZ1ltVWdZbUYwWTJobFpDQjBiMmRsZEdobGNpNGdJRmx2ZFNCallXNGdjSEp2ZG1sa1pTQmhiaUJ2Y0hScGIyNWhiRnh1SUNvZ1kyRnNiR0poWTJzZ2RHaGhkQ0IzYVd4c0lHSmxJR1Y0WldOMWRHVmtJSGRvWlc0Z2RHaGxJR05oYkd3Z2RHOGdjMlYwVTNSaGRHVWdhWE1nWVdOMGRXRnNiSGxjYmlBcUlHTnZiWEJzWlhSbFpDNWNiaUFxWEc0Z0tpQlhhR1Z1SUdFZ1puVnVZM1JwYjI0Z2FYTWdjSEp2ZG1sa1pXUWdkRzhnYzJWMFUzUmhkR1VzSUdsMElIZHBiR3dnWW1VZ1kyRnNiR1ZrSUdGMElITnZiV1VnY0c5cGJuUWdhVzVjYmlBcUlIUm9aU0JtZFhSMWNtVWdLRzV2ZENCemVXNWphSEp2Ym05MWMyeDVLUzRnU1hRZ2QybHNiQ0JpWlNCallXeHNaV1FnZDJsMGFDQjBhR1VnZFhBZ2RHOGdaR0YwWlZ4dUlDb2dZMjl0Y0c5dVpXNTBJR0Z5WjNWdFpXNTBjeUFvYzNSaGRHVXNJSEJ5YjNCekxDQmpiMjUwWlhoMEtTNGdWR2hsYzJVZ2RtRnNkV1Z6SUdOaGJpQmlaU0JrYVdabVpYSmxiblJjYmlBcUlHWnliMjBnZEdocGN5NHFJR0psWTJGMWMyVWdlVzkxY2lCbWRXNWpkR2x2YmlCdFlYa2dZbVVnWTJGc2JHVmtJR0ZtZEdWeUlISmxZMlZwZG1WUWNtOXdjeUJpZFhRZ1ltVm1iM0psWEc0Z0tpQnphRzkxYkdSRGIyMXdiMjVsYm5SVmNHUmhkR1VzSUdGdVpDQjBhR2x6SUc1bGR5QnpkR0YwWlN3Z2NISnZjSE1zSUdGdVpDQmpiMjUwWlhoMElIZHBiR3dnYm05MElIbGxkQ0JpWlZ4dUlDb2dZWE56YVdkdVpXUWdkRzhnZEdocGN5NWNiaUFxWEc0Z0tpQkFjR0Z5WVcwZ2UyOWlhbVZqZEh4bWRXNWpkR2x2Ym4wZ2NHRnlkR2xoYkZOMFlYUmxJRTVsZUhRZ2NHRnlkR2xoYkNCemRHRjBaU0J2Y2lCbWRXNWpkR2x2YmlCMGIxeHVJQ29nSUNBZ0lDQWdJSEJ5YjJSMVkyVWdibVY0ZENCd1lYSjBhV0ZzSUhOMFlYUmxJSFJ2SUdKbElHMWxjbWRsWkNCM2FYUm9JR04xY25KbGJuUWdjM1JoZEdVdVhHNGdLaUJBY0dGeVlXMGdlejltZFc1amRHbHZibjBnWTJGc2JHSmhZMnNnUTJGc2JHVmtJR0ZtZEdWeUlITjBZWFJsSUdseklIVndaR0YwWldRdVhHNGdLaUJBWm1sdVlXeGNiaUFxSUVCd2NtOTBaV04wWldSY2JpQXFMMXh1VW1WaFkzUkRiMjF3YjI1bGJuUXVjSEp2ZEc5MGVYQmxMbk5sZEZOMFlYUmxJRDBnWm5WdVkzUnBiMjRnS0hCaGNuUnBZV3hUZEdGMFpTd2dZMkZzYkdKaFkyc3BJSHRjYmlBZ0lTaDBlWEJsYjJZZ2NHRnlkR2xoYkZOMFlYUmxJRDA5UFNBbmIySnFaV04wSnlCOGZDQjBlWEJsYjJZZ2NHRnlkR2xoYkZOMFlYUmxJRDA5UFNBblpuVnVZM1JwYjI0bklIeDhJSEJoY25ScFlXeFRkR0YwWlNBOVBTQnVkV3hzS1NBL0lIQnliMk5sYzNNdVpXNTJMazVQUkVWZlJVNVdJQ0U5UFNBbmNISnZaSFZqZEdsdmJpY2dQeUJwYm5aaGNtbGhiblFvWm1Gc2MyVXNJQ2R6WlhSVGRHRjBaU2d1TGk0cE9pQjBZV3RsY3lCaGJpQnZZbXBsWTNRZ2IyWWdjM1JoZEdVZ2RtRnlhV0ZpYkdWeklIUnZJSFZ3WkdGMFpTQnZjaUJoSUdaMWJtTjBhVzl1SUhkb2FXTm9JSEpsZEhWeWJuTWdZVzRnYjJKcVpXTjBJRzltSUhOMFlYUmxJSFpoY21saFlteGxjeTRuS1NBNklGOXdjbTlrU1c1MllYSnBZVzUwS0NjNE5TY3BJRG9nZG05cFpDQXdPMXh1SUNCMGFHbHpMblZ3WkdGMFpYSXVaVzV4ZFdWMVpWTmxkRk4wWVhSbEtIUm9hWE1zSUhCaGNuUnBZV3hUZEdGMFpTazdYRzRnSUdsbUlDaGpZV3hzWW1GamF5a2dlMXh1SUNBZ0lIUm9hWE11ZFhCa1lYUmxjaTVsYm5GMVpYVmxRMkZzYkdKaFkyc29kR2hwY3l3Z1kyRnNiR0poWTJzc0lDZHpaWFJUZEdGMFpTY3BPMXh1SUNCOVhHNTlPMXh1WEc0dktpcGNiaUFxSUVadmNtTmxjeUJoYmlCMWNHUmhkR1V1SUZSb2FYTWdjMmh2ZFd4a0lHOXViSGtnWW1VZ2FXNTJiMnRsWkNCM2FHVnVJR2wwSUdseklHdHViM2R1SUhkcGRHaGNiaUFxSUdObGNuUmhhVzUwZVNCMGFHRjBJSGRsSUdGeVpTQXFLbTV2ZENvcUlHbHVJR0VnUkU5TklIUnlZVzV6WVdOMGFXOXVMbHh1SUNwY2JpQXFJRmx2ZFNCdFlYa2dkMkZ1ZENCMGJ5QmpZV3hzSUhSb2FYTWdkMmhsYmlCNWIzVWdhMjV2ZHlCMGFHRjBJSE52YldVZ1pHVmxjR1Z5SUdGemNHVmpkQ0J2WmlCMGFHVmNiaUFxSUdOdmJYQnZibVZ1ZENkeklITjBZWFJsSUdoaGN5QmphR0Z1WjJWa0lHSjFkQ0JnYzJWMFUzUmhkR1ZnSUhkaGN5QnViM1FnWTJGc2JHVmtMbHh1SUNwY2JpQXFJRlJvYVhNZ2QybHNiQ0J1YjNRZ2FXNTJiMnRsSUdCemFHOTFiR1JEYjIxd2IyNWxiblJWY0dSaGRHVmdMQ0JpZFhRZ2FYUWdkMmxzYkNCcGJuWnZhMlZjYmlBcUlHQmpiMjF3YjI1bGJuUlhhV3hzVlhCa1lYUmxZQ0JoYm1RZ1lHTnZiWEJ2Ym1WdWRFUnBaRlZ3WkdGMFpXQXVYRzRnS2x4dUlDb2dRSEJoY21GdElIcy9ablZ1WTNScGIyNTlJR05oYkd4aVlXTnJJRU5oYkd4bFpDQmhablJsY2lCMWNHUmhkR1VnYVhNZ1kyOXRjR3hsZEdVdVhHNGdLaUJBWm1sdVlXeGNiaUFxSUVCd2NtOTBaV04wWldSY2JpQXFMMXh1VW1WaFkzUkRiMjF3YjI1bGJuUXVjSEp2ZEc5MGVYQmxMbVp2Y21ObFZYQmtZWFJsSUQwZ1puVnVZM1JwYjI0Z0tHTmhiR3hpWVdOcktTQjdYRzRnSUhSb2FYTXVkWEJrWVhSbGNpNWxibkYxWlhWbFJtOXlZMlZWY0dSaGRHVW9kR2hwY3lrN1hHNGdJR2xtSUNoallXeHNZbUZqYXlrZ2UxeHVJQ0FnSUhSb2FYTXVkWEJrWVhSbGNpNWxibkYxWlhWbFEyRnNiR0poWTJzb2RHaHBjeXdnWTJGc2JHSmhZMnNzSUNkbWIzSmpaVlZ3WkdGMFpTY3BPMXh1SUNCOVhHNTlPMXh1WEc0dktpcGNiaUFxSUVSbGNISmxZMkYwWldRZ1FWQkpjeTRnVkdobGMyVWdRVkJKY3lCMWMyVmtJSFJ2SUdWNGFYTjBJRzl1SUdOc1lYTnphV01nVW1WaFkzUWdZMnhoYzNObGN5QmlkWFFnYzJsdVkyVmNiaUFxSUhkbElIZHZkV3hrSUd4cGEyVWdkRzhnWkdWd2NtVmpZWFJsSUhSb1pXMHNJSGRsSjNKbElHNXZkQ0JuYjJsdVp5QjBieUJ0YjNabElIUm9aVzBnYjNabGNpQjBieUIwYUdselhHNGdLaUJ0YjJSbGNtNGdZbUZ6WlNCamJHRnpjeTRnU1c1emRHVmhaQ3dnZDJVZ1pHVm1hVzVsSUdFZ1oyVjBkR1Z5SUhSb1lYUWdkMkZ5Ym5NZ2FXWWdhWFFuY3lCaFkyTmxjM05sWkM1Y2JpQXFMMXh1YVdZZ0tIQnliMk5sYzNNdVpXNTJMazVQUkVWZlJVNVdJQ0U5UFNBbmNISnZaSFZqZEdsdmJpY3BJSHRjYmlBZ2RtRnlJR1JsY0hKbFkyRjBaV1JCVUVseklEMGdlMXh1SUNBZ0lHbHpUVzkxYm5SbFpEb2dXeWRwYzAxdmRXNTBaV1FuTENBblNXNXpkR1ZoWkN3Z2JXRnJaU0J6ZFhKbElIUnZJR05zWldGdUlIVndJSE4xWW5OamNtbHdkR2x2Ym5NZ1lXNWtJSEJsYm1ScGJtY2djbVZ4ZFdWemRITWdhVzRnSnlBcklDZGpiMjF3YjI1bGJuUlhhV3hzVlc1dGIzVnVkQ0IwYnlCd2NtVjJaVzUwSUcxbGJXOXllU0JzWldGcmN5NG5YU3hjYmlBZ0lDQnlaWEJzWVdObFUzUmhkR1U2SUZzbmNtVndiR0ZqWlZOMFlYUmxKeXdnSjFKbFptRmpkRzl5SUhsdmRYSWdZMjlrWlNCMGJ5QjFjMlVnYzJWMFUzUmhkR1VnYVc1emRHVmhaQ0FvYzJWbElDY2dLeUFuYUhSMGNITTZMeTluYVhSb2RXSXVZMjl0TDJaaFkyVmliMjlyTDNKbFlXTjBMMmx6YzNWbGN5OHpNak0yS1M0blhWeHVJQ0I5TzF4dUlDQjJZWElnWkdWbWFXNWxSR1Z3Y21WallYUnBiMjVYWVhKdWFXNW5JRDBnWm5WdVkzUnBiMjRnS0cxbGRHaHZaRTVoYldVc0lHbHVabThwSUh0Y2JpQWdJQ0JwWmlBb1kyRnVSR1ZtYVc1bFVISnZjR1Z5ZEhrcElIdGNiaUFnSUNBZ0lFOWlhbVZqZEM1a1pXWnBibVZRY205d1pYSjBlU2hTWldGamRFTnZiWEJ2Ym1WdWRDNXdjbTkwYjNSNWNHVXNJRzFsZEdodlpFNWhiV1VzSUh0Y2JpQWdJQ0FnSUNBZ1oyVjBPaUJtZFc1amRHbHZiaUFvS1NCN1hHNGdJQ0FnSUNBZ0lDQWdiRzkzVUhKcGIzSnBkSGxYWVhKdWFXNW5LR1poYkhObExDQW5KWE1vTGk0dUtTQnBjeUJrWlhCeVpXTmhkR1ZrSUdsdUlIQnNZV2x1SUVwaGRtRlRZM0pwY0hRZ1VtVmhZM1FnWTJ4aGMzTmxjeTRnSlhNbkxDQnBibVp2V3pCZExDQnBibVp2V3pGZEtUdGNiaUFnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdkVzVrWldacGJtVmtPMXh1SUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0I5S1R0Y2JpQWdJQ0I5WEc0Z0lIMDdYRzRnSUdadmNpQW9kbUZ5SUdadVRtRnRaU0JwYmlCa1pYQnlaV05oZEdWa1FWQkpjeWtnZTF4dUlDQWdJR2xtSUNoa1pYQnlaV05oZEdWa1FWQkpjeTVvWVhOUGQyNVFjbTl3WlhKMGVTaG1iazVoYldVcEtTQjdYRzRnSUNBZ0lDQmtaV1pwYm1WRVpYQnlaV05oZEdsdmJsZGhjbTVwYm1jb1ptNU9ZVzFsTENCa1pYQnlaV05oZEdWa1FWQkpjMXRtYms1aGJXVmRLVHRjYmlBZ0lDQjlYRzRnSUgxY2JuMWNibHh1THlvcVhHNGdLaUJDWVhObElHTnNZWE56SUdobGJIQmxjbk1nWm05eUlIUm9aU0IxY0dSaGRHbHVaeUJ6ZEdGMFpTQnZaaUJoSUdOdmJYQnZibVZ1ZEM1Y2JpQXFMMXh1Wm5WdVkzUnBiMjRnVW1WaFkzUlFkWEpsUTI5dGNHOXVaVzUwS0hCeWIzQnpMQ0JqYjI1MFpYaDBMQ0IxY0dSaGRHVnlLU0I3WEc0Z0lDOHZJRVIxY0d4cFkyRjBaV1FnWm5KdmJTQlNaV0ZqZEVOdmJYQnZibVZ1ZEM1Y2JpQWdkR2hwY3k1d2NtOXdjeUE5SUhCeWIzQnpPMXh1SUNCMGFHbHpMbU52Ym5SbGVIUWdQU0JqYjI1MFpYaDBPMXh1SUNCMGFHbHpMbkpsWm5NZ1BTQmxiWEIwZVU5aWFtVmpkRHRjYmlBZ0x5OGdWMlVnYVc1cGRHbGhiR2w2WlNCMGFHVWdaR1ZtWVhWc2RDQjFjR1JoZEdWeUlHSjFkQ0IwYUdVZ2NtVmhiQ0J2Ym1VZ1oyVjBjeUJwYm1wbFkzUmxaQ0JpZVNCMGFHVmNiaUFnTHk4Z2NtVnVaR1Z5WlhJdVhHNGdJSFJvYVhNdWRYQmtZWFJsY2lBOUlIVndaR0YwWlhJZ2ZId2dVbVZoWTNST2IyOXdWWEJrWVhSbFVYVmxkV1U3WEc1OVhHNWNibVoxYm1OMGFXOXVJRU52YlhCdmJtVnVkRVIxYlcxNUtDa2dlMzFjYmtOdmJYQnZibVZ1ZEVSMWJXMTVMbkJ5YjNSdmRIbHdaU0E5SUZKbFlXTjBRMjl0Y0c5dVpXNTBMbkJ5YjNSdmRIbHdaVHRjYmxKbFlXTjBVSFZ5WlVOdmJYQnZibVZ1ZEM1d2NtOTBiM1I1Y0dVZ1BTQnVaWGNnUTI5dGNHOXVaVzUwUkhWdGJYa29LVHRjYmxKbFlXTjBVSFZ5WlVOdmJYQnZibVZ1ZEM1d2NtOTBiM1I1Y0dVdVkyOXVjM1J5ZFdOMGIzSWdQU0JTWldGamRGQjFjbVZEYjIxd2IyNWxiblE3WEc0dkx5QkJkbTlwWkNCaGJpQmxlSFJ5WVNCd2NtOTBiM1I1Y0dVZ2FuVnRjQ0JtYjNJZ2RHaGxjMlVnYldWMGFHOWtjeTVjYmw5aGMzTnBaMjRvVW1WaFkzUlFkWEpsUTI5dGNHOXVaVzUwTG5CeWIzUnZkSGx3WlN3Z1VtVmhZM1JEYjIxd2IyNWxiblF1Y0hKdmRHOTBlWEJsS1R0Y2JsSmxZV04wVUhWeVpVTnZiWEJ2Ym1WdWRDNXdjbTkwYjNSNWNHVXVhWE5RZFhKbFVtVmhZM1JEYjIxd2IyNWxiblFnUFNCMGNuVmxPMXh1WEc1dGIyUjFiR1V1Wlhod2IzSjBjeUE5SUh0Y2JpQWdRMjl0Y0c5dVpXNTBPaUJTWldGamRFTnZiWEJ2Ym1WdWRDeGNiaUFnVUhWeVpVTnZiWEJ2Ym1WdWREb2dVbVZoWTNSUWRYSmxRMjl0Y0c5dVpXNTBYRzU5T3lJc0lpOHFLbHh1SUNvZ1EyOXdlWEpwWjJoMElESXdNVE10Y0hKbGMyVnVkQ3dnUm1GalpXSnZiMnNzSUVsdVl5NWNiaUFxSUVGc2JDQnlhV2RvZEhNZ2NtVnpaWEoyWldRdVhHNGdLbHh1SUNvZ1ZHaHBjeUJ6YjNWeVkyVWdZMjlrWlNCcGN5QnNhV05sYm5ObFpDQjFibVJsY2lCMGFHVWdRbE5FTFhOMGVXeGxJR3hwWTJWdWMyVWdabTkxYm1RZ2FXNGdkR2hsWEc0Z0tpQk1TVU5GVGxORklHWnBiR1VnYVc0Z2RHaGxJSEp2YjNRZ1pHbHlaV04wYjNKNUlHOW1JSFJvYVhNZ2MyOTFjbU5sSUhSeVpXVXVJRUZ1SUdGa1pHbDBhVzl1WVd3Z1ozSmhiblJjYmlBcUlHOW1JSEJoZEdWdWRDQnlhV2RvZEhNZ1kyRnVJR0psSUdadmRXNWtJR2x1SUhSb1pTQlFRVlJGVGxSVElHWnBiR1VnYVc0Z2RHaGxJSE5oYldVZ1pHbHlaV04wYjNKNUxseHVJQ3BjYmlBcUwxeHVYRzRuZFhObElITjBjbWxqZENjN1hHNWNiblpoY2lCUWIyOXNaV1JEYkdGemN5QTlJSEpsY1hWcGNtVW9KeTR2VUc5dmJHVmtRMnhoYzNNbktUdGNiblpoY2lCU1pXRmpkRVZzWlcxbGJuUWdQU0J5WlhGMWFYSmxLQ2N1TDFKbFlXTjBSV3hsYldWdWRDY3BPMXh1WEc1MllYSWdaVzF3ZEhsR2RXNWpkR2x2YmlBOUlISmxjWFZwY21Vb0oyWmlhbk12YkdsaUwyVnRjSFI1Um5WdVkzUnBiMjRuS1R0Y2JuWmhjaUIwY21GMlpYSnpaVUZzYkVOb2FXeGtjbVZ1SUQwZ2NtVnhkV2x5WlNnbkxpOTBjbUYyWlhKelpVRnNiRU5vYVd4a2NtVnVKeWs3WEc1Y2JuWmhjaUIwZDI5QmNtZDFiV1Z1ZEZCdmIyeGxjaUE5SUZCdmIyeGxaRU5zWVhOekxuUjNiMEZ5WjNWdFpXNTBVRzl2YkdWeU8xeHVkbUZ5SUdadmRYSkJjbWQxYldWdWRGQnZiMnhsY2lBOUlGQnZiMnhsWkVOc1lYTnpMbVp2ZFhKQmNtZDFiV1Z1ZEZCdmIyeGxjanRjYmx4dWRtRnlJSFZ6WlhKUWNtOTJhV1JsWkV0bGVVVnpZMkZ3WlZKbFoyVjRJRDBnTDF4Y0x5c3ZaenRjYm1aMWJtTjBhVzl1SUdWelkyRndaVlZ6WlhKUWNtOTJhV1JsWkV0bGVTaDBaWGgwS1NCN1hHNGdJSEpsZEhWeWJpQW9KeWNnS3lCMFpYaDBLUzV5WlhCc1lXTmxLSFZ6WlhKUWNtOTJhV1JsWkV0bGVVVnpZMkZ3WlZKbFoyVjRMQ0FuSkNZdkp5azdYRzU5WEc1Y2JpOHFLbHh1SUNvZ1VHOXZiR1ZrUTJ4aGMzTWdjbVZ3Y21WelpXNTBhVzVuSUhSb1pTQmliMjlyYTJWbGNHbHVaeUJoYzNOdlkybGhkR1ZrSUhkcGRHZ2djR1Z5Wm05eWJXbHVaeUJoSUdOb2FXeGtYRzRnS2lCMGNtRjJaWEp6WVd3dUlFRnNiRzkzY3lCaGRtOXBaR2x1WnlCaWFXNWthVzVuSUdOaGJHeGlZV05yY3k1Y2JpQXFYRzRnS2lCQVkyOXVjM1J5ZFdOMGIzSWdSbTl5UldGamFFSnZiMnRMWldWd2FXNW5YRzRnS2lCQWNHRnlZVzBnZXlGbWRXNWpkR2x2Ym4wZ1ptOXlSV0ZqYUVaMWJtTjBhVzl1SUVaMWJtTjBhVzl1SUhSdklIQmxjbVp2Y20wZ2RISmhkbVZ5YzJGc0lIZHBkR2d1WEc0Z0tpQkFjR0Z5WVcwZ2V6OHFmU0JtYjNKRllXTm9RMjl1ZEdWNGRDQkRiMjUwWlhoMElIUnZJSEJsY21admNtMGdZMjl1ZEdWNGRDQjNhWFJvTGx4dUlDb3ZYRzVtZFc1amRHbHZiaUJHYjNKRllXTm9RbTl2YTB0bFpYQnBibWNvWm05eVJXRmphRVoxYm1OMGFXOXVMQ0JtYjNKRllXTm9RMjl1ZEdWNGRDa2dlMXh1SUNCMGFHbHpMbVoxYm1NZ1BTQm1iM0pGWVdOb1JuVnVZM1JwYjI0N1hHNGdJSFJvYVhNdVkyOXVkR1Y0ZENBOUlHWnZja1ZoWTJoRGIyNTBaWGgwTzF4dUlDQjBhR2x6TG1OdmRXNTBJRDBnTUR0Y2JuMWNia1p2Y2tWaFkyaENiMjlyUzJWbGNHbHVaeTV3Y205MGIzUjVjR1V1WkdWemRISjFZM1J2Y2lBOUlHWjFibU4wYVc5dUlDZ3BJSHRjYmlBZ2RHaHBjeTVtZFc1aklEMGdiblZzYkR0Y2JpQWdkR2hwY3k1amIyNTBaWGgwSUQwZ2JuVnNiRHRjYmlBZ2RHaHBjeTVqYjNWdWRDQTlJREE3WEc1OU8xeHVVRzl2YkdWa1EyeGhjM011WVdSa1VHOXZiR2x1WjFSdktFWnZja1ZoWTJoQ2IyOXJTMlZsY0dsdVp5d2dkSGR2UVhKbmRXMWxiblJRYjI5c1pYSXBPMXh1WEc1bWRXNWpkR2x2YmlCbWIzSkZZV05vVTJsdVoyeGxRMmhwYkdRb1ltOXZhMHRsWlhCcGJtY3NJR05vYVd4a0xDQnVZVzFsS1NCN1hHNGdJSFpoY2lCbWRXNWpJRDBnWW05dmEwdGxaWEJwYm1jdVpuVnVZeXhjYmlBZ0lDQWdJR052Ym5SbGVIUWdQU0JpYjI5clMyVmxjR2x1Wnk1amIyNTBaWGgwTzF4dVhHNGdJR1oxYm1NdVkyRnNiQ2hqYjI1MFpYaDBMQ0JqYUdsc1pDd2dZbTl2YTB0bFpYQnBibWN1WTI5MWJuUXJLeWs3WEc1OVhHNWNiaThxS2x4dUlDb2dTWFJsY21GMFpYTWdkR2h5YjNWbmFDQmphR2xzWkhKbGJpQjBhR0YwSUdGeVpTQjBlWEJwWTJGc2JIa2djM0JsWTJsbWFXVmtJR0Z6SUdCd2NtOXdjeTVqYUdsc1pISmxibUF1WEc0Z0tseHVJQ29nVTJWbElHaDBkSEJ6T2k4dlptRmpaV0p2YjJzdVoybDBhSFZpTG1sdkwzSmxZV04wTDJSdlkzTXZkRzl3TFd4bGRtVnNMV0Z3YVM1b2RHMXNJM0psWVdOMExtTm9hV3hrY21WdUxtWnZjbVZoWTJoY2JpQXFYRzRnS2lCVWFHVWdjSEp2ZG1sa1pXUWdabTl5UldGamFFWjFibU1vWTJocGJHUXNJR2x1WkdWNEtTQjNhV3hzSUdKbElHTmhiR3hsWkNCbWIzSWdaV0ZqYUZ4dUlDb2diR1ZoWmlCamFHbHNaQzVjYmlBcVhHNGdLaUJBY0dGeVlXMGdlejhxZlNCamFHbHNaSEpsYmlCRGFHbHNaSEpsYmlCMGNtVmxJR052Ym5SaGFXNWxjaTVjYmlBcUlFQndZWEpoYlNCN1puVnVZM1JwYjI0b0tpd2dhVzUwS1gwZ1ptOXlSV0ZqYUVaMWJtTmNiaUFxSUVCd1lYSmhiU0I3S24wZ1ptOXlSV0ZqYUVOdmJuUmxlSFFnUTI5dWRHVjRkQ0JtYjNJZ1ptOXlSV0ZqYUVOdmJuUmxlSFF1WEc0Z0tpOWNibVoxYm1OMGFXOXVJR1p2Y2tWaFkyaERhR2xzWkhKbGJpaGphR2xzWkhKbGJpd2dabTl5UldGamFFWjFibU1zSUdadmNrVmhZMmhEYjI1MFpYaDBLU0I3WEc0Z0lHbG1JQ2hqYUdsc1pISmxiaUE5UFNCdWRXeHNLU0I3WEc0Z0lDQWdjbVYwZFhKdUlHTm9hV3hrY21WdU8xeHVJQ0I5WEc0Z0lIWmhjaUIwY21GMlpYSnpaVU52Ym5SbGVIUWdQU0JHYjNKRllXTm9RbTl2YTB0bFpYQnBibWN1WjJWMFVHOXZiR1ZrS0dadmNrVmhZMmhHZFc1akxDQm1iM0pGWVdOb1EyOXVkR1Y0ZENrN1hHNGdJSFJ5WVhabGNuTmxRV3hzUTJocGJHUnlaVzRvWTJocGJHUnlaVzRzSUdadmNrVmhZMmhUYVc1bmJHVkRhR2xzWkN3Z2RISmhkbVZ5YzJWRGIyNTBaWGgwS1R0Y2JpQWdSbTl5UldGamFFSnZiMnRMWldWd2FXNW5MbkpsYkdWaGMyVW9kSEpoZG1WeWMyVkRiMjUwWlhoMEtUdGNibjFjYmx4dUx5b3FYRzRnS2lCUWIyOXNaV1JEYkdGemN5QnlaWEJ5WlhObGJuUnBibWNnZEdobElHSnZiMnRyWldWd2FXNW5JR0Z6YzI5amFXRjBaV1FnZDJsMGFDQndaWEptYjNKdGFXNW5JR0VnWTJocGJHUmNiaUFxSUcxaGNIQnBibWN1SUVGc2JHOTNjeUJoZG05cFpHbHVaeUJpYVc1a2FXNW5JR05oYkd4aVlXTnJjeTVjYmlBcVhHNGdLaUJBWTI5dWMzUnlkV04wYjNJZ1RXRndRbTl2YTB0bFpYQnBibWRjYmlBcUlFQndZWEpoYlNCN0lTcDlJRzFoY0ZKbGMzVnNkQ0JQWW1wbFkzUWdZMjl1ZEdGcGJtbHVaeUIwYUdVZ2IzSmtaWEpsWkNCdFlYQWdiMllnY21WemRXeDBjeTVjYmlBcUlFQndZWEpoYlNCN0lXWjFibU4wYVc5dWZTQnRZWEJHZFc1amRHbHZiaUJHZFc1amRHbHZiaUIwYnlCd1pYSm1iM0p0SUcxaGNIQnBibWNnZDJsMGFDNWNiaUFxSUVCd1lYSmhiU0I3UHlwOUlHMWhjRU52Ym5SbGVIUWdRMjl1ZEdWNGRDQjBieUJ3WlhKbWIzSnRJRzFoY0hCcGJtY2dkMmwwYUM1Y2JpQXFMMXh1Wm5WdVkzUnBiMjRnVFdGd1FtOXZhMHRsWlhCcGJtY29iV0Z3VW1WemRXeDBMQ0JyWlhsUWNtVm1hWGdzSUcxaGNFWjFibU4wYVc5dUxDQnRZWEJEYjI1MFpYaDBLU0I3WEc0Z0lIUm9hWE11Y21WemRXeDBJRDBnYldGd1VtVnpkV3gwTzF4dUlDQjBhR2x6TG10bGVWQnlaV1pwZUNBOUlHdGxlVkJ5WldacGVEdGNiaUFnZEdocGN5NW1kVzVqSUQwZ2JXRndSblZ1WTNScGIyNDdYRzRnSUhSb2FYTXVZMjl1ZEdWNGRDQTlJRzFoY0VOdmJuUmxlSFE3WEc0Z0lIUm9hWE11WTI5MWJuUWdQU0F3TzF4dWZWeHVUV0Z3UW05dmEwdGxaWEJwYm1jdWNISnZkRzkwZVhCbExtUmxjM1J5ZFdOMGIzSWdQU0JtZFc1amRHbHZiaUFvS1NCN1hHNGdJSFJvYVhNdWNtVnpkV3gwSUQwZ2JuVnNiRHRjYmlBZ2RHaHBjeTVyWlhsUWNtVm1hWGdnUFNCdWRXeHNPMXh1SUNCMGFHbHpMbVoxYm1NZ1BTQnVkV3hzTzF4dUlDQjBhR2x6TG1OdmJuUmxlSFFnUFNCdWRXeHNPMXh1SUNCMGFHbHpMbU52ZFc1MElEMGdNRHRjYm4wN1hHNVFiMjlzWldSRGJHRnpjeTVoWkdSUWIyOXNhVzVuVkc4b1RXRndRbTl2YTB0bFpYQnBibWNzSUdadmRYSkJjbWQxYldWdWRGQnZiMnhsY2lrN1hHNWNibVoxYm1OMGFXOXVJRzFoY0ZOcGJtZHNaVU5vYVd4a1NXNTBiME52Ym5SbGVIUW9ZbTl2YTB0bFpYQnBibWNzSUdOb2FXeGtMQ0JqYUdsc1pFdGxlU2tnZTF4dUlDQjJZWElnY21WemRXeDBJRDBnWW05dmEwdGxaWEJwYm1jdWNtVnpkV3gwTEZ4dUlDQWdJQ0FnYTJWNVVISmxabWw0SUQwZ1ltOXZhMHRsWlhCcGJtY3VhMlY1VUhKbFptbDRMRnh1SUNBZ0lDQWdablZ1WXlBOUlHSnZiMnRMWldWd2FXNW5MbVoxYm1Nc1hHNGdJQ0FnSUNCamIyNTBaWGgwSUQwZ1ltOXZhMHRsWlhCcGJtY3VZMjl1ZEdWNGREdGNibHh1WEc0Z0lIWmhjaUJ0WVhCd1pXUkRhR2xzWkNBOUlHWjFibU11WTJGc2JDaGpiMjUwWlhoMExDQmphR2xzWkN3Z1ltOXZhMHRsWlhCcGJtY3VZMjkxYm5Rckt5azdYRzRnSUdsbUlDaEJjbkpoZVM1cGMwRnljbUY1S0cxaGNIQmxaRU5vYVd4a0tTa2dlMXh1SUNBZ0lHMWhjRWx1ZEc5WGFYUm9TMlY1VUhKbFptbDRTVzUwWlhKdVlXd29iV0Z3Y0dWa1EyaHBiR1FzSUhKbGMzVnNkQ3dnWTJocGJHUkxaWGtzSUdWdGNIUjVSblZ1WTNScGIyNHVkR2hoZEZKbGRIVnlibk5CY21kMWJXVnVkQ2s3WEc0Z0lIMGdaV3h6WlNCcFppQW9iV0Z3Y0dWa1EyaHBiR1FnSVQwZ2JuVnNiQ2tnZTF4dUlDQWdJR2xtSUNoU1pXRmpkRVZzWlcxbGJuUXVhWE5XWVd4cFpFVnNaVzFsYm5Rb2JXRndjR1ZrUTJocGJHUXBLU0I3WEc0Z0lDQWdJQ0J0WVhCd1pXUkRhR2xzWkNBOUlGSmxZV04wUld4bGJXVnVkQzVqYkc5dVpVRnVaRkpsY0d4aFkyVkxaWGtvYldGd2NHVmtRMmhwYkdRc1hHNGdJQ0FnSUNBdkx5QkxaV1Z3SUdKdmRHZ2dkR2hsSUNodFlYQndaV1FwSUdGdVpDQnZiR1FnYTJWNWN5QnBaaUIwYUdWNUlHUnBabVpsY2l3Z2FuVnpkQ0JoYzF4dUlDQWdJQ0FnTHk4Z2RISmhkbVZ5YzJWQmJHeERhR2xzWkhKbGJpQjFjMlZrSUhSdklHUnZJR1p2Y2lCdlltcGxZM1J6SUdGeklHTm9hV3hrY21WdVhHNGdJQ0FnSUNCclpYbFFjbVZtYVhnZ0t5QW9iV0Z3Y0dWa1EyaHBiR1F1YTJWNUlDWW1JQ2doWTJocGJHUWdmSHdnWTJocGJHUXVhMlY1SUNFOVBTQnRZWEJ3WldSRGFHbHNaQzVyWlhrcElEOGdaWE5qWVhCbFZYTmxjbEJ5YjNacFpHVmtTMlY1S0cxaGNIQmxaRU5vYVd4a0xtdGxlU2tnS3lBbkx5Y2dPaUFuSnlrZ0t5QmphR2xzWkV0bGVTazdYRzRnSUNBZ2ZWeHVJQ0FnSUhKbGMzVnNkQzV3ZFhOb0tHMWhjSEJsWkVOb2FXeGtLVHRjYmlBZ2ZWeHVmVnh1WEc1bWRXNWpkR2x2YmlCdFlYQkpiblJ2VjJsMGFFdGxlVkJ5WldacGVFbHVkR1Z5Ym1Gc0tHTm9hV3hrY21WdUxDQmhjbkpoZVN3Z2NISmxabWw0TENCbWRXNWpMQ0JqYjI1MFpYaDBLU0I3WEc0Z0lIWmhjaUJsYzJOaGNHVmtVSEpsWm1sNElEMGdKeWM3WEc0Z0lHbG1JQ2h3Y21WbWFYZ2dJVDBnYm5Wc2JDa2dlMXh1SUNBZ0lHVnpZMkZ3WldSUWNtVm1hWGdnUFNCbGMyTmhjR1ZWYzJWeVVISnZkbWxrWldSTFpYa29jSEpsWm1sNEtTQXJJQ2N2Snp0Y2JpQWdmVnh1SUNCMllYSWdkSEpoZG1WeWMyVkRiMjUwWlhoMElEMGdUV0Z3UW05dmEwdGxaWEJwYm1jdVoyVjBVRzl2YkdWa0tHRnljbUY1TENCbGMyTmhjR1ZrVUhKbFptbDRMQ0JtZFc1akxDQmpiMjUwWlhoMEtUdGNiaUFnZEhKaGRtVnljMlZCYkd4RGFHbHNaSEpsYmloamFHbHNaSEpsYml3Z2JXRndVMmx1WjJ4bFEyaHBiR1JKYm5SdlEyOXVkR1Y0ZEN3Z2RISmhkbVZ5YzJWRGIyNTBaWGgwS1R0Y2JpQWdUV0Z3UW05dmEwdGxaWEJwYm1jdWNtVnNaV0Z6WlNoMGNtRjJaWEp6WlVOdmJuUmxlSFFwTzF4dWZWeHVYRzR2S2lwY2JpQXFJRTFoY0hNZ1kyaHBiR1J5Wlc0Z2RHaGhkQ0JoY21VZ2RIbHdhV05oYkd4NUlITndaV05wWm1sbFpDQmhjeUJnY0hKdmNITXVZMmhwYkdSeVpXNWdMbHh1SUNwY2JpQXFJRk5sWlNCb2RIUndjem92TDJaaFkyVmliMjlyTG1kcGRHaDFZaTVwYnk5eVpXRmpkQzlrYjJOekwzUnZjQzFzWlhabGJDMWhjR2t1YUhSdGJDTnlaV0ZqZEM1amFHbHNaSEpsYmk1dFlYQmNiaUFxWEc0Z0tpQlVhR1VnY0hKdmRtbGtaV1FnYldGd1JuVnVZM1JwYjI0b1kyaHBiR1FzSUd0bGVTd2dhVzVrWlhncElIZHBiR3dnWW1VZ1kyRnNiR1ZrSUdadmNpQmxZV05vWEc0Z0tpQnNaV0ZtSUdOb2FXeGtMbHh1SUNwY2JpQXFJRUJ3WVhKaGJTQjdQeXA5SUdOb2FXeGtjbVZ1SUVOb2FXeGtjbVZ1SUhSeVpXVWdZMjl1ZEdGcGJtVnlMbHh1SUNvZ1FIQmhjbUZ0SUh0bWRXNWpkR2x2YmlncUxDQnBiblFwZlNCbWRXNWpJRlJvWlNCdFlYQWdablZ1WTNScGIyNHVYRzRnS2lCQWNHRnlZVzBnZXlwOUlHTnZiblJsZUhRZ1EyOXVkR1Y0ZENCbWIzSWdiV0Z3Um5WdVkzUnBiMjR1WEc0Z0tpQkFjbVYwZFhKdUlIdHZZbXBsWTNSOUlFOWlhbVZqZENCamIyNTBZV2x1YVc1bklIUm9aU0J2Y21SbGNtVmtJRzFoY0NCdlppQnlaWE4xYkhSekxseHVJQ292WEc1bWRXNWpkR2x2YmlCdFlYQkRhR2xzWkhKbGJpaGphR2xzWkhKbGJpd2dablZ1WXl3Z1kyOXVkR1Y0ZENrZ2UxeHVJQ0JwWmlBb1kyaHBiR1J5Wlc0Z1BUMGdiblZzYkNrZ2UxeHVJQ0FnSUhKbGRIVnliaUJqYUdsc1pISmxianRjYmlBZ2ZWeHVJQ0IyWVhJZ2NtVnpkV3gwSUQwZ1cxMDdYRzRnSUcxaGNFbHVkRzlYYVhSb1MyVjVVSEpsWm1sNFNXNTBaWEp1WVd3b1kyaHBiR1J5Wlc0c0lISmxjM1ZzZEN3Z2JuVnNiQ3dnWm5WdVl5d2dZMjl1ZEdWNGRDazdYRzRnSUhKbGRIVnliaUJ5WlhOMWJIUTdYRzU5WEc1Y2JtWjFibU4wYVc5dUlHWnZja1ZoWTJoVGFXNW5iR1ZEYUdsc1pFUjFiVzE1S0hSeVlYWmxjbk5sUTI5dWRHVjRkQ3dnWTJocGJHUXNJRzVoYldVcElIdGNiaUFnY21WMGRYSnVJRzUxYkd3N1hHNTlYRzVjYmk4cUtseHVJQ29nUTI5MWJuUWdkR2hsSUc1MWJXSmxjaUJ2WmlCamFHbHNaSEpsYmlCMGFHRjBJR0Z5WlNCMGVYQnBZMkZzYkhrZ2MzQmxZMmxtYVdWa0lHRnpYRzRnS2lCZ2NISnZjSE11WTJocGJHUnlaVzVnTGx4dUlDcGNiaUFxSUZObFpTQm9kSFJ3Y3pvdkwyWmhZMlZpYjI5ckxtZHBkR2gxWWk1cGJ5OXlaV0ZqZEM5a2IyTnpMM1J2Y0Mxc1pYWmxiQzFoY0drdWFIUnRiQ055WldGamRDNWphR2xzWkhKbGJpNWpiM1Z1ZEZ4dUlDcGNiaUFxSUVCd1lYSmhiU0I3UHlwOUlHTm9hV3hrY21WdUlFTm9hV3hrY21WdUlIUnlaV1VnWTI5dWRHRnBibVZ5TGx4dUlDb2dRSEpsZEhWeWJpQjdiblZ0WW1WeWZTQlVhR1VnYm5WdFltVnlJRzltSUdOb2FXeGtjbVZ1TGx4dUlDb3ZYRzVtZFc1amRHbHZiaUJqYjNWdWRFTm9hV3hrY21WdUtHTm9hV3hrY21WdUxDQmpiMjUwWlhoMEtTQjdYRzRnSUhKbGRIVnliaUIwY21GMlpYSnpaVUZzYkVOb2FXeGtjbVZ1S0dOb2FXeGtjbVZ1TENCbWIzSkZZV05vVTJsdVoyeGxRMmhwYkdSRWRXMXRlU3dnYm5Wc2JDazdYRzU5WEc1Y2JpOHFLbHh1SUNvZ1JteGhkSFJsYmlCaElHTm9hV3hrY21WdUlHOWlhbVZqZENBb2RIbHdhV05oYkd4NUlITndaV05wWm1sbFpDQmhjeUJnY0hKdmNITXVZMmhwYkdSeVpXNWdLU0JoYm1SY2JpQXFJSEpsZEhWeWJpQmhiaUJoY25KaGVTQjNhWFJvSUdGd2NISnZjSEpwWVhSbGJIa2djbVV0YTJWNVpXUWdZMmhwYkdSeVpXNHVYRzRnS2x4dUlDb2dVMlZsSUdoMGRIQnpPaTh2Wm1GalpXSnZiMnN1WjJsMGFIVmlMbWx2TDNKbFlXTjBMMlJ2WTNNdmRHOXdMV3hsZG1Wc0xXRndhUzVvZEcxc0kzSmxZV04wTG1Ob2FXeGtjbVZ1TG5SdllYSnlZWGxjYmlBcUwxeHVablZ1WTNScGIyNGdkRzlCY25KaGVTaGphR2xzWkhKbGJpa2dlMXh1SUNCMllYSWdjbVZ6ZFd4MElEMGdXMTA3WEc0Z0lHMWhjRWx1ZEc5WGFYUm9TMlY1VUhKbFptbDRTVzUwWlhKdVlXd29ZMmhwYkdSeVpXNHNJSEpsYzNWc2RDd2diblZzYkN3Z1pXMXdkSGxHZFc1amRHbHZiaTUwYUdGMFVtVjBkWEp1YzBGeVozVnRaVzUwS1R0Y2JpQWdjbVYwZFhKdUlISmxjM1ZzZER0Y2JuMWNibHh1ZG1GeUlGSmxZV04wUTJocGJHUnlaVzRnUFNCN1hHNGdJR1p2Y2tWaFkyZzZJR1p2Y2tWaFkyaERhR2xzWkhKbGJpeGNiaUFnYldGd09pQnRZWEJEYUdsc1pISmxiaXhjYmlBZ2JXRndTVzUwYjFkcGRHaExaWGxRY21WbWFYaEpiblJsY201aGJEb2diV0Z3U1c1MGIxZHBkR2hMWlhsUWNtVm1hWGhKYm5SbGNtNWhiQ3hjYmlBZ1kyOTFiblE2SUdOdmRXNTBRMmhwYkdSeVpXNHNYRzRnSUhSdlFYSnlZWGs2SUhSdlFYSnlZWGxjYm4wN1hHNWNibTF2WkhWc1pTNWxlSEJ2Y25SeklEMGdVbVZoWTNSRGFHbHNaSEpsYmpzaUxDSXZLaXBjYmlBcUlFTnZjSGx5YVdkb2RDQXlNREUyTFhCeVpYTmxiblFzSUVaaFkyVmliMjlyTENCSmJtTXVYRzRnS2lCQmJHd2djbWxuYUhSeklISmxjMlZ5ZG1Wa0xseHVJQ3BjYmlBcUlGUm9hWE1nYzI5MWNtTmxJR052WkdVZ2FYTWdiR2xqWlc1elpXUWdkVzVrWlhJZ2RHaGxJRUpUUkMxemRIbHNaU0JzYVdObGJuTmxJR1p2ZFc1a0lHbHVJSFJvWlZ4dUlDb2dURWxEUlU1VFJTQm1hV3hsSUdsdUlIUm9aU0J5YjI5MElHUnBjbVZqZEc5eWVTQnZaaUIwYUdseklITnZkWEpqWlNCMGNtVmxMaUJCYmlCaFpHUnBkR2x2Ym1Gc0lHZHlZVzUwWEc0Z0tpQnZaaUJ3WVhSbGJuUWdjbWxuYUhSeklHTmhiaUJpWlNCbWIzVnVaQ0JwYmlCMGFHVWdVRUZVUlU1VVV5Qm1hV3hsSUdsdUlIUm9aU0J6WVcxbElHUnBjbVZqZEc5eWVTNWNiaUFxWEc0Z0tpQmNiaUFxTDF4dVhHNG5kWE5sSUhOMGNtbGpkQ2M3WEc1Y2JuWmhjaUJmY0hKdlpFbHVkbUZ5YVdGdWRDQTlJSEpsY1hWcGNtVW9KeTR2Y21WaFkzUlFjbTlrU1c1MllYSnBZVzUwSnlrN1hHNWNiblpoY2lCU1pXRmpkRU4xY25KbGJuUlBkMjVsY2lBOUlISmxjWFZwY21Vb0p5NHZVbVZoWTNSRGRYSnlaVzUwVDNkdVpYSW5LVHRjYmx4dWRtRnlJR2x1ZG1GeWFXRnVkQ0E5SUhKbGNYVnBjbVVvSjJaaWFuTXZiR2xpTDJsdWRtRnlhV0Z1ZENjcE8xeHVkbUZ5SUhkaGNtNXBibWNnUFNCeVpYRjFhWEpsS0NkbVltcHpMMnhwWWk5M1lYSnVhVzVuSnlrN1hHNWNibVoxYm1OMGFXOXVJR2x6VG1GMGFYWmxLR1p1S1NCN1hHNGdJQzh2SUVKaGMyVmtJRzl1SUdselRtRjBhWFpsS0NrZ1puSnZiU0JNYjJSaGMyaGNiaUFnZG1GeUlHWjFibU5VYjFOMGNtbHVaeUE5SUVaMWJtTjBhVzl1TG5CeWIzUnZkSGx3WlM1MGIxTjBjbWx1Wnp0Y2JpQWdkbUZ5SUdoaGMwOTNibEJ5YjNCbGNuUjVJRDBnVDJKcVpXTjBMbkJ5YjNSdmRIbHdaUzVvWVhOUGQyNVFjbTl3WlhKMGVUdGNiaUFnZG1GeUlISmxTWE5PWVhScGRtVWdQU0JTWldkRmVIQW9KMTRuSUNzZ1puVnVZMVJ2VTNSeWFXNW5YRzRnSUM4dklGUmhhMlVnWVc0Z1pYaGhiWEJzWlNCdVlYUnBkbVVnWm5WdVkzUnBiMjRnYzI5MWNtTmxJR1p2Y2lCamIyMXdZWEpwYzI5dVhHNGdJQzVqWVd4c0tHaGhjMDkzYmxCeWIzQmxjblI1WEc0Z0lDOHZJRk4wY21sd0lISmxaMlY0SUdOb1lYSmhZM1JsY25NZ2MyOGdkMlVnWTJGdUlIVnpaU0JwZENCbWIzSWdjbVZuWlhoY2JpQWdLUzV5WlhCc1lXTmxLQzliWEZ4Y1hGNGtMaW9yUHlncFcxeGNYWHQ5ZkYwdlp5d2dKMXhjWEZ3a0ppZGNiaUFnTHk4Z1VtVnRiM1psSUdoaGMwOTNibEJ5YjNCbGNuUjVJR1p5YjIwZ2RHaGxJSFJsYlhCc1lYUmxJSFJ2SUcxaGEyVWdhWFFnWjJWdVpYSnBZMXh1SUNBcExuSmxjR3hoWTJVb0wyaGhjMDkzYmxCeWIzQmxjblI1ZkNobWRXNWpkR2x2YmlrdUtqOG9QejFjWEZ4Y1hGd29LWHdnWm05eUlDNHJQeWcvUFZ4Y1hGeGNYRjBwTDJjc0lDY2tNUzRxUHljcElDc2dKeVFuS1R0Y2JpQWdkSEo1SUh0Y2JpQWdJQ0IyWVhJZ2MyOTFjbU5sSUQwZ1puVnVZMVJ2VTNSeWFXNW5MbU5oYkd3b1ptNHBPMXh1SUNBZ0lISmxkSFZ5YmlCeVpVbHpUbUYwYVhabExuUmxjM1FvYzI5MWNtTmxLVHRjYmlBZ2ZTQmpZWFJqYUNBb1pYSnlLU0I3WEc0Z0lDQWdjbVYwZFhKdUlHWmhiSE5sTzF4dUlDQjlYRzU5WEc1Y2JuWmhjaUJqWVc1VmMyVkRiMnhzWldOMGFXOXVjeUE5WEc0dkx5QkJjbkpoZVM1bWNtOXRYRzUwZVhCbGIyWWdRWEp5WVhrdVpuSnZiU0E5UFQwZ0oyWjFibU4wYVc5dUp5QW1KbHh1THk4Z1RXRndYRzUwZVhCbGIyWWdUV0Z3SUQwOVBTQW5ablZ1WTNScGIyNG5JQ1ltSUdselRtRjBhWFpsS0UxaGNDa2dKaVpjYmk4dklFMWhjQzV3Y205MGIzUjVjR1V1YTJWNWMxeHVUV0Z3TG5CeWIzUnZkSGx3WlNBaFBTQnVkV3hzSUNZbUlIUjVjR1Z2WmlCTllYQXVjSEp2ZEc5MGVYQmxMbXRsZVhNZ1BUMDlJQ2RtZFc1amRHbHZiaWNnSmlZZ2FYTk9ZWFJwZG1Vb1RXRndMbkJ5YjNSdmRIbHdaUzVyWlhsektTQW1KbHh1THk4Z1UyVjBYRzUwZVhCbGIyWWdVMlYwSUQwOVBTQW5ablZ1WTNScGIyNG5JQ1ltSUdselRtRjBhWFpsS0ZObGRDa2dKaVpjYmk4dklGTmxkQzV3Y205MGIzUjVjR1V1YTJWNWMxeHVVMlYwTG5CeWIzUnZkSGx3WlNBaFBTQnVkV3hzSUNZbUlIUjVjR1Z2WmlCVFpYUXVjSEp2ZEc5MGVYQmxMbXRsZVhNZ1BUMDlJQ2RtZFc1amRHbHZiaWNnSmlZZ2FYTk9ZWFJwZG1Vb1UyVjBMbkJ5YjNSdmRIbHdaUzVyWlhsektUdGNibHh1ZG1GeUlITmxkRWwwWlcwN1hHNTJZWElnWjJWMFNYUmxiVHRjYm5aaGNpQnlaVzF2ZG1WSmRHVnRPMXh1ZG1GeUlHZGxkRWwwWlcxSlJITTdYRzUyWVhJZ1lXUmtVbTl2ZER0Y2JuWmhjaUJ5WlcxdmRtVlNiMjkwTzF4dWRtRnlJR2RsZEZKdmIzUkpSSE03WEc1Y2JtbG1JQ2hqWVc1VmMyVkRiMnhzWldOMGFXOXVjeWtnZTF4dUlDQjJZWElnYVhSbGJVMWhjQ0E5SUc1bGR5Qk5ZWEFvS1R0Y2JpQWdkbUZ5SUhKdmIzUkpSRk5sZENBOUlHNWxkeUJUWlhRb0tUdGNibHh1SUNCelpYUkpkR1Z0SUQwZ1puVnVZM1JwYjI0Z0tHbGtMQ0JwZEdWdEtTQjdYRzRnSUNBZ2FYUmxiVTFoY0M1elpYUW9hV1FzSUdsMFpXMHBPMXh1SUNCOU8xeHVJQ0JuWlhSSmRHVnRJRDBnWm5WdVkzUnBiMjRnS0dsa0tTQjdYRzRnSUNBZ2NtVjBkWEp1SUdsMFpXMU5ZWEF1WjJWMEtHbGtLVHRjYmlBZ2ZUdGNiaUFnY21WdGIzWmxTWFJsYlNBOUlHWjFibU4wYVc5dUlDaHBaQ2tnZTF4dUlDQWdJR2wwWlcxTllYQmJKMlJsYkdWMFpTZGRLR2xrS1R0Y2JpQWdmVHRjYmlBZ1oyVjBTWFJsYlVsRWN5QTlJR1oxYm1OMGFXOXVJQ2dwSUh0Y2JpQWdJQ0J5WlhSMWNtNGdRWEp5WVhrdVpuSnZiU2hwZEdWdFRXRndMbXRsZVhNb0tTazdYRzRnSUgwN1hHNWNiaUFnWVdSa1VtOXZkQ0E5SUdaMWJtTjBhVzl1SUNocFpDa2dlMXh1SUNBZ0lISnZiM1JKUkZObGRDNWhaR1FvYVdRcE8xeHVJQ0I5TzF4dUlDQnlaVzF2ZG1WU2IyOTBJRDBnWm5WdVkzUnBiMjRnS0dsa0tTQjdYRzRnSUNBZ2NtOXZkRWxFVTJWMFd5ZGtaV3hsZEdVblhTaHBaQ2s3WEc0Z0lIMDdYRzRnSUdkbGRGSnZiM1JKUkhNZ1BTQm1kVzVqZEdsdmJpQW9LU0I3WEc0Z0lDQWdjbVYwZFhKdUlFRnljbUY1TG1aeWIyMG9jbTl2ZEVsRVUyVjBMbXRsZVhNb0tTazdYRzRnSUgwN1hHNTlJR1ZzYzJVZ2UxeHVJQ0IyWVhJZ2FYUmxiVUo1UzJWNUlEMGdlMzA3WEc0Z0lIWmhjaUJ5YjI5MFFubExaWGtnUFNCN2ZUdGNibHh1SUNBdkx5QlZjMlVnYm05dUxXNTFiV1Z5YVdNZ2EyVjVjeUIwYnlCd2NtVjJaVzUwSUZZNElIQmxjbVp2Y20xaGJtTmxJR2x6YzNWbGN6cGNiaUFnTHk4Z2FIUjBjSE02THk5bmFYUm9kV0l1WTI5dEwyWmhZMlZpYjI5ckwzSmxZV04wTDNCMWJHd3ZOekl6TWx4dUlDQjJZWElnWjJWMFMyVjVSbkp2YlVsRUlEMGdablZ1WTNScGIyNGdLR2xrS1NCN1hHNGdJQ0FnY21WMGRYSnVJQ2N1SnlBcklHbGtPMXh1SUNCOU8xeHVJQ0IyWVhJZ1oyVjBTVVJHY205dFMyVjVJRDBnWm5WdVkzUnBiMjRnS0d0bGVTa2dlMXh1SUNBZ0lISmxkSFZ5YmlCd1lYSnpaVWx1ZENoclpYa3VjM1ZpYzNSeUtERXBMQ0F4TUNrN1hHNGdJSDA3WEc1Y2JpQWdjMlYwU1hSbGJTQTlJR1oxYm1OMGFXOXVJQ2hwWkN3Z2FYUmxiU2tnZTF4dUlDQWdJSFpoY2lCclpYa2dQU0JuWlhSTFpYbEdjbTl0U1VRb2FXUXBPMXh1SUNBZ0lHbDBaVzFDZVV0bGVWdHJaWGxkSUQwZ2FYUmxiVHRjYmlBZ2ZUdGNiaUFnWjJWMFNYUmxiU0E5SUdaMWJtTjBhVzl1SUNocFpDa2dlMXh1SUNBZ0lIWmhjaUJyWlhrZ1BTQm5aWFJMWlhsR2NtOXRTVVFvYVdRcE8xeHVJQ0FnSUhKbGRIVnliaUJwZEdWdFFubExaWGxiYTJWNVhUdGNiaUFnZlR0Y2JpQWdjbVZ0YjNabFNYUmxiU0E5SUdaMWJtTjBhVzl1SUNocFpDa2dlMXh1SUNBZ0lIWmhjaUJyWlhrZ1BTQm5aWFJMWlhsR2NtOXRTVVFvYVdRcE8xeHVJQ0FnSUdSbGJHVjBaU0JwZEdWdFFubExaWGxiYTJWNVhUdGNiaUFnZlR0Y2JpQWdaMlYwU1hSbGJVbEVjeUE5SUdaMWJtTjBhVzl1SUNncElIdGNiaUFnSUNCeVpYUjFjbTRnVDJKcVpXTjBMbXRsZVhNb2FYUmxiVUo1UzJWNUtTNXRZWEFvWjJWMFNVUkdjbTl0UzJWNUtUdGNiaUFnZlR0Y2JseHVJQ0JoWkdSU2IyOTBJRDBnWm5WdVkzUnBiMjRnS0dsa0tTQjdYRzRnSUNBZ2RtRnlJR3RsZVNBOUlHZGxkRXRsZVVaeWIyMUpSQ2hwWkNrN1hHNGdJQ0FnY205dmRFSjVTMlY1VzJ0bGVWMGdQU0IwY25WbE8xeHVJQ0I5TzF4dUlDQnlaVzF2ZG1WU2IyOTBJRDBnWm5WdVkzUnBiMjRnS0dsa0tTQjdYRzRnSUNBZ2RtRnlJR3RsZVNBOUlHZGxkRXRsZVVaeWIyMUpSQ2hwWkNrN1hHNGdJQ0FnWkdWc1pYUmxJSEp2YjNSQ2VVdGxlVnRyWlhsZE8xeHVJQ0I5TzF4dUlDQm5aWFJTYjI5MFNVUnpJRDBnWm5WdVkzUnBiMjRnS0NrZ2UxeHVJQ0FnSUhKbGRIVnliaUJQWW1wbFkzUXVhMlY1Y3loeWIyOTBRbmxMWlhrcExtMWhjQ2huWlhSSlJFWnliMjFMWlhrcE8xeHVJQ0I5TzF4dWZWeHVYRzUyWVhJZ2RXNXRiM1Z1ZEdWa1NVUnpJRDBnVzEwN1hHNWNibVoxYm1OMGFXOXVJSEIxY21kbFJHVmxjQ2hwWkNrZ2UxeHVJQ0IyWVhJZ2FYUmxiU0E5SUdkbGRFbDBaVzBvYVdRcE8xeHVJQ0JwWmlBb2FYUmxiU2tnZTF4dUlDQWdJSFpoY2lCamFHbHNaRWxFY3lBOUlHbDBaVzB1WTJocGJHUkpSSE03WEc1Y2JpQWdJQ0J5WlcxdmRtVkpkR1Z0S0dsa0tUdGNiaUFnSUNCamFHbHNaRWxFY3k1bWIzSkZZV05vS0hCMWNtZGxSR1ZsY0NrN1hHNGdJSDFjYm4xY2JseHVablZ1WTNScGIyNGdaR1Z6WTNKcFltVkRiMjF3YjI1bGJuUkdjbUZ0WlNodVlXMWxMQ0J6YjNWeVkyVXNJRzkzYm1WeVRtRnRaU2tnZTF4dUlDQnlaWFIxY200Z0oxeGNiaUFnSUNCcGJpQW5JQ3NnS0c1aGJXVWdmSHdnSjFWdWEyNXZkMjRuS1NBcklDaHpiM1Z5WTJVZ1B5QW5JQ2hoZENBbklDc2djMjkxY21ObExtWnBiR1ZPWVcxbExuSmxjR3hoWTJVb0wxNHVLbHRjWEZ4Y1hGd3ZYUzhzSUNjbktTQXJJQ2M2SnlBcklITnZkWEpqWlM1c2FXNWxUblZ0WW1WeUlDc2dKeWtuSURvZ2IzZHVaWEpPWVcxbElEOGdKeUFvWTNKbFlYUmxaQ0JpZVNBbklDc2diM2R1WlhKT1lXMWxJQ3NnSnlrbklEb2dKeWNwTzF4dWZWeHVYRzVtZFc1amRHbHZiaUJuWlhSRWFYTndiR0Y1VG1GdFpTaGxiR1Z0Wlc1MEtTQjdYRzRnSUdsbUlDaGxiR1Z0Wlc1MElEMDlJRzUxYkd3cElIdGNiaUFnSUNCeVpYUjFjbTRnSnlObGJYQjBlU2M3WEc0Z0lIMGdaV3h6WlNCcFppQW9kSGx3Wlc5bUlHVnNaVzFsYm5RZ1BUMDlJQ2R6ZEhKcGJtY25JSHg4SUhSNWNHVnZaaUJsYkdWdFpXNTBJRDA5UFNBbmJuVnRZbVZ5SnlrZ2UxeHVJQ0FnSUhKbGRIVnliaUFuSTNSbGVIUW5PMXh1SUNCOUlHVnNjMlVnYVdZZ0tIUjVjR1Z2WmlCbGJHVnRaVzUwTG5SNWNHVWdQVDA5SUNkemRISnBibWNuS1NCN1hHNGdJQ0FnY21WMGRYSnVJR1ZzWlcxbGJuUXVkSGx3WlR0Y2JpQWdmU0JsYkhObElIdGNiaUFnSUNCeVpYUjFjbTRnWld4bGJXVnVkQzUwZVhCbExtUnBjM0JzWVhsT1lXMWxJSHg4SUdWc1pXMWxiblF1ZEhsd1pTNXVZVzFsSUh4OElDZFZibXR1YjNkdUp6dGNiaUFnZlZ4dWZWeHVYRzVtZFc1amRHbHZiaUJrWlhOamNtbGlaVWxFS0dsa0tTQjdYRzRnSUhaaGNpQnVZVzFsSUQwZ1VtVmhZM1JEYjIxd2IyNWxiblJVY21WbFNHOXZheTVuWlhSRWFYTndiR0Y1VG1GdFpTaHBaQ2s3WEc0Z0lIWmhjaUJsYkdWdFpXNTBJRDBnVW1WaFkzUkRiMjF3YjI1bGJuUlVjbVZsU0c5dmF5NW5aWFJGYkdWdFpXNTBLR2xrS1R0Y2JpQWdkbUZ5SUc5M2JtVnlTVVFnUFNCU1pXRmpkRU52YlhCdmJtVnVkRlJ5WldWSWIyOXJMbWRsZEU5M2JtVnlTVVFvYVdRcE8xeHVJQ0IyWVhJZ2IzZHVaWEpPWVcxbE8xeHVJQ0JwWmlBb2IzZHVaWEpKUkNrZ2UxeHVJQ0FnSUc5M2JtVnlUbUZ0WlNBOUlGSmxZV04wUTI5dGNHOXVaVzUwVkhKbFpVaHZiMnN1WjJWMFJHbHpjR3hoZVU1aGJXVW9iM2R1WlhKSlJDazdYRzRnSUgxY2JpQWdjSEp2WTJWemN5NWxibll1VGs5RVJWOUZUbFlnSVQwOUlDZHdjbTlrZFdOMGFXOXVKeUEvSUhkaGNtNXBibWNvWld4bGJXVnVkQ3dnSjFKbFlXTjBRMjl0Y0c5dVpXNTBWSEpsWlVodmIyczZJRTFwYzNOcGJtY2dVbVZoWTNRZ1pXeGxiV1Z1ZENCbWIzSWdaR1ZpZFdkSlJDQWxjeUIzYUdWdUlDY2dLeUFuWW5WcGJHUnBibWNnYzNSaFkyc25MQ0JwWkNrZ09pQjJiMmxrSURBN1hHNGdJSEpsZEhWeWJpQmtaWE5qY21saVpVTnZiWEJ2Ym1WdWRFWnlZVzFsS0c1aGJXVXNJR1ZzWlcxbGJuUWdKaVlnWld4bGJXVnVkQzVmYzI5MWNtTmxMQ0J2ZDI1bGNrNWhiV1VwTzF4dWZWeHVYRzUyWVhJZ1VtVmhZM1JEYjIxd2IyNWxiblJVY21WbFNHOXZheUE5SUh0Y2JpQWdiMjVUWlhSRGFHbHNaSEpsYmpvZ1puVnVZM1JwYjI0Z0tHbGtMQ0J1WlhoMFEyaHBiR1JKUkhNcElIdGNiaUFnSUNCMllYSWdhWFJsYlNBOUlHZGxkRWwwWlcwb2FXUXBPMXh1SUNBZ0lDRnBkR1Z0SUQ4Z2NISnZZMlZ6Y3k1bGJuWXVUazlFUlY5RlRsWWdJVDA5SUNkd2NtOWtkV04wYVc5dUp5QS9JR2x1ZG1GeWFXRnVkQ2htWVd4elpTd2dKMGwwWlcwZ2JYVnpkQ0JvWVhabElHSmxaVzRnYzJWMEp5a2dPaUJmY0hKdlpFbHVkbUZ5YVdGdWRDZ25NVFEwSnlrZ09pQjJiMmxrSURBN1hHNGdJQ0FnYVhSbGJTNWphR2xzWkVsRWN5QTlJRzVsZUhSRGFHbHNaRWxFY3p0Y2JseHVJQ0FnSUdadmNpQW9kbUZ5SUdrZ1BTQXdPeUJwSUR3Z2JtVjRkRU5vYVd4a1NVUnpMbXhsYm1kMGFEc2dhU3NyS1NCN1hHNGdJQ0FnSUNCMllYSWdibVY0ZEVOb2FXeGtTVVFnUFNCdVpYaDBRMmhwYkdSSlJITmJhVjA3WEc0Z0lDQWdJQ0IyWVhJZ2JtVjRkRU5vYVd4a0lEMGdaMlYwU1hSbGJTaHVaWGgwUTJocGJHUkpSQ2s3WEc0Z0lDQWdJQ0FoYm1WNGRFTm9hV3hrSUQ4Z2NISnZZMlZ6Y3k1bGJuWXVUazlFUlY5RlRsWWdJVDA5SUNkd2NtOWtkV04wYVc5dUp5QS9JR2x1ZG1GeWFXRnVkQ2htWVd4elpTd2dKMFY0Y0dWamRHVmtJR2h2YjJzZ1pYWmxiblJ6SUhSdklHWnBjbVVnWm05eUlIUm9aU0JqYUdsc1pDQmlaV1p2Y21VZ2FYUnpJSEJoY21WdWRDQnBibU5zZFdSbGN5QnBkQ0JwYmlCdmJsTmxkRU5vYVd4a2NtVnVLQ2t1SnlrZ09pQmZjSEp2WkVsdWRtRnlhV0Z1ZENnbk1UUXdKeWtnT2lCMmIybGtJREE3WEc0Z0lDQWdJQ0FoS0c1bGVIUkRhR2xzWkM1amFHbHNaRWxFY3lBaFBTQnVkV3hzSUh4OElIUjVjR1Z2WmlCdVpYaDBRMmhwYkdRdVpXeGxiV1Z1ZENBaFBUMGdKMjlpYW1WamRDY2dmSHdnYm1WNGRFTm9hV3hrTG1Wc1pXMWxiblFnUFQwZ2JuVnNiQ2tnUHlCd2NtOWpaWE56TG1WdWRpNU9UMFJGWDBWT1ZpQWhQVDBnSjNCeWIyUjFZM1JwYjI0bklEOGdhVzUyWVhKcFlXNTBLR1poYkhObExDQW5SWGh3WldOMFpXUWdiMjVUWlhSRGFHbHNaSEpsYmlncElIUnZJR1pwY21VZ1ptOXlJR0VnWTI5dWRHRnBibVZ5SUdOb2FXeGtJR0psWm05eVpTQnBkSE1nY0dGeVpXNTBJR2x1WTJ4MVpHVnpJR2wwSUdsdUlHOXVVMlYwUTJocGJHUnlaVzRvS1M0bktTQTZJRjl3Y205a1NXNTJZWEpwWVc1MEtDY3hOREVuS1NBNklIWnZhV1FnTUR0Y2JpQWdJQ0FnSUNGdVpYaDBRMmhwYkdRdWFYTk5iM1Z1ZEdWa0lEOGdjSEp2WTJWemN5NWxibll1VGs5RVJWOUZUbFlnSVQwOUlDZHdjbTlrZFdOMGFXOXVKeUEvSUdsdWRtRnlhV0Z1ZENobVlXeHpaU3dnSjBWNGNHVmpkR1ZrSUc5dVRXOTFiblJEYjIxd2IyNWxiblFvS1NCMGJ5Qm1hWEpsSUdadmNpQjBhR1VnWTJocGJHUWdZbVZtYjNKbElHbDBjeUJ3WVhKbGJuUWdhVzVqYkhWa1pYTWdhWFFnYVc0Z2IyNVRaWFJEYUdsc1pISmxiaWdwTGljcElEb2dYM0J5YjJSSmJuWmhjbWxoYm5Rb0p6Y3hKeWtnT2lCMmIybGtJREE3WEc0Z0lDQWdJQ0JwWmlBb2JtVjRkRU5vYVd4a0xuQmhjbVZ1ZEVsRUlEMDlJRzUxYkd3cElIdGNiaUFnSUNBZ0lDQWdibVY0ZEVOb2FXeGtMbkJoY21WdWRFbEVJRDBnYVdRN1hHNGdJQ0FnSUNBZ0lDOHZJRlJQUkU4NklGUm9hWE1nYzJodmRXeGtiaWQwSUdKbElHNWxZMlZ6YzJGeWVTQmlkWFFnYlc5MWJuUnBibWNnWVNCdVpYY2djbTl2ZENCa2RYSnBibWNnYVc1Y2JpQWdJQ0FnSUNBZ0x5OGdZMjl0Y0c5dVpXNTBWMmxzYkUxdmRXNTBJR04xY25KbGJuUnNlU0JqWVhWelpYTWdibTkwTFhsbGRDMXRiM1Z1ZEdWa0lHTnZiWEJ2Ym1WdWRITWdkRzljYmlBZ0lDQWdJQ0FnTHk4Z1ltVWdjSFZ5WjJWa0lHWnliMjBnYjNWeUlIUnlaV1VnWkdGMFlTQnpieUIwYUdWcGNpQndZWEpsYm5RZ2FXUWdhWE1nYldsemMybHVaeTVjYmlBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0VvYm1WNGRFTm9hV3hrTG5CaGNtVnVkRWxFSUQwOVBTQnBaQ2tnUHlCd2NtOWpaWE56TG1WdWRpNU9UMFJGWDBWT1ZpQWhQVDBnSjNCeWIyUjFZM1JwYjI0bklEOGdhVzUyWVhKcFlXNTBLR1poYkhObExDQW5SWGh3WldOMFpXUWdiMjVDWldadmNtVk5iM1Z1ZEVOdmJYQnZibVZ1ZENncElIQmhjbVZ1ZENCaGJtUWdiMjVUWlhSRGFHbHNaSEpsYmlncElIUnZJR0psSUdOdmJuTnBjM1JsYm5RZ0tDVnpJR2hoY3lCd1lYSmxiblJ6SUNWeklHRnVaQ0FsY3lrdUp5d2dibVY0ZEVOb2FXeGtTVVFzSUc1bGVIUkRhR2xzWkM1d1lYSmxiblJKUkN3Z2FXUXBJRG9nWDNCeWIyUkpiblpoY21saGJuUW9KekUwTWljc0lHNWxlSFJEYUdsc1pFbEVMQ0J1WlhoMFEyaHBiR1F1Y0dGeVpXNTBTVVFzSUdsa0tTQTZJSFp2YVdRZ01EdGNiaUFnSUNCOVhHNGdJSDBzWEc0Z0lHOXVRbVZtYjNKbFRXOTFiblJEYjIxd2IyNWxiblE2SUdaMWJtTjBhVzl1SUNocFpDd2daV3hsYldWdWRDd2djR0Z5Wlc1MFNVUXBJSHRjYmlBZ0lDQjJZWElnYVhSbGJTQTlJSHRjYmlBZ0lDQWdJR1ZzWlcxbGJuUTZJR1ZzWlcxbGJuUXNYRzRnSUNBZ0lDQndZWEpsYm5SSlJEb2djR0Z5Wlc1MFNVUXNYRzRnSUNBZ0lDQjBaWGgwT2lCdWRXeHNMRnh1SUNBZ0lDQWdZMmhwYkdSSlJITTZJRnRkTEZ4dUlDQWdJQ0FnYVhOTmIzVnVkR1ZrT2lCbVlXeHpaU3hjYmlBZ0lDQWdJSFZ3WkdGMFpVTnZkVzUwT2lBd1hHNGdJQ0FnZlR0Y2JpQWdJQ0J6WlhSSmRHVnRLR2xrTENCcGRHVnRLVHRjYmlBZ2ZTeGNiaUFnYjI1Q1pXWnZjbVZWY0dSaGRHVkRiMjF3YjI1bGJuUTZJR1oxYm1OMGFXOXVJQ2hwWkN3Z1pXeGxiV1Z1ZENrZ2UxeHVJQ0FnSUhaaGNpQnBkR1Z0SUQwZ1oyVjBTWFJsYlNocFpDazdYRzRnSUNBZ2FXWWdLQ0ZwZEdWdElIeDhJQ0ZwZEdWdExtbHpUVzkxYm5SbFpDa2dlMXh1SUNBZ0lDQWdMeThnVjJVZ2JXRjVJR1Z1WkNCMWNDQm9aWEpsSUdGeklHRWdjbVZ6ZFd4MElHOW1JSE5sZEZOMFlYUmxLQ2tnYVc0Z1kyOXRjRzl1Wlc1MFYybHNiRlZ1Ylc5MWJuUW9LUzVjYmlBZ0lDQWdJQzh2SUVsdUlIUm9hWE1nWTJGelpTd2dhV2R1YjNKbElIUm9aU0JsYkdWdFpXNTBMbHh1SUNBZ0lDQWdjbVYwZFhKdU8xeHVJQ0FnSUgxY2JpQWdJQ0JwZEdWdExtVnNaVzFsYm5RZ1BTQmxiR1Z0Wlc1ME8xeHVJQ0I5TEZ4dUlDQnZiazF2ZFc1MFEyOXRjRzl1Wlc1ME9pQm1kVzVqZEdsdmJpQW9hV1FwSUh0Y2JpQWdJQ0IyWVhJZ2FYUmxiU0E5SUdkbGRFbDBaVzBvYVdRcE8xeHVJQ0FnSUNGcGRHVnRJRDhnY0hKdlkyVnpjeTVsYm5ZdVRrOUVSVjlGVGxZZ0lUMDlJQ2R3Y205a2RXTjBhVzl1SnlBL0lHbHVkbUZ5YVdGdWRDaG1ZV3h6WlN3Z0owbDBaVzBnYlhWemRDQm9ZWFpsSUdKbFpXNGdjMlYwSnlrZ09pQmZjSEp2WkVsdWRtRnlhV0Z1ZENnbk1UUTBKeWtnT2lCMmIybGtJREE3WEc0Z0lDQWdhWFJsYlM1cGMwMXZkVzUwWldRZ1BTQjBjblZsTzF4dUlDQWdJSFpoY2lCcGMxSnZiM1FnUFNCcGRHVnRMbkJoY21WdWRFbEVJRDA5UFNBd08xeHVJQ0FnSUdsbUlDaHBjMUp2YjNRcElIdGNiaUFnSUNBZ0lHRmtaRkp2YjNRb2FXUXBPMXh1SUNBZ0lIMWNiaUFnZlN4Y2JpQWdiMjVWY0dSaGRHVkRiMjF3YjI1bGJuUTZJR1oxYm1OMGFXOXVJQ2hwWkNrZ2UxeHVJQ0FnSUhaaGNpQnBkR1Z0SUQwZ1oyVjBTWFJsYlNocFpDazdYRzRnSUNBZ2FXWWdLQ0ZwZEdWdElIeDhJQ0ZwZEdWdExtbHpUVzkxYm5SbFpDa2dlMXh1SUNBZ0lDQWdMeThnVjJVZ2JXRjVJR1Z1WkNCMWNDQm9aWEpsSUdGeklHRWdjbVZ6ZFd4MElHOW1JSE5sZEZOMFlYUmxLQ2tnYVc0Z1kyOXRjRzl1Wlc1MFYybHNiRlZ1Ylc5MWJuUW9LUzVjYmlBZ0lDQWdJQzh2SUVsdUlIUm9hWE1nWTJGelpTd2dhV2R1YjNKbElIUm9aU0JsYkdWdFpXNTBMbHh1SUNBZ0lDQWdjbVYwZFhKdU8xeHVJQ0FnSUgxY2JpQWdJQ0JwZEdWdExuVndaR0YwWlVOdmRXNTBLeXM3WEc0Z0lIMHNYRzRnSUc5dVZXNXRiM1Z1ZEVOdmJYQnZibVZ1ZERvZ1puVnVZM1JwYjI0Z0tHbGtLU0I3WEc0Z0lDQWdkbUZ5SUdsMFpXMGdQU0JuWlhSSmRHVnRLR2xrS1R0Y2JpQWdJQ0JwWmlBb2FYUmxiU2tnZTF4dUlDQWdJQ0FnTHk4Z1YyVWdibVZsWkNCMGJ5QmphR1ZqYXlCcFppQnBkQ0JsZUdsemRITXVYRzRnSUNBZ0lDQXZMeUJnYVhSbGJXQWdiV2xuYUhRZ2JtOTBJR1Y0YVhOMElHbG1JR2wwSUdseklHbHVjMmxrWlNCaGJpQmxjbkp2Y2lCaWIzVnVaR0Z5ZVN3Z1lXNWtJR0VnYzJsaWJHbHVaMXh1SUNBZ0lDQWdMeThnWlhKeWIzSWdZbTkxYm1SaGNua2dZMmhwYkdRZ2RHaHlaWGNnZDJocGJHVWdiVzkxYm5ScGJtY3VJRlJvWlc0Z2RHaHBjeUJwYm5OMFlXNWpaU0J1WlhabGNseHVJQ0FnSUNBZ0x5OGdaMjkwSUdFZ1kyaGhibU5sSUhSdklHMXZkVzUwTENCaWRYUWdhWFFnYzNScGJHd2daMlYwY3lCaGJpQjFibTF2ZFc1MGFXNW5JR1YyWlc1MElHUjFjbWx1WjF4dUlDQWdJQ0FnTHk4Z2RHaGxJR1Z5Y205eUlHSnZkVzVrWVhKNUlHTnNaV0Z1ZFhBdVhHNGdJQ0FnSUNCcGRHVnRMbWx6VFc5MWJuUmxaQ0E5SUdaaGJITmxPMXh1SUNBZ0lDQWdkbUZ5SUdselVtOXZkQ0E5SUdsMFpXMHVjR0Z5Wlc1MFNVUWdQVDA5SURBN1hHNGdJQ0FnSUNCcFppQW9hWE5TYjI5MEtTQjdYRzRnSUNBZ0lDQWdJSEpsYlc5MlpWSnZiM1FvYVdRcE8xeHVJQ0FnSUNBZ2ZWeHVJQ0FnSUgxY2JpQWdJQ0IxYm0xdmRXNTBaV1JKUkhNdWNIVnphQ2hwWkNrN1hHNGdJSDBzWEc0Z0lIQjFjbWRsVlc1dGIzVnVkR1ZrUTI5dGNHOXVaVzUwY3pvZ1puVnVZM1JwYjI0Z0tDa2dlMXh1SUNBZ0lHbG1JQ2hTWldGamRFTnZiWEJ2Ym1WdWRGUnlaV1ZJYjI5ckxsOXdjbVYyWlc1MFVIVnlaMmx1WnlrZ2UxeHVJQ0FnSUNBZ0x5OGdVMmh2ZFd4a0lHOXViSGtnWW1VZ2RYTmxaQ0JtYjNJZ2RHVnpkR2x1Wnk1Y2JpQWdJQ0FnSUhKbGRIVnlianRjYmlBZ0lDQjlYRzVjYmlBZ0lDQm1iM0lnS0haaGNpQnBJRDBnTURzZ2FTQThJSFZ1Ylc5MWJuUmxaRWxFY3k1c1pXNW5kR2c3SUdrckt5a2dlMXh1SUNBZ0lDQWdkbUZ5SUdsa0lEMGdkVzV0YjNWdWRHVmtTVVJ6VzJsZE8xeHVJQ0FnSUNBZ2NIVnlaMlZFWldWd0tHbGtLVHRjYmlBZ0lDQjlYRzRnSUNBZ2RXNXRiM1Z1ZEdWa1NVUnpMbXhsYm1kMGFDQTlJREE3WEc0Z0lIMHNYRzRnSUdselRXOTFiblJsWkRvZ1puVnVZM1JwYjI0Z0tHbGtLU0I3WEc0Z0lDQWdkbUZ5SUdsMFpXMGdQU0JuWlhSSmRHVnRLR2xrS1R0Y2JpQWdJQ0J5WlhSMWNtNGdhWFJsYlNBL0lHbDBaVzB1YVhOTmIzVnVkR1ZrSURvZ1ptRnNjMlU3WEc0Z0lIMHNYRzRnSUdkbGRFTjFjbkpsYm5SVGRHRmphMEZrWkdWdVpIVnRPaUJtZFc1amRHbHZiaUFvZEc5d1JXeGxiV1Z1ZENrZ2UxeHVJQ0FnSUhaaGNpQnBibVp2SUQwZ0p5YzdYRzRnSUNBZ2FXWWdLSFJ2Y0VWc1pXMWxiblFwSUh0Y2JpQWdJQ0FnSUhaaGNpQnVZVzFsSUQwZ1oyVjBSR2x6Y0d4aGVVNWhiV1VvZEc5d1JXeGxiV1Z1ZENrN1hHNGdJQ0FnSUNCMllYSWdiM2R1WlhJZ1BTQjBiM0JGYkdWdFpXNTBMbDl2ZDI1bGNqdGNiaUFnSUNBZ0lHbHVabThnS3owZ1pHVnpZM0pwWW1WRGIyMXdiMjVsYm5SR2NtRnRaU2h1WVcxbExDQjBiM0JGYkdWdFpXNTBMbDl6YjNWeVkyVXNJRzkzYm1WeUlDWW1JRzkzYm1WeUxtZGxkRTVoYldVb0tTazdYRzRnSUNBZ2ZWeHVYRzRnSUNBZ2RtRnlJR04xY25KbGJuUlBkMjVsY2lBOUlGSmxZV04wUTNWeWNtVnVkRTkzYm1WeUxtTjFjbkpsYm5RN1hHNGdJQ0FnZG1GeUlHbGtJRDBnWTNWeWNtVnVkRTkzYm1WeUlDWW1JR04xY25KbGJuUlBkMjVsY2k1ZlpHVmlkV2RKUkR0Y2JseHVJQ0FnSUdsdVptOGdLejBnVW1WaFkzUkRiMjF3YjI1bGJuUlVjbVZsU0c5dmF5NW5aWFJUZEdGamEwRmtaR1Z1WkhWdFFubEpSQ2hwWkNrN1hHNGdJQ0FnY21WMGRYSnVJR2x1Wm04N1hHNGdJSDBzWEc0Z0lHZGxkRk4wWVdOclFXUmtaVzVrZFcxQ2VVbEVPaUJtZFc1amRHbHZiaUFvYVdRcElIdGNiaUFnSUNCMllYSWdhVzVtYnlBOUlDY25PMXh1SUNBZ0lIZG9hV3hsSUNocFpDa2dlMXh1SUNBZ0lDQWdhVzVtYnlBclBTQmtaWE5qY21saVpVbEVLR2xrS1R0Y2JpQWdJQ0FnSUdsa0lEMGdVbVZoWTNSRGIyMXdiMjVsYm5SVWNtVmxTRzl2YXk1blpYUlFZWEpsYm5SSlJDaHBaQ2s3WEc0Z0lDQWdmVnh1SUNBZ0lISmxkSFZ5YmlCcGJtWnZPMXh1SUNCOUxGeHVJQ0JuWlhSRGFHbHNaRWxFY3pvZ1puVnVZM1JwYjI0Z0tHbGtLU0I3WEc0Z0lDQWdkbUZ5SUdsMFpXMGdQU0JuWlhSSmRHVnRLR2xrS1R0Y2JpQWdJQ0J5WlhSMWNtNGdhWFJsYlNBL0lHbDBaVzB1WTJocGJHUkpSSE1nT2lCYlhUdGNiaUFnZlN4Y2JpQWdaMlYwUkdsemNHeGhlVTVoYldVNklHWjFibU4wYVc5dUlDaHBaQ2tnZTF4dUlDQWdJSFpoY2lCbGJHVnRaVzUwSUQwZ1VtVmhZM1JEYjIxd2IyNWxiblJVY21WbFNHOXZheTVuWlhSRmJHVnRaVzUwS0dsa0tUdGNiaUFnSUNCcFppQW9JV1ZzWlcxbGJuUXBJSHRjYmlBZ0lDQWdJSEpsZEhWeWJpQnVkV3hzTzF4dUlDQWdJSDFjYmlBZ0lDQnlaWFIxY200Z1oyVjBSR2x6Y0d4aGVVNWhiV1VvWld4bGJXVnVkQ2s3WEc0Z0lIMHNYRzRnSUdkbGRFVnNaVzFsYm5RNklHWjFibU4wYVc5dUlDaHBaQ2tnZTF4dUlDQWdJSFpoY2lCcGRHVnRJRDBnWjJWMFNYUmxiU2hwWkNrN1hHNGdJQ0FnY21WMGRYSnVJR2wwWlcwZ1B5QnBkR1Z0TG1Wc1pXMWxiblFnT2lCdWRXeHNPMXh1SUNCOUxGeHVJQ0JuWlhSUGQyNWxja2xFT2lCbWRXNWpkR2x2YmlBb2FXUXBJSHRjYmlBZ0lDQjJZWElnWld4bGJXVnVkQ0E5SUZKbFlXTjBRMjl0Y0c5dVpXNTBWSEpsWlVodmIyc3VaMlYwUld4bGJXVnVkQ2hwWkNrN1hHNGdJQ0FnYVdZZ0tDRmxiR1Z0Wlc1MElIeDhJQ0ZsYkdWdFpXNTBMbDl2ZDI1bGNpa2dlMXh1SUNBZ0lDQWdjbVYwZFhKdUlHNTFiR3c3WEc0Z0lDQWdmVnh1SUNBZ0lISmxkSFZ5YmlCbGJHVnRaVzUwTGw5dmQyNWxjaTVmWkdWaWRXZEpSRHRjYmlBZ2ZTeGNiaUFnWjJWMFVHRnlaVzUwU1VRNklHWjFibU4wYVc5dUlDaHBaQ2tnZTF4dUlDQWdJSFpoY2lCcGRHVnRJRDBnWjJWMFNYUmxiU2hwWkNrN1hHNGdJQ0FnY21WMGRYSnVJR2wwWlcwZ1B5QnBkR1Z0TG5CaGNtVnVkRWxFSURvZ2JuVnNiRHRjYmlBZ2ZTeGNiaUFnWjJWMFUyOTFjbU5sT2lCbWRXNWpkR2x2YmlBb2FXUXBJSHRjYmlBZ0lDQjJZWElnYVhSbGJTQTlJR2RsZEVsMFpXMG9hV1FwTzF4dUlDQWdJSFpoY2lCbGJHVnRaVzUwSUQwZ2FYUmxiU0EvSUdsMFpXMHVaV3hsYldWdWRDQTZJRzUxYkd3N1hHNGdJQ0FnZG1GeUlITnZkWEpqWlNBOUlHVnNaVzFsYm5RZ0lUMGdiblZzYkNBL0lHVnNaVzFsYm5RdVgzTnZkWEpqWlNBNklHNTFiR3c3WEc0Z0lDQWdjbVYwZFhKdUlITnZkWEpqWlR0Y2JpQWdmU3hjYmlBZ1oyVjBWR1Y0ZERvZ1puVnVZM1JwYjI0Z0tHbGtLU0I3WEc0Z0lDQWdkbUZ5SUdWc1pXMWxiblFnUFNCU1pXRmpkRU52YlhCdmJtVnVkRlJ5WldWSWIyOXJMbWRsZEVWc1pXMWxiblFvYVdRcE8xeHVJQ0FnSUdsbUlDaDBlWEJsYjJZZ1pXeGxiV1Z1ZENBOVBUMGdKM04wY21sdVp5Y3BJSHRjYmlBZ0lDQWdJSEpsZEhWeWJpQmxiR1Z0Wlc1ME8xeHVJQ0FnSUgwZ1pXeHpaU0JwWmlBb2RIbHdaVzltSUdWc1pXMWxiblFnUFQwOUlDZHVkVzFpWlhJbktTQjdYRzRnSUNBZ0lDQnlaWFIxY200Z0p5Y2dLeUJsYkdWdFpXNTBPMXh1SUNBZ0lIMGdaV3h6WlNCN1hHNGdJQ0FnSUNCeVpYUjFjbTRnYm5Wc2JEdGNiaUFnSUNCOVhHNGdJSDBzWEc0Z0lHZGxkRlZ3WkdGMFpVTnZkVzUwT2lCbWRXNWpkR2x2YmlBb2FXUXBJSHRjYmlBZ0lDQjJZWElnYVhSbGJTQTlJR2RsZEVsMFpXMG9hV1FwTzF4dUlDQWdJSEpsZEhWeWJpQnBkR1Z0SUQ4Z2FYUmxiUzUxY0dSaGRHVkRiM1Z1ZENBNklEQTdYRzRnSUgwc1hHNWNibHh1SUNCblpYUlNiMjkwU1VSek9pQm5aWFJTYjI5MFNVUnpMRnh1SUNCblpYUlNaV2RwYzNSbGNtVmtTVVJ6T2lCblpYUkpkR1Z0U1VSekxGeHVYRzRnSUhCMWMyaE9iMjVUZEdGdVpHRnlaRmRoY201cGJtZFRkR0ZqYXpvZ1puVnVZM1JwYjI0Z0tHbHpRM0psWVhScGJtZEZiR1Z0Wlc1MExDQmpkWEp5Wlc1MFUyOTFjbU5sS1NCN1hHNGdJQ0FnYVdZZ0tIUjVjR1Z2WmlCamIyNXpiMnhsTG5KbFlXTjBVM1JoWTJzZ0lUMDlJQ2RtZFc1amRHbHZiaWNwSUh0Y2JpQWdJQ0FnSUhKbGRIVnlianRjYmlBZ0lDQjlYRzVjYmlBZ0lDQjJZWElnYzNSaFkyc2dQU0JiWFR0Y2JpQWdJQ0IyWVhJZ1kzVnljbVZ1ZEU5M2JtVnlJRDBnVW1WaFkzUkRkWEp5Wlc1MFQzZHVaWEl1WTNWeWNtVnVkRHRjYmlBZ0lDQjJZWElnYVdRZ1BTQmpkWEp5Wlc1MFQzZHVaWElnSmlZZ1kzVnljbVZ1ZEU5M2JtVnlMbDlrWldKMVowbEVPMXh1WEc0Z0lDQWdkSEo1SUh0Y2JpQWdJQ0FnSUdsbUlDaHBjME55WldGMGFXNW5SV3hsYldWdWRDa2dlMXh1SUNBZ0lDQWdJQ0J6ZEdGamF5NXdkWE5vS0h0Y2JpQWdJQ0FnSUNBZ0lDQnVZVzFsT2lCcFpDQS9JRkpsWVdOMFEyOXRjRzl1Wlc1MFZISmxaVWh2YjJzdVoyVjBSR2x6Y0d4aGVVNWhiV1VvYVdRcElEb2diblZzYkN4Y2JpQWdJQ0FnSUNBZ0lDQm1hV3hsVG1GdFpUb2dZM1Z5Y21WdWRGTnZkWEpqWlNBL0lHTjFjbkpsYm5SVGIzVnlZMlV1Wm1sc1pVNWhiV1VnT2lCdWRXeHNMRnh1SUNBZ0lDQWdJQ0FnSUd4cGJtVk9kVzFpWlhJNklHTjFjbkpsYm5SVGIzVnlZMlVnUHlCamRYSnlaVzUwVTI5MWNtTmxMbXhwYm1WT2RXMWlaWElnT2lCdWRXeHNYRzRnSUNBZ0lDQWdJSDBwTzF4dUlDQWdJQ0FnZlZ4dVhHNGdJQ0FnSUNCM2FHbHNaU0FvYVdRcElIdGNiaUFnSUNBZ0lDQWdkbUZ5SUdWc1pXMWxiblFnUFNCU1pXRmpkRU52YlhCdmJtVnVkRlJ5WldWSWIyOXJMbWRsZEVWc1pXMWxiblFvYVdRcE8xeHVJQ0FnSUNBZ0lDQjJZWElnY0dGeVpXNTBTVVFnUFNCU1pXRmpkRU52YlhCdmJtVnVkRlJ5WldWSWIyOXJMbWRsZEZCaGNtVnVkRWxFS0dsa0tUdGNiaUFnSUNBZ0lDQWdkbUZ5SUc5M2JtVnlTVVFnUFNCU1pXRmpkRU52YlhCdmJtVnVkRlJ5WldWSWIyOXJMbWRsZEU5M2JtVnlTVVFvYVdRcE8xeHVJQ0FnSUNBZ0lDQjJZWElnYjNkdVpYSk9ZVzFsSUQwZ2IzZHVaWEpKUkNBL0lGSmxZV04wUTI5dGNHOXVaVzUwVkhKbFpVaHZiMnN1WjJWMFJHbHpjR3hoZVU1aGJXVW9iM2R1WlhKSlJDa2dPaUJ1ZFd4c08xeHVJQ0FnSUNBZ0lDQjJZWElnYzI5MWNtTmxJRDBnWld4bGJXVnVkQ0FtSmlCbGJHVnRaVzUwTGw5emIzVnlZMlU3WEc0Z0lDQWdJQ0FnSUhOMFlXTnJMbkIxYzJnb2UxeHVJQ0FnSUNBZ0lDQWdJRzVoYldVNklHOTNibVZ5VG1GdFpTeGNiaUFnSUNBZ0lDQWdJQ0JtYVd4bFRtRnRaVG9nYzI5MWNtTmxJRDhnYzI5MWNtTmxMbVpwYkdWT1lXMWxJRG9nYm5Wc2JDeGNiaUFnSUNBZ0lDQWdJQ0JzYVc1bFRuVnRZbVZ5T2lCemIzVnlZMlVnUHlCemIzVnlZMlV1YkdsdVpVNTFiV0psY2lBNklHNTFiR3hjYmlBZ0lDQWdJQ0FnZlNrN1hHNGdJQ0FnSUNBZ0lHbGtJRDBnY0dGeVpXNTBTVVE3WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdmU0JqWVhSamFDQW9aWEp5S1NCN1hHNGdJQ0FnSUNBdkx5QkpiblJsY201aGJDQnpkR0YwWlNCcGN5QnRaWE56WldRZ2RYQXVYRzRnSUNBZ0lDQXZMeUJUZEc5d0lHSjFhV3hrYVc1bklIUm9aU0J6ZEdGamF5QW9hWFFuY3lCcWRYTjBJR0VnYm1salpTQjBieUJvWVhabEtTNWNiaUFnSUNCOVhHNWNiaUFnSUNCamIyNXpiMnhsTG5KbFlXTjBVM1JoWTJzb2MzUmhZMnNwTzF4dUlDQjlMRnh1SUNCd2IzQk9iMjVUZEdGdVpHRnlaRmRoY201cGJtZFRkR0ZqYXpvZ1puVnVZM1JwYjI0Z0tDa2dlMXh1SUNBZ0lHbG1JQ2gwZVhCbGIyWWdZMjl1YzI5c1pTNXlaV0ZqZEZOMFlXTnJSVzVrSUNFOVBTQW5ablZ1WTNScGIyNG5LU0I3WEc0Z0lDQWdJQ0J5WlhSMWNtNDdYRzRnSUNBZ2ZWeHVJQ0FnSUdOdmJuTnZiR1V1Y21WaFkzUlRkR0ZqYTBWdVpDZ3BPMXh1SUNCOVhHNTlPMXh1WEc1dGIyUjFiR1V1Wlhod2IzSjBjeUE5SUZKbFlXTjBRMjl0Y0c5dVpXNTBWSEpsWlVodmIyczdJaXdpTHlvcVhHNGdLaUJEYjNCNWNtbG5hSFFnTWpBeE15MXdjbVZ6Wlc1MExDQkdZV05sWW05dmF5d2dTVzVqTGx4dUlDb2dRV3hzSUhKcFoyaDBjeUJ5WlhObGNuWmxaQzVjYmlBcVhHNGdLaUJVYUdseklITnZkWEpqWlNCamIyUmxJR2x6SUd4cFkyVnVjMlZrSUhWdVpHVnlJSFJvWlNCQ1UwUXRjM1I1YkdVZ2JHbGpaVzV6WlNCbWIzVnVaQ0JwYmlCMGFHVmNiaUFxSUV4SlEwVk9VMFVnWm1sc1pTQnBiaUIwYUdVZ2NtOXZkQ0JrYVhKbFkzUnZjbmtnYjJZZ2RHaHBjeUJ6YjNWeVkyVWdkSEpsWlM0Z1FXNGdZV1JrYVhScGIyNWhiQ0JuY21GdWRGeHVJQ29nYjJZZ2NHRjBaVzUwSUhKcFoyaDBjeUJqWVc0Z1ltVWdabTkxYm1RZ2FXNGdkR2hsSUZCQlZFVk9WRk1nWm1sc1pTQnBiaUIwYUdVZ2MyRnRaU0JrYVhKbFkzUnZjbmt1WEc0Z0tseHVJQ29nWEc0Z0tpOWNibHh1SjNWelpTQnpkSEpwWTNRbk8xeHVYRzR2S2lwY2JpQXFJRXRsWlhCeklIUnlZV05ySUc5bUlIUm9aU0JqZFhKeVpXNTBJRzkzYm1WeUxseHVJQ3BjYmlBcUlGUm9aU0JqZFhKeVpXNTBJRzkzYm1WeUlHbHpJSFJvWlNCamIyMXdiMjVsYm5RZ2QyaHZJSE5vYjNWc1pDQnZkMjRnWVc1NUlHTnZiWEJ2Ym1WdWRITWdkR2hoZENCaGNtVmNiaUFxSUdOMWNuSmxiblJzZVNCaVpXbHVaeUJqYjI1emRISjFZM1JsWkM1Y2JpQXFMMXh1ZG1GeUlGSmxZV04wUTNWeWNtVnVkRTkzYm1WeUlEMGdlMXh1SUNBdktpcGNiaUFnSUNvZ1FHbHVkR1Z5Ym1Gc1hHNGdJQ0FxSUVCMGVYQmxJSHRTWldGamRFTnZiWEJ2Ym1WdWRIMWNiaUFnSUNvdlhHNGdJR04xY25KbGJuUTZJRzUxYkd4Y2JuMDdYRzVjYm0xdlpIVnNaUzVsZUhCdmNuUnpJRDBnVW1WaFkzUkRkWEp5Wlc1MFQzZHVaWEk3SWl3aUx5b3FYRzRnS2lCRGIzQjVjbWxuYUhRZ01qQXhNeTF3Y21WelpXNTBMQ0JHWVdObFltOXZheXdnU1c1akxseHVJQ29nUVd4c0lISnBaMmgwY3lCeVpYTmxjblpsWkM1Y2JpQXFYRzRnS2lCVWFHbHpJSE52ZFhKalpTQmpiMlJsSUdseklHeHBZMlZ1YzJWa0lIVnVaR1Z5SUhSb1pTQkNVMFF0YzNSNWJHVWdiR2xqWlc1elpTQm1iM1Z1WkNCcGJpQjBhR1ZjYmlBcUlFeEpRMFZPVTBVZ1ptbHNaU0JwYmlCMGFHVWdjbTl2ZENCa2FYSmxZM1J2Y25rZ2IyWWdkR2hwY3lCemIzVnlZMlVnZEhKbFpTNGdRVzRnWVdSa2FYUnBiMjVoYkNCbmNtRnVkRnh1SUNvZ2IyWWdjR0YwWlc1MElISnBaMmgwY3lCallXNGdZbVVnWm05MWJtUWdhVzRnZEdobElGQkJWRVZPVkZNZ1ptbHNaU0JwYmlCMGFHVWdjMkZ0WlNCa2FYSmxZM1J2Y25rdVhHNGdLbHh1SUNvdlhHNWNiaWQxYzJVZ2MzUnlhV04wSnp0Y2JseHVkbUZ5SUZKbFlXTjBSV3hsYldWdWRDQTlJSEpsY1hWcGNtVW9KeTR2VW1WaFkzUkZiR1Z0Wlc1MEp5azdYRzVjYmk4cUtseHVJQ29nUTNKbFlYUmxJR0VnWm1GamRHOXllU0IwYUdGMElHTnlaV0YwWlhNZ1NGUk5UQ0IwWVdjZ1pXeGxiV1Z1ZEhNdVhHNGdLbHh1SUNvZ1FIQnlhWFpoZEdWY2JpQXFMMXh1ZG1GeUlHTnlaV0YwWlVSUFRVWmhZM1J2Y25rZ1BTQlNaV0ZqZEVWc1pXMWxiblF1WTNKbFlYUmxSbUZqZEc5eWVUdGNibWxtSUNod2NtOWpaWE56TG1WdWRpNU9UMFJGWDBWT1ZpQWhQVDBnSjNCeWIyUjFZM1JwYjI0bktTQjdYRzRnSUhaaGNpQlNaV0ZqZEVWc1pXMWxiblJXWVd4cFpHRjBiM0lnUFNCeVpYRjFhWEpsS0NjdUwxSmxZV04wUld4bGJXVnVkRlpoYkdsa1lYUnZjaWNwTzF4dUlDQmpjbVZoZEdWRVQwMUdZV04wYjNKNUlEMGdVbVZoWTNSRmJHVnRaVzUwVm1Gc2FXUmhkRzl5TG1OeVpXRjBaVVpoWTNSdmNuazdYRzU5WEc1Y2JpOHFLbHh1SUNvZ1EzSmxZWFJsY3lCaElHMWhjSEJwYm1jZ1puSnZiU0J6ZFhCd2IzSjBaV1FnU0ZSTlRDQjBZV2R6SUhSdklHQlNaV0ZqZEVSUFRVTnZiWEJ2Ym1WdWRHQWdZMnhoYzNObGN5NWNiaUFxWEc0Z0tpQkFjSFZpYkdsalhHNGdLaTljYm5aaGNpQlNaV0ZqZEVSUFRVWmhZM1J2Y21sbGN5QTlJSHRjYmlBZ1lUb2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25ZU2NwTEZ4dUlDQmhZbUp5T2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkaFltSnlKeWtzWEc0Z0lHRmtaSEpsYzNNNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oyRmtaSEpsYzNNbktTeGNiaUFnWVhKbFlUb2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25ZWEpsWVNjcExGeHVJQ0JoY25ScFkyeGxPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2RoY25ScFkyeGxKeWtzWEc0Z0lHRnphV1JsT2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkaGMybGtaU2NwTEZ4dUlDQmhkV1JwYnpvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbllYVmthVzhuS1N4Y2JpQWdZam9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duWWljcExGeHVJQ0JpWVhObE9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZGlZWE5sSnlrc1hHNGdJR0prYVRvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnblltUnBKeWtzWEc0Z0lHSmtiem9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duWW1Sdkp5a3NYRzRnSUdKcFp6b2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25ZbWxuSnlrc1hHNGdJR0pzYjJOcmNYVnZkR1U2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjJKc2IyTnJjWFZ2ZEdVbktTeGNiaUFnWW05a2VUb2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25ZbTlrZVNjcExGeHVJQ0JpY2pvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnblluSW5LU3hjYmlBZ1luVjBkRzl1T2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkaWRYUjBiMjRuS1N4Y2JpQWdZMkZ1ZG1Gek9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZGpZVzUyWVhNbktTeGNiaUFnWTJGd2RHbHZiam9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duWTJGd2RHbHZiaWNwTEZ4dUlDQmphWFJsT2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkamFYUmxKeWtzWEc0Z0lHTnZaR1U2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjJOdlpHVW5LU3hjYmlBZ1kyOXNPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2RqYjJ3bktTeGNiaUFnWTI5c1ozSnZkWEE2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjJOdmJHZHliM1Z3Snlrc1hHNGdJR1JoZEdFNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oyUmhkR0VuS1N4Y2JpQWdaR0YwWVd4cGMzUTZJR055WldGMFpVUlBUVVpoWTNSdmNua29KMlJoZEdGc2FYTjBKeWtzWEc0Z0lHUmtPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2RrWkNjcExGeHVJQ0JrWld3NklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oyUmxiQ2NwTEZ4dUlDQmtaWFJoYVd4ek9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZGtaWFJoYVd4ekp5a3NYRzRnSUdSbWJqb2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25aR1p1Snlrc1hHNGdJR1JwWVd4dlp6b2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25aR2xoYkc5bkp5a3NYRzRnSUdScGRqb2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25aR2wySnlrc1hHNGdJR1JzT2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0Nka2JDY3BMRnh1SUNCa2REb2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25aSFFuS1N4Y2JpQWdaVzA2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjJWdEp5a3NYRzRnSUdWdFltVmtPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2RsYldKbFpDY3BMRnh1SUNCbWFXVnNaSE5sZERvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnblptbGxiR1J6WlhRbktTeGNiaUFnWm1sblkyRndkR2x2YmpvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnblptbG5ZMkZ3ZEdsdmJpY3BMRnh1SUNCbWFXZDFjbVU2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjJacFozVnlaU2NwTEZ4dUlDQm1iMjkwWlhJNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oyWnZiM1JsY2ljcExGeHVJQ0JtYjNKdE9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZG1iM0p0Snlrc1hHNGdJR2d4T2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0Nkb01TY3BMRnh1SUNCb01qb2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25hREluS1N4Y2JpQWdhRE02SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjJnekp5a3NYRzRnSUdnME9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZG9OQ2NwTEZ4dUlDQm9OVG9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duYURVbktTeGNiaUFnYURZNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oyZzJKeWtzWEc0Z0lHaGxZV1E2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjJobFlXUW5LU3hjYmlBZ2FHVmhaR1Z5T2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0Nkb1pXRmtaWEluS1N4Y2JpQWdhR2R5YjNWd09pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZG9aM0p2ZFhBbktTeGNiaUFnYUhJNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oyaHlKeWtzWEc0Z0lHaDBiV3c2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjJoMGJXd25LU3hjYmlBZ2FUb2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25hU2NwTEZ4dUlDQnBabkpoYldVNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oybG1jbUZ0WlNjcExGeHVJQ0JwYldjNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oybHRaeWNwTEZ4dUlDQnBibkIxZERvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbmFXNXdkWFFuS1N4Y2JpQWdhVzV6T2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkcGJuTW5LU3hjYmlBZ2EySmtPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2RyWW1RbktTeGNiaUFnYTJWNVoyVnVPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2RyWlhsblpXNG5LU3hjYmlBZ2JHRmlaV3c2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjJ4aFltVnNKeWtzWEc0Z0lHeGxaMlZ1WkRvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbmJHVm5aVzVrSnlrc1hHNGdJR3hwT2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0Nkc2FTY3BMRnh1SUNCc2FXNXJPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2RzYVc1ckp5a3NYRzRnSUcxaGFXNDZJR055WldGMFpVUlBUVVpoWTNSdmNua29KMjFoYVc0bktTeGNiaUFnYldGd09pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZHRZWEFuS1N4Y2JpQWdiV0Z5YXpvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbmJXRnlheWNwTEZ4dUlDQnRaVzUxT2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkdFpXNTFKeWtzWEc0Z0lHMWxiblZwZEdWdE9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZHRaVzUxYVhSbGJTY3BMRnh1SUNCdFpYUmhPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2R0WlhSaEp5a3NYRzRnSUcxbGRHVnlPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2R0WlhSbGNpY3BMRnh1SUNCdVlYWTZJR055WldGMFpVUlBUVVpoWTNSdmNua29KMjVoZGljcExGeHVJQ0J1YjNOamNtbHdkRG9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duYm05elkzSnBjSFFuS1N4Y2JpQWdiMkpxWldOME9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZHZZbXBsWTNRbktTeGNiaUFnYjJ3NklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oyOXNKeWtzWEc0Z0lHOXdkR2R5YjNWd09pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZHZjSFJuY205MWNDY3BMRnh1SUNCdmNIUnBiMjQ2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjI5d2RHbHZiaWNwTEZ4dUlDQnZkWFJ3ZFhRNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oyOTFkSEIxZENjcExGeHVJQ0J3T2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0Nkd0p5a3NYRzRnSUhCaGNtRnRPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2R3WVhKaGJTY3BMRnh1SUNCd2FXTjBkWEpsT2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0Nkd2FXTjBkWEpsSnlrc1hHNGdJSEJ5WlRvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbmNISmxKeWtzWEc0Z0lIQnliMmR5WlhOek9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZHdjbTluY21WemN5Y3BMRnh1SUNCeE9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZHhKeWtzWEc0Z0lISndPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2R5Y0NjcExGeHVJQ0J5ZERvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbmNuUW5LU3hjYmlBZ2NuVmllVG9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duY25WaWVTY3BMRnh1SUNCek9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZHpKeWtzWEc0Z0lITmhiWEE2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjNOaGJYQW5LU3hjYmlBZ2MyTnlhWEIwT2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkelkzSnBjSFFuS1N4Y2JpQWdjMlZqZEdsdmJqb2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25jMlZqZEdsdmJpY3BMRnh1SUNCelpXeGxZM1E2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjNObGJHVmpkQ2NwTEZ4dUlDQnpiV0ZzYkRvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbmMyMWhiR3duS1N4Y2JpQWdjMjkxY21ObE9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZHpiM1Z5WTJVbktTeGNiaUFnYzNCaGJqb2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25jM0JoYmljcExGeHVJQ0J6ZEhKdmJtYzZJR055WldGMFpVUlBUVVpoWTNSdmNua29KM04wY205dVp5Y3BMRnh1SUNCemRIbHNaVG9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duYzNSNWJHVW5LU3hjYmlBZ2MzVmlPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2R6ZFdJbktTeGNiaUFnYzNWdGJXRnllVG9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duYzNWdGJXRnllU2NwTEZ4dUlDQnpkWEE2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjNOMWNDY3BMRnh1SUNCMFlXSnNaVG9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duZEdGaWJHVW5LU3hjYmlBZ2RHSnZaSGs2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjNSaWIyUjVKeWtzWEc0Z0lIUmtPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2QwWkNjcExGeHVJQ0IwWlhoMFlYSmxZVG9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duZEdWNGRHRnlaV0VuS1N4Y2JpQWdkR1p2YjNRNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0ozUm1iMjkwSnlrc1hHNGdJSFJvT2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkMGFDY3BMRnh1SUNCMGFHVmhaRG9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duZEdobFlXUW5LU3hjYmlBZ2RHbHRaVG9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duZEdsdFpTY3BMRnh1SUNCMGFYUnNaVG9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duZEdsMGJHVW5LU3hjYmlBZ2RISTZJR055WldGMFpVUlBUVVpoWTNSdmNua29KM1J5Snlrc1hHNGdJSFJ5WVdOck9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZDBjbUZqYXljcExGeHVJQ0IxT2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkMUp5a3NYRzRnSUhWc09pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZDFiQ2NwTEZ4dUlDQW5kbUZ5SnpvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbmRtRnlKeWtzWEc0Z0lIWnBaR1Z2T2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkMmFXUmxieWNwTEZ4dUlDQjNZbkk2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjNkaWNpY3BMRnh1WEc0Z0lDOHZJRk5XUjF4dUlDQmphWEpqYkdVNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oyTnBjbU5zWlNjcExGeHVJQ0JqYkdsd1VHRjBhRG9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duWTJ4cGNGQmhkR2duS1N4Y2JpQWdaR1ZtY3pvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnblpHVm1jeWNwTEZ4dUlDQmxiR3hwY0hObE9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZGxiR3hwY0hObEp5a3NYRzRnSUdjNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oyY25LU3hjYmlBZ2FXMWhaMlU2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjJsdFlXZGxKeWtzWEc0Z0lHeHBibVU2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjJ4cGJtVW5LU3hjYmlBZ2JHbHVaV0Z5UjNKaFpHbGxiblE2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjJ4cGJtVmhja2R5WVdScFpXNTBKeWtzWEc0Z0lHMWhjMnM2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjIxaGMyc25LU3hjYmlBZ2NHRjBhRG9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duY0dGMGFDY3BMRnh1SUNCd1lYUjBaWEp1T2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0Nkd1lYUjBaWEp1Snlrc1hHNGdJSEJ2YkhsbmIyNDZJR055WldGMFpVUlBUVVpoWTNSdmNua29KM0J2YkhsbmIyNG5LU3hjYmlBZ2NHOXNlV3hwYm1VNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0ozQnZiSGxzYVc1bEp5a3NYRzRnSUhKaFpHbGhiRWR5WVdScFpXNTBPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2R5WVdScFlXeEhjbUZrYVdWdWRDY3BMRnh1SUNCeVpXTjBPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2R5WldOMEp5a3NYRzRnSUhOMGIzQTZJR055WldGMFpVUlBUVVpoWTNSdmNua29KM04wYjNBbktTeGNiaUFnYzNabk9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZHpkbWNuS1N4Y2JpQWdkR1Y0ZERvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbmRHVjRkQ2NwTEZ4dUlDQjBjM0JoYmpvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbmRITndZVzRuS1Z4dWZUdGNibHh1Ylc5a2RXeGxMbVY0Y0c5eWRITWdQU0JTWldGamRFUlBUVVpoWTNSdmNtbGxjenNpTENJdktpcGNiaUFxSUVOdmNIbHlhV2RvZENBeU1ERTBMWEJ5WlhObGJuUXNJRVpoWTJWaWIyOXJMQ0JKYm1NdVhHNGdLaUJCYkd3Z2NtbG5hSFJ6SUhKbGMyVnlkbVZrTGx4dUlDcGNiaUFxSUZSb2FYTWdjMjkxY21ObElHTnZaR1VnYVhNZ2JHbGpaVzV6WldRZ2RXNWtaWElnZEdobElFSlRSQzF6ZEhsc1pTQnNhV05sYm5ObElHWnZkVzVrSUdsdUlIUm9aVnh1SUNvZ1RFbERSVTVUUlNCbWFXeGxJR2x1SUhSb1pTQnliMjkwSUdScGNtVmpkRzl5ZVNCdlppQjBhR2x6SUhOdmRYSmpaU0IwY21WbExpQkJiaUJoWkdScGRHbHZibUZzSUdkeVlXNTBYRzRnS2lCdlppQndZWFJsYm5RZ2NtbG5hSFJ6SUdOaGJpQmlaU0JtYjNWdVpDQnBiaUIwYUdVZ1VFRlVSVTVVVXlCbWFXeGxJR2x1SUhSb1pTQnpZVzFsSUdScGNtVmpkRzl5ZVM1Y2JpQXFYRzRnS2k5Y2JseHVKM1Z6WlNCemRISnBZM1FuTzF4dVhHNTJZWElnWDJGemMybG5iaUE5SUhKbGNYVnBjbVVvSjI5aWFtVmpkQzFoYzNOcFoyNG5LVHRjYmx4dWRtRnlJRkpsWVdOMFEzVnljbVZ1ZEU5M2JtVnlJRDBnY21WeGRXbHlaU2duTGk5U1pXRmpkRU4xY25KbGJuUlBkMjVsY2ljcE8xeHVYRzUyWVhJZ2QyRnlibWx1WnlBOUlISmxjWFZwY21Vb0oyWmlhbk12YkdsaUwzZGhjbTVwYm1jbktUdGNiblpoY2lCallXNUVaV1pwYm1WUWNtOXdaWEowZVNBOUlISmxjWFZwY21Vb0p5NHZZMkZ1UkdWbWFXNWxVSEp2Y0dWeWRIa25LVHRjYm5aaGNpQm9ZWE5QZDI1UWNtOXdaWEowZVNBOUlFOWlhbVZqZEM1d2NtOTBiM1I1Y0dVdWFHRnpUM2R1VUhKdmNHVnlkSGs3WEc1Y2JuWmhjaUJTUlVGRFZGOUZURVZOUlU1VVgxUlpVRVVnUFNCeVpYRjFhWEpsS0NjdUwxSmxZV04wUld4bGJXVnVkRk41YldKdmJDY3BPMXh1WEc1MllYSWdVa1ZUUlZKV1JVUmZVRkpQVUZNZ1BTQjdYRzRnSUd0bGVUb2dkSEoxWlN4Y2JpQWdjbVZtT2lCMGNuVmxMRnh1SUNCZlgzTmxiR1k2SUhSeWRXVXNYRzRnSUY5ZmMyOTFjbU5sT2lCMGNuVmxYRzU5TzF4dVhHNTJZWElnYzNCbFkybGhiRkJ5YjNCTFpYbFhZWEp1YVc1blUyaHZkMjRzSUhOd1pXTnBZV3hRY205d1VtVm1WMkZ5Ym1sdVoxTm9iM2R1TzF4dVhHNW1kVzVqZEdsdmJpQm9ZWE5XWVd4cFpGSmxaaWhqYjI1bWFXY3BJSHRjYmlBZ2FXWWdLSEJ5YjJObGMzTXVaVzUyTGs1UFJFVmZSVTVXSUNFOVBTQW5jSEp2WkhWamRHbHZiaWNwSUh0Y2JpQWdJQ0JwWmlBb2FHRnpUM2R1VUhKdmNHVnlkSGt1WTJGc2JDaGpiMjVtYVdjc0lDZHlaV1luS1NrZ2UxeHVJQ0FnSUNBZ2RtRnlJR2RsZEhSbGNpQTlJRTlpYW1WamRDNW5aWFJQZDI1UWNtOXdaWEowZVVSbGMyTnlhWEIwYjNJb1kyOXVabWxuTENBbmNtVm1KeWt1WjJWME8xeHVJQ0FnSUNBZ2FXWWdLR2RsZEhSbGNpQW1KaUJuWlhSMFpYSXVhWE5TWldGamRGZGhjbTVwYm1jcElIdGNiaUFnSUNBZ0lDQWdjbVYwZFhKdUlHWmhiSE5sTzF4dUlDQWdJQ0FnZlZ4dUlDQWdJSDFjYmlBZ2ZWeHVJQ0J5WlhSMWNtNGdZMjl1Wm1sbkxuSmxaaUFoUFQwZ2RXNWtaV1pwYm1Wa08xeHVmVnh1WEc1bWRXNWpkR2x2YmlCb1lYTldZV3hwWkV0bGVTaGpiMjVtYVdjcElIdGNiaUFnYVdZZ0tIQnliMk5sYzNNdVpXNTJMazVQUkVWZlJVNVdJQ0U5UFNBbmNISnZaSFZqZEdsdmJpY3BJSHRjYmlBZ0lDQnBaaUFvYUdGelQzZHVVSEp2Y0dWeWRIa3VZMkZzYkNoamIyNW1hV2NzSUNkclpYa25LU2tnZTF4dUlDQWdJQ0FnZG1GeUlHZGxkSFJsY2lBOUlFOWlhbVZqZEM1blpYUlBkMjVRY205d1pYSjBlVVJsYzJOeWFYQjBiM0lvWTI5dVptbG5MQ0FuYTJWNUp5a3VaMlYwTzF4dUlDQWdJQ0FnYVdZZ0tHZGxkSFJsY2lBbUppQm5aWFIwWlhJdWFYTlNaV0ZqZEZkaGNtNXBibWNwSUh0Y2JpQWdJQ0FnSUNBZ2NtVjBkWEp1SUdaaGJITmxPMXh1SUNBZ0lDQWdmVnh1SUNBZ0lIMWNiaUFnZlZ4dUlDQnlaWFIxY200Z1kyOXVabWxuTG10bGVTQWhQVDBnZFc1a1pXWnBibVZrTzF4dWZWeHVYRzVtZFc1amRHbHZiaUJrWldacGJtVkxaWGxRY205d1YyRnlibWx1WjBkbGRIUmxjaWh3Y205d2N5d2daR2x6Y0d4aGVVNWhiV1VwSUh0Y2JpQWdkbUZ5SUhkaGNtNUJZbTkxZEVGalkyVnpjMmx1WjB0bGVTQTlJR1oxYm1OMGFXOXVJQ2dwSUh0Y2JpQWdJQ0JwWmlBb0lYTndaV05wWVd4UWNtOXdTMlY1VjJGeWJtbHVaMU5vYjNkdUtTQjdYRzRnSUNBZ0lDQnpjR1ZqYVdGc1VISnZjRXRsZVZkaGNtNXBibWRUYUc5M2JpQTlJSFJ5ZFdVN1hHNGdJQ0FnSUNCd2NtOWpaWE56TG1WdWRpNU9UMFJGWDBWT1ZpQWhQVDBnSjNCeWIyUjFZM1JwYjI0bklEOGdkMkZ5Ym1sdVp5aG1ZV3h6WlN3Z0p5VnpPaUJnYTJWNVlDQnBjeUJ1YjNRZ1lTQndjbTl3TGlCVWNubHBibWNnZEc4Z1lXTmpaWE56SUdsMElIZHBiR3dnY21WemRXeDBJQ2NnS3lBbmFXNGdZSFZ1WkdWbWFXNWxaR0FnWW1WcGJtY2djbVYwZFhKdVpXUXVJRWxtSUhsdmRTQnVaV1ZrSUhSdklHRmpZMlZ6Y3lCMGFHVWdjMkZ0WlNBbklDc2dKM1poYkhWbElIZHBkR2hwYmlCMGFHVWdZMmhwYkdRZ1kyOXRjRzl1Wlc1MExDQjViM1VnYzJodmRXeGtJSEJoYzNNZ2FYUWdZWE1nWVNCa2FXWm1aWEpsYm5RZ0p5QXJJQ2R3Y205d0xpQW9hSFIwY0hNNkx5OW1ZaTV0WlM5eVpXRmpkQzF6Y0dWamFXRnNMWEJ5YjNCektTY3NJR1JwYzNCc1lYbE9ZVzFsS1NBNklIWnZhV1FnTUR0Y2JpQWdJQ0I5WEc0Z0lIMDdYRzRnSUhkaGNtNUJZbTkxZEVGalkyVnpjMmx1WjB0bGVTNXBjMUpsWVdOMFYyRnlibWx1WnlBOUlIUnlkV1U3WEc0Z0lFOWlhbVZqZEM1a1pXWnBibVZRY205d1pYSjBlU2h3Y205d2N5d2dKMnRsZVNjc0lIdGNiaUFnSUNCblpYUTZJSGRoY201QlltOTFkRUZqWTJWemMybHVaMHRsZVN4Y2JpQWdJQ0JqYjI1bWFXZDFjbUZpYkdVNklIUnlkV1ZjYmlBZ2ZTazdYRzU5WEc1Y2JtWjFibU4wYVc5dUlHUmxabWx1WlZKbFpsQnliM0JYWVhKdWFXNW5SMlYwZEdWeUtIQnliM0J6TENCa2FYTndiR0Y1VG1GdFpTa2dlMXh1SUNCMllYSWdkMkZ5YmtGaWIzVjBRV05qWlhOemFXNW5VbVZtSUQwZ1puVnVZM1JwYjI0Z0tDa2dlMXh1SUNBZ0lHbG1JQ2doYzNCbFkybGhiRkJ5YjNCU1pXWlhZWEp1YVc1blUyaHZkMjRwSUh0Y2JpQWdJQ0FnSUhOd1pXTnBZV3hRY205d1VtVm1WMkZ5Ym1sdVoxTm9iM2R1SUQwZ2RISjFaVHRjYmlBZ0lDQWdJSEJ5YjJObGMzTXVaVzUyTGs1UFJFVmZSVTVXSUNFOVBTQW5jSEp2WkhWamRHbHZiaWNnUHlCM1lYSnVhVzVuS0daaGJITmxMQ0FuSlhNNklHQnlaV1pnSUdseklHNXZkQ0JoSUhCeWIzQXVJRlJ5ZVdsdVp5QjBieUJoWTJObGMzTWdhWFFnZDJsc2JDQnlaWE4xYkhRZ0p5QXJJQ2RwYmlCZ2RXNWtaV1pwYm1Wa1lDQmlaV2x1WnlCeVpYUjFjbTVsWkM0Z1NXWWdlVzkxSUc1bFpXUWdkRzhnWVdOalpYTnpJSFJvWlNCellXMWxJQ2NnS3lBbmRtRnNkV1VnZDJsMGFHbHVJSFJvWlNCamFHbHNaQ0JqYjIxd2IyNWxiblFzSUhsdmRTQnphRzkxYkdRZ2NHRnpjeUJwZENCaGN5QmhJR1JwWm1abGNtVnVkQ0FuSUNzZ0ozQnliM0F1SUNob2RIUndjem92TDJaaUxtMWxMM0psWVdOMExYTndaV05wWVd3dGNISnZjSE1wSnl3Z1pHbHpjR3hoZVU1aGJXVXBJRG9nZG05cFpDQXdPMXh1SUNBZ0lIMWNiaUFnZlR0Y2JpQWdkMkZ5YmtGaWIzVjBRV05qWlhOemFXNW5VbVZtTG1selVtVmhZM1JYWVhKdWFXNW5JRDBnZEhKMVpUdGNiaUFnVDJKcVpXTjBMbVJsWm1sdVpWQnliM0JsY25SNUtIQnliM0J6TENBbmNtVm1KeXdnZTF4dUlDQWdJR2RsZERvZ2QyRnlia0ZpYjNWMFFXTmpaWE56YVc1blVtVm1MRnh1SUNBZ0lHTnZibVpwWjNWeVlXSnNaVG9nZEhKMVpWeHVJQ0I5S1R0Y2JuMWNibHh1THlvcVhHNGdLaUJHWVdOMGIzSjVJRzFsZEdodlpDQjBieUJqY21WaGRHVWdZU0J1WlhjZ1VtVmhZM1FnWld4bGJXVnVkQzRnVkdocGN5QnVieUJzYjI1blpYSWdZV1JvWlhKbGN5QjBiMXh1SUNvZ2RHaGxJR05zWVhOeklIQmhkSFJsY200c0lITnZJR1J2SUc1dmRDQjFjMlVnYm1WM0lIUnZJR05oYkd3Z2FYUXVJRUZzYzI4c0lHNXZJR2x1YzNSaGJtTmxiMllnWTJobFkydGNiaUFxSUhkcGJHd2dkMjl5YXk0Z1NXNXpkR1ZoWkNCMFpYTjBJQ1FrZEhsd1pXOW1JR1pwWld4a0lHRm5ZV2x1YzNRZ1UzbHRZbTlzTG1admNpZ25jbVZoWTNRdVpXeGxiV1Z1ZENjcElIUnZJR05vWldOclhHNGdLaUJwWmlCemIyMWxkR2hwYm1jZ2FYTWdZU0JTWldGamRDQkZiR1Z0Wlc1MExseHVJQ3BjYmlBcUlFQndZWEpoYlNCN0tuMGdkSGx3WlZ4dUlDb2dRSEJoY21GdElIc3FmU0JyWlhsY2JpQXFJRUJ3WVhKaGJTQjdjM1J5YVc1bmZHOWlhbVZqZEgwZ2NtVm1YRzRnS2lCQWNHRnlZVzBnZXlwOUlITmxiR1lnUVNBcWRHVnRjRzl5WVhKNUtpQm9aV3h3WlhJZ2RHOGdaR1YwWldOMElIQnNZV05sY3lCM2FHVnlaU0JnZEdocGMyQWdhWE5jYmlBcUlHUnBabVpsY21WdWRDQm1jbTl0SUhSb1pTQmdiM2R1WlhKZ0lIZG9aVzRnVW1WaFkzUXVZM0psWVhSbFJXeGxiV1Z1ZENCcGN5QmpZV3hzWldRc0lITnZJSFJvWVhRZ2QyVmNiaUFxSUdOaGJpQjNZWEp1TGlCWFpTQjNZVzUwSUhSdklHZGxkQ0J5YVdRZ2IyWWdiM2R1WlhJZ1lXNWtJSEpsY0d4aFkyVWdjM1J5YVc1bklHQnlaV1pnY3lCM2FYUm9JR0Z5Y205M1hHNGdLaUJtZFc1amRHbHZibk1zSUdGdVpDQmhjeUJzYjI1bklHRnpJR0IwYUdsellDQmhibVFnYjNkdVpYSWdZWEpsSUhSb1pTQnpZVzFsTENCMGFHVnlaU0IzYVd4c0lHSmxJRzV2WEc0Z0tpQmphR0Z1WjJVZ2FXNGdZbVZvWVhacGIzSXVYRzRnS2lCQWNHRnlZVzBnZXlwOUlITnZkWEpqWlNCQmJpQmhibTV2ZEdGMGFXOXVJRzlpYW1WamRDQW9ZV1JrWldRZ1lua2dZU0IwY21GdWMzQnBiR1Z5SUc5eUlHOTBhR1Z5ZDJselpTbGNiaUFxSUdsdVpHbGpZWFJwYm1jZ1ptbHNaVzVoYldVc0lHeHBibVVnYm5WdFltVnlMQ0JoYm1RdmIzSWdiM1JvWlhJZ2FXNW1iM0p0WVhScGIyNHVYRzRnS2lCQWNHRnlZVzBnZXlwOUlHOTNibVZ5WEc0Z0tpQkFjR0Z5WVcwZ2V5cDlJSEJ5YjNCelhHNGdLaUJBYVc1MFpYSnVZV3hjYmlBcUwxeHVkbUZ5SUZKbFlXTjBSV3hsYldWdWRDQTlJR1oxYm1OMGFXOXVJQ2gwZVhCbExDQnJaWGtzSUhKbFppd2djMlZzWml3Z2MyOTFjbU5sTENCdmQyNWxjaXdnY0hKdmNITXBJSHRjYmlBZ2RtRnlJR1ZzWlcxbGJuUWdQU0I3WEc0Z0lDQWdMeThnVkdocGN5QjBZV2NnWVd4c2IzY2dkWE1nZEc4Z2RXNXBjWFZsYkhrZ2FXUmxiblJwWm5rZ2RHaHBjeUJoY3lCaElGSmxZV04wSUVWc1pXMWxiblJjYmlBZ0lDQWtKSFI1Y0dWdlpqb2dVa1ZCUTFSZlJVeEZUVVZPVkY5VVdWQkZMRnh1WEc0Z0lDQWdMeThnUW5WcGJIUXRhVzRnY0hKdmNHVnlkR2xsY3lCMGFHRjBJR0psYkc5dVp5QnZiaUIwYUdVZ1pXeGxiV1Z1ZEZ4dUlDQWdJSFI1Y0dVNklIUjVjR1VzWEc0Z0lDQWdhMlY1T2lCclpYa3NYRzRnSUNBZ2NtVm1PaUJ5WldZc1hHNGdJQ0FnY0hKdmNITTZJSEJ5YjNCekxGeHVYRzRnSUNBZ0x5OGdVbVZqYjNKa0lIUm9aU0JqYjIxd2IyNWxiblFnY21WemNHOXVjMmxpYkdVZ1ptOXlJR055WldGMGFXNW5JSFJvYVhNZ1pXeGxiV1Z1ZEM1Y2JpQWdJQ0JmYjNkdVpYSTZJRzkzYm1WeVhHNGdJSDA3WEc1Y2JpQWdhV1lnS0hCeWIyTmxjM011Wlc1MkxrNVBSRVZmUlU1V0lDRTlQU0FuY0hKdlpIVmpkR2x2YmljcElIdGNiaUFnSUNBdkx5QlVhR1VnZG1Gc2FXUmhkR2x2YmlCbWJHRm5JR2x6SUdOMWNuSmxiblJzZVNCdGRYUmhkR2wyWlM0Z1YyVWdjSFYwSUdsMElHOXVYRzRnSUNBZ0x5OGdZVzRnWlhoMFpYSnVZV3dnWW1GamEybHVaeUJ6ZEc5eVpTQnpieUIwYUdGMElIZGxJR05oYmlCbWNtVmxlbVVnZEdobElIZG9iMnhsSUc5aWFtVmpkQzVjYmlBZ0lDQXZMeUJVYUdseklHTmhiaUJpWlNCeVpYQnNZV05sWkNCM2FYUm9JR0VnVjJWaGEwMWhjQ0J2Ym1ObElIUm9aWGtnWVhKbElHbHRjR3hsYldWdWRHVmtJR2x1WEc0Z0lDQWdMeThnWTI5dGJXOXViSGtnZFhObFpDQmtaWFpsYkc5d2JXVnVkQ0JsYm5acGNtOXViV1Z1ZEhNdVhHNGdJQ0FnWld4bGJXVnVkQzVmYzNSdmNtVWdQU0I3ZlR0Y2JseHVJQ0FnSUM4dklGUnZJRzFoYTJVZ1kyOXRjR0Z5YVc1bklGSmxZV04wUld4bGJXVnVkSE1nWldGemFXVnlJR1p2Y2lCMFpYTjBhVzVuSUhCMWNuQnZjMlZ6TENCM1pTQnRZV3RsWEc0Z0lDQWdMeThnZEdobElIWmhiR2xrWVhScGIyNGdabXhoWnlCdWIyNHRaVzUxYldWeVlXSnNaU0FvZDJobGNtVWdjRzl6YzJsaWJHVXNJSGRvYVdOb0lITm9iM1ZzWkZ4dUlDQWdJQzh2SUdsdVkyeDFaR1VnWlhabGNua2daVzUyYVhKdmJtMWxiblFnZDJVZ2NuVnVJSFJsYzNSeklHbHVLU3dnYzI4Z2RHaGxJSFJsYzNRZ1puSmhiV1YzYjNKclhHNGdJQ0FnTHk4Z2FXZHViM0psY3lCcGRDNWNiaUFnSUNCcFppQW9ZMkZ1UkdWbWFXNWxVSEp2Y0dWeWRIa3BJSHRjYmlBZ0lDQWdJRTlpYW1WamRDNWtaV1pwYm1WUWNtOXdaWEowZVNobGJHVnRaVzUwTGw5emRHOXlaU3dnSjNaaGJHbGtZWFJsWkNjc0lIdGNiaUFnSUNBZ0lDQWdZMjl1Wm1sbmRYSmhZbXhsT2lCbVlXeHpaU3hjYmlBZ0lDQWdJQ0FnWlc1MWJXVnlZV0pzWlRvZ1ptRnNjMlVzWEc0Z0lDQWdJQ0FnSUhkeWFYUmhZbXhsT2lCMGNuVmxMRnh1SUNBZ0lDQWdJQ0IyWVd4MVpUb2dabUZzYzJWY2JpQWdJQ0FnSUgwcE8xeHVJQ0FnSUNBZ0x5OGdjMlZzWmlCaGJtUWdjMjkxY21ObElHRnlaU0JFUlZZZ2IyNXNlU0J3Y205d1pYSjBhV1Z6TGx4dUlDQWdJQ0FnVDJKcVpXTjBMbVJsWm1sdVpWQnliM0JsY25SNUtHVnNaVzFsYm5Rc0lDZGZjMlZzWmljc0lIdGNiaUFnSUNBZ0lDQWdZMjl1Wm1sbmRYSmhZbXhsT2lCbVlXeHpaU3hjYmlBZ0lDQWdJQ0FnWlc1MWJXVnlZV0pzWlRvZ1ptRnNjMlVzWEc0Z0lDQWdJQ0FnSUhkeWFYUmhZbXhsT2lCbVlXeHpaU3hjYmlBZ0lDQWdJQ0FnZG1Gc2RXVTZJSE5sYkdaY2JpQWdJQ0FnSUgwcE8xeHVJQ0FnSUNBZ0x5OGdWSGR2SUdWc1pXMWxiblJ6SUdOeVpXRjBaV1FnYVc0Z2RIZHZJR1JwWm1abGNtVnVkQ0J3YkdGalpYTWdjMmh2ZFd4a0lHSmxJR052Ym5OcFpHVnlaV1JjYmlBZ0lDQWdJQzh2SUdWeGRXRnNJR1p2Y2lCMFpYTjBhVzVuSUhCMWNuQnZjMlZ6SUdGdVpDQjBhR1Z5WldadmNtVWdkMlVnYUdsa1pTQnBkQ0JtY205dElHVnVkVzFsY21GMGFXOXVMbHh1SUNBZ0lDQWdUMkpxWldOMExtUmxabWx1WlZCeWIzQmxjblI1S0dWc1pXMWxiblFzSUNkZmMyOTFjbU5sSnl3Z2UxeHVJQ0FnSUNBZ0lDQmpiMjVtYVdkMWNtRmliR1U2SUdaaGJITmxMRnh1SUNBZ0lDQWdJQ0JsYm5WdFpYSmhZbXhsT2lCbVlXeHpaU3hjYmlBZ0lDQWdJQ0FnZDNKcGRHRmliR1U2SUdaaGJITmxMRnh1SUNBZ0lDQWdJQ0IyWVd4MVpUb2djMjkxY21ObFhHNGdJQ0FnSUNCOUtUdGNiaUFnSUNCOUlHVnNjMlVnZTF4dUlDQWdJQ0FnWld4bGJXVnVkQzVmYzNSdmNtVXVkbUZzYVdSaGRHVmtJRDBnWm1Gc2MyVTdYRzRnSUNBZ0lDQmxiR1Z0Wlc1MExsOXpaV3htSUQwZ2MyVnNaanRjYmlBZ0lDQWdJR1ZzWlcxbGJuUXVYM052ZFhKalpTQTlJSE52ZFhKalpUdGNiaUFnSUNCOVhHNGdJQ0FnYVdZZ0tFOWlhbVZqZEM1bWNtVmxlbVVwSUh0Y2JpQWdJQ0FnSUU5aWFtVmpkQzVtY21WbGVtVW9aV3hsYldWdWRDNXdjbTl3Y3lrN1hHNGdJQ0FnSUNCUFltcGxZM1F1Wm5KbFpYcGxLR1ZzWlcxbGJuUXBPMXh1SUNBZ0lIMWNiaUFnZlZ4dVhHNGdJSEpsZEhWeWJpQmxiR1Z0Wlc1ME8xeHVmVHRjYmx4dUx5b3FYRzRnS2lCRGNtVmhkR1VnWVc1a0lISmxkSFZ5YmlCaElHNWxkeUJTWldGamRFVnNaVzFsYm5RZ2IyWWdkR2hsSUdkcGRtVnVJSFI1Y0dVdVhHNGdLaUJUWldVZ2FIUjBjSE02THk5bVlXTmxZbTl2YXk1bmFYUm9kV0l1YVc4dmNtVmhZM1F2Wkc5amN5OTBiM0F0YkdWMlpXd3RZWEJwTG1oMGJXd2pjbVZoWTNRdVkzSmxZWFJsWld4bGJXVnVkRnh1SUNvdlhHNVNaV0ZqZEVWc1pXMWxiblF1WTNKbFlYUmxSV3hsYldWdWRDQTlJR1oxYm1OMGFXOXVJQ2gwZVhCbExDQmpiMjVtYVdjc0lHTm9hV3hrY21WdUtTQjdYRzRnSUhaaGNpQndjbTl3VG1GdFpUdGNibHh1SUNBdkx5QlNaWE5sY25abFpDQnVZVzFsY3lCaGNtVWdaWGgwY21GamRHVmtYRzRnSUhaaGNpQndjbTl3Y3lBOUlIdDlPMXh1WEc0Z0lIWmhjaUJyWlhrZ1BTQnVkV3hzTzF4dUlDQjJZWElnY21WbUlEMGdiblZzYkR0Y2JpQWdkbUZ5SUhObGJHWWdQU0J1ZFd4c08xeHVJQ0IyWVhJZ2MyOTFjbU5sSUQwZ2JuVnNiRHRjYmx4dUlDQnBaaUFvWTI5dVptbG5JQ0U5SUc1MWJHd3BJSHRjYmlBZ0lDQnBaaUFvYUdGelZtRnNhV1JTWldZb1kyOXVabWxuS1NrZ2UxeHVJQ0FnSUNBZ2NtVm1JRDBnWTI5dVptbG5MbkpsWmp0Y2JpQWdJQ0I5WEc0Z0lDQWdhV1lnS0doaGMxWmhiR2xrUzJWNUtHTnZibVpwWnlrcElIdGNiaUFnSUNBZ0lHdGxlU0E5SUNjbklDc2dZMjl1Wm1sbkxtdGxlVHRjYmlBZ0lDQjlYRzVjYmlBZ0lDQnpaV3htSUQwZ1kyOXVabWxuTGw5ZmMyVnNaaUE5UFQwZ2RXNWtaV1pwYm1Wa0lEOGdiblZzYkNBNklHTnZibVpwWnk1ZlgzTmxiR1k3WEc0Z0lDQWdjMjkxY21ObElEMGdZMjl1Wm1sbkxsOWZjMjkxY21ObElEMDlQU0IxYm1SbFptbHVaV1FnUHlCdWRXeHNJRG9nWTI5dVptbG5MbDlmYzI5MWNtTmxPMXh1SUNBZ0lDOHZJRkpsYldGcGJtbHVaeUJ3Y205d1pYSjBhV1Z6SUdGeVpTQmhaR1JsWkNCMGJ5QmhJRzVsZHlCd2NtOXdjeUJ2WW1wbFkzUmNiaUFnSUNCbWIzSWdLSEJ5YjNCT1lXMWxJR2x1SUdOdmJtWnBaeWtnZTF4dUlDQWdJQ0FnYVdZZ0tHaGhjMDkzYmxCeWIzQmxjblI1TG1OaGJHd29ZMjl1Wm1sbkxDQndjbTl3VG1GdFpTa2dKaVlnSVZKRlUwVlNWa1ZFWDFCU1QxQlRMbWhoYzA5M2JsQnliM0JsY25SNUtIQnliM0JPWVcxbEtTa2dlMXh1SUNBZ0lDQWdJQ0J3Y205d2MxdHdjbTl3VG1GdFpWMGdQU0JqYjI1bWFXZGJjSEp2Y0U1aGJXVmRPMXh1SUNBZ0lDQWdmVnh1SUNBZ0lIMWNiaUFnZlZ4dVhHNGdJQzh2SUVOb2FXeGtjbVZ1SUdOaGJpQmlaU0J0YjNKbElIUm9ZVzRnYjI1bElHRnlaM1Z0Wlc1MExDQmhibVFnZEdodmMyVWdZWEpsSUhSeVlXNXpabVZ5Y21Wa0lHOXVkRzljYmlBZ0x5OGdkR2hsSUc1bGQyeDVJR0ZzYkc5allYUmxaQ0J3Y205d2N5QnZZbXBsWTNRdVhHNGdJSFpoY2lCamFHbHNaSEpsYmt4bGJtZDBhQ0E5SUdGeVozVnRaVzUwY3k1c1pXNW5kR2dnTFNBeU8xeHVJQ0JwWmlBb1kyaHBiR1J5Wlc1TVpXNW5kR2dnUFQwOUlERXBJSHRjYmlBZ0lDQndjbTl3Y3k1amFHbHNaSEpsYmlBOUlHTm9hV3hrY21WdU8xeHVJQ0I5SUdWc2MyVWdhV1lnS0dOb2FXeGtjbVZ1VEdWdVozUm9JRDRnTVNrZ2UxeHVJQ0FnSUhaaGNpQmphR2xzWkVGeWNtRjVJRDBnUVhKeVlYa29ZMmhwYkdSeVpXNU1aVzVuZEdncE8xeHVJQ0FnSUdadmNpQW9kbUZ5SUdrZ1BTQXdPeUJwSUR3Z1kyaHBiR1J5Wlc1TVpXNW5kR2c3SUdrckt5a2dlMXh1SUNBZ0lDQWdZMmhwYkdSQmNuSmhlVnRwWFNBOUlHRnlaM1Z0Wlc1MGMxdHBJQ3NnTWwwN1hHNGdJQ0FnZlZ4dUlDQWdJR2xtSUNod2NtOWpaWE56TG1WdWRpNU9UMFJGWDBWT1ZpQWhQVDBnSjNCeWIyUjFZM1JwYjI0bktTQjdYRzRnSUNBZ0lDQnBaaUFvVDJKcVpXTjBMbVp5WldWNlpTa2dlMXh1SUNBZ0lDQWdJQ0JQWW1wbFkzUXVabkpsWlhwbEtHTm9hV3hrUVhKeVlYa3BPMXh1SUNBZ0lDQWdmVnh1SUNBZ0lIMWNiaUFnSUNCd2NtOXdjeTVqYUdsc1pISmxiaUE5SUdOb2FXeGtRWEp5WVhrN1hHNGdJSDFjYmx4dUlDQXZMeUJTWlhOdmJIWmxJR1JsWm1GMWJIUWdjSEp2Y0hOY2JpQWdhV1lnS0hSNWNHVWdKaVlnZEhsd1pTNWtaV1poZFd4MFVISnZjSE1wSUh0Y2JpQWdJQ0IyWVhJZ1pHVm1ZWFZzZEZCeWIzQnpJRDBnZEhsd1pTNWtaV1poZFd4MFVISnZjSE03WEc0Z0lDQWdabTl5SUNod2NtOXdUbUZ0WlNCcGJpQmtaV1poZFd4MFVISnZjSE1wSUh0Y2JpQWdJQ0FnSUdsbUlDaHdjbTl3YzF0d2NtOXdUbUZ0WlYwZ1BUMDlJSFZ1WkdWbWFXNWxaQ2tnZTF4dUlDQWdJQ0FnSUNCd2NtOXdjMXR3Y205d1RtRnRaVjBnUFNCa1pXWmhkV3gwVUhKdmNITmJjSEp2Y0U1aGJXVmRPMXh1SUNBZ0lDQWdmVnh1SUNBZ0lIMWNiaUFnZlZ4dUlDQnBaaUFvY0hKdlkyVnpjeTVsYm5ZdVRrOUVSVjlGVGxZZ0lUMDlJQ2R3Y205a2RXTjBhVzl1SnlrZ2UxeHVJQ0FnSUdsbUlDaHJaWGtnZkh3Z2NtVm1LU0I3WEc0Z0lDQWdJQ0JwWmlBb2RIbHdaVzltSUhCeWIzQnpMaVFrZEhsd1pXOW1JRDA5UFNBbmRXNWtaV1pwYm1Wa0p5QjhmQ0J3Y205d2N5NGtKSFI1Y0dWdlppQWhQVDBnVWtWQlExUmZSVXhGVFVWT1ZGOVVXVkJGS1NCN1hHNGdJQ0FnSUNBZ0lIWmhjaUJrYVhOd2JHRjVUbUZ0WlNBOUlIUjVjR1Z2WmlCMGVYQmxJRDA5UFNBblpuVnVZM1JwYjI0bklEOGdkSGx3WlM1a2FYTndiR0Y1VG1GdFpTQjhmQ0IwZVhCbExtNWhiV1VnZkh3Z0oxVnVhMjV2ZDI0bklEb2dkSGx3WlR0Y2JpQWdJQ0FnSUNBZ2FXWWdLR3RsZVNrZ2UxeHVJQ0FnSUNBZ0lDQWdJR1JsWm1sdVpVdGxlVkJ5YjNCWFlYSnVhVzVuUjJWMGRHVnlLSEJ5YjNCekxDQmthWE53YkdGNVRtRnRaU2s3WEc0Z0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ2FXWWdLSEpsWmlrZ2UxeHVJQ0FnSUNBZ0lDQWdJR1JsWm1sdVpWSmxabEJ5YjNCWFlYSnVhVzVuUjJWMGRHVnlLSEJ5YjNCekxDQmthWE53YkdGNVRtRnRaU2s3WEc0Z0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUgxY2JpQWdJQ0I5WEc0Z0lIMWNiaUFnY21WMGRYSnVJRkpsWVdOMFJXeGxiV1Z1ZENoMGVYQmxMQ0JyWlhrc0lISmxaaXdnYzJWc1ppd2djMjkxY21ObExDQlNaV0ZqZEVOMWNuSmxiblJQZDI1bGNpNWpkWEp5Wlc1MExDQndjbTl3Y3lrN1hHNTlPMXh1WEc0dktpcGNiaUFxSUZKbGRIVnliaUJoSUdaMWJtTjBhVzl1SUhSb1lYUWdjSEp2WkhWalpYTWdVbVZoWTNSRmJHVnRaVzUwY3lCdlppQmhJR2RwZG1WdUlIUjVjR1V1WEc0Z0tpQlRaV1VnYUhSMGNITTZMeTltWVdObFltOXZheTVuYVhSb2RXSXVhVzh2Y21WaFkzUXZaRzlqY3k5MGIzQXRiR1YyWld3dFlYQnBMbWgwYld3amNtVmhZM1F1WTNKbFlYUmxabUZqZEc5eWVWeHVJQ292WEc1U1pXRmpkRVZzWlcxbGJuUXVZM0psWVhSbFJtRmpkRzl5ZVNBOUlHWjFibU4wYVc5dUlDaDBlWEJsS1NCN1hHNGdJSFpoY2lCbVlXTjBiM0o1SUQwZ1VtVmhZM1JGYkdWdFpXNTBMbU55WldGMFpVVnNaVzFsYm5RdVltbHVaQ2h1ZFd4c0xDQjBlWEJsS1R0Y2JpQWdMeThnUlhod2IzTmxJSFJvWlNCMGVYQmxJRzl1SUhSb1pTQm1ZV04wYjNKNUlHRnVaQ0IwYUdVZ2NISnZkRzkwZVhCbElITnZJSFJvWVhRZ2FYUWdZMkZ1SUdKbFhHNGdJQzh2SUdWaGMybHNlU0JoWTJObGMzTmxaQ0J2YmlCbGJHVnRaVzUwY3k0Z1JTNW5MaUJnUEVadmJ5QXZQaTUwZVhCbElEMDlQU0JHYjI5Z0xseHVJQ0F2THlCVWFHbHpJSE5vYjNWc1pDQnViM1FnWW1VZ2JtRnRaV1FnWUdOdmJuTjBjblZqZEc5eVlDQnphVzVqWlNCMGFHbHpJRzFoZVNCdWIzUWdZbVVnZEdobElHWjFibU4wYVc5dVhHNGdJQzh2SUhSb1lYUWdZM0psWVhSbFpDQjBhR1VnWld4bGJXVnVkQ3dnWVc1a0lHbDBJRzFoZVNCdWIzUWdaWFpsYmlCaVpTQmhJR052Ym5OMGNuVmpkRzl5TGx4dUlDQXZMeUJNWldkaFkza2dhRzl2YXlCVVQwUlBPaUJYWVhKdUlHbG1JSFJvYVhNZ2FYTWdZV05qWlhOelpXUmNiaUFnWm1GamRHOXllUzUwZVhCbElEMGdkSGx3WlR0Y2JpQWdjbVYwZFhKdUlHWmhZM1J2Y25rN1hHNTlPMXh1WEc1U1pXRmpkRVZzWlcxbGJuUXVZMnh2Ym1WQmJtUlNaWEJzWVdObFMyVjVJRDBnWm5WdVkzUnBiMjRnS0c5c1pFVnNaVzFsYm5Rc0lHNWxkMHRsZVNrZ2UxeHVJQ0IyWVhJZ2JtVjNSV3hsYldWdWRDQTlJRkpsWVdOMFJXeGxiV1Z1ZENodmJHUkZiR1Z0Wlc1MExuUjVjR1VzSUc1bGQwdGxlU3dnYjJ4a1JXeGxiV1Z1ZEM1eVpXWXNJRzlzWkVWc1pXMWxiblF1WDNObGJHWXNJRzlzWkVWc1pXMWxiblF1WDNOdmRYSmpaU3dnYjJ4a1JXeGxiV1Z1ZEM1ZmIzZHVaWElzSUc5c1pFVnNaVzFsYm5RdWNISnZjSE1wTzF4dVhHNGdJSEpsZEhWeWJpQnVaWGRGYkdWdFpXNTBPMXh1ZlR0Y2JseHVMeW9xWEc0Z0tpQkRiRzl1WlNCaGJtUWdjbVYwZFhKdUlHRWdibVYzSUZKbFlXTjBSV3hsYldWdWRDQjFjMmx1WnlCbGJHVnRaVzUwSUdGeklIUm9aU0J6ZEdGeWRHbHVaeUJ3YjJsdWRDNWNiaUFxSUZObFpTQm9kSFJ3Y3pvdkwyWmhZMlZpYjI5ckxtZHBkR2gxWWk1cGJ5OXlaV0ZqZEM5a2IyTnpMM1J2Y0Mxc1pYWmxiQzFoY0drdWFIUnRiQ055WldGamRDNWpiRzl1WldWc1pXMWxiblJjYmlBcUwxeHVVbVZoWTNSRmJHVnRaVzUwTG1Oc2IyNWxSV3hsYldWdWRDQTlJR1oxYm1OMGFXOXVJQ2hsYkdWdFpXNTBMQ0JqYjI1bWFXY3NJR05vYVd4a2NtVnVLU0I3WEc0Z0lIWmhjaUJ3Y205d1RtRnRaVHRjYmx4dUlDQXZMeUJQY21sbmFXNWhiQ0J3Y205d2N5QmhjbVVnWTI5d2FXVmtYRzRnSUhaaGNpQndjbTl3Y3lBOUlGOWhjM05wWjI0b2UzMHNJR1ZzWlcxbGJuUXVjSEp2Y0hNcE8xeHVYRzRnSUM4dklGSmxjMlZ5ZG1Wa0lHNWhiV1Z6SUdGeVpTQmxlSFJ5WVdOMFpXUmNiaUFnZG1GeUlHdGxlU0E5SUdWc1pXMWxiblF1YTJWNU8xeHVJQ0IyWVhJZ2NtVm1JRDBnWld4bGJXVnVkQzV5WldZN1hHNGdJQzh2SUZObGJHWWdhWE1nY0hKbGMyVnlkbVZrSUhOcGJtTmxJSFJvWlNCdmQyNWxjaUJwY3lCd2NtVnpaWEoyWldRdVhHNGdJSFpoY2lCelpXeG1JRDBnWld4bGJXVnVkQzVmYzJWc1pqdGNiaUFnTHk4Z1UyOTFjbU5sSUdseklIQnlaWE5sY25abFpDQnphVzVqWlNCamJHOXVaVVZzWlcxbGJuUWdhWE1nZFc1c2FXdGxiSGtnZEc4Z1ltVWdkR0Z5WjJWMFpXUWdZbmtnWVZ4dUlDQXZMeUIwY21GdWMzQnBiR1Z5TENCaGJtUWdkR2hsSUc5eWFXZHBibUZzSUhOdmRYSmpaU0JwY3lCd2NtOWlZV0pzZVNCaElHSmxkSFJsY2lCcGJtUnBZMkYwYjNJZ2IyWWdkR2hsWEc0Z0lDOHZJSFJ5ZFdVZ2IzZHVaWEl1WEc0Z0lIWmhjaUJ6YjNWeVkyVWdQU0JsYkdWdFpXNTBMbDl6YjNWeVkyVTdYRzVjYmlBZ0x5OGdUM2R1WlhJZ2QybHNiQ0JpWlNCd2NtVnpaWEoyWldRc0lIVnViR1Z6Y3lCeVpXWWdhWE1nYjNabGNuSnBaR1JsYmx4dUlDQjJZWElnYjNkdVpYSWdQU0JsYkdWdFpXNTBMbDl2ZDI1bGNqdGNibHh1SUNCcFppQW9ZMjl1Wm1sbklDRTlJRzUxYkd3cElIdGNiaUFnSUNCcFppQW9hR0Z6Vm1Gc2FXUlNaV1lvWTI5dVptbG5LU2tnZTF4dUlDQWdJQ0FnTHk4Z1UybHNaVzUwYkhrZ2MzUmxZV3dnZEdobElISmxaaUJtY205dElIUm9aU0J3WVhKbGJuUXVYRzRnSUNBZ0lDQnlaV1lnUFNCamIyNW1hV2N1Y21WbU8xeHVJQ0FnSUNBZ2IzZHVaWElnUFNCU1pXRmpkRU4xY25KbGJuUlBkMjVsY2k1amRYSnlaVzUwTzF4dUlDQWdJSDFjYmlBZ0lDQnBaaUFvYUdGelZtRnNhV1JMWlhrb1kyOXVabWxuS1NrZ2UxeHVJQ0FnSUNBZ2EyVjVJRDBnSnljZ0t5QmpiMjVtYVdjdWEyVjVPMXh1SUNBZ0lIMWNibHh1SUNBZ0lDOHZJRkpsYldGcGJtbHVaeUJ3Y205d1pYSjBhV1Z6SUc5MlpYSnlhV1JsSUdWNGFYTjBhVzVuSUhCeWIzQnpYRzRnSUNBZ2RtRnlJR1JsWm1GMWJIUlFjbTl3Y3p0Y2JpQWdJQ0JwWmlBb1pXeGxiV1Z1ZEM1MGVYQmxJQ1ltSUdWc1pXMWxiblF1ZEhsd1pTNWtaV1poZFd4MFVISnZjSE1wSUh0Y2JpQWdJQ0FnSUdSbFptRjFiSFJRY205d2N5QTlJR1ZzWlcxbGJuUXVkSGx3WlM1a1pXWmhkV3gwVUhKdmNITTdYRzRnSUNBZ2ZWeHVJQ0FnSUdadmNpQW9jSEp2Y0U1aGJXVWdhVzRnWTI5dVptbG5LU0I3WEc0Z0lDQWdJQ0JwWmlBb2FHRnpUM2R1VUhKdmNHVnlkSGt1WTJGc2JDaGpiMjVtYVdjc0lIQnliM0JPWVcxbEtTQW1KaUFoVWtWVFJWSldSVVJmVUZKUFVGTXVhR0Z6VDNkdVVISnZjR1Z5ZEhrb2NISnZjRTVoYldVcEtTQjdYRzRnSUNBZ0lDQWdJR2xtSUNoamIyNW1hV2RiY0hKdmNFNWhiV1ZkSUQwOVBTQjFibVJsWm1sdVpXUWdKaVlnWkdWbVlYVnNkRkJ5YjNCeklDRTlQU0IxYm1SbFptbHVaV1FwSUh0Y2JpQWdJQ0FnSUNBZ0lDQXZMeUJTWlhOdmJIWmxJR1JsWm1GMWJIUWdjSEp2Y0hOY2JpQWdJQ0FnSUNBZ0lDQndjbTl3YzF0d2NtOXdUbUZ0WlYwZ1BTQmtaV1poZFd4MFVISnZjSE5iY0hKdmNFNWhiV1ZkTzF4dUlDQWdJQ0FnSUNCOUlHVnNjMlVnZTF4dUlDQWdJQ0FnSUNBZ0lIQnliM0J6VzNCeWIzQk9ZVzFsWFNBOUlHTnZibVpwWjF0d2NtOXdUbUZ0WlYwN1hHNGdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lIMWNiaUFnSUNCOVhHNGdJSDFjYmx4dUlDQXZMeUJEYUdsc1pISmxiaUJqWVc0Z1ltVWdiVzl5WlNCMGFHRnVJRzl1WlNCaGNtZDFiV1Z1ZEN3Z1lXNWtJSFJvYjNObElHRnlaU0IwY21GdWMyWmxjbkpsWkNCdmJuUnZYRzRnSUM4dklIUm9aU0J1Wlhkc2VTQmhiR3h2WTJGMFpXUWdjSEp2Y0hNZ2IySnFaV04wTGx4dUlDQjJZWElnWTJocGJHUnlaVzVNWlc1bmRHZ2dQU0JoY21kMWJXVnVkSE11YkdWdVozUm9JQzBnTWp0Y2JpQWdhV1lnS0dOb2FXeGtjbVZ1VEdWdVozUm9JRDA5UFNBeEtTQjdYRzRnSUNBZ2NISnZjSE11WTJocGJHUnlaVzRnUFNCamFHbHNaSEpsYmp0Y2JpQWdmU0JsYkhObElHbG1JQ2hqYUdsc1pISmxia3hsYm1kMGFDQStJREVwSUh0Y2JpQWdJQ0IyWVhJZ1kyaHBiR1JCY25KaGVTQTlJRUZ5Y21GNUtHTm9hV3hrY21WdVRHVnVaM1JvS1R0Y2JpQWdJQ0JtYjNJZ0tIWmhjaUJwSUQwZ01Ec2dhU0E4SUdOb2FXeGtjbVZ1VEdWdVozUm9PeUJwS3lzcElIdGNiaUFnSUNBZ0lHTm9hV3hrUVhKeVlYbGJhVjBnUFNCaGNtZDFiV1Z1ZEhOYmFTQXJJREpkTzF4dUlDQWdJSDFjYmlBZ0lDQndjbTl3Y3k1amFHbHNaSEpsYmlBOUlHTm9hV3hrUVhKeVlYazdYRzRnSUgxY2JseHVJQ0J5WlhSMWNtNGdVbVZoWTNSRmJHVnRaVzUwS0dWc1pXMWxiblF1ZEhsd1pTd2dhMlY1TENCeVpXWXNJSE5sYkdZc0lITnZkWEpqWlN3Z2IzZHVaWElzSUhCeWIzQnpLVHRjYm4wN1hHNWNiaThxS2x4dUlDb2dWbVZ5YVdacFpYTWdkR2hsSUc5aWFtVmpkQ0JwY3lCaElGSmxZV04wUld4bGJXVnVkQzVjYmlBcUlGTmxaU0JvZEhSd2N6b3ZMMlpoWTJWaWIyOXJMbWRwZEdoMVlpNXBieTl5WldGamRDOWtiMk56TDNSdmNDMXNaWFpsYkMxaGNHa3VhSFJ0YkNOeVpXRmpkQzVwYzNaaGJHbGtaV3hsYldWdWRGeHVJQ29nUUhCaGNtRnRJSHMvYjJKcVpXTjBmU0J2WW1wbFkzUmNiaUFxSUVCeVpYUjFjbTRnZTJKdmIyeGxZVzU5SUZSeWRXVWdhV1lnWUc5aWFtVmpkR0FnYVhNZ1lTQjJZV3hwWkNCamIyMXdiMjVsYm5RdVhHNGdLaUJBWm1sdVlXeGNiaUFxTDF4dVVtVmhZM1JGYkdWdFpXNTBMbWx6Vm1Gc2FXUkZiR1Z0Wlc1MElEMGdablZ1WTNScGIyNGdLRzlpYW1WamRDa2dlMXh1SUNCeVpYUjFjbTRnZEhsd1pXOW1JRzlpYW1WamRDQTlQVDBnSjI5aWFtVmpkQ2NnSmlZZ2IySnFaV04wSUNFOVBTQnVkV3hzSUNZbUlHOWlhbVZqZEM0a0pIUjVjR1Z2WmlBOVBUMGdVa1ZCUTFSZlJVeEZUVVZPVkY5VVdWQkZPMXh1ZlR0Y2JseHViVzlrZFd4bExtVjRjRzl5ZEhNZ1BTQlNaV0ZqZEVWc1pXMWxiblE3SWl3aUx5b3FYRzRnS2lCRGIzQjVjbWxuYUhRZ01qQXhOQzF3Y21WelpXNTBMQ0JHWVdObFltOXZheXdnU1c1akxseHVJQ29nUVd4c0lISnBaMmgwY3lCeVpYTmxjblpsWkM1Y2JpQXFYRzRnS2lCVWFHbHpJSE52ZFhKalpTQmpiMlJsSUdseklHeHBZMlZ1YzJWa0lIVnVaR1Z5SUhSb1pTQkNVMFF0YzNSNWJHVWdiR2xqWlc1elpTQm1iM1Z1WkNCcGJpQjBhR1ZjYmlBcUlFeEpRMFZPVTBVZ1ptbHNaU0JwYmlCMGFHVWdjbTl2ZENCa2FYSmxZM1J2Y25rZ2IyWWdkR2hwY3lCemIzVnlZMlVnZEhKbFpTNGdRVzRnWVdSa2FYUnBiMjVoYkNCbmNtRnVkRnh1SUNvZ2IyWWdjR0YwWlc1MElISnBaMmgwY3lCallXNGdZbVVnWm05MWJtUWdhVzRnZEdobElGQkJWRVZPVkZNZ1ptbHNaU0JwYmlCMGFHVWdjMkZ0WlNCa2FYSmxZM1J2Y25rdVhHNGdLbHh1SUNvZ1hHNGdLaTljYmx4dUozVnpaU0J6ZEhKcFkzUW5PMXh1WEc0dkx5QlVhR1VnVTNsdFltOXNJSFZ6WldRZ2RHOGdkR0ZuSUhSb1pTQlNaV0ZqZEVWc1pXMWxiblFnZEhsd1pTNGdTV1lnZEdobGNtVWdhWE1nYm04Z2JtRjBhWFpsSUZONWJXSnZiRnh1THk4Z2JtOXlJSEJ2YkhsbWFXeHNMQ0IwYUdWdUlHRWdjR3hoYVc0Z2JuVnRZbVZ5SUdseklIVnpaV1FnWm05eUlIQmxjbVp2Y20xaGJtTmxMbHh1WEc1MllYSWdVa1ZCUTFSZlJVeEZUVVZPVkY5VVdWQkZJRDBnZEhsd1pXOW1JRk41YldKdmJDQTlQVDBnSjJaMWJtTjBhVzl1SnlBbUppQlRlVzFpYjJ4YkoyWnZjaWRkSUNZbUlGTjViV0p2YkZzblptOXlKMTBvSjNKbFlXTjBMbVZzWlcxbGJuUW5LU0I4ZkNBd2VHVmhZemM3WEc1Y2JtMXZaSFZzWlM1bGVIQnZjblJ6SUQwZ1VrVkJRMVJmUlV4RlRVVk9WRjlVV1ZCRk95SXNJaThxS2x4dUlDb2dRMjl3ZVhKcFoyaDBJREl3TVRRdGNISmxjMlZ1ZEN3Z1JtRmpaV0p2YjJzc0lFbHVZeTVjYmlBcUlFRnNiQ0J5YVdkb2RITWdjbVZ6WlhKMlpXUXVYRzRnS2x4dUlDb2dWR2hwY3lCemIzVnlZMlVnWTI5a1pTQnBjeUJzYVdObGJuTmxaQ0IxYm1SbGNpQjBhR1VnUWxORUxYTjBlV3hsSUd4cFkyVnVjMlVnWm05MWJtUWdhVzRnZEdobFhHNGdLaUJNU1VORlRsTkZJR1pwYkdVZ2FXNGdkR2hsSUhKdmIzUWdaR2x5WldOMGIzSjVJRzltSUhSb2FYTWdjMjkxY21ObElIUnlaV1V1SUVGdUlHRmtaR2wwYVc5dVlXd2daM0poYm5SY2JpQXFJRzltSUhCaGRHVnVkQ0J5YVdkb2RITWdZMkZ1SUdKbElHWnZkVzVrSUdsdUlIUm9aU0JRUVZSRlRsUlRJR1pwYkdVZ2FXNGdkR2hsSUhOaGJXVWdaR2x5WldOMGIzSjVMbHh1SUNwY2JpQXFMMXh1WEc0dktpcGNiaUFxSUZKbFlXTjBSV3hsYldWdWRGWmhiR2xrWVhSdmNpQndjbTkyYVdSbGN5QmhJSGR5WVhCd1pYSWdZWEp2ZFc1a0lHRWdaV3hsYldWdWRDQm1ZV04wYjNKNVhHNGdLaUIzYUdsamFDQjJZV3hwWkdGMFpYTWdkR2hsSUhCeWIzQnpJSEJoYzNObFpDQjBieUIwYUdVZ1pXeGxiV1Z1ZEM0Z1ZHaHBjeUJwY3lCcGJuUmxibVJsWkNCMGJ5QmlaVnh1SUNvZ2RYTmxaQ0J2Ym14NUlHbHVJRVJGVmlCaGJtUWdZMjkxYkdRZ1ltVWdjbVZ3YkdGalpXUWdZbmtnWVNCemRHRjBhV01nZEhsd1pTQmphR1ZqYTJWeUlHWnZjaUJzWVc1bmRXRm5aWE5jYmlBcUlIUm9ZWFFnYzNWd2NHOXlkQ0JwZEM1Y2JpQXFMMXh1WEc0bmRYTmxJSE4wY21samRDYzdYRzVjYm5aaGNpQlNaV0ZqZEVOMWNuSmxiblJQZDI1bGNpQTlJSEpsY1hWcGNtVW9KeTR2VW1WaFkzUkRkWEp5Wlc1MFQzZHVaWEluS1R0Y2JuWmhjaUJTWldGamRFTnZiWEJ2Ym1WdWRGUnlaV1ZJYjI5cklEMGdjbVZ4ZFdseVpTZ25MaTlTWldGamRFTnZiWEJ2Ym1WdWRGUnlaV1ZJYjI5ckp5azdYRzUyWVhJZ1VtVmhZM1JGYkdWdFpXNTBJRDBnY21WeGRXbHlaU2duTGk5U1pXRmpkRVZzWlcxbGJuUW5LVHRjYmx4dWRtRnlJR05vWldOclVtVmhZM1JVZVhCbFUzQmxZeUE5SUhKbGNYVnBjbVVvSnk0dlkyaGxZMnRTWldGamRGUjVjR1ZUY0dWakp5azdYRzVjYm5aaGNpQmpZVzVFWldacGJtVlFjbTl3WlhKMGVTQTlJSEpsY1hWcGNtVW9KeTR2WTJGdVJHVm1hVzVsVUhKdmNHVnlkSGtuS1R0Y2JuWmhjaUJuWlhSSmRHVnlZWFJ2Y2tadUlEMGdjbVZ4ZFdseVpTZ25MaTluWlhSSmRHVnlZWFJ2Y2tadUp5azdYRzUyWVhJZ2QyRnlibWx1WnlBOUlISmxjWFZwY21Vb0oyWmlhbk12YkdsaUwzZGhjbTVwYm1jbktUdGNiblpoY2lCc2IzZFFjbWx2Y21sMGVWZGhjbTVwYm1jZ1BTQnlaWEYxYVhKbEtDY3VMMnh2ZDFCeWFXOXlhWFI1VjJGeWJtbHVaeWNwTzF4dVhHNW1kVzVqZEdsdmJpQm5aWFJFWldOc1lYSmhkR2x2YmtWeWNtOXlRV1JrWlc1a2RXMG9LU0I3WEc0Z0lHbG1JQ2hTWldGamRFTjFjbkpsYm5SUGQyNWxjaTVqZFhKeVpXNTBLU0I3WEc0Z0lDQWdkbUZ5SUc1aGJXVWdQU0JTWldGamRFTjFjbkpsYm5SUGQyNWxjaTVqZFhKeVpXNTBMbWRsZEU1aGJXVW9LVHRjYmlBZ0lDQnBaaUFvYm1GdFpTa2dlMXh1SUNBZ0lDQWdjbVYwZFhKdUlDY2dRMmhsWTJzZ2RHaGxJSEpsYm1SbGNpQnRaWFJvYjJRZ2IyWWdZQ2NnS3lCdVlXMWxJQ3NnSjJBdUp6dGNiaUFnSUNCOVhHNGdJSDFjYmlBZ2NtVjBkWEp1SUNjbk8xeHVmVnh1WEc1bWRXNWpkR2x2YmlCblpYUlRiM1Z5WTJWSmJtWnZSWEp5YjNKQlpHUmxibVIxYlNobGJHVnRaVzUwVUhKdmNITXBJSHRjYmlBZ2FXWWdLR1ZzWlcxbGJuUlFjbTl3Y3lBaFBUMGdiblZzYkNBbUppQmxiR1Z0Wlc1MFVISnZjSE1nSVQwOUlIVnVaR1ZtYVc1bFpDQW1KaUJsYkdWdFpXNTBVSEp2Y0hNdVgxOXpiM1Z5WTJVZ0lUMDlJSFZ1WkdWbWFXNWxaQ2tnZTF4dUlDQWdJSFpoY2lCemIzVnlZMlVnUFNCbGJHVnRaVzUwVUhKdmNITXVYMTl6YjNWeVkyVTdYRzRnSUNBZ2RtRnlJR1pwYkdWT1lXMWxJRDBnYzI5MWNtTmxMbVpwYkdWT1lXMWxMbkpsY0d4aFkyVW9MMTR1S2x0Y1hGeGNYRnd2WFM4c0lDY25LVHRjYmlBZ0lDQjJZWElnYkdsdVpVNTFiV0psY2lBOUlITnZkWEpqWlM1c2FXNWxUblZ0WW1WeU8xeHVJQ0FnSUhKbGRIVnliaUFuSUVOb1pXTnJJSGx2ZFhJZ1kyOWtaU0JoZENBbklDc2dabWxzWlU1aGJXVWdLeUFuT2ljZ0t5QnNhVzVsVG5WdFltVnlJQ3NnSnk0bk8xeHVJQ0I5WEc0Z0lISmxkSFZ5YmlBbkp6dGNibjFjYmx4dUx5b3FYRzRnS2lCWFlYSnVJR2xtSUhSb1pYSmxKM01nYm04Z2EyVjVJR1Y0Y0d4cFkybDBiSGtnYzJWMElHOXVJR1I1Ym1GdGFXTWdZWEp5WVhseklHOW1JR05vYVd4a2NtVnVJRzl5WEc0Z0tpQnZZbXBsWTNRZ2EyVjVjeUJoY21VZ2JtOTBJSFpoYkdsa0xpQlVhR2x6SUdGc2JHOTNjeUIxY3lCMGJ5QnJaV1Z3SUhSeVlXTnJJRzltSUdOb2FXeGtjbVZ1SUdKbGRIZGxaVzVjYmlBcUlIVndaR0YwWlhNdVhHNGdLaTljYm5aaGNpQnZkMjVsY2toaGMwdGxlVlZ6WlZkaGNtNXBibWNnUFNCN2ZUdGNibHh1Wm5WdVkzUnBiMjRnWjJWMFEzVnljbVZ1ZEVOdmJYQnZibVZ1ZEVWeWNtOXlTVzVtYnlod1lYSmxiblJVZVhCbEtTQjdYRzRnSUhaaGNpQnBibVp2SUQwZ1oyVjBSR1ZqYkdGeVlYUnBiMjVGY25KdmNrRmtaR1Z1WkhWdEtDazdYRzVjYmlBZ2FXWWdLQ0ZwYm1adktTQjdYRzRnSUNBZ2RtRnlJSEJoY21WdWRFNWhiV1VnUFNCMGVYQmxiMllnY0dGeVpXNTBWSGx3WlNBOVBUMGdKM04wY21sdVp5Y2dQeUJ3WVhKbGJuUlVlWEJsSURvZ2NHRnlaVzUwVkhsd1pTNWthWE53YkdGNVRtRnRaU0I4ZkNCd1lYSmxiblJVZVhCbExtNWhiV1U3WEc0Z0lDQWdhV1lnS0hCaGNtVnVkRTVoYldVcElIdGNiaUFnSUNBZ0lHbHVabThnUFNBbklFTm9aV05ySUhSb1pTQjBiM0F0YkdWMlpXd2djbVZ1WkdWeUlHTmhiR3dnZFhOcGJtY2dQQ2NnS3lCd1lYSmxiblJPWVcxbElDc2dKejR1Snp0Y2JpQWdJQ0I5WEc0Z0lIMWNiaUFnY21WMGRYSnVJR2x1Wm04N1hHNTlYRzVjYmk4cUtseHVJQ29nVjJGeWJpQnBaaUIwYUdVZ1pXeGxiV1Z1ZENCa2IyVnpiaWQwSUdoaGRtVWdZVzRnWlhod2JHbGphWFFnYTJWNUlHRnpjMmxuYm1Wa0lIUnZJR2wwTGx4dUlDb2dWR2hwY3lCbGJHVnRaVzUwSUdseklHbHVJR0Z1SUdGeWNtRjVMaUJVYUdVZ1lYSnlZWGtnWTI5MWJHUWdaM0p2ZHlCaGJtUWdjMmh5YVc1cklHOXlJR0psWEc0Z0tpQnlaVzl5WkdWeVpXUXVJRUZzYkNCamFHbHNaSEpsYmlCMGFHRjBJR2hoZG1WdUozUWdZV3h5WldGa2VTQmlaV1Z1SUhaaGJHbGtZWFJsWkNCaGNtVWdjbVZ4ZFdseVpXUWdkRzljYmlBcUlHaGhkbVVnWVNCY0ltdGxlVndpSUhCeWIzQmxjblI1SUdGemMybG5ibVZrSUhSdklHbDBMaUJGY25KdmNpQnpkR0YwZFhObGN5QmhjbVVnWTJGamFHVmtJSE52SUdFZ2QyRnlibWx1WjF4dUlDb2dkMmxzYkNCdmJteDVJR0psSUhOb2IzZHVJRzl1WTJVdVhHNGdLbHh1SUNvZ1FHbHVkR1Z5Ym1Gc1hHNGdLaUJBY0dGeVlXMGdlMUpsWVdOMFJXeGxiV1Z1ZEgwZ1pXeGxiV1Z1ZENCRmJHVnRaVzUwSUhSb1lYUWdjbVZ4ZFdseVpYTWdZU0JyWlhrdVhHNGdLaUJBY0dGeVlXMGdleXA5SUhCaGNtVnVkRlI1Y0dVZ1pXeGxiV1Z1ZENkeklIQmhjbVZ1ZENkeklIUjVjR1V1WEc0Z0tpOWNibVoxYm1OMGFXOXVJSFpoYkdsa1lYUmxSWGh3YkdsamFYUkxaWGtvWld4bGJXVnVkQ3dnY0dGeVpXNTBWSGx3WlNrZ2UxeHVJQ0JwWmlBb0lXVnNaVzFsYm5RdVgzTjBiM0psSUh4OElHVnNaVzFsYm5RdVgzTjBiM0psTG5aaGJHbGtZWFJsWkNCOGZDQmxiR1Z0Wlc1MExtdGxlU0FoUFNCdWRXeHNLU0I3WEc0Z0lDQWdjbVYwZFhKdU8xeHVJQ0I5WEc0Z0lHVnNaVzFsYm5RdVgzTjBiM0psTG5aaGJHbGtZWFJsWkNBOUlIUnlkV1U3WEc1Y2JpQWdkbUZ5SUcxbGJXOXBlbVZ5SUQwZ2IzZHVaWEpJWVhOTFpYbFZjMlZYWVhKdWFXNW5MblZ1YVhGMVpVdGxlU0I4ZkNBb2IzZHVaWEpJWVhOTFpYbFZjMlZYWVhKdWFXNW5MblZ1YVhGMVpVdGxlU0E5SUh0OUtUdGNibHh1SUNCMllYSWdZM1Z5Y21WdWRFTnZiWEJ2Ym1WdWRFVnljbTl5U1c1bWJ5QTlJR2RsZEVOMWNuSmxiblJEYjIxd2IyNWxiblJGY25KdmNrbHVabThvY0dGeVpXNTBWSGx3WlNrN1hHNGdJR2xtSUNodFpXMXZhWHBsY2x0amRYSnlaVzUwUTI5dGNHOXVaVzUwUlhKeWIzSkpibVp2WFNrZ2UxeHVJQ0FnSUhKbGRIVnlianRjYmlBZ2ZWeHVJQ0J0WlcxdmFYcGxjbHRqZFhKeVpXNTBRMjl0Y0c5dVpXNTBSWEp5YjNKSmJtWnZYU0E5SUhSeWRXVTdYRzVjYmlBZ0x5OGdWWE4xWVd4c2VTQjBhR1VnWTNWeWNtVnVkQ0J2ZDI1bGNpQnBjeUIwYUdVZ2IyWm1aVzVrWlhJc0lHSjFkQ0JwWmlCcGRDQmhZMk5sY0hSeklHTm9hV3hrY21WdUlHRnpJR0ZjYmlBZ0x5OGdjSEp2Y0dWeWRIa3NJR2wwSUcxaGVTQmlaU0IwYUdVZ1kzSmxZWFJ2Y2lCdlppQjBhR1VnWTJocGJHUWdkR2hoZENkeklISmxjM0J2Ym5OcFlteGxJR1p2Y2x4dUlDQXZMeUJoYzNOcFoyNXBibWNnYVhRZ1lTQnJaWGt1WEc0Z0lIWmhjaUJqYUdsc1pFOTNibVZ5SUQwZ0p5YzdYRzRnSUdsbUlDaGxiR1Z0Wlc1MElDWW1JR1ZzWlcxbGJuUXVYMjkzYm1WeUlDWW1JR1ZzWlcxbGJuUXVYMjkzYm1WeUlDRTlQU0JTWldGamRFTjFjbkpsYm5SUGQyNWxjaTVqZFhKeVpXNTBLU0I3WEc0Z0lDQWdMeThnUjJsMlpTQjBhR1VnWTI5dGNHOXVaVzUwSUhSb1lYUWdiM0pwWjJsdVlXeHNlU0JqY21WaGRHVmtJSFJvYVhNZ1kyaHBiR1F1WEc0Z0lDQWdZMmhwYkdSUGQyNWxjaUE5SUNjZ1NYUWdkMkZ6SUhCaGMzTmxaQ0JoSUdOb2FXeGtJR1p5YjIwZ0p5QXJJR1ZzWlcxbGJuUXVYMjkzYm1WeUxtZGxkRTVoYldVb0tTQXJJQ2N1Snp0Y2JpQWdmVnh1WEc0Z0lIQnliMk5sYzNNdVpXNTJMazVQUkVWZlJVNVdJQ0U5UFNBbmNISnZaSFZqZEdsdmJpY2dQeUIzWVhKdWFXNW5LR1poYkhObExDQW5SV0ZqYUNCamFHbHNaQ0JwYmlCaGJpQmhjbkpoZVNCdmNpQnBkR1Z5WVhSdmNpQnphRzkxYkdRZ2FHRjJaU0JoSUhWdWFYRjFaU0JjSW10bGVWd2lJSEJ5YjNBdUp5QXJJQ2NsY3lWeklGTmxaU0JvZEhSd2N6b3ZMMlppTG0xbEwzSmxZV04wTFhkaGNtNXBibWN0YTJWNWN5Qm1iM0lnYlc5eVpTQnBibVp2Y20xaGRHbHZiaTRsY3ljc0lHTjFjbkpsYm5SRGIyMXdiMjVsYm5SRmNuSnZja2x1Wm04c0lHTm9hV3hrVDNkdVpYSXNJRkpsWVdOMFEyOXRjRzl1Wlc1MFZISmxaVWh2YjJzdVoyVjBRM1Z5Y21WdWRGTjBZV05yUVdSa1pXNWtkVzBvWld4bGJXVnVkQ2twSURvZ2RtOXBaQ0F3TzF4dWZWeHVYRzR2S2lwY2JpQXFJRVZ1YzNWeVpTQjBhR0YwSUdWMlpYSjVJR1ZzWlcxbGJuUWdaV2wwYUdWeUlHbHpJSEJoYzNObFpDQnBiaUJoSUhOMFlYUnBZeUJzYjJOaGRHbHZiaXdnYVc0Z1lXNWNiaUFxSUdGeWNtRjVJSGRwZEdnZ1lXNGdaWGh3YkdsamFYUWdhMlY1Y3lCd2NtOXdaWEowZVNCa1pXWnBibVZrTENCdmNpQnBiaUJoYmlCdlltcGxZM1FnYkdsMFpYSmhiRnh1SUNvZ2QybDBhQ0IyWVd4cFpDQnJaWGtnY0hKdmNHVnlkSGt1WEc0Z0tseHVJQ29nUUdsdWRHVnlibUZzWEc0Z0tpQkFjR0Z5WVcwZ2UxSmxZV04wVG05a1pYMGdibTlrWlNCVGRHRjBhV05oYkd4NUlIQmhjM05sWkNCamFHbHNaQ0J2WmlCaGJua2dkSGx3WlM1Y2JpQXFJRUJ3WVhKaGJTQjdLbjBnY0dGeVpXNTBWSGx3WlNCdWIyUmxKM01nY0dGeVpXNTBKM01nZEhsd1pTNWNiaUFxTDF4dVpuVnVZM1JwYjI0Z2RtRnNhV1JoZEdWRGFHbHNaRXRsZVhNb2JtOWtaU3dnY0dGeVpXNTBWSGx3WlNrZ2UxeHVJQ0JwWmlBb2RIbHdaVzltSUc1dlpHVWdJVDA5SUNkdlltcGxZM1FuS1NCN1hHNGdJQ0FnY21WMGRYSnVPMXh1SUNCOVhHNGdJR2xtSUNoQmNuSmhlUzVwYzBGeWNtRjVLRzV2WkdVcEtTQjdYRzRnSUNBZ1ptOXlJQ2gyWVhJZ2FTQTlJREE3SUdrZ1BDQnViMlJsTG14bGJtZDBhRHNnYVNzcktTQjdYRzRnSUNBZ0lDQjJZWElnWTJocGJHUWdQU0J1YjJSbFcybGRPMXh1SUNBZ0lDQWdhV1lnS0ZKbFlXTjBSV3hsYldWdWRDNXBjMVpoYkdsa1JXeGxiV1Z1ZENoamFHbHNaQ2twSUh0Y2JpQWdJQ0FnSUNBZ2RtRnNhV1JoZEdWRmVIQnNhV05wZEV0bGVTaGphR2xzWkN3Z2NHRnlaVzUwVkhsd1pTazdYRzRnSUNBZ0lDQjlYRzRnSUNBZ2ZWeHVJQ0I5SUdWc2MyVWdhV1lnS0ZKbFlXTjBSV3hsYldWdWRDNXBjMVpoYkdsa1JXeGxiV1Z1ZENodWIyUmxLU2tnZTF4dUlDQWdJQzh2SUZSb2FYTWdaV3hsYldWdWRDQjNZWE1nY0dGemMyVmtJR2x1SUdFZ2RtRnNhV1FnYkc5allYUnBiMjR1WEc0Z0lDQWdhV1lnS0c1dlpHVXVYM04wYjNKbEtTQjdYRzRnSUNBZ0lDQnViMlJsTGw5emRHOXlaUzUyWVd4cFpHRjBaV1FnUFNCMGNuVmxPMXh1SUNBZ0lIMWNiaUFnZlNCbGJITmxJR2xtSUNodWIyUmxLU0I3WEc0Z0lDQWdkbUZ5SUdsMFpYSmhkRzl5Um00Z1BTQm5aWFJKZEdWeVlYUnZja1p1S0c1dlpHVXBPMXh1SUNBZ0lDOHZJRVZ1ZEhKNUlHbDBaWEpoZEc5eWN5QndjbTkyYVdSbElHbHRjR3hwWTJsMElHdGxlWE11WEc0Z0lDQWdhV1lnS0dsMFpYSmhkRzl5Um00cElIdGNiaUFnSUNBZ0lHbG1JQ2hwZEdWeVlYUnZja1p1SUNFOVBTQnViMlJsTG1WdWRISnBaWE1wSUh0Y2JpQWdJQ0FnSUNBZ2RtRnlJR2wwWlhKaGRHOXlJRDBnYVhSbGNtRjBiM0pHYmk1allXeHNLRzV2WkdVcE8xeHVJQ0FnSUNBZ0lDQjJZWElnYzNSbGNEdGNiaUFnSUNBZ0lDQWdkMmhwYkdVZ0tDRW9jM1JsY0NBOUlHbDBaWEpoZEc5eUxtNWxlSFFvS1NrdVpHOXVaU2tnZTF4dUlDQWdJQ0FnSUNBZ0lHbG1JQ2hTWldGamRFVnNaVzFsYm5RdWFYTldZV3hwWkVWc1pXMWxiblFvYzNSbGNDNTJZV3gxWlNrcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUhaaGJHbGtZWFJsUlhod2JHbGphWFJMWlhrb2MzUmxjQzUyWVd4MVpTd2djR0Z5Wlc1MFZIbHdaU2s3WEc0Z0lDQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQjlYRzRnSUNBZ2ZWeHVJQ0I5WEc1OVhHNWNiaThxS2x4dUlDb2dSMmwyWlc0Z1lXNGdaV3hsYldWdWRDd2dkbUZzYVdSaGRHVWdkR2hoZENCcGRITWdjSEp2Y0hNZ1ptOXNiRzkzSUhSb1pTQndjbTl3Vkhsd1pYTWdaR1ZtYVc1cGRHbHZiaXhjYmlBcUlIQnliM1pwWkdWa0lHSjVJSFJvWlNCMGVYQmxMbHh1SUNwY2JpQXFJRUJ3WVhKaGJTQjdVbVZoWTNSRmJHVnRaVzUwZlNCbGJHVnRaVzUwWEc0Z0tpOWNibVoxYm1OMGFXOXVJSFpoYkdsa1lYUmxVSEp2Y0ZSNWNHVnpLR1ZzWlcxbGJuUXBJSHRjYmlBZ2RtRnlJR052YlhCdmJtVnVkRU5zWVhOeklEMGdaV3hsYldWdWRDNTBlWEJsTzF4dUlDQnBaaUFvZEhsd1pXOW1JR052YlhCdmJtVnVkRU5zWVhOeklDRTlQU0FuWm5WdVkzUnBiMjRuS1NCN1hHNGdJQ0FnY21WMGRYSnVPMXh1SUNCOVhHNGdJSFpoY2lCdVlXMWxJRDBnWTI5dGNHOXVaVzUwUTJ4aGMzTXVaR2x6Y0d4aGVVNWhiV1VnZkh3Z1kyOXRjRzl1Wlc1MFEyeGhjM011Ym1GdFpUdGNiaUFnYVdZZ0tHTnZiWEJ2Ym1WdWRFTnNZWE56TG5CeWIzQlVlWEJsY3lrZ2UxeHVJQ0FnSUdOb1pXTnJVbVZoWTNSVWVYQmxVM0JsWXloamIyMXdiMjVsYm5SRGJHRnpjeTV3Y205d1ZIbHdaWE1zSUdWc1pXMWxiblF1Y0hKdmNITXNJQ2R3Y205d0p5d2dibUZ0WlN3Z1pXeGxiV1Z1ZEN3Z2JuVnNiQ2s3WEc0Z0lIMWNiaUFnYVdZZ0tIUjVjR1Z2WmlCamIyMXdiMjVsYm5SRGJHRnpjeTVuWlhSRVpXWmhkV3gwVUhKdmNITWdQVDA5SUNkbWRXNWpkR2x2YmljcElIdGNiaUFnSUNCd2NtOWpaWE56TG1WdWRpNU9UMFJGWDBWT1ZpQWhQVDBnSjNCeWIyUjFZM1JwYjI0bklEOGdkMkZ5Ym1sdVp5aGpiMjF3YjI1bGJuUkRiR0Z6Y3k1blpYUkVaV1poZFd4MFVISnZjSE11YVhOU1pXRmpkRU5zWVhOelFYQndjbTkyWldRc0lDZG5aWFJFWldaaGRXeDBVSEp2Y0hNZ2FYTWdiMjVzZVNCMWMyVmtJRzl1SUdOc1lYTnphV01nVW1WaFkzUXVZM0psWVhSbFEyeGhjM01nSnlBcklDZGtaV1pwYm1sMGFXOXVjeTRnVlhObElHRWdjM1JoZEdsaklIQnliM0JsY25SNUlHNWhiV1ZrSUdCa1pXWmhkV3gwVUhKdmNITmdJR2x1YzNSbFlXUXVKeWtnT2lCMmIybGtJREE3WEc0Z0lIMWNibjFjYmx4dWRtRnlJRkpsWVdOMFJXeGxiV1Z1ZEZaaGJHbGtZWFJ2Y2lBOUlIdGNiaUFnWTNKbFlYUmxSV3hsYldWdWREb2dablZ1WTNScGIyNGdLSFI1Y0dVc0lIQnliM0J6TENCamFHbHNaSEpsYmlrZ2UxeHVJQ0FnSUhaaGNpQjJZV3hwWkZSNWNHVWdQU0IwZVhCbGIyWWdkSGx3WlNBOVBUMGdKM04wY21sdVp5Y2dmSHdnZEhsd1pXOW1JSFI1Y0dVZ1BUMDlJQ2RtZFc1amRHbHZiaWM3WEc0Z0lDQWdMeThnVjJVZ2QyRnliaUJwYmlCMGFHbHpJR05oYzJVZ1luVjBJR1J2YmlkMElIUm9jbTkzTGlCWFpTQmxlSEJsWTNRZ2RHaGxJR1ZzWlcxbGJuUWdZM0psWVhScGIyNGdkRzljYmlBZ0lDQXZMeUJ6ZFdOalpXVmtJR0Z1WkNCMGFHVnlaU0IzYVd4c0lHeHBhMlZzZVNCaVpTQmxjbkp2Y25NZ2FXNGdjbVZ1WkdWeUxseHVJQ0FnSUdsbUlDZ2hkbUZzYVdSVWVYQmxLU0I3WEc0Z0lDQWdJQ0JwWmlBb2RIbHdaVzltSUhSNWNHVWdJVDA5SUNkbWRXNWpkR2x2YmljZ0ppWWdkSGx3Wlc5bUlIUjVjR1VnSVQwOUlDZHpkSEpwYm1jbktTQjdYRzRnSUNBZ0lDQWdJSFpoY2lCcGJtWnZJRDBnSnljN1hHNGdJQ0FnSUNBZ0lHbG1JQ2gwZVhCbElEMDlQU0IxYm1SbFptbHVaV1FnZkh3Z2RIbHdaVzltSUhSNWNHVWdQVDA5SUNkdlltcGxZM1FuSUNZbUlIUjVjR1VnSVQwOUlHNTFiR3dnSmlZZ1QySnFaV04wTG10bGVYTW9kSGx3WlNrdWJHVnVaM1JvSUQwOVBTQXdLU0I3WEc0Z0lDQWdJQ0FnSUNBZ2FXNW1ieUFyUFNBbklGbHZkU0JzYVd0bGJIa2dabTl5WjI5MElIUnZJR1Y0Y0c5eWRDQjViM1Z5SUdOdmJYQnZibVZ1ZENCbWNtOXRJSFJvWlNCbWFXeGxJQ2NnS3lCY0ltbDBKM01nWkdWbWFXNWxaQ0JwYmk1Y0lqdGNiaUFnSUNBZ0lDQWdmVnh1WEc0Z0lDQWdJQ0FnSUhaaGNpQnpiM1Z5WTJWSmJtWnZJRDBnWjJWMFUyOTFjbU5sU1c1bWIwVnljbTl5UVdSa1pXNWtkVzBvY0hKdmNITXBPMXh1SUNBZ0lDQWdJQ0JwWmlBb2MyOTFjbU5sU1c1bWJ5a2dlMXh1SUNBZ0lDQWdJQ0FnSUdsdVptOGdLejBnYzI5MWNtTmxTVzVtYnp0Y2JpQWdJQ0FnSUNBZ2ZTQmxiSE5sSUh0Y2JpQWdJQ0FnSUNBZ0lDQnBibVp2SUNzOUlHZGxkRVJsWTJ4aGNtRjBhVzl1UlhKeWIzSkJaR1JsYm1SMWJTZ3BPMXh1SUNBZ0lDQWdJQ0I5WEc1Y2JpQWdJQ0FnSUNBZ2FXNW1ieUFyUFNCU1pXRmpkRU52YlhCdmJtVnVkRlJ5WldWSWIyOXJMbWRsZEVOMWNuSmxiblJUZEdGamEwRmtaR1Z1WkhWdEtDazdYRzVjYmlBZ0lDQWdJQ0FnZG1GeUlHTjFjbkpsYm5SVGIzVnlZMlVnUFNCd2NtOXdjeUFoUFQwZ2JuVnNiQ0FtSmlCd2NtOXdjeUFoUFQwZ2RXNWtaV1pwYm1Wa0lDWW1JSEJ5YjNCekxsOWZjMjkxY21ObElDRTlQU0IxYm1SbFptbHVaV1FnUHlCd2NtOXdjeTVmWDNOdmRYSmpaU0E2SUc1MWJHdzdYRzRnSUNBZ0lDQWdJRkpsWVdOMFEyOXRjRzl1Wlc1MFZISmxaVWh2YjJzdWNIVnphRTV2YmxOMFlXNWtZWEprVjJGeWJtbHVaMU4wWVdOcktIUnlkV1VzSUdOMWNuSmxiblJUYjNWeVkyVXBPMXh1SUNBZ0lDQWdJQ0J3Y205alpYTnpMbVZ1ZGk1T1QwUkZYMFZPVmlBaFBUMGdKM0J5YjJSMVkzUnBiMjRuSUQ4Z2QyRnlibWx1WnlobVlXeHpaU3dnSjFKbFlXTjBMbU55WldGMFpVVnNaVzFsYm5RNklIUjVjR1VnYVhNZ2FXNTJZV3hwWkNBdExTQmxlSEJsWTNSbFpDQmhJSE4wY21sdVp5QW9abTl5SUNjZ0t5QW5ZblZwYkhRdGFXNGdZMjl0Y0c5dVpXNTBjeWtnYjNJZ1lTQmpiR0Z6Y3k5bWRXNWpkR2x2YmlBb1ptOXlJR052YlhCdmMybDBaU0FuSUNzZ0oyTnZiWEJ2Ym1WdWRITXBJR0oxZENCbmIzUTZJQ1Z6TGlWekp5d2dkSGx3WlNBOVBTQnVkV3hzSUQ4Z2RIbHdaU0E2SUhSNWNHVnZaaUIwZVhCbExDQnBibVp2S1NBNklIWnZhV1FnTUR0Y2JpQWdJQ0FnSUNBZ1VtVmhZM1JEYjIxd2IyNWxiblJVY21WbFNHOXZheTV3YjNCT2IyNVRkR0Z1WkdGeVpGZGhjbTVwYm1kVGRHRmpheWdwTzF4dUlDQWdJQ0FnZlZ4dUlDQWdJSDFjYmx4dUlDQWdJSFpoY2lCbGJHVnRaVzUwSUQwZ1VtVmhZM1JGYkdWdFpXNTBMbU55WldGMFpVVnNaVzFsYm5RdVlYQndiSGtvZEdocGN5d2dZWEpuZFcxbGJuUnpLVHRjYmx4dUlDQWdJQzh2SUZSb1pTQnlaWE4xYkhRZ1kyRnVJR0psSUc1MWJHeHBjMmdnYVdZZ1lTQnRiMk5ySUc5eUlHRWdZM1Z6ZEc5dElHWjFibU4wYVc5dUlHbHpJSFZ6WldRdVhHNGdJQ0FnTHk4Z1ZFOUVUem9nUkhKdmNDQjBhR2x6SUhkb1pXNGdkR2hsYzJVZ1lYSmxJRzV2SUd4dmJtZGxjaUJoYkd4dmQyVmtJR0Z6SUhSb1pTQjBlWEJsSUdGeVozVnRaVzUwTGx4dUlDQWdJR2xtSUNobGJHVnRaVzUwSUQwOUlHNTFiR3dwSUh0Y2JpQWdJQ0FnSUhKbGRIVnliaUJsYkdWdFpXNTBPMXh1SUNBZ0lIMWNibHh1SUNBZ0lDOHZJRk5yYVhBZ2EyVjVJSGRoY201cGJtY2dhV1lnZEdobElIUjVjR1VnYVhOdUozUWdkbUZzYVdRZ2MybHVZMlVnYjNWeUlHdGxlU0IyWVd4cFpHRjBhVzl1SUd4dloybGpYRzRnSUNBZ0x5OGdaRzlsYzI0bmRDQmxlSEJsWTNRZ1lTQnViMjR0YzNSeWFXNW5MMloxYm1OMGFXOXVJSFI1Y0dVZ1lXNWtJR05oYmlCMGFISnZkeUJqYjI1bWRYTnBibWNnWlhKeWIzSnpMbHh1SUNBZ0lDOHZJRmRsSUdSdmJpZDBJSGRoYm5RZ1pYaGpaWEIwYVc5dUlHSmxhR0YyYVc5eUlIUnZJR1JwWm1abGNpQmlaWFIzWldWdUlHUmxkaUJoYm1RZ2NISnZaQzVjYmlBZ0lDQXZMeUFvVW1WdVpHVnlhVzVuSUhkcGJHd2dkR2h5YjNjZ2QybDBhQ0JoSUdobGJIQm1kV3dnYldWemMyRm5aU0JoYm1RZ1lYTWdjMjl2YmlCaGN5QjBhR1VnZEhsd1pTQnBjMXh1SUNBZ0lDOHZJR1pwZUdWa0xDQjBhR1VnYTJWNUlIZGhjbTVwYm1keklIZHBiR3dnWVhCd1pXRnlMaWxjYmlBZ0lDQnBaaUFvZG1Gc2FXUlVlWEJsS1NCN1hHNGdJQ0FnSUNCbWIzSWdLSFpoY2lCcElEMGdNanNnYVNBOElHRnlaM1Z0Wlc1MGN5NXNaVzVuZEdnN0lHa3JLeWtnZTF4dUlDQWdJQ0FnSUNCMllXeHBaR0YwWlVOb2FXeGtTMlY1Y3loaGNtZDFiV1Z1ZEhOYmFWMHNJSFI1Y0dVcE8xeHVJQ0FnSUNBZ2ZWeHVJQ0FnSUgxY2JseHVJQ0FnSUhaaGJHbGtZWFJsVUhKdmNGUjVjR1Z6S0dWc1pXMWxiblFwTzF4dVhHNGdJQ0FnY21WMGRYSnVJR1ZzWlcxbGJuUTdYRzRnSUgwc1hHNWNiaUFnWTNKbFlYUmxSbUZqZEc5eWVUb2dablZ1WTNScGIyNGdLSFI1Y0dVcElIdGNiaUFnSUNCMllYSWdkbUZzYVdSaGRHVmtSbUZqZEc5eWVTQTlJRkpsWVdOMFJXeGxiV1Z1ZEZaaGJHbGtZWFJ2Y2k1amNtVmhkR1ZGYkdWdFpXNTBMbUpwYm1Rb2JuVnNiQ3dnZEhsd1pTazdYRzRnSUNBZ0x5OGdUR1ZuWVdONUlHaHZiMnNnVkU5RVR6b2dWMkZ5YmlCcFppQjBhR2x6SUdseklHRmpZMlZ6YzJWa1hHNGdJQ0FnZG1Gc2FXUmhkR1ZrUm1GamRHOXllUzUwZVhCbElEMGdkSGx3WlR0Y2JseHVJQ0FnSUdsbUlDaHdjbTlqWlhOekxtVnVkaTVPVDBSRlgwVk9WaUFoUFQwZ0ozQnliMlIxWTNScGIyNG5LU0I3WEc0Z0lDQWdJQ0JwWmlBb1kyRnVSR1ZtYVc1bFVISnZjR1Z5ZEhrcElIdGNiaUFnSUNBZ0lDQWdUMkpxWldOMExtUmxabWx1WlZCeWIzQmxjblI1S0haaGJHbGtZWFJsWkVaaFkzUnZjbmtzSUNkMGVYQmxKeXdnZTF4dUlDQWdJQ0FnSUNBZ0lHVnVkVzFsY21GaWJHVTZJR1poYkhObExGeHVJQ0FnSUNBZ0lDQWdJR2RsZERvZ1puVnVZM1JwYjI0Z0tDa2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ2JHOTNVSEpwYjNKcGRIbFhZWEp1YVc1bktHWmhiSE5sTENBblJtRmpkRzl5ZVM1MGVYQmxJR2x6SUdSbGNISmxZMkYwWldRdUlFRmpZMlZ6Y3lCMGFHVWdZMnhoYzNNZ1pHbHlaV04wYkhrZ0p5QXJJQ2RpWldadmNtVWdjR0Z6YzJsdVp5QnBkQ0IwYnlCamNtVmhkR1ZHWVdOMGIzSjVMaWNwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdUMkpxWldOMExtUmxabWx1WlZCeWIzQmxjblI1S0hSb2FYTXNJQ2QwZVhCbEp5d2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQjJZV3gxWlRvZ2RIbHdaVnh1SUNBZ0lDQWdJQ0FnSUNBZ2ZTazdYRzRnSUNBZ0lDQWdJQ0FnSUNCeVpYUjFjbTRnZEhsd1pUdGNiaUFnSUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0FnSUgwcE8xeHVJQ0FnSUNBZ2ZWeHVJQ0FnSUgxY2JseHVJQ0FnSUhKbGRIVnliaUIyWVd4cFpHRjBaV1JHWVdOMGIzSjVPMXh1SUNCOUxGeHVYRzRnSUdOc2IyNWxSV3hsYldWdWREb2dablZ1WTNScGIyNGdLR1ZzWlcxbGJuUXNJSEJ5YjNCekxDQmphR2xzWkhKbGJpa2dlMXh1SUNBZ0lIWmhjaUJ1WlhkRmJHVnRaVzUwSUQwZ1VtVmhZM1JGYkdWdFpXNTBMbU5zYjI1bFJXeGxiV1Z1ZEM1aGNIQnNlU2gwYUdsekxDQmhjbWQxYldWdWRITXBPMXh1SUNBZ0lHWnZjaUFvZG1GeUlHa2dQU0F5T3lCcElEd2dZWEpuZFcxbGJuUnpMbXhsYm1kMGFEc2dhU3NyS1NCN1hHNGdJQ0FnSUNCMllXeHBaR0YwWlVOb2FXeGtTMlY1Y3loaGNtZDFiV1Z1ZEhOYmFWMHNJRzVsZDBWc1pXMWxiblF1ZEhsd1pTazdYRzRnSUNBZ2ZWeHVJQ0FnSUhaaGJHbGtZWFJsVUhKdmNGUjVjR1Z6S0c1bGQwVnNaVzFsYm5RcE8xeHVJQ0FnSUhKbGRIVnliaUJ1WlhkRmJHVnRaVzUwTzF4dUlDQjlYRzU5TzF4dVhHNXRiMlIxYkdVdVpYaHdiM0owY3lBOUlGSmxZV04wUld4bGJXVnVkRlpoYkdsa1lYUnZjanNpTENJdktpcGNiaUFxSUVOdmNIbHlhV2RvZENBeU1ERTFMWEJ5WlhObGJuUXNJRVpoWTJWaWIyOXJMQ0JKYm1NdVhHNGdLaUJCYkd3Z2NtbG5hSFJ6SUhKbGMyVnlkbVZrTGx4dUlDcGNiaUFxSUZSb2FYTWdjMjkxY21ObElHTnZaR1VnYVhNZ2JHbGpaVzV6WldRZ2RXNWtaWElnZEdobElFSlRSQzF6ZEhsc1pTQnNhV05sYm5ObElHWnZkVzVrSUdsdUlIUm9aVnh1SUNvZ1RFbERSVTVUUlNCbWFXeGxJR2x1SUhSb1pTQnliMjkwSUdScGNtVmpkRzl5ZVNCdlppQjBhR2x6SUhOdmRYSmpaU0IwY21WbExpQkJiaUJoWkdScGRHbHZibUZzSUdkeVlXNTBYRzRnS2lCdlppQndZWFJsYm5RZ2NtbG5hSFJ6SUdOaGJpQmlaU0JtYjNWdVpDQnBiaUIwYUdVZ1VFRlVSVTVVVXlCbWFXeGxJR2x1SUhSb1pTQnpZVzFsSUdScGNtVmpkRzl5ZVM1Y2JpQXFYRzRnS2k5Y2JseHVKM1Z6WlNCemRISnBZM1FuTzF4dVhHNTJZWElnZDJGeWJtbHVaeUE5SUhKbGNYVnBjbVVvSjJaaWFuTXZiR2xpTDNkaGNtNXBibWNuS1R0Y2JseHVablZ1WTNScGIyNGdkMkZ5Yms1dmIzQW9jSFZpYkdsalNXNXpkR0Z1WTJVc0lHTmhiR3hsY2s1aGJXVXBJSHRjYmlBZ2FXWWdLSEJ5YjJObGMzTXVaVzUyTGs1UFJFVmZSVTVXSUNFOVBTQW5jSEp2WkhWamRHbHZiaWNwSUh0Y2JpQWdJQ0IyWVhJZ1kyOXVjM1J5ZFdOMGIzSWdQU0J3ZFdKc2FXTkpibk4wWVc1alpTNWpiMjV6ZEhKMVkzUnZjanRjYmlBZ0lDQndjbTlqWlhOekxtVnVkaTVPVDBSRlgwVk9WaUFoUFQwZ0ozQnliMlIxWTNScGIyNG5JRDhnZDJGeWJtbHVaeWhtWVd4elpTd2dKeVZ6S0M0dUxpazZJRU5oYmlCdmJteDVJSFZ3WkdGMFpTQmhJRzF2ZFc1MFpXUWdiM0lnYlc5MWJuUnBibWNnWTI5dGNHOXVaVzUwTGlBbklDc2dKMVJvYVhNZ2RYTjFZV3hzZVNCdFpXRnVjeUI1YjNVZ1kyRnNiR1ZrSUNWektDa2diMjRnWVc0Z2RXNXRiM1Z1ZEdWa0lHTnZiWEJ2Ym1WdWRDNGdKeUFySUNkVWFHbHpJR2x6SUdFZ2JtOHRiM0F1SUZCc1pXRnpaU0JqYUdWamF5QjBhR1VnWTI5a1pTQm1iM0lnZEdobElDVnpJR052YlhCdmJtVnVkQzRuTENCallXeHNaWEpPWVcxbExDQmpZV3hzWlhKT1lXMWxMQ0JqYjI1emRISjFZM1J2Y2lBbUppQW9ZMjl1YzNSeWRXTjBiM0l1WkdsemNHeGhlVTVoYldVZ2ZId2dZMjl1YzNSeWRXTjBiM0l1Ym1GdFpTa2dmSHdnSjFKbFlXTjBRMnhoYzNNbktTQTZJSFp2YVdRZ01EdGNiaUFnZlZ4dWZWeHVYRzR2S2lwY2JpQXFJRlJvYVhNZ2FYTWdkR2hsSUdGaWMzUnlZV04wSUVGUVNTQm1iM0lnWVc0Z2RYQmtZWFJsSUhGMVpYVmxMbHh1SUNvdlhHNTJZWElnVW1WaFkzUk9iMjl3VlhCa1lYUmxVWFZsZFdVZ1BTQjdYRzRnSUM4cUtseHVJQ0FnS2lCRGFHVmphM01nZDJobGRHaGxjaUJ2Y2lCdWIzUWdkR2hwY3lCamIyMXdiM05wZEdVZ1kyOXRjRzl1Wlc1MElHbHpJRzF2ZFc1MFpXUXVYRzRnSUNBcUlFQndZWEpoYlNCN1VtVmhZM1JEYkdGemMzMGdjSFZpYkdsalNXNXpkR0Z1WTJVZ1ZHaGxJR2x1YzNSaGJtTmxJSGRsSUhkaGJuUWdkRzhnZEdWemRDNWNiaUFnSUNvZ1FISmxkSFZ5YmlCN1ltOXZiR1ZoYm4wZ1ZISjFaU0JwWmlCdGIzVnVkR1ZrTENCbVlXeHpaU0J2ZEdobGNuZHBjMlV1WEc0Z0lDQXFJRUJ3Y205MFpXTjBaV1JjYmlBZ0lDb2dRR1pwYm1Gc1hHNGdJQ0FxTDF4dUlDQnBjMDF2ZFc1MFpXUTZJR1oxYm1OMGFXOXVJQ2h3ZFdKc2FXTkpibk4wWVc1alpTa2dlMXh1SUNBZ0lISmxkSFZ5YmlCbVlXeHpaVHRjYmlBZ2ZTeGNibHh1SUNBdktpcGNiaUFnSUNvZ1JXNXhkV1YxWlNCaElHTmhiR3hpWVdOcklIUm9ZWFFnZDJsc2JDQmlaU0JsZUdWamRYUmxaQ0JoWm5SbGNpQmhiR3dnZEdobElIQmxibVJwYm1jZ2RYQmtZWFJsYzF4dUlDQWdLaUJvWVhabElIQnliMk5sYzNObFpDNWNiaUFnSUNwY2JpQWdJQ29nUUhCaGNtRnRJSHRTWldGamRFTnNZWE56ZlNCd2RXSnNhV05KYm5OMFlXNWpaU0JVYUdVZ2FXNXpkR0Z1WTJVZ2RHOGdkWE5sSUdGeklHQjBhR2x6WUNCamIyNTBaWGgwTGx4dUlDQWdLaUJBY0dGeVlXMGdlejltZFc1amRHbHZibjBnWTJGc2JHSmhZMnNnUTJGc2JHVmtJR0ZtZEdWeUlITjBZWFJsSUdseklIVndaR0YwWldRdVhHNGdJQ0FxSUVCcGJuUmxjbTVoYkZ4dUlDQWdLaTljYmlBZ1pXNXhkV1YxWlVOaGJHeGlZV05yT2lCbWRXNWpkR2x2YmlBb2NIVmliR2xqU1c1emRHRnVZMlVzSUdOaGJHeGlZV05yS1NCN2ZTeGNibHh1SUNBdktpcGNiaUFnSUNvZ1JtOXlZMlZ6SUdGdUlIVndaR0YwWlM0Z1ZHaHBjeUJ6YUc5MWJHUWdiMjVzZVNCaVpTQnBiblp2YTJWa0lIZG9aVzRnYVhRZ2FYTWdhMjV2ZDI0Z2QybDBhRnh1SUNBZ0tpQmpaWEowWVdsdWRIa2dkR2hoZENCM1pTQmhjbVVnS2lwdWIzUXFLaUJwYmlCaElFUlBUU0IwY21GdWMyRmpkR2x2Ymk1Y2JpQWdJQ3BjYmlBZ0lDb2dXVzkxSUcxaGVTQjNZVzUwSUhSdklHTmhiR3dnZEdocGN5QjNhR1Z1SUhsdmRTQnJibTkzSUhSb1lYUWdjMjl0WlNCa1pXVndaWElnWVhOd1pXTjBJRzltSUhSb1pWeHVJQ0FnS2lCamIyMXdiMjVsYm5RbmN5QnpkR0YwWlNCb1lYTWdZMmhoYm1kbFpDQmlkWFFnWUhObGRGTjBZWFJsWUNCM1lYTWdibTkwSUdOaGJHeGxaQzVjYmlBZ0lDcGNiaUFnSUNvZ1ZHaHBjeUIzYVd4c0lHNXZkQ0JwYm5admEyVWdZSE5vYjNWc1pFTnZiWEJ2Ym1WdWRGVndaR0YwWldBc0lHSjFkQ0JwZENCM2FXeHNJR2x1ZG05clpWeHVJQ0FnS2lCZ1kyOXRjRzl1Wlc1MFYybHNiRlZ3WkdGMFpXQWdZVzVrSUdCamIyMXdiMjVsYm5SRWFXUlZjR1JoZEdWZ0xseHVJQ0FnS2x4dUlDQWdLaUJBY0dGeVlXMGdlMUpsWVdOMFEyeGhjM045SUhCMVlteHBZMGx1YzNSaGJtTmxJRlJvWlNCcGJuTjBZVzVqWlNCMGFHRjBJSE5vYjNWc1pDQnlaWEpsYm1SbGNpNWNiaUFnSUNvZ1FHbHVkR1Z5Ym1Gc1hHNGdJQ0FxTDF4dUlDQmxibkYxWlhWbFJtOXlZMlZWY0dSaGRHVTZJR1oxYm1OMGFXOXVJQ2h3ZFdKc2FXTkpibk4wWVc1alpTa2dlMXh1SUNBZ0lIZGhjbTVPYjI5d0tIQjFZbXhwWTBsdWMzUmhibU5sTENBblptOXlZMlZWY0dSaGRHVW5LVHRjYmlBZ2ZTeGNibHh1SUNBdktpcGNiaUFnSUNvZ1VtVndiR0ZqWlhNZ1lXeHNJRzltSUhSb1pTQnpkR0YwWlM0Z1FXeDNZWGx6SUhWelpTQjBhR2x6SUc5eUlHQnpaWFJUZEdGMFpXQWdkRzhnYlhWMFlYUmxJSE4wWVhSbExseHVJQ0FnS2lCWmIzVWdjMmh2ZFd4a0lIUnlaV0YwSUdCMGFHbHpMbk4wWVhSbFlDQmhjeUJwYlcxMWRHRmliR1V1WEc0Z0lDQXFYRzRnSUNBcUlGUm9aWEpsSUdseklHNXZJR2QxWVhKaGJuUmxaU0IwYUdGMElHQjBhR2x6TG5OMFlYUmxZQ0IzYVd4c0lHSmxJR2x0YldWa2FXRjBaV3g1SUhWd1pHRjBaV1FzSUhOdlhHNGdJQ0FxSUdGalkyVnpjMmx1WnlCZ2RHaHBjeTV6ZEdGMFpXQWdZV1owWlhJZ1kyRnNiR2x1WnlCMGFHbHpJRzFsZEdodlpDQnRZWGtnY21WMGRYSnVJSFJvWlNCdmJHUWdkbUZzZFdVdVhHNGdJQ0FxWEc0Z0lDQXFJRUJ3WVhKaGJTQjdVbVZoWTNSRGJHRnpjMzBnY0hWaWJHbGpTVzV6ZEdGdVkyVWdWR2hsSUdsdWMzUmhibU5sSUhSb1lYUWdjMmh2ZFd4a0lISmxjbVZ1WkdWeUxseHVJQ0FnS2lCQWNHRnlZVzBnZTI5aWFtVmpkSDBnWTI5dGNHeGxkR1ZUZEdGMFpTQk9aWGgwSUhOMFlYUmxMbHh1SUNBZ0tpQkFhVzUwWlhKdVlXeGNiaUFnSUNvdlhHNGdJR1Z1Y1hWbGRXVlNaWEJzWVdObFUzUmhkR1U2SUdaMWJtTjBhVzl1SUNod2RXSnNhV05KYm5OMFlXNWpaU3dnWTI5dGNHeGxkR1ZUZEdGMFpTa2dlMXh1SUNBZ0lIZGhjbTVPYjI5d0tIQjFZbXhwWTBsdWMzUmhibU5sTENBbmNtVndiR0ZqWlZOMFlYUmxKeWs3WEc0Z0lIMHNYRzVjYmlBZ0x5b3FYRzRnSUNBcUlGTmxkSE1nWVNCemRXSnpaWFFnYjJZZ2RHaGxJSE4wWVhSbExpQlVhR2x6SUc5dWJIa2daWGhwYzNSeklHSmxZMkYxYzJVZ1gzQmxibVJwYm1kVGRHRjBaU0JwYzF4dUlDQWdLaUJwYm5SbGNtNWhiQzRnVkdocGN5QndjbTkyYVdSbGN5QmhJRzFsY21kcGJtY2djM1J5WVhSbFoza2dkR2hoZENCcGN5QnViM1FnWVhaaGFXeGhZbXhsSUhSdklHUmxaWEJjYmlBZ0lDb2djSEp2Y0dWeWRHbGxjeUIzYUdsamFDQnBjeUJqYjI1bWRYTnBibWN1SUZSUFJFODZJRVY0Y0c5elpTQndaVzVrYVc1blUzUmhkR1VnYjNJZ1pHOXVKM1FnZFhObElHbDBYRzRnSUNBcUlHUjFjbWx1WnlCMGFHVWdiV1Z5WjJVdVhHNGdJQ0FxWEc0Z0lDQXFJRUJ3WVhKaGJTQjdVbVZoWTNSRGJHRnpjMzBnY0hWaWJHbGpTVzV6ZEdGdVkyVWdWR2hsSUdsdWMzUmhibU5sSUhSb1lYUWdjMmh2ZFd4a0lISmxjbVZ1WkdWeUxseHVJQ0FnS2lCQWNHRnlZVzBnZTI5aWFtVmpkSDBnY0dGeWRHbGhiRk4wWVhSbElFNWxlSFFnY0dGeWRHbGhiQ0J6ZEdGMFpTQjBieUJpWlNCdFpYSm5aV1FnZDJsMGFDQnpkR0YwWlM1Y2JpQWdJQ29nUUdsdWRHVnlibUZzWEc0Z0lDQXFMMXh1SUNCbGJuRjFaWFZsVTJWMFUzUmhkR1U2SUdaMWJtTjBhVzl1SUNod2RXSnNhV05KYm5OMFlXNWpaU3dnY0dGeWRHbGhiRk4wWVhSbEtTQjdYRzRnSUNBZ2QyRnliazV2YjNBb2NIVmliR2xqU1c1emRHRnVZMlVzSUNkelpYUlRkR0YwWlNjcE8xeHVJQ0I5WEc1OU8xeHVYRzV0YjJSMWJHVXVaWGh3YjNKMGN5QTlJRkpsWVdOMFRtOXZjRlZ3WkdGMFpWRjFaWFZsT3lJc0lpOHFLbHh1SUNvZ1EyOXdlWEpwWjJoMElESXdNVE10Y0hKbGMyVnVkQ3dnUm1GalpXSnZiMnNzSUVsdVl5NWNiaUFxSUVGc2JDQnlhV2RvZEhNZ2NtVnpaWEoyWldRdVhHNGdLbHh1SUNvZ1ZHaHBjeUJ6YjNWeVkyVWdZMjlrWlNCcGN5QnNhV05sYm5ObFpDQjFibVJsY2lCMGFHVWdRbE5FTFhOMGVXeGxJR3hwWTJWdWMyVWdabTkxYm1RZ2FXNGdkR2hsWEc0Z0tpQk1TVU5GVGxORklHWnBiR1VnYVc0Z2RHaGxJSEp2YjNRZ1pHbHlaV04wYjNKNUlHOW1JSFJvYVhNZ2MyOTFjbU5sSUhSeVpXVXVJRUZ1SUdGa1pHbDBhVzl1WVd3Z1ozSmhiblJjYmlBcUlHOW1JSEJoZEdWdWRDQnlhV2RvZEhNZ1kyRnVJR0psSUdadmRXNWtJR2x1SUhSb1pTQlFRVlJGVGxSVElHWnBiR1VnYVc0Z2RHaGxJSE5oYldVZ1pHbHlaV04wYjNKNUxseHVJQ3BjYmlBcUlGeHVJQ292WEc1Y2JpZDFjMlVnYzNSeWFXTjBKenRjYmx4dWRtRnlJRkpsWVdOMFVISnZjRlI1Y0dWTWIyTmhkR2x2Yms1aGJXVnpJRDBnZTMwN1hHNWNibWxtSUNod2NtOWpaWE56TG1WdWRpNU9UMFJGWDBWT1ZpQWhQVDBnSjNCeWIyUjFZM1JwYjI0bktTQjdYRzRnSUZKbFlXTjBVSEp2Y0ZSNWNHVk1iMk5oZEdsdmJrNWhiV1Z6SUQwZ2UxeHVJQ0FnSUhCeWIzQTZJQ2R3Y205d0p5eGNiaUFnSUNCamIyNTBaWGgwT2lBblkyOXVkR1Y0ZENjc1hHNGdJQ0FnWTJocGJHUkRiMjUwWlhoME9pQW5ZMmhwYkdRZ1kyOXVkR1Y0ZENkY2JpQWdmVHRjYm4xY2JseHViVzlrZFd4bExtVjRjRzl5ZEhNZ1BTQlNaV0ZqZEZCeWIzQlVlWEJsVEc5allYUnBiMjVPWVcxbGN6c2lMQ0l2S2lwY2JpQXFJRU52Y0hseWFXZG9kQ0F5TURFekxYQnlaWE5sYm5Rc0lFWmhZMlZpYjI5ckxDQkpibU11WEc0Z0tpQkJiR3dnY21sbmFIUnpJSEpsYzJWeWRtVmtMbHh1SUNwY2JpQXFJRlJvYVhNZ2MyOTFjbU5sSUdOdlpHVWdhWE1nYkdsalpXNXpaV1FnZFc1a1pYSWdkR2hsSUVKVFJDMXpkSGxzWlNCc2FXTmxibk5sSUdadmRXNWtJR2x1SUhSb1pWeHVJQ29nVEVsRFJVNVRSU0JtYVd4bElHbHVJSFJvWlNCeWIyOTBJR1JwY21WamRHOXllU0J2WmlCMGFHbHpJSE52ZFhKalpTQjBjbVZsTGlCQmJpQmhaR1JwZEdsdmJtRnNJR2R5WVc1MFhHNGdLaUJ2WmlCd1lYUmxiblFnY21sbmFIUnpJR05oYmlCaVpTQm1iM1Z1WkNCcGJpQjBhR1VnVUVGVVJVNVVVeUJtYVd4bElHbHVJSFJvWlNCellXMWxJR1JwY21WamRHOXllUzVjYmlBcVhHNGdLaTljYmx4dUozVnpaU0J6ZEhKcFkzUW5PMXh1WEc1MllYSWdYM0psY1hWcGNtVWdQU0J5WlhGMWFYSmxLQ2N1TDFKbFlXTjBSV3hsYldWdWRDY3BMRnh1SUNBZ0lHbHpWbUZzYVdSRmJHVnRaVzUwSUQwZ1gzSmxjWFZwY21VdWFYTldZV3hwWkVWc1pXMWxiblE3WEc1Y2JuWmhjaUJtWVdOMGIzSjVJRDBnY21WeGRXbHlaU2duY0hKdmNDMTBlWEJsY3k5bVlXTjBiM0o1SnlrN1hHNWNibTF2WkhWc1pTNWxlSEJ2Y25SeklEMGdabUZqZEc5eWVTaHBjMVpoYkdsa1JXeGxiV1Z1ZENrN0lpd2lMeW9xWEc0Z0tpQkRiM0I1Y21sbmFIUWdNakF4TXkxd2NtVnpaVzUwTENCR1lXTmxZbTl2YXl3Z1NXNWpMbHh1SUNvZ1FXeHNJSEpwWjJoMGN5QnlaWE5sY25abFpDNWNiaUFxWEc0Z0tpQlVhR2x6SUhOdmRYSmpaU0JqYjJSbElHbHpJR3hwWTJWdWMyVmtJSFZ1WkdWeUlIUm9aU0JDVTBRdGMzUjViR1VnYkdsalpXNXpaU0JtYjNWdVpDQnBiaUIwYUdWY2JpQXFJRXhKUTBWT1UwVWdabWxzWlNCcGJpQjBhR1VnY205dmRDQmthWEpsWTNSdmNua2diMllnZEdocGN5QnpiM1Z5WTJVZ2RISmxaUzRnUVc0Z1lXUmthWFJwYjI1aGJDQm5jbUZ1ZEZ4dUlDb2diMllnY0dGMFpXNTBJSEpwWjJoMGN5QmpZVzRnWW1VZ1ptOTFibVFnYVc0Z2RHaGxJRkJCVkVWT1ZGTWdabWxzWlNCcGJpQjBhR1VnYzJGdFpTQmthWEpsWTNSdmNua3VYRzRnS2x4dUlDb2dYRzRnS2k5Y2JseHVKM1Z6WlNCemRISnBZM1FuTzF4dVhHNTJZWElnVW1WaFkzUlFjbTl3Vkhsd1pYTlRaV055WlhRZ1BTQW5VMFZEVWtWVVgwUlBYMDVQVkY5UVFWTlRYMVJJU1ZOZlQxSmZXVTlWWDFkSlRFeGZRa1ZmUmtsU1JVUW5PMXh1WEc1dGIyUjFiR1V1Wlhod2IzSjBjeUE5SUZKbFlXTjBVSEp2Y0ZSNWNHVnpVMlZqY21WME95SXNJaThxS2x4dUlDb2dRMjl3ZVhKcFoyaDBJREl3TVRNdGNISmxjMlZ1ZEN3Z1JtRmpaV0p2YjJzc0lFbHVZeTVjYmlBcUlFRnNiQ0J5YVdkb2RITWdjbVZ6WlhKMlpXUXVYRzRnS2x4dUlDb2dWR2hwY3lCemIzVnlZMlVnWTI5a1pTQnBjeUJzYVdObGJuTmxaQ0IxYm1SbGNpQjBhR1VnUWxORUxYTjBlV3hsSUd4cFkyVnVjMlVnWm05MWJtUWdhVzRnZEdobFhHNGdLaUJNU1VORlRsTkZJR1pwYkdVZ2FXNGdkR2hsSUhKdmIzUWdaR2x5WldOMGIzSjVJRzltSUhSb2FYTWdjMjkxY21ObElIUnlaV1V1SUVGdUlHRmtaR2wwYVc5dVlXd2daM0poYm5SY2JpQXFJRzltSUhCaGRHVnVkQ0J5YVdkb2RITWdZMkZ1SUdKbElHWnZkVzVrSUdsdUlIUm9aU0JRUVZSRlRsUlRJR1pwYkdVZ2FXNGdkR2hsSUhOaGJXVWdaR2x5WldOMGIzSjVMbHh1SUNwY2JpQXFMMXh1WEc0bmRYTmxJSE4wY21samRDYzdYRzVjYm0xdlpIVnNaUzVsZUhCdmNuUnpJRDBnSnpFMUxqWXVNU2M3SWl3aUx5b3FYRzRnS2lCRGIzQjVjbWxuYUhRZ01qQXhNeTF3Y21WelpXNTBMQ0JHWVdObFltOXZheXdnU1c1akxseHVJQ29nUVd4c0lISnBaMmgwY3lCeVpYTmxjblpsWkM1Y2JpQXFYRzRnS2lCVWFHbHpJSE52ZFhKalpTQmpiMlJsSUdseklHeHBZMlZ1YzJWa0lIVnVaR1Z5SUhSb1pTQkNVMFF0YzNSNWJHVWdiR2xqWlc1elpTQm1iM1Z1WkNCcGJpQjBhR1ZjYmlBcUlFeEpRMFZPVTBVZ1ptbHNaU0JwYmlCMGFHVWdjbTl2ZENCa2FYSmxZM1J2Y25rZ2IyWWdkR2hwY3lCemIzVnlZMlVnZEhKbFpTNGdRVzRnWVdSa2FYUnBiMjVoYkNCbmNtRnVkRnh1SUNvZ2IyWWdjR0YwWlc1MElISnBaMmgwY3lCallXNGdZbVVnWm05MWJtUWdhVzRnZEdobElGQkJWRVZPVkZNZ1ptbHNaU0JwYmlCMGFHVWdjMkZ0WlNCa2FYSmxZM1J2Y25rdVhHNGdLbHh1SUNvZ1hHNGdLaTljYmx4dUozVnpaU0J6ZEhKcFkzUW5PMXh1WEc1MllYSWdZMkZ1UkdWbWFXNWxVSEp2Y0dWeWRIa2dQU0JtWVd4elpUdGNibWxtSUNod2NtOWpaWE56TG1WdWRpNU9UMFJGWDBWT1ZpQWhQVDBnSjNCeWIyUjFZM1JwYjI0bktTQjdYRzRnSUhSeWVTQjdYRzRnSUNBZ0x5OGdKRVpzYjNkR2FYaE5aU0JvZEhSd2N6b3ZMMmRwZEdoMVlpNWpiMjB2Wm1GalpXSnZiMnN2Wm14dmR5OXBjM04xWlhNdk1qZzFYRzRnSUNBZ1QySnFaV04wTG1SbFptbHVaVkJ5YjNCbGNuUjVLSHQ5TENBbmVDY3NJSHNnWjJWME9pQm1kVzVqZEdsdmJpQW9LU0I3ZlNCOUtUdGNiaUFnSUNCallXNUVaV1pwYm1WUWNtOXdaWEowZVNBOUlIUnlkV1U3WEc0Z0lIMGdZMkYwWTJnZ0tIZ3BJSHRjYmlBZ0lDQXZMeUJKUlNCM2FXeHNJR1poYVd3Z2IyNGdaR1ZtYVc1bFVISnZjR1Z5ZEhsY2JpQWdmVnh1ZlZ4dVhHNXRiMlIxYkdVdVpYaHdiM0owY3lBOUlHTmhia1JsWm1sdVpWQnliM0JsY25SNU95SXNJaThxS2x4dUlDb2dRMjl3ZVhKcFoyaDBJREl3TVRNdGNISmxjMlZ1ZEN3Z1JtRmpaV0p2YjJzc0lFbHVZeTVjYmlBcUlFRnNiQ0J5YVdkb2RITWdjbVZ6WlhKMlpXUXVYRzRnS2x4dUlDb2dWR2hwY3lCemIzVnlZMlVnWTI5a1pTQnBjeUJzYVdObGJuTmxaQ0IxYm1SbGNpQjBhR1VnUWxORUxYTjBlV3hsSUd4cFkyVnVjMlVnWm05MWJtUWdhVzRnZEdobFhHNGdLaUJNU1VORlRsTkZJR1pwYkdVZ2FXNGdkR2hsSUhKdmIzUWdaR2x5WldOMGIzSjVJRzltSUhSb2FYTWdjMjkxY21ObElIUnlaV1V1SUVGdUlHRmtaR2wwYVc5dVlXd2daM0poYm5SY2JpQXFJRzltSUhCaGRHVnVkQ0J5YVdkb2RITWdZMkZ1SUdKbElHWnZkVzVrSUdsdUlIUm9aU0JRUVZSRlRsUlRJR1pwYkdVZ2FXNGdkR2hsSUhOaGJXVWdaR2x5WldOMGIzSjVMbHh1SUNwY2JpQXFMMXh1WEc0bmRYTmxJSE4wY21samRDYzdYRzVjYm5aaGNpQmZjSEp2WkVsdWRtRnlhV0Z1ZENBOUlISmxjWFZwY21Vb0p5NHZjbVZoWTNSUWNtOWtTVzUyWVhKcFlXNTBKeWs3WEc1Y2JuWmhjaUJTWldGamRGQnliM0JVZVhCbFRHOWpZWFJwYjI1T1lXMWxjeUE5SUhKbGNYVnBjbVVvSnk0dlVtVmhZM1JRY205d1ZIbHdaVXh2WTJGMGFXOXVUbUZ0WlhNbktUdGNiblpoY2lCU1pXRmpkRkJ5YjNCVWVYQmxjMU5sWTNKbGRDQTlJSEpsY1hWcGNtVW9KeTR2VW1WaFkzUlFjbTl3Vkhsd1pYTlRaV055WlhRbktUdGNibHh1ZG1GeUlHbHVkbUZ5YVdGdWRDQTlJSEpsY1hWcGNtVW9KMlppYW5NdmJHbGlMMmx1ZG1GeWFXRnVkQ2NwTzF4dWRtRnlJSGRoY201cGJtY2dQU0J5WlhGMWFYSmxLQ2RtWW1wekwyeHBZaTkzWVhKdWFXNW5KeWs3WEc1Y2JuWmhjaUJTWldGamRFTnZiWEJ2Ym1WdWRGUnlaV1ZJYjI5ck8xeHVYRzVwWmlBb2RIbHdaVzltSUhCeWIyTmxjM01nSVQwOUlDZDFibVJsWm1sdVpXUW5JQ1ltSUhCeWIyTmxjM011Wlc1MklDWW1JSEJ5YjJObGMzTXVaVzUyTGs1UFJFVmZSVTVXSUQwOVBTQW5kR1Z6ZENjcElIdGNiaUFnTHk4Z1ZHVnRjRzl5WVhKNUlHaGhZMnN1WEc0Z0lDOHZJRWx1YkdsdVpTQnlaWEYxYVhKbGN5QmtiMjRuZENCM2IzSnJJSGRsYkd3Z2QybDBhQ0JLWlhOME9seHVJQ0F2THlCb2RIUndjem92TDJkcGRHaDFZaTVqYjIwdlptRmpaV0p2YjJzdmNtVmhZM1F2YVhOemRXVnpMemN5TkRCY2JpQWdMeThnVW1WdGIzWmxJSFJvWlNCcGJteHBibVVnY21WeGRXbHlaWE1nZDJobGJpQjNaU0JrYjI0bmRDQnVaV1ZrSUhSb1pXMGdZVzU1Ylc5eVpUcGNiaUFnTHk4Z2FIUjBjSE02THk5bmFYUm9kV0l1WTI5dEwyWmhZMlZpYjI5ckwzSmxZV04wTDNCMWJHd3ZOekUzT0Z4dUlDQlNaV0ZqZEVOdmJYQnZibVZ1ZEZSeVpXVkliMjlySUQwZ2NtVnhkV2x5WlNnbkxpOVNaV0ZqZEVOdmJYQnZibVZ1ZEZSeVpXVkliMjlySnlrN1hHNTlYRzVjYm5aaGNpQnNiMmRuWldSVWVYQmxSbUZwYkhWeVpYTWdQU0I3ZlR0Y2JseHVMeW9xWEc0Z0tpQkJjM05sY25RZ2RHaGhkQ0IwYUdVZ2RtRnNkV1Z6SUcxaGRHTm9JSGRwZEdnZ2RHaGxJSFI1Y0dVZ2MzQmxZM011WEc0Z0tpQkZjbkp2Y2lCdFpYTnpZV2RsY3lCaGNtVWdiV1Z0YjNKcGVtVmtJR0Z1WkNCM2FXeHNJRzl1YkhrZ1ltVWdjMmh2ZDI0Z2IyNWpaUzVjYmlBcVhHNGdLaUJBY0dGeVlXMGdlMjlpYW1WamRIMGdkSGx3WlZOd1pXTnpJRTFoY0NCdlppQnVZVzFsSUhSdklHRWdVbVZoWTNSUWNtOXdWSGx3WlZ4dUlDb2dRSEJoY21GdElIdHZZbXBsWTNSOUlIWmhiSFZsY3lCU2RXNTBhVzFsSUhaaGJIVmxjeUIwYUdGMElHNWxaV1FnZEc4Z1ltVWdkSGx3WlMxamFHVmphMlZrWEc0Z0tpQkFjR0Z5WVcwZ2UzTjBjbWx1WjMwZ2JHOWpZWFJwYjI0Z1pTNW5MaUJjSW5CeWIzQmNJaXdnWENKamIyNTBaWGgwWENJc0lGd2lZMmhwYkdRZ1kyOXVkR1Y0ZEZ3aVhHNGdLaUJBY0dGeVlXMGdlM04wY21sdVozMGdZMjl0Y0c5dVpXNTBUbUZ0WlNCT1lXMWxJRzltSUhSb1pTQmpiMjF3YjI1bGJuUWdabTl5SUdWeWNtOXlJRzFsYzNOaFoyVnpMbHh1SUNvZ1FIQmhjbUZ0SUhzL2IySnFaV04wZlNCbGJHVnRaVzUwSUZSb1pTQlNaV0ZqZENCbGJHVnRaVzUwSUhSb1lYUWdhWE1nWW1WcGJtY2dkSGx3WlMxamFHVmphMlZrWEc0Z0tpQkFjR0Z5WVcwZ2V6OXVkVzFpWlhKOUlHUmxZblZuU1VRZ1ZHaGxJRkpsWVdOMElHTnZiWEJ2Ym1WdWRDQnBibk4wWVc1alpTQjBhR0YwSUdseklHSmxhVzVuSUhSNWNHVXRZMmhsWTJ0bFpGeHVJQ29nUUhCeWFYWmhkR1ZjYmlBcUwxeHVablZ1WTNScGIyNGdZMmhsWTJ0U1pXRmpkRlI1Y0dWVGNHVmpLSFI1Y0dWVGNHVmpjeXdnZG1Gc2RXVnpMQ0JzYjJOaGRHbHZiaXdnWTI5dGNHOXVaVzUwVG1GdFpTd2daV3hsYldWdWRDd2daR1ZpZFdkSlJDa2dlMXh1SUNCbWIzSWdLSFpoY2lCMGVYQmxVM0JsWTA1aGJXVWdhVzRnZEhsd1pWTndaV056S1NCN1hHNGdJQ0FnYVdZZ0tIUjVjR1ZUY0dWamN5NW9ZWE5QZDI1UWNtOXdaWEowZVNoMGVYQmxVM0JsWTA1aGJXVXBLU0I3WEc0Z0lDQWdJQ0IyWVhJZ1pYSnliM0k3WEc0Z0lDQWdJQ0F2THlCUWNtOXdJSFI1Y0dVZ2RtRnNhV1JoZEdsdmJpQnRZWGtnZEdoeWIzY3VJRWx1SUdOaGMyVWdkR2hsZVNCa2J5d2dkMlVnWkc5dUozUWdkMkZ1ZENCMGIxeHVJQ0FnSUNBZ0x5OGdabUZwYkNCMGFHVWdjbVZ1WkdWeUlIQm9ZWE5sSUhkb1pYSmxJR2wwSUdScFpHNG5kQ0JtWVdsc0lHSmxabTl5WlM0Z1UyOGdkMlVnYkc5bklHbDBMbHh1SUNBZ0lDQWdMeThnUVdaMFpYSWdkR2hsYzJVZ2FHRjJaU0JpWldWdUlHTnNaV0Z1WldRZ2RYQXNJSGRsSjJ4c0lHeGxkQ0IwYUdWdElIUm9jbTkzTGx4dUlDQWdJQ0FnZEhKNUlIdGNiaUFnSUNBZ0lDQWdMeThnVkdocGN5QnBjeUJwYm5SbGJuUnBiMjVoYkd4NUlHRnVJR2x1ZG1GeWFXRnVkQ0IwYUdGMElHZGxkSE1nWTJGMVoyaDBMaUJKZENkeklIUm9aU0J6WVcxbFhHNGdJQ0FnSUNBZ0lDOHZJR0psYUdGMmFXOXlJR0Z6SUhkcGRHaHZkWFFnZEdocGN5QnpkR0YwWlcxbGJuUWdaWGhqWlhCMElIZHBkR2dnWVNCaVpYUjBaWElnYldWemMyRm5aUzVjYmlBZ0lDQWdJQ0FnSVNoMGVYQmxiMllnZEhsd1pWTndaV056VzNSNWNHVlRjR1ZqVG1GdFpWMGdQVDA5SUNkbWRXNWpkR2x2YmljcElEOGdjSEp2WTJWemN5NWxibll1VGs5RVJWOUZUbFlnSVQwOUlDZHdjbTlrZFdOMGFXOXVKeUEvSUdsdWRtRnlhV0Z1ZENobVlXeHpaU3dnSnlWek9pQWxjeUIwZVhCbElHQWxjMkFnYVhNZ2FXNTJZV3hwWkRzZ2FYUWdiWFZ6ZENCaVpTQmhJR1oxYm1OMGFXOXVMQ0IxYzNWaGJHeDVJR1p5YjIwZ1VtVmhZM1F1VUhKdmNGUjVjR1Z6TGljc0lHTnZiWEJ2Ym1WdWRFNWhiV1VnZkh3Z0oxSmxZV04wSUdOc1lYTnpKeXdnVW1WaFkzUlFjbTl3Vkhsd1pVeHZZMkYwYVc5dVRtRnRaWE5iYkc5allYUnBiMjVkTENCMGVYQmxVM0JsWTA1aGJXVXBJRG9nWDNCeWIyUkpiblpoY21saGJuUW9KemcwSnl3Z1kyOXRjRzl1Wlc1MFRtRnRaU0I4ZkNBblVtVmhZM1FnWTJ4aGMzTW5MQ0JTWldGamRGQnliM0JVZVhCbFRHOWpZWFJwYjI1T1lXMWxjMXRzYjJOaGRHbHZibDBzSUhSNWNHVlRjR1ZqVG1GdFpTa2dPaUIyYjJsa0lEQTdYRzRnSUNBZ0lDQWdJR1Z5Y205eUlEMGdkSGx3WlZOd1pXTnpXM1I1Y0dWVGNHVmpUbUZ0WlYwb2RtRnNkV1Z6TENCMGVYQmxVM0JsWTA1aGJXVXNJR052YlhCdmJtVnVkRTVoYldVc0lHeHZZMkYwYVc5dUxDQnVkV3hzTENCU1pXRmpkRkJ5YjNCVWVYQmxjMU5sWTNKbGRDazdYRzRnSUNBZ0lDQjlJR05oZEdOb0lDaGxlQ2tnZTF4dUlDQWdJQ0FnSUNCbGNuSnZjaUE5SUdWNE8xeHVJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ2NISnZZMlZ6Y3k1bGJuWXVUazlFUlY5RlRsWWdJVDA5SUNkd2NtOWtkV04wYVc5dUp5QS9JSGRoY201cGJtY29JV1Z5Y205eUlIeDhJR1Z5Y205eUlHbHVjM1JoYm1ObGIyWWdSWEp5YjNJc0lDY2xjem9nZEhsd1pTQnpjR1ZqYVdacFkyRjBhVzl1SUc5bUlDVnpJR0FsYzJBZ2FYTWdhVzUyWVd4cFpEc2dkR2hsSUhSNWNHVWdZMmhsWTJ0bGNpQW5JQ3NnSjJaMWJtTjBhVzl1SUcxMWMzUWdjbVYwZFhKdUlHQnVkV3hzWUNCdmNpQmhiaUJnUlhKeWIzSmdJR0oxZENCeVpYUjFjbTVsWkNCaElDVnpMaUFuSUNzZ0oxbHZkU0J0WVhrZ2FHRjJaU0JtYjNKbmIzUjBaVzRnZEc4Z2NHRnpjeUJoYmlCaGNtZDFiV1Z1ZENCMGJ5QjBhR1VnZEhsd1pTQmphR1ZqYTJWeUlDY2dLeUFuWTNKbFlYUnZjaUFvWVhKeVlYbFBaaXdnYVc1emRHRnVZMlZQWml3Z2IySnFaV04wVDJZc0lHOXVaVTltTENCdmJtVlBabFI1Y0dVc0lHRnVaQ0FuSUNzZ0ozTm9ZWEJsSUdGc2JDQnlaWEYxYVhKbElHRnVJR0Z5WjNWdFpXNTBLUzRuTENCamIyMXdiMjVsYm5ST1lXMWxJSHg4SUNkU1pXRmpkQ0JqYkdGemN5Y3NJRkpsWVdOMFVISnZjRlI1Y0dWTWIyTmhkR2x2Yms1aGJXVnpXMnh2WTJGMGFXOXVYU3dnZEhsd1pWTndaV05PWVcxbExDQjBlWEJsYjJZZ1pYSnliM0lwSURvZ2RtOXBaQ0F3TzF4dUlDQWdJQ0FnYVdZZ0tHVnljbTl5SUdsdWMzUmhibU5sYjJZZ1JYSnliM0lnSmlZZ0lTaGxjbkp2Y2k1dFpYTnpZV2RsSUdsdUlHeHZaMmRsWkZSNWNHVkdZV2xzZFhKbGN5a3BJSHRjYmlBZ0lDQWdJQ0FnTHk4Z1QyNXNlU0J0YjI1cGRHOXlJSFJvYVhNZ1ptRnBiSFZ5WlNCdmJtTmxJR0psWTJGMWMyVWdkR2hsY21VZ2RHVnVaSE1nZEc4Z1ltVWdZU0JzYjNRZ2IyWWdkR2hsWEc0Z0lDQWdJQ0FnSUM4dklITmhiV1VnWlhKeWIzSXVYRzRnSUNBZ0lDQWdJR3h2WjJkbFpGUjVjR1ZHWVdsc2RYSmxjMXRsY25KdmNpNXRaWE56WVdkbFhTQTlJSFJ5ZFdVN1hHNWNiaUFnSUNBZ0lDQWdkbUZ5SUdOdmJYQnZibVZ1ZEZOMFlXTnJTVzVtYnlBOUlDY25PMXh1WEc0Z0lDQWdJQ0FnSUdsbUlDaHdjbTlqWlhOekxtVnVkaTVPVDBSRlgwVk9WaUFoUFQwZ0ozQnliMlIxWTNScGIyNG5LU0I3WEc0Z0lDQWdJQ0FnSUNBZ2FXWWdLQ0ZTWldGamRFTnZiWEJ2Ym1WdWRGUnlaV1ZJYjI5cktTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNCU1pXRmpkRU52YlhCdmJtVnVkRlJ5WldWSWIyOXJJRDBnY21WeGRXbHlaU2duTGk5U1pXRmpkRU52YlhCdmJtVnVkRlJ5WldWSWIyOXJKeWs3WEc0Z0lDQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ0lDQWdJR2xtSUNoa1pXSjFaMGxFSUNFOVBTQnVkV3hzS1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0JqYjIxd2IyNWxiblJUZEdGamEwbHVabThnUFNCU1pXRmpkRU52YlhCdmJtVnVkRlJ5WldWSWIyOXJMbWRsZEZOMFlXTnJRV1JrWlc1a2RXMUNlVWxFS0dSbFluVm5TVVFwTzF4dUlDQWdJQ0FnSUNBZ0lIMGdaV3h6WlNCcFppQW9aV3hsYldWdWRDQWhQVDBnYm5Wc2JDa2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ1kyOXRjRzl1Wlc1MFUzUmhZMnRKYm1adklEMGdVbVZoWTNSRGIyMXdiMjVsYm5SVWNtVmxTRzl2YXk1blpYUkRkWEp5Wlc1MFUzUmhZMnRCWkdSbGJtUjFiU2hsYkdWdFpXNTBLVHRjYmlBZ0lDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lIMWNibHh1SUNBZ0lDQWdJQ0J3Y205alpYTnpMbVZ1ZGk1T1QwUkZYMFZPVmlBaFBUMGdKM0J5YjJSMVkzUnBiMjRuSUQ4Z2QyRnlibWx1WnlobVlXeHpaU3dnSjBaaGFXeGxaQ0FsY3lCMGVYQmxPaUFsY3lWekp5d2diRzlqWVhScGIyNHNJR1Z5Y205eUxtMWxjM05oWjJVc0lHTnZiWEJ2Ym1WdWRGTjBZV05yU1c1bWJ5a2dPaUIyYjJsa0lEQTdYRzRnSUNBZ0lDQjlYRzRnSUNBZ2ZWeHVJQ0I5WEc1OVhHNWNibTF2WkhWc1pTNWxlSEJ2Y25SeklEMGdZMmhsWTJ0U1pXRmpkRlI1Y0dWVGNHVmpPeUlzSWk4cUtseHVJQ29nUTI5d2VYSnBaMmgwSURJd01UTXRjSEpsYzJWdWRDd2dSbUZqWldKdmIyc3NJRWx1WXk1Y2JpQXFJRUZzYkNCeWFXZG9kSE1nY21WelpYSjJaV1F1WEc0Z0tseHVJQ29nVkdocGN5QnpiM1Z5WTJVZ1kyOWtaU0JwY3lCc2FXTmxibk5sWkNCMWJtUmxjaUIwYUdVZ1FsTkVMWE4wZVd4bElHeHBZMlZ1YzJVZ1ptOTFibVFnYVc0Z2RHaGxYRzRnS2lCTVNVTkZUbE5GSUdacGJHVWdhVzRnZEdobElISnZiM1FnWkdseVpXTjBiM0o1SUc5bUlIUm9hWE1nYzI5MWNtTmxJSFJ5WldVdUlFRnVJR0ZrWkdsMGFXOXVZV3dnWjNKaGJuUmNiaUFxSUc5bUlIQmhkR1Z1ZENCeWFXZG9kSE1nWTJGdUlHSmxJR1p2ZFc1a0lHbHVJSFJvWlNCUVFWUkZUbFJUSUdacGJHVWdhVzRnZEdobElITmhiV1VnWkdseVpXTjBiM0o1TGx4dUlDcGNiaUFxTDF4dVhHNG5kWE5sSUhOMGNtbGpkQ2M3WEc1Y2JuWmhjaUJmY21WeGRXbHlaU0E5SUhKbGNYVnBjbVVvSnk0dlVtVmhZM1JDWVhObFEyeGhjM05sY3ljcExGeHVJQ0FnSUVOdmJYQnZibVZ1ZENBOUlGOXlaWEYxYVhKbExrTnZiWEJ2Ym1WdWREdGNibHh1ZG1GeUlGOXlaWEYxYVhKbE1pQTlJSEpsY1hWcGNtVW9KeTR2VW1WaFkzUkZiR1Z0Wlc1MEp5a3NYRzRnSUNBZ2FYTldZV3hwWkVWc1pXMWxiblFnUFNCZmNtVnhkV2x5WlRJdWFYTldZV3hwWkVWc1pXMWxiblE3WEc1Y2JuWmhjaUJTWldGamRFNXZiM0JWY0dSaGRHVlJkV1YxWlNBOUlISmxjWFZwY21Vb0p5NHZVbVZoWTNST2IyOXdWWEJrWVhSbFVYVmxkV1VuS1R0Y2JuWmhjaUJtWVdOMGIzSjVJRDBnY21WeGRXbHlaU2duWTNKbFlYUmxMWEpsWVdOMExXTnNZWE56TDJaaFkzUnZjbmtuS1R0Y2JseHViVzlrZFd4bExtVjRjRzl5ZEhNZ1BTQm1ZV04wYjNKNUtFTnZiWEJ2Ym1WdWRDd2dhWE5XWVd4cFpFVnNaVzFsYm5Rc0lGSmxZV04wVG05dmNGVndaR0YwWlZGMVpYVmxLVHNpTENJdktpcGNiaUFxSUVOdmNIbHlhV2RvZENBeU1ERXpMWEJ5WlhObGJuUXNJRVpoWTJWaWIyOXJMQ0JKYm1NdVhHNGdLaUJCYkd3Z2NtbG5hSFJ6SUhKbGMyVnlkbVZrTGx4dUlDcGNiaUFxSUZSb2FYTWdjMjkxY21ObElHTnZaR1VnYVhNZ2JHbGpaVzV6WldRZ2RXNWtaWElnZEdobElFSlRSQzF6ZEhsc1pTQnNhV05sYm5ObElHWnZkVzVrSUdsdUlIUm9aVnh1SUNvZ1RFbERSVTVUUlNCbWFXeGxJR2x1SUhSb1pTQnliMjkwSUdScGNtVmpkRzl5ZVNCdlppQjBhR2x6SUhOdmRYSmpaU0IwY21WbExpQkJiaUJoWkdScGRHbHZibUZzSUdkeVlXNTBYRzRnS2lCdlppQndZWFJsYm5RZ2NtbG5hSFJ6SUdOaGJpQmlaU0JtYjNWdVpDQnBiaUIwYUdVZ1VFRlVSVTVVVXlCbWFXeGxJR2x1SUhSb1pTQnpZVzFsSUdScGNtVmpkRzl5ZVM1Y2JpQXFYRzRnS2lCY2JpQXFMMXh1WEc0bmRYTmxJSE4wY21samRDYzdYRzVjYmk4cUlHZHNiMkpoYkNCVGVXMWliMndnS2k5Y2JseHVkbUZ5SUVsVVJWSkJWRTlTWDFOWlRVSlBUQ0E5SUhSNWNHVnZaaUJUZVcxaWIyd2dQVDA5SUNkbWRXNWpkR2x2YmljZ0ppWWdVM2x0WW05c0xtbDBaWEpoZEc5eU8xeHVkbUZ5SUVaQlZWaGZTVlJGVWtGVVQxSmZVMWxOUWs5TUlEMGdKMEJBYVhSbGNtRjBiM0luT3lBdkx5QkNaV1p2Y21VZ1UzbHRZbTlzSUhOd1pXTXVYRzVjYmk4cUtseHVJQ29nVW1WMGRYSnVjeUIwYUdVZ2FYUmxjbUYwYjNJZ2JXVjBhRzlrSUdaMWJtTjBhVzl1SUdOdmJuUmhhVzVsWkNCdmJpQjBhR1VnYVhSbGNtRmliR1VnYjJKcVpXTjBMbHh1SUNwY2JpQXFJRUpsSUhOMWNtVWdkRzhnYVc1MmIydGxJSFJvWlNCbWRXNWpkR2x2YmlCM2FYUm9JSFJvWlNCcGRHVnlZV0pzWlNCaGN5QmpiMjUwWlhoME9seHVJQ3BjYmlBcUlDQWdJQ0IyWVhJZ2FYUmxjbUYwYjNKR2JpQTlJR2RsZEVsMFpYSmhkRzl5Um00b2JYbEpkR1Z5WVdKc1pTazdYRzRnS2lBZ0lDQWdhV1lnS0dsMFpYSmhkRzl5Um00cElIdGNiaUFxSUNBZ0lDQWdJSFpoY2lCcGRHVnlZWFJ2Y2lBOUlHbDBaWEpoZEc5eVJtNHVZMkZzYkNodGVVbDBaWEpoWW14bEtUdGNiaUFxSUNBZ0lDQWdJQzR1TGx4dUlDb2dJQ0FnSUgxY2JpQXFYRzRnS2lCQWNHRnlZVzBnZXo5dlltcGxZM1I5SUcxaGVXSmxTWFJsY21GaWJHVmNiaUFxSUVCeVpYUjFjbTRnZXo5bWRXNWpkR2x2Ym4xY2JpQXFMMXh1Wm5WdVkzUnBiMjRnWjJWMFNYUmxjbUYwYjNKR2JpaHRZWGxpWlVsMFpYSmhZbXhsS1NCN1hHNGdJSFpoY2lCcGRHVnlZWFJ2Y2tadUlEMGdiV0Y1WW1WSmRHVnlZV0pzWlNBbUppQW9TVlJGVWtGVVQxSmZVMWxOUWs5TUlDWW1JRzFoZVdKbFNYUmxjbUZpYkdWYlNWUkZVa0ZVVDFKZlUxbE5RazlNWFNCOGZDQnRZWGxpWlVsMFpYSmhZbXhsVzBaQlZWaGZTVlJGVWtGVVQxSmZVMWxOUWs5TVhTazdYRzRnSUdsbUlDaDBlWEJsYjJZZ2FYUmxjbUYwYjNKR2JpQTlQVDBnSjJaMWJtTjBhVzl1SnlrZ2UxeHVJQ0FnSUhKbGRIVnliaUJwZEdWeVlYUnZja1p1TzF4dUlDQjlYRzU5WEc1Y2JtMXZaSFZzWlM1bGVIQnZjblJ6SUQwZ1oyVjBTWFJsY21GMGIzSkdianNpTENJdktpcGNiaUFxSUVOdmNIbHlhV2RvZENBeU1ERTBMVEl3TVRVc0lFWmhZMlZpYjI5ckxDQkpibU11WEc0Z0tpQkJiR3dnY21sbmFIUnpJSEpsYzJWeWRtVmtMbHh1SUNwY2JpQXFJRlJvYVhNZ2MyOTFjbU5sSUdOdlpHVWdhWE1nYkdsalpXNXpaV1FnZFc1a1pYSWdkR2hsSUVKVFJDMXpkSGxzWlNCc2FXTmxibk5sSUdadmRXNWtJR2x1SUhSb1pWeHVJQ29nVEVsRFJVNVRSU0JtYVd4bElHbHVJSFJvWlNCeWIyOTBJR1JwY21WamRHOXllU0J2WmlCMGFHbHpJSE52ZFhKalpTQjBjbVZsTGlCQmJpQmhaR1JwZEdsdmJtRnNJR2R5WVc1MFhHNGdLaUJ2WmlCd1lYUmxiblFnY21sbmFIUnpJR05oYmlCaVpTQm1iM1Z1WkNCcGJpQjBhR1VnVUVGVVJVNVVVeUJtYVd4bElHbHVJSFJvWlNCellXMWxJR1JwY21WamRHOXllUzVjYmlBcVhHNGdLaTljYmx4dUozVnpaU0J6ZEhKcFkzUW5PMXh1WEc0dktpcGNiaUFxSUVadmNtdGxaQ0JtY205dElHWmlhbk12ZDJGeWJtbHVaenBjYmlBcUlHaDBkSEJ6T2k4dloybDBhSFZpTG1OdmJTOW1ZV05sWW05dmF5OW1ZbXB6TDJKc2IySXZaVFkyWW1FeU1HRmtOV0psTkRNelpXSTFORFF5TTJZeVlqQTVOMlE0TWprek1qUmtPV1JsTmk5d1lXTnJZV2RsY3k5bVltcHpMM055WXk5ZlgyWnZjbXR6WDE4dmQyRnlibWx1Wnk1cWMxeHVJQ3BjYmlBcUlFOXViSGtnWTJoaGJtZGxJR2x6SUhkbElIVnpaU0JqYjI1emIyeGxMbmRoY200Z2FXNXpkR1ZoWkNCdlppQmpiMjV6YjJ4bExtVnljbTl5TEZ4dUlDb2dZVzVrSUdSdklHNXZkR2hwYm1jZ2QyaGxiaUFuWTI5dWMyOXNaU2NnYVhNZ2JtOTBJSE4xY0hCdmNuUmxaQzVjYmlBcUlGUm9hWE1nY21WaGJHeDVJSE5wYlhCc2FXWnBaWE1nZEdobElHTnZaR1V1WEc0Z0tpQXRMUzFjYmlBcUlGTnBiV2xzWVhJZ2RHOGdhVzUyWVhKcFlXNTBJR0oxZENCdmJteDVJR3h2WjNNZ1lTQjNZWEp1YVc1bklHbG1JSFJvWlNCamIyNWthWFJwYjI0Z2FYTWdibTkwSUcxbGRDNWNiaUFxSUZSb2FYTWdZMkZ1SUdKbElIVnpaV1FnZEc4Z2JHOW5JR2x6YzNWbGN5QnBiaUJrWlhabGJHOXdiV1Z1ZENCbGJuWnBjbTl1YldWdWRITWdhVzRnWTNKcGRHbGpZV3hjYmlBcUlIQmhkR2h6TGlCU1pXMXZkbWx1WnlCMGFHVWdiRzluWjJsdVp5QmpiMlJsSUdadmNpQndjbTlrZFdOMGFXOXVJR1Z1ZG1seWIyNXRaVzUwY3lCM2FXeHNJR3RsWlhBZ2RHaGxYRzRnS2lCellXMWxJR3h2WjJsaklHRnVaQ0JtYjJ4c2IzY2dkR2hsSUhOaGJXVWdZMjlrWlNCd1lYUm9jeTVjYmlBcUwxeHVYRzUyWVhJZ2JHOTNVSEpwYjNKcGRIbFhZWEp1YVc1bklEMGdablZ1WTNScGIyNGdLQ2tnZTMwN1hHNWNibWxtSUNod2NtOWpaWE56TG1WdWRpNU9UMFJGWDBWT1ZpQWhQVDBnSjNCeWIyUjFZM1JwYjI0bktTQjdYRzRnSUhaaGNpQndjbWx1ZEZkaGNtNXBibWNnUFNCbWRXNWpkR2x2YmlBb1ptOXliV0YwS1NCN1hHNGdJQ0FnWm05eUlDaDJZWElnWDJ4bGJpQTlJR0Z5WjNWdFpXNTBjeTVzWlc1bmRHZ3NJR0Z5WjNNZ1BTQkJjbkpoZVNoZmJHVnVJRDRnTVNBL0lGOXNaVzRnTFNBeElEb2dNQ2tzSUY5clpYa2dQU0F4T3lCZmEyVjVJRHdnWDJ4bGJqc2dYMnRsZVNzcktTQjdYRzRnSUNBZ0lDQmhjbWR6VzE5clpYa2dMU0F4WFNBOUlHRnlaM1Z0Wlc1MGMxdGZhMlY1WFR0Y2JpQWdJQ0I5WEc1Y2JpQWdJQ0IyWVhJZ1lYSm5TVzVrWlhnZ1BTQXdPMXh1SUNBZ0lIWmhjaUJ0WlhOellXZGxJRDBnSjFkaGNtNXBibWM2SUNjZ0t5Qm1iM0p0WVhRdWNtVndiR0ZqWlNndkpYTXZaeXdnWm5WdVkzUnBiMjRnS0NrZ2UxeHVJQ0FnSUNBZ2NtVjBkWEp1SUdGeVozTmJZWEpuU1c1a1pYZ3JLMTA3WEc0Z0lDQWdmU2s3WEc0Z0lDQWdhV1lnS0hSNWNHVnZaaUJqYjI1emIyeGxJQ0U5UFNBbmRXNWtaV1pwYm1Wa0p5a2dlMXh1SUNBZ0lDQWdZMjl1YzI5c1pTNTNZWEp1S0cxbGMzTmhaMlVwTzF4dUlDQWdJSDFjYmlBZ0lDQjBjbmtnZTF4dUlDQWdJQ0FnTHk4Z0xTMHRJRmRsYkdOdmJXVWdkRzhnWkdWaWRXZG5hVzVuSUZKbFlXTjBJQzB0TFZ4dUlDQWdJQ0FnTHk4Z1ZHaHBjeUJsY25KdmNpQjNZWE1nZEdoeWIzZHVJR0Z6SUdFZ1kyOXVkbVZ1YVdWdVkyVWdjMjhnZEdoaGRDQjViM1VnWTJGdUlIVnpaU0IwYUdseklITjBZV05yWEc0Z0lDQWdJQ0F2THlCMGJ5Qm1hVzVrSUhSb1pTQmpZV3hzYzJsMFpTQjBhR0YwSUdOaGRYTmxaQ0IwYUdseklIZGhjbTVwYm1jZ2RHOGdabWx5WlM1Y2JpQWdJQ0FnSUhSb2NtOTNJRzVsZHlCRmNuSnZjaWh0WlhOellXZGxLVHRjYmlBZ0lDQjlJR05oZEdOb0lDaDRLU0I3ZlZ4dUlDQjlPMXh1WEc0Z0lHeHZkMUJ5YVc5eWFYUjVWMkZ5Ym1sdVp5QTlJR1oxYm1OMGFXOXVJQ2hqYjI1a2FYUnBiMjRzSUdadmNtMWhkQ2tnZTF4dUlDQWdJR2xtSUNobWIzSnRZWFFnUFQwOUlIVnVaR1ZtYVc1bFpDa2dlMXh1SUNBZ0lDQWdkR2h5YjNjZ2JtVjNJRVZ5Y205eUtDZGdkMkZ5Ym1sdVp5aGpiMjVrYVhScGIyNHNJR1p2Y20xaGRDd2dMaTR1WVhKbmN5bGdJSEpsY1hWcGNtVnpJR0VnZDJGeWJtbHVaeUFuSUNzZ0oyMWxjM05oWjJVZ1lYSm5kVzFsYm5RbktUdGNiaUFnSUNCOVhHNGdJQ0FnYVdZZ0tDRmpiMjVrYVhScGIyNHBJSHRjYmlBZ0lDQWdJR1p2Y2lBb2RtRnlJRjlzWlc0eUlEMGdZWEpuZFcxbGJuUnpMbXhsYm1kMGFDd2dZWEpuY3lBOUlFRnljbUY1S0Y5c1pXNHlJRDRnTWlBL0lGOXNaVzR5SUMwZ01pQTZJREFwTENCZmEyVjVNaUE5SURJN0lGOXJaWGt5SUR3Z1gyeGxiakk3SUY5clpYa3lLeXNwSUh0Y2JpQWdJQ0FnSUNBZ1lYSm5jMXRmYTJWNU1pQXRJREpkSUQwZ1lYSm5kVzFsYm5SelcxOXJaWGt5WFR0Y2JpQWdJQ0FnSUgxY2JseHVJQ0FnSUNBZ2NISnBiblJYWVhKdWFXNW5MbUZ3Y0d4NUtIVnVaR1ZtYVc1bFpDd2dXMlp2Y20xaGRGMHVZMjl1WTJGMEtHRnlaM01wS1R0Y2JpQWdJQ0I5WEc0Z0lIMDdYRzU5WEc1Y2JtMXZaSFZzWlM1bGVIQnZjblJ6SUQwZ2JHOTNVSEpwYjNKcGRIbFhZWEp1YVc1bk95SXNJaThxS2x4dUlDb2dRMjl3ZVhKcFoyaDBJREl3TVRNdGNISmxjMlZ1ZEN3Z1JtRmpaV0p2YjJzc0lFbHVZeTVjYmlBcUlFRnNiQ0J5YVdkb2RITWdjbVZ6WlhKMlpXUXVYRzRnS2x4dUlDb2dWR2hwY3lCemIzVnlZMlVnWTI5a1pTQnBjeUJzYVdObGJuTmxaQ0IxYm1SbGNpQjBhR1VnUWxORUxYTjBlV3hsSUd4cFkyVnVjMlVnWm05MWJtUWdhVzRnZEdobFhHNGdLaUJNU1VORlRsTkZJR1pwYkdVZ2FXNGdkR2hsSUhKdmIzUWdaR2x5WldOMGIzSjVJRzltSUhSb2FYTWdjMjkxY21ObElIUnlaV1V1SUVGdUlHRmtaR2wwYVc5dVlXd2daM0poYm5SY2JpQXFJRzltSUhCaGRHVnVkQ0J5YVdkb2RITWdZMkZ1SUdKbElHWnZkVzVrSUdsdUlIUm9aU0JRUVZSRlRsUlRJR1pwYkdVZ2FXNGdkR2hsSUhOaGJXVWdaR2x5WldOMGIzSjVMbHh1SUNwY2JpQXFMMXh1SjNWelpTQnpkSEpwWTNRbk8xeHVYRzUyWVhJZ1gzQnliMlJKYm5aaGNtbGhiblFnUFNCeVpYRjFhWEpsS0NjdUwzSmxZV04wVUhKdlpFbHVkbUZ5YVdGdWRDY3BPMXh1WEc1MllYSWdVbVZoWTNSRmJHVnRaVzUwSUQwZ2NtVnhkV2x5WlNnbkxpOVNaV0ZqZEVWc1pXMWxiblFuS1R0Y2JseHVkbUZ5SUdsdWRtRnlhV0Z1ZENBOUlISmxjWFZwY21Vb0oyWmlhbk12YkdsaUwybHVkbUZ5YVdGdWRDY3BPMXh1WEc0dktpcGNiaUFxSUZKbGRIVnlibk1nZEdobElHWnBjbk4wSUdOb2FXeGtJR2x1SUdFZ1kyOXNiR1ZqZEdsdmJpQnZaaUJqYUdsc1pISmxiaUJoYm1RZ2RtVnlhV1pwWlhNZ2RHaGhkQ0IwYUdWeVpWeHVJQ29nYVhNZ2IyNXNlU0J2Ym1VZ1kyaHBiR1FnYVc0Z2RHaGxJR052Ykd4bFkzUnBiMjR1WEc0Z0tseHVJQ29nVTJWbElHaDBkSEJ6T2k4dlptRmpaV0p2YjJzdVoybDBhSFZpTG1sdkwzSmxZV04wTDJSdlkzTXZkRzl3TFd4bGRtVnNMV0Z3YVM1b2RHMXNJM0psWVdOMExtTm9hV3hrY21WdUxtOXViSGxjYmlBcVhHNGdLaUJVYUdVZ1kzVnljbVZ1ZENCcGJYQnNaVzFsYm5SaGRHbHZiaUJ2WmlCMGFHbHpJR1oxYm1OMGFXOXVJR0Z6YzNWdFpYTWdkR2hoZENCaElITnBibWRzWlNCamFHbHNaQ0JuWlhSelhHNGdLaUJ3WVhOelpXUWdkMmwwYUc5MWRDQmhJSGR5WVhCd1pYSXNJR0oxZENCMGFHVWdjSFZ5Y0c5elpTQnZaaUIwYUdseklHaGxiSEJsY2lCbWRXNWpkR2x2YmlCcGN5QjBiMXh1SUNvZ1lXSnpkSEpoWTNRZ1lYZGhlU0IwYUdVZ2NHRnlkR2xqZFd4aGNpQnpkSEoxWTNSMWNtVWdiMllnWTJocGJHUnlaVzR1WEc0Z0tseHVJQ29nUUhCaGNtRnRJSHMvYjJKcVpXTjBmU0JqYUdsc1pISmxiaUJEYUdsc1pDQmpiMnhzWldOMGFXOXVJSE4wY25WamRIVnlaUzVjYmlBcUlFQnlaWFIxY200Z2UxSmxZV04wUld4bGJXVnVkSDBnVkdobElHWnBjbk4wSUdGdVpDQnZibXg1SUdCU1pXRmpkRVZzWlcxbGJuUmdJR052Ym5SaGFXNWxaQ0JwYmlCMGFHVmNiaUFxSUhOMGNuVmpkSFZ5WlM1Y2JpQXFMMXh1Wm5WdVkzUnBiMjRnYjI1c2VVTm9hV3hrS0dOb2FXeGtjbVZ1S1NCN1hHNGdJQ0ZTWldGamRFVnNaVzFsYm5RdWFYTldZV3hwWkVWc1pXMWxiblFvWTJocGJHUnlaVzRwSUQ4Z2NISnZZMlZ6Y3k1bGJuWXVUazlFUlY5RlRsWWdJVDA5SUNkd2NtOWtkV04wYVc5dUp5QS9JR2x1ZG1GeWFXRnVkQ2htWVd4elpTd2dKMUpsWVdOMExrTm9hV3hrY21WdUxtOXViSGtnWlhod1pXTjBaV1FnZEc4Z2NtVmpaV2wyWlNCaElITnBibWRzWlNCU1pXRmpkQ0JsYkdWdFpXNTBJR05vYVd4a0xpY3BJRG9nWDNCeWIyUkpiblpoY21saGJuUW9KekUwTXljcElEb2dkbTlwWkNBd08xeHVJQ0J5WlhSMWNtNGdZMmhwYkdSeVpXNDdYRzU5WEc1Y2JtMXZaSFZzWlM1bGVIQnZjblJ6SUQwZ2IyNXNlVU5vYVd4a095SXNJaThxS2x4dUlDb2dRMjl3ZVhKcFoyaDBJQ2hqS1NBeU1ERXpMWEJ5WlhObGJuUXNJRVpoWTJWaWIyOXJMQ0JKYm1NdVhHNGdLaUJCYkd3Z2NtbG5hSFJ6SUhKbGMyVnlkbVZrTGx4dUlDcGNiaUFxSUZSb2FYTWdjMjkxY21ObElHTnZaR1VnYVhNZ2JHbGpaVzV6WldRZ2RXNWtaWElnZEdobElFSlRSQzF6ZEhsc1pTQnNhV05sYm5ObElHWnZkVzVrSUdsdUlIUm9aVnh1SUNvZ1RFbERSVTVUUlNCbWFXeGxJR2x1SUhSb1pTQnliMjkwSUdScGNtVmpkRzl5ZVNCdlppQjBhR2x6SUhOdmRYSmpaU0IwY21WbExpQkJiaUJoWkdScGRHbHZibUZzSUdkeVlXNTBYRzRnS2lCdlppQndZWFJsYm5RZ2NtbG5hSFJ6SUdOaGJpQmlaU0JtYjNWdVpDQnBiaUIwYUdVZ1VFRlVSVTVVVXlCbWFXeGxJR2x1SUhSb1pTQnpZVzFsSUdScGNtVmpkRzl5ZVM1Y2JpQXFYRzRnS2lCY2JpQXFMMXh1SjNWelpTQnpkSEpwWTNRbk8xeHVYRzR2S2lwY2JpQXFJRmRCVWs1SlRrYzZJRVJQSUU1UFZDQnRZVzUxWVd4c2VTQnlaWEYxYVhKbElIUm9hWE1nYlc5a2RXeGxMbHh1SUNvZ1ZHaHBjeUJwY3lCaElISmxjR3hoWTJWdFpXNTBJR1p2Y2lCZ2FXNTJZWEpwWVc1MEtDNHVMaWxnSUhWelpXUWdZbmtnZEdobElHVnljbTl5SUdOdlpHVWdjM2x6ZEdWdFhHNGdLaUJoYm1RZ2QybHNiQ0JmYjI1c2VWOGdZbVVnY21WeGRXbHlaV1FnWW5rZ2RHaGxJR052Y25KbGMzQnZibVJwYm1jZ1ltRmlaV3dnY0dGemN5NWNiaUFxSUVsMElHRnNkMkY1Y3lCMGFISnZkM011WEc0Z0tpOWNibHh1Wm5WdVkzUnBiMjRnY21WaFkzUlFjbTlrU1c1MllYSnBZVzUwS0dOdlpHVXBJSHRjYmlBZ2RtRnlJR0Z5WjBOdmRXNTBJRDBnWVhKbmRXMWxiblJ6TG14bGJtZDBhQ0F0SURFN1hHNWNiaUFnZG1GeUlHMWxjM05oWjJVZ1BTQW5UV2x1YVdacFpXUWdVbVZoWTNRZ1pYSnliM0lnSXljZ0t5QmpiMlJsSUNzZ0p6c2dkbWx6YVhRZ0p5QXJJQ2RvZEhSd09pOHZabUZqWldKdmIyc3VaMmwwYUhWaUxtbHZMM0psWVdOMEwyUnZZM012WlhKeWIzSXRaR1ZqYjJSbGNpNW9kRzFzUDJsdWRtRnlhV0Z1ZEQwbklDc2dZMjlrWlR0Y2JseHVJQ0JtYjNJZ0tIWmhjaUJoY21kSlpIZ2dQU0F3T3lCaGNtZEpaSGdnUENCaGNtZERiM1Z1ZERzZ1lYSm5TV1I0S3lzcElIdGNiaUFnSUNCdFpYTnpZV2RsSUNzOUlDY21ZWEpuYzF0ZFBTY2dLeUJsYm1OdlpHVlZVa2xEYjIxd2IyNWxiblFvWVhKbmRXMWxiblJ6VzJGeVowbGtlQ0FySURGZEtUdGNiaUFnZlZ4dVhHNGdJRzFsYzNOaFoyVWdLejBnSnlCbWIzSWdkR2hsSUdaMWJHd2diV1Z6YzJGblpTQnZjaUIxYzJVZ2RHaGxJRzV2YmkxdGFXNXBabWxsWkNCa1pYWWdaVzUyYVhKdmJtMWxiblFuSUNzZ0p5Qm1iM0lnWm5Wc2JDQmxjbkp2Y25NZ1lXNWtJR0ZrWkdsMGFXOXVZV3dnYUdWc2NHWjFiQ0IzWVhKdWFXNW5jeTRuTzF4dVhHNGdJSFpoY2lCbGNuSnZjaUE5SUc1bGR5QkZjbkp2Y2lodFpYTnpZV2RsS1R0Y2JpQWdaWEp5YjNJdWJtRnRaU0E5SUNkSmJuWmhjbWxoYm5RZ1ZtbHZiR0YwYVc5dUp6dGNiaUFnWlhKeWIzSXVabkpoYldWelZHOVFiM0FnUFNBeE95QXZMeUIzWlNCa2IyNG5kQ0JqWVhKbElHRmliM1YwSUhKbFlXTjBVSEp2WkVsdWRtRnlhV0Z1ZENkeklHOTNiaUJtY21GdFpWeHVYRzRnSUhSb2NtOTNJR1Z5Y205eU8xeHVmVnh1WEc1dGIyUjFiR1V1Wlhod2IzSjBjeUE5SUhKbFlXTjBVSEp2WkVsdWRtRnlhV0Z1ZERzaUxDSXZLaXBjYmlBcUlFTnZjSGx5YVdkb2RDQXlNREV6TFhCeVpYTmxiblFzSUVaaFkyVmliMjlyTENCSmJtTXVYRzRnS2lCQmJHd2djbWxuYUhSeklISmxjMlZ5ZG1Wa0xseHVJQ3BjYmlBcUlGUm9hWE1nYzI5MWNtTmxJR052WkdVZ2FYTWdiR2xqWlc1elpXUWdkVzVrWlhJZ2RHaGxJRUpUUkMxemRIbHNaU0JzYVdObGJuTmxJR1p2ZFc1a0lHbHVJSFJvWlZ4dUlDb2dURWxEUlU1VFJTQm1hV3hsSUdsdUlIUm9aU0J5YjI5MElHUnBjbVZqZEc5eWVTQnZaaUIwYUdseklITnZkWEpqWlNCMGNtVmxMaUJCYmlCaFpHUnBkR2x2Ym1Gc0lHZHlZVzUwWEc0Z0tpQnZaaUJ3WVhSbGJuUWdjbWxuYUhSeklHTmhiaUJpWlNCbWIzVnVaQ0JwYmlCMGFHVWdVRUZVUlU1VVV5Qm1hV3hsSUdsdUlIUm9aU0J6WVcxbElHUnBjbVZqZEc5eWVTNWNiaUFxWEc0Z0tpOWNibHh1SjNWelpTQnpkSEpwWTNRbk8xeHVYRzUyWVhJZ1gzQnliMlJKYm5aaGNtbGhiblFnUFNCeVpYRjFhWEpsS0NjdUwzSmxZV04wVUhKdlpFbHVkbUZ5YVdGdWRDY3BPMXh1WEc1MllYSWdVbVZoWTNSRGRYSnlaVzUwVDNkdVpYSWdQU0J5WlhGMWFYSmxLQ2N1TDFKbFlXTjBRM1Z5Y21WdWRFOTNibVZ5SnlrN1hHNTJZWElnVWtWQlExUmZSVXhGVFVWT1ZGOVVXVkJGSUQwZ2NtVnhkV2x5WlNnbkxpOVNaV0ZqZEVWc1pXMWxiblJUZVcxaWIyd25LVHRjYmx4dWRtRnlJR2RsZEVsMFpYSmhkRzl5Um00Z1BTQnlaWEYxYVhKbEtDY3VMMmRsZEVsMFpYSmhkRzl5Um00bktUdGNiblpoY2lCcGJuWmhjbWxoYm5RZ1BTQnlaWEYxYVhKbEtDZG1ZbXB6TDJ4cFlpOXBiblpoY21saGJuUW5LVHRjYm5aaGNpQkxaWGxGYzJOaGNHVlZkR2xzY3lBOUlISmxjWFZwY21Vb0p5NHZTMlY1UlhOallYQmxWWFJwYkhNbktUdGNiblpoY2lCM1lYSnVhVzVuSUQwZ2NtVnhkV2x5WlNnblptSnFjeTlzYVdJdmQyRnlibWx1WnljcE8xeHVYRzUyWVhJZ1UwVlFRVkpCVkU5U0lEMGdKeTRuTzF4dWRtRnlJRk5WUWxORlVFRlNRVlJQVWlBOUlDYzZKenRjYmx4dUx5b3FYRzRnS2lCVWFHbHpJR2x6SUdsdWJHbHVaV1FnWm5KdmJTQlNaV0ZqZEVWc1pXMWxiblFnYzJsdVkyVWdkR2hwY3lCbWFXeGxJR2x6SUhOb1lYSmxaQ0JpWlhSM1pXVnVYRzRnS2lCcGMyOXRiM0p3YUdsaklHRnVaQ0J5Wlc1a1pYSmxjbk11SUZkbElHTnZkV3hrSUdWNGRISmhZM1FnZEdocGN5QjBieUJoWEc0Z0tseHVJQ292WEc1Y2JpOHFLbHh1SUNvZ1ZFOUVUem9nVkdWemRDQjBhR0YwSUdFZ2MybHVaMnhsSUdOb2FXeGtJR0Z1WkNCaGJpQmhjbkpoZVNCM2FYUm9JRzl1WlNCcGRHVnRJR2hoZG1VZ2RHaGxJSE5oYldVZ2EyVjVYRzRnS2lCd1lYUjBaWEp1TGx4dUlDb3ZYRzVjYm5aaGNpQmthV1JYWVhKdVFXSnZkWFJOWVhCeklEMGdabUZzYzJVN1hHNWNiaThxS2x4dUlDb2dSMlZ1WlhKaGRHVWdZU0JyWlhrZ2MzUnlhVzVuSUhSb1lYUWdhV1JsYm5ScFptbGxjeUJoSUdOdmJYQnZibVZ1ZENCM2FYUm9hVzRnWVNCelpYUXVYRzRnS2x4dUlDb2dRSEJoY21GdElIc3FmU0JqYjIxd2IyNWxiblFnUVNCamIyMXdiMjVsYm5RZ2RHaGhkQ0JqYjNWc1pDQmpiMjUwWVdsdUlHRWdiV0Z1ZFdGc0lHdGxlUzVjYmlBcUlFQndZWEpoYlNCN2JuVnRZbVZ5ZlNCcGJtUmxlQ0JKYm1SbGVDQjBhR0YwSUdseklIVnpaV1FnYVdZZ1lTQnRZVzUxWVd3Z2EyVjVJR2x6SUc1dmRDQndjbTkyYVdSbFpDNWNiaUFxSUVCeVpYUjFjbTRnZTNOMGNtbHVaMzFjYmlBcUwxeHVablZ1WTNScGIyNGdaMlYwUTI5dGNHOXVaVzUwUzJWNUtHTnZiWEJ2Ym1WdWRDd2dhVzVrWlhncElIdGNiaUFnTHk4Z1JHOGdjMjl0WlNCMGVYQmxZMmhsWTJ0cGJtY2dhR1Z5WlNCemFXNWpaU0IzWlNCallXeHNJSFJvYVhNZ1lteHBibVJzZVM0Z1YyVWdkMkZ1ZENCMGJ5Qmxibk4xY21WY2JpQWdMeThnZEdoaGRDQjNaU0JrYjI0bmRDQmliRzlqYXlCd2IzUmxiblJwWVd3Z1puVjBkWEpsSUVWVElFRlFTWE11WEc0Z0lHbG1JQ2hqYjIxd2IyNWxiblFnSmlZZ2RIbHdaVzltSUdOdmJYQnZibVZ1ZENBOVBUMGdKMjlpYW1WamRDY2dKaVlnWTI5dGNHOXVaVzUwTG10bGVTQWhQU0J1ZFd4c0tTQjdYRzRnSUNBZ0x5OGdSWGh3YkdsamFYUWdhMlY1WEc0Z0lDQWdjbVYwZFhKdUlFdGxlVVZ6WTJGd1pWVjBhV3h6TG1WelkyRndaU2hqYjIxd2IyNWxiblF1YTJWNUtUdGNiaUFnZlZ4dUlDQXZMeUJKYlhCc2FXTnBkQ0JyWlhrZ1pHVjBaWEp0YVc1bFpDQmllU0IwYUdVZ2FXNWtaWGdnYVc0Z2RHaGxJSE5sZEZ4dUlDQnlaWFIxY200Z2FXNWtaWGd1ZEc5VGRISnBibWNvTXpZcE8xeHVmVnh1WEc0dktpcGNiaUFxSUVCd1lYSmhiU0I3UHlwOUlHTm9hV3hrY21WdUlFTm9hV3hrY21WdUlIUnlaV1VnWTI5dWRHRnBibVZ5TGx4dUlDb2dRSEJoY21GdElIc2hjM1J5YVc1bmZTQnVZVzFsVTI5R1lYSWdUbUZ0WlNCdlppQjBhR1VnYTJWNUlIQmhkR2dnYzI4Z1ptRnlMbHh1SUNvZ1FIQmhjbUZ0SUhzaFpuVnVZM1JwYjI1OUlHTmhiR3hpWVdOcklFTmhiR3hpWVdOcklIUnZJR2x1ZG05clpTQjNhWFJvSUdWaFkyZ2dZMmhwYkdRZ1ptOTFibVF1WEc0Z0tpQkFjR0Z5WVcwZ2V6OHFmU0IwY21GMlpYSnpaVU52Ym5SbGVIUWdWWE5sWkNCMGJ5QndZWE56SUdsdVptOXliV0YwYVc5dUlIUm9jbTkxWjJodmRYUWdkR2hsSUhSeVlYWmxjbk5oYkZ4dUlDb2djSEp2WTJWemN5NWNiaUFxSUVCeVpYUjFjbTRnZXlGdWRXMWlaWEo5SUZSb1pTQnVkVzFpWlhJZ2IyWWdZMmhwYkdSeVpXNGdhVzRnZEdocGN5QnpkV0owY21WbExseHVJQ292WEc1bWRXNWpkR2x2YmlCMGNtRjJaWEp6WlVGc2JFTm9hV3hrY21WdVNXMXdiQ2hqYUdsc1pISmxiaXdnYm1GdFpWTnZSbUZ5TENCallXeHNZbUZqYXl3Z2RISmhkbVZ5YzJWRGIyNTBaWGgwS1NCN1hHNGdJSFpoY2lCMGVYQmxJRDBnZEhsd1pXOW1JR05vYVd4a2NtVnVPMXh1WEc0Z0lHbG1JQ2gwZVhCbElEMDlQU0FuZFc1a1pXWnBibVZrSnlCOGZDQjBlWEJsSUQwOVBTQW5ZbTl2YkdWaGJpY3BJSHRjYmlBZ0lDQXZMeUJCYkd3Z2IyWWdkR2hsSUdGaWIzWmxJR0Z5WlNCd1pYSmpaV2wyWldRZ1lYTWdiblZzYkM1Y2JpQWdJQ0JqYUdsc1pISmxiaUE5SUc1MWJHdzdYRzRnSUgxY2JseHVJQ0JwWmlBb1kyaHBiR1J5Wlc0Z1BUMDlJRzUxYkd3Z2ZId2dkSGx3WlNBOVBUMGdKM04wY21sdVp5Y2dmSHdnZEhsd1pTQTlQVDBnSjI1MWJXSmxjaWNnZkh4Y2JpQWdMeThnVkdobElHWnZiR3h2ZDJsdVp5QnBjeUJwYm14cGJtVmtJR1p5YjIwZ1VtVmhZM1JGYkdWdFpXNTBMaUJVYUdseklHMWxZVzV6SUhkbElHTmhiaUJ2Y0hScGJXbDZaVnh1SUNBdkx5QnpiMjFsSUdOb1pXTnJjeTRnVW1WaFkzUWdSbWxpWlhJZ1lXeHpieUJwYm14cGJtVnpJSFJvYVhNZ2JHOW5hV01nWm05eUlITnBiV2xzWVhJZ2NIVnljRzl6WlhNdVhHNGdJSFI1Y0dVZ1BUMDlJQ2R2WW1wbFkzUW5JQ1ltSUdOb2FXeGtjbVZ1TGlRa2RIbHdaVzltSUQwOVBTQlNSVUZEVkY5RlRFVk5SVTVVWDFSWlVFVXBJSHRjYmlBZ0lDQmpZV3hzWW1GamF5aDBjbUYyWlhKelpVTnZiblJsZUhRc0lHTm9hV3hrY21WdUxGeHVJQ0FnSUM4dklFbG1JR2wwSjNNZ2RHaGxJRzl1YkhrZ1kyaHBiR1FzSUhSeVpXRjBJSFJvWlNCdVlXMWxJR0Z6SUdsbUlHbDBJSGRoY3lCM2NtRndjR1ZrSUdsdUlHRnVJR0Z5Y21GNVhHNGdJQ0FnTHk4Z2MyOGdkR2hoZENCcGRDZHpJR052Ym5OcGMzUmxiblFnYVdZZ2RHaGxJRzUxYldKbGNpQnZaaUJqYUdsc1pISmxiaUJuY205M2N5NWNiaUFnSUNCdVlXMWxVMjlHWVhJZ1BUMDlJQ2NuSUQ4Z1UwVlFRVkpCVkU5U0lDc2daMlYwUTI5dGNHOXVaVzUwUzJWNUtHTm9hV3hrY21WdUxDQXdLU0E2SUc1aGJXVlRiMFpoY2lrN1hHNGdJQ0FnY21WMGRYSnVJREU3WEc0Z0lIMWNibHh1SUNCMllYSWdZMmhwYkdRN1hHNGdJSFpoY2lCdVpYaDBUbUZ0WlR0Y2JpQWdkbUZ5SUhOMVluUnlaV1ZEYjNWdWRDQTlJREE3SUM4dklFTnZkVzUwSUc5bUlHTm9hV3hrY21WdUlHWnZkVzVrSUdsdUlIUm9aU0JqZFhKeVpXNTBJSE4xWW5SeVpXVXVYRzRnSUhaaGNpQnVaWGgwVG1GdFpWQnlaV1pwZUNBOUlHNWhiV1ZUYjBaaGNpQTlQVDBnSnljZ1B5QlRSVkJCVWtGVVQxSWdPaUJ1WVcxbFUyOUdZWElnS3lCVFZVSlRSVkJCVWtGVVQxSTdYRzVjYmlBZ2FXWWdLRUZ5Y21GNUxtbHpRWEp5WVhrb1kyaHBiR1J5Wlc0cEtTQjdYRzRnSUNBZ1ptOXlJQ2gyWVhJZ2FTQTlJREE3SUdrZ1BDQmphR2xzWkhKbGJpNXNaVzVuZEdnN0lHa3JLeWtnZTF4dUlDQWdJQ0FnWTJocGJHUWdQU0JqYUdsc1pISmxibHRwWFR0Y2JpQWdJQ0FnSUc1bGVIUk9ZVzFsSUQwZ2JtVjRkRTVoYldWUWNtVm1hWGdnS3lCblpYUkRiMjF3YjI1bGJuUkxaWGtvWTJocGJHUXNJR2twTzF4dUlDQWdJQ0FnYzNWaWRISmxaVU52ZFc1MElDczlJSFJ5WVhabGNuTmxRV3hzUTJocGJHUnlaVzVKYlhCc0tHTm9hV3hrTENCdVpYaDBUbUZ0WlN3Z1kyRnNiR0poWTJzc0lIUnlZWFpsY25ObFEyOXVkR1Y0ZENrN1hHNGdJQ0FnZlZ4dUlDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUhaaGNpQnBkR1Z5WVhSdmNrWnVJRDBnWjJWMFNYUmxjbUYwYjNKR2JpaGphR2xzWkhKbGJpazdYRzRnSUNBZ2FXWWdLR2wwWlhKaGRHOXlSbTRwSUh0Y2JpQWdJQ0FnSUhaaGNpQnBkR1Z5WVhSdmNpQTlJR2wwWlhKaGRHOXlSbTR1WTJGc2JDaGphR2xzWkhKbGJpazdYRzRnSUNBZ0lDQjJZWElnYzNSbGNEdGNiaUFnSUNBZ0lHbG1JQ2hwZEdWeVlYUnZja1p1SUNFOVBTQmphR2xzWkhKbGJpNWxiblJ5YVdWektTQjdYRzRnSUNBZ0lDQWdJSFpoY2lCcGFTQTlJREE3WEc0Z0lDQWdJQ0FnSUhkb2FXeGxJQ2doS0hOMFpYQWdQU0JwZEdWeVlYUnZjaTV1WlhoMEtDa3BMbVJ2Ym1VcElIdGNiaUFnSUNBZ0lDQWdJQ0JqYUdsc1pDQTlJSE4wWlhBdWRtRnNkV1U3WEc0Z0lDQWdJQ0FnSUNBZ2JtVjRkRTVoYldVZ1BTQnVaWGgwVG1GdFpWQnlaV1pwZUNBcklHZGxkRU52YlhCdmJtVnVkRXRsZVNoamFHbHNaQ3dnYVdrckt5azdYRzRnSUNBZ0lDQWdJQ0FnYzNWaWRISmxaVU52ZFc1MElDczlJSFJ5WVhabGNuTmxRV3hzUTJocGJHUnlaVzVKYlhCc0tHTm9hV3hrTENCdVpYaDBUbUZ0WlN3Z1kyRnNiR0poWTJzc0lIUnlZWFpsY25ObFEyOXVkR1Y0ZENrN1hHNGdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lIMGdaV3h6WlNCN1hHNGdJQ0FnSUNBZ0lHbG1JQ2h3Y205alpYTnpMbVZ1ZGk1T1QwUkZYMFZPVmlBaFBUMGdKM0J5YjJSMVkzUnBiMjRuS1NCN1hHNGdJQ0FnSUNBZ0lDQWdkbUZ5SUcxaGNITkJjME5vYVd4a2NtVnVRV1JrWlc1a2RXMGdQU0FuSnp0Y2JpQWdJQ0FnSUNBZ0lDQnBaaUFvVW1WaFkzUkRkWEp5Wlc1MFQzZHVaWEl1WTNWeWNtVnVkQ2tnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdkbUZ5SUcxaGNITkJjME5vYVd4a2NtVnVUM2R1WlhKT1lXMWxJRDBnVW1WaFkzUkRkWEp5Wlc1MFQzZHVaWEl1WTNWeWNtVnVkQzVuWlhST1lXMWxLQ2s3WEc0Z0lDQWdJQ0FnSUNBZ0lDQnBaaUFvYldGd2MwRnpRMmhwYkdSeVpXNVBkMjVsY2s1aGJXVXBJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdiV0Z3YzBGelEyaHBiR1J5Wlc1QlpHUmxibVIxYlNBOUlDY2dRMmhsWTJzZ2RHaGxJSEpsYm1SbGNpQnRaWFJvYjJRZ2IyWWdZQ2NnS3lCdFlYQnpRWE5EYUdsc1pISmxiazkzYm1WeVRtRnRaU0FySUNkZ0xpYzdYRzRnSUNBZ0lDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0FnSUhCeWIyTmxjM011Wlc1MkxrNVBSRVZmUlU1V0lDRTlQU0FuY0hKdlpIVmpkR2x2YmljZ1B5QjNZWEp1YVc1bktHUnBaRmRoY201QlltOTFkRTFoY0hNc0lDZFZjMmx1WnlCTllYQnpJR0Z6SUdOb2FXeGtjbVZ1SUdseklHNXZkQ0I1WlhRZ1puVnNiSGtnYzNWd2NHOXlkR1ZrTGlCSmRDQnBjeUJoYmlBbklDc2dKMlY0Y0dWeWFXMWxiblJoYkNCbVpXRjBkWEpsSUhSb1lYUWdiV2xuYUhRZ1ltVWdjbVZ0YjNabFpDNGdRMjl1ZG1WeWRDQnBkQ0IwYnlCaElDY2dLeUFuYzJWeGRXVnVZMlVnTHlCcGRHVnlZV0pzWlNCdlppQnJaWGxsWkNCU1pXRmpkRVZzWlcxbGJuUnpJR2x1YzNSbFlXUXVKWE1uTENCdFlYQnpRWE5EYUdsc1pISmxia0ZrWkdWdVpIVnRLU0E2SUhadmFXUWdNRHRjYmlBZ0lDQWdJQ0FnSUNCa2FXUlhZWEp1UVdKdmRYUk5ZWEJ6SUQwZ2RISjFaVHRjYmlBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNBdkx5QkpkR1Z5WVhSdmNpQjNhV3hzSUhCeWIzWnBaR1VnWlc1MGNua2dXMnNzZGwwZ2RIVndiR1Z6SUhKaGRHaGxjaUIwYUdGdUlIWmhiSFZsY3k1Y2JpQWdJQ0FnSUNBZ2QyaHBiR1VnS0NFb2MzUmxjQ0E5SUdsMFpYSmhkRzl5TG01bGVIUW9LU2t1Wkc5dVpTa2dlMXh1SUNBZ0lDQWdJQ0FnSUhaaGNpQmxiblJ5ZVNBOUlITjBaWEF1ZG1Gc2RXVTdYRzRnSUNBZ0lDQWdJQ0FnYVdZZ0tHVnVkSEo1S1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0JqYUdsc1pDQTlJR1Z1ZEhKNVd6RmRPMXh1SUNBZ0lDQWdJQ0FnSUNBZ2JtVjRkRTVoYldVZ1BTQnVaWGgwVG1GdFpWQnlaV1pwZUNBcklFdGxlVVZ6WTJGd1pWVjBhV3h6TG1WelkyRndaU2hsYm5SeWVWc3dYU2tnS3lCVFZVSlRSVkJCVWtGVVQxSWdLeUJuWlhSRGIyMXdiMjVsYm5STFpYa29ZMmhwYkdRc0lEQXBPMXh1SUNBZ0lDQWdJQ0FnSUNBZ2MzVmlkSEpsWlVOdmRXNTBJQ3M5SUhSeVlYWmxjbk5sUVd4c1EyaHBiR1J5Wlc1SmJYQnNLR05vYVd4a0xDQnVaWGgwVG1GdFpTd2dZMkZzYkdKaFkyc3NJSFJ5WVhabGNuTmxRMjl1ZEdWNGRDazdYRzRnSUNBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNCOVhHNGdJQ0FnZlNCbGJITmxJR2xtSUNoMGVYQmxJRDA5UFNBbmIySnFaV04wSnlrZ2UxeHVJQ0FnSUNBZ2RtRnlJR0ZrWkdWdVpIVnRJRDBnSnljN1hHNGdJQ0FnSUNCcFppQW9jSEp2WTJWemN5NWxibll1VGs5RVJWOUZUbFlnSVQwOUlDZHdjbTlrZFdOMGFXOXVKeWtnZTF4dUlDQWdJQ0FnSUNCaFpHUmxibVIxYlNBOUlDY2dTV1lnZVc5MUlHMWxZVzUwSUhSdklISmxibVJsY2lCaElHTnZiR3hsWTNScGIyNGdiMllnWTJocGJHUnlaVzRzSUhWelpTQmhiaUJoY25KaGVTQW5JQ3NnSjJsdWMzUmxZV1FnYjNJZ2QzSmhjQ0IwYUdVZ2IySnFaV04wSUhWemFXNW5JR055WldGMFpVWnlZV2R0Wlc1MEtHOWlhbVZqZENrZ1puSnZiU0IwYUdVZ0p5QXJJQ2RTWldGamRDQmhaR1F0YjI1ekxpYzdYRzRnSUNBZ0lDQWdJR2xtSUNoamFHbHNaSEpsYmk1ZmFYTlNaV0ZqZEVWc1pXMWxiblFwSUh0Y2JpQWdJQ0FnSUNBZ0lDQmhaR1JsYm1SMWJTQTlJRndpSUVsMElHeHZiMnR6SUd4cGEyVWdlVzkxSjNKbElIVnphVzVuSUdGdUlHVnNaVzFsYm5RZ1kzSmxZWFJsWkNCaWVTQmhJR1JwWm1abGNtVnVkQ0JjSWlBcklDZDJaWEp6YVc5dUlHOW1JRkpsWVdOMExpQk5ZV3RsSUhOMWNtVWdkRzhnZFhObElHOXViSGtnYjI1bElHTnZjSGtnYjJZZ1VtVmhZM1F1Snp0Y2JpQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ0lDQnBaaUFvVW1WaFkzUkRkWEp5Wlc1MFQzZHVaWEl1WTNWeWNtVnVkQ2tnZTF4dUlDQWdJQ0FnSUNBZ0lIWmhjaUJ1WVcxbElEMGdVbVZoWTNSRGRYSnlaVzUwVDNkdVpYSXVZM1Z5Y21WdWRDNW5aWFJPWVcxbEtDazdYRzRnSUNBZ0lDQWdJQ0FnYVdZZ0tHNWhiV1VwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJR0ZrWkdWdVpIVnRJQ3M5SUNjZ1EyaGxZMnNnZEdobElISmxibVJsY2lCdFpYUm9iMlFnYjJZZ1lDY2dLeUJ1WVcxbElDc2dKMkF1Snp0Y2JpQWdJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJSDFjYmlBZ0lDQWdJSFpoY2lCamFHbHNaSEpsYmxOMGNtbHVaeUE5SUZOMGNtbHVaeWhqYUdsc1pISmxiaWs3WEc0Z0lDQWdJQ0FoWm1Gc2MyVWdQeUJ3Y205alpYTnpMbVZ1ZGk1T1QwUkZYMFZPVmlBaFBUMGdKM0J5YjJSMVkzUnBiMjRuSUQ4Z2FXNTJZWEpwWVc1MEtHWmhiSE5sTENBblQySnFaV04wY3lCaGNtVWdibTkwSUhaaGJHbGtJR0Z6SUdFZ1VtVmhZM1FnWTJocGJHUWdLR1p2ZFc1a09pQWxjeWt1SlhNbkxDQmphR2xzWkhKbGJsTjBjbWx1WnlBOVBUMGdKMXR2WW1wbFkzUWdUMkpxWldOMFhTY2dQeUFuYjJKcVpXTjBJSGRwZEdnZ2EyVjVjeUI3SnlBcklFOWlhbVZqZEM1clpYbHpLR05vYVd4a2NtVnVLUzVxYjJsdUtDY3NJQ2NwSUNzZ0ozMG5JRG9nWTJocGJHUnlaVzVUZEhKcGJtY3NJR0ZrWkdWdVpIVnRLU0E2SUY5d2NtOWtTVzUyWVhKcFlXNTBLQ2N6TVNjc0lHTm9hV3hrY21WdVUzUnlhVzVuSUQwOVBTQW5XMjlpYW1WamRDQlBZbXBsWTNSZEp5QS9JQ2R2WW1wbFkzUWdkMmwwYUNCclpYbHpJSHNuSUNzZ1QySnFaV04wTG10bGVYTW9ZMmhwYkdSeVpXNHBMbXB2YVc0b0p5d2dKeWtnS3lBbmZTY2dPaUJqYUdsc1pISmxibE4wY21sdVp5d2dZV1JrWlc1a2RXMHBJRG9nZG05cFpDQXdPMXh1SUNBZ0lIMWNiaUFnZlZ4dVhHNGdJSEpsZEhWeWJpQnpkV0owY21WbFEyOTFiblE3WEc1OVhHNWNiaThxS2x4dUlDb2dWSEpoZG1WeWMyVnpJR05vYVd4a2NtVnVJSFJvWVhRZ1lYSmxJSFI1Y0dsallXeHNlU0J6Y0dWamFXWnBaV1FnWVhNZ1lIQnliM0J6TG1Ob2FXeGtjbVZ1WUN3Z1luVjBYRzRnS2lCdGFXZG9kQ0JoYkhOdklHSmxJSE53WldOcFptbGxaQ0IwYUhKdmRXZG9JR0YwZEhKcFluVjBaWE02WEc0Z0tseHVJQ29nTFNCZ2RISmhkbVZ5YzJWQmJHeERhR2xzWkhKbGJpaDBhR2x6TG5CeWIzQnpMbU5vYVd4a2NtVnVMQ0F1TGk0cFlGeHVJQ29nTFNCZ2RISmhkbVZ5YzJWQmJHeERhR2xzWkhKbGJpaDBhR2x6TG5CeWIzQnpMbXhsWm5SUVlXNWxiRU5vYVd4a2NtVnVMQ0F1TGk0cFlGeHVJQ3BjYmlBcUlGUm9aU0JnZEhKaGRtVnljMlZEYjI1MFpYaDBZQ0JwY3lCaGJpQnZjSFJwYjI1aGJDQmhjbWQxYldWdWRDQjBhR0YwSUdseklIQmhjM05sWkNCMGFISnZkV2RvSUhSb1pWeHVJQ29nWlc1MGFYSmxJSFJ5WVhabGNuTmhiQzRnU1hRZ1kyRnVJR0psSUhWelpXUWdkRzhnYzNSdmNtVWdZV05qZFcxMWJHRjBhVzl1Y3lCdmNpQmhibmwwYUdsdVp5QmxiSE5sSUhSb1lYUmNiaUFxSUhSb1pTQmpZV3hzWW1GamF5QnRhV2RvZENCbWFXNWtJSEpsYkdWMllXNTBMbHh1SUNwY2JpQXFJRUJ3WVhKaGJTQjdQeXA5SUdOb2FXeGtjbVZ1SUVOb2FXeGtjbVZ1SUhSeVpXVWdiMkpxWldOMExseHVJQ29nUUhCaGNtRnRJSHNoWm5WdVkzUnBiMjU5SUdOaGJHeGlZV05ySUZSdklHbHVkbTlyWlNCMWNHOXVJSFJ5WVhabGNuTnBibWNnWldGamFDQmphR2xzWkM1Y2JpQXFJRUJ3WVhKaGJTQjdQeXA5SUhSeVlYWmxjbk5sUTI5dWRHVjRkQ0JEYjI1MFpYaDBJR1p2Y2lCMGNtRjJaWEp6WVd3dVhHNGdLaUJBY21WMGRYSnVJSHNoYm5WdFltVnlmU0JVYUdVZ2JuVnRZbVZ5SUc5bUlHTm9hV3hrY21WdUlHbHVJSFJvYVhNZ2MzVmlkSEpsWlM1Y2JpQXFMMXh1Wm5WdVkzUnBiMjRnZEhKaGRtVnljMlZCYkd4RGFHbHNaSEpsYmloamFHbHNaSEpsYml3Z1kyRnNiR0poWTJzc0lIUnlZWFpsY25ObFEyOXVkR1Y0ZENrZ2UxeHVJQ0JwWmlBb1kyaHBiR1J5Wlc0Z1BUMGdiblZzYkNrZ2UxeHVJQ0FnSUhKbGRIVnliaUF3TzF4dUlDQjlYRzVjYmlBZ2NtVjBkWEp1SUhSeVlYWmxjbk5sUVd4c1EyaHBiR1J5Wlc1SmJYQnNLR05vYVd4a2NtVnVMQ0FuSnl3Z1kyRnNiR0poWTJzc0lIUnlZWFpsY25ObFEyOXVkR1Y0ZENrN1hHNTlYRzVjYm0xdlpIVnNaUzVsZUhCdmNuUnpJRDBnZEhKaGRtVnljMlZCYkd4RGFHbHNaSEpsYmpzaUxDSW5kWE5sSUhOMGNtbGpkQ2M3WEc1Y2JtMXZaSFZzWlM1bGVIQnZjblJ6SUQwZ2NtVnhkV2x5WlNnbkxpOXNhV0l2VW1WaFkzUW5LVHRjYmlJc0ltbHRjRzl5ZENCU1pXRmpkQ3dnZXlCRGIyMXdiMjVsYm5RZ2ZTQWdabkp2YlNBbmNtVmhZM1FuTzF4dVhHNGdZMnhoYzNNZ1JIbHVZVzFwWTFObFlYSmphQ0JsZUhSbGJtUnpJRU52YlhCdmJtVnVkQ0I3WEc1Y2JpQWdJQ0JqYjI1emRISjFZM1J2Y2lod2NtOXdjeWw3WEc0Z0lDQWdJQ0FnSUhOMWNHVnlLSEJ5YjNCektUdGNiaUFnSUNCOU8xeHVYRzRnSUNBZ1oyVjBTVzVwZEdsaGJGTjBZWFJsS0NsN1hHNGdJQ0FnSUNBZ0lISmxkSFZ5YmlCN0lITmxZWEpqYUZOMGNtbHVaem9nSnljZ2ZUdGNiaUFnSUNCOVhHNWNiaUFnSUNCb1lXNWtiR1ZEYUdGdVoyVW9LWHRjYmlBZ0lDQWdJQ0FnZEdocGN5NXpaWFJUZEdGMFpTaDdjMlZoY21Ob1UzUnlhVzVuT21WMlpXNTBMblJoY21kbGRDNTJZV3gxWlgwcE95QWdJQ0FnSUNBZ1hHNGdJQ0FnZlZ4dVhHNGdJQ0FnY21WdVpHVnlLQ2w3WEc0Z0lDQWdkbUZ5SUdOdmRXNTBjbWxsY3lBOUlIUm9hWE11Y0hKdmNITXVhWFJsYlhNN1hHNGdJQ0FnZG1GeUlITmxZWEpqYUZOMGNtbHVaeUE5SUhSb2FYTXVjM1JoZEdVdWMyVmhjbU5vVTNSeWFXNW5MblJ5YVcwb0tTNTBiMHh2ZDJWeVEyRnpaU2dwTzF4dUlDQWdJQzh2SUdacGJIUmxjaUJqYjNWdWRISnBaWE1nYkdsemRDQmllU0IyWVd4MVpTQm1jbTl0SUdsdWNIVjBJR0p2ZUZ4dUlDQWdJR2xtS0hObFlYSmphRk4wY21sdVp5NXNaVzVuZEdnZ1BpQXdLWHRjYmlBZ0lDQWdJQ0FnWTI5MWJuUnlhV1Z6SUQwZ1kyOTFiblJ5YVdWekxtWnBiSFJsY2lobWRXNWpkR2x2YmloamIzVnVkSEo1S1h0Y2JpQWdJQ0FnSUNBZ2NtVjBkWEp1SUdOdmRXNTBjbmt1Ym1GdFpTNTBiMHh2ZDJWeVEyRnpaU2dwTG0xaGRHTm9LQ0J6WldGeVkyaFRkSEpwYm1jZ0tUdGNiaUFnSUNBZ0lDQWdmU2s3WEc0Z0lDQWdmVnh1SUNBZ0lGeHVJQ0FnSUhKbGRIVnliaUFvWEc0Z0lDQWdJQ0FnSUR4a2FYWWdZMnhoYzNOT1lXMWxQVndpYzJWaGNtTm9MV052YlhCdmJtVnVkRndpUGx4dUlDQWdJQ0FnSUNBOGFXNXdkWFFnZEhsd1pUMWNJblJsZUhSY0lpQjJZV3gxWlQxN2RHaHBjeTV6ZEdGMFpTNXpaV0Z5WTJoVGRISnBibWQ5SUc5dVEyaGhibWRsUFh0MGFHbHpMbWhoYm1Sc1pVTm9ZVzVuWlgwZ2NHeGhZMlZvYjJ4a1pYSTlYQ0pUWldGeVkyZ2hYQ0lnTHo1Y2JpQWdJQ0FnSUNBZ1BIVnNQbHh1SUNBZ0lDQWdJQ0FnSUNBZ2V5QmpiM1Z1ZEhKcFpYTXViV0Z3S0daMWJtTjBhVzl1S0dOdmRXNTBjbmtwZXlCeVpYUjFjbTRnUEd4cFBudGpiM1Z1ZEhKNUxtNWhiV1Y5SUR3dmJHaytJSDBwSUgxY2JpQWdJQ0FnSUNBZ1BDOTFiRDVjYmlBZ0lDQWdJQ0FnUEM5a2FYWStYRzRnSUNBZ0tYMWNibHh1SUgwZ0lGeHVJRnh1SUdWNGNHOXlkQ0JrWldaaGRXeDBJRVI1Ym1GdGFXTlRaV0Z5WTJoY2JpQWlMQ0pwYlhCdmNuUWdVbVZoWTNRc0lIc2dRMjl0Y0c5dVpXNTBJSDBnSUdaeWIyMGdKM0psWVdOMEp6dGNibHh1WEc1amJHRnpjeUJPWVhZZ1pYaDBaVzVrY3lCRGIyMXdiMjVsYm5RZ2V5QWdYRzVjYmlBZ0lDQmpiMjV6ZEhKMVkzUnZjaWh3Y205d2N5bDdYRzRnSUNBZ2MzVndaWElvY0hKdmNITXBPMXh1SUNBZ0lDOHZJSFJvYVhNdWRHVnpkRWRsZENncE8xeHVJQ0FnSUgwN1hHNWNiaUFnSUNCeVpXNWtaWElvS1h0Y2JpQWdJQ0J5WlhSMWNtNGdLRnh1SUNBZ0lDQWdJQ0E4Ym1GMklHbGtQVndpYldGcGJrNWhkbHdpSUdOc1lYTnpUbUZ0WlQxY0ltNWhkbUpoY2lCdVlYWmlZWEl0WkdWbVlYVnNkQ0J1WVhaaVlYSXRabWw0WldRdGRHOXdJRzVoZG1KaGNpMWpkWE4wYjIxY0lqNWNiaUFnSUNBZ0lDQWdQR1JwZGlCamJHRnpjMDVoYldVOVhDSmpiMjUwWVdsdVpYSmNJajVjYmlBZ0lDQWdJQ0FnSUNBZ0lEeGthWFlnWTJ4aGMzTk9ZVzFsUFZ3aWJtRjJZbUZ5TFdobFlXUmxjaUJ3WVdkbExYTmpjbTlzYkZ3aVBseHVJQ0FnSUNBZ0lDQWdJQ0FnUEdKMWRIUnZiaUIwZVhCbFBWd2lZblYwZEc5dVhDSWdZMnhoYzNOT1lXMWxQVndpYm1GMlltRnlMWFJ2WjJkc1pWd2lJR1JoZEdFdGRHOW5aMnhsUFZ3aVkyOXNiR0Z3YzJWY0lpQmtZWFJoTFhSaGNtZGxkRDFjSWlOaWN5MWxlR0Z0Y0d4bExXNWhkbUpoY2kxamIyeHNZWEJ6WlMweFhDSStYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdQSE53WVc0Z1kyeGhjM05PWVcxbFBWd2ljM0l0YjI1c2VWd2lQbFJ2WjJkc1pTQnVZWFpwWjJGMGFXOXVQQzl6Y0dGdVBpQk5aVzUxSUR4cElHTnNZWE56VG1GdFpUMWNJbVpoSUdaaExXSmhjbk5jSWlBdlBseHVJQ0FnSUNBZ0lDQWdJQ0FnUEM5aWRYUjBiMjQrWEc0Z0lDQWdJQ0FnSUNBZ0lDQThZU0JqYkdGemMwNWhiV1U5WENKdVlYWmlZWEl0WW5KaGJtUmNJaUJvY21WbVBWd2lMMXdpUGtsdFozSmhZand2WVQ1Y2JpQWdJQ0FnSUNBZ0lDQWdJRHd2WkdsMlBseHVJQ0FnSUNBZ0lDQWdJQ0FnUEdScGRpQmpiR0Z6YzA1aGJXVTlYQ0pqYjJ4c1lYQnpaU0J1WVhaaVlYSXRZMjlzYkdGd2MyVmNJaUJwWkQxY0ltSnpMV1Y0WVcxd2JHVXRibUYyWW1GeUxXTnZiR3hoY0hObExURmNJajVjYmlBZ0lDQWdJQ0FnSUNBZ0lEeDFiQ0JqYkdGemMwNWhiV1U5WENKdVlYWWdibUYyWW1GeUxXNWhkaUJ1WVhaaVlYSXRjbWxuYUhSY0lqNWNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQThiR2tnWTJ4aGMzTk9ZVzFsUFZ3aWFHbGtaR1Z1WENJK1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1BHRWdhSEpsWmoxY0lpTndZV2RsTFhSdmNGd2lJQzgrWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnUEM5c2FUNWNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQThiR2tnWTJ4aGMzTk9ZVzFsUFZ3aWNHRm5aUzF6WTNKdmJHeGNJajVjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0E4WVNCb2NtVm1QVndpTDJsdFlXZGxjMXdpUGsxNUlFbHRZV2RsY3p3dllUNWNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQThMMnhwUGx4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUR4c2FTQmpiR0Z6YzA1aGJXVTlYQ0p3WVdkbExYTmpjbTlzYkZ3aVBseHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lEeGhJR2h5WldZOVhDSWpYQ0krU0dWc2NEd3ZZVDVjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0E4TDJ4cFBseHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lEeHNhU0JqYkdGemMwNWhiV1U5WENKd1lXZGxMWE5qY205c2JGd2lQbHh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJRHhoSUdoeVpXWTlYQ0lqWENJK1EyOXVkR0ZqZER3dllUNWNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQThMMnhwUGx4dUlDQWdJQ0FnSUNBZ0lDQWdQQzkxYkQ1Y2JpQWdJQ0FnSUNBZ0lDQWdJRHd2WkdsMlBseHVJQ0FnSUNBZ0lDQThMMlJwZGo1Y2JpQWdJQ0FnSUNBZ1BDOXVZWFkrWEc0Z0lDQWdLWDA3WEc1Y2JpQWdJQ0F2THlCMFpYTjBSMlYwS0NrZ2UxeHVJQ0FnSUM4dklHRjRhVzl6TG1kbGRDZ25hSFIwY0Rvdkx6RXlOeTR3TGpBdU1UbzFNREF3TDJGd2FTOXBiV0ZuWlhNbktWeHVJQ0FnSUM4dklDNTBhR1Z1S0daMWJtTjBhVzl1SUNoeVpYTndiMjV6WlNrZ2UxeHVJQ0FnSUM4dklDQWdJQ0JqYjI1emIyeGxMbXh2WnloeVpYTndiMjV6WlNrN1hHNGdJQ0FnTHk4Z2ZTbGNiaUFnSUNBdkx5QXVZMkYwWTJnb1puVnVZM1JwYjI0Z0tHVnljbTl5S1NCN1hHNGdJQ0FnTHk4Z0lDQWdJR052Ym5OdmJHVXViRzluS0dWeWNtOXlLVHRjYmlBZ0lDQXZMeUI5S1R0Y2JpQWdJQ0F2THlCOVhHNWNibjA3WEc1Y2JtVjRjRzl5ZENCa1pXWmhkV3gwSUU1aGRseHVJaXdpYVcxd2IzSjBJRkpsWVdOMExDQjdJRU52YlhCdmJtVnVkQ0I5SUNCbWNtOXRJQ2R5WldGamRDYzdYRzVjYm1Oc1lYTnpJRkJoWjJWRGIyNTBZV2x1WlhJZ1pYaDBaVzVrY3lCRGIyMXdiMjVsYm5RZ2UxeHVJQ0FnSUhKbGJtUmxjaWdwSUh0Y2JpQWdJQ0FnSUhKbGRIVnliaUFvWEc0Z0lDQWdJQ0FnSUR4a2FYWWdZMnhoYzNOT1lXMWxQVndpY0dGblpTMWpiMjUwWVdsdVpYSmNJajVjYmlBZ0lDQWdJQ0FnSUNCN2RHaHBjeTV3Y205d2N5NWphR2xzWkhKbGJuMWNiaUFnSUNBZ0lDQWdQQzlrYVhZK1hHNGdJQ0FnSUNBcE8xeHVJQ0FnSUgxY2JpQWdmVnh1WEc0Z0lHVjRjRzl5ZENCa1pXWmhkV3gwSUZCaFoyVkRiMjUwWVdsdVpYSmNiaUFnSWl3aWFXMXdiM0owSUdGNGFXOXpJR1p5YjIwZ0oyRjRhVzl6Snp0Y2JtbHRjRzl5ZENCU1pXRmpkQ3dnZXlCRGIyMXdiMjVsYm5RZ2ZTQWdabkp2YlNBbmNtVmhZM1FuTzF4dVhHNXBiWEJ2Y25RZ1RtRjJJR1p5YjIwZ0p5NHZZMjl0Y0c5dVpXNTBjeTl1WVhZbk8xeHVhVzF3YjNKMElFUjVibUZ0YVdOVFpXRnlZMmdnWm5KdmJTQW5MaTlqYjIxd2IyNWxiblJ6TDJSNWJtRnRhV05mYzJWaGNtTm9KenRjYm1sdGNHOXlkQ0JRWVdkbFEyOXVkR0ZwYm1WeUlHWnliMjBnSnk0dlkyOXRjRzl1Wlc1MGN5OXdZV2RsWDJOdmJuUmhhVzVsY2ljN1hHNWNibHh1ZG1GeUlHTnZkVzUwY21sbGN5QTlJRnRjYmlBZ2Uxd2libUZ0WlZ3aU9pQmNJbE4zWldSbGJsd2lmU3dnZTF3aWJtRnRaVndpT2lCY0lrTm9hVzVoWENKOUxDQjdYQ0p1WVcxbFhDSTZJRndpVUdWeWRWd2lmU3dnZTF3aWJtRnRaVndpT2lCY0lrTjZaV05vSUZKbGNIVmliR2xqWENKOUxGeHVJQ0I3WENKdVlXMWxYQ0k2SUZ3aVFtOXNhWFpwWVZ3aWZTd2dlMXdpYm1GdFpWd2lPaUJjSWt4aGRIWnBZVndpZlN3Z2Uxd2libUZ0WlZ3aU9pQmNJbE5oYlc5aFhDSjlMQ0I3WENKdVlXMWxYQ0k2SUZ3aVFYSnRaVzVwWVZ3aWZTeGNiaUFnZTF3aWJtRnRaVndpT2lCY0lrZHlaV1Z1YkdGdVpGd2lmU3dnZTF3aWJtRnRaVndpT2lCY0lrTjFZbUZjSW4wc0lIdGNJbTVoYldWY0lqb2dYQ0pYWlhOMFpYSnVJRk5oYUdGeVlWd2lmU3dnZTF3aWJtRnRaVndpT2lCY0lrVjBhR2x2Y0dsaFhDSjlMRnh1SUNCN1hDSnVZVzFsWENJNklGd2lUV0ZzWVhsemFXRmNJbjBzSUh0Y0ltNWhiV1ZjSWpvZ1hDSkJjbWRsYm5ScGJtRmNJbjBzSUh0Y0ltNWhiV1ZjSWpvZ1hDSlZaMkZ1WkdGY0luMHNJSHRjSW01aGJXVmNJam9nWENKRGFHbHNaVndpZlN4Y2JpQWdlMXdpYm1GdFpWd2lPaUJjSWtGeWRXSmhYQ0o5TENCN1hDSnVZVzFsWENJNklGd2lTbUZ3WVc1Y0luMHNJSHRjSW01aGJXVmNJam9nWENKVWNtbHVhV1JoWkNCaGJtUWdWRzlpWVdkdlhDSjlMQ0I3WENKdVlXMWxYQ0k2SUZ3aVNYUmhiSGxjSW4wc1hHNGdJSHRjSW01aGJXVmNJam9nWENKRFlXMWliMlJwWVZ3aWZTd2dlMXdpYm1GdFpWd2lPaUJjSWtsalpXeGhibVJjSW4wc0lIdGNJbTVoYldWY0lqb2dYQ0pFYjIxcGJtbGpZVzRnVW1Wd2RXSnNhV05jSW4wc0lIdGNJbTVoYldWY0lqb2dYQ0pVZFhKclpYbGNJbjBzWEc0Z0lIdGNJbTVoYldWY0lqb2dYQ0pUY0dGcGJsd2lmU3dnZTF3aWJtRnRaVndpT2lCY0lsQnZiR0Z1WkZ3aWZTd2dlMXdpYm1GdFpWd2lPaUJjSWtoaGFYUnBYQ0o5WEc1ZE8xeHVYRzRnSUZ4dWJHVjBJRTFoYVc1RGIyNTBaVzUwSUQwZ0tGeHVJQ0E4WkdsMlBseHVJQ0FnSUR4T1lYWWdMejVjYmlBZ0lDQThVR0ZuWlVOdmJuUmhhVzVsY2o1Y2JpQWdJQ0FnSUR4RWVXNWhiV2xqVTJWaGNtTm9JR2wwWlcxelBYc2dZMjkxYm5SeWFXVnpJSDBnTHo1Y2JpQWdJQ0E4TDFCaFoyVkRiMjUwWVdsdVpYSStYRzRnSUR3dlpHbDJQbHh1S1R0Y2JseHVVbVZoWTNSRVQwMHVjbVZ1WkdWeUtGeHVJQ0JOWVdsdVEyOXVkR1Z1ZENBc0lGeHVJQ0JrYjJOMWJXVnVkQzVuWlhSRmJHVnRaVzUwUW5sSlpDaGNJbUZ3Y0MxamIyNTBZV2x1WlhKY0lpbGNiaWs3WEc0aVhYMD0ifQ==
