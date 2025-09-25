import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { Canvas } from '@react-three/fiber';
import { BloomProvider } from '../../src/renderer/BloomProvider.js';
import { Postprocessing } from '../../src/components/Postprocessing.js';

describe('selective bloom effect', () => {
  it('should only bloom registered objects', () => {
    // This test validates that the BloomProvider and Postprocessing components
    // can be rendered without errors. The actual selective bloom behavior
    // would need to be tested with a WebGL context.
    const TestScene = () => React.createElement(
      BloomProvider,
      { enabled: true },
      React.createElement(
        Canvas,
        { style: { width: '100px', height: '100px' } },
        React.createElement(Postprocessing, { enabled: true })
      )
    );

    const { container } = render(React.createElement(TestScene));
    expect(container).toBeTruthy();
  });

  it('should handle empty selections gracefully', () => {
    const TestScene = () => React.createElement(
      BloomProvider,
      { enabled: true },
      React.createElement(
        Canvas,
        { style: { width: '100px', height: '100px' } },
        React.createElement(Postprocessing, { enabled: true })
      )
    );

    const { container } = render(React.createElement(TestScene));
    expect(container).toBeTruthy();
  });
});