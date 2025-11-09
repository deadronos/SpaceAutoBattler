# styles/ - Application Styling

CSS stylesheets for the application UI and layout.

## Style Files

| File | Purpose |
|------|---------|
| **app.css** | Main application styling (layout, theme, global styles) |

## Styling Organization

The application uses:
- CSS for global and component layout
- Component-scoped CSS files (e.g., `progression-panel.css`)
- CSS variables for theming
- Responsive design patterns

## CSS Scope

CSS files are organized:
- Global styles in `app.css`
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
