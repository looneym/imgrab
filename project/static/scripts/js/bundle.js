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

},{"react":63}],65:[function(require,module,exports){
'use strict';

var _axios = require('axios');

var _axios2 = _interopRequireDefault(_axios);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _nav = require('./components/nav');

var _nav2 = _interopRequireDefault(_nav);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// class PageContainer extends Component {
//   render() {
//     return (
//       <div className="page-container">
//         {this.props.children}
//       </div>
//     );
//   }
// }


var PageContainer = _react2.default.createClass({
  displayName: 'PageContainer',
  render: function render() {
    return _react2.default.createElement(
      'div',
      { className: 'page-container' },
      this.props.children
    );
  }
});

var DynamicSearch = _react2.default.createClass({
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

});

// list of countries, defined with JavaScript object literals
var countries = [{ "name": "Sweden" }, { "name": "China" }, { "name": "Peru" }, { "name": "Czech Republic" }, { "name": "Bolivia" }, { "name": "Latvia" }, { "name": "Samoa" }, { "name": "Armenia" }, { "name": "Greenland" }, { "name": "Cuba" }, { "name": "Western Sahara" }, { "name": "Ethiopia" }, { "name": "Malaysia" }, { "name": "Argentina" }, { "name": "Uganda" }, { "name": "Chile" }, { "name": "Aruba" }, { "name": "Japan" }, { "name": "Trinidad and Tobago" }, { "name": "Italy" }, { "name": "Cambodia" }, { "name": "Iceland" }, { "name": "Dominican Republic" }, { "name": "Turkey" }, { "name": "Spain" }, { "name": "Poland" }, { "name": "Haiti" }];

var ImageGrid = _react2.default.createClass({
  displayName: 'ImageGrid',

  render: function render() {
    return _react2.default.createElement('div', { className: 'row', id: 'image_container' });
  }
});

var MainContent = _react2.default.createElement(
  'div',
  null,
  _react2.default.createElement(_nav2.default, null),
  _react2.default.createElement(
    PageContainer,
    null,
    _react2.default.createElement(DynamicSearch, { items: countries })
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

},{"./components/nav":64,"axios":1,"react":63}]},{},[65])

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvaW5kZXguanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2FkYXB0ZXJzL3hoci5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvYXhpb3MuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2NhbmNlbC9DYW5jZWwuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2NhbmNlbC9DYW5jZWxUb2tlbi5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvY2FuY2VsL2lzQ2FuY2VsLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9jb3JlL0F4aW9zLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9jb3JlL0ludGVyY2VwdG9yTWFuYWdlci5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvY29yZS9jcmVhdGVFcnJvci5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvY29yZS9kaXNwYXRjaFJlcXVlc3QuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2NvcmUvZW5oYW5jZUVycm9yLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9jb3JlL3NldHRsZS5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvY29yZS90cmFuc2Zvcm1EYXRhLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9kZWZhdWx0cy5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvaGVscGVycy9iaW5kLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9oZWxwZXJzL2J0b2EuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2hlbHBlcnMvYnVpbGRVUkwuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2hlbHBlcnMvY29tYmluZVVSTHMuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2hlbHBlcnMvY29va2llcy5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvaGVscGVycy9pc0Fic29sdXRlVVJMLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9oZWxwZXJzL2lzVVJMU2FtZU9yaWdpbi5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvaGVscGVycy9ub3JtYWxpemVIZWFkZXJOYW1lLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9oZWxwZXJzL3BhcnNlSGVhZGVycy5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvaGVscGVycy9zcHJlYWQuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL3V0aWxzLmpzIiwibm9kZV9tb2R1bGVzL2NyZWF0ZS1yZWFjdC1jbGFzcy9mYWN0b3J5LmpzIiwibm9kZV9tb2R1bGVzL2NyZWF0ZS1yZWFjdC1jbGFzcy9ub2RlX21vZHVsZXMvb2JqZWN0LWFzc2lnbi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9mYmpzL2xpYi9lbXB0eUZ1bmN0aW9uLmpzIiwibm9kZV9tb2R1bGVzL2ZianMvbGliL2VtcHR5T2JqZWN0LmpzIiwibm9kZV9tb2R1bGVzL2ZianMvbGliL2ludmFyaWFudC5qcyIsIm5vZGVfbW9kdWxlcy9mYmpzL2xpYi93YXJuaW5nLmpzIiwibm9kZV9tb2R1bGVzL2lzLWJ1ZmZlci9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvcHJvcC10eXBlcy9jaGVja1Byb3BUeXBlcy5qcyIsIm5vZGVfbW9kdWxlcy9wcm9wLXR5cGVzL2ZhY3RvcnkuanMiLCJub2RlX21vZHVsZXMvcHJvcC10eXBlcy9mYWN0b3J5V2l0aFR5cGVDaGVja2Vycy5qcyIsIm5vZGVfbW9kdWxlcy9wcm9wLXR5cGVzL2xpYi9SZWFjdFByb3BUeXBlc1NlY3JldC5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9saWIvS2V5RXNjYXBlVXRpbHMuanMiLCJub2RlX21vZHVsZXMvcmVhY3QvbGliL1Bvb2xlZENsYXNzLmpzIiwibm9kZV9tb2R1bGVzL3JlYWN0L2xpYi9SZWFjdC5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9saWIvUmVhY3RCYXNlQ2xhc3Nlcy5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9saWIvUmVhY3RDaGlsZHJlbi5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9saWIvUmVhY3RDb21wb25lbnRUcmVlSG9vay5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9saWIvUmVhY3RDdXJyZW50T3duZXIuanMiLCJub2RlX21vZHVsZXMvcmVhY3QvbGliL1JlYWN0RE9NRmFjdG9yaWVzLmpzIiwibm9kZV9tb2R1bGVzL3JlYWN0L2xpYi9SZWFjdEVsZW1lbnQuanMiLCJub2RlX21vZHVsZXMvcmVhY3QvbGliL1JlYWN0RWxlbWVudFN5bWJvbC5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9saWIvUmVhY3RFbGVtZW50VmFsaWRhdG9yLmpzIiwibm9kZV9tb2R1bGVzL3JlYWN0L2xpYi9SZWFjdE5vb3BVcGRhdGVRdWV1ZS5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9saWIvUmVhY3RQcm9wVHlwZUxvY2F0aW9uTmFtZXMuanMiLCJub2RlX21vZHVsZXMvcmVhY3QvbGliL1JlYWN0UHJvcFR5cGVzLmpzIiwibm9kZV9tb2R1bGVzL3JlYWN0L2xpYi9SZWFjdFByb3BUeXBlc1NlY3JldC5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9saWIvUmVhY3RWZXJzaW9uLmpzIiwibm9kZV9tb2R1bGVzL3JlYWN0L2xpYi9jYW5EZWZpbmVQcm9wZXJ0eS5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9saWIvY2hlY2tSZWFjdFR5cGVTcGVjLmpzIiwibm9kZV9tb2R1bGVzL3JlYWN0L2xpYi9jcmVhdGVDbGFzcy5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9saWIvZ2V0SXRlcmF0b3JGbi5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9saWIvbG93UHJpb3JpdHlXYXJuaW5nLmpzIiwibm9kZV9tb2R1bGVzL3JlYWN0L2xpYi9vbmx5Q2hpbGQuanMiLCJub2RlX21vZHVsZXMvcmVhY3QvbGliL3JlYWN0UHJvZEludmFyaWFudC5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9saWIvdHJhdmVyc2VBbGxDaGlsZHJlbi5qcyIsIm5vZGVfbW9kdWxlcy9yZWFjdC9yZWFjdC5qcyIsInByb2plY3Qvc3RhdGljL3NjcmlwdHMvanN4L2NvbXBvbmVudHMvbmF2LmpzIiwicHJvamVjdC9zdGF0aWMvc2NyaXB0cy9qc3gvbWFpbi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBOzs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3BMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzVGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMvU0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDeDJCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUN0REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMvREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3hMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDN0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDaGdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDOUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDbElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDN0lBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUM3TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDelhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ3ZLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ25WQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDN1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQzdGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUN2QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDeEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNyRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDL0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDcENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7O0FDOUtBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7Ozs7O0FDSEE7Ozs7Ozs7Ozs7OztJQUdNLEc7OztBQUVGLGlCQUFZLEtBQVosRUFBa0I7QUFBQTs7QUFBQSx5R0FDWixLQURZO0FBRWxCO0FBQ0M7Ozs7aUNBRU87QUFDUixtQkFDSTtBQUFBO0FBQUEsa0JBQUssSUFBRyxTQUFSLEVBQWtCLFdBQVUsc0RBQTVCO0FBQ0E7QUFBQTtBQUFBLHNCQUFLLFdBQVUsV0FBZjtBQUNJO0FBQUE7QUFBQSwwQkFBSyxXQUFVLDJCQUFmO0FBQ0E7QUFBQTtBQUFBLDhCQUFRLE1BQUssUUFBYixFQUFzQixXQUFVLGVBQWhDLEVBQWdELGVBQVksVUFBNUQsRUFBdUUsZUFBWSwrQkFBbkY7QUFDSTtBQUFBO0FBQUEsa0NBQU0sV0FBVSxTQUFoQjtBQUFBO0FBQUEsNkJBREo7QUFBQTtBQUM0RCxpRUFBRyxXQUFVLFlBQWI7QUFENUQseUJBREE7QUFJQTtBQUFBO0FBQUEsOEJBQUcsV0FBVSxjQUFiLEVBQTRCLE1BQUssR0FBakM7QUFBQTtBQUFBO0FBSkEscUJBREo7QUFPSTtBQUFBO0FBQUEsMEJBQUssV0FBVSwwQkFBZixFQUEwQyxJQUFHLDhCQUE3QztBQUNBO0FBQUE7QUFBQSw4QkFBSSxXQUFVLDZCQUFkO0FBQ0k7QUFBQTtBQUFBLGtDQUFJLFdBQVUsUUFBZDtBQUNBLHFFQUFHLE1BQUssV0FBUjtBQURBLDZCQURKO0FBSUk7QUFBQTtBQUFBLGtDQUFJLFdBQVUsYUFBZDtBQUNBO0FBQUE7QUFBQSxzQ0FBRyxNQUFLLFNBQVI7QUFBQTtBQUFBO0FBREEsNkJBSko7QUFPSTtBQUFBO0FBQUEsa0NBQUksV0FBVSxhQUFkO0FBQ0E7QUFBQTtBQUFBLHNDQUFHLE1BQUssR0FBUjtBQUFBO0FBQUE7QUFEQSw2QkFQSjtBQVVJO0FBQUE7QUFBQSxrQ0FBSSxXQUFVLGFBQWQ7QUFDQTtBQUFBO0FBQUEsc0NBQUcsTUFBSyxHQUFSO0FBQUE7QUFBQTtBQURBO0FBVko7QUFEQTtBQVBKO0FBREEsYUFESjtBQTRCQzs7Ozs7O0FBWUo7O2tCQUVjLEc7Ozs7O0FDckRmOzs7O0FBQ0E7Ozs7QUFFQTs7Ozs7O0FBTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUFJQSxJQUFJLGdCQUFnQixnQkFBTSxXQUFOLENBQWtCO0FBQUE7QUFDcEMsUUFEb0Msb0JBQzNCO0FBQ1AsV0FDRTtBQUFBO0FBQUEsUUFBSyxXQUFVLGdCQUFmO0FBQ0csV0FBSyxLQUFMLENBQVc7QUFEZCxLQURGO0FBS0Q7QUFQbUMsQ0FBbEIsQ0FBcEI7O0FBVUEsSUFBSSxnQkFBZ0IsZ0JBQU0sV0FBTixDQUFrQjtBQUFBOzs7QUFFcEM7QUFDQSxtQkFBaUIsMkJBQVU7QUFDekIsV0FBTyxFQUFFLGNBQWMsRUFBaEIsRUFBUDtBQUNELEdBTG1DOztBQU9wQztBQUNBLGdCQUFjLHNCQUFTLEtBQVQsRUFBZTtBQUMzQjtBQUNBLFNBQUssUUFBTCxDQUFjLEVBQUMsY0FBYSxNQUFNLE1BQU4sQ0FBYSxLQUEzQixFQUFkO0FBQ0EsWUFBUSxHQUFSLENBQVksZ0JBQVo7QUFDRCxHQVptQzs7QUFjcEMsVUFBUSxrQkFBVzs7QUFFakIsUUFBSSxZQUFZLEtBQUssS0FBTCxDQUFXLEtBQTNCO0FBQ0EsUUFBSSxlQUFlLEtBQUssS0FBTCxDQUFXLFlBQVgsQ0FBd0IsSUFBeEIsR0FBK0IsV0FBL0IsRUFBbkI7O0FBRUE7QUFDQSxRQUFHLGFBQWEsTUFBYixHQUFzQixDQUF6QixFQUEyQjtBQUN6QixrQkFBWSxVQUFVLE1BQVYsQ0FBaUIsVUFBUyxPQUFULEVBQWlCO0FBQzVDLGVBQU8sUUFBUSxJQUFSLENBQWEsV0FBYixHQUEyQixLQUEzQixDQUFrQyxZQUFsQyxDQUFQO0FBQ0QsT0FGVyxDQUFaO0FBR0Q7O0FBRUQsV0FDRTtBQUFBO0FBQUEsUUFBSyxXQUFVLGtCQUFmO0FBQ0UsK0NBQU8sTUFBSyxNQUFaLEVBQW1CLE9BQU8sS0FBSyxLQUFMLENBQVcsWUFBckMsRUFBbUQsVUFBVSxLQUFLLFlBQWxFLEVBQWdGLGFBQVksU0FBNUYsR0FERjtBQUVFO0FBQUE7QUFBQTtBQUNJLGtCQUFVLEdBQVYsQ0FBYyxVQUFTLE9BQVQsRUFBaUI7QUFBRSxpQkFBTztBQUFBO0FBQUE7QUFBSyxvQkFBUSxJQUFiO0FBQUE7QUFBQSxXQUFQO0FBQWlDLFNBQWxFO0FBREo7QUFGRixLQURGO0FBUUQ7O0FBbENtQyxDQUFsQixDQUFwQjs7QUFzQ0E7QUFDQSxJQUFJLFlBQVksQ0FDZCxFQUFDLFFBQVEsUUFBVCxFQURjLEVBQ00sRUFBQyxRQUFRLE9BQVQsRUFETixFQUN5QixFQUFDLFFBQVEsTUFBVCxFQUR6QixFQUMyQyxFQUFDLFFBQVEsZ0JBQVQsRUFEM0MsRUFFZCxFQUFDLFFBQVEsU0FBVCxFQUZjLEVBRU8sRUFBQyxRQUFRLFFBQVQsRUFGUCxFQUUyQixFQUFDLFFBQVEsT0FBVCxFQUYzQixFQUU4QyxFQUFDLFFBQVEsU0FBVCxFQUY5QyxFQUdkLEVBQUMsUUFBUSxXQUFULEVBSGMsRUFHUyxFQUFDLFFBQVEsTUFBVCxFQUhULEVBRzJCLEVBQUMsUUFBUSxnQkFBVCxFQUgzQixFQUd1RCxFQUFDLFFBQVEsVUFBVCxFQUh2RCxFQUlkLEVBQUMsUUFBUSxVQUFULEVBSmMsRUFJUSxFQUFDLFFBQVEsV0FBVCxFQUpSLEVBSStCLEVBQUMsUUFBUSxRQUFULEVBSi9CLEVBSW1ELEVBQUMsUUFBUSxPQUFULEVBSm5ELEVBS2QsRUFBQyxRQUFRLE9BQVQsRUFMYyxFQUtLLEVBQUMsUUFBUSxPQUFULEVBTEwsRUFLd0IsRUFBQyxRQUFRLHFCQUFULEVBTHhCLEVBS3lELEVBQUMsUUFBUSxPQUFULEVBTHpELEVBTWQsRUFBQyxRQUFRLFVBQVQsRUFOYyxFQU1RLEVBQUMsUUFBUSxTQUFULEVBTlIsRUFNNkIsRUFBQyxRQUFRLG9CQUFULEVBTjdCLEVBTTZELEVBQUMsUUFBUSxRQUFULEVBTjdELEVBT2QsRUFBQyxRQUFRLE9BQVQsRUFQYyxFQU9LLEVBQUMsUUFBUSxRQUFULEVBUEwsRUFPeUIsRUFBQyxRQUFRLE9BQVQsRUFQekIsQ0FBaEI7O0FBWUEsSUFBSSxZQUFZLGdCQUFNLFdBQU4sQ0FBa0I7QUFBQTs7QUFDaEMsVUFBUSxrQkFBVztBQUNqQixXQUNJLHVDQUFLLFdBQVUsS0FBZixFQUFxQixJQUFHLGlCQUF4QixHQURKO0FBSUQ7QUFOK0IsQ0FBbEIsQ0FBaEI7O0FBV0EsSUFBSSxjQUNGO0FBQUE7QUFBQTtBQUNFLG9EQURGO0FBRUU7QUFBQyxpQkFBRDtBQUFBO0FBQ0Usa0NBQUMsYUFBRCxJQUFlLE9BQVEsU0FBdkI7QUFERjtBQUZGLENBREY7O0FBU0EsU0FBUyxNQUFULENBQ0UsV0FERixFQUVFLFNBQVMsY0FBVCxDQUF3QixlQUF4QixDQUZGOztBQUtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FBSUE7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vbGliL2F4aW9zJyk7IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLy4uL3V0aWxzJyk7XG52YXIgc2V0dGxlID0gcmVxdWlyZSgnLi8uLi9jb3JlL3NldHRsZScpO1xudmFyIGJ1aWxkVVJMID0gcmVxdWlyZSgnLi8uLi9oZWxwZXJzL2J1aWxkVVJMJyk7XG52YXIgcGFyc2VIZWFkZXJzID0gcmVxdWlyZSgnLi8uLi9oZWxwZXJzL3BhcnNlSGVhZGVycycpO1xudmFyIGlzVVJMU2FtZU9yaWdpbiA9IHJlcXVpcmUoJy4vLi4vaGVscGVycy9pc1VSTFNhbWVPcmlnaW4nKTtcbnZhciBjcmVhdGVFcnJvciA9IHJlcXVpcmUoJy4uL2NvcmUvY3JlYXRlRXJyb3InKTtcbnZhciBidG9hID0gKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHdpbmRvdy5idG9hICYmIHdpbmRvdy5idG9hLmJpbmQod2luZG93KSkgfHwgcmVxdWlyZSgnLi8uLi9oZWxwZXJzL2J0b2EnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiB4aHJBZGFwdGVyKGNvbmZpZykge1xuICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gZGlzcGF0Y2hYaHJSZXF1ZXN0KHJlc29sdmUsIHJlamVjdCkge1xuICAgIHZhciByZXF1ZXN0RGF0YSA9IGNvbmZpZy5kYXRhO1xuICAgIHZhciByZXF1ZXN0SGVhZGVycyA9IGNvbmZpZy5oZWFkZXJzO1xuXG4gICAgaWYgKHV0aWxzLmlzRm9ybURhdGEocmVxdWVzdERhdGEpKSB7XG4gICAgICBkZWxldGUgcmVxdWVzdEhlYWRlcnNbJ0NvbnRlbnQtVHlwZSddOyAvLyBMZXQgdGhlIGJyb3dzZXIgc2V0IGl0XG4gICAgfVxuXG4gICAgdmFyIHJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICB2YXIgbG9hZEV2ZW50ID0gJ29ucmVhZHlzdGF0ZWNoYW5nZSc7XG4gICAgdmFyIHhEb21haW4gPSBmYWxzZTtcblxuICAgIC8vIEZvciBJRSA4LzkgQ09SUyBzdXBwb3J0XG4gICAgLy8gT25seSBzdXBwb3J0cyBQT1NUIGFuZCBHRVQgY2FsbHMgYW5kIGRvZXNuJ3QgcmV0dXJucyB0aGUgcmVzcG9uc2UgaGVhZGVycy5cbiAgICAvLyBET04nVCBkbyB0aGlzIGZvciB0ZXN0aW5nIGIvYyBYTUxIdHRwUmVxdWVzdCBpcyBtb2NrZWQsIG5vdCBYRG9tYWluUmVxdWVzdC5cbiAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICd0ZXN0JyAmJlxuICAgICAgICB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJlxuICAgICAgICB3aW5kb3cuWERvbWFpblJlcXVlc3QgJiYgISgnd2l0aENyZWRlbnRpYWxzJyBpbiByZXF1ZXN0KSAmJlxuICAgICAgICAhaXNVUkxTYW1lT3JpZ2luKGNvbmZpZy51cmwpKSB7XG4gICAgICByZXF1ZXN0ID0gbmV3IHdpbmRvdy5YRG9tYWluUmVxdWVzdCgpO1xuICAgICAgbG9hZEV2ZW50ID0gJ29ubG9hZCc7XG4gICAgICB4RG9tYWluID0gdHJ1ZTtcbiAgICAgIHJlcXVlc3Qub25wcm9ncmVzcyA9IGZ1bmN0aW9uIGhhbmRsZVByb2dyZXNzKCkge307XG4gICAgICByZXF1ZXN0Lm9udGltZW91dCA9IGZ1bmN0aW9uIGhhbmRsZVRpbWVvdXQoKSB7fTtcbiAgICB9XG5cbiAgICAvLyBIVFRQIGJhc2ljIGF1dGhlbnRpY2F0aW9uXG4gICAgaWYgKGNvbmZpZy5hdXRoKSB7XG4gICAgICB2YXIgdXNlcm5hbWUgPSBjb25maWcuYXV0aC51c2VybmFtZSB8fCAnJztcbiAgICAgIHZhciBwYXNzd29yZCA9IGNvbmZpZy5hdXRoLnBhc3N3b3JkIHx8ICcnO1xuICAgICAgcmVxdWVzdEhlYWRlcnMuQXV0aG9yaXphdGlvbiA9ICdCYXNpYyAnICsgYnRvYSh1c2VybmFtZSArICc6JyArIHBhc3N3b3JkKTtcbiAgICB9XG5cbiAgICByZXF1ZXN0Lm9wZW4oY29uZmlnLm1ldGhvZC50b1VwcGVyQ2FzZSgpLCBidWlsZFVSTChjb25maWcudXJsLCBjb25maWcucGFyYW1zLCBjb25maWcucGFyYW1zU2VyaWFsaXplciksIHRydWUpO1xuXG4gICAgLy8gU2V0IHRoZSByZXF1ZXN0IHRpbWVvdXQgaW4gTVNcbiAgICByZXF1ZXN0LnRpbWVvdXQgPSBjb25maWcudGltZW91dDtcblxuICAgIC8vIExpc3RlbiBmb3IgcmVhZHkgc3RhdGVcbiAgICByZXF1ZXN0W2xvYWRFdmVudF0gPSBmdW5jdGlvbiBoYW5kbGVMb2FkKCkge1xuICAgICAgaWYgKCFyZXF1ZXN0IHx8IChyZXF1ZXN0LnJlYWR5U3RhdGUgIT09IDQgJiYgIXhEb21haW4pKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gVGhlIHJlcXVlc3QgZXJyb3JlZCBvdXQgYW5kIHdlIGRpZG4ndCBnZXQgYSByZXNwb25zZSwgdGhpcyB3aWxsIGJlXG4gICAgICAvLyBoYW5kbGVkIGJ5IG9uZXJyb3IgaW5zdGVhZFxuICAgICAgLy8gV2l0aCBvbmUgZXhjZXB0aW9uOiByZXF1ZXN0IHRoYXQgdXNpbmcgZmlsZTogcHJvdG9jb2wsIG1vc3QgYnJvd3NlcnNcbiAgICAgIC8vIHdpbGwgcmV0dXJuIHN0YXR1cyBhcyAwIGV2ZW4gdGhvdWdoIGl0J3MgYSBzdWNjZXNzZnVsIHJlcXVlc3RcbiAgICAgIGlmIChyZXF1ZXN0LnN0YXR1cyA9PT0gMCAmJiAhKHJlcXVlc3QucmVzcG9uc2VVUkwgJiYgcmVxdWVzdC5yZXNwb25zZVVSTC5pbmRleE9mKCdmaWxlOicpID09PSAwKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIFByZXBhcmUgdGhlIHJlc3BvbnNlXG4gICAgICB2YXIgcmVzcG9uc2VIZWFkZXJzID0gJ2dldEFsbFJlc3BvbnNlSGVhZGVycycgaW4gcmVxdWVzdCA/IHBhcnNlSGVhZGVycyhyZXF1ZXN0LmdldEFsbFJlc3BvbnNlSGVhZGVycygpKSA6IG51bGw7XG4gICAgICB2YXIgcmVzcG9uc2VEYXRhID0gIWNvbmZpZy5yZXNwb25zZVR5cGUgfHwgY29uZmlnLnJlc3BvbnNlVHlwZSA9PT0gJ3RleHQnID8gcmVxdWVzdC5yZXNwb25zZVRleHQgOiByZXF1ZXN0LnJlc3BvbnNlO1xuICAgICAgdmFyIHJlc3BvbnNlID0ge1xuICAgICAgICBkYXRhOiByZXNwb25zZURhdGEsXG4gICAgICAgIC8vIElFIHNlbmRzIDEyMjMgaW5zdGVhZCBvZiAyMDQgKGh0dHBzOi8vZ2l0aHViLmNvbS9temFicmlza2llL2F4aW9zL2lzc3Vlcy8yMDEpXG4gICAgICAgIHN0YXR1czogcmVxdWVzdC5zdGF0dXMgPT09IDEyMjMgPyAyMDQgOiByZXF1ZXN0LnN0YXR1cyxcbiAgICAgICAgc3RhdHVzVGV4dDogcmVxdWVzdC5zdGF0dXMgPT09IDEyMjMgPyAnTm8gQ29udGVudCcgOiByZXF1ZXN0LnN0YXR1c1RleHQsXG4gICAgICAgIGhlYWRlcnM6IHJlc3BvbnNlSGVhZGVycyxcbiAgICAgICAgY29uZmlnOiBjb25maWcsXG4gICAgICAgIHJlcXVlc3Q6IHJlcXVlc3RcbiAgICAgIH07XG5cbiAgICAgIHNldHRsZShyZXNvbHZlLCByZWplY3QsIHJlc3BvbnNlKTtcblxuICAgICAgLy8gQ2xlYW4gdXAgcmVxdWVzdFxuICAgICAgcmVxdWVzdCA9IG51bGw7XG4gICAgfTtcblxuICAgIC8vIEhhbmRsZSBsb3cgbGV2ZWwgbmV0d29yayBlcnJvcnNcbiAgICByZXF1ZXN0Lm9uZXJyb3IgPSBmdW5jdGlvbiBoYW5kbGVFcnJvcigpIHtcbiAgICAgIC8vIFJlYWwgZXJyb3JzIGFyZSBoaWRkZW4gZnJvbSB1cyBieSB0aGUgYnJvd3NlclxuICAgICAgLy8gb25lcnJvciBzaG91bGQgb25seSBmaXJlIGlmIGl0J3MgYSBuZXR3b3JrIGVycm9yXG4gICAgICByZWplY3QoY3JlYXRlRXJyb3IoJ05ldHdvcmsgRXJyb3InLCBjb25maWcsIG51bGwsIHJlcXVlc3QpKTtcblxuICAgICAgLy8gQ2xlYW4gdXAgcmVxdWVzdFxuICAgICAgcmVxdWVzdCA9IG51bGw7XG4gICAgfTtcblxuICAgIC8vIEhhbmRsZSB0aW1lb3V0XG4gICAgcmVxdWVzdC5vbnRpbWVvdXQgPSBmdW5jdGlvbiBoYW5kbGVUaW1lb3V0KCkge1xuICAgICAgcmVqZWN0KGNyZWF0ZUVycm9yKCd0aW1lb3V0IG9mICcgKyBjb25maWcudGltZW91dCArICdtcyBleGNlZWRlZCcsIGNvbmZpZywgJ0VDT05OQUJPUlRFRCcsXG4gICAgICAgIHJlcXVlc3QpKTtcblxuICAgICAgLy8gQ2xlYW4gdXAgcmVxdWVzdFxuICAgICAgcmVxdWVzdCA9IG51bGw7XG4gICAgfTtcblxuICAgIC8vIEFkZCB4c3JmIGhlYWRlclxuICAgIC8vIFRoaXMgaXMgb25seSBkb25lIGlmIHJ1bm5pbmcgaW4gYSBzdGFuZGFyZCBicm93c2VyIGVudmlyb25tZW50LlxuICAgIC8vIFNwZWNpZmljYWxseSBub3QgaWYgd2UncmUgaW4gYSB3ZWIgd29ya2VyLCBvciByZWFjdC1uYXRpdmUuXG4gICAgaWYgKHV0aWxzLmlzU3RhbmRhcmRCcm93c2VyRW52KCkpIHtcbiAgICAgIHZhciBjb29raWVzID0gcmVxdWlyZSgnLi8uLi9oZWxwZXJzL2Nvb2tpZXMnKTtcblxuICAgICAgLy8gQWRkIHhzcmYgaGVhZGVyXG4gICAgICB2YXIgeHNyZlZhbHVlID0gKGNvbmZpZy53aXRoQ3JlZGVudGlhbHMgfHwgaXNVUkxTYW1lT3JpZ2luKGNvbmZpZy51cmwpKSAmJiBjb25maWcueHNyZkNvb2tpZU5hbWUgP1xuICAgICAgICAgIGNvb2tpZXMucmVhZChjb25maWcueHNyZkNvb2tpZU5hbWUpIDpcbiAgICAgICAgICB1bmRlZmluZWQ7XG5cbiAgICAgIGlmICh4c3JmVmFsdWUpIHtcbiAgICAgICAgcmVxdWVzdEhlYWRlcnNbY29uZmlnLnhzcmZIZWFkZXJOYW1lXSA9IHhzcmZWYWx1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBBZGQgaGVhZGVycyB0byB0aGUgcmVxdWVzdFxuICAgIGlmICgnc2V0UmVxdWVzdEhlYWRlcicgaW4gcmVxdWVzdCkge1xuICAgICAgdXRpbHMuZm9yRWFjaChyZXF1ZXN0SGVhZGVycywgZnVuY3Rpb24gc2V0UmVxdWVzdEhlYWRlcih2YWwsIGtleSkge1xuICAgICAgICBpZiAodHlwZW9mIHJlcXVlc3REYXRhID09PSAndW5kZWZpbmVkJyAmJiBrZXkudG9Mb3dlckNhc2UoKSA9PT0gJ2NvbnRlbnQtdHlwZScpIHtcbiAgICAgICAgICAvLyBSZW1vdmUgQ29udGVudC1UeXBlIGlmIGRhdGEgaXMgdW5kZWZpbmVkXG4gICAgICAgICAgZGVsZXRlIHJlcXVlc3RIZWFkZXJzW2tleV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gT3RoZXJ3aXNlIGFkZCBoZWFkZXIgdG8gdGhlIHJlcXVlc3RcbiAgICAgICAgICByZXF1ZXN0LnNldFJlcXVlc3RIZWFkZXIoa2V5LCB2YWwpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBBZGQgd2l0aENyZWRlbnRpYWxzIHRvIHJlcXVlc3QgaWYgbmVlZGVkXG4gICAgaWYgKGNvbmZpZy53aXRoQ3JlZGVudGlhbHMpIHtcbiAgICAgIHJlcXVlc3Qud2l0aENyZWRlbnRpYWxzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBBZGQgcmVzcG9uc2VUeXBlIHRvIHJlcXVlc3QgaWYgbmVlZGVkXG4gICAgaWYgKGNvbmZpZy5yZXNwb25zZVR5cGUpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJlcXVlc3QucmVzcG9uc2VUeXBlID0gY29uZmlnLnJlc3BvbnNlVHlwZTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgLy8gRXhwZWN0ZWQgRE9NRXhjZXB0aW9uIHRocm93biBieSBicm93c2VycyBub3QgY29tcGF0aWJsZSBYTUxIdHRwUmVxdWVzdCBMZXZlbCAyLlxuICAgICAgICAvLyBCdXQsIHRoaXMgY2FuIGJlIHN1cHByZXNzZWQgZm9yICdqc29uJyB0eXBlIGFzIGl0IGNhbiBiZSBwYXJzZWQgYnkgZGVmYXVsdCAndHJhbnNmb3JtUmVzcG9uc2UnIGZ1bmN0aW9uLlxuICAgICAgICBpZiAoY29uZmlnLnJlc3BvbnNlVHlwZSAhPT0gJ2pzb24nKSB7XG4gICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEhhbmRsZSBwcm9ncmVzcyBpZiBuZWVkZWRcbiAgICBpZiAodHlwZW9mIGNvbmZpZy5vbkRvd25sb2FkUHJvZ3Jlc3MgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHJlcXVlc3QuYWRkRXZlbnRMaXN0ZW5lcigncHJvZ3Jlc3MnLCBjb25maWcub25Eb3dubG9hZFByb2dyZXNzKTtcbiAgICB9XG5cbiAgICAvLyBOb3QgYWxsIGJyb3dzZXJzIHN1cHBvcnQgdXBsb2FkIGV2ZW50c1xuICAgIGlmICh0eXBlb2YgY29uZmlnLm9uVXBsb2FkUHJvZ3Jlc3MgPT09ICdmdW5jdGlvbicgJiYgcmVxdWVzdC51cGxvYWQpIHtcbiAgICAgIHJlcXVlc3QudXBsb2FkLmFkZEV2ZW50TGlzdGVuZXIoJ3Byb2dyZXNzJywgY29uZmlnLm9uVXBsb2FkUHJvZ3Jlc3MpO1xuICAgIH1cblxuICAgIGlmIChjb25maWcuY2FuY2VsVG9rZW4pIHtcbiAgICAgIC8vIEhhbmRsZSBjYW5jZWxsYXRpb25cbiAgICAgIGNvbmZpZy5jYW5jZWxUb2tlbi5wcm9taXNlLnRoZW4oZnVuY3Rpb24gb25DYW5jZWxlZChjYW5jZWwpIHtcbiAgICAgICAgaWYgKCFyZXF1ZXN0KSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVxdWVzdC5hYm9ydCgpO1xuICAgICAgICByZWplY3QoY2FuY2VsKTtcbiAgICAgICAgLy8gQ2xlYW4gdXAgcmVxdWVzdFxuICAgICAgICByZXF1ZXN0ID0gbnVsbDtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmIChyZXF1ZXN0RGF0YSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXF1ZXN0RGF0YSA9IG51bGw7XG4gICAgfVxuXG4gICAgLy8gU2VuZCB0aGUgcmVxdWVzdFxuICAgIHJlcXVlc3Quc2VuZChyZXF1ZXN0RGF0YSk7XG4gIH0pO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xudmFyIGJpbmQgPSByZXF1aXJlKCcuL2hlbHBlcnMvYmluZCcpO1xudmFyIEF4aW9zID0gcmVxdWlyZSgnLi9jb3JlL0F4aW9zJyk7XG52YXIgZGVmYXVsdHMgPSByZXF1aXJlKCcuL2RlZmF1bHRzJyk7XG5cbi8qKlxuICogQ3JlYXRlIGFuIGluc3RhbmNlIG9mIEF4aW9zXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGRlZmF1bHRDb25maWcgVGhlIGRlZmF1bHQgY29uZmlnIGZvciB0aGUgaW5zdGFuY2VcbiAqIEByZXR1cm4ge0F4aW9zfSBBIG5ldyBpbnN0YW5jZSBvZiBBeGlvc1xuICovXG5mdW5jdGlvbiBjcmVhdGVJbnN0YW5jZShkZWZhdWx0Q29uZmlnKSB7XG4gIHZhciBjb250ZXh0ID0gbmV3IEF4aW9zKGRlZmF1bHRDb25maWcpO1xuICB2YXIgaW5zdGFuY2UgPSBiaW5kKEF4aW9zLnByb3RvdHlwZS5yZXF1ZXN0LCBjb250ZXh0KTtcblxuICAvLyBDb3B5IGF4aW9zLnByb3RvdHlwZSB0byBpbnN0YW5jZVxuICB1dGlscy5leHRlbmQoaW5zdGFuY2UsIEF4aW9zLnByb3RvdHlwZSwgY29udGV4dCk7XG5cbiAgLy8gQ29weSBjb250ZXh0IHRvIGluc3RhbmNlXG4gIHV0aWxzLmV4dGVuZChpbnN0YW5jZSwgY29udGV4dCk7XG5cbiAgcmV0dXJuIGluc3RhbmNlO1xufVxuXG4vLyBDcmVhdGUgdGhlIGRlZmF1bHQgaW5zdGFuY2UgdG8gYmUgZXhwb3J0ZWRcbnZhciBheGlvcyA9IGNyZWF0ZUluc3RhbmNlKGRlZmF1bHRzKTtcblxuLy8gRXhwb3NlIEF4aW9zIGNsYXNzIHRvIGFsbG93IGNsYXNzIGluaGVyaXRhbmNlXG5heGlvcy5BeGlvcyA9IEF4aW9zO1xuXG4vLyBGYWN0b3J5IGZvciBjcmVhdGluZyBuZXcgaW5zdGFuY2VzXG5heGlvcy5jcmVhdGUgPSBmdW5jdGlvbiBjcmVhdGUoaW5zdGFuY2VDb25maWcpIHtcbiAgcmV0dXJuIGNyZWF0ZUluc3RhbmNlKHV0aWxzLm1lcmdlKGRlZmF1bHRzLCBpbnN0YW5jZUNvbmZpZykpO1xufTtcblxuLy8gRXhwb3NlIENhbmNlbCAmIENhbmNlbFRva2VuXG5heGlvcy5DYW5jZWwgPSByZXF1aXJlKCcuL2NhbmNlbC9DYW5jZWwnKTtcbmF4aW9zLkNhbmNlbFRva2VuID0gcmVxdWlyZSgnLi9jYW5jZWwvQ2FuY2VsVG9rZW4nKTtcbmF4aW9zLmlzQ2FuY2VsID0gcmVxdWlyZSgnLi9jYW5jZWwvaXNDYW5jZWwnKTtcblxuLy8gRXhwb3NlIGFsbC9zcHJlYWRcbmF4aW9zLmFsbCA9IGZ1bmN0aW9uIGFsbChwcm9taXNlcykge1xuICByZXR1cm4gUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xufTtcbmF4aW9zLnNwcmVhZCA9IHJlcXVpcmUoJy4vaGVscGVycy9zcHJlYWQnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBheGlvcztcblxuLy8gQWxsb3cgdXNlIG9mIGRlZmF1bHQgaW1wb3J0IHN5bnRheCBpbiBUeXBlU2NyaXB0XG5tb2R1bGUuZXhwb3J0cy5kZWZhdWx0ID0gYXhpb3M7XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qKlxuICogQSBgQ2FuY2VsYCBpcyBhbiBvYmplY3QgdGhhdCBpcyB0aHJvd24gd2hlbiBhbiBvcGVyYXRpb24gaXMgY2FuY2VsZWQuXG4gKlxuICogQGNsYXNzXG4gKiBAcGFyYW0ge3N0cmluZz19IG1lc3NhZ2UgVGhlIG1lc3NhZ2UuXG4gKi9cbmZ1bmN0aW9uIENhbmNlbChtZXNzYWdlKSB7XG4gIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG59XG5cbkNhbmNlbC5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiB0b1N0cmluZygpIHtcbiAgcmV0dXJuICdDYW5jZWwnICsgKHRoaXMubWVzc2FnZSA/ICc6ICcgKyB0aGlzLm1lc3NhZ2UgOiAnJyk7XG59O1xuXG5DYW5jZWwucHJvdG90eXBlLl9fQ0FOQ0VMX18gPSB0cnVlO1xuXG5tb2R1bGUuZXhwb3J0cyA9IENhbmNlbDtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIENhbmNlbCA9IHJlcXVpcmUoJy4vQ2FuY2VsJyk7XG5cbi8qKlxuICogQSBgQ2FuY2VsVG9rZW5gIGlzIGFuIG9iamVjdCB0aGF0IGNhbiBiZSB1c2VkIHRvIHJlcXVlc3QgY2FuY2VsbGF0aW9uIG9mIGFuIG9wZXJhdGlvbi5cbiAqXG4gKiBAY2xhc3NcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGV4ZWN1dG9yIFRoZSBleGVjdXRvciBmdW5jdGlvbi5cbiAqL1xuZnVuY3Rpb24gQ2FuY2VsVG9rZW4oZXhlY3V0b3IpIHtcbiAgaWYgKHR5cGVvZiBleGVjdXRvciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2V4ZWN1dG9yIG11c3QgYmUgYSBmdW5jdGlvbi4nKTtcbiAgfVxuXG4gIHZhciByZXNvbHZlUHJvbWlzZTtcbiAgdGhpcy5wcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24gcHJvbWlzZUV4ZWN1dG9yKHJlc29sdmUpIHtcbiAgICByZXNvbHZlUHJvbWlzZSA9IHJlc29sdmU7XG4gIH0pO1xuXG4gIHZhciB0b2tlbiA9IHRoaXM7XG4gIGV4ZWN1dG9yKGZ1bmN0aW9uIGNhbmNlbChtZXNzYWdlKSB7XG4gICAgaWYgKHRva2VuLnJlYXNvbikge1xuICAgICAgLy8gQ2FuY2VsbGF0aW9uIGhhcyBhbHJlYWR5IGJlZW4gcmVxdWVzdGVkXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdG9rZW4ucmVhc29uID0gbmV3IENhbmNlbChtZXNzYWdlKTtcbiAgICByZXNvbHZlUHJvbWlzZSh0b2tlbi5yZWFzb24pO1xuICB9KTtcbn1cblxuLyoqXG4gKiBUaHJvd3MgYSBgQ2FuY2VsYCBpZiBjYW5jZWxsYXRpb24gaGFzIGJlZW4gcmVxdWVzdGVkLlxuICovXG5DYW5jZWxUb2tlbi5wcm90b3R5cGUudGhyb3dJZlJlcXVlc3RlZCA9IGZ1bmN0aW9uIHRocm93SWZSZXF1ZXN0ZWQoKSB7XG4gIGlmICh0aGlzLnJlYXNvbikge1xuICAgIHRocm93IHRoaXMucmVhc29uO1xuICB9XG59O1xuXG4vKipcbiAqIFJldHVybnMgYW4gb2JqZWN0IHRoYXQgY29udGFpbnMgYSBuZXcgYENhbmNlbFRva2VuYCBhbmQgYSBmdW5jdGlvbiB0aGF0LCB3aGVuIGNhbGxlZCxcbiAqIGNhbmNlbHMgdGhlIGBDYW5jZWxUb2tlbmAuXG4gKi9cbkNhbmNlbFRva2VuLnNvdXJjZSA9IGZ1bmN0aW9uIHNvdXJjZSgpIHtcbiAgdmFyIGNhbmNlbDtcbiAgdmFyIHRva2VuID0gbmV3IENhbmNlbFRva2VuKGZ1bmN0aW9uIGV4ZWN1dG9yKGMpIHtcbiAgICBjYW5jZWwgPSBjO1xuICB9KTtcbiAgcmV0dXJuIHtcbiAgICB0b2tlbjogdG9rZW4sXG4gICAgY2FuY2VsOiBjYW5jZWxcbiAgfTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ2FuY2VsVG9rZW47XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaXNDYW5jZWwodmFsdWUpIHtcbiAgcmV0dXJuICEhKHZhbHVlICYmIHZhbHVlLl9fQ0FOQ0VMX18pO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGRlZmF1bHRzID0gcmVxdWlyZSgnLi8uLi9kZWZhdWx0cycpO1xudmFyIHV0aWxzID0gcmVxdWlyZSgnLi8uLi91dGlscycpO1xudmFyIEludGVyY2VwdG9yTWFuYWdlciA9IHJlcXVpcmUoJy4vSW50ZXJjZXB0b3JNYW5hZ2VyJyk7XG52YXIgZGlzcGF0Y2hSZXF1ZXN0ID0gcmVxdWlyZSgnLi9kaXNwYXRjaFJlcXVlc3QnKTtcbnZhciBpc0Fic29sdXRlVVJMID0gcmVxdWlyZSgnLi8uLi9oZWxwZXJzL2lzQWJzb2x1dGVVUkwnKTtcbnZhciBjb21iaW5lVVJMcyA9IHJlcXVpcmUoJy4vLi4vaGVscGVycy9jb21iaW5lVVJMcycpO1xuXG4vKipcbiAqIENyZWF0ZSBhIG5ldyBpbnN0YW5jZSBvZiBBeGlvc1xuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBpbnN0YW5jZUNvbmZpZyBUaGUgZGVmYXVsdCBjb25maWcgZm9yIHRoZSBpbnN0YW5jZVxuICovXG5mdW5jdGlvbiBBeGlvcyhpbnN0YW5jZUNvbmZpZykge1xuICB0aGlzLmRlZmF1bHRzID0gaW5zdGFuY2VDb25maWc7XG4gIHRoaXMuaW50ZXJjZXB0b3JzID0ge1xuICAgIHJlcXVlc3Q6IG5ldyBJbnRlcmNlcHRvck1hbmFnZXIoKSxcbiAgICByZXNwb25zZTogbmV3IEludGVyY2VwdG9yTWFuYWdlcigpXG4gIH07XG59XG5cbi8qKlxuICogRGlzcGF0Y2ggYSByZXF1ZXN0XG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBUaGUgY29uZmlnIHNwZWNpZmljIGZvciB0aGlzIHJlcXVlc3QgKG1lcmdlZCB3aXRoIHRoaXMuZGVmYXVsdHMpXG4gKi9cbkF4aW9zLnByb3RvdHlwZS5yZXF1ZXN0ID0gZnVuY3Rpb24gcmVxdWVzdChjb25maWcpIHtcbiAgLyplc2xpbnQgbm8tcGFyYW0tcmVhc3NpZ246MCovXG4gIC8vIEFsbG93IGZvciBheGlvcygnZXhhbXBsZS91cmwnWywgY29uZmlnXSkgYSBsYSBmZXRjaCBBUElcbiAgaWYgKHR5cGVvZiBjb25maWcgPT09ICdzdHJpbmcnKSB7XG4gICAgY29uZmlnID0gdXRpbHMubWVyZ2Uoe1xuICAgICAgdXJsOiBhcmd1bWVudHNbMF1cbiAgICB9LCBhcmd1bWVudHNbMV0pO1xuICB9XG5cbiAgY29uZmlnID0gdXRpbHMubWVyZ2UoZGVmYXVsdHMsIHRoaXMuZGVmYXVsdHMsIHsgbWV0aG9kOiAnZ2V0JyB9LCBjb25maWcpO1xuICBjb25maWcubWV0aG9kID0gY29uZmlnLm1ldGhvZC50b0xvd2VyQ2FzZSgpO1xuXG4gIC8vIFN1cHBvcnQgYmFzZVVSTCBjb25maWdcbiAgaWYgKGNvbmZpZy5iYXNlVVJMICYmICFpc0Fic29sdXRlVVJMKGNvbmZpZy51cmwpKSB7XG4gICAgY29uZmlnLnVybCA9IGNvbWJpbmVVUkxzKGNvbmZpZy5iYXNlVVJMLCBjb25maWcudXJsKTtcbiAgfVxuXG4gIC8vIEhvb2sgdXAgaW50ZXJjZXB0b3JzIG1pZGRsZXdhcmVcbiAgdmFyIGNoYWluID0gW2Rpc3BhdGNoUmVxdWVzdCwgdW5kZWZpbmVkXTtcbiAgdmFyIHByb21pc2UgPSBQcm9taXNlLnJlc29sdmUoY29uZmlnKTtcblxuICB0aGlzLmludGVyY2VwdG9ycy5yZXF1ZXN0LmZvckVhY2goZnVuY3Rpb24gdW5zaGlmdFJlcXVlc3RJbnRlcmNlcHRvcnMoaW50ZXJjZXB0b3IpIHtcbiAgICBjaGFpbi51bnNoaWZ0KGludGVyY2VwdG9yLmZ1bGZpbGxlZCwgaW50ZXJjZXB0b3IucmVqZWN0ZWQpO1xuICB9KTtcblxuICB0aGlzLmludGVyY2VwdG9ycy5yZXNwb25zZS5mb3JFYWNoKGZ1bmN0aW9uIHB1c2hSZXNwb25zZUludGVyY2VwdG9ycyhpbnRlcmNlcHRvcikge1xuICAgIGNoYWluLnB1c2goaW50ZXJjZXB0b3IuZnVsZmlsbGVkLCBpbnRlcmNlcHRvci5yZWplY3RlZCk7XG4gIH0pO1xuXG4gIHdoaWxlIChjaGFpbi5sZW5ndGgpIHtcbiAgICBwcm9taXNlID0gcHJvbWlzZS50aGVuKGNoYWluLnNoaWZ0KCksIGNoYWluLnNoaWZ0KCkpO1xuICB9XG5cbiAgcmV0dXJuIHByb21pc2U7XG59O1xuXG4vLyBQcm92aWRlIGFsaWFzZXMgZm9yIHN1cHBvcnRlZCByZXF1ZXN0IG1ldGhvZHNcbnV0aWxzLmZvckVhY2goWydkZWxldGUnLCAnZ2V0JywgJ2hlYWQnLCAnb3B0aW9ucyddLCBmdW5jdGlvbiBmb3JFYWNoTWV0aG9kTm9EYXRhKG1ldGhvZCkge1xuICAvKmVzbGludCBmdW5jLW5hbWVzOjAqL1xuICBBeGlvcy5wcm90b3R5cGVbbWV0aG9kXSA9IGZ1bmN0aW9uKHVybCwgY29uZmlnKSB7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCh1dGlscy5tZXJnZShjb25maWcgfHwge30sIHtcbiAgICAgIG1ldGhvZDogbWV0aG9kLFxuICAgICAgdXJsOiB1cmxcbiAgICB9KSk7XG4gIH07XG59KTtcblxudXRpbHMuZm9yRWFjaChbJ3Bvc3QnLCAncHV0JywgJ3BhdGNoJ10sIGZ1bmN0aW9uIGZvckVhY2hNZXRob2RXaXRoRGF0YShtZXRob2QpIHtcbiAgLyplc2xpbnQgZnVuYy1uYW1lczowKi9cbiAgQXhpb3MucHJvdG90eXBlW21ldGhvZF0gPSBmdW5jdGlvbih1cmwsIGRhdGEsIGNvbmZpZykge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3QodXRpbHMubWVyZ2UoY29uZmlnIHx8IHt9LCB7XG4gICAgICBtZXRob2Q6IG1ldGhvZCxcbiAgICAgIHVybDogdXJsLFxuICAgICAgZGF0YTogZGF0YVxuICAgIH0pKTtcbiAgfTtcbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEF4aW9zO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLy4uL3V0aWxzJyk7XG5cbmZ1bmN0aW9uIEludGVyY2VwdG9yTWFuYWdlcigpIHtcbiAgdGhpcy5oYW5kbGVycyA9IFtdO1xufVxuXG4vKipcbiAqIEFkZCBhIG5ldyBpbnRlcmNlcHRvciB0byB0aGUgc3RhY2tcbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdWxmaWxsZWQgVGhlIGZ1bmN0aW9uIHRvIGhhbmRsZSBgdGhlbmAgZm9yIGEgYFByb21pc2VgXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSByZWplY3RlZCBUaGUgZnVuY3Rpb24gdG8gaGFuZGxlIGByZWplY3RgIGZvciBhIGBQcm9taXNlYFxuICpcbiAqIEByZXR1cm4ge051bWJlcn0gQW4gSUQgdXNlZCB0byByZW1vdmUgaW50ZXJjZXB0b3IgbGF0ZXJcbiAqL1xuSW50ZXJjZXB0b3JNYW5hZ2VyLnByb3RvdHlwZS51c2UgPSBmdW5jdGlvbiB1c2UoZnVsZmlsbGVkLCByZWplY3RlZCkge1xuICB0aGlzLmhhbmRsZXJzLnB1c2goe1xuICAgIGZ1bGZpbGxlZDogZnVsZmlsbGVkLFxuICAgIHJlamVjdGVkOiByZWplY3RlZFxuICB9KTtcbiAgcmV0dXJuIHRoaXMuaGFuZGxlcnMubGVuZ3RoIC0gMTtcbn07XG5cbi8qKlxuICogUmVtb3ZlIGFuIGludGVyY2VwdG9yIGZyb20gdGhlIHN0YWNrXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IGlkIFRoZSBJRCB0aGF0IHdhcyByZXR1cm5lZCBieSBgdXNlYFxuICovXG5JbnRlcmNlcHRvck1hbmFnZXIucHJvdG90eXBlLmVqZWN0ID0gZnVuY3Rpb24gZWplY3QoaWQpIHtcbiAgaWYgKHRoaXMuaGFuZGxlcnNbaWRdKSB7XG4gICAgdGhpcy5oYW5kbGVyc1tpZF0gPSBudWxsO1xuICB9XG59O1xuXG4vKipcbiAqIEl0ZXJhdGUgb3ZlciBhbGwgdGhlIHJlZ2lzdGVyZWQgaW50ZXJjZXB0b3JzXG4gKlxuICogVGhpcyBtZXRob2QgaXMgcGFydGljdWxhcmx5IHVzZWZ1bCBmb3Igc2tpcHBpbmcgb3ZlciBhbnlcbiAqIGludGVyY2VwdG9ycyB0aGF0IG1heSBoYXZlIGJlY29tZSBgbnVsbGAgY2FsbGluZyBgZWplY3RgLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuIFRoZSBmdW5jdGlvbiB0byBjYWxsIGZvciBlYWNoIGludGVyY2VwdG9yXG4gKi9cbkludGVyY2VwdG9yTWFuYWdlci5wcm90b3R5cGUuZm9yRWFjaCA9IGZ1bmN0aW9uIGZvckVhY2goZm4pIHtcbiAgdXRpbHMuZm9yRWFjaCh0aGlzLmhhbmRsZXJzLCBmdW5jdGlvbiBmb3JFYWNoSGFuZGxlcihoKSB7XG4gICAgaWYgKGggIT09IG51bGwpIHtcbiAgICAgIGZuKGgpO1xuICAgIH1cbiAgfSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEludGVyY2VwdG9yTWFuYWdlcjtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGVuaGFuY2VFcnJvciA9IHJlcXVpcmUoJy4vZW5oYW5jZUVycm9yJyk7XG5cbi8qKlxuICogQ3JlYXRlIGFuIEVycm9yIHdpdGggdGhlIHNwZWNpZmllZCBtZXNzYWdlLCBjb25maWcsIGVycm9yIGNvZGUsIHJlcXVlc3QgYW5kIHJlc3BvbnNlLlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlIFRoZSBlcnJvciBtZXNzYWdlLlxuICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBUaGUgY29uZmlnLlxuICogQHBhcmFtIHtzdHJpbmd9IFtjb2RlXSBUaGUgZXJyb3IgY29kZSAoZm9yIGV4YW1wbGUsICdFQ09OTkFCT1JURUQnKS5cbiAqIEBwYXJhbSB7T2JqZWN0fSBbcmVxdWVzdF0gVGhlIHJlcXVlc3QuXG4gKiBAcGFyYW0ge09iamVjdH0gW3Jlc3BvbnNlXSBUaGUgcmVzcG9uc2UuXG4gKiBAcmV0dXJucyB7RXJyb3J9IFRoZSBjcmVhdGVkIGVycm9yLlxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGNyZWF0ZUVycm9yKG1lc3NhZ2UsIGNvbmZpZywgY29kZSwgcmVxdWVzdCwgcmVzcG9uc2UpIHtcbiAgdmFyIGVycm9yID0gbmV3IEVycm9yKG1lc3NhZ2UpO1xuICByZXR1cm4gZW5oYW5jZUVycm9yKGVycm9yLCBjb25maWcsIGNvZGUsIHJlcXVlc3QsIHJlc3BvbnNlKTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vLi4vdXRpbHMnKTtcbnZhciB0cmFuc2Zvcm1EYXRhID0gcmVxdWlyZSgnLi90cmFuc2Zvcm1EYXRhJyk7XG52YXIgaXNDYW5jZWwgPSByZXF1aXJlKCcuLi9jYW5jZWwvaXNDYW5jZWwnKTtcbnZhciBkZWZhdWx0cyA9IHJlcXVpcmUoJy4uL2RlZmF1bHRzJyk7XG5cbi8qKlxuICogVGhyb3dzIGEgYENhbmNlbGAgaWYgY2FuY2VsbGF0aW9uIGhhcyBiZWVuIHJlcXVlc3RlZC5cbiAqL1xuZnVuY3Rpb24gdGhyb3dJZkNhbmNlbGxhdGlvblJlcXVlc3RlZChjb25maWcpIHtcbiAgaWYgKGNvbmZpZy5jYW5jZWxUb2tlbikge1xuICAgIGNvbmZpZy5jYW5jZWxUb2tlbi50aHJvd0lmUmVxdWVzdGVkKCk7XG4gIH1cbn1cblxuLyoqXG4gKiBEaXNwYXRjaCBhIHJlcXVlc3QgdG8gdGhlIHNlcnZlciB1c2luZyB0aGUgY29uZmlndXJlZCBhZGFwdGVyLlxuICpcbiAqIEBwYXJhbSB7b2JqZWN0fSBjb25maWcgVGhlIGNvbmZpZyB0aGF0IGlzIHRvIGJlIHVzZWQgZm9yIHRoZSByZXF1ZXN0XG4gKiBAcmV0dXJucyB7UHJvbWlzZX0gVGhlIFByb21pc2UgdG8gYmUgZnVsZmlsbGVkXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZGlzcGF0Y2hSZXF1ZXN0KGNvbmZpZykge1xuICB0aHJvd0lmQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKGNvbmZpZyk7XG5cbiAgLy8gRW5zdXJlIGhlYWRlcnMgZXhpc3RcbiAgY29uZmlnLmhlYWRlcnMgPSBjb25maWcuaGVhZGVycyB8fCB7fTtcblxuICAvLyBUcmFuc2Zvcm0gcmVxdWVzdCBkYXRhXG4gIGNvbmZpZy5kYXRhID0gdHJhbnNmb3JtRGF0YShcbiAgICBjb25maWcuZGF0YSxcbiAgICBjb25maWcuaGVhZGVycyxcbiAgICBjb25maWcudHJhbnNmb3JtUmVxdWVzdFxuICApO1xuXG4gIC8vIEZsYXR0ZW4gaGVhZGVyc1xuICBjb25maWcuaGVhZGVycyA9IHV0aWxzLm1lcmdlKFxuICAgIGNvbmZpZy5oZWFkZXJzLmNvbW1vbiB8fCB7fSxcbiAgICBjb25maWcuaGVhZGVyc1tjb25maWcubWV0aG9kXSB8fCB7fSxcbiAgICBjb25maWcuaGVhZGVycyB8fCB7fVxuICApO1xuXG4gIHV0aWxzLmZvckVhY2goXG4gICAgWydkZWxldGUnLCAnZ2V0JywgJ2hlYWQnLCAncG9zdCcsICdwdXQnLCAncGF0Y2gnLCAnY29tbW9uJ10sXG4gICAgZnVuY3Rpb24gY2xlYW5IZWFkZXJDb25maWcobWV0aG9kKSB7XG4gICAgICBkZWxldGUgY29uZmlnLmhlYWRlcnNbbWV0aG9kXTtcbiAgICB9XG4gICk7XG5cbiAgdmFyIGFkYXB0ZXIgPSBjb25maWcuYWRhcHRlciB8fCBkZWZhdWx0cy5hZGFwdGVyO1xuXG4gIHJldHVybiBhZGFwdGVyKGNvbmZpZykudGhlbihmdW5jdGlvbiBvbkFkYXB0ZXJSZXNvbHV0aW9uKHJlc3BvbnNlKSB7XG4gICAgdGhyb3dJZkNhbmNlbGxhdGlvblJlcXVlc3RlZChjb25maWcpO1xuXG4gICAgLy8gVHJhbnNmb3JtIHJlc3BvbnNlIGRhdGFcbiAgICByZXNwb25zZS5kYXRhID0gdHJhbnNmb3JtRGF0YShcbiAgICAgIHJlc3BvbnNlLmRhdGEsXG4gICAgICByZXNwb25zZS5oZWFkZXJzLFxuICAgICAgY29uZmlnLnRyYW5zZm9ybVJlc3BvbnNlXG4gICAgKTtcblxuICAgIHJldHVybiByZXNwb25zZTtcbiAgfSwgZnVuY3Rpb24gb25BZGFwdGVyUmVqZWN0aW9uKHJlYXNvbikge1xuICAgIGlmICghaXNDYW5jZWwocmVhc29uKSkge1xuICAgICAgdGhyb3dJZkNhbmNlbGxhdGlvblJlcXVlc3RlZChjb25maWcpO1xuXG4gICAgICAvLyBUcmFuc2Zvcm0gcmVzcG9uc2UgZGF0YVxuICAgICAgaWYgKHJlYXNvbiAmJiByZWFzb24ucmVzcG9uc2UpIHtcbiAgICAgICAgcmVhc29uLnJlc3BvbnNlLmRhdGEgPSB0cmFuc2Zvcm1EYXRhKFxuICAgICAgICAgIHJlYXNvbi5yZXNwb25zZS5kYXRhLFxuICAgICAgICAgIHJlYXNvbi5yZXNwb25zZS5oZWFkZXJzLFxuICAgICAgICAgIGNvbmZpZy50cmFuc2Zvcm1SZXNwb25zZVxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBQcm9taXNlLnJlamVjdChyZWFzb24pO1xuICB9KTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qKlxuICogVXBkYXRlIGFuIEVycm9yIHdpdGggdGhlIHNwZWNpZmllZCBjb25maWcsIGVycm9yIGNvZGUsIGFuZCByZXNwb25zZS5cbiAqXG4gKiBAcGFyYW0ge0Vycm9yfSBlcnJvciBUaGUgZXJyb3IgdG8gdXBkYXRlLlxuICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBUaGUgY29uZmlnLlxuICogQHBhcmFtIHtzdHJpbmd9IFtjb2RlXSBUaGUgZXJyb3IgY29kZSAoZm9yIGV4YW1wbGUsICdFQ09OTkFCT1JURUQnKS5cbiAqIEBwYXJhbSB7T2JqZWN0fSBbcmVxdWVzdF0gVGhlIHJlcXVlc3QuXG4gKiBAcGFyYW0ge09iamVjdH0gW3Jlc3BvbnNlXSBUaGUgcmVzcG9uc2UuXG4gKiBAcmV0dXJucyB7RXJyb3J9IFRoZSBlcnJvci5cbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBlbmhhbmNlRXJyb3IoZXJyb3IsIGNvbmZpZywgY29kZSwgcmVxdWVzdCwgcmVzcG9uc2UpIHtcbiAgZXJyb3IuY29uZmlnID0gY29uZmlnO1xuICBpZiAoY29kZSkge1xuICAgIGVycm9yLmNvZGUgPSBjb2RlO1xuICB9XG4gIGVycm9yLnJlcXVlc3QgPSByZXF1ZXN0O1xuICBlcnJvci5yZXNwb25zZSA9IHJlc3BvbnNlO1xuICByZXR1cm4gZXJyb3I7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgY3JlYXRlRXJyb3IgPSByZXF1aXJlKCcuL2NyZWF0ZUVycm9yJyk7XG5cbi8qKlxuICogUmVzb2x2ZSBvciByZWplY3QgYSBQcm9taXNlIGJhc2VkIG9uIHJlc3BvbnNlIHN0YXR1cy5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSByZXNvbHZlIEEgZnVuY3Rpb24gdGhhdCByZXNvbHZlcyB0aGUgcHJvbWlzZS5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IHJlamVjdCBBIGZ1bmN0aW9uIHRoYXQgcmVqZWN0cyB0aGUgcHJvbWlzZS5cbiAqIEBwYXJhbSB7b2JqZWN0fSByZXNwb25zZSBUaGUgcmVzcG9uc2UuXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gc2V0dGxlKHJlc29sdmUsIHJlamVjdCwgcmVzcG9uc2UpIHtcbiAgdmFyIHZhbGlkYXRlU3RhdHVzID0gcmVzcG9uc2UuY29uZmlnLnZhbGlkYXRlU3RhdHVzO1xuICAvLyBOb3RlOiBzdGF0dXMgaXMgbm90IGV4cG9zZWQgYnkgWERvbWFpblJlcXVlc3RcbiAgaWYgKCFyZXNwb25zZS5zdGF0dXMgfHwgIXZhbGlkYXRlU3RhdHVzIHx8IHZhbGlkYXRlU3RhdHVzKHJlc3BvbnNlLnN0YXR1cykpIHtcbiAgICByZXNvbHZlKHJlc3BvbnNlKTtcbiAgfSBlbHNlIHtcbiAgICByZWplY3QoY3JlYXRlRXJyb3IoXG4gICAgICAnUmVxdWVzdCBmYWlsZWQgd2l0aCBzdGF0dXMgY29kZSAnICsgcmVzcG9uc2Uuc3RhdHVzLFxuICAgICAgcmVzcG9uc2UuY29uZmlnLFxuICAgICAgbnVsbCxcbiAgICAgIHJlc3BvbnNlLnJlcXVlc3QsXG4gICAgICByZXNwb25zZVxuICAgICkpO1xuICB9XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLy4uL3V0aWxzJyk7XG5cbi8qKlxuICogVHJhbnNmb3JtIHRoZSBkYXRhIGZvciBhIHJlcXVlc3Qgb3IgYSByZXNwb25zZVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fFN0cmluZ30gZGF0YSBUaGUgZGF0YSB0byBiZSB0cmFuc2Zvcm1lZFxuICogQHBhcmFtIHtBcnJheX0gaGVhZGVycyBUaGUgaGVhZGVycyBmb3IgdGhlIHJlcXVlc3Qgb3IgcmVzcG9uc2VcbiAqIEBwYXJhbSB7QXJyYXl8RnVuY3Rpb259IGZucyBBIHNpbmdsZSBmdW5jdGlvbiBvciBBcnJheSBvZiBmdW5jdGlvbnNcbiAqIEByZXR1cm5zIHsqfSBUaGUgcmVzdWx0aW5nIHRyYW5zZm9ybWVkIGRhdGFcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiB0cmFuc2Zvcm1EYXRhKGRhdGEsIGhlYWRlcnMsIGZucykge1xuICAvKmVzbGludCBuby1wYXJhbS1yZWFzc2lnbjowKi9cbiAgdXRpbHMuZm9yRWFjaChmbnMsIGZ1bmN0aW9uIHRyYW5zZm9ybShmbikge1xuICAgIGRhdGEgPSBmbihkYXRhLCBoZWFkZXJzKTtcbiAgfSk7XG5cbiAgcmV0dXJuIGRhdGE7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG52YXIgbm9ybWFsaXplSGVhZGVyTmFtZSA9IHJlcXVpcmUoJy4vaGVscGVycy9ub3JtYWxpemVIZWFkZXJOYW1lJyk7XG5cbnZhciBERUZBVUxUX0NPTlRFTlRfVFlQRSA9IHtcbiAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQnXG59O1xuXG5mdW5jdGlvbiBzZXRDb250ZW50VHlwZUlmVW5zZXQoaGVhZGVycywgdmFsdWUpIHtcbiAgaWYgKCF1dGlscy5pc1VuZGVmaW5lZChoZWFkZXJzKSAmJiB1dGlscy5pc1VuZGVmaW5lZChoZWFkZXJzWydDb250ZW50LVR5cGUnXSkpIHtcbiAgICBoZWFkZXJzWydDb250ZW50LVR5cGUnXSA9IHZhbHVlO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldERlZmF1bHRBZGFwdGVyKCkge1xuICB2YXIgYWRhcHRlcjtcbiAgaWYgKHR5cGVvZiBYTUxIdHRwUmVxdWVzdCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAvLyBGb3IgYnJvd3NlcnMgdXNlIFhIUiBhZGFwdGVyXG4gICAgYWRhcHRlciA9IHJlcXVpcmUoJy4vYWRhcHRlcnMveGhyJyk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIHByb2Nlc3MgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgLy8gRm9yIG5vZGUgdXNlIEhUVFAgYWRhcHRlclxuICAgIGFkYXB0ZXIgPSByZXF1aXJlKCcuL2FkYXB0ZXJzL2h0dHAnKTtcbiAgfVxuICByZXR1cm4gYWRhcHRlcjtcbn1cblxudmFyIGRlZmF1bHRzID0ge1xuICBhZGFwdGVyOiBnZXREZWZhdWx0QWRhcHRlcigpLFxuXG4gIHRyYW5zZm9ybVJlcXVlc3Q6IFtmdW5jdGlvbiB0cmFuc2Zvcm1SZXF1ZXN0KGRhdGEsIGhlYWRlcnMpIHtcbiAgICBub3JtYWxpemVIZWFkZXJOYW1lKGhlYWRlcnMsICdDb250ZW50LVR5cGUnKTtcbiAgICBpZiAodXRpbHMuaXNGb3JtRGF0YShkYXRhKSB8fFxuICAgICAgdXRpbHMuaXNBcnJheUJ1ZmZlcihkYXRhKSB8fFxuICAgICAgdXRpbHMuaXNCdWZmZXIoZGF0YSkgfHxcbiAgICAgIHV0aWxzLmlzU3RyZWFtKGRhdGEpIHx8XG4gICAgICB1dGlscy5pc0ZpbGUoZGF0YSkgfHxcbiAgICAgIHV0aWxzLmlzQmxvYihkYXRhKVxuICAgICkge1xuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfVxuICAgIGlmICh1dGlscy5pc0FycmF5QnVmZmVyVmlldyhkYXRhKSkge1xuICAgICAgcmV0dXJuIGRhdGEuYnVmZmVyO1xuICAgIH1cbiAgICBpZiAodXRpbHMuaXNVUkxTZWFyY2hQYXJhbXMoZGF0YSkpIHtcbiAgICAgIHNldENvbnRlbnRUeXBlSWZVbnNldChoZWFkZXJzLCAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkO2NoYXJzZXQ9dXRmLTgnKTtcbiAgICAgIHJldHVybiBkYXRhLnRvU3RyaW5nKCk7XG4gICAgfVxuICAgIGlmICh1dGlscy5pc09iamVjdChkYXRhKSkge1xuICAgICAgc2V0Q29udGVudFR5cGVJZlVuc2V0KGhlYWRlcnMsICdhcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ9dXRmLTgnKTtcbiAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShkYXRhKTtcbiAgICB9XG4gICAgcmV0dXJuIGRhdGE7XG4gIH1dLFxuXG4gIHRyYW5zZm9ybVJlc3BvbnNlOiBbZnVuY3Rpb24gdHJhbnNmb3JtUmVzcG9uc2UoZGF0YSkge1xuICAgIC8qZXNsaW50IG5vLXBhcmFtLXJlYXNzaWduOjAqL1xuICAgIGlmICh0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGRhdGEgPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgfSBjYXRjaCAoZSkgeyAvKiBJZ25vcmUgKi8gfVxuICAgIH1cbiAgICByZXR1cm4gZGF0YTtcbiAgfV0sXG5cbiAgdGltZW91dDogMCxcblxuICB4c3JmQ29va2llTmFtZTogJ1hTUkYtVE9LRU4nLFxuICB4c3JmSGVhZGVyTmFtZTogJ1gtWFNSRi1UT0tFTicsXG5cbiAgbWF4Q29udGVudExlbmd0aDogLTEsXG5cbiAgdmFsaWRhdGVTdGF0dXM6IGZ1bmN0aW9uIHZhbGlkYXRlU3RhdHVzKHN0YXR1cykge1xuICAgIHJldHVybiBzdGF0dXMgPj0gMjAwICYmIHN0YXR1cyA8IDMwMDtcbiAgfVxufTtcblxuZGVmYXVsdHMuaGVhZGVycyA9IHtcbiAgY29tbW9uOiB7XG4gICAgJ0FjY2VwdCc6ICdhcHBsaWNhdGlvbi9qc29uLCB0ZXh0L3BsYWluLCAqLyonXG4gIH1cbn07XG5cbnV0aWxzLmZvckVhY2goWydkZWxldGUnLCAnZ2V0JywgJ2hlYWQnXSwgZnVuY3Rpb24gZm9yRWFjaE1ldGhvZE5vRGF0YShtZXRob2QpIHtcbiAgZGVmYXVsdHMuaGVhZGVyc1ttZXRob2RdID0ge307XG59KTtcblxudXRpbHMuZm9yRWFjaChbJ3Bvc3QnLCAncHV0JywgJ3BhdGNoJ10sIGZ1bmN0aW9uIGZvckVhY2hNZXRob2RXaXRoRGF0YShtZXRob2QpIHtcbiAgZGVmYXVsdHMuaGVhZGVyc1ttZXRob2RdID0gdXRpbHMubWVyZ2UoREVGQVVMVF9DT05URU5UX1RZUEUpO1xufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gZGVmYXVsdHM7XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gYmluZChmbiwgdGhpc0FyZykge1xuICByZXR1cm4gZnVuY3Rpb24gd3JhcCgpIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIGFyZ3NbaV0gPSBhcmd1bWVudHNbaV07XG4gICAgfVxuICAgIHJldHVybiBmbi5hcHBseSh0aGlzQXJnLCBhcmdzKTtcbiAgfTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbi8vIGJ0b2EgcG9seWZpbGwgZm9yIElFPDEwIGNvdXJ0ZXN5IGh0dHBzOi8vZ2l0aHViLmNvbS9kYXZpZGNoYW1iZXJzL0Jhc2U2NC5qc1xuXG52YXIgY2hhcnMgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLz0nO1xuXG5mdW5jdGlvbiBFKCkge1xuICB0aGlzLm1lc3NhZ2UgPSAnU3RyaW5nIGNvbnRhaW5zIGFuIGludmFsaWQgY2hhcmFjdGVyJztcbn1cbkUucHJvdG90eXBlID0gbmV3IEVycm9yO1xuRS5wcm90b3R5cGUuY29kZSA9IDU7XG5FLnByb3RvdHlwZS5uYW1lID0gJ0ludmFsaWRDaGFyYWN0ZXJFcnJvcic7XG5cbmZ1bmN0aW9uIGJ0b2EoaW5wdXQpIHtcbiAgdmFyIHN0ciA9IFN0cmluZyhpbnB1dCk7XG4gIHZhciBvdXRwdXQgPSAnJztcbiAgZm9yIChcbiAgICAvLyBpbml0aWFsaXplIHJlc3VsdCBhbmQgY291bnRlclxuICAgIHZhciBibG9jaywgY2hhckNvZGUsIGlkeCA9IDAsIG1hcCA9IGNoYXJzO1xuICAgIC8vIGlmIHRoZSBuZXh0IHN0ciBpbmRleCBkb2VzIG5vdCBleGlzdDpcbiAgICAvLyAgIGNoYW5nZSB0aGUgbWFwcGluZyB0YWJsZSB0byBcIj1cIlxuICAgIC8vICAgY2hlY2sgaWYgZCBoYXMgbm8gZnJhY3Rpb25hbCBkaWdpdHNcbiAgICBzdHIuY2hhckF0KGlkeCB8IDApIHx8IChtYXAgPSAnPScsIGlkeCAlIDEpO1xuICAgIC8vIFwiOCAtIGlkeCAlIDEgKiA4XCIgZ2VuZXJhdGVzIHRoZSBzZXF1ZW5jZSAyLCA0LCA2LCA4XG4gICAgb3V0cHV0ICs9IG1hcC5jaGFyQXQoNjMgJiBibG9jayA+PiA4IC0gaWR4ICUgMSAqIDgpXG4gICkge1xuICAgIGNoYXJDb2RlID0gc3RyLmNoYXJDb2RlQXQoaWR4ICs9IDMgLyA0KTtcbiAgICBpZiAoY2hhckNvZGUgPiAweEZGKSB7XG4gICAgICB0aHJvdyBuZXcgRSgpO1xuICAgIH1cbiAgICBibG9jayA9IGJsb2NrIDw8IDggfCBjaGFyQ29kZTtcbiAgfVxuICByZXR1cm4gb3V0cHV0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJ0b2E7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vLi4vdXRpbHMnKTtcblxuZnVuY3Rpb24gZW5jb2RlKHZhbCkge1xuICByZXR1cm4gZW5jb2RlVVJJQ29tcG9uZW50KHZhbCkuXG4gICAgcmVwbGFjZSgvJTQwL2dpLCAnQCcpLlxuICAgIHJlcGxhY2UoLyUzQS9naSwgJzonKS5cbiAgICByZXBsYWNlKC8lMjQvZywgJyQnKS5cbiAgICByZXBsYWNlKC8lMkMvZ2ksICcsJykuXG4gICAgcmVwbGFjZSgvJTIwL2csICcrJykuXG4gICAgcmVwbGFjZSgvJTVCL2dpLCAnWycpLlxuICAgIHJlcGxhY2UoLyU1RC9naSwgJ10nKTtcbn1cblxuLyoqXG4gKiBCdWlsZCBhIFVSTCBieSBhcHBlbmRpbmcgcGFyYW1zIHRvIHRoZSBlbmRcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdXJsIFRoZSBiYXNlIG9mIHRoZSB1cmwgKGUuZy4sIGh0dHA6Ly93d3cuZ29vZ2xlLmNvbSlcbiAqIEBwYXJhbSB7b2JqZWN0fSBbcGFyYW1zXSBUaGUgcGFyYW1zIHRvIGJlIGFwcGVuZGVkXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgZm9ybWF0dGVkIHVybFxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGJ1aWxkVVJMKHVybCwgcGFyYW1zLCBwYXJhbXNTZXJpYWxpemVyKSB7XG4gIC8qZXNsaW50IG5vLXBhcmFtLXJlYXNzaWduOjAqL1xuICBpZiAoIXBhcmFtcykge1xuICAgIHJldHVybiB1cmw7XG4gIH1cblxuICB2YXIgc2VyaWFsaXplZFBhcmFtcztcbiAgaWYgKHBhcmFtc1NlcmlhbGl6ZXIpIHtcbiAgICBzZXJpYWxpemVkUGFyYW1zID0gcGFyYW1zU2VyaWFsaXplcihwYXJhbXMpO1xuICB9IGVsc2UgaWYgKHV0aWxzLmlzVVJMU2VhcmNoUGFyYW1zKHBhcmFtcykpIHtcbiAgICBzZXJpYWxpemVkUGFyYW1zID0gcGFyYW1zLnRvU3RyaW5nKCk7XG4gIH0gZWxzZSB7XG4gICAgdmFyIHBhcnRzID0gW107XG5cbiAgICB1dGlscy5mb3JFYWNoKHBhcmFtcywgZnVuY3Rpb24gc2VyaWFsaXplKHZhbCwga2V5KSB7XG4gICAgICBpZiAodmFsID09PSBudWxsIHx8IHR5cGVvZiB2YWwgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKHV0aWxzLmlzQXJyYXkodmFsKSkge1xuICAgICAgICBrZXkgPSBrZXkgKyAnW10nO1xuICAgICAgfVxuXG4gICAgICBpZiAoIXV0aWxzLmlzQXJyYXkodmFsKSkge1xuICAgICAgICB2YWwgPSBbdmFsXTtcbiAgICAgIH1cblxuICAgICAgdXRpbHMuZm9yRWFjaCh2YWwsIGZ1bmN0aW9uIHBhcnNlVmFsdWUodikge1xuICAgICAgICBpZiAodXRpbHMuaXNEYXRlKHYpKSB7XG4gICAgICAgICAgdiA9IHYudG9JU09TdHJpbmcoKTtcbiAgICAgICAgfSBlbHNlIGlmICh1dGlscy5pc09iamVjdCh2KSkge1xuICAgICAgICAgIHYgPSBKU09OLnN0cmluZ2lmeSh2KTtcbiAgICAgICAgfVxuICAgICAgICBwYXJ0cy5wdXNoKGVuY29kZShrZXkpICsgJz0nICsgZW5jb2RlKHYpKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgc2VyaWFsaXplZFBhcmFtcyA9IHBhcnRzLmpvaW4oJyYnKTtcbiAgfVxuXG4gIGlmIChzZXJpYWxpemVkUGFyYW1zKSB7XG4gICAgdXJsICs9ICh1cmwuaW5kZXhPZignPycpID09PSAtMSA/ICc/JyA6ICcmJykgKyBzZXJpYWxpemVkUGFyYW1zO1xuICB9XG5cbiAgcmV0dXJuIHVybDtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyBVUkwgYnkgY29tYmluaW5nIHRoZSBzcGVjaWZpZWQgVVJMc1xuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBiYXNlVVJMIFRoZSBiYXNlIFVSTFxuICogQHBhcmFtIHtzdHJpbmd9IHJlbGF0aXZlVVJMIFRoZSByZWxhdGl2ZSBVUkxcbiAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBjb21iaW5lZCBVUkxcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBjb21iaW5lVVJMcyhiYXNlVVJMLCByZWxhdGl2ZVVSTCkge1xuICByZXR1cm4gcmVsYXRpdmVVUkxcbiAgICA/IGJhc2VVUkwucmVwbGFjZSgvXFwvKyQvLCAnJykgKyAnLycgKyByZWxhdGl2ZVVSTC5yZXBsYWNlKC9eXFwvKy8sICcnKVxuICAgIDogYmFzZVVSTDtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vLi4vdXRpbHMnKTtcblxubW9kdWxlLmV4cG9ydHMgPSAoXG4gIHV0aWxzLmlzU3RhbmRhcmRCcm93c2VyRW52KCkgP1xuXG4gIC8vIFN0YW5kYXJkIGJyb3dzZXIgZW52cyBzdXBwb3J0IGRvY3VtZW50LmNvb2tpZVxuICAoZnVuY3Rpb24gc3RhbmRhcmRCcm93c2VyRW52KCkge1xuICAgIHJldHVybiB7XG4gICAgICB3cml0ZTogZnVuY3Rpb24gd3JpdGUobmFtZSwgdmFsdWUsIGV4cGlyZXMsIHBhdGgsIGRvbWFpbiwgc2VjdXJlKSB7XG4gICAgICAgIHZhciBjb29raWUgPSBbXTtcbiAgICAgICAgY29va2llLnB1c2gobmFtZSArICc9JyArIGVuY29kZVVSSUNvbXBvbmVudCh2YWx1ZSkpO1xuXG4gICAgICAgIGlmICh1dGlscy5pc051bWJlcihleHBpcmVzKSkge1xuICAgICAgICAgIGNvb2tpZS5wdXNoKCdleHBpcmVzPScgKyBuZXcgRGF0ZShleHBpcmVzKS50b0dNVFN0cmluZygpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh1dGlscy5pc1N0cmluZyhwYXRoKSkge1xuICAgICAgICAgIGNvb2tpZS5wdXNoKCdwYXRoPScgKyBwYXRoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh1dGlscy5pc1N0cmluZyhkb21haW4pKSB7XG4gICAgICAgICAgY29va2llLnB1c2goJ2RvbWFpbj0nICsgZG9tYWluKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzZWN1cmUgPT09IHRydWUpIHtcbiAgICAgICAgICBjb29raWUucHVzaCgnc2VjdXJlJyk7XG4gICAgICAgIH1cblxuICAgICAgICBkb2N1bWVudC5jb29raWUgPSBjb29raWUuam9pbignOyAnKTtcbiAgICAgIH0sXG5cbiAgICAgIHJlYWQ6IGZ1bmN0aW9uIHJlYWQobmFtZSkge1xuICAgICAgICB2YXIgbWF0Y2ggPSBkb2N1bWVudC5jb29raWUubWF0Y2gobmV3IFJlZ0V4cCgnKF58O1xcXFxzKikoJyArIG5hbWUgKyAnKT0oW147XSopJykpO1xuICAgICAgICByZXR1cm4gKG1hdGNoID8gZGVjb2RlVVJJQ29tcG9uZW50KG1hdGNoWzNdKSA6IG51bGwpO1xuICAgICAgfSxcblxuICAgICAgcmVtb3ZlOiBmdW5jdGlvbiByZW1vdmUobmFtZSkge1xuICAgICAgICB0aGlzLndyaXRlKG5hbWUsICcnLCBEYXRlLm5vdygpIC0gODY0MDAwMDApO1xuICAgICAgfVxuICAgIH07XG4gIH0pKCkgOlxuXG4gIC8vIE5vbiBzdGFuZGFyZCBicm93c2VyIGVudiAod2ViIHdvcmtlcnMsIHJlYWN0LW5hdGl2ZSkgbGFjayBuZWVkZWQgc3VwcG9ydC5cbiAgKGZ1bmN0aW9uIG5vblN0YW5kYXJkQnJvd3NlckVudigpIHtcbiAgICByZXR1cm4ge1xuICAgICAgd3JpdGU6IGZ1bmN0aW9uIHdyaXRlKCkge30sXG4gICAgICByZWFkOiBmdW5jdGlvbiByZWFkKCkgeyByZXR1cm4gbnVsbDsgfSxcbiAgICAgIHJlbW92ZTogZnVuY3Rpb24gcmVtb3ZlKCkge31cbiAgICB9O1xuICB9KSgpXG4pO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIERldGVybWluZXMgd2hldGhlciB0aGUgc3BlY2lmaWVkIFVSTCBpcyBhYnNvbHV0ZVxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgVGhlIFVSTCB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgc3BlY2lmaWVkIFVSTCBpcyBhYnNvbHV0ZSwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaXNBYnNvbHV0ZVVSTCh1cmwpIHtcbiAgLy8gQSBVUkwgaXMgY29uc2lkZXJlZCBhYnNvbHV0ZSBpZiBpdCBiZWdpbnMgd2l0aCBcIjxzY2hlbWU+Oi8vXCIgb3IgXCIvL1wiIChwcm90b2NvbC1yZWxhdGl2ZSBVUkwpLlxuICAvLyBSRkMgMzk4NiBkZWZpbmVzIHNjaGVtZSBuYW1lIGFzIGEgc2VxdWVuY2Ugb2YgY2hhcmFjdGVycyBiZWdpbm5pbmcgd2l0aCBhIGxldHRlciBhbmQgZm9sbG93ZWRcbiAgLy8gYnkgYW55IGNvbWJpbmF0aW9uIG9mIGxldHRlcnMsIGRpZ2l0cywgcGx1cywgcGVyaW9kLCBvciBoeXBoZW4uXG4gIHJldHVybiAvXihbYS16XVthLXpcXGRcXCtcXC1cXC5dKjopP1xcL1xcLy9pLnRlc3QodXJsKTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vLi4vdXRpbHMnKTtcblxubW9kdWxlLmV4cG9ydHMgPSAoXG4gIHV0aWxzLmlzU3RhbmRhcmRCcm93c2VyRW52KCkgP1xuXG4gIC8vIFN0YW5kYXJkIGJyb3dzZXIgZW52cyBoYXZlIGZ1bGwgc3VwcG9ydCBvZiB0aGUgQVBJcyBuZWVkZWQgdG8gdGVzdFxuICAvLyB3aGV0aGVyIHRoZSByZXF1ZXN0IFVSTCBpcyBvZiB0aGUgc2FtZSBvcmlnaW4gYXMgY3VycmVudCBsb2NhdGlvbi5cbiAgKGZ1bmN0aW9uIHN0YW5kYXJkQnJvd3NlckVudigpIHtcbiAgICB2YXIgbXNpZSA9IC8obXNpZXx0cmlkZW50KS9pLnRlc3QobmF2aWdhdG9yLnVzZXJBZ2VudCk7XG4gICAgdmFyIHVybFBhcnNpbmdOb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuICAgIHZhciBvcmlnaW5VUkw7XG5cbiAgICAvKipcbiAgICAqIFBhcnNlIGEgVVJMIHRvIGRpc2NvdmVyIGl0J3MgY29tcG9uZW50c1xuICAgICpcbiAgICAqIEBwYXJhbSB7U3RyaW5nfSB1cmwgVGhlIFVSTCB0byBiZSBwYXJzZWRcbiAgICAqIEByZXR1cm5zIHtPYmplY3R9XG4gICAgKi9cbiAgICBmdW5jdGlvbiByZXNvbHZlVVJMKHVybCkge1xuICAgICAgdmFyIGhyZWYgPSB1cmw7XG5cbiAgICAgIGlmIChtc2llKSB7XG4gICAgICAgIC8vIElFIG5lZWRzIGF0dHJpYnV0ZSBzZXQgdHdpY2UgdG8gbm9ybWFsaXplIHByb3BlcnRpZXNcbiAgICAgICAgdXJsUGFyc2luZ05vZGUuc2V0QXR0cmlidXRlKCdocmVmJywgaHJlZik7XG4gICAgICAgIGhyZWYgPSB1cmxQYXJzaW5nTm9kZS5ocmVmO1xuICAgICAgfVxuXG4gICAgICB1cmxQYXJzaW5nTm9kZS5zZXRBdHRyaWJ1dGUoJ2hyZWYnLCBocmVmKTtcblxuICAgICAgLy8gdXJsUGFyc2luZ05vZGUgcHJvdmlkZXMgdGhlIFVybFV0aWxzIGludGVyZmFjZSAtIGh0dHA6Ly91cmwuc3BlYy53aGF0d2cub3JnLyN1cmx1dGlsc1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgaHJlZjogdXJsUGFyc2luZ05vZGUuaHJlZixcbiAgICAgICAgcHJvdG9jb2w6IHVybFBhcnNpbmdOb2RlLnByb3RvY29sID8gdXJsUGFyc2luZ05vZGUucHJvdG9jb2wucmVwbGFjZSgvOiQvLCAnJykgOiAnJyxcbiAgICAgICAgaG9zdDogdXJsUGFyc2luZ05vZGUuaG9zdCxcbiAgICAgICAgc2VhcmNoOiB1cmxQYXJzaW5nTm9kZS5zZWFyY2ggPyB1cmxQYXJzaW5nTm9kZS5zZWFyY2gucmVwbGFjZSgvXlxcPy8sICcnKSA6ICcnLFxuICAgICAgICBoYXNoOiB1cmxQYXJzaW5nTm9kZS5oYXNoID8gdXJsUGFyc2luZ05vZGUuaGFzaC5yZXBsYWNlKC9eIy8sICcnKSA6ICcnLFxuICAgICAgICBob3N0bmFtZTogdXJsUGFyc2luZ05vZGUuaG9zdG5hbWUsXG4gICAgICAgIHBvcnQ6IHVybFBhcnNpbmdOb2RlLnBvcnQsXG4gICAgICAgIHBhdGhuYW1lOiAodXJsUGFyc2luZ05vZGUucGF0aG5hbWUuY2hhckF0KDApID09PSAnLycpID9cbiAgICAgICAgICAgICAgICAgIHVybFBhcnNpbmdOb2RlLnBhdGhuYW1lIDpcbiAgICAgICAgICAgICAgICAgICcvJyArIHVybFBhcnNpbmdOb2RlLnBhdGhuYW1lXG4gICAgICB9O1xuICAgIH1cblxuICAgIG9yaWdpblVSTCA9IHJlc29sdmVVUkwod2luZG93LmxvY2F0aW9uLmhyZWYpO1xuXG4gICAgLyoqXG4gICAgKiBEZXRlcm1pbmUgaWYgYSBVUkwgc2hhcmVzIHRoZSBzYW1lIG9yaWdpbiBhcyB0aGUgY3VycmVudCBsb2NhdGlvblxuICAgICpcbiAgICAqIEBwYXJhbSB7U3RyaW5nfSByZXF1ZXN0VVJMIFRoZSBVUkwgdG8gdGVzdFxuICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgVVJMIHNoYXJlcyB0aGUgc2FtZSBvcmlnaW4sIG90aGVyd2lzZSBmYWxzZVxuICAgICovXG4gICAgcmV0dXJuIGZ1bmN0aW9uIGlzVVJMU2FtZU9yaWdpbihyZXF1ZXN0VVJMKSB7XG4gICAgICB2YXIgcGFyc2VkID0gKHV0aWxzLmlzU3RyaW5nKHJlcXVlc3RVUkwpKSA/IHJlc29sdmVVUkwocmVxdWVzdFVSTCkgOiByZXF1ZXN0VVJMO1xuICAgICAgcmV0dXJuIChwYXJzZWQucHJvdG9jb2wgPT09IG9yaWdpblVSTC5wcm90b2NvbCAmJlxuICAgICAgICAgICAgcGFyc2VkLmhvc3QgPT09IG9yaWdpblVSTC5ob3N0KTtcbiAgICB9O1xuICB9KSgpIDpcblxuICAvLyBOb24gc3RhbmRhcmQgYnJvd3NlciBlbnZzICh3ZWIgd29ya2VycywgcmVhY3QtbmF0aXZlKSBsYWNrIG5lZWRlZCBzdXBwb3J0LlxuICAoZnVuY3Rpb24gbm9uU3RhbmRhcmRCcm93c2VyRW52KCkge1xuICAgIHJldHVybiBmdW5jdGlvbiBpc1VSTFNhbWVPcmlnaW4oKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9O1xuICB9KSgpXG4pO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLi91dGlscycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIG5vcm1hbGl6ZUhlYWRlck5hbWUoaGVhZGVycywgbm9ybWFsaXplZE5hbWUpIHtcbiAgdXRpbHMuZm9yRWFjaChoZWFkZXJzLCBmdW5jdGlvbiBwcm9jZXNzSGVhZGVyKHZhbHVlLCBuYW1lKSB7XG4gICAgaWYgKG5hbWUgIT09IG5vcm1hbGl6ZWROYW1lICYmIG5hbWUudG9VcHBlckNhc2UoKSA9PT0gbm9ybWFsaXplZE5hbWUudG9VcHBlckNhc2UoKSkge1xuICAgICAgaGVhZGVyc1tub3JtYWxpemVkTmFtZV0gPSB2YWx1ZTtcbiAgICAgIGRlbGV0ZSBoZWFkZXJzW25hbWVdO1xuICAgIH1cbiAgfSk7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLy4uL3V0aWxzJyk7XG5cbi8qKlxuICogUGFyc2UgaGVhZGVycyBpbnRvIGFuIG9iamVjdFxuICpcbiAqIGBgYFxuICogRGF0ZTogV2VkLCAyNyBBdWcgMjAxNCAwODo1ODo0OSBHTVRcbiAqIENvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvblxuICogQ29ubmVjdGlvbjoga2VlcC1hbGl2ZVxuICogVHJhbnNmZXItRW5jb2Rpbmc6IGNodW5rZWRcbiAqIGBgYFxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBoZWFkZXJzIEhlYWRlcnMgbmVlZGluZyB0byBiZSBwYXJzZWRcbiAqIEByZXR1cm5zIHtPYmplY3R9IEhlYWRlcnMgcGFyc2VkIGludG8gYW4gb2JqZWN0XG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gcGFyc2VIZWFkZXJzKGhlYWRlcnMpIHtcbiAgdmFyIHBhcnNlZCA9IHt9O1xuICB2YXIga2V5O1xuICB2YXIgdmFsO1xuICB2YXIgaTtcblxuICBpZiAoIWhlYWRlcnMpIHsgcmV0dXJuIHBhcnNlZDsgfVxuXG4gIHV0aWxzLmZvckVhY2goaGVhZGVycy5zcGxpdCgnXFxuJyksIGZ1bmN0aW9uIHBhcnNlcihsaW5lKSB7XG4gICAgaSA9IGxpbmUuaW5kZXhPZignOicpO1xuICAgIGtleSA9IHV0aWxzLnRyaW0obGluZS5zdWJzdHIoMCwgaSkpLnRvTG93ZXJDYXNlKCk7XG4gICAgdmFsID0gdXRpbHMudHJpbShsaW5lLnN1YnN0cihpICsgMSkpO1xuXG4gICAgaWYgKGtleSkge1xuICAgICAgcGFyc2VkW2tleV0gPSBwYXJzZWRba2V5XSA/IHBhcnNlZFtrZXldICsgJywgJyArIHZhbCA6IHZhbDtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBwYXJzZWQ7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIFN5bnRhY3RpYyBzdWdhciBmb3IgaW52b2tpbmcgYSBmdW5jdGlvbiBhbmQgZXhwYW5kaW5nIGFuIGFycmF5IGZvciBhcmd1bWVudHMuXG4gKlxuICogQ29tbW9uIHVzZSBjYXNlIHdvdWxkIGJlIHRvIHVzZSBgRnVuY3Rpb24ucHJvdG90eXBlLmFwcGx5YC5cbiAqXG4gKiAgYGBganNcbiAqICBmdW5jdGlvbiBmKHgsIHksIHopIHt9XG4gKiAgdmFyIGFyZ3MgPSBbMSwgMiwgM107XG4gKiAgZi5hcHBseShudWxsLCBhcmdzKTtcbiAqICBgYGBcbiAqXG4gKiBXaXRoIGBzcHJlYWRgIHRoaXMgZXhhbXBsZSBjYW4gYmUgcmUtd3JpdHRlbi5cbiAqXG4gKiAgYGBganNcbiAqICBzcHJlYWQoZnVuY3Rpb24oeCwgeSwgeikge30pKFsxLCAyLCAzXSk7XG4gKiAgYGBgXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAqIEByZXR1cm5zIHtGdW5jdGlvbn1cbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBzcHJlYWQoY2FsbGJhY2spIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIHdyYXAoYXJyKSB7XG4gICAgcmV0dXJuIGNhbGxiYWNrLmFwcGx5KG51bGwsIGFycik7XG4gIH07XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgYmluZCA9IHJlcXVpcmUoJy4vaGVscGVycy9iaW5kJyk7XG52YXIgaXNCdWZmZXIgPSByZXF1aXJlKCdpcy1idWZmZXInKTtcblxuLypnbG9iYWwgdG9TdHJpbmc6dHJ1ZSovXG5cbi8vIHV0aWxzIGlzIGEgbGlicmFyeSBvZiBnZW5lcmljIGhlbHBlciBmdW5jdGlvbnMgbm9uLXNwZWNpZmljIHRvIGF4aW9zXG5cbnZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIGEgdmFsdWUgaXMgYW4gQXJyYXlcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsIFRoZSB2YWx1ZSB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB2YWx1ZSBpcyBhbiBBcnJheSwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzQXJyYXkodmFsKSB7XG4gIHJldHVybiB0b1N0cmluZy5jYWxsKHZhbCkgPT09ICdbb2JqZWN0IEFycmF5XSc7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIGEgdmFsdWUgaXMgYW4gQXJyYXlCdWZmZXJcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsIFRoZSB2YWx1ZSB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB2YWx1ZSBpcyBhbiBBcnJheUJ1ZmZlciwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzQXJyYXlCdWZmZXIodmFsKSB7XG4gIHJldHVybiB0b1N0cmluZy5jYWxsKHZhbCkgPT09ICdbb2JqZWN0IEFycmF5QnVmZmVyXSc7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIGEgdmFsdWUgaXMgYSBGb3JtRGF0YVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHZhbHVlIGlzIGFuIEZvcm1EYXRhLCBvdGhlcndpc2UgZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNGb3JtRGF0YSh2YWwpIHtcbiAgcmV0dXJuICh0eXBlb2YgRm9ybURhdGEgIT09ICd1bmRlZmluZWQnKSAmJiAodmFsIGluc3RhbmNlb2YgRm9ybURhdGEpO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIGEgdmlldyBvbiBhbiBBcnJheUJ1ZmZlclxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHZhbHVlIGlzIGEgdmlldyBvbiBhbiBBcnJheUJ1ZmZlciwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzQXJyYXlCdWZmZXJWaWV3KHZhbCkge1xuICB2YXIgcmVzdWx0O1xuICBpZiAoKHR5cGVvZiBBcnJheUJ1ZmZlciAhPT0gJ3VuZGVmaW5lZCcpICYmIChBcnJheUJ1ZmZlci5pc1ZpZXcpKSB7XG4gICAgcmVzdWx0ID0gQXJyYXlCdWZmZXIuaXNWaWV3KHZhbCk7XG4gIH0gZWxzZSB7XG4gICAgcmVzdWx0ID0gKHZhbCkgJiYgKHZhbC5idWZmZXIpICYmICh2YWwuYnVmZmVyIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIGEgdmFsdWUgaXMgYSBTdHJpbmdcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsIFRoZSB2YWx1ZSB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB2YWx1ZSBpcyBhIFN0cmluZywgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzU3RyaW5nKHZhbCkge1xuICByZXR1cm4gdHlwZW9mIHZhbCA9PT0gJ3N0cmluZyc7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIGEgdmFsdWUgaXMgYSBOdW1iZXJcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsIFRoZSB2YWx1ZSB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB2YWx1ZSBpcyBhIE51bWJlciwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzTnVtYmVyKHZhbCkge1xuICByZXR1cm4gdHlwZW9mIHZhbCA9PT0gJ251bWJlcic7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIGEgdmFsdWUgaXMgdW5kZWZpbmVkXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbCBUaGUgdmFsdWUgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIHZhbHVlIGlzIHVuZGVmaW5lZCwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKHZhbCkge1xuICByZXR1cm4gdHlwZW9mIHZhbCA9PT0gJ3VuZGVmaW5lZCc7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIGEgdmFsdWUgaXMgYW4gT2JqZWN0XG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbCBUaGUgdmFsdWUgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdmFsdWUgaXMgYW4gT2JqZWN0LCBvdGhlcndpc2UgZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNPYmplY3QodmFsKSB7XG4gIHJldHVybiB2YWwgIT09IG51bGwgJiYgdHlwZW9mIHZhbCA9PT0gJ29iamVjdCc7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIGEgdmFsdWUgaXMgYSBEYXRlXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbCBUaGUgdmFsdWUgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdmFsdWUgaXMgYSBEYXRlLCBvdGhlcndpc2UgZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNEYXRlKHZhbCkge1xuICByZXR1cm4gdG9TdHJpbmcuY2FsbCh2YWwpID09PSAnW29iamVjdCBEYXRlXSc7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIGEgdmFsdWUgaXMgYSBGaWxlXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbCBUaGUgdmFsdWUgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdmFsdWUgaXMgYSBGaWxlLCBvdGhlcndpc2UgZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNGaWxlKHZhbCkge1xuICByZXR1cm4gdG9TdHJpbmcuY2FsbCh2YWwpID09PSAnW29iamVjdCBGaWxlXSc7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIGEgdmFsdWUgaXMgYSBCbG9iXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbCBUaGUgdmFsdWUgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdmFsdWUgaXMgYSBCbG9iLCBvdGhlcndpc2UgZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNCbG9iKHZhbCkge1xuICByZXR1cm4gdG9TdHJpbmcuY2FsbCh2YWwpID09PSAnW29iamVjdCBCbG9iXSc7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIGEgdmFsdWUgaXMgYSBGdW5jdGlvblxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHZhbHVlIGlzIGEgRnVuY3Rpb24sIG90aGVyd2lzZSBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKHZhbCkge1xuICByZXR1cm4gdG9TdHJpbmcuY2FsbCh2YWwpID09PSAnW29iamVjdCBGdW5jdGlvbl0nO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIGEgU3RyZWFtXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbCBUaGUgdmFsdWUgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdmFsdWUgaXMgYSBTdHJlYW0sIG90aGVyd2lzZSBmYWxzZVxuICovXG5mdW5jdGlvbiBpc1N0cmVhbSh2YWwpIHtcbiAgcmV0dXJuIGlzT2JqZWN0KHZhbCkgJiYgaXNGdW5jdGlvbih2YWwucGlwZSk7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIGEgdmFsdWUgaXMgYSBVUkxTZWFyY2hQYXJhbXMgb2JqZWN0XG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbCBUaGUgdmFsdWUgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdmFsdWUgaXMgYSBVUkxTZWFyY2hQYXJhbXMgb2JqZWN0LCBvdGhlcndpc2UgZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNVUkxTZWFyY2hQYXJhbXModmFsKSB7XG4gIHJldHVybiB0eXBlb2YgVVJMU2VhcmNoUGFyYW1zICE9PSAndW5kZWZpbmVkJyAmJiB2YWwgaW5zdGFuY2VvZiBVUkxTZWFyY2hQYXJhbXM7XG59XG5cbi8qKlxuICogVHJpbSBleGNlc3Mgd2hpdGVzcGFjZSBvZmYgdGhlIGJlZ2lubmluZyBhbmQgZW5kIG9mIGEgc3RyaW5nXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBUaGUgU3RyaW5nIHRvIHRyaW1cbiAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBTdHJpbmcgZnJlZWQgb2YgZXhjZXNzIHdoaXRlc3BhY2VcbiAqL1xuZnVuY3Rpb24gdHJpbShzdHIpIHtcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9eXFxzKi8sICcnKS5yZXBsYWNlKC9cXHMqJC8sICcnKTtcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgd2UncmUgcnVubmluZyBpbiBhIHN0YW5kYXJkIGJyb3dzZXIgZW52aXJvbm1lbnRcbiAqXG4gKiBUaGlzIGFsbG93cyBheGlvcyB0byBydW4gaW4gYSB3ZWIgd29ya2VyLCBhbmQgcmVhY3QtbmF0aXZlLlxuICogQm90aCBlbnZpcm9ubWVudHMgc3VwcG9ydCBYTUxIdHRwUmVxdWVzdCwgYnV0IG5vdCBmdWxseSBzdGFuZGFyZCBnbG9iYWxzLlxuICpcbiAqIHdlYiB3b3JrZXJzOlxuICogIHR5cGVvZiB3aW5kb3cgLT4gdW5kZWZpbmVkXG4gKiAgdHlwZW9mIGRvY3VtZW50IC0+IHVuZGVmaW5lZFxuICpcbiAqIHJlYWN0LW5hdGl2ZTpcbiAqICBuYXZpZ2F0b3IucHJvZHVjdCAtPiAnUmVhY3ROYXRpdmUnXG4gKi9cbmZ1bmN0aW9uIGlzU3RhbmRhcmRCcm93c2VyRW52KCkge1xuICBpZiAodHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgJiYgbmF2aWdhdG9yLnByb2R1Y3QgPT09ICdSZWFjdE5hdGl2ZScpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIChcbiAgICB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJlxuICAgIHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCdcbiAgKTtcbn1cblxuLyoqXG4gKiBJdGVyYXRlIG92ZXIgYW4gQXJyYXkgb3IgYW4gT2JqZWN0IGludm9raW5nIGEgZnVuY3Rpb24gZm9yIGVhY2ggaXRlbS5cbiAqXG4gKiBJZiBgb2JqYCBpcyBhbiBBcnJheSBjYWxsYmFjayB3aWxsIGJlIGNhbGxlZCBwYXNzaW5nXG4gKiB0aGUgdmFsdWUsIGluZGV4LCBhbmQgY29tcGxldGUgYXJyYXkgZm9yIGVhY2ggaXRlbS5cbiAqXG4gKiBJZiAnb2JqJyBpcyBhbiBPYmplY3QgY2FsbGJhY2sgd2lsbCBiZSBjYWxsZWQgcGFzc2luZ1xuICogdGhlIHZhbHVlLCBrZXksIGFuZCBjb21wbGV0ZSBvYmplY3QgZm9yIGVhY2ggcHJvcGVydHkuXG4gKlxuICogQHBhcmFtIHtPYmplY3R8QXJyYXl9IG9iaiBUaGUgb2JqZWN0IHRvIGl0ZXJhdGVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuIFRoZSBjYWxsYmFjayB0byBpbnZva2UgZm9yIGVhY2ggaXRlbVxuICovXG5mdW5jdGlvbiBmb3JFYWNoKG9iaiwgZm4pIHtcbiAgLy8gRG9uJ3QgYm90aGVyIGlmIG5vIHZhbHVlIHByb3ZpZGVkXG4gIGlmIChvYmogPT09IG51bGwgfHwgdHlwZW9mIG9iaiA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBGb3JjZSBhbiBhcnJheSBpZiBub3QgYWxyZWFkeSBzb21ldGhpbmcgaXRlcmFibGVcbiAgaWYgKHR5cGVvZiBvYmogIT09ICdvYmplY3QnICYmICFpc0FycmF5KG9iaikpIHtcbiAgICAvKmVzbGludCBuby1wYXJhbS1yZWFzc2lnbjowKi9cbiAgICBvYmogPSBbb2JqXTtcbiAgfVxuXG4gIGlmIChpc0FycmF5KG9iaikpIHtcbiAgICAvLyBJdGVyYXRlIG92ZXIgYXJyYXkgdmFsdWVzXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSBvYmoubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICBmbi5jYWxsKG51bGwsIG9ialtpXSwgaSwgb2JqKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgLy8gSXRlcmF0ZSBvdmVyIG9iamVjdCBrZXlzXG4gICAgZm9yICh2YXIga2V5IGluIG9iaikge1xuICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSkpIHtcbiAgICAgICAgZm4uY2FsbChudWxsLCBvYmpba2V5XSwga2V5LCBvYmopO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEFjY2VwdHMgdmFyYXJncyBleHBlY3RpbmcgZWFjaCBhcmd1bWVudCB0byBiZSBhbiBvYmplY3QsIHRoZW5cbiAqIGltbXV0YWJseSBtZXJnZXMgdGhlIHByb3BlcnRpZXMgb2YgZWFjaCBvYmplY3QgYW5kIHJldHVybnMgcmVzdWx0LlxuICpcbiAqIFdoZW4gbXVsdGlwbGUgb2JqZWN0cyBjb250YWluIHRoZSBzYW1lIGtleSB0aGUgbGF0ZXIgb2JqZWN0IGluXG4gKiB0aGUgYXJndW1lbnRzIGxpc3Qgd2lsbCB0YWtlIHByZWNlZGVuY2UuXG4gKlxuICogRXhhbXBsZTpcbiAqXG4gKiBgYGBqc1xuICogdmFyIHJlc3VsdCA9IG1lcmdlKHtmb286IDEyM30sIHtmb286IDQ1Nn0pO1xuICogY29uc29sZS5sb2cocmVzdWx0LmZvbyk7IC8vIG91dHB1dHMgNDU2XG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqMSBPYmplY3QgdG8gbWVyZ2VcbiAqIEByZXR1cm5zIHtPYmplY3R9IFJlc3VsdCBvZiBhbGwgbWVyZ2UgcHJvcGVydGllc1xuICovXG5mdW5jdGlvbiBtZXJnZSgvKiBvYmoxLCBvYmoyLCBvYmozLCAuLi4gKi8pIHtcbiAgdmFyIHJlc3VsdCA9IHt9O1xuICBmdW5jdGlvbiBhc3NpZ25WYWx1ZSh2YWwsIGtleSkge1xuICAgIGlmICh0eXBlb2YgcmVzdWx0W2tleV0gPT09ICdvYmplY3QnICYmIHR5cGVvZiB2YWwgPT09ICdvYmplY3QnKSB7XG4gICAgICByZXN1bHRba2V5XSA9IG1lcmdlKHJlc3VsdFtrZXldLCB2YWwpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHRba2V5XSA9IHZhbDtcbiAgICB9XG4gIH1cblxuICBmb3IgKHZhciBpID0gMCwgbCA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBmb3JFYWNoKGFyZ3VtZW50c1tpXSwgYXNzaWduVmFsdWUpO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8qKlxuICogRXh0ZW5kcyBvYmplY3QgYSBieSBtdXRhYmx5IGFkZGluZyB0byBpdCB0aGUgcHJvcGVydGllcyBvZiBvYmplY3QgYi5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gYSBUaGUgb2JqZWN0IHRvIGJlIGV4dGVuZGVkXG4gKiBAcGFyYW0ge09iamVjdH0gYiBUaGUgb2JqZWN0IHRvIGNvcHkgcHJvcGVydGllcyBmcm9tXG4gKiBAcGFyYW0ge09iamVjdH0gdGhpc0FyZyBUaGUgb2JqZWN0IHRvIGJpbmQgZnVuY3Rpb24gdG9cbiAqIEByZXR1cm4ge09iamVjdH0gVGhlIHJlc3VsdGluZyB2YWx1ZSBvZiBvYmplY3QgYVxuICovXG5mdW5jdGlvbiBleHRlbmQoYSwgYiwgdGhpc0FyZykge1xuICBmb3JFYWNoKGIsIGZ1bmN0aW9uIGFzc2lnblZhbHVlKHZhbCwga2V5KSB7XG4gICAgaWYgKHRoaXNBcmcgJiYgdHlwZW9mIHZhbCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgYVtrZXldID0gYmluZCh2YWwsIHRoaXNBcmcpO1xuICAgIH0gZWxzZSB7XG4gICAgICBhW2tleV0gPSB2YWw7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIGE7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBpc0FycmF5OiBpc0FycmF5LFxuICBpc0FycmF5QnVmZmVyOiBpc0FycmF5QnVmZmVyLFxuICBpc0J1ZmZlcjogaXNCdWZmZXIsXG4gIGlzRm9ybURhdGE6IGlzRm9ybURhdGEsXG4gIGlzQXJyYXlCdWZmZXJWaWV3OiBpc0FycmF5QnVmZmVyVmlldyxcbiAgaXNTdHJpbmc6IGlzU3RyaW5nLFxuICBpc051bWJlcjogaXNOdW1iZXIsXG4gIGlzT2JqZWN0OiBpc09iamVjdCxcbiAgaXNVbmRlZmluZWQ6IGlzVW5kZWZpbmVkLFxuICBpc0RhdGU6IGlzRGF0ZSxcbiAgaXNGaWxlOiBpc0ZpbGUsXG4gIGlzQmxvYjogaXNCbG9iLFxuICBpc0Z1bmN0aW9uOiBpc0Z1bmN0aW9uLFxuICBpc1N0cmVhbTogaXNTdHJlYW0sXG4gIGlzVVJMU2VhcmNoUGFyYW1zOiBpc1VSTFNlYXJjaFBhcmFtcyxcbiAgaXNTdGFuZGFyZEJyb3dzZXJFbnY6IGlzU3RhbmRhcmRCcm93c2VyRW52LFxuICBmb3JFYWNoOiBmb3JFYWNoLFxuICBtZXJnZTogbWVyZ2UsXG4gIGV4dGVuZDogZXh0ZW5kLFxuICB0cmltOiB0cmltXG59O1xuIiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxMy1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIF9hc3NpZ24gPSByZXF1aXJlKCdvYmplY3QtYXNzaWduJyk7XG5cbnZhciBlbXB0eU9iamVjdCA9IHJlcXVpcmUoJ2ZianMvbGliL2VtcHR5T2JqZWN0Jyk7XG52YXIgX2ludmFyaWFudCA9IHJlcXVpcmUoJ2ZianMvbGliL2ludmFyaWFudCcpO1xuXG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICB2YXIgd2FybmluZyA9IHJlcXVpcmUoJ2ZianMvbGliL3dhcm5pbmcnKTtcbn1cblxudmFyIE1JWElOU19LRVkgPSAnbWl4aW5zJztcblxuLy8gSGVscGVyIGZ1bmN0aW9uIHRvIGFsbG93IHRoZSBjcmVhdGlvbiBvZiBhbm9ueW1vdXMgZnVuY3Rpb25zIHdoaWNoIGRvIG5vdFxuLy8gaGF2ZSAubmFtZSBzZXQgdG8gdGhlIG5hbWUgb2YgdGhlIHZhcmlhYmxlIGJlaW5nIGFzc2lnbmVkIHRvLlxuZnVuY3Rpb24gaWRlbnRpdHkoZm4pIHtcbiAgcmV0dXJuIGZuO1xufVxuXG52YXIgUmVhY3RQcm9wVHlwZUxvY2F0aW9uTmFtZXM7XG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICBSZWFjdFByb3BUeXBlTG9jYXRpb25OYW1lcyA9IHtcbiAgICBwcm9wOiAncHJvcCcsXG4gICAgY29udGV4dDogJ2NvbnRleHQnLFxuICAgIGNoaWxkQ29udGV4dDogJ2NoaWxkIGNvbnRleHQnXG4gIH07XG59IGVsc2Uge1xuICBSZWFjdFByb3BUeXBlTG9jYXRpb25OYW1lcyA9IHt9O1xufVxuXG5mdW5jdGlvbiBmYWN0b3J5KFJlYWN0Q29tcG9uZW50LCBpc1ZhbGlkRWxlbWVudCwgUmVhY3ROb29wVXBkYXRlUXVldWUpIHtcbiAgLyoqXG4gICAqIFBvbGljaWVzIHRoYXQgZGVzY3JpYmUgbWV0aG9kcyBpbiBgUmVhY3RDbGFzc0ludGVyZmFjZWAuXG4gICAqL1xuXG4gIHZhciBpbmplY3RlZE1peGlucyA9IFtdO1xuXG4gIC8qKlxuICAgKiBDb21wb3NpdGUgY29tcG9uZW50cyBhcmUgaGlnaGVyLWxldmVsIGNvbXBvbmVudHMgdGhhdCBjb21wb3NlIG90aGVyIGNvbXBvc2l0ZVxuICAgKiBvciBob3N0IGNvbXBvbmVudHMuXG4gICAqXG4gICAqIFRvIGNyZWF0ZSBhIG5ldyB0eXBlIG9mIGBSZWFjdENsYXNzYCwgcGFzcyBhIHNwZWNpZmljYXRpb24gb2ZcbiAgICogeW91ciBuZXcgY2xhc3MgdG8gYFJlYWN0LmNyZWF0ZUNsYXNzYC4gVGhlIG9ubHkgcmVxdWlyZW1lbnQgb2YgeW91ciBjbGFzc1xuICAgKiBzcGVjaWZpY2F0aW9uIGlzIHRoYXQgeW91IGltcGxlbWVudCBhIGByZW5kZXJgIG1ldGhvZC5cbiAgICpcbiAgICogICB2YXIgTXlDb21wb25lbnQgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG4gICAqICAgICByZW5kZXI6IGZ1bmN0aW9uKCkge1xuICAgKiAgICAgICByZXR1cm4gPGRpdj5IZWxsbyBXb3JsZDwvZGl2PjtcbiAgICogICAgIH1cbiAgICogICB9KTtcbiAgICpcbiAgICogVGhlIGNsYXNzIHNwZWNpZmljYXRpb24gc3VwcG9ydHMgYSBzcGVjaWZpYyBwcm90b2NvbCBvZiBtZXRob2RzIHRoYXQgaGF2ZVxuICAgKiBzcGVjaWFsIG1lYW5pbmcgKGUuZy4gYHJlbmRlcmApLiBTZWUgYFJlYWN0Q2xhc3NJbnRlcmZhY2VgIGZvclxuICAgKiBtb3JlIHRoZSBjb21wcmVoZW5zaXZlIHByb3RvY29sLiBBbnkgb3RoZXIgcHJvcGVydGllcyBhbmQgbWV0aG9kcyBpbiB0aGVcbiAgICogY2xhc3Mgc3BlY2lmaWNhdGlvbiB3aWxsIGJlIGF2YWlsYWJsZSBvbiB0aGUgcHJvdG90eXBlLlxuICAgKlxuICAgKiBAaW50ZXJmYWNlIFJlYWN0Q2xhc3NJbnRlcmZhY2VcbiAgICogQGludGVybmFsXG4gICAqL1xuICB2YXIgUmVhY3RDbGFzc0ludGVyZmFjZSA9IHtcbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiBNaXhpbiBvYmplY3RzIHRvIGluY2x1ZGUgd2hlbiBkZWZpbmluZyB5b3VyIGNvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHthcnJheX1cbiAgICAgKiBAb3B0aW9uYWxcbiAgICAgKi9cbiAgICBtaXhpbnM6ICdERUZJTkVfTUFOWScsXG5cbiAgICAvKipcbiAgICAgKiBBbiBvYmplY3QgY29udGFpbmluZyBwcm9wZXJ0aWVzIGFuZCBtZXRob2RzIHRoYXQgc2hvdWxkIGJlIGRlZmluZWQgb25cbiAgICAgKiB0aGUgY29tcG9uZW50J3MgY29uc3RydWN0b3IgaW5zdGVhZCBvZiBpdHMgcHJvdG90eXBlIChzdGF0aWMgbWV0aG9kcykuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7b2JqZWN0fVxuICAgICAqIEBvcHRpb25hbFxuICAgICAqL1xuICAgIHN0YXRpY3M6ICdERUZJTkVfTUFOWScsXG5cbiAgICAvKipcbiAgICAgKiBEZWZpbml0aW9uIG9mIHByb3AgdHlwZXMgZm9yIHRoaXMgY29tcG9uZW50LlxuICAgICAqXG4gICAgICogQHR5cGUge29iamVjdH1cbiAgICAgKiBAb3B0aW9uYWxcbiAgICAgKi9cbiAgICBwcm9wVHlwZXM6ICdERUZJTkVfTUFOWScsXG5cbiAgICAvKipcbiAgICAgKiBEZWZpbml0aW9uIG9mIGNvbnRleHQgdHlwZXMgZm9yIHRoaXMgY29tcG9uZW50LlxuICAgICAqXG4gICAgICogQHR5cGUge29iamVjdH1cbiAgICAgKiBAb3B0aW9uYWxcbiAgICAgKi9cbiAgICBjb250ZXh0VHlwZXM6ICdERUZJTkVfTUFOWScsXG5cbiAgICAvKipcbiAgICAgKiBEZWZpbml0aW9uIG9mIGNvbnRleHQgdHlwZXMgdGhpcyBjb21wb25lbnQgc2V0cyBmb3IgaXRzIGNoaWxkcmVuLlxuICAgICAqXG4gICAgICogQHR5cGUge29iamVjdH1cbiAgICAgKiBAb3B0aW9uYWxcbiAgICAgKi9cbiAgICBjaGlsZENvbnRleHRUeXBlczogJ0RFRklORV9NQU5ZJyxcblxuICAgIC8vID09PT0gRGVmaW5pdGlvbiBtZXRob2RzID09PT1cblxuICAgIC8qKlxuICAgICAqIEludm9rZWQgd2hlbiB0aGUgY29tcG9uZW50IGlzIG1vdW50ZWQuIFZhbHVlcyBpbiB0aGUgbWFwcGluZyB3aWxsIGJlIHNldCBvblxuICAgICAqIGB0aGlzLnByb3BzYCBpZiB0aGF0IHByb3AgaXMgbm90IHNwZWNpZmllZCAoaS5lLiB1c2luZyBhbiBgaW5gIGNoZWNrKS5cbiAgICAgKlxuICAgICAqIFRoaXMgbWV0aG9kIGlzIGludm9rZWQgYmVmb3JlIGBnZXRJbml0aWFsU3RhdGVgIGFuZCB0aGVyZWZvcmUgY2Fubm90IHJlbHlcbiAgICAgKiBvbiBgdGhpcy5zdGF0ZWAgb3IgdXNlIGB0aGlzLnNldFN0YXRlYC5cbiAgICAgKlxuICAgICAqIEByZXR1cm4ge29iamVjdH1cbiAgICAgKiBAb3B0aW9uYWxcbiAgICAgKi9cbiAgICBnZXREZWZhdWx0UHJvcHM6ICdERUZJTkVfTUFOWV9NRVJHRUQnLFxuXG4gICAgLyoqXG4gICAgICogSW52b2tlZCBvbmNlIGJlZm9yZSB0aGUgY29tcG9uZW50IGlzIG1vdW50ZWQuIFRoZSByZXR1cm4gdmFsdWUgd2lsbCBiZSB1c2VkXG4gICAgICogYXMgdGhlIGluaXRpYWwgdmFsdWUgb2YgYHRoaXMuc3RhdGVgLlxuICAgICAqXG4gICAgICogICBnZXRJbml0aWFsU3RhdGU6IGZ1bmN0aW9uKCkge1xuICAgICAqICAgICByZXR1cm4ge1xuICAgICAqICAgICAgIGlzT246IGZhbHNlLFxuICAgICAqICAgICAgIGZvb0JhejogbmV3IEJhekZvbygpXG4gICAgICogICAgIH1cbiAgICAgKiAgIH1cbiAgICAgKlxuICAgICAqIEByZXR1cm4ge29iamVjdH1cbiAgICAgKiBAb3B0aW9uYWxcbiAgICAgKi9cbiAgICBnZXRJbml0aWFsU3RhdGU6ICdERUZJTkVfTUFOWV9NRVJHRUQnLFxuXG4gICAgLyoqXG4gICAgICogQHJldHVybiB7b2JqZWN0fVxuICAgICAqIEBvcHRpb25hbFxuICAgICAqL1xuICAgIGdldENoaWxkQ29udGV4dDogJ0RFRklORV9NQU5ZX01FUkdFRCcsXG5cbiAgICAvKipcbiAgICAgKiBVc2VzIHByb3BzIGZyb20gYHRoaXMucHJvcHNgIGFuZCBzdGF0ZSBmcm9tIGB0aGlzLnN0YXRlYCB0byByZW5kZXIgdGhlXG4gICAgICogc3RydWN0dXJlIG9mIHRoZSBjb21wb25lbnQuXG4gICAgICpcbiAgICAgKiBObyBndWFyYW50ZWVzIGFyZSBtYWRlIGFib3V0IHdoZW4gb3IgaG93IG9mdGVuIHRoaXMgbWV0aG9kIGlzIGludm9rZWQsIHNvXG4gICAgICogaXQgbXVzdCBub3QgaGF2ZSBzaWRlIGVmZmVjdHMuXG4gICAgICpcbiAgICAgKiAgIHJlbmRlcjogZnVuY3Rpb24oKSB7XG4gICAgICogICAgIHZhciBuYW1lID0gdGhpcy5wcm9wcy5uYW1lO1xuICAgICAqICAgICByZXR1cm4gPGRpdj5IZWxsbywge25hbWV9ITwvZGl2PjtcbiAgICAgKiAgIH1cbiAgICAgKlxuICAgICAqIEByZXR1cm4ge1JlYWN0Q29tcG9uZW50fVxuICAgICAqIEByZXF1aXJlZFxuICAgICAqL1xuICAgIHJlbmRlcjogJ0RFRklORV9PTkNFJyxcblxuICAgIC8vID09PT0gRGVsZWdhdGUgbWV0aG9kcyA9PT09XG5cbiAgICAvKipcbiAgICAgKiBJbnZva2VkIHdoZW4gdGhlIGNvbXBvbmVudCBpcyBpbml0aWFsbHkgY3JlYXRlZCBhbmQgYWJvdXQgdG8gYmUgbW91bnRlZC5cbiAgICAgKiBUaGlzIG1heSBoYXZlIHNpZGUgZWZmZWN0cywgYnV0IGFueSBleHRlcm5hbCBzdWJzY3JpcHRpb25zIG9yIGRhdGEgY3JlYXRlZFxuICAgICAqIGJ5IHRoaXMgbWV0aG9kIG11c3QgYmUgY2xlYW5lZCB1cCBpbiBgY29tcG9uZW50V2lsbFVubW91bnRgLlxuICAgICAqXG4gICAgICogQG9wdGlvbmFsXG4gICAgICovXG4gICAgY29tcG9uZW50V2lsbE1vdW50OiAnREVGSU5FX01BTlknLFxuXG4gICAgLyoqXG4gICAgICogSW52b2tlZCB3aGVuIHRoZSBjb21wb25lbnQgaGFzIGJlZW4gbW91bnRlZCBhbmQgaGFzIGEgRE9NIHJlcHJlc2VudGF0aW9uLlxuICAgICAqIEhvd2V2ZXIsIHRoZXJlIGlzIG5vIGd1YXJhbnRlZSB0aGF0IHRoZSBET00gbm9kZSBpcyBpbiB0aGUgZG9jdW1lbnQuXG4gICAgICpcbiAgICAgKiBVc2UgdGhpcyBhcyBhbiBvcHBvcnR1bml0eSB0byBvcGVyYXRlIG9uIHRoZSBET00gd2hlbiB0aGUgY29tcG9uZW50IGhhc1xuICAgICAqIGJlZW4gbW91bnRlZCAoaW5pdGlhbGl6ZWQgYW5kIHJlbmRlcmVkKSBmb3IgdGhlIGZpcnN0IHRpbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0RPTUVsZW1lbnR9IHJvb3ROb2RlIERPTSBlbGVtZW50IHJlcHJlc2VudGluZyB0aGUgY29tcG9uZW50LlxuICAgICAqIEBvcHRpb25hbFxuICAgICAqL1xuICAgIGNvbXBvbmVudERpZE1vdW50OiAnREVGSU5FX01BTlknLFxuXG4gICAgLyoqXG4gICAgICogSW52b2tlZCBiZWZvcmUgdGhlIGNvbXBvbmVudCByZWNlaXZlcyBuZXcgcHJvcHMuXG4gICAgICpcbiAgICAgKiBVc2UgdGhpcyBhcyBhbiBvcHBvcnR1bml0eSB0byByZWFjdCB0byBhIHByb3AgdHJhbnNpdGlvbiBieSB1cGRhdGluZyB0aGVcbiAgICAgKiBzdGF0ZSB1c2luZyBgdGhpcy5zZXRTdGF0ZWAuIEN1cnJlbnQgcHJvcHMgYXJlIGFjY2Vzc2VkIHZpYSBgdGhpcy5wcm9wc2AuXG4gICAgICpcbiAgICAgKiAgIGNvbXBvbmVudFdpbGxSZWNlaXZlUHJvcHM6IGZ1bmN0aW9uKG5leHRQcm9wcywgbmV4dENvbnRleHQpIHtcbiAgICAgKiAgICAgdGhpcy5zZXRTdGF0ZSh7XG4gICAgICogICAgICAgbGlrZXNJbmNyZWFzaW5nOiBuZXh0UHJvcHMubGlrZUNvdW50ID4gdGhpcy5wcm9wcy5saWtlQ291bnRcbiAgICAgKiAgICAgfSk7XG4gICAgICogICB9XG4gICAgICpcbiAgICAgKiBOT1RFOiBUaGVyZSBpcyBubyBlcXVpdmFsZW50IGBjb21wb25lbnRXaWxsUmVjZWl2ZVN0YXRlYC4gQW4gaW5jb21pbmcgcHJvcFxuICAgICAqIHRyYW5zaXRpb24gbWF5IGNhdXNlIGEgc3RhdGUgY2hhbmdlLCBidXQgdGhlIG9wcG9zaXRlIGlzIG5vdCB0cnVlLiBJZiB5b3VcbiAgICAgKiBuZWVkIGl0LCB5b3UgYXJlIHByb2JhYmx5IGxvb2tpbmcgZm9yIGBjb21wb25lbnRXaWxsVXBkYXRlYC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBuZXh0UHJvcHNcbiAgICAgKiBAb3B0aW9uYWxcbiAgICAgKi9cbiAgICBjb21wb25lbnRXaWxsUmVjZWl2ZVByb3BzOiAnREVGSU5FX01BTlknLFxuXG4gICAgLyoqXG4gICAgICogSW52b2tlZCB3aGlsZSBkZWNpZGluZyBpZiB0aGUgY29tcG9uZW50IHNob3VsZCBiZSB1cGRhdGVkIGFzIGEgcmVzdWx0IG9mXG4gICAgICogcmVjZWl2aW5nIG5ldyBwcm9wcywgc3RhdGUgYW5kL29yIGNvbnRleHQuXG4gICAgICpcbiAgICAgKiBVc2UgdGhpcyBhcyBhbiBvcHBvcnR1bml0eSB0byBgcmV0dXJuIGZhbHNlYCB3aGVuIHlvdSdyZSBjZXJ0YWluIHRoYXQgdGhlXG4gICAgICogdHJhbnNpdGlvbiB0byB0aGUgbmV3IHByb3BzL3N0YXRlL2NvbnRleHQgd2lsbCBub3QgcmVxdWlyZSBhIGNvbXBvbmVudFxuICAgICAqIHVwZGF0ZS5cbiAgICAgKlxuICAgICAqICAgc2hvdWxkQ29tcG9uZW50VXBkYXRlOiBmdW5jdGlvbihuZXh0UHJvcHMsIG5leHRTdGF0ZSwgbmV4dENvbnRleHQpIHtcbiAgICAgKiAgICAgcmV0dXJuICFlcXVhbChuZXh0UHJvcHMsIHRoaXMucHJvcHMpIHx8XG4gICAgICogICAgICAgIWVxdWFsKG5leHRTdGF0ZSwgdGhpcy5zdGF0ZSkgfHxcbiAgICAgKiAgICAgICAhZXF1YWwobmV4dENvbnRleHQsIHRoaXMuY29udGV4dCk7XG4gICAgICogICB9XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gbmV4dFByb3BzXG4gICAgICogQHBhcmFtIHs/b2JqZWN0fSBuZXh0U3RhdGVcbiAgICAgKiBAcGFyYW0gez9vYmplY3R9IG5leHRDb250ZXh0XG4gICAgICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgY29tcG9uZW50IHNob3VsZCB1cGRhdGUuXG4gICAgICogQG9wdGlvbmFsXG4gICAgICovXG4gICAgc2hvdWxkQ29tcG9uZW50VXBkYXRlOiAnREVGSU5FX09OQ0UnLFxuXG4gICAgLyoqXG4gICAgICogSW52b2tlZCB3aGVuIHRoZSBjb21wb25lbnQgaXMgYWJvdXQgdG8gdXBkYXRlIGR1ZSB0byBhIHRyYW5zaXRpb24gZnJvbVxuICAgICAqIGB0aGlzLnByb3BzYCwgYHRoaXMuc3RhdGVgIGFuZCBgdGhpcy5jb250ZXh0YCB0byBgbmV4dFByb3BzYCwgYG5leHRTdGF0ZWBcbiAgICAgKiBhbmQgYG5leHRDb250ZXh0YC5cbiAgICAgKlxuICAgICAqIFVzZSB0aGlzIGFzIGFuIG9wcG9ydHVuaXR5IHRvIHBlcmZvcm0gcHJlcGFyYXRpb24gYmVmb3JlIGFuIHVwZGF0ZSBvY2N1cnMuXG4gICAgICpcbiAgICAgKiBOT1RFOiBZb3UgKipjYW5ub3QqKiB1c2UgYHRoaXMuc2V0U3RhdGUoKWAgaW4gdGhpcyBtZXRob2QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gbmV4dFByb3BzXG4gICAgICogQHBhcmFtIHs/b2JqZWN0fSBuZXh0U3RhdGVcbiAgICAgKiBAcGFyYW0gez9vYmplY3R9IG5leHRDb250ZXh0XG4gICAgICogQHBhcmFtIHtSZWFjdFJlY29uY2lsZVRyYW5zYWN0aW9ufSB0cmFuc2FjdGlvblxuICAgICAqIEBvcHRpb25hbFxuICAgICAqL1xuICAgIGNvbXBvbmVudFdpbGxVcGRhdGU6ICdERUZJTkVfTUFOWScsXG5cbiAgICAvKipcbiAgICAgKiBJbnZva2VkIHdoZW4gdGhlIGNvbXBvbmVudCdzIERPTSByZXByZXNlbnRhdGlvbiBoYXMgYmVlbiB1cGRhdGVkLlxuICAgICAqXG4gICAgICogVXNlIHRoaXMgYXMgYW4gb3Bwb3J0dW5pdHkgdG8gb3BlcmF0ZSBvbiB0aGUgRE9NIHdoZW4gdGhlIGNvbXBvbmVudCBoYXNcbiAgICAgKiBiZWVuIHVwZGF0ZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gcHJldlByb3BzXG4gICAgICogQHBhcmFtIHs/b2JqZWN0fSBwcmV2U3RhdGVcbiAgICAgKiBAcGFyYW0gez9vYmplY3R9IHByZXZDb250ZXh0XG4gICAgICogQHBhcmFtIHtET01FbGVtZW50fSByb290Tm9kZSBET00gZWxlbWVudCByZXByZXNlbnRpbmcgdGhlIGNvbXBvbmVudC5cbiAgICAgKiBAb3B0aW9uYWxcbiAgICAgKi9cbiAgICBjb21wb25lbnREaWRVcGRhdGU6ICdERUZJTkVfTUFOWScsXG5cbiAgICAvKipcbiAgICAgKiBJbnZva2VkIHdoZW4gdGhlIGNvbXBvbmVudCBpcyBhYm91dCB0byBiZSByZW1vdmVkIGZyb20gaXRzIHBhcmVudCBhbmQgaGF2ZVxuICAgICAqIGl0cyBET00gcmVwcmVzZW50YXRpb24gZGVzdHJveWVkLlxuICAgICAqXG4gICAgICogVXNlIHRoaXMgYXMgYW4gb3Bwb3J0dW5pdHkgdG8gZGVhbGxvY2F0ZSBhbnkgZXh0ZXJuYWwgcmVzb3VyY2VzLlxuICAgICAqXG4gICAgICogTk9URTogVGhlcmUgaXMgbm8gYGNvbXBvbmVudERpZFVubW91bnRgIHNpbmNlIHlvdXIgY29tcG9uZW50IHdpbGwgaGF2ZSBiZWVuXG4gICAgICogZGVzdHJveWVkIGJ5IHRoYXQgcG9pbnQuXG4gICAgICpcbiAgICAgKiBAb3B0aW9uYWxcbiAgICAgKi9cbiAgICBjb21wb25lbnRXaWxsVW5tb3VudDogJ0RFRklORV9NQU5ZJyxcblxuICAgIC8vID09PT0gQWR2YW5jZWQgbWV0aG9kcyA9PT09XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGVzIHRoZSBjb21wb25lbnQncyBjdXJyZW50bHkgbW91bnRlZCBET00gcmVwcmVzZW50YXRpb24uXG4gICAgICpcbiAgICAgKiBCeSBkZWZhdWx0LCB0aGlzIGltcGxlbWVudHMgUmVhY3QncyByZW5kZXJpbmcgYW5kIHJlY29uY2lsaWF0aW9uIGFsZ29yaXRobS5cbiAgICAgKiBTb3BoaXN0aWNhdGVkIGNsaWVudHMgbWF5IHdpc2ggdG8gb3ZlcnJpZGUgdGhpcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UmVhY3RSZWNvbmNpbGVUcmFuc2FjdGlvbn0gdHJhbnNhY3Rpb25cbiAgICAgKiBAaW50ZXJuYWxcbiAgICAgKiBAb3ZlcnJpZGFibGVcbiAgICAgKi9cbiAgICB1cGRhdGVDb21wb25lbnQ6ICdPVkVSUklERV9CQVNFJ1xuICB9O1xuXG4gIC8qKlxuICAgKiBNYXBwaW5nIGZyb20gY2xhc3Mgc3BlY2lmaWNhdGlvbiBrZXlzIHRvIHNwZWNpYWwgcHJvY2Vzc2luZyBmdW5jdGlvbnMuXG4gICAqXG4gICAqIEFsdGhvdWdoIHRoZXNlIGFyZSBkZWNsYXJlZCBsaWtlIGluc3RhbmNlIHByb3BlcnRpZXMgaW4gdGhlIHNwZWNpZmljYXRpb25cbiAgICogd2hlbiBkZWZpbmluZyBjbGFzc2VzIHVzaW5nIGBSZWFjdC5jcmVhdGVDbGFzc2AsIHRoZXkgYXJlIGFjdHVhbGx5IHN0YXRpY1xuICAgKiBhbmQgYXJlIGFjY2Vzc2libGUgb24gdGhlIGNvbnN0cnVjdG9yIGluc3RlYWQgb2YgdGhlIHByb3RvdHlwZS4gRGVzcGl0ZVxuICAgKiBiZWluZyBzdGF0aWMsIHRoZXkgbXVzdCBiZSBkZWZpbmVkIG91dHNpZGUgb2YgdGhlIFwic3RhdGljc1wiIGtleSB1bmRlclxuICAgKiB3aGljaCBhbGwgb3RoZXIgc3RhdGljIG1ldGhvZHMgYXJlIGRlZmluZWQuXG4gICAqL1xuICB2YXIgUkVTRVJWRURfU1BFQ19LRVlTID0ge1xuICAgIGRpc3BsYXlOYW1lOiBmdW5jdGlvbihDb25zdHJ1Y3RvciwgZGlzcGxheU5hbWUpIHtcbiAgICAgIENvbnN0cnVjdG9yLmRpc3BsYXlOYW1lID0gZGlzcGxheU5hbWU7XG4gICAgfSxcbiAgICBtaXhpbnM6IGZ1bmN0aW9uKENvbnN0cnVjdG9yLCBtaXhpbnMpIHtcbiAgICAgIGlmIChtaXhpbnMpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBtaXhpbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBtaXhTcGVjSW50b0NvbXBvbmVudChDb25zdHJ1Y3RvciwgbWl4aW5zW2ldKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgY2hpbGRDb250ZXh0VHlwZXM6IGZ1bmN0aW9uKENvbnN0cnVjdG9yLCBjaGlsZENvbnRleHRUeXBlcykge1xuICAgICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgICAgdmFsaWRhdGVUeXBlRGVmKENvbnN0cnVjdG9yLCBjaGlsZENvbnRleHRUeXBlcywgJ2NoaWxkQ29udGV4dCcpO1xuICAgICAgfVxuICAgICAgQ29uc3RydWN0b3IuY2hpbGRDb250ZXh0VHlwZXMgPSBfYXNzaWduKFxuICAgICAgICB7fSxcbiAgICAgICAgQ29uc3RydWN0b3IuY2hpbGRDb250ZXh0VHlwZXMsXG4gICAgICAgIGNoaWxkQ29udGV4dFR5cGVzXG4gICAgICApO1xuICAgIH0sXG4gICAgY29udGV4dFR5cGVzOiBmdW5jdGlvbihDb25zdHJ1Y3RvciwgY29udGV4dFR5cGVzKSB7XG4gICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgICB2YWxpZGF0ZVR5cGVEZWYoQ29uc3RydWN0b3IsIGNvbnRleHRUeXBlcywgJ2NvbnRleHQnKTtcbiAgICAgIH1cbiAgICAgIENvbnN0cnVjdG9yLmNvbnRleHRUeXBlcyA9IF9hc3NpZ24oXG4gICAgICAgIHt9LFxuICAgICAgICBDb25zdHJ1Y3Rvci5jb250ZXh0VHlwZXMsXG4gICAgICAgIGNvbnRleHRUeXBlc1xuICAgICAgKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFNwZWNpYWwgY2FzZSBnZXREZWZhdWx0UHJvcHMgd2hpY2ggc2hvdWxkIG1vdmUgaW50byBzdGF0aWNzIGJ1dCByZXF1aXJlc1xuICAgICAqIGF1dG9tYXRpYyBtZXJnaW5nLlxuICAgICAqL1xuICAgIGdldERlZmF1bHRQcm9wczogZnVuY3Rpb24oQ29uc3RydWN0b3IsIGdldERlZmF1bHRQcm9wcykge1xuICAgICAgaWYgKENvbnN0cnVjdG9yLmdldERlZmF1bHRQcm9wcykge1xuICAgICAgICBDb25zdHJ1Y3Rvci5nZXREZWZhdWx0UHJvcHMgPSBjcmVhdGVNZXJnZWRSZXN1bHRGdW5jdGlvbihcbiAgICAgICAgICBDb25zdHJ1Y3Rvci5nZXREZWZhdWx0UHJvcHMsXG4gICAgICAgICAgZ2V0RGVmYXVsdFByb3BzXG4gICAgICAgICk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBDb25zdHJ1Y3Rvci5nZXREZWZhdWx0UHJvcHMgPSBnZXREZWZhdWx0UHJvcHM7XG4gICAgICB9XG4gICAgfSxcbiAgICBwcm9wVHlwZXM6IGZ1bmN0aW9uKENvbnN0cnVjdG9yLCBwcm9wVHlwZXMpIHtcbiAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgIHZhbGlkYXRlVHlwZURlZihDb25zdHJ1Y3RvciwgcHJvcFR5cGVzLCAncHJvcCcpO1xuICAgICAgfVxuICAgICAgQ29uc3RydWN0b3IucHJvcFR5cGVzID0gX2Fzc2lnbih7fSwgQ29uc3RydWN0b3IucHJvcFR5cGVzLCBwcm9wVHlwZXMpO1xuICAgIH0sXG4gICAgc3RhdGljczogZnVuY3Rpb24oQ29uc3RydWN0b3IsIHN0YXRpY3MpIHtcbiAgICAgIG1peFN0YXRpY1NwZWNJbnRvQ29tcG9uZW50KENvbnN0cnVjdG9yLCBzdGF0aWNzKTtcbiAgICB9LFxuICAgIGF1dG9iaW5kOiBmdW5jdGlvbigpIHt9XG4gIH07XG5cbiAgZnVuY3Rpb24gdmFsaWRhdGVUeXBlRGVmKENvbnN0cnVjdG9yLCB0eXBlRGVmLCBsb2NhdGlvbikge1xuICAgIGZvciAodmFyIHByb3BOYW1lIGluIHR5cGVEZWYpIHtcbiAgICAgIGlmICh0eXBlRGVmLmhhc093blByb3BlcnR5KHByb3BOYW1lKSkge1xuICAgICAgICAvLyB1c2UgYSB3YXJuaW5nIGluc3RlYWQgb2YgYW4gX2ludmFyaWFudCBzbyBjb21wb25lbnRzXG4gICAgICAgIC8vIGRvbid0IHNob3cgdXAgaW4gcHJvZCBidXQgb25seSBpbiBfX0RFVl9fXG4gICAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgICAgd2FybmluZyhcbiAgICAgICAgICAgIHR5cGVvZiB0eXBlRGVmW3Byb3BOYW1lXSA9PT0gJ2Z1bmN0aW9uJyxcbiAgICAgICAgICAgICclczogJXMgdHlwZSBgJXNgIGlzIGludmFsaWQ7IGl0IG11c3QgYmUgYSBmdW5jdGlvbiwgdXN1YWxseSBmcm9tICcgK1xuICAgICAgICAgICAgICAnUmVhY3QuUHJvcFR5cGVzLicsXG4gICAgICAgICAgICBDb25zdHJ1Y3Rvci5kaXNwbGF5TmFtZSB8fCAnUmVhY3RDbGFzcycsXG4gICAgICAgICAgICBSZWFjdFByb3BUeXBlTG9jYXRpb25OYW1lc1tsb2NhdGlvbl0sXG4gICAgICAgICAgICBwcm9wTmFtZVxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB2YWxpZGF0ZU1ldGhvZE92ZXJyaWRlKGlzQWxyZWFkeURlZmluZWQsIG5hbWUpIHtcbiAgICB2YXIgc3BlY1BvbGljeSA9IFJlYWN0Q2xhc3NJbnRlcmZhY2UuaGFzT3duUHJvcGVydHkobmFtZSlcbiAgICAgID8gUmVhY3RDbGFzc0ludGVyZmFjZVtuYW1lXVxuICAgICAgOiBudWxsO1xuXG4gICAgLy8gRGlzYWxsb3cgb3ZlcnJpZGluZyBvZiBiYXNlIGNsYXNzIG1ldGhvZHMgdW5sZXNzIGV4cGxpY2l0bHkgYWxsb3dlZC5cbiAgICBpZiAoUmVhY3RDbGFzc01peGluLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICBfaW52YXJpYW50KFxuICAgICAgICBzcGVjUG9saWN5ID09PSAnT1ZFUlJJREVfQkFTRScsXG4gICAgICAgICdSZWFjdENsYXNzSW50ZXJmYWNlOiBZb3UgYXJlIGF0dGVtcHRpbmcgdG8gb3ZlcnJpZGUgJyArXG4gICAgICAgICAgJ2Alc2AgZnJvbSB5b3VyIGNsYXNzIHNwZWNpZmljYXRpb24uIEVuc3VyZSB0aGF0IHlvdXIgbWV0aG9kIG5hbWVzICcgK1xuICAgICAgICAgICdkbyBub3Qgb3ZlcmxhcCB3aXRoIFJlYWN0IG1ldGhvZHMuJyxcbiAgICAgICAgbmFtZVxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBEaXNhbGxvdyBkZWZpbmluZyBtZXRob2RzIG1vcmUgdGhhbiBvbmNlIHVubGVzcyBleHBsaWNpdGx5IGFsbG93ZWQuXG4gICAgaWYgKGlzQWxyZWFkeURlZmluZWQpIHtcbiAgICAgIF9pbnZhcmlhbnQoXG4gICAgICAgIHNwZWNQb2xpY3kgPT09ICdERUZJTkVfTUFOWScgfHwgc3BlY1BvbGljeSA9PT0gJ0RFRklORV9NQU5ZX01FUkdFRCcsXG4gICAgICAgICdSZWFjdENsYXNzSW50ZXJmYWNlOiBZb3UgYXJlIGF0dGVtcHRpbmcgdG8gZGVmaW5lICcgK1xuICAgICAgICAgICdgJXNgIG9uIHlvdXIgY29tcG9uZW50IG1vcmUgdGhhbiBvbmNlLiBUaGlzIGNvbmZsaWN0IG1heSBiZSBkdWUgJyArXG4gICAgICAgICAgJ3RvIGEgbWl4aW4uJyxcbiAgICAgICAgbmFtZVxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogTWl4aW4gaGVscGVyIHdoaWNoIGhhbmRsZXMgcG9saWN5IHZhbGlkYXRpb24gYW5kIHJlc2VydmVkXG4gICAqIHNwZWNpZmljYXRpb24ga2V5cyB3aGVuIGJ1aWxkaW5nIFJlYWN0IGNsYXNzZXMuXG4gICAqL1xuICBmdW5jdGlvbiBtaXhTcGVjSW50b0NvbXBvbmVudChDb25zdHJ1Y3Rvciwgc3BlYykge1xuICAgIGlmICghc3BlYykge1xuICAgICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgICAgdmFyIHR5cGVvZlNwZWMgPSB0eXBlb2Ygc3BlYztcbiAgICAgICAgdmFyIGlzTWl4aW5WYWxpZCA9IHR5cGVvZlNwZWMgPT09ICdvYmplY3QnICYmIHNwZWMgIT09IG51bGw7XG5cbiAgICAgICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgICAgICB3YXJuaW5nKFxuICAgICAgICAgICAgaXNNaXhpblZhbGlkLFxuICAgICAgICAgICAgXCIlczogWW91J3JlIGF0dGVtcHRpbmcgdG8gaW5jbHVkZSBhIG1peGluIHRoYXQgaXMgZWl0aGVyIG51bGwgXCIgK1xuICAgICAgICAgICAgICAnb3Igbm90IGFuIG9iamVjdC4gQ2hlY2sgdGhlIG1peGlucyBpbmNsdWRlZCBieSB0aGUgY29tcG9uZW50LCAnICtcbiAgICAgICAgICAgICAgJ2FzIHdlbGwgYXMgYW55IG1peGlucyB0aGV5IGluY2x1ZGUgdGhlbXNlbHZlcy4gJyArXG4gICAgICAgICAgICAgICdFeHBlY3RlZCBvYmplY3QgYnV0IGdvdCAlcy4nLFxuICAgICAgICAgICAgQ29uc3RydWN0b3IuZGlzcGxheU5hbWUgfHwgJ1JlYWN0Q2xhc3MnLFxuICAgICAgICAgICAgc3BlYyA9PT0gbnVsbCA/IG51bGwgOiB0eXBlb2ZTcGVjXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgX2ludmFyaWFudChcbiAgICAgIHR5cGVvZiBzcGVjICE9PSAnZnVuY3Rpb24nLFxuICAgICAgXCJSZWFjdENsYXNzOiBZb3UncmUgYXR0ZW1wdGluZyB0byBcIiArXG4gICAgICAgICd1c2UgYSBjb21wb25lbnQgY2xhc3Mgb3IgZnVuY3Rpb24gYXMgYSBtaXhpbi4gSW5zdGVhZCwganVzdCB1c2UgYSAnICtcbiAgICAgICAgJ3JlZ3VsYXIgb2JqZWN0LidcbiAgICApO1xuICAgIF9pbnZhcmlhbnQoXG4gICAgICAhaXNWYWxpZEVsZW1lbnQoc3BlYyksXG4gICAgICBcIlJlYWN0Q2xhc3M6IFlvdSdyZSBhdHRlbXB0aW5nIHRvIFwiICtcbiAgICAgICAgJ3VzZSBhIGNvbXBvbmVudCBhcyBhIG1peGluLiBJbnN0ZWFkLCBqdXN0IHVzZSBhIHJlZ3VsYXIgb2JqZWN0LidcbiAgICApO1xuXG4gICAgdmFyIHByb3RvID0gQ29uc3RydWN0b3IucHJvdG90eXBlO1xuICAgIHZhciBhdXRvQmluZFBhaXJzID0gcHJvdG8uX19yZWFjdEF1dG9CaW5kUGFpcnM7XG5cbiAgICAvLyBCeSBoYW5kbGluZyBtaXhpbnMgYmVmb3JlIGFueSBvdGhlciBwcm9wZXJ0aWVzLCB3ZSBlbnN1cmUgdGhlIHNhbWVcbiAgICAvLyBjaGFpbmluZyBvcmRlciBpcyBhcHBsaWVkIHRvIG1ldGhvZHMgd2l0aCBERUZJTkVfTUFOWSBwb2xpY3ksIHdoZXRoZXJcbiAgICAvLyBtaXhpbnMgYXJlIGxpc3RlZCBiZWZvcmUgb3IgYWZ0ZXIgdGhlc2UgbWV0aG9kcyBpbiB0aGUgc3BlYy5cbiAgICBpZiAoc3BlYy5oYXNPd25Qcm9wZXJ0eShNSVhJTlNfS0VZKSkge1xuICAgICAgUkVTRVJWRURfU1BFQ19LRVlTLm1peGlucyhDb25zdHJ1Y3Rvciwgc3BlYy5taXhpbnMpO1xuICAgIH1cblxuICAgIGZvciAodmFyIG5hbWUgaW4gc3BlYykge1xuICAgICAgaWYgKCFzcGVjLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAobmFtZSA9PT0gTUlYSU5TX0tFWSkge1xuICAgICAgICAvLyBXZSBoYXZlIGFscmVhZHkgaGFuZGxlZCBtaXhpbnMgaW4gYSBzcGVjaWFsIGNhc2UgYWJvdmUuXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICB2YXIgcHJvcGVydHkgPSBzcGVjW25hbWVdO1xuICAgICAgdmFyIGlzQWxyZWFkeURlZmluZWQgPSBwcm90by5oYXNPd25Qcm9wZXJ0eShuYW1lKTtcbiAgICAgIHZhbGlkYXRlTWV0aG9kT3ZlcnJpZGUoaXNBbHJlYWR5RGVmaW5lZCwgbmFtZSk7XG5cbiAgICAgIGlmIChSRVNFUlZFRF9TUEVDX0tFWVMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgUkVTRVJWRURfU1BFQ19LRVlTW25hbWVdKENvbnN0cnVjdG9yLCBwcm9wZXJ0eSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBTZXR1cCBtZXRob2RzIG9uIHByb3RvdHlwZTpcbiAgICAgICAgLy8gVGhlIGZvbGxvd2luZyBtZW1iZXIgbWV0aG9kcyBzaG91bGQgbm90IGJlIGF1dG9tYXRpY2FsbHkgYm91bmQ6XG4gICAgICAgIC8vIDEuIEV4cGVjdGVkIFJlYWN0Q2xhc3MgbWV0aG9kcyAoaW4gdGhlIFwiaW50ZXJmYWNlXCIpLlxuICAgICAgICAvLyAyLiBPdmVycmlkZGVuIG1ldGhvZHMgKHRoYXQgd2VyZSBtaXhlZCBpbikuXG4gICAgICAgIHZhciBpc1JlYWN0Q2xhc3NNZXRob2QgPSBSZWFjdENsYXNzSW50ZXJmYWNlLmhhc093blByb3BlcnR5KG5hbWUpO1xuICAgICAgICB2YXIgaXNGdW5jdGlvbiA9IHR5cGVvZiBwcm9wZXJ0eSA9PT0gJ2Z1bmN0aW9uJztcbiAgICAgICAgdmFyIHNob3VsZEF1dG9CaW5kID1cbiAgICAgICAgICBpc0Z1bmN0aW9uICYmXG4gICAgICAgICAgIWlzUmVhY3RDbGFzc01ldGhvZCAmJlxuICAgICAgICAgICFpc0FscmVhZHlEZWZpbmVkICYmXG4gICAgICAgICAgc3BlYy5hdXRvYmluZCAhPT0gZmFsc2U7XG5cbiAgICAgICAgaWYgKHNob3VsZEF1dG9CaW5kKSB7XG4gICAgICAgICAgYXV0b0JpbmRQYWlycy5wdXNoKG5hbWUsIHByb3BlcnR5KTtcbiAgICAgICAgICBwcm90b1tuYW1lXSA9IHByb3BlcnR5O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChpc0FscmVhZHlEZWZpbmVkKSB7XG4gICAgICAgICAgICB2YXIgc3BlY1BvbGljeSA9IFJlYWN0Q2xhc3NJbnRlcmZhY2VbbmFtZV07XG5cbiAgICAgICAgICAgIC8vIFRoZXNlIGNhc2VzIHNob3VsZCBhbHJlYWR5IGJlIGNhdWdodCBieSB2YWxpZGF0ZU1ldGhvZE92ZXJyaWRlLlxuICAgICAgICAgICAgX2ludmFyaWFudChcbiAgICAgICAgICAgICAgaXNSZWFjdENsYXNzTWV0aG9kICYmXG4gICAgICAgICAgICAgICAgKHNwZWNQb2xpY3kgPT09ICdERUZJTkVfTUFOWV9NRVJHRUQnIHx8XG4gICAgICAgICAgICAgICAgICBzcGVjUG9saWN5ID09PSAnREVGSU5FX01BTlknKSxcbiAgICAgICAgICAgICAgJ1JlYWN0Q2xhc3M6IFVuZXhwZWN0ZWQgc3BlYyBwb2xpY3kgJXMgZm9yIGtleSAlcyAnICtcbiAgICAgICAgICAgICAgICAnd2hlbiBtaXhpbmcgaW4gY29tcG9uZW50IHNwZWNzLicsXG4gICAgICAgICAgICAgIHNwZWNQb2xpY3ksXG4gICAgICAgICAgICAgIG5hbWVcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIC8vIEZvciBtZXRob2RzIHdoaWNoIGFyZSBkZWZpbmVkIG1vcmUgdGhhbiBvbmNlLCBjYWxsIHRoZSBleGlzdGluZ1xuICAgICAgICAgICAgLy8gbWV0aG9kcyBiZWZvcmUgY2FsbGluZyB0aGUgbmV3IHByb3BlcnR5LCBtZXJnaW5nIGlmIGFwcHJvcHJpYXRlLlxuICAgICAgICAgICAgaWYgKHNwZWNQb2xpY3kgPT09ICdERUZJTkVfTUFOWV9NRVJHRUQnKSB7XG4gICAgICAgICAgICAgIHByb3RvW25hbWVdID0gY3JlYXRlTWVyZ2VkUmVzdWx0RnVuY3Rpb24ocHJvdG9bbmFtZV0sIHByb3BlcnR5KTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc3BlY1BvbGljeSA9PT0gJ0RFRklORV9NQU5ZJykge1xuICAgICAgICAgICAgICBwcm90b1tuYW1lXSA9IGNyZWF0ZUNoYWluZWRGdW5jdGlvbihwcm90b1tuYW1lXSwgcHJvcGVydHkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwcm90b1tuYW1lXSA9IHByb3BlcnR5O1xuICAgICAgICAgICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgICAgICAgICAgLy8gQWRkIHZlcmJvc2UgZGlzcGxheU5hbWUgdG8gdGhlIGZ1bmN0aW9uLCB3aGljaCBoZWxwcyB3aGVuIGxvb2tpbmdcbiAgICAgICAgICAgICAgLy8gYXQgcHJvZmlsaW5nIHRvb2xzLlxuICAgICAgICAgICAgICBpZiAodHlwZW9mIHByb3BlcnR5ID09PSAnZnVuY3Rpb24nICYmIHNwZWMuZGlzcGxheU5hbWUpIHtcbiAgICAgICAgICAgICAgICBwcm90b1tuYW1lXS5kaXNwbGF5TmFtZSA9IHNwZWMuZGlzcGxheU5hbWUgKyAnXycgKyBuYW1lO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gbWl4U3RhdGljU3BlY0ludG9Db21wb25lbnQoQ29uc3RydWN0b3IsIHN0YXRpY3MpIHtcbiAgICBpZiAoIXN0YXRpY3MpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZm9yICh2YXIgbmFtZSBpbiBzdGF0aWNzKSB7XG4gICAgICB2YXIgcHJvcGVydHkgPSBzdGF0aWNzW25hbWVdO1xuICAgICAgaWYgKCFzdGF0aWNzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICB2YXIgaXNSZXNlcnZlZCA9IG5hbWUgaW4gUkVTRVJWRURfU1BFQ19LRVlTO1xuICAgICAgX2ludmFyaWFudChcbiAgICAgICAgIWlzUmVzZXJ2ZWQsXG4gICAgICAgICdSZWFjdENsYXNzOiBZb3UgYXJlIGF0dGVtcHRpbmcgdG8gZGVmaW5lIGEgcmVzZXJ2ZWQgJyArXG4gICAgICAgICAgJ3Byb3BlcnR5LCBgJXNgLCB0aGF0IHNob3VsZG5cXCd0IGJlIG9uIHRoZSBcInN0YXRpY3NcIiBrZXkuIERlZmluZSBpdCAnICtcbiAgICAgICAgICAnYXMgYW4gaW5zdGFuY2UgcHJvcGVydHkgaW5zdGVhZDsgaXQgd2lsbCBzdGlsbCBiZSBhY2Nlc3NpYmxlIG9uIHRoZSAnICtcbiAgICAgICAgICAnY29uc3RydWN0b3IuJyxcbiAgICAgICAgbmFtZVxuICAgICAgKTtcblxuICAgICAgdmFyIGlzSW5oZXJpdGVkID0gbmFtZSBpbiBDb25zdHJ1Y3RvcjtcbiAgICAgIF9pbnZhcmlhbnQoXG4gICAgICAgICFpc0luaGVyaXRlZCxcbiAgICAgICAgJ1JlYWN0Q2xhc3M6IFlvdSBhcmUgYXR0ZW1wdGluZyB0byBkZWZpbmUgJyArXG4gICAgICAgICAgJ2Alc2Agb24geW91ciBjb21wb25lbnQgbW9yZSB0aGFuIG9uY2UuIFRoaXMgY29uZmxpY3QgbWF5IGJlICcgK1xuICAgICAgICAgICdkdWUgdG8gYSBtaXhpbi4nLFxuICAgICAgICBuYW1lXG4gICAgICApO1xuICAgICAgQ29uc3RydWN0b3JbbmFtZV0gPSBwcm9wZXJ0eTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogTWVyZ2UgdHdvIG9iamVjdHMsIGJ1dCB0aHJvdyBpZiBib3RoIGNvbnRhaW4gdGhlIHNhbWUga2V5LlxuICAgKlxuICAgKiBAcGFyYW0ge29iamVjdH0gb25lIFRoZSBmaXJzdCBvYmplY3QsIHdoaWNoIGlzIG11dGF0ZWQuXG4gICAqIEBwYXJhbSB7b2JqZWN0fSB0d28gVGhlIHNlY29uZCBvYmplY3RcbiAgICogQHJldHVybiB7b2JqZWN0fSBvbmUgYWZ0ZXIgaXQgaGFzIGJlZW4gbXV0YXRlZCB0byBjb250YWluIGV2ZXJ5dGhpbmcgaW4gdHdvLlxuICAgKi9cbiAgZnVuY3Rpb24gbWVyZ2VJbnRvV2l0aE5vRHVwbGljYXRlS2V5cyhvbmUsIHR3bykge1xuICAgIF9pbnZhcmlhbnQoXG4gICAgICBvbmUgJiYgdHdvICYmIHR5cGVvZiBvbmUgPT09ICdvYmplY3QnICYmIHR5cGVvZiB0d28gPT09ICdvYmplY3QnLFxuICAgICAgJ21lcmdlSW50b1dpdGhOb0R1cGxpY2F0ZUtleXMoKTogQ2Fubm90IG1lcmdlIG5vbi1vYmplY3RzLidcbiAgICApO1xuXG4gICAgZm9yICh2YXIga2V5IGluIHR3bykge1xuICAgICAgaWYgKHR3by5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgIF9pbnZhcmlhbnQoXG4gICAgICAgICAgb25lW2tleV0gPT09IHVuZGVmaW5lZCxcbiAgICAgICAgICAnbWVyZ2VJbnRvV2l0aE5vRHVwbGljYXRlS2V5cygpOiAnICtcbiAgICAgICAgICAgICdUcmllZCB0byBtZXJnZSB0d28gb2JqZWN0cyB3aXRoIHRoZSBzYW1lIGtleTogYCVzYC4gVGhpcyBjb25mbGljdCAnICtcbiAgICAgICAgICAgICdtYXkgYmUgZHVlIHRvIGEgbWl4aW47IGluIHBhcnRpY3VsYXIsIHRoaXMgbWF5IGJlIGNhdXNlZCBieSB0d28gJyArXG4gICAgICAgICAgICAnZ2V0SW5pdGlhbFN0YXRlKCkgb3IgZ2V0RGVmYXVsdFByb3BzKCkgbWV0aG9kcyByZXR1cm5pbmcgb2JqZWN0cyAnICtcbiAgICAgICAgICAgICd3aXRoIGNsYXNoaW5nIGtleXMuJyxcbiAgICAgICAgICBrZXlcbiAgICAgICAgKTtcbiAgICAgICAgb25lW2tleV0gPSB0d29ba2V5XTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9uZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCBpbnZva2VzIHR3byBmdW5jdGlvbnMgYW5kIG1lcmdlcyB0aGVpciByZXR1cm4gdmFsdWVzLlxuICAgKlxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBvbmUgRnVuY3Rpb24gdG8gaW52b2tlIGZpcnN0LlxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSB0d28gRnVuY3Rpb24gdG8gaW52b2tlIHNlY29uZC5cbiAgICogQHJldHVybiB7ZnVuY3Rpb259IEZ1bmN0aW9uIHRoYXQgaW52b2tlcyB0aGUgdHdvIGFyZ3VtZW50IGZ1bmN0aW9ucy5cbiAgICogQHByaXZhdGVcbiAgICovXG4gIGZ1bmN0aW9uIGNyZWF0ZU1lcmdlZFJlc3VsdEZ1bmN0aW9uKG9uZSwgdHdvKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIG1lcmdlZFJlc3VsdCgpIHtcbiAgICAgIHZhciBhID0gb25lLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICB2YXIgYiA9IHR3by5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgaWYgKGEgPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gYjtcbiAgICAgIH0gZWxzZSBpZiAoYiA9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBhO1xuICAgICAgfVxuICAgICAgdmFyIGMgPSB7fTtcbiAgICAgIG1lcmdlSW50b1dpdGhOb0R1cGxpY2F0ZUtleXMoYywgYSk7XG4gICAgICBtZXJnZUludG9XaXRoTm9EdXBsaWNhdGVLZXlzKGMsIGIpO1xuICAgICAgcmV0dXJuIGM7XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCBpbnZva2VzIHR3byBmdW5jdGlvbnMgYW5kIGlnbm9yZXMgdGhlaXIgcmV0dXJuIHZhbGVzLlxuICAgKlxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBvbmUgRnVuY3Rpb24gdG8gaW52b2tlIGZpcnN0LlxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSB0d28gRnVuY3Rpb24gdG8gaW52b2tlIHNlY29uZC5cbiAgICogQHJldHVybiB7ZnVuY3Rpb259IEZ1bmN0aW9uIHRoYXQgaW52b2tlcyB0aGUgdHdvIGFyZ3VtZW50IGZ1bmN0aW9ucy5cbiAgICogQHByaXZhdGVcbiAgICovXG4gIGZ1bmN0aW9uIGNyZWF0ZUNoYWluZWRGdW5jdGlvbihvbmUsIHR3bykge1xuICAgIHJldHVybiBmdW5jdGlvbiBjaGFpbmVkRnVuY3Rpb24oKSB7XG4gICAgICBvbmUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgIHR3by5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQmluZHMgYSBtZXRob2QgdG8gdGhlIGNvbXBvbmVudC5cbiAgICpcbiAgICogQHBhcmFtIHtvYmplY3R9IGNvbXBvbmVudCBDb21wb25lbnQgd2hvc2UgbWV0aG9kIGlzIGdvaW5nIHRvIGJlIGJvdW5kLlxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBtZXRob2QgTWV0aG9kIHRvIGJlIGJvdW5kLlxuICAgKiBAcmV0dXJuIHtmdW5jdGlvbn0gVGhlIGJvdW5kIG1ldGhvZC5cbiAgICovXG4gIGZ1bmN0aW9uIGJpbmRBdXRvQmluZE1ldGhvZChjb21wb25lbnQsIG1ldGhvZCkge1xuICAgIHZhciBib3VuZE1ldGhvZCA9IG1ldGhvZC5iaW5kKGNvbXBvbmVudCk7XG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgIGJvdW5kTWV0aG9kLl9fcmVhY3RCb3VuZENvbnRleHQgPSBjb21wb25lbnQ7XG4gICAgICBib3VuZE1ldGhvZC5fX3JlYWN0Qm91bmRNZXRob2QgPSBtZXRob2Q7XG4gICAgICBib3VuZE1ldGhvZC5fX3JlYWN0Qm91bmRBcmd1bWVudHMgPSBudWxsO1xuICAgICAgdmFyIGNvbXBvbmVudE5hbWUgPSBjb21wb25lbnQuY29uc3RydWN0b3IuZGlzcGxheU5hbWU7XG4gICAgICB2YXIgX2JpbmQgPSBib3VuZE1ldGhvZC5iaW5kO1xuICAgICAgYm91bmRNZXRob2QuYmluZCA9IGZ1bmN0aW9uKG5ld1RoaXMpIHtcbiAgICAgICAgZm9yIChcbiAgICAgICAgICB2YXIgX2xlbiA9IGFyZ3VtZW50cy5sZW5ndGgsXG4gICAgICAgICAgICBhcmdzID0gQXJyYXkoX2xlbiA+IDEgPyBfbGVuIC0gMSA6IDApLFxuICAgICAgICAgICAgX2tleSA9IDE7XG4gICAgICAgICAgX2tleSA8IF9sZW47XG4gICAgICAgICAgX2tleSsrXG4gICAgICAgICkge1xuICAgICAgICAgIGFyZ3NbX2tleSAtIDFdID0gYXJndW1lbnRzW19rZXldO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXNlciBpcyB0cnlpbmcgdG8gYmluZCgpIGFuIGF1dG9ib3VuZCBtZXRob2Q7IHdlIGVmZmVjdGl2ZWx5IHdpbGxcbiAgICAgICAgLy8gaWdub3JlIHRoZSB2YWx1ZSBvZiBcInRoaXNcIiB0aGF0IHRoZSB1c2VyIGlzIHRyeWluZyB0byB1c2UsIHNvXG4gICAgICAgIC8vIGxldCdzIHdhcm4uXG4gICAgICAgIGlmIChuZXdUaGlzICE9PSBjb21wb25lbnQgJiYgbmV3VGhpcyAhPT0gbnVsbCkge1xuICAgICAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgICAgICB3YXJuaW5nKFxuICAgICAgICAgICAgICBmYWxzZSxcbiAgICAgICAgICAgICAgJ2JpbmQoKTogUmVhY3QgY29tcG9uZW50IG1ldGhvZHMgbWF5IG9ubHkgYmUgYm91bmQgdG8gdGhlICcgK1xuICAgICAgICAgICAgICAgICdjb21wb25lbnQgaW5zdGFuY2UuIFNlZSAlcycsXG4gICAgICAgICAgICAgIGNvbXBvbmVudE5hbWVcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKCFhcmdzLmxlbmd0aCkge1xuICAgICAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgICAgICB3YXJuaW5nKFxuICAgICAgICAgICAgICBmYWxzZSxcbiAgICAgICAgICAgICAgJ2JpbmQoKTogWW91IGFyZSBiaW5kaW5nIGEgY29tcG9uZW50IG1ldGhvZCB0byB0aGUgY29tcG9uZW50LiAnICtcbiAgICAgICAgICAgICAgICAnUmVhY3QgZG9lcyB0aGlzIGZvciB5b3UgYXV0b21hdGljYWxseSBpbiBhIGhpZ2gtcGVyZm9ybWFuY2UgJyArXG4gICAgICAgICAgICAgICAgJ3dheSwgc28geW91IGNhbiBzYWZlbHkgcmVtb3ZlIHRoaXMgY2FsbC4gU2VlICVzJyxcbiAgICAgICAgICAgICAgY29tcG9uZW50TmFtZVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGJvdW5kTWV0aG9kO1xuICAgICAgICB9XG4gICAgICAgIHZhciByZWJvdW5kTWV0aG9kID0gX2JpbmQuYXBwbHkoYm91bmRNZXRob2QsIGFyZ3VtZW50cyk7XG4gICAgICAgIHJlYm91bmRNZXRob2QuX19yZWFjdEJvdW5kQ29udGV4dCA9IGNvbXBvbmVudDtcbiAgICAgICAgcmVib3VuZE1ldGhvZC5fX3JlYWN0Qm91bmRNZXRob2QgPSBtZXRob2Q7XG4gICAgICAgIHJlYm91bmRNZXRob2QuX19yZWFjdEJvdW5kQXJndW1lbnRzID0gYXJncztcbiAgICAgICAgcmV0dXJuIHJlYm91bmRNZXRob2Q7XG4gICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4gYm91bmRNZXRob2Q7XG4gIH1cblxuICAvKipcbiAgICogQmluZHMgYWxsIGF1dG8tYm91bmQgbWV0aG9kcyBpbiBhIGNvbXBvbmVudC5cbiAgICpcbiAgICogQHBhcmFtIHtvYmplY3R9IGNvbXBvbmVudCBDb21wb25lbnQgd2hvc2UgbWV0aG9kIGlzIGdvaW5nIHRvIGJlIGJvdW5kLlxuICAgKi9cbiAgZnVuY3Rpb24gYmluZEF1dG9CaW5kTWV0aG9kcyhjb21wb25lbnQpIHtcbiAgICB2YXIgcGFpcnMgPSBjb21wb25lbnQuX19yZWFjdEF1dG9CaW5kUGFpcnM7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwYWlycy5sZW5ndGg7IGkgKz0gMikge1xuICAgICAgdmFyIGF1dG9CaW5kS2V5ID0gcGFpcnNbaV07XG4gICAgICB2YXIgbWV0aG9kID0gcGFpcnNbaSArIDFdO1xuICAgICAgY29tcG9uZW50W2F1dG9CaW5kS2V5XSA9IGJpbmRBdXRvQmluZE1ldGhvZChjb21wb25lbnQsIG1ldGhvZCk7XG4gICAgfVxuICB9XG5cbiAgdmFyIElzTW91bnRlZFByZU1peGluID0ge1xuICAgIGNvbXBvbmVudERpZE1vdW50OiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuX19pc01vdW50ZWQgPSB0cnVlO1xuICAgIH1cbiAgfTtcblxuICB2YXIgSXNNb3VudGVkUG9zdE1peGluID0ge1xuICAgIGNvbXBvbmVudFdpbGxVbm1vdW50OiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuX19pc01vdW50ZWQgPSBmYWxzZTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIEFkZCBtb3JlIHRvIHRoZSBSZWFjdENsYXNzIGJhc2UgY2xhc3MuIFRoZXNlIGFyZSBhbGwgbGVnYWN5IGZlYXR1cmVzIGFuZFxuICAgKiB0aGVyZWZvcmUgbm90IGFscmVhZHkgcGFydCBvZiB0aGUgbW9kZXJuIFJlYWN0Q29tcG9uZW50LlxuICAgKi9cbiAgdmFyIFJlYWN0Q2xhc3NNaXhpbiA9IHtcbiAgICAvKipcbiAgICAgKiBUT0RPOiBUaGlzIHdpbGwgYmUgZGVwcmVjYXRlZCBiZWNhdXNlIHN0YXRlIHNob3VsZCBhbHdheXMga2VlcCBhIGNvbnNpc3RlbnRcbiAgICAgKiB0eXBlIHNpZ25hdHVyZSBhbmQgdGhlIG9ubHkgdXNlIGNhc2UgZm9yIHRoaXMsIGlzIHRvIGF2b2lkIHRoYXQuXG4gICAgICovXG4gICAgcmVwbGFjZVN0YXRlOiBmdW5jdGlvbihuZXdTdGF0ZSwgY2FsbGJhY2spIHtcbiAgICAgIHRoaXMudXBkYXRlci5lbnF1ZXVlUmVwbGFjZVN0YXRlKHRoaXMsIG5ld1N0YXRlLCBjYWxsYmFjayk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENoZWNrcyB3aGV0aGVyIG9yIG5vdCB0aGlzIGNvbXBvc2l0ZSBjb21wb25lbnQgaXMgbW91bnRlZC5cbiAgICAgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIGlmIG1vdW50ZWQsIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAcHJvdGVjdGVkXG4gICAgICogQGZpbmFsXG4gICAgICovXG4gICAgaXNNb3VudGVkOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgIHdhcm5pbmcoXG4gICAgICAgICAgdGhpcy5fX2RpZFdhcm5Jc01vdW50ZWQsXG4gICAgICAgICAgJyVzOiBpc01vdW50ZWQgaXMgZGVwcmVjYXRlZC4gSW5zdGVhZCwgbWFrZSBzdXJlIHRvIGNsZWFuIHVwICcgK1xuICAgICAgICAgICAgJ3N1YnNjcmlwdGlvbnMgYW5kIHBlbmRpbmcgcmVxdWVzdHMgaW4gY29tcG9uZW50V2lsbFVubW91bnQgdG8gJyArXG4gICAgICAgICAgICAncHJldmVudCBtZW1vcnkgbGVha3MuJyxcbiAgICAgICAgICAodGhpcy5jb25zdHJ1Y3RvciAmJiB0aGlzLmNvbnN0cnVjdG9yLmRpc3BsYXlOYW1lKSB8fFxuICAgICAgICAgICAgdGhpcy5uYW1lIHx8XG4gICAgICAgICAgICAnQ29tcG9uZW50J1xuICAgICAgICApO1xuICAgICAgICB0aGlzLl9fZGlkV2FybklzTW91bnRlZCA9IHRydWU7XG4gICAgICB9XG4gICAgICByZXR1cm4gISF0aGlzLl9faXNNb3VudGVkO1xuICAgIH1cbiAgfTtcblxuICB2YXIgUmVhY3RDbGFzc0NvbXBvbmVudCA9IGZ1bmN0aW9uKCkge307XG4gIF9hc3NpZ24oXG4gICAgUmVhY3RDbGFzc0NvbXBvbmVudC5wcm90b3R5cGUsXG4gICAgUmVhY3RDb21wb25lbnQucHJvdG90eXBlLFxuICAgIFJlYWN0Q2xhc3NNaXhpblxuICApO1xuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgY29tcG9zaXRlIGNvbXBvbmVudCBjbGFzcyBnaXZlbiBhIGNsYXNzIHNwZWNpZmljYXRpb24uXG4gICAqIFNlZSBodHRwczovL2ZhY2Vib29rLmdpdGh1Yi5pby9yZWFjdC9kb2NzL3RvcC1sZXZlbC1hcGkuaHRtbCNyZWFjdC5jcmVhdGVjbGFzc1xuICAgKlxuICAgKiBAcGFyYW0ge29iamVjdH0gc3BlYyBDbGFzcyBzcGVjaWZpY2F0aW9uICh3aGljaCBtdXN0IGRlZmluZSBgcmVuZGVyYCkuXG4gICAqIEByZXR1cm4ge2Z1bmN0aW9ufSBDb21wb25lbnQgY29uc3RydWN0b3IgZnVuY3Rpb24uXG4gICAqIEBwdWJsaWNcbiAgICovXG4gIGZ1bmN0aW9uIGNyZWF0ZUNsYXNzKHNwZWMpIHtcbiAgICAvLyBUbyBrZWVwIG91ciB3YXJuaW5ncyBtb3JlIHVuZGVyc3RhbmRhYmxlLCB3ZSdsbCB1c2UgYSBsaXR0bGUgaGFjayBoZXJlIHRvXG4gICAgLy8gZW5zdXJlIHRoYXQgQ29uc3RydWN0b3IubmFtZSAhPT0gJ0NvbnN0cnVjdG9yJy4gVGhpcyBtYWtlcyBzdXJlIHdlIGRvbid0XG4gICAgLy8gdW5uZWNlc3NhcmlseSBpZGVudGlmeSBhIGNsYXNzIHdpdGhvdXQgZGlzcGxheU5hbWUgYXMgJ0NvbnN0cnVjdG9yJy5cbiAgICB2YXIgQ29uc3RydWN0b3IgPSBpZGVudGl0eShmdW5jdGlvbihwcm9wcywgY29udGV4dCwgdXBkYXRlcikge1xuICAgICAgLy8gVGhpcyBjb25zdHJ1Y3RvciBnZXRzIG92ZXJyaWRkZW4gYnkgbW9ja3MuIFRoZSBhcmd1bWVudCBpcyB1c2VkXG4gICAgICAvLyBieSBtb2NrcyB0byBhc3NlcnQgb24gd2hhdCBnZXRzIG1vdW50ZWQuXG5cbiAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgIHdhcm5pbmcoXG4gICAgICAgICAgdGhpcyBpbnN0YW5jZW9mIENvbnN0cnVjdG9yLFxuICAgICAgICAgICdTb21ldGhpbmcgaXMgY2FsbGluZyBhIFJlYWN0IGNvbXBvbmVudCBkaXJlY3RseS4gVXNlIGEgZmFjdG9yeSBvciAnICtcbiAgICAgICAgICAgICdKU1ggaW5zdGVhZC4gU2VlOiBodHRwczovL2ZiLm1lL3JlYWN0LWxlZ2FjeWZhY3RvcnknXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIC8vIFdpcmUgdXAgYXV0by1iaW5kaW5nXG4gICAgICBpZiAodGhpcy5fX3JlYWN0QXV0b0JpbmRQYWlycy5sZW5ndGgpIHtcbiAgICAgICAgYmluZEF1dG9CaW5kTWV0aG9kcyh0aGlzKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5wcm9wcyA9IHByb3BzO1xuICAgICAgdGhpcy5jb250ZXh0ID0gY29udGV4dDtcbiAgICAgIHRoaXMucmVmcyA9IGVtcHR5T2JqZWN0O1xuICAgICAgdGhpcy51cGRhdGVyID0gdXBkYXRlciB8fCBSZWFjdE5vb3BVcGRhdGVRdWV1ZTtcblxuICAgICAgdGhpcy5zdGF0ZSA9IG51bGw7XG5cbiAgICAgIC8vIFJlYWN0Q2xhc3NlcyBkb2Vzbid0IGhhdmUgY29uc3RydWN0b3JzLiBJbnN0ZWFkLCB0aGV5IHVzZSB0aGVcbiAgICAgIC8vIGdldEluaXRpYWxTdGF0ZSBhbmQgY29tcG9uZW50V2lsbE1vdW50IG1ldGhvZHMgZm9yIGluaXRpYWxpemF0aW9uLlxuXG4gICAgICB2YXIgaW5pdGlhbFN0YXRlID0gdGhpcy5nZXRJbml0aWFsU3RhdGUgPyB0aGlzLmdldEluaXRpYWxTdGF0ZSgpIDogbnVsbDtcbiAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgIC8vIFdlIGFsbG93IGF1dG8tbW9ja3MgdG8gcHJvY2VlZCBhcyBpZiB0aGV5J3JlIHJldHVybmluZyBudWxsLlxuICAgICAgICBpZiAoXG4gICAgICAgICAgaW5pdGlhbFN0YXRlID09PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICB0aGlzLmdldEluaXRpYWxTdGF0ZS5faXNNb2NrRnVuY3Rpb25cbiAgICAgICAgKSB7XG4gICAgICAgICAgLy8gVGhpcyBpcyBwcm9iYWJseSBiYWQgcHJhY3RpY2UuIENvbnNpZGVyIHdhcm5pbmcgaGVyZSBhbmRcbiAgICAgICAgICAvLyBkZXByZWNhdGluZyB0aGlzIGNvbnZlbmllbmNlLlxuICAgICAgICAgIGluaXRpYWxTdGF0ZSA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIF9pbnZhcmlhbnQoXG4gICAgICAgIHR5cGVvZiBpbml0aWFsU3RhdGUgPT09ICdvYmplY3QnICYmICFBcnJheS5pc0FycmF5KGluaXRpYWxTdGF0ZSksXG4gICAgICAgICclcy5nZXRJbml0aWFsU3RhdGUoKTogbXVzdCByZXR1cm4gYW4gb2JqZWN0IG9yIG51bGwnLFxuICAgICAgICBDb25zdHJ1Y3Rvci5kaXNwbGF5TmFtZSB8fCAnUmVhY3RDb21wb3NpdGVDb21wb25lbnQnXG4gICAgICApO1xuXG4gICAgICB0aGlzLnN0YXRlID0gaW5pdGlhbFN0YXRlO1xuICAgIH0pO1xuICAgIENvbnN0cnVjdG9yLnByb3RvdHlwZSA9IG5ldyBSZWFjdENsYXNzQ29tcG9uZW50KCk7XG4gICAgQ29uc3RydWN0b3IucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gQ29uc3RydWN0b3I7XG4gICAgQ29uc3RydWN0b3IucHJvdG90eXBlLl9fcmVhY3RBdXRvQmluZFBhaXJzID0gW107XG5cbiAgICBpbmplY3RlZE1peGlucy5mb3JFYWNoKG1peFNwZWNJbnRvQ29tcG9uZW50LmJpbmQobnVsbCwgQ29uc3RydWN0b3IpKTtcblxuICAgIG1peFNwZWNJbnRvQ29tcG9uZW50KENvbnN0cnVjdG9yLCBJc01vdW50ZWRQcmVNaXhpbik7XG4gICAgbWl4U3BlY0ludG9Db21wb25lbnQoQ29uc3RydWN0b3IsIHNwZWMpO1xuICAgIG1peFNwZWNJbnRvQ29tcG9uZW50KENvbnN0cnVjdG9yLCBJc01vdW50ZWRQb3N0TWl4aW4pO1xuXG4gICAgLy8gSW5pdGlhbGl6ZSB0aGUgZGVmYXVsdFByb3BzIHByb3BlcnR5IGFmdGVyIGFsbCBtaXhpbnMgaGF2ZSBiZWVuIG1lcmdlZC5cbiAgICBpZiAoQ29uc3RydWN0b3IuZ2V0RGVmYXVsdFByb3BzKSB7XG4gICAgICBDb25zdHJ1Y3Rvci5kZWZhdWx0UHJvcHMgPSBDb25zdHJ1Y3Rvci5nZXREZWZhdWx0UHJvcHMoKTtcbiAgICB9XG5cbiAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgLy8gVGhpcyBpcyBhIHRhZyB0byBpbmRpY2F0ZSB0aGF0IHRoZSB1c2Ugb2YgdGhlc2UgbWV0aG9kIG5hbWVzIGlzIG9rLFxuICAgICAgLy8gc2luY2UgaXQncyB1c2VkIHdpdGggY3JlYXRlQ2xhc3MuIElmIGl0J3Mgbm90LCB0aGVuIGl0J3MgbGlrZWx5IGFcbiAgICAgIC8vIG1pc3Rha2Ugc28gd2UnbGwgd2FybiB5b3UgdG8gdXNlIHRoZSBzdGF0aWMgcHJvcGVydHksIHByb3BlcnR5XG4gICAgICAvLyBpbml0aWFsaXplciBvciBjb25zdHJ1Y3RvciByZXNwZWN0aXZlbHkuXG4gICAgICBpZiAoQ29uc3RydWN0b3IuZ2V0RGVmYXVsdFByb3BzKSB7XG4gICAgICAgIENvbnN0cnVjdG9yLmdldERlZmF1bHRQcm9wcy5pc1JlYWN0Q2xhc3NBcHByb3ZlZCA9IHt9O1xuICAgICAgfVxuICAgICAgaWYgKENvbnN0cnVjdG9yLnByb3RvdHlwZS5nZXRJbml0aWFsU3RhdGUpIHtcbiAgICAgICAgQ29uc3RydWN0b3IucHJvdG90eXBlLmdldEluaXRpYWxTdGF0ZS5pc1JlYWN0Q2xhc3NBcHByb3ZlZCA9IHt9O1xuICAgICAgfVxuICAgIH1cblxuICAgIF9pbnZhcmlhbnQoXG4gICAgICBDb25zdHJ1Y3Rvci5wcm90b3R5cGUucmVuZGVyLFxuICAgICAgJ2NyZWF0ZUNsYXNzKC4uLik6IENsYXNzIHNwZWNpZmljYXRpb24gbXVzdCBpbXBsZW1lbnQgYSBgcmVuZGVyYCBtZXRob2QuJ1xuICAgICk7XG5cbiAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgd2FybmluZyhcbiAgICAgICAgIUNvbnN0cnVjdG9yLnByb3RvdHlwZS5jb21wb25lbnRTaG91bGRVcGRhdGUsXG4gICAgICAgICclcyBoYXMgYSBtZXRob2QgY2FsbGVkICcgK1xuICAgICAgICAgICdjb21wb25lbnRTaG91bGRVcGRhdGUoKS4gRGlkIHlvdSBtZWFuIHNob3VsZENvbXBvbmVudFVwZGF0ZSgpPyAnICtcbiAgICAgICAgICAnVGhlIG5hbWUgaXMgcGhyYXNlZCBhcyBhIHF1ZXN0aW9uIGJlY2F1c2UgdGhlIGZ1bmN0aW9uIGlzICcgK1xuICAgICAgICAgICdleHBlY3RlZCB0byByZXR1cm4gYSB2YWx1ZS4nLFxuICAgICAgICBzcGVjLmRpc3BsYXlOYW1lIHx8ICdBIGNvbXBvbmVudCdcbiAgICAgICk7XG4gICAgICB3YXJuaW5nKFxuICAgICAgICAhQ29uc3RydWN0b3IucHJvdG90eXBlLmNvbXBvbmVudFdpbGxSZWNpZXZlUHJvcHMsXG4gICAgICAgICclcyBoYXMgYSBtZXRob2QgY2FsbGVkICcgK1xuICAgICAgICAgICdjb21wb25lbnRXaWxsUmVjaWV2ZVByb3BzKCkuIERpZCB5b3UgbWVhbiBjb21wb25lbnRXaWxsUmVjZWl2ZVByb3BzKCk/JyxcbiAgICAgICAgc3BlYy5kaXNwbGF5TmFtZSB8fCAnQSBjb21wb25lbnQnXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIFJlZHVjZSB0aW1lIHNwZW50IGRvaW5nIGxvb2t1cHMgYnkgc2V0dGluZyB0aGVzZSBvbiB0aGUgcHJvdG90eXBlLlxuICAgIGZvciAodmFyIG1ldGhvZE5hbWUgaW4gUmVhY3RDbGFzc0ludGVyZmFjZSkge1xuICAgICAgaWYgKCFDb25zdHJ1Y3Rvci5wcm90b3R5cGVbbWV0aG9kTmFtZV0pIHtcbiAgICAgICAgQ29uc3RydWN0b3IucHJvdG90eXBlW21ldGhvZE5hbWVdID0gbnVsbDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gQ29uc3RydWN0b3I7XG4gIH1cblxuICByZXR1cm4gY3JlYXRlQ2xhc3M7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZmFjdG9yeTtcbiIsIi8qXG5vYmplY3QtYXNzaWduXG4oYykgU2luZHJlIFNvcmh1c1xuQGxpY2Vuc2UgTUlUXG4qL1xuXG4ndXNlIHN0cmljdCc7XG4vKiBlc2xpbnQtZGlzYWJsZSBuby11bnVzZWQtdmFycyAqL1xudmFyIGdldE93blByb3BlcnR5U3ltYm9scyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHM7XG52YXIgaGFzT3duUHJvcGVydHkgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xudmFyIHByb3BJc0VudW1lcmFibGUgPSBPYmplY3QucHJvdG90eXBlLnByb3BlcnR5SXNFbnVtZXJhYmxlO1xuXG5mdW5jdGlvbiB0b09iamVjdCh2YWwpIHtcblx0aWYgKHZhbCA9PT0gbnVsbCB8fCB2YWwgPT09IHVuZGVmaW5lZCkge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoJ09iamVjdC5hc3NpZ24gY2Fubm90IGJlIGNhbGxlZCB3aXRoIG51bGwgb3IgdW5kZWZpbmVkJyk7XG5cdH1cblxuXHRyZXR1cm4gT2JqZWN0KHZhbCk7XG59XG5cbmZ1bmN0aW9uIHNob3VsZFVzZU5hdGl2ZSgpIHtcblx0dHJ5IHtcblx0XHRpZiAoIU9iamVjdC5hc3NpZ24pIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHQvLyBEZXRlY3QgYnVnZ3kgcHJvcGVydHkgZW51bWVyYXRpb24gb3JkZXIgaW4gb2xkZXIgVjggdmVyc2lvbnMuXG5cblx0XHQvLyBodHRwczovL2J1Z3MuY2hyb21pdW0ub3JnL3AvdjgvaXNzdWVzL2RldGFpbD9pZD00MTE4XG5cdFx0dmFyIHRlc3QxID0gbmV3IFN0cmluZygnYWJjJyk7ICAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy13cmFwcGVyc1xuXHRcdHRlc3QxWzVdID0gJ2RlJztcblx0XHRpZiAoT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModGVzdDEpWzBdID09PSAnNScpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHQvLyBodHRwczovL2J1Z3MuY2hyb21pdW0ub3JnL3AvdjgvaXNzdWVzL2RldGFpbD9pZD0zMDU2XG5cdFx0dmFyIHRlc3QyID0ge307XG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCAxMDsgaSsrKSB7XG5cdFx0XHR0ZXN0MlsnXycgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKGkpXSA9IGk7XG5cdFx0fVxuXHRcdHZhciBvcmRlcjIgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyh0ZXN0MikubWFwKGZ1bmN0aW9uIChuKSB7XG5cdFx0XHRyZXR1cm4gdGVzdDJbbl07XG5cdFx0fSk7XG5cdFx0aWYgKG9yZGVyMi5qb2luKCcnKSAhPT0gJzAxMjM0NTY3ODknKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Ly8gaHR0cHM6Ly9idWdzLmNocm9taXVtLm9yZy9wL3Y4L2lzc3Vlcy9kZXRhaWw/aWQ9MzA1NlxuXHRcdHZhciB0ZXN0MyA9IHt9O1xuXHRcdCdhYmNkZWZnaGlqa2xtbm9wcXJzdCcuc3BsaXQoJycpLmZvckVhY2goZnVuY3Rpb24gKGxldHRlcikge1xuXHRcdFx0dGVzdDNbbGV0dGVyXSA9IGxldHRlcjtcblx0XHR9KTtcblx0XHRpZiAoT2JqZWN0LmtleXMoT2JqZWN0LmFzc2lnbih7fSwgdGVzdDMpKS5qb2luKCcnKSAhPT1cblx0XHRcdFx0J2FiY2RlZmdoaWprbG1ub3BxcnN0Jykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9IGNhdGNoIChlcnIpIHtcblx0XHQvLyBXZSBkb24ndCBleHBlY3QgYW55IG9mIHRoZSBhYm92ZSB0byB0aHJvdywgYnV0IGJldHRlciB0byBiZSBzYWZlLlxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHNob3VsZFVzZU5hdGl2ZSgpID8gT2JqZWN0LmFzc2lnbiA6IGZ1bmN0aW9uICh0YXJnZXQsIHNvdXJjZSkge1xuXHR2YXIgZnJvbTtcblx0dmFyIHRvID0gdG9PYmplY3QodGFyZ2V0KTtcblx0dmFyIHN5bWJvbHM7XG5cblx0Zm9yICh2YXIgcyA9IDE7IHMgPCBhcmd1bWVudHMubGVuZ3RoOyBzKyspIHtcblx0XHRmcm9tID0gT2JqZWN0KGFyZ3VtZW50c1tzXSk7XG5cblx0XHRmb3IgKHZhciBrZXkgaW4gZnJvbSkge1xuXHRcdFx0aWYgKGhhc093blByb3BlcnR5LmNhbGwoZnJvbSwga2V5KSkge1xuXHRcdFx0XHR0b1trZXldID0gZnJvbVtrZXldO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChnZXRPd25Qcm9wZXJ0eVN5bWJvbHMpIHtcblx0XHRcdHN5bWJvbHMgPSBnZXRPd25Qcm9wZXJ0eVN5bWJvbHMoZnJvbSk7XG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IHN5bWJvbHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0aWYgKHByb3BJc0VudW1lcmFibGUuY2FsbChmcm9tLCBzeW1ib2xzW2ldKSkge1xuXHRcdFx0XHRcdHRvW3N5bWJvbHNbaV1dID0gZnJvbVtzeW1ib2xzW2ldXTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHJldHVybiB0bztcbn07XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuLyoqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTMtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICpcbiAqIFxuICovXG5cbmZ1bmN0aW9uIG1ha2VFbXB0eUZ1bmN0aW9uKGFyZykge1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBhcmc7XG4gIH07XG59XG5cbi8qKlxuICogVGhpcyBmdW5jdGlvbiBhY2NlcHRzIGFuZCBkaXNjYXJkcyBpbnB1dHM7IGl0IGhhcyBubyBzaWRlIGVmZmVjdHMuIFRoaXMgaXNcbiAqIHByaW1hcmlseSB1c2VmdWwgaWRpb21hdGljYWxseSBmb3Igb3ZlcnJpZGFibGUgZnVuY3Rpb24gZW5kcG9pbnRzIHdoaWNoXG4gKiBhbHdheXMgbmVlZCB0byBiZSBjYWxsYWJsZSwgc2luY2UgSlMgbGFja3MgYSBudWxsLWNhbGwgaWRpb20gYWxhIENvY29hLlxuICovXG52YXIgZW1wdHlGdW5jdGlvbiA9IGZ1bmN0aW9uIGVtcHR5RnVuY3Rpb24oKSB7fTtcblxuZW1wdHlGdW5jdGlvbi50aGF0UmV0dXJucyA9IG1ha2VFbXB0eUZ1bmN0aW9uO1xuZW1wdHlGdW5jdGlvbi50aGF0UmV0dXJuc0ZhbHNlID0gbWFrZUVtcHR5RnVuY3Rpb24oZmFsc2UpO1xuZW1wdHlGdW5jdGlvbi50aGF0UmV0dXJuc1RydWUgPSBtYWtlRW1wdHlGdW5jdGlvbih0cnVlKTtcbmVtcHR5RnVuY3Rpb24udGhhdFJldHVybnNOdWxsID0gbWFrZUVtcHR5RnVuY3Rpb24obnVsbCk7XG5lbXB0eUZ1bmN0aW9uLnRoYXRSZXR1cm5zVGhpcyA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXM7XG59O1xuZW1wdHlGdW5jdGlvbi50aGF0UmV0dXJuc0FyZ3VtZW50ID0gZnVuY3Rpb24gKGFyZykge1xuICByZXR1cm4gYXJnO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBlbXB0eUZ1bmN0aW9uOyIsIi8qKlxuICogQ29weXJpZ2h0IChjKSAyMDEzLXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgZW1wdHlPYmplY3QgPSB7fTtcblxuaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgT2JqZWN0LmZyZWV6ZShlbXB0eU9iamVjdCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZW1wdHlPYmplY3Q7IiwiLyoqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTMtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICpcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbi8qKlxuICogVXNlIGludmFyaWFudCgpIHRvIGFzc2VydCBzdGF0ZSB3aGljaCB5b3VyIHByb2dyYW0gYXNzdW1lcyB0byBiZSB0cnVlLlxuICpcbiAqIFByb3ZpZGUgc3ByaW50Zi1zdHlsZSBmb3JtYXQgKG9ubHkgJXMgaXMgc3VwcG9ydGVkKSBhbmQgYXJndW1lbnRzXG4gKiB0byBwcm92aWRlIGluZm9ybWF0aW9uIGFib3V0IHdoYXQgYnJva2UgYW5kIHdoYXQgeW91IHdlcmVcbiAqIGV4cGVjdGluZy5cbiAqXG4gKiBUaGUgaW52YXJpYW50IG1lc3NhZ2Ugd2lsbCBiZSBzdHJpcHBlZCBpbiBwcm9kdWN0aW9uLCBidXQgdGhlIGludmFyaWFudFxuICogd2lsbCByZW1haW4gdG8gZW5zdXJlIGxvZ2ljIGRvZXMgbm90IGRpZmZlciBpbiBwcm9kdWN0aW9uLlxuICovXG5cbnZhciB2YWxpZGF0ZUZvcm1hdCA9IGZ1bmN0aW9uIHZhbGlkYXRlRm9ybWF0KGZvcm1hdCkge307XG5cbmlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gIHZhbGlkYXRlRm9ybWF0ID0gZnVuY3Rpb24gdmFsaWRhdGVGb3JtYXQoZm9ybWF0KSB7XG4gICAgaWYgKGZvcm1hdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2ludmFyaWFudCByZXF1aXJlcyBhbiBlcnJvciBtZXNzYWdlIGFyZ3VtZW50Jyk7XG4gICAgfVxuICB9O1xufVxuXG5mdW5jdGlvbiBpbnZhcmlhbnQoY29uZGl0aW9uLCBmb3JtYXQsIGEsIGIsIGMsIGQsIGUsIGYpIHtcbiAgdmFsaWRhdGVGb3JtYXQoZm9ybWF0KTtcblxuICBpZiAoIWNvbmRpdGlvbikge1xuICAgIHZhciBlcnJvcjtcbiAgICBpZiAoZm9ybWF0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGVycm9yID0gbmV3IEVycm9yKCdNaW5pZmllZCBleGNlcHRpb24gb2NjdXJyZWQ7IHVzZSB0aGUgbm9uLW1pbmlmaWVkIGRldiBlbnZpcm9ubWVudCAnICsgJ2ZvciB0aGUgZnVsbCBlcnJvciBtZXNzYWdlIGFuZCBhZGRpdGlvbmFsIGhlbHBmdWwgd2FybmluZ3MuJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBhcmdzID0gW2EsIGIsIGMsIGQsIGUsIGZdO1xuICAgICAgdmFyIGFyZ0luZGV4ID0gMDtcbiAgICAgIGVycm9yID0gbmV3IEVycm9yKGZvcm1hdC5yZXBsYWNlKC8lcy9nLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBhcmdzW2FyZ0luZGV4KytdO1xuICAgICAgfSkpO1xuICAgICAgZXJyb3IubmFtZSA9ICdJbnZhcmlhbnQgVmlvbGF0aW9uJztcbiAgICB9XG5cbiAgICBlcnJvci5mcmFtZXNUb1BvcCA9IDE7IC8vIHdlIGRvbid0IGNhcmUgYWJvdXQgaW52YXJpYW50J3Mgb3duIGZyYW1lXG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpbnZhcmlhbnQ7IiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNC0yMDE1LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIGVtcHR5RnVuY3Rpb24gPSByZXF1aXJlKCcuL2VtcHR5RnVuY3Rpb24nKTtcblxuLyoqXG4gKiBTaW1pbGFyIHRvIGludmFyaWFudCBidXQgb25seSBsb2dzIGEgd2FybmluZyBpZiB0aGUgY29uZGl0aW9uIGlzIG5vdCBtZXQuXG4gKiBUaGlzIGNhbiBiZSB1c2VkIHRvIGxvZyBpc3N1ZXMgaW4gZGV2ZWxvcG1lbnQgZW52aXJvbm1lbnRzIGluIGNyaXRpY2FsXG4gKiBwYXRocy4gUmVtb3ZpbmcgdGhlIGxvZ2dpbmcgY29kZSBmb3IgcHJvZHVjdGlvbiBlbnZpcm9ubWVudHMgd2lsbCBrZWVwIHRoZVxuICogc2FtZSBsb2dpYyBhbmQgZm9sbG93IHRoZSBzYW1lIGNvZGUgcGF0aHMuXG4gKi9cblxudmFyIHdhcm5pbmcgPSBlbXB0eUZ1bmN0aW9uO1xuXG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICB2YXIgcHJpbnRXYXJuaW5nID0gZnVuY3Rpb24gcHJpbnRXYXJuaW5nKGZvcm1hdCkge1xuICAgIGZvciAodmFyIF9sZW4gPSBhcmd1bWVudHMubGVuZ3RoLCBhcmdzID0gQXJyYXkoX2xlbiA+IDEgPyBfbGVuIC0gMSA6IDApLCBfa2V5ID0gMTsgX2tleSA8IF9sZW47IF9rZXkrKykge1xuICAgICAgYXJnc1tfa2V5IC0gMV0gPSBhcmd1bWVudHNbX2tleV07XG4gICAgfVxuXG4gICAgdmFyIGFyZ0luZGV4ID0gMDtcbiAgICB2YXIgbWVzc2FnZSA9ICdXYXJuaW5nOiAnICsgZm9ybWF0LnJlcGxhY2UoLyVzL2csIGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBhcmdzW2FyZ0luZGV4KytdO1xuICAgIH0pO1xuICAgIGlmICh0eXBlb2YgY29uc29sZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IobWVzc2FnZSk7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAvLyAtLS0gV2VsY29tZSB0byBkZWJ1Z2dpbmcgUmVhY3QgLS0tXG4gICAgICAvLyBUaGlzIGVycm9yIHdhcyB0aHJvd24gYXMgYSBjb252ZW5pZW5jZSBzbyB0aGF0IHlvdSBjYW4gdXNlIHRoaXMgc3RhY2tcbiAgICAgIC8vIHRvIGZpbmQgdGhlIGNhbGxzaXRlIHRoYXQgY2F1c2VkIHRoaXMgd2FybmluZyB0byBmaXJlLlxuICAgICAgdGhyb3cgbmV3IEVycm9yKG1lc3NhZ2UpO1xuICAgIH0gY2F0Y2ggKHgpIHt9XG4gIH07XG5cbiAgd2FybmluZyA9IGZ1bmN0aW9uIHdhcm5pbmcoY29uZGl0aW9uLCBmb3JtYXQpIHtcbiAgICBpZiAoZm9ybWF0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignYHdhcm5pbmcoY29uZGl0aW9uLCBmb3JtYXQsIC4uLmFyZ3MpYCByZXF1aXJlcyBhIHdhcm5pbmcgJyArICdtZXNzYWdlIGFyZ3VtZW50Jyk7XG4gICAgfVxuXG4gICAgaWYgKGZvcm1hdC5pbmRleE9mKCdGYWlsZWQgQ29tcG9zaXRlIHByb3BUeXBlOiAnKSA9PT0gMCkge1xuICAgICAgcmV0dXJuOyAvLyBJZ25vcmUgQ29tcG9zaXRlQ29tcG9uZW50IHByb3B0eXBlIGNoZWNrLlxuICAgIH1cblxuICAgIGlmICghY29uZGl0aW9uKSB7XG4gICAgICBmb3IgKHZhciBfbGVuMiA9IGFyZ3VtZW50cy5sZW5ndGgsIGFyZ3MgPSBBcnJheShfbGVuMiA+IDIgPyBfbGVuMiAtIDIgOiAwKSwgX2tleTIgPSAyOyBfa2V5MiA8IF9sZW4yOyBfa2V5MisrKSB7XG4gICAgICAgIGFyZ3NbX2tleTIgLSAyXSA9IGFyZ3VtZW50c1tfa2V5Ml07XG4gICAgICB9XG5cbiAgICAgIHByaW50V2FybmluZy5hcHBseSh1bmRlZmluZWQsIFtmb3JtYXRdLmNvbmNhdChhcmdzKSk7XG4gICAgfVxuICB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHdhcm5pbmc7IiwiLyohXG4gKiBEZXRlcm1pbmUgaWYgYW4gb2JqZWN0IGlzIGEgQnVmZmVyXG4gKlxuICogQGF1dGhvciAgIEZlcm9zcyBBYm91a2hhZGlqZWggPGZlcm9zc0BmZXJvc3Mub3JnPiA8aHR0cDovL2Zlcm9zcy5vcmc+XG4gKiBAbGljZW5zZSAgTUlUXG4gKi9cblxuLy8gVGhlIF9pc0J1ZmZlciBjaGVjayBpcyBmb3IgU2FmYXJpIDUtNyBzdXBwb3J0LCBiZWNhdXNlIGl0J3MgbWlzc2luZ1xuLy8gT2JqZWN0LnByb3RvdHlwZS5jb25zdHJ1Y3Rvci4gUmVtb3ZlIHRoaXMgZXZlbnR1YWxseVxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAob2JqKSB7XG4gIHJldHVybiBvYmogIT0gbnVsbCAmJiAoaXNCdWZmZXIob2JqKSB8fCBpc1Nsb3dCdWZmZXIob2JqKSB8fCAhIW9iai5faXNCdWZmZXIpXG59XG5cbmZ1bmN0aW9uIGlzQnVmZmVyIChvYmopIHtcbiAgcmV0dXJuICEhb2JqLmNvbnN0cnVjdG9yICYmIHR5cGVvZiBvYmouY29uc3RydWN0b3IuaXNCdWZmZXIgPT09ICdmdW5jdGlvbicgJiYgb2JqLmNvbnN0cnVjdG9yLmlzQnVmZmVyKG9iailcbn1cblxuLy8gRm9yIE5vZGUgdjAuMTAgc3VwcG9ydC4gUmVtb3ZlIHRoaXMgZXZlbnR1YWxseS5cbmZ1bmN0aW9uIGlzU2xvd0J1ZmZlciAob2JqKSB7XG4gIHJldHVybiB0eXBlb2Ygb2JqLnJlYWRGbG9hdExFID09PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBvYmouc2xpY2UgPT09ICdmdW5jdGlvbicgJiYgaXNCdWZmZXIob2JqLnNsaWNlKDAsIDApKVxufVxuIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbi8vIGNhY2hlZCBmcm9tIHdoYXRldmVyIGdsb2JhbCBpcyBwcmVzZW50IHNvIHRoYXQgdGVzdCBydW5uZXJzIHRoYXQgc3R1YiBpdFxuLy8gZG9uJ3QgYnJlYWsgdGhpbmdzLiAgQnV0IHdlIG5lZWQgdG8gd3JhcCBpdCBpbiBhIHRyeSBjYXRjaCBpbiBjYXNlIGl0IGlzXG4vLyB3cmFwcGVkIGluIHN0cmljdCBtb2RlIGNvZGUgd2hpY2ggZG9lc24ndCBkZWZpbmUgYW55IGdsb2JhbHMuICBJdCdzIGluc2lkZSBhXG4vLyBmdW5jdGlvbiBiZWNhdXNlIHRyeS9jYXRjaGVzIGRlb3B0aW1pemUgaW4gY2VydGFpbiBlbmdpbmVzLlxuXG52YXIgY2FjaGVkU2V0VGltZW91dDtcbnZhciBjYWNoZWRDbGVhclRpbWVvdXQ7XG5cbmZ1bmN0aW9uIGRlZmF1bHRTZXRUaW1vdXQoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdzZXRUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG5mdW5jdGlvbiBkZWZhdWx0Q2xlYXJUaW1lb3V0ICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2NsZWFyVGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuKGZ1bmN0aW9uICgpIHtcbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIHNldFRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIGNsZWFyVGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICB9XG59ICgpKVxuZnVuY3Rpb24gcnVuVGltZW91dChmdW4pIHtcbiAgICBpZiAoY2FjaGVkU2V0VGltZW91dCA9PT0gc2V0VGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgLy8gaWYgc2V0VGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZFNldFRpbWVvdXQgPT09IGRlZmF1bHRTZXRUaW1vdXQgfHwgIWNhY2hlZFNldFRpbWVvdXQpICYmIHNldFRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9IGNhdGNoKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0IHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKG51bGwsIGZ1biwgMCk7XG4gICAgICAgIH0gY2F0Y2goZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvclxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbCh0aGlzLCBmdW4sIDApO1xuICAgICAgICB9XG4gICAgfVxuXG5cbn1cbmZ1bmN0aW9uIHJ1bkNsZWFyVGltZW91dChtYXJrZXIpIHtcbiAgICBpZiAoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgLy8gaWYgY2xlYXJUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBkZWZhdWx0Q2xlYXJUaW1lb3V0IHx8ICFjYWNoZWRDbGVhclRpbWVvdXQpICYmIGNsZWFyVGltZW91dCkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfSBjYXRjaCAoZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgIHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwobnVsbCwgbWFya2VyKTtcbiAgICAgICAgfSBjYXRjaCAoZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvci5cbiAgICAgICAgICAgIC8vIFNvbWUgdmVyc2lvbnMgb2YgSS5FLiBoYXZlIGRpZmZlcmVudCBydWxlcyBmb3IgY2xlYXJUaW1lb3V0IHZzIHNldFRpbWVvdXRcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbCh0aGlzLCBtYXJrZXIpO1xuICAgICAgICB9XG4gICAgfVxuXG5cblxufVxudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgaWYgKCFkcmFpbmluZyB8fCAhY3VycmVudFF1ZXVlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gcnVuVGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFF1ZXVlW3F1ZXVlSW5kZXhdLnJ1bigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBjdXJyZW50UXVldWUgPSBudWxsO1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgcnVuQ2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xufVxuXG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHF1ZXVlLnB1c2gobmV3IEl0ZW0oZnVuLCBhcmdzKSk7XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMSAmJiAhZHJhaW5pbmcpIHtcbiAgICAgICAgcnVuVGltZW91dChkcmFpblF1ZXVlKTtcbiAgICB9XG59O1xuXG4vLyB2OCBsaWtlcyBwcmVkaWN0aWJsZSBvYmplY3RzXG5mdW5jdGlvbiBJdGVtKGZ1biwgYXJyYXkpIHtcbiAgICB0aGlzLmZ1biA9IGZ1bjtcbiAgICB0aGlzLmFycmF5ID0gYXJyYXk7XG59XG5JdGVtLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5mdW4uYXBwbHkobnVsbCwgdGhpcy5hcnJheSk7XG59O1xucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5wcm9jZXNzLnZlcnNpb24gPSAnJzsgLy8gZW1wdHkgc3RyaW5nIHRvIGF2b2lkIHJlZ2V4cCBpc3N1ZXNcbnByb2Nlc3MudmVyc2lvbnMgPSB7fTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xucHJvY2Vzcy5wcmVwZW5kTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5wcmVwZW5kT25jZUxpc3RlbmVyID0gbm9vcDtcblxucHJvY2Vzcy5saXN0ZW5lcnMgPSBmdW5jdGlvbiAobmFtZSkgeyByZXR1cm4gW10gfVxuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTMtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxuaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgdmFyIGludmFyaWFudCA9IHJlcXVpcmUoJ2ZianMvbGliL2ludmFyaWFudCcpO1xuICB2YXIgd2FybmluZyA9IHJlcXVpcmUoJ2ZianMvbGliL3dhcm5pbmcnKTtcbiAgdmFyIFJlYWN0UHJvcFR5cGVzU2VjcmV0ID0gcmVxdWlyZSgnLi9saWIvUmVhY3RQcm9wVHlwZXNTZWNyZXQnKTtcbiAgdmFyIGxvZ2dlZFR5cGVGYWlsdXJlcyA9IHt9O1xufVxuXG4vKipcbiAqIEFzc2VydCB0aGF0IHRoZSB2YWx1ZXMgbWF0Y2ggd2l0aCB0aGUgdHlwZSBzcGVjcy5cbiAqIEVycm9yIG1lc3NhZ2VzIGFyZSBtZW1vcml6ZWQgYW5kIHdpbGwgb25seSBiZSBzaG93biBvbmNlLlxuICpcbiAqIEBwYXJhbSB7b2JqZWN0fSB0eXBlU3BlY3MgTWFwIG9mIG5hbWUgdG8gYSBSZWFjdFByb3BUeXBlXG4gKiBAcGFyYW0ge29iamVjdH0gdmFsdWVzIFJ1bnRpbWUgdmFsdWVzIHRoYXQgbmVlZCB0byBiZSB0eXBlLWNoZWNrZWRcbiAqIEBwYXJhbSB7c3RyaW5nfSBsb2NhdGlvbiBlLmcuIFwicHJvcFwiLCBcImNvbnRleHRcIiwgXCJjaGlsZCBjb250ZXh0XCJcbiAqIEBwYXJhbSB7c3RyaW5nfSBjb21wb25lbnROYW1lIE5hbWUgb2YgdGhlIGNvbXBvbmVudCBmb3IgZXJyb3IgbWVzc2FnZXMuXG4gKiBAcGFyYW0gez9GdW5jdGlvbn0gZ2V0U3RhY2sgUmV0dXJucyB0aGUgY29tcG9uZW50IHN0YWNrLlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gY2hlY2tQcm9wVHlwZXModHlwZVNwZWNzLCB2YWx1ZXMsIGxvY2F0aW9uLCBjb21wb25lbnROYW1lLCBnZXRTdGFjaykge1xuICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgIGZvciAodmFyIHR5cGVTcGVjTmFtZSBpbiB0eXBlU3BlY3MpIHtcbiAgICAgIGlmICh0eXBlU3BlY3MuaGFzT3duUHJvcGVydHkodHlwZVNwZWNOYW1lKSkge1xuICAgICAgICB2YXIgZXJyb3I7XG4gICAgICAgIC8vIFByb3AgdHlwZSB2YWxpZGF0aW9uIG1heSB0aHJvdy4gSW4gY2FzZSB0aGV5IGRvLCB3ZSBkb24ndCB3YW50IHRvXG4gICAgICAgIC8vIGZhaWwgdGhlIHJlbmRlciBwaGFzZSB3aGVyZSBpdCBkaWRuJ3QgZmFpbCBiZWZvcmUuIFNvIHdlIGxvZyBpdC5cbiAgICAgICAgLy8gQWZ0ZXIgdGhlc2UgaGF2ZSBiZWVuIGNsZWFuZWQgdXAsIHdlJ2xsIGxldCB0aGVtIHRocm93LlxuICAgICAgICB0cnkge1xuICAgICAgICAgIC8vIFRoaXMgaXMgaW50ZW50aW9uYWxseSBhbiBpbnZhcmlhbnQgdGhhdCBnZXRzIGNhdWdodC4gSXQncyB0aGUgc2FtZVxuICAgICAgICAgIC8vIGJlaGF2aW9yIGFzIHdpdGhvdXQgdGhpcyBzdGF0ZW1lbnQgZXhjZXB0IHdpdGggYSBiZXR0ZXIgbWVzc2FnZS5cbiAgICAgICAgICBpbnZhcmlhbnQodHlwZW9mIHR5cGVTcGVjc1t0eXBlU3BlY05hbWVdID09PSAnZnVuY3Rpb24nLCAnJXM6ICVzIHR5cGUgYCVzYCBpcyBpbnZhbGlkOyBpdCBtdXN0IGJlIGEgZnVuY3Rpb24sIHVzdWFsbHkgZnJvbSAnICsgJ1JlYWN0LlByb3BUeXBlcy4nLCBjb21wb25lbnROYW1lIHx8ICdSZWFjdCBjbGFzcycsIGxvY2F0aW9uLCB0eXBlU3BlY05hbWUpO1xuICAgICAgICAgIGVycm9yID0gdHlwZVNwZWNzW3R5cGVTcGVjTmFtZV0odmFsdWVzLCB0eXBlU3BlY05hbWUsIGNvbXBvbmVudE5hbWUsIGxvY2F0aW9uLCBudWxsLCBSZWFjdFByb3BUeXBlc1NlY3JldCk7XG4gICAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgICAgZXJyb3IgPSBleDtcbiAgICAgICAgfVxuICAgICAgICB3YXJuaW5nKCFlcnJvciB8fCBlcnJvciBpbnN0YW5jZW9mIEVycm9yLCAnJXM6IHR5cGUgc3BlY2lmaWNhdGlvbiBvZiAlcyBgJXNgIGlzIGludmFsaWQ7IHRoZSB0eXBlIGNoZWNrZXIgJyArICdmdW5jdGlvbiBtdXN0IHJldHVybiBgbnVsbGAgb3IgYW4gYEVycm9yYCBidXQgcmV0dXJuZWQgYSAlcy4gJyArICdZb3UgbWF5IGhhdmUgZm9yZ290dGVuIHRvIHBhc3MgYW4gYXJndW1lbnQgdG8gdGhlIHR5cGUgY2hlY2tlciAnICsgJ2NyZWF0b3IgKGFycmF5T2YsIGluc3RhbmNlT2YsIG9iamVjdE9mLCBvbmVPZiwgb25lT2ZUeXBlLCBhbmQgJyArICdzaGFwZSBhbGwgcmVxdWlyZSBhbiBhcmd1bWVudCkuJywgY29tcG9uZW50TmFtZSB8fCAnUmVhY3QgY2xhc3MnLCBsb2NhdGlvbiwgdHlwZVNwZWNOYW1lLCB0eXBlb2YgZXJyb3IpO1xuICAgICAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvciAmJiAhKGVycm9yLm1lc3NhZ2UgaW4gbG9nZ2VkVHlwZUZhaWx1cmVzKSkge1xuICAgICAgICAgIC8vIE9ubHkgbW9uaXRvciB0aGlzIGZhaWx1cmUgb25jZSBiZWNhdXNlIHRoZXJlIHRlbmRzIHRvIGJlIGEgbG90IG9mIHRoZVxuICAgICAgICAgIC8vIHNhbWUgZXJyb3IuXG4gICAgICAgICAgbG9nZ2VkVHlwZUZhaWx1cmVzW2Vycm9yLm1lc3NhZ2VdID0gdHJ1ZTtcblxuICAgICAgICAgIHZhciBzdGFjayA9IGdldFN0YWNrID8gZ2V0U3RhY2soKSA6ICcnO1xuXG4gICAgICAgICAgd2FybmluZyhmYWxzZSwgJ0ZhaWxlZCAlcyB0eXBlOiAlcyVzJywgbG9jYXRpb24sIGVycm9yLm1lc3NhZ2UsIHN0YWNrICE9IG51bGwgPyBzdGFjayA6ICcnKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNoZWNrUHJvcFR5cGVzO1xuIiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxMy1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG4vLyBSZWFjdCAxNS41IHJlZmVyZW5jZXMgdGhpcyBtb2R1bGUsIGFuZCBhc3N1bWVzIFByb3BUeXBlcyBhcmUgc3RpbGwgY2FsbGFibGUgaW4gcHJvZHVjdGlvbi5cbi8vIFRoZXJlZm9yZSB3ZSByZS1leHBvcnQgZGV2ZWxvcG1lbnQtb25seSB2ZXJzaW9uIHdpdGggYWxsIHRoZSBQcm9wVHlwZXMgY2hlY2tzIGhlcmUuXG4vLyBIb3dldmVyIGlmIG9uZSBpcyBtaWdyYXRpbmcgdG8gdGhlIGBwcm9wLXR5cGVzYCBucG0gbGlicmFyeSwgdGhleSB3aWxsIGdvIHRocm91Z2ggdGhlXG4vLyBgaW5kZXguanNgIGVudHJ5IHBvaW50LCBhbmQgaXQgd2lsbCBicmFuY2ggZGVwZW5kaW5nIG9uIHRoZSBlbnZpcm9ubWVudC5cbnZhciBmYWN0b3J5ID0gcmVxdWlyZSgnLi9mYWN0b3J5V2l0aFR5cGVDaGVja2VycycpO1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihpc1ZhbGlkRWxlbWVudCkge1xuICAvLyBJdCBpcyBzdGlsbCBhbGxvd2VkIGluIDE1LjUuXG4gIHZhciB0aHJvd09uRGlyZWN0QWNjZXNzID0gZmFsc2U7XG4gIHJldHVybiBmYWN0b3J5KGlzVmFsaWRFbGVtZW50LCB0aHJvd09uRGlyZWN0QWNjZXNzKTtcbn07XG4iLCIvKipcbiAqIENvcHlyaWdodCAyMDEzLXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBlbXB0eUZ1bmN0aW9uID0gcmVxdWlyZSgnZmJqcy9saWIvZW1wdHlGdW5jdGlvbicpO1xudmFyIGludmFyaWFudCA9IHJlcXVpcmUoJ2ZianMvbGliL2ludmFyaWFudCcpO1xudmFyIHdhcm5pbmcgPSByZXF1aXJlKCdmYmpzL2xpYi93YXJuaW5nJyk7XG5cbnZhciBSZWFjdFByb3BUeXBlc1NlY3JldCA9IHJlcXVpcmUoJy4vbGliL1JlYWN0UHJvcFR5cGVzU2VjcmV0Jyk7XG52YXIgY2hlY2tQcm9wVHlwZXMgPSByZXF1aXJlKCcuL2NoZWNrUHJvcFR5cGVzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oaXNWYWxpZEVsZW1lbnQsIHRocm93T25EaXJlY3RBY2Nlc3MpIHtcbiAgLyogZ2xvYmFsIFN5bWJvbCAqL1xuICB2YXIgSVRFUkFUT1JfU1lNQk9MID0gdHlwZW9mIFN5bWJvbCA9PT0gJ2Z1bmN0aW9uJyAmJiBTeW1ib2wuaXRlcmF0b3I7XG4gIHZhciBGQVVYX0lURVJBVE9SX1NZTUJPTCA9ICdAQGl0ZXJhdG9yJzsgLy8gQmVmb3JlIFN5bWJvbCBzcGVjLlxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBpdGVyYXRvciBtZXRob2QgZnVuY3Rpb24gY29udGFpbmVkIG9uIHRoZSBpdGVyYWJsZSBvYmplY3QuXG4gICAqXG4gICAqIEJlIHN1cmUgdG8gaW52b2tlIHRoZSBmdW5jdGlvbiB3aXRoIHRoZSBpdGVyYWJsZSBhcyBjb250ZXh0OlxuICAgKlxuICAgKiAgICAgdmFyIGl0ZXJhdG9yRm4gPSBnZXRJdGVyYXRvckZuKG15SXRlcmFibGUpO1xuICAgKiAgICAgaWYgKGl0ZXJhdG9yRm4pIHtcbiAgICogICAgICAgdmFyIGl0ZXJhdG9yID0gaXRlcmF0b3JGbi5jYWxsKG15SXRlcmFibGUpO1xuICAgKiAgICAgICAuLi5cbiAgICogICAgIH1cbiAgICpcbiAgICogQHBhcmFtIHs/b2JqZWN0fSBtYXliZUl0ZXJhYmxlXG4gICAqIEByZXR1cm4gez9mdW5jdGlvbn1cbiAgICovXG4gIGZ1bmN0aW9uIGdldEl0ZXJhdG9yRm4obWF5YmVJdGVyYWJsZSkge1xuICAgIHZhciBpdGVyYXRvckZuID0gbWF5YmVJdGVyYWJsZSAmJiAoSVRFUkFUT1JfU1lNQk9MICYmIG1heWJlSXRlcmFibGVbSVRFUkFUT1JfU1lNQk9MXSB8fCBtYXliZUl0ZXJhYmxlW0ZBVVhfSVRFUkFUT1JfU1lNQk9MXSk7XG4gICAgaWYgKHR5cGVvZiBpdGVyYXRvckZuID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXR1cm4gaXRlcmF0b3JGbjtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ29sbGVjdGlvbiBvZiBtZXRob2RzIHRoYXQgYWxsb3cgZGVjbGFyYXRpb24gYW5kIHZhbGlkYXRpb24gb2YgcHJvcHMgdGhhdCBhcmVcbiAgICogc3VwcGxpZWQgdG8gUmVhY3QgY29tcG9uZW50cy4gRXhhbXBsZSB1c2FnZTpcbiAgICpcbiAgICogICB2YXIgUHJvcHMgPSByZXF1aXJlKCdSZWFjdFByb3BUeXBlcycpO1xuICAgKiAgIHZhciBNeUFydGljbGUgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG4gICAqICAgICBwcm9wVHlwZXM6IHtcbiAgICogICAgICAgLy8gQW4gb3B0aW9uYWwgc3RyaW5nIHByb3AgbmFtZWQgXCJkZXNjcmlwdGlvblwiLlxuICAgKiAgICAgICBkZXNjcmlwdGlvbjogUHJvcHMuc3RyaW5nLFxuICAgKlxuICAgKiAgICAgICAvLyBBIHJlcXVpcmVkIGVudW0gcHJvcCBuYW1lZCBcImNhdGVnb3J5XCIuXG4gICAqICAgICAgIGNhdGVnb3J5OiBQcm9wcy5vbmVPZihbJ05ld3MnLCdQaG90b3MnXSkuaXNSZXF1aXJlZCxcbiAgICpcbiAgICogICAgICAgLy8gQSBwcm9wIG5hbWVkIFwiZGlhbG9nXCIgdGhhdCByZXF1aXJlcyBhbiBpbnN0YW5jZSBvZiBEaWFsb2cuXG4gICAqICAgICAgIGRpYWxvZzogUHJvcHMuaW5zdGFuY2VPZihEaWFsb2cpLmlzUmVxdWlyZWRcbiAgICogICAgIH0sXG4gICAqICAgICByZW5kZXI6IGZ1bmN0aW9uKCkgeyAuLi4gfVxuICAgKiAgIH0pO1xuICAgKlxuICAgKiBBIG1vcmUgZm9ybWFsIHNwZWNpZmljYXRpb24gb2YgaG93IHRoZXNlIG1ldGhvZHMgYXJlIHVzZWQ6XG4gICAqXG4gICAqICAgdHlwZSA6PSBhcnJheXxib29sfGZ1bmN8b2JqZWN0fG51bWJlcnxzdHJpbmd8b25lT2YoWy4uLl0pfGluc3RhbmNlT2YoLi4uKVxuICAgKiAgIGRlY2wgOj0gUmVhY3RQcm9wVHlwZXMue3R5cGV9KC5pc1JlcXVpcmVkKT9cbiAgICpcbiAgICogRWFjaCBhbmQgZXZlcnkgZGVjbGFyYXRpb24gcHJvZHVjZXMgYSBmdW5jdGlvbiB3aXRoIHRoZSBzYW1lIHNpZ25hdHVyZS4gVGhpc1xuICAgKiBhbGxvd3MgdGhlIGNyZWF0aW9uIG9mIGN1c3RvbSB2YWxpZGF0aW9uIGZ1bmN0aW9ucy4gRm9yIGV4YW1wbGU6XG4gICAqXG4gICAqICB2YXIgTXlMaW5rID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuICAgKiAgICBwcm9wVHlwZXM6IHtcbiAgICogICAgICAvLyBBbiBvcHRpb25hbCBzdHJpbmcgb3IgVVJJIHByb3AgbmFtZWQgXCJocmVmXCIuXG4gICAqICAgICAgaHJlZjogZnVuY3Rpb24ocHJvcHMsIHByb3BOYW1lLCBjb21wb25lbnROYW1lKSB7XG4gICAqICAgICAgICB2YXIgcHJvcFZhbHVlID0gcHJvcHNbcHJvcE5hbWVdO1xuICAgKiAgICAgICAgaWYgKHByb3BWYWx1ZSAhPSBudWxsICYmIHR5cGVvZiBwcm9wVmFsdWUgIT09ICdzdHJpbmcnICYmXG4gICAqICAgICAgICAgICAgIShwcm9wVmFsdWUgaW5zdGFuY2VvZiBVUkkpKSB7XG4gICAqICAgICAgICAgIHJldHVybiBuZXcgRXJyb3IoXG4gICAqICAgICAgICAgICAgJ0V4cGVjdGVkIGEgc3RyaW5nIG9yIGFuIFVSSSBmb3IgJyArIHByb3BOYW1lICsgJyBpbiAnICtcbiAgICogICAgICAgICAgICBjb21wb25lbnROYW1lXG4gICAqICAgICAgICAgICk7XG4gICAqICAgICAgICB9XG4gICAqICAgICAgfVxuICAgKiAgICB9LFxuICAgKiAgICByZW5kZXI6IGZ1bmN0aW9uKCkgey4uLn1cbiAgICogIH0pO1xuICAgKlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG5cbiAgdmFyIEFOT05ZTU9VUyA9ICc8PGFub255bW91cz4+JztcblxuICAvLyBJbXBvcnRhbnQhXG4gIC8vIEtlZXAgdGhpcyBsaXN0IGluIHN5bmMgd2l0aCBwcm9kdWN0aW9uIHZlcnNpb24gaW4gYC4vZmFjdG9yeVdpdGhUaHJvd2luZ1NoaW1zLmpzYC5cbiAgdmFyIFJlYWN0UHJvcFR5cGVzID0ge1xuICAgIGFycmF5OiBjcmVhdGVQcmltaXRpdmVUeXBlQ2hlY2tlcignYXJyYXknKSxcbiAgICBib29sOiBjcmVhdGVQcmltaXRpdmVUeXBlQ2hlY2tlcignYm9vbGVhbicpLFxuICAgIGZ1bmM6IGNyZWF0ZVByaW1pdGl2ZVR5cGVDaGVja2VyKCdmdW5jdGlvbicpLFxuICAgIG51bWJlcjogY3JlYXRlUHJpbWl0aXZlVHlwZUNoZWNrZXIoJ251bWJlcicpLFxuICAgIG9iamVjdDogY3JlYXRlUHJpbWl0aXZlVHlwZUNoZWNrZXIoJ29iamVjdCcpLFxuICAgIHN0cmluZzogY3JlYXRlUHJpbWl0aXZlVHlwZUNoZWNrZXIoJ3N0cmluZycpLFxuICAgIHN5bWJvbDogY3JlYXRlUHJpbWl0aXZlVHlwZUNoZWNrZXIoJ3N5bWJvbCcpLFxuXG4gICAgYW55OiBjcmVhdGVBbnlUeXBlQ2hlY2tlcigpLFxuICAgIGFycmF5T2Y6IGNyZWF0ZUFycmF5T2ZUeXBlQ2hlY2tlcixcbiAgICBlbGVtZW50OiBjcmVhdGVFbGVtZW50VHlwZUNoZWNrZXIoKSxcbiAgICBpbnN0YW5jZU9mOiBjcmVhdGVJbnN0YW5jZVR5cGVDaGVja2VyLFxuICAgIG5vZGU6IGNyZWF0ZU5vZGVDaGVja2VyKCksXG4gICAgb2JqZWN0T2Y6IGNyZWF0ZU9iamVjdE9mVHlwZUNoZWNrZXIsXG4gICAgb25lT2Y6IGNyZWF0ZUVudW1UeXBlQ2hlY2tlcixcbiAgICBvbmVPZlR5cGU6IGNyZWF0ZVVuaW9uVHlwZUNoZWNrZXIsXG4gICAgc2hhcGU6IGNyZWF0ZVNoYXBlVHlwZUNoZWNrZXJcbiAgfTtcblxuICAvKipcbiAgICogaW5saW5lZCBPYmplY3QuaXMgcG9seWZpbGwgdG8gYXZvaWQgcmVxdWlyaW5nIGNvbnN1bWVycyBzaGlwIHRoZWlyIG93blxuICAgKiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9PYmplY3QvaXNcbiAgICovXG4gIC8qZXNsaW50LWRpc2FibGUgbm8tc2VsZi1jb21wYXJlKi9cbiAgZnVuY3Rpb24gaXMoeCwgeSkge1xuICAgIC8vIFNhbWVWYWx1ZSBhbGdvcml0aG1cbiAgICBpZiAoeCA9PT0geSkge1xuICAgICAgLy8gU3RlcHMgMS01LCA3LTEwXG4gICAgICAvLyBTdGVwcyA2LmItNi5lOiArMCAhPSAtMFxuICAgICAgcmV0dXJuIHggIT09IDAgfHwgMSAvIHggPT09IDEgLyB5O1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBTdGVwIDYuYTogTmFOID09IE5hTlxuICAgICAgcmV0dXJuIHggIT09IHggJiYgeSAhPT0geTtcbiAgICB9XG4gIH1cbiAgLyplc2xpbnQtZW5hYmxlIG5vLXNlbGYtY29tcGFyZSovXG5cbiAgLyoqXG4gICAqIFdlIHVzZSBhbiBFcnJvci1saWtlIG9iamVjdCBmb3IgYmFja3dhcmQgY29tcGF0aWJpbGl0eSBhcyBwZW9wbGUgbWF5IGNhbGxcbiAgICogUHJvcFR5cGVzIGRpcmVjdGx5IGFuZCBpbnNwZWN0IHRoZWlyIG91dHB1dC4gSG93ZXZlciwgd2UgZG9uJ3QgdXNlIHJlYWxcbiAgICogRXJyb3JzIGFueW1vcmUuIFdlIGRvbid0IGluc3BlY3QgdGhlaXIgc3RhY2sgYW55d2F5LCBhbmQgY3JlYXRpbmcgdGhlbVxuICAgKiBpcyBwcm9oaWJpdGl2ZWx5IGV4cGVuc2l2ZSBpZiB0aGV5IGFyZSBjcmVhdGVkIHRvbyBvZnRlbiwgc3VjaCBhcyB3aGF0XG4gICAqIGhhcHBlbnMgaW4gb25lT2ZUeXBlKCkgZm9yIGFueSB0eXBlIGJlZm9yZSB0aGUgb25lIHRoYXQgbWF0Y2hlZC5cbiAgICovXG4gIGZ1bmN0aW9uIFByb3BUeXBlRXJyb3IobWVzc2FnZSkge1xuICAgIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG4gICAgdGhpcy5zdGFjayA9ICcnO1xuICB9XG4gIC8vIE1ha2UgYGluc3RhbmNlb2YgRXJyb3JgIHN0aWxsIHdvcmsgZm9yIHJldHVybmVkIGVycm9ycy5cbiAgUHJvcFR5cGVFcnJvci5wcm90b3R5cGUgPSBFcnJvci5wcm90b3R5cGU7XG5cbiAgZnVuY3Rpb24gY3JlYXRlQ2hhaW5hYmxlVHlwZUNoZWNrZXIodmFsaWRhdGUpIHtcbiAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgdmFyIG1hbnVhbFByb3BUeXBlQ2FsbENhY2hlID0ge307XG4gICAgICB2YXIgbWFudWFsUHJvcFR5cGVXYXJuaW5nQ291bnQgPSAwO1xuICAgIH1cbiAgICBmdW5jdGlvbiBjaGVja1R5cGUoaXNSZXF1aXJlZCwgcHJvcHMsIHByb3BOYW1lLCBjb21wb25lbnROYW1lLCBsb2NhdGlvbiwgcHJvcEZ1bGxOYW1lLCBzZWNyZXQpIHtcbiAgICAgIGNvbXBvbmVudE5hbWUgPSBjb21wb25lbnROYW1lIHx8IEFOT05ZTU9VUztcbiAgICAgIHByb3BGdWxsTmFtZSA9IHByb3BGdWxsTmFtZSB8fCBwcm9wTmFtZTtcblxuICAgICAgaWYgKHNlY3JldCAhPT0gUmVhY3RQcm9wVHlwZXNTZWNyZXQpIHtcbiAgICAgICAgaWYgKHRocm93T25EaXJlY3RBY2Nlc3MpIHtcbiAgICAgICAgICAvLyBOZXcgYmVoYXZpb3Igb25seSBmb3IgdXNlcnMgb2YgYHByb3AtdHlwZXNgIHBhY2thZ2VcbiAgICAgICAgICBpbnZhcmlhbnQoXG4gICAgICAgICAgICBmYWxzZSxcbiAgICAgICAgICAgICdDYWxsaW5nIFByb3BUeXBlcyB2YWxpZGF0b3JzIGRpcmVjdGx5IGlzIG5vdCBzdXBwb3J0ZWQgYnkgdGhlIGBwcm9wLXR5cGVzYCBwYWNrYWdlLiAnICtcbiAgICAgICAgICAgICdVc2UgYFByb3BUeXBlcy5jaGVja1Byb3BUeXBlcygpYCB0byBjYWxsIHRoZW0uICcgK1xuICAgICAgICAgICAgJ1JlYWQgbW9yZSBhdCBodHRwOi8vZmIubWUvdXNlLWNoZWNrLXByb3AtdHlwZXMnXG4gICAgICAgICAgKTtcbiAgICAgICAgfSBlbHNlIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIHR5cGVvZiBjb25zb2xlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIC8vIE9sZCBiZWhhdmlvciBmb3IgcGVvcGxlIHVzaW5nIFJlYWN0LlByb3BUeXBlc1xuICAgICAgICAgIHZhciBjYWNoZUtleSA9IGNvbXBvbmVudE5hbWUgKyAnOicgKyBwcm9wTmFtZTtcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAhbWFudWFsUHJvcFR5cGVDYWxsQ2FjaGVbY2FjaGVLZXldICYmXG4gICAgICAgICAgICAvLyBBdm9pZCBzcGFtbWluZyB0aGUgY29uc29sZSBiZWNhdXNlIHRoZXkgYXJlIG9mdGVuIG5vdCBhY3Rpb25hYmxlIGV4Y2VwdCBmb3IgbGliIGF1dGhvcnNcbiAgICAgICAgICAgIG1hbnVhbFByb3BUeXBlV2FybmluZ0NvdW50IDwgM1xuICAgICAgICAgICkge1xuICAgICAgICAgICAgd2FybmluZyhcbiAgICAgICAgICAgICAgZmFsc2UsXG4gICAgICAgICAgICAgICdZb3UgYXJlIG1hbnVhbGx5IGNhbGxpbmcgYSBSZWFjdC5Qcm9wVHlwZXMgdmFsaWRhdGlvbiAnICtcbiAgICAgICAgICAgICAgJ2Z1bmN0aW9uIGZvciB0aGUgYCVzYCBwcm9wIG9uIGAlc2AuIFRoaXMgaXMgZGVwcmVjYXRlZCAnICtcbiAgICAgICAgICAgICAgJ2FuZCB3aWxsIHRocm93IGluIHRoZSBzdGFuZGFsb25lIGBwcm9wLXR5cGVzYCBwYWNrYWdlLiAnICtcbiAgICAgICAgICAgICAgJ1lvdSBtYXkgYmUgc2VlaW5nIHRoaXMgd2FybmluZyBkdWUgdG8gYSB0aGlyZC1wYXJ0eSBQcm9wVHlwZXMgJyArXG4gICAgICAgICAgICAgICdsaWJyYXJ5LiBTZWUgaHR0cHM6Ly9mYi5tZS9yZWFjdC13YXJuaW5nLWRvbnQtY2FsbC1wcm9wdHlwZXMgJyArICdmb3IgZGV0YWlscy4nLFxuICAgICAgICAgICAgICBwcm9wRnVsbE5hbWUsXG4gICAgICAgICAgICAgIGNvbXBvbmVudE5hbWVcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBtYW51YWxQcm9wVHlwZUNhbGxDYWNoZVtjYWNoZUtleV0gPSB0cnVlO1xuICAgICAgICAgICAgbWFudWFsUHJvcFR5cGVXYXJuaW5nQ291bnQrKztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChwcm9wc1twcm9wTmFtZV0gPT0gbnVsbCkge1xuICAgICAgICBpZiAoaXNSZXF1aXJlZCkge1xuICAgICAgICAgIGlmIChwcm9wc1twcm9wTmFtZV0gPT09IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgUHJvcFR5cGVFcnJvcignVGhlICcgKyBsb2NhdGlvbiArICcgYCcgKyBwcm9wRnVsbE5hbWUgKyAnYCBpcyBtYXJrZWQgYXMgcmVxdWlyZWQgJyArICgnaW4gYCcgKyBjb21wb25lbnROYW1lICsgJ2AsIGJ1dCBpdHMgdmFsdWUgaXMgYG51bGxgLicpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIG5ldyBQcm9wVHlwZUVycm9yKCdUaGUgJyArIGxvY2F0aW9uICsgJyBgJyArIHByb3BGdWxsTmFtZSArICdgIGlzIG1hcmtlZCBhcyByZXF1aXJlZCBpbiAnICsgKCdgJyArIGNvbXBvbmVudE5hbWUgKyAnYCwgYnV0IGl0cyB2YWx1ZSBpcyBgdW5kZWZpbmVkYC4nKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdmFsaWRhdGUocHJvcHMsIHByb3BOYW1lLCBjb21wb25lbnROYW1lLCBsb2NhdGlvbiwgcHJvcEZ1bGxOYW1lKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgY2hhaW5lZENoZWNrVHlwZSA9IGNoZWNrVHlwZS5iaW5kKG51bGwsIGZhbHNlKTtcbiAgICBjaGFpbmVkQ2hlY2tUeXBlLmlzUmVxdWlyZWQgPSBjaGVja1R5cGUuYmluZChudWxsLCB0cnVlKTtcblxuICAgIHJldHVybiBjaGFpbmVkQ2hlY2tUeXBlO1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlUHJpbWl0aXZlVHlwZUNoZWNrZXIoZXhwZWN0ZWRUeXBlKSB7XG4gICAgZnVuY3Rpb24gdmFsaWRhdGUocHJvcHMsIHByb3BOYW1lLCBjb21wb25lbnROYW1lLCBsb2NhdGlvbiwgcHJvcEZ1bGxOYW1lLCBzZWNyZXQpIHtcbiAgICAgIHZhciBwcm9wVmFsdWUgPSBwcm9wc1twcm9wTmFtZV07XG4gICAgICB2YXIgcHJvcFR5cGUgPSBnZXRQcm9wVHlwZShwcm9wVmFsdWUpO1xuICAgICAgaWYgKHByb3BUeXBlICE9PSBleHBlY3RlZFR5cGUpIHtcbiAgICAgICAgLy8gYHByb3BWYWx1ZWAgYmVpbmcgaW5zdGFuY2Ugb2YsIHNheSwgZGF0ZS9yZWdleHAsIHBhc3MgdGhlICdvYmplY3QnXG4gICAgICAgIC8vIGNoZWNrLCBidXQgd2UgY2FuIG9mZmVyIGEgbW9yZSBwcmVjaXNlIGVycm9yIG1lc3NhZ2UgaGVyZSByYXRoZXIgdGhhblxuICAgICAgICAvLyAnb2YgdHlwZSBgb2JqZWN0YCcuXG4gICAgICAgIHZhciBwcmVjaXNlVHlwZSA9IGdldFByZWNpc2VUeXBlKHByb3BWYWx1ZSk7XG5cbiAgICAgICAgcmV0dXJuIG5ldyBQcm9wVHlwZUVycm9yKCdJbnZhbGlkICcgKyBsb2NhdGlvbiArICcgYCcgKyBwcm9wRnVsbE5hbWUgKyAnYCBvZiB0eXBlICcgKyAoJ2AnICsgcHJlY2lzZVR5cGUgKyAnYCBzdXBwbGllZCB0byBgJyArIGNvbXBvbmVudE5hbWUgKyAnYCwgZXhwZWN0ZWQgJykgKyAoJ2AnICsgZXhwZWN0ZWRUeXBlICsgJ2AuJykpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHJldHVybiBjcmVhdGVDaGFpbmFibGVUeXBlQ2hlY2tlcih2YWxpZGF0ZSk7XG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGVBbnlUeXBlQ2hlY2tlcigpIHtcbiAgICByZXR1cm4gY3JlYXRlQ2hhaW5hYmxlVHlwZUNoZWNrZXIoZW1wdHlGdW5jdGlvbi50aGF0UmV0dXJuc051bGwpO1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlQXJyYXlPZlR5cGVDaGVja2VyKHR5cGVDaGVja2VyKSB7XG4gICAgZnVuY3Rpb24gdmFsaWRhdGUocHJvcHMsIHByb3BOYW1lLCBjb21wb25lbnROYW1lLCBsb2NhdGlvbiwgcHJvcEZ1bGxOYW1lKSB7XG4gICAgICBpZiAodHlwZW9mIHR5cGVDaGVja2VyICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvcFR5cGVFcnJvcignUHJvcGVydHkgYCcgKyBwcm9wRnVsbE5hbWUgKyAnYCBvZiBjb21wb25lbnQgYCcgKyBjb21wb25lbnROYW1lICsgJ2AgaGFzIGludmFsaWQgUHJvcFR5cGUgbm90YXRpb24gaW5zaWRlIGFycmF5T2YuJyk7XG4gICAgICB9XG4gICAgICB2YXIgcHJvcFZhbHVlID0gcHJvcHNbcHJvcE5hbWVdO1xuICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHByb3BWYWx1ZSkpIHtcbiAgICAgICAgdmFyIHByb3BUeXBlID0gZ2V0UHJvcFR5cGUocHJvcFZhbHVlKTtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9wVHlwZUVycm9yKCdJbnZhbGlkICcgKyBsb2NhdGlvbiArICcgYCcgKyBwcm9wRnVsbE5hbWUgKyAnYCBvZiB0eXBlICcgKyAoJ2AnICsgcHJvcFR5cGUgKyAnYCBzdXBwbGllZCB0byBgJyArIGNvbXBvbmVudE5hbWUgKyAnYCwgZXhwZWN0ZWQgYW4gYXJyYXkuJykpO1xuICAgICAgfVxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwcm9wVmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGVycm9yID0gdHlwZUNoZWNrZXIocHJvcFZhbHVlLCBpLCBjb21wb25lbnROYW1lLCBsb2NhdGlvbiwgcHJvcEZ1bGxOYW1lICsgJ1snICsgaSArICddJywgUmVhY3RQcm9wVHlwZXNTZWNyZXQpO1xuICAgICAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICAgIHJldHVybiBlcnJvcjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHJldHVybiBjcmVhdGVDaGFpbmFibGVUeXBlQ2hlY2tlcih2YWxpZGF0ZSk7XG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGVFbGVtZW50VHlwZUNoZWNrZXIoKSB7XG4gICAgZnVuY3Rpb24gdmFsaWRhdGUocHJvcHMsIHByb3BOYW1lLCBjb21wb25lbnROYW1lLCBsb2NhdGlvbiwgcHJvcEZ1bGxOYW1lKSB7XG4gICAgICB2YXIgcHJvcFZhbHVlID0gcHJvcHNbcHJvcE5hbWVdO1xuICAgICAgaWYgKCFpc1ZhbGlkRWxlbWVudChwcm9wVmFsdWUpKSB7XG4gICAgICAgIHZhciBwcm9wVHlwZSA9IGdldFByb3BUeXBlKHByb3BWYWx1ZSk7XG4gICAgICAgIHJldHVybiBuZXcgUHJvcFR5cGVFcnJvcignSW52YWxpZCAnICsgbG9jYXRpb24gKyAnIGAnICsgcHJvcEZ1bGxOYW1lICsgJ2Agb2YgdHlwZSAnICsgKCdgJyArIHByb3BUeXBlICsgJ2Agc3VwcGxpZWQgdG8gYCcgKyBjb21wb25lbnROYW1lICsgJ2AsIGV4cGVjdGVkIGEgc2luZ2xlIFJlYWN0RWxlbWVudC4nKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIGNyZWF0ZUNoYWluYWJsZVR5cGVDaGVja2VyKHZhbGlkYXRlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZUluc3RhbmNlVHlwZUNoZWNrZXIoZXhwZWN0ZWRDbGFzcykge1xuICAgIGZ1bmN0aW9uIHZhbGlkYXRlKHByb3BzLCBwcm9wTmFtZSwgY29tcG9uZW50TmFtZSwgbG9jYXRpb24sIHByb3BGdWxsTmFtZSkge1xuICAgICAgaWYgKCEocHJvcHNbcHJvcE5hbWVdIGluc3RhbmNlb2YgZXhwZWN0ZWRDbGFzcykpIHtcbiAgICAgICAgdmFyIGV4cGVjdGVkQ2xhc3NOYW1lID0gZXhwZWN0ZWRDbGFzcy5uYW1lIHx8IEFOT05ZTU9VUztcbiAgICAgICAgdmFyIGFjdHVhbENsYXNzTmFtZSA9IGdldENsYXNzTmFtZShwcm9wc1twcm9wTmFtZV0pO1xuICAgICAgICByZXR1cm4gbmV3IFByb3BUeXBlRXJyb3IoJ0ludmFsaWQgJyArIGxvY2F0aW9uICsgJyBgJyArIHByb3BGdWxsTmFtZSArICdgIG9mIHR5cGUgJyArICgnYCcgKyBhY3R1YWxDbGFzc05hbWUgKyAnYCBzdXBwbGllZCB0byBgJyArIGNvbXBvbmVudE5hbWUgKyAnYCwgZXhwZWN0ZWQgJykgKyAoJ2luc3RhbmNlIG9mIGAnICsgZXhwZWN0ZWRDbGFzc05hbWUgKyAnYC4nKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIGNyZWF0ZUNoYWluYWJsZVR5cGVDaGVja2VyKHZhbGlkYXRlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZUVudW1UeXBlQ2hlY2tlcihleHBlY3RlZFZhbHVlcykge1xuICAgIGlmICghQXJyYXkuaXNBcnJheShleHBlY3RlZFZhbHVlcykpIHtcbiAgICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyB3YXJuaW5nKGZhbHNlLCAnSW52YWxpZCBhcmd1bWVudCBzdXBwbGllZCB0byBvbmVPZiwgZXhwZWN0ZWQgYW4gaW5zdGFuY2Ugb2YgYXJyYXkuJykgOiB2b2lkIDA7XG4gICAgICByZXR1cm4gZW1wdHlGdW5jdGlvbi50aGF0UmV0dXJuc051bGw7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdmFsaWRhdGUocHJvcHMsIHByb3BOYW1lLCBjb21wb25lbnROYW1lLCBsb2NhdGlvbiwgcHJvcEZ1bGxOYW1lKSB7XG4gICAgICB2YXIgcHJvcFZhbHVlID0gcHJvcHNbcHJvcE5hbWVdO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBleHBlY3RlZFZhbHVlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoaXMocHJvcFZhbHVlLCBleHBlY3RlZFZhbHVlc1tpXSkpIHtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB2YXIgdmFsdWVzU3RyaW5nID0gSlNPTi5zdHJpbmdpZnkoZXhwZWN0ZWRWYWx1ZXMpO1xuICAgICAgcmV0dXJuIG5ldyBQcm9wVHlwZUVycm9yKCdJbnZhbGlkICcgKyBsb2NhdGlvbiArICcgYCcgKyBwcm9wRnVsbE5hbWUgKyAnYCBvZiB2YWx1ZSBgJyArIHByb3BWYWx1ZSArICdgICcgKyAoJ3N1cHBsaWVkIHRvIGAnICsgY29tcG9uZW50TmFtZSArICdgLCBleHBlY3RlZCBvbmUgb2YgJyArIHZhbHVlc1N0cmluZyArICcuJykpO1xuICAgIH1cbiAgICByZXR1cm4gY3JlYXRlQ2hhaW5hYmxlVHlwZUNoZWNrZXIodmFsaWRhdGUpO1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlT2JqZWN0T2ZUeXBlQ2hlY2tlcih0eXBlQ2hlY2tlcikge1xuICAgIGZ1bmN0aW9uIHZhbGlkYXRlKHByb3BzLCBwcm9wTmFtZSwgY29tcG9uZW50TmFtZSwgbG9jYXRpb24sIHByb3BGdWxsTmFtZSkge1xuICAgICAgaWYgKHR5cGVvZiB0eXBlQ2hlY2tlciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICByZXR1cm4gbmV3IFByb3BUeXBlRXJyb3IoJ1Byb3BlcnR5IGAnICsgcHJvcEZ1bGxOYW1lICsgJ2Agb2YgY29tcG9uZW50IGAnICsgY29tcG9uZW50TmFtZSArICdgIGhhcyBpbnZhbGlkIFByb3BUeXBlIG5vdGF0aW9uIGluc2lkZSBvYmplY3RPZi4nKTtcbiAgICAgIH1cbiAgICAgIHZhciBwcm9wVmFsdWUgPSBwcm9wc1twcm9wTmFtZV07XG4gICAgICB2YXIgcHJvcFR5cGUgPSBnZXRQcm9wVHlwZShwcm9wVmFsdWUpO1xuICAgICAgaWYgKHByb3BUeXBlICE9PSAnb2JqZWN0Jykge1xuICAgICAgICByZXR1cm4gbmV3IFByb3BUeXBlRXJyb3IoJ0ludmFsaWQgJyArIGxvY2F0aW9uICsgJyBgJyArIHByb3BGdWxsTmFtZSArICdgIG9mIHR5cGUgJyArICgnYCcgKyBwcm9wVHlwZSArICdgIHN1cHBsaWVkIHRvIGAnICsgY29tcG9uZW50TmFtZSArICdgLCBleHBlY3RlZCBhbiBvYmplY3QuJykpO1xuICAgICAgfVxuICAgICAgZm9yICh2YXIga2V5IGluIHByb3BWYWx1ZSkge1xuICAgICAgICBpZiAocHJvcFZhbHVlLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICB2YXIgZXJyb3IgPSB0eXBlQ2hlY2tlcihwcm9wVmFsdWUsIGtleSwgY29tcG9uZW50TmFtZSwgbG9jYXRpb24sIHByb3BGdWxsTmFtZSArICcuJyArIGtleSwgUmVhY3RQcm9wVHlwZXNTZWNyZXQpO1xuICAgICAgICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3I7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIGNyZWF0ZUNoYWluYWJsZVR5cGVDaGVja2VyKHZhbGlkYXRlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZVVuaW9uVHlwZUNoZWNrZXIoYXJyYXlPZlR5cGVDaGVja2Vycykge1xuICAgIGlmICghQXJyYXkuaXNBcnJheShhcnJheU9mVHlwZUNoZWNrZXJzKSkge1xuICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/IHdhcm5pbmcoZmFsc2UsICdJbnZhbGlkIGFyZ3VtZW50IHN1cHBsaWVkIHRvIG9uZU9mVHlwZSwgZXhwZWN0ZWQgYW4gaW5zdGFuY2Ugb2YgYXJyYXkuJykgOiB2b2lkIDA7XG4gICAgICByZXR1cm4gZW1wdHlGdW5jdGlvbi50aGF0UmV0dXJuc051bGw7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnJheU9mVHlwZUNoZWNrZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgY2hlY2tlciA9IGFycmF5T2ZUeXBlQ2hlY2tlcnNbaV07XG4gICAgICBpZiAodHlwZW9mIGNoZWNrZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgd2FybmluZyhcbiAgICAgICAgICBmYWxzZSxcbiAgICAgICAgICAnSW52YWxpZCBhcmd1bWVudCBzdXBwbGlkIHRvIG9uZU9mVHlwZS4gRXhwZWN0ZWQgYW4gYXJyYXkgb2YgY2hlY2sgZnVuY3Rpb25zLCBidXQgJyArXG4gICAgICAgICAgJ3JlY2VpdmVkICVzIGF0IGluZGV4ICVzLicsXG4gICAgICAgICAgZ2V0UG9zdGZpeEZvclR5cGVXYXJuaW5nKGNoZWNrZXIpLFxuICAgICAgICAgIGlcbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIGVtcHR5RnVuY3Rpb24udGhhdFJldHVybnNOdWxsO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHZhbGlkYXRlKHByb3BzLCBwcm9wTmFtZSwgY29tcG9uZW50TmFtZSwgbG9jYXRpb24sIHByb3BGdWxsTmFtZSkge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnJheU9mVHlwZUNoZWNrZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBjaGVja2VyID0gYXJyYXlPZlR5cGVDaGVja2Vyc1tpXTtcbiAgICAgICAgaWYgKGNoZWNrZXIocHJvcHMsIHByb3BOYW1lLCBjb21wb25lbnROYW1lLCBsb2NhdGlvbiwgcHJvcEZ1bGxOYW1lLCBSZWFjdFByb3BUeXBlc1NlY3JldCkgPT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBuZXcgUHJvcFR5cGVFcnJvcignSW52YWxpZCAnICsgbG9jYXRpb24gKyAnIGAnICsgcHJvcEZ1bGxOYW1lICsgJ2Agc3VwcGxpZWQgdG8gJyArICgnYCcgKyBjb21wb25lbnROYW1lICsgJ2AuJykpO1xuICAgIH1cbiAgICByZXR1cm4gY3JlYXRlQ2hhaW5hYmxlVHlwZUNoZWNrZXIodmFsaWRhdGUpO1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlTm9kZUNoZWNrZXIoKSB7XG4gICAgZnVuY3Rpb24gdmFsaWRhdGUocHJvcHMsIHByb3BOYW1lLCBjb21wb25lbnROYW1lLCBsb2NhdGlvbiwgcHJvcEZ1bGxOYW1lKSB7XG4gICAgICBpZiAoIWlzTm9kZShwcm9wc1twcm9wTmFtZV0pKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvcFR5cGVFcnJvcignSW52YWxpZCAnICsgbG9jYXRpb24gKyAnIGAnICsgcHJvcEZ1bGxOYW1lICsgJ2Agc3VwcGxpZWQgdG8gJyArICgnYCcgKyBjb21wb25lbnROYW1lICsgJ2AsIGV4cGVjdGVkIGEgUmVhY3ROb2RlLicpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICByZXR1cm4gY3JlYXRlQ2hhaW5hYmxlVHlwZUNoZWNrZXIodmFsaWRhdGUpO1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlU2hhcGVUeXBlQ2hlY2tlcihzaGFwZVR5cGVzKSB7XG4gICAgZnVuY3Rpb24gdmFsaWRhdGUocHJvcHMsIHByb3BOYW1lLCBjb21wb25lbnROYW1lLCBsb2NhdGlvbiwgcHJvcEZ1bGxOYW1lKSB7XG4gICAgICB2YXIgcHJvcFZhbHVlID0gcHJvcHNbcHJvcE5hbWVdO1xuICAgICAgdmFyIHByb3BUeXBlID0gZ2V0UHJvcFR5cGUocHJvcFZhbHVlKTtcbiAgICAgIGlmIChwcm9wVHlwZSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9wVHlwZUVycm9yKCdJbnZhbGlkICcgKyBsb2NhdGlvbiArICcgYCcgKyBwcm9wRnVsbE5hbWUgKyAnYCBvZiB0eXBlIGAnICsgcHJvcFR5cGUgKyAnYCAnICsgKCdzdXBwbGllZCB0byBgJyArIGNvbXBvbmVudE5hbWUgKyAnYCwgZXhwZWN0ZWQgYG9iamVjdGAuJykpO1xuICAgICAgfVxuICAgICAgZm9yICh2YXIga2V5IGluIHNoYXBlVHlwZXMpIHtcbiAgICAgICAgdmFyIGNoZWNrZXIgPSBzaGFwZVR5cGVzW2tleV07XG4gICAgICAgIGlmICghY2hlY2tlcikge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHZhciBlcnJvciA9IGNoZWNrZXIocHJvcFZhbHVlLCBrZXksIGNvbXBvbmVudE5hbWUsIGxvY2F0aW9uLCBwcm9wRnVsbE5hbWUgKyAnLicgKyBrZXksIFJlYWN0UHJvcFR5cGVzU2VjcmV0KTtcbiAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgcmV0dXJuIGVycm9yO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIGNyZWF0ZUNoYWluYWJsZVR5cGVDaGVja2VyKHZhbGlkYXRlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGlzTm9kZShwcm9wVmFsdWUpIHtcbiAgICBzd2l0Y2ggKHR5cGVvZiBwcm9wVmFsdWUpIHtcbiAgICAgIGNhc2UgJ251bWJlcic6XG4gICAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgY2FzZSAndW5kZWZpbmVkJzpcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICBjYXNlICdib29sZWFuJzpcbiAgICAgICAgcmV0dXJuICFwcm9wVmFsdWU7XG4gICAgICBjYXNlICdvYmplY3QnOlxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShwcm9wVmFsdWUpKSB7XG4gICAgICAgICAgcmV0dXJuIHByb3BWYWx1ZS5ldmVyeShpc05vZGUpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChwcm9wVmFsdWUgPT09IG51bGwgfHwgaXNWYWxpZEVsZW1lbnQocHJvcFZhbHVlKSkge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGl0ZXJhdG9yRm4gPSBnZXRJdGVyYXRvckZuKHByb3BWYWx1ZSk7XG4gICAgICAgIGlmIChpdGVyYXRvckZuKSB7XG4gICAgICAgICAgdmFyIGl0ZXJhdG9yID0gaXRlcmF0b3JGbi5jYWxsKHByb3BWYWx1ZSk7XG4gICAgICAgICAgdmFyIHN0ZXA7XG4gICAgICAgICAgaWYgKGl0ZXJhdG9yRm4gIT09IHByb3BWYWx1ZS5lbnRyaWVzKSB7XG4gICAgICAgICAgICB3aGlsZSAoIShzdGVwID0gaXRlcmF0b3IubmV4dCgpKS5kb25lKSB7XG4gICAgICAgICAgICAgIGlmICghaXNOb2RlKHN0ZXAudmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIEl0ZXJhdG9yIHdpbGwgcHJvdmlkZSBlbnRyeSBbayx2XSB0dXBsZXMgcmF0aGVyIHRoYW4gdmFsdWVzLlxuICAgICAgICAgICAgd2hpbGUgKCEoc3RlcCA9IGl0ZXJhdG9yLm5leHQoKSkuZG9uZSkge1xuICAgICAgICAgICAgICB2YXIgZW50cnkgPSBzdGVwLnZhbHVlO1xuICAgICAgICAgICAgICBpZiAoZW50cnkpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWlzTm9kZShlbnRyeVsxXSkpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gaXNTeW1ib2wocHJvcFR5cGUsIHByb3BWYWx1ZSkge1xuICAgIC8vIE5hdGl2ZSBTeW1ib2wuXG4gICAgaWYgKHByb3BUeXBlID09PSAnc3ltYm9sJykge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLy8gMTkuNC4zLjUgU3ltYm9sLnByb3RvdHlwZVtAQHRvU3RyaW5nVGFnXSA9PT0gJ1N5bWJvbCdcbiAgICBpZiAocHJvcFZhbHVlWydAQHRvU3RyaW5nVGFnJ10gPT09ICdTeW1ib2wnKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBGYWxsYmFjayBmb3Igbm9uLXNwZWMgY29tcGxpYW50IFN5bWJvbHMgd2hpY2ggYXJlIHBvbHlmaWxsZWQuXG4gICAgaWYgKHR5cGVvZiBTeW1ib2wgPT09ICdmdW5jdGlvbicgJiYgcHJvcFZhbHVlIGluc3RhbmNlb2YgU3ltYm9sKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvLyBFcXVpdmFsZW50IG9mIGB0eXBlb2ZgIGJ1dCB3aXRoIHNwZWNpYWwgaGFuZGxpbmcgZm9yIGFycmF5IGFuZCByZWdleHAuXG4gIGZ1bmN0aW9uIGdldFByb3BUeXBlKHByb3BWYWx1ZSkge1xuICAgIHZhciBwcm9wVHlwZSA9IHR5cGVvZiBwcm9wVmFsdWU7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkocHJvcFZhbHVlKSkge1xuICAgICAgcmV0dXJuICdhcnJheSc7XG4gICAgfVxuICAgIGlmIChwcm9wVmFsdWUgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgIC8vIE9sZCB3ZWJraXRzIChhdCBsZWFzdCB1bnRpbCBBbmRyb2lkIDQuMCkgcmV0dXJuICdmdW5jdGlvbicgcmF0aGVyIHRoYW5cbiAgICAgIC8vICdvYmplY3QnIGZvciB0eXBlb2YgYSBSZWdFeHAuIFdlJ2xsIG5vcm1hbGl6ZSB0aGlzIGhlcmUgc28gdGhhdCAvYmxhL1xuICAgICAgLy8gcGFzc2VzIFByb3BUeXBlcy5vYmplY3QuXG4gICAgICByZXR1cm4gJ29iamVjdCc7XG4gICAgfVxuICAgIGlmIChpc1N5bWJvbChwcm9wVHlwZSwgcHJvcFZhbHVlKSkge1xuICAgICAgcmV0dXJuICdzeW1ib2wnO1xuICAgIH1cbiAgICByZXR1cm4gcHJvcFR5cGU7XG4gIH1cblxuICAvLyBUaGlzIGhhbmRsZXMgbW9yZSB0eXBlcyB0aGFuIGBnZXRQcm9wVHlwZWAuIE9ubHkgdXNlZCBmb3IgZXJyb3IgbWVzc2FnZXMuXG4gIC8vIFNlZSBgY3JlYXRlUHJpbWl0aXZlVHlwZUNoZWNrZXJgLlxuICBmdW5jdGlvbiBnZXRQcmVjaXNlVHlwZShwcm9wVmFsdWUpIHtcbiAgICBpZiAodHlwZW9mIHByb3BWYWx1ZSA9PT0gJ3VuZGVmaW5lZCcgfHwgcHJvcFZhbHVlID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gJycgKyBwcm9wVmFsdWU7XG4gICAgfVxuICAgIHZhciBwcm9wVHlwZSA9IGdldFByb3BUeXBlKHByb3BWYWx1ZSk7XG4gICAgaWYgKHByb3BUeXBlID09PSAnb2JqZWN0Jykge1xuICAgICAgaWYgKHByb3BWYWx1ZSBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgICAgcmV0dXJuICdkYXRlJztcbiAgICAgIH0gZWxzZSBpZiAocHJvcFZhbHVlIGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICAgIHJldHVybiAncmVnZXhwJztcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHByb3BUeXBlO1xuICB9XG5cbiAgLy8gUmV0dXJucyBhIHN0cmluZyB0aGF0IGlzIHBvc3RmaXhlZCB0byBhIHdhcm5pbmcgYWJvdXQgYW4gaW52YWxpZCB0eXBlLlxuICAvLyBGb3IgZXhhbXBsZSwgXCJ1bmRlZmluZWRcIiBvciBcIm9mIHR5cGUgYXJyYXlcIlxuICBmdW5jdGlvbiBnZXRQb3N0Zml4Rm9yVHlwZVdhcm5pbmcodmFsdWUpIHtcbiAgICB2YXIgdHlwZSA9IGdldFByZWNpc2VUeXBlKHZhbHVlKTtcbiAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgIGNhc2UgJ2FycmF5JzpcbiAgICAgIGNhc2UgJ29iamVjdCc6XG4gICAgICAgIHJldHVybiAnYW4gJyArIHR5cGU7XG4gICAgICBjYXNlICdib29sZWFuJzpcbiAgICAgIGNhc2UgJ2RhdGUnOlxuICAgICAgY2FzZSAncmVnZXhwJzpcbiAgICAgICAgcmV0dXJuICdhICcgKyB0eXBlO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIHR5cGU7XG4gICAgfVxuICB9XG5cbiAgLy8gUmV0dXJucyBjbGFzcyBuYW1lIG9mIHRoZSBvYmplY3QsIGlmIGFueS5cbiAgZnVuY3Rpb24gZ2V0Q2xhc3NOYW1lKHByb3BWYWx1ZSkge1xuICAgIGlmICghcHJvcFZhbHVlLmNvbnN0cnVjdG9yIHx8ICFwcm9wVmFsdWUuY29uc3RydWN0b3IubmFtZSkge1xuICAgICAgcmV0dXJuIEFOT05ZTU9VUztcbiAgICB9XG4gICAgcmV0dXJuIHByb3BWYWx1ZS5jb25zdHJ1Y3Rvci5uYW1lO1xuICB9XG5cbiAgUmVhY3RQcm9wVHlwZXMuY2hlY2tQcm9wVHlwZXMgPSBjaGVja1Byb3BUeXBlcztcbiAgUmVhY3RQcm9wVHlwZXMuUHJvcFR5cGVzID0gUmVhY3RQcm9wVHlwZXM7XG5cbiAgcmV0dXJuIFJlYWN0UHJvcFR5cGVzO1xufTtcbiIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTMtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIFJlYWN0UHJvcFR5cGVzU2VjcmV0ID0gJ1NFQ1JFVF9ET19OT1RfUEFTU19USElTX09SX1lPVV9XSUxMX0JFX0ZJUkVEJztcblxubW9kdWxlLmV4cG9ydHMgPSBSZWFjdFByb3BUeXBlc1NlY3JldDtcbiIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTMtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICpcbiAqIFxuICovXG5cbid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBFc2NhcGUgYW5kIHdyYXAga2V5IHNvIGl0IGlzIHNhZmUgdG8gdXNlIGFzIGEgcmVhY3RpZFxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgdG8gYmUgZXNjYXBlZC5cbiAqIEByZXR1cm4ge3N0cmluZ30gdGhlIGVzY2FwZWQga2V5LlxuICovXG5cbmZ1bmN0aW9uIGVzY2FwZShrZXkpIHtcbiAgdmFyIGVzY2FwZVJlZ2V4ID0gL1s9Ol0vZztcbiAgdmFyIGVzY2FwZXJMb29rdXAgPSB7XG4gICAgJz0nOiAnPTAnLFxuICAgICc6JzogJz0yJ1xuICB9O1xuICB2YXIgZXNjYXBlZFN0cmluZyA9ICgnJyArIGtleSkucmVwbGFjZShlc2NhcGVSZWdleCwgZnVuY3Rpb24gKG1hdGNoKSB7XG4gICAgcmV0dXJuIGVzY2FwZXJMb29rdXBbbWF0Y2hdO1xuICB9KTtcblxuICByZXR1cm4gJyQnICsgZXNjYXBlZFN0cmluZztcbn1cblxuLyoqXG4gKiBVbmVzY2FwZSBhbmQgdW53cmFwIGtleSBmb3IgaHVtYW4tcmVhZGFibGUgZGlzcGxheVxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgdG8gdW5lc2NhcGUuXG4gKiBAcmV0dXJuIHtzdHJpbmd9IHRoZSB1bmVzY2FwZWQga2V5LlxuICovXG5mdW5jdGlvbiB1bmVzY2FwZShrZXkpIHtcbiAgdmFyIHVuZXNjYXBlUmVnZXggPSAvKD0wfD0yKS9nO1xuICB2YXIgdW5lc2NhcGVyTG9va3VwID0ge1xuICAgICc9MCc6ICc9JyxcbiAgICAnPTInOiAnOidcbiAgfTtcbiAgdmFyIGtleVN1YnN0cmluZyA9IGtleVswXSA9PT0gJy4nICYmIGtleVsxXSA9PT0gJyQnID8ga2V5LnN1YnN0cmluZygyKSA6IGtleS5zdWJzdHJpbmcoMSk7XG5cbiAgcmV0dXJuICgnJyArIGtleVN1YnN0cmluZykucmVwbGFjZSh1bmVzY2FwZVJlZ2V4LCBmdW5jdGlvbiAobWF0Y2gpIHtcbiAgICByZXR1cm4gdW5lc2NhcGVyTG9va3VwW21hdGNoXTtcbiAgfSk7XG59XG5cbnZhciBLZXlFc2NhcGVVdGlscyA9IHtcbiAgZXNjYXBlOiBlc2NhcGUsXG4gIHVuZXNjYXBlOiB1bmVzY2FwZVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBLZXlFc2NhcGVVdGlsczsiLCIvKipcbiAqIENvcHlyaWdodCAyMDEzLXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqXG4gKiBcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBfcHJvZEludmFyaWFudCA9IHJlcXVpcmUoJy4vcmVhY3RQcm9kSW52YXJpYW50Jyk7XG5cbnZhciBpbnZhcmlhbnQgPSByZXF1aXJlKCdmYmpzL2xpYi9pbnZhcmlhbnQnKTtcblxuLyoqXG4gKiBTdGF0aWMgcG9vbGVycy4gU2V2ZXJhbCBjdXN0b20gdmVyc2lvbnMgZm9yIGVhY2ggcG90ZW50aWFsIG51bWJlciBvZlxuICogYXJndW1lbnRzLiBBIGNvbXBsZXRlbHkgZ2VuZXJpYyBwb29sZXIgaXMgZWFzeSB0byBpbXBsZW1lbnQsIGJ1dCB3b3VsZFxuICogcmVxdWlyZSBhY2Nlc3NpbmcgdGhlIGBhcmd1bWVudHNgIG9iamVjdC4gSW4gZWFjaCBvZiB0aGVzZSwgYHRoaXNgIHJlZmVycyB0b1xuICogdGhlIENsYXNzIGl0c2VsZiwgbm90IGFuIGluc3RhbmNlLiBJZiBhbnkgb3RoZXJzIGFyZSBuZWVkZWQsIHNpbXBseSBhZGQgdGhlbVxuICogaGVyZSwgb3IgaW4gdGhlaXIgb3duIGZpbGVzLlxuICovXG52YXIgb25lQXJndW1lbnRQb29sZXIgPSBmdW5jdGlvbiAoY29weUZpZWxkc0Zyb20pIHtcbiAgdmFyIEtsYXNzID0gdGhpcztcbiAgaWYgKEtsYXNzLmluc3RhbmNlUG9vbC5sZW5ndGgpIHtcbiAgICB2YXIgaW5zdGFuY2UgPSBLbGFzcy5pbnN0YW5jZVBvb2wucG9wKCk7XG4gICAgS2xhc3MuY2FsbChpbnN0YW5jZSwgY29weUZpZWxkc0Zyb20pO1xuICAgIHJldHVybiBpbnN0YW5jZTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbmV3IEtsYXNzKGNvcHlGaWVsZHNGcm9tKTtcbiAgfVxufTtcblxudmFyIHR3b0FyZ3VtZW50UG9vbGVyID0gZnVuY3Rpb24gKGExLCBhMikge1xuICB2YXIgS2xhc3MgPSB0aGlzO1xuICBpZiAoS2xhc3MuaW5zdGFuY2VQb29sLmxlbmd0aCkge1xuICAgIHZhciBpbnN0YW5jZSA9IEtsYXNzLmluc3RhbmNlUG9vbC5wb3AoKTtcbiAgICBLbGFzcy5jYWxsKGluc3RhbmNlLCBhMSwgYTIpO1xuICAgIHJldHVybiBpbnN0YW5jZTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbmV3IEtsYXNzKGExLCBhMik7XG4gIH1cbn07XG5cbnZhciB0aHJlZUFyZ3VtZW50UG9vbGVyID0gZnVuY3Rpb24gKGExLCBhMiwgYTMpIHtcbiAgdmFyIEtsYXNzID0gdGhpcztcbiAgaWYgKEtsYXNzLmluc3RhbmNlUG9vbC5sZW5ndGgpIHtcbiAgICB2YXIgaW5zdGFuY2UgPSBLbGFzcy5pbnN0YW5jZVBvb2wucG9wKCk7XG4gICAgS2xhc3MuY2FsbChpbnN0YW5jZSwgYTEsIGEyLCBhMyk7XG4gICAgcmV0dXJuIGluc3RhbmNlO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBuZXcgS2xhc3MoYTEsIGEyLCBhMyk7XG4gIH1cbn07XG5cbnZhciBmb3VyQXJndW1lbnRQb29sZXIgPSBmdW5jdGlvbiAoYTEsIGEyLCBhMywgYTQpIHtcbiAgdmFyIEtsYXNzID0gdGhpcztcbiAgaWYgKEtsYXNzLmluc3RhbmNlUG9vbC5sZW5ndGgpIHtcbiAgICB2YXIgaW5zdGFuY2UgPSBLbGFzcy5pbnN0YW5jZVBvb2wucG9wKCk7XG4gICAgS2xhc3MuY2FsbChpbnN0YW5jZSwgYTEsIGEyLCBhMywgYTQpO1xuICAgIHJldHVybiBpbnN0YW5jZTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbmV3IEtsYXNzKGExLCBhMiwgYTMsIGE0KTtcbiAgfVxufTtcblxudmFyIHN0YW5kYXJkUmVsZWFzZXIgPSBmdW5jdGlvbiAoaW5zdGFuY2UpIHtcbiAgdmFyIEtsYXNzID0gdGhpcztcbiAgIShpbnN0YW5jZSBpbnN0YW5jZW9mIEtsYXNzKSA/IHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyBpbnZhcmlhbnQoZmFsc2UsICdUcnlpbmcgdG8gcmVsZWFzZSBhbiBpbnN0YW5jZSBpbnRvIGEgcG9vbCBvZiBhIGRpZmZlcmVudCB0eXBlLicpIDogX3Byb2RJbnZhcmlhbnQoJzI1JykgOiB2b2lkIDA7XG4gIGluc3RhbmNlLmRlc3RydWN0b3IoKTtcbiAgaWYgKEtsYXNzLmluc3RhbmNlUG9vbC5sZW5ndGggPCBLbGFzcy5wb29sU2l6ZSkge1xuICAgIEtsYXNzLmluc3RhbmNlUG9vbC5wdXNoKGluc3RhbmNlKTtcbiAgfVxufTtcblxudmFyIERFRkFVTFRfUE9PTF9TSVpFID0gMTA7XG52YXIgREVGQVVMVF9QT09MRVIgPSBvbmVBcmd1bWVudFBvb2xlcjtcblxuLyoqXG4gKiBBdWdtZW50cyBgQ29weUNvbnN0cnVjdG9yYCB0byBiZSBhIHBvb2xhYmxlIGNsYXNzLCBhdWdtZW50aW5nIG9ubHkgdGhlIGNsYXNzXG4gKiBpdHNlbGYgKHN0YXRpY2FsbHkpIG5vdCBhZGRpbmcgYW55IHByb3RvdHlwaWNhbCBmaWVsZHMuIEFueSBDb3B5Q29uc3RydWN0b3JcbiAqIHlvdSBnaXZlIHRoaXMgbWF5IGhhdmUgYSBgcG9vbFNpemVgIHByb3BlcnR5LCBhbmQgd2lsbCBsb29rIGZvciBhXG4gKiBwcm90b3R5cGljYWwgYGRlc3RydWN0b3JgIG9uIGluc3RhbmNlcy5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBDb3B5Q29uc3RydWN0b3IgQ29uc3RydWN0b3IgdGhhdCBjYW4gYmUgdXNlZCB0byByZXNldC5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IHBvb2xlciBDdXN0b21pemFibGUgcG9vbGVyLlxuICovXG52YXIgYWRkUG9vbGluZ1RvID0gZnVuY3Rpb24gKENvcHlDb25zdHJ1Y3RvciwgcG9vbGVyKSB7XG4gIC8vIENhc3RpbmcgYXMgYW55IHNvIHRoYXQgZmxvdyBpZ25vcmVzIHRoZSBhY3R1YWwgaW1wbGVtZW50YXRpb24gYW5kIHRydXN0c1xuICAvLyBpdCB0byBtYXRjaCB0aGUgdHlwZSB3ZSBkZWNsYXJlZFxuICB2YXIgTmV3S2xhc3MgPSBDb3B5Q29uc3RydWN0b3I7XG4gIE5ld0tsYXNzLmluc3RhbmNlUG9vbCA9IFtdO1xuICBOZXdLbGFzcy5nZXRQb29sZWQgPSBwb29sZXIgfHwgREVGQVVMVF9QT09MRVI7XG4gIGlmICghTmV3S2xhc3MucG9vbFNpemUpIHtcbiAgICBOZXdLbGFzcy5wb29sU2l6ZSA9IERFRkFVTFRfUE9PTF9TSVpFO1xuICB9XG4gIE5ld0tsYXNzLnJlbGVhc2UgPSBzdGFuZGFyZFJlbGVhc2VyO1xuICByZXR1cm4gTmV3S2xhc3M7XG59O1xuXG52YXIgUG9vbGVkQ2xhc3MgPSB7XG4gIGFkZFBvb2xpbmdUbzogYWRkUG9vbGluZ1RvLFxuICBvbmVBcmd1bWVudFBvb2xlcjogb25lQXJndW1lbnRQb29sZXIsXG4gIHR3b0FyZ3VtZW50UG9vbGVyOiB0d29Bcmd1bWVudFBvb2xlcixcbiAgdGhyZWVBcmd1bWVudFBvb2xlcjogdGhyZWVBcmd1bWVudFBvb2xlcixcbiAgZm91ckFyZ3VtZW50UG9vbGVyOiBmb3VyQXJndW1lbnRQb29sZXJcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUG9vbGVkQ2xhc3M7IiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxMy1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIF9hc3NpZ24gPSByZXF1aXJlKCdvYmplY3QtYXNzaWduJyk7XG5cbnZhciBSZWFjdEJhc2VDbGFzc2VzID0gcmVxdWlyZSgnLi9SZWFjdEJhc2VDbGFzc2VzJyk7XG52YXIgUmVhY3RDaGlsZHJlbiA9IHJlcXVpcmUoJy4vUmVhY3RDaGlsZHJlbicpO1xudmFyIFJlYWN0RE9NRmFjdG9yaWVzID0gcmVxdWlyZSgnLi9SZWFjdERPTUZhY3RvcmllcycpO1xudmFyIFJlYWN0RWxlbWVudCA9IHJlcXVpcmUoJy4vUmVhY3RFbGVtZW50Jyk7XG52YXIgUmVhY3RQcm9wVHlwZXMgPSByZXF1aXJlKCcuL1JlYWN0UHJvcFR5cGVzJyk7XG52YXIgUmVhY3RWZXJzaW9uID0gcmVxdWlyZSgnLi9SZWFjdFZlcnNpb24nKTtcblxudmFyIGNyZWF0ZVJlYWN0Q2xhc3MgPSByZXF1aXJlKCcuL2NyZWF0ZUNsYXNzJyk7XG52YXIgb25seUNoaWxkID0gcmVxdWlyZSgnLi9vbmx5Q2hpbGQnKTtcblxudmFyIGNyZWF0ZUVsZW1lbnQgPSBSZWFjdEVsZW1lbnQuY3JlYXRlRWxlbWVudDtcbnZhciBjcmVhdGVGYWN0b3J5ID0gUmVhY3RFbGVtZW50LmNyZWF0ZUZhY3Rvcnk7XG52YXIgY2xvbmVFbGVtZW50ID0gUmVhY3RFbGVtZW50LmNsb25lRWxlbWVudDtcblxuaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgdmFyIGxvd1ByaW9yaXR5V2FybmluZyA9IHJlcXVpcmUoJy4vbG93UHJpb3JpdHlXYXJuaW5nJyk7XG4gIHZhciBjYW5EZWZpbmVQcm9wZXJ0eSA9IHJlcXVpcmUoJy4vY2FuRGVmaW5lUHJvcGVydHknKTtcbiAgdmFyIFJlYWN0RWxlbWVudFZhbGlkYXRvciA9IHJlcXVpcmUoJy4vUmVhY3RFbGVtZW50VmFsaWRhdG9yJyk7XG4gIHZhciBkaWRXYXJuUHJvcFR5cGVzRGVwcmVjYXRlZCA9IGZhbHNlO1xuICBjcmVhdGVFbGVtZW50ID0gUmVhY3RFbGVtZW50VmFsaWRhdG9yLmNyZWF0ZUVsZW1lbnQ7XG4gIGNyZWF0ZUZhY3RvcnkgPSBSZWFjdEVsZW1lbnRWYWxpZGF0b3IuY3JlYXRlRmFjdG9yeTtcbiAgY2xvbmVFbGVtZW50ID0gUmVhY3RFbGVtZW50VmFsaWRhdG9yLmNsb25lRWxlbWVudDtcbn1cblxudmFyIF9fc3ByZWFkID0gX2Fzc2lnbjtcbnZhciBjcmVhdGVNaXhpbiA9IGZ1bmN0aW9uIChtaXhpbikge1xuICByZXR1cm4gbWl4aW47XG59O1xuXG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICB2YXIgd2FybmVkRm9yU3ByZWFkID0gZmFsc2U7XG4gIHZhciB3YXJuZWRGb3JDcmVhdGVNaXhpbiA9IGZhbHNlO1xuICBfX3NwcmVhZCA9IGZ1bmN0aW9uICgpIHtcbiAgICBsb3dQcmlvcml0eVdhcm5pbmcod2FybmVkRm9yU3ByZWFkLCAnUmVhY3QuX19zcHJlYWQgaXMgZGVwcmVjYXRlZCBhbmQgc2hvdWxkIG5vdCBiZSB1c2VkLiBVc2UgJyArICdPYmplY3QuYXNzaWduIGRpcmVjdGx5IG9yIGFub3RoZXIgaGVscGVyIGZ1bmN0aW9uIHdpdGggc2ltaWxhciAnICsgJ3NlbWFudGljcy4gWW91IG1heSBiZSBzZWVpbmcgdGhpcyB3YXJuaW5nIGR1ZSB0byB5b3VyIGNvbXBpbGVyLiAnICsgJ1NlZSBodHRwczovL2ZiLm1lL3JlYWN0LXNwcmVhZC1kZXByZWNhdGlvbiBmb3IgbW9yZSBkZXRhaWxzLicpO1xuICAgIHdhcm5lZEZvclNwcmVhZCA9IHRydWU7XG4gICAgcmV0dXJuIF9hc3NpZ24uYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgfTtcblxuICBjcmVhdGVNaXhpbiA9IGZ1bmN0aW9uIChtaXhpbikge1xuICAgIGxvd1ByaW9yaXR5V2FybmluZyh3YXJuZWRGb3JDcmVhdGVNaXhpbiwgJ1JlYWN0LmNyZWF0ZU1peGluIGlzIGRlcHJlY2F0ZWQgYW5kIHNob3VsZCBub3QgYmUgdXNlZC4gJyArICdJbiBSZWFjdCB2MTYuMCwgaXQgd2lsbCBiZSByZW1vdmVkLiAnICsgJ1lvdSBjYW4gdXNlIHRoaXMgbWl4aW4gZGlyZWN0bHkgaW5zdGVhZC4gJyArICdTZWUgaHR0cHM6Ly9mYi5tZS9jcmVhdGVtaXhpbi13YXMtbmV2ZXItaW1wbGVtZW50ZWQgZm9yIG1vcmUgaW5mby4nKTtcbiAgICB3YXJuZWRGb3JDcmVhdGVNaXhpbiA9IHRydWU7XG4gICAgcmV0dXJuIG1peGluO1xuICB9O1xufVxuXG52YXIgUmVhY3QgPSB7XG4gIC8vIE1vZGVyblxuXG4gIENoaWxkcmVuOiB7XG4gICAgbWFwOiBSZWFjdENoaWxkcmVuLm1hcCxcbiAgICBmb3JFYWNoOiBSZWFjdENoaWxkcmVuLmZvckVhY2gsXG4gICAgY291bnQ6IFJlYWN0Q2hpbGRyZW4uY291bnQsXG4gICAgdG9BcnJheTogUmVhY3RDaGlsZHJlbi50b0FycmF5LFxuICAgIG9ubHk6IG9ubHlDaGlsZFxuICB9LFxuXG4gIENvbXBvbmVudDogUmVhY3RCYXNlQ2xhc3Nlcy5Db21wb25lbnQsXG4gIFB1cmVDb21wb25lbnQ6IFJlYWN0QmFzZUNsYXNzZXMuUHVyZUNvbXBvbmVudCxcblxuICBjcmVhdGVFbGVtZW50OiBjcmVhdGVFbGVtZW50LFxuICBjbG9uZUVsZW1lbnQ6IGNsb25lRWxlbWVudCxcbiAgaXNWYWxpZEVsZW1lbnQ6IFJlYWN0RWxlbWVudC5pc1ZhbGlkRWxlbWVudCxcblxuICAvLyBDbGFzc2ljXG5cbiAgUHJvcFR5cGVzOiBSZWFjdFByb3BUeXBlcyxcbiAgY3JlYXRlQ2xhc3M6IGNyZWF0ZVJlYWN0Q2xhc3MsXG4gIGNyZWF0ZUZhY3Rvcnk6IGNyZWF0ZUZhY3RvcnksXG4gIGNyZWF0ZU1peGluOiBjcmVhdGVNaXhpbixcblxuICAvLyBUaGlzIGxvb2tzIERPTSBzcGVjaWZpYyBidXQgdGhlc2UgYXJlIGFjdHVhbGx5IGlzb21vcnBoaWMgaGVscGVyc1xuICAvLyBzaW5jZSB0aGV5IGFyZSBqdXN0IGdlbmVyYXRpbmcgRE9NIHN0cmluZ3MuXG4gIERPTTogUmVhY3RET01GYWN0b3JpZXMsXG5cbiAgdmVyc2lvbjogUmVhY3RWZXJzaW9uLFxuXG4gIC8vIERlcHJlY2F0ZWQgaG9vayBmb3IgSlNYIHNwcmVhZCwgZG9uJ3QgdXNlIHRoaXMgZm9yIGFueXRoaW5nLlxuICBfX3NwcmVhZDogX19zcHJlYWRcbn07XG5cbmlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gIHZhciB3YXJuZWRGb3JDcmVhdGVDbGFzcyA9IGZhbHNlO1xuICBpZiAoY2FuRGVmaW5lUHJvcGVydHkpIHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoUmVhY3QsICdQcm9wVHlwZXMnLCB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgbG93UHJpb3JpdHlXYXJuaW5nKGRpZFdhcm5Qcm9wVHlwZXNEZXByZWNhdGVkLCAnQWNjZXNzaW5nIFByb3BUeXBlcyB2aWEgdGhlIG1haW4gUmVhY3QgcGFja2FnZSBpcyBkZXByZWNhdGVkLCcgKyAnIGFuZCB3aWxsIGJlIHJlbW92ZWQgaW4gIFJlYWN0IHYxNi4wLicgKyAnIFVzZSB0aGUgbGF0ZXN0IGF2YWlsYWJsZSB2MTUuKiBwcm9wLXR5cGVzIHBhY2thZ2UgZnJvbSBucG0gaW5zdGVhZC4nICsgJyBGb3IgaW5mbyBvbiB1c2FnZSwgY29tcGF0aWJpbGl0eSwgbWlncmF0aW9uIGFuZCBtb3JlLCBzZWUgJyArICdodHRwczovL2ZiLm1lL3Byb3AtdHlwZXMtZG9jcycpO1xuICAgICAgICBkaWRXYXJuUHJvcFR5cGVzRGVwcmVjYXRlZCA9IHRydWU7XG4gICAgICAgIHJldHVybiBSZWFjdFByb3BUeXBlcztcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShSZWFjdCwgJ2NyZWF0ZUNsYXNzJywge1xuICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGxvd1ByaW9yaXR5V2FybmluZyh3YXJuZWRGb3JDcmVhdGVDbGFzcywgJ0FjY2Vzc2luZyBjcmVhdGVDbGFzcyB2aWEgdGhlIG1haW4gUmVhY3QgcGFja2FnZSBpcyBkZXByZWNhdGVkLCcgKyAnIGFuZCB3aWxsIGJlIHJlbW92ZWQgaW4gUmVhY3QgdjE2LjAuJyArIFwiIFVzZSBhIHBsYWluIEphdmFTY3JpcHQgY2xhc3MgaW5zdGVhZC4gSWYgeW91J3JlIG5vdCB5ZXQgXCIgKyAncmVhZHkgdG8gbWlncmF0ZSwgY3JlYXRlLXJlYWN0LWNsYXNzIHYxNS4qIGlzIGF2YWlsYWJsZSAnICsgJ29uIG5wbSBhcyBhIHRlbXBvcmFyeSwgZHJvcC1pbiByZXBsYWNlbWVudC4gJyArICdGb3IgbW9yZSBpbmZvIHNlZSBodHRwczovL2ZiLm1lL3JlYWN0LWNyZWF0ZS1jbGFzcycpO1xuICAgICAgICB3YXJuZWRGb3JDcmVhdGVDbGFzcyA9IHRydWU7XG4gICAgICAgIHJldHVybiBjcmVhdGVSZWFjdENsYXNzO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLy8gUmVhY3QuRE9NIGZhY3RvcmllcyBhcmUgZGVwcmVjYXRlZC4gV3JhcCB0aGVzZSBtZXRob2RzIHNvIHRoYXRcbiAgLy8gaW52b2NhdGlvbnMgb2YgdGhlIFJlYWN0LkRPTSBuYW1lc3BhY2UgYW5kIGFsZXJ0IHVzZXJzIHRvIHN3aXRjaFxuICAvLyB0byB0aGUgYHJlYWN0LWRvbS1mYWN0b3JpZXNgIHBhY2thZ2UuXG4gIFJlYWN0LkRPTSA9IHt9O1xuICB2YXIgd2FybmVkRm9yRmFjdG9yaWVzID0gZmFsc2U7XG4gIE9iamVjdC5rZXlzKFJlYWN0RE9NRmFjdG9yaWVzKS5mb3JFYWNoKGZ1bmN0aW9uIChmYWN0b3J5KSB7XG4gICAgUmVhY3QuRE9NW2ZhY3RvcnldID0gZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKCF3YXJuZWRGb3JGYWN0b3JpZXMpIHtcbiAgICAgICAgbG93UHJpb3JpdHlXYXJuaW5nKGZhbHNlLCAnQWNjZXNzaW5nIGZhY3RvcmllcyBsaWtlIFJlYWN0LkRPTS4lcyBoYXMgYmVlbiBkZXByZWNhdGVkICcgKyAnYW5kIHdpbGwgYmUgcmVtb3ZlZCBpbiB2MTYuMCsuIFVzZSB0aGUgJyArICdyZWFjdC1kb20tZmFjdG9yaWVzIHBhY2thZ2UgaW5zdGVhZC4gJyArICcgVmVyc2lvbiAxLjAgcHJvdmlkZXMgYSBkcm9wLWluIHJlcGxhY2VtZW50LicgKyAnIEZvciBtb3JlIGluZm8sIHNlZSBodHRwczovL2ZiLm1lL3JlYWN0LWRvbS1mYWN0b3JpZXMnLCBmYWN0b3J5KTtcbiAgICAgICAgd2FybmVkRm9yRmFjdG9yaWVzID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBSZWFjdERPTUZhY3Rvcmllc1tmYWN0b3J5XS5hcHBseShSZWFjdERPTUZhY3RvcmllcywgYXJndW1lbnRzKTtcbiAgICB9O1xuICB9KTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBSZWFjdDsiLCIvKipcbiAqIENvcHlyaWdodCAyMDEzLXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgX3Byb2RJbnZhcmlhbnQgPSByZXF1aXJlKCcuL3JlYWN0UHJvZEludmFyaWFudCcpLFxuICAgIF9hc3NpZ24gPSByZXF1aXJlKCdvYmplY3QtYXNzaWduJyk7XG5cbnZhciBSZWFjdE5vb3BVcGRhdGVRdWV1ZSA9IHJlcXVpcmUoJy4vUmVhY3ROb29wVXBkYXRlUXVldWUnKTtcblxudmFyIGNhbkRlZmluZVByb3BlcnR5ID0gcmVxdWlyZSgnLi9jYW5EZWZpbmVQcm9wZXJ0eScpO1xudmFyIGVtcHR5T2JqZWN0ID0gcmVxdWlyZSgnZmJqcy9saWIvZW1wdHlPYmplY3QnKTtcbnZhciBpbnZhcmlhbnQgPSByZXF1aXJlKCdmYmpzL2xpYi9pbnZhcmlhbnQnKTtcbnZhciBsb3dQcmlvcml0eVdhcm5pbmcgPSByZXF1aXJlKCcuL2xvd1ByaW9yaXR5V2FybmluZycpO1xuXG4vKipcbiAqIEJhc2UgY2xhc3MgaGVscGVycyBmb3IgdGhlIHVwZGF0aW5nIHN0YXRlIG9mIGEgY29tcG9uZW50LlxuICovXG5mdW5jdGlvbiBSZWFjdENvbXBvbmVudChwcm9wcywgY29udGV4dCwgdXBkYXRlcikge1xuICB0aGlzLnByb3BzID0gcHJvcHM7XG4gIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG4gIHRoaXMucmVmcyA9IGVtcHR5T2JqZWN0O1xuICAvLyBXZSBpbml0aWFsaXplIHRoZSBkZWZhdWx0IHVwZGF0ZXIgYnV0IHRoZSByZWFsIG9uZSBnZXRzIGluamVjdGVkIGJ5IHRoZVxuICAvLyByZW5kZXJlci5cbiAgdGhpcy51cGRhdGVyID0gdXBkYXRlciB8fCBSZWFjdE5vb3BVcGRhdGVRdWV1ZTtcbn1cblxuUmVhY3RDb21wb25lbnQucHJvdG90eXBlLmlzUmVhY3RDb21wb25lbnQgPSB7fTtcblxuLyoqXG4gKiBTZXRzIGEgc3Vic2V0IG9mIHRoZSBzdGF0ZS4gQWx3YXlzIHVzZSB0aGlzIHRvIG11dGF0ZVxuICogc3RhdGUuIFlvdSBzaG91bGQgdHJlYXQgYHRoaXMuc3RhdGVgIGFzIGltbXV0YWJsZS5cbiAqXG4gKiBUaGVyZSBpcyBubyBndWFyYW50ZWUgdGhhdCBgdGhpcy5zdGF0ZWAgd2lsbCBiZSBpbW1lZGlhdGVseSB1cGRhdGVkLCBzb1xuICogYWNjZXNzaW5nIGB0aGlzLnN0YXRlYCBhZnRlciBjYWxsaW5nIHRoaXMgbWV0aG9kIG1heSByZXR1cm4gdGhlIG9sZCB2YWx1ZS5cbiAqXG4gKiBUaGVyZSBpcyBubyBndWFyYW50ZWUgdGhhdCBjYWxscyB0byBgc2V0U3RhdGVgIHdpbGwgcnVuIHN5bmNocm9ub3VzbHksXG4gKiBhcyB0aGV5IG1heSBldmVudHVhbGx5IGJlIGJhdGNoZWQgdG9nZXRoZXIuICBZb3UgY2FuIHByb3ZpZGUgYW4gb3B0aW9uYWxcbiAqIGNhbGxiYWNrIHRoYXQgd2lsbCBiZSBleGVjdXRlZCB3aGVuIHRoZSBjYWxsIHRvIHNldFN0YXRlIGlzIGFjdHVhbGx5XG4gKiBjb21wbGV0ZWQuXG4gKlxuICogV2hlbiBhIGZ1bmN0aW9uIGlzIHByb3ZpZGVkIHRvIHNldFN0YXRlLCBpdCB3aWxsIGJlIGNhbGxlZCBhdCBzb21lIHBvaW50IGluXG4gKiB0aGUgZnV0dXJlIChub3Qgc3luY2hyb25vdXNseSkuIEl0IHdpbGwgYmUgY2FsbGVkIHdpdGggdGhlIHVwIHRvIGRhdGVcbiAqIGNvbXBvbmVudCBhcmd1bWVudHMgKHN0YXRlLCBwcm9wcywgY29udGV4dCkuIFRoZXNlIHZhbHVlcyBjYW4gYmUgZGlmZmVyZW50XG4gKiBmcm9tIHRoaXMuKiBiZWNhdXNlIHlvdXIgZnVuY3Rpb24gbWF5IGJlIGNhbGxlZCBhZnRlciByZWNlaXZlUHJvcHMgYnV0IGJlZm9yZVxuICogc2hvdWxkQ29tcG9uZW50VXBkYXRlLCBhbmQgdGhpcyBuZXcgc3RhdGUsIHByb3BzLCBhbmQgY29udGV4dCB3aWxsIG5vdCB5ZXQgYmVcbiAqIGFzc2lnbmVkIHRvIHRoaXMuXG4gKlxuICogQHBhcmFtIHtvYmplY3R8ZnVuY3Rpb259IHBhcnRpYWxTdGF0ZSBOZXh0IHBhcnRpYWwgc3RhdGUgb3IgZnVuY3Rpb24gdG9cbiAqICAgICAgICBwcm9kdWNlIG5leHQgcGFydGlhbCBzdGF0ZSB0byBiZSBtZXJnZWQgd2l0aCBjdXJyZW50IHN0YXRlLlxuICogQHBhcmFtIHs/ZnVuY3Rpb259IGNhbGxiYWNrIENhbGxlZCBhZnRlciBzdGF0ZSBpcyB1cGRhdGVkLlxuICogQGZpbmFsXG4gKiBAcHJvdGVjdGVkXG4gKi9cblJlYWN0Q29tcG9uZW50LnByb3RvdHlwZS5zZXRTdGF0ZSA9IGZ1bmN0aW9uIChwYXJ0aWFsU3RhdGUsIGNhbGxiYWNrKSB7XG4gICEodHlwZW9mIHBhcnRpYWxTdGF0ZSA9PT0gJ29iamVjdCcgfHwgdHlwZW9mIHBhcnRpYWxTdGF0ZSA9PT0gJ2Z1bmN0aW9uJyB8fCBwYXJ0aWFsU3RhdGUgPT0gbnVsbCkgPyBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nID8gaW52YXJpYW50KGZhbHNlLCAnc2V0U3RhdGUoLi4uKTogdGFrZXMgYW4gb2JqZWN0IG9mIHN0YXRlIHZhcmlhYmxlcyB0byB1cGRhdGUgb3IgYSBmdW5jdGlvbiB3aGljaCByZXR1cm5zIGFuIG9iamVjdCBvZiBzdGF0ZSB2YXJpYWJsZXMuJykgOiBfcHJvZEludmFyaWFudCgnODUnKSA6IHZvaWQgMDtcbiAgdGhpcy51cGRhdGVyLmVucXVldWVTZXRTdGF0ZSh0aGlzLCBwYXJ0aWFsU3RhdGUpO1xuICBpZiAoY2FsbGJhY2spIHtcbiAgICB0aGlzLnVwZGF0ZXIuZW5xdWV1ZUNhbGxiYWNrKHRoaXMsIGNhbGxiYWNrLCAnc2V0U3RhdGUnKTtcbiAgfVxufTtcblxuLyoqXG4gKiBGb3JjZXMgYW4gdXBkYXRlLiBUaGlzIHNob3VsZCBvbmx5IGJlIGludm9rZWQgd2hlbiBpdCBpcyBrbm93biB3aXRoXG4gKiBjZXJ0YWludHkgdGhhdCB3ZSBhcmUgKipub3QqKiBpbiBhIERPTSB0cmFuc2FjdGlvbi5cbiAqXG4gKiBZb3UgbWF5IHdhbnQgdG8gY2FsbCB0aGlzIHdoZW4geW91IGtub3cgdGhhdCBzb21lIGRlZXBlciBhc3BlY3Qgb2YgdGhlXG4gKiBjb21wb25lbnQncyBzdGF0ZSBoYXMgY2hhbmdlZCBidXQgYHNldFN0YXRlYCB3YXMgbm90IGNhbGxlZC5cbiAqXG4gKiBUaGlzIHdpbGwgbm90IGludm9rZSBgc2hvdWxkQ29tcG9uZW50VXBkYXRlYCwgYnV0IGl0IHdpbGwgaW52b2tlXG4gKiBgY29tcG9uZW50V2lsbFVwZGF0ZWAgYW5kIGBjb21wb25lbnREaWRVcGRhdGVgLlxuICpcbiAqIEBwYXJhbSB7P2Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsZWQgYWZ0ZXIgdXBkYXRlIGlzIGNvbXBsZXRlLlxuICogQGZpbmFsXG4gKiBAcHJvdGVjdGVkXG4gKi9cblJlYWN0Q29tcG9uZW50LnByb3RvdHlwZS5mb3JjZVVwZGF0ZSA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICB0aGlzLnVwZGF0ZXIuZW5xdWV1ZUZvcmNlVXBkYXRlKHRoaXMpO1xuICBpZiAoY2FsbGJhY2spIHtcbiAgICB0aGlzLnVwZGF0ZXIuZW5xdWV1ZUNhbGxiYWNrKHRoaXMsIGNhbGxiYWNrLCAnZm9yY2VVcGRhdGUnKTtcbiAgfVxufTtcblxuLyoqXG4gKiBEZXByZWNhdGVkIEFQSXMuIFRoZXNlIEFQSXMgdXNlZCB0byBleGlzdCBvbiBjbGFzc2ljIFJlYWN0IGNsYXNzZXMgYnV0IHNpbmNlXG4gKiB3ZSB3b3VsZCBsaWtlIHRvIGRlcHJlY2F0ZSB0aGVtLCB3ZSdyZSBub3QgZ29pbmcgdG8gbW92ZSB0aGVtIG92ZXIgdG8gdGhpc1xuICogbW9kZXJuIGJhc2UgY2xhc3MuIEluc3RlYWQsIHdlIGRlZmluZSBhIGdldHRlciB0aGF0IHdhcm5zIGlmIGl0J3MgYWNjZXNzZWQuXG4gKi9cbmlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gIHZhciBkZXByZWNhdGVkQVBJcyA9IHtcbiAgICBpc01vdW50ZWQ6IFsnaXNNb3VudGVkJywgJ0luc3RlYWQsIG1ha2Ugc3VyZSB0byBjbGVhbiB1cCBzdWJzY3JpcHRpb25zIGFuZCBwZW5kaW5nIHJlcXVlc3RzIGluICcgKyAnY29tcG9uZW50V2lsbFVubW91bnQgdG8gcHJldmVudCBtZW1vcnkgbGVha3MuJ10sXG4gICAgcmVwbGFjZVN0YXRlOiBbJ3JlcGxhY2VTdGF0ZScsICdSZWZhY3RvciB5b3VyIGNvZGUgdG8gdXNlIHNldFN0YXRlIGluc3RlYWQgKHNlZSAnICsgJ2h0dHBzOi8vZ2l0aHViLmNvbS9mYWNlYm9vay9yZWFjdC9pc3N1ZXMvMzIzNikuJ11cbiAgfTtcbiAgdmFyIGRlZmluZURlcHJlY2F0aW9uV2FybmluZyA9IGZ1bmN0aW9uIChtZXRob2ROYW1lLCBpbmZvKSB7XG4gICAgaWYgKGNhbkRlZmluZVByb3BlcnR5KSB7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoUmVhY3RDb21wb25lbnQucHJvdG90eXBlLCBtZXRob2ROYW1lLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGxvd1ByaW9yaXR5V2FybmluZyhmYWxzZSwgJyVzKC4uLikgaXMgZGVwcmVjYXRlZCBpbiBwbGFpbiBKYXZhU2NyaXB0IFJlYWN0IGNsYXNzZXMuICVzJywgaW5mb1swXSwgaW5mb1sxXSk7XG4gICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9O1xuICBmb3IgKHZhciBmbk5hbWUgaW4gZGVwcmVjYXRlZEFQSXMpIHtcbiAgICBpZiAoZGVwcmVjYXRlZEFQSXMuaGFzT3duUHJvcGVydHkoZm5OYW1lKSkge1xuICAgICAgZGVmaW5lRGVwcmVjYXRpb25XYXJuaW5nKGZuTmFtZSwgZGVwcmVjYXRlZEFQSXNbZm5OYW1lXSk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQmFzZSBjbGFzcyBoZWxwZXJzIGZvciB0aGUgdXBkYXRpbmcgc3RhdGUgb2YgYSBjb21wb25lbnQuXG4gKi9cbmZ1bmN0aW9uIFJlYWN0UHVyZUNvbXBvbmVudChwcm9wcywgY29udGV4dCwgdXBkYXRlcikge1xuICAvLyBEdXBsaWNhdGVkIGZyb20gUmVhY3RDb21wb25lbnQuXG4gIHRoaXMucHJvcHMgPSBwcm9wcztcbiAgdGhpcy5jb250ZXh0ID0gY29udGV4dDtcbiAgdGhpcy5yZWZzID0gZW1wdHlPYmplY3Q7XG4gIC8vIFdlIGluaXRpYWxpemUgdGhlIGRlZmF1bHQgdXBkYXRlciBidXQgdGhlIHJlYWwgb25lIGdldHMgaW5qZWN0ZWQgYnkgdGhlXG4gIC8vIHJlbmRlcmVyLlxuICB0aGlzLnVwZGF0ZXIgPSB1cGRhdGVyIHx8IFJlYWN0Tm9vcFVwZGF0ZVF1ZXVlO1xufVxuXG5mdW5jdGlvbiBDb21wb25lbnREdW1teSgpIHt9XG5Db21wb25lbnREdW1teS5wcm90b3R5cGUgPSBSZWFjdENvbXBvbmVudC5wcm90b3R5cGU7XG5SZWFjdFB1cmVDb21wb25lbnQucHJvdG90eXBlID0gbmV3IENvbXBvbmVudER1bW15KCk7XG5SZWFjdFB1cmVDb21wb25lbnQucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gUmVhY3RQdXJlQ29tcG9uZW50O1xuLy8gQXZvaWQgYW4gZXh0cmEgcHJvdG90eXBlIGp1bXAgZm9yIHRoZXNlIG1ldGhvZHMuXG5fYXNzaWduKFJlYWN0UHVyZUNvbXBvbmVudC5wcm90b3R5cGUsIFJlYWN0Q29tcG9uZW50LnByb3RvdHlwZSk7XG5SZWFjdFB1cmVDb21wb25lbnQucHJvdG90eXBlLmlzUHVyZVJlYWN0Q29tcG9uZW50ID0gdHJ1ZTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIENvbXBvbmVudDogUmVhY3RDb21wb25lbnQsXG4gIFB1cmVDb21wb25lbnQ6IFJlYWN0UHVyZUNvbXBvbmVudFxufTsiLCIvKipcbiAqIENvcHlyaWdodCAyMDEzLXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgUG9vbGVkQ2xhc3MgPSByZXF1aXJlKCcuL1Bvb2xlZENsYXNzJyk7XG52YXIgUmVhY3RFbGVtZW50ID0gcmVxdWlyZSgnLi9SZWFjdEVsZW1lbnQnKTtcblxudmFyIGVtcHR5RnVuY3Rpb24gPSByZXF1aXJlKCdmYmpzL2xpYi9lbXB0eUZ1bmN0aW9uJyk7XG52YXIgdHJhdmVyc2VBbGxDaGlsZHJlbiA9IHJlcXVpcmUoJy4vdHJhdmVyc2VBbGxDaGlsZHJlbicpO1xuXG52YXIgdHdvQXJndW1lbnRQb29sZXIgPSBQb29sZWRDbGFzcy50d29Bcmd1bWVudFBvb2xlcjtcbnZhciBmb3VyQXJndW1lbnRQb29sZXIgPSBQb29sZWRDbGFzcy5mb3VyQXJndW1lbnRQb29sZXI7XG5cbnZhciB1c2VyUHJvdmlkZWRLZXlFc2NhcGVSZWdleCA9IC9cXC8rL2c7XG5mdW5jdGlvbiBlc2NhcGVVc2VyUHJvdmlkZWRLZXkodGV4dCkge1xuICByZXR1cm4gKCcnICsgdGV4dCkucmVwbGFjZSh1c2VyUHJvdmlkZWRLZXlFc2NhcGVSZWdleCwgJyQmLycpO1xufVxuXG4vKipcbiAqIFBvb2xlZENsYXNzIHJlcHJlc2VudGluZyB0aGUgYm9va2tlZXBpbmcgYXNzb2NpYXRlZCB3aXRoIHBlcmZvcm1pbmcgYSBjaGlsZFxuICogdHJhdmVyc2FsLiBBbGxvd3MgYXZvaWRpbmcgYmluZGluZyBjYWxsYmFja3MuXG4gKlxuICogQGNvbnN0cnVjdG9yIEZvckVhY2hCb29rS2VlcGluZ1xuICogQHBhcmFtIHshZnVuY3Rpb259IGZvckVhY2hGdW5jdGlvbiBGdW5jdGlvbiB0byBwZXJmb3JtIHRyYXZlcnNhbCB3aXRoLlxuICogQHBhcmFtIHs/Kn0gZm9yRWFjaENvbnRleHQgQ29udGV4dCB0byBwZXJmb3JtIGNvbnRleHQgd2l0aC5cbiAqL1xuZnVuY3Rpb24gRm9yRWFjaEJvb2tLZWVwaW5nKGZvckVhY2hGdW5jdGlvbiwgZm9yRWFjaENvbnRleHQpIHtcbiAgdGhpcy5mdW5jID0gZm9yRWFjaEZ1bmN0aW9uO1xuICB0aGlzLmNvbnRleHQgPSBmb3JFYWNoQ29udGV4dDtcbiAgdGhpcy5jb3VudCA9IDA7XG59XG5Gb3JFYWNoQm9va0tlZXBpbmcucHJvdG90eXBlLmRlc3RydWN0b3IgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMuZnVuYyA9IG51bGw7XG4gIHRoaXMuY29udGV4dCA9IG51bGw7XG4gIHRoaXMuY291bnQgPSAwO1xufTtcblBvb2xlZENsYXNzLmFkZFBvb2xpbmdUbyhGb3JFYWNoQm9va0tlZXBpbmcsIHR3b0FyZ3VtZW50UG9vbGVyKTtcblxuZnVuY3Rpb24gZm9yRWFjaFNpbmdsZUNoaWxkKGJvb2tLZWVwaW5nLCBjaGlsZCwgbmFtZSkge1xuICB2YXIgZnVuYyA9IGJvb2tLZWVwaW5nLmZ1bmMsXG4gICAgICBjb250ZXh0ID0gYm9va0tlZXBpbmcuY29udGV4dDtcblxuICBmdW5jLmNhbGwoY29udGV4dCwgY2hpbGQsIGJvb2tLZWVwaW5nLmNvdW50KyspO1xufVxuXG4vKipcbiAqIEl0ZXJhdGVzIHRocm91Z2ggY2hpbGRyZW4gdGhhdCBhcmUgdHlwaWNhbGx5IHNwZWNpZmllZCBhcyBgcHJvcHMuY2hpbGRyZW5gLlxuICpcbiAqIFNlZSBodHRwczovL2ZhY2Vib29rLmdpdGh1Yi5pby9yZWFjdC9kb2NzL3RvcC1sZXZlbC1hcGkuaHRtbCNyZWFjdC5jaGlsZHJlbi5mb3JlYWNoXG4gKlxuICogVGhlIHByb3ZpZGVkIGZvckVhY2hGdW5jKGNoaWxkLCBpbmRleCkgd2lsbCBiZSBjYWxsZWQgZm9yIGVhY2hcbiAqIGxlYWYgY2hpbGQuXG4gKlxuICogQHBhcmFtIHs/Kn0gY2hpbGRyZW4gQ2hpbGRyZW4gdHJlZSBjb250YWluZXIuXG4gKiBAcGFyYW0ge2Z1bmN0aW9uKCosIGludCl9IGZvckVhY2hGdW5jXG4gKiBAcGFyYW0geyp9IGZvckVhY2hDb250ZXh0IENvbnRleHQgZm9yIGZvckVhY2hDb250ZXh0LlxuICovXG5mdW5jdGlvbiBmb3JFYWNoQ2hpbGRyZW4oY2hpbGRyZW4sIGZvckVhY2hGdW5jLCBmb3JFYWNoQ29udGV4dCkge1xuICBpZiAoY2hpbGRyZW4gPT0gbnVsbCkge1xuICAgIHJldHVybiBjaGlsZHJlbjtcbiAgfVxuICB2YXIgdHJhdmVyc2VDb250ZXh0ID0gRm9yRWFjaEJvb2tLZWVwaW5nLmdldFBvb2xlZChmb3JFYWNoRnVuYywgZm9yRWFjaENvbnRleHQpO1xuICB0cmF2ZXJzZUFsbENoaWxkcmVuKGNoaWxkcmVuLCBmb3JFYWNoU2luZ2xlQ2hpbGQsIHRyYXZlcnNlQ29udGV4dCk7XG4gIEZvckVhY2hCb29rS2VlcGluZy5yZWxlYXNlKHRyYXZlcnNlQ29udGV4dCk7XG59XG5cbi8qKlxuICogUG9vbGVkQ2xhc3MgcmVwcmVzZW50aW5nIHRoZSBib29ra2VlcGluZyBhc3NvY2lhdGVkIHdpdGggcGVyZm9ybWluZyBhIGNoaWxkXG4gKiBtYXBwaW5nLiBBbGxvd3MgYXZvaWRpbmcgYmluZGluZyBjYWxsYmFja3MuXG4gKlxuICogQGNvbnN0cnVjdG9yIE1hcEJvb2tLZWVwaW5nXG4gKiBAcGFyYW0geyEqfSBtYXBSZXN1bHQgT2JqZWN0IGNvbnRhaW5pbmcgdGhlIG9yZGVyZWQgbWFwIG9mIHJlc3VsdHMuXG4gKiBAcGFyYW0geyFmdW5jdGlvbn0gbWFwRnVuY3Rpb24gRnVuY3Rpb24gdG8gcGVyZm9ybSBtYXBwaW5nIHdpdGguXG4gKiBAcGFyYW0gez8qfSBtYXBDb250ZXh0IENvbnRleHQgdG8gcGVyZm9ybSBtYXBwaW5nIHdpdGguXG4gKi9cbmZ1bmN0aW9uIE1hcEJvb2tLZWVwaW5nKG1hcFJlc3VsdCwga2V5UHJlZml4LCBtYXBGdW5jdGlvbiwgbWFwQ29udGV4dCkge1xuICB0aGlzLnJlc3VsdCA9IG1hcFJlc3VsdDtcbiAgdGhpcy5rZXlQcmVmaXggPSBrZXlQcmVmaXg7XG4gIHRoaXMuZnVuYyA9IG1hcEZ1bmN0aW9uO1xuICB0aGlzLmNvbnRleHQgPSBtYXBDb250ZXh0O1xuICB0aGlzLmNvdW50ID0gMDtcbn1cbk1hcEJvb2tLZWVwaW5nLnByb3RvdHlwZS5kZXN0cnVjdG9yID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLnJlc3VsdCA9IG51bGw7XG4gIHRoaXMua2V5UHJlZml4ID0gbnVsbDtcbiAgdGhpcy5mdW5jID0gbnVsbDtcbiAgdGhpcy5jb250ZXh0ID0gbnVsbDtcbiAgdGhpcy5jb3VudCA9IDA7XG59O1xuUG9vbGVkQ2xhc3MuYWRkUG9vbGluZ1RvKE1hcEJvb2tLZWVwaW5nLCBmb3VyQXJndW1lbnRQb29sZXIpO1xuXG5mdW5jdGlvbiBtYXBTaW5nbGVDaGlsZEludG9Db250ZXh0KGJvb2tLZWVwaW5nLCBjaGlsZCwgY2hpbGRLZXkpIHtcbiAgdmFyIHJlc3VsdCA9IGJvb2tLZWVwaW5nLnJlc3VsdCxcbiAgICAgIGtleVByZWZpeCA9IGJvb2tLZWVwaW5nLmtleVByZWZpeCxcbiAgICAgIGZ1bmMgPSBib29rS2VlcGluZy5mdW5jLFxuICAgICAgY29udGV4dCA9IGJvb2tLZWVwaW5nLmNvbnRleHQ7XG5cblxuICB2YXIgbWFwcGVkQ2hpbGQgPSBmdW5jLmNhbGwoY29udGV4dCwgY2hpbGQsIGJvb2tLZWVwaW5nLmNvdW50KyspO1xuICBpZiAoQXJyYXkuaXNBcnJheShtYXBwZWRDaGlsZCkpIHtcbiAgICBtYXBJbnRvV2l0aEtleVByZWZpeEludGVybmFsKG1hcHBlZENoaWxkLCByZXN1bHQsIGNoaWxkS2V5LCBlbXB0eUZ1bmN0aW9uLnRoYXRSZXR1cm5zQXJndW1lbnQpO1xuICB9IGVsc2UgaWYgKG1hcHBlZENoaWxkICE9IG51bGwpIHtcbiAgICBpZiAoUmVhY3RFbGVtZW50LmlzVmFsaWRFbGVtZW50KG1hcHBlZENoaWxkKSkge1xuICAgICAgbWFwcGVkQ2hpbGQgPSBSZWFjdEVsZW1lbnQuY2xvbmVBbmRSZXBsYWNlS2V5KG1hcHBlZENoaWxkLFxuICAgICAgLy8gS2VlcCBib3RoIHRoZSAobWFwcGVkKSBhbmQgb2xkIGtleXMgaWYgdGhleSBkaWZmZXIsIGp1c3QgYXNcbiAgICAgIC8vIHRyYXZlcnNlQWxsQ2hpbGRyZW4gdXNlZCB0byBkbyBmb3Igb2JqZWN0cyBhcyBjaGlsZHJlblxuICAgICAga2V5UHJlZml4ICsgKG1hcHBlZENoaWxkLmtleSAmJiAoIWNoaWxkIHx8IGNoaWxkLmtleSAhPT0gbWFwcGVkQ2hpbGQua2V5KSA/IGVzY2FwZVVzZXJQcm92aWRlZEtleShtYXBwZWRDaGlsZC5rZXkpICsgJy8nIDogJycpICsgY2hpbGRLZXkpO1xuICAgIH1cbiAgICByZXN1bHQucHVzaChtYXBwZWRDaGlsZCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gbWFwSW50b1dpdGhLZXlQcmVmaXhJbnRlcm5hbChjaGlsZHJlbiwgYXJyYXksIHByZWZpeCwgZnVuYywgY29udGV4dCkge1xuICB2YXIgZXNjYXBlZFByZWZpeCA9ICcnO1xuICBpZiAocHJlZml4ICE9IG51bGwpIHtcbiAgICBlc2NhcGVkUHJlZml4ID0gZXNjYXBlVXNlclByb3ZpZGVkS2V5KHByZWZpeCkgKyAnLyc7XG4gIH1cbiAgdmFyIHRyYXZlcnNlQ29udGV4dCA9IE1hcEJvb2tLZWVwaW5nLmdldFBvb2xlZChhcnJheSwgZXNjYXBlZFByZWZpeCwgZnVuYywgY29udGV4dCk7XG4gIHRyYXZlcnNlQWxsQ2hpbGRyZW4oY2hpbGRyZW4sIG1hcFNpbmdsZUNoaWxkSW50b0NvbnRleHQsIHRyYXZlcnNlQ29udGV4dCk7XG4gIE1hcEJvb2tLZWVwaW5nLnJlbGVhc2UodHJhdmVyc2VDb250ZXh0KTtcbn1cblxuLyoqXG4gKiBNYXBzIGNoaWxkcmVuIHRoYXQgYXJlIHR5cGljYWxseSBzcGVjaWZpZWQgYXMgYHByb3BzLmNoaWxkcmVuYC5cbiAqXG4gKiBTZWUgaHR0cHM6Ly9mYWNlYm9vay5naXRodWIuaW8vcmVhY3QvZG9jcy90b3AtbGV2ZWwtYXBpLmh0bWwjcmVhY3QuY2hpbGRyZW4ubWFwXG4gKlxuICogVGhlIHByb3ZpZGVkIG1hcEZ1bmN0aW9uKGNoaWxkLCBrZXksIGluZGV4KSB3aWxsIGJlIGNhbGxlZCBmb3IgZWFjaFxuICogbGVhZiBjaGlsZC5cbiAqXG4gKiBAcGFyYW0gez8qfSBjaGlsZHJlbiBDaGlsZHJlbiB0cmVlIGNvbnRhaW5lci5cbiAqIEBwYXJhbSB7ZnVuY3Rpb24oKiwgaW50KX0gZnVuYyBUaGUgbWFwIGZ1bmN0aW9uLlxuICogQHBhcmFtIHsqfSBjb250ZXh0IENvbnRleHQgZm9yIG1hcEZ1bmN0aW9uLlxuICogQHJldHVybiB7b2JqZWN0fSBPYmplY3QgY29udGFpbmluZyB0aGUgb3JkZXJlZCBtYXAgb2YgcmVzdWx0cy5cbiAqL1xuZnVuY3Rpb24gbWFwQ2hpbGRyZW4oY2hpbGRyZW4sIGZ1bmMsIGNvbnRleHQpIHtcbiAgaWYgKGNoaWxkcmVuID09IG51bGwpIHtcbiAgICByZXR1cm4gY2hpbGRyZW47XG4gIH1cbiAgdmFyIHJlc3VsdCA9IFtdO1xuICBtYXBJbnRvV2l0aEtleVByZWZpeEludGVybmFsKGNoaWxkcmVuLCByZXN1bHQsIG51bGwsIGZ1bmMsIGNvbnRleHQpO1xuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBmb3JFYWNoU2luZ2xlQ2hpbGREdW1teSh0cmF2ZXJzZUNvbnRleHQsIGNoaWxkLCBuYW1lKSB7XG4gIHJldHVybiBudWxsO1xufVxuXG4vKipcbiAqIENvdW50IHRoZSBudW1iZXIgb2YgY2hpbGRyZW4gdGhhdCBhcmUgdHlwaWNhbGx5IHNwZWNpZmllZCBhc1xuICogYHByb3BzLmNoaWxkcmVuYC5cbiAqXG4gKiBTZWUgaHR0cHM6Ly9mYWNlYm9vay5naXRodWIuaW8vcmVhY3QvZG9jcy90b3AtbGV2ZWwtYXBpLmh0bWwjcmVhY3QuY2hpbGRyZW4uY291bnRcbiAqXG4gKiBAcGFyYW0gez8qfSBjaGlsZHJlbiBDaGlsZHJlbiB0cmVlIGNvbnRhaW5lci5cbiAqIEByZXR1cm4ge251bWJlcn0gVGhlIG51bWJlciBvZiBjaGlsZHJlbi5cbiAqL1xuZnVuY3Rpb24gY291bnRDaGlsZHJlbihjaGlsZHJlbiwgY29udGV4dCkge1xuICByZXR1cm4gdHJhdmVyc2VBbGxDaGlsZHJlbihjaGlsZHJlbiwgZm9yRWFjaFNpbmdsZUNoaWxkRHVtbXksIG51bGwpO1xufVxuXG4vKipcbiAqIEZsYXR0ZW4gYSBjaGlsZHJlbiBvYmplY3QgKHR5cGljYWxseSBzcGVjaWZpZWQgYXMgYHByb3BzLmNoaWxkcmVuYCkgYW5kXG4gKiByZXR1cm4gYW4gYXJyYXkgd2l0aCBhcHByb3ByaWF0ZWx5IHJlLWtleWVkIGNoaWxkcmVuLlxuICpcbiAqIFNlZSBodHRwczovL2ZhY2Vib29rLmdpdGh1Yi5pby9yZWFjdC9kb2NzL3RvcC1sZXZlbC1hcGkuaHRtbCNyZWFjdC5jaGlsZHJlbi50b2FycmF5XG4gKi9cbmZ1bmN0aW9uIHRvQXJyYXkoY2hpbGRyZW4pIHtcbiAgdmFyIHJlc3VsdCA9IFtdO1xuICBtYXBJbnRvV2l0aEtleVByZWZpeEludGVybmFsKGNoaWxkcmVuLCByZXN1bHQsIG51bGwsIGVtcHR5RnVuY3Rpb24udGhhdFJldHVybnNBcmd1bWVudCk7XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbnZhciBSZWFjdENoaWxkcmVuID0ge1xuICBmb3JFYWNoOiBmb3JFYWNoQ2hpbGRyZW4sXG4gIG1hcDogbWFwQ2hpbGRyZW4sXG4gIG1hcEludG9XaXRoS2V5UHJlZml4SW50ZXJuYWw6IG1hcEludG9XaXRoS2V5UHJlZml4SW50ZXJuYWwsXG4gIGNvdW50OiBjb3VudENoaWxkcmVuLFxuICB0b0FycmF5OiB0b0FycmF5XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFJlYWN0Q2hpbGRyZW47IiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNi1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICogXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgX3Byb2RJbnZhcmlhbnQgPSByZXF1aXJlKCcuL3JlYWN0UHJvZEludmFyaWFudCcpO1xuXG52YXIgUmVhY3RDdXJyZW50T3duZXIgPSByZXF1aXJlKCcuL1JlYWN0Q3VycmVudE93bmVyJyk7XG5cbnZhciBpbnZhcmlhbnQgPSByZXF1aXJlKCdmYmpzL2xpYi9pbnZhcmlhbnQnKTtcbnZhciB3YXJuaW5nID0gcmVxdWlyZSgnZmJqcy9saWIvd2FybmluZycpO1xuXG5mdW5jdGlvbiBpc05hdGl2ZShmbikge1xuICAvLyBCYXNlZCBvbiBpc05hdGl2ZSgpIGZyb20gTG9kYXNoXG4gIHZhciBmdW5jVG9TdHJpbmcgPSBGdW5jdGlvbi5wcm90b3R5cGUudG9TdHJpbmc7XG4gIHZhciBoYXNPd25Qcm9wZXJ0eSA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG4gIHZhciByZUlzTmF0aXZlID0gUmVnRXhwKCdeJyArIGZ1bmNUb1N0cmluZ1xuICAvLyBUYWtlIGFuIGV4YW1wbGUgbmF0aXZlIGZ1bmN0aW9uIHNvdXJjZSBmb3IgY29tcGFyaXNvblxuICAuY2FsbChoYXNPd25Qcm9wZXJ0eVxuICAvLyBTdHJpcCByZWdleCBjaGFyYWN0ZXJzIHNvIHdlIGNhbiB1c2UgaXQgZm9yIHJlZ2V4XG4gICkucmVwbGFjZSgvW1xcXFxeJC4qKz8oKVtcXF17fXxdL2csICdcXFxcJCYnXG4gIC8vIFJlbW92ZSBoYXNPd25Qcm9wZXJ0eSBmcm9tIHRoZSB0ZW1wbGF0ZSB0byBtYWtlIGl0IGdlbmVyaWNcbiAgKS5yZXBsYWNlKC9oYXNPd25Qcm9wZXJ0eXwoZnVuY3Rpb24pLio/KD89XFxcXFxcKCl8IGZvciAuKz8oPz1cXFxcXFxdKS9nLCAnJDEuKj8nKSArICckJyk7XG4gIHRyeSB7XG4gICAgdmFyIHNvdXJjZSA9IGZ1bmNUb1N0cmluZy5jYWxsKGZuKTtcbiAgICByZXR1cm4gcmVJc05hdGl2ZS50ZXN0KHNvdXJjZSk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG52YXIgY2FuVXNlQ29sbGVjdGlvbnMgPVxuLy8gQXJyYXkuZnJvbVxudHlwZW9mIEFycmF5LmZyb20gPT09ICdmdW5jdGlvbicgJiZcbi8vIE1hcFxudHlwZW9mIE1hcCA9PT0gJ2Z1bmN0aW9uJyAmJiBpc05hdGl2ZShNYXApICYmXG4vLyBNYXAucHJvdG90eXBlLmtleXNcbk1hcC5wcm90b3R5cGUgIT0gbnVsbCAmJiB0eXBlb2YgTWFwLnByb3RvdHlwZS5rZXlzID09PSAnZnVuY3Rpb24nICYmIGlzTmF0aXZlKE1hcC5wcm90b3R5cGUua2V5cykgJiZcbi8vIFNldFxudHlwZW9mIFNldCA9PT0gJ2Z1bmN0aW9uJyAmJiBpc05hdGl2ZShTZXQpICYmXG4vLyBTZXQucHJvdG90eXBlLmtleXNcblNldC5wcm90b3R5cGUgIT0gbnVsbCAmJiB0eXBlb2YgU2V0LnByb3RvdHlwZS5rZXlzID09PSAnZnVuY3Rpb24nICYmIGlzTmF0aXZlKFNldC5wcm90b3R5cGUua2V5cyk7XG5cbnZhciBzZXRJdGVtO1xudmFyIGdldEl0ZW07XG52YXIgcmVtb3ZlSXRlbTtcbnZhciBnZXRJdGVtSURzO1xudmFyIGFkZFJvb3Q7XG52YXIgcmVtb3ZlUm9vdDtcbnZhciBnZXRSb290SURzO1xuXG5pZiAoY2FuVXNlQ29sbGVjdGlvbnMpIHtcbiAgdmFyIGl0ZW1NYXAgPSBuZXcgTWFwKCk7XG4gIHZhciByb290SURTZXQgPSBuZXcgU2V0KCk7XG5cbiAgc2V0SXRlbSA9IGZ1bmN0aW9uIChpZCwgaXRlbSkge1xuICAgIGl0ZW1NYXAuc2V0KGlkLCBpdGVtKTtcbiAgfTtcbiAgZ2V0SXRlbSA9IGZ1bmN0aW9uIChpZCkge1xuICAgIHJldHVybiBpdGVtTWFwLmdldChpZCk7XG4gIH07XG4gIHJlbW92ZUl0ZW0gPSBmdW5jdGlvbiAoaWQpIHtcbiAgICBpdGVtTWFwWydkZWxldGUnXShpZCk7XG4gIH07XG4gIGdldEl0ZW1JRHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIEFycmF5LmZyb20oaXRlbU1hcC5rZXlzKCkpO1xuICB9O1xuXG4gIGFkZFJvb3QgPSBmdW5jdGlvbiAoaWQpIHtcbiAgICByb290SURTZXQuYWRkKGlkKTtcbiAgfTtcbiAgcmVtb3ZlUm9vdCA9IGZ1bmN0aW9uIChpZCkge1xuICAgIHJvb3RJRFNldFsnZGVsZXRlJ10oaWQpO1xuICB9O1xuICBnZXRSb290SURzID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBBcnJheS5mcm9tKHJvb3RJRFNldC5rZXlzKCkpO1xuICB9O1xufSBlbHNlIHtcbiAgdmFyIGl0ZW1CeUtleSA9IHt9O1xuICB2YXIgcm9vdEJ5S2V5ID0ge307XG5cbiAgLy8gVXNlIG5vbi1udW1lcmljIGtleXMgdG8gcHJldmVudCBWOCBwZXJmb3JtYW5jZSBpc3N1ZXM6XG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9mYWNlYm9vay9yZWFjdC9wdWxsLzcyMzJcbiAgdmFyIGdldEtleUZyb21JRCA9IGZ1bmN0aW9uIChpZCkge1xuICAgIHJldHVybiAnLicgKyBpZDtcbiAgfTtcbiAgdmFyIGdldElERnJvbUtleSA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICByZXR1cm4gcGFyc2VJbnQoa2V5LnN1YnN0cigxKSwgMTApO1xuICB9O1xuXG4gIHNldEl0ZW0gPSBmdW5jdGlvbiAoaWQsIGl0ZW0pIHtcbiAgICB2YXIga2V5ID0gZ2V0S2V5RnJvbUlEKGlkKTtcbiAgICBpdGVtQnlLZXlba2V5XSA9IGl0ZW07XG4gIH07XG4gIGdldEl0ZW0gPSBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIga2V5ID0gZ2V0S2V5RnJvbUlEKGlkKTtcbiAgICByZXR1cm4gaXRlbUJ5S2V5W2tleV07XG4gIH07XG4gIHJlbW92ZUl0ZW0gPSBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIga2V5ID0gZ2V0S2V5RnJvbUlEKGlkKTtcbiAgICBkZWxldGUgaXRlbUJ5S2V5W2tleV07XG4gIH07XG4gIGdldEl0ZW1JRHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKGl0ZW1CeUtleSkubWFwKGdldElERnJvbUtleSk7XG4gIH07XG5cbiAgYWRkUm9vdCA9IGZ1bmN0aW9uIChpZCkge1xuICAgIHZhciBrZXkgPSBnZXRLZXlGcm9tSUQoaWQpO1xuICAgIHJvb3RCeUtleVtrZXldID0gdHJ1ZTtcbiAgfTtcbiAgcmVtb3ZlUm9vdCA9IGZ1bmN0aW9uIChpZCkge1xuICAgIHZhciBrZXkgPSBnZXRLZXlGcm9tSUQoaWQpO1xuICAgIGRlbGV0ZSByb290QnlLZXlba2V5XTtcbiAgfTtcbiAgZ2V0Um9vdElEcyA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXMocm9vdEJ5S2V5KS5tYXAoZ2V0SURGcm9tS2V5KTtcbiAgfTtcbn1cblxudmFyIHVubW91bnRlZElEcyA9IFtdO1xuXG5mdW5jdGlvbiBwdXJnZURlZXAoaWQpIHtcbiAgdmFyIGl0ZW0gPSBnZXRJdGVtKGlkKTtcbiAgaWYgKGl0ZW0pIHtcbiAgICB2YXIgY2hpbGRJRHMgPSBpdGVtLmNoaWxkSURzO1xuXG4gICAgcmVtb3ZlSXRlbShpZCk7XG4gICAgY2hpbGRJRHMuZm9yRWFjaChwdXJnZURlZXApO1xuICB9XG59XG5cbmZ1bmN0aW9uIGRlc2NyaWJlQ29tcG9uZW50RnJhbWUobmFtZSwgc291cmNlLCBvd25lck5hbWUpIHtcbiAgcmV0dXJuICdcXG4gICAgaW4gJyArIChuYW1lIHx8ICdVbmtub3duJykgKyAoc291cmNlID8gJyAoYXQgJyArIHNvdXJjZS5maWxlTmFtZS5yZXBsYWNlKC9eLipbXFxcXFxcL10vLCAnJykgKyAnOicgKyBzb3VyY2UubGluZU51bWJlciArICcpJyA6IG93bmVyTmFtZSA/ICcgKGNyZWF0ZWQgYnkgJyArIG93bmVyTmFtZSArICcpJyA6ICcnKTtcbn1cblxuZnVuY3Rpb24gZ2V0RGlzcGxheU5hbWUoZWxlbWVudCkge1xuICBpZiAoZWxlbWVudCA9PSBudWxsKSB7XG4gICAgcmV0dXJuICcjZW1wdHknO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBlbGVtZW50ID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgZWxlbWVudCA9PT0gJ251bWJlcicpIHtcbiAgICByZXR1cm4gJyN0ZXh0JztcbiAgfSBlbHNlIGlmICh0eXBlb2YgZWxlbWVudC50eXBlID09PSAnc3RyaW5nJykge1xuICAgIHJldHVybiBlbGVtZW50LnR5cGU7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGVsZW1lbnQudHlwZS5kaXNwbGF5TmFtZSB8fCBlbGVtZW50LnR5cGUubmFtZSB8fCAnVW5rbm93bic7XG4gIH1cbn1cblxuZnVuY3Rpb24gZGVzY3JpYmVJRChpZCkge1xuICB2YXIgbmFtZSA9IFJlYWN0Q29tcG9uZW50VHJlZUhvb2suZ2V0RGlzcGxheU5hbWUoaWQpO1xuICB2YXIgZWxlbWVudCA9IFJlYWN0Q29tcG9uZW50VHJlZUhvb2suZ2V0RWxlbWVudChpZCk7XG4gIHZhciBvd25lcklEID0gUmVhY3RDb21wb25lbnRUcmVlSG9vay5nZXRPd25lcklEKGlkKTtcbiAgdmFyIG93bmVyTmFtZTtcbiAgaWYgKG93bmVySUQpIHtcbiAgICBvd25lck5hbWUgPSBSZWFjdENvbXBvbmVudFRyZWVIb29rLmdldERpc3BsYXlOYW1lKG93bmVySUQpO1xuICB9XG4gIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyB3YXJuaW5nKGVsZW1lbnQsICdSZWFjdENvbXBvbmVudFRyZWVIb29rOiBNaXNzaW5nIFJlYWN0IGVsZW1lbnQgZm9yIGRlYnVnSUQgJXMgd2hlbiAnICsgJ2J1aWxkaW5nIHN0YWNrJywgaWQpIDogdm9pZCAwO1xuICByZXR1cm4gZGVzY3JpYmVDb21wb25lbnRGcmFtZShuYW1lLCBlbGVtZW50ICYmIGVsZW1lbnQuX3NvdXJjZSwgb3duZXJOYW1lKTtcbn1cblxudmFyIFJlYWN0Q29tcG9uZW50VHJlZUhvb2sgPSB7XG4gIG9uU2V0Q2hpbGRyZW46IGZ1bmN0aW9uIChpZCwgbmV4dENoaWxkSURzKSB7XG4gICAgdmFyIGl0ZW0gPSBnZXRJdGVtKGlkKTtcbiAgICAhaXRlbSA/IHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyBpbnZhcmlhbnQoZmFsc2UsICdJdGVtIG11c3QgaGF2ZSBiZWVuIHNldCcpIDogX3Byb2RJbnZhcmlhbnQoJzE0NCcpIDogdm9pZCAwO1xuICAgIGl0ZW0uY2hpbGRJRHMgPSBuZXh0Q2hpbGRJRHM7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG5leHRDaGlsZElEcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIG5leHRDaGlsZElEID0gbmV4dENoaWxkSURzW2ldO1xuICAgICAgdmFyIG5leHRDaGlsZCA9IGdldEl0ZW0obmV4dENoaWxkSUQpO1xuICAgICAgIW5leHRDaGlsZCA/IHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyBpbnZhcmlhbnQoZmFsc2UsICdFeHBlY3RlZCBob29rIGV2ZW50cyB0byBmaXJlIGZvciB0aGUgY2hpbGQgYmVmb3JlIGl0cyBwYXJlbnQgaW5jbHVkZXMgaXQgaW4gb25TZXRDaGlsZHJlbigpLicpIDogX3Byb2RJbnZhcmlhbnQoJzE0MCcpIDogdm9pZCAwO1xuICAgICAgIShuZXh0Q2hpbGQuY2hpbGRJRHMgIT0gbnVsbCB8fCB0eXBlb2YgbmV4dENoaWxkLmVsZW1lbnQgIT09ICdvYmplY3QnIHx8IG5leHRDaGlsZC5lbGVtZW50ID09IG51bGwpID8gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/IGludmFyaWFudChmYWxzZSwgJ0V4cGVjdGVkIG9uU2V0Q2hpbGRyZW4oKSB0byBmaXJlIGZvciBhIGNvbnRhaW5lciBjaGlsZCBiZWZvcmUgaXRzIHBhcmVudCBpbmNsdWRlcyBpdCBpbiBvblNldENoaWxkcmVuKCkuJykgOiBfcHJvZEludmFyaWFudCgnMTQxJykgOiB2b2lkIDA7XG4gICAgICAhbmV4dENoaWxkLmlzTW91bnRlZCA/IHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyBpbnZhcmlhbnQoZmFsc2UsICdFeHBlY3RlZCBvbk1vdW50Q29tcG9uZW50KCkgdG8gZmlyZSBmb3IgdGhlIGNoaWxkIGJlZm9yZSBpdHMgcGFyZW50IGluY2x1ZGVzIGl0IGluIG9uU2V0Q2hpbGRyZW4oKS4nKSA6IF9wcm9kSW52YXJpYW50KCc3MScpIDogdm9pZCAwO1xuICAgICAgaWYgKG5leHRDaGlsZC5wYXJlbnRJRCA9PSBudWxsKSB7XG4gICAgICAgIG5leHRDaGlsZC5wYXJlbnRJRCA9IGlkO1xuICAgICAgICAvLyBUT0RPOiBUaGlzIHNob3VsZG4ndCBiZSBuZWNlc3NhcnkgYnV0IG1vdW50aW5nIGEgbmV3IHJvb3QgZHVyaW5nIGluXG4gICAgICAgIC8vIGNvbXBvbmVudFdpbGxNb3VudCBjdXJyZW50bHkgY2F1c2VzIG5vdC15ZXQtbW91bnRlZCBjb21wb25lbnRzIHRvXG4gICAgICAgIC8vIGJlIHB1cmdlZCBmcm9tIG91ciB0cmVlIGRhdGEgc28gdGhlaXIgcGFyZW50IGlkIGlzIG1pc3NpbmcuXG4gICAgICB9XG4gICAgICAhKG5leHRDaGlsZC5wYXJlbnRJRCA9PT0gaWQpID8gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/IGludmFyaWFudChmYWxzZSwgJ0V4cGVjdGVkIG9uQmVmb3JlTW91bnRDb21wb25lbnQoKSBwYXJlbnQgYW5kIG9uU2V0Q2hpbGRyZW4oKSB0byBiZSBjb25zaXN0ZW50ICglcyBoYXMgcGFyZW50cyAlcyBhbmQgJXMpLicsIG5leHRDaGlsZElELCBuZXh0Q2hpbGQucGFyZW50SUQsIGlkKSA6IF9wcm9kSW52YXJpYW50KCcxNDInLCBuZXh0Q2hpbGRJRCwgbmV4dENoaWxkLnBhcmVudElELCBpZCkgOiB2b2lkIDA7XG4gICAgfVxuICB9LFxuICBvbkJlZm9yZU1vdW50Q29tcG9uZW50OiBmdW5jdGlvbiAoaWQsIGVsZW1lbnQsIHBhcmVudElEKSB7XG4gICAgdmFyIGl0ZW0gPSB7XG4gICAgICBlbGVtZW50OiBlbGVtZW50LFxuICAgICAgcGFyZW50SUQ6IHBhcmVudElELFxuICAgICAgdGV4dDogbnVsbCxcbiAgICAgIGNoaWxkSURzOiBbXSxcbiAgICAgIGlzTW91bnRlZDogZmFsc2UsXG4gICAgICB1cGRhdGVDb3VudDogMFxuICAgIH07XG4gICAgc2V0SXRlbShpZCwgaXRlbSk7XG4gIH0sXG4gIG9uQmVmb3JlVXBkYXRlQ29tcG9uZW50OiBmdW5jdGlvbiAoaWQsIGVsZW1lbnQpIHtcbiAgICB2YXIgaXRlbSA9IGdldEl0ZW0oaWQpO1xuICAgIGlmICghaXRlbSB8fCAhaXRlbS5pc01vdW50ZWQpIHtcbiAgICAgIC8vIFdlIG1heSBlbmQgdXAgaGVyZSBhcyBhIHJlc3VsdCBvZiBzZXRTdGF0ZSgpIGluIGNvbXBvbmVudFdpbGxVbm1vdW50KCkuXG4gICAgICAvLyBJbiB0aGlzIGNhc2UsIGlnbm9yZSB0aGUgZWxlbWVudC5cbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaXRlbS5lbGVtZW50ID0gZWxlbWVudDtcbiAgfSxcbiAgb25Nb3VudENvbXBvbmVudDogZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIGl0ZW0gPSBnZXRJdGVtKGlkKTtcbiAgICAhaXRlbSA/IHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyBpbnZhcmlhbnQoZmFsc2UsICdJdGVtIG11c3QgaGF2ZSBiZWVuIHNldCcpIDogX3Byb2RJbnZhcmlhbnQoJzE0NCcpIDogdm9pZCAwO1xuICAgIGl0ZW0uaXNNb3VudGVkID0gdHJ1ZTtcbiAgICB2YXIgaXNSb290ID0gaXRlbS5wYXJlbnRJRCA9PT0gMDtcbiAgICBpZiAoaXNSb290KSB7XG4gICAgICBhZGRSb290KGlkKTtcbiAgICB9XG4gIH0sXG4gIG9uVXBkYXRlQ29tcG9uZW50OiBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIgaXRlbSA9IGdldEl0ZW0oaWQpO1xuICAgIGlmICghaXRlbSB8fCAhaXRlbS5pc01vdW50ZWQpIHtcbiAgICAgIC8vIFdlIG1heSBlbmQgdXAgaGVyZSBhcyBhIHJlc3VsdCBvZiBzZXRTdGF0ZSgpIGluIGNvbXBvbmVudFdpbGxVbm1vdW50KCkuXG4gICAgICAvLyBJbiB0aGlzIGNhc2UsIGlnbm9yZSB0aGUgZWxlbWVudC5cbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaXRlbS51cGRhdGVDb3VudCsrO1xuICB9LFxuICBvblVubW91bnRDb21wb25lbnQ6IGZ1bmN0aW9uIChpZCkge1xuICAgIHZhciBpdGVtID0gZ2V0SXRlbShpZCk7XG4gICAgaWYgKGl0ZW0pIHtcbiAgICAgIC8vIFdlIG5lZWQgdG8gY2hlY2sgaWYgaXQgZXhpc3RzLlxuICAgICAgLy8gYGl0ZW1gIG1pZ2h0IG5vdCBleGlzdCBpZiBpdCBpcyBpbnNpZGUgYW4gZXJyb3IgYm91bmRhcnksIGFuZCBhIHNpYmxpbmdcbiAgICAgIC8vIGVycm9yIGJvdW5kYXJ5IGNoaWxkIHRocmV3IHdoaWxlIG1vdW50aW5nLiBUaGVuIHRoaXMgaW5zdGFuY2UgbmV2ZXJcbiAgICAgIC8vIGdvdCBhIGNoYW5jZSB0byBtb3VudCwgYnV0IGl0IHN0aWxsIGdldHMgYW4gdW5tb3VudGluZyBldmVudCBkdXJpbmdcbiAgICAgIC8vIHRoZSBlcnJvciBib3VuZGFyeSBjbGVhbnVwLlxuICAgICAgaXRlbS5pc01vdW50ZWQgPSBmYWxzZTtcbiAgICAgIHZhciBpc1Jvb3QgPSBpdGVtLnBhcmVudElEID09PSAwO1xuICAgICAgaWYgKGlzUm9vdCkge1xuICAgICAgICByZW1vdmVSb290KGlkKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdW5tb3VudGVkSURzLnB1c2goaWQpO1xuICB9LFxuICBwdXJnZVVubW91bnRlZENvbXBvbmVudHM6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoUmVhY3RDb21wb25lbnRUcmVlSG9vay5fcHJldmVudFB1cmdpbmcpIHtcbiAgICAgIC8vIFNob3VsZCBvbmx5IGJlIHVzZWQgZm9yIHRlc3RpbmcuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB1bm1vdW50ZWRJRHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBpZCA9IHVubW91bnRlZElEc1tpXTtcbiAgICAgIHB1cmdlRGVlcChpZCk7XG4gICAgfVxuICAgIHVubW91bnRlZElEcy5sZW5ndGggPSAwO1xuICB9LFxuICBpc01vdW50ZWQ6IGZ1bmN0aW9uIChpZCkge1xuICAgIHZhciBpdGVtID0gZ2V0SXRlbShpZCk7XG4gICAgcmV0dXJuIGl0ZW0gPyBpdGVtLmlzTW91bnRlZCA6IGZhbHNlO1xuICB9LFxuICBnZXRDdXJyZW50U3RhY2tBZGRlbmR1bTogZnVuY3Rpb24gKHRvcEVsZW1lbnQpIHtcbiAgICB2YXIgaW5mbyA9ICcnO1xuICAgIGlmICh0b3BFbGVtZW50KSB7XG4gICAgICB2YXIgbmFtZSA9IGdldERpc3BsYXlOYW1lKHRvcEVsZW1lbnQpO1xuICAgICAgdmFyIG93bmVyID0gdG9wRWxlbWVudC5fb3duZXI7XG4gICAgICBpbmZvICs9IGRlc2NyaWJlQ29tcG9uZW50RnJhbWUobmFtZSwgdG9wRWxlbWVudC5fc291cmNlLCBvd25lciAmJiBvd25lci5nZXROYW1lKCkpO1xuICAgIH1cblxuICAgIHZhciBjdXJyZW50T3duZXIgPSBSZWFjdEN1cnJlbnRPd25lci5jdXJyZW50O1xuICAgIHZhciBpZCA9IGN1cnJlbnRPd25lciAmJiBjdXJyZW50T3duZXIuX2RlYnVnSUQ7XG5cbiAgICBpbmZvICs9IFJlYWN0Q29tcG9uZW50VHJlZUhvb2suZ2V0U3RhY2tBZGRlbmR1bUJ5SUQoaWQpO1xuICAgIHJldHVybiBpbmZvO1xuICB9LFxuICBnZXRTdGFja0FkZGVuZHVtQnlJRDogZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIGluZm8gPSAnJztcbiAgICB3aGlsZSAoaWQpIHtcbiAgICAgIGluZm8gKz0gZGVzY3JpYmVJRChpZCk7XG4gICAgICBpZCA9IFJlYWN0Q29tcG9uZW50VHJlZUhvb2suZ2V0UGFyZW50SUQoaWQpO1xuICAgIH1cbiAgICByZXR1cm4gaW5mbztcbiAgfSxcbiAgZ2V0Q2hpbGRJRHM6IGZ1bmN0aW9uIChpZCkge1xuICAgIHZhciBpdGVtID0gZ2V0SXRlbShpZCk7XG4gICAgcmV0dXJuIGl0ZW0gPyBpdGVtLmNoaWxkSURzIDogW107XG4gIH0sXG4gIGdldERpc3BsYXlOYW1lOiBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIgZWxlbWVudCA9IFJlYWN0Q29tcG9uZW50VHJlZUhvb2suZ2V0RWxlbWVudChpZCk7XG4gICAgaWYgKCFlbGVtZW50KSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIGdldERpc3BsYXlOYW1lKGVsZW1lbnQpO1xuICB9LFxuICBnZXRFbGVtZW50OiBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIgaXRlbSA9IGdldEl0ZW0oaWQpO1xuICAgIHJldHVybiBpdGVtID8gaXRlbS5lbGVtZW50IDogbnVsbDtcbiAgfSxcbiAgZ2V0T3duZXJJRDogZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIGVsZW1lbnQgPSBSZWFjdENvbXBvbmVudFRyZWVIb29rLmdldEVsZW1lbnQoaWQpO1xuICAgIGlmICghZWxlbWVudCB8fCAhZWxlbWVudC5fb3duZXIpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICByZXR1cm4gZWxlbWVudC5fb3duZXIuX2RlYnVnSUQ7XG4gIH0sXG4gIGdldFBhcmVudElEOiBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIgaXRlbSA9IGdldEl0ZW0oaWQpO1xuICAgIHJldHVybiBpdGVtID8gaXRlbS5wYXJlbnRJRCA6IG51bGw7XG4gIH0sXG4gIGdldFNvdXJjZTogZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIGl0ZW0gPSBnZXRJdGVtKGlkKTtcbiAgICB2YXIgZWxlbWVudCA9IGl0ZW0gPyBpdGVtLmVsZW1lbnQgOiBudWxsO1xuICAgIHZhciBzb3VyY2UgPSBlbGVtZW50ICE9IG51bGwgPyBlbGVtZW50Ll9zb3VyY2UgOiBudWxsO1xuICAgIHJldHVybiBzb3VyY2U7XG4gIH0sXG4gIGdldFRleHQ6IGZ1bmN0aW9uIChpZCkge1xuICAgIHZhciBlbGVtZW50ID0gUmVhY3RDb21wb25lbnRUcmVlSG9vay5nZXRFbGVtZW50KGlkKTtcbiAgICBpZiAodHlwZW9mIGVsZW1lbnQgPT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gZWxlbWVudDtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBlbGVtZW50ID09PSAnbnVtYmVyJykge1xuICAgICAgcmV0dXJuICcnICsgZWxlbWVudDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9LFxuICBnZXRVcGRhdGVDb3VudDogZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIGl0ZW0gPSBnZXRJdGVtKGlkKTtcbiAgICByZXR1cm4gaXRlbSA/IGl0ZW0udXBkYXRlQ291bnQgOiAwO1xuICB9LFxuXG5cbiAgZ2V0Um9vdElEczogZ2V0Um9vdElEcyxcbiAgZ2V0UmVnaXN0ZXJlZElEczogZ2V0SXRlbUlEcyxcblxuICBwdXNoTm9uU3RhbmRhcmRXYXJuaW5nU3RhY2s6IGZ1bmN0aW9uIChpc0NyZWF0aW5nRWxlbWVudCwgY3VycmVudFNvdXJjZSkge1xuICAgIGlmICh0eXBlb2YgY29uc29sZS5yZWFjdFN0YWNrICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIHN0YWNrID0gW107XG4gICAgdmFyIGN1cnJlbnRPd25lciA9IFJlYWN0Q3VycmVudE93bmVyLmN1cnJlbnQ7XG4gICAgdmFyIGlkID0gY3VycmVudE93bmVyICYmIGN1cnJlbnRPd25lci5fZGVidWdJRDtcblxuICAgIHRyeSB7XG4gICAgICBpZiAoaXNDcmVhdGluZ0VsZW1lbnQpIHtcbiAgICAgICAgc3RhY2sucHVzaCh7XG4gICAgICAgICAgbmFtZTogaWQgPyBSZWFjdENvbXBvbmVudFRyZWVIb29rLmdldERpc3BsYXlOYW1lKGlkKSA6IG51bGwsXG4gICAgICAgICAgZmlsZU5hbWU6IGN1cnJlbnRTb3VyY2UgPyBjdXJyZW50U291cmNlLmZpbGVOYW1lIDogbnVsbCxcbiAgICAgICAgICBsaW5lTnVtYmVyOiBjdXJyZW50U291cmNlID8gY3VycmVudFNvdXJjZS5saW5lTnVtYmVyIDogbnVsbFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgd2hpbGUgKGlkKSB7XG4gICAgICAgIHZhciBlbGVtZW50ID0gUmVhY3RDb21wb25lbnRUcmVlSG9vay5nZXRFbGVtZW50KGlkKTtcbiAgICAgICAgdmFyIHBhcmVudElEID0gUmVhY3RDb21wb25lbnRUcmVlSG9vay5nZXRQYXJlbnRJRChpZCk7XG4gICAgICAgIHZhciBvd25lcklEID0gUmVhY3RDb21wb25lbnRUcmVlSG9vay5nZXRPd25lcklEKGlkKTtcbiAgICAgICAgdmFyIG93bmVyTmFtZSA9IG93bmVySUQgPyBSZWFjdENvbXBvbmVudFRyZWVIb29rLmdldERpc3BsYXlOYW1lKG93bmVySUQpIDogbnVsbDtcbiAgICAgICAgdmFyIHNvdXJjZSA9IGVsZW1lbnQgJiYgZWxlbWVudC5fc291cmNlO1xuICAgICAgICBzdGFjay5wdXNoKHtcbiAgICAgICAgICBuYW1lOiBvd25lck5hbWUsXG4gICAgICAgICAgZmlsZU5hbWU6IHNvdXJjZSA/IHNvdXJjZS5maWxlTmFtZSA6IG51bGwsXG4gICAgICAgICAgbGluZU51bWJlcjogc291cmNlID8gc291cmNlLmxpbmVOdW1iZXIgOiBudWxsXG4gICAgICAgIH0pO1xuICAgICAgICBpZCA9IHBhcmVudElEO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgLy8gSW50ZXJuYWwgc3RhdGUgaXMgbWVzc2VkIHVwLlxuICAgICAgLy8gU3RvcCBidWlsZGluZyB0aGUgc3RhY2sgKGl0J3MganVzdCBhIG5pY2UgdG8gaGF2ZSkuXG4gICAgfVxuXG4gICAgY29uc29sZS5yZWFjdFN0YWNrKHN0YWNrKTtcbiAgfSxcbiAgcG9wTm9uU3RhbmRhcmRXYXJuaW5nU3RhY2s6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodHlwZW9mIGNvbnNvbGUucmVhY3RTdGFja0VuZCAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zb2xlLnJlYWN0U3RhY2tFbmQoKTtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBSZWFjdENvbXBvbmVudFRyZWVIb29rOyIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTMtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICpcbiAqIFxuICovXG5cbid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBLZWVwcyB0cmFjayBvZiB0aGUgY3VycmVudCBvd25lci5cbiAqXG4gKiBUaGUgY3VycmVudCBvd25lciBpcyB0aGUgY29tcG9uZW50IHdobyBzaG91bGQgb3duIGFueSBjb21wb25lbnRzIHRoYXQgYXJlXG4gKiBjdXJyZW50bHkgYmVpbmcgY29uc3RydWN0ZWQuXG4gKi9cbnZhciBSZWFjdEN1cnJlbnRPd25lciA9IHtcbiAgLyoqXG4gICAqIEBpbnRlcm5hbFxuICAgKiBAdHlwZSB7UmVhY3RDb21wb25lbnR9XG4gICAqL1xuICBjdXJyZW50OiBudWxsXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFJlYWN0Q3VycmVudE93bmVyOyIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTMtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICpcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBSZWFjdEVsZW1lbnQgPSByZXF1aXJlKCcuL1JlYWN0RWxlbWVudCcpO1xuXG4vKipcbiAqIENyZWF0ZSBhIGZhY3RvcnkgdGhhdCBjcmVhdGVzIEhUTUwgdGFnIGVsZW1lbnRzLlxuICpcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBjcmVhdGVET01GYWN0b3J5ID0gUmVhY3RFbGVtZW50LmNyZWF0ZUZhY3Rvcnk7XG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICB2YXIgUmVhY3RFbGVtZW50VmFsaWRhdG9yID0gcmVxdWlyZSgnLi9SZWFjdEVsZW1lbnRWYWxpZGF0b3InKTtcbiAgY3JlYXRlRE9NRmFjdG9yeSA9IFJlYWN0RWxlbWVudFZhbGlkYXRvci5jcmVhdGVGYWN0b3J5O1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBtYXBwaW5nIGZyb20gc3VwcG9ydGVkIEhUTUwgdGFncyB0byBgUmVhY3RET01Db21wb25lbnRgIGNsYXNzZXMuXG4gKlxuICogQHB1YmxpY1xuICovXG52YXIgUmVhY3RET01GYWN0b3JpZXMgPSB7XG4gIGE6IGNyZWF0ZURPTUZhY3RvcnkoJ2EnKSxcbiAgYWJicjogY3JlYXRlRE9NRmFjdG9yeSgnYWJicicpLFxuICBhZGRyZXNzOiBjcmVhdGVET01GYWN0b3J5KCdhZGRyZXNzJyksXG4gIGFyZWE6IGNyZWF0ZURPTUZhY3RvcnkoJ2FyZWEnKSxcbiAgYXJ0aWNsZTogY3JlYXRlRE9NRmFjdG9yeSgnYXJ0aWNsZScpLFxuICBhc2lkZTogY3JlYXRlRE9NRmFjdG9yeSgnYXNpZGUnKSxcbiAgYXVkaW86IGNyZWF0ZURPTUZhY3RvcnkoJ2F1ZGlvJyksXG4gIGI6IGNyZWF0ZURPTUZhY3RvcnkoJ2InKSxcbiAgYmFzZTogY3JlYXRlRE9NRmFjdG9yeSgnYmFzZScpLFxuICBiZGk6IGNyZWF0ZURPTUZhY3RvcnkoJ2JkaScpLFxuICBiZG86IGNyZWF0ZURPTUZhY3RvcnkoJ2JkbycpLFxuICBiaWc6IGNyZWF0ZURPTUZhY3RvcnkoJ2JpZycpLFxuICBibG9ja3F1b3RlOiBjcmVhdGVET01GYWN0b3J5KCdibG9ja3F1b3RlJyksXG4gIGJvZHk6IGNyZWF0ZURPTUZhY3RvcnkoJ2JvZHknKSxcbiAgYnI6IGNyZWF0ZURPTUZhY3RvcnkoJ2JyJyksXG4gIGJ1dHRvbjogY3JlYXRlRE9NRmFjdG9yeSgnYnV0dG9uJyksXG4gIGNhbnZhczogY3JlYXRlRE9NRmFjdG9yeSgnY2FudmFzJyksXG4gIGNhcHRpb246IGNyZWF0ZURPTUZhY3RvcnkoJ2NhcHRpb24nKSxcbiAgY2l0ZTogY3JlYXRlRE9NRmFjdG9yeSgnY2l0ZScpLFxuICBjb2RlOiBjcmVhdGVET01GYWN0b3J5KCdjb2RlJyksXG4gIGNvbDogY3JlYXRlRE9NRmFjdG9yeSgnY29sJyksXG4gIGNvbGdyb3VwOiBjcmVhdGVET01GYWN0b3J5KCdjb2xncm91cCcpLFxuICBkYXRhOiBjcmVhdGVET01GYWN0b3J5KCdkYXRhJyksXG4gIGRhdGFsaXN0OiBjcmVhdGVET01GYWN0b3J5KCdkYXRhbGlzdCcpLFxuICBkZDogY3JlYXRlRE9NRmFjdG9yeSgnZGQnKSxcbiAgZGVsOiBjcmVhdGVET01GYWN0b3J5KCdkZWwnKSxcbiAgZGV0YWlsczogY3JlYXRlRE9NRmFjdG9yeSgnZGV0YWlscycpLFxuICBkZm46IGNyZWF0ZURPTUZhY3RvcnkoJ2RmbicpLFxuICBkaWFsb2c6IGNyZWF0ZURPTUZhY3RvcnkoJ2RpYWxvZycpLFxuICBkaXY6IGNyZWF0ZURPTUZhY3RvcnkoJ2RpdicpLFxuICBkbDogY3JlYXRlRE9NRmFjdG9yeSgnZGwnKSxcbiAgZHQ6IGNyZWF0ZURPTUZhY3RvcnkoJ2R0JyksXG4gIGVtOiBjcmVhdGVET01GYWN0b3J5KCdlbScpLFxuICBlbWJlZDogY3JlYXRlRE9NRmFjdG9yeSgnZW1iZWQnKSxcbiAgZmllbGRzZXQ6IGNyZWF0ZURPTUZhY3RvcnkoJ2ZpZWxkc2V0JyksXG4gIGZpZ2NhcHRpb246IGNyZWF0ZURPTUZhY3RvcnkoJ2ZpZ2NhcHRpb24nKSxcbiAgZmlndXJlOiBjcmVhdGVET01GYWN0b3J5KCdmaWd1cmUnKSxcbiAgZm9vdGVyOiBjcmVhdGVET01GYWN0b3J5KCdmb290ZXInKSxcbiAgZm9ybTogY3JlYXRlRE9NRmFjdG9yeSgnZm9ybScpLFxuICBoMTogY3JlYXRlRE9NRmFjdG9yeSgnaDEnKSxcbiAgaDI6IGNyZWF0ZURPTUZhY3RvcnkoJ2gyJyksXG4gIGgzOiBjcmVhdGVET01GYWN0b3J5KCdoMycpLFxuICBoNDogY3JlYXRlRE9NRmFjdG9yeSgnaDQnKSxcbiAgaDU6IGNyZWF0ZURPTUZhY3RvcnkoJ2g1JyksXG4gIGg2OiBjcmVhdGVET01GYWN0b3J5KCdoNicpLFxuICBoZWFkOiBjcmVhdGVET01GYWN0b3J5KCdoZWFkJyksXG4gIGhlYWRlcjogY3JlYXRlRE9NRmFjdG9yeSgnaGVhZGVyJyksXG4gIGhncm91cDogY3JlYXRlRE9NRmFjdG9yeSgnaGdyb3VwJyksXG4gIGhyOiBjcmVhdGVET01GYWN0b3J5KCdocicpLFxuICBodG1sOiBjcmVhdGVET01GYWN0b3J5KCdodG1sJyksXG4gIGk6IGNyZWF0ZURPTUZhY3RvcnkoJ2knKSxcbiAgaWZyYW1lOiBjcmVhdGVET01GYWN0b3J5KCdpZnJhbWUnKSxcbiAgaW1nOiBjcmVhdGVET01GYWN0b3J5KCdpbWcnKSxcbiAgaW5wdXQ6IGNyZWF0ZURPTUZhY3RvcnkoJ2lucHV0JyksXG4gIGluczogY3JlYXRlRE9NRmFjdG9yeSgnaW5zJyksXG4gIGtiZDogY3JlYXRlRE9NRmFjdG9yeSgna2JkJyksXG4gIGtleWdlbjogY3JlYXRlRE9NRmFjdG9yeSgna2V5Z2VuJyksXG4gIGxhYmVsOiBjcmVhdGVET01GYWN0b3J5KCdsYWJlbCcpLFxuICBsZWdlbmQ6IGNyZWF0ZURPTUZhY3RvcnkoJ2xlZ2VuZCcpLFxuICBsaTogY3JlYXRlRE9NRmFjdG9yeSgnbGknKSxcbiAgbGluazogY3JlYXRlRE9NRmFjdG9yeSgnbGluaycpLFxuICBtYWluOiBjcmVhdGVET01GYWN0b3J5KCdtYWluJyksXG4gIG1hcDogY3JlYXRlRE9NRmFjdG9yeSgnbWFwJyksXG4gIG1hcms6IGNyZWF0ZURPTUZhY3RvcnkoJ21hcmsnKSxcbiAgbWVudTogY3JlYXRlRE9NRmFjdG9yeSgnbWVudScpLFxuICBtZW51aXRlbTogY3JlYXRlRE9NRmFjdG9yeSgnbWVudWl0ZW0nKSxcbiAgbWV0YTogY3JlYXRlRE9NRmFjdG9yeSgnbWV0YScpLFxuICBtZXRlcjogY3JlYXRlRE9NRmFjdG9yeSgnbWV0ZXInKSxcbiAgbmF2OiBjcmVhdGVET01GYWN0b3J5KCduYXYnKSxcbiAgbm9zY3JpcHQ6IGNyZWF0ZURPTUZhY3RvcnkoJ25vc2NyaXB0JyksXG4gIG9iamVjdDogY3JlYXRlRE9NRmFjdG9yeSgnb2JqZWN0JyksXG4gIG9sOiBjcmVhdGVET01GYWN0b3J5KCdvbCcpLFxuICBvcHRncm91cDogY3JlYXRlRE9NRmFjdG9yeSgnb3B0Z3JvdXAnKSxcbiAgb3B0aW9uOiBjcmVhdGVET01GYWN0b3J5KCdvcHRpb24nKSxcbiAgb3V0cHV0OiBjcmVhdGVET01GYWN0b3J5KCdvdXRwdXQnKSxcbiAgcDogY3JlYXRlRE9NRmFjdG9yeSgncCcpLFxuICBwYXJhbTogY3JlYXRlRE9NRmFjdG9yeSgncGFyYW0nKSxcbiAgcGljdHVyZTogY3JlYXRlRE9NRmFjdG9yeSgncGljdHVyZScpLFxuICBwcmU6IGNyZWF0ZURPTUZhY3RvcnkoJ3ByZScpLFxuICBwcm9ncmVzczogY3JlYXRlRE9NRmFjdG9yeSgncHJvZ3Jlc3MnKSxcbiAgcTogY3JlYXRlRE9NRmFjdG9yeSgncScpLFxuICBycDogY3JlYXRlRE9NRmFjdG9yeSgncnAnKSxcbiAgcnQ6IGNyZWF0ZURPTUZhY3RvcnkoJ3J0JyksXG4gIHJ1Ynk6IGNyZWF0ZURPTUZhY3RvcnkoJ3J1YnknKSxcbiAgczogY3JlYXRlRE9NRmFjdG9yeSgncycpLFxuICBzYW1wOiBjcmVhdGVET01GYWN0b3J5KCdzYW1wJyksXG4gIHNjcmlwdDogY3JlYXRlRE9NRmFjdG9yeSgnc2NyaXB0JyksXG4gIHNlY3Rpb246IGNyZWF0ZURPTUZhY3RvcnkoJ3NlY3Rpb24nKSxcbiAgc2VsZWN0OiBjcmVhdGVET01GYWN0b3J5KCdzZWxlY3QnKSxcbiAgc21hbGw6IGNyZWF0ZURPTUZhY3RvcnkoJ3NtYWxsJyksXG4gIHNvdXJjZTogY3JlYXRlRE9NRmFjdG9yeSgnc291cmNlJyksXG4gIHNwYW46IGNyZWF0ZURPTUZhY3RvcnkoJ3NwYW4nKSxcbiAgc3Ryb25nOiBjcmVhdGVET01GYWN0b3J5KCdzdHJvbmcnKSxcbiAgc3R5bGU6IGNyZWF0ZURPTUZhY3RvcnkoJ3N0eWxlJyksXG4gIHN1YjogY3JlYXRlRE9NRmFjdG9yeSgnc3ViJyksXG4gIHN1bW1hcnk6IGNyZWF0ZURPTUZhY3RvcnkoJ3N1bW1hcnknKSxcbiAgc3VwOiBjcmVhdGVET01GYWN0b3J5KCdzdXAnKSxcbiAgdGFibGU6IGNyZWF0ZURPTUZhY3RvcnkoJ3RhYmxlJyksXG4gIHRib2R5OiBjcmVhdGVET01GYWN0b3J5KCd0Ym9keScpLFxuICB0ZDogY3JlYXRlRE9NRmFjdG9yeSgndGQnKSxcbiAgdGV4dGFyZWE6IGNyZWF0ZURPTUZhY3RvcnkoJ3RleHRhcmVhJyksXG4gIHRmb290OiBjcmVhdGVET01GYWN0b3J5KCd0Zm9vdCcpLFxuICB0aDogY3JlYXRlRE9NRmFjdG9yeSgndGgnKSxcbiAgdGhlYWQ6IGNyZWF0ZURPTUZhY3RvcnkoJ3RoZWFkJyksXG4gIHRpbWU6IGNyZWF0ZURPTUZhY3RvcnkoJ3RpbWUnKSxcbiAgdGl0bGU6IGNyZWF0ZURPTUZhY3RvcnkoJ3RpdGxlJyksXG4gIHRyOiBjcmVhdGVET01GYWN0b3J5KCd0cicpLFxuICB0cmFjazogY3JlYXRlRE9NRmFjdG9yeSgndHJhY2snKSxcbiAgdTogY3JlYXRlRE9NRmFjdG9yeSgndScpLFxuICB1bDogY3JlYXRlRE9NRmFjdG9yeSgndWwnKSxcbiAgJ3Zhcic6IGNyZWF0ZURPTUZhY3RvcnkoJ3ZhcicpLFxuICB2aWRlbzogY3JlYXRlRE9NRmFjdG9yeSgndmlkZW8nKSxcbiAgd2JyOiBjcmVhdGVET01GYWN0b3J5KCd3YnInKSxcblxuICAvLyBTVkdcbiAgY2lyY2xlOiBjcmVhdGVET01GYWN0b3J5KCdjaXJjbGUnKSxcbiAgY2xpcFBhdGg6IGNyZWF0ZURPTUZhY3RvcnkoJ2NsaXBQYXRoJyksXG4gIGRlZnM6IGNyZWF0ZURPTUZhY3RvcnkoJ2RlZnMnKSxcbiAgZWxsaXBzZTogY3JlYXRlRE9NRmFjdG9yeSgnZWxsaXBzZScpLFxuICBnOiBjcmVhdGVET01GYWN0b3J5KCdnJyksXG4gIGltYWdlOiBjcmVhdGVET01GYWN0b3J5KCdpbWFnZScpLFxuICBsaW5lOiBjcmVhdGVET01GYWN0b3J5KCdsaW5lJyksXG4gIGxpbmVhckdyYWRpZW50OiBjcmVhdGVET01GYWN0b3J5KCdsaW5lYXJHcmFkaWVudCcpLFxuICBtYXNrOiBjcmVhdGVET01GYWN0b3J5KCdtYXNrJyksXG4gIHBhdGg6IGNyZWF0ZURPTUZhY3RvcnkoJ3BhdGgnKSxcbiAgcGF0dGVybjogY3JlYXRlRE9NRmFjdG9yeSgncGF0dGVybicpLFxuICBwb2x5Z29uOiBjcmVhdGVET01GYWN0b3J5KCdwb2x5Z29uJyksXG4gIHBvbHlsaW5lOiBjcmVhdGVET01GYWN0b3J5KCdwb2x5bGluZScpLFxuICByYWRpYWxHcmFkaWVudDogY3JlYXRlRE9NRmFjdG9yeSgncmFkaWFsR3JhZGllbnQnKSxcbiAgcmVjdDogY3JlYXRlRE9NRmFjdG9yeSgncmVjdCcpLFxuICBzdG9wOiBjcmVhdGVET01GYWN0b3J5KCdzdG9wJyksXG4gIHN2ZzogY3JlYXRlRE9NRmFjdG9yeSgnc3ZnJyksXG4gIHRleHQ6IGNyZWF0ZURPTUZhY3RvcnkoJ3RleHQnKSxcbiAgdHNwYW46IGNyZWF0ZURPTUZhY3RvcnkoJ3RzcGFuJylcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUmVhY3RET01GYWN0b3JpZXM7IiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNC1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIF9hc3NpZ24gPSByZXF1aXJlKCdvYmplY3QtYXNzaWduJyk7XG5cbnZhciBSZWFjdEN1cnJlbnRPd25lciA9IHJlcXVpcmUoJy4vUmVhY3RDdXJyZW50T3duZXInKTtcblxudmFyIHdhcm5pbmcgPSByZXF1aXJlKCdmYmpzL2xpYi93YXJuaW5nJyk7XG52YXIgY2FuRGVmaW5lUHJvcGVydHkgPSByZXF1aXJlKCcuL2NhbkRlZmluZVByb3BlcnR5Jyk7XG52YXIgaGFzT3duUHJvcGVydHkgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG52YXIgUkVBQ1RfRUxFTUVOVF9UWVBFID0gcmVxdWlyZSgnLi9SZWFjdEVsZW1lbnRTeW1ib2wnKTtcblxudmFyIFJFU0VSVkVEX1BST1BTID0ge1xuICBrZXk6IHRydWUsXG4gIHJlZjogdHJ1ZSxcbiAgX19zZWxmOiB0cnVlLFxuICBfX3NvdXJjZTogdHJ1ZVxufTtcblxudmFyIHNwZWNpYWxQcm9wS2V5V2FybmluZ1Nob3duLCBzcGVjaWFsUHJvcFJlZldhcm5pbmdTaG93bjtcblxuZnVuY3Rpb24gaGFzVmFsaWRSZWYoY29uZmlnKSB7XG4gIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgaWYgKGhhc093blByb3BlcnR5LmNhbGwoY29uZmlnLCAncmVmJykpIHtcbiAgICAgIHZhciBnZXR0ZXIgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKGNvbmZpZywgJ3JlZicpLmdldDtcbiAgICAgIGlmIChnZXR0ZXIgJiYgZ2V0dGVyLmlzUmVhY3RXYXJuaW5nKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIGNvbmZpZy5yZWYgIT09IHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gaGFzVmFsaWRLZXkoY29uZmlnKSB7XG4gIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgaWYgKGhhc093blByb3BlcnR5LmNhbGwoY29uZmlnLCAna2V5JykpIHtcbiAgICAgIHZhciBnZXR0ZXIgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKGNvbmZpZywgJ2tleScpLmdldDtcbiAgICAgIGlmIChnZXR0ZXIgJiYgZ2V0dGVyLmlzUmVhY3RXYXJuaW5nKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIGNvbmZpZy5rZXkgIT09IHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gZGVmaW5lS2V5UHJvcFdhcm5pbmdHZXR0ZXIocHJvcHMsIGRpc3BsYXlOYW1lKSB7XG4gIHZhciB3YXJuQWJvdXRBY2Nlc3NpbmdLZXkgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKCFzcGVjaWFsUHJvcEtleVdhcm5pbmdTaG93bikge1xuICAgICAgc3BlY2lhbFByb3BLZXlXYXJuaW5nU2hvd24gPSB0cnVlO1xuICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/IHdhcm5pbmcoZmFsc2UsICclczogYGtleWAgaXMgbm90IGEgcHJvcC4gVHJ5aW5nIHRvIGFjY2VzcyBpdCB3aWxsIHJlc3VsdCAnICsgJ2luIGB1bmRlZmluZWRgIGJlaW5nIHJldHVybmVkLiBJZiB5b3UgbmVlZCB0byBhY2Nlc3MgdGhlIHNhbWUgJyArICd2YWx1ZSB3aXRoaW4gdGhlIGNoaWxkIGNvbXBvbmVudCwgeW91IHNob3VsZCBwYXNzIGl0IGFzIGEgZGlmZmVyZW50ICcgKyAncHJvcC4gKGh0dHBzOi8vZmIubWUvcmVhY3Qtc3BlY2lhbC1wcm9wcyknLCBkaXNwbGF5TmFtZSkgOiB2b2lkIDA7XG4gICAgfVxuICB9O1xuICB3YXJuQWJvdXRBY2Nlc3NpbmdLZXkuaXNSZWFjdFdhcm5pbmcgPSB0cnVlO1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkocHJvcHMsICdrZXknLCB7XG4gICAgZ2V0OiB3YXJuQWJvdXRBY2Nlc3NpbmdLZXksXG4gICAgY29uZmlndXJhYmxlOiB0cnVlXG4gIH0pO1xufVxuXG5mdW5jdGlvbiBkZWZpbmVSZWZQcm9wV2FybmluZ0dldHRlcihwcm9wcywgZGlzcGxheU5hbWUpIHtcbiAgdmFyIHdhcm5BYm91dEFjY2Vzc2luZ1JlZiA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoIXNwZWNpYWxQcm9wUmVmV2FybmluZ1Nob3duKSB7XG4gICAgICBzcGVjaWFsUHJvcFJlZldhcm5pbmdTaG93biA9IHRydWU7XG4gICAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nID8gd2FybmluZyhmYWxzZSwgJyVzOiBgcmVmYCBpcyBub3QgYSBwcm9wLiBUcnlpbmcgdG8gYWNjZXNzIGl0IHdpbGwgcmVzdWx0ICcgKyAnaW4gYHVuZGVmaW5lZGAgYmVpbmcgcmV0dXJuZWQuIElmIHlvdSBuZWVkIHRvIGFjY2VzcyB0aGUgc2FtZSAnICsgJ3ZhbHVlIHdpdGhpbiB0aGUgY2hpbGQgY29tcG9uZW50LCB5b3Ugc2hvdWxkIHBhc3MgaXQgYXMgYSBkaWZmZXJlbnQgJyArICdwcm9wLiAoaHR0cHM6Ly9mYi5tZS9yZWFjdC1zcGVjaWFsLXByb3BzKScsIGRpc3BsYXlOYW1lKSA6IHZvaWQgMDtcbiAgICB9XG4gIH07XG4gIHdhcm5BYm91dEFjY2Vzc2luZ1JlZi5pc1JlYWN0V2FybmluZyA9IHRydWU7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm9wcywgJ3JlZicsIHtcbiAgICBnZXQ6IHdhcm5BYm91dEFjY2Vzc2luZ1JlZixcbiAgICBjb25maWd1cmFibGU6IHRydWVcbiAgfSk7XG59XG5cbi8qKlxuICogRmFjdG9yeSBtZXRob2QgdG8gY3JlYXRlIGEgbmV3IFJlYWN0IGVsZW1lbnQuIFRoaXMgbm8gbG9uZ2VyIGFkaGVyZXMgdG9cbiAqIHRoZSBjbGFzcyBwYXR0ZXJuLCBzbyBkbyBub3QgdXNlIG5ldyB0byBjYWxsIGl0LiBBbHNvLCBubyBpbnN0YW5jZW9mIGNoZWNrXG4gKiB3aWxsIHdvcmsuIEluc3RlYWQgdGVzdCAkJHR5cGVvZiBmaWVsZCBhZ2FpbnN0IFN5bWJvbC5mb3IoJ3JlYWN0LmVsZW1lbnQnKSB0byBjaGVja1xuICogaWYgc29tZXRoaW5nIGlzIGEgUmVhY3QgRWxlbWVudC5cbiAqXG4gKiBAcGFyYW0geyp9IHR5cGVcbiAqIEBwYXJhbSB7Kn0ga2V5XG4gKiBAcGFyYW0ge3N0cmluZ3xvYmplY3R9IHJlZlxuICogQHBhcmFtIHsqfSBzZWxmIEEgKnRlbXBvcmFyeSogaGVscGVyIHRvIGRldGVjdCBwbGFjZXMgd2hlcmUgYHRoaXNgIGlzXG4gKiBkaWZmZXJlbnQgZnJvbSB0aGUgYG93bmVyYCB3aGVuIFJlYWN0LmNyZWF0ZUVsZW1lbnQgaXMgY2FsbGVkLCBzbyB0aGF0IHdlXG4gKiBjYW4gd2Fybi4gV2Ugd2FudCB0byBnZXQgcmlkIG9mIG93bmVyIGFuZCByZXBsYWNlIHN0cmluZyBgcmVmYHMgd2l0aCBhcnJvd1xuICogZnVuY3Rpb25zLCBhbmQgYXMgbG9uZyBhcyBgdGhpc2AgYW5kIG93bmVyIGFyZSB0aGUgc2FtZSwgdGhlcmUgd2lsbCBiZSBub1xuICogY2hhbmdlIGluIGJlaGF2aW9yLlxuICogQHBhcmFtIHsqfSBzb3VyY2UgQW4gYW5ub3RhdGlvbiBvYmplY3QgKGFkZGVkIGJ5IGEgdHJhbnNwaWxlciBvciBvdGhlcndpc2UpXG4gKiBpbmRpY2F0aW5nIGZpbGVuYW1lLCBsaW5lIG51bWJlciwgYW5kL29yIG90aGVyIGluZm9ybWF0aW9uLlxuICogQHBhcmFtIHsqfSBvd25lclxuICogQHBhcmFtIHsqfSBwcm9wc1xuICogQGludGVybmFsXG4gKi9cbnZhciBSZWFjdEVsZW1lbnQgPSBmdW5jdGlvbiAodHlwZSwga2V5LCByZWYsIHNlbGYsIHNvdXJjZSwgb3duZXIsIHByb3BzKSB7XG4gIHZhciBlbGVtZW50ID0ge1xuICAgIC8vIFRoaXMgdGFnIGFsbG93IHVzIHRvIHVuaXF1ZWx5IGlkZW50aWZ5IHRoaXMgYXMgYSBSZWFjdCBFbGVtZW50XG4gICAgJCR0eXBlb2Y6IFJFQUNUX0VMRU1FTlRfVFlQRSxcblxuICAgIC8vIEJ1aWx0LWluIHByb3BlcnRpZXMgdGhhdCBiZWxvbmcgb24gdGhlIGVsZW1lbnRcbiAgICB0eXBlOiB0eXBlLFxuICAgIGtleToga2V5LFxuICAgIHJlZjogcmVmLFxuICAgIHByb3BzOiBwcm9wcyxcblxuICAgIC8vIFJlY29yZCB0aGUgY29tcG9uZW50IHJlc3BvbnNpYmxlIGZvciBjcmVhdGluZyB0aGlzIGVsZW1lbnQuXG4gICAgX293bmVyOiBvd25lclxuICB9O1xuXG4gIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgLy8gVGhlIHZhbGlkYXRpb24gZmxhZyBpcyBjdXJyZW50bHkgbXV0YXRpdmUuIFdlIHB1dCBpdCBvblxuICAgIC8vIGFuIGV4dGVybmFsIGJhY2tpbmcgc3RvcmUgc28gdGhhdCB3ZSBjYW4gZnJlZXplIHRoZSB3aG9sZSBvYmplY3QuXG4gICAgLy8gVGhpcyBjYW4gYmUgcmVwbGFjZWQgd2l0aCBhIFdlYWtNYXAgb25jZSB0aGV5IGFyZSBpbXBsZW1lbnRlZCBpblxuICAgIC8vIGNvbW1vbmx5IHVzZWQgZGV2ZWxvcG1lbnQgZW52aXJvbm1lbnRzLlxuICAgIGVsZW1lbnQuX3N0b3JlID0ge307XG5cbiAgICAvLyBUbyBtYWtlIGNvbXBhcmluZyBSZWFjdEVsZW1lbnRzIGVhc2llciBmb3IgdGVzdGluZyBwdXJwb3Nlcywgd2UgbWFrZVxuICAgIC8vIHRoZSB2YWxpZGF0aW9uIGZsYWcgbm9uLWVudW1lcmFibGUgKHdoZXJlIHBvc3NpYmxlLCB3aGljaCBzaG91bGRcbiAgICAvLyBpbmNsdWRlIGV2ZXJ5IGVudmlyb25tZW50IHdlIHJ1biB0ZXN0cyBpbiksIHNvIHRoZSB0ZXN0IGZyYW1ld29ya1xuICAgIC8vIGlnbm9yZXMgaXQuXG4gICAgaWYgKGNhbkRlZmluZVByb3BlcnR5KSB7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZWxlbWVudC5fc3RvcmUsICd2YWxpZGF0ZWQnLCB7XG4gICAgICAgIGNvbmZpZ3VyYWJsZTogZmFsc2UsXG4gICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgdmFsdWU6IGZhbHNlXG4gICAgICB9KTtcbiAgICAgIC8vIHNlbGYgYW5kIHNvdXJjZSBhcmUgREVWIG9ubHkgcHJvcGVydGllcy5cbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShlbGVtZW50LCAnX3NlbGYnLCB7XG4gICAgICAgIGNvbmZpZ3VyYWJsZTogZmFsc2UsXG4gICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgICAgIHZhbHVlOiBzZWxmXG4gICAgICB9KTtcbiAgICAgIC8vIFR3byBlbGVtZW50cyBjcmVhdGVkIGluIHR3byBkaWZmZXJlbnQgcGxhY2VzIHNob3VsZCBiZSBjb25zaWRlcmVkXG4gICAgICAvLyBlcXVhbCBmb3IgdGVzdGluZyBwdXJwb3NlcyBhbmQgdGhlcmVmb3JlIHdlIGhpZGUgaXQgZnJvbSBlbnVtZXJhdGlvbi5cbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShlbGVtZW50LCAnX3NvdXJjZScsIHtcbiAgICAgICAgY29uZmlndXJhYmxlOiBmYWxzZSxcbiAgICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICAgIHdyaXRhYmxlOiBmYWxzZSxcbiAgICAgICAgdmFsdWU6IHNvdXJjZVxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVsZW1lbnQuX3N0b3JlLnZhbGlkYXRlZCA9IGZhbHNlO1xuICAgICAgZWxlbWVudC5fc2VsZiA9IHNlbGY7XG4gICAgICBlbGVtZW50Ll9zb3VyY2UgPSBzb3VyY2U7XG4gICAgfVxuICAgIGlmIChPYmplY3QuZnJlZXplKSB7XG4gICAgICBPYmplY3QuZnJlZXplKGVsZW1lbnQucHJvcHMpO1xuICAgICAgT2JqZWN0LmZyZWV6ZShlbGVtZW50KTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZWxlbWVudDtcbn07XG5cbi8qKlxuICogQ3JlYXRlIGFuZCByZXR1cm4gYSBuZXcgUmVhY3RFbGVtZW50IG9mIHRoZSBnaXZlbiB0eXBlLlxuICogU2VlIGh0dHBzOi8vZmFjZWJvb2suZ2l0aHViLmlvL3JlYWN0L2RvY3MvdG9wLWxldmVsLWFwaS5odG1sI3JlYWN0LmNyZWF0ZWVsZW1lbnRcbiAqL1xuUmVhY3RFbGVtZW50LmNyZWF0ZUVsZW1lbnQgPSBmdW5jdGlvbiAodHlwZSwgY29uZmlnLCBjaGlsZHJlbikge1xuICB2YXIgcHJvcE5hbWU7XG5cbiAgLy8gUmVzZXJ2ZWQgbmFtZXMgYXJlIGV4dHJhY3RlZFxuICB2YXIgcHJvcHMgPSB7fTtcblxuICB2YXIga2V5ID0gbnVsbDtcbiAgdmFyIHJlZiA9IG51bGw7XG4gIHZhciBzZWxmID0gbnVsbDtcbiAgdmFyIHNvdXJjZSA9IG51bGw7XG5cbiAgaWYgKGNvbmZpZyAhPSBudWxsKSB7XG4gICAgaWYgKGhhc1ZhbGlkUmVmKGNvbmZpZykpIHtcbiAgICAgIHJlZiA9IGNvbmZpZy5yZWY7XG4gICAgfVxuICAgIGlmIChoYXNWYWxpZEtleShjb25maWcpKSB7XG4gICAgICBrZXkgPSAnJyArIGNvbmZpZy5rZXk7XG4gICAgfVxuXG4gICAgc2VsZiA9IGNvbmZpZy5fX3NlbGYgPT09IHVuZGVmaW5lZCA/IG51bGwgOiBjb25maWcuX19zZWxmO1xuICAgIHNvdXJjZSA9IGNvbmZpZy5fX3NvdXJjZSA9PT0gdW5kZWZpbmVkID8gbnVsbCA6IGNvbmZpZy5fX3NvdXJjZTtcbiAgICAvLyBSZW1haW5pbmcgcHJvcGVydGllcyBhcmUgYWRkZWQgdG8gYSBuZXcgcHJvcHMgb2JqZWN0XG4gICAgZm9yIChwcm9wTmFtZSBpbiBjb25maWcpIHtcbiAgICAgIGlmIChoYXNPd25Qcm9wZXJ0eS5jYWxsKGNvbmZpZywgcHJvcE5hbWUpICYmICFSRVNFUlZFRF9QUk9QUy5oYXNPd25Qcm9wZXJ0eShwcm9wTmFtZSkpIHtcbiAgICAgICAgcHJvcHNbcHJvcE5hbWVdID0gY29uZmlnW3Byb3BOYW1lXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBDaGlsZHJlbiBjYW4gYmUgbW9yZSB0aGFuIG9uZSBhcmd1bWVudCwgYW5kIHRob3NlIGFyZSB0cmFuc2ZlcnJlZCBvbnRvXG4gIC8vIHRoZSBuZXdseSBhbGxvY2F0ZWQgcHJvcHMgb2JqZWN0LlxuICB2YXIgY2hpbGRyZW5MZW5ndGggPSBhcmd1bWVudHMubGVuZ3RoIC0gMjtcbiAgaWYgKGNoaWxkcmVuTGVuZ3RoID09PSAxKSB7XG4gICAgcHJvcHMuY2hpbGRyZW4gPSBjaGlsZHJlbjtcbiAgfSBlbHNlIGlmIChjaGlsZHJlbkxlbmd0aCA+IDEpIHtcbiAgICB2YXIgY2hpbGRBcnJheSA9IEFycmF5KGNoaWxkcmVuTGVuZ3RoKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoaWxkcmVuTGVuZ3RoOyBpKyspIHtcbiAgICAgIGNoaWxkQXJyYXlbaV0gPSBhcmd1bWVudHNbaSArIDJdO1xuICAgIH1cbiAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgaWYgKE9iamVjdC5mcmVlemUpIHtcbiAgICAgICAgT2JqZWN0LmZyZWV6ZShjaGlsZEFycmF5KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcHJvcHMuY2hpbGRyZW4gPSBjaGlsZEFycmF5O1xuICB9XG5cbiAgLy8gUmVzb2x2ZSBkZWZhdWx0IHByb3BzXG4gIGlmICh0eXBlICYmIHR5cGUuZGVmYXVsdFByb3BzKSB7XG4gICAgdmFyIGRlZmF1bHRQcm9wcyA9IHR5cGUuZGVmYXVsdFByb3BzO1xuICAgIGZvciAocHJvcE5hbWUgaW4gZGVmYXVsdFByb3BzKSB7XG4gICAgICBpZiAocHJvcHNbcHJvcE5hbWVdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcHJvcHNbcHJvcE5hbWVdID0gZGVmYXVsdFByb3BzW3Byb3BOYW1lXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICBpZiAoa2V5IHx8IHJlZikge1xuICAgICAgaWYgKHR5cGVvZiBwcm9wcy4kJHR5cGVvZiA9PT0gJ3VuZGVmaW5lZCcgfHwgcHJvcHMuJCR0eXBlb2YgIT09IFJFQUNUX0VMRU1FTlRfVFlQRSkge1xuICAgICAgICB2YXIgZGlzcGxheU5hbWUgPSB0eXBlb2YgdHlwZSA9PT0gJ2Z1bmN0aW9uJyA/IHR5cGUuZGlzcGxheU5hbWUgfHwgdHlwZS5uYW1lIHx8ICdVbmtub3duJyA6IHR5cGU7XG4gICAgICAgIGlmIChrZXkpIHtcbiAgICAgICAgICBkZWZpbmVLZXlQcm9wV2FybmluZ0dldHRlcihwcm9wcywgZGlzcGxheU5hbWUpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChyZWYpIHtcbiAgICAgICAgICBkZWZpbmVSZWZQcm9wV2FybmluZ0dldHRlcihwcm9wcywgZGlzcGxheU5hbWUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBSZWFjdEVsZW1lbnQodHlwZSwga2V5LCByZWYsIHNlbGYsIHNvdXJjZSwgUmVhY3RDdXJyZW50T3duZXIuY3VycmVudCwgcHJvcHMpO1xufTtcblxuLyoqXG4gKiBSZXR1cm4gYSBmdW5jdGlvbiB0aGF0IHByb2R1Y2VzIFJlYWN0RWxlbWVudHMgb2YgYSBnaXZlbiB0eXBlLlxuICogU2VlIGh0dHBzOi8vZmFjZWJvb2suZ2l0aHViLmlvL3JlYWN0L2RvY3MvdG9wLWxldmVsLWFwaS5odG1sI3JlYWN0LmNyZWF0ZWZhY3RvcnlcbiAqL1xuUmVhY3RFbGVtZW50LmNyZWF0ZUZhY3RvcnkgPSBmdW5jdGlvbiAodHlwZSkge1xuICB2YXIgZmFjdG9yeSA9IFJlYWN0RWxlbWVudC5jcmVhdGVFbGVtZW50LmJpbmQobnVsbCwgdHlwZSk7XG4gIC8vIEV4cG9zZSB0aGUgdHlwZSBvbiB0aGUgZmFjdG9yeSBhbmQgdGhlIHByb3RvdHlwZSBzbyB0aGF0IGl0IGNhbiBiZVxuICAvLyBlYXNpbHkgYWNjZXNzZWQgb24gZWxlbWVudHMuIEUuZy4gYDxGb28gLz4udHlwZSA9PT0gRm9vYC5cbiAgLy8gVGhpcyBzaG91bGQgbm90IGJlIG5hbWVkIGBjb25zdHJ1Y3RvcmAgc2luY2UgdGhpcyBtYXkgbm90IGJlIHRoZSBmdW5jdGlvblxuICAvLyB0aGF0IGNyZWF0ZWQgdGhlIGVsZW1lbnQsIGFuZCBpdCBtYXkgbm90IGV2ZW4gYmUgYSBjb25zdHJ1Y3Rvci5cbiAgLy8gTGVnYWN5IGhvb2sgVE9ETzogV2FybiBpZiB0aGlzIGlzIGFjY2Vzc2VkXG4gIGZhY3RvcnkudHlwZSA9IHR5cGU7XG4gIHJldHVybiBmYWN0b3J5O1xufTtcblxuUmVhY3RFbGVtZW50LmNsb25lQW5kUmVwbGFjZUtleSA9IGZ1bmN0aW9uIChvbGRFbGVtZW50LCBuZXdLZXkpIHtcbiAgdmFyIG5ld0VsZW1lbnQgPSBSZWFjdEVsZW1lbnQob2xkRWxlbWVudC50eXBlLCBuZXdLZXksIG9sZEVsZW1lbnQucmVmLCBvbGRFbGVtZW50Ll9zZWxmLCBvbGRFbGVtZW50Ll9zb3VyY2UsIG9sZEVsZW1lbnQuX293bmVyLCBvbGRFbGVtZW50LnByb3BzKTtcblxuICByZXR1cm4gbmV3RWxlbWVudDtcbn07XG5cbi8qKlxuICogQ2xvbmUgYW5kIHJldHVybiBhIG5ldyBSZWFjdEVsZW1lbnQgdXNpbmcgZWxlbWVudCBhcyB0aGUgc3RhcnRpbmcgcG9pbnQuXG4gKiBTZWUgaHR0cHM6Ly9mYWNlYm9vay5naXRodWIuaW8vcmVhY3QvZG9jcy90b3AtbGV2ZWwtYXBpLmh0bWwjcmVhY3QuY2xvbmVlbGVtZW50XG4gKi9cblJlYWN0RWxlbWVudC5jbG9uZUVsZW1lbnQgPSBmdW5jdGlvbiAoZWxlbWVudCwgY29uZmlnLCBjaGlsZHJlbikge1xuICB2YXIgcHJvcE5hbWU7XG5cbiAgLy8gT3JpZ2luYWwgcHJvcHMgYXJlIGNvcGllZFxuICB2YXIgcHJvcHMgPSBfYXNzaWduKHt9LCBlbGVtZW50LnByb3BzKTtcblxuICAvLyBSZXNlcnZlZCBuYW1lcyBhcmUgZXh0cmFjdGVkXG4gIHZhciBrZXkgPSBlbGVtZW50LmtleTtcbiAgdmFyIHJlZiA9IGVsZW1lbnQucmVmO1xuICAvLyBTZWxmIGlzIHByZXNlcnZlZCBzaW5jZSB0aGUgb3duZXIgaXMgcHJlc2VydmVkLlxuICB2YXIgc2VsZiA9IGVsZW1lbnQuX3NlbGY7XG4gIC8vIFNvdXJjZSBpcyBwcmVzZXJ2ZWQgc2luY2UgY2xvbmVFbGVtZW50IGlzIHVubGlrZWx5IHRvIGJlIHRhcmdldGVkIGJ5IGFcbiAgLy8gdHJhbnNwaWxlciwgYW5kIHRoZSBvcmlnaW5hbCBzb3VyY2UgaXMgcHJvYmFibHkgYSBiZXR0ZXIgaW5kaWNhdG9yIG9mIHRoZVxuICAvLyB0cnVlIG93bmVyLlxuICB2YXIgc291cmNlID0gZWxlbWVudC5fc291cmNlO1xuXG4gIC8vIE93bmVyIHdpbGwgYmUgcHJlc2VydmVkLCB1bmxlc3MgcmVmIGlzIG92ZXJyaWRkZW5cbiAgdmFyIG93bmVyID0gZWxlbWVudC5fb3duZXI7XG5cbiAgaWYgKGNvbmZpZyAhPSBudWxsKSB7XG4gICAgaWYgKGhhc1ZhbGlkUmVmKGNvbmZpZykpIHtcbiAgICAgIC8vIFNpbGVudGx5IHN0ZWFsIHRoZSByZWYgZnJvbSB0aGUgcGFyZW50LlxuICAgICAgcmVmID0gY29uZmlnLnJlZjtcbiAgICAgIG93bmVyID0gUmVhY3RDdXJyZW50T3duZXIuY3VycmVudDtcbiAgICB9XG4gICAgaWYgKGhhc1ZhbGlkS2V5KGNvbmZpZykpIHtcbiAgICAgIGtleSA9ICcnICsgY29uZmlnLmtleTtcbiAgICB9XG5cbiAgICAvLyBSZW1haW5pbmcgcHJvcGVydGllcyBvdmVycmlkZSBleGlzdGluZyBwcm9wc1xuICAgIHZhciBkZWZhdWx0UHJvcHM7XG4gICAgaWYgKGVsZW1lbnQudHlwZSAmJiBlbGVtZW50LnR5cGUuZGVmYXVsdFByb3BzKSB7XG4gICAgICBkZWZhdWx0UHJvcHMgPSBlbGVtZW50LnR5cGUuZGVmYXVsdFByb3BzO1xuICAgIH1cbiAgICBmb3IgKHByb3BOYW1lIGluIGNvbmZpZykge1xuICAgICAgaWYgKGhhc093blByb3BlcnR5LmNhbGwoY29uZmlnLCBwcm9wTmFtZSkgJiYgIVJFU0VSVkVEX1BST1BTLmhhc093blByb3BlcnR5KHByb3BOYW1lKSkge1xuICAgICAgICBpZiAoY29uZmlnW3Byb3BOYW1lXSA9PT0gdW5kZWZpbmVkICYmIGRlZmF1bHRQcm9wcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgLy8gUmVzb2x2ZSBkZWZhdWx0IHByb3BzXG4gICAgICAgICAgcHJvcHNbcHJvcE5hbWVdID0gZGVmYXVsdFByb3BzW3Byb3BOYW1lXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwcm9wc1twcm9wTmFtZV0gPSBjb25maWdbcHJvcE5hbWVdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gQ2hpbGRyZW4gY2FuIGJlIG1vcmUgdGhhbiBvbmUgYXJndW1lbnQsIGFuZCB0aG9zZSBhcmUgdHJhbnNmZXJyZWQgb250b1xuICAvLyB0aGUgbmV3bHkgYWxsb2NhdGVkIHByb3BzIG9iamVjdC5cbiAgdmFyIGNoaWxkcmVuTGVuZ3RoID0gYXJndW1lbnRzLmxlbmd0aCAtIDI7XG4gIGlmIChjaGlsZHJlbkxlbmd0aCA9PT0gMSkge1xuICAgIHByb3BzLmNoaWxkcmVuID0gY2hpbGRyZW47XG4gIH0gZWxzZSBpZiAoY2hpbGRyZW5MZW5ndGggPiAxKSB7XG4gICAgdmFyIGNoaWxkQXJyYXkgPSBBcnJheShjaGlsZHJlbkxlbmd0aCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGlsZHJlbkxlbmd0aDsgaSsrKSB7XG4gICAgICBjaGlsZEFycmF5W2ldID0gYXJndW1lbnRzW2kgKyAyXTtcbiAgICB9XG4gICAgcHJvcHMuY2hpbGRyZW4gPSBjaGlsZEFycmF5O1xuICB9XG5cbiAgcmV0dXJuIFJlYWN0RWxlbWVudChlbGVtZW50LnR5cGUsIGtleSwgcmVmLCBzZWxmLCBzb3VyY2UsIG93bmVyLCBwcm9wcyk7XG59O1xuXG4vKipcbiAqIFZlcmlmaWVzIHRoZSBvYmplY3QgaXMgYSBSZWFjdEVsZW1lbnQuXG4gKiBTZWUgaHR0cHM6Ly9mYWNlYm9vay5naXRodWIuaW8vcmVhY3QvZG9jcy90b3AtbGV2ZWwtYXBpLmh0bWwjcmVhY3QuaXN2YWxpZGVsZW1lbnRcbiAqIEBwYXJhbSB7P29iamVjdH0gb2JqZWN0XG4gKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIGlmIGBvYmplY3RgIGlzIGEgdmFsaWQgY29tcG9uZW50LlxuICogQGZpbmFsXG4gKi9cblJlYWN0RWxlbWVudC5pc1ZhbGlkRWxlbWVudCA9IGZ1bmN0aW9uIChvYmplY3QpIHtcbiAgcmV0dXJuIHR5cGVvZiBvYmplY3QgPT09ICdvYmplY3QnICYmIG9iamVjdCAhPT0gbnVsbCAmJiBvYmplY3QuJCR0eXBlb2YgPT09IFJFQUNUX0VMRU1FTlRfVFlQRTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUmVhY3RFbGVtZW50OyIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTQtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICpcbiAqIFxuICovXG5cbid1c2Ugc3RyaWN0JztcblxuLy8gVGhlIFN5bWJvbCB1c2VkIHRvIHRhZyB0aGUgUmVhY3RFbGVtZW50IHR5cGUuIElmIHRoZXJlIGlzIG5vIG5hdGl2ZSBTeW1ib2xcbi8vIG5vciBwb2x5ZmlsbCwgdGhlbiBhIHBsYWluIG51bWJlciBpcyB1c2VkIGZvciBwZXJmb3JtYW5jZS5cblxudmFyIFJFQUNUX0VMRU1FTlRfVFlQRSA9IHR5cGVvZiBTeW1ib2wgPT09ICdmdW5jdGlvbicgJiYgU3ltYm9sWydmb3InXSAmJiBTeW1ib2xbJ2ZvciddKCdyZWFjdC5lbGVtZW50JykgfHwgMHhlYWM3O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFJFQUNUX0VMRU1FTlRfVFlQRTsiLCIvKipcbiAqIENvcHlyaWdodCAyMDE0LXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqXG4gKi9cblxuLyoqXG4gKiBSZWFjdEVsZW1lbnRWYWxpZGF0b3IgcHJvdmlkZXMgYSB3cmFwcGVyIGFyb3VuZCBhIGVsZW1lbnQgZmFjdG9yeVxuICogd2hpY2ggdmFsaWRhdGVzIHRoZSBwcm9wcyBwYXNzZWQgdG8gdGhlIGVsZW1lbnQuIFRoaXMgaXMgaW50ZW5kZWQgdG8gYmVcbiAqIHVzZWQgb25seSBpbiBERVYgYW5kIGNvdWxkIGJlIHJlcGxhY2VkIGJ5IGEgc3RhdGljIHR5cGUgY2hlY2tlciBmb3IgbGFuZ3VhZ2VzXG4gKiB0aGF0IHN1cHBvcnQgaXQuXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgUmVhY3RDdXJyZW50T3duZXIgPSByZXF1aXJlKCcuL1JlYWN0Q3VycmVudE93bmVyJyk7XG52YXIgUmVhY3RDb21wb25lbnRUcmVlSG9vayA9IHJlcXVpcmUoJy4vUmVhY3RDb21wb25lbnRUcmVlSG9vaycpO1xudmFyIFJlYWN0RWxlbWVudCA9IHJlcXVpcmUoJy4vUmVhY3RFbGVtZW50Jyk7XG5cbnZhciBjaGVja1JlYWN0VHlwZVNwZWMgPSByZXF1aXJlKCcuL2NoZWNrUmVhY3RUeXBlU3BlYycpO1xuXG52YXIgY2FuRGVmaW5lUHJvcGVydHkgPSByZXF1aXJlKCcuL2NhbkRlZmluZVByb3BlcnR5Jyk7XG52YXIgZ2V0SXRlcmF0b3JGbiA9IHJlcXVpcmUoJy4vZ2V0SXRlcmF0b3JGbicpO1xudmFyIHdhcm5pbmcgPSByZXF1aXJlKCdmYmpzL2xpYi93YXJuaW5nJyk7XG52YXIgbG93UHJpb3JpdHlXYXJuaW5nID0gcmVxdWlyZSgnLi9sb3dQcmlvcml0eVdhcm5pbmcnKTtcblxuZnVuY3Rpb24gZ2V0RGVjbGFyYXRpb25FcnJvckFkZGVuZHVtKCkge1xuICBpZiAoUmVhY3RDdXJyZW50T3duZXIuY3VycmVudCkge1xuICAgIHZhciBuYW1lID0gUmVhY3RDdXJyZW50T3duZXIuY3VycmVudC5nZXROYW1lKCk7XG4gICAgaWYgKG5hbWUpIHtcbiAgICAgIHJldHVybiAnIENoZWNrIHRoZSByZW5kZXIgbWV0aG9kIG9mIGAnICsgbmFtZSArICdgLic7XG4gICAgfVxuICB9XG4gIHJldHVybiAnJztcbn1cblxuZnVuY3Rpb24gZ2V0U291cmNlSW5mb0Vycm9yQWRkZW5kdW0oZWxlbWVudFByb3BzKSB7XG4gIGlmIChlbGVtZW50UHJvcHMgIT09IG51bGwgJiYgZWxlbWVudFByb3BzICE9PSB1bmRlZmluZWQgJiYgZWxlbWVudFByb3BzLl9fc291cmNlICE9PSB1bmRlZmluZWQpIHtcbiAgICB2YXIgc291cmNlID0gZWxlbWVudFByb3BzLl9fc291cmNlO1xuICAgIHZhciBmaWxlTmFtZSA9IHNvdXJjZS5maWxlTmFtZS5yZXBsYWNlKC9eLipbXFxcXFxcL10vLCAnJyk7XG4gICAgdmFyIGxpbmVOdW1iZXIgPSBzb3VyY2UubGluZU51bWJlcjtcbiAgICByZXR1cm4gJyBDaGVjayB5b3VyIGNvZGUgYXQgJyArIGZpbGVOYW1lICsgJzonICsgbGluZU51bWJlciArICcuJztcbiAgfVxuICByZXR1cm4gJyc7XG59XG5cbi8qKlxuICogV2FybiBpZiB0aGVyZSdzIG5vIGtleSBleHBsaWNpdGx5IHNldCBvbiBkeW5hbWljIGFycmF5cyBvZiBjaGlsZHJlbiBvclxuICogb2JqZWN0IGtleXMgYXJlIG5vdCB2YWxpZC4gVGhpcyBhbGxvd3MgdXMgdG8ga2VlcCB0cmFjayBvZiBjaGlsZHJlbiBiZXR3ZWVuXG4gKiB1cGRhdGVzLlxuICovXG52YXIgb3duZXJIYXNLZXlVc2VXYXJuaW5nID0ge307XG5cbmZ1bmN0aW9uIGdldEN1cnJlbnRDb21wb25lbnRFcnJvckluZm8ocGFyZW50VHlwZSkge1xuICB2YXIgaW5mbyA9IGdldERlY2xhcmF0aW9uRXJyb3JBZGRlbmR1bSgpO1xuXG4gIGlmICghaW5mbykge1xuICAgIHZhciBwYXJlbnROYW1lID0gdHlwZW9mIHBhcmVudFR5cGUgPT09ICdzdHJpbmcnID8gcGFyZW50VHlwZSA6IHBhcmVudFR5cGUuZGlzcGxheU5hbWUgfHwgcGFyZW50VHlwZS5uYW1lO1xuICAgIGlmIChwYXJlbnROYW1lKSB7XG4gICAgICBpbmZvID0gJyBDaGVjayB0aGUgdG9wLWxldmVsIHJlbmRlciBjYWxsIHVzaW5nIDwnICsgcGFyZW50TmFtZSArICc+Lic7XG4gICAgfVxuICB9XG4gIHJldHVybiBpbmZvO1xufVxuXG4vKipcbiAqIFdhcm4gaWYgdGhlIGVsZW1lbnQgZG9lc24ndCBoYXZlIGFuIGV4cGxpY2l0IGtleSBhc3NpZ25lZCB0byBpdC5cbiAqIFRoaXMgZWxlbWVudCBpcyBpbiBhbiBhcnJheS4gVGhlIGFycmF5IGNvdWxkIGdyb3cgYW5kIHNocmluayBvciBiZVxuICogcmVvcmRlcmVkLiBBbGwgY2hpbGRyZW4gdGhhdCBoYXZlbid0IGFscmVhZHkgYmVlbiB2YWxpZGF0ZWQgYXJlIHJlcXVpcmVkIHRvXG4gKiBoYXZlIGEgXCJrZXlcIiBwcm9wZXJ0eSBhc3NpZ25lZCB0byBpdC4gRXJyb3Igc3RhdHVzZXMgYXJlIGNhY2hlZCBzbyBhIHdhcm5pbmdcbiAqIHdpbGwgb25seSBiZSBzaG93biBvbmNlLlxuICpcbiAqIEBpbnRlcm5hbFxuICogQHBhcmFtIHtSZWFjdEVsZW1lbnR9IGVsZW1lbnQgRWxlbWVudCB0aGF0IHJlcXVpcmVzIGEga2V5LlxuICogQHBhcmFtIHsqfSBwYXJlbnRUeXBlIGVsZW1lbnQncyBwYXJlbnQncyB0eXBlLlxuICovXG5mdW5jdGlvbiB2YWxpZGF0ZUV4cGxpY2l0S2V5KGVsZW1lbnQsIHBhcmVudFR5cGUpIHtcbiAgaWYgKCFlbGVtZW50Ll9zdG9yZSB8fCBlbGVtZW50Ll9zdG9yZS52YWxpZGF0ZWQgfHwgZWxlbWVudC5rZXkgIT0gbnVsbCkge1xuICAgIHJldHVybjtcbiAgfVxuICBlbGVtZW50Ll9zdG9yZS52YWxpZGF0ZWQgPSB0cnVlO1xuXG4gIHZhciBtZW1vaXplciA9IG93bmVySGFzS2V5VXNlV2FybmluZy51bmlxdWVLZXkgfHwgKG93bmVySGFzS2V5VXNlV2FybmluZy51bmlxdWVLZXkgPSB7fSk7XG5cbiAgdmFyIGN1cnJlbnRDb21wb25lbnRFcnJvckluZm8gPSBnZXRDdXJyZW50Q29tcG9uZW50RXJyb3JJbmZvKHBhcmVudFR5cGUpO1xuICBpZiAobWVtb2l6ZXJbY3VycmVudENvbXBvbmVudEVycm9ySW5mb10pIHtcbiAgICByZXR1cm47XG4gIH1cbiAgbWVtb2l6ZXJbY3VycmVudENvbXBvbmVudEVycm9ySW5mb10gPSB0cnVlO1xuXG4gIC8vIFVzdWFsbHkgdGhlIGN1cnJlbnQgb3duZXIgaXMgdGhlIG9mZmVuZGVyLCBidXQgaWYgaXQgYWNjZXB0cyBjaGlsZHJlbiBhcyBhXG4gIC8vIHByb3BlcnR5LCBpdCBtYXkgYmUgdGhlIGNyZWF0b3Igb2YgdGhlIGNoaWxkIHRoYXQncyByZXNwb25zaWJsZSBmb3JcbiAgLy8gYXNzaWduaW5nIGl0IGEga2V5LlxuICB2YXIgY2hpbGRPd25lciA9ICcnO1xuICBpZiAoZWxlbWVudCAmJiBlbGVtZW50Ll9vd25lciAmJiBlbGVtZW50Ll9vd25lciAhPT0gUmVhY3RDdXJyZW50T3duZXIuY3VycmVudCkge1xuICAgIC8vIEdpdmUgdGhlIGNvbXBvbmVudCB0aGF0IG9yaWdpbmFsbHkgY3JlYXRlZCB0aGlzIGNoaWxkLlxuICAgIGNoaWxkT3duZXIgPSAnIEl0IHdhcyBwYXNzZWQgYSBjaGlsZCBmcm9tICcgKyBlbGVtZW50Ll9vd25lci5nZXROYW1lKCkgKyAnLic7XG4gIH1cblxuICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nID8gd2FybmluZyhmYWxzZSwgJ0VhY2ggY2hpbGQgaW4gYW4gYXJyYXkgb3IgaXRlcmF0b3Igc2hvdWxkIGhhdmUgYSB1bmlxdWUgXCJrZXlcIiBwcm9wLicgKyAnJXMlcyBTZWUgaHR0cHM6Ly9mYi5tZS9yZWFjdC13YXJuaW5nLWtleXMgZm9yIG1vcmUgaW5mb3JtYXRpb24uJXMnLCBjdXJyZW50Q29tcG9uZW50RXJyb3JJbmZvLCBjaGlsZE93bmVyLCBSZWFjdENvbXBvbmVudFRyZWVIb29rLmdldEN1cnJlbnRTdGFja0FkZGVuZHVtKGVsZW1lbnQpKSA6IHZvaWQgMDtcbn1cblxuLyoqXG4gKiBFbnN1cmUgdGhhdCBldmVyeSBlbGVtZW50IGVpdGhlciBpcyBwYXNzZWQgaW4gYSBzdGF0aWMgbG9jYXRpb24sIGluIGFuXG4gKiBhcnJheSB3aXRoIGFuIGV4cGxpY2l0IGtleXMgcHJvcGVydHkgZGVmaW5lZCwgb3IgaW4gYW4gb2JqZWN0IGxpdGVyYWxcbiAqIHdpdGggdmFsaWQga2V5IHByb3BlcnR5LlxuICpcbiAqIEBpbnRlcm5hbFxuICogQHBhcmFtIHtSZWFjdE5vZGV9IG5vZGUgU3RhdGljYWxseSBwYXNzZWQgY2hpbGQgb2YgYW55IHR5cGUuXG4gKiBAcGFyYW0geyp9IHBhcmVudFR5cGUgbm9kZSdzIHBhcmVudCdzIHR5cGUuXG4gKi9cbmZ1bmN0aW9uIHZhbGlkYXRlQ2hpbGRLZXlzKG5vZGUsIHBhcmVudFR5cGUpIHtcbiAgaWYgKHR5cGVvZiBub2RlICE9PSAnb2JqZWN0Jykge1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoQXJyYXkuaXNBcnJheShub2RlKSkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbm9kZS5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGNoaWxkID0gbm9kZVtpXTtcbiAgICAgIGlmIChSZWFjdEVsZW1lbnQuaXNWYWxpZEVsZW1lbnQoY2hpbGQpKSB7XG4gICAgICAgIHZhbGlkYXRlRXhwbGljaXRLZXkoY2hpbGQsIHBhcmVudFR5cGUpO1xuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIGlmIChSZWFjdEVsZW1lbnQuaXNWYWxpZEVsZW1lbnQobm9kZSkpIHtcbiAgICAvLyBUaGlzIGVsZW1lbnQgd2FzIHBhc3NlZCBpbiBhIHZhbGlkIGxvY2F0aW9uLlxuICAgIGlmIChub2RlLl9zdG9yZSkge1xuICAgICAgbm9kZS5fc3RvcmUudmFsaWRhdGVkID0gdHJ1ZTtcbiAgICB9XG4gIH0gZWxzZSBpZiAobm9kZSkge1xuICAgIHZhciBpdGVyYXRvckZuID0gZ2V0SXRlcmF0b3JGbihub2RlKTtcbiAgICAvLyBFbnRyeSBpdGVyYXRvcnMgcHJvdmlkZSBpbXBsaWNpdCBrZXlzLlxuICAgIGlmIChpdGVyYXRvckZuKSB7XG4gICAgICBpZiAoaXRlcmF0b3JGbiAhPT0gbm9kZS5lbnRyaWVzKSB7XG4gICAgICAgIHZhciBpdGVyYXRvciA9IGl0ZXJhdG9yRm4uY2FsbChub2RlKTtcbiAgICAgICAgdmFyIHN0ZXA7XG4gICAgICAgIHdoaWxlICghKHN0ZXAgPSBpdGVyYXRvci5uZXh0KCkpLmRvbmUpIHtcbiAgICAgICAgICBpZiAoUmVhY3RFbGVtZW50LmlzVmFsaWRFbGVtZW50KHN0ZXAudmFsdWUpKSB7XG4gICAgICAgICAgICB2YWxpZGF0ZUV4cGxpY2l0S2V5KHN0ZXAudmFsdWUsIHBhcmVudFR5cGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEdpdmVuIGFuIGVsZW1lbnQsIHZhbGlkYXRlIHRoYXQgaXRzIHByb3BzIGZvbGxvdyB0aGUgcHJvcFR5cGVzIGRlZmluaXRpb24sXG4gKiBwcm92aWRlZCBieSB0aGUgdHlwZS5cbiAqXG4gKiBAcGFyYW0ge1JlYWN0RWxlbWVudH0gZWxlbWVudFxuICovXG5mdW5jdGlvbiB2YWxpZGF0ZVByb3BUeXBlcyhlbGVtZW50KSB7XG4gIHZhciBjb21wb25lbnRDbGFzcyA9IGVsZW1lbnQudHlwZTtcbiAgaWYgKHR5cGVvZiBjb21wb25lbnRDbGFzcyAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybjtcbiAgfVxuICB2YXIgbmFtZSA9IGNvbXBvbmVudENsYXNzLmRpc3BsYXlOYW1lIHx8IGNvbXBvbmVudENsYXNzLm5hbWU7XG4gIGlmIChjb21wb25lbnRDbGFzcy5wcm9wVHlwZXMpIHtcbiAgICBjaGVja1JlYWN0VHlwZVNwZWMoY29tcG9uZW50Q2xhc3MucHJvcFR5cGVzLCBlbGVtZW50LnByb3BzLCAncHJvcCcsIG5hbWUsIGVsZW1lbnQsIG51bGwpO1xuICB9XG4gIGlmICh0eXBlb2YgY29tcG9uZW50Q2xhc3MuZ2V0RGVmYXVsdFByb3BzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/IHdhcm5pbmcoY29tcG9uZW50Q2xhc3MuZ2V0RGVmYXVsdFByb3BzLmlzUmVhY3RDbGFzc0FwcHJvdmVkLCAnZ2V0RGVmYXVsdFByb3BzIGlzIG9ubHkgdXNlZCBvbiBjbGFzc2ljIFJlYWN0LmNyZWF0ZUNsYXNzICcgKyAnZGVmaW5pdGlvbnMuIFVzZSBhIHN0YXRpYyBwcm9wZXJ0eSBuYW1lZCBgZGVmYXVsdFByb3BzYCBpbnN0ZWFkLicpIDogdm9pZCAwO1xuICB9XG59XG5cbnZhciBSZWFjdEVsZW1lbnRWYWxpZGF0b3IgPSB7XG4gIGNyZWF0ZUVsZW1lbnQ6IGZ1bmN0aW9uICh0eXBlLCBwcm9wcywgY2hpbGRyZW4pIHtcbiAgICB2YXIgdmFsaWRUeXBlID0gdHlwZW9mIHR5cGUgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiB0eXBlID09PSAnZnVuY3Rpb24nO1xuICAgIC8vIFdlIHdhcm4gaW4gdGhpcyBjYXNlIGJ1dCBkb24ndCB0aHJvdy4gV2UgZXhwZWN0IHRoZSBlbGVtZW50IGNyZWF0aW9uIHRvXG4gICAgLy8gc3VjY2VlZCBhbmQgdGhlcmUgd2lsbCBsaWtlbHkgYmUgZXJyb3JzIGluIHJlbmRlci5cbiAgICBpZiAoIXZhbGlkVHlwZSkge1xuICAgICAgaWYgKHR5cGVvZiB0eXBlICE9PSAnZnVuY3Rpb24nICYmIHR5cGVvZiB0eXBlICE9PSAnc3RyaW5nJykge1xuICAgICAgICB2YXIgaW5mbyA9ICcnO1xuICAgICAgICBpZiAodHlwZSA9PT0gdW5kZWZpbmVkIHx8IHR5cGVvZiB0eXBlID09PSAnb2JqZWN0JyAmJiB0eXBlICE9PSBudWxsICYmIE9iamVjdC5rZXlzKHR5cGUpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGluZm8gKz0gJyBZb3UgbGlrZWx5IGZvcmdvdCB0byBleHBvcnQgeW91ciBjb21wb25lbnQgZnJvbSB0aGUgZmlsZSAnICsgXCJpdCdzIGRlZmluZWQgaW4uXCI7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgc291cmNlSW5mbyA9IGdldFNvdXJjZUluZm9FcnJvckFkZGVuZHVtKHByb3BzKTtcbiAgICAgICAgaWYgKHNvdXJjZUluZm8pIHtcbiAgICAgICAgICBpbmZvICs9IHNvdXJjZUluZm87XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaW5mbyArPSBnZXREZWNsYXJhdGlvbkVycm9yQWRkZW5kdW0oKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGluZm8gKz0gUmVhY3RDb21wb25lbnRUcmVlSG9vay5nZXRDdXJyZW50U3RhY2tBZGRlbmR1bSgpO1xuXG4gICAgICAgIHZhciBjdXJyZW50U291cmNlID0gcHJvcHMgIT09IG51bGwgJiYgcHJvcHMgIT09IHVuZGVmaW5lZCAmJiBwcm9wcy5fX3NvdXJjZSAhPT0gdW5kZWZpbmVkID8gcHJvcHMuX19zb3VyY2UgOiBudWxsO1xuICAgICAgICBSZWFjdENvbXBvbmVudFRyZWVIb29rLnB1c2hOb25TdGFuZGFyZFdhcm5pbmdTdGFjayh0cnVlLCBjdXJyZW50U291cmNlKTtcbiAgICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/IHdhcm5pbmcoZmFsc2UsICdSZWFjdC5jcmVhdGVFbGVtZW50OiB0eXBlIGlzIGludmFsaWQgLS0gZXhwZWN0ZWQgYSBzdHJpbmcgKGZvciAnICsgJ2J1aWx0LWluIGNvbXBvbmVudHMpIG9yIGEgY2xhc3MvZnVuY3Rpb24gKGZvciBjb21wb3NpdGUgJyArICdjb21wb25lbnRzKSBidXQgZ290OiAlcy4lcycsIHR5cGUgPT0gbnVsbCA/IHR5cGUgOiB0eXBlb2YgdHlwZSwgaW5mbykgOiB2b2lkIDA7XG4gICAgICAgIFJlYWN0Q29tcG9uZW50VHJlZUhvb2sucG9wTm9uU3RhbmRhcmRXYXJuaW5nU3RhY2soKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgZWxlbWVudCA9IFJlYWN0RWxlbWVudC5jcmVhdGVFbGVtZW50LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cbiAgICAvLyBUaGUgcmVzdWx0IGNhbiBiZSBudWxsaXNoIGlmIGEgbW9jayBvciBhIGN1c3RvbSBmdW5jdGlvbiBpcyB1c2VkLlxuICAgIC8vIFRPRE86IERyb3AgdGhpcyB3aGVuIHRoZXNlIGFyZSBubyBsb25nZXIgYWxsb3dlZCBhcyB0aGUgdHlwZSBhcmd1bWVudC5cbiAgICBpZiAoZWxlbWVudCA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gZWxlbWVudDtcbiAgICB9XG5cbiAgICAvLyBTa2lwIGtleSB3YXJuaW5nIGlmIHRoZSB0eXBlIGlzbid0IHZhbGlkIHNpbmNlIG91ciBrZXkgdmFsaWRhdGlvbiBsb2dpY1xuICAgIC8vIGRvZXNuJ3QgZXhwZWN0IGEgbm9uLXN0cmluZy9mdW5jdGlvbiB0eXBlIGFuZCBjYW4gdGhyb3cgY29uZnVzaW5nIGVycm9ycy5cbiAgICAvLyBXZSBkb24ndCB3YW50IGV4Y2VwdGlvbiBiZWhhdmlvciB0byBkaWZmZXIgYmV0d2VlbiBkZXYgYW5kIHByb2QuXG4gICAgLy8gKFJlbmRlcmluZyB3aWxsIHRocm93IHdpdGggYSBoZWxwZnVsIG1lc3NhZ2UgYW5kIGFzIHNvb24gYXMgdGhlIHR5cGUgaXNcbiAgICAvLyBmaXhlZCwgdGhlIGtleSB3YXJuaW5ncyB3aWxsIGFwcGVhci4pXG4gICAgaWYgKHZhbGlkVHlwZSkge1xuICAgICAgZm9yICh2YXIgaSA9IDI7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFsaWRhdGVDaGlsZEtleXMoYXJndW1lbnRzW2ldLCB0eXBlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YWxpZGF0ZVByb3BUeXBlcyhlbGVtZW50KTtcblxuICAgIHJldHVybiBlbGVtZW50O1xuICB9LFxuXG4gIGNyZWF0ZUZhY3Rvcnk6IGZ1bmN0aW9uICh0eXBlKSB7XG4gICAgdmFyIHZhbGlkYXRlZEZhY3RvcnkgPSBSZWFjdEVsZW1lbnRWYWxpZGF0b3IuY3JlYXRlRWxlbWVudC5iaW5kKG51bGwsIHR5cGUpO1xuICAgIC8vIExlZ2FjeSBob29rIFRPRE86IFdhcm4gaWYgdGhpcyBpcyBhY2Nlc3NlZFxuICAgIHZhbGlkYXRlZEZhY3RvcnkudHlwZSA9IHR5cGU7XG5cbiAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgaWYgKGNhbkRlZmluZVByb3BlcnR5KSB7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh2YWxpZGF0ZWRGYWN0b3J5LCAndHlwZScsIHtcbiAgICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGxvd1ByaW9yaXR5V2FybmluZyhmYWxzZSwgJ0ZhY3RvcnkudHlwZSBpcyBkZXByZWNhdGVkLiBBY2Nlc3MgdGhlIGNsYXNzIGRpcmVjdGx5ICcgKyAnYmVmb3JlIHBhc3NpbmcgaXQgdG8gY3JlYXRlRmFjdG9yeS4nKTtcbiAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAndHlwZScsIHtcbiAgICAgICAgICAgICAgdmFsdWU6IHR5cGVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHR5cGU7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdmFsaWRhdGVkRmFjdG9yeTtcbiAgfSxcblxuICBjbG9uZUVsZW1lbnQ6IGZ1bmN0aW9uIChlbGVtZW50LCBwcm9wcywgY2hpbGRyZW4pIHtcbiAgICB2YXIgbmV3RWxlbWVudCA9IFJlYWN0RWxlbWVudC5jbG9uZUVsZW1lbnQuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICBmb3IgKHZhciBpID0gMjsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFsaWRhdGVDaGlsZEtleXMoYXJndW1lbnRzW2ldLCBuZXdFbGVtZW50LnR5cGUpO1xuICAgIH1cbiAgICB2YWxpZGF0ZVByb3BUeXBlcyhuZXdFbGVtZW50KTtcbiAgICByZXR1cm4gbmV3RWxlbWVudDtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBSZWFjdEVsZW1lbnRWYWxpZGF0b3I7IiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNS1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIHdhcm5pbmcgPSByZXF1aXJlKCdmYmpzL2xpYi93YXJuaW5nJyk7XG5cbmZ1bmN0aW9uIHdhcm5Ob29wKHB1YmxpY0luc3RhbmNlLCBjYWxsZXJOYW1lKSB7XG4gIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgdmFyIGNvbnN0cnVjdG9yID0gcHVibGljSW5zdGFuY2UuY29uc3RydWN0b3I7XG4gICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/IHdhcm5pbmcoZmFsc2UsICclcyguLi4pOiBDYW4gb25seSB1cGRhdGUgYSBtb3VudGVkIG9yIG1vdW50aW5nIGNvbXBvbmVudC4gJyArICdUaGlzIHVzdWFsbHkgbWVhbnMgeW91IGNhbGxlZCAlcygpIG9uIGFuIHVubW91bnRlZCBjb21wb25lbnQuICcgKyAnVGhpcyBpcyBhIG5vLW9wLiBQbGVhc2UgY2hlY2sgdGhlIGNvZGUgZm9yIHRoZSAlcyBjb21wb25lbnQuJywgY2FsbGVyTmFtZSwgY2FsbGVyTmFtZSwgY29uc3RydWN0b3IgJiYgKGNvbnN0cnVjdG9yLmRpc3BsYXlOYW1lIHx8IGNvbnN0cnVjdG9yLm5hbWUpIHx8ICdSZWFjdENsYXNzJykgOiB2b2lkIDA7XG4gIH1cbn1cblxuLyoqXG4gKiBUaGlzIGlzIHRoZSBhYnN0cmFjdCBBUEkgZm9yIGFuIHVwZGF0ZSBxdWV1ZS5cbiAqL1xudmFyIFJlYWN0Tm9vcFVwZGF0ZVF1ZXVlID0ge1xuICAvKipcbiAgICogQ2hlY2tzIHdoZXRoZXIgb3Igbm90IHRoaXMgY29tcG9zaXRlIGNvbXBvbmVudCBpcyBtb3VudGVkLlxuICAgKiBAcGFyYW0ge1JlYWN0Q2xhc3N9IHB1YmxpY0luc3RhbmNlIFRoZSBpbnN0YW5jZSB3ZSB3YW50IHRvIHRlc3QuXG4gICAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgaWYgbW91bnRlZCwgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgKiBAcHJvdGVjdGVkXG4gICAqIEBmaW5hbFxuICAgKi9cbiAgaXNNb3VudGVkOiBmdW5jdGlvbiAocHVibGljSW5zdGFuY2UpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEVucXVldWUgYSBjYWxsYmFjayB0aGF0IHdpbGwgYmUgZXhlY3V0ZWQgYWZ0ZXIgYWxsIHRoZSBwZW5kaW5nIHVwZGF0ZXNcbiAgICogaGF2ZSBwcm9jZXNzZWQuXG4gICAqXG4gICAqIEBwYXJhbSB7UmVhY3RDbGFzc30gcHVibGljSW5zdGFuY2UgVGhlIGluc3RhbmNlIHRvIHVzZSBhcyBgdGhpc2AgY29udGV4dC5cbiAgICogQHBhcmFtIHs/ZnVuY3Rpb259IGNhbGxiYWNrIENhbGxlZCBhZnRlciBzdGF0ZSBpcyB1cGRhdGVkLlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIGVucXVldWVDYWxsYmFjazogZnVuY3Rpb24gKHB1YmxpY0luc3RhbmNlLCBjYWxsYmFjaykge30sXG5cbiAgLyoqXG4gICAqIEZvcmNlcyBhbiB1cGRhdGUuIFRoaXMgc2hvdWxkIG9ubHkgYmUgaW52b2tlZCB3aGVuIGl0IGlzIGtub3duIHdpdGhcbiAgICogY2VydGFpbnR5IHRoYXQgd2UgYXJlICoqbm90KiogaW4gYSBET00gdHJhbnNhY3Rpb24uXG4gICAqXG4gICAqIFlvdSBtYXkgd2FudCB0byBjYWxsIHRoaXMgd2hlbiB5b3Uga25vdyB0aGF0IHNvbWUgZGVlcGVyIGFzcGVjdCBvZiB0aGVcbiAgICogY29tcG9uZW50J3Mgc3RhdGUgaGFzIGNoYW5nZWQgYnV0IGBzZXRTdGF0ZWAgd2FzIG5vdCBjYWxsZWQuXG4gICAqXG4gICAqIFRoaXMgd2lsbCBub3QgaW52b2tlIGBzaG91bGRDb21wb25lbnRVcGRhdGVgLCBidXQgaXQgd2lsbCBpbnZva2VcbiAgICogYGNvbXBvbmVudFdpbGxVcGRhdGVgIGFuZCBgY29tcG9uZW50RGlkVXBkYXRlYC5cbiAgICpcbiAgICogQHBhcmFtIHtSZWFjdENsYXNzfSBwdWJsaWNJbnN0YW5jZSBUaGUgaW5zdGFuY2UgdGhhdCBzaG91bGQgcmVyZW5kZXIuXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgZW5xdWV1ZUZvcmNlVXBkYXRlOiBmdW5jdGlvbiAocHVibGljSW5zdGFuY2UpIHtcbiAgICB3YXJuTm9vcChwdWJsaWNJbnN0YW5jZSwgJ2ZvcmNlVXBkYXRlJyk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFJlcGxhY2VzIGFsbCBvZiB0aGUgc3RhdGUuIEFsd2F5cyB1c2UgdGhpcyBvciBgc2V0U3RhdGVgIHRvIG11dGF0ZSBzdGF0ZS5cbiAgICogWW91IHNob3VsZCB0cmVhdCBgdGhpcy5zdGF0ZWAgYXMgaW1tdXRhYmxlLlxuICAgKlxuICAgKiBUaGVyZSBpcyBubyBndWFyYW50ZWUgdGhhdCBgdGhpcy5zdGF0ZWAgd2lsbCBiZSBpbW1lZGlhdGVseSB1cGRhdGVkLCBzb1xuICAgKiBhY2Nlc3NpbmcgYHRoaXMuc3RhdGVgIGFmdGVyIGNhbGxpbmcgdGhpcyBtZXRob2QgbWF5IHJldHVybiB0aGUgb2xkIHZhbHVlLlxuICAgKlxuICAgKiBAcGFyYW0ge1JlYWN0Q2xhc3N9IHB1YmxpY0luc3RhbmNlIFRoZSBpbnN0YW5jZSB0aGF0IHNob3VsZCByZXJlbmRlci5cbiAgICogQHBhcmFtIHtvYmplY3R9IGNvbXBsZXRlU3RhdGUgTmV4dCBzdGF0ZS5cbiAgICogQGludGVybmFsXG4gICAqL1xuICBlbnF1ZXVlUmVwbGFjZVN0YXRlOiBmdW5jdGlvbiAocHVibGljSW5zdGFuY2UsIGNvbXBsZXRlU3RhdGUpIHtcbiAgICB3YXJuTm9vcChwdWJsaWNJbnN0YW5jZSwgJ3JlcGxhY2VTdGF0ZScpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBTZXRzIGEgc3Vic2V0IG9mIHRoZSBzdGF0ZS4gVGhpcyBvbmx5IGV4aXN0cyBiZWNhdXNlIF9wZW5kaW5nU3RhdGUgaXNcbiAgICogaW50ZXJuYWwuIFRoaXMgcHJvdmlkZXMgYSBtZXJnaW5nIHN0cmF0ZWd5IHRoYXQgaXMgbm90IGF2YWlsYWJsZSB0byBkZWVwXG4gICAqIHByb3BlcnRpZXMgd2hpY2ggaXMgY29uZnVzaW5nLiBUT0RPOiBFeHBvc2UgcGVuZGluZ1N0YXRlIG9yIGRvbid0IHVzZSBpdFxuICAgKiBkdXJpbmcgdGhlIG1lcmdlLlxuICAgKlxuICAgKiBAcGFyYW0ge1JlYWN0Q2xhc3N9IHB1YmxpY0luc3RhbmNlIFRoZSBpbnN0YW5jZSB0aGF0IHNob3VsZCByZXJlbmRlci5cbiAgICogQHBhcmFtIHtvYmplY3R9IHBhcnRpYWxTdGF0ZSBOZXh0IHBhcnRpYWwgc3RhdGUgdG8gYmUgbWVyZ2VkIHdpdGggc3RhdGUuXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgZW5xdWV1ZVNldFN0YXRlOiBmdW5jdGlvbiAocHVibGljSW5zdGFuY2UsIHBhcnRpYWxTdGF0ZSkge1xuICAgIHdhcm5Ob29wKHB1YmxpY0luc3RhbmNlLCAnc2V0U3RhdGUnKTtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBSZWFjdE5vb3BVcGRhdGVRdWV1ZTsiLCIvKipcbiAqIENvcHlyaWdodCAyMDEzLXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqXG4gKiBcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBSZWFjdFByb3BUeXBlTG9jYXRpb25OYW1lcyA9IHt9O1xuXG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICBSZWFjdFByb3BUeXBlTG9jYXRpb25OYW1lcyA9IHtcbiAgICBwcm9wOiAncHJvcCcsXG4gICAgY29udGV4dDogJ2NvbnRleHQnLFxuICAgIGNoaWxkQ29udGV4dDogJ2NoaWxkIGNvbnRleHQnXG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gUmVhY3RQcm9wVHlwZUxvY2F0aW9uTmFtZXM7IiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxMy1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIF9yZXF1aXJlID0gcmVxdWlyZSgnLi9SZWFjdEVsZW1lbnQnKSxcbiAgICBpc1ZhbGlkRWxlbWVudCA9IF9yZXF1aXJlLmlzVmFsaWRFbGVtZW50O1xuXG52YXIgZmFjdG9yeSA9IHJlcXVpcmUoJ3Byb3AtdHlwZXMvZmFjdG9yeScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoaXNWYWxpZEVsZW1lbnQpOyIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTMtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICpcbiAqIFxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIFJlYWN0UHJvcFR5cGVzU2VjcmV0ID0gJ1NFQ1JFVF9ET19OT1RfUEFTU19USElTX09SX1lPVV9XSUxMX0JFX0ZJUkVEJztcblxubW9kdWxlLmV4cG9ydHMgPSBSZWFjdFByb3BUeXBlc1NlY3JldDsiLCIvKipcbiAqIENvcHlyaWdodCAyMDEzLXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9ICcxNS42LjEnOyIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTMtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICpcbiAqIFxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIGNhbkRlZmluZVByb3BlcnR5ID0gZmFsc2U7XG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICB0cnkge1xuICAgIC8vICRGbG93Rml4TWUgaHR0cHM6Ly9naXRodWIuY29tL2ZhY2Vib29rL2Zsb3cvaXNzdWVzLzI4NVxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh7fSwgJ3gnLCB7IGdldDogZnVuY3Rpb24gKCkge30gfSk7XG4gICAgY2FuRGVmaW5lUHJvcGVydHkgPSB0cnVlO1xuICB9IGNhdGNoICh4KSB7XG4gICAgLy8gSUUgd2lsbCBmYWlsIG9uIGRlZmluZVByb3BlcnR5XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjYW5EZWZpbmVQcm9wZXJ0eTsiLCIvKipcbiAqIENvcHlyaWdodCAyMDEzLXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgX3Byb2RJbnZhcmlhbnQgPSByZXF1aXJlKCcuL3JlYWN0UHJvZEludmFyaWFudCcpO1xuXG52YXIgUmVhY3RQcm9wVHlwZUxvY2F0aW9uTmFtZXMgPSByZXF1aXJlKCcuL1JlYWN0UHJvcFR5cGVMb2NhdGlvbk5hbWVzJyk7XG52YXIgUmVhY3RQcm9wVHlwZXNTZWNyZXQgPSByZXF1aXJlKCcuL1JlYWN0UHJvcFR5cGVzU2VjcmV0Jyk7XG5cbnZhciBpbnZhcmlhbnQgPSByZXF1aXJlKCdmYmpzL2xpYi9pbnZhcmlhbnQnKTtcbnZhciB3YXJuaW5nID0gcmVxdWlyZSgnZmJqcy9saWIvd2FybmluZycpO1xuXG52YXIgUmVhY3RDb21wb25lbnRUcmVlSG9vaztcblxuaWYgKHR5cGVvZiBwcm9jZXNzICE9PSAndW5kZWZpbmVkJyAmJiBwcm9jZXNzLmVudiAmJiBwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gJ3Rlc3QnKSB7XG4gIC8vIFRlbXBvcmFyeSBoYWNrLlxuICAvLyBJbmxpbmUgcmVxdWlyZXMgZG9uJ3Qgd29yayB3ZWxsIHdpdGggSmVzdDpcbiAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2ZhY2Vib29rL3JlYWN0L2lzc3Vlcy83MjQwXG4gIC8vIFJlbW92ZSB0aGUgaW5saW5lIHJlcXVpcmVzIHdoZW4gd2UgZG9uJ3QgbmVlZCB0aGVtIGFueW1vcmU6XG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9mYWNlYm9vay9yZWFjdC9wdWxsLzcxNzhcbiAgUmVhY3RDb21wb25lbnRUcmVlSG9vayA9IHJlcXVpcmUoJy4vUmVhY3RDb21wb25lbnRUcmVlSG9vaycpO1xufVxuXG52YXIgbG9nZ2VkVHlwZUZhaWx1cmVzID0ge307XG5cbi8qKlxuICogQXNzZXJ0IHRoYXQgdGhlIHZhbHVlcyBtYXRjaCB3aXRoIHRoZSB0eXBlIHNwZWNzLlxuICogRXJyb3IgbWVzc2FnZXMgYXJlIG1lbW9yaXplZCBhbmQgd2lsbCBvbmx5IGJlIHNob3duIG9uY2UuXG4gKlxuICogQHBhcmFtIHtvYmplY3R9IHR5cGVTcGVjcyBNYXAgb2YgbmFtZSB0byBhIFJlYWN0UHJvcFR5cGVcbiAqIEBwYXJhbSB7b2JqZWN0fSB2YWx1ZXMgUnVudGltZSB2YWx1ZXMgdGhhdCBuZWVkIHRvIGJlIHR5cGUtY2hlY2tlZFxuICogQHBhcmFtIHtzdHJpbmd9IGxvY2F0aW9uIGUuZy4gXCJwcm9wXCIsIFwiY29udGV4dFwiLCBcImNoaWxkIGNvbnRleHRcIlxuICogQHBhcmFtIHtzdHJpbmd9IGNvbXBvbmVudE5hbWUgTmFtZSBvZiB0aGUgY29tcG9uZW50IGZvciBlcnJvciBtZXNzYWdlcy5cbiAqIEBwYXJhbSB7P29iamVjdH0gZWxlbWVudCBUaGUgUmVhY3QgZWxlbWVudCB0aGF0IGlzIGJlaW5nIHR5cGUtY2hlY2tlZFxuICogQHBhcmFtIHs/bnVtYmVyfSBkZWJ1Z0lEIFRoZSBSZWFjdCBjb21wb25lbnQgaW5zdGFuY2UgdGhhdCBpcyBiZWluZyB0eXBlLWNoZWNrZWRcbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIGNoZWNrUmVhY3RUeXBlU3BlYyh0eXBlU3BlY3MsIHZhbHVlcywgbG9jYXRpb24sIGNvbXBvbmVudE5hbWUsIGVsZW1lbnQsIGRlYnVnSUQpIHtcbiAgZm9yICh2YXIgdHlwZVNwZWNOYW1lIGluIHR5cGVTcGVjcykge1xuICAgIGlmICh0eXBlU3BlY3MuaGFzT3duUHJvcGVydHkodHlwZVNwZWNOYW1lKSkge1xuICAgICAgdmFyIGVycm9yO1xuICAgICAgLy8gUHJvcCB0eXBlIHZhbGlkYXRpb24gbWF5IHRocm93LiBJbiBjYXNlIHRoZXkgZG8sIHdlIGRvbid0IHdhbnQgdG9cbiAgICAgIC8vIGZhaWwgdGhlIHJlbmRlciBwaGFzZSB3aGVyZSBpdCBkaWRuJ3QgZmFpbCBiZWZvcmUuIFNvIHdlIGxvZyBpdC5cbiAgICAgIC8vIEFmdGVyIHRoZXNlIGhhdmUgYmVlbiBjbGVhbmVkIHVwLCB3ZSdsbCBsZXQgdGhlbSB0aHJvdy5cbiAgICAgIHRyeSB7XG4gICAgICAgIC8vIFRoaXMgaXMgaW50ZW50aW9uYWxseSBhbiBpbnZhcmlhbnQgdGhhdCBnZXRzIGNhdWdodC4gSXQncyB0aGUgc2FtZVxuICAgICAgICAvLyBiZWhhdmlvciBhcyB3aXRob3V0IHRoaXMgc3RhdGVtZW50IGV4Y2VwdCB3aXRoIGEgYmV0dGVyIG1lc3NhZ2UuXG4gICAgICAgICEodHlwZW9mIHR5cGVTcGVjc1t0eXBlU3BlY05hbWVdID09PSAnZnVuY3Rpb24nKSA/IHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyBpbnZhcmlhbnQoZmFsc2UsICclczogJXMgdHlwZSBgJXNgIGlzIGludmFsaWQ7IGl0IG11c3QgYmUgYSBmdW5jdGlvbiwgdXN1YWxseSBmcm9tIFJlYWN0LlByb3BUeXBlcy4nLCBjb21wb25lbnROYW1lIHx8ICdSZWFjdCBjbGFzcycsIFJlYWN0UHJvcFR5cGVMb2NhdGlvbk5hbWVzW2xvY2F0aW9uXSwgdHlwZVNwZWNOYW1lKSA6IF9wcm9kSW52YXJpYW50KCc4NCcsIGNvbXBvbmVudE5hbWUgfHwgJ1JlYWN0IGNsYXNzJywgUmVhY3RQcm9wVHlwZUxvY2F0aW9uTmFtZXNbbG9jYXRpb25dLCB0eXBlU3BlY05hbWUpIDogdm9pZCAwO1xuICAgICAgICBlcnJvciA9IHR5cGVTcGVjc1t0eXBlU3BlY05hbWVdKHZhbHVlcywgdHlwZVNwZWNOYW1lLCBjb21wb25lbnROYW1lLCBsb2NhdGlvbiwgbnVsbCwgUmVhY3RQcm9wVHlwZXNTZWNyZXQpO1xuICAgICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgICAgZXJyb3IgPSBleDtcbiAgICAgIH1cbiAgICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyB3YXJuaW5nKCFlcnJvciB8fCBlcnJvciBpbnN0YW5jZW9mIEVycm9yLCAnJXM6IHR5cGUgc3BlY2lmaWNhdGlvbiBvZiAlcyBgJXNgIGlzIGludmFsaWQ7IHRoZSB0eXBlIGNoZWNrZXIgJyArICdmdW5jdGlvbiBtdXN0IHJldHVybiBgbnVsbGAgb3IgYW4gYEVycm9yYCBidXQgcmV0dXJuZWQgYSAlcy4gJyArICdZb3UgbWF5IGhhdmUgZm9yZ290dGVuIHRvIHBhc3MgYW4gYXJndW1lbnQgdG8gdGhlIHR5cGUgY2hlY2tlciAnICsgJ2NyZWF0b3IgKGFycmF5T2YsIGluc3RhbmNlT2YsIG9iamVjdE9mLCBvbmVPZiwgb25lT2ZUeXBlLCBhbmQgJyArICdzaGFwZSBhbGwgcmVxdWlyZSBhbiBhcmd1bWVudCkuJywgY29tcG9uZW50TmFtZSB8fCAnUmVhY3QgY2xhc3MnLCBSZWFjdFByb3BUeXBlTG9jYXRpb25OYW1lc1tsb2NhdGlvbl0sIHR5cGVTcGVjTmFtZSwgdHlwZW9mIGVycm9yKSA6IHZvaWQgMDtcbiAgICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yICYmICEoZXJyb3IubWVzc2FnZSBpbiBsb2dnZWRUeXBlRmFpbHVyZXMpKSB7XG4gICAgICAgIC8vIE9ubHkgbW9uaXRvciB0aGlzIGZhaWx1cmUgb25jZSBiZWNhdXNlIHRoZXJlIHRlbmRzIHRvIGJlIGEgbG90IG9mIHRoZVxuICAgICAgICAvLyBzYW1lIGVycm9yLlxuICAgICAgICBsb2dnZWRUeXBlRmFpbHVyZXNbZXJyb3IubWVzc2FnZV0gPSB0cnVlO1xuXG4gICAgICAgIHZhciBjb21wb25lbnRTdGFja0luZm8gPSAnJztcblxuICAgICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgICAgIGlmICghUmVhY3RDb21wb25lbnRUcmVlSG9vaykge1xuICAgICAgICAgICAgUmVhY3RDb21wb25lbnRUcmVlSG9vayA9IHJlcXVpcmUoJy4vUmVhY3RDb21wb25lbnRUcmVlSG9vaycpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoZGVidWdJRCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgY29tcG9uZW50U3RhY2tJbmZvID0gUmVhY3RDb21wb25lbnRUcmVlSG9vay5nZXRTdGFja0FkZGVuZHVtQnlJRChkZWJ1Z0lEKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGVsZW1lbnQgIT09IG51bGwpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudFN0YWNrSW5mbyA9IFJlYWN0Q29tcG9uZW50VHJlZUhvb2suZ2V0Q3VycmVudFN0YWNrQWRkZW5kdW0oZWxlbWVudCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/IHdhcm5pbmcoZmFsc2UsICdGYWlsZWQgJXMgdHlwZTogJXMlcycsIGxvY2F0aW9uLCBlcnJvci5tZXNzYWdlLCBjb21wb25lbnRTdGFja0luZm8pIDogdm9pZCAwO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNoZWNrUmVhY3RUeXBlU3BlYzsiLCIvKipcbiAqIENvcHlyaWdodCAyMDEzLXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgX3JlcXVpcmUgPSByZXF1aXJlKCcuL1JlYWN0QmFzZUNsYXNzZXMnKSxcbiAgICBDb21wb25lbnQgPSBfcmVxdWlyZS5Db21wb25lbnQ7XG5cbnZhciBfcmVxdWlyZTIgPSByZXF1aXJlKCcuL1JlYWN0RWxlbWVudCcpLFxuICAgIGlzVmFsaWRFbGVtZW50ID0gX3JlcXVpcmUyLmlzVmFsaWRFbGVtZW50O1xuXG52YXIgUmVhY3ROb29wVXBkYXRlUXVldWUgPSByZXF1aXJlKCcuL1JlYWN0Tm9vcFVwZGF0ZVF1ZXVlJyk7XG52YXIgZmFjdG9yeSA9IHJlcXVpcmUoJ2NyZWF0ZS1yZWFjdC1jbGFzcy9mYWN0b3J5Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZmFjdG9yeShDb21wb25lbnQsIGlzVmFsaWRFbGVtZW50LCBSZWFjdE5vb3BVcGRhdGVRdWV1ZSk7IiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxMy1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICogXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG4vKiBnbG9iYWwgU3ltYm9sICovXG5cbnZhciBJVEVSQVRPUl9TWU1CT0wgPSB0eXBlb2YgU3ltYm9sID09PSAnZnVuY3Rpb24nICYmIFN5bWJvbC5pdGVyYXRvcjtcbnZhciBGQVVYX0lURVJBVE9SX1NZTUJPTCA9ICdAQGl0ZXJhdG9yJzsgLy8gQmVmb3JlIFN5bWJvbCBzcGVjLlxuXG4vKipcbiAqIFJldHVybnMgdGhlIGl0ZXJhdG9yIG1ldGhvZCBmdW5jdGlvbiBjb250YWluZWQgb24gdGhlIGl0ZXJhYmxlIG9iamVjdC5cbiAqXG4gKiBCZSBzdXJlIHRvIGludm9rZSB0aGUgZnVuY3Rpb24gd2l0aCB0aGUgaXRlcmFibGUgYXMgY29udGV4dDpcbiAqXG4gKiAgICAgdmFyIGl0ZXJhdG9yRm4gPSBnZXRJdGVyYXRvckZuKG15SXRlcmFibGUpO1xuICogICAgIGlmIChpdGVyYXRvckZuKSB7XG4gKiAgICAgICB2YXIgaXRlcmF0b3IgPSBpdGVyYXRvckZuLmNhbGwobXlJdGVyYWJsZSk7XG4gKiAgICAgICAuLi5cbiAqICAgICB9XG4gKlxuICogQHBhcmFtIHs/b2JqZWN0fSBtYXliZUl0ZXJhYmxlXG4gKiBAcmV0dXJuIHs/ZnVuY3Rpb259XG4gKi9cbmZ1bmN0aW9uIGdldEl0ZXJhdG9yRm4obWF5YmVJdGVyYWJsZSkge1xuICB2YXIgaXRlcmF0b3JGbiA9IG1heWJlSXRlcmFibGUgJiYgKElURVJBVE9SX1NZTUJPTCAmJiBtYXliZUl0ZXJhYmxlW0lURVJBVE9SX1NZTUJPTF0gfHwgbWF5YmVJdGVyYWJsZVtGQVVYX0lURVJBVE9SX1NZTUJPTF0pO1xuICBpZiAodHlwZW9mIGl0ZXJhdG9yRm4gPT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gaXRlcmF0b3JGbjtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGdldEl0ZXJhdG9yRm47IiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxNC0yMDE1LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBGb3JrZWQgZnJvbSBmYmpzL3dhcm5pbmc6XG4gKiBodHRwczovL2dpdGh1Yi5jb20vZmFjZWJvb2svZmJqcy9ibG9iL2U2NmJhMjBhZDViZTQzM2ViNTQ0MjNmMmIwOTdkODI5MzI0ZDlkZTYvcGFja2FnZXMvZmJqcy9zcmMvX19mb3Jrc19fL3dhcm5pbmcuanNcbiAqXG4gKiBPbmx5IGNoYW5nZSBpcyB3ZSB1c2UgY29uc29sZS53YXJuIGluc3RlYWQgb2YgY29uc29sZS5lcnJvcixcbiAqIGFuZCBkbyBub3RoaW5nIHdoZW4gJ2NvbnNvbGUnIGlzIG5vdCBzdXBwb3J0ZWQuXG4gKiBUaGlzIHJlYWxseSBzaW1wbGlmaWVzIHRoZSBjb2RlLlxuICogLS0tXG4gKiBTaW1pbGFyIHRvIGludmFyaWFudCBidXQgb25seSBsb2dzIGEgd2FybmluZyBpZiB0aGUgY29uZGl0aW9uIGlzIG5vdCBtZXQuXG4gKiBUaGlzIGNhbiBiZSB1c2VkIHRvIGxvZyBpc3N1ZXMgaW4gZGV2ZWxvcG1lbnQgZW52aXJvbm1lbnRzIGluIGNyaXRpY2FsXG4gKiBwYXRocy4gUmVtb3ZpbmcgdGhlIGxvZ2dpbmcgY29kZSBmb3IgcHJvZHVjdGlvbiBlbnZpcm9ubWVudHMgd2lsbCBrZWVwIHRoZVxuICogc2FtZSBsb2dpYyBhbmQgZm9sbG93IHRoZSBzYW1lIGNvZGUgcGF0aHMuXG4gKi9cblxudmFyIGxvd1ByaW9yaXR5V2FybmluZyA9IGZ1bmN0aW9uICgpIHt9O1xuXG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICB2YXIgcHJpbnRXYXJuaW5nID0gZnVuY3Rpb24gKGZvcm1hdCkge1xuICAgIGZvciAodmFyIF9sZW4gPSBhcmd1bWVudHMubGVuZ3RoLCBhcmdzID0gQXJyYXkoX2xlbiA+IDEgPyBfbGVuIC0gMSA6IDApLCBfa2V5ID0gMTsgX2tleSA8IF9sZW47IF9rZXkrKykge1xuICAgICAgYXJnc1tfa2V5IC0gMV0gPSBhcmd1bWVudHNbX2tleV07XG4gICAgfVxuXG4gICAgdmFyIGFyZ0luZGV4ID0gMDtcbiAgICB2YXIgbWVzc2FnZSA9ICdXYXJuaW5nOiAnICsgZm9ybWF0LnJlcGxhY2UoLyVzL2csIGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBhcmdzW2FyZ0luZGV4KytdO1xuICAgIH0pO1xuICAgIGlmICh0eXBlb2YgY29uc29sZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGNvbnNvbGUud2FybihtZXNzYWdlKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgIC8vIC0tLSBXZWxjb21lIHRvIGRlYnVnZ2luZyBSZWFjdCAtLS1cbiAgICAgIC8vIFRoaXMgZXJyb3Igd2FzIHRocm93biBhcyBhIGNvbnZlbmllbmNlIHNvIHRoYXQgeW91IGNhbiB1c2UgdGhpcyBzdGFja1xuICAgICAgLy8gdG8gZmluZCB0aGUgY2FsbHNpdGUgdGhhdCBjYXVzZWQgdGhpcyB3YXJuaW5nIHRvIGZpcmUuXG4gICAgICB0aHJvdyBuZXcgRXJyb3IobWVzc2FnZSk7XG4gICAgfSBjYXRjaCAoeCkge31cbiAgfTtcblxuICBsb3dQcmlvcml0eVdhcm5pbmcgPSBmdW5jdGlvbiAoY29uZGl0aW9uLCBmb3JtYXQpIHtcbiAgICBpZiAoZm9ybWF0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignYHdhcm5pbmcoY29uZGl0aW9uLCBmb3JtYXQsIC4uLmFyZ3MpYCByZXF1aXJlcyBhIHdhcm5pbmcgJyArICdtZXNzYWdlIGFyZ3VtZW50Jyk7XG4gICAgfVxuICAgIGlmICghY29uZGl0aW9uKSB7XG4gICAgICBmb3IgKHZhciBfbGVuMiA9IGFyZ3VtZW50cy5sZW5ndGgsIGFyZ3MgPSBBcnJheShfbGVuMiA+IDIgPyBfbGVuMiAtIDIgOiAwKSwgX2tleTIgPSAyOyBfa2V5MiA8IF9sZW4yOyBfa2V5MisrKSB7XG4gICAgICAgIGFyZ3NbX2tleTIgLSAyXSA9IGFyZ3VtZW50c1tfa2V5Ml07XG4gICAgICB9XG5cbiAgICAgIHByaW50V2FybmluZy5hcHBseSh1bmRlZmluZWQsIFtmb3JtYXRdLmNvbmNhdChhcmdzKSk7XG4gICAgfVxuICB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGxvd1ByaW9yaXR5V2FybmluZzsiLCIvKipcbiAqIENvcHlyaWdodCAyMDEzLXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIF9wcm9kSW52YXJpYW50ID0gcmVxdWlyZSgnLi9yZWFjdFByb2RJbnZhcmlhbnQnKTtcblxudmFyIFJlYWN0RWxlbWVudCA9IHJlcXVpcmUoJy4vUmVhY3RFbGVtZW50Jyk7XG5cbnZhciBpbnZhcmlhbnQgPSByZXF1aXJlKCdmYmpzL2xpYi9pbnZhcmlhbnQnKTtcblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBmaXJzdCBjaGlsZCBpbiBhIGNvbGxlY3Rpb24gb2YgY2hpbGRyZW4gYW5kIHZlcmlmaWVzIHRoYXQgdGhlcmVcbiAqIGlzIG9ubHkgb25lIGNoaWxkIGluIHRoZSBjb2xsZWN0aW9uLlxuICpcbiAqIFNlZSBodHRwczovL2ZhY2Vib29rLmdpdGh1Yi5pby9yZWFjdC9kb2NzL3RvcC1sZXZlbC1hcGkuaHRtbCNyZWFjdC5jaGlsZHJlbi5vbmx5XG4gKlxuICogVGhlIGN1cnJlbnQgaW1wbGVtZW50YXRpb24gb2YgdGhpcyBmdW5jdGlvbiBhc3N1bWVzIHRoYXQgYSBzaW5nbGUgY2hpbGQgZ2V0c1xuICogcGFzc2VkIHdpdGhvdXQgYSB3cmFwcGVyLCBidXQgdGhlIHB1cnBvc2Ugb2YgdGhpcyBoZWxwZXIgZnVuY3Rpb24gaXMgdG9cbiAqIGFic3RyYWN0IGF3YXkgdGhlIHBhcnRpY3VsYXIgc3RydWN0dXJlIG9mIGNoaWxkcmVuLlxuICpcbiAqIEBwYXJhbSB7P29iamVjdH0gY2hpbGRyZW4gQ2hpbGQgY29sbGVjdGlvbiBzdHJ1Y3R1cmUuXG4gKiBAcmV0dXJuIHtSZWFjdEVsZW1lbnR9IFRoZSBmaXJzdCBhbmQgb25seSBgUmVhY3RFbGVtZW50YCBjb250YWluZWQgaW4gdGhlXG4gKiBzdHJ1Y3R1cmUuXG4gKi9cbmZ1bmN0aW9uIG9ubHlDaGlsZChjaGlsZHJlbikge1xuICAhUmVhY3RFbGVtZW50LmlzVmFsaWRFbGVtZW50KGNoaWxkcmVuKSA/IHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyBpbnZhcmlhbnQoZmFsc2UsICdSZWFjdC5DaGlsZHJlbi5vbmx5IGV4cGVjdGVkIHRvIHJlY2VpdmUgYSBzaW5nbGUgUmVhY3QgZWxlbWVudCBjaGlsZC4nKSA6IF9wcm9kSW52YXJpYW50KCcxNDMnKSA6IHZvaWQgMDtcbiAgcmV0dXJuIGNoaWxkcmVuO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IG9ubHlDaGlsZDsiLCIvKipcbiAqIENvcHlyaWdodCAoYykgMjAxMy1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICogXG4gKi9cbid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBXQVJOSU5HOiBETyBOT1QgbWFudWFsbHkgcmVxdWlyZSB0aGlzIG1vZHVsZS5cbiAqIFRoaXMgaXMgYSByZXBsYWNlbWVudCBmb3IgYGludmFyaWFudCguLi4pYCB1c2VkIGJ5IHRoZSBlcnJvciBjb2RlIHN5c3RlbVxuICogYW5kIHdpbGwgX29ubHlfIGJlIHJlcXVpcmVkIGJ5IHRoZSBjb3JyZXNwb25kaW5nIGJhYmVsIHBhc3MuXG4gKiBJdCBhbHdheXMgdGhyb3dzLlxuICovXG5cbmZ1bmN0aW9uIHJlYWN0UHJvZEludmFyaWFudChjb2RlKSB7XG4gIHZhciBhcmdDb3VudCA9IGFyZ3VtZW50cy5sZW5ndGggLSAxO1xuXG4gIHZhciBtZXNzYWdlID0gJ01pbmlmaWVkIFJlYWN0IGVycm9yICMnICsgY29kZSArICc7IHZpc2l0ICcgKyAnaHR0cDovL2ZhY2Vib29rLmdpdGh1Yi5pby9yZWFjdC9kb2NzL2Vycm9yLWRlY29kZXIuaHRtbD9pbnZhcmlhbnQ9JyArIGNvZGU7XG5cbiAgZm9yICh2YXIgYXJnSWR4ID0gMDsgYXJnSWR4IDwgYXJnQ291bnQ7IGFyZ0lkeCsrKSB7XG4gICAgbWVzc2FnZSArPSAnJmFyZ3NbXT0nICsgZW5jb2RlVVJJQ29tcG9uZW50KGFyZ3VtZW50c1thcmdJZHggKyAxXSk7XG4gIH1cblxuICBtZXNzYWdlICs9ICcgZm9yIHRoZSBmdWxsIG1lc3NhZ2Ugb3IgdXNlIHRoZSBub24tbWluaWZpZWQgZGV2IGVudmlyb25tZW50JyArICcgZm9yIGZ1bGwgZXJyb3JzIGFuZCBhZGRpdGlvbmFsIGhlbHBmdWwgd2FybmluZ3MuJztcblxuICB2YXIgZXJyb3IgPSBuZXcgRXJyb3IobWVzc2FnZSk7XG4gIGVycm9yLm5hbWUgPSAnSW52YXJpYW50IFZpb2xhdGlvbic7XG4gIGVycm9yLmZyYW1lc1RvUG9wID0gMTsgLy8gd2UgZG9uJ3QgY2FyZSBhYm91dCByZWFjdFByb2RJbnZhcmlhbnQncyBvd24gZnJhbWVcblxuICB0aHJvdyBlcnJvcjtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSByZWFjdFByb2RJbnZhcmlhbnQ7IiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxMy1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIF9wcm9kSW52YXJpYW50ID0gcmVxdWlyZSgnLi9yZWFjdFByb2RJbnZhcmlhbnQnKTtcblxudmFyIFJlYWN0Q3VycmVudE93bmVyID0gcmVxdWlyZSgnLi9SZWFjdEN1cnJlbnRPd25lcicpO1xudmFyIFJFQUNUX0VMRU1FTlRfVFlQRSA9IHJlcXVpcmUoJy4vUmVhY3RFbGVtZW50U3ltYm9sJyk7XG5cbnZhciBnZXRJdGVyYXRvckZuID0gcmVxdWlyZSgnLi9nZXRJdGVyYXRvckZuJyk7XG52YXIgaW52YXJpYW50ID0gcmVxdWlyZSgnZmJqcy9saWIvaW52YXJpYW50Jyk7XG52YXIgS2V5RXNjYXBlVXRpbHMgPSByZXF1aXJlKCcuL0tleUVzY2FwZVV0aWxzJyk7XG52YXIgd2FybmluZyA9IHJlcXVpcmUoJ2ZianMvbGliL3dhcm5pbmcnKTtcblxudmFyIFNFUEFSQVRPUiA9ICcuJztcbnZhciBTVUJTRVBBUkFUT1IgPSAnOic7XG5cbi8qKlxuICogVGhpcyBpcyBpbmxpbmVkIGZyb20gUmVhY3RFbGVtZW50IHNpbmNlIHRoaXMgZmlsZSBpcyBzaGFyZWQgYmV0d2VlblxuICogaXNvbW9ycGhpYyBhbmQgcmVuZGVyZXJzLiBXZSBjb3VsZCBleHRyYWN0IHRoaXMgdG8gYVxuICpcbiAqL1xuXG4vKipcbiAqIFRPRE86IFRlc3QgdGhhdCBhIHNpbmdsZSBjaGlsZCBhbmQgYW4gYXJyYXkgd2l0aCBvbmUgaXRlbSBoYXZlIHRoZSBzYW1lIGtleVxuICogcGF0dGVybi5cbiAqL1xuXG52YXIgZGlkV2FybkFib3V0TWFwcyA9IGZhbHNlO1xuXG4vKipcbiAqIEdlbmVyYXRlIGEga2V5IHN0cmluZyB0aGF0IGlkZW50aWZpZXMgYSBjb21wb25lbnQgd2l0aGluIGEgc2V0LlxuICpcbiAqIEBwYXJhbSB7Kn0gY29tcG9uZW50IEEgY29tcG9uZW50IHRoYXQgY291bGQgY29udGFpbiBhIG1hbnVhbCBrZXkuXG4gKiBAcGFyYW0ge251bWJlcn0gaW5kZXggSW5kZXggdGhhdCBpcyB1c2VkIGlmIGEgbWFudWFsIGtleSBpcyBub3QgcHJvdmlkZWQuXG4gKiBAcmV0dXJuIHtzdHJpbmd9XG4gKi9cbmZ1bmN0aW9uIGdldENvbXBvbmVudEtleShjb21wb25lbnQsIGluZGV4KSB7XG4gIC8vIERvIHNvbWUgdHlwZWNoZWNraW5nIGhlcmUgc2luY2Ugd2UgY2FsbCB0aGlzIGJsaW5kbHkuIFdlIHdhbnQgdG8gZW5zdXJlXG4gIC8vIHRoYXQgd2UgZG9uJ3QgYmxvY2sgcG90ZW50aWFsIGZ1dHVyZSBFUyBBUElzLlxuICBpZiAoY29tcG9uZW50ICYmIHR5cGVvZiBjb21wb25lbnQgPT09ICdvYmplY3QnICYmIGNvbXBvbmVudC5rZXkgIT0gbnVsbCkge1xuICAgIC8vIEV4cGxpY2l0IGtleVxuICAgIHJldHVybiBLZXlFc2NhcGVVdGlscy5lc2NhcGUoY29tcG9uZW50LmtleSk7XG4gIH1cbiAgLy8gSW1wbGljaXQga2V5IGRldGVybWluZWQgYnkgdGhlIGluZGV4IGluIHRoZSBzZXRcbiAgcmV0dXJuIGluZGV4LnRvU3RyaW5nKDM2KTtcbn1cblxuLyoqXG4gKiBAcGFyYW0gez8qfSBjaGlsZHJlbiBDaGlsZHJlbiB0cmVlIGNvbnRhaW5lci5cbiAqIEBwYXJhbSB7IXN0cmluZ30gbmFtZVNvRmFyIE5hbWUgb2YgdGhlIGtleSBwYXRoIHNvIGZhci5cbiAqIEBwYXJhbSB7IWZ1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayB0byBpbnZva2Ugd2l0aCBlYWNoIGNoaWxkIGZvdW5kLlxuICogQHBhcmFtIHs/Kn0gdHJhdmVyc2VDb250ZXh0IFVzZWQgdG8gcGFzcyBpbmZvcm1hdGlvbiB0aHJvdWdob3V0IHRoZSB0cmF2ZXJzYWxcbiAqIHByb2Nlc3MuXG4gKiBAcmV0dXJuIHshbnVtYmVyfSBUaGUgbnVtYmVyIG9mIGNoaWxkcmVuIGluIHRoaXMgc3VidHJlZS5cbiAqL1xuZnVuY3Rpb24gdHJhdmVyc2VBbGxDaGlsZHJlbkltcGwoY2hpbGRyZW4sIG5hbWVTb0ZhciwgY2FsbGJhY2ssIHRyYXZlcnNlQ29udGV4dCkge1xuICB2YXIgdHlwZSA9IHR5cGVvZiBjaGlsZHJlbjtcblxuICBpZiAodHlwZSA9PT0gJ3VuZGVmaW5lZCcgfHwgdHlwZSA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgLy8gQWxsIG9mIHRoZSBhYm92ZSBhcmUgcGVyY2VpdmVkIGFzIG51bGwuXG4gICAgY2hpbGRyZW4gPSBudWxsO1xuICB9XG5cbiAgaWYgKGNoaWxkcmVuID09PSBudWxsIHx8IHR5cGUgPT09ICdzdHJpbmcnIHx8IHR5cGUgPT09ICdudW1iZXInIHx8XG4gIC8vIFRoZSBmb2xsb3dpbmcgaXMgaW5saW5lZCBmcm9tIFJlYWN0RWxlbWVudC4gVGhpcyBtZWFucyB3ZSBjYW4gb3B0aW1pemVcbiAgLy8gc29tZSBjaGVja3MuIFJlYWN0IEZpYmVyIGFsc28gaW5saW5lcyB0aGlzIGxvZ2ljIGZvciBzaW1pbGFyIHB1cnBvc2VzLlxuICB0eXBlID09PSAnb2JqZWN0JyAmJiBjaGlsZHJlbi4kJHR5cGVvZiA9PT0gUkVBQ1RfRUxFTUVOVF9UWVBFKSB7XG4gICAgY2FsbGJhY2sodHJhdmVyc2VDb250ZXh0LCBjaGlsZHJlbixcbiAgICAvLyBJZiBpdCdzIHRoZSBvbmx5IGNoaWxkLCB0cmVhdCB0aGUgbmFtZSBhcyBpZiBpdCB3YXMgd3JhcHBlZCBpbiBhbiBhcnJheVxuICAgIC8vIHNvIHRoYXQgaXQncyBjb25zaXN0ZW50IGlmIHRoZSBudW1iZXIgb2YgY2hpbGRyZW4gZ3Jvd3MuXG4gICAgbmFtZVNvRmFyID09PSAnJyA/IFNFUEFSQVRPUiArIGdldENvbXBvbmVudEtleShjaGlsZHJlbiwgMCkgOiBuYW1lU29GYXIpO1xuICAgIHJldHVybiAxO1xuICB9XG5cbiAgdmFyIGNoaWxkO1xuICB2YXIgbmV4dE5hbWU7XG4gIHZhciBzdWJ0cmVlQ291bnQgPSAwOyAvLyBDb3VudCBvZiBjaGlsZHJlbiBmb3VuZCBpbiB0aGUgY3VycmVudCBzdWJ0cmVlLlxuICB2YXIgbmV4dE5hbWVQcmVmaXggPSBuYW1lU29GYXIgPT09ICcnID8gU0VQQVJBVE9SIDogbmFtZVNvRmFyICsgU1VCU0VQQVJBVE9SO1xuXG4gIGlmIChBcnJheS5pc0FycmF5KGNoaWxkcmVuKSkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNoaWxkID0gY2hpbGRyZW5baV07XG4gICAgICBuZXh0TmFtZSA9IG5leHROYW1lUHJlZml4ICsgZ2V0Q29tcG9uZW50S2V5KGNoaWxkLCBpKTtcbiAgICAgIHN1YnRyZWVDb3VudCArPSB0cmF2ZXJzZUFsbENoaWxkcmVuSW1wbChjaGlsZCwgbmV4dE5hbWUsIGNhbGxiYWNrLCB0cmF2ZXJzZUNvbnRleHQpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB2YXIgaXRlcmF0b3JGbiA9IGdldEl0ZXJhdG9yRm4oY2hpbGRyZW4pO1xuICAgIGlmIChpdGVyYXRvckZuKSB7XG4gICAgICB2YXIgaXRlcmF0b3IgPSBpdGVyYXRvckZuLmNhbGwoY2hpbGRyZW4pO1xuICAgICAgdmFyIHN0ZXA7XG4gICAgICBpZiAoaXRlcmF0b3JGbiAhPT0gY2hpbGRyZW4uZW50cmllcykge1xuICAgICAgICB2YXIgaWkgPSAwO1xuICAgICAgICB3aGlsZSAoIShzdGVwID0gaXRlcmF0b3IubmV4dCgpKS5kb25lKSB7XG4gICAgICAgICAgY2hpbGQgPSBzdGVwLnZhbHVlO1xuICAgICAgICAgIG5leHROYW1lID0gbmV4dE5hbWVQcmVmaXggKyBnZXRDb21wb25lbnRLZXkoY2hpbGQsIGlpKyspO1xuICAgICAgICAgIHN1YnRyZWVDb3VudCArPSB0cmF2ZXJzZUFsbENoaWxkcmVuSW1wbChjaGlsZCwgbmV4dE5hbWUsIGNhbGxiYWNrLCB0cmF2ZXJzZUNvbnRleHQpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgICAgIHZhciBtYXBzQXNDaGlsZHJlbkFkZGVuZHVtID0gJyc7XG4gICAgICAgICAgaWYgKFJlYWN0Q3VycmVudE93bmVyLmN1cnJlbnQpIHtcbiAgICAgICAgICAgIHZhciBtYXBzQXNDaGlsZHJlbk93bmVyTmFtZSA9IFJlYWN0Q3VycmVudE93bmVyLmN1cnJlbnQuZ2V0TmFtZSgpO1xuICAgICAgICAgICAgaWYgKG1hcHNBc0NoaWxkcmVuT3duZXJOYW1lKSB7XG4gICAgICAgICAgICAgIG1hcHNBc0NoaWxkcmVuQWRkZW5kdW0gPSAnIENoZWNrIHRoZSByZW5kZXIgbWV0aG9kIG9mIGAnICsgbWFwc0FzQ2hpbGRyZW5Pd25lck5hbWUgKyAnYC4nO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nID8gd2FybmluZyhkaWRXYXJuQWJvdXRNYXBzLCAnVXNpbmcgTWFwcyBhcyBjaGlsZHJlbiBpcyBub3QgeWV0IGZ1bGx5IHN1cHBvcnRlZC4gSXQgaXMgYW4gJyArICdleHBlcmltZW50YWwgZmVhdHVyZSB0aGF0IG1pZ2h0IGJlIHJlbW92ZWQuIENvbnZlcnQgaXQgdG8gYSAnICsgJ3NlcXVlbmNlIC8gaXRlcmFibGUgb2Yga2V5ZWQgUmVhY3RFbGVtZW50cyBpbnN0ZWFkLiVzJywgbWFwc0FzQ2hpbGRyZW5BZGRlbmR1bSkgOiB2b2lkIDA7XG4gICAgICAgICAgZGlkV2FybkFib3V0TWFwcyA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gSXRlcmF0b3Igd2lsbCBwcm92aWRlIGVudHJ5IFtrLHZdIHR1cGxlcyByYXRoZXIgdGhhbiB2YWx1ZXMuXG4gICAgICAgIHdoaWxlICghKHN0ZXAgPSBpdGVyYXRvci5uZXh0KCkpLmRvbmUpIHtcbiAgICAgICAgICB2YXIgZW50cnkgPSBzdGVwLnZhbHVlO1xuICAgICAgICAgIGlmIChlbnRyeSkge1xuICAgICAgICAgICAgY2hpbGQgPSBlbnRyeVsxXTtcbiAgICAgICAgICAgIG5leHROYW1lID0gbmV4dE5hbWVQcmVmaXggKyBLZXlFc2NhcGVVdGlscy5lc2NhcGUoZW50cnlbMF0pICsgU1VCU0VQQVJBVE9SICsgZ2V0Q29tcG9uZW50S2V5KGNoaWxkLCAwKTtcbiAgICAgICAgICAgIHN1YnRyZWVDb3VudCArPSB0cmF2ZXJzZUFsbENoaWxkcmVuSW1wbChjaGlsZCwgbmV4dE5hbWUsIGNhbGxiYWNrLCB0cmF2ZXJzZUNvbnRleHQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIHZhciBhZGRlbmR1bSA9ICcnO1xuICAgICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgICAgYWRkZW5kdW0gPSAnIElmIHlvdSBtZWFudCB0byByZW5kZXIgYSBjb2xsZWN0aW9uIG9mIGNoaWxkcmVuLCB1c2UgYW4gYXJyYXkgJyArICdpbnN0ZWFkIG9yIHdyYXAgdGhlIG9iamVjdCB1c2luZyBjcmVhdGVGcmFnbWVudChvYmplY3QpIGZyb20gdGhlICcgKyAnUmVhY3QgYWRkLW9ucy4nO1xuICAgICAgICBpZiAoY2hpbGRyZW4uX2lzUmVhY3RFbGVtZW50KSB7XG4gICAgICAgICAgYWRkZW5kdW0gPSBcIiBJdCBsb29rcyBsaWtlIHlvdSdyZSB1c2luZyBhbiBlbGVtZW50IGNyZWF0ZWQgYnkgYSBkaWZmZXJlbnQgXCIgKyAndmVyc2lvbiBvZiBSZWFjdC4gTWFrZSBzdXJlIHRvIHVzZSBvbmx5IG9uZSBjb3B5IG9mIFJlYWN0Lic7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKFJlYWN0Q3VycmVudE93bmVyLmN1cnJlbnQpIHtcbiAgICAgICAgICB2YXIgbmFtZSA9IFJlYWN0Q3VycmVudE93bmVyLmN1cnJlbnQuZ2V0TmFtZSgpO1xuICAgICAgICAgIGlmIChuYW1lKSB7XG4gICAgICAgICAgICBhZGRlbmR1bSArPSAnIENoZWNrIHRoZSByZW5kZXIgbWV0aG9kIG9mIGAnICsgbmFtZSArICdgLic7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICB2YXIgY2hpbGRyZW5TdHJpbmcgPSBTdHJpbmcoY2hpbGRyZW4pO1xuICAgICAgIWZhbHNlID8gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/IGludmFyaWFudChmYWxzZSwgJ09iamVjdHMgYXJlIG5vdCB2YWxpZCBhcyBhIFJlYWN0IGNoaWxkIChmb3VuZDogJXMpLiVzJywgY2hpbGRyZW5TdHJpbmcgPT09ICdbb2JqZWN0IE9iamVjdF0nID8gJ29iamVjdCB3aXRoIGtleXMgeycgKyBPYmplY3Qua2V5cyhjaGlsZHJlbikuam9pbignLCAnKSArICd9JyA6IGNoaWxkcmVuU3RyaW5nLCBhZGRlbmR1bSkgOiBfcHJvZEludmFyaWFudCgnMzEnLCBjaGlsZHJlblN0cmluZyA9PT0gJ1tvYmplY3QgT2JqZWN0XScgPyAnb2JqZWN0IHdpdGgga2V5cyB7JyArIE9iamVjdC5rZXlzKGNoaWxkcmVuKS5qb2luKCcsICcpICsgJ30nIDogY2hpbGRyZW5TdHJpbmcsIGFkZGVuZHVtKSA6IHZvaWQgMDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gc3VidHJlZUNvdW50O1xufVxuXG4vKipcbiAqIFRyYXZlcnNlcyBjaGlsZHJlbiB0aGF0IGFyZSB0eXBpY2FsbHkgc3BlY2lmaWVkIGFzIGBwcm9wcy5jaGlsZHJlbmAsIGJ1dFxuICogbWlnaHQgYWxzbyBiZSBzcGVjaWZpZWQgdGhyb3VnaCBhdHRyaWJ1dGVzOlxuICpcbiAqIC0gYHRyYXZlcnNlQWxsQ2hpbGRyZW4odGhpcy5wcm9wcy5jaGlsZHJlbiwgLi4uKWBcbiAqIC0gYHRyYXZlcnNlQWxsQ2hpbGRyZW4odGhpcy5wcm9wcy5sZWZ0UGFuZWxDaGlsZHJlbiwgLi4uKWBcbiAqXG4gKiBUaGUgYHRyYXZlcnNlQ29udGV4dGAgaXMgYW4gb3B0aW9uYWwgYXJndW1lbnQgdGhhdCBpcyBwYXNzZWQgdGhyb3VnaCB0aGVcbiAqIGVudGlyZSB0cmF2ZXJzYWwuIEl0IGNhbiBiZSB1c2VkIHRvIHN0b3JlIGFjY3VtdWxhdGlvbnMgb3IgYW55dGhpbmcgZWxzZSB0aGF0XG4gKiB0aGUgY2FsbGJhY2sgbWlnaHQgZmluZCByZWxldmFudC5cbiAqXG4gKiBAcGFyYW0gez8qfSBjaGlsZHJlbiBDaGlsZHJlbiB0cmVlIG9iamVjdC5cbiAqIEBwYXJhbSB7IWZ1bmN0aW9ufSBjYWxsYmFjayBUbyBpbnZva2UgdXBvbiB0cmF2ZXJzaW5nIGVhY2ggY2hpbGQuXG4gKiBAcGFyYW0gez8qfSB0cmF2ZXJzZUNvbnRleHQgQ29udGV4dCBmb3IgdHJhdmVyc2FsLlxuICogQHJldHVybiB7IW51bWJlcn0gVGhlIG51bWJlciBvZiBjaGlsZHJlbiBpbiB0aGlzIHN1YnRyZWUuXG4gKi9cbmZ1bmN0aW9uIHRyYXZlcnNlQWxsQ2hpbGRyZW4oY2hpbGRyZW4sIGNhbGxiYWNrLCB0cmF2ZXJzZUNvbnRleHQpIHtcbiAgaWYgKGNoaWxkcmVuID09IG51bGwpIHtcbiAgICByZXR1cm4gMDtcbiAgfVxuXG4gIHJldHVybiB0cmF2ZXJzZUFsbENoaWxkcmVuSW1wbChjaGlsZHJlbiwgJycsIGNhbGxiYWNrLCB0cmF2ZXJzZUNvbnRleHQpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHRyYXZlcnNlQWxsQ2hpbGRyZW47IiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vbGliL1JlYWN0Jyk7XG4iLCJpbXBvcnQgUmVhY3QsIHsgQ29tcG9uZW50IH0gIGZyb20gJ3JlYWN0JztcblxuXG5jbGFzcyBOYXYgZXh0ZW5kcyBDb21wb25lbnQgeyAgXG5cbiAgICBjb25zdHJ1Y3Rvcihwcm9wcyl7XG4gICAgc3VwZXIocHJvcHMpO1xuICAgIC8vIHRoaXMudGVzdEdldCgpO1xuICAgIH07XG5cbiAgICByZW5kZXIoKXtcbiAgICByZXR1cm4gKFxuICAgICAgICA8bmF2IGlkPVwibWFpbk5hdlwiIGNsYXNzTmFtZT1cIm5hdmJhciBuYXZiYXItZGVmYXVsdCBuYXZiYXItZml4ZWQtdG9wIG5hdmJhci1jdXN0b21cIj5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJjb250YWluZXJcIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibmF2YmFyLWhlYWRlciBwYWdlLXNjcm9sbFwiPlxuICAgICAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3NOYW1lPVwibmF2YmFyLXRvZ2dsZVwiIGRhdGEtdG9nZ2xlPVwiY29sbGFwc2VcIiBkYXRhLXRhcmdldD1cIiNicy1leGFtcGxlLW5hdmJhci1jb2xsYXBzZS0xXCI+XG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwic3Itb25seVwiPlRvZ2dsZSBuYXZpZ2F0aW9uPC9zcGFuPiBNZW51IDxpIGNsYXNzTmFtZT1cImZhIGZhLWJhcnNcIiAvPlxuICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICA8YSBjbGFzc05hbWU9XCJuYXZiYXItYnJhbmRcIiBocmVmPVwiL1wiPkltZ3JhYjwvYT5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJjb2xsYXBzZSBuYXZiYXItY29sbGFwc2VcIiBpZD1cImJzLWV4YW1wbGUtbmF2YmFyLWNvbGxhcHNlLTFcIj5cbiAgICAgICAgICAgIDx1bCBjbGFzc05hbWU9XCJuYXYgbmF2YmFyLW5hdiBuYXZiYXItcmlnaHRcIj5cbiAgICAgICAgICAgICAgICA8bGkgY2xhc3NOYW1lPVwiaGlkZGVuXCI+XG4gICAgICAgICAgICAgICAgPGEgaHJlZj1cIiNwYWdlLXRvcFwiIC8+XG4gICAgICAgICAgICAgICAgPC9saT5cbiAgICAgICAgICAgICAgICA8bGkgY2xhc3NOYW1lPVwicGFnZS1zY3JvbGxcIj5cbiAgICAgICAgICAgICAgICA8YSBocmVmPVwiL2ltYWdlc1wiPk15IEltYWdlczwvYT5cbiAgICAgICAgICAgICAgICA8L2xpPlxuICAgICAgICAgICAgICAgIDxsaSBjbGFzc05hbWU9XCJwYWdlLXNjcm9sbFwiPlxuICAgICAgICAgICAgICAgIDxhIGhyZWY9XCIjXCI+SGVscDwvYT5cbiAgICAgICAgICAgICAgICA8L2xpPlxuICAgICAgICAgICAgICAgIDxsaSBjbGFzc05hbWU9XCJwYWdlLXNjcm9sbFwiPlxuICAgICAgICAgICAgICAgIDxhIGhyZWY9XCIjXCI+Q29udGFjdDwvYT5cbiAgICAgICAgICAgICAgICA8L2xpPlxuICAgICAgICAgICAgPC91bD5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9uYXY+XG4gICAgKTtcbiAgICB9O1xuXG4gICAgLy8gdGVzdEdldCgpIHtcbiAgICAvLyBheGlvcy5nZXQoJ2h0dHA6Ly8xMjcuMC4wLjE6NTAwMC9hcGkvaW1hZ2VzJylcbiAgICAvLyAudGhlbihmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAvLyAgICAgY29uc29sZS5sb2cocmVzcG9uc2UpO1xuICAgIC8vIH0pXG4gICAgLy8gLmNhdGNoKGZ1bmN0aW9uIChlcnJvcikge1xuICAgIC8vICAgICBjb25zb2xlLmxvZyhlcnJvcik7XG4gICAgLy8gfSk7XG4gICAgLy8gfVxuXG59O1xuXG5leHBvcnQgZGVmYXVsdCBOYXZcbiIsImltcG9ydCBheGlvcyBmcm9tICdheGlvcyc7XG5pbXBvcnQgUmVhY3QsIHsgQ29tcG9uZW50IH0gIGZyb20gJ3JlYWN0JztcblxuaW1wb3J0IE5hdiBmcm9tICcuL2NvbXBvbmVudHMvbmF2JztcblxuXG5cblxuXG4vLyBjbGFzcyBQYWdlQ29udGFpbmVyIGV4dGVuZHMgQ29tcG9uZW50IHtcbi8vICAgcmVuZGVyKCkge1xuLy8gICAgIHJldHVybiAoXG4vLyAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInBhZ2UtY29udGFpbmVyXCI+XG4vLyAgICAgICAgIHt0aGlzLnByb3BzLmNoaWxkcmVufVxuLy8gICAgICAgPC9kaXY+XG4vLyAgICAgKTtcbi8vICAgfVxuLy8gfVxuXG5cblxudmFyIFBhZ2VDb250YWluZXIgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG4gIHJlbmRlcigpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJwYWdlLWNvbnRhaW5lclwiPlxuICAgICAgICB7dGhpcy5wcm9wcy5jaGlsZHJlbn1cbiAgICAgIDwvZGl2PlxuICAgICk7XG4gIH1cbn0pO1xuXG52YXIgRHluYW1pY1NlYXJjaCA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcblxuICAvLyBzZXRzIGluaXRpYWwgc3RhdGVcbiAgZ2V0SW5pdGlhbFN0YXRlOiBmdW5jdGlvbigpe1xuICAgIHJldHVybiB7IHNlYXJjaFN0cmluZzogJycgfTtcbiAgfSxcblxuICAvLyBzZXRzIHN0YXRlLCB0cmlnZ2VycyByZW5kZXIgbWV0aG9kXG4gIGhhbmRsZUNoYW5nZTogZnVuY3Rpb24oZXZlbnQpe1xuICAgIC8vIGdyYWIgdmFsdWUgZm9ybSBpbnB1dCBib3hcbiAgICB0aGlzLnNldFN0YXRlKHtzZWFyY2hTdHJpbmc6ZXZlbnQudGFyZ2V0LnZhbHVlfSk7XG4gICAgY29uc29sZS5sb2coXCJzY29wZSB1cGRhdGVkIVwiKTtcbiAgfSxcblxuICByZW5kZXI6IGZ1bmN0aW9uKCkge1xuXG4gICAgdmFyIGNvdW50cmllcyA9IHRoaXMucHJvcHMuaXRlbXM7XG4gICAgdmFyIHNlYXJjaFN0cmluZyA9IHRoaXMuc3RhdGUuc2VhcmNoU3RyaW5nLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuXG4gICAgLy8gZmlsdGVyIGNvdW50cmllcyBsaXN0IGJ5IHZhbHVlIGZyb20gaW5wdXQgYm94XG4gICAgaWYoc2VhcmNoU3RyaW5nLmxlbmd0aCA+IDApe1xuICAgICAgY291bnRyaWVzID0gY291bnRyaWVzLmZpbHRlcihmdW5jdGlvbihjb3VudHJ5KXtcbiAgICAgICAgcmV0dXJuIGNvdW50cnkubmFtZS50b0xvd2VyQ2FzZSgpLm1hdGNoKCBzZWFyY2hTdHJpbmcgKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiAoXG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cInNlYXJjaC1jb21wb25lbnRcIj5cbiAgICAgICAgPGlucHV0IHR5cGU9XCJ0ZXh0XCIgdmFsdWU9e3RoaXMuc3RhdGUuc2VhcmNoU3RyaW5nfSBvbkNoYW5nZT17dGhpcy5oYW5kbGVDaGFuZ2V9IHBsYWNlaG9sZGVyPVwiU2VhcmNoIVwiIC8+XG4gICAgICAgIDx1bD5cbiAgICAgICAgICB7IGNvdW50cmllcy5tYXAoZnVuY3Rpb24oY291bnRyeSl7IHJldHVybiA8bGk+e2NvdW50cnkubmFtZX0gPC9saT4gfSkgfVxuICAgICAgICA8L3VsPlxuICAgICAgPC9kaXY+XG4gICAgKVxuICB9XG5cbn0pO1xuXG4vLyBsaXN0IG9mIGNvdW50cmllcywgZGVmaW5lZCB3aXRoIEphdmFTY3JpcHQgb2JqZWN0IGxpdGVyYWxzXG52YXIgY291bnRyaWVzID0gW1xuICB7XCJuYW1lXCI6IFwiU3dlZGVuXCJ9LCB7XCJuYW1lXCI6IFwiQ2hpbmFcIn0sIHtcIm5hbWVcIjogXCJQZXJ1XCJ9LCB7XCJuYW1lXCI6IFwiQ3plY2ggUmVwdWJsaWNcIn0sXG4gIHtcIm5hbWVcIjogXCJCb2xpdmlhXCJ9LCB7XCJuYW1lXCI6IFwiTGF0dmlhXCJ9LCB7XCJuYW1lXCI6IFwiU2Ftb2FcIn0sIHtcIm5hbWVcIjogXCJBcm1lbmlhXCJ9LFxuICB7XCJuYW1lXCI6IFwiR3JlZW5sYW5kXCJ9LCB7XCJuYW1lXCI6IFwiQ3ViYVwifSwge1wibmFtZVwiOiBcIldlc3Rlcm4gU2FoYXJhXCJ9LCB7XCJuYW1lXCI6IFwiRXRoaW9waWFcIn0sXG4gIHtcIm5hbWVcIjogXCJNYWxheXNpYVwifSwge1wibmFtZVwiOiBcIkFyZ2VudGluYVwifSwge1wibmFtZVwiOiBcIlVnYW5kYVwifSwge1wibmFtZVwiOiBcIkNoaWxlXCJ9LFxuICB7XCJuYW1lXCI6IFwiQXJ1YmFcIn0sIHtcIm5hbWVcIjogXCJKYXBhblwifSwge1wibmFtZVwiOiBcIlRyaW5pZGFkIGFuZCBUb2JhZ29cIn0sIHtcIm5hbWVcIjogXCJJdGFseVwifSxcbiAge1wibmFtZVwiOiBcIkNhbWJvZGlhXCJ9LCB7XCJuYW1lXCI6IFwiSWNlbGFuZFwifSwge1wibmFtZVwiOiBcIkRvbWluaWNhbiBSZXB1YmxpY1wifSwge1wibmFtZVwiOiBcIlR1cmtleVwifSxcbiAge1wibmFtZVwiOiBcIlNwYWluXCJ9LCB7XCJuYW1lXCI6IFwiUG9sYW5kXCJ9LCB7XCJuYW1lXCI6IFwiSGFpdGlcIn1cbl07XG5cblxuXG52YXIgSW1hZ2VHcmlkID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuICByZW5kZXI6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiAoXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicm93XCIgaWQ9XCJpbWFnZV9jb250YWluZXJcIj5cbiAgICAgICAgPC9kaXY+XG4gICAgKTtcbiAgfVxufSk7XG4gIFxuXG5cbmxldCBNYWluQ29udGVudCA9IChcbiAgPGRpdj5cbiAgICA8TmF2IC8+XG4gICAgPFBhZ2VDb250YWluZXI+XG4gICAgICA8RHluYW1pY1NlYXJjaCBpdGVtcz17IGNvdW50cmllcyB9IC8+XG4gICAgPC9QYWdlQ29udGFpbmVyPlxuICA8L2Rpdj5cbik7XG5cblJlYWN0RE9NLnJlbmRlcihcbiAgTWFpbkNvbnRlbnQgLCBcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJhcHAtY29udGFpbmVyXCIpXG4pO1xuXG4vLyB2YXIgTWFpbkNvbnRlbnQgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG4vLyAgICAgcmVuZGVyOiBmdW5jdGlvbigpe1xuLy8gICAgICAgICByZXR1cm4gKFxuLy8gICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtYWluLWNvbnRlbnRcIj5cbi8vICAgICAgICAgICAgICAgPE5hdiAvPlxuLy8gICAgICAgICAgICAgICA8UGFnZUNvbnRhaW5lcj5cbi8vICAgICAgICAgICAgICAgICA8RHluYW1pY1NlYXJjaCBpdGVtcz17IGNvdW50cmllcyB9IC8+XG4vLyAgICAgICAgICAgICAgIDwvUGFnZUNvbnRhaW5lcj5cbi8vICAgICAgICAgICAgIDwvZGl2PlxuLy8gICAgICAgICApXG4vLyAgICAgfVxuLy8gfSk7XG5cblxuXG4vLyBSZWFjdERPTS5yZW5kZXIoXG4vLyAgIDxNYWluQ29udGVudCAvPiwgXG4vLyAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYXBwLWNvbnRhaW5lclwiKVxuLy8gKTsiXSwicHJlRXhpc3RpbmdDb21tZW50IjoiLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ9dXRmLTg7YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0p6YjNWeVkyVnpJanBiSW01dlpHVmZiVzlrZFd4bGN5OWljbTkzYzJWeUxYQmhZMnN2WDNCeVpXeDFaR1V1YW5NaUxDSnViMlJsWDIxdlpIVnNaWE12WVhocGIzTXZhVzVrWlhndWFuTWlMQ0p1YjJSbFgyMXZaSFZzWlhNdllYaHBiM012YkdsaUwyRmtZWEIwWlhKekwzaG9jaTVxY3lJc0ltNXZaR1ZmYlc5a2RXeGxjeTloZUdsdmN5OXNhV0l2WVhocGIzTXVhbk1pTENKdWIyUmxYMjF2WkhWc1pYTXZZWGhwYjNNdmJHbGlMMk5oYm1ObGJDOURZVzVqWld3dWFuTWlMQ0p1YjJSbFgyMXZaSFZzWlhNdllYaHBiM012YkdsaUwyTmhibU5sYkM5RFlXNWpaV3hVYjJ0bGJpNXFjeUlzSW01dlpHVmZiVzlrZFd4bGN5OWhlR2x2Y3k5c2FXSXZZMkZ1WTJWc0wybHpRMkZ1WTJWc0xtcHpJaXdpYm05a1pWOXRiMlIxYkdWekwyRjRhVzl6TDJ4cFlpOWpiM0psTDBGNGFXOXpMbXB6SWl3aWJtOWtaVjl0YjJSMWJHVnpMMkY0YVc5ekwyeHBZaTlqYjNKbEwwbHVkR1Z5WTJWd2RHOXlUV0Z1WVdkbGNpNXFjeUlzSW01dlpHVmZiVzlrZFd4bGN5OWhlR2x2Y3k5c2FXSXZZMjl5WlM5amNtVmhkR1ZGY25KdmNpNXFjeUlzSW01dlpHVmZiVzlrZFd4bGN5OWhlR2x2Y3k5c2FXSXZZMjl5WlM5a2FYTndZWFJqYUZKbGNYVmxjM1F1YW5NaUxDSnViMlJsWDIxdlpIVnNaWE12WVhocGIzTXZiR2xpTDJOdmNtVXZaVzVvWVc1alpVVnljbTl5TG1weklpd2libTlrWlY5dGIyUjFiR1Z6TDJGNGFXOXpMMnhwWWk5amIzSmxMM05sZEhSc1pTNXFjeUlzSW01dlpHVmZiVzlrZFd4bGN5OWhlR2x2Y3k5c2FXSXZZMjl5WlM5MGNtRnVjMlp2Y20xRVlYUmhMbXB6SWl3aWJtOWtaVjl0YjJSMWJHVnpMMkY0YVc5ekwyeHBZaTlrWldaaGRXeDBjeTVxY3lJc0ltNXZaR1ZmYlc5a2RXeGxjeTloZUdsdmN5OXNhV0l2YUdWc2NHVnljeTlpYVc1a0xtcHpJaXdpYm05a1pWOXRiMlIxYkdWekwyRjRhVzl6TDJ4cFlpOW9aV3h3WlhKekwySjBiMkV1YW5NaUxDSnViMlJsWDIxdlpIVnNaWE12WVhocGIzTXZiR2xpTDJobGJIQmxjbk12WW5WcGJHUlZVa3d1YW5NaUxDSnViMlJsWDIxdlpIVnNaWE12WVhocGIzTXZiR2xpTDJobGJIQmxjbk12WTI5dFltbHVaVlZTVEhNdWFuTWlMQ0p1YjJSbFgyMXZaSFZzWlhNdllYaHBiM012YkdsaUwyaGxiSEJsY25NdlkyOXZhMmxsY3k1cWN5SXNJbTV2WkdWZmJXOWtkV3hsY3k5aGVHbHZjeTlzYVdJdmFHVnNjR1Z5Y3k5cGMwRmljMjlzZFhSbFZWSk1MbXB6SWl3aWJtOWtaVjl0YjJSMWJHVnpMMkY0YVc5ekwyeHBZaTlvWld4d1pYSnpMMmx6VlZKTVUyRnRaVTl5YVdkcGJpNXFjeUlzSW01dlpHVmZiVzlrZFd4bGN5OWhlR2x2Y3k5c2FXSXZhR1ZzY0dWeWN5OXViM0p0WVd4cGVtVklaV0ZrWlhKT1lXMWxMbXB6SWl3aWJtOWtaVjl0YjJSMWJHVnpMMkY0YVc5ekwyeHBZaTlvWld4d1pYSnpMM0JoY25ObFNHVmhaR1Z5Y3k1cWN5SXNJbTV2WkdWZmJXOWtkV3hsY3k5aGVHbHZjeTlzYVdJdmFHVnNjR1Z5Y3k5emNISmxZV1F1YW5NaUxDSnViMlJsWDIxdlpIVnNaWE12WVhocGIzTXZiR2xpTDNWMGFXeHpMbXB6SWl3aWJtOWtaVjl0YjJSMWJHVnpMMk55WldGMFpTMXlaV0ZqZEMxamJHRnpjeTltWVdOMGIzSjVMbXB6SWl3aWJtOWtaVjl0YjJSMWJHVnpMMk55WldGMFpTMXlaV0ZqZEMxamJHRnpjeTl1YjJSbFgyMXZaSFZzWlhNdmIySnFaV04wTFdGemMybG5iaTlwYm1SbGVDNXFjeUlzSW01dlpHVmZiVzlrZFd4bGN5OW1ZbXB6TDJ4cFlpOWxiWEIwZVVaMWJtTjBhVzl1TG1weklpd2libTlrWlY5dGIyUjFiR1Z6TDJaaWFuTXZiR2xpTDJWdGNIUjVUMkpxWldOMExtcHpJaXdpYm05a1pWOXRiMlIxYkdWekwyWmlhbk12YkdsaUwybHVkbUZ5YVdGdWRDNXFjeUlzSW01dlpHVmZiVzlrZFd4bGN5OW1ZbXB6TDJ4cFlpOTNZWEp1YVc1bkxtcHpJaXdpYm05a1pWOXRiMlIxYkdWekwybHpMV0oxWm1abGNpOXBibVJsZUM1cWN5SXNJbTV2WkdWZmJXOWtkV3hsY3k5d2NtOWpaWE56TDJKeWIzZHpaWEl1YW5NaUxDSnViMlJsWDIxdlpIVnNaWE12Y0hKdmNDMTBlWEJsY3k5amFHVmphMUJ5YjNCVWVYQmxjeTVxY3lJc0ltNXZaR1ZmYlc5a2RXeGxjeTl3Y205d0xYUjVjR1Z6TDJaaFkzUnZjbmt1YW5NaUxDSnViMlJsWDIxdlpIVnNaWE12Y0hKdmNDMTBlWEJsY3k5bVlXTjBiM0o1VjJsMGFGUjVjR1ZEYUdWamEyVnljeTVxY3lJc0ltNXZaR1ZmYlc5a2RXeGxjeTl3Y205d0xYUjVjR1Z6TDJ4cFlpOVNaV0ZqZEZCeWIzQlVlWEJsYzFObFkzSmxkQzVxY3lJc0ltNXZaR1ZmYlc5a2RXeGxjeTl5WldGamRDOXNhV0l2UzJWNVJYTmpZWEJsVlhScGJITXVhbk1pTENKdWIyUmxYMjF2WkhWc1pYTXZjbVZoWTNRdmJHbGlMMUJ2YjJ4bFpFTnNZWE56TG1weklpd2libTlrWlY5dGIyUjFiR1Z6TDNKbFlXTjBMMnhwWWk5U1pXRmpkQzVxY3lJc0ltNXZaR1ZmYlc5a2RXeGxjeTl5WldGamRDOXNhV0l2VW1WaFkzUkNZWE5sUTJ4aGMzTmxjeTVxY3lJc0ltNXZaR1ZmYlc5a2RXeGxjeTl5WldGamRDOXNhV0l2VW1WaFkzUkRhR2xzWkhKbGJpNXFjeUlzSW01dlpHVmZiVzlrZFd4bGN5OXlaV0ZqZEM5c2FXSXZVbVZoWTNSRGIyMXdiMjVsYm5SVWNtVmxTRzl2YXk1cWN5SXNJbTV2WkdWZmJXOWtkV3hsY3k5eVpXRmpkQzlzYVdJdlVtVmhZM1JEZFhKeVpXNTBUM2R1WlhJdWFuTWlMQ0p1YjJSbFgyMXZaSFZzWlhNdmNtVmhZM1F2YkdsaUwxSmxZV04wUkU5TlJtRmpkRzl5YVdWekxtcHpJaXdpYm05a1pWOXRiMlIxYkdWekwzSmxZV04wTDJ4cFlpOVNaV0ZqZEVWc1pXMWxiblF1YW5NaUxDSnViMlJsWDIxdlpIVnNaWE12Y21WaFkzUXZiR2xpTDFKbFlXTjBSV3hsYldWdWRGTjViV0p2YkM1cWN5SXNJbTV2WkdWZmJXOWtkV3hsY3k5eVpXRmpkQzlzYVdJdlVtVmhZM1JGYkdWdFpXNTBWbUZzYVdSaGRHOXlMbXB6SWl3aWJtOWtaVjl0YjJSMWJHVnpMM0psWVdOMEwyeHBZaTlTWldGamRFNXZiM0JWY0dSaGRHVlJkV1YxWlM1cWN5SXNJbTV2WkdWZmJXOWtkV3hsY3k5eVpXRmpkQzlzYVdJdlVtVmhZM1JRY205d1ZIbHdaVXh2WTJGMGFXOXVUbUZ0WlhNdWFuTWlMQ0p1YjJSbFgyMXZaSFZzWlhNdmNtVmhZM1F2YkdsaUwxSmxZV04wVUhKdmNGUjVjR1Z6TG1weklpd2libTlrWlY5dGIyUjFiR1Z6TDNKbFlXTjBMMnhwWWk5U1pXRmpkRkJ5YjNCVWVYQmxjMU5sWTNKbGRDNXFjeUlzSW01dlpHVmZiVzlrZFd4bGN5OXlaV0ZqZEM5c2FXSXZVbVZoWTNSV1pYSnphVzl1TG1weklpd2libTlrWlY5dGIyUjFiR1Z6TDNKbFlXTjBMMnhwWWk5allXNUVaV1pwYm1WUWNtOXdaWEowZVM1cWN5SXNJbTV2WkdWZmJXOWtkV3hsY3k5eVpXRmpkQzlzYVdJdlkyaGxZMnRTWldGamRGUjVjR1ZUY0dWakxtcHpJaXdpYm05a1pWOXRiMlIxYkdWekwzSmxZV04wTDJ4cFlpOWpjbVZoZEdWRGJHRnpjeTVxY3lJc0ltNXZaR1ZmYlc5a2RXeGxjeTl5WldGamRDOXNhV0l2WjJWMFNYUmxjbUYwYjNKR2JpNXFjeUlzSW01dlpHVmZiVzlrZFd4bGN5OXlaV0ZqZEM5c2FXSXZiRzkzVUhKcGIzSnBkSGxYWVhKdWFXNW5MbXB6SWl3aWJtOWtaVjl0YjJSMWJHVnpMM0psWVdOMEwyeHBZaTl2Ym14NVEyaHBiR1F1YW5NaUxDSnViMlJsWDIxdlpIVnNaWE12Y21WaFkzUXZiR2xpTDNKbFlXTjBVSEp2WkVsdWRtRnlhV0Z1ZEM1cWN5SXNJbTV2WkdWZmJXOWtkV3hsY3k5eVpXRmpkQzlzYVdJdmRISmhkbVZ5YzJWQmJHeERhR2xzWkhKbGJpNXFjeUlzSW01dlpHVmZiVzlrZFd4bGN5OXlaV0ZqZEM5eVpXRmpkQzVxY3lJc0luQnliMnBsWTNRdmMzUmhkR2xqTDNOamNtbHdkSE12YW5ONEwyTnZiWEJ2Ym1WdWRITXZibUYyTG1weklpd2ljSEp2YW1WamRDOXpkR0YwYVdNdmMyTnlhWEIwY3k5cWMzZ3ZiV0ZwYmk1cWN5SmRMQ0p1WVcxbGN5STZXMTBzSW0xaGNIQnBibWR6SWpvaVFVRkJRVHRCUTBGQk96czdRVU5CUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVRzN096dEJRM0JNUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CT3p0QlEzQkVRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk96dEJRMjVDUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHM3UVVONlJFRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk96dEJRMHhCTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHM3UVVOMFJrRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUczdRVU53UkVFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN08wRkRiRUpCTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3TzBGREwwVkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk96dEJRM0pDUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdPMEZETVVKQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUczdPMEZEY0VKQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUczdPenRCUXpWR1FUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdPMEZEV0VFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN08wRkRjRU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHM3UVVOd1JVRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk96dEJRMlJCTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUczdRVU55UkVFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CT3p0QlEyUkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUczdRVU53UlVFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3TzBGRFdrRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVRzN1FVTnlRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3TzBGRE0wSkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CT3pzN1FVTXZVMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk96czdPMEZEZURKQ1FUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUczdRVU14UmtFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHM3TzBGRGNrTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPenM3T3p0QlEyeENRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHM3T3pzN1FVTjBSRUU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3T3pzN1FVTXZSRUU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdPMEZEY2tKQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdPenRCUTNoTVFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk96czdPMEZETjBSQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CT3pzN1FVTnlRa0U3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk96czdPMEZEYUdkQ1FUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN08wRkRaRUU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdPenRCUTNwRVFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdPenM3TzBGRE9VZEJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3T3pzN08wRkRiRWxCTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk96czdPMEZETjBsQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk96czdRVU0zVEVFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPenM3TzBGRGVsaEJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPenM3UVVNelFrRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk96czdPenRCUTNaTFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHM3T3p0QlEyNVdRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHM3TzBGRGJFSkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN096czdPMEZETjFCQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CT3pzN096dEJRemRHUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3T3pzN1FVTjJRa0U3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk96dEJRMnBDUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUczdRVU5tUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHM3TzBGRFdrRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3T3pzN08wRkRlRUpCTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN096czdRVU55UmtFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3TzBGRGNrSkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk96czdRVU4yUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN096czdPMEZETDBSQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk96czdPMEZEY0VOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3T3p0QlEzSkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUczdPenM3TzBGRE9VdEJPMEZCUTBFN1FVRkRRVHRCUVVOQk96czdPenM3T3pzN08wRkRTRUU3T3pzN096czdPenM3T3p0SlFVZE5MRWM3T3p0QlFVVkdMR2xDUVVGWkxFdEJRVm9zUlVGQmEwSTdRVUZCUVRzN1FVRkJRU3g1UjBGRFdpeExRVVJaTzBGQlJXeENPMEZCUTBNN096czdhVU5CUlU4N1FVRkRVaXh0UWtGRFNUdEJRVUZCTzBGQlFVRXNhMEpCUVVzc1NVRkJSeXhUUVVGU0xFVkJRV3RDTEZkQlFWVXNjMFJCUVRWQ08wRkJRMEU3UVVGQlFUdEJRVUZCTEhOQ1FVRkxMRmRCUVZVc1YwRkJaanRCUVVOSk8wRkJRVUU3UVVGQlFTd3dRa0ZCU3l4WFFVRlZMREpDUVVGbU8wRkJRMEU3UVVGQlFUdEJRVUZCTERoQ1FVRlJMRTFCUVVzc1VVRkJZaXhGUVVGelFpeFhRVUZWTEdWQlFXaERMRVZCUVdkRUxHVkJRVmtzVlVGQk5VUXNSVUZCZFVVc1pVRkJXU3dyUWtGQmJrWTdRVUZEU1R0QlFVRkJPMEZCUVVFc2EwTkJRVTBzVjBGQlZTeFRRVUZvUWp0QlFVRkJPMEZCUVVFc05rSkJSRW83UVVGQlFUdEJRVU0wUkN4cFJVRkJSeXhYUVVGVkxGbEJRV0k3UVVGRU5VUXNlVUpCUkVFN1FVRkpRVHRCUVVGQk8wRkJRVUVzT0VKQlFVY3NWMEZCVlN4alFVRmlMRVZCUVRSQ0xFMUJRVXNzUjBGQmFrTTdRVUZCUVR0QlFVRkJPMEZCU2tFc2NVSkJSRW83UVVGUFNUdEJRVUZCTzBGQlFVRXNNRUpCUVVzc1YwRkJWU3d3UWtGQlppeEZRVUV3UXl4SlFVRkhMRGhDUVVFM1F6dEJRVU5CTzBGQlFVRTdRVUZCUVN3NFFrRkJTU3hYUVVGVkxEWkNRVUZrTzBGQlEwazdRVUZCUVR0QlFVRkJMR3REUVVGSkxGZEJRVlVzVVVGQlpEdEJRVU5CTEhGRlFVRkhMRTFCUVVzc1YwRkJVanRCUVVSQkxEWkNRVVJLTzBGQlNVazdRVUZCUVR0QlFVRkJMR3REUVVGSkxGZEJRVlVzWVVGQlpEdEJRVU5CTzBGQlFVRTdRVUZCUVN4elEwRkJSeXhOUVVGTExGTkJRVkk3UVVGQlFUdEJRVUZCTzBGQlJFRXNOa0pCU2tvN1FVRlBTVHRCUVVGQk8wRkJRVUVzYTBOQlFVa3NWMEZCVlN4aFFVRmtPMEZCUTBFN1FVRkJRVHRCUVVGQkxITkRRVUZITEUxQlFVc3NSMEZCVWp0QlFVRkJPMEZCUVVFN1FVRkVRU3cyUWtGUVNqdEJRVlZKTzBGQlFVRTdRVUZCUVN4clEwRkJTU3hYUVVGVkxHRkJRV1E3UVVGRFFUdEJRVUZCTzBGQlFVRXNjME5CUVVjc1RVRkJTeXhIUVVGU08wRkJRVUU3UVVGQlFUdEJRVVJCTzBGQlZrbzdRVUZFUVR0QlFWQktPMEZCUkVFc1lVRkVTanRCUVRSQ1F6czdPenM3TzBGQldVbzdPMnRDUVVWakxFYzdPenM3TzBGRGNrUm1PenM3TzBGQlEwRTdPenM3UVVGRlFUczdPenM3TzBGQlRVRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CT3pzN1FVRkpRU3hKUVVGSkxHZENRVUZuUWl4blFrRkJUU3hYUVVGT0xFTkJRV3RDTzBGQlFVRTdRVUZEY0VNc1VVRkViME1zYjBKQlF6TkNPMEZCUTFBc1YwRkRSVHRCUVVGQk8wRkJRVUVzVVVGQlN5eFhRVUZWTEdkQ1FVRm1PMEZCUTBjc1YwRkJTeXhMUVVGTUxFTkJRVmM3UVVGRVpDeExRVVJHTzBGQlMwUTdRVUZRYlVNc1EwRkJiRUlzUTBGQmNFSTdPMEZCVlVFc1NVRkJTU3huUWtGQlowSXNaMEpCUVUwc1YwRkJUaXhEUVVGclFqdEJRVUZCT3pzN1FVRkZjRU03UVVGRFFTeHRRa0ZCYVVJc01rSkJRVlU3UVVGRGVrSXNWMEZCVHl4RlFVRkZMR05CUVdNc1JVRkJhRUlzUlVGQlVEdEJRVU5FTEVkQlRHMURPenRCUVU5d1F6dEJRVU5CTEdkQ1FVRmpMSE5DUVVGVExFdEJRVlFzUlVGQlpUdEJRVU16UWp0QlFVTkJMRk5CUVVzc1VVRkJUQ3hEUVVGakxFVkJRVU1zWTBGQllTeE5RVUZOTEUxQlFVNHNRMEZCWVN4TFFVRXpRaXhGUVVGa08wRkJRMEVzV1VGQlVTeEhRVUZTTEVOQlFWa3NaMEpCUVZvN1FVRkRSQ3hIUVZwdFF6czdRVUZqY0VNc1ZVRkJVU3hyUWtGQlZ6czdRVUZGYWtJc1VVRkJTU3haUVVGWkxFdEJRVXNzUzBGQlRDeERRVUZYTEV0QlFUTkNPMEZCUTBFc1VVRkJTU3hsUVVGbExFdEJRVXNzUzBGQlRDeERRVUZYTEZsQlFWZ3NRMEZCZDBJc1NVRkJlRUlzUjBGQkswSXNWMEZCTDBJc1JVRkJia0k3TzBGQlJVRTdRVUZEUVN4UlFVRkhMR0ZCUVdFc1RVRkJZaXhIUVVGelFpeERRVUY2UWl4RlFVRXlRanRCUVVONlFpeHJRa0ZCV1N4VlFVRlZMRTFCUVZZc1EwRkJhVUlzVlVGQlV5eFBRVUZVTEVWQlFXbENPMEZCUXpWRExHVkJRVThzVVVGQlVTeEpRVUZTTEVOQlFXRXNWMEZCWWl4SFFVRXlRaXhMUVVFelFpeERRVUZyUXl4WlFVRnNReXhEUVVGUU8wRkJRMFFzVDBGR1Z5eERRVUZhTzBGQlIwUTdPMEZCUlVRc1YwRkRSVHRCUVVGQk8wRkJRVUVzVVVGQlN5eFhRVUZWTEd0Q1FVRm1PMEZCUTBVc0swTkJRVThzVFVGQlN5eE5RVUZhTEVWQlFXMUNMRTlCUVU4c1MwRkJTeXhMUVVGTUxFTkJRVmNzV1VGQmNrTXNSVUZCYlVRc1ZVRkJWU3hMUVVGTExGbEJRV3hGTEVWQlFXZEdMR0ZCUVZrc1UwRkJOVVlzUjBGRVJqdEJRVVZGTzBGQlFVRTdRVUZCUVR0QlFVTkpMR3RDUVVGVkxFZEJRVllzUTBGQll5eFZRVUZUTEU5QlFWUXNSVUZCYVVJN1FVRkJSU3hwUWtGQlR6dEJRVUZCTzBGQlFVRTdRVUZCU3l4dlFrRkJVU3hKUVVGaU8wRkJRVUU3UVVGQlFTeFhRVUZRTzBGQlFXbERMRk5CUVd4Rk8wRkJSRW83UVVGR1JpeExRVVJHTzBGQlVVUTdPMEZCYkVOdFF5eERRVUZzUWl4RFFVRndRanM3UVVGelEwRTdRVUZEUVN4SlFVRkpMRmxCUVZrc1EwRkRaQ3hGUVVGRExGRkJRVkVzVVVGQlZDeEZRVVJqTEVWQlEwMHNSVUZCUXl4UlFVRlJMRTlCUVZRc1JVRkVUaXhGUVVONVFpeEZRVUZETEZGQlFWRXNUVUZCVkN4RlFVUjZRaXhGUVVNeVF5eEZRVUZETEZGQlFWRXNaMEpCUVZRc1JVRkVNME1zUlVGRlpDeEZRVUZETEZGQlFWRXNVMEZCVkN4RlFVWmpMRVZCUlU4c1JVRkJReXhSUVVGUkxGRkJRVlFzUlVGR1VDeEZRVVV5UWl4RlFVRkRMRkZCUVZFc1QwRkJWQ3hGUVVZelFpeEZRVVU0UXl4RlFVRkRMRkZCUVZFc1UwRkJWQ3hGUVVZNVF5eEZRVWRrTEVWQlFVTXNVVUZCVVN4WFFVRlVMRVZCU0dNc1JVRkhVeXhGUVVGRExGRkJRVkVzVFVGQlZDeEZRVWhVTEVWQlJ6SkNMRVZCUVVNc1VVRkJVU3huUWtGQlZDeEZRVWd6UWl4RlFVZDFSQ3hGUVVGRExGRkJRVkVzVlVGQlZDeEZRVWgyUkN4RlFVbGtMRVZCUVVNc1VVRkJVU3hWUVVGVUxFVkJTbU1zUlVGSlVTeEZRVUZETEZGQlFWRXNWMEZCVkN4RlFVcFNMRVZCU1N0Q0xFVkJRVU1zVVVGQlVTeFJRVUZVTEVWQlNpOUNMRVZCU1cxRUxFVkJRVU1zVVVGQlVTeFBRVUZVTEVWQlNtNUVMRVZCUzJRc1JVRkJReXhSUVVGUkxFOUJRVlFzUlVGTVl5eEZRVXRMTEVWQlFVTXNVVUZCVVN4UFFVRlVMRVZCVEV3c1JVRkxkMElzUlVGQlF5eFJRVUZSTEhGQ1FVRlVMRVZCVEhoQ0xFVkJTM2xFTEVWQlFVTXNVVUZCVVN4UFFVRlVMRVZCVEhwRUxFVkJUV1FzUlVGQlF5eFJRVUZSTEZWQlFWUXNSVUZPWXl4RlFVMVJMRVZCUVVNc1VVRkJVU3hUUVVGVUxFVkJUbElzUlVGTk5rSXNSVUZCUXl4UlFVRlJMRzlDUVVGVUxFVkJUamRDTEVWQlRUWkVMRVZCUVVNc1VVRkJVU3hSUVVGVUxFVkJUamRFTEVWQlQyUXNSVUZCUXl4UlFVRlJMRTlCUVZRc1JVRlFZeXhGUVU5TExFVkJRVU1zVVVGQlVTeFJRVUZVTEVWQlVFd3NSVUZQZVVJc1JVRkJReXhSUVVGUkxFOUJRVlFzUlVGUWVrSXNRMEZCYUVJN08wRkJXVUVzU1VGQlNTeFpRVUZaTEdkQ1FVRk5MRmRCUVU0c1EwRkJhMEk3UVVGQlFUczdRVUZEYUVNc1ZVRkJVU3hyUWtGQlZ6dEJRVU5xUWl4WFFVTkpMSFZEUVVGTExGZEJRVlVzUzBGQlppeEZRVUZ4UWl4SlFVRkhMR2xDUVVGNFFpeEhRVVJLTzBGQlNVUTdRVUZPSzBJc1EwRkJiRUlzUTBGQmFFSTdPMEZCVjBFc1NVRkJTU3hqUVVOR08wRkJRVUU3UVVGQlFUdEJRVU5GTEc5RVFVUkdPMEZCUlVVN1FVRkJReXhwUWtGQlJEdEJRVUZCTzBGQlEwVXNhME5CUVVNc1lVRkJSQ3hKUVVGbExFOUJRVkVzVTBGQmRrSTdRVUZFUmp0QlFVWkdMRU5CUkVZN08wRkJVMEVzVTBGQlV5eE5RVUZVTEVOQlEwVXNWMEZFUml4RlFVVkZMRk5CUVZNc1kwRkJWQ3hEUVVGM1FpeGxRVUY0UWl4RFFVWkdPenRCUVV0Qk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUczdPMEZCU1VFN1FVRkRRVHRCUVVOQk8wRkJRMEVpTENKbWFXeGxJam9pWjJWdVpYSmhkR1ZrTG1weklpd2ljMjkxY21ObFVtOXZkQ0k2SWlJc0luTnZkWEpqWlhORGIyNTBaVzUwSWpwYklpaG1kVzVqZEdsdmJpQmxLSFFzYml4eUtYdG1kVzVqZEdsdmJpQnpLRzhzZFNsN2FXWW9JVzViYjEwcGUybG1LQ0YwVzI5ZEtYdDJZWElnWVQxMGVYQmxiMllnY21WeGRXbHlaVDA5WENKbWRXNWpkR2x2Ymx3aUppWnlaWEYxYVhKbE8ybG1LQ0YxSmlaaEtYSmxkSFZ5YmlCaEtHOHNJVEFwTzJsbUtHa3BjbVYwZFhKdUlHa29ieXdoTUNrN2RtRnlJR1k5Ym1WM0lFVnljbTl5S0Z3aVEyRnVibTkwSUdacGJtUWdiVzlrZFd4bElDZGNJaXR2SzF3aUoxd2lLVHQwYUhKdmR5Qm1MbU52WkdVOVhDSk5UMFJWVEVWZlRrOVVYMFpQVlU1RVhDSXNabjEyWVhJZ2JEMXVXMjlkUFh0bGVIQnZjblJ6T250OWZUdDBXMjlkV3pCZExtTmhiR3dvYkM1bGVIQnZjblJ6TEdaMWJtTjBhVzl1S0dVcGUzWmhjaUJ1UFhSYmIxMWJNVjFiWlYwN2NtVjBkWEp1SUhNb2JqOXVPbVVwZlN4c0xHd3VaWGh3YjNKMGN5eGxMSFFzYml4eUtYMXlaWFIxY200Z2JsdHZYUzVsZUhCdmNuUnpmWFpoY2lCcFBYUjVjR1Z2WmlCeVpYRjFhWEpsUFQxY0ltWjFibU4wYVc5dVhDSW1KbkpsY1hWcGNtVTdabTl5S0haaGNpQnZQVEE3Ynp4eUxteGxibWQwYUR0dkt5c3BjeWh5VzI5ZEtUdHlaWFIxY200Z2MzMHBJaXdpYlc5a2RXeGxMbVY0Y0c5eWRITWdQU0J5WlhGMWFYSmxLQ2N1TDJ4cFlpOWhlR2x2Y3ljcE95SXNJaWQxYzJVZ2MzUnlhV04wSnp0Y2JseHVkbUZ5SUhWMGFXeHpJRDBnY21WeGRXbHlaU2duTGk4dUxpOTFkR2xzY3ljcE8xeHVkbUZ5SUhObGRIUnNaU0E5SUhKbGNYVnBjbVVvSnk0dkxpNHZZMjl5WlM5elpYUjBiR1VuS1R0Y2JuWmhjaUJpZFdsc1pGVlNUQ0E5SUhKbGNYVnBjbVVvSnk0dkxpNHZhR1ZzY0dWeWN5OWlkV2xzWkZWU1RDY3BPMXh1ZG1GeUlIQmhjbk5sU0dWaFpHVnljeUE5SUhKbGNYVnBjbVVvSnk0dkxpNHZhR1ZzY0dWeWN5OXdZWEp6WlVobFlXUmxjbk1uS1R0Y2JuWmhjaUJwYzFWU1RGTmhiV1ZQY21sbmFXNGdQU0J5WlhGMWFYSmxLQ2N1THk0dUwyaGxiSEJsY25NdmFYTlZVa3hUWVcxbFQzSnBaMmx1SnlrN1hHNTJZWElnWTNKbFlYUmxSWEp5YjNJZ1BTQnlaWEYxYVhKbEtDY3VMaTlqYjNKbEwyTnlaV0YwWlVWeWNtOXlKeWs3WEc1MllYSWdZblJ2WVNBOUlDaDBlWEJsYjJZZ2QybHVaRzkzSUNFOVBTQW5kVzVrWldacGJtVmtKeUFtSmlCM2FXNWtiM2N1WW5SdllTQW1KaUIzYVc1a2IzY3VZblJ2WVM1aWFXNWtLSGRwYm1SdmR5a3BJSHg4SUhKbGNYVnBjbVVvSnk0dkxpNHZhR1ZzY0dWeWN5OWlkRzloSnlrN1hHNWNibTF2WkhWc1pTNWxlSEJ2Y25SeklEMGdablZ1WTNScGIyNGdlR2h5UVdSaGNIUmxjaWhqYjI1bWFXY3BJSHRjYmlBZ2NtVjBkWEp1SUc1bGR5QlFjbTl0YVhObEtHWjFibU4wYVc5dUlHUnBjM0JoZEdOb1dHaHlVbVZ4ZFdWemRDaHlaWE52YkhabExDQnlaV3BsWTNRcElIdGNiaUFnSUNCMllYSWdjbVZ4ZFdWemRFUmhkR0VnUFNCamIyNW1hV2N1WkdGMFlUdGNiaUFnSUNCMllYSWdjbVZ4ZFdWemRFaGxZV1JsY25NZ1BTQmpiMjVtYVdjdWFHVmhaR1Z5Y3p0Y2JseHVJQ0FnSUdsbUlDaDFkR2xzY3k1cGMwWnZjbTFFWVhSaEtISmxjWFZsYzNSRVlYUmhLU2tnZTF4dUlDQWdJQ0FnWkdWc1pYUmxJSEpsY1hWbGMzUklaV0ZrWlhKeld5ZERiMjUwWlc1MExWUjVjR1VuWFRzZ0x5OGdUR1YwSUhSb1pTQmljbTkzYzJWeUlITmxkQ0JwZEZ4dUlDQWdJSDFjYmx4dUlDQWdJSFpoY2lCeVpYRjFaWE4wSUQwZ2JtVjNJRmhOVEVoMGRIQlNaWEYxWlhOMEtDazdYRzRnSUNBZ2RtRnlJR3h2WVdSRmRtVnVkQ0E5SUNkdmJuSmxZV1I1YzNSaGRHVmphR0Z1WjJVbk8xeHVJQ0FnSUhaaGNpQjRSRzl0WVdsdUlEMGdabUZzYzJVN1hHNWNiaUFnSUNBdkx5QkdiM0lnU1VVZ09DODVJRU5QVWxNZ2MzVndjRzl5ZEZ4dUlDQWdJQzh2SUU5dWJIa2djM1Z3Y0c5eWRITWdVRTlUVkNCaGJtUWdSMFZVSUdOaGJHeHpJR0Z1WkNCa2IyVnpiaWQwSUhKbGRIVnlibk1nZEdobElISmxjM0J2Ym5ObElHaGxZV1JsY25NdVhHNGdJQ0FnTHk4Z1JFOU9KMVFnWkc4Z2RHaHBjeUJtYjNJZ2RHVnpkR2x1WnlCaUwyTWdXRTFNU0hSMGNGSmxjWFZsYzNRZ2FYTWdiVzlqYTJWa0xDQnViM1FnV0VSdmJXRnBibEpsY1hWbGMzUXVYRzRnSUNBZ2FXWWdLSEJ5YjJObGMzTXVaVzUyTGs1UFJFVmZSVTVXSUNFOVBTQW5kR1Z6ZENjZ0ppWmNiaUFnSUNBZ0lDQWdkSGx3Wlc5bUlIZHBibVJ2ZHlBaFBUMGdKM1Z1WkdWbWFXNWxaQ2NnSmlaY2JpQWdJQ0FnSUNBZ2QybHVaRzkzTGxoRWIyMWhhVzVTWlhGMVpYTjBJQ1ltSUNFb0ozZHBkR2hEY21Wa1pXNTBhV0ZzY3ljZ2FXNGdjbVZ4ZFdWemRDa2dKaVpjYmlBZ0lDQWdJQ0FnSVdselZWSk1VMkZ0WlU5eWFXZHBiaWhqYjI1bWFXY3VkWEpzS1NrZ2UxeHVJQ0FnSUNBZ2NtVnhkV1Z6ZENBOUlHNWxkeUIzYVc1a2IzY3VXRVJ2YldGcGJsSmxjWFZsYzNRb0tUdGNiaUFnSUNBZ0lHeHZZV1JGZG1WdWRDQTlJQ2R2Ym14dllXUW5PMXh1SUNBZ0lDQWdlRVJ2YldGcGJpQTlJSFJ5ZFdVN1hHNGdJQ0FnSUNCeVpYRjFaWE4wTG05dWNISnZaM0psYzNNZ1BTQm1kVzVqZEdsdmJpQm9ZVzVrYkdWUWNtOW5jbVZ6Y3lncElIdDlPMXh1SUNBZ0lDQWdjbVZ4ZFdWemRDNXZiblJwYldWdmRYUWdQU0JtZFc1amRHbHZiaUJvWVc1a2JHVlVhVzFsYjNWMEtDa2dlMzA3WEc0Z0lDQWdmVnh1WEc0Z0lDQWdMeThnU0ZSVVVDQmlZWE5wWXlCaGRYUm9aVzUwYVdOaGRHbHZibHh1SUNBZ0lHbG1JQ2hqYjI1bWFXY3VZWFYwYUNrZ2UxeHVJQ0FnSUNBZ2RtRnlJSFZ6WlhKdVlXMWxJRDBnWTI5dVptbG5MbUYxZEdndWRYTmxjbTVoYldVZ2ZId2dKeWM3WEc0Z0lDQWdJQ0IyWVhJZ2NHRnpjM2R2Y21RZ1BTQmpiMjVtYVdjdVlYVjBhQzV3WVhOemQyOXlaQ0I4ZkNBbkp6dGNiaUFnSUNBZ0lISmxjWFZsYzNSSVpXRmtaWEp6TGtGMWRHaHZjbWw2WVhScGIyNGdQU0FuUW1GemFXTWdKeUFySUdKMGIyRW9kWE5sY201aGJXVWdLeUFuT2ljZ0t5QndZWE56ZDI5eVpDazdYRzRnSUNBZ2ZWeHVYRzRnSUNBZ2NtVnhkV1Z6ZEM1dmNHVnVLR052Ym1acFp5NXRaWFJvYjJRdWRHOVZjSEJsY2tOaGMyVW9LU3dnWW5WcGJHUlZVa3dvWTI5dVptbG5MblZ5YkN3Z1kyOXVabWxuTG5CaGNtRnRjeXdnWTI5dVptbG5MbkJoY21GdGMxTmxjbWxoYkdsNlpYSXBMQ0IwY25WbEtUdGNibHh1SUNBZ0lDOHZJRk5sZENCMGFHVWdjbVZ4ZFdWemRDQjBhVzFsYjNWMElHbHVJRTFUWEc0Z0lDQWdjbVZ4ZFdWemRDNTBhVzFsYjNWMElEMGdZMjl1Wm1sbkxuUnBiV1Z2ZFhRN1hHNWNiaUFnSUNBdkx5Qk1hWE4wWlc0Z1ptOXlJSEpsWVdSNUlITjBZWFJsWEc0Z0lDQWdjbVZ4ZFdWemRGdHNiMkZrUlhabGJuUmRJRDBnWm5WdVkzUnBiMjRnYUdGdVpHeGxURzloWkNncElIdGNiaUFnSUNBZ0lHbG1JQ2doY21WeGRXVnpkQ0I4ZkNBb2NtVnhkV1Z6ZEM1eVpXRmtlVk4wWVhSbElDRTlQU0EwSUNZbUlDRjRSRzl0WVdsdUtTa2dlMXh1SUNBZ0lDQWdJQ0J5WlhSMWNtNDdYRzRnSUNBZ0lDQjlYRzVjYmlBZ0lDQWdJQzh2SUZSb1pTQnlaWEYxWlhOMElHVnljbTl5WldRZ2IzVjBJR0Z1WkNCM1pTQmthV1J1SjNRZ1oyVjBJR0VnY21WemNHOXVjMlVzSUhSb2FYTWdkMmxzYkNCaVpWeHVJQ0FnSUNBZ0x5OGdhR0Z1Wkd4bFpDQmllU0J2Ym1WeWNtOXlJR2x1YzNSbFlXUmNiaUFnSUNBZ0lDOHZJRmRwZEdnZ2IyNWxJR1Y0WTJWd2RHbHZiam9nY21WeGRXVnpkQ0IwYUdGMElIVnphVzVuSUdacGJHVTZJSEJ5YjNSdlkyOXNMQ0J0YjNOMElHSnliM2R6WlhKelhHNGdJQ0FnSUNBdkx5QjNhV3hzSUhKbGRIVnliaUJ6ZEdGMGRYTWdZWE1nTUNCbGRtVnVJSFJvYjNWbmFDQnBkQ2R6SUdFZ2MzVmpZMlZ6YzJaMWJDQnlaWEYxWlhOMFhHNGdJQ0FnSUNCcFppQW9jbVZ4ZFdWemRDNXpkR0YwZFhNZ1BUMDlJREFnSmlZZ0lTaHlaWEYxWlhOMExuSmxjM0J2Ym5ObFZWSk1JQ1ltSUhKbGNYVmxjM1F1Y21WemNHOXVjMlZWVWt3dWFXNWtaWGhQWmlnblptbHNaVG9uS1NBOVBUMGdNQ2twSUh0Y2JpQWdJQ0FnSUNBZ2NtVjBkWEp1TzF4dUlDQWdJQ0FnZlZ4dVhHNGdJQ0FnSUNBdkx5QlFjbVZ3WVhKbElIUm9aU0J5WlhOd2IyNXpaVnh1SUNBZ0lDQWdkbUZ5SUhKbGMzQnZibk5sU0dWaFpHVnljeUE5SUNkblpYUkJiR3hTWlhOd2IyNXpaVWhsWVdSbGNuTW5JR2x1SUhKbGNYVmxjM1FnUHlCd1lYSnpaVWhsWVdSbGNuTW9jbVZ4ZFdWemRDNW5aWFJCYkd4U1pYTndiMjV6WlVobFlXUmxjbk1vS1NrZ09pQnVkV3hzTzF4dUlDQWdJQ0FnZG1GeUlISmxjM0J2Ym5ObFJHRjBZU0E5SUNGamIyNW1hV2N1Y21WemNHOXVjMlZVZVhCbElIeDhJR052Ym1acFp5NXlaWE53YjI1elpWUjVjR1VnUFQwOUlDZDBaWGgwSnlBL0lISmxjWFZsYzNRdWNtVnpjRzl1YzJWVVpYaDBJRG9nY21WeGRXVnpkQzV5WlhOd2IyNXpaVHRjYmlBZ0lDQWdJSFpoY2lCeVpYTndiMjV6WlNBOUlIdGNiaUFnSUNBZ0lDQWdaR0YwWVRvZ2NtVnpjRzl1YzJWRVlYUmhMRnh1SUNBZ0lDQWdJQ0F2THlCSlJTQnpaVzVrY3lBeE1qSXpJR2x1YzNSbFlXUWdiMllnTWpBMElDaG9kSFJ3Y3pvdkwyZHBkR2gxWWk1amIyMHZiWHBoWW5KcGMydHBaUzloZUdsdmN5OXBjM04xWlhNdk1qQXhLVnh1SUNBZ0lDQWdJQ0J6ZEdGMGRYTTZJSEpsY1hWbGMzUXVjM1JoZEhWeklEMDlQU0F4TWpJeklEOGdNakEwSURvZ2NtVnhkV1Z6ZEM1emRHRjBkWE1zWEc0Z0lDQWdJQ0FnSUhOMFlYUjFjMVJsZUhRNklISmxjWFZsYzNRdWMzUmhkSFZ6SUQwOVBTQXhNakl6SUQ4Z0owNXZJRU52Ym5SbGJuUW5JRG9nY21WeGRXVnpkQzV6ZEdGMGRYTlVaWGgwTEZ4dUlDQWdJQ0FnSUNCb1pXRmtaWEp6T2lCeVpYTndiMjV6WlVobFlXUmxjbk1zWEc0Z0lDQWdJQ0FnSUdOdmJtWnBaem9nWTI5dVptbG5MRnh1SUNBZ0lDQWdJQ0J5WlhGMVpYTjBPaUJ5WlhGMVpYTjBYRzRnSUNBZ0lDQjlPMXh1WEc0Z0lDQWdJQ0J6WlhSMGJHVW9jbVZ6YjJ4MlpTd2djbVZxWldOMExDQnlaWE53YjI1elpTazdYRzVjYmlBZ0lDQWdJQzh2SUVOc1pXRnVJSFZ3SUhKbGNYVmxjM1JjYmlBZ0lDQWdJSEpsY1hWbGMzUWdQU0J1ZFd4c08xeHVJQ0FnSUgwN1hHNWNiaUFnSUNBdkx5QklZVzVrYkdVZ2JHOTNJR3hsZG1Wc0lHNWxkSGR2Y21zZ1pYSnliM0p6WEc0Z0lDQWdjbVZ4ZFdWemRDNXZibVZ5Y205eUlEMGdablZ1WTNScGIyNGdhR0Z1Wkd4bFJYSnliM0lvS1NCN1hHNGdJQ0FnSUNBdkx5QlNaV0ZzSUdWeWNtOXljeUJoY21VZ2FHbGtaR1Z1SUdaeWIyMGdkWE1nWW5rZ2RHaGxJR0p5YjNkelpYSmNiaUFnSUNBZ0lDOHZJRzl1WlhKeWIzSWdjMmh2ZFd4a0lHOXViSGtnWm1seVpTQnBaaUJwZENkeklHRWdibVYwZDI5eWF5Qmxjbkp2Y2x4dUlDQWdJQ0FnY21WcVpXTjBLR055WldGMFpVVnljbTl5S0NkT1pYUjNiM0pySUVWeWNtOXlKeXdnWTI5dVptbG5MQ0J1ZFd4c0xDQnlaWEYxWlhOMEtTazdYRzVjYmlBZ0lDQWdJQzh2SUVOc1pXRnVJSFZ3SUhKbGNYVmxjM1JjYmlBZ0lDQWdJSEpsY1hWbGMzUWdQU0J1ZFd4c08xeHVJQ0FnSUgwN1hHNWNiaUFnSUNBdkx5QklZVzVrYkdVZ2RHbHRaVzkxZEZ4dUlDQWdJSEpsY1hWbGMzUXViMjUwYVcxbGIzVjBJRDBnWm5WdVkzUnBiMjRnYUdGdVpHeGxWR2x0Wlc5MWRDZ3BJSHRjYmlBZ0lDQWdJSEpsYW1WamRDaGpjbVZoZEdWRmNuSnZjaWduZEdsdFpXOTFkQ0J2WmlBbklDc2dZMjl1Wm1sbkxuUnBiV1Z2ZFhRZ0t5QW5iWE1nWlhoalpXVmtaV1FuTENCamIyNW1hV2NzSUNkRlEwOU9Ua0ZDVDFKVVJVUW5MRnh1SUNBZ0lDQWdJQ0J5WlhGMVpYTjBLU2s3WEc1Y2JpQWdJQ0FnSUM4dklFTnNaV0Z1SUhWd0lISmxjWFZsYzNSY2JpQWdJQ0FnSUhKbGNYVmxjM1FnUFNCdWRXeHNPMXh1SUNBZ0lIMDdYRzVjYmlBZ0lDQXZMeUJCWkdRZ2VITnlaaUJvWldGa1pYSmNiaUFnSUNBdkx5QlVhR2x6SUdseklHOXViSGtnWkc5dVpTQnBaaUJ5ZFc1dWFXNW5JR2x1SUdFZ2MzUmhibVJoY21RZ1luSnZkM05sY2lCbGJuWnBjbTl1YldWdWRDNWNiaUFnSUNBdkx5QlRjR1ZqYVdacFkyRnNiSGtnYm05MElHbG1JSGRsSjNKbElHbHVJR0VnZDJWaUlIZHZjbXRsY2l3Z2IzSWdjbVZoWTNRdGJtRjBhWFpsTGx4dUlDQWdJR2xtSUNoMWRHbHNjeTVwYzFOMFlXNWtZWEprUW5KdmQzTmxja1Z1ZGlncEtTQjdYRzRnSUNBZ0lDQjJZWElnWTI5dmEybGxjeUE5SUhKbGNYVnBjbVVvSnk0dkxpNHZhR1ZzY0dWeWN5OWpiMjlyYVdWekp5azdYRzVjYmlBZ0lDQWdJQzh2SUVGa1pDQjRjM0ptSUdobFlXUmxjbHh1SUNBZ0lDQWdkbUZ5SUhoemNtWldZV3gxWlNBOUlDaGpiMjVtYVdjdWQybDBhRU55WldSbGJuUnBZV3h6SUh4OElHbHpWVkpNVTJGdFpVOXlhV2RwYmloamIyNW1hV2N1ZFhKc0tTa2dKaVlnWTI5dVptbG5Mbmh6Y21aRGIyOXJhV1ZPWVcxbElEOWNiaUFnSUNBZ0lDQWdJQ0JqYjI5cmFXVnpMbkpsWVdRb1kyOXVabWxuTG5oemNtWkRiMjlyYVdWT1lXMWxLU0E2WEc0Z0lDQWdJQ0FnSUNBZ2RXNWtaV1pwYm1Wa08xeHVYRzRnSUNBZ0lDQnBaaUFvZUhOeVpsWmhiSFZsS1NCN1hHNGdJQ0FnSUNBZ0lISmxjWFZsYzNSSVpXRmtaWEp6VzJOdmJtWnBaeTU0YzNKbVNHVmhaR1Z5VG1GdFpWMGdQU0I0YzNKbVZtRnNkV1U3WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdmVnh1WEc0Z0lDQWdMeThnUVdSa0lHaGxZV1JsY25NZ2RHOGdkR2hsSUhKbGNYVmxjM1JjYmlBZ0lDQnBaaUFvSjNObGRGSmxjWFZsYzNSSVpXRmtaWEluSUdsdUlISmxjWFZsYzNRcElIdGNiaUFnSUNBZ0lIVjBhV3h6TG1admNrVmhZMmdvY21WeGRXVnpkRWhsWVdSbGNuTXNJR1oxYm1OMGFXOXVJSE5sZEZKbGNYVmxjM1JJWldGa1pYSW9kbUZzTENCclpYa3BJSHRjYmlBZ0lDQWdJQ0FnYVdZZ0tIUjVjR1Z2WmlCeVpYRjFaWE4wUkdGMFlTQTlQVDBnSjNWdVpHVm1hVzVsWkNjZ0ppWWdhMlY1TG5SdlRHOTNaWEpEWVhObEtDa2dQVDA5SUNkamIyNTBaVzUwTFhSNWNHVW5LU0I3WEc0Z0lDQWdJQ0FnSUNBZ0x5OGdVbVZ0YjNabElFTnZiblJsYm5RdFZIbHdaU0JwWmlCa1lYUmhJR2x6SUhWdVpHVm1hVzVsWkZ4dUlDQWdJQ0FnSUNBZ0lHUmxiR1YwWlNCeVpYRjFaWE4wU0dWaFpHVnljMXRyWlhsZE8xeHVJQ0FnSUNBZ0lDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUNBZ0lDQWdJQzh2SUU5MGFHVnlkMmx6WlNCaFpHUWdhR1ZoWkdWeUlIUnZJSFJvWlNCeVpYRjFaWE4wWEc0Z0lDQWdJQ0FnSUNBZ2NtVnhkV1Z6ZEM1elpYUlNaWEYxWlhOMFNHVmhaR1Z5S0d0bGVTd2dkbUZzS1R0Y2JpQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ2ZTazdYRzRnSUNBZ2ZWeHVYRzRnSUNBZ0x5OGdRV1JrSUhkcGRHaERjbVZrWlc1MGFXRnNjeUIwYnlCeVpYRjFaWE4wSUdsbUlHNWxaV1JsWkZ4dUlDQWdJR2xtSUNoamIyNW1hV2N1ZDJsMGFFTnlaV1JsYm5ScFlXeHpLU0I3WEc0Z0lDQWdJQ0J5WlhGMVpYTjBMbmRwZEdoRGNtVmtaVzUwYVdGc2N5QTlJSFJ5ZFdVN1hHNGdJQ0FnZlZ4dVhHNGdJQ0FnTHk4Z1FXUmtJSEpsYzNCdmJuTmxWSGx3WlNCMGJ5QnlaWEYxWlhOMElHbG1JRzVsWldSbFpGeHVJQ0FnSUdsbUlDaGpiMjVtYVdjdWNtVnpjRzl1YzJWVWVYQmxLU0I3WEc0Z0lDQWdJQ0IwY25rZ2UxeHVJQ0FnSUNBZ0lDQnlaWEYxWlhOMExuSmxjM0J2Ym5ObFZIbHdaU0E5SUdOdmJtWnBaeTV5WlhOd2IyNXpaVlI1Y0dVN1hHNGdJQ0FnSUNCOUlHTmhkR05vSUNobEtTQjdYRzRnSUNBZ0lDQWdJQzh2SUVWNGNHVmpkR1ZrSUVSUFRVVjRZMlZ3ZEdsdmJpQjBhSEp2ZDI0Z1lua2dZbkp2ZDNObGNuTWdibTkwSUdOdmJYQmhkR2xpYkdVZ1dFMU1TSFIwY0ZKbGNYVmxjM1FnVEdWMlpXd2dNaTVjYmlBZ0lDQWdJQ0FnTHk4Z1FuVjBMQ0IwYUdseklHTmhiaUJpWlNCemRYQndjbVZ6YzJWa0lHWnZjaUFuYW5OdmJpY2dkSGx3WlNCaGN5QnBkQ0JqWVc0Z1ltVWdjR0Z5YzJWa0lHSjVJR1JsWm1GMWJIUWdKM1J5WVc1elptOXliVkpsYzNCdmJuTmxKeUJtZFc1amRHbHZiaTVjYmlBZ0lDQWdJQ0FnYVdZZ0tHTnZibVpwWnk1eVpYTndiMjV6WlZSNWNHVWdJVDA5SUNkcWMyOXVKeWtnZTF4dUlDQWdJQ0FnSUNBZ0lIUm9jbTkzSUdVN1hHNGdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lIMWNiaUFnSUNCOVhHNWNiaUFnSUNBdkx5QklZVzVrYkdVZ2NISnZaM0psYzNNZ2FXWWdibVZsWkdWa1hHNGdJQ0FnYVdZZ0tIUjVjR1Z2WmlCamIyNW1hV2N1YjI1RWIzZHViRzloWkZCeWIyZHlaWE56SUQwOVBTQW5ablZ1WTNScGIyNG5LU0I3WEc0Z0lDQWdJQ0J5WlhGMVpYTjBMbUZrWkVWMlpXNTBUR2x6ZEdWdVpYSW9KM0J5YjJkeVpYTnpKeXdnWTI5dVptbG5MbTl1Ukc5M2JteHZZV1JRY205bmNtVnpjeWs3WEc0Z0lDQWdmVnh1WEc0Z0lDQWdMeThnVG05MElHRnNiQ0JpY205M2MyVnljeUJ6ZFhCd2IzSjBJSFZ3Ykc5aFpDQmxkbVZ1ZEhOY2JpQWdJQ0JwWmlBb2RIbHdaVzltSUdOdmJtWnBaeTV2YmxWd2JHOWhaRkJ5YjJkeVpYTnpJRDA5UFNBblpuVnVZM1JwYjI0bklDWW1JSEpsY1hWbGMzUXVkWEJzYjJGa0tTQjdYRzRnSUNBZ0lDQnlaWEYxWlhOMExuVndiRzloWkM1aFpHUkZkbVZ1ZEV4cGMzUmxibVZ5S0Nkd2NtOW5jbVZ6Y3ljc0lHTnZibVpwWnk1dmJsVndiRzloWkZCeWIyZHlaWE56S1R0Y2JpQWdJQ0I5WEc1Y2JpQWdJQ0JwWmlBb1kyOXVabWxuTG1OaGJtTmxiRlJ2YTJWdUtTQjdYRzRnSUNBZ0lDQXZMeUJJWVc1a2JHVWdZMkZ1WTJWc2JHRjBhVzl1WEc0Z0lDQWdJQ0JqYjI1bWFXY3VZMkZ1WTJWc1ZHOXJaVzR1Y0hKdmJXbHpaUzUwYUdWdUtHWjFibU4wYVc5dUlHOXVRMkZ1WTJWc1pXUW9ZMkZ1WTJWc0tTQjdYRzRnSUNBZ0lDQWdJR2xtSUNnaGNtVnhkV1Z6ZENrZ2UxeHVJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJqdGNiaUFnSUNBZ0lDQWdmVnh1WEc0Z0lDQWdJQ0FnSUhKbGNYVmxjM1F1WVdKdmNuUW9LVHRjYmlBZ0lDQWdJQ0FnY21WcVpXTjBLR05oYm1ObGJDazdYRzRnSUNBZ0lDQWdJQzh2SUVOc1pXRnVJSFZ3SUhKbGNYVmxjM1JjYmlBZ0lDQWdJQ0FnY21WeGRXVnpkQ0E5SUc1MWJHdzdYRzRnSUNBZ0lDQjlLVHRjYmlBZ0lDQjlYRzVjYmlBZ0lDQnBaaUFvY21WeGRXVnpkRVJoZEdFZ1BUMDlJSFZ1WkdWbWFXNWxaQ2tnZTF4dUlDQWdJQ0FnY21WeGRXVnpkRVJoZEdFZ1BTQnVkV3hzTzF4dUlDQWdJSDFjYmx4dUlDQWdJQzh2SUZObGJtUWdkR2hsSUhKbGNYVmxjM1JjYmlBZ0lDQnlaWEYxWlhOMExuTmxibVFvY21WeGRXVnpkRVJoZEdFcE8xeHVJQ0I5S1R0Y2JuMDdYRzRpTENJbmRYTmxJSE4wY21samRDYzdYRzVjYm5aaGNpQjFkR2xzY3lBOUlISmxjWFZwY21Vb0p5NHZkWFJwYkhNbktUdGNiblpoY2lCaWFXNWtJRDBnY21WeGRXbHlaU2duTGk5b1pXeHdaWEp6TDJKcGJtUW5LVHRjYm5aaGNpQkJlR2x2Y3lBOUlISmxjWFZwY21Vb0p5NHZZMjl5WlM5QmVHbHZjeWNwTzF4dWRtRnlJR1JsWm1GMWJIUnpJRDBnY21WeGRXbHlaU2duTGk5a1pXWmhkV3gwY3ljcE8xeHVYRzR2S2lwY2JpQXFJRU55WldGMFpTQmhiaUJwYm5OMFlXNWpaU0J2WmlCQmVHbHZjMXh1SUNwY2JpQXFJRUJ3WVhKaGJTQjdUMkpxWldOMGZTQmtaV1poZFd4MFEyOXVabWxuSUZSb1pTQmtaV1poZFd4MElHTnZibVpwWnlCbWIzSWdkR2hsSUdsdWMzUmhibU5sWEc0Z0tpQkFjbVYwZFhKdUlIdEJlR2x2YzMwZ1FTQnVaWGNnYVc1emRHRnVZMlVnYjJZZ1FYaHBiM05jYmlBcUwxeHVablZ1WTNScGIyNGdZM0psWVhSbFNXNXpkR0Z1WTJVb1pHVm1ZWFZzZEVOdmJtWnBaeWtnZTF4dUlDQjJZWElnWTI5dWRHVjRkQ0E5SUc1bGR5QkJlR2x2Y3loa1pXWmhkV3gwUTI5dVptbG5LVHRjYmlBZ2RtRnlJR2x1YzNSaGJtTmxJRDBnWW1sdVpDaEJlR2x2Y3k1d2NtOTBiM1I1Y0dVdWNtVnhkV1Z6ZEN3Z1kyOXVkR1Y0ZENrN1hHNWNiaUFnTHk4Z1EyOXdlU0JoZUdsdmN5NXdjbTkwYjNSNWNHVWdkRzhnYVc1emRHRnVZMlZjYmlBZ2RYUnBiSE11WlhoMFpXNWtLR2x1YzNSaGJtTmxMQ0JCZUdsdmN5NXdjbTkwYjNSNWNHVXNJR052Ym5SbGVIUXBPMXh1WEc0Z0lDOHZJRU52Y0hrZ1kyOXVkR1Y0ZENCMGJ5QnBibk4wWVc1alpWeHVJQ0IxZEdsc2N5NWxlSFJsYm1Rb2FXNXpkR0Z1WTJVc0lHTnZiblJsZUhRcE8xeHVYRzRnSUhKbGRIVnliaUJwYm5OMFlXNWpaVHRjYm4xY2JseHVMeThnUTNKbFlYUmxJSFJvWlNCa1pXWmhkV3gwSUdsdWMzUmhibU5sSUhSdklHSmxJR1Y0Y0c5eWRHVmtYRzUyWVhJZ1lYaHBiM01nUFNCamNtVmhkR1ZKYm5OMFlXNWpaU2hrWldaaGRXeDBjeWs3WEc1Y2JpOHZJRVY0Y0c5elpTQkJlR2x2Y3lCamJHRnpjeUIwYnlCaGJHeHZkeUJqYkdGemN5QnBibWhsY21sMFlXNWpaVnh1WVhocGIzTXVRWGhwYjNNZ1BTQkJlR2x2Y3p0Y2JseHVMeThnUm1GamRHOXllU0JtYjNJZ1kzSmxZWFJwYm1jZ2JtVjNJR2x1YzNSaGJtTmxjMXh1WVhocGIzTXVZM0psWVhSbElEMGdablZ1WTNScGIyNGdZM0psWVhSbEtHbHVjM1JoYm1ObFEyOXVabWxuS1NCN1hHNGdJSEpsZEhWeWJpQmpjbVZoZEdWSmJuTjBZVzVqWlNoMWRHbHNjeTV0WlhKblpTaGtaV1poZFd4MGN5d2dhVzV6ZEdGdVkyVkRiMjVtYVdjcEtUdGNibjA3WEc1Y2JpOHZJRVY0Y0c5elpTQkRZVzVqWld3Z0ppQkRZVzVqWld4VWIydGxibHh1WVhocGIzTXVRMkZ1WTJWc0lEMGdjbVZ4ZFdseVpTZ25MaTlqWVc1alpXd3ZRMkZ1WTJWc0p5azdYRzVoZUdsdmN5NURZVzVqWld4VWIydGxiaUE5SUhKbGNYVnBjbVVvSnk0dlkyRnVZMlZzTDBOaGJtTmxiRlJ2YTJWdUp5azdYRzVoZUdsdmN5NXBjME5oYm1ObGJDQTlJSEpsY1hWcGNtVW9KeTR2WTJGdVkyVnNMMmx6UTJGdVkyVnNKeWs3WEc1Y2JpOHZJRVY0Y0c5elpTQmhiR3d2YzNCeVpXRmtYRzVoZUdsdmN5NWhiR3dnUFNCbWRXNWpkR2x2YmlCaGJHd29jSEp2YldselpYTXBJSHRjYmlBZ2NtVjBkWEp1SUZCeWIyMXBjMlV1WVd4c0tIQnliMjFwYzJWektUdGNibjA3WEc1aGVHbHZjeTV6Y0hKbFlXUWdQU0J5WlhGMWFYSmxLQ2N1TDJobGJIQmxjbk12YzNCeVpXRmtKeWs3WEc1Y2JtMXZaSFZzWlM1bGVIQnZjblJ6SUQwZ1lYaHBiM003WEc1Y2JpOHZJRUZzYkc5M0lIVnpaU0J2WmlCa1pXWmhkV3gwSUdsdGNHOXlkQ0J6ZVc1MFlYZ2dhVzRnVkhsd1pWTmpjbWx3ZEZ4dWJXOWtkV3hsTG1WNGNHOXlkSE11WkdWbVlYVnNkQ0E5SUdGNGFXOXpPMXh1SWl3aUozVnpaU0J6ZEhKcFkzUW5PMXh1WEc0dktpcGNiaUFxSUVFZ1lFTmhibU5sYkdBZ2FYTWdZVzRnYjJKcVpXTjBJSFJvWVhRZ2FYTWdkR2h5YjNkdUlIZG9aVzRnWVc0Z2IzQmxjbUYwYVc5dUlHbHpJR05oYm1ObGJHVmtMbHh1SUNwY2JpQXFJRUJqYkdGemMxeHVJQ29nUUhCaGNtRnRJSHR6ZEhKcGJtYzlmU0J0WlhOellXZGxJRlJvWlNCdFpYTnpZV2RsTGx4dUlDb3ZYRzVtZFc1amRHbHZiaUJEWVc1alpXd29iV1Z6YzJGblpTa2dlMXh1SUNCMGFHbHpMbTFsYzNOaFoyVWdQU0J0WlhOellXZGxPMXh1ZlZ4dVhHNURZVzVqWld3dWNISnZkRzkwZVhCbExuUnZVM1J5YVc1bklEMGdablZ1WTNScGIyNGdkRzlUZEhKcGJtY29LU0I3WEc0Z0lISmxkSFZ5YmlBblEyRnVZMlZzSnlBcklDaDBhR2x6TG0xbGMzTmhaMlVnUHlBbk9pQW5JQ3NnZEdocGN5NXRaWE56WVdkbElEb2dKeWNwTzF4dWZUdGNibHh1UTJGdVkyVnNMbkJ5YjNSdmRIbHdaUzVmWDBOQlRrTkZURjlmSUQwZ2RISjFaVHRjYmx4dWJXOWtkV3hsTG1WNGNHOXlkSE1nUFNCRFlXNWpaV3c3WEc0aUxDSW5kWE5sSUhOMGNtbGpkQ2M3WEc1Y2JuWmhjaUJEWVc1alpXd2dQU0J5WlhGMWFYSmxLQ2N1TDBOaGJtTmxiQ2NwTzF4dVhHNHZLaXBjYmlBcUlFRWdZRU5oYm1ObGJGUnZhMlZ1WUNCcGN5QmhiaUJ2WW1wbFkzUWdkR2hoZENCallXNGdZbVVnZFhObFpDQjBieUJ5WlhGMVpYTjBJR05oYm1ObGJHeGhkR2x2YmlCdlppQmhiaUJ2Y0dWeVlYUnBiMjR1WEc0Z0tseHVJQ29nUUdOc1lYTnpYRzRnS2lCQWNHRnlZVzBnZTBaMWJtTjBhVzl1ZlNCbGVHVmpkWFJ2Y2lCVWFHVWdaWGhsWTNWMGIzSWdablZ1WTNScGIyNHVYRzRnS2k5Y2JtWjFibU4wYVc5dUlFTmhibU5sYkZSdmEyVnVLR1Y0WldOMWRHOXlLU0I3WEc0Z0lHbG1JQ2gwZVhCbGIyWWdaWGhsWTNWMGIzSWdJVDA5SUNkbWRXNWpkR2x2YmljcElIdGNiaUFnSUNCMGFISnZkeUJ1WlhjZ1ZIbHdaVVZ5Y205eUtDZGxlR1ZqZFhSdmNpQnRkWE4wSUdKbElHRWdablZ1WTNScGIyNHVKeWs3WEc0Z0lIMWNibHh1SUNCMllYSWdjbVZ6YjJ4MlpWQnliMjFwYzJVN1hHNGdJSFJvYVhNdWNISnZiV2x6WlNBOUlHNWxkeUJRY205dGFYTmxLR1oxYm1OMGFXOXVJSEJ5YjIxcGMyVkZlR1ZqZFhSdmNpaHlaWE52YkhabEtTQjdYRzRnSUNBZ2NtVnpiMngyWlZCeWIyMXBjMlVnUFNCeVpYTnZiSFpsTzF4dUlDQjlLVHRjYmx4dUlDQjJZWElnZEc5clpXNGdQU0IwYUdsek8xeHVJQ0JsZUdWamRYUnZjaWhtZFc1amRHbHZiaUJqWVc1alpXd29iV1Z6YzJGblpTa2dlMXh1SUNBZ0lHbG1JQ2gwYjJ0bGJpNXlaV0Z6YjI0cElIdGNiaUFnSUNBZ0lDOHZJRU5oYm1ObGJHeGhkR2x2YmlCb1lYTWdZV3h5WldGa2VTQmlaV1Z1SUhKbGNYVmxjM1JsWkZ4dUlDQWdJQ0FnY21WMGRYSnVPMXh1SUNBZ0lIMWNibHh1SUNBZ0lIUnZhMlZ1TG5KbFlYTnZiaUE5SUc1bGR5QkRZVzVqWld3b2JXVnpjMkZuWlNrN1hHNGdJQ0FnY21WemIyeDJaVkJ5YjIxcGMyVW9kRzlyWlc0dWNtVmhjMjl1S1R0Y2JpQWdmU2s3WEc1OVhHNWNiaThxS2x4dUlDb2dWR2h5YjNkeklHRWdZRU5oYm1ObGJHQWdhV1lnWTJGdVkyVnNiR0YwYVc5dUlHaGhjeUJpWldWdUlISmxjWFZsYzNSbFpDNWNiaUFxTDF4dVEyRnVZMlZzVkc5clpXNHVjSEp2ZEc5MGVYQmxMblJvY205M1NXWlNaWEYxWlhOMFpXUWdQU0JtZFc1amRHbHZiaUIwYUhKdmQwbG1VbVZ4ZFdWemRHVmtLQ2tnZTF4dUlDQnBaaUFvZEdocGN5NXlaV0Z6YjI0cElIdGNiaUFnSUNCMGFISnZkeUIwYUdsekxuSmxZWE52Ymp0Y2JpQWdmVnh1ZlR0Y2JseHVMeW9xWEc0Z0tpQlNaWFIxY201eklHRnVJRzlpYW1WamRDQjBhR0YwSUdOdmJuUmhhVzV6SUdFZ2JtVjNJR0JEWVc1alpXeFViMnRsYm1BZ1lXNWtJR0VnWm5WdVkzUnBiMjRnZEdoaGRDd2dkMmhsYmlCallXeHNaV1FzWEc0Z0tpQmpZVzVqWld4eklIUm9aU0JnUTJGdVkyVnNWRzlyWlc1Z0xseHVJQ292WEc1RFlXNWpaV3hVYjJ0bGJpNXpiM1Z5WTJVZ1BTQm1kVzVqZEdsdmJpQnpiM1Z5WTJVb0tTQjdYRzRnSUhaaGNpQmpZVzVqWld3N1hHNGdJSFpoY2lCMGIydGxiaUE5SUc1bGR5QkRZVzVqWld4VWIydGxiaWhtZFc1amRHbHZiaUJsZUdWamRYUnZjaWhqS1NCN1hHNGdJQ0FnWTJGdVkyVnNJRDBnWXp0Y2JpQWdmU2s3WEc0Z0lISmxkSFZ5YmlCN1hHNGdJQ0FnZEc5clpXNDZJSFJ2YTJWdUxGeHVJQ0FnSUdOaGJtTmxiRG9nWTJGdVkyVnNYRzRnSUgwN1hHNTlPMXh1WEc1dGIyUjFiR1V1Wlhod2IzSjBjeUE5SUVOaGJtTmxiRlJ2YTJWdU8xeHVJaXdpSjNWelpTQnpkSEpwWTNRbk8xeHVYRzV0YjJSMWJHVXVaWGh3YjNKMGN5QTlJR1oxYm1OMGFXOXVJR2x6UTJGdVkyVnNLSFpoYkhWbEtTQjdYRzRnSUhKbGRIVnliaUFoSVNoMllXeDFaU0FtSmlCMllXeDFaUzVmWDBOQlRrTkZURjlmS1R0Y2JuMDdYRzRpTENJbmRYTmxJSE4wY21samRDYzdYRzVjYm5aaGNpQmtaV1poZFd4MGN5QTlJSEpsY1hWcGNtVW9KeTR2TGk0dlpHVm1ZWFZzZEhNbktUdGNiblpoY2lCMWRHbHNjeUE5SUhKbGNYVnBjbVVvSnk0dkxpNHZkWFJwYkhNbktUdGNiblpoY2lCSmJuUmxjbU5sY0hSdmNrMWhibUZuWlhJZ1BTQnlaWEYxYVhKbEtDY3VMMGx1ZEdWeVkyVndkRzl5VFdGdVlXZGxjaWNwTzF4dWRtRnlJR1JwYzNCaGRHTm9VbVZ4ZFdWemRDQTlJSEpsY1hWcGNtVW9KeTR2WkdsemNHRjBZMmhTWlhGMVpYTjBKeWs3WEc1MllYSWdhWE5CWW5OdmJIVjBaVlZTVENBOUlISmxjWFZwY21Vb0p5NHZMaTR2YUdWc2NHVnljeTlwYzBGaWMyOXNkWFJsVlZKTUp5azdYRzUyWVhJZ1kyOXRZbWx1WlZWU1RITWdQU0J5WlhGMWFYSmxLQ2N1THk0dUwyaGxiSEJsY25NdlkyOXRZbWx1WlZWU1RITW5LVHRjYmx4dUx5b3FYRzRnS2lCRGNtVmhkR1VnWVNCdVpYY2dhVzV6ZEdGdVkyVWdiMllnUVhocGIzTmNiaUFxWEc0Z0tpQkFjR0Z5WVcwZ2UwOWlhbVZqZEgwZ2FXNXpkR0Z1WTJWRGIyNW1hV2NnVkdobElHUmxabUYxYkhRZ1kyOXVabWxuSUdadmNpQjBhR1VnYVc1emRHRnVZMlZjYmlBcUwxeHVablZ1WTNScGIyNGdRWGhwYjNNb2FXNXpkR0Z1WTJWRGIyNW1hV2NwSUh0Y2JpQWdkR2hwY3k1a1pXWmhkV3gwY3lBOUlHbHVjM1JoYm1ObFEyOXVabWxuTzF4dUlDQjBhR2x6TG1sdWRHVnlZMlZ3ZEc5eWN5QTlJSHRjYmlBZ0lDQnlaWEYxWlhOME9pQnVaWGNnU1c1MFpYSmpaWEIwYjNKTllXNWhaMlZ5S0Nrc1hHNGdJQ0FnY21WemNHOXVjMlU2SUc1bGR5QkpiblJsY21ObGNIUnZjazFoYm1GblpYSW9LVnh1SUNCOU8xeHVmVnh1WEc0dktpcGNiaUFxSUVScGMzQmhkR05vSUdFZ2NtVnhkV1Z6ZEZ4dUlDcGNiaUFxSUVCd1lYSmhiU0I3VDJKcVpXTjBmU0JqYjI1bWFXY2dWR2hsSUdOdmJtWnBaeUJ6Y0dWamFXWnBZeUJtYjNJZ2RHaHBjeUJ5WlhGMVpYTjBJQ2h0WlhKblpXUWdkMmwwYUNCMGFHbHpMbVJsWm1GMWJIUnpLVnh1SUNvdlhHNUJlR2x2Y3k1d2NtOTBiM1I1Y0dVdWNtVnhkV1Z6ZENBOUlHWjFibU4wYVc5dUlISmxjWFZsYzNRb1kyOXVabWxuS1NCN1hHNGdJQzhxWlhOc2FXNTBJRzV2TFhCaGNtRnRMWEpsWVhOemFXZHVPakFxTDF4dUlDQXZMeUJCYkd4dmR5Qm1iM0lnWVhocGIzTW9KMlY0WVcxd2JHVXZkWEpzSjFzc0lHTnZibVpwWjEwcElHRWdiR0VnWm1WMFkyZ2dRVkJKWEc0Z0lHbG1JQ2gwZVhCbGIyWWdZMjl1Wm1sbklEMDlQU0FuYzNSeWFXNW5KeWtnZTF4dUlDQWdJR052Ym1acFp5QTlJSFYwYVd4ekxtMWxjbWRsS0h0Y2JpQWdJQ0FnSUhWeWJEb2dZWEpuZFcxbGJuUnpXekJkWEc0Z0lDQWdmU3dnWVhKbmRXMWxiblJ6V3pGZEtUdGNiaUFnZlZ4dVhHNGdJR052Ym1acFp5QTlJSFYwYVd4ekxtMWxjbWRsS0dSbFptRjFiSFJ6TENCMGFHbHpMbVJsWm1GMWJIUnpMQ0I3SUcxbGRHaHZaRG9nSjJkbGRDY2dmU3dnWTI5dVptbG5LVHRjYmlBZ1kyOXVabWxuTG0xbGRHaHZaQ0E5SUdOdmJtWnBaeTV0WlhSb2IyUXVkRzlNYjNkbGNrTmhjMlVvS1R0Y2JseHVJQ0F2THlCVGRYQndiM0owSUdKaGMyVlZVa3dnWTI5dVptbG5YRzRnSUdsbUlDaGpiMjVtYVdjdVltRnpaVlZTVENBbUppQWhhWE5CWW5OdmJIVjBaVlZTVENoamIyNW1hV2N1ZFhKc0tTa2dlMXh1SUNBZ0lHTnZibVpwWnk1MWNtd2dQU0JqYjIxaWFXNWxWVkpNY3loamIyNW1hV2N1WW1GelpWVlNUQ3dnWTI5dVptbG5MblZ5YkNrN1hHNGdJSDFjYmx4dUlDQXZMeUJJYjI5cklIVndJR2x1ZEdWeVkyVndkRzl5Y3lCdGFXUmtiR1YzWVhKbFhHNGdJSFpoY2lCamFHRnBiaUE5SUZ0a2FYTndZWFJqYUZKbGNYVmxjM1FzSUhWdVpHVm1hVzVsWkYwN1hHNGdJSFpoY2lCd2NtOXRhWE5sSUQwZ1VISnZiV2x6WlM1eVpYTnZiSFpsS0dOdmJtWnBaeWs3WEc1Y2JpQWdkR2hwY3k1cGJuUmxjbU5sY0hSdmNuTXVjbVZ4ZFdWemRDNW1iM0pGWVdOb0tHWjFibU4wYVc5dUlIVnVjMmhwWm5SU1pYRjFaWE4wU1c1MFpYSmpaWEIwYjNKektHbHVkR1Z5WTJWd2RHOXlLU0I3WEc0Z0lDQWdZMmhoYVc0dWRXNXphR2xtZENocGJuUmxjbU5sY0hSdmNpNW1kV3htYVd4c1pXUXNJR2x1ZEdWeVkyVndkRzl5TG5KbGFtVmpkR1ZrS1R0Y2JpQWdmU2s3WEc1Y2JpQWdkR2hwY3k1cGJuUmxjbU5sY0hSdmNuTXVjbVZ6Y0c5dWMyVXVabTl5UldGamFDaG1kVzVqZEdsdmJpQndkWE5vVW1WemNHOXVjMlZKYm5SbGNtTmxjSFJ2Y25Nb2FXNTBaWEpqWlhCMGIzSXBJSHRjYmlBZ0lDQmphR0ZwYmk1d2RYTm9LR2x1ZEdWeVkyVndkRzl5TG1aMWJHWnBiR3hsWkN3Z2FXNTBaWEpqWlhCMGIzSXVjbVZxWldOMFpXUXBPMXh1SUNCOUtUdGNibHh1SUNCM2FHbHNaU0FvWTJoaGFXNHViR1Z1WjNSb0tTQjdYRzRnSUNBZ2NISnZiV2x6WlNBOUlIQnliMjFwYzJVdWRHaGxiaWhqYUdGcGJpNXphR2xtZENncExDQmphR0ZwYmk1emFHbG1kQ2dwS1R0Y2JpQWdmVnh1WEc0Z0lISmxkSFZ5YmlCd2NtOXRhWE5sTzF4dWZUdGNibHh1THk4Z1VISnZkbWxrWlNCaGJHbGhjMlZ6SUdadmNpQnpkWEJ3YjNKMFpXUWdjbVZ4ZFdWemRDQnRaWFJvYjJSelhHNTFkR2xzY3k1bWIzSkZZV05vS0ZzblpHVnNaWFJsSnl3Z0oyZGxkQ2NzSUNkb1pXRmtKeXdnSjI5d2RHbHZibk1uWFN3Z1puVnVZM1JwYjI0Z1ptOXlSV0ZqYUUxbGRHaHZaRTV2UkdGMFlTaHRaWFJvYjJRcElIdGNiaUFnTHlwbGMyeHBiblFnWm5WdVl5MXVZVzFsY3pvd0tpOWNiaUFnUVhocGIzTXVjSEp2ZEc5MGVYQmxXMjFsZEdodlpGMGdQU0JtZFc1amRHbHZiaWgxY213c0lHTnZibVpwWnlrZ2UxeHVJQ0FnSUhKbGRIVnliaUIwYUdsekxuSmxjWFZsYzNRb2RYUnBiSE11YldWeVoyVW9ZMjl1Wm1sbklIeDhJSHQ5TENCN1hHNGdJQ0FnSUNCdFpYUm9iMlE2SUcxbGRHaHZaQ3hjYmlBZ0lDQWdJSFZ5YkRvZ2RYSnNYRzRnSUNBZ2ZTa3BPMXh1SUNCOU8xeHVmU2s3WEc1Y2JuVjBhV3h6TG1admNrVmhZMmdvV3lkd2IzTjBKeXdnSjNCMWRDY3NJQ2R3WVhSamFDZGRMQ0JtZFc1amRHbHZiaUJtYjNKRllXTm9UV1YwYUc5a1YybDBhRVJoZEdFb2JXVjBhRzlrS1NCN1hHNGdJQzhxWlhOc2FXNTBJR1oxYm1NdGJtRnRaWE02TUNvdlhHNGdJRUY0YVc5ekxuQnliM1J2ZEhsd1pWdHRaWFJvYjJSZElEMGdablZ1WTNScGIyNG9kWEpzTENCa1lYUmhMQ0JqYjI1bWFXY3BJSHRjYmlBZ0lDQnlaWFIxY200Z2RHaHBjeTV5WlhGMVpYTjBLSFYwYVd4ekxtMWxjbWRsS0dOdmJtWnBaeUI4ZkNCN2ZTd2dlMXh1SUNBZ0lDQWdiV1YwYUc5a09pQnRaWFJvYjJRc1hHNGdJQ0FnSUNCMWNtdzZJSFZ5YkN4Y2JpQWdJQ0FnSUdSaGRHRTZJR1JoZEdGY2JpQWdJQ0I5S1NrN1hHNGdJSDA3WEc1OUtUdGNibHh1Ylc5a2RXeGxMbVY0Y0c5eWRITWdQU0JCZUdsdmN6dGNiaUlzSWlkMWMyVWdjM1J5YVdOMEp6dGNibHh1ZG1GeUlIVjBhV3h6SUQwZ2NtVnhkV2x5WlNnbkxpOHVMaTkxZEdsc2N5Y3BPMXh1WEc1bWRXNWpkR2x2YmlCSmJuUmxjbU5sY0hSdmNrMWhibUZuWlhJb0tTQjdYRzRnSUhSb2FYTXVhR0Z1Wkd4bGNuTWdQU0JiWFR0Y2JuMWNibHh1THlvcVhHNGdLaUJCWkdRZ1lTQnVaWGNnYVc1MFpYSmpaWEIwYjNJZ2RHOGdkR2hsSUhOMFlXTnJYRzRnS2x4dUlDb2dRSEJoY21GdElIdEdkVzVqZEdsdmJuMGdablZzWm1sc2JHVmtJRlJvWlNCbWRXNWpkR2x2YmlCMGJ5Qm9ZVzVrYkdVZ1lIUm9aVzVnSUdadmNpQmhJR0JRY205dGFYTmxZRnh1SUNvZ1FIQmhjbUZ0SUh0R2RXNWpkR2x2Ym4wZ2NtVnFaV04wWldRZ1ZHaGxJR1oxYm1OMGFXOXVJSFJ2SUdoaGJtUnNaU0JnY21WcVpXTjBZQ0JtYjNJZ1lTQmdVSEp2YldselpXQmNiaUFxWEc0Z0tpQkFjbVYwZFhKdUlIdE9kVzFpWlhKOUlFRnVJRWxFSUhWelpXUWdkRzhnY21WdGIzWmxJR2x1ZEdWeVkyVndkRzl5SUd4aGRHVnlYRzRnS2k5Y2JrbHVkR1Z5WTJWd2RHOXlUV0Z1WVdkbGNpNXdjbTkwYjNSNWNHVXVkWE5sSUQwZ1puVnVZM1JwYjI0Z2RYTmxLR1oxYkdacGJHeGxaQ3dnY21WcVpXTjBaV1FwSUh0Y2JpQWdkR2hwY3k1b1lXNWtiR1Z5Y3k1d2RYTm9LSHRjYmlBZ0lDQm1kV3htYVd4c1pXUTZJR1oxYkdacGJHeGxaQ3hjYmlBZ0lDQnlaV3BsWTNSbFpEb2djbVZxWldOMFpXUmNiaUFnZlNrN1hHNGdJSEpsZEhWeWJpQjBhR2x6TG1oaGJtUnNaWEp6TG14bGJtZDBhQ0F0SURFN1hHNTlPMXh1WEc0dktpcGNiaUFxSUZKbGJXOTJaU0JoYmlCcGJuUmxjbU5sY0hSdmNpQm1jbTl0SUhSb1pTQnpkR0ZqYTF4dUlDcGNiaUFxSUVCd1lYSmhiU0I3VG5WdFltVnlmU0JwWkNCVWFHVWdTVVFnZEdoaGRDQjNZWE1nY21WMGRYSnVaV1FnWW5rZ1lIVnpaV0JjYmlBcUwxeHVTVzUwWlhKalpYQjBiM0pOWVc1aFoyVnlMbkJ5YjNSdmRIbHdaUzVsYW1WamRDQTlJR1oxYm1OMGFXOXVJR1ZxWldOMEtHbGtLU0I3WEc0Z0lHbG1JQ2gwYUdsekxtaGhibVJzWlhKelcybGtYU2tnZTF4dUlDQWdJSFJvYVhNdWFHRnVaR3hsY25OYmFXUmRJRDBnYm5Wc2JEdGNiaUFnZlZ4dWZUdGNibHh1THlvcVhHNGdLaUJKZEdWeVlYUmxJRzkyWlhJZ1lXeHNJSFJvWlNCeVpXZHBjM1JsY21Wa0lHbHVkR1Z5WTJWd2RHOXljMXh1SUNwY2JpQXFJRlJvYVhNZ2JXVjBhRzlrSUdseklIQmhjblJwWTNWc1lYSnNlU0IxYzJWbWRXd2dabTl5SUhOcmFYQndhVzVuSUc5MlpYSWdZVzU1WEc0Z0tpQnBiblJsY21ObGNIUnZjbk1nZEdoaGRDQnRZWGtnYUdGMlpTQmlaV052YldVZ1lHNTFiR3hnSUdOaGJHeHBibWNnWUdWcVpXTjBZQzVjYmlBcVhHNGdLaUJBY0dGeVlXMGdlMFoxYm1OMGFXOXVmU0JtYmlCVWFHVWdablZ1WTNScGIyNGdkRzhnWTJGc2JDQm1iM0lnWldGamFDQnBiblJsY21ObGNIUnZjbHh1SUNvdlhHNUpiblJsY21ObGNIUnZjazFoYm1GblpYSXVjSEp2ZEc5MGVYQmxMbVp2Y2tWaFkyZ2dQU0JtZFc1amRHbHZiaUJtYjNKRllXTm9LR1p1S1NCN1hHNGdJSFYwYVd4ekxtWnZja1ZoWTJnb2RHaHBjeTVvWVc1a2JHVnljeXdnWm5WdVkzUnBiMjRnWm05eVJXRmphRWhoYm1Sc1pYSW9hQ2tnZTF4dUlDQWdJR2xtSUNob0lDRTlQU0J1ZFd4c0tTQjdYRzRnSUNBZ0lDQm1iaWhvS1R0Y2JpQWdJQ0I5WEc0Z0lIMHBPMXh1ZlR0Y2JseHViVzlrZFd4bExtVjRjRzl5ZEhNZ1BTQkpiblJsY21ObGNIUnZjazFoYm1GblpYSTdYRzRpTENJbmRYTmxJSE4wY21samRDYzdYRzVjYm5aaGNpQmxibWhoYm1ObFJYSnliM0lnUFNCeVpYRjFhWEpsS0NjdUwyVnVhR0Z1WTJWRmNuSnZjaWNwTzF4dVhHNHZLaXBjYmlBcUlFTnlaV0YwWlNCaGJpQkZjbkp2Y2lCM2FYUm9JSFJvWlNCemNHVmphV1pwWldRZ2JXVnpjMkZuWlN3Z1kyOXVabWxuTENCbGNuSnZjaUJqYjJSbExDQnlaWEYxWlhOMElHRnVaQ0J5WlhOd2IyNXpaUzVjYmlBcVhHNGdLaUJBY0dGeVlXMGdlM04wY21sdVozMGdiV1Z6YzJGblpTQlVhR1VnWlhKeWIzSWdiV1Z6YzJGblpTNWNiaUFxSUVCd1lYSmhiU0I3VDJKcVpXTjBmU0JqYjI1bWFXY2dWR2hsSUdOdmJtWnBaeTVjYmlBcUlFQndZWEpoYlNCN2MzUnlhVzVuZlNCYlkyOWtaVjBnVkdobElHVnljbTl5SUdOdlpHVWdLR1p2Y2lCbGVHRnRjR3hsTENBblJVTlBUazVCUWs5U1ZFVkVKeWt1WEc0Z0tpQkFjR0Z5WVcwZ2UwOWlhbVZqZEgwZ1czSmxjWFZsYzNSZElGUm9aU0J5WlhGMVpYTjBMbHh1SUNvZ1FIQmhjbUZ0SUh0UFltcGxZM1I5SUZ0eVpYTndiMjV6WlYwZ1ZHaGxJSEpsYzNCdmJuTmxMbHh1SUNvZ1FISmxkSFZ5Ym5NZ2UwVnljbTl5ZlNCVWFHVWdZM0psWVhSbFpDQmxjbkp2Y2k1Y2JpQXFMMXh1Ylc5a2RXeGxMbVY0Y0c5eWRITWdQU0JtZFc1amRHbHZiaUJqY21WaGRHVkZjbkp2Y2lodFpYTnpZV2RsTENCamIyNW1hV2NzSUdOdlpHVXNJSEpsY1hWbGMzUXNJSEpsYzNCdmJuTmxLU0I3WEc0Z0lIWmhjaUJsY25KdmNpQTlJRzVsZHlCRmNuSnZjaWh0WlhOellXZGxLVHRjYmlBZ2NtVjBkWEp1SUdWdWFHRnVZMlZGY25KdmNpaGxjbkp2Y2l3Z1kyOXVabWxuTENCamIyUmxMQ0J5WlhGMVpYTjBMQ0J5WlhOd2IyNXpaU2s3WEc1OU8xeHVJaXdpSjNWelpTQnpkSEpwWTNRbk8xeHVYRzUyWVhJZ2RYUnBiSE1nUFNCeVpYRjFhWEpsS0NjdUx5NHVMM1YwYVd4ekp5azdYRzUyWVhJZ2RISmhibk5tYjNKdFJHRjBZU0E5SUhKbGNYVnBjbVVvSnk0dmRISmhibk5tYjNKdFJHRjBZU2NwTzF4dWRtRnlJR2x6UTJGdVkyVnNJRDBnY21WeGRXbHlaU2duTGk0dlkyRnVZMlZzTDJselEyRnVZMlZzSnlrN1hHNTJZWElnWkdWbVlYVnNkSE1nUFNCeVpYRjFhWEpsS0NjdUxpOWtaV1poZFd4MGN5Y3BPMXh1WEc0dktpcGNiaUFxSUZSb2NtOTNjeUJoSUdCRFlXNWpaV3hnSUdsbUlHTmhibU5sYkd4aGRHbHZiaUJvWVhNZ1ltVmxiaUJ5WlhGMVpYTjBaV1F1WEc0Z0tpOWNibVoxYm1OMGFXOXVJSFJvY205M1NXWkRZVzVqWld4c1lYUnBiMjVTWlhGMVpYTjBaV1FvWTI5dVptbG5LU0I3WEc0Z0lHbG1JQ2hqYjI1bWFXY3VZMkZ1WTJWc1ZHOXJaVzRwSUh0Y2JpQWdJQ0JqYjI1bWFXY3VZMkZ1WTJWc1ZHOXJaVzR1ZEdoeWIzZEpabEpsY1hWbGMzUmxaQ2dwTzF4dUlDQjlYRzU5WEc1Y2JpOHFLbHh1SUNvZ1JHbHpjR0YwWTJnZ1lTQnlaWEYxWlhOMElIUnZJSFJvWlNCelpYSjJaWElnZFhOcGJtY2dkR2hsSUdOdmJtWnBaM1Z5WldRZ1lXUmhjSFJsY2k1Y2JpQXFYRzRnS2lCQWNHRnlZVzBnZTI5aWFtVmpkSDBnWTI5dVptbG5JRlJvWlNCamIyNW1hV2NnZEdoaGRDQnBjeUIwYnlCaVpTQjFjMlZrSUdadmNpQjBhR1VnY21WeGRXVnpkRnh1SUNvZ1FISmxkSFZ5Ym5NZ2UxQnliMjFwYzJWOUlGUm9aU0JRY205dGFYTmxJSFJ2SUdKbElHWjFiR1pwYkd4bFpGeHVJQ292WEc1dGIyUjFiR1V1Wlhod2IzSjBjeUE5SUdaMWJtTjBhVzl1SUdScGMzQmhkR05vVW1WeGRXVnpkQ2hqYjI1bWFXY3BJSHRjYmlBZ2RHaHliM2RKWmtOaGJtTmxiR3hoZEdsdmJsSmxjWFZsYzNSbFpDaGpiMjVtYVdjcE8xeHVYRzRnSUM4dklFVnVjM1Z5WlNCb1pXRmtaWEp6SUdWNGFYTjBYRzRnSUdOdmJtWnBaeTVvWldGa1pYSnpJRDBnWTI5dVptbG5MbWhsWVdSbGNuTWdmSHdnZTMwN1hHNWNiaUFnTHk4Z1ZISmhibk5tYjNKdElISmxjWFZsYzNRZ1pHRjBZVnh1SUNCamIyNW1hV2N1WkdGMFlTQTlJSFJ5WVc1elptOXliVVJoZEdFb1hHNGdJQ0FnWTI5dVptbG5MbVJoZEdFc1hHNGdJQ0FnWTI5dVptbG5MbWhsWVdSbGNuTXNYRzRnSUNBZ1kyOXVabWxuTG5SeVlXNXpabTl5YlZKbGNYVmxjM1JjYmlBZ0tUdGNibHh1SUNBdkx5QkdiR0YwZEdWdUlHaGxZV1JsY25OY2JpQWdZMjl1Wm1sbkxtaGxZV1JsY25NZ1BTQjFkR2xzY3k1dFpYSm5aU2hjYmlBZ0lDQmpiMjVtYVdjdWFHVmhaR1Z5Y3k1amIyMXRiMjRnZkh3Z2UzMHNYRzRnSUNBZ1kyOXVabWxuTG1obFlXUmxjbk5iWTI5dVptbG5MbTFsZEdodlpGMGdmSHdnZTMwc1hHNGdJQ0FnWTI5dVptbG5MbWhsWVdSbGNuTWdmSHdnZTMxY2JpQWdLVHRjYmx4dUlDQjFkR2xzY3k1bWIzSkZZV05vS0Z4dUlDQWdJRnNuWkdWc1pYUmxKeXdnSjJkbGRDY3NJQ2RvWldGa0p5d2dKM0J2YzNRbkxDQW5jSFYwSnl3Z0ozQmhkR05vSnl3Z0oyTnZiVzF2YmlkZExGeHVJQ0FnSUdaMWJtTjBhVzl1SUdOc1pXRnVTR1ZoWkdWeVEyOXVabWxuS0cxbGRHaHZaQ2tnZTF4dUlDQWdJQ0FnWkdWc1pYUmxJR052Ym1acFp5NW9aV0ZrWlhKelcyMWxkR2h2WkYwN1hHNGdJQ0FnZlZ4dUlDQXBPMXh1WEc0Z0lIWmhjaUJoWkdGd2RHVnlJRDBnWTI5dVptbG5MbUZrWVhCMFpYSWdmSHdnWkdWbVlYVnNkSE11WVdSaGNIUmxjanRjYmx4dUlDQnlaWFIxY200Z1lXUmhjSFJsY2loamIyNW1hV2NwTG5Sb1pXNG9ablZ1WTNScGIyNGdiMjVCWkdGd2RHVnlVbVZ6YjJ4MWRHbHZiaWh5WlhOd2IyNXpaU2tnZTF4dUlDQWdJSFJvY205M1NXWkRZVzVqWld4c1lYUnBiMjVTWlhGMVpYTjBaV1FvWTI5dVptbG5LVHRjYmx4dUlDQWdJQzh2SUZSeVlXNXpabTl5YlNCeVpYTndiMjV6WlNCa1lYUmhYRzRnSUNBZ2NtVnpjRzl1YzJVdVpHRjBZU0E5SUhSeVlXNXpabTl5YlVSaGRHRW9YRzRnSUNBZ0lDQnlaWE53YjI1elpTNWtZWFJoTEZ4dUlDQWdJQ0FnY21WemNHOXVjMlV1YUdWaFpHVnljeXhjYmlBZ0lDQWdJR052Ym1acFp5NTBjbUZ1YzJadmNtMVNaWE53YjI1elpWeHVJQ0FnSUNrN1hHNWNiaUFnSUNCeVpYUjFjbTRnY21WemNHOXVjMlU3WEc0Z0lIMHNJR1oxYm1OMGFXOXVJRzl1UVdSaGNIUmxjbEpsYW1WamRHbHZiaWh5WldGemIyNHBJSHRjYmlBZ0lDQnBaaUFvSVdselEyRnVZMlZzS0hKbFlYTnZiaWtwSUh0Y2JpQWdJQ0FnSUhSb2NtOTNTV1pEWVc1alpXeHNZWFJwYjI1U1pYRjFaWE4wWldRb1kyOXVabWxuS1R0Y2JseHVJQ0FnSUNBZ0x5OGdWSEpoYm5ObWIzSnRJSEpsYzNCdmJuTmxJR1JoZEdGY2JpQWdJQ0FnSUdsbUlDaHlaV0Z6YjI0Z0ppWWdjbVZoYzI5dUxuSmxjM0J2Ym5ObEtTQjdYRzRnSUNBZ0lDQWdJSEpsWVhOdmJpNXlaWE53YjI1elpTNWtZWFJoSUQwZ2RISmhibk5tYjNKdFJHRjBZU2hjYmlBZ0lDQWdJQ0FnSUNCeVpXRnpiMjR1Y21WemNHOXVjMlV1WkdGMFlTeGNiaUFnSUNBZ0lDQWdJQ0J5WldGemIyNHVjbVZ6Y0c5dWMyVXVhR1ZoWkdWeWN5eGNiaUFnSUNBZ0lDQWdJQ0JqYjI1bWFXY3VkSEpoYm5ObWIzSnRVbVZ6Y0c5dWMyVmNiaUFnSUNBZ0lDQWdLVHRjYmlBZ0lDQWdJSDFjYmlBZ0lDQjlYRzVjYmlBZ0lDQnlaWFIxY200Z1VISnZiV2x6WlM1eVpXcGxZM1FvY21WaGMyOXVLVHRjYmlBZ2ZTazdYRzU5TzF4dUlpd2lKM1Z6WlNCemRISnBZM1FuTzF4dVhHNHZLaXBjYmlBcUlGVndaR0YwWlNCaGJpQkZjbkp2Y2lCM2FYUm9JSFJvWlNCemNHVmphV1pwWldRZ1kyOXVabWxuTENCbGNuSnZjaUJqYjJSbExDQmhibVFnY21WemNHOXVjMlV1WEc0Z0tseHVJQ29nUUhCaGNtRnRJSHRGY25KdmNuMGdaWEp5YjNJZ1ZHaGxJR1Z5Y205eUlIUnZJSFZ3WkdGMFpTNWNiaUFxSUVCd1lYSmhiU0I3VDJKcVpXTjBmU0JqYjI1bWFXY2dWR2hsSUdOdmJtWnBaeTVjYmlBcUlFQndZWEpoYlNCN2MzUnlhVzVuZlNCYlkyOWtaVjBnVkdobElHVnljbTl5SUdOdlpHVWdLR1p2Y2lCbGVHRnRjR3hsTENBblJVTlBUazVCUWs5U1ZFVkVKeWt1WEc0Z0tpQkFjR0Z5WVcwZ2UwOWlhbVZqZEgwZ1czSmxjWFZsYzNSZElGUm9aU0J5WlhGMVpYTjBMbHh1SUNvZ1FIQmhjbUZ0SUh0UFltcGxZM1I5SUZ0eVpYTndiMjV6WlYwZ1ZHaGxJSEpsYzNCdmJuTmxMbHh1SUNvZ1FISmxkSFZ5Ym5NZ2UwVnljbTl5ZlNCVWFHVWdaWEp5YjNJdVhHNGdLaTljYm0xdlpIVnNaUzVsZUhCdmNuUnpJRDBnWm5WdVkzUnBiMjRnWlc1b1lXNWpaVVZ5Y205eUtHVnljbTl5TENCamIyNW1hV2NzSUdOdlpHVXNJSEpsY1hWbGMzUXNJSEpsYzNCdmJuTmxLU0I3WEc0Z0lHVnljbTl5TG1OdmJtWnBaeUE5SUdOdmJtWnBaenRjYmlBZ2FXWWdLR052WkdVcElIdGNiaUFnSUNCbGNuSnZjaTVqYjJSbElEMGdZMjlrWlR0Y2JpQWdmVnh1SUNCbGNuSnZjaTV5WlhGMVpYTjBJRDBnY21WeGRXVnpkRHRjYmlBZ1pYSnliM0l1Y21WemNHOXVjMlVnUFNCeVpYTndiMjV6WlR0Y2JpQWdjbVYwZFhKdUlHVnljbTl5TzF4dWZUdGNiaUlzSWlkMWMyVWdjM1J5YVdOMEp6dGNibHh1ZG1GeUlHTnlaV0YwWlVWeWNtOXlJRDBnY21WeGRXbHlaU2duTGk5amNtVmhkR1ZGY25KdmNpY3BPMXh1WEc0dktpcGNiaUFxSUZKbGMyOXNkbVVnYjNJZ2NtVnFaV04wSUdFZ1VISnZiV2x6WlNCaVlYTmxaQ0J2YmlCeVpYTndiMjV6WlNCemRHRjBkWE11WEc0Z0tseHVJQ29nUUhCaGNtRnRJSHRHZFc1amRHbHZibjBnY21WemIyeDJaU0JCSUdaMWJtTjBhVzl1SUhSb1lYUWdjbVZ6YjJ4MlpYTWdkR2hsSUhCeWIyMXBjMlV1WEc0Z0tpQkFjR0Z5WVcwZ2UwWjFibU4wYVc5dWZTQnlaV3BsWTNRZ1FTQm1kVzVqZEdsdmJpQjBhR0YwSUhKbGFtVmpkSE1nZEdobElIQnliMjFwYzJVdVhHNGdLaUJBY0dGeVlXMGdlMjlpYW1WamRIMGdjbVZ6Y0c5dWMyVWdWR2hsSUhKbGMzQnZibk5sTGx4dUlDb3ZYRzV0YjJSMWJHVXVaWGh3YjNKMGN5QTlJR1oxYm1OMGFXOXVJSE5sZEhSc1pTaHlaWE52YkhabExDQnlaV3BsWTNRc0lISmxjM0J2Ym5ObEtTQjdYRzRnSUhaaGNpQjJZV3hwWkdGMFpWTjBZWFIxY3lBOUlISmxjM0J2Ym5ObExtTnZibVpwWnk1MllXeHBaR0YwWlZOMFlYUjFjenRjYmlBZ0x5OGdUbTkwWlRvZ2MzUmhkSFZ6SUdseklHNXZkQ0JsZUhCdmMyVmtJR0o1SUZoRWIyMWhhVzVTWlhGMVpYTjBYRzRnSUdsbUlDZ2hjbVZ6Y0c5dWMyVXVjM1JoZEhWeklIeDhJQ0YyWVd4cFpHRjBaVk4wWVhSMWN5QjhmQ0IyWVd4cFpHRjBaVk4wWVhSMWN5aHlaWE53YjI1elpTNXpkR0YwZFhNcEtTQjdYRzRnSUNBZ2NtVnpiMngyWlNoeVpYTndiMjV6WlNrN1hHNGdJSDBnWld4elpTQjdYRzRnSUNBZ2NtVnFaV04wS0dOeVpXRjBaVVZ5Y205eUtGeHVJQ0FnSUNBZ0oxSmxjWFZsYzNRZ1ptRnBiR1ZrSUhkcGRHZ2djM1JoZEhWeklHTnZaR1VnSnlBcklISmxjM0J2Ym5ObExuTjBZWFIxY3l4Y2JpQWdJQ0FnSUhKbGMzQnZibk5sTG1OdmJtWnBaeXhjYmlBZ0lDQWdJRzUxYkd3c1hHNGdJQ0FnSUNCeVpYTndiMjV6WlM1eVpYRjFaWE4wTEZ4dUlDQWdJQ0FnY21WemNHOXVjMlZjYmlBZ0lDQXBLVHRjYmlBZ2ZWeHVmVHRjYmlJc0lpZDFjMlVnYzNSeWFXTjBKenRjYmx4dWRtRnlJSFYwYVd4eklEMGdjbVZ4ZFdseVpTZ25MaTh1TGk5MWRHbHNjeWNwTzF4dVhHNHZLaXBjYmlBcUlGUnlZVzV6Wm05eWJTQjBhR1VnWkdGMFlTQm1iM0lnWVNCeVpYRjFaWE4wSUc5eUlHRWdjbVZ6Y0c5dWMyVmNiaUFxWEc0Z0tpQkFjR0Z5WVcwZ2UwOWlhbVZqZEh4VGRISnBibWQ5SUdSaGRHRWdWR2hsSUdSaGRHRWdkRzhnWW1VZ2RISmhibk5tYjNKdFpXUmNiaUFxSUVCd1lYSmhiU0I3UVhKeVlYbDlJR2hsWVdSbGNuTWdWR2hsSUdobFlXUmxjbk1nWm05eUlIUm9aU0J5WlhGMVpYTjBJRzl5SUhKbGMzQnZibk5sWEc0Z0tpQkFjR0Z5WVcwZ2UwRnljbUY1ZkVaMWJtTjBhVzl1ZlNCbWJuTWdRU0J6YVc1bmJHVWdablZ1WTNScGIyNGdiM0lnUVhKeVlYa2diMllnWm5WdVkzUnBiMjV6WEc0Z0tpQkFjbVYwZFhKdWN5QjdLbjBnVkdobElISmxjM1ZzZEdsdVp5QjBjbUZ1YzJadmNtMWxaQ0JrWVhSaFhHNGdLaTljYm0xdlpIVnNaUzVsZUhCdmNuUnpJRDBnWm5WdVkzUnBiMjRnZEhKaGJuTm1iM0p0UkdGMFlTaGtZWFJoTENCb1pXRmtaWEp6TENCbWJuTXBJSHRjYmlBZ0x5cGxjMnhwYm5RZ2JtOHRjR0Z5WVcwdGNtVmhjM05wWjI0Nk1Db3ZYRzRnSUhWMGFXeHpMbVp2Y2tWaFkyZ29abTV6TENCbWRXNWpkR2x2YmlCMGNtRnVjMlp2Y20wb1ptNHBJSHRjYmlBZ0lDQmtZWFJoSUQwZ1ptNG9aR0YwWVN3Z2FHVmhaR1Z5Y3lrN1hHNGdJSDBwTzF4dVhHNGdJSEpsZEhWeWJpQmtZWFJoTzF4dWZUdGNiaUlzSWlkMWMyVWdjM1J5YVdOMEp6dGNibHh1ZG1GeUlIVjBhV3h6SUQwZ2NtVnhkV2x5WlNnbkxpOTFkR2xzY3ljcE8xeHVkbUZ5SUc1dmNtMWhiR2w2WlVobFlXUmxjazVoYldVZ1BTQnlaWEYxYVhKbEtDY3VMMmhsYkhCbGNuTXZibTl5YldGc2FYcGxTR1ZoWkdWeVRtRnRaU2NwTzF4dVhHNTJZWElnUkVWR1FWVk1WRjlEVDA1VVJVNVVYMVJaVUVVZ1BTQjdYRzRnSUNkRGIyNTBaVzUwTFZSNWNHVW5PaUFuWVhCd2JHbGpZWFJwYjI0dmVDMTNkM2N0Wm05eWJTMTFjbXhsYm1OdlpHVmtKMXh1ZlR0Y2JseHVablZ1WTNScGIyNGdjMlYwUTI5dWRHVnVkRlI1Y0dWSlpsVnVjMlYwS0dobFlXUmxjbk1zSUhaaGJIVmxLU0I3WEc0Z0lHbG1JQ2doZFhScGJITXVhWE5WYm1SbFptbHVaV1FvYUdWaFpHVnljeWtnSmlZZ2RYUnBiSE11YVhOVmJtUmxabWx1WldRb2FHVmhaR1Z5YzFzblEyOXVkR1Z1ZEMxVWVYQmxKMTBwS1NCN1hHNGdJQ0FnYUdWaFpHVnljMXNuUTI5dWRHVnVkQzFVZVhCbEoxMGdQU0IyWVd4MVpUdGNiaUFnZlZ4dWZWeHVYRzVtZFc1amRHbHZiaUJuWlhSRVpXWmhkV3gwUVdSaGNIUmxjaWdwSUh0Y2JpQWdkbUZ5SUdGa1lYQjBaWEk3WEc0Z0lHbG1JQ2gwZVhCbGIyWWdXRTFNU0hSMGNGSmxjWFZsYzNRZ0lUMDlJQ2QxYm1SbFptbHVaV1FuS1NCN1hHNGdJQ0FnTHk4Z1JtOXlJR0p5YjNkelpYSnpJSFZ6WlNCWVNGSWdZV1JoY0hSbGNseHVJQ0FnSUdGa1lYQjBaWElnUFNCeVpYRjFhWEpsS0NjdUwyRmtZWEIwWlhKekwzaG9jaWNwTzF4dUlDQjlJR1ZzYzJVZ2FXWWdLSFI1Y0dWdlppQndjbTlqWlhOeklDRTlQU0FuZFc1a1pXWnBibVZrSnlrZ2UxeHVJQ0FnSUM4dklFWnZjaUJ1YjJSbElIVnpaU0JJVkZSUUlHRmtZWEIwWlhKY2JpQWdJQ0JoWkdGd2RHVnlJRDBnY21WeGRXbHlaU2duTGk5aFpHRndkR1Z5Y3k5b2RIUndKeWs3WEc0Z0lIMWNiaUFnY21WMGRYSnVJR0ZrWVhCMFpYSTdYRzU5WEc1Y2JuWmhjaUJrWldaaGRXeDBjeUE5SUh0Y2JpQWdZV1JoY0hSbGNqb2daMlYwUkdWbVlYVnNkRUZrWVhCMFpYSW9LU3hjYmx4dUlDQjBjbUZ1YzJadmNtMVNaWEYxWlhOME9pQmJablZ1WTNScGIyNGdkSEpoYm5ObWIzSnRVbVZ4ZFdWemRDaGtZWFJoTENCb1pXRmtaWEp6S1NCN1hHNGdJQ0FnYm05eWJXRnNhWHBsU0dWaFpHVnlUbUZ0WlNob1pXRmtaWEp6TENBblEyOXVkR1Z1ZEMxVWVYQmxKeWs3WEc0Z0lDQWdhV1lnS0hWMGFXeHpMbWx6Um05eWJVUmhkR0VvWkdGMFlTa2dmSHhjYmlBZ0lDQWdJSFYwYVd4ekxtbHpRWEp5WVhsQ2RXWm1aWElvWkdGMFlTa2dmSHhjYmlBZ0lDQWdJSFYwYVd4ekxtbHpRblZtWm1WeUtHUmhkR0VwSUh4OFhHNGdJQ0FnSUNCMWRHbHNjeTVwYzFOMGNtVmhiU2hrWVhSaEtTQjhmRnh1SUNBZ0lDQWdkWFJwYkhNdWFYTkdhV3hsS0dSaGRHRXBJSHg4WEc0Z0lDQWdJQ0IxZEdsc2N5NXBjMEpzYjJJb1pHRjBZU2xjYmlBZ0lDQXBJSHRjYmlBZ0lDQWdJSEpsZEhWeWJpQmtZWFJoTzF4dUlDQWdJSDFjYmlBZ0lDQnBaaUFvZFhScGJITXVhWE5CY25KaGVVSjFabVpsY2xacFpYY29aR0YwWVNrcElIdGNiaUFnSUNBZ0lISmxkSFZ5YmlCa1lYUmhMbUoxWm1abGNqdGNiaUFnSUNCOVhHNGdJQ0FnYVdZZ0tIVjBhV3h6TG1selZWSk1VMlZoY21Ob1VHRnlZVzF6S0dSaGRHRXBLU0I3WEc0Z0lDQWdJQ0J6WlhSRGIyNTBaVzUwVkhsd1pVbG1WVzV6WlhRb2FHVmhaR1Z5Y3l3Z0oyRndjR3hwWTJGMGFXOXVMM2d0ZDNkM0xXWnZjbTB0ZFhKc1pXNWpiMlJsWkR0amFHRnljMlYwUFhWMFppMDRKeWs3WEc0Z0lDQWdJQ0J5WlhSMWNtNGdaR0YwWVM1MGIxTjBjbWx1WnlncE8xeHVJQ0FnSUgxY2JpQWdJQ0JwWmlBb2RYUnBiSE11YVhOUFltcGxZM1FvWkdGMFlTa3BJSHRjYmlBZ0lDQWdJSE5sZEVOdmJuUmxiblJVZVhCbFNXWlZibk5sZENob1pXRmtaWEp6TENBbllYQndiR2xqWVhScGIyNHZhbk52Ymp0amFHRnljMlYwUFhWMFppMDRKeWs3WEc0Z0lDQWdJQ0J5WlhSMWNtNGdTbE5QVGk1emRISnBibWRwWm5rb1pHRjBZU2s3WEc0Z0lDQWdmVnh1SUNBZ0lISmxkSFZ5YmlCa1lYUmhPMXh1SUNCOVhTeGNibHh1SUNCMGNtRnVjMlp2Y20xU1pYTndiMjV6WlRvZ1cyWjFibU4wYVc5dUlIUnlZVzV6Wm05eWJWSmxjM0J2Ym5ObEtHUmhkR0VwSUh0Y2JpQWdJQ0F2S21WemJHbHVkQ0J1Ynkxd1lYSmhiUzF5WldGemMybG5iam93S2k5Y2JpQWdJQ0JwWmlBb2RIbHdaVzltSUdSaGRHRWdQVDA5SUNkemRISnBibWNuS1NCN1hHNGdJQ0FnSUNCMGNua2dlMXh1SUNBZ0lDQWdJQ0JrWVhSaElEMGdTbE5QVGk1d1lYSnpaU2hrWVhSaEtUdGNiaUFnSUNBZ0lIMGdZMkYwWTJnZ0tHVXBJSHNnTHlvZ1NXZHViM0psSUNvdklIMWNiaUFnSUNCOVhHNGdJQ0FnY21WMGRYSnVJR1JoZEdFN1hHNGdJSDFkTEZ4dVhHNGdJSFJwYldWdmRYUTZJREFzWEc1Y2JpQWdlSE55WmtOdmIydHBaVTVoYldVNklDZFlVMUpHTFZSUFMwVk9KeXhjYmlBZ2VITnlaa2hsWVdSbGNrNWhiV1U2SUNkWUxWaFRVa1l0VkU5TFJVNG5MRnh1WEc0Z0lHMWhlRU52Ym5SbGJuUk1aVzVuZEdnNklDMHhMRnh1WEc0Z0lIWmhiR2xrWVhSbFUzUmhkSFZ6T2lCbWRXNWpkR2x2YmlCMllXeHBaR0YwWlZOMFlYUjFjeWh6ZEdGMGRYTXBJSHRjYmlBZ0lDQnlaWFIxY200Z2MzUmhkSFZ6SUQ0OUlESXdNQ0FtSmlCemRHRjBkWE1nUENBek1EQTdYRzRnSUgxY2JuMDdYRzVjYm1SbFptRjFiSFJ6TG1obFlXUmxjbk1nUFNCN1hHNGdJR052YlcxdmJqb2dlMXh1SUNBZ0lDZEJZMk5sY0hRbk9pQW5ZWEJ3YkdsallYUnBiMjR2YW5OdmJpd2dkR1Y0ZEM5d2JHRnBiaXdnS2k4cUoxeHVJQ0I5WEc1OU8xeHVYRzUxZEdsc2N5NW1iM0pGWVdOb0tGc25aR1ZzWlhSbEp5d2dKMmRsZENjc0lDZG9aV0ZrSjEwc0lHWjFibU4wYVc5dUlHWnZja1ZoWTJoTlpYUm9iMlJPYjBSaGRHRW9iV1YwYUc5a0tTQjdYRzRnSUdSbFptRjFiSFJ6TG1obFlXUmxjbk5iYldWMGFHOWtYU0E5SUh0OU8xeHVmU2s3WEc1Y2JuVjBhV3h6TG1admNrVmhZMmdvV3lkd2IzTjBKeXdnSjNCMWRDY3NJQ2R3WVhSamFDZGRMQ0JtZFc1amRHbHZiaUJtYjNKRllXTm9UV1YwYUc5a1YybDBhRVJoZEdFb2JXVjBhRzlrS1NCN1hHNGdJR1JsWm1GMWJIUnpMbWhsWVdSbGNuTmJiV1YwYUc5a1hTQTlJSFYwYVd4ekxtMWxjbWRsS0VSRlJrRlZURlJmUTA5T1ZFVk9WRjlVV1ZCRktUdGNibjBwTzF4dVhHNXRiMlIxYkdVdVpYaHdiM0owY3lBOUlHUmxabUYxYkhSek8xeHVJaXdpSjNWelpTQnpkSEpwWTNRbk8xeHVYRzV0YjJSMWJHVXVaWGh3YjNKMGN5QTlJR1oxYm1OMGFXOXVJR0pwYm1Rb1ptNHNJSFJvYVhOQmNtY3BJSHRjYmlBZ2NtVjBkWEp1SUdaMWJtTjBhVzl1SUhkeVlYQW9LU0I3WEc0Z0lDQWdkbUZ5SUdGeVozTWdQU0J1WlhjZ1FYSnlZWGtvWVhKbmRXMWxiblJ6TG14bGJtZDBhQ2s3WEc0Z0lDQWdabTl5SUNoMllYSWdhU0E5SURBN0lHa2dQQ0JoY21kekxteGxibWQwYURzZ2FTc3JLU0I3WEc0Z0lDQWdJQ0JoY21kelcybGRJRDBnWVhKbmRXMWxiblJ6VzJsZE8xeHVJQ0FnSUgxY2JpQWdJQ0J5WlhSMWNtNGdabTR1WVhCd2JIa29kR2hwYzBGeVp5d2dZWEpuY3lrN1hHNGdJSDA3WEc1OU8xeHVJaXdpSjNWelpTQnpkSEpwWTNRbk8xeHVYRzR2THlCaWRHOWhJSEJ2YkhsbWFXeHNJR1p2Y2lCSlJUd3hNQ0JqYjNWeWRHVnplU0JvZEhSd2N6b3ZMMmRwZEdoMVlpNWpiMjB2WkdGMmFXUmphR0Z0WW1WeWN5OUNZWE5sTmpRdWFuTmNibHh1ZG1GeUlHTm9ZWEp6SUQwZ0owRkNRMFJGUmtkSVNVcExURTFPVDFCUlVsTlVWVlpYV0ZsYVlXSmpaR1ZtWjJocGFtdHNiVzV2Y0hGeWMzUjFkbmQ0ZVhvd01USXpORFUyTnpnNUt5ODlKenRjYmx4dVpuVnVZM1JwYjI0Z1JTZ3BJSHRjYmlBZ2RHaHBjeTV0WlhOellXZGxJRDBnSjFOMGNtbHVaeUJqYjI1MFlXbHVjeUJoYmlCcGJuWmhiR2xrSUdOb1lYSmhZM1JsY2ljN1hHNTlYRzVGTG5CeWIzUnZkSGx3WlNBOUlHNWxkeUJGY25KdmNqdGNia1V1Y0hKdmRHOTBlWEJsTG1OdlpHVWdQU0ExTzF4dVJTNXdjbTkwYjNSNWNHVXVibUZ0WlNBOUlDZEpiblpoYkdsa1EyaGhjbUZqZEdWeVJYSnliM0luTzF4dVhHNW1kVzVqZEdsdmJpQmlkRzloS0dsdWNIVjBLU0I3WEc0Z0lIWmhjaUJ6ZEhJZ1BTQlRkSEpwYm1jb2FXNXdkWFFwTzF4dUlDQjJZWElnYjNWMGNIVjBJRDBnSnljN1hHNGdJR1p2Y2lBb1hHNGdJQ0FnTHk4Z2FXNXBkR2xoYkdsNlpTQnlaWE4xYkhRZ1lXNWtJR052ZFc1MFpYSmNiaUFnSUNCMllYSWdZbXh2WTJzc0lHTm9ZWEpEYjJSbExDQnBaSGdnUFNBd0xDQnRZWEFnUFNCamFHRnljenRjYmlBZ0lDQXZMeUJwWmlCMGFHVWdibVY0ZENCemRISWdhVzVrWlhnZ1pHOWxjeUJ1YjNRZ1pYaHBjM1E2WEc0Z0lDQWdMeThnSUNCamFHRnVaMlVnZEdobElHMWhjSEJwYm1jZ2RHRmliR1VnZEc4Z1hDSTlYQ0pjYmlBZ0lDQXZMeUFnSUdOb1pXTnJJR2xtSUdRZ2FHRnpJRzV2SUdaeVlXTjBhVzl1WVd3Z1pHbG5hWFJ6WEc0Z0lDQWdjM1J5TG1Ob1lYSkJkQ2hwWkhnZ2ZDQXdLU0I4ZkNBb2JXRndJRDBnSnowbkxDQnBaSGdnSlNBeEtUdGNiaUFnSUNBdkx5QmNJamdnTFNCcFpIZ2dKU0F4SUNvZ09Gd2lJR2RsYm1WeVlYUmxjeUIwYUdVZ2MyVnhkV1Z1WTJVZ01pd2dOQ3dnTml3Z09GeHVJQ0FnSUc5MWRIQjFkQ0FyUFNCdFlYQXVZMmhoY2tGMEtEWXpJQ1lnWW14dlkyc2dQajRnT0NBdElHbGtlQ0FsSURFZ0tpQTRLVnh1SUNBcElIdGNiaUFnSUNCamFHRnlRMjlrWlNBOUlITjBjaTVqYUdGeVEyOWtaVUYwS0dsa2VDQXJQU0F6SUM4Z05DazdYRzRnSUNBZ2FXWWdLR05vWVhKRGIyUmxJRDRnTUhoR1Jpa2dlMXh1SUNBZ0lDQWdkR2h5YjNjZ2JtVjNJRVVvS1R0Y2JpQWdJQ0I5WEc0Z0lDQWdZbXh2WTJzZ1BTQmliRzlqYXlBOFBDQTRJSHdnWTJoaGNrTnZaR1U3WEc0Z0lIMWNiaUFnY21WMGRYSnVJRzkxZEhCMWREdGNibjFjYmx4dWJXOWtkV3hsTG1WNGNHOXlkSE1nUFNCaWRHOWhPMXh1SWl3aUozVnpaU0J6ZEhKcFkzUW5PMXh1WEc1MllYSWdkWFJwYkhNZ1BTQnlaWEYxYVhKbEtDY3VMeTR1TDNWMGFXeHpKeWs3WEc1Y2JtWjFibU4wYVc5dUlHVnVZMjlrWlNoMllXd3BJSHRjYmlBZ2NtVjBkWEp1SUdWdVkyOWtaVlZTU1VOdmJYQnZibVZ1ZENoMllXd3BMbHh1SUNBZ0lISmxjR3hoWTJVb0x5VTBNQzluYVN3Z0owQW5LUzVjYmlBZ0lDQnlaWEJzWVdObEtDOGxNMEV2WjJrc0lDYzZKeWt1WEc0Z0lDQWdjbVZ3YkdGalpTZ3ZKVEkwTDJjc0lDY2tKeWt1WEc0Z0lDQWdjbVZ3YkdGalpTZ3ZKVEpETDJkcExDQW5MQ2NwTGx4dUlDQWdJSEpsY0d4aFkyVW9MeVV5TUM5bkxDQW5LeWNwTGx4dUlDQWdJSEpsY0d4aFkyVW9MeVUxUWk5bmFTd2dKMXNuS1M1Y2JpQWdJQ0J5WlhCc1lXTmxLQzhsTlVRdloya3NJQ2RkSnlrN1hHNTlYRzVjYmk4cUtseHVJQ29nUW5WcGJHUWdZU0JWVWt3Z1lua2dZWEJ3Wlc1a2FXNW5JSEJoY21GdGN5QjBieUIwYUdVZ1pXNWtYRzRnS2x4dUlDb2dRSEJoY21GdElIdHpkSEpwYm1kOUlIVnliQ0JVYUdVZ1ltRnpaU0J2WmlCMGFHVWdkWEpzSUNobExtY3VMQ0JvZEhSd09pOHZkM2QzTG1kdmIyZHNaUzVqYjIwcFhHNGdLaUJBY0dGeVlXMGdlMjlpYW1WamRIMGdXM0JoY21GdGMxMGdWR2hsSUhCaGNtRnRjeUIwYnlCaVpTQmhjSEJsYm1SbFpGeHVJQ29nUUhKbGRIVnlibk1nZTNOMGNtbHVaMzBnVkdobElHWnZjbTFoZEhSbFpDQjFjbXhjYmlBcUwxeHViVzlrZFd4bExtVjRjRzl5ZEhNZ1BTQm1kVzVqZEdsdmJpQmlkV2xzWkZWU1RDaDFjbXdzSUhCaGNtRnRjeXdnY0dGeVlXMXpVMlZ5YVdGc2FYcGxjaWtnZTF4dUlDQXZLbVZ6YkdsdWRDQnVieTF3WVhKaGJTMXlaV0Z6YzJsbmJqb3dLaTljYmlBZ2FXWWdLQ0Z3WVhKaGJYTXBJSHRjYmlBZ0lDQnlaWFIxY200Z2RYSnNPMXh1SUNCOVhHNWNiaUFnZG1GeUlITmxjbWxoYkdsNlpXUlFZWEpoYlhNN1hHNGdJR2xtSUNod1lYSmhiWE5UWlhKcFlXeHBlbVZ5S1NCN1hHNGdJQ0FnYzJWeWFXRnNhWHBsWkZCaGNtRnRjeUE5SUhCaGNtRnRjMU5sY21saGJHbDZaWElvY0dGeVlXMXpLVHRjYmlBZ2ZTQmxiSE5sSUdsbUlDaDFkR2xzY3k1cGMxVlNURk5sWVhKamFGQmhjbUZ0Y3lod1lYSmhiWE1wS1NCN1hHNGdJQ0FnYzJWeWFXRnNhWHBsWkZCaGNtRnRjeUE5SUhCaGNtRnRjeTUwYjFOMGNtbHVaeWdwTzF4dUlDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUhaaGNpQndZWEowY3lBOUlGdGRPMXh1WEc0Z0lDQWdkWFJwYkhNdVptOXlSV0ZqYUNod1lYSmhiWE1zSUdaMWJtTjBhVzl1SUhObGNtbGhiR2w2WlNoMllXd3NJR3RsZVNrZ2UxeHVJQ0FnSUNBZ2FXWWdLSFpoYkNBOVBUMGdiblZzYkNCOGZDQjBlWEJsYjJZZ2RtRnNJRDA5UFNBbmRXNWtaV1pwYm1Wa0p5a2dlMXh1SUNBZ0lDQWdJQ0J5WlhSMWNtNDdYRzRnSUNBZ0lDQjlYRzVjYmlBZ0lDQWdJR2xtSUNoMWRHbHNjeTVwYzBGeWNtRjVLSFpoYkNrcElIdGNiaUFnSUNBZ0lDQWdhMlY1SUQwZ2EyVjVJQ3NnSjF0ZEp6dGNiaUFnSUNBZ0lIMWNibHh1SUNBZ0lDQWdhV1lnS0NGMWRHbHNjeTVwYzBGeWNtRjVLSFpoYkNrcElIdGNiaUFnSUNBZ0lDQWdkbUZzSUQwZ1czWmhiRjA3WEc0Z0lDQWdJQ0I5WEc1Y2JpQWdJQ0FnSUhWMGFXeHpMbVp2Y2tWaFkyZ29kbUZzTENCbWRXNWpkR2x2YmlCd1lYSnpaVlpoYkhWbEtIWXBJSHRjYmlBZ0lDQWdJQ0FnYVdZZ0tIVjBhV3h6TG1selJHRjBaU2gyS1NrZ2UxeHVJQ0FnSUNBZ0lDQWdJSFlnUFNCMkxuUnZTVk5QVTNSeWFXNW5LQ2s3WEc0Z0lDQWdJQ0FnSUgwZ1pXeHpaU0JwWmlBb2RYUnBiSE11YVhOUFltcGxZM1FvZGlrcElIdGNiaUFnSUNBZ0lDQWdJQ0IySUQwZ1NsTlBUaTV6ZEhKcGJtZHBabmtvZGlrN1hHNGdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdjR0Z5ZEhNdWNIVnphQ2hsYm1OdlpHVW9hMlY1S1NBcklDYzlKeUFySUdWdVkyOWtaU2gyS1NrN1hHNGdJQ0FnSUNCOUtUdGNiaUFnSUNCOUtUdGNibHh1SUNBZ0lITmxjbWxoYkdsNlpXUlFZWEpoYlhNZ1BTQndZWEowY3k1cWIybHVLQ2NtSnlrN1hHNGdJSDFjYmx4dUlDQnBaaUFvYzJWeWFXRnNhWHBsWkZCaGNtRnRjeWtnZTF4dUlDQWdJSFZ5YkNBclBTQW9kWEpzTG1sdVpHVjRUMllvSno4bktTQTlQVDBnTFRFZ1B5QW5QeWNnT2lBbkppY3BJQ3NnYzJWeWFXRnNhWHBsWkZCaGNtRnRjenRjYmlBZ2ZWeHVYRzRnSUhKbGRIVnliaUIxY213N1hHNTlPMXh1SWl3aUozVnpaU0J6ZEhKcFkzUW5PMXh1WEc0dktpcGNiaUFxSUVOeVpXRjBaWE1nWVNCdVpYY2dWVkpNSUdKNUlHTnZiV0pwYm1sdVp5QjBhR1VnYzNCbFkybG1hV1ZrSUZWU1RITmNiaUFxWEc0Z0tpQkFjR0Z5WVcwZ2UzTjBjbWx1WjMwZ1ltRnpaVlZTVENCVWFHVWdZbUZ6WlNCVlVreGNiaUFxSUVCd1lYSmhiU0I3YzNSeWFXNW5mU0J5Wld4aGRHbDJaVlZTVENCVWFHVWdjbVZzWVhScGRtVWdWVkpNWEc0Z0tpQkFjbVYwZFhKdWN5QjdjM1J5YVc1bmZTQlVhR1VnWTI5dFltbHVaV1FnVlZKTVhHNGdLaTljYm0xdlpIVnNaUzVsZUhCdmNuUnpJRDBnWm5WdVkzUnBiMjRnWTI5dFltbHVaVlZTVEhNb1ltRnpaVlZTVEN3Z2NtVnNZWFJwZG1WVlVrd3BJSHRjYmlBZ2NtVjBkWEp1SUhKbGJHRjBhWFpsVlZKTVhHNGdJQ0FnUHlCaVlYTmxWVkpNTG5KbGNHeGhZMlVvTDF4Y0x5c2tMeXdnSnljcElDc2dKeThuSUNzZ2NtVnNZWFJwZG1WVlVrd3VjbVZ3YkdGalpTZ3ZYbHhjTHlzdkxDQW5KeWxjYmlBZ0lDQTZJR0poYzJWVlVrdzdYRzU5TzF4dUlpd2lKM1Z6WlNCemRISnBZM1FuTzF4dVhHNTJZWElnZFhScGJITWdQU0J5WlhGMWFYSmxLQ2N1THk0dUwzVjBhV3h6SnlrN1hHNWNibTF2WkhWc1pTNWxlSEJ2Y25SeklEMGdLRnh1SUNCMWRHbHNjeTVwYzFOMFlXNWtZWEprUW5KdmQzTmxja1Z1ZGlncElEOWNibHh1SUNBdkx5QlRkR0Z1WkdGeVpDQmljbTkzYzJWeUlHVnVkbk1nYzNWd2NHOXlkQ0JrYjJOMWJXVnVkQzVqYjI5cmFXVmNiaUFnS0daMWJtTjBhVzl1SUhOMFlXNWtZWEprUW5KdmQzTmxja1Z1ZGlncElIdGNiaUFnSUNCeVpYUjFjbTRnZTF4dUlDQWdJQ0FnZDNKcGRHVTZJR1oxYm1OMGFXOXVJSGR5YVhSbEtHNWhiV1VzSUhaaGJIVmxMQ0JsZUhCcGNtVnpMQ0J3WVhSb0xDQmtiMjFoYVc0c0lITmxZM1Z5WlNrZ2UxeHVJQ0FnSUNBZ0lDQjJZWElnWTI5dmEybGxJRDBnVzEwN1hHNGdJQ0FnSUNBZ0lHTnZiMnRwWlM1d2RYTm9LRzVoYldVZ0t5QW5QU2NnS3lCbGJtTnZaR1ZWVWtsRGIyMXdiMjVsYm5Rb2RtRnNkV1VwS1R0Y2JseHVJQ0FnSUNBZ0lDQnBaaUFvZFhScGJITXVhWE5PZFcxaVpYSW9aWGh3YVhKbGN5a3BJSHRjYmlBZ0lDQWdJQ0FnSUNCamIyOXJhV1V1Y0hWemFDZ25aWGh3YVhKbGN6MG5JQ3NnYm1WM0lFUmhkR1VvWlhod2FYSmxjeWt1ZEc5SFRWUlRkSEpwYm1jb0tTazdYRzRnSUNBZ0lDQWdJSDFjYmx4dUlDQWdJQ0FnSUNCcFppQW9kWFJwYkhNdWFYTlRkSEpwYm1jb2NHRjBhQ2twSUh0Y2JpQWdJQ0FnSUNBZ0lDQmpiMjlyYVdVdWNIVnphQ2duY0dGMGFEMG5JQ3NnY0dGMGFDazdYRzRnSUNBZ0lDQWdJSDFjYmx4dUlDQWdJQ0FnSUNCcFppQW9kWFJwYkhNdWFYTlRkSEpwYm1jb1pHOXRZV2x1S1NrZ2UxeHVJQ0FnSUNBZ0lDQWdJR052YjJ0cFpTNXdkWE5vS0Nka2IyMWhhVzQ5SnlBcklHUnZiV0ZwYmlrN1hHNGdJQ0FnSUNBZ0lIMWNibHh1SUNBZ0lDQWdJQ0JwWmlBb2MyVmpkWEpsSUQwOVBTQjBjblZsS1NCN1hHNGdJQ0FnSUNBZ0lDQWdZMjl2YTJsbExuQjFjMmdvSjNObFkzVnlaU2NwTzF4dUlDQWdJQ0FnSUNCOVhHNWNiaUFnSUNBZ0lDQWdaRzlqZFcxbGJuUXVZMjl2YTJsbElEMGdZMjl2YTJsbExtcHZhVzRvSnpzZ0p5azdYRzRnSUNBZ0lDQjlMRnh1WEc0Z0lDQWdJQ0J5WldGa09pQm1kVzVqZEdsdmJpQnlaV0ZrS0c1aGJXVXBJSHRjYmlBZ0lDQWdJQ0FnZG1GeUlHMWhkR05vSUQwZ1pHOWpkVzFsYm5RdVkyOXZhMmxsTG0xaGRHTm9LRzVsZHlCU1pXZEZlSEFvSnloZWZEdGNYRnhjY3lvcEtDY2dLeUJ1WVcxbElDc2dKeWs5S0Z0ZU8xMHFLU2NwS1R0Y2JpQWdJQ0FnSUNBZ2NtVjBkWEp1SUNodFlYUmphQ0EvSUdSbFkyOWtaVlZTU1VOdmJYQnZibVZ1ZENodFlYUmphRnN6WFNrZ09pQnVkV3hzS1R0Y2JpQWdJQ0FnSUgwc1hHNWNiaUFnSUNBZ0lISmxiVzkyWlRvZ1puVnVZM1JwYjI0Z2NtVnRiM1psS0c1aGJXVXBJSHRjYmlBZ0lDQWdJQ0FnZEdocGN5NTNjbWwwWlNodVlXMWxMQ0FuSnl3Z1JHRjBaUzV1YjNjb0tTQXRJRGcyTkRBd01EQXdLVHRjYmlBZ0lDQWdJSDFjYmlBZ0lDQjlPMXh1SUNCOUtTZ3BJRHBjYmx4dUlDQXZMeUJPYjI0Z2MzUmhibVJoY21RZ1luSnZkM05sY2lCbGJuWWdLSGRsWWlCM2IzSnJaWEp6TENCeVpXRmpkQzF1WVhScGRtVXBJR3hoWTJzZ2JtVmxaR1ZrSUhOMWNIQnZjblF1WEc0Z0lDaG1kVzVqZEdsdmJpQnViMjVUZEdGdVpHRnlaRUp5YjNkelpYSkZibllvS1NCN1hHNGdJQ0FnY21WMGRYSnVJSHRjYmlBZ0lDQWdJSGR5YVhSbE9pQm1kVzVqZEdsdmJpQjNjbWwwWlNncElIdDlMRnh1SUNBZ0lDQWdjbVZoWkRvZ1puVnVZM1JwYjI0Z2NtVmhaQ2dwSUhzZ2NtVjBkWEp1SUc1MWJHdzdJSDBzWEc0Z0lDQWdJQ0J5WlcxdmRtVTZJR1oxYm1OMGFXOXVJSEpsYlc5MlpTZ3BJSHQ5WEc0Z0lDQWdmVHRjYmlBZ2ZTa29LVnh1S1R0Y2JpSXNJaWQxYzJVZ2MzUnlhV04wSnp0Y2JseHVMeW9xWEc0Z0tpQkVaWFJsY20xcGJtVnpJSGRvWlhSb1pYSWdkR2hsSUhOd1pXTnBabWxsWkNCVlVrd2dhWE1nWVdKemIyeDFkR1ZjYmlBcVhHNGdLaUJBY0dGeVlXMGdlM04wY21sdVozMGdkWEpzSUZSb1pTQlZVa3dnZEc4Z2RHVnpkRnh1SUNvZ1FISmxkSFZ5Ym5NZ2UySnZiMnhsWVc1OUlGUnlkV1VnYVdZZ2RHaGxJSE53WldOcFptbGxaQ0JWVWt3Z2FYTWdZV0p6YjJ4MWRHVXNJRzkwYUdWeWQybHpaU0JtWVd4elpWeHVJQ292WEc1dGIyUjFiR1V1Wlhod2IzSjBjeUE5SUdaMWJtTjBhVzl1SUdselFXSnpiMngxZEdWVlVrd29kWEpzS1NCN1hHNGdJQzh2SUVFZ1ZWSk1JR2x6SUdOdmJuTnBaR1Z5WldRZ1lXSnpiMngxZEdVZ2FXWWdhWFFnWW1WbmFXNXpJSGRwZEdnZ1hDSThjMk5vWlcxbFBqb3ZMMXdpSUc5eUlGd2lMeTljSWlBb2NISnZkRzlqYjJ3dGNtVnNZWFJwZG1VZ1ZWSk1LUzVjYmlBZ0x5OGdVa1pESURNNU9EWWdaR1ZtYVc1bGN5QnpZMmhsYldVZ2JtRnRaU0JoY3lCaElITmxjWFZsYm1ObElHOW1JR05vWVhKaFkzUmxjbk1nWW1WbmFXNXVhVzVuSUhkcGRHZ2dZU0JzWlhSMFpYSWdZVzVrSUdadmJHeHZkMlZrWEc0Z0lDOHZJR0o1SUdGdWVTQmpiMjFpYVc1aGRHbHZiaUJ2WmlCc1pYUjBaWEp6TENCa2FXZHBkSE1zSUhCc2RYTXNJSEJsY21sdlpDd2diM0lnYUhsd2FHVnVMbHh1SUNCeVpYUjFjbTRnTDE0b1cyRXRlbDFiWVMxNlhGeGtYRndyWEZ3dFhGd3VYU282S1Q5Y1hDOWNYQzh2YVM1MFpYTjBLSFZ5YkNrN1hHNTlPMXh1SWl3aUozVnpaU0J6ZEhKcFkzUW5PMXh1WEc1MllYSWdkWFJwYkhNZ1BTQnlaWEYxYVhKbEtDY3VMeTR1TDNWMGFXeHpKeWs3WEc1Y2JtMXZaSFZzWlM1bGVIQnZjblJ6SUQwZ0tGeHVJQ0IxZEdsc2N5NXBjMU4wWVc1a1lYSmtRbkp2ZDNObGNrVnVkaWdwSUQ5Y2JseHVJQ0F2THlCVGRHRnVaR0Z5WkNCaWNtOTNjMlZ5SUdWdWRuTWdhR0YyWlNCbWRXeHNJSE4xY0hCdmNuUWdiMllnZEdobElFRlFTWE1nYm1WbFpHVmtJSFJ2SUhSbGMzUmNiaUFnTHk4Z2QyaGxkR2hsY2lCMGFHVWdjbVZ4ZFdWemRDQlZVa3dnYVhNZ2IyWWdkR2hsSUhOaGJXVWdiM0pwWjJsdUlHRnpJR04xY25KbGJuUWdiRzlqWVhScGIyNHVYRzRnSUNobWRXNWpkR2x2YmlCemRHRnVaR0Z5WkVKeWIzZHpaWEpGYm5Zb0tTQjdYRzRnSUNBZ2RtRnlJRzF6YVdVZ1BTQXZLRzF6YVdWOGRISnBaR1Z1ZENrdmFTNTBaWE4wS0c1aGRtbG5ZWFJ2Y2k1MWMyVnlRV2RsYm5RcE8xeHVJQ0FnSUhaaGNpQjFjbXhRWVhKemFXNW5UbTlrWlNBOUlHUnZZM1Z0Wlc1MExtTnlaV0YwWlVWc1pXMWxiblFvSjJFbktUdGNiaUFnSUNCMllYSWdiM0pwWjJsdVZWSk1PMXh1WEc0Z0lDQWdMeW9xWEc0Z0lDQWdLaUJRWVhKelpTQmhJRlZTVENCMGJ5QmthWE5qYjNabGNpQnBkQ2R6SUdOdmJYQnZibVZ1ZEhOY2JpQWdJQ0FxWEc0Z0lDQWdLaUJBY0dGeVlXMGdlMU4wY21sdVozMGdkWEpzSUZSb1pTQlZVa3dnZEc4Z1ltVWdjR0Z5YzJWa1hHNGdJQ0FnS2lCQWNtVjBkWEp1Y3lCN1QySnFaV04wZlZ4dUlDQWdJQ292WEc0Z0lDQWdablZ1WTNScGIyNGdjbVZ6YjJ4MlpWVlNUQ2gxY213cElIdGNiaUFnSUNBZ0lIWmhjaUJvY21WbUlEMGdkWEpzTzF4dVhHNGdJQ0FnSUNCcFppQW9iWE5wWlNrZ2UxeHVJQ0FnSUNBZ0lDQXZMeUJKUlNCdVpXVmtjeUJoZEhSeWFXSjFkR1VnYzJWMElIUjNhV05sSUhSdklHNXZjbTFoYkdsNlpTQndjbTl3WlhKMGFXVnpYRzRnSUNBZ0lDQWdJSFZ5YkZCaGNuTnBibWRPYjJSbExuTmxkRUYwZEhKcFluVjBaU2duYUhKbFppY3NJR2h5WldZcE8xeHVJQ0FnSUNBZ0lDQm9jbVZtSUQwZ2RYSnNVR0Z5YzJsdVowNXZaR1V1YUhKbFpqdGNiaUFnSUNBZ0lIMWNibHh1SUNBZ0lDQWdkWEpzVUdGeWMybHVaMDV2WkdVdWMyVjBRWFIwY21saWRYUmxLQ2RvY21WbUp5d2dhSEpsWmlrN1hHNWNiaUFnSUNBZ0lDOHZJSFZ5YkZCaGNuTnBibWRPYjJSbElIQnliM1pwWkdWeklIUm9aU0JWY214VmRHbHNjeUJwYm5SbGNtWmhZMlVnTFNCb2RIUndPaTh2ZFhKc0xuTndaV011ZDJoaGRIZG5MbTl5Wnk4amRYSnNkWFJwYkhOY2JpQWdJQ0FnSUhKbGRIVnliaUI3WEc0Z0lDQWdJQ0FnSUdoeVpXWTZJSFZ5YkZCaGNuTnBibWRPYjJSbExtaHlaV1lzWEc0Z0lDQWdJQ0FnSUhCeWIzUnZZMjlzT2lCMWNteFFZWEp6YVc1blRtOWtaUzV3Y205MGIyTnZiQ0EvSUhWeWJGQmhjbk5wYm1kT2IyUmxMbkJ5YjNSdlkyOXNMbkpsY0d4aFkyVW9Mem9rTHl3Z0p5Y3BJRG9nSnljc1hHNGdJQ0FnSUNBZ0lHaHZjM1E2SUhWeWJGQmhjbk5wYm1kT2IyUmxMbWh2YzNRc1hHNGdJQ0FnSUNBZ0lITmxZWEpqYURvZ2RYSnNVR0Z5YzJsdVowNXZaR1V1YzJWaGNtTm9JRDhnZFhKc1VHRnljMmx1WjA1dlpHVXVjMlZoY21Ob0xuSmxjR3hoWTJVb0wxNWNYRDh2TENBbkp5a2dPaUFuSnl4Y2JpQWdJQ0FnSUNBZ2FHRnphRG9nZFhKc1VHRnljMmx1WjA1dlpHVXVhR0Z6YUNBL0lIVnliRkJoY25OcGJtZE9iMlJsTG1oaGMyZ3VjbVZ3YkdGalpTZ3ZYaU12TENBbkp5a2dPaUFuSnl4Y2JpQWdJQ0FnSUNBZ2FHOXpkRzVoYldVNklIVnliRkJoY25OcGJtZE9iMlJsTG1odmMzUnVZVzFsTEZ4dUlDQWdJQ0FnSUNCd2IzSjBPaUIxY214UVlYSnphVzVuVG05a1pTNXdiM0owTEZ4dUlDQWdJQ0FnSUNCd1lYUm9ibUZ0WlRvZ0tIVnliRkJoY25OcGJtZE9iMlJsTG5CaGRHaHVZVzFsTG1Ob1lYSkJkQ2d3S1NBOVBUMGdKeThuS1NBL1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjFjbXhRWVhKemFXNW5UbTlrWlM1d1lYUm9ibUZ0WlNBNlhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQW5MeWNnS3lCMWNteFFZWEp6YVc1blRtOWtaUzV3WVhSb2JtRnRaVnh1SUNBZ0lDQWdmVHRjYmlBZ0lDQjlYRzVjYmlBZ0lDQnZjbWxuYVc1VlVrd2dQU0J5WlhOdmJIWmxWVkpNS0hkcGJtUnZkeTVzYjJOaGRHbHZiaTVvY21WbUtUdGNibHh1SUNBZ0lDOHFLbHh1SUNBZ0lDb2dSR1YwWlhKdGFXNWxJR2xtSUdFZ1ZWSk1JSE5vWVhKbGN5QjBhR1VnYzJGdFpTQnZjbWxuYVc0Z1lYTWdkR2hsSUdOMWNuSmxiblFnYkc5allYUnBiMjVjYmlBZ0lDQXFYRzRnSUNBZ0tpQkFjR0Z5WVcwZ2UxTjBjbWx1WjMwZ2NtVnhkV1Z6ZEZWU1RDQlVhR1VnVlZKTUlIUnZJSFJsYzNSY2JpQWdJQ0FxSUVCeVpYUjFjbTV6SUh0aWIyOXNaV0Z1ZlNCVWNuVmxJR2xtSUZWU1RDQnphR0Z5WlhNZ2RHaGxJSE5oYldVZ2IzSnBaMmx1TENCdmRHaGxjbmRwYzJVZ1ptRnNjMlZjYmlBZ0lDQXFMMXh1SUNBZ0lISmxkSFZ5YmlCbWRXNWpkR2x2YmlCcGMxVlNURk5oYldWUGNtbG5hVzRvY21WeGRXVnpkRlZTVENrZ2UxeHVJQ0FnSUNBZ2RtRnlJSEJoY25ObFpDQTlJQ2gxZEdsc2N5NXBjMU4wY21sdVp5aHlaWEYxWlhOMFZWSk1LU2tnUHlCeVpYTnZiSFpsVlZKTUtISmxjWFZsYzNSVlVrd3BJRG9nY21WeGRXVnpkRlZTVER0Y2JpQWdJQ0FnSUhKbGRIVnliaUFvY0dGeWMyVmtMbkJ5YjNSdlkyOXNJRDA5UFNCdmNtbG5hVzVWVWt3dWNISnZkRzlqYjJ3Z0ppWmNiaUFnSUNBZ0lDQWdJQ0FnSUhCaGNuTmxaQzVvYjNOMElEMDlQU0J2Y21sbmFXNVZVa3d1YUc5emRDazdYRzRnSUNBZ2ZUdGNiaUFnZlNrb0tTQTZYRzVjYmlBZ0x5OGdUbTl1SUhOMFlXNWtZWEprSUdKeWIzZHpaWElnWlc1MmN5QW9kMlZpSUhkdmNtdGxjbk1zSUhKbFlXTjBMVzVoZEdsMlpTa2diR0ZqYXlCdVpXVmtaV1FnYzNWd2NHOXlkQzVjYmlBZ0tHWjFibU4wYVc5dUlHNXZibE4wWVc1a1lYSmtRbkp2ZDNObGNrVnVkaWdwSUh0Y2JpQWdJQ0J5WlhSMWNtNGdablZ1WTNScGIyNGdhWE5WVWt4VFlXMWxUM0pwWjJsdUtDa2dlMXh1SUNBZ0lDQWdjbVYwZFhKdUlIUnlkV1U3WEc0Z0lDQWdmVHRjYmlBZ2ZTa29LVnh1S1R0Y2JpSXNJaWQxYzJVZ2MzUnlhV04wSnp0Y2JseHVkbUZ5SUhWMGFXeHpJRDBnY21WeGRXbHlaU2duTGk0dmRYUnBiSE1uS1R0Y2JseHViVzlrZFd4bExtVjRjRzl5ZEhNZ1BTQm1kVzVqZEdsdmJpQnViM0p0WVd4cGVtVklaV0ZrWlhKT1lXMWxLR2hsWVdSbGNuTXNJRzV2Y20xaGJHbDZaV1JPWVcxbEtTQjdYRzRnSUhWMGFXeHpMbVp2Y2tWaFkyZ29hR1ZoWkdWeWN5d2dablZ1WTNScGIyNGdjSEp2WTJWemMwaGxZV1JsY2loMllXeDFaU3dnYm1GdFpTa2dlMXh1SUNBZ0lHbG1JQ2h1WVcxbElDRTlQU0J1YjNKdFlXeHBlbVZrVG1GdFpTQW1KaUJ1WVcxbExuUnZWWEJ3WlhKRFlYTmxLQ2tnUFQwOUlHNXZjbTFoYkdsNlpXUk9ZVzFsTG5SdlZYQndaWEpEWVhObEtDa3BJSHRjYmlBZ0lDQWdJR2hsWVdSbGNuTmJibTl5YldGc2FYcGxaRTVoYldWZElEMGdkbUZzZFdVN1hHNGdJQ0FnSUNCa1pXeGxkR1VnYUdWaFpHVnljMXR1WVcxbFhUdGNiaUFnSUNCOVhHNGdJSDBwTzF4dWZUdGNiaUlzSWlkMWMyVWdjM1J5YVdOMEp6dGNibHh1ZG1GeUlIVjBhV3h6SUQwZ2NtVnhkV2x5WlNnbkxpOHVMaTkxZEdsc2N5Y3BPMXh1WEc0dktpcGNiaUFxSUZCaGNuTmxJR2hsWVdSbGNuTWdhVzUwYnlCaGJpQnZZbXBsWTNSY2JpQXFYRzRnS2lCZ1lHQmNiaUFxSUVSaGRHVTZJRmRsWkN3Z01qY2dRWFZuSURJd01UUWdNRGc2TlRnNk5Ea2dSMDFVWEc0Z0tpQkRiMjUwWlc1MExWUjVjR1U2SUdGd2NHeHBZMkYwYVc5dUwycHpiMjVjYmlBcUlFTnZibTVsWTNScGIyNDZJR3RsWlhBdFlXeHBkbVZjYmlBcUlGUnlZVzV6Wm1WeUxVVnVZMjlrYVc1bk9pQmphSFZ1YTJWa1hHNGdLaUJnWUdCY2JpQXFYRzRnS2lCQWNHRnlZVzBnZTFOMGNtbHVaMzBnYUdWaFpHVnljeUJJWldGa1pYSnpJRzVsWldScGJtY2dkRzhnWW1VZ2NHRnljMlZrWEc0Z0tpQkFjbVYwZFhKdWN5QjdUMkpxWldOMGZTQklaV0ZrWlhKeklIQmhjbk5sWkNCcGJuUnZJR0Z1SUc5aWFtVmpkRnh1SUNvdlhHNXRiMlIxYkdVdVpYaHdiM0owY3lBOUlHWjFibU4wYVc5dUlIQmhjbk5sU0dWaFpHVnljeWhvWldGa1pYSnpLU0I3WEc0Z0lIWmhjaUJ3WVhKelpXUWdQU0I3ZlR0Y2JpQWdkbUZ5SUd0bGVUdGNiaUFnZG1GeUlIWmhiRHRjYmlBZ2RtRnlJR2s3WEc1Y2JpQWdhV1lnS0NGb1pXRmtaWEp6S1NCN0lISmxkSFZ5YmlCd1lYSnpaV1E3SUgxY2JseHVJQ0IxZEdsc2N5NW1iM0pGWVdOb0tHaGxZV1JsY25NdWMzQnNhWFFvSjF4Y2JpY3BMQ0JtZFc1amRHbHZiaUJ3WVhKelpYSW9iR2x1WlNrZ2UxeHVJQ0FnSUdrZ1BTQnNhVzVsTG1sdVpHVjRUMllvSnpvbktUdGNiaUFnSUNCclpYa2dQU0IxZEdsc2N5NTBjbWx0S0d4cGJtVXVjM1ZpYzNSeUtEQXNJR2twS1M1MGIweHZkMlZ5UTJGelpTZ3BPMXh1SUNBZ0lIWmhiQ0E5SUhWMGFXeHpMblJ5YVcwb2JHbHVaUzV6ZFdKemRISW9hU0FySURFcEtUdGNibHh1SUNBZ0lHbG1JQ2hyWlhrcElIdGNiaUFnSUNBZ0lIQmhjbk5sWkZ0clpYbGRJRDBnY0dGeWMyVmtXMnRsZVYwZ1B5QndZWEp6WldSYmEyVjVYU0FySUNjc0lDY2dLeUIyWVd3Z09pQjJZV3c3WEc0Z0lDQWdmVnh1SUNCOUtUdGNibHh1SUNCeVpYUjFjbTRnY0dGeWMyVmtPMXh1ZlR0Y2JpSXNJaWQxYzJVZ2MzUnlhV04wSnp0Y2JseHVMeW9xWEc0Z0tpQlRlVzUwWVdOMGFXTWdjM1ZuWVhJZ1ptOXlJR2x1ZG05cmFXNW5JR0VnWm5WdVkzUnBiMjRnWVc1a0lHVjRjR0Z1WkdsdVp5QmhiaUJoY25KaGVTQm1iM0lnWVhKbmRXMWxiblJ6TGx4dUlDcGNiaUFxSUVOdmJXMXZiaUIxYzJVZ1kyRnpaU0IzYjNWc1pDQmlaU0IwYnlCMWMyVWdZRVoxYm1OMGFXOXVMbkJ5YjNSdmRIbHdaUzVoY0hCc2VXQXVYRzRnS2x4dUlDb2dJR0JnWUdwelhHNGdLaUFnWm5WdVkzUnBiMjRnWmloNExDQjVMQ0I2S1NCN2ZWeHVJQ29nSUhaaGNpQmhjbWR6SUQwZ1d6RXNJRElzSUROZE8xeHVJQ29nSUdZdVlYQndiSGtvYm5Wc2JDd2dZWEpuY3lrN1hHNGdLaUFnWUdCZ1hHNGdLbHh1SUNvZ1YybDBhQ0JnYzNCeVpXRmtZQ0IwYUdseklHVjRZVzF3YkdVZ1kyRnVJR0psSUhKbExYZHlhWFIwWlc0dVhHNGdLbHh1SUNvZ0lHQmdZR3B6WEc0Z0tpQWdjM0J5WldGa0tHWjFibU4wYVc5dUtIZ3NJSGtzSUhvcElIdDlLU2hiTVN3Z01pd2dNMTBwTzF4dUlDb2dJR0JnWUZ4dUlDcGNiaUFxSUVCd1lYSmhiU0I3Um5WdVkzUnBiMjU5SUdOaGJHeGlZV05yWEc0Z0tpQkFjbVYwZFhKdWN5QjdSblZ1WTNScGIyNTlYRzRnS2k5Y2JtMXZaSFZzWlM1bGVIQnZjblJ6SUQwZ1puVnVZM1JwYjI0Z2MzQnlaV0ZrS0dOaGJHeGlZV05yS1NCN1hHNGdJSEpsZEhWeWJpQm1kVzVqZEdsdmJpQjNjbUZ3S0dGeWNpa2dlMXh1SUNBZ0lISmxkSFZ5YmlCallXeHNZbUZqYXk1aGNIQnNlU2h1ZFd4c0xDQmhjbklwTzF4dUlDQjlPMXh1ZlR0Y2JpSXNJaWQxYzJVZ2MzUnlhV04wSnp0Y2JseHVkbUZ5SUdKcGJtUWdQU0J5WlhGMWFYSmxLQ2N1TDJobGJIQmxjbk12WW1sdVpDY3BPMXh1ZG1GeUlHbHpRblZtWm1WeUlEMGdjbVZ4ZFdseVpTZ25hWE10WW5WbVptVnlKeWs3WEc1Y2JpOHFaMnh2WW1Gc0lIUnZVM1J5YVc1bk9uUnlkV1VxTDF4dVhHNHZMeUIxZEdsc2N5QnBjeUJoSUd4cFluSmhjbmtnYjJZZ1oyVnVaWEpwWXlCb1pXeHdaWElnWm5WdVkzUnBiMjV6SUc1dmJpMXpjR1ZqYVdacFl5QjBieUJoZUdsdmMxeHVYRzUyWVhJZ2RHOVRkSEpwYm1jZ1BTQlBZbXBsWTNRdWNISnZkRzkwZVhCbExuUnZVM1J5YVc1bk8xeHVYRzR2S2lwY2JpQXFJRVJsZEdWeWJXbHVaU0JwWmlCaElIWmhiSFZsSUdseklHRnVJRUZ5Y21GNVhHNGdLbHh1SUNvZ1FIQmhjbUZ0SUh0UFltcGxZM1I5SUhaaGJDQlVhR1VnZG1Gc2RXVWdkRzhnZEdWemRGeHVJQ29nUUhKbGRIVnlibk1nZTJKdmIyeGxZVzU5SUZSeWRXVWdhV1lnZG1Gc2RXVWdhWE1nWVc0Z1FYSnlZWGtzSUc5MGFHVnlkMmx6WlNCbVlXeHpaVnh1SUNvdlhHNW1kVzVqZEdsdmJpQnBjMEZ5Y21GNUtIWmhiQ2tnZTF4dUlDQnlaWFIxY200Z2RHOVRkSEpwYm1jdVkyRnNiQ2gyWVd3cElEMDlQU0FuVzI5aWFtVmpkQ0JCY25KaGVWMG5PMXh1ZlZ4dVhHNHZLaXBjYmlBcUlFUmxkR1Z5YldsdVpTQnBaaUJoSUhaaGJIVmxJR2x6SUdGdUlFRnljbUY1UW5WbVptVnlYRzRnS2x4dUlDb2dRSEJoY21GdElIdFBZbXBsWTNSOUlIWmhiQ0JVYUdVZ2RtRnNkV1VnZEc4Z2RHVnpkRnh1SUNvZ1FISmxkSFZ5Ym5NZ2UySnZiMnhsWVc1OUlGUnlkV1VnYVdZZ2RtRnNkV1VnYVhNZ1lXNGdRWEp5WVhsQ2RXWm1aWElzSUc5MGFHVnlkMmx6WlNCbVlXeHpaVnh1SUNvdlhHNW1kVzVqZEdsdmJpQnBjMEZ5Y21GNVFuVm1abVZ5S0haaGJDa2dlMXh1SUNCeVpYUjFjbTRnZEc5VGRISnBibWN1WTJGc2JDaDJZV3dwSUQwOVBTQW5XMjlpYW1WamRDQkJjbkpoZVVKMVptWmxjbDBuTzF4dWZWeHVYRzR2S2lwY2JpQXFJRVJsZEdWeWJXbHVaU0JwWmlCaElIWmhiSFZsSUdseklHRWdSbTl5YlVSaGRHRmNiaUFxWEc0Z0tpQkFjR0Z5WVcwZ2UwOWlhbVZqZEgwZ2RtRnNJRlJvWlNCMllXeDFaU0IwYnlCMFpYTjBYRzRnS2lCQWNtVjBkWEp1Y3lCN1ltOXZiR1ZoYm4wZ1ZISjFaU0JwWmlCMllXeDFaU0JwY3lCaGJpQkdiM0p0UkdGMFlTd2diM1JvWlhKM2FYTmxJR1poYkhObFhHNGdLaTljYm1aMWJtTjBhVzl1SUdselJtOXliVVJoZEdFb2RtRnNLU0I3WEc0Z0lISmxkSFZ5YmlBb2RIbHdaVzltSUVadmNtMUVZWFJoSUNFOVBTQW5kVzVrWldacGJtVmtKeWtnSmlZZ0tIWmhiQ0JwYm5OMFlXNWpaVzltSUVadmNtMUVZWFJoS1R0Y2JuMWNibHh1THlvcVhHNGdLaUJFWlhSbGNtMXBibVVnYVdZZ1lTQjJZV3gxWlNCcGN5QmhJSFpwWlhjZ2IyNGdZVzRnUVhKeVlYbENkV1ptWlhKY2JpQXFYRzRnS2lCQWNHRnlZVzBnZTA5aWFtVmpkSDBnZG1Gc0lGUm9aU0IyWVd4MVpTQjBieUIwWlhOMFhHNGdLaUJBY21WMGRYSnVjeUI3WW05dmJHVmhibjBnVkhKMVpTQnBaaUIyWVd4MVpTQnBjeUJoSUhacFpYY2diMjRnWVc0Z1FYSnlZWGxDZFdabVpYSXNJRzkwYUdWeWQybHpaU0JtWVd4elpWeHVJQ292WEc1bWRXNWpkR2x2YmlCcGMwRnljbUY1UW5WbVptVnlWbWxsZHloMllXd3BJSHRjYmlBZ2RtRnlJSEpsYzNWc2REdGNiaUFnYVdZZ0tDaDBlWEJsYjJZZ1FYSnlZWGxDZFdabVpYSWdJVDA5SUNkMWJtUmxabWx1WldRbktTQW1KaUFvUVhKeVlYbENkV1ptWlhJdWFYTldhV1YzS1NrZ2UxeHVJQ0FnSUhKbGMzVnNkQ0E5SUVGeWNtRjVRblZtWm1WeUxtbHpWbWxsZHloMllXd3BPMXh1SUNCOUlHVnNjMlVnZTF4dUlDQWdJSEpsYzNWc2RDQTlJQ2gyWVd3cElDWW1JQ2gyWVd3dVluVm1abVZ5S1NBbUppQW9kbUZzTG1KMVptWmxjaUJwYm5OMFlXNWpaVzltSUVGeWNtRjVRblZtWm1WeUtUdGNiaUFnZlZ4dUlDQnlaWFIxY200Z2NtVnpkV3gwTzF4dWZWeHVYRzR2S2lwY2JpQXFJRVJsZEdWeWJXbHVaU0JwWmlCaElIWmhiSFZsSUdseklHRWdVM1J5YVc1blhHNGdLbHh1SUNvZ1FIQmhjbUZ0SUh0UFltcGxZM1I5SUhaaGJDQlVhR1VnZG1Gc2RXVWdkRzhnZEdWemRGeHVJQ29nUUhKbGRIVnlibk1nZTJKdmIyeGxZVzU5SUZSeWRXVWdhV1lnZG1Gc2RXVWdhWE1nWVNCVGRISnBibWNzSUc5MGFHVnlkMmx6WlNCbVlXeHpaVnh1SUNvdlhHNW1kVzVqZEdsdmJpQnBjMU4wY21sdVp5aDJZV3dwSUh0Y2JpQWdjbVYwZFhKdUlIUjVjR1Z2WmlCMllXd2dQVDA5SUNkemRISnBibWNuTzF4dWZWeHVYRzR2S2lwY2JpQXFJRVJsZEdWeWJXbHVaU0JwWmlCaElIWmhiSFZsSUdseklHRWdUblZ0WW1WeVhHNGdLbHh1SUNvZ1FIQmhjbUZ0SUh0UFltcGxZM1I5SUhaaGJDQlVhR1VnZG1Gc2RXVWdkRzhnZEdWemRGeHVJQ29nUUhKbGRIVnlibk1nZTJKdmIyeGxZVzU5SUZSeWRXVWdhV1lnZG1Gc2RXVWdhWE1nWVNCT2RXMWlaWElzSUc5MGFHVnlkMmx6WlNCbVlXeHpaVnh1SUNvdlhHNW1kVzVqZEdsdmJpQnBjMDUxYldKbGNpaDJZV3dwSUh0Y2JpQWdjbVYwZFhKdUlIUjVjR1Z2WmlCMllXd2dQVDA5SUNkdWRXMWlaWEluTzF4dWZWeHVYRzR2S2lwY2JpQXFJRVJsZEdWeWJXbHVaU0JwWmlCaElIWmhiSFZsSUdseklIVnVaR1ZtYVc1bFpGeHVJQ3BjYmlBcUlFQndZWEpoYlNCN1QySnFaV04wZlNCMllXd2dWR2hsSUhaaGJIVmxJSFJ2SUhSbGMzUmNiaUFxSUVCeVpYUjFjbTV6SUh0aWIyOXNaV0Z1ZlNCVWNuVmxJR2xtSUhSb1pTQjJZV3gxWlNCcGN5QjFibVJsWm1sdVpXUXNJRzkwYUdWeWQybHpaU0JtWVd4elpWeHVJQ292WEc1bWRXNWpkR2x2YmlCcGMxVnVaR1ZtYVc1bFpDaDJZV3dwSUh0Y2JpQWdjbVYwZFhKdUlIUjVjR1Z2WmlCMllXd2dQVDA5SUNkMWJtUmxabWx1WldRbk8xeHVmVnh1WEc0dktpcGNiaUFxSUVSbGRHVnliV2x1WlNCcFppQmhJSFpoYkhWbElHbHpJR0Z1SUU5aWFtVmpkRnh1SUNwY2JpQXFJRUJ3WVhKaGJTQjdUMkpxWldOMGZTQjJZV3dnVkdobElIWmhiSFZsSUhSdklIUmxjM1JjYmlBcUlFQnlaWFIxY201eklIdGliMjlzWldGdWZTQlVjblZsSUdsbUlIWmhiSFZsSUdseklHRnVJRTlpYW1WamRDd2diM1JvWlhKM2FYTmxJR1poYkhObFhHNGdLaTljYm1aMWJtTjBhVzl1SUdselQySnFaV04wS0haaGJDa2dlMXh1SUNCeVpYUjFjbTRnZG1Gc0lDRTlQU0J1ZFd4c0lDWW1JSFI1Y0dWdlppQjJZV3dnUFQwOUlDZHZZbXBsWTNRbk8xeHVmVnh1WEc0dktpcGNiaUFxSUVSbGRHVnliV2x1WlNCcFppQmhJSFpoYkhWbElHbHpJR0VnUkdGMFpWeHVJQ3BjYmlBcUlFQndZWEpoYlNCN1QySnFaV04wZlNCMllXd2dWR2hsSUhaaGJIVmxJSFJ2SUhSbGMzUmNiaUFxSUVCeVpYUjFjbTV6SUh0aWIyOXNaV0Z1ZlNCVWNuVmxJR2xtSUhaaGJIVmxJR2x6SUdFZ1JHRjBaU3dnYjNSb1pYSjNhWE5sSUdaaGJITmxYRzRnS2k5Y2JtWjFibU4wYVc5dUlHbHpSR0YwWlNoMllXd3BJSHRjYmlBZ2NtVjBkWEp1SUhSdlUzUnlhVzVuTG1OaGJHd29kbUZzS1NBOVBUMGdKMXR2WW1wbFkzUWdSR0YwWlYwbk8xeHVmVnh1WEc0dktpcGNiaUFxSUVSbGRHVnliV2x1WlNCcFppQmhJSFpoYkhWbElHbHpJR0VnUm1sc1pWeHVJQ3BjYmlBcUlFQndZWEpoYlNCN1QySnFaV04wZlNCMllXd2dWR2hsSUhaaGJIVmxJSFJ2SUhSbGMzUmNiaUFxSUVCeVpYUjFjbTV6SUh0aWIyOXNaV0Z1ZlNCVWNuVmxJR2xtSUhaaGJIVmxJR2x6SUdFZ1JtbHNaU3dnYjNSb1pYSjNhWE5sSUdaaGJITmxYRzRnS2k5Y2JtWjFibU4wYVc5dUlHbHpSbWxzWlNoMllXd3BJSHRjYmlBZ2NtVjBkWEp1SUhSdlUzUnlhVzVuTG1OaGJHd29kbUZzS1NBOVBUMGdKMXR2WW1wbFkzUWdSbWxzWlYwbk8xeHVmVnh1WEc0dktpcGNiaUFxSUVSbGRHVnliV2x1WlNCcFppQmhJSFpoYkhWbElHbHpJR0VnUW14dllseHVJQ3BjYmlBcUlFQndZWEpoYlNCN1QySnFaV04wZlNCMllXd2dWR2hsSUhaaGJIVmxJSFJ2SUhSbGMzUmNiaUFxSUVCeVpYUjFjbTV6SUh0aWIyOXNaV0Z1ZlNCVWNuVmxJR2xtSUhaaGJIVmxJR2x6SUdFZ1FteHZZaXdnYjNSb1pYSjNhWE5sSUdaaGJITmxYRzRnS2k5Y2JtWjFibU4wYVc5dUlHbHpRbXh2WWloMllXd3BJSHRjYmlBZ2NtVjBkWEp1SUhSdlUzUnlhVzVuTG1OaGJHd29kbUZzS1NBOVBUMGdKMXR2WW1wbFkzUWdRbXh2WWwwbk8xeHVmVnh1WEc0dktpcGNiaUFxSUVSbGRHVnliV2x1WlNCcFppQmhJSFpoYkhWbElHbHpJR0VnUm5WdVkzUnBiMjVjYmlBcVhHNGdLaUJBY0dGeVlXMGdlMDlpYW1WamRIMGdkbUZzSUZSb1pTQjJZV3gxWlNCMGJ5QjBaWE4wWEc0Z0tpQkFjbVYwZFhKdWN5QjdZbTl2YkdWaGJuMGdWSEoxWlNCcFppQjJZV3gxWlNCcGN5QmhJRVoxYm1OMGFXOXVMQ0J2ZEdobGNuZHBjMlVnWm1Gc2MyVmNiaUFxTDF4dVpuVnVZM1JwYjI0Z2FYTkdkVzVqZEdsdmJpaDJZV3dwSUh0Y2JpQWdjbVYwZFhKdUlIUnZVM1J5YVc1bkxtTmhiR3dvZG1Gc0tTQTlQVDBnSjF0dlltcGxZM1FnUm5WdVkzUnBiMjVkSnp0Y2JuMWNibHh1THlvcVhHNGdLaUJFWlhSbGNtMXBibVVnYVdZZ1lTQjJZV3gxWlNCcGN5QmhJRk4wY21WaGJWeHVJQ3BjYmlBcUlFQndZWEpoYlNCN1QySnFaV04wZlNCMllXd2dWR2hsSUhaaGJIVmxJSFJ2SUhSbGMzUmNiaUFxSUVCeVpYUjFjbTV6SUh0aWIyOXNaV0Z1ZlNCVWNuVmxJR2xtSUhaaGJIVmxJR2x6SUdFZ1UzUnlaV0Z0TENCdmRHaGxjbmRwYzJVZ1ptRnNjMlZjYmlBcUwxeHVablZ1WTNScGIyNGdhWE5UZEhKbFlXMG9kbUZzS1NCN1hHNGdJSEpsZEhWeWJpQnBjMDlpYW1WamRDaDJZV3dwSUNZbUlHbHpSblZ1WTNScGIyNG9kbUZzTG5CcGNHVXBPMXh1ZlZ4dVhHNHZLaXBjYmlBcUlFUmxkR1Z5YldsdVpTQnBaaUJoSUhaaGJIVmxJR2x6SUdFZ1ZWSk1VMlZoY21Ob1VHRnlZVzF6SUc5aWFtVmpkRnh1SUNwY2JpQXFJRUJ3WVhKaGJTQjdUMkpxWldOMGZTQjJZV3dnVkdobElIWmhiSFZsSUhSdklIUmxjM1JjYmlBcUlFQnlaWFIxY201eklIdGliMjlzWldGdWZTQlVjblZsSUdsbUlIWmhiSFZsSUdseklHRWdWVkpNVTJWaGNtTm9VR0Z5WVcxeklHOWlhbVZqZEN3Z2IzUm9aWEozYVhObElHWmhiSE5sWEc0Z0tpOWNibVoxYm1OMGFXOXVJR2x6VlZKTVUyVmhjbU5vVUdGeVlXMXpLSFpoYkNrZ2UxeHVJQ0J5WlhSMWNtNGdkSGx3Wlc5bUlGVlNURk5sWVhKamFGQmhjbUZ0Y3lBaFBUMGdKM1Z1WkdWbWFXNWxaQ2NnSmlZZ2RtRnNJR2x1YzNSaGJtTmxiMllnVlZKTVUyVmhjbU5vVUdGeVlXMXpPMXh1ZlZ4dVhHNHZLaXBjYmlBcUlGUnlhVzBnWlhoalpYTnpJSGRvYVhSbGMzQmhZMlVnYjJabUlIUm9aU0JpWldkcGJtNXBibWNnWVc1a0lHVnVaQ0J2WmlCaElITjBjbWx1WjF4dUlDcGNiaUFxSUVCd1lYSmhiU0I3VTNSeWFXNW5mU0J6ZEhJZ1ZHaGxJRk4wY21sdVp5QjBieUIwY21sdFhHNGdLaUJBY21WMGRYSnVjeUI3VTNSeWFXNW5mU0JVYUdVZ1UzUnlhVzVuSUdaeVpXVmtJRzltSUdWNFkyVnpjeUIzYUdsMFpYTndZV05sWEc0Z0tpOWNibVoxYm1OMGFXOXVJSFJ5YVcwb2MzUnlLU0I3WEc0Z0lISmxkSFZ5YmlCemRISXVjbVZ3YkdGalpTZ3ZYbHhjY3lvdkxDQW5KeWt1Y21Wd2JHRmpaU2d2WEZ4ektpUXZMQ0FuSnlrN1hHNTlYRzVjYmk4cUtseHVJQ29nUkdWMFpYSnRhVzVsSUdsbUlIZGxKM0psSUhKMWJtNXBibWNnYVc0Z1lTQnpkR0Z1WkdGeVpDQmljbTkzYzJWeUlHVnVkbWx5YjI1dFpXNTBYRzRnS2x4dUlDb2dWR2hwY3lCaGJHeHZkM01nWVhocGIzTWdkRzhnY25WdUlHbHVJR0VnZDJWaUlIZHZjbXRsY2l3Z1lXNWtJSEpsWVdOMExXNWhkR2wyWlM1Y2JpQXFJRUp2ZEdnZ1pXNTJhWEp2Ym0xbGJuUnpJSE4xY0hCdmNuUWdXRTFNU0hSMGNGSmxjWFZsYzNRc0lHSjFkQ0J1YjNRZ1puVnNiSGtnYzNSaGJtUmhjbVFnWjJ4dlltRnNjeTVjYmlBcVhHNGdLaUIzWldJZ2QyOXlhMlZ5Y3pwY2JpQXFJQ0IwZVhCbGIyWWdkMmx1Wkc5M0lDMCtJSFZ1WkdWbWFXNWxaRnh1SUNvZ0lIUjVjR1Z2WmlCa2IyTjFiV1Z1ZENBdFBpQjFibVJsWm1sdVpXUmNiaUFxWEc0Z0tpQnlaV0ZqZEMxdVlYUnBkbVU2WEc0Z0tpQWdibUYyYVdkaGRHOXlMbkJ5YjJSMVkzUWdMVDRnSjFKbFlXTjBUbUYwYVhabEoxeHVJQ292WEc1bWRXNWpkR2x2YmlCcGMxTjBZVzVrWVhKa1FuSnZkM05sY2tWdWRpZ3BJSHRjYmlBZ2FXWWdLSFI1Y0dWdlppQnVZWFpwWjJGMGIzSWdJVDA5SUNkMWJtUmxabWx1WldRbklDWW1JRzVoZG1sbllYUnZjaTV3Y205a2RXTjBJRDA5UFNBblVtVmhZM1JPWVhScGRtVW5LU0I3WEc0Z0lDQWdjbVYwZFhKdUlHWmhiSE5sTzF4dUlDQjlYRzRnSUhKbGRIVnliaUFvWEc0Z0lDQWdkSGx3Wlc5bUlIZHBibVJ2ZHlBaFBUMGdKM1Z1WkdWbWFXNWxaQ2NnSmlaY2JpQWdJQ0IwZVhCbGIyWWdaRzlqZFcxbGJuUWdJVDA5SUNkMWJtUmxabWx1WldRblhHNGdJQ2s3WEc1OVhHNWNiaThxS2x4dUlDb2dTWFJsY21GMFpTQnZkbVZ5SUdGdUlFRnljbUY1SUc5eUlHRnVJRTlpYW1WamRDQnBiblp2YTJsdVp5QmhJR1oxYm1OMGFXOXVJR1p2Y2lCbFlXTm9JR2wwWlcwdVhHNGdLbHh1SUNvZ1NXWWdZRzlpYW1BZ2FYTWdZVzRnUVhKeVlYa2dZMkZzYkdKaFkyc2dkMmxzYkNCaVpTQmpZV3hzWldRZ2NHRnpjMmx1WjF4dUlDb2dkR2hsSUhaaGJIVmxMQ0JwYm1SbGVDd2dZVzVrSUdOdmJYQnNaWFJsSUdGeWNtRjVJR1p2Y2lCbFlXTm9JR2wwWlcwdVhHNGdLbHh1SUNvZ1NXWWdKMjlpYWljZ2FYTWdZVzRnVDJKcVpXTjBJR05oYkd4aVlXTnJJSGRwYkd3Z1ltVWdZMkZzYkdWa0lIQmhjM05wYm1kY2JpQXFJSFJvWlNCMllXeDFaU3dnYTJWNUxDQmhibVFnWTI5dGNHeGxkR1VnYjJKcVpXTjBJR1p2Y2lCbFlXTm9JSEJ5YjNCbGNuUjVMbHh1SUNwY2JpQXFJRUJ3WVhKaGJTQjdUMkpxWldOMGZFRnljbUY1ZlNCdlltb2dWR2hsSUc5aWFtVmpkQ0IwYnlCcGRHVnlZWFJsWEc0Z0tpQkFjR0Z5WVcwZ2UwWjFibU4wYVc5dWZTQm1iaUJVYUdVZ1kyRnNiR0poWTJzZ2RHOGdhVzUyYjJ0bElHWnZjaUJsWVdOb0lHbDBaVzFjYmlBcUwxeHVablZ1WTNScGIyNGdabTl5UldGamFDaHZZbW9zSUdadUtTQjdYRzRnSUM4dklFUnZiaWQwSUdKdmRHaGxjaUJwWmlCdWJ5QjJZV3gxWlNCd2NtOTJhV1JsWkZ4dUlDQnBaaUFvYjJKcUlEMDlQU0J1ZFd4c0lIeDhJSFI1Y0dWdlppQnZZbW9nUFQwOUlDZDFibVJsWm1sdVpXUW5LU0I3WEc0Z0lDQWdjbVYwZFhKdU8xeHVJQ0I5WEc1Y2JpQWdMeThnUm05eVkyVWdZVzRnWVhKeVlYa2dhV1lnYm05MElHRnNjbVZoWkhrZ2MyOXRaWFJvYVc1bklHbDBaWEpoWW14bFhHNGdJR2xtSUNoMGVYQmxiMllnYjJKcUlDRTlQU0FuYjJKcVpXTjBKeUFtSmlBaGFYTkJjbkpoZVNodlltb3BLU0I3WEc0Z0lDQWdMeXBsYzJ4cGJuUWdibTh0Y0dGeVlXMHRjbVZoYzNOcFoyNDZNQ292WEc0Z0lDQWdiMkpxSUQwZ1cyOWlhbDA3WEc0Z0lIMWNibHh1SUNCcFppQW9hWE5CY25KaGVTaHZZbW9wS1NCN1hHNGdJQ0FnTHk4Z1NYUmxjbUYwWlNCdmRtVnlJR0Z5Y21GNUlIWmhiSFZsYzF4dUlDQWdJR1p2Y2lBb2RtRnlJR2tnUFNBd0xDQnNJRDBnYjJKcUxteGxibWQwYURzZ2FTQThJR3c3SUdrckt5a2dlMXh1SUNBZ0lDQWdabTR1WTJGc2JDaHVkV3hzTENCdlltcGJhVjBzSUdrc0lHOWlhaWs3WEc0Z0lDQWdmVnh1SUNCOUlHVnNjMlVnZTF4dUlDQWdJQzh2SUVsMFpYSmhkR1VnYjNabGNpQnZZbXBsWTNRZ2EyVjVjMXh1SUNBZ0lHWnZjaUFvZG1GeUlHdGxlU0JwYmlCdlltb3BJSHRjYmlBZ0lDQWdJR2xtSUNoUFltcGxZM1F1Y0hKdmRHOTBlWEJsTG1oaGMwOTNibEJ5YjNCbGNuUjVMbU5oYkd3b2IySnFMQ0JyWlhrcEtTQjdYRzRnSUNBZ0lDQWdJR1p1TG1OaGJHd29iblZzYkN3Z2IySnFXMnRsZVYwc0lHdGxlU3dnYjJKcUtUdGNiaUFnSUNBZ0lIMWNiaUFnSUNCOVhHNGdJSDFjYm4xY2JseHVMeW9xWEc0Z0tpQkJZMk5sY0hSeklIWmhjbUZ5WjNNZ1pYaHdaV04wYVc1bklHVmhZMmdnWVhKbmRXMWxiblFnZEc4Z1ltVWdZVzRnYjJKcVpXTjBMQ0IwYUdWdVhHNGdLaUJwYlcxMWRHRmliSGtnYldWeVoyVnpJSFJvWlNCd2NtOXdaWEowYVdWeklHOW1JR1ZoWTJnZ2IySnFaV04wSUdGdVpDQnlaWFIxY201eklISmxjM1ZzZEM1Y2JpQXFYRzRnS2lCWGFHVnVJRzExYkhScGNHeGxJRzlpYW1WamRITWdZMjl1ZEdGcGJpQjBhR1VnYzJGdFpTQnJaWGtnZEdobElHeGhkR1Z5SUc5aWFtVmpkQ0JwYmx4dUlDb2dkR2hsSUdGeVozVnRaVzUwY3lCc2FYTjBJSGRwYkd3Z2RHRnJaU0J3Y21WalpXUmxibU5sTGx4dUlDcGNiaUFxSUVWNFlXMXdiR1U2WEc0Z0tseHVJQ29nWUdCZ2FuTmNiaUFxSUhaaGNpQnlaWE4xYkhRZ1BTQnRaWEpuWlNoN1ptOXZPaUF4TWpOOUxDQjdabTl2T2lBME5UWjlLVHRjYmlBcUlHTnZibk52YkdVdWJHOW5LSEpsYzNWc2RDNW1iMjhwT3lBdkx5QnZkWFJ3ZFhSeklEUTFObHh1SUNvZ1lHQmdYRzRnS2x4dUlDb2dRSEJoY21GdElIdFBZbXBsWTNSOUlHOWlhakVnVDJKcVpXTjBJSFJ2SUcxbGNtZGxYRzRnS2lCQWNtVjBkWEp1Y3lCN1QySnFaV04wZlNCU1pYTjFiSFFnYjJZZ1lXeHNJRzFsY21kbElIQnliM0JsY25ScFpYTmNiaUFxTDF4dVpuVnVZM1JwYjI0Z2JXVnlaMlVvTHlvZ2IySnFNU3dnYjJKcU1pd2diMkpxTXl3Z0xpNHVJQ292S1NCN1hHNGdJSFpoY2lCeVpYTjFiSFFnUFNCN2ZUdGNiaUFnWm5WdVkzUnBiMjRnWVhOemFXZHVWbUZzZFdVb2RtRnNMQ0JyWlhrcElIdGNiaUFnSUNCcFppQW9kSGx3Wlc5bUlISmxjM1ZzZEZ0clpYbGRJRDA5UFNBbmIySnFaV04wSnlBbUppQjBlWEJsYjJZZ2RtRnNJRDA5UFNBbmIySnFaV04wSnlrZ2UxeHVJQ0FnSUNBZ2NtVnpkV3gwVzJ0bGVWMGdQU0J0WlhKblpTaHlaWE4xYkhSYmEyVjVYU3dnZG1Gc0tUdGNiaUFnSUNCOUlHVnNjMlVnZTF4dUlDQWdJQ0FnY21WemRXeDBXMnRsZVYwZ1BTQjJZV3c3WEc0Z0lDQWdmVnh1SUNCOVhHNWNiaUFnWm05eUlDaDJZWElnYVNBOUlEQXNJR3dnUFNCaGNtZDFiV1Z1ZEhNdWJHVnVaM1JvT3lCcElEd2diRHNnYVNzcktTQjdYRzRnSUNBZ1ptOXlSV0ZqYUNoaGNtZDFiV1Z1ZEhOYmFWMHNJR0Z6YzJsbmJsWmhiSFZsS1R0Y2JpQWdmVnh1SUNCeVpYUjFjbTRnY21WemRXeDBPMXh1ZlZ4dVhHNHZLaXBjYmlBcUlFVjRkR1Z1WkhNZ2IySnFaV04wSUdFZ1lua2diWFYwWVdKc2VTQmhaR1JwYm1jZ2RHOGdhWFFnZEdobElIQnliM0JsY25ScFpYTWdiMllnYjJKcVpXTjBJR0l1WEc0Z0tseHVJQ29nUUhCaGNtRnRJSHRQWW1wbFkzUjlJR0VnVkdobElHOWlhbVZqZENCMGJ5QmlaU0JsZUhSbGJtUmxaRnh1SUNvZ1FIQmhjbUZ0SUh0UFltcGxZM1I5SUdJZ1ZHaGxJRzlpYW1WamRDQjBieUJqYjNCNUlIQnliM0JsY25ScFpYTWdabkp2YlZ4dUlDb2dRSEJoY21GdElIdFBZbXBsWTNSOUlIUm9hWE5CY21jZ1ZHaGxJRzlpYW1WamRDQjBieUJpYVc1a0lHWjFibU4wYVc5dUlIUnZYRzRnS2lCQWNtVjBkWEp1SUh0UFltcGxZM1I5SUZSb1pTQnlaWE4xYkhScGJtY2dkbUZzZFdVZ2IyWWdiMkpxWldOMElHRmNiaUFxTDF4dVpuVnVZM1JwYjI0Z1pYaDBaVzVrS0dFc0lHSXNJSFJvYVhOQmNtY3BJSHRjYmlBZ1ptOXlSV0ZqYUNoaUxDQm1kVzVqZEdsdmJpQmhjM05wWjI1V1lXeDFaU2gyWVd3c0lHdGxlU2tnZTF4dUlDQWdJR2xtSUNoMGFHbHpRWEpuSUNZbUlIUjVjR1Z2WmlCMllXd2dQVDA5SUNkbWRXNWpkR2x2YmljcElIdGNiaUFnSUNBZ0lHRmJhMlY1WFNBOUlHSnBibVFvZG1Gc0xDQjBhR2x6UVhKbktUdGNiaUFnSUNCOUlHVnNjMlVnZTF4dUlDQWdJQ0FnWVZ0clpYbGRJRDBnZG1Gc08xeHVJQ0FnSUgxY2JpQWdmU2s3WEc0Z0lISmxkSFZ5YmlCaE8xeHVmVnh1WEc1dGIyUjFiR1V1Wlhod2IzSjBjeUE5SUh0Y2JpQWdhWE5CY25KaGVUb2dhWE5CY25KaGVTeGNiaUFnYVhOQmNuSmhlVUoxWm1abGNqb2dhWE5CY25KaGVVSjFabVpsY2l4Y2JpQWdhWE5DZFdabVpYSTZJR2x6UW5WbVptVnlMRnh1SUNCcGMwWnZjbTFFWVhSaE9pQnBjMFp2Y20xRVlYUmhMRnh1SUNCcGMwRnljbUY1UW5WbVptVnlWbWxsZHpvZ2FYTkJjbkpoZVVKMVptWmxjbFpwWlhjc1hHNGdJR2x6VTNSeWFXNW5PaUJwYzFOMGNtbHVaeXhjYmlBZ2FYTk9kVzFpWlhJNklHbHpUblZ0WW1WeUxGeHVJQ0JwYzA5aWFtVmpkRG9nYVhOUFltcGxZM1FzWEc0Z0lHbHpWVzVrWldacGJtVmtPaUJwYzFWdVpHVm1hVzVsWkN4Y2JpQWdhWE5FWVhSbE9pQnBjMFJoZEdVc1hHNGdJR2x6Um1sc1pUb2dhWE5HYVd4bExGeHVJQ0JwYzBKc2IySTZJR2x6UW14dllpeGNiaUFnYVhOR2RXNWpkR2x2YmpvZ2FYTkdkVzVqZEdsdmJpeGNiaUFnYVhOVGRISmxZVzA2SUdselUzUnlaV0Z0TEZ4dUlDQnBjMVZTVEZObFlYSmphRkJoY21GdGN6b2dhWE5WVWt4VFpXRnlZMmhRWVhKaGJYTXNYRzRnSUdselUzUmhibVJoY21SQ2NtOTNjMlZ5Ulc1Mk9pQnBjMU4wWVc1a1lYSmtRbkp2ZDNObGNrVnVkaXhjYmlBZ1ptOXlSV0ZqYURvZ1ptOXlSV0ZqYUN4Y2JpQWdiV1Z5WjJVNklHMWxjbWRsTEZ4dUlDQmxlSFJsYm1RNklHVjRkR1Z1WkN4Y2JpQWdkSEpwYlRvZ2RISnBiVnh1ZlR0Y2JpSXNJaThxS2x4dUlDb2dRMjl3ZVhKcFoyaDBJREl3TVRNdGNISmxjMlZ1ZEN3Z1JtRmpaV0p2YjJzc0lFbHVZeTVjYmlBcUlFRnNiQ0J5YVdkb2RITWdjbVZ6WlhKMlpXUXVYRzRnS2x4dUlDb2dWR2hwY3lCemIzVnlZMlVnWTI5a1pTQnBjeUJzYVdObGJuTmxaQ0IxYm1SbGNpQjBhR1VnUWxORUxYTjBlV3hsSUd4cFkyVnVjMlVnWm05MWJtUWdhVzRnZEdobFhHNGdLaUJNU1VORlRsTkZJR1pwYkdVZ2FXNGdkR2hsSUhKdmIzUWdaR2x5WldOMGIzSjVJRzltSUhSb2FYTWdjMjkxY21ObElIUnlaV1V1SUVGdUlHRmtaR2wwYVc5dVlXd2daM0poYm5SY2JpQXFJRzltSUhCaGRHVnVkQ0J5YVdkb2RITWdZMkZ1SUdKbElHWnZkVzVrSUdsdUlIUm9aU0JRUVZSRlRsUlRJR1pwYkdVZ2FXNGdkR2hsSUhOaGJXVWdaR2x5WldOMGIzSjVMbHh1SUNwY2JpQXFMMXh1WEc0bmRYTmxJSE4wY21samRDYzdYRzVjYm5aaGNpQmZZWE56YVdkdUlEMGdjbVZ4ZFdseVpTZ25iMkpxWldOMExXRnpjMmxuYmljcE8xeHVYRzUyWVhJZ1pXMXdkSGxQWW1wbFkzUWdQU0J5WlhGMWFYSmxLQ2RtWW1wekwyeHBZaTlsYlhCMGVVOWlhbVZqZENjcE8xeHVkbUZ5SUY5cGJuWmhjbWxoYm5RZ1BTQnlaWEYxYVhKbEtDZG1ZbXB6TDJ4cFlpOXBiblpoY21saGJuUW5LVHRjYmx4dWFXWWdLSEJ5YjJObGMzTXVaVzUyTGs1UFJFVmZSVTVXSUNFOVBTQW5jSEp2WkhWamRHbHZiaWNwSUh0Y2JpQWdkbUZ5SUhkaGNtNXBibWNnUFNCeVpYRjFhWEpsS0NkbVltcHpMMnhwWWk5M1lYSnVhVzVuSnlrN1hHNTlYRzVjYm5aaGNpQk5TVmhKVGxOZlMwVlpJRDBnSjIxcGVHbHVjeWM3WEc1Y2JpOHZJRWhsYkhCbGNpQm1kVzVqZEdsdmJpQjBieUJoYkd4dmR5QjBhR1VnWTNKbFlYUnBiMjRnYjJZZ1lXNXZibmx0YjNWeklHWjFibU4wYVc5dWN5QjNhR2xqYUNCa2J5QnViM1JjYmk4dklHaGhkbVVnTG01aGJXVWdjMlYwSUhSdklIUm9aU0J1WVcxbElHOW1JSFJvWlNCMllYSnBZV0pzWlNCaVpXbHVaeUJoYzNOcFoyNWxaQ0IwYnk1Y2JtWjFibU4wYVc5dUlHbGtaVzUwYVhSNUtHWnVLU0I3WEc0Z0lISmxkSFZ5YmlCbWJqdGNibjFjYmx4dWRtRnlJRkpsWVdOMFVISnZjRlI1Y0dWTWIyTmhkR2x2Yms1aGJXVnpPMXh1YVdZZ0tIQnliMk5sYzNNdVpXNTJMazVQUkVWZlJVNVdJQ0U5UFNBbmNISnZaSFZqZEdsdmJpY3BJSHRjYmlBZ1VtVmhZM1JRY205d1ZIbHdaVXh2WTJGMGFXOXVUbUZ0WlhNZ1BTQjdYRzRnSUNBZ2NISnZjRG9nSjNCeWIzQW5MRnh1SUNBZ0lHTnZiblJsZUhRNklDZGpiMjUwWlhoMEp5eGNiaUFnSUNCamFHbHNaRU52Ym5SbGVIUTZJQ2RqYUdsc1pDQmpiMjUwWlhoMEoxeHVJQ0I5TzF4dWZTQmxiSE5sSUh0Y2JpQWdVbVZoWTNSUWNtOXdWSGx3WlV4dlkyRjBhVzl1VG1GdFpYTWdQU0I3ZlR0Y2JuMWNibHh1Wm5WdVkzUnBiMjRnWm1GamRHOXllU2hTWldGamRFTnZiWEJ2Ym1WdWRDd2dhWE5XWVd4cFpFVnNaVzFsYm5Rc0lGSmxZV04wVG05dmNGVndaR0YwWlZGMVpYVmxLU0I3WEc0Z0lDOHFLbHh1SUNBZ0tpQlFiMnhwWTJsbGN5QjBhR0YwSUdSbGMyTnlhV0psSUcxbGRHaHZaSE1nYVc0Z1lGSmxZV04wUTJ4aGMzTkpiblJsY21aaFkyVmdMbHh1SUNBZ0tpOWNibHh1SUNCMllYSWdhVzVxWldOMFpXUk5hWGhwYm5NZ1BTQmJYVHRjYmx4dUlDQXZLaXBjYmlBZ0lDb2dRMjl0Y0c5emFYUmxJR052YlhCdmJtVnVkSE1nWVhKbElHaHBaMmhsY2kxc1pYWmxiQ0JqYjIxd2IyNWxiblJ6SUhSb1lYUWdZMjl0Y0c5elpTQnZkR2hsY2lCamIyMXdiM05wZEdWY2JpQWdJQ29nYjNJZ2FHOXpkQ0JqYjIxd2IyNWxiblJ6TGx4dUlDQWdLbHh1SUNBZ0tpQlVieUJqY21WaGRHVWdZU0J1WlhjZ2RIbHdaU0J2WmlCZ1VtVmhZM1JEYkdGemMyQXNJSEJoYzNNZ1lTQnpjR1ZqYVdacFkyRjBhVzl1SUc5bVhHNGdJQ0FxSUhsdmRYSWdibVYzSUdOc1lYTnpJSFJ2SUdCU1pXRmpkQzVqY21WaGRHVkRiR0Z6YzJBdUlGUm9aU0J2Ym14NUlISmxjWFZwY21WdFpXNTBJRzltSUhsdmRYSWdZMnhoYzNOY2JpQWdJQ29nYzNCbFkybG1hV05oZEdsdmJpQnBjeUIwYUdGMElIbHZkU0JwYlhCc1pXMWxiblFnWVNCZ2NtVnVaR1Z5WUNCdFpYUm9iMlF1WEc0Z0lDQXFYRzRnSUNBcUlDQWdkbUZ5SUUxNVEyOXRjRzl1Wlc1MElEMGdVbVZoWTNRdVkzSmxZWFJsUTJ4aGMzTW9lMXh1SUNBZ0tpQWdJQ0FnY21WdVpHVnlPaUJtZFc1amRHbHZiaWdwSUh0Y2JpQWdJQ29nSUNBZ0lDQWdjbVYwZFhKdUlEeGthWFkrU0dWc2JHOGdWMjl5YkdROEwyUnBkajQ3WEc0Z0lDQXFJQ0FnSUNCOVhHNGdJQ0FxSUNBZ2ZTazdYRzRnSUNBcVhHNGdJQ0FxSUZSb1pTQmpiR0Z6Y3lCemNHVmphV1pwWTJGMGFXOXVJSE4xY0hCdmNuUnpJR0VnYzNCbFkybG1hV01nY0hKdmRHOWpiMndnYjJZZ2JXVjBhRzlrY3lCMGFHRjBJR2hoZG1WY2JpQWdJQ29nYzNCbFkybGhiQ0J0WldGdWFXNW5JQ2hsTG1jdUlHQnlaVzVrWlhKZ0tTNGdVMlZsSUdCU1pXRmpkRU5zWVhOelNXNTBaWEptWVdObFlDQm1iM0pjYmlBZ0lDb2diVzl5WlNCMGFHVWdZMjl0Y0hKbGFHVnVjMmwyWlNCd2NtOTBiMk52YkM0Z1FXNTVJRzkwYUdWeUlIQnliM0JsY25ScFpYTWdZVzVrSUcxbGRHaHZaSE1nYVc0Z2RHaGxYRzRnSUNBcUlHTnNZWE56SUhOd1pXTnBabWxqWVhScGIyNGdkMmxzYkNCaVpTQmhkbUZwYkdGaWJHVWdiMjRnZEdobElIQnliM1J2ZEhsd1pTNWNiaUFnSUNwY2JpQWdJQ29nUUdsdWRHVnlabUZqWlNCU1pXRmpkRU5zWVhOelNXNTBaWEptWVdObFhHNGdJQ0FxSUVCcGJuUmxjbTVoYkZ4dUlDQWdLaTljYmlBZ2RtRnlJRkpsWVdOMFEyeGhjM05KYm5SbGNtWmhZMlVnUFNCN1hHNGdJQ0FnTHlvcVhHNGdJQ0FnSUNvZ1FXNGdZWEp5WVhrZ2IyWWdUV2w0YVc0Z2IySnFaV04wY3lCMGJ5QnBibU5zZFdSbElIZG9aVzRnWkdWbWFXNXBibWNnZVc5MWNpQmpiMjF3YjI1bGJuUXVYRzRnSUNBZ0lDcGNiaUFnSUNBZ0tpQkFkSGx3WlNCN1lYSnlZWGw5WEc0Z0lDQWdJQ29nUUc5d2RHbHZibUZzWEc0Z0lDQWdJQ292WEc0Z0lDQWdiV2w0YVc1ek9pQW5SRVZHU1U1RlgwMUJUbGtuTEZ4dVhHNGdJQ0FnTHlvcVhHNGdJQ0FnSUNvZ1FXNGdiMkpxWldOMElHTnZiblJoYVc1cGJtY2djSEp2Y0dWeWRHbGxjeUJoYm1RZ2JXVjBhRzlrY3lCMGFHRjBJSE5vYjNWc1pDQmlaU0JrWldacGJtVmtJRzl1WEc0Z0lDQWdJQ29nZEdobElHTnZiWEJ2Ym1WdWRDZHpJR052Ym5OMGNuVmpkRzl5SUdsdWMzUmxZV1FnYjJZZ2FYUnpJSEJ5YjNSdmRIbHdaU0FvYzNSaGRHbGpJRzFsZEdodlpITXBMbHh1SUNBZ0lDQXFYRzRnSUNBZ0lDb2dRSFI1Y0dVZ2UyOWlhbVZqZEgxY2JpQWdJQ0FnS2lCQWIzQjBhVzl1WVd4Y2JpQWdJQ0FnS2k5Y2JpQWdJQ0J6ZEdGMGFXTnpPaUFuUkVWR1NVNUZYMDFCVGxrbkxGeHVYRzRnSUNBZ0x5b3FYRzRnSUNBZ0lDb2dSR1ZtYVc1cGRHbHZiaUJ2WmlCd2NtOXdJSFI1Y0dWeklHWnZjaUIwYUdseklHTnZiWEJ2Ym1WdWRDNWNiaUFnSUNBZ0tseHVJQ0FnSUNBcUlFQjBlWEJsSUh0dlltcGxZM1I5WEc0Z0lDQWdJQ29nUUc5d2RHbHZibUZzWEc0Z0lDQWdJQ292WEc0Z0lDQWdjSEp2Y0ZSNWNHVnpPaUFuUkVWR1NVNUZYMDFCVGxrbkxGeHVYRzRnSUNBZ0x5b3FYRzRnSUNBZ0lDb2dSR1ZtYVc1cGRHbHZiaUJ2WmlCamIyNTBaWGgwSUhSNWNHVnpJR1p2Y2lCMGFHbHpJR052YlhCdmJtVnVkQzVjYmlBZ0lDQWdLbHh1SUNBZ0lDQXFJRUIwZVhCbElIdHZZbXBsWTNSOVhHNGdJQ0FnSUNvZ1FHOXdkR2x2Ym1Gc1hHNGdJQ0FnSUNvdlhHNGdJQ0FnWTI5dWRHVjRkRlI1Y0dWek9pQW5SRVZHU1U1RlgwMUJUbGtuTEZ4dVhHNGdJQ0FnTHlvcVhHNGdJQ0FnSUNvZ1JHVm1hVzVwZEdsdmJpQnZaaUJqYjI1MFpYaDBJSFI1Y0dWeklIUm9hWE1nWTI5dGNHOXVaVzUwSUhObGRITWdabTl5SUdsMGN5QmphR2xzWkhKbGJpNWNiaUFnSUNBZ0tseHVJQ0FnSUNBcUlFQjBlWEJsSUh0dlltcGxZM1I5WEc0Z0lDQWdJQ29nUUc5d2RHbHZibUZzWEc0Z0lDQWdJQ292WEc0Z0lDQWdZMmhwYkdSRGIyNTBaWGgwVkhsd1pYTTZJQ2RFUlVaSlRrVmZUVUZPV1Njc1hHNWNiaUFnSUNBdkx5QTlQVDA5SUVSbFptbHVhWFJwYjI0Z2JXVjBhRzlrY3lBOVBUMDlYRzVjYmlBZ0lDQXZLaXBjYmlBZ0lDQWdLaUJKYm5admEyVmtJSGRvWlc0Z2RHaGxJR052YlhCdmJtVnVkQ0JwY3lCdGIzVnVkR1ZrTGlCV1lXeDFaWE1nYVc0Z2RHaGxJRzFoY0hCcGJtY2dkMmxzYkNCaVpTQnpaWFFnYjI1Y2JpQWdJQ0FnS2lCZ2RHaHBjeTV3Y205d2MyQWdhV1lnZEdoaGRDQndjbTl3SUdseklHNXZkQ0J6Y0dWamFXWnBaV1FnS0drdVpTNGdkWE5wYm1jZ1lXNGdZR2x1WUNCamFHVmpheWt1WEc0Z0lDQWdJQ3BjYmlBZ0lDQWdLaUJVYUdseklHMWxkR2h2WkNCcGN5QnBiblp2YTJWa0lHSmxabTl5WlNCZ1oyVjBTVzVwZEdsaGJGTjBZWFJsWUNCaGJtUWdkR2hsY21WbWIzSmxJR05oYm01dmRDQnlaV3g1WEc0Z0lDQWdJQ29nYjI0Z1lIUm9hWE11YzNSaGRHVmdJRzl5SUhWelpTQmdkR2hwY3k1elpYUlRkR0YwWldBdVhHNGdJQ0FnSUNwY2JpQWdJQ0FnS2lCQWNtVjBkWEp1SUh0dlltcGxZM1I5WEc0Z0lDQWdJQ29nUUc5d2RHbHZibUZzWEc0Z0lDQWdJQ292WEc0Z0lDQWdaMlYwUkdWbVlYVnNkRkJ5YjNCek9pQW5SRVZHU1U1RlgwMUJUbGxmVFVWU1IwVkVKeXhjYmx4dUlDQWdJQzhxS2x4dUlDQWdJQ0FxSUVsdWRtOXJaV1FnYjI1alpTQmlaV1p2Y21VZ2RHaGxJR052YlhCdmJtVnVkQ0JwY3lCdGIzVnVkR1ZrTGlCVWFHVWdjbVYwZFhKdUlIWmhiSFZsSUhkcGJHd2dZbVVnZFhObFpGeHVJQ0FnSUNBcUlHRnpJSFJvWlNCcGJtbDBhV0ZzSUhaaGJIVmxJRzltSUdCMGFHbHpMbk4wWVhSbFlDNWNiaUFnSUNBZ0tseHVJQ0FnSUNBcUlDQWdaMlYwU1c1cGRHbGhiRk4wWVhSbE9pQm1kVzVqZEdsdmJpZ3BJSHRjYmlBZ0lDQWdLaUFnSUNBZ2NtVjBkWEp1SUh0Y2JpQWdJQ0FnS2lBZ0lDQWdJQ0JwYzA5dU9pQm1ZV3h6WlN4Y2JpQWdJQ0FnS2lBZ0lDQWdJQ0JtYjI5Q1lYbzZJRzVsZHlCQ1lYcEdiMjhvS1Z4dUlDQWdJQ0FxSUNBZ0lDQjlYRzRnSUNBZ0lDb2dJQ0I5WEc0Z0lDQWdJQ3BjYmlBZ0lDQWdLaUJBY21WMGRYSnVJSHR2WW1wbFkzUjlYRzRnSUNBZ0lDb2dRRzl3ZEdsdmJtRnNYRzRnSUNBZ0lDb3ZYRzRnSUNBZ1oyVjBTVzVwZEdsaGJGTjBZWFJsT2lBblJFVkdTVTVGWDAxQlRsbGZUVVZTUjBWRUp5eGNibHh1SUNBZ0lDOHFLbHh1SUNBZ0lDQXFJRUJ5WlhSMWNtNGdlMjlpYW1WamRIMWNiaUFnSUNBZ0tpQkFiM0IwYVc5dVlXeGNiaUFnSUNBZ0tpOWNiaUFnSUNCblpYUkRhR2xzWkVOdmJuUmxlSFE2SUNkRVJVWkpUa1ZmVFVGT1dWOU5SVkpIUlVRbkxGeHVYRzRnSUNBZ0x5b3FYRzRnSUNBZ0lDb2dWWE5sY3lCd2NtOXdjeUJtY205dElHQjBhR2x6TG5CeWIzQnpZQ0JoYm1RZ2MzUmhkR1VnWm5KdmJTQmdkR2hwY3k1emRHRjBaV0FnZEc4Z2NtVnVaR1Z5SUhSb1pWeHVJQ0FnSUNBcUlITjBjblZqZEhWeVpTQnZaaUIwYUdVZ1kyOXRjRzl1Wlc1MExseHVJQ0FnSUNBcVhHNGdJQ0FnSUNvZ1RtOGdaM1ZoY21GdWRHVmxjeUJoY21VZ2JXRmtaU0JoWW05MWRDQjNhR1Z1SUc5eUlHaHZkeUJ2Wm5SbGJpQjBhR2x6SUcxbGRHaHZaQ0JwY3lCcGJuWnZhMlZrTENCemIxeHVJQ0FnSUNBcUlHbDBJRzExYzNRZ2JtOTBJR2hoZG1VZ2MybGtaU0JsWm1abFkzUnpMbHh1SUNBZ0lDQXFYRzRnSUNBZ0lDb2dJQ0J5Wlc1a1pYSTZJR1oxYm1OMGFXOXVLQ2tnZTF4dUlDQWdJQ0FxSUNBZ0lDQjJZWElnYm1GdFpTQTlJSFJvYVhNdWNISnZjSE11Ym1GdFpUdGNiaUFnSUNBZ0tpQWdJQ0FnY21WMGRYSnVJRHhrYVhZK1NHVnNiRzhzSUh0dVlXMWxmU0U4TDJScGRqNDdYRzRnSUNBZ0lDb2dJQ0I5WEc0Z0lDQWdJQ3BjYmlBZ0lDQWdLaUJBY21WMGRYSnVJSHRTWldGamRFTnZiWEJ2Ym1WdWRIMWNiaUFnSUNBZ0tpQkFjbVZ4ZFdseVpXUmNiaUFnSUNBZ0tpOWNiaUFnSUNCeVpXNWtaWEk2SUNkRVJVWkpUa1ZmVDA1RFJTY3NYRzVjYmlBZ0lDQXZMeUE5UFQwOUlFUmxiR1ZuWVhSbElHMWxkR2h2WkhNZ1BUMDlQVnh1WEc0Z0lDQWdMeW9xWEc0Z0lDQWdJQ29nU1c1MmIydGxaQ0IzYUdWdUlIUm9aU0JqYjIxd2IyNWxiblFnYVhNZ2FXNXBkR2xoYkd4NUlHTnlaV0YwWldRZ1lXNWtJR0ZpYjNWMElIUnZJR0psSUcxdmRXNTBaV1F1WEc0Z0lDQWdJQ29nVkdocGN5QnRZWGtnYUdGMlpTQnphV1JsSUdWbVptVmpkSE1zSUdKMWRDQmhibmtnWlhoMFpYSnVZV3dnYzNWaWMyTnlhWEIwYVc5dWN5QnZjaUJrWVhSaElHTnlaV0YwWldSY2JpQWdJQ0FnS2lCaWVTQjBhR2x6SUcxbGRHaHZaQ0J0ZFhOMElHSmxJR05zWldGdVpXUWdkWEFnYVc0Z1lHTnZiWEJ2Ym1WdWRGZHBiR3hWYm0xdmRXNTBZQzVjYmlBZ0lDQWdLbHh1SUNBZ0lDQXFJRUJ2Y0hScGIyNWhiRnh1SUNBZ0lDQXFMMXh1SUNBZ0lHTnZiWEJ2Ym1WdWRGZHBiR3hOYjNWdWREb2dKMFJGUmtsT1JWOU5RVTVaSnl4Y2JseHVJQ0FnSUM4cUtseHVJQ0FnSUNBcUlFbHVkbTlyWldRZ2QyaGxiaUIwYUdVZ1kyOXRjRzl1Wlc1MElHaGhjeUJpWldWdUlHMXZkVzUwWldRZ1lXNWtJR2hoY3lCaElFUlBUU0J5WlhCeVpYTmxiblJoZEdsdmJpNWNiaUFnSUNBZ0tpQkliM2RsZG1WeUxDQjBhR1Z5WlNCcGN5QnVieUJuZFdGeVlXNTBaV1VnZEdoaGRDQjBhR1VnUkU5TklHNXZaR1VnYVhNZ2FXNGdkR2hsSUdSdlkzVnRaVzUwTGx4dUlDQWdJQ0FxWEc0Z0lDQWdJQ29nVlhObElIUm9hWE1nWVhNZ1lXNGdiM0J3YjNKMGRXNXBkSGtnZEc4Z2IzQmxjbUYwWlNCdmJpQjBhR1VnUkU5TklIZG9aVzRnZEdobElHTnZiWEJ2Ym1WdWRDQm9ZWE5jYmlBZ0lDQWdLaUJpWldWdUlHMXZkVzUwWldRZ0tHbHVhWFJwWVd4cGVtVmtJR0Z1WkNCeVpXNWtaWEpsWkNrZ1ptOXlJSFJvWlNCbWFYSnpkQ0IwYVcxbExseHVJQ0FnSUNBcVhHNGdJQ0FnSUNvZ1FIQmhjbUZ0SUh0RVQwMUZiR1Z0Wlc1MGZTQnliMjkwVG05a1pTQkVUMDBnWld4bGJXVnVkQ0J5WlhCeVpYTmxiblJwYm1jZ2RHaGxJR052YlhCdmJtVnVkQzVjYmlBZ0lDQWdLaUJBYjNCMGFXOXVZV3hjYmlBZ0lDQWdLaTljYmlBZ0lDQmpiMjF3YjI1bGJuUkVhV1JOYjNWdWREb2dKMFJGUmtsT1JWOU5RVTVaSnl4Y2JseHVJQ0FnSUM4cUtseHVJQ0FnSUNBcUlFbHVkbTlyWldRZ1ltVm1iM0psSUhSb1pTQmpiMjF3YjI1bGJuUWdjbVZqWldsMlpYTWdibVYzSUhCeWIzQnpMbHh1SUNBZ0lDQXFYRzRnSUNBZ0lDb2dWWE5sSUhSb2FYTWdZWE1nWVc0Z2IzQndiM0owZFc1cGRIa2dkRzhnY21WaFkzUWdkRzhnWVNCd2NtOXdJSFJ5WVc1emFYUnBiMjRnWW5rZ2RYQmtZWFJwYm1jZ2RHaGxYRzRnSUNBZ0lDb2djM1JoZEdVZ2RYTnBibWNnWUhSb2FYTXVjMlYwVTNSaGRHVmdMaUJEZFhKeVpXNTBJSEJ5YjNCeklHRnlaU0JoWTJObGMzTmxaQ0IyYVdFZ1lIUm9hWE11Y0hKdmNITmdMbHh1SUNBZ0lDQXFYRzRnSUNBZ0lDb2dJQ0JqYjIxd2IyNWxiblJYYVd4c1VtVmpaV2wyWlZCeWIzQnpPaUJtZFc1amRHbHZiaWh1WlhoMFVISnZjSE1zSUc1bGVIUkRiMjUwWlhoMEtTQjdYRzRnSUNBZ0lDb2dJQ0FnSUhSb2FYTXVjMlYwVTNSaGRHVW9lMXh1SUNBZ0lDQXFJQ0FnSUNBZ0lHeHBhMlZ6U1c1amNtVmhjMmx1WnpvZ2JtVjRkRkJ5YjNCekxteHBhMlZEYjNWdWRDQStJSFJvYVhNdWNISnZjSE11YkdsclpVTnZkVzUwWEc0Z0lDQWdJQ29nSUNBZ0lIMHBPMXh1SUNBZ0lDQXFJQ0FnZlZ4dUlDQWdJQ0FxWEc0Z0lDQWdJQ29nVGs5VVJUb2dWR2hsY21VZ2FYTWdibThnWlhGMWFYWmhiR1Z1ZENCZ1kyOXRjRzl1Wlc1MFYybHNiRkpsWTJWcGRtVlRkR0YwWldBdUlFRnVJR2x1WTI5dGFXNW5JSEJ5YjNCY2JpQWdJQ0FnS2lCMGNtRnVjMmwwYVc5dUlHMWhlU0JqWVhWelpTQmhJSE4wWVhSbElHTm9ZVzVuWlN3Z1luVjBJSFJvWlNCdmNIQnZjMmwwWlNCcGN5QnViM1FnZEhKMVpTNGdTV1lnZVc5MVhHNGdJQ0FnSUNvZ2JtVmxaQ0JwZEN3Z2VXOTFJR0Z5WlNCd2NtOWlZV0pzZVNCc2IyOXJhVzVuSUdadmNpQmdZMjl0Y0c5dVpXNTBWMmxzYkZWd1pHRjBaV0F1WEc0Z0lDQWdJQ3BjYmlBZ0lDQWdLaUJBY0dGeVlXMGdlMjlpYW1WamRIMGdibVY0ZEZCeWIzQnpYRzRnSUNBZ0lDb2dRRzl3ZEdsdmJtRnNYRzRnSUNBZ0lDb3ZYRzRnSUNBZ1kyOXRjRzl1Wlc1MFYybHNiRkpsWTJWcGRtVlFjbTl3Y3pvZ0owUkZSa2xPUlY5TlFVNVpKeXhjYmx4dUlDQWdJQzhxS2x4dUlDQWdJQ0FxSUVsdWRtOXJaV1FnZDJocGJHVWdaR1ZqYVdScGJtY2dhV1lnZEdobElHTnZiWEJ2Ym1WdWRDQnphRzkxYkdRZ1ltVWdkWEJrWVhSbFpDQmhjeUJoSUhKbGMzVnNkQ0J2Wmx4dUlDQWdJQ0FxSUhKbFkyVnBkbWx1WnlCdVpYY2djSEp2Y0hNc0lITjBZWFJsSUdGdVpDOXZjaUJqYjI1MFpYaDBMbHh1SUNBZ0lDQXFYRzRnSUNBZ0lDb2dWWE5sSUhSb2FYTWdZWE1nWVc0Z2IzQndiM0owZFc1cGRIa2dkRzhnWUhKbGRIVnliaUJtWVd4elpXQWdkMmhsYmlCNWIzVW5jbVVnWTJWeWRHRnBiaUIwYUdGMElIUm9aVnh1SUNBZ0lDQXFJSFJ5WVc1emFYUnBiMjRnZEc4Z2RHaGxJRzVsZHlCd2NtOXdjeTl6ZEdGMFpTOWpiMjUwWlhoMElIZHBiR3dnYm05MElISmxjWFZwY21VZ1lTQmpiMjF3YjI1bGJuUmNiaUFnSUNBZ0tpQjFjR1JoZEdVdVhHNGdJQ0FnSUNwY2JpQWdJQ0FnS2lBZ0lITm9iM1ZzWkVOdmJYQnZibVZ1ZEZWd1pHRjBaVG9nWm5WdVkzUnBiMjRvYm1WNGRGQnliM0J6TENCdVpYaDBVM1JoZEdVc0lHNWxlSFJEYjI1MFpYaDBLU0I3WEc0Z0lDQWdJQ29nSUNBZ0lISmxkSFZ5YmlBaFpYRjFZV3dvYm1WNGRGQnliM0J6TENCMGFHbHpMbkJ5YjNCektTQjhmRnh1SUNBZ0lDQXFJQ0FnSUNBZ0lDRmxjWFZoYkNodVpYaDBVM1JoZEdVc0lIUm9hWE11YzNSaGRHVXBJSHg4WEc0Z0lDQWdJQ29nSUNBZ0lDQWdJV1Z4ZFdGc0tHNWxlSFJEYjI1MFpYaDBMQ0IwYUdsekxtTnZiblJsZUhRcE8xeHVJQ0FnSUNBcUlDQWdmVnh1SUNBZ0lDQXFYRzRnSUNBZ0lDb2dRSEJoY21GdElIdHZZbXBsWTNSOUlHNWxlSFJRY205d2MxeHVJQ0FnSUNBcUlFQndZWEpoYlNCN1AyOWlhbVZqZEgwZ2JtVjRkRk4wWVhSbFhHNGdJQ0FnSUNvZ1FIQmhjbUZ0SUhzL2IySnFaV04wZlNCdVpYaDBRMjl1ZEdWNGRGeHVJQ0FnSUNBcUlFQnlaWFIxY200Z2UySnZiMnhsWVc1OUlGUnlkV1VnYVdZZ2RHaGxJR052YlhCdmJtVnVkQ0J6YUc5MWJHUWdkWEJrWVhSbExseHVJQ0FnSUNBcUlFQnZjSFJwYjI1aGJGeHVJQ0FnSUNBcUwxeHVJQ0FnSUhOb2IzVnNaRU52YlhCdmJtVnVkRlZ3WkdGMFpUb2dKMFJGUmtsT1JWOVBUa05GSnl4Y2JseHVJQ0FnSUM4cUtseHVJQ0FnSUNBcUlFbHVkbTlyWldRZ2QyaGxiaUIwYUdVZ1kyOXRjRzl1Wlc1MElHbHpJR0ZpYjNWMElIUnZJSFZ3WkdGMFpTQmtkV1VnZEc4Z1lTQjBjbUZ1YzJsMGFXOXVJR1p5YjIxY2JpQWdJQ0FnS2lCZ2RHaHBjeTV3Y205d2MyQXNJR0IwYUdsekxuTjBZWFJsWUNCaGJtUWdZSFJvYVhNdVkyOXVkR1Y0ZEdBZ2RHOGdZRzVsZUhSUWNtOXdjMkFzSUdCdVpYaDBVM1JoZEdWZ1hHNGdJQ0FnSUNvZ1lXNWtJR0J1WlhoMFEyOXVkR1Y0ZEdBdVhHNGdJQ0FnSUNwY2JpQWdJQ0FnS2lCVmMyVWdkR2hwY3lCaGN5QmhiaUJ2Y0hCdmNuUjFibWwwZVNCMGJ5QndaWEptYjNKdElIQnlaWEJoY21GMGFXOXVJR0psWm05eVpTQmhiaUIxY0dSaGRHVWdiMk5qZFhKekxseHVJQ0FnSUNBcVhHNGdJQ0FnSUNvZ1RrOVVSVG9nV1c5MUlDb3FZMkZ1Ym05MEtpb2dkWE5sSUdCMGFHbHpMbk5sZEZOMFlYUmxLQ2xnSUdsdUlIUm9hWE1nYldWMGFHOWtMbHh1SUNBZ0lDQXFYRzRnSUNBZ0lDb2dRSEJoY21GdElIdHZZbXBsWTNSOUlHNWxlSFJRY205d2MxeHVJQ0FnSUNBcUlFQndZWEpoYlNCN1AyOWlhbVZqZEgwZ2JtVjRkRk4wWVhSbFhHNGdJQ0FnSUNvZ1FIQmhjbUZ0SUhzL2IySnFaV04wZlNCdVpYaDBRMjl1ZEdWNGRGeHVJQ0FnSUNBcUlFQndZWEpoYlNCN1VtVmhZM1JTWldOdmJtTnBiR1ZVY21GdWMyRmpkR2x2Ym4wZ2RISmhibk5oWTNScGIyNWNiaUFnSUNBZ0tpQkFiM0IwYVc5dVlXeGNiaUFnSUNBZ0tpOWNiaUFnSUNCamIyMXdiMjVsYm5SWGFXeHNWWEJrWVhSbE9pQW5SRVZHU1U1RlgwMUJUbGtuTEZ4dVhHNGdJQ0FnTHlvcVhHNGdJQ0FnSUNvZ1NXNTJiMnRsWkNCM2FHVnVJSFJvWlNCamIyMXdiMjVsYm5RbmN5QkVUMDBnY21Wd2NtVnpaVzUwWVhScGIyNGdhR0Z6SUdKbFpXNGdkWEJrWVhSbFpDNWNiaUFnSUNBZ0tseHVJQ0FnSUNBcUlGVnpaU0IwYUdseklHRnpJR0Z1SUc5d2NHOXlkSFZ1YVhSNUlIUnZJRzl3WlhKaGRHVWdiMjRnZEdobElFUlBUU0IzYUdWdUlIUm9aU0JqYjIxd2IyNWxiblFnYUdGelhHNGdJQ0FnSUNvZ1ltVmxiaUIxY0dSaGRHVmtMbHh1SUNBZ0lDQXFYRzRnSUNBZ0lDb2dRSEJoY21GdElIdHZZbXBsWTNSOUlIQnlaWFpRY205d2MxeHVJQ0FnSUNBcUlFQndZWEpoYlNCN1AyOWlhbVZqZEgwZ2NISmxkbE4wWVhSbFhHNGdJQ0FnSUNvZ1FIQmhjbUZ0SUhzL2IySnFaV04wZlNCd2NtVjJRMjl1ZEdWNGRGeHVJQ0FnSUNBcUlFQndZWEpoYlNCN1JFOU5SV3hsYldWdWRIMGdjbTl2ZEU1dlpHVWdSRTlOSUdWc1pXMWxiblFnY21Wd2NtVnpaVzUwYVc1bklIUm9aU0JqYjIxd2IyNWxiblF1WEc0Z0lDQWdJQ29nUUc5d2RHbHZibUZzWEc0Z0lDQWdJQ292WEc0Z0lDQWdZMjl0Y0c5dVpXNTBSR2xrVlhCa1lYUmxPaUFuUkVWR1NVNUZYMDFCVGxrbkxGeHVYRzRnSUNBZ0x5b3FYRzRnSUNBZ0lDb2dTVzUyYjJ0bFpDQjNhR1Z1SUhSb1pTQmpiMjF3YjI1bGJuUWdhWE1nWVdKdmRYUWdkRzhnWW1VZ2NtVnRiM1psWkNCbWNtOXRJR2wwY3lCd1lYSmxiblFnWVc1a0lHaGhkbVZjYmlBZ0lDQWdLaUJwZEhNZ1JFOU5JSEpsY0hKbGMyVnVkR0YwYVc5dUlHUmxjM1J5YjNsbFpDNWNiaUFnSUNBZ0tseHVJQ0FnSUNBcUlGVnpaU0IwYUdseklHRnpJR0Z1SUc5d2NHOXlkSFZ1YVhSNUlIUnZJR1JsWVd4c2IyTmhkR1VnWVc1NUlHVjRkR1Z5Ym1Gc0lISmxjMjkxY21ObGN5NWNiaUFnSUNBZ0tseHVJQ0FnSUNBcUlFNVBWRVU2SUZSb1pYSmxJR2x6SUc1dklHQmpiMjF3YjI1bGJuUkVhV1JWYm0xdmRXNTBZQ0J6YVc1alpTQjViM1Z5SUdOdmJYQnZibVZ1ZENCM2FXeHNJR2hoZG1VZ1ltVmxibHh1SUNBZ0lDQXFJR1JsYzNSeWIzbGxaQ0JpZVNCMGFHRjBJSEJ2YVc1MExseHVJQ0FnSUNBcVhHNGdJQ0FnSUNvZ1FHOXdkR2x2Ym1Gc1hHNGdJQ0FnSUNvdlhHNGdJQ0FnWTI5dGNHOXVaVzUwVjJsc2JGVnViVzkxYm5RNklDZEVSVVpKVGtWZlRVRk9XU2NzWEc1Y2JpQWdJQ0F2THlBOVBUMDlJRUZrZG1GdVkyVmtJRzFsZEdodlpITWdQVDA5UFZ4dVhHNGdJQ0FnTHlvcVhHNGdJQ0FnSUNvZ1ZYQmtZWFJsY3lCMGFHVWdZMjl0Y0c5dVpXNTBKM01nWTNWeWNtVnVkR3g1SUcxdmRXNTBaV1FnUkU5TklISmxjSEpsYzJWdWRHRjBhVzl1TGx4dUlDQWdJQ0FxWEc0Z0lDQWdJQ29nUW5rZ1pHVm1ZWFZzZEN3Z2RHaHBjeUJwYlhCc1pXMWxiblJ6SUZKbFlXTjBKM01nY21WdVpHVnlhVzVuSUdGdVpDQnlaV052Ym1OcGJHbGhkR2x2YmlCaGJHZHZjbWwwYUcwdVhHNGdJQ0FnSUNvZ1UyOXdhR2x6ZEdsallYUmxaQ0JqYkdsbGJuUnpJRzFoZVNCM2FYTm9JSFJ2SUc5MlpYSnlhV1JsSUhSb2FYTXVYRzRnSUNBZ0lDcGNiaUFnSUNBZ0tpQkFjR0Z5WVcwZ2UxSmxZV04wVW1WamIyNWphV3hsVkhKaGJuTmhZM1JwYjI1OUlIUnlZVzV6WVdOMGFXOXVYRzRnSUNBZ0lDb2dRR2x1ZEdWeWJtRnNYRzRnSUNBZ0lDb2dRRzkyWlhKeWFXUmhZbXhsWEc0Z0lDQWdJQ292WEc0Z0lDQWdkWEJrWVhSbFEyOXRjRzl1Wlc1ME9pQW5UMVpGVWxKSlJFVmZRa0ZUUlNkY2JpQWdmVHRjYmx4dUlDQXZLaXBjYmlBZ0lDb2dUV0Z3Y0dsdVp5Qm1jbTl0SUdOc1lYTnpJSE53WldOcFptbGpZWFJwYjI0Z2EyVjVjeUIwYnlCemNHVmphV0ZzSUhCeWIyTmxjM05wYm1jZ1puVnVZM1JwYjI1ekxseHVJQ0FnS2x4dUlDQWdLaUJCYkhSb2IzVm5hQ0IwYUdWelpTQmhjbVVnWkdWamJHRnlaV1FnYkdsclpTQnBibk4wWVc1alpTQndjbTl3WlhKMGFXVnpJR2x1SUhSb1pTQnpjR1ZqYVdacFkyRjBhVzl1WEc0Z0lDQXFJSGRvWlc0Z1pHVm1hVzVwYm1jZ1kyeGhjM05sY3lCMWMybHVaeUJnVW1WaFkzUXVZM0psWVhSbFEyeGhjM05nTENCMGFHVjVJR0Z5WlNCaFkzUjFZV3hzZVNCemRHRjBhV05jYmlBZ0lDb2dZVzVrSUdGeVpTQmhZMk5sYzNOcFlteGxJRzl1SUhSb1pTQmpiMjV6ZEhKMVkzUnZjaUJwYm5OMFpXRmtJRzltSUhSb1pTQndjbTkwYjNSNWNHVXVJRVJsYzNCcGRHVmNiaUFnSUNvZ1ltVnBibWNnYzNSaGRHbGpMQ0IwYUdWNUlHMTFjM1FnWW1VZ1pHVm1hVzVsWkNCdmRYUnphV1JsSUc5bUlIUm9aU0JjSW5OMFlYUnBZM05jSWlCclpYa2dkVzVrWlhKY2JpQWdJQ29nZDJocFkyZ2dZV3hzSUc5MGFHVnlJSE4wWVhScFl5QnRaWFJvYjJSeklHRnlaU0JrWldacGJtVmtMbHh1SUNBZ0tpOWNiaUFnZG1GeUlGSkZVMFZTVmtWRVgxTlFSVU5mUzBWWlV5QTlJSHRjYmlBZ0lDQmthWE53YkdGNVRtRnRaVG9nWm5WdVkzUnBiMjRvUTI5dWMzUnlkV04wYjNJc0lHUnBjM0JzWVhsT1lXMWxLU0I3WEc0Z0lDQWdJQ0JEYjI1emRISjFZM1J2Y2k1a2FYTndiR0Y1VG1GdFpTQTlJR1JwYzNCc1lYbE9ZVzFsTzF4dUlDQWdJSDBzWEc0Z0lDQWdiV2w0YVc1ek9pQm1kVzVqZEdsdmJpaERiMjV6ZEhKMVkzUnZjaXdnYldsNGFXNXpLU0I3WEc0Z0lDQWdJQ0JwWmlBb2JXbDRhVzV6S1NCN1hHNGdJQ0FnSUNBZ0lHWnZjaUFvZG1GeUlHa2dQU0F3T3lCcElEd2diV2w0YVc1ekxteGxibWQwYURzZ2FTc3JLU0I3WEc0Z0lDQWdJQ0FnSUNBZ2JXbDRVM0JsWTBsdWRHOURiMjF3YjI1bGJuUW9RMjl1YzNSeWRXTjBiM0lzSUcxcGVHbHVjMXRwWFNrN1hHNGdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lIMWNiaUFnSUNCOUxGeHVJQ0FnSUdOb2FXeGtRMjl1ZEdWNGRGUjVjR1Z6T2lCbWRXNWpkR2x2YmloRGIyNXpkSEoxWTNSdmNpd2dZMmhwYkdSRGIyNTBaWGgwVkhsd1pYTXBJSHRjYmlBZ0lDQWdJR2xtSUNod2NtOWpaWE56TG1WdWRpNU9UMFJGWDBWT1ZpQWhQVDBnSjNCeWIyUjFZM1JwYjI0bktTQjdYRzRnSUNBZ0lDQWdJSFpoYkdsa1lYUmxWSGx3WlVSbFppaERiMjV6ZEhKMVkzUnZjaXdnWTJocGJHUkRiMjUwWlhoMFZIbHdaWE1zSUNkamFHbHNaRU52Ym5SbGVIUW5LVHRjYmlBZ0lDQWdJSDFjYmlBZ0lDQWdJRU52Ym5OMGNuVmpkRzl5TG1Ob2FXeGtRMjl1ZEdWNGRGUjVjR1Z6SUQwZ1gyRnpjMmxuYmloY2JpQWdJQ0FnSUNBZ2UzMHNYRzRnSUNBZ0lDQWdJRU52Ym5OMGNuVmpkRzl5TG1Ob2FXeGtRMjl1ZEdWNGRGUjVjR1Z6TEZ4dUlDQWdJQ0FnSUNCamFHbHNaRU52Ym5SbGVIUlVlWEJsYzF4dUlDQWdJQ0FnS1R0Y2JpQWdJQ0I5TEZ4dUlDQWdJR052Ym5SbGVIUlVlWEJsY3pvZ1puVnVZM1JwYjI0b1EyOXVjM1J5ZFdOMGIzSXNJR052Ym5SbGVIUlVlWEJsY3lrZ2UxeHVJQ0FnSUNBZ2FXWWdLSEJ5YjJObGMzTXVaVzUyTGs1UFJFVmZSVTVXSUNFOVBTQW5jSEp2WkhWamRHbHZiaWNwSUh0Y2JpQWdJQ0FnSUNBZ2RtRnNhV1JoZEdWVWVYQmxSR1ZtS0VOdmJuTjBjblZqZEc5eUxDQmpiMjUwWlhoMFZIbHdaWE1zSUNkamIyNTBaWGgwSnlrN1hHNGdJQ0FnSUNCOVhHNGdJQ0FnSUNCRGIyNXpkSEoxWTNSdmNpNWpiMjUwWlhoMFZIbHdaWE1nUFNCZllYTnphV2R1S0Z4dUlDQWdJQ0FnSUNCN2ZTeGNiaUFnSUNBZ0lDQWdRMjl1YzNSeWRXTjBiM0l1WTI5dWRHVjRkRlI1Y0dWekxGeHVJQ0FnSUNBZ0lDQmpiMjUwWlhoMFZIbHdaWE5jYmlBZ0lDQWdJQ2s3WEc0Z0lDQWdmU3hjYmlBZ0lDQXZLaXBjYmlBZ0lDQWdLaUJUY0dWamFXRnNJR05oYzJVZ1oyVjBSR1ZtWVhWc2RGQnliM0J6SUhkb2FXTm9JSE5vYjNWc1pDQnRiM1psSUdsdWRHOGdjM1JoZEdsamN5QmlkWFFnY21WeGRXbHlaWE5jYmlBZ0lDQWdLaUJoZFhSdmJXRjBhV01nYldWeVoybHVaeTVjYmlBZ0lDQWdLaTljYmlBZ0lDQm5aWFJFWldaaGRXeDBVSEp2Y0hNNklHWjFibU4wYVc5dUtFTnZibk4wY25WamRHOXlMQ0JuWlhSRVpXWmhkV3gwVUhKdmNITXBJSHRjYmlBZ0lDQWdJR2xtSUNoRGIyNXpkSEoxWTNSdmNpNW5aWFJFWldaaGRXeDBVSEp2Y0hNcElIdGNiaUFnSUNBZ0lDQWdRMjl1YzNSeWRXTjBiM0l1WjJWMFJHVm1ZWFZzZEZCeWIzQnpJRDBnWTNKbFlYUmxUV1Z5WjJWa1VtVnpkV3gwUm5WdVkzUnBiMjRvWEc0Z0lDQWdJQ0FnSUNBZ1EyOXVjM1J5ZFdOMGIzSXVaMlYwUkdWbVlYVnNkRkJ5YjNCekxGeHVJQ0FnSUNBZ0lDQWdJR2RsZEVSbFptRjFiSFJRY205d2MxeHVJQ0FnSUNBZ0lDQXBPMXh1SUNBZ0lDQWdmU0JsYkhObElIdGNiaUFnSUNBZ0lDQWdRMjl1YzNSeWRXTjBiM0l1WjJWMFJHVm1ZWFZzZEZCeWIzQnpJRDBnWjJWMFJHVm1ZWFZzZEZCeWIzQnpPMXh1SUNBZ0lDQWdmVnh1SUNBZ0lIMHNYRzRnSUNBZ2NISnZjRlI1Y0dWek9pQm1kVzVqZEdsdmJpaERiMjV6ZEhKMVkzUnZjaXdnY0hKdmNGUjVjR1Z6S1NCN1hHNGdJQ0FnSUNCcFppQW9jSEp2WTJWemN5NWxibll1VGs5RVJWOUZUbFlnSVQwOUlDZHdjbTlrZFdOMGFXOXVKeWtnZTF4dUlDQWdJQ0FnSUNCMllXeHBaR0YwWlZSNWNHVkVaV1lvUTI5dWMzUnlkV04wYjNJc0lIQnliM0JVZVhCbGN5d2dKM0J5YjNBbktUdGNiaUFnSUNBZ0lIMWNiaUFnSUNBZ0lFTnZibk4wY25WamRHOXlMbkJ5YjNCVWVYQmxjeUE5SUY5aGMzTnBaMjRvZTMwc0lFTnZibk4wY25WamRHOXlMbkJ5YjNCVWVYQmxjeXdnY0hKdmNGUjVjR1Z6S1R0Y2JpQWdJQ0I5TEZ4dUlDQWdJSE4wWVhScFkzTTZJR1oxYm1OMGFXOXVLRU52Ym5OMGNuVmpkRzl5TENCemRHRjBhV056S1NCN1hHNGdJQ0FnSUNCdGFYaFRkR0YwYVdOVGNHVmpTVzUwYjBOdmJYQnZibVZ1ZENoRGIyNXpkSEoxWTNSdmNpd2djM1JoZEdsamN5azdYRzRnSUNBZ2ZTeGNiaUFnSUNCaGRYUnZZbWx1WkRvZ1puVnVZM1JwYjI0b0tTQjdmVnh1SUNCOU8xeHVYRzRnSUdaMWJtTjBhVzl1SUhaaGJHbGtZWFJsVkhsd1pVUmxaaWhEYjI1emRISjFZM1J2Y2l3Z2RIbHdaVVJsWml3Z2JHOWpZWFJwYjI0cElIdGNiaUFnSUNCbWIzSWdLSFpoY2lCd2NtOXdUbUZ0WlNCcGJpQjBlWEJsUkdWbUtTQjdYRzRnSUNBZ0lDQnBaaUFvZEhsd1pVUmxaaTVvWVhOUGQyNVFjbTl3WlhKMGVTaHdjbTl3VG1GdFpTa3BJSHRjYmlBZ0lDQWdJQ0FnTHk4Z2RYTmxJR0VnZDJGeWJtbHVaeUJwYm5OMFpXRmtJRzltSUdGdUlGOXBiblpoY21saGJuUWdjMjhnWTI5dGNHOXVaVzUwYzF4dUlDQWdJQ0FnSUNBdkx5QmtiMjRuZENCemFHOTNJSFZ3SUdsdUlIQnliMlFnWW5WMElHOXViSGtnYVc0Z1gxOUVSVlpmWDF4dUlDQWdJQ0FnSUNCcFppQW9jSEp2WTJWemN5NWxibll1VGs5RVJWOUZUbFlnSVQwOUlDZHdjbTlrZFdOMGFXOXVKeWtnZTF4dUlDQWdJQ0FnSUNBZ0lIZGhjbTVwYm1jb1hHNGdJQ0FnSUNBZ0lDQWdJQ0IwZVhCbGIyWWdkSGx3WlVSbFpsdHdjbTl3VG1GdFpWMGdQVDA5SUNkbWRXNWpkR2x2Ymljc1hHNGdJQ0FnSUNBZ0lDQWdJQ0FuSlhNNklDVnpJSFI1Y0dVZ1lDVnpZQ0JwY3lCcGJuWmhiR2xrT3lCcGRDQnRkWE4wSUdKbElHRWdablZ1WTNScGIyNHNJSFZ6ZFdGc2JIa2dabkp2YlNBbklDdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0oxSmxZV04wTGxCeWIzQlVlWEJsY3k0bkxGeHVJQ0FnSUNBZ0lDQWdJQ0FnUTI5dWMzUnlkV04wYjNJdVpHbHpjR3hoZVU1aGJXVWdmSHdnSjFKbFlXTjBRMnhoYzNNbkxGeHVJQ0FnSUNBZ0lDQWdJQ0FnVW1WaFkzUlFjbTl3Vkhsd1pVeHZZMkYwYVc5dVRtRnRaWE5iYkc5allYUnBiMjVkTEZ4dUlDQWdJQ0FnSUNBZ0lDQWdjSEp2Y0U1aGJXVmNiaUFnSUNBZ0lDQWdJQ0FwTzF4dUlDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNCOVhHNGdJQ0FnZlZ4dUlDQjlYRzVjYmlBZ1puVnVZM1JwYjI0Z2RtRnNhV1JoZEdWTlpYUm9iMlJQZG1WeWNtbGtaU2hwYzBGc2NtVmhaSGxFWldacGJtVmtMQ0J1WVcxbEtTQjdYRzRnSUNBZ2RtRnlJSE53WldOUWIyeHBZM2tnUFNCU1pXRmpkRU5zWVhOelNXNTBaWEptWVdObExtaGhjMDkzYmxCeWIzQmxjblI1S0c1aGJXVXBYRzRnSUNBZ0lDQS9JRkpsWVdOMFEyeGhjM05KYm5SbGNtWmhZMlZiYm1GdFpWMWNiaUFnSUNBZ0lEb2diblZzYkR0Y2JseHVJQ0FnSUM4dklFUnBjMkZzYkc5M0lHOTJaWEp5YVdScGJtY2diMllnWW1GelpTQmpiR0Z6Y3lCdFpYUm9iMlJ6SUhWdWJHVnpjeUJsZUhCc2FXTnBkR3g1SUdGc2JHOTNaV1F1WEc0Z0lDQWdhV1lnS0ZKbFlXTjBRMnhoYzNOTmFYaHBiaTVvWVhOUGQyNVFjbTl3WlhKMGVTaHVZVzFsS1NrZ2UxeHVJQ0FnSUNBZ1gybHVkbUZ5YVdGdWRDaGNiaUFnSUNBZ0lDQWdjM0JsWTFCdmJHbGplU0E5UFQwZ0owOVdSVkpTU1VSRlgwSkJVMFVuTEZ4dUlDQWdJQ0FnSUNBblVtVmhZM1JEYkdGemMwbHVkR1Z5Wm1GalpUb2dXVzkxSUdGeVpTQmhkSFJsYlhCMGFXNW5JSFJ2SUc5MlpYSnlhV1JsSUNjZ0sxeHVJQ0FnSUNBZ0lDQWdJQ2RnSlhOZ0lHWnliMjBnZVc5MWNpQmpiR0Z6Y3lCemNHVmphV1pwWTJGMGFXOXVMaUJGYm5OMWNtVWdkR2hoZENCNWIzVnlJRzFsZEdodlpDQnVZVzFsY3lBbklDdGNiaUFnSUNBZ0lDQWdJQ0FuWkc4Z2JtOTBJRzkyWlhKc1lYQWdkMmwwYUNCU1pXRmpkQ0J0WlhSb2IyUnpMaWNzWEc0Z0lDQWdJQ0FnSUc1aGJXVmNiaUFnSUNBZ0lDazdYRzRnSUNBZ2ZWeHVYRzRnSUNBZ0x5OGdSR2x6WVd4c2IzY2daR1ZtYVc1cGJtY2diV1YwYUc5a2N5QnRiM0psSUhSb1lXNGdiMjVqWlNCMWJteGxjM01nWlhod2JHbGphWFJzZVNCaGJHeHZkMlZrTGx4dUlDQWdJR2xtSUNocGMwRnNjbVZoWkhsRVpXWnBibVZrS1NCN1hHNGdJQ0FnSUNCZmFXNTJZWEpwWVc1MEtGeHVJQ0FnSUNBZ0lDQnpjR1ZqVUc5c2FXTjVJRDA5UFNBblJFVkdTVTVGWDAxQlRsa25JSHg4SUhOd1pXTlFiMnhwWTNrZ1BUMDlJQ2RFUlVaSlRrVmZUVUZPV1Y5TlJWSkhSVVFuTEZ4dUlDQWdJQ0FnSUNBblVtVmhZM1JEYkdGemMwbHVkR1Z5Wm1GalpUb2dXVzkxSUdGeVpTQmhkSFJsYlhCMGFXNW5JSFJ2SUdSbFptbHVaU0FuSUN0Y2JpQWdJQ0FnSUNBZ0lDQW5ZQ1Z6WUNCdmJpQjViM1Z5SUdOdmJYQnZibVZ1ZENCdGIzSmxJSFJvWVc0Z2IyNWpaUzRnVkdocGN5QmpiMjVtYkdsamRDQnRZWGtnWW1VZ1pIVmxJQ2NnSzF4dUlDQWdJQ0FnSUNBZ0lDZDBieUJoSUcxcGVHbHVMaWNzWEc0Z0lDQWdJQ0FnSUc1aGJXVmNiaUFnSUNBZ0lDazdYRzRnSUNBZ2ZWeHVJQ0I5WEc1Y2JpQWdMeW9xWEc0Z0lDQXFJRTFwZUdsdUlHaGxiSEJsY2lCM2FHbGphQ0JvWVc1a2JHVnpJSEJ2YkdsamVTQjJZV3hwWkdGMGFXOXVJR0Z1WkNCeVpYTmxjblpsWkZ4dUlDQWdLaUJ6Y0dWamFXWnBZMkYwYVc5dUlHdGxlWE1nZDJobGJpQmlkV2xzWkdsdVp5QlNaV0ZqZENCamJHRnpjMlZ6TGx4dUlDQWdLaTljYmlBZ1puVnVZM1JwYjI0Z2JXbDRVM0JsWTBsdWRHOURiMjF3YjI1bGJuUW9RMjl1YzNSeWRXTjBiM0lzSUhOd1pXTXBJSHRjYmlBZ0lDQnBaaUFvSVhOd1pXTXBJSHRjYmlBZ0lDQWdJR2xtSUNod2NtOWpaWE56TG1WdWRpNU9UMFJGWDBWT1ZpQWhQVDBnSjNCeWIyUjFZM1JwYjI0bktTQjdYRzRnSUNBZ0lDQWdJSFpoY2lCMGVYQmxiMlpUY0dWaklEMGdkSGx3Wlc5bUlITndaV003WEc0Z0lDQWdJQ0FnSUhaaGNpQnBjMDFwZUdsdVZtRnNhV1FnUFNCMGVYQmxiMlpUY0dWaklEMDlQU0FuYjJKcVpXTjBKeUFtSmlCemNHVmpJQ0U5UFNCdWRXeHNPMXh1WEc0Z0lDQWdJQ0FnSUdsbUlDaHdjbTlqWlhOekxtVnVkaTVPVDBSRlgwVk9WaUFoUFQwZ0ozQnliMlIxWTNScGIyNG5LU0I3WEc0Z0lDQWdJQ0FnSUNBZ2QyRnlibWx1WnloY2JpQWdJQ0FnSUNBZ0lDQWdJR2x6VFdsNGFXNVdZV3hwWkN4Y2JpQWdJQ0FnSUNBZ0lDQWdJRndpSlhNNklGbHZkU2R5WlNCaGRIUmxiWEIwYVc1bklIUnZJR2x1WTJ4MVpHVWdZU0J0YVhocGJpQjBhR0YwSUdseklHVnBkR2hsY2lCdWRXeHNJRndpSUN0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSjI5eUlHNXZkQ0JoYmlCdlltcGxZM1F1SUVOb1pXTnJJSFJvWlNCdGFYaHBibk1nYVc1amJIVmtaV1FnWW5rZ2RHaGxJR052YlhCdmJtVnVkQ3dnSnlBclhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNkaGN5QjNaV3hzSUdGeklHRnVlU0J0YVhocGJuTWdkR2hsZVNCcGJtTnNkV1JsSUhSb1pXMXpaV3gyWlhNdUlDY2dLMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQW5SWGh3WldOMFpXUWdiMkpxWldOMElHSjFkQ0JuYjNRZ0pYTXVKeXhjYmlBZ0lDQWdJQ0FnSUNBZ0lFTnZibk4wY25WamRHOXlMbVJwYzNCc1lYbE9ZVzFsSUh4OElDZFNaV0ZqZEVOc1lYTnpKeXhjYmlBZ0lDQWdJQ0FnSUNBZ0lITndaV01nUFQwOUlHNTFiR3dnUHlCdWRXeHNJRG9nZEhsd1pXOW1VM0JsWTF4dUlDQWdJQ0FnSUNBZ0lDazdYRzRnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJSDFjYmx4dUlDQWdJQ0FnY21WMGRYSnVPMXh1SUNBZ0lIMWNibHh1SUNBZ0lGOXBiblpoY21saGJuUW9YRzRnSUNBZ0lDQjBlWEJsYjJZZ2MzQmxZeUFoUFQwZ0oyWjFibU4wYVc5dUp5eGNiaUFnSUNBZ0lGd2lVbVZoWTNSRGJHRnpjem9nV1c5MUozSmxJR0YwZEdWdGNIUnBibWNnZEc4Z1hDSWdLMXh1SUNBZ0lDQWdJQ0FuZFhObElHRWdZMjl0Y0c5dVpXNTBJR05zWVhOeklHOXlJR1oxYm1OMGFXOXVJR0Z6SUdFZ2JXbDRhVzR1SUVsdWMzUmxZV1FzSUdwMWMzUWdkWE5sSUdFZ0p5QXJYRzRnSUNBZ0lDQWdJQ2R5WldkMWJHRnlJRzlpYW1WamRDNG5YRzRnSUNBZ0tUdGNiaUFnSUNCZmFXNTJZWEpwWVc1MEtGeHVJQ0FnSUNBZ0lXbHpWbUZzYVdSRmJHVnRaVzUwS0hOd1pXTXBMRnh1SUNBZ0lDQWdYQ0pTWldGamRFTnNZWE56T2lCWmIzVW5jbVVnWVhSMFpXMXdkR2x1WnlCMGJ5QmNJaUFyWEc0Z0lDQWdJQ0FnSUNkMWMyVWdZU0JqYjIxd2IyNWxiblFnWVhNZ1lTQnRhWGhwYmk0Z1NXNXpkR1ZoWkN3Z2FuVnpkQ0IxYzJVZ1lTQnlaV2QxYkdGeUlHOWlhbVZqZEM0blhHNGdJQ0FnS1R0Y2JseHVJQ0FnSUhaaGNpQndjbTkwYnlBOUlFTnZibk4wY25WamRHOXlMbkJ5YjNSdmRIbHdaVHRjYmlBZ0lDQjJZWElnWVhWMGIwSnBibVJRWVdseWN5QTlJSEJ5YjNSdkxsOWZjbVZoWTNSQmRYUnZRbWx1WkZCaGFYSnpPMXh1WEc0Z0lDQWdMeThnUW5rZ2FHRnVaR3hwYm1jZ2JXbDRhVzV6SUdKbFptOXlaU0JoYm5rZ2IzUm9aWElnY0hKdmNHVnlkR2xsY3l3Z2QyVWdaVzV6ZFhKbElIUm9aU0J6WVcxbFhHNGdJQ0FnTHk4Z1kyaGhhVzVwYm1jZ2IzSmtaWElnYVhNZ1lYQndiR2xsWkNCMGJ5QnRaWFJvYjJSeklIZHBkR2dnUkVWR1NVNUZYMDFCVGxrZ2NHOXNhV041TENCM2FHVjBhR1Z5WEc0Z0lDQWdMeThnYldsNGFXNXpJR0Z5WlNCc2FYTjBaV1FnWW1WbWIzSmxJRzl5SUdGbWRHVnlJSFJvWlhObElHMWxkR2h2WkhNZ2FXNGdkR2hsSUhOd1pXTXVYRzRnSUNBZ2FXWWdLSE53WldNdWFHRnpUM2R1VUhKdmNHVnlkSGtvVFVsWVNVNVRYMHRGV1NrcElIdGNiaUFnSUNBZ0lGSkZVMFZTVmtWRVgxTlFSVU5mUzBWWlV5NXRhWGhwYm5Nb1EyOXVjM1J5ZFdOMGIzSXNJSE53WldNdWJXbDRhVzV6S1R0Y2JpQWdJQ0I5WEc1Y2JpQWdJQ0JtYjNJZ0tIWmhjaUJ1WVcxbElHbHVJSE53WldNcElIdGNiaUFnSUNBZ0lHbG1JQ2doYzNCbFl5NW9ZWE5QZDI1UWNtOXdaWEowZVNodVlXMWxLU2tnZTF4dUlDQWdJQ0FnSUNCamIyNTBhVzUxWlR0Y2JpQWdJQ0FnSUgxY2JseHVJQ0FnSUNBZ2FXWWdLRzVoYldVZ1BUMDlJRTFKV0VsT1UxOUxSVmtwSUh0Y2JpQWdJQ0FnSUNBZ0x5OGdWMlVnYUdGMlpTQmhiSEpsWVdSNUlHaGhibVJzWldRZ2JXbDRhVzV6SUdsdUlHRWdjM0JsWTJsaGJDQmpZWE5sSUdGaWIzWmxMbHh1SUNBZ0lDQWdJQ0JqYjI1MGFXNTFaVHRjYmlBZ0lDQWdJSDFjYmx4dUlDQWdJQ0FnZG1GeUlIQnliM0JsY25SNUlEMGdjM0JsWTF0dVlXMWxYVHRjYmlBZ0lDQWdJSFpoY2lCcGMwRnNjbVZoWkhsRVpXWnBibVZrSUQwZ2NISnZkRzh1YUdGelQzZHVVSEp2Y0dWeWRIa29ibUZ0WlNrN1hHNGdJQ0FnSUNCMllXeHBaR0YwWlUxbGRHaHZaRTkyWlhKeWFXUmxLR2x6UVd4eVpXRmtlVVJsWm1sdVpXUXNJRzVoYldVcE8xeHVYRzRnSUNBZ0lDQnBaaUFvVWtWVFJWSldSVVJmVTFCRlExOUxSVmxUTG1oaGMwOTNibEJ5YjNCbGNuUjVLRzVoYldVcEtTQjdYRzRnSUNBZ0lDQWdJRkpGVTBWU1ZrVkVYMU5RUlVOZlMwVlpVMXR1WVcxbFhTaERiMjV6ZEhKMVkzUnZjaXdnY0hKdmNHVnlkSGtwTzF4dUlDQWdJQ0FnZlNCbGJITmxJSHRjYmlBZ0lDQWdJQ0FnTHk4Z1UyVjBkWEFnYldWMGFHOWtjeUJ2YmlCd2NtOTBiM1I1Y0dVNlhHNGdJQ0FnSUNBZ0lDOHZJRlJvWlNCbWIyeHNiM2RwYm1jZ2JXVnRZbVZ5SUcxbGRHaHZaSE1nYzJodmRXeGtJRzV2ZENCaVpTQmhkWFJ2YldGMGFXTmhiR3g1SUdKdmRXNWtPbHh1SUNBZ0lDQWdJQ0F2THlBeExpQkZlSEJsWTNSbFpDQlNaV0ZqZEVOc1lYTnpJRzFsZEdodlpITWdLR2x1SUhSb1pTQmNJbWx1ZEdWeVptRmpaVndpS1M1Y2JpQWdJQ0FnSUNBZ0x5OGdNaTRnVDNabGNuSnBaR1JsYmlCdFpYUm9iMlJ6SUNoMGFHRjBJSGRsY21VZ2JXbDRaV1FnYVc0cExseHVJQ0FnSUNBZ0lDQjJZWElnYVhOU1pXRmpkRU5zWVhOelRXVjBhRzlrSUQwZ1VtVmhZM1JEYkdGemMwbHVkR1Z5Wm1GalpTNW9ZWE5QZDI1UWNtOXdaWEowZVNodVlXMWxLVHRjYmlBZ0lDQWdJQ0FnZG1GeUlHbHpSblZ1WTNScGIyNGdQU0IwZVhCbGIyWWdjSEp2Y0dWeWRIa2dQVDA5SUNkbWRXNWpkR2x2YmljN1hHNGdJQ0FnSUNBZ0lIWmhjaUJ6YUc5MWJHUkJkWFJ2UW1sdVpDQTlYRzRnSUNBZ0lDQWdJQ0FnYVhOR2RXNWpkR2x2YmlBbUpseHVJQ0FnSUNBZ0lDQWdJQ0ZwYzFKbFlXTjBRMnhoYzNOTlpYUm9iMlFnSmlaY2JpQWdJQ0FnSUNBZ0lDQWhhWE5CYkhKbFlXUjVSR1ZtYVc1bFpDQW1KbHh1SUNBZ0lDQWdJQ0FnSUhOd1pXTXVZWFYwYjJKcGJtUWdJVDA5SUdaaGJITmxPMXh1WEc0Z0lDQWdJQ0FnSUdsbUlDaHphRzkxYkdSQmRYUnZRbWx1WkNrZ2UxeHVJQ0FnSUNBZ0lDQWdJR0YxZEc5Q2FXNWtVR0ZwY25NdWNIVnphQ2h1WVcxbExDQndjbTl3WlhKMGVTazdYRzRnSUNBZ0lDQWdJQ0FnY0hKdmRHOWJibUZ0WlYwZ1BTQndjbTl3WlhKMGVUdGNiaUFnSUNBZ0lDQWdmU0JsYkhObElIdGNiaUFnSUNBZ0lDQWdJQ0JwWmlBb2FYTkJiSEpsWVdSNVJHVm1hVzVsWkNrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnZG1GeUlITndaV05RYjJ4cFkza2dQU0JTWldGamRFTnNZWE56U1c1MFpYSm1ZV05sVzI1aGJXVmRPMXh1WEc0Z0lDQWdJQ0FnSUNBZ0lDQXZMeUJVYUdWelpTQmpZWE5sY3lCemFHOTFiR1FnWVd4eVpXRmtlU0JpWlNCallYVm5hSFFnWW5rZ2RtRnNhV1JoZEdWTlpYUm9iMlJQZG1WeWNtbGtaUzVjYmlBZ0lDQWdJQ0FnSUNBZ0lGOXBiblpoY21saGJuUW9YRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lHbHpVbVZoWTNSRGJHRnpjMDFsZEdodlpDQW1KbHh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ2h6Y0dWalVHOXNhV041SUQwOVBTQW5SRVZHU1U1RlgwMUJUbGxmVFVWU1IwVkVKeUI4ZkZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2MzQmxZMUJ2YkdsamVTQTlQVDBnSjBSRlJrbE9SVjlOUVU1Wkp5a3NYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDZFNaV0ZqZEVOc1lYTnpPaUJWYm1WNGNHVmpkR1ZrSUhOd1pXTWdjRzlzYVdONUlDVnpJR1p2Y2lCclpYa2dKWE1nSnlBclhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0ozZG9aVzRnYldsNGFXNW5JR2x1SUdOdmJYQnZibVZ1ZENCemNHVmpjeTRuTEZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0J6Y0dWalVHOXNhV041TEZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0J1WVcxbFhHNGdJQ0FnSUNBZ0lDQWdJQ0FwTzF4dVhHNGdJQ0FnSUNBZ0lDQWdJQ0F2THlCR2IzSWdiV1YwYUc5a2N5QjNhR2xqYUNCaGNtVWdaR1ZtYVc1bFpDQnRiM0psSUhSb1lXNGdiMjVqWlN3Z1kyRnNiQ0IwYUdVZ1pYaHBjM1JwYm1kY2JpQWdJQ0FnSUNBZ0lDQWdJQzh2SUcxbGRHaHZaSE1nWW1WbWIzSmxJR05oYkd4cGJtY2dkR2hsSUc1bGR5QndjbTl3WlhKMGVTd2diV1Z5WjJsdVp5QnBaaUJoY0hCeWIzQnlhV0YwWlM1Y2JpQWdJQ0FnSUNBZ0lDQWdJR2xtSUNoemNHVmpVRzlzYVdONUlEMDlQU0FuUkVWR1NVNUZYMDFCVGxsZlRVVlNSMFZFSnlrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNCd2NtOTBiMXR1WVcxbFhTQTlJR055WldGMFpVMWxjbWRsWkZKbGMzVnNkRVoxYm1OMGFXOXVLSEJ5YjNSdlcyNWhiV1ZkTENCd2NtOXdaWEowZVNrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0I5SUdWc2MyVWdhV1lnS0hOd1pXTlFiMnhwWTNrZ1BUMDlJQ2RFUlVaSlRrVmZUVUZPV1NjcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ2NISnZkRzliYm1GdFpWMGdQU0JqY21WaGRHVkRhR0ZwYm1Wa1JuVnVZM1JwYjI0b2NISnZkRzliYm1GdFpWMHNJSEJ5YjNCbGNuUjVLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdJQ0I5SUdWc2MyVWdlMXh1SUNBZ0lDQWdJQ0FnSUNBZ2NISnZkRzliYm1GdFpWMGdQU0J3Y205d1pYSjBlVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lHbG1JQ2h3Y205alpYTnpMbVZ1ZGk1T1QwUkZYMFZPVmlBaFBUMGdKM0J5YjJSMVkzUnBiMjRuS1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUM4dklFRmtaQ0IyWlhKaWIzTmxJR1JwYzNCc1lYbE9ZVzFsSUhSdklIUm9aU0JtZFc1amRHbHZiaXdnZDJocFkyZ2dhR1ZzY0hNZ2QyaGxiaUJzYjI5cmFXNW5YRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDOHZJR0YwSUhCeWIyWnBiR2x1WnlCMGIyOXNjeTVjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdhV1lnS0hSNWNHVnZaaUJ3Y205d1pYSjBlU0E5UFQwZ0oyWjFibU4wYVc5dUp5QW1KaUJ6Y0dWakxtUnBjM0JzWVhsT1lXMWxLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnY0hKdmRHOWJibUZ0WlYwdVpHbHpjR3hoZVU1aGJXVWdQU0J6Y0dWakxtUnBjM0JzWVhsT1lXMWxJQ3NnSjE4bklDc2dibUZ0WlR0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ2ZWeHVJQ0FnSUgxY2JpQWdmVnh1WEc0Z0lHWjFibU4wYVc5dUlHMXBlRk4wWVhScFkxTndaV05KYm5SdlEyOXRjRzl1Wlc1MEtFTnZibk4wY25WamRHOXlMQ0J6ZEdGMGFXTnpLU0I3WEc0Z0lDQWdhV1lnS0NGemRHRjBhV056S1NCN1hHNGdJQ0FnSUNCeVpYUjFjbTQ3WEc0Z0lDQWdmVnh1SUNBZ0lHWnZjaUFvZG1GeUlHNWhiV1VnYVc0Z2MzUmhkR2xqY3lrZ2UxeHVJQ0FnSUNBZ2RtRnlJSEJ5YjNCbGNuUjVJRDBnYzNSaGRHbGpjMXR1WVcxbFhUdGNiaUFnSUNBZ0lHbG1JQ2doYzNSaGRHbGpjeTVvWVhOUGQyNVFjbTl3WlhKMGVTaHVZVzFsS1NrZ2UxeHVJQ0FnSUNBZ0lDQmpiMjUwYVc1MVpUdGNiaUFnSUNBZ0lIMWNibHh1SUNBZ0lDQWdkbUZ5SUdselVtVnpaWEoyWldRZ1BTQnVZVzFsSUdsdUlGSkZVMFZTVmtWRVgxTlFSVU5mUzBWWlV6dGNiaUFnSUNBZ0lGOXBiblpoY21saGJuUW9YRzRnSUNBZ0lDQWdJQ0ZwYzFKbGMyVnlkbVZrTEZ4dUlDQWdJQ0FnSUNBblVtVmhZM1JEYkdGemN6b2dXVzkxSUdGeVpTQmhkSFJsYlhCMGFXNW5JSFJ2SUdSbFptbHVaU0JoSUhKbGMyVnlkbVZrSUNjZ0sxeHVJQ0FnSUNBZ0lDQWdJQ2R3Y205d1pYSjBlU3dnWUNWellDd2dkR2hoZENCemFHOTFiR1J1WEZ3bmRDQmlaU0J2YmlCMGFHVWdYQ0p6ZEdGMGFXTnpYQ0lnYTJWNUxpQkVaV1pwYm1VZ2FYUWdKeUFyWEc0Z0lDQWdJQ0FnSUNBZ0oyRnpJR0Z1SUdsdWMzUmhibU5sSUhCeWIzQmxjblI1SUdsdWMzUmxZV1E3SUdsMElIZHBiR3dnYzNScGJHd2dZbVVnWVdOalpYTnphV0pzWlNCdmJpQjBhR1VnSnlBclhHNGdJQ0FnSUNBZ0lDQWdKMk52Ym5OMGNuVmpkRzl5TGljc1hHNGdJQ0FnSUNBZ0lHNWhiV1ZjYmlBZ0lDQWdJQ2s3WEc1Y2JpQWdJQ0FnSUhaaGNpQnBjMGx1YUdWeWFYUmxaQ0E5SUc1aGJXVWdhVzRnUTI5dWMzUnlkV04wYjNJN1hHNGdJQ0FnSUNCZmFXNTJZWEpwWVc1MEtGeHVJQ0FnSUNBZ0lDQWhhWE5KYm1obGNtbDBaV1FzWEc0Z0lDQWdJQ0FnSUNkU1pXRmpkRU5zWVhOek9pQlpiM1VnWVhKbElHRjBkR1Z0Y0hScGJtY2dkRzhnWkdWbWFXNWxJQ2NnSzF4dUlDQWdJQ0FnSUNBZ0lDZGdKWE5nSUc5dUlIbHZkWElnWTI5dGNHOXVaVzUwSUcxdmNtVWdkR2hoYmlCdmJtTmxMaUJVYUdseklHTnZibVpzYVdOMElHMWhlU0JpWlNBbklDdGNiaUFnSUNBZ0lDQWdJQ0FuWkhWbElIUnZJR0VnYldsNGFXNHVKeXhjYmlBZ0lDQWdJQ0FnYm1GdFpWeHVJQ0FnSUNBZ0tUdGNiaUFnSUNBZ0lFTnZibk4wY25WamRHOXlXMjVoYldWZElEMGdjSEp2Y0dWeWRIazdYRzRnSUNBZ2ZWeHVJQ0I5WEc1Y2JpQWdMeW9xWEc0Z0lDQXFJRTFsY21kbElIUjNieUJ2WW1wbFkzUnpMQ0JpZFhRZ2RHaHliM2NnYVdZZ1ltOTBhQ0JqYjI1MFlXbHVJSFJvWlNCellXMWxJR3RsZVM1Y2JpQWdJQ3BjYmlBZ0lDb2dRSEJoY21GdElIdHZZbXBsWTNSOUlHOXVaU0JVYUdVZ1ptbHljM1FnYjJKcVpXTjBMQ0IzYUdsamFDQnBjeUJ0ZFhSaGRHVmtMbHh1SUNBZ0tpQkFjR0Z5WVcwZ2UyOWlhbVZqZEgwZ2RIZHZJRlJvWlNCelpXTnZibVFnYjJKcVpXTjBYRzRnSUNBcUlFQnlaWFIxY200Z2UyOWlhbVZqZEgwZ2IyNWxJR0ZtZEdWeUlHbDBJR2hoY3lCaVpXVnVJRzExZEdGMFpXUWdkRzhnWTI5dWRHRnBiaUJsZG1WeWVYUm9hVzVuSUdsdUlIUjNieTVjYmlBZ0lDb3ZYRzRnSUdaMWJtTjBhVzl1SUcxbGNtZGxTVzUwYjFkcGRHaE9iMFIxY0d4cFkyRjBaVXRsZVhNb2IyNWxMQ0IwZDI4cElIdGNiaUFnSUNCZmFXNTJZWEpwWVc1MEtGeHVJQ0FnSUNBZ2IyNWxJQ1ltSUhSM2J5QW1KaUIwZVhCbGIyWWdiMjVsSUQwOVBTQW5iMkpxWldOMEp5QW1KaUIwZVhCbGIyWWdkSGR2SUQwOVBTQW5iMkpxWldOMEp5eGNiaUFnSUNBZ0lDZHRaWEpuWlVsdWRHOVhhWFJvVG05RWRYQnNhV05oZEdWTFpYbHpLQ2s2SUVOaGJtNXZkQ0J0WlhKblpTQnViMjR0YjJKcVpXTjBjeTRuWEc0Z0lDQWdLVHRjYmx4dUlDQWdJR1p2Y2lBb2RtRnlJR3RsZVNCcGJpQjBkMjhwSUh0Y2JpQWdJQ0FnSUdsbUlDaDBkMjh1YUdGelQzZHVVSEp2Y0dWeWRIa29hMlY1S1NrZ2UxeHVJQ0FnSUNBZ0lDQmZhVzUyWVhKcFlXNTBLRnh1SUNBZ0lDQWdJQ0FnSUc5dVpWdHJaWGxkSUQwOVBTQjFibVJsWm1sdVpXUXNYRzRnSUNBZ0lDQWdJQ0FnSjIxbGNtZGxTVzUwYjFkcGRHaE9iMFIxY0d4cFkyRjBaVXRsZVhNb0tUb2dKeUFyWEc0Z0lDQWdJQ0FnSUNBZ0lDQW5WSEpwWldRZ2RHOGdiV1Z5WjJVZ2RIZHZJRzlpYW1WamRITWdkMmwwYUNCMGFHVWdjMkZ0WlNCclpYazZJR0FsYzJBdUlGUm9hWE1nWTI5dVpteHBZM1FnSnlBclhHNGdJQ0FnSUNBZ0lDQWdJQ0FuYldGNUlHSmxJR1IxWlNCMGJ5QmhJRzFwZUdsdU95QnBiaUJ3WVhKMGFXTjFiR0Z5TENCMGFHbHpJRzFoZVNCaVpTQmpZWFZ6WldRZ1lua2dkSGR2SUNjZ0sxeHVJQ0FnSUNBZ0lDQWdJQ0FnSjJkbGRFbHVhWFJwWVd4VGRHRjBaU2dwSUc5eUlHZGxkRVJsWm1GMWJIUlFjbTl3Y3lncElHMWxkR2h2WkhNZ2NtVjBkWEp1YVc1bklHOWlhbVZqZEhNZ0p5QXJYRzRnSUNBZ0lDQWdJQ0FnSUNBbmQybDBhQ0JqYkdGemFHbHVaeUJyWlhsekxpY3NYRzRnSUNBZ0lDQWdJQ0FnYTJWNVhHNGdJQ0FnSUNBZ0lDazdYRzRnSUNBZ0lDQWdJRzl1WlZ0clpYbGRJRDBnZEhkdlcydGxlVjA3WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdmVnh1SUNBZ0lISmxkSFZ5YmlCdmJtVTdYRzRnSUgxY2JseHVJQ0F2S2lwY2JpQWdJQ29nUTNKbFlYUmxjeUJoSUdaMWJtTjBhVzl1SUhSb1lYUWdhVzUyYjJ0bGN5QjBkMjhnWm5WdVkzUnBiMjV6SUdGdVpDQnRaWEpuWlhNZ2RHaGxhWElnY21WMGRYSnVJSFpoYkhWbGN5NWNiaUFnSUNwY2JpQWdJQ29nUUhCaGNtRnRJSHRtZFc1amRHbHZibjBnYjI1bElFWjFibU4wYVc5dUlIUnZJR2x1ZG05clpTQm1hWEp6ZEM1Y2JpQWdJQ29nUUhCaGNtRnRJSHRtZFc1amRHbHZibjBnZEhkdklFWjFibU4wYVc5dUlIUnZJR2x1ZG05clpTQnpaV052Ym1RdVhHNGdJQ0FxSUVCeVpYUjFjbTRnZTJaMWJtTjBhVzl1ZlNCR2RXNWpkR2x2YmlCMGFHRjBJR2x1ZG05clpYTWdkR2hsSUhSM2J5QmhjbWQxYldWdWRDQm1kVzVqZEdsdmJuTXVYRzRnSUNBcUlFQndjbWwyWVhSbFhHNGdJQ0FxTDF4dUlDQm1kVzVqZEdsdmJpQmpjbVZoZEdWTlpYSm5aV1JTWlhOMWJIUkdkVzVqZEdsdmJpaHZibVVzSUhSM2J5a2dlMXh1SUNBZ0lISmxkSFZ5YmlCbWRXNWpkR2x2YmlCdFpYSm5aV1JTWlhOMWJIUW9LU0I3WEc0Z0lDQWdJQ0IyWVhJZ1lTQTlJRzl1WlM1aGNIQnNlU2gwYUdsekxDQmhjbWQxYldWdWRITXBPMXh1SUNBZ0lDQWdkbUZ5SUdJZ1BTQjBkMjh1WVhCd2JIa29kR2hwY3l3Z1lYSm5kVzFsYm5SektUdGNiaUFnSUNBZ0lHbG1JQ2hoSUQwOUlHNTFiR3dwSUh0Y2JpQWdJQ0FnSUNBZ2NtVjBkWEp1SUdJN1hHNGdJQ0FnSUNCOUlHVnNjMlVnYVdZZ0tHSWdQVDBnYm5Wc2JDa2dlMXh1SUNBZ0lDQWdJQ0J5WlhSMWNtNGdZVHRjYmlBZ0lDQWdJSDFjYmlBZ0lDQWdJSFpoY2lCaklEMGdlMzA3WEc0Z0lDQWdJQ0J0WlhKblpVbHVkRzlYYVhSb1RtOUVkWEJzYVdOaGRHVkxaWGx6S0dNc0lHRXBPMXh1SUNBZ0lDQWdiV1Z5WjJWSmJuUnZWMmwwYUU1dlJIVndiR2xqWVhSbFMyVjVjeWhqTENCaUtUdGNiaUFnSUNBZ0lISmxkSFZ5YmlCak8xeHVJQ0FnSUgwN1hHNGdJSDFjYmx4dUlDQXZLaXBjYmlBZ0lDb2dRM0psWVhSbGN5QmhJR1oxYm1OMGFXOXVJSFJvWVhRZ2FXNTJiMnRsY3lCMGQyOGdablZ1WTNScGIyNXpJR0Z1WkNCcFoyNXZjbVZ6SUhSb1pXbHlJSEpsZEhWeWJpQjJZV3hsY3k1Y2JpQWdJQ3BjYmlBZ0lDb2dRSEJoY21GdElIdG1kVzVqZEdsdmJuMGdiMjVsSUVaMWJtTjBhVzl1SUhSdklHbHVkbTlyWlNCbWFYSnpkQzVjYmlBZ0lDb2dRSEJoY21GdElIdG1kVzVqZEdsdmJuMGdkSGR2SUVaMWJtTjBhVzl1SUhSdklHbHVkbTlyWlNCelpXTnZibVF1WEc0Z0lDQXFJRUJ5WlhSMWNtNGdlMloxYm1OMGFXOXVmU0JHZFc1amRHbHZiaUIwYUdGMElHbHVkbTlyWlhNZ2RHaGxJSFIzYnlCaGNtZDFiV1Z1ZENCbWRXNWpkR2x2Ym5NdVhHNGdJQ0FxSUVCd2NtbDJZWFJsWEc0Z0lDQXFMMXh1SUNCbWRXNWpkR2x2YmlCamNtVmhkR1ZEYUdGcGJtVmtSblZ1WTNScGIyNG9iMjVsTENCMGQyOHBJSHRjYmlBZ0lDQnlaWFIxY200Z1puVnVZM1JwYjI0Z1kyaGhhVzVsWkVaMWJtTjBhVzl1S0NrZ2UxeHVJQ0FnSUNBZ2IyNWxMbUZ3Y0d4NUtIUm9hWE1zSUdGeVozVnRaVzUwY3lrN1hHNGdJQ0FnSUNCMGQyOHVZWEJ3Ykhrb2RHaHBjeXdnWVhKbmRXMWxiblJ6S1R0Y2JpQWdJQ0I5TzF4dUlDQjlYRzVjYmlBZ0x5b3FYRzRnSUNBcUlFSnBibVJ6SUdFZ2JXVjBhRzlrSUhSdklIUm9aU0JqYjIxd2IyNWxiblF1WEc0Z0lDQXFYRzRnSUNBcUlFQndZWEpoYlNCN2IySnFaV04wZlNCamIyMXdiMjVsYm5RZ1EyOXRjRzl1Wlc1MElIZG9iM05sSUcxbGRHaHZaQ0JwY3lCbmIybHVaeUIwYnlCaVpTQmliM1Z1WkM1Y2JpQWdJQ29nUUhCaGNtRnRJSHRtZFc1amRHbHZibjBnYldWMGFHOWtJRTFsZEdodlpDQjBieUJpWlNCaWIzVnVaQzVjYmlBZ0lDb2dRSEpsZEhWeWJpQjdablZ1WTNScGIyNTlJRlJvWlNCaWIzVnVaQ0J0WlhSb2IyUXVYRzRnSUNBcUwxeHVJQ0JtZFc1amRHbHZiaUJpYVc1a1FYVjBiMEpwYm1STlpYUm9iMlFvWTI5dGNHOXVaVzUwTENCdFpYUm9iMlFwSUh0Y2JpQWdJQ0IyWVhJZ1ltOTFibVJOWlhSb2IyUWdQU0J0WlhSb2IyUXVZbWx1WkNoamIyMXdiMjVsYm5RcE8xeHVJQ0FnSUdsbUlDaHdjbTlqWlhOekxtVnVkaTVPVDBSRlgwVk9WaUFoUFQwZ0ozQnliMlIxWTNScGIyNG5LU0I3WEc0Z0lDQWdJQ0JpYjNWdVpFMWxkR2h2WkM1ZlgzSmxZV04wUW05MWJtUkRiMjUwWlhoMElEMGdZMjl0Y0c5dVpXNTBPMXh1SUNBZ0lDQWdZbTkxYm1STlpYUm9iMlF1WDE5eVpXRmpkRUp2ZFc1a1RXVjBhRzlrSUQwZ2JXVjBhRzlrTzF4dUlDQWdJQ0FnWW05MWJtUk5aWFJvYjJRdVgxOXlaV0ZqZEVKdmRXNWtRWEpuZFcxbGJuUnpJRDBnYm5Wc2JEdGNiaUFnSUNBZ0lIWmhjaUJqYjIxd2IyNWxiblJPWVcxbElEMGdZMjl0Y0c5dVpXNTBMbU52Ym5OMGNuVmpkRzl5TG1ScGMzQnNZWGxPWVcxbE8xeHVJQ0FnSUNBZ2RtRnlJRjlpYVc1a0lEMGdZbTkxYm1STlpYUm9iMlF1WW1sdVpEdGNiaUFnSUNBZ0lHSnZkVzVrVFdWMGFHOWtMbUpwYm1RZ1BTQm1kVzVqZEdsdmJpaHVaWGRVYUdsektTQjdYRzRnSUNBZ0lDQWdJR1p2Y2lBb1hHNGdJQ0FnSUNBZ0lDQWdkbUZ5SUY5c1pXNGdQU0JoY21kMWJXVnVkSE11YkdWdVozUm9MRnh1SUNBZ0lDQWdJQ0FnSUNBZ1lYSm5jeUE5SUVGeWNtRjVLRjlzWlc0Z1BpQXhJRDhnWDJ4bGJpQXRJREVnT2lBd0tTeGNiaUFnSUNBZ0lDQWdJQ0FnSUY5clpYa2dQU0F4TzF4dUlDQWdJQ0FnSUNBZ0lGOXJaWGtnUENCZmJHVnVPMXh1SUNBZ0lDQWdJQ0FnSUY5clpYa3JLMXh1SUNBZ0lDQWdJQ0FwSUh0Y2JpQWdJQ0FnSUNBZ0lDQmhjbWR6VzE5clpYa2dMU0F4WFNBOUlHRnlaM1Z0Wlc1MGMxdGZhMlY1WFR0Y2JpQWdJQ0FnSUNBZ2ZWeHVYRzRnSUNBZ0lDQWdJQzh2SUZWelpYSWdhWE1nZEhKNWFXNW5JSFJ2SUdKcGJtUW9LU0JoYmlCaGRYUnZZbTkxYm1RZ2JXVjBhRzlrT3lCM1pTQmxabVpsWTNScGRtVnNlU0IzYVd4c1hHNGdJQ0FnSUNBZ0lDOHZJR2xuYm05eVpTQjBhR1VnZG1Gc2RXVWdiMllnWENKMGFHbHpYQ0lnZEdoaGRDQjBhR1VnZFhObGNpQnBjeUIwY25scGJtY2dkRzhnZFhObExDQnpiMXh1SUNBZ0lDQWdJQ0F2THlCc1pYUW5jeUIzWVhKdUxseHVJQ0FnSUNBZ0lDQnBaaUFvYm1WM1ZHaHBjeUFoUFQwZ1kyOXRjRzl1Wlc1MElDWW1JRzVsZDFSb2FYTWdJVDA5SUc1MWJHd3BJSHRjYmlBZ0lDQWdJQ0FnSUNCcFppQW9jSEp2WTJWemN5NWxibll1VGs5RVJWOUZUbFlnSVQwOUlDZHdjbTlrZFdOMGFXOXVKeWtnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdkMkZ5Ym1sdVp5aGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ1ptRnNjMlVzWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ2RpYVc1a0tDazZJRkpsWVdOMElHTnZiWEJ2Ym1WdWRDQnRaWFJvYjJSeklHMWhlU0J2Ym14NUlHSmxJR0p2ZFc1a0lIUnZJSFJvWlNBbklDdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQW5ZMjl0Y0c5dVpXNTBJR2x1YzNSaGJtTmxMaUJUWldVZ0pYTW5MRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQmpiMjF3YjI1bGJuUk9ZVzFsWEc0Z0lDQWdJQ0FnSUNBZ0lDQXBPMXh1SUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ2ZTQmxiSE5sSUdsbUlDZ2hZWEpuY3k1c1pXNW5kR2dwSUh0Y2JpQWdJQ0FnSUNBZ0lDQnBaaUFvY0hKdlkyVnpjeTVsYm5ZdVRrOUVSVjlGVGxZZ0lUMDlJQ2R3Y205a2RXTjBhVzl1SnlrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnZDJGeWJtbHVaeWhjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdabUZzYzJVc1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNkaWFXNWtLQ2s2SUZsdmRTQmhjbVVnWW1sdVpHbHVaeUJoSUdOdmJYQnZibVZ1ZENCdFpYUm9iMlFnZEc4Z2RHaGxJR052YlhCdmJtVnVkQzRnSnlBclhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0oxSmxZV04wSUdSdlpYTWdkR2hwY3lCbWIzSWdlVzkxSUdGMWRHOXRZWFJwWTJGc2JIa2dhVzRnWVNCb2FXZG9MWEJsY21admNtMWhibU5sSUNjZ0sxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDZDNZWGtzSUhOdklIbHZkU0JqWVc0Z2MyRm1aV3g1SUhKbGJXOTJaU0IwYUdseklHTmhiR3d1SUZObFpTQWxjeWNzWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJR052YlhCdmJtVnVkRTVoYldWY2JpQWdJQ0FnSUNBZ0lDQWdJQ2s3WEc0Z0lDQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQmliM1Z1WkUxbGRHaHZaRHRjYmlBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNCMllYSWdjbVZpYjNWdVpFMWxkR2h2WkNBOUlGOWlhVzVrTG1Gd2NHeDVLR0p2ZFc1a1RXVjBhRzlrTENCaGNtZDFiV1Z1ZEhNcE8xeHVJQ0FnSUNBZ0lDQnlaV0p2ZFc1a1RXVjBhRzlrTGw5ZmNtVmhZM1JDYjNWdVpFTnZiblJsZUhRZ1BTQmpiMjF3YjI1bGJuUTdYRzRnSUNBZ0lDQWdJSEpsWW05MWJtUk5aWFJvYjJRdVgxOXlaV0ZqZEVKdmRXNWtUV1YwYUc5a0lEMGdiV1YwYUc5a08xeHVJQ0FnSUNBZ0lDQnlaV0p2ZFc1a1RXVjBhRzlrTGw5ZmNtVmhZM1JDYjNWdVpFRnlaM1Z0Wlc1MGN5QTlJR0Z5WjNNN1hHNGdJQ0FnSUNBZ0lISmxkSFZ5YmlCeVpXSnZkVzVrVFdWMGFHOWtPMXh1SUNBZ0lDQWdmVHRjYmlBZ0lDQjlYRzRnSUNBZ2NtVjBkWEp1SUdKdmRXNWtUV1YwYUc5a08xeHVJQ0I5WEc1Y2JpQWdMeW9xWEc0Z0lDQXFJRUpwYm1SeklHRnNiQ0JoZFhSdkxXSnZkVzVrSUcxbGRHaHZaSE1nYVc0Z1lTQmpiMjF3YjI1bGJuUXVYRzRnSUNBcVhHNGdJQ0FxSUVCd1lYSmhiU0I3YjJKcVpXTjBmU0JqYjIxd2IyNWxiblFnUTI5dGNHOXVaVzUwSUhkb2IzTmxJRzFsZEdodlpDQnBjeUJuYjJsdVp5QjBieUJpWlNCaWIzVnVaQzVjYmlBZ0lDb3ZYRzRnSUdaMWJtTjBhVzl1SUdKcGJtUkJkWFJ2UW1sdVpFMWxkR2h2WkhNb1kyOXRjRzl1Wlc1MEtTQjdYRzRnSUNBZ2RtRnlJSEJoYVhKeklEMGdZMjl0Y0c5dVpXNTBMbDlmY21WaFkzUkJkWFJ2UW1sdVpGQmhhWEp6TzF4dUlDQWdJR1p2Y2lBb2RtRnlJR2tnUFNBd095QnBJRHdnY0dGcGNuTXViR1Z1WjNSb095QnBJQ3M5SURJcElIdGNiaUFnSUNBZ0lIWmhjaUJoZFhSdlFtbHVaRXRsZVNBOUlIQmhhWEp6VzJsZE8xeHVJQ0FnSUNBZ2RtRnlJRzFsZEdodlpDQTlJSEJoYVhKelcya2dLeUF4WFR0Y2JpQWdJQ0FnSUdOdmJYQnZibVZ1ZEZ0aGRYUnZRbWx1WkV0bGVWMGdQU0JpYVc1a1FYVjBiMEpwYm1STlpYUm9iMlFvWTI5dGNHOXVaVzUwTENCdFpYUm9iMlFwTzF4dUlDQWdJSDFjYmlBZ2ZWeHVYRzRnSUhaaGNpQkpjMDF2ZFc1MFpXUlFjbVZOYVhocGJpQTlJSHRjYmlBZ0lDQmpiMjF3YjI1bGJuUkVhV1JOYjNWdWREb2dablZ1WTNScGIyNG9LU0I3WEc0Z0lDQWdJQ0IwYUdsekxsOWZhWE5OYjNWdWRHVmtJRDBnZEhKMVpUdGNiaUFnSUNCOVhHNGdJSDA3WEc1Y2JpQWdkbUZ5SUVselRXOTFiblJsWkZCdmMzUk5hWGhwYmlBOUlIdGNiaUFnSUNCamIyMXdiMjVsYm5SWGFXeHNWVzV0YjNWdWREb2dablZ1WTNScGIyNG9LU0I3WEc0Z0lDQWdJQ0IwYUdsekxsOWZhWE5OYjNWdWRHVmtJRDBnWm1Gc2MyVTdYRzRnSUNBZ2ZWeHVJQ0I5TzF4dVhHNGdJQzhxS2x4dUlDQWdLaUJCWkdRZ2JXOXlaU0IwYnlCMGFHVWdVbVZoWTNSRGJHRnpjeUJpWVhObElHTnNZWE56TGlCVWFHVnpaU0JoY21VZ1lXeHNJR3hsWjJGamVTQm1aV0YwZFhKbGN5QmhibVJjYmlBZ0lDb2dkR2hsY21WbWIzSmxJRzV2ZENCaGJISmxZV1I1SUhCaGNuUWdiMllnZEdobElHMXZaR1Z5YmlCU1pXRmpkRU52YlhCdmJtVnVkQzVjYmlBZ0lDb3ZYRzRnSUhaaGNpQlNaV0ZqZEVOc1lYTnpUV2w0YVc0Z1BTQjdYRzRnSUNBZ0x5b3FYRzRnSUNBZ0lDb2dWRTlFVHpvZ1ZHaHBjeUIzYVd4c0lHSmxJR1JsY0hKbFkyRjBaV1FnWW1WallYVnpaU0J6ZEdGMFpTQnphRzkxYkdRZ1lXeDNZWGx6SUd0bFpYQWdZU0JqYjI1emFYTjBaVzUwWEc0Z0lDQWdJQ29nZEhsd1pTQnphV2R1WVhSMWNtVWdZVzVrSUhSb1pTQnZibXg1SUhWelpTQmpZWE5sSUdadmNpQjBhR2x6TENCcGN5QjBieUJoZG05cFpDQjBhR0YwTGx4dUlDQWdJQ0FxTDF4dUlDQWdJSEpsY0d4aFkyVlRkR0YwWlRvZ1puVnVZM1JwYjI0b2JtVjNVM1JoZEdVc0lHTmhiR3hpWVdOcktTQjdYRzRnSUNBZ0lDQjBhR2x6TG5Wd1pHRjBaWEl1Wlc1eGRXVjFaVkpsY0d4aFkyVlRkR0YwWlNoMGFHbHpMQ0J1WlhkVGRHRjBaU3dnWTJGc2JHSmhZMnNwTzF4dUlDQWdJSDBzWEc1Y2JpQWdJQ0F2S2lwY2JpQWdJQ0FnS2lCRGFHVmphM01nZDJobGRHaGxjaUJ2Y2lCdWIzUWdkR2hwY3lCamIyMXdiM05wZEdVZ1kyOXRjRzl1Wlc1MElHbHpJRzF2ZFc1MFpXUXVYRzRnSUNBZ0lDb2dRSEpsZEhWeWJpQjdZbTl2YkdWaGJuMGdWSEoxWlNCcFppQnRiM1Z1ZEdWa0xDQm1ZV3h6WlNCdmRHaGxjbmRwYzJVdVhHNGdJQ0FnSUNvZ1FIQnliM1JsWTNSbFpGeHVJQ0FnSUNBcUlFQm1hVzVoYkZ4dUlDQWdJQ0FxTDF4dUlDQWdJR2x6VFc5MWJuUmxaRG9nWm5WdVkzUnBiMjRvS1NCN1hHNGdJQ0FnSUNCcFppQW9jSEp2WTJWemN5NWxibll1VGs5RVJWOUZUbFlnSVQwOUlDZHdjbTlrZFdOMGFXOXVKeWtnZTF4dUlDQWdJQ0FnSUNCM1lYSnVhVzVuS0Z4dUlDQWdJQ0FnSUNBZ0lIUm9hWE11WDE5a2FXUlhZWEp1U1hOTmIzVnVkR1ZrTEZ4dUlDQWdJQ0FnSUNBZ0lDY2xjem9nYVhOTmIzVnVkR1ZrSUdseklHUmxjSEpsWTJGMFpXUXVJRWx1YzNSbFlXUXNJRzFoYTJVZ2MzVnlaU0IwYnlCamJHVmhiaUIxY0NBbklDdGNiaUFnSUNBZ0lDQWdJQ0FnSUNkemRXSnpZM0pwY0hScGIyNXpJR0Z1WkNCd1pXNWthVzVuSUhKbGNYVmxjM1J6SUdsdUlHTnZiWEJ2Ym1WdWRGZHBiR3hWYm0xdmRXNTBJSFJ2SUNjZ0sxeHVJQ0FnSUNBZ0lDQWdJQ0FnSjNCeVpYWmxiblFnYldWdGIzSjVJR3hsWVd0ekxpY3NYRzRnSUNBZ0lDQWdJQ0FnS0hSb2FYTXVZMjl1YzNSeWRXTjBiM0lnSmlZZ2RHaHBjeTVqYjI1emRISjFZM1J2Y2k1a2FYTndiR0Y1VG1GdFpTa2dmSHhjYmlBZ0lDQWdJQ0FnSUNBZ0lIUm9hWE11Ym1GdFpTQjhmRnh1SUNBZ0lDQWdJQ0FnSUNBZ0owTnZiWEJ2Ym1WdWRDZGNiaUFnSUNBZ0lDQWdLVHRjYmlBZ0lDQWdJQ0FnZEdocGN5NWZYMlJwWkZkaGNtNUpjMDF2ZFc1MFpXUWdQU0IwY25WbE8xeHVJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ2NtVjBkWEp1SUNFaGRHaHBjeTVmWDJselRXOTFiblJsWkR0Y2JpQWdJQ0I5WEc0Z0lIMDdYRzVjYmlBZ2RtRnlJRkpsWVdOMFEyeGhjM05EYjIxd2IyNWxiblFnUFNCbWRXNWpkR2x2YmlncElIdDlPMXh1SUNCZllYTnphV2R1S0Z4dUlDQWdJRkpsWVdOMFEyeGhjM05EYjIxd2IyNWxiblF1Y0hKdmRHOTBlWEJsTEZ4dUlDQWdJRkpsWVdOMFEyOXRjRzl1Wlc1MExuQnliM1J2ZEhsd1pTeGNiaUFnSUNCU1pXRmpkRU5zWVhOelRXbDRhVzVjYmlBZ0tUdGNibHh1SUNBdktpcGNiaUFnSUNvZ1EzSmxZWFJsY3lCaElHTnZiWEJ2YzJsMFpTQmpiMjF3YjI1bGJuUWdZMnhoYzNNZ1oybDJaVzRnWVNCamJHRnpjeUJ6Y0dWamFXWnBZMkYwYVc5dUxseHVJQ0FnS2lCVFpXVWdhSFIwY0hNNkx5OW1ZV05sWW05dmF5NW5hWFJvZFdJdWFXOHZjbVZoWTNRdlpHOWpjeTkwYjNBdGJHVjJaV3d0WVhCcExtaDBiV3dqY21WaFkzUXVZM0psWVhSbFkyeGhjM05jYmlBZ0lDcGNiaUFnSUNvZ1FIQmhjbUZ0SUh0dlltcGxZM1I5SUhOd1pXTWdRMnhoYzNNZ2MzQmxZMmxtYVdOaGRHbHZiaUFvZDJocFkyZ2diWFZ6ZENCa1pXWnBibVVnWUhKbGJtUmxjbUFwTGx4dUlDQWdLaUJBY21WMGRYSnVJSHRtZFc1amRHbHZibjBnUTI5dGNHOXVaVzUwSUdOdmJuTjBjblZqZEc5eUlHWjFibU4wYVc5dUxseHVJQ0FnS2lCQWNIVmliR2xqWEc0Z0lDQXFMMXh1SUNCbWRXNWpkR2x2YmlCamNtVmhkR1ZEYkdGemN5aHpjR1ZqS1NCN1hHNGdJQ0FnTHk4Z1ZHOGdhMlZsY0NCdmRYSWdkMkZ5Ym1sdVozTWdiVzl5WlNCMWJtUmxjbk4wWVc1a1lXSnNaU3dnZDJVbmJHd2dkWE5sSUdFZ2JHbDBkR3hsSUdoaFkyc2dhR1Z5WlNCMGIxeHVJQ0FnSUM4dklHVnVjM1Z5WlNCMGFHRjBJRU52Ym5OMGNuVmpkRzl5TG01aGJXVWdJVDA5SUNkRGIyNXpkSEoxWTNSdmNpY3VJRlJvYVhNZ2JXRnJaWE1nYzNWeVpTQjNaU0JrYjI0bmRGeHVJQ0FnSUM4dklIVnVibVZqWlhOellYSnBiSGtnYVdSbGJuUnBabmtnWVNCamJHRnpjeUIzYVhSb2IzVjBJR1JwYzNCc1lYbE9ZVzFsSUdGeklDZERiMjV6ZEhKMVkzUnZjaWN1WEc0Z0lDQWdkbUZ5SUVOdmJuTjBjblZqZEc5eUlEMGdhV1JsYm5ScGRIa29ablZ1WTNScGIyNG9jSEp2Y0hNc0lHTnZiblJsZUhRc0lIVndaR0YwWlhJcElIdGNiaUFnSUNBZ0lDOHZJRlJvYVhNZ1kyOXVjM1J5ZFdOMGIzSWdaMlYwY3lCdmRtVnljbWxrWkdWdUlHSjVJRzF2WTJ0ekxpQlVhR1VnWVhKbmRXMWxiblFnYVhNZ2RYTmxaRnh1SUNBZ0lDQWdMeThnWW5rZ2JXOWphM01nZEc4Z1lYTnpaWEowSUc5dUlIZG9ZWFFnWjJWMGN5QnRiM1Z1ZEdWa0xseHVYRzRnSUNBZ0lDQnBaaUFvY0hKdlkyVnpjeTVsYm5ZdVRrOUVSVjlGVGxZZ0lUMDlJQ2R3Y205a2RXTjBhVzl1SnlrZ2UxeHVJQ0FnSUNBZ0lDQjNZWEp1YVc1bktGeHVJQ0FnSUNBZ0lDQWdJSFJvYVhNZ2FXNXpkR0Z1WTJWdlppQkRiMjV6ZEhKMVkzUnZjaXhjYmlBZ0lDQWdJQ0FnSUNBblUyOXRaWFJvYVc1bklHbHpJR05oYkd4cGJtY2dZU0JTWldGamRDQmpiMjF3YjI1bGJuUWdaR2x5WldOMGJIa3VJRlZ6WlNCaElHWmhZM1J2Y25rZ2IzSWdKeUFyWEc0Z0lDQWdJQ0FnSUNBZ0lDQW5TbE5ZSUdsdWMzUmxZV1F1SUZObFpUb2dhSFIwY0hNNkx5OW1ZaTV0WlM5eVpXRmpkQzFzWldkaFkzbG1ZV04wYjNKNUoxeHVJQ0FnSUNBZ0lDQXBPMXh1SUNBZ0lDQWdmVnh1WEc0Z0lDQWdJQ0F2THlCWGFYSmxJSFZ3SUdGMWRHOHRZbWx1WkdsdVoxeHVJQ0FnSUNBZ2FXWWdLSFJvYVhNdVgxOXlaV0ZqZEVGMWRHOUNhVzVrVUdGcGNuTXViR1Z1WjNSb0tTQjdYRzRnSUNBZ0lDQWdJR0pwYm1SQmRYUnZRbWx1WkUxbGRHaHZaSE1vZEdocGN5azdYRzRnSUNBZ0lDQjlYRzVjYmlBZ0lDQWdJSFJvYVhNdWNISnZjSE1nUFNCd2NtOXdjenRjYmlBZ0lDQWdJSFJvYVhNdVkyOXVkR1Y0ZENBOUlHTnZiblJsZUhRN1hHNGdJQ0FnSUNCMGFHbHpMbkpsWm5NZ1BTQmxiWEIwZVU5aWFtVmpkRHRjYmlBZ0lDQWdJSFJvYVhNdWRYQmtZWFJsY2lBOUlIVndaR0YwWlhJZ2ZId2dVbVZoWTNST2IyOXdWWEJrWVhSbFVYVmxkV1U3WEc1Y2JpQWdJQ0FnSUhSb2FYTXVjM1JoZEdVZ1BTQnVkV3hzTzF4dVhHNGdJQ0FnSUNBdkx5QlNaV0ZqZEVOc1lYTnpaWE1nWkc5bGMyNG5kQ0JvWVhabElHTnZibk4wY25WamRHOXljeTRnU1c1emRHVmhaQ3dnZEdobGVTQjFjMlVnZEdobFhHNGdJQ0FnSUNBdkx5Qm5aWFJKYm1sMGFXRnNVM1JoZEdVZ1lXNWtJR052YlhCdmJtVnVkRmRwYkd4TmIzVnVkQ0J0WlhSb2IyUnpJR1p2Y2lCcGJtbDBhV0ZzYVhwaGRHbHZiaTVjYmx4dUlDQWdJQ0FnZG1GeUlHbHVhWFJwWVd4VGRHRjBaU0E5SUhSb2FYTXVaMlYwU1c1cGRHbGhiRk4wWVhSbElEOGdkR2hwY3k1blpYUkpibWwwYVdGc1UzUmhkR1VvS1NBNklHNTFiR3c3WEc0Z0lDQWdJQ0JwWmlBb2NISnZZMlZ6Y3k1bGJuWXVUazlFUlY5RlRsWWdJVDA5SUNkd2NtOWtkV04wYVc5dUp5a2dlMXh1SUNBZ0lDQWdJQ0F2THlCWFpTQmhiR3h2ZHlCaGRYUnZMVzF2WTJ0eklIUnZJSEJ5YjJObFpXUWdZWE1nYVdZZ2RHaGxlU2R5WlNCeVpYUjFjbTVwYm1jZ2JuVnNiQzVjYmlBZ0lDQWdJQ0FnYVdZZ0tGeHVJQ0FnSUNBZ0lDQWdJR2x1YVhScFlXeFRkR0YwWlNBOVBUMGdkVzVrWldacGJtVmtJQ1ltWEc0Z0lDQWdJQ0FnSUNBZ2RHaHBjeTVuWlhSSmJtbDBhV0ZzVTNSaGRHVXVYMmx6VFc5amEwWjFibU4wYVc5dVhHNGdJQ0FnSUNBZ0lDa2dlMXh1SUNBZ0lDQWdJQ0FnSUM4dklGUm9hWE1nYVhNZ2NISnZZbUZpYkhrZ1ltRmtJSEJ5WVdOMGFXTmxMaUJEYjI1emFXUmxjaUIzWVhKdWFXNW5JR2hsY21VZ1lXNWtYRzRnSUNBZ0lDQWdJQ0FnTHk4Z1pHVndjbVZqWVhScGJtY2dkR2hwY3lCamIyNTJaVzVwWlc1alpTNWNiaUFnSUNBZ0lDQWdJQ0JwYm1sMGFXRnNVM1JoZEdVZ1BTQnVkV3hzTzF4dUlDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNCOVhHNGdJQ0FnSUNCZmFXNTJZWEpwWVc1MEtGeHVJQ0FnSUNBZ0lDQjBlWEJsYjJZZ2FXNXBkR2xoYkZOMFlYUmxJRDA5UFNBbmIySnFaV04wSnlBbUppQWhRWEp5WVhrdWFYTkJjbkpoZVNocGJtbDBhV0ZzVTNSaGRHVXBMRnh1SUNBZ0lDQWdJQ0FuSlhNdVoyVjBTVzVwZEdsaGJGTjBZWFJsS0NrNklHMTFjM1FnY21WMGRYSnVJR0Z1SUc5aWFtVmpkQ0J2Y2lCdWRXeHNKeXhjYmlBZ0lDQWdJQ0FnUTI5dWMzUnlkV04wYjNJdVpHbHpjR3hoZVU1aGJXVWdmSHdnSjFKbFlXTjBRMjl0Y0c5emFYUmxRMjl0Y0c5dVpXNTBKMXh1SUNBZ0lDQWdLVHRjYmx4dUlDQWdJQ0FnZEdocGN5NXpkR0YwWlNBOUlHbHVhWFJwWVd4VGRHRjBaVHRjYmlBZ0lDQjlLVHRjYmlBZ0lDQkRiMjV6ZEhKMVkzUnZjaTV3Y205MGIzUjVjR1VnUFNCdVpYY2dVbVZoWTNSRGJHRnpjME52YlhCdmJtVnVkQ2dwTzF4dUlDQWdJRU52Ym5OMGNuVmpkRzl5TG5CeWIzUnZkSGx3WlM1amIyNXpkSEoxWTNSdmNpQTlJRU52Ym5OMGNuVmpkRzl5TzF4dUlDQWdJRU52Ym5OMGNuVmpkRzl5TG5CeWIzUnZkSGx3WlM1ZlgzSmxZV04wUVhWMGIwSnBibVJRWVdseWN5QTlJRnRkTzF4dVhHNGdJQ0FnYVc1cVpXTjBaV1JOYVhocGJuTXVabTl5UldGamFDaHRhWGhUY0dWalNXNTBiME52YlhCdmJtVnVkQzVpYVc1a0tHNTFiR3dzSUVOdmJuTjBjblZqZEc5eUtTazdYRzVjYmlBZ0lDQnRhWGhUY0dWalNXNTBiME52YlhCdmJtVnVkQ2hEYjI1emRISjFZM1J2Y2l3Z1NYTk5iM1Z1ZEdWa1VISmxUV2w0YVc0cE8xeHVJQ0FnSUcxcGVGTndaV05KYm5SdlEyOXRjRzl1Wlc1MEtFTnZibk4wY25WamRHOXlMQ0J6Y0dWaktUdGNiaUFnSUNCdGFYaFRjR1ZqU1c1MGIwTnZiWEJ2Ym1WdWRDaERiMjV6ZEhKMVkzUnZjaXdnU1hOTmIzVnVkR1ZrVUc5emRFMXBlR2x1S1R0Y2JseHVJQ0FnSUM4dklFbHVhWFJwWVd4cGVtVWdkR2hsSUdSbFptRjFiSFJRY205d2N5QndjbTl3WlhKMGVTQmhablJsY2lCaGJHd2diV2w0YVc1eklHaGhkbVVnWW1WbGJpQnRaWEpuWldRdVhHNGdJQ0FnYVdZZ0tFTnZibk4wY25WamRHOXlMbWRsZEVSbFptRjFiSFJRY205d2N5a2dlMXh1SUNBZ0lDQWdRMjl1YzNSeWRXTjBiM0l1WkdWbVlYVnNkRkJ5YjNCeklEMGdRMjl1YzNSeWRXTjBiM0l1WjJWMFJHVm1ZWFZzZEZCeWIzQnpLQ2s3WEc0Z0lDQWdmVnh1WEc0Z0lDQWdhV1lnS0hCeWIyTmxjM011Wlc1MkxrNVBSRVZmUlU1V0lDRTlQU0FuY0hKdlpIVmpkR2x2YmljcElIdGNiaUFnSUNBZ0lDOHZJRlJvYVhNZ2FYTWdZU0IwWVdjZ2RHOGdhVzVrYVdOaGRHVWdkR2hoZENCMGFHVWdkWE5sSUc5bUlIUm9aWE5sSUcxbGRHaHZaQ0J1WVcxbGN5QnBjeUJ2YXl4Y2JpQWdJQ0FnSUM4dklITnBibU5sSUdsMEozTWdkWE5sWkNCM2FYUm9JR055WldGMFpVTnNZWE56TGlCSlppQnBkQ2R6SUc1dmRDd2dkR2hsYmlCcGRDZHpJR3hwYTJWc2VTQmhYRzRnSUNBZ0lDQXZMeUJ0YVhOMFlXdGxJSE52SUhkbEoyeHNJSGRoY200Z2VXOTFJSFJ2SUhWelpTQjBhR1VnYzNSaGRHbGpJSEJ5YjNCbGNuUjVMQ0J3Y205d1pYSjBlVnh1SUNBZ0lDQWdMeThnYVc1cGRHbGhiR2w2WlhJZ2IzSWdZMjl1YzNSeWRXTjBiM0lnY21WemNHVmpkR2wyWld4NUxseHVJQ0FnSUNBZ2FXWWdLRU52Ym5OMGNuVmpkRzl5TG1kbGRFUmxabUYxYkhSUWNtOXdjeWtnZTF4dUlDQWdJQ0FnSUNCRGIyNXpkSEoxWTNSdmNpNW5aWFJFWldaaGRXeDBVSEp2Y0hNdWFYTlNaV0ZqZEVOc1lYTnpRWEJ3Y205MlpXUWdQU0I3ZlR0Y2JpQWdJQ0FnSUgxY2JpQWdJQ0FnSUdsbUlDaERiMjV6ZEhKMVkzUnZjaTV3Y205MGIzUjVjR1V1WjJWMFNXNXBkR2xoYkZOMFlYUmxLU0I3WEc0Z0lDQWdJQ0FnSUVOdmJuTjBjblZqZEc5eUxuQnliM1J2ZEhsd1pTNW5aWFJKYm1sMGFXRnNVM1JoZEdVdWFYTlNaV0ZqZEVOc1lYTnpRWEJ3Y205MlpXUWdQU0I3ZlR0Y2JpQWdJQ0FnSUgxY2JpQWdJQ0I5WEc1Y2JpQWdJQ0JmYVc1MllYSnBZVzUwS0Z4dUlDQWdJQ0FnUTI5dWMzUnlkV04wYjNJdWNISnZkRzkwZVhCbExuSmxibVJsY2l4Y2JpQWdJQ0FnSUNkamNtVmhkR1ZEYkdGemN5Z3VMaTRwT2lCRGJHRnpjeUJ6Y0dWamFXWnBZMkYwYVc5dUlHMTFjM1FnYVcxd2JHVnRaVzUwSUdFZ1lISmxibVJsY21BZ2JXVjBhRzlrTGlkY2JpQWdJQ0FwTzF4dVhHNGdJQ0FnYVdZZ0tIQnliMk5sYzNNdVpXNTJMazVQUkVWZlJVNVdJQ0U5UFNBbmNISnZaSFZqZEdsdmJpY3BJSHRjYmlBZ0lDQWdJSGRoY201cGJtY29YRzRnSUNBZ0lDQWdJQ0ZEYjI1emRISjFZM1J2Y2k1d2NtOTBiM1I1Y0dVdVkyOXRjRzl1Wlc1MFUyaHZkV3hrVlhCa1lYUmxMRnh1SUNBZ0lDQWdJQ0FuSlhNZ2FHRnpJR0VnYldWMGFHOWtJR05oYkd4bFpDQW5JQ3RjYmlBZ0lDQWdJQ0FnSUNBblkyOXRjRzl1Wlc1MFUyaHZkV3hrVlhCa1lYUmxLQ2t1SUVScFpDQjViM1VnYldWaGJpQnphRzkxYkdSRGIyMXdiMjVsYm5SVmNHUmhkR1VvS1Q4Z0p5QXJYRzRnSUNBZ0lDQWdJQ0FnSjFSb1pTQnVZVzFsSUdseklIQm9jbUZ6WldRZ1lYTWdZU0J4ZFdWemRHbHZiaUJpWldOaGRYTmxJSFJvWlNCbWRXNWpkR2x2YmlCcGN5QW5JQ3RjYmlBZ0lDQWdJQ0FnSUNBblpYaHdaV04wWldRZ2RHOGdjbVYwZFhKdUlHRWdkbUZzZFdVdUp5eGNiaUFnSUNBZ0lDQWdjM0JsWXk1a2FYTndiR0Y1VG1GdFpTQjhmQ0FuUVNCamIyMXdiMjVsYm5RblhHNGdJQ0FnSUNBcE8xeHVJQ0FnSUNBZ2QyRnlibWx1WnloY2JpQWdJQ0FnSUNBZ0lVTnZibk4wY25WamRHOXlMbkJ5YjNSdmRIbHdaUzVqYjIxd2IyNWxiblJYYVd4c1VtVmphV1YyWlZCeWIzQnpMRnh1SUNBZ0lDQWdJQ0FuSlhNZ2FHRnpJR0VnYldWMGFHOWtJR05oYkd4bFpDQW5JQ3RjYmlBZ0lDQWdJQ0FnSUNBblkyOXRjRzl1Wlc1MFYybHNiRkpsWTJsbGRtVlFjbTl3Y3lncExpQkVhV1FnZVc5MUlHMWxZVzRnWTI5dGNHOXVaVzUwVjJsc2JGSmxZMlZwZG1WUWNtOXdjeWdwUHljc1hHNGdJQ0FnSUNBZ0lITndaV011WkdsemNHeGhlVTVoYldVZ2ZId2dKMEVnWTI5dGNHOXVaVzUwSjF4dUlDQWdJQ0FnS1R0Y2JpQWdJQ0I5WEc1Y2JpQWdJQ0F2THlCU1pXUjFZMlVnZEdsdFpTQnpjR1Z1ZENCa2IybHVaeUJzYjI5cmRYQnpJR0o1SUhObGRIUnBibWNnZEdobGMyVWdiMjRnZEdobElIQnliM1J2ZEhsd1pTNWNiaUFnSUNCbWIzSWdLSFpoY2lCdFpYUm9iMlJPWVcxbElHbHVJRkpsWVdOMFEyeGhjM05KYm5SbGNtWmhZMlVwSUh0Y2JpQWdJQ0FnSUdsbUlDZ2hRMjl1YzNSeWRXTjBiM0l1Y0hKdmRHOTBlWEJsVzIxbGRHaHZaRTVoYldWZEtTQjdYRzRnSUNBZ0lDQWdJRU52Ym5OMGNuVmpkRzl5TG5CeWIzUnZkSGx3WlZ0dFpYUm9iMlJPWVcxbFhTQTlJRzUxYkd3N1hHNGdJQ0FnSUNCOVhHNGdJQ0FnZlZ4dVhHNGdJQ0FnY21WMGRYSnVJRU52Ym5OMGNuVmpkRzl5TzF4dUlDQjlYRzVjYmlBZ2NtVjBkWEp1SUdOeVpXRjBaVU5zWVhOek8xeHVmVnh1WEc1dGIyUjFiR1V1Wlhod2IzSjBjeUE5SUdaaFkzUnZjbms3WEc0aUxDSXZLbHh1YjJKcVpXTjBMV0Z6YzJsbmJseHVLR01wSUZOcGJtUnlaU0JUYjNKb2RYTmNia0JzYVdObGJuTmxJRTFKVkZ4dUtpOWNibHh1SjNWelpTQnpkSEpwWTNRbk8xeHVMeW9nWlhOc2FXNTBMV1JwYzJGaWJHVWdibTh0ZFc1MWMyVmtMWFpoY25NZ0tpOWNiblpoY2lCblpYUlBkMjVRY205d1pYSjBlVk41YldKdmJITWdQU0JQWW1wbFkzUXVaMlYwVDNkdVVISnZjR1Z5ZEhsVGVXMWliMnh6TzF4dWRtRnlJR2hoYzA5M2JsQnliM0JsY25SNUlEMGdUMkpxWldOMExuQnliM1J2ZEhsd1pTNW9ZWE5QZDI1UWNtOXdaWEowZVR0Y2JuWmhjaUJ3Y205d1NYTkZiblZ0WlhKaFlteGxJRDBnVDJKcVpXTjBMbkJ5YjNSdmRIbHdaUzV3Y205d1pYSjBlVWx6Ulc1MWJXVnlZV0pzWlR0Y2JseHVablZ1WTNScGIyNGdkRzlQWW1wbFkzUW9kbUZzS1NCN1hHNWNkR2xtSUNoMllXd2dQVDA5SUc1MWJHd2dmSHdnZG1Gc0lEMDlQU0IxYm1SbFptbHVaV1FwSUh0Y2JseDBYSFIwYUhKdmR5QnVaWGNnVkhsd1pVVnljbTl5S0NkUFltcGxZM1F1WVhOemFXZHVJR05oYm01dmRDQmlaU0JqWVd4c1pXUWdkMmwwYUNCdWRXeHNJRzl5SUhWdVpHVm1hVzVsWkNjcE8xeHVYSFI5WEc1Y2JseDBjbVYwZFhKdUlFOWlhbVZqZENoMllXd3BPMXh1ZlZ4dVhHNW1kVzVqZEdsdmJpQnphRzkxYkdSVmMyVk9ZWFJwZG1Vb0tTQjdYRzVjZEhSeWVTQjdYRzVjZEZ4MGFXWWdLQ0ZQWW1wbFkzUXVZWE56YVdkdUtTQjdYRzVjZEZ4MFhIUnlaWFIxY200Z1ptRnNjMlU3WEc1Y2RGeDBmVnh1WEc1Y2RGeDBMeThnUkdWMFpXTjBJR0oxWjJkNUlIQnliM0JsY25SNUlHVnVkVzFsY21GMGFXOXVJRzl5WkdWeUlHbHVJRzlzWkdWeUlGWTRJSFpsY25OcGIyNXpMbHh1WEc1Y2RGeDBMeThnYUhSMGNITTZMeTlpZFdkekxtTm9jbTl0YVhWdExtOXlaeTl3TDNZNEwybHpjM1ZsY3k5a1pYUmhhV3cvYVdROU5ERXhPRnh1WEhSY2RIWmhjaUIwWlhOME1TQTlJRzVsZHlCVGRISnBibWNvSjJGaVl5Y3BPeUFnTHk4Z1pYTnNhVzUwTFdScGMyRmliR1V0YkdsdVpTQnVieTF1WlhjdGQzSmhjSEJsY25OY2JseDBYSFIwWlhOME1WczFYU0E5SUNka1pTYzdYRzVjZEZ4MGFXWWdLRTlpYW1WamRDNW5aWFJQZDI1UWNtOXdaWEowZVU1aGJXVnpLSFJsYzNReEtWc3dYU0E5UFQwZ0p6VW5LU0I3WEc1Y2RGeDBYSFJ5WlhSMWNtNGdabUZzYzJVN1hHNWNkRngwZlZ4dVhHNWNkRngwTHk4Z2FIUjBjSE02THk5aWRXZHpMbU5vY205dGFYVnRMbTl5Wnk5d0wzWTRMMmx6YzNWbGN5OWtaWFJoYVd3L2FXUTlNekExTmx4dVhIUmNkSFpoY2lCMFpYTjBNaUE5SUh0OU8xeHVYSFJjZEdadmNpQW9kbUZ5SUdrZ1BTQXdPeUJwSUR3Z01UQTdJR2tyS3lrZ2UxeHVYSFJjZEZ4MGRHVnpkREpiSjE4bklDc2dVM1J5YVc1bkxtWnliMjFEYUdGeVEyOWtaU2hwS1YwZ1BTQnBPMXh1WEhSY2RIMWNibHgwWEhSMllYSWdiM0prWlhJeUlEMGdUMkpxWldOMExtZGxkRTkzYmxCeWIzQmxjblI1VG1GdFpYTW9kR1Z6ZERJcExtMWhjQ2htZFc1amRHbHZiaUFvYmlrZ2UxeHVYSFJjZEZ4MGNtVjBkWEp1SUhSbGMzUXlXMjVkTzF4dVhIUmNkSDBwTzF4dVhIUmNkR2xtSUNodmNtUmxjakl1YW05cGJpZ25KeWtnSVQwOUlDY3dNVEl6TkRVMk56ZzVKeWtnZTF4dVhIUmNkRngwY21WMGRYSnVJR1poYkhObE8xeHVYSFJjZEgxY2JseHVYSFJjZEM4dklHaDBkSEJ6T2k4dlluVm5jeTVqYUhKdmJXbDFiUzV2Y21jdmNDOTJPQzlwYzNOMVpYTXZaR1YwWVdsc1AybGtQVE13TlRaY2JseDBYSFIyWVhJZ2RHVnpkRE1nUFNCN2ZUdGNibHgwWEhRbllXSmpaR1ZtWjJocGFtdHNiVzV2Y0hGeWMzUW5Mbk53YkdsMEtDY25LUzVtYjNKRllXTm9LR1oxYm1OMGFXOXVJQ2hzWlhSMFpYSXBJSHRjYmx4MFhIUmNkSFJsYzNRelcyeGxkSFJsY2wwZ1BTQnNaWFIwWlhJN1hHNWNkRngwZlNrN1hHNWNkRngwYVdZZ0tFOWlhbVZqZEM1clpYbHpLRTlpYW1WamRDNWhjM05wWjI0b2UzMHNJSFJsYzNRektTa3VhbTlwYmlnbkp5a2dJVDA5WEc1Y2RGeDBYSFJjZENkaFltTmtaV1puYUdscWEyeHRibTl3Y1hKemRDY3BJSHRjYmx4MFhIUmNkSEpsZEhWeWJpQm1ZV3h6WlR0Y2JseDBYSFI5WEc1Y2JseDBYSFJ5WlhSMWNtNGdkSEoxWlR0Y2JseDBmU0JqWVhSamFDQW9aWEp5S1NCN1hHNWNkRngwTHk4Z1YyVWdaRzl1SjNRZ1pYaHdaV04wSUdGdWVTQnZaaUIwYUdVZ1lXSnZkbVVnZEc4Z2RHaHliM2NzSUdKMWRDQmlaWFIwWlhJZ2RHOGdZbVVnYzJGbVpTNWNibHgwWEhSeVpYUjFjbTRnWm1Gc2MyVTdYRzVjZEgxY2JuMWNibHh1Ylc5a2RXeGxMbVY0Y0c5eWRITWdQU0J6YUc5MWJHUlZjMlZPWVhScGRtVW9LU0EvSUU5aWFtVmpkQzVoYzNOcFoyNGdPaUJtZFc1amRHbHZiaUFvZEdGeVoyVjBMQ0J6YjNWeVkyVXBJSHRjYmx4MGRtRnlJR1p5YjIwN1hHNWNkSFpoY2lCMGJ5QTlJSFJ2VDJKcVpXTjBLSFJoY21kbGRDazdYRzVjZEhaaGNpQnplVzFpYjJ4ek8xeHVYRzVjZEdadmNpQW9kbUZ5SUhNZ1BTQXhPeUJ6SUR3Z1lYSm5kVzFsYm5SekxteGxibWQwYURzZ2N5c3JLU0I3WEc1Y2RGeDBabkp2YlNBOUlFOWlhbVZqZENoaGNtZDFiV1Z1ZEhOYmMxMHBPMXh1WEc1Y2RGeDBabTl5SUNoMllYSWdhMlY1SUdsdUlHWnliMjBwSUh0Y2JseDBYSFJjZEdsbUlDaG9ZWE5QZDI1UWNtOXdaWEowZVM1allXeHNLR1p5YjIwc0lHdGxlU2twSUh0Y2JseDBYSFJjZEZ4MGRHOWJhMlY1WFNBOUlHWnliMjFiYTJWNVhUdGNibHgwWEhSY2RIMWNibHgwWEhSOVhHNWNibHgwWEhScFppQW9aMlYwVDNkdVVISnZjR1Z5ZEhsVGVXMWliMnh6S1NCN1hHNWNkRngwWEhSemVXMWliMnh6SUQwZ1oyVjBUM2R1VUhKdmNHVnlkSGxUZVcxaWIyeHpLR1p5YjIwcE8xeHVYSFJjZEZ4MFptOXlJQ2gyWVhJZ2FTQTlJREE3SUdrZ1BDQnplVzFpYjJ4ekxteGxibWQwYURzZ2FTc3JLU0I3WEc1Y2RGeDBYSFJjZEdsbUlDaHdjbTl3U1hORmJuVnRaWEpoWW14bExtTmhiR3dvWm5KdmJTd2djM2x0WW05c2MxdHBYU2twSUh0Y2JseDBYSFJjZEZ4MFhIUjBiMXR6ZVcxaWIyeHpXMmxkWFNBOUlHWnliMjFiYzNsdFltOXNjMXRwWFYwN1hHNWNkRngwWEhSY2RIMWNibHgwWEhSY2RIMWNibHgwWEhSOVhHNWNkSDFjYmx4dVhIUnlaWFIxY200Z2RHODdYRzU5TzF4dUlpd2lYQ0oxYzJVZ2MzUnlhV04wWENJN1hHNWNiaThxS2x4dUlDb2dRMjl3ZVhKcFoyaDBJQ2hqS1NBeU1ERXpMWEJ5WlhObGJuUXNJRVpoWTJWaWIyOXJMQ0JKYm1NdVhHNGdLaUJCYkd3Z2NtbG5hSFJ6SUhKbGMyVnlkbVZrTGx4dUlDcGNiaUFxSUZSb2FYTWdjMjkxY21ObElHTnZaR1VnYVhNZ2JHbGpaVzV6WldRZ2RXNWtaWElnZEdobElFSlRSQzF6ZEhsc1pTQnNhV05sYm5ObElHWnZkVzVrSUdsdUlIUm9aVnh1SUNvZ1RFbERSVTVUUlNCbWFXeGxJR2x1SUhSb1pTQnliMjkwSUdScGNtVmpkRzl5ZVNCdlppQjBhR2x6SUhOdmRYSmpaU0IwY21WbExpQkJiaUJoWkdScGRHbHZibUZzSUdkeVlXNTBYRzRnS2lCdlppQndZWFJsYm5RZ2NtbG5hSFJ6SUdOaGJpQmlaU0JtYjNWdVpDQnBiaUIwYUdVZ1VFRlVSVTVVVXlCbWFXeGxJR2x1SUhSb1pTQnpZVzFsSUdScGNtVmpkRzl5ZVM1Y2JpQXFYRzRnS2lCY2JpQXFMMXh1WEc1bWRXNWpkR2x2YmlCdFlXdGxSVzF3ZEhsR2RXNWpkR2x2YmloaGNtY3BJSHRjYmlBZ2NtVjBkWEp1SUdaMWJtTjBhVzl1SUNncElIdGNiaUFnSUNCeVpYUjFjbTRnWVhKbk8xeHVJQ0I5TzF4dWZWeHVYRzR2S2lwY2JpQXFJRlJvYVhNZ1puVnVZM1JwYjI0Z1lXTmpaWEIwY3lCaGJtUWdaR2x6WTJGeVpITWdhVzV3ZFhSek95QnBkQ0JvWVhNZ2JtOGdjMmxrWlNCbFptWmxZM1J6TGlCVWFHbHpJR2x6WEc0Z0tpQndjbWx0WVhKcGJIa2dkWE5sWm5Wc0lHbGthVzl0WVhScFkyRnNiSGtnWm05eUlHOTJaWEp5YVdSaFlteGxJR1oxYm1OMGFXOXVJR1Z1WkhCdmFXNTBjeUIzYUdsamFGeHVJQ29nWVd4M1lYbHpJRzVsWldRZ2RHOGdZbVVnWTJGc2JHRmliR1VzSUhOcGJtTmxJRXBUSUd4aFkydHpJR0VnYm5Wc2JDMWpZV3hzSUdsa2FXOXRJR0ZzWVNCRGIyTnZZUzVjYmlBcUwxeHVkbUZ5SUdWdGNIUjVSblZ1WTNScGIyNGdQU0JtZFc1amRHbHZiaUJsYlhCMGVVWjFibU4wYVc5dUtDa2dlMzA3WEc1Y2JtVnRjSFI1Um5WdVkzUnBiMjR1ZEdoaGRGSmxkSFZ5Ym5NZ1BTQnRZV3RsUlcxd2RIbEdkVzVqZEdsdmJqdGNibVZ0Y0hSNVJuVnVZM1JwYjI0dWRHaGhkRkpsZEhWeWJuTkdZV3h6WlNBOUlHMWhhMlZGYlhCMGVVWjFibU4wYVc5dUtHWmhiSE5sS1R0Y2JtVnRjSFI1Um5WdVkzUnBiMjR1ZEdoaGRGSmxkSFZ5Ym5OVWNuVmxJRDBnYldGclpVVnRjSFI1Um5WdVkzUnBiMjRvZEhKMVpTazdYRzVsYlhCMGVVWjFibU4wYVc5dUxuUm9ZWFJTWlhSMWNtNXpUblZzYkNBOUlHMWhhMlZGYlhCMGVVWjFibU4wYVc5dUtHNTFiR3dwTzF4dVpXMXdkSGxHZFc1amRHbHZiaTUwYUdGMFVtVjBkWEp1YzFSb2FYTWdQU0JtZFc1amRHbHZiaUFvS1NCN1hHNGdJSEpsZEhWeWJpQjBhR2x6TzF4dWZUdGNibVZ0Y0hSNVJuVnVZM1JwYjI0dWRHaGhkRkpsZEhWeWJuTkJjbWQxYldWdWRDQTlJR1oxYm1OMGFXOXVJQ2hoY21jcElIdGNiaUFnY21WMGRYSnVJR0Z5Wnp0Y2JuMDdYRzVjYm0xdlpIVnNaUzVsZUhCdmNuUnpJRDBnWlcxd2RIbEdkVzVqZEdsdmJqc2lMQ0l2S2lwY2JpQXFJRU52Y0hseWFXZG9kQ0FvWXlrZ01qQXhNeTF3Y21WelpXNTBMQ0JHWVdObFltOXZheXdnU1c1akxseHVJQ29nUVd4c0lISnBaMmgwY3lCeVpYTmxjblpsWkM1Y2JpQXFYRzRnS2lCVWFHbHpJSE52ZFhKalpTQmpiMlJsSUdseklHeHBZMlZ1YzJWa0lIVnVaR1Z5SUhSb1pTQkNVMFF0YzNSNWJHVWdiR2xqWlc1elpTQm1iM1Z1WkNCcGJpQjBhR1ZjYmlBcUlFeEpRMFZPVTBVZ1ptbHNaU0JwYmlCMGFHVWdjbTl2ZENCa2FYSmxZM1J2Y25rZ2IyWWdkR2hwY3lCemIzVnlZMlVnZEhKbFpTNGdRVzRnWVdSa2FYUnBiMjVoYkNCbmNtRnVkRnh1SUNvZ2IyWWdjR0YwWlc1MElISnBaMmgwY3lCallXNGdZbVVnWm05MWJtUWdhVzRnZEdobElGQkJWRVZPVkZNZ1ptbHNaU0JwYmlCMGFHVWdjMkZ0WlNCa2FYSmxZM1J2Y25rdVhHNGdLbHh1SUNvdlhHNWNiaWQxYzJVZ2MzUnlhV04wSnp0Y2JseHVkbUZ5SUdWdGNIUjVUMkpxWldOMElEMGdlMzA3WEc1Y2JtbG1JQ2h3Y205alpYTnpMbVZ1ZGk1T1QwUkZYMFZPVmlBaFBUMGdKM0J5YjJSMVkzUnBiMjRuS1NCN1hHNGdJRTlpYW1WamRDNW1jbVZsZW1Vb1pXMXdkSGxQWW1wbFkzUXBPMXh1ZlZ4dVhHNXRiMlIxYkdVdVpYaHdiM0owY3lBOUlHVnRjSFI1VDJKcVpXTjBPeUlzSWk4cUtseHVJQ29nUTI5d2VYSnBaMmgwSUNoaktTQXlNREV6TFhCeVpYTmxiblFzSUVaaFkyVmliMjlyTENCSmJtTXVYRzRnS2lCQmJHd2djbWxuYUhSeklISmxjMlZ5ZG1Wa0xseHVJQ3BjYmlBcUlGUm9hWE1nYzI5MWNtTmxJR052WkdVZ2FYTWdiR2xqWlc1elpXUWdkVzVrWlhJZ2RHaGxJRUpUUkMxemRIbHNaU0JzYVdObGJuTmxJR1p2ZFc1a0lHbHVJSFJvWlZ4dUlDb2dURWxEUlU1VFJTQm1hV3hsSUdsdUlIUm9aU0J5YjI5MElHUnBjbVZqZEc5eWVTQnZaaUIwYUdseklITnZkWEpqWlNCMGNtVmxMaUJCYmlCaFpHUnBkR2x2Ym1Gc0lHZHlZVzUwWEc0Z0tpQnZaaUJ3WVhSbGJuUWdjbWxuYUhSeklHTmhiaUJpWlNCbWIzVnVaQ0JwYmlCMGFHVWdVRUZVUlU1VVV5Qm1hV3hsSUdsdUlIUm9aU0J6WVcxbElHUnBjbVZqZEc5eWVTNWNiaUFxWEc0Z0tpOWNibHh1SjNWelpTQnpkSEpwWTNRbk8xeHVYRzR2S2lwY2JpQXFJRlZ6WlNCcGJuWmhjbWxoYm5Rb0tTQjBieUJoYzNObGNuUWdjM1JoZEdVZ2QyaHBZMmdnZVc5MWNpQndjbTluY21GdElHRnpjM1Z0WlhNZ2RHOGdZbVVnZEhKMVpTNWNiaUFxWEc0Z0tpQlFjbTkyYVdSbElITndjbWx1ZEdZdGMzUjViR1VnWm05eWJXRjBJQ2h2Ym14NUlDVnpJR2x6SUhOMWNIQnZjblJsWkNrZ1lXNWtJR0Z5WjNWdFpXNTBjMXh1SUNvZ2RHOGdjSEp2ZG1sa1pTQnBibVp2Y20xaGRHbHZiaUJoWW05MWRDQjNhR0YwSUdKeWIydGxJR0Z1WkNCM2FHRjBJSGx2ZFNCM1pYSmxYRzRnS2lCbGVIQmxZM1JwYm1jdVhHNGdLbHh1SUNvZ1ZHaGxJR2x1ZG1GeWFXRnVkQ0J0WlhOellXZGxJSGRwYkd3Z1ltVWdjM1J5YVhCd1pXUWdhVzRnY0hKdlpIVmpkR2x2Yml3Z1luVjBJSFJvWlNCcGJuWmhjbWxoYm5SY2JpQXFJSGRwYkd3Z2NtVnRZV2x1SUhSdklHVnVjM1Z5WlNCc2IyZHBZeUJrYjJWeklHNXZkQ0JrYVdabVpYSWdhVzRnY0hKdlpIVmpkR2x2Ymk1Y2JpQXFMMXh1WEc1MllYSWdkbUZzYVdSaGRHVkdiM0p0WVhRZ1BTQm1kVzVqZEdsdmJpQjJZV3hwWkdGMFpVWnZjbTFoZENobWIzSnRZWFFwSUh0OU8xeHVYRzVwWmlBb2NISnZZMlZ6Y3k1bGJuWXVUazlFUlY5RlRsWWdJVDA5SUNkd2NtOWtkV04wYVc5dUp5a2dlMXh1SUNCMllXeHBaR0YwWlVadmNtMWhkQ0E5SUdaMWJtTjBhVzl1SUhaaGJHbGtZWFJsUm05eWJXRjBLR1p2Y20xaGRDa2dlMXh1SUNBZ0lHbG1JQ2htYjNKdFlYUWdQVDA5SUhWdVpHVm1hVzVsWkNrZ2UxeHVJQ0FnSUNBZ2RHaHliM2NnYm1WM0lFVnljbTl5S0NkcGJuWmhjbWxoYm5RZ2NtVnhkV2x5WlhNZ1lXNGdaWEp5YjNJZ2JXVnpjMkZuWlNCaGNtZDFiV1Z1ZENjcE8xeHVJQ0FnSUgxY2JpQWdmVHRjYm4xY2JseHVablZ1WTNScGIyNGdhVzUyWVhKcFlXNTBLR052Ym1ScGRHbHZiaXdnWm05eWJXRjBMQ0JoTENCaUxDQmpMQ0JrTENCbExDQm1LU0I3WEc0Z0lIWmhiR2xrWVhSbFJtOXliV0YwS0dadmNtMWhkQ2s3WEc1Y2JpQWdhV1lnS0NGamIyNWthWFJwYjI0cElIdGNiaUFnSUNCMllYSWdaWEp5YjNJN1hHNGdJQ0FnYVdZZ0tHWnZjbTFoZENBOVBUMGdkVzVrWldacGJtVmtLU0I3WEc0Z0lDQWdJQ0JsY25KdmNpQTlJRzVsZHlCRmNuSnZjaWduVFdsdWFXWnBaV1FnWlhoalpYQjBhVzl1SUc5alkzVnljbVZrT3lCMWMyVWdkR2hsSUc1dmJpMXRhVzVwWm1sbFpDQmtaWFlnWlc1MmFYSnZibTFsYm5RZ0p5QXJJQ2RtYjNJZ2RHaGxJR1oxYkd3Z1pYSnliM0lnYldWemMyRm5aU0JoYm1RZ1lXUmthWFJwYjI1aGJDQm9aV3h3Wm5Wc0lIZGhjbTVwYm1kekxpY3BPMXh1SUNBZ0lIMGdaV3h6WlNCN1hHNGdJQ0FnSUNCMllYSWdZWEpuY3lBOUlGdGhMQ0JpTENCakxDQmtMQ0JsTENCbVhUdGNiaUFnSUNBZ0lIWmhjaUJoY21kSmJtUmxlQ0E5SURBN1hHNGdJQ0FnSUNCbGNuSnZjaUE5SUc1bGR5QkZjbkp2Y2lobWIzSnRZWFF1Y21Wd2JHRmpaU2d2SlhNdlp5d2dablZ1WTNScGIyNGdLQ2tnZTF4dUlDQWdJQ0FnSUNCeVpYUjFjbTRnWVhKbmMxdGhjbWRKYm1SbGVDc3JYVHRjYmlBZ0lDQWdJSDBwS1R0Y2JpQWdJQ0FnSUdWeWNtOXlMbTVoYldVZ1BTQW5TVzUyWVhKcFlXNTBJRlpwYjJ4aGRHbHZiaWM3WEc0Z0lDQWdmVnh1WEc0Z0lDQWdaWEp5YjNJdVpuSmhiV1Z6Vkc5UWIzQWdQU0F4T3lBdkx5QjNaU0JrYjI0bmRDQmpZWEpsSUdGaWIzVjBJR2x1ZG1GeWFXRnVkQ2R6SUc5M2JpQm1jbUZ0WlZ4dUlDQWdJSFJvY205M0lHVnljbTl5TzF4dUlDQjlYRzU5WEc1Y2JtMXZaSFZzWlM1bGVIQnZjblJ6SUQwZ2FXNTJZWEpwWVc1ME95SXNJaThxS2x4dUlDb2dRMjl3ZVhKcFoyaDBJREl3TVRRdE1qQXhOU3dnUm1GalpXSnZiMnNzSUVsdVl5NWNiaUFxSUVGc2JDQnlhV2RvZEhNZ2NtVnpaWEoyWldRdVhHNGdLbHh1SUNvZ1ZHaHBjeUJ6YjNWeVkyVWdZMjlrWlNCcGN5QnNhV05sYm5ObFpDQjFibVJsY2lCMGFHVWdRbE5FTFhOMGVXeGxJR3hwWTJWdWMyVWdabTkxYm1RZ2FXNGdkR2hsWEc0Z0tpQk1TVU5GVGxORklHWnBiR1VnYVc0Z2RHaGxJSEp2YjNRZ1pHbHlaV04wYjNKNUlHOW1JSFJvYVhNZ2MyOTFjbU5sSUhSeVpXVXVJRUZ1SUdGa1pHbDBhVzl1WVd3Z1ozSmhiblJjYmlBcUlHOW1JSEJoZEdWdWRDQnlhV2RvZEhNZ1kyRnVJR0psSUdadmRXNWtJR2x1SUhSb1pTQlFRVlJGVGxSVElHWnBiR1VnYVc0Z2RHaGxJSE5oYldVZ1pHbHlaV04wYjNKNUxseHVJQ3BjYmlBcUwxeHVYRzRuZFhObElITjBjbWxqZENjN1hHNWNiblpoY2lCbGJYQjBlVVoxYm1OMGFXOXVJRDBnY21WeGRXbHlaU2duTGk5bGJYQjBlVVoxYm1OMGFXOXVKeWs3WEc1Y2JpOHFLbHh1SUNvZ1UybHRhV3hoY2lCMGJ5QnBiblpoY21saGJuUWdZblYwSUc5dWJIa2diRzluY3lCaElIZGhjbTVwYm1jZ2FXWWdkR2hsSUdOdmJtUnBkR2x2YmlCcGN5QnViM1FnYldWMExseHVJQ29nVkdocGN5QmpZVzRnWW1VZ2RYTmxaQ0IwYnlCc2IyY2dhWE56ZFdWeklHbHVJR1JsZG1Wc2IzQnRaVzUwSUdWdWRtbHliMjV0Wlc1MGN5QnBiaUJqY21sMGFXTmhiRnh1SUNvZ2NHRjBhSE11SUZKbGJXOTJhVzVuSUhSb1pTQnNiMmRuYVc1bklHTnZaR1VnWm05eUlIQnliMlIxWTNScGIyNGdaVzUyYVhKdmJtMWxiblJ6SUhkcGJHd2dhMlZsY0NCMGFHVmNiaUFxSUhOaGJXVWdiRzluYVdNZ1lXNWtJR1p2Ykd4dmR5QjBhR1VnYzJGdFpTQmpiMlJsSUhCaGRHaHpMbHh1SUNvdlhHNWNiblpoY2lCM1lYSnVhVzVuSUQwZ1pXMXdkSGxHZFc1amRHbHZianRjYmx4dWFXWWdLSEJ5YjJObGMzTXVaVzUyTGs1UFJFVmZSVTVXSUNFOVBTQW5jSEp2WkhWamRHbHZiaWNwSUh0Y2JpQWdkbUZ5SUhCeWFXNTBWMkZ5Ym1sdVp5QTlJR1oxYm1OMGFXOXVJSEJ5YVc1MFYyRnlibWx1WnlobWIzSnRZWFFwSUh0Y2JpQWdJQ0JtYjNJZ0tIWmhjaUJmYkdWdUlEMGdZWEpuZFcxbGJuUnpMbXhsYm1kMGFDd2dZWEpuY3lBOUlFRnljbUY1S0Y5c1pXNGdQaUF4SUQ4Z1gyeGxiaUF0SURFZ09pQXdLU3dnWDJ0bGVTQTlJREU3SUY5clpYa2dQQ0JmYkdWdU95QmZhMlY1S3lzcElIdGNiaUFnSUNBZ0lHRnlaM05iWDJ0bGVTQXRJREZkSUQwZ1lYSm5kVzFsYm5SelcxOXJaWGxkTzF4dUlDQWdJSDFjYmx4dUlDQWdJSFpoY2lCaGNtZEpibVJsZUNBOUlEQTdYRzRnSUNBZ2RtRnlJRzFsYzNOaFoyVWdQU0FuVjJGeWJtbHVaem9nSnlBcklHWnZjbTFoZEM1eVpYQnNZV05sS0M4bGN5OW5MQ0JtZFc1amRHbHZiaUFvS1NCN1hHNGdJQ0FnSUNCeVpYUjFjbTRnWVhKbmMxdGhjbWRKYm1SbGVDc3JYVHRjYmlBZ0lDQjlLVHRjYmlBZ0lDQnBaaUFvZEhsd1pXOW1JR052Ym5OdmJHVWdJVDA5SUNkMWJtUmxabWx1WldRbktTQjdYRzRnSUNBZ0lDQmpiMjV6YjJ4bExtVnljbTl5S0cxbGMzTmhaMlVwTzF4dUlDQWdJSDFjYmlBZ0lDQjBjbmtnZTF4dUlDQWdJQ0FnTHk4Z0xTMHRJRmRsYkdOdmJXVWdkRzhnWkdWaWRXZG5hVzVuSUZKbFlXTjBJQzB0TFZ4dUlDQWdJQ0FnTHk4Z1ZHaHBjeUJsY25KdmNpQjNZWE1nZEdoeWIzZHVJR0Z6SUdFZ1kyOXVkbVZ1YVdWdVkyVWdjMjhnZEdoaGRDQjViM1VnWTJGdUlIVnpaU0IwYUdseklITjBZV05yWEc0Z0lDQWdJQ0F2THlCMGJ5Qm1hVzVrSUhSb1pTQmpZV3hzYzJsMFpTQjBhR0YwSUdOaGRYTmxaQ0IwYUdseklIZGhjbTVwYm1jZ2RHOGdabWx5WlM1Y2JpQWdJQ0FnSUhSb2NtOTNJRzVsZHlCRmNuSnZjaWh0WlhOellXZGxLVHRjYmlBZ0lDQjlJR05oZEdOb0lDaDRLU0I3ZlZ4dUlDQjlPMXh1WEc0Z0lIZGhjbTVwYm1jZ1BTQm1kVzVqZEdsdmJpQjNZWEp1YVc1bktHTnZibVJwZEdsdmJpd2dabTl5YldGMEtTQjdYRzRnSUNBZ2FXWWdLR1p2Y20xaGRDQTlQVDBnZFc1a1pXWnBibVZrS1NCN1hHNGdJQ0FnSUNCMGFISnZkeUJ1WlhjZ1JYSnliM0lvSjJCM1lYSnVhVzVuS0dOdmJtUnBkR2x2Yml3Z1ptOXliV0YwTENBdUxpNWhjbWR6S1dBZ2NtVnhkV2x5WlhNZ1lTQjNZWEp1YVc1bklDY2dLeUFuYldWemMyRm5aU0JoY21kMWJXVnVkQ2NwTzF4dUlDQWdJSDFjYmx4dUlDQWdJR2xtSUNobWIzSnRZWFF1YVc1a1pYaFBaaWduUm1GcGJHVmtJRU52YlhCdmMybDBaU0J3Y205d1ZIbHdaVG9nSnlrZ1BUMDlJREFwSUh0Y2JpQWdJQ0FnSUhKbGRIVnlianNnTHk4Z1NXZHViM0psSUVOdmJYQnZjMmwwWlVOdmJYQnZibVZ1ZENCd2NtOXdkSGx3WlNCamFHVmpheTVjYmlBZ0lDQjlYRzVjYmlBZ0lDQnBaaUFvSVdOdmJtUnBkR2x2YmlrZ2UxeHVJQ0FnSUNBZ1ptOXlJQ2gyWVhJZ1gyeGxiaklnUFNCaGNtZDFiV1Z1ZEhNdWJHVnVaM1JvTENCaGNtZHpJRDBnUVhKeVlYa29YMnhsYmpJZ1BpQXlJRDhnWDJ4bGJqSWdMU0F5SURvZ01Da3NJRjlyWlhreUlEMGdNanNnWDJ0bGVUSWdQQ0JmYkdWdU1qc2dYMnRsZVRJckt5a2dlMXh1SUNBZ0lDQWdJQ0JoY21kelcxOXJaWGt5SUMwZ01sMGdQU0JoY21kMWJXVnVkSE5iWDJ0bGVUSmRPMXh1SUNBZ0lDQWdmVnh1WEc0Z0lDQWdJQ0J3Y21sdWRGZGhjbTVwYm1jdVlYQndiSGtvZFc1a1pXWnBibVZrTENCYlptOXliV0YwWFM1amIyNWpZWFFvWVhKbmN5a3BPMXh1SUNBZ0lIMWNiaUFnZlR0Y2JuMWNibHh1Ylc5a2RXeGxMbVY0Y0c5eWRITWdQU0IzWVhKdWFXNW5PeUlzSWk4cUlWeHVJQ29nUkdWMFpYSnRhVzVsSUdsbUlHRnVJRzlpYW1WamRDQnBjeUJoSUVKMVptWmxjbHh1SUNwY2JpQXFJRUJoZFhSb2IzSWdJQ0JHWlhKdmMzTWdRV0p2ZFd0b1lXUnBhbVZvSUR4bVpYSnZjM05BWm1WeWIzTnpMbTl5Wno0Z1BHaDBkSEE2THk5bVpYSnZjM011YjNKblBseHVJQ29nUUd4cFkyVnVjMlVnSUUxSlZGeHVJQ292WEc1Y2JpOHZJRlJvWlNCZmFYTkNkV1ptWlhJZ1kyaGxZMnNnYVhNZ1ptOXlJRk5oWm1GeWFTQTFMVGNnYzNWd2NHOXlkQ3dnWW1WallYVnpaU0JwZENkeklHMXBjM05wYm1kY2JpOHZJRTlpYW1WamRDNXdjbTkwYjNSNWNHVXVZMjl1YzNSeWRXTjBiM0l1SUZKbGJXOTJaU0IwYUdseklHVjJaVzUwZFdGc2JIbGNibTF2WkhWc1pTNWxlSEJ2Y25SeklEMGdablZ1WTNScGIyNGdLRzlpYWlrZ2UxeHVJQ0J5WlhSMWNtNGdiMkpxSUNFOUlHNTFiR3dnSmlZZ0tHbHpRblZtWm1WeUtHOWlhaWtnZkh3Z2FYTlRiRzkzUW5WbVptVnlLRzlpYWlrZ2ZId2dJU0Z2WW1vdVgybHpRblZtWm1WeUtWeHVmVnh1WEc1bWRXNWpkR2x2YmlCcGMwSjFabVpsY2lBb2IySnFLU0I3WEc0Z0lISmxkSFZ5YmlBaElXOWlhaTVqYjI1emRISjFZM1J2Y2lBbUppQjBlWEJsYjJZZ2IySnFMbU52Ym5OMGNuVmpkRzl5TG1selFuVm1abVZ5SUQwOVBTQW5ablZ1WTNScGIyNG5JQ1ltSUc5aWFpNWpiMjV6ZEhKMVkzUnZjaTVwYzBKMVptWmxjaWh2WW1vcFhHNTlYRzVjYmk4dklFWnZjaUJPYjJSbElIWXdMakV3SUhOMWNIQnZjblF1SUZKbGJXOTJaU0IwYUdseklHVjJaVzUwZFdGc2JIa3VYRzVtZFc1amRHbHZiaUJwYzFOc2IzZENkV1ptWlhJZ0tHOWlhaWtnZTF4dUlDQnlaWFIxY200Z2RIbHdaVzltSUc5aWFpNXlaV0ZrUm14dllYUk1SU0E5UFQwZ0oyWjFibU4wYVc5dUp5QW1KaUIwZVhCbGIyWWdiMkpxTG5Oc2FXTmxJRDA5UFNBblpuVnVZM1JwYjI0bklDWW1JR2x6UW5WbVptVnlLRzlpYWk1emJHbGpaU2d3TENBd0tTbGNibjFjYmlJc0lpOHZJSE5vYVcwZ1ptOXlJSFZ6YVc1bklIQnliMk5sYzNNZ2FXNGdZbkp2ZDNObGNseHVkbUZ5SUhCeWIyTmxjM01nUFNCdGIyUjFiR1V1Wlhod2IzSjBjeUE5SUh0OU8xeHVYRzR2THlCallXTm9aV1FnWm5KdmJTQjNhR0YwWlhabGNpQm5iRzlpWVd3Z2FYTWdjSEpsYzJWdWRDQnpieUIwYUdGMElIUmxjM1FnY25WdWJtVnljeUIwYUdGMElITjBkV0lnYVhSY2JpOHZJR1J2YmlkMElHSnlaV0ZySUhSb2FXNW5jeTRnSUVKMWRDQjNaU0J1WldWa0lIUnZJSGR5WVhBZ2FYUWdhVzRnWVNCMGNua2dZMkYwWTJnZ2FXNGdZMkZ6WlNCcGRDQnBjMXh1THk4Z2QzSmhjSEJsWkNCcGJpQnpkSEpwWTNRZ2JXOWtaU0JqYjJSbElIZG9hV05vSUdSdlpYTnVKM1FnWkdWbWFXNWxJR0Z1ZVNCbmJHOWlZV3h6TGlBZ1NYUW5jeUJwYm5OcFpHVWdZVnh1THk4Z1puVnVZM1JwYjI0Z1ltVmpZWFZ6WlNCMGNua3ZZMkYwWTJobGN5QmtaVzl3ZEdsdGFYcGxJR2x1SUdObGNuUmhhVzRnWlc1bmFXNWxjeTVjYmx4dWRtRnlJR05oWTJobFpGTmxkRlJwYldWdmRYUTdYRzUyWVhJZ1kyRmphR1ZrUTJ4bFlYSlVhVzFsYjNWME8xeHVYRzVtZFc1amRHbHZiaUJrWldaaGRXeDBVMlYwVkdsdGIzVjBLQ2tnZTF4dUlDQWdJSFJvY205M0lHNWxkeUJGY25KdmNpZ25jMlYwVkdsdFpXOTFkQ0JvWVhNZ2JtOTBJR0psWlc0Z1pHVm1hVzVsWkNjcE8xeHVmVnh1Wm5WdVkzUnBiMjRnWkdWbVlYVnNkRU5zWldGeVZHbHRaVzkxZENBb0tTQjdYRzRnSUNBZ2RHaHliM2NnYm1WM0lFVnljbTl5S0NkamJHVmhjbFJwYldWdmRYUWdhR0Z6SUc1dmRDQmlaV1Z1SUdSbFptbHVaV1FuS1R0Y2JuMWNiaWhtZFc1amRHbHZiaUFvS1NCN1hHNGdJQ0FnZEhKNUlIdGNiaUFnSUNBZ0lDQWdhV1lnS0hSNWNHVnZaaUJ6WlhSVWFXMWxiM1YwSUQwOVBTQW5ablZ1WTNScGIyNG5LU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQmpZV05vWldSVFpYUlVhVzFsYjNWMElEMGdjMlYwVkdsdFpXOTFkRHRjYmlBZ0lDQWdJQ0FnZlNCbGJITmxJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lHTmhZMmhsWkZObGRGUnBiV1Z2ZFhRZ1BTQmtaV1poZFd4MFUyVjBWR2x0YjNWME8xeHVJQ0FnSUNBZ0lDQjlYRzRnSUNBZ2ZTQmpZWFJqYUNBb1pTa2dlMXh1SUNBZ0lDQWdJQ0JqWVdOb1pXUlRaWFJVYVcxbGIzVjBJRDBnWkdWbVlYVnNkRk5sZEZScGJXOTFkRHRjYmlBZ0lDQjlYRzRnSUNBZ2RISjVJSHRjYmlBZ0lDQWdJQ0FnYVdZZ0tIUjVjR1Z2WmlCamJHVmhjbFJwYldWdmRYUWdQVDA5SUNkbWRXNWpkR2x2YmljcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUdOaFkyaGxaRU5zWldGeVZHbHRaVzkxZENBOUlHTnNaV0Z5VkdsdFpXOTFkRHRjYmlBZ0lDQWdJQ0FnZlNCbGJITmxJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lHTmhZMmhsWkVOc1pXRnlWR2x0Wlc5MWRDQTlJR1JsWm1GMWJIUkRiR1ZoY2xScGJXVnZkWFE3WEc0Z0lDQWdJQ0FnSUgxY2JpQWdJQ0I5SUdOaGRHTm9JQ2hsS1NCN1hHNGdJQ0FnSUNBZ0lHTmhZMmhsWkVOc1pXRnlWR2x0Wlc5MWRDQTlJR1JsWm1GMWJIUkRiR1ZoY2xScGJXVnZkWFE3WEc0Z0lDQWdmVnh1ZlNBb0tTbGNibVoxYm1OMGFXOXVJSEoxYmxScGJXVnZkWFFvWm5WdUtTQjdYRzRnSUNBZ2FXWWdLR05oWTJobFpGTmxkRlJwYldWdmRYUWdQVDA5SUhObGRGUnBiV1Z2ZFhRcElIdGNiaUFnSUNBZ0lDQWdMeTl1YjNKdFlXd2daVzUyYVhKdmJXVnVkSE1nYVc0Z2MyRnVaU0J6YVhSMVlYUnBiMjV6WEc0Z0lDQWdJQ0FnSUhKbGRIVnliaUJ6WlhSVWFXMWxiM1YwS0daMWJpd2dNQ2s3WEc0Z0lDQWdmVnh1SUNBZ0lDOHZJR2xtSUhObGRGUnBiV1Z2ZFhRZ2QyRnpiaWQwSUdGMllXbHNZV0pzWlNCaWRYUWdkMkZ6SUd4aGRIUmxjaUJrWldacGJtVmtYRzRnSUNBZ2FXWWdLQ2hqWVdOb1pXUlRaWFJVYVcxbGIzVjBJRDA5UFNCa1pXWmhkV3gwVTJWMFZHbHRiM1YwSUh4OElDRmpZV05vWldSVFpYUlVhVzFsYjNWMEtTQW1KaUJ6WlhSVWFXMWxiM1YwS1NCN1hHNGdJQ0FnSUNBZ0lHTmhZMmhsWkZObGRGUnBiV1Z2ZFhRZ1BTQnpaWFJVYVcxbGIzVjBPMXh1SUNBZ0lDQWdJQ0J5WlhSMWNtNGdjMlYwVkdsdFpXOTFkQ2htZFc0c0lEQXBPMXh1SUNBZ0lIMWNiaUFnSUNCMGNua2dlMXh1SUNBZ0lDQWdJQ0F2THlCM2FHVnVJSGRvWlc0Z2MyOXRaV0p2WkhrZ2FHRnpJSE5qY21WM1pXUWdkMmwwYUNCelpYUlVhVzFsYjNWMElHSjFkQ0J1YnlCSkxrVXVJRzFoWkdSdVpYTnpYRzRnSUNBZ0lDQWdJSEpsZEhWeWJpQmpZV05vWldSVFpYUlVhVzFsYjNWMEtHWjFiaXdnTUNrN1hHNGdJQ0FnZlNCallYUmphQ2hsS1h0Y2JpQWdJQ0FnSUNBZ2RISjVJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDOHZJRmRvWlc0Z2QyVWdZWEpsSUdsdUlFa3VSUzRnWW5WMElIUm9aU0J6WTNKcGNIUWdhR0Z6SUdKbFpXNGdaWFpoYkdWa0lITnZJRWt1UlM0Z1pHOWxjMjRuZENCMGNuVnpkQ0IwYUdVZ1oyeHZZbUZzSUc5aWFtVmpkQ0IzYUdWdUlHTmhiR3hsWkNCdWIzSnRZV3hzZVZ4dUlDQWdJQ0FnSUNBZ0lDQWdjbVYwZFhKdUlHTmhZMmhsWkZObGRGUnBiV1Z2ZFhRdVkyRnNiQ2h1ZFd4c0xDQm1kVzRzSURBcE8xeHVJQ0FnSUNBZ0lDQjlJR05oZEdOb0tHVXBlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0x5OGdjMkZ0WlNCaGN5QmhZbTkyWlNCaWRYUWdkMmhsYmlCcGRDZHpJR0VnZG1WeWMybHZiaUJ2WmlCSkxrVXVJSFJvWVhRZ2JYVnpkQ0JvWVhabElIUm9aU0JuYkc5aVlXd2diMkpxWldOMElHWnZjaUFuZEdocGN5Y3NJR2h2Y0daMWJHeDVJRzkxY2lCamIyNTBaWGgwSUdOdmNuSmxZM1FnYjNSb1pYSjNhWE5sSUdsMElIZHBiR3dnZEdoeWIzY2dZU0JuYkc5aVlXd2daWEp5YjNKY2JpQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQmpZV05vWldSVFpYUlVhVzFsYjNWMExtTmhiR3dvZEdocGN5d2dablZ1TENBd0tUdGNiaUFnSUNBZ0lDQWdmVnh1SUNBZ0lIMWNibHh1WEc1OVhHNW1kVzVqZEdsdmJpQnlkVzVEYkdWaGNsUnBiV1Z2ZFhRb2JXRnlhMlZ5S1NCN1hHNGdJQ0FnYVdZZ0tHTmhZMmhsWkVOc1pXRnlWR2x0Wlc5MWRDQTlQVDBnWTJ4bFlYSlVhVzFsYjNWMEtTQjdYRzRnSUNBZ0lDQWdJQzh2Ym05eWJXRnNJR1Z1ZG1seWIyMWxiblJ6SUdsdUlITmhibVVnYzJsMGRXRjBhVzl1YzF4dUlDQWdJQ0FnSUNCeVpYUjFjbTRnWTJ4bFlYSlVhVzFsYjNWMEtHMWhjbXRsY2lrN1hHNGdJQ0FnZlZ4dUlDQWdJQzh2SUdsbUlHTnNaV0Z5VkdsdFpXOTFkQ0IzWVhOdUozUWdZWFpoYVd4aFlteGxJR0oxZENCM1lYTWdiR0YwZEdWeUlHUmxabWx1WldSY2JpQWdJQ0JwWmlBb0tHTmhZMmhsWkVOc1pXRnlWR2x0Wlc5MWRDQTlQVDBnWkdWbVlYVnNkRU5zWldGeVZHbHRaVzkxZENCOGZDQWhZMkZqYUdWa1EyeGxZWEpVYVcxbGIzVjBLU0FtSmlCamJHVmhjbFJwYldWdmRYUXBJSHRjYmlBZ0lDQWdJQ0FnWTJGamFHVmtRMnhsWVhKVWFXMWxiM1YwSUQwZ1kyeGxZWEpVYVcxbGIzVjBPMXh1SUNBZ0lDQWdJQ0J5WlhSMWNtNGdZMnhsWVhKVWFXMWxiM1YwS0cxaGNtdGxjaWs3WEc0Z0lDQWdmVnh1SUNBZ0lIUnllU0I3WEc0Z0lDQWdJQ0FnSUM4dklIZG9aVzRnZDJobGJpQnpiMjFsWW05a2VTQm9ZWE1nYzJOeVpYZGxaQ0IzYVhSb0lITmxkRlJwYldWdmRYUWdZblYwSUc1dklFa3VSUzRnYldGa1pHNWxjM05jYmlBZ0lDQWdJQ0FnY21WMGRYSnVJR05oWTJobFpFTnNaV0Z5VkdsdFpXOTFkQ2h0WVhKclpYSXBPMXh1SUNBZ0lIMGdZMkYwWTJnZ0tHVXBlMXh1SUNBZ0lDQWdJQ0IwY25rZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnTHk4Z1YyaGxiaUIzWlNCaGNtVWdhVzRnU1M1RkxpQmlkWFFnZEdobElITmpjbWx3ZENCb1lYTWdZbVZsYmlCbGRtRnNaV1FnYzI4Z1NTNUZMaUJrYjJWemJpZDBJQ0IwY25WemRDQjBhR1VnWjJ4dlltRnNJRzlpYW1WamRDQjNhR1Z1SUdOaGJHeGxaQ0J1YjNKdFlXeHNlVnh1SUNBZ0lDQWdJQ0FnSUNBZ2NtVjBkWEp1SUdOaFkyaGxaRU5zWldGeVZHbHRaVzkxZEM1allXeHNLRzUxYkd3c0lHMWhjbXRsY2lrN1hHNGdJQ0FnSUNBZ0lIMGdZMkYwWTJnZ0tHVXBlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0x5OGdjMkZ0WlNCaGN5QmhZbTkyWlNCaWRYUWdkMmhsYmlCcGRDZHpJR0VnZG1WeWMybHZiaUJ2WmlCSkxrVXVJSFJvWVhRZ2JYVnpkQ0JvWVhabElIUm9aU0JuYkc5aVlXd2diMkpxWldOMElHWnZjaUFuZEdocGN5Y3NJR2h2Y0daMWJHeDVJRzkxY2lCamIyNTBaWGgwSUdOdmNuSmxZM1FnYjNSb1pYSjNhWE5sSUdsMElIZHBiR3dnZEdoeWIzY2dZU0JuYkc5aVlXd2daWEp5YjNJdVhHNGdJQ0FnSUNBZ0lDQWdJQ0F2THlCVGIyMWxJSFpsY25OcGIyNXpJRzltSUVrdVJTNGdhR0YyWlNCa2FXWm1aWEpsYm5RZ2NuVnNaWE1nWm05eUlHTnNaV0Z5VkdsdFpXOTFkQ0IyY3lCelpYUlVhVzFsYjNWMFhHNGdJQ0FnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdZMkZqYUdWa1EyeGxZWEpVYVcxbGIzVjBMbU5oYkd3b2RHaHBjeXdnYldGeWEyVnlLVHRjYmlBZ0lDQWdJQ0FnZlZ4dUlDQWdJSDFjYmx4dVhHNWNibjFjYm5aaGNpQnhkV1YxWlNBOUlGdGRPMXh1ZG1GeUlHUnlZV2x1YVc1bklEMGdabUZzYzJVN1hHNTJZWElnWTNWeWNtVnVkRkYxWlhWbE8xeHVkbUZ5SUhGMVpYVmxTVzVrWlhnZ1BTQXRNVHRjYmx4dVpuVnVZM1JwYjI0Z1kyeGxZVzVWY0U1bGVIUlVhV05yS0NrZ2UxeHVJQ0FnSUdsbUlDZ2haSEpoYVc1cGJtY2dmSHdnSVdOMWNuSmxiblJSZFdWMVpTa2dlMXh1SUNBZ0lDQWdJQ0J5WlhSMWNtNDdYRzRnSUNBZ2ZWeHVJQ0FnSUdSeVlXbHVhVzVuSUQwZ1ptRnNjMlU3WEc0Z0lDQWdhV1lnS0dOMWNuSmxiblJSZFdWMVpTNXNaVzVuZEdncElIdGNiaUFnSUNBZ0lDQWdjWFZsZFdVZ1BTQmpkWEp5Wlc1MFVYVmxkV1V1WTI5dVkyRjBLSEYxWlhWbEtUdGNiaUFnSUNCOUlHVnNjMlVnZTF4dUlDQWdJQ0FnSUNCeGRXVjFaVWx1WkdWNElEMGdMVEU3WEc0Z0lDQWdmVnh1SUNBZ0lHbG1JQ2h4ZFdWMVpTNXNaVzVuZEdncElIdGNiaUFnSUNBZ0lDQWdaSEpoYVc1UmRXVjFaU2dwTzF4dUlDQWdJSDFjYm4xY2JseHVablZ1WTNScGIyNGdaSEpoYVc1UmRXVjFaU2dwSUh0Y2JpQWdJQ0JwWmlBb1pISmhhVzVwYm1jcElIdGNiaUFnSUNBZ0lDQWdjbVYwZFhKdU8xeHVJQ0FnSUgxY2JpQWdJQ0IyWVhJZ2RHbHRaVzkxZENBOUlISjFibFJwYldWdmRYUW9ZMnhsWVc1VmNFNWxlSFJVYVdOcktUdGNiaUFnSUNCa2NtRnBibWx1WnlBOUlIUnlkV1U3WEc1Y2JpQWdJQ0IyWVhJZ2JHVnVJRDBnY1hWbGRXVXViR1Z1WjNSb08xeHVJQ0FnSUhkb2FXeGxLR3hsYmlrZ2UxeHVJQ0FnSUNBZ0lDQmpkWEp5Wlc1MFVYVmxkV1VnUFNCeGRXVjFaVHRjYmlBZ0lDQWdJQ0FnY1hWbGRXVWdQU0JiWFR0Y2JpQWdJQ0FnSUNBZ2QyaHBiR1VnS0NzcmNYVmxkV1ZKYm1SbGVDQThJR3hsYmlrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnYVdZZ0tHTjFjbkpsYm5SUmRXVjFaU2tnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdOMWNuSmxiblJSZFdWMVpWdHhkV1YxWlVsdVpHVjRYUzV5ZFc0b0tUdGNiaUFnSUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ0lDQnhkV1YxWlVsdVpHVjRJRDBnTFRFN1hHNGdJQ0FnSUNBZ0lHeGxiaUE5SUhGMVpYVmxMbXhsYm1kMGFEdGNiaUFnSUNCOVhHNGdJQ0FnWTNWeWNtVnVkRkYxWlhWbElEMGdiblZzYkR0Y2JpQWdJQ0JrY21GcGJtbHVaeUE5SUdaaGJITmxPMXh1SUNBZ0lISjFia05zWldGeVZHbHRaVzkxZENoMGFXMWxiM1YwS1R0Y2JuMWNibHh1Y0hKdlkyVnpjeTV1WlhoMFZHbGpheUE5SUdaMWJtTjBhVzl1SUNobWRXNHBJSHRjYmlBZ0lDQjJZWElnWVhKbmN5QTlJRzVsZHlCQmNuSmhlU2hoY21kMWJXVnVkSE11YkdWdVozUm9JQzBnTVNrN1hHNGdJQ0FnYVdZZ0tHRnlaM1Z0Wlc1MGN5NXNaVzVuZEdnZ1BpQXhLU0I3WEc0Z0lDQWdJQ0FnSUdadmNpQW9kbUZ5SUdrZ1BTQXhPeUJwSUR3Z1lYSm5kVzFsYm5SekxteGxibWQwYURzZ2FTc3JLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQmhjbWR6VzJrZ0xTQXhYU0E5SUdGeVozVnRaVzUwYzF0cFhUdGNiaUFnSUNBZ0lDQWdmVnh1SUNBZ0lIMWNiaUFnSUNCeGRXVjFaUzV3ZFhOb0tHNWxkeUJKZEdWdEtHWjFiaXdnWVhKbmN5a3BPMXh1SUNBZ0lHbG1JQ2h4ZFdWMVpTNXNaVzVuZEdnZ1BUMDlJREVnSmlZZ0lXUnlZV2x1YVc1bktTQjdYRzRnSUNBZ0lDQWdJSEoxYmxScGJXVnZkWFFvWkhKaGFXNVJkV1YxWlNrN1hHNGdJQ0FnZlZ4dWZUdGNibHh1THk4Z2RqZ2diR2xyWlhNZ2NISmxaR2xqZEdsaWJHVWdiMkpxWldOMGMxeHVablZ1WTNScGIyNGdTWFJsYlNobWRXNHNJR0Z5Y21GNUtTQjdYRzRnSUNBZ2RHaHBjeTVtZFc0Z1BTQm1kVzQ3WEc0Z0lDQWdkR2hwY3k1aGNuSmhlU0E5SUdGeWNtRjVPMXh1ZlZ4dVNYUmxiUzV3Y205MGIzUjVjR1V1Y25WdUlEMGdablZ1WTNScGIyNGdLQ2tnZTF4dUlDQWdJSFJvYVhNdVpuVnVMbUZ3Y0d4NUtHNTFiR3dzSUhSb2FYTXVZWEp5WVhrcE8xeHVmVHRjYm5CeWIyTmxjM011ZEdsMGJHVWdQU0FuWW5KdmQzTmxjaWM3WEc1d2NtOWpaWE56TG1KeWIzZHpaWElnUFNCMGNuVmxPMXh1Y0hKdlkyVnpjeTVsYm5ZZ1BTQjdmVHRjYm5CeWIyTmxjM011WVhKbmRpQTlJRnRkTzF4dWNISnZZMlZ6Y3k1MlpYSnphVzl1SUQwZ0p5YzdJQzh2SUdWdGNIUjVJSE4wY21sdVp5QjBieUJoZG05cFpDQnlaV2RsZUhBZ2FYTnpkV1Z6WEc1d2NtOWpaWE56TG5abGNuTnBiMjV6SUQwZ2UzMDdYRzVjYm1aMWJtTjBhVzl1SUc1dmIzQW9LU0I3ZlZ4dVhHNXdjbTlqWlhOekxtOXVJRDBnYm05dmNEdGNibkJ5YjJObGMzTXVZV1JrVEdsemRHVnVaWElnUFNCdWIyOXdPMXh1Y0hKdlkyVnpjeTV2Ym1ObElEMGdibTl2Y0R0Y2JuQnliMk5sYzNNdWIyWm1JRDBnYm05dmNEdGNibkJ5YjJObGMzTXVjbVZ0YjNabFRHbHpkR1Z1WlhJZ1BTQnViMjl3TzF4dWNISnZZMlZ6Y3k1eVpXMXZkbVZCYkd4TWFYTjBaVzVsY25NZ1BTQnViMjl3TzF4dWNISnZZMlZ6Y3k1bGJXbDBJRDBnYm05dmNEdGNibkJ5YjJObGMzTXVjSEpsY0dWdVpFeHBjM1JsYm1WeUlEMGdibTl2Y0R0Y2JuQnliMk5sYzNNdWNISmxjR1Z1WkU5dVkyVk1hWE4wWlc1bGNpQTlJRzV2YjNBN1hHNWNibkJ5YjJObGMzTXViR2x6ZEdWdVpYSnpJRDBnWm5WdVkzUnBiMjRnS0c1aGJXVXBJSHNnY21WMGRYSnVJRnRkSUgxY2JseHVjSEp2WTJWemN5NWlhVzVrYVc1bklEMGdablZ1WTNScGIyNGdLRzVoYldVcElIdGNiaUFnSUNCMGFISnZkeUJ1WlhjZ1JYSnliM0lvSjNCeWIyTmxjM011WW1sdVpHbHVaeUJwY3lCdWIzUWdjM1Z3Y0c5eWRHVmtKeWs3WEc1OU8xeHVYRzV3Y205alpYTnpMbU4zWkNBOUlHWjFibU4wYVc5dUlDZ3BJSHNnY21WMGRYSnVJQ2N2SnlCOU8xeHVjSEp2WTJWemN5NWphR1JwY2lBOUlHWjFibU4wYVc5dUlDaGthWElwSUh0Y2JpQWdJQ0IwYUhKdmR5QnVaWGNnUlhKeWIzSW9KM0J5YjJObGMzTXVZMmhrYVhJZ2FYTWdibTkwSUhOMWNIQnZjblJsWkNjcE8xeHVmVHRjYm5CeWIyTmxjM011ZFcxaGMyc2dQU0JtZFc1amRHbHZiaWdwSUhzZ2NtVjBkWEp1SURBN0lIMDdYRzRpTENJdktpcGNiaUFxSUVOdmNIbHlhV2RvZENBeU1ERXpMWEJ5WlhObGJuUXNJRVpoWTJWaWIyOXJMQ0JKYm1NdVhHNGdLaUJCYkd3Z2NtbG5hSFJ6SUhKbGMyVnlkbVZrTGx4dUlDcGNiaUFxSUZSb2FYTWdjMjkxY21ObElHTnZaR1VnYVhNZ2JHbGpaVzV6WldRZ2RXNWtaWElnZEdobElFSlRSQzF6ZEhsc1pTQnNhV05sYm5ObElHWnZkVzVrSUdsdUlIUm9aVnh1SUNvZ1RFbERSVTVUUlNCbWFXeGxJR2x1SUhSb1pTQnliMjkwSUdScGNtVmpkRzl5ZVNCdlppQjBhR2x6SUhOdmRYSmpaU0IwY21WbExpQkJiaUJoWkdScGRHbHZibUZzSUdkeVlXNTBYRzRnS2lCdlppQndZWFJsYm5RZ2NtbG5hSFJ6SUdOaGJpQmlaU0JtYjNWdVpDQnBiaUIwYUdVZ1VFRlVSVTVVVXlCbWFXeGxJR2x1SUhSb1pTQnpZVzFsSUdScGNtVmpkRzl5ZVM1Y2JpQXFMMXh1WEc0bmRYTmxJSE4wY21samRDYzdYRzVjYm1sbUlDaHdjbTlqWlhOekxtVnVkaTVPVDBSRlgwVk9WaUFoUFQwZ0ozQnliMlIxWTNScGIyNG5LU0I3WEc0Z0lIWmhjaUJwYm5aaGNtbGhiblFnUFNCeVpYRjFhWEpsS0NkbVltcHpMMnhwWWk5cGJuWmhjbWxoYm5RbktUdGNiaUFnZG1GeUlIZGhjbTVwYm1jZ1BTQnlaWEYxYVhKbEtDZG1ZbXB6TDJ4cFlpOTNZWEp1YVc1bkp5azdYRzRnSUhaaGNpQlNaV0ZqZEZCeWIzQlVlWEJsYzFObFkzSmxkQ0E5SUhKbGNYVnBjbVVvSnk0dmJHbGlMMUpsWVdOMFVISnZjRlI1Y0dWelUyVmpjbVYwSnlrN1hHNGdJSFpoY2lCc2IyZG5aV1JVZVhCbFJtRnBiSFZ5WlhNZ1BTQjdmVHRjYm4xY2JseHVMeW9xWEc0Z0tpQkJjM05sY25RZ2RHaGhkQ0IwYUdVZ2RtRnNkV1Z6SUcxaGRHTm9JSGRwZEdnZ2RHaGxJSFI1Y0dVZ2MzQmxZM011WEc0Z0tpQkZjbkp2Y2lCdFpYTnpZV2RsY3lCaGNtVWdiV1Z0YjNKcGVtVmtJR0Z1WkNCM2FXeHNJRzl1YkhrZ1ltVWdjMmh2ZDI0Z2IyNWpaUzVjYmlBcVhHNGdLaUJBY0dGeVlXMGdlMjlpYW1WamRIMGdkSGx3WlZOd1pXTnpJRTFoY0NCdlppQnVZVzFsSUhSdklHRWdVbVZoWTNSUWNtOXdWSGx3WlZ4dUlDb2dRSEJoY21GdElIdHZZbXBsWTNSOUlIWmhiSFZsY3lCU2RXNTBhVzFsSUhaaGJIVmxjeUIwYUdGMElHNWxaV1FnZEc4Z1ltVWdkSGx3WlMxamFHVmphMlZrWEc0Z0tpQkFjR0Z5WVcwZ2UzTjBjbWx1WjMwZ2JHOWpZWFJwYjI0Z1pTNW5MaUJjSW5CeWIzQmNJaXdnWENKamIyNTBaWGgwWENJc0lGd2lZMmhwYkdRZ1kyOXVkR1Y0ZEZ3aVhHNGdLaUJBY0dGeVlXMGdlM04wY21sdVozMGdZMjl0Y0c5dVpXNTBUbUZ0WlNCT1lXMWxJRzltSUhSb1pTQmpiMjF3YjI1bGJuUWdabTl5SUdWeWNtOXlJRzFsYzNOaFoyVnpMbHh1SUNvZ1FIQmhjbUZ0SUhzL1JuVnVZM1JwYjI1OUlHZGxkRk4wWVdOcklGSmxkSFZ5Ym5NZ2RHaGxJR052YlhCdmJtVnVkQ0J6ZEdGamF5NWNiaUFxSUVCd2NtbDJZWFJsWEc0Z0tpOWNibVoxYm1OMGFXOXVJR05vWldOclVISnZjRlI1Y0dWektIUjVjR1ZUY0dWamN5d2dkbUZzZFdWekxDQnNiMk5oZEdsdmJpd2dZMjl0Y0c5dVpXNTBUbUZ0WlN3Z1oyVjBVM1JoWTJzcElIdGNiaUFnYVdZZ0tIQnliMk5sYzNNdVpXNTJMazVQUkVWZlJVNVdJQ0U5UFNBbmNISnZaSFZqZEdsdmJpY3BJSHRjYmlBZ0lDQm1iM0lnS0haaGNpQjBlWEJsVTNCbFkwNWhiV1VnYVc0Z2RIbHdaVk53WldOektTQjdYRzRnSUNBZ0lDQnBaaUFvZEhsd1pWTndaV056TG1oaGMwOTNibEJ5YjNCbGNuUjVLSFI1Y0dWVGNHVmpUbUZ0WlNrcElIdGNiaUFnSUNBZ0lDQWdkbUZ5SUdWeWNtOXlPMXh1SUNBZ0lDQWdJQ0F2THlCUWNtOXdJSFI1Y0dVZ2RtRnNhV1JoZEdsdmJpQnRZWGtnZEdoeWIzY3VJRWx1SUdOaGMyVWdkR2hsZVNCa2J5d2dkMlVnWkc5dUozUWdkMkZ1ZENCMGIxeHVJQ0FnSUNBZ0lDQXZMeUJtWVdsc0lIUm9aU0J5Wlc1a1pYSWdjR2hoYzJVZ2QyaGxjbVVnYVhRZ1pHbGtiaWQwSUdaaGFXd2dZbVZtYjNKbExpQlRieUIzWlNCc2IyY2dhWFF1WEc0Z0lDQWdJQ0FnSUM4dklFRm1kR1Z5SUhSb1pYTmxJR2hoZG1VZ1ltVmxiaUJqYkdWaGJtVmtJSFZ3TENCM1pTZHNiQ0JzWlhRZ2RHaGxiU0IwYUhKdmR5NWNiaUFnSUNBZ0lDQWdkSEo1SUh0Y2JpQWdJQ0FnSUNBZ0lDQXZMeUJVYUdseklHbHpJR2x1ZEdWdWRHbHZibUZzYkhrZ1lXNGdhVzUyWVhKcFlXNTBJSFJvWVhRZ1oyVjBjeUJqWVhWbmFIUXVJRWwwSjNNZ2RHaGxJSE5oYldWY2JpQWdJQ0FnSUNBZ0lDQXZMeUJpWldoaGRtbHZjaUJoY3lCM2FYUm9iM1YwSUhSb2FYTWdjM1JoZEdWdFpXNTBJR1Y0WTJWd2RDQjNhWFJvSUdFZ1ltVjBkR1Z5SUcxbGMzTmhaMlV1WEc0Z0lDQWdJQ0FnSUNBZ2FXNTJZWEpwWVc1MEtIUjVjR1Z2WmlCMGVYQmxVM0JsWTNOYmRIbHdaVk53WldOT1lXMWxYU0E5UFQwZ0oyWjFibU4wYVc5dUp5d2dKeVZ6T2lBbGN5QjBlWEJsSUdBbGMyQWdhWE1nYVc1MllXeHBaRHNnYVhRZ2JYVnpkQ0JpWlNCaElHWjFibU4wYVc5dUxDQjFjM1ZoYkd4NUlHWnliMjBnSnlBcklDZFNaV0ZqZEM1UWNtOXdWSGx3WlhNdUp5d2dZMjl0Y0c5dVpXNTBUbUZ0WlNCOGZDQW5VbVZoWTNRZ1kyeGhjM01uTENCc2IyTmhkR2x2Yml3Z2RIbHdaVk53WldOT1lXMWxLVHRjYmlBZ0lDQWdJQ0FnSUNCbGNuSnZjaUE5SUhSNWNHVlRjR1ZqYzF0MGVYQmxVM0JsWTA1aGJXVmRLSFpoYkhWbGN5d2dkSGx3WlZOd1pXTk9ZVzFsTENCamIyMXdiMjVsYm5ST1lXMWxMQ0JzYjJOaGRHbHZiaXdnYm5Wc2JDd2dVbVZoWTNSUWNtOXdWSGx3WlhOVFpXTnlaWFFwTzF4dUlDQWdJQ0FnSUNCOUlHTmhkR05vSUNobGVDa2dlMXh1SUNBZ0lDQWdJQ0FnSUdWeWNtOXlJRDBnWlhnN1hHNGdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdkMkZ5Ym1sdVp5Z2haWEp5YjNJZ2ZId2daWEp5YjNJZ2FXNXpkR0Z1WTJWdlppQkZjbkp2Y2l3Z0p5VnpPaUIwZVhCbElITndaV05wWm1sallYUnBiMjRnYjJZZ0pYTWdZQ1Z6WUNCcGN5QnBiblpoYkdsa095QjBhR1VnZEhsd1pTQmphR1ZqYTJWeUlDY2dLeUFuWm5WdVkzUnBiMjRnYlhWemRDQnlaWFIxY200Z1lHNTFiR3hnSUc5eUlHRnVJR0JGY25KdmNtQWdZblYwSUhKbGRIVnlibVZrSUdFZ0pYTXVJQ2NnS3lBbldXOTFJRzFoZVNCb1lYWmxJR1p2Y21kdmRIUmxiaUIwYnlCd1lYTnpJR0Z1SUdGeVozVnRaVzUwSUhSdklIUm9aU0IwZVhCbElHTm9aV05yWlhJZ0p5QXJJQ2RqY21WaGRHOXlJQ2hoY25KaGVVOW1MQ0JwYm5OMFlXNWpaVTltTENCdlltcGxZM1JQWml3Z2IyNWxUMllzSUc5dVpVOW1WSGx3WlN3Z1lXNWtJQ2NnS3lBbmMyaGhjR1VnWVd4c0lISmxjWFZwY21VZ1lXNGdZWEpuZFcxbGJuUXBMaWNzSUdOdmJYQnZibVZ1ZEU1aGJXVWdmSHdnSjFKbFlXTjBJR05zWVhOekp5d2diRzlqWVhScGIyNHNJSFI1Y0dWVGNHVmpUbUZ0WlN3Z2RIbHdaVzltSUdWeWNtOXlLVHRjYmlBZ0lDQWdJQ0FnYVdZZ0tHVnljbTl5SUdsdWMzUmhibU5sYjJZZ1JYSnliM0lnSmlZZ0lTaGxjbkp2Y2k1dFpYTnpZV2RsSUdsdUlHeHZaMmRsWkZSNWNHVkdZV2xzZFhKbGN5a3BJSHRjYmlBZ0lDQWdJQ0FnSUNBdkx5QlBibXg1SUcxdmJtbDBiM0lnZEdocGN5Qm1ZV2xzZFhKbElHOXVZMlVnWW1WallYVnpaU0IwYUdWeVpTQjBaVzVrY3lCMGJ5QmlaU0JoSUd4dmRDQnZaaUIwYUdWY2JpQWdJQ0FnSUNBZ0lDQXZMeUJ6WVcxbElHVnljbTl5TGx4dUlDQWdJQ0FnSUNBZ0lHeHZaMmRsWkZSNWNHVkdZV2xzZFhKbGMxdGxjbkp2Y2k1dFpYTnpZV2RsWFNBOUlIUnlkV1U3WEc1Y2JpQWdJQ0FnSUNBZ0lDQjJZWElnYzNSaFkyc2dQU0JuWlhSVGRHRmpheUEvSUdkbGRGTjBZV05yS0NrZ09pQW5KenRjYmx4dUlDQWdJQ0FnSUNBZ0lIZGhjbTVwYm1jb1ptRnNjMlVzSUNkR1lXbHNaV1FnSlhNZ2RIbHdaVG9nSlhNbGN5Y3NJR3h2WTJGMGFXOXVMQ0JsY25KdmNpNXRaWE56WVdkbExDQnpkR0ZqYXlBaFBTQnVkV3hzSUQ4Z2MzUmhZMnNnT2lBbkp5azdYRzRnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJSDFjYmlBZ0lDQjlYRzRnSUgxY2JuMWNibHh1Ylc5a2RXeGxMbVY0Y0c5eWRITWdQU0JqYUdWamExQnliM0JVZVhCbGN6dGNiaUlzSWk4cUtseHVJQ29nUTI5d2VYSnBaMmgwSURJd01UTXRjSEpsYzJWdWRDd2dSbUZqWldKdmIyc3NJRWx1WXk1Y2JpQXFJRUZzYkNCeWFXZG9kSE1nY21WelpYSjJaV1F1WEc0Z0tseHVJQ29nVkdocGN5QnpiM1Z5WTJVZ1kyOWtaU0JwY3lCc2FXTmxibk5sWkNCMWJtUmxjaUIwYUdVZ1FsTkVMWE4wZVd4bElHeHBZMlZ1YzJVZ1ptOTFibVFnYVc0Z2RHaGxYRzRnS2lCTVNVTkZUbE5GSUdacGJHVWdhVzRnZEdobElISnZiM1FnWkdseVpXTjBiM0o1SUc5bUlIUm9hWE1nYzI5MWNtTmxJSFJ5WldVdUlFRnVJR0ZrWkdsMGFXOXVZV3dnWjNKaGJuUmNiaUFxSUc5bUlIQmhkR1Z1ZENCeWFXZG9kSE1nWTJGdUlHSmxJR1p2ZFc1a0lHbHVJSFJvWlNCUVFWUkZUbFJUSUdacGJHVWdhVzRnZEdobElITmhiV1VnWkdseVpXTjBiM0o1TGx4dUlDb3ZYRzVjYmlkMWMyVWdjM1J5YVdOMEp6dGNibHh1THk4Z1VtVmhZM1FnTVRVdU5TQnlaV1psY21WdVkyVnpJSFJvYVhNZ2JXOWtkV3hsTENCaGJtUWdZWE56ZFcxbGN5QlFjbTl3Vkhsd1pYTWdZWEpsSUhOMGFXeHNJR05oYkd4aFlteGxJR2x1SUhCeWIyUjFZM1JwYjI0dVhHNHZMeUJVYUdWeVpXWnZjbVVnZDJVZ2NtVXRaWGh3YjNKMElHUmxkbVZzYjNCdFpXNTBMVzl1YkhrZ2RtVnljMmx2YmlCM2FYUm9JR0ZzYkNCMGFHVWdVSEp2Y0ZSNWNHVnpJR05vWldOcmN5Qm9aWEpsTGx4dUx5OGdTRzkzWlhabGNpQnBaaUJ2Ym1VZ2FYTWdiV2xuY21GMGFXNW5JSFJ2SUhSb1pTQmdjSEp2Y0MxMGVYQmxjMkFnYm5CdElHeHBZbkpoY25rc0lIUm9aWGtnZDJsc2JDQm5ieUIwYUhKdmRXZG9JSFJvWlZ4dUx5OGdZR2x1WkdWNExtcHpZQ0JsYm5SeWVTQndiMmx1ZEN3Z1lXNWtJR2wwSUhkcGJHd2dZbkpoYm1Ob0lHUmxjR1Z1WkdsdVp5QnZiaUIwYUdVZ1pXNTJhWEp2Ym0xbGJuUXVYRzUyWVhJZ1ptRmpkRzl5ZVNBOUlISmxjWFZwY21Vb0p5NHZabUZqZEc5eWVWZHBkR2hVZVhCbFEyaGxZMnRsY25NbktUdGNibTF2WkhWc1pTNWxlSEJ2Y25SeklEMGdablZ1WTNScGIyNG9hWE5XWVd4cFpFVnNaVzFsYm5RcElIdGNiaUFnTHk4Z1NYUWdhWE1nYzNScGJHd2dZV3hzYjNkbFpDQnBiaUF4TlM0MUxseHVJQ0IyWVhJZ2RHaHliM2RQYmtScGNtVmpkRUZqWTJWemN5QTlJR1poYkhObE8xeHVJQ0J5WlhSMWNtNGdabUZqZEc5eWVTaHBjMVpoYkdsa1JXeGxiV1Z1ZEN3Z2RHaHliM2RQYmtScGNtVmpkRUZqWTJWemN5azdYRzU5TzF4dUlpd2lMeW9xWEc0Z0tpQkRiM0I1Y21sbmFIUWdNakF4TXkxd2NtVnpaVzUwTENCR1lXTmxZbTl2YXl3Z1NXNWpMbHh1SUNvZ1FXeHNJSEpwWjJoMGN5QnlaWE5sY25abFpDNWNiaUFxWEc0Z0tpQlVhR2x6SUhOdmRYSmpaU0JqYjJSbElHbHpJR3hwWTJWdWMyVmtJSFZ1WkdWeUlIUm9aU0JDVTBRdGMzUjViR1VnYkdsalpXNXpaU0JtYjNWdVpDQnBiaUIwYUdWY2JpQXFJRXhKUTBWT1UwVWdabWxzWlNCcGJpQjBhR1VnY205dmRDQmthWEpsWTNSdmNua2diMllnZEdocGN5QnpiM1Z5WTJVZ2RISmxaUzRnUVc0Z1lXUmthWFJwYjI1aGJDQm5jbUZ1ZEZ4dUlDb2diMllnY0dGMFpXNTBJSEpwWjJoMGN5QmpZVzRnWW1VZ1ptOTFibVFnYVc0Z2RHaGxJRkJCVkVWT1ZGTWdabWxzWlNCcGJpQjBhR1VnYzJGdFpTQmthWEpsWTNSdmNua3VYRzRnS2k5Y2JseHVKM1Z6WlNCemRISnBZM1FuTzF4dVhHNTJZWElnWlcxd2RIbEdkVzVqZEdsdmJpQTlJSEpsY1hWcGNtVW9KMlppYW5NdmJHbGlMMlZ0Y0hSNVJuVnVZM1JwYjI0bktUdGNiblpoY2lCcGJuWmhjbWxoYm5RZ1BTQnlaWEYxYVhKbEtDZG1ZbXB6TDJ4cFlpOXBiblpoY21saGJuUW5LVHRjYm5aaGNpQjNZWEp1YVc1bklEMGdjbVZ4ZFdseVpTZ25abUpxY3k5c2FXSXZkMkZ5Ym1sdVp5Y3BPMXh1WEc1MllYSWdVbVZoWTNSUWNtOXdWSGx3WlhOVFpXTnlaWFFnUFNCeVpYRjFhWEpsS0NjdUwyeHBZaTlTWldGamRGQnliM0JVZVhCbGMxTmxZM0psZENjcE8xeHVkbUZ5SUdOb1pXTnJVSEp2Y0ZSNWNHVnpJRDBnY21WeGRXbHlaU2duTGk5amFHVmphMUJ5YjNCVWVYQmxjeWNwTzF4dVhHNXRiMlIxYkdVdVpYaHdiM0owY3lBOUlHWjFibU4wYVc5dUtHbHpWbUZzYVdSRmJHVnRaVzUwTENCMGFISnZkMDl1UkdseVpXTjBRV05qWlhOektTQjdYRzRnSUM4cUlHZHNiMkpoYkNCVGVXMWliMndnS2k5Y2JpQWdkbUZ5SUVsVVJWSkJWRTlTWDFOWlRVSlBUQ0E5SUhSNWNHVnZaaUJUZVcxaWIyd2dQVDA5SUNkbWRXNWpkR2x2YmljZ0ppWWdVM2x0WW05c0xtbDBaWEpoZEc5eU8xeHVJQ0IyWVhJZ1JrRlZXRjlKVkVWU1FWUlBVbDlUV1UxQ1Qwd2dQU0FuUUVCcGRHVnlZWFJ2Y2ljN0lDOHZJRUpsWm05eVpTQlRlVzFpYjJ3Z2MzQmxZeTVjYmx4dUlDQXZLaXBjYmlBZ0lDb2dVbVYwZFhKdWN5QjBhR1VnYVhSbGNtRjBiM0lnYldWMGFHOWtJR1oxYm1OMGFXOXVJR052Ym5SaGFXNWxaQ0J2YmlCMGFHVWdhWFJsY21GaWJHVWdiMkpxWldOMExseHVJQ0FnS2x4dUlDQWdLaUJDWlNCemRYSmxJSFJ2SUdsdWRtOXJaU0IwYUdVZ1puVnVZM1JwYjI0Z2QybDBhQ0IwYUdVZ2FYUmxjbUZpYkdVZ1lYTWdZMjl1ZEdWNGREcGNiaUFnSUNwY2JpQWdJQ29nSUNBZ0lIWmhjaUJwZEdWeVlYUnZja1p1SUQwZ1oyVjBTWFJsY21GMGIzSkdiaWh0ZVVsMFpYSmhZbXhsS1R0Y2JpQWdJQ29nSUNBZ0lHbG1JQ2hwZEdWeVlYUnZja1p1S1NCN1hHNGdJQ0FxSUNBZ0lDQWdJSFpoY2lCcGRHVnlZWFJ2Y2lBOUlHbDBaWEpoZEc5eVJtNHVZMkZzYkNodGVVbDBaWEpoWW14bEtUdGNiaUFnSUNvZ0lDQWdJQ0FnTGk0dVhHNGdJQ0FxSUNBZ0lDQjlYRzRnSUNBcVhHNGdJQ0FxSUVCd1lYSmhiU0I3UDI5aWFtVmpkSDBnYldGNVltVkpkR1Z5WVdKc1pWeHVJQ0FnS2lCQWNtVjBkWEp1SUhzL1puVnVZM1JwYjI1OVhHNGdJQ0FxTDF4dUlDQm1kVzVqZEdsdmJpQm5aWFJKZEdWeVlYUnZja1p1S0cxaGVXSmxTWFJsY21GaWJHVXBJSHRjYmlBZ0lDQjJZWElnYVhSbGNtRjBiM0pHYmlBOUlHMWhlV0psU1hSbGNtRmliR1VnSmlZZ0tFbFVSVkpCVkU5U1gxTlpUVUpQVENBbUppQnRZWGxpWlVsMFpYSmhZbXhsVzBsVVJWSkJWRTlTWDFOWlRVSlBURjBnZkh3Z2JXRjVZbVZKZEdWeVlXSnNaVnRHUVZWWVgwbFVSVkpCVkU5U1gxTlpUVUpQVEYwcE8xeHVJQ0FnSUdsbUlDaDBlWEJsYjJZZ2FYUmxjbUYwYjNKR2JpQTlQVDBnSjJaMWJtTjBhVzl1SnlrZ2UxeHVJQ0FnSUNBZ2NtVjBkWEp1SUdsMFpYSmhkRzl5Um00N1hHNGdJQ0FnZlZ4dUlDQjlYRzVjYmlBZ0x5b3FYRzRnSUNBcUlFTnZiR3hsWTNScGIyNGdiMllnYldWMGFHOWtjeUIwYUdGMElHRnNiRzkzSUdSbFkyeGhjbUYwYVc5dUlHRnVaQ0IyWVd4cFpHRjBhVzl1SUc5bUlIQnliM0J6SUhSb1lYUWdZWEpsWEc0Z0lDQXFJSE4xY0hCc2FXVmtJSFJ2SUZKbFlXTjBJR052YlhCdmJtVnVkSE11SUVWNFlXMXdiR1VnZFhOaFoyVTZYRzRnSUNBcVhHNGdJQ0FxSUNBZ2RtRnlJRkJ5YjNCeklEMGdjbVZ4ZFdseVpTZ25VbVZoWTNSUWNtOXdWSGx3WlhNbktUdGNiaUFnSUNvZ0lDQjJZWElnVFhsQmNuUnBZMnhsSUQwZ1VtVmhZM1F1WTNKbFlYUmxRMnhoYzNNb2UxeHVJQ0FnS2lBZ0lDQWdjSEp2Y0ZSNWNHVnpPaUI3WEc0Z0lDQXFJQ0FnSUNBZ0lDOHZJRUZ1SUc5d2RHbHZibUZzSUhOMGNtbHVaeUJ3Y205d0lHNWhiV1ZrSUZ3aVpHVnpZM0pwY0hScGIyNWNJaTVjYmlBZ0lDb2dJQ0FnSUNBZ1pHVnpZM0pwY0hScGIyNDZJRkJ5YjNCekxuTjBjbWx1Wnl4Y2JpQWdJQ3BjYmlBZ0lDb2dJQ0FnSUNBZ0x5OGdRU0J5WlhGMWFYSmxaQ0JsYm5WdElIQnliM0FnYm1GdFpXUWdYQ0pqWVhSbFoyOXllVndpTGx4dUlDQWdLaUFnSUNBZ0lDQmpZWFJsWjI5eWVUb2dVSEp2Y0hNdWIyNWxUMllvV3lkT1pYZHpKeXduVUdodmRHOXpKMTBwTG1selVtVnhkV2x5WldRc1hHNGdJQ0FxWEc0Z0lDQXFJQ0FnSUNBZ0lDOHZJRUVnY0hKdmNDQnVZVzFsWkNCY0ltUnBZV3h2WjF3aUlIUm9ZWFFnY21WeGRXbHlaWE1nWVc0Z2FXNXpkR0Z1WTJVZ2IyWWdSR2xoYkc5bkxseHVJQ0FnS2lBZ0lDQWdJQ0JrYVdGc2IyYzZJRkJ5YjNCekxtbHVjM1JoYm1ObFQyWW9SR2xoYkc5bktTNXBjMUpsY1hWcGNtVmtYRzRnSUNBcUlDQWdJQ0I5TEZ4dUlDQWdLaUFnSUNBZ2NtVnVaR1Z5T2lCbWRXNWpkR2x2YmlncElIc2dMaTR1SUgxY2JpQWdJQ29nSUNCOUtUdGNiaUFnSUNwY2JpQWdJQ29nUVNCdGIzSmxJR1p2Y20xaGJDQnpjR1ZqYVdacFkyRjBhVzl1SUc5bUlHaHZkeUIwYUdWelpTQnRaWFJvYjJSeklHRnlaU0IxYzJWa09seHVJQ0FnS2x4dUlDQWdLaUFnSUhSNWNHVWdPajBnWVhKeVlYbDhZbTl2Ykh4bWRXNWpmRzlpYW1WamRIeHVkVzFpWlhKOGMzUnlhVzVuZkc5dVpVOW1LRnN1TGk1ZEtYeHBibk4wWVc1alpVOW1LQzR1TGlsY2JpQWdJQ29nSUNCa1pXTnNJRG85SUZKbFlXTjBVSEp2Y0ZSNWNHVnpMbnQwZVhCbGZTZ3VhWE5TWlhGMWFYSmxaQ2svWEc0Z0lDQXFYRzRnSUNBcUlFVmhZMmdnWVc1a0lHVjJaWEo1SUdSbFkyeGhjbUYwYVc5dUlIQnliMlIxWTJWeklHRWdablZ1WTNScGIyNGdkMmwwYUNCMGFHVWdjMkZ0WlNCemFXZHVZWFIxY21VdUlGUm9hWE5jYmlBZ0lDb2dZV3hzYjNkeklIUm9aU0JqY21WaGRHbHZiaUJ2WmlCamRYTjBiMjBnZG1Gc2FXUmhkR2x2YmlCbWRXNWpkR2x2Ym5NdUlFWnZjaUJsZUdGdGNHeGxPbHh1SUNBZ0tseHVJQ0FnS2lBZ2RtRnlJRTE1VEdsdWF5QTlJRkpsWVdOMExtTnlaV0YwWlVOc1lYTnpLSHRjYmlBZ0lDb2dJQ0FnY0hKdmNGUjVjR1Z6T2lCN1hHNGdJQ0FxSUNBZ0lDQWdMeThnUVc0Z2IzQjBhVzl1WVd3Z2MzUnlhVzVuSUc5eUlGVlNTU0J3Y205d0lHNWhiV1ZrSUZ3aWFISmxabHdpTGx4dUlDQWdLaUFnSUNBZ0lHaHlaV1k2SUdaMWJtTjBhVzl1S0hCeWIzQnpMQ0J3Y205d1RtRnRaU3dnWTI5dGNHOXVaVzUwVG1GdFpTa2dlMXh1SUNBZ0tpQWdJQ0FnSUNBZ2RtRnlJSEJ5YjNCV1lXeDFaU0E5SUhCeWIzQnpXM0J5YjNCT1lXMWxYVHRjYmlBZ0lDb2dJQ0FnSUNBZ0lHbG1JQ2h3Y205d1ZtRnNkV1VnSVQwZ2JuVnNiQ0FtSmlCMGVYQmxiMllnY0hKdmNGWmhiSFZsSUNFOVBTQW5jM1J5YVc1bkp5QW1KbHh1SUNBZ0tpQWdJQ0FnSUNBZ0lDQWdJQ0VvY0hKdmNGWmhiSFZsSUdsdWMzUmhibU5sYjJZZ1ZWSkpLU2tnZTF4dUlDQWdLaUFnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdibVYzSUVWeWNtOXlLRnh1SUNBZ0tpQWdJQ0FnSUNBZ0lDQWdJQ2RGZUhCbFkzUmxaQ0JoSUhOMGNtbHVaeUJ2Y2lCaGJpQlZVa2tnWm05eUlDY2dLeUJ3Y205d1RtRnRaU0FySUNjZ2FXNGdKeUFyWEc0Z0lDQXFJQ0FnSUNBZ0lDQWdJQ0FnWTI5dGNHOXVaVzUwVG1GdFpWeHVJQ0FnS2lBZ0lDQWdJQ0FnSUNBcE8xeHVJQ0FnS2lBZ0lDQWdJQ0FnZlZ4dUlDQWdLaUFnSUNBZ0lIMWNiaUFnSUNvZ0lDQWdmU3hjYmlBZ0lDb2dJQ0FnY21WdVpHVnlPaUJtZFc1amRHbHZiaWdwSUhzdUxpNTlYRzRnSUNBcUlDQjlLVHRjYmlBZ0lDcGNiaUFnSUNvZ1FHbHVkR1Z5Ym1Gc1hHNGdJQ0FxTDF4dVhHNGdJSFpoY2lCQlRrOU9XVTFQVlZNZ1BTQW5QRHhoYm05dWVXMXZkWE0rUGljN1hHNWNiaUFnTHk4Z1NXMXdiM0owWVc1MElWeHVJQ0F2THlCTFpXVndJSFJvYVhNZ2JHbHpkQ0JwYmlCemVXNWpJSGRwZEdnZ2NISnZaSFZqZEdsdmJpQjJaWEp6YVc5dUlHbHVJR0F1TDJaaFkzUnZjbmxYYVhSb1ZHaHliM2RwYm1kVGFHbHRjeTVxYzJBdVhHNGdJSFpoY2lCU1pXRmpkRkJ5YjNCVWVYQmxjeUE5SUh0Y2JpQWdJQ0JoY25KaGVUb2dZM0psWVhSbFVISnBiV2wwYVhabFZIbHdaVU5vWldOclpYSW9KMkZ5Y21GNUp5a3NYRzRnSUNBZ1ltOXZiRG9nWTNKbFlYUmxVSEpwYldsMGFYWmxWSGx3WlVOb1pXTnJaWElvSjJKdmIyeGxZVzRuS1N4Y2JpQWdJQ0JtZFc1ak9pQmpjbVZoZEdWUWNtbHRhWFJwZG1WVWVYQmxRMmhsWTJ0bGNpZ25ablZ1WTNScGIyNG5LU3hjYmlBZ0lDQnVkVzFpWlhJNklHTnlaV0YwWlZCeWFXMXBkR2wyWlZSNWNHVkRhR1ZqYTJWeUtDZHVkVzFpWlhJbktTeGNiaUFnSUNCdlltcGxZM1E2SUdOeVpXRjBaVkJ5YVcxcGRHbDJaVlI1Y0dWRGFHVmphMlZ5S0NkdlltcGxZM1FuS1N4Y2JpQWdJQ0J6ZEhKcGJtYzZJR055WldGMFpWQnlhVzFwZEdsMlpWUjVjR1ZEYUdWamEyVnlLQ2R6ZEhKcGJtY25LU3hjYmlBZ0lDQnplVzFpYjJ3NklHTnlaV0YwWlZCeWFXMXBkR2wyWlZSNWNHVkRhR1ZqYTJWeUtDZHplVzFpYjJ3bktTeGNibHh1SUNBZ0lHRnVlVG9nWTNKbFlYUmxRVzU1Vkhsd1pVTm9aV05yWlhJb0tTeGNiaUFnSUNCaGNuSmhlVTltT2lCamNtVmhkR1ZCY25KaGVVOW1WSGx3WlVOb1pXTnJaWElzWEc0Z0lDQWdaV3hsYldWdWREb2dZM0psWVhSbFJXeGxiV1Z1ZEZSNWNHVkRhR1ZqYTJWeUtDa3NYRzRnSUNBZ2FXNXpkR0Z1WTJWUFpqb2dZM0psWVhSbFNXNXpkR0Z1WTJWVWVYQmxRMmhsWTJ0bGNpeGNiaUFnSUNCdWIyUmxPaUJqY21WaGRHVk9iMlJsUTJobFkydGxjaWdwTEZ4dUlDQWdJRzlpYW1WamRFOW1PaUJqY21WaGRHVlBZbXBsWTNSUFpsUjVjR1ZEYUdWamEyVnlMRnh1SUNBZ0lHOXVaVTltT2lCamNtVmhkR1ZGYm5WdFZIbHdaVU5vWldOclpYSXNYRzRnSUNBZ2IyNWxUMlpVZVhCbE9pQmpjbVZoZEdWVmJtbHZibFI1Y0dWRGFHVmphMlZ5TEZ4dUlDQWdJSE5vWVhCbE9pQmpjbVZoZEdWVGFHRndaVlI1Y0dWRGFHVmphMlZ5WEc0Z0lIMDdYRzVjYmlBZ0x5b3FYRzRnSUNBcUlHbHViR2x1WldRZ1QySnFaV04wTG1seklIQnZiSGxtYVd4c0lIUnZJR0YyYjJsa0lISmxjWFZwY21sdVp5QmpiMjV6ZFcxbGNuTWdjMmhwY0NCMGFHVnBjaUJ2ZDI1Y2JpQWdJQ29nYUhSMGNITTZMeTlrWlhabGJHOXdaWEl1Ylc5NmFXeHNZUzV2Y21jdlpXNHRWVk12Wkc5amN5OVhaV0l2U21GMllWTmpjbWx3ZEM5U1pXWmxjbVZ1WTJVdlIyeHZZbUZzWDA5aWFtVmpkSE12VDJKcVpXTjBMMmx6WEc0Z0lDQXFMMXh1SUNBdkttVnpiR2x1ZEMxa2FYTmhZbXhsSUc1dkxYTmxiR1l0WTI5dGNHRnlaU292WEc0Z0lHWjFibU4wYVc5dUlHbHpLSGdzSUhrcElIdGNiaUFnSUNBdkx5QlRZVzFsVm1Gc2RXVWdZV3huYjNKcGRHaHRYRzRnSUNBZ2FXWWdLSGdnUFQwOUlIa3BJSHRjYmlBZ0lDQWdJQzh2SUZOMFpYQnpJREV0TlN3Z055MHhNRnh1SUNBZ0lDQWdMeThnVTNSbGNITWdOaTVpTFRZdVpUb2dLekFnSVQwZ0xUQmNiaUFnSUNBZ0lISmxkSFZ5YmlCNElDRTlQU0F3SUh4OElERWdMeUI0SUQwOVBTQXhJQzhnZVR0Y2JpQWdJQ0I5SUdWc2MyVWdlMXh1SUNBZ0lDQWdMeThnVTNSbGNDQTJMbUU2SUU1aFRpQTlQU0JPWVU1Y2JpQWdJQ0FnSUhKbGRIVnliaUI0SUNFOVBTQjRJQ1ltSUhrZ0lUMDlJSGs3WEc0Z0lDQWdmVnh1SUNCOVhHNGdJQzhxWlhOc2FXNTBMV1Z1WVdKc1pTQnVieTF6Wld4bUxXTnZiWEJoY21VcUwxeHVYRzRnSUM4cUtseHVJQ0FnS2lCWFpTQjFjMlVnWVc0Z1JYSnliM0l0YkdsclpTQnZZbXBsWTNRZ1ptOXlJR0poWTJ0M1lYSmtJR052YlhCaGRHbGlhV3hwZEhrZ1lYTWdjR1Z2Y0d4bElHMWhlU0JqWVd4c1hHNGdJQ0FxSUZCeWIzQlVlWEJsY3lCa2FYSmxZM1JzZVNCaGJtUWdhVzV6Y0dWamRDQjBhR1ZwY2lCdmRYUndkWFF1SUVodmQyVjJaWElzSUhkbElHUnZiaWQwSUhWelpTQnlaV0ZzWEc0Z0lDQXFJRVZ5Y205eWN5Qmhibmx0YjNKbExpQlhaU0JrYjI0bmRDQnBibk53WldOMElIUm9aV2x5SUhOMFlXTnJJR0Z1ZVhkaGVTd2dZVzVrSUdOeVpXRjBhVzVuSUhSb1pXMWNiaUFnSUNvZ2FYTWdjSEp2YUdsaWFYUnBkbVZzZVNCbGVIQmxibk5wZG1VZ2FXWWdkR2hsZVNCaGNtVWdZM0psWVhSbFpDQjBiMjhnYjJaMFpXNHNJSE4xWTJnZ1lYTWdkMmhoZEZ4dUlDQWdLaUJvWVhCd1pXNXpJR2x1SUc5dVpVOW1WSGx3WlNncElHWnZjaUJoYm5rZ2RIbHdaU0JpWldadmNtVWdkR2hsSUc5dVpTQjBhR0YwSUcxaGRHTm9aV1F1WEc0Z0lDQXFMMXh1SUNCbWRXNWpkR2x2YmlCUWNtOXdWSGx3WlVWeWNtOXlLRzFsYzNOaFoyVXBJSHRjYmlBZ0lDQjBhR2x6TG0xbGMzTmhaMlVnUFNCdFpYTnpZV2RsTzF4dUlDQWdJSFJvYVhNdWMzUmhZMnNnUFNBbkp6dGNiaUFnZlZ4dUlDQXZMeUJOWVd0bElHQnBibk4wWVc1alpXOW1JRVZ5Y205eVlDQnpkR2xzYkNCM2IzSnJJR1p2Y2lCeVpYUjFjbTVsWkNCbGNuSnZjbk11WEc0Z0lGQnliM0JVZVhCbFJYSnliM0l1Y0hKdmRHOTBlWEJsSUQwZ1JYSnliM0l1Y0hKdmRHOTBlWEJsTzF4dVhHNGdJR1oxYm1OMGFXOXVJR055WldGMFpVTm9ZV2x1WVdKc1pWUjVjR1ZEYUdWamEyVnlLSFpoYkdsa1lYUmxLU0I3WEc0Z0lDQWdhV1lnS0hCeWIyTmxjM011Wlc1MkxrNVBSRVZmUlU1V0lDRTlQU0FuY0hKdlpIVmpkR2x2YmljcElIdGNiaUFnSUNBZ0lIWmhjaUJ0WVc1MVlXeFFjbTl3Vkhsd1pVTmhiR3hEWVdOb1pTQTlJSHQ5TzF4dUlDQWdJQ0FnZG1GeUlHMWhiblZoYkZCeWIzQlVlWEJsVjJGeWJtbHVaME52ZFc1MElEMGdNRHRjYmlBZ0lDQjlYRzRnSUNBZ1puVnVZM1JwYjI0Z1kyaGxZMnRVZVhCbEtHbHpVbVZ4ZFdseVpXUXNJSEJ5YjNCekxDQndjbTl3VG1GdFpTd2dZMjl0Y0c5dVpXNTBUbUZ0WlN3Z2JHOWpZWFJwYjI0c0lIQnliM0JHZFd4c1RtRnRaU3dnYzJWamNtVjBLU0I3WEc0Z0lDQWdJQ0JqYjIxd2IyNWxiblJPWVcxbElEMGdZMjl0Y0c5dVpXNTBUbUZ0WlNCOGZDQkJUazlPV1UxUFZWTTdYRzRnSUNBZ0lDQndjbTl3Um5Wc2JFNWhiV1VnUFNCd2NtOXdSblZzYkU1aGJXVWdmSHdnY0hKdmNFNWhiV1U3WEc1Y2JpQWdJQ0FnSUdsbUlDaHpaV055WlhRZ0lUMDlJRkpsWVdOMFVISnZjRlI1Y0dWelUyVmpjbVYwS1NCN1hHNGdJQ0FnSUNBZ0lHbG1JQ2gwYUhKdmQwOXVSR2x5WldOMFFXTmpaWE56S1NCN1hHNGdJQ0FnSUNBZ0lDQWdMeThnVG1WM0lHSmxhR0YyYVc5eUlHOXViSGtnWm05eUlIVnpaWEp6SUc5bUlHQndjbTl3TFhSNWNHVnpZQ0J3WVdOcllXZGxYRzRnSUNBZ0lDQWdJQ0FnYVc1MllYSnBZVzUwS0Z4dUlDQWdJQ0FnSUNBZ0lDQWdabUZzYzJVc1hHNGdJQ0FnSUNBZ0lDQWdJQ0FuUTJGc2JHbHVaeUJRY205d1ZIbHdaWE1nZG1Gc2FXUmhkRzl5Y3lCa2FYSmxZM1JzZVNCcGN5QnViM1FnYzNWd2NHOXlkR1ZrSUdKNUlIUm9aU0JnY0hKdmNDMTBlWEJsYzJBZ2NHRmphMkZuWlM0Z0p5QXJYRzRnSUNBZ0lDQWdJQ0FnSUNBblZYTmxJR0JRY205d1ZIbHdaWE11WTJobFkydFFjbTl3Vkhsd1pYTW9LV0FnZEc4Z1kyRnNiQ0IwYUdWdExpQW5JQ3RjYmlBZ0lDQWdJQ0FnSUNBZ0lDZFNaV0ZrSUcxdmNtVWdZWFFnYUhSMGNEb3ZMMlppTG0xbEwzVnpaUzFqYUdWamF5MXdjbTl3TFhSNWNHVnpKMXh1SUNBZ0lDQWdJQ0FnSUNrN1hHNGdJQ0FnSUNBZ0lIMGdaV3h6WlNCcFppQW9jSEp2WTJWemN5NWxibll1VGs5RVJWOUZUbFlnSVQwOUlDZHdjbTlrZFdOMGFXOXVKeUFtSmlCMGVYQmxiMllnWTI5dWMyOXNaU0FoUFQwZ0ozVnVaR1ZtYVc1bFpDY3BJSHRjYmlBZ0lDQWdJQ0FnSUNBdkx5QlBiR1FnWW1Wb1lYWnBiM0lnWm05eUlIQmxiM0JzWlNCMWMybHVaeUJTWldGamRDNVFjbTl3Vkhsd1pYTmNiaUFnSUNBZ0lDQWdJQ0IyWVhJZ1kyRmphR1ZMWlhrZ1BTQmpiMjF3YjI1bGJuUk9ZVzFsSUNzZ0p6b25JQ3NnY0hKdmNFNWhiV1U3WEc0Z0lDQWdJQ0FnSUNBZ2FXWWdLRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lXMWhiblZoYkZCeWIzQlVlWEJsUTJGc2JFTmhZMmhsVzJOaFkyaGxTMlY1WFNBbUpseHVJQ0FnSUNBZ0lDQWdJQ0FnTHk4Z1FYWnZhV1FnYzNCaGJXMXBibWNnZEdobElHTnZibk52YkdVZ1ltVmpZWFZ6WlNCMGFHVjVJR0Z5WlNCdlpuUmxiaUJ1YjNRZ1lXTjBhVzl1WVdKc1pTQmxlR05sY0hRZ1ptOXlJR3hwWWlCaGRYUm9iM0p6WEc0Z0lDQWdJQ0FnSUNBZ0lDQnRZVzUxWVd4UWNtOXdWSGx3WlZkaGNtNXBibWREYjNWdWRDQThJRE5jYmlBZ0lDQWdJQ0FnSUNBcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUhkaGNtNXBibWNvWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJR1poYkhObExGeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBbldXOTFJR0Z5WlNCdFlXNTFZV3hzZVNCallXeHNhVzVuSUdFZ1VtVmhZM1F1VUhKdmNGUjVjR1Z6SUhaaGJHbGtZWFJwYjI0Z0p5QXJYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDZG1kVzVqZEdsdmJpQm1iM0lnZEdobElHQWxjMkFnY0hKdmNDQnZiaUJnSlhOZ0xpQlVhR2x6SUdseklHUmxjSEpsWTJGMFpXUWdKeUFyWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ2RoYm1RZ2QybHNiQ0IwYUhKdmR5QnBiaUIwYUdVZ2MzUmhibVJoYkc5dVpTQmdjSEp2Y0MxMGVYQmxjMkFnY0dGamEyRm5aUzRnSnlBclhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNkWmIzVWdiV0Y1SUdKbElITmxaV2x1WnlCMGFHbHpJSGRoY201cGJtY2daSFZsSUhSdklHRWdkR2hwY21RdGNHRnlkSGtnVUhKdmNGUjVjR1Z6SUNjZ0sxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBbmJHbGljbUZ5ZVM0Z1UyVmxJR2gwZEhCek9pOHZabUl1YldVdmNtVmhZM1F0ZDJGeWJtbHVaeTFrYjI1MExXTmhiR3d0Y0hKdmNIUjVjR1Z6SUNjZ0t5QW5abTl5SUdSbGRHRnBiSE11Snl4Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnY0hKdmNFWjFiR3hPWVcxbExGeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNCamIyMXdiMjVsYm5ST1lXMWxYRzRnSUNBZ0lDQWdJQ0FnSUNBcE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnYldGdWRXRnNVSEp2Y0ZSNWNHVkRZV3hzUTJGamFHVmJZMkZqYUdWTFpYbGRJRDBnZEhKMVpUdGNiaUFnSUNBZ0lDQWdJQ0FnSUcxaGJuVmhiRkJ5YjNCVWVYQmxWMkZ5Ym1sdVowTnZkVzUwS3lzN1hHNGdJQ0FnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdJQ0JwWmlBb2NISnZjSE5iY0hKdmNFNWhiV1ZkSUQwOUlHNTFiR3dwSUh0Y2JpQWdJQ0FnSUNBZ2FXWWdLR2x6VW1WeGRXbHlaV1FwSUh0Y2JpQWdJQ0FnSUNBZ0lDQnBaaUFvY0hKdmNITmJjSEp2Y0U1aGJXVmRJRDA5UFNCdWRXeHNLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z2JtVjNJRkJ5YjNCVWVYQmxSWEp5YjNJb0oxUm9aU0FuSUNzZ2JHOWpZWFJwYjI0Z0t5QW5JR0FuSUNzZ2NISnZjRVoxYkd4T1lXMWxJQ3NnSjJBZ2FYTWdiV0Z5YTJWa0lHRnpJSEpsY1hWcGNtVmtJQ2NnS3lBb0oybHVJR0FuSUNzZ1kyOXRjRzl1Wlc1MFRtRnRaU0FySUNkZ0xDQmlkWFFnYVhSeklIWmhiSFZsSUdseklHQnVkV3hzWUM0bktTazdYRzRnSUNBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCdVpYY2dVSEp2Y0ZSNWNHVkZjbkp2Y2lnblZHaGxJQ2NnS3lCc2IyTmhkR2x2YmlBcklDY2dZQ2NnS3lCd2NtOXdSblZzYkU1aGJXVWdLeUFuWUNCcGN5QnRZWEpyWldRZ1lYTWdjbVZ4ZFdseVpXUWdhVzRnSnlBcklDZ25ZQ2NnS3lCamIyMXdiMjVsYm5ST1lXMWxJQ3NnSjJBc0lHSjFkQ0JwZEhNZ2RtRnNkV1VnYVhNZ1lIVnVaR1ZtYVc1bFpHQXVKeWtwTzF4dUlDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lISmxkSFZ5YmlCdWRXeHNPMXh1SUNBZ0lDQWdmU0JsYkhObElIdGNiaUFnSUNBZ0lDQWdjbVYwZFhKdUlIWmhiR2xrWVhSbEtIQnliM0J6TENCd2NtOXdUbUZ0WlN3Z1kyOXRjRzl1Wlc1MFRtRnRaU3dnYkc5allYUnBiMjRzSUhCeWIzQkdkV3hzVG1GdFpTazdYRzRnSUNBZ0lDQjlYRzRnSUNBZ2ZWeHVYRzRnSUNBZ2RtRnlJR05vWVdsdVpXUkRhR1ZqYTFSNWNHVWdQU0JqYUdWamExUjVjR1V1WW1sdVpDaHVkV3hzTENCbVlXeHpaU2s3WEc0Z0lDQWdZMmhoYVc1bFpFTm9aV05yVkhsd1pTNXBjMUpsY1hWcGNtVmtJRDBnWTJobFkydFVlWEJsTG1KcGJtUW9iblZzYkN3Z2RISjFaU2s3WEc1Y2JpQWdJQ0J5WlhSMWNtNGdZMmhoYVc1bFpFTm9aV05yVkhsd1pUdGNiaUFnZlZ4dVhHNGdJR1oxYm1OMGFXOXVJR055WldGMFpWQnlhVzFwZEdsMlpWUjVjR1ZEYUdWamEyVnlLR1Y0Y0dWamRHVmtWSGx3WlNrZ2UxeHVJQ0FnSUdaMWJtTjBhVzl1SUhaaGJHbGtZWFJsS0hCeWIzQnpMQ0J3Y205d1RtRnRaU3dnWTI5dGNHOXVaVzUwVG1GdFpTd2diRzlqWVhScGIyNHNJSEJ5YjNCR2RXeHNUbUZ0WlN3Z2MyVmpjbVYwS1NCN1hHNGdJQ0FnSUNCMllYSWdjSEp2Y0ZaaGJIVmxJRDBnY0hKdmNITmJjSEp2Y0U1aGJXVmRPMXh1SUNBZ0lDQWdkbUZ5SUhCeWIzQlVlWEJsSUQwZ1oyVjBVSEp2Y0ZSNWNHVW9jSEp2Y0ZaaGJIVmxLVHRjYmlBZ0lDQWdJR2xtSUNod2NtOXdWSGx3WlNBaFBUMGdaWGh3WldOMFpXUlVlWEJsS1NCN1hHNGdJQ0FnSUNBZ0lDOHZJR0J3Y205d1ZtRnNkV1ZnSUdKbGFXNW5JR2x1YzNSaGJtTmxJRzltTENCellYa3NJR1JoZEdVdmNtVm5aWGh3TENCd1lYTnpJSFJvWlNBbmIySnFaV04wSjF4dUlDQWdJQ0FnSUNBdkx5QmphR1ZqYXl3Z1luVjBJSGRsSUdOaGJpQnZabVpsY2lCaElHMXZjbVVnY0hKbFkybHpaU0JsY25KdmNpQnRaWE56WVdkbElHaGxjbVVnY21GMGFHVnlJSFJvWVc1Y2JpQWdJQ0FnSUNBZ0x5OGdKMjltSUhSNWNHVWdZRzlpYW1WamRHQW5MbHh1SUNBZ0lDQWdJQ0IyWVhJZ2NISmxZMmx6WlZSNWNHVWdQU0JuWlhSUWNtVmphWE5sVkhsd1pTaHdjbTl3Vm1Gc2RXVXBPMXh1WEc0Z0lDQWdJQ0FnSUhKbGRIVnliaUJ1WlhjZ1VISnZjRlI1Y0dWRmNuSnZjaWduU1c1MllXeHBaQ0FuSUNzZ2JHOWpZWFJwYjI0Z0t5QW5JR0FuSUNzZ2NISnZjRVoxYkd4T1lXMWxJQ3NnSjJBZ2IyWWdkSGx3WlNBbklDc2dLQ2RnSnlBcklIQnlaV05wYzJWVWVYQmxJQ3NnSjJBZ2MzVndjR3hwWldRZ2RHOGdZQ2NnS3lCamIyMXdiMjVsYm5ST1lXMWxJQ3NnSjJBc0lHVjRjR1ZqZEdWa0lDY3BJQ3NnS0NkZ0p5QXJJR1Y0Y0dWamRHVmtWSGx3WlNBcklDZGdMaWNwS1R0Y2JpQWdJQ0FnSUgxY2JpQWdJQ0FnSUhKbGRIVnliaUJ1ZFd4c08xeHVJQ0FnSUgxY2JpQWdJQ0J5WlhSMWNtNGdZM0psWVhSbFEyaGhhVzVoWW14bFZIbHdaVU5vWldOclpYSW9kbUZzYVdSaGRHVXBPMXh1SUNCOVhHNWNiaUFnWm5WdVkzUnBiMjRnWTNKbFlYUmxRVzU1Vkhsd1pVTm9aV05yWlhJb0tTQjdYRzRnSUNBZ2NtVjBkWEp1SUdOeVpXRjBaVU5vWVdsdVlXSnNaVlI1Y0dWRGFHVmphMlZ5S0dWdGNIUjVSblZ1WTNScGIyNHVkR2hoZEZKbGRIVnlibk5PZFd4c0tUdGNiaUFnZlZ4dVhHNGdJR1oxYm1OMGFXOXVJR055WldGMFpVRnljbUY1VDJaVWVYQmxRMmhsWTJ0bGNpaDBlWEJsUTJobFkydGxjaWtnZTF4dUlDQWdJR1oxYm1OMGFXOXVJSFpoYkdsa1lYUmxLSEJ5YjNCekxDQndjbTl3VG1GdFpTd2dZMjl0Y0c5dVpXNTBUbUZ0WlN3Z2JHOWpZWFJwYjI0c0lIQnliM0JHZFd4c1RtRnRaU2tnZTF4dUlDQWdJQ0FnYVdZZ0tIUjVjR1Z2WmlCMGVYQmxRMmhsWTJ0bGNpQWhQVDBnSjJaMWJtTjBhVzl1SnlrZ2UxeHVJQ0FnSUNBZ0lDQnlaWFIxY200Z2JtVjNJRkJ5YjNCVWVYQmxSWEp5YjNJb0oxQnliM0JsY25SNUlHQW5JQ3NnY0hKdmNFWjFiR3hPWVcxbElDc2dKMkFnYjJZZ1kyOXRjRzl1Wlc1MElHQW5JQ3NnWTI5dGNHOXVaVzUwVG1GdFpTQXJJQ2RnSUdoaGN5QnBiblpoYkdsa0lGQnliM0JVZVhCbElHNXZkR0YwYVc5dUlHbHVjMmxrWlNCaGNuSmhlVTltTGljcE8xeHVJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ2RtRnlJSEJ5YjNCV1lXeDFaU0E5SUhCeWIzQnpXM0J5YjNCT1lXMWxYVHRjYmlBZ0lDQWdJR2xtSUNnaFFYSnlZWGt1YVhOQmNuSmhlU2h3Y205d1ZtRnNkV1VwS1NCN1hHNGdJQ0FnSUNBZ0lIWmhjaUJ3Y205d1ZIbHdaU0E5SUdkbGRGQnliM0JVZVhCbEtIQnliM0JXWVd4MVpTazdYRzRnSUNBZ0lDQWdJSEpsZEhWeWJpQnVaWGNnVUhKdmNGUjVjR1ZGY25KdmNpZ25TVzUyWVd4cFpDQW5JQ3NnYkc5allYUnBiMjRnS3lBbklHQW5JQ3NnY0hKdmNFWjFiR3hPWVcxbElDc2dKMkFnYjJZZ2RIbHdaU0FuSUNzZ0tDZGdKeUFySUhCeWIzQlVlWEJsSUNzZ0oyQWdjM1Z3Y0d4cFpXUWdkRzhnWUNjZ0t5QmpiMjF3YjI1bGJuUk9ZVzFsSUNzZ0oyQXNJR1Y0Y0dWamRHVmtJR0Z1SUdGeWNtRjVMaWNwS1R0Y2JpQWdJQ0FnSUgxY2JpQWdJQ0FnSUdadmNpQW9kbUZ5SUdrZ1BTQXdPeUJwSUR3Z2NISnZjRlpoYkhWbExteGxibWQwYURzZ2FTc3JLU0I3WEc0Z0lDQWdJQ0FnSUhaaGNpQmxjbkp2Y2lBOUlIUjVjR1ZEYUdWamEyVnlLSEJ5YjNCV1lXeDFaU3dnYVN3Z1kyOXRjRzl1Wlc1MFRtRnRaU3dnYkc5allYUnBiMjRzSUhCeWIzQkdkV3hzVG1GdFpTQXJJQ2RiSnlBcklHa2dLeUFuWFNjc0lGSmxZV04wVUhKdmNGUjVjR1Z6VTJWamNtVjBLVHRjYmlBZ0lDQWdJQ0FnYVdZZ0tHVnljbTl5SUdsdWMzUmhibU5sYjJZZ1JYSnliM0lwSUh0Y2JpQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z1pYSnliM0k3WEc0Z0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUgxY2JpQWdJQ0FnSUhKbGRIVnliaUJ1ZFd4c08xeHVJQ0FnSUgxY2JpQWdJQ0J5WlhSMWNtNGdZM0psWVhSbFEyaGhhVzVoWW14bFZIbHdaVU5vWldOclpYSW9kbUZzYVdSaGRHVXBPMXh1SUNCOVhHNWNiaUFnWm5WdVkzUnBiMjRnWTNKbFlYUmxSV3hsYldWdWRGUjVjR1ZEYUdWamEyVnlLQ2tnZTF4dUlDQWdJR1oxYm1OMGFXOXVJSFpoYkdsa1lYUmxLSEJ5YjNCekxDQndjbTl3VG1GdFpTd2dZMjl0Y0c5dVpXNTBUbUZ0WlN3Z2JHOWpZWFJwYjI0c0lIQnliM0JHZFd4c1RtRnRaU2tnZTF4dUlDQWdJQ0FnZG1GeUlIQnliM0JXWVd4MVpTQTlJSEJ5YjNCelczQnliM0JPWVcxbFhUdGNiaUFnSUNBZ0lHbG1JQ2doYVhOV1lXeHBaRVZzWlcxbGJuUW9jSEp2Y0ZaaGJIVmxLU2tnZTF4dUlDQWdJQ0FnSUNCMllYSWdjSEp2Y0ZSNWNHVWdQU0JuWlhSUWNtOXdWSGx3WlNod2NtOXdWbUZzZFdVcE8xeHVJQ0FnSUNBZ0lDQnlaWFIxY200Z2JtVjNJRkJ5YjNCVWVYQmxSWEp5YjNJb0owbHVkbUZzYVdRZ0p5QXJJR3h2WTJGMGFXOXVJQ3NnSnlCZ0p5QXJJSEJ5YjNCR2RXeHNUbUZ0WlNBcklDZGdJRzltSUhSNWNHVWdKeUFySUNnbllDY2dLeUJ3Y205d1ZIbHdaU0FySUNkZ0lITjFjSEJzYVdWa0lIUnZJR0FuSUNzZ1kyOXRjRzl1Wlc1MFRtRnRaU0FySUNkZ0xDQmxlSEJsWTNSbFpDQmhJSE5wYm1kc1pTQlNaV0ZqZEVWc1pXMWxiblF1SnlrcE8xeHVJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ2NtVjBkWEp1SUc1MWJHdzdYRzRnSUNBZ2ZWeHVJQ0FnSUhKbGRIVnliaUJqY21WaGRHVkRhR0ZwYm1GaWJHVlVlWEJsUTJobFkydGxjaWgyWVd4cFpHRjBaU2s3WEc0Z0lIMWNibHh1SUNCbWRXNWpkR2x2YmlCamNtVmhkR1ZKYm5OMFlXNWpaVlI1Y0dWRGFHVmphMlZ5S0dWNGNHVmpkR1ZrUTJ4aGMzTXBJSHRjYmlBZ0lDQm1kVzVqZEdsdmJpQjJZV3hwWkdGMFpTaHdjbTl3Y3l3Z2NISnZjRTVoYldVc0lHTnZiWEJ2Ym1WdWRFNWhiV1VzSUd4dlkyRjBhVzl1TENCd2NtOXdSblZzYkU1aGJXVXBJSHRjYmlBZ0lDQWdJR2xtSUNnaEtIQnliM0J6VzNCeWIzQk9ZVzFsWFNCcGJuTjBZVzVqWlc5bUlHVjRjR1ZqZEdWa1EyeGhjM01wS1NCN1hHNGdJQ0FnSUNBZ0lIWmhjaUJsZUhCbFkzUmxaRU5zWVhOelRtRnRaU0E5SUdWNGNHVmpkR1ZrUTJ4aGMzTXVibUZ0WlNCOGZDQkJUazlPV1UxUFZWTTdYRzRnSUNBZ0lDQWdJSFpoY2lCaFkzUjFZV3hEYkdGemMwNWhiV1VnUFNCblpYUkRiR0Z6YzA1aGJXVW9jSEp2Y0hOYmNISnZjRTVoYldWZEtUdGNiaUFnSUNBZ0lDQWdjbVYwZFhKdUlHNWxkeUJRY205d1ZIbHdaVVZ5Y205eUtDZEpiblpoYkdsa0lDY2dLeUJzYjJOaGRHbHZiaUFySUNjZ1lDY2dLeUJ3Y205d1JuVnNiRTVoYldVZ0t5QW5ZQ0J2WmlCMGVYQmxJQ2NnS3lBb0oyQW5JQ3NnWVdOMGRXRnNRMnhoYzNOT1lXMWxJQ3NnSjJBZ2MzVndjR3hwWldRZ2RHOGdZQ2NnS3lCamIyMXdiMjVsYm5ST1lXMWxJQ3NnSjJBc0lHVjRjR1ZqZEdWa0lDY3BJQ3NnS0NkcGJuTjBZVzVqWlNCdlppQmdKeUFySUdWNGNHVmpkR1ZrUTJ4aGMzTk9ZVzFsSUNzZ0oyQXVKeWtwTzF4dUlDQWdJQ0FnZlZ4dUlDQWdJQ0FnY21WMGRYSnVJRzUxYkd3N1hHNGdJQ0FnZlZ4dUlDQWdJSEpsZEhWeWJpQmpjbVZoZEdWRGFHRnBibUZpYkdWVWVYQmxRMmhsWTJ0bGNpaDJZV3hwWkdGMFpTazdYRzRnSUgxY2JseHVJQ0JtZFc1amRHbHZiaUJqY21WaGRHVkZiblZ0Vkhsd1pVTm9aV05yWlhJb1pYaHdaV04wWldSV1lXeDFaWE1wSUh0Y2JpQWdJQ0JwWmlBb0lVRnljbUY1TG1selFYSnlZWGtvWlhod1pXTjBaV1JXWVd4MVpYTXBLU0I3WEc0Z0lDQWdJQ0J3Y205alpYTnpMbVZ1ZGk1T1QwUkZYMFZPVmlBaFBUMGdKM0J5YjJSMVkzUnBiMjRuSUQ4Z2QyRnlibWx1WnlobVlXeHpaU3dnSjBsdWRtRnNhV1FnWVhKbmRXMWxiblFnYzNWd2NHeHBaV1FnZEc4Z2IyNWxUMllzSUdWNGNHVmpkR1ZrSUdGdUlHbHVjM1JoYm1ObElHOW1JR0Z5Y21GNUxpY3BJRG9nZG05cFpDQXdPMXh1SUNBZ0lDQWdjbVYwZFhKdUlHVnRjSFI1Um5WdVkzUnBiMjR1ZEdoaGRGSmxkSFZ5Ym5OT2RXeHNPMXh1SUNBZ0lIMWNibHh1SUNBZ0lHWjFibU4wYVc5dUlIWmhiR2xrWVhSbEtIQnliM0J6TENCd2NtOXdUbUZ0WlN3Z1kyOXRjRzl1Wlc1MFRtRnRaU3dnYkc5allYUnBiMjRzSUhCeWIzQkdkV3hzVG1GdFpTa2dlMXh1SUNBZ0lDQWdkbUZ5SUhCeWIzQldZV3gxWlNBOUlIQnliM0J6VzNCeWIzQk9ZVzFsWFR0Y2JpQWdJQ0FnSUdadmNpQW9kbUZ5SUdrZ1BTQXdPeUJwSUR3Z1pYaHdaV04wWldSV1lXeDFaWE11YkdWdVozUm9PeUJwS3lzcElIdGNiaUFnSUNBZ0lDQWdhV1lnS0dsektIQnliM0JXWVd4MVpTd2daWGh3WldOMFpXUldZV3gxWlhOYmFWMHBLU0I3WEc0Z0lDQWdJQ0FnSUNBZ2NtVjBkWEp1SUc1MWJHdzdYRzRnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJSDFjYmx4dUlDQWdJQ0FnZG1GeUlIWmhiSFZsYzFOMGNtbHVaeUE5SUVwVFQwNHVjM1J5YVc1bmFXWjVLR1Y0Y0dWamRHVmtWbUZzZFdWektUdGNiaUFnSUNBZ0lISmxkSFZ5YmlCdVpYY2dVSEp2Y0ZSNWNHVkZjbkp2Y2lnblNXNTJZV3hwWkNBbklDc2diRzlqWVhScGIyNGdLeUFuSUdBbklDc2djSEp2Y0VaMWJHeE9ZVzFsSUNzZ0oyQWdiMllnZG1Gc2RXVWdZQ2NnS3lCd2NtOXdWbUZzZFdVZ0t5QW5ZQ0FuSUNzZ0tDZHpkWEJ3YkdsbFpDQjBieUJnSnlBcklHTnZiWEJ2Ym1WdWRFNWhiV1VnS3lBbllDd2daWGh3WldOMFpXUWdiMjVsSUc5bUlDY2dLeUIyWVd4MVpYTlRkSEpwYm1jZ0t5QW5MaWNwS1R0Y2JpQWdJQ0I5WEc0Z0lDQWdjbVYwZFhKdUlHTnlaV0YwWlVOb1lXbHVZV0pzWlZSNWNHVkRhR1ZqYTJWeUtIWmhiR2xrWVhSbEtUdGNiaUFnZlZ4dVhHNGdJR1oxYm1OMGFXOXVJR055WldGMFpVOWlhbVZqZEU5bVZIbHdaVU5vWldOclpYSW9kSGx3WlVOb1pXTnJaWElwSUh0Y2JpQWdJQ0JtZFc1amRHbHZiaUIyWVd4cFpHRjBaU2h3Y205d2N5d2djSEp2Y0U1aGJXVXNJR052YlhCdmJtVnVkRTVoYldVc0lHeHZZMkYwYVc5dUxDQndjbTl3Um5Wc2JFNWhiV1VwSUh0Y2JpQWdJQ0FnSUdsbUlDaDBlWEJsYjJZZ2RIbHdaVU5vWldOclpYSWdJVDA5SUNkbWRXNWpkR2x2YmljcElIdGNiaUFnSUNBZ0lDQWdjbVYwZFhKdUlHNWxkeUJRY205d1ZIbHdaVVZ5Y205eUtDZFFjbTl3WlhKMGVTQmdKeUFySUhCeWIzQkdkV3hzVG1GdFpTQXJJQ2RnSUc5bUlHTnZiWEJ2Ym1WdWRDQmdKeUFySUdOdmJYQnZibVZ1ZEU1aGJXVWdLeUFuWUNCb1lYTWdhVzUyWVd4cFpDQlFjbTl3Vkhsd1pTQnViM1JoZEdsdmJpQnBibk5wWkdVZ2IySnFaV04wVDJZdUp5azdYRzRnSUNBZ0lDQjlYRzRnSUNBZ0lDQjJZWElnY0hKdmNGWmhiSFZsSUQwZ2NISnZjSE5iY0hKdmNFNWhiV1ZkTzF4dUlDQWdJQ0FnZG1GeUlIQnliM0JVZVhCbElEMGdaMlYwVUhKdmNGUjVjR1VvY0hKdmNGWmhiSFZsS1R0Y2JpQWdJQ0FnSUdsbUlDaHdjbTl3Vkhsd1pTQWhQVDBnSjI5aWFtVmpkQ2NwSUh0Y2JpQWdJQ0FnSUNBZ2NtVjBkWEp1SUc1bGR5QlFjbTl3Vkhsd1pVVnljbTl5S0NkSmJuWmhiR2xrSUNjZ0t5QnNiMk5oZEdsdmJpQXJJQ2NnWUNjZ0t5QndjbTl3Um5Wc2JFNWhiV1VnS3lBbllDQnZaaUIwZVhCbElDY2dLeUFvSjJBbklDc2djSEp2Y0ZSNWNHVWdLeUFuWUNCemRYQndiR2xsWkNCMGJ5QmdKeUFySUdOdmJYQnZibVZ1ZEU1aGJXVWdLeUFuWUN3Z1pYaHdaV04wWldRZ1lXNGdiMkpxWldOMExpY3BLVHRjYmlBZ0lDQWdJSDFjYmlBZ0lDQWdJR1p2Y2lBb2RtRnlJR3RsZVNCcGJpQndjbTl3Vm1Gc2RXVXBJSHRjYmlBZ0lDQWdJQ0FnYVdZZ0tIQnliM0JXWVd4MVpTNW9ZWE5QZDI1UWNtOXdaWEowZVNoclpYa3BLU0I3WEc0Z0lDQWdJQ0FnSUNBZ2RtRnlJR1Z5Y205eUlEMGdkSGx3WlVOb1pXTnJaWElvY0hKdmNGWmhiSFZsTENCclpYa3NJR052YlhCdmJtVnVkRTVoYldVc0lHeHZZMkYwYVc5dUxDQndjbTl3Um5Wc2JFNWhiV1VnS3lBbkxpY2dLeUJyWlhrc0lGSmxZV04wVUhKdmNGUjVjR1Z6VTJWamNtVjBLVHRjYmlBZ0lDQWdJQ0FnSUNCcFppQW9aWEp5YjNJZ2FXNXpkR0Z1WTJWdlppQkZjbkp2Y2lrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnY21WMGRYSnVJR1Z5Y205eU8xeHVJQ0FnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnZlZ4dUlDQWdJQ0FnY21WMGRYSnVJRzUxYkd3N1hHNGdJQ0FnZlZ4dUlDQWdJSEpsZEhWeWJpQmpjbVZoZEdWRGFHRnBibUZpYkdWVWVYQmxRMmhsWTJ0bGNpaDJZV3hwWkdGMFpTazdYRzRnSUgxY2JseHVJQ0JtZFc1amRHbHZiaUJqY21WaGRHVlZibWx2YmxSNWNHVkRhR1ZqYTJWeUtHRnljbUY1VDJaVWVYQmxRMmhsWTJ0bGNuTXBJSHRjYmlBZ0lDQnBaaUFvSVVGeWNtRjVMbWx6UVhKeVlYa29ZWEp5WVhsUFpsUjVjR1ZEYUdWamEyVnljeWtwSUh0Y2JpQWdJQ0FnSUhCeWIyTmxjM011Wlc1MkxrNVBSRVZmUlU1V0lDRTlQU0FuY0hKdlpIVmpkR2x2YmljZ1B5QjNZWEp1YVc1bktHWmhiSE5sTENBblNXNTJZV3hwWkNCaGNtZDFiV1Z1ZENCemRYQndiR2xsWkNCMGJ5QnZibVZQWmxSNWNHVXNJR1Y0Y0dWamRHVmtJR0Z1SUdsdWMzUmhibU5sSUc5bUlHRnljbUY1TGljcElEb2dkbTlwWkNBd08xeHVJQ0FnSUNBZ2NtVjBkWEp1SUdWdGNIUjVSblZ1WTNScGIyNHVkR2hoZEZKbGRIVnlibk5PZFd4c08xeHVJQ0FnSUgxY2JseHVJQ0FnSUdadmNpQW9kbUZ5SUdrZ1BTQXdPeUJwSUR3Z1lYSnlZWGxQWmxSNWNHVkRhR1ZqYTJWeWN5NXNaVzVuZEdnN0lHa3JLeWtnZTF4dUlDQWdJQ0FnZG1GeUlHTm9aV05yWlhJZ1BTQmhjbkpoZVU5bVZIbHdaVU5vWldOclpYSnpXMmxkTzF4dUlDQWdJQ0FnYVdZZ0tIUjVjR1Z2WmlCamFHVmphMlZ5SUNFOVBTQW5ablZ1WTNScGIyNG5LU0I3WEc0Z0lDQWdJQ0FnSUhkaGNtNXBibWNvWEc0Z0lDQWdJQ0FnSUNBZ1ptRnNjMlVzWEc0Z0lDQWdJQ0FnSUNBZ0owbHVkbUZzYVdRZ1lYSm5kVzFsYm5RZ2MzVndjR3hwWkNCMGJ5QnZibVZQWmxSNWNHVXVJRVY0Y0dWamRHVmtJR0Z1SUdGeWNtRjVJRzltSUdOb1pXTnJJR1oxYm1OMGFXOXVjeXdnWW5WMElDY2dLMXh1SUNBZ0lDQWdJQ0FnSUNkeVpXTmxhWFpsWkNBbGN5QmhkQ0JwYm1SbGVDQWxjeTRuTEZ4dUlDQWdJQ0FnSUNBZ0lHZGxkRkJ2YzNSbWFYaEdiM0pVZVhCbFYyRnlibWx1WnloamFHVmphMlZ5S1N4Y2JpQWdJQ0FnSUNBZ0lDQnBYRzRnSUNBZ0lDQWdJQ2s3WEc0Z0lDQWdJQ0FnSUhKbGRIVnliaUJsYlhCMGVVWjFibU4wYVc5dUxuUm9ZWFJTWlhSMWNtNXpUblZzYkR0Y2JpQWdJQ0FnSUgxY2JpQWdJQ0I5WEc1Y2JpQWdJQ0JtZFc1amRHbHZiaUIyWVd4cFpHRjBaU2h3Y205d2N5d2djSEp2Y0U1aGJXVXNJR052YlhCdmJtVnVkRTVoYldVc0lHeHZZMkYwYVc5dUxDQndjbTl3Um5Wc2JFNWhiV1VwSUh0Y2JpQWdJQ0FnSUdadmNpQW9kbUZ5SUdrZ1BTQXdPeUJwSUR3Z1lYSnlZWGxQWmxSNWNHVkRhR1ZqYTJWeWN5NXNaVzVuZEdnN0lHa3JLeWtnZTF4dUlDQWdJQ0FnSUNCMllYSWdZMmhsWTJ0bGNpQTlJR0Z5Y21GNVQyWlVlWEJsUTJobFkydGxjbk5iYVYwN1hHNGdJQ0FnSUNBZ0lHbG1JQ2hqYUdWamEyVnlLSEJ5YjNCekxDQndjbTl3VG1GdFpTd2dZMjl0Y0c5dVpXNTBUbUZ0WlN3Z2JHOWpZWFJwYjI0c0lIQnliM0JHZFd4c1RtRnRaU3dnVW1WaFkzUlFjbTl3Vkhsd1pYTlRaV055WlhRcElEMDlJRzUxYkd3cElIdGNiaUFnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdiblZzYkR0Y2JpQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ2ZWeHVYRzRnSUNBZ0lDQnlaWFIxY200Z2JtVjNJRkJ5YjNCVWVYQmxSWEp5YjNJb0owbHVkbUZzYVdRZ0p5QXJJR3h2WTJGMGFXOXVJQ3NnSnlCZ0p5QXJJSEJ5YjNCR2RXeHNUbUZ0WlNBcklDZGdJSE4xY0hCc2FXVmtJSFJ2SUNjZ0t5QW9KMkFuSUNzZ1kyOXRjRzl1Wlc1MFRtRnRaU0FySUNkZ0xpY3BLVHRjYmlBZ0lDQjlYRzRnSUNBZ2NtVjBkWEp1SUdOeVpXRjBaVU5vWVdsdVlXSnNaVlI1Y0dWRGFHVmphMlZ5S0haaGJHbGtZWFJsS1R0Y2JpQWdmVnh1WEc0Z0lHWjFibU4wYVc5dUlHTnlaV0YwWlU1dlpHVkRhR1ZqYTJWeUtDa2dlMXh1SUNBZ0lHWjFibU4wYVc5dUlIWmhiR2xrWVhSbEtIQnliM0J6TENCd2NtOXdUbUZ0WlN3Z1kyOXRjRzl1Wlc1MFRtRnRaU3dnYkc5allYUnBiMjRzSUhCeWIzQkdkV3hzVG1GdFpTa2dlMXh1SUNBZ0lDQWdhV1lnS0NGcGMwNXZaR1VvY0hKdmNITmJjSEp2Y0U1aGJXVmRLU2tnZTF4dUlDQWdJQ0FnSUNCeVpYUjFjbTRnYm1WM0lGQnliM0JVZVhCbFJYSnliM0lvSjBsdWRtRnNhV1FnSnlBcklHeHZZMkYwYVc5dUlDc2dKeUJnSnlBcklIQnliM0JHZFd4c1RtRnRaU0FySUNkZ0lITjFjSEJzYVdWa0lIUnZJQ2NnS3lBb0oyQW5JQ3NnWTI5dGNHOXVaVzUwVG1GdFpTQXJJQ2RnTENCbGVIQmxZM1JsWkNCaElGSmxZV04wVG05a1pTNG5LU2s3WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdJQ0J5WlhSMWNtNGdiblZzYkR0Y2JpQWdJQ0I5WEc0Z0lDQWdjbVYwZFhKdUlHTnlaV0YwWlVOb1lXbHVZV0pzWlZSNWNHVkRhR1ZqYTJWeUtIWmhiR2xrWVhSbEtUdGNiaUFnZlZ4dVhHNGdJR1oxYm1OMGFXOXVJR055WldGMFpWTm9ZWEJsVkhsd1pVTm9aV05yWlhJb2MyaGhjR1ZVZVhCbGN5a2dlMXh1SUNBZ0lHWjFibU4wYVc5dUlIWmhiR2xrWVhSbEtIQnliM0J6TENCd2NtOXdUbUZ0WlN3Z1kyOXRjRzl1Wlc1MFRtRnRaU3dnYkc5allYUnBiMjRzSUhCeWIzQkdkV3hzVG1GdFpTa2dlMXh1SUNBZ0lDQWdkbUZ5SUhCeWIzQldZV3gxWlNBOUlIQnliM0J6VzNCeWIzQk9ZVzFsWFR0Y2JpQWdJQ0FnSUhaaGNpQndjbTl3Vkhsd1pTQTlJR2RsZEZCeWIzQlVlWEJsS0hCeWIzQldZV3gxWlNrN1hHNGdJQ0FnSUNCcFppQW9jSEp2Y0ZSNWNHVWdJVDA5SUNkdlltcGxZM1FuS1NCN1hHNGdJQ0FnSUNBZ0lISmxkSFZ5YmlCdVpYY2dVSEp2Y0ZSNWNHVkZjbkp2Y2lnblNXNTJZV3hwWkNBbklDc2diRzlqWVhScGIyNGdLeUFuSUdBbklDc2djSEp2Y0VaMWJHeE9ZVzFsSUNzZ0oyQWdiMllnZEhsd1pTQmdKeUFySUhCeWIzQlVlWEJsSUNzZ0oyQWdKeUFySUNnbmMzVndjR3hwWldRZ2RHOGdZQ2NnS3lCamIyMXdiMjVsYm5ST1lXMWxJQ3NnSjJBc0lHVjRjR1ZqZEdWa0lHQnZZbXBsWTNSZ0xpY3BLVHRjYmlBZ0lDQWdJSDFjYmlBZ0lDQWdJR1p2Y2lBb2RtRnlJR3RsZVNCcGJpQnphR0Z3WlZSNWNHVnpLU0I3WEc0Z0lDQWdJQ0FnSUhaaGNpQmphR1ZqYTJWeUlEMGdjMmhoY0dWVWVYQmxjMXRyWlhsZE8xeHVJQ0FnSUNBZ0lDQnBaaUFvSVdOb1pXTnJaWElwSUh0Y2JpQWdJQ0FnSUNBZ0lDQmpiMjUwYVc1MVpUdGNiaUFnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0IyWVhJZ1pYSnliM0lnUFNCamFHVmphMlZ5S0hCeWIzQldZV3gxWlN3Z2EyVjVMQ0JqYjIxd2IyNWxiblJPWVcxbExDQnNiMk5oZEdsdmJpd2djSEp2Y0VaMWJHeE9ZVzFsSUNzZ0p5NG5JQ3NnYTJWNUxDQlNaV0ZqZEZCeWIzQlVlWEJsYzFObFkzSmxkQ2s3WEc0Z0lDQWdJQ0FnSUdsbUlDaGxjbkp2Y2lrZ2UxeHVJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQmxjbkp2Y2p0Y2JpQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ2NtVjBkWEp1SUc1MWJHdzdYRzRnSUNBZ2ZWeHVJQ0FnSUhKbGRIVnliaUJqY21WaGRHVkRhR0ZwYm1GaWJHVlVlWEJsUTJobFkydGxjaWgyWVd4cFpHRjBaU2s3WEc0Z0lIMWNibHh1SUNCbWRXNWpkR2x2YmlCcGMwNXZaR1VvY0hKdmNGWmhiSFZsS1NCN1hHNGdJQ0FnYzNkcGRHTm9JQ2gwZVhCbGIyWWdjSEp2Y0ZaaGJIVmxLU0I3WEc0Z0lDQWdJQ0JqWVhObElDZHVkVzFpWlhJbk9seHVJQ0FnSUNBZ1kyRnpaU0FuYzNSeWFXNW5KenBjYmlBZ0lDQWdJR05oYzJVZ0ozVnVaR1ZtYVc1bFpDYzZYRzRnSUNBZ0lDQWdJSEpsZEhWeWJpQjBjblZsTzF4dUlDQWdJQ0FnWTJGelpTQW5ZbTl2YkdWaGJpYzZYRzRnSUNBZ0lDQWdJSEpsZEhWeWJpQWhjSEp2Y0ZaaGJIVmxPMXh1SUNBZ0lDQWdZMkZ6WlNBbmIySnFaV04wSnpwY2JpQWdJQ0FnSUNBZ2FXWWdLRUZ5Y21GNUxtbHpRWEp5WVhrb2NISnZjRlpoYkhWbEtTa2dlMXh1SUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUJ3Y205d1ZtRnNkV1V1WlhabGNua29hWE5PYjJSbEtUdGNiaUFnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0JwWmlBb2NISnZjRlpoYkhWbElEMDlQU0J1ZFd4c0lIeDhJR2x6Vm1Gc2FXUkZiR1Z0Wlc1MEtIQnliM0JXWVd4MVpTa3BJSHRjYmlBZ0lDQWdJQ0FnSUNCeVpYUjFjbTRnZEhKMVpUdGNiaUFnSUNBZ0lDQWdmVnh1WEc0Z0lDQWdJQ0FnSUhaaGNpQnBkR1Z5WVhSdmNrWnVJRDBnWjJWMFNYUmxjbUYwYjNKR2JpaHdjbTl3Vm1Gc2RXVXBPMXh1SUNBZ0lDQWdJQ0JwWmlBb2FYUmxjbUYwYjNKR2Jpa2dlMXh1SUNBZ0lDQWdJQ0FnSUhaaGNpQnBkR1Z5WVhSdmNpQTlJR2wwWlhKaGRHOXlSbTR1WTJGc2JDaHdjbTl3Vm1Gc2RXVXBPMXh1SUNBZ0lDQWdJQ0FnSUhaaGNpQnpkR1Z3TzF4dUlDQWdJQ0FnSUNBZ0lHbG1JQ2hwZEdWeVlYUnZja1p1SUNFOVBTQndjbTl3Vm1Gc2RXVXVaVzUwY21sbGN5a2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ2QyaHBiR1VnS0NFb2MzUmxjQ0E5SUdsMFpYSmhkRzl5TG01bGVIUW9LU2t1Wkc5dVpTa2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQnBaaUFvSVdselRtOWtaU2h6ZEdWd0xuWmhiSFZsS1NrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCbVlXeHpaVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ0lDQWdJSDBnWld4elpTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBdkx5QkpkR1Z5WVhSdmNpQjNhV3hzSUhCeWIzWnBaR1VnWlc1MGNua2dXMnNzZGwwZ2RIVndiR1Z6SUhKaGRHaGxjaUIwYUdGdUlIWmhiSFZsY3k1Y2JpQWdJQ0FnSUNBZ0lDQWdJSGRvYVd4bElDZ2hLSE4wWlhBZ1BTQnBkR1Z5WVhSdmNpNXVaWGgwS0NrcExtUnZibVVwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnZG1GeUlHVnVkSEo1SUQwZ2MzUmxjQzUyWVd4MVpUdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ2FXWWdLR1Z1ZEhKNUtTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdhV1lnS0NGcGMwNXZaR1VvWlc1MGNubGJNVjBwS1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z1ptRnNjMlU3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNCOUlHVnNjMlVnZTF4dUlDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCbVlXeHpaVHRjYmlBZ0lDQWdJQ0FnZlZ4dVhHNGdJQ0FnSUNBZ0lISmxkSFZ5YmlCMGNuVmxPMXh1SUNBZ0lDQWdaR1ZtWVhWc2REcGNiaUFnSUNBZ0lDQWdjbVYwZFhKdUlHWmhiSE5sTzF4dUlDQWdJSDFjYmlBZ2ZWeHVYRzRnSUdaMWJtTjBhVzl1SUdselUzbHRZbTlzS0hCeWIzQlVlWEJsTENCd2NtOXdWbUZzZFdVcElIdGNiaUFnSUNBdkx5Qk9ZWFJwZG1VZ1UzbHRZbTlzTGx4dUlDQWdJR2xtSUNod2NtOXdWSGx3WlNBOVBUMGdKM041YldKdmJDY3BJSHRjYmlBZ0lDQWdJSEpsZEhWeWJpQjBjblZsTzF4dUlDQWdJSDFjYmx4dUlDQWdJQzh2SURFNUxqUXVNeTQxSUZONWJXSnZiQzV3Y205MGIzUjVjR1ZiUUVCMGIxTjBjbWx1WjFSaFoxMGdQVDA5SUNkVGVXMWliMnduWEc0Z0lDQWdhV1lnS0hCeWIzQldZV3gxWlZzblFFQjBiMU4wY21sdVoxUmhaeWRkSUQwOVBTQW5VM2x0WW05c0p5a2dlMXh1SUNBZ0lDQWdjbVYwZFhKdUlIUnlkV1U3WEc0Z0lDQWdmVnh1WEc0Z0lDQWdMeThnUm1Gc2JHSmhZMnNnWm05eUlHNXZiaTF6Y0dWaklHTnZiWEJzYVdGdWRDQlRlVzFpYjJ4eklIZG9hV05vSUdGeVpTQndiMng1Wm1sc2JHVmtMbHh1SUNBZ0lHbG1JQ2gwZVhCbGIyWWdVM2x0WW05c0lEMDlQU0FuWm5WdVkzUnBiMjRuSUNZbUlIQnliM0JXWVd4MVpTQnBibk4wWVc1alpXOW1JRk41YldKdmJDa2dlMXh1SUNBZ0lDQWdjbVYwZFhKdUlIUnlkV1U3WEc0Z0lDQWdmVnh1WEc0Z0lDQWdjbVYwZFhKdUlHWmhiSE5sTzF4dUlDQjlYRzVjYmlBZ0x5OGdSWEYxYVhaaGJHVnVkQ0J2WmlCZ2RIbHdaVzltWUNCaWRYUWdkMmwwYUNCemNHVmphV0ZzSUdoaGJtUnNhVzVuSUdadmNpQmhjbkpoZVNCaGJtUWdjbVZuWlhod0xseHVJQ0JtZFc1amRHbHZiaUJuWlhSUWNtOXdWSGx3WlNod2NtOXdWbUZzZFdVcElIdGNiaUFnSUNCMllYSWdjSEp2Y0ZSNWNHVWdQU0IwZVhCbGIyWWdjSEp2Y0ZaaGJIVmxPMXh1SUNBZ0lHbG1JQ2hCY25KaGVTNXBjMEZ5Y21GNUtIQnliM0JXWVd4MVpTa3BJSHRjYmlBZ0lDQWdJSEpsZEhWeWJpQW5ZWEp5WVhrbk8xeHVJQ0FnSUgxY2JpQWdJQ0JwWmlBb2NISnZjRlpoYkhWbElHbHVjM1JoYm1ObGIyWWdVbVZuUlhod0tTQjdYRzRnSUNBZ0lDQXZMeUJQYkdRZ2QyVmlhMmwwY3lBb1lYUWdiR1ZoYzNRZ2RXNTBhV3dnUVc1a2NtOXBaQ0EwTGpBcElISmxkSFZ5YmlBblpuVnVZM1JwYjI0bklISmhkR2hsY2lCMGFHRnVYRzRnSUNBZ0lDQXZMeUFuYjJKcVpXTjBKeUJtYjNJZ2RIbHdaVzltSUdFZ1VtVm5SWGh3TGlCWFpTZHNiQ0J1YjNKdFlXeHBlbVVnZEdocGN5Qm9aWEpsSUhOdklIUm9ZWFFnTDJKc1lTOWNiaUFnSUNBZ0lDOHZJSEJoYzNObGN5QlFjbTl3Vkhsd1pYTXViMkpxWldOMExseHVJQ0FnSUNBZ2NtVjBkWEp1SUNkdlltcGxZM1FuTzF4dUlDQWdJSDFjYmlBZ0lDQnBaaUFvYVhOVGVXMWliMndvY0hKdmNGUjVjR1VzSUhCeWIzQldZV3gxWlNrcElIdGNiaUFnSUNBZ0lISmxkSFZ5YmlBbmMzbHRZbTlzSnp0Y2JpQWdJQ0I5WEc0Z0lDQWdjbVYwZFhKdUlIQnliM0JVZVhCbE8xeHVJQ0I5WEc1Y2JpQWdMeThnVkdocGN5Qm9ZVzVrYkdWeklHMXZjbVVnZEhsd1pYTWdkR2hoYmlCZ1oyVjBVSEp2Y0ZSNWNHVmdMaUJQYm14NUlIVnpaV1FnWm05eUlHVnljbTl5SUcxbGMzTmhaMlZ6TGx4dUlDQXZMeUJUWldVZ1lHTnlaV0YwWlZCeWFXMXBkR2wyWlZSNWNHVkRhR1ZqYTJWeVlDNWNiaUFnWm5WdVkzUnBiMjRnWjJWMFVISmxZMmx6WlZSNWNHVW9jSEp2Y0ZaaGJIVmxLU0I3WEc0Z0lDQWdhV1lnS0hSNWNHVnZaaUJ3Y205d1ZtRnNkV1VnUFQwOUlDZDFibVJsWm1sdVpXUW5JSHg4SUhCeWIzQldZV3gxWlNBOVBUMGdiblZzYkNrZ2UxeHVJQ0FnSUNBZ2NtVjBkWEp1SUNjbklDc2djSEp2Y0ZaaGJIVmxPMXh1SUNBZ0lIMWNiaUFnSUNCMllYSWdjSEp2Y0ZSNWNHVWdQU0JuWlhSUWNtOXdWSGx3WlNod2NtOXdWbUZzZFdVcE8xeHVJQ0FnSUdsbUlDaHdjbTl3Vkhsd1pTQTlQVDBnSjI5aWFtVmpkQ2NwSUh0Y2JpQWdJQ0FnSUdsbUlDaHdjbTl3Vm1Gc2RXVWdhVzV6ZEdGdVkyVnZaaUJFWVhSbEtTQjdYRzRnSUNBZ0lDQWdJSEpsZEhWeWJpQW5aR0YwWlNjN1hHNGdJQ0FnSUNCOUlHVnNjMlVnYVdZZ0tIQnliM0JXWVd4MVpTQnBibk4wWVc1alpXOW1JRkpsWjBWNGNDa2dlMXh1SUNBZ0lDQWdJQ0J5WlhSMWNtNGdKM0psWjJWNGNDYzdYRzRnSUNBZ0lDQjlYRzRnSUNBZ2ZWeHVJQ0FnSUhKbGRIVnliaUJ3Y205d1ZIbHdaVHRjYmlBZ2ZWeHVYRzRnSUM4dklGSmxkSFZ5Ym5NZ1lTQnpkSEpwYm1jZ2RHaGhkQ0JwY3lCd2IzTjBabWw0WldRZ2RHOGdZU0IzWVhKdWFXNW5JR0ZpYjNWMElHRnVJR2x1ZG1Gc2FXUWdkSGx3WlM1Y2JpQWdMeThnUm05eUlHVjRZVzF3YkdVc0lGd2lkVzVrWldacGJtVmtYQ0lnYjNJZ1hDSnZaaUIwZVhCbElHRnljbUY1WENKY2JpQWdablZ1WTNScGIyNGdaMlYwVUc5emRHWnBlRVp2Y2xSNWNHVlhZWEp1YVc1bktIWmhiSFZsS1NCN1hHNGdJQ0FnZG1GeUlIUjVjR1VnUFNCblpYUlFjbVZqYVhObFZIbHdaU2gyWVd4MVpTazdYRzRnSUNBZ2MzZHBkR05vSUNoMGVYQmxLU0I3WEc0Z0lDQWdJQ0JqWVhObElDZGhjbkpoZVNjNlhHNGdJQ0FnSUNCallYTmxJQ2R2WW1wbFkzUW5PbHh1SUNBZ0lDQWdJQ0J5WlhSMWNtNGdKMkZ1SUNjZ0t5QjBlWEJsTzF4dUlDQWdJQ0FnWTJGelpTQW5ZbTl2YkdWaGJpYzZYRzRnSUNBZ0lDQmpZWE5sSUNka1lYUmxKenBjYmlBZ0lDQWdJR05oYzJVZ0ozSmxaMlY0Y0NjNlhHNGdJQ0FnSUNBZ0lISmxkSFZ5YmlBbllTQW5JQ3NnZEhsd1pUdGNiaUFnSUNBZ0lHUmxabUYxYkhRNlhHNGdJQ0FnSUNBZ0lISmxkSFZ5YmlCMGVYQmxPMXh1SUNBZ0lIMWNiaUFnZlZ4dVhHNGdJQzh2SUZKbGRIVnlibk1nWTJ4aGMzTWdibUZ0WlNCdlppQjBhR1VnYjJKcVpXTjBMQ0JwWmlCaGJua3VYRzRnSUdaMWJtTjBhVzl1SUdkbGRFTnNZWE56VG1GdFpTaHdjbTl3Vm1Gc2RXVXBJSHRjYmlBZ0lDQnBaaUFvSVhCeWIzQldZV3gxWlM1amIyNXpkSEoxWTNSdmNpQjhmQ0FoY0hKdmNGWmhiSFZsTG1OdmJuTjBjblZqZEc5eUxtNWhiV1VwSUh0Y2JpQWdJQ0FnSUhKbGRIVnliaUJCVGs5T1dVMVBWVk03WEc0Z0lDQWdmVnh1SUNBZ0lISmxkSFZ5YmlCd2NtOXdWbUZzZFdVdVkyOXVjM1J5ZFdOMGIzSXVibUZ0WlR0Y2JpQWdmVnh1WEc0Z0lGSmxZV04wVUhKdmNGUjVjR1Z6TG1Ob1pXTnJVSEp2Y0ZSNWNHVnpJRDBnWTJobFkydFFjbTl3Vkhsd1pYTTdYRzRnSUZKbFlXTjBVSEp2Y0ZSNWNHVnpMbEJ5YjNCVWVYQmxjeUE5SUZKbFlXTjBVSEp2Y0ZSNWNHVnpPMXh1WEc0Z0lISmxkSFZ5YmlCU1pXRmpkRkJ5YjNCVWVYQmxjenRjYm4wN1hHNGlMQ0l2S2lwY2JpQXFJRU52Y0hseWFXZG9kQ0F5TURFekxYQnlaWE5sYm5Rc0lFWmhZMlZpYjI5ckxDQkpibU11WEc0Z0tpQkJiR3dnY21sbmFIUnpJSEpsYzJWeWRtVmtMbHh1SUNwY2JpQXFJRlJvYVhNZ2MyOTFjbU5sSUdOdlpHVWdhWE1nYkdsalpXNXpaV1FnZFc1a1pYSWdkR2hsSUVKVFJDMXpkSGxzWlNCc2FXTmxibk5sSUdadmRXNWtJR2x1SUhSb1pWeHVJQ29nVEVsRFJVNVRSU0JtYVd4bElHbHVJSFJvWlNCeWIyOTBJR1JwY21WamRHOXllU0J2WmlCMGFHbHpJSE52ZFhKalpTQjBjbVZsTGlCQmJpQmhaR1JwZEdsdmJtRnNJR2R5WVc1MFhHNGdLaUJ2WmlCd1lYUmxiblFnY21sbmFIUnpJR05oYmlCaVpTQm1iM1Z1WkNCcGJpQjBhR1VnVUVGVVJVNVVVeUJtYVd4bElHbHVJSFJvWlNCellXMWxJR1JwY21WamRHOXllUzVjYmlBcUwxeHVYRzRuZFhObElITjBjbWxqZENjN1hHNWNiblpoY2lCU1pXRmpkRkJ5YjNCVWVYQmxjMU5sWTNKbGRDQTlJQ2RUUlVOU1JWUmZSRTlmVGs5VVgxQkJVMU5mVkVoSlUxOVBVbDlaVDFWZlYwbE1URjlDUlY5R1NWSkZSQ2M3WEc1Y2JtMXZaSFZzWlM1bGVIQnZjblJ6SUQwZ1VtVmhZM1JRY205d1ZIbHdaWE5UWldOeVpYUTdYRzRpTENJdktpcGNiaUFxSUVOdmNIbHlhV2RvZENBeU1ERXpMWEJ5WlhObGJuUXNJRVpoWTJWaWIyOXJMQ0JKYm1NdVhHNGdLaUJCYkd3Z2NtbG5hSFJ6SUhKbGMyVnlkbVZrTGx4dUlDcGNiaUFxSUZSb2FYTWdjMjkxY21ObElHTnZaR1VnYVhNZ2JHbGpaVzV6WldRZ2RXNWtaWElnZEdobElFSlRSQzF6ZEhsc1pTQnNhV05sYm5ObElHWnZkVzVrSUdsdUlIUm9aVnh1SUNvZ1RFbERSVTVUUlNCbWFXeGxJR2x1SUhSb1pTQnliMjkwSUdScGNtVmpkRzl5ZVNCdlppQjBhR2x6SUhOdmRYSmpaU0IwY21WbExpQkJiaUJoWkdScGRHbHZibUZzSUdkeVlXNTBYRzRnS2lCdlppQndZWFJsYm5RZ2NtbG5hSFJ6SUdOaGJpQmlaU0JtYjNWdVpDQnBiaUIwYUdVZ1VFRlVSVTVVVXlCbWFXeGxJR2x1SUhSb1pTQnpZVzFsSUdScGNtVmpkRzl5ZVM1Y2JpQXFYRzRnS2lCY2JpQXFMMXh1WEc0bmRYTmxJSE4wY21samRDYzdYRzVjYmk4cUtseHVJQ29nUlhOallYQmxJR0Z1WkNCM2NtRndJR3RsZVNCemJ5QnBkQ0JwY3lCellXWmxJSFJ2SUhWelpTQmhjeUJoSUhKbFlXTjBhV1JjYmlBcVhHNGdLaUJBY0dGeVlXMGdlM04wY21sdVozMGdhMlY1SUhSdklHSmxJR1Z6WTJGd1pXUXVYRzRnS2lCQWNtVjBkWEp1SUh0emRISnBibWQ5SUhSb1pTQmxjMk5oY0dWa0lHdGxlUzVjYmlBcUwxeHVYRzVtZFc1amRHbHZiaUJsYzJOaGNHVW9hMlY1S1NCN1hHNGdJSFpoY2lCbGMyTmhjR1ZTWldkbGVDQTlJQzliUFRwZEwyYzdYRzRnSUhaaGNpQmxjMk5oY0dWeVRHOXZhM1Z3SUQwZ2UxeHVJQ0FnSUNjOUp6b2dKejB3Snl4Y2JpQWdJQ0FuT2ljNklDYzlNaWRjYmlBZ2ZUdGNiaUFnZG1GeUlHVnpZMkZ3WldSVGRISnBibWNnUFNBb0p5Y2dLeUJyWlhrcExuSmxjR3hoWTJVb1pYTmpZWEJsVW1WblpYZ3NJR1oxYm1OMGFXOXVJQ2h0WVhSamFDa2dlMXh1SUNBZ0lISmxkSFZ5YmlCbGMyTmhjR1Z5VEc5dmEzVndXMjFoZEdOb1hUdGNiaUFnZlNrN1hHNWNiaUFnY21WMGRYSnVJQ2NrSnlBcklHVnpZMkZ3WldSVGRISnBibWM3WEc1OVhHNWNiaThxS2x4dUlDb2dWVzVsYzJOaGNHVWdZVzVrSUhWdWQzSmhjQ0JyWlhrZ1ptOXlJR2gxYldGdUxYSmxZV1JoWW14bElHUnBjM0JzWVhsY2JpQXFYRzRnS2lCQWNHRnlZVzBnZTNOMGNtbHVaMzBnYTJWNUlIUnZJSFZ1WlhOallYQmxMbHh1SUNvZ1FISmxkSFZ5YmlCN2MzUnlhVzVuZlNCMGFHVWdkVzVsYzJOaGNHVmtJR3RsZVM1Y2JpQXFMMXh1Wm5WdVkzUnBiMjRnZFc1bGMyTmhjR1VvYTJWNUtTQjdYRzRnSUhaaGNpQjFibVZ6WTJGd1pWSmxaMlY0SUQwZ0x5ZzlNSHc5TWlrdlp6dGNiaUFnZG1GeUlIVnVaWE5qWVhCbGNreHZiMnQxY0NBOUlIdGNiaUFnSUNBblBUQW5PaUFuUFNjc1hHNGdJQ0FnSnoweUp6b2dKem9uWEc0Z0lIMDdYRzRnSUhaaGNpQnJaWGxUZFdKemRISnBibWNnUFNCclpYbGJNRjBnUFQwOUlDY3VKeUFtSmlCclpYbGJNVjBnUFQwOUlDY2tKeUEvSUd0bGVTNXpkV0p6ZEhKcGJtY29NaWtnT2lCclpYa3VjM1ZpYzNSeWFXNW5LREVwTzF4dVhHNGdJSEpsZEhWeWJpQW9KeWNnS3lCclpYbFRkV0p6ZEhKcGJtY3BMbkpsY0d4aFkyVW9kVzVsYzJOaGNHVlNaV2RsZUN3Z1puVnVZM1JwYjI0Z0tHMWhkR05vS1NCN1hHNGdJQ0FnY21WMGRYSnVJSFZ1WlhOallYQmxja3h2YjJ0MWNGdHRZWFJqYUYwN1hHNGdJSDBwTzF4dWZWeHVYRzUyWVhJZ1MyVjVSWE5qWVhCbFZYUnBiSE1nUFNCN1hHNGdJR1Z6WTJGd1pUb2daWE5qWVhCbExGeHVJQ0IxYm1WelkyRndaVG9nZFc1bGMyTmhjR1ZjYm4wN1hHNWNibTF2WkhWc1pTNWxlSEJ2Y25SeklEMGdTMlY1UlhOallYQmxWWFJwYkhNN0lpd2lMeW9xWEc0Z0tpQkRiM0I1Y21sbmFIUWdNakF4TXkxd2NtVnpaVzUwTENCR1lXTmxZbTl2YXl3Z1NXNWpMbHh1SUNvZ1FXeHNJSEpwWjJoMGN5QnlaWE5sY25abFpDNWNiaUFxWEc0Z0tpQlVhR2x6SUhOdmRYSmpaU0JqYjJSbElHbHpJR3hwWTJWdWMyVmtJSFZ1WkdWeUlIUm9aU0JDVTBRdGMzUjViR1VnYkdsalpXNXpaU0JtYjNWdVpDQnBiaUIwYUdWY2JpQXFJRXhKUTBWT1UwVWdabWxzWlNCcGJpQjBhR1VnY205dmRDQmthWEpsWTNSdmNua2diMllnZEdocGN5QnpiM1Z5WTJVZ2RISmxaUzRnUVc0Z1lXUmthWFJwYjI1aGJDQm5jbUZ1ZEZ4dUlDb2diMllnY0dGMFpXNTBJSEpwWjJoMGN5QmpZVzRnWW1VZ1ptOTFibVFnYVc0Z2RHaGxJRkJCVkVWT1ZGTWdabWxzWlNCcGJpQjBhR1VnYzJGdFpTQmthWEpsWTNSdmNua3VYRzRnS2x4dUlDb2dYRzRnS2k5Y2JseHVKM1Z6WlNCemRISnBZM1FuTzF4dVhHNTJZWElnWDNCeWIyUkpiblpoY21saGJuUWdQU0J5WlhGMWFYSmxLQ2N1TDNKbFlXTjBVSEp2WkVsdWRtRnlhV0Z1ZENjcE8xeHVYRzUyWVhJZ2FXNTJZWEpwWVc1MElEMGdjbVZ4ZFdseVpTZ25abUpxY3k5c2FXSXZhVzUyWVhKcFlXNTBKeWs3WEc1Y2JpOHFLbHh1SUNvZ1UzUmhkR2xqSUhCdmIyeGxjbk11SUZObGRtVnlZV3dnWTNWemRHOXRJSFpsY25OcGIyNXpJR1p2Y2lCbFlXTm9JSEJ2ZEdWdWRHbGhiQ0J1ZFcxaVpYSWdiMlpjYmlBcUlHRnlaM1Z0Wlc1MGN5NGdRU0JqYjIxd2JHVjBaV3g1SUdkbGJtVnlhV01nY0c5dmJHVnlJR2x6SUdWaGMza2dkRzhnYVcxd2JHVnRaVzUwTENCaWRYUWdkMjkxYkdSY2JpQXFJSEpsY1hWcGNtVWdZV05qWlhOemFXNW5JSFJvWlNCZ1lYSm5kVzFsYm5SellDQnZZbXBsWTNRdUlFbHVJR1ZoWTJnZ2IyWWdkR2hsYzJVc0lHQjBhR2x6WUNCeVpXWmxjbk1nZEc5Y2JpQXFJSFJvWlNCRGJHRnpjeUJwZEhObGJHWXNJRzV2ZENCaGJpQnBibk4wWVc1alpTNGdTV1lnWVc1NUlHOTBhR1Z5Y3lCaGNtVWdibVZsWkdWa0xDQnphVzF3YkhrZ1lXUmtJSFJvWlcxY2JpQXFJR2hsY21Vc0lHOXlJR2x1SUhSb1pXbHlJRzkzYmlCbWFXeGxjeTVjYmlBcUwxeHVkbUZ5SUc5dVpVRnlaM1Z0Wlc1MFVHOXZiR1Z5SUQwZ1puVnVZM1JwYjI0Z0tHTnZjSGxHYVdWc1pITkdjbTl0S1NCN1hHNGdJSFpoY2lCTGJHRnpjeUE5SUhSb2FYTTdYRzRnSUdsbUlDaExiR0Z6Y3k1cGJuTjBZVzVqWlZCdmIyd3ViR1Z1WjNSb0tTQjdYRzRnSUNBZ2RtRnlJR2x1YzNSaGJtTmxJRDBnUzJ4aGMzTXVhVzV6ZEdGdVkyVlFiMjlzTG5CdmNDZ3BPMXh1SUNBZ0lFdHNZWE56TG1OaGJHd29hVzV6ZEdGdVkyVXNJR052Y0hsR2FXVnNaSE5HY205dEtUdGNiaUFnSUNCeVpYUjFjbTRnYVc1emRHRnVZMlU3WEc0Z0lIMGdaV3h6WlNCN1hHNGdJQ0FnY21WMGRYSnVJRzVsZHlCTGJHRnpjeWhqYjNCNVJtbGxiR1J6Um5KdmJTazdYRzRnSUgxY2JuMDdYRzVjYm5aaGNpQjBkMjlCY21kMWJXVnVkRkJ2YjJ4bGNpQTlJR1oxYm1OMGFXOXVJQ2hoTVN3Z1lUSXBJSHRjYmlBZ2RtRnlJRXRzWVhOeklEMGdkR2hwY3p0Y2JpQWdhV1lnS0V0c1lYTnpMbWx1YzNSaGJtTmxVRzl2YkM1c1pXNW5kR2dwSUh0Y2JpQWdJQ0IyWVhJZ2FXNXpkR0Z1WTJVZ1BTQkxiR0Z6Y3k1cGJuTjBZVzVqWlZCdmIyd3VjRzl3S0NrN1hHNGdJQ0FnUzJ4aGMzTXVZMkZzYkNocGJuTjBZVzVqWlN3Z1lURXNJR0V5S1R0Y2JpQWdJQ0J5WlhSMWNtNGdhVzV6ZEdGdVkyVTdYRzRnSUgwZ1pXeHpaU0I3WEc0Z0lDQWdjbVYwZFhKdUlHNWxkeUJMYkdGemN5aGhNU3dnWVRJcE8xeHVJQ0I5WEc1OU8xeHVYRzUyWVhJZ2RHaHlaV1ZCY21kMWJXVnVkRkJ2YjJ4bGNpQTlJR1oxYm1OMGFXOXVJQ2hoTVN3Z1lUSXNJR0V6S1NCN1hHNGdJSFpoY2lCTGJHRnpjeUE5SUhSb2FYTTdYRzRnSUdsbUlDaExiR0Z6Y3k1cGJuTjBZVzVqWlZCdmIyd3ViR1Z1WjNSb0tTQjdYRzRnSUNBZ2RtRnlJR2x1YzNSaGJtTmxJRDBnUzJ4aGMzTXVhVzV6ZEdGdVkyVlFiMjlzTG5CdmNDZ3BPMXh1SUNBZ0lFdHNZWE56TG1OaGJHd29hVzV6ZEdGdVkyVXNJR0V4TENCaE1pd2dZVE1wTzF4dUlDQWdJSEpsZEhWeWJpQnBibk4wWVc1alpUdGNiaUFnZlNCbGJITmxJSHRjYmlBZ0lDQnlaWFIxY200Z2JtVjNJRXRzWVhOektHRXhMQ0JoTWl3Z1lUTXBPMXh1SUNCOVhHNTlPMXh1WEc1MllYSWdabTkxY2tGeVozVnRaVzUwVUc5dmJHVnlJRDBnWm5WdVkzUnBiMjRnS0dFeExDQmhNaXdnWVRNc0lHRTBLU0I3WEc0Z0lIWmhjaUJMYkdGemN5QTlJSFJvYVhNN1hHNGdJR2xtSUNoTGJHRnpjeTVwYm5OMFlXNWpaVkJ2YjJ3dWJHVnVaM1JvS1NCN1hHNGdJQ0FnZG1GeUlHbHVjM1JoYm1ObElEMGdTMnhoYzNNdWFXNXpkR0Z1WTJWUWIyOXNMbkJ2Y0NncE8xeHVJQ0FnSUV0c1lYTnpMbU5oYkd3b2FXNXpkR0Z1WTJVc0lHRXhMQ0JoTWl3Z1lUTXNJR0UwS1R0Y2JpQWdJQ0J5WlhSMWNtNGdhVzV6ZEdGdVkyVTdYRzRnSUgwZ1pXeHpaU0I3WEc0Z0lDQWdjbVYwZFhKdUlHNWxkeUJMYkdGemN5aGhNU3dnWVRJc0lHRXpMQ0JoTkNrN1hHNGdJSDFjYm4wN1hHNWNiblpoY2lCemRHRnVaR0Z5WkZKbGJHVmhjMlZ5SUQwZ1puVnVZM1JwYjI0Z0tHbHVjM1JoYm1ObEtTQjdYRzRnSUhaaGNpQkxiR0Z6Y3lBOUlIUm9hWE03WEc0Z0lDRW9hVzV6ZEdGdVkyVWdhVzV6ZEdGdVkyVnZaaUJMYkdGemN5a2dQeUJ3Y205alpYTnpMbVZ1ZGk1T1QwUkZYMFZPVmlBaFBUMGdKM0J5YjJSMVkzUnBiMjRuSUQ4Z2FXNTJZWEpwWVc1MEtHWmhiSE5sTENBblZISjVhVzVuSUhSdklISmxiR1ZoYzJVZ1lXNGdhVzV6ZEdGdVkyVWdhVzUwYnlCaElIQnZiMndnYjJZZ1lTQmthV1ptWlhKbGJuUWdkSGx3WlM0bktTQTZJRjl3Y205a1NXNTJZWEpwWVc1MEtDY3lOU2NwSURvZ2RtOXBaQ0F3TzF4dUlDQnBibk4wWVc1alpTNWtaWE4wY25WamRHOXlLQ2s3WEc0Z0lHbG1JQ2hMYkdGemN5NXBibk4wWVc1alpWQnZiMnd1YkdWdVozUm9JRHdnUzJ4aGMzTXVjRzl2YkZOcGVtVXBJSHRjYmlBZ0lDQkxiR0Z6Y3k1cGJuTjBZVzVqWlZCdmIyd3VjSFZ6YUNocGJuTjBZVzVqWlNrN1hHNGdJSDFjYm4wN1hHNWNiblpoY2lCRVJVWkJWVXhVWDFCUFQweGZVMGxhUlNBOUlERXdPMXh1ZG1GeUlFUkZSa0ZWVEZSZlVFOVBURVZTSUQwZ2IyNWxRWEpuZFcxbGJuUlFiMjlzWlhJN1hHNWNiaThxS2x4dUlDb2dRWFZuYldWdWRITWdZRU52Y0hsRGIyNXpkSEoxWTNSdmNtQWdkRzhnWW1VZ1lTQndiMjlzWVdKc1pTQmpiR0Z6Y3l3Z1lYVm5iV1Z1ZEdsdVp5QnZibXg1SUhSb1pTQmpiR0Z6YzF4dUlDb2dhWFJ6Wld4bUlDaHpkR0YwYVdOaGJHeDVLU0J1YjNRZ1lXUmthVzVuSUdGdWVTQndjbTkwYjNSNWNHbGpZV3dnWm1sbGJHUnpMaUJCYm5rZ1EyOXdlVU52Ym5OMGNuVmpkRzl5WEc0Z0tpQjViM1VnWjJsMlpTQjBhR2x6SUcxaGVTQm9ZWFpsSUdFZ1lIQnZiMnhUYVhwbFlDQndjbTl3WlhKMGVTd2dZVzVrSUhkcGJHd2diRzl2YXlCbWIzSWdZVnh1SUNvZ2NISnZkRzkwZVhCcFkyRnNJR0JrWlhOMGNuVmpkRzl5WUNCdmJpQnBibk4wWVc1alpYTXVYRzRnS2x4dUlDb2dRSEJoY21GdElIdEdkVzVqZEdsdmJuMGdRMjl3ZVVOdmJuTjBjblZqZEc5eUlFTnZibk4wY25WamRHOXlJSFJvWVhRZ1kyRnVJR0psSUhWelpXUWdkRzhnY21WelpYUXVYRzRnS2lCQWNHRnlZVzBnZTBaMWJtTjBhVzl1ZlNCd2IyOXNaWElnUTNWemRHOXRhWHBoWW14bElIQnZiMnhsY2k1Y2JpQXFMMXh1ZG1GeUlHRmtaRkJ2YjJ4cGJtZFVieUE5SUdaMWJtTjBhVzl1SUNoRGIzQjVRMjl1YzNSeWRXTjBiM0lzSUhCdmIyeGxjaWtnZTF4dUlDQXZMeUJEWVhOMGFXNW5JR0Z6SUdGdWVTQnpieUIwYUdGMElHWnNiM2NnYVdkdWIzSmxjeUIwYUdVZ1lXTjBkV0ZzSUdsdGNHeGxiV1Z1ZEdGMGFXOXVJR0Z1WkNCMGNuVnpkSE5jYmlBZ0x5OGdhWFFnZEc4Z2JXRjBZMmdnZEdobElIUjVjR1VnZDJVZ1pHVmpiR0Z5WldSY2JpQWdkbUZ5SUU1bGQwdHNZWE56SUQwZ1EyOXdlVU52Ym5OMGNuVmpkRzl5TzF4dUlDQk9aWGRMYkdGemN5NXBibk4wWVc1alpWQnZiMndnUFNCYlhUdGNiaUFnVG1WM1MyeGhjM011WjJWMFVHOXZiR1ZrSUQwZ2NHOXZiR1Z5SUh4OElFUkZSa0ZWVEZSZlVFOVBURVZTTzF4dUlDQnBaaUFvSVU1bGQwdHNZWE56TG5CdmIyeFRhWHBsS1NCN1hHNGdJQ0FnVG1WM1MyeGhjM011Y0c5dmJGTnBlbVVnUFNCRVJVWkJWVXhVWDFCUFQweGZVMGxhUlR0Y2JpQWdmVnh1SUNCT1pYZExiR0Z6Y3k1eVpXeGxZWE5sSUQwZ2MzUmhibVJoY21SU1pXeGxZWE5sY2p0Y2JpQWdjbVYwZFhKdUlFNWxkMHRzWVhOek8xeHVmVHRjYmx4dWRtRnlJRkJ2YjJ4bFpFTnNZWE56SUQwZ2UxeHVJQ0JoWkdSUWIyOXNhVzVuVkc4NklHRmtaRkJ2YjJ4cGJtZFVieXhjYmlBZ2IyNWxRWEpuZFcxbGJuUlFiMjlzWlhJNklHOXVaVUZ5WjNWdFpXNTBVRzl2YkdWeUxGeHVJQ0IwZDI5QmNtZDFiV1Z1ZEZCdmIyeGxjam9nZEhkdlFYSm5kVzFsYm5SUWIyOXNaWElzWEc0Z0lIUm9jbVZsUVhKbmRXMWxiblJRYjI5c1pYSTZJSFJvY21WbFFYSm5kVzFsYm5SUWIyOXNaWElzWEc0Z0lHWnZkWEpCY21kMWJXVnVkRkJ2YjJ4bGNqb2dabTkxY2tGeVozVnRaVzUwVUc5dmJHVnlYRzU5TzF4dVhHNXRiMlIxYkdVdVpYaHdiM0owY3lBOUlGQnZiMnhsWkVOc1lYTnpPeUlzSWk4cUtseHVJQ29nUTI5d2VYSnBaMmgwSURJd01UTXRjSEpsYzJWdWRDd2dSbUZqWldKdmIyc3NJRWx1WXk1Y2JpQXFJRUZzYkNCeWFXZG9kSE1nY21WelpYSjJaV1F1WEc0Z0tseHVJQ29nVkdocGN5QnpiM1Z5WTJVZ1kyOWtaU0JwY3lCc2FXTmxibk5sWkNCMWJtUmxjaUIwYUdVZ1FsTkVMWE4wZVd4bElHeHBZMlZ1YzJVZ1ptOTFibVFnYVc0Z2RHaGxYRzRnS2lCTVNVTkZUbE5GSUdacGJHVWdhVzRnZEdobElISnZiM1FnWkdseVpXTjBiM0o1SUc5bUlIUm9hWE1nYzI5MWNtTmxJSFJ5WldVdUlFRnVJR0ZrWkdsMGFXOXVZV3dnWjNKaGJuUmNiaUFxSUc5bUlIQmhkR1Z1ZENCeWFXZG9kSE1nWTJGdUlHSmxJR1p2ZFc1a0lHbHVJSFJvWlNCUVFWUkZUbFJUSUdacGJHVWdhVzRnZEdobElITmhiV1VnWkdseVpXTjBiM0o1TGx4dUlDcGNiaUFxTDF4dVhHNG5kWE5sSUhOMGNtbGpkQ2M3WEc1Y2JuWmhjaUJmWVhOemFXZHVJRDBnY21WeGRXbHlaU2duYjJKcVpXTjBMV0Z6YzJsbmJpY3BPMXh1WEc1MllYSWdVbVZoWTNSQ1lYTmxRMnhoYzNObGN5QTlJSEpsY1hWcGNtVW9KeTR2VW1WaFkzUkNZWE5sUTJ4aGMzTmxjeWNwTzF4dWRtRnlJRkpsWVdOMFEyaHBiR1J5Wlc0Z1BTQnlaWEYxYVhKbEtDY3VMMUpsWVdOMFEyaHBiR1J5Wlc0bktUdGNiblpoY2lCU1pXRmpkRVJQVFVaaFkzUnZjbWxsY3lBOUlISmxjWFZwY21Vb0p5NHZVbVZoWTNSRVQwMUdZV04wYjNKcFpYTW5LVHRjYm5aaGNpQlNaV0ZqZEVWc1pXMWxiblFnUFNCeVpYRjFhWEpsS0NjdUwxSmxZV04wUld4bGJXVnVkQ2NwTzF4dWRtRnlJRkpsWVdOMFVISnZjRlI1Y0dWeklEMGdjbVZ4ZFdseVpTZ25MaTlTWldGamRGQnliM0JVZVhCbGN5Y3BPMXh1ZG1GeUlGSmxZV04wVm1WeWMybHZiaUE5SUhKbGNYVnBjbVVvSnk0dlVtVmhZM1JXWlhKemFXOXVKeWs3WEc1Y2JuWmhjaUJqY21WaGRHVlNaV0ZqZEVOc1lYTnpJRDBnY21WeGRXbHlaU2duTGk5amNtVmhkR1ZEYkdGemN5Y3BPMXh1ZG1GeUlHOXViSGxEYUdsc1pDQTlJSEpsY1hWcGNtVW9KeTR2YjI1c2VVTm9hV3hrSnlrN1hHNWNiblpoY2lCamNtVmhkR1ZGYkdWdFpXNTBJRDBnVW1WaFkzUkZiR1Z0Wlc1MExtTnlaV0YwWlVWc1pXMWxiblE3WEc1MllYSWdZM0psWVhSbFJtRmpkRzl5ZVNBOUlGSmxZV04wUld4bGJXVnVkQzVqY21WaGRHVkdZV04wYjNKNU8xeHVkbUZ5SUdOc2IyNWxSV3hsYldWdWRDQTlJRkpsWVdOMFJXeGxiV1Z1ZEM1amJHOXVaVVZzWlcxbGJuUTdYRzVjYm1sbUlDaHdjbTlqWlhOekxtVnVkaTVPVDBSRlgwVk9WaUFoUFQwZ0ozQnliMlIxWTNScGIyNG5LU0I3WEc0Z0lIWmhjaUJzYjNkUWNtbHZjbWwwZVZkaGNtNXBibWNnUFNCeVpYRjFhWEpsS0NjdUwyeHZkMUJ5YVc5eWFYUjVWMkZ5Ym1sdVp5Y3BPMXh1SUNCMllYSWdZMkZ1UkdWbWFXNWxVSEp2Y0dWeWRIa2dQU0J5WlhGMWFYSmxLQ2N1TDJOaGJrUmxabWx1WlZCeWIzQmxjblI1SnlrN1hHNGdJSFpoY2lCU1pXRmpkRVZzWlcxbGJuUldZV3hwWkdGMGIzSWdQU0J5WlhGMWFYSmxLQ2N1TDFKbFlXTjBSV3hsYldWdWRGWmhiR2xrWVhSdmNpY3BPMXh1SUNCMllYSWdaR2xrVjJGeWJsQnliM0JVZVhCbGMwUmxjSEpsWTJGMFpXUWdQU0JtWVd4elpUdGNiaUFnWTNKbFlYUmxSV3hsYldWdWRDQTlJRkpsWVdOMFJXeGxiV1Z1ZEZaaGJHbGtZWFJ2Y2k1amNtVmhkR1ZGYkdWdFpXNTBPMXh1SUNCamNtVmhkR1ZHWVdOMGIzSjVJRDBnVW1WaFkzUkZiR1Z0Wlc1MFZtRnNhV1JoZEc5eUxtTnlaV0YwWlVaaFkzUnZjbms3WEc0Z0lHTnNiMjVsUld4bGJXVnVkQ0E5SUZKbFlXTjBSV3hsYldWdWRGWmhiR2xrWVhSdmNpNWpiRzl1WlVWc1pXMWxiblE3WEc1OVhHNWNiblpoY2lCZlgzTndjbVZoWkNBOUlGOWhjM05wWjI0N1hHNTJZWElnWTNKbFlYUmxUV2w0YVc0Z1BTQm1kVzVqZEdsdmJpQW9iV2w0YVc0cElIdGNiaUFnY21WMGRYSnVJRzFwZUdsdU8xeHVmVHRjYmx4dWFXWWdLSEJ5YjJObGMzTXVaVzUyTGs1UFJFVmZSVTVXSUNFOVBTQW5jSEp2WkhWamRHbHZiaWNwSUh0Y2JpQWdkbUZ5SUhkaGNtNWxaRVp2Y2xOd2NtVmhaQ0E5SUdaaGJITmxPMXh1SUNCMllYSWdkMkZ5Ym1Wa1JtOXlRM0psWVhSbFRXbDRhVzRnUFNCbVlXeHpaVHRjYmlBZ1gxOXpjSEpsWVdRZ1BTQm1kVzVqZEdsdmJpQW9LU0I3WEc0Z0lDQWdiRzkzVUhKcGIzSnBkSGxYWVhKdWFXNW5LSGRoY201bFpFWnZjbE53Y21WaFpDd2dKMUpsWVdOMExsOWZjM0J5WldGa0lHbHpJR1JsY0hKbFkyRjBaV1FnWVc1a0lITm9iM1ZzWkNCdWIzUWdZbVVnZFhObFpDNGdWWE5sSUNjZ0t5QW5UMkpxWldOMExtRnpjMmxuYmlCa2FYSmxZM1JzZVNCdmNpQmhibTkwYUdWeUlHaGxiSEJsY2lCbWRXNWpkR2x2YmlCM2FYUm9JSE5wYldsc1lYSWdKeUFySUNkelpXMWhiblJwWTNNdUlGbHZkU0J0WVhrZ1ltVWdjMlZsYVc1bklIUm9hWE1nZDJGeWJtbHVaeUJrZFdVZ2RHOGdlVzkxY2lCamIyMXdhV3hsY2k0Z0p5QXJJQ2RUWldVZ2FIUjBjSE02THk5bVlpNXRaUzl5WldGamRDMXpjSEpsWVdRdFpHVndjbVZqWVhScGIyNGdabTl5SUcxdmNtVWdaR1YwWVdsc2N5NG5LVHRjYmlBZ0lDQjNZWEp1WldSR2IzSlRjSEpsWVdRZ1BTQjBjblZsTzF4dUlDQWdJSEpsZEhWeWJpQmZZWE56YVdkdUxtRndjR3g1S0c1MWJHd3NJR0Z5WjNWdFpXNTBjeWs3WEc0Z0lIMDdYRzVjYmlBZ1kzSmxZWFJsVFdsNGFXNGdQU0JtZFc1amRHbHZiaUFvYldsNGFXNHBJSHRjYmlBZ0lDQnNiM2RRY21sdmNtbDBlVmRoY201cGJtY29kMkZ5Ym1Wa1JtOXlRM0psWVhSbFRXbDRhVzRzSUNkU1pXRmpkQzVqY21WaGRHVk5hWGhwYmlCcGN5QmtaWEJ5WldOaGRHVmtJR0Z1WkNCemFHOTFiR1FnYm05MElHSmxJSFZ6WldRdUlDY2dLeUFuU1c0Z1VtVmhZM1FnZGpFMkxqQXNJR2wwSUhkcGJHd2dZbVVnY21WdGIzWmxaQzRnSnlBcklDZFpiM1VnWTJGdUlIVnpaU0IwYUdseklHMXBlR2x1SUdScGNtVmpkR3g1SUdsdWMzUmxZV1F1SUNjZ0t5QW5VMlZsSUdoMGRIQnpPaTh2Wm1JdWJXVXZZM0psWVhSbGJXbDRhVzR0ZDJGekxXNWxkbVZ5TFdsdGNHeGxiV1Z1ZEdWa0lHWnZjaUJ0YjNKbElHbHVabTh1SnlrN1hHNGdJQ0FnZDJGeWJtVmtSbTl5UTNKbFlYUmxUV2w0YVc0Z1BTQjBjblZsTzF4dUlDQWdJSEpsZEhWeWJpQnRhWGhwYmp0Y2JpQWdmVHRjYm4xY2JseHVkbUZ5SUZKbFlXTjBJRDBnZTF4dUlDQXZMeUJOYjJSbGNtNWNibHh1SUNCRGFHbHNaSEpsYmpvZ2UxeHVJQ0FnSUcxaGNEb2dVbVZoWTNSRGFHbHNaSEpsYmk1dFlYQXNYRzRnSUNBZ1ptOXlSV0ZqYURvZ1VtVmhZM1JEYUdsc1pISmxiaTVtYjNKRllXTm9MRnh1SUNBZ0lHTnZkVzUwT2lCU1pXRmpkRU5vYVd4a2NtVnVMbU52ZFc1MExGeHVJQ0FnSUhSdlFYSnlZWGs2SUZKbFlXTjBRMmhwYkdSeVpXNHVkRzlCY25KaGVTeGNiaUFnSUNCdmJteDVPaUJ2Ym14NVEyaHBiR1JjYmlBZ2ZTeGNibHh1SUNCRGIyMXdiMjVsYm5RNklGSmxZV04wUW1GelpVTnNZWE56WlhNdVEyOXRjRzl1Wlc1MExGeHVJQ0JRZFhKbFEyOXRjRzl1Wlc1ME9pQlNaV0ZqZEVKaGMyVkRiR0Z6YzJWekxsQjFjbVZEYjIxd2IyNWxiblFzWEc1Y2JpQWdZM0psWVhSbFJXeGxiV1Z1ZERvZ1kzSmxZWFJsUld4bGJXVnVkQ3hjYmlBZ1kyeHZibVZGYkdWdFpXNTBPaUJqYkc5dVpVVnNaVzFsYm5Rc1hHNGdJR2x6Vm1Gc2FXUkZiR1Z0Wlc1ME9pQlNaV0ZqZEVWc1pXMWxiblF1YVhOV1lXeHBaRVZzWlcxbGJuUXNYRzVjYmlBZ0x5OGdRMnhoYzNOcFkxeHVYRzRnSUZCeWIzQlVlWEJsY3pvZ1VtVmhZM1JRY205d1ZIbHdaWE1zWEc0Z0lHTnlaV0YwWlVOc1lYTnpPaUJqY21WaGRHVlNaV0ZqZEVOc1lYTnpMRnh1SUNCamNtVmhkR1ZHWVdOMGIzSjVPaUJqY21WaGRHVkdZV04wYjNKNUxGeHVJQ0JqY21WaGRHVk5hWGhwYmpvZ1kzSmxZWFJsVFdsNGFXNHNYRzVjYmlBZ0x5OGdWR2hwY3lCc2IyOXJjeUJFVDAwZ2MzQmxZMmxtYVdNZ1luVjBJSFJvWlhObElHRnlaU0JoWTNSMVlXeHNlU0JwYzI5dGIzSndhR2xqSUdobGJIQmxjbk5jYmlBZ0x5OGdjMmx1WTJVZ2RHaGxlU0JoY21VZ2FuVnpkQ0JuWlc1bGNtRjBhVzVuSUVSUFRTQnpkSEpwYm1kekxseHVJQ0JFVDAwNklGSmxZV04wUkU5TlJtRmpkRzl5YVdWekxGeHVYRzRnSUhabGNuTnBiMjQ2SUZKbFlXTjBWbVZ5YzJsdmJpeGNibHh1SUNBdkx5QkVaWEJ5WldOaGRHVmtJR2h2YjJzZ1ptOXlJRXBUV0NCemNISmxZV1FzSUdSdmJpZDBJSFZ6WlNCMGFHbHpJR1p2Y2lCaGJubDBhR2x1Wnk1Y2JpQWdYMTl6Y0hKbFlXUTZJRjlmYzNCeVpXRmtYRzU5TzF4dVhHNXBaaUFvY0hKdlkyVnpjeTVsYm5ZdVRrOUVSVjlGVGxZZ0lUMDlJQ2R3Y205a2RXTjBhVzl1SnlrZ2UxeHVJQ0IyWVhJZ2QyRnlibVZrUm05eVEzSmxZWFJsUTJ4aGMzTWdQU0JtWVd4elpUdGNiaUFnYVdZZ0tHTmhia1JsWm1sdVpWQnliM0JsY25SNUtTQjdYRzRnSUNBZ1QySnFaV04wTG1SbFptbHVaVkJ5YjNCbGNuUjVLRkpsWVdOMExDQW5VSEp2Y0ZSNWNHVnpKeXdnZTF4dUlDQWdJQ0FnWjJWME9pQm1kVzVqZEdsdmJpQW9LU0I3WEc0Z0lDQWdJQ0FnSUd4dmQxQnlhVzl5YVhSNVYyRnlibWx1Wnloa2FXUlhZWEp1VUhKdmNGUjVjR1Z6UkdWd2NtVmpZWFJsWkN3Z0owRmpZMlZ6YzJsdVp5QlFjbTl3Vkhsd1pYTWdkbWxoSUhSb1pTQnRZV2x1SUZKbFlXTjBJSEJoWTJ0aFoyVWdhWE1nWkdWd2NtVmpZWFJsWkN3bklDc2dKeUJoYm1RZ2QybHNiQ0JpWlNCeVpXMXZkbVZrSUdsdUlDQlNaV0ZqZENCMk1UWXVNQzRuSUNzZ0p5QlZjMlVnZEdobElHeGhkR1Z6ZENCaGRtRnBiR0ZpYkdVZ2RqRTFMaW9nY0hKdmNDMTBlWEJsY3lCd1lXTnJZV2RsSUdaeWIyMGdibkJ0SUdsdWMzUmxZV1F1SnlBcklDY2dSbTl5SUdsdVptOGdiMjRnZFhOaFoyVXNJR052YlhCaGRHbGlhV3hwZEhrc0lHMXBaM0poZEdsdmJpQmhibVFnYlc5eVpTd2djMlZsSUNjZ0t5QW5hSFIwY0hNNkx5OW1ZaTV0WlM5d2NtOXdMWFI1Y0dWekxXUnZZM01uS1R0Y2JpQWdJQ0FnSUNBZ1pHbGtWMkZ5YmxCeWIzQlVlWEJsYzBSbGNISmxZMkYwWldRZ1BTQjBjblZsTzF4dUlDQWdJQ0FnSUNCeVpYUjFjbTRnVW1WaFkzUlFjbTl3Vkhsd1pYTTdYRzRnSUNBZ0lDQjlYRzRnSUNBZ2ZTazdYRzVjYmlBZ0lDQlBZbXBsWTNRdVpHVm1hVzVsVUhKdmNHVnlkSGtvVW1WaFkzUXNJQ2RqY21WaGRHVkRiR0Z6Y3ljc0lIdGNiaUFnSUNBZ0lHZGxkRG9nWm5WdVkzUnBiMjRnS0NrZ2UxeHVJQ0FnSUNBZ0lDQnNiM2RRY21sdmNtbDBlVmRoY201cGJtY29kMkZ5Ym1Wa1JtOXlRM0psWVhSbFEyeGhjM01zSUNkQlkyTmxjM05wYm1jZ1kzSmxZWFJsUTJ4aGMzTWdkbWxoSUhSb1pTQnRZV2x1SUZKbFlXTjBJSEJoWTJ0aFoyVWdhWE1nWkdWd2NtVmpZWFJsWkN3bklDc2dKeUJoYm1RZ2QybHNiQ0JpWlNCeVpXMXZkbVZrSUdsdUlGSmxZV04wSUhZeE5pNHdMaWNnS3lCY0lpQlZjMlVnWVNCd2JHRnBiaUJLWVhaaFUyTnlhWEIwSUdOc1lYTnpJR2x1YzNSbFlXUXVJRWxtSUhsdmRTZHlaU0J1YjNRZ2VXVjBJRndpSUNzZ0ozSmxZV1I1SUhSdklHMXBaM0poZEdVc0lHTnlaV0YwWlMxeVpXRmpkQzFqYkdGemN5QjJNVFV1S2lCcGN5QmhkbUZwYkdGaWJHVWdKeUFySUNkdmJpQnVjRzBnWVhNZ1lTQjBaVzF3YjNKaGNua3NJR1J5YjNBdGFXNGdjbVZ3YkdGalpXMWxiblF1SUNjZ0t5QW5SbTl5SUcxdmNtVWdhVzVtYnlCelpXVWdhSFIwY0hNNkx5OW1ZaTV0WlM5eVpXRmpkQzFqY21WaGRHVXRZMnhoYzNNbktUdGNiaUFnSUNBZ0lDQWdkMkZ5Ym1Wa1JtOXlRM0psWVhSbFEyeGhjM01nUFNCMGNuVmxPMXh1SUNBZ0lDQWdJQ0J5WlhSMWNtNGdZM0psWVhSbFVtVmhZM1JEYkdGemN6dGNiaUFnSUNBZ0lIMWNiaUFnSUNCOUtUdGNiaUFnZlZ4dVhHNGdJQzh2SUZKbFlXTjBMa1JQVFNCbVlXTjBiM0pwWlhNZ1lYSmxJR1JsY0hKbFkyRjBaV1F1SUZkeVlYQWdkR2hsYzJVZ2JXVjBhRzlrY3lCemJ5QjBhR0YwWEc0Z0lDOHZJR2x1ZG05allYUnBiMjV6SUc5bUlIUm9aU0JTWldGamRDNUVUMDBnYm1GdFpYTndZV05sSUdGdVpDQmhiR1Z5ZENCMWMyVnljeUIwYnlCemQybDBZMmhjYmlBZ0x5OGdkRzhnZEdobElHQnlaV0ZqZEMxa2IyMHRabUZqZEc5eWFXVnpZQ0J3WVdOcllXZGxMbHh1SUNCU1pXRmpkQzVFVDAwZ1BTQjdmVHRjYmlBZ2RtRnlJSGRoY201bFpFWnZja1poWTNSdmNtbGxjeUE5SUdaaGJITmxPMXh1SUNCUFltcGxZM1F1YTJWNWN5aFNaV0ZqZEVSUFRVWmhZM1J2Y21sbGN5a3VabTl5UldGamFDaG1kVzVqZEdsdmJpQW9abUZqZEc5eWVTa2dlMXh1SUNBZ0lGSmxZV04wTGtSUFRWdG1ZV04wYjNKNVhTQTlJR1oxYm1OMGFXOXVJQ2dwSUh0Y2JpQWdJQ0FnSUdsbUlDZ2hkMkZ5Ym1Wa1JtOXlSbUZqZEc5eWFXVnpLU0I3WEc0Z0lDQWdJQ0FnSUd4dmQxQnlhVzl5YVhSNVYyRnlibWx1WnlobVlXeHpaU3dnSjBGalkyVnpjMmx1WnlCbVlXTjBiM0pwWlhNZ2JHbHJaU0JTWldGamRDNUVUMDB1SlhNZ2FHRnpJR0psWlc0Z1pHVndjbVZqWVhSbFpDQW5JQ3NnSjJGdVpDQjNhV3hzSUdKbElISmxiVzkyWldRZ2FXNGdkakUyTGpBckxpQlZjMlVnZEdobElDY2dLeUFuY21WaFkzUXRaRzl0TFdaaFkzUnZjbWxsY3lCd1lXTnJZV2RsSUdsdWMzUmxZV1F1SUNjZ0t5QW5JRlpsY25OcGIyNGdNUzR3SUhCeWIzWnBaR1Z6SUdFZ1pISnZjQzFwYmlCeVpYQnNZV05sYldWdWRDNG5JQ3NnSnlCR2IzSWdiVzl5WlNCcGJtWnZMQ0J6WldVZ2FIUjBjSE02THk5bVlpNXRaUzl5WldGamRDMWtiMjB0Wm1GamRHOXlhV1Z6Snl3Z1ptRmpkRzl5ZVNrN1hHNGdJQ0FnSUNBZ0lIZGhjbTVsWkVadmNrWmhZM1J2Y21sbGN5QTlJSFJ5ZFdVN1hHNGdJQ0FnSUNCOVhHNGdJQ0FnSUNCeVpYUjFjbTRnVW1WaFkzUkVUMDFHWVdOMGIzSnBaWE5iWm1GamRHOXllVjB1WVhCd2JIa29VbVZoWTNSRVQwMUdZV04wYjNKcFpYTXNJR0Z5WjNWdFpXNTBjeWs3WEc0Z0lDQWdmVHRjYmlBZ2ZTazdYRzU5WEc1Y2JtMXZaSFZzWlM1bGVIQnZjblJ6SUQwZ1VtVmhZM1E3SWl3aUx5b3FYRzRnS2lCRGIzQjVjbWxuYUhRZ01qQXhNeTF3Y21WelpXNTBMQ0JHWVdObFltOXZheXdnU1c1akxseHVJQ29nUVd4c0lISnBaMmgwY3lCeVpYTmxjblpsWkM1Y2JpQXFYRzRnS2lCVWFHbHpJSE52ZFhKalpTQmpiMlJsSUdseklHeHBZMlZ1YzJWa0lIVnVaR1Z5SUhSb1pTQkNVMFF0YzNSNWJHVWdiR2xqWlc1elpTQm1iM1Z1WkNCcGJpQjBhR1ZjYmlBcUlFeEpRMFZPVTBVZ1ptbHNaU0JwYmlCMGFHVWdjbTl2ZENCa2FYSmxZM1J2Y25rZ2IyWWdkR2hwY3lCemIzVnlZMlVnZEhKbFpTNGdRVzRnWVdSa2FYUnBiMjVoYkNCbmNtRnVkRnh1SUNvZ2IyWWdjR0YwWlc1MElISnBaMmgwY3lCallXNGdZbVVnWm05MWJtUWdhVzRnZEdobElGQkJWRVZPVkZNZ1ptbHNaU0JwYmlCMGFHVWdjMkZ0WlNCa2FYSmxZM1J2Y25rdVhHNGdLbHh1SUNvdlhHNWNiaWQxYzJVZ2MzUnlhV04wSnp0Y2JseHVkbUZ5SUY5d2NtOWtTVzUyWVhKcFlXNTBJRDBnY21WeGRXbHlaU2duTGk5eVpXRmpkRkJ5YjJSSmJuWmhjbWxoYm5RbktTeGNiaUFnSUNCZllYTnphV2R1SUQwZ2NtVnhkV2x5WlNnbmIySnFaV04wTFdGemMybG5iaWNwTzF4dVhHNTJZWElnVW1WaFkzUk9iMjl3VlhCa1lYUmxVWFZsZFdVZ1BTQnlaWEYxYVhKbEtDY3VMMUpsWVdOMFRtOXZjRlZ3WkdGMFpWRjFaWFZsSnlrN1hHNWNiblpoY2lCallXNUVaV1pwYm1WUWNtOXdaWEowZVNBOUlISmxjWFZwY21Vb0p5NHZZMkZ1UkdWbWFXNWxVSEp2Y0dWeWRIa25LVHRjYm5aaGNpQmxiWEIwZVU5aWFtVmpkQ0E5SUhKbGNYVnBjbVVvSjJaaWFuTXZiR2xpTDJWdGNIUjVUMkpxWldOMEp5azdYRzUyWVhJZ2FXNTJZWEpwWVc1MElEMGdjbVZ4ZFdseVpTZ25abUpxY3k5c2FXSXZhVzUyWVhKcFlXNTBKeWs3WEc1MllYSWdiRzkzVUhKcGIzSnBkSGxYWVhKdWFXNW5JRDBnY21WeGRXbHlaU2duTGk5c2IzZFFjbWx2Y21sMGVWZGhjbTVwYm1jbktUdGNibHh1THlvcVhHNGdLaUJDWVhObElHTnNZWE56SUdobGJIQmxjbk1nWm05eUlIUm9aU0IxY0dSaGRHbHVaeUJ6ZEdGMFpTQnZaaUJoSUdOdmJYQnZibVZ1ZEM1Y2JpQXFMMXh1Wm5WdVkzUnBiMjRnVW1WaFkzUkRiMjF3YjI1bGJuUW9jSEp2Y0hNc0lHTnZiblJsZUhRc0lIVndaR0YwWlhJcElIdGNiaUFnZEdocGN5NXdjbTl3Y3lBOUlIQnliM0J6TzF4dUlDQjBhR2x6TG1OdmJuUmxlSFFnUFNCamIyNTBaWGgwTzF4dUlDQjBhR2x6TG5KbFpuTWdQU0JsYlhCMGVVOWlhbVZqZER0Y2JpQWdMeThnVjJVZ2FXNXBkR2xoYkdsNlpTQjBhR1VnWkdWbVlYVnNkQ0IxY0dSaGRHVnlJR0oxZENCMGFHVWdjbVZoYkNCdmJtVWdaMlYwY3lCcGJtcGxZM1JsWkNCaWVTQjBhR1ZjYmlBZ0x5OGdjbVZ1WkdWeVpYSXVYRzRnSUhSb2FYTXVkWEJrWVhSbGNpQTlJSFZ3WkdGMFpYSWdmSHdnVW1WaFkzUk9iMjl3VlhCa1lYUmxVWFZsZFdVN1hHNTlYRzVjYmxKbFlXTjBRMjl0Y0c5dVpXNTBMbkJ5YjNSdmRIbHdaUzVwYzFKbFlXTjBRMjl0Y0c5dVpXNTBJRDBnZTMwN1hHNWNiaThxS2x4dUlDb2dVMlYwY3lCaElITjFZbk5sZENCdlppQjBhR1VnYzNSaGRHVXVJRUZzZDJGNWN5QjFjMlVnZEdocGN5QjBieUJ0ZFhSaGRHVmNiaUFxSUhOMFlYUmxMaUJaYjNVZ2MyaHZkV3hrSUhSeVpXRjBJR0IwYUdsekxuTjBZWFJsWUNCaGN5QnBiVzExZEdGaWJHVXVYRzRnS2x4dUlDb2dWR2hsY21VZ2FYTWdibThnWjNWaGNtRnVkR1ZsSUhSb1lYUWdZSFJvYVhNdWMzUmhkR1ZnSUhkcGJHd2dZbVVnYVcxdFpXUnBZWFJsYkhrZ2RYQmtZWFJsWkN3Z2MyOWNiaUFxSUdGalkyVnpjMmx1WnlCZ2RHaHBjeTV6ZEdGMFpXQWdZV1owWlhJZ1kyRnNiR2x1WnlCMGFHbHpJRzFsZEdodlpDQnRZWGtnY21WMGRYSnVJSFJvWlNCdmJHUWdkbUZzZFdVdVhHNGdLbHh1SUNvZ1ZHaGxjbVVnYVhNZ2JtOGdaM1ZoY21GdWRHVmxJSFJvWVhRZ1kyRnNiSE1nZEc4Z1lITmxkRk4wWVhSbFlDQjNhV3hzSUhKMWJpQnplVzVqYUhKdmJtOTFjMng1TEZ4dUlDb2dZWE1nZEdobGVTQnRZWGtnWlhabGJuUjFZV3hzZVNCaVpTQmlZWFJqYUdWa0lIUnZaMlYwYUdWeUxpQWdXVzkxSUdOaGJpQndjbTkyYVdSbElHRnVJRzl3ZEdsdmJtRnNYRzRnS2lCallXeHNZbUZqYXlCMGFHRjBJSGRwYkd3Z1ltVWdaWGhsWTNWMFpXUWdkMmhsYmlCMGFHVWdZMkZzYkNCMGJ5QnpaWFJUZEdGMFpTQnBjeUJoWTNSMVlXeHNlVnh1SUNvZ1kyOXRjR3hsZEdWa0xseHVJQ3BjYmlBcUlGZG9aVzRnWVNCbWRXNWpkR2x2YmlCcGN5QndjbTkyYVdSbFpDQjBieUJ6WlhSVGRHRjBaU3dnYVhRZ2QybHNiQ0JpWlNCallXeHNaV1FnWVhRZ2MyOXRaU0J3YjJsdWRDQnBibHh1SUNvZ2RHaGxJR1oxZEhWeVpTQW9ibTkwSUhONWJtTm9jbTl1YjNWemJIa3BMaUJKZENCM2FXeHNJR0psSUdOaGJHeGxaQ0IzYVhSb0lIUm9aU0IxY0NCMGJ5QmtZWFJsWEc0Z0tpQmpiMjF3YjI1bGJuUWdZWEpuZFcxbGJuUnpJQ2h6ZEdGMFpTd2djSEp2Y0hNc0lHTnZiblJsZUhRcExpQlVhR1Z6WlNCMllXeDFaWE1nWTJGdUlHSmxJR1JwWm1abGNtVnVkRnh1SUNvZ1puSnZiU0IwYUdsekxpb2dZbVZqWVhWelpTQjViM1Z5SUdaMWJtTjBhVzl1SUcxaGVTQmlaU0JqWVd4c1pXUWdZV1owWlhJZ2NtVmpaV2wyWlZCeWIzQnpJR0oxZENCaVpXWnZjbVZjYmlBcUlITm9iM1ZzWkVOdmJYQnZibVZ1ZEZWd1pHRjBaU3dnWVc1a0lIUm9hWE1nYm1WM0lITjBZWFJsTENCd2NtOXdjeXdnWVc1a0lHTnZiblJsZUhRZ2QybHNiQ0J1YjNRZ2VXVjBJR0psWEc0Z0tpQmhjM05wWjI1bFpDQjBieUIwYUdsekxseHVJQ3BjYmlBcUlFQndZWEpoYlNCN2IySnFaV04wZkdaMWJtTjBhVzl1ZlNCd1lYSjBhV0ZzVTNSaGRHVWdUbVY0ZENCd1lYSjBhV0ZzSUhOMFlYUmxJRzl5SUdaMWJtTjBhVzl1SUhSdlhHNGdLaUFnSUNBZ0lDQWdjSEp2WkhWalpTQnVaWGgwSUhCaGNuUnBZV3dnYzNSaGRHVWdkRzhnWW1VZ2JXVnlaMlZrSUhkcGRHZ2dZM1Z5Y21WdWRDQnpkR0YwWlM1Y2JpQXFJRUJ3WVhKaGJTQjdQMloxYm1OMGFXOXVmU0JqWVd4c1ltRmpheUJEWVd4c1pXUWdZV1owWlhJZ2MzUmhkR1VnYVhNZ2RYQmtZWFJsWkM1Y2JpQXFJRUJtYVc1aGJGeHVJQ29nUUhCeWIzUmxZM1JsWkZ4dUlDb3ZYRzVTWldGamRFTnZiWEJ2Ym1WdWRDNXdjbTkwYjNSNWNHVXVjMlYwVTNSaGRHVWdQU0JtZFc1amRHbHZiaUFvY0dGeWRHbGhiRk4wWVhSbExDQmpZV3hzWW1GamF5a2dlMXh1SUNBaEtIUjVjR1Z2WmlCd1lYSjBhV0ZzVTNSaGRHVWdQVDA5SUNkdlltcGxZM1FuSUh4OElIUjVjR1Z2WmlCd1lYSjBhV0ZzVTNSaGRHVWdQVDA5SUNkbWRXNWpkR2x2YmljZ2ZId2djR0Z5ZEdsaGJGTjBZWFJsSUQwOUlHNTFiR3dwSUQ4Z2NISnZZMlZ6Y3k1bGJuWXVUazlFUlY5RlRsWWdJVDA5SUNkd2NtOWtkV04wYVc5dUp5QS9JR2x1ZG1GeWFXRnVkQ2htWVd4elpTd2dKM05sZEZOMFlYUmxLQzR1TGlrNklIUmhhMlZ6SUdGdUlHOWlhbVZqZENCdlppQnpkR0YwWlNCMllYSnBZV0pzWlhNZ2RHOGdkWEJrWVhSbElHOXlJR0VnWm5WdVkzUnBiMjRnZDJocFkyZ2djbVYwZFhKdWN5QmhiaUJ2WW1wbFkzUWdiMllnYzNSaGRHVWdkbUZ5YVdGaWJHVnpMaWNwSURvZ1gzQnliMlJKYm5aaGNtbGhiblFvSnpnMUp5a2dPaUIyYjJsa0lEQTdYRzRnSUhSb2FYTXVkWEJrWVhSbGNpNWxibkYxWlhWbFUyVjBVM1JoZEdVb2RHaHBjeXdnY0dGeWRHbGhiRk4wWVhSbEtUdGNiaUFnYVdZZ0tHTmhiR3hpWVdOcktTQjdYRzRnSUNBZ2RHaHBjeTUxY0dSaGRHVnlMbVZ1Y1hWbGRXVkRZV3hzWW1GamF5aDBhR2x6TENCallXeHNZbUZqYXl3Z0ozTmxkRk4wWVhSbEp5azdYRzRnSUgxY2JuMDdYRzVjYmk4cUtseHVJQ29nUm05eVkyVnpJR0Z1SUhWd1pHRjBaUzRnVkdocGN5QnphRzkxYkdRZ2IyNXNlU0JpWlNCcGJuWnZhMlZrSUhkb1pXNGdhWFFnYVhNZ2EyNXZkMjRnZDJsMGFGeHVJQ29nWTJWeWRHRnBiblI1SUhSb1lYUWdkMlVnWVhKbElDb3FibTkwS2lvZ2FXNGdZU0JFVDAwZ2RISmhibk5oWTNScGIyNHVYRzRnS2x4dUlDb2dXVzkxSUcxaGVTQjNZVzUwSUhSdklHTmhiR3dnZEdocGN5QjNhR1Z1SUhsdmRTQnJibTkzSUhSb1lYUWdjMjl0WlNCa1pXVndaWElnWVhOd1pXTjBJRzltSUhSb1pWeHVJQ29nWTI5dGNHOXVaVzUwSjNNZ2MzUmhkR1VnYUdGeklHTm9ZVzVuWldRZ1luVjBJR0J6WlhSVGRHRjBaV0FnZDJGeklHNXZkQ0JqWVd4c1pXUXVYRzRnS2x4dUlDb2dWR2hwY3lCM2FXeHNJRzV2ZENCcGJuWnZhMlVnWUhOb2IzVnNaRU52YlhCdmJtVnVkRlZ3WkdGMFpXQXNJR0oxZENCcGRDQjNhV3hzSUdsdWRtOXJaVnh1SUNvZ1lHTnZiWEJ2Ym1WdWRGZHBiR3hWY0dSaGRHVmdJR0Z1WkNCZ1kyOXRjRzl1Wlc1MFJHbGtWWEJrWVhSbFlDNWNiaUFxWEc0Z0tpQkFjR0Z5WVcwZ2V6OW1kVzVqZEdsdmJuMGdZMkZzYkdKaFkyc2dRMkZzYkdWa0lHRm1kR1Z5SUhWd1pHRjBaU0JwY3lCamIyMXdiR1YwWlM1Y2JpQXFJRUJtYVc1aGJGeHVJQ29nUUhCeWIzUmxZM1JsWkZ4dUlDb3ZYRzVTWldGamRFTnZiWEJ2Ym1WdWRDNXdjbTkwYjNSNWNHVXVabTl5WTJWVmNHUmhkR1VnUFNCbWRXNWpkR2x2YmlBb1kyRnNiR0poWTJzcElIdGNiaUFnZEdocGN5NTFjR1JoZEdWeUxtVnVjWFZsZFdWR2IzSmpaVlZ3WkdGMFpTaDBhR2x6S1R0Y2JpQWdhV1lnS0dOaGJHeGlZV05yS1NCN1hHNGdJQ0FnZEdocGN5NTFjR1JoZEdWeUxtVnVjWFZsZFdWRFlXeHNZbUZqYXloMGFHbHpMQ0JqWVd4c1ltRmpheXdnSjJadmNtTmxWWEJrWVhSbEp5azdYRzRnSUgxY2JuMDdYRzVjYmk4cUtseHVJQ29nUkdWd2NtVmpZWFJsWkNCQlVFbHpMaUJVYUdWelpTQkJVRWx6SUhWelpXUWdkRzhnWlhocGMzUWdiMjRnWTJ4aGMzTnBZeUJTWldGamRDQmpiR0Z6YzJWeklHSjFkQ0J6YVc1alpWeHVJQ29nZDJVZ2QyOTFiR1FnYkdsclpTQjBieUJrWlhCeVpXTmhkR1VnZEdobGJTd2dkMlVuY21VZ2JtOTBJR2R2YVc1bklIUnZJRzF2ZG1VZ2RHaGxiU0J2ZG1WeUlIUnZJSFJvYVhOY2JpQXFJRzF2WkdWeWJpQmlZWE5sSUdOc1lYTnpMaUJKYm5OMFpXRmtMQ0IzWlNCa1pXWnBibVVnWVNCblpYUjBaWElnZEdoaGRDQjNZWEp1Y3lCcFppQnBkQ2R6SUdGalkyVnpjMlZrTGx4dUlDb3ZYRzVwWmlBb2NISnZZMlZ6Y3k1bGJuWXVUazlFUlY5RlRsWWdJVDA5SUNkd2NtOWtkV04wYVc5dUp5a2dlMXh1SUNCMllYSWdaR1Z3Y21WallYUmxaRUZRU1hNZ1BTQjdYRzRnSUNBZ2FYTk5iM1Z1ZEdWa09pQmJKMmx6VFc5MWJuUmxaQ2NzSUNkSmJuTjBaV0ZrTENCdFlXdGxJSE4xY21VZ2RHOGdZMnhsWVc0Z2RYQWdjM1ZpYzJOeWFYQjBhVzl1Y3lCaGJtUWdjR1Z1WkdsdVp5QnlaWEYxWlhOMGN5QnBiaUFuSUNzZ0oyTnZiWEJ2Ym1WdWRGZHBiR3hWYm0xdmRXNTBJSFJ2SUhCeVpYWmxiblFnYldWdGIzSjVJR3hsWVd0ekxpZGRMRnh1SUNBZ0lISmxjR3hoWTJWVGRHRjBaVG9nV3lkeVpYQnNZV05sVTNSaGRHVW5MQ0FuVW1WbVlXTjBiM0lnZVc5MWNpQmpiMlJsSUhSdklIVnpaU0J6WlhSVGRHRjBaU0JwYm5OMFpXRmtJQ2h6WldVZ0p5QXJJQ2RvZEhSd2N6b3ZMMmRwZEdoMVlpNWpiMjB2Wm1GalpXSnZiMnN2Y21WaFkzUXZhWE56ZFdWekx6TXlNellwTGlkZFhHNGdJSDA3WEc0Z0lIWmhjaUJrWldacGJtVkVaWEJ5WldOaGRHbHZibGRoY201cGJtY2dQU0JtZFc1amRHbHZiaUFvYldWMGFHOWtUbUZ0WlN3Z2FXNW1ieWtnZTF4dUlDQWdJR2xtSUNoallXNUVaV1pwYm1WUWNtOXdaWEowZVNrZ2UxeHVJQ0FnSUNBZ1QySnFaV04wTG1SbFptbHVaVkJ5YjNCbGNuUjVLRkpsWVdOMFEyOXRjRzl1Wlc1MExuQnliM1J2ZEhsd1pTd2diV1YwYUc5a1RtRnRaU3dnZTF4dUlDQWdJQ0FnSUNCblpYUTZJR1oxYm1OMGFXOXVJQ2dwSUh0Y2JpQWdJQ0FnSUNBZ0lDQnNiM2RRY21sdmNtbDBlVmRoY201cGJtY29abUZzYzJVc0lDY2xjeWd1TGk0cElHbHpJR1JsY0hKbFkyRjBaV1FnYVc0Z2NHeGhhVzRnU21GMllWTmpjbWx3ZENCU1pXRmpkQ0JqYkdGemMyVnpMaUFsY3ljc0lHbHVabTliTUYwc0lHbHVabTliTVYwcE8xeHVJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQjFibVJsWm1sdVpXUTdYRzRnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJSDBwTzF4dUlDQWdJSDFjYmlBZ2ZUdGNiaUFnWm05eUlDaDJZWElnWm01T1lXMWxJR2x1SUdSbGNISmxZMkYwWldSQlVFbHpLU0I3WEc0Z0lDQWdhV1lnS0dSbGNISmxZMkYwWldSQlVFbHpMbWhoYzA5M2JsQnliM0JsY25SNUtHWnVUbUZ0WlNrcElIdGNiaUFnSUNBZ0lHUmxabWx1WlVSbGNISmxZMkYwYVc5dVYyRnlibWx1WnlobWJrNWhiV1VzSUdSbGNISmxZMkYwWldSQlVFbHpXMlp1VG1GdFpWMHBPMXh1SUNBZ0lIMWNiaUFnZlZ4dWZWeHVYRzR2S2lwY2JpQXFJRUpoYzJVZ1kyeGhjM01nYUdWc2NHVnljeUJtYjNJZ2RHaGxJSFZ3WkdGMGFXNW5JSE4wWVhSbElHOW1JR0VnWTI5dGNHOXVaVzUwTGx4dUlDb3ZYRzVtZFc1amRHbHZiaUJTWldGamRGQjFjbVZEYjIxd2IyNWxiblFvY0hKdmNITXNJR052Ym5SbGVIUXNJSFZ3WkdGMFpYSXBJSHRjYmlBZ0x5OGdSSFZ3YkdsallYUmxaQ0JtY205dElGSmxZV04wUTI5dGNHOXVaVzUwTGx4dUlDQjBhR2x6TG5CeWIzQnpJRDBnY0hKdmNITTdYRzRnSUhSb2FYTXVZMjl1ZEdWNGRDQTlJR052Ym5SbGVIUTdYRzRnSUhSb2FYTXVjbVZtY3lBOUlHVnRjSFI1VDJKcVpXTjBPMXh1SUNBdkx5QlhaU0JwYm1sMGFXRnNhWHBsSUhSb1pTQmtaV1poZFd4MElIVndaR0YwWlhJZ1luVjBJSFJvWlNCeVpXRnNJRzl1WlNCblpYUnpJR2x1YW1WamRHVmtJR0o1SUhSb1pWeHVJQ0F2THlCeVpXNWtaWEpsY2k1Y2JpQWdkR2hwY3k1MWNHUmhkR1Z5SUQwZ2RYQmtZWFJsY2lCOGZDQlNaV0ZqZEU1dmIzQlZjR1JoZEdWUmRXVjFaVHRjYm4xY2JseHVablZ1WTNScGIyNGdRMjl0Y0c5dVpXNTBSSFZ0Ylhrb0tTQjdmVnh1UTI5dGNHOXVaVzUwUkhWdGJYa3VjSEp2ZEc5MGVYQmxJRDBnVW1WaFkzUkRiMjF3YjI1bGJuUXVjSEp2ZEc5MGVYQmxPMXh1VW1WaFkzUlFkWEpsUTI5dGNHOXVaVzUwTG5CeWIzUnZkSGx3WlNBOUlHNWxkeUJEYjIxd2IyNWxiblJFZFcxdGVTZ3BPMXh1VW1WaFkzUlFkWEpsUTI5dGNHOXVaVzUwTG5CeWIzUnZkSGx3WlM1amIyNXpkSEoxWTNSdmNpQTlJRkpsWVdOMFVIVnlaVU52YlhCdmJtVnVkRHRjYmk4dklFRjJiMmxrSUdGdUlHVjRkSEpoSUhCeWIzUnZkSGx3WlNCcWRXMXdJR1p2Y2lCMGFHVnpaU0J0WlhSb2IyUnpMbHh1WDJGemMybG5iaWhTWldGamRGQjFjbVZEYjIxd2IyNWxiblF1Y0hKdmRHOTBlWEJsTENCU1pXRmpkRU52YlhCdmJtVnVkQzV3Y205MGIzUjVjR1VwTzF4dVVtVmhZM1JRZFhKbFEyOXRjRzl1Wlc1MExuQnliM1J2ZEhsd1pTNXBjMUIxY21WU1pXRmpkRU52YlhCdmJtVnVkQ0E5SUhSeWRXVTdYRzVjYm0xdlpIVnNaUzVsZUhCdmNuUnpJRDBnZTF4dUlDQkRiMjF3YjI1bGJuUTZJRkpsWVdOMFEyOXRjRzl1Wlc1MExGeHVJQ0JRZFhKbFEyOXRjRzl1Wlc1ME9pQlNaV0ZqZEZCMWNtVkRiMjF3YjI1bGJuUmNibjA3SWl3aUx5b3FYRzRnS2lCRGIzQjVjbWxuYUhRZ01qQXhNeTF3Y21WelpXNTBMQ0JHWVdObFltOXZheXdnU1c1akxseHVJQ29nUVd4c0lISnBaMmgwY3lCeVpYTmxjblpsWkM1Y2JpQXFYRzRnS2lCVWFHbHpJSE52ZFhKalpTQmpiMlJsSUdseklHeHBZMlZ1YzJWa0lIVnVaR1Z5SUhSb1pTQkNVMFF0YzNSNWJHVWdiR2xqWlc1elpTQm1iM1Z1WkNCcGJpQjBhR1ZjYmlBcUlFeEpRMFZPVTBVZ1ptbHNaU0JwYmlCMGFHVWdjbTl2ZENCa2FYSmxZM1J2Y25rZ2IyWWdkR2hwY3lCemIzVnlZMlVnZEhKbFpTNGdRVzRnWVdSa2FYUnBiMjVoYkNCbmNtRnVkRnh1SUNvZ2IyWWdjR0YwWlc1MElISnBaMmgwY3lCallXNGdZbVVnWm05MWJtUWdhVzRnZEdobElGQkJWRVZPVkZNZ1ptbHNaU0JwYmlCMGFHVWdjMkZ0WlNCa2FYSmxZM1J2Y25rdVhHNGdLbHh1SUNvdlhHNWNiaWQxYzJVZ2MzUnlhV04wSnp0Y2JseHVkbUZ5SUZCdmIyeGxaRU5zWVhOeklEMGdjbVZ4ZFdseVpTZ25MaTlRYjI5c1pXUkRiR0Z6Y3ljcE8xeHVkbUZ5SUZKbFlXTjBSV3hsYldWdWRDQTlJSEpsY1hWcGNtVW9KeTR2VW1WaFkzUkZiR1Z0Wlc1MEp5azdYRzVjYm5aaGNpQmxiWEIwZVVaMWJtTjBhVzl1SUQwZ2NtVnhkV2x5WlNnblptSnFjeTlzYVdJdlpXMXdkSGxHZFc1amRHbHZiaWNwTzF4dWRtRnlJSFJ5WVhabGNuTmxRV3hzUTJocGJHUnlaVzRnUFNCeVpYRjFhWEpsS0NjdUwzUnlZWFpsY25ObFFXeHNRMmhwYkdSeVpXNG5LVHRjYmx4dWRtRnlJSFIzYjBGeVozVnRaVzUwVUc5dmJHVnlJRDBnVUc5dmJHVmtRMnhoYzNNdWRIZHZRWEpuZFcxbGJuUlFiMjlzWlhJN1hHNTJZWElnWm05MWNrRnlaM1Z0Wlc1MFVHOXZiR1Z5SUQwZ1VHOXZiR1ZrUTJ4aGMzTXVabTkxY2tGeVozVnRaVzUwVUc5dmJHVnlPMXh1WEc1MllYSWdkWE5sY2xCeWIzWnBaR1ZrUzJWNVJYTmpZWEJsVW1WblpYZ2dQU0F2WEZ3dkt5OW5PMXh1Wm5WdVkzUnBiMjRnWlhOallYQmxWWE5sY2xCeWIzWnBaR1ZrUzJWNUtIUmxlSFFwSUh0Y2JpQWdjbVYwZFhKdUlDZ25KeUFySUhSbGVIUXBMbkpsY0d4aFkyVW9kWE5sY2xCeWIzWnBaR1ZrUzJWNVJYTmpZWEJsVW1WblpYZ3NJQ2NrSmk4bktUdGNibjFjYmx4dUx5b3FYRzRnS2lCUWIyOXNaV1JEYkdGemN5QnlaWEJ5WlhObGJuUnBibWNnZEdobElHSnZiMnRyWldWd2FXNW5JR0Z6YzI5amFXRjBaV1FnZDJsMGFDQndaWEptYjNKdGFXNW5JR0VnWTJocGJHUmNiaUFxSUhSeVlYWmxjbk5oYkM0Z1FXeHNiM2R6SUdGMmIybGthVzVuSUdKcGJtUnBibWNnWTJGc2JHSmhZMnR6TGx4dUlDcGNiaUFxSUVCamIyNXpkSEoxWTNSdmNpQkdiM0pGWVdOb1FtOXZhMHRsWlhCcGJtZGNiaUFxSUVCd1lYSmhiU0I3SVdaMWJtTjBhVzl1ZlNCbWIzSkZZV05vUm5WdVkzUnBiMjRnUm5WdVkzUnBiMjRnZEc4Z2NHVnlabTl5YlNCMGNtRjJaWEp6WVd3Z2QybDBhQzVjYmlBcUlFQndZWEpoYlNCN1B5cDlJR1p2Y2tWaFkyaERiMjUwWlhoMElFTnZiblJsZUhRZ2RHOGdjR1Z5Wm05eWJTQmpiMjUwWlhoMElIZHBkR2d1WEc0Z0tpOWNibVoxYm1OMGFXOXVJRVp2Y2tWaFkyaENiMjlyUzJWbGNHbHVaeWhtYjNKRllXTm9SblZ1WTNScGIyNHNJR1p2Y2tWaFkyaERiMjUwWlhoMEtTQjdYRzRnSUhSb2FYTXVablZ1WXlBOUlHWnZja1ZoWTJoR2RXNWpkR2x2Ymp0Y2JpQWdkR2hwY3k1amIyNTBaWGgwSUQwZ1ptOXlSV0ZqYUVOdmJuUmxlSFE3WEc0Z0lIUm9hWE11WTI5MWJuUWdQU0F3TzF4dWZWeHVSbTl5UldGamFFSnZiMnRMWldWd2FXNW5MbkJ5YjNSdmRIbHdaUzVrWlhOMGNuVmpkRzl5SUQwZ1puVnVZM1JwYjI0Z0tDa2dlMXh1SUNCMGFHbHpMbVoxYm1NZ1BTQnVkV3hzTzF4dUlDQjBhR2x6TG1OdmJuUmxlSFFnUFNCdWRXeHNPMXh1SUNCMGFHbHpMbU52ZFc1MElEMGdNRHRjYm4wN1hHNVFiMjlzWldSRGJHRnpjeTVoWkdSUWIyOXNhVzVuVkc4b1JtOXlSV0ZqYUVKdmIydExaV1Z3YVc1bkxDQjBkMjlCY21kMWJXVnVkRkJ2YjJ4bGNpazdYRzVjYm1aMWJtTjBhVzl1SUdadmNrVmhZMmhUYVc1bmJHVkRhR2xzWkNoaWIyOXJTMlZsY0dsdVp5d2dZMmhwYkdRc0lHNWhiV1VwSUh0Y2JpQWdkbUZ5SUdaMWJtTWdQU0JpYjI5clMyVmxjR2x1Wnk1bWRXNWpMRnh1SUNBZ0lDQWdZMjl1ZEdWNGRDQTlJR0p2YjJ0TFpXVndhVzVuTG1OdmJuUmxlSFE3WEc1Y2JpQWdablZ1WXk1allXeHNLR052Ym5SbGVIUXNJR05vYVd4a0xDQmliMjlyUzJWbGNHbHVaeTVqYjNWdWRDc3JLVHRjYm4xY2JseHVMeW9xWEc0Z0tpQkpkR1Z5WVhSbGN5QjBhSEp2ZFdkb0lHTm9hV3hrY21WdUlIUm9ZWFFnWVhKbElIUjVjR2xqWVd4c2VTQnpjR1ZqYVdacFpXUWdZWE1nWUhCeWIzQnpMbU5vYVd4a2NtVnVZQzVjYmlBcVhHNGdLaUJUWldVZ2FIUjBjSE02THk5bVlXTmxZbTl2YXk1bmFYUm9kV0l1YVc4dmNtVmhZM1F2Wkc5amN5OTBiM0F0YkdWMlpXd3RZWEJwTG1oMGJXd2pjbVZoWTNRdVkyaHBiR1J5Wlc0dVptOXlaV0ZqYUZ4dUlDcGNiaUFxSUZSb1pTQndjbTkyYVdSbFpDQm1iM0pGWVdOb1JuVnVZeWhqYUdsc1pDd2dhVzVrWlhncElIZHBiR3dnWW1VZ1kyRnNiR1ZrSUdadmNpQmxZV05vWEc0Z0tpQnNaV0ZtSUdOb2FXeGtMbHh1SUNwY2JpQXFJRUJ3WVhKaGJTQjdQeXA5SUdOb2FXeGtjbVZ1SUVOb2FXeGtjbVZ1SUhSeVpXVWdZMjl1ZEdGcGJtVnlMbHh1SUNvZ1FIQmhjbUZ0SUh0bWRXNWpkR2x2YmlncUxDQnBiblFwZlNCbWIzSkZZV05vUm5WdVkxeHVJQ29nUUhCaGNtRnRJSHNxZlNCbWIzSkZZV05vUTI5dWRHVjRkQ0JEYjI1MFpYaDBJR1p2Y2lCbWIzSkZZV05vUTI5dWRHVjRkQzVjYmlBcUwxeHVablZ1WTNScGIyNGdabTl5UldGamFFTm9hV3hrY21WdUtHTm9hV3hrY21WdUxDQm1iM0pGWVdOb1JuVnVZeXdnWm05eVJXRmphRU52Ym5SbGVIUXBJSHRjYmlBZ2FXWWdLR05vYVd4a2NtVnVJRDA5SUc1MWJHd3BJSHRjYmlBZ0lDQnlaWFIxY200Z1kyaHBiR1J5Wlc0N1hHNGdJSDFjYmlBZ2RtRnlJSFJ5WVhabGNuTmxRMjl1ZEdWNGRDQTlJRVp2Y2tWaFkyaENiMjlyUzJWbGNHbHVaeTVuWlhSUWIyOXNaV1FvWm05eVJXRmphRVoxYm1Nc0lHWnZja1ZoWTJoRGIyNTBaWGgwS1R0Y2JpQWdkSEpoZG1WeWMyVkJiR3hEYUdsc1pISmxiaWhqYUdsc1pISmxiaXdnWm05eVJXRmphRk5wYm1kc1pVTm9hV3hrTENCMGNtRjJaWEp6WlVOdmJuUmxlSFFwTzF4dUlDQkdiM0pGWVdOb1FtOXZhMHRsWlhCcGJtY3VjbVZzWldGelpTaDBjbUYyWlhKelpVTnZiblJsZUhRcE8xeHVmVnh1WEc0dktpcGNiaUFxSUZCdmIyeGxaRU5zWVhOeklISmxjSEpsYzJWdWRHbHVaeUIwYUdVZ1ltOXZhMnRsWlhCcGJtY2dZWE56YjJOcFlYUmxaQ0IzYVhSb0lIQmxjbVp2Y20xcGJtY2dZU0JqYUdsc1pGeHVJQ29nYldGd2NHbHVaeTRnUVd4c2IzZHpJR0YyYjJsa2FXNW5JR0pwYm1ScGJtY2dZMkZzYkdKaFkydHpMbHh1SUNwY2JpQXFJRUJqYjI1emRISjFZM1J2Y2lCTllYQkNiMjlyUzJWbGNHbHVaMXh1SUNvZ1FIQmhjbUZ0SUhzaEtuMGdiV0Z3VW1WemRXeDBJRTlpYW1WamRDQmpiMjUwWVdsdWFXNW5JSFJvWlNCdmNtUmxjbVZrSUcxaGNDQnZaaUJ5WlhOMWJIUnpMbHh1SUNvZ1FIQmhjbUZ0SUhzaFpuVnVZM1JwYjI1OUlHMWhjRVoxYm1OMGFXOXVJRVoxYm1OMGFXOXVJSFJ2SUhCbGNtWnZjbTBnYldGd2NHbHVaeUIzYVhSb0xseHVJQ29nUUhCaGNtRnRJSHMvS24wZ2JXRndRMjl1ZEdWNGRDQkRiMjUwWlhoMElIUnZJSEJsY21admNtMGdiV0Z3Y0dsdVp5QjNhWFJvTGx4dUlDb3ZYRzVtZFc1amRHbHZiaUJOWVhCQ2IyOXJTMlZsY0dsdVp5aHRZWEJTWlhOMWJIUXNJR3RsZVZCeVpXWnBlQ3dnYldGd1JuVnVZM1JwYjI0c0lHMWhjRU52Ym5SbGVIUXBJSHRjYmlBZ2RHaHBjeTV5WlhOMWJIUWdQU0J0WVhCU1pYTjFiSFE3WEc0Z0lIUm9hWE11YTJWNVVISmxabWw0SUQwZ2EyVjVVSEpsWm1sNE8xeHVJQ0IwYUdsekxtWjFibU1nUFNCdFlYQkdkVzVqZEdsdmJqdGNiaUFnZEdocGN5NWpiMjUwWlhoMElEMGdiV0Z3UTI5dWRHVjRkRHRjYmlBZ2RHaHBjeTVqYjNWdWRDQTlJREE3WEc1OVhHNU5ZWEJDYjI5clMyVmxjR2x1Wnk1d2NtOTBiM1I1Y0dVdVpHVnpkSEoxWTNSdmNpQTlJR1oxYm1OMGFXOXVJQ2dwSUh0Y2JpQWdkR2hwY3k1eVpYTjFiSFFnUFNCdWRXeHNPMXh1SUNCMGFHbHpMbXRsZVZCeVpXWnBlQ0E5SUc1MWJHdzdYRzRnSUhSb2FYTXVablZ1WXlBOUlHNTFiR3c3WEc0Z0lIUm9hWE11WTI5dWRHVjRkQ0E5SUc1MWJHdzdYRzRnSUhSb2FYTXVZMjkxYm5RZ1BTQXdPMXh1ZlR0Y2JsQnZiMnhsWkVOc1lYTnpMbUZrWkZCdmIyeHBibWRVYnloTllYQkNiMjlyUzJWbGNHbHVaeXdnWm05MWNrRnlaM1Z0Wlc1MFVHOXZiR1Z5S1R0Y2JseHVablZ1WTNScGIyNGdiV0Z3VTJsdVoyeGxRMmhwYkdSSmJuUnZRMjl1ZEdWNGRDaGliMjlyUzJWbGNHbHVaeXdnWTJocGJHUXNJR05vYVd4a1MyVjVLU0I3WEc0Z0lIWmhjaUJ5WlhOMWJIUWdQU0JpYjI5clMyVmxjR2x1Wnk1eVpYTjFiSFFzWEc0Z0lDQWdJQ0JyWlhsUWNtVm1hWGdnUFNCaWIyOXJTMlZsY0dsdVp5NXJaWGxRY21WbWFYZ3NYRzRnSUNBZ0lDQm1kVzVqSUQwZ1ltOXZhMHRsWlhCcGJtY3VablZ1WXl4Y2JpQWdJQ0FnSUdOdmJuUmxlSFFnUFNCaWIyOXJTMlZsY0dsdVp5NWpiMjUwWlhoME8xeHVYRzVjYmlBZ2RtRnlJRzFoY0hCbFpFTm9hV3hrSUQwZ1puVnVZeTVqWVd4c0tHTnZiblJsZUhRc0lHTm9hV3hrTENCaWIyOXJTMlZsY0dsdVp5NWpiM1Z1ZENzcktUdGNiaUFnYVdZZ0tFRnljbUY1TG1selFYSnlZWGtvYldGd2NHVmtRMmhwYkdRcEtTQjdYRzRnSUNBZ2JXRndTVzUwYjFkcGRHaExaWGxRY21WbWFYaEpiblJsY201aGJDaHRZWEJ3WldSRGFHbHNaQ3dnY21WemRXeDBMQ0JqYUdsc1pFdGxlU3dnWlcxd2RIbEdkVzVqZEdsdmJpNTBhR0YwVW1WMGRYSnVjMEZ5WjNWdFpXNTBLVHRjYmlBZ2ZTQmxiSE5sSUdsbUlDaHRZWEJ3WldSRGFHbHNaQ0FoUFNCdWRXeHNLU0I3WEc0Z0lDQWdhV1lnS0ZKbFlXTjBSV3hsYldWdWRDNXBjMVpoYkdsa1JXeGxiV1Z1ZENodFlYQndaV1JEYUdsc1pDa3BJSHRjYmlBZ0lDQWdJRzFoY0hCbFpFTm9hV3hrSUQwZ1VtVmhZM1JGYkdWdFpXNTBMbU5zYjI1bFFXNWtVbVZ3YkdGalpVdGxlU2h0WVhCd1pXUkRhR2xzWkN4Y2JpQWdJQ0FnSUM4dklFdGxaWEFnWW05MGFDQjBhR1VnS0cxaGNIQmxaQ2tnWVc1a0lHOXNaQ0JyWlhseklHbG1JSFJvWlhrZ1pHbG1abVZ5TENCcWRYTjBJR0Z6WEc0Z0lDQWdJQ0F2THlCMGNtRjJaWEp6WlVGc2JFTm9hV3hrY21WdUlIVnpaV1FnZEc4Z1pHOGdabTl5SUc5aWFtVmpkSE1nWVhNZ1kyaHBiR1J5Wlc1Y2JpQWdJQ0FnSUd0bGVWQnlaV1pwZUNBcklDaHRZWEJ3WldSRGFHbHNaQzVyWlhrZ0ppWWdLQ0ZqYUdsc1pDQjhmQ0JqYUdsc1pDNXJaWGtnSVQwOUlHMWhjSEJsWkVOb2FXeGtMbXRsZVNrZ1B5QmxjMk5oY0dWVmMyVnlVSEp2ZG1sa1pXUkxaWGtvYldGd2NHVmtRMmhwYkdRdWEyVjVLU0FySUNjdkp5QTZJQ2NuS1NBcklHTm9hV3hrUzJWNUtUdGNiaUFnSUNCOVhHNGdJQ0FnY21WemRXeDBMbkIxYzJnb2JXRndjR1ZrUTJocGJHUXBPMXh1SUNCOVhHNTlYRzVjYm1aMWJtTjBhVzl1SUcxaGNFbHVkRzlYYVhSb1MyVjVVSEpsWm1sNFNXNTBaWEp1WVd3b1kyaHBiR1J5Wlc0c0lHRnljbUY1TENCd2NtVm1hWGdzSUdaMWJtTXNJR052Ym5SbGVIUXBJSHRjYmlBZ2RtRnlJR1Z6WTJGd1pXUlFjbVZtYVhnZ1BTQW5KenRjYmlBZ2FXWWdLSEJ5WldacGVDQWhQU0J1ZFd4c0tTQjdYRzRnSUNBZ1pYTmpZWEJsWkZCeVpXWnBlQ0E5SUdWelkyRndaVlZ6WlhKUWNtOTJhV1JsWkV0bGVTaHdjbVZtYVhncElDc2dKeThuTzF4dUlDQjlYRzRnSUhaaGNpQjBjbUYyWlhKelpVTnZiblJsZUhRZ1BTQk5ZWEJDYjI5clMyVmxjR2x1Wnk1blpYUlFiMjlzWldRb1lYSnlZWGtzSUdWelkyRndaV1JRY21WbWFYZ3NJR1oxYm1Nc0lHTnZiblJsZUhRcE8xeHVJQ0IwY21GMlpYSnpaVUZzYkVOb2FXeGtjbVZ1S0dOb2FXeGtjbVZ1TENCdFlYQlRhVzVuYkdWRGFHbHNaRWx1ZEc5RGIyNTBaWGgwTENCMGNtRjJaWEp6WlVOdmJuUmxlSFFwTzF4dUlDQk5ZWEJDYjI5clMyVmxjR2x1Wnk1eVpXeGxZWE5sS0hSeVlYWmxjbk5sUTI5dWRHVjRkQ2s3WEc1OVhHNWNiaThxS2x4dUlDb2dUV0Z3Y3lCamFHbHNaSEpsYmlCMGFHRjBJR0Z5WlNCMGVYQnBZMkZzYkhrZ2MzQmxZMmxtYVdWa0lHRnpJR0J3Y205d2N5NWphR2xzWkhKbGJtQXVYRzRnS2x4dUlDb2dVMlZsSUdoMGRIQnpPaTh2Wm1GalpXSnZiMnN1WjJsMGFIVmlMbWx2TDNKbFlXTjBMMlJ2WTNNdmRHOXdMV3hsZG1Wc0xXRndhUzVvZEcxc0kzSmxZV04wTG1Ob2FXeGtjbVZ1TG0xaGNGeHVJQ3BjYmlBcUlGUm9aU0J3Y205MmFXUmxaQ0J0WVhCR2RXNWpkR2x2YmloamFHbHNaQ3dnYTJWNUxDQnBibVJsZUNrZ2QybHNiQ0JpWlNCallXeHNaV1FnWm05eUlHVmhZMmhjYmlBcUlHeGxZV1lnWTJocGJHUXVYRzRnS2x4dUlDb2dRSEJoY21GdElIcy9LbjBnWTJocGJHUnlaVzRnUTJocGJHUnlaVzRnZEhKbFpTQmpiMjUwWVdsdVpYSXVYRzRnS2lCQWNHRnlZVzBnZTJaMWJtTjBhVzl1S0Nvc0lHbHVkQ2w5SUdaMWJtTWdWR2hsSUcxaGNDQm1kVzVqZEdsdmJpNWNiaUFxSUVCd1lYSmhiU0I3S24wZ1kyOXVkR1Y0ZENCRGIyNTBaWGgwSUdadmNpQnRZWEJHZFc1amRHbHZiaTVjYmlBcUlFQnlaWFIxY200Z2UyOWlhbVZqZEgwZ1QySnFaV04wSUdOdmJuUmhhVzVwYm1jZ2RHaGxJRzl5WkdWeVpXUWdiV0Z3SUc5bUlISmxjM1ZzZEhNdVhHNGdLaTljYm1aMWJtTjBhVzl1SUcxaGNFTm9hV3hrY21WdUtHTm9hV3hrY21WdUxDQm1kVzVqTENCamIyNTBaWGgwS1NCN1hHNGdJR2xtSUNoamFHbHNaSEpsYmlBOVBTQnVkV3hzS1NCN1hHNGdJQ0FnY21WMGRYSnVJR05vYVd4a2NtVnVPMXh1SUNCOVhHNGdJSFpoY2lCeVpYTjFiSFFnUFNCYlhUdGNiaUFnYldGd1NXNTBiMWRwZEdoTFpYbFFjbVZtYVhoSmJuUmxjbTVoYkNoamFHbHNaSEpsYml3Z2NtVnpkV3gwTENCdWRXeHNMQ0JtZFc1akxDQmpiMjUwWlhoMEtUdGNiaUFnY21WMGRYSnVJSEpsYzNWc2REdGNibjFjYmx4dVpuVnVZM1JwYjI0Z1ptOXlSV0ZqYUZOcGJtZHNaVU5vYVd4a1JIVnRiWGtvZEhKaGRtVnljMlZEYjI1MFpYaDBMQ0JqYUdsc1pDd2dibUZ0WlNrZ2UxeHVJQ0J5WlhSMWNtNGdiblZzYkR0Y2JuMWNibHh1THlvcVhHNGdLaUJEYjNWdWRDQjBhR1VnYm5WdFltVnlJRzltSUdOb2FXeGtjbVZ1SUhSb1lYUWdZWEpsSUhSNWNHbGpZV3hzZVNCemNHVmphV1pwWldRZ1lYTmNiaUFxSUdCd2NtOXdjeTVqYUdsc1pISmxibUF1WEc0Z0tseHVJQ29nVTJWbElHaDBkSEJ6T2k4dlptRmpaV0p2YjJzdVoybDBhSFZpTG1sdkwzSmxZV04wTDJSdlkzTXZkRzl3TFd4bGRtVnNMV0Z3YVM1b2RHMXNJM0psWVdOMExtTm9hV3hrY21WdUxtTnZkVzUwWEc0Z0tseHVJQ29nUUhCaGNtRnRJSHMvS24wZ1kyaHBiR1J5Wlc0Z1EyaHBiR1J5Wlc0Z2RISmxaU0JqYjI1MFlXbHVaWEl1WEc0Z0tpQkFjbVYwZFhKdUlIdHVkVzFpWlhKOUlGUm9aU0J1ZFcxaVpYSWdiMllnWTJocGJHUnlaVzR1WEc0Z0tpOWNibVoxYm1OMGFXOXVJR052ZFc1MFEyaHBiR1J5Wlc0b1kyaHBiR1J5Wlc0c0lHTnZiblJsZUhRcElIdGNiaUFnY21WMGRYSnVJSFJ5WVhabGNuTmxRV3hzUTJocGJHUnlaVzRvWTJocGJHUnlaVzRzSUdadmNrVmhZMmhUYVc1bmJHVkRhR2xzWkVSMWJXMTVMQ0J1ZFd4c0tUdGNibjFjYmx4dUx5b3FYRzRnS2lCR2JHRjBkR1Z1SUdFZ1kyaHBiR1J5Wlc0Z2IySnFaV04wSUNoMGVYQnBZMkZzYkhrZ2MzQmxZMmxtYVdWa0lHRnpJR0J3Y205d2N5NWphR2xzWkhKbGJtQXBJR0Z1WkZ4dUlDb2djbVYwZFhKdUlHRnVJR0Z5Y21GNUlIZHBkR2dnWVhCd2NtOXdjbWxoZEdWc2VTQnlaUzFyWlhsbFpDQmphR2xzWkhKbGJpNWNiaUFxWEc0Z0tpQlRaV1VnYUhSMGNITTZMeTltWVdObFltOXZheTVuYVhSb2RXSXVhVzh2Y21WaFkzUXZaRzlqY3k5MGIzQXRiR1YyWld3dFlYQnBMbWgwYld3amNtVmhZM1F1WTJocGJHUnlaVzR1ZEc5aGNuSmhlVnh1SUNvdlhHNW1kVzVqZEdsdmJpQjBiMEZ5Y21GNUtHTm9hV3hrY21WdUtTQjdYRzRnSUhaaGNpQnlaWE4xYkhRZ1BTQmJYVHRjYmlBZ2JXRndTVzUwYjFkcGRHaExaWGxRY21WbWFYaEpiblJsY201aGJDaGphR2xzWkhKbGJpd2djbVZ6ZFd4MExDQnVkV3hzTENCbGJYQjBlVVoxYm1OMGFXOXVMblJvWVhSU1pYUjFjbTV6UVhKbmRXMWxiblFwTzF4dUlDQnlaWFIxY200Z2NtVnpkV3gwTzF4dWZWeHVYRzUyWVhJZ1VtVmhZM1JEYUdsc1pISmxiaUE5SUh0Y2JpQWdabTl5UldGamFEb2dabTl5UldGamFFTm9hV3hrY21WdUxGeHVJQ0J0WVhBNklHMWhjRU5vYVd4a2NtVnVMRnh1SUNCdFlYQkpiblJ2VjJsMGFFdGxlVkJ5WldacGVFbHVkR1Z5Ym1Gc09pQnRZWEJKYm5SdlYybDBhRXRsZVZCeVpXWnBlRWx1ZEdWeWJtRnNMRnh1SUNCamIzVnVkRG9nWTI5MWJuUkRhR2xzWkhKbGJpeGNiaUFnZEc5QmNuSmhlVG9nZEc5QmNuSmhlVnh1ZlR0Y2JseHViVzlrZFd4bExtVjRjRzl5ZEhNZ1BTQlNaV0ZqZEVOb2FXeGtjbVZ1T3lJc0lpOHFLbHh1SUNvZ1EyOXdlWEpwWjJoMElESXdNVFl0Y0hKbGMyVnVkQ3dnUm1GalpXSnZiMnNzSUVsdVl5NWNiaUFxSUVGc2JDQnlhV2RvZEhNZ2NtVnpaWEoyWldRdVhHNGdLbHh1SUNvZ1ZHaHBjeUJ6YjNWeVkyVWdZMjlrWlNCcGN5QnNhV05sYm5ObFpDQjFibVJsY2lCMGFHVWdRbE5FTFhOMGVXeGxJR3hwWTJWdWMyVWdabTkxYm1RZ2FXNGdkR2hsWEc0Z0tpQk1TVU5GVGxORklHWnBiR1VnYVc0Z2RHaGxJSEp2YjNRZ1pHbHlaV04wYjNKNUlHOW1JSFJvYVhNZ2MyOTFjbU5sSUhSeVpXVXVJRUZ1SUdGa1pHbDBhVzl1WVd3Z1ozSmhiblJjYmlBcUlHOW1JSEJoZEdWdWRDQnlhV2RvZEhNZ1kyRnVJR0psSUdadmRXNWtJR2x1SUhSb1pTQlFRVlJGVGxSVElHWnBiR1VnYVc0Z2RHaGxJSE5oYldVZ1pHbHlaV04wYjNKNUxseHVJQ3BjYmlBcUlGeHVJQ292WEc1Y2JpZDFjMlVnYzNSeWFXTjBKenRjYmx4dWRtRnlJRjl3Y205a1NXNTJZWEpwWVc1MElEMGdjbVZ4ZFdseVpTZ25MaTl5WldGamRGQnliMlJKYm5aaGNtbGhiblFuS1R0Y2JseHVkbUZ5SUZKbFlXTjBRM1Z5Y21WdWRFOTNibVZ5SUQwZ2NtVnhkV2x5WlNnbkxpOVNaV0ZqZEVOMWNuSmxiblJQZDI1bGNpY3BPMXh1WEc1MllYSWdhVzUyWVhKcFlXNTBJRDBnY21WeGRXbHlaU2duWm1KcWN5OXNhV0l2YVc1MllYSnBZVzUwSnlrN1hHNTJZWElnZDJGeWJtbHVaeUE5SUhKbGNYVnBjbVVvSjJaaWFuTXZiR2xpTDNkaGNtNXBibWNuS1R0Y2JseHVablZ1WTNScGIyNGdhWE5PWVhScGRtVW9abTRwSUh0Y2JpQWdMeThnUW1GelpXUWdiMjRnYVhOT1lYUnBkbVVvS1NCbWNtOXRJRXh2WkdGemFGeHVJQ0IyWVhJZ1puVnVZMVJ2VTNSeWFXNW5JRDBnUm5WdVkzUnBiMjR1Y0hKdmRHOTBlWEJsTG5SdlUzUnlhVzVuTzF4dUlDQjJZWElnYUdGelQzZHVVSEp2Y0dWeWRIa2dQU0JQWW1wbFkzUXVjSEp2ZEc5MGVYQmxMbWhoYzA5M2JsQnliM0JsY25SNU8xeHVJQ0IyWVhJZ2NtVkpjMDVoZEdsMlpTQTlJRkpsWjBWNGNDZ25YaWNnS3lCbWRXNWpWRzlUZEhKcGJtZGNiaUFnTHk4Z1ZHRnJaU0JoYmlCbGVHRnRjR3hsSUc1aGRHbDJaU0JtZFc1amRHbHZiaUJ6YjNWeVkyVWdabTl5SUdOdmJYQmhjbWx6YjI1Y2JpQWdMbU5oYkd3b2FHRnpUM2R1VUhKdmNHVnlkSGxjYmlBZ0x5OGdVM1J5YVhBZ2NtVm5aWGdnWTJoaGNtRmpkR1Z5Y3lCemJ5QjNaU0JqWVc0Z2RYTmxJR2wwSUdadmNpQnlaV2RsZUZ4dUlDQXBMbkpsY0d4aFkyVW9MMXRjWEZ4Y1hpUXVLaXMvS0NsYlhGeGRlMzE4WFM5bkxDQW5YRnhjWENRbUoxeHVJQ0F2THlCU1pXMXZkbVVnYUdGelQzZHVVSEp2Y0dWeWRIa2dabkp2YlNCMGFHVWdkR1Z0Y0d4aGRHVWdkRzhnYldGclpTQnBkQ0JuWlc1bGNtbGpYRzRnSUNrdWNtVndiR0ZqWlNndmFHRnpUM2R1VUhKdmNHVnlkSGw4S0daMWJtTjBhVzl1S1M0cVB5Zy9QVnhjWEZ4Y1hDZ3BmQ0JtYjNJZ0xpcy9LRDg5WEZ4Y1hGeGNYU2t2Wnl3Z0p5UXhMaW8vSnlrZ0t5QW5KQ2NwTzF4dUlDQjBjbmtnZTF4dUlDQWdJSFpoY2lCemIzVnlZMlVnUFNCbWRXNWpWRzlUZEhKcGJtY3VZMkZzYkNobWJpazdYRzRnSUNBZ2NtVjBkWEp1SUhKbFNYTk9ZWFJwZG1VdWRHVnpkQ2h6YjNWeVkyVXBPMXh1SUNCOUlHTmhkR05vSUNobGNuSXBJSHRjYmlBZ0lDQnlaWFIxY200Z1ptRnNjMlU3WEc0Z0lIMWNibjFjYmx4dWRtRnlJR05oYmxWelpVTnZiR3hsWTNScGIyNXpJRDFjYmk4dklFRnljbUY1TG1aeWIyMWNiblI1Y0dWdlppQkJjbkpoZVM1bWNtOXRJRDA5UFNBblpuVnVZM1JwYjI0bklDWW1YRzR2THlCTllYQmNiblI1Y0dWdlppQk5ZWEFnUFQwOUlDZG1kVzVqZEdsdmJpY2dKaVlnYVhOT1lYUnBkbVVvVFdGd0tTQW1KbHh1THk4Z1RXRndMbkJ5YjNSdmRIbHdaUzVyWlhselhHNU5ZWEF1Y0hKdmRHOTBlWEJsSUNFOUlHNTFiR3dnSmlZZ2RIbHdaVzltSUUxaGNDNXdjbTkwYjNSNWNHVXVhMlY1Y3lBOVBUMGdKMloxYm1OMGFXOXVKeUFtSmlCcGMwNWhkR2wyWlNoTllYQXVjSEp2ZEc5MGVYQmxMbXRsZVhNcElDWW1YRzR2THlCVFpYUmNiblI1Y0dWdlppQlRaWFFnUFQwOUlDZG1kVzVqZEdsdmJpY2dKaVlnYVhOT1lYUnBkbVVvVTJWMEtTQW1KbHh1THk4Z1UyVjBMbkJ5YjNSdmRIbHdaUzVyWlhselhHNVRaWFF1Y0hKdmRHOTBlWEJsSUNFOUlHNTFiR3dnSmlZZ2RIbHdaVzltSUZObGRDNXdjbTkwYjNSNWNHVXVhMlY1Y3lBOVBUMGdKMloxYm1OMGFXOXVKeUFtSmlCcGMwNWhkR2wyWlNoVFpYUXVjSEp2ZEc5MGVYQmxMbXRsZVhNcE8xeHVYRzUyWVhJZ2MyVjBTWFJsYlR0Y2JuWmhjaUJuWlhSSmRHVnRPMXh1ZG1GeUlISmxiVzkyWlVsMFpXMDdYRzUyWVhJZ1oyVjBTWFJsYlVsRWN6dGNiblpoY2lCaFpHUlNiMjkwTzF4dWRtRnlJSEpsYlc5MlpWSnZiM1E3WEc1MllYSWdaMlYwVW05dmRFbEVjenRjYmx4dWFXWWdLR05oYmxWelpVTnZiR3hsWTNScGIyNXpLU0I3WEc0Z0lIWmhjaUJwZEdWdFRXRndJRDBnYm1WM0lFMWhjQ2dwTzF4dUlDQjJZWElnY205dmRFbEVVMlYwSUQwZ2JtVjNJRk5sZENncE8xeHVYRzRnSUhObGRFbDBaVzBnUFNCbWRXNWpkR2x2YmlBb2FXUXNJR2wwWlcwcElIdGNiaUFnSUNCcGRHVnRUV0Z3TG5ObGRDaHBaQ3dnYVhSbGJTazdYRzRnSUgwN1hHNGdJR2RsZEVsMFpXMGdQU0JtZFc1amRHbHZiaUFvYVdRcElIdGNiaUFnSUNCeVpYUjFjbTRnYVhSbGJVMWhjQzVuWlhRb2FXUXBPMXh1SUNCOU8xeHVJQ0J5WlcxdmRtVkpkR1Z0SUQwZ1puVnVZM1JwYjI0Z0tHbGtLU0I3WEc0Z0lDQWdhWFJsYlUxaGNGc25aR1ZzWlhSbEoxMG9hV1FwTzF4dUlDQjlPMXh1SUNCblpYUkpkR1Z0U1VSeklEMGdablZ1WTNScGIyNGdLQ2tnZTF4dUlDQWdJSEpsZEhWeWJpQkJjbkpoZVM1bWNtOXRLR2wwWlcxTllYQXVhMlY1Y3lncEtUdGNiaUFnZlR0Y2JseHVJQ0JoWkdSU2IyOTBJRDBnWm5WdVkzUnBiMjRnS0dsa0tTQjdYRzRnSUNBZ2NtOXZkRWxFVTJWMExtRmtaQ2hwWkNrN1hHNGdJSDA3WEc0Z0lISmxiVzkyWlZKdmIzUWdQU0JtZFc1amRHbHZiaUFvYVdRcElIdGNiaUFnSUNCeWIyOTBTVVJUWlhSYkoyUmxiR1YwWlNkZEtHbGtLVHRjYmlBZ2ZUdGNiaUFnWjJWMFVtOXZkRWxFY3lBOUlHWjFibU4wYVc5dUlDZ3BJSHRjYmlBZ0lDQnlaWFIxY200Z1FYSnlZWGt1Wm5KdmJTaHliMjkwU1VSVFpYUXVhMlY1Y3lncEtUdGNiaUFnZlR0Y2JuMGdaV3h6WlNCN1hHNGdJSFpoY2lCcGRHVnRRbmxMWlhrZ1BTQjdmVHRjYmlBZ2RtRnlJSEp2YjNSQ2VVdGxlU0E5SUh0OU8xeHVYRzRnSUM4dklGVnpaU0J1YjI0dGJuVnRaWEpwWXlCclpYbHpJSFJ2SUhCeVpYWmxiblFnVmpnZ2NHVnlabTl5YldGdVkyVWdhWE56ZFdWek9seHVJQ0F2THlCb2RIUndjem92TDJkcGRHaDFZaTVqYjIwdlptRmpaV0p2YjJzdmNtVmhZM1F2Y0hWc2JDODNNak15WEc0Z0lIWmhjaUJuWlhSTFpYbEdjbTl0U1VRZ1BTQm1kVzVqZEdsdmJpQW9hV1FwSUh0Y2JpQWdJQ0J5WlhSMWNtNGdKeTRuSUNzZ2FXUTdYRzRnSUgwN1hHNGdJSFpoY2lCblpYUkpSRVp5YjIxTFpYa2dQU0JtZFc1amRHbHZiaUFvYTJWNUtTQjdYRzRnSUNBZ2NtVjBkWEp1SUhCaGNuTmxTVzUwS0d0bGVTNXpkV0p6ZEhJb01Ta3NJREV3S1R0Y2JpQWdmVHRjYmx4dUlDQnpaWFJKZEdWdElEMGdablZ1WTNScGIyNGdLR2xrTENCcGRHVnRLU0I3WEc0Z0lDQWdkbUZ5SUd0bGVTQTlJR2RsZEV0bGVVWnliMjFKUkNocFpDazdYRzRnSUNBZ2FYUmxiVUo1UzJWNVcydGxlVjBnUFNCcGRHVnRPMXh1SUNCOU8xeHVJQ0JuWlhSSmRHVnRJRDBnWm5WdVkzUnBiMjRnS0dsa0tTQjdYRzRnSUNBZ2RtRnlJR3RsZVNBOUlHZGxkRXRsZVVaeWIyMUpSQ2hwWkNrN1hHNGdJQ0FnY21WMGRYSnVJR2wwWlcxQ2VVdGxlVnRyWlhsZE8xeHVJQ0I5TzF4dUlDQnlaVzF2ZG1WSmRHVnRJRDBnWm5WdVkzUnBiMjRnS0dsa0tTQjdYRzRnSUNBZ2RtRnlJR3RsZVNBOUlHZGxkRXRsZVVaeWIyMUpSQ2hwWkNrN1hHNGdJQ0FnWkdWc1pYUmxJR2wwWlcxQ2VVdGxlVnRyWlhsZE8xeHVJQ0I5TzF4dUlDQm5aWFJKZEdWdFNVUnpJRDBnWm5WdVkzUnBiMjRnS0NrZ2UxeHVJQ0FnSUhKbGRIVnliaUJQWW1wbFkzUXVhMlY1Y3locGRHVnRRbmxMWlhrcExtMWhjQ2huWlhSSlJFWnliMjFMWlhrcE8xeHVJQ0I5TzF4dVhHNGdJR0ZrWkZKdmIzUWdQU0JtZFc1amRHbHZiaUFvYVdRcElIdGNiaUFnSUNCMllYSWdhMlY1SUQwZ1oyVjBTMlY1Um5KdmJVbEVLR2xrS1R0Y2JpQWdJQ0J5YjI5MFFubExaWGxiYTJWNVhTQTlJSFJ5ZFdVN1hHNGdJSDA3WEc0Z0lISmxiVzkyWlZKdmIzUWdQU0JtZFc1amRHbHZiaUFvYVdRcElIdGNiaUFnSUNCMllYSWdhMlY1SUQwZ1oyVjBTMlY1Um5KdmJVbEVLR2xrS1R0Y2JpQWdJQ0JrWld4bGRHVWdjbTl2ZEVKNVMyVjVXMnRsZVYwN1hHNGdJSDA3WEc0Z0lHZGxkRkp2YjNSSlJITWdQU0JtZFc1amRHbHZiaUFvS1NCN1hHNGdJQ0FnY21WMGRYSnVJRTlpYW1WamRDNXJaWGx6S0hKdmIzUkNlVXRsZVNrdWJXRndLR2RsZEVsRVJuSnZiVXRsZVNrN1hHNGdJSDA3WEc1OVhHNWNiblpoY2lCMWJtMXZkVzUwWldSSlJITWdQU0JiWFR0Y2JseHVablZ1WTNScGIyNGdjSFZ5WjJWRVpXVndLR2xrS1NCN1hHNGdJSFpoY2lCcGRHVnRJRDBnWjJWMFNYUmxiU2hwWkNrN1hHNGdJR2xtSUNocGRHVnRLU0I3WEc0Z0lDQWdkbUZ5SUdOb2FXeGtTVVJ6SUQwZ2FYUmxiUzVqYUdsc1pFbEVjenRjYmx4dUlDQWdJSEpsYlc5MlpVbDBaVzBvYVdRcE8xeHVJQ0FnSUdOb2FXeGtTVVJ6TG1admNrVmhZMmdvY0hWeVoyVkVaV1Z3S1R0Y2JpQWdmVnh1ZlZ4dVhHNW1kVzVqZEdsdmJpQmtaWE5qY21saVpVTnZiWEJ2Ym1WdWRFWnlZVzFsS0c1aGJXVXNJSE52ZFhKalpTd2diM2R1WlhKT1lXMWxLU0I3WEc0Z0lISmxkSFZ5YmlBblhGeHVJQ0FnSUdsdUlDY2dLeUFvYm1GdFpTQjhmQ0FuVlc1cmJtOTNiaWNwSUNzZ0tITnZkWEpqWlNBL0lDY2dLR0YwSUNjZ0t5QnpiM1Z5WTJVdVptbHNaVTVoYldVdWNtVndiR0ZqWlNndlhpNHFXMXhjWEZ4Y1hDOWRMeXdnSnljcElDc2dKem9uSUNzZ2MyOTFjbU5sTG14cGJtVk9kVzFpWlhJZ0t5QW5LU2NnT2lCdmQyNWxjazVoYldVZ1B5QW5JQ2hqY21WaGRHVmtJR0o1SUNjZ0t5QnZkMjVsY2s1aGJXVWdLeUFuS1NjZ09pQW5KeWs3WEc1OVhHNWNibVoxYm1OMGFXOXVJR2RsZEVScGMzQnNZWGxPWVcxbEtHVnNaVzFsYm5RcElIdGNiaUFnYVdZZ0tHVnNaVzFsYm5RZ1BUMGdiblZzYkNrZ2UxeHVJQ0FnSUhKbGRIVnliaUFuSTJWdGNIUjVKenRjYmlBZ2ZTQmxiSE5sSUdsbUlDaDBlWEJsYjJZZ1pXeGxiV1Z1ZENBOVBUMGdKM04wY21sdVp5Y2dmSHdnZEhsd1pXOW1JR1ZzWlcxbGJuUWdQVDA5SUNkdWRXMWlaWEluS1NCN1hHNGdJQ0FnY21WMGRYSnVJQ2NqZEdWNGRDYzdYRzRnSUgwZ1pXeHpaU0JwWmlBb2RIbHdaVzltSUdWc1pXMWxiblF1ZEhsd1pTQTlQVDBnSjNOMGNtbHVaeWNwSUh0Y2JpQWdJQ0J5WlhSMWNtNGdaV3hsYldWdWRDNTBlWEJsTzF4dUlDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUhKbGRIVnliaUJsYkdWdFpXNTBMblI1Y0dVdVpHbHpjR3hoZVU1aGJXVWdmSHdnWld4bGJXVnVkQzUwZVhCbExtNWhiV1VnZkh3Z0oxVnVhMjV2ZDI0bk8xeHVJQ0I5WEc1OVhHNWNibVoxYm1OMGFXOXVJR1JsYzJOeWFXSmxTVVFvYVdRcElIdGNiaUFnZG1GeUlHNWhiV1VnUFNCU1pXRmpkRU52YlhCdmJtVnVkRlJ5WldWSWIyOXJMbWRsZEVScGMzQnNZWGxPWVcxbEtHbGtLVHRjYmlBZ2RtRnlJR1ZzWlcxbGJuUWdQU0JTWldGamRFTnZiWEJ2Ym1WdWRGUnlaV1ZJYjI5ckxtZGxkRVZzWlcxbGJuUW9hV1FwTzF4dUlDQjJZWElnYjNkdVpYSkpSQ0E5SUZKbFlXTjBRMjl0Y0c5dVpXNTBWSEpsWlVodmIyc3VaMlYwVDNkdVpYSkpSQ2hwWkNrN1hHNGdJSFpoY2lCdmQyNWxjazVoYldVN1hHNGdJR2xtSUNodmQyNWxja2xFS1NCN1hHNGdJQ0FnYjNkdVpYSk9ZVzFsSUQwZ1VtVmhZM1JEYjIxd2IyNWxiblJVY21WbFNHOXZheTVuWlhSRWFYTndiR0Y1VG1GdFpTaHZkMjVsY2tsRUtUdGNiaUFnZlZ4dUlDQndjbTlqWlhOekxtVnVkaTVPVDBSRlgwVk9WaUFoUFQwZ0ozQnliMlIxWTNScGIyNG5JRDhnZDJGeWJtbHVaeWhsYkdWdFpXNTBMQ0FuVW1WaFkzUkRiMjF3YjI1bGJuUlVjbVZsU0c5dmF6b2dUV2x6YzJsdVp5QlNaV0ZqZENCbGJHVnRaVzUwSUdadmNpQmtaV0oxWjBsRUlDVnpJSGRvWlc0Z0p5QXJJQ2RpZFdsc1pHbHVaeUJ6ZEdGamF5Y3NJR2xrS1NBNklIWnZhV1FnTUR0Y2JpQWdjbVYwZFhKdUlHUmxjMk55YVdKbFEyOXRjRzl1Wlc1MFJuSmhiV1VvYm1GdFpTd2daV3hsYldWdWRDQW1KaUJsYkdWdFpXNTBMbDl6YjNWeVkyVXNJRzkzYm1WeVRtRnRaU2s3WEc1OVhHNWNiblpoY2lCU1pXRmpkRU52YlhCdmJtVnVkRlJ5WldWSWIyOXJJRDBnZTF4dUlDQnZibE5sZEVOb2FXeGtjbVZ1T2lCbWRXNWpkR2x2YmlBb2FXUXNJRzVsZUhSRGFHbHNaRWxFY3lrZ2UxeHVJQ0FnSUhaaGNpQnBkR1Z0SUQwZ1oyVjBTWFJsYlNocFpDazdYRzRnSUNBZ0lXbDBaVzBnUHlCd2NtOWpaWE56TG1WdWRpNU9UMFJGWDBWT1ZpQWhQVDBnSjNCeWIyUjFZM1JwYjI0bklEOGdhVzUyWVhKcFlXNTBLR1poYkhObExDQW5TWFJsYlNCdGRYTjBJR2hoZG1VZ1ltVmxiaUJ6WlhRbktTQTZJRjl3Y205a1NXNTJZWEpwWVc1MEtDY3hORFFuS1NBNklIWnZhV1FnTUR0Y2JpQWdJQ0JwZEdWdExtTm9hV3hrU1VSeklEMGdibVY0ZEVOb2FXeGtTVVJ6TzF4dVhHNGdJQ0FnWm05eUlDaDJZWElnYVNBOUlEQTdJR2tnUENCdVpYaDBRMmhwYkdSSlJITXViR1Z1WjNSb095QnBLeXNwSUh0Y2JpQWdJQ0FnSUhaaGNpQnVaWGgwUTJocGJHUkpSQ0E5SUc1bGVIUkRhR2xzWkVsRWMxdHBYVHRjYmlBZ0lDQWdJSFpoY2lCdVpYaDBRMmhwYkdRZ1BTQm5aWFJKZEdWdEtHNWxlSFJEYUdsc1pFbEVLVHRjYmlBZ0lDQWdJQ0Z1WlhoMFEyaHBiR1FnUHlCd2NtOWpaWE56TG1WdWRpNU9UMFJGWDBWT1ZpQWhQVDBnSjNCeWIyUjFZM1JwYjI0bklEOGdhVzUyWVhKcFlXNTBLR1poYkhObExDQW5SWGh3WldOMFpXUWdhRzl2YXlCbGRtVnVkSE1nZEc4Z1ptbHlaU0JtYjNJZ2RHaGxJR05vYVd4a0lHSmxabTl5WlNCcGRITWdjR0Z5Wlc1MElHbHVZMngxWkdWeklHbDBJR2x1SUc5dVUyVjBRMmhwYkdSeVpXNG9LUzRuS1NBNklGOXdjbTlrU1c1MllYSnBZVzUwS0NjeE5EQW5LU0E2SUhadmFXUWdNRHRjYmlBZ0lDQWdJQ0VvYm1WNGRFTm9hV3hrTG1Ob2FXeGtTVVJ6SUNFOUlHNTFiR3dnZkh3Z2RIbHdaVzltSUc1bGVIUkRhR2xzWkM1bGJHVnRaVzUwSUNFOVBTQW5iMkpxWldOMEp5QjhmQ0J1WlhoMFEyaHBiR1F1Wld4bGJXVnVkQ0E5UFNCdWRXeHNLU0EvSUhCeWIyTmxjM011Wlc1MkxrNVBSRVZmUlU1V0lDRTlQU0FuY0hKdlpIVmpkR2x2YmljZ1B5QnBiblpoY21saGJuUW9abUZzYzJVc0lDZEZlSEJsWTNSbFpDQnZibE5sZEVOb2FXeGtjbVZ1S0NrZ2RHOGdabWx5WlNCbWIzSWdZU0JqYjI1MFlXbHVaWElnWTJocGJHUWdZbVZtYjNKbElHbDBjeUJ3WVhKbGJuUWdhVzVqYkhWa1pYTWdhWFFnYVc0Z2IyNVRaWFJEYUdsc1pISmxiaWdwTGljcElEb2dYM0J5YjJSSmJuWmhjbWxoYm5Rb0p6RTBNU2NwSURvZ2RtOXBaQ0F3TzF4dUlDQWdJQ0FnSVc1bGVIUkRhR2xzWkM1cGMwMXZkVzUwWldRZ1B5QndjbTlqWlhOekxtVnVkaTVPVDBSRlgwVk9WaUFoUFQwZ0ozQnliMlIxWTNScGIyNG5JRDhnYVc1MllYSnBZVzUwS0daaGJITmxMQ0FuUlhod1pXTjBaV1FnYjI1TmIzVnVkRU52YlhCdmJtVnVkQ2dwSUhSdklHWnBjbVVnWm05eUlIUm9aU0JqYUdsc1pDQmlaV1p2Y21VZ2FYUnpJSEJoY21WdWRDQnBibU5zZFdSbGN5QnBkQ0JwYmlCdmJsTmxkRU5vYVd4a2NtVnVLQ2t1SnlrZ09pQmZjSEp2WkVsdWRtRnlhV0Z1ZENnbk56RW5LU0E2SUhadmFXUWdNRHRjYmlBZ0lDQWdJR2xtSUNodVpYaDBRMmhwYkdRdWNHRnlaVzUwU1VRZ1BUMGdiblZzYkNrZ2UxeHVJQ0FnSUNBZ0lDQnVaWGgwUTJocGJHUXVjR0Z5Wlc1MFNVUWdQU0JwWkR0Y2JpQWdJQ0FnSUNBZ0x5OGdWRTlFVHpvZ1ZHaHBjeUJ6YUc5MWJHUnVKM1FnWW1VZ2JtVmpaWE56WVhKNUlHSjFkQ0J0YjNWdWRHbHVaeUJoSUc1bGR5QnliMjkwSUdSMWNtbHVaeUJwYmx4dUlDQWdJQ0FnSUNBdkx5QmpiMjF3YjI1bGJuUlhhV3hzVFc5MWJuUWdZM1Z5Y21WdWRHeDVJR05oZFhObGN5QnViM1F0ZVdWMExXMXZkVzUwWldRZ1kyOXRjRzl1Wlc1MGN5QjBiMXh1SUNBZ0lDQWdJQ0F2THlCaVpTQndkWEpuWldRZ1puSnZiU0J2ZFhJZ2RISmxaU0JrWVhSaElITnZJSFJvWldseUlIQmhjbVZ1ZENCcFpDQnBjeUJ0YVhOemFXNW5MbHh1SUNBZ0lDQWdmVnh1SUNBZ0lDQWdJU2h1WlhoMFEyaHBiR1F1Y0dGeVpXNTBTVVFnUFQwOUlHbGtLU0EvSUhCeWIyTmxjM011Wlc1MkxrNVBSRVZmUlU1V0lDRTlQU0FuY0hKdlpIVmpkR2x2YmljZ1B5QnBiblpoY21saGJuUW9abUZzYzJVc0lDZEZlSEJsWTNSbFpDQnZia0psWm05eVpVMXZkVzUwUTI5dGNHOXVaVzUwS0NrZ2NHRnlaVzUwSUdGdVpDQnZibE5sZEVOb2FXeGtjbVZ1S0NrZ2RHOGdZbVVnWTI5dWMybHpkR1Z1ZENBb0pYTWdhR0Z6SUhCaGNtVnVkSE1nSlhNZ1lXNWtJQ1Z6S1M0bkxDQnVaWGgwUTJocGJHUkpSQ3dnYm1WNGRFTm9hV3hrTG5CaGNtVnVkRWxFTENCcFpDa2dPaUJmY0hKdlpFbHVkbUZ5YVdGdWRDZ25NVFF5Snl3Z2JtVjRkRU5vYVd4a1NVUXNJRzVsZUhSRGFHbHNaQzV3WVhKbGJuUkpSQ3dnYVdRcElEb2dkbTlwWkNBd08xeHVJQ0FnSUgxY2JpQWdmU3hjYmlBZ2IyNUNaV1p2Y21WTmIzVnVkRU52YlhCdmJtVnVkRG9nWm5WdVkzUnBiMjRnS0dsa0xDQmxiR1Z0Wlc1MExDQndZWEpsYm5SSlJDa2dlMXh1SUNBZ0lIWmhjaUJwZEdWdElEMGdlMXh1SUNBZ0lDQWdaV3hsYldWdWREb2daV3hsYldWdWRDeGNiaUFnSUNBZ0lIQmhjbVZ1ZEVsRU9pQndZWEpsYm5SSlJDeGNiaUFnSUNBZ0lIUmxlSFE2SUc1MWJHd3NYRzRnSUNBZ0lDQmphR2xzWkVsRWN6b2dXMTBzWEc0Z0lDQWdJQ0JwYzAxdmRXNTBaV1E2SUdaaGJITmxMRnh1SUNBZ0lDQWdkWEJrWVhSbFEyOTFiblE2SURCY2JpQWdJQ0I5TzF4dUlDQWdJSE5sZEVsMFpXMG9hV1FzSUdsMFpXMHBPMXh1SUNCOUxGeHVJQ0J2YmtKbFptOXlaVlZ3WkdGMFpVTnZiWEJ2Ym1WdWREb2dablZ1WTNScGIyNGdLR2xrTENCbGJHVnRaVzUwS1NCN1hHNGdJQ0FnZG1GeUlHbDBaVzBnUFNCblpYUkpkR1Z0S0dsa0tUdGNiaUFnSUNCcFppQW9JV2wwWlcwZ2ZId2dJV2wwWlcwdWFYTk5iM1Z1ZEdWa0tTQjdYRzRnSUNBZ0lDQXZMeUJYWlNCdFlYa2daVzVrSUhWd0lHaGxjbVVnWVhNZ1lTQnlaWE4xYkhRZ2IyWWdjMlYwVTNSaGRHVW9LU0JwYmlCamIyMXdiMjVsYm5SWGFXeHNWVzV0YjNWdWRDZ3BMbHh1SUNBZ0lDQWdMeThnU1c0Z2RHaHBjeUJqWVhObExDQnBaMjV2Y21VZ2RHaGxJR1ZzWlcxbGJuUXVYRzRnSUNBZ0lDQnlaWFIxY200N1hHNGdJQ0FnZlZ4dUlDQWdJR2wwWlcwdVpXeGxiV1Z1ZENBOUlHVnNaVzFsYm5RN1hHNGdJSDBzWEc0Z0lHOXVUVzkxYm5SRGIyMXdiMjVsYm5RNklHWjFibU4wYVc5dUlDaHBaQ2tnZTF4dUlDQWdJSFpoY2lCcGRHVnRJRDBnWjJWMFNYUmxiU2hwWkNrN1hHNGdJQ0FnSVdsMFpXMGdQeUJ3Y205alpYTnpMbVZ1ZGk1T1QwUkZYMFZPVmlBaFBUMGdKM0J5YjJSMVkzUnBiMjRuSUQ4Z2FXNTJZWEpwWVc1MEtHWmhiSE5sTENBblNYUmxiU0J0ZFhOMElHaGhkbVVnWW1WbGJpQnpaWFFuS1NBNklGOXdjbTlrU1c1MllYSnBZVzUwS0NjeE5EUW5LU0E2SUhadmFXUWdNRHRjYmlBZ0lDQnBkR1Z0TG1selRXOTFiblJsWkNBOUlIUnlkV1U3WEc0Z0lDQWdkbUZ5SUdselVtOXZkQ0E5SUdsMFpXMHVjR0Z5Wlc1MFNVUWdQVDA5SURBN1hHNGdJQ0FnYVdZZ0tHbHpVbTl2ZENrZ2UxeHVJQ0FnSUNBZ1lXUmtVbTl2ZENocFpDazdYRzRnSUNBZ2ZWeHVJQ0I5TEZ4dUlDQnZibFZ3WkdGMFpVTnZiWEJ2Ym1WdWREb2dablZ1WTNScGIyNGdLR2xrS1NCN1hHNGdJQ0FnZG1GeUlHbDBaVzBnUFNCblpYUkpkR1Z0S0dsa0tUdGNiaUFnSUNCcFppQW9JV2wwWlcwZ2ZId2dJV2wwWlcwdWFYTk5iM1Z1ZEdWa0tTQjdYRzRnSUNBZ0lDQXZMeUJYWlNCdFlYa2daVzVrSUhWd0lHaGxjbVVnWVhNZ1lTQnlaWE4xYkhRZ2IyWWdjMlYwVTNSaGRHVW9LU0JwYmlCamIyMXdiMjVsYm5SWGFXeHNWVzV0YjNWdWRDZ3BMbHh1SUNBZ0lDQWdMeThnU1c0Z2RHaHBjeUJqWVhObExDQnBaMjV2Y21VZ2RHaGxJR1ZzWlcxbGJuUXVYRzRnSUNBZ0lDQnlaWFIxY200N1hHNGdJQ0FnZlZ4dUlDQWdJR2wwWlcwdWRYQmtZWFJsUTI5MWJuUXJLenRjYmlBZ2ZTeGNiaUFnYjI1VmJtMXZkVzUwUTI5dGNHOXVaVzUwT2lCbWRXNWpkR2x2YmlBb2FXUXBJSHRjYmlBZ0lDQjJZWElnYVhSbGJTQTlJR2RsZEVsMFpXMG9hV1FwTzF4dUlDQWdJR2xtSUNocGRHVnRLU0I3WEc0Z0lDQWdJQ0F2THlCWFpTQnVaV1ZrSUhSdklHTm9aV05ySUdsbUlHbDBJR1Y0YVhOMGN5NWNiaUFnSUNBZ0lDOHZJR0JwZEdWdFlDQnRhV2RvZENCdWIzUWdaWGhwYzNRZ2FXWWdhWFFnYVhNZ2FXNXphV1JsSUdGdUlHVnljbTl5SUdKdmRXNWtZWEo1TENCaGJtUWdZU0J6YVdKc2FXNW5YRzRnSUNBZ0lDQXZMeUJsY25KdmNpQmliM1Z1WkdGeWVTQmphR2xzWkNCMGFISmxkeUIzYUdsc1pTQnRiM1Z1ZEdsdVp5NGdWR2hsYmlCMGFHbHpJR2x1YzNSaGJtTmxJRzVsZG1WeVhHNGdJQ0FnSUNBdkx5Qm5iM1FnWVNCamFHRnVZMlVnZEc4Z2JXOTFiblFzSUdKMWRDQnBkQ0J6ZEdsc2JDQm5aWFJ6SUdGdUlIVnViVzkxYm5ScGJtY2daWFpsYm5RZ1pIVnlhVzVuWEc0Z0lDQWdJQ0F2THlCMGFHVWdaWEp5YjNJZ1ltOTFibVJoY25rZ1kyeGxZVzUxY0M1Y2JpQWdJQ0FnSUdsMFpXMHVhWE5OYjNWdWRHVmtJRDBnWm1Gc2MyVTdYRzRnSUNBZ0lDQjJZWElnYVhOU2IyOTBJRDBnYVhSbGJTNXdZWEpsYm5SSlJDQTlQVDBnTUR0Y2JpQWdJQ0FnSUdsbUlDaHBjMUp2YjNRcElIdGNiaUFnSUNBZ0lDQWdjbVZ0YjNabFVtOXZkQ2hwWkNrN1hHNGdJQ0FnSUNCOVhHNGdJQ0FnZlZ4dUlDQWdJSFZ1Ylc5MWJuUmxaRWxFY3k1d2RYTm9LR2xrS1R0Y2JpQWdmU3hjYmlBZ2NIVnlaMlZWYm0xdmRXNTBaV1JEYjIxd2IyNWxiblJ6T2lCbWRXNWpkR2x2YmlBb0tTQjdYRzRnSUNBZ2FXWWdLRkpsWVdOMFEyOXRjRzl1Wlc1MFZISmxaVWh2YjJzdVgzQnlaWFpsYm5SUWRYSm5hVzVuS1NCN1hHNGdJQ0FnSUNBdkx5QlRhRzkxYkdRZ2IyNXNlU0JpWlNCMWMyVmtJR1p2Y2lCMFpYTjBhVzVuTGx4dUlDQWdJQ0FnY21WMGRYSnVPMXh1SUNBZ0lIMWNibHh1SUNBZ0lHWnZjaUFvZG1GeUlHa2dQU0F3T3lCcElEd2dkVzV0YjNWdWRHVmtTVVJ6TG14bGJtZDBhRHNnYVNzcktTQjdYRzRnSUNBZ0lDQjJZWElnYVdRZ1BTQjFibTF2ZFc1MFpXUkpSSE5iYVYwN1hHNGdJQ0FnSUNCd2RYSm5aVVJsWlhBb2FXUXBPMXh1SUNBZ0lIMWNiaUFnSUNCMWJtMXZkVzUwWldSSlJITXViR1Z1WjNSb0lEMGdNRHRjYmlBZ2ZTeGNiaUFnYVhOTmIzVnVkR1ZrT2lCbWRXNWpkR2x2YmlBb2FXUXBJSHRjYmlBZ0lDQjJZWElnYVhSbGJTQTlJR2RsZEVsMFpXMG9hV1FwTzF4dUlDQWdJSEpsZEhWeWJpQnBkR1Z0SUQ4Z2FYUmxiUzVwYzAxdmRXNTBaV1FnT2lCbVlXeHpaVHRjYmlBZ2ZTeGNiaUFnWjJWMFEzVnljbVZ1ZEZOMFlXTnJRV1JrWlc1a2RXMDZJR1oxYm1OMGFXOXVJQ2gwYjNCRmJHVnRaVzUwS1NCN1hHNGdJQ0FnZG1GeUlHbHVabThnUFNBbkp6dGNiaUFnSUNCcFppQW9kRzl3Uld4bGJXVnVkQ2tnZTF4dUlDQWdJQ0FnZG1GeUlHNWhiV1VnUFNCblpYUkVhWE53YkdGNVRtRnRaU2gwYjNCRmJHVnRaVzUwS1R0Y2JpQWdJQ0FnSUhaaGNpQnZkMjVsY2lBOUlIUnZjRVZzWlcxbGJuUXVYMjkzYm1WeU8xeHVJQ0FnSUNBZ2FXNW1ieUFyUFNCa1pYTmpjbWxpWlVOdmJYQnZibVZ1ZEVaeVlXMWxLRzVoYldVc0lIUnZjRVZzWlcxbGJuUXVYM052ZFhKalpTd2diM2R1WlhJZ0ppWWdiM2R1WlhJdVoyVjBUbUZ0WlNncEtUdGNiaUFnSUNCOVhHNWNiaUFnSUNCMllYSWdZM1Z5Y21WdWRFOTNibVZ5SUQwZ1VtVmhZM1JEZFhKeVpXNTBUM2R1WlhJdVkzVnljbVZ1ZER0Y2JpQWdJQ0IyWVhJZ2FXUWdQU0JqZFhKeVpXNTBUM2R1WlhJZ0ppWWdZM1Z5Y21WdWRFOTNibVZ5TGw5a1pXSjFaMGxFTzF4dVhHNGdJQ0FnYVc1bWJ5QXJQU0JTWldGamRFTnZiWEJ2Ym1WdWRGUnlaV1ZJYjI5ckxtZGxkRk4wWVdOclFXUmtaVzVrZFcxQ2VVbEVLR2xrS1R0Y2JpQWdJQ0J5WlhSMWNtNGdhVzVtYnp0Y2JpQWdmU3hjYmlBZ1oyVjBVM1JoWTJ0QlpHUmxibVIxYlVKNVNVUTZJR1oxYm1OMGFXOXVJQ2hwWkNrZ2UxeHVJQ0FnSUhaaGNpQnBibVp2SUQwZ0p5YzdYRzRnSUNBZ2QyaHBiR1VnS0dsa0tTQjdYRzRnSUNBZ0lDQnBibVp2SUNzOUlHUmxjMk55YVdKbFNVUW9hV1FwTzF4dUlDQWdJQ0FnYVdRZ1BTQlNaV0ZqZEVOdmJYQnZibVZ1ZEZSeVpXVkliMjlyTG1kbGRGQmhjbVZ1ZEVsRUtHbGtLVHRjYmlBZ0lDQjlYRzRnSUNBZ2NtVjBkWEp1SUdsdVptODdYRzRnSUgwc1hHNGdJR2RsZEVOb2FXeGtTVVJ6T2lCbWRXNWpkR2x2YmlBb2FXUXBJSHRjYmlBZ0lDQjJZWElnYVhSbGJTQTlJR2RsZEVsMFpXMG9hV1FwTzF4dUlDQWdJSEpsZEhWeWJpQnBkR1Z0SUQ4Z2FYUmxiUzVqYUdsc1pFbEVjeUE2SUZ0ZE8xeHVJQ0I5TEZ4dUlDQm5aWFJFYVhOd2JHRjVUbUZ0WlRvZ1puVnVZM1JwYjI0Z0tHbGtLU0I3WEc0Z0lDQWdkbUZ5SUdWc1pXMWxiblFnUFNCU1pXRmpkRU52YlhCdmJtVnVkRlJ5WldWSWIyOXJMbWRsZEVWc1pXMWxiblFvYVdRcE8xeHVJQ0FnSUdsbUlDZ2haV3hsYldWdWRDa2dlMXh1SUNBZ0lDQWdjbVYwZFhKdUlHNTFiR3c3WEc0Z0lDQWdmVnh1SUNBZ0lISmxkSFZ5YmlCblpYUkVhWE53YkdGNVRtRnRaU2hsYkdWdFpXNTBLVHRjYmlBZ2ZTeGNiaUFnWjJWMFJXeGxiV1Z1ZERvZ1puVnVZM1JwYjI0Z0tHbGtLU0I3WEc0Z0lDQWdkbUZ5SUdsMFpXMGdQU0JuWlhSSmRHVnRLR2xrS1R0Y2JpQWdJQ0J5WlhSMWNtNGdhWFJsYlNBL0lHbDBaVzB1Wld4bGJXVnVkQ0E2SUc1MWJHdzdYRzRnSUgwc1hHNGdJR2RsZEU5M2JtVnlTVVE2SUdaMWJtTjBhVzl1SUNocFpDa2dlMXh1SUNBZ0lIWmhjaUJsYkdWdFpXNTBJRDBnVW1WaFkzUkRiMjF3YjI1bGJuUlVjbVZsU0c5dmF5NW5aWFJGYkdWdFpXNTBLR2xrS1R0Y2JpQWdJQ0JwWmlBb0lXVnNaVzFsYm5RZ2ZId2dJV1ZzWlcxbGJuUXVYMjkzYm1WeUtTQjdYRzRnSUNBZ0lDQnlaWFIxY200Z2JuVnNiRHRjYmlBZ0lDQjlYRzRnSUNBZ2NtVjBkWEp1SUdWc1pXMWxiblF1WDI5M2JtVnlMbDlrWldKMVowbEVPMXh1SUNCOUxGeHVJQ0JuWlhSUVlYSmxiblJKUkRvZ1puVnVZM1JwYjI0Z0tHbGtLU0I3WEc0Z0lDQWdkbUZ5SUdsMFpXMGdQU0JuWlhSSmRHVnRLR2xrS1R0Y2JpQWdJQ0J5WlhSMWNtNGdhWFJsYlNBL0lHbDBaVzB1Y0dGeVpXNTBTVVFnT2lCdWRXeHNPMXh1SUNCOUxGeHVJQ0JuWlhSVGIzVnlZMlU2SUdaMWJtTjBhVzl1SUNocFpDa2dlMXh1SUNBZ0lIWmhjaUJwZEdWdElEMGdaMlYwU1hSbGJTaHBaQ2s3WEc0Z0lDQWdkbUZ5SUdWc1pXMWxiblFnUFNCcGRHVnRJRDhnYVhSbGJTNWxiR1Z0Wlc1MElEb2diblZzYkR0Y2JpQWdJQ0IyWVhJZ2MyOTFjbU5sSUQwZ1pXeGxiV1Z1ZENBaFBTQnVkV3hzSUQ4Z1pXeGxiV1Z1ZEM1ZmMyOTFjbU5sSURvZ2JuVnNiRHRjYmlBZ0lDQnlaWFIxY200Z2MyOTFjbU5sTzF4dUlDQjlMRnh1SUNCblpYUlVaWGgwT2lCbWRXNWpkR2x2YmlBb2FXUXBJSHRjYmlBZ0lDQjJZWElnWld4bGJXVnVkQ0E5SUZKbFlXTjBRMjl0Y0c5dVpXNTBWSEpsWlVodmIyc3VaMlYwUld4bGJXVnVkQ2hwWkNrN1hHNGdJQ0FnYVdZZ0tIUjVjR1Z2WmlCbGJHVnRaVzUwSUQwOVBTQW5jM1J5YVc1bkp5a2dlMXh1SUNBZ0lDQWdjbVYwZFhKdUlHVnNaVzFsYm5RN1hHNGdJQ0FnZlNCbGJITmxJR2xtSUNoMGVYQmxiMllnWld4bGJXVnVkQ0E5UFQwZ0oyNTFiV0psY2ljcElIdGNiaUFnSUNBZ0lISmxkSFZ5YmlBbkp5QXJJR1ZzWlcxbGJuUTdYRzRnSUNBZ2ZTQmxiSE5sSUh0Y2JpQWdJQ0FnSUhKbGRIVnliaUJ1ZFd4c08xeHVJQ0FnSUgxY2JpQWdmU3hjYmlBZ1oyVjBWWEJrWVhSbFEyOTFiblE2SUdaMWJtTjBhVzl1SUNocFpDa2dlMXh1SUNBZ0lIWmhjaUJwZEdWdElEMGdaMlYwU1hSbGJTaHBaQ2s3WEc0Z0lDQWdjbVYwZFhKdUlHbDBaVzBnUHlCcGRHVnRMblZ3WkdGMFpVTnZkVzUwSURvZ01EdGNiaUFnZlN4Y2JseHVYRzRnSUdkbGRGSnZiM1JKUkhNNklHZGxkRkp2YjNSSlJITXNYRzRnSUdkbGRGSmxaMmx6ZEdWeVpXUkpSSE02SUdkbGRFbDBaVzFKUkhNc1hHNWNiaUFnY0hWemFFNXZibE4wWVc1a1lYSmtWMkZ5Ym1sdVoxTjBZV05yT2lCbWRXNWpkR2x2YmlBb2FYTkRjbVZoZEdsdVowVnNaVzFsYm5Rc0lHTjFjbkpsYm5SVGIzVnlZMlVwSUh0Y2JpQWdJQ0JwWmlBb2RIbHdaVzltSUdOdmJuTnZiR1V1Y21WaFkzUlRkR0ZqYXlBaFBUMGdKMloxYm1OMGFXOXVKeWtnZTF4dUlDQWdJQ0FnY21WMGRYSnVPMXh1SUNBZ0lIMWNibHh1SUNBZ0lIWmhjaUJ6ZEdGamF5QTlJRnRkTzF4dUlDQWdJSFpoY2lCamRYSnlaVzUwVDNkdVpYSWdQU0JTWldGamRFTjFjbkpsYm5SUGQyNWxjaTVqZFhKeVpXNTBPMXh1SUNBZ0lIWmhjaUJwWkNBOUlHTjFjbkpsYm5SUGQyNWxjaUFtSmlCamRYSnlaVzUwVDNkdVpYSXVYMlJsWW5WblNVUTdYRzVjYmlBZ0lDQjBjbmtnZTF4dUlDQWdJQ0FnYVdZZ0tHbHpRM0psWVhScGJtZEZiR1Z0Wlc1MEtTQjdYRzRnSUNBZ0lDQWdJSE4wWVdOckxuQjFjMmdvZTF4dUlDQWdJQ0FnSUNBZ0lHNWhiV1U2SUdsa0lEOGdVbVZoWTNSRGIyMXdiMjVsYm5SVWNtVmxTRzl2YXk1blpYUkVhWE53YkdGNVRtRnRaU2hwWkNrZ09pQnVkV3hzTEZ4dUlDQWdJQ0FnSUNBZ0lHWnBiR1ZPWVcxbE9pQmpkWEp5Wlc1MFUyOTFjbU5sSUQ4Z1kzVnljbVZ1ZEZOdmRYSmpaUzVtYVd4bFRtRnRaU0E2SUc1MWJHd3NYRzRnSUNBZ0lDQWdJQ0FnYkdsdVpVNTFiV0psY2pvZ1kzVnljbVZ1ZEZOdmRYSmpaU0EvSUdOMWNuSmxiblJUYjNWeVkyVXViR2x1WlU1MWJXSmxjaUE2SUc1MWJHeGNiaUFnSUNBZ0lDQWdmU2s3WEc0Z0lDQWdJQ0I5WEc1Y2JpQWdJQ0FnSUhkb2FXeGxJQ2hwWkNrZ2UxeHVJQ0FnSUNBZ0lDQjJZWElnWld4bGJXVnVkQ0E5SUZKbFlXTjBRMjl0Y0c5dVpXNTBWSEpsWlVodmIyc3VaMlYwUld4bGJXVnVkQ2hwWkNrN1hHNGdJQ0FnSUNBZ0lIWmhjaUJ3WVhKbGJuUkpSQ0E5SUZKbFlXTjBRMjl0Y0c5dVpXNTBWSEpsWlVodmIyc3VaMlYwVUdGeVpXNTBTVVFvYVdRcE8xeHVJQ0FnSUNBZ0lDQjJZWElnYjNkdVpYSkpSQ0E5SUZKbFlXTjBRMjl0Y0c5dVpXNTBWSEpsWlVodmIyc3VaMlYwVDNkdVpYSkpSQ2hwWkNrN1hHNGdJQ0FnSUNBZ0lIWmhjaUJ2ZDI1bGNrNWhiV1VnUFNCdmQyNWxja2xFSUQ4Z1VtVmhZM1JEYjIxd2IyNWxiblJVY21WbFNHOXZheTVuWlhSRWFYTndiR0Y1VG1GdFpTaHZkMjVsY2tsRUtTQTZJRzUxYkd3N1hHNGdJQ0FnSUNBZ0lIWmhjaUJ6YjNWeVkyVWdQU0JsYkdWdFpXNTBJQ1ltSUdWc1pXMWxiblF1WDNOdmRYSmpaVHRjYmlBZ0lDQWdJQ0FnYzNSaFkyc3VjSFZ6YUNoN1hHNGdJQ0FnSUNBZ0lDQWdibUZ0WlRvZ2IzZHVaWEpPWVcxbExGeHVJQ0FnSUNBZ0lDQWdJR1pwYkdWT1lXMWxPaUJ6YjNWeVkyVWdQeUJ6YjNWeVkyVXVabWxzWlU1aGJXVWdPaUJ1ZFd4c0xGeHVJQ0FnSUNBZ0lDQWdJR3hwYm1WT2RXMWlaWEk2SUhOdmRYSmpaU0EvSUhOdmRYSmpaUzVzYVc1bFRuVnRZbVZ5SURvZ2JuVnNiRnh1SUNBZ0lDQWdJQ0I5S1R0Y2JpQWdJQ0FnSUNBZ2FXUWdQU0J3WVhKbGJuUkpSRHRjYmlBZ0lDQWdJSDFjYmlBZ0lDQjlJR05oZEdOb0lDaGxjbklwSUh0Y2JpQWdJQ0FnSUM4dklFbHVkR1Z5Ym1Gc0lITjBZWFJsSUdseklHMWxjM05sWkNCMWNDNWNiaUFnSUNBZ0lDOHZJRk4wYjNBZ1luVnBiR1JwYm1jZ2RHaGxJSE4wWVdOcklDaHBkQ2R6SUdwMWMzUWdZU0J1YVdObElIUnZJR2hoZG1VcExseHVJQ0FnSUgxY2JseHVJQ0FnSUdOdmJuTnZiR1V1Y21WaFkzUlRkR0ZqYXloemRHRmpheWs3WEc0Z0lIMHNYRzRnSUhCdmNFNXZibE4wWVc1a1lYSmtWMkZ5Ym1sdVoxTjBZV05yT2lCbWRXNWpkR2x2YmlBb0tTQjdYRzRnSUNBZ2FXWWdLSFI1Y0dWdlppQmpiMjV6YjJ4bExuSmxZV04wVTNSaFkydEZibVFnSVQwOUlDZG1kVzVqZEdsdmJpY3BJSHRjYmlBZ0lDQWdJSEpsZEhWeWJqdGNiaUFnSUNCOVhHNGdJQ0FnWTI5dWMyOXNaUzV5WldGamRGTjBZV05yUlc1a0tDazdYRzRnSUgxY2JuMDdYRzVjYm0xdlpIVnNaUzVsZUhCdmNuUnpJRDBnVW1WaFkzUkRiMjF3YjI1bGJuUlVjbVZsU0c5dmF6c2lMQ0l2S2lwY2JpQXFJRU52Y0hseWFXZG9kQ0F5TURFekxYQnlaWE5sYm5Rc0lFWmhZMlZpYjI5ckxDQkpibU11WEc0Z0tpQkJiR3dnY21sbmFIUnpJSEpsYzJWeWRtVmtMbHh1SUNwY2JpQXFJRlJvYVhNZ2MyOTFjbU5sSUdOdlpHVWdhWE1nYkdsalpXNXpaV1FnZFc1a1pYSWdkR2hsSUVKVFJDMXpkSGxzWlNCc2FXTmxibk5sSUdadmRXNWtJR2x1SUhSb1pWeHVJQ29nVEVsRFJVNVRSU0JtYVd4bElHbHVJSFJvWlNCeWIyOTBJR1JwY21WamRHOXllU0J2WmlCMGFHbHpJSE52ZFhKalpTQjBjbVZsTGlCQmJpQmhaR1JwZEdsdmJtRnNJR2R5WVc1MFhHNGdLaUJ2WmlCd1lYUmxiblFnY21sbmFIUnpJR05oYmlCaVpTQm1iM1Z1WkNCcGJpQjBhR1VnVUVGVVJVNVVVeUJtYVd4bElHbHVJSFJvWlNCellXMWxJR1JwY21WamRHOXllUzVjYmlBcVhHNGdLaUJjYmlBcUwxeHVYRzRuZFhObElITjBjbWxqZENjN1hHNWNiaThxS2x4dUlDb2dTMlZsY0hNZ2RISmhZMnNnYjJZZ2RHaGxJR04xY25KbGJuUWdiM2R1WlhJdVhHNGdLbHh1SUNvZ1ZHaGxJR04xY25KbGJuUWdiM2R1WlhJZ2FYTWdkR2hsSUdOdmJYQnZibVZ1ZENCM2FHOGdjMmh2ZFd4a0lHOTNiaUJoYm5rZ1kyOXRjRzl1Wlc1MGN5QjBhR0YwSUdGeVpWeHVJQ29nWTNWeWNtVnVkR3g1SUdKbGFXNW5JR052Ym5OMGNuVmpkR1ZrTGx4dUlDb3ZYRzUyWVhJZ1VtVmhZM1JEZFhKeVpXNTBUM2R1WlhJZ1BTQjdYRzRnSUM4cUtseHVJQ0FnS2lCQWFXNTBaWEp1WVd4Y2JpQWdJQ29nUUhSNWNHVWdlMUpsWVdOMFEyOXRjRzl1Wlc1MGZWeHVJQ0FnS2k5Y2JpQWdZM1Z5Y21WdWREb2diblZzYkZ4dWZUdGNibHh1Ylc5a2RXeGxMbVY0Y0c5eWRITWdQU0JTWldGamRFTjFjbkpsYm5SUGQyNWxjanNpTENJdktpcGNiaUFxSUVOdmNIbHlhV2RvZENBeU1ERXpMWEJ5WlhObGJuUXNJRVpoWTJWaWIyOXJMQ0JKYm1NdVhHNGdLaUJCYkd3Z2NtbG5hSFJ6SUhKbGMyVnlkbVZrTGx4dUlDcGNiaUFxSUZSb2FYTWdjMjkxY21ObElHTnZaR1VnYVhNZ2JHbGpaVzV6WldRZ2RXNWtaWElnZEdobElFSlRSQzF6ZEhsc1pTQnNhV05sYm5ObElHWnZkVzVrSUdsdUlIUm9aVnh1SUNvZ1RFbERSVTVUUlNCbWFXeGxJR2x1SUhSb1pTQnliMjkwSUdScGNtVmpkRzl5ZVNCdlppQjBhR2x6SUhOdmRYSmpaU0IwY21WbExpQkJiaUJoWkdScGRHbHZibUZzSUdkeVlXNTBYRzRnS2lCdlppQndZWFJsYm5RZ2NtbG5hSFJ6SUdOaGJpQmlaU0JtYjNWdVpDQnBiaUIwYUdVZ1VFRlVSVTVVVXlCbWFXeGxJR2x1SUhSb1pTQnpZVzFsSUdScGNtVmpkRzl5ZVM1Y2JpQXFYRzRnS2k5Y2JseHVKM1Z6WlNCemRISnBZM1FuTzF4dVhHNTJZWElnVW1WaFkzUkZiR1Z0Wlc1MElEMGdjbVZ4ZFdseVpTZ25MaTlTWldGamRFVnNaVzFsYm5RbktUdGNibHh1THlvcVhHNGdLaUJEY21WaGRHVWdZU0JtWVdOMGIzSjVJSFJvWVhRZ1kzSmxZWFJsY3lCSVZFMU1JSFJoWnlCbGJHVnRaVzUwY3k1Y2JpQXFYRzRnS2lCQWNISnBkbUYwWlZ4dUlDb3ZYRzUyWVhJZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNBOUlGSmxZV04wUld4bGJXVnVkQzVqY21WaGRHVkdZV04wYjNKNU8xeHVhV1lnS0hCeWIyTmxjM011Wlc1MkxrNVBSRVZmUlU1V0lDRTlQU0FuY0hKdlpIVmpkR2x2YmljcElIdGNiaUFnZG1GeUlGSmxZV04wUld4bGJXVnVkRlpoYkdsa1lYUnZjaUE5SUhKbGNYVnBjbVVvSnk0dlVtVmhZM1JGYkdWdFpXNTBWbUZzYVdSaGRHOXlKeWs3WEc0Z0lHTnlaV0YwWlVSUFRVWmhZM1J2Y25rZ1BTQlNaV0ZqZEVWc1pXMWxiblJXWVd4cFpHRjBiM0l1WTNKbFlYUmxSbUZqZEc5eWVUdGNibjFjYmx4dUx5b3FYRzRnS2lCRGNtVmhkR1Z6SUdFZ2JXRndjR2x1WnlCbWNtOXRJSE4xY0hCdmNuUmxaQ0JJVkUxTUlIUmhaM01nZEc4Z1lGSmxZV04wUkU5TlEyOXRjRzl1Wlc1MFlDQmpiR0Z6YzJWekxseHVJQ3BjYmlBcUlFQndkV0pzYVdOY2JpQXFMMXh1ZG1GeUlGSmxZV04wUkU5TlJtRmpkRzl5YVdWeklEMGdlMXh1SUNCaE9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZGhKeWtzWEc0Z0lHRmlZbkk2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjJGaVluSW5LU3hjYmlBZ1lXUmtjbVZ6Y3pvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbllXUmtjbVZ6Y3ljcExGeHVJQ0JoY21WaE9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZGhjbVZoSnlrc1hHNGdJR0Z5ZEdsamJHVTZJR055WldGMFpVUlBUVVpoWTNSdmNua29KMkZ5ZEdsamJHVW5LU3hjYmlBZ1lYTnBaR1U2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjJGemFXUmxKeWtzWEc0Z0lHRjFaR2x2T2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkaGRXUnBieWNwTEZ4dUlDQmlPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2RpSnlrc1hHNGdJR0poYzJVNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oySmhjMlVuS1N4Y2JpQWdZbVJwT2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkaVpHa25LU3hjYmlBZ1ltUnZPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2RpWkc4bktTeGNiaUFnWW1sbk9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZGlhV2NuS1N4Y2JpQWdZbXh2WTJ0eGRXOTBaVG9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duWW14dlkydHhkVzkwWlNjcExGeHVJQ0JpYjJSNU9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZGliMlI1Snlrc1hHNGdJR0p5T2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkaWNpY3BMRnh1SUNCaWRYUjBiMjQ2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjJKMWRIUnZiaWNwTEZ4dUlDQmpZVzUyWVhNNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oyTmhiblpoY3ljcExGeHVJQ0JqWVhCMGFXOXVPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2RqWVhCMGFXOXVKeWtzWEc0Z0lHTnBkR1U2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjJOcGRHVW5LU3hjYmlBZ1kyOWtaVG9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duWTI5a1pTY3BMRnh1SUNCamIydzZJR055WldGMFpVUlBUVVpoWTNSdmNua29KMk52YkNjcExGeHVJQ0JqYjJ4bmNtOTFjRG9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duWTI5c1ozSnZkWEFuS1N4Y2JpQWdaR0YwWVRvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnblpHRjBZU2NwTEZ4dUlDQmtZWFJoYkdsemREb2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25aR0YwWVd4cGMzUW5LU3hjYmlBZ1pHUTZJR055WldGMFpVUlBUVVpoWTNSdmNua29KMlJrSnlrc1hHNGdJR1JsYkRvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnblpHVnNKeWtzWEc0Z0lHUmxkR0ZwYkhNNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oyUmxkR0ZwYkhNbktTeGNiaUFnWkdadU9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZGtabTRuS1N4Y2JpQWdaR2xoYkc5bk9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZGthV0ZzYjJjbktTeGNiaUFnWkdsMk9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZGthWFluS1N4Y2JpQWdaR3c2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjJSc0p5a3NYRzRnSUdSME9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZGtkQ2NwTEZ4dUlDQmxiVG9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duWlcwbktTeGNiaUFnWlcxaVpXUTZJR055WldGMFpVUlBUVVpoWTNSdmNua29KMlZ0WW1Wa0p5a3NYRzRnSUdacFpXeGtjMlYwT2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkbWFXVnNaSE5sZENjcExGeHVJQ0JtYVdkallYQjBhVzl1T2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkbWFXZGpZWEIwYVc5dUp5a3NYRzRnSUdacFozVnlaVG9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duWm1sbmRYSmxKeWtzWEc0Z0lHWnZiM1JsY2pvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnblptOXZkR1Z5Snlrc1hHNGdJR1p2Y20wNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oyWnZjbTBuS1N4Y2JpQWdhREU2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjJneEp5a3NYRzRnSUdneU9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZG9NaWNwTEZ4dUlDQm9Nem9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duYURNbktTeGNiaUFnYURRNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oyZzBKeWtzWEc0Z0lHZzFPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2RvTlNjcExGeHVJQ0JvTmpvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbmFEWW5LU3hjYmlBZ2FHVmhaRG9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duYUdWaFpDY3BMRnh1SUNCb1pXRmtaWEk2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjJobFlXUmxjaWNwTEZ4dUlDQm9aM0p2ZFhBNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oyaG5jbTkxY0NjcExGeHVJQ0JvY2pvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbmFISW5LU3hjYmlBZ2FIUnRiRG9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duYUhSdGJDY3BMRnh1SUNCcE9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZHBKeWtzWEc0Z0lHbG1jbUZ0WlRvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbmFXWnlZVzFsSnlrc1hHNGdJR2x0WnpvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbmFXMW5KeWtzWEc0Z0lHbHVjSFYwT2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkcGJuQjFkQ2NwTEZ4dUlDQnBibk02SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjJsdWN5Y3BMRnh1SUNCclltUTZJR055WldGMFpVUlBUVVpoWTNSdmNua29KMnRpWkNjcExGeHVJQ0JyWlhsblpXNDZJR055WldGMFpVUlBUVVpoWTNSdmNua29KMnRsZVdkbGJpY3BMRnh1SUNCc1lXSmxiRG9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duYkdGaVpXd25LU3hjYmlBZ2JHVm5aVzVrT2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0Nkc1pXZGxibVFuS1N4Y2JpQWdiR2s2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjJ4cEp5a3NYRzRnSUd4cGJtczZJR055WldGMFpVUlBUVVpoWTNSdmNua29KMnhwYm1zbktTeGNiaUFnYldGcGJqb2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25iV0ZwYmljcExGeHVJQ0J0WVhBNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oyMWhjQ2NwTEZ4dUlDQnRZWEpyT2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkdFlYSnJKeWtzWEc0Z0lHMWxiblU2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjIxbGJuVW5LU3hjYmlBZ2JXVnVkV2wwWlcwNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oyMWxiblZwZEdWdEp5a3NYRzRnSUcxbGRHRTZJR055WldGMFpVUlBUVVpoWTNSdmNua29KMjFsZEdFbktTeGNiaUFnYldWMFpYSTZJR055WldGMFpVUlBUVVpoWTNSdmNua29KMjFsZEdWeUp5a3NYRzRnSUc1aGRqb2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25ibUYySnlrc1hHNGdJRzV2YzJOeWFYQjBPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2R1YjNOamNtbHdkQ2NwTEZ4dUlDQnZZbXBsWTNRNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oyOWlhbVZqZENjcExGeHVJQ0J2YkRvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbmIyd25LU3hjYmlBZ2IzQjBaM0p2ZFhBNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oyOXdkR2R5YjNWd0p5a3NYRzRnSUc5d2RHbHZiam9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duYjNCMGFXOXVKeWtzWEc0Z0lHOTFkSEIxZERvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbmIzVjBjSFYwSnlrc1hHNGdJSEE2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjNBbktTeGNiaUFnY0dGeVlXMDZJR055WldGMFpVUlBUVVpoWTNSdmNua29KM0JoY21GdEp5a3NYRzRnSUhCcFkzUjFjbVU2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjNCcFkzUjFjbVVuS1N4Y2JpQWdjSEpsT2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0Nkd2NtVW5LU3hjYmlBZ2NISnZaM0psYzNNNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0ozQnliMmR5WlhOekp5a3NYRzRnSUhFNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0ozRW5LU3hjYmlBZ2NuQTZJR055WldGMFpVUlBUVVpoWTNSdmNua29KM0p3Snlrc1hHNGdJSEowT2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkeWRDY3BMRnh1SUNCeWRXSjVPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2R5ZFdKNUp5a3NYRzRnSUhNNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0ozTW5LU3hjYmlBZ2MyRnRjRG9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duYzJGdGNDY3BMRnh1SUNCelkzSnBjSFE2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjNOamNtbHdkQ2NwTEZ4dUlDQnpaV04wYVc5dU9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZHpaV04wYVc5dUp5a3NYRzRnSUhObGJHVmpkRG9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duYzJWc1pXTjBKeWtzWEc0Z0lITnRZV3hzT2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkemJXRnNiQ2NwTEZ4dUlDQnpiM1Z5WTJVNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0ozTnZkWEpqWlNjcExGeHVJQ0J6Y0dGdU9pQmpjbVZoZEdWRVQwMUdZV04wYjNKNUtDZHpjR0Z1Snlrc1hHNGdJSE4wY205dVp6b2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25jM1J5YjI1bkp5a3NYRzRnSUhOMGVXeGxPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2R6ZEhsc1pTY3BMRnh1SUNCemRXSTZJR055WldGMFpVUlBUVVpoWTNSdmNua29KM04xWWljcExGeHVJQ0J6ZFcxdFlYSjVPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2R6ZFcxdFlYSjVKeWtzWEc0Z0lITjFjRG9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duYzNWd0p5a3NYRzRnSUhSaFlteGxPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2QwWVdKc1pTY3BMRnh1SUNCMFltOWtlVG9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duZEdKdlpIa25LU3hjYmlBZ2RHUTZJR055WldGMFpVUlBUVVpoWTNSdmNua29KM1JrSnlrc1hHNGdJSFJsZUhSaGNtVmhPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2QwWlhoMFlYSmxZU2NwTEZ4dUlDQjBabTl2ZERvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbmRHWnZiM1FuS1N4Y2JpQWdkR2c2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjNSb0p5a3NYRzRnSUhSb1pXRmtPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2QwYUdWaFpDY3BMRnh1SUNCMGFXMWxPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2QwYVcxbEp5a3NYRzRnSUhScGRHeGxPaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2QwYVhSc1pTY3BMRnh1SUNCMGNqb2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25kSEluS1N4Y2JpQWdkSEpoWTJzNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0ozUnlZV05ySnlrc1hHNGdJSFU2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjNVbktTeGNiaUFnZFd3NklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0ozVnNKeWtzWEc0Z0lDZDJZWEluT2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkMllYSW5LU3hjYmlBZ2RtbGtaVzg2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjNacFpHVnZKeWtzWEc0Z0lIZGljam9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duZDJKeUp5a3NYRzVjYmlBZ0x5OGdVMVpIWEc0Z0lHTnBjbU5zWlRvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnblkybHlZMnhsSnlrc1hHNGdJR05zYVhCUVlYUm9PaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2RqYkdsd1VHRjBhQ2NwTEZ4dUlDQmtaV1p6T2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0Nka1pXWnpKeWtzWEc0Z0lHVnNiR2x3YzJVNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0oyVnNiR2x3YzJVbktTeGNiaUFnWnpvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnblp5Y3BMRnh1SUNCcGJXRm5aVG9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duYVcxaFoyVW5LU3hjYmlBZ2JHbHVaVG9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duYkdsdVpTY3BMRnh1SUNCc2FXNWxZWEpIY21Ga2FXVnVkRG9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duYkdsdVpXRnlSM0poWkdsbGJuUW5LU3hjYmlBZ2JXRnphem9nWTNKbFlYUmxSRTlOUm1GamRHOXllU2duYldGemF5Y3BMRnh1SUNCd1lYUm9PaUJqY21WaGRHVkVUMDFHWVdOMGIzSjVLQ2R3WVhSb0p5a3NYRzRnSUhCaGRIUmxjbTQ2SUdOeVpXRjBaVVJQVFVaaFkzUnZjbmtvSjNCaGRIUmxjbTRuS1N4Y2JpQWdjRzlzZVdkdmJqb2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25jRzlzZVdkdmJpY3BMRnh1SUNCd2IyeDViR2x1WlRvZ1kzSmxZWFJsUkU5TlJtRmpkRzl5ZVNnbmNHOXNlV3hwYm1VbktTeGNiaUFnY21Ga2FXRnNSM0poWkdsbGJuUTZJR055WldGMFpVUlBUVVpoWTNSdmNua29KM0poWkdsaGJFZHlZV1JwWlc1MEp5a3NYRzRnSUhKbFkzUTZJR055WldGMFpVUlBUVVpoWTNSdmNua29KM0psWTNRbktTeGNiaUFnYzNSdmNEb2dZM0psWVhSbFJFOU5SbUZqZEc5eWVTZ25jM1J2Y0NjcExGeHVJQ0J6ZG1jNklHTnlaV0YwWlVSUFRVWmhZM1J2Y25rb0ozTjJaeWNwTEZ4dUlDQjBaWGgwT2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkMFpYaDBKeWtzWEc0Z0lIUnpjR0Z1T2lCamNtVmhkR1ZFVDAxR1lXTjBiM0o1S0NkMGMzQmhiaWNwWEc1OU8xeHVYRzV0YjJSMWJHVXVaWGh3YjNKMGN5QTlJRkpsWVdOMFJFOU5SbUZqZEc5eWFXVnpPeUlzSWk4cUtseHVJQ29nUTI5d2VYSnBaMmgwSURJd01UUXRjSEpsYzJWdWRDd2dSbUZqWldKdmIyc3NJRWx1WXk1Y2JpQXFJRUZzYkNCeWFXZG9kSE1nY21WelpYSjJaV1F1WEc0Z0tseHVJQ29nVkdocGN5QnpiM1Z5WTJVZ1kyOWtaU0JwY3lCc2FXTmxibk5sWkNCMWJtUmxjaUIwYUdVZ1FsTkVMWE4wZVd4bElHeHBZMlZ1YzJVZ1ptOTFibVFnYVc0Z2RHaGxYRzRnS2lCTVNVTkZUbE5GSUdacGJHVWdhVzRnZEdobElISnZiM1FnWkdseVpXTjBiM0o1SUc5bUlIUm9hWE1nYzI5MWNtTmxJSFJ5WldVdUlFRnVJR0ZrWkdsMGFXOXVZV3dnWjNKaGJuUmNiaUFxSUc5bUlIQmhkR1Z1ZENCeWFXZG9kSE1nWTJGdUlHSmxJR1p2ZFc1a0lHbHVJSFJvWlNCUVFWUkZUbFJUSUdacGJHVWdhVzRnZEdobElITmhiV1VnWkdseVpXTjBiM0o1TGx4dUlDcGNiaUFxTDF4dVhHNG5kWE5sSUhOMGNtbGpkQ2M3WEc1Y2JuWmhjaUJmWVhOemFXZHVJRDBnY21WeGRXbHlaU2duYjJKcVpXTjBMV0Z6YzJsbmJpY3BPMXh1WEc1MllYSWdVbVZoWTNSRGRYSnlaVzUwVDNkdVpYSWdQU0J5WlhGMWFYSmxLQ2N1TDFKbFlXTjBRM1Z5Y21WdWRFOTNibVZ5SnlrN1hHNWNiblpoY2lCM1lYSnVhVzVuSUQwZ2NtVnhkV2x5WlNnblptSnFjeTlzYVdJdmQyRnlibWx1WnljcE8xeHVkbUZ5SUdOaGJrUmxabWx1WlZCeWIzQmxjblI1SUQwZ2NtVnhkV2x5WlNnbkxpOWpZVzVFWldacGJtVlFjbTl3WlhKMGVTY3BPMXh1ZG1GeUlHaGhjMDkzYmxCeWIzQmxjblI1SUQwZ1QySnFaV04wTG5CeWIzUnZkSGx3WlM1b1lYTlBkMjVRY205d1pYSjBlVHRjYmx4dWRtRnlJRkpGUVVOVVgwVk1SVTFGVGxSZlZGbFFSU0E5SUhKbGNYVnBjbVVvSnk0dlVtVmhZM1JGYkdWdFpXNTBVM2x0WW05c0p5azdYRzVjYm5aaGNpQlNSVk5GVWxaRlJGOVFVazlRVXlBOUlIdGNiaUFnYTJWNU9pQjBjblZsTEZ4dUlDQnlaV1k2SUhSeWRXVXNYRzRnSUY5ZmMyVnNaam9nZEhKMVpTeGNiaUFnWDE5emIzVnlZMlU2SUhSeWRXVmNibjA3WEc1Y2JuWmhjaUJ6Y0dWamFXRnNVSEp2Y0V0bGVWZGhjbTVwYm1kVGFHOTNiaXdnYzNCbFkybGhiRkJ5YjNCU1pXWlhZWEp1YVc1blUyaHZkMjQ3WEc1Y2JtWjFibU4wYVc5dUlHaGhjMVpoYkdsa1VtVm1LR052Ym1acFp5a2dlMXh1SUNCcFppQW9jSEp2WTJWemN5NWxibll1VGs5RVJWOUZUbFlnSVQwOUlDZHdjbTlrZFdOMGFXOXVKeWtnZTF4dUlDQWdJR2xtSUNob1lYTlBkMjVRY205d1pYSjBlUzVqWVd4c0tHTnZibVpwWnl3Z0ozSmxaaWNwS1NCN1hHNGdJQ0FnSUNCMllYSWdaMlYwZEdWeUlEMGdUMkpxWldOMExtZGxkRTkzYmxCeWIzQmxjblI1UkdWelkzSnBjSFJ2Y2loamIyNW1hV2NzSUNkeVpXWW5LUzVuWlhRN1hHNGdJQ0FnSUNCcFppQW9aMlYwZEdWeUlDWW1JR2RsZEhSbGNpNXBjMUpsWVdOMFYyRnlibWx1WnlrZ2UxeHVJQ0FnSUNBZ0lDQnlaWFIxY200Z1ptRnNjMlU3WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdmVnh1SUNCOVhHNGdJSEpsZEhWeWJpQmpiMjVtYVdjdWNtVm1JQ0U5UFNCMWJtUmxabWx1WldRN1hHNTlYRzVjYm1aMWJtTjBhVzl1SUdoaGMxWmhiR2xrUzJWNUtHTnZibVpwWnlrZ2UxeHVJQ0JwWmlBb2NISnZZMlZ6Y3k1bGJuWXVUazlFUlY5RlRsWWdJVDA5SUNkd2NtOWtkV04wYVc5dUp5a2dlMXh1SUNBZ0lHbG1JQ2hvWVhOUGQyNVFjbTl3WlhKMGVTNWpZV3hzS0dOdmJtWnBaeXdnSjJ0bGVTY3BLU0I3WEc0Z0lDQWdJQ0IyWVhJZ1oyVjBkR1Z5SUQwZ1QySnFaV04wTG1kbGRFOTNibEJ5YjNCbGNuUjVSR1Z6WTNKcGNIUnZjaWhqYjI1bWFXY3NJQ2RyWlhrbktTNW5aWFE3WEc0Z0lDQWdJQ0JwWmlBb1oyVjBkR1Z5SUNZbUlHZGxkSFJsY2k1cGMxSmxZV04wVjJGeWJtbHVaeWtnZTF4dUlDQWdJQ0FnSUNCeVpYUjFjbTRnWm1Gc2MyVTdYRzRnSUNBZ0lDQjlYRzRnSUNBZ2ZWeHVJQ0I5WEc0Z0lISmxkSFZ5YmlCamIyNW1hV2N1YTJWNUlDRTlQU0IxYm1SbFptbHVaV1E3WEc1OVhHNWNibVoxYm1OMGFXOXVJR1JsWm1sdVpVdGxlVkJ5YjNCWFlYSnVhVzVuUjJWMGRHVnlLSEJ5YjNCekxDQmthWE53YkdGNVRtRnRaU2tnZTF4dUlDQjJZWElnZDJGeWJrRmliM1YwUVdOalpYTnphVzVuUzJWNUlEMGdablZ1WTNScGIyNGdLQ2tnZTF4dUlDQWdJR2xtSUNnaGMzQmxZMmxoYkZCeWIzQkxaWGxYWVhKdWFXNW5VMmh2ZDI0cElIdGNiaUFnSUNBZ0lITndaV05wWVd4UWNtOXdTMlY1VjJGeWJtbHVaMU5vYjNkdUlEMGdkSEoxWlR0Y2JpQWdJQ0FnSUhCeWIyTmxjM011Wlc1MkxrNVBSRVZmUlU1V0lDRTlQU0FuY0hKdlpIVmpkR2x2YmljZ1B5QjNZWEp1YVc1bktHWmhiSE5sTENBbkpYTTZJR0JyWlhsZ0lHbHpJRzV2ZENCaElIQnliM0F1SUZSeWVXbHVaeUIwYnlCaFkyTmxjM01nYVhRZ2QybHNiQ0J5WlhOMWJIUWdKeUFySUNkcGJpQmdkVzVrWldacGJtVmtZQ0JpWldsdVp5QnlaWFIxY201bFpDNGdTV1lnZVc5MUlHNWxaV1FnZEc4Z1lXTmpaWE56SUhSb1pTQnpZVzFsSUNjZ0t5QW5kbUZzZFdVZ2QybDBhR2x1SUhSb1pTQmphR2xzWkNCamIyMXdiMjVsYm5Rc0lIbHZkU0J6YUc5MWJHUWdjR0Z6Y3lCcGRDQmhjeUJoSUdScFptWmxjbVZ1ZENBbklDc2dKM0J5YjNBdUlDaG9kSFJ3Y3pvdkwyWmlMbTFsTDNKbFlXTjBMWE53WldOcFlXd3RjSEp2Y0hNcEp5d2daR2x6Y0d4aGVVNWhiV1VwSURvZ2RtOXBaQ0F3TzF4dUlDQWdJSDFjYmlBZ2ZUdGNiaUFnZDJGeWJrRmliM1YwUVdOalpYTnphVzVuUzJWNUxtbHpVbVZoWTNSWFlYSnVhVzVuSUQwZ2RISjFaVHRjYmlBZ1QySnFaV04wTG1SbFptbHVaVkJ5YjNCbGNuUjVLSEJ5YjNCekxDQW5hMlY1Snl3Z2UxeHVJQ0FnSUdkbGREb2dkMkZ5YmtGaWIzVjBRV05qWlhOemFXNW5TMlY1TEZ4dUlDQWdJR052Ym1acFozVnlZV0pzWlRvZ2RISjFaVnh1SUNCOUtUdGNibjFjYmx4dVpuVnVZM1JwYjI0Z1pHVm1hVzVsVW1WbVVISnZjRmRoY201cGJtZEhaWFIwWlhJb2NISnZjSE1zSUdScGMzQnNZWGxPWVcxbEtTQjdYRzRnSUhaaGNpQjNZWEp1UVdKdmRYUkJZMk5sYzNOcGJtZFNaV1lnUFNCbWRXNWpkR2x2YmlBb0tTQjdYRzRnSUNBZ2FXWWdLQ0Z6Y0dWamFXRnNVSEp2Y0ZKbFpsZGhjbTVwYm1kVGFHOTNiaWtnZTF4dUlDQWdJQ0FnYzNCbFkybGhiRkJ5YjNCU1pXWlhZWEp1YVc1blUyaHZkMjRnUFNCMGNuVmxPMXh1SUNBZ0lDQWdjSEp2WTJWemN5NWxibll1VGs5RVJWOUZUbFlnSVQwOUlDZHdjbTlrZFdOMGFXOXVKeUEvSUhkaGNtNXBibWNvWm1Gc2MyVXNJQ2NsY3pvZ1lISmxabUFnYVhNZ2JtOTBJR0VnY0hKdmNDNGdWSEo1YVc1bklIUnZJR0ZqWTJWemN5QnBkQ0IzYVd4c0lISmxjM1ZzZENBbklDc2dKMmx1SUdCMWJtUmxabWx1WldSZ0lHSmxhVzVuSUhKbGRIVnlibVZrTGlCSlppQjViM1VnYm1WbFpDQjBieUJoWTJObGMzTWdkR2hsSUhOaGJXVWdKeUFySUNkMllXeDFaU0IzYVhSb2FXNGdkR2hsSUdOb2FXeGtJR052YlhCdmJtVnVkQ3dnZVc5MUlITm9iM1ZzWkNCd1lYTnpJR2wwSUdGeklHRWdaR2xtWm1WeVpXNTBJQ2NnS3lBbmNISnZjQzRnS0doMGRIQnpPaTh2Wm1JdWJXVXZjbVZoWTNRdGMzQmxZMmxoYkMxd2NtOXdjeWtuTENCa2FYTndiR0Y1VG1GdFpTa2dPaUIyYjJsa0lEQTdYRzRnSUNBZ2ZWeHVJQ0I5TzF4dUlDQjNZWEp1UVdKdmRYUkJZMk5sYzNOcGJtZFNaV1l1YVhOU1pXRmpkRmRoY201cGJtY2dQU0IwY25WbE8xeHVJQ0JQWW1wbFkzUXVaR1ZtYVc1bFVISnZjR1Z5ZEhrb2NISnZjSE1zSUNkeVpXWW5MQ0I3WEc0Z0lDQWdaMlYwT2lCM1lYSnVRV0p2ZFhSQlkyTmxjM05wYm1kU1pXWXNYRzRnSUNBZ1kyOXVabWxuZFhKaFlteGxPaUIwY25WbFhHNGdJSDBwTzF4dWZWeHVYRzR2S2lwY2JpQXFJRVpoWTNSdmNua2diV1YwYUc5a0lIUnZJR055WldGMFpTQmhJRzVsZHlCU1pXRmpkQ0JsYkdWdFpXNTBMaUJVYUdseklHNXZJR3h2Ym1kbGNpQmhaR2hsY21WeklIUnZYRzRnS2lCMGFHVWdZMnhoYzNNZ2NHRjBkR1Z5Yml3Z2MyOGdaRzhnYm05MElIVnpaU0J1WlhjZ2RHOGdZMkZzYkNCcGRDNGdRV3h6Ynl3Z2JtOGdhVzV6ZEdGdVkyVnZaaUJqYUdWamExeHVJQ29nZDJsc2JDQjNiM0pyTGlCSmJuTjBaV0ZrSUhSbGMzUWdKQ1IwZVhCbGIyWWdabWxsYkdRZ1lXZGhhVzV6ZENCVGVXMWliMnd1Wm05eUtDZHlaV0ZqZEM1bGJHVnRaVzUwSnlrZ2RHOGdZMmhsWTJ0Y2JpQXFJR2xtSUhOdmJXVjBhR2x1WnlCcGN5QmhJRkpsWVdOMElFVnNaVzFsYm5RdVhHNGdLbHh1SUNvZ1FIQmhjbUZ0SUhzcWZTQjBlWEJsWEc0Z0tpQkFjR0Z5WVcwZ2V5cDlJR3RsZVZ4dUlDb2dRSEJoY21GdElIdHpkSEpwYm1kOGIySnFaV04wZlNCeVpXWmNiaUFxSUVCd1lYSmhiU0I3S24wZ2MyVnNaaUJCSUNwMFpXMXdiM0poY25rcUlHaGxiSEJsY2lCMGJ5QmtaWFJsWTNRZ2NHeGhZMlZ6SUhkb1pYSmxJR0IwYUdsellDQnBjMXh1SUNvZ1pHbG1abVZ5Wlc1MElHWnliMjBnZEdobElHQnZkMjVsY21BZ2QyaGxiaUJTWldGamRDNWpjbVZoZEdWRmJHVnRaVzUwSUdseklHTmhiR3hsWkN3Z2MyOGdkR2hoZENCM1pWeHVJQ29nWTJGdUlIZGhjbTR1SUZkbElIZGhiblFnZEc4Z1oyVjBJSEpwWkNCdlppQnZkMjVsY2lCaGJtUWdjbVZ3YkdGalpTQnpkSEpwYm1jZ1lISmxabUJ6SUhkcGRHZ2dZWEp5YjNkY2JpQXFJR1oxYm1OMGFXOXVjeXdnWVc1a0lHRnpJR3h2Ym1jZ1lYTWdZSFJvYVhOZ0lHRnVaQ0J2ZDI1bGNpQmhjbVVnZEdobElITmhiV1VzSUhSb1pYSmxJSGRwYkd3Z1ltVWdibTljYmlBcUlHTm9ZVzVuWlNCcGJpQmlaV2hoZG1sdmNpNWNiaUFxSUVCd1lYSmhiU0I3S24wZ2MyOTFjbU5sSUVGdUlHRnVibTkwWVhScGIyNGdiMkpxWldOMElDaGhaR1JsWkNCaWVTQmhJSFJ5WVc1emNHbHNaWElnYjNJZ2IzUm9aWEozYVhObEtWeHVJQ29nYVc1a2FXTmhkR2x1WnlCbWFXeGxibUZ0WlN3Z2JHbHVaU0J1ZFcxaVpYSXNJR0Z1WkM5dmNpQnZkR2hsY2lCcGJtWnZjbTFoZEdsdmJpNWNiaUFxSUVCd1lYSmhiU0I3S24wZ2IzZHVaWEpjYmlBcUlFQndZWEpoYlNCN0tuMGdjSEp2Y0hOY2JpQXFJRUJwYm5SbGNtNWhiRnh1SUNvdlhHNTJZWElnVW1WaFkzUkZiR1Z0Wlc1MElEMGdablZ1WTNScGIyNGdLSFI1Y0dVc0lHdGxlU3dnY21WbUxDQnpaV3htTENCemIzVnlZMlVzSUc5M2JtVnlMQ0J3Y205d2N5a2dlMXh1SUNCMllYSWdaV3hsYldWdWRDQTlJSHRjYmlBZ0lDQXZMeUJVYUdseklIUmhaeUJoYkd4dmR5QjFjeUIwYnlCMWJtbHhkV1ZzZVNCcFpHVnVkR2xtZVNCMGFHbHpJR0Z6SUdFZ1VtVmhZM1FnUld4bGJXVnVkRnh1SUNBZ0lDUWtkSGx3Wlc5bU9pQlNSVUZEVkY5RlRFVk5SVTVVWDFSWlVFVXNYRzVjYmlBZ0lDQXZMeUJDZFdsc2RDMXBiaUJ3Y205d1pYSjBhV1Z6SUhSb1lYUWdZbVZzYjI1bklHOXVJSFJvWlNCbGJHVnRaVzUwWEc0Z0lDQWdkSGx3WlRvZ2RIbHdaU3hjYmlBZ0lDQnJaWGs2SUd0bGVTeGNiaUFnSUNCeVpXWTZJSEpsWml4Y2JpQWdJQ0J3Y205d2N6b2djSEp2Y0hNc1hHNWNiaUFnSUNBdkx5QlNaV052Y21RZ2RHaGxJR052YlhCdmJtVnVkQ0J5WlhOd2IyNXphV0pzWlNCbWIzSWdZM0psWVhScGJtY2dkR2hwY3lCbGJHVnRaVzUwTGx4dUlDQWdJRjl2ZDI1bGNqb2diM2R1WlhKY2JpQWdmVHRjYmx4dUlDQnBaaUFvY0hKdlkyVnpjeTVsYm5ZdVRrOUVSVjlGVGxZZ0lUMDlJQ2R3Y205a2RXTjBhVzl1SnlrZ2UxeHVJQ0FnSUM4dklGUm9aU0IyWVd4cFpHRjBhVzl1SUdac1lXY2dhWE1nWTNWeWNtVnVkR3g1SUcxMWRHRjBhWFpsTGlCWFpTQndkWFFnYVhRZ2IyNWNiaUFnSUNBdkx5QmhiaUJsZUhSbGNtNWhiQ0JpWVdOcmFXNW5JSE4wYjNKbElITnZJSFJvWVhRZ2QyVWdZMkZ1SUdaeVpXVjZaU0IwYUdVZ2QyaHZiR1VnYjJKcVpXTjBMbHh1SUNBZ0lDOHZJRlJvYVhNZ1kyRnVJR0psSUhKbGNHeGhZMlZrSUhkcGRHZ2dZU0JYWldGclRXRndJRzl1WTJVZ2RHaGxlU0JoY21VZ2FXMXdiR1Z0Wlc1MFpXUWdhVzVjYmlBZ0lDQXZMeUJqYjIxdGIyNXNlU0IxYzJWa0lHUmxkbVZzYjNCdFpXNTBJR1Z1ZG1seWIyNXRaVzUwY3k1Y2JpQWdJQ0JsYkdWdFpXNTBMbDl6ZEc5eVpTQTlJSHQ5TzF4dVhHNGdJQ0FnTHk4Z1ZHOGdiV0ZyWlNCamIyMXdZWEpwYm1jZ1VtVmhZM1JGYkdWdFpXNTBjeUJsWVhOcFpYSWdabTl5SUhSbGMzUnBibWNnY0hWeWNHOXpaWE1zSUhkbElHMWhhMlZjYmlBZ0lDQXZMeUIwYUdVZ2RtRnNhV1JoZEdsdmJpQm1iR0ZuSUc1dmJpMWxiblZ0WlhKaFlteGxJQ2gzYUdWeVpTQndiM056YVdKc1pTd2dkMmhwWTJnZ2MyaHZkV3hrWEc0Z0lDQWdMeThnYVc1amJIVmtaU0JsZG1WeWVTQmxiblpwY205dWJXVnVkQ0IzWlNCeWRXNGdkR1Z6ZEhNZ2FXNHBMQ0J6YnlCMGFHVWdkR1Z6ZENCbWNtRnRaWGR2Y210Y2JpQWdJQ0F2THlCcFoyNXZjbVZ6SUdsMExseHVJQ0FnSUdsbUlDaGpZVzVFWldacGJtVlFjbTl3WlhKMGVTa2dlMXh1SUNBZ0lDQWdUMkpxWldOMExtUmxabWx1WlZCeWIzQmxjblI1S0dWc1pXMWxiblF1WDNOMGIzSmxMQ0FuZG1Gc2FXUmhkR1ZrSnl3Z2UxeHVJQ0FnSUNBZ0lDQmpiMjVtYVdkMWNtRmliR1U2SUdaaGJITmxMRnh1SUNBZ0lDQWdJQ0JsYm5WdFpYSmhZbXhsT2lCbVlXeHpaU3hjYmlBZ0lDQWdJQ0FnZDNKcGRHRmliR1U2SUhSeWRXVXNYRzRnSUNBZ0lDQWdJSFpoYkhWbE9pQm1ZV3h6WlZ4dUlDQWdJQ0FnZlNrN1hHNGdJQ0FnSUNBdkx5QnpaV3htSUdGdVpDQnpiM1Z5WTJVZ1lYSmxJRVJGVmlCdmJteDVJSEJ5YjNCbGNuUnBaWE11WEc0Z0lDQWdJQ0JQWW1wbFkzUXVaR1ZtYVc1bFVISnZjR1Z5ZEhrb1pXeGxiV1Z1ZEN3Z0oxOXpaV3htSnl3Z2UxeHVJQ0FnSUNBZ0lDQmpiMjVtYVdkMWNtRmliR1U2SUdaaGJITmxMRnh1SUNBZ0lDQWdJQ0JsYm5WdFpYSmhZbXhsT2lCbVlXeHpaU3hjYmlBZ0lDQWdJQ0FnZDNKcGRHRmliR1U2SUdaaGJITmxMRnh1SUNBZ0lDQWdJQ0IyWVd4MVpUb2djMlZzWmx4dUlDQWdJQ0FnZlNrN1hHNGdJQ0FnSUNBdkx5QlVkMjhnWld4bGJXVnVkSE1nWTNKbFlYUmxaQ0JwYmlCMGQyOGdaR2xtWm1WeVpXNTBJSEJzWVdObGN5QnphRzkxYkdRZ1ltVWdZMjl1YzJsa1pYSmxaRnh1SUNBZ0lDQWdMeThnWlhGMVlXd2dabTl5SUhSbGMzUnBibWNnY0hWeWNHOXpaWE1nWVc1a0lIUm9aWEpsWm05eVpTQjNaU0JvYVdSbElHbDBJR1p5YjIwZ1pXNTFiV1Z5WVhScGIyNHVYRzRnSUNBZ0lDQlBZbXBsWTNRdVpHVm1hVzVsVUhKdmNHVnlkSGtvWld4bGJXVnVkQ3dnSjE5emIzVnlZMlVuTENCN1hHNGdJQ0FnSUNBZ0lHTnZibVpwWjNWeVlXSnNaVG9nWm1Gc2MyVXNYRzRnSUNBZ0lDQWdJR1Z1ZFcxbGNtRmliR1U2SUdaaGJITmxMRnh1SUNBZ0lDQWdJQ0IzY21sMFlXSnNaVG9nWm1Gc2MyVXNYRzRnSUNBZ0lDQWdJSFpoYkhWbE9pQnpiM1Z5WTJWY2JpQWdJQ0FnSUgwcE8xeHVJQ0FnSUgwZ1pXeHpaU0I3WEc0Z0lDQWdJQ0JsYkdWdFpXNTBMbDl6ZEc5eVpTNTJZV3hwWkdGMFpXUWdQU0JtWVd4elpUdGNiaUFnSUNBZ0lHVnNaVzFsYm5RdVgzTmxiR1lnUFNCelpXeG1PMXh1SUNBZ0lDQWdaV3hsYldWdWRDNWZjMjkxY21ObElEMGdjMjkxY21ObE8xeHVJQ0FnSUgxY2JpQWdJQ0JwWmlBb1QySnFaV04wTG1aeVpXVjZaU2tnZTF4dUlDQWdJQ0FnVDJKcVpXTjBMbVp5WldWNlpTaGxiR1Z0Wlc1MExuQnliM0J6S1R0Y2JpQWdJQ0FnSUU5aWFtVmpkQzVtY21WbGVtVW9aV3hsYldWdWRDazdYRzRnSUNBZ2ZWeHVJQ0I5WEc1Y2JpQWdjbVYwZFhKdUlHVnNaVzFsYm5RN1hHNTlPMXh1WEc0dktpcGNiaUFxSUVOeVpXRjBaU0JoYm1RZ2NtVjBkWEp1SUdFZ2JtVjNJRkpsWVdOMFJXeGxiV1Z1ZENCdlppQjBhR1VnWjJsMlpXNGdkSGx3WlM1Y2JpQXFJRk5sWlNCb2RIUndjem92TDJaaFkyVmliMjlyTG1kcGRHaDFZaTVwYnk5eVpXRmpkQzlrYjJOekwzUnZjQzFzWlhabGJDMWhjR2t1YUhSdGJDTnlaV0ZqZEM1amNtVmhkR1ZsYkdWdFpXNTBYRzRnS2k5Y2JsSmxZV04wUld4bGJXVnVkQzVqY21WaGRHVkZiR1Z0Wlc1MElEMGdablZ1WTNScGIyNGdLSFI1Y0dVc0lHTnZibVpwWnl3Z1kyaHBiR1J5Wlc0cElIdGNiaUFnZG1GeUlIQnliM0JPWVcxbE8xeHVYRzRnSUM4dklGSmxjMlZ5ZG1Wa0lHNWhiV1Z6SUdGeVpTQmxlSFJ5WVdOMFpXUmNiaUFnZG1GeUlIQnliM0J6SUQwZ2UzMDdYRzVjYmlBZ2RtRnlJR3RsZVNBOUlHNTFiR3c3WEc0Z0lIWmhjaUJ5WldZZ1BTQnVkV3hzTzF4dUlDQjJZWElnYzJWc1ppQTlJRzUxYkd3N1hHNGdJSFpoY2lCemIzVnlZMlVnUFNCdWRXeHNPMXh1WEc0Z0lHbG1JQ2hqYjI1bWFXY2dJVDBnYm5Wc2JDa2dlMXh1SUNBZ0lHbG1JQ2hvWVhOV1lXeHBaRkpsWmloamIyNW1hV2NwS1NCN1hHNGdJQ0FnSUNCeVpXWWdQU0JqYjI1bWFXY3VjbVZtTzF4dUlDQWdJSDFjYmlBZ0lDQnBaaUFvYUdGelZtRnNhV1JMWlhrb1kyOXVabWxuS1NrZ2UxeHVJQ0FnSUNBZ2EyVjVJRDBnSnljZ0t5QmpiMjVtYVdjdWEyVjVPMXh1SUNBZ0lIMWNibHh1SUNBZ0lITmxiR1lnUFNCamIyNW1hV2N1WDE5elpXeG1JRDA5UFNCMWJtUmxabWx1WldRZ1B5QnVkV3hzSURvZ1kyOXVabWxuTGw5ZmMyVnNaanRjYmlBZ0lDQnpiM1Z5WTJVZ1BTQmpiMjVtYVdjdVgxOXpiM1Z5WTJVZ1BUMDlJSFZ1WkdWbWFXNWxaQ0EvSUc1MWJHd2dPaUJqYjI1bWFXY3VYMTl6YjNWeVkyVTdYRzRnSUNBZ0x5OGdVbVZ0WVdsdWFXNW5JSEJ5YjNCbGNuUnBaWE1nWVhKbElHRmtaR1ZrSUhSdklHRWdibVYzSUhCeWIzQnpJRzlpYW1WamRGeHVJQ0FnSUdadmNpQW9jSEp2Y0U1aGJXVWdhVzRnWTI5dVptbG5LU0I3WEc0Z0lDQWdJQ0JwWmlBb2FHRnpUM2R1VUhKdmNHVnlkSGt1WTJGc2JDaGpiMjVtYVdjc0lIQnliM0JPWVcxbEtTQW1KaUFoVWtWVFJWSldSVVJmVUZKUFVGTXVhR0Z6VDNkdVVISnZjR1Z5ZEhrb2NISnZjRTVoYldVcEtTQjdYRzRnSUNBZ0lDQWdJSEJ5YjNCelczQnliM0JPWVcxbFhTQTlJR052Ym1acFoxdHdjbTl3VG1GdFpWMDdYRzRnSUNBZ0lDQjlYRzRnSUNBZ2ZWeHVJQ0I5WEc1Y2JpQWdMeThnUTJocGJHUnlaVzRnWTJGdUlHSmxJRzF2Y21VZ2RHaGhiaUJ2Ym1VZ1lYSm5kVzFsYm5Rc0lHRnVaQ0IwYUc5elpTQmhjbVVnZEhKaGJuTm1aWEp5WldRZ2IyNTBiMXh1SUNBdkx5QjBhR1VnYm1WM2JIa2dZV3hzYjJOaGRHVmtJSEJ5YjNCeklHOWlhbVZqZEM1Y2JpQWdkbUZ5SUdOb2FXeGtjbVZ1VEdWdVozUm9JRDBnWVhKbmRXMWxiblJ6TG14bGJtZDBhQ0F0SURJN1hHNGdJR2xtSUNoamFHbHNaSEpsYmt4bGJtZDBhQ0E5UFQwZ01Ta2dlMXh1SUNBZ0lIQnliM0J6TG1Ob2FXeGtjbVZ1SUQwZ1kyaHBiR1J5Wlc0N1hHNGdJSDBnWld4elpTQnBaaUFvWTJocGJHUnlaVzVNWlc1bmRHZ2dQaUF4S1NCN1hHNGdJQ0FnZG1GeUlHTm9hV3hrUVhKeVlYa2dQU0JCY25KaGVTaGphR2xzWkhKbGJreGxibWQwYUNrN1hHNGdJQ0FnWm05eUlDaDJZWElnYVNBOUlEQTdJR2tnUENCamFHbHNaSEpsYmt4bGJtZDBhRHNnYVNzcktTQjdYRzRnSUNBZ0lDQmphR2xzWkVGeWNtRjVXMmxkSUQwZ1lYSm5kVzFsYm5Selcya2dLeUF5WFR0Y2JpQWdJQ0I5WEc0Z0lDQWdhV1lnS0hCeWIyTmxjM011Wlc1MkxrNVBSRVZmUlU1V0lDRTlQU0FuY0hKdlpIVmpkR2x2YmljcElIdGNiaUFnSUNBZ0lHbG1JQ2hQWW1wbFkzUXVabkpsWlhwbEtTQjdYRzRnSUNBZ0lDQWdJRTlpYW1WamRDNW1jbVZsZW1Vb1kyaHBiR1JCY25KaGVTazdYRzRnSUNBZ0lDQjlYRzRnSUNBZ2ZWeHVJQ0FnSUhCeWIzQnpMbU5vYVd4a2NtVnVJRDBnWTJocGJHUkJjbkpoZVR0Y2JpQWdmVnh1WEc0Z0lDOHZJRkpsYzI5c2RtVWdaR1ZtWVhWc2RDQndjbTl3YzF4dUlDQnBaaUFvZEhsd1pTQW1KaUIwZVhCbExtUmxabUYxYkhSUWNtOXdjeWtnZTF4dUlDQWdJSFpoY2lCa1pXWmhkV3gwVUhKdmNITWdQU0IwZVhCbExtUmxabUYxYkhSUWNtOXdjenRjYmlBZ0lDQm1iM0lnS0hCeWIzQk9ZVzFsSUdsdUlHUmxabUYxYkhSUWNtOXdjeWtnZTF4dUlDQWdJQ0FnYVdZZ0tIQnliM0J6VzNCeWIzQk9ZVzFsWFNBOVBUMGdkVzVrWldacGJtVmtLU0I3WEc0Z0lDQWdJQ0FnSUhCeWIzQnpXM0J5YjNCT1lXMWxYU0E5SUdSbFptRjFiSFJRY205d2MxdHdjbTl3VG1GdFpWMDdYRzRnSUNBZ0lDQjlYRzRnSUNBZ2ZWeHVJQ0I5WEc0Z0lHbG1JQ2h3Y205alpYTnpMbVZ1ZGk1T1QwUkZYMFZPVmlBaFBUMGdKM0J5YjJSMVkzUnBiMjRuS1NCN1hHNGdJQ0FnYVdZZ0tHdGxlU0I4ZkNCeVpXWXBJSHRjYmlBZ0lDQWdJR2xtSUNoMGVYQmxiMllnY0hKdmNITXVKQ1IwZVhCbGIyWWdQVDA5SUNkMWJtUmxabWx1WldRbklIeDhJSEJ5YjNCekxpUWtkSGx3Wlc5bUlDRTlQU0JTUlVGRFZGOUZURVZOUlU1VVgxUlpVRVVwSUh0Y2JpQWdJQ0FnSUNBZ2RtRnlJR1JwYzNCc1lYbE9ZVzFsSUQwZ2RIbHdaVzltSUhSNWNHVWdQVDA5SUNkbWRXNWpkR2x2YmljZ1B5QjBlWEJsTG1ScGMzQnNZWGxPWVcxbElIeDhJSFI1Y0dVdWJtRnRaU0I4ZkNBblZXNXJibTkzYmljZ09pQjBlWEJsTzF4dUlDQWdJQ0FnSUNCcFppQW9hMlY1S1NCN1hHNGdJQ0FnSUNBZ0lDQWdaR1ZtYVc1bFMyVjVVSEp2Y0ZkaGNtNXBibWRIWlhSMFpYSW9jSEp2Y0hNc0lHUnBjM0JzWVhsT1lXMWxLVHRjYmlBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNCcFppQW9jbVZtS1NCN1hHNGdJQ0FnSUNBZ0lDQWdaR1ZtYVc1bFVtVm1VSEp2Y0ZkaGNtNXBibWRIWlhSMFpYSW9jSEp2Y0hNc0lHUnBjM0JzWVhsT1lXMWxLVHRjYmlBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnZlZ4dUlDQWdJSDFjYmlBZ2ZWeHVJQ0J5WlhSMWNtNGdVbVZoWTNSRmJHVnRaVzUwS0hSNWNHVXNJR3RsZVN3Z2NtVm1MQ0J6Wld4bUxDQnpiM1Z5WTJVc0lGSmxZV04wUTNWeWNtVnVkRTkzYm1WeUxtTjFjbkpsYm5Rc0lIQnliM0J6S1R0Y2JuMDdYRzVjYmk4cUtseHVJQ29nVW1WMGRYSnVJR0VnWm5WdVkzUnBiMjRnZEdoaGRDQndjbTlrZFdObGN5QlNaV0ZqZEVWc1pXMWxiblJ6SUc5bUlHRWdaMmwyWlc0Z2RIbHdaUzVjYmlBcUlGTmxaU0JvZEhSd2N6b3ZMMlpoWTJWaWIyOXJMbWRwZEdoMVlpNXBieTl5WldGamRDOWtiMk56TDNSdmNDMXNaWFpsYkMxaGNHa3VhSFJ0YkNOeVpXRmpkQzVqY21WaGRHVm1ZV04wYjNKNVhHNGdLaTljYmxKbFlXTjBSV3hsYldWdWRDNWpjbVZoZEdWR1lXTjBiM0o1SUQwZ1puVnVZM1JwYjI0Z0tIUjVjR1VwSUh0Y2JpQWdkbUZ5SUdaaFkzUnZjbmtnUFNCU1pXRmpkRVZzWlcxbGJuUXVZM0psWVhSbFJXeGxiV1Z1ZEM1aWFXNWtLRzUxYkd3c0lIUjVjR1VwTzF4dUlDQXZMeUJGZUhCdmMyVWdkR2hsSUhSNWNHVWdiMjRnZEdobElHWmhZM1J2Y25rZ1lXNWtJSFJvWlNCd2NtOTBiM1I1Y0dVZ2MyOGdkR2hoZENCcGRDQmpZVzRnWW1WY2JpQWdMeThnWldGemFXeDVJR0ZqWTJWemMyVmtJRzl1SUdWc1pXMWxiblJ6TGlCRkxtY3VJR0E4Um05dklDOCtMblI1Y0dVZ1BUMDlJRVp2YjJBdVhHNGdJQzh2SUZSb2FYTWdjMmh2ZFd4a0lHNXZkQ0JpWlNCdVlXMWxaQ0JnWTI5dWMzUnlkV04wYjNKZ0lITnBibU5sSUhSb2FYTWdiV0Y1SUc1dmRDQmlaU0IwYUdVZ1puVnVZM1JwYjI1Y2JpQWdMeThnZEdoaGRDQmpjbVZoZEdWa0lIUm9aU0JsYkdWdFpXNTBMQ0JoYm1RZ2FYUWdiV0Y1SUc1dmRDQmxkbVZ1SUdKbElHRWdZMjl1YzNSeWRXTjBiM0l1WEc0Z0lDOHZJRXhsWjJGamVTQm9iMjlySUZSUFJFODZJRmRoY200Z2FXWWdkR2hwY3lCcGN5QmhZMk5sYzNObFpGeHVJQ0JtWVdOMGIzSjVMblI1Y0dVZ1BTQjBlWEJsTzF4dUlDQnlaWFIxY200Z1ptRmpkRzl5ZVR0Y2JuMDdYRzVjYmxKbFlXTjBSV3hsYldWdWRDNWpiRzl1WlVGdVpGSmxjR3hoWTJWTFpYa2dQU0JtZFc1amRHbHZiaUFvYjJ4a1JXeGxiV1Z1ZEN3Z2JtVjNTMlY1S1NCN1hHNGdJSFpoY2lCdVpYZEZiR1Z0Wlc1MElEMGdVbVZoWTNSRmJHVnRaVzUwS0c5c1pFVnNaVzFsYm5RdWRIbHdaU3dnYm1WM1MyVjVMQ0J2YkdSRmJHVnRaVzUwTG5KbFppd2diMnhrUld4bGJXVnVkQzVmYzJWc1ppd2diMnhrUld4bGJXVnVkQzVmYzI5MWNtTmxMQ0J2YkdSRmJHVnRaVzUwTGw5dmQyNWxjaXdnYjJ4a1JXeGxiV1Z1ZEM1d2NtOXdjeWs3WEc1Y2JpQWdjbVYwZFhKdUlHNWxkMFZzWlcxbGJuUTdYRzU5TzF4dVhHNHZLaXBjYmlBcUlFTnNiMjVsSUdGdVpDQnlaWFIxY200Z1lTQnVaWGNnVW1WaFkzUkZiR1Z0Wlc1MElIVnphVzVuSUdWc1pXMWxiblFnWVhNZ2RHaGxJSE4wWVhKMGFXNW5JSEJ2YVc1MExseHVJQ29nVTJWbElHaDBkSEJ6T2k4dlptRmpaV0p2YjJzdVoybDBhSFZpTG1sdkwzSmxZV04wTDJSdlkzTXZkRzl3TFd4bGRtVnNMV0Z3YVM1b2RHMXNJM0psWVdOMExtTnNiMjVsWld4bGJXVnVkRnh1SUNvdlhHNVNaV0ZqZEVWc1pXMWxiblF1WTJ4dmJtVkZiR1Z0Wlc1MElEMGdablZ1WTNScGIyNGdLR1ZzWlcxbGJuUXNJR052Ym1acFp5d2dZMmhwYkdSeVpXNHBJSHRjYmlBZ2RtRnlJSEJ5YjNCT1lXMWxPMXh1WEc0Z0lDOHZJRTl5YVdkcGJtRnNJSEJ5YjNCeklHRnlaU0JqYjNCcFpXUmNiaUFnZG1GeUlIQnliM0J6SUQwZ1gyRnpjMmxuYmloN2ZTd2daV3hsYldWdWRDNXdjbTl3Y3lrN1hHNWNiaUFnTHk4Z1VtVnpaWEoyWldRZ2JtRnRaWE1nWVhKbElHVjRkSEpoWTNSbFpGeHVJQ0IyWVhJZ2EyVjVJRDBnWld4bGJXVnVkQzVyWlhrN1hHNGdJSFpoY2lCeVpXWWdQU0JsYkdWdFpXNTBMbkpsWmp0Y2JpQWdMeThnVTJWc1ppQnBjeUJ3Y21WelpYSjJaV1FnYzJsdVkyVWdkR2hsSUc5M2JtVnlJR2x6SUhCeVpYTmxjblpsWkM1Y2JpQWdkbUZ5SUhObGJHWWdQU0JsYkdWdFpXNTBMbDl6Wld4bU8xeHVJQ0F2THlCVGIzVnlZMlVnYVhNZ2NISmxjMlZ5ZG1Wa0lITnBibU5sSUdOc2IyNWxSV3hsYldWdWRDQnBjeUIxYm14cGEyVnNlU0IwYnlCaVpTQjBZWEpuWlhSbFpDQmllU0JoWEc0Z0lDOHZJSFJ5WVc1emNHbHNaWElzSUdGdVpDQjBhR1VnYjNKcFoybHVZV3dnYzI5MWNtTmxJR2x6SUhCeWIySmhZbXg1SUdFZ1ltVjBkR1Z5SUdsdVpHbGpZWFJ2Y2lCdlppQjBhR1ZjYmlBZ0x5OGdkSEoxWlNCdmQyNWxjaTVjYmlBZ2RtRnlJSE52ZFhKalpTQTlJR1ZzWlcxbGJuUXVYM052ZFhKalpUdGNibHh1SUNBdkx5QlBkMjVsY2lCM2FXeHNJR0psSUhCeVpYTmxjblpsWkN3Z2RXNXNaWE56SUhKbFppQnBjeUJ2ZG1WeWNtbGtaR1Z1WEc0Z0lIWmhjaUJ2ZDI1bGNpQTlJR1ZzWlcxbGJuUXVYMjkzYm1WeU8xeHVYRzRnSUdsbUlDaGpiMjVtYVdjZ0lUMGdiblZzYkNrZ2UxeHVJQ0FnSUdsbUlDaG9ZWE5XWVd4cFpGSmxaaWhqYjI1bWFXY3BLU0I3WEc0Z0lDQWdJQ0F2THlCVGFXeGxiblJzZVNCemRHVmhiQ0IwYUdVZ2NtVm1JR1p5YjIwZ2RHaGxJSEJoY21WdWRDNWNiaUFnSUNBZ0lISmxaaUE5SUdOdmJtWnBaeTV5WldZN1hHNGdJQ0FnSUNCdmQyNWxjaUE5SUZKbFlXTjBRM1Z5Y21WdWRFOTNibVZ5TG1OMWNuSmxiblE3WEc0Z0lDQWdmVnh1SUNBZ0lHbG1JQ2hvWVhOV1lXeHBaRXRsZVNoamIyNW1hV2NwS1NCN1hHNGdJQ0FnSUNCclpYa2dQU0FuSnlBcklHTnZibVpwWnk1clpYazdYRzRnSUNBZ2ZWeHVYRzRnSUNBZ0x5OGdVbVZ0WVdsdWFXNW5JSEJ5YjNCbGNuUnBaWE1nYjNabGNuSnBaR1VnWlhocGMzUnBibWNnY0hKdmNITmNiaUFnSUNCMllYSWdaR1ZtWVhWc2RGQnliM0J6TzF4dUlDQWdJR2xtSUNobGJHVnRaVzUwTG5SNWNHVWdKaVlnWld4bGJXVnVkQzUwZVhCbExtUmxabUYxYkhSUWNtOXdjeWtnZTF4dUlDQWdJQ0FnWkdWbVlYVnNkRkJ5YjNCeklEMGdaV3hsYldWdWRDNTBlWEJsTG1SbFptRjFiSFJRY205d2N6dGNiaUFnSUNCOVhHNGdJQ0FnWm05eUlDaHdjbTl3VG1GdFpTQnBiaUJqYjI1bWFXY3BJSHRjYmlBZ0lDQWdJR2xtSUNob1lYTlBkMjVRY205d1pYSjBlUzVqWVd4c0tHTnZibVpwWnl3Z2NISnZjRTVoYldVcElDWW1JQ0ZTUlZORlVsWkZSRjlRVWs5UVV5NW9ZWE5QZDI1UWNtOXdaWEowZVNod2NtOXdUbUZ0WlNrcElIdGNiaUFnSUNBZ0lDQWdhV1lnS0dOdmJtWnBaMXR3Y205d1RtRnRaVjBnUFQwOUlIVnVaR1ZtYVc1bFpDQW1KaUJrWldaaGRXeDBVSEp2Y0hNZ0lUMDlJSFZ1WkdWbWFXNWxaQ2tnZTF4dUlDQWdJQ0FnSUNBZ0lDOHZJRkpsYzI5c2RtVWdaR1ZtWVhWc2RDQndjbTl3YzF4dUlDQWdJQ0FnSUNBZ0lIQnliM0J6VzNCeWIzQk9ZVzFsWFNBOUlHUmxabUYxYkhSUWNtOXdjMXR3Y205d1RtRnRaVjA3WEc0Z0lDQWdJQ0FnSUgwZ1pXeHpaU0I3WEc0Z0lDQWdJQ0FnSUNBZ2NISnZjSE5iY0hKdmNFNWhiV1ZkSUQwZ1kyOXVabWxuVzNCeWIzQk9ZVzFsWFR0Y2JpQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ2ZWeHVJQ0FnSUgxY2JpQWdmVnh1WEc0Z0lDOHZJRU5vYVd4a2NtVnVJR05oYmlCaVpTQnRiM0psSUhSb1lXNGdiMjVsSUdGeVozVnRaVzUwTENCaGJtUWdkR2h2YzJVZ1lYSmxJSFJ5WVc1elptVnljbVZrSUc5dWRHOWNiaUFnTHk4Z2RHaGxJRzVsZDJ4NUlHRnNiRzlqWVhSbFpDQndjbTl3Y3lCdlltcGxZM1F1WEc0Z0lIWmhjaUJqYUdsc1pISmxia3hsYm1kMGFDQTlJR0Z5WjNWdFpXNTBjeTVzWlc1bmRHZ2dMU0F5TzF4dUlDQnBaaUFvWTJocGJHUnlaVzVNWlc1bmRHZ2dQVDA5SURFcElIdGNiaUFnSUNCd2NtOXdjeTVqYUdsc1pISmxiaUE5SUdOb2FXeGtjbVZ1TzF4dUlDQjlJR1ZzYzJVZ2FXWWdLR05vYVd4a2NtVnVUR1Z1WjNSb0lENGdNU2tnZTF4dUlDQWdJSFpoY2lCamFHbHNaRUZ5Y21GNUlEMGdRWEp5WVhrb1kyaHBiR1J5Wlc1TVpXNW5kR2dwTzF4dUlDQWdJR1p2Y2lBb2RtRnlJR2tnUFNBd095QnBJRHdnWTJocGJHUnlaVzVNWlc1bmRHZzdJR2tyS3lrZ2UxeHVJQ0FnSUNBZ1kyaHBiR1JCY25KaGVWdHBYU0E5SUdGeVozVnRaVzUwYzF0cElDc2dNbDA3WEc0Z0lDQWdmVnh1SUNBZ0lIQnliM0J6TG1Ob2FXeGtjbVZ1SUQwZ1kyaHBiR1JCY25KaGVUdGNiaUFnZlZ4dVhHNGdJSEpsZEhWeWJpQlNaV0ZqZEVWc1pXMWxiblFvWld4bGJXVnVkQzUwZVhCbExDQnJaWGtzSUhKbFppd2djMlZzWml3Z2MyOTFjbU5sTENCdmQyNWxjaXdnY0hKdmNITXBPMXh1ZlR0Y2JseHVMeW9xWEc0Z0tpQldaWEpwWm1sbGN5QjBhR1VnYjJKcVpXTjBJR2x6SUdFZ1VtVmhZM1JGYkdWdFpXNTBMbHh1SUNvZ1UyVmxJR2gwZEhCek9pOHZabUZqWldKdmIyc3VaMmwwYUhWaUxtbHZMM0psWVdOMEwyUnZZM012ZEc5d0xXeGxkbVZzTFdGd2FTNW9kRzFzSTNKbFlXTjBMbWx6ZG1Gc2FXUmxiR1Z0Wlc1MFhHNGdLaUJBY0dGeVlXMGdlejl2WW1wbFkzUjlJRzlpYW1WamRGeHVJQ29nUUhKbGRIVnliaUI3WW05dmJHVmhibjBnVkhKMVpTQnBaaUJnYjJKcVpXTjBZQ0JwY3lCaElIWmhiR2xrSUdOdmJYQnZibVZ1ZEM1Y2JpQXFJRUJtYVc1aGJGeHVJQ292WEc1U1pXRmpkRVZzWlcxbGJuUXVhWE5XWVd4cFpFVnNaVzFsYm5RZ1BTQm1kVzVqZEdsdmJpQW9iMkpxWldOMEtTQjdYRzRnSUhKbGRIVnliaUIwZVhCbGIyWWdiMkpxWldOMElEMDlQU0FuYjJKcVpXTjBKeUFtSmlCdlltcGxZM1FnSVQwOUlHNTFiR3dnSmlZZ2IySnFaV04wTGlRa2RIbHdaVzltSUQwOVBTQlNSVUZEVkY5RlRFVk5SVTVVWDFSWlVFVTdYRzU5TzF4dVhHNXRiMlIxYkdVdVpYaHdiM0owY3lBOUlGSmxZV04wUld4bGJXVnVkRHNpTENJdktpcGNiaUFxSUVOdmNIbHlhV2RvZENBeU1ERTBMWEJ5WlhObGJuUXNJRVpoWTJWaWIyOXJMQ0JKYm1NdVhHNGdLaUJCYkd3Z2NtbG5hSFJ6SUhKbGMyVnlkbVZrTGx4dUlDcGNiaUFxSUZSb2FYTWdjMjkxY21ObElHTnZaR1VnYVhNZ2JHbGpaVzV6WldRZ2RXNWtaWElnZEdobElFSlRSQzF6ZEhsc1pTQnNhV05sYm5ObElHWnZkVzVrSUdsdUlIUm9aVnh1SUNvZ1RFbERSVTVUUlNCbWFXeGxJR2x1SUhSb1pTQnliMjkwSUdScGNtVmpkRzl5ZVNCdlppQjBhR2x6SUhOdmRYSmpaU0IwY21WbExpQkJiaUJoWkdScGRHbHZibUZzSUdkeVlXNTBYRzRnS2lCdlppQndZWFJsYm5RZ2NtbG5hSFJ6SUdOaGJpQmlaU0JtYjNWdVpDQnBiaUIwYUdVZ1VFRlVSVTVVVXlCbWFXeGxJR2x1SUhSb1pTQnpZVzFsSUdScGNtVmpkRzl5ZVM1Y2JpQXFYRzRnS2lCY2JpQXFMMXh1WEc0bmRYTmxJSE4wY21samRDYzdYRzVjYmk4dklGUm9aU0JUZVcxaWIyd2dkWE5sWkNCMGJ5QjBZV2NnZEdobElGSmxZV04wUld4bGJXVnVkQ0IwZVhCbExpQkpaaUIwYUdWeVpTQnBjeUJ1YnlCdVlYUnBkbVVnVTNsdFltOXNYRzR2THlCdWIzSWdjRzlzZVdacGJHd3NJSFJvWlc0Z1lTQndiR0ZwYmlCdWRXMWlaWElnYVhNZ2RYTmxaQ0JtYjNJZ2NHVnlabTl5YldGdVkyVXVYRzVjYm5aaGNpQlNSVUZEVkY5RlRFVk5SVTVVWDFSWlVFVWdQU0IwZVhCbGIyWWdVM2x0WW05c0lEMDlQU0FuWm5WdVkzUnBiMjRuSUNZbUlGTjViV0p2YkZzblptOXlKMTBnSmlZZ1UzbHRZbTlzV3lkbWIzSW5YU2duY21WaFkzUXVaV3hsYldWdWRDY3BJSHg4SURCNFpXRmpOenRjYmx4dWJXOWtkV3hsTG1WNGNHOXlkSE1nUFNCU1JVRkRWRjlGVEVWTlJVNVVYMVJaVUVVN0lpd2lMeW9xWEc0Z0tpQkRiM0I1Y21sbmFIUWdNakF4TkMxd2NtVnpaVzUwTENCR1lXTmxZbTl2YXl3Z1NXNWpMbHh1SUNvZ1FXeHNJSEpwWjJoMGN5QnlaWE5sY25abFpDNWNiaUFxWEc0Z0tpQlVhR2x6SUhOdmRYSmpaU0JqYjJSbElHbHpJR3hwWTJWdWMyVmtJSFZ1WkdWeUlIUm9aU0JDVTBRdGMzUjViR1VnYkdsalpXNXpaU0JtYjNWdVpDQnBiaUIwYUdWY2JpQXFJRXhKUTBWT1UwVWdabWxzWlNCcGJpQjBhR1VnY205dmRDQmthWEpsWTNSdmNua2diMllnZEdocGN5QnpiM1Z5WTJVZ2RISmxaUzRnUVc0Z1lXUmthWFJwYjI1aGJDQm5jbUZ1ZEZ4dUlDb2diMllnY0dGMFpXNTBJSEpwWjJoMGN5QmpZVzRnWW1VZ1ptOTFibVFnYVc0Z2RHaGxJRkJCVkVWT1ZGTWdabWxzWlNCcGJpQjBhR1VnYzJGdFpTQmthWEpsWTNSdmNua3VYRzRnS2x4dUlDb3ZYRzVjYmk4cUtseHVJQ29nVW1WaFkzUkZiR1Z0Wlc1MFZtRnNhV1JoZEc5eUlIQnliM1pwWkdWeklHRWdkM0poY0hCbGNpQmhjbTkxYm1RZ1lTQmxiR1Z0Wlc1MElHWmhZM1J2Y25sY2JpQXFJSGRvYVdOb0lIWmhiR2xrWVhSbGN5QjBhR1VnY0hKdmNITWdjR0Z6YzJWa0lIUnZJSFJvWlNCbGJHVnRaVzUwTGlCVWFHbHpJR2x6SUdsdWRHVnVaR1ZrSUhSdklHSmxYRzRnS2lCMWMyVmtJRzl1YkhrZ2FXNGdSRVZXSUdGdVpDQmpiM1ZzWkNCaVpTQnlaWEJzWVdObFpDQmllU0JoSUhOMFlYUnBZeUIwZVhCbElHTm9aV05yWlhJZ1ptOXlJR3hoYm1kMVlXZGxjMXh1SUNvZ2RHaGhkQ0J6ZFhCd2IzSjBJR2wwTGx4dUlDb3ZYRzVjYmlkMWMyVWdjM1J5YVdOMEp6dGNibHh1ZG1GeUlGSmxZV04wUTNWeWNtVnVkRTkzYm1WeUlEMGdjbVZ4ZFdseVpTZ25MaTlTWldGamRFTjFjbkpsYm5SUGQyNWxjaWNwTzF4dWRtRnlJRkpsWVdOMFEyOXRjRzl1Wlc1MFZISmxaVWh2YjJzZ1BTQnlaWEYxYVhKbEtDY3VMMUpsWVdOMFEyOXRjRzl1Wlc1MFZISmxaVWh2YjJzbktUdGNiblpoY2lCU1pXRmpkRVZzWlcxbGJuUWdQU0J5WlhGMWFYSmxLQ2N1TDFKbFlXTjBSV3hsYldWdWRDY3BPMXh1WEc1MllYSWdZMmhsWTJ0U1pXRmpkRlI1Y0dWVGNHVmpJRDBnY21WeGRXbHlaU2duTGk5amFHVmphMUpsWVdOMFZIbHdaVk53WldNbktUdGNibHh1ZG1GeUlHTmhia1JsWm1sdVpWQnliM0JsY25SNUlEMGdjbVZ4ZFdseVpTZ25MaTlqWVc1RVpXWnBibVZRY205d1pYSjBlU2NwTzF4dWRtRnlJR2RsZEVsMFpYSmhkRzl5Um00Z1BTQnlaWEYxYVhKbEtDY3VMMmRsZEVsMFpYSmhkRzl5Um00bktUdGNiblpoY2lCM1lYSnVhVzVuSUQwZ2NtVnhkV2x5WlNnblptSnFjeTlzYVdJdmQyRnlibWx1WnljcE8xeHVkbUZ5SUd4dmQxQnlhVzl5YVhSNVYyRnlibWx1WnlBOUlISmxjWFZwY21Vb0p5NHZiRzkzVUhKcGIzSnBkSGxYWVhKdWFXNW5KeWs3WEc1Y2JtWjFibU4wYVc5dUlHZGxkRVJsWTJ4aGNtRjBhVzl1UlhKeWIzSkJaR1JsYm1SMWJTZ3BJSHRjYmlBZ2FXWWdLRkpsWVdOMFEzVnljbVZ1ZEU5M2JtVnlMbU4xY25KbGJuUXBJSHRjYmlBZ0lDQjJZWElnYm1GdFpTQTlJRkpsWVdOMFEzVnljbVZ1ZEU5M2JtVnlMbU4xY25KbGJuUXVaMlYwVG1GdFpTZ3BPMXh1SUNBZ0lHbG1JQ2h1WVcxbEtTQjdYRzRnSUNBZ0lDQnlaWFIxY200Z0p5QkRhR1ZqYXlCMGFHVWdjbVZ1WkdWeUlHMWxkR2h2WkNCdlppQmdKeUFySUc1aGJXVWdLeUFuWUM0bk8xeHVJQ0FnSUgxY2JpQWdmVnh1SUNCeVpYUjFjbTRnSnljN1hHNTlYRzVjYm1aMWJtTjBhVzl1SUdkbGRGTnZkWEpqWlVsdVptOUZjbkp2Y2tGa1pHVnVaSFZ0S0dWc1pXMWxiblJRY205d2N5a2dlMXh1SUNCcFppQW9aV3hsYldWdWRGQnliM0J6SUNFOVBTQnVkV3hzSUNZbUlHVnNaVzFsYm5SUWNtOXdjeUFoUFQwZ2RXNWtaV1pwYm1Wa0lDWW1JR1ZzWlcxbGJuUlFjbTl3Y3k1ZlgzTnZkWEpqWlNBaFBUMGdkVzVrWldacGJtVmtLU0I3WEc0Z0lDQWdkbUZ5SUhOdmRYSmpaU0E5SUdWc1pXMWxiblJRY205d2N5NWZYM052ZFhKalpUdGNiaUFnSUNCMllYSWdabWxzWlU1aGJXVWdQU0J6YjNWeVkyVXVabWxzWlU1aGJXVXVjbVZ3YkdGalpTZ3ZYaTRxVzF4Y1hGeGNYQzlkTHl3Z0p5Y3BPMXh1SUNBZ0lIWmhjaUJzYVc1bFRuVnRZbVZ5SUQwZ2MyOTFjbU5sTG14cGJtVk9kVzFpWlhJN1hHNGdJQ0FnY21WMGRYSnVJQ2NnUTJobFkyc2dlVzkxY2lCamIyUmxJR0YwSUNjZ0t5Qm1hV3hsVG1GdFpTQXJJQ2M2SnlBcklHeHBibVZPZFcxaVpYSWdLeUFuTGljN1hHNGdJSDFjYmlBZ2NtVjBkWEp1SUNjbk8xeHVmVnh1WEc0dktpcGNiaUFxSUZkaGNtNGdhV1lnZEdobGNtVW5jeUJ1YnlCclpYa2daWGh3YkdsamFYUnNlU0J6WlhRZ2IyNGdaSGx1WVcxcFl5QmhjbkpoZVhNZ2IyWWdZMmhwYkdSeVpXNGdiM0pjYmlBcUlHOWlhbVZqZENCclpYbHpJR0Z5WlNCdWIzUWdkbUZzYVdRdUlGUm9hWE1nWVd4c2IzZHpJSFZ6SUhSdklHdGxaWEFnZEhKaFkyc2diMllnWTJocGJHUnlaVzRnWW1WMGQyVmxibHh1SUNvZ2RYQmtZWFJsY3k1Y2JpQXFMMXh1ZG1GeUlHOTNibVZ5U0dGelMyVjVWWE5sVjJGeWJtbHVaeUE5SUh0OU8xeHVYRzVtZFc1amRHbHZiaUJuWlhSRGRYSnlaVzUwUTI5dGNHOXVaVzUwUlhKeWIzSkpibVp2S0hCaGNtVnVkRlI1Y0dVcElIdGNiaUFnZG1GeUlHbHVabThnUFNCblpYUkVaV05zWVhKaGRHbHZia1Z5Y205eVFXUmtaVzVrZFcwb0tUdGNibHh1SUNCcFppQW9JV2x1Wm04cElIdGNiaUFnSUNCMllYSWdjR0Z5Wlc1MFRtRnRaU0E5SUhSNWNHVnZaaUJ3WVhKbGJuUlVlWEJsSUQwOVBTQW5jM1J5YVc1bkp5QS9JSEJoY21WdWRGUjVjR1VnT2lCd1lYSmxiblJVZVhCbExtUnBjM0JzWVhsT1lXMWxJSHg4SUhCaGNtVnVkRlI1Y0dVdWJtRnRaVHRjYmlBZ0lDQnBaaUFvY0dGeVpXNTBUbUZ0WlNrZ2UxeHVJQ0FnSUNBZ2FXNW1ieUE5SUNjZ1EyaGxZMnNnZEdobElIUnZjQzFzWlhabGJDQnlaVzVrWlhJZ1kyRnNiQ0IxYzJsdVp5QThKeUFySUhCaGNtVnVkRTVoYldVZ0t5QW5QaTRuTzF4dUlDQWdJSDFjYmlBZ2ZWeHVJQ0J5WlhSMWNtNGdhVzVtYnp0Y2JuMWNibHh1THlvcVhHNGdLaUJYWVhKdUlHbG1JSFJvWlNCbGJHVnRaVzUwSUdSdlpYTnVKM1FnYUdGMlpTQmhiaUJsZUhCc2FXTnBkQ0JyWlhrZ1lYTnphV2R1WldRZ2RHOGdhWFF1WEc0Z0tpQlVhR2x6SUdWc1pXMWxiblFnYVhNZ2FXNGdZVzRnWVhKeVlYa3VJRlJvWlNCaGNuSmhlU0JqYjNWc1pDQm5jbTkzSUdGdVpDQnphSEpwYm1zZ2IzSWdZbVZjYmlBcUlISmxiM0prWlhKbFpDNGdRV3hzSUdOb2FXeGtjbVZ1SUhSb1lYUWdhR0YyWlc0bmRDQmhiSEpsWVdSNUlHSmxaVzRnZG1Gc2FXUmhkR1ZrSUdGeVpTQnlaWEYxYVhKbFpDQjBiMXh1SUNvZ2FHRjJaU0JoSUZ3aWEyVjVYQ0lnY0hKdmNHVnlkSGtnWVhOemFXZHVaV1FnZEc4Z2FYUXVJRVZ5Y205eUlITjBZWFIxYzJWeklHRnlaU0JqWVdOb1pXUWdjMjhnWVNCM1lYSnVhVzVuWEc0Z0tpQjNhV3hzSUc5dWJIa2dZbVVnYzJodmQyNGdiMjVqWlM1Y2JpQXFYRzRnS2lCQWFXNTBaWEp1WVd4Y2JpQXFJRUJ3WVhKaGJTQjdVbVZoWTNSRmJHVnRaVzUwZlNCbGJHVnRaVzUwSUVWc1pXMWxiblFnZEdoaGRDQnlaWEYxYVhKbGN5QmhJR3RsZVM1Y2JpQXFJRUJ3WVhKaGJTQjdLbjBnY0dGeVpXNTBWSGx3WlNCbGJHVnRaVzUwSjNNZ2NHRnlaVzUwSjNNZ2RIbHdaUzVjYmlBcUwxeHVablZ1WTNScGIyNGdkbUZzYVdSaGRHVkZlSEJzYVdOcGRFdGxlU2hsYkdWdFpXNTBMQ0J3WVhKbGJuUlVlWEJsS1NCN1hHNGdJR2xtSUNnaFpXeGxiV1Z1ZEM1ZmMzUnZjbVVnZkh3Z1pXeGxiV1Z1ZEM1ZmMzUnZjbVV1ZG1Gc2FXUmhkR1ZrSUh4OElHVnNaVzFsYm5RdWEyVjVJQ0U5SUc1MWJHd3BJSHRjYmlBZ0lDQnlaWFIxY200N1hHNGdJSDFjYmlBZ1pXeGxiV1Z1ZEM1ZmMzUnZjbVV1ZG1Gc2FXUmhkR1ZrSUQwZ2RISjFaVHRjYmx4dUlDQjJZWElnYldWdGIybDZaWElnUFNCdmQyNWxja2hoYzB0bGVWVnpaVmRoY201cGJtY3VkVzVwY1hWbFMyVjVJSHg4SUNodmQyNWxja2hoYzB0bGVWVnpaVmRoY201cGJtY3VkVzVwY1hWbFMyVjVJRDBnZTMwcE8xeHVYRzRnSUhaaGNpQmpkWEp5Wlc1MFEyOXRjRzl1Wlc1MFJYSnliM0pKYm1adklEMGdaMlYwUTNWeWNtVnVkRU52YlhCdmJtVnVkRVZ5Y205eVNXNW1ieWh3WVhKbGJuUlVlWEJsS1R0Y2JpQWdhV1lnS0cxbGJXOXBlbVZ5VzJOMWNuSmxiblJEYjIxd2IyNWxiblJGY25KdmNrbHVabTlkS1NCN1hHNGdJQ0FnY21WMGRYSnVPMXh1SUNCOVhHNGdJRzFsYlc5cGVtVnlXMk4xY25KbGJuUkRiMjF3YjI1bGJuUkZjbkp2Y2tsdVptOWRJRDBnZEhKMVpUdGNibHh1SUNBdkx5QlZjM1ZoYkd4NUlIUm9aU0JqZFhKeVpXNTBJRzkzYm1WeUlHbHpJSFJvWlNCdlptWmxibVJsY2l3Z1luVjBJR2xtSUdsMElHRmpZMlZ3ZEhNZ1kyaHBiR1J5Wlc0Z1lYTWdZVnh1SUNBdkx5QndjbTl3WlhKMGVTd2dhWFFnYldGNUlHSmxJSFJvWlNCamNtVmhkRzl5SUc5bUlIUm9aU0JqYUdsc1pDQjBhR0YwSjNNZ2NtVnpjRzl1YzJsaWJHVWdabTl5WEc0Z0lDOHZJR0Z6YzJsbmJtbHVaeUJwZENCaElHdGxlUzVjYmlBZ2RtRnlJR05vYVd4a1QzZHVaWElnUFNBbkp6dGNiaUFnYVdZZ0tHVnNaVzFsYm5RZ0ppWWdaV3hsYldWdWRDNWZiM2R1WlhJZ0ppWWdaV3hsYldWdWRDNWZiM2R1WlhJZ0lUMDlJRkpsWVdOMFEzVnljbVZ1ZEU5M2JtVnlMbU4xY25KbGJuUXBJSHRjYmlBZ0lDQXZMeUJIYVhabElIUm9aU0JqYjIxd2IyNWxiblFnZEdoaGRDQnZjbWxuYVc1aGJHeDVJR055WldGMFpXUWdkR2hwY3lCamFHbHNaQzVjYmlBZ0lDQmphR2xzWkU5M2JtVnlJRDBnSnlCSmRDQjNZWE1nY0dGemMyVmtJR0VnWTJocGJHUWdabkp2YlNBbklDc2daV3hsYldWdWRDNWZiM2R1WlhJdVoyVjBUbUZ0WlNncElDc2dKeTRuTzF4dUlDQjlYRzVjYmlBZ2NISnZZMlZ6Y3k1bGJuWXVUazlFUlY5RlRsWWdJVDA5SUNkd2NtOWtkV04wYVc5dUp5QS9JSGRoY201cGJtY29abUZzYzJVc0lDZEZZV05vSUdOb2FXeGtJR2x1SUdGdUlHRnljbUY1SUc5eUlHbDBaWEpoZEc5eUlITm9iM1ZzWkNCb1lYWmxJR0VnZFc1cGNYVmxJRndpYTJWNVhDSWdjSEp2Y0M0bklDc2dKeVZ6SlhNZ1UyVmxJR2gwZEhCek9pOHZabUl1YldVdmNtVmhZM1F0ZDJGeWJtbHVaeTFyWlhseklHWnZjaUJ0YjNKbElHbHVabTl5YldGMGFXOXVMaVZ6Snl3Z1kzVnljbVZ1ZEVOdmJYQnZibVZ1ZEVWeWNtOXlTVzVtYnl3Z1kyaHBiR1JQZDI1bGNpd2dVbVZoWTNSRGIyMXdiMjVsYm5SVWNtVmxTRzl2YXk1blpYUkRkWEp5Wlc1MFUzUmhZMnRCWkdSbGJtUjFiU2hsYkdWdFpXNTBLU2tnT2lCMmIybGtJREE3WEc1OVhHNWNiaThxS2x4dUlDb2dSVzV6ZFhKbElIUm9ZWFFnWlhabGNua2daV3hsYldWdWRDQmxhWFJvWlhJZ2FYTWdjR0Z6YzJWa0lHbHVJR0VnYzNSaGRHbGpJR3h2WTJGMGFXOXVMQ0JwYmlCaGJseHVJQ29nWVhKeVlYa2dkMmwwYUNCaGJpQmxlSEJzYVdOcGRDQnJaWGx6SUhCeWIzQmxjblI1SUdSbFptbHVaV1FzSUc5eUlHbHVJR0Z1SUc5aWFtVmpkQ0JzYVhSbGNtRnNYRzRnS2lCM2FYUm9JSFpoYkdsa0lHdGxlU0J3Y205d1pYSjBlUzVjYmlBcVhHNGdLaUJBYVc1MFpYSnVZV3hjYmlBcUlFQndZWEpoYlNCN1VtVmhZM1JPYjJSbGZTQnViMlJsSUZOMFlYUnBZMkZzYkhrZ2NHRnpjMlZrSUdOb2FXeGtJRzltSUdGdWVTQjBlWEJsTGx4dUlDb2dRSEJoY21GdElIc3FmU0J3WVhKbGJuUlVlWEJsSUc1dlpHVW5jeUJ3WVhKbGJuUW5jeUIwZVhCbExseHVJQ292WEc1bWRXNWpkR2x2YmlCMllXeHBaR0YwWlVOb2FXeGtTMlY1Y3lodWIyUmxMQ0J3WVhKbGJuUlVlWEJsS1NCN1hHNGdJR2xtSUNoMGVYQmxiMllnYm05a1pTQWhQVDBnSjI5aWFtVmpkQ2NwSUh0Y2JpQWdJQ0J5WlhSMWNtNDdYRzRnSUgxY2JpQWdhV1lnS0VGeWNtRjVMbWx6UVhKeVlYa29ibTlrWlNrcElIdGNiaUFnSUNCbWIzSWdLSFpoY2lCcElEMGdNRHNnYVNBOElHNXZaR1V1YkdWdVozUm9PeUJwS3lzcElIdGNiaUFnSUNBZ0lIWmhjaUJqYUdsc1pDQTlJRzV2WkdWYmFWMDdYRzRnSUNBZ0lDQnBaaUFvVW1WaFkzUkZiR1Z0Wlc1MExtbHpWbUZzYVdSRmJHVnRaVzUwS0dOb2FXeGtLU2tnZTF4dUlDQWdJQ0FnSUNCMllXeHBaR0YwWlVWNGNHeHBZMmwwUzJWNUtHTm9hV3hrTENCd1lYSmxiblJVZVhCbEtUdGNiaUFnSUNBZ0lIMWNiaUFnSUNCOVhHNGdJSDBnWld4elpTQnBaaUFvVW1WaFkzUkZiR1Z0Wlc1MExtbHpWbUZzYVdSRmJHVnRaVzUwS0c1dlpHVXBLU0I3WEc0Z0lDQWdMeThnVkdocGN5QmxiR1Z0Wlc1MElIZGhjeUJ3WVhOelpXUWdhVzRnWVNCMllXeHBaQ0JzYjJOaGRHbHZiaTVjYmlBZ0lDQnBaaUFvYm05a1pTNWZjM1J2Y21VcElIdGNiaUFnSUNBZ0lHNXZaR1V1WDNOMGIzSmxMblpoYkdsa1lYUmxaQ0E5SUhSeWRXVTdYRzRnSUNBZ2ZWeHVJQ0I5SUdWc2MyVWdhV1lnS0c1dlpHVXBJSHRjYmlBZ0lDQjJZWElnYVhSbGNtRjBiM0pHYmlBOUlHZGxkRWwwWlhKaGRHOXlSbTRvYm05a1pTazdYRzRnSUNBZ0x5OGdSVzUwY25rZ2FYUmxjbUYwYjNKeklIQnliM1pwWkdVZ2FXMXdiR2xqYVhRZ2EyVjVjeTVjYmlBZ0lDQnBaaUFvYVhSbGNtRjBiM0pHYmlrZ2UxeHVJQ0FnSUNBZ2FXWWdLR2wwWlhKaGRHOXlSbTRnSVQwOUlHNXZaR1V1Wlc1MGNtbGxjeWtnZTF4dUlDQWdJQ0FnSUNCMllYSWdhWFJsY21GMGIzSWdQU0JwZEdWeVlYUnZja1p1TG1OaGJHd29ibTlrWlNrN1hHNGdJQ0FnSUNBZ0lIWmhjaUJ6ZEdWd08xeHVJQ0FnSUNBZ0lDQjNhR2xzWlNBb0lTaHpkR1Z3SUQwZ2FYUmxjbUYwYjNJdWJtVjRkQ2dwS1M1a2IyNWxLU0I3WEc0Z0lDQWdJQ0FnSUNBZ2FXWWdLRkpsWVdOMFJXeGxiV1Z1ZEM1cGMxWmhiR2xrUld4bGJXVnVkQ2h6ZEdWd0xuWmhiSFZsS1NrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnZG1Gc2FXUmhkR1ZGZUhCc2FXTnBkRXRsZVNoemRHVndMblpoYkhWbExDQndZWEpsYm5SVWVYQmxLVHRjYmlBZ0lDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lIMWNiaUFnSUNCOVhHNGdJSDFjYm4xY2JseHVMeW9xWEc0Z0tpQkhhWFpsYmlCaGJpQmxiR1Z0Wlc1MExDQjJZV3hwWkdGMFpTQjBhR0YwSUdsMGN5QndjbTl3Y3lCbWIyeHNiM2NnZEdobElIQnliM0JVZVhCbGN5QmtaV1pwYm1sMGFXOXVMRnh1SUNvZ2NISnZkbWxrWldRZ1lua2dkR2hsSUhSNWNHVXVYRzRnS2x4dUlDb2dRSEJoY21GdElIdFNaV0ZqZEVWc1pXMWxiblI5SUdWc1pXMWxiblJjYmlBcUwxeHVablZ1WTNScGIyNGdkbUZzYVdSaGRHVlFjbTl3Vkhsd1pYTW9aV3hsYldWdWRDa2dlMXh1SUNCMllYSWdZMjl0Y0c5dVpXNTBRMnhoYzNNZ1BTQmxiR1Z0Wlc1MExuUjVjR1U3WEc0Z0lHbG1JQ2gwZVhCbGIyWWdZMjl0Y0c5dVpXNTBRMnhoYzNNZ0lUMDlJQ2RtZFc1amRHbHZiaWNwSUh0Y2JpQWdJQ0J5WlhSMWNtNDdYRzRnSUgxY2JpQWdkbUZ5SUc1aGJXVWdQU0JqYjIxd2IyNWxiblJEYkdGemN5NWthWE53YkdGNVRtRnRaU0I4ZkNCamIyMXdiMjVsYm5SRGJHRnpjeTV1WVcxbE8xeHVJQ0JwWmlBb1kyOXRjRzl1Wlc1MFEyeGhjM011Y0hKdmNGUjVjR1Z6S1NCN1hHNGdJQ0FnWTJobFkydFNaV0ZqZEZSNWNHVlRjR1ZqS0dOdmJYQnZibVZ1ZEVOc1lYTnpMbkJ5YjNCVWVYQmxjeXdnWld4bGJXVnVkQzV3Y205d2N5d2dKM0J5YjNBbkxDQnVZVzFsTENCbGJHVnRaVzUwTENCdWRXeHNLVHRjYmlBZ2ZWeHVJQ0JwWmlBb2RIbHdaVzltSUdOdmJYQnZibVZ1ZEVOc1lYTnpMbWRsZEVSbFptRjFiSFJRY205d2N5QTlQVDBnSjJaMWJtTjBhVzl1SnlrZ2UxeHVJQ0FnSUhCeWIyTmxjM011Wlc1MkxrNVBSRVZmUlU1V0lDRTlQU0FuY0hKdlpIVmpkR2x2YmljZ1B5QjNZWEp1YVc1bktHTnZiWEJ2Ym1WdWRFTnNZWE56TG1kbGRFUmxabUYxYkhSUWNtOXdjeTVwYzFKbFlXTjBRMnhoYzNOQmNIQnliM1psWkN3Z0oyZGxkRVJsWm1GMWJIUlFjbTl3Y3lCcGN5QnZibXg1SUhWelpXUWdiMjRnWTJ4aGMzTnBZeUJTWldGamRDNWpjbVZoZEdWRGJHRnpjeUFuSUNzZ0oyUmxabWx1YVhScGIyNXpMaUJWYzJVZ1lTQnpkR0YwYVdNZ2NISnZjR1Z5ZEhrZ2JtRnRaV1FnWUdSbFptRjFiSFJRY205d2MyQWdhVzV6ZEdWaFpDNG5LU0E2SUhadmFXUWdNRHRjYmlBZ2ZWeHVmVnh1WEc1MllYSWdVbVZoWTNSRmJHVnRaVzUwVm1Gc2FXUmhkRzl5SUQwZ2UxeHVJQ0JqY21WaGRHVkZiR1Z0Wlc1ME9pQm1kVzVqZEdsdmJpQW9kSGx3WlN3Z2NISnZjSE1zSUdOb2FXeGtjbVZ1S1NCN1hHNGdJQ0FnZG1GeUlIWmhiR2xrVkhsd1pTQTlJSFI1Y0dWdlppQjBlWEJsSUQwOVBTQW5jM1J5YVc1bkp5QjhmQ0IwZVhCbGIyWWdkSGx3WlNBOVBUMGdKMloxYm1OMGFXOXVKenRjYmlBZ0lDQXZMeUJYWlNCM1lYSnVJR2x1SUhSb2FYTWdZMkZ6WlNCaWRYUWdaRzl1SjNRZ2RHaHliM2N1SUZkbElHVjRjR1ZqZENCMGFHVWdaV3hsYldWdWRDQmpjbVZoZEdsdmJpQjBiMXh1SUNBZ0lDOHZJSE4xWTJObFpXUWdZVzVrSUhSb1pYSmxJSGRwYkd3Z2JHbHJaV3g1SUdKbElHVnljbTl5Y3lCcGJpQnlaVzVrWlhJdVhHNGdJQ0FnYVdZZ0tDRjJZV3hwWkZSNWNHVXBJSHRjYmlBZ0lDQWdJR2xtSUNoMGVYQmxiMllnZEhsd1pTQWhQVDBnSjJaMWJtTjBhVzl1SnlBbUppQjBlWEJsYjJZZ2RIbHdaU0FoUFQwZ0ozTjBjbWx1WnljcElIdGNiaUFnSUNBZ0lDQWdkbUZ5SUdsdVptOGdQU0FuSnp0Y2JpQWdJQ0FnSUNBZ2FXWWdLSFI1Y0dVZ1BUMDlJSFZ1WkdWbWFXNWxaQ0I4ZkNCMGVYQmxiMllnZEhsd1pTQTlQVDBnSjI5aWFtVmpkQ2NnSmlZZ2RIbHdaU0FoUFQwZ2JuVnNiQ0FtSmlCUFltcGxZM1F1YTJWNWN5aDBlWEJsS1M1c1pXNW5kR2dnUFQwOUlEQXBJSHRjYmlBZ0lDQWdJQ0FnSUNCcGJtWnZJQ3M5SUNjZ1dXOTFJR3hwYTJWc2VTQm1iM0puYjNRZ2RHOGdaWGh3YjNKMElIbHZkWElnWTI5dGNHOXVaVzUwSUdaeWIyMGdkR2hsSUdacGJHVWdKeUFySUZ3aWFYUW5jeUJrWldacGJtVmtJR2x1TGx3aU8xeHVJQ0FnSUNBZ0lDQjlYRzVjYmlBZ0lDQWdJQ0FnZG1GeUlITnZkWEpqWlVsdVptOGdQU0JuWlhSVGIzVnlZMlZKYm1adlJYSnliM0pCWkdSbGJtUjFiU2h3Y205d2N5azdYRzRnSUNBZ0lDQWdJR2xtSUNoemIzVnlZMlZKYm1adktTQjdYRzRnSUNBZ0lDQWdJQ0FnYVc1bWJ5QXJQU0J6YjNWeVkyVkpibVp2TzF4dUlDQWdJQ0FnSUNCOUlHVnNjMlVnZTF4dUlDQWdJQ0FnSUNBZ0lHbHVabThnS3owZ1oyVjBSR1ZqYkdGeVlYUnBiMjVGY25KdmNrRmtaR1Z1WkhWdEtDazdYRzRnSUNBZ0lDQWdJSDFjYmx4dUlDQWdJQ0FnSUNCcGJtWnZJQ3M5SUZKbFlXTjBRMjl0Y0c5dVpXNTBWSEpsWlVodmIyc3VaMlYwUTNWeWNtVnVkRk4wWVdOclFXUmtaVzVrZFcwb0tUdGNibHh1SUNBZ0lDQWdJQ0IyWVhJZ1kzVnljbVZ1ZEZOdmRYSmpaU0E5SUhCeWIzQnpJQ0U5UFNCdWRXeHNJQ1ltSUhCeWIzQnpJQ0U5UFNCMWJtUmxabWx1WldRZ0ppWWdjSEp2Y0hNdVgxOXpiM1Z5WTJVZ0lUMDlJSFZ1WkdWbWFXNWxaQ0EvSUhCeWIzQnpMbDlmYzI5MWNtTmxJRG9nYm5Wc2JEdGNiaUFnSUNBZ0lDQWdVbVZoWTNSRGIyMXdiMjVsYm5SVWNtVmxTRzl2YXk1d2RYTm9UbTl1VTNSaGJtUmhjbVJYWVhKdWFXNW5VM1JoWTJzb2RISjFaU3dnWTNWeWNtVnVkRk52ZFhKalpTazdYRzRnSUNBZ0lDQWdJSEJ5YjJObGMzTXVaVzUyTGs1UFJFVmZSVTVXSUNFOVBTQW5jSEp2WkhWamRHbHZiaWNnUHlCM1lYSnVhVzVuS0daaGJITmxMQ0FuVW1WaFkzUXVZM0psWVhSbFJXeGxiV1Z1ZERvZ2RIbHdaU0JwY3lCcGJuWmhiR2xrSUMwdElHVjRjR1ZqZEdWa0lHRWdjM1J5YVc1bklDaG1iM0lnSnlBcklDZGlkV2xzZEMxcGJpQmpiMjF3YjI1bGJuUnpLU0J2Y2lCaElHTnNZWE56TDJaMWJtTjBhVzl1SUNobWIzSWdZMjl0Y0c5emFYUmxJQ2NnS3lBblkyOXRjRzl1Wlc1MGN5a2dZblYwSUdkdmREb2dKWE11SlhNbkxDQjBlWEJsSUQwOUlHNTFiR3dnUHlCMGVYQmxJRG9nZEhsd1pXOW1JSFI1Y0dVc0lHbHVabThwSURvZ2RtOXBaQ0F3TzF4dUlDQWdJQ0FnSUNCU1pXRmpkRU52YlhCdmJtVnVkRlJ5WldWSWIyOXJMbkJ2Y0U1dmJsTjBZVzVrWVhKa1YyRnlibWx1WjFOMFlXTnJLQ2s3WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdmVnh1WEc0Z0lDQWdkbUZ5SUdWc1pXMWxiblFnUFNCU1pXRmpkRVZzWlcxbGJuUXVZM0psWVhSbFJXeGxiV1Z1ZEM1aGNIQnNlU2gwYUdsekxDQmhjbWQxYldWdWRITXBPMXh1WEc0Z0lDQWdMeThnVkdobElISmxjM1ZzZENCallXNGdZbVVnYm5Wc2JHbHphQ0JwWmlCaElHMXZZMnNnYjNJZ1lTQmpkWE4wYjIwZ1puVnVZM1JwYjI0Z2FYTWdkWE5sWkM1Y2JpQWdJQ0F2THlCVVQwUlBPaUJFY205d0lIUm9hWE1nZDJobGJpQjBhR1Z6WlNCaGNtVWdibThnYkc5dVoyVnlJR0ZzYkc5M1pXUWdZWE1nZEdobElIUjVjR1VnWVhKbmRXMWxiblF1WEc0Z0lDQWdhV1lnS0dWc1pXMWxiblFnUFQwZ2JuVnNiQ2tnZTF4dUlDQWdJQ0FnY21WMGRYSnVJR1ZzWlcxbGJuUTdYRzRnSUNBZ2ZWeHVYRzRnSUNBZ0x5OGdVMnRwY0NCclpYa2dkMkZ5Ym1sdVp5QnBaaUIwYUdVZ2RIbHdaU0JwYzI0bmRDQjJZV3hwWkNCemFXNWpaU0J2ZFhJZ2EyVjVJSFpoYkdsa1lYUnBiMjRnYkc5bmFXTmNiaUFnSUNBdkx5QmtiMlZ6YmlkMElHVjRjR1ZqZENCaElHNXZiaTF6ZEhKcGJtY3ZablZ1WTNScGIyNGdkSGx3WlNCaGJtUWdZMkZ1SUhSb2NtOTNJR052Ym1aMWMybHVaeUJsY25KdmNuTXVYRzRnSUNBZ0x5OGdWMlVnWkc5dUozUWdkMkZ1ZENCbGVHTmxjSFJwYjI0Z1ltVm9ZWFpwYjNJZ2RHOGdaR2xtWm1WeUlHSmxkSGRsWlc0Z1pHVjJJR0Z1WkNCd2NtOWtMbHh1SUNBZ0lDOHZJQ2hTWlc1a1pYSnBibWNnZDJsc2JDQjBhSEp2ZHlCM2FYUm9JR0VnYUdWc2NHWjFiQ0J0WlhOellXZGxJR0Z1WkNCaGN5QnpiMjl1SUdGeklIUm9aU0IwZVhCbElHbHpYRzRnSUNBZ0x5OGdabWw0WldRc0lIUm9aU0JyWlhrZ2QyRnlibWx1WjNNZ2QybHNiQ0JoY0hCbFlYSXVLVnh1SUNBZ0lHbG1JQ2gyWVd4cFpGUjVjR1VwSUh0Y2JpQWdJQ0FnSUdadmNpQW9kbUZ5SUdrZ1BTQXlPeUJwSUR3Z1lYSm5kVzFsYm5SekxteGxibWQwYURzZ2FTc3JLU0I3WEc0Z0lDQWdJQ0FnSUhaaGJHbGtZWFJsUTJocGJHUkxaWGx6S0dGeVozVnRaVzUwYzF0cFhTd2dkSGx3WlNrN1hHNGdJQ0FnSUNCOVhHNGdJQ0FnZlZ4dVhHNGdJQ0FnZG1Gc2FXUmhkR1ZRY205d1ZIbHdaWE1vWld4bGJXVnVkQ2s3WEc1Y2JpQWdJQ0J5WlhSMWNtNGdaV3hsYldWdWREdGNiaUFnZlN4Y2JseHVJQ0JqY21WaGRHVkdZV04wYjNKNU9pQm1kVzVqZEdsdmJpQW9kSGx3WlNrZ2UxeHVJQ0FnSUhaaGNpQjJZV3hwWkdGMFpXUkdZV04wYjNKNUlEMGdVbVZoWTNSRmJHVnRaVzUwVm1Gc2FXUmhkRzl5TG1OeVpXRjBaVVZzWlcxbGJuUXVZbWx1WkNodWRXeHNMQ0IwZVhCbEtUdGNiaUFnSUNBdkx5Qk1aV2RoWTNrZ2FHOXZheUJVVDBSUE9pQlhZWEp1SUdsbUlIUm9hWE1nYVhNZ1lXTmpaWE56WldSY2JpQWdJQ0IyWVd4cFpHRjBaV1JHWVdOMGIzSjVMblI1Y0dVZ1BTQjBlWEJsTzF4dVhHNGdJQ0FnYVdZZ0tIQnliMk5sYzNNdVpXNTJMazVQUkVWZlJVNVdJQ0U5UFNBbmNISnZaSFZqZEdsdmJpY3BJSHRjYmlBZ0lDQWdJR2xtSUNoallXNUVaV1pwYm1WUWNtOXdaWEowZVNrZ2UxeHVJQ0FnSUNBZ0lDQlBZbXBsWTNRdVpHVm1hVzVsVUhKdmNHVnlkSGtvZG1Gc2FXUmhkR1ZrUm1GamRHOXllU3dnSjNSNWNHVW5MQ0I3WEc0Z0lDQWdJQ0FnSUNBZ1pXNTFiV1Z5WVdKc1pUb2dabUZzYzJVc1hHNGdJQ0FnSUNBZ0lDQWdaMlYwT2lCbWRXNWpkR2x2YmlBb0tTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNCc2IzZFFjbWx2Y21sMGVWZGhjbTVwYm1jb1ptRnNjMlVzSUNkR1lXTjBiM0o1TG5SNWNHVWdhWE1nWkdWd2NtVmpZWFJsWkM0Z1FXTmpaWE56SUhSb1pTQmpiR0Z6Y3lCa2FYSmxZM1JzZVNBbklDc2dKMkpsWm05eVpTQndZWE56YVc1bklHbDBJSFJ2SUdOeVpXRjBaVVpoWTNSdmNua3VKeWs3WEc0Z0lDQWdJQ0FnSUNBZ0lDQlBZbXBsWTNRdVpHVm1hVzVsVUhKdmNHVnlkSGtvZEdocGN5d2dKM1I1Y0dVbkxDQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lIWmhiSFZsT2lCMGVYQmxYRzRnSUNBZ0lDQWdJQ0FnSUNCOUtUdGNiaUFnSUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUIwZVhCbE8xeHVJQ0FnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnZlNrN1hHNGdJQ0FnSUNCOVhHNGdJQ0FnZlZ4dVhHNGdJQ0FnY21WMGRYSnVJSFpoYkdsa1lYUmxaRVpoWTNSdmNuazdYRzRnSUgwc1hHNWNiaUFnWTJ4dmJtVkZiR1Z0Wlc1ME9pQm1kVzVqZEdsdmJpQW9aV3hsYldWdWRDd2djSEp2Y0hNc0lHTm9hV3hrY21WdUtTQjdYRzRnSUNBZ2RtRnlJRzVsZDBWc1pXMWxiblFnUFNCU1pXRmpkRVZzWlcxbGJuUXVZMnh2Ym1WRmJHVnRaVzUwTG1Gd2NHeDVLSFJvYVhNc0lHRnlaM1Z0Wlc1MGN5azdYRzRnSUNBZ1ptOXlJQ2gyWVhJZ2FTQTlJREk3SUdrZ1BDQmhjbWQxYldWdWRITXViR1Z1WjNSb095QnBLeXNwSUh0Y2JpQWdJQ0FnSUhaaGJHbGtZWFJsUTJocGJHUkxaWGx6S0dGeVozVnRaVzUwYzF0cFhTd2dibVYzUld4bGJXVnVkQzUwZVhCbEtUdGNiaUFnSUNCOVhHNGdJQ0FnZG1Gc2FXUmhkR1ZRY205d1ZIbHdaWE1vYm1WM1JXeGxiV1Z1ZENrN1hHNGdJQ0FnY21WMGRYSnVJRzVsZDBWc1pXMWxiblE3WEc0Z0lIMWNibjA3WEc1Y2JtMXZaSFZzWlM1bGVIQnZjblJ6SUQwZ1VtVmhZM1JGYkdWdFpXNTBWbUZzYVdSaGRHOXlPeUlzSWk4cUtseHVJQ29nUTI5d2VYSnBaMmgwSURJd01UVXRjSEpsYzJWdWRDd2dSbUZqWldKdmIyc3NJRWx1WXk1Y2JpQXFJRUZzYkNCeWFXZG9kSE1nY21WelpYSjJaV1F1WEc0Z0tseHVJQ29nVkdocGN5QnpiM1Z5WTJVZ1kyOWtaU0JwY3lCc2FXTmxibk5sWkNCMWJtUmxjaUIwYUdVZ1FsTkVMWE4wZVd4bElHeHBZMlZ1YzJVZ1ptOTFibVFnYVc0Z2RHaGxYRzRnS2lCTVNVTkZUbE5GSUdacGJHVWdhVzRnZEdobElISnZiM1FnWkdseVpXTjBiM0o1SUc5bUlIUm9hWE1nYzI5MWNtTmxJSFJ5WldVdUlFRnVJR0ZrWkdsMGFXOXVZV3dnWjNKaGJuUmNiaUFxSUc5bUlIQmhkR1Z1ZENCeWFXZG9kSE1nWTJGdUlHSmxJR1p2ZFc1a0lHbHVJSFJvWlNCUVFWUkZUbFJUSUdacGJHVWdhVzRnZEdobElITmhiV1VnWkdseVpXTjBiM0o1TGx4dUlDcGNiaUFxTDF4dVhHNG5kWE5sSUhOMGNtbGpkQ2M3WEc1Y2JuWmhjaUIzWVhKdWFXNW5JRDBnY21WeGRXbHlaU2duWm1KcWN5OXNhV0l2ZDJGeWJtbHVaeWNwTzF4dVhHNW1kVzVqZEdsdmJpQjNZWEp1VG05dmNDaHdkV0pzYVdOSmJuTjBZVzVqWlN3Z1kyRnNiR1Z5VG1GdFpTa2dlMXh1SUNCcFppQW9jSEp2WTJWemN5NWxibll1VGs5RVJWOUZUbFlnSVQwOUlDZHdjbTlrZFdOMGFXOXVKeWtnZTF4dUlDQWdJSFpoY2lCamIyNXpkSEoxWTNSdmNpQTlJSEIxWW14cFkwbHVjM1JoYm1ObExtTnZibk4wY25WamRHOXlPMXh1SUNBZ0lIQnliMk5sYzNNdVpXNTJMazVQUkVWZlJVNVdJQ0U5UFNBbmNISnZaSFZqZEdsdmJpY2dQeUIzWVhKdWFXNW5LR1poYkhObExDQW5KWE1vTGk0dUtUb2dRMkZ1SUc5dWJIa2dkWEJrWVhSbElHRWdiVzkxYm5SbFpDQnZjaUJ0YjNWdWRHbHVaeUJqYjIxd2IyNWxiblF1SUNjZ0t5QW5WR2hwY3lCMWMzVmhiR3g1SUcxbFlXNXpJSGx2ZFNCallXeHNaV1FnSlhNb0tTQnZiaUJoYmlCMWJtMXZkVzUwWldRZ1kyOXRjRzl1Wlc1MExpQW5JQ3NnSjFSb2FYTWdhWE1nWVNCdWJ5MXZjQzRnVUd4bFlYTmxJR05vWldOcklIUm9aU0JqYjJSbElHWnZjaUIwYUdVZ0pYTWdZMjl0Y0c5dVpXNTBMaWNzSUdOaGJHeGxjazVoYldVc0lHTmhiR3hsY2s1aGJXVXNJR052Ym5OMGNuVmpkRzl5SUNZbUlDaGpiMjV6ZEhKMVkzUnZjaTVrYVhOd2JHRjVUbUZ0WlNCOGZDQmpiMjV6ZEhKMVkzUnZjaTV1WVcxbEtTQjhmQ0FuVW1WaFkzUkRiR0Z6Y3ljcElEb2dkbTlwWkNBd08xeHVJQ0I5WEc1OVhHNWNiaThxS2x4dUlDb2dWR2hwY3lCcGN5QjBhR1VnWVdKemRISmhZM1FnUVZCSklHWnZjaUJoYmlCMWNHUmhkR1VnY1hWbGRXVXVYRzRnS2k5Y2JuWmhjaUJTWldGamRFNXZiM0JWY0dSaGRHVlJkV1YxWlNBOUlIdGNiaUFnTHlvcVhHNGdJQ0FxSUVOb1pXTnJjeUIzYUdWMGFHVnlJRzl5SUc1dmRDQjBhR2x6SUdOdmJYQnZjMmwwWlNCamIyMXdiMjVsYm5RZ2FYTWdiVzkxYm5SbFpDNWNiaUFnSUNvZ1FIQmhjbUZ0SUh0U1pXRmpkRU5zWVhOemZTQndkV0pzYVdOSmJuTjBZVzVqWlNCVWFHVWdhVzV6ZEdGdVkyVWdkMlVnZDJGdWRDQjBieUIwWlhOMExseHVJQ0FnS2lCQWNtVjBkWEp1SUh0aWIyOXNaV0Z1ZlNCVWNuVmxJR2xtSUcxdmRXNTBaV1FzSUdaaGJITmxJRzkwYUdWeWQybHpaUzVjYmlBZ0lDb2dRSEJ5YjNSbFkzUmxaRnh1SUNBZ0tpQkFabWx1WVd4Y2JpQWdJQ292WEc0Z0lHbHpUVzkxYm5SbFpEb2dablZ1WTNScGIyNGdLSEIxWW14cFkwbHVjM1JoYm1ObEtTQjdYRzRnSUNBZ2NtVjBkWEp1SUdaaGJITmxPMXh1SUNCOUxGeHVYRzRnSUM4cUtseHVJQ0FnS2lCRmJuRjFaWFZsSUdFZ1kyRnNiR0poWTJzZ2RHaGhkQ0IzYVd4c0lHSmxJR1Y0WldOMWRHVmtJR0ZtZEdWeUlHRnNiQ0IwYUdVZ2NHVnVaR2x1WnlCMWNHUmhkR1Z6WEc0Z0lDQXFJR2hoZG1VZ2NISnZZMlZ6YzJWa0xseHVJQ0FnS2x4dUlDQWdLaUJBY0dGeVlXMGdlMUpsWVdOMFEyeGhjM045SUhCMVlteHBZMGx1YzNSaGJtTmxJRlJvWlNCcGJuTjBZVzVqWlNCMGJ5QjFjMlVnWVhNZ1lIUm9hWE5nSUdOdmJuUmxlSFF1WEc0Z0lDQXFJRUJ3WVhKaGJTQjdQMloxYm1OMGFXOXVmU0JqWVd4c1ltRmpheUJEWVd4c1pXUWdZV1owWlhJZ2MzUmhkR1VnYVhNZ2RYQmtZWFJsWkM1Y2JpQWdJQ29nUUdsdWRHVnlibUZzWEc0Z0lDQXFMMXh1SUNCbGJuRjFaWFZsUTJGc2JHSmhZMnM2SUdaMWJtTjBhVzl1SUNod2RXSnNhV05KYm5OMFlXNWpaU3dnWTJGc2JHSmhZMnNwSUh0OUxGeHVYRzRnSUM4cUtseHVJQ0FnS2lCR2IzSmpaWE1nWVc0Z2RYQmtZWFJsTGlCVWFHbHpJSE5vYjNWc1pDQnZibXg1SUdKbElHbHVkbTlyWldRZ2QyaGxiaUJwZENCcGN5QnJibTkzYmlCM2FYUm9YRzRnSUNBcUlHTmxjblJoYVc1MGVTQjBhR0YwSUhkbElHRnlaU0FxS201dmRDb3FJR2x1SUdFZ1JFOU5JSFJ5WVc1ellXTjBhVzl1TGx4dUlDQWdLbHh1SUNBZ0tpQlpiM1VnYldGNUlIZGhiblFnZEc4Z1kyRnNiQ0IwYUdseklIZG9aVzRnZVc5MUlHdHViM2NnZEdoaGRDQnpiMjFsSUdSbFpYQmxjaUJoYzNCbFkzUWdiMllnZEdobFhHNGdJQ0FxSUdOdmJYQnZibVZ1ZENkeklITjBZWFJsSUdoaGN5QmphR0Z1WjJWa0lHSjFkQ0JnYzJWMFUzUmhkR1ZnSUhkaGN5QnViM1FnWTJGc2JHVmtMbHh1SUNBZ0tseHVJQ0FnS2lCVWFHbHpJSGRwYkd3Z2JtOTBJR2x1ZG05clpTQmdjMmh2ZFd4a1EyOXRjRzl1Wlc1MFZYQmtZWFJsWUN3Z1luVjBJR2wwSUhkcGJHd2dhVzUyYjJ0bFhHNGdJQ0FxSUdCamIyMXdiMjVsYm5SWGFXeHNWWEJrWVhSbFlDQmhibVFnWUdOdmJYQnZibVZ1ZEVScFpGVndaR0YwWldBdVhHNGdJQ0FxWEc0Z0lDQXFJRUJ3WVhKaGJTQjdVbVZoWTNSRGJHRnpjMzBnY0hWaWJHbGpTVzV6ZEdGdVkyVWdWR2hsSUdsdWMzUmhibU5sSUhSb1lYUWdjMmh2ZFd4a0lISmxjbVZ1WkdWeUxseHVJQ0FnS2lCQWFXNTBaWEp1WVd4Y2JpQWdJQ292WEc0Z0lHVnVjWFZsZFdWR2IzSmpaVlZ3WkdGMFpUb2dablZ1WTNScGIyNGdLSEIxWW14cFkwbHVjM1JoYm1ObEtTQjdYRzRnSUNBZ2QyRnliazV2YjNBb2NIVmliR2xqU1c1emRHRnVZMlVzSUNkbWIzSmpaVlZ3WkdGMFpTY3BPMXh1SUNCOUxGeHVYRzRnSUM4cUtseHVJQ0FnS2lCU1pYQnNZV05sY3lCaGJHd2diMllnZEdobElITjBZWFJsTGlCQmJIZGhlWE1nZFhObElIUm9hWE1nYjNJZ1lITmxkRk4wWVhSbFlDQjBieUJ0ZFhSaGRHVWdjM1JoZEdVdVhHNGdJQ0FxSUZsdmRTQnphRzkxYkdRZ2RISmxZWFFnWUhSb2FYTXVjM1JoZEdWZ0lHRnpJR2x0YlhWMFlXSnNaUzVjYmlBZ0lDcGNiaUFnSUNvZ1ZHaGxjbVVnYVhNZ2JtOGdaM1ZoY21GdWRHVmxJSFJvWVhRZ1lIUm9hWE11YzNSaGRHVmdJSGRwYkd3Z1ltVWdhVzF0WldScFlYUmxiSGtnZFhCa1lYUmxaQ3dnYzI5Y2JpQWdJQ29nWVdOalpYTnphVzVuSUdCMGFHbHpMbk4wWVhSbFlDQmhablJsY2lCallXeHNhVzVuSUhSb2FYTWdiV1YwYUc5a0lHMWhlU0J5WlhSMWNtNGdkR2hsSUc5c1pDQjJZV3gxWlM1Y2JpQWdJQ3BjYmlBZ0lDb2dRSEJoY21GdElIdFNaV0ZqZEVOc1lYTnpmU0J3ZFdKc2FXTkpibk4wWVc1alpTQlVhR1VnYVc1emRHRnVZMlVnZEdoaGRDQnphRzkxYkdRZ2NtVnlaVzVrWlhJdVhHNGdJQ0FxSUVCd1lYSmhiU0I3YjJKcVpXTjBmU0JqYjIxd2JHVjBaVk4wWVhSbElFNWxlSFFnYzNSaGRHVXVYRzRnSUNBcUlFQnBiblJsY201aGJGeHVJQ0FnS2k5Y2JpQWdaVzV4ZFdWMVpWSmxjR3hoWTJWVGRHRjBaVG9nWm5WdVkzUnBiMjRnS0hCMVlteHBZMGx1YzNSaGJtTmxMQ0JqYjIxd2JHVjBaVk4wWVhSbEtTQjdYRzRnSUNBZ2QyRnliazV2YjNBb2NIVmliR2xqU1c1emRHRnVZMlVzSUNkeVpYQnNZV05sVTNSaGRHVW5LVHRjYmlBZ2ZTeGNibHh1SUNBdktpcGNiaUFnSUNvZ1UyVjBjeUJoSUhOMVluTmxkQ0J2WmlCMGFHVWdjM1JoZEdVdUlGUm9hWE1nYjI1c2VTQmxlR2x6ZEhNZ1ltVmpZWFZ6WlNCZmNHVnVaR2x1WjFOMFlYUmxJR2x6WEc0Z0lDQXFJR2x1ZEdWeWJtRnNMaUJVYUdseklIQnliM1pwWkdWeklHRWdiV1Z5WjJsdVp5QnpkSEpoZEdWbmVTQjBhR0YwSUdseklHNXZkQ0JoZG1GcGJHRmliR1VnZEc4Z1pHVmxjRnh1SUNBZ0tpQndjbTl3WlhKMGFXVnpJSGRvYVdOb0lHbHpJR052Ym1aMWMybHVaeTRnVkU5RVR6b2dSWGh3YjNObElIQmxibVJwYm1kVGRHRjBaU0J2Y2lCa2IyNG5kQ0IxYzJVZ2FYUmNiaUFnSUNvZ1pIVnlhVzVuSUhSb1pTQnRaWEpuWlM1Y2JpQWdJQ3BjYmlBZ0lDb2dRSEJoY21GdElIdFNaV0ZqZEVOc1lYTnpmU0J3ZFdKc2FXTkpibk4wWVc1alpTQlVhR1VnYVc1emRHRnVZMlVnZEdoaGRDQnphRzkxYkdRZ2NtVnlaVzVrWlhJdVhHNGdJQ0FxSUVCd1lYSmhiU0I3YjJKcVpXTjBmU0J3WVhKMGFXRnNVM1JoZEdVZ1RtVjRkQ0J3WVhKMGFXRnNJSE4wWVhSbElIUnZJR0psSUcxbGNtZGxaQ0IzYVhSb0lITjBZWFJsTGx4dUlDQWdLaUJBYVc1MFpYSnVZV3hjYmlBZ0lDb3ZYRzRnSUdWdWNYVmxkV1ZUWlhSVGRHRjBaVG9nWm5WdVkzUnBiMjRnS0hCMVlteHBZMGx1YzNSaGJtTmxMQ0J3WVhKMGFXRnNVM1JoZEdVcElIdGNiaUFnSUNCM1lYSnVUbTl2Y0Nod2RXSnNhV05KYm5OMFlXNWpaU3dnSjNObGRGTjBZWFJsSnlrN1hHNGdJSDFjYm4wN1hHNWNibTF2WkhWc1pTNWxlSEJ2Y25SeklEMGdVbVZoWTNST2IyOXdWWEJrWVhSbFVYVmxkV1U3SWl3aUx5b3FYRzRnS2lCRGIzQjVjbWxuYUhRZ01qQXhNeTF3Y21WelpXNTBMQ0JHWVdObFltOXZheXdnU1c1akxseHVJQ29nUVd4c0lISnBaMmgwY3lCeVpYTmxjblpsWkM1Y2JpQXFYRzRnS2lCVWFHbHpJSE52ZFhKalpTQmpiMlJsSUdseklHeHBZMlZ1YzJWa0lIVnVaR1Z5SUhSb1pTQkNVMFF0YzNSNWJHVWdiR2xqWlc1elpTQm1iM1Z1WkNCcGJpQjBhR1ZjYmlBcUlFeEpRMFZPVTBVZ1ptbHNaU0JwYmlCMGFHVWdjbTl2ZENCa2FYSmxZM1J2Y25rZ2IyWWdkR2hwY3lCemIzVnlZMlVnZEhKbFpTNGdRVzRnWVdSa2FYUnBiMjVoYkNCbmNtRnVkRnh1SUNvZ2IyWWdjR0YwWlc1MElISnBaMmgwY3lCallXNGdZbVVnWm05MWJtUWdhVzRnZEdobElGQkJWRVZPVkZNZ1ptbHNaU0JwYmlCMGFHVWdjMkZ0WlNCa2FYSmxZM1J2Y25rdVhHNGdLbHh1SUNvZ1hHNGdLaTljYmx4dUozVnpaU0J6ZEhKcFkzUW5PMXh1WEc1MllYSWdVbVZoWTNSUWNtOXdWSGx3WlV4dlkyRjBhVzl1VG1GdFpYTWdQU0I3ZlR0Y2JseHVhV1lnS0hCeWIyTmxjM011Wlc1MkxrNVBSRVZmUlU1V0lDRTlQU0FuY0hKdlpIVmpkR2x2YmljcElIdGNiaUFnVW1WaFkzUlFjbTl3Vkhsd1pVeHZZMkYwYVc5dVRtRnRaWE1nUFNCN1hHNGdJQ0FnY0hKdmNEb2dKM0J5YjNBbkxGeHVJQ0FnSUdOdmJuUmxlSFE2SUNkamIyNTBaWGgwSnl4Y2JpQWdJQ0JqYUdsc1pFTnZiblJsZUhRNklDZGphR2xzWkNCamIyNTBaWGgwSjF4dUlDQjlPMXh1ZlZ4dVhHNXRiMlIxYkdVdVpYaHdiM0owY3lBOUlGSmxZV04wVUhKdmNGUjVjR1ZNYjJOaGRHbHZiazVoYldWek95SXNJaThxS2x4dUlDb2dRMjl3ZVhKcFoyaDBJREl3TVRNdGNISmxjMlZ1ZEN3Z1JtRmpaV0p2YjJzc0lFbHVZeTVjYmlBcUlFRnNiQ0J5YVdkb2RITWdjbVZ6WlhKMlpXUXVYRzRnS2x4dUlDb2dWR2hwY3lCemIzVnlZMlVnWTI5a1pTQnBjeUJzYVdObGJuTmxaQ0IxYm1SbGNpQjBhR1VnUWxORUxYTjBlV3hsSUd4cFkyVnVjMlVnWm05MWJtUWdhVzRnZEdobFhHNGdLaUJNU1VORlRsTkZJR1pwYkdVZ2FXNGdkR2hsSUhKdmIzUWdaR2x5WldOMGIzSjVJRzltSUhSb2FYTWdjMjkxY21ObElIUnlaV1V1SUVGdUlHRmtaR2wwYVc5dVlXd2daM0poYm5SY2JpQXFJRzltSUhCaGRHVnVkQ0J5YVdkb2RITWdZMkZ1SUdKbElHWnZkVzVrSUdsdUlIUm9aU0JRUVZSRlRsUlRJR1pwYkdVZ2FXNGdkR2hsSUhOaGJXVWdaR2x5WldOMGIzSjVMbHh1SUNwY2JpQXFMMXh1WEc0bmRYTmxJSE4wY21samRDYzdYRzVjYm5aaGNpQmZjbVZ4ZFdseVpTQTlJSEpsY1hWcGNtVW9KeTR2VW1WaFkzUkZiR1Z0Wlc1MEp5a3NYRzRnSUNBZ2FYTldZV3hwWkVWc1pXMWxiblFnUFNCZmNtVnhkV2x5WlM1cGMxWmhiR2xrUld4bGJXVnVkRHRjYmx4dWRtRnlJR1poWTNSdmNua2dQU0J5WlhGMWFYSmxLQ2R3Y205d0xYUjVjR1Z6TDJaaFkzUnZjbmtuS1R0Y2JseHViVzlrZFd4bExtVjRjRzl5ZEhNZ1BTQm1ZV04wYjNKNUtHbHpWbUZzYVdSRmJHVnRaVzUwS1RzaUxDSXZLaXBjYmlBcUlFTnZjSGx5YVdkb2RDQXlNREV6TFhCeVpYTmxiblFzSUVaaFkyVmliMjlyTENCSmJtTXVYRzRnS2lCQmJHd2djbWxuYUhSeklISmxjMlZ5ZG1Wa0xseHVJQ3BjYmlBcUlGUm9hWE1nYzI5MWNtTmxJR052WkdVZ2FYTWdiR2xqWlc1elpXUWdkVzVrWlhJZ2RHaGxJRUpUUkMxemRIbHNaU0JzYVdObGJuTmxJR1p2ZFc1a0lHbHVJSFJvWlZ4dUlDb2dURWxEUlU1VFJTQm1hV3hsSUdsdUlIUm9aU0J5YjI5MElHUnBjbVZqZEc5eWVTQnZaaUIwYUdseklITnZkWEpqWlNCMGNtVmxMaUJCYmlCaFpHUnBkR2x2Ym1Gc0lHZHlZVzUwWEc0Z0tpQnZaaUJ3WVhSbGJuUWdjbWxuYUhSeklHTmhiaUJpWlNCbWIzVnVaQ0JwYmlCMGFHVWdVRUZVUlU1VVV5Qm1hV3hsSUdsdUlIUm9aU0J6WVcxbElHUnBjbVZqZEc5eWVTNWNiaUFxWEc0Z0tpQmNiaUFxTDF4dVhHNG5kWE5sSUhOMGNtbGpkQ2M3WEc1Y2JuWmhjaUJTWldGamRGQnliM0JVZVhCbGMxTmxZM0psZENBOUlDZFRSVU5TUlZSZlJFOWZUazlVWDFCQlUxTmZWRWhKVTE5UFVsOVpUMVZmVjBsTVRGOUNSVjlHU1ZKRlJDYzdYRzVjYm0xdlpIVnNaUzVsZUhCdmNuUnpJRDBnVW1WaFkzUlFjbTl3Vkhsd1pYTlRaV055WlhRN0lpd2lMeW9xWEc0Z0tpQkRiM0I1Y21sbmFIUWdNakF4TXkxd2NtVnpaVzUwTENCR1lXTmxZbTl2YXl3Z1NXNWpMbHh1SUNvZ1FXeHNJSEpwWjJoMGN5QnlaWE5sY25abFpDNWNiaUFxWEc0Z0tpQlVhR2x6SUhOdmRYSmpaU0JqYjJSbElHbHpJR3hwWTJWdWMyVmtJSFZ1WkdWeUlIUm9aU0JDVTBRdGMzUjViR1VnYkdsalpXNXpaU0JtYjNWdVpDQnBiaUIwYUdWY2JpQXFJRXhKUTBWT1UwVWdabWxzWlNCcGJpQjBhR1VnY205dmRDQmthWEpsWTNSdmNua2diMllnZEdocGN5QnpiM1Z5WTJVZ2RISmxaUzRnUVc0Z1lXUmthWFJwYjI1aGJDQm5jbUZ1ZEZ4dUlDb2diMllnY0dGMFpXNTBJSEpwWjJoMGN5QmpZVzRnWW1VZ1ptOTFibVFnYVc0Z2RHaGxJRkJCVkVWT1ZGTWdabWxzWlNCcGJpQjBhR1VnYzJGdFpTQmthWEpsWTNSdmNua3VYRzRnS2x4dUlDb3ZYRzVjYmlkMWMyVWdjM1J5YVdOMEp6dGNibHh1Ylc5a2RXeGxMbVY0Y0c5eWRITWdQU0FuTVRVdU5pNHhKenNpTENJdktpcGNiaUFxSUVOdmNIbHlhV2RvZENBeU1ERXpMWEJ5WlhObGJuUXNJRVpoWTJWaWIyOXJMQ0JKYm1NdVhHNGdLaUJCYkd3Z2NtbG5hSFJ6SUhKbGMyVnlkbVZrTGx4dUlDcGNiaUFxSUZSb2FYTWdjMjkxY21ObElHTnZaR1VnYVhNZ2JHbGpaVzV6WldRZ2RXNWtaWElnZEdobElFSlRSQzF6ZEhsc1pTQnNhV05sYm5ObElHWnZkVzVrSUdsdUlIUm9aVnh1SUNvZ1RFbERSVTVUUlNCbWFXeGxJR2x1SUhSb1pTQnliMjkwSUdScGNtVmpkRzl5ZVNCdlppQjBhR2x6SUhOdmRYSmpaU0IwY21WbExpQkJiaUJoWkdScGRHbHZibUZzSUdkeVlXNTBYRzRnS2lCdlppQndZWFJsYm5RZ2NtbG5hSFJ6SUdOaGJpQmlaU0JtYjNWdVpDQnBiaUIwYUdVZ1VFRlVSVTVVVXlCbWFXeGxJR2x1SUhSb1pTQnpZVzFsSUdScGNtVmpkRzl5ZVM1Y2JpQXFYRzRnS2lCY2JpQXFMMXh1WEc0bmRYTmxJSE4wY21samRDYzdYRzVjYm5aaGNpQmpZVzVFWldacGJtVlFjbTl3WlhKMGVTQTlJR1poYkhObE8xeHVhV1lnS0hCeWIyTmxjM011Wlc1MkxrNVBSRVZmUlU1V0lDRTlQU0FuY0hKdlpIVmpkR2x2YmljcElIdGNiaUFnZEhKNUlIdGNiaUFnSUNBdkx5QWtSbXh2ZDBacGVFMWxJR2gwZEhCek9pOHZaMmwwYUhWaUxtTnZiUzltWVdObFltOXZheTltYkc5M0wybHpjM1ZsY3k4eU9EVmNiaUFnSUNCUFltcGxZM1F1WkdWbWFXNWxVSEp2Y0dWeWRIa29lMzBzSUNkNEp5d2dleUJuWlhRNklHWjFibU4wYVc5dUlDZ3BJSHQ5SUgwcE8xeHVJQ0FnSUdOaGJrUmxabWx1WlZCeWIzQmxjblI1SUQwZ2RISjFaVHRjYmlBZ2ZTQmpZWFJqYUNBb2VDa2dlMXh1SUNBZ0lDOHZJRWxGSUhkcGJHd2dabUZwYkNCdmJpQmtaV1pwYm1WUWNtOXdaWEowZVZ4dUlDQjlYRzU5WEc1Y2JtMXZaSFZzWlM1bGVIQnZjblJ6SUQwZ1kyRnVSR1ZtYVc1bFVISnZjR1Z5ZEhrN0lpd2lMeW9xWEc0Z0tpQkRiM0I1Y21sbmFIUWdNakF4TXkxd2NtVnpaVzUwTENCR1lXTmxZbTl2YXl3Z1NXNWpMbHh1SUNvZ1FXeHNJSEpwWjJoMGN5QnlaWE5sY25abFpDNWNiaUFxWEc0Z0tpQlVhR2x6SUhOdmRYSmpaU0JqYjJSbElHbHpJR3hwWTJWdWMyVmtJSFZ1WkdWeUlIUm9aU0JDVTBRdGMzUjViR1VnYkdsalpXNXpaU0JtYjNWdVpDQnBiaUIwYUdWY2JpQXFJRXhKUTBWT1UwVWdabWxzWlNCcGJpQjBhR1VnY205dmRDQmthWEpsWTNSdmNua2diMllnZEdocGN5QnpiM1Z5WTJVZ2RISmxaUzRnUVc0Z1lXUmthWFJwYjI1aGJDQm5jbUZ1ZEZ4dUlDb2diMllnY0dGMFpXNTBJSEpwWjJoMGN5QmpZVzRnWW1VZ1ptOTFibVFnYVc0Z2RHaGxJRkJCVkVWT1ZGTWdabWxzWlNCcGJpQjBhR1VnYzJGdFpTQmthWEpsWTNSdmNua3VYRzRnS2x4dUlDb3ZYRzVjYmlkMWMyVWdjM1J5YVdOMEp6dGNibHh1ZG1GeUlGOXdjbTlrU1c1MllYSnBZVzUwSUQwZ2NtVnhkV2x5WlNnbkxpOXlaV0ZqZEZCeWIyUkpiblpoY21saGJuUW5LVHRjYmx4dWRtRnlJRkpsWVdOMFVISnZjRlI1Y0dWTWIyTmhkR2x2Yms1aGJXVnpJRDBnY21WeGRXbHlaU2duTGk5U1pXRmpkRkJ5YjNCVWVYQmxURzlqWVhScGIyNU9ZVzFsY3ljcE8xeHVkbUZ5SUZKbFlXTjBVSEp2Y0ZSNWNHVnpVMlZqY21WMElEMGdjbVZ4ZFdseVpTZ25MaTlTWldGamRGQnliM0JVZVhCbGMxTmxZM0psZENjcE8xeHVYRzUyWVhJZ2FXNTJZWEpwWVc1MElEMGdjbVZ4ZFdseVpTZ25abUpxY3k5c2FXSXZhVzUyWVhKcFlXNTBKeWs3WEc1MllYSWdkMkZ5Ym1sdVp5QTlJSEpsY1hWcGNtVW9KMlppYW5NdmJHbGlMM2RoY201cGJtY25LVHRjYmx4dWRtRnlJRkpsWVdOMFEyOXRjRzl1Wlc1MFZISmxaVWh2YjJzN1hHNWNibWxtSUNoMGVYQmxiMllnY0hKdlkyVnpjeUFoUFQwZ0ozVnVaR1ZtYVc1bFpDY2dKaVlnY0hKdlkyVnpjeTVsYm5ZZ0ppWWdjSEp2WTJWemN5NWxibll1VGs5RVJWOUZUbFlnUFQwOUlDZDBaWE4wSnlrZ2UxeHVJQ0F2THlCVVpXMXdiM0poY25rZ2FHRmpheTVjYmlBZ0x5OGdTVzVzYVc1bElISmxjWFZwY21WeklHUnZiaWQwSUhkdmNtc2dkMlZzYkNCM2FYUm9JRXBsYzNRNlhHNGdJQzh2SUdoMGRIQnpPaTh2WjJsMGFIVmlMbU52YlM5bVlXTmxZbTl2YXk5eVpXRmpkQzlwYzNOMVpYTXZOekkwTUZ4dUlDQXZMeUJTWlcxdmRtVWdkR2hsSUdsdWJHbHVaU0J5WlhGMWFYSmxjeUIzYUdWdUlIZGxJR1J2YmlkMElHNWxaV1FnZEdobGJTQmhibmx0YjNKbE9seHVJQ0F2THlCb2RIUndjem92TDJkcGRHaDFZaTVqYjIwdlptRmpaV0p2YjJzdmNtVmhZM1F2Y0hWc2JDODNNVGM0WEc0Z0lGSmxZV04wUTI5dGNHOXVaVzUwVkhKbFpVaHZiMnNnUFNCeVpYRjFhWEpsS0NjdUwxSmxZV04wUTI5dGNHOXVaVzUwVkhKbFpVaHZiMnNuS1R0Y2JuMWNibHh1ZG1GeUlHeHZaMmRsWkZSNWNHVkdZV2xzZFhKbGN5QTlJSHQ5TzF4dVhHNHZLaXBjYmlBcUlFRnpjMlZ5ZENCMGFHRjBJSFJvWlNCMllXeDFaWE1nYldGMFkyZ2dkMmwwYUNCMGFHVWdkSGx3WlNCemNHVmpjeTVjYmlBcUlFVnljbTl5SUcxbGMzTmhaMlZ6SUdGeVpTQnRaVzF2Y21sNlpXUWdZVzVrSUhkcGJHd2diMjVzZVNCaVpTQnphRzkzYmlCdmJtTmxMbHh1SUNwY2JpQXFJRUJ3WVhKaGJTQjdiMkpxWldOMGZTQjBlWEJsVTNCbFkzTWdUV0Z3SUc5bUlHNWhiV1VnZEc4Z1lTQlNaV0ZqZEZCeWIzQlVlWEJsWEc0Z0tpQkFjR0Z5WVcwZ2UyOWlhbVZqZEgwZ2RtRnNkV1Z6SUZKMWJuUnBiV1VnZG1Gc2RXVnpJSFJvWVhRZ2JtVmxaQ0IwYnlCaVpTQjBlWEJsTFdOb1pXTnJaV1JjYmlBcUlFQndZWEpoYlNCN2MzUnlhVzVuZlNCc2IyTmhkR2x2YmlCbExtY3VJRndpY0hKdmNGd2lMQ0JjSW1OdmJuUmxlSFJjSWl3Z1hDSmphR2xzWkNCamIyNTBaWGgwWENKY2JpQXFJRUJ3WVhKaGJTQjdjM1J5YVc1bmZTQmpiMjF3YjI1bGJuUk9ZVzFsSUU1aGJXVWdiMllnZEdobElHTnZiWEJ2Ym1WdWRDQm1iM0lnWlhKeWIzSWdiV1Z6YzJGblpYTXVYRzRnS2lCQWNHRnlZVzBnZXo5dlltcGxZM1I5SUdWc1pXMWxiblFnVkdobElGSmxZV04wSUdWc1pXMWxiblFnZEdoaGRDQnBjeUJpWldsdVp5QjBlWEJsTFdOb1pXTnJaV1JjYmlBcUlFQndZWEpoYlNCN1AyNTFiV0psY24wZ1pHVmlkV2RKUkNCVWFHVWdVbVZoWTNRZ1kyOXRjRzl1Wlc1MElHbHVjM1JoYm1ObElIUm9ZWFFnYVhNZ1ltVnBibWNnZEhsd1pTMWphR1ZqYTJWa1hHNGdLaUJBY0hKcGRtRjBaVnh1SUNvdlhHNW1kVzVqZEdsdmJpQmphR1ZqYTFKbFlXTjBWSGx3WlZOd1pXTW9kSGx3WlZOd1pXTnpMQ0IyWVd4MVpYTXNJR3h2WTJGMGFXOXVMQ0JqYjIxd2IyNWxiblJPWVcxbExDQmxiR1Z0Wlc1MExDQmtaV0oxWjBsRUtTQjdYRzRnSUdadmNpQW9kbUZ5SUhSNWNHVlRjR1ZqVG1GdFpTQnBiaUIwZVhCbFUzQmxZM01wSUh0Y2JpQWdJQ0JwWmlBb2RIbHdaVk53WldOekxtaGhjMDkzYmxCeWIzQmxjblI1S0hSNWNHVlRjR1ZqVG1GdFpTa3BJSHRjYmlBZ0lDQWdJSFpoY2lCbGNuSnZjanRjYmlBZ0lDQWdJQzh2SUZCeWIzQWdkSGx3WlNCMllXeHBaR0YwYVc5dUlHMWhlU0IwYUhKdmR5NGdTVzRnWTJGelpTQjBhR1Y1SUdSdkxDQjNaU0JrYjI0bmRDQjNZVzUwSUhSdlhHNGdJQ0FnSUNBdkx5Qm1ZV2xzSUhSb1pTQnlaVzVrWlhJZ2NHaGhjMlVnZDJobGNtVWdhWFFnWkdsa2JpZDBJR1poYVd3Z1ltVm1iM0psTGlCVGJ5QjNaU0JzYjJjZ2FYUXVYRzRnSUNBZ0lDQXZMeUJCWm5SbGNpQjBhR1Z6WlNCb1lYWmxJR0psWlc0Z1kyeGxZVzVsWkNCMWNDd2dkMlVuYkd3Z2JHVjBJSFJvWlcwZ2RHaHliM2N1WEc0Z0lDQWdJQ0IwY25rZ2UxeHVJQ0FnSUNBZ0lDQXZMeUJVYUdseklHbHpJR2x1ZEdWdWRHbHZibUZzYkhrZ1lXNGdhVzUyWVhKcFlXNTBJSFJvWVhRZ1oyVjBjeUJqWVhWbmFIUXVJRWwwSjNNZ2RHaGxJSE5oYldWY2JpQWdJQ0FnSUNBZ0x5OGdZbVZvWVhacGIzSWdZWE1nZDJsMGFHOTFkQ0IwYUdseklITjBZWFJsYldWdWRDQmxlR05sY0hRZ2QybDBhQ0JoSUdKbGRIUmxjaUJ0WlhOellXZGxMbHh1SUNBZ0lDQWdJQ0FoS0hSNWNHVnZaaUIwZVhCbFUzQmxZM05iZEhsd1pWTndaV05PWVcxbFhTQTlQVDBnSjJaMWJtTjBhVzl1SnlrZ1B5QndjbTlqWlhOekxtVnVkaTVPVDBSRlgwVk9WaUFoUFQwZ0ozQnliMlIxWTNScGIyNG5JRDhnYVc1MllYSnBZVzUwS0daaGJITmxMQ0FuSlhNNklDVnpJSFI1Y0dVZ1lDVnpZQ0JwY3lCcGJuWmhiR2xrT3lCcGRDQnRkWE4wSUdKbElHRWdablZ1WTNScGIyNHNJSFZ6ZFdGc2JIa2dabkp2YlNCU1pXRmpkQzVRY205d1ZIbHdaWE11Snl3Z1kyOXRjRzl1Wlc1MFRtRnRaU0I4ZkNBblVtVmhZM1FnWTJ4aGMzTW5MQ0JTWldGamRGQnliM0JVZVhCbFRHOWpZWFJwYjI1T1lXMWxjMXRzYjJOaGRHbHZibDBzSUhSNWNHVlRjR1ZqVG1GdFpTa2dPaUJmY0hKdlpFbHVkbUZ5YVdGdWRDZ25PRFFuTENCamIyMXdiMjVsYm5ST1lXMWxJSHg4SUNkU1pXRmpkQ0JqYkdGemN5Y3NJRkpsWVdOMFVISnZjRlI1Y0dWTWIyTmhkR2x2Yms1aGJXVnpXMnh2WTJGMGFXOXVYU3dnZEhsd1pWTndaV05PWVcxbEtTQTZJSFp2YVdRZ01EdGNiaUFnSUNBZ0lDQWdaWEp5YjNJZ1BTQjBlWEJsVTNCbFkzTmJkSGx3WlZOd1pXTk9ZVzFsWFNoMllXeDFaWE1zSUhSNWNHVlRjR1ZqVG1GdFpTd2dZMjl0Y0c5dVpXNTBUbUZ0WlN3Z2JHOWpZWFJwYjI0c0lHNTFiR3dzSUZKbFlXTjBVSEp2Y0ZSNWNHVnpVMlZqY21WMEtUdGNiaUFnSUNBZ0lIMGdZMkYwWTJnZ0tHVjRLU0I3WEc0Z0lDQWdJQ0FnSUdWeWNtOXlJRDBnWlhnN1hHNGdJQ0FnSUNCOVhHNGdJQ0FnSUNCd2NtOWpaWE56TG1WdWRpNU9UMFJGWDBWT1ZpQWhQVDBnSjNCeWIyUjFZM1JwYjI0bklEOGdkMkZ5Ym1sdVp5Z2haWEp5YjNJZ2ZId2daWEp5YjNJZ2FXNXpkR0Z1WTJWdlppQkZjbkp2Y2l3Z0p5VnpPaUIwZVhCbElITndaV05wWm1sallYUnBiMjRnYjJZZ0pYTWdZQ1Z6WUNCcGN5QnBiblpoYkdsa095QjBhR1VnZEhsd1pTQmphR1ZqYTJWeUlDY2dLeUFuWm5WdVkzUnBiMjRnYlhWemRDQnlaWFIxY200Z1lHNTFiR3hnSUc5eUlHRnVJR0JGY25KdmNtQWdZblYwSUhKbGRIVnlibVZrSUdFZ0pYTXVJQ2NnS3lBbldXOTFJRzFoZVNCb1lYWmxJR1p2Y21kdmRIUmxiaUIwYnlCd1lYTnpJR0Z1SUdGeVozVnRaVzUwSUhSdklIUm9aU0IwZVhCbElHTm9aV05yWlhJZ0p5QXJJQ2RqY21WaGRHOXlJQ2hoY25KaGVVOW1MQ0JwYm5OMFlXNWpaVTltTENCdlltcGxZM1JQWml3Z2IyNWxUMllzSUc5dVpVOW1WSGx3WlN3Z1lXNWtJQ2NnS3lBbmMyaGhjR1VnWVd4c0lISmxjWFZwY21VZ1lXNGdZWEpuZFcxbGJuUXBMaWNzSUdOdmJYQnZibVZ1ZEU1aGJXVWdmSHdnSjFKbFlXTjBJR05zWVhOekp5d2dVbVZoWTNSUWNtOXdWSGx3WlV4dlkyRjBhVzl1VG1GdFpYTmJiRzlqWVhScGIyNWRMQ0IwZVhCbFUzQmxZMDVoYldVc0lIUjVjR1Z2WmlCbGNuSnZjaWtnT2lCMmIybGtJREE3WEc0Z0lDQWdJQ0JwWmlBb1pYSnliM0lnYVc1emRHRnVZMlZ2WmlCRmNuSnZjaUFtSmlBaEtHVnljbTl5TG0xbGMzTmhaMlVnYVc0Z2JHOW5aMlZrVkhsd1pVWmhhV3gxY21WektTa2dlMXh1SUNBZ0lDQWdJQ0F2THlCUGJteDVJRzF2Ym1sMGIzSWdkR2hwY3lCbVlXbHNkWEpsSUc5dVkyVWdZbVZqWVhWelpTQjBhR1Z5WlNCMFpXNWtjeUIwYnlCaVpTQmhJR3h2ZENCdlppQjBhR1ZjYmlBZ0lDQWdJQ0FnTHk4Z2MyRnRaU0JsY25KdmNpNWNiaUFnSUNBZ0lDQWdiRzluWjJWa1ZIbHdaVVpoYVd4MWNtVnpXMlZ5Y205eUxtMWxjM05oWjJWZElEMGdkSEoxWlR0Y2JseHVJQ0FnSUNBZ0lDQjJZWElnWTI5dGNHOXVaVzUwVTNSaFkydEpibVp2SUQwZ0p5YzdYRzVjYmlBZ0lDQWdJQ0FnYVdZZ0tIQnliMk5sYzNNdVpXNTJMazVQUkVWZlJVNVdJQ0U5UFNBbmNISnZaSFZqZEdsdmJpY3BJSHRjYmlBZ0lDQWdJQ0FnSUNCcFppQW9JVkpsWVdOMFEyOXRjRzl1Wlc1MFZISmxaVWh2YjJzcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUZKbFlXTjBRMjl0Y0c5dVpXNTBWSEpsWlVodmIyc2dQU0J5WlhGMWFYSmxLQ2N1TDFKbFlXTjBRMjl0Y0c5dVpXNTBWSEpsWlVodmIyc25LVHRjYmlBZ0lDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lDQWdhV1lnS0dSbFluVm5TVVFnSVQwOUlHNTFiR3dwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJR052YlhCdmJtVnVkRk4wWVdOclNXNW1ieUE5SUZKbFlXTjBRMjl0Y0c5dVpXNTBWSEpsWlVodmIyc3VaMlYwVTNSaFkydEJaR1JsYm1SMWJVSjVTVVFvWkdWaWRXZEpSQ2s3WEc0Z0lDQWdJQ0FnSUNBZ2ZTQmxiSE5sSUdsbUlDaGxiR1Z0Wlc1MElDRTlQU0J1ZFd4c0tTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNCamIyMXdiMjVsYm5SVGRHRmphMGx1Wm04Z1BTQlNaV0ZqZEVOdmJYQnZibVZ1ZEZSeVpXVkliMjlyTG1kbGRFTjFjbkpsYm5SVGRHRmphMEZrWkdWdVpIVnRLR1ZzWlcxbGJuUXBPMXh1SUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ2ZWeHVYRzRnSUNBZ0lDQWdJSEJ5YjJObGMzTXVaVzUyTGs1UFJFVmZSVTVXSUNFOVBTQW5jSEp2WkhWamRHbHZiaWNnUHlCM1lYSnVhVzVuS0daaGJITmxMQ0FuUm1GcGJHVmtJQ1Z6SUhSNWNHVTZJQ1Z6SlhNbkxDQnNiMk5oZEdsdmJpd2daWEp5YjNJdWJXVnpjMkZuWlN3Z1kyOXRjRzl1Wlc1MFUzUmhZMnRKYm1adktTQTZJSFp2YVdRZ01EdGNiaUFnSUNBZ0lIMWNiaUFnSUNCOVhHNGdJSDFjYm4xY2JseHViVzlrZFd4bExtVjRjRzl5ZEhNZ1BTQmphR1ZqYTFKbFlXTjBWSGx3WlZOd1pXTTdJaXdpTHlvcVhHNGdLaUJEYjNCNWNtbG5hSFFnTWpBeE15MXdjbVZ6Wlc1MExDQkdZV05sWW05dmF5d2dTVzVqTGx4dUlDb2dRV3hzSUhKcFoyaDBjeUJ5WlhObGNuWmxaQzVjYmlBcVhHNGdLaUJVYUdseklITnZkWEpqWlNCamIyUmxJR2x6SUd4cFkyVnVjMlZrSUhWdVpHVnlJSFJvWlNCQ1UwUXRjM1I1YkdVZ2JHbGpaVzV6WlNCbWIzVnVaQ0JwYmlCMGFHVmNiaUFxSUV4SlEwVk9VMFVnWm1sc1pTQnBiaUIwYUdVZ2NtOXZkQ0JrYVhKbFkzUnZjbmtnYjJZZ2RHaHBjeUJ6YjNWeVkyVWdkSEpsWlM0Z1FXNGdZV1JrYVhScGIyNWhiQ0JuY21GdWRGeHVJQ29nYjJZZ2NHRjBaVzUwSUhKcFoyaDBjeUJqWVc0Z1ltVWdabTkxYm1RZ2FXNGdkR2hsSUZCQlZFVk9WRk1nWm1sc1pTQnBiaUIwYUdVZ2MyRnRaU0JrYVhKbFkzUnZjbmt1WEc0Z0tseHVJQ292WEc1Y2JpZDFjMlVnYzNSeWFXTjBKenRjYmx4dWRtRnlJRjl5WlhGMWFYSmxJRDBnY21WeGRXbHlaU2duTGk5U1pXRmpkRUpoYzJWRGJHRnpjMlZ6Snlrc1hHNGdJQ0FnUTI5dGNHOXVaVzUwSUQwZ1gzSmxjWFZwY21VdVEyOXRjRzl1Wlc1ME8xeHVYRzUyWVhJZ1gzSmxjWFZwY21VeUlEMGdjbVZ4ZFdseVpTZ25MaTlTWldGamRFVnNaVzFsYm5RbktTeGNiaUFnSUNCcGMxWmhiR2xrUld4bGJXVnVkQ0E5SUY5eVpYRjFhWEpsTWk1cGMxWmhiR2xrUld4bGJXVnVkRHRjYmx4dWRtRnlJRkpsWVdOMFRtOXZjRlZ3WkdGMFpWRjFaWFZsSUQwZ2NtVnhkV2x5WlNnbkxpOVNaV0ZqZEU1dmIzQlZjR1JoZEdWUmRXVjFaU2NwTzF4dWRtRnlJR1poWTNSdmNua2dQU0J5WlhGMWFYSmxLQ2RqY21WaGRHVXRjbVZoWTNRdFkyeGhjM012Wm1GamRHOXllU2NwTzF4dVhHNXRiMlIxYkdVdVpYaHdiM0owY3lBOUlHWmhZM1J2Y25rb1EyOXRjRzl1Wlc1MExDQnBjMVpoYkdsa1JXeGxiV1Z1ZEN3Z1VtVmhZM1JPYjI5d1ZYQmtZWFJsVVhWbGRXVXBPeUlzSWk4cUtseHVJQ29nUTI5d2VYSnBaMmgwSURJd01UTXRjSEpsYzJWdWRDd2dSbUZqWldKdmIyc3NJRWx1WXk1Y2JpQXFJRUZzYkNCeWFXZG9kSE1nY21WelpYSjJaV1F1WEc0Z0tseHVJQ29nVkdocGN5QnpiM1Z5WTJVZ1kyOWtaU0JwY3lCc2FXTmxibk5sWkNCMWJtUmxjaUIwYUdVZ1FsTkVMWE4wZVd4bElHeHBZMlZ1YzJVZ1ptOTFibVFnYVc0Z2RHaGxYRzRnS2lCTVNVTkZUbE5GSUdacGJHVWdhVzRnZEdobElISnZiM1FnWkdseVpXTjBiM0o1SUc5bUlIUm9hWE1nYzI5MWNtTmxJSFJ5WldVdUlFRnVJR0ZrWkdsMGFXOXVZV3dnWjNKaGJuUmNiaUFxSUc5bUlIQmhkR1Z1ZENCeWFXZG9kSE1nWTJGdUlHSmxJR1p2ZFc1a0lHbHVJSFJvWlNCUVFWUkZUbFJUSUdacGJHVWdhVzRnZEdobElITmhiV1VnWkdseVpXTjBiM0o1TGx4dUlDcGNiaUFxSUZ4dUlDb3ZYRzVjYmlkMWMyVWdjM1J5YVdOMEp6dGNibHh1THlvZ1oyeHZZbUZzSUZONWJXSnZiQ0FxTDF4dVhHNTJZWElnU1ZSRlVrRlVUMUpmVTFsTlFrOU1JRDBnZEhsd1pXOW1JRk41YldKdmJDQTlQVDBnSjJaMWJtTjBhVzl1SnlBbUppQlRlVzFpYjJ3dWFYUmxjbUYwYjNJN1hHNTJZWElnUmtGVldGOUpWRVZTUVZSUFVsOVRXVTFDVDB3Z1BTQW5RRUJwZEdWeVlYUnZjaWM3SUM4dklFSmxabTl5WlNCVGVXMWliMndnYzNCbFl5NWNibHh1THlvcVhHNGdLaUJTWlhSMWNtNXpJSFJvWlNCcGRHVnlZWFJ2Y2lCdFpYUm9iMlFnWm5WdVkzUnBiMjRnWTI5dWRHRnBibVZrSUc5dUlIUm9aU0JwZEdWeVlXSnNaU0J2WW1wbFkzUXVYRzRnS2x4dUlDb2dRbVVnYzNWeVpTQjBieUJwYm5admEyVWdkR2hsSUdaMWJtTjBhVzl1SUhkcGRHZ2dkR2hsSUdsMFpYSmhZbXhsSUdGeklHTnZiblJsZUhRNlhHNGdLbHh1SUNvZ0lDQWdJSFpoY2lCcGRHVnlZWFJ2Y2tadUlEMGdaMlYwU1hSbGNtRjBiM0pHYmlodGVVbDBaWEpoWW14bEtUdGNiaUFxSUNBZ0lDQnBaaUFvYVhSbGNtRjBiM0pHYmlrZ2UxeHVJQ29nSUNBZ0lDQWdkbUZ5SUdsMFpYSmhkRzl5SUQwZ2FYUmxjbUYwYjNKR2JpNWpZV3hzS0cxNVNYUmxjbUZpYkdVcE8xeHVJQ29nSUNBZ0lDQWdMaTR1WEc0Z0tpQWdJQ0FnZlZ4dUlDcGNiaUFxSUVCd1lYSmhiU0I3UDI5aWFtVmpkSDBnYldGNVltVkpkR1Z5WVdKc1pWeHVJQ29nUUhKbGRIVnliaUI3UDJaMWJtTjBhVzl1ZlZ4dUlDb3ZYRzVtZFc1amRHbHZiaUJuWlhSSmRHVnlZWFJ2Y2tadUtHMWhlV0psU1hSbGNtRmliR1VwSUh0Y2JpQWdkbUZ5SUdsMFpYSmhkRzl5Um00Z1BTQnRZWGxpWlVsMFpYSmhZbXhsSUNZbUlDaEpWRVZTUVZSUFVsOVRXVTFDVDB3Z0ppWWdiV0Y1WW1WSmRHVnlZV0pzWlZ0SlZFVlNRVlJQVWw5VFdVMUNUMHhkSUh4OElHMWhlV0psU1hSbGNtRmliR1ZiUmtGVldGOUpWRVZTUVZSUFVsOVRXVTFDVDB4ZEtUdGNiaUFnYVdZZ0tIUjVjR1Z2WmlCcGRHVnlZWFJ2Y2tadUlEMDlQU0FuWm5WdVkzUnBiMjRuS1NCN1hHNGdJQ0FnY21WMGRYSnVJR2wwWlhKaGRHOXlSbTQ3WEc0Z0lIMWNibjFjYmx4dWJXOWtkV3hsTG1WNGNHOXlkSE1nUFNCblpYUkpkR1Z5WVhSdmNrWnVPeUlzSWk4cUtseHVJQ29nUTI5d2VYSnBaMmgwSURJd01UUXRNakF4TlN3Z1JtRmpaV0p2YjJzc0lFbHVZeTVjYmlBcUlFRnNiQ0J5YVdkb2RITWdjbVZ6WlhKMlpXUXVYRzRnS2x4dUlDb2dWR2hwY3lCemIzVnlZMlVnWTI5a1pTQnBjeUJzYVdObGJuTmxaQ0IxYm1SbGNpQjBhR1VnUWxORUxYTjBlV3hsSUd4cFkyVnVjMlVnWm05MWJtUWdhVzRnZEdobFhHNGdLaUJNU1VORlRsTkZJR1pwYkdVZ2FXNGdkR2hsSUhKdmIzUWdaR2x5WldOMGIzSjVJRzltSUhSb2FYTWdjMjkxY21ObElIUnlaV1V1SUVGdUlHRmtaR2wwYVc5dVlXd2daM0poYm5SY2JpQXFJRzltSUhCaGRHVnVkQ0J5YVdkb2RITWdZMkZ1SUdKbElHWnZkVzVrSUdsdUlIUm9aU0JRUVZSRlRsUlRJR1pwYkdVZ2FXNGdkR2hsSUhOaGJXVWdaR2x5WldOMGIzSjVMbHh1SUNwY2JpQXFMMXh1WEc0bmRYTmxJSE4wY21samRDYzdYRzVjYmk4cUtseHVJQ29nUm05eWEyVmtJR1p5YjIwZ1ptSnFjeTkzWVhKdWFXNW5PbHh1SUNvZ2FIUjBjSE02THk5bmFYUm9kV0l1WTI5dEwyWmhZMlZpYjI5ckwyWmlhbk12WW14dllpOWxOalppWVRJd1lXUTFZbVUwTXpObFlqVTBOREl6WmpKaU1EazNaRGd5T1RNeU5HUTVaR1UyTDNCaFkydGhaMlZ6TDJaaWFuTXZjM0pqTDE5ZlptOXlhM05mWHk5M1lYSnVhVzVuTG1welhHNGdLbHh1SUNvZ1QyNXNlU0JqYUdGdVoyVWdhWE1nZDJVZ2RYTmxJR052Ym5OdmJHVXVkMkZ5YmlCcGJuTjBaV0ZrSUc5bUlHTnZibk52YkdVdVpYSnliM0lzWEc0Z0tpQmhibVFnWkc4Z2JtOTBhR2x1WnlCM2FHVnVJQ2RqYjI1emIyeGxKeUJwY3lCdWIzUWdjM1Z3Y0c5eWRHVmtMbHh1SUNvZ1ZHaHBjeUJ5WldGc2JIa2djMmx0Y0d4cFptbGxjeUIwYUdVZ1kyOWtaUzVjYmlBcUlDMHRMVnh1SUNvZ1UybHRhV3hoY2lCMGJ5QnBiblpoY21saGJuUWdZblYwSUc5dWJIa2diRzluY3lCaElIZGhjbTVwYm1jZ2FXWWdkR2hsSUdOdmJtUnBkR2x2YmlCcGN5QnViM1FnYldWMExseHVJQ29nVkdocGN5QmpZVzRnWW1VZ2RYTmxaQ0IwYnlCc2IyY2dhWE56ZFdWeklHbHVJR1JsZG1Wc2IzQnRaVzUwSUdWdWRtbHliMjV0Wlc1MGN5QnBiaUJqY21sMGFXTmhiRnh1SUNvZ2NHRjBhSE11SUZKbGJXOTJhVzVuSUhSb1pTQnNiMmRuYVc1bklHTnZaR1VnWm05eUlIQnliMlIxWTNScGIyNGdaVzUyYVhKdmJtMWxiblJ6SUhkcGJHd2dhMlZsY0NCMGFHVmNiaUFxSUhOaGJXVWdiRzluYVdNZ1lXNWtJR1p2Ykd4dmR5QjBhR1VnYzJGdFpTQmpiMlJsSUhCaGRHaHpMbHh1SUNvdlhHNWNiblpoY2lCc2IzZFFjbWx2Y21sMGVWZGhjbTVwYm1jZ1BTQm1kVzVqZEdsdmJpQW9LU0I3ZlR0Y2JseHVhV1lnS0hCeWIyTmxjM011Wlc1MkxrNVBSRVZmUlU1V0lDRTlQU0FuY0hKdlpIVmpkR2x2YmljcElIdGNiaUFnZG1GeUlIQnlhVzUwVjJGeWJtbHVaeUE5SUdaMWJtTjBhVzl1SUNobWIzSnRZWFFwSUh0Y2JpQWdJQ0JtYjNJZ0tIWmhjaUJmYkdWdUlEMGdZWEpuZFcxbGJuUnpMbXhsYm1kMGFDd2dZWEpuY3lBOUlFRnljbUY1S0Y5c1pXNGdQaUF4SUQ4Z1gyeGxiaUF0SURFZ09pQXdLU3dnWDJ0bGVTQTlJREU3SUY5clpYa2dQQ0JmYkdWdU95QmZhMlY1S3lzcElIdGNiaUFnSUNBZ0lHRnlaM05iWDJ0bGVTQXRJREZkSUQwZ1lYSm5kVzFsYm5SelcxOXJaWGxkTzF4dUlDQWdJSDFjYmx4dUlDQWdJSFpoY2lCaGNtZEpibVJsZUNBOUlEQTdYRzRnSUNBZ2RtRnlJRzFsYzNOaFoyVWdQU0FuVjJGeWJtbHVaem9nSnlBcklHWnZjbTFoZEM1eVpYQnNZV05sS0M4bGN5OW5MQ0JtZFc1amRHbHZiaUFvS1NCN1hHNGdJQ0FnSUNCeVpYUjFjbTRnWVhKbmMxdGhjbWRKYm1SbGVDc3JYVHRjYmlBZ0lDQjlLVHRjYmlBZ0lDQnBaaUFvZEhsd1pXOW1JR052Ym5OdmJHVWdJVDA5SUNkMWJtUmxabWx1WldRbktTQjdYRzRnSUNBZ0lDQmpiMjV6YjJ4bExuZGhjbTRvYldWemMyRm5aU2s3WEc0Z0lDQWdmVnh1SUNBZ0lIUnllU0I3WEc0Z0lDQWdJQ0F2THlBdExTMGdWMlZzWTI5dFpTQjBieUJrWldKMVoyZHBibWNnVW1WaFkzUWdMUzB0WEc0Z0lDQWdJQ0F2THlCVWFHbHpJR1Z5Y205eUlIZGhjeUIwYUhKdmQyNGdZWE1nWVNCamIyNTJaVzVwWlc1alpTQnpieUIwYUdGMElIbHZkU0JqWVc0Z2RYTmxJSFJvYVhNZ2MzUmhZMnRjYmlBZ0lDQWdJQzh2SUhSdklHWnBibVFnZEdobElHTmhiR3h6YVhSbElIUm9ZWFFnWTJGMWMyVmtJSFJvYVhNZ2QyRnlibWx1WnlCMGJ5Qm1hWEpsTGx4dUlDQWdJQ0FnZEdoeWIzY2dibVYzSUVWeWNtOXlLRzFsYzNOaFoyVXBPMXh1SUNBZ0lIMGdZMkYwWTJnZ0tIZ3BJSHQ5WEc0Z0lIMDdYRzVjYmlBZ2JHOTNVSEpwYjNKcGRIbFhZWEp1YVc1bklEMGdablZ1WTNScGIyNGdLR052Ym1ScGRHbHZiaXdnWm05eWJXRjBLU0I3WEc0Z0lDQWdhV1lnS0dadmNtMWhkQ0E5UFQwZ2RXNWtaV1pwYm1Wa0tTQjdYRzRnSUNBZ0lDQjBhSEp2ZHlCdVpYY2dSWEp5YjNJb0oyQjNZWEp1YVc1bktHTnZibVJwZEdsdmJpd2dabTl5YldGMExDQXVMaTVoY21kektXQWdjbVZ4ZFdseVpYTWdZU0IzWVhKdWFXNW5JQ2NnS3lBbmJXVnpjMkZuWlNCaGNtZDFiV1Z1ZENjcE8xeHVJQ0FnSUgxY2JpQWdJQ0JwWmlBb0lXTnZibVJwZEdsdmJpa2dlMXh1SUNBZ0lDQWdabTl5SUNoMllYSWdYMnhsYmpJZ1BTQmhjbWQxYldWdWRITXViR1Z1WjNSb0xDQmhjbWR6SUQwZ1FYSnlZWGtvWDJ4bGJqSWdQaUF5SUQ4Z1gyeGxiaklnTFNBeUlEb2dNQ2tzSUY5clpYa3lJRDBnTWpzZ1gydGxlVElnUENCZmJHVnVNanNnWDJ0bGVUSXJLeWtnZTF4dUlDQWdJQ0FnSUNCaGNtZHpXMTlyWlhreUlDMGdNbDBnUFNCaGNtZDFiV1Z1ZEhOYlgydGxlVEpkTzF4dUlDQWdJQ0FnZlZ4dVhHNGdJQ0FnSUNCd2NtbHVkRmRoY201cGJtY3VZWEJ3Ykhrb2RXNWtaV1pwYm1Wa0xDQmJabTl5YldGMFhTNWpiMjVqWVhRb1lYSm5jeWtwTzF4dUlDQWdJSDFjYmlBZ2ZUdGNibjFjYmx4dWJXOWtkV3hsTG1WNGNHOXlkSE1nUFNCc2IzZFFjbWx2Y21sMGVWZGhjbTVwYm1jN0lpd2lMeW9xWEc0Z0tpQkRiM0I1Y21sbmFIUWdNakF4TXkxd2NtVnpaVzUwTENCR1lXTmxZbTl2YXl3Z1NXNWpMbHh1SUNvZ1FXeHNJSEpwWjJoMGN5QnlaWE5sY25abFpDNWNiaUFxWEc0Z0tpQlVhR2x6SUhOdmRYSmpaU0JqYjJSbElHbHpJR3hwWTJWdWMyVmtJSFZ1WkdWeUlIUm9aU0JDVTBRdGMzUjViR1VnYkdsalpXNXpaU0JtYjNWdVpDQnBiaUIwYUdWY2JpQXFJRXhKUTBWT1UwVWdabWxzWlNCcGJpQjBhR1VnY205dmRDQmthWEpsWTNSdmNua2diMllnZEdocGN5QnpiM1Z5WTJVZ2RISmxaUzRnUVc0Z1lXUmthWFJwYjI1aGJDQm5jbUZ1ZEZ4dUlDb2diMllnY0dGMFpXNTBJSEpwWjJoMGN5QmpZVzRnWW1VZ1ptOTFibVFnYVc0Z2RHaGxJRkJCVkVWT1ZGTWdabWxzWlNCcGJpQjBhR1VnYzJGdFpTQmthWEpsWTNSdmNua3VYRzRnS2x4dUlDb3ZYRzRuZFhObElITjBjbWxqZENjN1hHNWNiblpoY2lCZmNISnZaRWx1ZG1GeWFXRnVkQ0E5SUhKbGNYVnBjbVVvSnk0dmNtVmhZM1JRY205a1NXNTJZWEpwWVc1MEp5azdYRzVjYm5aaGNpQlNaV0ZqZEVWc1pXMWxiblFnUFNCeVpYRjFhWEpsS0NjdUwxSmxZV04wUld4bGJXVnVkQ2NwTzF4dVhHNTJZWElnYVc1MllYSnBZVzUwSUQwZ2NtVnhkV2x5WlNnblptSnFjeTlzYVdJdmFXNTJZWEpwWVc1MEp5azdYRzVjYmk4cUtseHVJQ29nVW1WMGRYSnVjeUIwYUdVZ1ptbHljM1FnWTJocGJHUWdhVzRnWVNCamIyeHNaV04wYVc5dUlHOW1JR05vYVd4a2NtVnVJR0Z1WkNCMlpYSnBabWxsY3lCMGFHRjBJSFJvWlhKbFhHNGdLaUJwY3lCdmJteDVJRzl1WlNCamFHbHNaQ0JwYmlCMGFHVWdZMjlzYkdWamRHbHZiaTVjYmlBcVhHNGdLaUJUWldVZ2FIUjBjSE02THk5bVlXTmxZbTl2YXk1bmFYUm9kV0l1YVc4dmNtVmhZM1F2Wkc5amN5OTBiM0F0YkdWMlpXd3RZWEJwTG1oMGJXd2pjbVZoWTNRdVkyaHBiR1J5Wlc0dWIyNXNlVnh1SUNwY2JpQXFJRlJvWlNCamRYSnlaVzUwSUdsdGNHeGxiV1Z1ZEdGMGFXOXVJRzltSUhSb2FYTWdablZ1WTNScGIyNGdZWE56ZFcxbGN5QjBhR0YwSUdFZ2MybHVaMnhsSUdOb2FXeGtJR2RsZEhOY2JpQXFJSEJoYzNObFpDQjNhWFJvYjNWMElHRWdkM0poY0hCbGNpd2dZblYwSUhSb1pTQndkWEp3YjNObElHOW1JSFJvYVhNZ2FHVnNjR1Z5SUdaMWJtTjBhVzl1SUdseklIUnZYRzRnS2lCaFluTjBjbUZqZENCaGQyRjVJSFJvWlNCd1lYSjBhV04xYkdGeUlITjBjblZqZEhWeVpTQnZaaUJqYUdsc1pISmxiaTVjYmlBcVhHNGdLaUJBY0dGeVlXMGdlejl2WW1wbFkzUjlJR05vYVd4a2NtVnVJRU5vYVd4a0lHTnZiR3hsWTNScGIyNGdjM1J5ZFdOMGRYSmxMbHh1SUNvZ1FISmxkSFZ5YmlCN1VtVmhZM1JGYkdWdFpXNTBmU0JVYUdVZ1ptbHljM1FnWVc1a0lHOXViSGtnWUZKbFlXTjBSV3hsYldWdWRHQWdZMjl1ZEdGcGJtVmtJR2x1SUhSb1pWeHVJQ29nYzNSeWRXTjBkWEpsTGx4dUlDb3ZYRzVtZFc1amRHbHZiaUJ2Ym14NVEyaHBiR1FvWTJocGJHUnlaVzRwSUh0Y2JpQWdJVkpsWVdOMFJXeGxiV1Z1ZEM1cGMxWmhiR2xrUld4bGJXVnVkQ2hqYUdsc1pISmxiaWtnUHlCd2NtOWpaWE56TG1WdWRpNU9UMFJGWDBWT1ZpQWhQVDBnSjNCeWIyUjFZM1JwYjI0bklEOGdhVzUyWVhKcFlXNTBLR1poYkhObExDQW5VbVZoWTNRdVEyaHBiR1J5Wlc0dWIyNXNlU0JsZUhCbFkzUmxaQ0IwYnlCeVpXTmxhWFpsSUdFZ2MybHVaMnhsSUZKbFlXTjBJR1ZzWlcxbGJuUWdZMmhwYkdRdUp5a2dPaUJmY0hKdlpFbHVkbUZ5YVdGdWRDZ25NVFF6SnlrZ09pQjJiMmxrSURBN1hHNGdJSEpsZEhWeWJpQmphR2xzWkhKbGJqdGNibjFjYmx4dWJXOWtkV3hsTG1WNGNHOXlkSE1nUFNCdmJteDVRMmhwYkdRN0lpd2lMeW9xWEc0Z0tpQkRiM0I1Y21sbmFIUWdLR01wSURJd01UTXRjSEpsYzJWdWRDd2dSbUZqWldKdmIyc3NJRWx1WXk1Y2JpQXFJRUZzYkNCeWFXZG9kSE1nY21WelpYSjJaV1F1WEc0Z0tseHVJQ29nVkdocGN5QnpiM1Z5WTJVZ1kyOWtaU0JwY3lCc2FXTmxibk5sWkNCMWJtUmxjaUIwYUdVZ1FsTkVMWE4wZVd4bElHeHBZMlZ1YzJVZ1ptOTFibVFnYVc0Z2RHaGxYRzRnS2lCTVNVTkZUbE5GSUdacGJHVWdhVzRnZEdobElISnZiM1FnWkdseVpXTjBiM0o1SUc5bUlIUm9hWE1nYzI5MWNtTmxJSFJ5WldVdUlFRnVJR0ZrWkdsMGFXOXVZV3dnWjNKaGJuUmNiaUFxSUc5bUlIQmhkR1Z1ZENCeWFXZG9kSE1nWTJGdUlHSmxJR1p2ZFc1a0lHbHVJSFJvWlNCUVFWUkZUbFJUSUdacGJHVWdhVzRnZEdobElITmhiV1VnWkdseVpXTjBiM0o1TGx4dUlDcGNiaUFxSUZ4dUlDb3ZYRzRuZFhObElITjBjbWxqZENjN1hHNWNiaThxS2x4dUlDb2dWMEZTVGtsT1J6b2dSRThnVGs5VUlHMWhiblZoYkd4NUlISmxjWFZwY21VZ2RHaHBjeUJ0YjJSMWJHVXVYRzRnS2lCVWFHbHpJR2x6SUdFZ2NtVndiR0ZqWlcxbGJuUWdabTl5SUdCcGJuWmhjbWxoYm5Rb0xpNHVLV0FnZFhObFpDQmllU0IwYUdVZ1pYSnliM0lnWTI5a1pTQnplWE4wWlcxY2JpQXFJR0Z1WkNCM2FXeHNJRjl2Ym14NVh5QmlaU0J5WlhGMWFYSmxaQ0JpZVNCMGFHVWdZMjl5Y21WemNHOXVaR2x1WnlCaVlXSmxiQ0J3WVhOekxseHVJQ29nU1hRZ1lXeDNZWGx6SUhSb2NtOTNjeTVjYmlBcUwxeHVYRzVtZFc1amRHbHZiaUJ5WldGamRGQnliMlJKYm5aaGNtbGhiblFvWTI5a1pTa2dlMXh1SUNCMllYSWdZWEpuUTI5MWJuUWdQU0JoY21kMWJXVnVkSE11YkdWdVozUm9JQzBnTVR0Y2JseHVJQ0IyWVhJZ2JXVnpjMkZuWlNBOUlDZE5hVzVwWm1sbFpDQlNaV0ZqZENCbGNuSnZjaUFqSnlBcklHTnZaR1VnS3lBbk95QjJhWE5wZENBbklDc2dKMmgwZEhBNkx5OW1ZV05sWW05dmF5NW5hWFJvZFdJdWFXOHZjbVZoWTNRdlpHOWpjeTlsY25KdmNpMWtaV052WkdWeUxtaDBiV3cvYVc1MllYSnBZVzUwUFNjZ0t5QmpiMlJsTzF4dVhHNGdJR1p2Y2lBb2RtRnlJR0Z5WjBsa2VDQTlJREE3SUdGeVowbGtlQ0E4SUdGeVowTnZkVzUwT3lCaGNtZEpaSGdyS3lrZ2UxeHVJQ0FnSUcxbGMzTmhaMlVnS3owZ0p5WmhjbWR6VzEwOUp5QXJJR1Z1WTI5a1pWVlNTVU52YlhCdmJtVnVkQ2hoY21kMWJXVnVkSE5iWVhKblNXUjRJQ3NnTVYwcE8xeHVJQ0I5WEc1Y2JpQWdiV1Z6YzJGblpTQXJQU0FuSUdadmNpQjBhR1VnWm5Wc2JDQnRaWE56WVdkbElHOXlJSFZ6WlNCMGFHVWdibTl1TFcxcGJtbG1hV1ZrSUdSbGRpQmxiblpwY205dWJXVnVkQ2NnS3lBbklHWnZjaUJtZFd4c0lHVnljbTl5Y3lCaGJtUWdZV1JrYVhScGIyNWhiQ0JvWld4d1puVnNJSGRoY201cGJtZHpMaWM3WEc1Y2JpQWdkbUZ5SUdWeWNtOXlJRDBnYm1WM0lFVnljbTl5S0cxbGMzTmhaMlVwTzF4dUlDQmxjbkp2Y2k1dVlXMWxJRDBnSjBsdWRtRnlhV0Z1ZENCV2FXOXNZWFJwYjI0bk8xeHVJQ0JsY25KdmNpNW1jbUZ0WlhOVWIxQnZjQ0E5SURFN0lDOHZJSGRsSUdSdmJpZDBJR05oY21VZ1lXSnZkWFFnY21WaFkzUlFjbTlrU1c1MllYSnBZVzUwSjNNZ2IzZHVJR1p5WVcxbFhHNWNiaUFnZEdoeWIzY2daWEp5YjNJN1hHNTlYRzVjYm0xdlpIVnNaUzVsZUhCdmNuUnpJRDBnY21WaFkzUlFjbTlrU1c1MllYSnBZVzUwT3lJc0lpOHFLbHh1SUNvZ1EyOXdlWEpwWjJoMElESXdNVE10Y0hKbGMyVnVkQ3dnUm1GalpXSnZiMnNzSUVsdVl5NWNiaUFxSUVGc2JDQnlhV2RvZEhNZ2NtVnpaWEoyWldRdVhHNGdLbHh1SUNvZ1ZHaHBjeUJ6YjNWeVkyVWdZMjlrWlNCcGN5QnNhV05sYm5ObFpDQjFibVJsY2lCMGFHVWdRbE5FTFhOMGVXeGxJR3hwWTJWdWMyVWdabTkxYm1RZ2FXNGdkR2hsWEc0Z0tpQk1TVU5GVGxORklHWnBiR1VnYVc0Z2RHaGxJSEp2YjNRZ1pHbHlaV04wYjNKNUlHOW1JSFJvYVhNZ2MyOTFjbU5sSUhSeVpXVXVJRUZ1SUdGa1pHbDBhVzl1WVd3Z1ozSmhiblJjYmlBcUlHOW1JSEJoZEdWdWRDQnlhV2RvZEhNZ1kyRnVJR0psSUdadmRXNWtJR2x1SUhSb1pTQlFRVlJGVGxSVElHWnBiR1VnYVc0Z2RHaGxJSE5oYldVZ1pHbHlaV04wYjNKNUxseHVJQ3BjYmlBcUwxeHVYRzRuZFhObElITjBjbWxqZENjN1hHNWNiblpoY2lCZmNISnZaRWx1ZG1GeWFXRnVkQ0E5SUhKbGNYVnBjbVVvSnk0dmNtVmhZM1JRY205a1NXNTJZWEpwWVc1MEp5azdYRzVjYm5aaGNpQlNaV0ZqZEVOMWNuSmxiblJQZDI1bGNpQTlJSEpsY1hWcGNtVW9KeTR2VW1WaFkzUkRkWEp5Wlc1MFQzZHVaWEluS1R0Y2JuWmhjaUJTUlVGRFZGOUZURVZOUlU1VVgxUlpVRVVnUFNCeVpYRjFhWEpsS0NjdUwxSmxZV04wUld4bGJXVnVkRk41YldKdmJDY3BPMXh1WEc1MllYSWdaMlYwU1hSbGNtRjBiM0pHYmlBOUlISmxjWFZwY21Vb0p5NHZaMlYwU1hSbGNtRjBiM0pHYmljcE8xeHVkbUZ5SUdsdWRtRnlhV0Z1ZENBOUlISmxjWFZwY21Vb0oyWmlhbk12YkdsaUwybHVkbUZ5YVdGdWRDY3BPMXh1ZG1GeUlFdGxlVVZ6WTJGd1pWVjBhV3h6SUQwZ2NtVnhkV2x5WlNnbkxpOUxaWGxGYzJOaGNHVlZkR2xzY3ljcE8xeHVkbUZ5SUhkaGNtNXBibWNnUFNCeVpYRjFhWEpsS0NkbVltcHpMMnhwWWk5M1lYSnVhVzVuSnlrN1hHNWNiblpoY2lCVFJWQkJVa0ZVVDFJZ1BTQW5MaWM3WEc1MllYSWdVMVZDVTBWUVFWSkJWRTlTSUQwZ0p6b25PMXh1WEc0dktpcGNiaUFxSUZSb2FYTWdhWE1nYVc1c2FXNWxaQ0JtY205dElGSmxZV04wUld4bGJXVnVkQ0J6YVc1alpTQjBhR2x6SUdacGJHVWdhWE1nYzJoaGNtVmtJR0psZEhkbFpXNWNiaUFxSUdsemIyMXZjbkJvYVdNZ1lXNWtJSEpsYm1SbGNtVnljeTRnVjJVZ1kyOTFiR1FnWlhoMGNtRmpkQ0IwYUdseklIUnZJR0ZjYmlBcVhHNGdLaTljYmx4dUx5b3FYRzRnS2lCVVQwUlBPaUJVWlhOMElIUm9ZWFFnWVNCemFXNW5iR1VnWTJocGJHUWdZVzVrSUdGdUlHRnljbUY1SUhkcGRHZ2diMjVsSUdsMFpXMGdhR0YyWlNCMGFHVWdjMkZ0WlNCclpYbGNiaUFxSUhCaGRIUmxjbTR1WEc0Z0tpOWNibHh1ZG1GeUlHUnBaRmRoY201QlltOTFkRTFoY0hNZ1BTQm1ZV3h6WlR0Y2JseHVMeW9xWEc0Z0tpQkhaVzVsY21GMFpTQmhJR3RsZVNCemRISnBibWNnZEdoaGRDQnBaR1Z1ZEdsbWFXVnpJR0VnWTI5dGNHOXVaVzUwSUhkcGRHaHBiaUJoSUhObGRDNWNiaUFxWEc0Z0tpQkFjR0Z5WVcwZ2V5cDlJR052YlhCdmJtVnVkQ0JCSUdOdmJYQnZibVZ1ZENCMGFHRjBJR052ZFd4a0lHTnZiblJoYVc0Z1lTQnRZVzUxWVd3Z2EyVjVMbHh1SUNvZ1FIQmhjbUZ0SUh0dWRXMWlaWEo5SUdsdVpHVjRJRWx1WkdWNElIUm9ZWFFnYVhNZ2RYTmxaQ0JwWmlCaElHMWhiblZoYkNCclpYa2dhWE1nYm05MElIQnliM1pwWkdWa0xseHVJQ29nUUhKbGRIVnliaUI3YzNSeWFXNW5mVnh1SUNvdlhHNW1kVzVqZEdsdmJpQm5aWFJEYjIxd2IyNWxiblJMWlhrb1kyOXRjRzl1Wlc1MExDQnBibVJsZUNrZ2UxeHVJQ0F2THlCRWJ5QnpiMjFsSUhSNWNHVmphR1ZqYTJsdVp5Qm9aWEpsSUhOcGJtTmxJSGRsSUdOaGJHd2dkR2hwY3lCaWJHbHVaR3g1TGlCWFpTQjNZVzUwSUhSdklHVnVjM1Z5WlZ4dUlDQXZMeUIwYUdGMElIZGxJR1J2YmlkMElHSnNiMk5ySUhCdmRHVnVkR2xoYkNCbWRYUjFjbVVnUlZNZ1FWQkpjeTVjYmlBZ2FXWWdLR052YlhCdmJtVnVkQ0FtSmlCMGVYQmxiMllnWTI5dGNHOXVaVzUwSUQwOVBTQW5iMkpxWldOMEp5QW1KaUJqYjIxd2IyNWxiblF1YTJWNUlDRTlJRzUxYkd3cElIdGNiaUFnSUNBdkx5QkZlSEJzYVdOcGRDQnJaWGxjYmlBZ0lDQnlaWFIxY200Z1MyVjVSWE5qWVhCbFZYUnBiSE11WlhOallYQmxLR052YlhCdmJtVnVkQzVyWlhrcE8xeHVJQ0I5WEc0Z0lDOHZJRWx0Y0d4cFkybDBJR3RsZVNCa1pYUmxjbTFwYm1Wa0lHSjVJSFJvWlNCcGJtUmxlQ0JwYmlCMGFHVWdjMlYwWEc0Z0lISmxkSFZ5YmlCcGJtUmxlQzUwYjFOMGNtbHVaeWd6TmlrN1hHNTlYRzVjYmk4cUtseHVJQ29nUUhCaGNtRnRJSHMvS24wZ1kyaHBiR1J5Wlc0Z1EyaHBiR1J5Wlc0Z2RISmxaU0JqYjI1MFlXbHVaWEl1WEc0Z0tpQkFjR0Z5WVcwZ2V5RnpkSEpwYm1kOUlHNWhiV1ZUYjBaaGNpQk9ZVzFsSUc5bUlIUm9aU0JyWlhrZ2NHRjBhQ0J6YnlCbVlYSXVYRzRnS2lCQWNHRnlZVzBnZXlGbWRXNWpkR2x2Ym4wZ1kyRnNiR0poWTJzZ1EyRnNiR0poWTJzZ2RHOGdhVzUyYjJ0bElIZHBkR2dnWldGamFDQmphR2xzWkNCbWIzVnVaQzVjYmlBcUlFQndZWEpoYlNCN1B5cDlJSFJ5WVhabGNuTmxRMjl1ZEdWNGRDQlZjMlZrSUhSdklIQmhjM01nYVc1bWIzSnRZWFJwYjI0Z2RHaHliM1ZuYUc5MWRDQjBhR1VnZEhKaGRtVnljMkZzWEc0Z0tpQndjbTlqWlhOekxseHVJQ29nUUhKbGRIVnliaUI3SVc1MWJXSmxjbjBnVkdobElHNTFiV0psY2lCdlppQmphR2xzWkhKbGJpQnBiaUIwYUdseklITjFZblJ5WldVdVhHNGdLaTljYm1aMWJtTjBhVzl1SUhSeVlYWmxjbk5sUVd4c1EyaHBiR1J5Wlc1SmJYQnNLR05vYVd4a2NtVnVMQ0J1WVcxbFUyOUdZWElzSUdOaGJHeGlZV05yTENCMGNtRjJaWEp6WlVOdmJuUmxlSFFwSUh0Y2JpQWdkbUZ5SUhSNWNHVWdQU0IwZVhCbGIyWWdZMmhwYkdSeVpXNDdYRzVjYmlBZ2FXWWdLSFI1Y0dVZ1BUMDlJQ2QxYm1SbFptbHVaV1FuSUh4OElIUjVjR1VnUFQwOUlDZGliMjlzWldGdUp5a2dlMXh1SUNBZ0lDOHZJRUZzYkNCdlppQjBhR1VnWVdKdmRtVWdZWEpsSUhCbGNtTmxhWFpsWkNCaGN5QnVkV3hzTGx4dUlDQWdJR05vYVd4a2NtVnVJRDBnYm5Wc2JEdGNiaUFnZlZ4dVhHNGdJR2xtSUNoamFHbHNaSEpsYmlBOVBUMGdiblZzYkNCOGZDQjBlWEJsSUQwOVBTQW5jM1J5YVc1bkp5QjhmQ0IwZVhCbElEMDlQU0FuYm5WdFltVnlKeUI4ZkZ4dUlDQXZMeUJVYUdVZ1ptOXNiRzkzYVc1bklHbHpJR2x1YkdsdVpXUWdabkp2YlNCU1pXRmpkRVZzWlcxbGJuUXVJRlJvYVhNZ2JXVmhibk1nZDJVZ1kyRnVJRzl3ZEdsdGFYcGxYRzRnSUM4dklITnZiV1VnWTJobFkydHpMaUJTWldGamRDQkdhV0psY2lCaGJITnZJR2x1YkdsdVpYTWdkR2hwY3lCc2IyZHBZeUJtYjNJZ2MybHRhV3hoY2lCd2RYSndiM05sY3k1Y2JpQWdkSGx3WlNBOVBUMGdKMjlpYW1WamRDY2dKaVlnWTJocGJHUnlaVzR1SkNSMGVYQmxiMllnUFQwOUlGSkZRVU5VWDBWTVJVMUZUbFJmVkZsUVJTa2dlMXh1SUNBZ0lHTmhiR3hpWVdOcktIUnlZWFpsY25ObFEyOXVkR1Y0ZEN3Z1kyaHBiR1J5Wlc0c1hHNGdJQ0FnTHk4Z1NXWWdhWFFuY3lCMGFHVWdiMjVzZVNCamFHbHNaQ3dnZEhKbFlYUWdkR2hsSUc1aGJXVWdZWE1nYVdZZ2FYUWdkMkZ6SUhkeVlYQndaV1FnYVc0Z1lXNGdZWEp5WVhsY2JpQWdJQ0F2THlCemJ5QjBhR0YwSUdsMEozTWdZMjl1YzJsemRHVnVkQ0JwWmlCMGFHVWdiblZ0WW1WeUlHOW1JR05vYVd4a2NtVnVJR2R5YjNkekxseHVJQ0FnSUc1aGJXVlRiMFpoY2lBOVBUMGdKeWNnUHlCVFJWQkJVa0ZVVDFJZ0t5Qm5aWFJEYjIxd2IyNWxiblJMWlhrb1kyaHBiR1J5Wlc0c0lEQXBJRG9nYm1GdFpWTnZSbUZ5S1R0Y2JpQWdJQ0J5WlhSMWNtNGdNVHRjYmlBZ2ZWeHVYRzRnSUhaaGNpQmphR2xzWkR0Y2JpQWdkbUZ5SUc1bGVIUk9ZVzFsTzF4dUlDQjJZWElnYzNWaWRISmxaVU52ZFc1MElEMGdNRHNnTHk4Z1EyOTFiblFnYjJZZ1kyaHBiR1J5Wlc0Z1ptOTFibVFnYVc0Z2RHaGxJR04xY25KbGJuUWdjM1ZpZEhKbFpTNWNiaUFnZG1GeUlHNWxlSFJPWVcxbFVISmxabWw0SUQwZ2JtRnRaVk52Um1GeUlEMDlQU0FuSnlBL0lGTkZVRUZTUVZSUFVpQTZJRzVoYldWVGIwWmhjaUFySUZOVlFsTkZVRUZTUVZSUFVqdGNibHh1SUNCcFppQW9RWEp5WVhrdWFYTkJjbkpoZVNoamFHbHNaSEpsYmlrcElIdGNiaUFnSUNCbWIzSWdLSFpoY2lCcElEMGdNRHNnYVNBOElHTm9hV3hrY21WdUxteGxibWQwYURzZ2FTc3JLU0I3WEc0Z0lDQWdJQ0JqYUdsc1pDQTlJR05vYVd4a2NtVnVXMmxkTzF4dUlDQWdJQ0FnYm1WNGRFNWhiV1VnUFNCdVpYaDBUbUZ0WlZCeVpXWnBlQ0FySUdkbGRFTnZiWEJ2Ym1WdWRFdGxlU2hqYUdsc1pDd2dhU2s3WEc0Z0lDQWdJQ0J6ZFdKMGNtVmxRMjkxYm5RZ0t6MGdkSEpoZG1WeWMyVkJiR3hEYUdsc1pISmxia2x0Y0d3b1kyaHBiR1FzSUc1bGVIUk9ZVzFsTENCallXeHNZbUZqYXl3Z2RISmhkbVZ5YzJWRGIyNTBaWGgwS1R0Y2JpQWdJQ0I5WEc0Z0lIMGdaV3h6WlNCN1hHNGdJQ0FnZG1GeUlHbDBaWEpoZEc5eVJtNGdQU0JuWlhSSmRHVnlZWFJ2Y2tadUtHTm9hV3hrY21WdUtUdGNiaUFnSUNCcFppQW9hWFJsY21GMGIzSkdiaWtnZTF4dUlDQWdJQ0FnZG1GeUlHbDBaWEpoZEc5eUlEMGdhWFJsY21GMGIzSkdiaTVqWVd4c0tHTm9hV3hrY21WdUtUdGNiaUFnSUNBZ0lIWmhjaUJ6ZEdWd08xeHVJQ0FnSUNBZ2FXWWdLR2wwWlhKaGRHOXlSbTRnSVQwOUlHTm9hV3hrY21WdUxtVnVkSEpwWlhNcElIdGNiaUFnSUNBZ0lDQWdkbUZ5SUdscElEMGdNRHRjYmlBZ0lDQWdJQ0FnZDJocGJHVWdLQ0VvYzNSbGNDQTlJR2wwWlhKaGRHOXlMbTVsZUhRb0tTa3VaRzl1WlNrZ2UxeHVJQ0FnSUNBZ0lDQWdJR05vYVd4a0lEMGdjM1JsY0M1MllXeDFaVHRjYmlBZ0lDQWdJQ0FnSUNCdVpYaDBUbUZ0WlNBOUlHNWxlSFJPWVcxbFVISmxabWw0SUNzZ1oyVjBRMjl0Y0c5dVpXNTBTMlY1S0dOb2FXeGtMQ0JwYVNzcktUdGNiaUFnSUNBZ0lDQWdJQ0J6ZFdKMGNtVmxRMjkxYm5RZ0t6MGdkSEpoZG1WeWMyVkJiR3hEYUdsc1pISmxia2x0Y0d3b1kyaHBiR1FzSUc1bGVIUk9ZVzFsTENCallXeHNZbUZqYXl3Z2RISmhkbVZ5YzJWRGIyNTBaWGgwS1R0Y2JpQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ2ZTQmxiSE5sSUh0Y2JpQWdJQ0FnSUNBZ2FXWWdLSEJ5YjJObGMzTXVaVzUyTGs1UFJFVmZSVTVXSUNFOVBTQW5jSEp2WkhWamRHbHZiaWNwSUh0Y2JpQWdJQ0FnSUNBZ0lDQjJZWElnYldGd2MwRnpRMmhwYkdSeVpXNUJaR1JsYm1SMWJTQTlJQ2NuTzF4dUlDQWdJQ0FnSUNBZ0lHbG1JQ2hTWldGamRFTjFjbkpsYm5SUGQyNWxjaTVqZFhKeVpXNTBLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQjJZWElnYldGd2MwRnpRMmhwYkdSeVpXNVBkMjVsY2s1aGJXVWdQU0JTWldGamRFTjFjbkpsYm5SUGQyNWxjaTVqZFhKeVpXNTBMbWRsZEU1aGJXVW9LVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lHbG1JQ2h0WVhCelFYTkRhR2xzWkhKbGJrOTNibVZ5VG1GdFpTa2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQnRZWEJ6UVhORGFHbHNaSEpsYmtGa1pHVnVaSFZ0SUQwZ0p5QkRhR1ZqYXlCMGFHVWdjbVZ1WkdWeUlHMWxkR2h2WkNCdlppQmdKeUFySUcxaGNITkJjME5vYVd4a2NtVnVUM2R1WlhKT1lXMWxJQ3NnSjJBdUp6dGNiaUFnSUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJQ0FnY0hKdlkyVnpjeTVsYm5ZdVRrOUVSVjlGVGxZZ0lUMDlJQ2R3Y205a2RXTjBhVzl1SnlBL0lIZGhjbTVwYm1jb1pHbGtWMkZ5YmtGaWIzVjBUV0Z3Y3l3Z0oxVnphVzVuSUUxaGNITWdZWE1nWTJocGJHUnlaVzRnYVhNZ2JtOTBJSGxsZENCbWRXeHNlU0J6ZFhCd2IzSjBaV1F1SUVsMElHbHpJR0Z1SUNjZ0t5QW5aWGh3WlhKcGJXVnVkR0ZzSUdabFlYUjFjbVVnZEdoaGRDQnRhV2RvZENCaVpTQnlaVzF2ZG1Wa0xpQkRiMjUyWlhKMElHbDBJSFJ2SUdFZ0p5QXJJQ2R6WlhGMVpXNWpaU0F2SUdsMFpYSmhZbXhsSUc5bUlHdGxlV1ZrSUZKbFlXTjBSV3hsYldWdWRITWdhVzV6ZEdWaFpDNGxjeWNzSUcxaGNITkJjME5vYVd4a2NtVnVRV1JrWlc1a2RXMHBJRG9nZG05cFpDQXdPMXh1SUNBZ0lDQWdJQ0FnSUdScFpGZGhjbTVCWW05MWRFMWhjSE1nUFNCMGNuVmxPMXh1SUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0FnSUM4dklFbDBaWEpoZEc5eUlIZHBiR3dnY0hKdmRtbGtaU0JsYm5SeWVTQmJheXgyWFNCMGRYQnNaWE1nY21GMGFHVnlJSFJvWVc0Z2RtRnNkV1Z6TGx4dUlDQWdJQ0FnSUNCM2FHbHNaU0FvSVNoemRHVndJRDBnYVhSbGNtRjBiM0l1Ym1WNGRDZ3BLUzVrYjI1bEtTQjdYRzRnSUNBZ0lDQWdJQ0FnZG1GeUlHVnVkSEo1SUQwZ2MzUmxjQzUyWVd4MVpUdGNiaUFnSUNBZ0lDQWdJQ0JwWmlBb1pXNTBjbmtwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJR05vYVd4a0lEMGdaVzUwY25sYk1WMDdYRzRnSUNBZ0lDQWdJQ0FnSUNCdVpYaDBUbUZ0WlNBOUlHNWxlSFJPWVcxbFVISmxabWw0SUNzZ1MyVjVSWE5qWVhCbFZYUnBiSE11WlhOallYQmxLR1Z1ZEhKNVd6QmRLU0FySUZOVlFsTkZVRUZTUVZSUFVpQXJJR2RsZEVOdmJYQnZibVZ1ZEV0bGVTaGphR2xzWkN3Z01DazdYRzRnSUNBZ0lDQWdJQ0FnSUNCemRXSjBjbVZsUTI5MWJuUWdLejBnZEhKaGRtVnljMlZCYkd4RGFHbHNaSEpsYmtsdGNHd29ZMmhwYkdRc0lHNWxlSFJPWVcxbExDQmpZV3hzWW1GamF5d2dkSEpoZG1WeWMyVkRiMjUwWlhoMEtUdGNiaUFnSUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUgxY2JpQWdJQ0I5SUdWc2MyVWdhV1lnS0hSNWNHVWdQVDA5SUNkdlltcGxZM1FuS1NCN1hHNGdJQ0FnSUNCMllYSWdZV1JrWlc1a2RXMGdQU0FuSnp0Y2JpQWdJQ0FnSUdsbUlDaHdjbTlqWlhOekxtVnVkaTVPVDBSRlgwVk9WaUFoUFQwZ0ozQnliMlIxWTNScGIyNG5LU0I3WEc0Z0lDQWdJQ0FnSUdGa1pHVnVaSFZ0SUQwZ0p5QkpaaUI1YjNVZ2JXVmhiblFnZEc4Z2NtVnVaR1Z5SUdFZ1kyOXNiR1ZqZEdsdmJpQnZaaUJqYUdsc1pISmxiaXdnZFhObElHRnVJR0Z5Y21GNUlDY2dLeUFuYVc1emRHVmhaQ0J2Y2lCM2NtRndJSFJvWlNCdlltcGxZM1FnZFhOcGJtY2dZM0psWVhSbFJuSmhaMjFsYm5Rb2IySnFaV04wS1NCbWNtOXRJSFJvWlNBbklDc2dKMUpsWVdOMElHRmtaQzF2Ym5NdUp6dGNiaUFnSUNBZ0lDQWdhV1lnS0dOb2FXeGtjbVZ1TGw5cGMxSmxZV04wUld4bGJXVnVkQ2tnZTF4dUlDQWdJQ0FnSUNBZ0lHRmtaR1Z1WkhWdElEMGdYQ0lnU1hRZ2JHOXZhM01nYkdsclpTQjViM1VuY21VZ2RYTnBibWNnWVc0Z1pXeGxiV1Z1ZENCamNtVmhkR1ZrSUdKNUlHRWdaR2xtWm1WeVpXNTBJRndpSUNzZ0ozWmxjbk5wYjI0Z2IyWWdVbVZoWTNRdUlFMWhhMlVnYzNWeVpTQjBieUIxYzJVZ2IyNXNlU0J2Ym1VZ1kyOXdlU0J2WmlCU1pXRmpkQzRuTzF4dUlDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lHbG1JQ2hTWldGamRFTjFjbkpsYm5SUGQyNWxjaTVqZFhKeVpXNTBLU0I3WEc0Z0lDQWdJQ0FnSUNBZ2RtRnlJRzVoYldVZ1BTQlNaV0ZqZEVOMWNuSmxiblJQZDI1bGNpNWpkWEp5Wlc1MExtZGxkRTVoYldVb0tUdGNiaUFnSUNBZ0lDQWdJQ0JwWmlBb2JtRnRaU2tnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdZV1JrWlc1a2RXMGdLejBnSnlCRGFHVmpheUIwYUdVZ2NtVnVaR1Z5SUcxbGRHaHZaQ0J2WmlCZ0p5QXJJRzVoYldVZ0t5QW5ZQzRuTzF4dUlDQWdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdmVnh1SUNBZ0lDQWdkbUZ5SUdOb2FXeGtjbVZ1VTNSeWFXNW5JRDBnVTNSeWFXNW5LR05vYVd4a2NtVnVLVHRjYmlBZ0lDQWdJQ0ZtWVd4elpTQS9JSEJ5YjJObGMzTXVaVzUyTGs1UFJFVmZSVTVXSUNFOVBTQW5jSEp2WkhWamRHbHZiaWNnUHlCcGJuWmhjbWxoYm5Rb1ptRnNjMlVzSUNkUFltcGxZM1J6SUdGeVpTQnViM1FnZG1Gc2FXUWdZWE1nWVNCU1pXRmpkQ0JqYUdsc1pDQW9abTkxYm1RNklDVnpLUzRsY3ljc0lHTm9hV3hrY21WdVUzUnlhVzVuSUQwOVBTQW5XMjlpYW1WamRDQlBZbXBsWTNSZEp5QS9JQ2R2WW1wbFkzUWdkMmwwYUNCclpYbHpJSHNuSUNzZ1QySnFaV04wTG10bGVYTW9ZMmhwYkdSeVpXNHBMbXB2YVc0b0p5d2dKeWtnS3lBbmZTY2dPaUJqYUdsc1pISmxibE4wY21sdVp5d2dZV1JrWlc1a2RXMHBJRG9nWDNCeWIyUkpiblpoY21saGJuUW9Kek14Snl3Z1kyaHBiR1J5Wlc1VGRISnBibWNnUFQwOUlDZGJiMkpxWldOMElFOWlhbVZqZEYwbklEOGdKMjlpYW1WamRDQjNhWFJvSUd0bGVYTWdleWNnS3lCUFltcGxZM1F1YTJWNWN5aGphR2xzWkhKbGJpa3VhbTlwYmlnbkxDQW5LU0FySUNkOUp5QTZJR05vYVd4a2NtVnVVM1J5YVc1bkxDQmhaR1JsYm1SMWJTa2dPaUIyYjJsa0lEQTdYRzRnSUNBZ2ZWeHVJQ0I5WEc1Y2JpQWdjbVYwZFhKdUlITjFZblJ5WldWRGIzVnVkRHRjYm4xY2JseHVMeW9xWEc0Z0tpQlVjbUYyWlhKelpYTWdZMmhwYkdSeVpXNGdkR2hoZENCaGNtVWdkSGx3YVdOaGJHeDVJSE53WldOcFptbGxaQ0JoY3lCZ2NISnZjSE11WTJocGJHUnlaVzVnTENCaWRYUmNiaUFxSUcxcFoyaDBJR0ZzYzI4Z1ltVWdjM0JsWTJsbWFXVmtJSFJvY205MVoyZ2dZWFIwY21saWRYUmxjenBjYmlBcVhHNGdLaUF0SUdCMGNtRjJaWEp6WlVGc2JFTm9hV3hrY21WdUtIUm9hWE11Y0hKdmNITXVZMmhwYkdSeVpXNHNJQzR1TGlsZ1hHNGdLaUF0SUdCMGNtRjJaWEp6WlVGc2JFTm9hV3hrY21WdUtIUm9hWE11Y0hKdmNITXViR1ZtZEZCaGJtVnNRMmhwYkdSeVpXNHNJQzR1TGlsZ1hHNGdLbHh1SUNvZ1ZHaGxJR0IwY21GMlpYSnpaVU52Ym5SbGVIUmdJR2x6SUdGdUlHOXdkR2x2Ym1Gc0lHRnlaM1Z0Wlc1MElIUm9ZWFFnYVhNZ2NHRnpjMlZrSUhSb2NtOTFaMmdnZEdobFhHNGdLaUJsYm5ScGNtVWdkSEpoZG1WeWMyRnNMaUJKZENCallXNGdZbVVnZFhObFpDQjBieUJ6ZEc5eVpTQmhZMk4xYlhWc1lYUnBiMjV6SUc5eUlHRnVlWFJvYVc1bklHVnNjMlVnZEdoaGRGeHVJQ29nZEdobElHTmhiR3hpWVdOcklHMXBaMmgwSUdacGJtUWdjbVZzWlhaaGJuUXVYRzRnS2x4dUlDb2dRSEJoY21GdElIcy9LbjBnWTJocGJHUnlaVzRnUTJocGJHUnlaVzRnZEhKbFpTQnZZbXBsWTNRdVhHNGdLaUJBY0dGeVlXMGdleUZtZFc1amRHbHZibjBnWTJGc2JHSmhZMnNnVkc4Z2FXNTJiMnRsSUhWd2IyNGdkSEpoZG1WeWMybHVaeUJsWVdOb0lHTm9hV3hrTGx4dUlDb2dRSEJoY21GdElIcy9LbjBnZEhKaGRtVnljMlZEYjI1MFpYaDBJRU52Ym5SbGVIUWdabTl5SUhSeVlYWmxjbk5oYkM1Y2JpQXFJRUJ5WlhSMWNtNGdleUZ1ZFcxaVpYSjlJRlJvWlNCdWRXMWlaWElnYjJZZ1kyaHBiR1J5Wlc0Z2FXNGdkR2hwY3lCemRXSjBjbVZsTGx4dUlDb3ZYRzVtZFc1amRHbHZiaUIwY21GMlpYSnpaVUZzYkVOb2FXeGtjbVZ1S0dOb2FXeGtjbVZ1TENCallXeHNZbUZqYXl3Z2RISmhkbVZ5YzJWRGIyNTBaWGgwS1NCN1hHNGdJR2xtSUNoamFHbHNaSEpsYmlBOVBTQnVkV3hzS1NCN1hHNGdJQ0FnY21WMGRYSnVJREE3WEc0Z0lIMWNibHh1SUNCeVpYUjFjbTRnZEhKaGRtVnljMlZCYkd4RGFHbHNaSEpsYmtsdGNHd29ZMmhwYkdSeVpXNHNJQ2NuTENCallXeHNZbUZqYXl3Z2RISmhkbVZ5YzJWRGIyNTBaWGgwS1R0Y2JuMWNibHh1Ylc5a2RXeGxMbVY0Y0c5eWRITWdQU0IwY21GMlpYSnpaVUZzYkVOb2FXeGtjbVZ1T3lJc0lpZDFjMlVnYzNSeWFXTjBKenRjYmx4dWJXOWtkV3hsTG1WNGNHOXlkSE1nUFNCeVpYRjFhWEpsS0NjdUwyeHBZaTlTWldGamRDY3BPMXh1SWl3aWFXMXdiM0owSUZKbFlXTjBMQ0I3SUVOdmJYQnZibVZ1ZENCOUlDQm1jbTl0SUNkeVpXRmpkQ2M3WEc1Y2JseHVZMnhoYzNNZ1RtRjJJR1Y0ZEdWdVpITWdRMjl0Y0c5dVpXNTBJSHNnSUZ4dVhHNGdJQ0FnWTI5dWMzUnlkV04wYjNJb2NISnZjSE1wZTF4dUlDQWdJSE4xY0dWeUtIQnliM0J6S1R0Y2JpQWdJQ0F2THlCMGFHbHpMblJsYzNSSFpYUW9LVHRjYmlBZ0lDQjlPMXh1WEc0Z0lDQWdjbVZ1WkdWeUtDbDdYRzRnSUNBZ2NtVjBkWEp1SUNoY2JpQWdJQ0FnSUNBZ1BHNWhkaUJwWkQxY0ltMWhhVzVPWVhaY0lpQmpiR0Z6YzA1aGJXVTlYQ0p1WVhaaVlYSWdibUYyWW1GeUxXUmxabUYxYkhRZ2JtRjJZbUZ5TFdacGVHVmtMWFJ2Y0NCdVlYWmlZWEl0WTNWemRHOXRYQ0krWEc0Z0lDQWdJQ0FnSUR4a2FYWWdZMnhoYzNOT1lXMWxQVndpWTI5dWRHRnBibVZ5WENJK1hHNGdJQ0FnSUNBZ0lDQWdJQ0E4WkdsMklHTnNZWE56VG1GdFpUMWNJbTVoZG1KaGNpMW9aV0ZrWlhJZ2NHRm5aUzF6WTNKdmJHeGNJajVjYmlBZ0lDQWdJQ0FnSUNBZ0lEeGlkWFIwYjI0Z2RIbHdaVDFjSW1KMWRIUnZibHdpSUdOc1lYTnpUbUZ0WlQxY0ltNWhkbUpoY2kxMGIyZG5iR1ZjSWlCa1lYUmhMWFJ2WjJkc1pUMWNJbU52Ykd4aGNITmxYQ0lnWkdGMFlTMTBZWEpuWlhROVhDSWpZbk10WlhoaGJYQnNaUzF1WVhaaVlYSXRZMjlzYkdGd2MyVXRNVndpUGx4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUR4emNHRnVJR05zWVhOelRtRnRaVDFjSW5OeUxXOXViSGxjSWo1VWIyZG5iR1VnYm1GMmFXZGhkR2x2Ymp3dmMzQmhiajRnVFdWdWRTQThhU0JqYkdGemMwNWhiV1U5WENKbVlTQm1ZUzFpWVhKelhDSWdMejVjYmlBZ0lDQWdJQ0FnSUNBZ0lEd3ZZblYwZEc5dVBseHVJQ0FnSUNBZ0lDQWdJQ0FnUEdFZ1kyeGhjM05PWVcxbFBWd2libUYyWW1GeUxXSnlZVzVrWENJZ2FISmxaajFjSWk5Y0lqNUpiV2R5WVdJOEwyRStYRzRnSUNBZ0lDQWdJQ0FnSUNBOEwyUnBkajVjYmlBZ0lDQWdJQ0FnSUNBZ0lEeGthWFlnWTJ4aGMzTk9ZVzFsUFZ3aVkyOXNiR0Z3YzJVZ2JtRjJZbUZ5TFdOdmJHeGhjSE5sWENJZ2FXUTlYQ0ppY3kxbGVHRnRjR3hsTFc1aGRtSmhjaTFqYjJ4c1lYQnpaUzB4WENJK1hHNGdJQ0FnSUNBZ0lDQWdJQ0E4ZFd3Z1kyeGhjM05PWVcxbFBWd2libUYySUc1aGRtSmhjaTF1WVhZZ2JtRjJZbUZ5TFhKcFoyaDBYQ0krWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnUEd4cElHTnNZWE56VG1GdFpUMWNJbWhwWkdSbGJsd2lQbHh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJRHhoSUdoeVpXWTlYQ0lqY0dGblpTMTBiM0JjSWlBdlBseHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lEd3ZiR2srWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnUEd4cElHTnNZWE56VG1GdFpUMWNJbkJoWjJVdGMyTnliMnhzWENJK1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1BHRWdhSEpsWmoxY0lpOXBiV0ZuWlhOY0lqNU5lU0JKYldGblpYTThMMkUrWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnUEM5c2FUNWNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQThiR2tnWTJ4aGMzTk9ZVzFsUFZ3aWNHRm5aUzF6WTNKdmJHeGNJajVjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0E4WVNCb2NtVm1QVndpSTF3aVBraGxiSEE4TDJFK1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1BDOXNhVDVjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0E4YkdrZ1kyeGhjM05PWVcxbFBWd2ljR0ZuWlMxelkzSnZiR3hjSWo1Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBOFlTQm9jbVZtUFZ3aUkxd2lQa052Ym5SaFkzUThMMkUrWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnUEM5c2FUNWNiaUFnSUNBZ0lDQWdJQ0FnSUR3dmRXdytYRzRnSUNBZ0lDQWdJQ0FnSUNBOEwyUnBkajVjYmlBZ0lDQWdJQ0FnUEM5a2FYWStYRzRnSUNBZ0lDQWdJRHd2Ym1GMlBseHVJQ0FnSUNrN1hHNGdJQ0FnZlR0Y2JseHVJQ0FnSUM4dklIUmxjM1JIWlhRb0tTQjdYRzRnSUNBZ0x5OGdZWGhwYjNNdVoyVjBLQ2RvZEhSd09pOHZNVEkzTGpBdU1DNHhPalV3TURBdllYQnBMMmx0WVdkbGN5Y3BYRzRnSUNBZ0x5OGdMblJvWlc0b1puVnVZM1JwYjI0Z0tISmxjM0J2Ym5ObEtTQjdYRzRnSUNBZ0x5OGdJQ0FnSUdOdmJuTnZiR1V1Ykc5bktISmxjM0J2Ym5ObEtUdGNiaUFnSUNBdkx5QjlLVnh1SUNBZ0lDOHZJQzVqWVhSamFDaG1kVzVqZEdsdmJpQW9aWEp5YjNJcElIdGNiaUFnSUNBdkx5QWdJQ0FnWTI5dWMyOXNaUzVzYjJjb1pYSnliM0lwTzF4dUlDQWdJQzh2SUgwcE8xeHVJQ0FnSUM4dklIMWNibHh1ZlR0Y2JseHVaWGh3YjNKMElHUmxabUYxYkhRZ1RtRjJYRzRpTENKcGJYQnZjblFnWVhocGIzTWdabkp2YlNBbllYaHBiM01uTzF4dWFXMXdiM0owSUZKbFlXTjBMQ0I3SUVOdmJYQnZibVZ1ZENCOUlDQm1jbTl0SUNkeVpXRmpkQ2M3WEc1Y2JtbHRjRzl5ZENCT1lYWWdabkp2YlNBbkxpOWpiMjF3YjI1bGJuUnpMMjVoZGljN1hHNWNibHh1WEc1Y2JseHVMeThnWTJ4aGMzTWdVR0ZuWlVOdmJuUmhhVzVsY2lCbGVIUmxibVJ6SUVOdmJYQnZibVZ1ZENCN1hHNHZMeUFnSUhKbGJtUmxjaWdwSUh0Y2JpOHZJQ0FnSUNCeVpYUjFjbTRnS0Z4dUx5OGdJQ0FnSUNBZ1BHUnBkaUJqYkdGemMwNWhiV1U5WENKd1lXZGxMV052Ym5SaGFXNWxjbHdpUGx4dUx5OGdJQ0FnSUNBZ0lDQjdkR2hwY3k1d2NtOXdjeTVqYUdsc1pISmxibjFjYmk4dklDQWdJQ0FnSUR3dlpHbDJQbHh1THk4Z0lDQWdJQ2s3WEc0dkx5QWdJSDFjYmk4dklIMWNibHh1WEc1Y2JuWmhjaUJRWVdkbFEyOXVkR0ZwYm1WeUlEMGdVbVZoWTNRdVkzSmxZWFJsUTJ4aGMzTW9lMXh1SUNCeVpXNWtaWElvS1NCN1hHNGdJQ0FnY21WMGRYSnVJQ2hjYmlBZ0lDQWdJRHhrYVhZZ1kyeGhjM05PWVcxbFBWd2ljR0ZuWlMxamIyNTBZV2x1WlhKY0lqNWNiaUFnSUNBZ0lDQWdlM1JvYVhNdWNISnZjSE11WTJocGJHUnlaVzU5WEc0Z0lDQWdJQ0E4TDJScGRqNWNiaUFnSUNBcE8xeHVJQ0I5WEc1OUtUdGNibHh1ZG1GeUlFUjVibUZ0YVdOVFpXRnlZMmdnUFNCU1pXRmpkQzVqY21WaGRHVkRiR0Z6Y3loN1hHNWNiaUFnTHk4Z2MyVjBjeUJwYm1sMGFXRnNJSE4wWVhSbFhHNGdJR2RsZEVsdWFYUnBZV3hUZEdGMFpUb2dablZ1WTNScGIyNG9LWHRjYmlBZ0lDQnlaWFIxY200Z2V5QnpaV0Z5WTJoVGRISnBibWM2SUNjbklIMDdYRzRnSUgwc1hHNWNiaUFnTHk4Z2MyVjBjeUJ6ZEdGMFpTd2dkSEpwWjJkbGNuTWdjbVZ1WkdWeUlHMWxkR2h2WkZ4dUlDQm9ZVzVrYkdWRGFHRnVaMlU2SUdaMWJtTjBhVzl1S0dWMlpXNTBLWHRjYmlBZ0lDQXZMeUJuY21GaUlIWmhiSFZsSUdadmNtMGdhVzV3ZFhRZ1ltOTRYRzRnSUNBZ2RHaHBjeTV6WlhSVGRHRjBaU2g3YzJWaGNtTm9VM1J5YVc1bk9tVjJaVzUwTG5SaGNtZGxkQzUyWVd4MVpYMHBPMXh1SUNBZ0lHTnZibk52YkdVdWJHOW5LRndpYzJOdmNHVWdkWEJrWVhSbFpDRmNJaWs3WEc0Z0lIMHNYRzVjYmlBZ2NtVnVaR1Z5T2lCbWRXNWpkR2x2YmlncElIdGNibHh1SUNBZ0lIWmhjaUJqYjNWdWRISnBaWE1nUFNCMGFHbHpMbkJ5YjNCekxtbDBaVzF6TzF4dUlDQWdJSFpoY2lCelpXRnlZMmhUZEhKcGJtY2dQU0IwYUdsekxuTjBZWFJsTG5ObFlYSmphRk4wY21sdVp5NTBjbWx0S0NrdWRHOU1iM2RsY2tOaGMyVW9LVHRjYmx4dUlDQWdJQzh2SUdacGJIUmxjaUJqYjNWdWRISnBaWE1nYkdsemRDQmllU0IyWVd4MVpTQm1jbTl0SUdsdWNIVjBJR0p2ZUZ4dUlDQWdJR2xtS0hObFlYSmphRk4wY21sdVp5NXNaVzVuZEdnZ1BpQXdLWHRjYmlBZ0lDQWdJR052ZFc1MGNtbGxjeUE5SUdOdmRXNTBjbWxsY3k1bWFXeDBaWElvWm5WdVkzUnBiMjRvWTI5MWJuUnllU2w3WEc0Z0lDQWdJQ0FnSUhKbGRIVnliaUJqYjNWdWRISjVMbTVoYldVdWRHOU1iM2RsY2tOaGMyVW9LUzV0WVhSamFDZ2djMlZoY21Ob1UzUnlhVzVuSUNrN1hHNGdJQ0FnSUNCOUtUdGNiaUFnSUNCOVhHNWNiaUFnSUNCeVpYUjFjbTRnS0Z4dUlDQWdJQ0FnUEdScGRpQmpiR0Z6YzA1aGJXVTlYQ0p6WldGeVkyZ3RZMjl0Y0c5dVpXNTBYQ0krWEc0Z0lDQWdJQ0FnSUR4cGJuQjFkQ0IwZVhCbFBWd2lkR1Y0ZEZ3aUlIWmhiSFZsUFh0MGFHbHpMbk4wWVhSbExuTmxZWEpqYUZOMGNtbHVaMzBnYjI1RGFHRnVaMlU5ZTNSb2FYTXVhR0Z1Wkd4bFEyaGhibWRsZlNCd2JHRmpaV2h2YkdSbGNqMWNJbE5sWVhKamFDRmNJaUF2UGx4dUlDQWdJQ0FnSUNBOGRXdytYRzRnSUNBZ0lDQWdJQ0FnZXlCamIzVnVkSEpwWlhNdWJXRndLR1oxYm1OMGFXOXVLR052ZFc1MGNua3BleUJ5WlhSMWNtNGdQR3hwUG50amIzVnVkSEo1TG01aGJXVjlJRHd2YkdrK0lIMHBJSDFjYmlBZ0lDQWdJQ0FnUEM5MWJENWNiaUFnSUNBZ0lEd3ZaR2wyUGx4dUlDQWdJQ2xjYmlBZ2ZWeHVYRzU5S1R0Y2JseHVMeThnYkdsemRDQnZaaUJqYjNWdWRISnBaWE1zSUdSbFptbHVaV1FnZDJsMGFDQktZWFpoVTJOeWFYQjBJRzlpYW1WamRDQnNhWFJsY21Gc2MxeHVkbUZ5SUdOdmRXNTBjbWxsY3lBOUlGdGNiaUFnZTF3aWJtRnRaVndpT2lCY0lsTjNaV1JsYmx3aWZTd2dlMXdpYm1GdFpWd2lPaUJjSWtOb2FXNWhYQ0o5TENCN1hDSnVZVzFsWENJNklGd2lVR1Z5ZFZ3aWZTd2dlMXdpYm1GdFpWd2lPaUJjSWtONlpXTm9JRkpsY0hWaWJHbGpYQ0o5TEZ4dUlDQjdYQ0p1WVcxbFhDSTZJRndpUW05c2FYWnBZVndpZlN3Z2Uxd2libUZ0WlZ3aU9pQmNJa3hoZEhacFlWd2lmU3dnZTF3aWJtRnRaVndpT2lCY0lsTmhiVzloWENKOUxDQjdYQ0p1WVcxbFhDSTZJRndpUVhKdFpXNXBZVndpZlN4Y2JpQWdlMXdpYm1GdFpWd2lPaUJjSWtkeVpXVnViR0Z1WkZ3aWZTd2dlMXdpYm1GdFpWd2lPaUJjSWtOMVltRmNJbjBzSUh0Y0ltNWhiV1ZjSWpvZ1hDSlhaWE4wWlhKdUlGTmhhR0Z5WVZ3aWZTd2dlMXdpYm1GdFpWd2lPaUJjSWtWMGFHbHZjR2xoWENKOUxGeHVJQ0I3WENKdVlXMWxYQ0k2SUZ3aVRXRnNZWGx6YVdGY0luMHNJSHRjSW01aGJXVmNJam9nWENKQmNtZGxiblJwYm1GY0luMHNJSHRjSW01aGJXVmNJam9nWENKVloyRnVaR0ZjSW4wc0lIdGNJbTVoYldWY0lqb2dYQ0pEYUdsc1pWd2lmU3hjYmlBZ2Uxd2libUZ0WlZ3aU9pQmNJa0Z5ZFdKaFhDSjlMQ0I3WENKdVlXMWxYQ0k2SUZ3aVNtRndZVzVjSW4wc0lIdGNJbTVoYldWY0lqb2dYQ0pVY21sdWFXUmhaQ0JoYm1RZ1ZHOWlZV2R2WENKOUxDQjdYQ0p1WVcxbFhDSTZJRndpU1hSaGJIbGNJbjBzWEc0Z0lIdGNJbTVoYldWY0lqb2dYQ0pEWVcxaWIyUnBZVndpZlN3Z2Uxd2libUZ0WlZ3aU9pQmNJa2xqWld4aGJtUmNJbjBzSUh0Y0ltNWhiV1ZjSWpvZ1hDSkViMjFwYm1sallXNGdVbVZ3ZFdKc2FXTmNJbjBzSUh0Y0ltNWhiV1ZjSWpvZ1hDSlVkWEpyWlhsY0luMHNYRzRnSUh0Y0ltNWhiV1ZjSWpvZ1hDSlRjR0ZwYmx3aWZTd2dlMXdpYm1GdFpWd2lPaUJjSWxCdmJHRnVaRndpZlN3Z2Uxd2libUZ0WlZ3aU9pQmNJa2hoYVhScFhDSjlYRzVkTzF4dVhHNWNibHh1ZG1GeUlFbHRZV2RsUjNKcFpDQTlJRkpsWVdOMExtTnlaV0YwWlVOc1lYTnpLSHRjYmlBZ2NtVnVaR1Z5T2lCbWRXNWpkR2x2YmlncElIdGNiaUFnSUNCeVpYUjFjbTRnS0Z4dUlDQWdJQ0FnSUNBOFpHbDJJR05zWVhOelRtRnRaVDFjSW5KdmQxd2lJR2xrUFZ3aWFXMWhaMlZmWTI5dWRHRnBibVZ5WENJK1hHNGdJQ0FnSUNBZ0lEd3ZaR2wyUGx4dUlDQWdJQ2s3WEc0Z0lIMWNibjBwTzF4dUlDQmNibHh1WEc1c1pYUWdUV0ZwYmtOdmJuUmxiblFnUFNBb1hHNGdJRHhrYVhZK1hHNGdJQ0FnUEU1aGRpQXZQbHh1SUNBZ0lEeFFZV2RsUTI5dWRHRnBibVZ5UGx4dUlDQWdJQ0FnUEVSNWJtRnRhV05UWldGeVkyZ2dhWFJsYlhNOWV5QmpiM1Z1ZEhKcFpYTWdmU0F2UGx4dUlDQWdJRHd2VUdGblpVTnZiblJoYVc1bGNqNWNiaUFnUEM5a2FYWStYRzRwTzF4dVhHNVNaV0ZqZEVSUFRTNXlaVzVrWlhJb1hHNGdJRTFoYVc1RGIyNTBaVzUwSUN3Z1hHNGdJR1J2WTNWdFpXNTBMbWRsZEVWc1pXMWxiblJDZVVsa0tGd2lZWEJ3TFdOdmJuUmhhVzVsY2x3aUtWeHVLVHRjYmx4dUx5OGdkbUZ5SUUxaGFXNURiMjUwWlc1MElEMGdVbVZoWTNRdVkzSmxZWFJsUTJ4aGMzTW9lMXh1THk4Z0lDQWdJSEpsYm1SbGNqb2dablZ1WTNScGIyNG9LWHRjYmk4dklDQWdJQ0FnSUNBZ2NtVjBkWEp1SUNoY2JpOHZJQ0FnSUNBZ0lDQWdJQ0FnSUR4a2FYWWdZMnhoYzNOT1lXMWxQVndpYldGcGJpMWpiMjUwWlc1MFhDSStYRzR2THlBZ0lDQWdJQ0FnSUNBZ0lDQWdJRHhPWVhZZ0x6NWNiaTh2SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdQRkJoWjJWRGIyNTBZV2x1WlhJK1hHNHZMeUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdQRVI1Ym1GdGFXTlRaV0Z5WTJnZ2FYUmxiWE05ZXlCamIzVnVkSEpwWlhNZ2ZTQXZQbHh1THk4Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0E4TDFCaFoyVkRiMjUwWVdsdVpYSStYRzR2THlBZ0lDQWdJQ0FnSUNBZ0lDQThMMlJwZGo1Y2JpOHZJQ0FnSUNBZ0lDQWdLVnh1THk4Z0lDQWdJSDFjYmk4dklIMHBPMXh1WEc1Y2JseHVMeThnVW1WaFkzUkVUMDB1Y21WdVpHVnlLRnh1THk4Z0lDQThUV0ZwYmtOdmJuUmxiblFnTHo0c0lGeHVMeThnSUNCa2IyTjFiV1Z1ZEM1blpYUkZiR1Z0Wlc1MFFubEpaQ2hjSW1Gd2NDMWpiMjUwWVdsdVpYSmNJaWxjYmk4dklDazdJbDE5In0=
