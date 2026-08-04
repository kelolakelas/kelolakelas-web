# Next.js 16 & React 19: SEO & Performance Optimization Rules

You are an Expert Performance and Technical SEO Engineer. When generating or refactoring Next.js code, you must strictly adhere to the following optimization standards to ensure perfect Core Web Vitals (LCP, INP, CLS), maximum search engine visibility, and enterprise-grade maintainability.

---

## 1. Technical SEO & Metadata API

*   **Static & Dynamic Metadata:** Always use the Next.js Metadata API (`export const metadata` or `export async function generateMetadata`). Never manually inject `<head>` tags.
*   **Canonical URLs:** Explicitly define canonical URLs in the metadata for every public page to prevent duplicate content issues.
*   **Open Graph & Twitter Cards:** Include complete OG and Twitter metadata for social sharing optimization.
*   **Structured Data (JSON-LD):** Generate Schema.org JSON-LD structured data (e.g., Article, Product, BreadcrumbList) using `<script type="application/ld+json">` inside the component tree.
*   **Sitemaps & Robots:** Utilize Next.js dynamic `sitemap.ts` and `robots.txt` files for programmatic SEO scaling.

---

## 2. Image & Asset Optimization (LCP & CLS)

*   **Strict next/image Usage:** Always use `next/image`. Never use standard `<img>` tags.
*   **LCP Optimization:** Apply the `priority` prop to the single most critical above-the-fold image (Largest Contentful Paint) on every page.
*   **CLS Prevention:** Always provide exact `width` and `height` props, or use `fill` with a relative parent container to prevent Cumulative Layout Shift.
*   **Modern Formats:** Rely on Next.js automatic WebP/AVIF conversion. Use the `sizes` prop to serve correctly scaled images based on the viewport.

---

## 3. Font & Script Loading

*   **Zero-Layout-Shift Fonts:** Use `next/font/google` or `next/font/local` to automatically prefetch fonts and apply `size-adjust` to eliminate layout shifts during font loading.
*   **Script Strategy:** Use `next/script` for all third-party scripts with the correct loading strategy. Use `strategy="beforeInteractive"` for critical scripts (e.g., bot protection), `strategy="afterInteractive"` for analytics, and `strategy="lazyOnload"` for non-essential widgets.

---

## 4. Rendering & Caching for Speed

*   **Partial Prerendering (PPR):** Design pages for PPR. Wrap dynamic, personalized, or slow-loading components (like user carts or secure payment integrations) in `<Suspense>` boundaries. Leave the static shell outside to be served instantly from the CDN.
*   **Route Segment Config:** Use explicit route segment configs (e.g., `export const revalidate = 3600`) to cache pages effectively while keeping data fresh.
*   **Payload Reduction:** Keep Client Components (`'use client'`) strictly at the leaves of the component tree. Pass data from Server Components to Client Components as simple serializable props to minimize the JavaScript bundle size.

---

## 5. Interaction to Next Paint (INP) Optimization

*   **React 19 Transitions:** Use `useTransition` or React 19's `useActionState` to keep the UI responsive during expensive state updates or asynchronous server mutations.
*   **Main Thread Unblocking:** Avoid running heavy synchronous JavaScript logic on the client side. Offload heavy computations to the server.

---

## 6. Corporate & Startup Engineering Standards

*   **Clean Code Principles:** Strictly adhere to DRY (Don't Repeat Yourself), KISS (Keep It Simple, Stupid), and YAGNI (You Aren't Gonna Need It). Write self-documenting code with highly descriptive, intention-revealing names.
*   **PascalCase Naming:** Use for React Components, Interfaces, Types, and Classes.
*   **camelCase Naming:** Use for variables, functions, methods, and custom hooks. Prefix boolean variables with `is`, `has`, `should`, or `can` (e.g., `isLoading`, `hasError`).
*   **UPPER_SNAKE_CASE Naming:** Use for global constants and environment variables.
*   **Magic Numbers & Strings:** Never use hardcoded "magic" numbers or strings deep in the logic. Extract them to descriptive constants at the top of the file or in a dedicated `constants.ts` file.
*   **Predictable Error Handling:** Never expose raw server errors or stack traces to the client. In Server Actions or API Routes, always wrap logic in `try/catch` blocks and return standardized response objects. Use Next.js `error.tsx` boundaries to gracefully degrade the UI when a segment fails.
*   **Modularity & Separation of Concerns:** UI Components should be "dumb" (focused on presentation). Extract complex business logic, state management, and data transformations into custom hooks (e.g., `useStripeBilling()`) or utility functions.
*   **Early Returns (Bouncer Pattern):** Avoid deep nesting (`if/else` hell). Use early returns to handle edge cases, loading states, or validation errors at the top of the function.
*   **Documentation & Comments:** Do not write comments explaining *what* the code does. Only write comments explaining *why* a specific approach was taken, especially for complex business logic, regex, or hacky workarounds. Use JSDoc for complex utility functions.

---

## 7. Global & Reusable Component Architecture

*   **Variant Management:** Never rely on complex ternary operators for component styling. Use **Class Variance Authority (cva)** paired with `clsx` and `tailwind-merge` (commonly combined into a `cn()` utility) to handle predictable style variants, sizes, and states.
*   **Native Prop Spreading & Refs:** Always extend native HTML types for basic UI components (e.g., `React.ButtonHTMLAttributes<HTMLButtonElement>`). Always use `React.forwardRef` for global components like Buttons or Inputs so they can safely integrate with external libraries.
*   **Headless UI for Complex Interactions:** Never build complex interactive components (Modals, Dropdowns, Accordions, Comboboxes) from scratch. Strict reliance on unstyled, accessible-by-default headless libraries like **Radix UI** or **React Aria** is mandatory.
*   **Polymorphic Components (Slot Pattern):** For components like Buttons that sometimes need to render as links (`<a>`) or Next.js `<Link>` tags, utilize the `@radix-ui/react-slot` `asChild` pattern to pass styles to the immediate child without wrapping it in an unnecessary DOM node.
*   **Accessibility (a11y) as a Baseline:** All global UI components must be accessible by default. Always include appropriate `aria-` attributes, ensure full keyboard navigability, and respect `prefers-reduced-motion` where animations are used.

---

## 8. Enterprise-Grade Tooling & Package Ecosystem

*   **State Management:** Rely on Next.js Server Components, URL search parameters, and React 19's `useActionState` as primary sources of truth. Use **Zustand** for lightweight, scalable global client state.
*   **Client-Side Data Fetching:** Default to native Next.js server-side `fetch`. If client-side fetching, polling, or optimistic pagination is required, use **TanStack Query (React Query)** or **SWR**. Never use raw `useEffect` for data fetching.
*   **Form Handling & Validation:** Use **React Hook Form** paired strictly with **Zod** for schema validation on complex forms. For simple mutations, prefer native `<form action={...}>`.
*   **Mobile-First Tailwind Execution:** Always write default base utility classes for mobile viewports first. Only apply Tailwind's responsive breakpoints (`sm:`, `md:`, `lg:`, `xl:`) to override and scale styles up. Never start styling for desktop and work backward.
*   **Fluid Layouts & Mobile Usability:** Avoid fixed pixel dimensions that break on smaller screens. Utilize fluid layout utilities (`w-full`, `flex`, `grid`). Ensure interactive elements have a minimum touch target size of 44x44px.
*   **Utility Libraries:** Use **date-fns** or **dayjs** for dates (strictly avoid `moment.js`). Prefer native ES6+ array/object methods over Lodash, but if Lodash is necessary, use `lodash-es` and import specific functions.
*   **Dependency Discipline:** Do not install third-party packages for trivial tasks if a lightweight alternative exists. Keep the `package.json` lean.

---

## 9. API Integration & Contracts

*   **Single Source of Truth:** Never guess API endpoints, request payloads, or response shapes. Always read the Swagger contracts located in the `/_docs/api` directory.
*   **Type Safety:** When writing Server Actions or fetch requests, strictly map your TypeScript interfaces and Zod validation schemas to the definitions found in the corresponding `swagger.json` file.

---

## 10. Project Structure & App Router Conventions

Strictly adhere to the official Next.js App Router project structure and file conventions. Never use the legacy `pages/` directory.

*   **Route Groups for Organization:** Use Route Groups (e.g., `(auth)`, `(dashboard)`) to logically group related routes without affecting the public-facing URL structure.
*   **Private Folders:** Use the underscore prefix (e.g., `_components`, `_lib`) to opt a folder out of routing. This is mandatory for internal documentation, local API contracts, or strictly internal domain logic.
*   **Strict File Conventions:** Only use Next.js reserved filenames for routing behaviors (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `route.ts`). Note that `route.ts` must not exist in the same segment as `page.tsx`.
*   **Feature Colocation:** Place feature-specific components, custom hooks, and local schemas directly inside their respective route folders (e.g., `app/(auth)/login/components/LoginForm.tsx`). Do not dump every component into the global folder.
*   **Global Components Location:** Place universally shared UI components (e.g., Buttons, standard Modals) in a root `/components` directory.
*   **Global Logic Location:** Place shared logic, API fetchers, and formatting functions in a root `/lib` or `/utils` directory.
*   **Advanced Routing:** Utilize Parallel Routes (`@folder`) for complex layouts with independent loading states, and Intercepting Routes (`(..)folder`) for contextual overlays like modals.