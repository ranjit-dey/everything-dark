# Build a Universal Theme Engine for a Chrome Extension

## Objective

Build a high-quality universal theme engine for a Chrome extension that allows users to change the appearance of virtually any website.

The extension should support light mode, dark mode, custom themes, custom accent colors, contrast adjustments, and automatic theme switching.

The primary goal is to preserve the original design, layout, readability, and functionality of websites while adapting their colors to the selected theme.

## Core Architecture

Use a modular, maintainable architecture with the following components:

* **Theme Manager:** Manages theme selection, settings, persistence, and per-site preferences.
* **Color Engine:** Converts, classifies, and maps colors based on semantic roles.
* **CSS Override Engine:** Applies theme variables and CSS overrides to websites.
* **DOM Transformation Engine:** Handles websites without usable CSS design tokens.
* **Mutation Observer:** Detects newly inserted elements and dynamically updated content.
* **Protection Layer:** Excludes images, videos, logos, media, and other elements that should not be recolored.
* **Site Adapter:** Provides optional website-specific rules for complex websites.
* **Settings Storage:** Stores global and per-domain settings using Chrome extension storage.

Keep the modules independent and avoid coupling the popup UI directly to the content script's styling logic.

## Theme Modes

Implement these modes:

1. Light
2. Dark
3. System
4. Automatic based on time
5. Custom

Support user-defined color palettes and custom accent colors.

## Color Engine

Implement semantic color classification instead of simple RGB inversion.

Classify colors into roles such as:

* Primary background
* Secondary background
* Elevated surface
* Primary text
* Secondary text
* Muted text
* Borders
* Links
* Buttons
* Success
* Warning
* Error
* Selection
* Focus indicators

Use appropriate transformations based on color lightness, saturation, hue, and contrast.

Preserve semantic colors where possible. For example, errors should remain recognizable as errors, and success indicators should retain their green identity.

Use a reliable color-space model such as OKLCH or HSL for transformations where suitable.

## CSS Override Strategy

Prioritize existing website CSS variables and design tokens.

When a website has variables such as `--background`, `--foreground`, `--surface`, or `--border`, map the extension's semantic tokens to the existing design system when safe.

For websites without useful variables, apply fallback styling to computed background colors, text colors, border colors, outlines, and relevant form controls.

Use a namespaced stylesheet and avoid broad, destructive overrides.

Do not indiscriminately override every property or use `!important` everywhere.

Ensure the engine can restore the original website appearance when the theme is disabled or changed.

## Dynamic DOM Handling

Use MutationObserver to support modern dynamic websites.

Handle:

* Elements added after initial rendering
* Content changes in single-page applications
* Lazy-loaded components
* Dynamically created modals and menus
* Theme changes while a page remains open

Avoid repeatedly processing the same elements.

Use an efficient scheduling strategy for DOM updates and avoid unnecessary full-page recalculations.

Ensure that the transformation pipeline is idempotent.

## Protected Elements

By default, do not alter:

* Images
* Videos
* Canvas content
* Embedded documents
* Brand logos
* Photographs
* Background images
* Third-party embedded content

Handle SVG icons carefully. Allow icons that inherit `currentColor` to adapt naturally while preserving the original colors of multicolored SVGs.

Provide a configurable option for advanced users to override selected protections.

## Accessibility

Ensure that:

* Text remains readable against its background.
* Interactive controls have distinguishable states.
* Focus indicators remain visible.
* Links are visually distinguishable.
* Contrast adjustments do not destroy semantic meaning.
* Keyboard navigation and native form behavior continue working.

Include a contrast adjustment option.

## Per-Site Customization

Allow users to:

* Enable or disable themes for individual domains.
* Choose different themes for different websites.
* Set custom accent colors.
* Exclude selected CSS selectors from transformation.
* Reset site-specific settings.
* Use a website's native theme.

Per-site preferences should override global settings.

## Performance

Optimize for websites with large DOM trees.

Avoid expensive repeated getComputedStyle calls.

Use caching where safe, batch updates, and process only affected elements.

Prevent mutation observer loops caused by the extension's own changes.

Avoid causing layout shifts and unnecessary repaints.

## Browser Extension Requirements

Use Chrome Manifest V3.

Use content scripts for page-level transformations.

Use extension messaging to communicate theme changes between the popup, background service worker, and content scripts.

Use chrome.storage.sync or chrome.storage.local appropriately.

Follow the principle of least privilege. Request only the permissions needed for the extension's features.

Do not execute remote scripts or inject arbitrary remote code.

## User Interface

The extension popup should be compact and follow Chrome's native design conventions.

Include:

* Theme toggle
* Theme mode selector
* Accent color picker
* Contrast adjustment
* Per-site enable/disable control
* Quick access to advanced settings

Support both light and dark appearances in the popup.

Keep the interface simple and avoid unnecessary visual complexity.

## Reliability and Testing

Test the engine on:

* Simple static HTML websites
* Websites using CSS variables
* React and Next.js applications
* Websites with dynamic content
* Websites with native dark mode
* Websites with complex forms and interactive controls
* Websites with image-heavy layouts
* Websites with nested components and shadow DOM

Document known limitations, especially around closed shadow roots, cross-origin iframes, canvas rendering, and websites that use highly customized styling.

## Implementation Priority

Build the project incrementally.

Phase 1: Implement the theme manager, settings storage, and basic CSS-variable overrides.

Phase 2: Implement semantic color transformation and the fallback DOM engine.

Phase 3: Add dynamic content support and performance optimization.

Phase 4: Add protected elements, site-specific settings, and advanced customization.

Phase 5: Test across different website architectures, improve accessibility, and refine edge cases.

Do not claim universal compatibility without testing. Prioritize predictable behavior, easy rollback, and consistent color rendering over aggressive recoloring.

Before implementing, inspect the existing project structure and reuse its current stack, components, and conventions. Do not rewrite unrelated parts of the extension.
