import React, { Suspense } from 'react';

const LazyPost = React.lazy(() => import('./Postprocessing.js'));

export function PostprocessingLazy(): React.ReactElement {
  return (
    <Suspense fallback={null}>
      <LazyPost enabled={true} />
    </Suspense>
  );
}

export default PostprocessingLazy;
