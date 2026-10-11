# styles/ - Application Styling

CSS stylesheets for the application UI and layout.

## Style Files

| File                | Purpose                                                      |
| ------------------- | ------------------------------------------------------------ |
| **app.css**         | Entry point; `@import`s the partials below in cascade order  |
| **variables.css**   | `:root` variables, app shell, scene canvas, loading overlay  |
| **hud.css**         | HUD, health layers, ship HUD overlay, health fallback        |
| **hud-drawer.css**  | HUD panel, panel header/actions, toggle drawer               |
| **progress.css**    | Panel headings, subtitle, team grid/cards, stat and progress |
| **ai-debug.css**    | AI debug overlay panels and hint text                        |
| **controls.css**    | Controls bar and its controls                                |
| **progression.css** | Progression panel and ship progression cards                 |
| **responsive.css**  | Responsive adjustments for smaller screens (Mobile/Tablet)   |

`app.css` contains only `@import` statements; Vite inlines the local imports
in order at build time, so the final cascade is unchanged.

## Styling Organization

The application uses:

- CSS for global and component layout
- Component-scoped CSS files (e.g., `progression-panel.css`)
- CSS variables for theming
- Responsive design patterns

## CSS Scope

CSS files are organized:

- Global styles split across `app.css` and its imported partials
- Component styles colocated with components
- Debug panel styles in `debug/debugPanel.css`
- Post-processing styles as needed

## Design System

The styling follows:

- Space combat game aesthetic
- Dark space theme
- Glowing/neon effects
- Responsive to different screen sizes

## Integration

- Imported by React components
- Applied to DOM elements
- Uses Three.js canvas for 3D rendering
- CSS provides shell and UI container styling
