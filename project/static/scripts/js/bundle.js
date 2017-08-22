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

},{"./helpers/bind":15,"is-buffer":31}],26:[function(require,module,exports){
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

},{"_process":33,"fbjs/lib/emptyObject":28,"fbjs/lib/invariant":29,"fbjs/lib/warning":30,"object-assign":32}],27:[function(require,module,exports){
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
},{}],28:[function(require,module,exports){
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

},{"_process":33}],29:[function(require,module,exports){
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

},{"_process":33}],30:[function(require,module,exports){
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

},{"./emptyFunction":27,"_process":33}],31:[function(require,module,exports){
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

},{}],32:[function(require,module,exports){
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

},{"./lib/ReactPropTypesSecret":37,"_process":33,"fbjs/lib/invariant":29,"fbjs/lib/warning":30}],35:[function(require,module,exports){
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

},{"./checkPropTypes":34,"./lib/ReactPropTypesSecret":37,"_process":33,"fbjs/lib/emptyFunction":27,"fbjs/lib/invariant":29,"fbjs/lib/warning":30}],37:[function(require,module,exports){
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

},{"./reactProdInvariant":60,"_process":33,"fbjs/lib/invariant":29}],40:[function(require,module,exports){
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

},{"./ReactBaseClasses":41,"./ReactChildren":42,"./ReactDOMFactories":45,"./ReactElement":46,"./ReactElementValidator":48,"./ReactPropTypes":51,"./ReactVersion":53,"./canDefineProperty":54,"./createClass":56,"./lowPriorityWarning":58,"./onlyChild":59,"_process":33,"object-assign":32}],41:[function(require,module,exports){
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

},{"./ReactNoopUpdateQueue":49,"./canDefineProperty":54,"./lowPriorityWarning":58,"./reactProdInvariant":60,"_process":33,"fbjs/lib/emptyObject":28,"fbjs/lib/invariant":29,"object-assign":32}],42:[function(require,module,exports){
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
},{"./PooledClass":39,"./ReactElement":46,"./traverseAllChildren":61,"fbjs/lib/emptyFunction":27}],43:[function(require,module,exports){
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

},{"./ReactCurrentOwner":44,"./reactProdInvariant":60,"_process":33,"fbjs/lib/invariant":29,"fbjs/lib/warning":30}],44:[function(require,module,exports){
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

},{"./ReactCurrentOwner":44,"./ReactElementSymbol":47,"./canDefineProperty":54,"_process":33,"fbjs/lib/warning":30,"object-assign":32}],47:[function(require,module,exports){
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

},{"./ReactComponentTreeHook":43,"./ReactCurrentOwner":44,"./ReactElement":46,"./canDefineProperty":54,"./checkReactTypeSpec":55,"./getIteratorFn":57,"./lowPriorityWarning":58,"_process":33,"fbjs/lib/warning":30}],49:[function(require,module,exports){
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

},{"_process":33,"fbjs/lib/warning":30}],50:[function(require,module,exports){
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

},{"./ReactComponentTreeHook":43,"./ReactPropTypeLocationNames":50,"./ReactPropTypesSecret":52,"./reactProdInvariant":60,"_process":33,"fbjs/lib/invariant":29,"fbjs/lib/warning":30}],56:[function(require,module,exports){
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

},{"./ReactElement":46,"./reactProdInvariant":60,"_process":33,"fbjs/lib/invariant":29}],60:[function(require,module,exports){
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

},{"./KeyEscapeUtils":38,"./ReactCurrentOwner":44,"./ReactElementSymbol":47,"./getIteratorFn":57,"./reactProdInvariant":60,"_process":33,"fbjs/lib/invariant":29,"fbjs/lib/warning":30}],62:[function(require,module,exports){
'use strict';

module.exports = require('./lib/React');

},{"./lib/React":40}],63:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var axios = require('axios');
var react = require('react');

var Nav = function (_react$Component) {
  _inherits(Nav, _react$Component);

  function Nav(props) {
    _classCallCheck(this, Nav);

    var _this = _possibleConstructorReturn(this, (Nav.__proto__ || Object.getPrototypeOf(Nav)).call(this, props));

    _this.testGet();
    return _this;
  }

  _createClass(Nav, [{
    key: 'render',
    value: function render() {
      return React.createElement(
        'nav',
        { id: 'mainNav', className: 'navbar navbar-default navbar-fixed-top navbar-custom' },
        React.createElement(
          'div',
          { className: 'container' },
          React.createElement(
            'div',
            { className: 'navbar-header page-scroll' },
            React.createElement(
              'button',
              { type: 'button', className: 'navbar-toggle', 'data-toggle': 'collapse', 'data-target': '#bs-example-navbar-collapse-1' },
              React.createElement(
                'span',
                { className: 'sr-only' },
                'Toggle navigation'
              ),
              ' Menu ',
              React.createElement('i', { className: 'fa fa-bars' })
            ),
            React.createElement(
              'a',
              { className: 'navbar-brand', href: '/' },
              'Imgrab'
            )
          ),
          React.createElement(
            'div',
            { className: 'collapse navbar-collapse', id: 'bs-example-navbar-collapse-1' },
            React.createElement(
              'ul',
              { className: 'nav navbar-nav navbar-right' },
              React.createElement(
                'li',
                { className: 'hidden' },
                React.createElement('a', { href: '#page-top' })
              ),
              React.createElement(
                'li',
                { className: 'page-scroll' },
                React.createElement(
                  'a',
                  { href: '/images' },
                  'My Images'
                )
              ),
              React.createElement(
                'li',
                { className: 'page-scroll' },
                React.createElement(
                  'a',
                  { href: '#' },
                  'Help'
                )
              ),
              React.createElement(
                'li',
                { className: 'page-scroll' },
                React.createElement(
                  'a',
                  { href: '#' },
                  'Contact'
                )
              )
            )
          )
        )
      );
    }
  }, {
    key: 'testGet',
    value: function testGet() {
      axios.get('http://127.0.0.1:5000/api/images').then(function (response) {
        console.log(response);
      }).catch(function (error) {
        console.log(error);
      });
    }
  }]);

  return Nav;
}(react.Component);

;

// class PageContainer extends Component {
//   render() {
//     return (
//       <div className="page-container">
//         {this.props.children}
//       </div>
//     );
//   }
// }


var PageContainer = React.createClass({
  displayName: 'PageContainer',
  render: function render() {
    return React.createElement(
      'div',
      { className: 'page-container' },
      this.props.children
    );
  }
});

var DynamicSearch = React.createClass({
  displayName: 'DynamicSearch',


  // sets initial state
  getInitialState: function getInitialState() {
    return { searchString: '' };
  },

  // sets state, triggers render method
  handleChange: function handleChange(event) {
    // grab value form input box
    this.setState({ searchString: event.target.value });
    console.log("scope updated!");
  },

  render: function render() {

    var countries = this.props.items;
    var searchString = this.state.searchString.trim().toLowerCase();

    // filter countries list by value from input box
    if (searchString.length > 0) {
      countries = countries.filter(function (country) {
        return country.name.toLowerCase().match(searchString);
      });
    }

    return React.createElement(
      'div',
      { className: 'search-component' },
      React.createElement('input', { type: 'text', value: this.state.searchString, onChange: this.handleChange, placeholder: 'Search!' }),
      React.createElement(
        'ul',
        null,
        countries.map(function (country) {
          return React.createElement(
            'li',
            null,
            country.name,
            ' '
          );
        })
      )
    );
  }

});

// list of countries, defined with JavaScript object literals
var countries = [{ "name": "Sweden" }, { "name": "China" }, { "name": "Peru" }, { "name": "Czech Republic" }, { "name": "Bolivia" }, { "name": "Latvia" }, { "name": "Samoa" }, { "name": "Armenia" }, { "name": "Greenland" }, { "name": "Cuba" }, { "name": "Western Sahara" }, { "name": "Ethiopia" }, { "name": "Malaysia" }, { "name": "Argentina" }, { "name": "Uganda" }, { "name": "Chile" }, { "name": "Aruba" }, { "name": "Japan" }, { "name": "Trinidad and Tobago" }, { "name": "Italy" }, { "name": "Cambodia" }, { "name": "Iceland" }, { "name": "Dominican Republic" }, { "name": "Turkey" }, { "name": "Spain" }, { "name": "Poland" }, { "name": "Haiti" }];

var ImageGrid = React.createClass({
  displayName: 'ImageGrid',

  render: function render() {
    return React.createElement('div', { className: 'row', id: 'image_container' });
  }
});

var MainContent = React.createElement(
  'div',
  null,
  React.createElement(Nav, null),
  React.createElement(
    PageContainer,
    null,
    React.createElement(DynamicSearch, { items: countries })
  )
);

ReactDOM.render(MainContent, document.getElementById("app-container"));

// var MainContent = React.createClass({
//     render: function(){
//         return (
//             <div className="main-content">
//               <Nav />
//               <PageContainer>
//                 <DynamicSearch items={ countries } />
//               </PageContainer>
//             </div>
//         )
//     }
// });


// ReactDOM.render(
//   <MainContent />, 
//   document.getElementById("app-container")
// );

},{"axios":1,"react":62}]},{},[63])

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvaW5kZXguanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2FkYXB0ZXJzL3hoci5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvYXhpb3MuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2NhbmNlbC9DYW5jZWwuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2NhbmNlbC9DYW5jZWxUb2tlbi5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvY2FuY2VsL2lzQ2FuY2VsLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9jb3JlL0F4aW9zLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9jb3JlL0ludGVyY2VwdG9yTWFuYWdlci5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvY29yZS9jcmVhdGVFcnJvci5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvY29yZS9kaXNwYXRjaFJlcXVlc3QuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2NvcmUvZW5oYW5jZUVycm9yLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9jb3JlL3NldHRsZS5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvY29yZS90cmFuc2Zvcm1EYXRhLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9kZWZhdWx0cy5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvaGVscGVycy9iaW5kLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9oZWxwZXJzL2J0b2EuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2hlbHBlcnMvYnVpbGRVUkwuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2hlbHBlcnMvY29tYmluZVVSTHMuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2hlbHBlcnMvY29va2llcy5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvaGVscGVycy9pc0Fic29sdXRlVVJMLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9oZWxwZXJzL2lzVVJMU2FtZU9yaWdpbi5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvaGVscGVycy9ub3JtYWxpemVIZWFkZXJOYW1lLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9oZWxwZXJzL3BhcnNlSGVhZGVycy5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvaGVscGVycy9zcHJlYWQuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL3V0aWxzLmpzIiwibm9kZV9tb2R1bGVzL2NyZWF0ZS1yZWFjdC1jbGFzcy9mYWN0b3J5LmpzIiwibm9kZV9tb2R1bGVzL2ZianMvbGliL2VtcHR5RnVuY3Rpb24uanMiLCJub2RlX21vZHVsZXMvZmJqcy9saWIvZW1wdHlPYmplY3QuanMiLCJub2RlX21vZHVsZXMvZmJqcy9saWIvaW52YXJpYW50LmpzIiwibm9kZV9tb2R1bGVzL2ZianMvbGliL3dhcm5pbmcuanMiLCJub2RlX21vZHVsZXMvaXMtYnVmZmVyL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL29iamVjdC1hc3NpZ24vaW5kZXguanMiLCJub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL3Byb3AtdHlwZXMvY2hlY2tQcm9wVHlwZXMuanMiLCJub2RlX21vZHVsZXMvcHJvcC10eXBlcy9mYWN0b3J5LmpzIiwibm9kZV9tb2R1bGVzL3Byb3AtdHlwZXMvZmFjdG9yeVdpdGhUeXBlQ2hlY2tlcnMuanMiLCJub2RlX21vZHVsZXMvcHJvcC10eXBlcy9saWIvUmVhY3RQcm9wVHlwZXNTZWNyZXQuanMiLCJub2RlX21vZHVsZXMvcmVhY3QvbGliL0tleUVzY2FwZVV0aWxzLmpzIiwibm9kZV9tb2R1bGVzL3JlYWN0L2xpYi9Qb29sZWRDbGFzcy5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9saWIvUmVhY3QuanMiLCJub2RlX21vZHVsZXMvcmVhY3QvbGliL1JlYWN0QmFzZUNsYXNzZXMuanMiLCJub2RlX21vZHVsZXMvcmVhY3QvbGliL1JlYWN0Q2hpbGRyZW4uanMiLCJub2RlX21vZHVsZXMvcmVhY3QvbGliL1JlYWN0Q29tcG9uZW50VHJlZUhvb2suanMiLCJub2RlX21vZHVsZXMvcmVhY3QvbGliL1JlYWN0Q3VycmVudE93bmVyLmpzIiwibm9kZV9tb2R1bGVzL3JlYWN0L2xpYi9SZWFjdERPTUZhY3Rvcmllcy5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9saWIvUmVhY3RFbGVtZW50LmpzIiwibm9kZV9tb2R1bGVzL3JlYWN0L2xpYi9SZWFjdEVsZW1lbnRTeW1ib2wuanMiLCJub2RlX21vZHVsZXMvcmVhY3QvbGliL1JlYWN0RWxlbWVudFZhbGlkYXRvci5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9saWIvUmVhY3ROb29wVXBkYXRlUXVldWUuanMiLCJub2RlX21vZHVsZXMvcmVhY3QvbGliL1JlYWN0UHJvcFR5cGVMb2NhdGlvbk5hbWVzLmpzIiwibm9kZV9tb2R1bGVzL3JlYWN0L2xpYi9SZWFjdFByb3BUeXBlcy5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9saWIvUmVhY3RQcm9wVHlwZXNTZWNyZXQuanMiLCJub2RlX21vZHVsZXMvcmVhY3QvbGliL1JlYWN0VmVyc2lvbi5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9saWIvY2FuRGVmaW5lUHJvcGVydHkuanMiLCJub2RlX21vZHVsZXMvcmVhY3QvbGliL2NoZWNrUmVhY3RUeXBlU3BlYy5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9saWIvY3JlYXRlQ2xhc3MuanMiLCJub2RlX21vZHVsZXMvcmVhY3QvbGliL2dldEl0ZXJhdG9yRm4uanMiLCJub2RlX21vZHVsZXMvcmVhY3QvbGliL2xvd1ByaW9yaXR5V2FybmluZy5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9saWIvb25seUNoaWxkLmpzIiwibm9kZV9tb2R1bGVzL3JlYWN0L2xpYi9yZWFjdFByb2RJbnZhcmlhbnQuanMiLCJub2RlX21vZHVsZXMvcmVhY3QvbGliL3RyYXZlcnNlQWxsQ2hpbGRyZW4uanMiLCJub2RlX21vZHVsZXMvcmVhY3QvcmVhY3QuanMiLCJwcm9qZWN0L3N0YXRpYy9zY3JpcHRzL2pzeC9tYWluLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7OztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDcExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDNUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQy9TQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUN4MkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDdERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDL0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDeExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM3REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNoZ0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDekRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUM5R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNsSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM3SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzdMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUN6WEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDdktBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDblZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUM3UEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDN0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3ZCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUN4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3JGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3ZDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUMvREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDOUtBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7Ozs7Ozs7QUNIQSxJQUFJLFFBQVEsUUFBUSxPQUFSLENBQVo7QUFDQSxJQUFJLFFBQVEsUUFBUSxPQUFSLENBQVo7O0lBR00sRzs7O0FBRUosZUFBWSxLQUFaLEVBQWtCO0FBQUE7O0FBQUEsMEdBQ1YsS0FEVTs7QUFFaEIsVUFBSyxPQUFMO0FBRmdCO0FBR2pCOzs7OzZCQUVPO0FBQ04sYUFDRTtBQUFBO0FBQUEsVUFBSyxJQUFHLFNBQVIsRUFBa0IsV0FBVSxzREFBNUI7QUFDRTtBQUFBO0FBQUEsWUFBSyxXQUFVLFdBQWY7QUFDRTtBQUFBO0FBQUEsY0FBSyxXQUFVLDJCQUFmO0FBQ0U7QUFBQTtBQUFBLGdCQUFRLE1BQUssUUFBYixFQUFzQixXQUFVLGVBQWhDLEVBQWdELGVBQVksVUFBNUQsRUFBdUUsZUFBWSwrQkFBbkY7QUFDRTtBQUFBO0FBQUEsa0JBQU0sV0FBVSxTQUFoQjtBQUFBO0FBQUEsZUFERjtBQUFBO0FBQzBELHlDQUFHLFdBQVUsWUFBYjtBQUQxRCxhQURGO0FBSUU7QUFBQTtBQUFBLGdCQUFHLFdBQVUsY0FBYixFQUE0QixNQUFLLEdBQWpDO0FBQUE7QUFBQTtBQUpGLFdBREY7QUFPRTtBQUFBO0FBQUEsY0FBSyxXQUFVLDBCQUFmLEVBQTBDLElBQUcsOEJBQTdDO0FBQ0U7QUFBQTtBQUFBLGdCQUFJLFdBQVUsNkJBQWQ7QUFDRTtBQUFBO0FBQUEsa0JBQUksV0FBVSxRQUFkO0FBQ0UsMkNBQUcsTUFBSyxXQUFSO0FBREYsZUFERjtBQUlFO0FBQUE7QUFBQSxrQkFBSSxXQUFVLGFBQWQ7QUFDRTtBQUFBO0FBQUEsb0JBQUcsTUFBSyxTQUFSO0FBQUE7QUFBQTtBQURGLGVBSkY7QUFPRTtBQUFBO0FBQUEsa0JBQUksV0FBVSxhQUFkO0FBQ0U7QUFBQTtBQUFBLG9CQUFHLE1BQUssR0FBUjtBQUFBO0FBQUE7QUFERixlQVBGO0FBVUU7QUFBQTtBQUFBLGtCQUFJLFdBQVUsYUFBZDtBQUNFO0FBQUE7QUFBQSxvQkFBRyxNQUFLLEdBQVI7QUFBQTtBQUFBO0FBREY7QUFWRjtBQURGO0FBUEY7QUFERixPQURGO0FBNEJEOzs7OEJBRVM7QUFDUixZQUFNLEdBQU4sQ0FBVSxrQ0FBVixFQUNDLElBREQsQ0FDTSxVQUFVLFFBQVYsRUFBb0I7QUFDeEIsZ0JBQVEsR0FBUixDQUFZLFFBQVo7QUFDRCxPQUhELEVBSUMsS0FKRCxDQUlPLFVBQVUsS0FBVixFQUFpQjtBQUN0QixnQkFBUSxHQUFSLENBQVksS0FBWjtBQUNELE9BTkQ7QUFPRDs7OztFQTlDZSxNQUFNLFM7O0FBZ0R2Qjs7QUFJRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQUlBLElBQUksZ0JBQWdCLE1BQU0sV0FBTixDQUFrQjtBQUFBO0FBQ3BDLFFBRG9DLG9CQUMzQjtBQUNQLFdBQ0U7QUFBQTtBQUFBLFFBQUssV0FBVSxnQkFBZjtBQUNHLFdBQUssS0FBTCxDQUFXO0FBRGQsS0FERjtBQUtEO0FBUG1DLENBQWxCLENBQXBCOztBQVVBLElBQUksZ0JBQWdCLE1BQU0sV0FBTixDQUFrQjtBQUFBOzs7QUFFcEM7QUFDQSxtQkFBaUIsMkJBQVU7QUFDekIsV0FBTyxFQUFFLGNBQWMsRUFBaEIsRUFBUDtBQUNELEdBTG1DOztBQU9wQztBQUNBLGdCQUFjLHNCQUFTLEtBQVQsRUFBZTtBQUMzQjtBQUNBLFNBQUssUUFBTCxDQUFjLEVBQUMsY0FBYSxNQUFNLE1BQU4sQ0FBYSxLQUEzQixFQUFkO0FBQ0EsWUFBUSxHQUFSLENBQVksZ0JBQVo7QUFDRCxHQVptQzs7QUFjcEMsVUFBUSxrQkFBVzs7QUFFakIsUUFBSSxZQUFZLEtBQUssS0FBTCxDQUFXLEtBQTNCO0FBQ0EsUUFBSSxlQUFlLEtBQUssS0FBTCxDQUFXLFlBQVgsQ0FBd0IsSUFBeEIsR0FBK0IsV0FBL0IsRUFBbkI7O0FBRUE7QUFDQSxRQUFHLGFBQWEsTUFBYixHQUFzQixDQUF6QixFQUEyQjtBQUN6QixrQkFBWSxVQUFVLE1BQVYsQ0FBaUIsVUFBUyxPQUFULEVBQWlCO0FBQzVDLGVBQU8sUUFBUSxJQUFSLENBQWEsV0FBYixHQUEyQixLQUEzQixDQUFrQyxZQUFsQyxDQUFQO0FBQ0QsT0FGVyxDQUFaO0FBR0Q7O0FBRUQsV0FDRTtBQUFBO0FBQUEsUUFBSyxXQUFVLGtCQUFmO0FBQ0UscUNBQU8sTUFBSyxNQUFaLEVBQW1CLE9BQU8sS0FBSyxLQUFMLENBQVcsWUFBckMsRUFBbUQsVUFBVSxLQUFLLFlBQWxFLEVBQWdGLGFBQVksU0FBNUYsR0FERjtBQUVFO0FBQUE7QUFBQTtBQUNJLGtCQUFVLEdBQVYsQ0FBYyxVQUFTLE9BQVQsRUFBaUI7QUFBRSxpQkFBTztBQUFBO0FBQUE7QUFBSyxvQkFBUSxJQUFiO0FBQUE7QUFBQSxXQUFQO0FBQWlDLFNBQWxFO0FBREo7QUFGRixLQURGO0FBUUQ7O0FBbENtQyxDQUFsQixDQUFwQjs7QUFzQ0E7QUFDQSxJQUFJLFlBQVksQ0FDZCxFQUFDLFFBQVEsUUFBVCxFQURjLEVBQ00sRUFBQyxRQUFRLE9BQVQsRUFETixFQUN5QixFQUFDLFFBQVEsTUFBVCxFQUR6QixFQUMyQyxFQUFDLFFBQVEsZ0JBQVQsRUFEM0MsRUFFZCxFQUFDLFFBQVEsU0FBVCxFQUZjLEVBRU8sRUFBQyxRQUFRLFFBQVQsRUFGUCxFQUUyQixFQUFDLFFBQVEsT0FBVCxFQUYzQixFQUU4QyxFQUFDLFFBQVEsU0FBVCxFQUY5QyxFQUdkLEVBQUMsUUFBUSxXQUFULEVBSGMsRUFHUyxFQUFDLFFBQVEsTUFBVCxFQUhULEVBRzJCLEVBQUMsUUFBUSxnQkFBVCxFQUgzQixFQUd1RCxFQUFDLFFBQVEsVUFBVCxFQUh2RCxFQUlkLEVBQUMsUUFBUSxVQUFULEVBSmMsRUFJUSxFQUFDLFFBQVEsV0FBVCxFQUpSLEVBSStCLEVBQUMsUUFBUSxRQUFULEVBSi9CLEVBSW1ELEVBQUMsUUFBUSxPQUFULEVBSm5ELEVBS2QsRUFBQyxRQUFRLE9BQVQsRUFMYyxFQUtLLEVBQUMsUUFBUSxPQUFULEVBTEwsRUFLd0IsRUFBQyxRQUFRLHFCQUFULEVBTHhCLEVBS3lELEVBQUMsUUFBUSxPQUFULEVBTHpELEVBTWQsRUFBQyxRQUFRLFVBQVQsRUFOYyxFQU1RLEVBQUMsUUFBUSxTQUFULEVBTlIsRUFNNkIsRUFBQyxRQUFRLG9CQUFULEVBTjdCLEVBTTZELEVBQUMsUUFBUSxRQUFULEVBTjdELEVBT2QsRUFBQyxRQUFRLE9BQVQsRUFQYyxFQU9LLEVBQUMsUUFBUSxRQUFULEVBUEwsRUFPeUIsRUFBQyxRQUFRLE9BQVQsRUFQekIsQ0FBaEI7O0FBWUEsSUFBSSxZQUFZLE1BQU0sV0FBTixDQUFrQjtBQUFBOztBQUNoQyxVQUFRLGtCQUFXO0FBQ2pCLFdBQ0ksNkJBQUssV0FBVSxLQUFmLEVBQXFCLElBQUcsaUJBQXhCLEdBREo7QUFJRDtBQU4rQixDQUFsQixDQUFoQjs7QUFXQSxJQUFJLGNBQ0Y7QUFBQTtBQUFBO0FBQ0Usc0JBQUMsR0FBRCxPQURGO0FBRUU7QUFBQyxpQkFBRDtBQUFBO0FBQ0Usd0JBQUMsYUFBRCxJQUFlLE9BQVEsU0FBdkI7QUFERjtBQUZGLENBREY7O0FBU0EsU0FBUyxNQUFULENBQ0UsV0FERixFQUVFLFNBQVMsY0FBVCxDQUF3QixlQUF4QixDQUZGOztBQUtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FBSUE7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vbGliL2F4aW9zJyk7IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLy4uL3V0aWxzJyk7XG52YXIgc2V0dGxlID0gcmVxdWlyZSgnLi8uLi9jb3JlL3NldHRsZScpO1xudmFyIGJ1aWxkVVJMID0gcmVxdWlyZSgnLi8uLi9oZWxwZXJzL2J1aWxkVVJMJyk7XG52YXIgcGFyc2VIZWFkZXJzID0gcmVxdWlyZSgnLi8uLi9oZWxwZXJzL3BhcnNlSGVhZGVycycpO1xudmFyIGlzVVJMU2FtZU9yaWdpbiA9IHJlcXVpcmUoJy4vLi4vaGVscGVycy9pc1VSTFNhbWVPcmlnaW4nKTtcbnZhciBjcmVhdGVFcnJvciA9IHJlcXVpcmUoJy4uL2NvcmUvY3JlYXRlRXJyb3InKTtcbnZhciBidG9hID0gKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHdpbmRvdy5idG9hICYmIHdpbmRvdy5idG9hLmJpbmQod2luZG93KSkgfHwgcmVxdWlyZSgnLi8uLi9oZWxwZXJzL2J0b2EnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiB4aHJBZGFwdGVyKGNvbmZpZykge1xuICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gZGlzcGF0Y2hYaHJSZXF1ZXN0KHJlc29sdmUsIHJlamVjdCkge1xuICAgIHZhciByZXF1ZXN0RGF0YSA9IGNvbmZpZy5kYXRhO1xuICAgIHZhciByZXF1ZXN0SGVhZGVycyA9IGNvbmZpZy5oZWFkZXJzO1xuXG4gICAgaWYgKHV0aWxzLmlzRm9ybURhdGEocmVxdWVzdERhdGEpKSB7XG4gICAgICBkZWxldGUgcmVxdWVzdEhlYWRlcnNbJ0NvbnRlbnQtVHlwZSddOyAvLyBMZXQgdGhlIGJyb3dzZXIgc2V0IGl0XG4gICAgfVxuXG4gICAgdmFyIHJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICB2YXIgbG9hZEV2ZW50ID0gJ29ucmVhZHlzdGF0ZWNoYW5nZSc7XG4gICAgdmFyIHhEb21haW4gPSBmYWxzZTtcblxuICAgIC8vIEZvciBJRSA4LzkgQ09SUyBzdXBwb3J0XG4gICAgLy8gT25seSBzdXBwb3J0cyBQT1NUIGFuZCBHRVQgY2FsbHMgYW5kIGRvZXNuJ3QgcmV0dXJucyB0aGUgcmVzcG9uc2UgaGVhZGVycy5cbiAgICAvLyBET04nVCBkbyB0aGlzIGZvciB0ZXN0aW5nIGIvYyBYTUxIdHRwUmVxdWVzdCBpcyBtb2NrZWQsIG5vdCBYRG9tYWluUmVxdWVzdC5cbiAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICd0ZXN0JyAmJlxuICAgICAgICB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJlxuICAgICAgICB3aW5kb3cuWERvbWFpblJlcXVlc3QgJiYgISgnd2l0aENyZWRlbnRpYWxzJyBpbiByZXF1ZXN0KSAmJlxuICAgICAgICAhaXNVUkxTYW1lT3JpZ2luKGNvbmZpZy51cmwpKSB7XG4gICAgICByZXF1ZXN0ID0gbmV3IHdpbmRvdy5YRG9tYWluUmVxdWVzdCgpO1xuICAgICAgbG9hZEV2ZW50ID0gJ29ubG9hZCc7XG4gICAgICB4RG9tYWluID0gdHJ1ZTtcbiAgICAgIHJlcXVlc3Qub25wcm9ncmVzcyA9IGZ1bmN0aW9uIGhhbmRsZVByb2dyZXNzKCkge307XG4gICAgICByZXF1ZXN0Lm9udGltZW91dCA9IGZ1bmN0aW9uIGhhbmRsZVRpbWVvdXQoKSB7fTtcbiAgICB9XG5cbiAgICAvLyBIVFRQIGJhc2ljIGF1dGhlbnRpY2F0aW9uXG4gICAgaWYgKGNvbmZpZy5hdXRoKSB7XG4gICAgICB2YXIgdXNlcm5hbWUgPSBjb25maWcuYXV0aC51c2VybmFtZSB8fCAnJztcbiAgICAgIHZhciBwYXNzd29yZCA9IGNvbmZpZy5hdXRoLnBhc3N3b3JkIHx8ICcnO1xuICAgICAgcmVxdWVzdEhlYWRlcnMuQXV0aG9yaXphdGlvbiA9ICdCYXNpYyAnICsgYnRvYSh1c2VybmFtZSArICc6JyArIHBhc3N3b3JkKTtcbiAgICB9XG5cbiAgICByZXF1ZXN0Lm9wZW4oY29uZmlnLm1ldGhvZC50b1VwcGVyQ2FzZSgpLCBidWlsZFVSTChjb25maWcudXJsLCBjb25maWcucGFyYW1zLCBjb25maWcucGFyYW1zU2VyaWFsaXplciksIHRydWUpO1xuXG4gICAgLy8gU2V0IHRoZSByZXF1ZXN0IHRpbWVvdXQgaW4gTVNcbiAgICByZXF1ZXN0LnRpbWVvdXQgPSBjb25maWcudGltZW91dDtcblxuICAgIC8vIExpc3RlbiBmb3IgcmVhZHkgc3RhdGVcbiAgICByZXF1ZXN0W2xvYWRFdmVudF0gPSBmdW5jdGlvbiBoYW5kbGVMb2FkKCkge1xuICAgICAgaWYgKCFyZXF1ZXN0IHx8IChyZXF1ZXN0LnJlYWR5U3RhdGUgIT09IDQgJiYgIXhEb21haW4pKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gVGhlIHJlcXVlc3QgZXJyb3JlZCBvdXQgYW5kIHdlIGRpZG4ndCBnZXQgYSByZXNwb25zZSwgdGhpcyB3aWxsIGJlXG4gICAgICAvLyBoYW5kbGVkIGJ5IG9uZXJyb3IgaW5zdGVhZFxuICAgICAgLy8gV2l0aCBvbmUgZXhjZXB0aW9uOiByZXF1ZXN0IHRoYXQgdXNpbmcgZmlsZTogcHJvdG9jb2wsIG1vc3QgYnJvd3NlcnNcbiAgICAgIC8vIHdpbGwgcmV0dXJuIHN0YXR1cyBhcyAwIGV2ZW4gdGhvdWdoIGl0J3MgYSBzdWNjZXNzZnVsIHJlcXVlc3RcbiAgICAgIGlmIChyZXF1ZXN0LnN0YXR1cyA9PT0gMCAmJiAhKHJlcXVlc3QucmVzcG9uc2VVUkwgJiYgcmVxdWVzdC5yZXNwb25zZVVSTC5pbmRleE9mKCdmaWxlOicpID09PSAwKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIFByZXBhcmUgdGhlIHJlc3BvbnNlXG4gICAgICB2YXIgcmVzcG9uc2VIZWFkZXJzID0gJ2dldEFsbFJlc3BvbnNlSGVhZGVycycgaW4gcmVxdWVzdCA/IHBhcnNlSGVhZGVycyhyZXF1ZXN0LmdldEFsbFJlc3BvbnNlSGVhZGVycygpKSA6IG51bGw7XG4gICAgICB2YXIgcmVzcG9uc2VEYXRhID0gIWNvbmZpZy5yZXNwb25zZVR5cGUgfHwgY29uZmlnLnJlc3BvbnNlVHlwZSA9PT0gJ3RleHQnID8gcmVxdWVzdC5yZXNwb25zZVRleHQgOiByZXF1ZXN0LnJlc3BvbnNlO1xuICAgICAgdmFyIHJlc3BvbnNlID0ge1xuICAgICAgICBkYXRhOiByZXNwb25zZURhdGEsXG4gICAgICAgIC8vIElFIHNlbmRzIDEyMjMgaW5zdGVhZCBvZiAyMDQgKGh0dHBzOi8vZ2l0aHViLmNvbS9temFicmlza2llL2F4aW9zL2lzc3Vlcy8yMDEpXG4gICAgICAgIHN0YXR1czogcmVxdWVzdC5zdGF0dXMgPT09IDEyMjMgPyAyMDQgOiByZXF1ZXN0LnN0YXR1cyxcbiAgICAgICAgc3RhdHVzVGV4dDogcmVxdWVzdC5zdGF0dXMgPT09IDEyMjMgPyAnTm8gQ29udGVudCcgOiByZXF1ZXN0LnN0YXR1c1RleHQsXG4gICAgICAgIGhlYWRlcnM6IHJlc3BvbnNlSGVhZGVycyxcbiAgICAgICAgY29uZmlnOiBjb25maWcsXG4gICAgICAgIHJlcXVlc3Q6IHJlcXVlc3RcbiAgICAgIH07XG5cbiAgICAgIHNldHRsZShyZXNvbHZlLCByZWplY3QsIHJlc3BvbnNlKTtcblxuICAgICAgLy8gQ2xlYW4gdXAgcmVxdWVzdFxuICAgICAgcmVxdWVzdCA9IG51bGw7XG4gICAgfTtcblxuICAgIC8vIEhhbmRsZSBsb3cgbGV2ZWwgbmV0d29yayBlcnJvcnNcbiAgICByZXF1ZXN0Lm9uZXJyb3IgPSBmdW5jdGlvbiBoYW5kbGVFcnJvcigpIHtcbiAgICAgIC8vIFJlYWwgZXJyb3JzIGFyZSBoaWRkZW4gZnJvbSB1cyBieSB0aGUgYnJvd3NlclxuICAgICAgLy8gb25lcnJvciBzaG91bGQgb25seSBmaXJlIGlmIGl0J3MgYSBuZXR3b3JrIGVycm9yXG4gICAgICByZWplY3QoY3JlYXRlRXJyb3IoJ05ldHdvcmsgRXJyb3InLCBjb25maWcsIG51bGwsIHJlcXVlc3QpKTtcblxuICAgICAgLy8gQ2xlYW4gdXAgcmVxdWVzdFxuICAgICAgcmVxdWVzdCA9IG51bGw7XG4gICAgfTtcblxuICAgIC8vIEhhbmRsZSB0aW1lb3V0XG4gICAgcmVxdWVzdC5vbnRpbWVvdXQgPSBmdW5jdGlvbiBoYW5kbGVUaW1lb3V0KCkge1xuICAgICAgcmVqZWN0KGNyZWF0ZUVycm9yKCd0aW1lb3V0IG9mICcgKyBjb25maWcudGltZW91dCArICdtcyBleGNlZWRlZCcsIGNvbmZpZywgJ0VDT05OQUJPUlRFRCcsXG4gICAgICAgIHJlcXVlc3QpKTtcblxuICAgICAgLy8gQ2xlYW4gdXAgcmVxdWVzdFxuICAgICAgcmVxdWVzdCA9IG51bGw7XG4gICAgfTtcblxuICAgIC8vIEFkZCB4c3JmIGhlYWRlclxuICAgIC8vIFRoaXMgaXMgb25seSBkb25lIGlmIHJ1bm5pbmcgaW4gYSBzdGFuZGFyZCBicm93c2VyIGVudmlyb25tZW50LlxuICAgIC8vIFNwZWNpZmljYWxseSBub3QgaWYgd2UncmUgaW4gYSB3ZWIgd29ya2VyLCBvciByZWFjdC1uYXRpdmUuXG4gICAgaWYgKHV0aWxzLmlzU3RhbmRhcmRCcm93c2VyRW52KCkpIHtcbiAgICAgIHZhciBjb29raWVzID0gcmVxdWlyZSgnLi8uLi9oZWxwZXJzL2Nvb2tpZXMnKTtcblxuICAgICAgLy8gQWRkIHhzcmYgaGVhZGVyXG4gICAgICB2YXIgeHNyZlZhbHVlID0gKGNvbmZpZy53aXRoQ3JlZGVudGlhbHMgfHwgaXNVUkxTYW1lT3JpZ2luKGNvbmZpZy51cmwpKSAmJiBjb25maWcueHNyZkNvb2tpZU5hbWUgP1xuICAgICAgICAgIGNvb2tpZXMucmVhZChjb25maWcueHNyZkNvb2tpZU5hbWUpIDpcbiAgICAgICAgICB1bmRlZmluZWQ7XG5cbiAgICAgIGlmICh4c3JmVmFsdWUpIHtcbiAgICAgICAgcmVxdWVzdEhlYWRlcnNbY29uZmlnLnhzcmZIZWFkZXJOYW1lXSA9IHhzcmZWYWx1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBBZGQgaGVhZGVycyB0byB0aGUgcmVxdWVzdFxuICAgIGlmICgnc2V0UmVxdWVzdEhlYWRlcicgaW4gcmVxdWVzdCkge1xuICAgICAgdXRpbHMuZm9yRWFjaChyZXF1ZXN0SGVhZGVycywgZnVuY3Rpb24gc2V0UmVxdWVzdEhlYWRlcih2YWwsIGtleSkge1xuICAgICAgICBpZiAodHlwZW9mIHJlcXVlc3REYXRhID09PSAndW5kZWZpbmVkJyAmJiBrZXkudG9Mb3dlckNhc2UoKSA9PT0gJ2NvbnRlbnQtdHlwZScpIHtcbiAgICAgICAgICAvLyBSZW1vdmUgQ29udGVudC1UeXBlIGlmIGRhdGEgaXMgdW5kZWZpbmVkXG4gICAgICAgICAgZGVsZXRlIHJlcXVlc3RIZWFkZXJzW2tleV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gT3RoZXJ3aXNlIGFkZCBoZWFkZXIgdG8gdGhlIHJlcXVlc3RcbiAgICAgICAgICByZXF1ZXN0LnNldFJlcXVlc3RIZWFkZXIoa2V5LCB2YWwpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBBZGQgd2l0aENyZWRlbnRpYWxzIHRvIHJlcXVlc3QgaWYgbmVlZGVkXG4gICAgaWYgKGNvbmZpZy53aXRoQ3JlZGVudGlhbHMpIHtcbiAgICAgIHJlcXVlc3Qud2l0aENyZWRlbnRpYWxzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBBZGQgcmVzcG9uc2VUeXBlIHRvIHJlcXVlc3QgaWYgbmVlZGVkXG4gICAgaWYgKGNvbmZpZy5yZXNwb25zZVR5cGUpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJlcXVlc3QucmVzcG9uc2VUeXBlID0gY29uZmlnLnJlc3BvbnNlVHlwZTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgLy8gRXhwZWN0ZWQgRE9NRXhjZXB0aW9uIHRocm93biBieSBicm93c2VycyBub3QgY29tcGF0aWJsZSBYTUxIdHRwUmVxdWVzdCBMZXZlbCAyLlxuICAgICAgICAvLyBCdXQsIHRoaXMgY2FuIGJlIHN1cHByZXNzZWQgZm9yICdqc29uJyB0eXBlIGFzIGl0IGNhbiBiZSBwYXJzZWQgYnkgZGVmYXVsdCAndHJhbnNmb3JtUmVzcG9uc2UnIGZ1bmN0aW9uLlxuICAgICAgICBpZiAoY29uZmlnLnJlc3BvbnNlVHlwZSAhPT0gJ2pzb24nKSB7XG4gICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEhhbmRsZSBwcm9ncmVzcyBpZiBuZWVkZWRcbiAgICBpZiAodHlwZW9mIGNvbmZpZy5vbkRvd25sb2FkUHJvZ3Jlc3MgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHJlcXVlc3QuYWRkRXZlbnRMaXN0ZW5lcigncHJvZ3Jlc3MnLCBjb25maWcub25Eb3dubG9hZFByb2dyZXNzKTtcbiAgICB9XG5cbiAgICAvLyBOb3QgYWxsIGJyb3dzZXJzIHN1cHBvcnQgdXBsb2FkIGV2ZW50c1xuICAgIGlmICh0eXBlb2YgY29uZmlnLm9uVXBsb2FkUHJvZ3Jlc3MgPT09ICdmdW5jdGlvbicgJiYgcmVxdWVzdC51cGxvYWQpIHtcbiAgICAgIHJlcXVlc3QudXBsb2FkLmFkZEV2ZW50TGlzdGVuZXIoJ3Byb2dyZXNzJywgY29uZmlnLm9uVXBsb2FkUHJvZ3Jlc3MpO1xuICAgIH1cblxuICAgIGlmIChjb25maWcuY2FuY2VsVG9rZW4pIHtcbiAgICAgIC8vIEhhbmRsZSBjYW5jZWxsYXRpb25cbiAgICAgIGNvbmZpZy5jYW5jZWxUb2tlbi5wcm9taXNlLnRoZW4oZnVuY3Rpb24gb25DYW5jZWxlZChjYW5jZWwpIHtcbiAgICAgICAgaWYgKCFyZXF1ZXN0KSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVxdWVzdC5hYm9ydCgpO1xuICAgICAgICByZWplY3QoY2FuY2VsKTtcbiAgICAgICAgLy8gQ2xlYW4gdXAgcmVxdWVzdFxuICAgICAgICByZXF1ZXN0ID0gbnVsbDtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmIChyZXF1ZXN0RGF0YSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXF1ZXN0RGF0YSA9IG51bGw7XG4gICAgfVxuXG4gICAgLy8gU2VuZCB0aGUgcmVxdWVzdFxuICAgIHJlcXVlc3Quc2VuZChyZXF1ZXN0RGF0YSk7XG4gIH0pO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xudmFyIGJpbmQgPSByZXF1aXJlKCcuL2hlbHBlcnMvYmluZCcpO1xudmFyIEF4aW9zID0gcmVxdWlyZSgnLi9jb3JlL0F4aW9zJyk7XG52YXIgZGVmYXVsdHMgPSByZXF1aXJlKCcuL2RlZmF1bHRzJyk7XG5cbi8qKlxuICogQ3JlYXRlIGFuIGluc3RhbmNlIG9mIEF4aW9zXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGRlZmF1bHRDb25maWcgVGhlIGRlZmF1bHQgY29uZmlnIGZvciB0aGUgaW5zdGFuY2VcbiAqIEByZXR1cm4ge0F4aW9zfSBBIG5ldyBpbnN0YW5jZSBvZiBBeGlvc1xuICovXG5mdW5jdGlvbiBjcmVhdGVJbnN0YW5jZShkZWZhdWx0Q29uZmlnKSB7XG4gIHZhciBjb250ZXh0ID0gbmV3IEF4aW9zKGRlZmF1bHRDb25maWcpO1xuICB2YXIgaW5zdGFuY2UgPSBiaW5kKEF4aW9zLnByb3RvdHlwZS5yZXF1ZXN0LCBjb250ZXh0KTtcblxuICAvLyBDb3B5IGF4aW9zLnByb3RvdHlwZSB0byBpbnN0YW5jZVxuICB1dGlscy5leHRlbmQoaW5zdGFuY2UsIEF4aW9zLnByb3RvdHlwZSwgY29udGV4dCk7XG5cbiAgLy8gQ29weSBjb250ZXh0IHRvIGluc3RhbmNlXG4gIHV0aWxzLmV4dGVuZChpbnN0YW5jZSwgY29udGV4dCk7XG5cbiAgcmV0dXJuIGluc3RhbmNlO1xufVxuXG4vLyBDcmVhdGUgdGhlIGRlZmF1bHQgaW5zdGFuY2UgdG8gYmUgZXhwb3J0ZWRcbnZhciBheGlvcyA9IGNyZWF0ZUluc3RhbmNlKGRlZmF1bHRzKTtcblxuLy8gRXhwb3NlIEF4aW9zIGNsYXNzIHRvIGFsbG93IGNsYXNzIGluaGVyaXRhbmNlXG5heGlvcy5BeGlvcyA9IEF4aW9zO1xuXG4vLyBGYWN0b3J5IGZvciBjcmVhdGluZyBuZXcgaW5zdGFuY2VzXG5heGlvcy5jcmVhdGUgPSBmdW5jdGlvbiBjcmVhdGUoaW5zdGFuY2VDb25maWcpIHtcbiAgcmV0dXJuIGNyZWF0ZUluc3RhbmNlKHV0aWxzLm1lcmdlKGRlZmF1bHRzLCBpbnN0YW5jZUNvbmZpZykpO1xufTtcblxuLy8gRXhwb3NlIENhbmNlbCAmIENhbmNlbFRva2VuXG5heGlvcy5DYW5jZWwgPSByZXF1aXJlKCcuL2NhbmNlbC9DYW5jZWwnKTtcbmF4aW9zLkNhbmNlbFRva2VuID0gcmVxdWlyZSgnLi9jYW5jZWwvQ2FuY2VsVG9rZW4nKTtcbmF4aW9zLmlzQ2FuY2VsID0gcmVxdWlyZSgnLi9jYW5jZWwvaXNDYW5jZWwnKTtcblxuLy8gRXhwb3NlIGFsbC9zcHJlYWRcbmF4aW9zLmFsbCA9IGZ1bmN0aW9uIGFsbChwcm9taXNlcykge1xuICByZXR1cm4gUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xufTtcbmF4aW9zLnNwcmVhZCA9IHJlcXVpcmUoJy4vaGVscGVycy9zcHJlYWQnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBheGlvcztcblxuLy8gQWxsb3cgdXNlIG9mIGRlZmF1bHQgaW1wb3J0IHN5bnRheCBpbiBUeXBlU2NyaXB0XG5tb2R1bGUuZXhwb3J0cy5kZWZhdWx0ID0gYXhpb3M7XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qKlxuICogQSBgQ2FuY2VsYCBpcyBhbiBvYmplY3QgdGhhdCBpcyB0aHJvd24gd2hlbiBhbiBvcGVyYXRpb24gaXMgY2FuY2VsZWQuXG4gKlxuICogQGNsYXNzXG4gKiBAcGFyYW0ge3N0cmluZz19IG1lc3NhZ2UgVGhlIG1lc3NhZ2UuXG4gKi9cbmZ1bmN0aW9uIENhbmNlbChtZXNzYWdlKSB7XG4gIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG59XG5cbkNhbmNlbC5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiB0b1N0cmluZygpIHtcbiAgcmV0dXJuICdDYW5jZWwnICsgKHRoaXMubWVzc2FnZSA/ICc6ICcgKyB0aGlzLm1lc3NhZ2UgOiAnJyk7XG59O1xuXG5DYW5jZWwucHJvdG90eXBlLl9fQ0FOQ0VMX18gPSB0cnVlO1xuXG5tb2R1bGUuZXhwb3J0cyA9IENhbmNlbDtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIENhbmNlbCA9IHJlcXVpcmUoJy4vQ2FuY2VsJyk7XG5cbi8qKlxuICogQSBgQ2FuY2VsVG9rZW5gIGlzIGFuIG9iamVjdCB0aGF0IGNhbiBiZSB1c2VkIHRvIHJlcXVlc3QgY2FuY2VsbGF0aW9uIG9mIGFuIG9wZXJhdGlvbi5cbiAqXG4gKiBAY2xhc3NcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGV4ZWN1dG9yIFRoZSBleGVjdXRvciBmdW5jdGlvbi5cbiAqL1xuZnVuY3Rpb24gQ2FuY2VsVG9rZW4oZXhlY3V0b3IpIHtcbiAgaWYgKHR5cGVvZiBleGVjdXRvciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2V4ZWN1dG9yIG11c3QgYmUgYSBmdW5jdGlvbi4nKTtcbiAgfVxuXG4gIHZhciByZXNvbHZlUHJvbWlzZTtcbiAgdGhpcy5wcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24gcHJvbWlzZUV4ZWN1dG9yKHJlc29sdmUpIHtcbiAgICByZXNvbHZlUHJvbWlzZSA9IHJlc29sdmU7XG4gIH0pO1xuXG4gIHZhciB0b2tlbiA9IHRoaXM7XG4gIGV4ZWN1dG9yKGZ1bmN0aW9uIGNhbmNlbChtZXNzYWdlKSB7XG4gICAgaWYgKHRva2VuLnJlYXNvbikge1xuICAgICAgLy8gQ2FuY2VsbGF0aW9uIGhhcyBhbHJlYWR5IGJlZW4gcmVxdWVzdGVkXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdG9rZW4ucmVhc29uID0gbmV3IENhbmNlbChtZXNzYWdlKTtcbiAgICByZXNvbHZlUHJvbWlzZSh0b2tlbi5yZWFzb24pO1xuICB9KTtcbn1cblxuLyoqXG4gKiBUaHJvd3MgYSBgQ2FuY2VsYCBpZiBjYW5jZWxsYXRpb24gaGFzIGJlZW4gcmVxdWVzdGVkLlxuICovXG5DYW5jZWxUb2tlbi5wcm90b3R5cGUudGhyb3dJZlJlcXVlc3RlZCA9IGZ1bmN0aW9uIHRocm93SWZSZXF1ZXN0ZWQoKSB7XG4gIGlmICh0aGlzLnJlYXNvbikge1xuICAgIHRocm93IHRoaXMucmVhc29uO1xuICB9XG59O1xuXG4vKipcbiAqIFJldHVybnMgYW4gb2JqZWN0IHRoYXQgY29udGFpbnMgYSBuZXcgYENhbmNlbFRva2VuYCBhbmQgYSBmdW5jdGlvbiB0aGF0LCB3aGVuIGNhbGxlZCxcbiAqIGNhbmNlbHMgdGhlIGBDYW5jZWxUb2tlbmAuXG4gKi9cbkNhbmNlbFRva2VuLnNvdXJjZSA9IGZ1bmN0aW9uIHNvdXJjZSgpIHtcbiAgdmFyIGNhbmNlbDtcbiAgdmFyIHRva2VuID0gbmV3IENhbmNlbFRva2VuKGZ1bmN0aW9uIGV4ZWN1dG9yKGMpIHtcbiAgICBjYW5jZWwgPSBjO1xuICB9KTtcbiAgcmV0dXJuIHtcbiAgICB0b2tlbjogdG9rZW4sXG4gICAgY2FuY2VsOiBjYW5jZWxcbiAgfTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ2FuY2VsVG9rZW47XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaXNDYW5jZWwodmFsdWUpIHtcbiAgcmV0dXJuICEhKHZhbHVlICYmIHZhbHVlLl9fQ0FOQ0VMX18pO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGRlZmF1bHRzID0gcmVxdWlyZSgnLi8uLi9kZWZhdWx0cycpO1xudmFyIHV0aWxzID0gcmVxdWlyZSgnLi8uLi91dGlscycpO1xudmFyIEludGVyY2VwdG9yTWFuYWdlciA9IHJlcXVpcmUoJy4vSW50ZXJjZXB0b3JNYW5hZ2VyJyk7XG52YXIgZGlzcGF0Y2hSZXF1ZXN0ID0gcmVxdWlyZSgnLi9kaXNwYXRjaFJlcXVlc3QnKTtcbnZhciBpc0Fic29sdXRlVVJMID0gcmVxdWlyZSgnLi8uLi9oZWxwZXJzL2lzQWJzb2x1dGVVUkwnKTtcbnZhciBjb21iaW5lVVJMcyA9IHJlcXVpcmUoJy4vLi4vaGVscGVycy9jb21iaW5lVVJMcycpO1xuXG4vKipcbiAqIENyZWF0ZSBhIG5ldyBpbnN0YW5jZSBvZiBBeGlvc1xuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBpbnN0YW5jZUNvbmZpZyBUaGUgZGVmYXVsdCBjb25maWcgZm9yIHRoZSBpbnN0YW5jZVxuICovXG5mdW5jdGlvbiBBeGlvcyhpbnN0YW5jZUNvbmZpZykge1xuICB0aGlzLmRlZmF1bHRzID0gaW5zdGFuY2VDb25maWc7XG4gIHRoaXMuaW50ZXJjZXB0b3JzID0ge1xuICAgIHJlcXVlc3Q6IG5ldyBJbnRlcmNlcHRvck1hbmFnZXIoKSxcbiAgICByZXNwb25zZTogbmV3IEludGVyY2VwdG9yTWFuYWdlcigpXG4gIH07XG59XG5cbi8qKlxuICogRGlzcGF0Y2ggYSByZXF1ZXN0XG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBUaGUgY29uZmlnIHNwZWNpZmljIGZvciB0aGlzIHJlcXVlc3QgKG1lcmdlZCB3aXRoIHRoaXMuZGVmYXVsdHMpXG4gKi9cbkF4aW9zLnByb3RvdHlwZS5yZXF1ZXN0ID0gZnVuY3Rpb24gcmVxdWVzdChjb25maWcpIHtcbiAgLyplc2xpbnQgbm8tcGFyYW0tcmVhc3NpZ246MCovXG4gIC8vIEFsbG93IGZvciBheGlvcygnZXhhbXBsZS91cmwnWywgY29uZmlnXSkgYSBsYSBmZXRjaCBBUElcbiAgaWYgKHR5cGVvZiBjb25maWcgPT09ICdzdHJpbmcnKSB7XG4gICAgY29uZmlnID0gdXRpbHMubWVyZ2Uoe1xuICAgICAgdXJsOiBhcmd1bWVudHNbMF1cbiAgICB9LCBhcmd1bWVudHNbMV0pO1xuICB9XG5cbiAgY29uZmlnID0gdXRpbHMubWVyZ2UoZGVmYXVsdHMsIHRoaXMuZGVmYXVsdHMsIHsgbWV0aG9kOiAnZ2V0JyB9LCBjb25maWcpO1xuICBjb25maWcubWV0aG9kID0gY29uZmlnLm1ldGhvZC50b0xvd2VyQ2FzZSgpO1xuXG4gIC8vIFN1cHBvcnQgYmFzZVVSTCBjb25maWdcbiAgaWYgKGNvbmZpZy5iYXNlVVJMICYmICFpc0Fic29sdXRlVVJMKGNvbmZpZy51cmwpKSB7XG4gICAgY29uZmlnLnVybCA9IGNvbWJpbmVVUkxzKGNvbmZpZy5iYXNlVVJMLCBjb25maWcudXJsKTtcbiAgfVxuXG4gIC8vIEhvb2sgdXAgaW50ZXJjZXB0b3JzIG1pZGRsZXdhcmVcbiAgdmFyIGNoYWluID0gW2Rpc3BhdGNoUmVxdWVzdCwgdW5kZWZpbmVkXTtcbiAgdmFyIHByb21pc2UgPSBQcm9taXNlLnJlc29sdmUoY29uZmlnKTtcblxuICB0aGlzLmludGVyY2VwdG9ycy5yZXF1ZXN0LmZvckVhY2goZnVuY3Rpb24gdW5zaGlmdFJlcXVlc3RJbnRlcmNlcHRvcnMoaW50ZXJjZXB0b3IpIHtcbiAgICBjaGFpbi51bnNoaWZ0KGludGVyY2VwdG9yLmZ1bGZpbGxlZCwgaW50ZXJjZXB0b3IucmVqZWN0ZWQpO1xuICB9KTtcblxuICB0aGlzLmludGVyY2VwdG9ycy5yZXNwb25zZS5mb3JFYWNoKGZ1bmN0aW9uIHB1c2hSZXNwb25zZUludGVyY2VwdG9ycyhpbnRlcmNlcHRvcikge1xuICAgIGNoYWluLnB1c2goaW50ZXJjZXB0b3IuZnVsZmlsbGVkLCBpbnRlcmNlcHRvci5yZWplY3RlZCk7XG4gIH0pO1xuXG4gIHdoaWxlIChjaGFpbi5sZW5ndGgpIHtcbiAgICBwcm9taXNlID0gcHJvbWlzZS50aGVuKGNoYWluLnNoaWZ0KCksIGNoYWluLnNoaWZ0KCkpO1xuICB9XG5cbiAgcmV0dXJuIHByb21pc2U7XG59O1xuXG4vLyBQcm92aWRlIGFsaWFzZXMgZm9yIHN1cHBvcnRlZCByZXF1ZXN0IG1ldGhvZHNcbnV0aWxzLmZvckVhY2goWydkZWxldGUnLCAnZ2V0JywgJ2hlYWQnLCAnb3B0aW9ucyddLCBmdW5jdGlvbiBmb3JFYWNoTWV0aG9kTm9EYXRhKG1ldGhvZCkge1xuICAvKmVzbGludCBmdW5jLW5hbWVzOjAqL1xuICBBeGlvcy5wcm90b3R5cGVbbWV0aG9kXSA9IGZ1bmN0aW9uKHVybCwgY29uZmlnKSB7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCh1dGlscy5tZXJnZShjb25maWcgfHwge30sIHtcbiAgICAgIG1ldGhvZDogbWV0aG9kLFxuICAgICAgdXJsOiB1cmxcbiAgICB9KSk7XG4gIH07XG59KTtcblxudXRpbHMuZm9yRWFjaChbJ3Bvc3QnLCAncHV0JywgJ3BhdGNoJ10sIGZ1bmN0aW9uIGZvckVhY2hNZXRob2RXaXRoRGF0YShtZXRob2QpIHtcbiAgLyplc2xpbnQgZnVuYy1uYW1lczowKi9cbiAgQXhpb3MucHJvdG90eXBlW21ldGhvZF0gPSBmdW5jdGlvbih1cmwsIGRhdGEsIGNvbmZpZykge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3QodXRpbHMubWVyZ2UoY29uZmlnIHx8IHt9LCB7XG4gICAgICBtZXRob2Q6IG1ldGhvZCxcbiAgICAgIHVybDogdXJsLFxuICAgICAgZGF0YTogZGF0YVxuICAgIH0pKTtcbiAgfTtcbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEF4aW9zO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLy4uL3V0aWxzJyk7XG5cbmZ1bmN0aW9uIEludGVyY2VwdG9yTWFuYWdlcigpIHtcbiAgdGhpcy5oYW5kbGVycyA9IFtdO1xufVxuXG4vKipcbiAqIEFkZCBhIG5ldyBpbnRlcmNlcHRvciB0byB0aGUgc3RhY2tcbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdWxmaWxsZWQgVGhlIGZ1bmN0aW9uIHRvIGhhbmRsZSBgdGhlbmAgZm9yIGEgYFByb21pc2VgXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSByZWplY3RlZCBUaGUgZnVuY3Rpb24gdG8gaGFuZGxlIGByZWplY3RgIGZvciBhIGBQcm9taXNlYFxuICpcbiAqIEByZXR1cm4ge051bWJlcn0gQW4gSUQgdXNlZCB0byByZW1vdmUgaW50ZXJjZXB0b3IgbGF0ZXJcbiAqL1xuSW50ZXJjZXB0b3JNYW5hZ2VyLnByb3RvdHlwZS51c2UgPSBmdW5jdGlvbiB1c2UoZnVsZmlsbGVkLCByZWplY3RlZCkge1xuICB0aGlzLmhhbmRsZXJzLnB1c2goe1xuICAgIGZ1bGZpbGxlZDogZnVsZmlsbGVkLFxuICAgIHJlamVjdGVkOiByZWplY3RlZFxuICB9KTtcbiAgcmV0dXJuIHRoaXMuaGFuZGxlcnMubGVuZ3RoIC0gMTtcbn07XG5cbi8qKlxuICogUmVtb3ZlIGFuIGludGVyY2VwdG9yIGZyb20gdGhlIHN0YWNrXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IGlkIFRoZSBJRCB0aGF0IHdhcyByZXR1cm5lZCBieSBgdXNlYFxuICovXG5JbnRlcmNlcHRvck1hbmFnZXIucHJvdG90eXBlLmVqZWN0ID0gZnVuY3Rpb24gZWplY3QoaWQpIHtcbiAgaWYgKHRoaXMuaGFuZGxlcnNbaWRdKSB7XG4gICAgdGhpcy5oYW5kbGVyc1tpZF0gPSBudWxsO1xuICB9XG59O1xuXG4vKipcbiAqIEl0ZXJhdGUgb3ZlciBhbGwgdGhlIHJlZ2lzdGVyZWQgaW50ZXJjZXB0b3JzXG4gKlxuICogVGhpcyBtZXRob2QgaXMgcGFydGljdWxhcmx5IHVzZWZ1bCBmb3Igc2tpcHBpbmcgb3ZlciBhbnlcbiAqIGludGVyY2VwdG9ycyB0aGF0IG1heSBoYXZlIGJlY29tZSBgbnVsbGAgY2FsbGluZyBgZWplY3RgLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuIFRoZSBmdW5jdGlvbiB0byBjYWxsIGZvciBlYWNoIGludGVyY2VwdG9yXG4gKi9cbkludGVyY2VwdG9yTWFuYWdlci5wcm90b3R5cGUuZm9yRWFjaCA9IGZ1bmN0aW9uIGZvckVhY2goZm4pIHtcbiAgdXRpbHMuZm9yRWFjaCh0aGlzLmhhbmRsZXJzLCBmdW5jdGlvbiBmb3JFYWNoSGFuZGxlcihoKSB7XG4gICAgaWYgKGggIT09IG51bGwpIHtcbiAgICAgIGZuKGgpO1xuICAgIH1cbiAgfSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEludGVyY2VwdG9yTWFuYWdlcjtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGVuaGFuY2VFcnJvciA9IHJlcXVpcmUoJy4vZW5oYW5jZUVycm9yJyk7XG5cbi8qKlxuICogQ3JlYXRlIGFuIEVycm9yIHdpdGggdGhlIHNwZWNpZmllZCBtZXNzYWdlLCBjb25maWcsIGVycm9yIGNvZGUsIHJlcXVlc3QgYW5kIHJlc3BvbnNlLlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlIFRoZSBlcnJvciBtZXNzYWdlLlxuICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBUaGUgY29uZmlnLlxuICogQHBhcmFtIHtzdHJpbmd9IFtjb2RlXSBUaGUgZXJyb3IgY29kZSAoZm9yIGV4YW1wbGUsICdFQ09OTkFCT1JURUQnKS5cbiAqIEBwYXJhbSB7T2JqZWN0fSBbcmVxdWVzdF0gVGhlIHJlcXVlc3QuXG4gKiBAcGFyYW0ge09iamVjdH0gW3Jlc3BvbnNlXSBUaGUgcmVzcG9uc2UuXG4gKiBAcmV0dXJucyB7RXJyb3J9IFRoZSBjcmVhdGVkIGVycm9yLlxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGNyZWF0ZUVycm9yKG1lc3NhZ2UsIGNvbmZpZywgY29kZSwgcmVxdWVzdCwgcmVzcG9uc2UpIHtcbiAgdmFyIGVycm9yID0gbmV3IEVycm9yKG1lc3NhZ2UpO1xuICByZXR1cm4gZW5oYW5jZUVycm9yKGVycm9yLCBjb25maWcsIGNvZGUsIHJlcXVlc3QsIHJlc3BvbnNlKTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vLi4vdXRpbHMnKTtcbnZhciB0cmFuc2Zvcm1EYXRhID0gcmVxdWlyZSgnLi90cmFuc2Zvcm1EYXRhJyk7XG52YXIgaXNDYW5jZWwgPSByZXF1aXJlKCcuLi9jYW5jZWwvaXNDYW5jZWwnKTtcbnZhciBkZWZhdWx0cyA9IHJlcXVpcmUoJy4uL2RlZmF1bHRzJyk7XG5cbi8qKlxuICogVGhyb3dzIGEgYENhbmNlbGAgaWYgY2FuY2VsbGF0aW9uIGhhcyBiZWVuIHJlcXVlc3RlZC5cbiAqL1xuZnVuY3Rpb24gdGhyb3dJZkNhbmNlbGxhdGlvblJlcXVlc3RlZChjb25maWcpIHtcbiAgaWYgKGNvbmZpZy5jYW5jZWxUb2tlbikge1xuICAgIGNvbmZpZy5jYW5jZWxUb2tlbi50aHJvd0lmUmVxdWVzdGVkKCk7XG4gIH1cbn1cblxuLyoqXG4gKiBEaXNwYXRjaCBhIHJlcXVlc3QgdG8gdGhlIHNlcnZlciB1c2luZyB0aGUgY29uZmlndXJlZCBhZGFwdGVyLlxuICpcbiAqIEBwYXJhbSB7b2JqZWN0fSBjb25maWcgVGhlIGNvbmZpZyB0aGF0IGlzIHRvIGJlIHVzZWQgZm9yIHRoZSByZXF1ZXN0XG4gKiBAcmV0dXJucyB7UHJvbWlzZX0gVGhlIFByb21pc2UgdG8gYmUgZnVsZmlsbGVkXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZGlzcGF0Y2hSZXF1ZXN0KGNvbmZpZykge1xuICB0aHJvd0lmQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKGNvbmZpZyk7XG5cbiAgLy8gRW5zdXJlIGhlYWRlcnMgZXhpc3RcbiAgY29uZmlnLmhlYWRlcnMgPSBjb25maWcuaGVhZGVycyB8fCB7fTtcblxuICAvLyBUcmFuc2Zvcm0gcmVxdWVzdCBkYXRhXG4gIGNvbmZpZy5kYXRhID0gdHJhbnNmb3JtRGF0YShcbiAgICBjb25maWcuZGF0YSxcbiAgICBjb25maWcuaGVhZGVycyxcbiAgICBjb25maWcudHJhbnNmb3JtUmVxdWVzdFxuICApO1xuXG4gIC8vIEZsYXR0ZW4gaGVhZGVyc1xuICBjb25maWcuaGVhZGVycyA9IHV0aWxzLm1lcmdlKFxuICAgIGNvbmZpZy5oZWFkZXJzLmNvbW1vbiB8fCB7fSxcbiAgICBjb25maWcuaGVhZGVyc1tjb25maWcubWV0aG9kXSB8fCB7fSxcbiAgICBjb25maWcuaGVhZGVycyB8fCB7fVxuICApO1xuXG4gIHV0aWxzLmZvckVhY2goXG4gICAgWydkZWxldGUnLCAnZ2V0JywgJ2hlYWQnLCAncG9zdCcsICdwdXQnLCAncGF0Y2gnLCAnY29tbW9uJ10sXG4gICAgZnVuY3Rpb24gY2xlYW5IZWFkZXJDb25maWcobWV0aG9kKSB7XG4gICAgICBkZWxldGUgY29uZmlnLmhlYWRlcnNbbWV0aG9kXTtcbiAgICB9XG4gICk7XG5cbiAgdmFyIGFkYXB0ZXIgPSBjb25maWcuYWRhcHRlciB8fCBkZWZhdWx0cy5hZGFwdGVyO1xuXG4gIHJldHVybiBhZGFwdGVyKGNvbmZpZykudGhlbihmdW5jdGlvbiBvbkFkYXB0ZXJSZXNvbHV0aW9uKHJlc3BvbnNlKSB7XG4gICAgdGhyb3dJZkNhbmNlbGxhdGlvblJlcXVlc3RlZChjb25maWcpO1xuXG4gICAgLy8gVHJhbnNmb3JtIHJlc3BvbnNlIGRhdGFcbiAgICByZXNwb25zZS5kYXRhID0gdHJhbnNmb3JtRGF0YShcbiAgICAgIHJlc3BvbnNlLmRhdGEsXG4gICAgICByZXNwb25zZS5oZWFkZXJzLFxuICAgICAgY29uZmlnLnRyYW5zZm9ybVJlc3BvbnNlXG4gICAgKTtcblxuICAgIHJldHVybiByZXNwb25zZTtcbiAgfSwgZnVuY3Rpb24gb25BZGFwdGVyUmVqZWN0aW9uKHJlYXNvbikge1xuICAgIGlmICghaXNDYW5jZWwocmVhc29uKSkge1xuICAgICAgdGhyb3dJZkNhbmNlbGxhdGlvblJlcXVlc3RlZChjb25maWcpO1xuXG4gICAgICAvLyBUcmFuc2Zvcm0gcmVzcG9uc2UgZGF0YVxuICAgICAgaWYgKHJlYXNvbiAmJiByZWFzb24ucmVzcG9uc2UpIHtcbiAgICAgICAgcmVhc29uLnJlc3BvbnNlLmRhdGEgPSB0cmFuc2Zvcm1EYXRhKFxuICAgICAgICAgIHJlYXNvbi5yZXNwb25zZS5kYXRhLFxuICAgICAgICAgIHJlYXNvbi5yZXNwb25zZS5oZWFkZXJzLFxuICAgICAgICAgIGNvbmZpZy50cmFuc2Zvcm1SZXNwb25zZVxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBQcm9taXNlLnJlamVjdChyZWFzb24pO1xuICB9KTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qKlxuICogVXBkYXRlIGFuIEVycm9yIHdpdGggdGhlIHNwZWNpZmllZCBjb25maWcsIGVycm9yIGNvZGUsIGFuZCByZXNwb25zZS5cbiAqXG4gKiBAcGFyYW0ge0Vycm9yfSBlcnJvciBUaGUgZXJyb3IgdG8gdXBkYXRlLlxuICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBUaGUgY29uZmlnLlxuICogQHBhcmFtIHtzdHJpbmd9IFtjb2RlXSBUaGUgZXJyb3IgY29kZSAoZm9yIGV4YW1wbGUsICdFQ09OTkFCT1JURUQnKS5cbiAqIEBwYXJhbSB7T2JqZWN0fSBbcmVxdWVzdF0gVGhlIHJlcXVlc3QuXG4gKiBAcGFyYW0ge09iamVjdH0gW3Jlc3BvbnNlXSBUaGUgcmVzcG9uc2UuXG4gKiBAcmV0dXJucyB7RXJyb3J9IFRoZSBlcnJvci5cbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBlbmhhbmNlRXJyb3IoZXJyb3IsIGNvbmZpZywgY29kZSwgcmVxdWVzdCwgcmVzcG9uc2UpIHtcbiAgZXJyb3IuY29uZmlnID0gY29uZmlnO1xuICBpZiAoY29kZSkge1xuICAgIGVycm9yLmNvZGUgPSBjb2RlO1xuICB9XG4gIGVycm9yLnJlcXVlc3QgPSByZXF1ZXN0O1xuICBlcnJvci5yZXNwb25zZSA9IHJlc3BvbnNlO1xuICByZXR1cm4gZXJyb3I7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgY3JlYXRlRXJyb3IgPSByZXF1aXJlKCcuL2NyZWF0ZUVycm9yJyk7XG5cbi8qKlxuICogUmVzb2x2ZSBvciByZWplY3QgYSBQcm9taXNlIGJhc2VkIG9uIHJlc3BvbnNlIHN0YXR1cy5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSByZXNvbHZlIEEgZnVuY3Rpb24gdGhhdCByZXNvbHZlcyB0aGUgcHJvbWlzZS5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IHJlamVjdCBBIGZ1bmN0aW9uIHRoYXQgcmVqZWN0cyB0aGUgcHJvbWlzZS5cbiAqIEBwYXJhbSB7b2JqZWN0fSByZXNwb25zZSBUaGUgcmVzcG9uc2UuXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gc2V0dGxlKHJlc29sdmUsIHJlamVjdCwgcmVzcG9uc2UpIHtcbiAgdmFyIHZhbGlkYXRlU3RhdHVzID0gcmVzcG9uc2UuY29uZmlnLnZhbGlkYXRlU3RhdHVzO1xuICAvLyBOb3RlOiBzdGF0dXMgaXMgbm90IGV4cG9zZWQgYnkgWERvbWFpblJlcXVlc3RcbiAgaWYgKCFyZXNwb25zZS5zdGF0dXMgfHwgIXZhbGlkYXRlU3RhdHVzIHx8IHZhbGlkYXRlU3RhdHVzKHJlc3BvbnNlLnN0YXR1cykpIHtcbiAgICByZXNvbHZlKHJlc3BvbnNlKTtcbiAgfSBlbHNlIHtcbiAgICByZWplY3QoY3JlYXRlRXJyb3IoXG4gICAgICAnUmVxdWVzdCBmYWlsZWQgd2l0aCBzdGF0dXMgY29kZSAnICsgcmVzcG9uc2Uuc3RhdHVzLFxuICAgICAgcmVzcG9uc2UuY29uZmlnLFxuICAgICAgbnVsbCxcbiAgICAgIHJlc3BvbnNlLnJlcXVlc3QsXG4gICAgICByZXNwb25zZVxuICAgICkpO1xuICB9XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLy4uL3V0aWxzJyk7XG5cbi8qKlxuICogVHJhbnNmb3JtIHRoZSBkYXRhIGZvciBhIHJlcXVlc3Qgb3IgYSByZXNwb25zZVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fFN0cmluZ30gZGF0YSBUaGUgZGF0YSB0byBiZSB0cmFuc2Zvcm1lZFxuICogQHBhcmFtIHtBcnJheX0gaGVhZGVycyBUaGUgaGVhZGVycyBmb3IgdGhlIHJlcXVlc3Qgb3IgcmVzcG9uc2VcbiAqIEBwYXJhbSB7QXJyYXl8RnVuY3Rpb259IGZucyBBIHNpbmdsZSBmdW5jdGlvbiBvciBBcnJheSBvZiBmdW5jdGlvbnNcbiAqIEByZXR1cm5zIHsqfSBUaGUgcmVzdWx0aW5nIHRyYW5zZm9ybWVkIGRhdGFcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiB0cmFuc2Zvcm1EYXRhKGRhdGEsIGhlYWRlcnMsIGZucykge1xuICAvKmVzbGludCBuby1wYXJhbS1yZWFzc2lnbjowKi9cbiAgdXRpbHMuZm9yRWFjaChmbnMsIGZ1bmN0aW9uIHRyYW5zZm9ybShmbikge1xuICAgIGRhdGEgPSBmbihkYXRhLCBoZWFkZXJzKTtcbiAgfSk7XG5cbiAgcmV0dXJuIGRhdGE7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG52YXIgbm9ybWFsaXplSGVhZGVyTmFtZSA9IHJlcXVpcmUoJy4vaGVscGVycy9ub3JtYWxpemVIZWFkZXJOYW1lJyk7XG5cbnZhciBERUZBVUxUX0NPTlRFTlRfVFlQRSA9IHtcbiAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQnXG59O1xuXG5mdW5jdGlvbiBzZXRDb250ZW50VHlwZUlmVW5zZXQoaGVhZGVycywgdmFsdWUpIHtcbiAgaWYgKCF1dGlscy5pc1VuZGVmaW5lZChoZWFkZXJzKSAmJiB1dGlscy5pc1VuZGVmaW5lZChoZWFkZXJzWydDb250ZW50LVR5cGUnXSkpIHtcbiAgICBoZWFkZXJzWydDb250ZW50LVR5cGUnXSA9IHZhbHVlO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldERlZmF1bHRBZGFwdGVyKCkge1xuICB2YXIgYWRhcHRlcjtcbiAgaWYgKHR5cGVvZiBYTUxIdHRwUmVxdWVzdCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAvLyBGb3IgYnJvd3NlcnMgdXNlIFhIUiBhZGFwdGVyXG4gICAgYWRhcHRlciA9IHJlcXVpcmUoJy4vYWRhcHRlcnMveGhyJyk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIHByb2Nlc3MgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgLy8gRm9yIG5vZGUgdXNlIEhUVFAgYWRhcHRlclxuICAgIGFkYXB0ZXIgPSByZXF1aXJlKCcuL2FkYXB0ZXJzL2h0dHAnKTtcbiAgfVxuICByZXR1cm4gYWRhcHRlcjtcbn1cblxudmFyIGRlZmF1bHRzID0ge1xuICBhZGFwdGVyOiBnZXREZWZhdWx0QWRhcHRlcigpLFxuXG4gIHRyYW5zZm9ybVJlcXVlc3Q6IFtmdW5jdGlvbiB0cmFuc2Zvcm1SZXF1ZXN0KGRhdGEsIGhlYWRlcnMpIHtcbiAgICBub3JtYWxpemVIZWFkZXJOYW1lKGhlYWRlcnMsICdDb250ZW50LVR5cGUnKTtcbiAgICBpZiAodXRpbHMuaXNGb3JtRGF0YShkYXRhKSB8fFxuICAgICAgdXRpbHMuaXNBcnJheUJ1ZmZlcihkYXRhKSB8fFxuICAgICAgdXRpbHMuaXNCdWZmZXIoZGF0YSkgfHxcbiAgICAgIHV0aWxzLmlzU3RyZWFtKGRhdGEpIHx8XG4gICAgICB1dGlscy5pc0ZpbGUoZGF0YSkgfHxcbiAgICAgIHV0aWxzLmlzQmxvYihkYXRhKVxuICAgICkge1xuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfVxuICAgIGlmICh1dGlscy5pc0FycmF5QnVmZmVyVmlldyhkYXRhKSkge1xuICAgICAgcmV0dXJuIGRhdGEuYnVmZmVyO1xuICAgIH1cbiAgICBpZiAodXRpbHMuaXNVUkxTZWFyY2hQYXJhbXMoZGF0YSkpIHtcbiAgICAgIHNldENvbnRlbnRUeXBlSWZVbnNldChoZWFkZXJzLCAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkO2NoYXJzZXQ9dXRmLTgnKTtcbiAgICAgIHJldHVybiBkYXRhLnRvU3RyaW5nKCk7XG4gICAgfVxuICAgIGlmICh1dGlscy5pc09iamVjdChkYXRhKSkge1xuICAgICAgc2V0Q29udGVudFR5cGVJZlVuc2V0KGhlYWRlcnMsICdhcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ9dXRmLTgnKTtcbiAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShkYXRhKTtcbiAgICB9XG4gICAgcmV0dXJuIGRhdGE7XG4gIH1dLFxuXG4gIHRyYW5zZm9ybVJlc3BvbnNlOiBbZnVuY3Rpb24gdHJhbnNmb3JtUmVzcG9uc2UoZGF0YSkge1xuICAgIC8qZXNsaW50IG5vLXBhcmFtLXJlYXNzaWduOjAqL1xuICAgIGlmICh0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGRhdGEgPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgfSBjYXRjaCAoZSkgeyAvKiBJZ25vcmUgKi8gfVxuICAgIH1cbiAgICByZXR1cm4gZGF0YTtcbiAgfV0sXG5cbiAgdGltZW91dDogMCxcblxuICB4c3JmQ29va2llTmFtZTogJ1hTUkYtVE9LRU4nLFxuICB4c3JmSGVhZGVyTmFtZTogJ1gtWFNSRi1UT0tFTicsXG5cbiAgbWF4Q29udGVudExlbmd0aDogLTEsXG5cbiAgdmFsaWRhdGVTdGF0dXM6IGZ1bmN0aW9uIHZhbGlkYXRlU3RhdHVzKHN0YXR1cykge1xuICAgIHJldHVybiBzdGF0dXMgPj0gMjAwICYmIHN0YXR1cyA8IDMwMDtcbiAgfVxufTtcblxuZGVmYXVsdHMuaGVhZGVycyA9IHtcbiAgY29tbW9uOiB7XG4gICAgJ0FjY2VwdCc6ICdhcHBsaWNhdGlvbi9qc29uLCB0ZXh0L3BsYWluLCAqLyonXG4gIH1cbn07XG5cbnV0aWxzLmZvckVhY2goWydkZWxldGUnLCAnZ2V0JywgJ2hlYWQnXSwgZnVuY3Rpb24gZm9yRWFjaE1ldGhvZE5vRGF0YShtZXRob2QpIHtcbiAgZGVmYXVsdHMuaGVhZGVyc1ttZXRob2RdID0ge307XG59KTtcblxudXRpbHMuZm9yRWFjaChbJ3Bvc3QnLCAncHV0JywgJ3BhdGNoJ10sIGZ1bmN0aW9uIGZvckVhY2hNZXRob2RXaXRoRGF0YShtZXRob2QpIHtcbiAgZGVmYXVsdHMuaGVhZGVyc1ttZXRob2RdID0gdXRpbHMubWVyZ2UoREVGQVVMVF9DT05URU5UX1RZUEUpO1xufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gZGVmYXVsdHM7XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gYmluZChmbiwgdGhpc0FyZykge1xuICByZXR1cm4gZnVuY3Rpb24gd3JhcCgpIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIGFyZ3NbaV0gPSBhcmd1bWVudHNbaV07XG4gICAgfVxuICAgIHJldHVybiBmbi5hcHBseSh0aGlzQXJnLCBhcmdzKTtcbiAgfTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbi8vIGJ0b2EgcG9seWZpbGwgZm9yIElFPDEwIGNvdXJ0ZXN5IGh0dHBzOi8vZ2l0aHViLmNvbS9kYXZpZGNoYW1iZXJzL0Jhc2U2NC5qc1xuXG52YXIgY2hhcnMgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLz0nO1xuXG5mdW5jdGlvbiBFKCkge1xuICB0aGlzLm1lc3NhZ2UgPSAnU3RyaW5nIGNvbnRhaW5zIGFuIGludmFsaWQgY2hhcmFjdGVyJztcbn1cbkUucHJvdG90eXBlID0gbmV3IEVycm9yO1xuRS5wcm90b3R5cGUuY29kZSA9IDU7XG5FLnByb3RvdHlwZS5uYW1lID0gJ0ludmFsaWRDaGFyYWN0ZXJFcnJvcic7XG5cbmZ1bmN0aW9uIGJ0b2EoaW5wdXQpIHtcbiAgdmFyIHN0ciA9IFN0cmluZyhpbnB1dCk7XG4gIHZhciBvdXRwdXQgPSAnJztcbiAgZm9yIChcbiAgICAvLyBpbml0aWFsaXplIHJlc3VsdCBhbmQgY291bnRlclxuICAgIHZhciBibG9jaywgY2hhckNvZGUsIGlkeCA9IDAsIG1hcCA9IGNoYXJzO1xuICAgIC8vIGlmIHRoZSBuZXh0IHN0ciBpbmRleCBkb2VzIG5vdCBleGlzdDpcbiAgICAvLyAgIGNoYW5nZSB0aGUgbWFwcGluZyB0YWJsZSB0byBcIj1cIlxuICAgIC8vICAgY2hlY2sgaWYgZCBoYXMgbm8gZnJhY3Rpb25hbCBkaWdpdHNcbiAgICBzdHIuY2hhckF0KGlkeCB8IDApIHx8IChtYXAgPSAnPScsIGlkeCAlIDEpO1xuICAgIC8vIFwiOCAtIGlkeCAlIDEgKiA4XCIgZ2VuZXJhdGVzIHRoZSBzZXF1ZW5jZSAyLCA0LCA2LCA4XG4gICAgb3V0cHV0ICs9IG1hcC5jaGFyQXQoNjMgJiBibG9jayA+PiA4IC0gaWR4ICUgMSAqIDgpXG4gICkge1xuICAgIGNoYXJDb2RlID0gc3RyLmNoYXJDb2RlQXQoaWR4ICs9IDMgLyA0KTtcbiAgICBpZiAoY2hhckNvZGUgPiAweEZGKSB7XG4gICAgICB0aHJvdyBuZXcgRSgpO1xuICAgIH1cbiAgICBibG9jayA9IGJsb2NrIDw8IDggfCBjaGFyQ29kZTtcbiAgfVxuICByZXR1cm4gb3V0cHV0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJ0b2E7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vLi4vdXRpbHMnKTtcblxuZnVuY3Rpb24gZW5jb2RlKHZhbCkge1xuICByZXR1cm4gZW5jb2RlVVJJQ29tcG9uZW50KHZhbCkuXG4gICAgcmVwbGFjZSgvJTQwL2dpLCAnQCcpLlxuICAgIHJlcGxhY2UoLyUzQS9naSwgJzonKS5cbiAgICByZXBsYWNlKC8lMjQvZywgJyQnKS5cbiAgICByZXBsYWNlKC8lMkMvZ2ksICcsJykuXG4gICAgcmVwbGFjZSgvJTIwL2csICcrJykuXG4gICAgcmVwbGFjZSgvJTVCL2dpLCAnWycpLlxuICAgIHJlcGxhY2UoLyU1RC9naSwgJ10nKTtcbn1cblxuLyoqXG4gKiBCdWlsZCBhIFVSTCBieSBhcHBlbmRpbmcgcGFyYW1zIHRvIHRoZSBlbmRcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdXJsIFRoZSBiYXNlIG9mIHRoZSB1cmwgKGUuZy4sIGh0dHA6Ly93d3cuZ29vZ2xlLmNvbSlcbiAqIEBwYXJhbSB7b2JqZWN0fSBbcGFyYW1zXSBUaGUgcGFyYW1zIHRvIGJlIGFwcGVuZGVkXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgZm9ybWF0dGVkIHVybFxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGJ1aWxkVVJMKHVybCwgcGFyYW1zLCBwYXJhbXNTZXJpYWxpemVyKSB7XG4gIC8qZXNsaW50IG5vLXBhcmFtLXJlYXNzaWduOjAqL1xuICBpZiAoIXBhcmFtcykge1xuICAgIHJldHVybiB1cmw7XG4gIH1cblxuICB2YXIgc2VyaWFsaXplZFBhcmFtcztcbiAgaWYgKHBhcmFtc1NlcmlhbGl6ZXIpIHtcbiAgICBzZXJpYWxpemVkUGFyYW1zID0gcGFyYW1zU2VyaWFsaXplcihwYXJhbXMpO1xuICB9IGVsc2UgaWYgKHV0aWxzLmlzVVJMU2VhcmNoUGFyYW1zKHBhcmFtcykpIHtcbiAgICBzZXJpYWxpemVkUGFyYW1zID0gcGFyYW1zLnRvU3RyaW5nKCk7XG4gIH0gZWxzZSB7XG4gICAgdmFyIHBhcnRzID0gW107XG5cbiAgICB1dGlscy5mb3JFYWNoKHBhcmFtcywgZnVuY3Rpb24gc2VyaWFsaXplKHZhbCwga2V5KSB7XG4gICAgICBpZiAodmFsID09PSBudWxsIHx8IHR5cGVvZiB2YWwgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKHV0aWxzLmlzQXJyYXkodmFsKSkge1xuICAgICAgICBrZXkgPSBrZXkgKyAnW10nO1xuICAgICAgfVxuXG4gICAgICBpZiAoIXV0aWxzLmlzQXJyYXkodmFsKSkge1xuICAgICAgICB2YWwgPSBbdmFsXTtcbiAgICAgIH1cblxuICAgICAgdXRpbHMuZm9yRWFjaCh2YWwsIGZ1bmN0aW9uIHBhcnNlVmFsdWUodikge1xuICAgICAgICBpZiAodXRpbHMuaXNEYXRlKHYpKSB7XG4gICAgICAgICAgdiA9IHYudG9JU09TdHJpbmcoKTtcbiAgICAgICAgfSBlbHNlIGlmICh1dGlscy5pc09iamVjdCh2KSkge1xuICAgICAgICAgIHYgPSBKU09OLnN0cmluZ2lmeSh2KTtcbiAgICAgICAgfVxuICAgICAgICBwYXJ0cy5wdXNoKGVuY29kZShrZXkpICsgJz0nICsgZW5jb2RlKHYpKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgc2VyaWFsaXplZFBhcmFtcyA9IHBhcnRzLmpvaW4oJyYnKTtcbiAgfVxuXG4gIGlmIChzZXJpYWxpemVkUGFyYW1zKSB7XG4gICAgdXJsICs9ICh1cmwuaW5kZXhPZignPycpID09PSAtMSA/ICc/JyA6ICcmJykgKyBzZXJpYWxpemVkUGFyYW1zO1xuICB9XG5cbiAgcmV0dXJuIHVybDtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyBVUkwgYnkgY29tYmluaW5nIHRoZSBzcGVjaWZpZWQgVVJMc1xuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBiYXNlVVJMIFRoZSBiYXNlIFVSTFxuICogQHBhcmFtIHtzdHJpbmd9IHJlbGF0aXZlVVJMIFRoZSByZWxhdGl2ZSBVUkxcbiAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBjb21iaW5lZCBVUkxcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBjb21iaW5lVVJMcyhiYXNlVVJMLCByZWxhdGl2ZVVSTCkge1xuICByZXR1cm4gcmVsYXRpdmVVUkxcbiAgICA/IGJhc2VVUkwucmVwbGFjZSgvXFwvKyQvLCAnJykgKyAnLycgKyByZWxhdGl2ZVVSTC5yZXBsYWNlKC9eXFwvKy8sICcnKVxuICAgIDogYmFzZVVSTDtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vLi4vdXRpbHMnKTtcblxubW9kdWxlLmV4cG9ydHMgPSAoXG4gIHV0aWxzLmlzU3RhbmRhcmRCcm93c2VyRW52KCkgP1xuXG4gIC8vIFN0YW5kYXJkIGJyb3dzZXIgZW52cyBzdXBwb3J0IGRvY3VtZW50LmNvb2tpZVxuICAoZnVuY3Rpb24gc3RhbmRhcmRCcm93c2VyRW52KCkge1xuICAgIHJldHVybiB7XG4gICAgICB3cml0ZTogZnVuY3Rpb24gd3JpdGUobmFtZSwgdmFsdWUsIGV4cGlyZXMsIHBhdGgsIGRvbWFpbiwgc2VjdXJlKSB7XG4gICAgICAgIHZhciBjb29raWUgPSBbXTtcbiAgICAgICAgY29va2llLnB1c2gobmFtZSArICc9JyArIGVuY29kZVVSSUNvbXBvbmVudCh2YWx1ZSkpO1xuXG4gICAgICAgIGlmICh1dGlscy5pc051bWJlcihleHBpcmVzKSkge1xuICAgICAgICAgIGNvb2tpZS5wdXNoKCdleHBpcmVzPScgKyBuZXcgRGF0ZShleHBpcmVzKS50b0dNVFN0cmluZygpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh1dGlscy5pc1N0cmluZyhwYXRoKSkge1xuICAgICAgICAgIGNvb2tpZS5wdXNoKCdwYXRoPScgKyBwYXRoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh1dGlscy5pc1N0cmluZyhkb21haW4pKSB7XG4gICAgICAgICAgY29va2llLnB1c2goJ2RvbWFpbj0nICsgZG9tYWluKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzZWN1cmUgPT09IHRydWUpIHtcbiAgICAgICAgICBjb29raWUucHVzaCgnc2VjdXJlJyk7XG4gICAgICAgIH1cblxuICAgICAgICBkb2N1bWVudC5jb29raWUgPSBjb29raWUuam9pbignOyAnKTtcbiAgICAgIH0sXG5cbiAgICAgIHJlYWQ6IGZ1bmN0aW9uIHJlYWQobmFtZSkge1xuICAgICAgICB2YXIgbWF0Y2ggPSBkb2N1bWVudC5jb29raWUubWF0Y2gobmV3IFJlZ0V4cCgnKF58O1xcXFxzKikoJyArIG5hbWUgKyAnKT0oW147XSopJykpO1xuICAgICAgICByZXR1cm4gKG1hdGNoID8gZGVjb2RlVVJJQ29tcG9uZW50KG1hdGNoWzNdKSA6IG51bGwpO1xuICAgICAgfSxcblxuICAgICAgcmVtb3ZlOiBmdW5jdGlvbiByZW1vdmUobmFtZSkge1xuICAgICAgICB0aGlzLndyaXRlKG5hbWUsICcnLCBEYXRlLm5vdygpIC0gODY0MDAwMDApO1xuICAgICAgfVxuICAgIH07XG4gIH0pKCkgOlxuXG4gIC8vIE5vbiBzdGFuZGFyZCBicm93c2VyIGVudiAod2ViIHdvcmtlcnMsIHJlYWN0LW5hdGl2ZSkgbGFjayBuZWVkZWQgc3VwcG9ydC5cbiAgKGZ1bmN0aW9uIG5vblN0YW5kYXJkQnJvd3NlckVudigpIHtcbiAgICByZXR1cm4ge1xuICAgICAgd3JpdGU6IGZ1bmN0aW9uIHdyaXRlKCkge30sXG4gICAgICByZWFkOiBmdW5jdGlvbiByZWFkKCkgeyByZXR1cm4gbnVsbDsgfSxcbiAgICAgIHJlbW92ZTogZnVuY3Rpb24gcmVtb3ZlKCkge31cbiAgICB9O1xuICB9KSgpXG4pO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIERldGVybWluZXMgd2hldGhlciB0aGUgc3BlY2lmaWVkIFVSTCBpcyBhYnNvbHV0ZVxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgVGhlIFVSTCB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgc3BlY2lmaWVkIFVSTCBpcyBhYnNvbHV0ZSwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaXNBYnNvbHV0ZVVSTCh1cmwpIHtcbiAgLy8gQSBVUkwgaXMgY29uc2lkZXJlZCBhYnNvbHV0ZSBpZiBpdCBiZWdpbnMgd2l0aCBcIjxzY2hlbWU+Oi8vXCIgb3IgXCIvL1wiIChwcm90b2NvbC1yZWxhdGl2ZSBVUkwpLlxuICAvLyBSRkMgMzk4NiBkZWZpbmVzIHNjaGVtZSBuYW1lIGFzIGEgc2VxdWVuY2Ugb2YgY2hhcmFjdGVycyBiZWdpbm5pbmcgd2l0aCBhIGxldHRlciBhbmQgZm9sbG93ZWRcbiAgLy8gYnkgYW55IGNvbWJpbmF0aW9uIG9mIGxldHRlcnMsIGRpZ2l0cywgcGx1cywgcGVyaW9kLCBvciBoeXBoZW4uXG4gIHJldHVybiAvXihbYS16XVthLXpcXGRcXCtcXC1cXC5dKjopP1xcL1xcLy9pLnRlc3QodXJsKTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vLi4vdXRpbHMnKTtcblxubW9kdWxlLmV4cG9ydHMgPSAoXG4gIHV0aWxzLmlzU3RhbmRhcmRCcm93c2VyRW52KCkgP1xuXG4gIC8vIFN0YW5kYXJkIGJyb3dzZXIgZW52cyBoYXZlIGZ1bGwgc3VwcG9ydCBvZiB0aGUgQVBJcyBuZWVkZWQgdG8gdGVzdFxuICAvLyB3aGV0aGVyIHRoZSByZXF1ZXN0IFVSTCBpcyBvZiB0aGUgc2FtZSBvcmlnaW4gYXMgY3VycmVudCBsb2NhdGlvbi5cbiAgKGZ1bmN0aW9uIHN0YW5kYXJkQnJvd3NlckVudigpIHtcbiAgICB2YXIgbXNpZSA9IC8obXNpZXx0cmlkZW50KS9pLnRlc3QobmF2aWdhdG9yLnVzZXJBZ2VudCk7XG4gICAgdmFyIHVybFBhcnNpbmdOb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuICAgIHZhciBvcmlnaW5VUkw7XG5cbiAgICAvKipcbiAgICAqIFBhcnNlIGEgVVJMIHRvIGRpc2NvdmVyIGl0J3MgY29tcG9uZW50c1xuICAgICpcbiAgICAqIEBwYXJhbSB7U3RyaW5nfSB1cmwgVGhlIFVSTCB0byBiZSBwYXJzZWRcbiAgICAqIEByZXR1cm5zIHtPYmplY3R9XG4gICAgKi9cbiAgICBmdW5jdGlvbiByZXNvbHZlVVJMKHVybCkge1xuICAgICAgdmFyIGhyZWYgPSB1cmw7XG5cbiAgICAgIGlmIChtc2llKSB7XG4gICAgICAgIC8vIElFIG5lZWRzIGF0dHJpYnV0ZSBzZXQgdHdpY2UgdG8gbm9ybWFsaXplIHByb3BlcnRpZXNcbiAgICAgICAgdXJsUGFyc2luZ05vZGUuc2V0QXR0cmlidXRlKCdocmVmJywgaHJlZik7XG4gICAgICAgIGhyZWYgPSB1cmxQYXJzaW5nTm9kZS5ocmVmO1xuICAgICAgfVxuXG4gICAgICB1cmxQYXJzaW5nTm9kZS5zZXRBdHRyaWJ1dGUoJ2hyZWYnLCBocmVmKTtcblxuICAgICAgLy8gdXJsUGFyc2luZ05vZGUgcHJvdmlkZXMgdGhlIFVybFV0aWxzIGludGVyZmFjZSAtIGh0dHA6Ly91cmwuc3BlYy53aGF0d2cub3JnLyN1cmx1dGlsc1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgaHJlZjogdXJsUGFyc2luZ05vZGUuaHJlZixcbiAgICAgICAgcHJvdG9jb2w6IHVybFBhcnNpbmdOb2RlLnByb3RvY29sID8gdXJsUGFyc2luZ05vZGUucHJvdG9jb2wucmVwbGFjZSgvOiQvLCAnJykgOiAnJyxcbiAgICAgICAgaG9zdDogdXJsUGFyc2luZ05vZGUuaG9zdCxcbiAgICAgICAgc2VhcmNoOiB1cmxQYXJzaW5nTm9kZS5zZWFyY2ggPyB1cmxQYXJzaW5nTm9kZS5zZWFyY2gucmVwbGFjZSgvXlxcPy8sICcnKSA6ICcnLFxuICAgICAgICBoYXNoOiB1cmxQYXJzaW5nTm9kZS5oYXNoID8gdXJsUGFyc2luZ05vZGUuaGFzaC5yZXBsYWNlKC9eIy8sICcnKSA6ICcnLFxuICAgICAgICBob3N0bmFtZTogdXJsUGFyc2luZ05vZGUuaG9zdG5hbWUsXG4gICAgICAgIHBvcnQ6IHVybFBhcnNpbmdOb2RlLnBvcnQsXG4gICAgICAgIHBhdGhuYW1lOiAodXJsUGFyc2luZ05vZGUucGF0aG5hbWUuY2hhckF0KDApID09PSAnLycpID9cbiAgICAgICAgICAgICAgICAgIHVybFBhcnNpbmdOb2RlLnBhdGhuYW1lIDpcbiAgICAgICAgICAgICAgICAgICcvJyArIHVybFBhcnNpbmdOb2RlLnBhdGhuYW1lXG4gICAgICB9O1xuICAgIH1cblxuICAgIG9yaWdpblVSTCA9IHJlc29sdmVVUkwod2luZG93LmxvY2F0aW9uLmhyZWYpO1xuXG4gICAgLyoqXG4gICAgKiBEZXRlcm1pbmUgaWYgYSBVUkwgc2hhcmVzIHRoZSBzYW1lIG9yaWdpbiBhcyB0aGUgY3VycmVudCBsb2NhdGlvblxuICAgICpcbiAgICAqIEBwYXJhbSB7U3RyaW5nfSByZXF1ZXN0VVJMIFRoZSBVUkwgdG8gdGVzdFxuICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgVVJMIHNoYXJlcyB0aGUgc2FtZSBvcmlnaW4sIG90aGVyd2lzZSBmYWxzZVxuICAgICovXG4gICAgcmV0dXJuIGZ1bmN0aW9uIGlzVVJMU2FtZU9yaWdpbihyZXF1ZXN0VVJMKSB7XG4gICAgICB2YXIgcGFyc2VkID0gKHV0aWxzLmlzU3RyaW5nKHJlcXVlc3RVUkwpKSA/IHJlc29sdmVVUkwocmVxdWVzdFVSTCkgOiByZXF1ZXN0VVJMO1xuICAgICAgcmV0dXJuIChwYXJzZWQucHJvdG9jb2wgPT09IG9yaWdpblVSTC5wcm90b2NvbCAmJlxuICAgICAgICAgICAgcGFyc2VkLmhvc3QgPT09IG9yaWdpblVSTC5ob3N0KTtcbiAgICB9O1xuICB9KSgpIDpcblxuICAvLyBOb24gc3RhbmRhcmQgYnJvd3NlciBlbnZzICh3ZWIgd29ya2VycywgcmVhY3QtbmF0aXZlKSBsYWNrIG5lZWRlZCBzdXBwb3J0LlxuICAoZnVuY3Rpb24gbm9uU3RhbmRhcmRCcm93c2VyRW52KCkge1xuICAgIHJldHVybiBmdW5jdGlvbiBpc1VSTFNhbWVPcmlnaW4oKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9O1xuICB9KSgpXG4pO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLi91dGlscycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIG5vcm1hbGl6ZUhlYWRlck5hbWUoaGVhZGVycywgbm9ybWFsaXplZE5hbWUpIHtcbiAgdXRpbHMuZm9yRWFjaChoZWFkZXJzLCBmdW5jdGlvbiBwcm9jZXNzSGVhZGVyKHZhbHVlLCBuYW1lKSB7XG4gICAgaWYgKG5hbWUgIT09IG5vcm1hbGl6ZWROYW1lICYmIG5hbWUudG9VcHBlckNhc2UoKSA9PT0gbm9ybWFsaXplZE5hbWUudG9VcHBlckNhc2UoKSkge1xuICAgICAgaGVhZGVyc1tub3JtYWxpemVkTmFtZV0gPSB2YWx1ZTtcbiAgICAgIGRlbGV0ZSBoZWFkZXJzW25hbWVdO1xuICAgIH1cbiAgfSk7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLy4uL3V0aWxzJyk7XG5cbi8qKlxuICogUGFyc2UgaGVhZGVycyBpbnRvIGFuIG9iamVjdFxuICpcbiAqIGBgYFxuICogRGF0ZTogV2VkLCAyNyBBdWcgMjAxNCAwODo1ODo0OSBHTVRcbiAqIENvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvblxuICogQ29ubmVjdGlvbjoga2VlcC1hbGl2ZVxuICogVHJhbnNmZXItRW5jb2Rpbmc6IGNodW5rZWRcbiAqIGBgYFxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBoZWFkZXJzIEhlYWRlcnMgbmVlZGluZyB0byBiZSBwYXJzZWRcbiAqIEByZXR1cm5zIHtPYmplY3R9IEhlYWRlcnMgcGFyc2VkIGludG8gYW4gb2JqZWN0XG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gcGFyc2VIZWFkZXJzKGhlYWRlcnMpIHtcbiAgdmFyIHBhcnNlZCA9IHt9O1xuICB2YXIga2V5O1xuICB2YXIgdmFsO1xuICB2YXIgaTtcblxuICBpZiAoIWhlYWRlcnMpIHsgcmV0dXJuIHBhcnNlZDsgfVxuXG4gIHV0aWxzLmZvckVhY2goaGVhZGVycy5zcGxpdCgnXFxuJyksIGZ1bmN0aW9uIHBhcnNlcihsaW5lKSB7XG4gICAgaSA9IGxpbmUuaW5kZXhPZignOicpO1xuICAgIGtleSA9IHV0aWxzLnRyaW0obGluZS5zdWJzdHIoMCwgaSkpLnRvTG93ZXJDYXNlKCk7XG4gICAgdmFsID0gdXRpbHMudHJpbShsaW5lLnN1YnN0cihpICsgMSkpO1xuXG4gICAgaWYgKGtleSkge1xuICAgICAgcGFyc2VkW2tleV0gPSBwYXJzZWRba2V5XSA/IHBhcnNlZFtrZXldICsgJywgJyArIHZhbCA6IHZhbDtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBwYXJzZWQ7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIFN5bnRhY3RpYyBzdWdhciBmb3IgaW52b2tpbmcgYSBmdW5jdGlvbiBhbmQgZXhwYW5kaW5nIGFuIGFycmF5IGZvciBhcmd1bWVudHMuXG4gKlxuICogQ29tbW9uIHVzZSBjYXNlIHdvdWxkIGJlIHRvIHVzZSBgRnVuY3Rpb24ucHJvdG90eXBlLmFwcGx5YC5cbiAqXG4gKiAgYGBganNcbiAqICBmdW5jdGlvbiBmKHgsIHksIHopIHt9XG4gKiAgdmFyIGFyZ3MgPSBbMSwgMiwgM107XG4gKiAgZi5hcHBseShudWxsLCBhcmdzKTtcbiAqICBgYGBcbiAqXG4gKiBXaXRoIGBzcHJlYWRgIHRoaXMgZXhhbXBsZSBjYW4gYmUgcmUtd3JpdHRlbi5cbiAqXG4gKiAgYGBganNcbiAqICBzcHJlYWQoZnVuY3Rpb24oeCwgeSwgeikge30pKFsxLCAyLCAzXSk7XG4gKiAgYGBgXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAqIEByZXR1cm5zIHtGdW5jdGlvbn1cbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBzcHJlYWQoY2FsbGJhY2spIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIHdyYXAoYXJyKSB7XG4gICAgcmV0dXJuIGNhbGxiYWNrLmFwcGx5KG51bGwsIGFycik7XG4gIH07XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgYmluZCA9IHJlcXVpcmUoJy4vaGVscGVycy9iaW5kJyk7XG52YXIgaXNCdWZmZXIgPSByZXF1aXJlKCdpcy1idWZmZXInKTtcblxuLypnbG9iYWwgdG9TdHJpbmc6dHJ1ZSovXG5cbi8vIHV0aWxzIGlzIGEgbGlicmFyeSBvZiBnZW5lcmljIGhlbHBlciBmdW5jdGlvbnMgbm9uLXNwZWNpZmljIHRvIGF4aW9zXG5cbnZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIGEgdmFsdWUgaXMgYW4gQXJyYXlcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsIFRoZSB2YWx1ZSB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB2YWx1ZSBpcyBhbiBBcnJheSwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzQXJyYXkodmFsKSB7XG4gIHJldHVybiB0b1N0cmluZy5jYWxsKHZhbCkgPT09ICdbb2JqZWN0IEFycmF5XSc7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIGEgdmFsdWUgaXMgYW4gQXJyYXlCdWZmZXJcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsIFRoZSB2YWx1ZSB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB2YWx1ZSBpcyBhbiBBcnJheUJ1ZmZlciwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzQXJyYXlCdWZmZXIodmFsKSB7XG4gIHJldHVybiB0b1N0cmluZy5jYWxsKHZhbCkgPT09ICdbb2JqZWN0IEFycmF5QnVmZmVyXSc7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIGEgdmFsdWUgaXMgYSBGb3JtRGF0YVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHZhbHVlIGlzIGFuIEZvcm1EYXRhLCBvdGhlcndpc2UgZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNGb3JtRGF0YSh2YWwpIHtcbiAgcmV0dXJuICh0eXBlb2YgRm9ybURhdGEgIT09ICd1bmRlZmluZWQnKSAmJiAodmFsIGluc3RhbmNlb2YgRm9ybURhdGEpO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIGEgdmlldyBvbiBhbiBBcnJheUJ1ZmZlclxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHZhbHVlIGlzIGEgdmlldyBvbiBhbiBBcnJheUJ1ZmZlciwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzQXJyYXlCdWZmZXJWaWV3KHZhbCkge1xuICB2YXIgcmVzdWx0O1xuICBpZiAoKHR5cGVvZiBBcnJheUJ1ZmZlciAhPT0gJ3VuZGVmaW5lZCcpICYmIChBcnJheUJ1ZmZlci5pc1ZpZXcpKSB7XG4gICAgcmVzdWx0ID0gQXJyYXlCdWZmZXIuaXNWaWV3KHZhbCk7XG4gIH0gZWxzZSB7XG4gICAgcmVzdWx0ID0gKHZhbCkgJiYgKHZhbC5idWZmZXIpICYmICh2YWwuYnVmZmVyIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIGEgdmFsdWUgaXMgYSBTdHJpbmdcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsIFRoZSB2YWx1ZSB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB2YWx1ZSBpcyBhIFN0cmluZywgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzU3RyaW5nKHZhbCkge1xuICByZXR1cm4gdHlwZW9mIHZhbCA9PT0gJ3N0cmluZyc7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIGEgdmFsdWUgaXMgYSBOdW1iZXJcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsIFRoZSB2YWx1ZSB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB2YWx1ZSBpcyBhIE51bWJlciwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzTnVtYmVyKHZhbCkge1xuICByZXR1cm4gdHlwZW9mIHZhbCA9PT0gJ251bWJlcic7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIGEgdmFsdWUgaXMgdW5kZWZpbmVkXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbCBUaGUgdmFsdWUgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIHZhbHVlIGlzIHVuZGVmaW5lZCwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKHZhbCkge1xuICByZXR1cm4gdHlwZW9mIHZhbCA9PT0gJ3VuZGVmaW5lZCc7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIGEgdmFsdWUgaXMgYW4gT2JqZWN0XG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbCBUaGUgdmFsdWUgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdmFsdWUgaXMgYW4gT2JqZWN0LCBvdGhlcndpc2UgZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNPYmplY3QodmFsKSB7XG4gIHJldHVybiB2YWwgIT09IG51bGwgJiYgdHlwZW9mIHZhbCA9PT0gJ29iamVjdCc7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIGEgdmFsdWUgaXMgYSBEYXRlXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbCBUaGUgdmFsdWUgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdmFsdWUgaXMgYSBEYXRlLCBvdGhlcndpc2UgZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNEYXRlKHZhbCkge1xuICByZXR1cm4gdG9TdHJpbmcuY2FsbCh2YWwpID09PSAnW29iamVjdCBEYXRlXSc7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIGEgdmFsdWUgaXMgYSBGaWxlXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbCBUaGUgdmFsdWUgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdmFsdWUgaXMgYSBGaWxlLCBvdGhlcndpc2UgZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNGaWxlKHZhbCkge1xuICByZXR1cm4gdG9TdHJpbmcuY2FsbCh2YWwpID09PSAnW29iamVjdCBGaWxlXSc7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIGEgdmFsdWUgaXMgYSBCbG9iXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbCBUaGUgdmFsdWUgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdmFsdWUgaXMgYSBCbG9iLCBvdGhlcndpc2UgZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNCbG9iKHZhbCkge1xuICByZXR1cm4gdG9TdHJpbmcuY2FsbCh2YWwpID09PSAnW29iamVjdCBCbG9iXSc7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIGEgdmFsdWUgaXMgYSBGdW5jdGlvblxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHZhbHVlIGlzIGEgRnVuY3Rpb24sIG90aGVyd2lzZSBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKHZhbCkge1xuICByZXR1cm4gdG9TdHJpbmcuY2FsbCh2YWwpID09PSAnW29iamVjdCBGdW5jdGlvbl0nO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIGEgU3RyZWFtXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbCBUaGUgdmFsdWUgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdmFsdWUgaXMgYSBTdHJlYW0sIG90aGVyd2lzZSBmYWxzZVxuICovXG5mdW5jdGlvbiBpc1N0cmVhbSh2YWwpIHtcbiAgcmV0dXJuIGlzT2JqZWN0KHZhbCkgJiYgaXNGdW5jdGlvbih2YWwucGlwZSk7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIGEgdmFsdWUgaXMgYSBVUkxTZWFyY2hQYXJhbXMgb2JqZWN0XG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbCBUaGUgdmFsdWUgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdmFsdWUgaXMgYSBVUkxTZWFyY2hQYXJhbXMgb2JqZWN0LCBvdGhlcndpc2UgZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNVUkxTZWFyY2hQYXJhbXModmFsKSB7XG4gIHJldHVybiB0eXBlb2YgVVJMU2VhcmNoUGFyYW1zICE9PSAndW5kZWZpbmVkJyAmJiB2YWwgaW5zdGFuY2VvZiBVUkxTZWFyY2hQYXJhbXM7XG59XG5cbi8qKlxuICogVHJpbSBleGNlc3Mgd2hpdGVzcGFjZSBvZmYgdGhlIGJlZ2lubmluZyBhbmQgZW5kIG9mIGEgc3RyaW5nXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBUaGUgU3RyaW5nIHRvIHRyaW1cbiAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBTdHJpbmcgZnJlZWQgb2YgZXhjZXNzIHdoaXRlc3BhY2VcbiAqL1xuZnVuY3Rpb24gdHJpbShzdHIpIHtcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9eXFxzKi8sICcnKS5yZXBsYWNlKC9cXHMqJC8sICcnKTtcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgd2UncmUgcnVubmluZyBpbiBhIHN0YW5kYXJkIGJyb3dzZXIgZW52aXJvbm1lbnRcbiAqXG4gKiBUaGlzIGFsbG93cyBheGlvcyB0byBydW4gaW4gYSB3ZWIgd29ya2VyLCBhbmQgcmVhY3QtbmF0aXZlLlxuICogQm90aCBlbnZpcm9ubWVudHMgc3VwcG9ydCBYTUxIdHRwUmVxdWVzdCwgYnV0IG5vdCBmdWxseSBzdGFuZGFyZCBnbG9iYWxzLlxuICpcbiAqIHdlYiB3b3JrZXJzOlxuICogIHR5cGVvZiB3aW5kb3cgLT4gdW5kZWZpbmVkXG4gKiAgdHlwZW9mIGRvY3VtZW50IC0+IHVuZGVmaW5lZFxuICpcbiAqIHJlYWN0LW5hdGl2ZTpcbiAqICBuYXZpZ2F0b3IucHJvZHVjdCAtPiAnUmVhY3ROYXRpdmUnXG4gKi9cbmZ1bmN0aW9uIGlzU3RhbmRhcmRCcm93c2VyRW52KCkge1xuICBpZiAodHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgJiYgbmF2aWdhdG9yLnByb2R1Y3QgPT09ICdSZWFjdE5hdGl2ZScpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIChcbiAgICB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJlxuICAgIHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCdcbiAgKTtcbn1cblxuLyoqXG4gKiBJdGVyYXRlIG92ZXIgYW4gQXJyYXkgb3IgYW4gT2JqZWN0IGludm9raW5nIGEgZnVuY3Rpb24gZm9yIGVhY2ggaXRlbS5cbiAqXG4gKiBJZiBgb2JqYCBpcyBhbiBBcnJheSBjYWxsYmFjayB3aWxsIGJlIGNhbGxlZCBwYXNzaW5nXG4gKiB0aGUgdmFsdWUsIGluZGV4LCBhbmQgY29tcGxldGUgYXJyYXkgZm9yIGVhY2ggaXRlbS5cbiAqXG4gKiBJZiAnb2JqJyBpcyBhbiBPYmplY3QgY2FsbGJhY2sgd2lsbCBiZSBjYWxsZWQgcGFzc2luZ1xuICogdGhlIHZhbHVlLCBrZXksIGFuZCBjb21wbGV0ZSBvYmplY3QgZm9yIGVhY2ggcHJvcGVydHkuXG4gKlxuICogQHBhcmFtIHtPYmplY3R8QXJyYXl9IG9iaiBUaGUgb2JqZWN0IHRvIGl0ZXJhdGVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuIFRoZSBjYWxsYmFjayB0byBpbnZva2UgZm9yIGVhY2ggaXRlbVxuICovXG5mdW5jdGlvbiBmb3JFYWNoKG9iaiwgZm4pIHtcbiAgLy8gRG9uJ3QgYm90aGVyIGlmIG5vIHZhbHVlIHByb3ZpZGVkXG4gIGlmIChvYmogPT09IG51bGwgfHwgdHlwZW9mIG9iaiA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBGb3JjZSBhbiBhcnJheSBpZiBub3QgYWxyZWFkeSBzb21ldGhpbmcgaXRlcmFibGVcbiAgaWYgKHR5cGVvZiBvYmogIT09ICdvYmplY3QnICYmICFpc0FycmF5KG9iaikpIHtcbiAgICAvKmVzbGludCBuby1wYXJhbS1yZWFzc2lnbjowKi9cbiAgICBvYmogPSBbb2JqXTtcbiAgfVxuXG4gIGlmIChpc0FycmF5KG9iaikpIHtcbiAgICAvLyBJdGVyYXRlIG92ZXIgYXJyYXkgdmFsdWVzXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSBvYmoubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICBmbi5jYWxsKG51bGwsIG9ialtpXSwgaSwgb2JqKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgLy8gSXRlcmF0ZSBvdmVyIG9iamVjdCBrZXlzXG4gICAgZm9yICh2YXIga2V5IGluIG9iaikge1xuICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSkpIHtcbiAgICAgICAgZm4uY2FsbChudWxsLCBvYmpba2V5XSwga2V5LCBvYmopO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEFjY2VwdHMgdmFyYXJncyBleHBlY3RpbmcgZWFjaCBhcmd1bWVudCB0byBiZSBhbiBvYmplY3QsIHRoZW5cbiAqIGltbXV0YWJseSBtZXJnZXMgdGhlIHByb3BlcnRpZXMgb2YgZWFjaCBvYmplY3QgYW5kIHJldHVybnMgcmVzdWx0LlxuICpcbiAqIFdoZW4gbXVsdGlwbGUgb2JqZWN0cyBjb250YWluIHRoZSBzYW1lIGtleSB0aGUgbGF0ZXIgb2JqZWN0IGluXG4gKiB0aGUgYXJndW1lbnRzIGxpc3Qgd2lsbCB0YWtlIHByZWNlZGVuY2UuXG4gKlxuICogRXhhbXBsZTpcbiAqXG4gKiBgYGBqc1xuICogdmFyIHJlc3VsdCA9IG1lcmdlKHtmb286IDEyM30sIHtmb286IDQ1Nn0pO1xuICogY29uc29sZS5sb2cocmVzdWx0LmZvbyk7IC8vIG91dHB1dHMgNDU2XG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqMSBPYmplY3QgdG8gbWVyZ2VcbiAqIEByZXR1cm5zIHtPYmplY3R9IFJlc3VsdCBvZiBhbGwgbWVyZ2UgcHJvcGVydGllc1xuICovXG5mdW5jdGlvbiBtZXJnZSgvKiBvYmoxLCBvYmoyLCBvYmozLCAuLi4gKi8pIHtcbiAgdmFyIHJlc3VsdCA9IHt9O1xuICBmdW5jdGlvbiBhc3NpZ25WYWx1ZSh2YWwsIGtleSkge1xuICAgIGlmICh0eXBlb2YgcmVzdWx0W2tleV0gPT09ICdvYmplY3QnICYmIHR5cGVvZiB2YWwgPT09ICdvYmplY3QnKSB7XG4gICAgICByZXN1bHRba2V5XSA9IG1lcmdlKHJlc3VsdFtrZXldLCB2YWwpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHRba2V5XSA9IHZhbDtcbiAgICB9XG4gIH1cblxuICBmb3IgKHZhciBpID0gMCwgbCA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBmb3JFYWNoKGFyZ3VtZW50c1tpXSwgYXNzaWduVmFsdWUpO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8qKlxuICogRXh0ZW5kcyBvYmplY3QgYSBieSBtdXRhYmx5IGFkZGluZyB0byBpdCB0aGUgcHJvcGVydGllcyBvZiBvYmplY3QgYi5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gYSBUaGUgb2JqZWN0IHRvIGJlIGV4dGVuZGVkXG4gKiBAcGFyYW0ge09iamVjdH0gYiBUaGUgb2JqZWN0IHRvIGNvcHkgcHJvcGVydGllcyBmcm9tXG4gKiBAcGFyYW0ge09iamVjdH0gdGhpc0FyZyBUaGUgb2JqZWN0IHRvIGJpbmQgZnVuY3Rpb24gdG9cbiAqIEByZXR1cm4ge09iamVjdH0gVGhlIHJlc3VsdGluZyB2YWx1ZSBvZiBvYmplY3QgYVxuICovXG5mdW5jdGlvbiBleHRlbmQoYSwgYiwgdGhpc0FyZykge1xuICBmb3JFYWNoKGIsIGZ1bmN0aW9uIGFzc2lnblZhbHVlKHZhbCwga2V5KSB7XG4gICAgaWYgKHRoaXNBcmcgJiYgdHlwZW9mIHZhbCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgYVtrZXldID0gYmluZCh2YWwsIHRoaXNBcmcpO1xuICAgIH0gZWxzZSB7XG4gICAgICBhW2tleV0gPSB2YWw7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIGE7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBpc0FycmF5OiBpc0FycmF5LFxuICBpc0FycmF5QnVmZmVyOiBpc0FycmF5QnVmZmVyLFxuICBpc0J1ZmZlcjogaXNCdWZmZXIsXG4gIGlzRm9ybURhdGE6IGlzRm9ybURhdGEsXG4gIGlzQXJyYXlCdWZmZXJWaWV3OiBpc0FycmF5QnVmZmVyVmlldyxcbiAgaXNTdHJpbmc6IGlzU3RyaW5nLFxuICBpc051bWJlcjogaXNOdW1iZXIsXG4gIGlzT2JqZWN0OiBpc09iamVjdCxcbiAgaXNVbmRlZmluZWQ6IGlzVW5kZWZpbmVkLFxuICBpc0RhdGU6IGlzRGF0ZSxcbiAgaXNGaWxlOiBpc0ZpbGUsXG4gIGlzQmxvYjogaXNCbG9iLFxuICBpc0Z1bmN0aW9uOiBpc0Z1bmN0aW9uLFxuICBpc1N0cmVhbTogaXNTdHJlYW0sXG4gIGlzVVJMU2VhcmNoUGFyYW1zOiBpc1VSTFNlYXJjaFBhcmFtcyxcbiAgaXNTdGFuZGFyZEJyb3dzZXJFbnY6IGlzU3RhbmRhcmRCcm93c2VyRW52LFxuICBmb3JFYWNoOiBmb3JFYWNoLFxuICBtZXJnZTogbWVyZ2UsXG4gIGV4dGVuZDogZXh0ZW5kLFxuICB0cmltOiB0cmltXG59O1xuIiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxMy1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIF9hc3NpZ24gPSByZXF1aXJlKCdvYmplY3QtYXNzaWduJyk7XG5cbnZhciBlbXB0eU9iamVjdCA9IHJlcXVpcmUoJ2ZianMvbGliL2VtcHR5T2JqZWN0Jyk7XG52YXIgX2ludmFyaWFudCA9IHJlcXVpcmUoJ2ZianMvbGliL2ludmFyaWFudCcpO1xuXG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICB2YXIgd2FybmluZyA9IHJlcXVpcmUoJ2ZianMvbGliL3dhcm5pbmcnKTtcbn1cblxudmFyIE1JWElOU19LRVkgPSAnbWl4aW5zJztcblxuLy8gSGVscGVyIGZ1bmN0aW9uIHRvIGFsbG93IHRoZSBjcmVhdGlvbiBvZiBhbm9ueW1vdXMgZnVuY3Rpb25zIHdoaWNoIGRvIG5vdFxuLy8gaGF2ZSAubmFtZSBzZXQgdG8gdGhlIG5hbWUgb2YgdGhlIHZhcmlhYmxlIGJlaW5nIGFzc2lnbmVkIHRvLlxuZnVuY3Rpb24gaWRlbnRpdHkoZm4pIHtcbiAgcmV0dXJuIGZuO1xufVxuXG52YXIgUmVhY3RQcm9wVHlwZUxvY2F0aW9uTmFtZXM7XG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICBSZWFjdFByb3BUeXBlTG9jYXRpb25OYW1lcyA9IHtcbiAgICBwcm9wOiAncHJvcCcsXG4gICAgY29udGV4dDogJ2NvbnRleHQnLFxuICAgIGNoaWxkQ29udGV4dDogJ2NoaWxkIGNvbnRleHQnXG4gIH07XG59IGVsc2Uge1xuICBSZWFjdFByb3BUeXBlTG9jYXRpb25OYW1lcyA9IHt9O1xufVxuXG5mdW5jdGlvbiBmYWN0b3J5KFJlYWN0Q29tcG9uZW50LCBpc1ZhbGlkRWxlbWVudCwgUmVhY3ROb29wVXBkYXRlUXVldWUpIHtcbiAgLyoqXG4gICAqIFBvbGljaWVzIHRoYXQgZGVzY3JpYmUgbWV0aG9kcyBpbiBgUmVhY3RDbGFzc0ludGVyZmFjZWAuXG4gICAqL1xuXG4gIHZhciBpbmplY3RlZE1peGlucyA9IFtdO1xuXG4gIC8qKlxuICAgKiBDb21wb3NpdGUgY29tcG9uZW50cyBhcmUgaGlnaGVyLWxldmVsIGNvbXBvbmVudHMgdGhhdCBjb21wb3NlIG90aGVyIGNvbXBvc2l0ZVxuICAgKiBvciBob3N0IGNvbXBvbmVudHMuXG4gICAqXG4gICAqIFRvIGNyZWF0ZSBhIG5ldyB0eXBlIG9mIGBSZWFjdENsYXNzYCwgcGFzcyBhIHNwZWNpZmljYXRpb24gb2ZcbiAgICogeW91ciBuZXcgY2xhc3MgdG8gYFJlYWN0LmNyZWF0ZUNsYXNzYC4gVGhlIG9ubHkgcmVxdWlyZW1lbnQgb2YgeW91ciBjbGFzc1xuICAgKiBzcGVjaWZpY2F0aW9uIGlzIHRoYXQgeW91IGltcGxlbWVudCBhIGByZW5kZXJgIG1ldGhvZC5cbiAgICpcbiAgICogICB2YXIgTXlDb21wb25lbnQgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG4gICAqICAgICByZW5kZXI6IGZ1bmN0aW9uKCkge1xuICAgKiAgICAgICByZXR1cm4gPGRpdj5IZWxsbyBXb3JsZDwvZGl2PjtcbiAgICogICAgIH1cbiAgICogICB9KTtcbiAgICpcbiAgICogVGhlIGNsYXNzIHNwZWNpZmljYXRpb24gc3VwcG9ydHMgYSBzcGVjaWZpYyBwcm90b2NvbCBvZiBtZXRob2RzIHRoYXQgaGF2ZVxuICAgKiBzcGVjaWFsIG1lYW5pbmcgKGUuZy4gYHJlbmRlcmApLiBTZWUgYFJlYWN0Q2xhc3NJbnRlcmZhY2VgIGZvclxuICAgKiBtb3JlIHRoZSBjb21wcmVoZW5zaXZlIHByb3RvY29sLiBBbnkgb3RoZXIgcHJvcGVydGllcyBhbmQgbWV0aG9kcyBpbiB0aGVcbiAgICogY2xhc3Mgc3BlY2lmaWNhdGlvbiB3aWxsIGJlIGF2YWlsYWJsZSBvbiB0aGUgcHJvdG90eXBlLlxuICAgKlxuICAgKiBAaW50ZXJmYWNlIFJlYWN0Q2xhc3NJbnRlcmZhY2VcbiAgICogQGludGVybmFsXG4gICAqL1xuICB2YXIgUmVhY3RDbGFzc0ludGVyZmFjZSA9IHtcbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiBNaXhpbiBvYmplY3RzIHRvIGluY2x1ZGUgd2hlbiBkZWZpbmluZyB5b3VyIGNvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHthcnJheX1cbiAgICAgKiBAb3B0aW9uYWxcbiAgICAgKi9cbiAgICBtaXhpbnM6ICdERUZJTkVfTUFOWScsXG5cbiAgICAvKipcbiAgICAgKiBBbiBvYmplY3QgY29udGFpbmluZyBwcm9wZXJ0aWVzIGFuZCBtZXRob2RzIHRoYXQgc2hvdWxkIGJlIGRlZmluZWQgb25cbiAgICAgKiB0aGUgY29tcG9uZW50J3MgY29uc3RydWN0b3IgaW5zdGVhZCBvZiBpdHMgcHJvdG90eXBlIChzdGF0aWMgbWV0aG9kcykuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7b2JqZWN0fVxuICAgICAqIEBvcHRpb25hbFxuICAgICAqL1xuICAgIHN0YXRpY3M6ICdERUZJTkVfTUFOWScsXG5cbiAgICAvKipcbiAgICAgKiBEZWZpbml0aW9uIG9mIHByb3AgdHlwZXMgZm9yIHRoaXMgY29tcG9uZW50LlxuICAgICAqXG4gICAgICogQHR5cGUge29iamVjdH1cbiAgICAgKiBAb3B0aW9uYWxcbiAgICAgKi9cbiAgICBwcm9wVHlwZXM6ICdERUZJTkVfTUFOWScsXG5cbiAgICAvKipcbiAgICAgKiBEZWZpbml0aW9uIG9mIGNvbnRleHQgdHlwZXMgZm9yIHRoaXMgY29tcG9uZW50LlxuICAgICAqXG4gICAgICogQHR5cGUge29iamVjdH1cbiAgICAgKiBAb3B0aW9uYWxcbiAgICAgKi9cbiAgICBjb250ZXh0VHlwZXM6ICdERUZJTkVfTUFOWScsXG5cbiAgICAvKipcbiAgICAgKiBEZWZpbml0aW9uIG9mIGNvbnRleHQgdHlwZXMgdGhpcyBjb21wb25lbnQgc2V0cyBmb3IgaXRzIGNoaWxkcmVuLlxuICAgICAqXG4gICAgICogQHR5cGUge29iamVjdH1cbiAgICAgKiBAb3B0aW9uYWxcbiAgICAgKi9cbiAgICBjaGlsZENvbnRleHRUeXBlczogJ0RFRklORV9NQU5ZJyxcblxuICAgIC8vID09PT0gRGVmaW5pdGlvbiBtZXRob2RzID09PT1cblxuICAgIC8qKlxuICAgICAqIEludm9rZWQgd2hlbiB0aGUgY29tcG9uZW50IGlzIG1vdW50ZWQuIFZhbHVlcyBpbiB0aGUgbWFwcGluZyB3aWxsIGJlIHNldCBvblxuICAgICAqIGB0aGlzLnByb3BzYCBpZiB0aGF0IHByb3AgaXMgbm90IHNwZWNpZmllZCAoaS5lLiB1c2luZyBhbiBgaW5gIGNoZWNrKS5cbiAgICAgKlxuICAgICAqIFRoaXMgbWV0aG9kIGlzIGludm9rZWQgYmVmb3JlIGBnZXRJbml0aWFsU3RhdGVgIGFuZCB0aGVyZWZvcmUgY2Fubm90IHJlbHlcbiAgICAgKiBvbiBgdGhpcy5zdGF0ZWAgb3IgdXNlIGB0aGlzLnNldFN0YXRlYC5cbiAgICAgKlxuICAgICAqIEByZXR1cm4ge29iamVjdH1cbiAgICAgKiBAb3B0aW9uYWxcbiAgICAgKi9cbiAgICBnZXREZWZhdWx0UHJvcHM6ICdERUZJTkVfTUFOWV9NRVJHRUQnLFxuXG4gICAgLyoqXG4gICAgICogSW52b2tlZCBvbmNlIGJlZm9yZSB0aGUgY29tcG9uZW50IGlzIG1vdW50ZWQuIFRoZSByZXR1cm4gdmFsdWUgd2lsbCBiZSB1c2VkXG4gICAgICogYXMgdGhlIGluaXRpYWwgdmFsdWUgb2YgYHRoaXMuc3RhdGVgLlxuICAgICAqXG4gICAgICogICBnZXRJbml0aWFsU3RhdGU6IGZ1bmN0aW9uKCkge1xuICAgICAqICAgICByZXR1cm4ge1xuICAgICAqICAgICAgIGlzT246IGZhbHNlLFxuICAgICAqICAgICAgIGZvb0JhejogbmV3IEJhekZvbygpXG4gICAgICogICAgIH1cbiAgICAgKiAgIH1cbiAgICAgKlxuICAgICAqIEByZXR1cm4ge29iamVjdH1cbiAgICAgKiBAb3B0aW9uYWxcbiAgICAgKi9cbiAgICBnZXRJbml0aWFsU3RhdGU6ICdERUZJTkVfTUFOWV9NRVJHRUQnLFxuXG4gICAgLyoqXG4gICAgICogQHJldHVybiB7b2JqZWN0fVxuICAgICAqIEBvcHRpb25hbFxuICAgICAqL1xuICAgIGdldENoaWxkQ29udGV4dDogJ0RFRklORV9NQU5ZX01FUkdFRCcsXG5cbiAgICAvKipcbiAgICAgKiBVc2VzIHByb3BzIGZyb20gYHRoaXMucHJvcHNgIGFuZCBzdGF0ZSBmcm9tIGB0aGlzLnN0YXRlYCB0byByZW5kZXIgdGhlXG4gICAgICogc3RydWN0dXJlIG9mIHRoZSBjb21wb25lbnQuXG4gICAgICpcbiAgICAgKiBObyBndWFyYW50ZWVzIGFyZSBtYWRlIGFib3V0IHdoZW4gb3IgaG93IG9mdGVuIHRoaXMgbWV0aG9kIGlzIGludm9rZWQsIHNvXG4gICAgICogaXQgbXVzdCBub3QgaGF2ZSBzaWRlIGVmZmVjdHMuXG4gICAgICpcbiAgICAgKiAgIHJlbmRlcjogZnVuY3Rpb24oKSB7XG4gICAgICogICAgIHZhciBuYW1lID0gdGhpcy5wcm9wcy5uYW1lO1xuICAgICAqICAgICByZXR1cm4gPGRpdj5IZWxsbywge25hbWV9ITwvZGl2PjtcbiAgICAgKiAgIH1cbiAgICAgKlxuICAgICAqIEByZXR1cm4ge1JlYWN0Q29tcG9uZW50fVxuICAgICAqIEByZXF1aXJlZFxuICAgICAqL1xuICAgIHJlbmRlcjogJ0RFRklORV9PTkNFJyxcblxuICAgIC8vID09PT0gRGVsZWdhdGUgbWV0aG9kcyA9PT09XG5cbiAgICAvKipcbiAgICAgKiBJbnZva2VkIHdoZW4gdGhlIGNvbXBvbmVudCBpcyBpbml0aWFsbHkgY3JlYXRlZCBhbmQgYWJvdXQgdG8gYmUgbW91bnRlZC5cbiAgICAgKiBUaGlzIG1heSBoYXZlIHNpZGUgZWZmZWN0cywgYnV0IGFueSBleHRlcm5hbCBzdWJzY3JpcHRpb25zIG9yIGRhdGEgY3JlYXRlZFxuICAgICAqIGJ5IHRoaXMgbWV0aG9kIG11c3QgYmUgY2xlYW5lZCB1cCBpbiBgY29tcG9uZW50V2lsbFVubW91bnRgLlxuICAgICAqXG4gICAgICogQG9wdGlvbmFsXG4gICAgICovXG4gICAgY29tcG9uZW50V2lsbE1vdW50OiAnREVGSU5FX01BTlknLFxuXG4gICAgLyoqXG4gICAgICogSW52b2tlZCB3aGVuIHRoZSBjb21wb25lbnQgaGFzIGJlZW4gbW91bnRlZCBhbmQgaGFzIGEgRE9NIHJlcHJlc2VudGF0aW9uLlxuICAgICAqIEhvd2V2ZXIsIHRoZXJlIGlzIG5vIGd1YXJhbnRlZSB0aGF0IHRoZSBET00gbm9kZSBpcyBpbiB0aGUgZG9jdW1lbnQuXG4gICAgICpcbiAgICAgKiBVc2UgdGhpcyBhcyBhbiBvcHBvcnR1bml0eSB0byBvcGVyYXRlIG9uIHRoZSBET00gd2hlbiB0aGUgY29tcG9uZW50IGhhc1xuICAgICAqIGJlZW4gbW91bnRlZCAoaW5pdGlhbGl6ZWQgYW5kIHJlbmRlcmVkKSBmb3IgdGhlIGZpcnN0IHRpbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0RPTUVsZW1lbnR9IHJvb3ROb2RlIERPTSBlbGVtZW50IHJlcHJlc2VudGluZyB0aGUgY29tcG9uZW50LlxuICAgICAqIEBvcHRpb25hbFxuICAgICAqL1xuICAgIGNvbXBvbmVudERpZE1vdW50OiAnREVGSU5FX01BTlknLFxuXG4gICAgLyoqXG4gICAgICogSW52b2tlZCBiZWZvcmUgdGhlIGNvbXBvbmVudCByZWNlaXZlcyBuZXcgcHJvcHMuXG4gICAgICpcbiAgICAgKiBVc2UgdGhpcyBhcyBhbiBvcHBvcnR1bml0eSB0byByZWFjdCB0byBhIHByb3AgdHJhbnNpdGlvbiBieSB1cGRhdGluZyB0aGVcbiAgICAgKiBzdGF0ZSB1c2luZyBgdGhpcy5zZXRTdGF0ZWAuIEN1cnJlbnQgcHJvcHMgYXJlIGFjY2Vzc2VkIHZpYSBgdGhpcy5wcm9wc2AuXG4gICAgICpcbiAgICAgKiAgIGNvbXBvbmVudFdpbGxSZWNlaXZlUHJvcHM6IGZ1bmN0aW9uKG5leHRQcm9wcywgbmV4dENvbnRleHQpIHtcbiAgICAgKiAgICAgdGhpcy5zZXRTdGF0ZSh7XG4gICAgICogICAgICAgbGlrZXNJbmNyZWFzaW5nOiBuZXh0UHJvcHMubGlrZUNvdW50ID4gdGhpcy5wcm9wcy5saWtlQ291bnRcbiAgICAgKiAgICAgfSk7XG4gICAgICogICB9XG4gICAgICpcbiAgICAgKiBOT1RFOiBUaGVyZSBpcyBubyBlcXVpdmFsZW50IGBjb21wb25lbnRXaWxsUmVjZWl2ZVN0YXRlYC4gQW4gaW5jb21pbmcgcHJvcFxuICAgICAqIHRyYW5zaXRpb24gbWF5IGNhdXNlIGEgc3RhdGUgY2hhbmdlLCBidXQgdGhlIG9wcG9zaXRlIGlzIG5vdCB0cnVlLiBJZiB5b3VcbiAgICAgKiBuZWVkIGl0LCB5b3UgYXJlIHByb2JhYmx5IGxvb2tpbmcgZm9yIGBjb21wb25lbnRXaWxsVXBkYXRlYC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBuZXh0UHJvcHNcbiAgICAgKiBAb3B0aW9uYWxcbiAgICAgKi9cbiAgICBjb21wb25lbnRXaWxsUmVjZWl2ZVByb3BzOiAnREVGSU5FX01BTlknLFxuXG4gICAgLyoqXG4gICAgICogSW52b2tlZCB3aGlsZSBkZWNpZGluZyBpZiB0aGUgY29tcG9uZW50IHNob3VsZCBiZSB1cGRhdGVkIGFzIGEgcmVzdWx0IG9mXG4gICAgICogcmVjZWl2aW5nIG5ldyBwcm9wcywgc3RhdGUgYW5kL29yIGNvbnRleHQuXG4gICAgICpcbiAgICAgKiBVc2UgdGhpcyBhcyBhbiBvcHBvcnR1bml0eSB0byBgcmV0dXJuIGZhbHNlYCB3aGVuIHlvdSdyZSBjZXJ0YWluIHRoYXQgdGhlXG4gICAgICogdHJhbnNpdGlvbiB0byB0aGUgbmV3IHByb3BzL3N0YXRlL2NvbnRleHQgd2lsbCBub3QgcmVxdWlyZSBhIGNvbXBvbmVudFxuICAgICAqIHVwZGF0ZS5cbiAgICAgKlxuICAgICAqICAgc2hvdWxkQ29tcG9uZW50VXBkYXRlOiBmdW5jdGlvbihuZXh0UHJvcHMsIG5leHRTdGF0ZSwgbmV4dENvbnRleHQpIHtcbiAgICAgKiAgICAgcmV0dXJuICFlcXVhbChuZXh0UHJvcHMsIHRoaXMucHJvcHMpIHx8XG4gICAgICogICAgICAgIWVxdWFsKG5leHRTdGF0ZSwgdGhpcy5zdGF0ZSkgfHxcbiAgICAgKiAgICAgICAhZXF1YWwobmV4dENvbnRleHQsIHRoaXMuY29udGV4dCk7XG4gICAgICogICB9XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gbmV4dFByb3BzXG4gICAgICogQHBhcmFtIHs/b2JqZWN0fSBuZXh0U3RhdGVcbiAgICAgKiBAcGFyYW0gez9vYmplY3R9IG5leHRDb250ZXh0XG4gICAgICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgY29tcG9uZW50IHNob3VsZCB1cGRhdGUuXG4gICAgICogQG9wdGlvbmFsXG4gICAgICovXG4gICAgc2hvdWxkQ29tcG9uZW50VXBkYXRlOiAnREVGSU5FX09OQ0UnLFxuXG4gICAgLyoqXG4gICAgICogSW52b2tlZCB3aGVuIHRoZSBjb21wb25lbnQgaXMgYWJvdXQgdG8gdXBkYXRlIGR1ZSB0byBhIHRyYW5zaXRpb24gZnJvbVxuICAgICAqIGB0aGlzLnByb3BzYCwgYHRoaXMuc3RhdGVgIGFuZCBgdGhpcy5jb250ZXh0YCB0byBgbmV4dFByb3BzYCwgYG5leHRTdGF0ZWBcbiAgICAgKiBhbmQgYG5leHRDb250ZXh0YC5cbiAgICAgKlxuICAgICAqIFVzZSB0aGlzIGFzIGFuIG9wcG9ydHVuaXR5IHRvIHBlcmZvcm0gcHJlcGFyYXRpb24gYmVmb3JlIGFuIHVwZGF0ZSBvY2N1cnMuXG4gICAgICpcbiAgICAgKiBOT1RFOiBZb3UgKipjYW5ub3QqKiB1c2UgYHRoaXMuc2V0U3RhdGUoKWAgaW4gdGhpcyBtZXRob2QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gbmV4dFByb3BzXG4gICAgICogQHBhcmFtIHs/b2JqZWN0fSBuZXh0U3RhdGVcbiAgICAgKiBAcGFyYW0gez9vYmplY3R9IG5leHRDb250ZXh0XG4gICAgICogQHBhcmFtIHtSZWFjdFJlY29uY2lsZVRyYW5zYWN0aW9ufSB0cmFuc2FjdGlvblxuICAgICAqIEBvcHRpb25hbFxuICAgICAqL1xuICAgIGNvbXBvbmVudFdpbGxVcGRhdGU6ICdERUZJTkVfTUFOWScsXG5cbiAgICAvKipcbiAgICAgKiBJbnZva2VkIHdoZW4gdGhlIGNvbXBvbmVudCdzIERPTSByZXByZXNlbnRhdGlvbiBoYXMgYmVlbiB1cGRhdGVkLlxuICAgICAqXG4gICAgICogVXNlIHRoaXMgYXMgYW4gb3Bwb3J0dW5pdHkgdG8gb3BlcmF0ZSBvbiB0aGUgRE9NIHdoZW4gdGhlIGNvbXBvbmVudCBoYXNcbiAgICAgKiBiZWVuIHVwZGF0ZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gcHJldlByb3BzXG4gICAgICogQHBhcmFtIHs/b2JqZWN0fSBwcmV2U3RhdGVcbiAgICAgKiBAcGFyYW0gez9vYmplY3R9IHByZXZDb250ZXh0XG4gICAgICogQHBhcmFtIHtET01FbGVtZW50fSByb290Tm9kZSBET00gZWxlbWVudCByZXByZXNlbnRpbmcgdGhlIGNvbXBvbmVudC5cbiAgICAgKiBAb3B0aW9uYWxcbiAgICAgKi9cbiAgICBjb21wb25lbnREaWRVcGRhdGU6ICdERUZJTkVfTUFOWScsXG5cbiAgICAvKipcbiAgICAgKiBJbnZva2VkIHdoZW4gdGhlIGNvbXBvbmVudCBpcyBhYm91dCB0byBiZSByZW1vdmVkIGZyb20gaXRzIHBhcmVudCBhbmQgaGF2ZVxuICAgICAqIGl0cyBET00gcmVwcmVzZW50YXRpb24gZGVzdHJveWVkLlxuICAgICAqXG4gICAgICogVXNlIHRoaXMgYXMgYW4gb3Bwb3J0dW5pdHkgdG8gZGVhbGxvY2F0ZSBhbnkgZXh0ZXJuYWwgcmVzb3VyY2VzLlxuICAgICAqXG4gICAgICogTk9URTogVGhlcmUgaXMgbm8gYGNvbXBvbmVudERpZFVubW91bnRgIHNpbmNlIHlvdXIgY29tcG9uZW50IHdpbGwgaGF2ZSBiZWVuXG4gICAgICogZGVzdHJveWVkIGJ5IHRoYXQgcG9pbnQuXG4gICAgICpcbiAgICAgKiBAb3B0aW9uYWxcbiAgICAgKi9cbiAgICBjb21wb25lbnRXaWxsVW5tb3VudDogJ0RFRklORV9NQU5ZJyxcblxuICAgIC8vID09PT0gQWR2YW5jZWQgbWV0aG9kcyA9PT09XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGVzIHRoZSBjb21wb25lbnQncyBjdXJyZW50bHkgbW91bnRlZCBET00gcmVwcmVzZW50YXRpb24uXG4gICAgICpcbiAgICAgKiBCeSBkZWZhdWx0LCB0aGlzIGltcGxlbWVudHMgUmVhY3QncyByZW5kZXJpbmcgYW5kIHJlY29uY2lsaWF0aW9uIGFsZ29yaXRobS5cbiAgICAgKiBTb3BoaXN0aWNhdGVkIGNsaWVudHMgbWF5IHdpc2ggdG8gb3ZlcnJpZGUgdGhpcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UmVhY3RSZWNvbmNpbGVUcmFuc2FjdGlvbn0gdHJhbnNhY3Rpb25cbiAgICAgKiBAaW50ZXJuYWxcbiAgICAgKiBAb3ZlcnJpZGFibGVcbiAgICAgKi9cbiAgICB1cGRhdGVDb21wb25lbnQ6ICdPVkVSUklERV9CQVNFJ1xuICB9O1xuXG4gIC8qKlxuICAgKiBNYXBwaW5nIGZyb20gY2xhc3Mgc3BlY2lmaWNhdGlvbiBrZXlzIHRvIHNwZWNpYWwgcHJvY2Vzc2luZyBmdW5jdGlvbnMuXG4gICAqXG4gICAqIEFsdGhvdWdoIHRoZXNlIGFyZSBkZWNsYXJlZCBsaWtlIGluc3RhbmNlIHByb3BlcnRpZXMgaW4gdGhlIHNwZWNpZmljYXRpb25cbiAgICogd2hlbiBkZWZpbmluZyBjbGFzc2VzIHVzaW5nIGBSZWFjdC5jcmVhdGVDbGFzc2AsIHRoZXkgYXJlIGFjdHVhbGx5IHN0YXRpY1xuICAgKiBhbmQgYXJlIGFjY2Vzc2libGUgb24gdGhlIGNvbnN0cnVjdG9yIGluc3RlYWQgb2YgdGhlIHByb3RvdHlwZS4gRGVzcGl0ZVxuICAgKiBiZWluZyBzdGF0aWMsIHRoZXkgbXVzdCBiZSBkZWZpbmVkIG91dHNpZGUgb2YgdGhlIFwic3RhdGljc1wiIGtleSB1bmRlclxuICAgKiB3aGljaCBhbGwgb3RoZXIgc3RhdGljIG1ldGhvZHMgYXJlIGRlZmluZWQuXG4gICAqL1xuICB2YXIgUkVTRVJWRURfU1BFQ19LRVlTID0ge1xuICAgIGRpc3BsYXlOYW1lOiBmdW5jdGlvbihDb25zdHJ1Y3RvciwgZGlzcGxheU5hbWUpIHtcbiAgICAgIENvbnN0cnVjdG9yLmRpc3BsYXlOYW1lID0gZGlzcGxheU5hbWU7XG4gICAgfSxcbiAgICBtaXhpbnM6IGZ1bmN0aW9uKENvbnN0cnVjdG9yLCBtaXhpbnMpIHtcbiAgICAgIGlmIChtaXhpbnMpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBtaXhpbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBtaXhTcGVjSW50b0NvbXBvbmVudChDb25zdHJ1Y3RvciwgbWl4aW5zW2ldKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgY2hpbGRDb250ZXh0VHlwZXM6IGZ1bmN0aW9uKENvbnN0cnVjdG9yLCBjaGlsZENvbnRleHRUeXBlcykge1xuICAgICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgICAgdmFsaWRhdGVUeXBlRGVmKENvbnN0cnVjdG9yLCBjaGlsZENvbnRleHRUeXBlcywgJ2NoaWxkQ29udGV4dCcpO1xuICAgICAgfVxuICAgICAgQ29uc3RydWN0b3IuY2hpbGRDb250ZXh0VHlwZXMgPSBfYXNzaWduKFxuICAgICAgICB7fSxcbiAgICAgICAgQ29uc3RydWN0b3IuY2hpbGRDb250ZXh0VHlwZXMsXG4gICAgICAgIGNoaWxkQ29udGV4dFR5cGVzXG4gICAgICApO1xuICAgIH0sXG4gICAgY29udGV4dFR5cGVzOiBmdW5jdGlvbihDb25zdHJ1Y3RvciwgY29udGV4dFR5cGVzKSB7XG4gICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgICB2YWxpZGF0ZVR5cGVEZWYoQ29uc3RydWN0b3IsIGNvbnRleHRUeXBlcywgJ2NvbnRleHQnKTtcbiAgICAgIH1cbiAgICAgIENvbnN0cnVjdG9yLmNvbnRleHRUeXBlcyA9IF9hc3NpZ24oXG4gICAgICAgIHt9LFxuICAgICAgICBDb25zdHJ1Y3Rvci5jb250ZXh0VHlwZXMsXG4gICAgICAgIGNvbnRleHRUeXBlc1xuICAgICAgKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFNwZWNpYWwgY2FzZSBnZXREZWZhdWx0UHJvcHMgd2hpY2ggc2hvdWxkIG1vdmUgaW50byBzdGF0aWNzIGJ1dCByZXF1aXJlc1xuICAgICAqIGF1dG9tYXRpYyBtZXJnaW5nLlxuICAgICAqL1xuICAgIGdldERlZmF1bHRQcm9wczogZnVuY3Rpb24oQ29uc3RydWN0b3IsIGdldERlZmF1bHRQcm9wcykge1xuICAgICAgaWYgKENvbnN0cnVjdG9yLmdldERlZmF1bHRQcm9wcykge1xuICAgICAgICBDb25zdHJ1Y3Rvci5nZXREZWZhdWx0UHJvcHMgPSBjcmVhdGVNZXJnZWRSZXN1bHRGdW5jdGlvbihcbiAgICAgICAgICBDb25zdHJ1Y3Rvci5nZXREZWZhdWx0UHJvcHMsXG4gICAgICAgICAgZ2V0RGVmYXVsdFByb3BzXG4gICAgICAgICk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBDb25zdHJ1Y3Rvci5nZXREZWZhdWx0UHJvcHMgPSBnZXREZWZhdWx0UHJvcHM7XG4gICAgICB9XG4gICAgfSxcbiAgICBwcm9wVHlwZXM6IGZ1bmN0aW9uKENvbnN0cnVjdG9yLCBwcm9wVHlwZXMpIHtcbiAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgIHZhbGlkYXRlVHlwZURlZihDb25zdHJ1Y3RvciwgcHJvcFR5cGVzLCAncHJvcCcpO1xuICAgICAgfVxuICAgICAgQ29uc3RydWN0b3IucHJvcFR5cGVzID0gX2Fzc2lnbih7fSwgQ29uc3RydWN0b3IucHJvcFR5cGVzLCBwcm9wVHlwZXMpO1xuICAgIH0sXG4gICAgc3RhdGljczogZnVuY3Rpb24oQ29uc3RydWN0b3IsIHN0YXRpY3MpIHtcbiAgICAgIG1peFN0YXRpY1NwZWNJbnRvQ29tcG9uZW50KENvbnN0cnVjdG9yLCBzdGF0aWNzKTtcbiAgICB9LFxuICAgIGF1dG9iaW5kOiBmdW5jdGlvbigpIHt9XG4gIH07XG5cbiAgZnVuY3Rpb24gdmFsaWRhdGVUeXBlRGVmKENvbnN0cnVjdG9yLCB0eXBlRGVmLCBsb2NhdGlvbikge1xuICAgIGZvciAodmFyIHByb3BOYW1lIGluIHR5cGVEZWYpIHtcbiAgICAgIGlmICh0eXBlRGVmLmhhc093blByb3BlcnR5KHByb3BOYW1lKSkge1xuICAgICAgICAvLyB1c2UgYSB3YXJuaW5nIGluc3RlYWQgb2YgYW4gX2ludmFyaWFudCBzbyBjb21wb25lbnRzXG4gICAgICAgIC8vIGRvbid0IHNob3cgdXAgaW4gcHJvZCBidXQgb25seSBpbiBfX0RFVl9fXG4gICAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgICAgd2FybmluZyhcbiAgICAgICAgICAgIHR5cGVvZiB0eXBlRGVmW3Byb3BOYW1lXSA9PT0gJ2Z1bmN0aW9uJyxcbiAgICAgICAgICAgICclczogJXMgdHlwZSBgJXNgIGlzIGludmFsaWQ7IGl0IG11c3QgYmUgYSBmdW5jdGlvbiwgdXN1YWxseSBmcm9tICcgK1xuICAgICAgICAgICAgICAnUmVhY3QuUHJvcFR5cGVzLicsXG4gICAgICAgICAgICBDb25zdHJ1Y3Rvci5kaXNwbGF5TmFtZSB8fCAnUmVhY3RDbGFzcycsXG4gICAgICAgICAgICBSZWFjdFByb3BUeXBlTG9jYXRpb25OYW1lc1tsb2NhdGlvbl0sXG4gICAgICAgICAgICBwcm9wTmFtZVxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB2YWxpZGF0ZU1ldGhvZE92ZXJyaWRlKGlzQWxyZWFkeURlZmluZWQsIG5hbWUpIHtcbiAgICB2YXIgc3BlY1BvbGljeSA9IFJlYWN0Q2xhc3NJbnRlcmZhY2UuaGFzT3duUHJvcGVydHkobmFtZSlcbiAgICAgID8gUmVhY3RDbGFzc0ludGVyZmFjZVtuYW1lXVxuICAgICAgOiBudWxsO1xuXG4gICAgLy8gRGlzYWxsb3cgb3ZlcnJpZGluZyBvZiBiYXNlIGNsYXNzIG1ldGhvZHMgdW5sZXNzIGV4cGxpY2l0bHkgYWxsb3dlZC5cbiAgICBpZiAoUmVhY3RDbGFzc01peGluLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICBfaW52YXJpYW50KFxuICAgICAgICBzcGVjUG9saWN5ID09PSAnT1ZFUlJJREVfQkFTRScsXG4gICAgICAgICdSZWFjdENsYXNzSW50ZXJmYWNlOiBZb3UgYXJlIGF0dGVtcHRpbmcgdG8gb3ZlcnJpZGUgJyArXG4gICAgICAgICAgJ2Alc2AgZnJvbSB5b3VyIGNsYXNzIHNwZWNpZmljYXRpb24uIEVuc3VyZSB0aGF0IHlvdXIgbWV0aG9kIG5hbWVzICcgK1xuICAgICAgICAgICdkbyBub3Qgb3ZlcmxhcCB3aXRoIFJlYWN0IG1ldGhvZHMuJyxcbiAgICAgICAgbmFtZVxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBEaXNhbGxvdyBkZWZpbmluZyBtZXRob2RzIG1vcmUgdGhhbiBvbmNlIHVubGVzcyBleHBsaWNpdGx5IGFsbG93ZWQuXG4gICAgaWYgKGlzQWxyZWFkeURlZmluZWQpIHtcbiAgICAgIF9pbnZhcmlhbnQoXG4gICAgICAgIHNwZWNQb2xpY3kgPT09ICdERUZJTkVfTUFOWScgfHwgc3BlY1BvbGljeSA9PT0gJ0RFRklORV9NQU5ZX01FUkdFRCcsXG4gICAgICAgICdSZWFjdENsYXNzSW50ZXJmYWNlOiBZb3UgYXJlIGF0dGVtcHRpbmcgdG8gZGVmaW5lICcgK1xuICAgICAgICAgICdgJXNgIG9uIHlvdXIgY29tcG9uZW50IG1vcmUgdGhhbiBvbmNlLiBUaGlzIGNvbmZsaWN0IG1heSBiZSBkdWUgJyArXG4gICAgICAgICAgJ3RvIGEgbWl4aW4uJyxcbiAgICAgICAgbmFtZVxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogTWl4aW4gaGVscGVyIHdoaWNoIGhhbmRsZXMgcG9saWN5IHZhbGlkYXRpb24gYW5kIHJlc2VydmVkXG4gICAqIHNwZWNpZmljYXRpb24ga2V5cyB3aGVuIGJ1aWxkaW5nIFJlYWN0IGNsYXNzZXMuXG4gICAqL1xuICBmdW5jdGlvbiBtaXhTcGVjSW50b0NvbXBvbmVudChDb25zdHJ1Y3Rvciwgc3BlYykge1xuICAgIGlmICghc3BlYykge1xuICAgICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgICAgdmFyIHR5cGVvZlNwZWMgPSB0eXBlb2Ygc3BlYztcbiAgICAgICAgdmFyIGlzTWl4aW5WYWxpZCA9IHR5cGVvZlNwZWMgPT09ICdvYmplY3QnICYmIHNwZWMgIT09IG51bGw7XG5cbiAgICAgICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgICAgICB3YXJuaW5nKFxuICAgICAgICAgICAgaXNNaXhpblZhbGlkLFxuICAgICAgICAgICAgXCIlczogWW91J3JlIGF0dGVtcHRpbmcgdG8gaW5jbHVkZSBhIG1peGluIHRoYXQgaXMgZWl0aGVyIG51bGwgXCIgK1xuICAgICAgICAgICAgICAnb3Igbm90IGFuIG9iamVjdC4gQ2hlY2sgdGhlIG1peGlucyBpbmNsdWRlZCBieSB0aGUgY29tcG9uZW50LCAnICtcbiAgICAgICAgICAgICAgJ2FzIHdlbGwgYXMgYW55IG1peGlucyB0aGV5IGluY2x1ZGUgdGhlbXNlbHZlcy4gJyArXG4gICAgICAgICAgICAgICdFeHBlY3RlZCBvYmplY3QgYnV0IGdvdCAlcy4nLFxuICAgICAgICAgICAgQ29uc3RydWN0b3IuZGlzcGxheU5hbWUgfHwgJ1JlYWN0Q2xhc3MnLFxuICAgICAgICAgICAgc3BlYyA9PT0gbnVsbCA/IG51bGwgOiB0eXBlb2ZTcGVjXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgX2ludmFyaWFudChcbiAgICAgIHR5cGVvZiBzcGVjICE9PSAnZnVuY3Rpb24nLFxuICAgICAgXCJSZWFjdENsYXNzOiBZb3UncmUgYXR0ZW1wdGluZyB0byBcIiArXG4gICAgICAgICd1c2UgYSBjb21wb25lbnQgY2xhc3Mgb3IgZnVuY3Rpb24gYXMgYSBtaXhpbi4gSW5zdGVhZCwganVzdCB1c2UgYSAnICtcbiAgICAgICAgJ3JlZ3VsYXIgb2JqZWN0LidcbiAgICApO1xuICAgIF9pbnZhcmlhbnQoXG4gICAgICAhaXNWYWxpZEVsZW1lbnQoc3BlYyksXG4gICAgICBcIlJlYWN0Q2xhc3M6IFlvdSdyZSBhdHRlbXB0aW5nIHRvIFwiICtcbiAgICAgICAgJ3VzZSBhIGNvbXBvbmVudCBhcyBhIG1peGluLiBJbnN0ZWFkLCBqdXN0IHVzZSBhIHJlZ3VsYXIgb2JqZWN0LidcbiAgICApO1xuXG4gICAgdmFyIHByb3RvID0gQ29uc3RydWN0b3IucHJvdG90eXBlO1xuICAgIHZhciBhdXRvQmluZFBhaXJzID0gcHJvdG8uX19yZWFjdEF1dG9CaW5kUGFpcnM7XG5cbiAgICAvLyBCeSBoYW5kbGluZyBtaXhpbnMgYmVmb3JlIGFueSBvdGhlciBwcm9wZXJ0aWVzLCB3ZSBlbnN1cmUgdGhlIHNhbWVcbiAgICAvLyBjaGFpbmluZyBvcmRlciBpcyBhcHBsaWVkIHRvIG1ldGhvZHMgd2l0aCBERUZJTkVfTUFOWSBwb2xpY3ksIHdoZXRoZXJcbiAgICAvLyBtaXhpbnMgYXJlIGxpc3RlZCBiZWZvcmUgb3IgYWZ0ZXIgdGhlc2UgbWV0aG9kcyBpbiB0aGUgc3BlYy5cbiAgICBpZiAoc3BlYy5oYXNPd25Qcm9wZXJ0eShNSVhJTlNfS0VZKSkge1xuICAgICAgUkVTRVJWRURfU1BFQ19LRVlTLm1peGlucyhDb25zdHJ1Y3Rvciwgc3BlYy5taXhpbnMpO1xuICAgIH1cblxuICAgIGZvciAodmFyIG5hbWUgaW4gc3BlYykge1xuICAgICAgaWYgKCFzcGVjLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAobmFtZSA9PT0gTUlYSU5TX0tFWSkge1xuICAgICAgICAvLyBXZSBoYXZlIGFscmVhZHkgaGFuZGxlZCBtaXhpbnMgaW4gYSBzcGVjaWFsIGNhc2UgYWJvdmUuXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICB2YXIgcHJvcGVydHkgPSBzcGVjW25hbWVdO1xuICAgICAgdmFyIGlzQWxyZWFkeURlZmluZWQgPSBwcm90by5oYXNPd25Qcm9wZXJ0eShuYW1lKTtcbiAgICAgIHZhbGlkYXRlTWV0aG9kT3ZlcnJpZGUoaXNBbHJlYWR5RGVmaW5lZCwgbmFtZSk7XG5cbiAgICAgIGlmIChSRVNFUlZFRF9TUEVDX0tFWVMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgUkVTRVJWRURfU1BFQ19LRVlTW25hbWVdKENvbnN0cnVjdG9yLCBwcm9wZXJ0eSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBTZXR1cCBtZXRob2RzIG9uIHByb3RvdHlwZTpcbiAgICAgICAgLy8gVGhlIGZvbGxvd2luZyBtZW1iZXIgbWV0aG9kcyBzaG91bGQgbm90IGJlIGF1dG9tYXRpY2FsbHkgYm91bmQ6XG4gICAgICAgIC8vIDEuIEV4cGVjdGVkIFJlYWN0Q2xhc3MgbWV0aG9kcyAoaW4gdGhlIFwiaW50ZXJmYWNlXCIpLlxuICAgICAgICAvLyAyLiBPdmVycmlkZGVuIG1ldGhvZHMgKHRoYXQgd2VyZSBtaXhlZCBpbikuXG4gICAgICAgIHZhciBpc1JlYWN0Q2xhc3NNZXRob2QgPSBSZWFjdENsYXNzSW50ZXJmYWNlLmhhc093blByb3BlcnR5KG5hbWUpO1xuICAgICAgICB2YXIgaXNGdW5jdGlvbiA9IHR5cGVvZiBwcm9wZXJ0eSA9PT0gJ2Z1bmN0aW9uJztcbiAgICAgICAgdmFyIHNob3VsZEF1dG9CaW5kID1cbiAgICAgICAgICBpc0Z1bmN0aW9uICYmXG4gICAgICAgICAgIWlzUmVhY3RDbGFzc01ldGhvZCAmJlxuICAgICAgICAgICFpc0FscmVhZHlEZWZpbmVkICYmXG4gICAgICAgICAgc3BlYy5hdXRvYmluZCAhPT0gZmFsc2U7XG5cbiAgICAgICAgaWYgKHNob3VsZEF1dG9CaW5kKSB7XG4gICAgICAgICAgYXV0b0JpbmRQYWlycy5wdXNoKG5hbWUsIHByb3BlcnR5KTtcbiAgICAgICAgICBwcm90b1tuYW1lXSA9IHByb3BlcnR5O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChpc0FscmVhZHlEZWZpbmVkKSB7XG4gICAgICAgICAgICB2YXIgc3BlY1BvbGljeSA9IFJlYWN0Q2xhc3NJbnRlcmZhY2VbbmFtZV07XG5cbiAgICAgICAgICAgIC8vIFRoZXNlIGNhc2VzIHNob3VsZCBhbHJlYWR5IGJlIGNhdWdodCBieSB2YWxpZGF0ZU1ldGhvZE92ZXJyaWRlLlxuICAgICAgICAgICAgX2ludmFyaWFudChcbiAgICAgICAgICAgICAgaXNSZWFjdENsYXNzTWV0aG9kICYmXG4gICAgICAgICAgICAgICAgKHNwZWNQb2xpY3kgPT09ICdERUZJTkVfTUFOWV9NRVJHRUQnIHx8XG4gICAgICAgICAgICAgICAgICBzcGVjUG9saWN5ID09PSAnREVGSU5FX01BTlknKSxcbiAgICAgICAgICAgICAgJ1JlYWN0Q2xhc3M6IFVuZXhwZWN0ZWQgc3BlYyBwb2xpY3kgJXMgZm9yIGtleSAlcyAnICtcbiAgICAgICAgICAgICAgICAnd2hlbiBtaXhpbmcgaW4gY29tcG9uZW50IHNwZWNzLicsXG4gICAgICAgICAgICAgIHNwZWNQb2xpY3ksXG4gICAgICAgICAgICAgIG5hbWVcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIC8vIEZvciBtZXRob2RzIHdoaWNoIGFyZSBkZWZpbmVkIG1vcmUgdGhhbiBvbmNlLCBjYWxsIHRoZSBleGlzdGluZ1xuICAgICAgICAgICAgLy8gbWV0aG9kcyBiZWZvcmUgY2FsbGluZyB0aGUgbmV3IHByb3BlcnR5LCBtZXJnaW5nIGlmIGFwcHJvcHJpYXRlLlxuICAgICAgICAgICAgaWYgKHNwZWNQb2xpY3kgPT09ICdERUZJTkVfTUFOWV9NRVJHRUQnKSB7XG4gICAgICAgICAgICAgIHByb3RvW25hbWVdID0gY3JlYXRlTWVyZ2VkUmVzdWx0RnVuY3Rpb24ocHJvdG9bbmFtZV0sIHByb3BlcnR5KTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc3BlY1BvbGljeSA9PT0gJ0RFRklORV9NQU5ZJykge1xuICAgICAgICAgICAgICBwcm90b1tuYW1lXSA9IGNyZWF0ZUNoYWluZWRGdW5jdGlvbihwcm90b1tuYW1lXSwgcHJvcGVydHkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwcm90b1tuYW1lXSA9IHByb3BlcnR5O1xuICAgICAgICAgICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgICAgICAgICAgLy8gQWRkIHZlcmJvc2UgZGlzcGxheU5hbWUgdG8gdGhlIGZ1bmN0aW9uLCB3aGljaCBoZWxwcyB3aGVuIGxvb2tpbmdcbiAgICAgICAgICAgICAgLy8gYXQgcHJvZmlsaW5nIHRvb2xzLlxuICAgICAgICAgICAgICBpZiAodHlwZW9mIHByb3BlcnR5ID09PSAnZnVuY3Rpb24nICYmIHNwZWMuZGlzcGxheU5hbWUpIHtcbiAgICAgICAgICAgICAgICBwcm90b1tuYW1lXS5kaXNwbGF5TmFtZSA9IHNwZWMuZGlzcGxheU5hbWUgKyAnXycgKyBuYW1lO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gbWl4U3RhdGljU3BlY0ludG9Db21wb25lbnQoQ29uc3RydWN0b3IsIHN0YXRpY3MpIHtcbiAgICBpZiAoIXN0YXRpY3MpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZm9yICh2YXIgbmFtZSBpbiBzdGF0aWNzKSB7XG4gICAgICB2YXIgcHJvcGVydHkgPSBzdGF0aWNzW25hbWVdO1xuICAgICAgaWYgKCFzdGF0aWNzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICB2YXIgaXNSZXNlcnZlZCA9IG5hbWUgaW4gUkVTRVJWRURfU1BFQ19LRVlTO1xuICAgICAgX2ludmFyaWFudChcbiAgICAgICAgIWlzUmVzZXJ2ZWQsXG4gICAgICAgICdSZWFjdENsYXNzOiBZb3UgYXJlIGF0dGVtcHRpbmcgdG8gZGVmaW5lIGEgcmVzZXJ2ZWQgJyArXG4gICAgICAgICAgJ3Byb3BlcnR5LCBgJXNgLCB0aGF0IHNob3VsZG5cXCd0IGJlIG9uIHRoZSBcInN0YXRpY3NcIiBrZXkuIERlZmluZSBpdCAnICtcbiAgICAgICAgICAnYXMgYW4gaW5zdGFuY2UgcHJvcGVydHkgaW5zdGVhZDsgaXQgd2lsbCBzdGlsbCBiZSBhY2Nlc3NpYmxlIG9uIHRoZSAnICtcbiAgICAgICAgICAnY29uc3RydWN0b3IuJyxcbiAgICAgICAgbmFtZVxuICAgICAgKTtcblxuICAgICAgdmFyIGlzSW5oZXJpdGVkID0gbmFtZSBpbiBDb25zdHJ1Y3RvcjtcbiAgICAgIF9pbnZhcmlhbnQoXG4gICAgICAgICFpc0luaGVyaXRlZCxcbiAgICAgICAgJ1JlYWN0Q2xhc3M6IFlvdSBhcmUgYXR0ZW1wdGluZyB0byBkZWZpbmUgJyArXG4gICAgICAgICAgJ2Alc2Agb24geW91ciBjb21wb25lbnQgbW9yZSB0aGFuIG9uY2UuIFRoaXMgY29uZmxpY3QgbWF5IGJlICcgK1xuICAgICAgICAgICdkdWUgdG8gYSBtaXhpbi4nLFxuICAgICAgICBuYW1lXG4gICAgICApO1xuICAgICAgQ29uc3RydWN0b3JbbmFtZV0gPSBwcm9wZXJ0eTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogTWVyZ2UgdHdvIG9iamVjdHMsIGJ1dCB0aHJvdyBpZiBib3RoIGNvbnRhaW4gdGhlIHNhbWUga2V5LlxuICAgKlxuICAgKiBAcGFyYW0ge29iamVjdH0gb25lIFRoZSBmaXJzdCBvYmplY3QsIHdoaWNoIGlzIG11dGF0ZWQuXG4gICAqIEBwYXJhbSB7b2JqZWN0fSB0d28gVGhlIHNlY29uZCBvYmplY3RcbiAgICogQHJldHVybiB7b2JqZWN0fSBvbmUgYWZ0ZXIgaXQgaGFzIGJlZW4gbXV0YXRlZCB0byBjb250YWluIGV2ZXJ5dGhpbmcgaW4gdHdvLlxuICAgKi9cbiAgZnVuY3Rpb24gbWVyZ2VJbnRvV2l0aE5vRHVwbGljYXRlS2V5cyhvbmUsIHR3bykge1xuICAgIF9pbnZhcmlhbnQoXG4gICAgICBvbmUgJiYgdHdvICYmIHR5cGVvZiBvbmUgPT09ICdvYmplY3QnICYmIHR5cGVvZiB0d28gPT09ICdvYmplY3QnLFxuICAgICAgJ21lcmdlSW50b1dpdGhOb0R1cGxpY2F0ZUtleXMoKTogQ2Fubm90IG1lcmdlIG5vbi1vYmplY3RzLidcbiAgICApO1xuXG4gICAgZm9yICh2YXIga2V5IGluIHR3bykge1xuICAgICAgaWYgKHR3by5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgIF9pbnZhcmlhbnQoXG4gICAgICAgICAgb25lW2tleV0gPT09IHVuZGVmaW5lZCxcbiAgICAgICAgICAnbWVyZ2VJbnRvV2l0aE5vRHVwbGljYXRlS2V5cygpOiAnICtcbiAgICAgICAgICAgICdUcmllZCB0byBtZXJnZSB0d28gb2JqZWN0cyB3aXRoIHRoZSBzYW1lIGtleTogYCVzYC4gVGhpcyBjb25mbGljdCAnICtcbiAgICAgICAgICAgICdtYXkgYmUgZHVlIHRvIGEgbWl4aW47IGluIHBhcnRpY3VsYXIsIHRoaXMgbWF5IGJlIGNhdXNlZCBieSB0d28gJyArXG4gICAgICAgICAgICAnZ2V0SW5pdGlhbFN0YXRlKCkgb3IgZ2V0RGVmYXVsdFByb3BzKCkgbWV0aG9kcyByZXR1cm5pbmcgb2JqZWN0cyAnICtcbiAgICAgICAgICAgICd3aXRoIGNsYXNoaW5nIGtleXMuJyxcbiAgICAgICAgICBrZXlcbiAgICAgICAgKTtcbiAgICAgICAgb25lW2tleV0gPSB0d29ba2V5XTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9uZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCBpbnZva2VzIHR3byBmdW5jdGlvbnMgYW5kIG1lcmdlcyB0aGVpciByZXR1cm4gdmFsdWVzLlxuICAgKlxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBvbmUgRnVuY3Rpb24gdG8gaW52b2tlIGZpcnN0LlxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSB0d28gRnVuY3Rpb24gdG8gaW52b2tlIHNlY29uZC5cbiAgICogQHJldHVybiB7ZnVuY3Rpb259IEZ1bmN0aW9uIHRoYXQgaW52b2tlcyB0aGUgdHdvIGFyZ3VtZW50IGZ1bmN0aW9ucy5cbiAgICogQHByaXZhdGVcbiAgICovXG4gIGZ1bmN0aW9uIGNyZWF0ZU1lcmdlZFJlc3VsdEZ1bmN0aW9uKG9uZSwgdHdvKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIG1lcmdlZFJlc3VsdCgpIHtcbiAgICAgIHZhciBhID0gb25lLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICB2YXIgYiA9IHR3by5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgaWYgKGEgPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gYjtcbiAgICAgIH0gZWxzZSBpZiAoYiA9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBhO1xuICAgICAgfVxuICAgICAgdmFyIGMgPSB7fTtcbiAgICAgIG1lcmdlSW50b1dpdGhOb0R1cGxpY2F0ZUtleXMoYywgYSk7XG4gICAgICBtZXJnZUludG9XaXRoTm9EdXBsaWNhdGVLZXlzKGMsIGIpO1xuICAgICAgcmV0dXJuIGM7XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCBpbnZva2VzIHR3byBmdW5jdGlvbnMgYW5kIGlnbm9yZXMgdGhlaXIgcmV0dXJuIHZhbGVzLlxuICAgKlxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBvbmUgRnVuY3Rpb24gdG8gaW52b2tlIGZpcnN0LlxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSB0d28gRnVuY3Rpb24gdG8gaW52b2tlIHNlY29uZC5cbiAgICogQHJldHVybiB7ZnVuY3Rpb259IEZ1bmN0aW9uIHRoYXQgaW52b2tlcyB0aGUgdHdvIGFyZ3VtZW50IGZ1bmN0aW9ucy5cbiAgICogQHByaXZhdGVcbiAgICovXG4gIGZ1bmN0aW9uIGNyZWF0ZUNoYWluZWRGdW5jdGlvbihvbmUsIHR3bykge1xuICAgIHJldHVybiBmdW5jdGlvbiBjaGFpbmVkRnVuY3Rpb24oKSB7XG4gICAgICBvbmUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgIHR3by5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQmluZHMgYSBtZXRob2QgdG8gdGhlIGNvbXBvbmVudC5cbiAgICpcbiAgICogQHBhcmFtIHtvYmplY3R9IGNvbXBvbmVudCBDb21wb25lbnQgd2hvc2UgbWV0aG9kIGlzIGdvaW5nIHRvIGJlIGJvdW5kLlxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBtZXRob2QgTWV0aG9kIHRvIGJlIGJvdW5kLlxuICAgKiBAcmV0dXJuIHtmdW5jdGlvbn0gVGhlIGJvdW5kIG1ldGhvZC5cbiAgICovXG4gIGZ1bmN0aW9uIGJpbmRBdXRvQmluZE1ldGhvZChjb21wb25lbnQsIG1ldGhvZCkge1xuICAgIHZhciBib3VuZE1ldGhvZCA9IG1ldGhvZC5iaW5kKGNvbXBvbmVudCk7XG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgIGJvdW5kTWV0aG9kLl9fcmVhY3RCb3VuZENvbnRleHQgPSBjb21wb25lbnQ7XG4gICAgICBib3VuZE1ldGhvZC5fX3JlYWN0Qm91bmRNZXRob2QgPSBtZXRob2Q7XG4gICAgICBib3VuZE1ldGhvZC5fX3JlYWN0Qm91bmRBcmd1bWVudHMgPSBudWxsO1xuICAgICAgdmFyIGNvbXBvbmVudE5hbWUgPSBjb21wb25lbnQuY29uc3RydWN0b3IuZGlzcGxheU5hbWU7XG4gICAgICB2YXIgX2JpbmQgPSBib3VuZE1ldGhvZC5iaW5kO1xuICAgICAgYm91bmRNZXRob2QuYmluZCA9IGZ1bmN0aW9uKG5ld1RoaXMpIHtcbiAgICAgICAgZm9yIChcbiAgICAgICAgICB2YXIgX2xlbiA9IGFyZ3VtZW50cy5sZW5ndGgsXG4gICAgICAgICAgICBhcmdzID0gQXJyYXkoX2xlbiA+IDEgPyBfbGVuIC0gMSA6IDApLFxuICAgICAgICAgICAgX2tleSA9IDE7XG4gICAgICAgICAgX2tleSA8IF9sZW47XG4gICAgICAgICAgX2tleSsrXG4gICAgICAgICkge1xuICAgICAgICAgIGFyZ3NbX2tleSAtIDFdID0gYXJndW1lbnRzW19rZXldO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXNlciBpcyB0cnlpbmcgdG8gYmluZCgpIGFuIGF1dG9ib3VuZCBtZXRob2Q7IHdlIGVmZmVjdGl2ZWx5IHdpbGxcbiAgICAgICAgLy8gaWdub3JlIHRoZSB2YWx1ZSBvZiBcInRoaXNcIiB0aGF0IHRoZSB1c2VyIGlzIHRyeWluZyB0byB1c2UsIHNvXG4gICAgICAgIC8vIGxldCdzIHdhcm4uXG4gICAgICAgIGlmIChuZXdUaGlzICE9PSBjb21wb25lbnQgJiYgbmV3VGhpcyAhPT0gbnVsbCkge1xuICAgICAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgICAgICB3YXJuaW5nKFxuICAgICAgICAgICAgICBmYWxzZSxcbiAgICAgICAgICAgICAgJ2JpbmQoKTogUmVhY3QgY29tcG9uZW50IG1ldGhvZHMgbWF5IG9ubHkgYmUgYm91bmQgdG8gdGhlICcgK1xuICAgICAgICAgICAgICAgICdjb21wb25lbnQgaW5zdGFuY2UuIFNlZSAlcycsXG4gICAgICAgICAgICAgIGNvbXBvbmVudE5hbWVcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKCFhcmdzLmxlbmd0aCkge1xuICAgICAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgICAgICB3YXJuaW5nKFxuICAgICAgICAgICAgICBmYWxzZSxcbiAgICAgICAgICAgICAgJ2JpbmQoKTogWW91IGFyZSBiaW5kaW5nIGEgY29tcG9uZW50IG1ldGhvZCB0byB0aGUgY29tcG9uZW50LiAnICtcbiAgICAgICAgICAgICAgICAnUmVhY3QgZG9lcyB0aGlzIGZvciB5b3UgYXV0b21hdGljYWxseSBpbiBhIGhpZ2gtcGVyZm9ybWFuY2UgJyArXG4gICAgICAgICAgICAgICAgJ3dheSwgc28geW91IGNhbiBzYWZlbHkgcmVtb3ZlIHRoaXMgY2FsbC4gU2VlICVzJyxcbiAgICAgICAgICAgICAgY29tcG9uZW50TmFtZVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGJvdW5kTWV0aG9kO1xuICAgICAgICB9XG4gICAgICAgIHZhciByZWJvdW5kTWV0aG9kID0gX2JpbmQuYXBwbHkoYm91bmRNZXRob2QsIGFyZ3VtZW50cyk7XG4gICAgICAgIHJlYm91bmRNZXRob2QuX19yZWFjdEJvdW5kQ29udGV4dCA9IGNvbXBvbmVudDtcbiAgICAgICAgcmVib3VuZE1ldGhvZC5fX3JlYWN0Qm91bmRNZXRob2QgPSBtZXRob2Q7XG4gICAgICAgIHJlYm91bmRNZXRob2QuX19yZWFjdEJvdW5kQXJndW1lbnRzID0gYXJncztcbiAgICAgICAgcmV0dXJuIHJlYm91bmRNZXRob2Q7XG4gICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4gYm91bmRNZXRob2Q7XG4gIH1cblxuICAvKipcbiAgICogQmluZHMgYWxsIGF1dG8tYm91bmQgbWV0aG9kcyBpbiBhIGNvbXBvbmVudC5cbiAgICpcbiAgICogQHBhcmFtIHtvYmplY3R9IGNvbXBvbmVudCBDb21wb25lbnQgd2hvc2UgbWV0aG9kIGlzIGdvaW5nIHRvIGJlIGJvdW5kLlxuICAgKi9cbiAgZnVuY3Rpb24gYmluZEF1dG9CaW5kTWV0aG9kcyhjb21wb25lbnQpIHtcbiAgICB2YXIgcGFpcnMgPSBjb21wb25lbnQuX19yZWFjdEF1dG9CaW5kUGFpcnM7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwYWlycy5sZW5ndGg7IGkgKz0gMikge1xuICAgICAgdmFyIGF1dG9CaW5kS2V5ID0gcGFpcnNbaV07XG4gICAgICB2YXIgbWV0aG9kID0gcGFpcnNbaSArIDFdO1xuICAgICAgY29tcG9uZW50W2F1dG9CaW5kS2V5XSA9IGJpbmRBdXRvQmluZE1ldGhvZChjb21wb25lbnQsIG1ldGhvZCk7XG4gICAgfVxuICB9XG5cbiAgdmFyIElzTW91bnRlZFByZU1peGluID0ge1xuICAgIGNvbXBvbmVudERpZE1vdW50OiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuX19pc01vdW50ZWQgPSB0cnVlO1xuICAgIH1cbiAgfTtcblxuICB2YXIgSXNNb3VudGVkUG9zdE1peGluID0ge1xuICAgIGNvbXBvbmVudFdpbGxVbm1vdW50OiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuX19pc01vdW50ZWQgPSBmYWxzZTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIEFkZCBtb3JlIHRvIHRoZSBSZWFjdENsYXNzIGJhc2UgY2xhc3MuIFRoZXNlIGFyZSBhbGwgbGVnYWN5IGZlYXR1cmVzIGFuZFxuICAgKiB0aGVyZWZvcmUgbm90IGFscmVhZHkgcGFydCBvZiB0aGUgbW9kZXJuIFJlYWN0Q29tcG9uZW50LlxuICAgKi9cbiAgdmFyIFJlYWN0Q2xhc3NNaXhpbiA9IHtcbiAgICAvKipcbiAgICAgKiBUT0RPOiBUaGlzIHdpbGwgYmUgZGVwcmVjYXRlZCBiZWNhdXNlIHN0YXRlIHNob3VsZCBhbHdheXMga2VlcCBhIGNvbnNpc3RlbnRcbiAgICAgKiB0eXBlIHNpZ25hdHVyZSBhbmQgdGhlIG9ubHkgdXNlIGNhc2UgZm9yIHRoaXMsIGlzIHRvIGF2b2lkIHRoYXQuXG4gICAgICovXG4gICAgcmVwbGFjZVN0YXRlOiBmdW5jdGlvbihuZXdTdGF0ZSwgY2FsbGJhY2spIHtcbiAgICAgIHRoaXMudXBkYXRlci5lbnF1ZXVlUmVwbGFjZVN0YXRlKHRoaXMsIG5ld1N0YXRlLCBjYWxsYmFjayk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENoZWNrcyB3aGV0aGVyIG9yIG5vdCB0aGlzIGNvbXBvc2l0ZSBjb21wb25lbnQgaXMgbW91bnRlZC5cbiAgICAgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIGlmIG1vdW50ZWQsIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAcHJvdGVjdGVkXG4gICAgICogQGZpbmFsXG4gICAgICovXG4gICAgaXNNb3VudGVkOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgIHdhcm5pbmcoXG4gICAgICAgICAgdGhpcy5fX2RpZFdhcm5Jc01vdW50ZWQsXG4gICAgICAgICAgJyVzOiBpc01vdW50ZWQgaXMgZGVwcmVjYXRlZC4gSW5zdGVhZCwgbWFrZSBzdXJlIHRvIGNsZWFuIHVwICcgK1xuICAgICAgICAgICAgJ3N1YnNjcmlwdGlvbnMgYW5kIHBlbmRpbmcgcmVxdWVzdHMgaW4gY29tcG9uZW50V2lsbFVubW91bnQgdG8gJyArXG4gICAgICAgICAgICAncHJldmVudCBtZW1vcnkgbGVha3MuJyxcbiAgICAgICAgICAodGhpcy5jb25zdHJ1Y3RvciAmJiB0aGlzLmNvbnN0cnVjdG9yLmRpc3BsYXlOYW1lKSB8fFxuICAgICAgICAgICAgdGhpcy5uYW1lIHx8XG4gICAgICAgICAgICAnQ29tcG9uZW50J1xuICAgICAgICApO1xuICAgICAgICB0aGlzLl9fZGlkV2FybklzTW91bnRlZCA9IHRydWU7XG4gICAgICB9XG4gICAgICByZXR1cm4gISF0aGlzLl9faXNNb3VudGVkO1xuICAgIH1cbiAgfTtcblxuICB2YXIgUmVhY3RDbGFzc0NvbXBvbmVudCA9IGZ1bmN0aW9uKCkge307XG4gIF9hc3NpZ24oXG4gICAgUmVhY3RDbGFzc0NvbXBvbmVudC5wcm90b3R5cGUsXG4gICAgUmVhY3RDb21wb25lbnQucHJvdG90eXBlLFxuICAgIFJlYWN0Q2xhc3NNaXhpblxuICApO1xuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgY29tcG9zaXRlIGNvbXBvbmVudCBjbGFzcyBnaXZlbiBhIGNsYXNzIHNwZWNpZmljYXRpb24uXG4gICAqIFNlZSBodHRwczovL2ZhY2Vib29rLmdpdGh1Yi5pby9yZWFjdC9kb2NzL3RvcC1sZXZlbC1hcGkuaHRtbCNyZWFjdC5jcmVhdGVjbGFzc1xuICAgKlxuICAgKiBAcGFyYW0ge29iamVjdH0gc3BlYyBDbGFzcyBzcGVjaWZpY2F0aW9uICh3aGljaCBtdXN0IGRlZmluZSBgcmVuZGVyYCkuXG4gICAqIEByZXR1cm4ge2Z1bmN0aW9ufSBDb21wb25lbnQgY29uc3RydWN0b3IgZnVuY3Rpb24uXG4gICAqIEBwdWJsaWNcbiAgICovXG4gIGZ1bmN0aW9uIGNyZWF0ZUNsYXNzKHNwZWMpIHtcbiAgICAvLyBUbyBrZWVwIG91ciB3YXJuaW5ncyBtb3JlIHVuZGVyc3RhbmRhYmxlLCB3ZSdsbCB1c2UgYSBsaXR0bGUgaGFjayBoZXJlIHRvXG4gICAgLy8gZW5zdXJlIHRoYXQgQ29uc3RydWN0b3IubmFtZSAhPT0gJ0NvbnN0cnVjdG9yJy4gVGhpcyBtYWtlcyBzdXJlIHdlIGRvbid0XG4gICAgLy8gdW5uZWNlc3NhcmlseSBpZGVudGlmeSBhIGNsYXNzIHdpdGhvdXQgZGlzcGxheU5hbWUgYXMgJ0NvbnN0cnVjdG9yJy5cbiAgICB2YXIgQ29uc3RydWN0b3IgPSBpZGVudGl0eShmdW5jdGlvbihwcm9wcywgY29udGV4dCwgdXBkYXRlcikge1xuICAgICAgLy8gVGhpcyBjb25zdHJ1Y3RvciBnZXRzIG92ZXJyaWRkZW4gYnkgbW9ja3MuIFRoZSBhcmd1bWVudCBpcyB1c2VkXG4gICAgICAvLyBieSBtb2NrcyB0byBhc3NlcnQgb24gd2hhdCBnZXRzIG1vdW50ZWQuXG5cbiAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgIHdhcm5pbmcoXG4gICAgICAgICAgdGhpcyBpbnN0YW5jZW9mIENvbnN0cnVjdG9yLFxuICAgICAgICAgICdTb21ldGhpbmcgaXMgY2FsbGluZyBhIFJlYWN0IGNvbXBvbmVudCBkaXJlY3RseS4gVXNlIGEgZmFjdG9yeSBvciAnICtcbiAgICAgICAgICAgICdKU1ggaW5zdGVhZC4gU2VlOiBodHRwczovL2ZiLm1lL3JlYWN0LWxlZ2FjeWZhY3RvcnknXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIC8vIFdpcmUgdXAgYXV0by1iaW5kaW5nXG4gICAgICBpZiAodGhpcy5fX3JlYWN0QXV0b0JpbmRQYWlycy5sZW5ndGgpIHtcbiAgICAgICAgYmluZEF1dG9CaW5kTWV0aG9kcyh0aGlzKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5wcm9wcyA9IHByb3BzO1xuICAgICAgdGhpcy5jb250ZXh0ID0gY29udGV4dDtcbiAgICAgIHRoaXMucmVmcyA9IGVtcHR5T2JqZWN0O1xuICAgICAgdGhpcy51cGRhdGVyID0gdXBkYXRlciB8fCBSZWFjdE5vb3BVcGRhdGVRdWV1ZTtcblxuICAgICAgdGhpcy5zdGF0ZSA9IG51bGw7XG5cbiAgICAgIC8vIFJlYWN0Q2xhc3NlcyBkb2Vzbid0IGhhdmUgY29uc3RydWN0b3JzLiBJbnN0ZWFkLCB0aGV5IHVzZSB0aGVcbiAgICAgIC8vIGdldEluaXRpYWxTdGF0ZSBhbmQgY29tcG9uZW50V2lsbE1vdW50IG1ldGhvZHMgZm9yIGluaXRpYWxpemF0aW9uLlxuXG4gICAgICB2YXIgaW5pdGlhbFN0YXRlID0gdGhpcy5nZXRJbml0aWFsU3RhdGUgPyB0aGlzLmdldEluaXRpYWxTdGF0ZSgpIDogbnVsbDtcbiAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgIC8vIFdlIGFsbG93IGF1dG8tbW9ja3MgdG8gcHJvY2VlZCBhcyBpZiB0aGV5J3JlIHJldHVybmluZyBudWxsLlxuICAgICAgICBpZiAoXG4gICAgICAgICAgaW5pdGlhbFN0YXRlID09PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICB0aGlzLmdldEluaXRpYWxTdGF0ZS5faXNNb2NrRnVuY3Rpb25cbiAgICAgICAgKSB7XG4gICAgICAgICAgLy8gVGhpcyBpcyBwcm9iYWJseSBiYWQgcHJhY3RpY2UuIENvbnNpZGVyIHdhcm5pbmcgaGVyZSBhbmRcbiAgICAgICAgICAvLyBkZXByZWNhdGluZyB0aGlzIGNvbnZlbmllbmNlLlxuICAgICAgICAgIGluaXRpYWxTdGF0ZSA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIF9pbnZhcmlhbnQoXG4gICAgICAgIHR5cGVvZiBpbml0aWFsU3RhdGUgPT09ICdvYmplY3QnICYmICFBcnJheS5pc0FycmF5KGluaXRpYWxTdGF0ZSksXG4gICAgICAgICclcy5nZXRJbml0aWFsU3RhdGUoKTogbXVzdCByZXR1cm4gYW4gb2JqZWN0IG9yIG51bGwnLFxuICAgICAgICBDb25zdHJ1Y3Rvci5kaXNwbGF5TmFtZSB8fCAnUmVhY3RDb21wb3NpdGVDb21wb25lbnQnXG4gICAgICApO1xuXG4gICAgICB0aGlzLnN0YXRlID0gaW5pdGlhbFN0YXRlO1xuICAgIH0pO1xuICAgIENvbnN0cnVjdG9yLnByb3RvdHlwZSA9IG5ldyBSZWFjdENsYXNzQ29tcG9uZW50KCk7XG4gICAgQ29uc3RydWN0b3IucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gQ29uc3RydWN0b3I7XG4gICAgQ29uc3RydWN0b3IucHJvdG90eXBlLl9fcmVhY3RBdXRvQmluZFBhaXJzID0gW107XG5cbiAgICBpbmplY3RlZE1peGlucy5mb3JFYWNoKG1peFNwZWNJbnRvQ29tcG9uZW50LmJpbmQobnVsbCwgQ29uc3RydWN0b3IpKTtcblxuICAgIG1peFNwZWNJbnRvQ29tcG9uZW50KENvbnN0cnVjdG9yLCBJc01vdW50ZWRQcmVNaXhpbik7XG4gICAgbWl4U3BlY0ludG9Db21wb25lbnQoQ29uc3RydWN0b3IsIHNwZWMpO1xuICAgIG1peFNwZWNJbnRvQ29tcG9uZW50KENvbnN0cnVjdG9yLCBJc01vdW50ZWRQb3N0TWl4aW4pO1xuXG4gICAgLy8gSW5pdGlhbGl6ZSB0aGUgZGVmYXVsdFByb3BzIHByb3BlcnR5IGFmdGVyIGFsbCBtaXhpbnMgaGF2ZSBiZWVuIG1lcmdlZC5cbiAgICBpZiAoQ29uc3RydWN0b3IuZ2V0RGVmYXVsdFByb3BzKSB7XG4gICAgICBDb25zdHJ1Y3Rvci5kZWZhdWx0UHJvcHMgPSBDb25zdHJ1Y3Rvci5nZXREZWZhdWx0UHJvcHMoKTtcbiAgICB9XG5cbiAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgLy8gVGhpcyBpcyBhIHRhZyB0byBpbmRpY2F0ZSB0aGF0IHRoZSB1c2Ugb2YgdGhlc2UgbWV0aG9kIG5hbWVzIGlzIG9rLFxuICAgICAgLy8gc2luY2UgaXQncyB1c2VkIHdpdGggY3JlYXRlQ2xhc3MuIElmIGl0J3Mgbm90LCB0aGVuIGl0J3MgbGlrZWx5IGFcbiAgICAgIC8vIG1pc3Rha2Ugc28gd2UnbGwgd2FybiB5b3UgdG8gdXNlIHRoZSBzdGF0aWMgcHJvcGVydHksIHByb3BlcnR5XG4gICAgICAvLyBpbml0aWFsaXplciBvciBjb25zdHJ1Y3RvciByZXNwZWN0aXZlbHkuXG4gICAgICBpZiAoQ29uc3RydWN0b3IuZ2V0RGVmYXVsdFByb3BzKSB7XG4gICAgICAgIENvbnN0cnVjdG9yLmdldERlZmF1bHRQcm9wcy5pc1JlYWN0Q2xhc3NBcHByb3ZlZCA9IHt9O1xuICAgICAgfVxuICAgICAgaWYgKENvbnN0cnVjdG9yLnByb3RvdHlwZS5nZXRJbml0aWFsU3RhdGUpIHtcbiAgICAgICAgQ29uc3RydWN0b3IucHJvdG90eXBlLmdldEluaXRpYWxTdGF0ZS5pc1JlYWN0Q2xhc3NBcHByb3ZlZCA9IHt9O1xuICAgICAgfVxuICAgIH1cblxuICAgIF9pbnZhcmlhbnQoXG4gICAgICBDb25zdHJ1Y3Rvci5wcm90b3R5cGUucmVuZGVyLFxuICAgICAgJ2NyZWF0ZUNsYXNzKC4uLik6IENsYXNzIHNwZWNpZmljYXRpb24gbXVzdCBpbXBsZW1lbnQgYSBgcmVuZGVyYCBtZXRob2QuJ1xuICAgICk7XG5cbiAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgd2FybmluZyhcbiAgICAgICAgIUNvbnN0cnVjdG9yLnByb3RvdHlwZS5jb21wb25lbnRTaG91bGRVcGRhdGUsXG4gICAgICAgICclcyBoYXMgYSBtZXRob2QgY2FsbGVkICcgK1xuICAgICAgICAgICdjb21wb25lbnRTaG91bGRVcGRhdGUoKS4gRGlkIHlvdSBtZWFuIHNob3VsZENvbXBvbmVudFVwZGF0ZSgpPyAnICtcbiAgICAgICAgICAnVGhlIG5hbWUgaXMgcGhyYXNlZCBhcyBhIHF1ZXN0aW9uIGJlY2F1c2UgdGhlIGZ1bmN0aW9uIGlzICcgK1xuICAgICAgICAgICdleHBlY3RlZCB0byByZXR1cm4gYSB2YWx1ZS4nLFxuICAgICAgICBzcGVjLmRpc3BsYXlOYW1lIHx8ICdBIGNvbXBvbmVudCdcbiAgICAgICk7XG4gICAgICB3YXJuaW5nKFxuICAgICAgICAhQ29uc3RydWN0b3IucHJvdG90eXBlLmNvbXBvbmVudFdpbGxSZWNpZXZlUHJvcHMsXG4gICAgICAgICclcyBoYXMgYSBtZXRob2QgY2FsbGVkICcgK1xuICAgICAgICAgICdjb21wb25lbnRXaWxsUmVjaWV2ZVByb3BzKCkuIERpZCB5b3UgbWVhbiBjb21wb25lbnRXaWxsUmVjZWl2ZVByb3BzKCk/JyxcbiAgICAgICAgc3BlYy5kaXNwbGF5TmFtZSB8fCAnQSBjb21wb25lbnQnXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIFJlZHVjZSB0aW1lIHNwZW50IGRvaW5nIGxvb2t1cHMgYnkgc2V0dGluZyB0aGVzZSBvbiB0aGUgcHJvdG90eXBlLlxuICAgIGZvciAodmFyIG1ldGhvZE5hbWUgaW4gUmVhY3RDbGFzc0ludGVyZmFjZSkge1xuICAgICAgaWYgKCFDb25zdHJ1Y3Rvci5wcm90b3R5cGVbbWV0aG9kTmFtZV0pIHtcbiAgICAgICAgQ29uc3RydWN0b3IucHJvdG90eXBlW21ldGhvZE5hbWVdID0gbnVsbDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gQ29uc3RydWN0b3I7XG4gIH1cblxuICByZXR1cm4gY3JlYXRlQ2xhc3M7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZmFjdG9yeTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG4vKipcbiAqIENvcHlyaWdodCAoYykgMjAxMy1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICogXG4gKi9cblxuZnVuY3Rpb24gbWFrZUVtcHR5RnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIGFyZztcbiAgfTtcbn1cblxuLyoqXG4gKiBUaGlzIGZ1bmN0aW9uIGFjY2VwdHMgYW5kIGRpc2NhcmRzIGlucHV0czsgaXQgaGFzIG5vIHNpZGUgZWZmZWN0cy4gVGhpcyBpc1xuICogcHJpbWFyaWx5IHVzZWZ1bCBpZGlvbWF0aWNhbGx5IGZvciBvdmVycmlkYWJsZSBmdW5jdGlvbiBlbmRwb2ludHMgd2hpY2hcbiAqIGFsd2F5cyBuZWVkIHRvIGJlIGNhbGxhYmxlLCBzaW5jZSBKUyBsYWNrcyBhIG51bGwtY2FsbCBpZGlvbSBhbGEgQ29jb2EuXG4gKi9cbnZhciBlbXB0eUZ1bmN0aW9uID0gZnVuY3Rpb24gZW1wdHlGdW5jdGlvbigpIHt9O1xuXG5lbXB0eUZ1bmN0aW9uLnRoYXRSZXR1cm5zID0gbWFrZUVtcHR5RnVuY3Rpb247XG5lbXB0eUZ1bmN0aW9uLnRoYXRSZXR1cm5zRmFsc2UgPSBtYWtlRW1wdHlGdW5jdGlvbihmYWxzZSk7XG5lbXB0eUZ1bmN0aW9uLnRoYXRSZXR1cm5zVHJ1ZSA9IG1ha2VFbXB0eUZ1bmN0aW9uKHRydWUpO1xuZW1wdHlGdW5jdGlvbi50aGF0UmV0dXJuc051bGwgPSBtYWtlRW1wdHlGdW5jdGlvbihudWxsKTtcbmVtcHR5RnVuY3Rpb24udGhhdFJldHVybnNUaGlzID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcztcbn07XG5lbXB0eUZ1bmN0aW9uLnRoYXRSZXR1cm5zQXJndW1lbnQgPSBmdW5jdGlvbiAoYXJnKSB7XG4gIHJldHVybiBhcmc7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGVtcHR5RnVuY3Rpb247IiwiLyoqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTMtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICpcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBlbXB0eU9iamVjdCA9IHt9O1xuXG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICBPYmplY3QuZnJlZXplKGVtcHR5T2JqZWN0KTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBlbXB0eU9iamVjdDsiLCIvKipcbiAqIENvcHlyaWdodCAoYykgMjAxMy1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBVc2UgaW52YXJpYW50KCkgdG8gYXNzZXJ0IHN0YXRlIHdoaWNoIHlvdXIgcHJvZ3JhbSBhc3N1bWVzIHRvIGJlIHRydWUuXG4gKlxuICogUHJvdmlkZSBzcHJpbnRmLXN0eWxlIGZvcm1hdCAob25seSAlcyBpcyBzdXBwb3J0ZWQpIGFuZCBhcmd1bWVudHNcbiAqIHRvIHByb3ZpZGUgaW5mb3JtYXRpb24gYWJvdXQgd2hhdCBicm9rZSBhbmQgd2hhdCB5b3Ugd2VyZVxuICogZXhwZWN0aW5nLlxuICpcbiAqIFRoZSBpbnZhcmlhbnQgbWVzc2FnZSB3aWxsIGJlIHN0cmlwcGVkIGluIHByb2R1Y3Rpb24sIGJ1dCB0aGUgaW52YXJpYW50XG4gKiB3aWxsIHJlbWFpbiB0byBlbnN1cmUgbG9naWMgZG9lcyBub3QgZGlmZmVyIGluIHByb2R1Y3Rpb24uXG4gKi9cblxudmFyIHZhbGlkYXRlRm9ybWF0ID0gZnVuY3Rpb24gdmFsaWRhdGVGb3JtYXQoZm9ybWF0KSB7fTtcblxuaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgdmFsaWRhdGVGb3JtYXQgPSBmdW5jdGlvbiB2YWxpZGF0ZUZvcm1hdChmb3JtYXQpIHtcbiAgICBpZiAoZm9ybWF0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignaW52YXJpYW50IHJlcXVpcmVzIGFuIGVycm9yIG1lc3NhZ2UgYXJndW1lbnQnKTtcbiAgICB9XG4gIH07XG59XG5cbmZ1bmN0aW9uIGludmFyaWFudChjb25kaXRpb24sIGZvcm1hdCwgYSwgYiwgYywgZCwgZSwgZikge1xuICB2YWxpZGF0ZUZvcm1hdChmb3JtYXQpO1xuXG4gIGlmICghY29uZGl0aW9uKSB7XG4gICAgdmFyIGVycm9yO1xuICAgIGlmIChmb3JtYXQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgZXJyb3IgPSBuZXcgRXJyb3IoJ01pbmlmaWVkIGV4Y2VwdGlvbiBvY2N1cnJlZDsgdXNlIHRoZSBub24tbWluaWZpZWQgZGV2IGVudmlyb25tZW50ICcgKyAnZm9yIHRoZSBmdWxsIGVycm9yIG1lc3NhZ2UgYW5kIGFkZGl0aW9uYWwgaGVscGZ1bCB3YXJuaW5ncy4nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGFyZ3MgPSBbYSwgYiwgYywgZCwgZSwgZl07XG4gICAgICB2YXIgYXJnSW5kZXggPSAwO1xuICAgICAgZXJyb3IgPSBuZXcgRXJyb3IoZm9ybWF0LnJlcGxhY2UoLyVzL2csIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIGFyZ3NbYXJnSW5kZXgrK107XG4gICAgICB9KSk7XG4gICAgICBlcnJvci5uYW1lID0gJ0ludmFyaWFudCBWaW9sYXRpb24nO1xuICAgIH1cblxuICAgIGVycm9yLmZyYW1lc1RvUG9wID0gMTsgLy8gd2UgZG9uJ3QgY2FyZSBhYm91dCBpbnZhcmlhbnQncyBvd24gZnJhbWVcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGludmFyaWFudDsiLCIvKipcbiAqIENvcHlyaWdodCAyMDE0LTIwMTUsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgZW1wdHlGdW5jdGlvbiA9IHJlcXVpcmUoJy4vZW1wdHlGdW5jdGlvbicpO1xuXG4vKipcbiAqIFNpbWlsYXIgdG8gaW52YXJpYW50IGJ1dCBvbmx5IGxvZ3MgYSB3YXJuaW5nIGlmIHRoZSBjb25kaXRpb24gaXMgbm90IG1ldC5cbiAqIFRoaXMgY2FuIGJlIHVzZWQgdG8gbG9nIGlzc3VlcyBpbiBkZXZlbG9wbWVudCBlbnZpcm9ubWVudHMgaW4gY3JpdGljYWxcbiAqIHBhdGhzLiBSZW1vdmluZyB0aGUgbG9nZ2luZyBjb2RlIGZvciBwcm9kdWN0aW9uIGVudmlyb25tZW50cyB3aWxsIGtlZXAgdGhlXG4gKiBzYW1lIGxvZ2ljIGFuZCBmb2xsb3cgdGhlIHNhbWUgY29kZSBwYXRocy5cbiAqL1xuXG52YXIgd2FybmluZyA9IGVtcHR5RnVuY3Rpb247XG5cbmlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gIHZhciBwcmludFdhcm5pbmcgPSBmdW5jdGlvbiBwcmludFdhcm5pbmcoZm9ybWF0KSB7XG4gICAgZm9yICh2YXIgX2xlbiA9IGFyZ3VtZW50cy5sZW5ndGgsIGFyZ3MgPSBBcnJheShfbGVuID4gMSA/IF9sZW4gLSAxIDogMCksIF9rZXkgPSAxOyBfa2V5IDwgX2xlbjsgX2tleSsrKSB7XG4gICAgICBhcmdzW19rZXkgLSAxXSA9IGFyZ3VtZW50c1tfa2V5XTtcbiAgICB9XG5cbiAgICB2YXIgYXJnSW5kZXggPSAwO1xuICAgIHZhciBtZXNzYWdlID0gJ1dhcm5pbmc6ICcgKyBmb3JtYXQucmVwbGFjZSgvJXMvZywgZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIGFyZ3NbYXJnSW5kZXgrK107XG4gICAgfSk7XG4gICAgaWYgKHR5cGVvZiBjb25zb2xlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgY29uc29sZS5lcnJvcihtZXNzYWdlKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgIC8vIC0tLSBXZWxjb21lIHRvIGRlYnVnZ2luZyBSZWFjdCAtLS1cbiAgICAgIC8vIFRoaXMgZXJyb3Igd2FzIHRocm93biBhcyBhIGNvbnZlbmllbmNlIHNvIHRoYXQgeW91IGNhbiB1c2UgdGhpcyBzdGFja1xuICAgICAgLy8gdG8gZmluZCB0aGUgY2FsbHNpdGUgdGhhdCBjYXVzZWQgdGhpcyB3YXJuaW5nIHRvIGZpcmUuXG4gICAgICB0aHJvdyBuZXcgRXJyb3IobWVzc2FnZSk7XG4gICAgfSBjYXRjaCAoeCkge31cbiAgfTtcblxuICB3YXJuaW5nID0gZnVuY3Rpb24gd2FybmluZyhjb25kaXRpb24sIGZvcm1hdCkge1xuICAgIGlmIChmb3JtYXQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdgd2FybmluZyhjb25kaXRpb24sIGZvcm1hdCwgLi4uYXJncylgIHJlcXVpcmVzIGEgd2FybmluZyAnICsgJ21lc3NhZ2UgYXJndW1lbnQnKTtcbiAgICB9XG5cbiAgICBpZiAoZm9ybWF0LmluZGV4T2YoJ0ZhaWxlZCBDb21wb3NpdGUgcHJvcFR5cGU6ICcpID09PSAwKSB7XG4gICAgICByZXR1cm47IC8vIElnbm9yZSBDb21wb3NpdGVDb21wb25lbnQgcHJvcHR5cGUgY2hlY2suXG4gICAgfVxuXG4gICAgaWYgKCFjb25kaXRpb24pIHtcbiAgICAgIGZvciAodmFyIF9sZW4yID0gYXJndW1lbnRzLmxlbmd0aCwgYXJncyA9IEFycmF5KF9sZW4yID4gMiA/IF9sZW4yIC0gMiA6IDApLCBfa2V5MiA9IDI7IF9rZXkyIDwgX2xlbjI7IF9rZXkyKyspIHtcbiAgICAgICAgYXJnc1tfa2V5MiAtIDJdID0gYXJndW1lbnRzW19rZXkyXTtcbiAgICAgIH1cblxuICAgICAgcHJpbnRXYXJuaW5nLmFwcGx5KHVuZGVmaW5lZCwgW2Zvcm1hdF0uY29uY2F0KGFyZ3MpKTtcbiAgICB9XG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gd2FybmluZzsiLCIvKiFcbiAqIERldGVybWluZSBpZiBhbiBvYmplY3QgaXMgYSBCdWZmZXJcbiAqXG4gKiBAYXV0aG9yICAgRmVyb3NzIEFib3VraGFkaWplaCA8ZmVyb3NzQGZlcm9zcy5vcmc+IDxodHRwOi8vZmVyb3NzLm9yZz5cbiAqIEBsaWNlbnNlICBNSVRcbiAqL1xuXG4vLyBUaGUgX2lzQnVmZmVyIGNoZWNrIGlzIGZvciBTYWZhcmkgNS03IHN1cHBvcnQsIGJlY2F1c2UgaXQncyBtaXNzaW5nXG4vLyBPYmplY3QucHJvdG90eXBlLmNvbnN0cnVjdG9yLiBSZW1vdmUgdGhpcyBldmVudHVhbGx5XG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChvYmopIHtcbiAgcmV0dXJuIG9iaiAhPSBudWxsICYmIChpc0J1ZmZlcihvYmopIHx8IGlzU2xvd0J1ZmZlcihvYmopIHx8ICEhb2JqLl9pc0J1ZmZlcilcbn1cblxuZnVuY3Rpb24gaXNCdWZmZXIgKG9iaikge1xuICByZXR1cm4gISFvYmouY29uc3RydWN0b3IgJiYgdHlwZW9mIG9iai5jb25zdHJ1Y3Rvci5pc0J1ZmZlciA9PT0gJ2Z1bmN0aW9uJyAmJiBvYmouY29uc3RydWN0b3IuaXNCdWZmZXIob2JqKVxufVxuXG4vLyBGb3IgTm9kZSB2MC4xMCBzdXBwb3J0LiBSZW1vdmUgdGhpcyBldmVudHVhbGx5LlxuZnVuY3Rpb24gaXNTbG93QnVmZmVyIChvYmopIHtcbiAgcmV0dXJuIHR5cGVvZiBvYmoucmVhZEZsb2F0TEUgPT09ICdmdW5jdGlvbicgJiYgdHlwZW9mIG9iai5zbGljZSA9PT0gJ2Z1bmN0aW9uJyAmJiBpc0J1ZmZlcihvYmouc2xpY2UoMCwgMCkpXG59XG4iLCIvKlxub2JqZWN0LWFzc2lnblxuKGMpIFNpbmRyZSBTb3JodXNcbkBsaWNlbnNlIE1JVFxuKi9cblxuJ3VzZSBzdHJpY3QnO1xuLyogZXNsaW50LWRpc2FibGUgbm8tdW51c2VkLXZhcnMgKi9cbnZhciBnZXRPd25Qcm9wZXJ0eVN5bWJvbHMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzO1xudmFyIGhhc093blByb3BlcnR5ID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcbnZhciBwcm9wSXNFbnVtZXJhYmxlID0gT2JqZWN0LnByb3RvdHlwZS5wcm9wZXJ0eUlzRW51bWVyYWJsZTtcblxuZnVuY3Rpb24gdG9PYmplY3QodmFsKSB7XG5cdGlmICh2YWwgPT09IG51bGwgfHwgdmFsID09PSB1bmRlZmluZWQpIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKCdPYmplY3QuYXNzaWduIGNhbm5vdCBiZSBjYWxsZWQgd2l0aCBudWxsIG9yIHVuZGVmaW5lZCcpO1xuXHR9XG5cblx0cmV0dXJuIE9iamVjdCh2YWwpO1xufVxuXG5mdW5jdGlvbiBzaG91bGRVc2VOYXRpdmUoKSB7XG5cdHRyeSB7XG5cdFx0aWYgKCFPYmplY3QuYXNzaWduKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Ly8gRGV0ZWN0IGJ1Z2d5IHByb3BlcnR5IGVudW1lcmF0aW9uIG9yZGVyIGluIG9sZGVyIFY4IHZlcnNpb25zLlxuXG5cdFx0Ly8gaHR0cHM6Ly9idWdzLmNocm9taXVtLm9yZy9wL3Y4L2lzc3Vlcy9kZXRhaWw/aWQ9NDExOFxuXHRcdHZhciB0ZXN0MSA9IG5ldyBTdHJpbmcoJ2FiYycpOyAgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1uZXctd3JhcHBlcnNcblx0XHR0ZXN0MVs1XSA9ICdkZSc7XG5cdFx0aWYgKE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHRlc3QxKVswXSA9PT0gJzUnKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Ly8gaHR0cHM6Ly9idWdzLmNocm9taXVtLm9yZy9wL3Y4L2lzc3Vlcy9kZXRhaWw/aWQ9MzA1NlxuXHRcdHZhciB0ZXN0MiA9IHt9O1xuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgMTA7IGkrKykge1xuXHRcdFx0dGVzdDJbJ18nICsgU3RyaW5nLmZyb21DaGFyQ29kZShpKV0gPSBpO1xuXHRcdH1cblx0XHR2YXIgb3JkZXIyID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModGVzdDIpLm1hcChmdW5jdGlvbiAobikge1xuXHRcdFx0cmV0dXJuIHRlc3QyW25dO1xuXHRcdH0pO1xuXHRcdGlmIChvcmRlcjIuam9pbignJykgIT09ICcwMTIzNDU2Nzg5Jykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdC8vIGh0dHBzOi8vYnVncy5jaHJvbWl1bS5vcmcvcC92OC9pc3N1ZXMvZGV0YWlsP2lkPTMwNTZcblx0XHR2YXIgdGVzdDMgPSB7fTtcblx0XHQnYWJjZGVmZ2hpamtsbW5vcHFyc3QnLnNwbGl0KCcnKS5mb3JFYWNoKGZ1bmN0aW9uIChsZXR0ZXIpIHtcblx0XHRcdHRlc3QzW2xldHRlcl0gPSBsZXR0ZXI7XG5cdFx0fSk7XG5cdFx0aWYgKE9iamVjdC5rZXlzKE9iamVjdC5hc3NpZ24oe30sIHRlc3QzKSkuam9pbignJykgIT09XG5cdFx0XHRcdCdhYmNkZWZnaGlqa2xtbm9wcXJzdCcpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0Ly8gV2UgZG9uJ3QgZXhwZWN0IGFueSBvZiB0aGUgYWJvdmUgdG8gdGhyb3csIGJ1dCBiZXR0ZXIgdG8gYmUgc2FmZS5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBzaG91bGRVc2VOYXRpdmUoKSA/IE9iamVjdC5hc3NpZ24gOiBmdW5jdGlvbiAodGFyZ2V0LCBzb3VyY2UpIHtcblx0dmFyIGZyb207XG5cdHZhciB0byA9IHRvT2JqZWN0KHRhcmdldCk7XG5cdHZhciBzeW1ib2xzO1xuXG5cdGZvciAodmFyIHMgPSAxOyBzIDwgYXJndW1lbnRzLmxlbmd0aDsgcysrKSB7XG5cdFx0ZnJvbSA9IE9iamVjdChhcmd1bWVudHNbc10pO1xuXG5cdFx0Zm9yICh2YXIga2V5IGluIGZyb20pIHtcblx0XHRcdGlmIChoYXNPd25Qcm9wZXJ0eS5jYWxsKGZyb20sIGtleSkpIHtcblx0XHRcdFx0dG9ba2V5XSA9IGZyb21ba2V5XTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoZ2V0T3duUHJvcGVydHlTeW1ib2xzKSB7XG5cdFx0XHRzeW1ib2xzID0gZ2V0T3duUHJvcGVydHlTeW1ib2xzKGZyb20pO1xuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBzeW1ib2xzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGlmIChwcm9wSXNFbnVtZXJhYmxlLmNhbGwoZnJvbSwgc3ltYm9sc1tpXSkpIHtcblx0XHRcdFx0XHR0b1tzeW1ib2xzW2ldXSA9IGZyb21bc3ltYm9sc1tpXV07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gdG87XG59O1xuIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbi8vIGNhY2hlZCBmcm9tIHdoYXRldmVyIGdsb2JhbCBpcyBwcmVzZW50IHNvIHRoYXQgdGVzdCBydW5uZXJzIHRoYXQgc3R1YiBpdFxuLy8gZG9uJ3QgYnJlYWsgdGhpbmdzLiAgQnV0IHdlIG5lZWQgdG8gd3JhcCBpdCBpbiBhIHRyeSBjYXRjaCBpbiBjYXNlIGl0IGlzXG4vLyB3cmFwcGVkIGluIHN0cmljdCBtb2RlIGNvZGUgd2hpY2ggZG9lc24ndCBkZWZpbmUgYW55IGdsb2JhbHMuICBJdCdzIGluc2lkZSBhXG4vLyBmdW5jdGlvbiBiZWNhdXNlIHRyeS9jYXRjaGVzIGRlb3B0aW1pemUgaW4gY2VydGFpbiBlbmdpbmVzLlxuXG52YXIgY2FjaGVkU2V0VGltZW91dDtcbnZhciBjYWNoZWRDbGVhclRpbWVvdXQ7XG5cbmZ1bmN0aW9uIGRlZmF1bHRTZXRUaW1vdXQoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdzZXRUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG5mdW5jdGlvbiBkZWZhdWx0Q2xlYXJUaW1lb3V0ICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2NsZWFyVGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuKGZ1bmN0aW9uICgpIHtcbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIHNldFRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIGNsZWFyVGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICB9XG59ICgpKVxuZnVuY3Rpb24gcnVuVGltZW91dChmdW4pIHtcbiAgICBpZiAoY2FjaGVkU2V0VGltZW91dCA9PT0gc2V0VGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgLy8gaWYgc2V0VGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZFNldFRpbWVvdXQgPT09IGRlZmF1bHRTZXRUaW1vdXQgfHwgIWNhY2hlZFNldFRpbWVvdXQpICYmIHNldFRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9IGNhdGNoKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0IHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKG51bGwsIGZ1biwgMCk7XG4gICAgICAgIH0gY2F0Y2goZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvclxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbCh0aGlzLCBmdW4sIDApO1xuICAgICAgICB9XG4gICAgfVxuXG5cbn1cbmZ1bmN0aW9uIHJ1bkNsZWFyVGltZW91dChtYXJrZXIpIHtcbiAgICBpZiAoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgLy8gaWYgY2xlYXJUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBkZWZhdWx0Q2xlYXJUaW1lb3V0IHx8ICFjYWNoZWRDbGVhclRpbWVvdXQpICYmIGNsZWFyVGltZW91dCkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfSBjYXRjaCAoZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgIHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwobnVsbCwgbWFya2VyKTtcbiAgICAgICAgfSBjYXRjaCAoZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvci5cbiAgICAgICAgICAgIC8vIFNvbWUgdmVyc2lvbnMgb2YgSS5FLiBoYXZlIGRpZmZlcmVudCBydWxlcyBmb3IgY2xlYXJUaW1lb3V0IHZzIHNldFRpbWVvdXRcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbCh0aGlzLCBtYXJrZXIpO1xuICAgICAgICB9XG4gICAgfVxuXG5cblxufVxudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgaWYgKCFkcmFpbmluZyB8fCAhY3VycmVudFF1ZXVlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gcnVuVGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFF1ZXVlW3F1ZXVlSW5kZXhdLnJ1bigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBjdXJyZW50UXVldWUgPSBudWxsO1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgcnVuQ2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xufVxuXG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHF1ZXVlLnB1c2gobmV3IEl0ZW0oZnVuLCBhcmdzKSk7XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMSAmJiAhZHJhaW5pbmcpIHtcbiAgICAgICAgcnVuVGltZW91dChkcmFpblF1ZXVlKTtcbiAgICB9XG59O1xuXG4vLyB2OCBsaWtlcyBwcmVkaWN0aWJsZSBvYmplY3RzXG5mdW5jdGlvbiBJdGVtKGZ1biwgYXJyYXkpIHtcbiAgICB0aGlzLmZ1biA9IGZ1bjtcbiAgICB0aGlzLmFycmF5ID0gYXJyYXk7XG59XG5JdGVtLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5mdW4uYXBwbHkobnVsbCwgdGhpcy5hcnJheSk7XG59O1xucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5wcm9jZXNzLnZlcnNpb24gPSAnJzsgLy8gZW1wdHkgc3RyaW5nIHRvIGF2b2lkIHJlZ2V4cCBpc3N1ZXNcbnByb2Nlc3MudmVyc2lvbnMgPSB7fTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xucHJvY2Vzcy5wcmVwZW5kTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5wcmVwZW5kT25jZUxpc3RlbmVyID0gbm9vcDtcblxucHJvY2Vzcy5saXN0ZW5lcnMgPSBmdW5jdGlvbiAobmFtZSkgeyByZXR1cm4gW10gfVxuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTMtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxuaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgdmFyIGludmFyaWFudCA9IHJlcXVpcmUoJ2ZianMvbGliL2ludmFyaWFudCcpO1xuICB2YXIgd2FybmluZyA9IHJlcXVpcmUoJ2ZianMvbGliL3dhcm5pbmcnKTtcbiAgdmFyIFJlYWN0UHJvcFR5cGVzU2VjcmV0ID0gcmVxdWlyZSgnLi9saWIvUmVhY3RQcm9wVHlwZXNTZWNyZXQnKTtcbiAgdmFyIGxvZ2dlZFR5cGVGYWlsdXJlcyA9IHt9O1xufVxuXG4vKipcbiAqIEFzc2VydCB0aGF0IHRoZSB2YWx1ZXMgbWF0Y2ggd2l0aCB0aGUgdHlwZSBzcGVjcy5cbiAqIEVycm9yIG1lc3NhZ2VzIGFyZSBtZW1vcml6ZWQgYW5kIHdpbGwgb25seSBiZSBzaG93biBvbmNlLlxuICpcbiAqIEBwYXJhbSB7b2JqZWN0fSB0eXBlU3BlY3MgTWFwIG9mIG5hbWUgdG8gYSBSZWFjdFByb3BUeXBlXG4gKiBAcGFyYW0ge29iamVjdH0gdmFsdWVzIFJ1bnRpbWUgdmFsdWVzIHRoYXQgbmVlZCB0byBiZSB0eXBlLWNoZWNrZWRcbiAqIEBwYXJhbSB7c3RyaW5nfSBsb2NhdGlvbiBlLmcuIFwicHJvcFwiLCBcImNvbnRleHRcIiwgXCJjaGlsZCBjb250ZXh0XCJcbiAqIEBwYXJhbSB7c3RyaW5nfSBjb21wb25lbnROYW1lIE5hbWUgb2YgdGhlIGNvbXBvbmVudCBmb3IgZXJyb3IgbWVzc2FnZXMuXG4gKiBAcGFyYW0gez9GdW5jdGlvbn0gZ2V0U3RhY2sgUmV0dXJucyB0aGUgY29tcG9uZW50IHN0YWNrLlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gY2hlY2tQcm9wVHlwZXModHlwZVNwZWNzLCB2YWx1ZXMsIGxvY2F0aW9uLCBjb21wb25lbnROYW1lLCBnZXRTdGFjaykge1xuICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgIGZvciAodmFyIHR5cGVTcGVjTmFtZSBpbiB0eXBlU3BlY3MpIHtcbiAgICAgIGlmICh0eXBlU3BlY3MuaGFzT3duUHJvcGVydHkodHlwZVNwZWNOYW1lKSkge1xuICAgICAgICB2YXIgZXJyb3I7XG4gICAgICAgIC8vIFByb3AgdHlwZSB2YWxpZGF0aW9uIG1heSB0aHJvdy4gSW4gY2FzZSB0aGV5IGRvLCB3ZSBkb24ndCB3YW50IHRvXG4gICAgICAgIC8vIGZhaWwgdGhlIHJlbmRlciBwaGFzZSB3aGVyZSBpdCBkaWRuJ3QgZmFpbCBiZWZvcmUuIFNvIHdlIGxvZyBpdC5cbiAgICAgICAgLy8gQWZ0ZXIgdGhlc2UgaGF2ZSBiZWVuIGNsZWFuZWQgdXAsIHdlJ2xsIGxldCB0aGVtIHRocm93LlxuICAgICAgICB0cnkge1xuICAgICAgICAgIC8vIFRoaXMgaXMgaW50ZW50aW9uYWxseSBhbiBpbnZhcmlhbnQgdGhhdCBnZXRzIGNhdWdodC4gSXQncyB0aGUgc2FtZVxuICAgICAgICAgIC8vIGJlaGF2aW9yIGFzIHdpdGhvdXQgdGhpcyBzdGF0ZW1lbnQgZXhjZXB0IHdpdGggYSBiZXR0ZXIgbWVzc2FnZS5cbiAgICAgICAgICBpbnZhcmlhbnQodHlwZW9mIHR5cGVTcGVjc1t0eXBlU3BlY05hbWVdID09PSAnZnVuY3Rpb24nLCAnJXM6ICVzIHR5cGUgYCVzYCBpcyBpbnZhbGlkOyBpdCBtdXN0IGJlIGEgZnVuY3Rpb24sIHVzdWFsbHkgZnJvbSAnICsgJ1JlYWN0LlByb3BUeXBlcy4nLCBjb21wb25lbnROYW1lIHx8ICdSZWFjdCBjbGFzcycsIGxvY2F0aW9uLCB0eXBlU3BlY05hbWUpO1xuICAgICAgICAgIGVycm9yID0gdHlwZVNwZWNzW3R5cGVTcGVjTmFtZV0odmFsdWVzLCB0eXBlU3BlY05hbWUsIGNvbXBvbmVudE5hbWUsIGxvY2F0aW9uLCBudWxsLCBSZWFjdFByb3BUeXBlc1NlY3JldCk7XG4gICAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgICAgZXJyb3IgPSBleDtcbiAgICAgICAgfVxuICAgICAgICB3YXJuaW5nKCFlcnJvciB8fCBlcnJvciBpbnN0YW5jZW9mIEVycm9yLCAnJXM6IHR5cGUgc3BlY2lmaWNhdGlvbiBvZiAlcyBgJXNgIGlzIGludmFsaWQ7IHRoZSB0eXBlIGNoZWNrZXIgJyArICdmdW5jdGlvbiBtdXN0IHJldHVybiBgbnVsbGAgb3IgYW4gYEVycm9yYCBidXQgcmV0dXJuZWQgYSAlcy4gJyArICdZb3UgbWF5IGhhdmUgZm9yZ290dGVuIHRvIHBhc3MgYW4gYXJndW1lbnQgdG8gdGhlIHR5cGUgY2hlY2tlciAnICsgJ2NyZWF0b3IgKGFycmF5T2YsIGluc3RhbmNlT2YsIG9iamVjdE9mLCBvbmVPZiwgb25lT2ZUeXBlLCBhbmQgJyArICdzaGFwZSBhbGwgcmVxdWlyZSBhbiBhcmd1bWVudCkuJywgY29tcG9uZW50TmFtZSB8fCAnUmVhY3QgY2xhc3MnLCBsb2NhdGlvbiwgdHlwZVNwZWNOYW1lLCB0eXBlb2YgZXJyb3IpO1xuICAgICAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvciAmJiAhKGVycm9yLm1lc3NhZ2UgaW4gbG9nZ2VkVHlwZUZhaWx1cmVzKSkge1xuICAgICAgICAgIC8vIE9ubHkgbW9uaXRvciB0aGlzIGZhaWx1cmUgb25jZSBiZWNhdXNlIHRoZXJlIHRlbmRzIHRvIGJlIGEgbG90IG9mIHRoZVxuICAgICAgICAgIC8vIHNhbWUgZXJyb3IuXG4gICAgICAgICAgbG9nZ2VkVHlwZUZhaWx1cmVzW2Vycm9yLm1lc3NhZ2VdID0gdHJ1ZTtcblxuICAgICAgICAgIHZhciBzdGFjayA9IGdldFN0YWNrID8gZ2V0U3RhY2soKSA6ICcnO1xuXG4gICAgICAgICAgd2FybmluZyhmYWxzZSwgJ0ZhaWxlZCAlcyB0eXBlOiAlcyVzJywgbG9jYXRpb24sIGVycm9yLm1lc3NhZ2UsIHN0YWNrICE9IG51bGwgPyBzdGFjayA6ICcnKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNoZWNrUHJvcFR5cGVzO1xuIiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxMy1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG4vLyBSZWFjdCAxNS41IHJlZmVyZW5jZXMgdGhpcyBtb2R1bGUsIGFuZCBhc3N1bWVzIFByb3BUeXBlcyBhcmUgc3RpbGwgY2FsbGFibGUgaW4gcHJvZHVjdGlvbi5cbi8vIFRoZXJlZm9yZSB3ZSByZS1leHBvcnQgZGV2ZWxvcG1lbnQtb25seSB2ZXJzaW9uIHdpdGggYWxsIHRoZSBQcm9wVHlwZXMgY2hlY2tzIGhlcmUuXG4vLyBIb3dldmVyIGlmIG9uZSBpcyBtaWdyYXRpbmcgdG8gdGhlIGBwcm9wLXR5cGVzYCBucG0gbGlicmFyeSwgdGhleSB3aWxsIGdvIHRocm91Z2ggdGhlXG4vLyBgaW5kZXguanNgIGVudHJ5IHBvaW50LCBhbmQgaXQgd2lsbCBicmFuY2ggZGVwZW5kaW5nIG9uIHRoZSBlbnZpcm9ubWVudC5cbnZhciBmYWN0b3J5ID0gcmVxdWlyZSgnLi9mYWN0b3J5V2l0aFR5cGVDaGVja2VycycpO1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihpc1ZhbGlkRWxlbWVudCkge1xuICAvLyBJdCBpcyBzdGlsbCBhbGxvd2VkIGluIDE1LjUuXG4gIHZhciB0aHJvd09uRGlyZWN0QWNjZXNzID0gZmFsc2U7XG4gIHJldHVybiBmYWN0b3J5KGlzVmFsaWRFbGVtZW50LCB0aHJvd09uRGlyZWN0QWNjZXNzKTtcbn07XG4iLCIvKipcbiAqIENvcHlyaWdodCAyMDEzLXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBlbXB0eUZ1bmN0aW9uID0gcmVxdWlyZSgnZmJqcy9saWIvZW1wdHlGdW5jdGlvbicpO1xudmFyIGludmFyaWFudCA9IHJlcXVpcmUoJ2ZianMvbGliL2ludmFyaWFudCcpO1xudmFyIHdhcm5pbmcgPSByZXF1aXJlKCdmYmpzL2xpYi93YXJuaW5nJyk7XG5cbnZhciBSZWFjdFByb3BUeXBlc1NlY3JldCA9IHJlcXVpcmUoJy4vbGliL1JlYWN0UHJvcFR5cGVzU2VjcmV0Jyk7XG52YXIgY2hlY2tQcm9wVHlwZXMgPSByZXF1aXJlKCcuL2NoZWNrUHJvcFR5cGVzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oaXNWYWxpZEVsZW1lbnQsIHRocm93T25EaXJlY3RBY2Nlc3MpIHtcbiAgLyogZ2xvYmFsIFN5bWJvbCAqL1xuICB2YXIgSVRFUkFUT1JfU1lNQk9MID0gdHlwZW9mIFN5bWJvbCA9PT0gJ2Z1bmN0aW9uJyAmJiBTeW1ib2wuaXRlcmF0b3I7XG4gIHZhciBGQVVYX0lURVJBVE9SX1NZTUJPTCA9ICdAQGl0ZXJhdG9yJzsgLy8gQmVmb3JlIFN5bWJvbCBzcGVjLlxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBpdGVyYXRvciBtZXRob2QgZnVuY3Rpb24gY29udGFpbmVkIG9uIHRoZSBpdGVyYWJsZSBvYmplY3QuXG4gICAqXG4gICAqIEJlIHN1cmUgdG8gaW52b2tlIHRoZSBmdW5jdGlvbiB3aXRoIHRoZSBpdGVyYWJsZSBhcyBjb250ZXh0OlxuICAgKlxuICAgKiAgICAgdmFyIGl0ZXJhdG9yRm4gPSBnZXRJdGVyYXRvckZuKG15SXRlcmFibGUpO1xuICAgKiAgICAgaWYgKGl0ZXJhdG9yRm4pIHtcbiAgICogICAgICAgdmFyIGl0ZXJhdG9yID0gaXRlcmF0b3JGbi5jYWxsKG15SXRlcmFibGUpO1xuICAgKiAgICAgICAuLi5cbiAgICogICAgIH1cbiAgICpcbiAgICogQHBhcmFtIHs/b2JqZWN0fSBtYXliZUl0ZXJhYmxlXG4gICAqIEByZXR1cm4gez9mdW5jdGlvbn1cbiAgICovXG4gIGZ1bmN0aW9uIGdldEl0ZXJhdG9yRm4obWF5YmVJdGVyYWJsZSkge1xuICAgIHZhciBpdGVyYXRvckZuID0gbWF5YmVJdGVyYWJsZSAmJiAoSVRFUkFUT1JfU1lNQk9MICYmIG1heWJlSXRlcmFibGVbSVRFUkFUT1JfU1lNQk9MXSB8fCBtYXliZUl0ZXJhYmxlW0ZBVVhfSVRFUkFUT1JfU1lNQk9MXSk7XG4gICAgaWYgKHR5cGVvZiBpdGVyYXRvckZuID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXR1cm4gaXRlcmF0b3JGbjtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ29sbGVjdGlvbiBvZiBtZXRob2RzIHRoYXQgYWxsb3cgZGVjbGFyYXRpb24gYW5kIHZhbGlkYXRpb24gb2YgcHJvcHMgdGhhdCBhcmVcbiAgICogc3VwcGxpZWQgdG8gUmVhY3QgY29tcG9uZW50cy4gRXhhbXBsZSB1c2FnZTpcbiAgICpcbiAgICogICB2YXIgUHJvcHMgPSByZXF1aXJlKCdSZWFjdFByb3BUeXBlcycpO1xuICAgKiAgIHZhciBNeUFydGljbGUgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG4gICAqICAgICBwcm9wVHlwZXM6IHtcbiAgICogICAgICAgLy8gQW4gb3B0aW9uYWwgc3RyaW5nIHByb3AgbmFtZWQgXCJkZXNjcmlwdGlvblwiLlxuICAgKiAgICAgICBkZXNjcmlwdGlvbjogUHJvcHMuc3RyaW5nLFxuICAgKlxuICAgKiAgICAgICAvLyBBIHJlcXVpcmVkIGVudW0gcHJvcCBuYW1lZCBcImNhdGVnb3J5XCIuXG4gICAqICAgICAgIGNhdGVnb3J5OiBQcm9wcy5vbmVPZihbJ05ld3MnLCdQaG90b3MnXSkuaXNSZXF1aXJlZCxcbiAgICpcbiAgICogICAgICAgLy8gQSBwcm9wIG5hbWVkIFwiZGlhbG9nXCIgdGhhdCByZXF1aXJlcyBhbiBpbnN0YW5jZSBvZiBEaWFsb2cuXG4gICAqICAgICAgIGRpYWxvZzogUHJvcHMuaW5zdGFuY2VPZihEaWFsb2cpLmlzUmVxdWlyZWRcbiAgICogICAgIH0sXG4gICAqICAgICByZW5kZXI6IGZ1bmN0aW9uKCkgeyAuLi4gfVxuICAgKiAgIH0pO1xuICAgKlxuICAgKiBBIG1vcmUgZm9ybWFsIHNwZWNpZmljYXRpb24gb2YgaG93IHRoZXNlIG1ldGhvZHMgYXJlIHVzZWQ6XG4gICAqXG4gICAqICAgdHlwZSA6PSBhcnJheXxib29sfGZ1bmN8b2JqZWN0fG51bWJlcnxzdHJpbmd8b25lT2YoWy4uLl0pfGluc3RhbmNlT2YoLi4uKVxuICAgKiAgIGRlY2wgOj0gUmVhY3RQcm9wVHlwZXMue3R5cGV9KC5pc1JlcXVpcmVkKT9cbiAgICpcbiAgICogRWFjaCBhbmQgZXZlcnkgZGVjbGFyYXRpb24gcHJvZHVjZXMgYSBmdW5jdGlvbiB3aXRoIHRoZSBzYW1lIHNpZ25hdHVyZS4gVGhpc1xuICAgKiBhbGxvd3MgdGhlIGNyZWF0aW9uIG9mIGN1c3RvbSB2YWxpZGF0aW9uIGZ1bmN0aW9ucy4gRm9yIGV4YW1wbGU6XG4gICAqXG4gICAqICB2YXIgTXlMaW5rID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuICAgKiAgICBwcm9wVHlwZXM6IHtcbiAgICogICAgICAvLyBBbiBvcHRpb25hbCBzdHJpbmcgb3IgVVJJIHByb3AgbmFtZWQgXCJocmVmXCIuXG4gICAqICAgICAgaHJlZjogZnVuY3Rpb24ocHJvcHMsIHByb3BOYW1lLCBjb21wb25lbnROYW1lKSB7XG4gICAqICAgICAgICB2YXIgcHJvcFZhbHVlID0gcHJvcHNbcHJvcE5hbWVdO1xuICAgKiAgICAgICAgaWYgKHByb3BWYWx1ZSAhPSBudWxsICYmIHR5cGVvZiBwcm9wVmFsdWUgIT09ICdzdHJpbmcnICYmXG4gICAqICAgICAgICAgICAgIShwcm9wVmFsdWUgaW5zdGFuY2VvZiBVUkkpKSB7XG4gICAqICAgICAgICAgIHJldHVybiBuZXcgRXJyb3IoXG4gICAqICAgICAgICAgICAgJ0V4cGVjdGVkIGEgc3RyaW5nIG9yIGFuIFVSSSBmb3IgJyArIHByb3BOYW1lICsgJyBpbiAnICtcbiAgICogICAgICAgICAgICBjb21wb25lbnROYW1lXG4gICAqICAgICAgICAgICk7XG4gICAqICAgICAgICB9XG4gICAqICAgICAgfVxuICAgKiAgICB9LFxuICAgKiAgICByZW5kZXI6IGZ1bmN0aW9uKCkgey4uLn1cbiAgICogIH0pO1xuICAgKlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG5cbiAgdmFyIEFOT05ZTU9VUyA9ICc8PGFub255bW91cz4+JztcblxuICAvLyBJbXBvcnRhbnQhXG4gIC8vIEtlZXAgdGhpcyBsaXN0IGluIHN5bmMgd2l0aCBwcm9kdWN0aW9uIHZlcnNpb24gaW4gYC4vZmFjdG9yeVdpdGhUaHJvd2luZ1NoaW1zLmpzYC5cbiAgdmFyIFJlYWN0UHJvcFR5cGVzID0ge1xuICAgIGFycmF5OiBjcmVhdGVQcmltaXRpdmVUeXBlQ2hlY2tlcignYXJyYXknKSxcbiAgICBib29sOiBjcmVhdGVQcmltaXRpdmVUeXBlQ2hlY2tlcignYm9vbGVhbicpLFxuICAgIGZ1bmM6IGNyZWF0ZVByaW1pdGl2ZVR5cGVDaGVja2VyKCdmdW5jdGlvbicpLFxuICAgIG51bWJlcjogY3JlYXRlUHJpbWl0aXZlVHlwZUNoZWNrZXIoJ251bWJlcicpLFxuICAgIG9iamVjdDogY3JlYXRlUHJpbWl0aXZlVHlwZUNoZWNrZXIoJ29iamVjdCcpLFxuICAgIHN0cmluZzogY3JlYXRlUHJpbWl0aXZlVHlwZUNoZWNrZXIoJ3N0cmluZycpLFxuICAgIHN5bWJvbDogY3JlYXRlUHJpbWl0aXZlVHlwZUNoZWNrZXIoJ3N5bWJvbCcpLFxuXG4gICAgYW55OiBjcmVhdGVBbnlUeXBlQ2hlY2tlcigpLFxuICAgIGFycmF5T2Y6IGNyZWF0ZUFycmF5T2ZUeXBlQ2hlY2tlcixcbiAgICBlbGVtZW50OiBjcmVhdGVFbGVtZW50VHlwZUNoZWNrZXIoKSxcbiAgICBpbnN0YW5jZU9mOiBjcmVhdGVJbnN0YW5jZVR5cGVDaGVja2VyLFxuICAgIG5vZGU6IGNyZWF0ZU5vZGVDaGVja2VyKCksXG4gICAgb2JqZWN0T2Y6IGNyZWF0ZU9iamVjdE9mVHlwZUNoZWNrZXIsXG4gICAgb25lT2Y6IGNyZWF0ZUVudW1UeXBlQ2hlY2tlcixcbiAgICBvbmVPZlR5cGU6IGNyZWF0ZVVuaW9uVHlwZUNoZWNrZXIsXG4gICAgc2hhcGU6IGNyZWF0ZVNoYXBlVHlwZUNoZWNrZXJcbiAgfTtcblxuICAvKipcbiAgICogaW5saW5lZCBPYmplY3QuaXMgcG9seWZpbGwgdG8gYXZvaWQgcmVxdWlyaW5nIGNvbnN1bWVycyBzaGlwIHRoZWlyIG93blxuICAgKiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9PYmplY3QvaXNcbiAgICovXG4gIC8qZXNsaW50LWRpc2FibGUgbm8tc2VsZi1jb21wYXJlKi9cbiAgZnVuY3Rpb24gaXMoeCwgeSkge1xuICAgIC8vIFNhbWVWYWx1ZSBhbGdvcml0aG1cbiAgICBpZiAoeCA9PT0geSkge1xuICAgICAgLy8gU3RlcHMgMS01LCA3LTEwXG4gICAgICAvLyBTdGVwcyA2LmItNi5lOiArMCAhPSAtMFxuICAgICAgcmV0dXJuIHggIT09IDAgfHwgMSAvIHggPT09IDEgLyB5O1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBTdGVwIDYuYTogTmFOID09IE5hTlxuICAgICAgcmV0dXJuIHggIT09IHggJiYgeSAhPT0geTtcbiAgICB9XG4gIH1cbiAgLyplc2xpbnQtZW5hYmxlIG5vLXNlbGYtY29tcGFyZSovXG5cbiAgLyoqXG4gICAqIFdlIHVzZSBhbiBFcnJvci1saWtlIG9iamVjdCBmb3IgYmFja3dhcmQgY29tcGF0aWJpbGl0eSBhcyBwZW9wbGUgbWF5IGNhbGxcbiAgICogUHJvcFR5cGVzIGRpcmVjdGx5IGFuZCBpbnNwZWN0IHRoZWlyIG91dHB1dC4gSG93ZXZlciwgd2UgZG9uJ3QgdXNlIHJlYWxcbiAgICogRXJyb3JzIGFueW1vcmUuIFdlIGRvbid0IGluc3BlY3QgdGhlaXIgc3RhY2sgYW55d2F5LCBhbmQgY3JlYXRpbmcgdGhlbVxuICAgKiBpcyBwcm9oaWJpdGl2ZWx5IGV4cGVuc2l2ZSBpZiB0aGV5IGFyZSBjcmVhdGVkIHRvbyBvZnRlbiwgc3VjaCBhcyB3aGF0XG4gICAqIGhhcHBlbnMgaW4gb25lT2ZUeXBlKCkgZm9yIGFueSB0eXBlIGJlZm9yZSB0aGUgb25lIHRoYXQgbWF0Y2hlZC5cbiAgICovXG4gIGZ1bmN0aW9uIFByb3BUeXBlRXJyb3IobWVzc2FnZSkge1xuICAgIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG4gICAgdGhpcy5zdGFjayA9ICcnO1xuICB9XG4gIC8vIE1ha2UgYGluc3RhbmNlb2YgRXJyb3JgIHN0aWxsIHdvcmsgZm9yIHJldHVybmVkIGVycm9ycy5cbiAgUHJvcFR5cGVFcnJvci5wcm90b3R5cGUgPSBFcnJvci5wcm90b3R5cGU7XG5cbiAgZnVuY3Rpb24gY3JlYXRlQ2hhaW5hYmxlVHlwZUNoZWNrZXIodmFsaWRhdGUpIHtcbiAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgdmFyIG1hbnVhbFByb3BUeXBlQ2FsbENhY2hlID0ge307XG4gICAgICB2YXIgbWFudWFsUHJvcFR5cGVXYXJuaW5nQ291bnQgPSAwO1xuICAgIH1cbiAgICBmdW5jdGlvbiBjaGVja1R5cGUoaXNSZXF1aXJlZCwgcHJvcHMsIHByb3BOYW1lLCBjb21wb25lbnROYW1lLCBsb2NhdGlvbiwgcHJvcEZ1bGxOYW1lLCBzZWNyZXQpIHtcbiAgICAgIGNvbXBvbmVudE5hbWUgPSBjb21wb25lbnROYW1lIHx8IEFOT05ZTU9VUztcbiAgICAgIHByb3BGdWxsTmFtZSA9IHByb3BGdWxsTmFtZSB8fCBwcm9wTmFtZTtcblxuICAgICAgaWYgKHNlY3JldCAhPT0gUmVhY3RQcm9wVHlwZXNTZWNyZXQpIHtcbiAgICAgICAgaWYgKHRocm93T25EaXJlY3RBY2Nlc3MpIHtcbiAgICAgICAgICAvLyBOZXcgYmVoYXZpb3Igb25seSBmb3IgdXNlcnMgb2YgYHByb3AtdHlwZXNgIHBhY2thZ2VcbiAgICAgICAgICBpbnZhcmlhbnQoXG4gICAgICAgICAgICBmYWxzZSxcbiAgICAgICAgICAgICdDYWxsaW5nIFByb3BUeXBlcyB2YWxpZGF0b3JzIGRpcmVjdGx5IGlzIG5vdCBzdXBwb3J0ZWQgYnkgdGhlIGBwcm9wLXR5cGVzYCBwYWNrYWdlLiAnICtcbiAgICAgICAgICAgICdVc2UgYFByb3BUeXBlcy5jaGVja1Byb3BUeXBlcygpYCB0byBjYWxsIHRoZW0uICcgK1xuICAgICAgICAgICAgJ1JlYWQgbW9yZSBhdCBodHRwOi8vZmIubWUvdXNlLWNoZWNrLXByb3AtdHlwZXMnXG4gICAgICAgICAgKTtcbiAgICAgICAgfSBlbHNlIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIHR5cGVvZiBjb25zb2xlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIC8vIE9sZCBiZWhhdmlvciBmb3IgcGVvcGxlIHVzaW5nIFJlYWN0LlByb3BUeXBlc1xuICAgICAgICAgIHZhciBjYWNoZUtleSA9IGNvbXBvbmVudE5hbWUgKyAnOicgKyBwcm9wTmFtZTtcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAhbWFudWFsUHJvcFR5cGVDYWxsQ2FjaGVbY2FjaGVLZXldICYmXG4gICAgICAgICAgICAvLyBBdm9pZCBzcGFtbWluZyB0aGUgY29uc29sZSBiZWNhdXNlIHRoZXkgYXJlIG9mdGVuIG5vdCBhY3Rpb25hYmxlIGV4Y2VwdCBmb3IgbGliIGF1dGhvcnNcbiAgICAgICAgICAgIG1hbnVhbFByb3BUeXBlV2FybmluZ0NvdW50IDwgM1xuICAgICAgICAgICkge1xuICAgICAgICAgICAgd2FybmluZyhcbiAgICAgICAgICAgICAgZmFsc2UsXG4gICAgICAgICAgICAgICdZb3UgYXJlIG1hbnVhbGx5IGNhbGxpbmcgYSBSZWFjdC5Qcm9wVHlwZXMgdmFsaWRhdGlvbiAnICtcbiAgICAgICAgICAgICAgJ2Z1bmN0aW9uIGZvciB0aGUgYCVzYCBwcm9wIG9uIGAlc2AuIFRoaXMgaXMgZGVwcmVjYXRlZCAnICtcbiAgICAgICAgICAgICAgJ2FuZCB3aWxsIHRocm93IGluIHRoZSBzdGFuZGFsb25lIGBwcm9wLXR5cGVzYCBwYWNrYWdlLiAnICtcbiAgICAgICAgICAgICAgJ1lvdSBtYXkgYmUgc2VlaW5nIHRoaXMgd2FybmluZyBkdWUgdG8gYSB0aGlyZC1wYXJ0eSBQcm9wVHlwZXMgJyArXG4gICAgICAgICAgICAgICdsaWJyYXJ5LiBTZWUgaHR0cHM6Ly9mYi5tZS9yZWFjdC13YXJuaW5nLWRvbnQtY2FsbC1wcm9wdHlwZXMgJyArICdmb3IgZGV0YWlscy4nLFxuICAgICAgICAgICAgICBwcm9wRnVsbE5hbWUsXG4gICAgICAgICAgICAgIGNvbXBvbmVudE5hbWVcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBtYW51YWxQcm9wVHlwZUNhbGxDYWNoZVtjYWNoZUtleV0gPSB0cnVlO1xuICAgICAgICAgICAgbWFudWFsUHJvcFR5cGVXYXJuaW5nQ291bnQrKztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChwcm9wc1twcm9wTmFtZV0gPT0gbnVsbCkge1xuICAgICAgICBpZiAoaXNSZXF1aXJlZCkge1xuICAgICAgICAgIGlmIChwcm9wc1twcm9wTmFtZV0gPT09IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgUHJvcFR5cGVFcnJvcignVGhlICcgKyBsb2NhdGlvbiArICcgYCcgKyBwcm9wRnVsbE5hbWUgKyAnYCBpcyBtYXJrZWQgYXMgcmVxdWlyZWQgJyArICgnaW4gYCcgKyBjb21wb25lbnROYW1lICsgJ2AsIGJ1dCBpdHMgdmFsdWUgaXMgYG51bGxgLicpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIG5ldyBQcm9wVHlwZUVycm9yKCdUaGUgJyArIGxvY2F0aW9uICsgJyBgJyArIHByb3BGdWxsTmFtZSArICdgIGlzIG1hcmtlZCBhcyByZXF1aXJlZCBpbiAnICsgKCdgJyArIGNvbXBvbmVudE5hbWUgKyAnYCwgYnV0IGl0cyB2YWx1ZSBpcyBgdW5kZWZpbmVkYC4nKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdmFsaWRhdGUocHJvcHMsIHByb3BOYW1lLCBjb21wb25lbnROYW1lLCBsb2NhdGlvbiwgcHJvcEZ1bGxOYW1lKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgY2hhaW5lZENoZWNrVHlwZSA9IGNoZWNrVHlwZS5iaW5kKG51bGwsIGZhbHNlKTtcbiAgICBjaGFpbmVkQ2hlY2tUeXBlLmlzUmVxdWlyZWQgPSBjaGVja1R5cGUuYmluZChudWxsLCB0cnVlKTtcblxuICAgIHJldHVybiBjaGFpbmVkQ2hlY2tUeXBlO1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlUHJpbWl0aXZlVHlwZUNoZWNrZXIoZXhwZWN0ZWRUeXBlKSB7XG4gICAgZnVuY3Rpb24gdmFsaWRhdGUocHJvcHMsIHByb3BOYW1lLCBjb21wb25lbnROYW1lLCBsb2NhdGlvbiwgcHJvcEZ1bGxOYW1lLCBzZWNyZXQpIHtcbiAgICAgIHZhciBwcm9wVmFsdWUgPSBwcm9wc1twcm9wTmFtZV07XG4gICAgICB2YXIgcHJvcFR5cGUgPSBnZXRQcm9wVHlwZShwcm9wVmFsdWUpO1xuICAgICAgaWYgKHByb3BUeXBlICE9PSBleHBlY3RlZFR5cGUpIHtcbiAgICAgICAgLy8gYHByb3BWYWx1ZWAgYmVpbmcgaW5zdGFuY2Ugb2YsIHNheSwgZGF0ZS9yZWdleHAsIHBhc3MgdGhlICdvYmplY3QnXG4gICAgICAgIC8vIGNoZWNrLCBidXQgd2UgY2FuIG9mZmVyIGEgbW9yZSBwcmVjaXNlIGVycm9yIG1lc3NhZ2UgaGVyZSByYXRoZXIgdGhhblxuICAgICAgICAvLyAnb2YgdHlwZSBgb2JqZWN0YCcuXG4gICAgICAgIHZhciBwcmVjaXNlVHlwZSA9IGdldFByZWNpc2VUeXBlKHByb3BWYWx1ZSk7XG5cbiAgICAgICAgcmV0dXJuIG5ldyBQcm9wVHlwZUVycm9yKCdJbnZhbGlkICcgKyBsb2NhdGlvbiArICcgYCcgKyBwcm9wRnVsbE5hbWUgKyAnYCBvZiB0eXBlICcgKyAoJ2AnICsgcHJlY2lzZVR5cGUgKyAnYCBzdXBwbGllZCB0byBgJyArIGNvbXBvbmVudE5hbWUgKyAnYCwgZXhwZWN0ZWQgJykgKyAoJ2AnICsgZXhwZWN0ZWRUeXBlICsgJ2AuJykpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHJldHVybiBjcmVhdGVDaGFpbmFibGVUeXBlQ2hlY2tlcih2YWxpZGF0ZSk7XG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGVBbnlUeXBlQ2hlY2tlcigpIHtcbiAgICByZXR1cm4gY3JlYXRlQ2hhaW5hYmxlVHlwZUNoZWNrZXIoZW1wdHlGdW5jdGlvbi50aGF0UmV0dXJuc051bGwpO1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlQXJyYXlPZlR5cGVDaGVja2VyKHR5cGVDaGVja2VyKSB7XG4gICAgZnVuY3Rpb24gdmFsaWRhdGUocHJvcHMsIHByb3BOYW1lLCBjb21wb25lbnROYW1lLCBsb2NhdGlvbiwgcHJvcEZ1bGxOYW1lKSB7XG4gICAgICBpZiAodHlwZW9mIHR5cGVDaGVja2VyICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvcFR5cGVFcnJvcignUHJvcGVydHkgYCcgKyBwcm9wRnVsbE5hbWUgKyAnYCBvZiBjb21wb25lbnQgYCcgKyBjb21wb25lbnROYW1lICsgJ2AgaGFzIGludmFsaWQgUHJvcFR5cGUgbm90YXRpb24gaW5zaWRlIGFycmF5T2YuJyk7XG4gICAgICB9XG4gICAgICB2YXIgcHJvcFZhbHVlID0gcHJvcHNbcHJvcE5hbWVdO1xuICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHByb3BWYWx1ZSkpIHtcbiAgICAgICAgdmFyIHByb3BUeXBlID0gZ2V0UHJvcFR5cGUocHJvcFZhbHVlKTtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9wVHlwZUVycm9yKCdJbnZhbGlkICcgKyBsb2NhdGlvbiArICcgYCcgKyBwcm9wRnVsbE5hbWUgKyAnYCBvZiB0eXBlICcgKyAoJ2AnICsgcHJvcFR5cGUgKyAnYCBzdXBwbGllZCB0byBgJyArIGNvbXBvbmVudE5hbWUgKyAnYCwgZXhwZWN0ZWQgYW4gYXJyYXkuJykpO1xuICAgICAgfVxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwcm9wVmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGVycm9yID0gdHlwZUNoZWNrZXIocHJvcFZhbHVlLCBpLCBjb21wb25lbnROYW1lLCBsb2NhdGlvbiwgcHJvcEZ1bGxOYW1lICsgJ1snICsgaSArICddJywgUmVhY3RQcm9wVHlwZXNTZWNyZXQpO1xuICAgICAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICAgIHJldHVybiBlcnJvcjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHJldHVybiBjcmVhdGVDaGFpbmFibGVUeXBlQ2hlY2tlcih2YWxpZGF0ZSk7XG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGVFbGVtZW50VHlwZUNoZWNrZXIoKSB7XG4gICAgZnVuY3Rpb24gdmFsaWRhdGUocHJvcHMsIHByb3BOYW1lLCBjb21wb25lbnROYW1lLCBsb2NhdGlvbiwgcHJvcEZ1bGxOYW1lKSB7XG4gICAgICB2YXIgcHJvcFZhbHVlID0gcHJvcHNbcHJvcE5hbWVdO1xuICAgICAgaWYgKCFpc1ZhbGlkRWxlbWVudChwcm9wVmFsdWUpKSB7XG4gICAgICAgIHZhciBwcm9wVHlwZSA9IGdldFByb3BUeXBlKHByb3BWYWx1ZSk7XG4gICAgICAgIHJldHVybiBuZXcgUHJvcFR5cGVFcnJvcignSW52YWxpZCAnICsgbG9jYXRpb24gKyAnIGAnICsgcHJvcEZ1bGxOYW1lICsgJ2Agb2YgdHlwZSAnICsgKCdgJyArIHByb3BUeXBlICsgJ2Agc3VwcGxpZWQgdG8gYCcgKyBjb21wb25lbnROYW1lICsgJ2AsIGV4cGVjdGVkIGEgc2luZ2xlIFJlYWN0RWxlbWVudC4nKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIGNyZWF0ZUNoYWluYWJsZVR5cGVDaGVja2VyKHZhbGlkYXRlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZUluc3RhbmNlVHlwZUNoZWNrZXIoZXhwZWN0ZWRDbGFzcykge1xuICAgIGZ1bmN0aW9uIHZhbGlkYXRlKHByb3BzLCBwcm9wTmFtZSwgY29tcG9uZW50TmFtZSwgbG9jYXRpb24sIHByb3BGdWxsTmFtZSkge1xuICAgICAgaWYgKCEocHJvcHNbcHJvcE5hbWVdIGluc3RhbmNlb2YgZXhwZWN0ZWRDbGFzcykpIHtcbiAgICAgICAgdmFyIGV4cGVjdGVkQ2xhc3NOYW1lID0gZXhwZWN0ZWRDbGFzcy5uYW1lIHx8IEFOT05ZTU9VUztcbiAgICAgICAgdmFyIGFjdHVhbENsYXNzTmFtZSA9IGdldENsYXNzTmFtZShwcm9wc1twcm9wTmFtZV0pO1xuICAgICAgICByZXR1cm4gbmV3IFByb3BUeXBlRXJyb3IoJ0ludmFsaWQgJyArIGxvY2F0aW9uICsgJyBgJyArIHByb3BGdWxsTmFtZSArICdgIG9mIHR5cGUgJyArICgnYCcgKyBhY3R1YWxDbGFzc05hbWUgKyAnYCBzdXBwbGllZCB0byBgJyArIGNvbXBvbmVudE5hbWUgKyAnYCwgZXhwZWN0ZWQgJykgKyAoJ2luc3RhbmNlIG9mIGAnICsgZXhwZWN0ZWRDbGFzc05hbWUgKyAnYC4nKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIGNyZWF0ZUNoYWluYWJsZVR5cGVDaGVja2VyKHZhbGlkYXRlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZUVudW1UeXBlQ2hlY2tlcihleHBlY3RlZFZhbHVlcykge1xuICAgIGlmICghQXJyYXkuaXNBcnJheShleHBlY3RlZFZhbHVlcykpIHtcbiAgICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyB3YXJuaW5nKGZhbHNlLCAnSW52YWxpZCBhcmd1bWVudCBzdXBwbGllZCB0byBvbmVPZiwgZXhwZWN0ZWQgYW4gaW5zdGFuY2Ugb2YgYXJyYXkuJykgOiB2b2lkIDA7XG4gICAgICByZXR1cm4gZW1wdHlGdW5jdGlvbi50aGF0UmV0dXJuc051bGw7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdmFsaWRhdGUocHJvcHMsIHByb3BOYW1lLCBjb21wb25lbnROYW1lLCBsb2NhdGlvbiwgcHJvcEZ1bGxOYW1lKSB7XG4gICAgICB2YXIgcHJvcFZhbHVlID0gcHJvcHNbcHJvcE5hbWVdO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBleHBlY3RlZFZhbHVlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoaXMocHJvcFZhbHVlLCBleHBlY3RlZFZhbHVlc1tpXSkpIHtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB2YXIgdmFsdWVzU3RyaW5nID0gSlNPTi5zdHJpbmdpZnkoZXhwZWN0ZWRWYWx1ZXMpO1xuICAgICAgcmV0dXJuIG5ldyBQcm9wVHlwZUVycm9yKCdJbnZhbGlkICcgKyBsb2NhdGlvbiArICcgYCcgKyBwcm9wRnVsbE5hbWUgKyAnYCBvZiB2YWx1ZSBgJyArIHByb3BWYWx1ZSArICdgICcgKyAoJ3N1cHBsaWVkIHRvIGAnICsgY29tcG9uZW50TmFtZSArICdgLCBleHBlY3RlZCBvbmUgb2YgJyArIHZhbHVlc1N0cmluZyArICcuJykpO1xuICAgIH1cbiAgICByZXR1cm4gY3JlYXRlQ2hhaW5hYmxlVHlwZUNoZWNrZXIodmFsaWRhdGUpO1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlT2JqZWN0T2ZUeXBlQ2hlY2tlcih0eXBlQ2hlY2tlcikge1xuICAgIGZ1bmN0aW9uIHZhbGlkYXRlKHByb3BzLCBwcm9wTmFtZSwgY29tcG9uZW50TmFtZSwgbG9jYXRpb24sIHByb3BGdWxsTmFtZSkge1xuICAgICAgaWYgKHR5cGVvZiB0eXBlQ2hlY2tlciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICByZXR1cm4gbmV3IFByb3BUeXBlRXJyb3IoJ1Byb3BlcnR5IGAnICsgcHJvcEZ1bGxOYW1lICsgJ2Agb2YgY29tcG9uZW50IGAnICsgY29tcG9uZW50TmFtZSArICdgIGhhcyBpbnZhbGlkIFByb3BUeXBlIG5vdGF0aW9uIGluc2lkZSBvYmplY3RPZi4nKTtcbiAgICAgIH1cbiAgICAgIHZhciBwcm9wVmFsdWUgPSBwcm9wc1twcm9wTmFtZV07XG4gICAgICB2YXIgcHJvcFR5cGUgPSBnZXRQcm9wVHlwZShwcm9wVmFsdWUpO1xuICAgICAgaWYgKHByb3BUeXBlICE9PSAnb2JqZWN0Jykge1xuICAgICAgICByZXR1cm4gbmV3IFByb3BUeXBlRXJyb3IoJ0ludmFsaWQgJyArIGxvY2F0aW9uICsgJyBgJyArIHByb3BGdWxsTmFtZSArICdgIG9mIHR5cGUgJyArICgnYCcgKyBwcm9wVHlwZSArICdgIHN1cHBsaWVkIHRvIGAnICsgY29tcG9uZW50TmFtZSArICdgLCBleHBlY3RlZCBhbiBvYmplY3QuJykpO1xuICAgICAgfVxuICAgICAgZm9yICh2YXIga2V5IGluIHByb3BWYWx1ZSkge1xuICAgICAgICBpZiAocHJvcFZhbHVlLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICB2YXIgZXJyb3IgPSB0eXBlQ2hlY2tlcihwcm9wVmFsdWUsIGtleSwgY29tcG9uZW50TmFtZSwgbG9jYXRpb24sIHByb3BGdWxsTmFtZSArICcuJyArIGtleSwgUmVhY3RQcm9wVHlwZXNTZWNyZXQpO1xuICAgICAgICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3I7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIGNyZWF0ZUNoYWluYWJsZVR5cGVDaGVja2VyKHZhbGlkYXRlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZVVuaW9uVHlwZUNoZWNrZXIoYXJyYXlPZlR5cGVDaGVja2Vycykge1xuICAgIGlmICghQXJyYXkuaXNBcnJheShhcnJheU9mVHlwZUNoZWNrZXJzKSkge1xuICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/IHdhcm5pbmcoZmFsc2UsICdJbnZhbGlkIGFyZ3VtZW50IHN1cHBsaWVkIHRvIG9uZU9mVHlwZSwgZXhwZWN0ZWQgYW4gaW5zdGFuY2Ugb2YgYXJyYXkuJykgOiB2b2lkIDA7XG4gICAgICByZXR1cm4gZW1wdHlGdW5jdGlvbi50aGF0UmV0dXJuc051bGw7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnJheU9mVHlwZUNoZWNrZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgY2hlY2tlciA9IGFycmF5T2ZUeXBlQ2hlY2tlcnNbaV07XG4gICAgICBpZiAodHlwZW9mIGNoZWNrZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgd2FybmluZyhcbiAgICAgICAgICBmYWxzZSxcbiAgICAgICAgICAnSW52YWxpZCBhcmd1bWVudCBzdXBwbGlkIHRvIG9uZU9mVHlwZS4gRXhwZWN0ZWQgYW4gYXJyYXkgb2YgY2hlY2sgZnVuY3Rpb25zLCBidXQgJyArXG4gICAgICAgICAgJ3JlY2VpdmVkICVzIGF0IGluZGV4ICVzLicsXG4gICAgICAgICAgZ2V0UG9zdGZpeEZvclR5cGVXYXJuaW5nKGNoZWNrZXIpLFxuICAgICAgICAgIGlcbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIGVtcHR5RnVuY3Rpb24udGhhdFJldHVybnNOdWxsO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHZhbGlkYXRlKHByb3BzLCBwcm9wTmFtZSwgY29tcG9uZW50TmFtZSwgbG9jYXRpb24sIHByb3BGdWxsTmFtZSkge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnJheU9mVHlwZUNoZWNrZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBjaGVja2VyID0gYXJyYXlPZlR5cGVDaGVja2Vyc1tpXTtcbiAgICAgICAgaWYgKGNoZWNrZXIocHJvcHMsIHByb3BOYW1lLCBjb21wb25lbnROYW1lLCBsb2NhdGlvbiwgcHJvcEZ1bGxOYW1lLCBSZWFjdFByb3BUeXBlc1NlY3JldCkgPT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBuZXcgUHJvcFR5cGVFcnJvcignSW52YWxpZCAnICsgbG9jYXRpb24gKyAnIGAnICsgcHJvcEZ1bGxOYW1lICsgJ2Agc3VwcGxpZWQgdG8gJyArICgnYCcgKyBjb21wb25lbnROYW1lICsgJ2AuJykpO1xuICAgIH1cbiAgICByZXR1cm4gY3JlYXRlQ2hhaW5hYmxlVHlwZUNoZWNrZXIodmFsaWRhdGUpO1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlTm9kZUNoZWNrZXIoKSB7XG4gICAgZnVuY3Rpb24gdmFsaWRhdGUocHJvcHMsIHByb3BOYW1lLCBjb21wb25lbnROYW1lLCBsb2NhdGlvbiwgcHJvcEZ1bGxOYW1lKSB7XG4gICAgICBpZiAoIWlzTm9kZShwcm9wc1twcm9wTmFtZV0pKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvcFR5cGVFcnJvcignSW52YWxpZCAnICsgbG9jYXRpb24gKyAnIGAnICsgcHJvcEZ1bGxOYW1lICsgJ2Agc3VwcGxpZWQgdG8gJyArICgnYCcgKyBjb21wb25lbnROYW1lICsgJ2AsIGV4cGVjdGVkIGEgUmVhY3ROb2RlLicpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICByZXR1cm4gY3JlYXRlQ2hhaW5hYmxlVHlwZUNoZWNrZXIodmFsaWRhdGUpO1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlU2hhcGVUeXBlQ2hlY2tlcihzaGFwZVR5cGVzKSB7XG4gICAgZnVuY3Rpb24gdmFsaWRhdGUocHJvcHMsIHByb3BOYW1lLCBjb21wb25lbnROYW1lLCBsb2NhdGlvbiwgcHJvcEZ1bGxOYW1lKSB7XG4gICAgICB2YXIgcHJvcFZhbHVlID0gcHJvcHNbcHJvcE5hbWVdO1xuICAgICAgdmFyIHByb3BUeXBlID0gZ2V0UHJvcFR5cGUocHJvcFZhbHVlKTtcbiAgICAgIGlmIChwcm9wVHlwZSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9wVHlwZUVycm9yKCdJbnZhbGlkICcgKyBsb2NhdGlvbiArICcgYCcgKyBwcm9wRnVsbE5hbWUgKyAnYCBvZiB0eXBlIGAnICsgcHJvcFR5cGUgKyAnYCAnICsgKCdzdXBwbGllZCB0byBgJyArIGNvbXBvbmVudE5hbWUgKyAnYCwgZXhwZWN0ZWQgYG9iamVjdGAuJykpO1xuICAgICAgfVxuICAgICAgZm9yICh2YXIga2V5IGluIHNoYXBlVHlwZXMpIHtcbiAgICAgICAgdmFyIGNoZWNrZXIgPSBzaGFwZVR5cGVzW2tleV07XG4gICAgICAgIGlmICghY2hlY2tlcikge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHZhciBlcnJvciA9IGNoZWNrZXIocHJvcFZhbHVlLCBrZXksIGNvbXBvbmVudE5hbWUsIGxvY2F0aW9uLCBwcm9wRnVsbE5hbWUgKyAnLicgKyBrZXksIFJlYWN0UHJvcFR5cGVzU2VjcmV0KTtcbiAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgcmV0dXJuIGVycm9yO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIGNyZWF0ZUNoYWluYWJsZVR5cGVDaGVja2VyKHZhbGlkYXRlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGlzTm9kZShwcm9wVmFsdWUpIHtcbiAgICBzd2l0Y2ggKHR5cGVvZiBwcm9wVmFsdWUpIHtcbiAgICAgIGNhc2UgJ251bWJlcic6XG4gICAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgY2FzZSAndW5kZWZpbmVkJzpcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICBjYXNlICdib29sZWFuJzpcbiAgICAgICAgcmV0dXJuICFwcm9wVmFsdWU7XG4gICAgICBjYXNlICdvYmplY3QnOlxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShwcm9wVmFsdWUpKSB7XG4gICAgICAgICAgcmV0dXJuIHByb3BWYWx1ZS5ldmVyeShpc05vZGUpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChwcm9wVmFsdWUgPT09IG51bGwgfHwgaXNWYWxpZEVsZW1lbnQocHJvcFZhbHVlKSkge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGl0ZXJhdG9yRm4gPSBnZXRJdGVyYXRvckZuKHByb3BWYWx1ZSk7XG4gICAgICAgIGlmIChpdGVyYXRvckZuKSB7XG4gICAgICAgICAgdmFyIGl0ZXJhdG9yID0gaXRlcmF0b3JGbi5jYWxsKHByb3BWYWx1ZSk7XG4gICAgICAgICAgdmFyIHN0ZXA7XG4gICAgICAgICAgaWYgKGl0ZXJhdG9yRm4gIT09IHByb3BWYWx1ZS5lbnRyaWVzKSB7XG4gICAgICAgICAgICB3aGlsZSAoIShzdGVwID0gaXRlcmF0b3IubmV4dCgpKS5kb25lKSB7XG4gICAgICAgICAgICAgIGlmICghaXNOb2RlKHN0ZXAudmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIEl0ZXJhdG9yIHdpbGwgcHJvdmlkZSBlbnRyeSBbayx2XSB0dXBsZXMgcmF0aGVyIHRoYW4gdmFsdWVzLlxuICAgICAgICAgICAgd2hpbGUgKCEoc3RlcCA9IGl0ZXJhdG9yLm5leHQoKSkuZG9uZSkge1xuICAgICAgICAgICAgICB2YXIgZW50cnkgPSBzdGVwLnZhbHVlO1xuICAgICAgICAgICAgICBpZiAoZW50cnkpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWlzTm9kZShlbnRyeVsxXSkpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gaXNTeW1ib2wocHJvcFR5cGUsIHByb3BWYWx1ZSkge1xuICAgIC8vIE5hdGl2ZSBTeW1ib2wuXG4gICAgaWYgKHByb3BUeXBlID09PSAnc3ltYm9sJykge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLy8gMTkuNC4zLjUgU3ltYm9sLnByb3RvdHlwZVtAQHRvU3RyaW5nVGFnXSA9PT0gJ1N5bWJvbCdcbiAgICBpZiAocHJvcFZhbHVlWydAQHRvU3RyaW5nVGFnJ10gPT09ICdTeW1ib2wnKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBGYWxsYmFjayBmb3Igbm9uLXNwZWMgY29tcGxpYW50IFN5bWJvbHMgd2hpY2ggYXJlIHBvbHlmaWxsZWQuXG4gICAgaWYgKHR5cGVvZiBTeW1ib2wgPT09ICdmdW5jdGlvbicgJiYgcHJvcFZhbHVlIGluc3RhbmNlb2YgU3ltYm9sKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvLyBFcXVpdmFsZW50IG9mIGB0eXBlb2ZgIGJ1dCB3aXRoIHNwZWNpYWwgaGFuZGxpbmcgZm9yIGFycmF5IGFuZCByZWdleHAuXG4gIGZ1bmN0aW9uIGdldFByb3BUeXBlKHByb3BWYWx1ZSkge1xuICAgIHZhciBwcm9wVHlwZSA9IHR5cGVvZiBwcm9wVmFsdWU7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkocHJvcFZhbHVlKSkge1xuICAgICAgcmV0dXJuICdhcnJheSc7XG4gICAgfVxuICAgIGlmIChwcm9wVmFsdWUgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgIC8vIE9sZCB3ZWJraXRzIChhdCBsZWFzdCB1bnRpbCBBbmRyb2lkIDQuMCkgcmV0dXJuICdmdW5jdGlvbicgcmF0aGVyIHRoYW5cbiAgICAgIC8vICdvYmplY3QnIGZvciB0eXBlb2YgYSBSZWdFeHAuIFdlJ2xsIG5vcm1hbGl6ZSB0aGlzIGhlcmUgc28gdGhhdCAvYmxhL1xuICAgICAgLy8gcGFzc2VzIFByb3BUeXBlcy5vYmplY3QuXG4gICAgICByZXR1cm4gJ29iamVjdCc7XG4gICAgfVxuICAgIGlmIChpc1N5bWJvbChwcm9wVHlwZSwgcHJvcFZhbHVlKSkge1xuICAgICAgcmV0dXJuICdzeW1ib2wnO1xuICAgIH1cbiAgICByZXR1cm4gcHJvcFR5cGU7XG4gIH1cblxuICAvLyBUaGlzIGhhbmRsZXMgbW9yZSB0eXBlcyB0aGFuIGBnZXRQcm9wVHlwZWAuIE9ubHkgdXNlZCBmb3IgZXJyb3IgbWVzc2FnZXMuXG4gIC8vIFNlZSBgY3JlYXRlUHJpbWl0aXZlVHlwZUNoZWNrZXJgLlxuICBmdW5jdGlvbiBnZXRQcmVjaXNlVHlwZShwcm9wVmFsdWUpIHtcbiAgICBpZiAodHlwZW9mIHByb3BWYWx1ZSA9PT0gJ3VuZGVmaW5lZCcgfHwgcHJvcFZhbHVlID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gJycgKyBwcm9wVmFsdWU7XG4gICAgfVxuICAgIHZhciBwcm9wVHlwZSA9IGdldFByb3BUeXBlKHByb3BWYWx1ZSk7XG4gICAgaWYgKHByb3BUeXBlID09PSAnb2JqZWN0Jykge1xuICAgICAgaWYgKHByb3BWYWx1ZSBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgICAgcmV0dXJuICdkYXRlJztcbiAgICAgIH0gZWxzZSBpZiAocHJvcFZhbHVlIGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICAgIHJldHVybiAncmVnZXhwJztcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHByb3BUeXBlO1xuICB9XG5cbiAgLy8gUmV0dXJucyBhIHN0cmluZyB0aGF0IGlzIHBvc3RmaXhlZCB0byBhIHdhcm5pbmcgYWJvdXQgYW4gaW52YWxpZCB0eXBlLlxuICAvLyBGb3IgZXhhbXBsZSwgXCJ1bmRlZmluZWRcIiBvciBcIm9mIHR5cGUgYXJyYXlcIlxuICBmdW5jdGlvbiBnZXRQb3N0Zml4Rm9yVHlwZVdhcm5pbmcodmFsdWUpIHtcbiAgICB2YXIgdHlwZSA9IGdldFByZWNpc2VUeXBlKHZhbHVlKTtcbiAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgIGNhc2UgJ2FycmF5JzpcbiAgICAgIGNhc2UgJ29iamVjdCc6XG4gICAgICAgIHJldHVybiAnYW4gJyArIHR5cGU7XG4gICAgICBjYXNlICdib29sZWFuJzpcbiAgICAgIGNhc2UgJ2RhdGUnOlxuICAgICAgY2FzZSAncmVnZXhwJzpcbiAgICAgICAgcmV0dXJuICdhICcgKyB0eXBlO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIHR5cGU7XG4gICAgfVxuICB9XG5cbiAgLy8gUmV0dXJucyBjbGFzcyBuYW1lIG9mIHRoZSBvYmplY3QsIGlmIGFueS5cbiAgZnVuY3Rpb24gZ2V0Q2xhc3NOYW1lKHByb3BWYWx1ZSkge1xuICAgIGlmICghcHJvcFZhbHVlLmNvbnN0cnVjdG9yIHx8ICFwcm9wVmFsdWUuY29uc3RydWN0b3IubmFtZSkge1xuICAgICAgcmV0dXJuIEFOT05ZTU9VUztcbiAgICB9XG4gICAgcmV0dXJuIHByb3BWYWx1ZS5jb25zdHJ1Y3Rvci5uYW1lO1xuICB9XG5cbiAgUmVhY3RQcm9wVHlwZXMuY2hlY2tQcm9wVHlwZXMgPSBjaGVja1Byb3BUeXBlcztcbiAgUmVhY3RQcm9wVHlwZXMuUHJvcFR5cGVzID0gUmVhY3RQcm9wVHlwZXM7XG5cbiAgcmV0dXJuIFJlYWN0UHJvcFR5cGVzO1xufTtcbiIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTMtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIFJlYWN0UHJvcFR5cGVzU2VjcmV0ID0gJ1NFQ1JFVF9ET19OT1RfUEFTU19USElTX09SX1lPVV9XSUxMX0JFX0ZJUkVEJztcblxubW9kdWxlLmV4cG9ydHMgPSBSZWFjdFByb3BUeXBlc1NlY3JldDtcbiIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTMtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICpcbiAqIFxuICovXG5cbid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBFc2NhcGUgYW5kIHdyYXAga2V5IHNvIGl0IGlzIHNhZmUgdG8gdXNlIGFzIGEgcmVhY3RpZFxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgdG8gYmUgZXNjYXBlZC5cbiAqIEByZXR1cm4ge3N0cmluZ30gdGhlIGVzY2FwZWQga2V5LlxuICovXG5cbmZ1bmN0aW9uIGVzY2FwZShrZXkpIHtcbiAgdmFyIGVzY2FwZVJlZ2V4ID0gL1s9Ol0vZztcbiAgdmFyIGVzY2FwZXJMb29rdXAgPSB7XG4gICAgJz0nOiAnPTAnLFxuICAgICc6JzogJz0yJ1xuICB9O1xuICB2YXIgZXNjYXBlZFN0cmluZyA9ICgnJyArIGtleSkucmVwbGFjZShlc2NhcGVSZWdleCwgZnVuY3Rpb24gKG1hdGNoKSB7XG4gICAgcmV0dXJuIGVzY2FwZXJMb29rdXBbbWF0Y2hdO1xuICB9KTtcblxuICByZXR1cm4gJyQnICsgZXNjYXBlZFN0cmluZztcbn1cblxuLyoqXG4gKiBVbmVzY2FwZSBhbmQgdW53cmFwIGtleSBmb3IgaHVtYW4tcmVhZGFibGUgZGlzcGxheVxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgdG8gdW5lc2NhcGUuXG4gKiBAcmV0dXJuIHtzdHJpbmd9IHRoZSB1bmVzY2FwZWQga2V5LlxuICovXG5mdW5jdGlvbiB1bmVzY2FwZShrZXkpIHtcbiAgdmFyIHVuZXNjYXBlUmVnZXggPSAvKD0wfD0yKS9nO1xuICB2YXIgdW5lc2NhcGVyTG9va3VwID0ge1xuICAgICc9MCc6ICc9JyxcbiAgICAnPTInOiAnOidcbiAgfTtcbiAgdmFyIGtleVN1YnN0cmluZyA9IGtleVswXSA9PT0gJy4nICYmIGtleVsxXSA9PT0gJyQnID8ga2V5LnN1YnN0cmluZygyKSA6IGtleS5zdWJzdHJpbmcoMSk7XG5cbiAgcmV0dXJuICgnJyArIGtleVN1YnN0cmluZykucmVwbGFjZSh1bmVzY2FwZVJlZ2V4LCBmdW5jdGlvbiAobWF0Y2gpIHtcbiAgICByZXR1cm4gdW5lc2NhcGVyTG9va3VwW21hdGNoXTtcbiAgfSk7XG59XG5cbnZhciBLZXlFc2NhcGVVdGlscyA9IHtcbiAgZXNjYXBlOiBlc2NhcGUsXG4gIHVuZXNjYXBlOiB1bmVzY2FwZVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBLZXlFc2NhcGVVdGlsczsiLCIvKipcbiAqIENvcHlyaWdodCAyMDEzLXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqXG4gKiBcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBfcHJvZEludmFyaWFudCA9IHJlcXVpcmUoJy4vcmVhY3RQcm9kSW52YXJpYW50Jyk7XG5cbnZhciBpbnZhcmlhbnQgPSByZXF1aXJlKCdmYmpzL2xpYi9pbnZhcmlhbnQnKTtcblxuLyoqXG4gKiBTdGF0aWMgcG9vbGVycy4gU2V2ZXJhbCBjdXN0b20gdmVyc2lvbnMgZm9yIGVhY2ggcG90ZW50aWFsIG51bWJlciBvZlxuICogYXJndW1lbnRzLiBBIGNvbXBsZXRlbHkgZ2VuZXJpYyBwb29sZXIgaXMgZWFzeSB0byBpbXBsZW1lbnQsIGJ1dCB3b3VsZFxuICogcmVxdWlyZSBhY2Nlc3NpbmcgdGhlIGBhcmd1bWVudHNgIG9iamVjdC4gSW4gZWFjaCBvZiB0aGVzZSwgYHRoaXNgIHJlZmVycyB0b1xuICogdGhlIENsYXNzIGl0c2VsZiwgbm90IGFuIGluc3RhbmNlLiBJZiBhbnkgb3RoZXJzIGFyZSBuZWVkZWQsIHNpbXBseSBhZGQgdGhlbVxuICogaGVyZSwgb3IgaW4gdGhlaXIgb3duIGZpbGVzLlxuICovXG52YXIgb25lQXJndW1lbnRQb29sZXIgPSBmdW5jdGlvbiAoY29weUZpZWxkc0Zyb20pIHtcbiAgdmFyIEtsYXNzID0gdGhpcztcbiAgaWYgKEtsYXNzLmluc3RhbmNlUG9vbC5sZW5ndGgpIHtcbiAgICB2YXIgaW5zdGFuY2UgPSBLbGFzcy5pbnN0YW5jZVBvb2wucG9wKCk7XG4gICAgS2xhc3MuY2FsbChpbnN0YW5jZSwgY29weUZpZWxkc0Zyb20pO1xuICAgIHJldHVybiBpbnN0YW5jZTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbmV3IEtsYXNzKGNvcHlGaWVsZHNGcm9tKTtcbiAgfVxufTtcblxudmFyIHR3b0FyZ3VtZW50UG9vbGVyID0gZnVuY3Rpb24gKGExLCBhMikge1xuICB2YXIgS2xhc3MgPSB0aGlzO1xuICBpZiAoS2xhc3MuaW5zdGFuY2VQb29sLmxlbmd0aCkge1xuICAgIHZhciBpbnN0YW5jZSA9IEtsYXNzLmluc3RhbmNlUG9vbC5wb3AoKTtcbiAgICBLbGFzcy5jYWxsKGluc3RhbmNlLCBhMSwgYTIpO1xuICAgIHJldHVybiBpbnN0YW5jZTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbmV3IEtsYXNzKGExLCBhMik7XG4gIH1cbn07XG5cbnZhciB0aHJlZUFyZ3VtZW50UG9vbGVyID0gZnVuY3Rpb24gKGExLCBhMiwgYTMpIHtcbiAgdmFyIEtsYXNzID0gdGhpcztcbiAgaWYgKEtsYXNzLmluc3RhbmNlUG9vbC5sZW5ndGgpIHtcbiAgICB2YXIgaW5zdGFuY2UgPSBLbGFzcy5pbnN0YW5jZVBvb2wucG9wKCk7XG4gICAgS2xhc3MuY2FsbChpbnN0YW5jZSwgYTEsIGEyLCBhMyk7XG4gICAgcmV0dXJuIGluc3RhbmNlO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBuZXcgS2xhc3MoYTEsIGEyLCBhMyk7XG4gIH1cbn07XG5cbnZhciBmb3VyQXJndW1lbnRQb29sZXIgPSBmdW5jdGlvbiAoYTEsIGEyLCBhMywgYTQpIHtcbiAgdmFyIEtsYXNzID0gdGhpcztcbiAgaWYgKEtsYXNzLmluc3RhbmNlUG9vbC5sZW5ndGgpIHtcbiAgICB2YXIgaW5zdGFuY2UgPSBLbGFzcy5pbnN0YW5jZVBvb2wucG9wKCk7XG4gICAgS2xhc3MuY2FsbChpbnN0YW5jZSwgYTEsIGEyLCBhMywgYTQpO1xuICAgIHJldHVybiBpbnN0YW5jZTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbmV3IEtsYXNzKGExLCBhMiwgYTMsIGE0KTtcbiAgfVxufTtcblxudmFyIHN0YW5kYXJkUmVsZWFzZXIgPSBmdW5jdGlvbiAoaW5zdGFuY2UpIHtcbiAgdmFyIEtsYXNzID0gdGhpcztcbiAgIShpbnN0YW5jZSBpbnN0YW5jZW9mIEtsYXNzKSA/IHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyBpbnZhcmlhbnQoZmFsc2UsICdUcnlpbmcgdG8gcmVsZWFzZSBhbiBpbnN0YW5jZSBpbnRvIGEgcG9vbCBvZiBhIGRpZmZlcmVudCB0eXBlLicpIDogX3Byb2RJbnZhcmlhbnQoJzI1JykgOiB2b2lkIDA7XG4gIGluc3RhbmNlLmRlc3RydWN0b3IoKTtcbiAgaWYgKEtsYXNzLmluc3RhbmNlUG9vbC5sZW5ndGggPCBLbGFzcy5wb29sU2l6ZSkge1xuICAgIEtsYXNzLmluc3RhbmNlUG9vbC5wdXNoKGluc3RhbmNlKTtcbiAgfVxufTtcblxudmFyIERFRkFVTFRfUE9PTF9TSVpFID0gMTA7XG52YXIgREVGQVVMVF9QT09MRVIgPSBvbmVBcmd1bWVudFBvb2xlcjtcblxuLyoqXG4gKiBBdWdtZW50cyBgQ29weUNvbnN0cnVjdG9yYCB0byBiZSBhIHBvb2xhYmxlIGNsYXNzLCBhdWdtZW50aW5nIG9ubHkgdGhlIGNsYXNzXG4gKiBpdHNlbGYgKHN0YXRpY2FsbHkpIG5vdCBhZGRpbmcgYW55IHByb3RvdHlwaWNhbCBmaWVsZHMuIEFueSBDb3B5Q29uc3RydWN0b3JcbiAqIHlvdSBnaXZlIHRoaXMgbWF5IGhhdmUgYSBgcG9vbFNpemVgIHByb3BlcnR5LCBhbmQgd2lsbCBsb29rIGZvciBhXG4gKiBwcm90b3R5cGljYWwgYGRlc3RydWN0b3JgIG9uIGluc3RhbmNlcy5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBDb3B5Q29uc3RydWN0b3IgQ29uc3RydWN0b3IgdGhhdCBjYW4gYmUgdXNlZCB0byByZXNldC5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IHBvb2xlciBDdXN0b21pemFibGUgcG9vbGVyLlxuICovXG52YXIgYWRkUG9vbGluZ1RvID0gZnVuY3Rpb24gKENvcHlDb25zdHJ1Y3RvciwgcG9vbGVyKSB7XG4gIC8vIENhc3RpbmcgYXMgYW55IHNvIHRoYXQgZmxvdyBpZ25vcmVzIHRoZSBhY3R1YWwgaW1wbGVtZW50YXRpb24gYW5kIHRydXN0c1xuICAvLyBpdCB0byBtYXRjaCB0aGUgdHlwZSB3ZSBkZWNsYXJlZFxuICB2YXIgTmV3S2xhc3MgPSBDb3B5Q29uc3RydWN0b3I7XG4gIE5ld0tsYXNzLmluc3RhbmNlUG9vbCA9IFtdO1xuICBOZXdLbGFzcy5nZXRQb29sZWQgPSBwb29sZXIgfHwgREVGQVVMVF9QT09MRVI7XG4gIGlmICghTmV3S2xhc3MucG9vbFNpemUpIHtcbiAgICBOZXdLbGFzcy5wb29sU2l6ZSA9IERFRkFVTFRfUE9PTF9TSVpFO1xuICB9XG4gIE5ld0tsYXNzLnJlbGVhc2UgPSBzdGFuZGFyZFJlbGVhc2VyO1xuICByZXR1cm4gTmV3S2xhc3M7XG59O1xuXG52YXIgUG9vbGVkQ2xhc3MgPSB7XG4gIGFkZFBvb2xpbmdUbzogYWRkUG9vbGluZ1RvLFxuICBvbmVBcmd1bWVudFBvb2xlcjogb25lQXJndW1lbnRQb29sZXIsXG4gIHR3b0FyZ3VtZW50UG9vbGVyOiB0d29Bcmd1bWVudFBvb2xlcixcbiAgdGhyZWVBcmd1bWVudFBvb2xlcjogdGhyZWVBcmd1bWVudFBvb2xlcixcbiAgZm91ckFyZ3VtZW50UG9vbGVyOiBmb3VyQXJndW1lbnRQb29sZXJcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUG9vbGVkQ2xhc3M7IiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxMy1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIF9hc3NpZ24gPSByZXF1aXJlKCdvYmplY3QtYXNzaWduJyk7XG5cbnZhciBSZWFjdEJhc2VDbGFzc2VzID0gcmVxdWlyZSgnLi9SZWFjdEJhc2VDbGFzc2VzJyk7XG52YXIgUmVhY3RDaGlsZHJlbiA9IHJlcXVpcmUoJy4vUmVhY3RDaGlsZHJlbicpO1xudmFyIFJlYWN0RE9NRmFjdG9yaWVzID0gcmVxdWlyZSgnLi9SZWFjdERPTUZhY3RvcmllcycpO1xudmFyIFJlYWN0RWxlbWVudCA9IHJlcXVpcmUoJy4vUmVhY3RFbGVtZW50Jyk7XG52YXIgUmVhY3RQcm9wVHlwZXMgPSByZXF1aXJlKCcuL1JlYWN0UHJvcFR5cGVzJyk7XG52YXIgUmVhY3RWZXJzaW9uID0gcmVxdWlyZSgnLi9SZWFjdFZlcnNpb24nKTtcblxudmFyIGNyZWF0ZVJlYWN0Q2xhc3MgPSByZXF1aXJlKCcuL2NyZWF0ZUNsYXNzJyk7XG52YXIgb25seUNoaWxkID0gcmVxdWlyZSgnLi9vbmx5Q2hpbGQnKTtcblxudmFyIGNyZWF0ZUVsZW1lbnQgPSBSZWFjdEVsZW1lbnQuY3JlYXRlRWxlbWVudDtcbnZhciBjcmVhdGVGYWN0b3J5ID0gUmVhY3RFbGVtZW50LmNyZWF0ZUZhY3Rvcnk7XG52YXIgY2xvbmVFbGVtZW50ID0gUmVhY3RFbGVtZW50LmNsb25lRWxlbWVudDtcblxuaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgdmFyIGxvd1ByaW9yaXR5V2FybmluZyA9IHJlcXVpcmUoJy4vbG93UHJpb3JpdHlXYXJuaW5nJyk7XG4gIHZhciBjYW5EZWZpbmVQcm9wZXJ0eSA9IHJlcXVpcmUoJy4vY2FuRGVmaW5lUHJvcGVydHknKTtcbiAgdmFyIFJlYWN0RWxlbWVudFZhbGlkYXRvciA9IHJlcXVpcmUoJy4vUmVhY3RFbGVtZW50VmFsaWRhdG9yJyk7XG4gIHZhciBkaWRXYXJuUHJvcFR5cGVzRGVwcmVjYXRlZCA9IGZhbHNlO1xuICBjcmVhdGVFbGVtZW50ID0gUmVhY3RFbGVtZW50VmFsaWRhdG9yLmNyZWF0ZUVsZW1lbnQ7XG4gIGNyZWF0ZUZhY3RvcnkgPSBSZWFjdEVsZW1lbnRWYWxpZGF0b3IuY3JlYXRlRmFjdG9yeTtcbiAgY2xvbmVFbGVtZW50ID0gUmVhY3RFbGVtZW50VmFsaWRhdG9yLmNsb25lRWxlbWVudDtcbn1cblxudmFyIF9fc3ByZWFkID0gX2Fzc2lnbjtcbnZhciBjcmVhdGVNaXhpbiA9IGZ1bmN0aW9uIChtaXhpbikge1xuICByZXR1cm4gbWl4aW47XG59O1xuXG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICB2YXIgd2FybmVkRm9yU3ByZWFkID0gZmFsc2U7XG4gIHZhciB3YXJuZWRGb3JDcmVhdGVNaXhpbiA9IGZhbHNlO1xuICBfX3NwcmVhZCA9IGZ1bmN0aW9uICgpIHtcbiAgICBsb3dQcmlvcml0eVdhcm5pbmcod2FybmVkRm9yU3ByZWFkLCAnUmVhY3QuX19zcHJlYWQgaXMgZGVwcmVjYXRlZCBhbmQgc2hvdWxkIG5vdCBiZSB1c2VkLiBVc2UgJyArICdPYmplY3QuYXNzaWduIGRpcmVjdGx5IG9yIGFub3RoZXIgaGVscGVyIGZ1bmN0aW9uIHdpdGggc2ltaWxhciAnICsgJ3NlbWFudGljcy4gWW91IG1heSBiZSBzZWVpbmcgdGhpcyB3YXJuaW5nIGR1ZSB0byB5b3VyIGNvbXBpbGVyLiAnICsgJ1NlZSBodHRwczovL2ZiLm1lL3JlYWN0LXNwcmVhZC1kZXByZWNhdGlvbiBmb3IgbW9yZSBkZXRhaWxzLicpO1xuICAgIHdhcm5lZEZvclNwcmVhZCA9IHRydWU7XG4gICAgcmV0dXJuIF9hc3NpZ24uYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgfTtcblxuICBjcmVhdGVNaXhpbiA9IGZ1bmN0aW9uIChtaXhpbikge1xuICAgIGxvd1ByaW9yaXR5V2FybmluZyh3YXJuZWRGb3JDcmVhdGVNaXhpbiwgJ1JlYWN0LmNyZWF0ZU1peGluIGlzIGRlcHJlY2F0ZWQgYW5kIHNob3VsZCBub3QgYmUgdXNlZC4gJyArICdJbiBSZWFjdCB2MTYuMCwgaXQgd2lsbCBiZSByZW1vdmVkLiAnICsgJ1lvdSBjYW4gdXNlIHRoaXMgbWl4aW4gZGlyZWN0bHkgaW5zdGVhZC4gJyArICdTZWUgaHR0cHM6Ly9mYi5tZS9jcmVhdGVtaXhpbi13YXMtbmV2ZXItaW1wbGVtZW50ZWQgZm9yIG1vcmUgaW5mby4nKTtcbiAgICB3YXJuZWRGb3JDcmVhdGVNaXhpbiA9IHRydWU7XG4gICAgcmV0dXJuIG1peGluO1xuICB9O1xufVxuXG52YXIgUmVhY3QgPSB7XG4gIC8vIE1vZGVyblxuXG4gIENoaWxkcmVuOiB7XG4gICAgbWFwOiBSZWFjdENoaWxkcmVuLm1hcCxcbiAgICBmb3JFYWNoOiBSZWFjdENoaWxkcmVuLmZvckVhY2gsXG4gICAgY291bnQ6IFJlYWN0Q2hpbGRyZW4uY291bnQsXG4gICAgdG9BcnJheTogUmVhY3RDaGlsZHJlbi50b0FycmF5LFxuICAgIG9ubHk6IG9ubHlDaGlsZFxuICB9LFxuXG4gIENvbXBvbmVudDogUmVhY3RCYXNlQ2xhc3Nlcy5Db21wb25lbnQsXG4gIFB1cmVDb21wb25lbnQ6IFJlYWN0QmFzZUNsYXNzZXMuUHVyZUNvbXBvbmVudCxcblxuICBjcmVhdGVFbGVtZW50OiBjcmVhdGVFbGVtZW50LFxuICBjbG9uZUVsZW1lbnQ6IGNsb25lRWxlbWVudCxcbiAgaXNWYWxpZEVsZW1lbnQ6IFJlYWN0RWxlbWVudC5pc1ZhbGlkRWxlbWVudCxcblxuICAvLyBDbGFzc2ljXG5cbiAgUHJvcFR5cGVzOiBSZWFjdFByb3BUeXBlcyxcbiAgY3JlYXRlQ2xhc3M6IGNyZWF0ZVJlYWN0Q2xhc3MsXG4gIGNyZWF0ZUZhY3Rvcnk6IGNyZWF0ZUZhY3RvcnksXG4gIGNyZWF0ZU1peGluOiBjcmVhdGVNaXhpbixcblxuICAvLyBUaGlzIGxvb2tzIERPTSBzcGVjaWZpYyBidXQgdGhlc2UgYXJlIGFjdHVhbGx5IGlzb21vcnBoaWMgaGVscGVyc1xuICAvLyBzaW5jZSB0aGV5IGFyZSBqdXN0IGdlbmVyYXRpbmcgRE9NIHN0cmluZ3MuXG4gIERPTTogUmVhY3RET01GYWN0b3JpZXMsXG5cbiAgdmVyc2lvbjogUmVhY3RWZXJzaW9uLFxuXG4gIC8vIERlcHJlY2F0ZWQgaG9vayBmb3IgSlNYIHNwcmVhZCwgZG9uJ3QgdXNlIHRoaXMgZm9yIGFueXRoaW5nLlxuICBfX3NwcmVhZDogX19zcHJlYWRcbn07XG5cbmlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gIHZhciB3YXJuZWRGb3JDcmVhdGVDbGFzcyA9IGZhbHNlO1xuICBpZiAoY2FuRGVmaW5lUHJvcGVydHkpIHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoUmVhY3QsICdQcm9wVHlwZXMnLCB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgbG93UHJpb3JpdHlXYXJuaW5nKGRpZFdhcm5Qcm9wVHlwZXNEZXByZWNhdGVkLCAnQWNjZXNzaW5nIFByb3BUeXBlcyB2aWEgdGhlIG1haW4gUmVhY3QgcGFja2FnZSBpcyBkZXByZWNhdGVkLCcgKyAnIGFuZCB3aWxsIGJlIHJlbW92ZWQgaW4gIFJlYWN0IHYxNi4wLicgKyAnIFVzZSB0aGUgbGF0ZXN0IGF2YWlsYWJsZSB2MTUuKiBwcm9wLXR5cGVzIHBhY2thZ2UgZnJvbSBucG0gaW5zdGVhZC4nICsgJyBGb3IgaW5mbyBvbiB1c2FnZSwgY29tcGF0aWJpbGl0eSwgbWlncmF0aW9uIGFuZCBtb3JlLCBzZWUgJyArICdodHRwczovL2ZiLm1lL3Byb3AtdHlwZXMtZG9jcycpO1xuICAgICAgICBkaWRXYXJuUHJvcFR5cGVzRGVwcmVjYXRlZCA9IHRydWU7XG4gICAgICAgIHJldHVybiBSZWFjdFByb3BUeXBlcztcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShSZWFjdCwgJ2NyZWF0ZUNsYXNzJywge1xuICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGxvd1ByaW9yaXR5V2FybmluZyh3YXJuZWRGb3JDcmVhdGVDbGFzcywgJ0FjY2Vzc2luZyBjcmVhdGVDbGFzcyB2aWEgdGhlIG1haW4gUmVhY3QgcGFja2FnZSBpcyBkZXByZWNhdGVkLCcgKyAnIGFuZCB3aWxsIGJlIHJlbW92ZWQgaW4gUmVhY3QgdjE2LjAuJyArIFwiIFVzZSBhIHBsYWluIEphdmFTY3JpcHQgY2xhc3MgaW5zdGVhZC4gSWYgeW91J3JlIG5vdCB5ZXQgXCIgKyAncmVhZHkgdG8gbWlncmF0ZSwgY3JlYXRlLXJlYWN0LWNsYXNzIHYxNS4qIGlzIGF2YWlsYWJsZSAnICsgJ29uIG5wbSBhcyBhIHRlbXBvcmFyeSwgZHJvcC1pbiByZXBsYWNlbWVudC4gJyArICdGb3IgbW9yZSBpbmZvIHNlZSBodHRwczovL2ZiLm1lL3JlYWN0LWNyZWF0ZS1jbGFzcycpO1xuICAgICAgICB3YXJuZWRGb3JDcmVhdGVDbGFzcyA9IHRydWU7XG4gICAgICAgIHJldHVybiBjcmVhdGVSZWFjdENsYXNzO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLy8gUmVhY3QuRE9NIGZhY3RvcmllcyBhcmUgZGVwcmVjYXRlZC4gV3JhcCB0aGVzZSBtZXRob2RzIHNvIHRoYXRcbiAgLy8gaW52b2NhdGlvbnMgb2YgdGhlIFJlYWN0LkRPTSBuYW1lc3BhY2UgYW5kIGFsZXJ0IHVzZXJzIHRvIHN3aXRjaFxuICAvLyB0byB0aGUgYHJlYWN0LWRvbS1mYWN0b3JpZXNgIHBhY2thZ2UuXG4gIFJlYWN0LkRPTSA9IHt9O1xuICB2YXIgd2FybmVkRm9yRmFjdG9yaWVzID0gZmFsc2U7XG4gIE9iamVjdC5rZXlzKFJlYWN0RE9NRmFjdG9yaWVzKS5mb3JFYWNoKGZ1bmN0aW9uIChmYWN0b3J5KSB7XG4gICAgUmVhY3QuRE9NW2ZhY3RvcnldID0gZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKCF3YXJuZWRGb3JGYWN0b3JpZXMpIHtcbiAgICAgICAgbG93UHJpb3JpdHlXYXJuaW5nKGZhbHNlLCAnQWNjZXNzaW5nIGZhY3RvcmllcyBsaWtlIFJlYWN0LkRPTS4lcyBoYXMgYmVlbiBkZXByZWNhdGVkICcgKyAnYW5kIHdpbGwgYmUgcmVtb3ZlZCBpbiB2MTYuMCsuIFVzZSB0aGUgJyArICdyZWFjdC1kb20tZmFjdG9yaWVzIHBhY2thZ2UgaW5zdGVhZC4gJyArICcgVmVyc2lvbiAxLjAgcHJvdmlkZXMgYSBkcm9wLWluIHJlcGxhY2VtZW50LicgKyAnIEZvciBtb3JlIGluZm8sIHNlZSBodHRwczovL2ZiLm1lL3JlYWN0LWRvbS1mYWN0b3JpZXMnLCBmYWN0b3J5KTtcbiAgICAgICAgd2FybmVkRm9yRmFjdG9yaWVzID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBSZWFjdERPTUZhY3Rvcmllc1tmYWN0b3J5XS5hcHBseShSZWFjdERPTUZhY3RvcmllcywgYXJndW1lbnRzKTtcbiAgICB9O1xuICB9KTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBSZWFjdDsiLCIvKipcbiAqIENvcHlyaWdodCAyMDEzLXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgX3Byb2RJbnZhcmlhbnQgPSByZXF1aXJlKCcuL3JlYWN0UHJvZEludmFyaWFudCcpLFxuICAgIF9hc3NpZ24gPSByZXF1aXJlKCdvYmplY3QtYXNzaWduJyk7XG5cbnZhciBSZWFjdE5vb3BVcGRhdGVRdWV1ZSA9IHJlcXVpcmUoJy4vUmVhY3ROb29wVXBkYXRlUXVldWUnKTtcblxudmFyIGNhbkRlZmluZVByb3BlcnR5ID0gcmVxdWlyZSgnLi9jYW5EZWZpbmVQcm9wZXJ0eScpO1xudmFyIGVtcHR5T2JqZWN0ID0gcmVxdWlyZSgnZmJqcy9saWIvZW1wdHlPYmplY3QnKTtcbnZhciBpbnZhcmlhbnQgPSByZXF1aXJlKCdmYmpzL2xpYi9pbnZhcmlhbnQnKTtcbnZhciBsb3dQcmlvcml0eVdhcm5pbmcgPSByZXF1aXJlKCcuL2xvd1ByaW9yaXR5V2FybmluZycpO1xuXG4vKipcbiAqIEJhc2UgY2xhc3MgaGVscGVycyBmb3IgdGhlIHVwZGF0aW5nIHN0YXRlIG9mIGEgY29tcG9uZW50LlxuICovXG5mdW5jdGlvbiBSZWFjdENvbXBvbmVudChwcm9wcywgY29udGV4dCwgdXBkYXRlcikge1xuICB0aGlzLnByb3BzID0gcHJvcHM7XG4gIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG4gIHRoaXMucmVmcyA9IGVtcHR5T2JqZWN0O1xuICAvLyBXZSBpbml0aWFsaXplIHRoZSBkZWZhdWx0IHVwZGF0ZXIgYnV0IHRoZSByZWFsIG9uZSBnZXRzIGluamVjdGVkIGJ5IHRoZVxuICAvLyByZW5kZXJlci5cbiAgdGhpcy51cGRhdGVyID0gdXBkYXRlciB8fCBSZWFjdE5vb3BVcGRhdGVRdWV1ZTtcbn1cblxuUmVhY3RDb21wb25lbnQucHJvdG90eXBlLmlzUmVhY3RDb21wb25lbnQgPSB7fTtcblxuLyoqXG4gKiBTZXRzIGEgc3Vic2V0IG9mIHRoZSBzdGF0ZS4gQWx3YXlzIHVzZSB0aGlzIHRvIG11dGF0ZVxuICogc3RhdGUuIFlvdSBzaG91bGQgdHJlYXQgYHRoaXMuc3RhdGVgIGFzIGltbXV0YWJsZS5cbiAqXG4gKiBUaGVyZSBpcyBubyBndWFyYW50ZWUgdGhhdCBgdGhpcy5zdGF0ZWAgd2lsbCBiZSBpbW1lZGlhdGVseSB1cGRhdGVkLCBzb1xuICogYWNjZXNzaW5nIGB0aGlzLnN0YXRlYCBhZnRlciBjYWxsaW5nIHRoaXMgbWV0aG9kIG1heSByZXR1cm4gdGhlIG9sZCB2YWx1ZS5cbiAqXG4gKiBUaGVyZSBpcyBubyBndWFyYW50ZWUgdGhhdCBjYWxscyB0byBgc2V0U3RhdGVgIHdpbGwgcnVuIHN5bmNocm9ub3VzbHksXG4gKiBhcyB0aGV5IG1heSBldmVudHVhbGx5IGJlIGJhdGNoZWQgdG9nZXRoZXIuICBZb3UgY2FuIHByb3ZpZGUgYW4gb3B0aW9uYWxcbiAqIGNhbGxiYWNrIHRoYXQgd2lsbCBiZSBleGVjdXRlZCB3aGVuIHRoZSBjYWxsIHRvIHNldFN0YXRlIGlzIGFjdHVhbGx5XG4gKiBjb21wbGV0ZWQuXG4gKlxuICogV2hlbiBhIGZ1bmN0aW9uIGlzIHByb3ZpZGVkIHRvIHNldFN0YXRlLCBpdCB3aWxsIGJlIGNhbGxlZCBhdCBzb21lIHBvaW50IGluXG4gKiB0aGUgZnV0dXJlIChub3Qgc3luY2hyb25vdXNseSkuIEl0IHdpbGwgYmUgY2FsbGVkIHdpdGggdGhlIHVwIHRvIGRhdGVcbiAqIGNvbXBvbmVudCBhcmd1bWVudHMgKHN0YXRlLCBwcm9wcywgY29udGV4dCkuIFRoZXNlIHZhbHVlcyBjYW4gYmUgZGlmZmVyZW50XG4gKiBmcm9tIHRoaXMuKiBiZWNhdXNlIHlvdXIgZnVuY3Rpb24gbWF5IGJlIGNhbGxlZCBhZnRlciByZWNlaXZlUHJvcHMgYnV0IGJlZm9yZVxuICogc2hvdWxkQ29tcG9uZW50VXBkYXRlLCBhbmQgdGhpcyBuZXcgc3RhdGUsIHByb3BzLCBhbmQgY29udGV4dCB3aWxsIG5vdCB5ZXQgYmVcbiAqIGFzc2lnbmVkIHRvIHRoaXMuXG4gKlxuICogQHBhcmFtIHtvYmplY3R8ZnVuY3Rpb259IHBhcnRpYWxTdGF0ZSBOZXh0IHBhcnRpYWwgc3RhdGUgb3IgZnVuY3Rpb24gdG9cbiAqICAgICAgICBwcm9kdWNlIG5leHQgcGFydGlhbCBzdGF0ZSB0byBiZSBtZXJnZWQgd2l0aCBjdXJyZW50IHN0YXRlLlxuICogQHBhcmFtIHs/ZnVuY3Rpb259IGNhbGxiYWNrIENhbGxlZCBhZnRlciBzdGF0ZSBpcyB1cGRhdGVkLlxuICogQGZpbmFsXG4gKiBAcHJvdGVjdGVkXG4gKi9cblJlYWN0Q29tcG9uZW50LnByb3RvdHlwZS5zZXRTdGF0ZSA9IGZ1bmN0aW9uIChwYXJ0aWFsU3RhdGUsIGNhbGxiYWNrKSB7XG4gICEodHlwZW9mIHBhcnRpYWxTdGF0ZSA9PT0gJ29iamVjdCcgfHwgdHlwZW9mIHBhcnRpYWxTdGF0ZSA9PT0gJ2Z1bmN0aW9uJyB8fCBwYXJ0aWFsU3RhdGUgPT0gbnVsbCkgPyBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nID8gaW52YXJpYW50KGZhbHNlLCAnc2V0U3RhdGUoLi4uKTogdGFrZXMgYW4gb2JqZWN0IG9mIHN0YXRlIHZhcmlhYmxlcyB0byB1cGRhdGUgb3IgYSBmdW5jdGlvbiB3aGljaCByZXR1cm5zIGFuIG9iamVjdCBvZiBzdGF0ZSB2YXJpYWJsZXMuJykgOiBfcHJvZEludmFyaWFudCgnODUnKSA6IHZvaWQgMDtcbiAgdGhpcy51cGRhdGVyLmVucXVldWVTZXRTdGF0ZSh0aGlzLCBwYXJ0aWFsU3RhdGUpO1xuICBpZiAoY2FsbGJhY2spIHtcbiAgICB0aGlzLnVwZGF0ZXIuZW5xdWV1ZUNhbGxiYWNrKHRoaXMsIGNhbGxiYWNrLCAnc2V0U3RhdGUnKTtcbiAgfVxufTtcblxuLyoqXG4gKiBGb3JjZXMgYW4gdXBkYXRlLiBUaGlzIHNob3VsZCBvbmx5IGJlIGludm9rZWQgd2hlbiBpdCBpcyBrbm93biB3aXRoXG4gKiBjZXJ0YWludHkgdGhhdCB3ZSBhcmUgKipub3QqKiBpbiBhIERPTSB0cmFuc2FjdGlvbi5cbiAqXG4gKiBZb3UgbWF5IHdhbnQgdG8gY2FsbCB0aGlzIHdoZW4geW91IGtub3cgdGhhdCBzb21lIGRlZXBlciBhc3BlY3Qgb2YgdGhlXG4gKiBjb21wb25lbnQncyBzdGF0ZSBoYXMgY2hhbmdlZCBidXQgYHNldFN0YXRlYCB3YXMgbm90IGNhbGxlZC5cbiAqXG4gKiBUaGlzIHdpbGwgbm90IGludm9rZSBgc2hvdWxkQ29tcG9uZW50VXBkYXRlYCwgYnV0IGl0IHdpbGwgaW52b2tlXG4gKiBgY29tcG9uZW50V2lsbFVwZGF0ZWAgYW5kIGBjb21wb25lbnREaWRVcGRhdGVgLlxuICpcbiAqIEBwYXJhbSB7P2Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsZWQgYWZ0ZXIgdXBkYXRlIGlzIGNvbXBsZXRlLlxuICogQGZpbmFsXG4gKiBAcHJvdGVjdGVkXG4gKi9cblJlYWN0Q29tcG9uZW50LnByb3RvdHlwZS5mb3JjZVVwZGF0ZSA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICB0aGlzLnVwZGF0ZXIuZW5xdWV1ZUZvcmNlVXBkYXRlKHRoaXMpO1xuICBpZiAoY2FsbGJhY2spIHtcbiAgICB0aGlzLnVwZGF0ZXIuZW5xdWV1ZUNhbGxiYWNrKHRoaXMsIGNhbGxiYWNrLCAnZm9yY2VVcGRhdGUnKTtcbiAgfVxufTtcblxuLyoqXG4gKiBEZXByZWNhdGVkIEFQSXMuIFRoZXNlIEFQSXMgdXNlZCB0byBleGlzdCBvbiBjbGFzc2ljIFJlYWN0IGNsYXNzZXMgYnV0IHNpbmNlXG4gKiB3ZSB3b3VsZCBsaWtlIHRvIGRlcHJlY2F0ZSB0aGVtLCB3ZSdyZSBub3QgZ29pbmcgdG8gbW92ZSB0aGVtIG92ZXIgdG8gdGhpc1xuICogbW9kZXJuIGJhc2UgY2xhc3MuIEluc3RlYWQsIHdlIGRlZmluZSBhIGdldHRlciB0aGF0IHdhcm5zIGlmIGl0J3MgYWNjZXNzZWQuXG4gKi9cbmlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gIHZhciBkZXByZWNhdGVkQVBJcyA9IHtcbiAgICBpc01vdW50ZWQ6IFsnaXNNb3VudGVkJywgJ0luc3RlYWQsIG1ha2Ugc3VyZSB0byBjbGVhbiB1cCBzdWJzY3JpcHRpb25zIGFuZCBwZW5kaW5nIHJlcXVlc3RzIGluICcgKyAnY29tcG9uZW50V2lsbFVubW91bnQgdG8gcHJldmVudCBtZW1vcnkgbGVha3MuJ10sXG4gICAgcmVwbGFjZVN0YXRlOiBbJ3JlcGxhY2VTdGF0ZScsICdSZWZhY3RvciB5b3VyIGNvZGUgdG8gdXNlIHNldFN0YXRlIGluc3RlYWQgKHNlZSAnICsgJ2h0dHBzOi8vZ2l0aHViLmNvbS9mYWNlYm9vay9yZWFjdC9pc3N1ZXMvMzIzNikuJ11cbiAgfTtcbiAgdmFyIGRlZmluZURlcHJlY2F0aW9uV2FybmluZyA9IGZ1bmN0aW9uIChtZXRob2ROYW1lLCBpbmZvKSB7XG4gICAgaWYgKGNhbkRlZmluZVByb3BlcnR5KSB7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoUmVhY3RDb21wb25lbnQucHJvdG90eXBlLCBtZXRob2ROYW1lLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGxvd1ByaW9yaXR5V2FybmluZyhmYWxzZSwgJyVzKC4uLikgaXMgZGVwcmVjYXRlZCBpbiBwbGFpbiBKYXZhU2NyaXB0IFJlYWN0IGNsYXNzZXMuICVzJywgaW5mb1swXSwgaW5mb1sxXSk7XG4gICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9O1xuICBmb3IgKHZhciBmbk5hbWUgaW4gZGVwcmVjYXRlZEFQSXMpIHtcbiAgICBpZiAoZGVwcmVjYXRlZEFQSXMuaGFzT3duUHJvcGVydHkoZm5OYW1lKSkge1xuICAgICAgZGVmaW5lRGVwcmVjYXRpb25XYXJuaW5nKGZuTmFtZSwgZGVwcmVjYXRlZEFQSXNbZm5OYW1lXSk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQmFzZSBjbGFzcyBoZWxwZXJzIGZvciB0aGUgdXBkYXRpbmcgc3RhdGUgb2YgYSBjb21wb25lbnQuXG4gKi9cbmZ1bmN0aW9uIFJlYWN0UHVyZUNvbXBvbmVudChwcm9wcywgY29udGV4dCwgdXBkYXRlcikge1xuICAvLyBEdXBsaWNhdGVkIGZyb20gUmVhY3RDb21wb25lbnQuXG4gIHRoaXMucHJvcHMgPSBwcm9wcztcbiAgdGhpcy5jb250ZXh0ID0gY29udGV4dDtcbiAgdGhpcy5yZWZzID0gZW1wdHlPYmplY3Q7XG4gIC8vIFdlIGluaXRpYWxpemUgdGhlIGRlZmF1bHQgdXBkYXRlciBidXQgdGhlIHJlYWwgb25lIGdldHMgaW5qZWN0ZWQgYnkgdGhlXG4gIC8vIHJlbmRlcmVyLlxuICB0aGlzLnVwZGF0ZXIgPSB1cGRhdGVyIHx8IFJlYWN0Tm9vcFVwZGF0ZVF1ZXVlO1xufVxuXG5mdW5jdGlvbiBDb21wb25lbnREdW1teSgpIHt9XG5Db21wb25lbnREdW1teS5wcm90b3R5cGUgPSBSZWFjdENvbXBvbmVudC5wcm90b3R5cGU7XG5SZWFjdFB1cmVDb21wb25lbnQucHJvdG90eXBlID0gbmV3IENvbXBvbmVudER1bW15KCk7XG5SZWFjdFB1cmVDb21wb25lbnQucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gUmVhY3RQdXJlQ29tcG9uZW50O1xuLy8gQXZvaWQgYW4gZXh0cmEgcHJvdG90eXBlIGp1bXAgZm9yIHRoZXNlIG1ldGhvZHMuXG5fYXNzaWduKFJlYWN0UHVyZUNvbXBvbmVudC5wcm90b3R5cGUsIFJlYWN0Q29tcG9uZW50LnByb3RvdHlwZSk7XG5SZWFjdFB1cmVDb21wb25lbnQucHJvdG90eXBlLmlzUHVyZVJlYWN0Q29tcG9uZW50ID0gdHJ1ZTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIENvbXBvbmVudDogUmVhY3RDb21wb25lbnQsXG4gIFB1cmVDb21wb25lbnQ6IFJlYWN0UHVyZUNvbXBvbmVudFxufTsiLCIvKipcbiAqIENvcHlyaWdodCAyMDEzLXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgUG9vbGVkQ2xhc3MgPSByZXF1aXJlKCcuL1Bvb2xlZENsYXNzJyk7XG52YXIgUmVhY3RFbGVtZW50ID0gcmVxdWlyZSgnLi9SZWFjdEVsZW1lbnQnKTtcblxudmFyIGVtcHR5RnVuY3Rpb24gPSByZXF1aXJlKCdmYmpzL2xpYi9lbXB0eUZ1bmN0aW9uJyk7XG52YXIgdHJhdmVyc2VBbGxDaGlsZHJlbiA9IHJlcXVpcmUoJy4vdHJhdmVyc2VBbGxDaGlsZHJlbicpO1xuXG52YXIgdHdvQXJndW1lbnRQb29sZXIgPSBQb29sZWRDbGFzcy50d29Bcmd1bWVudFBvb2xlcjtcbnZhciBmb3VyQXJndW1lbnRQb29sZXIgPSBQb29sZWRDbGFzcy5mb3VyQXJndW1lbnRQb29sZXI7XG5cbnZhciB1c2VyUHJvdmlkZWRLZXlFc2NhcGVSZWdleCA9IC9cXC8rL2c7XG5mdW5jdGlvbiBlc2NhcGVVc2VyUHJvdmlkZWRLZXkodGV4dCkge1xuICByZXR1cm4gKCcnICsgdGV4dCkucmVwbGFjZSh1c2VyUHJvdmlkZWRLZXlFc2NhcGVSZWdleCwgJyQmLycpO1xufVxuXG4vKipcbiAqIFBvb2xlZENsYXNzIHJlcHJlc2VudGluZyB0aGUgYm9va2tlZXBpbmcgYXNzb2NpYXRlZCB3aXRoIHBlcmZvcm1pbmcgYSBjaGlsZFxuICogdHJhdmVyc2FsLiBBbGxvd3MgYXZvaWRpbmcgYmluZGluZyBjYWxsYmFja3MuXG4gKlxuICogQGNvbnN0cnVjdG9yIEZvckVhY2hCb29rS2VlcGluZ1xuICogQHBhcmFtIHshZnVuY3Rpb259IGZvckVhY2hGdW5jdGlvbiBGdW5jdGlvbiB0byBwZXJmb3JtIHRyYXZlcnNhbCB3aXRoLlxuICogQHBhcmFtIHs/Kn0gZm9yRWFjaENvbnRleHQgQ29udGV4dCB0byBwZXJmb3JtIGNvbnRleHQgd2l0aC5cbiAqL1xuZnVuY3Rpb24gRm9yRWFjaEJvb2tLZWVwaW5nKGZvckVhY2hGdW5jdGlvbiwgZm9yRWFjaENvbnRleHQpIHtcbiAgdGhpcy5mdW5jID0gZm9yRWFjaEZ1bmN0aW9uO1xuICB0aGlzLmNvbnRleHQgPSBmb3JFYWNoQ29udGV4dDtcbiAgdGhpcy5jb3VudCA9IDA7XG59XG5Gb3JFYWNoQm9va0tlZXBpbmcucHJvdG90eXBlLmRlc3RydWN0b3IgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMuZnVuYyA9IG51bGw7XG4gIHRoaXMuY29udGV4dCA9IG51bGw7XG4gIHRoaXMuY291bnQgPSAwO1xufTtcblBvb2xlZENsYXNzLmFkZFBvb2xpbmdUbyhGb3JFYWNoQm9va0tlZXBpbmcsIHR3b0FyZ3VtZW50UG9vbGVyKTtcblxuZnVuY3Rpb24gZm9yRWFjaFNpbmdsZUNoaWxkKGJvb2tLZWVwaW5nLCBjaGlsZCwgbmFtZSkge1xuICB2YXIgZnVuYyA9IGJvb2tLZWVwaW5nLmZ1bmMsXG4gICAgICBjb250ZXh0ID0gYm9va0tlZXBpbmcuY29udGV4dDtcblxuICBmdW5jLmNhbGwoY29udGV4dCwgY2hpbGQsIGJvb2tLZWVwaW5nLmNvdW50KyspO1xufVxuXG4vKipcbiAqIEl0ZXJhdGVzIHRocm91Z2ggY2hpbGRyZW4gdGhhdCBhcmUgdHlwaWNhbGx5IHNwZWNpZmllZCBhcyBgcHJvcHMuY2hpbGRyZW5gLlxuICpcbiAqIFNlZSBodHRwczovL2ZhY2Vib29rLmdpdGh1Yi5pby9yZWFjdC9kb2NzL3RvcC1sZXZlbC1hcGkuaHRtbCNyZWFjdC5jaGlsZHJlbi5mb3JlYWNoXG4gKlxuICogVGhlIHByb3ZpZGVkIGZvckVhY2hGdW5jKGNoaWxkLCBpbmRleCkgd2lsbCBiZSBjYWxsZWQgZm9yIGVhY2hcbiAqIGxlYWYgY2hpbGQuXG4gKlxuICogQHBhcmFtIHs/Kn0gY2hpbGRyZW4gQ2hpbGRyZW4gdHJlZSBjb250YWluZXIuXG4gKiBAcGFyYW0ge2Z1bmN0aW9uKCosIGludCl9IGZvckVhY2hGdW5jXG4gKiBAcGFyYW0geyp9IGZvckVhY2hDb250ZXh0IENvbnRleHQgZm9yIGZvckVhY2hDb250ZXh0LlxuICovXG5mdW5jdGlvbiBmb3JFYWNoQ2hpbGRyZW4oY2hpbGRyZW4sIGZvckVhY2hGdW5jLCBmb3JFYWNoQ29udGV4dCkge1xuICBpZiAoY2hpbGRyZW4gPT0gbnVsbCkge1xuICAgIHJldHVybiBjaGlsZHJlbjtcbiAgfVxuICB2YXIgdHJhdmVyc2VDb250ZXh0ID0gRm9yRWFjaEJvb2tLZWVwaW5nLmdldFBvb2xlZChmb3JFYWNoRnVuYywgZm9yRWFjaENvbnRleHQpO1xuICB0cmF2ZXJzZUFsbENoaWxkcmVuKGNoaWxkcmVuLCBmb3JFYWNoU2luZ2xlQ2hpbGQsIHRyYXZlcnNlQ29udGV4dCk7XG4gIEZvckVhY2hCb29rS2VlcGluZy5yZWxlYXNlKHRyYXZlcnNlQ29udGV4dCk7XG59XG5cbi8qKlxuICogUG9vbGVkQ2xhc3MgcmVwcmVzZW50aW5nIHRoZSBib29ra2VlcGluZyBhc3NvY2lhdGVkIHdpdGggcGVyZm9ybWluZyBhIGNoaWxkXG4gKiBtYXBwaW5nLiBBbGxvd3MgYXZvaWRpbmcgYmluZGluZyBjYWxsYmFja3MuXG4gKlxuICogQGNvbnN0cnVjdG9yIE1hcEJvb2tLZWVwaW5nXG4gKiBAcGFyYW0geyEqfSBtYXBSZXN1bHQgT2JqZWN0IGNvbnRhaW5pbmcgdGhlIG9yZGVyZWQgbWFwIG9mIHJlc3VsdHMuXG4gKiBAcGFyYW0geyFmdW5jdGlvbn0gbWFwRnVuY3Rpb24gRnVuY3Rpb24gdG8gcGVyZm9ybSBtYXBwaW5nIHdpdGguXG4gKiBAcGFyYW0gez8qfSBtYXBDb250ZXh0IENvbnRleHQgdG8gcGVyZm9ybSBtYXBwaW5nIHdpdGguXG4gKi9cbmZ1bmN0aW9uIE1hcEJvb2tLZWVwaW5nKG1hcFJlc3VsdCwga2V5UHJlZml4LCBtYXBGdW5jdGlvbiwgbWFwQ29udGV4dCkge1xuICB0aGlzLnJlc3VsdCA9IG1hcFJlc3VsdDtcbiAgdGhpcy5rZXlQcmVmaXggPSBrZXlQcmVmaXg7XG4gIHRoaXMuZnVuYyA9IG1hcEZ1bmN0aW9uO1xuICB0aGlzLmNvbnRleHQgPSBtYXBDb250ZXh0O1xuICB0aGlzLmNvdW50ID0gMDtcbn1cbk1hcEJvb2tLZWVwaW5nLnByb3RvdHlwZS5kZXN0cnVjdG9yID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLnJlc3VsdCA9IG51bGw7XG4gIHRoaXMua2V5UHJlZml4ID0gbnVsbDtcbiAgdGhpcy5mdW5jID0gbnVsbDtcbiAgdGhpcy5jb250ZXh0ID0gbnVsbDtcbiAgdGhpcy5jb3VudCA9IDA7XG59O1xuUG9vbGVkQ2xhc3MuYWRkUG9vbGluZ1RvKE1hcEJvb2tLZWVwaW5nLCBmb3VyQXJndW1lbnRQb29sZXIpO1xuXG5mdW5jdGlvbiBtYXBTaW5nbGVDaGlsZEludG9Db250ZXh0KGJvb2tLZWVwaW5nLCBjaGlsZCwgY2hpbGRLZXkpIHtcbiAgdmFyIHJlc3VsdCA9IGJvb2tLZWVwaW5nLnJlc3VsdCxcbiAgICAgIGtleVByZWZpeCA9IGJvb2tLZWVwaW5nLmtleVByZWZpeCxcbiAgICAgIGZ1bmMgPSBib29rS2VlcGluZy5mdW5jLFxuICAgICAgY29udGV4dCA9IGJvb2tLZWVwaW5nLmNvbnRleHQ7XG5cblxuICB2YXIgbWFwcGVkQ2hpbGQgPSBmdW5jLmNhbGwoY29udGV4dCwgY2hpbGQsIGJvb2tLZWVwaW5nLmNvdW50KyspO1xuICBpZiAoQXJyYXkuaXNBcnJheShtYXBwZWRDaGlsZCkpIHtcbiAgICBtYXBJbnRvV2l0aEtleVByZWZpeEludGVybmFsKG1hcHBlZENoaWxkLCByZXN1bHQsIGNoaWxkS2V5LCBlbXB0eUZ1bmN0aW9uLnRoYXRSZXR1cm5zQXJndW1lbnQpO1xuICB9IGVsc2UgaWYgKG1hcHBlZENoaWxkICE9IG51bGwpIHtcbiAgICBpZiAoUmVhY3RFbGVtZW50LmlzVmFsaWRFbGVtZW50KG1hcHBlZENoaWxkKSkge1xuICAgICAgbWFwcGVkQ2hpbGQgPSBSZWFjdEVsZW1lbnQuY2xvbmVBbmRSZXBsYWNlS2V5KG1hcHBlZENoaWxkLFxuICAgICAgLy8gS2VlcCBib3RoIHRoZSAobWFwcGVkKSBhbmQgb2xkIGtleXMgaWYgdGhleSBkaWZmZXIsIGp1c3QgYXNcbiAgICAgIC8vIHRyYXZlcnNlQWxsQ2hpbGRyZW4gdXNlZCB0byBkbyBmb3Igb2JqZWN0cyBhcyBjaGlsZHJlblxuICAgICAga2V5UHJlZml4ICsgKG1hcHBlZENoaWxkLmtleSAmJiAoIWNoaWxkIHx8IGNoaWxkLmtleSAhPT0gbWFwcGVkQ2hpbGQua2V5KSA/IGVzY2FwZVVzZXJQcm92aWRlZEtleShtYXBwZWRDaGlsZC5rZXkpICsgJy8nIDogJycpICsgY2hpbGRLZXkpO1xuICAgIH1cbiAgICByZXN1bHQucHVzaChtYXBwZWRDaGlsZCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gbWFwSW50b1dpdGhLZXlQcmVmaXhJbnRlcm5hbChjaGlsZHJlbiwgYXJyYXksIHByZWZpeCwgZnVuYywgY29udGV4dCkge1xuICB2YXIgZXNjYXBlZFByZWZpeCA9ICcnO1xuICBpZiAocHJlZml4ICE9IG51bGwpIHtcbiAgICBlc2NhcGVkUHJlZml4ID0gZXNjYXBlVXNlclByb3ZpZGVkS2V5KHByZWZpeCkgKyAnLyc7XG4gIH1cbiAgdmFyIHRyYXZlcnNlQ29udGV4dCA9IE1hcEJvb2tLZWVwaW5nLmdldFBvb2xlZChhcnJheSwgZXNjYXBlZFByZWZpeCwgZnVuYywgY29udGV4dCk7XG4gIHRyYXZlcnNlQWxsQ2hpbGRyZW4oY2hpbGRyZW4sIG1hcFNpbmdsZUNoaWxkSW50b0NvbnRleHQsIHRyYXZlcnNlQ29udGV4dCk7XG4gIE1hcEJvb2tLZWVwaW5nLnJlbGVhc2UodHJhdmVyc2VDb250ZXh0KTtcbn1cblxuLyoqXG4gKiBNYXBzIGNoaWxkcmVuIHRoYXQgYXJlIHR5cGljYWxseSBzcGVjaWZpZWQgYXMgYHByb3BzLmNoaWxkcmVuYC5cbiAqXG4gKiBTZWUgaHR0cHM6Ly9mYWNlYm9vay5naXRodWIuaW8vcmVhY3QvZG9jcy90b3AtbGV2ZWwtYXBpLmh0bWwjcmVhY3QuY2hpbGRyZW4ubWFwXG4gKlxuICogVGhlIHByb3ZpZGVkIG1hcEZ1bmN0aW9uKGNoaWxkLCBrZXksIGluZGV4KSB3aWxsIGJlIGNhbGxlZCBmb3IgZWFjaFxuICogbGVhZiBjaGlsZC5cbiAqXG4gKiBAcGFyYW0gez8qfSBjaGlsZHJlbiBDaGlsZHJlbiB0cmVlIGNvbnRhaW5lci5cbiAqIEBwYXJhbSB7ZnVuY3Rpb24oKiwgaW50KX0gZnVuYyBUaGUgbWFwIGZ1bmN0aW9uLlxuICogQHBhcmFtIHsqfSBjb250ZXh0IENvbnRleHQgZm9yIG1hcEZ1bmN0aW9uLlxuICogQHJldHVybiB7b2JqZWN0fSBPYmplY3QgY29udGFpbmluZyB0aGUgb3JkZXJlZCBtYXAgb2YgcmVzdWx0cy5cbiAqL1xuZnVuY3Rpb24gbWFwQ2hpbGRyZW4oY2hpbGRyZW4sIGZ1bmMsIGNvbnRleHQpIHtcbiAgaWYgKGNoaWxkcmVuID09IG51bGwpIHtcbiAgICByZXR1cm4gY2hpbGRyZW47XG4gIH1cbiAgdmFyIHJlc3VsdCA9IFtdO1xuICBtYXBJbnRvV2l0aEtleVByZWZpeEludGVybmFsKGNoaWxkcmVuLCByZXN1bHQsIG51bGwsIGZ1bmMsIGNvbnRleHQpO1xuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBmb3JFYWNoU2luZ2xlQ2hpbGREdW1teSh0cmF2ZXJzZUNvbnRleHQsIGNoaWxkLCBuYW1lKSB7XG4gIHJldHVybiBudWxsO1xufVxuXG4vKipcbiAqIENvdW50IHRoZSBudW1iZXIgb2YgY2hpbGRyZW4gdGhhdCBhcmUgdHlwaWNhbGx5IHNwZWNpZmllZCBhc1xuICogYHByb3BzLmNoaWxkcmVuYC5cbiAqXG4gKiBTZWUgaHR0cHM6Ly9mYWNlYm9vay5naXRodWIuaW8vcmVhY3QvZG9jcy90b3AtbGV2ZWwtYXBpLmh0bWwjcmVhY3QuY2hpbGRyZW4uY291bnRcbiAqXG4gKiBAcGFyYW0gez8qfSBjaGlsZHJlbiBDaGlsZHJlbiB0cmVlIGNvbnRhaW5lci5cbiAqIEByZXR1cm4ge251bWJlcn0gVGhlIG51bWJlciBvZiBjaGlsZHJlbi5cbiAqL1xuZnVuY3Rpb24gY291bnRDaGlsZHJlbihjaGlsZHJlbiwgY29udGV4dCkge1xuICByZXR1cm4gdHJhdmVyc2VBbGxDaGlsZHJlbihjaGlsZHJlbiwgZm9yRWFjaFNpbmdsZUNoaWxkRHVtbXksIG51bGwpO1xufVxuXG4vKipcbiAqIEZsYXR0ZW4gYSBjaGlsZHJlbiBvYmplY3QgKHR5cGljYWxseSBzcGVjaWZpZWQgYXMgYHByb3BzLmNoaWxkcmVuYCkgYW5kXG4gKiByZXR1cm4gYW4gYXJyYXkgd2l0aCBhcHByb3ByaWF0ZWx5IHJlLWtleWVkIGNoaWxkcmVuLlxuICpcbiAqIFNlZSBodHRwczovL2ZhY2Vib29rLmdpdGh1Yi5pby9yZWFjdC9kb2NzL3RvcC1sZXZlbC1hcGkuaHRtbCNyZWFjdC5jaGlsZHJlbi50b2FycmF5XG4gKi9cbmZ1bmN0aW9uIHRvQXJyYXkoY2hpbGRyZW4pIHtcbiAgdmFyIHJlc3VsdCA9IFtdO1xuICBtYXBJbnRvV2l0aEtleVByZWZpeEludGVybmFsKGNoaWxkcmVuLCByZXN1bHQsIG51bGwsIGVtcHR5RnVuY3Rpb24udGhhdFJldHVybnNBcmd1bWVudCk7XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbnZhciBSZWFjdENoaWxkcmVuID0ge1xuICBmb3JFYWNoOiBmb3JFYWNoQ2hpbGRyZW4sXG4gIG1hcDogbWFwQ2hpbGRyZW4sXG4gIG1hcEludG9XaXRoS2V5UHJlZml4SW50ZXJuYWw6IG1hcEludG9XaXRoS2V5UHJlZml4SW50ZXJuYWwsXG4gIGNvdW50OiBjb3VudENoaWxkcmVuLFxuICB0b0FycmF5OiB0b0FycmF5XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFJlYWN0Q2hpbGRyZW47IiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNi1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICogXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgX3Byb2RJbnZhcmlhbnQgPSByZXF1aXJlKCcuL3JlYWN0UHJvZEludmFyaWFudCcpO1xuXG52YXIgUmVhY3RDdXJyZW50T3duZXIgPSByZXF1aXJlKCcuL1JlYWN0Q3VycmVudE93bmVyJyk7XG5cbnZhciBpbnZhcmlhbnQgPSByZXF1aXJlKCdmYmpzL2xpYi9pbnZhcmlhbnQnKTtcbnZhciB3YXJuaW5nID0gcmVxdWlyZSgnZmJqcy9saWIvd2FybmluZycpO1xuXG5mdW5jdGlvbiBpc05hdGl2ZShmbikge1xuICAvLyBCYXNlZCBvbiBpc05hdGl2ZSgpIGZyb20gTG9kYXNoXG4gIHZhciBmdW5jVG9TdHJpbmcgPSBGdW5jdGlvbi5wcm90b3R5cGUudG9TdHJpbmc7XG4gIHZhciBoYXNPd25Qcm9wZXJ0eSA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG4gIHZhciByZUlzTmF0aXZlID0gUmVnRXhwKCdeJyArIGZ1bmNUb1N0cmluZ1xuICAvLyBUYWtlIGFuIGV4YW1wbGUgbmF0aXZlIGZ1bmN0aW9uIHNvdXJjZSBmb3IgY29tcGFyaXNvblxuICAuY2FsbChoYXNPd25Qcm9wZXJ0eVxuICAvLyBTdHJpcCByZWdleCBjaGFyYWN0ZXJzIHNvIHdlIGNhbiB1c2UgaXQgZm9yIHJlZ2V4XG4gICkucmVwbGFjZSgvW1xcXFxeJC4qKz8oKVtcXF17fXxdL2csICdcXFxcJCYnXG4gIC8vIFJlbW92ZSBoYXNPd25Qcm9wZXJ0eSBmcm9tIHRoZSB0ZW1wbGF0ZSB0byBtYWtlIGl0IGdlbmVyaWNcbiAgKS5yZXBsYWNlKC9oYXNPd25Qcm9wZXJ0eXwoZnVuY3Rpb24pLio/KD89XFxcXFxcKCl8IGZvciAuKz8oPz1cXFxcXFxdKS9nLCAnJDEuKj8nKSArICckJyk7XG4gIHRyeSB7XG4gICAgdmFyIHNvdXJjZSA9IGZ1bmNUb1N0cmluZy5jYWxsKGZuKTtcbiAgICByZXR1cm4gcmVJc05hdGl2ZS50ZXN0KHNvdXJjZSk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG52YXIgY2FuVXNlQ29sbGVjdGlvbnMgPVxuLy8gQXJyYXkuZnJvbVxudHlwZW9mIEFycmF5LmZyb20gPT09ICdmdW5jdGlvbicgJiZcbi8vIE1hcFxudHlwZW9mIE1hcCA9PT0gJ2Z1bmN0aW9uJyAmJiBpc05hdGl2ZShNYXApICYmXG4vLyBNYXAucHJvdG90eXBlLmtleXNcbk1hcC5wcm90b3R5cGUgIT0gbnVsbCAmJiB0eXBlb2YgTWFwLnByb3RvdHlwZS5rZXlzID09PSAnZnVuY3Rpb24nICYmIGlzTmF0aXZlKE1hcC5wcm90b3R5cGUua2V5cykgJiZcbi8vIFNldFxudHlwZW9mIFNldCA9PT0gJ2Z1bmN0aW9uJyAmJiBpc05hdGl2ZShTZXQpICYmXG4vLyBTZXQucHJvdG90eXBlLmtleXNcblNldC5wcm90b3R5cGUgIT0gbnVsbCAmJiB0eXBlb2YgU2V0LnByb3RvdHlwZS5rZXlzID09PSAnZnVuY3Rpb24nICYmIGlzTmF0aXZlKFNldC5wcm90b3R5cGUua2V5cyk7XG5cbnZhciBzZXRJdGVtO1xudmFyIGdldEl0ZW07XG52YXIgcmVtb3ZlSXRlbTtcbnZhciBnZXRJdGVtSURzO1xudmFyIGFkZFJvb3Q7XG52YXIgcmVtb3ZlUm9vdDtcbnZhciBnZXRSb290SURzO1xuXG5pZiAoY2FuVXNlQ29sbGVjdGlvbnMpIHtcbiAgdmFyIGl0ZW1NYXAgPSBuZXcgTWFwKCk7XG4gIHZhciByb290SURTZXQgPSBuZXcgU2V0KCk7XG5cbiAgc2V0SXRlbSA9IGZ1bmN0aW9uIChpZCwgaXRlbSkge1xuICAgIGl0ZW1NYXAuc2V0KGlkLCBpdGVtKTtcbiAgfTtcbiAgZ2V0SXRlbSA9IGZ1bmN0aW9uIChpZCkge1xuICAgIHJldHVybiBpdGVtTWFwLmdldChpZCk7XG4gIH07XG4gIHJlbW92ZUl0ZW0gPSBmdW5jdGlvbiAoaWQpIHtcbiAgICBpdGVtTWFwWydkZWxldGUnXShpZCk7XG4gIH07XG4gIGdldEl0ZW1JRHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIEFycmF5LmZyb20oaXRlbU1hcC5rZXlzKCkpO1xuICB9O1xuXG4gIGFkZFJvb3QgPSBmdW5jdGlvbiAoaWQpIHtcbiAgICByb290SURTZXQuYWRkKGlkKTtcbiAgfTtcbiAgcmVtb3ZlUm9vdCA9IGZ1bmN0aW9uIChpZCkge1xuICAgIHJvb3RJRFNldFsnZGVsZXRlJ10oaWQpO1xuICB9O1xuICBnZXRSb290SURzID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBBcnJheS5mcm9tKHJvb3RJRFNldC5rZXlzKCkpO1xuICB9O1xufSBlbHNlIHtcbiAgdmFyIGl0ZW1CeUtleSA9IHt9O1xuICB2YXIgcm9vdEJ5S2V5ID0ge307XG5cbiAgLy8gVXNlIG5vbi1udW1lcmljIGtleXMgdG8gcHJldmVudCBWOCBwZXJmb3JtYW5jZSBpc3N1ZXM6XG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9mYWNlYm9vay9yZWFjdC9wdWxsLzcyMzJcbiAgdmFyIGdldEtleUZyb21JRCA9IGZ1bmN0aW9uIChpZCkge1xuICAgIHJldHVybiAnLicgKyBpZDtcbiAgfTtcbiAgdmFyIGdldElERnJvbUtleSA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICByZXR1cm4gcGFyc2VJbnQoa2V5LnN1YnN0cigxKSwgMTApO1xuICB9O1xuXG4gIHNldEl0ZW0gPSBmdW5jdGlvbiAoaWQsIGl0ZW0pIHtcbiAgICB2YXIga2V5ID0gZ2V0S2V5RnJvbUlEKGlkKTtcbiAgICBpdGVtQnlLZXlba2V5XSA9IGl0ZW07XG4gIH07XG4gIGdldEl0ZW0gPSBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIga2V5ID0gZ2V0S2V5RnJvbUlEKGlkKTtcbiAgICByZXR1cm4gaXRlbUJ5S2V5W2tleV07XG4gIH07XG4gIHJlbW92ZUl0ZW0gPSBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIga2V5ID0gZ2V0S2V5RnJvbUlEKGlkKTtcbiAgICBkZWxldGUgaXRlbUJ5S2V5W2tleV07XG4gIH07XG4gIGdldEl0ZW1JRHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKGl0ZW1CeUtleSkubWFwKGdldElERnJvbUtleSk7XG4gIH07XG5cbiAgYWRkUm9vdCA9IGZ1bmN0aW9uIChpZCkge1xuICAgIHZhciBrZXkgPSBnZXRLZXlGcm9tSUQoaWQpO1xuICAgIHJvb3RCeUtleVtrZXldID0gdHJ1ZTtcbiAgfTtcbiAgcmVtb3ZlUm9vdCA9IGZ1bmN0aW9uIChpZCkge1xuICAgIHZhciBrZXkgPSBnZXRLZXlGcm9tSUQoaWQpO1xuICAgIGRlbGV0ZSByb290QnlLZXlba2V5XTtcbiAgfTtcbiAgZ2V0Um9vdElEcyA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXMocm9vdEJ5S2V5KS5tYXAoZ2V0SURGcm9tS2V5KTtcbiAgfTtcbn1cblxudmFyIHVubW91bnRlZElEcyA9IFtdO1xuXG5mdW5jdGlvbiBwdXJnZURlZXAoaWQpIHtcbiAgdmFyIGl0ZW0gPSBnZXRJdGVtKGlkKTtcbiAgaWYgKGl0ZW0pIHtcbiAgICB2YXIgY2hpbGRJRHMgPSBpdGVtLmNoaWxkSURzO1xuXG4gICAgcmVtb3ZlSXRlbShpZCk7XG4gICAgY2hpbGRJRHMuZm9yRWFjaChwdXJnZURlZXApO1xuICB9XG59XG5cbmZ1bmN0aW9uIGRlc2NyaWJlQ29tcG9uZW50RnJhbWUobmFtZSwgc291cmNlLCBvd25lck5hbWUpIHtcbiAgcmV0dXJuICdcXG4gICAgaW4gJyArIChuYW1lIHx8ICdVbmtub3duJykgKyAoc291cmNlID8gJyAoYXQgJyArIHNvdXJjZS5maWxlTmFtZS5yZXBsYWNlKC9eLipbXFxcXFxcL10vLCAnJykgKyAnOicgKyBzb3VyY2UubGluZU51bWJlciArICcpJyA6IG93bmVyTmFtZSA/ICcgKGNyZWF0ZWQgYnkgJyArIG93bmVyTmFtZSArICcpJyA6ICcnKTtcbn1cblxuZnVuY3Rpb24gZ2V0RGlzcGxheU5hbWUoZWxlbWVudCkge1xuICBpZiAoZWxlbWVudCA9PSBudWxsKSB7XG4gICAgcmV0dXJuICcjZW1wdHknO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBlbGVtZW50ID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgZWxlbWVudCA9PT0gJ251bWJlcicpIHtcbiAgICByZXR1cm4gJyN0ZXh0JztcbiAgfSBlbHNlIGlmICh0eXBlb2YgZWxlbWVudC50eXBlID09PSAnc3RyaW5nJykge1xuICAgIHJldHVybiBlbGVtZW50LnR5cGU7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGVsZW1lbnQudHlwZS5kaXNwbGF5TmFtZSB8fCBlbGVtZW50LnR5cGUubmFtZSB8fCAnVW5rbm93bic7XG4gIH1cbn1cblxuZnVuY3Rpb24gZGVzY3JpYmVJRChpZCkge1xuICB2YXIgbmFtZSA9IFJlYWN0Q29tcG9uZW50VHJlZUhvb2suZ2V0RGlzcGxheU5hbWUoaWQpO1xuICB2YXIgZWxlbWVudCA9IFJlYWN0Q29tcG9uZW50VHJlZUhvb2suZ2V0RWxlbWVudChpZCk7XG4gIHZhciBvd25lcklEID0gUmVhY3RDb21wb25lbnRUcmVlSG9vay5nZXRPd25lcklEKGlkKTtcbiAgdmFyIG93bmVyTmFtZTtcbiAgaWYgKG93bmVySUQpIHtcbiAgICBvd25lck5hbWUgPSBSZWFjdENvbXBvbmVudFRyZWVIb29rLmdldERpc3BsYXlOYW1lKG93bmVySUQpO1xuICB9XG4gIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyB3YXJuaW5nKGVsZW1lbnQsICdSZWFjdENvbXBvbmVudFRyZWVIb29rOiBNaXNzaW5nIFJlYWN0IGVsZW1lbnQgZm9yIGRlYnVnSUQgJXMgd2hlbiAnICsgJ2J1aWxkaW5nIHN0YWNrJywgaWQpIDogdm9pZCAwO1xuICByZXR1cm4gZGVzY3JpYmVDb21wb25lbnRGcmFtZShuYW1lLCBlbGVtZW50ICYmIGVsZW1lbnQuX3NvdXJjZSwgb3duZXJOYW1lKTtcbn1cblxudmFyIFJlYWN0Q29tcG9uZW50VHJlZUhvb2sgPSB7XG4gIG9uU2V0Q2hpbGRyZW46IGZ1bmN0aW9uIChpZCwgbmV4dENoaWxkSURzKSB7XG4gICAgdmFyIGl0ZW0gPSBnZXRJdGVtKGlkKTtcbiAgICAhaXRlbSA/IHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyBpbnZhcmlhbnQoZmFsc2UsICdJdGVtIG11c3QgaGF2ZSBiZWVuIHNldCcpIDogX3Byb2RJbnZhcmlhbnQoJzE0NCcpIDogdm9pZCAwO1xuICAgIGl0ZW0uY2hpbGRJRHMgPSBuZXh0Q2hpbGRJRHM7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG5leHRDaGlsZElEcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIG5leHRDaGlsZElEID0gbmV4dENoaWxkSURzW2ldO1xuICAgICAgdmFyIG5leHRDaGlsZCA9IGdldEl0ZW0obmV4dENoaWxkSUQpO1xuICAgICAgIW5leHRDaGlsZCA/IHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyBpbnZhcmlhbnQoZmFsc2UsICdFeHBlY3RlZCBob29rIGV2ZW50cyB0byBmaXJlIGZvciB0aGUgY2hpbGQgYmVmb3JlIGl0cyBwYXJlbnQgaW5jbHVkZXMgaXQgaW4gb25TZXRDaGlsZHJlbigpLicpIDogX3Byb2RJbnZhcmlhbnQoJzE0MCcpIDogdm9pZCAwO1xuICAgICAgIShuZXh0Q2hpbGQuY2hpbGRJRHMgIT0gbnVsbCB8fCB0eXBlb2YgbmV4dENoaWxkLmVsZW1lbnQgIT09ICdvYmplY3QnIHx8IG5leHRDaGlsZC5lbGVtZW50ID09IG51bGwpID8gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/IGludmFyaWFudChmYWxzZSwgJ0V4cGVjdGVkIG9uU2V0Q2hpbGRyZW4oKSB0byBmaXJlIGZvciBhIGNvbnRhaW5lciBjaGlsZCBiZWZvcmUgaXRzIHBhcmVudCBpbmNsdWRlcyBpdCBpbiBvblNldENoaWxkcmVuKCkuJykgOiBfcHJvZEludmFyaWFudCgnMTQxJykgOiB2b2lkIDA7XG4gICAgICAhbmV4dENoaWxkLmlzTW91bnRlZCA/IHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyBpbnZhcmlhbnQoZmFsc2UsICdFeHBlY3RlZCBvbk1vdW50Q29tcG9uZW50KCkgdG8gZmlyZSBmb3IgdGhlIGNoaWxkIGJlZm9yZSBpdHMgcGFyZW50IGluY2x1ZGVzIGl0IGluIG9uU2V0Q2hpbGRyZW4oKS4nKSA6IF9wcm9kSW52YXJpYW50KCc3MScpIDogdm9pZCAwO1xuICAgICAgaWYgKG5leHRDaGlsZC5wYXJlbnRJRCA9PSBudWxsKSB7XG4gICAgICAgIG5leHRDaGlsZC5wYXJlbnRJRCA9IGlkO1xuICAgICAgICAvLyBUT0RPOiBUaGlzIHNob3VsZG4ndCBiZSBuZWNlc3NhcnkgYnV0IG1vdW50aW5nIGEgbmV3IHJvb3QgZHVyaW5nIGluXG4gICAgICAgIC8vIGNvbXBvbmVudFdpbGxNb3VudCBjdXJyZW50bHkgY2F1c2VzIG5vdC15ZXQtbW91bnRlZCBjb21wb25lbnRzIHRvXG4gICAgICAgIC8vIGJlIHB1cmdlZCBmcm9tIG91ciB0cmVlIGRhdGEgc28gdGhlaXIgcGFyZW50IGlkIGlzIG1pc3NpbmcuXG4gICAgICB9XG4gICAgICAhKG5leHRDaGlsZC5wYXJlbnRJRCA9PT0gaWQpID8gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/IGludmFyaWFudChmYWxzZSwgJ0V4cGVjdGVkIG9uQmVmb3JlTW91bnRDb21wb25lbnQoKSBwYXJlbnQgYW5kIG9uU2V0Q2hpbGRyZW4oKSB0byBiZSBjb25zaXN0ZW50ICglcyBoYXMgcGFyZW50cyAlcyBhbmQgJXMpLicsIG5leHRDaGlsZElELCBuZXh0Q2hpbGQucGFyZW50SUQsIGlkKSA6IF9wcm9kSW52YXJpYW50KCcxNDInLCBuZXh0Q2hpbGRJRCwgbmV4dENoaWxkLnBhcmVudElELCBpZCkgOiB2b2lkIDA7XG4gICAgfVxuICB9LFxuICBvbkJlZm9yZU1vdW50Q29tcG9uZW50OiBmdW5jdGlvbiAoaWQsIGVsZW1lbnQsIHBhcmVudElEKSB7XG4gICAgdmFyIGl0ZW0gPSB7XG4gICAgICBlbGVtZW50OiBlbGVtZW50LFxuICAgICAgcGFyZW50SUQ6IHBhcmVudElELFxuICAgICAgdGV4dDogbnVsbCxcbiAgICAgIGNoaWxkSURzOiBbXSxcbiAgICAgIGlzTW91bnRlZDogZmFsc2UsXG4gICAgICB1cGRhdGVDb3VudDogMFxuICAgIH07XG4gICAgc2V0SXRlbShpZCwgaXRlbSk7XG4gIH0sXG4gIG9uQmVmb3JlVXBkYXRlQ29tcG9uZW50OiBmdW5jdGlvbiAoaWQsIGVsZW1lbnQpIHtcbiAgICB2YXIgaXRlbSA9IGdldEl0ZW0oaWQpO1xuICAgIGlmICghaXRlbSB8fCAhaXRlbS5pc01vdW50ZWQpIHtcbiAgICAgIC8vIFdlIG1heSBlbmQgdXAgaGVyZSBhcyBhIHJlc3VsdCBvZiBzZXRTdGF0ZSgpIGluIGNvbXBvbmVudFdpbGxVbm1vdW50KCkuXG4gICAgICAvLyBJbiB0aGlzIGNhc2UsIGlnbm9yZSB0aGUgZWxlbWVudC5cbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaXRlbS5lbGVtZW50ID0gZWxlbWVudDtcbiAgfSxcbiAgb25Nb3VudENvbXBvbmVudDogZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIGl0ZW0gPSBnZXRJdGVtKGlkKTtcbiAgICAhaXRlbSA/IHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyBpbnZhcmlhbnQoZmFsc2UsICdJdGVtIG11c3QgaGF2ZSBiZWVuIHNldCcpIDogX3Byb2RJbnZhcmlhbnQoJzE0NCcpIDogdm9pZCAwO1xuICAgIGl0ZW0uaXNNb3VudGVkID0gdHJ1ZTtcbiAgICB2YXIgaXNSb290ID0gaXRlbS5wYXJlbnRJRCA9PT0gMDtcbiAgICBpZiAoaXNSb290KSB7XG4gICAgICBhZGRSb290KGlkKTtcbiAgICB9XG4gIH0sXG4gIG9uVXBkYXRlQ29tcG9uZW50OiBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIgaXRlbSA9IGdldEl0ZW0oaWQpO1xuICAgIGlmICghaXRlbSB8fCAhaXRlbS5pc01vdW50ZWQpIHtcbiAgICAgIC8vIFdlIG1heSBlbmQgdXAgaGVyZSBhcyBhIHJlc3VsdCBvZiBzZXRTdGF0ZSgpIGluIGNvbXBvbmVudFdpbGxVbm1vdW50KCkuXG4gICAgICAvLyBJbiB0aGlzIGNhc2UsIGlnbm9yZSB0aGUgZWxlbWVudC5cbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaXRlbS51cGRhdGVDb3VudCsrO1xuICB9LFxuICBvblVubW91bnRDb21wb25lbnQ6IGZ1bmN0aW9uIChpZCkge1xuICAgIHZhciBpdGVtID0gZ2V0SXRlbShpZCk7XG4gICAgaWYgKGl0ZW0pIHtcbiAgICAgIC8vIFdlIG5lZWQgdG8gY2hlY2sgaWYgaXQgZXhpc3RzLlxuICAgICAgLy8gYGl0ZW1gIG1pZ2h0IG5vdCBleGlzdCBpZiBpdCBpcyBpbnNpZGUgYW4gZXJyb3IgYm91bmRhcnksIGFuZCBhIHNpYmxpbmdcbiAgICAgIC8vIGVycm9yIGJvdW5kYXJ5IGNoaWxkIHRocmV3IHdoaWxlIG1vdW50aW5nLiBUaGVuIHRoaXMgaW5zdGFuY2UgbmV2ZXJcbiAgICAgIC8vIGdvdCBhIGNoYW5jZSB0byBtb3VudCwgYnV0IGl0IHN0aWxsIGdldHMgYW4gdW5tb3VudGluZyBldmVudCBkdXJpbmdcbiAgICAgIC8vIHRoZSBlcnJvciBib3VuZGFyeSBjbGVhbnVwLlxuICAgICAgaXRlbS5pc01vdW50ZWQgPSBmYWxzZTtcbiAgICAgIHZhciBpc1Jvb3QgPSBpdGVtLnBhcmVudElEID09PSAwO1xuICAgICAgaWYgKGlzUm9vdCkge1xuICAgICAgICByZW1vdmVSb290KGlkKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdW5tb3VudGVkSURzLnB1c2goaWQpO1xuICB9LFxuICBwdXJnZVVubW91bnRlZENvbXBvbmVudHM6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoUmVhY3RDb21wb25lbnRUcmVlSG9vay5fcHJldmVudFB1cmdpbmcpIHtcbiAgICAgIC8vIFNob3VsZCBvbmx5IGJlIHVzZWQgZm9yIHRlc3RpbmcuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB1bm1vdW50ZWRJRHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBpZCA9IHVubW91bnRlZElEc1tpXTtcbiAgICAgIHB1cmdlRGVlcChpZCk7XG4gICAgfVxuICAgIHVubW91bnRlZElEcy5sZW5ndGggPSAwO1xuICB9LFxuICBpc01vdW50ZWQ6IGZ1bmN0aW9uIChpZCkge1xuICAgIHZhciBpdGVtID0gZ2V0SXRlbShpZCk7XG4gICAgcmV0dXJuIGl0ZW0gPyBpdGVtLmlzTW91bnRlZCA6IGZhbHNlO1xuICB9LFxuICBnZXRDdXJyZW50U3RhY2tBZGRlbmR1bTogZnVuY3Rpb24gKHRvcEVsZW1lbnQpIHtcbiAgICB2YXIgaW5mbyA9ICcnO1xuICAgIGlmICh0b3BFbGVtZW50KSB7XG4gICAgICB2YXIgbmFtZSA9IGdldERpc3BsYXlOYW1lKHRvcEVsZW1lbnQpO1xuICAgICAgdmFyIG93bmVyID0gdG9wRWxlbWVudC5fb3duZXI7XG4gICAgICBpbmZvICs9IGRlc2NyaWJlQ29tcG9uZW50RnJhbWUobmFtZSwgdG9wRWxlbWVudC5fc291cmNlLCBvd25lciAmJiBvd25lci5nZXROYW1lKCkpO1xuICAgIH1cblxuICAgIHZhciBjdXJyZW50T3duZXIgPSBSZWFjdEN1cnJlbnRPd25lci5jdXJyZW50O1xuICAgIHZhciBpZCA9IGN1cnJlbnRPd25lciAmJiBjdXJyZW50T3duZXIuX2RlYnVnSUQ7XG5cbiAgICBpbmZvICs9IFJlYWN0Q29tcG9uZW50VHJlZUhvb2suZ2V0U3RhY2tBZGRlbmR1bUJ5SUQoaWQpO1xuICAgIHJldHVybiBpbmZvO1xuICB9LFxuICBnZXRTdGFja0FkZGVuZHVtQnlJRDogZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIGluZm8gPSAnJztcbiAgICB3aGlsZSAoaWQpIHtcbiAgICAgIGluZm8gKz0gZGVzY3JpYmVJRChpZCk7XG4gICAgICBpZCA9IFJlYWN0Q29tcG9uZW50VHJlZUhvb2suZ2V0UGFyZW50SUQoaWQpO1xuICAgIH1cbiAgICByZXR1cm4gaW5mbztcbiAgfSxcbiAgZ2V0Q2hpbGRJRHM6IGZ1bmN0aW9uIChpZCkge1xuICAgIHZhciBpdGVtID0gZ2V0SXRlbShpZCk7XG4gICAgcmV0dXJuIGl0ZW0gPyBpdGVtLmNoaWxkSURzIDogW107XG4gIH0sXG4gIGdldERpc3BsYXlOYW1lOiBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIgZWxlbWVudCA9IFJlYWN0Q29tcG9uZW50VHJlZUhvb2suZ2V0RWxlbWVudChpZCk7XG4gICAgaWYgKCFlbGVtZW50KSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIGdldERpc3BsYXlOYW1lKGVsZW1lbnQpO1xuICB9LFxuICBnZXRFbGVtZW50OiBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIgaXRlbSA9IGdldEl0ZW0oaWQpO1xuICAgIHJldHVybiBpdGVtID8gaXRlbS5lbGVtZW50IDogbnVsbDtcbiAgfSxcbiAgZ2V0T3duZXJJRDogZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIGVsZW1lbnQgPSBSZWFjdENvbXBvbmVudFRyZWVIb29rLmdldEVsZW1lbnQoaWQpO1xuICAgIGlmICghZWxlbWVudCB8fCAhZWxlbWVudC5fb3duZXIpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICByZXR1cm4gZWxlbWVudC5fb3duZXIuX2RlYnVnSUQ7XG4gIH0sXG4gIGdldFBhcmVudElEOiBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIgaXRlbSA9IGdldEl0ZW0oaWQpO1xuICAgIHJldHVybiBpdGVtID8gaXRlbS5wYXJlbnRJRCA6IG51bGw7XG4gIH0sXG4gIGdldFNvdXJjZTogZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIGl0ZW0gPSBnZXRJdGVtKGlkKTtcbiAgICB2YXIgZWxlbWVudCA9IGl0ZW0gPyBpdGVtLmVsZW1lbnQgOiBudWxsO1xuICAgIHZhciBzb3VyY2UgPSBlbGVtZW50ICE9IG51bGwgPyBlbGVtZW50Ll9zb3VyY2UgOiBudWxsO1xuICAgIHJldHVybiBzb3VyY2U7XG4gIH0sXG4gIGdldFRleHQ6IGZ1bmN0aW9uIChpZCkge1xuICAgIHZhciBlbGVtZW50ID0gUmVhY3RDb21wb25lbnRUcmVlSG9vay5nZXRFbGVtZW50KGlkKTtcbiAgICBpZiAodHlwZW9mIGVsZW1lbnQgPT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gZWxlbWVudDtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBlbGVtZW50ID09PSAnbnVtYmVyJykge1xuICAgICAgcmV0dXJuICcnICsgZWxlbWVudDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9LFxuICBnZXRVcGRhdGVDb3VudDogZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIGl0ZW0gPSBnZXRJdGVtKGlkKTtcbiAgICByZXR1cm4gaXRlbSA/IGl0ZW0udXBkYXRlQ291bnQgOiAwO1xuICB9LFxuXG5cbiAgZ2V0Um9vdElEczogZ2V0Um9vdElEcyxcbiAgZ2V0UmVnaXN0ZXJlZElEczogZ2V0SXRlbUlEcyxcblxuICBwdXNoTm9uU3RhbmRhcmRXYXJuaW5nU3RhY2s6IGZ1bmN0aW9uIChpc0NyZWF0aW5nRWxlbWVudCwgY3VycmVudFNvdXJjZSkge1xuICAgIGlmICh0eXBlb2YgY29uc29sZS5yZWFjdFN0YWNrICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIHN0YWNrID0gW107XG4gICAgdmFyIGN1cnJlbnRPd25lciA9IFJlYWN0Q3VycmVudE93bmVyLmN1cnJlbnQ7XG4gICAgdmFyIGlkID0gY3VycmVudE93bmVyICYmIGN1cnJlbnRPd25lci5fZGVidWdJRDtcblxuICAgIHRyeSB7XG4gICAgICBpZiAoaXNDcmVhdGluZ0VsZW1lbnQpIHtcbiAgICAgICAgc3RhY2sucHVzaCh7XG4gICAgICAgICAgbmFtZTogaWQgPyBSZWFjdENvbXBvbmVudFRyZWVIb29rLmdldERpc3BsYXlOYW1lKGlkKSA6IG51bGwsXG4gICAgICAgICAgZmlsZU5hbWU6IGN1cnJlbnRTb3VyY2UgPyBjdXJyZW50U291cmNlLmZpbGVOYW1lIDogbnVsbCxcbiAgICAgICAgICBsaW5lTnVtYmVyOiBjdXJyZW50U291cmNlID8gY3VycmVudFNvdXJjZS5saW5lTnVtYmVyIDogbnVsbFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgd2hpbGUgKGlkKSB7XG4gICAgICAgIHZhciBlbGVtZW50ID0gUmVhY3RDb21wb25lbnRUcmVlSG9vay5nZXRFbGVtZW50KGlkKTtcbiAgICAgICAgdmFyIHBhcmVudElEID0gUmVhY3RDb21wb25lbnRUcmVlSG9vay5nZXRQYXJlbnRJRChpZCk7XG4gICAgICAgIHZhciBvd25lcklEID0gUmVhY3RDb21wb25lbnRUcmVlSG9vay5nZXRPd25lcklEKGlkKTtcbiAgICAgICAgdmFyIG93bmVyTmFtZSA9IG93bmVySUQgPyBSZWFjdENvbXBvbmVudFRyZWVIb29rLmdldERpc3BsYXlOYW1lKG93bmVySUQpIDogbnVsbDtcbiAgICAgICAgdmFyIHNvdXJjZSA9IGVsZW1lbnQgJiYgZWxlbWVudC5fc291cmNlO1xuICAgICAgICBzdGFjay5wdXNoKHtcbiAgICAgICAgICBuYW1lOiBvd25lck5hbWUsXG4gICAgICAgICAgZmlsZU5hbWU6IHNvdXJjZSA/IHNvdXJjZS5maWxlTmFtZSA6IG51bGwsXG4gICAgICAgICAgbGluZU51bWJlcjogc291cmNlID8gc291cmNlLmxpbmVOdW1iZXIgOiBudWxsXG4gICAgICAgIH0pO1xuICAgICAgICBpZCA9IHBhcmVudElEO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgLy8gSW50ZXJuYWwgc3RhdGUgaXMgbWVzc2VkIHVwLlxuICAgICAgLy8gU3RvcCBidWlsZGluZyB0aGUgc3RhY2sgKGl0J3MganVzdCBhIG5pY2UgdG8gaGF2ZSkuXG4gICAgfVxuXG4gICAgY29uc29sZS5yZWFjdFN0YWNrKHN0YWNrKTtcbiAgfSxcbiAgcG9wTm9uU3RhbmRhcmRXYXJuaW5nU3RhY2s6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodHlwZW9mIGNvbnNvbGUucmVhY3RTdGFja0VuZCAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zb2xlLnJlYWN0U3RhY2tFbmQoKTtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBSZWFjdENvbXBvbmVudFRyZWVIb29rOyIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTMtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICpcbiAqIFxuICovXG5cbid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBLZWVwcyB0cmFjayBvZiB0aGUgY3VycmVudCBvd25lci5cbiAqXG4gKiBUaGUgY3VycmVudCBvd25lciBpcyB0aGUgY29tcG9uZW50IHdobyBzaG91bGQgb3duIGFueSBjb21wb25lbnRzIHRoYXQgYXJlXG4gKiBjdXJyZW50bHkgYmVpbmcgY29uc3RydWN0ZWQuXG4gKi9cbnZhciBSZWFjdEN1cnJlbnRPd25lciA9IHtcbiAgLyoqXG4gICAqIEBpbnRlcm5hbFxuICAgKiBAdHlwZSB7UmVhY3RDb21wb25lbnR9XG4gICAqL1xuICBjdXJyZW50OiBudWxsXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFJlYWN0Q3VycmVudE93bmVyOyIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTMtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICpcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBSZWFjdEVsZW1lbnQgPSByZXF1aXJlKCcuL1JlYWN0RWxlbWVudCcpO1xuXG4vKipcbiAqIENyZWF0ZSBhIGZhY3RvcnkgdGhhdCBjcmVhdGVzIEhUTUwgdGFnIGVsZW1lbnRzLlxuICpcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBjcmVhdGVET01GYWN0b3J5ID0gUmVhY3RFbGVtZW50LmNyZWF0ZUZhY3Rvcnk7XG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICB2YXIgUmVhY3RFbGVtZW50VmFsaWRhdG9yID0gcmVxdWlyZSgnLi9SZWFjdEVsZW1lbnRWYWxpZGF0b3InKTtcbiAgY3JlYXRlRE9NRmFjdG9yeSA9IFJlYWN0RWxlbWVudFZhbGlkYXRvci5jcmVhdGVGYWN0b3J5O1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBtYXBwaW5nIGZyb20gc3VwcG9ydGVkIEhUTUwgdGFncyB0byBgUmVhY3RET01Db21wb25lbnRgIGNsYXNzZXMuXG4gKlxuICogQHB1YmxpY1xuICovXG52YXIgUmVhY3RET01GYWN0b3JpZXMgPSB7XG4gIGE6IGNyZWF0ZURPTUZhY3RvcnkoJ2EnKSxcbiAgYWJicjogY3JlYXRlRE9NRmFjdG9yeSgnYWJicicpLFxuICBhZGRyZXNzOiBjcmVhdGVET01GYWN0b3J5KCdhZGRyZXNzJyksXG4gIGFyZWE6IGNyZWF0ZURPTUZhY3RvcnkoJ2FyZWEnKSxcbiAgYXJ0aWNsZTogY3JlYXRlRE9NRmFjdG9yeSgnYXJ0aWNsZScpLFxuICBhc2lkZTogY3JlYXRlRE9NRmFjdG9yeSgnYXNpZGUnKSxcbiAgYXVkaW86IGNyZWF0ZURPTUZhY3RvcnkoJ2F1ZGlvJyksXG4gIGI6IGNyZWF0ZURPTUZhY3RvcnkoJ2InKSxcbiAgYmFzZTogY3JlYXRlRE9NRmFjdG9yeSgnYmFzZScpLFxuICBiZGk6IGNyZWF0ZURPTUZhY3RvcnkoJ2JkaScpLFxuICBiZG86IGNyZWF0ZURPTUZhY3RvcnkoJ2JkbycpLFxuICBiaWc6IGNyZWF0ZURPTUZhY3RvcnkoJ2JpZycpLFxuICBibG9ja3F1b3RlOiBjcmVhdGVET01GYWN0b3J5KCdibG9ja3F1b3RlJyksXG4gIGJvZHk6IGNyZWF0ZURPTUZhY3RvcnkoJ2JvZHknKSxcbiAgYnI6IGNyZWF0ZURPTUZhY3RvcnkoJ2JyJyksXG4gIGJ1dHRvbjogY3JlYXRlRE9NRmFjdG9yeSgnYnV0dG9uJyksXG4gIGNhbnZhczogY3JlYXRlRE9NRmFjdG9yeSgnY2FudmFzJyksXG4gIGNhcHRpb246IGNyZWF0ZURPTUZhY3RvcnkoJ2NhcHRpb24nKSxcbiAgY2l0ZTogY3JlYXRlRE9NRmFjdG9yeSgnY2l0ZScpLFxuICBjb2RlOiBjcmVhdGVET01GYWN0b3J5KCdjb2RlJyksXG4gIGNvbDogY3JlYXRlRE9NRmFjdG9yeSgnY29sJyksXG4gIGNvbGdyb3VwOiBjcmVhdGVET01GYWN0b3J5KCdjb2xncm91cCcpLFxuICBkYXRhOiBjcmVhdGVET01GYWN0b3J5KCdkYXRhJyksXG4gIGRhdGFsaXN0OiBjcmVhdGVET01GYWN0b3J5KCdkYXRhbGlzdCcpLFxuICBkZDogY3JlYXRlRE9NRmFjdG9yeSgnZGQnKSxcbiAgZGVsOiBjcmVhdGVET01GYWN0b3J5KCdkZWwnKSxcbiAgZGV0YWlsczogY3JlYXRlRE9NRmFjdG9yeSgnZGV0YWlscycpLFxuICBkZm46IGNyZWF0ZURPTUZhY3RvcnkoJ2RmbicpLFxuICBkaWFsb2c6IGNyZWF0ZURPTUZhY3RvcnkoJ2RpYWxvZycpLFxuICBkaXY6IGNyZWF0ZURPTUZhY3RvcnkoJ2RpdicpLFxuICBkbDogY3JlYXRlRE9NRmFjdG9yeSgnZGwnKSxcbiAgZHQ6IGNyZWF0ZURPTUZhY3RvcnkoJ2R0JyksXG4gIGVtOiBjcmVhdGVET01GYWN0b3J5KCdlbScpLFxuICBlbWJlZDogY3JlYXRlRE9NRmFjdG9yeSgnZW1iZWQnKSxcbiAgZmllbGRzZXQ6IGNyZWF0ZURPTUZhY3RvcnkoJ2ZpZWxkc2V0JyksXG4gIGZpZ2NhcHRpb246IGNyZWF0ZURPTUZhY3RvcnkoJ2ZpZ2NhcHRpb24nKSxcbiAgZmlndXJlOiBjcmVhdGVET01GYWN0b3J5KCdmaWd1cmUnKSxcbiAgZm9vdGVyOiBjcmVhdGVET01GYWN0b3J5KCdmb290ZXInKSxcbiAgZm9ybTogY3JlYXRlRE9NRmFjdG9yeSgnZm9ybScpLFxuICBoMTogY3JlYXRlRE9NRmFjdG9yeSgnaDEnKSxcbiAgaDI6IGNyZWF0ZURPTUZhY3RvcnkoJ2gyJyksXG4gIGgzOiBjcmVhdGVET01GYWN0b3J5KCdoMycpLFxuICBoNDogY3JlYXRlRE9NRmFjdG9yeSgnaDQnKSxcbiAgaDU6IGNyZWF0ZURPTUZhY3RvcnkoJ2g1JyksXG4gIGg2OiBjcmVhdGVET01GYWN0b3J5KCdoNicpLFxuICBoZWFkOiBjcmVhdGVET01GYWN0b3J5KCdoZWFkJyksXG4gIGhlYWRlcjogY3JlYXRlRE9NRmFjdG9yeSgnaGVhZGVyJyksXG4gIGhncm91cDogY3JlYXRlRE9NRmFjdG9yeSgnaGdyb3VwJyksXG4gIGhyOiBjcmVhdGVET01GYWN0b3J5KCdocicpLFxuICBodG1sOiBjcmVhdGVET01GYWN0b3J5KCdodG1sJyksXG4gIGk6IGNyZWF0ZURPTUZhY3RvcnkoJ2knKSxcbiAgaWZyYW1lOiBjcmVhdGVET01GYWN0b3J5KCdpZnJhbWUnKSxcbiAgaW1nOiBjcmVhdGVET01GYWN0b3J5KCdpbWcnKSxcbiAgaW5wdXQ6IGNyZWF0ZURPTUZhY3RvcnkoJ2lucHV0JyksXG4gIGluczogY3JlYXRlRE9NRmFjdG9yeSgnaW5zJyksXG4gIGtiZDogY3JlYXRlRE9NRmFjdG9yeSgna2JkJyksXG4gIGtleWdlbjogY3JlYXRlRE9NRmFjdG9yeSgna2V5Z2VuJyksXG4gIGxhYmVsOiBjcmVhdGVET01GYWN0b3J5KCdsYWJlbCcpLFxuICBsZWdlbmQ6IGNyZWF0ZURPTUZhY3RvcnkoJ2xlZ2VuZCcpLFxuICBsaTogY3JlYXRlRE9NRmFjdG9yeSgnbGknKSxcbiAgbGluazogY3JlYXRlRE9NRmFjdG9yeSgnbGluaycpLFxuICBtYWluOiBjcmVhdGVET01GYWN0b3J5KCdtYWluJyksXG4gIG1hcDogY3JlYXRlRE9NRmFjdG9yeSgnbWFwJyksXG4gIG1hcms6IGNyZWF0ZURPTUZhY3RvcnkoJ21hcmsnKSxcbiAgbWVudTogY3JlYXRlRE9NRmFjdG9yeSgnbWVudScpLFxuICBtZW51aXRlbTogY3JlYXRlRE9NRmFjdG9yeSgnbWVudWl0ZW0nKSxcbiAgbWV0YTogY3JlYXRlRE9NRmFjdG9yeSgnbWV0YScpLFxuICBtZXRlcjogY3JlYXRlRE9NRmFjdG9yeSgnbWV0ZXInKSxcbiAgbmF2OiBjcmVhdGVET01GYWN0b3J5KCduYXYnKSxcbiAgbm9zY3JpcHQ6IGNyZWF0ZURPTUZhY3RvcnkoJ25vc2NyaXB0JyksXG4gIG9iamVjdDogY3JlYXRlRE9NRmFjdG9yeSgnb2JqZWN0JyksXG4gIG9sOiBjcmVhdGVET01GYWN0b3J5KCdvbCcpLFxuICBvcHRncm91cDogY3JlYXRlRE9NRmFjdG9yeSgnb3B0Z3JvdXAnKSxcbiAgb3B0aW9uOiBjcmVhdGVET01GYWN0b3J5KCdvcHRpb24nKSxcbiAgb3V0cHV0OiBjcmVhdGVET01GYWN0b3J5KCdvdXRwdXQnKSxcbiAgcDogY3JlYXRlRE9NRmFjdG9yeSgncCcpLFxuICBwYXJhbTogY3JlYXRlRE9NRmFjdG9yeSgncGFyYW0nKSxcbiAgcGljdHVyZTogY3JlYXRlRE9NRmFjdG9yeSgncGljdHVyZScpLFxuICBwcmU6IGNyZWF0ZURPTUZhY3RvcnkoJ3ByZScpLFxuICBwcm9ncmVzczogY3JlYXRlRE9NRmFjdG9yeSgncHJvZ3Jlc3MnKSxcbiAgcTogY3JlYXRlRE9NRmFjdG9yeSgncScpLFxuICBycDogY3JlYXRlRE9NRmFjdG9yeSgncnAnKSxcbiAgcnQ6IGNyZWF0ZURPTUZhY3RvcnkoJ3J0JyksXG4gIHJ1Ynk6IGNyZWF0ZURPTUZhY3RvcnkoJ3J1YnknKSxcbiAgczogY3JlYXRlRE9NRmFjdG9yeSgncycpLFxuICBzYW1wOiBjcmVhdGVET01GYWN0b3J5KCdzYW1wJyksXG4gIHNjcmlwdDogY3JlYXRlRE9NRmFjdG9yeSgnc2NyaXB0JyksXG4gIHNlY3Rpb246IGNyZWF0ZURPTUZhY3RvcnkoJ3NlY3Rpb24nKSxcbiAgc2VsZWN0OiBjcmVhdGVET01GYWN0b3J5KCdzZWxlY3QnKSxcbiAgc21hbGw6IGNyZWF0ZURPTUZhY3RvcnkoJ3NtYWxsJyksXG4gIHNvdXJjZTogY3JlYXRlRE9NRmFjdG9yeSgnc291cmNlJyksXG4gIHNwYW46IGNyZWF0ZURPTUZhY3RvcnkoJ3NwYW4nKSxcbiAgc3Ryb25nOiBjcmVhdGVET01GYWN0b3J5KCdzdHJvbmcnKSxcbiAgc3R5bGU6IGNyZWF0ZURPTUZhY3RvcnkoJ3N0eWxlJyksXG4gIHN1YjogY3JlYXRlRE9NRmFjdG9yeSgnc3ViJyksXG4gIHN1bW1hcnk6IGNyZWF0ZURPTUZhY3RvcnkoJ3N1bW1hcnknKSxcbiAgc3VwOiBjcmVhdGVET01GYWN0b3J5KCdzdXAnKSxcbiAgdGFibGU6IGNyZWF0ZURPTUZhY3RvcnkoJ3RhYmxlJyksXG4gIHRib2R5OiBjcmVhdGVET01GYWN0b3J5KCd0Ym9keScpLFxuICB0ZDogY3JlYXRlRE9NRmFjdG9yeSgndGQnKSxcbiAgdGV4dGFyZWE6IGNyZWF0ZURPTUZhY3RvcnkoJ3RleHRhcmVhJyksXG4gIHRmb290OiBjcmVhdGVET01GYWN0b3J5KCd0Zm9vdCcpLFxuICB0aDogY3JlYXRlRE9NRmFjdG9yeSgndGgnKSxcbiAgdGhlYWQ6IGNyZWF0ZURPTUZhY3RvcnkoJ3RoZWFkJyksXG4gIHRpbWU6IGNyZWF0ZURPTUZhY3RvcnkoJ3RpbWUnKSxcbiAgdGl0bGU6IGNyZWF0ZURPTUZhY3RvcnkoJ3RpdGxlJyksXG4gIHRyOiBjcmVhdGVET01GYWN0b3J5KCd0cicpLFxuICB0cmFjazogY3JlYXRlRE9NRmFjdG9yeSgndHJhY2snKSxcbiAgdTogY3JlYXRlRE9NRmFjdG9yeSgndScpLFxuICB1bDogY3JlYXRlRE9NRmFjdG9yeSgndWwnKSxcbiAgJ3Zhcic6IGNyZWF0ZURPTUZhY3RvcnkoJ3ZhcicpLFxuICB2aWRlbzogY3JlYXRlRE9NRmFjdG9yeSgndmlkZW8nKSxcbiAgd2JyOiBjcmVhdGVET01GYWN0b3J5KCd3YnInKSxcblxuICAvLyBTVkdcbiAgY2lyY2xlOiBjcmVhdGVET01GYWN0b3J5KCdjaXJjbGUnKSxcbiAgY2xpcFBhdGg6IGNyZWF0ZURPTUZhY3RvcnkoJ2NsaXBQYXRoJyksXG4gIGRlZnM6IGNyZWF0ZURPTUZhY3RvcnkoJ2RlZnMnKSxcbiAgZWxsaXBzZTogY3JlYXRlRE9NRmFjdG9yeSgnZWxsaXBzZScpLFxuICBnOiBjcmVhdGVET01GYWN0b3J5KCdnJyksXG4gIGltYWdlOiBjcmVhdGVET01GYWN0b3J5KCdpbWFnZScpLFxuICBsaW5lOiBjcmVhdGVET01GYWN0b3J5KCdsaW5lJyksXG4gIGxpbmVhckdyYWRpZW50OiBjcmVhdGVET01GYWN0b3J5KCdsaW5lYXJHcmFkaWVudCcpLFxuICBtYXNrOiBjcmVhdGVET01GYWN0b3J5KCdtYXNrJyksXG4gIHBhdGg6IGNyZWF0ZURPTUZhY3RvcnkoJ3BhdGgnKSxcbiAgcGF0dGVybjogY3JlYXRlRE9NRmFjdG9yeSgncGF0dGVybicpLFxuICBwb2x5Z29uOiBjcmVhdGVET01GYWN0b3J5KCdwb2x5Z29uJyksXG4gIHBvbHlsaW5lOiBjcmVhdGVET01GYWN0b3J5KCdwb2x5bGluZScpLFxuICByYWRpYWxHcmFkaWVudDogY3JlYXRlRE9NRmFjdG9yeSgncmFkaWFsR3JhZGllbnQnKSxcbiAgcmVjdDogY3JlYXRlRE9NRmFjdG9yeSgncmVjdCcpLFxuICBzdG9wOiBjcmVhdGVET01GYWN0b3J5KCdzdG9wJyksXG4gIHN2ZzogY3JlYXRlRE9NRmFjdG9yeSgnc3ZnJyksXG4gIHRleHQ6IGNyZWF0ZURPTUZhY3RvcnkoJ3RleHQnKSxcbiAgdHNwYW46IGNyZWF0ZURPTUZhY3RvcnkoJ3RzcGFuJylcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUmVhY3RET01GYWN0b3JpZXM7IiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNC1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIF9hc3NpZ24gPSByZXF1aXJlKCdvYmplY3QtYXNzaWduJyk7XG5cbnZhciBSZWFjdEN1cnJlbnRPd25lciA9IHJlcXVpcmUoJy4vUmVhY3RDdXJyZW50T3duZXInKTtcblxudmFyIHdhcm5pbmcgPSByZXF1aXJlKCdmYmpzL2xpYi93YXJuaW5nJyk7XG52YXIgY2FuRGVmaW5lUHJvcGVydHkgPSByZXF1aXJlKCcuL2NhbkRlZmluZVByb3BlcnR5Jyk7XG52YXIgaGFzT3duUHJvcGVydHkgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG52YXIgUkVBQ1RfRUxFTUVOVF9UWVBFID0gcmVxdWlyZSgnLi9SZWFjdEVsZW1lbnRTeW1ib2wnKTtcblxudmFyIFJFU0VSVkVEX1BST1BTID0ge1xuICBrZXk6IHRydWUsXG4gIHJlZjogdHJ1ZSxcbiAgX19zZWxmOiB0cnVlLFxuICBfX3NvdXJjZTogdHJ1ZVxufTtcblxudmFyIHNwZWNpYWxQcm9wS2V5V2FybmluZ1Nob3duLCBzcGVjaWFsUHJvcFJlZldhcm5pbmdTaG93bjtcblxuZnVuY3Rpb24gaGFzVmFsaWRSZWYoY29uZmlnKSB7XG4gIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgaWYgKGhhc093blByb3BlcnR5LmNhbGwoY29uZmlnLCAncmVmJykpIHtcbiAgICAgIHZhciBnZXR0ZXIgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKGNvbmZpZywgJ3JlZicpLmdldDtcbiAgICAgIGlmIChnZXR0ZXIgJiYgZ2V0dGVyLmlzUmVhY3RXYXJuaW5nKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIGNvbmZpZy5yZWYgIT09IHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gaGFzVmFsaWRLZXkoY29uZmlnKSB7XG4gIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgaWYgKGhhc093blByb3BlcnR5LmNhbGwoY29uZmlnLCAna2V5JykpIHtcbiAgICAgIHZhciBnZXR0ZXIgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKGNvbmZpZywgJ2tleScpLmdldDtcbiAgICAgIGlmIChnZXR0ZXIgJiYgZ2V0dGVyLmlzUmVhY3RXYXJuaW5nKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIGNvbmZpZy5rZXkgIT09IHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gZGVmaW5lS2V5UHJvcFdhcm5pbmdHZXR0ZXIocHJvcHMsIGRpc3BsYXlOYW1lKSB7XG4gIHZhciB3YXJuQWJvdXRBY2Nlc3NpbmdLZXkgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKCFzcGVjaWFsUHJvcEtleVdhcm5pbmdTaG93bikge1xuICAgICAgc3BlY2lhbFByb3BLZXlXYXJuaW5nU2hvd24gPSB0cnVlO1xuICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/IHdhcm5pbmcoZmFsc2UsICclczogYGtleWAgaXMgbm90IGEgcHJvcC4gVHJ5aW5nIHRvIGFjY2VzcyBpdCB3aWxsIHJlc3VsdCAnICsgJ2luIGB1bmRlZmluZWRgIGJlaW5nIHJldHVybmVkLiBJZiB5b3UgbmVlZCB0byBhY2Nlc3MgdGhlIHNhbWUgJyArICd2YWx1ZSB3aXRoaW4gdGhlIGNoaWxkIGNvbXBvbmVudCwgeW91IHNob3VsZCBwYXNzIGl0IGFzIGEgZGlmZmVyZW50ICcgKyAncHJvcC4gKGh0dHBzOi8vZmIubWUvcmVhY3Qtc3BlY2lhbC1wcm9wcyknLCBkaXNwbGF5TmFtZSkgOiB2b2lkIDA7XG4gICAgfVxuICB9O1xuICB3YXJuQWJvdXRBY2Nlc3NpbmdLZXkuaXNSZWFjdFdhcm5pbmcgPSB0cnVlO1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkocHJvcHMsICdrZXknLCB7XG4gICAgZ2V0OiB3YXJuQWJvdXRBY2Nlc3NpbmdLZXksXG4gICAgY29uZmlndXJhYmxlOiB0cnVlXG4gIH0pO1xufVxuXG5mdW5jdGlvbiBkZWZpbmVSZWZQcm9wV2FybmluZ0dldHRlcihwcm9wcywgZGlzcGxheU5hbWUpIHtcbiAgdmFyIHdhcm5BYm91dEFjY2Vzc2luZ1JlZiA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoIXNwZWNpYWxQcm9wUmVmV2FybmluZ1Nob3duKSB7XG4gICAgICBzcGVjaWFsUHJvcFJlZldhcm5pbmdTaG93biA9IHRydWU7XG4gICAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nID8gd2FybmluZyhmYWxzZSwgJyVzOiBgcmVmYCBpcyBub3QgYSBwcm9wLiBUcnlpbmcgdG8gYWNjZXNzIGl0IHdpbGwgcmVzdWx0ICcgKyAnaW4gYHVuZGVmaW5lZGAgYmVpbmcgcmV0dXJuZWQuIElmIHlvdSBuZWVkIHRvIGFjY2VzcyB0aGUgc2FtZSAnICsgJ3ZhbHVlIHdpdGhpbiB0aGUgY2hpbGQgY29tcG9uZW50LCB5b3Ugc2hvdWxkIHBhc3MgaXQgYXMgYSBkaWZmZXJlbnQgJyArICdwcm9wLiAoaHR0cHM6Ly9mYi5tZS9yZWFjdC1zcGVjaWFsLXByb3BzKScsIGRpc3BsYXlOYW1lKSA6IHZvaWQgMDtcbiAgICB9XG4gIH07XG4gIHdhcm5BYm91dEFjY2Vzc2luZ1JlZi5pc1JlYWN0V2FybmluZyA9IHRydWU7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm9wcywgJ3JlZicsIHtcbiAgICBnZXQ6IHdhcm5BYm91dEFjY2Vzc2luZ1JlZixcbiAgICBjb25maWd1cmFibGU6IHRydWVcbiAgfSk7XG59XG5cbi8qKlxuICogRmFjdG9yeSBtZXRob2QgdG8gY3JlYXRlIGEgbmV3IFJlYWN0IGVsZW1lbnQuIFRoaXMgbm8gbG9uZ2VyIGFkaGVyZXMgdG9cbiAqIHRoZSBjbGFzcyBwYXR0ZXJuLCBzbyBkbyBub3QgdXNlIG5ldyB0byBjYWxsIGl0LiBBbHNvLCBubyBpbnN0YW5jZW9mIGNoZWNrXG4gKiB3aWxsIHdvcmsuIEluc3RlYWQgdGVzdCAkJHR5cGVvZiBmaWVsZCBhZ2FpbnN0IFN5bWJvbC5mb3IoJ3JlYWN0LmVsZW1lbnQnKSB0byBjaGVja1xuICogaWYgc29tZXRoaW5nIGlzIGEgUmVhY3QgRWxlbWVudC5cbiAqXG4gKiBAcGFyYW0geyp9IHR5cGVcbiAqIEBwYXJhbSB7Kn0ga2V5XG4gKiBAcGFyYW0ge3N0cmluZ3xvYmplY3R9IHJlZlxuICogQHBhcmFtIHsqfSBzZWxmIEEgKnRlbXBvcmFyeSogaGVscGVyIHRvIGRldGVjdCBwbGFjZXMgd2hlcmUgYHRoaXNgIGlzXG4gKiBkaWZmZXJlbnQgZnJvbSB0aGUgYG93bmVyYCB3aGVuIFJlYWN0LmNyZWF0ZUVsZW1lbnQgaXMgY2FsbGVkLCBzbyB0aGF0IHdlXG4gKiBjYW4gd2Fybi4gV2Ugd2FudCB0byBnZXQgcmlkIG9mIG93bmVyIGFuZCByZXBsYWNlIHN0cmluZyBgcmVmYHMgd2l0aCBhcnJvd1xuICogZnVuY3Rpb25zLCBhbmQgYXMgbG9uZyBhcyBgdGhpc2AgYW5kIG93bmVyIGFyZSB0aGUgc2FtZSwgdGhlcmUgd2lsbCBiZSBub1xuICogY2hhbmdlIGluIGJlaGF2aW9yLlxuICogQHBhcmFtIHsqfSBzb3VyY2UgQW4gYW5ub3RhdGlvbiBvYmplY3QgKGFkZGVkIGJ5IGEgdHJhbnNwaWxlciBvciBvdGhlcndpc2UpXG4gKiBpbmRpY2F0aW5nIGZpbGVuYW1lLCBsaW5lIG51bWJlciwgYW5kL29yIG90aGVyIGluZm9ybWF0aW9uLlxuICogQHBhcmFtIHsqfSBvd25lclxuICogQHBhcmFtIHsqfSBwcm9wc1xuICogQGludGVybmFsXG4gKi9cbnZhciBSZWFjdEVsZW1lbnQgPSBmdW5jdGlvbiAodHlwZSwga2V5LCByZWYsIHNlbGYsIHNvdXJjZSwgb3duZXIsIHByb3BzKSB7XG4gIHZhciBlbGVtZW50ID0ge1xuICAgIC8vIFRoaXMgdGFnIGFsbG93IHVzIHRvIHVuaXF1ZWx5IGlkZW50aWZ5IHRoaXMgYXMgYSBSZWFjdCBFbGVtZW50XG4gICAgJCR0eXBlb2Y6IFJFQUNUX0VMRU1FTlRfVFlQRSxcblxuICAgIC8vIEJ1aWx0LWluIHByb3BlcnRpZXMgdGhhdCBiZWxvbmcgb24gdGhlIGVsZW1lbnRcbiAgICB0eXBlOiB0eXBlLFxuICAgIGtleToga2V5LFxuICAgIHJlZjogcmVmLFxuICAgIHByb3BzOiBwcm9wcyxcblxuICAgIC8vIFJlY29yZCB0aGUgY29tcG9uZW50IHJlc3BvbnNpYmxlIGZvciBjcmVhdGluZyB0aGlzIGVsZW1lbnQuXG4gICAgX293bmVyOiBvd25lclxuICB9O1xuXG4gIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgLy8gVGhlIHZhbGlkYXRpb24gZmxhZyBpcyBjdXJyZW50bHkgbXV0YXRpdmUuIFdlIHB1dCBpdCBvblxuICAgIC8vIGFuIGV4dGVybmFsIGJhY2tpbmcgc3RvcmUgc28gdGhhdCB3ZSBjYW4gZnJlZXplIHRoZSB3aG9sZSBvYmplY3QuXG4gICAgLy8gVGhpcyBjYW4gYmUgcmVwbGFjZWQgd2l0aCBhIFdlYWtNYXAgb25jZSB0aGV5IGFyZSBpbXBsZW1lbnRlZCBpblxuICAgIC8vIGNvbW1vbmx5IHVzZWQgZGV2ZWxvcG1lbnQgZW52aXJvbm1lbnRzLlxuICAgIGVsZW1lbnQuX3N0b3JlID0ge307XG5cbiAgICAvLyBUbyBtYWtlIGNvbXBhcmluZyBSZWFjdEVsZW1lbnRzIGVhc2llciBmb3IgdGVzdGluZyBwdXJwb3Nlcywgd2UgbWFrZVxuICAgIC8vIHRoZSB2YWxpZGF0aW9uIGZsYWcgbm9uLWVudW1lcmFibGUgKHdoZXJlIHBvc3NpYmxlLCB3aGljaCBzaG91bGRcbiAgICAvLyBpbmNsdWRlIGV2ZXJ5IGVudmlyb25tZW50IHdlIHJ1biB0ZXN0cyBpbiksIHNvIHRoZSB0ZXN0IGZyYW1ld29ya1xuICAgIC8vIGlnbm9yZXMgaXQuXG4gICAgaWYgKGNhbkRlZmluZVByb3BlcnR5KSB7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZWxlbWVudC5fc3RvcmUsICd2YWxpZGF0ZWQnLCB7XG4gICAgICAgIGNvbmZpZ3VyYWJsZTogZmFsc2UsXG4gICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgdmFsdWU6IGZhbHNlXG4gICAgICB9KTtcbiAgICAgIC8vIHNlbGYgYW5kIHNvdXJjZSBhcmUgREVWIG9ubHkgcHJvcGVydGllcy5cbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShlbGVtZW50LCAnX3NlbGYnLCB7XG4gICAgICAgIGNvbmZpZ3VyYWJsZTogZmFsc2UsXG4gICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgICAgIHZhbHVlOiBzZWxmXG4gICAgICB9KTtcbiAgICAgIC8vIFR3byBlbGVtZW50cyBjcmVhdGVkIGluIHR3byBkaWZmZXJlbnQgcGxhY2VzIHNob3VsZCBiZSBjb25zaWRlcmVkXG4gICAgICAvLyBlcXVhbCBmb3IgdGVzdGluZyBwdXJwb3NlcyBhbmQgdGhlcmVmb3JlIHdlIGhpZGUgaXQgZnJvbSBlbnVtZXJhdGlvbi5cbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShlbGVtZW50LCAnX3NvdXJjZScsIHtcbiAgICAgICAgY29uZmlndXJhYmxlOiBmYWxzZSxcbiAgICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICAgIHdyaXRhYmxlOiBmYWxzZSxcbiAgICAgICAgdmFsdWU6IHNvdXJjZVxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVsZW1lbnQuX3N0b3JlLnZhbGlkYXRlZCA9IGZhbHNlO1xuICAgICAgZWxlbWVudC5fc2VsZiA9IHNlbGY7XG4gICAgICBlbGVtZW50Ll9zb3VyY2UgPSBzb3VyY2U7XG4gICAgfVxuICAgIGlmIChPYmplY3QuZnJlZXplKSB7XG4gICAgICBPYmplY3QuZnJlZXplKGVsZW1lbnQucHJvcHMpO1xuICAgICAgT2JqZWN0LmZyZWV6ZShlbGVtZW50KTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZWxlbWVudDtcbn07XG5cbi8qKlxuICogQ3JlYXRlIGFuZCByZXR1cm4gYSBuZXcgUmVhY3RFbGVtZW50IG9mIHRoZSBnaXZlbiB0eXBlLlxuICogU2VlIGh0dHBzOi8vZmFjZWJvb2suZ2l0aHViLmlvL3JlYWN0L2RvY3MvdG9wLWxldmVsLWFwaS5odG1sI3JlYWN0LmNyZWF0ZWVsZW1lbnRcbiAqL1xuUmVhY3RFbGVtZW50LmNyZWF0ZUVsZW1lbnQgPSBmdW5jdGlvbiAodHlwZSwgY29uZmlnLCBjaGlsZHJlbikge1xuICB2YXIgcHJvcE5hbWU7XG5cbiAgLy8gUmVzZXJ2ZWQgbmFtZXMgYXJlIGV4dHJhY3RlZFxuICB2YXIgcHJvcHMgPSB7fTtcblxuICB2YXIga2V5ID0gbnVsbDtcbiAgdmFyIHJlZiA9IG51bGw7XG4gIHZhciBzZWxmID0gbnVsbDtcbiAgdmFyIHNvdXJjZSA9IG51bGw7XG5cbiAgaWYgKGNvbmZpZyAhPSBudWxsKSB7XG4gICAgaWYgKGhhc1ZhbGlkUmVmKGNvbmZpZykpIHtcbiAgICAgIHJlZiA9IGNvbmZpZy5yZWY7XG4gICAgfVxuICAgIGlmIChoYXNWYWxpZEtleShjb25maWcpKSB7XG4gICAgICBrZXkgPSAnJyArIGNvbmZpZy5rZXk7XG4gICAgfVxuXG4gICAgc2VsZiA9IGNvbmZpZy5fX3NlbGYgPT09IHVuZGVmaW5lZCA/IG51bGwgOiBjb25maWcuX19zZWxmO1xuICAgIHNvdXJjZSA9IGNvbmZpZy5fX3NvdXJjZSA9PT0gdW5kZWZpbmVkID8gbnVsbCA6IGNvbmZpZy5fX3NvdXJjZTtcbiAgICAvLyBSZW1haW5pbmcgcHJvcGVydGllcyBhcmUgYWRkZWQgdG8gYSBuZXcgcHJvcHMgb2JqZWN0XG4gICAgZm9yIChwcm9wTmFtZSBpbiBjb25maWcpIHtcbiAgICAgIGlmIChoYXNPd25Qcm9wZXJ0eS5jYWxsKGNvbmZpZywgcHJvcE5hbWUpICYmICFSRVNFUlZFRF9QUk9QUy5oYXNPd25Qcm9wZXJ0eShwcm9wTmFtZSkpIHtcbiAgICAgICAgcHJvcHNbcHJvcE5hbWVdID0gY29uZmlnW3Byb3BOYW1lXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBDaGlsZHJlbiBjYW4gYmUgbW9yZSB0aGFuIG9uZSBhcmd1bWVudCwgYW5kIHRob3NlIGFyZSB0cmFuc2ZlcnJlZCBvbnRvXG4gIC8vIHRoZSBuZXdseSBhbGxvY2F0ZWQgcHJvcHMgb2JqZWN0LlxuICB2YXIgY2hpbGRyZW5MZW5ndGggPSBhcmd1bWVudHMubGVuZ3RoIC0gMjtcbiAgaWYgKGNoaWxkcmVuTGVuZ3RoID09PSAxKSB7XG4gICAgcHJvcHMuY2hpbGRyZW4gPSBjaGlsZHJlbjtcbiAgfSBlbHNlIGlmIChjaGlsZHJlbkxlbmd0aCA+IDEpIHtcbiAgICB2YXIgY2hpbGRBcnJheSA9IEFycmF5KGNoaWxkcmVuTGVuZ3RoKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoaWxkcmVuTGVuZ3RoOyBpKyspIHtcbiAgICAgIGNoaWxkQXJyYXlbaV0gPSBhcmd1bWVudHNbaSArIDJdO1xuICAgIH1cbiAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgaWYgKE9iamVjdC5mcmVlemUpIHtcbiAgICAgICAgT2JqZWN0LmZyZWV6ZShjaGlsZEFycmF5KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcHJvcHMuY2hpbGRyZW4gPSBjaGlsZEFycmF5O1xuICB9XG5cbiAgLy8gUmVzb2x2ZSBkZWZhdWx0IHByb3BzXG4gIGlmICh0eXBlICYmIHR5cGUuZGVmYXVsdFByb3BzKSB7XG4gICAgdmFyIGRlZmF1bHRQcm9wcyA9IHR5cGUuZGVmYXVsdFByb3BzO1xuICAgIGZvciAocHJvcE5hbWUgaW4gZGVmYXVsdFByb3BzKSB7XG4gICAgICBpZiAocHJvcHNbcHJvcE5hbWVdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcHJvcHNbcHJvcE5hbWVdID0gZGVmYXVsdFByb3BzW3Byb3BOYW1lXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICBpZiAoa2V5IHx8IHJlZikge1xuICAgICAgaWYgKHR5cGVvZiBwcm9wcy4kJHR5cGVvZiA9PT0gJ3VuZGVmaW5lZCcgfHwgcHJvcHMuJCR0eXBlb2YgIT09IFJFQUNUX0VMRU1FTlRfVFlQRSkge1xuICAgICAgICB2YXIgZGlzcGxheU5hbWUgPSB0eXBlb2YgdHlwZSA9PT0gJ2Z1bmN0aW9uJyA/IHR5cGUuZGlzcGxheU5hbWUgfHwgdHlwZS5uYW1lIHx8ICdVbmtub3duJyA6IHR5cGU7XG4gICAgICAgIGlmIChrZXkpIHtcbiAgICAgICAgICBkZWZpbmVLZXlQcm9wV2FybmluZ0dldHRlcihwcm9wcywgZGlzcGxheU5hbWUpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChyZWYpIHtcbiAgICAgICAgICBkZWZpbmVSZWZQcm9wV2FybmluZ0dldHRlcihwcm9wcywgZGlzcGxheU5hbWUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBSZWFjdEVsZW1lbnQodHlwZSwga2V5LCByZWYsIHNlbGYsIHNvdXJjZSwgUmVhY3RDdXJyZW50T3duZXIuY3VycmVudCwgcHJvcHMpO1xufTtcblxuLyoqXG4gKiBSZXR1cm4gYSBmdW5jdGlvbiB0aGF0IHByb2R1Y2VzIFJlYWN0RWxlbWVudHMgb2YgYSBnaXZlbiB0eXBlLlxuICogU2VlIGh0dHBzOi8vZmFjZWJvb2suZ2l0aHViLmlvL3JlYWN0L2RvY3MvdG9wLWxldmVsLWFwaS5odG1sI3JlYWN0LmNyZWF0ZWZhY3RvcnlcbiAqL1xuUmVhY3RFbGVtZW50LmNyZWF0ZUZhY3RvcnkgPSBmdW5jdGlvbiAodHlwZSkge1xuICB2YXIgZmFjdG9yeSA9IFJlYWN0RWxlbWVudC5jcmVhdGVFbGVtZW50LmJpbmQobnVsbCwgdHlwZSk7XG4gIC8vIEV4cG9zZSB0aGUgdHlwZSBvbiB0aGUgZmFjdG9yeSBhbmQgdGhlIHByb3RvdHlwZSBzbyB0aGF0IGl0IGNhbiBiZVxuICAvLyBlYXNpbHkgYWNjZXNzZWQgb24gZWxlbWVudHMuIEUuZy4gYDxGb28gLz4udHlwZSA9PT0gRm9vYC5cbiAgLy8gVGhpcyBzaG91bGQgbm90IGJlIG5hbWVkIGBjb25zdHJ1Y3RvcmAgc2luY2UgdGhpcyBtYXkgbm90IGJlIHRoZSBmdW5jdGlvblxuICAvLyB0aGF0IGNyZWF0ZWQgdGhlIGVsZW1lbnQsIGFuZCBpdCBtYXkgbm90IGV2ZW4gYmUgYSBjb25zdHJ1Y3Rvci5cbiAgLy8gTGVnYWN5IGhvb2sgVE9ETzogV2FybiBpZiB0aGlzIGlzIGFjY2Vzc2VkXG4gIGZhY3RvcnkudHlwZSA9IHR5cGU7XG4gIHJldHVybiBmYWN0b3J5O1xufTtcblxuUmVhY3RFbGVtZW50LmNsb25lQW5kUmVwbGFjZUtleSA9IGZ1bmN0aW9uIChvbGRFbGVtZW50LCBuZXdLZXkpIHtcbiAgdmFyIG5ld0VsZW1lbnQgPSBSZWFjdEVsZW1lbnQob2xkRWxlbWVudC50eXBlLCBuZXdLZXksIG9sZEVsZW1lbnQucmVmLCBvbGRFbGVtZW50Ll9zZWxmLCBvbGRFbGVtZW50Ll9zb3VyY2UsIG9sZEVsZW1lbnQuX293bmVyLCBvbGRFbGVtZW50LnByb3BzKTtcblxuICByZXR1cm4gbmV3RWxlbWVudDtcbn07XG5cbi8qKlxuICogQ2xvbmUgYW5kIHJldHVybiBhIG5ldyBSZWFjdEVsZW1lbnQgdXNpbmcgZWxlbWVudCBhcyB0aGUgc3RhcnRpbmcgcG9pbnQuXG4gKiBTZWUgaHR0cHM6Ly9mYWNlYm9vay5naXRodWIuaW8vcmVhY3QvZG9jcy90b3AtbGV2ZWwtYXBpLmh0bWwjcmVhY3QuY2xvbmVlbGVtZW50XG4gKi9cblJlYWN0RWxlbWVudC5jbG9uZUVsZW1lbnQgPSBmdW5jdGlvbiAoZWxlbWVudCwgY29uZmlnLCBjaGlsZHJlbikge1xuICB2YXIgcHJvcE5hbWU7XG5cbiAgLy8gT3JpZ2luYWwgcHJvcHMgYXJlIGNvcGllZFxuICB2YXIgcHJvcHMgPSBfYXNzaWduKHt9LCBlbGVtZW50LnByb3BzKTtcblxuICAvLyBSZXNlcnZlZCBuYW1lcyBhcmUgZXh0cmFjdGVkXG4gIHZhciBrZXkgPSBlbGVtZW50LmtleTtcbiAgdmFyIHJlZiA9IGVsZW1lbnQucmVmO1xuICAvLyBTZWxmIGlzIHByZXNlcnZlZCBzaW5jZSB0aGUgb3duZXIgaXMgcHJlc2VydmVkLlxuICB2YXIgc2VsZiA9IGVsZW1lbnQuX3NlbGY7XG4gIC8vIFNvdXJjZSBpcyBwcmVzZXJ2ZWQgc2luY2UgY2xvbmVFbGVtZW50IGlzIHVubGlrZWx5IHRvIGJlIHRhcmdldGVkIGJ5IGFcbiAgLy8gdHJhbnNwaWxlciwgYW5kIHRoZSBvcmlnaW5hbCBzb3VyY2UgaXMgcHJvYmFibHkgYSBiZXR0ZXIgaW5kaWNhdG9yIG9mIHRoZVxuICAvLyB0cnVlIG93bmVyLlxuICB2YXIgc291cmNlID0gZWxlbWVudC5fc291cmNlO1xuXG4gIC8vIE93bmVyIHdpbGwgYmUgcHJlc2VydmVkLCB1bmxlc3MgcmVmIGlzIG92ZXJyaWRkZW5cbiAgdmFyIG93bmVyID0gZWxlbWVudC5fb3duZXI7XG5cbiAgaWYgKGNvbmZpZyAhPSBudWxsKSB7XG4gICAgaWYgKGhhc1ZhbGlkUmVmKGNvbmZpZykpIHtcbiAgICAgIC8vIFNpbGVudGx5IHN0ZWFsIHRoZSByZWYgZnJvbSB0aGUgcGFyZW50LlxuICAgICAgcmVmID0gY29uZmlnLnJlZjtcbiAgICAgIG93bmVyID0gUmVhY3RDdXJyZW50T3duZXIuY3VycmVudDtcbiAgICB9XG4gICAgaWYgKGhhc1ZhbGlkS2V5KGNvbmZpZykpIHtcbiAgICAgIGtleSA9ICcnICsgY29uZmlnLmtleTtcbiAgICB9XG5cbiAgICAvLyBSZW1haW5pbmcgcHJvcGVydGllcyBvdmVycmlkZSBleGlzdGluZyBwcm9wc1xuICAgIHZhciBkZWZhdWx0UHJvcHM7XG4gICAgaWYgKGVsZW1lbnQudHlwZSAmJiBlbGVtZW50LnR5cGUuZGVmYXVsdFByb3BzKSB7XG4gICAgICBkZWZhdWx0UHJvcHMgPSBlbGVtZW50LnR5cGUuZGVmYXVsdFByb3BzO1xuICAgIH1cbiAgICBmb3IgKHByb3BOYW1lIGluIGNvbmZpZykge1xuICAgICAgaWYgKGhhc093blByb3BlcnR5LmNhbGwoY29uZmlnLCBwcm9wTmFtZSkgJiYgIVJFU0VSVkVEX1BST1BTLmhhc093blByb3BlcnR5KHByb3BOYW1lKSkge1xuICAgICAgICBpZiAoY29uZmlnW3Byb3BOYW1lXSA9PT0gdW5kZWZpbmVkICYmIGRlZmF1bHRQcm9wcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgLy8gUmVzb2x2ZSBkZWZhdWx0IHByb3BzXG4gICAgICAgICAgcHJvcHNbcHJvcE5hbWVdID0gZGVmYXVsdFByb3BzW3Byb3BOYW1lXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwcm9wc1twcm9wTmFtZV0gPSBjb25maWdbcHJvcE5hbWVdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gQ2hpbGRyZW4gY2FuIGJlIG1vcmUgdGhhbiBvbmUgYXJndW1lbnQsIGFuZCB0aG9zZSBhcmUgdHJhbnNmZXJyZWQgb250b1xuICAvLyB0aGUgbmV3bHkgYWxsb2NhdGVkIHByb3BzIG9iamVjdC5cbiAgdmFyIGNoaWxkcmVuTGVuZ3RoID0gYXJndW1lbnRzLmxlbmd0aCAtIDI7XG4gIGlmIChjaGlsZHJlbkxlbmd0aCA9PT0gMSkge1xuICAgIHByb3BzLmNoaWxkcmVuID0gY2hpbGRyZW47XG4gIH0gZWxzZSBpZiAoY2hpbGRyZW5MZW5ndGggPiAxKSB7XG4gICAgdmFyIGNoaWxkQXJyYXkgPSBBcnJheShjaGlsZHJlbkxlbmd0aCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGlsZHJlbkxlbmd0aDsgaSsrKSB7XG4gICAgICBjaGlsZEFycmF5W2ldID0gYXJndW1lbnRzW2kgKyAyXTtcbiAgICB9XG4gICAgcHJvcHMuY2hpbGRyZW4gPSBjaGlsZEFycmF5O1xuICB9XG5cbiAgcmV0dXJuIFJlYWN0RWxlbWVudChlbGVtZW50LnR5cGUsIGtleSwgcmVmLCBzZWxmLCBzb3VyY2UsIG93bmVyLCBwcm9wcyk7XG59O1xuXG4vKipcbiAqIFZlcmlmaWVzIHRoZSBvYmplY3QgaXMgYSBSZWFjdEVsZW1lbnQuXG4gKiBTZWUgaHR0cHM6Ly9mYWNlYm9vay5naXRodWIuaW8vcmVhY3QvZG9jcy90b3AtbGV2ZWwtYXBpLmh0bWwjcmVhY3QuaXN2YWxpZGVsZW1lbnRcbiAqIEBwYXJhbSB7P29iamVjdH0gb2JqZWN0XG4gKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIGlmIGBvYmplY3RgIGlzIGEgdmFsaWQgY29tcG9uZW50LlxuICogQGZpbmFsXG4gKi9cblJlYWN0RWxlbWVudC5pc1ZhbGlkRWxlbWVudCA9IGZ1bmN0aW9uIChvYmplY3QpIHtcbiAgcmV0dXJuIHR5cGVvZiBvYmplY3QgPT09ICdvYmplY3QnICYmIG9iamVjdCAhPT0gbnVsbCAmJiBvYmplY3QuJCR0eXBlb2YgPT09IFJFQUNUX0VMRU1FTlRfVFlQRTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUmVhY3RFbGVtZW50OyIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTQtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICpcbiAqIFxuICovXG5cbid1c2Ugc3RyaWN0JztcblxuLy8gVGhlIFN5bWJvbCB1c2VkIHRvIHRhZyB0aGUgUmVhY3RFbGVtZW50IHR5cGUuIElmIHRoZXJlIGlzIG5vIG5hdGl2ZSBTeW1ib2xcbi8vIG5vciBwb2x5ZmlsbCwgdGhlbiBhIHBsYWluIG51bWJlciBpcyB1c2VkIGZvciBwZXJmb3JtYW5jZS5cblxudmFyIFJFQUNUX0VMRU1FTlRfVFlQRSA9IHR5cGVvZiBTeW1ib2wgPT09ICdmdW5jdGlvbicgJiYgU3ltYm9sWydmb3InXSAmJiBTeW1ib2xbJ2ZvciddKCdyZWFjdC5lbGVtZW50JykgfHwgMHhlYWM3O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFJFQUNUX0VMRU1FTlRfVFlQRTsiLCIvKipcbiAqIENvcHlyaWdodCAyMDE0LXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqXG4gKi9cblxuLyoqXG4gKiBSZWFjdEVsZW1lbnRWYWxpZGF0b3IgcHJvdmlkZXMgYSB3cmFwcGVyIGFyb3VuZCBhIGVsZW1lbnQgZmFjdG9yeVxuICogd2hpY2ggdmFsaWRhdGVzIHRoZSBwcm9wcyBwYXNzZWQgdG8gdGhlIGVsZW1lbnQuIFRoaXMgaXMgaW50ZW5kZWQgdG8gYmVcbiAqIHVzZWQgb25seSBpbiBERVYgYW5kIGNvdWxkIGJlIHJlcGxhY2VkIGJ5IGEgc3RhdGljIHR5cGUgY2hlY2tlciBmb3IgbGFuZ3VhZ2VzXG4gKiB0aGF0IHN1cHBvcnQgaXQuXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgUmVhY3RDdXJyZW50T3duZXIgPSByZXF1aXJlKCcuL1JlYWN0Q3VycmVudE93bmVyJyk7XG52YXIgUmVhY3RDb21wb25lbnRUcmVlSG9vayA9IHJlcXVpcmUoJy4vUmVhY3RDb21wb25lbnRUcmVlSG9vaycpO1xudmFyIFJlYWN0RWxlbWVudCA9IHJlcXVpcmUoJy4vUmVhY3RFbGVtZW50Jyk7XG5cbnZhciBjaGVja1JlYWN0VHlwZVNwZWMgPSByZXF1aXJlKCcuL2NoZWNrUmVhY3RUeXBlU3BlYycpO1xuXG52YXIgY2FuRGVmaW5lUHJvcGVydHkgPSByZXF1aXJlKCcuL2NhbkRlZmluZVByb3BlcnR5Jyk7XG52YXIgZ2V0SXRlcmF0b3JGbiA9IHJlcXVpcmUoJy4vZ2V0SXRlcmF0b3JGbicpO1xudmFyIHdhcm5pbmcgPSByZXF1aXJlKCdmYmpzL2xpYi93YXJuaW5nJyk7XG52YXIgbG93UHJpb3JpdHlXYXJuaW5nID0gcmVxdWlyZSgnLi9sb3dQcmlvcml0eVdhcm5pbmcnKTtcblxuZnVuY3Rpb24gZ2V0RGVjbGFyYXRpb25FcnJvckFkZGVuZHVtKCkge1xuICBpZiAoUmVhY3RDdXJyZW50T3duZXIuY3VycmVudCkge1xuICAgIHZhciBuYW1lID0gUmVhY3RDdXJyZW50T3duZXIuY3VycmVudC5nZXROYW1lKCk7XG4gICAgaWYgKG5hbWUpIHtcbiAgICAgIHJldHVybiAnIENoZWNrIHRoZSByZW5kZXIgbWV0aG9kIG9mIGAnICsgbmFtZSArICdgLic7XG4gICAgfVxuICB9XG4gIHJldHVybiAnJztcbn1cblxuZnVuY3Rpb24gZ2V0U291cmNlSW5mb0Vycm9yQWRkZW5kdW0oZWxlbWVudFByb3BzKSB7XG4gIGlmIChlbGVtZW50UHJvcHMgIT09IG51bGwgJiYgZWxlbWVudFByb3BzICE9PSB1bmRlZmluZWQgJiYgZWxlbWVudFByb3BzLl9fc291cmNlICE9PSB1bmRlZmluZWQpIHtcbiAgICB2YXIgc291cmNlID0gZWxlbWVudFByb3BzLl9fc291cmNlO1xuICAgIHZhciBmaWxlTmFtZSA9IHNvdXJjZS5maWxlTmFtZS5yZXBsYWNlKC9eLipbXFxcXFxcL10vLCAnJyk7XG4gICAgdmFyIGxpbmVOdW1iZXIgPSBzb3VyY2UubGluZU51bWJlcjtcbiAgICByZXR1cm4gJyBDaGVjayB5b3VyIGNvZGUgYXQgJyArIGZpbGVOYW1lICsgJzonICsgbGluZU51bWJlciArICcuJztcbiAgfVxuICByZXR1cm4gJyc7XG59XG5cbi8qKlxuICogV2FybiBpZiB0aGVyZSdzIG5vIGtleSBleHBsaWNpdGx5IHNldCBvbiBkeW5hbWljIGFycmF5cyBvZiBjaGlsZHJlbiBvclxuICogb2JqZWN0IGtleXMgYXJlIG5vdCB2YWxpZC4gVGhpcyBhbGxvd3MgdXMgdG8ga2VlcCB0cmFjayBvZiBjaGlsZHJlbiBiZXR3ZWVuXG4gKiB1cGRhdGVzLlxuICovXG52YXIgb3duZXJIYXNLZXlVc2VXYXJuaW5nID0ge307XG5cbmZ1bmN0aW9uIGdldEN1cnJlbnRDb21wb25lbnRFcnJvckluZm8ocGFyZW50VHlwZSkge1xuICB2YXIgaW5mbyA9IGdldERlY2xhcmF0aW9uRXJyb3JBZGRlbmR1bSgpO1xuXG4gIGlmICghaW5mbykge1xuICAgIHZhciBwYXJlbnROYW1lID0gdHlwZW9mIHBhcmVudFR5cGUgPT09ICdzdHJpbmcnID8gcGFyZW50VHlwZSA6IHBhcmVudFR5cGUuZGlzcGxheU5hbWUgfHwgcGFyZW50VHlwZS5uYW1lO1xuICAgIGlmIChwYXJlbnROYW1lKSB7XG4gICAgICBpbmZvID0gJyBDaGVjayB0aGUgdG9wLWxldmVsIHJlbmRlciBjYWxsIHVzaW5nIDwnICsgcGFyZW50TmFtZSArICc+Lic7XG4gICAgfVxuICB9XG4gIHJldHVybiBpbmZvO1xufVxuXG4vKipcbiAqIFdhcm4gaWYgdGhlIGVsZW1lbnQgZG9lc24ndCBoYXZlIGFuIGV4cGxpY2l0IGtleSBhc3NpZ25lZCB0byBpdC5cbiAqIFRoaXMgZWxlbWVudCBpcyBpbiBhbiBhcnJheS4gVGhlIGFycmF5IGNvdWxkIGdyb3cgYW5kIHNocmluayBvciBiZVxuICogcmVvcmRlcmVkLiBBbGwgY2hpbGRyZW4gdGhhdCBoYXZlbid0IGFscmVhZHkgYmVlbiB2YWxpZGF0ZWQgYXJlIHJlcXVpcmVkIHRvXG4gKiBoYXZlIGEgXCJrZXlcIiBwcm9wZXJ0eSBhc3NpZ25lZCB0byBpdC4gRXJyb3Igc3RhdHVzZXMgYXJlIGNhY2hlZCBzbyBhIHdhcm5pbmdcbiAqIHdpbGwgb25seSBiZSBzaG93biBvbmNlLlxuICpcbiAqIEBpbnRlcm5hbFxuICogQHBhcmFtIHtSZWFjdEVsZW1lbnR9IGVsZW1lbnQgRWxlbWVudCB0aGF0IHJlcXVpcmVzIGEga2V5LlxuICogQHBhcmFtIHsqfSBwYXJlbnRUeXBlIGVsZW1lbnQncyBwYXJlbnQncyB0eXBlLlxuICovXG5mdW5jdGlvbiB2YWxpZGF0ZUV4cGxpY2l0S2V5KGVsZW1lbnQsIHBhcmVudFR5cGUpIHtcbiAgaWYgKCFlbGVtZW50Ll9zdG9yZSB8fCBlbGVtZW50Ll9zdG9yZS52YWxpZGF0ZWQgfHwgZWxlbWVudC5rZXkgIT0gbnVsbCkge1xuICAgIHJldHVybjtcbiAgfVxuICBlbGVtZW50Ll9zdG9yZS52YWxpZGF0ZWQgPSB0cnVlO1xuXG4gIHZhciBtZW1vaXplciA9IG93bmVySGFzS2V5VXNlV2FybmluZy51bmlxdWVLZXkgfHwgKG93bmVySGFzS2V5VXNlV2FybmluZy51bmlxdWVLZXkgPSB7fSk7XG5cbiAgdmFyIGN1cnJlbnRDb21wb25lbnRFcnJvckluZm8gPSBnZXRDdXJyZW50Q29tcG9uZW50RXJyb3JJbmZvKHBhcmVudFR5cGUpO1xuICBpZiAobWVtb2l6ZXJbY3VycmVudENvbXBvbmVudEVycm9ySW5mb10pIHtcbiAgICByZXR1cm47XG4gIH1cbiAgbWVtb2l6ZXJbY3VycmVudENvbXBvbmVudEVycm9ySW5mb10gPSB0cnVlO1xuXG4gIC8vIFVzdWFsbHkgdGhlIGN1cnJlbnQgb3duZXIgaXMgdGhlIG9mZmVuZGVyLCBidXQgaWYgaXQgYWNjZXB0cyBjaGlsZHJlbiBhcyBhXG4gIC8vIHByb3BlcnR5LCBpdCBtYXkgYmUgdGhlIGNyZWF0b3Igb2YgdGhlIGNoaWxkIHRoYXQncyByZXNwb25zaWJsZSBmb3JcbiAgLy8gYXNzaWduaW5nIGl0IGEga2V5LlxuICB2YXIgY2hpbGRPd25lciA9ICcnO1xuICBpZiAoZWxlbWVudCAmJiBlbGVtZW50Ll9vd25lciAmJiBlbGVtZW50Ll9vd25lciAhPT0gUmVhY3RDdXJyZW50T3duZXIuY3VycmVudCkge1xuICAgIC8vIEdpdmUgdGhlIGNvbXBvbmVudCB0aGF0IG9yaWdpbmFsbHkgY3JlYXRlZCB0aGlzIGNoaWxkLlxuICAgIGNoaWxkT3duZXIgPSAnIEl0IHdhcyBwYXNzZWQgYSBjaGlsZCBmcm9tICcgKyBlbGVtZW50Ll9vd25lci5nZXROYW1lKCkgKyAnLic7XG4gIH1cblxuICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nID8gd2FybmluZyhmYWxzZSwgJ0VhY2ggY2hpbGQgaW4gYW4gYXJyYXkgb3IgaXRlcmF0b3Igc2hvdWxkIGhhdmUgYSB1bmlxdWUgXCJrZXlcIiBwcm9wLicgKyAnJXMlcyBTZWUgaHR0cHM6Ly9mYi5tZS9yZWFjdC13YXJuaW5nLWtleXMgZm9yIG1vcmUgaW5mb3JtYXRpb24uJXMnLCBjdXJyZW50Q29tcG9uZW50RXJyb3JJbmZvLCBjaGlsZE93bmVyLCBSZWFjdENvbXBvbmVudFRyZWVIb29rLmdldEN1cnJlbnRTdGFja0FkZGVuZHVtKGVsZW1lbnQpKSA6IHZvaWQgMDtcbn1cblxuLyoqXG4gKiBFbnN1cmUgdGhhdCBldmVyeSBlbGVtZW50IGVpdGhlciBpcyBwYXNzZWQgaW4gYSBzdGF0aWMgbG9jYXRpb24sIGluIGFuXG4gKiBhcnJheSB3aXRoIGFuIGV4cGxpY2l0IGtleXMgcHJvcGVydHkgZGVmaW5lZCwgb3IgaW4gYW4gb2JqZWN0IGxpdGVyYWxcbiAqIHdpdGggdmFsaWQga2V5IHByb3BlcnR5LlxuICpcbiAqIEBpbnRlcm5hbFxuICogQHBhcmFtIHtSZWFjdE5vZGV9IG5vZGUgU3RhdGljYWxseSBwYXNzZWQgY2hpbGQgb2YgYW55IHR5cGUuXG4gKiBAcGFyYW0geyp9IHBhcmVudFR5cGUgbm9kZSdzIHBhcmVudCdzIHR5cGUuXG4gKi9cbmZ1bmN0aW9uIHZhbGlkYXRlQ2hpbGRLZXlzKG5vZGUsIHBhcmVudFR5cGUpIHtcbiAgaWYgKHR5cGVvZiBub2RlICE9PSAnb2JqZWN0Jykge1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoQXJyYXkuaXNBcnJheShub2RlKSkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbm9kZS5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGNoaWxkID0gbm9kZVtpXTtcbiAgICAgIGlmIChSZWFjdEVsZW1lbnQuaXNWYWxpZEVsZW1lbnQoY2hpbGQpKSB7XG4gICAgICAgIHZhbGlkYXRlRXhwbGljaXRLZXkoY2hpbGQsIHBhcmVudFR5cGUpO1xuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIGlmIChSZWFjdEVsZW1lbnQuaXNWYWxpZEVsZW1lbnQobm9kZSkpIHtcbiAgICAvLyBUaGlzIGVsZW1lbnQgd2FzIHBhc3NlZCBpbiBhIHZhbGlkIGxvY2F0aW9uLlxuICAgIGlmIChub2RlLl9zdG9yZSkge1xuICAgICAgbm9kZS5fc3RvcmUudmFsaWRhdGVkID0gdHJ1ZTtcbiAgICB9XG4gIH0gZWxzZSBpZiAobm9kZSkge1xuICAgIHZhciBpdGVyYXRvckZuID0gZ2V0SXRlcmF0b3JGbihub2RlKTtcbiAgICAvLyBFbnRyeSBpdGVyYXRvcnMgcHJvdmlkZSBpbXBsaWNpdCBrZXlzLlxuICAgIGlmIChpdGVyYXRvckZuKSB7XG4gICAgICBpZiAoaXRlcmF0b3JGbiAhPT0gbm9kZS5lbnRyaWVzKSB7XG4gICAgICAgIHZhciBpdGVyYXRvciA9IGl0ZXJhdG9yRm4uY2FsbChub2RlKTtcbiAgICAgICAgdmFyIHN0ZXA7XG4gICAgICAgIHdoaWxlICghKHN0ZXAgPSBpdGVyYXRvci5uZXh0KCkpLmRvbmUpIHtcbiAgICAgICAgICBpZiAoUmVhY3RFbGVtZW50LmlzVmFsaWRFbGVtZW50KHN0ZXAudmFsdWUpKSB7XG4gICAgICAgICAgICB2YWxpZGF0ZUV4cGxpY2l0S2V5KHN0ZXAudmFsdWUsIHBhcmVudFR5cGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEdpdmVuIGFuIGVsZW1lbnQsIHZhbGlkYXRlIHRoYXQgaXRzIHByb3BzIGZvbGxvdyB0aGUgcHJvcFR5cGVzIGRlZmluaXRpb24sXG4gKiBwcm92aWRlZCBieSB0aGUgdHlwZS5cbiAqXG4gKiBAcGFyYW0ge1JlYWN0RWxlbWVudH0gZWxlbWVudFxuICovXG5mdW5jdGlvbiB2YWxpZGF0ZVByb3BUeXBlcyhlbGVtZW50KSB7XG4gIHZhciBjb21wb25lbnRDbGFzcyA9IGVsZW1lbnQudHlwZTtcbiAgaWYgKHR5cGVvZiBjb21wb25lbnRDbGFzcyAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybjtcbiAgfVxuICB2YXIgbmFtZSA9IGNvbXBvbmVudENsYXNzLmRpc3BsYXlOYW1lIHx8IGNvbXBvbmVudENsYXNzLm5hbWU7XG4gIGlmIChjb21wb25lbnRDbGFzcy5wcm9wVHlwZXMpIHtcbiAgICBjaGVja1JlYWN0VHlwZVNwZWMoY29tcG9uZW50Q2xhc3MucHJvcFR5cGVzLCBlbGVtZW50LnByb3BzLCAncHJvcCcsIG5hbWUsIGVsZW1lbnQsIG51bGwpO1xuICB9XG4gIGlmICh0eXBlb2YgY29tcG9uZW50Q2xhc3MuZ2V0RGVmYXVsdFByb3BzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/IHdhcm5pbmcoY29tcG9uZW50Q2xhc3MuZ2V0RGVmYXVsdFByb3BzLmlzUmVhY3RDbGFzc0FwcHJvdmVkLCAnZ2V0RGVmYXVsdFByb3BzIGlzIG9ubHkgdXNlZCBvbiBjbGFzc2ljIFJlYWN0LmNyZWF0ZUNsYXNzICcgKyAnZGVmaW5pdGlvbnMuIFVzZSBhIHN0YXRpYyBwcm9wZXJ0eSBuYW1lZCBgZGVmYXVsdFByb3BzYCBpbnN0ZWFkLicpIDogdm9pZCAwO1xuICB9XG59XG5cbnZhciBSZWFjdEVsZW1lbnRWYWxpZGF0b3IgPSB7XG4gIGNyZWF0ZUVsZW1lbnQ6IGZ1bmN0aW9uICh0eXBlLCBwcm9wcywgY2hpbGRyZW4pIHtcbiAgICB2YXIgdmFsaWRUeXBlID0gdHlwZW9mIHR5cGUgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiB0eXBlID09PSAnZnVuY3Rpb24nO1xuICAgIC8vIFdlIHdhcm4gaW4gdGhpcyBjYXNlIGJ1dCBkb24ndCB0aHJvdy4gV2UgZXhwZWN0IHRoZSBlbGVtZW50IGNyZWF0aW9uIHRvXG4gICAgLy8gc3VjY2VlZCBhbmQgdGhlcmUgd2lsbCBsaWtlbHkgYmUgZXJyb3JzIGluIHJlbmRlci5cbiAgICBpZiAoIXZhbGlkVHlwZSkge1xuICAgICAgaWYgKHR5cGVvZiB0eXBlICE9PSAnZnVuY3Rpb24nICYmIHR5cGVvZiB0eXBlICE9PSAnc3RyaW5nJykge1xuICAgICAgICB2YXIgaW5mbyA9ICcnO1xuICAgICAgICBpZiAodHlwZSA9PT0gdW5kZWZpbmVkIHx8IHR5cGVvZiB0eXBlID09PSAnb2JqZWN0JyAmJiB0eXBlICE9PSBudWxsICYmIE9iamVjdC5rZXlzKHR5cGUpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGluZm8gKz0gJyBZb3UgbGlrZWx5IGZvcmdvdCB0byBleHBvcnQgeW91ciBjb21wb25lbnQgZnJvbSB0aGUgZmlsZSAnICsgXCJpdCdzIGRlZmluZWQgaW4uXCI7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgc291cmNlSW5mbyA9IGdldFNvdXJjZUluZm9FcnJvckFkZGVuZHVtKHByb3BzKTtcbiAgICAgICAgaWYgKHNvdXJjZUluZm8pIHtcbiAgICAgICAgICBpbmZvICs9IHNvdXJjZUluZm87XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaW5mbyArPSBnZXREZWNsYXJhdGlvbkVycm9yQWRkZW5kdW0oKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGluZm8gKz0gUmVhY3RDb21wb25lbnRUcmVlSG9vay5nZXRDdXJyZW50U3RhY2tBZGRlbmR1bSgpO1xuXG4gICAgICAgIHZhciBjdXJyZW50U291cmNlID0gcHJvcHMgIT09IG51bGwgJiYgcHJvcHMgIT09IHVuZGVmaW5lZCAmJiBwcm9wcy5fX3NvdXJjZSAhPT0gdW5kZWZpbmVkID8gcHJvcHMuX19zb3VyY2UgOiBudWxsO1xuICAgICAgICBSZWFjdENvbXBvbmVudFRyZWVIb29rLnB1c2hOb25TdGFuZGFyZFdhcm5pbmdTdGFjayh0cnVlLCBjdXJyZW50U291cmNlKTtcbiAgICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/IHdhcm5pbmcoZmFsc2UsICdSZWFjdC5jcmVhdGVFbGVtZW50OiB0eXBlIGlzIGludmFsaWQgLS0gZXhwZWN0ZWQgYSBzdHJpbmcgKGZvciAnICsgJ2J1aWx0LWluIGNvbXBvbmVudHMpIG9yIGEgY2xhc3MvZnVuY3Rpb24gKGZvciBjb21wb3NpdGUgJyArICdjb21wb25lbnRzKSBidXQgZ290OiAlcy4lcycsIHR5cGUgPT0gbnVsbCA/IHR5cGUgOiB0eXBlb2YgdHlwZSwgaW5mbykgOiB2b2lkIDA7XG4gICAgICAgIFJlYWN0Q29tcG9uZW50VHJlZUhvb2sucG9wTm9uU3RhbmRhcmRXYXJuaW5nU3RhY2soKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgZWxlbWVudCA9IFJlYWN0RWxlbWVudC5jcmVhdGVFbGVtZW50LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cbiAgICAvLyBUaGUgcmVzdWx0IGNhbiBiZSBudWxsaXNoIGlmIGEgbW9jayBvciBhIGN1c3RvbSBmdW5jdGlvbiBpcyB1c2VkLlxuICAgIC8vIFRPRE86IERyb3AgdGhpcyB3aGVuIHRoZXNlIGFyZSBubyBsb25nZXIgYWxsb3dlZCBhcyB0aGUgdHlwZSBhcmd1bWVudC5cbiAgICBpZiAoZWxlbWVudCA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gZWxlbWVudDtcbiAgICB9XG5cbiAgICAvLyBTa2lwIGtleSB3YXJuaW5nIGlmIHRoZSB0eXBlIGlzbid0IHZhbGlkIHNpbmNlIG91ciBrZXkgdmFsaWRhdGlvbiBsb2dpY1xuICAgIC8vIGRvZXNuJ3QgZXhwZWN0IGEgbm9uLXN0cmluZy9mdW5jdGlvbiB0eXBlIGFuZCBjYW4gdGhyb3cgY29uZnVzaW5nIGVycm9ycy5cbiAgICAvLyBXZSBkb24ndCB3YW50IGV4Y2VwdGlvbiBiZWhhdmlvciB0byBkaWZmZXIgYmV0d2VlbiBkZXYgYW5kIHByb2QuXG4gICAgLy8gKFJlbmRlcmluZyB3aWxsIHRocm93IHdpdGggYSBoZWxwZnVsIG1lc3NhZ2UgYW5kIGFzIHNvb24gYXMgdGhlIHR5cGUgaXNcbiAgICAvLyBmaXhlZCwgdGhlIGtleSB3YXJuaW5ncyB3aWxsIGFwcGVhci4pXG4gICAgaWYgKHZhbGlkVHlwZSkge1xuICAgICAgZm9yICh2YXIgaSA9IDI7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFsaWRhdGVDaGlsZEtleXMoYXJndW1lbnRzW2ldLCB0eXBlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YWxpZGF0ZVByb3BUeXBlcyhlbGVtZW50KTtcblxuICAgIHJldHVybiBlbGVtZW50O1xuICB9LFxuXG4gIGNyZWF0ZUZhY3Rvcnk6IGZ1bmN0aW9uICh0eXBlKSB7XG4gICAgdmFyIHZhbGlkYXRlZEZhY3RvcnkgPSBSZWFjdEVsZW1lbnRWYWxpZGF0b3IuY3JlYXRlRWxlbWVudC5iaW5kKG51bGwsIHR5cGUpO1xuICAgIC8vIExlZ2FjeSBob29rIFRPRE86IFdhcm4gaWYgdGhpcyBpcyBhY2Nlc3NlZFxuICAgIHZhbGlkYXRlZEZhY3RvcnkudHlwZSA9IHR5cGU7XG5cbiAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgaWYgKGNhbkRlZmluZVByb3BlcnR5KSB7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh2YWxpZGF0ZWRGYWN0b3J5LCAndHlwZScsIHtcbiAgICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGxvd1ByaW9yaXR5V2FybmluZyhmYWxzZSwgJ0ZhY3RvcnkudHlwZSBpcyBkZXByZWNhdGVkLiBBY2Nlc3MgdGhlIGNsYXNzIGRpcmVjdGx5ICcgKyAnYmVmb3JlIHBhc3NpbmcgaXQgdG8gY3JlYXRlRmFjdG9yeS4nKTtcbiAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAndHlwZScsIHtcbiAgICAgICAgICAgICAgdmFsdWU6IHR5cGVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHR5cGU7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdmFsaWRhdGVkRmFjdG9yeTtcbiAgfSxcblxuICBjbG9uZUVsZW1lbnQ6IGZ1bmN0aW9uIChlbGVtZW50LCBwcm9wcywgY2hpbGRyZW4pIHtcbiAgICB2YXIgbmV3RWxlbWVudCA9IFJlYWN0RWxlbWVudC5jbG9uZUVsZW1lbnQuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICBmb3IgKHZhciBpID0gMjsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFsaWRhdGVDaGlsZEtleXMoYXJndW1lbnRzW2ldLCBuZXdFbGVtZW50LnR5cGUpO1xuICAgIH1cbiAgICB2YWxpZGF0ZVByb3BUeXBlcyhuZXdFbGVtZW50KTtcbiAgICByZXR1cm4gbmV3RWxlbWVudDtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBSZWFjdEVsZW1lbnRWYWxpZGF0b3I7IiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNS1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIHdhcm5pbmcgPSByZXF1aXJlKCdmYmpzL2xpYi93YXJuaW5nJyk7XG5cbmZ1bmN0aW9uIHdhcm5Ob29wKHB1YmxpY0luc3RhbmNlLCBjYWxsZXJOYW1lKSB7XG4gIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgdmFyIGNvbnN0cnVjdG9yID0gcHVibGljSW5zdGFuY2UuY29uc3RydWN0b3I7XG4gICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/IHdhcm5pbmcoZmFsc2UsICclcyguLi4pOiBDYW4gb25seSB1cGRhdGUgYSBtb3VudGVkIG9yIG1vdW50aW5nIGNvbXBvbmVudC4gJyArICdUaGlzIHVzdWFsbHkgbWVhbnMgeW91IGNhbGxlZCAlcygpIG9uIGFuIHVubW91bnRlZCBjb21wb25lbnQuICcgKyAnVGhpcyBpcyBhIG5vLW9wLiBQbGVhc2UgY2hlY2sgdGhlIGNvZGUgZm9yIHRoZSAlcyBjb21wb25lbnQuJywgY2FsbGVyTmFtZSwgY2FsbGVyTmFtZSwgY29uc3RydWN0b3IgJiYgKGNvbnN0cnVjdG9yLmRpc3BsYXlOYW1lIHx8IGNvbnN0cnVjdG9yLm5hbWUpIHx8ICdSZWFjdENsYXNzJykgOiB2b2lkIDA7XG4gIH1cbn1cblxuLyoqXG4gKiBUaGlzIGlzIHRoZSBhYnN0cmFjdCBBUEkgZm9yIGFuIHVwZGF0ZSBxdWV1ZS5cbiAqL1xudmFyIFJlYWN0Tm9vcFVwZGF0ZVF1ZXVlID0ge1xuICAvKipcbiAgICogQ2hlY2tzIHdoZXRoZXIgb3Igbm90IHRoaXMgY29tcG9zaXRlIGNvbXBvbmVudCBpcyBtb3VudGVkLlxuICAgKiBAcGFyYW0ge1JlYWN0Q2xhc3N9IHB1YmxpY0luc3RhbmNlIFRoZSBpbnN0YW5jZSB3ZSB3YW50IHRvIHRlc3QuXG4gICAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgaWYgbW91bnRlZCwgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgKiBAcHJvdGVjdGVkXG4gICAqIEBmaW5hbFxuICAgKi9cbiAgaXNNb3VudGVkOiBmdW5jdGlvbiAocHVibGljSW5zdGFuY2UpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEVucXVldWUgYSBjYWxsYmFjayB0aGF0IHdpbGwgYmUgZXhlY3V0ZWQgYWZ0ZXIgYWxsIHRoZSBwZW5kaW5nIHVwZGF0ZXNcbiAgICogaGF2ZSBwcm9jZXNzZWQuXG4gICAqXG4gICAqIEBwYXJhbSB7UmVhY3RDbGFzc30gcHVibGljSW5zdGFuY2UgVGhlIGluc3RhbmNlIHRvIHVzZSBhcyBgdGhpc2AgY29udGV4dC5cbiAgICogQHBhcmFtIHs/ZnVuY3Rpb259IGNhbGxiYWNrIENhbGxlZCBhZnRlciBzdGF0ZSBpcyB1cGRhdGVkLlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIGVucXVldWVDYWxsYmFjazogZnVuY3Rpb24gKHB1YmxpY0luc3RhbmNlLCBjYWxsYmFjaykge30sXG5cbiAgLyoqXG4gICAqIEZvcmNlcyBhbiB1cGRhdGUuIFRoaXMgc2hvdWxkIG9ubHkgYmUgaW52b2tlZCB3aGVuIGl0IGlzIGtub3duIHdpdGhcbiAgICogY2VydGFpbnR5IHRoYXQgd2UgYXJlICoqbm90KiogaW4gYSBET00gdHJhbnNhY3Rpb24uXG4gICAqXG4gICAqIFlvdSBtYXkgd2FudCB0byBjYWxsIHRoaXMgd2hlbiB5b3Uga25vdyB0aGF0IHNvbWUgZGVlcGVyIGFzcGVjdCBvZiB0aGVcbiAgICogY29tcG9uZW50J3Mgc3RhdGUgaGFzIGNoYW5nZWQgYnV0IGBzZXRTdGF0ZWAgd2FzIG5vdCBjYWxsZWQuXG4gICAqXG4gICAqIFRoaXMgd2lsbCBub3QgaW52b2tlIGBzaG91bGRDb21wb25lbnRVcGRhdGVgLCBidXQgaXQgd2lsbCBpbnZva2VcbiAgICogYGNvbXBvbmVudFdpbGxVcGRhdGVgIGFuZCBgY29tcG9uZW50RGlkVXBkYXRlYC5cbiAgICpcbiAgICogQHBhcmFtIHtSZWFjdENsYXNzfSBwdWJsaWNJbnN0YW5jZSBUaGUgaW5zdGFuY2UgdGhhdCBzaG91bGQgcmVyZW5kZXIuXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgZW5xdWV1ZUZvcmNlVXBkYXRlOiBmdW5jdGlvbiAocHVibGljSW5zdGFuY2UpIHtcbiAgICB3YXJuTm9vcChwdWJsaWNJbnN0YW5jZSwgJ2ZvcmNlVXBkYXRlJyk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFJlcGxhY2VzIGFsbCBvZiB0aGUgc3RhdGUuIEFsd2F5cyB1c2UgdGhpcyBvciBgc2V0U3RhdGVgIHRvIG11dGF0ZSBzdGF0ZS5cbiAgICogWW91IHNob3VsZCB0cmVhdCBgdGhpcy5zdGF0ZWAgYXMgaW1tdXRhYmxlLlxuICAgKlxuICAgKiBUaGVyZSBpcyBubyBndWFyYW50ZWUgdGhhdCBgdGhpcy5zdGF0ZWAgd2lsbCBiZSBpbW1lZGlhdGVseSB1cGRhdGVkLCBzb1xuICAgKiBhY2Nlc3NpbmcgYHRoaXMuc3RhdGVgIGFmdGVyIGNhbGxpbmcgdGhpcyBtZXRob2QgbWF5IHJldHVybiB0aGUgb2xkIHZhbHVlLlxuICAgKlxuICAgKiBAcGFyYW0ge1JlYWN0Q2xhc3N9IHB1YmxpY0luc3RhbmNlIFRoZSBpbnN0YW5jZSB0aGF0IHNob3VsZCByZXJlbmRlci5cbiAgICogQHBhcmFtIHtvYmplY3R9IGNvbXBsZXRlU3RhdGUgTmV4dCBzdGF0ZS5cbiAgICogQGludGVybmFsXG4gICAqL1xuICBlbnF1ZXVlUmVwbGFjZVN0YXRlOiBmdW5jdGlvbiAocHVibGljSW5zdGFuY2UsIGNvbXBsZXRlU3RhdGUpIHtcbiAgICB3YXJuTm9vcChwdWJsaWNJbnN0YW5jZSwgJ3JlcGxhY2VTdGF0ZScpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBTZXRzIGEgc3Vic2V0IG9mIHRoZSBzdGF0ZS4gVGhpcyBvbmx5IGV4aXN0cyBiZWNhdXNlIF9wZW5kaW5nU3RhdGUgaXNcbiAgICogaW50ZXJuYWwuIFRoaXMgcHJvdmlkZXMgYSBtZXJnaW5nIHN0cmF0ZWd5IHRoYXQgaXMgbm90IGF2YWlsYWJsZSB0byBkZWVwXG4gICAqIHByb3BlcnRpZXMgd2hpY2ggaXMgY29uZnVzaW5nLiBUT0RPOiBFeHBvc2UgcGVuZGluZ1N0YXRlIG9yIGRvbid0IHVzZSBpdFxuICAgKiBkdXJpbmcgdGhlIG1lcmdlLlxuICAgKlxuICAgKiBAcGFyYW0ge1JlYWN0Q2xhc3N9IHB1YmxpY0luc3RhbmNlIFRoZSBpbnN0YW5jZSB0aGF0IHNob3VsZCByZXJlbmRlci5cbiAgICogQHBhcmFtIHtvYmplY3R9IHBhcnRpYWxTdGF0ZSBOZXh0IHBhcnRpYWwgc3RhdGUgdG8gYmUgbWVyZ2VkIHdpdGggc3RhdGUuXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgZW5xdWV1ZVNldFN0YXRlOiBmdW5jdGlvbiAocHVibGljSW5zdGFuY2UsIHBhcnRpYWxTdGF0ZSkge1xuICAgIHdhcm5Ob29wKHB1YmxpY0luc3RhbmNlLCAnc2V0U3RhdGUnKTtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBSZWFjdE5vb3BVcGRhdGVRdWV1ZTsiLCIvKipcbiAqIENvcHlyaWdodCAyMDEzLXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqXG4gKiBcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBSZWFjdFByb3BUeXBlTG9jYXRpb25OYW1lcyA9IHt9O1xuXG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICBSZWFjdFByb3BUeXBlTG9jYXRpb25OYW1lcyA9IHtcbiAgICBwcm9wOiAncHJvcCcsXG4gICAgY29udGV4dDogJ2NvbnRleHQnLFxuICAgIGNoaWxkQ29udGV4dDogJ2NoaWxkIGNvbnRleHQnXG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gUmVhY3RQcm9wVHlwZUxvY2F0aW9uTmFtZXM7IiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxMy1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIF9yZXF1aXJlID0gcmVxdWlyZSgnLi9SZWFjdEVsZW1lbnQnKSxcbiAgICBpc1ZhbGlkRWxlbWVudCA9IF9yZXF1aXJlLmlzVmFsaWRFbGVtZW50O1xuXG52YXIgZmFjdG9yeSA9IHJlcXVpcmUoJ3Byb3AtdHlwZXMvZmFjdG9yeScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoaXNWYWxpZEVsZW1lbnQpOyIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTMtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICpcbiAqIFxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIFJlYWN0UHJvcFR5cGVzU2VjcmV0ID0gJ1NFQ1JFVF9ET19OT1RfUEFTU19USElTX09SX1lPVV9XSUxMX0JFX0ZJUkVEJztcblxubW9kdWxlLmV4cG9ydHMgPSBSZWFjdFByb3BUeXBlc1NlY3JldDsiLCIvKipcbiAqIENvcHlyaWdodCAyMDEzLXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9ICcxNS42LjEnOyIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTMtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICpcbiAqIFxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIGNhbkRlZmluZVByb3BlcnR5ID0gZmFsc2U7XG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICB0cnkge1xuICAgIC8vICRGbG93Rml4TWUgaHR0cHM6Ly9naXRodWIuY29tL2ZhY2Vib29rL2Zsb3cvaXNzdWVzLzI4NVxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh7fSwgJ3gnLCB7IGdldDogZnVuY3Rpb24gKCkge30gfSk7XG4gICAgY2FuRGVmaW5lUHJvcGVydHkgPSB0cnVlO1xuICB9IGNhdGNoICh4KSB7XG4gICAgLy8gSUUgd2lsbCBmYWlsIG9uIGRlZmluZVByb3BlcnR5XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjYW5EZWZpbmVQcm9wZXJ0eTsiLCIvKipcbiAqIENvcHlyaWdodCAyMDEzLXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgX3Byb2RJbnZhcmlhbnQgPSByZXF1aXJlKCcuL3JlYWN0UHJvZEludmFyaWFudCcpO1xuXG52YXIgUmVhY3RQcm9wVHlwZUxvY2F0aW9uTmFtZXMgPSByZXF1aXJlKCcuL1JlYWN0UHJvcFR5cGVMb2NhdGlvbk5hbWVzJyk7XG52YXIgUmVhY3RQcm9wVHlwZXNTZWNyZXQgPSByZXF1aXJlKCcuL1JlYWN0UHJvcFR5cGVzU2VjcmV0Jyk7XG5cbnZhciBpbnZhcmlhbnQgPSByZXF1aXJlKCdmYmpzL2xpYi9pbnZhcmlhbnQnKTtcbnZhciB3YXJuaW5nID0gcmVxdWlyZSgnZmJqcy9saWIvd2FybmluZycpO1xuXG52YXIgUmVhY3RDb21wb25lbnRUcmVlSG9vaztcblxuaWYgKHR5cGVvZiBwcm9jZXNzICE9PSAndW5kZWZpbmVkJyAmJiBwcm9jZXNzLmVudiAmJiBwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gJ3Rlc3QnKSB7XG4gIC8vIFRlbXBvcmFyeSBoYWNrLlxuICAvLyBJbmxpbmUgcmVxdWlyZXMgZG9uJ3Qgd29yayB3ZWxsIHdpdGggSmVzdDpcbiAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2ZhY2Vib29rL3JlYWN0L2lzc3Vlcy83MjQwXG4gIC8vIFJlbW92ZSB0aGUgaW5saW5lIHJlcXVpcmVzIHdoZW4gd2UgZG9uJ3QgbmVlZCB0aGVtIGFueW1vcmU6XG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9mYWNlYm9vay9yZWFjdC9wdWxsLzcxNzhcbiAgUmVhY3RDb21wb25lbnRUcmVlSG9vayA9IHJlcXVpcmUoJy4vUmVhY3RDb21wb25lbnRUcmVlSG9vaycpO1xufVxuXG52YXIgbG9nZ2VkVHlwZUZhaWx1cmVzID0ge307XG5cbi8qKlxuICogQXNzZXJ0IHRoYXQgdGhlIHZhbHVlcyBtYXRjaCB3aXRoIHRoZSB0eXBlIHNwZWNzLlxuICogRXJyb3IgbWVzc2FnZXMgYXJlIG1lbW9yaXplZCBhbmQgd2lsbCBvbmx5IGJlIHNob3duIG9uY2UuXG4gKlxuICogQHBhcmFtIHtvYmplY3R9IHR5cGVTcGVjcyBNYXAgb2YgbmFtZSB0byBhIFJlYWN0UHJvcFR5cGVcbiAqIEBwYXJhbSB7b2JqZWN0fSB2YWx1ZXMgUnVudGltZSB2YWx1ZXMgdGhhdCBuZWVkIHRvIGJlIHR5cGUtY2hlY2tlZFxuICogQHBhcmFtIHtzdHJpbmd9IGxvY2F0aW9uIGUuZy4gXCJwcm9wXCIsIFwiY29udGV4dFwiLCBcImNoaWxkIGNvbnRleHRcIlxuICogQHBhcmFtIHtzdHJpbmd9IGNvbXBvbmVudE5hbWUgTmFtZSBvZiB0aGUgY29tcG9uZW50IGZvciBlcnJvciBtZXNzYWdlcy5cbiAqIEBwYXJhbSB7P29iamVjdH0gZWxlbWVudCBUaGUgUmVhY3QgZWxlbWVudCB0aGF0IGlzIGJlaW5nIHR5cGUtY2hlY2tlZFxuICogQHBhcmFtIHs/bnVtYmVyfSBkZWJ1Z0lEIFRoZSBSZWFjdCBjb21wb25lbnQgaW5zdGFuY2UgdGhhdCBpcyBiZWluZyB0eXBlLWNoZWNrZWRcbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIGNoZWNrUmVhY3RUeXBlU3BlYyh0eXBlU3BlY3MsIHZhbHVlcywgbG9jYXRpb24sIGNvbXBvbmVudE5hbWUsIGVsZW1lbnQsIGRlYnVnSUQpIHtcbiAgZm9yICh2YXIgdHlwZVNwZWNOYW1lIGluIHR5cGVTcGVjcykge1xuICAgIGlmICh0eXBlU3BlY3MuaGFzT3duUHJvcGVydHkodHlwZVNwZWNOYW1lKSkge1xuICAgICAgdmFyIGVycm9yO1xuICAgICAgLy8gUHJvcCB0eXBlIHZhbGlkYXRpb24gbWF5IHRocm93LiBJbiBjYXNlIHRoZXkgZG8sIHdlIGRvbid0IHdhbnQgdG9cbiAgICAgIC8vIGZhaWwgdGhlIHJlbmRlciBwaGFzZSB3aGVyZSBpdCBkaWRuJ3QgZmFpbCBiZWZvcmUuIFNvIHdlIGxvZyBpdC5cbiAgICAgIC8vIEFmdGVyIHRoZXNlIGhhdmUgYmVlbiBjbGVhbmVkIHVwLCB3ZSdsbCBsZXQgdGhlbSB0aHJvdy5cbiAgICAgIHRyeSB7XG4gICAgICAgIC8vIFRoaXMgaXMgaW50ZW50aW9uYWxseSBhbiBpbnZhcmlhbnQgdGhhdCBnZXRzIGNhdWdodC4gSXQncyB0aGUgc2FtZVxuICAgICAgICAvLyBiZWhhdmlvciBhcyB3aXRob3V0IHRoaXMgc3RhdGVtZW50IGV4Y2VwdCB3aXRoIGEgYmV0dGVyIG1lc3NhZ2UuXG4gICAgICAgICEodHlwZW9mIHR5cGVTcGVjc1t0eXBlU3BlY05hbWVdID09PSAnZnVuY3Rpb24nKSA/IHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyBpbnZhcmlhbnQoZmFsc2UsICclczogJXMgdHlwZSBgJXNgIGlzIGludmFsaWQ7IGl0IG11c3QgYmUgYSBmdW5jdGlvbiwgdXN1YWxseSBmcm9tIFJlYWN0LlByb3BUeXBlcy4nLCBjb21wb25lbnROYW1lIHx8ICdSZWFjdCBjbGFzcycsIFJlYWN0UHJvcFR5cGVMb2NhdGlvbk5hbWVzW2xvY2F0aW9uXSwgdHlwZVNwZWNOYW1lKSA6IF9wcm9kSW52YXJpYW50KCc4NCcsIGNvbXBvbmVudE5hbWUgfHwgJ1JlYWN0IGNsYXNzJywgUmVhY3RQcm9wVHlwZUxvY2F0aW9uTmFtZXNbbG9jYXRpb25dLCB0eXBlU3BlY05hbWUpIDogdm9pZCAwO1xuICAgICAgICBlcnJvciA9IHR5cGVTcGVjc1t0eXBlU3BlY05hbWVdKHZhbHVlcywgdHlwZVNwZWNOYW1lLCBjb21wb25lbnROYW1lLCBsb2NhdGlvbiwgbnVsbCwgUmVhY3RQcm9wVHlwZXNTZWNyZXQpO1xuICAgICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgICAgZXJyb3IgPSBleDtcbiAgICAgIH1cbiAgICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyB3YXJuaW5nKCFlcnJvciB8fCBlcnJvciBpbnN0YW5jZW9mIEVycm9yLCAnJXM6IHR5cGUgc3BlY2lmaWNhdGlvbiBvZiAlcyBgJXNgIGlzIGludmFsaWQ7IHRoZSB0eXBlIGNoZWNrZXIgJyArICdmdW5jdGlvbiBtdXN0IHJldHVybiBgbnVsbGAgb3IgYW4gYEVycm9yYCBidXQgcmV0dXJuZWQgYSAlcy4gJyArICdZb3UgbWF5IGhhdmUgZm9yZ290dGVuIHRvIHBhc3MgYW4gYXJndW1lbnQgdG8gdGhlIHR5cGUgY2hlY2tlciAnICsgJ2NyZWF0b3IgKGFycmF5T2YsIGluc3RhbmNlT2YsIG9iamVjdE9mLCBvbmVPZiwgb25lT2ZUeXBlLCBhbmQgJyArICdzaGFwZSBhbGwgcmVxdWlyZSBhbiBhcmd1bWVudCkuJywgY29tcG9uZW50TmFtZSB8fCAnUmVhY3QgY2xhc3MnLCBSZWFjdFByb3BUeXBlTG9jYXRpb25OYW1lc1tsb2NhdGlvbl0sIHR5cGVTcGVjTmFtZSwgdHlwZW9mIGVycm9yKSA6IHZvaWQgMDtcbiAgICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yICYmICEoZXJyb3IubWVzc2FnZSBpbiBsb2dnZWRUeXBlRmFpbHVyZXMpKSB7XG4gICAgICAgIC8vIE9ubHkgbW9uaXRvciB0aGlzIGZhaWx1cmUgb25jZSBiZWNhdXNlIHRoZXJlIHRlbmRzIHRvIGJlIGEgbG90IG9mIHRoZVxuICAgICAgICAvLyBzYW1lIGVycm9yLlxuICAgICAgICBsb2dnZWRUeXBlRmFpbHVyZXNbZXJyb3IubWVzc2FnZV0gPSB0cnVlO1xuXG4gICAgICAgIHZhciBjb21wb25lbnRTdGFja0luZm8gPSAnJztcblxuICAgICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgICAgIGlmICghUmVhY3RDb21wb25lbnRUcmVlSG9vaykge1xuICAgICAgICAgICAgUmVhY3RDb21wb25lbnRUcmVlSG9vayA9IHJlcXVpcmUoJy4vUmVhY3RDb21wb25lbnRUcmVlSG9vaycpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoZGVidWdJRCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgY29tcG9uZW50U3RhY2tJbmZvID0gUmVhY3RDb21wb25lbnRUcmVlSG9vay5nZXRTdGFja0FkZGVuZHVtQnlJRChkZWJ1Z0lEKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGVsZW1lbnQgIT09IG51bGwpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudFN0YWNrSW5mbyA9IFJlYWN0Q29tcG9uZW50VHJlZUhvb2suZ2V0Q3VycmVudFN0YWNrQWRkZW5kdW0oZWxlbWVudCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/IHdhcm5pbmcoZmFsc2UsICdGYWlsZWQgJXMgdHlwZTogJXMlcycsIGxvY2F0aW9uLCBlcnJvci5tZXNzYWdlLCBjb21wb25lbnRTdGFja0luZm8pIDogdm9pZCAwO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNoZWNrUmVhY3RUeXBlU3BlYzsiLCIvKipcbiAqIENvcHlyaWdodCAyMDEzLXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgX3JlcXVpcmUgPSByZXF1aXJlKCcuL1JlYWN0QmFzZUNsYXNzZXMnKSxcbiAgICBDb21wb25lbnQgPSBfcmVxdWlyZS5Db21wb25lbnQ7XG5cbnZhciBfcmVxdWlyZTIgPSByZXF1aXJlKCcuL1JlYWN0RWxlbWVudCcpLFxuICAgIGlzVmFsaWRFbGVtZW50ID0gX3JlcXVpcmUyLmlzVmFsaWRFbGVtZW50O1xuXG52YXIgUmVhY3ROb29wVXBkYXRlUXVldWUgPSByZXF1aXJlKCcuL1JlYWN0Tm9vcFVwZGF0ZVF1ZXVlJyk7XG52YXIgZmFjdG9yeSA9IHJlcXVpcmUoJ2NyZWF0ZS1yZWFjdC1jbGFzcy9mYWN0b3J5Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZmFjdG9yeShDb21wb25lbnQsIGlzVmFsaWRFbGVtZW50LCBSZWFjdE5vb3BVcGRhdGVRdWV1ZSk7IiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxMy1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICogXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG4vKiBnbG9iYWwgU3ltYm9sICovXG5cbnZhciBJVEVSQVRPUl9TWU1CT0wgPSB0eXBlb2YgU3ltYm9sID09PSAnZnVuY3Rpb24nICYmIFN5bWJvbC5pdGVyYXRvcjtcbnZhciBGQVVYX0lURVJBVE9SX1NZTUJPTCA9ICdAQGl0ZXJhdG9yJzsgLy8gQmVmb3JlIFN5bWJvbCBzcGVjLlxuXG4vKipcbiAqIFJldHVybnMgdGhlIGl0ZXJhdG9yIG1ldGhvZCBmdW5jdGlvbiBjb250YWluZWQgb24gdGhlIGl0ZXJhYmxlIG9iamVjdC5cbiAqXG4gKiBCZSBzdXJlIHRvIGludm9rZSB0aGUgZnVuY3Rpb24gd2l0aCB0aGUgaXRlcmFibGUgYXMgY29udGV4dDpcbiAqXG4gKiAgICAgdmFyIGl0ZXJhdG9yRm4gPSBnZXRJdGVyYXRvckZuKG15SXRlcmFibGUpO1xuICogICAgIGlmIChpdGVyYXRvckZuKSB7XG4gKiAgICAgICB2YXIgaXRlcmF0b3IgPSBpdGVyYXRvckZuLmNhbGwobXlJdGVyYWJsZSk7XG4gKiAgICAgICAuLi5cbiAqICAgICB9XG4gKlxuICogQHBhcmFtIHs/b2JqZWN0fSBtYXliZUl0ZXJhYmxlXG4gKiBAcmV0dXJuIHs/ZnVuY3Rpb259XG4gKi9cbmZ1bmN0aW9uIGdldEl0ZXJhdG9yRm4obWF5YmVJdGVyYWJsZSkge1xuICB2YXIgaXRlcmF0b3JGbiA9IG1heWJlSXRlcmFibGUgJiYgKElURVJBVE9SX1NZTUJPTCAmJiBtYXliZUl0ZXJhYmxlW0lURVJBVE9SX1NZTUJPTF0gfHwgbWF5YmVJdGVyYWJsZVtGQVVYX0lURVJBVE9SX1NZTUJPTF0pO1xuICBpZiAodHlwZW9mIGl0ZXJhdG9yRm4gPT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gaXRlcmF0b3JGbjtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGdldEl0ZXJhdG9yRm47IiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNC0yMDE1LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBGb3JrZWQgZnJvbSBmYmpzL3dhcm5pbmc6XG4gKiBodHRwczovL2dpdGh1Yi5jb20vZmFjZWJvb2svZmJqcy9ibG9iL2U2NmJhMjBhZDViZTQzM2ViNTQ0MjNmMmIwOTdkODI5MzI0ZDlkZTYvcGFja2FnZXMvZmJqcy9zcmMvX19mb3Jrc19fL3dhcm5pbmcuanNcbiAqXG4gKiBPbmx5IGNoYW5nZSBpcyB3ZSB1c2UgY29uc29sZS53YXJuIGluc3RlYWQgb2YgY29uc29sZS5lcnJvcixcbiAqIGFuZCBkbyBub3RoaW5nIHdoZW4gJ2NvbnNvbGUnIGlzIG5vdCBzdXBwb3J0ZWQuXG4gKiBUaGlzIHJlYWxseSBzaW1wbGlmaWVzIHRoZSBjb2RlLlxuICogLS0tXG4gKiBTaW1pbGFyIHRvIGludmFyaWFudCBidXQgb25seSBsb2dzIGEgd2FybmluZyBpZiB0aGUgY29uZGl0aW9uIGlzIG5vdCBtZXQuXG4gKiBUaGlzIGNhbiBiZSB1c2VkIHRvIGxvZyBpc3N1ZXMgaW4gZGV2ZWxvcG1lbnQgZW52aXJvbm1lbnRzIGluIGNyaXRpY2FsXG4gKiBwYXRocy4gUmVtb3ZpbmcgdGhlIGxvZ2dpbmcgY29kZSBmb3IgcHJvZHVjdGlvbiBlbnZpcm9ubWVudHMgd2lsbCBrZWVwIHRoZVxuICogc2FtZSBsb2dpYyBhbmQgZm9sbG93IHRoZSBzYW1lIGNvZGUgcGF0aHMuXG4gKi9cblxudmFyIGxvd1ByaW9yaXR5V2FybmluZyA9IGZ1bmN0aW9uICgpIHt9O1xuXG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICB2YXIgcHJpbnRXYXJuaW5nID0gZnVuY3Rpb24gKGZvcm1hdCkge1xuICAgIGZvciAodmFyIF9sZW4gPSBhcmd1bWVudHMubGVuZ3RoLCBhcmdzID0gQXJyYXkoX2xlbiA+IDEgPyBfbGVuIC0gMSA6IDApLCBfa2V5ID0gMTsgX2tleSA8IF9sZW47IF9rZXkrKykge1xuICAgICAgYXJnc1tfa2V5IC0gMV0gPSBhcmd1bWVudHNbX2tleV07XG4gICAgfVxuXG4gICAgdmFyIGFyZ0luZGV4ID0gMDtcbiAgICB2YXIgbWVzc2FnZSA9ICdXYXJuaW5nOiAnICsgZm9ybWF0LnJlcGxhY2UoLyVzL2csIGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBhcmdzW2FyZ0luZGV4KytdO1xuICAgIH0pO1xuICAgIGlmICh0eXBlb2YgY29uc29sZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGNvbnNvbGUud2FybihtZXNzYWdlKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgIC8vIC0tLSBXZWxjb21lIHRvIGRlYnVnZ2luZyBSZWFjdCAtLS1cbiAgICAgIC8vIFRoaXMgZXJyb3Igd2FzIHRocm93biBhcyBhIGNvbnZlbmllbmNlIHNvIHRoYXQgeW91IGNhbiB1c2UgdGhpcyBzdGFja1xuICAgICAgLy8gdG8gZmluZCB0aGUgY2FsbHNpdGUgdGhhdCBjYXVzZWQgdGhpcyB3YXJuaW5nIHRvIGZpcmUuXG4gICAgICB0aHJvdyBuZXcgRXJyb3IobWVzc2FnZSk7XG4gICAgfSBjYXRjaCAoeCkge31cbiAgfTtcblxuICBsb3dQcmlvcml0eVdhcm5pbmcgPSBmdW5jdGlvbiAoY29uZGl0aW9uLCBmb3JtYXQpIHtcbiAgICBpZiAoZm9ybWF0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignYHdhcm5pbmcoY29uZGl0aW9uLCBmb3JtYXQsIC4uLmFyZ3MpYCByZXF1aXJlcyBhIHdhcm5pbmcgJyArICdtZXNzYWdlIGFyZ3VtZW50Jyk7XG4gICAgfVxuICAgIGlmICghY29uZGl0aW9uKSB7XG4gICAgICBmb3IgKHZhciBfbGVuMiA9IGFyZ3VtZW50cy5sZW5ndGgsIGFyZ3MgPSBBcnJheShfbGVuMiA+IDIgPyBfbGVuMiAtIDIgOiAwKSwgX2tleTIgPSAyOyBfa2V5MiA8IF9sZW4yOyBfa2V5MisrKSB7XG4gICAgICAgIGFyZ3NbX2tleTIgLSAyXSA9IGFyZ3VtZW50c1tfa2V5Ml07XG4gICAgICB9XG5cbiAgICAgIHByaW50V2FybmluZy5hcHBseSh1bmRlZmluZWQsIFtmb3JtYXRdLmNvbmNhdChhcmdzKSk7XG4gICAgfVxuICB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGxvd1ByaW9yaXR5V2FybmluZzsiLCIvKipcbiAqIENvcHlyaWdodCAyMDEzLXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIF9wcm9kSW52YXJpYW50ID0gcmVxdWlyZSgnLi9yZWFjdFByb2RJbnZhcmlhbnQnKTtcblxudmFyIFJlYWN0RWxlbWVudCA9IHJlcXVpcmUoJy4vUmVhY3RFbGVtZW50Jyk7XG5cbnZhciBpbnZhcmlhbnQgPSByZXF1aXJlKCdmYmpzL2xpYi9pbnZhcmlhbnQnKTtcblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBmaXJzdCBjaGlsZCBpbiBhIGNvbGxlY3Rpb24gb2YgY2hpbGRyZW4gYW5kIHZlcmlmaWVzIHRoYXQgdGhlcmVcbiAqIGlzIG9ubHkgb25lIGNoaWxkIGluIHRoZSBjb2xsZWN0aW9uLlxuICpcbiAqIFNlZSBodHRwczovL2ZhY2Vib29rLmdpdGh1Yi5pby9yZWFjdC9kb2NzL3RvcC1sZXZlbC1hcGkuaHRtbCNyZWFjdC5jaGlsZHJlbi5vbmx5XG4gKlxuICogVGhlIGN1cnJlbnQgaW1wbGVtZW50YXRpb24gb2YgdGhpcyBmdW5jdGlvbiBhc3N1bWVzIHRoYXQgYSBzaW5nbGUgY2hpbGQgZ2V0c1xuICogcGFzc2VkIHdpdGhvdXQgYSB3cmFwcGVyLCBidXQgdGhlIHB1cnBvc2Ugb2YgdGhpcyBoZWxwZXIgZnVuY3Rpb24gaXMgdG9cbiAqIGFic3RyYWN0IGF3YXkgdGhlIHBhcnRpY3VsYXIgc3RydWN0dXJlIG9mIGNoaWxkcmVuLlxuICpcbiAqIEBwYXJhbSB7P29iamVjdH0gY2hpbGRyZW4gQ2hpbGQgY29sbGVjdGlvbiBzdHJ1Y3R1cmUuXG4gKiBAcmV0dXJuIHtSZWFjdEVsZW1lbnR9IFRoZSBmaXJzdCBhbmQgb25seSBgUmVhY3RFbGVtZW50YCBjb250YWluZWQgaW4gdGhlXG4gKiBzdHJ1Y3R1cmUuXG4gKi9cbmZ1bmN0aW9uIG9ubHlDaGlsZChjaGlsZHJlbikge1xuICAhUmVhY3RFbGVtZW50LmlzVmFsaWRFbGVtZW50KGNoaWxkcmVuKSA/IHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyBpbnZhcmlhbnQoZmFsc2UsICdSZWFjdC5DaGlsZHJlbi5vbmx5IGV4cGVjdGVkIHRvIHJlY2VpdmUgYSBzaW5nbGUgUmVhY3QgZWxlbWVudCBjaGlsZC4nKSA6IF9wcm9kSW52YXJpYW50KCcxNDMnKSA6IHZvaWQgMDtcbiAgcmV0dXJuIGNoaWxkcmVuO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IG9ubHlDaGlsZDsiLCIvKipcbiAqIENvcHlyaWdodCAoYykgMjAxMy1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICogXG4gKi9cbid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBXQVJOSU5HOiBETyBOT1QgbWFudWFsbHkgcmVxdWlyZSB0aGlzIG1vZHVsZS5cbiAqIFRoaXMgaXMgYSByZXBsYWNlbWVudCBmb3IgYGludmFyaWFudCguLi4pYCB1c2VkIGJ5IHRoZSBlcnJvciBjb2RlIHN5c3RlbVxuICogYW5kIHdpbGwgX29ubHlfIGJlIHJlcXVpcmVkIGJ5IHRoZSBjb3JyZXNwb25kaW5nIGJhYmVsIHBhc3MuXG4gKiBJdCBhbHdheXMgdGhyb3dzLlxuICovXG5cbmZ1bmN0aW9uIHJlYWN0UHJvZEludmFyaWFudChjb2RlKSB7XG4gIHZhciBhcmdDb3VudCA9IGFyZ3VtZW50cy5sZW5ndGggLSAxO1xuXG4gIHZhciBtZXNzYWdlID0gJ01pbmlmaWVkIFJlYWN0IGVycm9yICMnICsgY29kZSArICc7IHZpc2l0ICcgKyAnaHR0cDovL2ZhY2Vib29rLmdpdGh1Yi5pby9yZWFjdC9kb2NzL2Vycm9yLWRlY29kZXIuaHRtbD9pbnZhcmlhbnQ9JyArIGNvZGU7XG5cbiAgZm9yICh2YXIgYXJnSWR4ID0gMDsgYXJnSWR4IDwgYXJnQ291bnQ7IGFyZ0lkeCsrKSB7XG4gICAgbWVzc2FnZSArPSAnJmFyZ3NbXT0nICsgZW5jb2RlVVJJQ29tcG9uZW50KGFyZ3VtZW50c1thcmdJZHggKyAxXSk7XG4gIH1cblxuICBtZXNzYWdlICs9ICcgZm9yIHRoZSBmdWxsIG1lc3NhZ2Ugb3IgdXNlIHRoZSBub24tbWluaWZpZWQgZGV2IGVudmlyb25tZW50JyArICcgZm9yIGZ1bGwgZXJyb3JzIGFuZCBhZGRpdGlvbmFsIGhlbHBmdWwgd2FybmluZ3MuJztcblxuICB2YXIgZXJyb3IgPSBuZXcgRXJyb3IobWVzc2FnZSk7XG4gIGVycm9yLm5hbWUgPSAnSW52YXJpYW50IFZpb2xhdGlvbic7XG4gIGVycm9yLmZyYW1lc1RvUG9wID0gMTsgLy8gd2UgZG9uJ3QgY2FyZSBhYm91dCByZWFjdFByb2RJbnZhcmlhbnQncyBvd24gZnJhbWVcblxuICB0aHJvdyBlcnJvcjtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSByZWFjdFByb2RJbnZhcmlhbnQ7IiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxMy1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIF9wcm9kSW52YXJpYW50ID0gcmVxdWlyZSgnLi9yZWFjdFByb2RJbnZhcmlhbnQnKTtcblxudmFyIFJlYWN0Q3VycmVudE93bmVyID0gcmVxdWlyZSgnLi9SZWFjdEN1cnJlbnRPd25lcicpO1xudmFyIFJFQUNUX0VMRU1FTlRfVFlQRSA9IHJlcXVpcmUoJy4vUmVhY3RFbGVtZW50U3ltYm9sJyk7XG5cbnZhciBnZXRJdGVyYXRvckZuID0gcmVxdWlyZSgnLi9nZXRJdGVyYXRvckZuJyk7XG52YXIgaW52YXJpYW50ID0gcmVxdWlyZSgnZmJqcy9saWIvaW52YXJpYW50Jyk7XG52YXIgS2V5RXNjYXBlVXRpbHMgPSByZXF1aXJlKCcuL0tleUVzY2FwZVV0aWxzJyk7XG52YXIgd2FybmluZyA9IHJlcXVpcmUoJ2ZianMvbGliL3dhcm5pbmcnKTtcblxudmFyIFNFUEFSQVRPUiA9ICcuJztcbnZhciBTVUJTRVBBUkFUT1IgPSAnOic7XG5cbi8qKlxuICogVGhpcyBpcyBpbmxpbmVkIGZyb20gUmVhY3RFbGVtZW50IHNpbmNlIHRoaXMgZmlsZSBpcyBzaGFyZWQgYmV0d2VlblxuICogaXNvbW9ycGhpYyBhbmQgcmVuZGVyZXJzLiBXZSBjb3VsZCBleHRyYWN0IHRoaXMgdG8gYVxuICpcbiAqL1xuXG4vKipcbiAqIFRPRE86IFRlc3QgdGhhdCBhIHNpbmdsZSBjaGlsZCBhbmQgYW4gYXJyYXkgd2l0aCBvbmUgaXRlbSBoYXZlIHRoZSBzYW1lIGtleVxuICogcGF0dGVybi5cbiAqL1xuXG52YXIgZGlkV2FybkFib3V0TWFwcyA9IGZhbHNlO1xuXG4vKipcbiAqIEdlbmVyYXRlIGEga2V5IHN0cmluZyB0aGF0IGlkZW50aWZpZXMgYSBjb21wb25lbnQgd2l0aGluIGEgc2V0LlxuICpcbiAqIEBwYXJhbSB7Kn0gY29tcG9uZW50IEEgY29tcG9uZW50IHRoYXQgY291bGQgY29udGFpbiBhIG1hbnVhbCBrZXkuXG4gKiBAcGFyYW0ge251bWJlcn0gaW5kZXggSW5kZXggdGhhdCBpcyB1c2VkIGlmIGEgbWFudWFsIGtleSBpcyBub3QgcHJvdmlkZWQuXG4gKiBAcmV0dXJuIHtzdHJpbmd9XG4gKi9cbmZ1bmN0aW9uIGdldENvbXBvbmVudEtleShjb21wb25lbnQsIGluZGV4KSB7XG4gIC8vIERvIHNvbWUgdHlwZWNoZWNraW5nIGhlcmUgc2luY2Ugd2UgY2FsbCB0aGlzIGJsaW5kbHkuIFdlIHdhbnQgdG8gZW5zdXJlXG4gIC8vIHRoYXQgd2UgZG9uJ3QgYmxvY2sgcG90ZW50aWFsIGZ1dHVyZSBFUyBBUElzLlxuICBpZiAoY29tcG9uZW50ICYmIHR5cGVvZiBjb21wb25lbnQgPT09ICdvYmplY3QnICYmIGNvbXBvbmVudC5rZXkgIT0gbnVsbCkge1xuICAgIC8vIEV4cGxpY2l0IGtleVxuICAgIHJldHVybiBLZXlFc2NhcGVVdGlscy5lc2NhcGUoY29tcG9uZW50LmtleSk7XG4gIH1cbiAgLy8gSW1wbGljaXQga2V5IGRldGVybWluZWQgYnkgdGhlIGluZGV4IGluIHRoZSBzZXRcbiAgcmV0dXJuIGluZGV4LnRvU3RyaW5nKDM2KTtcbn1cblxuLyoqXG4gKiBAcGFyYW0gez8qfSBjaGlsZHJlbiBDaGlsZHJlbiB0cmVlIGNvbnRhaW5lci5cbiAqIEBwYXJhbSB7IXN0cmluZ30gbmFtZVNvRmFyIE5hbWUgb2YgdGhlIGtleSBwYXRoIHNvIGZhci5cbiAqIEBwYXJhbSB7IWZ1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayB0byBpbnZva2Ugd2l0aCBlYWNoIGNoaWxkIGZvdW5kLlxuICogQHBhcmFtIHs/Kn0gdHJhdmVyc2VDb250ZXh0IFVzZWQgdG8gcGFzcyBpbmZvcm1hdGlvbiB0aHJvdWdob3V0IHRoZSB0cmF2ZXJzYWxcbiAqIHByb2Nlc3MuXG4gKiBAcmV0dXJuIHshbnVtYmVyfSBUaGUgbnVtYmVyIG9mIGNoaWxkcmVuIGluIHRoaXMgc3VidHJlZS5cbiAqL1xuZnVuY3Rpb24gdHJhdmVyc2VBbGxDaGlsZHJlbkltcGwoY2hpbGRyZW4sIG5hbWVTb0ZhciwgY2FsbGJhY2ssIHRyYXZlcnNlQ29udGV4dCkge1xuICB2YXIgdHlwZSA9IHR5cGVvZiBjaGlsZHJlbjtcblxuICBpZiAodHlwZSA9PT0gJ3VuZGVmaW5lZCcgfHwgdHlwZSA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgLy8gQWxsIG9mIHRoZSBhYm92ZSBhcmUgcGVyY2VpdmVkIGFzIG51bGwuXG4gICAgY2hpbGRyZW4gPSBudWxsO1xuICB9XG5cbiAgaWYgKGNoaWxkcmVuID09PSBudWxsIHx8IHR5cGUgPT09ICdzdHJpbmcnIHx8IHR5cGUgPT09ICdudW1iZXInIHx8XG4gIC8vIFRoZSBmb2xsb3dpbmcgaXMgaW5saW5lZCBmcm9tIFJlYWN0RWxlbWVudC4gVGhpcyBtZWFucyB3ZSBjYW4gb3B0aW1pemVcbiAgLy8gc29tZSBjaGVja3MuIFJlYWN0IEZpYmVyIGFsc28gaW5saW5lcyB0aGlzIGxvZ2ljIGZvciBzaW1pbGFyIHB1cnBvc2VzLlxuICB0eXBlID09PSAnb2JqZWN0JyAmJiBjaGlsZHJlbi4kJHR5cGVvZiA9PT0gUkVBQ1RfRUxFTUVOVF9UWVBFKSB7XG4gICAgY2FsbGJhY2sodHJhdmVyc2VDb250ZXh0LCBjaGlsZHJlbixcbiAgICAvLyBJZiBpdCdzIHRoZSBvbmx5IGNoaWxkLCB0cmVhdCB0aGUgbmFtZSBhcyBpZiBpdCB3YXMgd3JhcHBlZCBpbiBhbiBhcnJheVxuICAgIC8vIHNvIHRoYXQgaXQncyBjb25zaXN0ZW50IGlmIHRoZSBudW1iZXIgb2YgY2hpbGRyZW4gZ3Jvd3MuXG4gICAgbmFtZVNvRmFyID09PSAnJyA/IFNFUEFSQVRPUiArIGdldENvbXBvbmVudEtleShjaGlsZHJlbiwgMCkgOiBuYW1lU29GYXIpO1xuICAgIHJldHVybiAxO1xuICB9XG5cbiAgdmFyIGNoaWxkO1xuICB2YXIgbmV4dE5hbWU7XG4gIHZhciBzdWJ0cmVlQ291bnQgPSAwOyAvLyBDb3VudCBvZiBjaGlsZHJlbiBmb3VuZCBpbiB0aGUgY3VycmVudCBzdWJ0cmVlLlxuICB2YXIgbmV4dE5hbWVQcmVmaXggPSBuYW1lU29GYXIgPT09ICcnID8gU0VQQVJBVE9SIDogbmFtZVNvRmFyICsgU1VCU0VQQVJBVE9SO1xuXG4gIGlmIChBcnJheS5pc0FycmF5KGNoaWxkcmVuKSkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNoaWxkID0gY2hpbGRyZW5baV07XG4gICAgICBuZXh0TmFtZSA9IG5leHROYW1lUHJlZml4ICsgZ2V0Q29tcG9uZW50S2V5KGNoaWxkLCBpKTtcbiAgICAgIHN1YnRyZWVDb3VudCArPSB0cmF2ZXJzZUFsbENoaWxkcmVuSW1wbChjaGlsZCwgbmV4dE5hbWUsIGNhbGxiYWNrLCB0cmF2ZXJzZUNvbnRleHQpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB2YXIgaXRlcmF0b3JGbiA9IGdldEl0ZXJhdG9yRm4oY2hpbGRyZW4pO1xuICAgIGlmIChpdGVyYXRvckZuKSB7XG4gICAgICB2YXIgaXRlcmF0b3IgPSBpdGVyYXRvckZuLmNhbGwoY2hpbGRyZW4pO1xuICAgICAgdmFyIHN0ZXA7XG4gICAgICBpZiAoaXRlcmF0b3JGbiAhPT0gY2hpbGRyZW4uZW50cmllcykge1xuICAgICAgICB2YXIgaWkgPSAwO1xuICAgICAgICB3aGlsZSAoIShzdGVwID0gaXRlcmF0b3IubmV4dCgpKS5kb25lKSB7XG4gICAgICAgICAgY2hpbGQgPSBzdGVwLnZhbHVlO1xuICAgICAgICAgIG5leHROYW1lID0gbmV4dE5hbWVQcmVmaXggKyBnZXRDb21wb25lbnRLZXkoY2hpbGQsIGlpKyspO1xuICAgICAgICAgIHN1YnRyZWVDb3VudCArPSB0cmF2ZXJzZUFsbENoaWxkcmVuSW1wbChjaGlsZCwgbmV4dE5hbWUsIGNhbGxiYWNrLCB0cmF2ZXJzZUNvbnRleHQpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgICAgIHZhciBtYXBzQXNDaGlsZHJlbkFkZGVuZHVtID0gJyc7XG4gICAgICAgICAgaWYgKFJlYWN0Q3VycmVudE93bmVyLmN1cnJlbnQpIHtcbiAgICAgICAgICAgIHZhciBtYXBzQXNDaGlsZHJlbk93bmVyTmFtZSA9IFJlYWN0Q3VycmVudE93bmVyLmN1cnJlbnQuZ2V0TmFtZSgpO1xuICAgICAgICAgICAgaWYgKG1hcHNBc0NoaWxkcmVuT3duZXJOYW1lKSB7XG4gICAgICAgICAgICAgIG1hcHNBc0NoaWxkcmVuQWRkZW5kdW0gPSAnIENoZWNrIHRoZSByZW5kZXIgbWV0aG9kIG9mIGAnICsgbWFwc0FzQ2hpbGRyZW5Pd25lck5hbWUgKyAnYC4nO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nID8gd2FybmluZyhkaWRXYXJuQWJvdXRNYXBzLCAnVXNpbmcgTWFwcyBhcyBjaGlsZHJlbiBpcyBub3QgeWV0IGZ1bGx5IHN1cHBvcnRlZC4gSXQgaXMgYW4gJyArICdleHBlcmltZW50YWwgZmVhdHVyZSB0aGF0IG1pZ2h0IGJlIHJlbW92ZWQuIENvbnZlcnQgaXQgdG8gYSAnICsgJ3NlcXVlbmNlIC8gaXRlcmFibGUgb2Yga2V5ZWQgUmVhY3RFbGVtZW50cyBpbnN0ZWFkLiVzJywgbWFwc0FzQ2hpbGRyZW5BZGRlbmR1bSkgOiB2b2lkIDA7XG4gICAgICAgICAgZGlkV2FybkFib3V0TWFwcyA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gSXRlcmF0b3Igd2lsbCBwcm92aWRlIGVudHJ5IFtrLHZdIHR1cGxlcyByYXRoZXIgdGhhbiB2YWx1ZXMuXG4gICAgICAgIHdoaWxlICghKHN0ZXAgPSBpdGVyYXRvci5uZXh0KCkpLmRvbmUpIHtcbiAgICAgICAgICB2YXIgZW50cnkgPSBzdGVwLnZhbHVlO1xuICAgICAgICAgIGlmIChlbnRyeSkge1xuICAgICAgICAgICAgY2hpbGQgPSBlbnRyeVsxXTtcbiAgICAgICAgICAgIG5leHROYW1lID0gbmV4dE5hbWVQcmVmaXggKyBLZXlFc2NhcGVVdGlscy5lc2NhcGUoZW50cnlbMF0pICsgU1VCU0VQQVJBVE9SICsgZ2V0Q29tcG9uZW50S2V5KGNoaWxkLCAwKTtcbiAgICAgICAgICAgIHN1YnRyZWVDb3VudCArPSB0cmF2ZXJzZUFsbENoaWxkcmVuSW1wbChjaGlsZCwgbmV4dE5hbWUsIGNhbGxiYWNrLCB0cmF2ZXJzZUNvbnRleHQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIHZhciBhZGRlbmR1bSA9ICcnO1xuICAgICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgICAgYWRkZW5kdW0gPSAnIElmIHlvdSBtZWFudCB0byByZW5kZXIgYSBjb2xsZWN0aW9uIG9mIGNoaWxkcmVuLCB1c2UgYW4gYXJyYXkgJyArICdpbnN0ZWFkIG9yIHdyYXAgdGhlIG9iamVjdCB1c2luZyBjcmVhdGVGcmFnbWVudChvYmplY3QpIGZyb20gdGhlICcgKyAnUmVhY3QgYWRkLW9ucy4nO1xuICAgICAgICBpZiAoY2hpbGRyZW4uX2lzUmVhY3RFbGVtZW50KSB7XG4gICAgICAgICAgYWRkZW5kdW0gPSBcIiBJdCBsb29rcyBsaWtlIHlvdSdyZSB1c2luZyBhbiBlbGVtZW50IGNyZWF0ZWQgYnkgYSBkaWZmZXJlbnQgXCIgKyAndmVyc2lvbiBvZiBSZWFjdC4gTWFrZSBzdXJlIHRvIHVzZSBvbmx5IG9uZSBjb3B5IG9mIFJlYWN0Lic7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKFJlYWN0Q3VycmVudE93bmVyLmN1cnJlbnQpIHtcbiAgICAgICAgICB2YXIgbmFtZSA9IFJlYWN0Q3VycmVudE93bmVyLmN1cnJlbnQuZ2V0TmFtZSgpO1xuICAgICAgICAgIGlmIChuYW1lKSB7XG4gICAgICAgICAgICBhZGRlbmR1bSArPSAnIENoZWNrIHRoZSByZW5kZXIgbWV0aG9kIG9mIGAnICsgbmFtZSArICdgLic7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICB2YXIgY2hpbGRyZW5TdHJpbmcgPSBTdHJpbmcoY2hpbGRyZW4pO1xuICAgICAgIWZhbHNlID8gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/IGludmFyaWFudChmYWxzZSwgJ09iamVjdHMgYXJlIG5vdCB2YWxpZCBhcyBhIFJlYWN0IGNoaWxkIChmb3VuZDogJXMpLiVzJywgY2hpbGRyZW5TdHJpbmcgPT09ICdbb2JqZWN0IE9iamVjdF0nID8gJ29iamVjdCB3aXRoIGtleXMgeycgKyBPYmplY3Qua2V5cyhjaGlsZHJlbikuam9pbignLCAnKSArICd9JyA6IGNoaWxkcmVuU3RyaW5nLCBhZGRlbmR1bSkgOiBfcHJvZEludmFyaWFudCgnMzEnLCBjaGlsZHJlblN0cmluZyA9PT0gJ1tvYmplY3QgT2JqZWN0XScgPyAnb2JqZWN0IHdpdGgga2V5cyB7JyArIE9iamVjdC5rZXlzKGNoaWxkcmVuKS5qb2luKCcsICcpICsgJ30nIDogY2hpbGRyZW5TdHJpbmcsIGFkZGVuZHVtKSA6IHZvaWQgMDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gc3VidHJlZUNvdW50O1xufVxuXG4vKipcbiAqIFRyYXZlcnNlcyBjaGlsZHJlbiB0aGF0IGFyZSB0eXBpY2FsbHkgc3BlY2lmaWVkIGFzIGBwcm9wcy5jaGlsZHJlbmAsIGJ1dFxuICogbWlnaHQgYWxzbyBiZSBzcGVjaWZpZWQgdGhyb3VnaCBhdHRyaWJ1dGVzOlxuICpcbiAqIC0gYHRyYXZlcnNlQWxsQ2hpbGRyZW4odGhpcy5wcm9wcy5jaGlsZHJlbiwgLi4uKWBcbiAqIC0gYHRyYXZlcnNlQWxsQ2hpbGRyZW4odGhpcy5wcm9wcy5sZWZ0UGFuZWxDaGlsZHJlbiwgLi4uKWBcbiAqXG4gKiBUaGUgYHRyYXZlcnNlQ29udGV4dGAgaXMgYW4gb3B0aW9uYWwgYXJndW1lbnQgdGhhdCBpcyBwYXNzZWQgdGhyb3VnaCB0aGVcbiAqIGVudGlyZSB0cmF2ZXJzYWwuIEl0IGNhbiBiZSB1c2VkIHRvIHN0b3JlIGFjY3VtdWxhdGlvbnMgb3IgYW55dGhpbmcgZWxzZSB0aGF0XG4gKiB0aGUgY2FsbGJhY2sgbWlnaHQgZmluZCByZWxldmFudC5cbiAqXG4gKiBAcGFyYW0gez8qfSBjaGlsZHJlbiBDaGlsZHJlbiB0cmVlIG9iamVjdC5cbiAqIEBwYXJhbSB7IWZ1bmN0aW9ufSBjYWxsYmFjayBUbyBpbnZva2UgdXBvbiB0cmF2ZXJzaW5nIGVhY2ggY2hpbGQuXG4gKiBAcGFyYW0gez8qfSB0cmF2ZXJzZUNvbnRleHQgQ29udGV4dCBmb3IgdHJhdmVyc2FsLlxuICogQHJldHVybiB7IW51bWJlcn0gVGhlIG51bWJlciBvZiBjaGlsZHJlbiBpbiB0aGlzIHN1YnRyZWUuXG4gKi9cbmZ1bmN0aW9uIHRyYXZlcnNlQWxsQ2hpbGRyZW4oY2hpbGRyZW4sIGNhbGxiYWNrLCB0cmF2ZXJzZUNvbnRleHQpIHtcbiAgaWYgKGNoaWxkcmVuID09IG51bGwpIHtcbiAgICByZXR1cm4gMDtcbiAgfVxuXG4gIHJldHVybiB0cmF2ZXJzZUFsbENoaWxkcmVuSW1wbChjaGlsZHJlbiwgJycsIGNhbGxiYWNrLCB0cmF2ZXJzZUNvbnRleHQpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHRyYXZlcnNlQWxsQ2hpbGRyZW47IiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vbGliL1JlYWN0Jyk7XG4iLCJ2YXIgYXhpb3MgPSByZXF1aXJlKCdheGlvcycpO1xudmFyIHJlYWN0ID0gcmVxdWlyZSgncmVhY3QnKTtcblxuXG5jbGFzcyBOYXYgZXh0ZW5kcyByZWFjdC5Db21wb25lbnQgeyAgXG5cbiAgY29uc3RydWN0b3IocHJvcHMpe1xuICAgIHN1cGVyKHByb3BzKTtcbiAgICB0aGlzLnRlc3RHZXQoKTtcbiAgfTtcblxuICByZW5kZXIoKXtcbiAgICByZXR1cm4gKFxuICAgICAgPG5hdiBpZD1cIm1haW5OYXZcIiBjbGFzc05hbWU9XCJuYXZiYXIgbmF2YmFyLWRlZmF1bHQgbmF2YmFyLWZpeGVkLXRvcCBuYXZiYXItY3VzdG9tXCI+XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY29udGFpbmVyXCI+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJuYXZiYXItaGVhZGVyIHBhZ2Utc2Nyb2xsXCI+XG4gICAgICAgICAgICA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzc05hbWU9XCJuYXZiYXItdG9nZ2xlXCIgZGF0YS10b2dnbGU9XCJjb2xsYXBzZVwiIGRhdGEtdGFyZ2V0PVwiI2JzLWV4YW1wbGUtbmF2YmFyLWNvbGxhcHNlLTFcIj5cbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwic3Itb25seVwiPlRvZ2dsZSBuYXZpZ2F0aW9uPC9zcGFuPiBNZW51IDxpIGNsYXNzTmFtZT1cImZhIGZhLWJhcnNcIiAvPlxuICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICA8YSBjbGFzc05hbWU9XCJuYXZiYXItYnJhbmRcIiBocmVmPVwiL1wiPkltZ3JhYjwvYT5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImNvbGxhcHNlIG5hdmJhci1jb2xsYXBzZVwiIGlkPVwiYnMtZXhhbXBsZS1uYXZiYXItY29sbGFwc2UtMVwiPlxuICAgICAgICAgICAgPHVsIGNsYXNzTmFtZT1cIm5hdiBuYXZiYXItbmF2IG5hdmJhci1yaWdodFwiPlxuICAgICAgICAgICAgICA8bGkgY2xhc3NOYW1lPVwiaGlkZGVuXCI+XG4gICAgICAgICAgICAgICAgPGEgaHJlZj1cIiNwYWdlLXRvcFwiIC8+XG4gICAgICAgICAgICAgIDwvbGk+XG4gICAgICAgICAgICAgIDxsaSBjbGFzc05hbWU9XCJwYWdlLXNjcm9sbFwiPlxuICAgICAgICAgICAgICAgIDxhIGhyZWY9XCIvaW1hZ2VzXCI+TXkgSW1hZ2VzPC9hPlxuICAgICAgICAgICAgICA8L2xpPlxuICAgICAgICAgICAgICA8bGkgY2xhc3NOYW1lPVwicGFnZS1zY3JvbGxcIj5cbiAgICAgICAgICAgICAgICA8YSBocmVmPVwiI1wiPkhlbHA8L2E+XG4gICAgICAgICAgICAgIDwvbGk+XG4gICAgICAgICAgICAgIDxsaSBjbGFzc05hbWU9XCJwYWdlLXNjcm9sbFwiPlxuICAgICAgICAgICAgICAgIDxhIGhyZWY9XCIjXCI+Q29udGFjdDwvYT5cbiAgICAgICAgICAgICAgPC9saT5cbiAgICAgICAgICAgIDwvdWw+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9uYXY+XG4gICAgKTtcbiAgfTtcblxuICB0ZXN0R2V0KCkge1xuICAgIGF4aW9zLmdldCgnaHR0cDovLzEyNy4wLjAuMTo1MDAwL2FwaS9pbWFnZXMnKVxuICAgIC50aGVuKGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgY29uc29sZS5sb2cocmVzcG9uc2UpO1xuICAgIH0pXG4gICAgLmNhdGNoKGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgY29uc29sZS5sb2coZXJyb3IpO1xuICAgIH0pO1xuICB9XG5cbn07XG5cblxuXG4vLyBjbGFzcyBQYWdlQ29udGFpbmVyIGV4dGVuZHMgQ29tcG9uZW50IHtcbi8vICAgcmVuZGVyKCkge1xuLy8gICAgIHJldHVybiAoXG4vLyAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInBhZ2UtY29udGFpbmVyXCI+XG4vLyAgICAgICAgIHt0aGlzLnByb3BzLmNoaWxkcmVufVxuLy8gICAgICAgPC9kaXY+XG4vLyAgICAgKTtcbi8vICAgfVxuLy8gfVxuXG5cblxudmFyIFBhZ2VDb250YWluZXIgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG4gIHJlbmRlcigpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJwYWdlLWNvbnRhaW5lclwiPlxuICAgICAgICB7dGhpcy5wcm9wcy5jaGlsZHJlbn1cbiAgICAgIDwvZGl2PlxuICAgICk7XG4gIH1cbn0pO1xuXG52YXIgRHluYW1pY1NlYXJjaCA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcblxuICAvLyBzZXRzIGluaXRpYWwgc3RhdGVcbiAgZ2V0SW5pdGlhbFN0YXRlOiBmdW5jdGlvbigpe1xuICAgIHJldHVybiB7IHNlYXJjaFN0cmluZzogJycgfTtcbiAgfSxcblxuICAvLyBzZXRzIHN0YXRlLCB0cmlnZ2VycyByZW5kZXIgbWV0aG9kXG4gIGhhbmRsZUNoYW5nZTogZnVuY3Rpb24oZXZlbnQpe1xuICAgIC8vIGdyYWIgdmFsdWUgZm9ybSBpbnB1dCBib3hcbiAgICB0aGlzLnNldFN0YXRlKHtzZWFyY2hTdHJpbmc6ZXZlbnQudGFyZ2V0LnZhbHVlfSk7XG4gICAgY29uc29sZS5sb2coXCJzY29wZSB1cGRhdGVkIVwiKTtcbiAgfSxcblxuICByZW5kZXI6IGZ1bmN0aW9uKCkge1xuXG4gICAgdmFyIGNvdW50cmllcyA9IHRoaXMucHJvcHMuaXRlbXM7XG4gICAgdmFyIHNlYXJjaFN0cmluZyA9IHRoaXMuc3RhdGUuc2VhcmNoU3RyaW5nLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuXG4gICAgLy8gZmlsdGVyIGNvdW50cmllcyBsaXN0IGJ5IHZhbHVlIGZyb20gaW5wdXQgYm94XG4gICAgaWYoc2VhcmNoU3RyaW5nLmxlbmd0aCA+IDApe1xuICAgICAgY291bnRyaWVzID0gY291bnRyaWVzLmZpbHRlcihmdW5jdGlvbihjb3VudHJ5KXtcbiAgICAgICAgcmV0dXJuIGNvdW50cnkubmFtZS50b0xvd2VyQ2FzZSgpLm1hdGNoKCBzZWFyY2hTdHJpbmcgKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiAoXG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cInNlYXJjaC1jb21wb25lbnRcIj5cbiAgICAgICAgPGlucHV0IHR5cGU9XCJ0ZXh0XCIgdmFsdWU9e3RoaXMuc3RhdGUuc2VhcmNoU3RyaW5nfSBvbkNoYW5nZT17dGhpcy5oYW5kbGVDaGFuZ2V9IHBsYWNlaG9sZGVyPVwiU2VhcmNoIVwiIC8+XG4gICAgICAgIDx1bD5cbiAgICAgICAgICB7IGNvdW50cmllcy5tYXAoZnVuY3Rpb24oY291bnRyeSl7IHJldHVybiA8bGk+e2NvdW50cnkubmFtZX0gPC9saT4gfSkgfVxuICAgICAgICA8L3VsPlxuICAgICAgPC9kaXY+XG4gICAgKVxuICB9XG5cbn0pO1xuXG4vLyBsaXN0IG9mIGNvdW50cmllcywgZGVmaW5lZCB3aXRoIEphdmFTY3JpcHQgb2JqZWN0IGxpdGVyYWxzXG52YXIgY291bnRyaWVzID0gW1xuICB7XCJuYW1lXCI6IFwiU3dlZGVuXCJ9LCB7XCJuYW1lXCI6IFwiQ2hpbmFcIn0sIHtcIm5hbWVcIjogXCJQZXJ1XCJ9LCB7XCJuYW1lXCI6IFwiQ3plY2ggUmVwdWJsaWNcIn0sXG4gIHtcIm5hbWVcIjogXCJCb2xpdmlhXCJ9LCB7XCJuYW1lXCI6IFwiTGF0dmlhXCJ9LCB7XCJuYW1lXCI6IFwiU2Ftb2FcIn0sIHtcIm5hbWVcIjogXCJBcm1lbmlhXCJ9LFxuICB7XCJuYW1lXCI6IFwiR3JlZW5sYW5kXCJ9LCB7XCJuYW1lXCI6IFwiQ3ViYVwifSwge1wibmFtZVwiOiBcIldlc3Rlcm4gU2FoYXJhXCJ9LCB7XCJuYW1lXCI6IFwiRXRoaW9waWFcIn0sXG4gIHtcIm5hbWVcIjogXCJNYWxheXNpYVwifSwge1wibmFtZVwiOiBcIkFyZ2VudGluYVwifSwge1wibmFtZVwiOiBcIlVnYW5kYVwifSwge1wibmFtZVwiOiBcIkNoaWxlXCJ9LFxuICB7XCJuYW1lXCI6IFwiQXJ1YmFcIn0sIHtcIm5hbWVcIjogXCJKYXBhblwifSwge1wibmFtZVwiOiBcIlRyaW5pZGFkIGFuZCBUb2JhZ29cIn0sIHtcIm5hbWVcIjogXCJJdGFseVwifSxcbiAge1wibmFtZVwiOiBcIkNhbWJvZGlhXCJ9LCB7XCJuYW1lXCI6IFwiSWNlbGFuZFwifSwge1wibmFtZVwiOiBcIkRvbWluaWNhbiBSZXB1YmxpY1wifSwge1wibmFtZVwiOiBcIlR1cmtleVwifSxcbiAge1wibmFtZVwiOiBcIlNwYWluXCJ9LCB7XCJuYW1lXCI6IFwiUG9sYW5kXCJ9LCB7XCJuYW1lXCI6IFwiSGFpdGlcIn1cbl07XG5cblxuXG52YXIgSW1hZ2VHcmlkID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuICByZW5kZXI6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiAoXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicm93XCIgaWQ9XCJpbWFnZV9jb250YWluZXJcIj5cbiAgICAgICAgPC9kaXY+XG4gICAgKTtcbiAgfVxufSk7XG4gIFxuXG5cbmxldCBNYWluQ29udGVudCA9IChcbiAgPGRpdj5cbiAgICA8TmF2IC8+XG4gICAgPFBhZ2VDb250YWluZXI+XG4gICAgICA8RHluYW1pY1NlYXJjaCBpdGVtcz17IGNvdW50cmllcyB9IC8+XG4gICAgPC9QYWdlQ29udGFpbmVyPlxuICA8L2Rpdj5cbik7XG5cblJlYWN0RE9NLnJlbmRlcihcbiAgTWFpbkNvbnRlbnQgLCBcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJhcHAtY29udGFpbmVyXCIpXG4pO1xuXG4vLyB2YXIgTWFpbkNvbnRlbnQgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG4vLyAgICAgcmVuZGVyOiBmdW5jdGlvbigpe1xuLy8gICAgICAgICByZXR1cm4gKFxuLy8gICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtYWluLWNvbnRlbnRcIj5cbi8vICAgICAgICAgICAgICAgPE5hdiAvPlxuLy8gICAgICAgICAgICAgICA8UGFnZUNvbnRhaW5lcj5cbi8vICAgICAgICAgICAgICAgICA8RHluYW1pY1NlYXJjaCBpdGVtcz17IGNvdW50cmllcyB9IC8+XG4vLyAgICAgICAgICAgICAgIDwvUGFnZUNvbnRhaW5lcj5cbi8vICAgICAgICAgICAgIDwvZGl2PlxuLy8gICAgICAgICApXG4vLyAgICAgfVxuLy8gfSk7XG5cblxuXG4vLyBSZWFjdERPTS5yZW5kZXIoXG4vLyAgIDxNYWluQ29udGVudCAvPiwgXG4vLyAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYXBwLWNvbnRhaW5lclwiKVxuLy8gKTsiXSwicHJlRXhpc3RpbmdDb21tZW50IjoiLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ9dXRmLTg7YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0p6YjNWeVkyVnpJanBiSW01dlpHVmZiVzlrZFd4bGN5OWljbTkzYzJWeUxYQmhZMnN2WDNCeVpXeDFaR1V1YW5NaUxDSnViMlJsWDIxdlpIVnNaWE12WVhocGIzTXZhVzVrWlhndWFuTWlMQ0p1YjJSbFgyMXZaSFZzWlhNdllYaHBiM012YkdsaUwyRmtZWEIwWlhKekwzaG9jaTVxY3lJc0ltNXZaR1ZmYlc5a2RXeGxjeTloZUdsdmN5OXNhV0l2WVhocGIzTXVhbk1pTENKdWIyUmxYMjF2WkhWc1pYTXZZWGhwYjNNdmJHbGlMMk5oYm1ObGJDOURZVzVqWld3dWFuTWlMQ0p1YjJSbFgyMXZaSFZzWlhNdllYaHBiM012YkdsaUwyTmhibU5sYkM5RFlXNWpaV3hVYjJ0bGJpNXFjeUlzSW01dlpHVmZiVzlrZFd4bGN5OWhlR2x2Y3k5c2FXSXZZMkZ1WTJWc0wybHpRMkZ1WTJWc0xtcHpJaXdpYm05a1pWOXRiMlIxYkdWekwyRjRhVzl6TDJ4cFlpOWpiM0psTDBGNGFXOXpMbXB6SWl3aWJtOWtaVjl0YjJSMWJHVnpMMkY0YVc5ekwyeHBZaTlqYjNKbEwwbHVkR1Z5WTJWd2RHOXlUV0Z1WVdkbGNpNXFjeUlzSW01dlpHVmZiVzlrZFd4bGN5OWhlR2x2Y3k5c2FXSXZZMjl5WlM5amNtVmhkR1ZGY25KdmNpNXFjeUlzSW01dlpHVmZiVzlrZFd4bGN5OWhlR2x2Y3k5c2FXSXZZMjl5WlM5a2FYTndZWFJqYUZKbGNYVmxjM1F1YW5NaUxDSnViMlJsWDIxdlpIVnNaWE12WVhocGIzTXZiR2xpTDJOdmNtVXZaVzVvWVc1alpVVnljbTl5TG1weklpd2libTlrWlY5dGIyUjFiR1Z6TDJGNGFXOXpMMnhwWWk5amIzSmxMM05sZEhSc1pTNXFjeUlzSW01dlpHVmZiVzlrZFd4bGN5OWhlR2x2Y3k5c2FXSXZZMjl5WlM5MGNtRnVjMlp2Y20xRVlYUmhMbXB6SWl3aWJtOWtaVjl0YjJSMWJHVnpMMkY0YVc5ekwyeHBZaTlrWldaaGRXeDBjeTVxY3lJc0ltNXZaR1ZmYlc5a2RXeGxjeTloZUdsdmN5OXNhV0l2YUdWc2NHVnljeTlpYVc1a0xtcHpJaXdpYm05a1pWOXRiMlIxYkdWekwyRjRhVzl6TDJ4cFlpOW9aV3h3WlhKekwySjBiMkV1YW5NaUxDSnViMlJsWDIxdlpIVnNaWE12WVhocGIzTXZiR2xpTDJobGJIQmxjbk12WW5WcGJHUlZVa3d1YW5NaUxDSnViMlJsWDIxdlpIVnNaWE12WVhocGIzTXZiR2xpTDJobGJIQmxjbk12WTI5dFltbHVaVlZTVEhNdWFuTWlMQ0p1YjJSbFgyMXZaSFZzWlhNdllYaHBiM012YkdsaUwyaGxiSEJsY25NdlkyOXZhMmxsY3k1cWN5SXNJbTV2WkdWZmJXOWtkV3hsY3k5aGVHbHZjeTlzYVdJdmFHVnNjR1Z5Y3k5cGMwRmljMjlzZFhSbFZWSk1MbXB6SWl3aWJtOWtaVjl0YjJSMWJHVnpMMkY0YVc5ekwyeHBZaTlvWld4d1pYSnpMMmx6VlZKTVUyRnRaVTl5YVdkcGJpNXFjeUlzSW01dlpHVmZiVzlrZFd4bGN5OWhlR2x2Y3k5c2FXSXZhR1ZzY0dWeWN5OXViM0p0WVd4cGVtVklaV0ZrWlhKT1lXMWxMbXB6SWl3aWJtOWtaVjl0YjJSMWJHVnpMMkY0YVc5ekwyeHBZaTlvWld4d1pYSnpMM0JoY25ObFNHVmhaR1Z5Y3k1cWN5SXNJbTV2WkdWZmJXOWtkV3hsY3k5aGVHbHZjeTlzYVdJdmFHVnNjR1Z5Y3k5emNISmxZV1F1YW5NaUxDSnViMlJsWDIxdlpIVnNaWE12WVhocGIzTXZiR2xpTDNWMGFXeHpMbXB6SWl3aWJtOWtaVjl0YjJSMWJHVnpMMk55WldGMFpTMXlaV0ZqZEMxamJHRnpjeTltWVdOMGIzSjVMbXB6SWl3aWJtOWtaVjl0YjJSMWJHVnpMMlppYW5NdmJHbGlMMlZ0Y0hSNVJuVnVZM1JwYjI0dWFuTWlMQ0p1YjJSbFgyMXZaSFZzWlhNdlptSnFjeTlzYVdJdlpXMXdkSGxQWW1wbFkzUXVhbk1pTENKdWIyUmxYMjF2WkhWc1pYTXZabUpxY3k5c2FXSXZhVzUyWVhKcFlXNTBMbXB6SWl3aWJtOWtaVjl0YjJSMWJHVnpMMlppYW5NdmJHbGlMM2RoY201cGJtY3Vhbk1pTENKdWIyUmxYMjF2WkhWc1pYTXZhWE10WW5WbVptVnlMMmx1WkdWNExtcHpJaXdpYm05a1pWOXRiMlIxYkdWekwyOWlhbVZqZEMxaGMzTnBaMjR2YVc1a1pYZ3Vhbk1pTENKdWIyUmxYMjF2WkhWc1pYTXZjSEp2WTJWemN5OWljbTkzYzJWeUxtcHpJaXdpYm05a1pWOXRiMlIxYkdWekwzQnliM0F0ZEhsd1pYTXZZMmhsWTJ0UWNtOXdWSGx3WlhNdWFuTWlMQ0p1YjJSbFgyMXZaSFZzWlhNdmNISnZjQzEwZVhCbGN5OW1ZV04wYjNKNUxtcHpJaXdpYm05a1pWOXRiMlIxYkdWekwzQnliM0F0ZEhsd1pYTXZabUZqZEc5eWVWZHBkR2hVZVhCbFEyaGxZMnRsY25NdWFuTWlMQ0p1YjJSbFgyMXZaSFZzWlhNdmNISnZjQzEwZVhCbGN5OXNhV0l2VW1WaFkzUlFjbTl3Vkhsd1pYTlRaV055WlhRdWFuTWlMQ0p1YjJSbFgyMXZaSFZzWlhNdmNtVmhZM1F2YkdsaUwwdGxlVVZ6WTJGd1pWVjBhV3h6TG1weklpd2libTlrWlY5dGIyUjFiR1Z6TDNKbFlXTjBMMnhwWWk5UWIyOXNaV1JEYkdGemN5NXFjeUlzSW01dlpHVmZiVzlrZFd4bGN5OXlaV0ZqZEM5c2FXSXZVbVZoWTNRdWFuTWlMQ0p1YjJSbFgyMXZaSFZzWlhNdmNtVmhZM1F2YkdsaUwxSmxZV04wUW1GelpVTnNZWE56WlhNdWFuTWlMQ0p1YjJSbFgyMXZaSFZzWlhNdmNtVmhZM1F2YkdsaUwxSmxZV04wUTJocGJHUnlaVzR1YW5NaUxDSnViMlJsWDIxdlpIVnNaWE12Y21WaFkzUXZiR2xpTDFKbFlXTjBRMjl0Y0c5dVpXNTBWSEpsWlVodmIyc3Vhbk1pTENKdWIyUmxYMjF2WkhWc1pYTXZjbVZoWTNRdmJHbGlMMUpsWVdOMFEzVnljbVZ1ZEU5M2JtVnlMbXB6SWl3aWJtOWtaVjl0YjJSMWJHVnpMM0psWVdOMEwyeHBZaTlTWldGamRFUlBUVVpoWTNSdmNtbGxjeTVxY3lJc0ltNXZaR1ZmYlc5a2RXeGxjeTl5WldGamRDOXNhV0l2VW1WaFkzUkZiR1Z0Wlc1MExtcHpJaXdpYm05a1pWOXRiMlIxYkdWekwzSmxZV04wTDJ4cFlpOVNaV0ZqZEVWc1pXMWxiblJUZVcxaWIyd3Vhbk1pTENKdWIyUmxYMjF2WkhWc1pYTXZjbVZoWTNRdmJHbGlMMUpsWVdOMFJXeGxiV1Z1ZEZaaGJHbGtZWFJ2Y2k1cWN5SXNJbTV2WkdWZmJXOWtkV3hsY3k5eVpXRmpkQzlzYVdJdlVtVmhZM1JPYjI5d1ZYQmtZWFJsVVhWbGRXVXVhbk1pTENKdWIyUmxYMjF2WkhWc1pYTXZjbVZoWTNRdmJHbGlMMUpsWVdOMFVISnZjRlI1Y0dWTWIyTmhkR2x2Yms1aGJXVnpMbXB6SWl3aWJtOWtaVjl0YjJSMWJHVnpMM0psWVdOMEwyeHBZaTlTWldGamRGQnliM0JVZVhCbGN5NXFjeUlzSW01dlpHVmZiVzlrZFd4bGN5OXlaV0ZqZEM5c2FXSXZVbVZoWTNSUWNtOXdWSGx3WlhOVFpXTnlaWFF1YW5NaUxDSnViMlJsWDIxdlpIVnNaWE12Y21WaFkzUXZiR2xpTDFKbFlXTjBWbVZ5YzJsdmJpNXFjeUlzSW01dlpHVmZiVzlrZFd4bGN5OXlaV0ZqZEM5c2FXSXZZMkZ1UkdWbWFXNWxVSEp2Y0dWeWRIa3Vhbk1pTENKdWIyUmxYMjF2WkhWc1pYTXZjbVZoWTNRdmJHbGlMMk5vWldOclVtVmhZM1JVZVhCbFUzQmxZeTVxY3lJc0ltNXZaR1ZmYlc5a2RXeGxjeTl5WldGamRDOXNhV0l2WTNKbFlYUmxRMnhoYzNNdWFuTWlMQ0p1YjJSbFgyMXZaSFZzWlhNdmNtVmhZM1F2YkdsaUwyZGxkRWwwWlhKaGRHOXlSbTR1YW5NaUxDSnViMlJsWDIxdlpIVnNaWE12Y21WaFkzUXZiR2xpTDJ4dmQxQnlhVzl5YVhSNVYyRnlibWx1Wnk1cWN5SXNJbTV2WkdWZmJXOWtkV3hsY3k5eVpXRmpkQzlzYVdJdmIyNXNlVU5vYVd4a0xtcHpJaXdpYm05a1pWOXRiMlIxYkdWekwzSmxZV04wTDJ4cFlpOXlaV0ZqZEZCeWIyUkpiblpoY21saGJuUXVhbk1pTENKdWIyUmxYMjF2WkhWc1pYTXZjbVZoWTNRdmJHbGlMM1J5WVhabGNuTmxRV3hzUTJocGJHUnlaVzR1YW5NaUxDSnViMlJsWDIxdlpIVnNaWE12Y21WaFkzUXZjbVZoWTNRdWFuTWlMQ0p3Y205cVpXTjBMM04wWVhScFl5OXpZM0pwY0hSekwycHplQzl0WVdsdUxtcHpJbDBzSW01aGJXVnpJanBiWFN3aWJXRndjR2x1WjNNaU9pSkJRVUZCTzBGRFFVRTdPenRCUTBGQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk96czdPMEZEY0V4Qk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN08wRkRjRVJCTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdPMEZEYmtKQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CT3p0QlEzcEVRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdPMEZEVEVFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CT3p0QlEzUkdRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPenRCUTNCRVFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUczdRVU5zUWtFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVRzN1FVTXZSVUU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdPMEZEY2tKQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHM3UVVNeFFrRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPenM3UVVOd1FrRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPenM3TzBGRE5VWkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHM3UVVOWVFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUczdRVU53UTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CT3p0QlEzQkZRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdPMEZEWkVFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPenRCUTNKRVFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN08wRkRaRUU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPenRCUTNCRlFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVRzN1FVTmFRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk96dEJRM0pEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVRzN1FVTXpRa0U3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN096dEJReTlUUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdPenM3UVVONE1rSkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN096dEJRM0pEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVRzN096czdRVU5zUWtFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN096czdPMEZEZEVSQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk96czdPMEZETDBSQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CT3p0QlEzSkNRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHM3UVVNeFJrRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHM3TzBGRGVFeEJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdPenM3UVVNM1JFRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN096dEJRM0pDUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdPenM3UVVOb1owSkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUczdRVU5rUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHM3TzBGRGVrUkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHM3T3pzN1FVTTVSMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVRzN096czdRVU5zU1VFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdPenM3UVVNM1NVRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdPenRCUXpkTVFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3T3pzN1FVTjZXRUU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3T3p0QlF6TkNRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdPenM3TzBGRGRrdEJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CT3pzN08wRkRibFpCTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CT3pzN1FVTnNRa0U3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUczdPenM3UVVNM1VFRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN096czdPMEZETjBaQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVRzN096dEJRM1pDUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdPMEZEYWtKQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPenRCUTJaQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CT3pzN1FVTmFRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVRzN096czdRVU40UWtFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUczdPenRCUTNKR1FUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVRzN1FVTnlRa0U3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdPenRCUTNaRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUczdPenM3UVVNdlJFRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdPenM3UVVOd1EwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVRzN08wRkRja05CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPenM3TzBGRE9VdEJPMEZCUTBFN1FVRkRRVHRCUVVOQk96czdPenM3T3pzN096czdRVU5JUVN4SlFVRkpMRkZCUVZFc1VVRkJVU3hQUVVGU0xFTkJRVm83UVVGRFFTeEpRVUZKTEZGQlFWRXNVVUZCVVN4UFFVRlNMRU5CUVZvN08wbEJSMDBzUnpzN08wRkJSVW9zWlVGQldTeExRVUZhTEVWQlFXdENPMEZCUVVFN08wRkJRVUVzTUVkQlExWXNTMEZFVlRzN1FVRkZhRUlzVlVGQlN5eFBRVUZNTzBGQlJtZENPMEZCUjJwQ096czdPelpDUVVWUE8wRkJRMDRzWVVGRFJUdEJRVUZCTzBGQlFVRXNWVUZCU3l4SlFVRkhMRk5CUVZJc1JVRkJhMElzVjBGQlZTeHpSRUZCTlVJN1FVRkRSVHRCUVVGQk8wRkJRVUVzV1VGQlN5eFhRVUZWTEZkQlFXWTdRVUZEUlR0QlFVRkJPMEZCUVVFc1kwRkJTeXhYUVVGVkxESkNRVUZtTzBGQlEwVTdRVUZCUVR0QlFVRkJMR2RDUVVGUkxFMUJRVXNzVVVGQllpeEZRVUZ6UWl4WFFVRlZMR1ZCUVdoRExFVkJRV2RFTEdWQlFWa3NWVUZCTlVRc1JVRkJkVVVzWlVGQldTd3JRa0ZCYmtZN1FVRkRSVHRCUVVGQk8wRkJRVUVzYTBKQlFVMHNWMEZCVlN4VFFVRm9RanRCUVVGQk8wRkJRVUVzWlVGRVJqdEJRVUZCTzBGQlF6QkVMSGxEUVVGSExGZEJRVlVzV1VGQllqdEJRVVF4UkN4aFFVUkdPMEZCU1VVN1FVRkJRVHRCUVVGQkxHZENRVUZITEZkQlFWVXNZMEZCWWl4RlFVRTBRaXhOUVVGTExFZEJRV3BETzBGQlFVRTdRVUZCUVR0QlFVcEdMRmRCUkVZN1FVRlBSVHRCUVVGQk8wRkJRVUVzWTBGQlN5eFhRVUZWTERCQ1FVRm1MRVZCUVRCRExFbEJRVWNzT0VKQlFUZERPMEZCUTBVN1FVRkJRVHRCUVVGQkxHZENRVUZKTEZkQlFWVXNOa0pCUVdRN1FVRkRSVHRCUVVGQk8wRkJRVUVzYTBKQlFVa3NWMEZCVlN4UlFVRmtPMEZCUTBVc01rTkJRVWNzVFVGQlN5eFhRVUZTTzBGQlJFWXNaVUZFUmp0QlFVbEZPMEZCUVVFN1FVRkJRU3hyUWtGQlNTeFhRVUZWTEdGQlFXUTdRVUZEUlR0QlFVRkJPMEZCUVVFc2IwSkJRVWNzVFVGQlN5eFRRVUZTTzBGQlFVRTdRVUZCUVR0QlFVUkdMR1ZCU2tZN1FVRlBSVHRCUVVGQk8wRkJRVUVzYTBKQlFVa3NWMEZCVlN4aFFVRmtPMEZCUTBVN1FVRkJRVHRCUVVGQkxHOUNRVUZITEUxQlFVc3NSMEZCVWp0QlFVRkJPMEZCUVVFN1FVRkVSaXhsUVZCR08wRkJWVVU3UVVGQlFUdEJRVUZCTEd0Q1FVRkpMRmRCUVZVc1lVRkJaRHRCUVVORk8wRkJRVUU3UVVGQlFTeHZRa0ZCUnl4TlFVRkxMRWRCUVZJN1FVRkJRVHRCUVVGQk8wRkJSRVk3UVVGV1JqdEJRVVJHTzBGQlVFWTdRVUZFUml4UFFVUkdPMEZCTkVKRU96czdPRUpCUlZNN1FVRkRVaXhaUVVGTkxFZEJRVTRzUTBGQlZTeHJRMEZCVml4RlFVTkRMRWxCUkVRc1EwRkRUU3hWUVVGVkxGRkJRVllzUlVGQmIwSTdRVUZEZUVJc1owSkJRVkVzUjBGQlVpeERRVUZaTEZGQlFWbzdRVUZEUkN4UFFVaEVMRVZCU1VNc1MwRktSQ3hEUVVsUExGVkJRVlVzUzBGQlZpeEZRVUZwUWp0QlFVTjBRaXhuUWtGQlVTeEhRVUZTTEVOQlFWa3NTMEZCV2p0QlFVTkVMRTlCVGtRN1FVRlBSRHM3T3p0RlFUbERaU3hOUVVGTkxGTTdPMEZCWjBSMlFqczdRVUZKUkR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdPenRCUVVsQkxFbEJRVWtzWjBKQlFXZENMRTFCUVUwc1YwRkJUaXhEUVVGclFqdEJRVUZCTzBGQlEzQkRMRkZCUkc5RExHOUNRVU16UWp0QlFVTlFMRmRCUTBVN1FVRkJRVHRCUVVGQkxGRkJRVXNzVjBGQlZTeG5Ra0ZCWmp0QlFVTkhMRmRCUVVzc1MwRkJUQ3hEUVVGWE8wRkJSR1FzUzBGRVJqdEJRVXRFTzBGQlVHMURMRU5CUVd4Q0xFTkJRWEJDT3p0QlFWVkJMRWxCUVVrc1owSkJRV2RDTEUxQlFVMHNWMEZCVGl4RFFVRnJRanRCUVVGQk96czdRVUZGY0VNN1FVRkRRU3h0UWtGQmFVSXNNa0pCUVZVN1FVRkRla0lzVjBGQlR5eEZRVUZGTEdOQlFXTXNSVUZCYUVJc1JVRkJVRHRCUVVORUxFZEJURzFET3p0QlFVOXdRenRCUVVOQkxHZENRVUZqTEhOQ1FVRlRMRXRCUVZRc1JVRkJaVHRCUVVNelFqdEJRVU5CTEZOQlFVc3NVVUZCVEN4RFFVRmpMRVZCUVVNc1kwRkJZU3hOUVVGTkxFMUJRVTRzUTBGQllTeExRVUV6UWl4RlFVRmtPMEZCUTBFc1dVRkJVU3hIUVVGU0xFTkJRVmtzWjBKQlFWbzdRVUZEUkN4SFFWcHRRenM3UVVGamNFTXNWVUZCVVN4clFrRkJWenM3UVVGRmFrSXNVVUZCU1N4WlFVRlpMRXRCUVVzc1MwRkJUQ3hEUVVGWExFdEJRVE5DTzBGQlEwRXNVVUZCU1N4bFFVRmxMRXRCUVVzc1MwRkJUQ3hEUVVGWExGbEJRVmdzUTBGQmQwSXNTVUZCZUVJc1IwRkJLMElzVjBGQkwwSXNSVUZCYmtJN08wRkJSVUU3UVVGRFFTeFJRVUZITEdGQlFXRXNUVUZCWWl4SFFVRnpRaXhEUVVGNlFpeEZRVUV5UWp0QlFVTjZRaXhyUWtGQldTeFZRVUZWTEUxQlFWWXNRMEZCYVVJc1ZVRkJVeXhQUVVGVUxFVkJRV2xDTzBGQlF6VkRMR1ZCUVU4c1VVRkJVU3hKUVVGU0xFTkJRV0VzVjBGQllpeEhRVUV5UWl4TFFVRXpRaXhEUVVGclF5eFpRVUZzUXl4RFFVRlFPMEZCUTBRc1QwRkdWeXhEUVVGYU8wRkJSMFE3TzBGQlJVUXNWMEZEUlR0QlFVRkJPMEZCUVVFc1VVRkJTeXhYUVVGVkxHdENRVUZtTzBGQlEwVXNjVU5CUVU4c1RVRkJTeXhOUVVGYUxFVkJRVzFDTEU5QlFVOHNTMEZCU3l4TFFVRk1MRU5CUVZjc1dVRkJja01zUlVGQmJVUXNWVUZCVlN4TFFVRkxMRmxCUVd4RkxFVkJRV2RHTEdGQlFWa3NVMEZCTlVZc1IwRkVSanRCUVVWRk8wRkJRVUU3UVVGQlFUdEJRVU5KTEd0Q1FVRlZMRWRCUVZZc1EwRkJZeXhWUVVGVExFOUJRVlFzUlVGQmFVSTdRVUZCUlN4cFFrRkJUenRCUVVGQk8wRkJRVUU3UVVGQlN5eHZRa0ZCVVN4SlFVRmlPMEZCUVVFN1FVRkJRU3hYUVVGUU8wRkJRV2xETEZOQlFXeEZPMEZCUkVvN1FVRkdSaXhMUVVSR08wRkJVVVE3TzBGQmJFTnRReXhEUVVGc1FpeERRVUZ3UWpzN1FVRnpRMEU3UVVGRFFTeEpRVUZKTEZsQlFWa3NRMEZEWkN4RlFVRkRMRkZCUVZFc1VVRkJWQ3hGUVVSakxFVkJRMDBzUlVGQlF5eFJRVUZSTEU5QlFWUXNSVUZFVGl4RlFVTjVRaXhGUVVGRExGRkJRVkVzVFVGQlZDeEZRVVI2UWl4RlFVTXlReXhGUVVGRExGRkJRVkVzWjBKQlFWUXNSVUZFTTBNc1JVRkZaQ3hGUVVGRExGRkJRVkVzVTBGQlZDeEZRVVpqTEVWQlJVOHNSVUZCUXl4UlFVRlJMRkZCUVZRc1JVRkdVQ3hGUVVVeVFpeEZRVUZETEZGQlFWRXNUMEZCVkN4RlFVWXpRaXhGUVVVNFF5eEZRVUZETEZGQlFWRXNVMEZCVkN4RlFVWTVReXhGUVVka0xFVkJRVU1zVVVGQlVTeFhRVUZVTEVWQlNHTXNSVUZIVXl4RlFVRkRMRkZCUVZFc1RVRkJWQ3hGUVVoVUxFVkJSekpDTEVWQlFVTXNVVUZCVVN4blFrRkJWQ3hGUVVnelFpeEZRVWQxUkN4RlFVRkRMRkZCUVZFc1ZVRkJWQ3hGUVVoMlJDeEZRVWxrTEVWQlFVTXNVVUZCVVN4VlFVRlVMRVZCU21Nc1JVRkpVU3hGUVVGRExGRkJRVkVzVjBGQlZDeEZRVXBTTEVWQlNTdENMRVZCUVVNc1VVRkJVU3hSUVVGVUxFVkJTaTlDTEVWQlNXMUVMRVZCUVVNc1VVRkJVU3hQUVVGVUxFVkJTbTVFTEVWQlMyUXNSVUZCUXl4UlFVRlJMRTlCUVZRc1JVRk1ZeXhGUVV0TExFVkJRVU1zVVVGQlVTeFBRVUZVTEVWQlRFd3NSVUZMZDBJc1JVRkJReXhSUVVGUkxIRkNRVUZVTEVWQlRIaENMRVZCUzNsRUxFVkJRVU1zVVVGQlVTeFBRVUZVTEVWQlRIcEVMRVZCVFdRc1JVRkJReXhSUVVGUkxGVkJRVlFzUlVGT1l5eEZRVTFSTEVWQlFVTXNVVUZCVVN4VFFVRlVMRVZCVGxJc1JVRk5Oa0lzUlVGQlF5eFJRVUZSTEc5Q1FVRlVMRVZCVGpkQ0xFVkJUVFpFTEVWQlFVTXNVVUZCVVN4UlFVRlVMRVZCVGpkRUxFVkJUMlFzUlVGQlF5eFJRVUZSTEU5QlFWUXNSVUZRWXl4RlFVOUxMRVZCUVVNc1VVRkJVU3hSUVVGVUxFVkJVRXdzUlVGUGVVSXNSVUZCUXl4UlFVRlJMRTlCUVZRc1JVRlFla0lzUTBGQmFFSTdPMEZCV1VFc1NVRkJTU3haUVVGWkxFMUJRVTBzVjBGQlRpeERRVUZyUWp0QlFVRkJPenRCUVVOb1F5eFZRVUZSTEd0Q1FVRlhPMEZCUTJwQ0xGZEJRMGtzTmtKQlFVc3NWMEZCVlN4TFFVRm1MRVZCUVhGQ0xFbEJRVWNzYVVKQlFYaENMRWRCUkVvN1FVRkpSRHRCUVU0clFpeERRVUZzUWl4RFFVRm9RanM3UVVGWFFTeEpRVUZKTEdOQlEwWTdRVUZCUVR0QlFVRkJPMEZCUTBVc2MwSkJRVU1zUjBGQlJDeFBRVVJHTzBGQlJVVTdRVUZCUXl4cFFrRkJSRHRCUVVGQk8wRkJRMFVzZDBKQlFVTXNZVUZCUkN4SlFVRmxMRTlCUVZFc1UwRkJka0k3UVVGRVJqdEJRVVpHTEVOQlJFWTdPMEZCVTBFc1UwRkJVeXhOUVVGVUxFTkJRMFVzVjBGRVJpeEZRVVZGTEZOQlFWTXNZMEZCVkN4RFFVRjNRaXhsUVVGNFFpeERRVVpHT3p0QlFVdEJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHM3TzBGQlNVRTdRVUZEUVR0QlFVTkJPMEZCUTBFaUxDSm1hV3hsSWpvaVoyVnVaWEpoZEdWa0xtcHpJaXdpYzI5MWNtTmxVbTl2ZENJNklpSXNJbk52ZFhKalpYTkRiMjUwWlc1MElqcGJJaWhtZFc1amRHbHZiaUJsS0hRc2JpeHlLWHRtZFc1amRHbHZiaUJ6S0c4c2RTbDdhV1lvSVc1YmIxMHBlMmxtS0NGMFcyOWRLWHQyWVhJZ1lUMTBlWEJsYjJZZ2NtVnhkV2x5WlQwOVhDSm1kVzVqZEdsdmJsd2lKaVp5WlhGMWFYSmxPMmxtS0NGMUppWmhLWEpsZEhWeWJpQmhLRzhzSVRBcE8ybG1LR2twY21WMGRYSnVJR2tvYnl3aE1DazdkbUZ5SUdZOWJtVjNJRVZ5Y205eUtGd2lRMkZ1Ym05MElHWnBibVFnYlc5a2RXeGxJQ2RjSWl0dksxd2lKMXdpS1R0MGFISnZkeUJtTG1OdlpHVTlYQ0pOVDBSVlRFVmZUazlVWDBaUFZVNUVYQ0lzWm4xMllYSWdiRDF1VzI5ZFBYdGxlSEJ2Y25Sek9udDlmVHQwVzI5ZFd6QmRMbU5oYkd3b2JDNWxlSEJ2Y25SekxHWjFibU4wYVc5dUtHVXBlM1poY2lCdVBYUmJiMTFiTVYxYlpWMDdjbVYwZFhKdUlITW9iajl1T21VcGZTeHNMR3d1Wlhod2IzSjBjeXhsTEhRc2JpeHlLWDF5WlhSMWNtNGdibHR2WFM1bGVIQnZjblJ6ZlhaaGNpQnBQWFI1Y0dWdlppQnlaWEYxYVhKbFBUMWNJbVoxYm1OMGFXOXVYQ0ltSm5KbGNYVnBjbVU3Wm05eUtIWmhjaUJ2UFRBN2J6eHlMbXhsYm1kMGFEdHZLeXNwY3loeVcyOWRLVHR5WlhSMWNtNGdjMzBwSWl3aWJXOWtkV3hsTG1WNGNHOXlkSE1nUFNCeVpYRjFhWEpsS0NjdUwyeHBZaTloZUdsdmN5Y3BPeUlzSWlkMWMyVWdjM1J5YVdOMEp6dGNibHh1ZG1GeUlIVjBhV3h6SUQwZ2NtVnhkV2x5WlNnbkxpOHVMaTkxZEdsc2N5Y3BPMXh1ZG1GeUlITmxkSFJzWlNBOUlISmxjWFZwY21Vb0p5NHZMaTR2WTI5eVpTOXpaWFIwYkdVbktUdGNiblpoY2lCaWRXbHNaRlZTVENBOUlISmxjWFZwY21Vb0p5NHZMaTR2YUdWc2NHVnljeTlpZFdsc1pGVlNUQ2NwTzF4dWRtRnlJSEJoY25ObFNHVmhaR1Z5Y3lBOUlISmxjWFZwY21Vb0p5NHZMaTR2YUdWc2NHVnljeTl3WVhKelpVaGxZV1JsY25NbktUdGNiblpoY2lCcGMxVlNURk5oYldWUGNtbG5hVzRnUFNCeVpYRjFhWEpsS0NjdUx5NHVMMmhsYkhCbGNuTXZhWE5WVWt4VFlXMWxUM0pwWjJsdUp5azdYRzUyWVhJZ1kzSmxZWFJsUlhKeWIzSWdQU0J5WlhGMWFYSmxLQ2N1TGk5amIzSmxMMk55WldGMFpVVnljbTl5SnlrN1hHNTJZWElnWW5SdllTQTlJQ2gwZVhCbGIyWWdkMmx1Wkc5M0lDRTlQU0FuZFc1a1pXWnBibVZrSnlBbUppQjNhVzVrYjNjdVluUnZZU0FtSmlCM2FXNWtiM2N1WW5SdllTNWlhVzVrS0hkcGJtUnZkeWtwSUh4OElISmxjWFZwY21Vb0p5NHZMaTR2YUdWc2NHVnljeTlpZEc5aEp5azdYRzVjYm0xdlpIVnNaUzVsZUhCdmNuUnpJRDBnWm5WdVkzUnBiMjRnZUdoeVFXUmhjSFJsY2loamIyNW1hV2NwSUh0Y2JpQWdjbVYwZFhKdUlHNWxkeUJRY205dGFYTmxLR1oxYm1OMGFXOXVJR1JwYzNCaGRHTm9XR2h5VW1WeGRXVnpkQ2h5WlhOdmJIWmxMQ0J5WldwbFkzUXBJSHRjYmlBZ0lDQjJZWElnY21WeGRXVnpkRVJoZEdFZ1BTQmpiMjVtYVdjdVpHRjBZVHRjYmlBZ0lDQjJZWElnY21WeGRXVnpkRWhsWVdSbGNuTWdQU0JqYjI1bWFXY3VhR1ZoWkdWeWN6dGNibHh1SUNBZ0lHbG1JQ2gxZEdsc2N5NXBjMFp2Y20xRVlYUmhLSEpsY1hWbGMzUkVZWFJoS1NrZ2UxeHVJQ0FnSUNBZ1pHVnNaWFJsSUhKbGNYVmxjM1JJWldGa1pYSnpXeWREYjI1MFpXNTBMVlI1Y0dVblhUc2dMeThnVEdWMElIUm9aU0JpY205M2MyVnlJSE5sZENCcGRGeHVJQ0FnSUgxY2JseHVJQ0FnSUhaaGNpQnlaWEYxWlhOMElEMGdibVYzSUZoTlRFaDBkSEJTWlhGMVpYTjBLQ2s3WEc0Z0lDQWdkbUZ5SUd4dllXUkZkbVZ1ZENBOUlDZHZibkpsWVdSNWMzUmhkR1ZqYUdGdVoyVW5PMXh1SUNBZ0lIWmhjaUI0Ukc5dFlXbHVJRDBnWm1Gc2MyVTdYRzVjYmlBZ0lDQXZMeUJHYjNJZ1NVVWdPQzg1SUVOUFVsTWdjM1Z3Y0c5eWRGeHVJQ0FnSUM4dklFOXViSGtnYzNWd2NHOXlkSE1nVUU5VFZDQmhibVFnUjBWVUlHTmhiR3h6SUdGdVpDQmtiMlZ6YmlkMElISmxkSFZ5Ym5NZ2RHaGxJSEpsYzNCdmJuTmxJR2hsWVdSbGNuTXVYRzRnSUNBZ0x5OGdSRTlPSjFRZ1pHOGdkR2hwY3lCbWIzSWdkR1Z6ZEdsdVp5QmlMMk1nV0UxTVNIUjBjRkpsY1hWbGMzUWdhWE1nYlc5amEyVmtMQ0J1YjNRZ1dFUnZiV0ZwYmxKbGNYVmxjM1F1WEc0Z0lDQWdhV1lnS0hCeWIyTmxjM011Wlc1MkxrNVBSRVZmUlU1V0lDRTlQU0FuZEdWemRDY2dKaVpjYmlBZ0lDQWdJQ0FnZEhsd1pXOW1JSGRwYm1SdmR5QWhQVDBnSjNWdVpHVm1hVzVsWkNjZ0ppWmNiaUFnSUNBZ0lDQWdkMmx1Wkc5M0xsaEViMjFoYVc1U1pYRjFaWE4wSUNZbUlDRW9KM2RwZEdoRGNtVmtaVzUwYVdGc2N5Y2dhVzRnY21WeGRXVnpkQ2tnSmlaY2JpQWdJQ0FnSUNBZ0lXbHpWVkpNVTJGdFpVOXlhV2RwYmloamIyNW1hV2N1ZFhKc0tTa2dlMXh1SUNBZ0lDQWdjbVZ4ZFdWemRDQTlJRzVsZHlCM2FXNWtiM2N1V0VSdmJXRnBibEpsY1hWbGMzUW9LVHRjYmlBZ0lDQWdJR3h2WVdSRmRtVnVkQ0E5SUNkdmJteHZZV1FuTzF4dUlDQWdJQ0FnZUVSdmJXRnBiaUE5SUhSeWRXVTdYRzRnSUNBZ0lDQnlaWEYxWlhOMExtOXVjSEp2WjNKbGMzTWdQU0JtZFc1amRHbHZiaUJvWVc1a2JHVlFjbTluY21WemN5Z3BJSHQ5TzF4dUlDQWdJQ0FnY21WeGRXVnpkQzV2Ym5ScGJXVnZkWFFnUFNCbWRXNWpkR2x2YmlCb1lXNWtiR1ZVYVcxbGIzVjBLQ2tnZTMwN1hHNGdJQ0FnZlZ4dVhHNGdJQ0FnTHk4Z1NGUlVVQ0JpWVhOcFl5QmhkWFJvWlc1MGFXTmhkR2x2Ymx4dUlDQWdJR2xtSUNoamIyNW1hV2N1WVhWMGFDa2dlMXh1SUNBZ0lDQWdkbUZ5SUhWelpYSnVZVzFsSUQwZ1kyOXVabWxuTG1GMWRHZ3VkWE5sY201aGJXVWdmSHdnSnljN1hHNGdJQ0FnSUNCMllYSWdjR0Z6YzNkdmNtUWdQU0JqYjI1bWFXY3VZWFYwYUM1d1lYTnpkMjl5WkNCOGZDQW5KenRjYmlBZ0lDQWdJSEpsY1hWbGMzUklaV0ZrWlhKekxrRjFkR2h2Y21sNllYUnBiMjRnUFNBblFtRnphV01nSnlBcklHSjBiMkVvZFhObGNtNWhiV1VnS3lBbk9pY2dLeUJ3WVhOemQyOXlaQ2s3WEc0Z0lDQWdmVnh1WEc0Z0lDQWdjbVZ4ZFdWemRDNXZjR1Z1S0dOdmJtWnBaeTV0WlhSb2IyUXVkRzlWY0hCbGNrTmhjMlVvS1N3Z1luVnBiR1JWVWt3b1kyOXVabWxuTG5WeWJDd2dZMjl1Wm1sbkxuQmhjbUZ0Y3l3Z1kyOXVabWxuTG5CaGNtRnRjMU5sY21saGJHbDZaWElwTENCMGNuVmxLVHRjYmx4dUlDQWdJQzh2SUZObGRDQjBhR1VnY21WeGRXVnpkQ0IwYVcxbGIzVjBJR2x1SUUxVFhHNGdJQ0FnY21WeGRXVnpkQzUwYVcxbGIzVjBJRDBnWTI5dVptbG5MblJwYldWdmRYUTdYRzVjYmlBZ0lDQXZMeUJNYVhOMFpXNGdabTl5SUhKbFlXUjVJSE4wWVhSbFhHNGdJQ0FnY21WeGRXVnpkRnRzYjJGa1JYWmxiblJkSUQwZ1puVnVZM1JwYjI0Z2FHRnVaR3hsVEc5aFpDZ3BJSHRjYmlBZ0lDQWdJR2xtSUNnaGNtVnhkV1Z6ZENCOGZDQW9jbVZ4ZFdWemRDNXlaV0ZrZVZOMFlYUmxJQ0U5UFNBMElDWW1JQ0Y0Ukc5dFlXbHVLU2tnZTF4dUlDQWdJQ0FnSUNCeVpYUjFjbTQ3WEc0Z0lDQWdJQ0I5WEc1Y2JpQWdJQ0FnSUM4dklGUm9aU0J5WlhGMVpYTjBJR1Z5Y205eVpXUWdiM1YwSUdGdVpDQjNaU0JrYVdSdUozUWdaMlYwSUdFZ2NtVnpjRzl1YzJVc0lIUm9hWE1nZDJsc2JDQmlaVnh1SUNBZ0lDQWdMeThnYUdGdVpHeGxaQ0JpZVNCdmJtVnljbTl5SUdsdWMzUmxZV1JjYmlBZ0lDQWdJQzh2SUZkcGRHZ2diMjVsSUdWNFkyVndkR2x2YmpvZ2NtVnhkV1Z6ZENCMGFHRjBJSFZ6YVc1bklHWnBiR1U2SUhCeWIzUnZZMjlzTENCdGIzTjBJR0p5YjNkelpYSnpYRzRnSUNBZ0lDQXZMeUIzYVd4c0lISmxkSFZ5YmlCemRHRjBkWE1nWVhNZ01DQmxkbVZ1SUhSb2IzVm5hQ0JwZENkeklHRWdjM1ZqWTJWemMyWjFiQ0J5WlhGMVpYTjBYRzRnSUNBZ0lDQnBaaUFvY21WeGRXVnpkQzV6ZEdGMGRYTWdQVDA5SURBZ0ppWWdJU2h5WlhGMVpYTjBMbkpsYzNCdmJuTmxWVkpNSUNZbUlISmxjWFZsYzNRdWNtVnpjRzl1YzJWVlVrd3VhVzVrWlhoUFppZ25abWxzWlRvbktTQTlQVDBnTUNrcElIdGNiaUFnSUNBZ0lDQWdjbVYwZFhKdU8xeHVJQ0FnSUNBZ2ZWeHVYRzRnSUNBZ0lDQXZMeUJRY21Wd1lYSmxJSFJvWlNCeVpYTndiMjV6WlZ4dUlDQWdJQ0FnZG1GeUlISmxjM0J2Ym5ObFNHVmhaR1Z5Y3lBOUlDZG5aWFJCYkd4U1pYTndiMjV6WlVobFlXUmxjbk1uSUdsdUlISmxjWFZsYzNRZ1B5QndZWEp6WlVobFlXUmxjbk1vY21WeGRXVnpkQzVuWlhSQmJHeFNaWE53YjI1elpVaGxZV1JsY25Nb0tTa2dPaUJ1ZFd4c08xeHVJQ0FnSUNBZ2RtRnlJSEpsYzNCdmJuTmxSR0YwWVNBOUlDRmpiMjVtYVdjdWNtVnpjRzl1YzJWVWVYQmxJSHg4SUdOdmJtWnBaeTV5WlhOd2IyNXpaVlI1Y0dVZ1BUMDlJQ2QwWlhoMEp5QS9JSEpsY1hWbGMzUXVjbVZ6Y0c5dWMyVlVaWGgwSURvZ2NtVnhkV1Z6ZEM1eVpYTndiMjV6WlR0Y2JpQWdJQ0FnSUhaaGNpQnlaWE53YjI1elpTQTlJSHRjYmlBZ0lDQWdJQ0FnWkdGMFlUb2djbVZ6Y0c5dWMyVkVZWFJoTEZ4dUlDQWdJQ0FnSUNBdkx5QkpSU0J6Wlc1a2N5QXhNakl6SUdsdWMzUmxZV1FnYjJZZ01qQTBJQ2hvZEhSd2N6b3ZMMmRwZEdoMVlpNWpiMjB2YlhwaFluSnBjMnRwWlM5aGVHbHZjeTlwYzNOMVpYTXZNakF4S1Z4dUlDQWdJQ0FnSUNCemRHRjBkWE02SUhKbGNYVmxjM1F1YzNSaGRIVnpJRDA5UFNBeE1qSXpJRDhnTWpBMElEb2djbVZ4ZFdWemRDNXpkR0YwZFhNc1hHNGdJQ0FnSUNBZ0lITjBZWFIxYzFSbGVIUTZJSEpsY1hWbGMzUXVjM1JoZEhWeklEMDlQU0F4TWpJeklEOGdKMDV2SUVOdmJuUmxiblFuSURvZ2NtVnhkV1Z6ZEM1emRHRjBkWE5VWlhoMExGeHVJQ0FnSUNBZ0lDQm9aV0ZrWlhKek9pQnlaWE53YjI1elpVaGxZV1JsY25Nc1hHNGdJQ0FnSUNBZ0lHTnZibVpwWnpvZ1kyOXVabWxuTEZ4dUlDQWdJQ0FnSUNCeVpYRjFaWE4wT2lCeVpYRjFaWE4wWEc0Z0lDQWdJQ0I5TzF4dVhHNGdJQ0FnSUNCelpYUjBiR1VvY21WemIyeDJaU3dnY21WcVpXTjBMQ0J5WlhOd2IyNXpaU2s3WEc1Y2JpQWdJQ0FnSUM4dklFTnNaV0Z1SUhWd0lISmxjWFZsYzNSY2JpQWdJQ0FnSUhKbGNYVmxjM1FnUFNCdWRXeHNPMXh1SUNBZ0lIMDdYRzVjYmlBZ0lDQXZMeUJJWVc1a2JHVWdiRzkzSUd4bGRtVnNJRzVsZEhkdmNtc2daWEp5YjNKelhHNGdJQ0FnY21WeGRXVnpkQzV2Ym1WeWNtOXlJRDBnWm5WdVkzUnBiMjRnYUdGdVpHeGxSWEp5YjNJb0tTQjdYRzRnSUNBZ0lDQXZMeUJTWldGc0lHVnljbTl5Y3lCaGNtVWdhR2xrWkdWdUlHWnliMjBnZFhNZ1lua2dkR2hsSUdKeWIzZHpaWEpjYmlBZ0lDQWdJQzh2SUc5dVpYSnliM0lnYzJodmRXeGtJRzl1YkhrZ1ptbHlaU0JwWmlCcGRDZHpJR0VnYm1WMGQyOXlheUJsY25KdmNseHVJQ0FnSUNBZ2NtVnFaV04wS0dOeVpXRjBaVVZ5Y205eUtDZE9aWFIzYjNKcklFVnljbTl5Snl3Z1kyOXVabWxuTENCdWRXeHNMQ0J5WlhGMVpYTjBLU2s3WEc1Y2JpQWdJQ0FnSUM4dklFTnNaV0Z1SUhWd0lISmxjWFZsYzNSY2JpQWdJQ0FnSUhKbGNYVmxjM1FnUFNCdWRXeHNPMXh1SUNBZ0lIMDdYRzVjYmlBZ0lDQXZMeUJJWVc1a2JHVWdkR2x0Wlc5MWRGeHVJQ0FnSUhKbGNYVmxjM1F1YjI1MGFXMWxiM1YwSUQwZ1puVnVZM1JwYjI0Z2FHRnVaR3hsVkdsdFpXOTFkQ2dwSUh0Y2JpQWdJQ0FnSUhKbGFtVmpkQ2hqY21WaGRHVkZjbkp2Y2lnbmRHbHRaVzkxZENCdlppQW5JQ3NnWTI5dVptbG5MblJwYldWdmRYUWdLeUFuYlhNZ1pYaGpaV1ZrWldRbkxDQmpiMjVtYVdjc0lDZEZRMDlPVGtGQ1QxSlVSVVFuTEZ4dUlDQWdJQ0FnSUNCeVpYRjFaWE4wS1NrN1hHNWNiaUFnSUNBZ0lDOHZJRU5zWldGdUlIVndJSEpsY1hWbGMzUmNiaUFnSUNBZ0lISmxjWFZsYzNRZ1BTQnVkV3hzTzF4dUlDQWdJSDA3WEc1Y2JpQWdJQ0F2THlCQlpHUWdlSE55WmlCb1pXRmtaWEpjYmlBZ0lDQXZMeUJVYUdseklHbHpJRzl1YkhrZ1pHOXVaU0JwWmlCeWRXNXVhVzVuSUdsdUlHRWdjM1JoYm1SaGNtUWdZbkp2ZDNObGNpQmxiblpwY205dWJXVnVkQzVjYmlBZ0lDQXZMeUJUY0dWamFXWnBZMkZzYkhrZ2JtOTBJR2xtSUhkbEozSmxJR2x1SUdFZ2QyVmlJSGR2Y210bGNpd2diM0lnY21WaFkzUXRibUYwYVhabExseHVJQ0FnSUdsbUlDaDFkR2xzY3k1cGMxTjBZVzVrWVhKa1FuSnZkM05sY2tWdWRpZ3BLU0I3WEc0Z0lDQWdJQ0IyWVhJZ1kyOXZhMmxsY3lBOUlISmxjWFZwY21Vb0p5NHZMaTR2YUdWc2NHVnljeTlqYjI5cmFXVnpKeWs3WEc1Y2JpQWdJQ0FnSUM4dklFRmtaQ0I0YzNKbUlHaGxZV1JsY2x4dUlDQWdJQ0FnZG1GeUlIaHpjbVpXWVd4MVpTQTlJQ2hqYjI1bWFXY3VkMmwwYUVOeVpXUmxiblJwWVd4eklIeDhJR2x6VlZKTVUyRnRaVTl5YVdkcGJpaGpiMjVtYVdjdWRYSnNLU2tnSmlZZ1kyOXVabWxuTG5oemNtWkRiMjlyYVdWT1lXMWxJRDljYmlBZ0lDQWdJQ0FnSUNCamIyOXJhV1Z6TG5KbFlXUW9ZMjl1Wm1sbkxuaHpjbVpEYjI5cmFXVk9ZVzFsS1NBNlhHNGdJQ0FnSUNBZ0lDQWdkVzVrWldacGJtVmtPMXh1WEc0Z0lDQWdJQ0JwWmlBb2VITnlabFpoYkhWbEtTQjdYRzRnSUNBZ0lDQWdJSEpsY1hWbGMzUklaV0ZrWlhKelcyTnZibVpwWnk1NGMzSm1TR1ZoWkdWeVRtRnRaVjBnUFNCNGMzSm1WbUZzZFdVN1hHNGdJQ0FnSUNCOVhHNGdJQ0FnZlZ4dVhHNGdJQ0FnTHk4Z1FXUmtJR2hsWVdSbGNuTWdkRzhnZEdobElISmxjWFZsYzNSY2JpQWdJQ0JwWmlBb0ozTmxkRkpsY1hWbGMzUklaV0ZrWlhJbklHbHVJSEpsY1hWbGMzUXBJSHRjYmlBZ0lDQWdJSFYwYVd4ekxtWnZja1ZoWTJnb2NtVnhkV1Z6ZEVobFlXUmxjbk1zSUdaMWJtTjBhVzl1SUhObGRGSmxjWFZsYzNSSVpXRmtaWElvZG1Gc0xDQnJaWGtwSUh0Y2JpQWdJQ0FnSUNBZ2FXWWdLSFI1Y0dWdlppQnlaWEYxWlhOMFJHRjBZU0E5UFQwZ0ozVnVaR1ZtYVc1bFpDY2dKaVlnYTJWNUxuUnZURzkzWlhKRFlYTmxLQ2tnUFQwOUlDZGpiMjUwWlc1MExYUjVjR1VuS1NCN1hHNGdJQ0FnSUNBZ0lDQWdMeThnVW1WdGIzWmxJRU52Ym5SbGJuUXRWSGx3WlNCcFppQmtZWFJoSUdseklIVnVaR1ZtYVc1bFpGeHVJQ0FnSUNBZ0lDQWdJR1JsYkdWMFpTQnlaWEYxWlhOMFNHVmhaR1Z5YzF0clpYbGRPMXh1SUNBZ0lDQWdJQ0I5SUdWc2MyVWdlMXh1SUNBZ0lDQWdJQ0FnSUM4dklFOTBhR1Z5ZDJselpTQmhaR1FnYUdWaFpHVnlJSFJ2SUhSb1pTQnlaWEYxWlhOMFhHNGdJQ0FnSUNBZ0lDQWdjbVZ4ZFdWemRDNXpaWFJTWlhGMVpYTjBTR1ZoWkdWeUtHdGxlU3dnZG1Gc0tUdGNiaUFnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdmU2s3WEc0Z0lDQWdmVnh1WEc0Z0lDQWdMeThnUVdSa0lIZHBkR2hEY21Wa1pXNTBhV0ZzY3lCMGJ5QnlaWEYxWlhOMElHbG1JRzVsWldSbFpGeHVJQ0FnSUdsbUlDaGpiMjVtYVdjdWQybDBhRU55WldSbGJuUnBZV3h6S1NCN1hHNGdJQ0FnSUNCeVpYRjFaWE4wTG5kcGRHaERjbVZrWlc1MGFXRnNjeUE5SUhSeWRXVTdYRzRnSUNBZ2ZWeHVYRzRnSUNBZ0x5OGdRV1JrSUhKbGMzQnZibk5sVkhsd1pTQjBieUJ5WlhGMVpYTjBJR2xtSUc1bFpXUmxaRnh1SUNBZ0lHbG1JQ2hqYjI1bWFXY3VjbVZ6Y0c5dWMyVlVlWEJsS1NCN1hHNGdJQ0FnSUNCMGNua2dlMXh1SUNBZ0lDQWdJQ0J5WlhGMVpYTjBMbkpsYzNCdmJuTmxWSGx3WlNBOUlHTnZibVpwWnk1eVpYTndiMjV6WlZSNWNHVTdYRzRnSUNBZ0lDQjlJR05oZEdOb0lDaGxLU0I3WEc0Z0lDQWdJQ0FnSUM4dklFVjRjR1ZqZEdWa0lFUlBUVVY0WTJWd2RHbHZiaUIwYUhKdmQyNGdZbmtnWW5KdmQzTmxjbk1nYm05MElHTnZiWEJoZEdsaWJHVWdXRTFNU0hSMGNGSmxjWFZsYzNRZ1RHVjJaV3dnTWk1Y2JpQWdJQ0FnSUNBZ0x5OGdRblYwTENCMGFHbHpJR05oYmlCaVpTQnpkWEJ3Y21WemMyVmtJR1p2Y2lBbmFuTnZiaWNnZEhsd1pTQmhjeUJwZENCallXNGdZbVVnY0dGeWMyVmtJR0o1SUdSbFptRjFiSFFnSjNSeVlXNXpabTl5YlZKbGMzQnZibk5sSnlCbWRXNWpkR2x2Ymk1Y2JpQWdJQ0FnSUNBZ2FXWWdLR052Ym1acFp5NXlaWE53YjI1elpWUjVjR1VnSVQwOUlDZHFjMjl1SnlrZ2UxeHVJQ0FnSUNBZ0lDQWdJSFJvY205M0lHVTdYRzRnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJSDFjYmlBZ0lDQjlYRzVjYmlBZ0lDQXZMeUJJWVc1a2JHVWdjSEp2WjNKbGMzTWdhV1lnYm1WbFpHVmtYRzRnSUNBZ2FXWWdLSFI1Y0dWdlppQmpiMjVtYVdjdWIyNUViM2R1Ykc5aFpGQnliMmR5WlhOeklEMDlQU0FuWm5WdVkzUnBiMjRuS1NCN1hHNGdJQ0FnSUNCeVpYRjFaWE4wTG1Ga1pFVjJaVzUwVEdsemRHVnVaWElvSjNCeWIyZHlaWE56Snl3Z1kyOXVabWxuTG05dVJHOTNibXh2WVdSUWNtOW5jbVZ6Y3lrN1hHNGdJQ0FnZlZ4dVhHNGdJQ0FnTHk4Z1RtOTBJR0ZzYkNCaWNtOTNjMlZ5Y3lCemRYQndiM0owSUhWd2JHOWhaQ0JsZG1WdWRITmNiaUFnSUNCcFppQW9kSGx3Wlc5bUlHTnZibVpwWnk1dmJsVndiRzloWkZCeWIyZHlaWE56SUQwOVBTQW5ablZ1WTNScGIyNG5JQ1ltSUhKbGNYVmxjM1F1ZFhCc2IyRmtLU0I3WEc0Z0lDQWdJQ0J5WlhGMVpYTjBMblZ3Ykc5aFpDNWhaR1JGZG1WdWRFeHBjM1JsYm1WeUtDZHdjbTluY21WemN5Y3NJR052Ym1acFp5NXZibFZ3Ykc5aFpGQnliMmR5WlhOektUdGNiaUFnSUNCOVhHNWNiaUFnSUNCcFppQW9ZMjl1Wm1sbkxtTmhibU5sYkZSdmEyVnVLU0I3WEc0Z0lDQWdJQ0F2THlCSVlXNWtiR1VnWTJGdVkyVnNiR0YwYVc5dVhHNGdJQ0FnSUNCamIyNW1hV2N1WTJGdVkyVnNWRzlyWlc0dWNISnZiV2x6WlM1MGFHVnVLR1oxYm1OMGFXOXVJRzl1UTJGdVkyVnNaV1FvWTJGdVkyVnNLU0I3WEc0Z0lDQWdJQ0FnSUdsbUlDZ2hjbVZ4ZFdWemRDa2dlMXh1SUNBZ0lDQWdJQ0FnSUhKbGRIVnlianRjYmlBZ0lDQWdJQ0FnZlZ4dVhHNGdJQ0FnSUNBZ0lISmxjWFZsYzNRdVlXSnZjblFvS1R0Y2JpQWdJQ0FnSUNBZ2NtVnFaV04wS0dOaGJtTmxiQ2s3WEc0Z0lDQWdJQ0FnSUM4dklFTnNaV0Z1SUhWd0lISmxjWFZsYzNSY2JpQWdJQ0FnSUNBZ2NtVnhkV1Z6ZENBOUlHNTFiR3c3WEc0Z0lDQWdJQ0I5S1R0Y2JpQWdJQ0I5WEc1Y2JpQWdJQ0JwWmlBb2NtVnhkV1Z6ZEVSaGRHRWdQVDA5SUhWdVpHVm1hVzVsWkNrZ2UxeHVJQ0FnSUNBZ2NtVnhkV1Z6ZEVSaGRHRWdQU0J1ZFd4c08xeHVJQ0FnSUgxY2JseHVJQ0FnSUM4dklGTmxibVFnZEdobElISmxjWFZsYzNSY2JpQWdJQ0J5WlhGMVpYTjBMbk5sYm1Rb2NtVnhkV1Z6ZEVSaGRHRXBPMXh1SUNCOUtUdGNibjA3WEc0aUxDSW5kWE5sSUhOMGNtbGpkQ2M3WEc1Y2JuWmhjaUIxZEdsc2N5QTlJSEpsY1hWcGNtVW9KeTR2ZFhScGJITW5LVHRjYm5aaGNpQmlhVzVrSUQwZ2NtVnhkV2x5WlNnbkxpOW9aV3h3WlhKekwySnBibVFuS1R0Y2JuWmhjaUJCZUdsdmN5QTlJSEpsY1hWcGNtVW9KeTR2WTI5eVpTOUJlR2x2Y3ljcE8xeHVkbUZ5SUdSbFptRjFiSFJ6SUQwZ2NtVnhkV2x5WlNnbkxpOWtaV1poZFd4MGN5Y3BPMXh1WEc0dktpcGNiaUFxSUVOeVpXRjBaU0JoYmlCcGJuTjBZVzVqWlNCdlppQkJlR2x2YzF4dUlDcGNiaUFxSUVCd1lYSmhiU0I3VDJKcVpXTjBmU0JrWldaaGRXeDBRMjl1Wm1sbklGUm9aU0JrWldaaGRXeDBJR052Ym1acFp5Qm1iM0lnZEdobElHbHVjM1JoYm1ObFhHNGdLaUJBY21WMGRYSnVJSHRCZUdsdmMzMGdRU0J1WlhjZ2FXNXpkR0Z1WTJVZ2IyWWdRWGhwYjNOY2JpQXFMMXh1Wm5WdVkzUnBiMjRnWTNKbFlYUmxTVzV6ZEdGdVkyVW9aR1ZtWVhWc2RFTnZibVpwWnlrZ2UxeHVJQ0IyWVhJZ1kyOXVkR1Y0ZENBOUlHNWxkeUJCZUdsdmN5aGtaV1poZFd4MFEyOXVabWxuS1R0Y2JpQWdkbUZ5SUdsdWMzUmhibU5sSUQwZ1ltbHVaQ2hCZUdsdmN5NXdjbTkwYjNSNWNHVXVjbVZ4ZFdWemRDd2dZMjl1ZEdWNGRDazdYRzVjYmlBZ0x5OGdRMjl3ZVNCaGVHbHZjeTV3Y205MGIzUjVjR1VnZEc4Z2FXNXpkR0Z1WTJWY2JpQWdkWFJwYkhNdVpYaDBaVzVrS0dsdWMzUmhibU5sTENCQmVHbHZjeTV3Y205MGIzUjVjR1VzSUdOdmJuUmxlSFFwTzF4dVhHNGdJQzh2SUVOdmNIa2dZMjl1ZEdWNGRDQjBieUJwYm5OMFlXNWpaVnh1SUNCMWRHbHNjeTVsZUhSbGJtUW9hVzV6ZEdGdVkyVXNJR052Ym5SbGVIUXBPMXh1WEc0Z0lISmxkSFZ5YmlCcGJuTjBZVzVqWlR0Y2JuMWNibHh1THk4Z1EzSmxZWFJsSUhSb1pTQmtaV1poZFd4MElHbHVjM1JoYm1ObElIUnZJR0psSUdWNGNHOXlkR1ZrWEc1MllYSWdZWGhwYjNNZ1BTQmpjbVZoZEdWSmJuTjBZVzVqWlNoa1pXWmhkV3gwY3lrN1hHNWNiaTh2SUVWNGNHOXpaU0JCZUdsdmN5QmpiR0Z6Y3lCMGJ5QmhiR3h2ZHlCamJHRnpjeUJwYm1obGNtbDBZVzVqWlZ4dVlYaHBiM011UVhocGIzTWdQU0JCZUdsdmN6dGNibHh1THk4Z1JtRmpkRzl5ZVNCbWIzSWdZM0psWVhScGJtY2dibVYzSUdsdWMzUmhibU5sYzF4dVlYaHBiM011WTNKbFlYUmxJRDBnWm5WdVkzUnBiMjRnWTNKbFlYUmxLR2x1YzNSaGJtTmxRMjl1Wm1sbktTQjdYRzRnSUhKbGRIVnliaUJqY21WaGRHVkpibk4wWVc1alpTaDFkR2xzY3k1dFpYSm5aU2hrWldaaGRXeDBjeXdnYVc1emRHRnVZMlZEYjI1bWFXY3BLVHRjYm4wN1hHNWNiaTh2SUVWNGNHOXpaU0JEWVc1alpXd2dKaUJEWVc1alpXeFViMnRsYmx4dVlYaHBiM011UTJGdVkyVnNJRDBnY21WeGRXbHlaU2duTGk5allXNWpaV3d2UTJGdVkyVnNKeWs3WEc1aGVHbHZjeTVEWVc1alpXeFViMnRsYmlBOUlISmxjWFZwY21Vb0p5NHZZMkZ1WTJWc0wwTmhibU5sYkZSdmEyVnVKeWs3WEc1aGVHbHZjeTVwYzBOaGJtTmxiQ0E5SUhKbGNYVnBjbVVvSnk0dlkyRnVZMlZzTDJselEyRnVZMlZzSnlrN1hHNWNiaTh2SUVWNGNHOXpaU0JoYkd3dmMzQnlaV0ZrWEc1aGVHbHZjeTVoYkd3Z1BTQm1kVzVqZEdsdmJpQmhiR3dvY0hKdmJXbHpaWE1wSUh0Y2JpQWdjbVYwZFhKdUlGQnliMjFwYzJVdVlXeHNLSEJ5YjIxcGMyVnpLVHRjYm4wN1hHNWhlR2x2Y3k1emNISmxZV1FnUFNCeVpYRjFhWEpsS0NjdUwyaGxiSEJsY25NdmMzQnlaV0ZrSnlrN1hHNWNibTF2WkhWc1pTNWxlSEJ2Y25SeklEMGdZWGhwYjNNN1hHNWNiaTh2SUVGc2JHOTNJSFZ6WlNCdlppQmtaV1poZFd4MElHbHRjRzl5ZENCemVXNTBZWGdnYVc0Z1ZIbHdaVk5qY21sd2RGeHViVzlrZFd4bExtVjRjRzl5ZEhNdVpHVm1ZWFZzZENBOUlHRjRhVzl6TzF4dUlpd2lKM1Z6WlNCemRISnBZM1FuTzF4dVhHNHZLaXBjYmlBcUlFRWdZRU5oYm1ObGJHQWdhWE1nWVc0Z2IySnFaV04wSUhSb1lYUWdhWE1nZEdoeWIzZHVJSGRvWlc0Z1lXNGdiM0JsY21GMGFXOXVJR2x6SUdOaGJtTmxiR1ZrTGx4dUlDcGNiaUFxSUVCamJHRnpjMXh1SUNvZ1FIQmhjbUZ0SUh0emRISnBibWM5ZlNCdFpYTnpZV2RsSUZSb1pTQnRaWE56WVdkbExseHVJQ292WEc1bWRXNWpkR2x2YmlCRFlXNWpaV3dvYldWemMyRm5aU2tnZTF4dUlDQjBhR2x6TG0xbGMzTmhaMlVnUFNCdFpYTnpZV2RsTzF4dWZWeHVYRzVEWVc1alpXd3VjSEp2ZEc5MGVYQmxMblJ2VTNSeWFXNW5JRDBnWm5WdVkzUnBiMjRnZEc5VGRISnBibWNvS1NCN1hHNGdJSEpsZEhWeWJpQW5RMkZ1WTJWc0p5QXJJQ2gwYUdsekxtMWxjM05oWjJVZ1B5QW5PaUFuSUNzZ2RHaHBjeTV0WlhOellXZGxJRG9nSnljcE8xeHVmVHRjYmx4dVEyRnVZMlZzTG5CeWIzUnZkSGx3WlM1ZlgwTkJUa05GVEY5ZklEMGdkSEoxWlR0Y2JseHViVzlrZFd4bExtVjRjRzl5ZEhNZ1BTQkRZVzVqWld3N1hHNGlMQ0luZFhObElITjBjbWxqZENjN1hHNWNiblpoY2lCRFlXNWpaV3dnUFNCeVpYRjFhWEpsS0NjdUwwTmhibU5sYkNjcE8xeHVYRzR2S2lwY2JpQXFJRUVnWUVOaGJtTmxiRlJ2YTJWdVlDQnBjeUJoYmlCdlltcGxZM1FnZEdoaGRDQmpZVzRnWW1VZ2RYTmxaQ0IwYnlCeVpYRjFaWE4wSUdOaGJtTmxiR3hoZEdsdmJpQnZaaUJoYmlCdmNHVnlZWFJwYjI0dVhHNGdLbHh1SUNvZ1FHTnNZWE56WEc0Z0tpQkFjR0Z5WVcwZ2UwWjFibU4wYVc5dWZTQmxlR1ZqZFhSdmNpQlVhR1VnWlhobFkzVjBiM0lnWm5WdVkzUnBiMjR1WEc0Z0tpOWNibVoxYm1OMGFXOXVJRU5oYm1ObGJGUnZhMlZ1S0dWNFpXTjFkRzl5S1NCN1hHNGdJR2xtSUNoMGVYQmxiMllnWlhobFkzVjBiM0lnSVQwOUlDZG1kVzVqZEdsdmJpY3BJSHRjYmlBZ0lDQjBhSEp2ZHlCdVpYY2dWSGx3WlVWeWNtOXlLQ2RsZUdWamRYUnZjaUJ0ZFhOMElHSmxJR0VnWm5WdVkzUnBiMjR1SnlrN1hHNGdJSDFjYmx4dUlDQjJZWElnY21WemIyeDJaVkJ5YjIxcGMyVTdYRzRnSUhSb2FYTXVjSEp2YldselpTQTlJRzVsZHlCUWNtOXRhWE5sS0daMWJtTjBhVzl1SUhCeWIyMXBjMlZGZUdWamRYUnZjaWh5WlhOdmJIWmxLU0I3WEc0Z0lDQWdjbVZ6YjJ4MlpWQnliMjFwYzJVZ1BTQnlaWE52YkhabE8xeHVJQ0I5S1R0Y2JseHVJQ0IyWVhJZ2RHOXJaVzRnUFNCMGFHbHpPMXh1SUNCbGVHVmpkWFJ2Y2lobWRXNWpkR2x2YmlCallXNWpaV3dvYldWemMyRm5aU2tnZTF4dUlDQWdJR2xtSUNoMGIydGxiaTV5WldGemIyNHBJSHRjYmlBZ0lDQWdJQzh2SUVOaGJtTmxiR3hoZEdsdmJpQm9ZWE1nWVd4eVpXRmtlU0JpWldWdUlISmxjWFZsYzNSbFpGeHVJQ0FnSUNBZ2NtVjBkWEp1TzF4dUlDQWdJSDFjYmx4dUlDQWdJSFJ2YTJWdUxuSmxZWE52YmlBOUlHNWxkeUJEWVc1alpXd29iV1Z6YzJGblpTazdYRzRnSUNBZ2NtVnpiMngyWlZCeWIyMXBjMlVvZEc5clpXNHVjbVZoYzI5dUtUdGNiaUFnZlNrN1hHNTlYRzVjYmk4cUtseHVJQ29nVkdoeWIzZHpJR0VnWUVOaGJtTmxiR0FnYVdZZ1kyRnVZMlZzYkdGMGFXOXVJR2hoY3lCaVpXVnVJSEpsY1hWbGMzUmxaQzVjYmlBcUwxeHVRMkZ1WTJWc1ZHOXJaVzR1Y0hKdmRHOTBlWEJsTG5Sb2NtOTNTV1pTWlhGMVpYTjBaV1FnUFNCbWRXNWpkR2x2YmlCMGFISnZkMGxtVW1WeGRXVnpkR1ZrS0NrZ2UxeHVJQ0JwWmlBb2RHaHBjeTV5WldGemIyNHBJSHRjYmlBZ0lDQjBhSEp2ZHlCMGFHbHpMbkpsWVhOdmJqdGNiaUFnZlZ4dWZUdGNibHh1THlvcVhHNGdLaUJTWlhSMWNtNXpJR0Z1SUc5aWFtVmpkQ0IwYUdGMElHTnZiblJoYVc1eklHRWdibVYzSUdCRFlXNWpaV3hVYjJ0bGJtQWdZVzVrSUdFZ1puVnVZM1JwYjI0Z2RHaGhkQ3dnZDJobGJpQmpZV3hzWldRc1hHNGdLaUJqWVc1alpXeHpJSFJvWlNCZ1EyRnVZMlZzVkc5clpXNWdMbHh1SUNvdlhHNURZVzVqWld4VWIydGxiaTV6YjNWeVkyVWdQU0JtZFc1amRHbHZiaUJ6YjNWeVkyVW9LU0I3WEc0Z0lIWmhjaUJqWVc1alpXdzdYRzRnSUhaaGNpQjBiMnRsYmlBOUlHNWxkeUJEWVc1alpXeFViMnRsYmlobWRXNWpkR2x2YmlCbGVHVmpkWFJ2Y2loaktTQjdYRzRnSUNBZ1kyRnVZMlZzSUQwZ1l6dGNiaUFnZlNrN1hHNGdJSEpsZEhWeWJpQjdYRzRnSUNBZ2RHOXJaVzQ2SUhSdmEyVnVMRnh1SUNBZ0lHTmhibU5sYkRvZ1kyRnVZMlZzWEc0Z0lIMDdYRzU5TzF4dVhHNXRiMlIxYkdVdVpYaHdiM0owY3lBOUlFTmhibU5sYkZSdmEyVnVPMXh1SWl3aUozVnpaU0J6ZEhKcFkzUW5PMXh1WEc1dGIyUjFiR1V1Wlhod2IzSjBjeUE5SUdaMWJtTjBhVzl1SUdselEyRnVZMlZzS0haaGJIVmxLU0I3WEc0Z0lISmxkSFZ5YmlBaElTaDJZV3gxWlNBbUppQjJZV3gxWlM1ZlgwTkJUa05GVEY5ZktUdGNibjA3WEc0aUxDSW5kWE5sSUhOMGNtbGpkQ2M3WEc1Y2JuWmhjaUJrWldaaGRXeDBjeUE5SUhKbGNYVnBjbVVvSnk0dkxpNHZaR1ZtWVhWc2RITW5LVHRjYm5aaGNpQjFkR2xzY3lBOUlISmxjWFZwY21Vb0p5NHZMaTR2ZFhScGJITW5LVHRjYm5aaGNpQkpiblJsY21ObGNIUnZjazFoYm1GblpYSWdQU0J5WlhGMWFYSmxLQ2N1TDBsdWRHVnlZMlZ3ZEc5eVRXRnVZV2RsY2ljcE8xeHVkbUZ5SUdScGMzQmhkR05vVW1WeGRXVnpkQ0E5SUhKbGNYVnBjbVVvSnk0dlpHbHpjR0YwWTJoU1pYRjFaWE4wSnlrN1hHNTJZWElnYVhOQlluTnZiSFYwWlZWU1RDQTlJSEpsY1hWcGNtVW9KeTR2TGk0dmFHVnNjR1Z5Y3k5cGMwRmljMjlzZFhSbFZWSk1KeWs3WEc1MllYSWdZMjl0WW1sdVpWVlNUSE1nUFNCeVpYRjFhWEpsS0NjdUx5NHVMMmhsYkhCbGNuTXZZMjl0WW1sdVpWVlNUSE1uS1R0Y2JseHVMeW9xWEc0Z0tpQkRjbVZoZEdVZ1lTQnVaWGNnYVc1emRHRnVZMlVnYjJZZ1FYaHBiM05jYmlBcVhHNGdLaUJBY0dGeVlXMGdlMDlpYW1WamRIMGdhVzV6ZEdGdVkyVkRiMjVtYVdjZ1ZHaGxJR1JsWm1GMWJIUWdZMjl1Wm1sbklHWnZjaUIwYUdVZ2FXNXpkR0Z1WTJWY2JpQXFMMXh1Wm5WdVkzUnBiMjRnUVhocGIzTW9hVzV6ZEdGdVkyVkRiMjVtYVdjcElIdGNiaUFnZEdocGN5NWtaV1poZFd4MGN5QTlJR2x1YzNSaGJtTmxRMjl1Wm1sbk8xeHVJQ0IwYUdsekxtbHVkR1Z5WTJWd2RHOXljeUE5SUh0Y2JpQWdJQ0J5WlhGMVpYTjBPaUJ1WlhjZ1NXNTBaWEpqWlhCMGIzSk5ZVzVoWjJWeUtDa3NYRzRnSUNBZ2NtVnpjRzl1YzJVNklHNWxkeUJKYm5SbGNtTmxjSFJ2Y2sxaGJtRm5aWElvS1Z4dUlDQjlPMXh1ZlZ4dVhHNHZLaXBjYmlBcUlFUnBjM0JoZEdOb0lHRWdjbVZ4ZFdWemRGeHVJQ3BjYmlBcUlFQndZWEpoYlNCN1QySnFaV04wZlNCamIyNW1hV2NnVkdobElHTnZibVpwWnlCemNHVmphV1pwWXlCbWIzSWdkR2hwY3lCeVpYRjFaWE4wSUNodFpYSm5aV1FnZDJsMGFDQjBhR2x6TG1SbFptRjFiSFJ6S1Z4dUlDb3ZYRzVCZUdsdmN5NXdjbTkwYjNSNWNHVXVjbVZ4ZFdWemRDQTlJR1oxYm1OMGFXOXVJSEpsY1hWbGMzUW9ZMjl1Wm1sbktTQjdYRzRnSUM4cVpYTnNhVzUwSUc1dkxYQmhjbUZ0TFhKbFlYTnphV2R1T2pBcUwxeHVJQ0F2THlCQmJHeHZkeUJtYjNJZ1lYaHBiM01vSjJWNFlXMXdiR1V2ZFhKc0oxc3NJR052Ym1acFoxMHBJR0VnYkdFZ1ptVjBZMmdnUVZCSlhHNGdJR2xtSUNoMGVYQmxiMllnWTI5dVptbG5JRDA5UFNBbmMzUnlhVzVuSnlrZ2UxeHVJQ0FnSUdOdmJtWnBaeUE5SUhWMGFXeHpMbTFsY21kbEtIdGNiaUFnSUNBZ0lIVnliRG9nWVhKbmRXMWxiblJ6V3pCZFhHNGdJQ0FnZlN3Z1lYSm5kVzFsYm5Seld6RmRLVHRjYmlBZ2ZWeHVYRzRnSUdOdmJtWnBaeUE5SUhWMGFXeHpMbTFsY21kbEtHUmxabUYxYkhSekxDQjBhR2x6TG1SbFptRjFiSFJ6TENCN0lHMWxkR2h2WkRvZ0oyZGxkQ2NnZlN3Z1kyOXVabWxuS1R0Y2JpQWdZMjl1Wm1sbkxtMWxkR2h2WkNBOUlHTnZibVpwWnk1dFpYUm9iMlF1ZEc5TWIzZGxja05oYzJVb0tUdGNibHh1SUNBdkx5QlRkWEJ3YjNKMElHSmhjMlZWVWt3Z1kyOXVabWxuWEc0Z0lHbG1JQ2hqYjI1bWFXY3VZbUZ6WlZWU1RDQW1KaUFoYVhOQlluTnZiSFYwWlZWU1RDaGpiMjVtYVdjdWRYSnNLU2tnZTF4dUlDQWdJR052Ym1acFp5NTFjbXdnUFNCamIyMWlhVzVsVlZKTWN5aGpiMjVtYVdjdVltRnpaVlZTVEN3Z1kyOXVabWxuTG5WeWJDazdYRzRnSUgxY2JseHVJQ0F2THlCSWIyOXJJSFZ3SUdsdWRHVnlZMlZ3ZEc5eWN5QnRhV1JrYkdWM1lYSmxYRzRnSUhaaGNpQmphR0ZwYmlBOUlGdGthWE53WVhSamFGSmxjWFZsYzNRc0lIVnVaR1ZtYVc1bFpGMDdYRzRnSUhaaGNpQndjbTl0YVhObElEMGdVSEp2YldselpTNXlaWE52YkhabEtHTnZibVpwWnlrN1hHNWNiaUFnZEdocGN5NXBiblJsY21ObGNIUnZjbk11Y21WeGRXVnpkQzVtYjNKRllXTm9LR1oxYm1OMGFXOXVJSFZ1YzJocFpuUlNaWEYxWlhOMFNXNTBaWEpqWlhCMGIzSnpLR2x1ZEdWeVkyVndkRzl5S1NCN1hHNGdJQ0FnWTJoaGFXNHVkVzV6YUdsbWRDaHBiblJsY21ObGNIUnZjaTVtZFd4bWFXeHNaV1FzSUdsdWRHVnlZMlZ3ZEc5eUxuSmxhbVZqZEdWa0tUdGNiaUFnZlNrN1hHNWNiaUFnZEdocGN5NXBiblJsY21ObGNIUnZjbk11Y21WemNHOXVjMlV1Wm05eVJXRmphQ2htZFc1amRHbHZiaUJ3ZFhOb1VtVnpjRzl1YzJWSmJuUmxjbU5sY0hSdmNuTW9hVzUwWlhKalpYQjBiM0lwSUh0Y2JpQWdJQ0JqYUdGcGJpNXdkWE5vS0dsdWRHVnlZMlZ3ZEc5eUxtWjFiR1pwYkd4bFpDd2dhVzUwWlhKalpYQjBiM0l1Y21WcVpXTjBaV1FwTzF4dUlDQjlLVHRjYmx4dUlDQjNhR2xzWlNBb1kyaGhhVzR1YkdWdVozUm9LU0I3WEc0Z0lDQWdjSEp2YldselpTQTlJSEJ5YjIxcGMyVXVkR2hsYmloamFHRnBiaTV6YUdsbWRDZ3BMQ0JqYUdGcGJpNXphR2xtZENncEtUdGNiaUFnZlZ4dVhHNGdJSEpsZEhWeWJpQndjbTl0YVhObE8xeHVmVHRjYmx4dUx5OGdVSEp2ZG1sa1pTQmhiR2xoYzJWeklHWnZjaUJ6ZFhCd2IzSjBaV1FnY21WeGRXVnpkQ0J0WlhSb2IyUnpYRzUxZEdsc2N5NW1iM0pGWVdOb0tGc25aR1ZzWlhSbEp5d2dKMmRsZENjc0lDZG9aV0ZrSnl3Z0oyOXdkR2x2Ym5NblhTd2dablZ1WTNScGIyNGdabTl5UldGamFFMWxkR2h2WkU1dlJHRjBZU2h0WlhSb2IyUXBJSHRjYmlBZ0x5cGxjMnhwYm5RZ1puVnVZeTF1WVcxbGN6b3dLaTljYmlBZ1FYaHBiM011Y0hKdmRHOTBlWEJsVzIxbGRHaHZaRjBnUFNCbWRXNWpkR2x2YmloMWNtd3NJR052Ym1acFp5a2dlMXh1SUNBZ0lISmxkSFZ5YmlCMGFHbHpMbkpsY1hWbGMzUW9kWFJwYkhNdWJXVnlaMlVvWTI5dVptbG5JSHg4SUh0OUxDQjdYRzRnSUNBZ0lDQnRaWFJvYjJRNklHMWxkR2h2WkN4Y2JpQWdJQ0FnSUhWeWJEb2dkWEpzWEc0Z0lDQWdmU2twTzF4dUlDQjlPMXh1ZlNrN1hHNWNiblYwYVd4ekxtWnZja1ZoWTJnb1d5ZHdiM04wSnl3Z0ozQjFkQ2NzSUNkd1lYUmphQ2RkTENCbWRXNWpkR2x2YmlCbWIzSkZZV05vVFdWMGFHOWtWMmwwYUVSaGRHRW9iV1YwYUc5a0tTQjdYRzRnSUM4cVpYTnNhVzUwSUdaMWJtTXRibUZ0WlhNNk1Db3ZYRzRnSUVGNGFXOXpMbkJ5YjNSdmRIbHdaVnR0WlhSb2IyUmRJRDBnWm5WdVkzUnBiMjRvZFhKc0xDQmtZWFJoTENCamIyNW1hV2NwSUh0Y2JpQWdJQ0J5WlhSMWNtNGdkR2hwY3k1eVpYRjFaWE4wS0hWMGFXeHpMbTFsY21kbEtHTnZibVpwWnlCOGZDQjdmU3dnZTF4dUlDQWdJQ0FnYldWMGFHOWtPaUJ0WlhSb2IyUXNYRzRnSUNBZ0lDQjFjbXc2SUhWeWJDeGNiaUFnSUNBZ0lHUmhkR0U2SUdSaGRHRmNiaUFnSUNCOUtTazdYRzRnSUgwN1hHNTlLVHRjYmx4dWJXOWtkV3hsTG1WNGNHOXlkSE1nUFNCQmVHbHZjenRjYmlJc0lpZDFjMlVnYzNSeWFXTjBKenRjYmx4dWRtRnlJSFYwYVd4eklEMGdjbVZ4ZFdseVpTZ25MaTh1TGk5MWRHbHNjeWNwTzF4dVhHNW1kVzVqZEdsdmJpQkpiblJsY21ObGNIUnZjazFoYm1GblpYSW9LU0I3WEc0Z0lIUm9hWE11YUdGdVpHeGxjbk1nUFNCYlhUdGNibjFjYmx4dUx5b3FYRzRnS2lCQlpHUWdZU0J1WlhjZ2FXNTBaWEpqWlhCMGIzSWdkRzhnZEdobElITjBZV05yWEc0Z0tseHVJQ29nUUhCaGNtRnRJSHRHZFc1amRHbHZibjBnWm5Wc1ptbHNiR1ZrSUZSb1pTQm1kVzVqZEdsdmJpQjBieUJvWVc1a2JHVWdZSFJvWlc1Z0lHWnZjaUJoSUdCUWNtOXRhWE5sWUZ4dUlDb2dRSEJoY21GdElIdEdkVzVqZEdsdmJuMGdjbVZxWldOMFpXUWdWR2hsSUdaMWJtTjBhVzl1SUhSdklHaGhibVJzWlNCZ2NtVnFaV04wWUNCbWIzSWdZU0JnVUhKdmJXbHpaV0JjYmlBcVhHNGdLaUJBY21WMGRYSnVJSHRPZFcxaVpYSjlJRUZ1SUVsRUlIVnpaV1FnZEc4Z2NtVnRiM1psSUdsdWRHVnlZMlZ3ZEc5eUlHeGhkR1Z5WEc0Z0tpOWNia2x1ZEdWeVkyVndkRzl5VFdGdVlXZGxjaTV3Y205MGIzUjVjR1V1ZFhObElEMGdablZ1WTNScGIyNGdkWE5sS0daMWJHWnBiR3hsWkN3Z2NtVnFaV04wWldRcElIdGNiaUFnZEdocGN5NW9ZVzVrYkdWeWN5NXdkWE5vS0h0Y2JpQWdJQ0JtZFd4bWFXeHNaV1E2SUdaMWJHWnBiR3hsWkN4Y2JpQWdJQ0J5WldwbFkzUmxaRG9nY21WcVpXTjBaV1JjYmlBZ2ZTazdYRzRnSUhKbGRIVnliaUIwYUdsekxtaGhibVJzWlhKekxteGxibWQwYUNBdElERTdYRzU5TzF4dVhHNHZLaXBjYmlBcUlGSmxiVzkyWlNCaGJpQnBiblJsY21ObGNIUnZjaUJtY205dElIUm9aU0J6ZEdGamExeHVJQ3BjYmlBcUlFQndZWEpoYlNCN1RuVnRZbVZ5ZlNCcFpDQlVhR1VnU1VRZ2RHaGhkQ0IzWVhNZ2NtVjBkWEp1WldRZ1lua2dZSFZ6WldCY2JpQXFMMXh1U1c1MFpYSmpaWEIwYjNKTllXNWhaMlZ5TG5CeWIzUnZkSGx3WlM1bGFtVmpkQ0E5SUdaMWJtTjBhVzl1SUdWcVpXTjBLR2xrS1NCN1hHNGdJR2xtSUNoMGFHbHpMbWhoYm1Sc1pYSnpXMmxrWFNrZ2UxeHVJQ0FnSUhSb2FYTXVhR0Z1Wkd4bGNuTmJhV1JkSUQwZ2JuVnNiRHRjYmlBZ2ZWeHVmVHRjYmx4dUx5b3FYRzRnS2lCSmRHVnlZWFJsSUc5MlpYSWdZV3hzSUhSb1pTQnlaV2RwYzNSbGNtVmtJR2x1ZEdWeVkyVndkRzl5YzF4dUlDcGNiaUFxSUZSb2FYTWdiV1YwYUc5a0lHbHpJSEJoY25ScFkzVnNZWEpzZVNCMWMyVm1kV3dnWm05eUlITnJhWEJ3YVc1bklHOTJaWElnWVc1NVhHNGdLaUJwYm5SbGNtTmxjSFJ2Y25NZ2RHaGhkQ0J0WVhrZ2FHRjJaU0JpWldOdmJXVWdZRzUxYkd4Z0lHTmhiR3hwYm1jZ1lHVnFaV04wWUM1Y2JpQXFYRzRnS2lCQWNHRnlZVzBnZTBaMWJtTjBhVzl1ZlNCbWJpQlVhR1VnWm5WdVkzUnBiMjRnZEc4Z1kyRnNiQ0JtYjNJZ1pXRmphQ0JwYm5SbGNtTmxjSFJ2Y2x4dUlDb3ZYRzVKYm5SbGNtTmxjSFJ2Y2sxaGJtRm5aWEl1Y0hKdmRHOTBlWEJsTG1admNrVmhZMmdnUFNCbWRXNWpkR2x2YmlCbWIzSkZZV05vS0dadUtTQjdYRzRnSUhWMGFXeHpMbVp2Y2tWaFkyZ29kR2hwY3k1b1lXNWtiR1Z5Y3l3Z1puVnVZM1JwYjI0Z1ptOXlSV0ZqYUVoaGJtUnNaWElvYUNrZ2UxeHVJQ0FnSUdsbUlDaG9JQ0U5UFNCdWRXeHNLU0I3WEc0Z0lDQWdJQ0JtYmlob0tUdGNiaUFnSUNCOVhHNGdJSDBwTzF4dWZUdGNibHh1Ylc5a2RXeGxMbVY0Y0c5eWRITWdQU0JKYm5SbGNtTmxjSFJ2Y2sxaGJtRm5aWEk3WEc0aUxDSW5kWE5sSUhOMGNtbGpkQ2M3WEc1Y2JuWmhjaUJsYm1oaGJtTmxSWEp5YjNJZ1BTQnlaWEYxYVhKbEtDY3VMMlZ1YUdGdVkyVkZjbkp2Y2ljcE8xeHVYRzR2S2lwY2JpQXFJRU55WldGMFpTQmhiaUJGY25KdmNpQjNhWFJvSUhSb1pTQnpjR1ZqYVdacFpXUWdiV1Z6YzJGblpTd2dZMjl1Wm1sbkxDQmxjbkp2Y2lCamIyUmxMQ0J5WlhGMVpYTjBJR0Z1WkNCeVpYTndiMjV6WlM1Y2JpQXFYRzRnS2lCQWNHRnlZVzBnZTNOMGNtbHVaMzBnYldWemMyRm5aU0JVYUdVZ1pYSnliM0lnYldWemMyRm5aUzVjYmlBcUlFQndZWEpoYlNCN1QySnFaV04wZlNCamIyNW1hV2NnVkdobElHTnZibVpwWnk1Y2JpQXFJRUJ3WVhKaGJTQjdjM1J5YVc1bmZTQmJZMjlrWlYwZ1ZHaGxJR1Z5Y205eUlHTnZaR1VnS0dadmNpQmxlR0Z0Y0d4bExDQW5SVU5QVGs1QlFrOVNWRVZFSnlrdVhHNGdLaUJBY0dGeVlXMGdlMDlpYW1WamRIMGdXM0psY1hWbGMzUmRJRlJvWlNCeVpYRjFaWE4wTGx4dUlDb2dRSEJoY21GdElIdFBZbXBsWTNSOUlGdHlaWE53YjI1elpWMGdWR2hsSUhKbGMzQnZibk5sTGx4dUlDb2dRSEpsZEhWeWJuTWdlMFZ5Y205eWZTQlVhR1VnWTNKbFlYUmxaQ0JsY25KdmNpNWNiaUFxTDF4dWJXOWtkV3hsTG1WNGNHOXlkSE1nUFNCbWRXNWpkR2x2YmlCamNtVmhkR1ZGY25KdmNpaHRaWE56WVdkbExDQmpiMjVtYVdjc0lHTnZaR1VzSUhKbGNYVmxjM1FzSUhKbGMzQnZibk5sS1NCN1hHNGdJSFpoY2lCbGNuSnZjaUE5SUc1bGR5QkZjbkp2Y2lodFpYTnpZV2RsS1R0Y2JpQWdjbVYwZFhKdUlHVnVhR0Z1WTJWRmNuSnZjaWhsY25KdmNpd2dZMjl1Wm1sbkxDQmpiMlJsTENCeVpYRjFaWE4wTENCeVpYTndiMjV6WlNrN1hHNTlPMXh1SWl3aUozVnpaU0J6ZEhKcFkzUW5PMXh1WEc1MllYSWdkWFJwYkhNZ1BTQnlaWEYxYVhKbEtDY3VMeTR1TDNWMGFXeHpKeWs3WEc1MllYSWdkSEpoYm5ObWIzSnRSR0YwWVNBOUlISmxjWFZwY21Vb0p5NHZkSEpoYm5ObWIzSnRSR0YwWVNjcE8xeHVkbUZ5SUdselEyRnVZMlZzSUQwZ2NtVnhkV2x5WlNnbkxpNHZZMkZ1WTJWc0wybHpRMkZ1WTJWc0p5azdYRzUyWVhJZ1pHVm1ZWFZzZEhNZ1BTQnlaWEYxYVhKbEtDY3VMaTlrWldaaGRXeDBjeWNwTzF4dVhHNHZLaXBjYmlBcUlGUm9jbTkzY3lCaElHQkRZVzVqWld4Z0lHbG1JR05oYm1ObGJHeGhkR2x2YmlCb1lYTWdZbVZsYmlCeVpYRjFaWE4wWldRdVhHNGdLaTljYm1aMWJtTjBhVzl1SUhSb2NtOTNTV1pEWVc1alpXeHNZWFJwYjI1U1pYRjFaWE4wWldRb1kyOXVabWxuS1NCN1hHNGdJR2xtSUNoamIyNW1hV2N1WTJGdVkyVnNWRzlyWlc0cElIdGNiaUFnSUNCamIyNW1hV2N1WTJGdVkyVnNWRzlyWlc0dWRHaHliM2RKWmxKbGNYVmxjM1JsWkNncE8xeHVJQ0I5WEc1OVhHNWNiaThxS2x4dUlDb2dSR2x6Y0dGMFkyZ2dZU0J5WlhGMVpYTjBJSFJ2SUhSb1pTQnpaWEoyWlhJZ2RYTnBibWNnZEdobElHTnZibVpwWjNWeVpXUWdZV1JoY0hSbGNpNWNiaUFxWEc0Z0tpQkFjR0Z5WVcwZ2UyOWlhbVZqZEgwZ1kyOXVabWxuSUZSb1pTQmpiMjVtYVdjZ2RHaGhkQ0JwY3lCMGJ5QmlaU0IxYzJWa0lHWnZjaUIwYUdVZ2NtVnhkV1Z6ZEZ4dUlDb2dRSEpsZEhWeWJuTWdlMUJ5YjIxcGMyVjlJRlJvWlNCUWNtOXRhWE5sSUhSdklHSmxJR1oxYkdacGJHeGxaRnh1SUNvdlhHNXRiMlIxYkdVdVpYaHdiM0owY3lBOUlHWjFibU4wYVc5dUlHUnBjM0JoZEdOb1VtVnhkV1Z6ZENoamIyNW1hV2NwSUh0Y2JpQWdkR2h5YjNkSlprTmhibU5sYkd4aGRHbHZibEpsY1hWbGMzUmxaQ2hqYjI1bWFXY3BPMXh1WEc0Z0lDOHZJRVZ1YzNWeVpTQm9aV0ZrWlhKeklHVjRhWE4wWEc0Z0lHTnZibVpwWnk1b1pXRmtaWEp6SUQwZ1kyOXVabWxuTG1obFlXUmxjbk1nZkh3Z2UzMDdYRzVjYmlBZ0x5OGdWSEpoYm5ObWIzSnRJSEpsY1hWbGMzUWdaR0YwWVZ4dUlDQmpiMjVtYVdjdVpHRjBZU0E5SUhSeVlXNXpabTl5YlVSaGRHRW9YRzRnSUNBZ1kyOXVabWxuTG1SaGRHRXNYRzRnSUNBZ1kyOXVabWxuTG1obFlXUmxjbk1zWEc0Z0lDQWdZMjl1Wm1sbkxuUnlZVzV6Wm05eWJWSmxjWFZsYzNSY2JpQWdLVHRjYmx4dUlDQXZMeUJHYkdGMGRHVnVJR2hsWVdSbGNuTmNiaUFnWTI5dVptbG5MbWhsWVdSbGNuTWdQU0IxZEdsc2N5NXRaWEpuWlNoY2JpQWdJQ0JqYjI1bWFXY3VhR1ZoWkdWeWN5NWpiMjF0YjI0Z2ZId2dlMzBzWEc0Z0lDQWdZMjl1Wm1sbkxtaGxZV1JsY25OYlkyOXVabWxuTG0xbGRHaHZaRjBnZkh3Z2UzMHNYRzRnSUNBZ1kyOXVabWxuTG1obFlXUmxjbk1nZkh3Z2UzMWNiaUFnS1R0Y2JseHVJQ0IxZEdsc2N5NW1iM0pGWVdOb0tGeHVJQ0FnSUZzblpHVnNaWFJsSnl3Z0oyZGxkQ2NzSUNkb1pXRmtKeXdnSjNCdmMzUW5MQ0FuY0hWMEp5d2dKM0JoZEdOb0p5d2dKMk52YlcxdmJpZGRMRnh1SUNBZ0lHWjFibU4wYVc5dUlHTnNaV0Z1U0dWaFpHVnlRMjl1Wm1sbktHMWxkR2h2WkNrZ2UxeHVJQ0FnSUNBZ1pHVnNaWFJsSUdOdmJtWnBaeTVvWldGa1pYSnpXMjFsZEdodlpGMDdYRzRnSUNBZ2ZWeHVJQ0FwTzF4dVhHNGdJSFpoY2lCaFpHRndkR1Z5SUQwZ1kyOXVabWxuTG1Ga1lYQjBaWElnZkh3Z1pHVm1ZWFZzZEhNdVlXUmhjSFJsY2p0Y2JseHVJQ0J5WlhSMWNtNGdZV1JoY0hSbGNpaGpiMjVtYVdjcExuUm9aVzRvWm5WdVkzUnBiMjRnYjI1QlpHRndkR1Z5VW1WemIyeDFkR2x2YmloeVpYTndiMjV6WlNrZ2UxeHVJQ0FnSUhSb2NtOTNTV1pEWVc1alpXeHNZWFJwYjI1U1pYRjFaWE4wWldRb1kyOXVabWxuS1R0Y2JseHVJQ0FnSUM4dklGUnlZVzV6Wm05eWJTQnlaWE53YjI1elpTQmtZWFJoWEc0Z0lDQWdjbVZ6Y0c5dWMyVXVaR0YwWVNBOUlIUnlZVzV6Wm05eWJVUmhkR0VvWEc0Z0lDQWdJQ0J5WlhOd2IyNXpaUzVrWVhSaExGeHVJQ0FnSUNBZ2NtVnpjRzl1YzJVdWFHVmhaR1Z5Y3l4Y2JpQWdJQ0FnSUdOdmJtWnBaeTUwY21GdWMyWnZjbTFTWlhOd2IyNXpaVnh1SUNBZ0lDazdYRzVjYmlBZ0lDQnlaWFIxY200Z2NtVnpjRzl1YzJVN1hHNGdJSDBzSUdaMWJtTjBhVzl1SUc5dVFXUmhjSFJsY2xKbGFtVmpkR2x2YmloeVpXRnpiMjRwSUh0Y2JpQWdJQ0JwWmlBb0lXbHpRMkZ1WTJWc0tISmxZWE52YmlrcElIdGNiaUFnSUNBZ0lIUm9jbTkzU1daRFlXNWpaV3hzWVhScGIyNVNaWEYxWlhOMFpXUW9ZMjl1Wm1sbktUdGNibHh1SUNBZ0lDQWdMeThnVkhKaGJuTm1iM0p0SUhKbGMzQnZibk5sSUdSaGRHRmNiaUFnSUNBZ0lHbG1JQ2h5WldGemIyNGdKaVlnY21WaGMyOXVMbkpsYzNCdmJuTmxLU0I3WEc0Z0lDQWdJQ0FnSUhKbFlYTnZiaTV5WlhOd2IyNXpaUzVrWVhSaElEMGdkSEpoYm5ObWIzSnRSR0YwWVNoY2JpQWdJQ0FnSUNBZ0lDQnlaV0Z6YjI0dWNtVnpjRzl1YzJVdVpHRjBZU3hjYmlBZ0lDQWdJQ0FnSUNCeVpXRnpiMjR1Y21WemNHOXVjMlV1YUdWaFpHVnljeXhjYmlBZ0lDQWdJQ0FnSUNCamIyNW1hV2N1ZEhKaGJuTm1iM0p0VW1WemNHOXVjMlZjYmlBZ0lDQWdJQ0FnS1R0Y2JpQWdJQ0FnSUgxY2JpQWdJQ0I5WEc1Y2JpQWdJQ0J5WlhSMWNtNGdVSEp2YldselpTNXlaV3BsWTNRb2NtVmhjMjl1S1R0Y2JpQWdmU2s3WEc1OU8xeHVJaXdpSjNWelpTQnpkSEpwWTNRbk8xeHVYRzR2S2lwY2JpQXFJRlZ3WkdGMFpTQmhiaUJGY25KdmNpQjNhWFJvSUhSb1pTQnpjR1ZqYVdacFpXUWdZMjl1Wm1sbkxDQmxjbkp2Y2lCamIyUmxMQ0JoYm1RZ2NtVnpjRzl1YzJVdVhHNGdLbHh1SUNvZ1FIQmhjbUZ0SUh0RmNuSnZjbjBnWlhKeWIzSWdWR2hsSUdWeWNtOXlJSFJ2SUhWd1pHRjBaUzVjYmlBcUlFQndZWEpoYlNCN1QySnFaV04wZlNCamIyNW1hV2NnVkdobElHTnZibVpwWnk1Y2JpQXFJRUJ3WVhKaGJTQjdjM1J5YVc1bmZTQmJZMjlrWlYwZ1ZHaGxJR1Z5Y205eUlHTnZaR1VnS0dadmNpQmxlR0Z0Y0d4bExDQW5SVU5QVGs1QlFrOVNWRVZFSnlrdVhHNGdLaUJBY0dGeVlXMGdlMDlpYW1WamRIMGdXM0psY1hWbGMzUmRJRlJvWlNCeVpYRjFaWE4wTGx4dUlDb2dRSEJoY21GdElIdFBZbXBsWTNSOUlGdHlaWE53YjI1elpWMGdWR2hsSUhKbGMzQnZibk5sTGx4dUlDb2dRSEpsZEhWeWJuTWdlMFZ5Y205eWZTQlVhR1VnWlhKeWIzSXVYRzRnS2k5Y2JtMXZaSFZzWlM1bGVIQnZjblJ6SUQwZ1puVnVZM1JwYjI0Z1pXNW9ZVzVqWlVWeWNtOXlLR1Z5Y205eUxDQmpiMjVtYVdjc0lHTnZaR1VzSUhKbGNYVmxjM1FzSUhKbGMzQnZibk5sS1NCN1hHNGdJR1Z5Y205eUxtTnZibVpwWnlBOUlHTnZibVpwWnp0Y2JpQWdhV1lnS0dOdlpHVXBJSHRjYmlBZ0lDQmxjbkp2Y2k1amIyUmxJRDBnWTI5a1pUdGNiaUFnZlZ4dUlDQmxjbkp2Y2k1eVpYRjFaWE4wSUQwZ2NtVnhkV1Z6ZER0Y2JpQWdaWEp5YjNJdWNtVnpjRzl1YzJVZ1BTQnlaWE53YjI1elpUdGNiaUFnY21WMGRYSnVJR1Z5Y205eU8xeHVmVHRjYmlJc0lpZDFjMlVnYzNSeWFXTjBKenRjYmx4dWRtRnlJR055WldGMFpVVnljbTl5SUQwZ2NtVnhkV2x5WlNnbkxpOWpjbVZoZEdWRmNuSnZjaWNwTzF4dVhHNHZLaXBjYmlBcUlGSmxjMjlzZG1VZ2IzSWdjbVZxWldOMElHRWdVSEp2YldselpTQmlZWE5sWkNCdmJpQnlaWE53YjI1elpTQnpkR0YwZFhNdVhHNGdLbHh1SUNvZ1FIQmhjbUZ0SUh0R2RXNWpkR2x2Ym4wZ2NtVnpiMngyWlNCQklHWjFibU4wYVc5dUlIUm9ZWFFnY21WemIyeDJaWE1nZEdobElIQnliMjFwYzJVdVhHNGdLaUJBY0dGeVlXMGdlMFoxYm1OMGFXOXVmU0J5WldwbFkzUWdRU0JtZFc1amRHbHZiaUIwYUdGMElISmxhbVZqZEhNZ2RHaGxJSEJ5YjIxcGMyVXVYRzRnS2lCQWNHRnlZVzBnZTI5aWFtVmpkSDBnY21WemNHOXVjMlVnVkdobElISmxjM0J2Ym5ObExseHVJQ292WEc1dGIyUjFiR1V1Wlhod2IzSjBjeUE5SUdaMWJtTjBhVzl1SUhObGRIUnNaU2h5WlhOdmJIWmxMQ0J5WldwbFkzUXNJSEpsYzNCdmJuTmxLU0I3WEc0Z0lIWmhjaUIyWVd4cFpHRjBaVk4wWVhSMWN5QTlJSEpsYzNCdmJuTmxMbU52Ym1acFp5NTJZV3hwWkdGMFpWTjBZWFIxY3p0Y2JpQWdMeThnVG05MFpUb2djM1JoZEhWeklHbHpJRzV2ZENCbGVIQnZjMlZrSUdKNUlGaEViMjFoYVc1U1pYRjFaWE4wWEc0Z0lHbG1JQ2doY21WemNHOXVjMlV1YzNSaGRIVnpJSHg4SUNGMllXeHBaR0YwWlZOMFlYUjFjeUI4ZkNCMllXeHBaR0YwWlZOMFlYUjFjeWh5WlhOd2IyNXpaUzV6ZEdGMGRYTXBLU0I3WEc0Z0lDQWdjbVZ6YjJ4MlpTaHlaWE53YjI1elpTazdYRzRnSUgwZ1pXeHpaU0I3WEc0Z0lDQWdjbVZxWldOMEtHTnlaV0YwWlVWeWNtOXlLRnh1SUNBZ0lDQWdKMUpsY1hWbGMzUWdabUZwYkdWa0lIZHBkR2dnYzNSaGRIVnpJR052WkdVZ0p5QXJJSEpsYzNCdmJuTmxMbk4wWVhSMWN5eGNiaUFnSUNBZ0lISmxjM0J2Ym5ObExtTnZibVpwWnl4Y2JpQWdJQ0FnSUc1MWJHd3NYRzRnSUNBZ0lDQnlaWE53YjI1elpTNXlaWEYxWlhOMExGeHVJQ0FnSUNBZ2NtVnpjRzl1YzJWY2JpQWdJQ0FwS1R0Y2JpQWdmVnh1ZlR0Y2JpSXNJaWQxYzJVZ2MzUnlhV04wSnp0Y2JseHVkbUZ5SUhWMGFXeHpJRDBnY21WeGRXbHlaU2duTGk4dUxpOTFkR2xzY3ljcE8xeHVYRzR2S2lwY2JpQXFJRlJ5WVc1elptOXliU0IwYUdVZ1pHRjBZU0JtYjNJZ1lTQnlaWEYxWlhOMElHOXlJR0VnY21WemNHOXVjMlZjYmlBcVhHNGdLaUJBY0dGeVlXMGdlMDlpYW1WamRIeFRkSEpwYm1kOUlHUmhkR0VnVkdobElHUmhkR0VnZEc4Z1ltVWdkSEpoYm5ObWIzSnRaV1JjYmlBcUlFQndZWEpoYlNCN1FYSnlZWGw5SUdobFlXUmxjbk1nVkdobElHaGxZV1JsY25NZ1ptOXlJSFJvWlNCeVpYRjFaWE4wSUc5eUlISmxjM0J2Ym5ObFhHNGdLaUJBY0dGeVlXMGdlMEZ5Y21GNWZFWjFibU4wYVc5dWZTQm1ibk1nUVNCemFXNW5iR1VnWm5WdVkzUnBiMjRnYjNJZ1FYSnlZWGtnYjJZZ1puVnVZM1JwYjI1elhHNGdLaUJBY21WMGRYSnVjeUI3S24wZ1ZHaGxJSEpsYzNWc2RHbHVaeUIwY21GdWMyWnZjbTFsWkNCa1lYUmhYRzRnS2k5Y2JtMXZaSFZzWlM1bGVIQnZjblJ6SUQwZ1puVnVZM1JwYjI0Z2RISmhibk5tYjNKdFJHRjBZU2hrWVhSaExDQm9aV0ZrWlhKekxDQm1ibk1wSUh0Y2JpQWdMeXBsYzJ4cGJuUWdibTh0Y0dGeVlXMHRjbVZoYzNOcFoyNDZNQ292WEc0Z0lIVjBhV3h6TG1admNrVmhZMmdvWm01ekxDQm1kVzVqZEdsdmJpQjBjbUZ1YzJadmNtMG9abTRwSUh0Y2JpQWdJQ0JrWVhSaElEMGdabTRvWkdGMFlTd2dhR1ZoWkdWeWN5azdYRzRnSUgwcE8xeHVYRzRnSUhKbGRIVnliaUJrWVhSaE8xeHVmVHRjYmlJc0lpZDFjMlVnYzNSeWFXTjBKenRjYmx4dWRtRnlJSFYwYVd4eklEMGdjbVZ4ZFdseVpTZ25MaTkxZEdsc2N5Y3BPMXh1ZG1GeUlHNXZjbTFoYkdsNlpVaGxZV1JsY2s1aGJXVWdQU0J5WlhGMWFYSmxLQ2N1TDJobGJIQmxjbk12Ym05eWJXRnNhWHBsU0dWaFpHVnlUbUZ0WlNjcE8xeHVYRzUyWVhJZ1JFVkdRVlZNVkY5RFQwNVVSVTVVWDFSWlVFVWdQU0I3WEc0Z0lDZERiMjUwWlc1MExWUjVjR1VuT2lBbllYQndiR2xqWVhScGIyNHZlQzEzZDNjdFptOXliUzExY214bGJtTnZaR1ZrSjF4dWZUdGNibHh1Wm5WdVkzUnBiMjRnYzJWMFEyOXVkR1Z1ZEZSNWNHVkpabFZ1YzJWMEtHaGxZV1JsY25Nc0lIWmhiSFZsS1NCN1hHNGdJR2xtSUNnaGRYUnBiSE11YVhOVmJtUmxabWx1WldRb2FHVmhaR1Z5Y3lrZ0ppWWdkWFJwYkhNdWFYTlZibVJsWm1sdVpXUW9hR1ZoWkdWeWMxc25RMjl1ZEdWdWRDMVVlWEJsSjEwcEtTQjdYRzRnSUNBZ2FHVmhaR1Z5YzFzblEyOXVkR1Z1ZEMxVWVYQmxKMTBnUFNCMllXeDFaVHRjYmlBZ2ZWeHVmVnh1WEc1bWRXNWpkR2x2YmlCblpYUkVaV1poZFd4MFFXUmhjSFJsY2lncElIdGNiaUFnZG1GeUlHRmtZWEIwWlhJN1hHNGdJR2xtSUNoMGVYQmxiMllnV0UxTVNIUjBjRkpsY1hWbGMzUWdJVDA5SUNkMWJtUmxabWx1WldRbktTQjdYRzRnSUNBZ0x5OGdSbTl5SUdKeWIzZHpaWEp6SUhWelpTQllTRklnWVdSaGNIUmxjbHh1SUNBZ0lHRmtZWEIwWlhJZ1BTQnlaWEYxYVhKbEtDY3VMMkZrWVhCMFpYSnpMM2hvY2ljcE8xeHVJQ0I5SUdWc2MyVWdhV1lnS0hSNWNHVnZaaUJ3Y205alpYTnpJQ0U5UFNBbmRXNWtaV1pwYm1Wa0p5a2dlMXh1SUNBZ0lDOHZJRVp2Y2lCdWIyUmxJSFZ6WlNCSVZGUlFJR0ZrWVhCMFpYSmNiaUFnSUNCaFpHRndkR1Z5SUQwZ2NtVnhkV2x5WlNnbkxpOWhaR0Z3ZEdWeWN5OW9kSFJ3SnlrN1hHNGdJSDFjYmlBZ2NtVjBkWEp1SUdGa1lYQjBaWEk3WEc1OVhHNWNiblpoY2lCa1pXWmhkV3gwY3lBOUlIdGNiaUFnWVdSaGNIUmxjam9nWjJWMFJHVm1ZWFZzZEVGa1lYQjBaWElvS1N4Y2JseHVJQ0IwY21GdWMyWnZjbTFTWlhGMVpYTjBPaUJiWm5WdVkzUnBiMjRnZEhKaGJuTm1iM0p0VW1WeGRXVnpkQ2hrWVhSaExDQm9aV0ZrWlhKektTQjdYRzRnSUNBZ2JtOXliV0ZzYVhwbFNHVmhaR1Z5VG1GdFpTaG9aV0ZrWlhKekxDQW5RMjl1ZEdWdWRDMVVlWEJsSnlrN1hHNGdJQ0FnYVdZZ0tIVjBhV3h6TG1selJtOXliVVJoZEdFb1pHRjBZU2tnZkh4Y2JpQWdJQ0FnSUhWMGFXeHpMbWx6UVhKeVlYbENkV1ptWlhJb1pHRjBZU2tnZkh4Y2JpQWdJQ0FnSUhWMGFXeHpMbWx6UW5WbVptVnlLR1JoZEdFcElIeDhYRzRnSUNBZ0lDQjFkR2xzY3k1cGMxTjBjbVZoYlNoa1lYUmhLU0I4ZkZ4dUlDQWdJQ0FnZFhScGJITXVhWE5HYVd4bEtHUmhkR0VwSUh4OFhHNGdJQ0FnSUNCMWRHbHNjeTVwYzBKc2IySW9aR0YwWVNsY2JpQWdJQ0FwSUh0Y2JpQWdJQ0FnSUhKbGRIVnliaUJrWVhSaE8xeHVJQ0FnSUgxY2JpQWdJQ0JwWmlBb2RYUnBiSE11YVhOQmNuSmhlVUoxWm1abGNsWnBaWGNvWkdGMFlTa3BJSHRjYmlBZ0lDQWdJSEpsZEhWeWJpQmtZWFJoTG1KMVptWmxjanRjYmlBZ0lDQjlYRzRnSUNBZ2FXWWdLSFYwYVd4ekxtbHpWVkpNVTJWaGNtTm9VR0Z5WVcxektHUmhkR0VwS1NCN1hHNGdJQ0FnSUNCelpYUkRiMjUwWlc1MFZIbHdaVWxtVlc1elpYUW9hR1ZoWkdWeWN5d2dKMkZ3Y0d4cFkyRjBhVzl1TDNndGQzZDNMV1p2Y20wdGRYSnNaVzVqYjJSbFpEdGphR0Z5YzJWMFBYVjBaaTA0SnlrN1hHNGdJQ0FnSUNCeVpYUjFjbTRnWkdGMFlTNTBiMU4wY21sdVp5Z3BPMXh1SUNBZ0lIMWNiaUFnSUNCcFppQW9kWFJwYkhNdWFYTlBZbXBsWTNRb1pHRjBZU2twSUh0Y2JpQWdJQ0FnSUhObGRFTnZiblJsYm5SVWVYQmxTV1pWYm5ObGRDaG9aV0ZrWlhKekxDQW5ZWEJ3YkdsallYUnBiMjR2YW5OdmJqdGphR0Z5YzJWMFBYVjBaaTA0SnlrN1hHNGdJQ0FnSUNCeVpYUjFjbTRnU2xOUFRpNXpkSEpwYm1kcFpua29aR0YwWVNrN1hHNGdJQ0FnZlZ4dUlDQWdJSEpsZEhWeWJpQmtZWFJoTzF4dUlDQjlYU3hjYmx4dUlDQjBjbUZ1YzJadmNtMVNaWE53YjI1elpUb2dXMloxYm1OMGFXOXVJSFJ5WVc1elptOXliVkpsYzNCdmJuTmxLR1JoZEdFcElIdGNiaUFnSUNBdkttVnpiR2x1ZENCdWJ5MXdZWEpoYlMxeVpXRnpjMmxuYmpvd0tpOWNiaUFnSUNCcFppQW9kSGx3Wlc5bUlHUmhkR0VnUFQwOUlDZHpkSEpwYm1jbktTQjdYRzRnSUNBZ0lDQjBjbmtnZTF4dUlDQWdJQ0FnSUNCa1lYUmhJRDBnU2xOUFRpNXdZWEp6WlNoa1lYUmhLVHRjYmlBZ0lDQWdJSDBnWTJGMFkyZ2dLR1VwSUhzZ0x5b2dTV2R1YjNKbElDb3ZJSDFjYmlBZ0lDQjlYRzRnSUNBZ2NtVjBkWEp1SUdSaGRHRTdYRzRnSUgxZExGeHVYRzRnSUhScGJXVnZkWFE2SURBc1hHNWNiaUFnZUhOeVprTnZiMnRwWlU1aGJXVTZJQ2RZVTFKR0xWUlBTMFZPSnl4Y2JpQWdlSE55WmtobFlXUmxjazVoYldVNklDZFlMVmhUVWtZdFZFOUxSVTRuTEZ4dVhHNGdJRzFoZUVOdmJuUmxiblJNWlc1bmRHZzZJQzB4TEZ4dVhHNGdJSFpoYkdsa1lYUmxVM1JoZEhWek9pQm1kVzVqZEdsdmJpQjJZV3hwWkdGMFpWTjBZWFIxY3loemRHRjBkWE1wSUh0Y2JpQWdJQ0J5WlhSMWNtNGdjM1JoZEhWeklENDlJREl3TUNBbUppQnpkR0YwZFhNZ1BDQXpNREE3WEc0Z0lIMWNibjA3WEc1Y2JtUmxabUYxYkhSekxtaGxZV1JsY25NZ1BTQjdYRzRnSUdOdmJXMXZiam9nZTF4dUlDQWdJQ2RCWTJObGNIUW5PaUFuWVhCd2JHbGpZWFJwYjI0dmFuTnZiaXdnZEdWNGRDOXdiR0ZwYml3Z0tpOHFKMXh1SUNCOVhHNTlPMXh1WEc1MWRHbHNjeTVtYjNKRllXTm9LRnNuWkdWc1pYUmxKeXdnSjJkbGRDY3NJQ2RvWldGa0oxMHNJR1oxYm1OMGFXOXVJR1p2Y2tWaFkyaE5aWFJvYjJST2IwUmhkR0VvYldWMGFHOWtLU0I3WEc0Z0lHUmxabUYxYkhSekxtaGxZV1JsY25OYmJXVjBhRzlrWFNBOUlIdDlPMXh1ZlNrN1hHNWNiblYwYVd4ekxtWnZja1ZoWTJnb1d5ZHdiM04wSnl3Z0ozQjFkQ2NzSUNkd1lYUmphQ2RkTENCbWRXNWpkR2x2YmlCbWIzSkZZV05vVFdWMGFHOWtWMmwwYUVSaGRHRW9iV1YwYUc5a0tTQjdYRzRnSUdSbFptRjFiSFJ6TG1obFlXUmxjbk5iYldWMGFHOWtYU0E5SUhWMGFXeHpMbTFsY21kbEtFUkZSa0ZWVEZSZlEwOU9WRVZPVkY5VVdWQkZLVHRjYm4wcE8xeHVYRzV0YjJSMWJHVXVaWGh3YjNKMGN5QTlJR1JsWm1GMWJIUnpPMXh1SWl3aUozVnpaU0J6ZEhKcFkzUW5PMXh1WEc1dGIyUjFiR1V1Wlhod2IzSjBjeUE5SUdaMWJtTjBhVzl1SUdKcGJtUW9abTRzSUhSb2FYTkJjbWNwSUh0Y2JpQWdjbVYwZFhKdUlHWjFibU4wYVc5dUlIZHlZWEFvS1NCN1hHNGdJQ0FnZG1GeUlHRnlaM01nUFNCdVpYY2dRWEp5WVhrb1lYSm5kVzFsYm5SekxteGxibWQwYUNrN1hHNGdJQ0FnWm05eUlDaDJZWElnYVNBOUlEQTdJR2tnUENCaGNtZHpMbXhsYm1kMGFEc2dhU3NyS1NCN1hHNGdJQ0FnSUNCaGNtZHpXMmxkSUQwZ1lYSm5kVzFsYm5SelcybGRPMXh1SUNBZ0lIMWNiaUFnSUNCeVpYUjFjbTRnWm00dVlYQndiSGtvZEdocGMwRnlaeXdnWVhKbmN5azdYRzRnSUgwN1hHNTlPMXh1SWl3aUozVnpaU0J6ZEhKcFkzUW5PMXh1WEc0dkx5QmlkRzloSUhCdmJIbG1hV3hzSUdadmNpQkpSVHd4TUNCamIzVnlkR1Z6ZVNCb2RIUndjem92TDJkcGRHaDFZaTVqYjIwdlpHRjJhV1JqYUdGdFltVnljeTlDWVhObE5qUXVhbk5jYmx4dWRtRnlJR05vWVhKeklEMGdKMEZDUTBSRlJrZElTVXBMVEUxT1QxQlJVbE5VVlZaWFdGbGFZV0pqWkdWbVoyaHBhbXRzYlc1dmNIRnljM1IxZG5kNGVYb3dNVEl6TkRVMk56ZzVLeTg5Snp0Y2JseHVablZ1WTNScGIyNGdSU2dwSUh0Y2JpQWdkR2hwY3k1dFpYTnpZV2RsSUQwZ0oxTjBjbWx1WnlCamIyNTBZV2x1Y3lCaGJpQnBiblpoYkdsa0lHTm9ZWEpoWTNSbGNpYzdYRzU5WEc1RkxuQnliM1J2ZEhsd1pTQTlJRzVsZHlCRmNuSnZjanRjYmtVdWNISnZkRzkwZVhCbExtTnZaR1VnUFNBMU8xeHVSUzV3Y205MGIzUjVjR1V1Ym1GdFpTQTlJQ2RKYm5aaGJHbGtRMmhoY21GamRHVnlSWEp5YjNJbk8xeHVYRzVtZFc1amRHbHZiaUJpZEc5aEtHbHVjSFYwS1NCN1hHNGdJSFpoY2lCemRISWdQU0JUZEhKcGJtY29hVzV3ZFhRcE8xeHVJQ0IyWVhJZ2IzVjBjSFYwSUQwZ0p5YzdYRzRnSUdadmNpQW9YRzRnSUNBZ0x5OGdhVzVwZEdsaGJHbDZaU0J5WlhOMWJIUWdZVzVrSUdOdmRXNTBaWEpjYmlBZ0lDQjJZWElnWW14dlkyc3NJR05vWVhKRGIyUmxMQ0JwWkhnZ1BTQXdMQ0J0WVhBZ1BTQmphR0Z5Y3p0Y2JpQWdJQ0F2THlCcFppQjBhR1VnYm1WNGRDQnpkSElnYVc1a1pYZ2daRzlsY3lCdWIzUWdaWGhwYzNRNlhHNGdJQ0FnTHk4Z0lDQmphR0Z1WjJVZ2RHaGxJRzFoY0hCcGJtY2dkR0ZpYkdVZ2RHOGdYQ0k5WENKY2JpQWdJQ0F2THlBZ0lHTm9aV05ySUdsbUlHUWdhR0Z6SUc1dklHWnlZV04wYVc5dVlXd2daR2xuYVhSelhHNGdJQ0FnYzNSeUxtTm9ZWEpCZENocFpIZ2dmQ0F3S1NCOGZDQW9iV0Z3SUQwZ0p6MG5MQ0JwWkhnZ0pTQXhLVHRjYmlBZ0lDQXZMeUJjSWpnZ0xTQnBaSGdnSlNBeElDb2dPRndpSUdkbGJtVnlZWFJsY3lCMGFHVWdjMlZ4ZFdWdVkyVWdNaXdnTkN3Z05pd2dPRnh1SUNBZ0lHOTFkSEIxZENBclBTQnRZWEF1WTJoaGNrRjBLRFl6SUNZZ1lteHZZMnNnUGo0Z09DQXRJR2xrZUNBbElERWdLaUE0S1Z4dUlDQXBJSHRjYmlBZ0lDQmphR0Z5UTI5a1pTQTlJSE4wY2k1amFHRnlRMjlrWlVGMEtHbGtlQ0FyUFNBeklDOGdOQ2s3WEc0Z0lDQWdhV1lnS0dOb1lYSkRiMlJsSUQ0Z01IaEdSaWtnZTF4dUlDQWdJQ0FnZEdoeWIzY2dibVYzSUVVb0tUdGNiaUFnSUNCOVhHNGdJQ0FnWW14dlkyc2dQU0JpYkc5amF5QThQQ0E0SUh3Z1kyaGhja052WkdVN1hHNGdJSDFjYmlBZ2NtVjBkWEp1SUc5MWRIQjFkRHRjYm4xY2JseHViVzlrZFd4bExtVjRjRzl5ZEhNZ1BTQmlkRzloTzF4dUlpd2lKM1Z6WlNCemRISnBZM1FuTzF4dVhHNTJZWElnZFhScGJITWdQU0J5WlhGMWFYSmxLQ2N1THk0dUwzVjBhV3h6SnlrN1hHNWNibVoxYm1OMGFXOXVJR1Z1WTI5a1pTaDJZV3dwSUh0Y2JpQWdjbVYwZFhKdUlHVnVZMjlrWlZWU1NVTnZiWEJ2Ym1WdWRDaDJZV3dwTGx4dUlDQWdJSEpsY0d4aFkyVW9MeVUwTUM5bmFTd2dKMEFuS1M1Y2JpQWdJQ0J5WlhCc1lXTmxLQzhsTTBFdloya3NJQ2M2SnlrdVhHNGdJQ0FnY21Wd2JHRmpaU2d2SlRJMEwyY3NJQ2NrSnlrdVhHNGdJQ0FnY21Wd2JHRmpaU2d2SlRKREwyZHBMQ0FuTENjcExseHVJQ0FnSUhKbGNHeGhZMlVvTHlVeU1DOW5MQ0FuS3ljcExseHVJQ0FnSUhKbGNHeGhZMlVvTHlVMVFpOW5hU3dnSjFzbktTNWNiaUFnSUNCeVpYQnNZV05sS0M4bE5VUXZaMmtzSUNkZEp5azdYRzU5WEc1Y2JpOHFLbHh1SUNvZ1FuVnBiR1FnWVNCVlVrd2dZbmtnWVhCd1pXNWthVzVuSUhCaGNtRnRjeUIwYnlCMGFHVWdaVzVrWEc0Z0tseHVJQ29nUUhCaGNtRnRJSHR6ZEhKcGJtZDlJSFZ5YkNCVWFHVWdZbUZ6WlNCdlppQjBhR1VnZFhKc0lDaGxMbWN1TENCb2RIUndPaTh2ZDNkM0xtZHZiMmRzWlM1amIyMHBYRzRnS2lCQWNHRnlZVzBnZTI5aWFtVmpkSDBnVzNCaGNtRnRjMTBnVkdobElIQmhjbUZ0Y3lCMGJ5QmlaU0JoY0hCbGJtUmxaRnh1SUNvZ1FISmxkSFZ5Ym5NZ2UzTjBjbWx1WjMwZ1ZHaGxJR1p2Y20xaGRIUmxaQ0IxY214Y2JpQXFMMXh1Ylc5a2RXeGxMbVY0Y0c5eWRITWdQU0JtZFc1amRHbHZiaUJpZFdsc1pGVlNUQ2gxY213c0lIQmhjbUZ0Y3l3Z2NHRnlZVzF6VTJWeWFXRnNhWHBsY2lrZ2UxeHVJQ0F2S21WemJHbHVkQ0J1Ynkxd1lYSmhiUzF5WldGemMybG5iam93S2k5Y2JpQWdhV1lnS0NGd1lYSmhiWE1wSUh0Y2JpQWdJQ0J5WlhSMWNtNGdkWEpzTzF4dUlDQjlYRzVjYmlBZ2RtRnlJSE5sY21saGJHbDZaV1JRWVhKaGJYTTdYRzRnSUdsbUlDaHdZWEpoYlhOVFpYSnBZV3hwZW1WeUtTQjdYRzRnSUNBZ2MyVnlhV0ZzYVhwbFpGQmhjbUZ0Y3lBOUlIQmhjbUZ0YzFObGNtbGhiR2w2WlhJb2NHRnlZVzF6S1R0Y2JpQWdmU0JsYkhObElHbG1JQ2gxZEdsc2N5NXBjMVZTVEZObFlYSmphRkJoY21GdGN5aHdZWEpoYlhNcEtTQjdYRzRnSUNBZ2MyVnlhV0ZzYVhwbFpGQmhjbUZ0Y3lBOUlIQmhjbUZ0Y3k1MGIxTjBjbWx1WnlncE8xeHVJQ0I5SUdWc2MyVWdlMXh1SUNBZ0lIWmhjaUJ3WVhKMGN5QTlJRnRkTzF4dVhHNGdJQ0FnZFhScGJITXVabTl5UldGamFDaHdZWEpoYlhNc0lHWjFibU4wYVc5dUlITmxjbWxoYkdsNlpTaDJZV3dzSUd0bGVTa2dlMXh1SUNBZ0lDQWdhV1lnS0haaGJDQTlQVDBnYm5Wc2JDQjhmQ0IwZVhCbGIyWWdkbUZzSUQwOVBTQW5kVzVrWldacGJtVmtKeWtnZTF4dUlDQWdJQ0FnSUNCeVpYUjFjbTQ3WEc0Z0lDQWdJQ0I5WEc1Y2JpQWdJQ0FnSUdsbUlDaDFkR2xzY3k1cGMwRnljbUY1S0haaGJDa3BJSHRjYmlBZ0lDQWdJQ0FnYTJWNUlEMGdhMlY1SUNzZ0oxdGRKenRjYmlBZ0lDQWdJSDFjYmx4dUlDQWdJQ0FnYVdZZ0tDRjFkR2xzY3k1cGMwRnljbUY1S0haaGJDa3BJSHRjYmlBZ0lDQWdJQ0FnZG1Gc0lEMGdXM1poYkYwN1hHNGdJQ0FnSUNCOVhHNWNiaUFnSUNBZ0lIVjBhV3h6TG1admNrVmhZMmdvZG1Gc0xDQm1kVzVqZEdsdmJpQndZWEp6WlZaaGJIVmxLSFlwSUh0Y2JpQWdJQ0FnSUNBZ2FXWWdLSFYwYVd4ekxtbHpSR0YwWlNoMktTa2dlMXh1SUNBZ0lDQWdJQ0FnSUhZZ1BTQjJMblJ2U1ZOUFUzUnlhVzVuS0NrN1hHNGdJQ0FnSUNBZ0lIMGdaV3h6WlNCcFppQW9kWFJwYkhNdWFYTlBZbXBsWTNRb2Rpa3BJSHRjYmlBZ0lDQWdJQ0FnSUNCMklEMGdTbE5QVGk1emRISnBibWRwWm5rb2RpazdYRzRnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnY0dGeWRITXVjSFZ6YUNobGJtTnZaR1VvYTJWNUtTQXJJQ2M5SnlBcklHVnVZMjlrWlNoMktTazdYRzRnSUNBZ0lDQjlLVHRjYmlBZ0lDQjlLVHRjYmx4dUlDQWdJSE5sY21saGJHbDZaV1JRWVhKaGJYTWdQU0J3WVhKMGN5NXFiMmx1S0NjbUp5azdYRzRnSUgxY2JseHVJQ0JwWmlBb2MyVnlhV0ZzYVhwbFpGQmhjbUZ0Y3lrZ2UxeHVJQ0FnSUhWeWJDQXJQU0FvZFhKc0xtbHVaR1Y0VDJZb0p6OG5LU0E5UFQwZ0xURWdQeUFuUHljZ09pQW5KaWNwSUNzZ2MyVnlhV0ZzYVhwbFpGQmhjbUZ0Y3p0Y2JpQWdmVnh1WEc0Z0lISmxkSFZ5YmlCMWNtdzdYRzU5TzF4dUlpd2lKM1Z6WlNCemRISnBZM1FuTzF4dVhHNHZLaXBjYmlBcUlFTnlaV0YwWlhNZ1lTQnVaWGNnVlZKTUlHSjVJR052YldKcGJtbHVaeUIwYUdVZ2MzQmxZMmxtYVdWa0lGVlNUSE5jYmlBcVhHNGdLaUJBY0dGeVlXMGdlM04wY21sdVozMGdZbUZ6WlZWU1RDQlVhR1VnWW1GelpTQlZVa3hjYmlBcUlFQndZWEpoYlNCN2MzUnlhVzVuZlNCeVpXeGhkR2wyWlZWU1RDQlVhR1VnY21Wc1lYUnBkbVVnVlZKTVhHNGdLaUJBY21WMGRYSnVjeUI3YzNSeWFXNW5mU0JVYUdVZ1kyOXRZbWx1WldRZ1ZWSk1YRzRnS2k5Y2JtMXZaSFZzWlM1bGVIQnZjblJ6SUQwZ1puVnVZM1JwYjI0Z1kyOXRZbWx1WlZWU1RITW9ZbUZ6WlZWU1RDd2djbVZzWVhScGRtVlZVa3dwSUh0Y2JpQWdjbVYwZFhKdUlISmxiR0YwYVhabFZWSk1YRzRnSUNBZ1B5QmlZWE5sVlZKTUxuSmxjR3hoWTJVb0wxeGNMeXNrTHl3Z0p5Y3BJQ3NnSnk4bklDc2djbVZzWVhScGRtVlZVa3d1Y21Wd2JHRmpaU2d2WGx4Y0x5c3ZMQ0FuSnlsY2JpQWdJQ0E2SUdKaGMyVlZVa3c3WEc1OU8xeHVJaXdpSjNWelpTQnpkSEpwWTNRbk8xeHVYRzUyWVhJZ2RYUnBiSE1nUFNCeVpYRjFhWEpsS0NjdUx5NHVMM1YwYVd4ekp5azdYRzVjYm0xdlpIVnNaUzVsZUhCdmNuUnpJRDBnS0Z4dUlDQjFkR2xzY3k1cGMxTjBZVzVrWVhKa1FuSnZkM05sY2tWdWRpZ3BJRDljYmx4dUlDQXZMeUJUZEdGdVpHRnlaQ0JpY205M2MyVnlJR1Z1ZG5NZ2MzVndjRzl5ZENCa2IyTjFiV1Z1ZEM1amIyOXJhV1ZjYmlBZ0tHWjFibU4wYVc5dUlITjBZVzVrWVhKa1FuSnZkM05sY2tWdWRpZ3BJSHRjYmlBZ0lDQnlaWFIxY200Z2UxeHVJQ0FnSUNBZ2QzSnBkR1U2SUdaMWJtTjBhVzl1SUhkeWFYUmxLRzVoYldVc0lIWmhiSFZsTENCbGVIQnBjbVZ6TENCd1lYUm9MQ0JrYjIxaGFXNHNJSE5sWTNWeVpTa2dlMXh1SUNBZ0lDQWdJQ0IyWVhJZ1kyOXZhMmxsSUQwZ1cxMDdYRzRnSUNBZ0lDQWdJR052YjJ0cFpTNXdkWE5vS0c1aGJXVWdLeUFuUFNjZ0t5QmxibU52WkdWVlVrbERiMjF3YjI1bGJuUW9kbUZzZFdVcEtUdGNibHh1SUNBZ0lDQWdJQ0JwWmlBb2RYUnBiSE11YVhOT2RXMWlaWElvWlhod2FYSmxjeWtwSUh0Y2JpQWdJQ0FnSUNBZ0lDQmpiMjlyYVdVdWNIVnphQ2duWlhod2FYSmxjejBuSUNzZ2JtVjNJRVJoZEdVb1pYaHdhWEpsY3lrdWRHOUhUVlJUZEhKcGJtY29LU2s3WEc0Z0lDQWdJQ0FnSUgxY2JseHVJQ0FnSUNBZ0lDQnBaaUFvZFhScGJITXVhWE5UZEhKcGJtY29jR0YwYUNrcElIdGNiaUFnSUNBZ0lDQWdJQ0JqYjI5cmFXVXVjSFZ6YUNnbmNHRjBhRDBuSUNzZ2NHRjBhQ2s3WEc0Z0lDQWdJQ0FnSUgxY2JseHVJQ0FnSUNBZ0lDQnBaaUFvZFhScGJITXVhWE5UZEhKcGJtY29aRzl0WVdsdUtTa2dlMXh1SUNBZ0lDQWdJQ0FnSUdOdmIydHBaUzV3ZFhOb0tDZGtiMjFoYVc0OUp5QXJJR1J2YldGcGJpazdYRzRnSUNBZ0lDQWdJSDFjYmx4dUlDQWdJQ0FnSUNCcFppQW9jMlZqZFhKbElEMDlQU0IwY25WbEtTQjdYRzRnSUNBZ0lDQWdJQ0FnWTI5dmEybGxMbkIxYzJnb0ozTmxZM1Z5WlNjcE8xeHVJQ0FnSUNBZ0lDQjlYRzVjYmlBZ0lDQWdJQ0FnWkc5amRXMWxiblF1WTI5dmEybGxJRDBnWTI5dmEybGxMbXB2YVc0b0p6c2dKeWs3WEc0Z0lDQWdJQ0I5TEZ4dVhHNGdJQ0FnSUNCeVpXRmtPaUJtZFc1amRHbHZiaUJ5WldGa0tHNWhiV1VwSUh0Y2JpQWdJQ0FnSUNBZ2RtRnlJRzFoZEdOb0lEMGdaRzlqZFcxbGJuUXVZMjl2YTJsbExtMWhkR05vS0c1bGR5QlNaV2RGZUhBb0p5aGVmRHRjWEZ4Y2N5b3BLQ2NnS3lCdVlXMWxJQ3NnSnlrOUtGdGVPMTBxS1NjcEtUdGNiaUFnSUNBZ0lDQWdjbVYwZFhKdUlDaHRZWFJqYUNBL0lHUmxZMjlrWlZWU1NVTnZiWEJ2Ym1WdWRDaHRZWFJqYUZzelhTa2dPaUJ1ZFd4c0tUdGNiaUFnSUNBZ0lIMHNYRzVjYmlBZ0lDQWdJSEpsYlc5MlpUb2dablZ1WTNScGIyNGdjbVZ0YjNabEtHNWhiV1VwSUh0Y2JpQWdJQ0FnSUNBZ2RHaHBjeTUzY21sMFpTaHVZVzFsTENBbkp5d2dSR0YwWlM1dWIzY29LU0F0SURnMk5EQXdNREF3S1R0Y2JpQWdJQ0FnSUgxY2JpQWdJQ0I5TzF4dUlDQjlLU2dwSURwY2JseHVJQ0F2THlCT2IyNGdjM1JoYm1SaGNtUWdZbkp2ZDNObGNpQmxibllnS0hkbFlpQjNiM0pyWlhKekxDQnlaV0ZqZEMxdVlYUnBkbVVwSUd4aFkyc2dibVZsWkdWa0lITjFjSEJ2Y25RdVhHNGdJQ2htZFc1amRHbHZiaUJ1YjI1VGRHRnVaR0Z5WkVKeWIzZHpaWEpGYm5Zb0tTQjdYRzRnSUNBZ2NtVjBkWEp1SUh0Y2JpQWdJQ0FnSUhkeWFYUmxPaUJtZFc1amRHbHZiaUIzY21sMFpTZ3BJSHQ5TEZ4dUlDQWdJQ0FnY21WaFpEb2dablZ1WTNScGIyNGdjbVZoWkNncElIc2djbVYwZFhKdUlHNTFiR3c3SUgwc1hHNGdJQ0FnSUNCeVpXMXZkbVU2SUdaMWJtTjBhVzl1SUhKbGJXOTJaU2dwSUh0OVhHNGdJQ0FnZlR0Y2JpQWdmU2tvS1Z4dUtUdGNiaUlzSWlkMWMyVWdjM1J5YVdOMEp6dGNibHh1THlvcVhHNGdLaUJFWlhSbGNtMXBibVZ6SUhkb1pYUm9aWElnZEdobElITndaV05wWm1sbFpDQlZVa3dnYVhNZ1lXSnpiMngxZEdWY2JpQXFYRzRnS2lCQWNHRnlZVzBnZTNOMGNtbHVaMzBnZFhKc0lGUm9aU0JWVWt3Z2RHOGdkR1Z6ZEZ4dUlDb2dRSEpsZEhWeWJuTWdlMkp2YjJ4bFlXNTlJRlJ5ZFdVZ2FXWWdkR2hsSUhOd1pXTnBabWxsWkNCVlVrd2dhWE1nWVdKemIyeDFkR1VzSUc5MGFHVnlkMmx6WlNCbVlXeHpaVnh1SUNvdlhHNXRiMlIxYkdVdVpYaHdiM0owY3lBOUlHWjFibU4wYVc5dUlHbHpRV0p6YjJ4MWRHVlZVa3dvZFhKc0tTQjdYRzRnSUM4dklFRWdWVkpNSUdseklHTnZibk5wWkdWeVpXUWdZV0p6YjJ4MWRHVWdhV1lnYVhRZ1ltVm5hVzV6SUhkcGRHZ2dYQ0k4YzJOb1pXMWxQam92TDF3aUlHOXlJRndpTHk5Y0lpQW9jSEp2ZEc5amIyd3RjbVZzWVhScGRtVWdWVkpNS1M1Y2JpQWdMeThnVWtaRElETTVPRFlnWkdWbWFXNWxjeUJ6WTJobGJXVWdibUZ0WlNCaGN5QmhJSE5sY1hWbGJtTmxJRzltSUdOb1lYSmhZM1JsY25NZ1ltVm5hVzV1YVc1bklIZHBkR2dnWVNCc1pYUjBaWElnWVc1a0lHWnZiR3h2ZDJWa1hHNGdJQzh2SUdKNUlHRnVlU0JqYjIxaWFXNWhkR2x2YmlCdlppQnNaWFIwWlhKekxDQmthV2RwZEhNc0lIQnNkWE1zSUhCbGNtbHZaQ3dnYjNJZ2FIbHdhR1Z1TGx4dUlDQnlaWFIxY200Z0wxNG9XMkV0ZWwxYllTMTZYRnhrWEZ3clhGd3RYRnd1WFNvNktUOWNYQzljWEM4dmFTNTBaWE4wS0hWeWJDazdYRzU5TzF4dUlpd2lKM1Z6WlNCemRISnBZM1FuTzF4dVhHNTJZWElnZFhScGJITWdQU0J5WlhGMWFYSmxLQ2N1THk0dUwzVjBhV3h6SnlrN1hHNWNibTF2WkhWc1pTNWxlSEJ2Y25SeklEMGdLRnh1SUNCMWRHbHNjeTVwYzFOMFlXNWtZWEprUW5KdmQzTmxja1Z1ZGlncElEOWNibHh1SUNBdkx5QlRkR0Z1WkdGeVpDQmljbTkzYzJWeUlHVnVkbk1nYUdGMlpTQm1kV3hzSUhOMWNIQnZjblFnYjJZZ2RHaGxJRUZRU1hNZ2JtVmxaR1ZrSUhSdklIUmxjM1JjYmlBZ0x5OGdkMmhsZEdobGNpQjBhR1VnY21WeGRXVnpkQ0JWVWt3Z2FYTWdiMllnZEdobElITmhiV1VnYjNKcFoybHVJR0Z6SUdOMWNuSmxiblFnYkc5allYUnBiMjR1WEc0Z0lDaG1kVzVqZEdsdmJpQnpkR0Z1WkdGeVpFSnliM2R6WlhKRmJuWW9LU0I3WEc0Z0lDQWdkbUZ5SUcxemFXVWdQU0F2S0cxemFXVjhkSEpwWkdWdWRDa3ZhUzUwWlhOMEtHNWhkbWxuWVhSdmNpNTFjMlZ5UVdkbGJuUXBPMXh1SUNBZ0lIWmhjaUIxY214UVlYSnphVzVuVG05a1pTQTlJR1J2WTNWdFpXNTBMbU55WldGMFpVVnNaVzFsYm5Rb0oyRW5LVHRjYmlBZ0lDQjJZWElnYjNKcFoybHVWVkpNTzF4dVhHNGdJQ0FnTHlvcVhHNGdJQ0FnS2lCUVlYSnpaU0JoSUZWU1RDQjBieUJrYVhOamIzWmxjaUJwZENkeklHTnZiWEJ2Ym1WdWRITmNiaUFnSUNBcVhHNGdJQ0FnS2lCQWNHRnlZVzBnZTFOMGNtbHVaMzBnZFhKc0lGUm9aU0JWVWt3Z2RHOGdZbVVnY0dGeWMyVmtYRzRnSUNBZ0tpQkFjbVYwZFhKdWN5QjdUMkpxWldOMGZWeHVJQ0FnSUNvdlhHNGdJQ0FnWm5WdVkzUnBiMjRnY21WemIyeDJaVlZTVENoMWNtd3BJSHRjYmlBZ0lDQWdJSFpoY2lCb2NtVm1JRDBnZFhKc08xeHVYRzRnSUNBZ0lDQnBaaUFvYlhOcFpTa2dlMXh1SUNBZ0lDQWdJQ0F2THlCSlJTQnVaV1ZrY3lCaGRIUnlhV0oxZEdVZ2MyVjBJSFIzYVdObElIUnZJRzV2Y20xaGJHbDZaU0J3Y205d1pYSjBhV1Z6WEc0Z0lDQWdJQ0FnSUhWeWJGQmhjbk5wYm1kT2IyUmxMbk5sZEVGMGRISnBZblYwWlNnbmFISmxaaWNzSUdoeVpXWXBPMXh1SUNBZ0lDQWdJQ0JvY21WbUlEMGdkWEpzVUdGeWMybHVaMDV2WkdVdWFISmxaanRjYmlBZ0lDQWdJSDFjYmx4dUlDQWdJQ0FnZFhKc1VHRnljMmx1WjA1dlpHVXVjMlYwUVhSMGNtbGlkWFJsS0Nkb2NtVm1KeXdnYUhKbFppazdYRzVjYmlBZ0lDQWdJQzh2SUhWeWJGQmhjbk5wYm1kT2IyUmxJSEJ5YjNacFpHVnpJSFJvWlNCVmNteFZkR2xzY3lCcGJuUmxjbVpoWTJVZ0xTQm9kSFJ3T2k4dmRYSnNMbk53WldNdWQyaGhkSGRuTG05eVp5OGpkWEpzZFhScGJITmNiaUFnSUNBZ0lISmxkSFZ5YmlCN1hHNGdJQ0FnSUNBZ0lHaHlaV1k2SUhWeWJGQmhjbk5wYm1kT2IyUmxMbWh5WldZc1hHNGdJQ0FnSUNBZ0lIQnliM1J2WTI5c09pQjFjbXhRWVhKemFXNW5UbTlrWlM1d2NtOTBiMk52YkNBL0lIVnliRkJoY25OcGJtZE9iMlJsTG5CeWIzUnZZMjlzTG5KbGNHeGhZMlVvTHpva0x5d2dKeWNwSURvZ0p5Y3NYRzRnSUNBZ0lDQWdJR2h2YzNRNklIVnliRkJoY25OcGJtZE9iMlJsTG1odmMzUXNYRzRnSUNBZ0lDQWdJSE5sWVhKamFEb2dkWEpzVUdGeWMybHVaMDV2WkdVdWMyVmhjbU5vSUQ4Z2RYSnNVR0Z5YzJsdVowNXZaR1V1YzJWaGNtTm9MbkpsY0d4aFkyVW9MMTVjWEQ4dkxDQW5KeWtnT2lBbkp5eGNiaUFnSUNBZ0lDQWdhR0Z6YURvZ2RYSnNVR0Z5YzJsdVowNXZaR1V1YUdGemFDQS9JSFZ5YkZCaGNuTnBibWRPYjJSbExtaGhjMmd1Y21Wd2JHRmpaU2d2WGlNdkxDQW5KeWtnT2lBbkp5eGNiaUFnSUNBZ0lDQWdhRzl6ZEc1aGJXVTZJSFZ5YkZCaGNuTnBibWRPYjJSbExtaHZjM1J1WVcxbExGeHVJQ0FnSUNBZ0lDQndiM0owT2lCMWNteFFZWEp6YVc1blRtOWtaUzV3YjNKMExGeHVJQ0FnSUNBZ0lDQndZWFJvYm1GdFpUb2dLSFZ5YkZCaGNuTnBibWRPYjJSbExuQmhkR2h1WVcxbExtTm9ZWEpCZENnd0tTQTlQVDBnSnk4bktTQS9YRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0IxY214UVlYSnphVzVuVG05a1pTNXdZWFJvYm1GdFpTQTZYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FuTHljZ0t5QjFjbXhRWVhKemFXNW5UbTlrWlM1d1lYUm9ibUZ0WlZ4dUlDQWdJQ0FnZlR0Y2JpQWdJQ0I5WEc1Y2JpQWdJQ0J2Y21sbmFXNVZVa3dnUFNCeVpYTnZiSFpsVlZKTUtIZHBibVJ2ZHk1c2IyTmhkR2x2Ymk1b2NtVm1LVHRjYmx4dUlDQWdJQzhxS2x4dUlDQWdJQ29nUkdWMFpYSnRhVzVsSUdsbUlHRWdWVkpNSUhOb1lYSmxjeUIwYUdVZ2MyRnRaU0J2Y21sbmFXNGdZWE1nZEdobElHTjFjbkpsYm5RZ2JHOWpZWFJwYjI1Y2JpQWdJQ0FxWEc0Z0lDQWdLaUJBY0dGeVlXMGdlMU4wY21sdVozMGdjbVZ4ZFdWemRGVlNUQ0JVYUdVZ1ZWSk1JSFJ2SUhSbGMzUmNiaUFnSUNBcUlFQnlaWFIxY201eklIdGliMjlzWldGdWZTQlVjblZsSUdsbUlGVlNUQ0J6YUdGeVpYTWdkR2hsSUhOaGJXVWdiM0pwWjJsdUxDQnZkR2hsY25kcGMyVWdabUZzYzJWY2JpQWdJQ0FxTDF4dUlDQWdJSEpsZEhWeWJpQm1kVzVqZEdsdmJpQnBjMVZTVEZOaGJXVlBjbWxuYVc0b2NtVnhkV1Z6ZEZWU1RDa2dlMXh1SUNBZ0lDQWdkbUZ5SUhCaGNuTmxaQ0E5SUNoMWRHbHNjeTVwYzFOMGNtbHVaeWh5WlhGMVpYTjBWVkpNS1NrZ1B5QnlaWE52YkhabFZWSk1LSEpsY1hWbGMzUlZVa3dwSURvZ2NtVnhkV1Z6ZEZWU1REdGNiaUFnSUNBZ0lISmxkSFZ5YmlBb2NHRnljMlZrTG5CeWIzUnZZMjlzSUQwOVBTQnZjbWxuYVc1VlVrd3VjSEp2ZEc5amIyd2dKaVpjYmlBZ0lDQWdJQ0FnSUNBZ0lIQmhjbk5sWkM1b2IzTjBJRDA5UFNCdmNtbG5hVzVWVWt3dWFHOXpkQ2s3WEc0Z0lDQWdmVHRjYmlBZ2ZTa29LU0E2WEc1Y2JpQWdMeThnVG05dUlITjBZVzVrWVhKa0lHSnliM2R6WlhJZ1pXNTJjeUFvZDJWaUlIZHZjbXRsY25Nc0lISmxZV04wTFc1aGRHbDJaU2tnYkdGamF5QnVaV1ZrWldRZ2MzVndjRzl5ZEM1Y2JpQWdLR1oxYm1OMGFXOXVJRzV2YmxOMFlXNWtZWEprUW5KdmQzTmxja1Z1ZGlncElIdGNiaUFnSUNCeVpYUjFjbTRnWm5WdVkzUnBiMjRnYVhOVlVreFRZVzFsVDNKcFoybHVLQ2tnZTF4dUlDQWdJQ0FnY21WMGRYSnVJSFJ5ZFdVN1hHNGdJQ0FnZlR0Y2JpQWdmU2tvS1Z4dUtUdGNiaUlzSWlkMWMyVWdjM1J5YVdOMEp6dGNibHh1ZG1GeUlIVjBhV3h6SUQwZ2NtVnhkV2x5WlNnbkxpNHZkWFJwYkhNbktUdGNibHh1Ylc5a2RXeGxMbVY0Y0c5eWRITWdQU0JtZFc1amRHbHZiaUJ1YjNKdFlXeHBlbVZJWldGa1pYSk9ZVzFsS0dobFlXUmxjbk1zSUc1dmNtMWhiR2w2WldST1lXMWxLU0I3WEc0Z0lIVjBhV3h6TG1admNrVmhZMmdvYUdWaFpHVnljeXdnWm5WdVkzUnBiMjRnY0hKdlkyVnpjMGhsWVdSbGNpaDJZV3gxWlN3Z2JtRnRaU2tnZTF4dUlDQWdJR2xtSUNodVlXMWxJQ0U5UFNCdWIzSnRZV3hwZW1Wa1RtRnRaU0FtSmlCdVlXMWxMblJ2VlhCd1pYSkRZWE5sS0NrZ1BUMDlJRzV2Y20xaGJHbDZaV1JPWVcxbExuUnZWWEJ3WlhKRFlYTmxLQ2twSUh0Y2JpQWdJQ0FnSUdobFlXUmxjbk5iYm05eWJXRnNhWHBsWkU1aGJXVmRJRDBnZG1Gc2RXVTdYRzRnSUNBZ0lDQmtaV3hsZEdVZ2FHVmhaR1Z5YzF0dVlXMWxYVHRjYmlBZ0lDQjlYRzRnSUgwcE8xeHVmVHRjYmlJc0lpZDFjMlVnYzNSeWFXTjBKenRjYmx4dWRtRnlJSFYwYVd4eklEMGdjbVZ4ZFdseVpTZ25MaTh1TGk5MWRHbHNjeWNwTzF4dVhHNHZLaXBjYmlBcUlGQmhjbk5sSUdobFlXUmxjbk1nYVc1MGJ5QmhiaUJ2WW1wbFkzUmNiaUFxWEc0Z0tpQmdZR0JjYmlBcUlFUmhkR1U2SUZkbFpDd2dNamNnUVhWbklESXdNVFFnTURnNk5UZzZORGtnUjAxVVhHNGdLaUJEYjI1MFpXNTBMVlI1Y0dVNklHRndjR3hwWTJGMGFXOXVMMnB6YjI1Y2JpQXFJRU52Ym01bFkzUnBiMjQ2SUd0bFpYQXRZV3hwZG1WY2JpQXFJRlJ5WVc1elptVnlMVVZ1WTI5a2FXNW5PaUJqYUhWdWEyVmtYRzRnS2lCZ1lHQmNiaUFxWEc0Z0tpQkFjR0Z5WVcwZ2UxTjBjbWx1WjMwZ2FHVmhaR1Z5Y3lCSVpXRmtaWEp6SUc1bFpXUnBibWNnZEc4Z1ltVWdjR0Z5YzJWa1hHNGdLaUJBY21WMGRYSnVjeUI3VDJKcVpXTjBmU0JJWldGa1pYSnpJSEJoY25ObFpDQnBiblJ2SUdGdUlHOWlhbVZqZEZ4dUlDb3ZYRzV0YjJSMWJHVXVaWGh3YjNKMGN5QTlJR1oxYm1OMGFXOXVJSEJoY25ObFNHVmhaR1Z5Y3lob1pXRmtaWEp6S1NCN1hHNGdJSFpoY2lCd1lYSnpaV1FnUFNCN2ZUdGNiaUFnZG1GeUlHdGxlVHRjYmlBZ2RtRnlJSFpoYkR0Y2JpQWdkbUZ5SUdrN1hHNWNiaUFnYVdZZ0tDRm9aV0ZrWlhKektTQjdJSEpsZEhWeWJpQndZWEp6WldRN0lIMWNibHh1SUNCMWRHbHNjeTVtYjNKRllXTm9LR2hsWVdSbGNuTXVjM0JzYVhRb0oxeGNiaWNwTENCbWRXNWpkR2x2YmlCd1lYSnpaWElvYkdsdVpTa2dlMXh1SUNBZ0lHa2dQU0JzYVc1bExtbHVaR1Y0VDJZb0p6b25LVHRjYmlBZ0lDQnJaWGtnUFNCMWRHbHNjeTUwY21sdEtHeHBibVV1YzNWaWMzUnlLREFzSUdrcEtTNTBiMHh2ZDJWeVEyRnpaU2dwTzF4dUlDQWdJSFpoYkNBOUlIVjBhV3h6TG5SeWFXMG9iR2x1WlM1emRXSnpkSElvYVNBcklERXBLVHRjYmx4dUlDQWdJR2xtSUNoclpYa3BJSHRjYmlBZ0lDQWdJSEJoY25ObFpGdHJaWGxkSUQwZ2NHRnljMlZrVzJ0bGVWMGdQeUJ3WVhKelpXUmJhMlY1WFNBcklDY3NJQ2NnS3lCMllXd2dPaUIyWVd3N1hHNGdJQ0FnZlZ4dUlDQjlLVHRjYmx4dUlDQnlaWFIxY200Z2NHRnljMlZrTzF4dWZUdGNiaUlzSWlkMWMyVWdjM1J5YVdOMEp6dGNibHh1THlvcVhHNGdLaUJUZVc1MFlXTjBhV01nYzNWbllYSWdabTl5SUdsdWRtOXJhVzVuSUdFZ1puVnVZM1JwYjI0Z1lXNWtJR1Y0Y0dGdVpHbHVaeUJoYmlCaGNuSmhlU0JtYjNJZ1lYSm5kVzFsYm5SekxseHVJQ3BjYmlBcUlFTnZiVzF2YmlCMWMyVWdZMkZ6WlNCM2IzVnNaQ0JpWlNCMGJ5QjFjMlVnWUVaMWJtTjBhVzl1TG5CeWIzUnZkSGx3WlM1aGNIQnNlV0F1WEc0Z0tseHVJQ29nSUdCZ1lHcHpYRzRnS2lBZ1puVnVZM1JwYjI0Z1ppaDRMQ0I1TENCNktTQjdmVnh1SUNvZ0lIWmhjaUJoY21keklEMGdXekVzSURJc0lETmRPMXh1SUNvZ0lHWXVZWEJ3Ykhrb2JuVnNiQ3dnWVhKbmN5azdYRzRnS2lBZ1lHQmdYRzRnS2x4dUlDb2dWMmwwYUNCZ2MzQnlaV0ZrWUNCMGFHbHpJR1Y0WVcxd2JHVWdZMkZ1SUdKbElISmxMWGR5YVhSMFpXNHVYRzRnS2x4dUlDb2dJR0JnWUdwelhHNGdLaUFnYzNCeVpXRmtLR1oxYm1OMGFXOXVLSGdzSUhrc0lIb3BJSHQ5S1NoYk1Td2dNaXdnTTEwcE8xeHVJQ29nSUdCZ1lGeHVJQ3BjYmlBcUlFQndZWEpoYlNCN1JuVnVZM1JwYjI1OUlHTmhiR3hpWVdOclhHNGdLaUJBY21WMGRYSnVjeUI3Um5WdVkzUnBiMjU5WEc0Z0tpOWNibTF2WkhWc1pTNWxlSEJ2Y25SeklEMGdablZ1WTNScGIyNGdjM0J5WldGa0tHTmhiR3hpWVdOcktTQjdYRzRnSUhKbGRIVnliaUJtZFc1amRHbHZiaUIzY21Gd0tHRnljaWtnZTF4dUlDQWdJSEpsZEhWeWJpQmpZV3hzWW1GamF5NWhjSEJzZVNodWRXeHNMQ0JoY25JcE8xeHVJQ0I5TzF4dWZUdGNiaUlzSWlkMWMyVWdjM1J5YVdOMEp6dGNibHh1ZG1GeUlHSnBibVFnUFNCeVpYRjFhWEpsS0NjdUwyaGxiSEJsY25NdlltbHVaQ2NwTzF4dWRtRnlJR2x6UW5WbVptVnlJRDBnY21WeGRXbHlaU2duYVhNdFluVm1abVZ5SnlrN1hHNWNiaThxWjJ4dlltRnNJSFJ2VTNSeWFXNW5PblJ5ZFdVcUwxeHVYRzR2THlCMWRHbHNjeUJwY3lCaElHeHBZbkpoY25rZ2IyWWdaMlZ1WlhKcFl5Qm9aV3h3WlhJZ1puVnVZM1JwYjI1eklHNXZiaTF6Y0dWamFXWnBZeUIwYnlCaGVHbHZjMXh1WEc1MllYSWdkRzlUZEhKcGJtY2dQU0JQWW1wbFkzUXVjSEp2ZEc5MGVYQmxMblJ2VTNSeWFXNW5PMXh1WEc0dktpcGNiaUFxSUVSbGRHVnliV2x1WlNCcFppQmhJSFpoYkhWbElHbHpJR0Z1SUVGeWNtRjVYRzRnS2x4dUlDb2dRSEJoY21GdElIdFBZbXBsWTNSOUlIWmhiQ0JVYUdVZ2RtRnNkV1VnZEc4Z2RHVnpkRnh1SUNvZ1FISmxkSFZ5Ym5NZ2UySnZiMnhsWVc1OUlGUnlkV1VnYVdZZ2RtRnNkV1VnYVhNZ1lXNGdRWEp5WVhrc0lHOTBhR1Z5ZDJselpTQm1ZV3h6WlZ4dUlDb3ZYRzVtZFc1amRHbHZiaUJwYzBGeWNtRjVLSFpoYkNrZ2UxeHVJQ0J5WlhSMWNtNGdkRzlUZEhKcGJtY3VZMkZzYkNoMllXd3BJRDA5UFNBblcyOWlhbVZqZENCQmNuSmhlVjBuTzF4dWZWeHVYRzR2S2lwY2JpQXFJRVJsZEdWeWJXbHVaU0JwWmlCaElIWmhiSFZsSUdseklHRnVJRUZ5Y21GNVFuVm1abVZ5WEc0Z0tseHVJQ29nUUhCaGNtRnRJSHRQWW1wbFkzUjlJSFpoYkNCVWFHVWdkbUZzZFdVZ2RHOGdkR1Z6ZEZ4dUlDb2dRSEpsZEhWeWJuTWdlMkp2YjJ4bFlXNTlJRlJ5ZFdVZ2FXWWdkbUZzZFdVZ2FYTWdZVzRnUVhKeVlYbENkV1ptWlhJc0lHOTBhR1Z5ZDJselpTQm1ZV3h6WlZ4dUlDb3ZYRzVtZFc1amRHbHZiaUJwYzBGeWNtRjVRblZtWm1WeUtIWmhiQ2tnZTF4dUlDQnlaWFIxY200Z2RHOVRkSEpwYm1jdVkyRnNiQ2gyWVd3cElEMDlQU0FuVzI5aWFtVmpkQ0JCY25KaGVVSjFabVpsY2wwbk8xeHVmVnh1WEc0dktpcGNiaUFxSUVSbGRHVnliV2x1WlNCcFppQmhJSFpoYkhWbElHbHpJR0VnUm05eWJVUmhkR0ZjYmlBcVhHNGdLaUJBY0dGeVlXMGdlMDlpYW1WamRIMGdkbUZzSUZSb1pTQjJZV3gxWlNCMGJ5QjBaWE4wWEc0Z0tpQkFjbVYwZFhKdWN5QjdZbTl2YkdWaGJuMGdWSEoxWlNCcFppQjJZV3gxWlNCcGN5QmhiaUJHYjNKdFJHRjBZU3dnYjNSb1pYSjNhWE5sSUdaaGJITmxYRzRnS2k5Y2JtWjFibU4wYVc5dUlHbHpSbTl5YlVSaGRHRW9kbUZzS1NCN1hHNGdJSEpsZEhWeWJpQW9kSGx3Wlc5bUlFWnZjbTFFWVhSaElDRTlQU0FuZFc1a1pXWnBibVZrSnlrZ0ppWWdLSFpoYkNCcGJuTjBZVzVqWlc5bUlFWnZjbTFFWVhSaEtUdGNibjFjYmx4dUx5b3FYRzRnS2lCRVpYUmxjbTFwYm1VZ2FXWWdZU0IyWVd4MVpTQnBjeUJoSUhacFpYY2diMjRnWVc0Z1FYSnlZWGxDZFdabVpYSmNiaUFxWEc0Z0tpQkFjR0Z5WVcwZ2UwOWlhbVZqZEgwZ2RtRnNJRlJvWlNCMllXeDFaU0IwYnlCMFpYTjBYRzRnS2lCQWNtVjBkWEp1Y3lCN1ltOXZiR1ZoYm4wZ1ZISjFaU0JwWmlCMllXeDFaU0JwY3lCaElIWnBaWGNnYjI0Z1lXNGdRWEp5WVhsQ2RXWm1aWElzSUc5MGFHVnlkMmx6WlNCbVlXeHpaVnh1SUNvdlhHNW1kVzVqZEdsdmJpQnBjMEZ5Y21GNVFuVm1abVZ5Vm1sbGR5aDJZV3dwSUh0Y2JpQWdkbUZ5SUhKbGMzVnNkRHRjYmlBZ2FXWWdLQ2gwZVhCbGIyWWdRWEp5WVhsQ2RXWm1aWElnSVQwOUlDZDFibVJsWm1sdVpXUW5LU0FtSmlBb1FYSnlZWGxDZFdabVpYSXVhWE5XYVdWM0tTa2dlMXh1SUNBZ0lISmxjM1ZzZENBOUlFRnljbUY1UW5WbVptVnlMbWx6Vm1sbGR5aDJZV3dwTzF4dUlDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUhKbGMzVnNkQ0E5SUNoMllXd3BJQ1ltSUNoMllXd3VZblZtWm1WeUtTQW1KaUFvZG1Gc0xtSjFabVpsY2lCcGJuTjBZVzVqWlc5bUlFRnljbUY1UW5WbVptVnlLVHRjYmlBZ2ZWeHVJQ0J5WlhSMWNtNGdjbVZ6ZFd4ME8xeHVmVnh1WEc0dktpcGNiaUFxSUVSbGRHVnliV2x1WlNCcFppQmhJSFpoYkhWbElHbHpJR0VnVTNSeWFXNW5YRzRnS2x4dUlDb2dRSEJoY21GdElIdFBZbXBsWTNSOUlIWmhiQ0JVYUdVZ2RtRnNkV1VnZEc4Z2RHVnpkRnh1SUNvZ1FISmxkSFZ5Ym5NZ2UySnZiMnhsWVc1OUlGUnlkV1VnYVdZZ2RtRnNkV1VnYVhNZ1lTQlRkSEpwYm1jc0lHOTBhR1Z5ZDJselpTQm1ZV3h6WlZ4dUlDb3ZYRzVtZFc1amRHbHZiaUJwYzFOMGNtbHVaeWgyWVd3cElIdGNiaUFnY21WMGRYSnVJSFI1Y0dWdlppQjJZV3dnUFQwOUlDZHpkSEpwYm1jbk8xeHVmVnh1WEc0dktpcGNiaUFxSUVSbGRHVnliV2x1WlNCcFppQmhJSFpoYkhWbElHbHpJR0VnVG5WdFltVnlYRzRnS2x4dUlDb2dRSEJoY21GdElIdFBZbXBsWTNSOUlIWmhiQ0JVYUdVZ2RtRnNkV1VnZEc4Z2RHVnpkRnh1SUNvZ1FISmxkSFZ5Ym5NZ2UySnZiMnhsWVc1OUlGUnlkV1VnYVdZZ2RtRnNkV1VnYVhNZ1lTQk9kVzFpWlhJc0lHOTBhR1Z5ZDJselpTQm1ZV3h6WlZ4dUlDb3ZYRzVtZFc1amRHbHZiaUJwYzA1MWJXSmxjaWgyWVd3cElIdGNiaUFnY21WMGRYSnVJSFI1Y0dWdlppQjJZV3dnUFQwOUlDZHVkVzFpWlhJbk8xeHVmVnh1WEc0dktpcGNiaUFxSUVSbGRHVnliV2x1WlNCcFppQmhJSFpoYkhWbElHbHpJSFZ1WkdWbWFXNWxaRnh1SUNwY2JpQXFJRUJ3WVhKaGJTQjdUMkpxWldOMGZTQjJZV3dnVkdobElIWmhiSFZsSUhSdklIUmxjM1JjYmlBcUlFQnlaWFIxY201eklIdGliMjlzWldGdWZTQlVjblZsSUdsbUlIUm9aU0IyWVd4MVpTQnBjeUIxYm1SbFptbHVaV1FzSUc5MGFHVnlkMmx6WlNCbVlXeHpaVnh1SUNvdlhHNW1kVzVqZEdsdmJpQnBjMVZ1WkdWbWFXNWxaQ2gyWVd3cElIdGNiaUFnY21WMGRYSnVJSFI1Y0dWdlppQjJZV3dnUFQwOUlDZDFibVJsWm1sdVpXUW5PMXh1ZlZ4dVhHNHZLaXBjYmlBcUlFUmxkR1Z5YldsdVpTQnBaaUJoSUhaaGJIVmxJR2x6SUdGdUlFOWlhbVZqZEZ4dUlDcGNiaUFxSUVCd1lYSmhiU0I3VDJKcVpXTjBmU0IyWVd3Z1ZHaGxJSFpoYkhWbElIUnZJSFJsYzNSY2JpQXFJRUJ5WlhSMWNtNXpJSHRpYjI5c1pXRnVmU0JVY25WbElHbG1JSFpoYkhWbElHbHpJR0Z1SUU5aWFtVmpkQ3dnYjNSb1pYSjNhWE5sSUdaaGJITmxYRzRnS2k5Y2JtWjFibU4wYVc5dUlHbHpUMkpxWldOMEtIWmhiQ2tnZTF4dUlDQnlaWFIxY200Z2RtRnNJQ0U5UFNCdWRXeHNJQ1ltSUhSNWNHVnZaaUIyWVd3Z1BUMDlJQ2R2WW1wbFkzUW5PMXh1ZlZ4dVhHNHZLaXBjYmlBcUlFUmxkR1Z5YldsdVpTQnBaaUJoSUhaaGJIVmxJR2x6SUdFZ1JHRjBaVnh1SUNwY2JpQXFJRUJ3WVhKaGJTQjdUMkpxWldOMGZTQjJZV3dnVkdobElIWmhiSFZsSUhSdklIUmxjM1JjYmlBcUlFQnlaWFIxY201eklIdGliMjlzWldGdWZTQlVjblZsSUdsbUlIWmhiSFZsSUdseklHRWdSR0YwWlN3Z2IzUm9aWEozYVhObElHWmhiSE5sWEc0Z0tpOWNibVoxYm1OMGFXOXVJR2x6UkdGMFpTaDJZV3dwSUh0Y2JpQWdjbVYwZFhKdUlIUnZVM1J5YVc1bkxtTmhiR3dvZG1Gc0tTQTlQVDBnSjF0dlltcGxZM1FnUkdGMFpWMG5PMXh1ZlZ4dVhHNHZLaXBjYmlBcUlFUmxkR1Z5YldsdVpTQnBaaUJoSUhaaGJIVmxJR2x6SUdFZ1JtbHNaVnh1SUNwY2JpQXFJRUJ3WVhKaGJTQjdUMkpxWldOMGZTQjJZV3dnVkdobElIWmhiSFZsSUhSdklIUmxjM1JjYmlBcUlFQnlaWFIxY201eklIdGliMjlzWldGdWZTQlVjblZsSUdsbUlIWmhiSFZsSUdseklHRWdSbWxzWlN3Z2IzUm9aWEozYVhObElHWmhiSE5sWEc0Z0tpOWNibVoxYm1OMGFXOXVJR2x6Um1sc1pTaDJZV3dwSUh0Y2JpQWdjbVYwZFhKdUlIUnZVM1J5YVc1bkxtTmhiR3dvZG1Gc0tTQTlQVDBnSjF0dlltcGxZM1FnUm1sc1pWMG5PMXh1ZlZ4dVhHNHZLaXBjYmlBcUlFUmxkR1Z5YldsdVpTQnBaaUJoSUhaaGJIVmxJR2x6SUdFZ1FteHZZbHh1SUNwY2JpQXFJRUJ3WVhKaGJTQjdUMkpxWldOMGZTQjJZV3dnVkdobElIWmhiSFZsSUhSdklIUmxjM1JjYmlBcUlFQnlaWFIxY201eklIdGliMjlzWldGdWZTQlVjblZsSUdsbUlIWmhiSFZsSUdseklHRWdRbXh2WWl3Z2IzUm9aWEozYVhObElHWmhiSE5sWEc0Z0tpOWNibVoxYm1OMGFXOXVJR2x6UW14dllpaDJZV3dwSUh0Y2JpQWdjbVYwZFhKdUlIUnZVM1J5YVc1bkxtTmhiR3dvZG1Gc0tTQTlQVDBnSjF0dlltcGxZM1FnUW14dllsMG5PMXh1ZlZ4dVhHNHZLaXBjYmlBcUlFUmxkR1Z5YldsdVpTQnBaaUJoSUhaaGJIVmxJR2x6SUdFZ1JuVnVZM1JwYjI1Y2JpQXFYRzRnS2lCQWNHRnlZVzBnZTA5aWFtVmpkSDBnZG1Gc0lGUm9aU0IyWVd4MVpTQjBieUIwWlhOMFhHNGdLaUJBY21WMGRYSnVjeUI3WW05dmJHVmhibjBnVkhKMVpTQnBaaUIyWVd4MVpTQnBjeUJoSUVaMWJtTjBhVzl1TENCdmRHaGxjbmRwYzJVZ1ptRnNjMlZjYmlBcUwxeHVablZ1WTNScGIyNGdhWE5HZFc1amRHbHZiaWgyWVd3cElIdGNiaUFnY21WMGRYSnVJSFJ2VTNSeWFXNW5MbU5oYkd3b2RtRnNLU0E5UFQwZ0oxdHZZbXBsWTNRZ1JuVnVZM1JwYjI1ZEp6dGNibjFjYmx4dUx5b3FYRzRnS2lCRVpYUmxjbTFwYm1VZ2FXWWdZU0IyWVd4MVpTQnBjeUJoSUZOMGNtVmhiVnh1SUNwY2JpQXFJRUJ3WVhKaGJTQjdUMkpxWldOMGZTQjJZV3dnVkdobElIWmhiSFZsSUhSdklIUmxjM1JjYmlBcUlFQnlaWFIxY201eklIdGliMjlzWldGdWZTQlVjblZsSUdsbUlIWmhiSFZsSUdseklHRWdVM1J5WldGdExDQnZkR2hsY25kcGMyVWdabUZzYzJWY2JpQXFMMXh1Wm5WdVkzUnBiMjRnYVhOVGRISmxZVzBvZG1Gc0tTQjdYRzRnSUhKbGRIVnliaUJwYzA5aWFtVmpkQ2gyWVd3cElDWW1JR2x6Um5WdVkzUnBiMjRvZG1Gc0xuQnBjR1VwTzF4dWZWeHVYRzR2S2lwY2JpQXFJRVJsZEdWeWJXbHVaU0JwWmlCaElIWmhiSFZsSUdseklHRWdWVkpNVTJWaGNtTm9VR0Z5WVcxeklHOWlhbVZqZEZ4dUlDcGNiaUFxSUVCd1lYSmhiU0I3VDJKcVpXTjBmU0IyWVd3Z1ZHaGxJSFpoYkhWbElIUnZJSFJsYzNSY2JpQXFJRUJ5WlhSMWNtNXpJSHRpYjI5c1pXRnVmU0JVY25WbElHbG1JSFpoYkhWbElHbHpJR0VnVlZKTVUyVmhjbU5vVUdGeVlXMXpJRzlpYW1WamRDd2diM1JvWlhKM2FYTmxJR1poYkhObFhHNGdLaTljYm1aMWJtTjBhVzl1SUdselZWSk1VMlZoY21Ob1VHRnlZVzF6S0haaGJDa2dlMXh1SUNCeVpYUjFjbTRnZEhsd1pXOW1JRlZTVEZObFlYSmphRkJoY21GdGN5QWhQVDBnSjNWdVpHVm1hVzVsWkNjZ0ppWWdkbUZzSUdsdWMzUmhibU5sYjJZZ1ZWSk1VMlZoY21Ob1VHRnlZVzF6TzF4dWZWeHVYRzR2S2lwY2JpQXFJRlJ5YVcwZ1pYaGpaWE56SUhkb2FYUmxjM0JoWTJVZ2IyWm1JSFJvWlNCaVpXZHBibTVwYm1jZ1lXNWtJR1Z1WkNCdlppQmhJSE4wY21sdVoxeHVJQ3BjYmlBcUlFQndZWEpoYlNCN1UzUnlhVzVuZlNCemRISWdWR2hsSUZOMGNtbHVaeUIwYnlCMGNtbHRYRzRnS2lCQWNtVjBkWEp1Y3lCN1UzUnlhVzVuZlNCVWFHVWdVM1J5YVc1bklHWnlaV1ZrSUc5bUlHVjRZMlZ6Y3lCM2FHbDBaWE53WVdObFhHNGdLaTljYm1aMWJtTjBhVzl1SUhSeWFXMG9jM1J5S1NCN1hHNGdJSEpsZEhWeWJpQnpkSEl1Y21Wd2JHRmpaU2d2WGx4Y2N5b3ZMQ0FuSnlrdWNtVndiR0ZqWlNndlhGeHpLaVF2TENBbkp5azdYRzU5WEc1Y2JpOHFLbHh1SUNvZ1JHVjBaWEp0YVc1bElHbG1JSGRsSjNKbElISjFibTVwYm1jZ2FXNGdZU0J6ZEdGdVpHRnlaQ0JpY205M2MyVnlJR1Z1ZG1seWIyNXRaVzUwWEc0Z0tseHVJQ29nVkdocGN5QmhiR3h2ZDNNZ1lYaHBiM01nZEc4Z2NuVnVJR2x1SUdFZ2QyVmlJSGR2Y210bGNpd2dZVzVrSUhKbFlXTjBMVzVoZEdsMlpTNWNiaUFxSUVKdmRHZ2daVzUyYVhKdmJtMWxiblJ6SUhOMWNIQnZjblFnV0UxTVNIUjBjRkpsY1hWbGMzUXNJR0oxZENCdWIzUWdablZzYkhrZ2MzUmhibVJoY21RZ1oyeHZZbUZzY3k1Y2JpQXFYRzRnS2lCM1pXSWdkMjl5YTJWeWN6cGNiaUFxSUNCMGVYQmxiMllnZDJsdVpHOTNJQzArSUhWdVpHVm1hVzVsWkZ4dUlDb2dJSFI1Y0dWdlppQmtiMk4xYldWdWRDQXRQaUIxYm1SbFptbHVaV1JjYmlBcVhHNGdLaUJ5WldGamRDMXVZWFJwZG1VNlhHNGdLaUFnYm1GMmFXZGhkRzl5TG5CeWIyUjFZM1FnTFQ0Z0oxSmxZV04wVG1GMGFYWmxKMXh1SUNvdlhHNW1kVzVqZEdsdmJpQnBjMU4wWVc1a1lYSmtRbkp2ZDNObGNrVnVkaWdwSUh0Y2JpQWdhV1lnS0hSNWNHVnZaaUJ1WVhacFoyRjBiM0lnSVQwOUlDZDFibVJsWm1sdVpXUW5JQ1ltSUc1aGRtbG5ZWFJ2Y2k1d2NtOWtkV04wSUQwOVBTQW5VbVZoWTNST1lYUnBkbVVuS1NCN1hHNGdJQ0FnY21WMGRYSnVJR1poYkhObE8xeHVJQ0I5WEc0Z0lISmxkSFZ5YmlBb1hHNGdJQ0FnZEhsd1pXOW1JSGRwYm1SdmR5QWhQVDBnSjNWdVpHVm1hVzVsWkNjZ0ppWmNiaUFnSUNCMGVYQmxiMllnWkc5amRXMWxiblFnSVQwOUlDZDFibVJsWm1sdVpXUW5YRzRnSUNrN1hHNTlYRzVjYmk4cUtseHVJQ29nU1hSbGNtRjBaU0J2ZG1WeUlHRnVJRUZ5Y21GNUlHOXlJR0Z1SUU5aWFtVmpkQ0JwYm5admEybHVaeUJoSUdaMWJtTjBhVzl1SUdadmNpQmxZV05vSUdsMFpXMHVYRzRnS2x4dUlDb2dTV1lnWUc5aWFtQWdhWE1nWVc0Z1FYSnlZWGtnWTJGc2JHSmhZMnNnZDJsc2JDQmlaU0JqWVd4c1pXUWdjR0Z6YzJsdVoxeHVJQ29nZEdobElIWmhiSFZsTENCcGJtUmxlQ3dnWVc1a0lHTnZiWEJzWlhSbElHRnljbUY1SUdadmNpQmxZV05vSUdsMFpXMHVYRzRnS2x4dUlDb2dTV1lnSjI5aWFpY2dhWE1nWVc0Z1QySnFaV04wSUdOaGJHeGlZV05ySUhkcGJHd2dZbVVnWTJGc2JHVmtJSEJoYzNOcGJtZGNiaUFxSUhSb1pTQjJZV3gxWlN3Z2EyVjVMQ0JoYm1RZ1kyOXRjR3hsZEdVZ2IySnFaV04wSUdadmNpQmxZV05vSUhCeWIzQmxjblI1TGx4dUlDcGNiaUFxSUVCd1lYSmhiU0I3VDJKcVpXTjBmRUZ5Y21GNWZTQnZZbW9nVkdobElHOWlhbVZqZENCMGJ5QnBkR1Z5WVhSbFhHNGdLaUJBY0dGeVlXMGdlMFoxYm1OMGFXOXVmU0JtYmlCVWFHVWdZMkZzYkdKaFkyc2dkRzhnYVc1MmIydGxJR1p2Y2lCbFlXTm9JR2wwWlcxY2JpQXFMMXh1Wm5WdVkzUnBiMjRnWm05eVJXRmphQ2h2WW1vc0lHWnVLU0I3WEc0Z0lDOHZJRVJ2YmlkMElHSnZkR2hsY2lCcFppQnVieUIyWVd4MVpTQndjbTkyYVdSbFpGeHVJQ0JwWmlBb2IySnFJRDA5UFNCdWRXeHNJSHg4SUhSNWNHVnZaaUJ2WW1vZ1BUMDlJQ2QxYm1SbFptbHVaV1FuS1NCN1hHNGdJQ0FnY21WMGRYSnVPMXh1SUNCOVhHNWNiaUFnTHk4Z1JtOXlZMlVnWVc0Z1lYSnlZWGtnYVdZZ2JtOTBJR0ZzY21WaFpIa2djMjl0WlhSb2FXNW5JR2wwWlhKaFlteGxYRzRnSUdsbUlDaDBlWEJsYjJZZ2IySnFJQ0U5UFNBbmIySnFaV04wSnlBbUppQWhhWE5CY25KaGVTaHZZbW9wS1NCN1hHNGdJQ0FnTHlwbGMyeHBiblFnYm04dGNHRnlZVzB0Y21WaGMzTnBaMjQ2TUNvdlhHNGdJQ0FnYjJKcUlEMGdXMjlpYWwwN1hHNGdJSDFjYmx4dUlDQnBaaUFvYVhOQmNuSmhlU2h2WW1vcEtTQjdYRzRnSUNBZ0x5OGdTWFJsY21GMFpTQnZkbVZ5SUdGeWNtRjVJSFpoYkhWbGMxeHVJQ0FnSUdadmNpQW9kbUZ5SUdrZ1BTQXdMQ0JzSUQwZ2IySnFMbXhsYm1kMGFEc2dhU0E4SUd3N0lHa3JLeWtnZTF4dUlDQWdJQ0FnWm00dVkyRnNiQ2h1ZFd4c0xDQnZZbXBiYVYwc0lHa3NJRzlpYWlrN1hHNGdJQ0FnZlZ4dUlDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUM4dklFbDBaWEpoZEdVZ2IzWmxjaUJ2WW1wbFkzUWdhMlY1YzF4dUlDQWdJR1p2Y2lBb2RtRnlJR3RsZVNCcGJpQnZZbW9wSUh0Y2JpQWdJQ0FnSUdsbUlDaFBZbXBsWTNRdWNISnZkRzkwZVhCbExtaGhjMDkzYmxCeWIzQmxjblI1TG1OaGJHd29iMkpxTENCclpYa3BLU0I3WEc0Z0lDQWdJQ0FnSUdadUxtTmhiR3dvYm5Wc2JDd2diMkpxVzJ0bGVWMHNJR3RsZVN3Z2IySnFLVHRjYmlBZ0lDQWdJSDFjYmlBZ0lDQjlYRzRnSUgxY2JuMWNibHh1THlvcVhHNGdLaUJCWTJObGNIUnpJSFpoY21GeVozTWdaWGh3WldOMGFXNW5JR1ZoWTJnZ1lYSm5kVzFsYm5RZ2RHOGdZbVVnWVc0Z2IySnFaV04wTENCMGFHVnVYRzRnS2lCcGJXMTFkR0ZpYkhrZ2JXVnlaMlZ6SUhSb1pTQndjbTl3WlhKMGFXVnpJRzltSUdWaFkyZ2diMkpxWldOMElHRnVaQ0J5WlhSMWNtNXpJSEpsYzNWc2RDNWNiaUFxWEc0Z0tpQlhhR1Z1SUcxMWJIUnBjR3hsSUc5aWFtVmpkSE1nWTI5dWRHRnBiaUIwYUdVZ2MyRnRaU0JyWlhrZ2RHaGxJR3hoZEdWeUlHOWlhbVZqZENCcGJseHVJQ29nZEdobElHRnlaM1Z0Wlc1MGN5QnNhWE4wSUhkcGJHd2dkR0ZyWlNCd2NtVmpaV1JsYm1ObExseHVJQ3BjYmlBcUlFVjRZVzF3YkdVNlhHNGdLbHh1SUNvZ1lHQmdhbk5jYmlBcUlIWmhjaUJ5WlhOMWJIUWdQU0J0WlhKblpTaDdabTl2T2lBeE1qTjlMQ0I3Wm05dk9pQTBOVFo5S1R0Y2JpQXFJR052Ym5OdmJHVXViRzluS0hKbGMzVnNkQzVtYjI4cE95QXZMeUJ2ZFhSd2RYUnpJRFExTmx4dUlDb2dZR0JnWEc0Z0tseHVJQ29nUUhCaGNtRnRJSHRQWW1wbFkzUjlJRzlpYWpFZ1QySnFaV04wSUhSdklHMWxjbWRsWEc0Z0tpQkFjbVYwZFhKdWN5QjdUMkpxWldOMGZTQlNaWE4xYkhRZ2IyWWdZV3hzSUcxbGNtZGxJSEJ5YjNCbGNuUnBaWE5jYmlBcUwxeHVablZ1WTNScGIyNGdiV1Z5WjJVb0x5b2diMkpxTVN3Z2IySnFNaXdnYjJKcU15d2dMaTR1SUNvdktTQjdYRzRnSUhaaGNpQnlaWE4xYkhRZ1BTQjdmVHRjYmlBZ1puVnVZM1JwYjI0Z1lYTnphV2R1Vm1Gc2RXVW9kbUZzTENCclpYa3BJSHRjYmlBZ0lDQnBaaUFvZEhsd1pXOW1JSEpsYzNWc2RGdHJaWGxkSUQwOVBTQW5iMkpxWldOMEp5QW1KaUIwZVhCbGIyWWdkbUZzSUQwOVBTQW5iMkpxWldOMEp5a2dlMXh1SUNBZ0lDQWdjbVZ6ZFd4MFcydGxlVjBnUFNCdFpYSm5aU2h5WlhOMWJIUmJhMlY1WFN3Z2RtRnNLVHRjYmlBZ0lDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUNBZ2NtVnpkV3gwVzJ0bGVWMGdQU0IyWVd3N1hHNGdJQ0FnZlZ4dUlDQjlYRzVjYmlBZ1ptOXlJQ2gyWVhJZ2FTQTlJREFzSUd3Z1BTQmhjbWQxYldWdWRITXViR1Z1WjNSb095QnBJRHdnYkRzZ2FTc3JLU0I3WEc0Z0lDQWdabTl5UldGamFDaGhjbWQxYldWdWRITmJhVjBzSUdGemMybG5ibFpoYkhWbEtUdGNiaUFnZlZ4dUlDQnlaWFIxY200Z2NtVnpkV3gwTzF4dWZWeHVYRzR2S2lwY2JpQXFJRVY0ZEdWdVpITWdiMkpxWldOMElHRWdZbmtnYlhWMFlXSnNlU0JoWkdScGJtY2dkRzhnYVhRZ2RHaGxJSEJ5YjNCbGNuUnBaWE1nYjJZZ2IySnFaV04wSUdJdVhHNGdLbHh1SUNvZ1FIQmhjbUZ0SUh0UFltcGxZM1I5SUdFZ1ZHaGxJRzlpYW1WamRDQjBieUJpWlNCbGVIUmxibVJsWkZ4dUlDb2dRSEJoY21GdElIdFBZbXBsWTNSOUlHSWdWR2hsSUc5aWFtVmpkQ0IwYnlCamIzQjVJSEJ5YjNCbGNuUnBaWE1nWm5KdmJWeHVJQ29nUUhCaGNtRnRJSHRQWW1wbFkzUjlJSFJvYVhOQmNtY2dWR2hsSUc5aWFtVmpkQ0IwYnlCaWFXNWtJR1oxYm1OMGFXOXVJSFJ2WEc0Z0tpQkFjbVYwZFhKdUlIdFBZbXBsWTNSOUlGUm9aU0J5WlhOMWJIUnBibWNnZG1Gc2RXVWdiMllnYjJKcVpXTjBJR0ZjYmlBcUwxeHVablZ1WTNScGIyNGdaWGgwWlc1a0tHRXNJR0lzSUhSb2FYTkJjbWNwSUh0Y2JpQWdabTl5UldGamFDaGlMQ0JtZFc1amRHbHZiaUJoYzNOcFoyNVdZV3gxWlNoMllXd3NJR3RsZVNrZ2UxeHVJQ0FnSUdsbUlDaDBhR2x6UVhKbklDWW1JSFI1Y0dWdlppQjJZV3dnUFQwOUlDZG1kVzVqZEdsdmJpY3BJSHRjYmlBZ0lDQWdJR0ZiYTJWNVhTQTlJR0pwYm1Rb2RtRnNMQ0IwYUdselFYSm5LVHRjYmlBZ0lDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUNBZ1lWdHJaWGxkSUQwZ2RtRnNPMXh1SUNBZ0lIMWNiaUFnZlNrN1hHNGdJSEpsZEhWeWJpQmhPMXh1ZlZ4dVhHNXRiMlIxYkdVdVpYaHdiM0owY3lBOUlIdGNiaUFnYVhOQmNuSmhlVG9nYVhOQmNuSmhlU3hjYmlBZ2FYTkJjbkpoZVVKMVptWmxjam9nYVhOQmNuSmhlVUoxWm1abGNpeGNiaUFnYVhOQ2RXWm1aWEk2SUdselFuVm1abVZ5TEZ4dUlDQnBjMFp2Y20xRVlYUmhPaUJwYzBadmNtMUVZWFJoTEZ4dUlDQnBjMEZ5Y21GNVFuVm1abVZ5Vm1sbGR6b2dhWE5CY25KaGVVSjFabVpsY2xacFpYY3NYRzRnSUdselUzUnlhVzVuT2lCcGMxTjBjbWx1Wnl4Y2JpQWdhWE5PZFcxaVpYSTZJR2x6VG5WdFltVnlMRnh1SUNCcGMwOWlhbVZqZERvZ2FYTlBZbXBsWTNRc1hHNGdJR2x6Vlc1a1pXWnBibVZrT2lCcGMxVnVaR1ZtYVc1bFpDeGNiaUFnYVhORVlYUmxPaUJwYzBSaGRHVXNYRzRnSUdselJtbHNaVG9nYVhOR2FXeGxMRnh1SUNCcGMwSnNiMkk2SUdselFteHZZaXhjYmlBZ2FYTkdkVzVqZEdsdmJqb2dhWE5HZFc1amRHbHZiaXhjYmlBZ2FYTlRkSEpsWVcwNklHbHpVM1J5WldGdExGeHVJQ0JwYzFWU1RGTmxZWEpqYUZCaGNtRnRjem9nYVhOVlVreFRaV0Z5WTJoUVlYSmhiWE1zWEc0Z0lHbHpVM1JoYm1SaGNtUkNjbTkzYzJWeVJXNTJPaUJwYzFOMFlXNWtZWEprUW5KdmQzTmxja1Z1ZGl4Y2JpQWdabTl5UldGamFEb2dabTl5UldGamFDeGNiaUFnYldWeVoyVTZJRzFsY21kbExGeHVJQ0JsZUhSbGJtUTZJR1Y0ZEdWdVpDeGNiaUFnZEhKcGJUb2dkSEpwYlZ4dWZUdGNiaUlzSWk4cUtseHVJQ29nUTI5d2VYSnBaMmgwSURJd01UTXRjSEpsYzJWdWRDd2dSbUZqWldKdmIyc3NJRWx1WXk1Y2JpQXFJRUZzYkNCeWFXZG9kSE1nY21WelpYSjJaV1F1WEc0Z0tseHVJQ29nVkdocGN5QnpiM1Z5WTJVZ1kyOWtaU0JwY3lCc2FXTmxibk5sWkNCMWJtUmxjaUIwYUdVZ1FsTkVMWE4wZVd4bElHeHBZMlZ1YzJVZ1ptOTFibVFnYVc0Z2RHaGxYRzRnS2lCTVNVTkZUbE5GSUdacGJHVWdhVzRnZEdobElISnZiM1FnWkdseVpXTjBiM0o1SUc5bUlIUm9hWE1nYzI5MWNtTmxJSFJ5WldVdUlFRnVJR0ZrWkdsMGFXOXVZV3dnWjNKaGJuUmNiaUFxSUc5bUlIQmhkR1Z1ZENCeWFXZG9kSE1nWTJGdUlHSmxJR1p2ZFc1a0lHbHVJSFJvWlNCUVFWUkZUbFJUSUdacGJHVWdhVzRnZEdobElITmhiV1VnWkdseVpXTjBiM0o1TGx4dUlDcGNiaUFxTDF4dVhHNG5kWE5sSUhOMGNtbGpkQ2M3WEc1Y2JuWmhjaUJmWVhOemFXZHVJRDBnY21WeGRXbHlaU2duYjJKcVpXTjBMV0Z6YzJsbmJpY3BPMXh1WEc1MllYSWdaVzF3ZEhsUFltcGxZM1FnUFNCeVpYRjFhWEpsS0NkbVltcHpMMnhwWWk5bGJYQjBlVTlpYW1WamRDY3BPMXh1ZG1GeUlGOXBiblpoY21saGJuUWdQU0J5WlhGMWFYSmxLQ2RtWW1wekwyeHBZaTlwYm5aaGNtbGhiblFuS1R0Y2JseHVhV1lnS0hCeWIyTmxjM011Wlc1MkxrNVBSRVZmUlU1V0lDRTlQU0FuY0hKdlpIVmpkR2x2YmljcElIdGNiaUFnZG1GeUlIZGhjbTVwYm1jZ1BTQnlaWEYxYVhKbEtDZG1ZbXB6TDJ4cFlpOTNZWEp1YVc1bkp5azdYRzU5WEc1Y2JuWmhjaUJOU1ZoSlRsTmZTMFZaSUQwZ0oyMXBlR2x1Y3ljN1hHNWNiaTh2SUVobGJIQmxjaUJtZFc1amRHbHZiaUIwYnlCaGJHeHZkeUIwYUdVZ1kzSmxZWFJwYjI0Z2IyWWdZVzV2Ym5sdGIzVnpJR1oxYm1OMGFXOXVjeUIzYUdsamFDQmtieUJ1YjNSY2JpOHZJR2hoZG1VZ0xtNWhiV1VnYzJWMElIUnZJSFJvWlNCdVlXMWxJRzltSUhSb1pTQjJZWEpwWVdKc1pTQmlaV2x1WnlCaGMzTnBaMjVsWkNCMGJ5NWNibVoxYm1OMGFXOXVJR2xrWlc1MGFYUjVLR1p1S1NCN1hHNGdJSEpsZEhWeWJpQm1ianRjYm4xY2JseHVkbUZ5SUZKbFlXTjBVSEp2Y0ZSNWNHVk1iMk5oZEdsdmJrNWhiV1Z6TzF4dWFXWWdLSEJ5YjJObGMzTXVaVzUyTGs1UFJFVmZSVTVXSUNFOVBTQW5jSEp2WkhWamRHbHZiaWNwSUh0Y2JpQWdVbVZoWTNSUWNtOXdWSGx3WlV4dlkyRjBhVzl1VG1GdFpYTWdQU0I3WEc0Z0lDQWdjSEp2Y0RvZ0ozQnliM0FuTEZ4dUlDQWdJR052Ym5SbGVIUTZJQ2RqYjI1MFpYaDBKeXhjYmlBZ0lDQmphR2xzWkVOdmJuUmxlSFE2SUNkamFHbHNaQ0JqYjI1MFpYaDBKMXh1SUNCOU8xeHVmU0JsYkhObElIdGNiaUFnVW1WaFkzUlFjbTl3Vkhsd1pVeHZZMkYwYVc5dVRtRnRaWE1nUFNCN2ZUdGNibjFjYmx4dVpuVnVZM1JwYjI0Z1ptRmpkRzl5ZVNoU1pXRmpkRU52YlhCdmJtVnVkQ3dnYVhOV1lXeHBaRVZzWlcxbGJuUXNJRkpsWVdOMFRtOXZjRlZ3WkdGMFpWRjFaWFZsS1NCN1hHNGdJQzhxS2x4dUlDQWdLaUJRYjJ4cFkybGxjeUIwYUdGMElHUmxjMk55YVdKbElHMWxkR2h2WkhNZ2FXNGdZRkpsWVdOMFEyeGhjM05KYm5SbGNtWmhZMlZnTGx4dUlDQWdLaTljYmx4dUlDQjJZWElnYVc1cVpXTjBaV1JOYVhocGJuTWdQU0JiWFR0Y2JseHVJQ0F2S2lwY2JpQWdJQ29nUTI5dGNHOXphWFJsSUdOdmJYQnZibVZ1ZEhNZ1lYSmxJR2hwWjJobGNpMXNaWFpsYkNCamIyMXdiMjVsYm5SeklIUm9ZWFFnWTI5dGNHOXpaU0J2ZEdobGNpQmpiMjF3YjNOcGRHVmNiaUFnSUNvZ2IzSWdhRzl6ZENCamIyMXdiMjVsYm5SekxseHVJQ0FnS2x4dUlDQWdLaUJVYnlCamNtVmhkR1VnWVNCdVpYY2dkSGx3WlNCdlppQmdVbVZoWTNSRGJHRnpjMkFzSUhCaGMzTWdZU0J6Y0dWamFXWnBZMkYwYVc5dUlHOW1YRzRnSUNBcUlIbHZkWElnYm1WM0lHTnNZWE56SUhSdklHQlNaV0ZqZEM1amNtVmhkR1ZEYkdGemMyQXVJRlJvWlNCdmJteDVJSEpsY1hWcGNtVnRaVzUwSUc5bUlIbHZkWElnWTJ4aGMzTmNiaUFnSUNvZ2MzQmxZMmxtYVdOaGRHbHZiaUJwY3lCMGFHRjBJSGx2ZFNCcGJYQnNaVzFsYm5RZ1lTQmdjbVZ1WkdWeVlDQnRaWFJvYjJRdVhHNGdJQ0FxWEc0Z0lDQXFJQ0FnZG1GeUlFMTVRMjl0Y0c5dVpXNTBJRDBnVW1WaFkzUXVZM0psWVhSbFEyeGhjM01vZTF4dUlDQWdLaUFnSUNBZ2NtVnVaR1Z5T2lCbWRXNWpkR2x2YmlncElIdGNiaUFnSUNvZ0lDQWdJQ0FnY21WMGRYSnVJRHhrYVhZK1NHVnNiRzhnVjI5eWJHUThMMlJwZGo0N1hHNGdJQ0FxSUNBZ0lDQjlYRzRnSUNBcUlDQWdmU2s3WEc0Z0lDQXFYRzRnSUNBcUlGUm9aU0JqYkdGemN5QnpjR1ZqYVdacFkyRjBhVzl1SUhOMWNIQnZjblJ6SUdFZ2MzQmxZMmxtYVdNZ2NISnZkRzlqYjJ3Z2IyWWdiV1YwYUc5a2N5QjBhR0YwSUdoaGRtVmNiaUFnSUNvZ2MzQmxZMmxoYkNCdFpXRnVhVzVuSUNobExtY3VJR0J5Wlc1a1pYSmdLUzRnVTJWbElHQlNaV0ZqZEVOc1lYTnpTVzUwWlhKbVlXTmxZQ0JtYjNKY2JpQWdJQ29nYlc5eVpTQjBhR1VnWTI5dGNISmxhR1Z1YzJsMlpTQndjbTkwYjJOdmJDNGdRVzU1SUc5MGFHVnlJSEJ5YjNCbGNuUnBaWE1nWVc1a0lHMWxkR2h2WkhNZ2FXNGdkR2hsWEc0Z0lDQXFJR05zWVhOeklITndaV05wWm1sallYUnBiMjRnZDJsc2JDQmlaU0JoZG1GcGJHRmliR1VnYjI0Z2RHaGxJSEJ5YjNSdmRIbHdaUzVjYmlBZ0lDcGNiaUFnSUNvZ1FHbHVkR1Z5Wm1GalpTQlNaV0ZqZEVOc1lYTnpTVzUwWlhKbVlXTmxYRzRnSUNBcUlFQnBiblJsY201aGJGeHVJQ0FnS2k5Y2JpQWdkbUZ5SUZKbFlXTjBRMnhoYzNOSmJuUmxjbVpoWTJVZ1BTQjdYRzRnSUNBZ0x5b3FYRzRnSUNBZ0lDb2dRVzRnWVhKeVlYa2diMllnVFdsNGFXNGdiMkpxWldOMGN5QjBieUJwYm1Oc2RXUmxJSGRvWlc0Z1pHVm1hVzVwYm1jZ2VXOTFjaUJqYjIxd2IyNWxiblF1WEc0Z0lDQWdJQ3BjYmlBZ0lDQWdLaUJBZEhsd1pTQjdZWEp5WVhsOVhHNGdJQ0FnSUNvZ1FHOXdkR2x2Ym1Gc1hHNGdJQ0FnSUNvdlhHNGdJQ0FnYldsNGFXNXpPaUFuUkVWR1NVNUZYMDFCVGxrbkxGeHVYRzRnSUNBZ0x5b3FYRzRnSUNBZ0lDb2dRVzRnYjJKcVpXTjBJR052Ym5SaGFXNXBibWNnY0hKdmNHVnlkR2xsY3lCaGJtUWdiV1YwYUc5a2N5QjBhR0YwSUhOb2IzVnNaQ0JpWlNCa1pXWnBibVZrSUc5dVhHNGdJQ0FnSUNvZ2RHaGxJR052YlhCdmJtVnVkQ2R6SUdOdmJuTjBjblZqZEc5eUlHbHVjM1JsWVdRZ2IyWWdhWFJ6SUhCeWIzUnZkSGx3WlNBb2MzUmhkR2xqSUcxbGRHaHZaSE1wTGx4dUlDQWdJQ0FxWEc0Z0lDQWdJQ29nUUhSNWNHVWdlMjlpYW1WamRIMWNiaUFnSUNBZ0tpQkFiM0IwYVc5dVlXeGNiaUFnSUNBZ0tpOWNiaUFnSUNCemRHRjBhV056T2lBblJFVkdTVTVGWDAxQlRsa25MRnh1WEc0Z0lDQWdMeW9xWEc0Z0lDQWdJQ29nUkdWbWFXNXBkR2x2YmlCdlppQndjbTl3SUhSNWNHVnpJR1p2Y2lCMGFHbHpJR052YlhCdmJtVnVkQzVjYmlBZ0lDQWdLbHh1SUNBZ0lDQXFJRUIwZVhCbElIdHZZbXBsWTNSOVhHNGdJQ0FnSUNvZ1FHOXdkR2x2Ym1Gc1hHNGdJQ0FnSUNvdlhHNGdJQ0FnY0hKdmNGUjVjR1Z6T2lBblJFVkdTVTVGWDAxQlRsa25MRnh1WEc0Z0lDQWdMeW9xWEc0Z0lDQWdJQ29nUkdWbWFXNXBkR2x2YmlCdlppQmpiMjUwWlhoMElIUjVjR1Z6SUdadmNpQjBhR2x6SUdOdmJYQnZibVZ1ZEM1Y2JpQWdJQ0FnS2x4dUlDQWdJQ0FxSUVCMGVYQmxJSHR2WW1wbFkzUjlYRzRnSUNBZ0lDb2dRRzl3ZEdsdmJtRnNYRzRnSUNBZ0lDb3ZYRzRnSUNBZ1kyOXVkR1Y0ZEZSNWNHVnpPaUFuUkVWR1NVNUZYMDFCVGxrbkxGeHVYRzRnSUNBZ0x5b3FYRzRnSUNBZ0lDb2dSR1ZtYVc1cGRHbHZiaUJ2WmlCamIyNTBaWGgwSUhSNWNHVnpJSFJvYVhNZ1kyOXRjRzl1Wlc1MElITmxkSE1nWm05eUlHbDBjeUJqYUdsc1pISmxiaTVjYmlBZ0lDQWdLbHh1SUNBZ0lDQXFJRUIwZVhCbElIdHZZbXBsWTNSOVhHNGdJQ0FnSUNvZ1FHOXdkR2x2Ym1Gc1hHNGdJQ0FnSUNvdlhHNGdJQ0FnWTJocGJHUkRiMjUwWlhoMFZIbHdaWE02SUNkRVJVWkpUa1ZmVFVGT1dTY3NYRzVjYmlBZ0lDQXZMeUE5UFQwOUlFUmxabWx1YVhScGIyNGdiV1YwYUc5a2N5QTlQVDA5WEc1Y2JpQWdJQ0F2S2lwY2JpQWdJQ0FnS2lCSmJuWnZhMlZrSUhkb1pXNGdkR2hsSUdOdmJYQnZibVZ1ZENCcGN5QnRiM1Z1ZEdWa0xpQldZV3gxWlhNZ2FXNGdkR2hsSUcxaGNIQnBibWNnZDJsc2JDQmlaU0J6WlhRZ2IyNWNiaUFnSUNBZ0tpQmdkR2hwY3k1d2NtOXdjMkFnYVdZZ2RHaGhkQ0J3Y205d0lHbHpJRzV2ZENCemNHVmphV1pwWldRZ0tHa3VaUzRnZFhOcGJtY2dZVzRnWUdsdVlDQmphR1ZqYXlrdVhHNGdJQ0FnSUNwY2JpQWdJQ0FnS2lCVWFHbHpJRzFsZEdodlpDQnBjeUJwYm5admEyVmtJR0psWm05eVpTQmdaMlYwU1c1cGRHbGhiRk4wWVhSbFlDQmhibVFnZEdobGNtVm1iM0psSUdOaGJtNXZkQ0J5Wld4NVhHNGdJQ0FnSUNvZ2IyNGdZSFJvYVhNdWMzUmhkR1ZnSUc5eUlIVnpaU0JnZEdocGN5NXpaWFJUZEdGMFpXQXVYRzRnSUNBZ0lDcGNiaUFnSUNBZ0tpQkFjbVYwZFhKdUlIdHZZbXBsWTNSOVhHNGdJQ0FnSUNvZ1FHOXdkR2x2Ym1Gc1hHNGdJQ0FnSUNvdlhHNGdJQ0FnWjJWMFJHVm1ZWFZzZEZCeWIzQnpPaUFuUkVWR1NVNUZYMDFCVGxsZlRVVlNSMFZFSnl4Y2JseHVJQ0FnSUM4cUtseHVJQ0FnSUNBcUlFbHVkbTlyWldRZ2IyNWpaU0JpWldadmNtVWdkR2hsSUdOdmJYQnZibVZ1ZENCcGN5QnRiM1Z1ZEdWa0xpQlVhR1VnY21WMGRYSnVJSFpoYkhWbElIZHBiR3dnWW1VZ2RYTmxaRnh1SUNBZ0lDQXFJR0Z6SUhSb1pTQnBibWwwYVdGc0lIWmhiSFZsSUc5bUlHQjBhR2x6TG5OMFlYUmxZQzVjYmlBZ0lDQWdLbHh1SUNBZ0lDQXFJQ0FnWjJWMFNXNXBkR2xoYkZOMFlYUmxPaUJtZFc1amRHbHZiaWdwSUh0Y2JpQWdJQ0FnS2lBZ0lDQWdjbVYwZFhKdUlIdGNiaUFnSUNBZ0tpQWdJQ0FnSUNCcGMwOXVPaUJtWVd4elpTeGNiaUFnSUNBZ0tpQWdJQ0FnSUNCbWIyOUNZWG82SUc1bGR5QkNZWHBHYjI4b0tWeHVJQ0FnSUNBcUlDQWdJQ0I5WEc0Z0lDQWdJQ29nSUNCOVhHNGdJQ0FnSUNwY2JpQWdJQ0FnS2lCQWNtVjBkWEp1SUh0dlltcGxZM1I5WEc0Z0lDQWdJQ29nUUc5d2RHbHZibUZzWEc0Z0lDQWdJQ292WEc0Z0lDQWdaMlYwU1c1cGRHbGhiRk4wWVhSbE9pQW5SRVZHU1U1RlgwMUJUbGxmVFVWU1IwVkVKeXhjYmx4dUlDQWdJQzhxS2x4dUlDQWdJQ0FxSUVCeVpYUjFjbTRnZTI5aWFtVmpkSDFjYmlBZ0lDQWdLaUJBYjNCMGFXOXVZV3hjYmlBZ0lDQWdLaTljYmlBZ0lDQm5aWFJEYUdsc1pFTnZiblJsZUhRNklDZEVSVVpKVGtWZlRVRk9XVjlOUlZKSFJVUW5MRnh1WEc0Z0lDQWdMeW9xWEc0Z0lDQWdJQ29nVlhObGN5QndjbTl3Y3lCbWNtOXRJR0IwYUdsekxuQnliM0J6WUNCaGJtUWdjM1JoZEdVZ1puSnZiU0JnZEdocGN5NXpkR0YwWldBZ2RHOGdjbVZ1WkdWeUlIUm9aVnh1SUNBZ0lDQXFJSE4wY25WamRIVnlaU0J2WmlCMGFHVWdZMjl0Y0c5dVpXNTBMbHh1SUNBZ0lDQXFYRzRnSUNBZ0lDb2dUbThnWjNWaGNtRnVkR1ZsY3lCaGNtVWdiV0ZrWlNCaFltOTFkQ0IzYUdWdUlHOXlJR2h2ZHlCdlpuUmxiaUIwYUdseklHMWxkR2h2WkNCcGN5QnBiblp2YTJWa0xDQnpiMXh1SUNBZ0lDQXFJR2wwSUcxMWMzUWdibTkwSUdoaGRtVWdjMmxrWlNCbFptWmxZM1J6TGx4dUlDQWdJQ0FxWEc0Z0lDQWdJQ29nSUNCeVpXNWtaWEk2SUdaMWJtTjBhVzl1S0NrZ2UxeHVJQ0FnSUNBcUlDQWdJQ0IyWVhJZ2JtRnRaU0E5SUhSb2FYTXVjSEp2Y0hNdWJtRnRaVHRjYmlBZ0lDQWdLaUFnSUNBZ2NtVjBkWEp1SUR4a2FYWStTR1ZzYkc4c0lIdHVZVzFsZlNFOEwyUnBkajQ3WEc0Z0lDQWdJQ29nSUNCOVhHNGdJQ0FnSUNwY2JpQWdJQ0FnS2lCQWNtVjBkWEp1SUh0U1pXRmpkRU52YlhCdmJtVnVkSDFjYmlBZ0lDQWdLaUJBY21WeGRXbHlaV1JjYmlBZ0lDQWdLaTljYmlBZ0lDQnlaVzVrWlhJNklDZEVSVVpKVGtWZlQwNURSU2NzWEc1Y2JpQWdJQ0F2THlBOVBUMDlJRVJsYkdWbllYUmxJRzFsZEdodlpITWdQVDA5UFZ4dVhHNGdJQ0FnTHlvcVhHNGdJQ0FnSUNvZ1NXNTJiMnRsWkNCM2FHVnVJSFJvWlNCamIyMXdiMjVsYm5RZ2FYTWdhVzVwZEdsaGJHeDVJR055WldGMFpXUWdZVzVrSUdGaWIzVjBJSFJ2SUdKbElHMXZkVzUwWldRdVhHNGdJQ0FnSUNvZ1ZHaHBjeUJ0WVhrZ2FHRjJaU0J6YVdSbElHVm1abVZqZEhNc0lHSjFkQ0JoYm5rZ1pYaDBaWEp1WVd3Z2MzVmljMk55YVhCMGFXOXVjeUJ2Y2lCa1lYUmhJR055WldGMFpXUmNiaUFnSUNBZ0tpQmllU0IwYUdseklHMWxkR2h2WkNCdGRYTjBJR0psSUdOc1pXRnVaV1FnZFhBZ2FXNGdZR052YlhCdmJtVnVkRmRwYkd4VmJtMXZkVzUwWUM1Y2JpQWdJQ0FnS2x4dUlDQWdJQ0FxSUVCdmNIUnBiMjVoYkZ4dUlDQWdJQ0FxTDF4dUlDQWdJR052YlhCdmJtVnVkRmRwYkd4TmIzVnVkRG9nSjBSRlJrbE9SVjlOUVU1Wkp5eGNibHh1SUNBZ0lDOHFLbHh1SUNBZ0lDQXFJRWx1ZG05clpXUWdkMmhsYmlCMGFHVWdZMjl0Y0c5dVpXNTBJR2hoY3lCaVpXVnVJRzF2ZFc1MFpXUWdZVzVrSUdoaGN5QmhJRVJQVFNCeVpYQnlaWE5sYm5SaGRHbHZiaTVjYmlBZ0lDQWdLaUJJYjNkbGRtVnlMQ0IwYUdWeVpTQnBjeUJ1YnlCbmRXRnlZVzUwWldVZ2RHaGhkQ0IwYUdVZ1JFOU5JRzV2WkdVZ2FYTWdhVzRnZEdobElHUnZZM1Z0Wlc1MExseHVJQ0FnSUNBcVhHNGdJQ0FnSUNvZ1ZYTmxJSFJvYVhNZ1lYTWdZVzRnYjNCd2IzSjBkVzVwZEhrZ2RHOGdiM0JsY21GMFpTQnZiaUIwYUdVZ1JFOU5JSGRvWlc0Z2RHaGxJR052YlhCdmJtVnVkQ0JvWVhOY2JpQWdJQ0FnS2lCaVpXVnVJRzF2ZFc1MFpXUWdLR2x1YVhScFlXeHBlbVZrSUdGdVpDQnlaVzVrWlhKbFpDa2dabTl5SUhSb1pTQm1hWEp6ZENCMGFXMWxMbHh1SUNBZ0lDQXFYRzRnSUNBZ0lDb2dRSEJoY21GdElIdEVUMDFGYkdWdFpXNTBmU0J5YjI5MFRtOWtaU0JFVDAwZ1pXeGxiV1Z1ZENCeVpYQnlaWE5sYm5ScGJtY2dkR2hsSUdOdmJYQnZibVZ1ZEM1Y2JpQWdJQ0FnS2lCQWIzQjBhVzl1WVd4Y2JpQWdJQ0FnS2k5Y2JpQWdJQ0JqYjIxd2IyNWxiblJFYVdSTmIzVnVkRG9nSjBSRlJrbE9SVjlOUVU1Wkp5eGNibHh1SUNBZ0lDOHFLbHh1SUNBZ0lDQXFJRWx1ZG05clpXUWdZbVZtYjNKbElIUm9aU0JqYjIxd2IyNWxiblFnY21WalpXbDJaWE1nYm1WM0lIQnliM0J6TGx4dUlDQWdJQ0FxWEc0Z0lDQWdJQ29nVlhObElIUm9hWE1nWVhNZ1lXNGdiM0J3YjNKMGRXNXBkSGtnZEc4Z2NtVmhZM1FnZEc4Z1lTQndjbTl3SUhSeVlXNXphWFJwYjI0Z1lua2dkWEJrWVhScGJtY2dkR2hsWEc0Z0lDQWdJQ29nYzNSaGRHVWdkWE5wYm1jZ1lIUm9hWE11YzJWMFUzUmhkR1ZnTGlCRGRYSnlaVzUwSUhCeWIzQnpJR0Z5WlNCaFkyTmxjM05sWkNCMmFXRWdZSFJvYVhNdWNISnZjSE5nTGx4dUlDQWdJQ0FxWEc0Z0lDQWdJQ29nSUNCamIyMXdiMjVsYm5SWGFXeHNVbVZqWldsMlpWQnliM0J6T2lCbWRXNWpkR2x2YmlodVpYaDBVSEp2Y0hNc0lHNWxlSFJEYjI1MFpYaDBLU0I3WEc0Z0lDQWdJQ29nSUNBZ0lIUm9hWE11YzJWMFUzUmhkR1VvZTF4dUlDQWdJQ0FxSUNBZ0lDQWdJR3hwYTJWelNXNWpjbVZoYzJsdVp6b2dibVY0ZEZCeWIzQnpMbXhwYTJWRGIzVnVkQ0ErSUhSb2FYTXVjSEp2Y0hNdWJHbHJaVU52ZFc1MFhHNGdJQ0FnSUNvZ0lDQWdJSDBwTzF4dUlDQWdJQ0FxSUNBZ2ZWeHVJQ0FnSUNBcVhHNGdJQ0FnSUNvZ1RrOVVSVG9nVkdobGNtVWdhWE1nYm04Z1pYRjFhWFpoYkdWdWRDQmdZMjl0Y0c5dVpXNTBWMmxzYkZKbFkyVnBkbVZUZEdGMFpXQXVJRUZ1SUdsdVkyOXRhVzVuSUhCeWIzQmNiaUFnSUNBZ0tpQjBjbUZ1YzJsMGFXOXVJRzFoZVNCallYVnpaU0JoSUhOMFlYUmxJR05vWVc1blpTd2dZblYwSUhSb1pTQnZjSEJ2YzJsMFpTQnBjeUJ1YjNRZ2RISjFaUzRnU1dZZ2VXOTFYRzRnSUNBZ0lDb2dibVZsWkNCcGRDd2dlVzkxSUdGeVpTQndjbTlpWVdKc2VTQnNiMjlyYVc1bklHWnZjaUJnWTI5dGNHOXVaVzUwVjJsc2JGVndaR0YwWldBdVhHNGdJQ0FnSUNwY2JpQWdJQ0FnS2lCQWNHRnlZVzBnZTI5aWFtVmpkSDBnYm1WNGRGQnliM0J6WEc0Z0lDQWdJQ29nUUc5d2RHbHZibUZzWEc0Z0lDQWdJQ292WEc0Z0lDQWdZMjl0Y0c5dVpXNTBWMmxzYkZKbFkyVnBkbVZRY205d2N6b2dKMFJGUmtsT1JWOU5RVTVaSnl4Y2JseHVJQ0FnSUM4cUtseHVJQ0FnSUNBcUlFbHVkbTlyWldRZ2QyaHBiR1VnWkdWamFXUnBibWNnYVdZZ2RHaGxJR052YlhCdmJtVnVkQ0J6YUc5MWJHUWdZbVVnZFhCa1lYUmxaQ0JoY3lCaElISmxjM1ZzZENCdlpseHVJQ0FnSUNBcUlISmxZMlZwZG1sdVp5QnVaWGNnY0hKdmNITXNJSE4wWVhSbElHRnVaQzl2Y2lCamIyNTBaWGgwTGx4dUlDQWdJQ0FxWEc0Z0lDQWdJQ29nVlhObElIUm9hWE1nWVhNZ1lXNGdiM0J3YjNKMGRXNXBkSGtnZEc4Z1lISmxkSFZ5YmlCbVlXeHpaV0FnZDJobGJpQjViM1VuY21VZ1kyVnlkR0ZwYmlCMGFHRjBJSFJvWlZ4dUlDQWdJQ0FxSUhSeVlXNXphWFJwYjI0Z2RHOGdkR2hsSUc1bGR5QndjbTl3Y3k5emRHRjBaUzlqYjI1MFpYaDBJSGRwYkd3Z2JtOTBJSEpsY1hWcGNtVWdZU0JqYjIxd2IyNWxiblJjYmlBZ0lDQWdLaUIxY0dSaGRHVXVYRzRnSUNBZ0lDcGNiaUFnSUNBZ0tpQWdJSE5vYjNWc1pFTnZiWEJ2Ym1WdWRGVndaR0YwWlRvZ1puVnVZM1JwYjI0b2JtVjRkRkJ5YjNCekxDQnVaWGgwVTNSaGRHVXNJRzVsZUhSRGIyNTBaWGgwS1NCN1hHNGdJQ0FnSUNvZ0lDQWdJSEpsZEhWeWJpQWhaWEYxWVd3b2JtVjRkRkJ5YjNCekxDQjBhR2x6TG5CeWIzQnpLU0I4ZkZ4dUlDQWdJQ0FxSUNBZ0lDQWdJQ0ZsY1hWaGJDaHVaWGgwVTNSaGRHVXNJSFJvYVhNdWMzUmhkR1VwSUh4OFhHNGdJQ0FnSUNvZ0lDQWdJQ0FnSVdWeGRXRnNLRzVsZUhSRGIyNTBaWGgwTENCMGFHbHpMbU52Ym5SbGVIUXBPMXh1SUNBZ0lDQXFJQ0FnZlZ4dUlDQWdJQ0FxWEc0Z0lDQWdJQ29nUUhCaGNtRnRJSHR2WW1wbFkzUjlJRzVsZUhSUWNtOXdjMXh1SUNBZ0lDQXFJRUJ3WVhKaGJTQjdQMjlpYW1WamRIMGdibVY0ZEZOMFlYUmxYRzRnSUNBZ0lDb2dRSEJoY21GdElIcy9iMkpxWldOMGZTQnVaWGgwUTI5dWRHVjRkRnh1SUNBZ0lDQXFJRUJ5WlhSMWNtNGdlMkp2YjJ4bFlXNTlJRlJ5ZFdVZ2FXWWdkR2hsSUdOdmJYQnZibVZ1ZENCemFHOTFiR1FnZFhCa1lYUmxMbHh1SUNBZ0lDQXFJRUJ2Y0hScGIyNWhiRnh1SUNBZ0lDQXFMMXh1SUNBZ0lITm9iM1ZzWkVOdmJYQnZibVZ1ZEZWd1pHRjBaVG9nSjBSRlJrbE9SVjlQVGtORkp5eGNibHh1SUNBZ0lDOHFLbHh1SUNBZ0lDQXFJRWx1ZG05clpXUWdkMmhsYmlCMGFHVWdZMjl0Y0c5dVpXNTBJR2x6SUdGaWIzVjBJSFJ2SUhWd1pHRjBaU0JrZFdVZ2RHOGdZU0IwY21GdWMybDBhVzl1SUdaeWIyMWNiaUFnSUNBZ0tpQmdkR2hwY3k1d2NtOXdjMkFzSUdCMGFHbHpMbk4wWVhSbFlDQmhibVFnWUhSb2FYTXVZMjl1ZEdWNGRHQWdkRzhnWUc1bGVIUlFjbTl3YzJBc0lHQnVaWGgwVTNSaGRHVmdYRzRnSUNBZ0lDb2dZVzVrSUdCdVpYaDBRMjl1ZEdWNGRHQXVYRzRnSUNBZ0lDcGNiaUFnSUNBZ0tpQlZjMlVnZEdocGN5QmhjeUJoYmlCdmNIQnZjblIxYm1sMGVTQjBieUJ3WlhKbWIzSnRJSEJ5WlhCaGNtRjBhVzl1SUdKbFptOXlaU0JoYmlCMWNHUmhkR1VnYjJOamRYSnpMbHh1SUNBZ0lDQXFYRzRnSUNBZ0lDb2dUazlVUlRvZ1dXOTFJQ29xWTJGdWJtOTBLaW9nZFhObElHQjBhR2x6TG5ObGRGTjBZWFJsS0NsZ0lHbHVJSFJvYVhNZ2JXVjBhRzlrTGx4dUlDQWdJQ0FxWEc0Z0lDQWdJQ29nUUhCaGNtRnRJSHR2WW1wbFkzUjlJRzVsZUhSUWNtOXdjMXh1SUNBZ0lDQXFJRUJ3WVhKaGJTQjdQMjlpYW1WamRIMGdibVY0ZEZOMFlYUmxYRzRnSUNBZ0lDb2dRSEJoY21GdElIcy9iMkpxWldOMGZTQnVaWGgwUTI5dWRHVjRkRnh1SUNBZ0lDQXFJRUJ3WVhKaGJTQjdVbVZoWTNSU1pXTnZibU5wYkdWVWNtRnVjMkZqZEdsdmJuMGdkSEpoYm5OaFkzUnBiMjVjYmlBZ0lDQWdLaUJBYjNCMGFXOXVZV3hjYmlBZ0lDQWdLaTljYmlBZ0lDQmpiMjF3YjI1bGJuUlhhV3hzVlhCa1lYUmxPaUFuUkVWR1NVNUZYMDFCVGxrbkxGeHVYRzRnSUNBZ0x5b3FYRzRnSUNBZ0lDb2dTVzUyYjJ0bFpDQjNhR1Z1SUhSb1pTQmpiMjF3YjI1bGJuUW5jeUJFVDAwZ2NtVndjbVZ6Wlc1MFlYUnBiMjRnYUdGeklHSmxaVzRnZFhCa1lYUmxaQzVjYmlBZ0lDQWdLbHh1SUNBZ0lDQXFJRlZ6WlNCMGFHbHpJR0Z6SUdGdUlHOXdjRzl5ZEhWdWFYUjVJSFJ2SUc5d1pYSmhkR1VnYjI0Z2RHaGxJRVJQVFNCM2FHVnVJSFJvWlNCamIyMXdiMjVsYm5RZ2FHRnpYRzRnSUNBZ0lDb2dZbVZsYmlCMWNHUmhkR1ZrTGx4dUlDQWdJQ0FxWEc0Z0lDQWdJQ29nUUhCaGNtRnRJSHR2WW1wbFkzUjlJSEJ5WlhaUWNtOXdjMXh1SUNBZ0lDQXFJRUJ3WVhKaGJTQjdQMjlpYW1WamRIMGdjSEpsZGxOMFlYUmxYRzRnSUNBZ0lDb2dRSEJoY21GdElIcy9iMkpxWldOMGZTQndjbVYyUTI5dWRHVjRkRnh1SUNBZ0lDQXFJRUJ3WVhKaGJTQjdSRTlOUld4bGJXVnVkSDBnY205dmRFNXZaR1VnUkU5TklHVnNaVzFsYm5RZ2NtVndjbVZ6Wlc1MGFXNW5JSFJvWlNCamIyMXdiMjVsYm5RdVhHNGdJQ0FnSUNvZ1FHOXdkR2x2Ym1Gc1hHNGdJQ0FnSUNvdlhHNGdJQ0FnWTI5dGNHOXVaVzUwUkdsa1ZYQmtZWFJsT2lBblJFVkdTVTVGWDAxQlRsa25MRnh1WEc0Z0lDQWdMeW9xWEc0Z0lDQWdJQ29nU1c1MmIydGxaQ0IzYUdWdUlIUm9aU0JqYjIxd2IyNWxiblFnYVhNZ1lXSnZkWFFnZEc4Z1ltVWdjbVZ0YjNabFpDQm1jbTl0SUdsMGN5QndZWEpsYm5RZ1lXNWtJR2hoZG1WY2JpQWdJQ0FnS2lCcGRITWdSRTlOSUhKbGNISmxjMlZ1ZEdGMGFXOXVJR1JsYzNSeWIzbGxaQzVjYmlBZ0lDQWdLbHh1SUNBZ0lDQXFJRlZ6WlNCMGFHbHpJR0Z6SUdGdUlHOXdjRzl5ZEhWdWFYUjVJSFJ2SUdSbFlXeHNiMk5oZEdVZ1lXNTVJR1Y0ZEdWeWJtRnNJSEpsYzI5MWNtTmxjeTVjYmlBZ0lDQWdLbHh1SUNBZ0lDQXFJRTVQVkVVNklGUm9aWEpsSUdseklHNXZJR0JqYjIxd2IyNWxiblJFYVdSVmJtMXZkVzUwWUNCemFXNWpaU0I1YjNWeUlHTnZiWEJ2Ym1WdWRDQjNhV3hzSUdoaGRtVWdZbVZsYmx4dUlDQWdJQ0FxSUdSbGMzUnliM2xsWkNCaWVTQjBhR0YwSUhCdmFXNTBMbHh1SUNBZ0lDQXFYRzRnSUNBZ0lDb2dRRzl3ZEdsdmJtRnNYRzRnSUNBZ0lDb3ZYRzRnSUNBZ1kyOXRjRzl1Wlc1MFYybHNiRlZ1Ylc5MWJuUTZJQ2RFUlVaSlRrVmZUVUZPV1Njc1hHNWNiaUFnSUNBdkx5QTlQVDA5SUVGa2RtRnVZMlZrSUcxbGRHaHZaSE1nUFQwOVBWeHVYRzRnSUNBZ0x5b3FYRzRnSUNBZ0lDb2dWWEJrWVhSbGN5QjBhR1VnWTI5dGNHOXVaVzUwSjNNZ1kzVnljbVZ1ZEd4NUlHMXZkVzUwWldRZ1JFOU5JSEpsY0hKbGMyVnVkR0YwYVc5dUxseHVJQ0FnSUNBcVhHNGdJQ0FnSUNvZ1Fua2daR1ZtWVhWc2RDd2dkR2hwY3lCcGJYQnNaVzFsYm5SeklGSmxZV04wSjNNZ2NtVnVaR1Z5YVc1bklHRnVaQ0J5WldOdmJtTnBiR2xoZEdsdmJpQmhiR2R2Y21sMGFHMHVYRzRnSUNBZ0lDb2dVMjl3YUdsemRHbGpZWFJsWkNCamJHbGxiblJ6SUcxaGVTQjNhWE5vSUhSdklHOTJaWEp5YVdSbElIUm9hWE11WEc0Z0lDQWdJQ3BjYmlBZ0lDQWdLaUJBY0dGeVlXMGdlMUpsWVdOMFVtVmpiMjVqYVd4bFZISmhibk5oWTNScGIyNTlJSFJ5WVc1ellXTjBhVzl1WEc0Z0lDQWdJQ29nUUdsdWRHVnlibUZzWEc0Z0lDQWdJQ29nUUc5MlpYSnlhV1JoWW14bFhHNGdJQ0FnSUNvdlhHNGdJQ0FnZFhCa1lYUmxRMjl0Y0c5dVpXNTBPaUFuVDFaRlVsSkpSRVZmUWtGVFJTZGNiaUFnZlR0Y2JseHVJQ0F2S2lwY2JpQWdJQ29nVFdGd2NHbHVaeUJtY205dElHTnNZWE56SUhOd1pXTnBabWxqWVhScGIyNGdhMlY1Y3lCMGJ5QnpjR1ZqYVdGc0lIQnliMk5sYzNOcGJtY2dablZ1WTNScGIyNXpMbHh1SUNBZ0tseHVJQ0FnS2lCQmJIUm9iM1ZuYUNCMGFHVnpaU0JoY21VZ1pHVmpiR0Z5WldRZ2JHbHJaU0JwYm5OMFlXNWpaU0J3Y205d1pYSjBhV1Z6SUdsdUlIUm9aU0J6Y0dWamFXWnBZMkYwYVc5dVhHNGdJQ0FxSUhkb1pXNGdaR1ZtYVc1cGJtY2dZMnhoYzNObGN5QjFjMmx1WnlCZ1VtVmhZM1F1WTNKbFlYUmxRMnhoYzNOZ0xDQjBhR1Y1SUdGeVpTQmhZM1IxWVd4c2VTQnpkR0YwYVdOY2JpQWdJQ29nWVc1a0lHRnlaU0JoWTJObGMzTnBZbXhsSUc5dUlIUm9aU0JqYjI1emRISjFZM1J2Y2lCcGJuTjBaV0ZrSUc5bUlIUm9aU0J3Y205MGIzUjVjR1V1SUVSbGMzQnBkR1ZjYmlBZ0lDb2dZbVZwYm1jZ2MzUmhkR2xqTENCMGFHVjVJRzExYzNRZ1ltVWdaR1ZtYVc1bFpDQnZkWFJ6YVdSbElHOW1JSFJvWlNCY0luTjBZWFJwWTNOY0lpQnJaWGtnZFc1a1pYSmNiaUFnSUNvZ2QyaHBZMmdnWVd4c0lHOTBhR1Z5SUhOMFlYUnBZeUJ0WlhSb2IyUnpJR0Z5WlNCa1pXWnBibVZrTGx4dUlDQWdLaTljYmlBZ2RtRnlJRkpGVTBWU1ZrVkVYMU5RUlVOZlMwVlpVeUE5SUh0Y2JpQWdJQ0JrYVhOd2JHRjVUbUZ0WlRvZ1puVnVZM1JwYjI0b1EyOXVjM1J5ZFdOMGIzSXNJR1JwYzNCc1lYbE9ZVzFsS1NCN1hHNGdJQ0FnSUNCRGIyNXpkSEoxWTNSdmNpNWthWE53YkdGNVRtRnRaU0E5SUdScGMzQnNZWGxPWVcxbE8xeHVJQ0FnSUgwc1hHNGdJQ0FnYldsNGFXNXpPaUJtZFc1amRHbHZiaWhEYjI1emRISjFZM1J2Y2l3Z2JXbDRhVzV6S1NCN1hHNGdJQ0FnSUNCcFppQW9iV2w0YVc1ektTQjdYRzRnSUNBZ0lDQWdJR1p2Y2lBb2RtRnlJR2tnUFNBd095QnBJRHdnYldsNGFXNXpMbXhsYm1kMGFEc2dhU3NyS1NCN1hHNGdJQ0FnSUNBZ0lDQWdiV2w0VTNCbFkwbHVkRzlEYjIxd2IyNWxiblFvUTI5dWMzUnlkV04wYjNJc0lHMXBlR2x1YzF0cFhTazdYRzRnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJSDFjYmlBZ0lDQjlMRnh1SUNBZ0lHTm9hV3hrUTI5dWRHVjRkRlI1Y0dWek9pQm1kVzVqZEdsdmJpaERiMjV6ZEhKMVkzUnZjaXdnWTJocGJHUkRiMjUwWlhoMFZIbHdaWE1wSUh0Y2JpQWdJQ0FnSUdsbUlDaHdjbTlqWlhOekxtVnVkaTVPVDBSRlgwVk9WaUFoUFQwZ0ozQnliMlIxWTNScGIyNG5LU0I3WEc0Z0lDQWdJQ0FnSUhaaGJHbGtZWFJsVkhsd1pVUmxaaWhEYjI1emRISjFZM1J2Y2l3Z1kyaHBiR1JEYjI1MFpYaDBWSGx3WlhNc0lDZGphR2xzWkVOdmJuUmxlSFFuS1R0Y2JpQWdJQ0FnSUgxY2JpQWdJQ0FnSUVOdmJuTjBjblZqZEc5eUxtTm9hV3hrUTI5dWRHVjRkRlI1Y0dWeklEMGdYMkZ6YzJsbmJpaGNiaUFnSUNBZ0lDQWdlMzBzWEc0Z0lDQWdJQ0FnSUVOdmJuTjBjblZqZEc5eUxtTm9hV3hrUTI5dWRHVjRkRlI1Y0dWekxGeHVJQ0FnSUNBZ0lDQmphR2xzWkVOdmJuUmxlSFJVZVhCbGMxeHVJQ0FnSUNBZ0tUdGNiaUFnSUNCOUxGeHVJQ0FnSUdOdmJuUmxlSFJVZVhCbGN6b2dablZ1WTNScGIyNG9RMjl1YzNSeWRXTjBiM0lzSUdOdmJuUmxlSFJVZVhCbGN5a2dlMXh1SUNBZ0lDQWdhV1lnS0hCeWIyTmxjM011Wlc1MkxrNVBSRVZmUlU1V0lDRTlQU0FuY0hKdlpIVmpkR2x2YmljcElIdGNiaUFnSUNBZ0lDQWdkbUZzYVdSaGRHVlVlWEJsUkdWbUtFTnZibk4wY25WamRHOXlMQ0JqYjI1MFpYaDBWSGx3WlhNc0lDZGpiMjUwWlhoMEp5azdYRzRnSUNBZ0lDQjlYRzRnSUNBZ0lDQkRiMjV6ZEhKMVkzUnZjaTVqYjI1MFpYaDBWSGx3WlhNZ1BTQmZZWE56YVdkdUtGeHVJQ0FnSUNBZ0lDQjdmU3hjYmlBZ0lDQWdJQ0FnUTI5dWMzUnlkV04wYjNJdVkyOXVkR1Y0ZEZSNWNHVnpMRnh1SUNBZ0lDQWdJQ0JqYjI1MFpYaDBWSGx3WlhOY2JpQWdJQ0FnSUNrN1hHNGdJQ0FnZlN4Y2JpQWdJQ0F2S2lwY2JpQWdJQ0FnS2lCVGNHVmphV0ZzSUdOaGMyVWdaMlYwUkdWbVlYVnNkRkJ5YjNCeklIZG9hV05vSUhOb2IzVnNaQ0J0YjNabElHbHVkRzhnYzNSaGRHbGpjeUJpZFhRZ2NtVnhkV2x5WlhOY2JpQWdJQ0FnS2lCaGRYUnZiV0YwYVdNZ2JXVnlaMmx1Wnk1Y2JpQWdJQ0FnS2k5Y2JpQWdJQ0JuWlhSRVpXWmhkV3gwVUhKdmNITTZJR1oxYm1OMGFXOXVLRU52Ym5OMGNuVmpkRzl5TENCblpYUkVaV1poZFd4MFVISnZjSE1wSUh0Y2JpQWdJQ0FnSUdsbUlDaERiMjV6ZEhKMVkzUnZjaTVuWlhSRVpXWmhkV3gwVUhKdmNITXBJSHRjYmlBZ0lDQWdJQ0FnUTI5dWMzUnlkV04wYjNJdVoyVjBSR1ZtWVhWc2RGQnliM0J6SUQwZ1kzSmxZWFJsVFdWeVoyVmtVbVZ6ZFd4MFJuVnVZM1JwYjI0b1hHNGdJQ0FnSUNBZ0lDQWdRMjl1YzNSeWRXTjBiM0l1WjJWMFJHVm1ZWFZzZEZCeWIzQnpMRnh1SUNBZ0lDQWdJQ0FnSUdkbGRFUmxabUYxYkhSUWNtOXdjMXh1SUNBZ0lDQWdJQ0FwTzF4dUlDQWdJQ0FnZlNCbGJITmxJSHRjYmlBZ0lDQWdJQ0FnUTI5dWMzUnlkV04wYjNJdVoyVjBSR1ZtWVhWc2RGQnliM0J6SUQwZ1oyVjBSR1ZtWVhWc2RGQnliM0J6TzF4dUlDQWdJQ0FnZlZ4dUlDQWdJSDBzWEc0Z0lDQWdjSEp2Y0ZSNWNHVnpPaUJtZFc1amRHbHZiaWhEYjI1emRISjFZM1J2Y2l3Z2NISnZjRlI1Y0dWektTQjdYRzRnSUNBZ0lDQnBaaUFvY0hKdlkyVnpjeTVsYm5ZdVRrOUVSVjlGVGxZZ0lUMDlJQ2R3Y205a2RXTjBhVzl1SnlrZ2UxeHVJQ0FnSUNBZ0lDQjJZV3hwWkdGMFpWUjVjR1ZFWldZb1EyOXVjM1J5ZFdOMGIzSXNJSEJ5YjNCVWVYQmxjeXdnSjNCeWIzQW5LVHRjYmlBZ0lDQWdJSDFjYmlBZ0lDQWdJRU52Ym5OMGNuVmpkRzl5TG5CeWIzQlVlWEJsY3lBOUlGOWhjM05wWjI0b2UzMHNJRU52Ym5OMGNuVmpkRzl5TG5CeWIzQlVlWEJsY3l3Z2NISnZjRlI1Y0dWektUdGNiaUFnSUNCOUxGeHVJQ0FnSUhOMFlYUnBZM002SUdaMWJtTjBhVzl1S0VOdmJuTjBjblZqZEc5eUxDQnpkR0YwYVdOektTQjdYRzRnSUNBZ0lDQnRhWGhUZEdGMGFXTlRjR1ZqU1c1MGIwTnZiWEJ2Ym1WdWRDaERiMjV6ZEhKMVkzUnZjaXdnYzNSaGRHbGpjeWs3WEc0Z0lDQWdmU3hjYmlBZ0lDQmhkWFJ2WW1sdVpEb2dablZ1WTNScGIyNG9LU0I3ZlZ4dUlDQjlPMXh1WEc0Z0lHWjFibU4wYVc5dUlIWmhiR2xrWVhSbFZIbHdaVVJsWmloRGIyNXpkSEoxWTNSdmNpd2dkSGx3WlVSbFppd2diRzlqWVhScGIyNHBJSHRjYmlBZ0lDQm1iM0lnS0haaGNpQndjbTl3VG1GdFpTQnBiaUIwZVhCbFJHVm1LU0I3WEc0Z0lDQWdJQ0JwWmlBb2RIbHdaVVJsWmk1b1lYTlBkMjVRY205d1pYSjBlU2h3Y205d1RtRnRaU2twSUh0Y2JpQWdJQ0FnSUNBZ0x5OGdkWE5sSUdFZ2QyRnlibWx1WnlCcGJuTjBaV0ZrSUc5bUlHRnVJRjlwYm5aaGNtbGhiblFnYzI4Z1kyOXRjRzl1Wlc1MGMxeHVJQ0FnSUNBZ0lDQXZMeUJrYjI0bmRDQnphRzkzSUhWd0lHbHVJSEJ5YjJRZ1luVjBJRzl1YkhrZ2FXNGdYMTlFUlZaZlgxeHVJQ0FnSUNBZ0lDQnBaaUFvY0hKdlkyVnpjeTVsYm5ZdVRrOUVSVjlGVGxZZ0lUMDlJQ2R3Y205a2RXTjBhVzl1SnlrZ2UxeHVJQ0FnSUNBZ0lDQWdJSGRoY201cGJtY29YRzRnSUNBZ0lDQWdJQ0FnSUNCMGVYQmxiMllnZEhsd1pVUmxabHR3Y205d1RtRnRaVjBnUFQwOUlDZG1kVzVqZEdsdmJpY3NYRzRnSUNBZ0lDQWdJQ0FnSUNBbkpYTTZJQ1Z6SUhSNWNHVWdZQ1Z6WUNCcGN5QnBiblpoYkdsa095QnBkQ0J0ZFhOMElHSmxJR0VnWm5WdVkzUnBiMjRzSUhWemRXRnNiSGtnWm5KdmJTQW5JQ3RjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdKMUpsWVdOMExsQnliM0JVZVhCbGN5NG5MRnh1SUNBZ0lDQWdJQ0FnSUNBZ1EyOXVjM1J5ZFdOMGIzSXVaR2x6Y0d4aGVVNWhiV1VnZkh3Z0oxSmxZV04wUTJ4aGMzTW5MRnh1SUNBZ0lDQWdJQ0FnSUNBZ1VtVmhZM1JRY205d1ZIbHdaVXh2WTJGMGFXOXVUbUZ0WlhOYmJHOWpZWFJwYjI1ZExGeHVJQ0FnSUNBZ0lDQWdJQ0FnY0hKdmNFNWhiV1ZjYmlBZ0lDQWdJQ0FnSUNBcE8xeHVJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQjlYRzRnSUNBZ2ZWeHVJQ0I5WEc1Y2JpQWdablZ1WTNScGIyNGdkbUZzYVdSaGRHVk5aWFJvYjJSUGRtVnljbWxrWlNocGMwRnNjbVZoWkhsRVpXWnBibVZrTENCdVlXMWxLU0I3WEc0Z0lDQWdkbUZ5SUhOd1pXTlFiMnhwWTNrZ1BTQlNaV0ZqZEVOc1lYTnpTVzUwWlhKbVlXTmxMbWhoYzA5M2JsQnliM0JsY25SNUtHNWhiV1VwWEc0Z0lDQWdJQ0EvSUZKbFlXTjBRMnhoYzNOSmJuUmxjbVpoWTJWYmJtRnRaVjFjYmlBZ0lDQWdJRG9nYm5Wc2JEdGNibHh1SUNBZ0lDOHZJRVJwYzJGc2JHOTNJRzkyWlhKeWFXUnBibWNnYjJZZ1ltRnpaU0JqYkdGemN5QnRaWFJvYjJSeklIVnViR1Z6Y3lCbGVIQnNhV05wZEd4NUlHRnNiRzkzWldRdVhHNGdJQ0FnYVdZZ0tGSmxZV04wUTJ4aGMzTk5hWGhwYmk1b1lYTlBkMjVRY205d1pYSjBlU2h1WVcxbEtTa2dlMXh1SUNBZ0lDQWdYMmx1ZG1GeWFXRnVkQ2hjYmlBZ0lDQWdJQ0FnYzNCbFkxQnZiR2xqZVNBOVBUMGdKMDlXUlZKU1NVUkZYMEpCVTBVbkxGeHVJQ0FnSUNBZ0lDQW5VbVZoWTNSRGJHRnpjMGx1ZEdWeVptRmpaVG9nV1c5MUlHRnlaU0JoZEhSbGJYQjBhVzVuSUhSdklHOTJaWEp5YVdSbElDY2dLMXh1SUNBZ0lDQWdJQ0FnSUNkZ0pYTmdJR1p5YjIwZ2VXOTFjaUJqYkdGemN5QnpjR1ZqYVdacFkyRjBhVzl1TGlCRmJuTjFjbVVnZEdoaGRDQjViM1Z5SUcxbGRHaHZaQ0J1WVcxbGN5QW5JQ3RjYmlBZ0lDQWdJQ0FnSUNBblpHOGdibTkwSUc5MlpYSnNZWEFnZDJsMGFDQlNaV0ZqZENCdFpYUm9iMlJ6TGljc1hHNGdJQ0FnSUNBZ0lHNWhiV1ZjYmlBZ0lDQWdJQ2s3WEc0Z0lDQWdmVnh1WEc0Z0lDQWdMeThnUkdsellXeHNiM2NnWkdWbWFXNXBibWNnYldWMGFHOWtjeUJ0YjNKbElIUm9ZVzRnYjI1alpTQjFibXhsYzNNZ1pYaHdiR2xqYVhSc2VTQmhiR3h2ZDJWa0xseHVJQ0FnSUdsbUlDaHBjMEZzY21WaFpIbEVaV1pwYm1Wa0tTQjdYRzRnSUNBZ0lDQmZhVzUyWVhKcFlXNTBLRnh1SUNBZ0lDQWdJQ0J6Y0dWalVHOXNhV041SUQwOVBTQW5SRVZHU1U1RlgwMUJUbGtuSUh4OElITndaV05RYjJ4cFkza2dQVDA5SUNkRVJVWkpUa1ZmVFVGT1dWOU5SVkpIUlVRbkxGeHVJQ0FnSUNBZ0lDQW5VbVZoWTNSRGJHRnpjMGx1ZEdWeVptRmpaVG9nV1c5MUlHRnlaU0JoZEhSbGJYQjBhVzVuSUhSdklHUmxabWx1WlNBbklDdGNiaUFnSUNBZ0lDQWdJQ0FuWUNWellDQnZiaUI1YjNWeUlHTnZiWEJ2Ym1WdWRDQnRiM0psSUhSb1lXNGdiMjVqWlM0Z1ZHaHBjeUJqYjI1bWJHbGpkQ0J0WVhrZ1ltVWdaSFZsSUNjZ0sxeHVJQ0FnSUNBZ0lDQWdJQ2QwYnlCaElHMXBlR2x1TGljc1hHNGdJQ0FnSUNBZ0lHNWhiV1ZjYmlBZ0lDQWdJQ2s3WEc0Z0lDQWdmVnh1SUNCOVhHNWNiaUFnTHlvcVhHNGdJQ0FxSUUxcGVHbHVJR2hsYkhCbGNpQjNhR2xqYUNCb1lXNWtiR1Z6SUhCdmJHbGplU0IyWVd4cFpHRjBhVzl1SUdGdVpDQnlaWE5sY25abFpGeHVJQ0FnS2lCemNHVmphV1pwWTJGMGFXOXVJR3RsZVhNZ2QyaGxiaUJpZFdsc1pHbHVaeUJTWldGamRDQmpiR0Z6YzJWekxseHVJQ0FnS2k5Y2JpQWdablZ1WTNScGIyNGdiV2w0VTNCbFkwbHVkRzlEYjIxd2IyNWxiblFvUTI5dWMzUnlkV04wYjNJc0lITndaV01wSUh0Y2JpQWdJQ0JwWmlBb0lYTndaV01wSUh0Y2JpQWdJQ0FnSUdsbUlDaHdjbTlqWlhOekxtVnVkaTVPVDBSRlgwVk9WaUFoUFQwZ0ozQnliMlIxWTNScGIyNG5LU0I3WEc0Z0lDQWdJQ0FnSUhaaGNpQjBlWEJsYjJaVGNHVmpJRDBnZEhsd1pXOW1JSE53WldNN1hHNGdJQ0FnSUNBZ0lIWmhjaUJwYzAxcGVHbHVWbUZzYVdRZ1BTQjBlWEJsYjJaVGNHVmpJRDA5UFNBbmIySnFaV04wSnlBbUppQnpjR1ZqSUNFOVBTQnVkV3hzTzF4dVhHNGdJQ0FnSUNBZ0lHbG1JQ2h3Y205alpYTnpMbVZ1ZGk1T1QwUkZYMFZPVmlBaFBUMGdKM0J5YjJSMVkzUnBiMjRuS1NCN1hHNGdJQ0FnSUNBZ0lDQWdkMkZ5Ym1sdVp5aGNiaUFnSUNBZ0lDQWdJQ0FnSUdselRXbDRhVzVXWVd4cFpDeGNiaUFnSUNBZ0lDQWdJQ0FnSUZ3aUpYTTZJRmx2ZFNkeVpTQmhkSFJsYlhCMGFXNW5JSFJ2SUdsdVkyeDFaR1VnWVNCdGFYaHBiaUIwYUdGMElHbHpJR1ZwZEdobGNpQnVkV3hzSUZ3aUlDdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0oyOXlJRzV2ZENCaGJpQnZZbXBsWTNRdUlFTm9aV05ySUhSb1pTQnRhWGhwYm5NZ2FXNWpiSFZrWldRZ1lua2dkR2hsSUdOdmJYQnZibVZ1ZEN3Z0p5QXJYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDZGhjeUIzWld4c0lHRnpJR0Z1ZVNCdGFYaHBibk1nZEdobGVTQnBibU5zZFdSbElIUm9aVzF6Wld4MlpYTXVJQ2NnSzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FuUlhod1pXTjBaV1FnYjJKcVpXTjBJR0oxZENCbmIzUWdKWE11Snl4Y2JpQWdJQ0FnSUNBZ0lDQWdJRU52Ym5OMGNuVmpkRzl5TG1ScGMzQnNZWGxPWVcxbElIeDhJQ2RTWldGamRFTnNZWE56Snl4Y2JpQWdJQ0FnSUNBZ0lDQWdJSE53WldNZ1BUMDlJRzUxYkd3Z1B5QnVkV3hzSURvZ2RIbHdaVzltVTNCbFkxeHVJQ0FnSUNBZ0lDQWdJQ2s3WEc0Z0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUgxY2JseHVJQ0FnSUNBZ2NtVjBkWEp1TzF4dUlDQWdJSDFjYmx4dUlDQWdJRjlwYm5aaGNtbGhiblFvWEc0Z0lDQWdJQ0IwZVhCbGIyWWdjM0JsWXlBaFBUMGdKMloxYm1OMGFXOXVKeXhjYmlBZ0lDQWdJRndpVW1WaFkzUkRiR0Z6Y3pvZ1dXOTFKM0psSUdGMGRHVnRjSFJwYm1jZ2RHOGdYQ0lnSzF4dUlDQWdJQ0FnSUNBbmRYTmxJR0VnWTI5dGNHOXVaVzUwSUdOc1lYTnpJRzl5SUdaMWJtTjBhVzl1SUdGeklHRWdiV2w0YVc0dUlFbHVjM1JsWVdRc0lHcDFjM1FnZFhObElHRWdKeUFyWEc0Z0lDQWdJQ0FnSUNkeVpXZDFiR0Z5SUc5aWFtVmpkQzRuWEc0Z0lDQWdLVHRjYmlBZ0lDQmZhVzUyWVhKcFlXNTBLRnh1SUNBZ0lDQWdJV2x6Vm1Gc2FXUkZiR1Z0Wlc1MEtITndaV01wTEZ4dUlDQWdJQ0FnWENKU1pXRmpkRU5zWVhOek9pQlpiM1VuY21VZ1lYUjBaVzF3ZEdsdVp5QjBieUJjSWlBclhHNGdJQ0FnSUNBZ0lDZDFjMlVnWVNCamIyMXdiMjVsYm5RZ1lYTWdZU0J0YVhocGJpNGdTVzV6ZEdWaFpDd2dhblZ6ZENCMWMyVWdZU0J5WldkMWJHRnlJRzlpYW1WamRDNG5YRzRnSUNBZ0tUdGNibHh1SUNBZ0lIWmhjaUJ3Y205MGJ5QTlJRU52Ym5OMGNuVmpkRzl5TG5CeWIzUnZkSGx3WlR0Y2JpQWdJQ0IyWVhJZ1lYVjBiMEpwYm1SUVlXbHljeUE5SUhCeWIzUnZMbDlmY21WaFkzUkJkWFJ2UW1sdVpGQmhhWEp6TzF4dVhHNGdJQ0FnTHk4Z1Fua2dhR0Z1Wkd4cGJtY2diV2w0YVc1eklHSmxabTl5WlNCaGJua2diM1JvWlhJZ2NISnZjR1Z5ZEdsbGN5d2dkMlVnWlc1emRYSmxJSFJvWlNCellXMWxYRzRnSUNBZ0x5OGdZMmhoYVc1cGJtY2diM0prWlhJZ2FYTWdZWEJ3YkdsbFpDQjBieUJ0WlhSb2IyUnpJSGRwZEdnZ1JFVkdTVTVGWDAxQlRsa2djRzlzYVdONUxDQjNhR1YwYUdWeVhHNGdJQ0FnTHk4Z2JXbDRhVzV6SUdGeVpTQnNhWE4wWldRZ1ltVm1iM0psSUc5eUlHRm1kR1Z5SUhSb1pYTmxJRzFsZEdodlpITWdhVzRnZEdobElITndaV011WEc0Z0lDQWdhV1lnS0hOd1pXTXVhR0Z6VDNkdVVISnZjR1Z5ZEhrb1RVbFlTVTVUWDB0RldTa3BJSHRjYmlBZ0lDQWdJRkpGVTBWU1ZrVkVYMU5RUlVOZlMwVlpVeTV0YVhocGJuTW9RMjl1YzNSeWRXTjBiM0lzSUhOd1pXTXViV2w0YVc1ektUdGNiaUFnSUNCOVhHNWNiaUFnSUNCbWIzSWdLSFpoY2lCdVlXMWxJR2x1SUhOd1pXTXBJSHRjYmlBZ0lDQWdJR2xtSUNnaGMzQmxZeTVvWVhOUGQyNVFjbTl3WlhKMGVTaHVZVzFsS1NrZ2UxeHVJQ0FnSUNBZ0lDQmpiMjUwYVc1MVpUdGNiaUFnSUNBZ0lIMWNibHh1SUNBZ0lDQWdhV1lnS0c1aGJXVWdQVDA5SUUxSldFbE9VMTlMUlZrcElIdGNiaUFnSUNBZ0lDQWdMeThnVjJVZ2FHRjJaU0JoYkhKbFlXUjVJR2hoYm1Sc1pXUWdiV2w0YVc1eklHbHVJR0VnYzNCbFkybGhiQ0JqWVhObElHRmliM1psTGx4dUlDQWdJQ0FnSUNCamIyNTBhVzUxWlR0Y2JpQWdJQ0FnSUgxY2JseHVJQ0FnSUNBZ2RtRnlJSEJ5YjNCbGNuUjVJRDBnYzNCbFkxdHVZVzFsWFR0Y2JpQWdJQ0FnSUhaaGNpQnBjMEZzY21WaFpIbEVaV1pwYm1Wa0lEMGdjSEp2ZEc4dWFHRnpUM2R1VUhKdmNHVnlkSGtvYm1GdFpTazdYRzRnSUNBZ0lDQjJZV3hwWkdGMFpVMWxkR2h2WkU5MlpYSnlhV1JsS0dselFXeHlaV0ZrZVVSbFptbHVaV1FzSUc1aGJXVXBPMXh1WEc0Z0lDQWdJQ0JwWmlBb1VrVlRSVkpXUlVSZlUxQkZRMTlMUlZsVExtaGhjMDkzYmxCeWIzQmxjblI1S0c1aGJXVXBLU0I3WEc0Z0lDQWdJQ0FnSUZKRlUwVlNWa1ZFWDFOUVJVTmZTMFZaVTF0dVlXMWxYU2hEYjI1emRISjFZM1J2Y2l3Z2NISnZjR1Z5ZEhrcE8xeHVJQ0FnSUNBZ2ZTQmxiSE5sSUh0Y2JpQWdJQ0FnSUNBZ0x5OGdVMlYwZFhBZ2JXVjBhRzlrY3lCdmJpQndjbTkwYjNSNWNHVTZYRzRnSUNBZ0lDQWdJQzh2SUZSb1pTQm1iMnhzYjNkcGJtY2diV1Z0WW1WeUlHMWxkR2h2WkhNZ2MyaHZkV3hrSUc1dmRDQmlaU0JoZFhSdmJXRjBhV05oYkd4NUlHSnZkVzVrT2x4dUlDQWdJQ0FnSUNBdkx5QXhMaUJGZUhCbFkzUmxaQ0JTWldGamRFTnNZWE56SUcxbGRHaHZaSE1nS0dsdUlIUm9aU0JjSW1sdWRHVnlabUZqWlZ3aUtTNWNiaUFnSUNBZ0lDQWdMeThnTWk0Z1QzWmxjbkpwWkdSbGJpQnRaWFJvYjJSeklDaDBhR0YwSUhkbGNtVWdiV2w0WldRZ2FXNHBMbHh1SUNBZ0lDQWdJQ0IyWVhJZ2FYTlNaV0ZqZEVOc1lYTnpUV1YwYUc5a0lEMGdVbVZoWTNSRGJHRnpjMGx1ZEdWeVptRmpaUzVvWVhOUGQyNVFjbTl3WlhKMGVTaHVZVzFsS1R0Y2JpQWdJQ0FnSUNBZ2RtRnlJR2x6Um5WdVkzUnBiMjRnUFNCMGVYQmxiMllnY0hKdmNHVnlkSGtnUFQwOUlDZG1kVzVqZEdsdmJpYzdYRzRnSUNBZ0lDQWdJSFpoY2lCemFHOTFiR1JCZFhSdlFtbHVaQ0E5WEc0Z0lDQWdJQ0FnSUNBZ2FYTkdkVzVqZEdsdmJpQW1KbHh1SUNBZ0lDQWdJQ0FnSUNGcGMxSmxZV04wUTJ4aGMzTk5aWFJvYjJRZ0ppWmNiaUFnSUNBZ0lDQWdJQ0FoYVhOQmJISmxZV1I1UkdWbWFXNWxaQ0FtSmx4dUlDQWdJQ0FnSUNBZ0lITndaV011WVhWMGIySnBibVFnSVQwOUlHWmhiSE5sTzF4dVhHNGdJQ0FnSUNBZ0lHbG1JQ2h6YUc5MWJHUkJkWFJ2UW1sdVpDa2dlMXh1SUNBZ0lDQWdJQ0FnSUdGMWRHOUNhVzVrVUdGcGNuTXVjSFZ6YUNodVlXMWxMQ0J3Y205d1pYSjBlU2s3WEc0Z0lDQWdJQ0FnSUNBZ2NISnZkRzliYm1GdFpWMGdQU0J3Y205d1pYSjBlVHRjYmlBZ0lDQWdJQ0FnZlNCbGJITmxJSHRjYmlBZ0lDQWdJQ0FnSUNCcFppQW9hWE5CYkhKbFlXUjVSR1ZtYVc1bFpDa2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ2RtRnlJSE53WldOUWIyeHBZM2tnUFNCU1pXRmpkRU5zWVhOelNXNTBaWEptWVdObFcyNWhiV1ZkTzF4dVhHNGdJQ0FnSUNBZ0lDQWdJQ0F2THlCVWFHVnpaU0JqWVhObGN5QnphRzkxYkdRZ1lXeHlaV0ZrZVNCaVpTQmpZWFZuYUhRZ1lua2dkbUZzYVdSaGRHVk5aWFJvYjJSUGRtVnljbWxrWlM1Y2JpQWdJQ0FnSUNBZ0lDQWdJRjlwYm5aaGNtbGhiblFvWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJR2x6VW1WaFkzUkRiR0Z6YzAxbGRHaHZaQ0FtSmx4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNoemNHVmpVRzlzYVdONUlEMDlQU0FuUkVWR1NVNUZYMDFCVGxsZlRVVlNSMFZFSnlCOGZGeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdjM0JsWTFCdmJHbGplU0E5UFQwZ0owUkZSa2xPUlY5TlFVNVpKeWtzWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ2RTWldGamRFTnNZWE56T2lCVmJtVjRjR1ZqZEdWa0lITndaV01nY0c5c2FXTjVJQ1Z6SUdadmNpQnJaWGtnSlhNZ0p5QXJYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdKM2RvWlc0Z2JXbDRhVzVuSUdsdUlHTnZiWEJ2Ym1WdWRDQnpjR1ZqY3k0bkxGeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNCemNHVmpVRzlzYVdONUxGeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNCdVlXMWxYRzRnSUNBZ0lDQWdJQ0FnSUNBcE8xeHVYRzRnSUNBZ0lDQWdJQ0FnSUNBdkx5QkdiM0lnYldWMGFHOWtjeUIzYUdsamFDQmhjbVVnWkdWbWFXNWxaQ0J0YjNKbElIUm9ZVzRnYjI1alpTd2dZMkZzYkNCMGFHVWdaWGhwYzNScGJtZGNiaUFnSUNBZ0lDQWdJQ0FnSUM4dklHMWxkR2h2WkhNZ1ltVm1iM0psSUdOaGJHeHBibWNnZEdobElHNWxkeUJ3Y205d1pYSjBlU3dnYldWeVoybHVaeUJwWmlCaGNIQnliM0J5YVdGMFpTNWNiaUFnSUNBZ0lDQWdJQ0FnSUdsbUlDaHpjR1ZqVUc5c2FXTjVJRDA5UFNBblJFVkdTVTVGWDAxQlRsbGZUVVZTUjBWRUp5a2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQndjbTkwYjF0dVlXMWxYU0E5SUdOeVpXRjBaVTFsY21kbFpGSmxjM1ZzZEVaMWJtTjBhVzl1S0hCeWIzUnZXMjVoYldWZExDQndjbTl3WlhKMGVTazdYRzRnSUNBZ0lDQWdJQ0FnSUNCOUlHVnNjMlVnYVdZZ0tITndaV05RYjJ4cFkza2dQVDA5SUNkRVJVWkpUa1ZmVFVGT1dTY3BJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdjSEp2ZEc5YmJtRnRaVjBnUFNCamNtVmhkR1ZEYUdGcGJtVmtSblZ1WTNScGIyNG9jSEp2ZEc5YmJtRnRaVjBzSUhCeWIzQmxjblI1S1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnSUNCOUlHVnNjMlVnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdjSEp2ZEc5YmJtRnRaVjBnUFNCd2NtOXdaWEowZVR0Y2JpQWdJQ0FnSUNBZ0lDQWdJR2xtSUNod2NtOWpaWE56TG1WdWRpNU9UMFJGWDBWT1ZpQWhQVDBnSjNCeWIyUjFZM1JwYjI0bktTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDOHZJRUZrWkNCMlpYSmliM05sSUdScGMzQnNZWGxPWVcxbElIUnZJSFJvWlNCbWRXNWpkR2x2Yml3Z2QyaHBZMmdnYUdWc2NITWdkMmhsYmlCc2IyOXJhVzVuWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQzh2SUdGMElIQnliMlpwYkdsdVp5QjBiMjlzY3k1Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnYVdZZ0tIUjVjR1Z2WmlCd2NtOXdaWEowZVNBOVBUMGdKMloxYm1OMGFXOXVKeUFtSmlCemNHVmpMbVJwYzNCc1lYbE9ZVzFsS1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2NISnZkRzliYm1GdFpWMHVaR2x6Y0d4aGVVNWhiV1VnUFNCemNHVmpMbVJwYzNCc1lYbE9ZVzFsSUNzZ0oxOG5JQ3NnYm1GdFpUdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdmVnh1SUNBZ0lIMWNiaUFnZlZ4dVhHNGdJR1oxYm1OMGFXOXVJRzFwZUZOMFlYUnBZMU53WldOSmJuUnZRMjl0Y0c5dVpXNTBLRU52Ym5OMGNuVmpkRzl5TENCemRHRjBhV056S1NCN1hHNGdJQ0FnYVdZZ0tDRnpkR0YwYVdOektTQjdYRzRnSUNBZ0lDQnlaWFIxY200N1hHNGdJQ0FnZlZ4dUlDQWdJR1p2Y2lBb2RtRnlJRzVoYldVZ2FXNGdjM1JoZEdsamN5a2dlMXh1SUNBZ0lDQWdkbUZ5SUhCeWIzQmxjblI1SUQwZ2MzUmhkR2xqYzF0dVlXMWxYVHRjYmlBZ0lDQWdJR2xtSUNnaGMzUmhkR2xqY3k1b1lYTlBkMjVRY205d1pYSjBlU2h1WVcxbEtTa2dlMXh1SUNBZ0lDQWdJQ0JqYjI1MGFXNTFaVHRjYmlBZ0lDQWdJSDFjYmx4dUlDQWdJQ0FnZG1GeUlHbHpVbVZ6WlhKMlpXUWdQU0J1WVcxbElHbHVJRkpGVTBWU1ZrVkVYMU5RUlVOZlMwVlpVenRjYmlBZ0lDQWdJRjlwYm5aaGNtbGhiblFvWEc0Z0lDQWdJQ0FnSUNGcGMxSmxjMlZ5ZG1Wa0xGeHVJQ0FnSUNBZ0lDQW5VbVZoWTNSRGJHRnpjem9nV1c5MUlHRnlaU0JoZEhSbGJYQjBhVzVuSUhSdklHUmxabWx1WlNCaElISmxjMlZ5ZG1Wa0lDY2dLMXh1SUNBZ0lDQWdJQ0FnSUNkd2NtOXdaWEowZVN3Z1lDVnpZQ3dnZEdoaGRDQnphRzkxYkdSdVhGd25kQ0JpWlNCdmJpQjBhR1VnWENKemRHRjBhV056WENJZ2EyVjVMaUJFWldacGJtVWdhWFFnSnlBclhHNGdJQ0FnSUNBZ0lDQWdKMkZ6SUdGdUlHbHVjM1JoYm1ObElIQnliM0JsY25SNUlHbHVjM1JsWVdRN0lHbDBJSGRwYkd3Z2MzUnBiR3dnWW1VZ1lXTmpaWE56YVdKc1pTQnZiaUIwYUdVZ0p5QXJYRzRnSUNBZ0lDQWdJQ0FnSjJOdmJuTjBjblZqZEc5eUxpY3NYRzRnSUNBZ0lDQWdJRzVoYldWY2JpQWdJQ0FnSUNrN1hHNWNiaUFnSUNBZ0lIWmhjaUJwYzBsdWFHVnlhWFJsWkNBOUlHNWhiV1VnYVc0Z1EyOXVjM1J5ZFdOMGIzSTdYRzRnSUNBZ0lDQmZhVzUyWVhKcFlXNTBLRnh1SUNBZ0lDQWdJQ0FoYVhOSmJtaGxjbWwwWldRc1hHNGdJQ0FnSUNBZ0lDZFNaV0ZqZEVOc1lYTnpPaUJaYjNVZ1lYSmxJR0YwZEdWdGNIUnBibWNnZEc4Z1pHVm1hVzVsSUNjZ0sxeHVJQ0FnSUNBZ0lDQWdJQ2RnSlhOZ0lHOXVJSGx2ZFhJZ1kyOXRjRzl1Wlc1MElHMXZjbVVnZEdoaGJpQnZibU5sTGlCVWFHbHpJR052Ym1ac2FXTjBJRzFoZVNCaVpTQW5JQ3RjYmlBZ0lDQWdJQ0FnSUNBblpIVmxJSFJ2SUdFZ2JXbDRhVzR1Snl4Y2JpQWdJQ0FnSUNBZ2JtRnRaVnh1SUNBZ0lDQWdLVHRjYmlBZ0lDQWdJRU52Ym5OMGNuVmpkRzl5VzI1aGJXVmRJRDBnY0hKdmNHVnlkSGs3WEc0Z0lDQWdmVnh1SUNCOVhHNWNiaUFnTHlvcVhHNGdJQ0FxSUUxbGNtZGxJSFIzYnlCdlltcGxZM1J6TENCaWRYUWdkR2h5YjNjZ2FXWWdZbTkwYUNCamIyNTBZV2x1SUhSb1pTQnpZVzFsSUd0bGVTNWNiaUFnSUNwY2JpQWdJQ29nUUhCaGNtRnRJSHR2WW1wbFkzUjlJRzl1WlNCVWFHVWdabWx5YzNRZ2IySnFaV04wTENCM2FHbGphQ0JwY3lCdGRYUmhkR1ZrTGx4dUlDQWdLaUJBY0dGeVlXMGdlMjlpYW1WamRIMGdkSGR2SUZSb1pTQnpaV052Ym1RZ2IySnFaV04wWEc0Z0lDQXFJRUJ5WlhSMWNtNGdlMjlpYW1WamRIMGdiMjVsSUdGbWRHVnlJR2wwSUdoaGN5QmlaV1Z1SUcxMWRHRjBaV1FnZEc4Z1kyOXVkR0ZwYmlCbGRtVnllWFJvYVc1bklHbHVJSFIzYnk1Y2JpQWdJQ292WEc0Z0lHWjFibU4wYVc5dUlHMWxjbWRsU1c1MGIxZHBkR2hPYjBSMWNHeHBZMkYwWlV0bGVYTW9iMjVsTENCMGQyOHBJSHRjYmlBZ0lDQmZhVzUyWVhKcFlXNTBLRnh1SUNBZ0lDQWdiMjVsSUNZbUlIUjNieUFtSmlCMGVYQmxiMllnYjI1bElEMDlQU0FuYjJKcVpXTjBKeUFtSmlCMGVYQmxiMllnZEhkdklEMDlQU0FuYjJKcVpXTjBKeXhjYmlBZ0lDQWdJQ2R0WlhKblpVbHVkRzlYYVhSb1RtOUVkWEJzYVdOaGRHVkxaWGx6S0NrNklFTmhibTV2ZENCdFpYSm5aU0J1YjI0dGIySnFaV04wY3k0blhHNGdJQ0FnS1R0Y2JseHVJQ0FnSUdadmNpQW9kbUZ5SUd0bGVTQnBiaUIwZDI4cElIdGNiaUFnSUNBZ0lHbG1JQ2gwZDI4dWFHRnpUM2R1VUhKdmNHVnlkSGtvYTJWNUtTa2dlMXh1SUNBZ0lDQWdJQ0JmYVc1MllYSnBZVzUwS0Z4dUlDQWdJQ0FnSUNBZ0lHOXVaVnRyWlhsZElEMDlQU0IxYm1SbFptbHVaV1FzWEc0Z0lDQWdJQ0FnSUNBZ0oyMWxjbWRsU1c1MGIxZHBkR2hPYjBSMWNHeHBZMkYwWlV0bGVYTW9LVG9nSnlBclhHNGdJQ0FnSUNBZ0lDQWdJQ0FuVkhKcFpXUWdkRzhnYldWeVoyVWdkSGR2SUc5aWFtVmpkSE1nZDJsMGFDQjBhR1VnYzJGdFpTQnJaWGs2SUdBbGMyQXVJRlJvYVhNZ1kyOXVabXhwWTNRZ0p5QXJYRzRnSUNBZ0lDQWdJQ0FnSUNBbmJXRjVJR0psSUdSMVpTQjBieUJoSUcxcGVHbHVPeUJwYmlCd1lYSjBhV04xYkdGeUxDQjBhR2x6SUcxaGVTQmlaU0JqWVhWelpXUWdZbmtnZEhkdklDY2dLMXh1SUNBZ0lDQWdJQ0FnSUNBZ0oyZGxkRWx1YVhScFlXeFRkR0YwWlNncElHOXlJR2RsZEVSbFptRjFiSFJRY205d2N5Z3BJRzFsZEdodlpITWdjbVYwZFhKdWFXNW5JRzlpYW1WamRITWdKeUFyWEc0Z0lDQWdJQ0FnSUNBZ0lDQW5kMmwwYUNCamJHRnphR2x1WnlCclpYbHpMaWNzWEc0Z0lDQWdJQ0FnSUNBZ2EyVjVYRzRnSUNBZ0lDQWdJQ2s3WEc0Z0lDQWdJQ0FnSUc5dVpWdHJaWGxkSUQwZ2RIZHZXMnRsZVYwN1hHNGdJQ0FnSUNCOVhHNGdJQ0FnZlZ4dUlDQWdJSEpsZEhWeWJpQnZibVU3WEc0Z0lIMWNibHh1SUNBdktpcGNiaUFnSUNvZ1EzSmxZWFJsY3lCaElHWjFibU4wYVc5dUlIUm9ZWFFnYVc1MmIydGxjeUIwZDI4Z1puVnVZM1JwYjI1eklHRnVaQ0J0WlhKblpYTWdkR2hsYVhJZ2NtVjBkWEp1SUhaaGJIVmxjeTVjYmlBZ0lDcGNiaUFnSUNvZ1FIQmhjbUZ0SUh0bWRXNWpkR2x2Ym4wZ2IyNWxJRVoxYm1OMGFXOXVJSFJ2SUdsdWRtOXJaU0JtYVhKemRDNWNiaUFnSUNvZ1FIQmhjbUZ0SUh0bWRXNWpkR2x2Ym4wZ2RIZHZJRVoxYm1OMGFXOXVJSFJ2SUdsdWRtOXJaU0J6WldOdmJtUXVYRzRnSUNBcUlFQnlaWFIxY200Z2UyWjFibU4wYVc5dWZTQkdkVzVqZEdsdmJpQjBhR0YwSUdsdWRtOXJaWE1nZEdobElIUjNieUJoY21kMWJXVnVkQ0JtZFc1amRHbHZibk11WEc0Z0lDQXFJRUJ3Y21sMllYUmxYRzRnSUNBcUwxeHVJQ0JtZFc1amRHbHZiaUJqY21WaGRHVk5aWEpuWldSU1pYTjFiSFJHZFc1amRHbHZiaWh2Ym1Vc0lIUjNieWtnZTF4dUlDQWdJSEpsZEhWeWJpQm1kVzVqZEdsdmJpQnRaWEpuWldSU1pYTjFiSFFvS1NCN1hHNGdJQ0FnSUNCMllYSWdZU0E5SUc5dVpTNWhjSEJzZVNoMGFHbHpMQ0JoY21kMWJXVnVkSE1wTzF4dUlDQWdJQ0FnZG1GeUlHSWdQU0IwZDI4dVlYQndiSGtvZEdocGN5d2dZWEpuZFcxbGJuUnpLVHRjYmlBZ0lDQWdJR2xtSUNoaElEMDlJRzUxYkd3cElIdGNiaUFnSUNBZ0lDQWdjbVYwZFhKdUlHSTdYRzRnSUNBZ0lDQjlJR1ZzYzJVZ2FXWWdLR0lnUFQwZ2JuVnNiQ2tnZTF4dUlDQWdJQ0FnSUNCeVpYUjFjbTRnWVR0Y2JpQWdJQ0FnSUgxY2JpQWdJQ0FnSUhaaGNpQmpJRDBnZTMwN1hHNGdJQ0FnSUNCdFpYSm5aVWx1ZEc5WGFYUm9UbTlFZFhCc2FXTmhkR1ZMWlhsektHTXNJR0VwTzF4dUlDQWdJQ0FnYldWeVoyVkpiblJ2VjJsMGFFNXZSSFZ3YkdsallYUmxTMlY1Y3loakxDQmlLVHRjYmlBZ0lDQWdJSEpsZEhWeWJpQmpPMXh1SUNBZ0lIMDdYRzRnSUgxY2JseHVJQ0F2S2lwY2JpQWdJQ29nUTNKbFlYUmxjeUJoSUdaMWJtTjBhVzl1SUhSb1lYUWdhVzUyYjJ0bGN5QjBkMjhnWm5WdVkzUnBiMjV6SUdGdVpDQnBaMjV2Y21WeklIUm9aV2x5SUhKbGRIVnliaUIyWVd4bGN5NWNiaUFnSUNwY2JpQWdJQ29nUUhCaGNtRnRJSHRtZFc1amRHbHZibjBnYjI1bElFWjFibU4wYVc5dUlIUnZJR2x1ZG05clpTQm1hWEp6ZEM1Y2JpQWdJQ29nUUhCaGNtRnRJSHRtZFc1amRHbHZibjBnZEhkdklFWjFibU4wYVc5dUlIUnZJR2x1ZG05clpTQnpaV052Ym1RdVhHNGdJQ0FxSUVCeVpYUjFjbTRnZTJaMWJtTjBhVzl1ZlNCR2RXNWpkR2x2YmlCMGFHRjBJR2x1ZG05clpYTWdkR2hsSUhSM2J5QmhjbWQxYldWdWRDQm1kVzVqZEdsdmJuTXVYRzRnSUNBcUlFQndjbWwyWVhSbFhHNGdJQ0FxTDF4dUlDQm1kVzVqZEdsdmJpQmpjbVZoZEdWRGFHRnBibVZrUm5WdVkzUnBiMjRvYjI1bExDQjBkMjhwSUh0Y2JpQWdJQ0J5WlhSMWNtNGdablZ1WTNScGIyNGdZMmhoYVc1bFpFWjFibU4wYVc5dUtDa2dlMXh1SUNBZ0lDQWdiMjVsTG1Gd2NHeDVLSFJvYVhNc0lHRnlaM1Z0Wlc1MGN5azdYRzRnSUNBZ0lDQjBkMjh1WVhCd2JIa29kR2hwY3l3Z1lYSm5kVzFsYm5SektUdGNiaUFnSUNCOU8xeHVJQ0I5WEc1Y2JpQWdMeW9xWEc0Z0lDQXFJRUpwYm1SeklHRWdiV1YwYUc5a0lIUnZJSFJvWlNCamIyMXdiMjVsYm5RdVhHNGdJQ0FxWEc0Z0lDQXFJRUJ3WVhKaGJTQjdiMkpxWldOMGZTQmpiMjF3YjI1bGJuUWdRMjl0Y0c5dVpXNTBJSGRvYjNObElHMWxkR2h2WkNCcGN5Qm5iMmx1WnlCMGJ5QmlaU0JpYjNWdVpDNWNiaUFnSUNvZ1FIQmhjbUZ0SUh0bWRXNWpkR2x2Ym4wZ2JXVjBhRzlrSUUxbGRHaHZaQ0IwYnlCaVpTQmliM1Z1WkM1Y2JpQWdJQ29nUUhKbGRIVnliaUI3Wm5WdVkzUnBiMjU5SUZSb1pTQmliM1Z1WkNCdFpYUm9iMlF1WEc0Z0lDQXFMMXh1SUNCbWRXNWpkR2x2YmlCaWFXNWtRWFYwYjBKcGJtUk5aWFJvYjJRb1kyOXRjRzl1Wlc1MExDQnRaWFJvYjJRcElIdGNiaUFnSUNCMllYSWdZbTkxYm1STlpYUm9iMlFnUFNCdFpYUm9iMlF1WW1sdVpDaGpiMjF3YjI1bGJuUXBPMXh1SUNBZ0lHbG1JQ2h3Y205alpYTnpMbVZ1ZGk1T1QwUkZYMFZPVmlBaFBUMGdKM0J5YjJSMVkzUnBiMjRuS1NCN1hHNGdJQ0FnSUNCaWIzVnVaRTFsZEdodlpDNWZYM0psWVdOMFFtOTFibVJEYjI1MFpYaDBJRDBnWTI5dGNHOXVaVzUwTzF4dUlDQWdJQ0FnWW05MWJtUk5aWFJvYjJRdVgxOXlaV0ZqZEVKdmRXNWtUV1YwYUc5a0lEMGdiV1YwYUc5a08xeHVJQ0FnSUNBZ1ltOTFibVJOWlhSb2IyUXVYMTl5WldGamRFSnZkVzVrUVhKbmRXMWxiblJ6SUQwZ2JuVnNiRHRjYmlBZ0lDQWdJSFpoY2lCamIyMXdiMjVsYm5ST1lXMWxJRDBnWTI5dGNHOXVaVzUwTG1OdmJuTjBjblZqZEc5eUxtUnBjM0JzWVhsT1lXMWxPMXh1SUNBZ0lDQWdkbUZ5SUY5aWFXNWtJRDBnWW05MWJtUk5aWFJvYjJRdVltbHVaRHRjYmlBZ0lDQWdJR0p2ZFc1a1RXVjBhRzlrTG1KcGJtUWdQU0JtZFc1amRHbHZiaWh1WlhkVWFHbHpLU0I3WEc0Z0lDQWdJQ0FnSUdadmNpQW9YRzRnSUNBZ0lDQWdJQ0FnZG1GeUlGOXNaVzRnUFNCaGNtZDFiV1Z1ZEhNdWJHVnVaM1JvTEZ4dUlDQWdJQ0FnSUNBZ0lDQWdZWEpuY3lBOUlFRnljbUY1S0Y5c1pXNGdQaUF4SUQ4Z1gyeGxiaUF0SURFZ09pQXdLU3hjYmlBZ0lDQWdJQ0FnSUNBZ0lGOXJaWGtnUFNBeE8xeHVJQ0FnSUNBZ0lDQWdJRjlyWlhrZ1BDQmZiR1Z1TzF4dUlDQWdJQ0FnSUNBZ0lGOXJaWGtySzF4dUlDQWdJQ0FnSUNBcElIdGNiaUFnSUNBZ0lDQWdJQ0JoY21kelcxOXJaWGtnTFNBeFhTQTlJR0Z5WjNWdFpXNTBjMXRmYTJWNVhUdGNiaUFnSUNBZ0lDQWdmVnh1WEc0Z0lDQWdJQ0FnSUM4dklGVnpaWElnYVhNZ2RISjVhVzVuSUhSdklHSnBibVFvS1NCaGJpQmhkWFJ2WW05MWJtUWdiV1YwYUc5a095QjNaU0JsWm1abFkzUnBkbVZzZVNCM2FXeHNYRzRnSUNBZ0lDQWdJQzh2SUdsbmJtOXlaU0IwYUdVZ2RtRnNkV1VnYjJZZ1hDSjBhR2x6WENJZ2RHaGhkQ0IwYUdVZ2RYTmxjaUJwY3lCMGNubHBibWNnZEc4Z2RYTmxMQ0J6YjF4dUlDQWdJQ0FnSUNBdkx5QnNaWFFuY3lCM1lYSnVMbHh1SUNBZ0lDQWdJQ0JwWmlBb2JtVjNWR2hwY3lBaFBUMGdZMjl0Y0c5dVpXNTBJQ1ltSUc1bGQxUm9hWE1nSVQwOUlHNTFiR3dwSUh0Y2JpQWdJQ0FnSUNBZ0lDQnBaaUFvY0hKdlkyVnpjeTVsYm5ZdVRrOUVSVjlGVGxZZ0lUMDlJQ2R3Y205a2RXTjBhVzl1SnlrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnZDJGeWJtbHVaeWhjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdabUZzYzJVc1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNkaWFXNWtLQ2s2SUZKbFlXTjBJR052YlhCdmJtVnVkQ0J0WlhSb2IyUnpJRzFoZVNCdmJteDVJR0psSUdKdmRXNWtJSFJ2SUhSb1pTQW5JQ3RjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FuWTI5dGNHOXVaVzUwSUdsdWMzUmhibU5sTGlCVFpXVWdKWE1uTEZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0JqYjIxd2IyNWxiblJPWVcxbFhHNGdJQ0FnSUNBZ0lDQWdJQ0FwTzF4dUlDQWdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdmU0JsYkhObElHbG1JQ2doWVhKbmN5NXNaVzVuZEdncElIdGNiaUFnSUNBZ0lDQWdJQ0JwWmlBb2NISnZZMlZ6Y3k1bGJuWXVUazlFUlY5RlRsWWdJVDA5SUNkd2NtOWtkV04wYVc5dUp5a2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ2QyRnlibWx1WnloY2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnWm1Gc2MyVXNYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDZGlhVzVrS0NrNklGbHZkU0JoY21VZ1ltbHVaR2x1WnlCaElHTnZiWEJ2Ym1WdWRDQnRaWFJvYjJRZ2RHOGdkR2hsSUdOdmJYQnZibVZ1ZEM0Z0p5QXJYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdKMUpsWVdOMElHUnZaWE1nZEdocGN5Qm1iM0lnZVc5MUlHRjFkRzl0WVhScFkyRnNiSGtnYVc0Z1lTQm9hV2RvTFhCbGNtWnZjbTFoYm1ObElDY2dLMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ2QzWVhrc0lITnZJSGx2ZFNCallXNGdjMkZtWld4NUlISmxiVzkyWlNCMGFHbHpJR05oYkd3dUlGTmxaU0FsY3ljc1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUdOdmJYQnZibVZ1ZEU1aGJXVmNiaUFnSUNBZ0lDQWdJQ0FnSUNrN1hHNGdJQ0FnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUJpYjNWdVpFMWxkR2h2WkR0Y2JpQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ0lDQjJZWElnY21WaWIzVnVaRTFsZEdodlpDQTlJRjlpYVc1a0xtRndjR3g1S0dKdmRXNWtUV1YwYUc5a0xDQmhjbWQxYldWdWRITXBPMXh1SUNBZ0lDQWdJQ0J5WldKdmRXNWtUV1YwYUc5a0xsOWZjbVZoWTNSQ2IzVnVaRU52Ym5SbGVIUWdQU0JqYjIxd2IyNWxiblE3WEc0Z0lDQWdJQ0FnSUhKbFltOTFibVJOWlhSb2IyUXVYMTl5WldGamRFSnZkVzVrVFdWMGFHOWtJRDBnYldWMGFHOWtPMXh1SUNBZ0lDQWdJQ0J5WldKdmRXNWtUV1YwYUc5a0xsOWZjbVZoWTNSQ2IzVnVaRUZ5WjNWdFpXNTBjeUE5SUdGeVozTTdYRzRnSUNBZ0lDQWdJSEpsZEhWeWJpQnlaV0p2ZFc1a1RXVjBhRzlrTzF4dUlDQWdJQ0FnZlR0Y2JpQWdJQ0I5WEc0Z0lDQWdjbVYwZFhKdUlHSnZkVzVrVFdWMGFHOWtPMXh1SUNCOVhHNWNiaUFnTHlvcVhHNGdJQ0FxSUVKcGJtUnpJR0ZzYkNCaGRYUnZMV0p2ZFc1a0lHMWxkR2h2WkhNZ2FXNGdZU0JqYjIxd2IyNWxiblF1WEc0Z0lDQXFYRzRnSUNBcUlFQndZWEpoYlNCN2IySnFaV04wZlNCamIyMXdiMjVsYm5RZ1EyOXRjRzl1Wlc1MElIZG9iM05sSUcxbGRHaHZaQ0JwY3lCbmIybHVaeUIwYnlCaVpTQmliM1Z1WkM1Y2JpQWdJQ292WEc0Z0lHWjFibU4wYVc5dUlHSnBibVJCZFhSdlFtbHVaRTFsZEdodlpITW9ZMjl0Y0c5dVpXNTBLU0I3WEc0Z0lDQWdkbUZ5SUhCaGFYSnpJRDBnWTI5dGNHOXVaVzUwTGw5ZmNtVmhZM1JCZFhSdlFtbHVaRkJoYVhKek8xeHVJQ0FnSUdadmNpQW9kbUZ5SUdrZ1BTQXdPeUJwSUR3Z2NHRnBjbk11YkdWdVozUm9PeUJwSUNzOUlESXBJSHRjYmlBZ0lDQWdJSFpoY2lCaGRYUnZRbWx1WkV0bGVTQTlJSEJoYVhKelcybGRPMXh1SUNBZ0lDQWdkbUZ5SUcxbGRHaHZaQ0E5SUhCaGFYSnpXMmtnS3lBeFhUdGNiaUFnSUNBZ0lHTnZiWEJ2Ym1WdWRGdGhkWFJ2UW1sdVpFdGxlVjBnUFNCaWFXNWtRWFYwYjBKcGJtUk5aWFJvYjJRb1kyOXRjRzl1Wlc1MExDQnRaWFJvYjJRcE8xeHVJQ0FnSUgxY2JpQWdmVnh1WEc0Z0lIWmhjaUJKYzAxdmRXNTBaV1JRY21WTmFYaHBiaUE5SUh0Y2JpQWdJQ0JqYjIxd2IyNWxiblJFYVdSTmIzVnVkRG9nWm5WdVkzUnBiMjRvS1NCN1hHNGdJQ0FnSUNCMGFHbHpMbDlmYVhOTmIzVnVkR1ZrSUQwZ2RISjFaVHRjYmlBZ0lDQjlYRzRnSUgwN1hHNWNiaUFnZG1GeUlFbHpUVzkxYm5SbFpGQnZjM1JOYVhocGJpQTlJSHRjYmlBZ0lDQmpiMjF3YjI1bGJuUlhhV3hzVlc1dGIzVnVkRG9nWm5WdVkzUnBiMjRvS1NCN1hHNGdJQ0FnSUNCMGFHbHpMbDlmYVhOTmIzVnVkR1ZrSUQwZ1ptRnNjMlU3WEc0Z0lDQWdmVnh1SUNCOU8xeHVYRzRnSUM4cUtseHVJQ0FnS2lCQlpHUWdiVzl5WlNCMGJ5QjBhR1VnVW1WaFkzUkRiR0Z6Y3lCaVlYTmxJR05zWVhOekxpQlVhR1Z6WlNCaGNtVWdZV3hzSUd4bFoyRmplU0JtWldGMGRYSmxjeUJoYm1SY2JpQWdJQ29nZEdobGNtVm1iM0psSUc1dmRDQmhiSEpsWVdSNUlIQmhjblFnYjJZZ2RHaGxJRzF2WkdWeWJpQlNaV0ZqZEVOdmJYQnZibVZ1ZEM1Y2JpQWdJQ292WEc0Z0lIWmhjaUJTWldGamRFTnNZWE56VFdsNGFXNGdQU0I3WEc0Z0lDQWdMeW9xWEc0Z0lDQWdJQ29nVkU5RVR6b2dWR2hwY3lCM2FXeHNJR0psSUdSbGNISmxZMkYwWldRZ1ltVmpZWFZ6WlNCemRHRjBaU0J6YUc5MWJHUWdZV3gzWVhseklHdGxaWEFnWVNCamIyNXphWE4wWlc1MFhHNGdJQ0FnSUNvZ2RIbHdaU0J6YVdkdVlYUjFjbVVnWVc1a0lIUm9aU0J2Ym14NUlIVnpaU0JqWVhObElHWnZjaUIwYUdsekxDQnBjeUIwYnlCaGRtOXBaQ0IwYUdGMExseHVJQ0FnSUNBcUwxeHVJQ0FnSUhKbGNHeGhZMlZUZEdGMFpUb2dablZ1WTNScGIyNG9ibVYzVTNSaGRHVXNJR05oYkd4aVlXTnJLU0I3WEc0Z0lDQWdJQ0IwYUdsekxuVndaR0YwWlhJdVpXNXhkV1YxWlZKbGNHeGhZMlZUZEdGMFpTaDBhR2x6TENCdVpYZFRkR0YwWlN3Z1kyRnNiR0poWTJzcE8xeHVJQ0FnSUgwc1hHNWNiaUFnSUNBdktpcGNiaUFnSUNBZ0tpQkRhR1ZqYTNNZ2QyaGxkR2hsY2lCdmNpQnViM1FnZEdocGN5QmpiMjF3YjNOcGRHVWdZMjl0Y0c5dVpXNTBJR2x6SUcxdmRXNTBaV1F1WEc0Z0lDQWdJQ29nUUhKbGRIVnliaUI3WW05dmJHVmhibjBnVkhKMVpTQnBaaUJ0YjNWdWRHVmtMQ0JtWVd4elpTQnZkR2hsY25kcGMyVXVYRzRnSUNBZ0lDb2dRSEJ5YjNSbFkzUmxaRnh1SUNBZ0lDQXFJRUJtYVc1aGJGeHVJQ0FnSUNBcUwxeHVJQ0FnSUdselRXOTFiblJsWkRvZ1puVnVZM1JwYjI0b0tTQjdYRzRnSUNBZ0lDQnBaaUFvY0hKdlkyVnpjeTVsYm5ZdVRrOUVSVjlGVGxZZ0lUMDlJQ2R3Y205a2RXTjBhVzl1SnlrZ2UxeHVJQ0FnSUNBZ0lDQjNZWEp1YVc1bktGeHVJQ0FnSUNBZ0lDQWdJSFJvYVhNdVgxOWthV1JYWVhKdVNYTk5iM1Z1ZEdWa0xGeHVJQ0FnSUNBZ0lDQWdJQ2NsY3pvZ2FYTk5iM1Z1ZEdWa0lHbHpJR1JsY0hKbFkyRjBaV1F1SUVsdWMzUmxZV1FzSUcxaGEyVWdjM1Z5WlNCMGJ5QmpiR1ZoYmlCMWNDQW5JQ3RjYmlBZ0lDQWdJQ0FnSUNBZ0lDZHpkV0p6WTNKcGNIUnBiMjV6SUdGdVpDQndaVzVrYVc1bklISmxjWFZsYzNSeklHbHVJR052YlhCdmJtVnVkRmRwYkd4VmJtMXZkVzUwSUhSdklDY2dLMXh1SUNBZ0lDQWdJQ0FnSUNBZ0ozQnlaWFpsYm5RZ2JXVnRiM0o1SUd4bFlXdHpMaWNzWEc0Z0lDQWdJQ0FnSUNBZ0tIUm9hWE11WTI5dWMzUnlkV04wYjNJZ0ppWWdkR2hwY3k1amIyNXpkSEoxWTNSdmNpNWthWE53YkdGNVRtRnRaU2tnZkh4Y2JpQWdJQ0FnSUNBZ0lDQWdJSFJvYVhNdWJtRnRaU0I4ZkZ4dUlDQWdJQ0FnSUNBZ0lDQWdKME52YlhCdmJtVnVkQ2RjYmlBZ0lDQWdJQ0FnS1R0Y2JpQWdJQ0FnSUNBZ2RHaHBjeTVmWDJScFpGZGhjbTVKYzAxdmRXNTBaV1FnUFNCMGNuVmxPMXh1SUNBZ0lDQWdmVnh1SUNBZ0lDQWdjbVYwZFhKdUlDRWhkR2hwY3k1ZlgybHpUVzkxYm5SbFpEdGNiaUFnSUNCOVhHNGdJSDA3WEc1Y2JpQWdkbUZ5SUZKbFlXTjBRMnhoYzNORGIyMXdiMjVsYm5RZ1BTQm1kVzVqZEdsdmJpZ3BJSHQ5TzF4dUlDQmZZWE56YVdkdUtGeHVJQ0FnSUZKbFlXTjBRMnhoYzNORGIyMXdiMjVsYm5RdWNISnZkRzkwZVhCbExGeHVJQ0FnSUZKbFlXTjBRMjl0Y0c5dVpXNTBMbkJ5YjNSdmRIbHdaU3hjYmlBZ0lDQlNaV0ZqZEVOc1lYTnpUV2w0YVc1Y2JpQWdLVHRjYmx4dUlDQXZLaXBjYmlBZ0lDb2dRM0psWVhSbGN5QmhJR052YlhCdmMybDBaU0JqYjIxd2IyNWxiblFnWTJ4aGMzTWdaMmwyWlc0Z1lTQmpiR0Z6Y3lCemNHVmphV1pwWTJGMGFXOXVMbHh1SUNBZ0tpQlRaV1VnYUhSMGNITTZMeTltWVdObFltOXZheTVuYVhSb2RXSXVhVzh2Y21WaFkzUXZaRzlqY3k5MGIzQXRiR1YyWld3dFlYQnBMbWgwYld3amNtVmhZM1F1WTNKbFlYUmxZMnhoYzNOY2JpQWdJQ3BjYmlBZ0lDb2dRSEJoY21GdElIdHZZbXBsWTNSOUlITndaV01nUTJ4aGMzTWdjM0JsWTJsbWFXTmhkR2x2YmlBb2QyaHBZMmdnYlhWemRDQmtaV1pwYm1VZ1lISmxibVJsY21BcExseHVJQ0FnS2lCQWNtVjBkWEp1SUh0bWRXNWpkR2x2Ym4wZ1EyOXRjRzl1Wlc1MElHTnZibk4wY25WamRHOXlJR1oxYm1OMGFXOXVMbHh1SUNBZ0tpQkFjSFZpYkdsalhHNGdJQ0FxTDF4dUlDQm1kVzVqZEdsdmJpQmpjbVZoZEdWRGJHRnpjeWh6Y0dWaktTQjdYRzRnSUNBZ0x5OGdWRzhnYTJWbGNDQnZkWElnZDJGeWJtbHVaM01nYlc5eVpTQjFibVJsY25OMFlXNWtZV0pzWlN3Z2QyVW5iR3dnZFhObElHRWdiR2wwZEd4bElHaGhZMnNnYUdWeVpTQjBiMXh1SUNBZ0lDOHZJR1Z1YzNWeVpTQjBhR0YwSUVOdmJuTjBjblZqZEc5eUxtNWhiV1VnSVQwOUlDZERiMjV6ZEhKMVkzUnZjaWN1SUZSb2FYTWdiV0ZyWlhNZ2MzVnlaU0IzWlNCa2IyNG5kRnh1SUNBZ0lDOHZJSFZ1Ym1WalpYTnpZWEpwYkhrZ2FXUmxiblJwWm5rZ1lTQmpiR0Z6Y3lCM2FYUm9iM1YwSUdScGMzQnNZWGxPWVcxbElHRnpJQ2REYjI1emRISjFZM1J2Y2ljdVhHNGdJQ0FnZG1GeUlFTnZibk4wY25WamRHOXlJRDBnYVdSbGJuUnBkSGtvWm5WdVkzUnBiMjRvY0hKdmNITXNJR052Ym5SbGVIUXNJSFZ3WkdGMFpYSXBJSHRjYmlBZ0lDQWdJQzh2SUZSb2FYTWdZMjl1YzNSeWRXTjBiM0lnWjJWMGN5QnZkbVZ5Y21sa1pHVnVJR0o1SUcxdlkydHpMaUJVYUdVZ1lYSm5kVzFsYm5RZ2FYTWdkWE5sWkZ4dUlDQWdJQ0FnTHk4Z1lua2diVzlqYTNNZ2RHOGdZWE56WlhKMElHOXVJSGRvWVhRZ1oyVjBjeUJ0YjNWdWRHVmtMbHh1WEc0Z0lDQWdJQ0JwWmlBb2NISnZZMlZ6Y3k1bGJuWXVUazlFUlY5RlRsWWdJVDA5SUNkd2NtOWtkV04wYVc5dUp5a2dlMXh1SUNBZ0lDQWdJQ0IzWVhKdWFXNW5LRnh1SUNBZ0lDQWdJQ0FnSUhSb2FYTWdhVzV6ZEdGdVkyVnZaaUJEYjI1emRISjFZM1J2Y2l4Y2JpQWdJQ0FnSUNBZ0lDQW5VMjl0WlhSb2FXNW5JR2x6SUdOaGJHeHBibWNnWVNCU1pXRmpkQ0JqYjIxd2IyNWxiblFnWkdseVpXTjBiSGt1SUZWelpTQmhJR1poWTNSdmNua2diM0lnSnlBclhHNGdJQ0FnSUNBZ0lDQWdJQ0FuU2xOWUlHbHVjM1JsWVdRdUlGTmxaVG9nYUhSMGNITTZMeTltWWk1dFpTOXlaV0ZqZEMxc1pXZGhZM2xtWVdOMGIzSjVKMXh1SUNBZ0lDQWdJQ0FwTzF4dUlDQWdJQ0FnZlZ4dVhHNGdJQ0FnSUNBdkx5QlhhWEpsSUhWd0lHRjFkRzh0WW1sdVpHbHVaMXh1SUNBZ0lDQWdhV1lnS0hSb2FYTXVYMTl5WldGamRFRjFkRzlDYVc1a1VHRnBjbk11YkdWdVozUm9LU0I3WEc0Z0lDQWdJQ0FnSUdKcGJtUkJkWFJ2UW1sdVpFMWxkR2h2WkhNb2RHaHBjeWs3WEc0Z0lDQWdJQ0I5WEc1Y2JpQWdJQ0FnSUhSb2FYTXVjSEp2Y0hNZ1BTQndjbTl3Y3p0Y2JpQWdJQ0FnSUhSb2FYTXVZMjl1ZEdWNGRDQTlJR052Ym5SbGVIUTdYRzRnSUNBZ0lDQjBhR2x6TG5KbFpuTWdQU0JsYlhCMGVVOWlhbVZqZER0Y2JpQWdJQ0FnSUhSb2FYTXVkWEJrWVhSbGNpQTlJSFZ3WkdGMFpYSWdmSHdnVW1WaFkzUk9iMjl3VlhCa1lYUmxVWFZsZFdVN1hHNWNiaUFnSUNBZ0lIUm9hWE11YzNSaGRHVWdQU0J1ZFd4c08xeHVYRzRnSUNBZ0lDQXZMeUJTWldGamRFTnNZWE56WlhNZ1pHOWxjMjRuZENCb1lYWmxJR052Ym5OMGNuVmpkRzl5Y3k0Z1NXNXpkR1ZoWkN3Z2RHaGxlU0IxYzJVZ2RHaGxYRzRnSUNBZ0lDQXZMeUJuWlhSSmJtbDBhV0ZzVTNSaGRHVWdZVzVrSUdOdmJYQnZibVZ1ZEZkcGJHeE5iM1Z1ZENCdFpYUm9iMlJ6SUdadmNpQnBibWwwYVdGc2FYcGhkR2x2Ymk1Y2JseHVJQ0FnSUNBZ2RtRnlJR2x1YVhScFlXeFRkR0YwWlNBOUlIUm9hWE11WjJWMFNXNXBkR2xoYkZOMFlYUmxJRDhnZEdocGN5NW5aWFJKYm1sMGFXRnNVM1JoZEdVb0tTQTZJRzUxYkd3N1hHNGdJQ0FnSUNCcFppQW9jSEp2WTJWemN5NWxibll1VGs5RVJWOUZUbFlnSVQwOUlDZHdjbTlrZFdOMGFXOXVKeWtnZTF4dUlDQWdJQ0FnSUNBdkx5QlhaU0JoYkd4dmR5QmhkWFJ2TFcxdlkydHpJSFJ2SUhCeWIyTmxaV1FnWVhNZ2FXWWdkR2hsZVNkeVpTQnlaWFIxY201cGJtY2diblZzYkM1Y2JpQWdJQ0FnSUNBZ2FXWWdLRnh1SUNBZ0lDQWdJQ0FnSUdsdWFYUnBZV3hUZEdGMFpTQTlQVDBnZFc1a1pXWnBibVZrSUNZbVhHNGdJQ0FnSUNBZ0lDQWdkR2hwY3k1blpYUkpibWwwYVdGc1UzUmhkR1V1WDJselRXOWphMFoxYm1OMGFXOXVYRzRnSUNBZ0lDQWdJQ2tnZTF4dUlDQWdJQ0FnSUNBZ0lDOHZJRlJvYVhNZ2FYTWdjSEp2WW1GaWJIa2dZbUZrSUhCeVlXTjBhV05sTGlCRGIyNXphV1JsY2lCM1lYSnVhVzVuSUdobGNtVWdZVzVrWEc0Z0lDQWdJQ0FnSUNBZ0x5OGdaR1Z3Y21WallYUnBibWNnZEdocGN5QmpiMjUyWlc1cFpXNWpaUzVjYmlBZ0lDQWdJQ0FnSUNCcGJtbDBhV0ZzVTNSaGRHVWdQU0J1ZFd4c08xeHVJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQjlYRzRnSUNBZ0lDQmZhVzUyWVhKcFlXNTBLRnh1SUNBZ0lDQWdJQ0IwZVhCbGIyWWdhVzVwZEdsaGJGTjBZWFJsSUQwOVBTQW5iMkpxWldOMEp5QW1KaUFoUVhKeVlYa3VhWE5CY25KaGVTaHBibWwwYVdGc1UzUmhkR1VwTEZ4dUlDQWdJQ0FnSUNBbkpYTXVaMlYwU1c1cGRHbGhiRk4wWVhSbEtDazZJRzExYzNRZ2NtVjBkWEp1SUdGdUlHOWlhbVZqZENCdmNpQnVkV3hzSnl4Y2JpQWdJQ0FnSUNBZ1EyOXVjM1J5ZFdOMGIzSXVaR2x6Y0d4aGVVNWhiV1VnZkh3Z0oxSmxZV04wUTI5dGNHOXphWFJsUTI5dGNHOXVaVzUwSjF4dUlDQWdJQ0FnS1R0Y2JseHVJQ0FnSUNBZ2RHaHBjeTV6ZEdGMFpTQTlJR2x1YVhScFlXeFRkR0YwWlR0Y2JpQWdJQ0I5S1R0Y2JpQWdJQ0JEYjI1emRISjFZM1J2Y2k1d2NtOTBiM1I1Y0dVZ1BTQnVaWGNnVW1WaFkzUkRiR0Z6YzBOdmJYQnZibVZ1ZENncE8xeHVJQ0FnSUVOdmJuTjBjblZqZEc5eUxuQnliM1J2ZEhsd1pTNWpiMjV6ZEhKMVkzUnZjaUE5SUVOdmJuTjBjblZqZEc5eU8xeHVJQ0FnSUVOdmJuTjBjblZqZEc5eUxuQnliM1J2ZEhsd1pTNWZYM0psWVdOMFFYVjBiMEpwYm1SUVlXbHljeUE5SUZ0ZE8xeHVYRzRnSUNBZ2FXNXFaV04wWldSTmFYaHBibk11Wm05eVJXRmphQ2h0YVhoVGNHVmpTVzUwYjBOdmJYQnZibVZ1ZEM1aWFXNWtLRzUxYkd3c0lFTnZibk4wY25WamRHOXlLU2s3WEc1Y2JpQWdJQ0J0YVhoVGNHVmpTVzUwYjBOdmJYQnZibVZ1ZENoRGIyNXpkSEoxWTNSdmNpd2dTWE5OYjNWdWRHVmtVSEpsVFdsNGFXNHBPMXh1SUNBZ0lHMXBlRk53WldOSmJuUnZRMjl0Y0c5dVpXNTBLRU52Ym5OMGNuVmpkRzl5TENCemNHVmpLVHRjYmlBZ0lDQnRhWGhUY0dWalNXNTBiME52YlhCdmJtVnVkQ2hEYjI1emRISjFZM1J2Y2l3Z1NYTk5iM1Z1ZEdWa1VHOXpkRTFwZUdsdUtUdGNibHh1SUNBZ0lDOHZJRWx1YVhScFlXeHBlbVVnZEdobElHUmxabUYxYkhSUWNtOXdjeUJ3Y205d1pYSjBlU0JoWm5SbGNpQmhiR3dnYldsNGFXNXpJR2hoZG1VZ1ltVmxiaUJ0WlhKblpXUXVYRzRnSUNBZ2FXWWdLRU52Ym5OMGNuVmpkRzl5TG1kbGRFUmxabUYxYkhSUWNtOXdjeWtnZTF4dUlDQWdJQ0FnUTI5dWMzUnlkV04wYjNJdVpHVm1ZWFZzZEZCeWIzQnpJRDBnUTI5dWMzUnlkV04wYjNJdVoyVjBSR1ZtWVhWc2RGQnliM0J6S0NrN1hHNGdJQ0FnZlZ4dVhHNGdJQ0FnYVdZZ0tIQnliMk5sYzNNdVpXNTJMazVQUkVWZlJVNVdJQ0U5UFNBbmNISnZaSFZqZEdsdmJpY3BJSHRjYmlBZ0lDQWdJQzh2SUZSb2FYTWdhWE1nWVNCMFlXY2dkRzhnYVc1a2FXTmhkR1VnZEdoaGRDQjBhR1VnZFhObElHOW1JSFJvWlhObElHMWxkR2h2WkNCdVlXMWxjeUJwY3lCdmF5eGNiaUFnSUNBZ0lDOHZJSE5wYm1ObElHbDBKM01nZFhObFpDQjNhWFJvSUdOeVpXRjBaVU5zWVhOekxpQkpaaUJwZENkeklHNXZkQ3dnZEdobGJpQnBkQ2R6SUd4cGEyVnNlU0JoWEc0Z0lDQWdJQ0F2THlCdGFYTjBZV3RsSUhOdklIZGxKMnhzSUhkaGNtNGdlVzkxSUhSdklIVnpaU0IwYUdVZ2MzUmhkR2xqSUhCeWIzQmxjblI1TENCd2NtOXdaWEowZVZ4dUlDQWdJQ0FnTHk4Z2FXNXBkR2xoYkdsNlpYSWdiM0lnWTI5dWMzUnlkV04wYjNJZ2NtVnpjR1ZqZEdsMlpXeDVMbHh1SUNBZ0lDQWdhV1lnS0VOdmJuTjBjblZqZEc5eUxtZGxkRVJsWm1GMWJIUlFjbTl3Y3lrZ2UxeHVJQ0FnSUNBZ0lDQkRiMjV6ZEhKMVkzUnZjaTVuWlhSRVpXWmhkV3gwVUhKdmNITXVhWE5TWldGamRFTnNZWE56UVhCd2NtOTJaV1FnUFNCN2ZUdGNiaUFnSUNBZ0lIMWNiaUFnSUNBZ0lHbG1JQ2hEYjI1emRISjFZM1J2Y2k1d2NtOTBiM1I1Y0dVdVoyVjBTVzVwZEdsaGJGTjBZWFJsS1NCN1hHNGdJQ0FnSUNBZ0lFTnZibk4wY25WamRHOXlMbkJ5YjNSdmRIbHdaUzVuWlhSSmJtbDBhV0ZzVTNSaGRHVXVhWE5TWldGamRFTnNZWE56UVhCd2NtOTJaV1FnUFNCN2ZUdGNiaUFnSUNBZ0lIMWNiaUFnSUNCOVhHNWNiaUFnSUNCZmFXNTJZWEpwWVc1MEtGeHVJQ0FnSUNBZ1EyOXVjM1J5ZFdOMGIzSXVjSEp2ZEc5MGVYQmxMbkpsYm1SbGNpeGNiaUFnSUNBZ0lDZGpjbVZoZEdWRGJHRnpjeWd1TGk0cE9pQkRiR0Z6Y3lCemNHVmphV1pwWTJGMGFXOXVJRzExYzNRZ2FXMXdiR1Z0Wlc1MElHRWdZSEpsYm1SbGNtQWdiV1YwYUc5a0xpZGNiaUFnSUNBcE8xeHVYRzRnSUNBZ2FXWWdLSEJ5YjJObGMzTXVaVzUyTGs1UFJFVmZSVTVXSUNFOVBTQW5jSEp2WkhWamRHbHZiaWNwSUh0Y2JpQWdJQ0FnSUhkaGNtNXBibWNvWEc0Z0lDQWdJQ0FnSUNGRGIyNXpkSEoxWTNSdmNpNXdjbTkwYjNSNWNHVXVZMjl0Y0c5dVpXNTBVMmh2ZFd4a1ZYQmtZWFJsTEZ4dUlDQWdJQ0FnSUNBbkpYTWdhR0Z6SUdFZ2JXVjBhRzlrSUdOaGJHeGxaQ0FuSUN0Y2JpQWdJQ0FnSUNBZ0lDQW5ZMjl0Y0c5dVpXNTBVMmh2ZFd4a1ZYQmtZWFJsS0NrdUlFUnBaQ0I1YjNVZ2JXVmhiaUJ6YUc5MWJHUkRiMjF3YjI1bGJuUlZjR1JoZEdVb0tUOGdKeUFyWEc0Z0lDQWdJQ0FnSUNBZ0oxUm9aU0J1WVcxbElHbHpJSEJvY21GelpXUWdZWE1nWVNCeGRXVnpkR2x2YmlCaVpXTmhkWE5sSUhSb1pTQm1kVzVqZEdsdmJpQnBjeUFuSUN0Y2JpQWdJQ0FnSUNBZ0lDQW5aWGh3WldOMFpXUWdkRzhnY21WMGRYSnVJR0VnZG1Gc2RXVXVKeXhjYmlBZ0lDQWdJQ0FnYzNCbFl5NWthWE53YkdGNVRtRnRaU0I4ZkNBblFTQmpiMjF3YjI1bGJuUW5YRzRnSUNBZ0lDQXBPMXh1SUNBZ0lDQWdkMkZ5Ym1sdVp5aGNiaUFnSUNBZ0lDQWdJVU52Ym5OMGNuVmpkRzl5TG5CeWIzUnZkSGx3WlM1amIyMXdiMjVsYm5SWGFXeHNVbVZqYVdWMlpWQnliM0J6TEZ4dUlDQWdJQ0FnSUNBbkpYTWdhR0Z6SUdFZ2JXVjBhRzlrSUdOaGJHeGxaQ0FuSUN0Y2JpQWdJQ0FnSUNBZ0lDQW5ZMjl0Y0c5dVpXNTBWMmxzYkZKbFkybGxkbVZRY205d2N5Z3BMaUJFYVdRZ2VXOTFJRzFsWVc0Z1kyOXRjRzl1Wlc1MFYybHNiRkpsWTJWcGRtVlFjbTl3Y3lncFB5Y3NYRzRnSUNBZ0lDQWdJSE53WldNdVpHbHpjR3hoZVU1aGJXVWdmSHdnSjBFZ1kyOXRjRzl1Wlc1MEoxeHVJQ0FnSUNBZ0tUdGNiaUFnSUNCOVhHNWNiaUFnSUNBdkx5QlNaV1IxWTJVZ2RHbHRaU0J6Y0dWdWRDQmtiMmx1WnlCc2IyOXJkWEJ6SUdKNUlITmxkSFJwYm1jZ2RHaGxjMlVnYjI0Z2RHaGxJSEJ5YjNSdmRIbHdaUzVjYmlBZ0lDQm1iM0lnS0haaGNpQnRaWFJvYjJST1lXMWxJR2x1SUZKbFlXTjBRMnhoYzNOSmJuUmxjbVpoWTJVcElIdGNiaUFnSUNBZ0lHbG1JQ2doUTI5dWMzUnlkV04wYjNJdWNISnZkRzkwZVhCbFcyMWxkR2h2WkU1aGJXVmRLU0I3WEc0Z0lDQWdJQ0FnSUVOdmJuTjBjblZqZEc5eUxuQnliM1J2ZEhsd1pWdHRaWFJvYjJST1lXMWxYU0E5SUc1MWJHdzdYRzRnSUNBZ0lDQjlYRzRnSUNBZ2ZWeHVYRzRnSUNBZ2NtVjBkWEp1SUVOdmJuTjBjblZqZEc5eU8xeHVJQ0I5WEc1Y2JpQWdjbVYwZFhKdUlHTnlaV0YwWlVOc1lYTnpPMXh1ZlZ4dVhHNXRiMlIxYkdVdVpYaHdiM0owY3lBOUlHWmhZM1J2Y25rN1hHNGlMQ0pjSW5WelpTQnpkSEpwWTNSY0lqdGNibHh1THlvcVhHNGdLaUJEYjNCNWNtbG5hSFFnS0dNcElESXdNVE10Y0hKbGMyVnVkQ3dnUm1GalpXSnZiMnNzSUVsdVl5NWNiaUFxSUVGc2JDQnlhV2RvZEhNZ2NtVnpaWEoyWldRdVhHNGdLbHh1SUNvZ1ZHaHBjeUJ6YjNWeVkyVWdZMjlrWlNCcGN5QnNhV05sYm5ObFpDQjFibVJsY2lCMGFHVWdRbE5FTFhOMGVXeGxJR3hwWTJWdWMyVWdabTkxYm1RZ2FXNGdkR2hsWEc0Z0tpQk1TVU5GVGxORklHWnBiR1VnYVc0Z2RHaGxJSEp2YjNRZ1pHbHlaV04wYjNKNUlHOW1JSFJvYVhNZ2MyOTFjbU5sSUhSeVpXVXVJRUZ1SUdGa1pHbDBhVzl1WVd3Z1ozSmhiblJjYmlBcUlHOW1JSEJoZEdWdWRDQnlhV2RvZEhNZ1kyRnVJR0psSUdadmRXNWtJR2x1SUhSb1pTQlFRVlJGVGxSVElHWnBiR1VnYVc0Z2RHaGxJSE5oYldVZ1pHbHlaV04wYjNKNUxseHVJQ3BjYmlBcUlGeHVJQ292WEc1Y2JtWjFibU4wYVc5dUlHMWhhMlZGYlhCMGVVWjFibU4wYVc5dUtHRnlaeWtnZTF4dUlDQnlaWFIxY200Z1puVnVZM1JwYjI0Z0tDa2dlMXh1SUNBZ0lISmxkSFZ5YmlCaGNtYzdYRzRnSUgwN1hHNTlYRzVjYmk4cUtseHVJQ29nVkdocGN5Qm1kVzVqZEdsdmJpQmhZMk5sY0hSeklHRnVaQ0JrYVhOallYSmtjeUJwYm5CMWRITTdJR2wwSUdoaGN5QnVieUJ6YVdSbElHVm1abVZqZEhNdUlGUm9hWE1nYVhOY2JpQXFJSEJ5YVcxaGNtbHNlU0IxYzJWbWRXd2dhV1JwYjIxaGRHbGpZV3hzZVNCbWIzSWdiM1psY25KcFpHRmliR1VnWm5WdVkzUnBiMjRnWlc1a2NHOXBiblJ6SUhkb2FXTm9YRzRnS2lCaGJIZGhlWE1nYm1WbFpDQjBieUJpWlNCallXeHNZV0pzWlN3Z2MybHVZMlVnU2xNZ2JHRmphM01nWVNCdWRXeHNMV05oYkd3Z2FXUnBiMjBnWVd4aElFTnZZMjloTGx4dUlDb3ZYRzUyWVhJZ1pXMXdkSGxHZFc1amRHbHZiaUE5SUdaMWJtTjBhVzl1SUdWdGNIUjVSblZ1WTNScGIyNG9LU0I3ZlR0Y2JseHVaVzF3ZEhsR2RXNWpkR2x2Ymk1MGFHRjBVbVYwZFhKdWN5QTlJRzFoYTJWRmJYQjBlVVoxYm1OMGFXOXVPMXh1Wlcxd2RIbEdkVzVqZEdsdmJpNTBhR0YwVW1WMGRYSnVjMFpoYkhObElEMGdiV0ZyWlVWdGNIUjVSblZ1WTNScGIyNG9abUZzYzJVcE8xeHVaVzF3ZEhsR2RXNWpkR2x2Ymk1MGFHRjBVbVYwZFhKdWMxUnlkV1VnUFNCdFlXdGxSVzF3ZEhsR2RXNWpkR2x2YmloMGNuVmxLVHRjYm1WdGNIUjVSblZ1WTNScGIyNHVkR2hoZEZKbGRIVnlibk5PZFd4c0lEMGdiV0ZyWlVWdGNIUjVSblZ1WTNScGIyNG9iblZzYkNrN1hHNWxiWEIwZVVaMWJtTjBhVzl1TG5Sb1lYUlNaWFIxY201elZHaHBjeUE5SUdaMWJtTjBhVzl1SUNncElIdGNiaUFnY21WMGRYSnVJSFJvYVhNN1hHNTlPMXh1Wlcxd2RIbEdkVzVqZEdsdmJpNTBhR0YwVW1WMGRYSnVjMEZ5WjNWdFpXNTBJRDBnWm5WdVkzUnBiMjRnS0dGeVp5a2dlMXh1SUNCeVpYUjFjbTRnWVhKbk8xeHVmVHRjYmx4dWJXOWtkV3hsTG1WNGNHOXlkSE1nUFNCbGJYQjBlVVoxYm1OMGFXOXVPeUlzSWk4cUtseHVJQ29nUTI5d2VYSnBaMmgwSUNoaktTQXlNREV6TFhCeVpYTmxiblFzSUVaaFkyVmliMjlyTENCSmJtTXVYRzRnS2lCQmJHd2djbWxuYUhSeklISmxjMlZ5ZG1Wa0xseHVJQ3BjYmlBcUlGUm9hWE1nYzI5MWNtTmxJR052WkdVZ2FYTWdiR2xqWlc1elpXUWdkVzVrWlhJZ2RHaGxJRUpUUkMxemRIbHNaU0JzYVdObGJuTmxJR1p2ZFc1a0lHbHVJSFJvWlZ4dUlDb2dURWxEUlU1VFJTQm1hV3hsSUdsdUlIUm9aU0J5YjI5MElHUnBjbVZqZEc5eWVTQnZaaUIwYUdseklITnZkWEpqWlNCMGNtVmxMaUJCYmlCaFpHUnBkR2x2Ym1Gc0lHZHlZVzUwWEc0Z0tpQnZaaUJ3WVhSbGJuUWdjbWxuYUhSeklHTmhiaUJpWlNCbWIzVnVaQ0JwYmlCMGFHVWdVRUZVUlU1VVV5Qm1hV3hsSUdsdUlIUm9aU0J6WVcxbElHUnBjbVZqZEc5eWVTNWNiaUFxWEc0Z0tpOWNibHh1SjNWelpTQnpkSEpwWTNRbk8xeHVYRzUyWVhJZ1pXMXdkSGxQWW1wbFkzUWdQU0I3ZlR0Y2JseHVhV1lnS0hCeWIyTmxjM011Wlc1MkxrNVBSRVZmUlU1V0lDRTlQU0FuY0hKdlpIVmpkR2x2YmljcElIdGNiaUFnVDJKcVpXTjBMbVp5WldWNlpTaGxiWEIwZVU5aWFtVmpkQ2s3WEc1OVhHNWNibTF2WkhWc1pTNWxlSEJ2Y25SeklEMGdaVzF3ZEhsUFltcGxZM1E3SWl3aUx5b3FYRzRnS2lCRGIzQjVjbWxuYUhRZ0tHTXBJREl3TVRNdGNISmxjMlZ1ZEN3Z1JtRmpaV0p2YjJzc0lFbHVZeTVjYmlBcUlFRnNiQ0J5YVdkb2RITWdjbVZ6WlhKMlpXUXVYRzRnS2x4dUlDb2dWR2hwY3lCemIzVnlZMlVnWTI5a1pTQnBjeUJzYVdObGJuTmxaQ0IxYm1SbGNpQjBhR1VnUWxORUxYTjBlV3hsSUd4cFkyVnVjMlVnWm05MWJtUWdhVzRnZEdobFhHNGdLaUJNU1VORlRsTkZJR1pwYkdVZ2FXNGdkR2hsSUhKdmIzUWdaR2x5WldOMGIzSjVJRzltSUhSb2FYTWdjMjkxY21ObElIUnlaV1V1SUVGdUlHRmtaR2wwYVc5dVlXd2daM0poYm5SY2JpQXFJRzltSUhCaGRHVnVkQ0J5YVdkb2RITWdZMkZ1SUdKbElHWnZkVzVrSUdsdUlIUm9aU0JRUVZSRlRsUlRJR1pwYkdVZ2FXNGdkR2hsSUhOaGJXVWdaR2x5WldOMGIzSjVMbHh1SUNwY2JpQXFMMXh1WEc0bmRYTmxJSE4wY21samRDYzdYRzVjYmk4cUtseHVJQ29nVlhObElHbHVkbUZ5YVdGdWRDZ3BJSFJ2SUdGemMyVnlkQ0J6ZEdGMFpTQjNhR2xqYUNCNWIzVnlJSEJ5YjJkeVlXMGdZWE56ZFcxbGN5QjBieUJpWlNCMGNuVmxMbHh1SUNwY2JpQXFJRkJ5YjNacFpHVWdjM0J5YVc1MFppMXpkSGxzWlNCbWIzSnRZWFFnS0c5dWJIa2dKWE1nYVhNZ2MzVndjRzl5ZEdWa0tTQmhibVFnWVhKbmRXMWxiblJ6WEc0Z0tpQjBieUJ3Y205MmFXUmxJR2x1Wm05eWJXRjBhVzl1SUdGaWIzVjBJSGRvWVhRZ1luSnZhMlVnWVc1a0lIZG9ZWFFnZVc5MUlIZGxjbVZjYmlBcUlHVjRjR1ZqZEdsdVp5NWNiaUFxWEc0Z0tpQlVhR1VnYVc1MllYSnBZVzUwSUcxbGMzTmhaMlVnZDJsc2JDQmlaU0J6ZEhKcGNIQmxaQ0JwYmlCd2NtOWtkV04wYVc5dUxDQmlkWFFnZEdobElHbHVkbUZ5YVdGdWRGeHVJQ29nZDJsc2JDQnlaVzFoYVc0Z2RHOGdaVzV6ZFhKbElHeHZaMmxqSUdSdlpYTWdibTkwSUdScFptWmxjaUJwYmlCd2NtOWtkV04wYVc5dUxseHVJQ292WEc1Y2JuWmhjaUIyWVd4cFpHRjBaVVp2Y20xaGRDQTlJR1oxYm1OMGFXOXVJSFpoYkdsa1lYUmxSbTl5YldGMEtHWnZjbTFoZENrZ2UzMDdYRzVjYm1sbUlDaHdjbTlqWlhOekxtVnVkaTVPVDBSRlgwVk9WaUFoUFQwZ0ozQnliMlIxWTNScGIyNG5LU0I3WEc0Z0lIWmhiR2xrWVhSbFJtOXliV0YwSUQwZ1puVnVZM1JwYjI0Z2RtRnNhV1JoZEdWR2IzSnRZWFFvWm05eWJXRjBLU0I3WEc0Z0lDQWdhV1lnS0dadmNtMWhkQ0E5UFQwZ2RXNWtaV1pwYm1Wa0tTQjdYRzRnSUNBZ0lDQjBhSEp2ZHlCdVpYY2dSWEp5YjNJb0oybHVkbUZ5YVdGdWRDQnlaWEYxYVhKbGN5QmhiaUJsY25KdmNpQnRaWE56WVdkbElHRnlaM1Z0Wlc1MEp5azdYRzRnSUNBZ2ZWeHVJQ0I5TzF4dWZWeHVYRzVtZFc1amRHbHZiaUJwYm5aaGNtbGhiblFvWTI5dVpHbDBhVzl1TENCbWIzSnRZWFFzSUdFc0lHSXNJR01zSUdRc0lHVXNJR1lwSUh0Y2JpQWdkbUZzYVdSaGRHVkdiM0p0WVhRb1ptOXliV0YwS1R0Y2JseHVJQ0JwWmlBb0lXTnZibVJwZEdsdmJpa2dlMXh1SUNBZ0lIWmhjaUJsY25KdmNqdGNiaUFnSUNCcFppQW9abTl5YldGMElEMDlQU0IxYm1SbFptbHVaV1FwSUh0Y2JpQWdJQ0FnSUdWeWNtOXlJRDBnYm1WM0lFVnljbTl5S0NkTmFXNXBabWxsWkNCbGVHTmxjSFJwYjI0Z2IyTmpkWEp5WldRN0lIVnpaU0IwYUdVZ2JtOXVMVzFwYm1sbWFXVmtJR1JsZGlCbGJuWnBjbTl1YldWdWRDQW5JQ3NnSjJadmNpQjBhR1VnWm5Wc2JDQmxjbkp2Y2lCdFpYTnpZV2RsSUdGdVpDQmhaR1JwZEdsdmJtRnNJR2hsYkhCbWRXd2dkMkZ5Ym1sdVozTXVKeWs3WEc0Z0lDQWdmU0JsYkhObElIdGNiaUFnSUNBZ0lIWmhjaUJoY21keklEMGdXMkVzSUdJc0lHTXNJR1FzSUdVc0lHWmRPMXh1SUNBZ0lDQWdkbUZ5SUdGeVowbHVaR1Y0SUQwZ01EdGNiaUFnSUNBZ0lHVnljbTl5SUQwZ2JtVjNJRVZ5Y205eUtHWnZjbTFoZEM1eVpYQnNZV05sS0M4bGN5OW5MQ0JtZFc1amRHbHZiaUFvS1NCN1hHNGdJQ0FnSUNBZ0lISmxkSFZ5YmlCaGNtZHpXMkZ5WjBsdVpHVjRLeXRkTzF4dUlDQWdJQ0FnZlNrcE8xeHVJQ0FnSUNBZ1pYSnliM0l1Ym1GdFpTQTlJQ2RKYm5aaGNtbGhiblFnVm1sdmJHRjBhVzl1Snp0Y2JpQWdJQ0I5WEc1Y2JpQWdJQ0JsY25KdmNpNW1jbUZ0WlhOVWIxQnZjQ0E5SURFN0lDOHZJSGRsSUdSdmJpZDBJR05oY21VZ1lXSnZkWFFnYVc1MllYSnBZVzUwSjNNZ2IzZHVJR1p5WVcxbFhHNGdJQ0FnZEdoeWIzY2daWEp5YjNJN1hHNGdJSDFjYm4xY2JseHViVzlrZFd4bExtVjRjRzl5ZEhNZ1BTQnBiblpoY21saGJuUTdJaXdpTHlvcVhHNGdLaUJEYjNCNWNtbG5hSFFnTWpBeE5DMHlNREUxTENCR1lXTmxZbTl2YXl3Z1NXNWpMbHh1SUNvZ1FXeHNJSEpwWjJoMGN5QnlaWE5sY25abFpDNWNiaUFxWEc0Z0tpQlVhR2x6SUhOdmRYSmpaU0JqYjJSbElHbHpJR3hwWTJWdWMyVmtJSFZ1WkdWeUlIUm9aU0JDVTBRdGMzUjViR1VnYkdsalpXNXpaU0JtYjNWdVpDQnBiaUIwYUdWY2JpQXFJRXhKUTBWT1UwVWdabWxzWlNCcGJpQjBhR1VnY205dmRDQmthWEpsWTNSdmNua2diMllnZEdocGN5QnpiM1Z5WTJVZ2RISmxaUzRnUVc0Z1lXUmthWFJwYjI1aGJDQm5jbUZ1ZEZ4dUlDb2diMllnY0dGMFpXNTBJSEpwWjJoMGN5QmpZVzRnWW1VZ1ptOTFibVFnYVc0Z2RHaGxJRkJCVkVWT1ZGTWdabWxzWlNCcGJpQjBhR1VnYzJGdFpTQmthWEpsWTNSdmNua3VYRzRnS2x4dUlDb3ZYRzVjYmlkMWMyVWdjM1J5YVdOMEp6dGNibHh1ZG1GeUlHVnRjSFI1Um5WdVkzUnBiMjRnUFNCeVpYRjFhWEpsS0NjdUwyVnRjSFI1Um5WdVkzUnBiMjRuS1R0Y2JseHVMeW9xWEc0Z0tpQlRhVzFwYkdGeUlIUnZJR2x1ZG1GeWFXRnVkQ0JpZFhRZ2IyNXNlU0JzYjJkeklHRWdkMkZ5Ym1sdVp5QnBaaUIwYUdVZ1kyOXVaR2wwYVc5dUlHbHpJRzV2ZENCdFpYUXVYRzRnS2lCVWFHbHpJR05oYmlCaVpTQjFjMlZrSUhSdklHeHZaeUJwYzNOMVpYTWdhVzRnWkdWMlpXeHZjRzFsYm5RZ1pXNTJhWEp2Ym0xbGJuUnpJR2x1SUdOeWFYUnBZMkZzWEc0Z0tpQndZWFJvY3k0Z1VtVnRiM1pwYm1jZ2RHaGxJR3h2WjJkcGJtY2dZMjlrWlNCbWIzSWdjSEp2WkhWamRHbHZiaUJsYm5acGNtOXViV1Z1ZEhNZ2QybHNiQ0JyWldWd0lIUm9aVnh1SUNvZ2MyRnRaU0JzYjJkcFl5QmhibVFnWm05c2JHOTNJSFJvWlNCellXMWxJR052WkdVZ2NHRjBhSE11WEc0Z0tpOWNibHh1ZG1GeUlIZGhjbTVwYm1jZ1BTQmxiWEIwZVVaMWJtTjBhVzl1TzF4dVhHNXBaaUFvY0hKdlkyVnpjeTVsYm5ZdVRrOUVSVjlGVGxZZ0lUMDlJQ2R3Y205a2RXTjBhVzl1SnlrZ2UxeHVJQ0IyWVhJZ2NISnBiblJYWVhKdWFXNW5JRDBnWm5WdVkzUnBiMjRnY0hKcGJuUlhZWEp1YVc1bktHWnZjbTFoZENrZ2UxeHVJQ0FnSUdadmNpQW9kbUZ5SUY5c1pXNGdQU0JoY21kMWJXVnVkSE11YkdWdVozUm9MQ0JoY21keklEMGdRWEp5WVhrb1gyeGxiaUErSURFZ1B5QmZiR1Z1SUMwZ01TQTZJREFwTENCZmEyVjVJRDBnTVRzZ1gydGxlU0E4SUY5c1pXNDdJRjlyWlhrckt5a2dlMXh1SUNBZ0lDQWdZWEpuYzF0ZmEyVjVJQzBnTVYwZ1BTQmhjbWQxYldWdWRITmJYMnRsZVYwN1hHNGdJQ0FnZlZ4dVhHNGdJQ0FnZG1GeUlHRnlaMGx1WkdWNElEMGdNRHRjYmlBZ0lDQjJZWElnYldWemMyRm5aU0E5SUNkWFlYSnVhVzVuT2lBbklDc2dabTl5YldGMExuSmxjR3hoWTJVb0x5VnpMMmNzSUdaMWJtTjBhVzl1SUNncElIdGNiaUFnSUNBZ0lISmxkSFZ5YmlCaGNtZHpXMkZ5WjBsdVpHVjRLeXRkTzF4dUlDQWdJSDBwTzF4dUlDQWdJR2xtSUNoMGVYQmxiMllnWTI5dWMyOXNaU0FoUFQwZ0ozVnVaR1ZtYVc1bFpDY3BJSHRjYmlBZ0lDQWdJR052Ym5OdmJHVXVaWEp5YjNJb2JXVnpjMkZuWlNrN1hHNGdJQ0FnZlZ4dUlDQWdJSFJ5ZVNCN1hHNGdJQ0FnSUNBdkx5QXRMUzBnVjJWc1kyOXRaU0IwYnlCa1pXSjFaMmRwYm1jZ1VtVmhZM1FnTFMwdFhHNGdJQ0FnSUNBdkx5QlVhR2x6SUdWeWNtOXlJSGRoY3lCMGFISnZkMjRnWVhNZ1lTQmpiMjUyWlc1cFpXNWpaU0J6YnlCMGFHRjBJSGx2ZFNCallXNGdkWE5sSUhSb2FYTWdjM1JoWTJ0Y2JpQWdJQ0FnSUM4dklIUnZJR1pwYm1RZ2RHaGxJR05oYkd4emFYUmxJSFJvWVhRZ1kyRjFjMlZrSUhSb2FYTWdkMkZ5Ym1sdVp5QjBieUJtYVhKbExseHVJQ0FnSUNBZ2RHaHliM2NnYm1WM0lFVnljbTl5S0cxbGMzTmhaMlVwTzF4dUlDQWdJSDBnWTJGMFkyZ2dLSGdwSUh0OVhHNGdJSDA3WEc1Y2JpQWdkMkZ5Ym1sdVp5QTlJR1oxYm1OMGFXOXVJSGRoY201cGJtY29ZMjl1WkdsMGFXOXVMQ0JtYjNKdFlYUXBJSHRjYmlBZ0lDQnBaaUFvWm05eWJXRjBJRDA5UFNCMWJtUmxabWx1WldRcElIdGNiaUFnSUNBZ0lIUm9jbTkzSUc1bGR5QkZjbkp2Y2lnbllIZGhjbTVwYm1jb1kyOXVaR2wwYVc5dUxDQm1iM0p0WVhRc0lDNHVMbUZ5WjNNcFlDQnlaWEYxYVhKbGN5QmhJSGRoY201cGJtY2dKeUFySUNkdFpYTnpZV2RsSUdGeVozVnRaVzUwSnlrN1hHNGdJQ0FnZlZ4dVhHNGdJQ0FnYVdZZ0tHWnZjbTFoZEM1cGJtUmxlRTltS0NkR1lXbHNaV1FnUTI5dGNHOXphWFJsSUhCeWIzQlVlWEJsT2lBbktTQTlQVDBnTUNrZ2UxeHVJQ0FnSUNBZ2NtVjBkWEp1T3lBdkx5QkpaMjV2Y21VZ1EyOXRjRzl6YVhSbFEyOXRjRzl1Wlc1MElIQnliM0IwZVhCbElHTm9aV05yTGx4dUlDQWdJSDFjYmx4dUlDQWdJR2xtSUNnaFkyOXVaR2wwYVc5dUtTQjdYRzRnSUNBZ0lDQm1iM0lnS0haaGNpQmZiR1Z1TWlBOUlHRnlaM1Z0Wlc1MGN5NXNaVzVuZEdnc0lHRnlaM01nUFNCQmNuSmhlU2hmYkdWdU1pQStJRElnUHlCZmJHVnVNaUF0SURJZ09pQXdLU3dnWDJ0bGVUSWdQU0F5T3lCZmEyVjVNaUE4SUY5c1pXNHlPeUJmYTJWNU1pc3JLU0I3WEc0Z0lDQWdJQ0FnSUdGeVozTmJYMnRsZVRJZ0xTQXlYU0E5SUdGeVozVnRaVzUwYzF0ZmEyVjVNbDA3WEc0Z0lDQWdJQ0I5WEc1Y2JpQWdJQ0FnSUhCeWFXNTBWMkZ5Ym1sdVp5NWhjSEJzZVNoMWJtUmxabWx1WldRc0lGdG1iM0p0WVhSZExtTnZibU5oZENoaGNtZHpLU2s3WEc0Z0lDQWdmVnh1SUNCOU8xeHVmVnh1WEc1dGIyUjFiR1V1Wlhod2IzSjBjeUE5SUhkaGNtNXBibWM3SWl3aUx5b2hYRzRnS2lCRVpYUmxjbTFwYm1VZ2FXWWdZVzRnYjJKcVpXTjBJR2x6SUdFZ1FuVm1abVZ5WEc0Z0tseHVJQ29nUUdGMWRHaHZjaUFnSUVabGNtOXpjeUJCWW05MWEyaGhaR2xxWldnZ1BHWmxjbTl6YzBCbVpYSnZjM011YjNKblBpQThhSFIwY0RvdkwyWmxjbTl6Y3k1dmNtYytYRzRnS2lCQWJHbGpaVzV6WlNBZ1RVbFVYRzRnS2k5Y2JseHVMeThnVkdobElGOXBjMEoxWm1abGNpQmphR1ZqYXlCcGN5Qm1iM0lnVTJGbVlYSnBJRFV0TnlCemRYQndiM0owTENCaVpXTmhkWE5sSUdsMEozTWdiV2x6YzJsdVoxeHVMeThnVDJKcVpXTjBMbkJ5YjNSdmRIbHdaUzVqYjI1emRISjFZM1J2Y2k0Z1VtVnRiM1psSUhSb2FYTWdaWFpsYm5SMVlXeHNlVnh1Ylc5a2RXeGxMbVY0Y0c5eWRITWdQU0JtZFc1amRHbHZiaUFvYjJKcUtTQjdYRzRnSUhKbGRIVnliaUJ2WW1vZ0lUMGdiblZzYkNBbUppQW9hWE5DZFdabVpYSW9iMkpxS1NCOGZDQnBjMU5zYjNkQ2RXWm1aWElvYjJKcUtTQjhmQ0FoSVc5aWFpNWZhWE5DZFdabVpYSXBYRzU5WEc1Y2JtWjFibU4wYVc5dUlHbHpRblZtWm1WeUlDaHZZbW9wSUh0Y2JpQWdjbVYwZFhKdUlDRWhiMkpxTG1OdmJuTjBjblZqZEc5eUlDWW1JSFI1Y0dWdlppQnZZbW91WTI5dWMzUnlkV04wYjNJdWFYTkNkV1ptWlhJZ1BUMDlJQ2RtZFc1amRHbHZiaWNnSmlZZ2IySnFMbU52Ym5OMGNuVmpkRzl5TG1selFuVm1abVZ5S0c5aWFpbGNibjFjYmx4dUx5OGdSbTl5SUU1dlpHVWdkakF1TVRBZ2MzVndjRzl5ZEM0Z1VtVnRiM1psSUhSb2FYTWdaWFpsYm5SMVlXeHNlUzVjYm1aMWJtTjBhVzl1SUdselUyeHZkMEoxWm1abGNpQW9iMkpxS1NCN1hHNGdJSEpsZEhWeWJpQjBlWEJsYjJZZ2IySnFMbkpsWVdSR2JHOWhkRXhGSUQwOVBTQW5ablZ1WTNScGIyNG5JQ1ltSUhSNWNHVnZaaUJ2WW1vdWMyeHBZMlVnUFQwOUlDZG1kVzVqZEdsdmJpY2dKaVlnYVhOQ2RXWm1aWElvYjJKcUxuTnNhV05sS0RBc0lEQXBLVnh1ZlZ4dUlpd2lMeXBjYm05aWFtVmpkQzFoYzNOcFoyNWNiaWhqS1NCVGFXNWtjbVVnVTI5eWFIVnpYRzVBYkdsalpXNXpaU0JOU1ZSY2Jpb3ZYRzVjYmlkMWMyVWdjM1J5YVdOMEp6dGNiaThxSUdWemJHbHVkQzFrYVhOaFlteGxJRzV2TFhWdWRYTmxaQzEyWVhKeklDb3ZYRzUyWVhJZ1oyVjBUM2R1VUhKdmNHVnlkSGxUZVcxaWIyeHpJRDBnVDJKcVpXTjBMbWRsZEU5M2JsQnliM0JsY25SNVUzbHRZbTlzY3p0Y2JuWmhjaUJvWVhOUGQyNVFjbTl3WlhKMGVTQTlJRTlpYW1WamRDNXdjbTkwYjNSNWNHVXVhR0Z6VDNkdVVISnZjR1Z5ZEhrN1hHNTJZWElnY0hKdmNFbHpSVzUxYldWeVlXSnNaU0E5SUU5aWFtVmpkQzV3Y205MGIzUjVjR1V1Y0hKdmNHVnlkSGxKYzBWdWRXMWxjbUZpYkdVN1hHNWNibVoxYm1OMGFXOXVJSFJ2VDJKcVpXTjBLSFpoYkNrZ2UxeHVYSFJwWmlBb2RtRnNJRDA5UFNCdWRXeHNJSHg4SUhaaGJDQTlQVDBnZFc1a1pXWnBibVZrS1NCN1hHNWNkRngwZEdoeWIzY2dibVYzSUZSNWNHVkZjbkp2Y2lnblQySnFaV04wTG1GemMybG5iaUJqWVc1dWIzUWdZbVVnWTJGc2JHVmtJSGRwZEdnZ2JuVnNiQ0J2Y2lCMWJtUmxabWx1WldRbktUdGNibHgwZlZ4dVhHNWNkSEpsZEhWeWJpQlBZbXBsWTNRb2RtRnNLVHRjYm4xY2JseHVablZ1WTNScGIyNGdjMmh2ZFd4a1ZYTmxUbUYwYVhabEtDa2dlMXh1WEhSMGNua2dlMXh1WEhSY2RHbG1JQ2doVDJKcVpXTjBMbUZ6YzJsbmJpa2dlMXh1WEhSY2RGeDBjbVYwZFhKdUlHWmhiSE5sTzF4dVhIUmNkSDFjYmx4dVhIUmNkQzh2SUVSbGRHVmpkQ0JpZFdkbmVTQndjbTl3WlhKMGVTQmxiblZ0WlhKaGRHbHZiaUJ2Y21SbGNpQnBiaUJ2YkdSbGNpQldPQ0IyWlhKemFXOXVjeTVjYmx4dVhIUmNkQzh2SUdoMGRIQnpPaTh2WW5WbmN5NWphSEp2YldsMWJTNXZjbWN2Y0M5Mk9DOXBjM04xWlhNdlpHVjBZV2xzUDJsa1BUUXhNVGhjYmx4MFhIUjJZWElnZEdWemRERWdQU0J1WlhjZ1UzUnlhVzVuS0NkaFltTW5LVHNnSUM4dklHVnpiR2x1ZEMxa2FYTmhZbXhsTFd4cGJtVWdibTh0Ym1WM0xYZHlZWEJ3WlhKelhHNWNkRngwZEdWemRERmJOVjBnUFNBblpHVW5PMXh1WEhSY2RHbG1JQ2hQWW1wbFkzUXVaMlYwVDNkdVVISnZjR1Z5ZEhsT1lXMWxjeWgwWlhOME1TbGJNRjBnUFQwOUlDYzFKeWtnZTF4dVhIUmNkRngwY21WMGRYSnVJR1poYkhObE8xeHVYSFJjZEgxY2JseHVYSFJjZEM4dklHaDBkSEJ6T2k4dlluVm5jeTVqYUhKdmJXbDFiUzV2Y21jdmNDOTJPQzlwYzNOMVpYTXZaR1YwWVdsc1AybGtQVE13TlRaY2JseDBYSFIyWVhJZ2RHVnpkRElnUFNCN2ZUdGNibHgwWEhSbWIzSWdLSFpoY2lCcElEMGdNRHNnYVNBOElERXdPeUJwS3lzcElIdGNibHgwWEhSY2RIUmxjM1F5V3lkZkp5QXJJRk4wY21sdVp5NW1jbTl0UTJoaGNrTnZaR1VvYVNsZElEMGdhVHRjYmx4MFhIUjlYRzVjZEZ4MGRtRnlJRzl5WkdWeU1pQTlJRTlpYW1WamRDNW5aWFJQZDI1UWNtOXdaWEowZVU1aGJXVnpLSFJsYzNReUtTNXRZWEFvWm5WdVkzUnBiMjRnS0c0cElIdGNibHgwWEhSY2RISmxkSFZ5YmlCMFpYTjBNbHR1WFR0Y2JseDBYSFI5S1R0Y2JseDBYSFJwWmlBb2IzSmtaWEl5TG1wdmFXNG9KeWNwSUNFOVBTQW5NREV5TXpRMU5qYzRPU2NwSUh0Y2JseDBYSFJjZEhKbGRIVnliaUJtWVd4elpUdGNibHgwWEhSOVhHNWNibHgwWEhRdkx5Qm9kSFJ3Y3pvdkwySjFaM011WTJoeWIyMXBkVzB1YjNKbkwzQXZkamd2YVhOemRXVnpMMlJsZEdGcGJEOXBaRDB6TURVMlhHNWNkRngwZG1GeUlIUmxjM1F6SUQwZ2UzMDdYRzVjZEZ4MEoyRmlZMlJsWm1kb2FXcHJiRzF1YjNCeGNuTjBKeTV6Y0d4cGRDZ25KeWt1Wm05eVJXRmphQ2htZFc1amRHbHZiaUFvYkdWMGRHVnlLU0I3WEc1Y2RGeDBYSFIwWlhOME0xdHNaWFIwWlhKZElEMGdiR1YwZEdWeU8xeHVYSFJjZEgwcE8xeHVYSFJjZEdsbUlDaFBZbXBsWTNRdWEyVjVjeWhQWW1wbFkzUXVZWE56YVdkdUtIdDlMQ0IwWlhOME15a3BMbXB2YVc0b0p5Y3BJQ0U5UFZ4dVhIUmNkRngwWEhRbllXSmpaR1ZtWjJocGFtdHNiVzV2Y0hGeWMzUW5LU0I3WEc1Y2RGeDBYSFJ5WlhSMWNtNGdabUZzYzJVN1hHNWNkRngwZlZ4dVhHNWNkRngwY21WMGRYSnVJSFJ5ZFdVN1hHNWNkSDBnWTJGMFkyZ2dLR1Z5Y2lrZ2UxeHVYSFJjZEM4dklGZGxJR1J2YmlkMElHVjRjR1ZqZENCaGJua2diMllnZEdobElHRmliM1psSUhSdklIUm9jbTkzTENCaWRYUWdZbVYwZEdWeUlIUnZJR0psSUhOaFptVXVYRzVjZEZ4MGNtVjBkWEp1SUdaaGJITmxPMXh1WEhSOVhHNTlYRzVjYm0xdlpIVnNaUzVsZUhCdmNuUnpJRDBnYzJodmRXeGtWWE5sVG1GMGFYWmxLQ2tnUHlCUFltcGxZM1F1WVhOemFXZHVJRG9nWm5WdVkzUnBiMjRnS0hSaGNtZGxkQ3dnYzI5MWNtTmxLU0I3WEc1Y2RIWmhjaUJtY205dE8xeHVYSFIyWVhJZ2RHOGdQU0IwYjA5aWFtVmpkQ2gwWVhKblpYUXBPMXh1WEhSMllYSWdjM2x0WW05c2N6dGNibHh1WEhSbWIzSWdLSFpoY2lCeklEMGdNVHNnY3lBOElHRnlaM1Z0Wlc1MGN5NXNaVzVuZEdnN0lITXJLeWtnZTF4dVhIUmNkR1p5YjIwZ1BTQlBZbXBsWTNRb1lYSm5kVzFsYm5SelczTmRLVHRjYmx4dVhIUmNkR1p2Y2lBb2RtRnlJR3RsZVNCcGJpQm1jbTl0S1NCN1hHNWNkRngwWEhScFppQW9hR0Z6VDNkdVVISnZjR1Z5ZEhrdVkyRnNiQ2htY205dExDQnJaWGtwS1NCN1hHNWNkRngwWEhSY2RIUnZXMnRsZVYwZ1BTQm1jbTl0VzJ0bGVWMDdYRzVjZEZ4MFhIUjlYRzVjZEZ4MGZWeHVYRzVjZEZ4MGFXWWdLR2RsZEU5M2JsQnliM0JsY25SNVUzbHRZbTlzY3lrZ2UxeHVYSFJjZEZ4MGMzbHRZbTlzY3lBOUlHZGxkRTkzYmxCeWIzQmxjblI1VTNsdFltOXNjeWhtY205dEtUdGNibHgwWEhSY2RHWnZjaUFvZG1GeUlHa2dQU0F3T3lCcElEd2djM2x0WW05c2N5NXNaVzVuZEdnN0lHa3JLeWtnZTF4dVhIUmNkRngwWEhScFppQW9jSEp2Y0VselJXNTFiV1Z5WVdKc1pTNWpZV3hzS0daeWIyMHNJSE41YldKdmJITmJhVjBwS1NCN1hHNWNkRngwWEhSY2RGeDBkRzliYzNsdFltOXNjMXRwWFYwZ1BTQm1jbTl0VzNONWJXSnZiSE5iYVYxZE8xeHVYSFJjZEZ4MFhIUjlYRzVjZEZ4MFhIUjlYRzVjZEZ4MGZWeHVYSFI5WEc1Y2JseDBjbVYwZFhKdUlIUnZPMXh1ZlR0Y2JpSXNJaTh2SUhOb2FXMGdabTl5SUhWemFXNW5JSEJ5YjJObGMzTWdhVzRnWW5KdmQzTmxjbHh1ZG1GeUlIQnliMk5sYzNNZ1BTQnRiMlIxYkdVdVpYaHdiM0owY3lBOUlIdDlPMXh1WEc0dkx5QmpZV05vWldRZ1puSnZiU0IzYUdGMFpYWmxjaUJuYkc5aVlXd2dhWE1nY0hKbGMyVnVkQ0J6YnlCMGFHRjBJSFJsYzNRZ2NuVnVibVZ5Y3lCMGFHRjBJSE4wZFdJZ2FYUmNiaTh2SUdSdmJpZDBJR0p5WldGcklIUm9hVzVuY3k0Z0lFSjFkQ0IzWlNCdVpXVmtJSFJ2SUhkeVlYQWdhWFFnYVc0Z1lTQjBjbmtnWTJGMFkyZ2dhVzRnWTJGelpTQnBkQ0JwYzF4dUx5OGdkM0poY0hCbFpDQnBiaUJ6ZEhKcFkzUWdiVzlrWlNCamIyUmxJSGRvYVdOb0lHUnZaWE51SjNRZ1pHVm1hVzVsSUdGdWVTQm5iRzlpWVd4ekxpQWdTWFFuY3lCcGJuTnBaR1VnWVZ4dUx5OGdablZ1WTNScGIyNGdZbVZqWVhWelpTQjBjbmt2WTJGMFkyaGxjeUJrWlc5d2RHbHRhWHBsSUdsdUlHTmxjblJoYVc0Z1pXNW5hVzVsY3k1Y2JseHVkbUZ5SUdOaFkyaGxaRk5sZEZScGJXVnZkWFE3WEc1MllYSWdZMkZqYUdWa1EyeGxZWEpVYVcxbGIzVjBPMXh1WEc1bWRXNWpkR2x2YmlCa1pXWmhkV3gwVTJWMFZHbHRiM1YwS0NrZ2UxeHVJQ0FnSUhSb2NtOTNJRzVsZHlCRmNuSnZjaWduYzJWMFZHbHRaVzkxZENCb1lYTWdibTkwSUdKbFpXNGdaR1ZtYVc1bFpDY3BPMXh1ZlZ4dVpuVnVZM1JwYjI0Z1pHVm1ZWFZzZEVOc1pXRnlWR2x0Wlc5MWRDQW9LU0I3WEc0Z0lDQWdkR2h5YjNjZ2JtVjNJRVZ5Y205eUtDZGpiR1ZoY2xScGJXVnZkWFFnYUdGeklHNXZkQ0JpWldWdUlHUmxabWx1WldRbktUdGNibjFjYmlobWRXNWpkR2x2YmlBb0tTQjdYRzRnSUNBZ2RISjVJSHRjYmlBZ0lDQWdJQ0FnYVdZZ0tIUjVjR1Z2WmlCelpYUlVhVzFsYjNWMElEMDlQU0FuWm5WdVkzUnBiMjRuS1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0JqWVdOb1pXUlRaWFJVYVcxbGIzVjBJRDBnYzJWMFZHbHRaVzkxZER0Y2JpQWdJQ0FnSUNBZ2ZTQmxiSE5sSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJR05oWTJobFpGTmxkRlJwYldWdmRYUWdQU0JrWldaaGRXeDBVMlYwVkdsdGIzVjBPMXh1SUNBZ0lDQWdJQ0I5WEc0Z0lDQWdmU0JqWVhSamFDQW9aU2tnZTF4dUlDQWdJQ0FnSUNCallXTm9aV1JUWlhSVWFXMWxiM1YwSUQwZ1pHVm1ZWFZzZEZObGRGUnBiVzkxZER0Y2JpQWdJQ0I5WEc0Z0lDQWdkSEo1SUh0Y2JpQWdJQ0FnSUNBZ2FXWWdLSFI1Y0dWdlppQmpiR1ZoY2xScGJXVnZkWFFnUFQwOUlDZG1kVzVqZEdsdmJpY3BJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lHTmhZMmhsWkVOc1pXRnlWR2x0Wlc5MWRDQTlJR05zWldGeVZHbHRaVzkxZER0Y2JpQWdJQ0FnSUNBZ2ZTQmxiSE5sSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJR05oWTJobFpFTnNaV0Z5VkdsdFpXOTFkQ0E5SUdSbFptRjFiSFJEYkdWaGNsUnBiV1Z2ZFhRN1hHNGdJQ0FnSUNBZ0lIMWNiaUFnSUNCOUlHTmhkR05vSUNobEtTQjdYRzRnSUNBZ0lDQWdJR05oWTJobFpFTnNaV0Z5VkdsdFpXOTFkQ0E5SUdSbFptRjFiSFJEYkdWaGNsUnBiV1Z2ZFhRN1hHNGdJQ0FnZlZ4dWZTQW9LU2xjYm1aMWJtTjBhVzl1SUhKMWJsUnBiV1Z2ZFhRb1puVnVLU0I3WEc0Z0lDQWdhV1lnS0dOaFkyaGxaRk5sZEZScGJXVnZkWFFnUFQwOUlITmxkRlJwYldWdmRYUXBJSHRjYmlBZ0lDQWdJQ0FnTHk5dWIzSnRZV3dnWlc1MmFYSnZiV1Z1ZEhNZ2FXNGdjMkZ1WlNCemFYUjFZWFJwYjI1elhHNGdJQ0FnSUNBZ0lISmxkSFZ5YmlCelpYUlVhVzFsYjNWMEtHWjFiaXdnTUNrN1hHNGdJQ0FnZlZ4dUlDQWdJQzh2SUdsbUlITmxkRlJwYldWdmRYUWdkMkZ6YmlkMElHRjJZV2xzWVdKc1pTQmlkWFFnZDJGeklHeGhkSFJsY2lCa1pXWnBibVZrWEc0Z0lDQWdhV1lnS0NoallXTm9aV1JUWlhSVWFXMWxiM1YwSUQwOVBTQmtaV1poZFd4MFUyVjBWR2x0YjNWMElIeDhJQ0ZqWVdOb1pXUlRaWFJVYVcxbGIzVjBLU0FtSmlCelpYUlVhVzFsYjNWMEtTQjdYRzRnSUNBZ0lDQWdJR05oWTJobFpGTmxkRlJwYldWdmRYUWdQU0J6WlhSVWFXMWxiM1YwTzF4dUlDQWdJQ0FnSUNCeVpYUjFjbTRnYzJWMFZHbHRaVzkxZENobWRXNHNJREFwTzF4dUlDQWdJSDFjYmlBZ0lDQjBjbmtnZTF4dUlDQWdJQ0FnSUNBdkx5QjNhR1Z1SUhkb1pXNGdjMjl0WldKdlpIa2dhR0Z6SUhOamNtVjNaV1FnZDJsMGFDQnpaWFJVYVcxbGIzVjBJR0oxZENCdWJ5QkpMa1V1SUcxaFpHUnVaWE56WEc0Z0lDQWdJQ0FnSUhKbGRIVnliaUJqWVdOb1pXUlRaWFJVYVcxbGIzVjBLR1oxYml3Z01DazdYRzRnSUNBZ2ZTQmpZWFJqYUNobEtYdGNiaUFnSUNBZ0lDQWdkSEo1SUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQzh2SUZkb1pXNGdkMlVnWVhKbElHbHVJRWt1UlM0Z1luVjBJSFJvWlNCelkzSnBjSFFnYUdGeklHSmxaVzRnWlhaaGJHVmtJSE52SUVrdVJTNGdaRzlsYzI0bmRDQjBjblZ6ZENCMGFHVWdaMnh2WW1Gc0lHOWlhbVZqZENCM2FHVnVJR05oYkd4bFpDQnViM0p0WVd4c2VWeHVJQ0FnSUNBZ0lDQWdJQ0FnY21WMGRYSnVJR05oWTJobFpGTmxkRlJwYldWdmRYUXVZMkZzYkNodWRXeHNMQ0JtZFc0c0lEQXBPMXh1SUNBZ0lDQWdJQ0I5SUdOaGRHTm9LR1VwZTF4dUlDQWdJQ0FnSUNBZ0lDQWdMeThnYzJGdFpTQmhjeUJoWW05MlpTQmlkWFFnZDJobGJpQnBkQ2R6SUdFZ2RtVnljMmx2YmlCdlppQkpMa1V1SUhSb1lYUWdiWFZ6ZENCb1lYWmxJSFJvWlNCbmJHOWlZV3dnYjJKcVpXTjBJR1p2Y2lBbmRHaHBjeWNzSUdodmNHWjFiR3g1SUc5MWNpQmpiMjUwWlhoMElHTnZjbkpsWTNRZ2IzUm9aWEozYVhObElHbDBJSGRwYkd3Z2RHaHliM2NnWVNCbmJHOWlZV3dnWlhKeWIzSmNiaUFnSUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUJqWVdOb1pXUlRaWFJVYVcxbGIzVjBMbU5oYkd3b2RHaHBjeXdnWm5WdUxDQXdLVHRjYmlBZ0lDQWdJQ0FnZlZ4dUlDQWdJSDFjYmx4dVhHNTlYRzVtZFc1amRHbHZiaUJ5ZFc1RGJHVmhjbFJwYldWdmRYUW9iV0Z5YTJWeUtTQjdYRzRnSUNBZ2FXWWdLR05oWTJobFpFTnNaV0Z5VkdsdFpXOTFkQ0E5UFQwZ1kyeGxZWEpVYVcxbGIzVjBLU0I3WEc0Z0lDQWdJQ0FnSUM4dmJtOXliV0ZzSUdWdWRtbHliMjFsYm5SeklHbHVJSE5oYm1VZ2MybDBkV0YwYVc5dWMxeHVJQ0FnSUNBZ0lDQnlaWFIxY200Z1kyeGxZWEpVYVcxbGIzVjBLRzFoY210bGNpazdYRzRnSUNBZ2ZWeHVJQ0FnSUM4dklHbG1JR05zWldGeVZHbHRaVzkxZENCM1lYTnVKM1FnWVhaaGFXeGhZbXhsSUdKMWRDQjNZWE1nYkdGMGRHVnlJR1JsWm1sdVpXUmNiaUFnSUNCcFppQW9LR05oWTJobFpFTnNaV0Z5VkdsdFpXOTFkQ0E5UFQwZ1pHVm1ZWFZzZEVOc1pXRnlWR2x0Wlc5MWRDQjhmQ0FoWTJGamFHVmtRMnhsWVhKVWFXMWxiM1YwS1NBbUppQmpiR1ZoY2xScGJXVnZkWFFwSUh0Y2JpQWdJQ0FnSUNBZ1kyRmphR1ZrUTJ4bFlYSlVhVzFsYjNWMElEMGdZMnhsWVhKVWFXMWxiM1YwTzF4dUlDQWdJQ0FnSUNCeVpYUjFjbTRnWTJ4bFlYSlVhVzFsYjNWMEtHMWhjbXRsY2lrN1hHNGdJQ0FnZlZ4dUlDQWdJSFJ5ZVNCN1hHNGdJQ0FnSUNBZ0lDOHZJSGRvWlc0Z2QyaGxiaUJ6YjIxbFltOWtlU0JvWVhNZ2MyTnlaWGRsWkNCM2FYUm9JSE5sZEZScGJXVnZkWFFnWW5WMElHNXZJRWt1UlM0Z2JXRmtaRzVsYzNOY2JpQWdJQ0FnSUNBZ2NtVjBkWEp1SUdOaFkyaGxaRU5zWldGeVZHbHRaVzkxZENodFlYSnJaWElwTzF4dUlDQWdJSDBnWTJGMFkyZ2dLR1VwZTF4dUlDQWdJQ0FnSUNCMGNua2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0x5OGdWMmhsYmlCM1pTQmhjbVVnYVc0Z1NTNUZMaUJpZFhRZ2RHaGxJSE5qY21sd2RDQm9ZWE1nWW1WbGJpQmxkbUZzWldRZ2MyOGdTUzVGTGlCa2IyVnpiaWQwSUNCMGNuVnpkQ0IwYUdVZ1oyeHZZbUZzSUc5aWFtVmpkQ0IzYUdWdUlHTmhiR3hsWkNCdWIzSnRZV3hzZVZ4dUlDQWdJQ0FnSUNBZ0lDQWdjbVYwZFhKdUlHTmhZMmhsWkVOc1pXRnlWR2x0Wlc5MWRDNWpZV3hzS0c1MWJHd3NJRzFoY210bGNpazdYRzRnSUNBZ0lDQWdJSDBnWTJGMFkyZ2dLR1VwZTF4dUlDQWdJQ0FnSUNBZ0lDQWdMeThnYzJGdFpTQmhjeUJoWW05MlpTQmlkWFFnZDJobGJpQnBkQ2R6SUdFZ2RtVnljMmx2YmlCdlppQkpMa1V1SUhSb1lYUWdiWFZ6ZENCb1lYWmxJSFJvWlNCbmJHOWlZV3dnYjJKcVpXTjBJR1p2Y2lBbmRHaHBjeWNzSUdodmNHWjFiR3g1SUc5MWNpQmpiMjUwWlhoMElHTnZjbkpsWTNRZ2IzUm9aWEozYVhObElHbDBJSGRwYkd3Z2RHaHliM2NnWVNCbmJHOWlZV3dnWlhKeWIzSXVYRzRnSUNBZ0lDQWdJQ0FnSUNBdkx5QlRiMjFsSUhabGNuTnBiMjV6SUc5bUlFa3VSUzRnYUdGMlpTQmthV1ptWlhKbGJuUWdjblZzWlhNZ1ptOXlJR05zWldGeVZHbHRaVzkxZENCMmN5QnpaWFJVYVcxbGIzVjBYRzRnSUNBZ0lDQWdJQ0FnSUNCeVpYUjFjbTRnWTJGamFHVmtRMnhsWVhKVWFXMWxiM1YwTG1OaGJHd29kR2hwY3l3Z2JXRnlhMlZ5S1R0Y2JpQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUgxY2JseHVYRzVjYm4xY2JuWmhjaUJ4ZFdWMVpTQTlJRnRkTzF4dWRtRnlJR1J5WVdsdWFXNW5JRDBnWm1Gc2MyVTdYRzUyWVhJZ1kzVnljbVZ1ZEZGMVpYVmxPMXh1ZG1GeUlIRjFaWFZsU1c1a1pYZ2dQU0F0TVR0Y2JseHVablZ1WTNScGIyNGdZMnhsWVc1VmNFNWxlSFJVYVdOcktDa2dlMXh1SUNBZ0lHbG1JQ2doWkhKaGFXNXBibWNnZkh3Z0lXTjFjbkpsYm5SUmRXVjFaU2tnZTF4dUlDQWdJQ0FnSUNCeVpYUjFjbTQ3WEc0Z0lDQWdmVnh1SUNBZ0lHUnlZV2x1YVc1bklEMGdabUZzYzJVN1hHNGdJQ0FnYVdZZ0tHTjFjbkpsYm5SUmRXVjFaUzVzWlc1bmRHZ3BJSHRjYmlBZ0lDQWdJQ0FnY1hWbGRXVWdQU0JqZFhKeVpXNTBVWFZsZFdVdVkyOXVZMkYwS0hGMVpYVmxLVHRjYmlBZ0lDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUNBZ0lDQnhkV1YxWlVsdVpHVjRJRDBnTFRFN1hHNGdJQ0FnZlZ4dUlDQWdJR2xtSUNoeGRXVjFaUzVzWlc1bmRHZ3BJSHRjYmlBZ0lDQWdJQ0FnWkhKaGFXNVJkV1YxWlNncE8xeHVJQ0FnSUgxY2JuMWNibHh1Wm5WdVkzUnBiMjRnWkhKaGFXNVJkV1YxWlNncElIdGNiaUFnSUNCcFppQW9aSEpoYVc1cGJtY3BJSHRjYmlBZ0lDQWdJQ0FnY21WMGRYSnVPMXh1SUNBZ0lIMWNiaUFnSUNCMllYSWdkR2x0Wlc5MWRDQTlJSEoxYmxScGJXVnZkWFFvWTJ4bFlXNVZjRTVsZUhSVWFXTnJLVHRjYmlBZ0lDQmtjbUZwYm1sdVp5QTlJSFJ5ZFdVN1hHNWNiaUFnSUNCMllYSWdiR1Z1SUQwZ2NYVmxkV1V1YkdWdVozUm9PMXh1SUNBZ0lIZG9hV3hsS0d4bGJpa2dlMXh1SUNBZ0lDQWdJQ0JqZFhKeVpXNTBVWFZsZFdVZ1BTQnhkV1YxWlR0Y2JpQWdJQ0FnSUNBZ2NYVmxkV1VnUFNCYlhUdGNiaUFnSUNBZ0lDQWdkMmhwYkdVZ0tDc3JjWFZsZFdWSmJtUmxlQ0E4SUd4bGJpa2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ2FXWWdLR04xY25KbGJuUlJkV1YxWlNrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHTjFjbkpsYm5SUmRXVjFaVnR4ZFdWMVpVbHVaR1Y0WFM1eWRXNG9LVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0J4ZFdWMVpVbHVaR1Y0SUQwZ0xURTdYRzRnSUNBZ0lDQWdJR3hsYmlBOUlIRjFaWFZsTG14bGJtZDBhRHRjYmlBZ0lDQjlYRzRnSUNBZ1kzVnljbVZ1ZEZGMVpYVmxJRDBnYm5Wc2JEdGNiaUFnSUNCa2NtRnBibWx1WnlBOUlHWmhiSE5sTzF4dUlDQWdJSEoxYmtOc1pXRnlWR2x0Wlc5MWRDaDBhVzFsYjNWMEtUdGNibjFjYmx4dWNISnZZMlZ6Y3k1dVpYaDBWR2xqYXlBOUlHWjFibU4wYVc5dUlDaG1kVzRwSUh0Y2JpQWdJQ0IyWVhJZ1lYSm5jeUE5SUc1bGR5QkJjbkpoZVNoaGNtZDFiV1Z1ZEhNdWJHVnVaM1JvSUMwZ01TazdYRzRnSUNBZ2FXWWdLR0Z5WjNWdFpXNTBjeTVzWlc1bmRHZ2dQaUF4S1NCN1hHNGdJQ0FnSUNBZ0lHWnZjaUFvZG1GeUlHa2dQU0F4T3lCcElEd2dZWEpuZFcxbGJuUnpMbXhsYm1kMGFEc2dhU3NyS1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0JoY21kelcya2dMU0F4WFNBOUlHRnlaM1Z0Wlc1MGMxdHBYVHRjYmlBZ0lDQWdJQ0FnZlZ4dUlDQWdJSDFjYmlBZ0lDQnhkV1YxWlM1d2RYTm9LRzVsZHlCSmRHVnRLR1oxYml3Z1lYSm5jeWtwTzF4dUlDQWdJR2xtSUNoeGRXVjFaUzVzWlc1bmRHZ2dQVDA5SURFZ0ppWWdJV1J5WVdsdWFXNW5LU0I3WEc0Z0lDQWdJQ0FnSUhKMWJsUnBiV1Z2ZFhRb1pISmhhVzVSZFdWMVpTazdYRzRnSUNBZ2ZWeHVmVHRjYmx4dUx5OGdkamdnYkdsclpYTWdjSEpsWkdsamRHbGliR1VnYjJKcVpXTjBjMXh1Wm5WdVkzUnBiMjRnU1hSbGJTaG1kVzRzSUdGeWNtRjVLU0I3WEc0Z0lDQWdkR2hwY3k1bWRXNGdQU0JtZFc0N1hHNGdJQ0FnZEdocGN5NWhjbkpoZVNBOUlHRnljbUY1TzF4dWZWeHVTWFJsYlM1d2NtOTBiM1I1Y0dVdWNuVnVJRDBnWm5WdVkzUnBiMjRnS0NrZ2UxeHVJQ0FnSUhSb2FYTXVablZ1TG1Gd2NHeDVLRzUxYkd3c0lIUm9hWE11WVhKeVlYa3BPMXh1ZlR0Y2JuQnliMk5sYzNNdWRHbDBiR1VnUFNBblluSnZkM05sY2ljN1hHNXdjbTlqWlhOekxtSnliM2R6WlhJZ1BTQjBjblZsTzF4dWNISnZZMlZ6Y3k1bGJuWWdQU0I3ZlR0Y2JuQnliMk5sYzNNdVlYSm5kaUE5SUZ0ZE8xeHVjSEp2WTJWemN5NTJaWEp6YVc5dUlEMGdKeWM3SUM4dklHVnRjSFI1SUhOMGNtbHVaeUIwYnlCaGRtOXBaQ0J5WldkbGVIQWdhWE56ZFdWelhHNXdjbTlqWlhOekxuWmxjbk5wYjI1eklEMGdlMzA3WEc1Y2JtWjFibU4wYVc5dUlHNXZiM0FvS1NCN2ZWeHVYRzV3Y205alpYTnpMbTl1SUQwZ2JtOXZjRHRjYm5CeWIyTmxjM011WVdSa1RHbHpkR1Z1WlhJZ1BTQnViMjl3TzF4dWNISnZZMlZ6Y3k1dmJtTmxJRDBnYm05dmNEdGNibkJ5YjJObGMzTXViMlptSUQwZ2JtOXZjRHRjYm5CeWIyTmxjM011Y21WdGIzWmxUR2x6ZEdWdVpYSWdQU0J1YjI5d08xeHVjSEp2WTJWemN5NXlaVzF2ZG1WQmJHeE1hWE4wWlc1bGNuTWdQU0J1YjI5d08xeHVjSEp2WTJWemN5NWxiV2wwSUQwZ2JtOXZjRHRjYm5CeWIyTmxjM011Y0hKbGNHVnVaRXhwYzNSbGJtVnlJRDBnYm05dmNEdGNibkJ5YjJObGMzTXVjSEpsY0dWdVpFOXVZMlZNYVhOMFpXNWxjaUE5SUc1dmIzQTdYRzVjYm5CeWIyTmxjM011YkdsemRHVnVaWEp6SUQwZ1puVnVZM1JwYjI0Z0tHNWhiV1VwSUhzZ2NtVjBkWEp1SUZ0ZElIMWNibHh1Y0hKdlkyVnpjeTVpYVc1a2FXNW5JRDBnWm5WdVkzUnBiMjRnS0c1aGJXVXBJSHRjYmlBZ0lDQjBhSEp2ZHlCdVpYY2dSWEp5YjNJb0ozQnliMk5sYzNNdVltbHVaR2x1WnlCcGN5QnViM1FnYzNWd2NHOXlkR1ZrSnlrN1hHNTlPMXh1WEc1d2NtOWpaWE56TG1OM1pDQTlJR1oxYm1OMGFXOXVJQ2dwSUhzZ2NtVjBkWEp1SUNjdkp5QjlPMXh1Y0hKdlkyVnpjeTVqYUdScGNpQTlJR1oxYm1OMGFXOXVJQ2hrYVhJcElIdGNiaUFnSUNCMGFISnZkeUJ1WlhjZ1JYSnliM0lvSjNCeWIyTmxjM011WTJoa2FYSWdhWE1nYm05MElITjFjSEJ2Y25SbFpDY3BPMXh1ZlR0Y2JuQnliMk5sYzNNdWRXMWhjMnNnUFNCbWRXNWpkR2x2YmlncElIc2djbVYwZFhKdUlEQTdJSDA3WEc0aUxDSXZLaXBjYmlBcUlFTnZjSGx5YVdkb2RDQXlNREV6TFhCeVpYTmxiblFzSUVaaFkyVmliMjlyTENCSmJtTXVYRzRnS2lCQmJHd2djbWxuYUhSeklISmxjMlZ5ZG1Wa0xseHVJQ3BjYmlBcUlGUm9hWE1nYzI5MWNtTmxJR052WkdVZ2FYTWdiR2xqWlc1elpXUWdkVzVrWlhJZ2RHaGxJRUpUUkMxemRIbHNaU0JzYVdObGJuTmxJR1p2ZFc1a0lHbHVJSFJvWlZ4dUlDb2dURWxEUlU1VFJTQm1hV3hsSUdsdUlIUm9aU0J5YjI5MElHUnBjbVZqZEc5eWVTQnZaaUIwYUdseklITnZkWEpqWlNCMGNtVmxMaUJCYmlCaFpHUnBkR2x2Ym1Gc0lHZHlZVzUwWEc0Z0tpQnZaaUJ3WVhSbGJuUWdjbWxuYUhSeklHTmhiaUJpWlNCbWIzVnVaQ0JwYmlCMGFHVWdVRUZVUlU1VVV5Qm1hV3hsSUdsdUlIUm9aU0J6WVcxbElHUnBjbVZqZEc5eWVTNWNiaUFxTDF4dVhHNG5kWE5sSUhOMGNtbGpkQ2M3WEc1Y2JtbG1JQ2h3Y205alpYTnpMbVZ1ZGk1T1QwUkZYMFZPVmlBaFBUMGdKM0J5YjJSMVkzUnBiMjRuS1NCN1hHNGdJSFpoY2lCcGJuWmhjbWxoYm5RZ1BTQnlaWEYxYVhKbEtDZG1ZbXB6TDJ4cFlpOXBiblpoY21saGJuUW5LVHRjYmlBZ2RtRnlJSGRoY201cGJtY2dQU0J5WlhGMWFYSmxLQ2RtWW1wekwyeHBZaTkzWVhKdWFXNW5KeWs3WEc0Z0lIWmhjaUJTWldGamRGQnliM0JVZVhCbGMxTmxZM0psZENBOUlISmxjWFZwY21Vb0p5NHZiR2xpTDFKbFlXTjBVSEp2Y0ZSNWNHVnpVMlZqY21WMEp5azdYRzRnSUhaaGNpQnNiMmRuWldSVWVYQmxSbUZwYkhWeVpYTWdQU0I3ZlR0Y2JuMWNibHh1THlvcVhHNGdLaUJCYzNObGNuUWdkR2hoZENCMGFHVWdkbUZzZFdWeklHMWhkR05vSUhkcGRHZ2dkR2hsSUhSNWNHVWdjM0JsWTNNdVhHNGdLaUJGY25KdmNpQnRaWE56WVdkbGN5QmhjbVVnYldWdGIzSnBlbVZrSUdGdVpDQjNhV3hzSUc5dWJIa2dZbVVnYzJodmQyNGdiMjVqWlM1Y2JpQXFYRzRnS2lCQWNHRnlZVzBnZTI5aWFtVmpkSDBnZEhsd1pWTndaV056SUUxaGNDQnZaaUJ1WVcxbElIUnZJR0VnVW1WaFkzUlFjbTl3Vkhsd1pWeHVJQ29nUUhCaGNtRnRJSHR2WW1wbFkzUjlJSFpoYkhWbGN5QlNkVzUwYVcxbElIWmhiSFZsY3lCMGFHRjBJRzVsWldRZ2RHOGdZbVVnZEhsd1pTMWphR1ZqYTJWa1hHNGdLaUJBY0dGeVlXMGdlM04wY21sdVozMGdiRzlqWVhScGIyNGdaUzVuTGlCY0luQnliM0JjSWl3Z1hDSmpiMjUwWlhoMFhDSXNJRndpWTJocGJHUWdZMjl1ZEdWNGRGd2lYRzRnS2lCQWNHRnlZVzBnZTNOMGNtbHVaMzBnWTI5dGNHOXVaVzUwVG1GdFpTQk9ZVzFsSUc5bUlIUm9aU0JqYjIxd2IyNWxiblFnWm05eUlHVnljbTl5SUcxbGMzTmhaMlZ6TGx4dUlDb2dRSEJoY21GdElIcy9SblZ1WTNScGIyNTlJR2RsZEZOMFlXTnJJRkpsZEhWeWJuTWdkR2hsSUdOdmJYQnZibVZ1ZENCemRHRmpheTVjYmlBcUlFQndjbWwyWVhSbFhHNGdLaTljYm1aMWJtTjBhVzl1SUdOb1pXTnJVSEp2Y0ZSNWNHVnpLSFI1Y0dWVGNHVmpjeXdnZG1Gc2RXVnpMQ0JzYjJOaGRHbHZiaXdnWTI5dGNHOXVaVzUwVG1GdFpTd2daMlYwVTNSaFkyc3BJSHRjYmlBZ2FXWWdLSEJ5YjJObGMzTXVaVzUyTGs1UFJFVmZSVTVXSUNFOVBTQW5jSEp2WkhWamRHbHZiaWNwSUh0Y2JpQWdJQ0JtYjNJZ0tIWmhjaUIwZVhCbFUzQmxZMDVoYldVZ2FXNGdkSGx3WlZOd1pXTnpLU0I3WEc0Z0lDQWdJQ0JwWmlBb2RIbHdaVk53WldOekxtaGhjMDkzYmxCeWIzQmxjblI1S0hSNWNHVlRjR1ZqVG1GdFpTa3BJSHRjYmlBZ0lDQWdJQ0FnZG1GeUlHVnljbTl5TzF4dUlDQWdJQ0FnSUNBdkx5QlFjbTl3SUhSNWNHVWdkbUZzYVdSaGRHbHZiaUJ0WVhrZ2RHaHliM2N1SUVsdUlHTmhjMlVnZEdobGVTQmtieXdnZDJVZ1pHOXVKM1FnZDJGdWRDQjBiMXh1SUNBZ0lDQWdJQ0F2THlCbVlXbHNJSFJvWlNCeVpXNWtaWElnY0doaGMyVWdkMmhsY21VZ2FYUWdaR2xrYmlkMElHWmhhV3dnWW1WbWIzSmxMaUJUYnlCM1pTQnNiMmNnYVhRdVhHNGdJQ0FnSUNBZ0lDOHZJRUZtZEdWeUlIUm9aWE5sSUdoaGRtVWdZbVZsYmlCamJHVmhibVZrSUhWd0xDQjNaU2RzYkNCc1pYUWdkR2hsYlNCMGFISnZkeTVjYmlBZ0lDQWdJQ0FnZEhKNUlIdGNiaUFnSUNBZ0lDQWdJQ0F2THlCVWFHbHpJR2x6SUdsdWRHVnVkR2x2Ym1Gc2JIa2dZVzRnYVc1MllYSnBZVzUwSUhSb1lYUWdaMlYwY3lCallYVm5hSFF1SUVsMEozTWdkR2hsSUhOaGJXVmNiaUFnSUNBZ0lDQWdJQ0F2THlCaVpXaGhkbWx2Y2lCaGN5QjNhWFJvYjNWMElIUm9hWE1nYzNSaGRHVnRaVzUwSUdWNFkyVndkQ0IzYVhSb0lHRWdZbVYwZEdWeUlHMWxjM05oWjJVdVhHNGdJQ0FnSUNBZ0lDQWdhVzUyWVhKcFlXNTBLSFI1Y0dWdlppQjBlWEJsVTNCbFkzTmJkSGx3WlZOd1pXTk9ZVzFsWFNBOVBUMGdKMloxYm1OMGFXOXVKeXdnSnlWek9pQWxjeUIwZVhCbElHQWxjMkFnYVhNZ2FXNTJZV3hwWkRzZ2FYUWdiWFZ6ZENCaVpTQmhJR1oxYm1OMGFXOXVMQ0IxYzNWaGJHeDVJR1p5YjIwZ0p5QXJJQ2RTWldGamRDNVFjbTl3Vkhsd1pYTXVKeXdnWTI5dGNHOXVaVzUwVG1GdFpTQjhmQ0FuVW1WaFkzUWdZMnhoYzNNbkxDQnNiMk5oZEdsdmJpd2dkSGx3WlZOd1pXTk9ZVzFsS1R0Y2JpQWdJQ0FnSUNBZ0lDQmxjbkp2Y2lBOUlIUjVjR1ZUY0dWamMxdDBlWEJsVTNCbFkwNWhiV1ZkS0haaGJIVmxjeXdnZEhsd1pWTndaV05PWVcxbExDQmpiMjF3YjI1bGJuUk9ZVzFsTENCc2IyTmhkR2x2Yml3Z2JuVnNiQ3dnVW1WaFkzUlFjbTl3Vkhsd1pYTlRaV055WlhRcE8xeHVJQ0FnSUNBZ0lDQjlJR05oZEdOb0lDaGxlQ2tnZTF4dUlDQWdJQ0FnSUNBZ0lHVnljbTl5SUQwZ1pYZzdYRzRnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnZDJGeWJtbHVaeWdoWlhKeWIzSWdmSHdnWlhKeWIzSWdhVzV6ZEdGdVkyVnZaaUJGY25KdmNpd2dKeVZ6T2lCMGVYQmxJSE53WldOcFptbGpZWFJwYjI0Z2IyWWdKWE1nWUNWellDQnBjeUJwYm5aaGJHbGtPeUIwYUdVZ2RIbHdaU0JqYUdWamEyVnlJQ2NnS3lBblpuVnVZM1JwYjI0Z2JYVnpkQ0J5WlhSMWNtNGdZRzUxYkd4Z0lHOXlJR0Z1SUdCRmNuSnZjbUFnWW5WMElISmxkSFZ5Ym1Wa0lHRWdKWE11SUNjZ0t5QW5XVzkxSUcxaGVTQm9ZWFpsSUdadmNtZHZkSFJsYmlCMGJ5QndZWE56SUdGdUlHRnlaM1Z0Wlc1MElIUnZJSFJvWlNCMGVYQmxJR05vWldOclpYSWdKeUFySUNkamNtVmhkRzl5SUNoaGNuSmhlVTltTENCcGJuTjBZVzVqWlU5bUxDQnZZbXBsWTNSUFppd2diMjVsVDJZc0lHOXVaVTltVkhsd1pTd2dZVzVrSUNjZ0t5QW5jMmhoY0dVZ1lXeHNJSEpsY1hWcGNtVWdZVzRnWVhKbmRXMWxiblFwTGljc0lHTnZiWEJ2Ym1WdWRFNWhiV1VnZkh3Z0oxSmxZV04wSUdOc1lYTnpKeXdnYkc5allYUnBiMjRzSUhSNWNHVlRjR1ZqVG1GdFpTd2dkSGx3Wlc5bUlHVnljbTl5S1R0Y2JpQWdJQ0FnSUNBZ2FXWWdLR1Z5Y205eUlHbHVjM1JoYm1ObGIyWWdSWEp5YjNJZ0ppWWdJU2hsY25KdmNpNXRaWE56WVdkbElHbHVJR3h2WjJkbFpGUjVjR1ZHWVdsc2RYSmxjeWtwSUh0Y2JpQWdJQ0FnSUNBZ0lDQXZMeUJQYm14NUlHMXZibWwwYjNJZ2RHaHBjeUJtWVdsc2RYSmxJRzl1WTJVZ1ltVmpZWFZ6WlNCMGFHVnlaU0IwWlc1a2N5QjBieUJpWlNCaElHeHZkQ0J2WmlCMGFHVmNiaUFnSUNBZ0lDQWdJQ0F2THlCellXMWxJR1Z5Y205eUxseHVJQ0FnSUNBZ0lDQWdJR3h2WjJkbFpGUjVjR1ZHWVdsc2RYSmxjMXRsY25KdmNpNXRaWE56WVdkbFhTQTlJSFJ5ZFdVN1hHNWNiaUFnSUNBZ0lDQWdJQ0IyWVhJZ2MzUmhZMnNnUFNCblpYUlRkR0ZqYXlBL0lHZGxkRk4wWVdOcktDa2dPaUFuSnp0Y2JseHVJQ0FnSUNBZ0lDQWdJSGRoY201cGJtY29abUZzYzJVc0lDZEdZV2xzWldRZ0pYTWdkSGx3WlRvZ0pYTWxjeWNzSUd4dlkyRjBhVzl1TENCbGNuSnZjaTV0WlhOellXZGxMQ0J6ZEdGamF5QWhQU0J1ZFd4c0lEOGdjM1JoWTJzZ09pQW5KeWs3WEc0Z0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUgxY2JpQWdJQ0I5WEc0Z0lIMWNibjFjYmx4dWJXOWtkV3hsTG1WNGNHOXlkSE1nUFNCamFHVmphMUJ5YjNCVWVYQmxjenRjYmlJc0lpOHFLbHh1SUNvZ1EyOXdlWEpwWjJoMElESXdNVE10Y0hKbGMyVnVkQ3dnUm1GalpXSnZiMnNzSUVsdVl5NWNiaUFxSUVGc2JDQnlhV2RvZEhNZ2NtVnpaWEoyWldRdVhHNGdLbHh1SUNvZ1ZHaHBjeUJ6YjNWeVkyVWdZMjlrWlNCcGN5QnNhV05sYm5ObFpDQjFibVJsY2lCMGFHVWdRbE5FTFhOMGVXeGxJR3hwWTJWdWMyVWdabTkxYm1RZ2FXNGdkR2hsWEc0Z0tpQk1TVU5GVGxORklHWnBiR1VnYVc0Z2RHaGxJSEp2YjNRZ1pHbHlaV04wYjNKNUlHOW1JSFJvYVhNZ2MyOTFjbU5sSUhSeVpXVXVJRUZ1SUdGa1pHbDBhVzl1WVd3Z1ozSmhiblJjYmlBcUlHOW1JSEJoZEdWdWRDQnlhV2RvZEhNZ1kyRnVJR0psSUdadmRXNWtJR2x1SUhSb1pTQlFRVlJGVGxSVElHWnBiR1VnYVc0Z2RHaGxJSE5oYldVZ1pHbHlaV04wYjNKNUxseHVJQ292WEc1Y2JpZDFjMlVnYzNSeWFXTjBKenRjYmx4dUx5OGdVbVZoWTNRZ01UVXVOU0J5WldabGNtVnVZMlZ6SUhSb2FYTWdiVzlrZFd4bExDQmhibVFnWVhOemRXMWxjeUJRY205d1ZIbHdaWE1nWVhKbElITjBhV3hzSUdOaGJHeGhZbXhsSUdsdUlIQnliMlIxWTNScGIyNHVYRzR2THlCVWFHVnlaV1p2Y21VZ2QyVWdjbVV0Wlhod2IzSjBJR1JsZG1Wc2IzQnRaVzUwTFc5dWJIa2dkbVZ5YzJsdmJpQjNhWFJvSUdGc2JDQjBhR1VnVUhKdmNGUjVjR1Z6SUdOb1pXTnJjeUJvWlhKbExseHVMeThnU0c5M1pYWmxjaUJwWmlCdmJtVWdhWE1nYldsbmNtRjBhVzVuSUhSdklIUm9aU0JnY0hKdmNDMTBlWEJsYzJBZ2JuQnRJR3hwWW5KaGNua3NJSFJvWlhrZ2QybHNiQ0JuYnlCMGFISnZkV2RvSUhSb1pWeHVMeThnWUdsdVpHVjRMbXB6WUNCbGJuUnllU0J3YjJsdWRDd2dZVzVrSUdsMElIZHBiR3dnWW5KaGJtTm9JR1JsY0dWdVpHbHVaeUJ2YmlCMGFHVWdaVzUyYVhKdmJtMWxiblF1WEc1MllYSWdabUZqZEc5eWVTQTlJSEpsY1hWcGNtVW9KeTR2Wm1GamRHOXllVmRwZEdoVWVYQmxRMmhsWTJ0bGNuTW5LVHRjYm0xdlpIVnNaUzVsZUhCdmNuUnpJRDBnWm5WdVkzUnBiMjRvYVhOV1lXeHBaRVZzWlcxbGJuUXBJSHRjYmlBZ0x5OGdTWFFnYVhNZ2MzUnBiR3dnWVd4c2IzZGxaQ0JwYmlBeE5TNDFMbHh1SUNCMllYSWdkR2h5YjNkUGJrUnBjbVZqZEVGalkyVnpjeUE5SUdaaGJITmxPMXh1SUNCeVpYUjFjbTRnWm1GamRHOXllU2hwYzFaaGJHbGtSV3hsYldWdWRDd2dkR2h5YjNkUGJrUnBjbVZqZEVGalkyVnpjeWs3WEc1OU8xeHVJaXdpTHlvcVhHNGdLaUJEYjNCNWNtbG5hSFFnTWpBeE15MXdjbVZ6Wlc1MExDQkdZV05sWW05dmF5d2dTVzVqTGx4dUlDb2dRV3hzSUhKcFoyaDBjeUJ5WlhObGNuWmxaQzVjYmlBcVhHNGdLaUJVYUdseklITnZkWEpqWlNCamIyUmxJR2x6SUd4cFkyVnVjMlZrSUhWdVpHVnlJSFJvWlNCQ1UwUXRjM1I1YkdVZ2JHbGpaVzV6WlNCbWIzVnVaQ0JwYmlCMGFHVmNiaUFxSUV4SlEwVk9VMFVnWm1sc1pTQnBiaUIwYUdVZ2NtOXZkQ0JrYVhKbFkzUnZjbmtnYjJZZ2RHaHBjeUJ6YjNWeVkyVWdkSEpsWlM0Z1FXNGdZV1JrYVhScGIyNWhiQ0JuY21GdWRGeHVJQ29nYjJZZ2NHRjBaVzUwSUhKcFoyaDBjeUJqWVc0Z1ltVWdabTkxYm1RZ2FXNGdkR2hsSUZCQlZFVk9WRk1nWm1sc1pTQnBiaUIwYUdVZ2MyRnRaU0JrYVhKbFkzUnZjbmt1WEc0Z0tpOWNibHh1SjNWelpTQnpkSEpwWTNRbk8xeHVYRzUyWVhJZ1pXMXdkSGxHZFc1amRHbHZiaUE5SUhKbGNYVnBjbVVvSjJaaWFuTXZiR2xpTDJWdGNIUjVSblZ1WTNScGIyNG5LVHRjYm5aaGNpQnBiblpoY21saGJuUWdQU0J5WlhGMWFYSmxLQ2RtWW1wekwyeHBZaTlwYm5aaGNtbGhiblFuS1R0Y2JuWmhjaUIzWVhKdWFXNW5JRDBnY21WeGRXbHlaU2duWm1KcWN5OXNhV0l2ZDJGeWJtbHVaeWNwTzF4dVhHNTJZWElnVW1WaFkzUlFjbTl3Vkhsd1pYTlRaV055WlhRZ1BTQnlaWEYxYVhKbEtDY3VMMnhwWWk5U1pXRmpkRkJ5YjNCVWVYQmxjMU5sWTNKbGRDY3BPMXh1ZG1GeUlHTm9aV05yVUhKdmNGUjVjR1Z6SUQwZ2NtVnhkV2x5WlNnbkxpOWphR1ZqYTFCeWIzQlVlWEJsY3ljcE8xeHVYRzV0YjJSMWJHVXVaWGh3YjNKMGN5QTlJR1oxYm1OMGFXOXVLR2x6Vm1Gc2FXUkZiR1Z0Wlc1MExDQjBhSEp2ZDA5dVJHbHlaV04wUVdOalpYTnpLU0I3WEc0Z0lDOHFJR2RzYjJKaGJDQlRlVzFpYjJ3Z0tpOWNiaUFnZG1GeUlFbFVSVkpCVkU5U1gxTlpUVUpQVENBOUlIUjVjR1Z2WmlCVGVXMWliMndnUFQwOUlDZG1kVzVqZEdsdmJpY2dKaVlnVTNsdFltOXNMbWwwWlhKaGRHOXlPMXh1SUNCMllYSWdSa0ZWV0Y5SlZFVlNRVlJQVWw5VFdVMUNUMHdnUFNBblFFQnBkR1Z5WVhSdmNpYzdJQzh2SUVKbFptOXlaU0JUZVcxaWIyd2djM0JsWXk1Y2JseHVJQ0F2S2lwY2JpQWdJQ29nVW1WMGRYSnVjeUIwYUdVZ2FYUmxjbUYwYjNJZ2JXVjBhRzlrSUdaMWJtTjBhVzl1SUdOdmJuUmhhVzVsWkNCdmJpQjBhR1VnYVhSbGNtRmliR1VnYjJKcVpXTjBMbHh1SUNBZ0tseHVJQ0FnS2lCQ1pTQnpkWEpsSUhSdklHbHVkbTlyWlNCMGFHVWdablZ1WTNScGIyNGdkMmwwYUNCMGFHVWdhWFJsY21GaWJHVWdZWE1nWTI5dWRHVjRkRHBjYmlBZ0lDcGNiaUFnSUNvZ0lDQWdJSFpoY2lCcGRHVnlZWFJ2Y2tadUlEMGdaMlYwU1hSbGNtRjBiM0pHYmlodGVVbDBaWEpoWW14bEtUdGNiaUFnSUNvZ0lDQWdJR2xtSUNocGRHVnlZWFJ2Y2tadUtTQjdYRzRnSUNBcUlDQWdJQ0FnSUhaaGNpQnBkR1Z5WVhSdmNpQTlJR2wwWlhKaGRHOXlSbTR1WTJGc2JDaHRlVWwwWlhKaFlteGxLVHRjYmlBZ0lDb2dJQ0FnSUNBZ0xpNHVYRzRnSUNBcUlDQWdJQ0I5WEc0Z0lDQXFYRzRnSUNBcUlFQndZWEpoYlNCN1AyOWlhbVZqZEgwZ2JXRjVZbVZKZEdWeVlXSnNaVnh1SUNBZ0tpQkFjbVYwZFhKdUlIcy9ablZ1WTNScGIyNTlYRzRnSUNBcUwxeHVJQ0JtZFc1amRHbHZiaUJuWlhSSmRHVnlZWFJ2Y2tadUtHMWhlV0psU1hSbGNtRmliR1VwSUh0Y2JpQWdJQ0IyWVhJZ2FYUmxjbUYwYjNKR2JpQTlJRzFoZVdKbFNYUmxjbUZpYkdVZ0ppWWdLRWxVUlZKQlZFOVNYMU5aVFVKUFRDQW1KaUJ0WVhsaVpVbDBaWEpoWW14bFcwbFVSVkpCVkU5U1gxTlpUVUpQVEYwZ2ZId2diV0Y1WW1WSmRHVnlZV0pzWlZ0R1FWVllYMGxVUlZKQlZFOVNYMU5aVFVKUFRGMHBPMXh1SUNBZ0lHbG1JQ2gwZVhCbGIyWWdhWFJsY21GMGIzSkdiaUE5UFQwZ0oyWjFibU4wYVc5dUp5a2dlMXh1SUNBZ0lDQWdjbVYwZFhKdUlHbDBaWEpoZEc5eVJtNDdYRzRnSUNBZ2ZWeHVJQ0I5WEc1Y2JpQWdMeW9xWEc0Z0lDQXFJRU52Ykd4bFkzUnBiMjRnYjJZZ2JXVjBhRzlrY3lCMGFHRjBJR0ZzYkc5M0lHUmxZMnhoY21GMGFXOXVJR0Z1WkNCMllXeHBaR0YwYVc5dUlHOW1JSEJ5YjNCeklIUm9ZWFFnWVhKbFhHNGdJQ0FxSUhOMWNIQnNhV1ZrSUhSdklGSmxZV04wSUdOdmJYQnZibVZ1ZEhNdUlFVjRZVzF3YkdVZ2RYTmhaMlU2WEc0Z0lDQXFYRzRnSUNBcUlDQWdkbUZ5SUZCeWIzQnpJRDBnY21WeGRXbHlaU2duVW1WaFkzUlFjbTl3Vkhsd1pYTW5LVHRjYmlBZ0lDb2dJQ0IyWVhJZ1RYbEJjblJwWTJ4bElEMGdVbVZoWTNRdVkzSmxZWFJsUTJ4aGMzTW9lMXh1SUNBZ0tpQWdJQ0FnY0hKdmNGUjVjR1Z6T2lCN1hHNGdJQ0FxSUNBZ0lDQWdJQzh2SUVGdUlHOXdkR2x2Ym1Gc0lITjBjbWx1WnlCd2NtOXdJRzVoYldWa0lGd2laR1Z6WTNKcGNIUnBiMjVjSWk1Y2JpQWdJQ29nSUNBZ0lDQWdaR1Z6WTNKcGNIUnBiMjQ2SUZCeWIzQnpMbk4wY21sdVp5eGNiaUFnSUNwY2JpQWdJQ29nSUNBZ0lDQWdMeThnUVNCeVpYRjFhWEpsWkNCbGJuVnRJSEJ5YjNBZ2JtRnRaV1FnWENKallYUmxaMjl5ZVZ3aUxseHVJQ0FnS2lBZ0lDQWdJQ0JqWVhSbFoyOXllVG9nVUhKdmNITXViMjVsVDJZb1d5ZE9aWGR6Snl3blVHaHZkRzl6SjEwcExtbHpVbVZ4ZFdseVpXUXNYRzRnSUNBcVhHNGdJQ0FxSUNBZ0lDQWdJQzh2SUVFZ2NISnZjQ0J1WVcxbFpDQmNJbVJwWVd4dloxd2lJSFJvWVhRZ2NtVnhkV2x5WlhNZ1lXNGdhVzV6ZEdGdVkyVWdiMllnUkdsaGJHOW5MbHh1SUNBZ0tpQWdJQ0FnSUNCa2FXRnNiMmM2SUZCeWIzQnpMbWx1YzNSaGJtTmxUMllvUkdsaGJHOW5LUzVwYzFKbGNYVnBjbVZrWEc0Z0lDQXFJQ0FnSUNCOUxGeHVJQ0FnS2lBZ0lDQWdjbVZ1WkdWeU9pQm1kVzVqZEdsdmJpZ3BJSHNnTGk0dUlIMWNiaUFnSUNvZ0lDQjlLVHRjYmlBZ0lDcGNiaUFnSUNvZ1FTQnRiM0psSUdadmNtMWhiQ0J6Y0dWamFXWnBZMkYwYVc5dUlHOW1JR2h2ZHlCMGFHVnpaU0J0WlhSb2IyUnpJR0Z5WlNCMWMyVmtPbHh1SUNBZ0tseHVJQ0FnS2lBZ0lIUjVjR1VnT2owZ1lYSnlZWGw4WW05dmJIeG1kVzVqZkc5aWFtVmpkSHh1ZFcxaVpYSjhjM1J5YVc1bmZHOXVaVTltS0ZzdUxpNWRLWHhwYm5OMFlXNWpaVTltS0M0dUxpbGNiaUFnSUNvZ0lDQmtaV05zSURvOUlGSmxZV04wVUhKdmNGUjVjR1Z6TG50MGVYQmxmU2d1YVhOU1pYRjFhWEpsWkNrL1hHNGdJQ0FxWEc0Z0lDQXFJRVZoWTJnZ1lXNWtJR1YyWlhKNUlHUmxZMnhoY21GMGFXOXVJSEJ5YjJSMVkyVnpJR0VnWm5WdVkzUnBiMjRnZDJsMGFDQjBhR1VnYzJGdFpTQnphV2R1WVhSMWNtVXVJRlJvYVhOY2JpQWdJQ29nWVd4c2IzZHpJSFJvWlNCamNtVmhkR2x2YmlCdlppQmpkWE4wYjIwZ2RtRnNhV1JoZEdsdmJpQm1kVzVqZEdsdmJuTXVJRVp2Y2lCbGVHRnRjR3hsT2x4dUlDQWdLbHh1SUNBZ0tpQWdkbUZ5SUUxNVRHbHVheUE5SUZKbFlXTjBMbU55WldGMFpVTnNZWE56S0h0Y2JpQWdJQ29nSUNBZ2NISnZjRlI1Y0dWek9pQjdYRzRnSUNBcUlDQWdJQ0FnTHk4Z1FXNGdiM0IwYVc5dVlXd2djM1J5YVc1bklHOXlJRlZTU1NCd2NtOXdJRzVoYldWa0lGd2lhSEpsWmx3aUxseHVJQ0FnS2lBZ0lDQWdJR2h5WldZNklHWjFibU4wYVc5dUtIQnliM0J6TENCd2NtOXdUbUZ0WlN3Z1kyOXRjRzl1Wlc1MFRtRnRaU2tnZTF4dUlDQWdLaUFnSUNBZ0lDQWdkbUZ5SUhCeWIzQldZV3gxWlNBOUlIQnliM0J6VzNCeWIzQk9ZVzFsWFR0Y2JpQWdJQ29nSUNBZ0lDQWdJR2xtSUNod2NtOXdWbUZzZFdVZ0lUMGdiblZzYkNBbUppQjBlWEJsYjJZZ2NISnZjRlpoYkhWbElDRTlQU0FuYzNSeWFXNW5KeUFtSmx4dUlDQWdLaUFnSUNBZ0lDQWdJQ0FnSUNFb2NISnZjRlpoYkhWbElHbHVjM1JoYm1ObGIyWWdWVkpKS1NrZ2UxeHVJQ0FnS2lBZ0lDQWdJQ0FnSUNCeVpYUjFjbTRnYm1WM0lFVnljbTl5S0Z4dUlDQWdLaUFnSUNBZ0lDQWdJQ0FnSUNkRmVIQmxZM1JsWkNCaElITjBjbWx1WnlCdmNpQmhiaUJWVWtrZ1ptOXlJQ2NnS3lCd2NtOXdUbUZ0WlNBcklDY2dhVzRnSnlBclhHNGdJQ0FxSUNBZ0lDQWdJQ0FnSUNBZ1kyOXRjRzl1Wlc1MFRtRnRaVnh1SUNBZ0tpQWdJQ0FnSUNBZ0lDQXBPMXh1SUNBZ0tpQWdJQ0FnSUNBZ2ZWeHVJQ0FnS2lBZ0lDQWdJSDFjYmlBZ0lDb2dJQ0FnZlN4Y2JpQWdJQ29nSUNBZ2NtVnVaR1Z5T2lCbWRXNWpkR2x2YmlncElIc3VMaTU5WEc0Z0lDQXFJQ0I5S1R0Y2JpQWdJQ3BjYmlBZ0lDb2dRR2x1ZEdWeWJtRnNYRzRnSUNBcUwxeHVYRzRnSUhaaGNpQkJUazlPV1UxUFZWTWdQU0FuUER4aGJtOXVlVzF2ZFhNK1BpYzdYRzVjYmlBZ0x5OGdTVzF3YjNKMFlXNTBJVnh1SUNBdkx5QkxaV1Z3SUhSb2FYTWdiR2x6ZENCcGJpQnplVzVqSUhkcGRHZ2djSEp2WkhWamRHbHZiaUIyWlhKemFXOXVJR2x1SUdBdUwyWmhZM1J2Y25sWGFYUm9WR2h5YjNkcGJtZFRhR2x0Y3k1cWMyQXVYRzRnSUhaaGNpQlNaV0ZqZEZCeWIzQlVlWEJsY3lBOUlIdGNiaUFnSUNCaGNuSmhlVG9nWTNKbFlYUmxVSEpwYldsMGFYWmxWSGx3WlVOb1pXTnJaWElvSjJGeWNtRjVKeWtzWEc0Z0lDQWdZbTl2YkRvZ1kzSmxZWFJsVUhKcGJXbDBhWFpsVkhsd1pVTm9aV05yWlhJb0oySnZiMnhsWVc0bktTeGNiaUFnSUNCbWRXNWpPaUJqY21WaGRHVlFjbWx0YVhScGRtVlVlWEJsUTJobFkydGxjaWduWm5WdVkzUnBiMjRuS1N4Y2JpQWdJQ0J1ZFcxaVpYSTZJR055WldGMFpWQnlhVzFwZEdsMlpWUjVjR1ZEYUdWamEyVnlLQ2R1ZFcxaVpYSW5LU3hjYmlBZ0lDQnZZbXBsWTNRNklHTnlaV0YwWlZCeWFXMXBkR2wyWlZSNWNHVkRhR1ZqYTJWeUtDZHZZbXBsWTNRbktTeGNiaUFnSUNCemRISnBibWM2SUdOeVpXRjBaVkJ5YVcxcGRHbDJaVlI1Y0dWRGFHVmphMlZ5S0NkemRISnBibWNuS1N4Y2JpQWdJQ0J6ZVcxaWIydzZJR055WldGMFpWQnlhVzFwZEdsMlpWUjVjR1ZEYUdWamEyVnlLQ2R6ZVcxaWIyd25LU3hjYmx4dUlDQWdJR0Z1ZVRvZ1kzSmxZWFJsUVc1NVZIbHdaVU5vWldOclpYSW9LU3hjYmlBZ0lDQmhjbkpoZVU5bU9pQmpjbVZoZEdWQmNuSmhlVTltVkhsd1pVTm9aV05yWlhJc1hHNGdJQ0FnWld4bGJXVnVkRG9nWTNKbFlYUmxSV3hsYldWdWRGUjVjR1ZEYUdWamEyVnlLQ2tzWEc0Z0lDQWdhVzV6ZEdGdVkyVlBaam9nWTNKbFlYUmxTVzV6ZEdGdVkyVlVlWEJsUTJobFkydGxjaXhjYmlBZ0lDQnViMlJsT2lCamNtVmhkR1ZPYjJSbFEyaGxZMnRsY2lncExGeHVJQ0FnSUc5aWFtVmpkRTltT2lCamNtVmhkR1ZQWW1wbFkzUlBabFI1Y0dWRGFHVmphMlZ5TEZ4dUlDQWdJRzl1WlU5bU9pQmpjbVZoZEdWRmJuVnRWSGx3WlVOb1pXTnJaWElzWEc0Z0lDQWdiMjVsVDJaVWVYQmxPaUJqY21WaGRHVlZibWx2YmxSNWNHVkRhR1ZqYTJWeUxGeHVJQ0FnSUhOb1lYQmxPaUJqY21WaGRHVlRhR0Z3WlZSNWNHVkRhR1ZqYTJWeVhHNGdJSDA3WEc1Y2JpQWdMeW9xWEc0Z0lDQXFJR2x1YkdsdVpXUWdUMkpxWldOMExtbHpJSEJ2YkhsbWFXeHNJSFJ2SUdGMmIybGtJSEpsY1hWcGNtbHVaeUJqYjI1emRXMWxjbk1nYzJocGNDQjBhR1ZwY2lCdmQyNWNiaUFnSUNvZ2FIUjBjSE02THk5a1pYWmxiRzl3WlhJdWJXOTZhV3hzWVM1dmNtY3ZaVzR0VlZNdlpHOWpjeTlYWldJdlNtRjJZVk5qY21sd2RDOVNaV1psY21WdVkyVXZSMnh2WW1Gc1gwOWlhbVZqZEhNdlQySnFaV04wTDJselhHNGdJQ0FxTDF4dUlDQXZLbVZ6YkdsdWRDMWthWE5oWW14bElHNXZMWE5sYkdZdFkyOXRjR0Z5WlNvdlhHNGdJR1oxYm1OMGFXOXVJR2x6S0hnc0lIa3BJSHRjYmlBZ0lDQXZMeUJUWVcxbFZtRnNkV1VnWVd4bmIzSnBkR2h0WEc0Z0lDQWdhV1lnS0hnZ1BUMDlJSGtwSUh0Y2JpQWdJQ0FnSUM4dklGTjBaWEJ6SURFdE5Td2dOeTB4TUZ4dUlDQWdJQ0FnTHk4Z1UzUmxjSE1nTmk1aUxUWXVaVG9nS3pBZ0lUMGdMVEJjYmlBZ0lDQWdJSEpsZEhWeWJpQjRJQ0U5UFNBd0lIeDhJREVnTHlCNElEMDlQU0F4SUM4Z2VUdGNiaUFnSUNCOUlHVnNjMlVnZTF4dUlDQWdJQ0FnTHk4Z1UzUmxjQ0EyTG1FNklFNWhUaUE5UFNCT1lVNWNiaUFnSUNBZ0lISmxkSFZ5YmlCNElDRTlQU0I0SUNZbUlIa2dJVDA5SUhrN1hHNGdJQ0FnZlZ4dUlDQjlYRzRnSUM4cVpYTnNhVzUwTFdWdVlXSnNaU0J1YnkxelpXeG1MV052YlhCaGNtVXFMMXh1WEc0Z0lDOHFLbHh1SUNBZ0tpQlhaU0IxYzJVZ1lXNGdSWEp5YjNJdGJHbHJaU0J2WW1wbFkzUWdabTl5SUdKaFkydDNZWEprSUdOdmJYQmhkR2xpYVd4cGRIa2dZWE1nY0dWdmNHeGxJRzFoZVNCallXeHNYRzRnSUNBcUlGQnliM0JVZVhCbGN5QmthWEpsWTNSc2VTQmhibVFnYVc1emNHVmpkQ0IwYUdWcGNpQnZkWFJ3ZFhRdUlFaHZkMlYyWlhJc0lIZGxJR1J2YmlkMElIVnpaU0J5WldGc1hHNGdJQ0FxSUVWeWNtOXljeUJoYm5sdGIzSmxMaUJYWlNCa2IyNG5kQ0JwYm5Od1pXTjBJSFJvWldseUlITjBZV05ySUdGdWVYZGhlU3dnWVc1a0lHTnlaV0YwYVc1bklIUm9aVzFjYmlBZ0lDb2dhWE1nY0hKdmFHbGlhWFJwZG1Wc2VTQmxlSEJsYm5OcGRtVWdhV1lnZEdobGVTQmhjbVVnWTNKbFlYUmxaQ0IwYjI4Z2IyWjBaVzRzSUhOMVkyZ2dZWE1nZDJoaGRGeHVJQ0FnS2lCb1lYQndaVzV6SUdsdUlHOXVaVTltVkhsd1pTZ3BJR1p2Y2lCaGJua2dkSGx3WlNCaVpXWnZjbVVnZEdobElHOXVaU0IwYUdGMElHMWhkR05vWldRdVhHNGdJQ0FxTDF4dUlDQm1kVzVqZEdsdmJpQlFjbTl3Vkhsd1pVVnljbTl5S0cxbGMzTmhaMlVwSUh0Y2JpQWdJQ0IwYUdsekxtMWxjM05oWjJVZ1BTQnRaWE56WVdkbE8xeHVJQ0FnSUhSb2FYTXVjM1JoWTJzZ1BTQW5KenRjYmlBZ2ZWeHVJQ0F2THlCTllXdGxJR0JwYm5OMFlXNWpaVzltSUVWeWNtOXlZQ0J6ZEdsc2JDQjNiM0pySUdadmNpQnlaWFIxY201bFpDQmxjbkp2Y25NdVhHNGdJRkJ5YjNCVWVYQmxSWEp5YjNJdWNISnZkRzkwZVhCbElEMGdSWEp5YjNJdWNISnZkRzkwZVhCbE8xeHVYRzRnSUdaMWJtTjBhVzl1SUdOeVpXRjBaVU5vWVdsdVlXSnNaVlI1Y0dWRGFHVmphMlZ5S0haaGJHbGtZWFJsS1NCN1hHNGdJQ0FnYVdZZ0tIQnliMk5sYzNNdVpXNTJMazVQUkVWZlJVNVdJQ0U5UFNBbmNISnZaSFZqZEdsdmJpY3BJSHRjYmlBZ0lDQWdJSFpoY2lCdFlXNTFZV3hRY205d1ZIbHdaVU5oYkd4RFlXTm9aU0E5SUh0OU8xeHVJQ0FnSUNBZ2RtRnlJRzFoYm5WaGJGQnliM0JVZVhCbFYyRnlibWx1WjBOdmRXNTBJRDBnTUR0Y2JpQWdJQ0I5WEc0Z0lDQWdablZ1WTNScGIyNGdZMmhsWTJ0VWVYQmxLR2x6VW1WeGRXbHlaV1FzSUhCeWIzQnpMQ0J3Y205d1RtRnRaU3dnWTI5dGNHOXVaVzUwVG1GdFpTd2diRzlqWVhScGIyNHNJSEJ5YjNCR2RXeHNUbUZ0WlN3Z2MyVmpjbVYwS1NCN1hHNGdJQ0FnSUNCamIyMXdiMjVsYm5ST1lXMWxJRDBnWTI5dGNHOXVaVzUwVG1GdFpTQjhmQ0JCVGs5T1dVMVBWVk03WEc0Z0lDQWdJQ0J3Y205d1JuVnNiRTVoYldVZ1BTQndjbTl3Um5Wc2JFNWhiV1VnZkh3Z2NISnZjRTVoYldVN1hHNWNiaUFnSUNBZ0lHbG1JQ2h6WldOeVpYUWdJVDA5SUZKbFlXTjBVSEp2Y0ZSNWNHVnpVMlZqY21WMEtTQjdYRzRnSUNBZ0lDQWdJR2xtSUNoMGFISnZkMDl1UkdseVpXTjBRV05qWlhOektTQjdYRzRnSUNBZ0lDQWdJQ0FnTHk4Z1RtVjNJR0psYUdGMmFXOXlJRzl1YkhrZ1ptOXlJSFZ6WlhKeklHOW1JR0J3Y205d0xYUjVjR1Z6WUNCd1lXTnJZV2RsWEc0Z0lDQWdJQ0FnSUNBZ2FXNTJZWEpwWVc1MEtGeHVJQ0FnSUNBZ0lDQWdJQ0FnWm1Gc2MyVXNYRzRnSUNBZ0lDQWdJQ0FnSUNBblEyRnNiR2x1WnlCUWNtOXdWSGx3WlhNZ2RtRnNhV1JoZEc5eWN5QmthWEpsWTNSc2VTQnBjeUJ1YjNRZ2MzVndjRzl5ZEdWa0lHSjVJSFJvWlNCZ2NISnZjQzEwZVhCbGMyQWdjR0ZqYTJGblpTNGdKeUFyWEc0Z0lDQWdJQ0FnSUNBZ0lDQW5WWE5sSUdCUWNtOXdWSGx3WlhNdVkyaGxZMnRRY205d1ZIbHdaWE1vS1dBZ2RHOGdZMkZzYkNCMGFHVnRMaUFuSUN0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ2RTWldGa0lHMXZjbVVnWVhRZ2FIUjBjRG92TDJaaUxtMWxMM1Z6WlMxamFHVmpheTF3Y205d0xYUjVjR1Z6SjF4dUlDQWdJQ0FnSUNBZ0lDazdYRzRnSUNBZ0lDQWdJSDBnWld4elpTQnBaaUFvY0hKdlkyVnpjeTVsYm5ZdVRrOUVSVjlGVGxZZ0lUMDlJQ2R3Y205a2RXTjBhVzl1SnlBbUppQjBlWEJsYjJZZ1kyOXVjMjlzWlNBaFBUMGdKM1Z1WkdWbWFXNWxaQ2NwSUh0Y2JpQWdJQ0FnSUNBZ0lDQXZMeUJQYkdRZ1ltVm9ZWFpwYjNJZ1ptOXlJSEJsYjNCc1pTQjFjMmx1WnlCU1pXRmpkQzVRY205d1ZIbHdaWE5jYmlBZ0lDQWdJQ0FnSUNCMllYSWdZMkZqYUdWTFpYa2dQU0JqYjIxd2IyNWxiblJPWVcxbElDc2dKem9uSUNzZ2NISnZjRTVoYldVN1hHNGdJQ0FnSUNBZ0lDQWdhV1lnS0Z4dUlDQWdJQ0FnSUNBZ0lDQWdJVzFoYm5WaGJGQnliM0JVZVhCbFEyRnNiRU5oWTJobFcyTmhZMmhsUzJWNVhTQW1KbHh1SUNBZ0lDQWdJQ0FnSUNBZ0x5OGdRWFp2YVdRZ2MzQmhiVzFwYm1jZ2RHaGxJR052Ym5OdmJHVWdZbVZqWVhWelpTQjBhR1Y1SUdGeVpTQnZablJsYmlCdWIzUWdZV04wYVc5dVlXSnNaU0JsZUdObGNIUWdabTl5SUd4cFlpQmhkWFJvYjNKelhHNGdJQ0FnSUNBZ0lDQWdJQ0J0WVc1MVlXeFFjbTl3Vkhsd1pWZGhjbTVwYm1kRGIzVnVkQ0E4SUROY2JpQWdJQ0FnSUNBZ0lDQXBJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lIZGhjbTVwYm1jb1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUdaaGJITmxMRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQW5XVzkxSUdGeVpTQnRZVzUxWVd4c2VTQmpZV3hzYVc1bklHRWdVbVZoWTNRdVVISnZjRlI1Y0dWeklIWmhiR2xrWVhScGIyNGdKeUFyWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ2RtZFc1amRHbHZiaUJtYjNJZ2RHaGxJR0FsYzJBZ2NISnZjQ0J2YmlCZ0pYTmdMaUJVYUdseklHbHpJR1JsY0hKbFkyRjBaV1FnSnlBclhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNkaGJtUWdkMmxzYkNCMGFISnZkeUJwYmlCMGFHVWdjM1JoYm1SaGJHOXVaU0JnY0hKdmNDMTBlWEJsYzJBZ2NHRmphMkZuWlM0Z0p5QXJYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDZFpiM1VnYldGNUlHSmxJSE5sWldsdVp5QjBhR2x6SUhkaGNtNXBibWNnWkhWbElIUnZJR0VnZEdocGNtUXRjR0Z5ZEhrZ1VISnZjRlI1Y0dWeklDY2dLMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQW5iR2xpY21GeWVTNGdVMlZsSUdoMGRIQnpPaTh2Wm1JdWJXVXZjbVZoWTNRdGQyRnlibWx1Wnkxa2IyNTBMV05oYkd3dGNISnZjSFI1Y0dWeklDY2dLeUFuWm05eUlHUmxkR0ZwYkhNdUp5eGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ2NISnZjRVoxYkd4T1lXMWxMRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQmpiMjF3YjI1bGJuUk9ZVzFsWEc0Z0lDQWdJQ0FnSUNBZ0lDQXBPMXh1SUNBZ0lDQWdJQ0FnSUNBZ2JXRnVkV0ZzVUhKdmNGUjVjR1ZEWVd4c1EyRmphR1ZiWTJGamFHVkxaWGxkSUQwZ2RISjFaVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lHMWhiblZoYkZCeWIzQlVlWEJsVjJGeWJtbHVaME52ZFc1MEt5czdYRzRnSUNBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNCOVhHNGdJQ0FnSUNCcFppQW9jSEp2Y0hOYmNISnZjRTVoYldWZElEMDlJRzUxYkd3cElIdGNiaUFnSUNBZ0lDQWdhV1lnS0dselVtVnhkV2x5WldRcElIdGNiaUFnSUNBZ0lDQWdJQ0JwWmlBb2NISnZjSE5iY0hKdmNFNWhiV1ZkSUQwOVBTQnVkV3hzS1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdibVYzSUZCeWIzQlVlWEJsUlhKeWIzSW9KMVJvWlNBbklDc2diRzlqWVhScGIyNGdLeUFuSUdBbklDc2djSEp2Y0VaMWJHeE9ZVzFsSUNzZ0oyQWdhWE1nYldGeWEyVmtJR0Z6SUhKbGNYVnBjbVZrSUNjZ0t5QW9KMmx1SUdBbklDc2dZMjl0Y0c5dVpXNTBUbUZ0WlNBcklDZGdMQ0JpZFhRZ2FYUnpJSFpoYkhWbElHbHpJR0J1ZFd4c1lDNG5LU2s3WEc0Z0lDQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQnVaWGNnVUhKdmNGUjVjR1ZGY25KdmNpZ25WR2hsSUNjZ0t5QnNiMk5oZEdsdmJpQXJJQ2NnWUNjZ0t5QndjbTl3Um5Wc2JFNWhiV1VnS3lBbllDQnBjeUJ0WVhKclpXUWdZWE1nY21WeGRXbHlaV1FnYVc0Z0p5QXJJQ2duWUNjZ0t5QmpiMjF3YjI1bGJuUk9ZVzFsSUNzZ0oyQXNJR0oxZENCcGRITWdkbUZzZFdVZ2FYTWdZSFZ1WkdWbWFXNWxaR0F1SnlrcE8xeHVJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJSEpsZEhWeWJpQnVkV3hzTzF4dUlDQWdJQ0FnZlNCbGJITmxJSHRjYmlBZ0lDQWdJQ0FnY21WMGRYSnVJSFpoYkdsa1lYUmxLSEJ5YjNCekxDQndjbTl3VG1GdFpTd2dZMjl0Y0c5dVpXNTBUbUZ0WlN3Z2JHOWpZWFJwYjI0c0lIQnliM0JHZFd4c1RtRnRaU2s3WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdmVnh1WEc0Z0lDQWdkbUZ5SUdOb1lXbHVaV1JEYUdWamExUjVjR1VnUFNCamFHVmphMVI1Y0dVdVltbHVaQ2h1ZFd4c0xDQm1ZV3h6WlNrN1hHNGdJQ0FnWTJoaGFXNWxaRU5vWldOclZIbHdaUzVwYzFKbGNYVnBjbVZrSUQwZ1kyaGxZMnRVZVhCbExtSnBibVFvYm5Wc2JDd2dkSEoxWlNrN1hHNWNiaUFnSUNCeVpYUjFjbTRnWTJoaGFXNWxaRU5vWldOclZIbHdaVHRjYmlBZ2ZWeHVYRzRnSUdaMWJtTjBhVzl1SUdOeVpXRjBaVkJ5YVcxcGRHbDJaVlI1Y0dWRGFHVmphMlZ5S0dWNGNHVmpkR1ZrVkhsd1pTa2dlMXh1SUNBZ0lHWjFibU4wYVc5dUlIWmhiR2xrWVhSbEtIQnliM0J6TENCd2NtOXdUbUZ0WlN3Z1kyOXRjRzl1Wlc1MFRtRnRaU3dnYkc5allYUnBiMjRzSUhCeWIzQkdkV3hzVG1GdFpTd2djMlZqY21WMEtTQjdYRzRnSUNBZ0lDQjJZWElnY0hKdmNGWmhiSFZsSUQwZ2NISnZjSE5iY0hKdmNFNWhiV1ZkTzF4dUlDQWdJQ0FnZG1GeUlIQnliM0JVZVhCbElEMGdaMlYwVUhKdmNGUjVjR1VvY0hKdmNGWmhiSFZsS1R0Y2JpQWdJQ0FnSUdsbUlDaHdjbTl3Vkhsd1pTQWhQVDBnWlhod1pXTjBaV1JVZVhCbEtTQjdYRzRnSUNBZ0lDQWdJQzh2SUdCd2NtOXdWbUZzZFdWZ0lHSmxhVzVuSUdsdWMzUmhibU5sSUc5bUxDQnpZWGtzSUdSaGRHVXZjbVZuWlhod0xDQndZWE56SUhSb1pTQW5iMkpxWldOMEoxeHVJQ0FnSUNBZ0lDQXZMeUJqYUdWamF5d2dZblYwSUhkbElHTmhiaUJ2Wm1abGNpQmhJRzF2Y21VZ2NISmxZMmx6WlNCbGNuSnZjaUJ0WlhOellXZGxJR2hsY21VZ2NtRjBhR1Z5SUhSb1lXNWNiaUFnSUNBZ0lDQWdMeThnSjI5bUlIUjVjR1VnWUc5aWFtVmpkR0FuTGx4dUlDQWdJQ0FnSUNCMllYSWdjSEpsWTJselpWUjVjR1VnUFNCblpYUlFjbVZqYVhObFZIbHdaU2h3Y205d1ZtRnNkV1VwTzF4dVhHNGdJQ0FnSUNBZ0lISmxkSFZ5YmlCdVpYY2dVSEp2Y0ZSNWNHVkZjbkp2Y2lnblNXNTJZV3hwWkNBbklDc2diRzlqWVhScGIyNGdLeUFuSUdBbklDc2djSEp2Y0VaMWJHeE9ZVzFsSUNzZ0oyQWdiMllnZEhsd1pTQW5JQ3NnS0NkZ0p5QXJJSEJ5WldOcGMyVlVlWEJsSUNzZ0oyQWdjM1Z3Y0d4cFpXUWdkRzhnWUNjZ0t5QmpiMjF3YjI1bGJuUk9ZVzFsSUNzZ0oyQXNJR1Y0Y0dWamRHVmtJQ2NwSUNzZ0tDZGdKeUFySUdWNGNHVmpkR1ZrVkhsd1pTQXJJQ2RnTGljcEtUdGNiaUFnSUNBZ0lIMWNiaUFnSUNBZ0lISmxkSFZ5YmlCdWRXeHNPMXh1SUNBZ0lIMWNiaUFnSUNCeVpYUjFjbTRnWTNKbFlYUmxRMmhoYVc1aFlteGxWSGx3WlVOb1pXTnJaWElvZG1Gc2FXUmhkR1VwTzF4dUlDQjlYRzVjYmlBZ1puVnVZM1JwYjI0Z1kzSmxZWFJsUVc1NVZIbHdaVU5vWldOclpYSW9LU0I3WEc0Z0lDQWdjbVYwZFhKdUlHTnlaV0YwWlVOb1lXbHVZV0pzWlZSNWNHVkRhR1ZqYTJWeUtHVnRjSFI1Um5WdVkzUnBiMjR1ZEdoaGRGSmxkSFZ5Ym5OT2RXeHNLVHRjYmlBZ2ZWeHVYRzRnSUdaMWJtTjBhVzl1SUdOeVpXRjBaVUZ5Y21GNVQyWlVlWEJsUTJobFkydGxjaWgwZVhCbFEyaGxZMnRsY2lrZ2UxeHVJQ0FnSUdaMWJtTjBhVzl1SUhaaGJHbGtZWFJsS0hCeWIzQnpMQ0J3Y205d1RtRnRaU3dnWTI5dGNHOXVaVzUwVG1GdFpTd2diRzlqWVhScGIyNHNJSEJ5YjNCR2RXeHNUbUZ0WlNrZ2UxeHVJQ0FnSUNBZ2FXWWdLSFI1Y0dWdlppQjBlWEJsUTJobFkydGxjaUFoUFQwZ0oyWjFibU4wYVc5dUp5a2dlMXh1SUNBZ0lDQWdJQ0J5WlhSMWNtNGdibVYzSUZCeWIzQlVlWEJsUlhKeWIzSW9KMUJ5YjNCbGNuUjVJR0FuSUNzZ2NISnZjRVoxYkd4T1lXMWxJQ3NnSjJBZ2IyWWdZMjl0Y0c5dVpXNTBJR0FuSUNzZ1kyOXRjRzl1Wlc1MFRtRnRaU0FySUNkZ0lHaGhjeUJwYm5aaGJHbGtJRkJ5YjNCVWVYQmxJRzV2ZEdGMGFXOXVJR2x1YzJsa1pTQmhjbkpoZVU5bUxpY3BPMXh1SUNBZ0lDQWdmVnh1SUNBZ0lDQWdkbUZ5SUhCeWIzQldZV3gxWlNBOUlIQnliM0J6VzNCeWIzQk9ZVzFsWFR0Y2JpQWdJQ0FnSUdsbUlDZ2hRWEp5WVhrdWFYTkJjbkpoZVNod2NtOXdWbUZzZFdVcEtTQjdYRzRnSUNBZ0lDQWdJSFpoY2lCd2NtOXdWSGx3WlNBOUlHZGxkRkJ5YjNCVWVYQmxLSEJ5YjNCV1lXeDFaU2s3WEc0Z0lDQWdJQ0FnSUhKbGRIVnliaUJ1WlhjZ1VISnZjRlI1Y0dWRmNuSnZjaWduU1c1MllXeHBaQ0FuSUNzZ2JHOWpZWFJwYjI0Z0t5QW5JR0FuSUNzZ2NISnZjRVoxYkd4T1lXMWxJQ3NnSjJBZ2IyWWdkSGx3WlNBbklDc2dLQ2RnSnlBcklIQnliM0JVZVhCbElDc2dKMkFnYzNWd2NHeHBaV1FnZEc4Z1lDY2dLeUJqYjIxd2IyNWxiblJPWVcxbElDc2dKMkFzSUdWNGNHVmpkR1ZrSUdGdUlHRnljbUY1TGljcEtUdGNiaUFnSUNBZ0lIMWNiaUFnSUNBZ0lHWnZjaUFvZG1GeUlHa2dQU0F3T3lCcElEd2djSEp2Y0ZaaGJIVmxMbXhsYm1kMGFEc2dhU3NyS1NCN1hHNGdJQ0FnSUNBZ0lIWmhjaUJsY25KdmNpQTlJSFI1Y0dWRGFHVmphMlZ5S0hCeWIzQldZV3gxWlN3Z2FTd2dZMjl0Y0c5dVpXNTBUbUZ0WlN3Z2JHOWpZWFJwYjI0c0lIQnliM0JHZFd4c1RtRnRaU0FySUNkYkp5QXJJR2tnS3lBblhTY3NJRkpsWVdOMFVISnZjRlI1Y0dWelUyVmpjbVYwS1R0Y2JpQWdJQ0FnSUNBZ2FXWWdLR1Z5Y205eUlHbHVjM1JoYm1ObGIyWWdSWEp5YjNJcElIdGNiaUFnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdaWEp5YjNJN1hHNGdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lIMWNiaUFnSUNBZ0lISmxkSFZ5YmlCdWRXeHNPMXh1SUNBZ0lIMWNiaUFnSUNCeVpYUjFjbTRnWTNKbFlYUmxRMmhoYVc1aFlteGxWSGx3WlVOb1pXTnJaWElvZG1Gc2FXUmhkR1VwTzF4dUlDQjlYRzVjYmlBZ1puVnVZM1JwYjI0Z1kzSmxZWFJsUld4bGJXVnVkRlI1Y0dWRGFHVmphMlZ5S0NrZ2UxeHVJQ0FnSUdaMWJtTjBhVzl1SUhaaGJHbGtZWFJsS0hCeWIzQnpMQ0J3Y205d1RtRnRaU3dnWTI5dGNHOXVaVzUwVG1GdFpTd2diRzlqWVhScGIyNHNJSEJ5YjNCR2RXeHNUbUZ0WlNrZ2UxeHVJQ0FnSUNBZ2RtRnlJSEJ5YjNCV1lXeDFaU0E5SUhCeWIzQnpXM0J5YjNCT1lXMWxYVHRjYmlBZ0lDQWdJR2xtSUNnaGFYTldZV3hwWkVWc1pXMWxiblFvY0hKdmNGWmhiSFZsS1NrZ2UxeHVJQ0FnSUNBZ0lDQjJZWElnY0hKdmNGUjVjR1VnUFNCblpYUlFjbTl3Vkhsd1pTaHdjbTl3Vm1Gc2RXVXBPMXh1SUNBZ0lDQWdJQ0J5WlhSMWNtNGdibVYzSUZCeWIzQlVlWEJsUlhKeWIzSW9KMGx1ZG1Gc2FXUWdKeUFySUd4dlkyRjBhVzl1SUNzZ0p5QmdKeUFySUhCeWIzQkdkV3hzVG1GdFpTQXJJQ2RnSUc5bUlIUjVjR1VnSnlBcklDZ25ZQ2NnS3lCd2NtOXdWSGx3WlNBcklDZGdJSE4xY0hCc2FXVmtJSFJ2SUdBbklDc2dZMjl0Y0c5dVpXNTBUbUZ0WlNBcklDZGdMQ0JsZUhCbFkzUmxaQ0JoSUhOcGJtZHNaU0JTWldGamRFVnNaVzFsYm5RdUp5a3BPMXh1SUNBZ0lDQWdmVnh1SUNBZ0lDQWdjbVYwZFhKdUlHNTFiR3c3WEc0Z0lDQWdmVnh1SUNBZ0lISmxkSFZ5YmlCamNtVmhkR1ZEYUdGcGJtRmliR1ZVZVhCbFEyaGxZMnRsY2loMllXeHBaR0YwWlNrN1hHNGdJSDFjYmx4dUlDQm1kVzVqZEdsdmJpQmpjbVZoZEdWSmJuTjBZVzVqWlZSNWNHVkRhR1ZqYTJWeUtHVjRjR1ZqZEdWa1EyeGhjM01wSUh0Y2JpQWdJQ0JtZFc1amRHbHZiaUIyWVd4cFpHRjBaU2h3Y205d2N5d2djSEp2Y0U1aGJXVXNJR052YlhCdmJtVnVkRTVoYldVc0lHeHZZMkYwYVc5dUxDQndjbTl3Um5Wc2JFNWhiV1VwSUh0Y2JpQWdJQ0FnSUdsbUlDZ2hLSEJ5YjNCelczQnliM0JPWVcxbFhTQnBibk4wWVc1alpXOW1JR1Y0Y0dWamRHVmtRMnhoYzNNcEtTQjdYRzRnSUNBZ0lDQWdJSFpoY2lCbGVIQmxZM1JsWkVOc1lYTnpUbUZ0WlNBOUlHVjRjR1ZqZEdWa1EyeGhjM011Ym1GdFpTQjhmQ0JCVGs5T1dVMVBWVk03WEc0Z0lDQWdJQ0FnSUhaaGNpQmhZM1IxWVd4RGJHRnpjMDVoYldVZ1BTQm5aWFJEYkdGemMwNWhiV1VvY0hKdmNITmJjSEp2Y0U1aGJXVmRLVHRjYmlBZ0lDQWdJQ0FnY21WMGRYSnVJRzVsZHlCUWNtOXdWSGx3WlVWeWNtOXlLQ2RKYm5aaGJHbGtJQ2NnS3lCc2IyTmhkR2x2YmlBcklDY2dZQ2NnS3lCd2NtOXdSblZzYkU1aGJXVWdLeUFuWUNCdlppQjBlWEJsSUNjZ0t5QW9KMkFuSUNzZ1lXTjBkV0ZzUTJ4aGMzTk9ZVzFsSUNzZ0oyQWdjM1Z3Y0d4cFpXUWdkRzhnWUNjZ0t5QmpiMjF3YjI1bGJuUk9ZVzFsSUNzZ0oyQXNJR1Y0Y0dWamRHVmtJQ2NwSUNzZ0tDZHBibk4wWVc1alpTQnZaaUJnSnlBcklHVjRjR1ZqZEdWa1EyeGhjM05PWVcxbElDc2dKMkF1SnlrcE8xeHVJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ2NtVjBkWEp1SUc1MWJHdzdYRzRnSUNBZ2ZWeHVJQ0FnSUhKbGRIVnliaUJqY21WaGRHVkRhR0ZwYm1GaWJHVlVlWEJsUTJobFkydGxjaWgyWVd4cFpHRjBaU2s3WEc0Z0lIMWNibHh1SUNCbWRXNWpkR2x2YmlCamNtVmhkR1ZGYm5WdFZIbHdaVU5vWldOclpYSW9aWGh3WldOMFpXUldZV3gxWlhNcElIdGNiaUFnSUNCcFppQW9JVUZ5Y21GNUxtbHpRWEp5WVhrb1pYaHdaV04wWldSV1lXeDFaWE1wS1NCN1hHNGdJQ0FnSUNCd2NtOWpaWE56TG1WdWRpNU9UMFJGWDBWT1ZpQWhQVDBnSjNCeWIyUjFZM1JwYjI0bklEOGdkMkZ5Ym1sdVp5aG1ZV3h6WlN3Z0owbHVkbUZzYVdRZ1lYSm5kVzFsYm5RZ2MzVndjR3hwWldRZ2RHOGdiMjVsVDJZc0lHVjRjR1ZqZEdWa0lHRnVJR2x1YzNSaGJtTmxJRzltSUdGeWNtRjVMaWNwSURvZ2RtOXBaQ0F3TzF4dUlDQWdJQ0FnY21WMGRYSnVJR1Z0Y0hSNVJuVnVZM1JwYjI0dWRHaGhkRkpsZEhWeWJuTk9kV3hzTzF4dUlDQWdJSDFjYmx4dUlDQWdJR1oxYm1OMGFXOXVJSFpoYkdsa1lYUmxLSEJ5YjNCekxDQndjbTl3VG1GdFpTd2dZMjl0Y0c5dVpXNTBUbUZ0WlN3Z2JHOWpZWFJwYjI0c0lIQnliM0JHZFd4c1RtRnRaU2tnZTF4dUlDQWdJQ0FnZG1GeUlIQnliM0JXWVd4MVpTQTlJSEJ5YjNCelczQnliM0JPWVcxbFhUdGNiaUFnSUNBZ0lHWnZjaUFvZG1GeUlHa2dQU0F3T3lCcElEd2daWGh3WldOMFpXUldZV3gxWlhNdWJHVnVaM1JvT3lCcEt5c3BJSHRjYmlBZ0lDQWdJQ0FnYVdZZ0tHbHpLSEJ5YjNCV1lXeDFaU3dnWlhod1pXTjBaV1JXWVd4MVpYTmJhVjBwS1NCN1hHNGdJQ0FnSUNBZ0lDQWdjbVYwZFhKdUlHNTFiR3c3WEc0Z0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUgxY2JseHVJQ0FnSUNBZ2RtRnlJSFpoYkhWbGMxTjBjbWx1WnlBOUlFcFRUMDR1YzNSeWFXNW5hV1o1S0dWNGNHVmpkR1ZrVm1Gc2RXVnpLVHRjYmlBZ0lDQWdJSEpsZEhWeWJpQnVaWGNnVUhKdmNGUjVjR1ZGY25KdmNpZ25TVzUyWVd4cFpDQW5JQ3NnYkc5allYUnBiMjRnS3lBbklHQW5JQ3NnY0hKdmNFWjFiR3hPWVcxbElDc2dKMkFnYjJZZ2RtRnNkV1VnWUNjZ0t5QndjbTl3Vm1Gc2RXVWdLeUFuWUNBbklDc2dLQ2R6ZFhCd2JHbGxaQ0IwYnlCZ0p5QXJJR052YlhCdmJtVnVkRTVoYldVZ0t5QW5ZQ3dnWlhod1pXTjBaV1FnYjI1bElHOW1JQ2NnS3lCMllXeDFaWE5UZEhKcGJtY2dLeUFuTGljcEtUdGNiaUFnSUNCOVhHNGdJQ0FnY21WMGRYSnVJR055WldGMFpVTm9ZV2x1WVdKc1pWUjVjR1ZEYUdWamEyVnlLSFpoYkdsa1lYUmxLVHRjYmlBZ2ZWeHVYRzRnSUdaMWJtTjBhVzl1SUdOeVpXRjBaVTlpYW1WamRFOW1WSGx3WlVOb1pXTnJaWElvZEhsd1pVTm9aV05yWlhJcElIdGNiaUFnSUNCbWRXNWpkR2x2YmlCMllXeHBaR0YwWlNod2NtOXdjeXdnY0hKdmNFNWhiV1VzSUdOdmJYQnZibVZ1ZEU1aGJXVXNJR3h2WTJGMGFXOXVMQ0J3Y205d1JuVnNiRTVoYldVcElIdGNiaUFnSUNBZ0lHbG1JQ2gwZVhCbGIyWWdkSGx3WlVOb1pXTnJaWElnSVQwOUlDZG1kVzVqZEdsdmJpY3BJSHRjYmlBZ0lDQWdJQ0FnY21WMGRYSnVJRzVsZHlCUWNtOXdWSGx3WlVWeWNtOXlLQ2RRY205d1pYSjBlU0JnSnlBcklIQnliM0JHZFd4c1RtRnRaU0FySUNkZ0lHOW1JR052YlhCdmJtVnVkQ0JnSnlBcklHTnZiWEJ2Ym1WdWRFNWhiV1VnS3lBbllDQm9ZWE1nYVc1MllXeHBaQ0JRY205d1ZIbHdaU0J1YjNSaGRHbHZiaUJwYm5OcFpHVWdiMkpxWldOMFQyWXVKeWs3WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdJQ0IyWVhJZ2NISnZjRlpoYkhWbElEMGdjSEp2Y0hOYmNISnZjRTVoYldWZE8xeHVJQ0FnSUNBZ2RtRnlJSEJ5YjNCVWVYQmxJRDBnWjJWMFVISnZjRlI1Y0dVb2NISnZjRlpoYkhWbEtUdGNiaUFnSUNBZ0lHbG1JQ2h3Y205d1ZIbHdaU0FoUFQwZ0oyOWlhbVZqZENjcElIdGNiaUFnSUNBZ0lDQWdjbVYwZFhKdUlHNWxkeUJRY205d1ZIbHdaVVZ5Y205eUtDZEpiblpoYkdsa0lDY2dLeUJzYjJOaGRHbHZiaUFySUNjZ1lDY2dLeUJ3Y205d1JuVnNiRTVoYldVZ0t5QW5ZQ0J2WmlCMGVYQmxJQ2NnS3lBb0oyQW5JQ3NnY0hKdmNGUjVjR1VnS3lBbllDQnpkWEJ3YkdsbFpDQjBieUJnSnlBcklHTnZiWEJ2Ym1WdWRFNWhiV1VnS3lBbllDd2daWGh3WldOMFpXUWdZVzRnYjJKcVpXTjBMaWNwS1R0Y2JpQWdJQ0FnSUgxY2JpQWdJQ0FnSUdadmNpQW9kbUZ5SUd0bGVTQnBiaUJ3Y205d1ZtRnNkV1VwSUh0Y2JpQWdJQ0FnSUNBZ2FXWWdLSEJ5YjNCV1lXeDFaUzVvWVhOUGQyNVFjbTl3WlhKMGVTaHJaWGtwS1NCN1hHNGdJQ0FnSUNBZ0lDQWdkbUZ5SUdWeWNtOXlJRDBnZEhsd1pVTm9aV05yWlhJb2NISnZjRlpoYkhWbExDQnJaWGtzSUdOdmJYQnZibVZ1ZEU1aGJXVXNJR3h2WTJGMGFXOXVMQ0J3Y205d1JuVnNiRTVoYldVZ0t5QW5MaWNnS3lCclpYa3NJRkpsWVdOMFVISnZjRlI1Y0dWelUyVmpjbVYwS1R0Y2JpQWdJQ0FnSUNBZ0lDQnBaaUFvWlhKeWIzSWdhVzV6ZEdGdVkyVnZaaUJGY25KdmNpa2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ2NtVjBkWEp1SUdWeWNtOXlPMXh1SUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ2NtVjBkWEp1SUc1MWJHdzdYRzRnSUNBZ2ZWeHVJQ0FnSUhKbGRIVnliaUJqY21WaGRHVkRhR0ZwYm1GaWJHVlVlWEJsUTJobFkydGxjaWgyWVd4cFpHRjBaU2s3WEc0Z0lIMWNibHh1SUNCbWRXNWpkR2x2YmlCamNtVmhkR1ZWYm1sdmJsUjVjR1ZEYUdWamEyVnlLR0Z5Y21GNVQyWlVlWEJsUTJobFkydGxjbk1wSUh0Y2JpQWdJQ0JwWmlBb0lVRnljbUY1TG1selFYSnlZWGtvWVhKeVlYbFBabFI1Y0dWRGFHVmphMlZ5Y3lrcElIdGNiaUFnSUNBZ0lIQnliMk5sYzNNdVpXNTJMazVQUkVWZlJVNVdJQ0U5UFNBbmNISnZaSFZqZEdsdmJpY2dQeUIzWVhKdWFXNW5LR1poYkhObExDQW5TVzUyWVd4cFpDQmhjbWQxYldWdWRDQnpkWEJ3YkdsbFpDQjBieUJ2Ym1WUFpsUjVjR1VzSUdWNGNHVmpkR1ZrSUdGdUlHbHVjM1JoYm1ObElHOW1JR0Z5Y21GNUxpY3BJRG9nZG05cFpDQXdPMXh1SUNBZ0lDQWdjbVYwZFhKdUlHVnRjSFI1Um5WdVkzUnBiMjR1ZEdoaGRGSmxkSFZ5Ym5OT2RXeHNPMXh1SUNBZ0lIMWNibHh1SUNBZ0lHWnZjaUFvZG1GeUlHa2dQU0F3T3lCcElEd2dZWEp5WVhsUFpsUjVjR1ZEYUdWamEyVnljeTVzWlc1bmRHZzdJR2tyS3lrZ2UxeHVJQ0FnSUNBZ2RtRnlJR05vWldOclpYSWdQU0JoY25KaGVVOW1WSGx3WlVOb1pXTnJaWEp6VzJsZE8xeHVJQ0FnSUNBZ2FXWWdLSFI1Y0dWdlppQmphR1ZqYTJWeUlDRTlQU0FuWm5WdVkzUnBiMjRuS1NCN1hHNGdJQ0FnSUNBZ0lIZGhjbTVwYm1jb1hHNGdJQ0FnSUNBZ0lDQWdabUZzYzJVc1hHNGdJQ0FnSUNBZ0lDQWdKMGx1ZG1Gc2FXUWdZWEpuZFcxbGJuUWdjM1Z3Y0d4cFpDQjBieUJ2Ym1WUFpsUjVjR1V1SUVWNGNHVmpkR1ZrSUdGdUlHRnljbUY1SUc5bUlHTm9aV05ySUdaMWJtTjBhVzl1Y3l3Z1luVjBJQ2NnSzF4dUlDQWdJQ0FnSUNBZ0lDZHlaV05sYVhabFpDQWxjeUJoZENCcGJtUmxlQ0FsY3k0bkxGeHVJQ0FnSUNBZ0lDQWdJR2RsZEZCdmMzUm1hWGhHYjNKVWVYQmxWMkZ5Ym1sdVp5aGphR1ZqYTJWeUtTeGNiaUFnSUNBZ0lDQWdJQ0JwWEc0Z0lDQWdJQ0FnSUNrN1hHNGdJQ0FnSUNBZ0lISmxkSFZ5YmlCbGJYQjBlVVoxYm1OMGFXOXVMblJvWVhSU1pYUjFjbTV6VG5Wc2JEdGNiaUFnSUNBZ0lIMWNiaUFnSUNCOVhHNWNiaUFnSUNCbWRXNWpkR2x2YmlCMllXeHBaR0YwWlNod2NtOXdjeXdnY0hKdmNFNWhiV1VzSUdOdmJYQnZibVZ1ZEU1aGJXVXNJR3h2WTJGMGFXOXVMQ0J3Y205d1JuVnNiRTVoYldVcElIdGNiaUFnSUNBZ0lHWnZjaUFvZG1GeUlHa2dQU0F3T3lCcElEd2dZWEp5WVhsUFpsUjVjR1ZEYUdWamEyVnljeTVzWlc1bmRHZzdJR2tyS3lrZ2UxeHVJQ0FnSUNBZ0lDQjJZWElnWTJobFkydGxjaUE5SUdGeWNtRjVUMlpVZVhCbFEyaGxZMnRsY25OYmFWMDdYRzRnSUNBZ0lDQWdJR2xtSUNoamFHVmphMlZ5S0hCeWIzQnpMQ0J3Y205d1RtRnRaU3dnWTI5dGNHOXVaVzUwVG1GdFpTd2diRzlqWVhScGIyNHNJSEJ5YjNCR2RXeHNUbUZ0WlN3Z1VtVmhZM1JRY205d1ZIbHdaWE5UWldOeVpYUXBJRDA5SUc1MWJHd3BJSHRjYmlBZ0lDQWdJQ0FnSUNCeVpYUjFjbTRnYm5Wc2JEdGNiaUFnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdmVnh1WEc0Z0lDQWdJQ0J5WlhSMWNtNGdibVYzSUZCeWIzQlVlWEJsUlhKeWIzSW9KMGx1ZG1Gc2FXUWdKeUFySUd4dlkyRjBhVzl1SUNzZ0p5QmdKeUFySUhCeWIzQkdkV3hzVG1GdFpTQXJJQ2RnSUhOMWNIQnNhV1ZrSUhSdklDY2dLeUFvSjJBbklDc2dZMjl0Y0c5dVpXNTBUbUZ0WlNBcklDZGdMaWNwS1R0Y2JpQWdJQ0I5WEc0Z0lDQWdjbVYwZFhKdUlHTnlaV0YwWlVOb1lXbHVZV0pzWlZSNWNHVkRhR1ZqYTJWeUtIWmhiR2xrWVhSbEtUdGNiaUFnZlZ4dVhHNGdJR1oxYm1OMGFXOXVJR055WldGMFpVNXZaR1ZEYUdWamEyVnlLQ2tnZTF4dUlDQWdJR1oxYm1OMGFXOXVJSFpoYkdsa1lYUmxLSEJ5YjNCekxDQndjbTl3VG1GdFpTd2dZMjl0Y0c5dVpXNTBUbUZ0WlN3Z2JHOWpZWFJwYjI0c0lIQnliM0JHZFd4c1RtRnRaU2tnZTF4dUlDQWdJQ0FnYVdZZ0tDRnBjMDV2WkdVb2NISnZjSE5iY0hKdmNFNWhiV1ZkS1NrZ2UxeHVJQ0FnSUNBZ0lDQnlaWFIxY200Z2JtVjNJRkJ5YjNCVWVYQmxSWEp5YjNJb0owbHVkbUZzYVdRZ0p5QXJJR3h2WTJGMGFXOXVJQ3NnSnlCZ0p5QXJJSEJ5YjNCR2RXeHNUbUZ0WlNBcklDZGdJSE4xY0hCc2FXVmtJSFJ2SUNjZ0t5QW9KMkFuSUNzZ1kyOXRjRzl1Wlc1MFRtRnRaU0FySUNkZ0xDQmxlSEJsWTNSbFpDQmhJRkpsWVdOMFRtOWtaUzRuS1NrN1hHNGdJQ0FnSUNCOVhHNGdJQ0FnSUNCeVpYUjFjbTRnYm5Wc2JEdGNiaUFnSUNCOVhHNGdJQ0FnY21WMGRYSnVJR055WldGMFpVTm9ZV2x1WVdKc1pWUjVjR1ZEYUdWamEyVnlLSFpoYkdsa1lYUmxLVHRjYmlBZ2ZWeHVYRzRnSUdaMWJtTjBhVzl1SUdOeVpXRjBaVk5vWVhCbFZIbHdaVU5vWldOclpYSW9jMmhoY0dWVWVYQmxjeWtnZTF4dUlDQWdJR1oxYm1OMGFXOXVJSFpoYkdsa1lYUmxLSEJ5YjNCekxDQndjbTl3VG1GdFpTd2dZMjl0Y0c5dVpXNTBUbUZ0WlN3Z2JHOWpZWFJwYjI0c0lIQnliM0JHZFd4c1RtRnRaU2tnZTF4dUlDQWdJQ0FnZG1GeUlIQnliM0JXWVd4MVpTQTlJSEJ5YjNCelczQnliM0JPWVcxbFhUdGNiaUFnSUNBZ0lIWmhjaUJ3Y205d1ZIbHdaU0E5SUdkbGRGQnliM0JVZVhCbEtIQnliM0JXWVd4MVpTazdYRzRnSUNBZ0lDQnBaaUFvY0hKdmNGUjVjR1VnSVQwOUlDZHZZbXBsWTNRbktTQjdYRzRnSUNBZ0lDQWdJSEpsZEhWeWJpQnVaWGNnVUhKdmNGUjVjR1ZGY25KdmNpZ25TVzUyWVd4cFpDQW5JQ3NnYkc5allYUnBiMjRnS3lBbklHQW5JQ3NnY0hKdmNFWjFiR3hPWVcxbElDc2dKMkFnYjJZZ2RIbHdaU0JnSnlBcklIQnliM0JVZVhCbElDc2dKMkFnSnlBcklDZ25jM1Z3Y0d4cFpXUWdkRzhnWUNjZ0t5QmpiMjF3YjI1bGJuUk9ZVzFsSUNzZ0oyQXNJR1Y0Y0dWamRHVmtJR0J2WW1wbFkzUmdMaWNwS1R0Y2JpQWdJQ0FnSUgxY2JpQWdJQ0FnSUdadmNpQW9kbUZ5SUd0bGVTQnBiaUJ6YUdGd1pWUjVjR1Z6S1NCN1hHNGdJQ0FnSUNBZ0lIWmhjaUJqYUdWamEyVnlJRDBnYzJoaGNHVlVlWEJsYzF0clpYbGRPMXh1SUNBZ0lDQWdJQ0JwWmlBb0lXTm9aV05yWlhJcElIdGNiaUFnSUNBZ0lDQWdJQ0JqYjI1MGFXNTFaVHRjYmlBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNCMllYSWdaWEp5YjNJZ1BTQmphR1ZqYTJWeUtIQnliM0JXWVd4MVpTd2dhMlY1TENCamIyMXdiMjVsYm5ST1lXMWxMQ0JzYjJOaGRHbHZiaXdnY0hKdmNFWjFiR3hPWVcxbElDc2dKeTRuSUNzZ2EyVjVMQ0JTWldGamRGQnliM0JVZVhCbGMxTmxZM0psZENrN1hHNGdJQ0FnSUNBZ0lHbG1JQ2hsY25KdmNpa2dlMXh1SUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUJsY25KdmNqdGNiaUFnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdmVnh1SUNBZ0lDQWdjbVYwZFhKdUlHNTFiR3c3WEc0Z0lDQWdmVnh1SUNBZ0lISmxkSFZ5YmlCamNtVmhkR1ZEYUdGcGJtRmliR1ZVZVhCbFEyaGxZMnRsY2loMllXeHBaR0YwWlNrN1hHNGdJSDFjYmx4dUlDQm1kVzVqZEdsdmJpQnBjMDV2WkdVb2NISnZjRlpoYkhWbEtTQjdYRzRnSUNBZ2MzZHBkR05vSUNoMGVYQmxiMllnY0hKdmNGWmhiSFZsS1NCN1hHNGdJQ0FnSUNCallYTmxJQ2R1ZFcxaVpYSW5PbHh1SUNBZ0lDQWdZMkZ6WlNBbmMzUnlhVzVuSnpwY2JpQWdJQ0FnSUdOaGMyVWdKM1Z1WkdWbWFXNWxaQ2M2WEc0Z0lDQWdJQ0FnSUhKbGRIVnliaUIwY25WbE8xeHVJQ0FnSUNBZ1kyRnpaU0FuWW05dmJHVmhiaWM2WEc0Z0lDQWdJQ0FnSUhKbGRIVnliaUFoY0hKdmNGWmhiSFZsTzF4dUlDQWdJQ0FnWTJGelpTQW5iMkpxWldOMEp6cGNiaUFnSUNBZ0lDQWdhV1lnS0VGeWNtRjVMbWx6UVhKeVlYa29jSEp2Y0ZaaGJIVmxLU2tnZTF4dUlDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCd2NtOXdWbUZzZFdVdVpYWmxjbmtvYVhOT2IyUmxLVHRjYmlBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNCcFppQW9jSEp2Y0ZaaGJIVmxJRDA5UFNCdWRXeHNJSHg4SUdselZtRnNhV1JGYkdWdFpXNTBLSEJ5YjNCV1lXeDFaU2twSUh0Y2JpQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z2RISjFaVHRjYmlBZ0lDQWdJQ0FnZlZ4dVhHNGdJQ0FnSUNBZ0lIWmhjaUJwZEdWeVlYUnZja1p1SUQwZ1oyVjBTWFJsY21GMGIzSkdiaWh3Y205d1ZtRnNkV1VwTzF4dUlDQWdJQ0FnSUNCcFppQW9hWFJsY21GMGIzSkdiaWtnZTF4dUlDQWdJQ0FnSUNBZ0lIWmhjaUJwZEdWeVlYUnZjaUE5SUdsMFpYSmhkRzl5Um00dVkyRnNiQ2h3Y205d1ZtRnNkV1VwTzF4dUlDQWdJQ0FnSUNBZ0lIWmhjaUJ6ZEdWd08xeHVJQ0FnSUNBZ0lDQWdJR2xtSUNocGRHVnlZWFJ2Y2tadUlDRTlQU0J3Y205d1ZtRnNkV1V1Wlc1MGNtbGxjeWtnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdkMmhwYkdVZ0tDRW9jM1JsY0NBOUlHbDBaWEpoZEc5eUxtNWxlSFFvS1NrdVpHOXVaU2tnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0JwWmlBb0lXbHpUbTlrWlNoemRHVndMblpoYkhWbEtTa2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQm1ZV3h6WlR0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0FnSUgwZ1pXeHpaU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQXZMeUJKZEdWeVlYUnZjaUIzYVd4c0lIQnliM1pwWkdVZ1pXNTBjbmtnVzJzc2RsMGdkSFZ3YkdWeklISmhkR2hsY2lCMGFHRnVJSFpoYkhWbGN5NWNiaUFnSUNBZ0lDQWdJQ0FnSUhkb2FXeGxJQ2doS0hOMFpYQWdQU0JwZEdWeVlYUnZjaTV1WlhoMEtDa3BMbVJ2Ym1VcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ2RtRnlJR1Z1ZEhKNUlEMGdjM1JsY0M1MllXeDFaVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdhV1lnS0dWdWRISjVLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnYVdZZ0tDRnBjMDV2WkdVb1pXNTBjbmxiTVYwcEtTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdabUZzYzJVN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ0lDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQm1ZV3h6WlR0Y2JpQWdJQ0FnSUNBZ2ZWeHVYRzRnSUNBZ0lDQWdJSEpsZEhWeWJpQjBjblZsTzF4dUlDQWdJQ0FnWkdWbVlYVnNkRHBjYmlBZ0lDQWdJQ0FnY21WMGRYSnVJR1poYkhObE8xeHVJQ0FnSUgxY2JpQWdmVnh1WEc0Z0lHWjFibU4wYVc5dUlHbHpVM2x0WW05c0tIQnliM0JVZVhCbExDQndjbTl3Vm1Gc2RXVXBJSHRjYmlBZ0lDQXZMeUJPWVhScGRtVWdVM2x0WW05c0xseHVJQ0FnSUdsbUlDaHdjbTl3Vkhsd1pTQTlQVDBnSjNONWJXSnZiQ2NwSUh0Y2JpQWdJQ0FnSUhKbGRIVnliaUIwY25WbE8xeHVJQ0FnSUgxY2JseHVJQ0FnSUM4dklERTVMalF1TXk0MUlGTjViV0p2YkM1d2NtOTBiM1I1Y0dWYlFFQjBiMU4wY21sdVoxUmhaMTBnUFQwOUlDZFRlVzFpYjJ3blhHNGdJQ0FnYVdZZ0tIQnliM0JXWVd4MVpWc25RRUIwYjFOMGNtbHVaMVJoWnlkZElEMDlQU0FuVTNsdFltOXNKeWtnZTF4dUlDQWdJQ0FnY21WMGRYSnVJSFJ5ZFdVN1hHNGdJQ0FnZlZ4dVhHNGdJQ0FnTHk4Z1JtRnNiR0poWTJzZ1ptOXlJRzV2YmkxemNHVmpJR052YlhCc2FXRnVkQ0JUZVcxaWIyeHpJSGRvYVdOb0lHRnlaU0J3YjJ4NVptbHNiR1ZrTGx4dUlDQWdJR2xtSUNoMGVYQmxiMllnVTNsdFltOXNJRDA5UFNBblpuVnVZM1JwYjI0bklDWW1JSEJ5YjNCV1lXeDFaU0JwYm5OMFlXNWpaVzltSUZONWJXSnZiQ2tnZTF4dUlDQWdJQ0FnY21WMGRYSnVJSFJ5ZFdVN1hHNGdJQ0FnZlZ4dVhHNGdJQ0FnY21WMGRYSnVJR1poYkhObE8xeHVJQ0I5WEc1Y2JpQWdMeThnUlhGMWFYWmhiR1Z1ZENCdlppQmdkSGx3Wlc5bVlDQmlkWFFnZDJsMGFDQnpjR1ZqYVdGc0lHaGhibVJzYVc1bklHWnZjaUJoY25KaGVTQmhibVFnY21WblpYaHdMbHh1SUNCbWRXNWpkR2x2YmlCblpYUlFjbTl3Vkhsd1pTaHdjbTl3Vm1Gc2RXVXBJSHRjYmlBZ0lDQjJZWElnY0hKdmNGUjVjR1VnUFNCMGVYQmxiMllnY0hKdmNGWmhiSFZsTzF4dUlDQWdJR2xtSUNoQmNuSmhlUzVwYzBGeWNtRjVLSEJ5YjNCV1lXeDFaU2twSUh0Y2JpQWdJQ0FnSUhKbGRIVnliaUFuWVhKeVlYa25PMXh1SUNBZ0lIMWNiaUFnSUNCcFppQW9jSEp2Y0ZaaGJIVmxJR2x1YzNSaGJtTmxiMllnVW1WblJYaHdLU0I3WEc0Z0lDQWdJQ0F2THlCUGJHUWdkMlZpYTJsMGN5QW9ZWFFnYkdWaGMzUWdkVzUwYVd3Z1FXNWtjbTlwWkNBMExqQXBJSEpsZEhWeWJpQW5ablZ1WTNScGIyNG5JSEpoZEdobGNpQjBhR0Z1WEc0Z0lDQWdJQ0F2THlBbmIySnFaV04wSnlCbWIzSWdkSGx3Wlc5bUlHRWdVbVZuUlhod0xpQlhaU2RzYkNCdWIzSnRZV3hwZW1VZ2RHaHBjeUJvWlhKbElITnZJSFJvWVhRZ0wySnNZUzljYmlBZ0lDQWdJQzh2SUhCaGMzTmxjeUJRY205d1ZIbHdaWE11YjJKcVpXTjBMbHh1SUNBZ0lDQWdjbVYwZFhKdUlDZHZZbXBsWTNRbk8xeHVJQ0FnSUgxY2JpQWdJQ0JwWmlBb2FYTlRlVzFpYjJ3b2NISnZjRlI1Y0dVc0lIQnliM0JXWVd4MVpTa3BJSHRjYmlBZ0lDQWdJSEpsZEhWeWJpQW5jM2x0WW05c0p6dGNiaUFnSUNCOVhHNGdJQ0FnY21WMGRYSnVJSEJ5YjNCVWVYQmxPMXh1SUNCOVhHNWNiaUFnTHk4Z1ZHaHBjeUJvWVc1a2JHVnpJRzF2Y21VZ2RIbHdaWE1nZEdoaGJpQmdaMlYwVUhKdmNGUjVjR1ZnTGlCUGJteDVJSFZ6WldRZ1ptOXlJR1Z5Y205eUlHMWxjM05oWjJWekxseHVJQ0F2THlCVFpXVWdZR055WldGMFpWQnlhVzFwZEdsMlpWUjVjR1ZEYUdWamEyVnlZQzVjYmlBZ1puVnVZM1JwYjI0Z1oyVjBVSEpsWTJselpWUjVjR1VvY0hKdmNGWmhiSFZsS1NCN1hHNGdJQ0FnYVdZZ0tIUjVjR1Z2WmlCd2NtOXdWbUZzZFdVZ1BUMDlJQ2QxYm1SbFptbHVaV1FuSUh4OElIQnliM0JXWVd4MVpTQTlQVDBnYm5Wc2JDa2dlMXh1SUNBZ0lDQWdjbVYwZFhKdUlDY25JQ3NnY0hKdmNGWmhiSFZsTzF4dUlDQWdJSDFjYmlBZ0lDQjJZWElnY0hKdmNGUjVjR1VnUFNCblpYUlFjbTl3Vkhsd1pTaHdjbTl3Vm1Gc2RXVXBPMXh1SUNBZ0lHbG1JQ2h3Y205d1ZIbHdaU0E5UFQwZ0oyOWlhbVZqZENjcElIdGNiaUFnSUNBZ0lHbG1JQ2h3Y205d1ZtRnNkV1VnYVc1emRHRnVZMlZ2WmlCRVlYUmxLU0I3WEc0Z0lDQWdJQ0FnSUhKbGRIVnliaUFuWkdGMFpTYzdYRzRnSUNBZ0lDQjlJR1ZzYzJVZ2FXWWdLSEJ5YjNCV1lXeDFaU0JwYm5OMFlXNWpaVzltSUZKbFowVjRjQ2tnZTF4dUlDQWdJQ0FnSUNCeVpYUjFjbTRnSjNKbFoyVjRjQ2M3WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdmVnh1SUNBZ0lISmxkSFZ5YmlCd2NtOXdWSGx3WlR0Y2JpQWdmVnh1WEc0Z0lDOHZJRkpsZEhWeWJuTWdZU0J6ZEhKcGJtY2dkR2hoZENCcGN5QndiM04wWm1sNFpXUWdkRzhnWVNCM1lYSnVhVzVuSUdGaWIzVjBJR0Z1SUdsdWRtRnNhV1FnZEhsd1pTNWNiaUFnTHk4Z1JtOXlJR1Y0WVcxd2JHVXNJRndpZFc1a1pXWnBibVZrWENJZ2IzSWdYQ0p2WmlCMGVYQmxJR0Z5Y21GNVhDSmNiaUFnWm5WdVkzUnBiMjRnWjJWMFVHOXpkR1pwZUVadmNsUjVjR1ZYWVhKdWFXNW5LSFpoYkhWbEtTQjdYRzRnSUNBZ2RtRnlJSFI1Y0dVZ1BTQm5aWFJRY21WamFYTmxWSGx3WlNoMllXeDFaU2s3WEc0Z0lDQWdjM2RwZEdOb0lDaDBlWEJsS1NCN1hHNGdJQ0FnSUNCallYTmxJQ2RoY25KaGVTYzZYRzRnSUNBZ0lDQmpZWE5sSUNkdlltcGxZM1FuT2x4dUlDQWdJQ0FnSUNCeVpYUjFjbTRnSjJGdUlDY2dLeUIwZVhCbE8xeHVJQ0FnSUNBZ1kyRnpaU0FuWW05dmJHVmhiaWM2WEc0Z0lDQWdJQ0JqWVhObElDZGtZWFJsSnpwY2JpQWdJQ0FnSUdOaGMyVWdKM0psWjJWNGNDYzZYRzRnSUNBZ0lDQWdJSEpsZEhWeWJpQW5ZU0FuSUNzZ2RIbHdaVHRjYmlBZ0lDQWdJR1JsWm1GMWJIUTZYRzRnSUNBZ0lDQWdJSEpsZEhWeWJpQjBlWEJsTzF4dUlDQWdJSDFjYmlBZ2ZWeHVYRzRnSUM4dklGSmxkSFZ5Ym5NZ1kyeGhjM01nYm1GdFpTQnZaaUIwYUdVZ2IySnFaV04wTENCcFppQmhibmt1WEc0Z0lHWjFibU4wYVc5dUlHZGxkRU5zWVhOelRtRnRaU2h3Y205d1ZtRnNkV1VwSUh0Y2JpQWdJQ0JwWmlBb0lYQnliM0JXWVd4MVpTNWpiMjV6ZEhKMVkzUnZjaUI4ZkNBaGNISnZjRlpoYkhWbExtTnZibk4wY25WamRHOXlMbTVoYldVcElIdGNiaUFnSUNBZ0lISmxkSFZ5YmlCQlRrOU9XVTFQVlZNN1hHNGdJQ0FnZlZ4dUlDQWdJSEpsZEhWeWJpQndjbTl3Vm1Gc2RXVXVZMjl1YzNSeWRXTjBiM0l1Ym1GdFpUdGNiaUFnZlZ4dVhHNGdJRkpsWVdOMFVISnZjRlI1Y0dWekxtTm9aV05yVUhKdmNGUjVjR1Z6SUQwZ1kyaGxZMnRRY205d1ZIbHdaWE03WEc0Z0lGSmxZV04wVUhKdmNGUjVjR1Z6TGxCeWIzQlVlWEJsY3lBOUlGSmxZV04wVUhKdmNGUjVjR1Z6TzF4dVhHNGdJSEpsZEhWeWJpQlNaV0ZqZEZCeWIzQlVlWEJsY3p0Y2JuMDdYRzRpTENJdktpcGNiaUFxSUVOdmNIbHlhV2RvZENBeU1ERXpMWEJ5WlhObGJuUXNJRVpoWTJWaWIyOXJMQ0JKYm1NdVhHNGdLaUJCYkd3Z2NtbG5hSFJ6SUhKbGMyVnlkbVZrTGx4dUlDcGNiaUFxSUZSb2FYTWdjMjkxY21ObElHTnZaR1VnYVhNZ2JHbGpaVzV6WldRZ2RXNWtaWElnZEdobElFSlRSQzF6ZEhsc1pTQnNhV05sYm5ObElHWnZkVzVrSUdsdUlIUm9aVnh1SUNvZ1RFbERSVTVUUlNCbWFXeGxJR2x1SUhSb1pTQnliMjkwSUdScGNtVmpkRzl5ZVNCdlppQjBhR2x6SUhOdmRYSmpaU0IwY21WbExpQkJiaUJoWkdScGRHbHZibUZzSUdkeVlXNTBYRzRnS2lCdlppQndZWFJsYm5RZ2NtbG5hSFJ6SUdOaGJpQmlaU0JtYjNWdVpDQnBiaUIwYUdVZ1VFRlVSVTVVVXlCbWFXeGxJR2x1SUhSb1pTQnpZVzFsSUdScGNtVmpkRzl5ZVM1Y2JpQXFMMXh1WEc0bmRYTmxJSE4wY21samRDYzdYRzVjYm5aaGNpQlNaV0ZqZEZCeWIzQlVlWEJsYzFObFkzSmxkQ0E5SUNkVFJVTlNSVlJmUkU5ZlRrOVVYMUJCVTFOZlZFaEpVMTlQVWw5WlQxVmZWMGxNVEY5Q1JWOUdTVkpGUkNjN1hHNWNibTF2WkhWc1pTNWxlSEJ2Y25SeklEMGdVbVZoWTNSUWNtOXdWSGx3WlhOVFpXTnlaWFE3WEc0aUxDSXZLaXBjYmlBcUlFTnZjSGx5YVdkb2RDQXlNREV6TFhCeVpYTmxiblFzSUVaaFkyVmliMjlyTENCSmJtTXVYRzRnS2lCQmJHd2djbWxuYUhSeklISmxjMlZ5ZG1Wa0xseHVJQ3BjYmlBcUlGUm9hWE1nYzI5MWNtTmxJR052WkdVZ2FYTWdiR2xqWlc1elpXUWdkVzVrWlhJZ2RHaGxJRUpUUkMxemRIbHNaU0JzYVdObGJuTmxJR1p2ZFc1a0lHbHVJSFJvWlZ4dUlDb2dURWxEUlU1VFJTQm1hV3hsSUdsdUlIUm9aU0J5YjI5MElHUnBjbVZqZEc5eWVTQnZaaUIwYUdseklITnZkWEpqWlNCMGNtVmxMaUJCYmlCaFpHUnBkR2x2Ym1Gc0lHZHlZVzUwWEc0Z0tpQnZaaUJ3WVhSbGJuUWdjbWxuYUhSeklHTmhiaUJpWlNCbWIzVnVaQ0JwYmlCMGFHVWdVRUZVUlU1VVV5Qm1hV3hsSUdsdUlIUm9aU0J6WVcxbElHUnBjbVZqZEc5eWVTNWNiaUFxWEc0Z0tpQmNiaUFxTDF4dVhHNG5kWE5sSUhOMGNtbGpkQ2M3WEc1Y2JpOHFLbHh1SUNvZ1JYTmpZWEJsSUdGdVpDQjNjbUZ3SUd0bGVTQnpieUJwZENCcGN5QnpZV1psSUhSdklIVnpaU0JoY3lCaElISmxZV04wYVdSY2JpQXFYRzRnS2lCQWNHRnlZVzBnZTNOMGNtbHVaMzBnYTJWNUlIUnZJR0psSUdWelkyRndaV1F1WEc0Z0tpQkFjbVYwZFhKdUlIdHpkSEpwYm1kOUlIUm9aU0JsYzJOaGNHVmtJR3RsZVM1Y2JpQXFMMXh1WEc1bWRXNWpkR2x2YmlCbGMyTmhjR1VvYTJWNUtTQjdYRzRnSUhaaGNpQmxjMk5oY0dWU1pXZGxlQ0E5SUM5YlBUcGRMMmM3WEc0Z0lIWmhjaUJsYzJOaGNHVnlURzl2YTNWd0lEMGdlMXh1SUNBZ0lDYzlKem9nSnowd0p5eGNiaUFnSUNBbk9pYzZJQ2M5TWlkY2JpQWdmVHRjYmlBZ2RtRnlJR1Z6WTJGd1pXUlRkSEpwYm1jZ1BTQW9KeWNnS3lCclpYa3BMbkpsY0d4aFkyVW9aWE5qWVhCbFVtVm5aWGdzSUdaMWJtTjBhVzl1SUNodFlYUmphQ2tnZTF4dUlDQWdJSEpsZEhWeWJpQmxjMk5oY0dWeVRHOXZhM1Z3VzIxaGRHTm9YVHRjYmlBZ2ZTazdYRzVjYmlBZ2NtVjBkWEp1SUNja0p5QXJJR1Z6WTJGd1pXUlRkSEpwYm1jN1hHNTlYRzVjYmk4cUtseHVJQ29nVlc1bGMyTmhjR1VnWVc1a0lIVnVkM0poY0NCclpYa2dabTl5SUdoMWJXRnVMWEpsWVdSaFlteGxJR1JwYzNCc1lYbGNiaUFxWEc0Z0tpQkFjR0Z5WVcwZ2UzTjBjbWx1WjMwZ2EyVjVJSFJ2SUhWdVpYTmpZWEJsTGx4dUlDb2dRSEpsZEhWeWJpQjdjM1J5YVc1bmZTQjBhR1VnZFc1bGMyTmhjR1ZrSUd0bGVTNWNiaUFxTDF4dVpuVnVZM1JwYjI0Z2RXNWxjMk5oY0dVb2EyVjVLU0I3WEc0Z0lIWmhjaUIxYm1WelkyRndaVkpsWjJWNElEMGdMeWc5TUh3OU1pa3ZaenRjYmlBZ2RtRnlJSFZ1WlhOallYQmxja3h2YjJ0MWNDQTlJSHRjYmlBZ0lDQW5QVEFuT2lBblBTY3NYRzRnSUNBZ0p6MHlKem9nSnpvblhHNGdJSDA3WEc0Z0lIWmhjaUJyWlhsVGRXSnpkSEpwYm1jZ1BTQnJaWGxiTUYwZ1BUMDlJQ2N1SnlBbUppQnJaWGxiTVYwZ1BUMDlJQ2NrSnlBL0lHdGxlUzV6ZFdKemRISnBibWNvTWlrZ09pQnJaWGt1YzNWaWMzUnlhVzVuS0RFcE8xeHVYRzRnSUhKbGRIVnliaUFvSnljZ0t5QnJaWGxUZFdKemRISnBibWNwTG5KbGNHeGhZMlVvZFc1bGMyTmhjR1ZTWldkbGVDd2dablZ1WTNScGIyNGdLRzFoZEdOb0tTQjdYRzRnSUNBZ2NtVjBkWEp1SUhWdVpYTmpZWEJsY2t4dmIydDFjRnR0WVhSamFGMDdYRzRnSUgwcE8xeHVmVnh1WEc1MllYSWdTMlY1UlhOallYQmxWWFJwYkhNZ1BTQjdYRzRnSUdWelkyRndaVG9nWlhOallYQmxMRnh1SUNCMWJtVnpZMkZ3WlRvZ2RXNWxjMk5oY0dWY2JuMDdYRzVjYm0xdlpIVnNaUzVsZUhCdmNuUnpJRDBnUzJWNVJYTmpZWEJsVlhScGJITTdJaXdpTHlvcVhHNGdLaUJEYjNCNWNtbG5hSFFnTWpBeE15MXdjbVZ6Wlc1MExDQkdZV05sWW05dmF5d2dTVzVqTGx4dUlDb2dRV3hzSUhKcFoyaDBjeUJ5WlhObGNuWmxaQzVjYmlBcVhHNGdLaUJVYUdseklITnZkWEpqWlNCamIyUmxJR2x6SUd4cFkyVnVjMlZrSUhWdVpHVnlJSFJvWlNCQ1UwUXRjM1I1YkdVZ2JHbGpaVzV6WlNCbWIzVnVaQ0JwYmlCMGFHVmNiaUFxSUV4SlEwVk9VMFVnWm1sc1pTQnBiaUIwYUdVZ2NtOXZkQ0JrYVhKbFkzUnZjbmtnYjJZZ2RHaHBjeUJ6YjNWeVkyVWdkSEpsWlM0Z1FXNGdZV1JrYVhScGIyNWhiQ0JuY21GdWRGeHVJQ29nYjJZZ2NHRjBaVzUwSUhKcFoyaDBjeUJqWVc0Z1ltVWdabTkxYm1RZ2FXNGdkR2hsSUZCQlZFVk9WRk1nWm1sc1pTQnBiaUIwYUdVZ2MyRnRaU0JrYVhKbFkzUnZjbmt1WEc0Z0tseHVJQ29nWEc0Z0tpOWNibHh1SjNWelpTQnpkSEpwWTNRbk8xeHVYRzUyWVhJZ1gzQnliMlJKYm5aaGNtbGhiblFnUFNCeVpYRjFhWEpsS0NjdUwzSmxZV04wVUhKdlpFbHVkbUZ5YVdGdWRDY3BPMXh1WEc1MllYSWdhVzUyWVhKcFlXNTBJRDBnY21WeGRXbHlaU2duWm1KcWN5OXNhV0l2YVc1MllYSnBZVzUwSnlrN1hHNWNiaThxS2x4dUlDb2dVM1JoZEdsaklIQnZiMnhsY25NdUlGTmxkbVZ5WVd3Z1kzVnpkRzl0SUhabGNuTnBiMjV6SUdadmNpQmxZV05vSUhCdmRHVnVkR2xoYkNCdWRXMWlaWElnYjJaY2JpQXFJR0Z5WjNWdFpXNTBjeTRnUVNCamIyMXdiR1YwWld4NUlHZGxibVZ5YVdNZ2NHOXZiR1Z5SUdseklHVmhjM2tnZEc4Z2FXMXdiR1Z0Wlc1MExDQmlkWFFnZDI5MWJHUmNiaUFxSUhKbGNYVnBjbVVnWVdOalpYTnphVzVuSUhSb1pTQmdZWEpuZFcxbGJuUnpZQ0J2WW1wbFkzUXVJRWx1SUdWaFkyZ2diMllnZEdobGMyVXNJR0IwYUdsellDQnlaV1psY25NZ2RHOWNiaUFxSUhSb1pTQkRiR0Z6Y3lCcGRITmxiR1lzSUc1dmRDQmhiaUJwYm5OMFlXNWpaUzRnU1dZZ1lXNTVJRzkwYUdWeWN5QmhjbVVnYm1WbFpHVmtMQ0J6YVcxd2JIa2dZV1JrSUhSb1pXMWNiaUFxSUdobGNtVXNJRzl5SUdsdUlIUm9aV2x5SUc5M2JpQm1hV3hsY3k1Y2JpQXFMMXh1ZG1GeUlHOXVaVUZ5WjNWdFpXNTBVRzl2YkdWeUlEMGdablZ1WTNScGIyNGdLR052Y0hsR2FXVnNaSE5HY205dEtTQjdYRzRnSUhaaGNpQkxiR0Z6Y3lBOUlIUm9hWE03WEc0Z0lHbG1JQ2hMYkdGemN5NXBibk4wWVc1alpWQnZiMnd1YkdWdVozUm9LU0I3WEc0Z0lDQWdkbUZ5SUdsdWMzUmhibU5sSUQwZ1MyeGhjM011YVc1emRHRnVZMlZRYjI5c0xuQnZjQ2dwTzF4dUlDQWdJRXRzWVhOekxtTmhiR3dvYVc1emRHRnVZMlVzSUdOdmNIbEdhV1ZzWkhOR2NtOXRLVHRjYmlBZ0lDQnlaWFIxY200Z2FXNXpkR0Z1WTJVN1hHNGdJSDBnWld4elpTQjdYRzRnSUNBZ2NtVjBkWEp1SUc1bGR5QkxiR0Z6Y3loamIzQjVSbWxsYkdSelJuSnZiU2s3WEc0Z0lIMWNibjA3WEc1Y2JuWmhjaUIwZDI5QmNtZDFiV1Z1ZEZCdmIyeGxjaUE5SUdaMWJtTjBhVzl1SUNoaE1Td2dZVElwSUh0Y2JpQWdkbUZ5SUV0c1lYTnpJRDBnZEdocGN6dGNiaUFnYVdZZ0tFdHNZWE56TG1sdWMzUmhibU5sVUc5dmJDNXNaVzVuZEdncElIdGNiaUFnSUNCMllYSWdhVzV6ZEdGdVkyVWdQU0JMYkdGemN5NXBibk4wWVc1alpWQnZiMnd1Y0c5d0tDazdYRzRnSUNBZ1MyeGhjM011WTJGc2JDaHBibk4wWVc1alpTd2dZVEVzSUdFeUtUdGNiaUFnSUNCeVpYUjFjbTRnYVc1emRHRnVZMlU3WEc0Z0lIMGdaV3h6WlNCN1hHNGdJQ0FnY21WMGRYSnVJRzVsZHlCTGJHRnpjeWhoTVN3Z1lUSXBPMXh1SUNCOVhHNTlPMXh1WEc1MllYSWdkR2h5WldWQmNtZDFiV1Z1ZEZCdmIyeGxjaUE5SUdaMWJtTjBhVzl1SUNoaE1Td2dZVElzSUdFektTQjdYRzRnSUhaaGNpQkxiR0Z6Y3lBOUlIUm9hWE03WEc0Z0lHbG1JQ2hMYkdGemN5NXBibk4wWVc1alpWQnZiMnd1YkdWdVozUm9LU0I3WEc0Z0lDQWdkbUZ5SUdsdWMzUmhibU5sSUQwZ1MyeGhjM011YVc1emRHRnVZMlZRYjI5c0xuQnZjQ2dwTzF4dUlDQWdJRXRzWVhOekxtTmhiR3dvYVc1emRHRnVZMlVzSUdFeExDQmhNaXdnWVRNcE8xeHVJQ0FnSUhKbGRIVnliaUJwYm5OMFlXNWpaVHRjYmlBZ2ZTQmxiSE5sSUh0Y2JpQWdJQ0J5WlhSMWNtNGdibVYzSUV0c1lYTnpLR0V4TENCaE1pd2dZVE1wTzF4dUlDQjlYRzU5TzF4dVhHNTJZWElnWm05MWNrRnlaM1Z0Wlc1MFVHOXZiR1Z5SUQwZ1puVnVZM1JwYjI0Z0tHRXhMQ0JoTWl3Z1lUTXNJR0UwS1NCN1hHNGdJSFpoY2lCTGJHRnpjeUE5SUhSb2FYTTdYRzRnSUdsbUlDaExiR0Z6Y3k1cGJuTjBZVzVqWlZCdmIyd3ViR1Z1WjNSb0tTQjdYRzRnSUNBZ2RtRnlJR2x1YzNSaGJtTmxJRDBnUzJ4aGMzTXVhVzV6ZEdGdVkyVlFiMjlzTG5CdmNDZ3BPMXh1SUNBZ0lFdHNZWE56TG1OaGJHd29hVzV6ZEdGdVkyVXNJR0V4TENCaE1pd2dZVE1zSUdFMEtUdGNiaUFnSUNCeVpYUjFjbTRnYVc1emRHRnVZMlU3WEc0Z0lIMGdaV3h6WlNCN1hHNGdJQ0FnY21WMGRYSnVJRzVsZHlCTGJHRnpjeWhoTVN3Z1lUSXNJR0V6TENCaE5DazdYRzRnSUgxY2JuMDdYRzVjYm5aaGNpQnpkR0Z1WkdGeVpGSmxiR1ZoYzJWeUlEMGdablZ1WTNScGIyNGdLR2x1YzNSaGJtTmxLU0I3WEc0Z0lIWmhjaUJMYkdGemN5QTlJSFJvYVhNN1hHNGdJQ0VvYVc1emRHRnVZMlVnYVc1emRHRnVZMlZ2WmlCTGJHRnpjeWtnUHlCd2NtOWpaWE56TG1WdWRpNU9UMFJGWDBWT1ZpQWhQVDBnSjNCeWIyUjFZM1JwYjI0bklEOGdhVzUyWVhKcFlXNTBLR1poYkhObExDQW5WSEo1YVc1bklIUnZJSEpsYkdWaGMyVWdZVzRnYVc1emRHRnVZMlVnYVc1MGJ5QmhJSEJ2YjJ3Z2IyWWdZU0JrYVdabVpYSmxiblFnZEhsd1pTNG5LU0E2SUY5d2NtOWtTVzUyWVhKcFlXNTBLQ2N5TlNjcElEb2dkbTlwWkNBd08xeHVJQ0JwYm5OMFlXNWpaUzVrWlhOMGNuVmpkRzl5S0NrN1hHNGdJR2xtSUNoTGJHRnpjeTVwYm5OMFlXNWpaVkJ2YjJ3dWJHVnVaM1JvSUR3Z1MyeGhjM011Y0c5dmJGTnBlbVVwSUh0Y2JpQWdJQ0JMYkdGemN5NXBibk4wWVc1alpWQnZiMnd1Y0hWemFDaHBibk4wWVc1alpTazdYRzRnSUgxY2JuMDdYRzVjYm5aaGNpQkVSVVpCVlV4VVgxQlBUMHhmVTBsYVJTQTlJREV3TzF4dWRtRnlJRVJGUmtGVlRGUmZVRTlQVEVWU0lEMGdiMjVsUVhKbmRXMWxiblJRYjI5c1pYSTdYRzVjYmk4cUtseHVJQ29nUVhWbmJXVnVkSE1nWUVOdmNIbERiMjV6ZEhKMVkzUnZjbUFnZEc4Z1ltVWdZU0J3YjI5c1lXSnNaU0JqYkdGemN5d2dZWFZuYldWdWRHbHVaeUJ2Ym14NUlIUm9aU0JqYkdGemMxeHVJQ29nYVhSelpXeG1JQ2h6ZEdGMGFXTmhiR3g1S1NCdWIzUWdZV1JrYVc1bklHRnVlU0J3Y205MGIzUjVjR2xqWVd3Z1ptbGxiR1J6TGlCQmJua2dRMjl3ZVVOdmJuTjBjblZqZEc5eVhHNGdLaUI1YjNVZ1oybDJaU0IwYUdseklHMWhlU0JvWVhabElHRWdZSEJ2YjJ4VGFYcGxZQ0J3Y205d1pYSjBlU3dnWVc1a0lIZHBiR3dnYkc5dmF5Qm1iM0lnWVZ4dUlDb2djSEp2ZEc5MGVYQnBZMkZzSUdCa1pYTjBjblZqZEc5eVlDQnZiaUJwYm5OMFlXNWpaWE11WEc0Z0tseHVJQ29nUUhCaGNtRnRJSHRHZFc1amRHbHZibjBnUTI5d2VVTnZibk4wY25WamRHOXlJRU52Ym5OMGNuVmpkRzl5SUhSb1lYUWdZMkZ1SUdKbElIVnpaV1FnZEc4Z2NtVnpaWFF1WEc0Z0tpQkFjR0Z5WVcwZ2UwWjFibU4wYVc5dWZTQndiMjlzWlhJZ1EzVnpkRzl0YVhwaFlteGxJSEJ2YjJ4bGNpNWNiaUFxTDF4dWRtRnlJR0ZrWkZCdmIyeHBibWRVYnlBOUlHWjFibU4wYVc5dUlDaERiM0I1UTI5dWMzUnlkV04wYjNJc0lIQnZiMnhsY2lrZ2UxeHVJQ0F2THlCRFlYTjBhVzVuSUdGeklHRnVlU0J6YnlCMGFHRjBJR1pzYjNjZ2FXZHViM0psY3lCMGFHVWdZV04wZFdGc0lHbHRjR3hsYldWdWRHRjBhVzl1SUdGdVpDQjBjblZ6ZEhOY2JpQWdMeThnYVhRZ2RHOGdiV0YwWTJnZ2RHaGxJSFI1Y0dVZ2QyVWdaR1ZqYkdGeVpXUmNiaUFnZG1GeUlFNWxkMHRzWVhOeklEMGdRMjl3ZVVOdmJuTjBjblZqZEc5eU8xeHVJQ0JPWlhkTGJHRnpjeTVwYm5OMFlXNWpaVkJ2YjJ3Z1BTQmJYVHRjYmlBZ1RtVjNTMnhoYzNNdVoyVjBVRzl2YkdWa0lEMGdjRzl2YkdWeUlIeDhJRVJGUmtGVlRGUmZVRTlQVEVWU08xeHVJQ0JwWmlBb0lVNWxkMHRzWVhOekxuQnZiMnhUYVhwbEtTQjdYRzRnSUNBZ1RtVjNTMnhoYzNNdWNHOXZiRk5wZW1VZ1BTQkVSVVpCVlV4VVgxQlBUMHhmVTBsYVJUdGNiaUFnZlZ4dUlDQk9aWGRMYkdGemN5NXlaV3hsWVhObElEMGdjM1JoYm1SaGNtUlNaV3hsWVhObGNqdGNiaUFnY21WMGRYSnVJRTVsZDB0c1lYTnpPMXh1ZlR0Y2JseHVkbUZ5SUZCdmIyeGxaRU5zWVhOeklEMGdlMXh1SUNCaFpHUlFiMjlzYVc1blZHODZJR0ZrWkZCdmIyeHBibWRVYnl4Y2JpQWdiMjVsUVhKbmRXMWxiblJRYjI5c1pYSTZJRzl1WlVGeVozVnRaVzUwVUc5dmJHVnlMRnh1SUNCMGQyOUJjbWQxYldWdWRGQnZiMnhsY2pvZ2RIZHZRWEpuZFcxbGJuUlFiMjlzWlhJc1hHNGdJSFJvY21WbFFYSm5kVzFsYm5SUWIyOXNaWEk2SUhSb2NtVmxRWEpuZFcxbGJuUlFiMjlzWlhJc1hHNGdJR1p2ZFhKQmNtZDFiV1Z1ZEZCdmIyeGxjam9nWm05MWNrRnlaM1Z0Wlc1MFVHOXZiR1Z5WEc1OU8xeHVYRzV0YjJSMWJHVXVaWGh3YjNKMGN5QTlJRkJ2YjJ4bFpFTnNZWE56T3lJc0lpOHFLbHh1SUNvZ1EyOXdlWEpwWjJoMElESXdNVE10Y0hKbGMyVnVkQ3dnUm1GalpXSnZiMnNzSUVsdVl5NWNiaUFxSUVGc2JDQnlhV2RvZEhNZ2NtVnpaWEoyWldRdVhHNGdLbHh1SUNvZ1ZHaHBjeUJ6YjNWeVkyVWdZMjlrWlNCcGN5QnNhV05sYm5ObFpDQjFibVJsY2lCMGFHVWdRbE5FTFhOMGVXeGxJR3hwWTJWdWMyVWdabTkxYm1RZ2FXNGdkR2hsWEc0Z0tpQk1TVU5GVGxORklHWnBiR1VnYVc0Z2RHaGxJSEp2YjNRZ1pHbHlaV04wYjNKNUlHOW1JSFJvYVhNZ2MyOTFjbU5sSUhSeVpXVXVJRUZ1SUdGa1pHbDBhVzl1WVd3Z1ozSmhiblJjYmlBcUlHOW1JSEJoZEdWdWRDQnlhV2RvZEhNZ1kyRnVJR0psSUdadmRXNWtJR2x1SUhSb1pTQlFRVlJGVGxSVElHWnBiR1VnYVc0Z2RHaGxJSE5oYldVZ1pHbHlaV04wYjNKNUxseHVJQ3BjYmlBcUwxeHVYRzRuZFhObElITjBjbWxqZENjN1hHNWNiblpoY2lCZllYTnphV2R1SUQwZ2NtVnhkV2x5WlNnbmIySnFaV04wTFdGemMybG5iaWNwTzF4dVhHNTJZWElnVW1WaFkzUkNZWE5sUTJ4aGMzTmxjeUE5SUhKbGNYVnBjbVVvSnk0dlVtVmhZM1JDWVhObFEyeGhjM05sY3ljcE8xeHVkbUZ5SUZKbFlXTjBRMmhwYkdSeVpXNGdQU0J5WlhGMWFYSmxLQ2N1TDFKbFlXTjBRMmhwYkdSeVpXNG5LVHRjYm5aaGNpQlNaV0ZqZEVSUFRVWmhZM1J2Y21sbGN5QTlJSEpsY1hWcGNtVW9KeTR2VW1WaFkzUkVUMDFHWVdOMGIzSnBaWE1uS1R0Y2JuWmhjaUJTWldGamRFVnNaVzFsYm5RZ1BTQnlaWEYxYVhKbEtDY3VMMUpsWVdOMFJXeGxiV1Z1ZENjcE8xeHVkbUZ5SUZKbFlXTjBVSEp2Y0ZSNWNHVnpJRDBnY21WeGRXbHlaU2duTGk5U1pXRmpkRkJ5YjNCVWVYQmxjeWNwTzF4dWRtRnlJRkpsWVdOMFZtVnljMmx2YmlBOUlISmxjWFZwY21Vb0p5NHZVbVZoWTNSV1pYSnphVzl1SnlrN1hHNWNiblpoY2lCamNtVmhkR1ZTWldGamRFTnNZWE56SUQwZ2NtVnhkV2x5WlNnbkxpOWpjbVZoZEdWRGJHRnpjeWNwTzF4dWRtRnlJRzl1YkhsRGFHbHNaQ0E5SUhKbGNYVnBjbVVvSnk0dmIyNXNlVU5vYVd4a0p5azdYRzVjYm5aaGNpQmpjbVZoZEdWRmJHVnRaVzUwSUQwZ1VtVmhZM1JGYkdWdFpXNTBMbU55WldGMFpVVnNaVzFsYm5RN1hHNTJZWElnWTNKbFlYUmxSbUZqZEc5eWVTQTlJRkpsWVdOMFJXeGxiV1Z1ZEM1amNtVmhkR1ZHWVdOMGIzSjVPMXh1ZG1GeUlHTnNiMjVsUld4bGJXVnVkQ0E5SUZKbFlXTjBSV3hsYldWdWRDNWpiRzl1WlVWc1pXMWxiblE3WEc1Y2JtbG1JQ2h3Y205alpYTnpMbVZ1ZGk1T1QwUkZYMFZPVmlBaFBUMGdKM0J5YjJSMVkzUnBiMjRuS1NCN1hHNGdJSFpoY2lCc2IzZFFjbWx2Y21sMGVWZGhjbTVwYm1jZ1BTQnlaWEYxYVhKbEtDY3VMMnh2ZDFCeWFXOXlhWFI1VjJGeWJtbHVaeWNwTzF4dUlDQjJZWElnWTJGdVJHVm1hVzVsVUhKdmNHVnlkSGtnUFNCeVpYRjFhWEpsS0NjdUwyTmhia1JsWm1sdVpWQnliM0JsY25SNUp5azdYRzRnSUhaaGNpQlNaV0ZqZEVWc1pXMWxiblJXWVd4cFpHRjBiM0lnUFNCeVpYRjFhWEpsS0NjdUwxSmxZV04wUld4bGJXVnVkRlpoYkdsa1lYUnZjaWNwTzF4dUlDQjJZWElnWkdsa1YyRnlibEJ5YjNCVWVYQmxjMFJsY0hKbFkyRjBaV1FnUFNCbVlXeHpaVHRjYmlBZ1kzSmxZWFJsUld4bGJXVnVkQ0E5SUZKbFlXTjBSV3hsYldWdWRGWmhiR2xrWVhSdmNpNWpjbVZoZEdWRmJHVnRaVzUwTzF4dUlDQmpjbVZoZEdWR1lXTjBiM0o1SUQwZ1VtVmhZM1JGYkdWdFpXNTBWbUZzYVdSaGRHOXlMbU55WldGMFpVWmhZM1J2Y25rN1hHNGdJR05zYjI1bFJXeGxiV1Z1ZENBOUlGSmxZV04wUld4bGJXVnVkRlpoYkdsa1lYUnZjaTVqYkc5dVpVVnNaVzFsYm5RN1hHNTlYRzVjYm5aaGNpQmZYM053Y21WaFpDQTlJRjloYzNOcFoyNDdYRzUyWVhJZ1kzSmxZWFJsVFdsNGFXNGdQU0JtZFc1amRHbHZiaUFvYldsNGFXNHBJSHRjYmlBZ2NtVjBkWEp1SUcxcGVHbHVPMXh1ZlR0Y2JseHVhV1lnS0hCeWIyTmxjM011Wlc1MkxrNVBSRVZmUlU1V0lDRTlQU0FuY0hKdlpIVmpkR2x2YmljcElIdGNiaUFnZG1GeUlIZGhjbTVsWkVadmNsTndjbVZoWkNBOUlHWmhiSE5sTzF4dUlDQjJZWElnZDJGeWJtVmtSbTl5UTNKbFlYUmxUV2w0YVc0Z1BTQm1ZV3h6WlR0Y2JpQWdYMTl6Y0hKbFlXUWdQU0JtZFc1amRHbHZiaUFvS1NCN1hHNGdJQ0FnYkc5M1VISnBiM0pwZEhsWFlYSnVhVzVuS0hkaGNtNWxaRVp2Y2xOd2NtVmhaQ3dnSjFKbFlXTjBMbDlmYzNCeVpXRmtJR2x6SUdSbGNISmxZMkYwWldRZ1lXNWtJSE5vYjNWc1pDQnViM1FnWW1VZ2RYTmxaQzRnVlhObElDY2dLeUFuVDJKcVpXTjBMbUZ6YzJsbmJpQmthWEpsWTNSc2VTQnZjaUJoYm05MGFHVnlJR2hsYkhCbGNpQm1kVzVqZEdsdmJpQjNhWFJvSUhOcGJXbHNZWElnSnlBcklDZHpaVzFoYm5ScFkzTXVJRmx2ZFNCdFlYa2dZbVVnYzJWbGFXNW5JSFJvYVhNZ2QyRnlibWx1WnlCa2RXVWdkRzhnZVc5MWNpQmpiMjF3YVd4bGNpNGdKeUFySUNkVFpXVWdhSFIwY0hNNkx5OW1ZaTV0WlM5eVpXRmpkQzF6Y0hKbFlXUXRaR1Z3Y21WallYUnBiMjRnWm05eUlHMXZjbVVnWkdWMFlXbHNjeTRuS1R0Y2JpQWdJQ0IzWVhKdVpXUkdiM0pUY0hKbFlXUWdQU0IwY25WbE8xeHVJQ0FnSUhKbGRIVnliaUJmWVhOemFXZHVMbUZ3Y0d4NUtHNTFiR3dzSUdGeVozVnRaVzUwY3lrN1hHNGdJSDA3WEc1Y2JpQWdZM0psWVhSbFRXbDRhVzRnUFNCbWRXNWpkR2x2YmlBb2JXbDRhVzRwSUh0Y2JpQWdJQ0JzYjNkUWNtbHZjbWwwZVZkaGNtNXBibWNvZDJGeWJtVmtSbTl5UTNKbFlYUmxUV2w0YVc0c0lDZFNaV0ZqZEM1amNtVmhkR1ZOYVhocGJpQnBjeUJrWlhCeVpXTmhkR1ZrSUdGdVpDQnphRzkxYkdRZ2JtOTBJR0psSUhWelpXUXVJQ2NnS3lBblNXNGdVbVZoWTNRZ2RqRTJMakFzSUdsMElIZHBiR3dnWW1VZ2NtVnRiM1psWkM0Z0p5QXJJQ2RaYjNVZ1kyRnVJSFZ6WlNCMGFHbHpJRzFwZUdsdUlHUnBjbVZqZEd4NUlHbHVjM1JsWVdRdUlDY2dLeUFuVTJWbElHaDBkSEJ6T2k4dlptSXViV1V2WTNKbFlYUmxiV2w0YVc0dGQyRnpMVzVsZG1WeUxXbHRjR3hsYldWdWRHVmtJR1p2Y2lCdGIzSmxJR2x1Wm04dUp5azdYRzRnSUNBZ2QyRnlibVZrUm05eVEzSmxZWFJsVFdsNGFXNGdQU0IwY25WbE8xeHVJQ0FnSUhKbGRIVnliaUJ0YVhocGJqdGNiaUFnZlR0Y2JuMWNibHh1ZG1GeUlGSmxZV04wSUQwZ2UxeHVJQ0F2THlCTmIyUmxjbTVjYmx4dUlDQkRhR2xzWkhKbGJqb2dlMXh1SUNBZ0lHMWhjRG9nVW1WaFkzUkRhR2xzWkhKbGJpNXRZWEFzWEc0Z0lDQWdabTl5UldGamFEb2dVbVZoWTNSRGFHbHNaSEpsYmk1bWIzSkZZV05vTEZ4dUlDQWdJR052ZFc1ME9pQlNaV0ZqZEVOb2FXeGtjbVZ1TG1OdmRXNTBMRnh1SUNBZ0lIUnZRWEp5WVhrNklGSmxZV04wUTJocGJHUnlaVzR1ZEc5QmNuSmhlU3hjYmlBZ0lDQnZibXg1T2lCdmJteDVRMmhwYkdSY2JpQWdmU3hjYmx4dUlDQkRiMjF3YjI1bGJuUTZJRkpsWVdOMFFtRnpaVU5zWVhOelpYTXVRMjl0Y0c5dVpXNTBMRnh1SUNCUWRYSmxRMjl0Y0c5dVpXNTBPaUJTWldGamRFSmhjMlZEYkdGemMyVnpMbEIxY21WRGIyMXdiMjVsYm5Rc1hHNWNiaUFnWTNKbFlYUmxSV3hsYldWdWREb2dZM0psWVhSbFJXeGxiV1Z1ZEN4Y2JpQWdZMnh2Ym1WRmJHVnRaVzUwT2lCamJHOXVaVVZzWlcxbGJuUXNYRzRnSUdselZtRnNhV1JGYkdWdFpXNTBPaUJTWldGamRFVnNaVzFsYm5RdWFYTldZV3hwWkVWc1pXMWxiblFzWEc1Y2JpQWdMeThnUTJ4aGMzTnBZMXh1WEc0Z0lGQnliM0JVZVhCbGN6b2dVbVZoWTNSUWNtOXdWSGx3WlhNc1hHNGdJR055WldGMFpVTnNZWE56T2lCamNtVmhkR1ZTWldGamRFTnNZWE56TEZ4dUlDQmpjbVZoZEdWR1lXTjBiM0o1T2lCamNtVmhkR1ZHWVdOMGIzSjVMRnh1SUNCamNtVmhkR1ZOYVhocGJqb2dZM0psWVhSbFRXbDRhVzRzWEc1Y2JpQWdMeThnVkdocGN5QnNiMjlyY3lCRVQwMGdjM0JsWTJsbWFXTWdZblYwSUhSb1pYTmxJR0Z5WlNCaFkzUjFZV3hzZVNCcGMyOXRiM0p3YUdsaklHaGxiSEJsY25OY2JpQWdMeThnYzJsdVkyVWdkR2hsZVNCaGNtVWdhblZ6ZENCblpXNWxjbUYwYVc1bklFUlBUU0J6ZEhKcGJtZHpMbHh1SUNCRVQwMDZJRkpsWVdOMFJFOU5SbUZqZEc5eWFXVnpMRnh1WEc0Z0lIWmxjbk5wYjI0NklGSmxZV04wVm1WeWMybHZiaXhjYmx4dUlDQXZMeUJFWlhCeVpXTmhkR1ZrSUdodmIyc2dabTl5SUVwVFdDQnpjSEpsWVdRc0lHUnZiaWQwSUhWelpTQjBhR2x6SUdadmNpQmhibmwwYUdsdVp5NWNiaUFnWDE5emNISmxZV1E2SUY5ZmMzQnlaV0ZrWEc1OU8xeHVYRzVwWmlBb2NISnZZMlZ6Y3k1bGJuWXVUazlFUlY5RlRsWWdJVDA5SUNkd2NtOWtkV04wYVc5dUp5a2dlMXh1SUNCMllYSWdkMkZ5Ym1Wa1JtOXlRM0psWVhSbFEyeGhjM01nUFNCbVlXeHpaVHRjYmlBZ2FXWWdLR05oYmtSbFptbHVaVkJ5YjNCbGNuUjVLU0I3WEc0Z0lDQWdUMkpxWldOMExtUmxabWx1WlZCeWIzQmxjblI1S0ZKbFlXTjBMQ0FuVUhKdmNGUjVjR1Z6Snl3Z2UxeHVJQ0FnSUNBZ1oyVjBPaUJtZFc1amRHbHZiaUFvS1NCN1hHNGdJQ0FnSUNBZ0lHeHZkMUJ5YVc5eWFYUjVWMkZ5Ym1sdVp5aGthV1JYWVhKdVVISnZjRlI1Y0dWelJHVndjbVZqWVhSbFpDd2dKMEZqWTJWemMybHVaeUJRY205d1ZIbHdaWE1nZG1saElIUm9aU0J0WVdsdUlGSmxZV04wSUhCaFkydGhaMlVnYVhNZ1pHVndjbVZqWVhSbFpDd25JQ3NnSnlCaGJtUWdkMmxzYkNCaVpTQnlaVzF2ZG1Wa0lHbHVJQ0JTWldGamRDQjJNVFl1TUM0bklDc2dKeUJWYzJVZ2RHaGxJR3hoZEdWemRDQmhkbUZwYkdGaWJHVWdkakUxTGlvZ2NISnZjQzEwZVhCbGN5QndZV05yWVdkbElHWnliMjBnYm5CdElHbHVjM1JsWVdRdUp5QXJJQ2NnUm05eUlHbHVabThnYjI0Z2RYTmhaMlVzSUdOdmJYQmhkR2xpYVd4cGRIa3NJRzFwWjNKaGRHbHZiaUJoYm1RZ2JXOXlaU3dnYzJWbElDY2dLeUFuYUhSMGNITTZMeTltWWk1dFpTOXdjbTl3TFhSNWNHVnpMV1J2WTNNbktUdGNiaUFnSUNBZ0lDQWdaR2xrVjJGeWJsQnliM0JVZVhCbGMwUmxjSEpsWTJGMFpXUWdQU0IwY25WbE8xeHVJQ0FnSUNBZ0lDQnlaWFIxY200Z1VtVmhZM1JRY205d1ZIbHdaWE03WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdmU2s3WEc1Y2JpQWdJQ0JQWW1wbFkzUXVaR1ZtYVc1bFVISnZjR1Z5ZEhrb1VtVmhZM1FzSUNkamNtVmhkR1ZEYkdGemN5Y3NJSHRjYmlBZ0lDQWdJR2RsZERvZ1puVnVZM1JwYjI0Z0tDa2dlMXh1SUNBZ0lDQWdJQ0JzYjNkUWNtbHZjbWwwZVZkaGNtNXBibWNvZDJGeWJtVmtSbTl5UTNKbFlYUmxRMnhoYzNNc0lDZEJZMk5sYzNOcGJtY2dZM0psWVhSbFEyeGhjM01nZG1saElIUm9aU0J0WVdsdUlGSmxZV04wSUhCaFkydGhaMlVnYVhNZ1pHVndjbVZqWVhSbFpDd25JQ3NnSnlCaGJtUWdkMmxzYkNCaVpTQnlaVzF2ZG1Wa0lHbHVJRkpsWVdOMElIWXhOaTR3TGljZ0t5QmNJaUJWYzJVZ1lTQndiR0ZwYmlCS1lYWmhVMk55YVhCMElHTnNZWE56SUdsdWMzUmxZV1F1SUVsbUlIbHZkU2R5WlNCdWIzUWdlV1YwSUZ3aUlDc2dKM0psWVdSNUlIUnZJRzFwWjNKaGRHVXNJR055WldGMFpTMXlaV0ZqZEMxamJHRnpjeUIyTVRVdUtpQnBjeUJoZG1GcGJHRmliR1VnSnlBcklDZHZiaUJ1Y0cwZ1lYTWdZU0IwWlcxd2IzSmhjbmtzSUdSeWIzQXRhVzRnY21Wd2JHRmpaVzFsYm5RdUlDY2dLeUFuUm05eUlHMXZjbVVnYVc1bWJ5QnpaV1VnYUhSMGNITTZMeTltWWk1dFpTOXlaV0ZqZEMxamNtVmhkR1V0WTJ4aGMzTW5LVHRjYmlBZ0lDQWdJQ0FnZDJGeWJtVmtSbTl5UTNKbFlYUmxRMnhoYzNNZ1BTQjBjblZsTzF4dUlDQWdJQ0FnSUNCeVpYUjFjbTRnWTNKbFlYUmxVbVZoWTNSRGJHRnpjenRjYmlBZ0lDQWdJSDFjYmlBZ0lDQjlLVHRjYmlBZ2ZWeHVYRzRnSUM4dklGSmxZV04wTGtSUFRTQm1ZV04wYjNKcFpYTWdZWEpsSUdSbGNISmxZMkYwWldRdUlGZHlZWEFnZEdobGMyVWdiV1YwYUc5a2N5QnpieUIwYUdGMFhHNGdJQzh2SUdsdWRtOWpZWFJwYjI1eklHOW1JSFJvWlNCU1pXRmpkQzVFVDAwZ2JtRnRaWE53WVdObElHRnVaQ0JoYkdWeWRDQjFjMlZ5Y3lCMGJ5QnpkMmwwWTJoY2JpQWdMeThnZEc4Z2RHaGxJR0J5WldGamRDMWtiMjB0Wm1GamRHOXlhV1Z6WUNCd1lXTnJZV2RsTGx4dUlDQlNaV0ZqZEM1RVQwMGdQU0I3ZlR0Y2JpQWdkbUZ5SUhkaGNtNWxaRVp2Y2taaFkzUnZjbWxsY3lBOUlHWmhiSE5sTzF4dUlDQlBZbXBsWTNRdWEyVjVjeWhTWldGamRFUlBUVVpoWTNSdmNtbGxjeWt1Wm05eVJXRmphQ2htZFc1amRHbHZiaUFvWm1GamRHOXllU2tnZTF4dUlDQWdJRkpsWVdOMExrUlBUVnRtWVdOMGIzSjVYU0E5SUdaMWJtTjBhVzl1SUNncElIdGNiaUFnSUNBZ0lHbG1JQ2doZDJGeWJtVmtSbTl5Um1GamRHOXlhV1Z6S1NCN1hHNGdJQ0FnSUNBZ0lHeHZkMUJ5YVc5eWFYUjVWMkZ5Ym1sdVp5aG1ZV3h6WlN3Z0owRmpZMlZ6YzJsdVp5Qm1ZV04wYjNKcFpYTWdiR2xyWlNCU1pXRmpkQzVFVDAwdUpYTWdhR0Z6SUdKbFpXNGdaR1Z3Y21WallYUmxaQ0FuSUNzZ0oyRnVaQ0IzYVd4c0lHSmxJSEpsYlc5MlpXUWdhVzRnZGpFMkxqQXJMaUJWYzJVZ2RHaGxJQ2NnS3lBbmNtVmhZM1F0Wkc5dExXWmhZM1J2Y21sbGN5QndZV05yWVdkbElHbHVjM1JsWVdRdUlDY2dLeUFuSUZabGNuTnBiMjRnTVM0d0lIQnliM1pwWkdWeklHRWdaSEp2Y0MxcGJpQnlaWEJzWVdObGJXVnVkQzRuSUNzZ0p5QkdiM0lnYlc5eVpTQnBibVp2TENCelpXVWdhSFIwY0hNNkx5OW1ZaTV0WlM5eVpXRmpkQzFrYjIwdFptRmpkRzl5YVdWekp5d2dabUZqZEc5eWVTazdYRzRnSUNBZ0lDQWdJSGRoY201bFpFWnZja1poWTNSdmNtbGxjeUE5SUhSeWRXVTdYRzRnSUNBZ0lDQjlYRzRnSUNBZ0lDQnlaWFIxY200Z1VtVmhZM1JFVDAxR1lXTjBiM0pwWlhOYlptRmpkRzl5ZVYwdVlYQndiSGtvVW1WaFkzUkVUMDFHWVdOMGIzSnBaWE1zSUdGeVozVnRaVzUwY3lrN1hHNGdJQ0FnZlR0Y2JpQWdmU2s3WEc1OVhHNWNibTF2WkhWc1pTNWxlSEJ2Y25SeklEMGdVbVZoWTNRN0lpd2lMeW9xWEc0Z0tpQkRiM0I1Y21sbmFIUWdNakF4TXkxd2NtVnpaVzUwTENCR1lXTmxZbTl2YXl3Z1NXNWpMbHh1SUNvZ1FXeHNJSEpwWjJoMGN5QnlaWE5sY25abFpDNWNiaUFxWEc0Z0tpQlVhR2x6SUhOdmRYSmpaU0JqYjJSbElHbHpJR3hwWTJWdWMyVmtJSFZ1WkdWeUlIUm9aU0JDVTBRdGMzUjViR1VnYkdsalpXNXpaU0JtYjNWdVpDQnBiaUIwYUdWY2JpQXFJRXhKUTBWT1UwVWdabWxzWlNCcGJpQjBhR1VnY205dmRDQmthWEpsWTNSdmNua2diMllnZEdocGN5QnpiM1Z5WTJVZ2RISmxaUzRnUVc0Z1lXUmthWFJwYjI1aGJDQm5jbUZ1ZEZ4dUlDb2diMllnY0dGMFpXNTBJSEpwWjJoMGN5QmpZVzRnWW1VZ1ptOTFibVFnYVc0Z2RHaGxJRkJCVkVWT1ZGTWdabWxzWlNCcGJpQjBhR1VnYzJGdFpTQmthWEpsWTNSdmNua3VYRzRnS2x4dUlDb3ZYRzVjYmlkMWMyVWdjM1J5YVdOMEp6dGNibHh1ZG1GeUlGOXdjbTlrU1c1MllYSnBZVzUwSUQwZ2NtVnhkV2x5WlNnbkxpOXlaV0ZqZEZCeWIyUkpiblpoY21saGJuUW5LU3hjYmlBZ0lDQmZZWE56YVdkdUlEMGdjbVZ4ZFdseVpTZ25iMkpxWldOMExXRnpjMmxuYmljcE8xeHVYRzUyWVhJZ1VtVmhZM1JPYjI5d1ZYQmtZWFJsVVhWbGRXVWdQU0J5WlhGMWFYSmxLQ2N1TDFKbFlXTjBUbTl2Y0ZWd1pHRjBaVkYxWlhWbEp5azdYRzVjYm5aaGNpQmpZVzVFWldacGJtVlFjbTl3WlhKMGVTQTlJSEpsY1hWcGNtVW9KeTR2WTJGdVJHVm1hVzVsVUhKdmNHVnlkSGtuS1R0Y2JuWmhjaUJsYlhCMGVVOWlhbVZqZENBOUlISmxjWFZwY21Vb0oyWmlhbk12YkdsaUwyVnRjSFI1VDJKcVpXTjBKeWs3WEc1MllYSWdhVzUyWVhKcFlXNTBJRDBnY21WeGRXbHlaU2duWm1KcWN5OXNhV0l2YVc1MllYSnBZVzUwSnlrN1hHNTJZWElnYkc5M1VISnBiM0pwZEhsWFlYSnVhVzVuSUQwZ2NtVnhkV2x5WlNnbkxpOXNiM2RRY21sdmNtbDBlVmRoY201cGJtY25LVHRjYmx4dUx5b3FYRzRnS2lCQ1lYTmxJR05zWVhOeklHaGxiSEJsY25NZ1ptOXlJSFJvWlNCMWNHUmhkR2x1WnlCemRHRjBaU0J2WmlCaElHTnZiWEJ2Ym1WdWRDNWNiaUFxTDF4dVpuVnVZM1JwYjI0Z1VtVmhZM1JEYjIxd2IyNWxiblFvY0hKdmNITXNJR052Ym5SbGVIUXNJSFZ3WkdGMFpYSXBJSHRjYmlBZ2RHaHBjeTV3Y205d2N5QTlJSEJ5YjNCek8xeHVJQ0IwYUdsekxtTnZiblJsZUhRZ1BTQmpiMjUwWlhoME8xeHVJQ0IwYUdsekxuSmxabk1nUFNCbGJYQjBlVTlpYW1WamREdGNiaUFnTHk4Z1YyVWdhVzVwZEdsaGJHbDZaU0IwYUdVZ1pHVm1ZWFZzZENCMWNHUmhkR1Z5SUdKMWRDQjBhR1VnY21WaGJDQnZibVVnWjJWMGN5QnBibXBsWTNSbFpDQmllU0IwYUdWY2JpQWdMeThnY21WdVpHVnlaWEl1WEc0Z0lIUm9hWE11ZFhCa1lYUmxjaUE5SUhWd1pHRjBaWElnZkh3Z1VtVmhZM1JPYjI5d1ZYQmtZWFJsVVhWbGRXVTdYRzU5WEc1Y2JsSmxZV04wUTI5dGNHOXVaVzUwTG5CeWIzUnZkSGx3WlM1cGMxSmxZV04wUTI5dGNHOXVaVzUwSUQwZ2UzMDdYRzVjYmk4cUtseHVJQ29nVTJWMGN5QmhJSE4xWW5ObGRDQnZaaUIwYUdVZ2MzUmhkR1V1SUVGc2QyRjVjeUIxYzJVZ2RHaHBjeUIwYnlCdGRYUmhkR1ZjYmlBcUlITjBZWFJsTGlCWmIzVWdjMmh2ZFd4a0lIUnlaV0YwSUdCMGFHbHpMbk4wWVhSbFlDQmhjeUJwYlcxMWRHRmliR1V1WEc0Z0tseHVJQ29nVkdobGNtVWdhWE1nYm04Z1ozVmhjbUZ1ZEdWbElIUm9ZWFFnWUhSb2FYTXVjM1JoZEdWZ0lIZHBiR3dnWW1VZ2FXMXRaV1JwWVhSbGJIa2dkWEJrWVhSbFpDd2djMjljYmlBcUlHRmpZMlZ6YzJsdVp5QmdkR2hwY3k1emRHRjBaV0FnWVdaMFpYSWdZMkZzYkdsdVp5QjBhR2x6SUcxbGRHaHZaQ0J0WVhrZ2NtVjBkWEp1SUhSb1pTQnZiR1FnZG1Gc2RXVXVYRzRnS2x4dUlDb2dWR2hsY21VZ2FYTWdibThnWjNWaGNtRnVkR1ZsSUhSb1lYUWdZMkZzYkhNZ2RHOGdZSE5sZEZOMFlYUmxZQ0IzYVd4c0lISjFiaUJ6ZVc1amFISnZibTkxYzJ4NUxGeHVJQ29nWVhNZ2RHaGxlU0J0WVhrZ1pYWmxiblIxWVd4c2VTQmlaU0JpWVhSamFHVmtJSFJ2WjJWMGFHVnlMaUFnV1c5MUlHTmhiaUJ3Y205MmFXUmxJR0Z1SUc5d2RHbHZibUZzWEc0Z0tpQmpZV3hzWW1GamF5QjBhR0YwSUhkcGJHd2dZbVVnWlhobFkzVjBaV1FnZDJobGJpQjBhR1VnWTJGc2JDQjBieUJ6WlhSVGRHRjBaU0JwY3lCaFkzUjFZV3hzZVZ4dUlDb2dZMjl0Y0d4bGRHVmtMbHh1SUNwY2JpQXFJRmRvWlc0Z1lTQm1kVzVqZEdsdmJpQnBjeUJ3Y205MmFXUmxaQ0IwYnlCelpYUlRkR0YwWlN3Z2FYUWdkMmxzYkNCaVpTQmpZV3hzWldRZ1lYUWdjMjl0WlNCd2IybHVkQ0JwYmx4dUlDb2dkR2hsSUdaMWRIVnlaU0FvYm05MElITjVibU5vY205dWIzVnpiSGtwTGlCSmRDQjNhV3hzSUdKbElHTmhiR3hsWkNCM2FYUm9JSFJvWlNCMWNDQjBieUJrWVhSbFhHNGdLaUJqYjIxd2IyNWxiblFnWVhKbmRXMWxiblJ6SUNoemRHRjBaU3dnY0hKdmNITXNJR052Ym5SbGVIUXBMaUJVYUdWelpTQjJZV3gxWlhNZ1kyRnVJR0psSUdScFptWmxjbVZ1ZEZ4dUlDb2dabkp2YlNCMGFHbHpMaW9nWW1WallYVnpaU0I1YjNWeUlHWjFibU4wYVc5dUlHMWhlU0JpWlNCallXeHNaV1FnWVdaMFpYSWdjbVZqWldsMlpWQnliM0J6SUdKMWRDQmlaV1p2Y21WY2JpQXFJSE5vYjNWc1pFTnZiWEJ2Ym1WdWRGVndaR0YwWlN3Z1lXNWtJSFJvYVhNZ2JtVjNJSE4wWVhSbExDQndjbTl3Y3l3Z1lXNWtJR052Ym5SbGVIUWdkMmxzYkNCdWIzUWdlV1YwSUdKbFhHNGdLaUJoYzNOcFoyNWxaQ0IwYnlCMGFHbHpMbHh1SUNwY2JpQXFJRUJ3WVhKaGJTQjdiMkpxWldOMGZHWjFibU4wYVc5dWZTQndZWEowYVdGc1UzUmhkR1VnVG1WNGRDQndZWEowYVdGc0lITjBZWFJsSUc5eUlHWjFibU4wYVc5dUlIUnZYRzRnS2lBZ0lDQWdJQ0FnY0hKdlpIVmpaU0J1WlhoMElIQmhjblJwWVd3Z2MzUmhkR1VnZEc4Z1ltVWdiV1Z5WjJWa0lIZHBkR2dnWTNWeWNtVnVkQ0J6ZEdGMFpTNWNiaUFxSUVCd1lYSmhiU0I3UDJaMWJtTjBhVzl1ZlNCallXeHNZbUZqYXlCRFlXeHNaV1FnWVdaMFpYSWdjM1JoZEdVZ2FYTWdkWEJrWVhSbFpDNWNiaUFxSUVCbWFXNWhiRnh1SUNvZ1FIQnliM1JsWTNSbFpGeHVJQ292WEc1U1pXRmpkRU52YlhCdmJtVnVkQzV3Y205MGIzUjVjR1V1YzJWMFUzUmhkR1VnUFNCbWRXNWpkR2x2YmlBb2NHRnlkR2xoYkZOMFlYUmxMQ0JqWVd4c1ltRmpheWtnZTF4dUlDQWhLSFI1Y0dWdlppQndZWEowYVdGc1UzUmhkR1VnUFQwOUlDZHZZbXBsWTNRbklIeDhJSFI1Y0dWdlppQndZWEowYVdGc1UzUmhkR1VnUFQwOUlDZG1kVzVqZEdsdmJpY2dmSHdnY0dGeWRHbGhiRk4wWVhSbElEMDlJRzUxYkd3cElEOGdjSEp2WTJWemN5NWxibll1VGs5RVJWOUZUbFlnSVQwOUlDZHdjbTlrZFdOMGFXOXVKeUEvSUdsdWRtRnlhV0Z1ZENobVlXeHpaU3dnSjNObGRGTjBZWFJsS0M0dUxpazZJSFJoYTJWeklHRnVJRzlpYW1WamRDQnZaaUJ6ZEdGMFpTQjJZWEpwWVdKc1pYTWdkRzhnZFhCa1lYUmxJRzl5SUdFZ1puVnVZM1JwYjI0Z2QyaHBZMmdnY21WMGRYSnVjeUJoYmlCdlltcGxZM1FnYjJZZ2MzUmhkR1VnZG1GeWFXRmliR1Z6TGljcElEb2dYM0J5YjJSSmJuWmhjbWxoYm5Rb0p6ZzFKeWtnT2lCMmIybGtJREE3WEc0Z0lIUm9hWE11ZFhCa1lYUmxjaTVsYm5GMVpYVmxVMlYwVTNSaGRHVW9kR2hwY3l3Z2NHRnlkR2xoYkZOMFlYUmxLVHRjYmlBZ2FXWWdLR05oYkd4aVlXTnJLU0I3WEc0Z0lDQWdkR2hwY3k1MWNHUmhkR1Z5TG1WdWNYVmxkV1ZEWVd4c1ltRmpheWgwYUdsekxDQmpZV3hzWW1GamF5d2dKM05sZEZOMFlYUmxKeWs3WEc0Z0lIMWNibjA3WEc1Y2JpOHFLbHh1SUNvZ1JtOXlZMlZ6SUdGdUlIVndaR0YwWlM0Z1ZHaHBjeUJ6YUc5MWJHUWdiMjVzZVNCaVpTQnBiblp2YTJWa0lIZG9aVzRnYVhRZ2FYTWdhMjV2ZDI0Z2QybDBhRnh1SUNvZ1kyVnlkR0ZwYm5SNUlIUm9ZWFFnZDJVZ1lYSmxJQ29xYm05MEtpb2dhVzRnWVNCRVQwMGdkSEpoYm5OaFkzUnBiMjR1WEc0Z0tseHVJQ29nV1c5MUlHMWhlU0IzWVc1MElIUnZJR05oYkd3Z2RHaHBjeUIzYUdWdUlIbHZkU0JyYm05M0lIUm9ZWFFnYzI5dFpTQmtaV1Z3WlhJZ1lYTndaV04wSUc5bUlIUm9aVnh1SUNvZ1kyOXRjRzl1Wlc1MEozTWdjM1JoZEdVZ2FHRnpJR05vWVc1blpXUWdZblYwSUdCelpYUlRkR0YwWldBZ2QyRnpJRzV2ZENCallXeHNaV1F1WEc0Z0tseHVJQ29nVkdocGN5QjNhV3hzSUc1dmRDQnBiblp2YTJVZ1lITm9iM1ZzWkVOdmJYQnZibVZ1ZEZWd1pHRjBaV0FzSUdKMWRDQnBkQ0IzYVd4c0lHbHVkbTlyWlZ4dUlDb2dZR052YlhCdmJtVnVkRmRwYkd4VmNHUmhkR1ZnSUdGdVpDQmdZMjl0Y0c5dVpXNTBSR2xrVlhCa1lYUmxZQzVjYmlBcVhHNGdLaUJBY0dGeVlXMGdlejltZFc1amRHbHZibjBnWTJGc2JHSmhZMnNnUTJGc2JHVmtJR0ZtZEdWeUlIVndaR0YwWlNCcGN5QmpiMjF3YkdWMFpTNWNiaUFxSUVCbWFXNWhiRnh1SUNvZ1FIQnliM1JsWTNSbFpGeHVJQ292WEc1U1pXRmpkRU52YlhCdmJtVnVkQzV3Y205MGIzUjVjR1V1Wm05eVkyVlZjR1JoZEdVZ1BTQm1kVzVqZEdsdmJpQW9ZMkZzYkdKaFkyc3BJSHRjYmlBZ2RHaHBjeTUxY0dSaGRHVnlMbVZ1Y1hWbGRXVkdiM0pqWlZWd1pHRjBaU2gwYUdsektUdGNiaUFnYVdZZ0tHTmhiR3hpWVdOcktTQjdYRzRnSUNBZ2RHaHBjeTUxY0dSaGRHVnlMbVZ1Y1hWbGRXVkRZV3hzWW1GamF5aDBhR2x6TENCallXeHNZbUZqYXl3Z0oyWnZjbU5sVlhCa1lYUmxKeWs3WEc0Z0lIMWNibjA3WEc1Y2JpOHFLbHh1SUNvZ1JHVndjbVZqWVhSbFpDQkJVRWx6TGlCVWFHVnpaU0JCVUVseklIVnpaV1FnZEc4Z1pYaHBjM1FnYjI0Z1kyeGhjM05wWXlCU1pXRmpkQ0JqYkdGemMyVnpJR0oxZENCemFXNWpaVnh1SUNvZ2QyVWdkMjkxYkdRZ2JHbHJaU0IwYnlCa1pYQnlaV05oZEdVZ2RHaGxiU3dnZDJVbmNtVWdibTkwSUdkdmFXNW5JSFJ2SUcxdmRtVWdkR2hsYlNCdmRtVnlJSFJ2SUhSb2FYTmNiaUFxSUcxdlpHVnliaUJpWVhObElHTnNZWE56TGlCSmJuTjBaV0ZrTENCM1pTQmtaV1pwYm1VZ1lTQm5aWFIwWlhJZ2RHaGhkQ0IzWVhKdWN5QnBaaUJwZENkeklHRmpZMlZ6YzJWa0xseHVJQ292WEc1cFppQW9jSEp2WTJWemN5NWxibll1VGs5RVJWOUZUbFlnSVQwOUlDZHdjbTlrZFdOMGFXOXVKeWtnZTF4dUlDQjJZWElnWkdWd2NtVmpZWFJsWkVGUVNYTWdQU0I3WEc0Z0lDQWdhWE5OYjNWdWRHVmtPaUJiSjJselRXOTFiblJsWkNjc0lDZEpibk4wWldGa0xDQnRZV3RsSUhOMWNtVWdkRzhnWTJ4bFlXNGdkWEFnYzNWaWMyTnlhWEIwYVc5dWN5QmhibVFnY0dWdVpHbHVaeUJ5WlhGMVpYTjBjeUJwYmlBbklDc2dKMk52YlhCdmJtVnVkRmRwYkd4VmJtMXZkVzUwSUhSdklIQnlaWFpsYm5RZ2JXVnRiM0o1SUd4bFlXdHpMaWRkTEZ4dUlDQWdJSEpsY0d4aFkyVlRkR0YwWlRvZ1d5ZHlaWEJzWVdObFUzUmhkR1VuTENBblVtVm1ZV04wYjNJZ2VXOTFjaUJqYjJSbElIUnZJSFZ6WlNCelpYUlRkR0YwWlNCcGJuTjBaV0ZrSUNoelpXVWdKeUFySUNkb2RIUndjem92TDJkcGRHaDFZaTVqYjIwdlptRmpaV0p2YjJzdmNtVmhZM1F2YVhOemRXVnpMek15TXpZcExpZGRYRzRnSUgwN1hHNGdJSFpoY2lCa1pXWnBibVZFWlhCeVpXTmhkR2x2YmxkaGNtNXBibWNnUFNCbWRXNWpkR2x2YmlBb2JXVjBhRzlrVG1GdFpTd2dhVzVtYnlrZ2UxeHVJQ0FnSUdsbUlDaGpZVzVFWldacGJtVlFjbTl3WlhKMGVTa2dlMXh1SUNBZ0lDQWdUMkpxWldOMExtUmxabWx1WlZCeWIzQmxjblI1S0ZKbFlXTjBRMjl0Y0c5dVpXNTBMbkJ5YjNSdmRIbHdaU3dnYldWMGFHOWtUbUZ0WlN3Z2UxeHVJQ0FnSUNBZ0lDQm5aWFE2SUdaMWJtTjBhVzl1SUNncElIdGNiaUFnSUNBZ0lDQWdJQ0JzYjNkUWNtbHZjbWwwZVZkaGNtNXBibWNvWm1Gc2MyVXNJQ2NsY3lndUxpNHBJR2x6SUdSbGNISmxZMkYwWldRZ2FXNGdjR3hoYVc0Z1NtRjJZVk5qY21sd2RDQlNaV0ZqZENCamJHRnpjMlZ6TGlBbGN5Y3NJR2x1Wm05Yk1GMHNJR2x1Wm05Yk1WMHBPMXh1SUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUIxYm1SbFptbHVaV1E3WEc0Z0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUgwcE8xeHVJQ0FnSUgxY2JpQWdmVHRjYmlBZ1ptOXlJQ2gyWVhJZ1ptNU9ZVzFsSUdsdUlHUmxjSEpsWTJGMFpXUkJVRWx6S1NCN1hHNGdJQ0FnYVdZZ0tHUmxjSEpsWTJGMFpXUkJVRWx6TG1oaGMwOTNibEJ5YjNCbGNuUjVLR1p1VG1GdFpTa3BJSHRjYmlBZ0lDQWdJR1JsWm1sdVpVUmxjSEpsWTJGMGFXOXVWMkZ5Ym1sdVp5aG1iazVoYldVc0lHUmxjSEpsWTJGMFpXUkJVRWx6VzJadVRtRnRaVjBwTzF4dUlDQWdJSDFjYmlBZ2ZWeHVmVnh1WEc0dktpcGNiaUFxSUVKaGMyVWdZMnhoYzNNZ2FHVnNjR1Z5Y3lCbWIzSWdkR2hsSUhWd1pHRjBhVzVuSUhOMFlYUmxJRzltSUdFZ1kyOXRjRzl1Wlc1MExseHVJQ292WEc1bWRXNWpkR2x2YmlCU1pXRmpkRkIxY21WRGIyMXdiMjVsYm5Rb2NISnZjSE1zSUdOdmJuUmxlSFFzSUhWd1pHRjBaWElwSUh0Y2JpQWdMeThnUkhWd2JHbGpZWFJsWkNCbWNtOXRJRkpsWVdOMFEyOXRjRzl1Wlc1MExseHVJQ0IwYUdsekxuQnliM0J6SUQwZ2NISnZjSE03WEc0Z0lIUm9hWE11WTI5dWRHVjRkQ0E5SUdOdmJuUmxlSFE3WEc0Z0lIUm9hWE11Y21WbWN5QTlJR1Z0Y0hSNVQySnFaV04wTzF4dUlDQXZMeUJYWlNCcGJtbDBhV0ZzYVhwbElIUm9aU0JrWldaaGRXeDBJSFZ3WkdGMFpYSWdZblYwSUhSb1pTQnlaV0ZzSUc5dVpTQm5aWFJ6SUdsdWFtVmpkR1ZrSUdKNUlIUm9aVnh1SUNBdkx5QnlaVzVrWlhKbGNpNWNiaUFnZEdocGN5NTFjR1JoZEdWeUlEMGdkWEJrWVhSbGNpQjhmQ0JTWldGamRFNXZiM0JWY0dSaGRHVlJkV1YxWlR0Y2JuMWNibHh1Wm5WdVkzUnBiMjRnUTI5dGNHOXVaVzUwUkhWdGJYa29LU0I3ZlZ4dVEyOXRjRzl1Wlc1MFJIVnRiWGt1Y0hKdmRHOTBlWEJsSUQwZ1VtVmhZM1JEYjIxd2IyNWxiblF1Y0hKdmRHOTBlWEJsTzF4dVVtVmhZM1JRZFhKbFEyOXRjRzl1Wlc1MExuQnliM1J2ZEhsd1pTQTlJRzVsZHlCRGIyMXdiMjVsYm5SRWRXMXRlU2dwTzF4dVVtVmhZM1JRZFhKbFEyOXRjRzl1Wlc1MExuQnliM1J2ZEhsd1pTNWpiMjV6ZEhKMVkzUnZjaUE5SUZKbFlXTjBVSFZ5WlVOdmJYQnZibVZ1ZER0Y2JpOHZJRUYyYjJsa0lHRnVJR1Y0ZEhKaElIQnliM1J2ZEhsd1pTQnFkVzF3SUdadmNpQjBhR1Z6WlNCdFpYUm9iMlJ6TGx4dVgyRnpjMmxuYmloU1pXRmpkRkIxY21WRGIyMXdiMjVsYm5RdWNISnZkRzkwZVhCbExDQlNaV0ZqZEVOdmJYQnZibVZ1ZEM1d2NtOTBiM1I1Y0dVcE8xeHVVbVZoWTNSUWRYSmxRMjl0Y0c5dVpXNTBMbkJ5YjNSdmRIbHdaUzVwYzFCMWNtVlNaV0ZqZEVOdmJYQnZibVZ1ZENBOUlIUnlkV1U3WEc1Y2JtMXZaSFZzWlM1bGVIQnZjblJ6SUQwZ2UxeHVJQ0JEYjIxd2IyNWxiblE2SUZKbFlXTjBRMjl0Y0c5dVpXNTBMRnh1SUNCUWRYSmxRMjl0Y0c5dVpXNTBPaUJTWldGamRGQjFjbVZEYjIxd2IyNWxiblJjYm4wN0lpd2lMeW9xWEc0Z0tpQkRiM0I1Y21sbmFIUWdNakF4TXkxd2NtVnpaVzUwTENCR1lXTmxZbTl2YXl3Z1NXNWpMbHh1SUNvZ1FXeHNJSEpwWjJoMGN5QnlaWE5sY25abFpDNWNiaUFxWEc0Z0tpQlVhR2x6SUhOdmRYSmpaU0JqYjJSbElHbHpJR3hwWTJWdWMyVmtJSFZ1WkdWeUlIUm9aU0JDVTBRdGMzUjViR1VnYkdsalpXNXpaU0JtYjNWdVpDQnBiaUIwYUdWY2JpQXFJRXhKUTBWT1UwVWdabWxzWlNCcGJpQjBhR1VnY205dmRDQmthWEpsWTNSdmNua2diMllnZEdocGN5QnpiM1Z5WTJVZ2RISmxaUzRnUVc0Z1lXUmthWFJwYjI1aGJDQm5jbUZ1ZEZ4dUlDb2diMllnY0dGMFpXNTBJSEpwWjJoMGN5QmpZVzRnWW1VZ1ptOTFibVFnYVc0Z2RHaGxJRkJCVkVWT1ZGTWdabWxzWlNCcGJpQjBhR1VnYzJGdFpTQmthWEpsWTNSdmNua3VYRzRnS2x4dUlDb3ZYRzVjYmlkMWMyVWdjM1J5YVdOMEp6dGNibHh1ZG1GeUlGQnZiMnhsWkVOc1lYTnpJRDBnY21WeGRXbHlaU2duTGk5UWIyOXNaV1JEYkdGemN5Y3BPMXh1ZG1GeUlGSmxZV04wUld4bGJXVnVkQ0E5SUhKbGNYVnBjbVVvSnk0dlVtVmhZM1JGYkdWdFpXNTBKeWs3WEc1Y2JuWmhjaUJsYlhCMGVVWjFibU4wYVc5dUlEMGdjbVZ4ZFdseVpTZ25abUpxY3k5c2FXSXZaVzF3ZEhsR2RXNWpkR2x2YmljcE8xeHVkbUZ5SUhSeVlYWmxjbk5sUVd4c1EyaHBiR1J5Wlc0Z1BTQnlaWEYxYVhKbEtDY3VMM1J5WVhabGNuTmxRV3hzUTJocGJHUnlaVzRuS1R0Y2JseHVkbUZ5SUhSM2IwRnlaM1Z0Wlc1MFVHOXZiR1Z5SUQwZ1VHOXZiR1ZrUTJ4aGMzTXVkSGR2UVhKbmRXMWxiblJRYjI5c1pYSTdYRzUyWVhJZ1ptOTFja0Z5WjNWdFpXNTBVRzl2YkdWeUlEMGdVRzl2YkdWa1EyeGhjM011Wm05MWNrRnlaM1Z0Wlc1MFVHOXZiR1Z5TzF4dVhHNTJZWElnZFhObGNsQnliM1pwWkdWa1MyVjVSWE5qWVhCbFVtVm5aWGdnUFNBdlhGd3ZLeTluTzF4dVpuVnVZM1JwYjI0Z1pYTmpZWEJsVlhObGNsQnliM1pwWkdWa1MyVjVLSFJsZUhRcElIdGNiaUFnY21WMGRYSnVJQ2duSnlBcklIUmxlSFFwTG5KbGNHeGhZMlVvZFhObGNsQnliM1pwWkdWa1MyVjVSWE5qWVhCbFVtVm5aWGdzSUNja0ppOG5LVHRjYm4xY2JseHVMeW9xWEc0Z0tpQlFiMjlzWldSRGJHRnpjeUJ5WlhCeVpYTmxiblJwYm1jZ2RHaGxJR0p2YjJ0clpXVndhVzVuSUdGemMyOWphV0YwWldRZ2QybDBhQ0J3WlhKbWIzSnRhVzVuSUdFZ1kyaHBiR1JjYmlBcUlIUnlZWFpsY25OaGJDNGdRV3hzYjNkeklHRjJiMmxrYVc1bklHSnBibVJwYm1jZ1kyRnNiR0poWTJ0ekxseHVJQ3BjYmlBcUlFQmpiMjV6ZEhKMVkzUnZjaUJHYjNKRllXTm9RbTl2YTB0bFpYQnBibWRjYmlBcUlFQndZWEpoYlNCN0lXWjFibU4wYVc5dWZTQm1iM0pGWVdOb1JuVnVZM1JwYjI0Z1JuVnVZM1JwYjI0Z2RHOGdjR1Z5Wm05eWJTQjBjbUYyWlhKellXd2dkMmwwYUM1Y2JpQXFJRUJ3WVhKaGJTQjdQeXA5SUdadmNrVmhZMmhEYjI1MFpYaDBJRU52Ym5SbGVIUWdkRzhnY0dWeVptOXliU0JqYjI1MFpYaDBJSGRwZEdndVhHNGdLaTljYm1aMWJtTjBhVzl1SUVadmNrVmhZMmhDYjI5clMyVmxjR2x1WnlobWIzSkZZV05vUm5WdVkzUnBiMjRzSUdadmNrVmhZMmhEYjI1MFpYaDBLU0I3WEc0Z0lIUm9hWE11Wm5WdVl5QTlJR1p2Y2tWaFkyaEdkVzVqZEdsdmJqdGNiaUFnZEdocGN5NWpiMjUwWlhoMElEMGdabTl5UldGamFFTnZiblJsZUhRN1hHNGdJSFJvYVhNdVkyOTFiblFnUFNBd08xeHVmVnh1Um05eVJXRmphRUp2YjJ0TFpXVndhVzVuTG5CeWIzUnZkSGx3WlM1a1pYTjBjblZqZEc5eUlEMGdablZ1WTNScGIyNGdLQ2tnZTF4dUlDQjBhR2x6TG1aMWJtTWdQU0J1ZFd4c08xeHVJQ0IwYUdsekxtTnZiblJsZUhRZ1BTQnVkV3hzTzF4dUlDQjBhR2x6TG1OdmRXNTBJRDBnTUR0Y2JuMDdYRzVRYjI5c1pXUkRiR0Z6Y3k1aFpHUlFiMjlzYVc1blZHOG9SbTl5UldGamFFSnZiMnRMWldWd2FXNW5MQ0IwZDI5QmNtZDFiV1Z1ZEZCdmIyeGxjaWs3WEc1Y2JtWjFibU4wYVc5dUlHWnZja1ZoWTJoVGFXNW5iR1ZEYUdsc1pDaGliMjlyUzJWbGNHbHVaeXdnWTJocGJHUXNJRzVoYldVcElIdGNiaUFnZG1GeUlHWjFibU1nUFNCaWIyOXJTMlZsY0dsdVp5NW1kVzVqTEZ4dUlDQWdJQ0FnWTI5dWRHVjRkQ0E5SUdKdmIydExaV1Z3YVc1bkxtTnZiblJsZUhRN1hHNWNiaUFnWm5WdVl5NWpZV3hzS0dOdmJuUmxlSFFzSUdOb2FXeGtMQ0JpYjI5clMyVmxjR2x1Wnk1amIzVnVkQ3NyS1R0Y2JuMWNibHh1THlvcVhHNGdLaUJKZEdWeVlYUmxjeUIwYUhKdmRXZG9JR05vYVd4a2NtVnVJSFJvWVhRZ1lYSmxJSFI1Y0dsallXeHNlU0J6Y0dWamFXWnBaV1FnWVhNZ1lIQnliM0J6TG1Ob2FXeGtjbVZ1WUM1Y2JpQXFYRzRnS2lCVFpXVWdhSFIwY0hNNkx5OW1ZV05sWW05dmF5NW5hWFJvZFdJdWFXOHZjbVZoWTNRdlpHOWpjeTkwYjNBdGJHVjJaV3d0WVhCcExtaDBiV3dqY21WaFkzUXVZMmhwYkdSeVpXNHVabTl5WldGamFGeHVJQ3BjYmlBcUlGUm9aU0J3Y205MmFXUmxaQ0JtYjNKRllXTm9SblZ1WXloamFHbHNaQ3dnYVc1a1pYZ3BJSGRwYkd3Z1ltVWdZMkZzYkdWa0lHWnZjaUJsWVdOb1hHNGdLaUJzWldGbUlHTm9hV3hrTGx4dUlDcGNiaUFxSUVCd1lYSmhiU0I3UHlwOUlHTm9hV3hrY21WdUlFTm9hV3hrY21WdUlIUnlaV1VnWTI5dWRHRnBibVZ5TGx4dUlDb2dRSEJoY21GdElIdG1kVzVqZEdsdmJpZ3FMQ0JwYm5RcGZTQm1iM0pGWVdOb1JuVnVZMXh1SUNvZ1FIQmhjbUZ0SUhzcWZTQm1iM0pGWVdOb1EyOXVkR1Y0ZENCRGIyNTBaWGgwSUdadmNpQm1iM0pGWVdOb1EyOXVkR1Y0ZEM1Y2JpQXFMMXh1Wm5WdVkzUnBiMjRnWm05eVJXRmphRU5vYVd4a2NtVnVLR05vYVd4a2NtVnVMQ0JtYjNKRllXTm9SblZ1WXl3Z1ptOXlSV0ZqYUVOdmJuUmxlSFFwSUh0Y2JpQWdhV1lnS0dOb2FXeGtjbVZ1SUQwOUlHNTFiR3dwSUh0Y2JpQWdJQ0J5WlhSMWNtNGdZMmhwYkdSeVpXNDdYRzRnSUgxY2JpQWdkbUZ5SUhSeVlYWmxjbk5sUTI5dWRHVjRkQ0E5SUVadmNrVmhZMmhDYjI5clMyVmxjR2x1Wnk1blpYUlFiMjlzWldRb1ptOXlSV0ZqYUVaMWJtTXNJR1p2Y2tWaFkyaERiMjUwWlhoMEtUdGNiaUFnZEhKaGRtVnljMlZCYkd4RGFHbHNaSEpsYmloamFHbHNaSEpsYml3Z1ptOXlSV0ZqYUZOcGJtZHNaVU5vYVd4a0xDQjBjbUYyWlhKelpVTnZiblJsZUhRcE8xeHVJQ0JHYjNKRllXTm9RbTl2YTB0bFpYQnBibWN1Y21Wc1pXRnpaU2gwY21GMlpYSnpaVU52Ym5SbGVIUXBPMXh1ZlZ4dVhHNHZLaXBjYmlBcUlGQnZiMnhsWkVOc1lYTnpJSEpsY0hKbGMyVnVkR2x1WnlCMGFHVWdZbTl2YTJ0bFpYQnBibWNnWVhOemIyTnBZWFJsWkNCM2FYUm9JSEJsY21admNtMXBibWNnWVNCamFHbHNaRnh1SUNvZ2JXRndjR2x1Wnk0Z1FXeHNiM2R6SUdGMmIybGthVzVuSUdKcGJtUnBibWNnWTJGc2JHSmhZMnR6TGx4dUlDcGNiaUFxSUVCamIyNXpkSEoxWTNSdmNpQk5ZWEJDYjI5clMyVmxjR2x1WjF4dUlDb2dRSEJoY21GdElIc2hLbjBnYldGd1VtVnpkV3gwSUU5aWFtVmpkQ0JqYjI1MFlXbHVhVzVuSUhSb1pTQnZjbVJsY21Wa0lHMWhjQ0J2WmlCeVpYTjFiSFJ6TGx4dUlDb2dRSEJoY21GdElIc2hablZ1WTNScGIyNTlJRzFoY0VaMWJtTjBhVzl1SUVaMWJtTjBhVzl1SUhSdklIQmxjbVp2Y20wZ2JXRndjR2x1WnlCM2FYUm9MbHh1SUNvZ1FIQmhjbUZ0SUhzL0tuMGdiV0Z3UTI5dWRHVjRkQ0JEYjI1MFpYaDBJSFJ2SUhCbGNtWnZjbTBnYldGd2NHbHVaeUIzYVhSb0xseHVJQ292WEc1bWRXNWpkR2x2YmlCTllYQkNiMjlyUzJWbGNHbHVaeWh0WVhCU1pYTjFiSFFzSUd0bGVWQnlaV1pwZUN3Z2JXRndSblZ1WTNScGIyNHNJRzFoY0VOdmJuUmxlSFFwSUh0Y2JpQWdkR2hwY3k1eVpYTjFiSFFnUFNCdFlYQlNaWE4xYkhRN1hHNGdJSFJvYVhNdWEyVjVVSEpsWm1sNElEMGdhMlY1VUhKbFptbDRPMXh1SUNCMGFHbHpMbVoxYm1NZ1BTQnRZWEJHZFc1amRHbHZianRjYmlBZ2RHaHBjeTVqYjI1MFpYaDBJRDBnYldGd1EyOXVkR1Y0ZER0Y2JpQWdkR2hwY3k1amIzVnVkQ0E5SURBN1hHNTlYRzVOWVhCQ2IyOXJTMlZsY0dsdVp5NXdjbTkwYjNSNWNHVXVaR1Z6ZEhKMVkzUnZjaUE5SUdaMWJtTjBhVzl1SUNncElIdGNiaUFnZEdocGN5NXlaWE4xYkhRZ1BTQnVkV3hzTzF4dUlDQjBhR2x6TG10bGVWQnlaV1pwZUNBOUlHNTFiR3c3WEc0Z0lIUm9hWE11Wm5WdVl5QTlJRzUxYkd3N1hHNGdJSFJvYVhNdVkyOXVkR1Y0ZENBOUlHNTFiR3c3WEc0Z0lIUm9hWE11WTI5MWJuUWdQU0F3TzF4dWZUdGNibEJ2YjJ4bFpFTnNZWE56TG1Ga1pGQnZiMnhwYm1kVWJ5aE5ZWEJDYjI5clMyVmxjR2x1Wnl3Z1ptOTFja0Z5WjNWdFpXNTBVRzl2YkdWeUtUdGNibHh1Wm5WdVkzUnBiMjRnYldGd1UybHVaMnhsUTJocGJHUkpiblJ2UTI5dWRHVjRkQ2hpYjI5clMyVmxjR2x1Wnl3Z1kyaHBiR1FzSUdOb2FXeGtTMlY1S1NCN1hHNGdJSFpoY2lCeVpYTjFiSFFnUFNCaWIyOXJTMlZsY0dsdVp5NXlaWE4xYkhRc1hHNGdJQ0FnSUNCclpYbFFjbVZtYVhnZ1BTQmliMjlyUzJWbGNHbHVaeTVyWlhsUWNtVm1hWGdzWEc0Z0lDQWdJQ0JtZFc1aklEMGdZbTl2YTB0bFpYQnBibWN1Wm5WdVl5eGNiaUFnSUNBZ0lHTnZiblJsZUhRZ1BTQmliMjlyUzJWbGNHbHVaeTVqYjI1MFpYaDBPMXh1WEc1Y2JpQWdkbUZ5SUcxaGNIQmxaRU5vYVd4a0lEMGdablZ1WXk1allXeHNLR052Ym5SbGVIUXNJR05vYVd4a0xDQmliMjlyUzJWbGNHbHVaeTVqYjNWdWRDc3JLVHRjYmlBZ2FXWWdLRUZ5Y21GNUxtbHpRWEp5WVhrb2JXRndjR1ZrUTJocGJHUXBLU0I3WEc0Z0lDQWdiV0Z3U1c1MGIxZHBkR2hMWlhsUWNtVm1hWGhKYm5SbGNtNWhiQ2h0WVhCd1pXUkRhR2xzWkN3Z2NtVnpkV3gwTENCamFHbHNaRXRsZVN3Z1pXMXdkSGxHZFc1amRHbHZiaTUwYUdGMFVtVjBkWEp1YzBGeVozVnRaVzUwS1R0Y2JpQWdmU0JsYkhObElHbG1JQ2h0WVhCd1pXUkRhR2xzWkNBaFBTQnVkV3hzS1NCN1hHNGdJQ0FnYVdZZ0tGSmxZV04wUld4bGJXVnVkQzVwYzFaaGJHbGtSV3hsYldWdWRDaHRZWEJ3WldSRGFHbHNaQ2twSUh0Y2JpQWdJQ0FnSUcxaGNIQmxaRU5vYVd4a0lEMGdVbVZoWTNSRmJHVnRaVzUwTG1Oc2IyNWxRVzVrVW1Wd2JHRmpaVXRsZVNodFlYQndaV1JEYUdsc1pDeGNiaUFnSUNBZ0lDOHZJRXRsWlhBZ1ltOTBhQ0IwYUdVZ0tHMWhjSEJsWkNrZ1lXNWtJRzlzWkNCclpYbHpJR2xtSUhSb1pYa2daR2xtWm1WeUxDQnFkWE4wSUdGelhHNGdJQ0FnSUNBdkx5QjBjbUYyWlhKelpVRnNiRU5vYVd4a2NtVnVJSFZ6WldRZ2RHOGdaRzhnWm05eUlHOWlhbVZqZEhNZ1lYTWdZMmhwYkdSeVpXNWNiaUFnSUNBZ0lHdGxlVkJ5WldacGVDQXJJQ2h0WVhCd1pXUkRhR2xzWkM1clpYa2dKaVlnS0NGamFHbHNaQ0I4ZkNCamFHbHNaQzVyWlhrZ0lUMDlJRzFoY0hCbFpFTm9hV3hrTG10bGVTa2dQeUJsYzJOaGNHVlZjMlZ5VUhKdmRtbGtaV1JMWlhrb2JXRndjR1ZrUTJocGJHUXVhMlY1S1NBcklDY3ZKeUE2SUNjbktTQXJJR05vYVd4a1MyVjVLVHRjYmlBZ0lDQjlYRzRnSUNBZ2NtVnpkV3gwTG5CMWMyZ29iV0Z3Y0dWa1EyaHBiR1FwTzF4dUlDQjlYRzU5WEc1Y2JtWjFibU4wYVc5dUlHMWhjRWx1ZEc5WGFYUm9TMlY1VUhKbFptbDRTVzUwWlhKdVlXd29ZMmhwYkdSeVpXNHNJR0Z5Y21GNUxDQndjbVZtYVhnc0lHWjFibU1zSUdOdmJuUmxlSFFwSUh0Y2JpQWdkbUZ5SUdWelkyRndaV1JRY21WbWFYZ2dQU0FuSnp0Y2JpQWdhV1lnS0hCeVpXWnBlQ0FoUFNCdWRXeHNLU0I3WEc0Z0lDQWdaWE5qWVhCbFpGQnlaV1pwZUNBOUlHVnpZMkZ3WlZWelpYSlFjbTkyYVdSbFpFdGxlU2h3Y21WbWFYZ3BJQ3NnSnk4bk8xeHVJQ0I5WEc0Z0lIWmhjaUIwY21GMlpYSnpaVU52Ym5SbGVIUWdQU0JOWVhCQ2IyOXJTMlZsY0dsdVp5NW5aWFJRYjI5c1pXUW9ZWEp5WVhrc0lHVnpZMkZ3WldSUWNtVm1hWGdzSUdaMWJtTXNJR052Ym5SbGVIUXBPMXh1SUNCMGNtRjJaWEp6WlVGc2JFTm9hV3hrY21WdUtHTm9hV3hrY21WdUxDQnRZWEJUYVc1bmJHVkRhR2xzWkVsdWRHOURiMjUwWlhoMExDQjBjbUYyWlhKelpVTnZiblJsZUhRcE8xeHVJQ0JOWVhCQ2IyOXJTMlZsY0dsdVp5NXlaV3hsWVhObEtIUnlZWFpsY25ObFEyOXVkR1Y0ZENrN1hHNTlYRzVjYmk4cUtseHVJQ29nVFdGd2N5QmphR2xzWkhKbGJpQjBhR0YwSUdGeVpTQjBlWEJwWTJGc2JIa2djM0JsWTJsbWFXVmtJR0Z6SUdCd2NtOXdjeTVqYUdsc1pISmxibUF1WEc0Z0tseHVJQ29nVTJWbElHaDBkSEJ6T2k4dlptRmpaV0p2YjJzdVoybDBhSFZpTG1sdkwzSmxZV04wTDJSdlkzTXZkRzl3TFd4bGRtVnNMV0Z3YVM1b2RHMXNJM0psWVdOMExtTm9hV3hrY21WdUxtMWhjRnh1SUNwY2JpQXFJRlJvWlNCd2NtOTJhV1JsWkNCdFlYQkdkVzVqZEdsdmJpaGphR2xzWkN3Z2EyVjVMQ0JwYm1SbGVDa2dkMmxzYkNCaVpTQmpZV3hzWldRZ1ptOXlJR1ZoWTJoY2JpQXFJR3hsWVdZZ1kyaHBiR1F1WEc0Z0tseHVJQ29nUUhCaGNtRnRJSHMvS24wZ1kyaHBiR1J5Wlc0Z1EyaHBiR1J5Wlc0Z2RISmxaU0JqYjI1MFlXbHVaWEl1WEc0Z0tpQkFjR0Z5WVcwZ2UyWjFibU4wYVc5dUtDb3NJR2x1ZENsOUlHWjFibU1nVkdobElHMWhjQ0JtZFc1amRHbHZiaTVjYmlBcUlFQndZWEpoYlNCN0tuMGdZMjl1ZEdWNGRDQkRiMjUwWlhoMElHWnZjaUJ0WVhCR2RXNWpkR2x2Ymk1Y2JpQXFJRUJ5WlhSMWNtNGdlMjlpYW1WamRIMGdUMkpxWldOMElHTnZiblJoYVc1cGJtY2dkR2hsSUc5eVpHVnlaV1FnYldGd0lHOW1JSEpsYzNWc2RITXVYRzRnS2k5Y2JtWjFibU4wYVc5dUlHMWhjRU5vYVd4a2NtVnVLR05vYVd4a2NtVnVMQ0JtZFc1akxDQmpiMjUwWlhoMEtTQjdYRzRnSUdsbUlDaGphR2xzWkhKbGJpQTlQU0J1ZFd4c0tTQjdYRzRnSUNBZ2NtVjBkWEp1SUdOb2FXeGtjbVZ1TzF4dUlDQjlYRzRnSUhaaGNpQnlaWE4xYkhRZ1BTQmJYVHRjYmlBZ2JXRndTVzUwYjFkcGRHaExaWGxRY21WbWFYaEpiblJsY201aGJDaGphR2xzWkhKbGJpd2djbVZ6ZFd4MExDQnVkV3hzTENCbWRXNWpMQ0JqYjI1MFpYaDBLVHRjYmlBZ2NtVjBkWEp1SUhKbGMzVnNkRHRjYm4xY2JseHVablZ1WTNScGIyNGdabTl5UldGamFGTnBibWRzWlVOb2FXeGtSSFZ0Ylhrb2RISmhkbVZ5YzJWRGIyNTBaWGgwTENCamFHbHNaQ3dnYm1GdFpTa2dlMXh1SUNCeVpYUjFjbTRnYm5Wc2JEdGNibjFjYmx4dUx5b3FYRzRnS2lCRGIzVnVkQ0IwYUdVZ2JuVnRZbVZ5SUc5bUlHTm9hV3hrY21WdUlIUm9ZWFFnWVhKbElIUjVjR2xqWVd4c2VTQnpjR1ZqYVdacFpXUWdZWE5jYmlBcUlHQndjbTl3Y3k1amFHbHNaSEpsYm1BdVhHNGdLbHh1SUNvZ1UyVmxJR2gwZEhCek9pOHZabUZqWldKdmIyc3VaMmwwYUhWaUxtbHZMM0psWVdOMEwyUnZZM012ZEc5d0xXeGxkbVZzTFdGd2FTNW9kRzFzSTNKbFlXTjBMbU5vYVd4a2NtVnVMbU52ZFc1MFhHNGdLbHh1SUNvZ1FIQmhjbUZ0SUhzL0tuMGdZMmhwYkdSeVpXNGdRMmhwYkdSeVpXNGdkSEpsWlNCamIyNTBZV2x1WlhJdVhHNGdLaUJBY21WMGRYSnVJSHR1ZFcxaVpYSjlJRlJvWlNCdWRXMWlaWElnYjJZZ1kyaHBiR1J5Wlc0dVhHNGdLaTljYm1aMWJtTjBhVzl1SUdOdmRXNTBRMmhwYkdSeVpXNG9ZMmhwYkdSeVpXNHNJR052Ym5SbGVIUXBJSHRjYmlBZ2NtVjBkWEp1SUhSeVlYWmxjbk5sUVd4c1EyaHBiR1J5Wlc0b1kyaHBiR1J5Wlc0c0lHWnZja1ZoWTJoVGFXNW5iR1ZEYUdsc1pFUjFiVzE1TENCdWRXeHNLVHRjYm4xY2JseHVMeW9xWEc0Z0tpQkdiR0YwZEdWdUlHRWdZMmhwYkdSeVpXNGdiMkpxWldOMElDaDBlWEJwWTJGc2JIa2djM0JsWTJsbWFXVmtJR0Z6SUdCd2NtOXdjeTVqYUdsc1pISmxibUFwSUdGdVpGeHVJQ29nY21WMGRYSnVJR0Z1SUdGeWNtRjVJSGRwZEdnZ1lYQndjbTl3Y21saGRHVnNlU0J5WlMxclpYbGxaQ0JqYUdsc1pISmxiaTVjYmlBcVhHNGdLaUJUWldVZ2FIUjBjSE02THk5bVlXTmxZbTl2YXk1bmFYUm9kV0l1YVc4dmNtVmhZM1F2Wkc5amN5OTBiM0F0YkdWMlpXd3RZWEJwTG1oMGJXd2pjbVZoWTNRdVkyaHBiR1J5Wlc0dWRHOWhjbkpoZVZ4dUlDb3ZYRzVtZFc1amRHbHZiaUIwYjBGeWNtRjVLR05vYVd4a2NtVnVLU0I3WEc0Z0lIWmhjaUJ5WlhOMWJIUWdQU0JiWFR0Y2JpQWdiV0Z3U1c1MGIxZHBkR2hMWlhsUWNtVm1hWGhKYm5SbGNtNWhiQ2hqYUdsc1pISmxiaXdnY21WemRXeDBMQ0J1ZFd4c0xDQmxiWEIwZVVaMWJtTjBhVzl1TG5Sb1lYUlNaWFIxY201elFYSm5kVzFsYm5RcE8xeHVJQ0J5WlhSMWNtNGdjbVZ6ZFd4ME8xeHVmVnh1WEc1MllYSWdVbVZoWTNSRGFHbHNaSEpsYmlBOUlIdGNiaUFnWm05eVJXRmphRG9nWm05eVJXRmphRU5vYVd4a2NtVnVMRnh1SUNCdFlYQTZJRzFoY0VOb2FXeGtjbVZ1TEZ4dUlDQnRZWEJKYm5SdlYybDBhRXRsZVZCeVpXWnBlRWx1ZEdWeWJtRnNPaUJ0WVhCSmJuUnZWMmwwYUV0bGVWQnlaV1pwZUVsdWRHVnlibUZzTEZ4dUlDQmpiM1Z1ZERvZ1kyOTFiblJEYUdsc1pISmxiaXhjYmlBZ2RHOUJjbkpoZVRvZ2RHOUJjbkpoZVZ4dWZUdGNibHh1Ylc5a2RXeGxMbVY0Y0c5eWRITWdQU0JTWldGamRFTm9hV3hrY21WdU95SXNJaThxS2x4dUlDb2dRMjl3ZVhKcFoyaDBJREl3TVRZdGNISmxjMlZ1ZEN3Z1JtRmpaV0p2YjJzc0lFbHVZeTVjYmlBcUlFRnNiQ0J5YVdkb2RITWdjbVZ6WlhKMlpXUXVYRzRnS2x4dUlDb2dWR2hwY3lCemIzVnlZMlVnWTI5a1pTQnBjeUJzYVdObGJuTmxaQ0IxYm1SbGNpQjBhR1VnUWxORUxYTjBlV3hsSUd4cFkyVnVjMlVnWm05MWJtUWdhVzRnZEdobFhHNGdLaUJNU1VORlRsTkZJR1pwYkdVZ2FXNGdkR2hsSUhKdmIzUWdaR2x5WldOMGIzSjVJRzltSUhSb2FYTWdjMjkxY21ObElIUnlaV1V1SUVGdUlHRmtaR2wwYVc5dVlXd2daM0poYm5SY2JpQXFJRzltSUhCaGRHVnVkQ0J5YVdkb2RITWdZMkZ1SUdKbElHWnZkVzVrSUdsdUlIUm9aU0JRUVZSRlRsUlRJR1pwYkdVZ2FXNGdkR2hsSUhOaGJXVWdaR2x5WldOMGIzSjVMbHh1SUNwY2JpQXFJRnh1SUNvdlhHNWNiaWQxYzJVZ2MzUnlhV04wSnp0Y2JseHVkbUZ5SUY5d2NtOWtTVzUyWVhKcFlXNTBJRDBnY21WeGRXbHlaU2duTGk5eVpXRmpkRkJ5YjJSSmJuWmhjbWxoYm5RbktUdGNibHh1ZG1GeUlGSmxZV04wUTNWeWNtVnVkRTkzYm1WeUlEMGdjbVZ4ZFdseVpTZ25MaTlTWldGamRFTjFjbkpsYm5SUGQyNWxjaWNwTzF4dVhHNTJZWElnYVc1MllYSnBZVzUwSUQwZ2NtVnhkV2x5WlNnblptSnFjeTlzYVdJdmFXNTJZWEpwWVc1MEp5azdYRzUyWVhJZ2QyRnlibWx1WnlBOUlISmxjWFZwY21Vb0oyWmlhbk12YkdsaUwzZGhjbTVwYm1jbktUdGNibHh1Wm5WdVkzUnBiMjRnYVhOT1lYUnBkbVVvWm00cElIdGNiaUFnTHk4Z1FtRnpaV1FnYjI0Z2FYTk9ZWFJwZG1Vb0tTQm1jbTl0SUV4dlpHRnphRnh1SUNCMllYSWdablZ1WTFSdlUzUnlhVzVuSUQwZ1JuVnVZM1JwYjI0dWNISnZkRzkwZVhCbExuUnZVM1J5YVc1bk8xeHVJQ0IyWVhJZ2FHRnpUM2R1VUhKdmNHVnlkSGtnUFNCUFltcGxZM1F1Y0hKdmRHOTBlWEJsTG1oaGMwOTNibEJ5YjNCbGNuUjVPMXh1SUNCMllYSWdjbVZKYzA1aGRHbDJaU0E5SUZKbFowVjRjQ2duWGljZ0t5Qm1kVzVqVkc5VGRISnBibWRjYmlBZ0x5OGdWR0ZyWlNCaGJpQmxlR0Z0Y0d4bElHNWhkR2wyWlNCbWRXNWpkR2x2YmlCemIzVnlZMlVnWm05eUlHTnZiWEJoY21semIyNWNiaUFnTG1OaGJHd29hR0Z6VDNkdVVISnZjR1Z5ZEhsY2JpQWdMeThnVTNSeWFYQWdjbVZuWlhnZ1kyaGhjbUZqZEdWeWN5QnpieUIzWlNCallXNGdkWE5sSUdsMElHWnZjaUJ5WldkbGVGeHVJQ0FwTG5KbGNHeGhZMlVvTDF0Y1hGeGNYaVF1S2lzL0tDbGJYRnhkZTMxOFhTOW5MQ0FuWEZ4Y1hDUW1KMXh1SUNBdkx5QlNaVzF2ZG1VZ2FHRnpUM2R1VUhKdmNHVnlkSGtnWm5KdmJTQjBhR1VnZEdWdGNHeGhkR1VnZEc4Z2JXRnJaU0JwZENCblpXNWxjbWxqWEc0Z0lDa3VjbVZ3YkdGalpTZ3ZhR0Z6VDNkdVVISnZjR1Z5ZEhsOEtHWjFibU4wYVc5dUtTNHFQeWcvUFZ4Y1hGeGNYQ2dwZkNCbWIzSWdMaXMvS0Q4OVhGeGNYRnhjWFNrdlp5d2dKeVF4TGlvL0p5a2dLeUFuSkNjcE8xeHVJQ0IwY25rZ2UxeHVJQ0FnSUhaaGNpQnpiM1Z5WTJVZ1BTQm1kVzVqVkc5VGRISnBibWN1WTJGc2JDaG1iaWs3WEc0Z0lDQWdjbVYwZFhKdUlISmxTWE5PWVhScGRtVXVkR1Z6ZENoemIzVnlZMlVwTzF4dUlDQjlJR05oZEdOb0lDaGxjbklwSUh0Y2JpQWdJQ0J5WlhSMWNtNGdabUZzYzJVN1hHNGdJSDFjYm4xY2JseHVkbUZ5SUdOaGJsVnpaVU52Ykd4bFkzUnBiMjV6SUQxY2JpOHZJRUZ5Y21GNUxtWnliMjFjYm5SNWNHVnZaaUJCY25KaGVTNW1jbTl0SUQwOVBTQW5ablZ1WTNScGIyNG5JQ1ltWEc0dkx5Qk5ZWEJjYm5SNWNHVnZaaUJOWVhBZ1BUMDlJQ2RtZFc1amRHbHZiaWNnSmlZZ2FYTk9ZWFJwZG1Vb1RXRndLU0FtSmx4dUx5OGdUV0Z3TG5CeWIzUnZkSGx3WlM1clpYbHpYRzVOWVhBdWNISnZkRzkwZVhCbElDRTlJRzUxYkd3Z0ppWWdkSGx3Wlc5bUlFMWhjQzV3Y205MGIzUjVjR1V1YTJWNWN5QTlQVDBnSjJaMWJtTjBhVzl1SnlBbUppQnBjMDVoZEdsMlpTaE5ZWEF1Y0hKdmRHOTBlWEJsTG10bGVYTXBJQ1ltWEc0dkx5QlRaWFJjYm5SNWNHVnZaaUJUWlhRZ1BUMDlJQ2RtZFc1amRHbHZiaWNnSmlZZ2FYTk9ZWFJwZG1Vb1UyVjBLU0FtSmx4dUx5OGdVMlYwTG5CeWIzUnZkSGx3WlM1clpYbHpYRzVUWlhRdWNISnZkRzkwZVhCbElDRTlJRzUxYkd3Z0ppWWdkSGx3Wlc5bUlGTmxkQzV3Y205MGIzUjVjR1V1YTJWNWN5QTlQVDBnSjJaMWJtTjBhVzl1SnlBbUppQnBjMDVoZEdsMlpTaFRaWFF1Y0hKdmRHOTBlWEJsTG10bGVYTXBPMXh1WEc1MllYSWdjMlYwU1hSbGJUdGNiblpoY2lCblpYUkpkR1Z0TzF4dWRtRnlJSEpsYlc5MlpVbDBaVzA3WEc1MllYSWdaMlYwU1hSbGJVbEVjenRjYm5aaGNpQmhaR1JTYjI5ME8xeHVkbUZ5SUhKbGJXOTJaVkp2YjNRN1hHNTJZWElnWjJWMFVtOXZkRWxFY3p0Y2JseHVhV1lnS0dOaGJsVnpaVU52Ykd4bFkzUnBiMjV6S1NCN1hHNGdJSFpoY2lCcGRHVnRUV0Z3SUQwZ2JtVjNJRTFoY0NncE8xeHVJQ0IyWVhJZ2NtOXZkRWxFVTJWMElEMGdibVYzSUZObGRDZ3BPMXh1WEc0Z0lITmxkRWwwWlcwZ1BTQm1kVzVqZEdsdmJpQW9hV1FzSUdsMFpXMHBJSHRjYmlBZ0lDQnBkR1Z0VFdGd0xuTmxkQ2hwWkN3Z2FYUmxiU2s3WEc0Z0lIMDdYRzRnSUdkbGRFbDBaVzBnUFNCbWRXNWpkR2x2YmlBb2FXUXBJSHRjYmlBZ0lDQnlaWFIxY200Z2FYUmxiVTFoY0M1blpYUW9hV1FwTzF4dUlDQjlPMXh1SUNCeVpXMXZkbVZKZEdWdElEMGdablZ1WTNScGIyNGdLR2xrS1NCN1hHNGdJQ0FnYVhSbGJVMWhjRnNuWkdWc1pYUmxKMTBvYVdRcE8xeHVJQ0I5TzF4dUlDQm5aWFJKZEdWdFNVUnpJRDBnWm5WdVkzUnBiMjRnS0NrZ2UxeHVJQ0FnSUhKbGRIVnliaUJCY25KaGVTNW1jbTl0S0dsMFpXMU5ZWEF1YTJWNWN5Z3BLVHRjYmlBZ2ZUdGNibHh1SUNCaFpHUlNiMjkwSUQwZ1puVnVZM1JwYjI0Z0tHbGtLU0I3WEc0Z0lDQWdjbTl2ZEVsRVUyVjBMbUZrWkNocFpDazdYRzRnSUgwN1hHNGdJSEpsYlc5MlpWSnZiM1FnUFNCbWRXNWpkR2x2YmlBb2FXUXBJSHRjYmlBZ0lDQnliMjkwU1VSVFpYUmJKMlJsYkdWMFpTZGRLR2xrS1R0Y2JpQWdmVHRjYmlBZ1oyVjBVbTl2ZEVsRWN5QTlJR1oxYm1OMGFXOXVJQ2dwSUh0Y2JpQWdJQ0J5WlhSMWNtNGdRWEp5WVhrdVpuSnZiU2h5YjI5MFNVUlRaWFF1YTJWNWN5Z3BLVHRjYmlBZ2ZUdGNibjBnWld4elpTQjdYRzRnSUhaaGNpQnBkR1Z0UW5sTFpYa2dQU0I3ZlR0Y2JpQWdkbUZ5SUhKdmIzUkNlVXRsZVNBOUlIdDlPMXh1WEc0Z0lDOHZJRlZ6WlNCdWIyNHRiblZ0WlhKcFl5QnJaWGx6SUhSdklIQnlaWFpsYm5RZ1ZqZ2djR1Z5Wm05eWJXRnVZMlVnYVhOemRXVnpPbHh1SUNBdkx5Qm9kSFJ3Y3pvdkwyZHBkR2gxWWk1amIyMHZabUZqWldKdmIyc3ZjbVZoWTNRdmNIVnNiQzgzTWpNeVhHNGdJSFpoY2lCblpYUkxaWGxHY205dFNVUWdQU0JtZFc1amRHbHZiaUFvYVdRcElIdGNiaUFnSUNCeVpYUjFjbTRnSnk0bklDc2dhV1E3WEc0Z0lIMDdYRzRnSUhaaGNpQm5aWFJKUkVaeWIyMUxaWGtnUFNCbWRXNWpkR2x2YmlBb2EyVjVLU0I3WEc0Z0lDQWdjbVYwZFhKdUlIQmhjbk5sU1c1MEtHdGxlUzV6ZFdKemRISW9NU2tzSURFd0tUdGNiaUFnZlR0Y2JseHVJQ0J6WlhSSmRHVnRJRDBnWm5WdVkzUnBiMjRnS0dsa0xDQnBkR1Z0S1NCN1hHNGdJQ0FnZG1GeUlHdGxlU0E5SUdkbGRFdGxlVVp5YjIxSlJDaHBaQ2s3WEc0Z0lDQWdhWFJsYlVKNVMyVjVXMnRsZVYwZ1BTQnBkR1Z0TzF4dUlDQjlPMXh1SUNCblpYUkpkR1Z0SUQwZ1puVnVZM1JwYjI0Z0tHbGtLU0I3WEc0Z0lDQWdkbUZ5SUd0bGVTQTlJR2RsZEV0bGVVWnliMjFKUkNocFpDazdYRzRnSUNBZ2NtVjBkWEp1SUdsMFpXMUNlVXRsZVZ0clpYbGRPMXh1SUNCOU8xeHVJQ0J5WlcxdmRtVkpkR1Z0SUQwZ1puVnVZM1JwYjI0Z0tHbGtLU0I3WEc0Z0lDQWdkbUZ5SUd0bGVTQTlJR2RsZEV0bGVVWnliMjFKUkNocFpDazdYRzRnSUNBZ1pHVnNaWFJsSUdsMFpXMUNlVXRsZVZ0clpYbGRPMXh1SUNCOU8xeHVJQ0JuWlhSSmRHVnRTVVJ6SUQwZ1puVnVZM1JwYjI0Z0tDa2dlMXh1SUNBZ0lISmxkSFZ5YmlCUFltcGxZM1F1YTJWNWN5aHBkR1Z0UW5sTFpYa3BMbTFoY0NoblpYUkpSRVp5YjIxTFpYa3BPMXh1SUNCOU8xeHVYRzRnSUdGa1pGSnZiM1FnUFNCbWRXNWpkR2x2YmlBb2FXUXBJSHRjYmlBZ0lDQjJZWElnYTJWNUlEMGdaMlYwUzJWNVJuSnZiVWxFS0dsa0tUdGNiaUFnSUNCeWIyOTBRbmxMWlhsYmEyVjVYU0E5SUhSeWRXVTdYRzRnSUgwN1hHNGdJSEpsYlc5MlpWSnZiM1FnUFNCbWRXNWpkR2x2YmlBb2FXUXBJSHRjYmlBZ0lDQjJZWElnYTJWNUlEMGdaMlYwUzJWNVJuSnZiVWxFS0dsa0tUdGNiaUFnSUNCa1pXeGxkR1VnY205dmRFSjVTMlY1VzJ0bGVWMDdYRzRnSUgwN1hHNGdJR2RsZEZKdmIzUkpSSE1nUFNCbWRXNWpkR2x2YmlBb0tTQjdYRzRnSUNBZ2NtVjBkWEp1SUU5aWFtVmpkQzVyWlhsektISnZiM1JDZVV0bGVTa3ViV0Z3S0dkbGRFbEVSbkp2YlV0bGVTazdYRzRnSUgwN1hHNTlYRzVjYm5aaGNpQjFibTF2ZFc1MFpXUkpSSE1nUFNCYlhUdGNibHh1Wm5WdVkzUnBiMjRnY0hWeVoyVkVaV1Z3S0dsa0tTQjdYRzRnSUhaaGNpQnBkR1Z0SUQwZ1oyVjBTWFJsYlNocFpDazdYRzRnSUdsbUlDaHBkR1Z0S1NCN1hHNGdJQ0FnZG1GeUlHTm9hV3hrU1VSeklEMGdhWFJsYlM1amFHbHNaRWxFY3p0Y2JseHVJQ0FnSUhKbGJXOTJaVWwwWlcwb2FXUXBPMXh1SUNBZ0lHTm9hV3hrU1VSekxtWnZja1ZoWTJnb2NIVnlaMlZFWldWd0tUdGNiaUFnZlZ4dWZWeHVYRzVtZFc1amRHbHZiaUJrWlhOamNtbGlaVU52YlhCdmJtVnVkRVp5WVcxbEtHNWhiV1VzSUhOdmRYSmpaU3dnYjNkdVpYSk9ZVzFsS1NCN1hHNGdJSEpsZEhWeWJpQW5YRnh1SUNBZ0lHbHVJQ2NnS3lBb2JtRnRaU0I4ZkNBblZXNXJibTkzYmljcElDc2dLSE52ZFhKalpTQS9JQ2NnS0dGMElDY2dLeUJ6YjNWeVkyVXVabWxzWlU1aGJXVXVjbVZ3YkdGalpTZ3ZYaTRxVzF4Y1hGeGNYQzlkTHl3Z0p5Y3BJQ3NnSnpvbklDc2djMjkxY21ObExteHBibVZPZFcxaVpYSWdLeUFuS1NjZ09pQnZkMjVsY2s1aGJXVWdQeUFuSUNoamNtVmhkR1ZrSUdKNUlDY2dLeUJ2ZDI1bGNrNWhiV1VnS3lBbktTY2dPaUFuSnlrN1hHNTlYRzVjYm1aMWJtTjBhVzl1SUdkbGRFUnBjM0JzWVhsT1lXMWxLR1ZzWlcxbGJuUXBJSHRjYmlBZ2FXWWdLR1ZzWlcxbGJuUWdQVDBnYm5Wc2JDa2dlMXh1SUNBZ0lISmxkSFZ5YmlBbkkyVnRjSFI1Snp0Y2JpQWdmU0JsYkhObElHbG1JQ2gwZVhCbGIyWWdaV3hsYldWdWRDQTlQVDBnSjNOMGNtbHVaeWNnZkh3Z2RIbHdaVzltSUdWc1pXMWxiblFnUFQwOUlDZHVkVzFpWlhJbktTQjdYRzRnSUNBZ2NtVjBkWEp1SUNjamRHVjRkQ2M3WEc0Z0lIMGdaV3h6WlNCcFppQW9kSGx3Wlc5bUlHVnNaVzFsYm5RdWRIbHdaU0E5UFQwZ0ozTjBjbWx1WnljcElIdGNiaUFnSUNCeVpYUjFjbTRnWld4bGJXVnVkQzUwZVhCbE8xeHVJQ0I5SUdWc2MyVWdlMXh1SUNBZ0lISmxkSFZ5YmlCbGJHVnRaVzUwTG5SNWNHVXVaR2x6Y0d4aGVVNWhiV1VnZkh3Z1pXeGxiV1Z1ZEM1MGVYQmxMbTVoYldVZ2ZId2dKMVZ1YTI1dmQyNG5PMXh1SUNCOVhHNTlYRzVjYm1aMWJtTjBhVzl1SUdSbGMyTnlhV0psU1VRb2FXUXBJSHRjYmlBZ2RtRnlJRzVoYldVZ1BTQlNaV0ZqZEVOdmJYQnZibVZ1ZEZSeVpXVkliMjlyTG1kbGRFUnBjM0JzWVhsT1lXMWxLR2xrS1R0Y2JpQWdkbUZ5SUdWc1pXMWxiblFnUFNCU1pXRmpkRU52YlhCdmJtVnVkRlJ5WldWSWIyOXJMbWRsZEVWc1pXMWxiblFvYVdRcE8xeHVJQ0IyWVhJZ2IzZHVaWEpKUkNBOUlGSmxZV04wUTI5dGNHOXVaVzUwVkhKbFpVaHZiMnN1WjJWMFQzZHVaWEpKUkNocFpDazdYRzRnSUhaaGNpQnZkMjVsY2s1aGJXVTdYRzRnSUdsbUlDaHZkMjVsY2tsRUtTQjdYRzRnSUNBZ2IzZHVaWEpPWVcxbElEMGdVbVZoWTNSRGIyMXdiMjVsYm5SVWNtVmxTRzl2YXk1blpYUkVhWE53YkdGNVRtRnRaU2h2ZDI1bGNrbEVLVHRjYmlBZ2ZWeHVJQ0J3Y205alpYTnpMbVZ1ZGk1T1QwUkZYMFZPVmlBaFBUMGdKM0J5YjJSMVkzUnBiMjRuSUQ4Z2QyRnlibWx1WnlobGJHVnRaVzUwTENBblVtVmhZM1JEYjIxd2IyNWxiblJVY21WbFNHOXZhem9nVFdsemMybHVaeUJTWldGamRDQmxiR1Z0Wlc1MElHWnZjaUJrWldKMVowbEVJQ1Z6SUhkb1pXNGdKeUFySUNkaWRXbHNaR2x1WnlCemRHRmpheWNzSUdsa0tTQTZJSFp2YVdRZ01EdGNiaUFnY21WMGRYSnVJR1JsYzJOeWFXSmxRMjl0Y0c5dVpXNTBSbkpoYldVb2JtRnRaU3dnWld4bGJXVnVkQ0FtSmlCbGJHVnRaVzUwTGw5emIzVnlZMlVzSUc5M2JtVnlUbUZ0WlNrN1hHNTlYRzVjYm5aaGNpQlNaV0ZqZEVOdmJYQnZibVZ1ZEZSeVpXVkliMjlySUQwZ2UxeHVJQ0J2YmxObGRFTm9hV3hrY21WdU9pQm1kVzVqZEdsdmJpQW9hV1FzSUc1bGVIUkRhR2xzWkVsRWN5a2dlMXh1SUNBZ0lIWmhjaUJwZEdWdElEMGdaMlYwU1hSbGJTaHBaQ2s3WEc0Z0lDQWdJV2wwWlcwZ1B5QndjbTlqWlhOekxtVnVkaTVPVDBSRlgwVk9WaUFoUFQwZ0ozQnliMlIxWTNScGIyNG5JRDhnYVc1MllYSnBZVzUwS0daaGJITmxMQ0FuU1hSbGJTQnRkWE4wSUdoaGRtVWdZbVZsYmlCelpYUW5LU0E2SUY5d2NtOWtTVzUyWVhKcFlXNTBLQ2N4TkRRbktTQTZJSFp2YVdRZ01EdGNiaUFnSUNCcGRHVnRMbU5vYVd4a1NVUnpJRDBnYm1WNGRFTm9hV3hrU1VSek8xeHVYRzRnSUNBZ1ptOXlJQ2gyWVhJZ2FTQTlJREE3SUdrZ1BDQnVaWGgwUTJocGJHUkpSSE11YkdWdVozUm9PeUJwS3lzcElIdGNiaUFnSUNBZ0lIWmhjaUJ1WlhoMFEyaHBiR1JKUkNBOUlHNWxlSFJEYUdsc1pFbEVjMXRwWFR0Y2JpQWdJQ0FnSUhaaGNpQnVaWGgwUTJocGJHUWdQU0JuWlhSSmRHVnRLRzVsZUhSRGFHbHNaRWxFS1R0Y2JpQWdJQ0FnSUNGdVpYaDBRMmhwYkdRZ1B5QndjbTlqWlhOekxtVnVkaTVPVDBSRlgwVk9WaUFoUFQwZ0ozQnliMlIxWTNScGIyNG5JRDhnYVc1MllYSnBZVzUwS0daaGJITmxMQ0FuUlhod1pXTjBaV1FnYUc5dmF5QmxkbVZ1ZEhNZ2RHOGdabWx5WlNCbWIzSWdkR2hsSUdOb2FXeGtJR0psWm05eVpTQnBkSE1nY0dGeVpXNTBJR2x1WTJ4MVpHVnpJR2wwSUdsdUlHOXVVMlYwUTJocGJHUnlaVzRvS1M0bktTQTZJRjl3Y205a1NXNTJZWEpwWVc1MEtDY3hOREFuS1NBNklIWnZhV1FnTUR0Y2JpQWdJQ0FnSUNFb2JtVjRkRU5vYVd4a0xtTm9hV3hrU1VSeklDRTlJRzUxYkd3Z2ZId2dkSGx3Wlc5bUlHNWxlSFJEYUdsc1pDNWxiR1Z0Wlc1MElDRTlQU0FuYjJKcVpXTjBKeUI4ZkNCdVpYaDBRMmhwYkdRdVpXeGxiV1Z1ZENBOVBTQnVkV3hzS1NBL0lIQnliMk5sYzNNdVpXNTJMazVQUkVWZlJVNVdJQ0U5UFNBbmNISnZaSFZqZEdsdmJpY2dQeUJwYm5aaGNtbGhiblFvWm1Gc2MyVXNJQ2RGZUhCbFkzUmxaQ0J2YmxObGRFTm9hV3hrY21WdUtDa2dkRzhnWm1seVpTQm1iM0lnWVNCamIyNTBZV2x1WlhJZ1kyaHBiR1FnWW1WbWIzSmxJR2wwY3lCd1lYSmxiblFnYVc1amJIVmtaWE1nYVhRZ2FXNGdiMjVUWlhSRGFHbHNaSEpsYmlncExpY3BJRG9nWDNCeWIyUkpiblpoY21saGJuUW9KekUwTVNjcElEb2dkbTlwWkNBd08xeHVJQ0FnSUNBZ0lXNWxlSFJEYUdsc1pDNXBjMDF2ZFc1MFpXUWdQeUJ3Y205alpYTnpMbVZ1ZGk1T1QwUkZYMFZPVmlBaFBUMGdKM0J5YjJSMVkzUnBiMjRuSUQ4Z2FXNTJZWEpwWVc1MEtHWmhiSE5sTENBblJYaHdaV04wWldRZ2IyNU5iM1Z1ZEVOdmJYQnZibVZ1ZENncElIUnZJR1pwY21VZ1ptOXlJSFJvWlNCamFHbHNaQ0JpWldadmNtVWdhWFJ6SUhCaGNtVnVkQ0JwYm1Oc2RXUmxjeUJwZENCcGJpQnZibE5sZEVOb2FXeGtjbVZ1S0NrdUp5a2dPaUJmY0hKdlpFbHVkbUZ5YVdGdWRDZ25OekVuS1NBNklIWnZhV1FnTUR0Y2JpQWdJQ0FnSUdsbUlDaHVaWGgwUTJocGJHUXVjR0Z5Wlc1MFNVUWdQVDBnYm5Wc2JDa2dlMXh1SUNBZ0lDQWdJQ0J1WlhoMFEyaHBiR1F1Y0dGeVpXNTBTVVFnUFNCcFpEdGNiaUFnSUNBZ0lDQWdMeThnVkU5RVR6b2dWR2hwY3lCemFHOTFiR1J1SjNRZ1ltVWdibVZqWlhOellYSjVJR0oxZENCdGIzVnVkR2x1WnlCaElHNWxkeUJ5YjI5MElHUjFjbWx1WnlCcGJseHVJQ0FnSUNBZ0lDQXZMeUJqYjIxd2IyNWxiblJYYVd4c1RXOTFiblFnWTNWeWNtVnVkR3g1SUdOaGRYTmxjeUJ1YjNRdGVXVjBMVzF2ZFc1MFpXUWdZMjl0Y0c5dVpXNTBjeUIwYjF4dUlDQWdJQ0FnSUNBdkx5QmlaU0J3ZFhKblpXUWdabkp2YlNCdmRYSWdkSEpsWlNCa1lYUmhJSE52SUhSb1pXbHlJSEJoY21WdWRDQnBaQ0JwY3lCdGFYTnphVzVuTGx4dUlDQWdJQ0FnZlZ4dUlDQWdJQ0FnSVNodVpYaDBRMmhwYkdRdWNHRnlaVzUwU1VRZ1BUMDlJR2xrS1NBL0lIQnliMk5sYzNNdVpXNTJMazVQUkVWZlJVNVdJQ0U5UFNBbmNISnZaSFZqZEdsdmJpY2dQeUJwYm5aaGNtbGhiblFvWm1Gc2MyVXNJQ2RGZUhCbFkzUmxaQ0J2YmtKbFptOXlaVTF2ZFc1MFEyOXRjRzl1Wlc1MEtDa2djR0Z5Wlc1MElHRnVaQ0J2YmxObGRFTm9hV3hrY21WdUtDa2dkRzhnWW1VZ1kyOXVjMmx6ZEdWdWRDQW9KWE1nYUdGeklIQmhjbVZ1ZEhNZ0pYTWdZVzVrSUNWektTNG5MQ0J1WlhoMFEyaHBiR1JKUkN3Z2JtVjRkRU5vYVd4a0xuQmhjbVZ1ZEVsRUxDQnBaQ2tnT2lCZmNISnZaRWx1ZG1GeWFXRnVkQ2duTVRReUp5d2dibVY0ZEVOb2FXeGtTVVFzSUc1bGVIUkRhR2xzWkM1d1lYSmxiblJKUkN3Z2FXUXBJRG9nZG05cFpDQXdPMXh1SUNBZ0lIMWNiaUFnZlN4Y2JpQWdiMjVDWldadmNtVk5iM1Z1ZEVOdmJYQnZibVZ1ZERvZ1puVnVZM1JwYjI0Z0tHbGtMQ0JsYkdWdFpXNTBMQ0J3WVhKbGJuUkpSQ2tnZTF4dUlDQWdJSFpoY2lCcGRHVnRJRDBnZTF4dUlDQWdJQ0FnWld4bGJXVnVkRG9nWld4bGJXVnVkQ3hjYmlBZ0lDQWdJSEJoY21WdWRFbEVPaUJ3WVhKbGJuUkpSQ3hjYmlBZ0lDQWdJSFJsZUhRNklHNTFiR3dzWEc0Z0lDQWdJQ0JqYUdsc1pFbEVjem9nVzEwc1hHNGdJQ0FnSUNCcGMwMXZkVzUwWldRNklHWmhiSE5sTEZ4dUlDQWdJQ0FnZFhCa1lYUmxRMjkxYm5RNklEQmNiaUFnSUNCOU8xeHVJQ0FnSUhObGRFbDBaVzBvYVdRc0lHbDBaVzBwTzF4dUlDQjlMRnh1SUNCdmJrSmxabTl5WlZWd1pHRjBaVU52YlhCdmJtVnVkRG9nWm5WdVkzUnBiMjRnS0dsa0xDQmxiR1Z0Wlc1MEtTQjdYRzRnSUNBZ2RtRnlJR2wwWlcwZ1BTQm5aWFJKZEdWdEtHbGtLVHRjYmlBZ0lDQnBaaUFvSVdsMFpXMGdmSHdnSVdsMFpXMHVhWE5OYjNWdWRHVmtLU0I3WEc0Z0lDQWdJQ0F2THlCWFpTQnRZWGtnWlc1a0lIVndJR2hsY21VZ1lYTWdZU0J5WlhOMWJIUWdiMllnYzJWMFUzUmhkR1VvS1NCcGJpQmpiMjF3YjI1bGJuUlhhV3hzVlc1dGIzVnVkQ2dwTGx4dUlDQWdJQ0FnTHk4Z1NXNGdkR2hwY3lCallYTmxMQ0JwWjI1dmNtVWdkR2hsSUdWc1pXMWxiblF1WEc0Z0lDQWdJQ0J5WlhSMWNtNDdYRzRnSUNBZ2ZWeHVJQ0FnSUdsMFpXMHVaV3hsYldWdWRDQTlJR1ZzWlcxbGJuUTdYRzRnSUgwc1hHNGdJRzl1VFc5MWJuUkRiMjF3YjI1bGJuUTZJR1oxYm1OMGFXOXVJQ2hwWkNrZ2UxeHVJQ0FnSUhaaGNpQnBkR1Z0SUQwZ1oyVjBTWFJsYlNocFpDazdYRzRnSUNBZ0lXbDBaVzBnUHlCd2NtOWpaWE56TG1WdWRpNU9UMFJGWDBWT1ZpQWhQVDBnSjNCeWIyUjFZM1JwYjI0bklEOGdhVzUyWVhKcFlXNTBLR1poYkhObExDQW5TWFJsYlNCdGRYTjBJR2hoZG1VZ1ltVmxiaUJ6WlhRbktTQTZJRjl3Y205a1NXNTJZWEpwWVc1MEtDY3hORFFuS1NBNklIWnZhV1FnTUR0Y2JpQWdJQ0JwZEdWdExtbHpUVzkxYm5SbFpDQTlJSFJ5ZFdVN1hHNGdJQ0FnZG1GeUlHbHpVbTl2ZENBOUlHbDBaVzB1Y0dGeVpXNTBTVVFnUFQwOUlEQTdYRzRnSUNBZ2FXWWdLR2x6VW05dmRDa2dlMXh1SUNBZ0lDQWdZV1JrVW05dmRDaHBaQ2s3WEc0Z0lDQWdmVnh1SUNCOUxGeHVJQ0J2YmxWd1pHRjBaVU52YlhCdmJtVnVkRG9nWm5WdVkzUnBiMjRnS0dsa0tTQjdYRzRnSUNBZ2RtRnlJR2wwWlcwZ1BTQm5aWFJKZEdWdEtHbGtLVHRjYmlBZ0lDQnBaaUFvSVdsMFpXMGdmSHdnSVdsMFpXMHVhWE5OYjNWdWRHVmtLU0I3WEc0Z0lDQWdJQ0F2THlCWFpTQnRZWGtnWlc1a0lIVndJR2hsY21VZ1lYTWdZU0J5WlhOMWJIUWdiMllnYzJWMFUzUmhkR1VvS1NCcGJpQmpiMjF3YjI1bGJuUlhhV3hzVlc1dGIzVnVkQ2dwTGx4dUlDQWdJQ0FnTHk4Z1NXNGdkR2hwY3lCallYTmxMQ0JwWjI1dmNtVWdkR2hsSUdWc1pXMWxiblF1WEc0Z0lDQWdJQ0J5WlhSMWNtNDdYRzRnSUNBZ2ZWeHVJQ0FnSUdsMFpXMHVkWEJrWVhSbFEyOTFiblFyS3p0Y2JpQWdmU3hjYmlBZ2IyNVZibTF2ZFc1MFEyOXRjRzl1Wlc1ME9pQm1kVzVqZEdsdmJpQW9hV1FwSUh0Y2JpQWdJQ0IyWVhJZ2FYUmxiU0E5SUdkbGRFbDBaVzBvYVdRcE8xeHVJQ0FnSUdsbUlDaHBkR1Z0S1NCN1hHNGdJQ0FnSUNBdkx5QlhaU0J1WldWa0lIUnZJR05vWldOcklHbG1JR2wwSUdWNGFYTjBjeTVjYmlBZ0lDQWdJQzh2SUdCcGRHVnRZQ0J0YVdkb2RDQnViM1FnWlhocGMzUWdhV1lnYVhRZ2FYTWdhVzV6YVdSbElHRnVJR1Z5Y205eUlHSnZkVzVrWVhKNUxDQmhibVFnWVNCemFXSnNhVzVuWEc0Z0lDQWdJQ0F2THlCbGNuSnZjaUJpYjNWdVpHRnllU0JqYUdsc1pDQjBhSEpsZHlCM2FHbHNaU0J0YjNWdWRHbHVaeTRnVkdobGJpQjBhR2x6SUdsdWMzUmhibU5sSUc1bGRtVnlYRzRnSUNBZ0lDQXZMeUJuYjNRZ1lTQmphR0Z1WTJVZ2RHOGdiVzkxYm5Rc0lHSjFkQ0JwZENCemRHbHNiQ0JuWlhSeklHRnVJSFZ1Ylc5MWJuUnBibWNnWlhabGJuUWdaSFZ5YVc1blhHNGdJQ0FnSUNBdkx5QjBhR1VnWlhKeWIzSWdZbTkxYm1SaGNua2dZMnhsWVc1MWNDNWNiaUFnSUNBZ0lHbDBaVzB1YVhOTmIzVnVkR1ZrSUQwZ1ptRnNjMlU3WEc0Z0lDQWdJQ0IyWVhJZ2FYTlNiMjkwSUQwZ2FYUmxiUzV3WVhKbGJuUkpSQ0E5UFQwZ01EdGNiaUFnSUNBZ0lHbG1JQ2hwYzFKdmIzUXBJSHRjYmlBZ0lDQWdJQ0FnY21WdGIzWmxVbTl2ZENocFpDazdYRzRnSUNBZ0lDQjlYRzRnSUNBZ2ZWeHVJQ0FnSUhWdWJXOTFiblJsWkVsRWN5NXdkWE5vS0dsa0tUdGNiaUFnZlN4Y2JpQWdjSFZ5WjJWVmJtMXZkVzUwWldSRGIyMXdiMjVsYm5Sek9pQm1kVzVqZEdsdmJpQW9LU0I3WEc0Z0lDQWdhV1lnS0ZKbFlXTjBRMjl0Y0c5dVpXNTBWSEpsWlVodmIyc3VYM0J5WlhabGJuUlFkWEpuYVc1bktTQjdYRzRnSUNBZ0lDQXZMeUJUYUc5MWJHUWdiMjVzZVNCaVpTQjFjMlZrSUdadmNpQjBaWE4wYVc1bkxseHVJQ0FnSUNBZ2NtVjBkWEp1TzF4dUlDQWdJSDFjYmx4dUlDQWdJR1p2Y2lBb2RtRnlJR2tnUFNBd095QnBJRHdnZFc1dGIzVnVkR1ZrU1VSekxteGxibWQwYURzZ2FTc3JLU0I3WEc0Z0lDQWdJQ0IyWVhJZ2FXUWdQU0IxYm0xdmRXNTBaV1JKUkhOYmFWMDdYRzRnSUNBZ0lDQndkWEpuWlVSbFpYQW9hV1FwTzF4dUlDQWdJSDFjYmlBZ0lDQjFibTF2ZFc1MFpXUkpSSE11YkdWdVozUm9JRDBnTUR0Y2JpQWdmU3hjYmlBZ2FYTk5iM1Z1ZEdWa09pQm1kVzVqZEdsdmJpQW9hV1FwSUh0Y2JpQWdJQ0IyWVhJZ2FYUmxiU0E5SUdkbGRFbDBaVzBvYVdRcE8xeHVJQ0FnSUhKbGRIVnliaUJwZEdWdElEOGdhWFJsYlM1cGMwMXZkVzUwWldRZ09pQm1ZV3h6WlR0Y2JpQWdmU3hjYmlBZ1oyVjBRM1Z5Y21WdWRGTjBZV05yUVdSa1pXNWtkVzA2SUdaMWJtTjBhVzl1SUNoMGIzQkZiR1Z0Wlc1MEtTQjdYRzRnSUNBZ2RtRnlJR2x1Wm04Z1BTQW5KenRjYmlBZ0lDQnBaaUFvZEc5d1JXeGxiV1Z1ZENrZ2UxeHVJQ0FnSUNBZ2RtRnlJRzVoYldVZ1BTQm5aWFJFYVhOd2JHRjVUbUZ0WlNoMGIzQkZiR1Z0Wlc1MEtUdGNiaUFnSUNBZ0lIWmhjaUJ2ZDI1bGNpQTlJSFJ2Y0VWc1pXMWxiblF1WDI5M2JtVnlPMXh1SUNBZ0lDQWdhVzVtYnlBclBTQmtaWE5qY21saVpVTnZiWEJ2Ym1WdWRFWnlZVzFsS0c1aGJXVXNJSFJ2Y0VWc1pXMWxiblF1WDNOdmRYSmpaU3dnYjNkdVpYSWdKaVlnYjNkdVpYSXVaMlYwVG1GdFpTZ3BLVHRjYmlBZ0lDQjlYRzVjYmlBZ0lDQjJZWElnWTNWeWNtVnVkRTkzYm1WeUlEMGdVbVZoWTNSRGRYSnlaVzUwVDNkdVpYSXVZM1Z5Y21WdWREdGNiaUFnSUNCMllYSWdhV1FnUFNCamRYSnlaVzUwVDNkdVpYSWdKaVlnWTNWeWNtVnVkRTkzYm1WeUxsOWtaV0oxWjBsRU8xeHVYRzRnSUNBZ2FXNW1ieUFyUFNCU1pXRmpkRU52YlhCdmJtVnVkRlJ5WldWSWIyOXJMbWRsZEZOMFlXTnJRV1JrWlc1a2RXMUNlVWxFS0dsa0tUdGNiaUFnSUNCeVpYUjFjbTRnYVc1bWJ6dGNiaUFnZlN4Y2JpQWdaMlYwVTNSaFkydEJaR1JsYm1SMWJVSjVTVVE2SUdaMWJtTjBhVzl1SUNocFpDa2dlMXh1SUNBZ0lIWmhjaUJwYm1adklEMGdKeWM3WEc0Z0lDQWdkMmhwYkdVZ0tHbGtLU0I3WEc0Z0lDQWdJQ0JwYm1adklDczlJR1JsYzJOeWFXSmxTVVFvYVdRcE8xeHVJQ0FnSUNBZ2FXUWdQU0JTWldGamRFTnZiWEJ2Ym1WdWRGUnlaV1ZJYjI5ckxtZGxkRkJoY21WdWRFbEVLR2xrS1R0Y2JpQWdJQ0I5WEc0Z0lDQWdjbVYwZFhKdUlHbHVabTg3WEc0Z0lIMHNYRzRnSUdkbGRFTm9hV3hrU1VSek9pQm1kVzVqZEdsdmJpQW9hV1FwSUh0Y2JpQWdJQ0IyWVhJZ2FYUmxiU0E5SUdkbGRFbDBaVzBvYVdRcE8xeHVJQ0FnSUhKbGRIVnliaUJwZEdWdElEOGdhWFJsYlM1amFHbHNaRWxFY3lBNklGdGRPMXh1SUNCOUxGeHVJQ0JuWlhSRWFYTndiR0Y1VG1GdFpUb2dablZ1WTNScGIyNGdLR2xrS1NCN1hHNGdJQ0FnZG1GeUlHVnNaVzFsYm5RZ1BTQlNaV0ZqZEVOdmJYQnZibVZ1ZEZSeVpXVkliMjlyTG1kbGRFVnNaVzFsYm5Rb2FXUXBPMXh1SUNBZ0lHbG1JQ2doWld4bGJXVnVkQ2tnZTF4dUlDQWdJQ0FnY21WMGRYSnVJRzUxYkd3N1hHNGdJQ0FnZlZ4dUlDQWdJSEpsZEhWeWJpQm5aWFJFYVhOd2JHRjVUbUZ0WlNobGJHVnRaVzUwS1R0Y2JpQWdmU3hjYmlBZ1oyVjBSV3hsYldWdWREb2dablZ1WTNScGIyNGdLR2xrS1NCN1hHNGdJQ0FnZG1GeUlHbDBaVzBnUFNCblpYUkpkR1Z0S0dsa0tUdGNiaUFnSUNCeVpYUjFjbTRnYVhSbGJTQS9JR2wwWlcwdVpXeGxiV1Z1ZENBNklHNTFiR3c3WEc0Z0lIMHNYRzRnSUdkbGRFOTNibVZ5U1VRNklHWjFibU4wYVc5dUlDaHBaQ2tnZTF4dUlDQWdJSFpoY2lCbGJHVnRaVzUwSUQwZ1VtVmhZM1JEYjIxd2IyNWxiblJVY21WbFNHOXZheTVuWlhSRmJHVnRaVzUwS0dsa0tUdGNiaUFnSUNCcFppQW9JV1ZzWlcxbGJuUWdmSHdnSVdWc1pXMWxiblF1WDI5M2JtVnlLU0I3WEc0Z0lDQWdJQ0J5WlhSMWNtNGdiblZzYkR0Y2JpQWdJQ0I5WEc0Z0lDQWdjbVYwZFhKdUlHVnNaVzFsYm5RdVgyOTNibVZ5TGw5a1pXSjFaMGxFTzF4dUlDQjlMRnh1SUNCblpYUlFZWEpsYm5SSlJEb2dablZ1WTNScGIyNGdLR2xrS1NCN1hHNGdJQ0FnZG1GeUlHbDBaVzBnUFNCblpYUkpkR1Z0S0dsa0tUdGNiaUFnSUNCeVpYUjFjbTRnYVhSbGJTQS9JR2wwWlcwdWNHRnlaVzUwU1VRZ09pQnVkV3hzTzF4dUlDQjlMRnh1SUNCblpYUlRiM1Z5WTJVNklHWjFibU4wYVc5dUlDaHBaQ2tnZTF4dUlDQWdJSFpoY2lCcGRHVnRJRDBnWjJWMFNYUmxiU2hwWkNrN1hHNGdJQ0FnZG1GeUlHVnNaVzFsYm5RZ1BTQnBkR1Z0SUQ4Z2FYUmxiUzVsYkdWdFpXNTBJRG9nYm5Wc2JEdGNiaUFnSUNCMllYSWdjMjkxY21ObElEMGdaV3hsYldWdWRDQWhQU0J1ZFd4c0lEOGdaV3hsYldWdWRDNWZjMjkxY21ObElEb2diblZzYkR0Y2JpQWdJQ0J5WlhSMWNtNGdjMjkxY21ObE8xeHVJQ0I5TEZ4dUlDQm5aWFJVWlhoME9pQm1kVzVqZEdsdmJpQW9hV1FwSUh0Y2JpQWdJQ0IyWVhJZ1pXeGxiV1Z1ZENBOUlGSmxZV04wUTI5dGNHOXVaVzUwVkhKbFpVaHZiMnN1WjJWMFJXeGxiV1Z1ZENocFpDazdYRzRnSUNBZ2FXWWdLSFI1Y0dWdlppQmxiR1Z0Wlc1MElEMDlQU0FuYzNSeWFXNW5KeWtnZTF4dUlDQWdJQ0FnY21WMGRYSnVJR1ZzWlcxbGJuUTdYRzRnSUNBZ2ZTQmxiSE5sSUdsbUlDaDBlWEJsYjJZZ1pXeGxiV1Z1ZENBOVBUMGdKMjUxYldKbGNpY3BJSHRjYmlBZ0lDQWdJSEpsZEhWeWJpQW5KeUFySUdWc1pXMWxiblE3WEc0Z0lDQWdmU0JsYkhObElIdGNiaUFnSUNBZ0lISmxkSFZ5YmlCdWRXeHNPMXh1SUNBZ0lIMWNiaUFnZlN4Y2JpQWdaMlYwVlhCa1lYUmxRMjkxYm5RNklHWjFibU4wYVc5dUlDaHBaQ2tnZTF4dUlDQWdJSFpoY2lCcGRHVnRJRDBnWjJWMFNYUmxiU2hwWkNrN1hHNGdJQ0FnY21WMGRYSnVJR2wwWlcwZ1B5QnBkR1Z0TG5Wd1pHRjBaVU52ZFc1MElEb2dNRHRjYmlBZ2ZTeGNibHh1WEc0Z0lHZGxkRkp2YjNSSlJITTZJR2RsZEZKdmIzUkpSSE1zWEc0Z0lHZGxkRkpsWjJsemRHVnlaV1JKUkhNNklHZGxkRWwwWlcxSlJITXNYRzVjYmlBZ2NIVnphRTV2YmxOMFlXNWtZWEprVjJGeWJtbHVaMU4wWVdOck9pQm1kVzVqZEdsdmJpQW9hWE5EY21WaGRHbHVaMFZzWlcxbGJuUXNJR04xY25KbGJuUlRiM1Z5WTJVcElIdGNiaUFnSUNCcFppQW9kSGx3Wlc5bUlHTnZibk52YkdVdWNtVmhZM1JUZEdGamF5QWhQVDBnSjJaMWJtTjBhVzl1SnlrZ2UxeHVJQ0FnSUNBZ2NtVjBkWEp1TzF4dUlDQWdJSDFjYmx4dUlDQWdJSFpoY2lCemRHRmpheUE5SUZ0ZE8xeHVJQ0FnSUhaaGNpQmpkWEp5Wlc1MFQzZHVaWElnUFNCU1pXRmpkRU4xY25KbGJuUlBkMjVsY2k1amRYSnlaVzUwTzF4dUlDQWdJSFpoY2lCcFpDQTlJR04xY25KbGJuUlBkMjVsY2lBbUppQmpkWEp5Wlc1MFQzZHVaWEl1WDJSbFluVm5TVVE3WEc1Y2JpQWdJQ0IwY25rZ2UxeHVJQ0FnSUNBZ2FXWWdLR2x6UTNKbFlYUnBibWRGYkdWdFpXNTBLU0I3WEc0Z0lDQWdJQ0FnSUhOMFlXTnJMbkIxYzJnb2UxeHVJQ0FnSUNBZ0lDQWdJRzVoYldVNklHbGtJRDhnVW1WaFkzUkRiMjF3YjI1bGJuUlVjbVZsU0c5dmF5NW5aWFJFYVhOd2JHRjVUbUZ0WlNocFpDa2dPaUJ1ZFd4c0xGeHVJQ0FnSUNBZ0lDQWdJR1pwYkdWT1lXMWxPaUJqZFhKeVpXNTBVMjkxY21ObElEOGdZM1Z5Y21WdWRGTnZkWEpqWlM1bWFXeGxUbUZ0WlNBNklHNTFiR3dzWEc0Z0lDQWdJQ0FnSUNBZ2JHbHVaVTUxYldKbGNqb2dZM1Z5Y21WdWRGTnZkWEpqWlNBL0lHTjFjbkpsYm5SVGIzVnlZMlV1YkdsdVpVNTFiV0psY2lBNklHNTFiR3hjYmlBZ0lDQWdJQ0FnZlNrN1hHNGdJQ0FnSUNCOVhHNWNiaUFnSUNBZ0lIZG9hV3hsSUNocFpDa2dlMXh1SUNBZ0lDQWdJQ0IyWVhJZ1pXeGxiV1Z1ZENBOUlGSmxZV04wUTI5dGNHOXVaVzUwVkhKbFpVaHZiMnN1WjJWMFJXeGxiV1Z1ZENocFpDazdYRzRnSUNBZ0lDQWdJSFpoY2lCd1lYSmxiblJKUkNBOUlGSmxZV04wUTI5dGNHOXVaVzUwVkhKbFpVaHZiMnN1WjJWMFVHRnlaVzUwU1VRb2FXUXBPMXh1SUNBZ0lDQWdJQ0IyWVhJZ2IzZHVaWEpKUkNBOUlGSmxZV04wUTI5dGNHOXVaVzUwVkhKbFpVaHZiMnN1WjJWMFQzZHVaWEpKUkNocFpDazdYRzRnSUNBZ0lDQWdJSFpoY2lCdmQyNWxjazVoYldVZ1BTQnZkMjVsY2tsRUlEOGdVbVZoWTNSRGIyMXdiMjVsYm5SVWNtVmxTRzl2YXk1blpYUkVhWE53YkdGNVRtRnRaU2h2ZDI1bGNrbEVLU0E2SUc1MWJHdzdYRzRnSUNBZ0lDQWdJSFpoY2lCemIzVnlZMlVnUFNCbGJHVnRaVzUwSUNZbUlHVnNaVzFsYm5RdVgzTnZkWEpqWlR0Y2JpQWdJQ0FnSUNBZ2MzUmhZMnN1Y0hWemFDaDdYRzRnSUNBZ0lDQWdJQ0FnYm1GdFpUb2diM2R1WlhKT1lXMWxMRnh1SUNBZ0lDQWdJQ0FnSUdacGJHVk9ZVzFsT2lCemIzVnlZMlVnUHlCemIzVnlZMlV1Wm1sc1pVNWhiV1VnT2lCdWRXeHNMRnh1SUNBZ0lDQWdJQ0FnSUd4cGJtVk9kVzFpWlhJNklITnZkWEpqWlNBL0lITnZkWEpqWlM1c2FXNWxUblZ0WW1WeUlEb2diblZzYkZ4dUlDQWdJQ0FnSUNCOUtUdGNiaUFnSUNBZ0lDQWdhV1FnUFNCd1lYSmxiblJKUkR0Y2JpQWdJQ0FnSUgxY2JpQWdJQ0I5SUdOaGRHTm9JQ2hsY25JcElIdGNiaUFnSUNBZ0lDOHZJRWx1ZEdWeWJtRnNJSE4wWVhSbElHbHpJRzFsYzNObFpDQjFjQzVjYmlBZ0lDQWdJQzh2SUZOMGIzQWdZblZwYkdScGJtY2dkR2hsSUhOMFlXTnJJQ2hwZENkeklHcDFjM1FnWVNCdWFXTmxJSFJ2SUdoaGRtVXBMbHh1SUNBZ0lIMWNibHh1SUNBZ0lHTnZibk52YkdVdWNtVmhZM1JUZEdGamF5aHpkR0ZqYXlrN1hHNGdJSDBzWEc0Z0lIQnZjRTV2YmxOMFlXNWtZWEprVjJGeWJtbHVaMU4wWVdOck9pQm1kVzVqZEdsdmJpQW9LU0I3WEc0Z0lDQWdhV1lnS0hSNWNHVnZaaUJqYjI1emIyeGxMbkpsWVdOMFUzUmhZMnRGYm1RZ0lUMDlJQ2RtZFc1amRHbHZiaWNwSUh0Y2JpQWdJQ0FnSUhKbGRIVnlianRjYmlBZ0lDQjlYRzRnSUNBZ1kyOXVjMjlzWlM1eVpXRmpkRk4wWVdOclJXNWtLQ2s3WEc0Z0lIMWNibjA3WEc1Y2JtMXZaSFZzWlM1bGVIQnZjblJ6SUQwZ1VtVmhZM1JEYjIxd2IyNWxiblJVY21WbFNHOXZhenNpTENJdktpcGNiaUFxSUVOdmNIbHlhV2RvZENBeU1ERXpMWEJ5WlhObGJuUXNJRVpoWTJWaWIyOXJMQ0JKYm1NdVhHNGdLaUJCYkd3Z2NtbG5hSFJ6SUhKbGMyVnlkbVZrTGx4dUlDcGNiaUFxSUZSb2FYTWdjMjkxY21ObElHTnZaR1VnYVhNZ2JHbGpaVzV6WldRZ2RXNWtaWElnZEdobElFSlRSQzF6ZEhsc1pTQnNhV05sYm5ObElHWnZkVzVrSUdsdUlIUm9aVnh1SUNvZ1RFbERSVTVUUlNCbWFXeGxJR2x1SUhSb1pTQnliMjkwSUdScGNtVmpkRzl5ZVNCdlppQjBhR2x6SUhOdmRYSmpaU0IwY21WbExpQkJiaUJoWkdScGRHbHZibUZzSUdkeVlXNTBYRzRnS2lCdlppQndZWFJsYm5RZ2NtbG5hSFJ6SUdOaGJpQmlaU0JtYjNWdVpDQnBiaUIwYUdVZ1VFRlVSVTVVVXlCbWFXeGxJR2x1SUhSb1pTQnpZVzFsSUdScGNtVmpkRzl5ZVM1Y2JpQXFYRzRnS2lCY2JpQXFMMXh1WEc0bmRYTmxJSE4wY21samRDYzdYRzVjYmk4cUtseHVJQ29nUzJWbGNITWdkSEpoWTJzZ2IyWWdkR2hsSUdOMWNuSmxiblFnYjNkdVpYSXVYRzRnS2x4dUlDb2dWR2hsSUdOMWNuSmxiblFnYjNkdVpYSWdhWE1nZEdobElHTnZiWEJ2Ym1WdWRDQjNhRzhnYzJodmRXeGtJRzkzYmlCaGJua2dZMjl0Y0c5dVpXNTBjeUIwYUdGMElHRnlaVnh1SUNvZ1kzVnljbVZ1ZEd4NUlHSmxhVzVuSUdOdmJuTjBjblZqZEdWa0xseHVJQ292WEc1MllYSWdVbVZoWTNSRGRYSnlaVzUwVDNkdVpYSWdQU0I3WEc0Z0lDOHFLbHh1SUNBZ0tpQkFhVzUwWlhKdVlXeGNiaUFnSUNvZ1FIUjVjR1VnZTFKbFlXTjBRMjl0Y0c5dVpXNTBmVnh1SUNBZ0tpOWNiaUFnWTNWeWNtVnVkRG9nYm5Wc2JGeHVmVHRjYmx4dWJXOWtkV3hsTG1WNGNHOXlkSE1nUFNCU1pXRmpkRU4xY25KbGJuUlBkMjVsY2pzaUxDSXZLaXBjYmlBcUlFTnZjSGx5YVdkb2RDQXlNREV6TFhCeVpYTmxiblFzSUVaaFkyVmliMjlyTENCSmJtTXVYRzRnS2lCQmJHd2djbWxuYUhSeklISmxjMlZ5ZG1Wa0xseHVJQ3BjYmlBcUlGUm9hWE1nYzI5MWNtTmxJR052WkdVZ2FYTWdiR2xqWlc1elpXUWdkVzVrWlhJZ2RHaGxJRUpUUkMxemRIbHNaU0JzYVdObGJuTmxJR1p2ZFc1a0lHbHVJSFJvWlZ4dUlDb2dURWxEUlU1VFJTQm1hV3hsSUdsdUlIUm9aU0J5YjI5MElHUnBjbVZqZEc5eWVTQnZaaUIwYUdseklITnZkWEpqWlNCMGNtVmxMaUJCYmlCaFpHUnBkR2x2Ym1Gc0lHZHlZVzUwWEc0Z0tpQnZaaUJ3WVhSbGJuUWdjbWxuYUhSeklHTmhiaUJpWlNCbWIzVnVaQ0JwYmlCMGFHVWdVRUZVUlU1VVV5Qm1hV3hsSUdsdUlIUm9aU0J6WVcxbElHUnBjbVZqZEc5eWVTNWNiaUFxWEc0Z0tpOWNibHh1SjNWelpTQnpkSEpwWTNRbk8xeHVYRzUyWVhJZ1VtVmhZM1JGYkdWdFpXNTBJRDBnY21WeGRXbHlaU2duTGk5U1pXRmpkRVZzWlcxbGJuUW5LVHRjYmx4dUx5b3FYRzRnS2lCRGNtVmhkR1VnWVNCbVlXTjBiM0o1SUhSb1lYUWdZM0psWVhSbGN5QklWRTFNSUhSaFp5QmxiR1Z0Wlc1MGN5NWNiaUFxWEc0Z0tpQkFjSEpwZG1GMFpWeHVJQ292WEc1MllYSWdZM0psWVhSbFJFOU5SbUZqZEc5eWVTQTlJRkpsWVdOMFJXeGxiV1Z1ZEM1amNtVmhkR1ZHWVdOMGIzSjVPMXh1YVdZZ0tIQnliMk5sYzNNdVpXNTJMazVQUkVWZlJVNVdJQ0U5UFNBbmNISnZaSFZqZEdsdmJpY3BJSHRjYmlBZ2RtRnlJRkpsWVdOMFJXeGxiV1Z1ZEZaaGJHbGtZWFJ2Y2lBOUlISmxjWFZwY21Vb0p5NHZVbVZoWTNSRmJHVnRaVzUwVm1Gc2FXUmhkRzl5SnlrN1hHNGdJR055WldGMFpVUlBUVVpoWTNSdmNua2dQU0JTWldGamRFVnNaVzFsYm5SV1lXeHBaR0YwYjNJdVkzSmxZWFJsUm1GamRHOXllVHRjYm4xY2JseHVMeW9xWEc0Z0tpQkRjbVZoZEdWeklHRWdiV0Z3Y0dsdVp5Qm1jbTl0SUhOMWNIQnZjblJsWkNCSVZFMU1JSFJoWjNNZ2RHOGdZRkpsWVdOMFJFOU5RMjl0Y0c5dVpXNTBZQ0JqYkdGemMyVnpMbHh1SUNwY2JpQXFJRUJ3ZFdKc2FXTmNiaUFxTDF4dWRtRnlJRkpsWVdOMFJFOU5SbUZqZEc5eWFXVnpJRDBnZTF4dUlDQmhPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2RoSnlrc1hHNGdJR0ZpWW5JNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oyRmlZbkluS1N4Y2JpQWdZV1JrY21WemN6b2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25ZV1JrY21WemN5Y3BMRnh1SUNCaGNtVmhPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2RoY21WaEp5a3NYRzRnSUdGeWRHbGpiR1U2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjJGeWRHbGpiR1VuS1N4Y2JpQWdZWE5wWkdVNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oyRnphV1JsSnlrc1hHNGdJR0YxWkdsdk9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZGhkV1JwYnljcExGeHVJQ0JpT2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkaUp5a3NYRzRnSUdKaGMyVTZJR055WldGMFpVUlBUVVpoWTNSdmNua29KMkpoYzJVbktTeGNiaUFnWW1ScE9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZGlaR2tuS1N4Y2JpQWdZbVJ2T2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkaVpHOG5LU3hjYmlBZ1ltbG5PaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2RpYVdjbktTeGNiaUFnWW14dlkydHhkVzkwWlRvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbllteHZZMnR4ZFc5MFpTY3BMRnh1SUNCaWIyUjVPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2RpYjJSNUp5a3NYRzRnSUdKeU9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZGljaWNwTEZ4dUlDQmlkWFIwYjI0NklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oySjFkSFJ2YmljcExGeHVJQ0JqWVc1MllYTTZJR055WldGMFpVUlBUVVpoWTNSdmNua29KMk5oYm5aaGN5Y3BMRnh1SUNCallYQjBhVzl1T2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkallYQjBhVzl1Snlrc1hHNGdJR05wZEdVNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oyTnBkR1VuS1N4Y2JpQWdZMjlrWlRvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnblkyOWtaU2NwTEZ4dUlDQmpiMnc2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjJOdmJDY3BMRnh1SUNCamIyeG5jbTkxY0RvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnblkyOXNaM0p2ZFhBbktTeGNiaUFnWkdGMFlUb2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25aR0YwWVNjcExGeHVJQ0JrWVhSaGJHbHpkRG9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duWkdGMFlXeHBjM1FuS1N4Y2JpQWdaR1E2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjJSa0p5a3NYRzRnSUdSbGJEb2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25aR1ZzSnlrc1hHNGdJR1JsZEdGcGJITTZJR055WldGMFpVUlBUVVpoWTNSdmNua29KMlJsZEdGcGJITW5LU3hjYmlBZ1pHWnVPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2RrWm00bktTeGNiaUFnWkdsaGJHOW5PaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2RrYVdGc2IyY25LU3hjYmlBZ1pHbDJPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2RrYVhZbktTeGNiaUFnWkd3NklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oyUnNKeWtzWEc0Z0lHUjBPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2RrZENjcExGeHVJQ0JsYlRvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnblpXMG5LU3hjYmlBZ1pXMWlaV1E2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjJWdFltVmtKeWtzWEc0Z0lHWnBaV3hrYzJWME9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZG1hV1ZzWkhObGRDY3BMRnh1SUNCbWFXZGpZWEIwYVc5dU9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZG1hV2RqWVhCMGFXOXVKeWtzWEc0Z0lHWnBaM1Z5WlRvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnblptbG5kWEpsSnlrc1hHNGdJR1p2YjNSbGNqb2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25abTl2ZEdWeUp5a3NYRzRnSUdadmNtMDZJR055WldGMFpVUlBUVVpoWTNSdmNua29KMlp2Y20wbktTeGNiaUFnYURFNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oyZ3hKeWtzWEc0Z0lHZ3lPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2RvTWljcExGeHVJQ0JvTXpvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbmFETW5LU3hjYmlBZ2FEUTZJR055WldGMFpVUlBUVVpoWTNSdmNua29KMmcwSnlrc1hHNGdJR2cxT2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0Nkb05TY3BMRnh1SUNCb05qb2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25hRFluS1N4Y2JpQWdhR1ZoWkRvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbmFHVmhaQ2NwTEZ4dUlDQm9aV0ZrWlhJNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oyaGxZV1JsY2ljcExGeHVJQ0JvWjNKdmRYQTZJR055WldGMFpVUlBUVVpoWTNSdmNua29KMmhuY205MWNDY3BMRnh1SUNCb2Nqb2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25hSEluS1N4Y2JpQWdhSFJ0YkRvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbmFIUnRiQ2NwTEZ4dUlDQnBPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2RwSnlrc1hHNGdJR2xtY21GdFpUb2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25hV1p5WVcxbEp5a3NYRzRnSUdsdFp6b2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25hVzFuSnlrc1hHNGdJR2x1Y0hWME9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZHBibkIxZENjcExGeHVJQ0JwYm5NNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oybHVjeWNwTEZ4dUlDQnJZbVE2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjJ0aVpDY3BMRnh1SUNCclpYbG5aVzQ2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjJ0bGVXZGxiaWNwTEZ4dUlDQnNZV0psYkRvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbmJHRmlaV3duS1N4Y2JpQWdiR1ZuWlc1a09pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZHNaV2RsYm1RbktTeGNiaUFnYkdrNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oyeHBKeWtzWEc0Z0lHeHBibXM2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjJ4cGJtc25LU3hjYmlBZ2JXRnBiam9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duYldGcGJpY3BMRnh1SUNCdFlYQTZJR055WldGMFpVUlBUVVpoWTNSdmNua29KMjFoY0NjcExGeHVJQ0J0WVhKck9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZHRZWEpySnlrc1hHNGdJRzFsYm5VNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oyMWxiblVuS1N4Y2JpQWdiV1Z1ZFdsMFpXMDZJR055WldGMFpVUlBUVVpoWTNSdmNua29KMjFsYm5WcGRHVnRKeWtzWEc0Z0lHMWxkR0U2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjIxbGRHRW5LU3hjYmlBZ2JXVjBaWEk2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjIxbGRHVnlKeWtzWEc0Z0lHNWhkam9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duYm1GMkp5a3NYRzRnSUc1dmMyTnlhWEIwT2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkdWIzTmpjbWx3ZENjcExGeHVJQ0J2WW1wbFkzUTZJR055WldGMFpVUlBUVVpoWTNSdmNua29KMjlpYW1WamRDY3BMRnh1SUNCdmJEb2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25iMnduS1N4Y2JpQWdiM0IwWjNKdmRYQTZJR055WldGMFpVUlBUVVpoWTNSdmNua29KMjl3ZEdkeWIzVndKeWtzWEc0Z0lHOXdkR2x2YmpvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbmIzQjBhVzl1Snlrc1hHNGdJRzkxZEhCMWREb2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25iM1YwY0hWMEp5a3NYRzRnSUhBNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0ozQW5LU3hjYmlBZ2NHRnlZVzA2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjNCaGNtRnRKeWtzWEc0Z0lIQnBZM1IxY21VNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0ozQnBZM1IxY21VbktTeGNiaUFnY0hKbE9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZHdjbVVuS1N4Y2JpQWdjSEp2WjNKbGMzTTZJR055WldGMFpVUlBUVVpoWTNSdmNua29KM0J5YjJkeVpYTnpKeWtzWEc0Z0lIRTZJR055WldGMFpVUlBUVVpoWTNSdmNua29KM0VuS1N4Y2JpQWdjbkE2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjNKd0p5a3NYRzRnSUhKME9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZHlkQ2NwTEZ4dUlDQnlkV0o1T2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkeWRXSjVKeWtzWEc0Z0lITTZJR055WldGMFpVUlBUVVpoWTNSdmNua29KM01uS1N4Y2JpQWdjMkZ0Y0RvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbmMyRnRjQ2NwTEZ4dUlDQnpZM0pwY0hRNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0ozTmpjbWx3ZENjcExGeHVJQ0J6WldOMGFXOXVPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2R6WldOMGFXOXVKeWtzWEc0Z0lITmxiR1ZqZERvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbmMyVnNaV04wSnlrc1hHNGdJSE50WVd4c09pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZHpiV0ZzYkNjcExGeHVJQ0J6YjNWeVkyVTZJR055WldGMFpVUlBUVVpoWTNSdmNua29KM052ZFhKalpTY3BMRnh1SUNCemNHRnVPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2R6Y0dGdUp5a3NYRzRnSUhOMGNtOXVaem9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duYzNSeWIyNW5KeWtzWEc0Z0lITjBlV3hsT2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkemRIbHNaU2NwTEZ4dUlDQnpkV0k2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjNOMVlpY3BMRnh1SUNCemRXMXRZWEo1T2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkemRXMXRZWEo1Snlrc1hHNGdJSE4xY0RvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbmMzVndKeWtzWEc0Z0lIUmhZbXhsT2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkMFlXSnNaU2NwTEZ4dUlDQjBZbTlrZVRvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbmRHSnZaSGtuS1N4Y2JpQWdkR1E2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjNSa0p5a3NYRzRnSUhSbGVIUmhjbVZoT2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkMFpYaDBZWEpsWVNjcExGeHVJQ0IwWm05dmREb2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25kR1p2YjNRbktTeGNiaUFnZEdnNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0ozUm9KeWtzWEc0Z0lIUm9aV0ZrT2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkMGFHVmhaQ2NwTEZ4dUlDQjBhVzFsT2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkMGFXMWxKeWtzWEc0Z0lIUnBkR3hsT2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkMGFYUnNaU2NwTEZ4dUlDQjBjam9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duZEhJbktTeGNiaUFnZEhKaFkyczZJR055WldGMFpVUlBUVVpoWTNSdmNua29KM1J5WVdOckp5a3NYRzRnSUhVNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0ozVW5LU3hjYmlBZ2RXdzZJR055WldGMFpVUlBUVVpoWTNSdmNua29KM1ZzSnlrc1hHNGdJQ2QyWVhJbk9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZDJZWEluS1N4Y2JpQWdkbWxrWlc4NklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0ozWnBaR1Z2Snlrc1hHNGdJSGRpY2pvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbmQySnlKeWtzWEc1Y2JpQWdMeThnVTFaSFhHNGdJR05wY21Oc1pUb2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25ZMmx5WTJ4bEp5a3NYRzRnSUdOc2FYQlFZWFJvT2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkamJHbHdVR0YwYUNjcExGeHVJQ0JrWldaek9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZGtaV1p6Snlrc1hHNGdJR1ZzYkdsd2MyVTZJR055WldGMFpVUlBUVVpoWTNSdmNua29KMlZzYkdsd2MyVW5LU3hjYmlBZ1p6b2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25aeWNwTEZ4dUlDQnBiV0ZuWlRvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbmFXMWhaMlVuS1N4Y2JpQWdiR2x1WlRvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbmJHbHVaU2NwTEZ4dUlDQnNhVzVsWVhKSGNtRmthV1Z1ZERvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbmJHbHVaV0Z5UjNKaFpHbGxiblFuS1N4Y2JpQWdiV0Z6YXpvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbmJXRnpheWNwTEZ4dUlDQndZWFJvT2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0Nkd1lYUm9KeWtzWEc0Z0lIQmhkSFJsY200NklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0ozQmhkSFJsY200bktTeGNiaUFnY0c5c2VXZHZiam9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duY0c5c2VXZHZiaWNwTEZ4dUlDQndiMng1YkdsdVpUb2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25jRzlzZVd4cGJtVW5LU3hjYmlBZ2NtRmthV0ZzUjNKaFpHbGxiblE2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjNKaFpHbGhiRWR5WVdScFpXNTBKeWtzWEc0Z0lISmxZM1E2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjNKbFkzUW5LU3hjYmlBZ2MzUnZjRG9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duYzNSdmNDY3BMRnh1SUNCemRtYzZJR055WldGMFpVUlBUVVpoWTNSdmNua29KM04yWnljcExGeHVJQ0IwWlhoME9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZDBaWGgwSnlrc1hHNGdJSFJ6Y0dGdU9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZDBjM0JoYmljcFhHNTlPMXh1WEc1dGIyUjFiR1V1Wlhod2IzSjBjeUE5SUZKbFlXTjBSRTlOUm1GamRHOXlhV1Z6T3lJc0lpOHFLbHh1SUNvZ1EyOXdlWEpwWjJoMElESXdNVFF0Y0hKbGMyVnVkQ3dnUm1GalpXSnZiMnNzSUVsdVl5NWNiaUFxSUVGc2JDQnlhV2RvZEhNZ2NtVnpaWEoyWldRdVhHNGdLbHh1SUNvZ1ZHaHBjeUJ6YjNWeVkyVWdZMjlrWlNCcGN5QnNhV05sYm5ObFpDQjFibVJsY2lCMGFHVWdRbE5FTFhOMGVXeGxJR3hwWTJWdWMyVWdabTkxYm1RZ2FXNGdkR2hsWEc0Z0tpQk1TVU5GVGxORklHWnBiR1VnYVc0Z2RHaGxJSEp2YjNRZ1pHbHlaV04wYjNKNUlHOW1JSFJvYVhNZ2MyOTFjbU5sSUhSeVpXVXVJRUZ1SUdGa1pHbDBhVzl1WVd3Z1ozSmhiblJjYmlBcUlHOW1JSEJoZEdWdWRDQnlhV2RvZEhNZ1kyRnVJR0psSUdadmRXNWtJR2x1SUhSb1pTQlFRVlJGVGxSVElHWnBiR1VnYVc0Z2RHaGxJSE5oYldVZ1pHbHlaV04wYjNKNUxseHVJQ3BjYmlBcUwxeHVYRzRuZFhObElITjBjbWxqZENjN1hHNWNiblpoY2lCZllYTnphV2R1SUQwZ2NtVnhkV2x5WlNnbmIySnFaV04wTFdGemMybG5iaWNwTzF4dVhHNTJZWElnVW1WaFkzUkRkWEp5Wlc1MFQzZHVaWElnUFNCeVpYRjFhWEpsS0NjdUwxSmxZV04wUTNWeWNtVnVkRTkzYm1WeUp5azdYRzVjYm5aaGNpQjNZWEp1YVc1bklEMGdjbVZ4ZFdseVpTZ25abUpxY3k5c2FXSXZkMkZ5Ym1sdVp5Y3BPMXh1ZG1GeUlHTmhia1JsWm1sdVpWQnliM0JsY25SNUlEMGdjbVZ4ZFdseVpTZ25MaTlqWVc1RVpXWnBibVZRY205d1pYSjBlU2NwTzF4dWRtRnlJR2hoYzA5M2JsQnliM0JsY25SNUlEMGdUMkpxWldOMExuQnliM1J2ZEhsd1pTNW9ZWE5QZDI1UWNtOXdaWEowZVR0Y2JseHVkbUZ5SUZKRlFVTlVYMFZNUlUxRlRsUmZWRmxRUlNBOUlISmxjWFZwY21Vb0p5NHZVbVZoWTNSRmJHVnRaVzUwVTNsdFltOXNKeWs3WEc1Y2JuWmhjaUJTUlZORlVsWkZSRjlRVWs5UVV5QTlJSHRjYmlBZ2EyVjVPaUIwY25WbExGeHVJQ0J5WldZNklIUnlkV1VzWEc0Z0lGOWZjMlZzWmpvZ2RISjFaU3hjYmlBZ1gxOXpiM1Z5WTJVNklIUnlkV1ZjYm4wN1hHNWNiblpoY2lCemNHVmphV0ZzVUhKdmNFdGxlVmRoY201cGJtZFRhRzkzYml3Z2MzQmxZMmxoYkZCeWIzQlNaV1pYWVhKdWFXNW5VMmh2ZDI0N1hHNWNibVoxYm1OMGFXOXVJR2hoYzFaaGJHbGtVbVZtS0dOdmJtWnBaeWtnZTF4dUlDQnBaaUFvY0hKdlkyVnpjeTVsYm5ZdVRrOUVSVjlGVGxZZ0lUMDlJQ2R3Y205a2RXTjBhVzl1SnlrZ2UxeHVJQ0FnSUdsbUlDaG9ZWE5QZDI1UWNtOXdaWEowZVM1allXeHNLR052Ym1acFp5d2dKM0psWmljcEtTQjdYRzRnSUNBZ0lDQjJZWElnWjJWMGRHVnlJRDBnVDJKcVpXTjBMbWRsZEU5M2JsQnliM0JsY25SNVJHVnpZM0pwY0hSdmNpaGpiMjVtYVdjc0lDZHlaV1luS1M1blpYUTdYRzRnSUNBZ0lDQnBaaUFvWjJWMGRHVnlJQ1ltSUdkbGRIUmxjaTVwYzFKbFlXTjBWMkZ5Ym1sdVp5a2dlMXh1SUNBZ0lDQWdJQ0J5WlhSMWNtNGdabUZzYzJVN1hHNGdJQ0FnSUNCOVhHNGdJQ0FnZlZ4dUlDQjlYRzRnSUhKbGRIVnliaUJqYjI1bWFXY3VjbVZtSUNFOVBTQjFibVJsWm1sdVpXUTdYRzU5WEc1Y2JtWjFibU4wYVc5dUlHaGhjMVpoYkdsa1MyVjVLR052Ym1acFp5a2dlMXh1SUNCcFppQW9jSEp2WTJWemN5NWxibll1VGs5RVJWOUZUbFlnSVQwOUlDZHdjbTlrZFdOMGFXOXVKeWtnZTF4dUlDQWdJR2xtSUNob1lYTlBkMjVRY205d1pYSjBlUzVqWVd4c0tHTnZibVpwWnl3Z0oydGxlU2NwS1NCN1hHNGdJQ0FnSUNCMllYSWdaMlYwZEdWeUlEMGdUMkpxWldOMExtZGxkRTkzYmxCeWIzQmxjblI1UkdWelkzSnBjSFJ2Y2loamIyNW1hV2NzSUNkclpYa25LUzVuWlhRN1hHNGdJQ0FnSUNCcFppQW9aMlYwZEdWeUlDWW1JR2RsZEhSbGNpNXBjMUpsWVdOMFYyRnlibWx1WnlrZ2UxeHVJQ0FnSUNBZ0lDQnlaWFIxY200Z1ptRnNjMlU3WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdmVnh1SUNCOVhHNGdJSEpsZEhWeWJpQmpiMjVtYVdjdWEyVjVJQ0U5UFNCMWJtUmxabWx1WldRN1hHNTlYRzVjYm1aMWJtTjBhVzl1SUdSbFptbHVaVXRsZVZCeWIzQlhZWEp1YVc1blIyVjBkR1Z5S0hCeWIzQnpMQ0JrYVhOd2JHRjVUbUZ0WlNrZ2UxeHVJQ0IyWVhJZ2QyRnlia0ZpYjNWMFFXTmpaWE56YVc1blMyVjVJRDBnWm5WdVkzUnBiMjRnS0NrZ2UxeHVJQ0FnSUdsbUlDZ2hjM0JsWTJsaGJGQnliM0JMWlhsWFlYSnVhVzVuVTJodmQyNHBJSHRjYmlBZ0lDQWdJSE53WldOcFlXeFFjbTl3UzJWNVYyRnlibWx1WjFOb2IzZHVJRDBnZEhKMVpUdGNiaUFnSUNBZ0lIQnliMk5sYzNNdVpXNTJMazVQUkVWZlJVNVdJQ0U5UFNBbmNISnZaSFZqZEdsdmJpY2dQeUIzWVhKdWFXNW5LR1poYkhObExDQW5KWE02SUdCclpYbGdJR2x6SUc1dmRDQmhJSEJ5YjNBdUlGUnllV2x1WnlCMGJ5QmhZMk5sYzNNZ2FYUWdkMmxzYkNCeVpYTjFiSFFnSnlBcklDZHBiaUJnZFc1a1pXWnBibVZrWUNCaVpXbHVaeUJ5WlhSMWNtNWxaQzRnU1dZZ2VXOTFJRzVsWldRZ2RHOGdZV05qWlhOeklIUm9aU0J6WVcxbElDY2dLeUFuZG1Gc2RXVWdkMmwwYUdsdUlIUm9aU0JqYUdsc1pDQmpiMjF3YjI1bGJuUXNJSGx2ZFNCemFHOTFiR1FnY0dGemN5QnBkQ0JoY3lCaElHUnBabVpsY21WdWRDQW5JQ3NnSjNCeWIzQXVJQ2hvZEhSd2N6b3ZMMlppTG0xbEwzSmxZV04wTFhOd1pXTnBZV3d0Y0hKdmNITXBKeXdnWkdsemNHeGhlVTVoYldVcElEb2dkbTlwWkNBd08xeHVJQ0FnSUgxY2JpQWdmVHRjYmlBZ2QyRnlia0ZpYjNWMFFXTmpaWE56YVc1blMyVjVMbWx6VW1WaFkzUlhZWEp1YVc1bklEMGdkSEoxWlR0Y2JpQWdUMkpxWldOMExtUmxabWx1WlZCeWIzQmxjblI1S0hCeWIzQnpMQ0FuYTJWNUp5d2dlMXh1SUNBZ0lHZGxkRG9nZDJGeWJrRmliM1YwUVdOalpYTnphVzVuUzJWNUxGeHVJQ0FnSUdOdmJtWnBaM1Z5WVdKc1pUb2dkSEoxWlZ4dUlDQjlLVHRjYm4xY2JseHVablZ1WTNScGIyNGdaR1ZtYVc1bFVtVm1VSEp2Y0ZkaGNtNXBibWRIWlhSMFpYSW9jSEp2Y0hNc0lHUnBjM0JzWVhsT1lXMWxLU0I3WEc0Z0lIWmhjaUIzWVhKdVFXSnZkWFJCWTJObGMzTnBibWRTWldZZ1BTQm1kVzVqZEdsdmJpQW9LU0I3WEc0Z0lDQWdhV1lnS0NGemNHVmphV0ZzVUhKdmNGSmxabGRoY201cGJtZFRhRzkzYmlrZ2UxeHVJQ0FnSUNBZ2MzQmxZMmxoYkZCeWIzQlNaV1pYWVhKdWFXNW5VMmh2ZDI0Z1BTQjBjblZsTzF4dUlDQWdJQ0FnY0hKdlkyVnpjeTVsYm5ZdVRrOUVSVjlGVGxZZ0lUMDlJQ2R3Y205a2RXTjBhVzl1SnlBL0lIZGhjbTVwYm1jb1ptRnNjMlVzSUNjbGN6b2dZSEpsWm1BZ2FYTWdibTkwSUdFZ2NISnZjQzRnVkhKNWFXNW5JSFJ2SUdGalkyVnpjeUJwZENCM2FXeHNJSEpsYzNWc2RDQW5JQ3NnSjJsdUlHQjFibVJsWm1sdVpXUmdJR0psYVc1bklISmxkSFZ5Ym1Wa0xpQkpaaUI1YjNVZ2JtVmxaQ0IwYnlCaFkyTmxjM01nZEdobElITmhiV1VnSnlBcklDZDJZV3gxWlNCM2FYUm9hVzRnZEdobElHTm9hV3hrSUdOdmJYQnZibVZ1ZEN3Z2VXOTFJSE5vYjNWc1pDQndZWE56SUdsMElHRnpJR0VnWkdsbVptVnlaVzUwSUNjZ0t5QW5jSEp2Y0M0Z0tHaDBkSEJ6T2k4dlptSXViV1V2Y21WaFkzUXRjM0JsWTJsaGJDMXdjbTl3Y3lrbkxDQmthWE53YkdGNVRtRnRaU2tnT2lCMmIybGtJREE3WEc0Z0lDQWdmVnh1SUNCOU8xeHVJQ0IzWVhKdVFXSnZkWFJCWTJObGMzTnBibWRTWldZdWFYTlNaV0ZqZEZkaGNtNXBibWNnUFNCMGNuVmxPMXh1SUNCUFltcGxZM1F1WkdWbWFXNWxVSEp2Y0dWeWRIa29jSEp2Y0hNc0lDZHlaV1luTENCN1hHNGdJQ0FnWjJWME9pQjNZWEp1UVdKdmRYUkJZMk5sYzNOcGJtZFNaV1lzWEc0Z0lDQWdZMjl1Wm1sbmRYSmhZbXhsT2lCMGNuVmxYRzRnSUgwcE8xeHVmVnh1WEc0dktpcGNiaUFxSUVaaFkzUnZjbmtnYldWMGFHOWtJSFJ2SUdOeVpXRjBaU0JoSUc1bGR5QlNaV0ZqZENCbGJHVnRaVzUwTGlCVWFHbHpJRzV2SUd4dmJtZGxjaUJoWkdobGNtVnpJSFJ2WEc0Z0tpQjBhR1VnWTJ4aGMzTWdjR0YwZEdWeWJpd2djMjhnWkc4Z2JtOTBJSFZ6WlNCdVpYY2dkRzhnWTJGc2JDQnBkQzRnUVd4emJ5d2dibThnYVc1emRHRnVZMlZ2WmlCamFHVmphMXh1SUNvZ2QybHNiQ0IzYjNKckxpQkpibk4wWldGa0lIUmxjM1FnSkNSMGVYQmxiMllnWm1sbGJHUWdZV2RoYVc1emRDQlRlVzFpYjJ3dVptOXlLQ2R5WldGamRDNWxiR1Z0Wlc1MEp5a2dkRzhnWTJobFkydGNiaUFxSUdsbUlITnZiV1YwYUdsdVp5QnBjeUJoSUZKbFlXTjBJRVZzWlcxbGJuUXVYRzRnS2x4dUlDb2dRSEJoY21GdElIc3FmU0IwZVhCbFhHNGdLaUJBY0dGeVlXMGdleXA5SUd0bGVWeHVJQ29nUUhCaGNtRnRJSHR6ZEhKcGJtZDhiMkpxWldOMGZTQnlaV1pjYmlBcUlFQndZWEpoYlNCN0tuMGdjMlZzWmlCQklDcDBaVzF3YjNKaGNua3FJR2hsYkhCbGNpQjBieUJrWlhSbFkzUWdjR3hoWTJWeklIZG9aWEpsSUdCMGFHbHpZQ0JwYzF4dUlDb2daR2xtWm1WeVpXNTBJR1p5YjIwZ2RHaGxJR0J2ZDI1bGNtQWdkMmhsYmlCU1pXRmpkQzVqY21WaGRHVkZiR1Z0Wlc1MElHbHpJR05oYkd4bFpDd2djMjhnZEdoaGRDQjNaVnh1SUNvZ1kyRnVJSGRoY200dUlGZGxJSGRoYm5RZ2RHOGdaMlYwSUhKcFpDQnZaaUJ2ZDI1bGNpQmhibVFnY21Wd2JHRmpaU0J6ZEhKcGJtY2dZSEpsWm1CeklIZHBkR2dnWVhKeWIzZGNiaUFxSUdaMWJtTjBhVzl1Y3l3Z1lXNWtJR0Z6SUd4dmJtY2dZWE1nWUhSb2FYTmdJR0Z1WkNCdmQyNWxjaUJoY21VZ2RHaGxJSE5oYldVc0lIUm9aWEpsSUhkcGJHd2dZbVVnYm05Y2JpQXFJR05vWVc1blpTQnBiaUJpWldoaGRtbHZjaTVjYmlBcUlFQndZWEpoYlNCN0tuMGdjMjkxY21ObElFRnVJR0Z1Ym05MFlYUnBiMjRnYjJKcVpXTjBJQ2hoWkdSbFpDQmllU0JoSUhSeVlXNXpjR2xzWlhJZ2IzSWdiM1JvWlhKM2FYTmxLVnh1SUNvZ2FXNWthV05oZEdsdVp5Qm1hV3hsYm1GdFpTd2diR2x1WlNCdWRXMWlaWElzSUdGdVpDOXZjaUJ2ZEdobGNpQnBibVp2Y20xaGRHbHZiaTVjYmlBcUlFQndZWEpoYlNCN0tuMGdiM2R1WlhKY2JpQXFJRUJ3WVhKaGJTQjdLbjBnY0hKdmNITmNiaUFxSUVCcGJuUmxjbTVoYkZ4dUlDb3ZYRzUyWVhJZ1VtVmhZM1JGYkdWdFpXNTBJRDBnWm5WdVkzUnBiMjRnS0hSNWNHVXNJR3RsZVN3Z2NtVm1MQ0J6Wld4bUxDQnpiM1Z5WTJVc0lHOTNibVZ5TENCd2NtOXdjeWtnZTF4dUlDQjJZWElnWld4bGJXVnVkQ0E5SUh0Y2JpQWdJQ0F2THlCVWFHbHpJSFJoWnlCaGJHeHZkeUIxY3lCMGJ5QjFibWx4ZFdWc2VTQnBaR1Z1ZEdsbWVTQjBhR2x6SUdGeklHRWdVbVZoWTNRZ1JXeGxiV1Z1ZEZ4dUlDQWdJQ1FrZEhsd1pXOW1PaUJTUlVGRFZGOUZURVZOUlU1VVgxUlpVRVVzWEc1Y2JpQWdJQ0F2THlCQ2RXbHNkQzFwYmlCd2NtOXdaWEowYVdWeklIUm9ZWFFnWW1Wc2IyNW5JRzl1SUhSb1pTQmxiR1Z0Wlc1MFhHNGdJQ0FnZEhsd1pUb2dkSGx3WlN4Y2JpQWdJQ0JyWlhrNklHdGxlU3hjYmlBZ0lDQnlaV1k2SUhKbFppeGNiaUFnSUNCd2NtOXdjem9nY0hKdmNITXNYRzVjYmlBZ0lDQXZMeUJTWldOdmNtUWdkR2hsSUdOdmJYQnZibVZ1ZENCeVpYTndiMjV6YVdKc1pTQm1iM0lnWTNKbFlYUnBibWNnZEdocGN5QmxiR1Z0Wlc1MExseHVJQ0FnSUY5dmQyNWxjam9nYjNkdVpYSmNiaUFnZlR0Y2JseHVJQ0JwWmlBb2NISnZZMlZ6Y3k1bGJuWXVUazlFUlY5RlRsWWdJVDA5SUNkd2NtOWtkV04wYVc5dUp5a2dlMXh1SUNBZ0lDOHZJRlJvWlNCMllXeHBaR0YwYVc5dUlHWnNZV2NnYVhNZ1kzVnljbVZ1ZEd4NUlHMTFkR0YwYVhabExpQlhaU0J3ZFhRZ2FYUWdiMjVjYmlBZ0lDQXZMeUJoYmlCbGVIUmxjbTVoYkNCaVlXTnJhVzVuSUhOMGIzSmxJSE52SUhSb1lYUWdkMlVnWTJGdUlHWnlaV1Y2WlNCMGFHVWdkMmh2YkdVZ2IySnFaV04wTGx4dUlDQWdJQzh2SUZSb2FYTWdZMkZ1SUdKbElISmxjR3hoWTJWa0lIZHBkR2dnWVNCWFpXRnJUV0Z3SUc5dVkyVWdkR2hsZVNCaGNtVWdhVzF3YkdWdFpXNTBaV1FnYVc1Y2JpQWdJQ0F2THlCamIyMXRiMjVzZVNCMWMyVmtJR1JsZG1Wc2IzQnRaVzUwSUdWdWRtbHliMjV0Wlc1MGN5NWNiaUFnSUNCbGJHVnRaVzUwTGw5emRHOXlaU0E5SUh0OU8xeHVYRzRnSUNBZ0x5OGdWRzhnYldGclpTQmpiMjF3WVhKcGJtY2dVbVZoWTNSRmJHVnRaVzUwY3lCbFlYTnBaWElnWm05eUlIUmxjM1JwYm1jZ2NIVnljRzl6WlhNc0lIZGxJRzFoYTJWY2JpQWdJQ0F2THlCMGFHVWdkbUZzYVdSaGRHbHZiaUJtYkdGbklHNXZiaTFsYm5WdFpYSmhZbXhsSUNoM2FHVnlaU0J3YjNOemFXSnNaU3dnZDJocFkyZ2djMmh2ZFd4a1hHNGdJQ0FnTHk4Z2FXNWpiSFZrWlNCbGRtVnllU0JsYm5acGNtOXViV1Z1ZENCM1pTQnlkVzRnZEdWemRITWdhVzRwTENCemJ5QjBhR1VnZEdWemRDQm1jbUZ0WlhkdmNtdGNiaUFnSUNBdkx5QnBaMjV2Y21WeklHbDBMbHh1SUNBZ0lHbG1JQ2hqWVc1RVpXWnBibVZRY205d1pYSjBlU2tnZTF4dUlDQWdJQ0FnVDJKcVpXTjBMbVJsWm1sdVpWQnliM0JsY25SNUtHVnNaVzFsYm5RdVgzTjBiM0psTENBbmRtRnNhV1JoZEdWa0p5d2dlMXh1SUNBZ0lDQWdJQ0JqYjI1bWFXZDFjbUZpYkdVNklHWmhiSE5sTEZ4dUlDQWdJQ0FnSUNCbGJuVnRaWEpoWW14bE9pQm1ZV3h6WlN4Y2JpQWdJQ0FnSUNBZ2QzSnBkR0ZpYkdVNklIUnlkV1VzWEc0Z0lDQWdJQ0FnSUhaaGJIVmxPaUJtWVd4elpWeHVJQ0FnSUNBZ2ZTazdYRzRnSUNBZ0lDQXZMeUJ6Wld4bUlHRnVaQ0J6YjNWeVkyVWdZWEpsSUVSRlZpQnZibXg1SUhCeWIzQmxjblJwWlhNdVhHNGdJQ0FnSUNCUFltcGxZM1F1WkdWbWFXNWxVSEp2Y0dWeWRIa29aV3hsYldWdWRDd2dKMTl6Wld4bUp5d2dlMXh1SUNBZ0lDQWdJQ0JqYjI1bWFXZDFjbUZpYkdVNklHWmhiSE5sTEZ4dUlDQWdJQ0FnSUNCbGJuVnRaWEpoWW14bE9pQm1ZV3h6WlN4Y2JpQWdJQ0FnSUNBZ2QzSnBkR0ZpYkdVNklHWmhiSE5sTEZ4dUlDQWdJQ0FnSUNCMllXeDFaVG9nYzJWc1pseHVJQ0FnSUNBZ2ZTazdYRzRnSUNBZ0lDQXZMeUJVZDI4Z1pXeGxiV1Z1ZEhNZ1kzSmxZWFJsWkNCcGJpQjBkMjhnWkdsbVptVnlaVzUwSUhCc1lXTmxjeUJ6YUc5MWJHUWdZbVVnWTI5dWMybGtaWEpsWkZ4dUlDQWdJQ0FnTHk4Z1pYRjFZV3dnWm05eUlIUmxjM1JwYm1jZ2NIVnljRzl6WlhNZ1lXNWtJSFJvWlhKbFptOXlaU0IzWlNCb2FXUmxJR2wwSUdaeWIyMGdaVzUxYldWeVlYUnBiMjR1WEc0Z0lDQWdJQ0JQWW1wbFkzUXVaR1ZtYVc1bFVISnZjR1Z5ZEhrb1pXeGxiV1Z1ZEN3Z0oxOXpiM1Z5WTJVbkxDQjdYRzRnSUNBZ0lDQWdJR052Ym1acFozVnlZV0pzWlRvZ1ptRnNjMlVzWEc0Z0lDQWdJQ0FnSUdWdWRXMWxjbUZpYkdVNklHWmhiSE5sTEZ4dUlDQWdJQ0FnSUNCM2NtbDBZV0pzWlRvZ1ptRnNjMlVzWEc0Z0lDQWdJQ0FnSUhaaGJIVmxPaUJ6YjNWeVkyVmNiaUFnSUNBZ0lIMHBPMXh1SUNBZ0lIMGdaV3h6WlNCN1hHNGdJQ0FnSUNCbGJHVnRaVzUwTGw5emRHOXlaUzUyWVd4cFpHRjBaV1FnUFNCbVlXeHpaVHRjYmlBZ0lDQWdJR1ZzWlcxbGJuUXVYM05sYkdZZ1BTQnpaV3htTzF4dUlDQWdJQ0FnWld4bGJXVnVkQzVmYzI5MWNtTmxJRDBnYzI5MWNtTmxPMXh1SUNBZ0lIMWNiaUFnSUNCcFppQW9UMkpxWldOMExtWnlaV1Y2WlNrZ2UxeHVJQ0FnSUNBZ1QySnFaV04wTG1aeVpXVjZaU2hsYkdWdFpXNTBMbkJ5YjNCektUdGNiaUFnSUNBZ0lFOWlhbVZqZEM1bWNtVmxlbVVvWld4bGJXVnVkQ2s3WEc0Z0lDQWdmVnh1SUNCOVhHNWNiaUFnY21WMGRYSnVJR1ZzWlcxbGJuUTdYRzU5TzF4dVhHNHZLaXBjYmlBcUlFTnlaV0YwWlNCaGJtUWdjbVYwZFhKdUlHRWdibVYzSUZKbFlXTjBSV3hsYldWdWRDQnZaaUIwYUdVZ1oybDJaVzRnZEhsd1pTNWNiaUFxSUZObFpTQm9kSFJ3Y3pvdkwyWmhZMlZpYjI5ckxtZHBkR2gxWWk1cGJ5OXlaV0ZqZEM5a2IyTnpMM1J2Y0Mxc1pYWmxiQzFoY0drdWFIUnRiQ055WldGamRDNWpjbVZoZEdWbGJHVnRaVzUwWEc0Z0tpOWNibEpsWVdOMFJXeGxiV1Z1ZEM1amNtVmhkR1ZGYkdWdFpXNTBJRDBnWm5WdVkzUnBiMjRnS0hSNWNHVXNJR052Ym1acFp5d2dZMmhwYkdSeVpXNHBJSHRjYmlBZ2RtRnlJSEJ5YjNCT1lXMWxPMXh1WEc0Z0lDOHZJRkpsYzJWeWRtVmtJRzVoYldWeklHRnlaU0JsZUhSeVlXTjBaV1JjYmlBZ2RtRnlJSEJ5YjNCeklEMGdlMzA3WEc1Y2JpQWdkbUZ5SUd0bGVTQTlJRzUxYkd3N1hHNGdJSFpoY2lCeVpXWWdQU0J1ZFd4c08xeHVJQ0IyWVhJZ2MyVnNaaUE5SUc1MWJHdzdYRzRnSUhaaGNpQnpiM1Z5WTJVZ1BTQnVkV3hzTzF4dVhHNGdJR2xtSUNoamIyNW1hV2NnSVQwZ2JuVnNiQ2tnZTF4dUlDQWdJR2xtSUNob1lYTldZV3hwWkZKbFppaGpiMjVtYVdjcEtTQjdYRzRnSUNBZ0lDQnlaV1lnUFNCamIyNW1hV2N1Y21WbU8xeHVJQ0FnSUgxY2JpQWdJQ0JwWmlBb2FHRnpWbUZzYVdSTFpYa29ZMjl1Wm1sbktTa2dlMXh1SUNBZ0lDQWdhMlY1SUQwZ0p5Y2dLeUJqYjI1bWFXY3VhMlY1TzF4dUlDQWdJSDFjYmx4dUlDQWdJSE5sYkdZZ1BTQmpiMjVtYVdjdVgxOXpaV3htSUQwOVBTQjFibVJsWm1sdVpXUWdQeUJ1ZFd4c0lEb2dZMjl1Wm1sbkxsOWZjMlZzWmp0Y2JpQWdJQ0J6YjNWeVkyVWdQU0JqYjI1bWFXY3VYMTl6YjNWeVkyVWdQVDA5SUhWdVpHVm1hVzVsWkNBL0lHNTFiR3dnT2lCamIyNW1hV2N1WDE5emIzVnlZMlU3WEc0Z0lDQWdMeThnVW1WdFlXbHVhVzVuSUhCeWIzQmxjblJwWlhNZ1lYSmxJR0ZrWkdWa0lIUnZJR0VnYm1WM0lIQnliM0J6SUc5aWFtVmpkRnh1SUNBZ0lHWnZjaUFvY0hKdmNFNWhiV1VnYVc0Z1kyOXVabWxuS1NCN1hHNGdJQ0FnSUNCcFppQW9hR0Z6VDNkdVVISnZjR1Z5ZEhrdVkyRnNiQ2hqYjI1bWFXY3NJSEJ5YjNCT1lXMWxLU0FtSmlBaFVrVlRSVkpXUlVSZlVGSlBVRk11YUdGelQzZHVVSEp2Y0dWeWRIa29jSEp2Y0U1aGJXVXBLU0I3WEc0Z0lDQWdJQ0FnSUhCeWIzQnpXM0J5YjNCT1lXMWxYU0E5SUdOdmJtWnBaMXR3Y205d1RtRnRaVjA3WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdmVnh1SUNCOVhHNWNiaUFnTHk4Z1EyaHBiR1J5Wlc0Z1kyRnVJR0psSUcxdmNtVWdkR2hoYmlCdmJtVWdZWEpuZFcxbGJuUXNJR0Z1WkNCMGFHOXpaU0JoY21VZ2RISmhibk5tWlhKeVpXUWdiMjUwYjF4dUlDQXZMeUIwYUdVZ2JtVjNiSGtnWVd4c2IyTmhkR1ZrSUhCeWIzQnpJRzlpYW1WamRDNWNiaUFnZG1GeUlHTm9hV3hrY21WdVRHVnVaM1JvSUQwZ1lYSm5kVzFsYm5SekxteGxibWQwYUNBdElESTdYRzRnSUdsbUlDaGphR2xzWkhKbGJreGxibWQwYUNBOVBUMGdNU2tnZTF4dUlDQWdJSEJ5YjNCekxtTm9hV3hrY21WdUlEMGdZMmhwYkdSeVpXNDdYRzRnSUgwZ1pXeHpaU0JwWmlBb1kyaHBiR1J5Wlc1TVpXNW5kR2dnUGlBeEtTQjdYRzRnSUNBZ2RtRnlJR05vYVd4a1FYSnlZWGtnUFNCQmNuSmhlU2hqYUdsc1pISmxia3hsYm1kMGFDazdYRzRnSUNBZ1ptOXlJQ2gyWVhJZ2FTQTlJREE3SUdrZ1BDQmphR2xzWkhKbGJreGxibWQwYURzZ2FTc3JLU0I3WEc0Z0lDQWdJQ0JqYUdsc1pFRnljbUY1VzJsZElEMGdZWEpuZFcxbGJuUnpXMmtnS3lBeVhUdGNiaUFnSUNCOVhHNGdJQ0FnYVdZZ0tIQnliMk5sYzNNdVpXNTJMazVQUkVWZlJVNVdJQ0U5UFNBbmNISnZaSFZqZEdsdmJpY3BJSHRjYmlBZ0lDQWdJR2xtSUNoUFltcGxZM1F1Wm5KbFpYcGxLU0I3WEc0Z0lDQWdJQ0FnSUU5aWFtVmpkQzVtY21WbGVtVW9ZMmhwYkdSQmNuSmhlU2s3WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdmVnh1SUNBZ0lIQnliM0J6TG1Ob2FXeGtjbVZ1SUQwZ1kyaHBiR1JCY25KaGVUdGNiaUFnZlZ4dVhHNGdJQzh2SUZKbGMyOXNkbVVnWkdWbVlYVnNkQ0J3Y205d2MxeHVJQ0JwWmlBb2RIbHdaU0FtSmlCMGVYQmxMbVJsWm1GMWJIUlFjbTl3Y3lrZ2UxeHVJQ0FnSUhaaGNpQmtaV1poZFd4MFVISnZjSE1nUFNCMGVYQmxMbVJsWm1GMWJIUlFjbTl3Y3p0Y2JpQWdJQ0JtYjNJZ0tIQnliM0JPWVcxbElHbHVJR1JsWm1GMWJIUlFjbTl3Y3lrZ2UxeHVJQ0FnSUNBZ2FXWWdLSEJ5YjNCelczQnliM0JPWVcxbFhTQTlQVDBnZFc1a1pXWnBibVZrS1NCN1hHNGdJQ0FnSUNBZ0lIQnliM0J6VzNCeWIzQk9ZVzFsWFNBOUlHUmxabUYxYkhSUWNtOXdjMXR3Y205d1RtRnRaVjA3WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdmVnh1SUNCOVhHNGdJR2xtSUNod2NtOWpaWE56TG1WdWRpNU9UMFJGWDBWT1ZpQWhQVDBnSjNCeWIyUjFZM1JwYjI0bktTQjdYRzRnSUNBZ2FXWWdLR3RsZVNCOGZDQnlaV1lwSUh0Y2JpQWdJQ0FnSUdsbUlDaDBlWEJsYjJZZ2NISnZjSE11SkNSMGVYQmxiMllnUFQwOUlDZDFibVJsWm1sdVpXUW5JSHg4SUhCeWIzQnpMaVFrZEhsd1pXOW1JQ0U5UFNCU1JVRkRWRjlGVEVWTlJVNVVYMVJaVUVVcElIdGNiaUFnSUNBZ0lDQWdkbUZ5SUdScGMzQnNZWGxPWVcxbElEMGdkSGx3Wlc5bUlIUjVjR1VnUFQwOUlDZG1kVzVqZEdsdmJpY2dQeUIwZVhCbExtUnBjM0JzWVhsT1lXMWxJSHg4SUhSNWNHVXVibUZ0WlNCOGZDQW5WVzVyYm05M2JpY2dPaUIwZVhCbE8xeHVJQ0FnSUNBZ0lDQnBaaUFvYTJWNUtTQjdYRzRnSUNBZ0lDQWdJQ0FnWkdWbWFXNWxTMlY1VUhKdmNGZGhjbTVwYm1kSFpYUjBaWElvY0hKdmNITXNJR1JwYzNCc1lYbE9ZVzFsS1R0Y2JpQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ0lDQnBaaUFvY21WbUtTQjdYRzRnSUNBZ0lDQWdJQ0FnWkdWbWFXNWxVbVZtVUhKdmNGZGhjbTVwYm1kSFpYUjBaWElvY0hKdmNITXNJR1JwYzNCc1lYbE9ZVzFsS1R0Y2JpQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ2ZWeHVJQ0FnSUgxY2JpQWdmVnh1SUNCeVpYUjFjbTRnVW1WaFkzUkZiR1Z0Wlc1MEtIUjVjR1VzSUd0bGVTd2djbVZtTENCelpXeG1MQ0J6YjNWeVkyVXNJRkpsWVdOMFEzVnljbVZ1ZEU5M2JtVnlMbU4xY25KbGJuUXNJSEJ5YjNCektUdGNibjA3WEc1Y2JpOHFLbHh1SUNvZ1VtVjBkWEp1SUdFZ1puVnVZM1JwYjI0Z2RHaGhkQ0J3Y205a2RXTmxjeUJTWldGamRFVnNaVzFsYm5SeklHOW1JR0VnWjJsMlpXNGdkSGx3WlM1Y2JpQXFJRk5sWlNCb2RIUndjem92TDJaaFkyVmliMjlyTG1kcGRHaDFZaTVwYnk5eVpXRmpkQzlrYjJOekwzUnZjQzFzWlhabGJDMWhjR2t1YUhSdGJDTnlaV0ZqZEM1amNtVmhkR1ZtWVdOMGIzSjVYRzRnS2k5Y2JsSmxZV04wUld4bGJXVnVkQzVqY21WaGRHVkdZV04wYjNKNUlEMGdablZ1WTNScGIyNGdLSFI1Y0dVcElIdGNiaUFnZG1GeUlHWmhZM1J2Y25rZ1BTQlNaV0ZqZEVWc1pXMWxiblF1WTNKbFlYUmxSV3hsYldWdWRDNWlhVzVrS0c1MWJHd3NJSFI1Y0dVcE8xeHVJQ0F2THlCRmVIQnZjMlVnZEdobElIUjVjR1VnYjI0Z2RHaGxJR1poWTNSdmNua2dZVzVrSUhSb1pTQndjbTkwYjNSNWNHVWdjMjhnZEdoaGRDQnBkQ0JqWVc0Z1ltVmNiaUFnTHk4Z1pXRnphV3g1SUdGalkyVnpjMlZrSUc5dUlHVnNaVzFsYm5SekxpQkZMbWN1SUdBOFJtOXZJQzgrTG5SNWNHVWdQVDA5SUVadmIyQXVYRzRnSUM4dklGUm9hWE1nYzJodmRXeGtJRzV2ZENCaVpTQnVZVzFsWkNCZ1kyOXVjM1J5ZFdOMGIzSmdJSE5wYm1ObElIUm9hWE1nYldGNUlHNXZkQ0JpWlNCMGFHVWdablZ1WTNScGIyNWNiaUFnTHk4Z2RHaGhkQ0JqY21WaGRHVmtJSFJvWlNCbGJHVnRaVzUwTENCaGJtUWdhWFFnYldGNUlHNXZkQ0JsZG1WdUlHSmxJR0VnWTI5dWMzUnlkV04wYjNJdVhHNGdJQzh2SUV4bFoyRmplU0JvYjI5cklGUlBSRTg2SUZkaGNtNGdhV1lnZEdocGN5QnBjeUJoWTJObGMzTmxaRnh1SUNCbVlXTjBiM0o1TG5SNWNHVWdQU0IwZVhCbE8xeHVJQ0J5WlhSMWNtNGdabUZqZEc5eWVUdGNibjA3WEc1Y2JsSmxZV04wUld4bGJXVnVkQzVqYkc5dVpVRnVaRkpsY0d4aFkyVkxaWGtnUFNCbWRXNWpkR2x2YmlBb2IyeGtSV3hsYldWdWRDd2dibVYzUzJWNUtTQjdYRzRnSUhaaGNpQnVaWGRGYkdWdFpXNTBJRDBnVW1WaFkzUkZiR1Z0Wlc1MEtHOXNaRVZzWlcxbGJuUXVkSGx3WlN3Z2JtVjNTMlY1TENCdmJHUkZiR1Z0Wlc1MExuSmxaaXdnYjJ4a1JXeGxiV1Z1ZEM1ZmMyVnNaaXdnYjJ4a1JXeGxiV1Z1ZEM1ZmMyOTFjbU5sTENCdmJHUkZiR1Z0Wlc1MExsOXZkMjVsY2l3Z2IyeGtSV3hsYldWdWRDNXdjbTl3Y3lrN1hHNWNiaUFnY21WMGRYSnVJRzVsZDBWc1pXMWxiblE3WEc1OU8xeHVYRzR2S2lwY2JpQXFJRU5zYjI1bElHRnVaQ0J5WlhSMWNtNGdZU0J1WlhjZ1VtVmhZM1JGYkdWdFpXNTBJSFZ6YVc1bklHVnNaVzFsYm5RZ1lYTWdkR2hsSUhOMFlYSjBhVzVuSUhCdmFXNTBMbHh1SUNvZ1UyVmxJR2gwZEhCek9pOHZabUZqWldKdmIyc3VaMmwwYUhWaUxtbHZMM0psWVdOMEwyUnZZM012ZEc5d0xXeGxkbVZzTFdGd2FTNW9kRzFzSTNKbFlXTjBMbU5zYjI1bFpXeGxiV1Z1ZEZ4dUlDb3ZYRzVTWldGamRFVnNaVzFsYm5RdVkyeHZibVZGYkdWdFpXNTBJRDBnWm5WdVkzUnBiMjRnS0dWc1pXMWxiblFzSUdOdmJtWnBaeXdnWTJocGJHUnlaVzRwSUh0Y2JpQWdkbUZ5SUhCeWIzQk9ZVzFsTzF4dVhHNGdJQzh2SUU5eWFXZHBibUZzSUhCeWIzQnpJR0Z5WlNCamIzQnBaV1JjYmlBZ2RtRnlJSEJ5YjNCeklEMGdYMkZ6YzJsbmJpaDdmU3dnWld4bGJXVnVkQzV3Y205d2N5azdYRzVjYmlBZ0x5OGdVbVZ6WlhKMlpXUWdibUZ0WlhNZ1lYSmxJR1Y0ZEhKaFkzUmxaRnh1SUNCMllYSWdhMlY1SUQwZ1pXeGxiV1Z1ZEM1clpYazdYRzRnSUhaaGNpQnlaV1lnUFNCbGJHVnRaVzUwTG5KbFpqdGNiaUFnTHk4Z1UyVnNaaUJwY3lCd2NtVnpaWEoyWldRZ2MybHVZMlVnZEdobElHOTNibVZ5SUdseklIQnlaWE5sY25abFpDNWNiaUFnZG1GeUlITmxiR1lnUFNCbGJHVnRaVzUwTGw5elpXeG1PMXh1SUNBdkx5QlRiM1Z5WTJVZ2FYTWdjSEpsYzJWeWRtVmtJSE5wYm1ObElHTnNiMjVsUld4bGJXVnVkQ0JwY3lCMWJteHBhMlZzZVNCMGJ5QmlaU0IwWVhKblpYUmxaQ0JpZVNCaFhHNGdJQzh2SUhSeVlXNXpjR2xzWlhJc0lHRnVaQ0IwYUdVZ2IzSnBaMmx1WVd3Z2MyOTFjbU5sSUdseklIQnliMkpoWW14NUlHRWdZbVYwZEdWeUlHbHVaR2xqWVhSdmNpQnZaaUIwYUdWY2JpQWdMeThnZEhKMVpTQnZkMjVsY2k1Y2JpQWdkbUZ5SUhOdmRYSmpaU0E5SUdWc1pXMWxiblF1WDNOdmRYSmpaVHRjYmx4dUlDQXZMeUJQZDI1bGNpQjNhV3hzSUdKbElIQnlaWE5sY25abFpDd2dkVzVzWlhOeklISmxaaUJwY3lCdmRtVnljbWxrWkdWdVhHNGdJSFpoY2lCdmQyNWxjaUE5SUdWc1pXMWxiblF1WDI5M2JtVnlPMXh1WEc0Z0lHbG1JQ2hqYjI1bWFXY2dJVDBnYm5Wc2JDa2dlMXh1SUNBZ0lHbG1JQ2hvWVhOV1lXeHBaRkpsWmloamIyNW1hV2NwS1NCN1hHNGdJQ0FnSUNBdkx5QlRhV3hsYm5Sc2VTQnpkR1ZoYkNCMGFHVWdjbVZtSUdaeWIyMGdkR2hsSUhCaGNtVnVkQzVjYmlBZ0lDQWdJSEpsWmlBOUlHTnZibVpwWnk1eVpXWTdYRzRnSUNBZ0lDQnZkMjVsY2lBOUlGSmxZV04wUTNWeWNtVnVkRTkzYm1WeUxtTjFjbkpsYm5RN1hHNGdJQ0FnZlZ4dUlDQWdJR2xtSUNob1lYTldZV3hwWkV0bGVTaGpiMjVtYVdjcEtTQjdYRzRnSUNBZ0lDQnJaWGtnUFNBbkp5QXJJR052Ym1acFp5NXJaWGs3WEc0Z0lDQWdmVnh1WEc0Z0lDQWdMeThnVW1WdFlXbHVhVzVuSUhCeWIzQmxjblJwWlhNZ2IzWmxjbkpwWkdVZ1pYaHBjM1JwYm1jZ2NISnZjSE5jYmlBZ0lDQjJZWElnWkdWbVlYVnNkRkJ5YjNCek8xeHVJQ0FnSUdsbUlDaGxiR1Z0Wlc1MExuUjVjR1VnSmlZZ1pXeGxiV1Z1ZEM1MGVYQmxMbVJsWm1GMWJIUlFjbTl3Y3lrZ2UxeHVJQ0FnSUNBZ1pHVm1ZWFZzZEZCeWIzQnpJRDBnWld4bGJXVnVkQzUwZVhCbExtUmxabUYxYkhSUWNtOXdjenRjYmlBZ0lDQjlYRzRnSUNBZ1ptOXlJQ2h3Y205d1RtRnRaU0JwYmlCamIyNW1hV2NwSUh0Y2JpQWdJQ0FnSUdsbUlDaG9ZWE5QZDI1UWNtOXdaWEowZVM1allXeHNLR052Ym1acFp5d2djSEp2Y0U1aGJXVXBJQ1ltSUNGU1JWTkZVbFpGUkY5UVVrOVFVeTVvWVhOUGQyNVFjbTl3WlhKMGVTaHdjbTl3VG1GdFpTa3BJSHRjYmlBZ0lDQWdJQ0FnYVdZZ0tHTnZibVpwWjF0d2NtOXdUbUZ0WlYwZ1BUMDlJSFZ1WkdWbWFXNWxaQ0FtSmlCa1pXWmhkV3gwVUhKdmNITWdJVDA5SUhWdVpHVm1hVzVsWkNrZ2UxeHVJQ0FnSUNBZ0lDQWdJQzh2SUZKbGMyOXNkbVVnWkdWbVlYVnNkQ0J3Y205d2MxeHVJQ0FnSUNBZ0lDQWdJSEJ5YjNCelczQnliM0JPWVcxbFhTQTlJR1JsWm1GMWJIUlFjbTl3YzF0d2NtOXdUbUZ0WlYwN1hHNGdJQ0FnSUNBZ0lIMGdaV3h6WlNCN1hHNGdJQ0FnSUNBZ0lDQWdjSEp2Y0hOYmNISnZjRTVoYldWZElEMGdZMjl1Wm1sblczQnliM0JPWVcxbFhUdGNiaUFnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdmVnh1SUNBZ0lIMWNiaUFnZlZ4dVhHNGdJQzh2SUVOb2FXeGtjbVZ1SUdOaGJpQmlaU0J0YjNKbElIUm9ZVzRnYjI1bElHRnlaM1Z0Wlc1MExDQmhibVFnZEdodmMyVWdZWEpsSUhSeVlXNXpabVZ5Y21Wa0lHOXVkRzljYmlBZ0x5OGdkR2hsSUc1bGQyeDVJR0ZzYkc5allYUmxaQ0J3Y205d2N5QnZZbXBsWTNRdVhHNGdJSFpoY2lCamFHbHNaSEpsYmt4bGJtZDBhQ0E5SUdGeVozVnRaVzUwY3k1c1pXNW5kR2dnTFNBeU8xeHVJQ0JwWmlBb1kyaHBiR1J5Wlc1TVpXNW5kR2dnUFQwOUlERXBJSHRjYmlBZ0lDQndjbTl3Y3k1amFHbHNaSEpsYmlBOUlHTm9hV3hrY21WdU8xeHVJQ0I5SUdWc2MyVWdhV1lnS0dOb2FXeGtjbVZ1VEdWdVozUm9JRDRnTVNrZ2UxeHVJQ0FnSUhaaGNpQmphR2xzWkVGeWNtRjVJRDBnUVhKeVlYa29ZMmhwYkdSeVpXNU1aVzVuZEdncE8xeHVJQ0FnSUdadmNpQW9kbUZ5SUdrZ1BTQXdPeUJwSUR3Z1kyaHBiR1J5Wlc1TVpXNW5kR2c3SUdrckt5a2dlMXh1SUNBZ0lDQWdZMmhwYkdSQmNuSmhlVnRwWFNBOUlHRnlaM1Z0Wlc1MGMxdHBJQ3NnTWwwN1hHNGdJQ0FnZlZ4dUlDQWdJSEJ5YjNCekxtTm9hV3hrY21WdUlEMGdZMmhwYkdSQmNuSmhlVHRjYmlBZ2ZWeHVYRzRnSUhKbGRIVnliaUJTWldGamRFVnNaVzFsYm5Rb1pXeGxiV1Z1ZEM1MGVYQmxMQ0JyWlhrc0lISmxaaXdnYzJWc1ppd2djMjkxY21ObExDQnZkMjVsY2l3Z2NISnZjSE1wTzF4dWZUdGNibHh1THlvcVhHNGdLaUJXWlhKcFptbGxjeUIwYUdVZ2IySnFaV04wSUdseklHRWdVbVZoWTNSRmJHVnRaVzUwTGx4dUlDb2dVMlZsSUdoMGRIQnpPaTh2Wm1GalpXSnZiMnN1WjJsMGFIVmlMbWx2TDNKbFlXTjBMMlJ2WTNNdmRHOXdMV3hsZG1Wc0xXRndhUzVvZEcxc0kzSmxZV04wTG1semRtRnNhV1JsYkdWdFpXNTBYRzRnS2lCQWNHRnlZVzBnZXo5dlltcGxZM1I5SUc5aWFtVmpkRnh1SUNvZ1FISmxkSFZ5YmlCN1ltOXZiR1ZoYm4wZ1ZISjFaU0JwWmlCZ2IySnFaV04wWUNCcGN5QmhJSFpoYkdsa0lHTnZiWEJ2Ym1WdWRDNWNiaUFxSUVCbWFXNWhiRnh1SUNvdlhHNVNaV0ZqZEVWc1pXMWxiblF1YVhOV1lXeHBaRVZzWlcxbGJuUWdQU0JtZFc1amRHbHZiaUFvYjJKcVpXTjBLU0I3WEc0Z0lISmxkSFZ5YmlCMGVYQmxiMllnYjJKcVpXTjBJRDA5UFNBbmIySnFaV04wSnlBbUppQnZZbXBsWTNRZ0lUMDlJRzUxYkd3Z0ppWWdiMkpxWldOMExpUWtkSGx3Wlc5bUlEMDlQU0JTUlVGRFZGOUZURVZOUlU1VVgxUlpVRVU3WEc1OU8xeHVYRzV0YjJSMWJHVXVaWGh3YjNKMGN5QTlJRkpsWVdOMFJXeGxiV1Z1ZERzaUxDSXZLaXBjYmlBcUlFTnZjSGx5YVdkb2RDQXlNREUwTFhCeVpYTmxiblFzSUVaaFkyVmliMjlyTENCSmJtTXVYRzRnS2lCQmJHd2djbWxuYUhSeklISmxjMlZ5ZG1Wa0xseHVJQ3BjYmlBcUlGUm9hWE1nYzI5MWNtTmxJR052WkdVZ2FYTWdiR2xqWlc1elpXUWdkVzVrWlhJZ2RHaGxJRUpUUkMxemRIbHNaU0JzYVdObGJuTmxJR1p2ZFc1a0lHbHVJSFJvWlZ4dUlDb2dURWxEUlU1VFJTQm1hV3hsSUdsdUlIUm9aU0J5YjI5MElHUnBjbVZqZEc5eWVTQnZaaUIwYUdseklITnZkWEpqWlNCMGNtVmxMaUJCYmlCaFpHUnBkR2x2Ym1Gc0lHZHlZVzUwWEc0Z0tpQnZaaUJ3WVhSbGJuUWdjbWxuYUhSeklHTmhiaUJpWlNCbWIzVnVaQ0JwYmlCMGFHVWdVRUZVUlU1VVV5Qm1hV3hsSUdsdUlIUm9aU0J6WVcxbElHUnBjbVZqZEc5eWVTNWNiaUFxWEc0Z0tpQmNiaUFxTDF4dVhHNG5kWE5sSUhOMGNtbGpkQ2M3WEc1Y2JpOHZJRlJvWlNCVGVXMWliMndnZFhObFpDQjBieUIwWVdjZ2RHaGxJRkpsWVdOMFJXeGxiV1Z1ZENCMGVYQmxMaUJKWmlCMGFHVnlaU0JwY3lCdWJ5QnVZWFJwZG1VZ1UzbHRZbTlzWEc0dkx5QnViM0lnY0c5c2VXWnBiR3dzSUhSb1pXNGdZU0J3YkdGcGJpQnVkVzFpWlhJZ2FYTWdkWE5sWkNCbWIzSWdjR1Z5Wm05eWJXRnVZMlV1WEc1Y2JuWmhjaUJTUlVGRFZGOUZURVZOUlU1VVgxUlpVRVVnUFNCMGVYQmxiMllnVTNsdFltOXNJRDA5UFNBblpuVnVZM1JwYjI0bklDWW1JRk41YldKdmJGc25abTl5SjEwZ0ppWWdVM2x0WW05c1d5ZG1iM0luWFNnbmNtVmhZM1F1Wld4bGJXVnVkQ2NwSUh4OElEQjRaV0ZqTnp0Y2JseHViVzlrZFd4bExtVjRjRzl5ZEhNZ1BTQlNSVUZEVkY5RlRFVk5SVTVVWDFSWlVFVTdJaXdpTHlvcVhHNGdLaUJEYjNCNWNtbG5hSFFnTWpBeE5DMXdjbVZ6Wlc1MExDQkdZV05sWW05dmF5d2dTVzVqTGx4dUlDb2dRV3hzSUhKcFoyaDBjeUJ5WlhObGNuWmxaQzVjYmlBcVhHNGdLaUJVYUdseklITnZkWEpqWlNCamIyUmxJR2x6SUd4cFkyVnVjMlZrSUhWdVpHVnlJSFJvWlNCQ1UwUXRjM1I1YkdVZ2JHbGpaVzV6WlNCbWIzVnVaQ0JwYmlCMGFHVmNiaUFxSUV4SlEwVk9VMFVnWm1sc1pTQnBiaUIwYUdVZ2NtOXZkQ0JrYVhKbFkzUnZjbmtnYjJZZ2RHaHBjeUJ6YjNWeVkyVWdkSEpsWlM0Z1FXNGdZV1JrYVhScGIyNWhiQ0JuY21GdWRGeHVJQ29nYjJZZ2NHRjBaVzUwSUhKcFoyaDBjeUJqWVc0Z1ltVWdabTkxYm1RZ2FXNGdkR2hsSUZCQlZFVk9WRk1nWm1sc1pTQnBiaUIwYUdVZ2MyRnRaU0JrYVhKbFkzUnZjbmt1WEc0Z0tseHVJQ292WEc1Y2JpOHFLbHh1SUNvZ1VtVmhZM1JGYkdWdFpXNTBWbUZzYVdSaGRHOXlJSEJ5YjNacFpHVnpJR0VnZDNKaGNIQmxjaUJoY205MWJtUWdZU0JsYkdWdFpXNTBJR1poWTNSdmNubGNiaUFxSUhkb2FXTm9JSFpoYkdsa1lYUmxjeUIwYUdVZ2NISnZjSE1nY0dGemMyVmtJSFJ2SUhSb1pTQmxiR1Z0Wlc1MExpQlVhR2x6SUdseklHbHVkR1Z1WkdWa0lIUnZJR0psWEc0Z0tpQjFjMlZrSUc5dWJIa2dhVzRnUkVWV0lHRnVaQ0JqYjNWc1pDQmlaU0J5WlhCc1lXTmxaQ0JpZVNCaElITjBZWFJwWXlCMGVYQmxJR05vWldOclpYSWdabTl5SUd4aGJtZDFZV2RsYzF4dUlDb2dkR2hoZENCemRYQndiM0owSUdsMExseHVJQ292WEc1Y2JpZDFjMlVnYzNSeWFXTjBKenRjYmx4dWRtRnlJRkpsWVdOMFEzVnljbVZ1ZEU5M2JtVnlJRDBnY21WeGRXbHlaU2duTGk5U1pXRmpkRU4xY25KbGJuUlBkMjVsY2ljcE8xeHVkbUZ5SUZKbFlXTjBRMjl0Y0c5dVpXNTBWSEpsWlVodmIyc2dQU0J5WlhGMWFYSmxLQ2N1TDFKbFlXTjBRMjl0Y0c5dVpXNTBWSEpsWlVodmIyc25LVHRjYm5aaGNpQlNaV0ZqZEVWc1pXMWxiblFnUFNCeVpYRjFhWEpsS0NjdUwxSmxZV04wUld4bGJXVnVkQ2NwTzF4dVhHNTJZWElnWTJobFkydFNaV0ZqZEZSNWNHVlRjR1ZqSUQwZ2NtVnhkV2x5WlNnbkxpOWphR1ZqYTFKbFlXTjBWSGx3WlZOd1pXTW5LVHRjYmx4dWRtRnlJR05oYmtSbFptbHVaVkJ5YjNCbGNuUjVJRDBnY21WeGRXbHlaU2duTGk5allXNUVaV1pwYm1WUWNtOXdaWEowZVNjcE8xeHVkbUZ5SUdkbGRFbDBaWEpoZEc5eVJtNGdQU0J5WlhGMWFYSmxLQ2N1TDJkbGRFbDBaWEpoZEc5eVJtNG5LVHRjYm5aaGNpQjNZWEp1YVc1bklEMGdjbVZ4ZFdseVpTZ25abUpxY3k5c2FXSXZkMkZ5Ym1sdVp5Y3BPMXh1ZG1GeUlHeHZkMUJ5YVc5eWFYUjVWMkZ5Ym1sdVp5QTlJSEpsY1hWcGNtVW9KeTR2Ykc5M1VISnBiM0pwZEhsWFlYSnVhVzVuSnlrN1hHNWNibVoxYm1OMGFXOXVJR2RsZEVSbFkyeGhjbUYwYVc5dVJYSnliM0pCWkdSbGJtUjFiU2dwSUh0Y2JpQWdhV1lnS0ZKbFlXTjBRM1Z5Y21WdWRFOTNibVZ5TG1OMWNuSmxiblFwSUh0Y2JpQWdJQ0IyWVhJZ2JtRnRaU0E5SUZKbFlXTjBRM1Z5Y21WdWRFOTNibVZ5TG1OMWNuSmxiblF1WjJWMFRtRnRaU2dwTzF4dUlDQWdJR2xtSUNodVlXMWxLU0I3WEc0Z0lDQWdJQ0J5WlhSMWNtNGdKeUJEYUdWamF5QjBhR1VnY21WdVpHVnlJRzFsZEdodlpDQnZaaUJnSnlBcklHNWhiV1VnS3lBbllDNG5PMXh1SUNBZ0lIMWNiaUFnZlZ4dUlDQnlaWFIxY200Z0p5YzdYRzU5WEc1Y2JtWjFibU4wYVc5dUlHZGxkRk52ZFhKalpVbHVabTlGY25KdmNrRmtaR1Z1WkhWdEtHVnNaVzFsYm5SUWNtOXdjeWtnZTF4dUlDQnBaaUFvWld4bGJXVnVkRkJ5YjNCeklDRTlQU0J1ZFd4c0lDWW1JR1ZzWlcxbGJuUlFjbTl3Y3lBaFBUMGdkVzVrWldacGJtVmtJQ1ltSUdWc1pXMWxiblJRY205d2N5NWZYM052ZFhKalpTQWhQVDBnZFc1a1pXWnBibVZrS1NCN1hHNGdJQ0FnZG1GeUlITnZkWEpqWlNBOUlHVnNaVzFsYm5SUWNtOXdjeTVmWDNOdmRYSmpaVHRjYmlBZ0lDQjJZWElnWm1sc1pVNWhiV1VnUFNCemIzVnlZMlV1Wm1sc1pVNWhiV1V1Y21Wd2JHRmpaU2d2WGk0cVcxeGNYRnhjWEM5ZEx5d2dKeWNwTzF4dUlDQWdJSFpoY2lCc2FXNWxUblZ0WW1WeUlEMGdjMjkxY21ObExteHBibVZPZFcxaVpYSTdYRzRnSUNBZ2NtVjBkWEp1SUNjZ1EyaGxZMnNnZVc5MWNpQmpiMlJsSUdGMElDY2dLeUJtYVd4bFRtRnRaU0FySUNjNkp5QXJJR3hwYm1WT2RXMWlaWElnS3lBbkxpYzdYRzRnSUgxY2JpQWdjbVYwZFhKdUlDY25PMXh1ZlZ4dVhHNHZLaXBjYmlBcUlGZGhjbTRnYVdZZ2RHaGxjbVVuY3lCdWJ5QnJaWGtnWlhod2JHbGphWFJzZVNCelpYUWdiMjRnWkhsdVlXMXBZeUJoY25KaGVYTWdiMllnWTJocGJHUnlaVzRnYjNKY2JpQXFJRzlpYW1WamRDQnJaWGx6SUdGeVpTQnViM1FnZG1Gc2FXUXVJRlJvYVhNZ1lXeHNiM2R6SUhWeklIUnZJR3RsWlhBZ2RISmhZMnNnYjJZZ1kyaHBiR1J5Wlc0Z1ltVjBkMlZsYmx4dUlDb2dkWEJrWVhSbGN5NWNiaUFxTDF4dWRtRnlJRzkzYm1WeVNHRnpTMlY1VlhObFYyRnlibWx1WnlBOUlIdDlPMXh1WEc1bWRXNWpkR2x2YmlCblpYUkRkWEp5Wlc1MFEyOXRjRzl1Wlc1MFJYSnliM0pKYm1adktIQmhjbVZ1ZEZSNWNHVXBJSHRjYmlBZ2RtRnlJR2x1Wm04Z1BTQm5aWFJFWldOc1lYSmhkR2x2YmtWeWNtOXlRV1JrWlc1a2RXMG9LVHRjYmx4dUlDQnBaaUFvSVdsdVptOHBJSHRjYmlBZ0lDQjJZWElnY0dGeVpXNTBUbUZ0WlNBOUlIUjVjR1Z2WmlCd1lYSmxiblJVZVhCbElEMDlQU0FuYzNSeWFXNW5KeUEvSUhCaGNtVnVkRlI1Y0dVZ09pQndZWEpsYm5SVWVYQmxMbVJwYzNCc1lYbE9ZVzFsSUh4OElIQmhjbVZ1ZEZSNWNHVXVibUZ0WlR0Y2JpQWdJQ0JwWmlBb2NHRnlaVzUwVG1GdFpTa2dlMXh1SUNBZ0lDQWdhVzVtYnlBOUlDY2dRMmhsWTJzZ2RHaGxJSFJ2Y0Mxc1pYWmxiQ0J5Wlc1a1pYSWdZMkZzYkNCMWMybHVaeUE4SnlBcklIQmhjbVZ1ZEU1aGJXVWdLeUFuUGk0bk8xeHVJQ0FnSUgxY2JpQWdmVnh1SUNCeVpYUjFjbTRnYVc1bWJ6dGNibjFjYmx4dUx5b3FYRzRnS2lCWFlYSnVJR2xtSUhSb1pTQmxiR1Z0Wlc1MElHUnZaWE51SjNRZ2FHRjJaU0JoYmlCbGVIQnNhV05wZENCclpYa2dZWE56YVdkdVpXUWdkRzhnYVhRdVhHNGdLaUJVYUdseklHVnNaVzFsYm5RZ2FYTWdhVzRnWVc0Z1lYSnlZWGt1SUZSb1pTQmhjbkpoZVNCamIzVnNaQ0JuY205M0lHRnVaQ0J6YUhKcGJtc2diM0lnWW1WY2JpQXFJSEpsYjNKa1pYSmxaQzRnUVd4c0lHTm9hV3hrY21WdUlIUm9ZWFFnYUdGMlpXNG5kQ0JoYkhKbFlXUjVJR0psWlc0Z2RtRnNhV1JoZEdWa0lHRnlaU0J5WlhGMWFYSmxaQ0IwYjF4dUlDb2dhR0YyWlNCaElGd2lhMlY1WENJZ2NISnZjR1Z5ZEhrZ1lYTnphV2R1WldRZ2RHOGdhWFF1SUVWeWNtOXlJSE4wWVhSMWMyVnpJR0Z5WlNCallXTm9aV1FnYzI4Z1lTQjNZWEp1YVc1blhHNGdLaUIzYVd4c0lHOXViSGtnWW1VZ2MyaHZkMjRnYjI1alpTNWNiaUFxWEc0Z0tpQkFhVzUwWlhKdVlXeGNiaUFxSUVCd1lYSmhiU0I3VW1WaFkzUkZiR1Z0Wlc1MGZTQmxiR1Z0Wlc1MElFVnNaVzFsYm5RZ2RHaGhkQ0J5WlhGMWFYSmxjeUJoSUd0bGVTNWNiaUFxSUVCd1lYSmhiU0I3S24wZ2NHRnlaVzUwVkhsd1pTQmxiR1Z0Wlc1MEozTWdjR0Z5Wlc1MEozTWdkSGx3WlM1Y2JpQXFMMXh1Wm5WdVkzUnBiMjRnZG1Gc2FXUmhkR1ZGZUhCc2FXTnBkRXRsZVNobGJHVnRaVzUwTENCd1lYSmxiblJVZVhCbEtTQjdYRzRnSUdsbUlDZ2haV3hsYldWdWRDNWZjM1J2Y21VZ2ZId2daV3hsYldWdWRDNWZjM1J2Y21VdWRtRnNhV1JoZEdWa0lIeDhJR1ZzWlcxbGJuUXVhMlY1SUNFOUlHNTFiR3dwSUh0Y2JpQWdJQ0J5WlhSMWNtNDdYRzRnSUgxY2JpQWdaV3hsYldWdWRDNWZjM1J2Y21VdWRtRnNhV1JoZEdWa0lEMGdkSEoxWlR0Y2JseHVJQ0IyWVhJZ2JXVnRiMmw2WlhJZ1BTQnZkMjVsY2toaGMwdGxlVlZ6WlZkaGNtNXBibWN1ZFc1cGNYVmxTMlY1SUh4OElDaHZkMjVsY2toaGMwdGxlVlZ6WlZkaGNtNXBibWN1ZFc1cGNYVmxTMlY1SUQwZ2UzMHBPMXh1WEc0Z0lIWmhjaUJqZFhKeVpXNTBRMjl0Y0c5dVpXNTBSWEp5YjNKSmJtWnZJRDBnWjJWMFEzVnljbVZ1ZEVOdmJYQnZibVZ1ZEVWeWNtOXlTVzVtYnlod1lYSmxiblJVZVhCbEtUdGNiaUFnYVdZZ0tHMWxiVzlwZW1WeVcyTjFjbkpsYm5SRGIyMXdiMjVsYm5SRmNuSnZja2x1Wm05ZEtTQjdYRzRnSUNBZ2NtVjBkWEp1TzF4dUlDQjlYRzRnSUcxbGJXOXBlbVZ5VzJOMWNuSmxiblJEYjIxd2IyNWxiblJGY25KdmNrbHVabTlkSUQwZ2RISjFaVHRjYmx4dUlDQXZMeUJWYzNWaGJHeDVJSFJvWlNCamRYSnlaVzUwSUc5M2JtVnlJR2x6SUhSb1pTQnZabVpsYm1SbGNpd2dZblYwSUdsbUlHbDBJR0ZqWTJWd2RITWdZMmhwYkdSeVpXNGdZWE1nWVZ4dUlDQXZMeUJ3Y205d1pYSjBlU3dnYVhRZ2JXRjVJR0psSUhSb1pTQmpjbVZoZEc5eUlHOW1JSFJvWlNCamFHbHNaQ0IwYUdGMEozTWdjbVZ6Y0c5dWMybGliR1VnWm05eVhHNGdJQzh2SUdGemMybG5ibWx1WnlCcGRDQmhJR3RsZVM1Y2JpQWdkbUZ5SUdOb2FXeGtUM2R1WlhJZ1BTQW5KenRjYmlBZ2FXWWdLR1ZzWlcxbGJuUWdKaVlnWld4bGJXVnVkQzVmYjNkdVpYSWdKaVlnWld4bGJXVnVkQzVmYjNkdVpYSWdJVDA5SUZKbFlXTjBRM1Z5Y21WdWRFOTNibVZ5TG1OMWNuSmxiblFwSUh0Y2JpQWdJQ0F2THlCSGFYWmxJSFJvWlNCamIyMXdiMjVsYm5RZ2RHaGhkQ0J2Y21sbmFXNWhiR3g1SUdOeVpXRjBaV1FnZEdocGN5QmphR2xzWkM1Y2JpQWdJQ0JqYUdsc1pFOTNibVZ5SUQwZ0p5QkpkQ0IzWVhNZ2NHRnpjMlZrSUdFZ1kyaHBiR1FnWm5KdmJTQW5JQ3NnWld4bGJXVnVkQzVmYjNkdVpYSXVaMlYwVG1GdFpTZ3BJQ3NnSnk0bk8xeHVJQ0I5WEc1Y2JpQWdjSEp2WTJWemN5NWxibll1VGs5RVJWOUZUbFlnSVQwOUlDZHdjbTlrZFdOMGFXOXVKeUEvSUhkaGNtNXBibWNvWm1Gc2MyVXNJQ2RGWVdOb0lHTm9hV3hrSUdsdUlHRnVJR0Z5Y21GNUlHOXlJR2wwWlhKaGRHOXlJSE5vYjNWc1pDQm9ZWFpsSUdFZ2RXNXBjWFZsSUZ3aWEyVjVYQ0lnY0hKdmNDNG5JQ3NnSnlWekpYTWdVMlZsSUdoMGRIQnpPaTh2Wm1JdWJXVXZjbVZoWTNRdGQyRnlibWx1WnkxclpYbHpJR1p2Y2lCdGIzSmxJR2x1Wm05eWJXRjBhVzl1TGlWekp5d2dZM1Z5Y21WdWRFTnZiWEJ2Ym1WdWRFVnljbTl5U1c1bWJ5d2dZMmhwYkdSUGQyNWxjaXdnVW1WaFkzUkRiMjF3YjI1bGJuUlVjbVZsU0c5dmF5NW5aWFJEZFhKeVpXNTBVM1JoWTJ0QlpHUmxibVIxYlNobGJHVnRaVzUwS1NrZ09pQjJiMmxrSURBN1hHNTlYRzVjYmk4cUtseHVJQ29nUlc1emRYSmxJSFJvWVhRZ1pYWmxjbmtnWld4bGJXVnVkQ0JsYVhSb1pYSWdhWE1nY0dGemMyVmtJR2x1SUdFZ2MzUmhkR2xqSUd4dlkyRjBhVzl1TENCcGJpQmhibHh1SUNvZ1lYSnlZWGtnZDJsMGFDQmhiaUJsZUhCc2FXTnBkQ0JyWlhseklIQnliM0JsY25SNUlHUmxabWx1WldRc0lHOXlJR2x1SUdGdUlHOWlhbVZqZENCc2FYUmxjbUZzWEc0Z0tpQjNhWFJvSUhaaGJHbGtJR3RsZVNCd2NtOXdaWEowZVM1Y2JpQXFYRzRnS2lCQWFXNTBaWEp1WVd4Y2JpQXFJRUJ3WVhKaGJTQjdVbVZoWTNST2IyUmxmU0J1YjJSbElGTjBZWFJwWTJGc2JIa2djR0Z6YzJWa0lHTm9hV3hrSUc5bUlHRnVlU0IwZVhCbExseHVJQ29nUUhCaGNtRnRJSHNxZlNCd1lYSmxiblJVZVhCbElHNXZaR1VuY3lCd1lYSmxiblFuY3lCMGVYQmxMbHh1SUNvdlhHNW1kVzVqZEdsdmJpQjJZV3hwWkdGMFpVTm9hV3hrUzJWNWN5aHViMlJsTENCd1lYSmxiblJVZVhCbEtTQjdYRzRnSUdsbUlDaDBlWEJsYjJZZ2JtOWtaU0FoUFQwZ0oyOWlhbVZqZENjcElIdGNiaUFnSUNCeVpYUjFjbTQ3WEc0Z0lIMWNiaUFnYVdZZ0tFRnljbUY1TG1selFYSnlZWGtvYm05a1pTa3BJSHRjYmlBZ0lDQm1iM0lnS0haaGNpQnBJRDBnTURzZ2FTQThJRzV2WkdVdWJHVnVaM1JvT3lCcEt5c3BJSHRjYmlBZ0lDQWdJSFpoY2lCamFHbHNaQ0E5SUc1dlpHVmJhVjA3WEc0Z0lDQWdJQ0JwWmlBb1VtVmhZM1JGYkdWdFpXNTBMbWx6Vm1Gc2FXUkZiR1Z0Wlc1MEtHTm9hV3hrS1NrZ2UxeHVJQ0FnSUNBZ0lDQjJZV3hwWkdGMFpVVjRjR3hwWTJsMFMyVjVLR05vYVd4a0xDQndZWEpsYm5SVWVYQmxLVHRjYmlBZ0lDQWdJSDFjYmlBZ0lDQjlYRzRnSUgwZ1pXeHpaU0JwWmlBb1VtVmhZM1JGYkdWdFpXNTBMbWx6Vm1Gc2FXUkZiR1Z0Wlc1MEtHNXZaR1VwS1NCN1hHNGdJQ0FnTHk4Z1ZHaHBjeUJsYkdWdFpXNTBJSGRoY3lCd1lYTnpaV1FnYVc0Z1lTQjJZV3hwWkNCc2IyTmhkR2x2Ymk1Y2JpQWdJQ0JwWmlBb2JtOWtaUzVmYzNSdmNtVXBJSHRjYmlBZ0lDQWdJRzV2WkdVdVgzTjBiM0psTG5aaGJHbGtZWFJsWkNBOUlIUnlkV1U3WEc0Z0lDQWdmVnh1SUNCOUlHVnNjMlVnYVdZZ0tHNXZaR1VwSUh0Y2JpQWdJQ0IyWVhJZ2FYUmxjbUYwYjNKR2JpQTlJR2RsZEVsMFpYSmhkRzl5Um00b2JtOWtaU2s3WEc0Z0lDQWdMeThnUlc1MGNua2dhWFJsY21GMGIzSnpJSEJ5YjNacFpHVWdhVzF3YkdsamFYUWdhMlY1Y3k1Y2JpQWdJQ0JwWmlBb2FYUmxjbUYwYjNKR2Jpa2dlMXh1SUNBZ0lDQWdhV1lnS0dsMFpYSmhkRzl5Um00Z0lUMDlJRzV2WkdVdVpXNTBjbWxsY3lrZ2UxeHVJQ0FnSUNBZ0lDQjJZWElnYVhSbGNtRjBiM0lnUFNCcGRHVnlZWFJ2Y2tadUxtTmhiR3dvYm05a1pTazdYRzRnSUNBZ0lDQWdJSFpoY2lCemRHVndPMXh1SUNBZ0lDQWdJQ0IzYUdsc1pTQW9JU2h6ZEdWd0lEMGdhWFJsY21GMGIzSXVibVY0ZENncEtTNWtiMjVsS1NCN1hHNGdJQ0FnSUNBZ0lDQWdhV1lnS0ZKbFlXTjBSV3hsYldWdWRDNXBjMVpoYkdsa1JXeGxiV1Z1ZENoemRHVndMblpoYkhWbEtTa2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ2RtRnNhV1JoZEdWRmVIQnNhV05wZEV0bGVTaHpkR1Z3TG5aaGJIVmxMQ0J3WVhKbGJuUlVlWEJsS1R0Y2JpQWdJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJSDFjYmlBZ0lDQjlYRzRnSUgxY2JuMWNibHh1THlvcVhHNGdLaUJIYVhabGJpQmhiaUJsYkdWdFpXNTBMQ0IyWVd4cFpHRjBaU0IwYUdGMElHbDBjeUJ3Y205d2N5Qm1iMnhzYjNjZ2RHaGxJSEJ5YjNCVWVYQmxjeUJrWldacGJtbDBhVzl1TEZ4dUlDb2djSEp2ZG1sa1pXUWdZbmtnZEdobElIUjVjR1V1WEc0Z0tseHVJQ29nUUhCaGNtRnRJSHRTWldGamRFVnNaVzFsYm5SOUlHVnNaVzFsYm5SY2JpQXFMMXh1Wm5WdVkzUnBiMjRnZG1Gc2FXUmhkR1ZRY205d1ZIbHdaWE1vWld4bGJXVnVkQ2tnZTF4dUlDQjJZWElnWTI5dGNHOXVaVzUwUTJ4aGMzTWdQU0JsYkdWdFpXNTBMblI1Y0dVN1hHNGdJR2xtSUNoMGVYQmxiMllnWTI5dGNHOXVaVzUwUTJ4aGMzTWdJVDA5SUNkbWRXNWpkR2x2YmljcElIdGNiaUFnSUNCeVpYUjFjbTQ3WEc0Z0lIMWNiaUFnZG1GeUlHNWhiV1VnUFNCamIyMXdiMjVsYm5SRGJHRnpjeTVrYVhOd2JHRjVUbUZ0WlNCOGZDQmpiMjF3YjI1bGJuUkRiR0Z6Y3k1dVlXMWxPMXh1SUNCcFppQW9ZMjl0Y0c5dVpXNTBRMnhoYzNNdWNISnZjRlI1Y0dWektTQjdYRzRnSUNBZ1kyaGxZMnRTWldGamRGUjVjR1ZUY0dWaktHTnZiWEJ2Ym1WdWRFTnNZWE56TG5CeWIzQlVlWEJsY3l3Z1pXeGxiV1Z1ZEM1d2NtOXdjeXdnSjNCeWIzQW5MQ0J1WVcxbExDQmxiR1Z0Wlc1MExDQnVkV3hzS1R0Y2JpQWdmVnh1SUNCcFppQW9kSGx3Wlc5bUlHTnZiWEJ2Ym1WdWRFTnNZWE56TG1kbGRFUmxabUYxYkhSUWNtOXdjeUE5UFQwZ0oyWjFibU4wYVc5dUp5a2dlMXh1SUNBZ0lIQnliMk5sYzNNdVpXNTJMazVQUkVWZlJVNVdJQ0U5UFNBbmNISnZaSFZqZEdsdmJpY2dQeUIzWVhKdWFXNW5LR052YlhCdmJtVnVkRU5zWVhOekxtZGxkRVJsWm1GMWJIUlFjbTl3Y3k1cGMxSmxZV04wUTJ4aGMzTkJjSEJ5YjNabFpDd2dKMmRsZEVSbFptRjFiSFJRY205d2N5QnBjeUJ2Ym14NUlIVnpaV1FnYjI0Z1kyeGhjM05wWXlCU1pXRmpkQzVqY21WaGRHVkRiR0Z6Y3lBbklDc2dKMlJsWm1sdWFYUnBiMjV6TGlCVmMyVWdZU0J6ZEdGMGFXTWdjSEp2Y0dWeWRIa2dibUZ0WldRZ1lHUmxabUYxYkhSUWNtOXdjMkFnYVc1emRHVmhaQzRuS1NBNklIWnZhV1FnTUR0Y2JpQWdmVnh1ZlZ4dVhHNTJZWElnVW1WaFkzUkZiR1Z0Wlc1MFZtRnNhV1JoZEc5eUlEMGdlMXh1SUNCamNtVmhkR1ZGYkdWdFpXNTBPaUJtZFc1amRHbHZiaUFvZEhsd1pTd2djSEp2Y0hNc0lHTm9hV3hrY21WdUtTQjdYRzRnSUNBZ2RtRnlJSFpoYkdsa1ZIbHdaU0E5SUhSNWNHVnZaaUIwZVhCbElEMDlQU0FuYzNSeWFXNW5KeUI4ZkNCMGVYQmxiMllnZEhsd1pTQTlQVDBnSjJaMWJtTjBhVzl1Snp0Y2JpQWdJQ0F2THlCWFpTQjNZWEp1SUdsdUlIUm9hWE1nWTJGelpTQmlkWFFnWkc5dUozUWdkR2h5YjNjdUlGZGxJR1Y0Y0dWamRDQjBhR1VnWld4bGJXVnVkQ0JqY21WaGRHbHZiaUIwYjF4dUlDQWdJQzh2SUhOMVkyTmxaV1FnWVc1a0lIUm9aWEpsSUhkcGJHd2diR2xyWld4NUlHSmxJR1Z5Y205eWN5QnBiaUJ5Wlc1a1pYSXVYRzRnSUNBZ2FXWWdLQ0YyWVd4cFpGUjVjR1VwSUh0Y2JpQWdJQ0FnSUdsbUlDaDBlWEJsYjJZZ2RIbHdaU0FoUFQwZ0oyWjFibU4wYVc5dUp5QW1KaUIwZVhCbGIyWWdkSGx3WlNBaFBUMGdKM04wY21sdVp5Y3BJSHRjYmlBZ0lDQWdJQ0FnZG1GeUlHbHVabThnUFNBbkp6dGNiaUFnSUNBZ0lDQWdhV1lnS0hSNWNHVWdQVDA5SUhWdVpHVm1hVzVsWkNCOGZDQjBlWEJsYjJZZ2RIbHdaU0E5UFQwZ0oyOWlhbVZqZENjZ0ppWWdkSGx3WlNBaFBUMGdiblZzYkNBbUppQlBZbXBsWTNRdWEyVjVjeWgwZVhCbEtTNXNaVzVuZEdnZ1BUMDlJREFwSUh0Y2JpQWdJQ0FnSUNBZ0lDQnBibVp2SUNzOUlDY2dXVzkxSUd4cGEyVnNlU0JtYjNKbmIzUWdkRzhnWlhod2IzSjBJSGx2ZFhJZ1kyOXRjRzl1Wlc1MElHWnliMjBnZEdobElHWnBiR1VnSnlBcklGd2lhWFFuY3lCa1pXWnBibVZrSUdsdUxsd2lPMXh1SUNBZ0lDQWdJQ0I5WEc1Y2JpQWdJQ0FnSUNBZ2RtRnlJSE52ZFhKalpVbHVabThnUFNCblpYUlRiM1Z5WTJWSmJtWnZSWEp5YjNKQlpHUmxibVIxYlNod2NtOXdjeWs3WEc0Z0lDQWdJQ0FnSUdsbUlDaHpiM1Z5WTJWSmJtWnZLU0I3WEc0Z0lDQWdJQ0FnSUNBZ2FXNW1ieUFyUFNCemIzVnlZMlZKYm1adk8xeHVJQ0FnSUNBZ0lDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUNBZ0lDQWdJR2x1Wm04Z0t6MGdaMlYwUkdWamJHRnlZWFJwYjI1RmNuSnZja0ZrWkdWdVpIVnRLQ2s3WEc0Z0lDQWdJQ0FnSUgxY2JseHVJQ0FnSUNBZ0lDQnBibVp2SUNzOUlGSmxZV04wUTI5dGNHOXVaVzUwVkhKbFpVaHZiMnN1WjJWMFEzVnljbVZ1ZEZOMFlXTnJRV1JrWlc1a2RXMG9LVHRjYmx4dUlDQWdJQ0FnSUNCMllYSWdZM1Z5Y21WdWRGTnZkWEpqWlNBOUlIQnliM0J6SUNFOVBTQnVkV3hzSUNZbUlIQnliM0J6SUNFOVBTQjFibVJsWm1sdVpXUWdKaVlnY0hKdmNITXVYMTl6YjNWeVkyVWdJVDA5SUhWdVpHVm1hVzVsWkNBL0lIQnliM0J6TGw5ZmMyOTFjbU5sSURvZ2JuVnNiRHRjYmlBZ0lDQWdJQ0FnVW1WaFkzUkRiMjF3YjI1bGJuUlVjbVZsU0c5dmF5NXdkWE5vVG05dVUzUmhibVJoY21SWFlYSnVhVzVuVTNSaFkyc29kSEoxWlN3Z1kzVnljbVZ1ZEZOdmRYSmpaU2s3WEc0Z0lDQWdJQ0FnSUhCeWIyTmxjM011Wlc1MkxrNVBSRVZmUlU1V0lDRTlQU0FuY0hKdlpIVmpkR2x2YmljZ1B5QjNZWEp1YVc1bktHWmhiSE5sTENBblVtVmhZM1F1WTNKbFlYUmxSV3hsYldWdWREb2dkSGx3WlNCcGN5QnBiblpoYkdsa0lDMHRJR1Y0Y0dWamRHVmtJR0VnYzNSeWFXNW5JQ2htYjNJZ0p5QXJJQ2RpZFdsc2RDMXBiaUJqYjIxd2IyNWxiblJ6S1NCdmNpQmhJR05zWVhOekwyWjFibU4wYVc5dUlDaG1iM0lnWTI5dGNHOXphWFJsSUNjZ0t5QW5ZMjl0Y0c5dVpXNTBjeWtnWW5WMElHZHZkRG9nSlhNdUpYTW5MQ0IwZVhCbElEMDlJRzUxYkd3Z1B5QjBlWEJsSURvZ2RIbHdaVzltSUhSNWNHVXNJR2x1Wm04cElEb2dkbTlwWkNBd08xeHVJQ0FnSUNBZ0lDQlNaV0ZqZEVOdmJYQnZibVZ1ZEZSeVpXVkliMjlyTG5CdmNFNXZibE4wWVc1a1lYSmtWMkZ5Ym1sdVoxTjBZV05yS0NrN1hHNGdJQ0FnSUNCOVhHNGdJQ0FnZlZ4dVhHNGdJQ0FnZG1GeUlHVnNaVzFsYm5RZ1BTQlNaV0ZqZEVWc1pXMWxiblF1WTNKbFlYUmxSV3hsYldWdWRDNWhjSEJzZVNoMGFHbHpMQ0JoY21kMWJXVnVkSE1wTzF4dVhHNGdJQ0FnTHk4Z1ZHaGxJSEpsYzNWc2RDQmpZVzRnWW1VZ2JuVnNiR2x6YUNCcFppQmhJRzF2WTJzZ2IzSWdZU0JqZFhOMGIyMGdablZ1WTNScGIyNGdhWE1nZFhObFpDNWNiaUFnSUNBdkx5QlVUMFJQT2lCRWNtOXdJSFJvYVhNZ2QyaGxiaUIwYUdWelpTQmhjbVVnYm04Z2JHOXVaMlZ5SUdGc2JHOTNaV1FnWVhNZ2RHaGxJSFI1Y0dVZ1lYSm5kVzFsYm5RdVhHNGdJQ0FnYVdZZ0tHVnNaVzFsYm5RZ1BUMGdiblZzYkNrZ2UxeHVJQ0FnSUNBZ2NtVjBkWEp1SUdWc1pXMWxiblE3WEc0Z0lDQWdmVnh1WEc0Z0lDQWdMeThnVTJ0cGNDQnJaWGtnZDJGeWJtbHVaeUJwWmlCMGFHVWdkSGx3WlNCcGMyNG5kQ0IyWVd4cFpDQnphVzVqWlNCdmRYSWdhMlY1SUhaaGJHbGtZWFJwYjI0Z2JHOW5hV05jYmlBZ0lDQXZMeUJrYjJWemJpZDBJR1Y0Y0dWamRDQmhJRzV2YmkxemRISnBibWN2Wm5WdVkzUnBiMjRnZEhsd1pTQmhibVFnWTJGdUlIUm9jbTkzSUdOdmJtWjFjMmx1WnlCbGNuSnZjbk11WEc0Z0lDQWdMeThnVjJVZ1pHOXVKM1FnZDJGdWRDQmxlR05sY0hScGIyNGdZbVZvWVhacGIzSWdkRzhnWkdsbVptVnlJR0psZEhkbFpXNGdaR1YySUdGdVpDQndjbTlrTGx4dUlDQWdJQzh2SUNoU1pXNWtaWEpwYm1jZ2QybHNiQ0IwYUhKdmR5QjNhWFJvSUdFZ2FHVnNjR1oxYkNCdFpYTnpZV2RsSUdGdVpDQmhjeUJ6YjI5dUlHRnpJSFJvWlNCMGVYQmxJR2x6WEc0Z0lDQWdMeThnWm1sNFpXUXNJSFJvWlNCclpYa2dkMkZ5Ym1sdVozTWdkMmxzYkNCaGNIQmxZWEl1S1Z4dUlDQWdJR2xtSUNoMllXeHBaRlI1Y0dVcElIdGNiaUFnSUNBZ0lHWnZjaUFvZG1GeUlHa2dQU0F5T3lCcElEd2dZWEpuZFcxbGJuUnpMbXhsYm1kMGFEc2dhU3NyS1NCN1hHNGdJQ0FnSUNBZ0lIWmhiR2xrWVhSbFEyaHBiR1JMWlhsektHRnlaM1Z0Wlc1MGMxdHBYU3dnZEhsd1pTazdYRzRnSUNBZ0lDQjlYRzRnSUNBZ2ZWeHVYRzRnSUNBZ2RtRnNhV1JoZEdWUWNtOXdWSGx3WlhNb1pXeGxiV1Z1ZENrN1hHNWNiaUFnSUNCeVpYUjFjbTRnWld4bGJXVnVkRHRjYmlBZ2ZTeGNibHh1SUNCamNtVmhkR1ZHWVdOMGIzSjVPaUJtZFc1amRHbHZiaUFvZEhsd1pTa2dlMXh1SUNBZ0lIWmhjaUIyWVd4cFpHRjBaV1JHWVdOMGIzSjVJRDBnVW1WaFkzUkZiR1Z0Wlc1MFZtRnNhV1JoZEc5eUxtTnlaV0YwWlVWc1pXMWxiblF1WW1sdVpDaHVkV3hzTENCMGVYQmxLVHRjYmlBZ0lDQXZMeUJNWldkaFkza2dhRzl2YXlCVVQwUlBPaUJYWVhKdUlHbG1JSFJvYVhNZ2FYTWdZV05qWlhOelpXUmNiaUFnSUNCMllXeHBaR0YwWldSR1lXTjBiM0o1TG5SNWNHVWdQU0IwZVhCbE8xeHVYRzRnSUNBZ2FXWWdLSEJ5YjJObGMzTXVaVzUyTGs1UFJFVmZSVTVXSUNFOVBTQW5jSEp2WkhWamRHbHZiaWNwSUh0Y2JpQWdJQ0FnSUdsbUlDaGpZVzVFWldacGJtVlFjbTl3WlhKMGVTa2dlMXh1SUNBZ0lDQWdJQ0JQWW1wbFkzUXVaR1ZtYVc1bFVISnZjR1Z5ZEhrb2RtRnNhV1JoZEdWa1JtRmpkRzl5ZVN3Z0ozUjVjR1VuTENCN1hHNGdJQ0FnSUNBZ0lDQWdaVzUxYldWeVlXSnNaVG9nWm1Gc2MyVXNYRzRnSUNBZ0lDQWdJQ0FnWjJWME9pQm1kVzVqZEdsdmJpQW9LU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQnNiM2RRY21sdmNtbDBlVmRoY201cGJtY29abUZzYzJVc0lDZEdZV04wYjNKNUxuUjVjR1VnYVhNZ1pHVndjbVZqWVhSbFpDNGdRV05qWlhOeklIUm9aU0JqYkdGemN5QmthWEpsWTNSc2VTQW5JQ3NnSjJKbFptOXlaU0J3WVhOemFXNW5JR2wwSUhSdklHTnlaV0YwWlVaaFkzUnZjbmt1SnlrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0JQWW1wbFkzUXVaR1ZtYVc1bFVISnZjR1Z5ZEhrb2RHaHBjeXdnSjNSNWNHVW5MQ0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJSFpoYkhWbE9pQjBlWEJsWEc0Z0lDQWdJQ0FnSUNBZ0lDQjlLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCMGVYQmxPMXh1SUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ2ZTazdYRzRnSUNBZ0lDQjlYRzRnSUNBZ2ZWeHVYRzRnSUNBZ2NtVjBkWEp1SUhaaGJHbGtZWFJsWkVaaFkzUnZjbms3WEc0Z0lIMHNYRzVjYmlBZ1kyeHZibVZGYkdWdFpXNTBPaUJtZFc1amRHbHZiaUFvWld4bGJXVnVkQ3dnY0hKdmNITXNJR05vYVd4a2NtVnVLU0I3WEc0Z0lDQWdkbUZ5SUc1bGQwVnNaVzFsYm5RZ1BTQlNaV0ZqZEVWc1pXMWxiblF1WTJ4dmJtVkZiR1Z0Wlc1MExtRndjR3g1S0hSb2FYTXNJR0Z5WjNWdFpXNTBjeWs3WEc0Z0lDQWdabTl5SUNoMllYSWdhU0E5SURJN0lHa2dQQ0JoY21kMWJXVnVkSE11YkdWdVozUm9PeUJwS3lzcElIdGNiaUFnSUNBZ0lIWmhiR2xrWVhSbFEyaHBiR1JMWlhsektHRnlaM1Z0Wlc1MGMxdHBYU3dnYm1WM1JXeGxiV1Z1ZEM1MGVYQmxLVHRjYmlBZ0lDQjlYRzRnSUNBZ2RtRnNhV1JoZEdWUWNtOXdWSGx3WlhNb2JtVjNSV3hsYldWdWRDazdYRzRnSUNBZ2NtVjBkWEp1SUc1bGQwVnNaVzFsYm5RN1hHNGdJSDFjYm4wN1hHNWNibTF2WkhWc1pTNWxlSEJ2Y25SeklEMGdVbVZoWTNSRmJHVnRaVzUwVm1Gc2FXUmhkRzl5T3lJc0lpOHFLbHh1SUNvZ1EyOXdlWEpwWjJoMElESXdNVFV0Y0hKbGMyVnVkQ3dnUm1GalpXSnZiMnNzSUVsdVl5NWNiaUFxSUVGc2JDQnlhV2RvZEhNZ2NtVnpaWEoyWldRdVhHNGdLbHh1SUNvZ1ZHaHBjeUJ6YjNWeVkyVWdZMjlrWlNCcGN5QnNhV05sYm5ObFpDQjFibVJsY2lCMGFHVWdRbE5FTFhOMGVXeGxJR3hwWTJWdWMyVWdabTkxYm1RZ2FXNGdkR2hsWEc0Z0tpQk1TVU5GVGxORklHWnBiR1VnYVc0Z2RHaGxJSEp2YjNRZ1pHbHlaV04wYjNKNUlHOW1JSFJvYVhNZ2MyOTFjbU5sSUhSeVpXVXVJRUZ1SUdGa1pHbDBhVzl1WVd3Z1ozSmhiblJjYmlBcUlHOW1JSEJoZEdWdWRDQnlhV2RvZEhNZ1kyRnVJR0psSUdadmRXNWtJR2x1SUhSb1pTQlFRVlJGVGxSVElHWnBiR1VnYVc0Z2RHaGxJSE5oYldVZ1pHbHlaV04wYjNKNUxseHVJQ3BjYmlBcUwxeHVYRzRuZFhObElITjBjbWxqZENjN1hHNWNiblpoY2lCM1lYSnVhVzVuSUQwZ2NtVnhkV2x5WlNnblptSnFjeTlzYVdJdmQyRnlibWx1WnljcE8xeHVYRzVtZFc1amRHbHZiaUIzWVhKdVRtOXZjQ2h3ZFdKc2FXTkpibk4wWVc1alpTd2dZMkZzYkdWeVRtRnRaU2tnZTF4dUlDQnBaaUFvY0hKdlkyVnpjeTVsYm5ZdVRrOUVSVjlGVGxZZ0lUMDlJQ2R3Y205a2RXTjBhVzl1SnlrZ2UxeHVJQ0FnSUhaaGNpQmpiMjV6ZEhKMVkzUnZjaUE5SUhCMVlteHBZMGx1YzNSaGJtTmxMbU52Ym5OMGNuVmpkRzl5TzF4dUlDQWdJSEJ5YjJObGMzTXVaVzUyTGs1UFJFVmZSVTVXSUNFOVBTQW5jSEp2WkhWamRHbHZiaWNnUHlCM1lYSnVhVzVuS0daaGJITmxMQ0FuSlhNb0xpNHVLVG9nUTJGdUlHOXViSGtnZFhCa1lYUmxJR0VnYlc5MWJuUmxaQ0J2Y2lCdGIzVnVkR2x1WnlCamIyMXdiMjVsYm5RdUlDY2dLeUFuVkdocGN5QjFjM1ZoYkd4NUlHMWxZVzV6SUhsdmRTQmpZV3hzWldRZ0pYTW9LU0J2YmlCaGJpQjFibTF2ZFc1MFpXUWdZMjl0Y0c5dVpXNTBMaUFuSUNzZ0oxUm9hWE1nYVhNZ1lTQnVieTF2Y0M0Z1VHeGxZWE5sSUdOb1pXTnJJSFJvWlNCamIyUmxJR1p2Y2lCMGFHVWdKWE1nWTI5dGNHOXVaVzUwTGljc0lHTmhiR3hsY2s1aGJXVXNJR05oYkd4bGNrNWhiV1VzSUdOdmJuTjBjblZqZEc5eUlDWW1JQ2hqYjI1emRISjFZM1J2Y2k1a2FYTndiR0Y1VG1GdFpTQjhmQ0JqYjI1emRISjFZM1J2Y2k1dVlXMWxLU0I4ZkNBblVtVmhZM1JEYkdGemN5Y3BJRG9nZG05cFpDQXdPMXh1SUNCOVhHNTlYRzVjYmk4cUtseHVJQ29nVkdocGN5QnBjeUIwYUdVZ1lXSnpkSEpoWTNRZ1FWQkpJR1p2Y2lCaGJpQjFjR1JoZEdVZ2NYVmxkV1V1WEc0Z0tpOWNiblpoY2lCU1pXRmpkRTV2YjNCVmNHUmhkR1ZSZFdWMVpTQTlJSHRjYmlBZ0x5b3FYRzRnSUNBcUlFTm9aV05yY3lCM2FHVjBhR1Z5SUc5eUlHNXZkQ0IwYUdseklHTnZiWEJ2YzJsMFpTQmpiMjF3YjI1bGJuUWdhWE1nYlc5MWJuUmxaQzVjYmlBZ0lDb2dRSEJoY21GdElIdFNaV0ZqZEVOc1lYTnpmU0J3ZFdKc2FXTkpibk4wWVc1alpTQlVhR1VnYVc1emRHRnVZMlVnZDJVZ2QyRnVkQ0IwYnlCMFpYTjBMbHh1SUNBZ0tpQkFjbVYwZFhKdUlIdGliMjlzWldGdWZTQlVjblZsSUdsbUlHMXZkVzUwWldRc0lHWmhiSE5sSUc5MGFHVnlkMmx6WlM1Y2JpQWdJQ29nUUhCeWIzUmxZM1JsWkZ4dUlDQWdLaUJBWm1sdVlXeGNiaUFnSUNvdlhHNGdJR2x6VFc5MWJuUmxaRG9nWm5WdVkzUnBiMjRnS0hCMVlteHBZMGx1YzNSaGJtTmxLU0I3WEc0Z0lDQWdjbVYwZFhKdUlHWmhiSE5sTzF4dUlDQjlMRnh1WEc0Z0lDOHFLbHh1SUNBZ0tpQkZibkYxWlhWbElHRWdZMkZzYkdKaFkyc2dkR2hoZENCM2FXeHNJR0psSUdWNFpXTjFkR1ZrSUdGbWRHVnlJR0ZzYkNCMGFHVWdjR1Z1WkdsdVp5QjFjR1JoZEdWelhHNGdJQ0FxSUdoaGRtVWdjSEp2WTJWemMyVmtMbHh1SUNBZ0tseHVJQ0FnS2lCQWNHRnlZVzBnZTFKbFlXTjBRMnhoYzNOOUlIQjFZbXhwWTBsdWMzUmhibU5sSUZSb1pTQnBibk4wWVc1alpTQjBieUIxYzJVZ1lYTWdZSFJvYVhOZ0lHTnZiblJsZUhRdVhHNGdJQ0FxSUVCd1lYSmhiU0I3UDJaMWJtTjBhVzl1ZlNCallXeHNZbUZqYXlCRFlXeHNaV1FnWVdaMFpYSWdjM1JoZEdVZ2FYTWdkWEJrWVhSbFpDNWNiaUFnSUNvZ1FHbHVkR1Z5Ym1Gc1hHNGdJQ0FxTDF4dUlDQmxibkYxWlhWbFEyRnNiR0poWTJzNklHWjFibU4wYVc5dUlDaHdkV0pzYVdOSmJuTjBZVzVqWlN3Z1kyRnNiR0poWTJzcElIdDlMRnh1WEc0Z0lDOHFLbHh1SUNBZ0tpQkdiM0pqWlhNZ1lXNGdkWEJrWVhSbExpQlVhR2x6SUhOb2IzVnNaQ0J2Ym14NUlHSmxJR2x1ZG05clpXUWdkMmhsYmlCcGRDQnBjeUJyYm05M2JpQjNhWFJvWEc0Z0lDQXFJR05sY25SaGFXNTBlU0IwYUdGMElIZGxJR0Z5WlNBcUttNXZkQ29xSUdsdUlHRWdSRTlOSUhSeVlXNXpZV04wYVc5dUxseHVJQ0FnS2x4dUlDQWdLaUJaYjNVZ2JXRjVJSGRoYm5RZ2RHOGdZMkZzYkNCMGFHbHpJSGRvWlc0Z2VXOTFJR3R1YjNjZ2RHaGhkQ0J6YjIxbElHUmxaWEJsY2lCaGMzQmxZM1FnYjJZZ2RHaGxYRzRnSUNBcUlHTnZiWEJ2Ym1WdWRDZHpJSE4wWVhSbElHaGhjeUJqYUdGdVoyVmtJR0oxZENCZ2MyVjBVM1JoZEdWZ0lIZGhjeUJ1YjNRZ1kyRnNiR1ZrTGx4dUlDQWdLbHh1SUNBZ0tpQlVhR2x6SUhkcGJHd2dibTkwSUdsdWRtOXJaU0JnYzJodmRXeGtRMjl0Y0c5dVpXNTBWWEJrWVhSbFlDd2dZblYwSUdsMElIZHBiR3dnYVc1MmIydGxYRzRnSUNBcUlHQmpiMjF3YjI1bGJuUlhhV3hzVlhCa1lYUmxZQ0JoYm1RZ1lHTnZiWEJ2Ym1WdWRFUnBaRlZ3WkdGMFpXQXVYRzRnSUNBcVhHNGdJQ0FxSUVCd1lYSmhiU0I3VW1WaFkzUkRiR0Z6YzMwZ2NIVmliR2xqU1c1emRHRnVZMlVnVkdobElHbHVjM1JoYm1ObElIUm9ZWFFnYzJodmRXeGtJSEpsY21WdVpHVnlMbHh1SUNBZ0tpQkFhVzUwWlhKdVlXeGNiaUFnSUNvdlhHNGdJR1Z1Y1hWbGRXVkdiM0pqWlZWd1pHRjBaVG9nWm5WdVkzUnBiMjRnS0hCMVlteHBZMGx1YzNSaGJtTmxLU0I3WEc0Z0lDQWdkMkZ5Yms1dmIzQW9jSFZpYkdsalNXNXpkR0Z1WTJVc0lDZG1iM0pqWlZWd1pHRjBaU2NwTzF4dUlDQjlMRnh1WEc0Z0lDOHFLbHh1SUNBZ0tpQlNaWEJzWVdObGN5QmhiR3dnYjJZZ2RHaGxJSE4wWVhSbExpQkJiSGRoZVhNZ2RYTmxJSFJvYVhNZ2IzSWdZSE5sZEZOMFlYUmxZQ0IwYnlCdGRYUmhkR1VnYzNSaGRHVXVYRzRnSUNBcUlGbHZkU0J6YUc5MWJHUWdkSEpsWVhRZ1lIUm9hWE11YzNSaGRHVmdJR0Z6SUdsdGJYVjBZV0pzWlM1Y2JpQWdJQ3BjYmlBZ0lDb2dWR2hsY21VZ2FYTWdibThnWjNWaGNtRnVkR1ZsSUhSb1lYUWdZSFJvYVhNdWMzUmhkR1ZnSUhkcGJHd2dZbVVnYVcxdFpXUnBZWFJsYkhrZ2RYQmtZWFJsWkN3Z2MyOWNiaUFnSUNvZ1lXTmpaWE56YVc1bklHQjBhR2x6TG5OMFlYUmxZQ0JoWm5SbGNpQmpZV3hzYVc1bklIUm9hWE1nYldWMGFHOWtJRzFoZVNCeVpYUjFjbTRnZEdobElHOXNaQ0IyWVd4MVpTNWNiaUFnSUNwY2JpQWdJQ29nUUhCaGNtRnRJSHRTWldGamRFTnNZWE56ZlNCd2RXSnNhV05KYm5OMFlXNWpaU0JVYUdVZ2FXNXpkR0Z1WTJVZ2RHaGhkQ0J6YUc5MWJHUWdjbVZ5Wlc1a1pYSXVYRzRnSUNBcUlFQndZWEpoYlNCN2IySnFaV04wZlNCamIyMXdiR1YwWlZOMFlYUmxJRTVsZUhRZ2MzUmhkR1V1WEc0Z0lDQXFJRUJwYm5SbGNtNWhiRnh1SUNBZ0tpOWNiaUFnWlc1eGRXVjFaVkpsY0d4aFkyVlRkR0YwWlRvZ1puVnVZM1JwYjI0Z0tIQjFZbXhwWTBsdWMzUmhibU5sTENCamIyMXdiR1YwWlZOMFlYUmxLU0I3WEc0Z0lDQWdkMkZ5Yms1dmIzQW9jSFZpYkdsalNXNXpkR0Z1WTJVc0lDZHlaWEJzWVdObFUzUmhkR1VuS1R0Y2JpQWdmU3hjYmx4dUlDQXZLaXBjYmlBZ0lDb2dVMlYwY3lCaElITjFZbk5sZENCdlppQjBhR1VnYzNSaGRHVXVJRlJvYVhNZ2IyNXNlU0JsZUdsemRITWdZbVZqWVhWelpTQmZjR1Z1WkdsdVoxTjBZWFJsSUdselhHNGdJQ0FxSUdsdWRHVnlibUZzTGlCVWFHbHpJSEJ5YjNacFpHVnpJR0VnYldWeVoybHVaeUJ6ZEhKaGRHVm5lU0IwYUdGMElHbHpJRzV2ZENCaGRtRnBiR0ZpYkdVZ2RHOGdaR1ZsY0Z4dUlDQWdLaUJ3Y205d1pYSjBhV1Z6SUhkb2FXTm9JR2x6SUdOdmJtWjFjMmx1Wnk0Z1ZFOUVUem9nUlhod2IzTmxJSEJsYm1ScGJtZFRkR0YwWlNCdmNpQmtiMjRuZENCMWMyVWdhWFJjYmlBZ0lDb2daSFZ5YVc1bklIUm9aU0J0WlhKblpTNWNiaUFnSUNwY2JpQWdJQ29nUUhCaGNtRnRJSHRTWldGamRFTnNZWE56ZlNCd2RXSnNhV05KYm5OMFlXNWpaU0JVYUdVZ2FXNXpkR0Z1WTJVZ2RHaGhkQ0J6YUc5MWJHUWdjbVZ5Wlc1a1pYSXVYRzRnSUNBcUlFQndZWEpoYlNCN2IySnFaV04wZlNCd1lYSjBhV0ZzVTNSaGRHVWdUbVY0ZENCd1lYSjBhV0ZzSUhOMFlYUmxJSFJ2SUdKbElHMWxjbWRsWkNCM2FYUm9JSE4wWVhSbExseHVJQ0FnS2lCQWFXNTBaWEp1WVd4Y2JpQWdJQ292WEc0Z0lHVnVjWFZsZFdWVFpYUlRkR0YwWlRvZ1puVnVZM1JwYjI0Z0tIQjFZbXhwWTBsdWMzUmhibU5sTENCd1lYSjBhV0ZzVTNSaGRHVXBJSHRjYmlBZ0lDQjNZWEp1VG05dmNDaHdkV0pzYVdOSmJuTjBZVzVqWlN3Z0ozTmxkRk4wWVhSbEp5azdYRzRnSUgxY2JuMDdYRzVjYm0xdlpIVnNaUzVsZUhCdmNuUnpJRDBnVW1WaFkzUk9iMjl3VlhCa1lYUmxVWFZsZFdVN0lpd2lMeW9xWEc0Z0tpQkRiM0I1Y21sbmFIUWdNakF4TXkxd2NtVnpaVzUwTENCR1lXTmxZbTl2YXl3Z1NXNWpMbHh1SUNvZ1FXeHNJSEpwWjJoMGN5QnlaWE5sY25abFpDNWNiaUFxWEc0Z0tpQlVhR2x6SUhOdmRYSmpaU0JqYjJSbElHbHpJR3hwWTJWdWMyVmtJSFZ1WkdWeUlIUm9aU0JDVTBRdGMzUjViR1VnYkdsalpXNXpaU0JtYjNWdVpDQnBiaUIwYUdWY2JpQXFJRXhKUTBWT1UwVWdabWxzWlNCcGJpQjBhR1VnY205dmRDQmthWEpsWTNSdmNua2diMllnZEdocGN5QnpiM1Z5WTJVZ2RISmxaUzRnUVc0Z1lXUmthWFJwYjI1aGJDQm5jbUZ1ZEZ4dUlDb2diMllnY0dGMFpXNTBJSEpwWjJoMGN5QmpZVzRnWW1VZ1ptOTFibVFnYVc0Z2RHaGxJRkJCVkVWT1ZGTWdabWxzWlNCcGJpQjBhR1VnYzJGdFpTQmthWEpsWTNSdmNua3VYRzRnS2x4dUlDb2dYRzRnS2k5Y2JseHVKM1Z6WlNCemRISnBZM1FuTzF4dVhHNTJZWElnVW1WaFkzUlFjbTl3Vkhsd1pVeHZZMkYwYVc5dVRtRnRaWE1nUFNCN2ZUdGNibHh1YVdZZ0tIQnliMk5sYzNNdVpXNTJMazVQUkVWZlJVNVdJQ0U5UFNBbmNISnZaSFZqZEdsdmJpY3BJSHRjYmlBZ1VtVmhZM1JRY205d1ZIbHdaVXh2WTJGMGFXOXVUbUZ0WlhNZ1BTQjdYRzRnSUNBZ2NISnZjRG9nSjNCeWIzQW5MRnh1SUNBZ0lHTnZiblJsZUhRNklDZGpiMjUwWlhoMEp5eGNiaUFnSUNCamFHbHNaRU52Ym5SbGVIUTZJQ2RqYUdsc1pDQmpiMjUwWlhoMEoxeHVJQ0I5TzF4dWZWeHVYRzV0YjJSMWJHVXVaWGh3YjNKMGN5QTlJRkpsWVdOMFVISnZjRlI1Y0dWTWIyTmhkR2x2Yms1aGJXVnpPeUlzSWk4cUtseHVJQ29nUTI5d2VYSnBaMmgwSURJd01UTXRjSEpsYzJWdWRDd2dSbUZqWldKdmIyc3NJRWx1WXk1Y2JpQXFJRUZzYkNCeWFXZG9kSE1nY21WelpYSjJaV1F1WEc0Z0tseHVJQ29nVkdocGN5QnpiM1Z5WTJVZ1kyOWtaU0JwY3lCc2FXTmxibk5sWkNCMWJtUmxjaUIwYUdVZ1FsTkVMWE4wZVd4bElHeHBZMlZ1YzJVZ1ptOTFibVFnYVc0Z2RHaGxYRzRnS2lCTVNVTkZUbE5GSUdacGJHVWdhVzRnZEdobElISnZiM1FnWkdseVpXTjBiM0o1SUc5bUlIUm9hWE1nYzI5MWNtTmxJSFJ5WldVdUlFRnVJR0ZrWkdsMGFXOXVZV3dnWjNKaGJuUmNiaUFxSUc5bUlIQmhkR1Z1ZENCeWFXZG9kSE1nWTJGdUlHSmxJR1p2ZFc1a0lHbHVJSFJvWlNCUVFWUkZUbFJUSUdacGJHVWdhVzRnZEdobElITmhiV1VnWkdseVpXTjBiM0o1TGx4dUlDcGNiaUFxTDF4dVhHNG5kWE5sSUhOMGNtbGpkQ2M3WEc1Y2JuWmhjaUJmY21WeGRXbHlaU0E5SUhKbGNYVnBjbVVvSnk0dlVtVmhZM1JGYkdWdFpXNTBKeWtzWEc0Z0lDQWdhWE5XWVd4cFpFVnNaVzFsYm5RZ1BTQmZjbVZ4ZFdseVpTNXBjMVpoYkdsa1JXeGxiV1Z1ZER0Y2JseHVkbUZ5SUdaaFkzUnZjbmtnUFNCeVpYRjFhWEpsS0Nkd2NtOXdMWFI1Y0dWekwyWmhZM1J2Y25rbktUdGNibHh1Ylc5a2RXeGxMbVY0Y0c5eWRITWdQU0JtWVdOMGIzSjVLR2x6Vm1Gc2FXUkZiR1Z0Wlc1MEtUc2lMQ0l2S2lwY2JpQXFJRU52Y0hseWFXZG9kQ0F5TURFekxYQnlaWE5sYm5Rc0lFWmhZMlZpYjI5ckxDQkpibU11WEc0Z0tpQkJiR3dnY21sbmFIUnpJSEpsYzJWeWRtVmtMbHh1SUNwY2JpQXFJRlJvYVhNZ2MyOTFjbU5sSUdOdlpHVWdhWE1nYkdsalpXNXpaV1FnZFc1a1pYSWdkR2hsSUVKVFJDMXpkSGxzWlNCc2FXTmxibk5sSUdadmRXNWtJR2x1SUhSb1pWeHVJQ29nVEVsRFJVNVRSU0JtYVd4bElHbHVJSFJvWlNCeWIyOTBJR1JwY21WamRHOXllU0J2WmlCMGFHbHpJSE52ZFhKalpTQjBjbVZsTGlCQmJpQmhaR1JwZEdsdmJtRnNJR2R5WVc1MFhHNGdLaUJ2WmlCd1lYUmxiblFnY21sbmFIUnpJR05oYmlCaVpTQm1iM1Z1WkNCcGJpQjBhR1VnVUVGVVJVNVVVeUJtYVd4bElHbHVJSFJvWlNCellXMWxJR1JwY21WamRHOXllUzVjYmlBcVhHNGdLaUJjYmlBcUwxeHVYRzRuZFhObElITjBjbWxqZENjN1hHNWNiblpoY2lCU1pXRmpkRkJ5YjNCVWVYQmxjMU5sWTNKbGRDQTlJQ2RUUlVOU1JWUmZSRTlmVGs5VVgxQkJVMU5mVkVoSlUxOVBVbDlaVDFWZlYwbE1URjlDUlY5R1NWSkZSQ2M3WEc1Y2JtMXZaSFZzWlM1bGVIQnZjblJ6SUQwZ1VtVmhZM1JRY205d1ZIbHdaWE5UWldOeVpYUTdJaXdpTHlvcVhHNGdLaUJEYjNCNWNtbG5hSFFnTWpBeE15MXdjbVZ6Wlc1MExDQkdZV05sWW05dmF5d2dTVzVqTGx4dUlDb2dRV3hzSUhKcFoyaDBjeUJ5WlhObGNuWmxaQzVjYmlBcVhHNGdLaUJVYUdseklITnZkWEpqWlNCamIyUmxJR2x6SUd4cFkyVnVjMlZrSUhWdVpHVnlJSFJvWlNCQ1UwUXRjM1I1YkdVZ2JHbGpaVzV6WlNCbWIzVnVaQ0JwYmlCMGFHVmNiaUFxSUV4SlEwVk9VMFVnWm1sc1pTQnBiaUIwYUdVZ2NtOXZkQ0JrYVhKbFkzUnZjbmtnYjJZZ2RHaHBjeUJ6YjNWeVkyVWdkSEpsWlM0Z1FXNGdZV1JrYVhScGIyNWhiQ0JuY21GdWRGeHVJQ29nYjJZZ2NHRjBaVzUwSUhKcFoyaDBjeUJqWVc0Z1ltVWdabTkxYm1RZ2FXNGdkR2hsSUZCQlZFVk9WRk1nWm1sc1pTQnBiaUIwYUdVZ2MyRnRaU0JrYVhKbFkzUnZjbmt1WEc0Z0tseHVJQ292WEc1Y2JpZDFjMlVnYzNSeWFXTjBKenRjYmx4dWJXOWtkV3hsTG1WNGNHOXlkSE1nUFNBbk1UVXVOaTR4SnpzaUxDSXZLaXBjYmlBcUlFTnZjSGx5YVdkb2RDQXlNREV6TFhCeVpYTmxiblFzSUVaaFkyVmliMjlyTENCSmJtTXVYRzRnS2lCQmJHd2djbWxuYUhSeklISmxjMlZ5ZG1Wa0xseHVJQ3BjYmlBcUlGUm9hWE1nYzI5MWNtTmxJR052WkdVZ2FYTWdiR2xqWlc1elpXUWdkVzVrWlhJZ2RHaGxJRUpUUkMxemRIbHNaU0JzYVdObGJuTmxJR1p2ZFc1a0lHbHVJSFJvWlZ4dUlDb2dURWxEUlU1VFJTQm1hV3hsSUdsdUlIUm9aU0J5YjI5MElHUnBjbVZqZEc5eWVTQnZaaUIwYUdseklITnZkWEpqWlNCMGNtVmxMaUJCYmlCaFpHUnBkR2x2Ym1Gc0lHZHlZVzUwWEc0Z0tpQnZaaUJ3WVhSbGJuUWdjbWxuYUhSeklHTmhiaUJpWlNCbWIzVnVaQ0JwYmlCMGFHVWdVRUZVUlU1VVV5Qm1hV3hsSUdsdUlIUm9aU0J6WVcxbElHUnBjbVZqZEc5eWVTNWNiaUFxWEc0Z0tpQmNiaUFxTDF4dVhHNG5kWE5sSUhOMGNtbGpkQ2M3WEc1Y2JuWmhjaUJqWVc1RVpXWnBibVZRY205d1pYSjBlU0E5SUdaaGJITmxPMXh1YVdZZ0tIQnliMk5sYzNNdVpXNTJMazVQUkVWZlJVNVdJQ0U5UFNBbmNISnZaSFZqZEdsdmJpY3BJSHRjYmlBZ2RISjVJSHRjYmlBZ0lDQXZMeUFrUm14dmQwWnBlRTFsSUdoMGRIQnpPaTh2WjJsMGFIVmlMbU52YlM5bVlXTmxZbTl2YXk5bWJHOTNMMmx6YzNWbGN5OHlPRFZjYmlBZ0lDQlBZbXBsWTNRdVpHVm1hVzVsVUhKdmNHVnlkSGtvZTMwc0lDZDRKeXdnZXlCblpYUTZJR1oxYm1OMGFXOXVJQ2dwSUh0OUlIMHBPMXh1SUNBZ0lHTmhia1JsWm1sdVpWQnliM0JsY25SNUlEMGdkSEoxWlR0Y2JpQWdmU0JqWVhSamFDQW9lQ2tnZTF4dUlDQWdJQzh2SUVsRklIZHBiR3dnWm1GcGJDQnZiaUJrWldacGJtVlFjbTl3WlhKMGVWeHVJQ0I5WEc1OVhHNWNibTF2WkhWc1pTNWxlSEJ2Y25SeklEMGdZMkZ1UkdWbWFXNWxVSEp2Y0dWeWRIazdJaXdpTHlvcVhHNGdLaUJEYjNCNWNtbG5hSFFnTWpBeE15MXdjbVZ6Wlc1MExDQkdZV05sWW05dmF5d2dTVzVqTGx4dUlDb2dRV3hzSUhKcFoyaDBjeUJ5WlhObGNuWmxaQzVjYmlBcVhHNGdLaUJVYUdseklITnZkWEpqWlNCamIyUmxJR2x6SUd4cFkyVnVjMlZrSUhWdVpHVnlJSFJvWlNCQ1UwUXRjM1I1YkdVZ2JHbGpaVzV6WlNCbWIzVnVaQ0JwYmlCMGFHVmNiaUFxSUV4SlEwVk9VMFVnWm1sc1pTQnBiaUIwYUdVZ2NtOXZkQ0JrYVhKbFkzUnZjbmtnYjJZZ2RHaHBjeUJ6YjNWeVkyVWdkSEpsWlM0Z1FXNGdZV1JrYVhScGIyNWhiQ0JuY21GdWRGeHVJQ29nYjJZZ2NHRjBaVzUwSUhKcFoyaDBjeUJqWVc0Z1ltVWdabTkxYm1RZ2FXNGdkR2hsSUZCQlZFVk9WRk1nWm1sc1pTQnBiaUIwYUdVZ2MyRnRaU0JrYVhKbFkzUnZjbmt1WEc0Z0tseHVJQ292WEc1Y2JpZDFjMlVnYzNSeWFXTjBKenRjYmx4dWRtRnlJRjl3Y205a1NXNTJZWEpwWVc1MElEMGdjbVZ4ZFdseVpTZ25MaTl5WldGamRGQnliMlJKYm5aaGNtbGhiblFuS1R0Y2JseHVkbUZ5SUZKbFlXTjBVSEp2Y0ZSNWNHVk1iMk5oZEdsdmJrNWhiV1Z6SUQwZ2NtVnhkV2x5WlNnbkxpOVNaV0ZqZEZCeWIzQlVlWEJsVEc5allYUnBiMjVPWVcxbGN5Y3BPMXh1ZG1GeUlGSmxZV04wVUhKdmNGUjVjR1Z6VTJWamNtVjBJRDBnY21WeGRXbHlaU2duTGk5U1pXRmpkRkJ5YjNCVWVYQmxjMU5sWTNKbGRDY3BPMXh1WEc1MllYSWdhVzUyWVhKcFlXNTBJRDBnY21WeGRXbHlaU2duWm1KcWN5OXNhV0l2YVc1MllYSnBZVzUwSnlrN1hHNTJZWElnZDJGeWJtbHVaeUE5SUhKbGNYVnBjbVVvSjJaaWFuTXZiR2xpTDNkaGNtNXBibWNuS1R0Y2JseHVkbUZ5SUZKbFlXTjBRMjl0Y0c5dVpXNTBWSEpsWlVodmIyczdYRzVjYm1sbUlDaDBlWEJsYjJZZ2NISnZZMlZ6Y3lBaFBUMGdKM1Z1WkdWbWFXNWxaQ2NnSmlZZ2NISnZZMlZ6Y3k1bGJuWWdKaVlnY0hKdlkyVnpjeTVsYm5ZdVRrOUVSVjlGVGxZZ1BUMDlJQ2QwWlhOMEp5a2dlMXh1SUNBdkx5QlVaVzF3YjNKaGNua2dhR0ZqYXk1Y2JpQWdMeThnU1c1c2FXNWxJSEpsY1hWcGNtVnpJR1J2YmlkMElIZHZjbXNnZDJWc2JDQjNhWFJvSUVwbGMzUTZYRzRnSUM4dklHaDBkSEJ6T2k4dloybDBhSFZpTG1OdmJTOW1ZV05sWW05dmF5OXlaV0ZqZEM5cGMzTjFaWE12TnpJME1GeHVJQ0F2THlCU1pXMXZkbVVnZEdobElHbHViR2x1WlNCeVpYRjFhWEpsY3lCM2FHVnVJSGRsSUdSdmJpZDBJRzVsWldRZ2RHaGxiU0JoYm5sdGIzSmxPbHh1SUNBdkx5Qm9kSFJ3Y3pvdkwyZHBkR2gxWWk1amIyMHZabUZqWldKdmIyc3ZjbVZoWTNRdmNIVnNiQzgzTVRjNFhHNGdJRkpsWVdOMFEyOXRjRzl1Wlc1MFZISmxaVWh2YjJzZ1BTQnlaWEYxYVhKbEtDY3VMMUpsWVdOMFEyOXRjRzl1Wlc1MFZISmxaVWh2YjJzbktUdGNibjFjYmx4dWRtRnlJR3h2WjJkbFpGUjVjR1ZHWVdsc2RYSmxjeUE5SUh0OU8xeHVYRzR2S2lwY2JpQXFJRUZ6YzJWeWRDQjBhR0YwSUhSb1pTQjJZV3gxWlhNZ2JXRjBZMmdnZDJsMGFDQjBhR1VnZEhsd1pTQnpjR1ZqY3k1Y2JpQXFJRVZ5Y205eUlHMWxjM05oWjJWeklHRnlaU0J0WlcxdmNtbDZaV1FnWVc1a0lIZHBiR3dnYjI1c2VTQmlaU0J6YUc5M2JpQnZibU5sTGx4dUlDcGNiaUFxSUVCd1lYSmhiU0I3YjJKcVpXTjBmU0IwZVhCbFUzQmxZM01nVFdGd0lHOW1JRzVoYldVZ2RHOGdZU0JTWldGamRGQnliM0JVZVhCbFhHNGdLaUJBY0dGeVlXMGdlMjlpYW1WamRIMGdkbUZzZFdWeklGSjFiblJwYldVZ2RtRnNkV1Z6SUhSb1lYUWdibVZsWkNCMGJ5QmlaU0IwZVhCbExXTm9aV05yWldSY2JpQXFJRUJ3WVhKaGJTQjdjM1J5YVc1bmZTQnNiMk5oZEdsdmJpQmxMbWN1SUZ3aWNISnZjRndpTENCY0ltTnZiblJsZUhSY0lpd2dYQ0pqYUdsc1pDQmpiMjUwWlhoMFhDSmNiaUFxSUVCd1lYSmhiU0I3YzNSeWFXNW5mU0JqYjIxd2IyNWxiblJPWVcxbElFNWhiV1VnYjJZZ2RHaGxJR052YlhCdmJtVnVkQ0JtYjNJZ1pYSnliM0lnYldWemMyRm5aWE11WEc0Z0tpQkFjR0Z5WVcwZ2V6OXZZbXBsWTNSOUlHVnNaVzFsYm5RZ1ZHaGxJRkpsWVdOMElHVnNaVzFsYm5RZ2RHaGhkQ0JwY3lCaVpXbHVaeUIwZVhCbExXTm9aV05yWldSY2JpQXFJRUJ3WVhKaGJTQjdQMjUxYldKbGNuMGdaR1ZpZFdkSlJDQlVhR1VnVW1WaFkzUWdZMjl0Y0c5dVpXNTBJR2x1YzNSaGJtTmxJSFJvWVhRZ2FYTWdZbVZwYm1jZ2RIbHdaUzFqYUdWamEyVmtYRzRnS2lCQWNISnBkbUYwWlZ4dUlDb3ZYRzVtZFc1amRHbHZiaUJqYUdWamExSmxZV04wVkhsd1pWTndaV01vZEhsd1pWTndaV056TENCMllXeDFaWE1zSUd4dlkyRjBhVzl1TENCamIyMXdiMjVsYm5ST1lXMWxMQ0JsYkdWdFpXNTBMQ0JrWldKMVowbEVLU0I3WEc0Z0lHWnZjaUFvZG1GeUlIUjVjR1ZUY0dWalRtRnRaU0JwYmlCMGVYQmxVM0JsWTNNcElIdGNiaUFnSUNCcFppQW9kSGx3WlZOd1pXTnpMbWhoYzA5M2JsQnliM0JsY25SNUtIUjVjR1ZUY0dWalRtRnRaU2twSUh0Y2JpQWdJQ0FnSUhaaGNpQmxjbkp2Y2p0Y2JpQWdJQ0FnSUM4dklGQnliM0FnZEhsd1pTQjJZV3hwWkdGMGFXOXVJRzFoZVNCMGFISnZkeTRnU1c0Z1kyRnpaU0IwYUdWNUlHUnZMQ0IzWlNCa2IyNG5kQ0IzWVc1MElIUnZYRzRnSUNBZ0lDQXZMeUJtWVdsc0lIUm9aU0J5Wlc1a1pYSWdjR2hoYzJVZ2QyaGxjbVVnYVhRZ1pHbGtiaWQwSUdaaGFXd2dZbVZtYjNKbExpQlRieUIzWlNCc2IyY2dhWFF1WEc0Z0lDQWdJQ0F2THlCQlpuUmxjaUIwYUdWelpTQm9ZWFpsSUdKbFpXNGdZMnhsWVc1bFpDQjFjQ3dnZDJVbmJHd2diR1YwSUhSb1pXMGdkR2h5YjNjdVhHNGdJQ0FnSUNCMGNua2dlMXh1SUNBZ0lDQWdJQ0F2THlCVWFHbHpJR2x6SUdsdWRHVnVkR2x2Ym1Gc2JIa2dZVzRnYVc1MllYSnBZVzUwSUhSb1lYUWdaMlYwY3lCallYVm5hSFF1SUVsMEozTWdkR2hsSUhOaGJXVmNiaUFnSUNBZ0lDQWdMeThnWW1Wb1lYWnBiM0lnWVhNZ2QybDBhRzkxZENCMGFHbHpJSE4wWVhSbGJXVnVkQ0JsZUdObGNIUWdkMmwwYUNCaElHSmxkSFJsY2lCdFpYTnpZV2RsTGx4dUlDQWdJQ0FnSUNBaEtIUjVjR1Z2WmlCMGVYQmxVM0JsWTNOYmRIbHdaVk53WldOT1lXMWxYU0E5UFQwZ0oyWjFibU4wYVc5dUp5a2dQeUJ3Y205alpYTnpMbVZ1ZGk1T1QwUkZYMFZPVmlBaFBUMGdKM0J5YjJSMVkzUnBiMjRuSUQ4Z2FXNTJZWEpwWVc1MEtHWmhiSE5sTENBbkpYTTZJQ1Z6SUhSNWNHVWdZQ1Z6WUNCcGN5QnBiblpoYkdsa095QnBkQ0J0ZFhOMElHSmxJR0VnWm5WdVkzUnBiMjRzSUhWemRXRnNiSGtnWm5KdmJTQlNaV0ZqZEM1UWNtOXdWSGx3WlhNdUp5d2dZMjl0Y0c5dVpXNTBUbUZ0WlNCOGZDQW5VbVZoWTNRZ1kyeGhjM01uTENCU1pXRmpkRkJ5YjNCVWVYQmxURzlqWVhScGIyNU9ZVzFsYzF0c2IyTmhkR2x2Ymwwc0lIUjVjR1ZUY0dWalRtRnRaU2tnT2lCZmNISnZaRWx1ZG1GeWFXRnVkQ2duT0RRbkxDQmpiMjF3YjI1bGJuUk9ZVzFsSUh4OElDZFNaV0ZqZENCamJHRnpjeWNzSUZKbFlXTjBVSEp2Y0ZSNWNHVk1iMk5oZEdsdmJrNWhiV1Z6VzJ4dlkyRjBhVzl1WFN3Z2RIbHdaVk53WldOT1lXMWxLU0E2SUhadmFXUWdNRHRjYmlBZ0lDQWdJQ0FnWlhKeWIzSWdQU0IwZVhCbFUzQmxZM05iZEhsd1pWTndaV05PWVcxbFhTaDJZV3gxWlhNc0lIUjVjR1ZUY0dWalRtRnRaU3dnWTI5dGNHOXVaVzUwVG1GdFpTd2diRzlqWVhScGIyNHNJRzUxYkd3c0lGSmxZV04wVUhKdmNGUjVjR1Z6VTJWamNtVjBLVHRjYmlBZ0lDQWdJSDBnWTJGMFkyZ2dLR1Y0S1NCN1hHNGdJQ0FnSUNBZ0lHVnljbTl5SUQwZ1pYZzdYRzRnSUNBZ0lDQjlYRzRnSUNBZ0lDQndjbTlqWlhOekxtVnVkaTVPVDBSRlgwVk9WaUFoUFQwZ0ozQnliMlIxWTNScGIyNG5JRDhnZDJGeWJtbHVaeWdoWlhKeWIzSWdmSHdnWlhKeWIzSWdhVzV6ZEdGdVkyVnZaaUJGY25KdmNpd2dKeVZ6T2lCMGVYQmxJSE53WldOcFptbGpZWFJwYjI0Z2IyWWdKWE1nWUNWellDQnBjeUJwYm5aaGJHbGtPeUIwYUdVZ2RIbHdaU0JqYUdWamEyVnlJQ2NnS3lBblpuVnVZM1JwYjI0Z2JYVnpkQ0J5WlhSMWNtNGdZRzUxYkd4Z0lHOXlJR0Z1SUdCRmNuSnZjbUFnWW5WMElISmxkSFZ5Ym1Wa0lHRWdKWE11SUNjZ0t5QW5XVzkxSUcxaGVTQm9ZWFpsSUdadmNtZHZkSFJsYmlCMGJ5QndZWE56SUdGdUlHRnlaM1Z0Wlc1MElIUnZJSFJvWlNCMGVYQmxJR05vWldOclpYSWdKeUFySUNkamNtVmhkRzl5SUNoaGNuSmhlVTltTENCcGJuTjBZVzVqWlU5bUxDQnZZbXBsWTNSUFppd2diMjVsVDJZc0lHOXVaVTltVkhsd1pTd2dZVzVrSUNjZ0t5QW5jMmhoY0dVZ1lXeHNJSEpsY1hWcGNtVWdZVzRnWVhKbmRXMWxiblFwTGljc0lHTnZiWEJ2Ym1WdWRFNWhiV1VnZkh3Z0oxSmxZV04wSUdOc1lYTnpKeXdnVW1WaFkzUlFjbTl3Vkhsd1pVeHZZMkYwYVc5dVRtRnRaWE5iYkc5allYUnBiMjVkTENCMGVYQmxVM0JsWTA1aGJXVXNJSFI1Y0dWdlppQmxjbkp2Y2lrZ09pQjJiMmxrSURBN1hHNGdJQ0FnSUNCcFppQW9aWEp5YjNJZ2FXNXpkR0Z1WTJWdlppQkZjbkp2Y2lBbUppQWhLR1Z5Y205eUxtMWxjM05oWjJVZ2FXNGdiRzluWjJWa1ZIbHdaVVpoYVd4MWNtVnpLU2tnZTF4dUlDQWdJQ0FnSUNBdkx5QlBibXg1SUcxdmJtbDBiM0lnZEdocGN5Qm1ZV2xzZFhKbElHOXVZMlVnWW1WallYVnpaU0IwYUdWeVpTQjBaVzVrY3lCMGJ5QmlaU0JoSUd4dmRDQnZaaUIwYUdWY2JpQWdJQ0FnSUNBZ0x5OGdjMkZ0WlNCbGNuSnZjaTVjYmlBZ0lDQWdJQ0FnYkc5bloyVmtWSGx3WlVaaGFXeDFjbVZ6VzJWeWNtOXlMbTFsYzNOaFoyVmRJRDBnZEhKMVpUdGNibHh1SUNBZ0lDQWdJQ0IyWVhJZ1kyOXRjRzl1Wlc1MFUzUmhZMnRKYm1adklEMGdKeWM3WEc1Y2JpQWdJQ0FnSUNBZ2FXWWdLSEJ5YjJObGMzTXVaVzUyTGs1UFJFVmZSVTVXSUNFOVBTQW5jSEp2WkhWamRHbHZiaWNwSUh0Y2JpQWdJQ0FnSUNBZ0lDQnBaaUFvSVZKbFlXTjBRMjl0Y0c5dVpXNTBWSEpsWlVodmIyc3BJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lGSmxZV04wUTI5dGNHOXVaVzUwVkhKbFpVaHZiMnNnUFNCeVpYRjFhWEpsS0NjdUwxSmxZV04wUTI5dGNHOXVaVzUwVkhKbFpVaHZiMnNuS1R0Y2JpQWdJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJQ0FnYVdZZ0tHUmxZblZuU1VRZ0lUMDlJRzUxYkd3cElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUdOdmJYQnZibVZ1ZEZOMFlXTnJTVzVtYnlBOUlGSmxZV04wUTI5dGNHOXVaVzUwVkhKbFpVaHZiMnN1WjJWMFUzUmhZMnRCWkdSbGJtUjFiVUo1U1VRb1pHVmlkV2RKUkNrN1hHNGdJQ0FnSUNBZ0lDQWdmU0JsYkhObElHbG1JQ2hsYkdWdFpXNTBJQ0U5UFNCdWRXeHNLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQmpiMjF3YjI1bGJuUlRkR0ZqYTBsdVptOGdQU0JTWldGamRFTnZiWEJ2Ym1WdWRGUnlaV1ZJYjI5ckxtZGxkRU4xY25KbGJuUlRkR0ZqYTBGa1pHVnVaSFZ0S0dWc1pXMWxiblFwTzF4dUlDQWdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdmVnh1WEc0Z0lDQWdJQ0FnSUhCeWIyTmxjM011Wlc1MkxrNVBSRVZmUlU1V0lDRTlQU0FuY0hKdlpIVmpkR2x2YmljZ1B5QjNZWEp1YVc1bktHWmhiSE5sTENBblJtRnBiR1ZrSUNWeklIUjVjR1U2SUNWekpYTW5MQ0JzYjJOaGRHbHZiaXdnWlhKeWIzSXViV1Z6YzJGblpTd2dZMjl0Y0c5dVpXNTBVM1JoWTJ0SmJtWnZLU0E2SUhadmFXUWdNRHRjYmlBZ0lDQWdJSDFjYmlBZ0lDQjlYRzRnSUgxY2JuMWNibHh1Ylc5a2RXeGxMbVY0Y0c5eWRITWdQU0JqYUdWamExSmxZV04wVkhsd1pWTndaV003SWl3aUx5b3FYRzRnS2lCRGIzQjVjbWxuYUhRZ01qQXhNeTF3Y21WelpXNTBMQ0JHWVdObFltOXZheXdnU1c1akxseHVJQ29nUVd4c0lISnBaMmgwY3lCeVpYTmxjblpsWkM1Y2JpQXFYRzRnS2lCVWFHbHpJSE52ZFhKalpTQmpiMlJsSUdseklHeHBZMlZ1YzJWa0lIVnVaR1Z5SUhSb1pTQkNVMFF0YzNSNWJHVWdiR2xqWlc1elpTQm1iM1Z1WkNCcGJpQjBhR1ZjYmlBcUlFeEpRMFZPVTBVZ1ptbHNaU0JwYmlCMGFHVWdjbTl2ZENCa2FYSmxZM1J2Y25rZ2IyWWdkR2hwY3lCemIzVnlZMlVnZEhKbFpTNGdRVzRnWVdSa2FYUnBiMjVoYkNCbmNtRnVkRnh1SUNvZ2IyWWdjR0YwWlc1MElISnBaMmgwY3lCallXNGdZbVVnWm05MWJtUWdhVzRnZEdobElGQkJWRVZPVkZNZ1ptbHNaU0JwYmlCMGFHVWdjMkZ0WlNCa2FYSmxZM1J2Y25rdVhHNGdLbHh1SUNvdlhHNWNiaWQxYzJVZ2MzUnlhV04wSnp0Y2JseHVkbUZ5SUY5eVpYRjFhWEpsSUQwZ2NtVnhkV2x5WlNnbkxpOVNaV0ZqZEVKaGMyVkRiR0Z6YzJWekp5a3NYRzRnSUNBZ1EyOXRjRzl1Wlc1MElEMGdYM0psY1hWcGNtVXVRMjl0Y0c5dVpXNTBPMXh1WEc1MllYSWdYM0psY1hWcGNtVXlJRDBnY21WeGRXbHlaU2duTGk5U1pXRmpkRVZzWlcxbGJuUW5LU3hjYmlBZ0lDQnBjMVpoYkdsa1JXeGxiV1Z1ZENBOUlGOXlaWEYxYVhKbE1pNXBjMVpoYkdsa1JXeGxiV1Z1ZER0Y2JseHVkbUZ5SUZKbFlXTjBUbTl2Y0ZWd1pHRjBaVkYxWlhWbElEMGdjbVZ4ZFdseVpTZ25MaTlTWldGamRFNXZiM0JWY0dSaGRHVlJkV1YxWlNjcE8xeHVkbUZ5SUdaaFkzUnZjbmtnUFNCeVpYRjFhWEpsS0NkamNtVmhkR1V0Y21WaFkzUXRZMnhoYzNNdlptRmpkRzl5ZVNjcE8xeHVYRzV0YjJSMWJHVXVaWGh3YjNKMGN5QTlJR1poWTNSdmNua29RMjl0Y0c5dVpXNTBMQ0JwYzFaaGJHbGtSV3hsYldWdWRDd2dVbVZoWTNST2IyOXdWWEJrWVhSbFVYVmxkV1VwT3lJc0lpOHFLbHh1SUNvZ1EyOXdlWEpwWjJoMElESXdNVE10Y0hKbGMyVnVkQ3dnUm1GalpXSnZiMnNzSUVsdVl5NWNiaUFxSUVGc2JDQnlhV2RvZEhNZ2NtVnpaWEoyWldRdVhHNGdLbHh1SUNvZ1ZHaHBjeUJ6YjNWeVkyVWdZMjlrWlNCcGN5QnNhV05sYm5ObFpDQjFibVJsY2lCMGFHVWdRbE5FTFhOMGVXeGxJR3hwWTJWdWMyVWdabTkxYm1RZ2FXNGdkR2hsWEc0Z0tpQk1TVU5GVGxORklHWnBiR1VnYVc0Z2RHaGxJSEp2YjNRZ1pHbHlaV04wYjNKNUlHOW1JSFJvYVhNZ2MyOTFjbU5sSUhSeVpXVXVJRUZ1SUdGa1pHbDBhVzl1WVd3Z1ozSmhiblJjYmlBcUlHOW1JSEJoZEdWdWRDQnlhV2RvZEhNZ1kyRnVJR0psSUdadmRXNWtJR2x1SUhSb1pTQlFRVlJGVGxSVElHWnBiR1VnYVc0Z2RHaGxJSE5oYldVZ1pHbHlaV04wYjNKNUxseHVJQ3BjYmlBcUlGeHVJQ292WEc1Y2JpZDFjMlVnYzNSeWFXTjBKenRjYmx4dUx5b2daMnh2WW1Gc0lGTjViV0p2YkNBcUwxeHVYRzUyWVhJZ1NWUkZVa0ZVVDFKZlUxbE5RazlNSUQwZ2RIbHdaVzltSUZONWJXSnZiQ0E5UFQwZ0oyWjFibU4wYVc5dUp5QW1KaUJUZVcxaWIyd3VhWFJsY21GMGIzSTdYRzUyWVhJZ1JrRlZXRjlKVkVWU1FWUlBVbDlUV1UxQ1Qwd2dQU0FuUUVCcGRHVnlZWFJ2Y2ljN0lDOHZJRUpsWm05eVpTQlRlVzFpYjJ3Z2MzQmxZeTVjYmx4dUx5b3FYRzRnS2lCU1pYUjFjbTV6SUhSb1pTQnBkR1Z5WVhSdmNpQnRaWFJvYjJRZ1puVnVZM1JwYjI0Z1kyOXVkR0ZwYm1Wa0lHOXVJSFJvWlNCcGRHVnlZV0pzWlNCdlltcGxZM1F1WEc0Z0tseHVJQ29nUW1VZ2MzVnlaU0IwYnlCcGJuWnZhMlVnZEdobElHWjFibU4wYVc5dUlIZHBkR2dnZEdobElHbDBaWEpoWW14bElHRnpJR052Ym5SbGVIUTZYRzRnS2x4dUlDb2dJQ0FnSUhaaGNpQnBkR1Z5WVhSdmNrWnVJRDBnWjJWMFNYUmxjbUYwYjNKR2JpaHRlVWwwWlhKaFlteGxLVHRjYmlBcUlDQWdJQ0JwWmlBb2FYUmxjbUYwYjNKR2Jpa2dlMXh1SUNvZ0lDQWdJQ0FnZG1GeUlHbDBaWEpoZEc5eUlEMGdhWFJsY21GMGIzSkdiaTVqWVd4c0tHMTVTWFJsY21GaWJHVXBPMXh1SUNvZ0lDQWdJQ0FnTGk0dVhHNGdLaUFnSUNBZ2ZWeHVJQ3BjYmlBcUlFQndZWEpoYlNCN1AyOWlhbVZqZEgwZ2JXRjVZbVZKZEdWeVlXSnNaVnh1SUNvZ1FISmxkSFZ5YmlCN1AyWjFibU4wYVc5dWZWeHVJQ292WEc1bWRXNWpkR2x2YmlCblpYUkpkR1Z5WVhSdmNrWnVLRzFoZVdKbFNYUmxjbUZpYkdVcElIdGNiaUFnZG1GeUlHbDBaWEpoZEc5eVJtNGdQU0J0WVhsaVpVbDBaWEpoWW14bElDWW1JQ2hKVkVWU1FWUlBVbDlUV1UxQ1Qwd2dKaVlnYldGNVltVkpkR1Z5WVdKc1pWdEpWRVZTUVZSUFVsOVRXVTFDVDB4ZElIeDhJRzFoZVdKbFNYUmxjbUZpYkdWYlJrRlZXRjlKVkVWU1FWUlBVbDlUV1UxQ1QweGRLVHRjYmlBZ2FXWWdLSFI1Y0dWdlppQnBkR1Z5WVhSdmNrWnVJRDA5UFNBblpuVnVZM1JwYjI0bktTQjdYRzRnSUNBZ2NtVjBkWEp1SUdsMFpYSmhkRzl5Um00N1hHNGdJSDFjYm4xY2JseHViVzlrZFd4bExtVjRjRzl5ZEhNZ1BTQm5aWFJKZEdWeVlYUnZja1p1T3lJc0lpOHFLbHh1SUNvZ1EyOXdlWEpwWjJoMElESXdNVFF0TWpBeE5Td2dSbUZqWldKdmIyc3NJRWx1WXk1Y2JpQXFJRUZzYkNCeWFXZG9kSE1nY21WelpYSjJaV1F1WEc0Z0tseHVJQ29nVkdocGN5QnpiM1Z5WTJVZ1kyOWtaU0JwY3lCc2FXTmxibk5sWkNCMWJtUmxjaUIwYUdVZ1FsTkVMWE4wZVd4bElHeHBZMlZ1YzJVZ1ptOTFibVFnYVc0Z2RHaGxYRzRnS2lCTVNVTkZUbE5GSUdacGJHVWdhVzRnZEdobElISnZiM1FnWkdseVpXTjBiM0o1SUc5bUlIUm9hWE1nYzI5MWNtTmxJSFJ5WldVdUlFRnVJR0ZrWkdsMGFXOXVZV3dnWjNKaGJuUmNiaUFxSUc5bUlIQmhkR1Z1ZENCeWFXZG9kSE1nWTJGdUlHSmxJR1p2ZFc1a0lHbHVJSFJvWlNCUVFWUkZUbFJUSUdacGJHVWdhVzRnZEdobElITmhiV1VnWkdseVpXTjBiM0o1TGx4dUlDcGNiaUFxTDF4dVhHNG5kWE5sSUhOMGNtbGpkQ2M3WEc1Y2JpOHFLbHh1SUNvZ1JtOXlhMlZrSUdaeWIyMGdabUpxY3k5M1lYSnVhVzVuT2x4dUlDb2dhSFIwY0hNNkx5OW5hWFJvZFdJdVkyOXRMMlpoWTJWaWIyOXJMMlppYW5NdllteHZZaTlsTmpaaVlUSXdZV1ExWW1VME16TmxZalUwTkRJelpqSmlNRGszWkRneU9UTXlOR1E1WkdVMkwzQmhZMnRoWjJWekwyWmlhbk12YzNKakwxOWZabTl5YTNOZlh5OTNZWEp1YVc1bkxtcHpYRzRnS2x4dUlDb2dUMjVzZVNCamFHRnVaMlVnYVhNZ2QyVWdkWE5sSUdOdmJuTnZiR1V1ZDJGeWJpQnBibk4wWldGa0lHOW1JR052Ym5OdmJHVXVaWEp5YjNJc1hHNGdLaUJoYm1RZ1pHOGdibTkwYUdsdVp5QjNhR1Z1SUNkamIyNXpiMnhsSnlCcGN5QnViM1FnYzNWd2NHOXlkR1ZrTGx4dUlDb2dWR2hwY3lCeVpXRnNiSGtnYzJsdGNHeHBabWxsY3lCMGFHVWdZMjlrWlM1Y2JpQXFJQzB0TFZ4dUlDb2dVMmx0YVd4aGNpQjBieUJwYm5aaGNtbGhiblFnWW5WMElHOXViSGtnYkc5bmN5QmhJSGRoY201cGJtY2dhV1lnZEdobElHTnZibVJwZEdsdmJpQnBjeUJ1YjNRZ2JXVjBMbHh1SUNvZ1ZHaHBjeUJqWVc0Z1ltVWdkWE5sWkNCMGJ5QnNiMmNnYVhOemRXVnpJR2x1SUdSbGRtVnNiM0J0Wlc1MElHVnVkbWx5YjI1dFpXNTBjeUJwYmlCamNtbDBhV05oYkZ4dUlDb2djR0YwYUhNdUlGSmxiVzkyYVc1bklIUm9aU0JzYjJkbmFXNW5JR052WkdVZ1ptOXlJSEJ5YjJSMVkzUnBiMjRnWlc1MmFYSnZibTFsYm5SeklIZHBiR3dnYTJWbGNDQjBhR1ZjYmlBcUlITmhiV1VnYkc5bmFXTWdZVzVrSUdadmJHeHZkeUIwYUdVZ2MyRnRaU0JqYjJSbElIQmhkR2h6TGx4dUlDb3ZYRzVjYm5aaGNpQnNiM2RRY21sdmNtbDBlVmRoY201cGJtY2dQU0JtZFc1amRHbHZiaUFvS1NCN2ZUdGNibHh1YVdZZ0tIQnliMk5sYzNNdVpXNTJMazVQUkVWZlJVNVdJQ0U5UFNBbmNISnZaSFZqZEdsdmJpY3BJSHRjYmlBZ2RtRnlJSEJ5YVc1MFYyRnlibWx1WnlBOUlHWjFibU4wYVc5dUlDaG1iM0p0WVhRcElIdGNiaUFnSUNCbWIzSWdLSFpoY2lCZmJHVnVJRDBnWVhKbmRXMWxiblJ6TG14bGJtZDBhQ3dnWVhKbmN5QTlJRUZ5Y21GNUtGOXNaVzRnUGlBeElEOGdYMnhsYmlBdElERWdPaUF3S1N3Z1gydGxlU0E5SURFN0lGOXJaWGtnUENCZmJHVnVPeUJmYTJWNUt5c3BJSHRjYmlBZ0lDQWdJR0Z5WjNOYlgydGxlU0F0SURGZElEMGdZWEpuZFcxbGJuUnpXMTlyWlhsZE8xeHVJQ0FnSUgxY2JseHVJQ0FnSUhaaGNpQmhjbWRKYm1SbGVDQTlJREE3WEc0Z0lDQWdkbUZ5SUcxbGMzTmhaMlVnUFNBblYyRnlibWx1WnpvZ0p5QXJJR1p2Y20xaGRDNXlaWEJzWVdObEtDOGxjeTluTENCbWRXNWpkR2x2YmlBb0tTQjdYRzRnSUNBZ0lDQnlaWFIxY200Z1lYSm5jMXRoY21kSmJtUmxlQ3NyWFR0Y2JpQWdJQ0I5S1R0Y2JpQWdJQ0JwWmlBb2RIbHdaVzltSUdOdmJuTnZiR1VnSVQwOUlDZDFibVJsWm1sdVpXUW5LU0I3WEc0Z0lDQWdJQ0JqYjI1emIyeGxMbmRoY200b2JXVnpjMkZuWlNrN1hHNGdJQ0FnZlZ4dUlDQWdJSFJ5ZVNCN1hHNGdJQ0FnSUNBdkx5QXRMUzBnVjJWc1kyOXRaU0IwYnlCa1pXSjFaMmRwYm1jZ1VtVmhZM1FnTFMwdFhHNGdJQ0FnSUNBdkx5QlVhR2x6SUdWeWNtOXlJSGRoY3lCMGFISnZkMjRnWVhNZ1lTQmpiMjUyWlc1cFpXNWpaU0J6YnlCMGFHRjBJSGx2ZFNCallXNGdkWE5sSUhSb2FYTWdjM1JoWTJ0Y2JpQWdJQ0FnSUM4dklIUnZJR1pwYm1RZ2RHaGxJR05oYkd4emFYUmxJSFJvWVhRZ1kyRjFjMlZrSUhSb2FYTWdkMkZ5Ym1sdVp5QjBieUJtYVhKbExseHVJQ0FnSUNBZ2RHaHliM2NnYm1WM0lFVnljbTl5S0cxbGMzTmhaMlVwTzF4dUlDQWdJSDBnWTJGMFkyZ2dLSGdwSUh0OVhHNGdJSDA3WEc1Y2JpQWdiRzkzVUhKcGIzSnBkSGxYWVhKdWFXNW5JRDBnWm5WdVkzUnBiMjRnS0dOdmJtUnBkR2x2Yml3Z1ptOXliV0YwS1NCN1hHNGdJQ0FnYVdZZ0tHWnZjbTFoZENBOVBUMGdkVzVrWldacGJtVmtLU0I3WEc0Z0lDQWdJQ0IwYUhKdmR5QnVaWGNnUlhKeWIzSW9KMkIzWVhKdWFXNW5LR052Ym1ScGRHbHZiaXdnWm05eWJXRjBMQ0F1TGk1aGNtZHpLV0FnY21WeGRXbHlaWE1nWVNCM1lYSnVhVzVuSUNjZ0t5QW5iV1Z6YzJGblpTQmhjbWQxYldWdWRDY3BPMXh1SUNBZ0lIMWNiaUFnSUNCcFppQW9JV052Ym1ScGRHbHZiaWtnZTF4dUlDQWdJQ0FnWm05eUlDaDJZWElnWDJ4bGJqSWdQU0JoY21kMWJXVnVkSE11YkdWdVozUm9MQ0JoY21keklEMGdRWEp5WVhrb1gyeGxiaklnUGlBeUlEOGdYMnhsYmpJZ0xTQXlJRG9nTUNrc0lGOXJaWGt5SUQwZ01qc2dYMnRsZVRJZ1BDQmZiR1Z1TWpzZ1gydGxlVElyS3lrZ2UxeHVJQ0FnSUNBZ0lDQmhjbWR6VzE5clpYa3lJQzBnTWwwZ1BTQmhjbWQxYldWdWRITmJYMnRsZVRKZE8xeHVJQ0FnSUNBZ2ZWeHVYRzRnSUNBZ0lDQndjbWx1ZEZkaGNtNXBibWN1WVhCd2JIa29kVzVrWldacGJtVmtMQ0JiWm05eWJXRjBYUzVqYjI1allYUW9ZWEpuY3lrcE8xeHVJQ0FnSUgxY2JpQWdmVHRjYm4xY2JseHViVzlrZFd4bExtVjRjRzl5ZEhNZ1BTQnNiM2RRY21sdmNtbDBlVmRoY201cGJtYzdJaXdpTHlvcVhHNGdLaUJEYjNCNWNtbG5hSFFnTWpBeE15MXdjbVZ6Wlc1MExDQkdZV05sWW05dmF5d2dTVzVqTGx4dUlDb2dRV3hzSUhKcFoyaDBjeUJ5WlhObGNuWmxaQzVjYmlBcVhHNGdLaUJVYUdseklITnZkWEpqWlNCamIyUmxJR2x6SUd4cFkyVnVjMlZrSUhWdVpHVnlJSFJvWlNCQ1UwUXRjM1I1YkdVZ2JHbGpaVzV6WlNCbWIzVnVaQ0JwYmlCMGFHVmNiaUFxSUV4SlEwVk9VMFVnWm1sc1pTQnBiaUIwYUdVZ2NtOXZkQ0JrYVhKbFkzUnZjbmtnYjJZZ2RHaHBjeUJ6YjNWeVkyVWdkSEpsWlM0Z1FXNGdZV1JrYVhScGIyNWhiQ0JuY21GdWRGeHVJQ29nYjJZZ2NHRjBaVzUwSUhKcFoyaDBjeUJqWVc0Z1ltVWdabTkxYm1RZ2FXNGdkR2hsSUZCQlZFVk9WRk1nWm1sc1pTQnBiaUIwYUdVZ2MyRnRaU0JrYVhKbFkzUnZjbmt1WEc0Z0tseHVJQ292WEc0bmRYTmxJSE4wY21samRDYzdYRzVjYm5aaGNpQmZjSEp2WkVsdWRtRnlhV0Z1ZENBOUlISmxjWFZwY21Vb0p5NHZjbVZoWTNSUWNtOWtTVzUyWVhKcFlXNTBKeWs3WEc1Y2JuWmhjaUJTWldGamRFVnNaVzFsYm5RZ1BTQnlaWEYxYVhKbEtDY3VMMUpsWVdOMFJXeGxiV1Z1ZENjcE8xeHVYRzUyWVhJZ2FXNTJZWEpwWVc1MElEMGdjbVZ4ZFdseVpTZ25abUpxY3k5c2FXSXZhVzUyWVhKcFlXNTBKeWs3WEc1Y2JpOHFLbHh1SUNvZ1VtVjBkWEp1Y3lCMGFHVWdabWx5YzNRZ1kyaHBiR1FnYVc0Z1lTQmpiMnhzWldOMGFXOXVJRzltSUdOb2FXeGtjbVZ1SUdGdVpDQjJaWEpwWm1sbGN5QjBhR0YwSUhSb1pYSmxYRzRnS2lCcGN5QnZibXg1SUc5dVpTQmphR2xzWkNCcGJpQjBhR1VnWTI5c2JHVmpkR2x2Ymk1Y2JpQXFYRzRnS2lCVFpXVWdhSFIwY0hNNkx5OW1ZV05sWW05dmF5NW5hWFJvZFdJdWFXOHZjbVZoWTNRdlpHOWpjeTkwYjNBdGJHVjJaV3d0WVhCcExtaDBiV3dqY21WaFkzUXVZMmhwYkdSeVpXNHViMjVzZVZ4dUlDcGNiaUFxSUZSb1pTQmpkWEp5Wlc1MElHbHRjR3hsYldWdWRHRjBhVzl1SUc5bUlIUm9hWE1nWm5WdVkzUnBiMjRnWVhOemRXMWxjeUIwYUdGMElHRWdjMmx1WjJ4bElHTm9hV3hrSUdkbGRITmNiaUFxSUhCaGMzTmxaQ0IzYVhSb2IzVjBJR0VnZDNKaGNIQmxjaXdnWW5WMElIUm9aU0J3ZFhKd2IzTmxJRzltSUhSb2FYTWdhR1ZzY0dWeUlHWjFibU4wYVc5dUlHbHpJSFJ2WEc0Z0tpQmhZbk4wY21GamRDQmhkMkY1SUhSb1pTQndZWEowYVdOMWJHRnlJSE4wY25WamRIVnlaU0J2WmlCamFHbHNaSEpsYmk1Y2JpQXFYRzRnS2lCQWNHRnlZVzBnZXo5dlltcGxZM1I5SUdOb2FXeGtjbVZ1SUVOb2FXeGtJR052Ykd4bFkzUnBiMjRnYzNSeWRXTjBkWEpsTGx4dUlDb2dRSEpsZEhWeWJpQjdVbVZoWTNSRmJHVnRaVzUwZlNCVWFHVWdabWx5YzNRZ1lXNWtJRzl1YkhrZ1lGSmxZV04wUld4bGJXVnVkR0FnWTI5dWRHRnBibVZrSUdsdUlIUm9aVnh1SUNvZ2MzUnlkV04wZFhKbExseHVJQ292WEc1bWRXNWpkR2x2YmlCdmJteDVRMmhwYkdRb1kyaHBiR1J5Wlc0cElIdGNiaUFnSVZKbFlXTjBSV3hsYldWdWRDNXBjMVpoYkdsa1JXeGxiV1Z1ZENoamFHbHNaSEpsYmlrZ1B5QndjbTlqWlhOekxtVnVkaTVPVDBSRlgwVk9WaUFoUFQwZ0ozQnliMlIxWTNScGIyNG5JRDhnYVc1MllYSnBZVzUwS0daaGJITmxMQ0FuVW1WaFkzUXVRMmhwYkdSeVpXNHViMjVzZVNCbGVIQmxZM1JsWkNCMGJ5QnlaV05sYVhabElHRWdjMmx1WjJ4bElGSmxZV04wSUdWc1pXMWxiblFnWTJocGJHUXVKeWtnT2lCZmNISnZaRWx1ZG1GeWFXRnVkQ2duTVRRekp5a2dPaUIyYjJsa0lEQTdYRzRnSUhKbGRIVnliaUJqYUdsc1pISmxianRjYm4xY2JseHViVzlrZFd4bExtVjRjRzl5ZEhNZ1BTQnZibXg1UTJocGJHUTdJaXdpTHlvcVhHNGdLaUJEYjNCNWNtbG5hSFFnS0dNcElESXdNVE10Y0hKbGMyVnVkQ3dnUm1GalpXSnZiMnNzSUVsdVl5NWNiaUFxSUVGc2JDQnlhV2RvZEhNZ2NtVnpaWEoyWldRdVhHNGdLbHh1SUNvZ1ZHaHBjeUJ6YjNWeVkyVWdZMjlrWlNCcGN5QnNhV05sYm5ObFpDQjFibVJsY2lCMGFHVWdRbE5FTFhOMGVXeGxJR3hwWTJWdWMyVWdabTkxYm1RZ2FXNGdkR2hsWEc0Z0tpQk1TVU5GVGxORklHWnBiR1VnYVc0Z2RHaGxJSEp2YjNRZ1pHbHlaV04wYjNKNUlHOW1JSFJvYVhNZ2MyOTFjbU5sSUhSeVpXVXVJRUZ1SUdGa1pHbDBhVzl1WVd3Z1ozSmhiblJjYmlBcUlHOW1JSEJoZEdWdWRDQnlhV2RvZEhNZ1kyRnVJR0psSUdadmRXNWtJR2x1SUhSb1pTQlFRVlJGVGxSVElHWnBiR1VnYVc0Z2RHaGxJSE5oYldVZ1pHbHlaV04wYjNKNUxseHVJQ3BjYmlBcUlGeHVJQ292WEc0bmRYTmxJSE4wY21samRDYzdYRzVjYmk4cUtseHVJQ29nVjBGU1RrbE9Sem9nUkU4Z1RrOVVJRzFoYm5WaGJHeDVJSEpsY1hWcGNtVWdkR2hwY3lCdGIyUjFiR1V1WEc0Z0tpQlVhR2x6SUdseklHRWdjbVZ3YkdGalpXMWxiblFnWm05eUlHQnBiblpoY21saGJuUW9MaTR1S1dBZ2RYTmxaQ0JpZVNCMGFHVWdaWEp5YjNJZ1kyOWtaU0J6ZVhOMFpXMWNiaUFxSUdGdVpDQjNhV3hzSUY5dmJteDVYeUJpWlNCeVpYRjFhWEpsWkNCaWVTQjBhR1VnWTI5eWNtVnpjRzl1WkdsdVp5QmlZV0psYkNCd1lYTnpMbHh1SUNvZ1NYUWdZV3gzWVhseklIUm9jbTkzY3k1Y2JpQXFMMXh1WEc1bWRXNWpkR2x2YmlCeVpXRmpkRkJ5YjJSSmJuWmhjbWxoYm5Rb1kyOWtaU2tnZTF4dUlDQjJZWElnWVhKblEyOTFiblFnUFNCaGNtZDFiV1Z1ZEhNdWJHVnVaM1JvSUMwZ01UdGNibHh1SUNCMllYSWdiV1Z6YzJGblpTQTlJQ2ROYVc1cFptbGxaQ0JTWldGamRDQmxjbkp2Y2lBakp5QXJJR052WkdVZ0t5QW5PeUIyYVhOcGRDQW5JQ3NnSjJoMGRIQTZMeTltWVdObFltOXZheTVuYVhSb2RXSXVhVzh2Y21WaFkzUXZaRzlqY3k5bGNuSnZjaTFrWldOdlpHVnlMbWgwYld3L2FXNTJZWEpwWVc1MFBTY2dLeUJqYjJSbE8xeHVYRzRnSUdadmNpQW9kbUZ5SUdGeVowbGtlQ0E5SURBN0lHRnlaMGxrZUNBOElHRnlaME52ZFc1ME95QmhjbWRKWkhnckt5a2dlMXh1SUNBZ0lHMWxjM05oWjJVZ0t6MGdKeVpoY21kelcxMDlKeUFySUdWdVkyOWtaVlZTU1VOdmJYQnZibVZ1ZENoaGNtZDFiV1Z1ZEhOYllYSm5TV1I0SUNzZ01WMHBPMXh1SUNCOVhHNWNiaUFnYldWemMyRm5aU0FyUFNBbklHWnZjaUIwYUdVZ1puVnNiQ0J0WlhOellXZGxJRzl5SUhWelpTQjBhR1VnYm05dUxXMXBibWxtYVdWa0lHUmxkaUJsYm5acGNtOXViV1Z1ZENjZ0t5QW5JR1p2Y2lCbWRXeHNJR1Z5Y205eWN5QmhibVFnWVdSa2FYUnBiMjVoYkNCb1pXeHdablZzSUhkaGNtNXBibWR6TGljN1hHNWNiaUFnZG1GeUlHVnljbTl5SUQwZ2JtVjNJRVZ5Y205eUtHMWxjM05oWjJVcE8xeHVJQ0JsY25KdmNpNXVZVzFsSUQwZ0owbHVkbUZ5YVdGdWRDQldhVzlzWVhScGIyNG5PMXh1SUNCbGNuSnZjaTVtY21GdFpYTlViMUJ2Y0NBOUlERTdJQzh2SUhkbElHUnZiaWQwSUdOaGNtVWdZV0p2ZFhRZ2NtVmhZM1JRY205a1NXNTJZWEpwWVc1MEozTWdiM2R1SUdaeVlXMWxYRzVjYmlBZ2RHaHliM2NnWlhKeWIzSTdYRzU5WEc1Y2JtMXZaSFZzWlM1bGVIQnZjblJ6SUQwZ2NtVmhZM1JRY205a1NXNTJZWEpwWVc1ME95SXNJaThxS2x4dUlDb2dRMjl3ZVhKcFoyaDBJREl3TVRNdGNISmxjMlZ1ZEN3Z1JtRmpaV0p2YjJzc0lFbHVZeTVjYmlBcUlFRnNiQ0J5YVdkb2RITWdjbVZ6WlhKMlpXUXVYRzRnS2x4dUlDb2dWR2hwY3lCemIzVnlZMlVnWTI5a1pTQnBjeUJzYVdObGJuTmxaQ0IxYm1SbGNpQjBhR1VnUWxORUxYTjBlV3hsSUd4cFkyVnVjMlVnWm05MWJtUWdhVzRnZEdobFhHNGdLaUJNU1VORlRsTkZJR1pwYkdVZ2FXNGdkR2hsSUhKdmIzUWdaR2x5WldOMGIzSjVJRzltSUhSb2FYTWdjMjkxY21ObElIUnlaV1V1SUVGdUlHRmtaR2wwYVc5dVlXd2daM0poYm5SY2JpQXFJRzltSUhCaGRHVnVkQ0J5YVdkb2RITWdZMkZ1SUdKbElHWnZkVzVrSUdsdUlIUm9aU0JRUVZSRlRsUlRJR1pwYkdVZ2FXNGdkR2hsSUhOaGJXVWdaR2x5WldOMGIzSjVMbHh1SUNwY2JpQXFMMXh1WEc0bmRYTmxJSE4wY21samRDYzdYRzVjYm5aaGNpQmZjSEp2WkVsdWRtRnlhV0Z1ZENBOUlISmxjWFZwY21Vb0p5NHZjbVZoWTNSUWNtOWtTVzUyWVhKcFlXNTBKeWs3WEc1Y2JuWmhjaUJTWldGamRFTjFjbkpsYm5SUGQyNWxjaUE5SUhKbGNYVnBjbVVvSnk0dlVtVmhZM1JEZFhKeVpXNTBUM2R1WlhJbktUdGNiblpoY2lCU1JVRkRWRjlGVEVWTlJVNVVYMVJaVUVVZ1BTQnlaWEYxYVhKbEtDY3VMMUpsWVdOMFJXeGxiV1Z1ZEZONWJXSnZiQ2NwTzF4dVhHNTJZWElnWjJWMFNYUmxjbUYwYjNKR2JpQTlJSEpsY1hWcGNtVW9KeTR2WjJWMFNYUmxjbUYwYjNKR2JpY3BPMXh1ZG1GeUlHbHVkbUZ5YVdGdWRDQTlJSEpsY1hWcGNtVW9KMlppYW5NdmJHbGlMMmx1ZG1GeWFXRnVkQ2NwTzF4dWRtRnlJRXRsZVVWelkyRndaVlYwYVd4eklEMGdjbVZ4ZFdseVpTZ25MaTlMWlhsRmMyTmhjR1ZWZEdsc2N5Y3BPMXh1ZG1GeUlIZGhjbTVwYm1jZ1BTQnlaWEYxYVhKbEtDZG1ZbXB6TDJ4cFlpOTNZWEp1YVc1bkp5azdYRzVjYm5aaGNpQlRSVkJCVWtGVVQxSWdQU0FuTGljN1hHNTJZWElnVTFWQ1UwVlFRVkpCVkU5U0lEMGdKem9uTzF4dVhHNHZLaXBjYmlBcUlGUm9hWE1nYVhNZ2FXNXNhVzVsWkNCbWNtOXRJRkpsWVdOMFJXeGxiV1Z1ZENCemFXNWpaU0IwYUdseklHWnBiR1VnYVhNZ2MyaGhjbVZrSUdKbGRIZGxaVzVjYmlBcUlHbHpiMjF2Y25Cb2FXTWdZVzVrSUhKbGJtUmxjbVZ5Y3k0Z1YyVWdZMjkxYkdRZ1pYaDBjbUZqZENCMGFHbHpJSFJ2SUdGY2JpQXFYRzRnS2k5Y2JseHVMeW9xWEc0Z0tpQlVUMFJQT2lCVVpYTjBJSFJvWVhRZ1lTQnphVzVuYkdVZ1kyaHBiR1FnWVc1a0lHRnVJR0Z5Y21GNUlIZHBkR2dnYjI1bElHbDBaVzBnYUdGMlpTQjBhR1VnYzJGdFpTQnJaWGxjYmlBcUlIQmhkSFJsY200dVhHNGdLaTljYmx4dWRtRnlJR1JwWkZkaGNtNUJZbTkxZEUxaGNITWdQU0JtWVd4elpUdGNibHh1THlvcVhHNGdLaUJIWlc1bGNtRjBaU0JoSUd0bGVTQnpkSEpwYm1jZ2RHaGhkQ0JwWkdWdWRHbG1hV1Z6SUdFZ1kyOXRjRzl1Wlc1MElIZHBkR2hwYmlCaElITmxkQzVjYmlBcVhHNGdLaUJBY0dGeVlXMGdleXA5SUdOdmJYQnZibVZ1ZENCQklHTnZiWEJ2Ym1WdWRDQjBhR0YwSUdOdmRXeGtJR052Ym5SaGFXNGdZU0J0WVc1MVlXd2dhMlY1TGx4dUlDb2dRSEJoY21GdElIdHVkVzFpWlhKOUlHbHVaR1Y0SUVsdVpHVjRJSFJvWVhRZ2FYTWdkWE5sWkNCcFppQmhJRzFoYm5WaGJDQnJaWGtnYVhNZ2JtOTBJSEJ5YjNacFpHVmtMbHh1SUNvZ1FISmxkSFZ5YmlCN2MzUnlhVzVuZlZ4dUlDb3ZYRzVtZFc1amRHbHZiaUJuWlhSRGIyMXdiMjVsYm5STFpYa29ZMjl0Y0c5dVpXNTBMQ0JwYm1SbGVDa2dlMXh1SUNBdkx5QkVieUJ6YjIxbElIUjVjR1ZqYUdWamEybHVaeUJvWlhKbElITnBibU5sSUhkbElHTmhiR3dnZEdocGN5QmliR2x1Wkd4NUxpQlhaU0IzWVc1MElIUnZJR1Z1YzNWeVpWeHVJQ0F2THlCMGFHRjBJSGRsSUdSdmJpZDBJR0pzYjJOcklIQnZkR1Z1ZEdsaGJDQm1kWFIxY21VZ1JWTWdRVkJKY3k1Y2JpQWdhV1lnS0dOdmJYQnZibVZ1ZENBbUppQjBlWEJsYjJZZ1kyOXRjRzl1Wlc1MElEMDlQU0FuYjJKcVpXTjBKeUFtSmlCamIyMXdiMjVsYm5RdWEyVjVJQ0U5SUc1MWJHd3BJSHRjYmlBZ0lDQXZMeUJGZUhCc2FXTnBkQ0JyWlhsY2JpQWdJQ0J5WlhSMWNtNGdTMlY1UlhOallYQmxWWFJwYkhNdVpYTmpZWEJsS0dOdmJYQnZibVZ1ZEM1clpYa3BPMXh1SUNCOVhHNGdJQzh2SUVsdGNHeHBZMmwwSUd0bGVTQmtaWFJsY20xcGJtVmtJR0o1SUhSb1pTQnBibVJsZUNCcGJpQjBhR1VnYzJWMFhHNGdJSEpsZEhWeWJpQnBibVJsZUM1MGIxTjBjbWx1Wnlnek5pazdYRzU5WEc1Y2JpOHFLbHh1SUNvZ1FIQmhjbUZ0SUhzL0tuMGdZMmhwYkdSeVpXNGdRMmhwYkdSeVpXNGdkSEpsWlNCamIyNTBZV2x1WlhJdVhHNGdLaUJBY0dGeVlXMGdleUZ6ZEhKcGJtZDlJRzVoYldWVGIwWmhjaUJPWVcxbElHOW1JSFJvWlNCclpYa2djR0YwYUNCemJ5Qm1ZWEl1WEc0Z0tpQkFjR0Z5WVcwZ2V5Rm1kVzVqZEdsdmJuMGdZMkZzYkdKaFkyc2dRMkZzYkdKaFkyc2dkRzhnYVc1MmIydGxJSGRwZEdnZ1pXRmphQ0JqYUdsc1pDQm1iM1Z1WkM1Y2JpQXFJRUJ3WVhKaGJTQjdQeXA5SUhSeVlYWmxjbk5sUTI5dWRHVjRkQ0JWYzJWa0lIUnZJSEJoYzNNZ2FXNW1iM0p0WVhScGIyNGdkR2h5YjNWbmFHOTFkQ0IwYUdVZ2RISmhkbVZ5YzJGc1hHNGdLaUJ3Y205alpYTnpMbHh1SUNvZ1FISmxkSFZ5YmlCN0lXNTFiV0psY24wZ1ZHaGxJRzUxYldKbGNpQnZaaUJqYUdsc1pISmxiaUJwYmlCMGFHbHpJSE4xWW5SeVpXVXVYRzRnS2k5Y2JtWjFibU4wYVc5dUlIUnlZWFpsY25ObFFXeHNRMmhwYkdSeVpXNUpiWEJzS0dOb2FXeGtjbVZ1TENCdVlXMWxVMjlHWVhJc0lHTmhiR3hpWVdOckxDQjBjbUYyWlhKelpVTnZiblJsZUhRcElIdGNiaUFnZG1GeUlIUjVjR1VnUFNCMGVYQmxiMllnWTJocGJHUnlaVzQ3WEc1Y2JpQWdhV1lnS0hSNWNHVWdQVDA5SUNkMWJtUmxabWx1WldRbklIeDhJSFI1Y0dVZ1BUMDlJQ2RpYjI5c1pXRnVKeWtnZTF4dUlDQWdJQzh2SUVGc2JDQnZaaUIwYUdVZ1lXSnZkbVVnWVhKbElIQmxjbU5sYVhabFpDQmhjeUJ1ZFd4c0xseHVJQ0FnSUdOb2FXeGtjbVZ1SUQwZ2JuVnNiRHRjYmlBZ2ZWeHVYRzRnSUdsbUlDaGphR2xzWkhKbGJpQTlQVDBnYm5Wc2JDQjhmQ0IwZVhCbElEMDlQU0FuYzNSeWFXNW5KeUI4ZkNCMGVYQmxJRDA5UFNBbmJuVnRZbVZ5SnlCOGZGeHVJQ0F2THlCVWFHVWdabTlzYkc5M2FXNW5JR2x6SUdsdWJHbHVaV1FnWm5KdmJTQlNaV0ZqZEVWc1pXMWxiblF1SUZSb2FYTWdiV1ZoYm5NZ2QyVWdZMkZ1SUc5d2RHbHRhWHBsWEc0Z0lDOHZJSE52YldVZ1kyaGxZMnR6TGlCU1pXRmpkQ0JHYVdKbGNpQmhiSE52SUdsdWJHbHVaWE1nZEdocGN5QnNiMmRwWXlCbWIzSWdjMmx0YVd4aGNpQndkWEp3YjNObGN5NWNiaUFnZEhsd1pTQTlQVDBnSjI5aWFtVmpkQ2NnSmlZZ1kyaHBiR1J5Wlc0dUpDUjBlWEJsYjJZZ1BUMDlJRkpGUVVOVVgwVk1SVTFGVGxSZlZGbFFSU2tnZTF4dUlDQWdJR05oYkd4aVlXTnJLSFJ5WVhabGNuTmxRMjl1ZEdWNGRDd2dZMmhwYkdSeVpXNHNYRzRnSUNBZ0x5OGdTV1lnYVhRbmN5QjBhR1VnYjI1c2VTQmphR2xzWkN3Z2RISmxZWFFnZEdobElHNWhiV1VnWVhNZ2FXWWdhWFFnZDJGeklIZHlZWEJ3WldRZ2FXNGdZVzRnWVhKeVlYbGNiaUFnSUNBdkx5QnpieUIwYUdGMElHbDBKM01nWTI5dWMybHpkR1Z1ZENCcFppQjBhR1VnYm5WdFltVnlJRzltSUdOb2FXeGtjbVZ1SUdkeWIzZHpMbHh1SUNBZ0lHNWhiV1ZUYjBaaGNpQTlQVDBnSnljZ1B5QlRSVkJCVWtGVVQxSWdLeUJuWlhSRGIyMXdiMjVsYm5STFpYa29ZMmhwYkdSeVpXNHNJREFwSURvZ2JtRnRaVk52Um1GeUtUdGNiaUFnSUNCeVpYUjFjbTRnTVR0Y2JpQWdmVnh1WEc0Z0lIWmhjaUJqYUdsc1pEdGNiaUFnZG1GeUlHNWxlSFJPWVcxbE8xeHVJQ0IyWVhJZ2MzVmlkSEpsWlVOdmRXNTBJRDBnTURzZ0x5OGdRMjkxYm5RZ2IyWWdZMmhwYkdSeVpXNGdabTkxYm1RZ2FXNGdkR2hsSUdOMWNuSmxiblFnYzNWaWRISmxaUzVjYmlBZ2RtRnlJRzVsZUhST1lXMWxVSEpsWm1sNElEMGdibUZ0WlZOdlJtRnlJRDA5UFNBbkp5QS9JRk5GVUVGU1FWUlBVaUE2SUc1aGJXVlRiMFpoY2lBcklGTlZRbE5GVUVGU1FWUlBVanRjYmx4dUlDQnBaaUFvUVhKeVlYa3VhWE5CY25KaGVTaGphR2xzWkhKbGJpa3BJSHRjYmlBZ0lDQm1iM0lnS0haaGNpQnBJRDBnTURzZ2FTQThJR05vYVd4a2NtVnVMbXhsYm1kMGFEc2dhU3NyS1NCN1hHNGdJQ0FnSUNCamFHbHNaQ0E5SUdOb2FXeGtjbVZ1VzJsZE8xeHVJQ0FnSUNBZ2JtVjRkRTVoYldVZ1BTQnVaWGgwVG1GdFpWQnlaV1pwZUNBcklHZGxkRU52YlhCdmJtVnVkRXRsZVNoamFHbHNaQ3dnYVNrN1hHNGdJQ0FnSUNCemRXSjBjbVZsUTI5MWJuUWdLejBnZEhKaGRtVnljMlZCYkd4RGFHbHNaSEpsYmtsdGNHd29ZMmhwYkdRc0lHNWxlSFJPWVcxbExDQmpZV3hzWW1GamF5d2dkSEpoZG1WeWMyVkRiMjUwWlhoMEtUdGNiaUFnSUNCOVhHNGdJSDBnWld4elpTQjdYRzRnSUNBZ2RtRnlJR2wwWlhKaGRHOXlSbTRnUFNCblpYUkpkR1Z5WVhSdmNrWnVLR05vYVd4a2NtVnVLVHRjYmlBZ0lDQnBaaUFvYVhSbGNtRjBiM0pHYmlrZ2UxeHVJQ0FnSUNBZ2RtRnlJR2wwWlhKaGRHOXlJRDBnYVhSbGNtRjBiM0pHYmk1allXeHNLR05vYVd4a2NtVnVLVHRjYmlBZ0lDQWdJSFpoY2lCemRHVndPMXh1SUNBZ0lDQWdhV1lnS0dsMFpYSmhkRzl5Um00Z0lUMDlJR05vYVd4a2NtVnVMbVZ1ZEhKcFpYTXBJSHRjYmlBZ0lDQWdJQ0FnZG1GeUlHbHBJRDBnTUR0Y2JpQWdJQ0FnSUNBZ2QyaHBiR1VnS0NFb2MzUmxjQ0E5SUdsMFpYSmhkRzl5TG01bGVIUW9LU2t1Wkc5dVpTa2dlMXh1SUNBZ0lDQWdJQ0FnSUdOb2FXeGtJRDBnYzNSbGNDNTJZV3gxWlR0Y2JpQWdJQ0FnSUNBZ0lDQnVaWGgwVG1GdFpTQTlJRzVsZUhST1lXMWxVSEpsWm1sNElDc2daMlYwUTI5dGNHOXVaVzUwUzJWNUtHTm9hV3hrTENCcGFTc3JLVHRjYmlBZ0lDQWdJQ0FnSUNCemRXSjBjbVZsUTI5MWJuUWdLejBnZEhKaGRtVnljMlZCYkd4RGFHbHNaSEpsYmtsdGNHd29ZMmhwYkdRc0lHNWxlSFJPWVcxbExDQmpZV3hzWW1GamF5d2dkSEpoZG1WeWMyVkRiMjUwWlhoMEtUdGNiaUFnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdmU0JsYkhObElIdGNiaUFnSUNBZ0lDQWdhV1lnS0hCeWIyTmxjM011Wlc1MkxrNVBSRVZmUlU1V0lDRTlQU0FuY0hKdlpIVmpkR2x2YmljcElIdGNiaUFnSUNBZ0lDQWdJQ0IyWVhJZ2JXRndjMEZ6UTJocGJHUnlaVzVCWkdSbGJtUjFiU0E5SUNjbk8xeHVJQ0FnSUNBZ0lDQWdJR2xtSUNoU1pXRmpkRU4xY25KbGJuUlBkMjVsY2k1amRYSnlaVzUwS1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0IyWVhJZ2JXRndjMEZ6UTJocGJHUnlaVzVQZDI1bGNrNWhiV1VnUFNCU1pXRmpkRU4xY25KbGJuUlBkMjVsY2k1amRYSnlaVzUwTG1kbGRFNWhiV1VvS1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJR2xtSUNodFlYQnpRWE5EYUdsc1pISmxiazkzYm1WeVRtRnRaU2tnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0J0WVhCelFYTkRhR2xzWkhKbGJrRmtaR1Z1WkhWdElEMGdKeUJEYUdWamF5QjBhR1VnY21WdVpHVnlJRzFsZEdodlpDQnZaaUJnSnlBcklHMWhjSE5CYzBOb2FXeGtjbVZ1VDNkdVpYSk9ZVzFsSUNzZ0oyQXVKenRjYmlBZ0lDQWdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0FnSUNBZ2NISnZZMlZ6Y3k1bGJuWXVUazlFUlY5RlRsWWdJVDA5SUNkd2NtOWtkV04wYVc5dUp5QS9JSGRoY201cGJtY29aR2xrVjJGeWJrRmliM1YwVFdGd2N5d2dKMVZ6YVc1bklFMWhjSE1nWVhNZ1kyaHBiR1J5Wlc0Z2FYTWdibTkwSUhsbGRDQm1kV3hzZVNCemRYQndiM0owWldRdUlFbDBJR2x6SUdGdUlDY2dLeUFuWlhod1pYSnBiV1Z1ZEdGc0lHWmxZWFIxY21VZ2RHaGhkQ0J0YVdkb2RDQmlaU0J5WlcxdmRtVmtMaUJEYjI1MlpYSjBJR2wwSUhSdklHRWdKeUFySUNkelpYRjFaVzVqWlNBdklHbDBaWEpoWW14bElHOW1JR3RsZVdWa0lGSmxZV04wUld4bGJXVnVkSE1nYVc1emRHVmhaQzRsY3ljc0lHMWhjSE5CYzBOb2FXeGtjbVZ1UVdSa1pXNWtkVzBwSURvZ2RtOXBaQ0F3TzF4dUlDQWdJQ0FnSUNBZ0lHUnBaRmRoY201QlltOTFkRTFoY0hNZ1BTQjBjblZsTzF4dUlDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lDOHZJRWwwWlhKaGRHOXlJSGRwYkd3Z2NISnZkbWxrWlNCbGJuUnllU0JiYXl4MlhTQjBkWEJzWlhNZ2NtRjBhR1Z5SUhSb1lXNGdkbUZzZFdWekxseHVJQ0FnSUNBZ0lDQjNhR2xzWlNBb0lTaHpkR1Z3SUQwZ2FYUmxjbUYwYjNJdWJtVjRkQ2dwS1M1a2IyNWxLU0I3WEc0Z0lDQWdJQ0FnSUNBZ2RtRnlJR1Z1ZEhKNUlEMGdjM1JsY0M1MllXeDFaVHRjYmlBZ0lDQWdJQ0FnSUNCcFppQW9aVzUwY25rcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUdOb2FXeGtJRDBnWlc1MGNubGJNVjA3WEc0Z0lDQWdJQ0FnSUNBZ0lDQnVaWGgwVG1GdFpTQTlJRzVsZUhST1lXMWxVSEpsWm1sNElDc2dTMlY1UlhOallYQmxWWFJwYkhNdVpYTmpZWEJsS0dWdWRISjVXekJkS1NBcklGTlZRbE5GVUVGU1FWUlBVaUFySUdkbGRFTnZiWEJ2Ym1WdWRFdGxlU2hqYUdsc1pDd2dNQ2s3WEc0Z0lDQWdJQ0FnSUNBZ0lDQnpkV0owY21WbFEyOTFiblFnS3owZ2RISmhkbVZ5YzJWQmJHeERhR2xzWkhKbGJrbHRjR3dvWTJocGJHUXNJRzVsZUhST1lXMWxMQ0JqWVd4c1ltRmpheXdnZEhKaGRtVnljMlZEYjI1MFpYaDBLVHRjYmlBZ0lDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lIMWNiaUFnSUNCOUlHVnNjMlVnYVdZZ0tIUjVjR1VnUFQwOUlDZHZZbXBsWTNRbktTQjdYRzRnSUNBZ0lDQjJZWElnWVdSa1pXNWtkVzBnUFNBbkp6dGNiaUFnSUNBZ0lHbG1JQ2h3Y205alpYTnpMbVZ1ZGk1T1QwUkZYMFZPVmlBaFBUMGdKM0J5YjJSMVkzUnBiMjRuS1NCN1hHNGdJQ0FnSUNBZ0lHRmtaR1Z1WkhWdElEMGdKeUJKWmlCNWIzVWdiV1ZoYm5RZ2RHOGdjbVZ1WkdWeUlHRWdZMjlzYkdWamRHbHZiaUJ2WmlCamFHbHNaSEpsYml3Z2RYTmxJR0Z1SUdGeWNtRjVJQ2NnS3lBbmFXNXpkR1ZoWkNCdmNpQjNjbUZ3SUhSb1pTQnZZbXBsWTNRZ2RYTnBibWNnWTNKbFlYUmxSbkpoWjIxbGJuUW9iMkpxWldOMEtTQm1jbTl0SUhSb1pTQW5JQ3NnSjFKbFlXTjBJR0ZrWkMxdmJuTXVKenRjYmlBZ0lDQWdJQ0FnYVdZZ0tHTm9hV3hrY21WdUxsOXBjMUpsWVdOMFJXeGxiV1Z1ZENrZ2UxeHVJQ0FnSUNBZ0lDQWdJR0ZrWkdWdVpIVnRJRDBnWENJZ1NYUWdiRzl2YTNNZ2JHbHJaU0I1YjNVbmNtVWdkWE5wYm1jZ1lXNGdaV3hsYldWdWRDQmpjbVZoZEdWa0lHSjVJR0VnWkdsbVptVnlaVzUwSUZ3aUlDc2dKM1psY25OcGIyNGdiMllnVW1WaFkzUXVJRTFoYTJVZ2MzVnlaU0IwYnlCMWMyVWdiMjVzZVNCdmJtVWdZMjl3ZVNCdlppQlNaV0ZqZEM0bk8xeHVJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJR2xtSUNoU1pXRmpkRU4xY25KbGJuUlBkMjVsY2k1amRYSnlaVzUwS1NCN1hHNGdJQ0FnSUNBZ0lDQWdkbUZ5SUc1aGJXVWdQU0JTWldGamRFTjFjbkpsYm5SUGQyNWxjaTVqZFhKeVpXNTBMbWRsZEU1aGJXVW9LVHRjYmlBZ0lDQWdJQ0FnSUNCcFppQW9ibUZ0WlNrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnWVdSa1pXNWtkVzBnS3owZ0p5QkRhR1ZqYXlCMGFHVWdjbVZ1WkdWeUlHMWxkR2h2WkNCdlppQmdKeUFySUc1aGJXVWdLeUFuWUM0bk8xeHVJQ0FnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnZlZ4dUlDQWdJQ0FnZG1GeUlHTm9hV3hrY21WdVUzUnlhVzVuSUQwZ1UzUnlhVzVuS0dOb2FXeGtjbVZ1S1R0Y2JpQWdJQ0FnSUNGbVlXeHpaU0EvSUhCeWIyTmxjM011Wlc1MkxrNVBSRVZmUlU1V0lDRTlQU0FuY0hKdlpIVmpkR2x2YmljZ1B5QnBiblpoY21saGJuUW9abUZzYzJVc0lDZFBZbXBsWTNSeklHRnlaU0J1YjNRZ2RtRnNhV1FnWVhNZ1lTQlNaV0ZqZENCamFHbHNaQ0FvWm05MWJtUTZJQ1Z6S1M0bGN5Y3NJR05vYVd4a2NtVnVVM1J5YVc1bklEMDlQU0FuVzI5aWFtVmpkQ0JQWW1wbFkzUmRKeUEvSUNkdlltcGxZM1FnZDJsMGFDQnJaWGx6SUhzbklDc2dUMkpxWldOMExtdGxlWE1vWTJocGJHUnlaVzRwTG1wdmFXNG9KeXdnSnlrZ0t5QW5mU2NnT2lCamFHbHNaSEpsYmxOMGNtbHVaeXdnWVdSa1pXNWtkVzBwSURvZ1gzQnliMlJKYm5aaGNtbGhiblFvSnpNeEp5d2dZMmhwYkdSeVpXNVRkSEpwYm1jZ1BUMDlJQ2RiYjJKcVpXTjBJRTlpYW1WamRGMG5JRDhnSjI5aWFtVmpkQ0IzYVhSb0lHdGxlWE1nZXljZ0t5QlBZbXBsWTNRdWEyVjVjeWhqYUdsc1pISmxiaWt1YW05cGJpZ25MQ0FuS1NBcklDZDlKeUE2SUdOb2FXeGtjbVZ1VTNSeWFXNW5MQ0JoWkdSbGJtUjFiU2tnT2lCMmIybGtJREE3WEc0Z0lDQWdmVnh1SUNCOVhHNWNiaUFnY21WMGRYSnVJSE4xWW5SeVpXVkRiM1Z1ZER0Y2JuMWNibHh1THlvcVhHNGdLaUJVY21GMlpYSnpaWE1nWTJocGJHUnlaVzRnZEdoaGRDQmhjbVVnZEhsd2FXTmhiR3g1SUhOd1pXTnBabWxsWkNCaGN5QmdjSEp2Y0hNdVkyaHBiR1J5Wlc1Z0xDQmlkWFJjYmlBcUlHMXBaMmgwSUdGc2MyOGdZbVVnYzNCbFkybG1hV1ZrSUhSb2NtOTFaMmdnWVhSMGNtbGlkWFJsY3pwY2JpQXFYRzRnS2lBdElHQjBjbUYyWlhKelpVRnNiRU5vYVd4a2NtVnVLSFJvYVhNdWNISnZjSE11WTJocGJHUnlaVzRzSUM0dUxpbGdYRzRnS2lBdElHQjBjbUYyWlhKelpVRnNiRU5vYVd4a2NtVnVLSFJvYVhNdWNISnZjSE11YkdWbWRGQmhibVZzUTJocGJHUnlaVzRzSUM0dUxpbGdYRzRnS2x4dUlDb2dWR2hsSUdCMGNtRjJaWEp6WlVOdmJuUmxlSFJnSUdseklHRnVJRzl3ZEdsdmJtRnNJR0Z5WjNWdFpXNTBJSFJvWVhRZ2FYTWdjR0Z6YzJWa0lIUm9jbTkxWjJnZ2RHaGxYRzRnS2lCbGJuUnBjbVVnZEhKaGRtVnljMkZzTGlCSmRDQmpZVzRnWW1VZ2RYTmxaQ0IwYnlCemRHOXlaU0JoWTJOMWJYVnNZWFJwYjI1eklHOXlJR0Z1ZVhSb2FXNW5JR1ZzYzJVZ2RHaGhkRnh1SUNvZ2RHaGxJR05oYkd4aVlXTnJJRzFwWjJoMElHWnBibVFnY21Wc1pYWmhiblF1WEc0Z0tseHVJQ29nUUhCaGNtRnRJSHMvS24wZ1kyaHBiR1J5Wlc0Z1EyaHBiR1J5Wlc0Z2RISmxaU0J2WW1wbFkzUXVYRzRnS2lCQWNHRnlZVzBnZXlGbWRXNWpkR2x2Ym4wZ1kyRnNiR0poWTJzZ1ZHOGdhVzUyYjJ0bElIVndiMjRnZEhKaGRtVnljMmx1WnlCbFlXTm9JR05vYVd4a0xseHVJQ29nUUhCaGNtRnRJSHMvS24wZ2RISmhkbVZ5YzJWRGIyNTBaWGgwSUVOdmJuUmxlSFFnWm05eUlIUnlZWFpsY25OaGJDNWNiaUFxSUVCeVpYUjFjbTRnZXlGdWRXMWlaWEo5SUZSb1pTQnVkVzFpWlhJZ2IyWWdZMmhwYkdSeVpXNGdhVzRnZEdocGN5QnpkV0owY21WbExseHVJQ292WEc1bWRXNWpkR2x2YmlCMGNtRjJaWEp6WlVGc2JFTm9hV3hrY21WdUtHTm9hV3hrY21WdUxDQmpZV3hzWW1GamF5d2dkSEpoZG1WeWMyVkRiMjUwWlhoMEtTQjdYRzRnSUdsbUlDaGphR2xzWkhKbGJpQTlQU0J1ZFd4c0tTQjdYRzRnSUNBZ2NtVjBkWEp1SURBN1hHNGdJSDFjYmx4dUlDQnlaWFIxY200Z2RISmhkbVZ5YzJWQmJHeERhR2xzWkhKbGJrbHRjR3dvWTJocGJHUnlaVzRzSUNjbkxDQmpZV3hzWW1GamF5d2dkSEpoZG1WeWMyVkRiMjUwWlhoMEtUdGNibjFjYmx4dWJXOWtkV3hsTG1WNGNHOXlkSE1nUFNCMGNtRjJaWEp6WlVGc2JFTm9hV3hrY21WdU95SXNJaWQxYzJVZ2MzUnlhV04wSnp0Y2JseHViVzlrZFd4bExtVjRjRzl5ZEhNZ1BTQnlaWEYxYVhKbEtDY3VMMnhwWWk5U1pXRmpkQ2NwTzF4dUlpd2lkbUZ5SUdGNGFXOXpJRDBnY21WeGRXbHlaU2duWVhocGIzTW5LVHRjYm5aaGNpQnlaV0ZqZENBOUlISmxjWFZwY21Vb0ozSmxZV04wSnlrN1hHNWNibHh1WTJ4aGMzTWdUbUYySUdWNGRHVnVaSE1nY21WaFkzUXVRMjl0Y0c5dVpXNTBJSHNnSUZ4dVhHNGdJR052Ym5OMGNuVmpkRzl5S0hCeWIzQnpLWHRjYmlBZ0lDQnpkWEJsY2lod2NtOXdjeWs3WEc0Z0lDQWdkR2hwY3k1MFpYTjBSMlYwS0NrN1hHNGdJSDA3WEc1Y2JpQWdjbVZ1WkdWeUtDbDdYRzRnSUNBZ2NtVjBkWEp1SUNoY2JpQWdJQ0FnSUR4dVlYWWdhV1E5WENKdFlXbHVUbUYyWENJZ1kyeGhjM05PWVcxbFBWd2libUYyWW1GeUlHNWhkbUpoY2kxa1pXWmhkV3gwSUc1aGRtSmhjaTFtYVhobFpDMTBiM0FnYm1GMlltRnlMV04xYzNSdmJWd2lQbHh1SUNBZ0lDQWdJQ0E4WkdsMklHTnNZWE56VG1GdFpUMWNJbU52Ym5SaGFXNWxjbHdpUGx4dUlDQWdJQ0FnSUNBZ0lEeGthWFlnWTJ4aGMzTk9ZVzFsUFZ3aWJtRjJZbUZ5TFdobFlXUmxjaUJ3WVdkbExYTmpjbTlzYkZ3aVBseHVJQ0FnSUNBZ0lDQWdJQ0FnUEdKMWRIUnZiaUIwZVhCbFBWd2lZblYwZEc5dVhDSWdZMnhoYzNOT1lXMWxQVndpYm1GMlltRnlMWFJ2WjJkc1pWd2lJR1JoZEdFdGRHOW5aMnhsUFZ3aVkyOXNiR0Z3YzJWY0lpQmtZWFJoTFhSaGNtZGxkRDFjSWlOaWN5MWxlR0Z0Y0d4bExXNWhkbUpoY2kxamIyeHNZWEJ6WlMweFhDSStYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lEeHpjR0Z1SUdOc1lYTnpUbUZ0WlQxY0luTnlMVzl1YkhsY0lqNVViMmRuYkdVZ2JtRjJhV2RoZEdsdmJqd3ZjM0JoYmo0Z1RXVnVkU0E4YVNCamJHRnpjMDVoYldVOVhDSm1ZU0JtWVMxaVlYSnpYQ0lnTHo1Y2JpQWdJQ0FnSUNBZ0lDQWdJRHd2WW5WMGRHOXVQbHh1SUNBZ0lDQWdJQ0FnSUNBZ1BHRWdZMnhoYzNOT1lXMWxQVndpYm1GMlltRnlMV0p5WVc1a1hDSWdhSEpsWmoxY0lpOWNJajVKYldkeVlXSThMMkUrWEc0Z0lDQWdJQ0FnSUNBZ1BDOWthWFkrWEc0Z0lDQWdJQ0FnSUNBZ1BHUnBkaUJqYkdGemMwNWhiV1U5WENKamIyeHNZWEJ6WlNCdVlYWmlZWEl0WTI5c2JHRndjMlZjSWlCcFpEMWNJbUp6TFdWNFlXMXdiR1V0Ym1GMlltRnlMV052Ykd4aGNITmxMVEZjSWo1Y2JpQWdJQ0FnSUNBZ0lDQWdJRHgxYkNCamJHRnpjMDVoYldVOVhDSnVZWFlnYm1GMlltRnlMVzVoZGlCdVlYWmlZWEl0Y21sbmFIUmNJajVjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdQR3hwSUdOc1lYTnpUbUZ0WlQxY0ltaHBaR1JsYmx3aVBseHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lEeGhJR2h5WldZOVhDSWpjR0ZuWlMxMGIzQmNJaUF2UGx4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0E4TDJ4cFBseHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBOGJHa2dZMnhoYzNOT1lXMWxQVndpY0dGblpTMXpZM0p2Ykd4Y0lqNWNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQThZU0JvY21WbVBWd2lMMmx0WVdkbGMxd2lQazE1SUVsdFlXZGxjend2WVQ1Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnUEM5c2FUNWNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ1BHeHBJR05zWVhOelRtRnRaVDFjSW5CaFoyVXRjMk55YjJ4c1hDSStYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdQR0VnYUhKbFpqMWNJaU5jSWo1SVpXeHdQQzloUGx4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0E4TDJ4cFBseHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBOGJHa2dZMnhoYzNOT1lXMWxQVndpY0dGblpTMXpZM0p2Ykd4Y0lqNWNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQThZU0JvY21WbVBWd2lJMXdpUGtOdmJuUmhZM1E4TDJFK1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUR3dmJHaytYRzRnSUNBZ0lDQWdJQ0FnSUNBOEwzVnNQbHh1SUNBZ0lDQWdJQ0FnSUR3dlpHbDJQbHh1SUNBZ0lDQWdJQ0E4TDJScGRqNWNiaUFnSUNBZ0lEd3ZibUYyUGx4dUlDQWdJQ2s3WEc0Z0lIMDdYRzVjYmlBZ2RHVnpkRWRsZENncElIdGNiaUFnSUNCaGVHbHZjeTVuWlhRb0oyaDBkSEE2THk4eE1qY3VNQzR3TGpFNk5UQXdNQzloY0drdmFXMWhaMlZ6SnlsY2JpQWdJQ0F1ZEdobGJpaG1kVzVqZEdsdmJpQW9jbVZ6Y0c5dWMyVXBJSHRjYmlBZ0lDQWdJR052Ym5OdmJHVXViRzluS0hKbGMzQnZibk5sS1R0Y2JpQWdJQ0I5S1Z4dUlDQWdJQzVqWVhSamFDaG1kVzVqZEdsdmJpQW9aWEp5YjNJcElIdGNiaUFnSUNBZ0lHTnZibk52YkdVdWJHOW5LR1Z5Y205eUtUdGNiaUFnSUNCOUtUdGNiaUFnZlZ4dVhHNTlPMXh1WEc1Y2JseHVMeThnWTJ4aGMzTWdVR0ZuWlVOdmJuUmhhVzVsY2lCbGVIUmxibVJ6SUVOdmJYQnZibVZ1ZENCN1hHNHZMeUFnSUhKbGJtUmxjaWdwSUh0Y2JpOHZJQ0FnSUNCeVpYUjFjbTRnS0Z4dUx5OGdJQ0FnSUNBZ1BHUnBkaUJqYkdGemMwNWhiV1U5WENKd1lXZGxMV052Ym5SaGFXNWxjbHdpUGx4dUx5OGdJQ0FnSUNBZ0lDQjdkR2hwY3k1d2NtOXdjeTVqYUdsc1pISmxibjFjYmk4dklDQWdJQ0FnSUR3dlpHbDJQbHh1THk4Z0lDQWdJQ2s3WEc0dkx5QWdJSDFjYmk4dklIMWNibHh1WEc1Y2JuWmhjaUJRWVdkbFEyOXVkR0ZwYm1WeUlEMGdVbVZoWTNRdVkzSmxZWFJsUTJ4aGMzTW9lMXh1SUNCeVpXNWtaWElvS1NCN1hHNGdJQ0FnY21WMGRYSnVJQ2hjYmlBZ0lDQWdJRHhrYVhZZ1kyeGhjM05PWVcxbFBWd2ljR0ZuWlMxamIyNTBZV2x1WlhKY0lqNWNiaUFnSUNBZ0lDQWdlM1JvYVhNdWNISnZjSE11WTJocGJHUnlaVzU5WEc0Z0lDQWdJQ0E4TDJScGRqNWNiaUFnSUNBcE8xeHVJQ0I5WEc1OUtUdGNibHh1ZG1GeUlFUjVibUZ0YVdOVFpXRnlZMmdnUFNCU1pXRmpkQzVqY21WaGRHVkRiR0Z6Y3loN1hHNWNiaUFnTHk4Z2MyVjBjeUJwYm1sMGFXRnNJSE4wWVhSbFhHNGdJR2RsZEVsdWFYUnBZV3hUZEdGMFpUb2dablZ1WTNScGIyNG9LWHRjYmlBZ0lDQnlaWFIxY200Z2V5QnpaV0Z5WTJoVGRISnBibWM2SUNjbklIMDdYRzRnSUgwc1hHNWNiaUFnTHk4Z2MyVjBjeUJ6ZEdGMFpTd2dkSEpwWjJkbGNuTWdjbVZ1WkdWeUlHMWxkR2h2WkZ4dUlDQm9ZVzVrYkdWRGFHRnVaMlU2SUdaMWJtTjBhVzl1S0dWMlpXNTBLWHRjYmlBZ0lDQXZMeUJuY21GaUlIWmhiSFZsSUdadmNtMGdhVzV3ZFhRZ1ltOTRYRzRnSUNBZ2RHaHBjeTV6WlhSVGRHRjBaU2g3YzJWaGNtTm9VM1J5YVc1bk9tVjJaVzUwTG5SaGNtZGxkQzUyWVd4MVpYMHBPMXh1SUNBZ0lHTnZibk52YkdVdWJHOW5LRndpYzJOdmNHVWdkWEJrWVhSbFpDRmNJaWs3WEc0Z0lIMHNYRzVjYmlBZ2NtVnVaR1Z5T2lCbWRXNWpkR2x2YmlncElIdGNibHh1SUNBZ0lIWmhjaUJqYjNWdWRISnBaWE1nUFNCMGFHbHpMbkJ5YjNCekxtbDBaVzF6TzF4dUlDQWdJSFpoY2lCelpXRnlZMmhUZEhKcGJtY2dQU0IwYUdsekxuTjBZWFJsTG5ObFlYSmphRk4wY21sdVp5NTBjbWx0S0NrdWRHOU1iM2RsY2tOaGMyVW9LVHRjYmx4dUlDQWdJQzh2SUdacGJIUmxjaUJqYjNWdWRISnBaWE1nYkdsemRDQmllU0IyWVd4MVpTQm1jbTl0SUdsdWNIVjBJR0p2ZUZ4dUlDQWdJR2xtS0hObFlYSmphRk4wY21sdVp5NXNaVzVuZEdnZ1BpQXdLWHRjYmlBZ0lDQWdJR052ZFc1MGNtbGxjeUE5SUdOdmRXNTBjbWxsY3k1bWFXeDBaWElvWm5WdVkzUnBiMjRvWTI5MWJuUnllU2w3WEc0Z0lDQWdJQ0FnSUhKbGRIVnliaUJqYjNWdWRISjVMbTVoYldVdWRHOU1iM2RsY2tOaGMyVW9LUzV0WVhSamFDZ2djMlZoY21Ob1UzUnlhVzVuSUNrN1hHNGdJQ0FnSUNCOUtUdGNiaUFnSUNCOVhHNWNiaUFnSUNCeVpYUjFjbTRnS0Z4dUlDQWdJQ0FnUEdScGRpQmpiR0Z6YzA1aGJXVTlYQ0p6WldGeVkyZ3RZMjl0Y0c5dVpXNTBYQ0krWEc0Z0lDQWdJQ0FnSUR4cGJuQjFkQ0IwZVhCbFBWd2lkR1Y0ZEZ3aUlIWmhiSFZsUFh0MGFHbHpMbk4wWVhSbExuTmxZWEpqYUZOMGNtbHVaMzBnYjI1RGFHRnVaMlU5ZTNSb2FYTXVhR0Z1Wkd4bFEyaGhibWRsZlNCd2JHRmpaV2h2YkdSbGNqMWNJbE5sWVhKamFDRmNJaUF2UGx4dUlDQWdJQ0FnSUNBOGRXdytYRzRnSUNBZ0lDQWdJQ0FnZXlCamIzVnVkSEpwWlhNdWJXRndLR1oxYm1OMGFXOXVLR052ZFc1MGNua3BleUJ5WlhSMWNtNGdQR3hwUG50amIzVnVkSEo1TG01aGJXVjlJRHd2YkdrK0lIMHBJSDFjYmlBZ0lDQWdJQ0FnUEM5MWJENWNiaUFnSUNBZ0lEd3ZaR2wyUGx4dUlDQWdJQ2xjYmlBZ2ZWeHVYRzU5S1R0Y2JseHVMeThnYkdsemRDQnZaaUJqYjNWdWRISnBaWE1zSUdSbFptbHVaV1FnZDJsMGFDQktZWFpoVTJOeWFYQjBJRzlpYW1WamRDQnNhWFJsY21Gc2MxeHVkbUZ5SUdOdmRXNTBjbWxsY3lBOUlGdGNiaUFnZTF3aWJtRnRaVndpT2lCY0lsTjNaV1JsYmx3aWZTd2dlMXdpYm1GdFpWd2lPaUJjSWtOb2FXNWhYQ0o5TENCN1hDSnVZVzFsWENJNklGd2lVR1Z5ZFZ3aWZTd2dlMXdpYm1GdFpWd2lPaUJjSWtONlpXTm9JRkpsY0hWaWJHbGpYQ0o5TEZ4dUlDQjdYQ0p1WVcxbFhDSTZJRndpUW05c2FYWnBZVndpZlN3Z2Uxd2libUZ0WlZ3aU9pQmNJa3hoZEhacFlWd2lmU3dnZTF3aWJtRnRaVndpT2lCY0lsTmhiVzloWENKOUxDQjdYQ0p1WVcxbFhDSTZJRndpUVhKdFpXNXBZVndpZlN4Y2JpQWdlMXdpYm1GdFpWd2lPaUJjSWtkeVpXVnViR0Z1WkZ3aWZTd2dlMXdpYm1GdFpWd2lPaUJjSWtOMVltRmNJbjBzSUh0Y0ltNWhiV1ZjSWpvZ1hDSlhaWE4wWlhKdUlGTmhhR0Z5WVZ3aWZTd2dlMXdpYm1GdFpWd2lPaUJjSWtWMGFHbHZjR2xoWENKOUxGeHVJQ0I3WENKdVlXMWxYQ0k2SUZ3aVRXRnNZWGx6YVdGY0luMHNJSHRjSW01aGJXVmNJam9nWENKQmNtZGxiblJwYm1GY0luMHNJSHRjSW01aGJXVmNJam9nWENKVloyRnVaR0ZjSW4wc0lIdGNJbTVoYldWY0lqb2dYQ0pEYUdsc1pWd2lmU3hjYmlBZ2Uxd2libUZ0WlZ3aU9pQmNJa0Z5ZFdKaFhDSjlMQ0I3WENKdVlXMWxYQ0k2SUZ3aVNtRndZVzVjSW4wc0lIdGNJbTVoYldWY0lqb2dYQ0pVY21sdWFXUmhaQ0JoYm1RZ1ZHOWlZV2R2WENKOUxDQjdYQ0p1WVcxbFhDSTZJRndpU1hSaGJIbGNJbjBzWEc0Z0lIdGNJbTVoYldWY0lqb2dYQ0pEWVcxaWIyUnBZVndpZlN3Z2Uxd2libUZ0WlZ3aU9pQmNJa2xqWld4aGJtUmNJbjBzSUh0Y0ltNWhiV1ZjSWpvZ1hDSkViMjFwYm1sallXNGdVbVZ3ZFdKc2FXTmNJbjBzSUh0Y0ltNWhiV1ZjSWpvZ1hDSlVkWEpyWlhsY0luMHNYRzRnSUh0Y0ltNWhiV1ZjSWpvZ1hDSlRjR0ZwYmx3aWZTd2dlMXdpYm1GdFpWd2lPaUJjSWxCdmJHRnVaRndpZlN3Z2Uxd2libUZ0WlZ3aU9pQmNJa2hoYVhScFhDSjlYRzVkTzF4dVhHNWNibHh1ZG1GeUlFbHRZV2RsUjNKcFpDQTlJRkpsWVdOMExtTnlaV0YwWlVOc1lYTnpLSHRjYmlBZ2NtVnVaR1Z5T2lCbWRXNWpkR2x2YmlncElIdGNiaUFnSUNCeVpYUjFjbTRnS0Z4dUlDQWdJQ0FnSUNBOFpHbDJJR05zWVhOelRtRnRaVDFjSW5KdmQxd2lJR2xrUFZ3aWFXMWhaMlZmWTI5dWRHRnBibVZ5WENJK1hHNGdJQ0FnSUNBZ0lEd3ZaR2wyUGx4dUlDQWdJQ2s3WEc0Z0lIMWNibjBwTzF4dUlDQmNibHh1WEc1c1pYUWdUV0ZwYmtOdmJuUmxiblFnUFNBb1hHNGdJRHhrYVhZK1hHNGdJQ0FnUEU1aGRpQXZQbHh1SUNBZ0lEeFFZV2RsUTI5dWRHRnBibVZ5UGx4dUlDQWdJQ0FnUEVSNWJtRnRhV05UWldGeVkyZ2dhWFJsYlhNOWV5QmpiM1Z1ZEhKcFpYTWdmU0F2UGx4dUlDQWdJRHd2VUdGblpVTnZiblJoYVc1bGNqNWNiaUFnUEM5a2FYWStYRzRwTzF4dVhHNVNaV0ZqZEVSUFRTNXlaVzVrWlhJb1hHNGdJRTFoYVc1RGIyNTBaVzUwSUN3Z1hHNGdJR1J2WTNWdFpXNTBMbWRsZEVWc1pXMWxiblJDZVVsa0tGd2lZWEJ3TFdOdmJuUmhhVzVsY2x3aUtWeHVLVHRjYmx4dUx5OGdkbUZ5SUUxaGFXNURiMjUwWlc1MElEMGdVbVZoWTNRdVkzSmxZWFJsUTJ4aGMzTW9lMXh1THk4Z0lDQWdJSEpsYm1SbGNqb2dablZ1WTNScGIyNG9LWHRjYmk4dklDQWdJQ0FnSUNBZ2NtVjBkWEp1SUNoY2JpOHZJQ0FnSUNBZ0lDQWdJQ0FnSUR4a2FYWWdZMnhoYzNOT1lXMWxQVndpYldGcGJpMWpiMjUwWlc1MFhDSStYRzR2THlBZ0lDQWdJQ0FnSUNBZ0lDQWdJRHhPWVhZZ0x6NWNiaTh2SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdQRkJoWjJWRGIyNTBZV2x1WlhJK1hHNHZMeUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdQRVI1Ym1GdGFXTlRaV0Z5WTJnZ2FYUmxiWE05ZXlCamIzVnVkSEpwWlhNZ2ZTQXZQbHh1THk4Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0E4TDFCaFoyVkRiMjUwWVdsdVpYSStYRzR2THlBZ0lDQWdJQ0FnSUNBZ0lDQThMMlJwZGo1Y2JpOHZJQ0FnSUNBZ0lDQWdLVnh1THk4Z0lDQWdJSDFjYmk4dklIMHBPMXh1WEc1Y2JseHVMeThnVW1WaFkzUkVUMDB1Y21WdVpHVnlLRnh1THk4Z0lDQThUV0ZwYmtOdmJuUmxiblFnTHo0c0lGeHVMeThnSUNCa2IyTjFiV1Z1ZEM1blpYUkZiR1Z0Wlc1MFFubEpaQ2hjSW1Gd2NDMWpiMjUwWVdsdVpYSmNJaWxjYmk4dklDazdJbDE5In0=
