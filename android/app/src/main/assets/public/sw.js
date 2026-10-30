/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-7e5eb42b'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "index.html",
    "revision": "ead8fdb08624868ee7d1ea1976717f73"
  }, {
    "url": "icon.png",
    "revision": "7ec2dc223ecab4bb02b0f207e42cd101"
  }, {
    "url": "Gym-Lift-Track_Icon.png",
    "revision": "7ec2dc223ecab4bb02b0f207e42cd101"
  }, {
    "url": "draco/draco_wasm_wrapper.js",
    "revision": "5900efaec20d6859eb66417fedb1acb4"
  }, {
    "url": "draco/draco_encoder.js",
    "revision": "19ec7d67f4a209ec8b5fa0a7e0055226"
  }, {
    "url": "draco/draco_decoder.js",
    "revision": "69b56a1d86b226ea41399f572eccc9ce"
  }, {
    "url": "draco/gltf/draco_wasm_wrapper.js",
    "revision": "7a48a3fdc5785631621f4b20cd0937dc"
  }, {
    "url": "draco/gltf/draco_encoder.js",
    "revision": "b3c687f18f58015e032d5d4b5c5c33e8"
  }, {
    "url": "draco/gltf/draco_decoder.js",
    "revision": "5fcad04db3893d9fbb79418b1f8e44a1"
  }, {
    "url": "assets/workbox-window.prod.es5-BBnX5xw4.js",
    "revision": null
  }, {
    "url": "assets/web-g1eIcCe7.js",
    "revision": null
  }, {
    "url": "assets/web-COCbs9fL.js",
    "revision": null
  }, {
    "url": "assets/index-DiLvBRQG.css",
    "revision": null
  }, {
    "url": "assets/index-BJ3qvTA7.js",
    "revision": null
  }, {
    "url": "Gym-Lift-Track_Icon.png",
    "revision": "7ec2dc223ecab4bb02b0f207e42cd101"
  }, {
    "url": "manifest.webmanifest",
    "revision": "eda0157891a92f141537d107a1cc4341"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));

}));
