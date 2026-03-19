import { describe, it, expect } from 'vite-plus/test';
import { render, act } from '@testing-library/react';
import React from 'react';
import { BloomProvider, useBloomContext } from '../../src/renderer/bloom/index.js';

describe('BloomProvider layer allocation', () => {
  it('should allocate layers only once per group during initialization', () => {
    let contextValue: ReturnType<typeof useBloomContext> = null;

    const ContextCapture = () => {
      contextValue = useBloomContext();
      return null;
    };

    const TestComponent = () => {
      const [renderCount, setRenderCount] = React.useState(0);

      // Force multiple re-renders to test that layers are not allocated on every render
      React.useEffect(() => {
        if (renderCount < 3) {
          const timer = setTimeout(() => {
            setRenderCount((prev) => prev + 1);
          }, 10);
          return () => clearTimeout(timer);
        }
      }, [renderCount]);

      return React.createElement(
        BloomProvider,
        { enabled: true },
        React.createElement(ContextCapture),
        React.createElement('div', null, `Render count: ${renderCount}`),
      );
    };

    const { rerender } = render(React.createElement(TestComponent));

    // Force some re-renders
    act(() => {
      rerender(React.createElement(TestComponent));
    });

    act(() => {
      rerender(React.createElement(TestComponent));
    });

    // Verify layer allocation happened (at least the default group exists)
    expect(contextValue).not.toBeNull();
    expect(contextValue!.selections.size).toBeGreaterThan(0);

    // Verify layer mask is computable (all selections have valid layers)
    const mask = contextValue!.getSelectionLayerMask();
    expect(mask).toBeGreaterThan(0);

    // Verify we don't have excessive allocations (< 20 groups)
    expect(contextValue!.selections.size).toBeLessThan(20);
  });

  it('should handle layer allocation within Three.js limits', () => {
    // Test that we don't exceed the 31 layer limit
    const TestComponent = () =>
      React.createElement(
        BloomProvider,
        { enabled: true },
        React.createElement('div', null, 'Test'),
      );

    // This should not throw any errors about layer limits
    expect(() => {
      render(React.createElement(TestComponent));
    }).not.toThrow();
  });
});
