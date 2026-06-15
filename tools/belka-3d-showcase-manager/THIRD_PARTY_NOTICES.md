# Third-Party Notices

This repository contains a prebuilt browser runtime and decoder files from
third-party open-source projects. Their original licenses remain in effect.

## three.js 0.184.0

- Upstream: https://github.com/mrdoob/three.js
- License: MIT
- Used in: `shared/viewer.bundle.min.js`
- License text: `LICENSES/three.js-MIT.txt`

The bundle includes three.js core and selected addons such as OrbitControls,
GLTFLoader, DRACOLoader, OBJLoader, MTLLoader, STLLoader, PLYLoader, and
RoomEnvironment.

## meshoptimizer 1.1 decoder

- Upstream: https://github.com/zeux/meshoptimizer
- License: MIT
- Used in: `shared/viewer.bundle.min.js`
- License text: `LICENSES/meshoptimizer-MIT.txt`

The bundled Meshopt decoder source identifies itself as meshoptimizer 1.1.

## Google Draco decoder

- Upstream: https://github.com/google/draco
- License: Apache License 2.0
- Used in:
  - `shared/vendor/draco/gltf/draco_decoder.js`
  - `shared/vendor/draco/gltf/draco_decoder.wasm`
  - `shared/vendor/draco/gltf/draco_wasm_wrapper.js`
- License text: `LICENSES/draco-Apache-2.0.txt`

The decoder files are redistributed without local source modifications.

## esbuild 0.28.1

- Upstream: https://github.com/evanw/esbuild
- License: MIT
- Role: development-only build dependency
- License text: `LICENSES/esbuild-MIT.txt`

esbuild is not embedded as a runtime component in the deployed website.
