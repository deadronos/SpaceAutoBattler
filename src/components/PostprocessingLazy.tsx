import React, { Suspense } from 'react';

const LazyPost = React.lazy(() => import('./Postprocessing.js'));

/**
 * Lazy-loaded wrapper for the Postprocessing component.
 * Used to split the bundle and load heavy post-processing effects on demand.
 *
 * @returns {React.ReactElement} The lazy-loaded component suspended with a null fallback.
 */
export function PostprocessingLazy(): React.ReactElement {
  return (
    <Suspense fallback={null}>
      <LazyPost enabled={true} />
    </Suspense>
  );
}

export default PostprocessingLazy;
