# svg_loader_api

```
// SVG Loader with change detection and caching
// Handles loading SVG files, detecting changes, and rasterizing to ImageBitmap

import type { GameState } from '../types/index.js';
import { getFileWatcher, watchSVGFiles, unwatchSVGFiles } from '../utils/fileWatcher.js';
import * as logger from '../utils/logger.js';

export interface SVGAsset {
  url: string;
  svgText: string;
  lastModified: number;
  imageBitmap?: ImageBitmap;
}

export interface SVGLoadOptions {
  width?: number;
  height?: number;
  teamColor?: string;
  forceReload?: boolean;
  enableWatching?: boolean;
```

> Auto-generated stub — please review and expand.
