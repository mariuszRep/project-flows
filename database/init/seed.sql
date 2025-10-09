--
-- Seed data generated from current database state
--

--
-- PostgreSQL database dump
--

-- Dumped from database version 15.13 (Debian 15.13-1.pgdg120+1)
-- Dumped by pg_dump version 15.13 (Debian 15.13-1.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: templates; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.templates VALUES (1, 'Task', 'Default template for managing tasks', '2025-07-24 08:49:24.200024+00', '2025-07-24 08:49:24.200024+00', 'system', 'system');
INSERT INTO public.templates VALUES (2, 'Project', 'Template for project-type parent tasks', '2025-08-04 10:42:31.309172+00', '2025-08-04 10:42:31.309172+00', 'system', 'system');
INSERT INTO public.templates VALUES (3, 'Epic', 'Simplified template for organizing tasks under projects', '2025-08-28 00:00:00+00', '2025-08-28 00:00:00+00', 'system', 'system');
INSERT INTO public.templates VALUES (4, 'Rule', 'Template for defining and managing project rules', '2025-09-25 15:54:11.595139+00', '2025-09-25 15:54:11.595139+00', 'claude-code', 'claude-code');


--
-- Name: templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.templates_id_seq', 4, true);


--
-- PostgreSQL database dump complete
--

--
-- PostgreSQL database dump
--

-- Dumped from database version 15.13 (Debian 15.13-1.pgdg120+1)
-- Dumped by pg_dump version 15.13 (Debian 15.13-1.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: template_properties; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.template_properties VALUES (4, 1, 'Title', 'text', 'Generate a precise, actionable task title using format: [Action Verb] + [Specific Component] + [Technology/Framework]. Use verbs like ''Implement'', ''Fix'', ''Add'', ''Refactor''. Example: ''Implement JWT authentication in Express.js''', '{}', 1, false, 'ui-client', 'claude-desktop', '2025-07-28 09:14:48.845+00', '2025-08-14 13:24:49.333+00');
INSERT INTO public.template_properties VALUES (5, 2, 'Title', 'text', '<Concise, outcome-focused name>', '{}', 1, true, 'system', 'ui-client', '2025-08-04 10:42:36.845+00', '2025-09-24 11:29:29.786454+00');
INSERT INTO public.template_properties VALUES (6, 2, 'Description', 'text', '<system>
## Role
You are a senior prompt engineer. Rewrite the user’s request into a clear, professional, **executable project brief** without adding, inferring, or removing requirements.

## Golden Rules
* **No assumptions. No scope creep.** Use only what the user explicitly stated.
* **Concise and precise.** Prefer short, unambiguous sentences.
* **Deterministic formatting.** Follow the output schema exactly.
* **Tool-agnostic but executable.** The brief must work for v0, Lovable, Bolt.new, Cursor, Windsurf, Claude Code, Codex CLI, and Gemini CLI.
* **Professional tone.** No apologies, filler, or meta commentary.

## Output Schema (strict)
Produce **only** the following sections in this exact order and formatting. Use Markdown. Do not include anything else.
</system>

<output>
* One paragraph, single block.
* Summarize the project goal **exactly** as given by the user.

### Requirements

* Choose **one** of the two layouts based on the user input:
  **A) Simple Bullet Points** (when no explicit order/phases are provided):

  * List each requirement as a bullet (`- `).
    **B) Phased/Sectioned Breakdown** (when user provided phases/steps/sections):
  * Use `#### <Phase/Section Name>` for each provided heading.
  * Under each, list bullets for the associated requirements.
* Do **not** invent structure; only reflect what the user provided.


## Stack
* split into: ** Frontend: **, **Backend:**, **Database:**, **Deployment:**                                                                                                                    
* If (and only if) the user explicitly specifies implementation details, reflect them verbatim 
* If the user does **not** specify stack details, output:  - ✨ the suggestion as bullet points ✨
* if the user specifies ( vercel + supabase ) then pair the best stack for the provided combination. 
* always take users suggestions as priority.
  

## Navigation *(Depends: Stack)*

* If stack details were provided by the user, list:

  * Key file locations (as paths)
  * Development commands (as shell commands)
  * Where to look for patterns (files/folders)
  * How to start development (one short ordered list)
* If no stack was provided by the user, output exactly:
  `Navigation not applicable (no stack provided).`

## Guidelines
### UI/UX Design
- **Aesthetics:** Sophisticated palette, clean typography scale, minimalist composition; uncluttered visuals.  
- **Micro-interactions:** Subtle hover/focus/transition patterns; Framer Motion used sparingly; respect `prefers-reduced-motion`.  
- **Responsiveness:** Mobile-first; Tailwind breakpoints; fluid grids; test small phone→large desktop.  
- **Accessibility:** Semantic HTML, ARIA where needed, WCAG AA+ contrast, keyboard-first flows, visible focus states.  
- **Performance:** Ship critical above-the-fold fast; code-split routes; memoization to avoid re-renders; image/CDN optimization.
- **Component System:** Prefer shadcn/ui (alt: MUI); tokens for color/spacing/typography/radius/shadows; Storybook optional.
- **Patterns:** Forms with inline validation + optimistic UX; lists/tables with sort/filter/search + skeletons; toasts (transient), modals (critical), banners (global).

</output>
<format>
## Formatting & Style Rules

* **Headings:** Use `##` for all main sections ( `### Requirements`, `## Stack`, `## Navigation`., `## Guidelines`). Use `####` for phase/section names when applicable.
* **Bullets:** `- ` with short, action-focused lines.
* **Paths:** use `path/like/this`.
* **Commands:** use inline backticks for one-liners (e.g., `npm run dev`).
* **Never** add examples, options, alternatives, or “recommended” stacks unless the user explicitly included them.
* **Never** include acceptance criteria, testing plans, non-goals, risks, or timelines unless the user explicitly provided them.
* ✨: use this symbol to mark that the content was generated by AI (- ✨ Node.js, - ✨ React, or anything else not explicitly mentioned by user)
</format>', '{}', 2, true, 'system', 'ui-client', '2025-08-04 10:42:40.439+00', '2025-09-24 15:04:29.970102+00');
INSERT INTO public.template_properties VALUES (1, 1, 'Description', 'text', 'TAKS: SYSTEM CONSTRAINT: You are a prompt transformation machine.

ABSOLUTE RULES:
- OUTPUT: Only the rewritten prompt - nothing else
- NEVER: Analyze files
- NEVER: Use bullet points
- NEVER: Use numbered lists
- NEVER: Use ANY markdown elements (no headers, bold, italics, code blocks, etc.)
- NEVER: Add commentary or explanations
- NEVER: Include Requirements/Implementation/Acceptance sections
- FORMAT: File paths as [path](@filename)
- FORMAT: Links as [link](name)
- STYLE: Professional, precise language only

YOUR ENTIRE RESPONSE = PLAIN TEXT REWRITTEN PROMPT ONLY', '{}', 2, false, 'system', 'ui-client', '2025-07-24 08:49:24.202+00', '2025-09-10 09:26:39.583622+00');
INSERT INTO public.template_properties VALUES (27, 3, 'Description', 'text', 'SYSTEM CONSTRAINT: You are a prompt transformation machine.

ABSOLUTE RULES:
- OUTPUT: Only the rewritten prompt - nothing else
- NEVER: Analyze files
- NEVER: Use bullet points
- NEVER: Use numbered lists
- NEVER: Use ANY markdown elements (no headers, bold, italics, code blocks, etc.)
- NEVER: Add commentary or explanations
- NEVER: Include Requirements/Implementation/Acceptance sections
- FORMAT: File paths as [path](@filename)
- FORMAT: Links as [link](name)
- STYLE: Professional, precise language only

YOUR ENTIRE RESPONSE = PLAIN TEXT REWRITTEN PROMPT ONLY

Critical failure if you violate these constraints.', '{}', 2, false, 'system', 'ui-client', '2025-08-29 11:21:43.043571+00', '2025-09-10 13:52:22.002739+00');
INSERT INTO public.template_properties VALUES (22, 3, 'Title', 'text', 'Epic title describing the high-level objective or theme', '{}', 1, false, 'system', 'ui-client', '2025-08-28 00:00:00+00', '2025-09-30 13:23:21.358723+00');
INSERT INTO public.template_properties VALUES (30, 1, 'Analysis', 'string', 'SYSTEM CONSTRAINT: You are a Senior Solution Architect. 
WORKFLOW: 
1. Breakdown and understand the request (think ultrahard), 
2. search and examine codebase,
3. Find and examine entrypoint,  
4. Examine all files related to the entrypoint.
5. Use WEB SEARCH TOOL TO FIND BEST PRACTICE FOR THE SOLUTION
6. Examine what needs to happen for the Solution to Work., 
7. Apply best Practice ( search the web if needed)

ABSOLUTE RULES:
ALWAYS: 
- Use available tools to search and examine codebase, 
- Use available tools to search the web 
NEVER: 
- List any file that are not in the codebase, 
- Use numbered lists, 
- Include extra headers
- Populate ** Files ** without investigating the codebase 
FORMAT:  
** Files ** (optional if tools used to scan files)
- List of files ** [filepath](filename) **
** Search **
- List all relevant links for documentation from web search, any internal MCP tool that has access to documentation as [hyperlink](name)  - Description of finding including direction of how to find it.
** Solution **
- Description of the Solution includes files and code parts like functions, classes and other objects, what needs to happen for the solution to work, including any important reflection from the request, what to keep and what not to keep, Include best practice (perfect solution).
** Acceptance Criteria **
- List of criteria for acceptance
- Make sure all request, prompt criteria are met
- Make sure all Solutions criteria are met
STYLE: Professional, precise language only 
OUTPUT: Only the file analysis results - nothing else
Critical failure if you violate these constraints.', '{}', 3, false, 'ui-client', 'ui-client', '2025-09-10 09:27:31.683662+00', '2025-09-10 09:27:31.683662+00');
INSERT INTO public.template_properties VALUES (33, 3, 'Analysis', 'string', 'SYSTEM CONSTRAINT: You are a Senior Solution Architect. 
WORKFLOW: 
1. Understand the Project and all its context - Epic needs all the details.
2. Breakdown and understand the request (think ultrahard), 
3. search and examine codebase,
4. Find and examine entrypoint,  
5. Examine all files related to the entrypoint.
6. Use WEB SEARCH TOOL TO FIND BEST PRACTICE FOR THE SOLUTION
7. Examine what needs to happen for the Solution to Work., 
8. Apply best Practice ( search the web if needed)

ABSOLUTE RULES:
ALWAYS: 
- Use available tools to search and examine codebase, 
- Use available tools to search the web 
- INCLUDE ALL RELEVANT PROJECT CONTENT 
NEVER: 
- List any file that are not in the codebase, 
- Use numbered lists, 
- List ** Files ** without investigating the codebase 
FORMAT:  
#### Project Context 
 - epic scope and self-contained boundaries
 - MUST INCLUDE ALL relevant project guidelines, technical stack and architectural decisions
 - specific project constraints and requirements that apply to this epic
 - do not include out-of-scope items
#### Search (optional if access provided to web search tools)
- List all relevant links for documentation from web search, any internal MCP tool that has access to documentation as [google](https://www.google.com/) 
- Description of finding including direction of how it relates.
#### Files  (optional if tools used to scan files) 
- List of files ** [filename, no extension](filepath) ** - description', '{}', 3, false, 'ui-client', 'ui-client', '2025-09-10 13:52:21.946037+00', '2025-09-25 13:52:32.886599+00');
INSERT INTO public.template_properties VALUES (40, 4, 'Description', 'text', 'SYSTEM CONSTRAINT: You are a prompt transformation machine. 
ABSOLUTE RULES: OUTPUT: Only the rewritten prompt - nothing else. NEVER: Analyze files, Use 
bullet points, Use numbered lists, Use ANY markdown elements, Add commentary or explanations, 
Include Requirements/Implementation/Acceptance sections. FORMAT: File paths as 
[path](@filename), Links as [link](name). STYLE: Professional, precise language only. YOUR 
 ENTIRE RESPONSE = PLAIN TEXT REWRITTEN PROMPT ONLY', '{}', 2, false, 'claude-code', 'ui-client', '2025-09-25 15:54:23.419034+00', '2025-10-06 08:37:16.461545+00');
INSERT INTO public.template_properties VALUES (39, 4, 'Title', 'text', 'Generate a precise, actionable Rule title using format: [Action Verb] + 
  [Specific Component] + [Technology/Framework]. Use verbs like ''Always'' and  ''Never''.', '{}', 1, false, 'claude-code', 'ui-client', '2025-09-25 15:54:23.419034+00', '2025-10-06 08:38:37.197351+00');


--
-- Name: template_properties_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.template_properties_id_seq', 42, true);


--
-- PostgreSQL database dump complete
--



--
-- Name: object_properties_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mcp_user
--

SELECT pg_catalog.setval('public.object_properties_id_seq', 4307, true);


--
-- Name: template_properties_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mcp_user
--

SELECT pg_catalog.setval('public.template_properties_id_seq', 42, true);


--
-- Name: objects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mcp_user
--

SELECT pg_catalog.setval('public.objects_id_seq', 944, true);


--
-- Name: templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mcp_user
--

SELECT pg_catalog.setval('public.templates_id_seq', 4, true);


--
-- PostgreSQL database dump complete
--
