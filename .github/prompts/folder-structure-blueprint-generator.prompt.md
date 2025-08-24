---
description: 'Cookbook: analyze the repository and produce a concise folder-structure blueprint (visual + rules).' 
---

Receipt: "Produce `Project_Folders_Structure_Blueprint.md` summarizing detected project type(s), key directories, file placement patterns, naming conventions, and a small visualization (tree or markdown list)."

Plan:
- Auto-detect primary tech (Node/React/.NET/Python) from repo files; if ambiguous, list candidates.
- Produce a short Structural Overview, Directory Visualization (depth 2–3), Key Directory Analysis (purpose + patterns), File Placement Rules, and Templates for adding new features.
- Output a compact markdown file and a optional JSON summary for automation.

Assumptions:
- Keep blueprint concise (prefer < 1000 words); avoid exhaustive per-language sections unless requested.
- Exclude generated folders (node_modules, dist, obj) by default.

One-line template:
"Generate folder blueprint → Project_Folders_Structure_Blueprint.md with Overview, Tree (depth=3), KeyDirs, FilePatterns, NewFeatureTemplate."

Output example (markdown):
````md
# Project Folder Structure Blueprint

## Overview
- Detected: Node.js + Canvas renderer

## Tree (depth=2)
- src/
  - entities.js
  - simulate.js
- test/

## Key Rules
- Place simulation logic in `src/` and tests in `test/`.
- Docs under `docs/`.

## New Feature Template
- src/features/<feature>/index.js
- tests/features/<feature>.test.js

````

```
  - API documentation placement
  - Internal documentation organization
  - README file distribution" : 
"Document where key file types are located in the project."}

### 5. Naming and Organization Conventions
Document the naming and organizational conventions observed across the project:

- **File Naming Patterns**:
  - Case conventions (PascalCase, camelCase, kebab-case)
  - Prefix and suffix patterns
  - Type indicators in filenames
  
- **Folder Naming Patterns**:
  - Naming conventions for different folder types
  - Hierarchical naming patterns
  - Grouping and categorization conventions
  
- **Namespace/Module Patterns**:
  - How namespaces/modules map to folder structure
  - Import/using statement organization
  - Internal vs. public API separation

- **Organizational Patterns**:
  - Code co-location strategies
  - Feature encapsulation approaches
  - Cross-cutting concern organization

### 6. Navigation and Development Workflow
Provide guidance for navigating and working with the codebase structure:

- **Entry Points**:
  - Main application entry points
  - Key configuration starting points
  - Initial files for understanding the project

- **Common Development Tasks**:
  - Where to add new features
  - How to extend existing functionality
  - Where to place new tests
  - Configuration modification locations
  
- **Dependency Patterns**:
  - How dependencies flow between folders
  - Import/reference patterns
  - Dependency injection registration locations

${INCLUDE_FILE_COUNTS ? 
"- **Content Statistics**:
  - Files per directory analysis
  - Code distribution metrics
  - Complexity concentration areas" : ""}

### 7. Build and Output Organization
Document the build process and output organization:

- **Build Configuration**:
  - Build script locations and purposes
  - Build pipeline organization
  - Build task definitions
  
- **Output Structure**:
  - Compiled/built output locations
  - Output organization patterns
  - Distribution package structure
  
- **Environment-Specific Builds**:
  - Development vs. production differences
  - Environment configuration strategies
  - Build variant organization

### 8. Technology-Specific Organization

${(PROJECT_TYPE == ".NET" || PROJECT_TYPE == "Auto-detect") ? 
"#### .NET-Specific Structure Patterns (if detected)

- **Project File Organization**:
  - Project file structure and patterns
  - Target framework configuration
  - Property group organization
  - Item group patterns
  
- **Assembly Organization**:
  - Assembly naming patterns
  - Multi-assembly architecture
  - Assembly reference patterns
  
- **Resource Organization**:
  - Embedded resource patterns
  - Localization file structure
  - Static web asset organization
  
- **Package Management**:
  - NuGet configuration locations
  - Package reference organization
  - Package version management" : ""}

${(PROJECT_TYPE == "Java" || PROJECT_TYPE == "Auto-detect") ? 
"#### Java-Specific Structure Patterns (if detected)

- **Package Hierarchy**:
  - Package naming and nesting conventions
  - Domain vs. technical packages
  - Visibility and access patterns
  
- **Build Tool Organization**:
  - Maven/Gradle structure patterns
  - Module organization
  - Plugin configuration patterns
  
- **Resource Organization**:
  - Resource folder structures
  - Environment-specific resources
  - Properties file organization" : ""}

${(PROJECT_TYPE == "Node.js" || PROJECT_TYPE == "Auto-detect") ? 
"#### Node.js-Specific Structure Patterns (if detected)

- **Module Organization**:
  - CommonJS vs. ESM organization
  - Internal module patterns
  - Third-party dependency management
  
- **Script Organization**:
  - npm/yarn script definition patterns
  - Utility script locations
  - Development tool scripts
  
- **Configuration Management**:
  - Configuration file locations
  - Environment variable management
  - Secret management approaches" : ""}

### 9. Extension and Evolution
Document how the project structure is designed to be extended:

- **Extension Points**:
  - How to add new modules/features while maintaining conventions
  - Plugin/extension folder patterns
  - Customization directory structures
  
- **Scalability Patterns**:
  - How the structure scales for larger features
  - Approach for breaking down large modules
  - Code splitting strategies
  
- **Refactoring Patterns**:
  - Common refactoring approaches observed
  - How structural changes are managed
  - Incremental reorganization patterns

${INCLUDE_TEMPLATES ? 
"### 10. Structure Templates

Provide templates for creating new components that follow project conventions:

- **New Feature Template**:
  - Folder structure for adding a complete feature
  - Required file types and their locations
  - Naming patterns to follow
  
- **New Component Template**:
  - Directory structure for a typical component
  - Essential files to include
  - Integration points with existing structure
  
- **New Service Template**:
  - Structure for adding a new service
  - Interface and implementation placement
  - Configuration and registration patterns
  
- **New Test Structure**:
  - Folder structure for test projects/files
  - Test file organization templates
  - Test resource organization" : ""}

### ${INCLUDE_TEMPLATES ? "11" : "10"}. Structure Enforcement

Document how the project structure is maintained and enforced:

- **Structure Validation**:
  - Tools/scripts that enforce structure
  - Build checks for structural compliance
  - Linting rules related to structure
  
- **Documentation Practices**:
  - How structural changes are documented
  - Where architectural decisions are recorded
  - Structure evolution history

Include a section at the end about maintaining this blueprint and when it was last updated.
"
