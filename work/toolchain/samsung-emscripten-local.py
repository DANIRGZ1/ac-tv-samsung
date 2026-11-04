import os
_BASE = os.path.dirname(os.path.abspath(__file__))
_SDK = os.path.join(_BASE, 'samsung-emscripten', 'emscripten-release-bundle', 'emsdk')
EMSCRIPTEN_ROOT = os.path.join(_SDK, 'fastcomp', 'emscripten')
LLVM_ROOT = os.path.join(_SDK, 'fastcomp', 'fastcomp', 'bin')
BINARYEN_ROOT = os.path.join(_SDK, 'fastcomp')
NODE_JS = os.path.join(_SDK, 'node', '12.9.1_64bit', 'bin', 'node.exe')
TEMP_DIR = os.path.join(_BASE, 'em-temp')
COMPILER_ENGINE = NODE_JS
JS_ENGINES = [NODE_JS]
