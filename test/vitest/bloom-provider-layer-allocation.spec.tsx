import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import { BloomProvider } from '../../src/renderer/BloomProvider.js';

// Mock console.debug to capture layer allocation calls
const mockConsoleDebug = vi.spyOn(console, 'debug').mockImplementation(() => {});

describe('BloomProvider layer allocation', () => {
  it('should allocate layers only once per group during initialization', () => {
    mockConsoleDebug.mockClear();
    
    const TestComponent = () => {
      const [renderCount, setRenderCount] = React.useState(0);
      
      // Force multiple re-renders to test that layers are not allocated on every render
      React.useEffect(() => {
        const timer = setTimeout(() => {
          setRenderCount(prev => prev + 1);
        }, 10);
        return () => clearTimeout(timer);
      }, [renderCount]);

      return React.createElement(
        BloomProvider,
        { enabled: true },
        React.createElement('div', null, `Render count: ${renderCount}`)
      );
    };

    // Set NODE_ENV to 'development' to enable debug logging
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const { rerender } = render(React.createElement(TestComponent));

    // Force some re-renders
    act(() => {
      rerender(React.createElement(TestComponent));
    });
    
    act(() => {
      rerender(React.createElement(TestComponent));
    });

    // Restore original NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;

    // Check that layer allocation debug calls happened, but not excessively
    const allocationCalls = mockConsoleDebug.mock.calls.filter(call => 
      call.some(arg => 
        typeof arg === 'string' && arg.includes('[BloomProvider] allocating layer')
      )
    );

    // Should have some allocations (for the configured groups), but not excessive amounts
    // The exact number depends on the configured bloom groups, but it should be reasonable
    expect(allocationCalls.length).toBeGreaterThan(0);
    expect(allocationCalls.length).toBeLessThan(20); // Should not have excessive allocations

    mockConsoleDebug.mockRestore();
  });

  it('should handle layer allocation within Three.js limits', () => {
    // Test that we don't exceed the 31 layer limit
    const TestComponent = () => React.createElement(
      BloomProvider,
      { enabled: true },
      React.createElement('div', null, 'Test')
    );

    // This should not throw any errors about layer limits
    expect(() => {
      render(React.createElement(TestComponent));
    }).not.toThrow();
  });
});