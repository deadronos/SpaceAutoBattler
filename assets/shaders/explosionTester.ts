/**
 * Explosion Effect Test Suite
 * 
 * Development utility for technical artists to test explosion effects,
 * textures, and shader parameters in real-time.
 * 
 * Features:
 * - Live parameter adjustment
 * - Texture hot-swapping
 * - Color scheme testing
 * - Performance monitoring
 * - Visual comparison tools
 */

export interface ExplosionTestConfig {
  // Effect parameters
  particleCount: number;
  lifetime: number;
  size: { min: number; max: number };
  velocity: { min: number; max: number };
  
  // Visual parameters
  colors: string[];
  fadeInDuration: number;
  fadeOutStart: number;
  softEdgePower: number;
  
  // Test parameters
  spawnRate: number;      // Explosions per second
  testDuration: number;   // How long to run test
  showStats: boolean;     // Show performance stats
}

export class ExplosionTester {
  private gameState: any;
  private testContainer: HTMLElement;
  private controls: HTMLElement;
  private statsDisplay: HTMLElement;
  private isRunning = false;
  private testInterval?: number;
  private stats = { explosions: 0, particles: 0, fps: 0 };

  constructor(gameState: any) {
    this.gameState = gameState;
    this.setupUI();
  }

  /**
   * Create test UI for parameter adjustment
   */
  private setupUI() {
    // Create container
    this.testContainer = document.createElement('div');
    this.testContainer.id = 'explosion-tester';
    this.testContainer.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: 300px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 15px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      z-index: 1000;
      max-height: 80vh;
      overflow-y: auto;
    `;

    // Title
    const title = document.createElement('h3');
    title.textContent = 'Explosion Tester';
    title.style.cssText = 'margin: 0 0 10px 0; color: #00ff00;';
    this.testContainer.appendChild(title);

    // Controls container
    this.controls = document.createElement('div');
    this.testContainer.appendChild(this.controls);

    // Stats display
    this.statsDisplay = document.createElement('div');
    this.statsDisplay.style.cssText = 'margin-top: 10px; padding-top: 10px; border-top: 1px solid #333;';
    this.testContainer.appendChild(this.statsDisplay);

    // Add to document
    document.body.appendChild(this.testContainer);

    this.setupControls();
  }

  /**
   * Setup interactive controls
   */
  private setupControls() {
    // Preset selector
    this.addControl('Preset', 'select', 'fire', {
      fire: 'Fire Explosion',
      electric: 'Electric Explosion', 
      plasma: 'Plasma Explosion',
      toxic: 'Toxic Gas',
      smoke: 'Smoke Cloud'
    }, (value) => this.loadPreset(value));

    // Color controls
    this.addControl('Color 1 (Birth)', 'color', '#fffbda');
    this.addControl('Color 2 (Mid-life)', 'color', '#ff8c00');
    this.addControl('Color 3 (Death)', 'color', '#440000');

    // Timing controls
    this.addControl('Lifetime', 'range', 1.2, { min: 0.1, max: 5.0, step: 0.1 });
    this.addControl('Fade In', 'range', 0.1, { min: 0.0, max: 1.0, step: 0.05 });
    this.addControl('Fade Out Start', 'range', 0.7, { min: 0.0, max: 1.0, step: 0.05 });

    // Size controls
    this.addControl('Min Size', 'range', 0.02, { min: 0.01, max: 1.0, step: 0.01 });
    this.addControl('Max Size', 'range', 0.25, { min: 0.01, max: 1.0, step: 0.01 });

    // Particle controls
    this.addControl('Particle Count', 'range', 18, { min: 5, max: 50, step: 1 });
    this.addControl('Velocity Min', 'range', 40, { min: 0, max: 500, step: 10 });
    this.addControl('Velocity Max', 'range', 240, { min: 0, max: 500, step: 10 });

    // Shader controls
    this.addControl('Soft Edge Power', 'range', 2.2, { min: 1.0, max: 5.0, step: 0.1 });
    this.addControl('Color Intensity', 'range', 1.2, { min: 0.1, max: 3.0, step: 0.1 });

    // Test controls
    this.addSeparator();
    this.addControl('Test Radius', 'range', 25, { min: 5, max: 100, step: 5 });
    this.addControl('Spawn Rate', 'range', 1, { min: 0.1, max: 10, step: 0.1 });

    // Action buttons
    this.addButton('Single Test', () => this.fireSingleExplosion());
    this.addButton('Start Continuous', () => this.startContinuousTest());
    this.addButton('Stop Test', () => this.stopTest());
    this.addButton('Clear All', () => this.clearAll());

    // Texture testing
    this.addSeparator();
    this.addFileInput('Load Texture', (file) => this.loadCustomTexture(file));
    this.addButton('Generate Soft Circle', () => this.generateTestTexture());

    // Export/Import
    this.addSeparator();
    this.addButton('Export Config', () => this.exportConfig());
    this.addFileInput('Import Config', (file) => this.importConfig(file));
  }

  /**
   * Add a control element
   */
  private addControl(
    label: string, 
    type: string, 
    defaultValue: any,
    options: any = {},
    callback?: (value: any) => void
  ) {
    const container = document.createElement('div');
    container.style.cssText = 'margin-bottom: 8px;';

    const labelEl = document.createElement('label');
    labelEl.textContent = label + ':';
    labelEl.style.cssText = 'display: block; margin-bottom: 2px; font-size: 11px;';
    container.appendChild(labelEl);

    let input: HTMLInputElement | HTMLSelectElement;

    if (type === 'select') {
      input = document.createElement('select');
      for (const [value, text] of Object.entries(options)) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text as string;
        input.appendChild(option);
      }
    } else {
      input = document.createElement('input');
      input.type = type;
      
      if (type === 'range') {
        input.min = options.min?.toString() || '0';
        input.max = options.max?.toString() || '100';
        input.step = options.step?.toString() || '1';
      }
    }

    input.value = defaultValue.toString();
    input.style.cssText = 'width: 100%; padding: 2px; background: #333; color: white; border: 1px solid #666;';
    
    // Add value display for ranges
    let valueDisplay: HTMLSpanElement | undefined;
    if (type === 'range') {
      valueDisplay = document.createElement('span');
      valueDisplay.style.cssText = 'margin-left: 5px; font-size: 10px; color: #aaa;';
      valueDisplay.textContent = defaultValue.toString();
    }

    input.addEventListener('input', () => {
      if (valueDisplay) {
        valueDisplay.textContent = input.value;
      }
      if (callback) {
        callback(input.value);
      }
      this.onParameterChange();
    });

    container.appendChild(input);
    if (valueDisplay) {
      container.appendChild(valueDisplay);
    }
    
    this.controls.appendChild(container);

    // Store reference for later access
    (input as any).controlName = label;
  }

  /**
   * Add action button
   */
  private addButton(text: string, callback: () => void) {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.cssText = `
      width: 100%;
      padding: 5px;
      margin: 2px 0;
      background: #444;
      color: white;
      border: 1px solid #666;
      border-radius: 3px;
      cursor: pointer;
    `;
    
    button.addEventListener('click', callback);
    this.controls.appendChild(button);
  }

  /**
   * Add file input
   */
  private addFileInput(label: string, callback: (file: File) => void) {
    const container = document.createElement('div');
    container.style.cssText = 'margin-bottom: 8px;';

    const labelEl = document.createElement('label');
    labelEl.textContent = label + ':';
    labelEl.style.cssText = 'display: block; margin-bottom: 2px; font-size: 11px;';
    container.appendChild(labelEl);

    const input = document.createElement('input');
    input.type = 'file';
    input.style.cssText = 'width: 100%; padding: 2px; background: #333; color: white; border: 1px solid #666;';
    
    input.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) callback(file);
    });

    container.appendChild(input);
    this.controls.appendChild(container);
  }

  /**
   * Add visual separator
   */
  private addSeparator() {
    const separator = document.createElement('div');
    separator.style.cssText = 'height: 1px; background: #666; margin: 10px 0;';
    this.controls.appendChild(separator);
  }

  /**
   * Load preset configuration
   */
  private loadPreset(preset: string) {
    const presets = {
      fire: {
        colors: ['#fffbda', '#ff8c00', '#440000'],
        lifetime: 1.2,
        fadeIn: 0.1,
        fadeOut: 0.7,
        particles: 18,
        softEdge: 2.2
      },
      electric: {
        colors: ['#ffffff', '#00ffff', '#0044ff'],
        lifetime: 0.8,
        fadeIn: 0.05,
        fadeOut: 0.8,
        particles: 15,
        softEdge: 3.5
      },
      plasma: {
        colors: ['#ff00ff', '#8000ff', '#1a0033'],
        lifetime: 1.5,
        fadeIn: 0.15,
        fadeOut: 0.6,
        particles: 25,
        softEdge: 1.8
      },
      toxic: {
        colors: ['#ccff00', '#00cc00', '#003311'],
        lifetime: 2.5,
        fadeIn: 0.2,
        fadeOut: 0.5,
        particles: 30,
        softEdge: 1.5
      },
      smoke: {
        colors: ['#bbbbbb', '#777777', '#111111'],
        lifetime: 3.0,
        fadeIn: 0.3,
        fadeOut: 0.4,
        particles: 35,
        softEdge: 1.2
      }
    };

    const config = presets[preset as keyof typeof presets];
    if (config) {
      this.setControlValue('Color 1 (Birth)', config.colors[0]);
      this.setControlValue('Color 2 (Mid-life)', config.colors[1]);
      this.setControlValue('Color 3 (Death)', config.colors[2]);
      this.setControlValue('Lifetime', config.lifetime);
      this.setControlValue('Fade In', config.fadeIn);
      this.setControlValue('Fade Out Start', config.fadeOut);
      this.setControlValue('Particle Count', config.particles);
      this.setControlValue('Soft Edge Power', config.softEdge);
    }
  }

  /**
   * Fire single test explosion
   */
  private fireSingleExplosion() {
    const config = this.getCurrentConfig();
    
    // Use particle system API
    if (typeof addParticleExplosion !== 'undefined') {
      (window as any).addParticleExplosion(this.gameState, {
        pos: { x: 0, y: 0, z: 0 },
        radius: this.getControlValue('Test Radius'),
        colorOverride: [
          this.getControlValue('Color 1 (Birth)'),
          this.getControlValue('Color 2 (Mid-life)'),
          this.getControlValue('Color 3 (Death)')
        ],
        count: this.getControlValue('Particle Count'),
        lifetime: this.getControlValue('Lifetime')
      });
    }
    
    this.stats.explosions++;
    this.updateStatsDisplay();
  }

  /**
   * Start continuous testing
   */
  private startContinuousTest() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    const rate = this.getControlValue('Spawn Rate');
    const interval = 1000 / rate; // Convert to milliseconds
    
    this.testInterval = window.setInterval(() => {
      this.fireSingleExplosion();
    }, interval);
  }

  /**
   * Stop all testing
   */
  private stopTest() {
    this.isRunning = false;
    if (this.testInterval) {
      clearInterval(this.testInterval);
      this.testInterval = undefined;
    }
  }

  /**
   * Clear all active particles
   */
  private clearAll() {
    this.stopTest();
    // Clear particle system if available
    if (this.gameState.particleSystem) {
      this.gameState.particleSystem.clear?.();
    }
    this.stats = { explosions: 0, particles: 0, fps: 0 };
    this.updateStatsDisplay();
  }

  /**
   * Load custom texture file
   */
  private async loadCustomTexture(file: File) {
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      
      img.onload = () => {
        console.log(`Loaded custom texture: ${img.width}x${img.height}`);
        // Apply to next explosion test
        URL.revokeObjectURL(url);
      };
      
      img.src = url;
    } catch (error) {
      console.error('Failed to load texture:', error);
    }
  }

  /**
   * Generate test soft-circle texture
   */
  private generateTestTexture() {
    if (typeof window !== 'undefined' && (window as any).softCircleUtils) {
      const utils = (window as any).softCircleUtils;
      utils.download('test-soft-circle', 'standard');
      console.log('Generated test soft-circle texture');
    } else {
      console.warn('Soft-circle generator not available');
    }
  }

  /**
   * Export current configuration
   */
  private exportConfig() {
    const config = this.getCurrentConfig();
    const json = JSON.stringify(config, null, 2);
    
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'explosion-config.json';
    link.click();
    
    URL.revokeObjectURL(url);
  }

  /**
   * Import configuration from file
   */
  private async importConfig(file: File) {
    try {
      const text = await file.text();
      const config = JSON.parse(text);
      
      // Apply configuration to controls
      for (const [key, value] of Object.entries(config)) {
        this.setControlValue(key, value);
      }
      
      console.log('Imported configuration:', config);
    } catch (error) {
      console.error('Failed to import config:', error);
    }
  }

  /**
   * Get current configuration from controls
   */
  private getCurrentConfig(): ExplosionTestConfig {
    return {
      particleCount: this.getControlValue('Particle Count'),
      lifetime: this.getControlValue('Lifetime'),
      size: {
        min: this.getControlValue('Min Size'),
        max: this.getControlValue('Max Size')
      },
      velocity: {
        min: this.getControlValue('Velocity Min'),
        max: this.getControlValue('Velocity Max')
      },
      colors: [
        this.getControlValue('Color 1 (Birth)'),
        this.getControlValue('Color 2 (Mid-life)'),
        this.getControlValue('Color 3 (Death)')
      ],
      fadeInDuration: this.getControlValue('Fade In'),
      fadeOutStart: this.getControlValue('Fade Out Start'),
      softEdgePower: this.getControlValue('Soft Edge Power'),
      spawnRate: this.getControlValue('Spawn Rate'),
      testDuration: 10, // Default
      showStats: true
    };
  }

  /**
   * Get control value by name
   */
  private getControlValue(name: string): any {
    const input = Array.from(this.controls.querySelectorAll('input, select'))
      .find(el => (el as any).controlName === name) as HTMLInputElement;
    
    if (input) {
      const value = input.value;
      return input.type === 'range' || input.type === 'number' ? parseFloat(value) : value;
    }
    
    return null;
  }

  /**
   * Set control value by name
   */
  private setControlValue(name: string, value: any) {
    const input = Array.from(this.controls.querySelectorAll('input, select'))
      .find(el => (el as any).controlName === name) as HTMLInputElement;
    
    if (input) {
      input.value = value.toString();
      
      // Trigger change event
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  /**
   * Handle parameter changes
   */
  private onParameterChange() {
    // Update any live preview if available
    if (this.isRunning) {
      // Restart with new parameters
      this.stopTest();
      this.startContinuousTest();
    }
  }

  /**
   * Update statistics display
   */
  private updateStatsDisplay() {
    this.statsDisplay.innerHTML = `
      <div style="font-size: 11px;">
        <div>Explosions Fired: ${this.stats.explosions}</div>
        <div>Active Particles: ${this.stats.particles}</div>
        <div>FPS: ${this.stats.fps}</div>
        <div>Status: ${this.isRunning ? 'Running' : 'Stopped'}</div>
      </div>
    `;
  }

  /**
   * Show/hide the tester UI
   */
  public toggle() {
    this.testContainer.style.display = 
      this.testContainer.style.display === 'none' ? 'block' : 'none';
  }

  /**
   * Cleanup
   */
  public destroy() {
    this.stopTest();
    if (this.testContainer.parentNode) {
      this.testContainer.parentNode.removeChild(this.testContainer);
    }
  }
}

/**
 * Initialize explosion tester (development only)
 */
export function createExplosionTester(gameState: any): ExplosionTester {
  return new ExplosionTester(gameState);
}

/**
 * Keyboard shortcut setup
 */
export function setupTestKeyBinds(tester: ExplosionTester) {
  document.addEventListener('keydown', (e) => {
    // Only in development mode
    if (!window.location.search.includes('dev=1')) return;
    
    switch (e.key) {
      case 'F1':
        e.preventDefault();
        tester.toggle();
        break;
      case 'e':
      case 'E':
        if (!e.ctrlKey && !e.altKey) {
          e.preventDefault();
          tester.fireSingleExplosion();
        }
        break;
    }
  });
}

// Export for browser console access
if (typeof window !== 'undefined') {
  (window as any).ExplosionTester = ExplosionTester;
  (window as any).createExplosionTester = createExplosionTester;
}